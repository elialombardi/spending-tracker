package reports

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

const (
	dateLayout                       = "2006-01-02"
	merchantRuleBehaviorAutoApply    = "AutoApply"
	merchantRuleBehaviorAlwaysReview = "AlwaysReview"
)

var alwaysReviewMerchants = map[string]struct{}{
	"AMAZON": {},
}

var (
	sumUpRegex                    = regexp.MustCompile(`^SUMUP\s+\*?`)
	payPalRegex                   = regexp.MustCompile(`^PAYPAL\s+\*(.+)$`)
	amazonMktpRegex               = regexp.MustCompile(`\bAMZN MKTP IT\*[A-Z0-9]+\b`)
	amazonItRegex                 = regexp.MustCompile(`\bAMAZON\.IT\*[A-Z0-9]+\b`)
	daznRegex                     = regexp.MustCompile(`\bWWW\.DAZN\.COM\b`)
	instantTransferReferenceRegex = regexp.MustCompile(`\bTRN\s+[A-Z0-9]+\s+BENEF\.?\s+`)
	sepaReferenceRegex            = regexp.MustCompile(`\s+CID\.[A-Z0-9\.]+\s+MAN\.[A-Z0-9]+.*`)
	cardOperationRegex            = regexp.MustCompile(`\s+\d{2}/\d{2}/\d{4}\s+\d{2}\.\d{2}\s+[A-Z ]+\s+OP\.\d+\s+CARTA\s+\*+\d+$`)
	operationSuffixRegex          = regexp.MustCompile(`\s+OP\.\d+.*`)
	trailingLocationRegex         = regexp.MustCompile(`\s+\d{2}/\d{2}/\d{4}\s+\d{2}\.\d{2}.*$`)
	terminalCodeRegex             = regexp.MustCompile(`\s+[A-Z0-9]{8,}$`)
)

func listTransactions(c *fiber.Ctx) error {
	from, err := parseOptionalDate(c.Query("from"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Invalid from date. Expected yyyy-MM-dd.")
	}
	to, err := parseOptionalDate(c.Query("to"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Invalid to date. Expected yyyy-MM-dd.")
	}
	direction := strings.TrimSpace(c.Query("direction"))
	if direction != "" && !strings.EqualFold(direction, "income") && !strings.EqualFold(direction, "expense") {
		return c.Status(fiber.StatusBadRequest).SendString("Direction must be either 'income' or 'expense'.")
	}
	needsReview, hasNeedsReview, err := parseOptionalBool(c.Query("needsReview"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("needsReview must be true or false.")
	}
	category := strings.TrimSpace(c.Query("category"))

	transactions, err := fetchTransactions(database, from, to, direction, category, hasNeedsReview, needsReview)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(transactions)
}

func categorizeTransaction(c *fiber.Ctx) error {
	transactionID := strings.TrimSpace(c.Params("transactionId"))
	if transactionID == "" {
		return fiber.ErrBadRequest
	}

	var request CategorizeTransactionRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.ErrBadRequest
	}
	category := collapseWhitespace(request.Category)
	if category == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Category is required.")
	}

	response, found, err := applyCategorization(database, transactionID, request, category)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !found {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(response)
}

func listCategories(c *fiber.Ctx) error {
	responses, err := fetchCategories(database)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(responses)
}

func getCycleIncomeCategories(c *fiber.Ctx) error {
	response, err := fetchCycleIncomeCategories(database)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(response)
}

func updateCycleIncomeCategories(c *fiber.Ctx) error {
	var request UpdateCycleIncomeCategoriesRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.ErrBadRequest
	}

	response, err := saveCycleIncomeCategories(database, request.Categories)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(response)
}

func updateCategoryMapping(c *fiber.Ctx) error {
	mappingID := strings.TrimSpace(c.Params("mappingId"))
	var request UpdateCategoryMappingRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.ErrBadRequest
	}
	behavior := normalizeBehavior(request.Behavior)
	if behavior == "" {
		behavior = merchantRuleBehaviorAutoApply
	}
	if behavior == merchantRuleBehaviorAutoApply && collapseWhitespace(derefString(request.Category)) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Category is required for auto-apply mappings.")
	}

	response, found, err := saveCategoryMapping(database, mappingID, behavior, collapseWhitespace(derefString(request.Category)))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !found {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(response)
}

func deleteCategoryMapping(c *fiber.Ctx) error {
	deleted, err := removeCategoryMapping(database, strings.TrimSpace(c.Params("mappingId")))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func fetchTransactions(database *sql.DB, from, to *time.Time, direction, category string, hasNeedsReview bool, needsReview bool) ([]TransactionResponse, error) {
	query := `SELECT Id, AccountNumber, BookingDate, ValueDate, Amount, RawDescription, MerchantKey, Category, SuggestedCategory, SuggestionConfidence, NeedsReview, ExcludeFromCalculations, ImportedAtUtc, IsMonthlyRecurring FROM Transactions WHERE 1=1`
	args := []any{}
	if from != nil {
		query += ` AND BookingDate >= ?`
		args = append(args, from.Format(dateLayout))
	}
	if to != nil {
		query += ` AND BookingDate <= ?`
		args = append(args, to.Format(dateLayout))
	}
	if direction != "" {
		if strings.EqualFold(direction, "income") {
			query += ` AND Amount > 0`
		} else {
			query += ` AND Amount < 0`
		}
	}
	if hasNeedsReview {
		query += ` AND NeedsReview = ?`
		args = append(args, boolToInt(needsReview))
	}
	if category != "" {
		if strings.EqualFold(category, "uncategorized") {
			query += ` AND (Category IS NULL OR TRIM(Category) = '')`
		} else {
			query += ` AND Category = ?`
			args = append(args, category)
		}
	}
	query += ` ORDER BY BookingDate DESC, ImportedAtUtc DESC`

	rows, err := database.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	behaviors, err := fetchRuleBehaviorLookup(database)
	if err != nil {
		return nil, err
	}

	transactions := []TransactionResponse{}
	for rows.Next() {
		row, err := scanTransactionRow(rows)
		if err != nil {
			return nil, err
		}
		transactions = append(transactions, mapTransaction(row, resolveMerchantRuleBehavior(row.MerchantKey, behaviors)))
	}
	return transactions, rows.Err()
}

func fetchTransactionsSummary(database *sql.DB, from, to *time.Time) (SpendingSummaryResponse, error) {
	query := `SELECT Category, ABS(Amount) FROM Transactions WHERE Amount < 0 AND ExcludeFromCalculations = 0`
	args := []any{}
	if from != nil {
		query += ` AND BookingDate >= ?`
		args = append(args, from.Format(dateLayout))
	}
	if to != nil {
		query += ` AND BookingDate <= ?`
		args = append(args, to.Format(dateLayout))
	}

	rows, err := database.Query(query, args...)
	if err != nil {
		return SpendingSummaryResponse{}, err
	}
	defer rows.Close()

	type aggregate struct {
		total float64
		count int
	}
	grouped := map[string]aggregate{}
	for rows.Next() {
		var category sql.NullString
		var amount float64
		if err := rows.Scan(&category, &amount); err != nil {
			return SpendingSummaryResponse{}, err
		}
		key := "Uncategorized"
		if category.Valid && strings.TrimSpace(category.String) != "" {
			key = category.String
		}
		agg := grouped[key]
		agg.total += amount
		agg.count++
		grouped[key] = agg
	}
	if err := rows.Err(); err != nil {
		return SpendingSummaryResponse{}, err
	}

	keys := make([]string, 0, len(grouped))
	totalSpent := 0.0
	uncategorizedSpent := 0.0
	for key, agg := range grouped {
		keys = append(keys, key)
		totalSpent += agg.total
		if key == "Uncategorized" {
			uncategorizedSpent += agg.total
		}
	}
	sort.Slice(keys, func(i, j int) bool { return grouped[keys[i]].total > grouped[keys[j]].total })

	responses := make([]CategorySpendResponse, 0, len(keys))
	for _, key := range keys {
		agg := grouped[key]
		share := 0.0
		if totalSpent != 0 {
			share = round4(agg.total / totalSpent)
		}
		responses = append(responses, CategorySpendResponse{Category: key, TotalSpent: round2(agg.total), Transactions: agg.count, ShareOfSpent: share})
	}

	return SpendingSummaryResponse{From: datePtrString(from), To: datePtrString(to), TotalSpent: round2(totalSpent), UncategorizedSpent: round2(uncategorizedSpent), Categories: responses}, nil
}

func fetchCategories(database *sql.DB) ([]CategoryResponse, error) {
	ruleRows, err := database.Query(`SELECT Category, COUNT(1) FROM CategoryRules WHERE Behavior = ? AND TRIM(Category) <> '' GROUP BY Category`, merchantRuleBehaviorAutoApply)
	if err != nil {
		return nil, err
	}
	defer ruleRows.Close()

	ruleCounts := map[string]int{}
	for ruleRows.Next() {
		var category string
		var count int
		if err := ruleRows.Scan(&category, &count); err != nil {
			return nil, err
		}
		ruleCounts[category] = count
	}

	transactionRows, err := database.Query(`SELECT Category, COUNT(1) FROM Transactions WHERE ExcludeFromCalculations = 0 AND Category IS NOT NULL AND TRIM(Category) <> '' GROUP BY Category`)
	if err != nil {
		return nil, err
	}
	defer transactionRows.Close()

	transactionCounts := map[string]int{}
	for transactionRows.Next() {
		var category string
		var count int
		if err := transactionRows.Scan(&category, &count); err != nil {
			return nil, err
		}
		transactionCounts[category] = count
	}

	all := map[string]struct{}{}
	for key := range ruleCounts {
		all[key] = struct{}{}
	}
	for key := range transactionCounts {
		all[key] = struct{}{}
	}
	keys := make([]string, 0, len(all))
	for key := range all {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return strings.ToLower(keys[i]) < strings.ToLower(keys[j]) })

	responses := make([]CategoryResponse, 0, len(keys))
	for _, key := range keys {
		responses = append(responses, CategoryResponse{Name: key, Rules: ruleCounts[key], Transactions: transactionCounts[key]})
	}
	return responses, nil
}

func fetchCycleIncomeCategories(database *sql.DB) (CycleIncomeCategoriesResponse, error) {
	configuredRows, err := database.Query(`SELECT Category FROM CycleIncomeCategories ORDER BY Category`)
	if err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	defer configuredRows.Close()

	configured := map[string]struct{}{}
	for configuredRows.Next() {
		var category string
		if err := configuredRows.Scan(&category); err != nil {
			return CycleIncomeCategoriesResponse{}, err
		}
		configured[category] = struct{}{}
	}

	incomeRows, err := database.Query(`SELECT Category, COUNT(1) FROM Transactions WHERE Amount > 0 AND ExcludeFromCalculations = 0 AND Category IS NOT NULL AND TRIM(Category) <> '' GROUP BY Category`)
	if err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	defer incomeRows.Close()

	counts := map[string]int{}
	for incomeRows.Next() {
		var category string
		var count int
		if err := incomeRows.Scan(&category, &count); err != nil {
			return CycleIncomeCategoriesResponse{}, err
		}
		counts[category] = count
	}

	all := map[string]struct{}{}
	for key := range configured {
		all[key] = struct{}{}
	}
	for key := range counts {
		all[key] = struct{}{}
	}
	keys := make([]string, 0, len(all))
	for key := range all {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return strings.ToLower(keys[i]) < strings.ToLower(keys[j]) })

	response := CycleIncomeCategoriesResponse{UsesAllIncomeTransactions: len(configured) == 0, Categories: make([]CycleIncomeCategoryOptionResponse, 0, len(keys))}
	for _, key := range keys {
		_, defines := configured[key]
		response.Categories = append(response.Categories, CycleIncomeCategoryOptionResponse{Name: key, IncomeTransactions: counts[key], DefinesCycle: defines})
	}
	return response, nil
}

func saveCycleIncomeCategories(database *sql.DB, categories []string) (CycleIncomeCategoriesResponse, error) {
	normalized := normalizeCategoryNames(categories)
	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := database.Begin()
	if err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM CycleIncomeCategories;`); err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	for _, category := range normalized {
		if _, err := tx.Exec(`INSERT INTO CycleIncomeCategories (Id, Category, CreatedAtUtc, UpdatedAtUtc) VALUES (?, ?, ?, ?);`, newUUID(), category, now, now); err != nil {
			return CycleIncomeCategoriesResponse{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	return fetchCycleIncomeCategories(database)
}

func fetchCategoryMappings(database *sql.DB) ([]CategoryMappingResponse, error) {
	ruleRows, err := database.Query(`SELECT Id, MerchantKey, Category, Behavior, AppliedCount FROM CategoryRules ORDER BY MerchantKey`)
	if err != nil {
		return nil, err
	}
	defer ruleRows.Close()

	responses := []CategoryMappingResponse{}
	for ruleRows.Next() {
		var id, merchantKey, category, behavior string
		var appliedCount int
		if err := ruleRows.Scan(&id, &merchantKey, &category, &behavior, &appliedCount); err != nil {
			return nil, err
		}
		matchingTransactions, err := countMatchingTransactions(database, merchantKey)
		if err != nil {
			return nil, err
		}
		responses = append(responses, CategoryMappingResponse{MappingID: id, MerchantKey: merchantKey, Category: nullableStringPtr(category), Behavior: normalizeBehavior(behavior), AppliedCount: appliedCount, MatchingTransactions: matchingTransactions})
	}
	return responses, ruleRows.Err()
}

func saveCategoryMapping(database *sql.DB, mappingID, behavior, category string) (CategoryMappingResponse, bool, error) {
	tx, err := database.Begin()
	if err != nil {
		return CategoryMappingResponse{}, false, err
	}
	defer tx.Rollback()

	var merchantKey string
	var appliedCount int
	if err := tx.QueryRow(`SELECT MerchantKey, AppliedCount FROM CategoryRules WHERE Id = ?;`, mappingID).Scan(&merchantKey, &appliedCount); err != nil {
		if err == sql.ErrNoRows {
			return CategoryMappingResponse{}, false, nil
		}
		return CategoryMappingResponse{}, false, err
	}

	storedCategory := ""
	if behavior == merchantRuleBehaviorAutoApply {
		storedCategory = category
		count, err := applyCategoryToMerchantTransactionsTx(tx, merchantKey, category)
		if err != nil {
			return CategoryMappingResponse{}, false, err
		}
		if count > appliedCount {
			appliedCount = count
		}
	}

	if _, err := tx.Exec(`UPDATE CategoryRules SET Category = ?, Behavior = ?, AppliedCount = ?, UpdatedAtUtc = ? WHERE Id = ?;`, storedCategory, behavior, appliedCount, time.Now().UTC().Format(time.RFC3339), mappingID); err != nil {
		return CategoryMappingResponse{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return CategoryMappingResponse{}, false, err
	}

	matchingTransactions, err := countMatchingTransactions(database, merchantKey)
	if err != nil {
		return CategoryMappingResponse{}, false, err
	}
	return CategoryMappingResponse{MappingID: mappingID, MerchantKey: merchantKey, Category: nullableStringPtr(storedCategory), Behavior: behavior, AppliedCount: appliedCount, MatchingTransactions: matchingTransactions}, true, nil
}

func removeCategoryMapping(database *sql.DB, mappingID string) (bool, error) {
	result, err := database.Exec(`DELETE FROM CategoryRules WHERE Id = ?;`, mappingID)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func applyCategorization(database *sql.DB, transactionID string, request CategorizeTransactionRequest, category string) (TransactionResponse, bool, error) {
	tx, err := database.Begin()
	if err != nil {
		return TransactionResponse{}, false, err
	}
	defer tx.Rollback()

	row, err := fetchTransactionRowTx(tx, transactionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TransactionResponse{}, false, nil
		}
		return TransactionResponse{}, false, err
	}

	merchantKey := row.MerchantKey
	if request.MerchantKey != nil && strings.TrimSpace(*request.MerchantKey) != "" {
		merchantKey = extractMerchantKey(*request.MerchantKey)
	}
	behavior := defaultRuleBehavior(merchantKey)
	if request.RuleBehavior != nil && normalizeBehavior(*request.RuleBehavior) != "" {
		behavior = normalizeBehavior(*request.RuleBehavior)
	}

	if _, err := tx.Exec(`UPDATE Transactions SET Category = ?, MerchantKey = ?, NeedsReview = 0, SuggestedCategory = NULL, SuggestionConfidence = NULL, ExcludeFromCalculations = ?, IsMonthlyRecurring = ? WHERE Id = ?;`, category, merchantKey, boolToInt(request.ExcludeFromCalculations), boolToInt(request.IsMonthlyRecurring), transactionID); err != nil {
		return TransactionResponse{}, false, err
	}

	finalBehavior := behavior
	if request.SaveRule {
		if err := upsertCategoryRuleTx(tx, merchantKey, category, behavior); err != nil {
			return TransactionResponse{}, false, err
		}
		if behavior == merchantRuleBehaviorAutoApply {
			if _, err := tx.Exec(`UPDATE Transactions SET Category = ?, MerchantKey = ?, NeedsReview = 0, SuggestedCategory = NULL, SuggestionConfidence = NULL WHERE MerchantKey = ?;`, category, merchantKey, merchantKey); err != nil {
				return TransactionResponse{}, false, err
			}
		}
	} else {
		ruleBehavior, err := getMerchantRuleBehaviorTx(tx, merchantKey)
		if err != nil {
			return TransactionResponse{}, false, err
		}
		finalBehavior = ruleBehavior
	}

	if err := tx.Commit(); err != nil {
		return TransactionResponse{}, false, err
	}

	updatedRow, err := fetchTransactionRow(database, transactionID)
	if err != nil {
		return TransactionResponse{}, false, err
	}
	return mapTransaction(updatedRow, finalBehavior), true, nil
}

type UpdateAmountRequest struct {
	Amount float64 `json:"amount"`
}

func updateTransactionAmount(c *fiber.Ctx) error {
	transactionID := strings.TrimSpace(c.Params("transactionId"))
	if transactionID == "" {
		return fiber.ErrBadRequest
	}

	var req UpdateAmountRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}

	tx, err := database.Begin()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback()

	_, err = fetchTransactionRowTx(tx, transactionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	amount := req.Amount
	debit := 0.0
	credit := 0.0
	if amount < 0 {
		debit = -amount
	} else {
		credit = amount
	}

	if _, err := tx.Exec(`UPDATE Transactions SET Amount = ?, DebitAmount = ?, CreditAmount = ? WHERE Id = ?;`, amount, debit, credit, transactionID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	// Read the updated row within the tx to determine merchant behavior
	updatedRowTx, err := fetchTransactionRowTx(tx, transactionID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	behavior, err := getMerchantRuleBehaviorTx(tx, updatedRowTx.MerchantKey)
	if err != nil {
		behavior = defaultRuleBehavior(updatedRowTx.MerchantKey)
	}

	if err := tx.Commit(); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	updatedRow, err := fetchTransactionRow(database, transactionID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	return c.JSON(mapTransaction(updatedRow, behavior))
}

func fetchRuleBehaviorLookup(database *sql.DB) (map[string]string, error) {
	rows, err := database.Query(`SELECT MerchantKey, Behavior FROM CategoryRules`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lookup := map[string]string{}
	for rows.Next() {
		var merchantKey, behavior string
		if err := rows.Scan(&merchantKey, &behavior); err != nil {
			return nil, err
		}
		lookup[merchantKey] = normalizeBehavior(behavior)
	}
	return lookup, rows.Err()
}

func fetchTransactionRow(database *sql.DB, transactionID string) (transactionRow, error) {
	row := database.QueryRow(`SELECT Id, AccountNumber, BookingDate, ValueDate, Amount, RawDescription, MerchantKey, Category, SuggestedCategory, SuggestionConfidence, NeedsReview, ExcludeFromCalculations, ImportedAtUtc, IsMonthlyRecurring FROM Transactions WHERE Id = ?;`, transactionID)
	return scanTransactionRowSingle(row)
}

func fetchTransactionRowTx(tx *sql.Tx, transactionID string) (transactionRow, error) {
	row := tx.QueryRow(`SELECT Id, AccountNumber, BookingDate, ValueDate, Amount, RawDescription, MerchantKey, Category, SuggestedCategory, SuggestionConfidence, NeedsReview, ExcludeFromCalculations, ImportedAtUtc, IsMonthlyRecurring FROM Transactions WHERE Id = ?;`, transactionID)
	return scanTransactionRowSingle(row)
}

func scanTransactionRow(rows *sql.Rows) (transactionRow, error) {
	var row transactionRow
	var needsReview, excludeFromCalculations, isMonthlyRecurring int
	err := rows.Scan(&row.ID, &row.AccountNumber, &row.BookingDate, &row.ValueDate, &row.Amount, &row.RawDescription, &row.MerchantKey, &row.Category, &row.SuggestedCategory, &row.SuggestionConfidence, &needsReview, &excludeFromCalculations, &row.ImportedAtUtc, &isMonthlyRecurring)
	row.NeedsReview = needsReview != 0
	row.ExcludeFromCalculations = excludeFromCalculations != 0
	row.IsMonthlyRecurring = isMonthlyRecurring != 0
	return row, err
}

func scanTransactionRowSingle(row *sql.Row) (transactionRow, error) {
	var result transactionRow
	var needsReview, excludeFromCalculations, isMonthlyRecurring int
	err := row.Scan(&result.ID, &result.AccountNumber, &result.BookingDate, &result.ValueDate, &result.Amount, &result.RawDescription, &result.MerchantKey, &result.Category, &result.SuggestedCategory, &result.SuggestionConfidence, &needsReview, &excludeFromCalculations, &result.ImportedAtUtc, &isMonthlyRecurring)
	result.NeedsReview = needsReview != 0
	result.ExcludeFromCalculations = excludeFromCalculations != 0
	result.IsMonthlyRecurring = isMonthlyRecurring != 0
	return result, err
}

func mapTransaction(row transactionRow, behavior string) TransactionResponse {
	direction := "income"
	if row.Amount < 0 {
		direction = "expense"
	}
	return TransactionResponse{
		TransactionID:        row.ID,
		AccountNumber:        row.AccountNumber,
		BookingDate:          row.BookingDate,
		ValueDate:            row.ValueDate,
		Amount:               row.Amount,
		Direction:            direction,
		Description:          row.RawDescription,
		MerchantKey:          row.MerchantKey,
		MerchantRuleBehavior: behavior,
		Category:             nullableStringPtrFromNull(row.Category),
		SuggestedCategory:    nullableStringPtrFromNull(row.SuggestedCategory),
		SuggestionConfidence: nullableFloatPtrFromNull(row.SuggestionConfidence),
		NeedsReview:          row.NeedsReview,
		IsMonthlyRecurring:   row.IsMonthlyRecurring,
	}
}

func resolveMerchantRuleBehavior(merchantKey string, lookup map[string]string) string {
	if behavior, ok := lookup[merchantKey]; ok && behavior != "" {
		return behavior
	}
	return defaultRuleBehavior(merchantKey)
}

func getMerchantRuleBehaviorTx(tx *sql.Tx, merchantKey string) (string, error) {
	var behavior string
	err := tx.QueryRow(`SELECT Behavior FROM CategoryRules WHERE MerchantKey = ?;`, merchantKey).Scan(&behavior)
	if err == sql.ErrNoRows {
		return defaultRuleBehavior(merchantKey), nil
	}
	if err != nil {
		return "", err
	}
	return normalizeBehavior(behavior), nil
}

func upsertCategoryRuleTx(tx *sql.Tx, merchantKey, category, behavior string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	var ruleID string
	var appliedCount int
	err := tx.QueryRow(`SELECT Id, AppliedCount FROM CategoryRules WHERE MerchantKey = ?;`, merchantKey).Scan(&ruleID, &appliedCount)
	if err == sql.ErrNoRows {
		storedCategory := ""
		if behavior == merchantRuleBehaviorAutoApply {
			storedCategory = category
		}
		_, err = tx.Exec(`INSERT INTO CategoryRules (Id, MerchantKey, Category, Behavior, AppliedCount, CreatedAtUtc, UpdatedAtUtc) VALUES (?, ?, ?, ?, ?, ?, ?);`, newUUID(), merchantKey, storedCategory, behavior, 1, now, now)
		return err
	}
	if err != nil {
		return err
	}
	storedCategory := ""
	if behavior == merchantRuleBehaviorAutoApply {
		storedCategory = category
	}
	_, err = tx.Exec(`UPDATE CategoryRules SET Category = ?, Behavior = ?, AppliedCount = ?, UpdatedAtUtc = ? WHERE Id = ?;`, storedCategory, behavior, appliedCount+1, now, ruleID)
	return err
}

func applyCategoryToMerchantTransactionsTx(tx *sql.Tx, merchantKey, category string) (int, error) {
	result, err := tx.Exec(`UPDATE Transactions SET Category = ?, NeedsReview = 0, SuggestedCategory = NULL, SuggestionConfidence = NULL WHERE MerchantKey = ? AND Amount < 0;`, category, merchantKey)
	if err != nil {
		return 0, err
	}
	affected, err := result.RowsAffected()
	return int(affected), err
}

func countMatchingTransactions(database *sql.DB, merchantKey string) (int, error) {
	var count int
	err := database.QueryRow(`SELECT COUNT(1) FROM Transactions WHERE MerchantKey = ? AND Amount < 0 AND ExcludeFromCalculations = 0;`, merchantKey).Scan(&count)
	return count, err
}

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
