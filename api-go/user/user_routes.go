package user

import (
	"github.com/gofiber/fiber/v2"
)

// SetupRoutes configures all routes
func (h *UserHandler) SetupRoutes(app *fiber.App, authMiddleware *AuthMiddleware) {

	// API routes group
	api := app.Group("/api")

	auth := api.Group("/auth")
	{
		auth.Post("/login", h.Login)
	}

	// User routes
	userRoutes := api.Group("/users", authMiddleware.Authenticate)
	{
		// Admin only routes
		adminRoutes := userRoutes.Group("/", authMiddleware.Authorize("Admin"))
		{
			adminRoutes.Post("/", h.CreateUser)
			adminRoutes.Delete("/:id", h.DeleteUser)
		}

		// Admin and Writer routes
		writeRoutes := userRoutes.Group("/", authMiddleware.Authorize("Admin", "Writer"))
		{
			writeRoutes.Put("/:id", h.UpdateUser)
		}

		// All authenticated users can read
		userRoutes.Get("/", h.GetAllUsers)
		userRoutes.Get("/:id", h.GetUser)
		userRoutes.Get("/username/:username", h.GetUserByUsername)

	}
}
