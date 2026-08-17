package workouts

import (
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
