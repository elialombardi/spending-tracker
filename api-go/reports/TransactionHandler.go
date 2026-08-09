package reports

import (
	"fmt"
	"log"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/auth"
	"github.com/gofiber/fiber/v2"
)

type TransactionHandler struct {
	transactionService *TransactionService
}

func NewTransactionHandler(transactionService *TransactionService) *TransactionHandler {
	return &TransactionHandler{transactionService: transactionService}
}

func (h *TransactionHandler) RegisterRoutes(app *fiber.App) {
	app.Get("/api/transactions", auth.AuthRequired(h.listTransactions, []string{"Reader", "Writer", "Admin"}))
	app.Post("/api/imports/poste-italiane", auth.AuthRequired(h.importPosteItaliane, []string{"Writer", "Admin"}))
	app.Get("/api/transactions/summary", auth.AuthRequired(h.getTransactionsSummary, []string{"Reader", "Writer", "Admin"}))
	app.Post("/api/transactions/:transactionId/categorize", auth.AuthRequired(h.categorizeTransaction, []string{"Writer", "Admin"}))
	app.Post("/api/transactions/send", auth.AuthRequired(h.sendTransactions, []string{"Writer", "Admin"}))
	app.Put("/api/transactions/:transactionId/amount", auth.AuthRequired(h.updateTransactionAmount, []string{"Writer", "Admin"}))
	app.Get("/api/categories", auth.AuthRequired(h.listCategories, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/categories/cycle-income", auth.AuthRequired(h.getCycleIncomeCategories, []string{"Reader", "Writer", "Admin"}))
	app.Put("/api/categories/cycle-income", auth.AuthRequired(h.updateCycleIncomeCategories, []string{"Writer", "Admin"}))
	app.Get("/api/categories/mappings", auth.AuthRequired(h.listCategoryMappings, []string{"Reader", "Writer", "Admin"}))
	app.Put("/api/categories/mappings/:mappingId", auth.AuthRequired(h.updateCategoryMapping, []string{"Writer", "Admin"}))
	app.Delete("/api/categories/mappings/:mappingId", auth.AuthRequired(h.deleteCategoryMapping, []string{"Writer", "Admin"}))
	app.Get("/api/reports/cycles", auth.AuthRequired(h.getReportCycles, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/cycle", auth.AuthRequired(h.getCycleReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/cycle/export", auth.AuthRequired(h.exportCycleReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/monthly", auth.AuthRequired(h.getMonthlyReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/monthly/export", auth.AuthRequired(h.exportMonthlyReport, []string{"Reader", "Writer", "Admin"}))
}

func (h *TransactionHandler) listCategoryMappings(c *fiber.Ctx) error {
	rules, err := h.transactionService.FetchCategoryMappings()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	responses := []CategoryMappingResponse{}
	for _, rule := range rules {
		matchingTransactions, err := h.transactionService.CountMatchingTransactions(rule.MerchantKey)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}

		responses = append(responses, CategoryMappingResponse{
			MappingID:            rule.ID, // Assuming ID is a string or compatible type
			MerchantKey:          rule.MerchantKey,
			Category:             nullableStringPtr(rule.Category),
			Behavior:             normalizeBehavior(rule.Behavior),
			AppliedCount:         rule.AppliedCount,
			MatchingTransactions: matchingTransactions,
		})
	}

	return c.JSON(responses)
}

func (h *TransactionHandler) listTransactions(c *fiber.Ctx) error {

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

	transactions, err := h.transactionService.FetchTransactions(from, to, direction, category, hasNeedsReview, needsReview)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	behaviorLookup, err := h.transactionService.FetchRuleBehaviorLookup()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	responses := []TransactionResponse{}
	for _, t := range transactions {
		behavior := h.transactionService.ResolveMerchantRuleBehavior(t.MerchantKey, behaviorLookup)
		responses = append(responses, h.mapTransaction(t, behavior))
	}
	return c.JSON(responses)
}

func (h *TransactionHandler) categorizeTransaction(c *fiber.Ctx) error {
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

	txRow, found, behavior, err := h.transactionService.ApplyCategorization(transactionID, request, category)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !found {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(h.mapTransaction(txRow, behavior))
}

func (h *TransactionHandler) sendTransactions(c *fiber.Ctx) error {
	// get ids of transactions to send from request body
	var request SendTransactionsRequest
	if err := c.BodyParser(&request); err != nil {
		log.Printf("Error parsing request body: %v", err)
		return fiber.ErrBadRequest
	}
	if len(request.TransactionIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).SendString("transactionIds is required and must contain at least one id")
	}

	affected, err := h.transactionService.SendTransactions(request.TransactionIDs, request.IsSending)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if affected == 0 {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"message": fmt.Sprintf("Successfully updated %d transactions.", affected)})

}

func (h *TransactionHandler) listCategories(c *fiber.Ctx) error {
	responses, err := h.transactionService.FetchCategories()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(responses)
}

func (h *TransactionHandler) getCycleIncomeCategories(c *fiber.Ctx) error {
	response, err := h.transactionService.FetchCycleIncomeCategories()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(response)
}

func (h *TransactionHandler) updateCycleIncomeCategories(c *fiber.Ctx) error {
	var request UpdateCycleIncomeCategoriesRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.ErrBadRequest
	}

	response, err := h.transactionService.SaveCycleIncomeCategories(request.Categories)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(response)
}

func (h *TransactionHandler) updateCategoryMapping(c *fiber.Ctx) error {
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

	response, found, err := h.transactionService.SaveCategoryMapping(mappingID, behavior, collapseWhitespace(derefString(request.Category)))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !found {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(response)
}
func (h *TransactionHandler) updateTransactionAmount(c *fiber.Ctx) error {
	transactionID := strings.TrimSpace(c.Params("transactionId"))
	if transactionID == "" {
		return fiber.ErrBadRequest
	}

	var req UpdateAmountRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}

	updatedRow, behavior, found, err := h.transactionService.UpdateTransactionAmount(transactionID, req.Amount)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !found {
		return c.SendStatus(fiber.StatusNotFound)
	}

	return c.JSON(h.mapTransaction(updatedRow, behavior))
}

func (h *TransactionHandler) mapTransaction(transaction Transaction, behavior string) TransactionResponse {
	direction := "income"
	if transaction.Amount < 0 {
		direction = "expense"
	}
	return TransactionResponse{
		TransactionID:           transaction.ID,
		AccountNumber:           transaction.AccountNumber,
		BookingDate:             transaction.BookingDate,
		ValueDate:               transaction.ValueDate,
		Amount:                  transaction.Amount,
		Direction:               direction,
		Description:             transaction.RawDescription,
		MerchantKey:             transaction.MerchantKey,
		MerchantRuleBehavior:    behavior,
		Category:                transaction.Category,
		SuggestedCategory:       transaction.SuggestedCategory,
		SuggestionConfidence:    transaction.SuggestionConfidence,
		NeedsReview:             transaction.NeedsReview,
		IsMonthlyRecurring:      transaction.IsMonthlyRecurring,
		ExcludeFromCalculations: transaction.ExcludeFromCalculations,
	}
}

func (h *TransactionHandler) deleteCategoryMapping(c *fiber.Ctx) error {
	deleted, err := h.transactionService.RemoveCategoryMapping(strings.TrimSpace(c.Params("mappingId")))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *TransactionHandler) importPosteItaliane(c *fiber.Ctx) error {
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

	result, err := h.transactionService.ImportParsedTransactions(parsed.accountNumber, fileHeader.Filename, parsed.transactions)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(result)
}

func (h *TransactionHandler) getReportCycles(c *fiber.Ctx) error {
	cycles, err := h.transactionService.FetchCycleOptions()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(cycles)
}

func (h *TransactionHandler) getCycleReport(c *fiber.Ctx) error {
	cycleStart, err := parseRequiredDate(c.Query("cycleStart"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Cycle start is required.")
	}
	report, found, err := h.transactionService.FetchCycleReport(cycleStart)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !found {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(report)
}

func (h *TransactionHandler) exportCycleReport(c *fiber.Ctx) error {
	cycleStart, err := parseRequiredDate(c.Query("cycleStart"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Cycle start is required.")
	}
	format := strings.TrimSpace(strings.ToLower(c.Query("format", "csv")))
	if format != "csv" && format != "xlsx" {
		return c.Status(fiber.StatusBadRequest).SendString("Supported formats are csv and xlsx.")
	}
	content, contentType, fileName, found, err := h.transactionService.ExportCycleReport(cycleStart, format)
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

func (h *TransactionHandler) getMonthlyReport(c *fiber.Ctx) error {
	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 || year > 2100 {
		return c.Status(fiber.StatusBadRequest).SendString("Year must be between 2000 and 2100.")
	}
	month, err := strconv.Atoi(c.Query("month"))
	if err != nil || month < 1 || month > 12 {
		return c.Status(fiber.StatusBadRequest).SendString("Month must be between 1 and 12.")
	}
	report, err := h.transactionService.FetchMonthlyReport(year, month)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(report)
}

func (h *TransactionHandler) exportMonthlyReport(c *fiber.Ctx) error {
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
	content, contentType, fileName, err := h.transactionService.ExportMonthlyReport(year, month, format)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Set("Content-Type", contentType)
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	return c.Send(content)
}

func (h *TransactionHandler) getTransactionsSummary(c *fiber.Ctx) error {
	from, err := parseOptionalDate(c.Query("from"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Invalid from date. Expected yyyy-MM-dd.")
	}
	to, err := parseOptionalDate(c.Query("to"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Invalid to date. Expected yyyy-MM-dd.")
	}

	summary, err := h.transactionService.FetchCategorySummary(from, to)

	// 3. Process grouping logic in memory (same as your original implementation)
	type aggregate struct {
		total float64
		count int
	}
	grouped := map[string]aggregate{}

	for _, row := range summary {
		key := "Uncategorized"
		if row.Category != nil && strings.TrimSpace(*row.Category) != "" {
			key = *row.Category
		}
		agg := grouped[key]
		agg.total += row.Amount
		agg.count++
		grouped[key] = agg
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
		responses = append(responses, CategorySpendResponse{
			Category:     key,
			TotalSpent:   round2(agg.total),
			Transactions: agg.count,
			ShareOfSpent: share,
		})
	}

	return c.JSON(SpendingSummaryResponse{
		From:               datePtrString(from),
		To:                 datePtrString(to),
		TotalSpent:         round2(totalSpent),
		UncategorizedSpent: round2(uncategorizedSpent),
		Categories:         responses,
	})
}
