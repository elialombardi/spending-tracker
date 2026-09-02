package diary

import (
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v2"
)

func (h *Handler) RegisterRoutes(app *fiber.App, authMiddleware *user.AuthMiddleware) {
	handler := h
	group := app.Group("/api/diary", authMiddleware.Authenticate, authMiddleware.Authorize(user.AdminRole))
	group.Get("/entries", handler.ListEntries)
	group.Get("/entries/:date", handler.GetEntry)
	group.Post("/entries", handler.CreateEntry)
	group.Put("/entries/:date", handler.UpdateEntry)
}
