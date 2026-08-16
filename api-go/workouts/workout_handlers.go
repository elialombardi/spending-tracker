package workouts

import (
	"strconv"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/dto"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type WorkoutHandler struct {
	service  WorkoutService
	validate *validator.Validate
}

func NewWorkoutHandler(service WorkoutService) *WorkoutHandler {
	return &WorkoutHandler{
		service:  service,
		validate: validator.New(),
	}
}

// Router Setup
func (h *WorkoutHandler) RegisterRoutes(app fiber.Router) {
	sessions := app.Group("/api/sessions")
	sessions.Post("/", h.CreateSession)
	sessions.Get("/", h.ListSessions)
	sessions.Get("/:id", h.GetSessionByID)
	sessions.Put("/:id", h.UpdateSession)
	sessions.Delete("/:id", h.DeleteSession)

	workouts := app.Group("/api/workouts")
	workouts.Post("/", h.CreateWorkout)
	workouts.Get("/", h.ListWorkouts)
	workouts.Get("/:id", h.GetWorkoutByID)
	workouts.Put("/:id", h.UpdateWorkout)
	workouts.Delete("/:id", h.DeleteWorkout)
}

// --- Session Handlers ---

func (h *WorkoutHandler) CreateSession(c *fiber.Ctx) error {
	var req dto.CreateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}

	resp, err := h.service.CreateSession(&req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

func (h *WorkoutHandler) GetSessionByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	resp, err := h.service.GetSessionByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resp)
}

func (h *WorkoutHandler) ListSessions(c *fiber.Ctx) error {
	var query dto.PaginationQuery
	if err := c.QueryParser(&query); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid query params"})
	}
	query.SetDefaults()

	resp, err := h.service.ListSessions(&query)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resp)
}

func (h *WorkoutHandler) UpdateSession(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	var req dto.UpdateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}

	resp, err := h.service.UpdateSession(uint(id), &req)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resp)
}

func (h *WorkoutHandler) DeleteSession(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	if err := h.service.DeleteSession(uint(id)); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Workout Handlers ---

func (h *WorkoutHandler) CreateWorkout(c *fiber.Ctx) error {
	var req dto.CreateWorkoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}

	resp, err := h.service.CreateWorkout(&req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

func (h *WorkoutHandler) GetWorkoutByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	resp, err := h.service.GetWorkoutByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resp)
}

func (h *WorkoutHandler) ListWorkouts(c *fiber.Ctx) error {
	var query dto.PaginationQuery
	if err := c.QueryParser(&query); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid query params"})
	}
	query.SetDefaults()

	resp, err := h.service.ListWorkouts(&query)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resp)
}

func (h *WorkoutHandler) UpdateWorkout(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	var req dto.UpdateWorkoutRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}

	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}

	resp, err := h.service.UpdateWorkout(uint(id), &req)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(resp)
}

func (h *WorkoutHandler) DeleteWorkout(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	if err := h.service.DeleteWorkout(uint(id)); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
