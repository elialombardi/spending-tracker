package marketplace

import (
	"errors"
	"log"
	"strconv"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) RegisterRoutes(app *fiber.App, auth *user.AuthMiddleware, dailyEnabled bool) {
	group := app.Group("/api/marketplace-searches", auth.Authenticate)
	group.Get("/configuration", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"dailyEnabled": dailyEnabled, "telegramConfigured": h.service.notifier != nil,
			"marketplaces": []fiber.Map{
				{"id": "ebay", "name": "eBay", "available": true, "configured": h.service.provider != nil},
				{"id": "facebook", "name": "Facebook Marketplace", "available": false, "configured": false},
				{"id": "subito", "name": "Subito.it", "available": false, "configured": false},
			},
		})
	})
	group.Get("/", h.list)
	group.Post("/", h.save)
	group.Put("/:id", h.save)
	group.Delete("/:id", h.delete)
	group.Get("/:id/matches", h.matches)
}

func currentUser(c fiber.Ctx) (uint, error) {
	id, ok := c.Locals(user.UserIDKey).(uint)
	if !ok || id == 0 {
		return 0, fiber.ErrUnauthorized
	}
	return id, nil
}

func searchID(c fiber.Ctx) (uint, error) {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return 0, fiber.NewError(fiber.StatusBadRequest, "Invalid search ID")
	}
	return uint(id), nil
}

func respondError(c fiber.Ctx, err error) error {
	if errors.Is(err, ErrBusy) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Search not found"})
	}
	log.Printf("Marketplace search API: %v", err)
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Unable to access saved searches"})
}

func (h *Handler) list(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}
	result, err := h.service.List(c.Context(), userID)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) save(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}
	var id uint
	if c.Method() == fiber.MethodPut {
		id, err = searchID(c)
		if err != nil {
			return err
		}
	}
	var input SearchInput
	if err := c.Bind().Body(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}
	if err := validateInput(&input); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}
	result, err := h.service.Save(c.Context(), userID, id, input)
	if err != nil {
		return respondError(c, err)
	}
	if id == 0 {
		return c.Status(fiber.StatusCreated).JSON(result)
	}
	return c.JSON(result)
}

func (h *Handler) delete(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}
	id, err := searchID(c)
	if err != nil {
		return err
	}
	if err := h.service.Delete(c.Context(), userID, id); err != nil {
		return respondError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) matches(c fiber.Ctx) error {
	userID, err := currentUser(c)
	if err != nil {
		return err
	}
	id, err := searchID(c)
	if err != nil {
		return err
	}
	result, err := h.service.Matches(c.Context(), userID, id)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(result)
}
