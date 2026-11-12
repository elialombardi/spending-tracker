package auth

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const TokenLifetime = 15 * time.Minute

type TokenClaims struct {
	DeviceID string `json:"device_id"`
	jwt.RegisteredClaims
}

type JWT struct {
	key      []byte
	issuer   string
	audience string
}

func NewJWT(key []byte, issuer, audience string) (*JWT, error) {
	if len(key) < 32 || issuer == "" || audience == "" {
		return nil, errors.New("JWT requires a signing key of at least 32 bytes, issuer, and audience")
	}
	return &JWT{key: append([]byte(nil), key...), issuer: issuer, audience: audience}, nil
}

func JWTFromEnvironment() (*JWT, error) {
	issuer := os.Getenv("JWT_ISSUER")
	if issuer == "" {
		issuer = "SpendingTracker.Api"
	}
	audience := os.Getenv("JWT_AUDIENCE")
	if audience == "" {
		audience = "SpendingTracker.Client"
	}
	return NewJWT([]byte(os.Getenv("JWT_SIGNING_KEY")), issuer, audience)
}

func (j *JWT) Issue(subject, deviceID string) (string, error) {
	now := time.Now().UTC()
	claims := TokenClaims{
		DeviceID: deviceID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject: subject, Issuer: j.issuer, Audience: jwt.ClaimStrings{j.audience},
			IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(TokenLifetime)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(j.key)
}

func (j *JWT) Validate(raw string) (*TokenClaims, error) {
	claims := &TokenClaims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(*jwt.Token) (interface{}, error) {
		return j.key, nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(j.issuer),
		jwt.WithAudience(j.audience), jwt.WithExpirationRequired(), jwt.WithIssuedAt())
	if err != nil || !token.Valid || claims.Subject == "" || claims.IssuedAt == nil {
		return nil, ErrUnauthorized
	}
	return claims, nil
}
