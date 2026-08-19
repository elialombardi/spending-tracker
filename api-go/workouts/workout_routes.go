package workouts

import (
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
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
func (h *WorkoutHandler) RegisterRoutes(app *fiber.App, authMiddleware *user.AuthMiddleware) {
	api := app.Group("/api")
	sessions := api.Group("/sessions", authMiddleware.Authenticate)
	sessions.Post("/", h.CreateSession)
	sessions.Get("/", h.ListSessions)
	sessions.Get("/:id", h.GetSessionByID)
	sessions.Put("/:id", h.UpdateSession)
	sessions.Delete("/:id", h.DeleteSession)

	workouts := api.Group("/workouts", authMiddleware.Authenticate)
	workouts.Post("/", h.CreateWorkout)
	workouts.Get("/", h.ListWorkouts)
	workouts.Get("/:id", h.GetWorkoutByID)
	workouts.Put("/:id", h.UpdateWorkout)
	workouts.Delete("/:id", h.DeleteWorkout)
}
