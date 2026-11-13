package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
	log     *slog.Logger
}

func NewHandler(service *Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, log: logger}
}

// NewFromEnvironment selects a challenge backend once; runtime Redis errors fail closed.
func NewFromEnvironment(db *gorm.DB, users user.UserService, logger *slog.Logger) (*Handler, *JWT, func() error, error) {
	tokens, err := JWTFromEnvironment()
	if err != nil {
		return nil, nil, nil, err
	}
	if err := db.AutoMigrate(&Device{}); err != nil {
		return nil, nil, nil, err
	}
	var store ChallengeStore = NewMemoryChallengeStore()
	closeStore := func() error { return nil }
	address := os.Getenv("REDIS_URL")
	if address == "" {
		logger.Warn("REDIS_URL unset; using process-local biometric challenges")
	} else {
		options, err := redis.ParseURL(address)
		if err != nil {
			// Parse errors can contain credentials from the URL.
			return nil, nil, nil, errors.New("invalid REDIS_URL")
		}
		options.DialTimeout = 2 * time.Second
		options.ReadTimeout = 2 * time.Second
		options.WriteTimeout = 2 * time.Second
		options.MaxRetries = -1
		client := redis.NewClient(options)
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		err = client.Ping(ctx).Err()
		cancel()
		if err != nil {
			logger.Warn("Redis unavailable; using process-local biometric challenges")
			if closeErr := client.Close(); closeErr != nil {
				return nil, nil, nil, fmt.Errorf("close unavailable Redis client: %w", closeErr)
			}
		} else {
			store = NewRedisChallengeStore(client)
			closeStore = client.Close
		}
	}
	return NewHandler(NewService(NewSQLDeviceStore(db), store, tokens, users), logger), tokens, closeStore, nil
}

type deviceRequest struct {
	DeviceID     string `json:"device_id"`
	PublicKeyPEM string `json:"public_key_pem"`
	DeviceName   string `json:"device_name"`
	SignatureB64 string `json:"signature_b64"`
}

func validDeviceID(id string) bool {
	if len(id) == 0 || len(id) > 128 {
		return false
	}
	for _, c := range id {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

func parseDevice(c fiber.Ctx) error {
	if len(c.Body()) > 8192 {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "request too large"})
	}
	var req deviceRequest
	if err := c.Bind().Body(&req); err != nil || !validDeviceID(req.DeviceID) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid device request"})
	}
	c.Locals("biometric_request", req)
	return c.Next()
}

func rateLimit(key func(fiber.Ctx) string) fiber.Handler {
	return limiter.New(limiter.Config{
		Max: 5, Expiration: time.Minute, KeyGenerator: key,
		LimitReached: func(c fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "too many requests"})
		},
	})
}

func (h *Handler) RegisterRoutes(app *fiber.App, authenticate fiber.Handler) {
	group := app.Group("/api/v1/auth")
	group.Post("/register-device", authenticate, parseDevice, h.register)
	group.Get("/devices", authenticate, h.listDevices)
	group.Patch("/devices/:deviceID", authenticate, h.renameDevice)
	group.Delete("/devices/:deviceID", authenticate, h.revokeDevice)
	for _, route := range []struct {
		path    string
		handler fiber.Handler
	}{{"/challenge", h.challenge}, {"/verify-challenge", h.verify}} {
		group.Post(route.path,
			rateLimit(func(c fiber.Ctx) string { return c.IP() }),
			parseDevice,
			rateLimit(func(c fiber.Ctx) string { return c.Locals("biometric_request").(deviceRequest).DeviceID }),
			route.handler)
	}
}

type deviceSummary struct {
	DeviceID   string `json:"device_id"`
	DeviceName string `json:"device_name"`
}

func (h *Handler) listDevices(c fiber.Ctx) error {
	userID, ok := c.Locals(user.UserIDKey).(uint)
	if !ok || userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication failed"})
	}
	devices, err := h.service.ListDevices(c.Context(), userID)
	if err != nil {
		return h.failure(c, "", err)
	}
	result := make([]deviceSummary, 0, len(devices))
	for _, device := range devices {
		result = append(result, deviceSummary{DeviceID: device.DeviceID, DeviceName: device.DeviceName})
	}
	return c.JSON(result)
}

func (h *Handler) renameDevice(c fiber.Ctx) error {
	userID, ok := c.Locals(user.UserIDKey).(uint)
	if !ok || userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication failed"})
	}
	id := c.Params("deviceID")
	var req struct {
		DeviceName string `json:"device_name"`
	}
	if !validDeviceID(id) || c.Bind().Body(&req) != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid device request"})
	}
	name := strings.TrimSpace(req.DeviceName)
	if name == "" || len(name) > 200 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "device name must be between 1 and 200 bytes"})
	}
	if err := h.service.RenameDevice(c.Context(), userID, id, name); err != nil {
		return h.deviceManagementFailure(c, id, err)
	}
	h.log.Info("biometric device renamed", "device_id", id)
	return c.JSON(deviceSummary{DeviceID: id, DeviceName: name})
}

func (h *Handler) revokeDevice(c fiber.Ctx) error {
	userID, ok := c.Locals(user.UserIDKey).(uint)
	if !ok || userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication failed"})
	}
	id := c.Params("deviceID")
	if !validDeviceID(id) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid device request"})
	}
	if err := h.service.RevokeDevice(c.Context(), userID, id); err != nil {
		return h.deviceManagementFailure(c, id, err)
	}
	h.log.Info("biometric device revoked", "device_id", id)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) deviceManagementFailure(c fiber.Ctx, id string, err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "device not found"})
	}
	return h.failure(c, id, err)
}

func (h *Handler) register(c fiber.Ctx) error {
	req := c.Locals("biometric_request").(deviceRequest)
	userID, ok := c.Locals(user.UserIDKey).(uint)
	if !ok || userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication failed"})
	}
	if strings.TrimSpace(req.DeviceName) == "" || len(req.DeviceName) > 200 || len(req.PublicKeyPEM) > 4096 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid device request"})
	}
	created, err := h.service.Register(c.Context(), Device{
		DeviceID: req.DeviceID, UserID: userID, PublicKeyPEM: req.PublicKeyPEM, DeviceName: req.DeviceName,
	})
	if err != nil {
		if errors.Is(err, ErrPublicKey) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": ErrPublicKey.Error()})
		}
		return h.failure(c, req.DeviceID, err)
	}
	h.log.Info("biometric device registered", "device_id", req.DeviceID, "created", created)
	status := fiber.StatusOK
	if created {
		status = fiber.StatusCreated
	}
	return c.Status(status).JSON(fiber.Map{"device_id": req.DeviceID})
}

func (h *Handler) challenge(c fiber.Ctx) error {
	req := c.Locals("biometric_request").(deviceRequest)
	value, expires, err := h.service.Challenge(c.Context(), req.DeviceID)
	if err != nil {
		return h.failure(c, req.DeviceID, err)
	}
	h.log.Info("biometric challenge issued", "device_id", req.DeviceID)
	return c.JSON(fiber.Map{"challenge": value, "expires_at": expires.Format(time.RFC3339Nano)})
}

func (h *Handler) verify(c fiber.Ctx) error {
	req := c.Locals("biometric_request").(deviceRequest)
	h.log.Info("biometric verification requested", "device_id", req.DeviceID, "signature_b64_length", len(req.SignatureB64))
	token, err := h.service.Verify(c.Context(), req.DeviceID, req.SignatureB64)
	if err != nil {
		return h.failure(c, req.DeviceID, err)
	}
	h.log.Info("biometric authentication succeeded", "device_id", req.DeviceID)
	return c.JSON(fiber.Map{"access_token": token, "expires_in": int(TokenLifetime.Seconds())})
}

func (h *Handler) failure(c fiber.Ctx, id string, err error) error {
	switch {
	case errors.Is(err, ErrUnauthorized):
		h.log.Warn("biometric authentication failed", "device_id", id, "reason", err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "authentication failed"})
	case errors.Is(err, ErrChallengeMissing):
		h.log.Warn("biometric challenge missing or expired", "device_id", id, "reason", err)
		return c.Status(fiber.StatusGone).JSON(fiber.Map{"error": "challenge missing or expired"})
	default:
		h.log.Error("biometric authentication backend failed", "device_id", id, "error", err)
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "authentication temporarily unavailable"})
	}
}
