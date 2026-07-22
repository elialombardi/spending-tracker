package models

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Location struct {
	ID          int      `json:"id"`
	Title       string   `json:"title"`
	Tags        []string `json:"tags"`
	Url         string   `json:"url,omitempty"`
	Lat         float64  `json:"lat"`
	Lng         float64  `json:"lng"`
	Description string   `json:"description,omitempty"`
}

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
