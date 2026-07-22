package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/your/repo/spendingtracker.go/internal/auth"
	"github.com/your/repo/spendingtracker.go/internal/db"
	_ "modernc.org/sqlite"
)

var (
	database *sql.DB
)

func main() {
	auth.ConfigureUsers()
	auth.ConfigureJwt()

	var err error
	database, err = db.OpenDatabase()
	if err != nil {
		log.Fatal(err)
	}
	defer database.Close()
	if err := db.EnsureSchema(database); err != nil {
		log.Fatal(err)
	}
	if err := db.SeedDefaultLocations(database); err != nil {
		log.Fatal(err)
	}

	app := fiber.New()
	app.Use(cors.New())

	app.Post("/api/auth/token", auth.HandleToken)
	app.Post("/api/imports/poste-italiane", auth.AuthRequired(importPosteItaliane, []string{"Writer", "Admin"}))
	app.Get("/api/transactions", auth.AuthRequired(listTransactions, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/transactions/summary", auth.AuthRequired(getTransactionsSummary, []string{"Reader", "Writer", "Admin"}))
	app.Post("/api/transactions/:transactionId/categorize", auth.AuthRequired(categorizeTransaction, []string{"Writer", "Admin"}))
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
	app.Get("/api/projects", auth.AuthRequired(listProjects, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/projects/:id", auth.AuthRequired(getProject, []string{"Reader", "Writer", "Admin"}))
	app.Post("/api/projects", auth.AuthRequired(createProject, []string{"Writer", "Admin"}))
	app.Put("/api/projects/:id", auth.AuthRequired(updateProject, []string{"Writer", "Admin"}))
	app.Delete("/api/projects/:id", auth.AuthRequired(deleteProject, []string{"Writer", "Admin"}))
	app.Get("/api/tasks", auth.AuthRequired(listTasks, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/tasks/:id", auth.AuthRequired(getTask, []string{"Reader", "Writer", "Admin"}))
	app.Post("/api/tasks", auth.AuthRequired(createTask, []string{"Writer", "Admin"}))
	app.Put("/api/tasks/:id", auth.AuthRequired(updateTask, []string{"Writer", "Admin"}))
	app.Delete("/api/tasks/:id", auth.AuthRequired(deleteTask, []string{"Writer", "Admin"}))
	app.Get("/locations", auth.AuthRequired(listLocations, []string{"Reader", "Writer", "Admin"}))
	app.Get("/locations/:id", auth.AuthRequired(getLocation, []string{"Reader", "Writer", "Admin"}))
	app.Post("/locations", auth.AuthRequired(createLocation, []string{"Writer", "Admin"}))
	app.Put("/locations/:id", auth.AuthRequired(updateLocation, []string{"Writer", "Admin"}))
	app.Delete("/locations/:id", auth.AuthRequired(deleteLocation, []string{"Writer", "Admin"}))
	app.Post("/locations/:id/tags", auth.AuthRequired(toggleLocationTag, []string{"Writer", "Admin"}))
	app.Get("/tags", auth.AuthRequired(listTags, []string{"Reader", "Writer", "Admin"}))
	app.Post("/tags", auth.AuthRequired(createTag, []string{"Writer", "Admin"}))
	app.Patch("/tags/:name", auth.AuthRequired(renameTag, []string{"Writer", "Admin"}))
	app.Delete("/tags/:name", auth.AuthRequired(deleteTag, []string{"Writer", "Admin"}))
	configureStaticApp(app)

	port := getenv("PORT", "7004")
	// certFile := os.Getenv("TLS_CERT")
	// keyFile := os.Getenv("TLS_KEY")
	// if certFile != "" && keyFile != "" {
	// 	log.Printf("starting Go API (HTTPS) on :%s\n", port)
	// 	log.Fatal(app.ListenTLS(":"+port, certFile, keyFile))
	// }
	log.Printf("starting Go API (HTTP) on :%s\n", port)
	log.Fatal(app.Listen(":" + port))
}

// Database and auth helpers moved to internal packages.

func getenv(key, def string) string {
	value := os.Getenv(key)
	if value == "" {
		return def
	}
	return value
}
