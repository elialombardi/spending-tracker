package main

import (
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/xuri/excelize/v2"
)

type ImportResultResponse struct {
	AccountNumber             string                    `json:"accountNumber"`
	FileName                  string                    `json:"fileName"`
	ImportedTransactions      int                       `json:"importedTransactions"`
	SkippedDuplicates         int                       `json:"skippedDuplicates"`
	AutoCategorizedTransactions int                     `json:"autoCategorizedTransactions"`
	ReviewTransactions        int                       `json:"reviewTransactions"`
	ReviewQueue               []ReviewTransactionResponse `json:"reviewQueue"`
}

type ReviewTransactionResponse struct {
	TransactionID         string   `json:"transactionId"`
	BookingDate           string   `json:"bookingDate"`
	Amount                float64  `json:"amount"`
	Description           string   `json:"description"`
	MerchantKey           string   `json:"merchantKey"`
	MerchantRuleBehavior  string   `json:"merchantRuleBehavior"`
	SuggestedCategory     *string  `json:"suggestedCategory"`
	SuggestionConfidence  *float64 `json:"suggestionConfidence"`
}

type CycleOptionResponse struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type MonthlyReportResponse struct {
	Year               int                    `json:"year"`
	Month              int                    `json:"month"`
	From               string                 `json:"from"`
	To                 string                 `json:"to"`
	TotalTransactions  int                    `json:"totalTransactions"`
	TotalSpent         float64                `json:"totalSpent"`
	TotalIncome        float64                `json:"totalIncome"`
	UncategorizedSpent float64                `json:"uncategorizedSpent"`
	Categories         []CategorySpendResponse `json:"categories"`
	TopMerchants       []MerchantSpendResponse `json:"topMerchants"`
	LargestExpenses    []ReportTransactionResponse `json:"largestExpenses"`
}

type MerchantSpendResponse struct {
	MerchantKey  string  `json:"merchantKey"`
	Category     *string `json:"category"`
	TotalSpent   float64 `json:"totalSpent"`
	Transactions int     `json:"transactions"`
}

type ReportTransactionResponse struct {
	TransactionID string  `json:"transactionId"`
	BookingDate   string  `json:"bookingDate"`
	ValueDate     string  `json:"valueDate"`
	Amount        float64 `json:"amount"`
	Direction     string  `json:"direction"`
	Description   string  `json:"description"`
	MerchantKey   string  `json:"merchantKey"`
	Category      *string `json:"category"`
	NeedsReview   bool    `json:"needsReview"`
}

type parsedTransaction struct {
	AccountNumber         string
	BookingDate           string
	ValueDate             string
	DebitAmount           float64
	CreditAmount          float64
	Amount                float64
	RawDescription        string
	NormalizedDescription string
	MerchantKey           string
	SourceFingerprint     string
}

var accountNumberRegex = regexp.MustCompile(`(?i)Conto\s+BancoPosta\s+n\.:\s*(\S+)`)

func importPosteItaliane(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil || fileHeader == nil {
		return c.Status(fiber.StatusBadRequest).SendString("A non-empty Excel file is required.")
	}
	if strings.ToLower(filepath.Ext(fileHeader.Filename)) != ".xlsx" {
		return c.Status(fiber.StatusBadRequest).SendString("Only .xlsx Poste Italiane exports are supported.")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer file.Close()

	parsed, err := parsePosteItalianeWorkbook(file)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString(err.Error())
	}

	result, err := importParsedTransactions(db, parsed.accountNumber, fileHeader.Filename, parsed.transactions)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(result)
}

func getReportCycles(c *fiber.Ctx) error {
	cycles, err := fetchCycleOptions(db)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(cycles)
}

func getCycleReport(c *fiber.Ctx) error {
	cycleStart, err := parseRequiredDate(c.Query("cycleStart"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Cycle start is required.")
	}
	report, found, err := buildCycleReport(db, cycleStart)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !found {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(report)
}

func exportCycleReport(c *fiber.Ctx) error {
	cycleStart, err := parseRequiredDate(c.Query("cycleStart"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Cycle start is required.")
	}
	format := strings.TrimSpace(strings.ToLower(c.Query("format", "csv")))
	if format != "csv" && format != "xlsx" {
		return c.Status(fiber.StatusBadRequest).SendString("Supported formats are csv and xlsx.")
	}
	content, contentType, fileName, found, err := exportCycleReportData(db, cycleStart, format)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !found {
		return c.SendStatus(fiber.StatusNotFound)
	}
	c.Set("Content-Type", contentType)
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	return c.Send(content)
}

func getMonthlyReport(c *fiber.Ctx) error {
	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 || year > 2100 {
		return c.Status(fiber.StatusBadRequest).SendString("Year must be between 2000 and 2100.")
	}
	month, err := strconv.Atoi(c.Query("month"))
	if err != nil || month < 1 || month > 12 {
		return c.Status(fiber.StatusBadRequest).SendString("Month must be between 1 and 12.")
	}
	report, err := buildMonthlyReportByMonth(db, year, month)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(report)
}

func exportMonthlyReport(c *fiber.Ctx) error {
	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 || year > 2100 {
		return c.Status(fiber.StatusBadRequest).SendString("Year must be between 2000 and 2100.")
	}
	month, err := strconv.Atoi(c.Query("month"))
	if err != nil || month < 1 || month > 12 {
		return c.Status(fiber.StatusBadRequest).SendString("Month must be between 1 and 12.")
	}
	format := strings.TrimSpace(strings.ToLower(c.Query("format", "csv")))
	if format != "csv" && format != "xlsx" {
		return c.Status(fiber.StatusBadRequest).SendString("Supported formats are csv and xlsx.")
	}
	content, contentType, fileName, err := exportMonthlyReportData(db, year, month, format)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Set("Content-Type", contentType)
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	return c.Send(content)
}

type parsedWorkbook struct {
	accountNumber string
	transactions  []parsedTransaction
}

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

	transactions := []parsedTransaction{}
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
		amount := credit
		if credit <= 0 {
			amount = -debit
		}
		merchantKey := extractMerchantKey(description)
		transactions = append(transactions, parsedTransaction{
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

func importParsedTransactions(database *sql.DB, accountNumber string, fileName string, transactions []parsedTransaction) (ImportResultResponse, error) {
	known := map[string]struct{}{}
	if len(transactions) > 0 {
		placeholders := make([]string, 0, len(transactions))
		args := make([]any, 0, len(transactions))
		for _, tx := range transactions {
			placeholders = append(placeholders, "?")
			args = append(args, tx.SourceFingerprint)
		}
		rows, err := database.Query(`SELECT SourceFingerprint FROM Transactions WHERE SourceFingerprint IN (`+strings.Join(placeholders, ",")+`)`, args...)
		if err != nil {
			return ImportResultResponse{}, err
		}
		for rows.Next() {
			var fingerprint string
			if err := rows.Scan(&fingerprint); err != nil {
				rows.Close()
				return ImportResultResponse{}, err
			}
			known[fingerprint] = struct{}{}
		}
		rows.Close()
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
	tx, err := database.Begin()
	if err != nil {
		return ImportResultResponse{}, err
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
		var category any
		var suggestedCategory any
		var suggestionConfidenceValue any
		if parsed.Amount <= 0 {
			suggestedCategory = suggestionCategory
			suggestionConfidenceValue = suggestionConfidence
		}
		if parsed.Amount <= 0 && exactMatch && suggestionCategory != nil && *suggestionCategory != "" {
			category = *suggestionCategory
			needsReview = false
			suggestedCategory = nil
			suggestionConfidenceValue = nil
			autoCategorized++
		}
		id := newUUID()
		_, err := tx.Exec(`INSERT INTO Transactions (Id, AccountNumber, BookingDate, ValueDate, Amount, DebitAmount, CreditAmount, RawDescription, NormalizedDescription, MerchantKey, Category, SuggestedCategory, SuggestionConfidence, NeedsReview, ExcludeFromCalculations, SourceFingerprint, SourceFileName, ImportedAtUtc, IsMonthlyRecurring) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0);`,
			id, parsed.AccountNumber, parsed.BookingDate, parsed.ValueDate, parsed.Amount, parsed.DebitAmount, parsed.CreditAmount, parsed.RawDescription, parsed.NormalizedDescription, parsed.MerchantKey, category, suggestedCategory, suggestionConfidenceValue, boolToInt(needsReview), parsed.SourceFingerprint, fileName, now)
		if err != nil {
			return ImportResultResponse{}, err
		}
		imported++
		if needsReview {
			reviewQueue = append(reviewQueue, ReviewTransactionResponse{TransactionID: id, BookingDate: parsed.BookingDate, Amount: round2(absFloat(parsed.Amount)), Description: parsed.RawDescription, MerchantKey: parsed.MerchantKey, MerchantRuleBehavior: resolveMerchantRuleBehavior(parsed.MerchantKey, behaviors), SuggestedCategory: suggestionCategory, SuggestionConfidence: suggestionConfidence})
		}
		_ = behavior
	}
	if err := tx.Commit(); err != nil {
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

func fetchCategoryRules(database *sql.DB) ([]categoryRule, error) {
	rows, err := database.Query(`SELECT MerchantKey, Category, Behavior FROM CategoryRules`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rules := []categoryRule{}
	for rows.Next() {
		var rule categoryRule
		if err := rows.Scan(&rule.MerchantKey, &rule.Category, &rule.Behavior); err != nil {
			return nil, err
		}
		rule.Behavior = normalizeBehavior(rule.Behavior)
		rules = append(rules, rule)
	}
	return rules, rows.Err()
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

func fetchCycleOptions(database *sql.DB) ([]CycleOptionResponse, error) {
	anchors, err := fetchCycleAnchorDates(database)
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

func buildMonthlyReportByMonth(database *sql.DB, year int, month int) (MonthlyReportResponse, error) {
	from, to, err := getIncomeAnchoredRange(database, year, month)
	if err != nil {
		return MonthlyReportResponse{}, err
	}
	transactions, err := fetchTransactionsForRange(database, from, to)
	if err != nil {
		return MonthlyReportResponse{}, err
	}
	return buildMonthlyReportResponse(year, month, from, to, transactions), nil
}

func buildCycleReport(database *sql.DB, cycleStart string) (MonthlyReportResponse, bool, error) {
	from, to, found, err := getCycleRange(database, cycleStart)
	if err != nil || !found {
		return MonthlyReportResponse{}, found, err
	}
	transactions, err := fetchTransactionsForRange(database, from, to)
	if err != nil {
		return MonthlyReportResponse{}, false, err
	}
	parsed, _ := time.Parse(dateLayout, from)
	return buildMonthlyReportResponse(parsed.Year(), int(parsed.Month()), from, to, transactions), true, nil
}

func exportMonthlyReportData(database *sql.DB, year int, month int, format string) ([]byte, string, string, error) {
	report, err := buildMonthlyReportByMonth(database, year, month)
	if err != nil {
		return nil, "", "", err
	}
	transactions, err := fetchTransactionsForRange(database, report.From, report.To)
	if err != nil {
		return nil, "", "", err
	}
	return buildReportExport(report, transactions, format)
}

func exportCycleReportData(database *sql.DB, cycleStart string, format string) ([]byte, string, string, bool, error) {
	report, found, err := buildCycleReport(database, cycleStart)
	if err != nil || !found {
		return nil, "", "", found, err
	}
	transactions, err := fetchTransactionsForRange(database, report.From, report.To)
	if err != nil {
		return nil, "", "", false, err
	}
	content, contentType, fileName, err := buildReportExport(report, transactions, format)
	return content, contentType, fileName, true, err
}

func fetchTransactionsForRange(database *sql.DB, from string, to string) ([]transactionRow, error) {
	rows, err := database.Query(`SELECT Id, AccountNumber, BookingDate, ValueDate, Amount, RawDescription, MerchantKey, Category, SuggestedCategory, SuggestionConfidence, NeedsReview, ExcludeFromCalculations, ImportedAtUtc, IsMonthlyRecurring FROM Transactions WHERE BookingDate >= ? AND BookingDate <= ? AND ExcludeFromCalculations = 0 ORDER BY BookingDate DESC, ImportedAtUtc DESC`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	transactions := []transactionRow{}
	for rows.Next() {
		row, err := scanTransactionRow(rows)
		if err != nil {
			return nil, err
		}
		transactions = append(transactions, row)
	}
	return transactions, rows.Err()
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
	type categoryAgg struct{ total float64; count int }
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
	for key, agg := range categoryMap { categoryKeys = append(categoryKeys, key); totalSpent += agg.total }
	sort.Slice(categoryKeys, func(i, j int) bool { return categoryMap[categoryKeys[i]].total > categoryMap[categoryKeys[j]].total })
	categoryResponses := make([]CategorySpendResponse, 0, len(categoryKeys))
	uncategorized := 0.0
	for _, key := range categoryKeys {
		agg := categoryMap[key]
		share := 0.0
		if totalSpent != 0 { share = round4(agg.total / totalSpent) }
		if key == "Uncategorized" { uncategorized = round2(agg.total) }
		categoryResponses = append(categoryResponses, CategorySpendResponse{Category: key, TotalSpent: round2(agg.total), Transactions: agg.count, ShareOfSpent: share})
	}
	type merchantAgg struct{ total float64; count int; category *string }
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
	for key := range merchantMap { merchantKeys = append(merchantKeys, key) }
	sort.Slice(merchantKeys, func(i, j int) bool { return merchantMap[merchantKeys[i]].total > merchantMap[merchantKeys[j]].total })
	topMerchants := []MerchantSpendResponse{}
	for i, key := range merchantKeys {
		if i >= 8 { break }
		agg := merchantMap[key]
		topMerchants = append(topMerchants, MerchantSpendResponse{MerchantKey: key, Category: agg.category, TotalSpent: round2(agg.total), Transactions: agg.count})
	}
	sort.Slice(expenses, func(i, j int) bool { return absFloat(expenses[i].Amount) > absFloat(expenses[j].Amount) })
	largestExpenses := []ReportTransactionResponse{}
	for i, transaction := range expenses {
		if i >= 12 { break }
		direction := "income"
		if transaction.Amount < 0 { direction = "expense" }
		largestExpenses = append(largestExpenses, ReportTransactionResponse{TransactionID: transaction.ID, BookingDate: transaction.BookingDate, ValueDate: transaction.ValueDate, Amount: transaction.Amount, Direction: direction, Description: transaction.RawDescription, MerchantKey: transaction.MerchantKey, Category: nullableStringPtrFromNull(transaction.Category), NeedsReview: transaction.NeedsReview})
	}
	totalIncome := 0.0
	for _, income := range incomes { totalIncome += income.Amount }
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
		for i, header := range headers { _ = file.SetCellValue(transactionsSheet, fmt.Sprintf("%c1", 'A'+i), header) }
		for i, transaction := range transactions {
			row := i + 2
			direction := "income"
			if transaction.Amount < 0 { direction = "expense" }
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
		if err != nil { return nil, "", "", err }
		return buffer.Bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fmt.Sprintf("spending-report-%s_to_%s.xlsx", report.From, report.To), nil
	}
	b := &strings.Builder{}
	b.WriteString("Year,Month,From,To,TotalTransactions,TotalSpent,TotalIncome,UncategorizedSpent\n")
	b.WriteString(fmt.Sprintf("%d,%d,%s,%s,%d,%.2f,%.2f,%.2f\n\n", report.Year, report.Month, report.From, report.To, report.TotalTransactions, report.TotalSpent, report.TotalIncome, report.UncategorizedSpent))
	b.WriteString("Category,TotalSpent,Transactions,ShareOfSpent\n")
	for _, category := range report.Categories { b.WriteString(fmt.Sprintf("%s,%.2f,%d,%.4f\n", escapeCsv(category.Category), category.TotalSpent, category.Transactions, category.ShareOfSpent)) }
	b.WriteString("\nBookingDate,ValueDate,Direction,Amount,Category,MerchantKey,NeedsReview,Description\n")
	for _, transaction := range transactions {
		direction := "income"
		if transaction.Amount < 0 { direction = "expense" }
		b.WriteString(fmt.Sprintf("%s,%s,%s,%.2f,%s,%s,%t,%s\n", transaction.BookingDate, transaction.ValueDate, direction, transaction.Amount, escapeCsv(derefString(nullableStringPtrFromNull(transaction.Category))), escapeCsv(transaction.MerchantKey), transaction.NeedsReview, escapeCsv(transaction.RawDescription)))
	}
	content := append([]byte{0xEF, 0xBB, 0xBF}, []byte(b.String())...)
	return content, "text/csv", fmt.Sprintf("spending-report-%s_to_%s.csv", report.From, report.To), nil
}

func fetchCycleAnchorDates(database *sql.DB) ([]string, error) {
	configured, err := fetchConfiguredCycleIncomeCategories(database)
	if err != nil { return nil, err }
	query := `SELECT DISTINCT BookingDate FROM Transactions WHERE Amount > 0 AND ExcludeFromCalculations = 0`
	args := []any{}
	if len(configured) > 0 {
		placeholders := make([]string, 0, len(configured))
		for _, category := range configured { placeholders = append(placeholders, "?"); args = append(args, category) }
		query += ` AND Category IN (` + strings.Join(placeholders, ",") + `)`
	}
	query += ` ORDER BY BookingDate`
	rows, err := database.Query(query, args...)
	if err != nil { return nil, err }
	defer rows.Close()
	anchors := []string{}
	for rows.Next() { var date string; if err := rows.Scan(&date); err != nil { return nil, err }; anchors = append(anchors, date) }
	return anchors, rows.Err()
}

func fetchConfiguredCycleIncomeCategories(database *sql.DB) ([]string, error) {
	rows, err := database.Query(`SELECT Category FROM CycleIncomeCategories ORDER BY Category`)
	if err != nil { return nil, err }
	defer rows.Close()
	result := []string{}
	for rows.Next() { var category string; if err := rows.Scan(&category); err != nil { return nil, err }; result = append(result, category) }
	return result, rows.Err()
}

func getIncomeAnchoredRange(database *sql.DB, year int, month int) (string, string, error) {
	calendarStart := fmt.Sprintf("%04d-%02d-01", year, month)
	calendarEnd := addMonthsMinusDay(calendarStart, 1)
	anchors, err := fetchCycleAnchorDates(database)
	if err != nil { return "", "", err }
	cycleStart := ""
	for _, anchor := range anchors {
		if anchor <= calendarEnd { cycleStart = anchor } else { break }
	}
	if cycleStart == "" { return calendarStart, calendarEnd, nil }
	cycleEnd := addMonthsMinusDay(cycleStart, 1)
	for _, anchor := range anchors {
		if anchor > cycleStart { cycleEnd = addDays(anchor, -1); break }
	}
	return cycleStart, cycleEnd, nil
}

func getCycleRange(database *sql.DB, cycleStart string) (string, string, bool, error) {
	anchors, err := fetchCycleAnchorDates(database)
	if err != nil { return "", "", false, err }
	found := false
	for _, anchor := range anchors { if anchor == cycleStart { found = true; break } }
	if !found { return "", "", false, nil }
	cycleEnd := addMonthsMinusDay(cycleStart, 1)
	for _, anchor := range anchors { if anchor > cycleStart { cycleEnd = addDays(anchor, -1); break } }
	return cycleStart, cycleEnd, true, nil
}

func parseRequiredDate(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" { return "", fmt.Errorf("missing") }
	_, err := time.Parse(dateLayout, value)
	return value, err
}

func parseWorkbookDate(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" { return "", fmt.Errorf("could not parse date value ''") }
	layouts := []string{dateLayout, "02/01/2006", "2/1/2006", time.RFC3339}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil { return parsed.Format(dateLayout), nil }
	}
	if numeric, err := strconv.ParseFloat(strings.ReplaceAll(value, ",", "."), 64); err == nil {
		base := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
		return base.AddDate(0, 0, int(numeric)).Format(dateLayout), nil
	}
	return "", fmt.Errorf("could not parse date value '%s'", value)
}

func parseAmount(value string) (float64, error) {
	value = strings.TrimSpace(value)
	if value == "" { return 0, nil }
	normalized := strings.ReplaceAll(value, ".", "")
	normalized = strings.ReplaceAll(normalized, ",", ".")
	amount, err := strconv.ParseFloat(normalized, 64)
	if err == nil { return amount, nil }
	amount, err = strconv.ParseFloat(value, 64)
	if err == nil { return amount, nil }
	return 0, fmt.Errorf("could not parse amount value '%s'", value)
}

func cellValue(row []string, index int) string {
	if index >= 0 && index < len(row) { return strings.TrimSpace(row[index]) }
	return ""
}

func normalizeForFingerprint(value string) string { return strings.ToUpper(collapseWhitespace(value)) }

func createFingerprint(accountNumber, bookingDate, valueDate string, amount float64, rawDescription string) string {
	return createFingerprintSHA256(accountNumber, bookingDate, valueDate, amount, rawDescription)
}

func calculateSimilarity(left, right string) float64 {
	if left == right { return 1 }
	leftSet := tokenizeSet(left)
	rightSet := tokenizeSet(right)
	if len(leftSet) == 0 || len(rightSet) == 0 { return 0 }
	overlap := 0
	unionMap := map[string]struct{}{}
	for token := range leftSet { unionMap[token] = struct{}{} }
	for token := range rightSet {
		if _, ok := leftSet[token]; ok { overlap++ }
		unionMap[token] = struct{}{}
	}
	jaccard := float64(overlap) / float64(len(unionMap))
	prefixBonus := 0.0
	if strings.HasPrefix(left, right) || strings.HasPrefix(right, left) { prefixBonus = 0.15 }
	if jaccard+prefixBonus > 0.99 { return 0.99 }
	return jaccard + prefixBonus
}

func tokenizeSet(value string) map[string]struct{} {
	set := map[string]struct{}{}
	for _, token := range strings.Fields(strings.TrimSpace(value)) { set[token] = struct{}{} }
	return set
}

func addMonthsMinusDay(from string, months int) string {
	parsed, _ := time.Parse(dateLayout, from)
	return parsed.AddDate(0, months, -1).Format(dateLayout)
}

func addDays(from string, days int) string {
	parsed, _ := time.Parse(dateLayout, from)
	return parsed.AddDate(0, 0, days).Format(dateLayout)
}

func absFloat(value float64) float64 {
	if value < 0 { return -value }
	return value
}

func escapeCsv(value string) string {
	normalized := strings.ReplaceAll(strings.ReplaceAll(value, "\r", " "), "\n", " ")
	if strings.Contains(normalized, ",") || strings.Contains(normalized, `"`) {
		return `"` + strings.ReplaceAll(normalized, `"`, `""`) + `"`
	}
	return normalized
}
