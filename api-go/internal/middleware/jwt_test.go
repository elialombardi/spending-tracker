package middleware

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/auth"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
)

type testUsers struct {
	user.UserService
}

func (testUsers) GetByUsername(string) (*user.UserResponse, error) {
	return &user.UserResponse{ID: 42, Username: "alice"}, nil
}

func TestJWTRegistrationMiddleware(t *testing.T) {
	t.Setenv("JWT_SIGNING_KEY", strings.Repeat("s", 32))
	t.Setenv("JWT_ISSUER", "issuer")
	t.Setenv("JWT_AUDIENCE", "audience")
	users := testUsers{}
	tokens, err := auth.JWTFromEnvironment()
	if err != nil {
		t.Fatal(err)
	}
	passwordToken, err := user.NewAuthService(users).GenerateToken(&user.User{ID: 42, Username: "alice"})
	if err != nil {
		t.Fatal(err)
	}
	biometricToken, err := tokens.Issue("alice", "device")
	if err != nil {
		t.Fatal(err)
	}
	app := fiber.New()
	app.Post("/register", JWT(tokens, users), func(c fiber.Ctx) error {
		if c.Locals(user.UserIDKey) != uint(42) {
			t.Error("user ID missing from context")
		}
		return c.SendStatus(204)
	})
	for _, test := range []struct {
		header string
		status int
	}{
		{"", 401},
		{"Basic value", 401},
		{"Bearer invalid", 401},
		{"Bearer " + biometricToken, 401},
		{"Bearer " + passwordToken.AccessToken, 204},
	} {
		req := httptest.NewRequest("POST", "/register", nil)
		req.Header.Set("Authorization", test.header)
		response, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != test.status {
			t.Fatalf("got %d, want %d", response.StatusCode, test.status)
		}
	}
}
