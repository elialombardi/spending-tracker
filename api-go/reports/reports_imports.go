package reports

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

var accountNumberRegex = regexp.MustCompile(`(?i)Conto\s+BancoPosta\s+n\.:\s*(\S+)`)

func parsePosteItalianeWorkbook(reader multipart.File) (parsedWorkbook, error) {
	content, err := io.ReadAll(reader)
	if err != nil {
		return parsedWorkbook{}, err
	}
	book, err := excelize.OpenReader(bytes.NewReader(content))
	if err != nil {
		return parsedWorkbook{}, err
	}
	defer book.Close()

	sheetName := book.GetSheetName(0)
	rows, err := book.GetRows(sheetName)
	if err != nil {
		return parsedWorkbook{}, err
	}
	headerRow := -1
	for index, row := range rows {
		if normalizeForFingerprint(cellValue(row, 0)) == "DATA CONTABILE" && normalizeForFingerprint(cellValue(row, 4)) == "DESCRIZIONE OPERAZIONI" {
			headerRow = index
			break
		}
	}
	if headerRow < 0 {
		return parsedWorkbook{}, fmt.Errorf("could not find the Poste Italiane transaction header row")
	}
	accountNumber := "UNKNOWN"
	for i := 0; i < len(rows) && i < 20; i++ {
		joined := strings.Join(rows[i], " ")
		match := accountNumberRegex.FindStringSubmatch(joined)
		if len(match) > 1 {
			accountNumber = strings.TrimSpace(match[1])
			break
		}
	}

	transactions := []ParsedTransaction{}
	for i := headerRow + 1; i < len(rows); i++ {
		row := rows[i]
		description := collapseWhitespace(cellValue(row, 4))
		debit, err := parseAmount(cellValue(row, 2))
		if err != nil {
			return parsedWorkbook{}, err
		}
		credit, err := parseAmount(cellValue(row, 3))
		if err != nil {
			return parsedWorkbook{}, err
		}
		if description == "" && debit == 0 && credit == 0 {
			continue
		}
		bookingDate, err := parseWorkbookDate(cellValue(row, 0))
		if err != nil {
			return parsedWorkbook{}, err
		}
		valueDate, err := parseWorkbookDate(cellValue(row, 1))
		if err != nil {
			return parsedWorkbook{}, err
		}
		amount := -debit
		if credit > 0 {
			amount = credit
		}
		merchantKey := extractMerchantKey(description)
		transactions = append(transactions, ParsedTransaction{
			AccountNumber:         accountNumber,
			BookingDate:           bookingDate,
			ValueDate:             valueDate,
			DebitAmount:           debit,
			CreditAmount:          credit,
			Amount:                amount,
			RawDescription:        description,
			NormalizedDescription: normalizeForFingerprint(description),
			MerchantKey:           merchantKey,
			SourceFingerprint:     createFingerprint(accountNumber, bookingDate, valueDate, amount, description),
		})
	}
	return parsedWorkbook{accountNumber: accountNumber, transactions: transactions}, nil
}

func importParsedTransactions(database *gorm.DB, accountNumber string, fileName string, transactions []ParsedTransaction) (ImportResultResponse, error) {
	known := map[string]struct{}{}
	if len(transactions) > 0 {
		fingerprints := make([]string, 0, len(transactions))
		for _, tx := range transactions {
			fingerprints = append(fingerprints, tx.SourceFingerprint)
		}
		var existing []string
		if err := database.Model(&Transaction{}).
			Where("source_fingerprint IN ?", fingerprints).
			Distinct("source_fingerprint").
			Pluck("source_fingerprint", &existing).Error; err != nil {
			return ImportResultResponse{}, err
		}
		for _, fingerprint := range existing {
			known[fingerprint] = struct{}{}
		}
	}

	behaviors, err := fetchRuleBehaviorLookup(database)
	if err != nil {
		return ImportResultResponse{}, err
	}
	rules, err := fetchCategoryRules(database)
	if err != nil {
		return ImportResultResponse{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	imported := 0
	skipped := 0
	autoCategorized := 0
	reviewQueue := []ReviewTransactionResponse{}
	tx := database.Begin()
	if tx.Error != nil {
		return ImportResultResponse{}, tx.Error
	}
	defer tx.Rollback()

	for _, parsed := range transactions {
		if _, exists := known[parsed.SourceFingerprint]; exists {
			skipped++
			continue
		}
		known[parsed.SourceFingerprint] = struct{}{}
		suggestionCategory, suggestionConfidence, exactMatch, behavior := matchCategory(parsed.MerchantKey, rules)
		needsReview := parsed.Amount <= 0
		var category *string
		var suggestedCategory *string
		var suggestionConfidenceValue *float64
		if parsed.Amount <= 0 {
			suggestedCategory = suggestionCategory
			suggestionConfidenceValue = suggestionConfidence
		}
		if parsed.Amount <= 0 && exactMatch && suggestionCategory != nil && *suggestionCategory != "" {
			category = suggestionCategory
			needsReview = false
			suggestedCategory = nil
			suggestionConfidenceValue = nil
			autoCategorized++
		}
		id := newUUID()
		record := Transaction{
			ID:                      id,
			AccountNumber:           parsed.AccountNumber,
			BookingDate:             parsed.BookingDate,
			ValueDate:               parsed.ValueDate,
			Amount:                  parsed.Amount,
			DebitAmount:             parsed.DebitAmount,
			CreditAmount:            parsed.CreditAmount,
			RawDescription:          parsed.RawDescription,
			NormalizedDescription:   parsed.NormalizedDescription,
			MerchantKey:             parsed.MerchantKey,
			NeedsReview:             needsReview,
			ExcludeFromCalculations: false,
			SourceFingerprint:       parsed.SourceFingerprint,
			SourceFileName:          fileName,
			ImportedAtUtc:           now,
			IsMonthlyRecurring:      false,
		}
		if category != nil {
			record.Category = *category
		}
		if suggestedCategory != nil {
			record.SuggestedCategory = *suggestedCategory
		}
		if suggestionConfidenceValue != nil {
			record.SuggestionConfidence = *suggestionConfidenceValue
		}
		if err := tx.Create(&record).Error; err != nil {
			return ImportResultResponse{}, err
		}
		imported++
		if needsReview {
			reviewQueue = append(reviewQueue, ReviewTransactionResponse{TransactionID: id, BookingDate: parsed.BookingDate, Amount: round2(absFloat(parsed.Amount)), Description: parsed.RawDescription, MerchantKey: parsed.MerchantKey, MerchantRuleBehavior: resolveMerchantRuleBehavior(parsed.MerchantKey, behaviors), SuggestedCategory: suggestionCategory, SuggestionConfidence: suggestionConfidence})
		}
		_ = behavior
	}
	if err := tx.Commit().Error; err != nil {
		return ImportResultResponse{}, err
	}
	sort.Slice(reviewQueue, func(i, j int) bool { return reviewQueue[i].Amount > reviewQueue[j].Amount })
	return ImportResultResponse{AccountNumber: accountNumber, FileName: fileName, ImportedTransactions: imported, SkippedDuplicates: skipped, AutoCategorizedTransactions: autoCategorized, ReviewTransactions: len(reviewQueue), ReviewQueue: reviewQueue}, nil
}

type categoryRule struct {
	MerchantKey string
	Category    string
	Behavior    string
}

func fetchCategoryRules(database *gorm.DB) ([]categoryRule, error) {
	var rules []CategoryRule
	if err := database.Model(&CategoryRule{}).
		Select("merchant_key, category, behavior").
		Scan(&rules).Error; err != nil {
		return nil, err
	}

	result := make([]categoryRule, 0, len(rules))
	for _, rule := range rules {
		result = append(result, categoryRule{
			MerchantKey: rule.MerchantKey,
			Category:    rule.Category,
			Behavior:    normalizeBehavior(rule.Behavior),
		})
	}
	return result, nil
}

func matchCategory(merchantKey string, rules []categoryRule) (*string, *float64, bool, string) {
	if strings.TrimSpace(merchantKey) == "" || len(rules) == 0 {
		behavior := defaultRuleBehavior(merchantKey)
		return nil, nil, false, behavior
	}
	for _, rule := range rules {
		if rule.MerchantKey == merchantKey {
			if rule.Behavior == merchantRuleBehaviorAlwaysReview {
				return nil, nil, false, merchantRuleBehaviorAlwaysReview
			}
			category := rule.Category
			confidence := 1.0
			return &category, &confidence, true, merchantRuleBehaviorAutoApply
		}
	}
	if defaultRuleBehavior(merchantKey) == merchantRuleBehaviorAlwaysReview {
		return nil, nil, false, merchantRuleBehaviorAlwaysReview
	}
	bestSimilarity := 0.0
	var bestCategory *string
	for _, rule := range rules {
		if rule.Behavior != merchantRuleBehaviorAutoApply || strings.TrimSpace(rule.Category) == "" {
			continue
		}
		similarity := calculateSimilarity(merchantKey, rule.MerchantKey)
		if similarity > bestSimilarity {
			bestSimilarity = similarity
			category := rule.Category
			bestCategory = &category
		}
	}
	if bestCategory == nil || bestSimilarity < 0.72 {
		return nil, nil, false, merchantRuleBehaviorAutoApply
	}
	conf := round2(bestSimilarity)
	return bestCategory, &conf, false, merchantRuleBehaviorAutoApply
}

func fetchCycleOptions(db *gorm.DB) ([]CycleOptionResponse, error) {
	anchors, err := fetchCycleAnchorDates(db)
	if err != nil {
		return nil, err
	}
	if len(anchors) == 0 {
		return []CycleOptionResponse{}, nil
	}
	options := make([]CycleOptionResponse, 0, len(anchors))
	for i, from := range anchors {
		to := addMonthsMinusDay(from, 1)
		if i+1 < len(anchors) {
			next, _ := time.Parse(dateLayout, anchors[i+1])
			to = next.AddDate(0, 0, -1).Format(dateLayout)
		}
		options = append(options, CycleOptionResponse{From: from, To: to})
	}
	sort.Slice(options, func(i, j int) bool { return options[i].From > options[j].From })
	return options, nil
}

func buildMonthlyReportByMonth(db *gorm.DB, year int, month int) (MonthlyReportResponse, error) {
	from, to, err := getIncomeAnchoredRange(db, year, month)
	if err != nil {
		return MonthlyReportResponse{}, err
	}
	transactions, err := fetchTransactionsForRange(db, from, to)
	if err != nil {
		return MonthlyReportResponse{}, err
	}
	return buildMonthlyReportResponse(year, month, from, to, transactions), nil
}

func buildCycleReport(db *gorm.DB, cycleStart string) (MonthlyReportResponse, bool, error) {
	from, to, found, err := getCycleRange(db, cycleStart)
	if err != nil || !found {
		return MonthlyReportResponse{}, found, err
	}
	transactions, err := fetchTransactionsForRange(db, from, to)
	if err != nil {
		return MonthlyReportResponse{}, false, err
	}
	parsed, _ := time.Parse(dateLayout, from)
	return buildMonthlyReportResponse(parsed.Year(), int(parsed.Month()), from, to, transactions), true, nil
}

func exportMonthlyReportData(db *gorm.DB, year int, month int, format string) ([]byte, string, string, error) {
	report, err := buildMonthlyReportByMonth(db, year, month)
	if err != nil {
		return nil, "", "", err
	}
	transactions, err := fetchTransactionsForRange(db, report.From, report.To)
	if err != nil {
		return nil, "", "", err
	}
	return buildReportExport(report, transactions, format)
}

func exportCycleReportData(db *gorm.DB, cycleStart string, format string) ([]byte, string, string, bool, error) {
	report, found, err := buildCycleReport(db, cycleStart)
	if err != nil || !found {
		return nil, "", "", found, err
	}
	transactions, err := fetchTransactionsForRange(db, report.From, report.To)
	if err != nil {
		return nil, "", "", false, err
	}
	content, contentType, fileName, err := buildReportExport(report, transactions, format)
	return content, contentType, fileName, true, err
}

func fetchTransactionsForRange(db *gorm.DB, from string, to string) ([]transactionRow, error) {
	var transactions []transactionRow
	if err := db.Model(&Transaction{}).
		Select("id, account_number, booking_date, value_date, amount, raw_description, merchant_key, category, suggested_category, suggestion_confidence, needs_review, exclude_from_calculations, imported_at_utc, is_monthly_recurring").
		Where("booking_date >= ? AND booking_date <= ? AND exclude_from_calculations = ?", from, to, false).
		Order("booking_date DESC, imported_at_utc DESC").
		Scan(&transactions).Error; err != nil {
		return nil, err
	}
	return transactions, nil
}

func buildMonthlyReportResponse(year int, month int, from string, to string, transactions []transactionRow) MonthlyReportResponse {
	expenses := []transactionRow{}
	incomes := []transactionRow{}
	for _, transaction := range transactions {

		if transaction.Amount < 0 {
			expenses = append(expenses, transaction)
		} else if transaction.Amount > 0 {
			incomes = append(incomes, transaction)
		}
	}
	type categoryAgg struct {
		total float64
		count int
	}
	categoryMap := map[string]categoryAgg{}
	for _, transaction := range expenses {
		category := "Uncategorized"
		if transaction.Category.Valid && strings.TrimSpace(transaction.Category.String) != "" {
			category = transaction.Category.String
		}
		agg := categoryMap[category]
		agg.total += absFloat(transaction.Amount)
		agg.count++
		categoryMap[category] = agg
	}
	categoryKeys := make([]string, 0, len(categoryMap))
	totalSpent := 0.0
	for key, agg := range categoryMap {
		categoryKeys = append(categoryKeys, key)
		totalSpent += agg.total
	}
	sort.Slice(categoryKeys, func(i, j int) bool { return categoryMap[categoryKeys[i]].total > categoryMap[categoryKeys[j]].total })
	categoryResponses := make([]CategorySpendResponse, 0, len(categoryKeys))
	uncategorized := 0.0
	for _, key := range categoryKeys {
		agg := categoryMap[key]
		share := 0.0
		if totalSpent != 0 {
			share = round4(agg.total / totalSpent)
		}
		if key == "Uncategorized" {
			uncategorized = round2(agg.total)
		}
		categoryResponses = append(categoryResponses, CategorySpendResponse{Category: key, TotalSpent: round2(agg.total), Transactions: agg.count, ShareOfSpent: share})
	}
	type merchantAgg struct {
		total    float64
		count    int
		category *string
	}
	merchantMap := map[string]merchantAgg{}
	for _, transaction := range expenses {
		agg := merchantMap[transaction.MerchantKey]
		agg.total += absFloat(transaction.Amount)
		agg.count++
		if agg.category == nil && transaction.Category.Valid && strings.TrimSpace(transaction.Category.String) != "" {
			category := transaction.Category.String
			agg.category = &category
		}
		merchantMap[transaction.MerchantKey] = agg
	}
	merchantKeys := make([]string, 0, len(merchantMap))
	for key := range merchantMap {
		merchantKeys = append(merchantKeys, key)
	}
	sort.Slice(merchantKeys, func(i, j int) bool { return merchantMap[merchantKeys[i]].total > merchantMap[merchantKeys[j]].total })
	topMerchants := []MerchantSpendResponse{}
	for i, key := range merchantKeys {
		if i >= 8 {
			break
		}
		agg := merchantMap[key]
		topMerchants = append(topMerchants, MerchantSpendResponse{MerchantKey: key, Category: agg.category, TotalSpent: round2(agg.total), Transactions: agg.count})
	}
	sort.Slice(expenses, func(i, j int) bool { return absFloat(expenses[i].Amount) > absFloat(expenses[j].Amount) })
	largestExpenses := []ReportTransactionResponse{}
	for i, transaction := range expenses {
		if i >= 12 {
			break
		}
		direction := "income"
		if transaction.Amount < 0 {
			direction = "expense"
		}
		largestExpenses = append(largestExpenses, ReportTransactionResponse{TransactionID: transaction.ID, BookingDate: transaction.BookingDate, ValueDate: transaction.ValueDate, Amount: transaction.Amount, Direction: direction, Description: transaction.RawDescription, MerchantKey: transaction.MerchantKey, Category: nullableStringPtrFromNull(transaction.Category), NeedsReview: transaction.NeedsReview})
	}
	totalIncome := 0.0
	for _, income := range incomes {
		totalIncome += income.Amount
	}
	return MonthlyReportResponse{Year: year, Month: month, From: from, To: to, TotalTransactions: len(transactions), TotalSpent: round2(totalSpent), TotalIncome: round2(totalIncome), UncategorizedSpent: uncategorized, Categories: categoryResponses, TopMerchants: topMerchants, LargestExpenses: largestExpenses}
}

func buildReportExport(report MonthlyReportResponse, transactions []transactionRow, format string) ([]byte, string, string, error) {
	if format == "xlsx" {
		file := excelize.NewFile()
		defer file.Close()
		overview := "Overview"
		file.SetSheetName(file.GetSheetName(0), overview)
		_ = file.SetCellValue(overview, "A1", "Cycle start")
		_ = file.SetCellValue(overview, "B1", report.From)
		_ = file.SetCellValue(overview, "A2", "Income cycle")
		_ = file.SetCellValue(overview, "B2", report.From+" to "+report.To)
		_ = file.SetCellValue(overview, "A3", "Total transactions")
		_ = file.SetCellValue(overview, "B3", report.TotalTransactions)
		_ = file.SetCellValue(overview, "A4", "Total spent")
		_ = file.SetCellValue(overview, "B4", report.TotalSpent)
		_ = file.SetCellValue(overview, "A5", "Total income")
		_ = file.SetCellValue(overview, "B5", report.TotalIncome)
		_ = file.SetCellValue(overview, "A6", "Uncategorized spent")
		_ = file.SetCellValue(overview, "B6", report.UncategorizedSpent)
		categoriesSheet := "Categories"
		_, _ = file.NewSheet(categoriesSheet)
		_ = file.SetCellValue(categoriesSheet, "A1", "Category")
		_ = file.SetCellValue(categoriesSheet, "B1", "TotalSpent")
		_ = file.SetCellValue(categoriesSheet, "C1", "Transactions")
		_ = file.SetCellValue(categoriesSheet, "D1", "ShareOfSpent")
		for i, category := range report.Categories {
			row := i + 2
			_ = file.SetCellValue(categoriesSheet, fmt.Sprintf("A%d", row), category.Category)
			_ = file.SetCellValue(categoriesSheet, fmt.Sprintf("B%d", row), category.TotalSpent)
			_ = file.SetCellValue(categoriesSheet, fmt.Sprintf("C%d", row), category.Transactions)
			_ = file.SetCellValue(categoriesSheet, fmt.Sprintf("D%d", row), category.ShareOfSpent)
		}
		transactionsSheet := "Transactions"
		_, _ = file.NewSheet(transactionsSheet)
		headers := []string{"BookingDate", "ValueDate", "Direction", "Amount", "Category", "MerchantKey", "NeedsReview", "Description"}
		for i, header := range headers {
			_ = file.SetCellValue(transactionsSheet, fmt.Sprintf("%c1", 'A'+i), header)
		}
		for i, transaction := range transactions {
			row := i + 2
			direction := "income"
			if transaction.Amount < 0 {
				direction = "expense"
			}
			_ = file.SetCellValue(transactionsSheet, fmt.Sprintf("A%d", row), transaction.BookingDate)
			_ = file.SetCellValue(transactionsSheet, fmt.Sprintf("B%d", row), transaction.ValueDate)
			_ = file.SetCellValue(transactionsSheet, fmt.Sprintf("C%d", row), direction)
			_ = file.SetCellValue(transactionsSheet, fmt.Sprintf("D%d", row), transaction.Amount)
			_ = file.SetCellValue(transactionsSheet, fmt.Sprintf("E%d", row), derefString(nullableStringPtrFromNull(transaction.Category)))
			_ = file.SetCellValue(transactionsSheet, fmt.Sprintf("F%d", row), transaction.MerchantKey)
			_ = file.SetCellValue(transactionsSheet, fmt.Sprintf("G%d", row), transaction.NeedsReview)
			_ = file.SetCellValue(transactionsSheet, fmt.Sprintf("H%d", row), transaction.RawDescription)
		}
		buffer, err := file.WriteToBuffer()
		if err != nil {
			return nil, "", "", err
		}
		return buffer.Bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fmt.Sprintf("spending-report-%s_to_%s.xlsx", report.From, report.To), nil
	}
	b := &strings.Builder{}
	b.WriteString("Year,Month,From,To,TotalTransactions,TotalSpent,TotalIncome,UncategorizedSpent\n")
	b.WriteString(fmt.Sprintf("%d,%d,%s,%s,%d,%.2f,%.2f,%.2f\n\n", report.Year, report.Month, report.From, report.To, report.TotalTransactions, report.TotalSpent, report.TotalIncome, report.UncategorizedSpent))
	b.WriteString("Category,TotalSpent,Transactions,ShareOfSpent\n")
	for _, category := range report.Categories {
		b.WriteString(fmt.Sprintf("%s,%.2f,%d,%.4f\n", escapeCsv(category.Category), category.TotalSpent, category.Transactions, category.ShareOfSpent))
	}
	b.WriteString("\nBookingDate,ValueDate,Direction,Amount,Category,MerchantKey,NeedsReview,Description\n")
	for _, transaction := range transactions {
		direction := "income"
		if transaction.Amount < 0 {
			direction = "expense"
		}
		b.WriteString(fmt.Sprintf("%s,%s,%s,%.2f,%s,%s,%t,%s\n", transaction.BookingDate, transaction.ValueDate, direction, transaction.Amount, escapeCsv(derefString(nullableStringPtrFromNull(transaction.Category))), escapeCsv(transaction.MerchantKey), transaction.NeedsReview, escapeCsv(transaction.RawDescription)))
	}
	content := append([]byte{0xEF, 0xBB, 0xBF}, []byte(b.String())...)
	return content, "text/csv", fmt.Sprintf("spending-report-%s_to_%s.csv", report.From, report.To), nil
}

func fetchCycleAnchorDates(db *gorm.DB) ([]string, error) {
	configured, err := fetchConfiguredCycleIncomeCategories(db)
	if err != nil {
		return nil, err
	}

	query := db.Model(&Transaction{}).
		Select("DISTINCT booking_date").
		Where("amount > 0 AND exclude_from_calculations = ?", false)

	if len(configured) > 0 {
		query = query.Where("category IN ?", configured)
	}

	type row struct {
		BookingDate string `gorm:"column:booking_date"`
	}
	var rows []row
	if err := query.Order("booking_date ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}

	anchors := make([]string, 0, len(rows))
	for _, r := range rows {
		anchors = append(anchors, r.BookingDate)
	}
	return anchors, nil
}

func fetchConfiguredCycleIncomeCategories(db *gorm.DB) ([]string, error) {
	type row struct {
		Category string `gorm:"column:category"`
	}
	var rows []row
	if err := db.Model(&CycleIncomeCategory{}).Order("category").Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := make([]string, 0, len(rows))
	for _, r := range rows {
		result = append(result, r.Category)
	}
	return result, nil
}

func getIncomeAnchoredRange(db *gorm.DB, year int, month int) (string, string, error) {
	calendarStart := fmt.Sprintf("%04d-%02d-01", year, month)
	calendarEnd := addMonthsMinusDay(calendarStart, 1)
	anchors, err := fetchCycleAnchorDates(db)
	if err != nil {
		return "", "", err
	}
	cycleStart := ""
	for _, anchor := range anchors {
		if anchor <= calendarEnd {
			cycleStart = anchor
		} else {
			break
		}
	}
	if cycleStart == "" {
		return calendarStart, calendarEnd, nil
	}
	cycleEnd := addMonthsMinusDay(cycleStart, 1)
	for _, anchor := range anchors {
		if anchor > cycleStart {
			cycleEnd = addDays(anchor, -1)
			break
		}
	}
	return cycleStart, cycleEnd, nil
}

func getCycleRange(db *gorm.DB, cycleStart string) (string, string, bool, error) {
	anchors, err := fetchCycleAnchorDates(db)
	if err != nil {
		return "", "", false, err
	}
	found := slices.Contains(anchors, cycleStart)

	if !found {
		return "", "", false, nil
	}
	cycleEnd := addMonthsMinusDay(cycleStart, 1)
	for _, anchor := range anchors {
		if anchor > cycleStart {
			cycleEnd = addDays(anchor, -1)
			break
		}
	}
	return cycleStart, cycleEnd, true, nil
}
