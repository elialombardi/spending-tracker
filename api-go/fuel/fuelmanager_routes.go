package fuel

import (
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v2"
)

func (h *Handler) RegisterRoutes(app *fiber.App, authMiddleware *user.AuthMiddleware) {
	group := app.Group("/api/fuel", authMiddleware.Authenticate)

	// User endpoints
	group.Post("/records", h.CreateFuelRecord)
	group.Get("/records", h.GetUserRecords)
	group.Get("/records/last", h.GetLastRecord)
	group.Get("/stats", h.GetUserStats)
	group.Get("/records/range", h.GetRecordsInDateRange)

	// Admin endpoints
	adminGroup := group.Group("/admin", authMiddleware.Authorize(user.AdminRole))
	adminGroup.Delete("/records/:id", h.DeleteRecord)
	adminGroup.Delete("/records", h.DeleteUserRecords)
}
