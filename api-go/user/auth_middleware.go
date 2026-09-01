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

const (
	// Header keys
	HeaderAuthorization = "Authorization"

	// Authentication prefix
	BearerPrefix    = "Bearer "
	BearerPrefixLen = len(BearerPrefix) // optional, for trim without alloc

	// Context local keys (used with c.Locals)
	UserIDKey   = "user_id"
	UsernameKey = "username"
	RoleKey     = "role"

	AdminRole  = "Admin"
	WriterRole = "Writer"
)

// Authenticate validates the JWT token and sets user in context
func (m *AuthMiddleware) Authenticate(c *fiber.Ctx) error {
	// Use constant for header name
	authorization := c.Get(HeaderAuthorization)
	if !strings.HasPrefix(authorization, BearerPrefix) {
		return c.SendStatus(fiber.StatusUnauthorized)
	}

	// Trim using the constant
	tokenString := strings.TrimPrefix(authorization, BearerPrefix)
	user, err := m.authService.ValidateToken(tokenString)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}

	// Store user info with constants as keys
	c.Locals(UserIDKey, user.ID)
	c.Locals(UsernameKey, user.Username)
	c.Locals(RoleKey, user.Role)

	return c.Next()
}

// Authorize checks if the user has the required role
func (m *AuthMiddleware) Authorize(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals(RoleKey).(string)
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
