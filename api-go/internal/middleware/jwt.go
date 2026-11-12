package middleware

import (
	"log/slog"
	"strings"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/auth"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
)

func JWT(tokens *auth.JWT, users user.UserService) fiber.Handler {
	return func(c fiber.Ctx) error {
		parts := strings.Fields(c.Get("Authorization"))
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication failed"})
		}
		claims, err := tokens.Validate(parts[1])
		if err != nil || claims.DeviceID != "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication failed"})
		}
		account, err := users.GetByUsername(claims.Subject)
		if err != nil {
			slog.Error("registration user lookup failed", "error", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication failed"})
		}
		c.Locals(user.UserIDKey, account.ID)
		return c.Next()
	}
}
