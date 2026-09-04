package diary

import (
	"errors"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// getUserID extracts the authenticated user ID from context (set by auth middleware).
func (h *Handler) getUserID(c *fiber.Ctx) (uint, error) {
	userID, ok := c.Locals(user.UserIDKey).(uint)
	if !ok {
		return 0, fiber.ErrUnauthorized
	}
	return userID, nil
}

func (h *Handler) ListEntries(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	var req ListEntriesRequest
	if err := c.QueryParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid query parameters")
	}

	entries, total, err := h.service.GetEntries(c.Context(), userID, req)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	return c.JSON(fiber.Map{
		"data":  entries,
		"total": total,
		"page":  req.Page,
		"limit": req.Limit,
	})
}

func (h *Handler) GetEntry(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	dateStr := c.Params("date")
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid date format, use YYYY-MM-DD")
	}

	entry, err := h.service.GetEntryByDate(c.Context(), userID, date)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	// if entry == nil {
	// 	return fiber.NewError(fiber.StatusNotFound, "entry not found")
	// }
	return c.JSON(entry)
}

func (h *Handler) CreateEntry(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	var req CreateEntryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	// Validate date
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid date format, use YYYY-MM-DD")
	}

	entry, err := h.service.CreateEntry(c.Context(), userID, date, req.Content)
	if err != nil {
		if errors.Is(err, errors.New("entry already exists for this date")) {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.Status(fiber.StatusCreated).JSON(entry)
}

func (h *Handler) UpdateEntry(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	dateStr := c.Params("date")
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid date format, use YYYY-MM-DD")
	}

	var req UpdateEntryRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	entry, err := h.service.UpdateEntry(c.Context(), userID, date, req.Content)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if entry == nil {
		return fiber.NewError(fiber.StatusNotFound, "entry not found")
	}
	return c.JSON(entry)
}
