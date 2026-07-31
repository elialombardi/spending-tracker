package reports

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/your/repo/spendingtracker.go/internal/auth"
)

var database *sql.DB

func RegisterRoutes(app *fiber.App, db *sql.DB) {
	database = db
	app.Post("/api/imports/poste-italiane", auth.AuthRequired(importPosteItaliane, []string{"Writer", "Admin"}))
	app.Get("/api/transactions", auth.AuthRequired(listTransactions, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/transactions/summary", auth.AuthRequired(getTransactionsSummary, []string{"Reader", "Writer", "Admin"}))
	app.Post("/api/transactions/:transactionId/categorize", auth.AuthRequired(categorizeTransaction, []string{"Writer", "Admin"}))
	app.Put("/api/transactions/:transactionId/amount", auth.AuthRequired(updateTransactionAmount, []string{"Writer", "Admin"}))
	app.Get("/api/categories", auth.AuthRequired(listCategories, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/categories/cycle-income", auth.AuthRequired(getCycleIncomeCategories, []string{"Reader", "Writer", "Admin"}))
	app.Put("/api/categories/cycle-income", auth.AuthRequired(updateCycleIncomeCategories, []string{"Writer", "Admin"}))
	app.Get("/api/categories/mappings", auth.AuthRequired(listCategoryMappings, []string{"Reader", "Writer", "Admin"}))
	app.Put("/api/categories/mappings/:mappingId", auth.AuthRequired(updateCategoryMapping, []string{"Writer", "Admin"}))
	app.Delete("/api/categories/mappings/:mappingId", auth.AuthRequired(deleteCategoryMapping, []string{"Writer", "Admin"}))
	app.Get("/api/reports/cycles", auth.AuthRequired(getReportCycles, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/cycle", auth.AuthRequired(getCycleReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/cycle/export", auth.AuthRequired(exportCycleReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/monthly", auth.AuthRequired(getMonthlyReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/monthly/export", auth.AuthRequired(exportMonthlyReport, []string{"Reader", "Writer", "Admin"}))
}

func listCategoryMappings(c *fiber.Ctx) error {
	mappings, err := fetchCategoryMappings(database)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(mappings)
}

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

	result, err := importParsedTransactions(database, parsed.accountNumber, fileHeader.Filename, parsed.transactions)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(result)
}

func getReportCycles(c *fiber.Ctx) error {
	cycles, err := fetchCycleOptions(database)
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
	report, found, err := buildCycleReport(database, cycleStart)
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
	content, contentType, fileName, found, err := exportCycleReportData(database, cycleStart, format)
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
	report, err := buildMonthlyReportByMonth(database, year, month)
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
	content, contentType, fileName, err := exportMonthlyReportData(database, year, month, format)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Set("Content-Type", contentType)
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	return c.Send(content)
}

func getTransactionsSummary(c *fiber.Ctx) error {
	from, err := parseOptionalDate(c.Query("from"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Invalid from date. Expected yyyy-MM-dd.")
	}
	to, err := parseOptionalDate(c.Query("to"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).SendString("Invalid to date. Expected yyyy-MM-dd.")
	}

	summary, err := fetchTransactionsSummary(database, from, to)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(summary)
}
