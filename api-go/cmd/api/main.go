// Command api runs the authentication-only API. The root command runs the full application.
package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/auth"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/middleware"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("authentication API stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) (runErr error) {
	database, err := db.NewDatabase()
	if err != nil {
		return err
	}
	sqlDB, err := database.DB()
	if err != nil {
		return err
	}
	defer func() { runErr = errors.Join(runErr, sqlDB.Close()) }()
	users := user.NewUserService(database)
	handler, tokens, closeChallenges, err := auth.NewFromEnvironment(database, users, logger)
	if err != nil {
		return err
	}
	defer func() { runErr = errors.Join(runErr, closeChallenges()) }()
	app := fiber.New(fiber.Config{BodyLimit: 8192})
	passwordAuth := user.NewAuthService(users)
	app.Post("/api/auth/login", user.NewUserHandler(users, passwordAuth).Login)
	handler.RegisterRoutes(app, middleware.JWT(tokens, users))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	port := os.Getenv("PORT")
	if port == "" {
		port = "7004"
	}
	return app.Listen(":"+port, fiber.ListenConfig{GracefulContext: ctx, ShutdownTimeout: 30 * time.Second})
}
