package user

import (
	"errors"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AuthService handles authentication
type AuthService interface {
	GenerateToken(user *User) (*AuthTokenResponse, error)
	ValidateToken(tokenString string) (*User, error)
}

type authService struct {
	jwtKey            []byte
	jwtIssuer         string
	jwtAudience       string
	tokenLifetimeMins int
	userService       UserService
}

// NewAuthService creates a new auth service
func NewAuthService(userService UserService) AuthService {
	key := os.Getenv("JWT_SIGNING_KEY")
	if key == "" {
		key = "dev-only-signing-key-change-before-production-2026-07-06"
	}

	issuer := os.Getenv("JWT_ISSUER")
	if issuer == "" {
		issuer = "SpendingTracker.Api"
	}

	audience := os.Getenv("JWT_AUDIENCE")
	if audience == "" {
		audience = "SpendingTracker.Client"
	}

	lifetimeMins := 480
	if v := os.Getenv("JWT_TOKEN_LIFETIME_MINUTES"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			lifetimeMins = parsed
		}
	}

	return &authService{
		jwtKey:            []byte(key),
		jwtIssuer:         issuer,
		jwtAudience:       audience,
		tokenLifetimeMins: lifetimeMins,
		userService:       userService,
	}
}

// GenerateToken generates a JWT token for a user
func (s *authService) GenerateToken(user *User) (*AuthTokenResponse, error) {
	now := time.Now().UTC()
	expiresAt := now.Add(time.Duration(s.tokenLifetimeMins) * time.Minute)

	claims := jwt.RegisteredClaims{
		Subject:   user.Username,
		Issuer:    s.jwtIssuer,
		Audience:  jwt.ClaimStrings{s.jwtAudience},
		ExpiresAt: jwt.NewNumericDate(expiresAt),
		NotBefore: jwt.NewNumericDate(now),
		IssuedAt:  jwt.NewNumericDate(now),
		ID:        strconv.FormatInt(now.UnixNano(), 10),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtKey)
	if err != nil {
		return nil, err
	}

	return &AuthTokenResponse{
		AccessToken: signed,
		TokenType:   "Bearer",
		ExpiresAt:   expiresAt,
		Username:    user.Username,
		Role:        user.Role,
	}, nil
}

// ValidateToken validates a JWT token and returns the user
func (s *authService) ValidateToken(tokenString string) (*User, error) {
	claims := &jwt.RegisteredClaims{}
	parsed, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		func(token *jwt.Token) (interface{}, error) {
			if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, errors.New("unexpected signing method")
			}
			return s.jwtKey, nil
		},
		jwt.WithAudience(s.jwtAudience),
		jwt.WithIssuer(s.jwtIssuer),
	)

	if err != nil || !parsed.Valid {
		return nil, errors.New("invalid token")
	}

	// Get user from database
	user, err := s.userService.GetByUsername(claims.Subject)
	if err != nil {
		return nil, errors.New("user not found")
	}

	// Convert to full user model (we need the password for potential operations)
	userModel := &User{
		ID:       user.ID,
		Username: user.Username,
		Role:     user.Role,
	}

	return userModel, nil
}
