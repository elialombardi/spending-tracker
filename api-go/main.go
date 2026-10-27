package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/di"
	"github.com/joho/godotenv"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	_ "modernc.org/sqlite"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() (runErr error) {
	if os.Getenv("APP_ENV") == "development" {
		log.Println("Loading .env.local file...")
		err := godotenv.Load(".env.local")
		if err != nil {
			return fmt.Errorf("load .env.local: %w", err)
		}
	}
	development := os.Getenv("APP_ENV") == "development"
	boxingEnabled, err := envBool("BOXING_SYNC_ENABLED", !development)
	if err != nil {
		return err
	}
	youtubeEnabled, err := envBool("YOUTUBE_SYNC_ENABLED", development)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	log.Println("Setting up application container...")
	container, err := di.InitializeApp()
	if err != nil {
		return err
	}
	sqlDB, err := container.DB.DB()
	if err != nil {
		return err
	}
	defer sqlDB.Close()

	if err := container.UserService.SeedDefaultUsers(); err != nil {
		return err
	}

	app := fiber.New()
	app.Use(cors.New())

	container.TransactionHandler.RegisterRoutes(app, container.AuthMiddleware)
	container.ProjectTaskHandler.RegisterRoutes(app, container.AuthMiddleware)
	container.LocationTagHandler.RegisterRoutes(app, container.AuthMiddleware)
	container.WorkoutHandler.RegisterRoutes(app, container.AuthMiddleware)
	container.NotesHandler.RegisterRoutes(app, container.AuthMiddleware)
	container.UserHandler.SetupRoutes(app, container.AuthMiddleware)
	container.DiaryHandler.RegisterRoutes(app, container.AuthMiddleware)
	container.BoxingEventHandler.RegisterRoutes(app, container.AuthMiddleware)
	container.FuelHandler.RegisterRoutes(app, container.AuthMiddleware)
	container.YoutubeHandler.RegisterRoutes(app, container.AuthMiddleware)

	var schedules []<-chan struct{}
	stopYoutubeCancellation := context.AfterFunc(ctx, container.YoutubeService.Cancel)
	defer stopYoutubeCancellation()
	defer func() {
		stop()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		runErr = errors.Join(runErr, container.YoutubeService.Shutdown(shutdownCtx))
		for _, done := range schedules {
			select {
			case <-done:
			case <-shutdownCtx.Done():
				runErr = errors.Join(runErr, fmt.Errorf("wait for background scheduler: %w", shutdownCtx.Err()))
			}
		}
	}()
	if boxingEnabled {
		schedules = append(schedules, container.BoxingEventService.StartBackgroundSync(ctx))
	}
	if youtubeEnabled {
		schedules = append(schedules, container.YoutubeService.StartBackgroundSync(ctx))
	}

	app.Get("/api/version", func(c fiber.Ctx) error {
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
	// 	log.Fatal(app.Listen(":"+port, fiber.ListenConfig{CertFile: certFile, CertKeyFile: keyFile}))
	// }
	log.Printf("starting Go API (HTTP) on :%s\n", port)
	return app.Listen(":"+port, fiber.ListenConfig{GracefulContext: ctx, ShutdownTimeout: 30 * time.Second})
}

// Database and auth helpers moved to internal packages.

func getenv(key, def string) string {
	value := os.Getenv(key)
	if value == "" {
		return def
	}
	return value
}

func envBool(key string, fallback bool) (bool, error) {
	value, present := os.LookupEnv(key)
	if !present {
		return fallback, nil
	}
	enabled, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s must be a boolean: %w", key, err)
	}
	return enabled, nil
}
