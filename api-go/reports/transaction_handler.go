package reports

import (
	"fmt"
	"log"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
)

type TransactionHandler struct {
	transactionService *TransactionService
}

func NewTransactionHandler(transactionService *TransactionService) *TransactionHandler {
	return &TransactionHandler{transactionService: transactionService}
}

func (h *TransactionHandler) RegisterRoutes(app *fiber.App, authMiddleware *user.AuthMiddleware) {
	api := app.Group("/api")

	transactionRoutes := api.Group("/transactions", authMiddleware.Authenticate, authMiddleware.Authorize("Admin"))
	{
		transactionRoutes.Get("/", h.listTransactions)
		transactionRoutes.Post("/imports/poste-italiane", h.importPosteItaliane)
		transactionRoutes.Get("/summary", h.getTransactionsSummary)
		transactionRoutes.Post("/:transactionId/categorize", h.categorizeTransaction)
		transactionRoutes.Post("/send", h.sendTransactions)
		transactionRoutes.Put("/:transactionId/amount", h.updateTransactionAmount)

	}

	categoriesRoutes := api.Group("/categories", authMiddleware.Authenticate, authMiddleware.Authorize("Admin"))
	{
		categoriesRoutes.Get("/", h.listCategories)
		categoriesRoutes.Get("/cycle-income", h.getCycleIncomeCategories)
		categoriesRoutes.Put("/cycle-income", h.updateCycleIncomeCategories)
		categoriesRoutes.Get("/mappings", h.listCategoryMappings)
		categoriesRoutes.Put("/mappings/:mappingId", h.updateCategoryMapping)
		categoriesRoutes.Delete("/mappings/:mappingId", h.deleteCategoryMapping)
	}

	reportsRoutes := api.Group("/reports", authMiddleware.Authenticate, authMiddleware.Authorize("Admin"))
	{
		reportsRoutes.Get("/cycles", h.getReportCycles)
		reportsRoutes.Get("/cycle", h.getCycleReport)
		reportsRoutes.Get("/cycle/export", h.exportCycleReport)
		reportsRoutes.Get("/monthly", h.getMonthlyReport)
		reportsRoutes.Get("/monthly/export", h.exportMonthlyReport)
	}

}

func (h *TransactionHandler) listCategoryMappings(c fiber.Ctx) error {
	rules, err := h.transactionService.FetchCategoryMappings()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	responses := []CategoryMappingResponse{}
	for _, rule := range rules {
		responses = append(responses, CategoryMappingResponse{
			MappingID:            rule.ID, // Assuming ID is a string or compatible type
			MerchantKey:          rule.MerchantKey,
			Category:             nullableStringPtr(rule.Category),
			Behavior:             normalizeBehavior(rule.Behavior),
			AppliedCount:         rule.AppliedCount,
			MatchingTransactions: rule.MatchingTransactions,
		})
	}

	return c.JSON(responses)
}

func (h *TransactionHandler) listTransactions(c fiber.Ctx) error {

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

	var pagination *TransactionPagination
	queryArgs := c.Request().URI().QueryArgs()
	if queryArgs.Has("page") || queryArgs.Has("limit") {
		pageText, limitText := "1", "50"
		if queryArgs.Has("page") {
			pageText = string(queryArgs.Peek("page"))
		}
		if queryArgs.Has("limit") {
			limitText = string(queryArgs.Peek("limit"))
		}
		page, err := strconv.Atoi(pageText)
		if err != nil || page < 1 {
			return fiber.NewError(fiber.StatusBadRequest, "page must be a positive integer.")
		}
		limit, err := strconv.Atoi(limitText)
		if err != nil || limit < 1 || limit > 200 {
			return fiber.NewError(fiber.StatusBadRequest, "limit must be an integer between 1 and 200.")
		}
		if page-1 > int(^uint(0)>>1)/limit {
			return fiber.NewError(fiber.StatusBadRequest, "page is too large.")
		}
		pagination = &TransactionPagination{Page: page, Limit: limit}
	}
	transactions, total, err := h.transactionService.FetchTransactionsPage(c.Context(), from, to, direction, category, hasNeedsReview, needsReview, pagination)
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
	if pagination != nil {
		var totalPages int64
		if total > 0 {
			totalPages = (total-1)/int64(pagination.Limit) + 1
		}
		return c.JSON(fiber.Map{
			"data": responses,
			"meta": fiber.Map{
				"page": pagination.Page, "limit": pagination.Limit,
				"total": total, "totalPages": totalPages,
			},
		})
	}
	return c.JSON(responses)
}

func (h *TransactionHandler) categorizeTransaction(c fiber.Ctx) error {
	transactionID := strings.TrimSpace(c.Params("transactionId"))
	if transactionID == "" {
		return fiber.ErrBadRequest
	}

	var request CategorizeTransactionRequest
	if err := c.Bind().Body(&request); err != nil {
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

func (h *TransactionHandler) sendTransactions(c fiber.Ctx) error {
	// get ids of transactions to send from request body
	var request SendTransactionsRequest
	if err := c.Bind().Body(&request); err != nil {
		log.Printf("Error parsing request body: %v", err)
		return fiber.ErrBadRequest
	}
	if len(request.TransactionIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).SendString("transactionIds is required and must contain at least one id")
	}

	affected, err := h.transactionService.SendTransactions(request.TransactionIDs, request.IsSending)
	if err != nil {
		log.Printf("Error sending transactions: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if affected == 0 {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"message": fmt.Sprintf("Successfully updated %d transactions.", affected)})

}

func (h *TransactionHandler) listCategories(c fiber.Ctx) error {
	responses, err := h.transactionService.FetchCategories()
	if err != nil {
		log.Printf("Error fetching categories: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(responses)
}

func (h *TransactionHandler) getCycleIncomeCategories(c fiber.Ctx) error {
	response, err := h.transactionService.FetchCycleIncomeCategories()
	if err != nil {
		log.Printf("Error fetching cycle income categories: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(response)
}

func (h *TransactionHandler) updateCycleIncomeCategories(c fiber.Ctx) error {
	var request UpdateCycleIncomeCategoriesRequest
	if err := c.Bind().Body(&request); err != nil {
		return fiber.ErrBadRequest
	}

	response, err := h.transactionService.SaveCycleIncomeCategories(request.Categories)
	if err != nil {
		log.Printf("Error updating cycle income categories: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(response)
}

func (h *TransactionHandler) updateCategoryMapping(c fiber.Ctx) error {
	mappingID := strings.TrimSpace(c.Params("mappingId"))
	var request UpdateCategoryMappingRequest
	if err := c.Bind().Body(&request); err != nil {
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
		log.Printf("Error updating category mapping: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !found {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(response)
}
func (h *TransactionHandler) updateTransactionAmount(c fiber.Ctx) error {
	transactionID := strings.TrimSpace(c.Params("transactionId"))
	if transactionID == "" {
		return fiber.ErrBadRequest
	}

	var req UpdateAmountRequest
	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	updatedRow, behavior, found, err := h.transactionService.UpdateTransactionAmount(transactionID, req.Amount)
	if err != nil {
		log.Printf("Error updating transaction amount: %v", err)
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

func (h *TransactionHandler) deleteCategoryMapping(c fiber.Ctx) error {
	deleted, err := h.transactionService.RemoveCategoryMapping(strings.TrimSpace(c.Params("mappingId")))
	if err != nil {
		log.Printf("Error deleting category mapping: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *TransactionHandler) importPosteItaliane(c fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil || fileHeader == nil {
		return c.Status(fiber.StatusBadRequest).SendString("A non-empty Excel file is required.")
	}
	if strings.ToLower(filepath.Ext(fileHeader.Filename)) != ".xlsx" {
		return c.Status(fiber.StatusBadRequest).SendString("Only .xlsx Poste Italiane exports are supported.")
	}

	file, err := fileHeader.Open()
	if err != nil {
		log.Printf("Error opening uploaded file: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	defer file.Close()

	parsed, err := parsePosteItalianeWorkbook(file)
	if err != nil {
		log.Printf("Error parsing Poste Italiane workbook: %v", err)
		return c.Status(fiber.StatusBadRequest).SendString(err.Error())
	}

	result, err := h.transactionService.ImportParsedTransactions(parsed.accountNumber, fileHeader.Filename, parsed.transactions)
	if err != nil {
		log.Printf("Error importing transactions: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(result)
}

func (h *TransactionHandler) getReportCycles(c fiber.Ctx) error {
	cycles, err := h.transactionService.FetchCycleOptions()
	if err != nil {
		log.Printf("Error fetching cycle options: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(cycles)
}

func (h *TransactionHandler) getCycleReport(c fiber.Ctx) error {
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

func (h *TransactionHandler) exportCycleReport(c fiber.Ctx) error {
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

func (h *TransactionHandler) getMonthlyReport(c fiber.Ctx) error {
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

func (h *TransactionHandler) exportMonthlyReport(c fiber.Ctx) error {
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

func (h *TransactionHandler) getTransactionsSummary(c fiber.Ctx) error {
	from, err := parseOptionalDate(c.Query("from"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Invalid from date. Expected yyyy-MM-dd.")
	}
	to, err := parseOptionalDate(c.Query("to"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Invalid to date. Expected yyyy-MM-dd.")
	}

	summary, err := h.transactionService.FetchCategorySummary(from, to)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

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
		agg.count += row.Count
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
