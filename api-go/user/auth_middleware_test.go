package user

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

type middlewareAuthService struct {
	role string
}

func (s middlewareAuthService) GenerateToken(*User) (*AuthTokenResponse, error) {
	return nil, errors.New("unexpected GenerateToken call")
}

func (s middlewareAuthService) ValidateToken(token string) (*User, error) {
	if token != "valid" {
		return nil, errors.New("invalid token")
	}
	return &User{ID: 42, Username: "test-user", Role: s.role}, nil
}

func TestAuthMiddleware(t *testing.T) {
	tests := []struct {
		name          string
		authorization string
		role          string
		allowedRoles  []string
		status        int
	}{
		{"missing token", "", AdminRole, []string{AdminRole}, http.StatusUnauthorized},
		{"invalid scheme", "Basic valid", AdminRole, []string{AdminRole}, http.StatusUnauthorized},
		{"invalid token", "Bearer invalid", AdminRole, []string{AdminRole}, http.StatusUnauthorized},
		{"forbidden", "Bearer valid", WriterRole, []string{AdminRole}, http.StatusForbidden},
		{"admin", "Bearer valid", AdminRole, []string{AdminRole}, http.StatusNoContent},
		{"any authenticated role", "Bearer valid", WriterRole, nil, http.StatusNoContent},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := fiber.New()
			middleware := NewAuthMiddleware(middlewareAuthService{role: tt.role})
			app.Get("/protected", middleware.Authenticate, middleware.Authorize(tt.allowedRoles...), func(c fiber.Ctx) error {
				if c.Locals(UserIDKey) != uint(42) || c.Locals(UsernameKey) != "test-user" || c.Locals(RoleKey) != tt.role {
					t.Error("authenticated user locals were not preserved")
				}
				return c.SendStatus(fiber.StatusNoContent)
			})

			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			req.Header.Set(HeaderAuthorization, tt.authorization)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tt.status {
				t.Fatalf("got status %d, want %d", resp.StatusCode, tt.status)
			}
		})
	}
}
