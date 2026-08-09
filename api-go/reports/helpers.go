package reports

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

func parseOptionalDate(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse(dateLayout, value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func parseOptionalBool(value string) (bool, bool, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return false, false, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, false, err
	}
	return parsed, true, nil
}

func collapseWhitespace(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func extractMerchantKey(raw string) string {
	merchant := strings.ToUpper(collapseWhitespace(raw))
	prefixes := []string{"PAGAMENTO POS", "DOMICILIAZIONE (ADDEBITO DIRETTO SEPA)", "DOMICILIAZIONE", "BONIFICO SEPA", "BONIFICO", "GIROCONTO", "PRELIEVO ATM", "PAGAMENTO", "ADDEBITO CARTA"}
	for _, prefix := range prefixes {
		if strings.HasPrefix(merchant, prefix) {
			merchant = strings.TrimSpace(strings.TrimPrefix(merchant, prefix))
			break
		}
	}
	merchant = sumUpRegex.ReplaceAllString(merchant, "")
	merchant = payPalRegex.ReplaceAllString(merchant, "$1")
	merchant = amazonMktpRegex.ReplaceAllString(merchant, "AMAZON")
	merchant = amazonItRegex.ReplaceAllString(merchant, "AMAZON")
	merchant = daznRegex.ReplaceAllString(merchant, "DAZN")
	merchant = instantTransferReferenceRegex.ReplaceAllString(merchant, " ")
	merchant = sepaReferenceRegex.ReplaceAllString(merchant, "")
	merchant = cardOperationRegex.ReplaceAllString(merchant, "")
	merchant = operationSuffixRegex.ReplaceAllString(merchant, "")
	merchant = trailingLocationRegex.ReplaceAllString(merchant, "")
	merchant = terminalCodeRegex.ReplaceAllString(merchant, "")
	replacer := strings.NewReplacer("'", " ", ".", " ", ",", " ", "/", " ", "*", " ")
	merchant = collapseWhitespace(replacer.Replace(merchant))
	if strings.Contains(merchant, "AMZN MKTP IT") || strings.Contains(merchant, "AMAZON.IT") {
		merchant = "AMAZON"
	}
	return strings.Trim(merchant, "- :")
}

func defaultRuleBehavior(merchantKey string) string {
	if _, ok := alwaysReviewMerchants[strings.ToUpper(strings.TrimSpace(merchantKey))]; ok {
		return merchantRuleBehaviorAlwaysReview
	}
	return merchantRuleBehaviorAutoApply
}

func normalizeBehavior(value string) string {
	trimmed := strings.TrimSpace(value)
	switch strings.ToLower(trimmed) {
	case strings.ToLower(merchantRuleBehaviorAutoApply):
		return merchantRuleBehaviorAutoApply
	case strings.ToLower(merchantRuleBehaviorAlwaysReview):
		return merchantRuleBehaviorAlwaysReview
	default:
		return ""
	}
}

func normalizeCategoryNames(values []string) []string {
	seen := map[string]struct{}{}
	result := []string{}
	for _, value := range values {
		normalized := collapseWhitespace(value)
		if normalized == "" {
			continue
		}
		key := strings.ToLower(normalized)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, normalized)
	}
	sort.Slice(result, func(i, j int) bool { return strings.ToLower(result[i]) < strings.ToLower(result[j]) })
	return result
}

func nullableStringPtr(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func nullableStringPtrFromNull(value sql.NullString) *string {
	if !value.Valid || strings.TrimSpace(value.String) == "" {
		return nil
	}
	trimmed := value.String
	return &trimmed
}

func nullableFloatPtrFromNull(value sql.NullFloat64) *float64 {
	if !value.Valid {
		return nil
	}
	v := value.Float64
	return &v
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func round2(value float64) float64 {
	parsed, _ := strconv.ParseFloat(fmt.Sprintf("%.2f", value), 64)
	return parsed
}

func round4(value float64) float64 {
	parsed, _ := strconv.ParseFloat(fmt.Sprintf("%.4f", value), 64)
	return parsed
}

func datePtrString(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.Format(dateLayout)
	return &formatted
}

func newUUID() string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return strconv.FormatInt(time.Now().UTC().UnixNano(), 10)
	}
	buffer[6] = (buffer[6] & 0x0f) | 0x40
	buffer[8] = (buffer[8] & 0x3f) | 0x80
	hexValue := hex.EncodeToString(buffer)
	return fmt.Sprintf("%s-%s-%s-%s-%s", hexValue[0:8], hexValue[8:12], hexValue[12:16], hexValue[16:20], hexValue[20:32])
}

func createFingerprintSHA256(accountNumber, bookingDate, valueDate string, amount float64, rawDescription string) string {
	payload := strings.Join([]string{
		strings.TrimSpace(accountNumber),
		bookingDate,
		valueDate,
		fmt.Sprintf("%.2f", amount),
		normalizeForFingerprint(rawDescription),
	}, "|")
	sum := sha256.Sum256([]byte(payload))
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

func parseRequiredDate(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("missing")
	}
	_, err := time.Parse(dateLayout, value)
	return value, err
}

func parseWorkbookDate(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("could not parse date value ''")
	}
	layouts := []string{dateLayout, "02/01/2006", "2/1/2006", time.RFC3339}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.Format(dateLayout), nil
		}
	}
	if numeric, err := strconv.ParseFloat(strings.ReplaceAll(value, ",", "."), 64); err == nil {
		base := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
		return base.AddDate(0, 0, int(numeric)).Format(dateLayout), nil
	}
	return "", fmt.Errorf("could not parse date value '%s'", value)
}

func parseAmount(value string) (float64, error) {
	if value == "" {
		return 0, nil
	}
	// Trim common whitespace (including NBSP) and surrounding
	value = strings.TrimSpace(strings.ReplaceAll(value, "\u00A0", ""))
	if value == "" {
		return 0, nil
	}

	// Quick try: plain parse
	if amount, err := strconv.ParseFloat(value, 64); err == nil {
		return amount, nil
	}

	// Detect and handle parentheses (e.g. (1.000,00)) and trailing minus (e.g. 1.000,00-)
	negative := false
	if strings.HasPrefix(value, "(") && strings.HasSuffix(value, ")") {
		negative = true
		value = strings.TrimSpace(value[1 : len(value)-1])
	}
	if strings.HasSuffix(value, "-") {
		negative = true
		value = strings.TrimSpace(value[:len(value)-1])
	}
	value = strings.TrimPrefix(value, "+")

	// Strip any non-digit, non-separator characters (currency symbols, letters)
	var b strings.Builder
	for _, r := range value {
		if (r >= '0' && r <= '9') || r == '.' || r == ',' || r == '-' || r == '+' {
			b.WriteRune(r)
		}
	}
	cleaned := b.String()
	if cleaned == "" {
		return 0, fmt.Errorf("could not parse amount value '%s'", value)
	}

	// Decide which separator is the decimal separator using digit-count heuristics.
	lastDot := strings.LastIndex(cleaned, ".")
	lastComma := strings.LastIndex(cleaned, ",")
	afterDot := -1
	afterComma := -1
	if lastDot >= 0 {
		afterDot = len(cleaned) - lastDot - 1
	}
	if lastComma >= 0 {
		afterComma = len(cleaned) - lastComma - 1
	}

	var normalized string
	if lastDot >= 0 && lastComma >= 0 {
		// both present: prefer the separator that looks like a decimal (2 digits after)
		if afterComma == 2 && afterDot != 2 {
			// comma decimal
			normalized = strings.ReplaceAll(cleaned, ".", "")
			normalized = strings.ReplaceAll(normalized, ",", ".")
		} else if afterDot == 2 && afterComma != 2 {
			// dot decimal
			normalized = strings.ReplaceAll(cleaned, ",", "")
		} else {
			// fallback to last-separator heuristic
			if lastComma > lastDot {
				normalized = strings.ReplaceAll(cleaned, ".", "")
				normalized = strings.ReplaceAll(normalized, ",", ".")
			} else {
				normalized = strings.ReplaceAll(cleaned, ",", "")
			}
		}
	} else if lastComma >= 0 {
		// only comma present
		if afterComma == 2 {
			// comma is decimal
			normalized = strings.ReplaceAll(cleaned, ".", "")
			normalized = strings.ReplaceAll(normalized, ",", ".")
		} else {
			// comma is thousands separator
			normalized = strings.ReplaceAll(cleaned, ",", "")
		}
	} else if lastDot >= 0 {
		// only dot present
		if afterDot == 2 {
			// dot is decimal
			normalized = strings.ReplaceAll(cleaned, ",", "")
		} else {
			// dot is thousands separator
			normalized = strings.ReplaceAll(cleaned, ".", "")
		}
	} else {
		normalized = cleaned
	}

	amount, err := strconv.ParseFloat(normalized, 64)
	if err != nil {
		return 0, fmt.Errorf("could not parse amount value '%s'", value)
	}
	if negative {
		amount = -amount
	}
	return amount, nil
}

func cellValue(row []string, index int) string {
	if index >= 0 && index < len(row) {
		return strings.TrimSpace(row[index])
	}
	return ""
}

func normalizeForFingerprint(value string) string { return strings.ToUpper(collapseWhitespace(value)) }

func createFingerprint(accountNumber, bookingDate, valueDate string, amount float64, rawDescription string) string {
	return createFingerprintSHA256(accountNumber, bookingDate, valueDate, amount, rawDescription)
}

func calculateSimilarity(left, right string) float64 {
	if left == right {
		return 1
	}
	leftSet := tokenizeSet(left)
	rightSet := tokenizeSet(right)
	if len(leftSet) == 0 || len(rightSet) == 0 {
		return 0
	}
	overlap := 0
	unionMap := map[string]struct{}{}
	for token := range leftSet {
		unionMap[token] = struct{}{}
	}
	for token := range rightSet {
		if _, ok := leftSet[token]; ok {
			overlap++
		}
		unionMap[token] = struct{}{}
	}
	jaccard := float64(overlap) / float64(len(unionMap))
	prefixBonus := 0.0
	if strings.HasPrefix(left, right) || strings.HasPrefix(right, left) {
		prefixBonus = 0.15
	}
	if jaccard+prefixBonus > 0.99 {
		return 0.99
	}
	return jaccard + prefixBonus
}

func tokenizeSet(value string) map[string]struct{} {
	set := map[string]struct{}{}
	for _, token := range strings.Fields(strings.TrimSpace(value)) {
		set[token] = struct{}{}
	}
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
	if value < 0 {
		return -value
	}
	return value
}

func escapeCsv(value string) string {
	normalized := strings.ReplaceAll(strings.ReplaceAll(value, "\r", " "), "\n", " ")
	if strings.Contains(normalized, ",") || strings.Contains(normalized, `"`) {
		return `"` + strings.ReplaceAll(normalized, `"`, `""`) + `"`
	}
	return normalized
}

// --- sql helper functions used by handlers/reports ---

func scanTransactionRow(rows *sql.Rows) (transactionRow, error) {
	var tr transactionRow
	var cat sql.NullString
	var sugcat sql.NullString
	var sugconf sql.NullFloat64
	var needsReviewInt int
	var excludeInt int
	var isMonthlyInt int
	if err := rows.Scan(&tr.ID, &tr.AccountNumber, &tr.BookingDate, &tr.ValueDate, &tr.Amount, &tr.RawDescription, &tr.MerchantKey, &cat, &sugcat, &sugconf, &needsReviewInt, &excludeInt, &tr.ImportedAtUtc, &isMonthlyInt); err != nil {
		return transactionRow{}, err
	}
	tr.Category = cat
	tr.SuggestedCategory = sugcat
	tr.SuggestionConfidence = sugconf
	tr.NeedsReview = needsReviewInt != 0
	tr.ExcludeFromCalculations = excludeInt != 0
	tr.IsMonthlyRecurring = isMonthlyInt != 0
	return tr, nil
}

func fetchTransactionRow(database *sql.DB, transactionID string) (transactionRow, error) {
	row := database.QueryRow(`SELECT Id, AccountNumber, BookingDate, ValueDate, Amount, RawDescription, MerchantKey, Category, SuggestedCategory, SuggestionConfidence, NeedsReview, ExcludeFromCalculations, ImportedAtUtc, IsMonthlyRecurring FROM Transactions WHERE Id = ?;`, transactionID)
	var tr transactionRow
	var cat sql.NullString
	var sugcat sql.NullString
	var sugconf sql.NullFloat64
	var needsReviewInt int
	var excludeInt int
	var isMonthlyInt int
	if err := row.Scan(&tr.ID, &tr.AccountNumber, &tr.BookingDate, &tr.ValueDate, &tr.Amount, &tr.RawDescription, &tr.MerchantKey, &cat, &sugcat, &sugconf, &needsReviewInt, &excludeInt, &tr.ImportedAtUtc, &isMonthlyInt); err != nil {
		return transactionRow{}, err
	}
	tr.Category = cat
	tr.SuggestedCategory = sugcat
	tr.SuggestionConfidence = sugconf
	tr.NeedsReview = needsReviewInt != 0
	tr.ExcludeFromCalculations = excludeInt != 0
	tr.IsMonthlyRecurring = isMonthlyInt != 0
	return tr, nil
}

func fetchTransactionRowTx(tx *sql.Tx, transactionID string) (transactionRow, error) {
	row := tx.QueryRow(`SELECT Id, AccountNumber, BookingDate, ValueDate, Amount, RawDescription, MerchantKey, Category, SuggestedCategory, SuggestionConfidence, NeedsReview, ExcludeFromCalculations, ImportedAtUtc, IsMonthlyRecurring FROM Transactions WHERE Id = ?;`, transactionID)
	var tr transactionRow
	var cat sql.NullString
	var sugcat sql.NullString
	var sugconf sql.NullFloat64
	var needsReviewInt int
	var excludeInt int
	var isMonthlyInt int
	if err := row.Scan(&tr.ID, &tr.AccountNumber, &tr.BookingDate, &tr.ValueDate, &tr.Amount, &tr.RawDescription, &tr.MerchantKey, &cat, &sugcat, &sugconf, &needsReviewInt, &excludeInt, &tr.ImportedAtUtc, &isMonthlyInt); err != nil {
		return transactionRow{}, err
	}
	tr.Category = cat
	tr.SuggestedCategory = sugcat
	tr.SuggestionConfidence = sugconf
	tr.NeedsReview = needsReviewInt != 0
	tr.ExcludeFromCalculations = excludeInt != 0
	tr.IsMonthlyRecurring = isMonthlyInt != 0
	return tr, nil
}

func fetchCategories(database *sql.DB) ([]CategoryResponse, error) {
	rows, err := database.Query(`SELECT Category, COUNT(1) FROM Transactions WHERE Category IS NOT NULL AND TRIM(Category) <> '' GROUP BY Category ORDER BY Category`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []CategoryResponse{}
	for rows.Next() {
		var name string
		var txCount int
		if err := rows.Scan(&name, &txCount); err != nil {
			return nil, err
		}
		var rulesCount int
		if err := database.QueryRow(`SELECT COUNT(1) FROM CategoryRules WHERE TRIM(Category) = ?`, name).Scan(&rulesCount); err != nil {
			return nil, err
		}
		result = append(result, CategoryResponse{Name: name, Rules: rulesCount, Transactions: txCount})
	}
	return result, rows.Err()
}

func fetchCycleIncomeCategories(database *sql.DB) (CycleIncomeCategoriesResponse, error) {
	configured, err := fetchConfiguredCycleIncomeCategories(database)
	if err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	anchors, err := fetchCycleAnchorDates(database)
	if err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	resp := CycleIncomeCategoriesResponse{UsesAllIncomeTransactions: len(configured) == 0, Categories: []CycleIncomeCategoryOptionResponse{}}
	for _, cat := range configured {
		var count int
		if err := database.QueryRow(`SELECT COUNT(1) FROM Transactions WHERE Amount > 0 AND ExcludeFromCalculations = 0 AND Category = ?`, cat).Scan(&count); err != nil {
			return CycleIncomeCategoriesResponse{}, err
		}
		defines := false
		if count > 0 && len(anchors) > 0 {
			defines = true
		}
		resp.Categories = append(resp.Categories, CycleIncomeCategoryOptionResponse{Name: cat, IncomeTransactions: count, DefinesCycle: defines})
	}
	return resp, nil
}

func saveCycleIncomeCategories(database *sql.DB, categories []string) (CycleIncomeCategoriesResponse, error) {
	tx, err := database.Begin()
	if err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM CycleIncomeCategories`); err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	for _, c := range categories {
		if _, err := tx.Exec(`INSERT INTO CycleIncomeCategories (Category) VALUES (?)`, c); err != nil {
			return CycleIncomeCategoriesResponse{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	return fetchCycleIncomeCategories(database)
}

func fetchRuleBehaviorLookup(database *sql.DB) (map[string]string, error) {
	rows, err := database.Query(`SELECT MerchantKey, Behavior FROM CategoryRules`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lookup := map[string]string{}
	for rows.Next() {
		var merchant, behavior string
		if err := rows.Scan(&merchant, &behavior); err != nil {
			return nil, err
		}
		lookup[merchant] = normalizeBehavior(behavior)
	}
	return lookup, rows.Err()
}

func resolveMerchantRuleBehavior(merchantKey string, lookup map[string]string) string {
	if b, ok := lookup[merchantKey]; ok && b != "" {
		return b
	}
	return defaultRuleBehavior(merchantKey)
}

func getMerchantRuleBehaviorTx(tx *sql.Tx, merchantKey string) (string, error) {
	var behavior string
	err := tx.QueryRow(`SELECT Behavior FROM CategoryRules WHERE MerchantKey = ? LIMIT 1`, merchantKey).Scan(&behavior)
	if err == sql.ErrNoRows {
		return defaultRuleBehavior(merchantKey), nil
	}
	if err != nil {
		return "", err
	}
	return normalizeBehavior(behavior), nil
}
