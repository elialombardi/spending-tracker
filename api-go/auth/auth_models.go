package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthTokenResponse struct {
	AccessToken string    `json:"accessToken"`
	TokenType   string    `json:"tokenType"`
	ExpiresAt   time.Time `json:"expiresAt"`
	Username    string    `json:"username"`
	Role        string    `json:"role"`
}

type AuthClaims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

type User struct {
	Username string
	Password string
	Role     string
}
