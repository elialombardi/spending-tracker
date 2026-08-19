package user

import (
	"slices"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// AuthMiddleware handles authentication
type AuthMiddleware struct {
	authService AuthService
}

// NewAuthMiddleware creates a new auth middleware
func NewAuthMiddleware(authService AuthService) *AuthMiddleware {
	return &AuthMiddleware{
		authService: authService,
	}
}

// Authenticate validates the JWT token and sets user in context
func (m *AuthMiddleware) Authenticate(c *fiber.Ctx) error {
	authorization := c.Get("Authorization")
	if !strings.HasPrefix(authorization, "Bearer ") {
		return c.SendStatus(fiber.StatusUnauthorized)
	}

	tokenString := strings.TrimPrefix(authorization, "Bearer ")
	user, err := m.authService.ValidateToken(tokenString)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}

	// Store user info in context
	c.Locals("user_id", user.ID)
	c.Locals("username", user.Username)
	c.Locals("role", user.Role)

	return c.Next()
}

// Authorize checks if the user has the required role
func (m *AuthMiddleware) Authorize(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals("role").(string)
		if !ok {
			return c.SendStatus(fiber.StatusUnauthorized)
		}

		if slices.Contains(allowedRoles, role) {
			return c.Next()
		} else if len(allowedRoles) == 0 {
			// If no specific roles are required, allow any authenticated user
			return c.Next()
		}

		return c.SendStatus(fiber.StatusForbidden)
	}
}
