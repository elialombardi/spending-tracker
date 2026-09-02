package boxing_events

import (
	"strconv"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(app fiber.Router, authMiddleware *user.AuthMiddleware) {
	group := app.Group("/boxing-events", authMiddleware.Authenticate)
	group.Get("/", h.List)
	group.Post("/", h.Create)
	group.Get("/:id", h.Get)
	group.Put("/:id", h.Update)
	group.Delete("/:id", h.Delete)
	group.Get("/export", h.Export)
}

// Helper to get user ID from context (JWT)
func getUserID(c *fiber.Ctx) uint {
	user := c.Locals("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)
	// adjust based on your JWT claim key
	return uint(claims["sub"].(float64))
}

func (h *Handler) List(c *fiber.Ctx) error {
	userID := getUserID(c)
	filter := Filter{
		Title:    c.Query("title"),
		Location: c.Query("location"),
		Status:   c.Query("status"),
	}
	if from := c.Query("start_from"); from != "" {
		t, _ := time.Parse(time.RFC3339, from)
		filter.StartFrom = &t
	}
	if to := c.Query("start_to"); to != "" {
		t, _ := time.Parse(time.RFC3339, to)
		filter.StartTo = &t
	}
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	filter.Page = page
	filter.Limit = limit

	events, total, err := h.service.List(c.Context(), userID, filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"data":  events,
		"total": total,
		"page":  filter.Page,
		"limit": filter.Limit,
	})
}

func (h *Handler) Get(c *fiber.Ctx) error {
	userID := getUserID(c)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid ID"})
	}
	event, err := h.service.Get(c.Context(), uint(id), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if event == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(event)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	userID := getUserID(c)
	var req CreateEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	event, err := h.service.Create(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(event)
}

func (h *Handler) Update(c *fiber.Ctx) error {
	userID := getUserID(c)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid ID"})
	}
	var req UpdateEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request"})
	}
	event, err := h.service.Update(c.Context(), uint(id), userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if event == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(event)
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	userID := getUserID(c)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid ID"})
	}
	err = h.service.Delete(c.Context(), uint(id), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Similar handlers for Get, Create, Update, Delete...
// Create validates request, calls service.Create.
// Update validates ID and request.
// Delete: service.Delete.

func (h *Handler) Export(c *fiber.Ctx) error {
	userID := getUserID(c)
	filter := Filter{
		Title:    c.Query("title"),
		Location: c.Query("location"),
		Status:   c.Query("status"),
	}
	if from := c.Query("start_from"); from != "" {
		t, _ := time.Parse(time.RFC3339, from)
		filter.StartFrom = &t
	}
	if to := c.Query("start_to"); to != "" {
		t, _ := time.Parse(time.RFC3339, to)
		filter.StartTo = &t
	}
	format := c.Query("format", "csv")
	data, filename, err := h.service.Export(c.Context(), userID, filter, format)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	c.Set("Content-Disposition", "attachment; filename="+filename)
	if format == "ics" {
		c.Set("Content-Type", "text/calendar")
	} else {
		c.Set("Content-Type", "text/csv")
	}
	return c.Send(data)
}
