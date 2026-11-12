package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"gorm.io/gorm"
)

var ErrPublicKey = errors.New("public key must be a PKIX PEM ECDSA P-256 key")

type Service struct {
	devices    DeviceStore
	challenges ChallengeStore
	tokens     *JWT
	users      user.UserService
}

func NewService(devices DeviceStore, challenges ChallengeStore, tokens *JWT, users user.UserService) *Service {
	return &Service{devices: devices, challenges: challenges, tokens: tokens, users: users}
}

func ParsePublicKey(value string) (*ecdsa.PublicKey, error) {
	block, rest := pem.Decode([]byte(value))
	if block == nil || block.Type != "PUBLIC KEY" || len(rest) != 0 {
		return nil, ErrPublicKey
	}
	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, ErrPublicKey
	}
	key, ok := parsed.(*ecdsa.PublicKey)
	if !ok || key.Curve != elliptic.P256() || !key.Curve.IsOnCurve(key.X, key.Y) {
		return nil, ErrPublicKey
	}
	return key, nil
}

func VerifySignature(key *ecdsa.PublicKey, challenge, signature []byte) bool {
	hash := sha256.Sum256(challenge)
	return ecdsa.VerifyASN1(key, hash[:], signature)
}

func (s *Service) Register(ctx context.Context, device Device) (bool, error) {
	if _, err := ParsePublicKey(device.PublicKeyPEM); err != nil {
		return false, err
	}
	return s.devices.Upsert(ctx, device)
}

func (s *Service) Challenge(ctx context.Context, id string) (string, time.Time, error) {
	nonce := make([]byte, 32)
	if _, err := rand.Read(nonce); err != nil {
		return "", time.Time{}, err
	}
	value := Challenge{Nonce: nonce, ExpiresAt: time.Now().UTC().Add(ChallengeTTL)}
	device, err := s.devices.Find(ctx, id)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", time.Time{}, err
	}
	// Unknown devices receive the same response, but can never authenticate.
	if err == nil {
		value.UserID = device.UserID
		value.KeyHash = sha256.Sum256([]byte(device.PublicKeyPEM))
	}
	if err := s.challenges.Put(ctx, id, value); err != nil {
		return "", time.Time{}, err
	}
	return base64.RawURLEncoding.EncodeToString(nonce), value.ExpiresAt, nil
}

func (s *Service) Verify(ctx context.Context, id, signature string) (string, error) {
	value, err := s.challenges.Consume(ctx, id)
	if err != nil {
		return "", err
	}
	signatureBytes, err := base64.StdEncoding.Strict().DecodeString(signature)
	if err != nil {
		return "", ErrUnauthorized
	}
	device, err := s.devices.Find(ctx, id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", ErrUnauthorized
	}
	if err != nil {
		return "", err
	}
	keyHash := sha256.Sum256([]byte(device.PublicKeyPEM))
	if device.UserID != value.UserID || subtle.ConstantTimeCompare(keyHash[:], value.KeyHash[:]) != 1 {
		return "", ErrUnauthorized
	}
	key, err := ParsePublicKey(device.PublicKeyPEM)
	if err != nil {
		return "", err
	}
	if !VerifySignature(key, value.Nonce, signatureBytes) {
		return "", ErrUnauthorized
	}
	account, err := s.users.GetByID(device.UserID)
	if err != nil {
		return "", fmt.Errorf("resolve device user: %w", err)
	}
	// Existing API tokens use the username as sub; preserve that contract.
	return s.tokens.Issue(account.Username, id)
}
