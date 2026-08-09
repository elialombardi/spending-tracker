package auth

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

var (
	users             = map[string]models.User{}
	jwtKey            []byte
	jwtIssuer         string
	jwtAudience       string
	tokenLifetimeMins int
)

func ConfigureUsers() {
	adminUsername := os.Getenv("SPENDING_TRACKER_ADMIN_USERNAME")
	if adminUsername == "" {
		adminUsername = "admin"
	}
	adminPassword := os.Getenv("SPENDING_TRACKER_ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "dev-password-change-me"
	}
	writerUsername := os.Getenv("SPENDING_TRACKER_WRITER_USERNAME")
	if writerUsername == "" {
		writerUsername = "user"
	}
	writerPassword := os.Getenv("SPENDING_TRACKER_WRITER_PASSWORD")
	if writerPassword == "" {
		writerPassword = "dev-password-change-me"
	}

	users[strings.ToLower(adminUsername)] = models.User{Username: adminUsername, Password: adminPassword, Role: "Admin"}
	users[strings.ToLower(writerUsername)] = models.User{Username: writerUsername, Password: writerPassword, Role: "Writer"}
}

func ConfigureJwt() {
	key := os.Getenv("JWT_SIGNING_KEY")
	if key == "" {
		key = "dev-only-signing-key-change-before-production-2026-07-06"
	}
	jwtKey = []byte(key)
	jwtIssuer = os.Getenv("JWT_ISSUER")
	if jwtIssuer == "" {
		jwtIssuer = "SpendingTracker.Api"
	}
	jwtAudience = os.Getenv("JWT_AUDIENCE")
	if jwtAudience == "" {
		jwtAudience = "SpendingTracker.Client"
	}
	tokenLifetimeMins = 480
	if v := os.Getenv("JWT_TOKEN_LIFETIME_MINUTES"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			tokenLifetimeMins = parsed
		}
	}
}

func HandleToken(c *fiber.Ctx) error {
	var request models.LoginRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.ErrBadRequest
	}

	user, ok := users[strings.ToLower(strings.TrimSpace(request.Username))]
	if !ok || user.Password != request.Password {
		return c.SendStatus(fiber.StatusUnauthorized)
	}

	now := time.Now().UTC()
	expiresAt := now.Add(time.Duration(tokenLifetimeMins) * time.Minute)
	claims := models.AuthClaims{
		Role: user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.Username,
			Issuer:    jwtIssuer,
			Audience:  jwt.ClaimStrings{jwtAudience},
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        strconv.FormatInt(now.UnixNano(), 10),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(jwtKey)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	return c.JSON(models.AuthTokenResponse{
		AccessToken: signed,
		TokenType:   "Bearer",
		ExpiresAt:   expiresAt,
		Username:    user.Username,
		Role:        user.Role,
	})
}

func AuthRequired(next fiber.Handler, allowedRoles []string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !setUserFromHeader(c) {
			return c.SendStatus(fiber.StatusUnauthorized)
		}

		role, _ := c.Locals("role").(string)
		for _, allowedRole := range allowedRoles {
			if role == allowedRole {
				return next(c)
			}
		}

		return c.SendStatus(fiber.StatusForbidden)
	}
}

func setUserFromHeader(c *fiber.Ctx) bool {
	authorization := c.Get("Authorization")
	if !strings.HasPrefix(authorization, "Bearer ") {
		return false
	}

	tokenString := strings.TrimPrefix(authorization, "Bearer ")
	claims := &models.AuthClaims{}
	parsed, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		func(token *jwt.Token) (interface{}, error) {
			if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, errors.New("unexpected signing method")
			}
			return jwtKey, nil
		},
		jwt.WithAudience(jwtAudience),
		jwt.WithIssuer(jwtIssuer),
	)
	if err != nil || !parsed.Valid {
		return false
	}

	c.Locals("username", claims.Subject)
	c.Locals("role", claims.Role)
	return true
}
