package fuel

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// getUserID extracts user ID from context (set by auth middleware)
func (h *Handler) getUserID(c *fiber.Ctx) (uint, error) {
	userID, ok := c.Locals(user.UserIDKey).(uint)
	if !ok {
		return 0, fiber.ErrUnauthorized
	}
	return userID, nil
}

// CreateFuelRecord handles POST /api/fuel/records
func (h *Handler) CreateFuelRecord(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	var req CreateFuelRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	// Validate fill type
	if req.FillType != FillTypeGPL && req.FillType != FillTypeBenzina {
		return fiber.NewError(fiber.StatusBadRequest, "fill type must be 'gpl' or 'benzina'")
	}

	// Check business rule: if every 4 fills need benzina
	stats, err := h.service.GetUserStats(userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get fuel statistics")
	}

	switch req.FillType {
	case FillTypeGPL:
		if stats.FillsUntilBenzina == 0 {
			return fiber.NewError(fiber.StatusBadRequest, "must fill with benzina before adding more GPL fills")
		}
	case FillTypeBenzina:
		// Check if user is trying to add benzina too early
		if stats.FillsUntilBenzina > 0 {
			return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("must wait %d more GPL fills before benzina", stats.FillsUntilBenzina))
		}
	}

	record, err := h.service.CreateFuelRecord(userID, req.FillType)
	if err != nil {
		if strings.Contains(err.Error(), "invalid fill type") {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create fuel record")
	}

	return c.Status(fiber.StatusCreated).JSON(record.ToResponse())
}

// GetUserStats handles GET /api/fuel/stats
func (h *Handler) GetUserStats(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	stats, err := h.service.GetUserStats(userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get fuel statistics")
	}

	return c.JSON(stats)
}

// GetUserRecords handles GET /api/fuel/records
func (h *Handler) GetUserRecords(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	records, err := h.service.GetUserRecords(userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get fuel records")
	}

	responses := make([]FuelResponse, len(records))
	for i, record := range records {
		responses[i] = *record.ToResponse()
	}

	return c.JSON(responses)
}

// GetLastRecord handles GET /api/fuel/records/last
func (h *Handler) GetLastRecord(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	record, err := h.service.GetLastFuelRecord(userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get last fuel record")
	}

	if record == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "no fuel records found",
		})
	}

	return c.JSON(record.ToResponse())
}

// DeleteRecord handles DELETE /api/fuel/records/:id
// Admin only
func (h *Handler) DeleteRecord(c *fiber.Ctx) error {
	recordID := c.Params("id")
	if recordID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "record ID is required")
	}

	if err := h.service.DeleteRecord(recordID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || err.Error() == "record not found" {
			return fiber.NewError(fiber.StatusNotFound, "record not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "failed to delete record")
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// DeleteUserRecords handles DELETE /api/fuel/records
// Admin only
func (h *Handler) DeleteUserRecords(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	if err := h.service.DeleteUserRecords(userID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to delete user records")
	}

	return c.Status(fiber.StatusNoContent).Send(nil)
}

// GetRecordsInDateRange handles GET /api/fuel/records/range
func (h *Handler) GetRecordsInDateRange(c *fiber.Ctx) error {
	userID, err := h.getUserID(c)
	if err != nil {
		return err
	}

	startDateStr := c.Query("start")
	endDateStr := c.Query("end")

	if startDateStr == "" || endDateStr == "" {
		return fiber.NewError(fiber.StatusBadRequest, "start and end date parameters are required")
	}

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid start date format, use YYYY-MM-DD")
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid end date format, use YYYY-MM-DD")
	}

	records, err := h.service.GetRecordsInDateRange(userID, startDate, endDate)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to get fuel records")
	}

	responses := make([]FuelResponse, len(records))
	for i, record := range records {
		responses[i] = *record.ToResponse()
	}

	return c.JSON(responses)
}
