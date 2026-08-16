package main

import (
	"log"
	"os"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/auth"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/di"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	_ "modernc.org/sqlite"
)

func main() {
	auth.ConfigureUsers()
	auth.ConfigureJwt()

	log.Println("Setting up application container...")
	container, err := di.InitializeApp()
	if err != nil {
		log.Fatal(err)
	}
	sqlDB, err := container.DB.DB()
	if err != nil {
		log.Fatal(err)
	}
	defer sqlDB.Close()

	app := fiber.New()
	app.Use(cors.New())

	app.Post("/api/auth/token", auth.HandleToken)
	container.TransactionHandler.RegisterRoutes(app)
	container.ProjectTaskHandler.RegisterRoutes(app)
	container.LocationTagHandler.RegisterRoutes(app)
	container.WorkoutHandler.RegisterRoutes(app)

	app.Get("/api/version", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"version": os.Getenv("APP_VERSION"),
		})
	})
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
