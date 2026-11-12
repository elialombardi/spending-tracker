package auth

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	_ "modernc.org/sqlite"
)

func testDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	conn.SetMaxOpenConns(1)
	db, err := gorm.Open(sqlite.New(sqlite.Config{Conn: conn}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&Device{}, &user.User{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&user.User{ID: 1, Username: "alice"}).Error; err != nil {
		t.Fatal(err)
	}
	return db
}

func testKey(t *testing.T) (*ecdsa.PrivateKey, string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	return key, string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))
}

func signChallenge(t *testing.T, key *ecdsa.PrivateKey, encoded string) string {
	t.Helper()
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if len(raw) != 32 {
		t.Fatalf("nonce has %d bytes, want 32", len(raw))
	}
	hash := sha256.Sum256(raw)
	sig, err := ecdsa.SignASN1(rand.Reader, key, hash[:])
	if err != nil {
		t.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(sig)
}

func testTokens(t *testing.T) *JWT {
	t.Helper()
	tokens, err := NewJWT(bytes.Repeat([]byte("s"), 32), "issuer", "audience")
	if err != nil {
		t.Fatal(err)
	}
	return tokens
}

func TestVerifyChallenge(t *testing.T) {
	db := testDatabase(t)
	users := user.NewUserService(db)
	tokens := testTokens(t)
	for _, scenario := range []string{"success", "wrong key", "malformed signature", "expired", "rotated key", "unknown device"} {
		t.Run(scenario, func(t *testing.T) {
			key, public := testKey(t)
			store := NewMemoryChallengeStore()
			now := time.Now()
			store.now = func() time.Time { return now }
			service := NewService(NewSQLDeviceStore(db), store, tokens, users)
			id := strings.ReplaceAll(scenario, " ", "-")
			ctx := context.Background()
			if scenario != "unknown device" {
				if _, err := service.Register(ctx, Device{DeviceID: id, UserID: 1, PublicKeyPEM: public}); err != nil {
					t.Fatal(err)
				}
			}
			challenge, expires, err := service.Challenge(ctx, id)
			if err != nil || time.Until(expires) < 59*time.Second || time.Until(expires) > ChallengeTTL {
				t.Fatalf("challenge expiry: %v, %v", expires, err)
			}
			sig := signChallenge(t, key, challenge)
			switch scenario {
			case "wrong key":
				wrongKey, _ := testKey(t)
				sig = signChallenge(t, wrongKey, challenge)
			case "malformed signature":
				sig = "not-base64!"
			case "expired":
				now = expires
			case "rotated key":
				_, rotated := testKey(t)
				if _, err := service.Register(ctx, Device{DeviceID: id, UserID: 1, PublicKeyPEM: rotated}); err != nil {
					t.Fatal(err)
				}
			}
			token, err := service.Verify(ctx, id, sig)
			switch scenario {
			case "success":
				if err != nil {
					t.Fatal(err)
				}
				claims, err := tokens.Validate(token)
				if err != nil {
					t.Fatal(err)
				}
				if claims.Subject != "alice" || claims.DeviceID != id ||
					claims.ExpiresAt.Sub(claims.IssuedAt.Time) != TokenLifetime {
					t.Fatalf("unexpected claims: %+v", claims)
				}
				t.Setenv("JWT_SIGNING_KEY", strings.Repeat("s", 32))
				t.Setenv("JWT_ISSUER", "issuer")
				t.Setenv("JWT_AUDIENCE", "audience")
				account, err := user.NewAuthService(users).ValidateToken(token)
				if err != nil || account.ID != 1 {
					t.Fatalf("token incompatible with existing API: %v", err)
				}
			case "expired":
				if !errors.Is(err, ErrChallengeMissing) {
					t.Fatalf("expected expired challenge, got %v", err)
				}
			default:
				if !errors.Is(err, ErrUnauthorized) {
					t.Fatalf("expected authentication failure, got %v", err)
				}
			}
			if _, err := service.Verify(ctx, id, sig); !errors.Is(err, ErrChallengeMissing) {
				t.Fatalf("challenge not consumed: %v", err)
			}
		})
	}
}

func TestRegistrationOwnershipAndKeyValidation(t *testing.T) {
	db := testDatabase(t)
	service := NewService(NewSQLDeviceStore(db), NewMemoryChallengeStore(), testTokens(t), user.NewUserService(db))
	_, key := testKey(t)
	device := Device{DeviceID: "device", UserID: 1, PublicKeyPEM: key, DeviceName: "phone"}
	ctx := context.Background()
	if created, err := service.Register(ctx, device); err != nil || !created {
		t.Fatalf("create: %v, %v", created, err)
	}
	device.DeviceName = "renamed"
	if created, err := service.Register(ctx, device); err != nil || created {
		t.Fatalf("update: %v, %v", created, err)
	}
	device.UserID = 2
	if _, err := service.Register(ctx, device); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("device stolen by another user: %v", err)
	}
	persisted, err := service.devices.Find(ctx, "device")
	if err != nil || persisted.UserID != 1 || persisted.DeviceName != "renamed" {
		t.Fatalf("device not persisted correctly: %+v, %v", persisted, err)
	}
	for _, invalid := range []string{"invalid", key + "junk"} {
		device.PublicKeyPEM = invalid
		if _, err := service.Register(ctx, device); !errors.Is(err, ErrPublicKey) {
			t.Fatalf("invalid key accepted: %v", err)
		}
	}
	p384, err := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKIXPublicKey(&p384.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParsePublicKey(string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))); !errors.Is(err, ErrPublicKey) {
		t.Fatalf("P-384 accepted: %v", err)
	}
}

func TestHandlersAndRateLimits(t *testing.T) {
	db := testDatabase(t)
	service := NewService(NewSQLDeviceStore(db), NewMemoryChallengeStore(), testTokens(t), user.NewUserService(db))
	handler := NewHandler(service, slog.New(slog.NewJSONHandler(io.Discard, nil)))
	app := fiber.New()
	handler.RegisterRoutes(app, func(c fiber.Ctx) error {
		c.Locals(user.UserIDKey, uint(1))
		return c.Next()
	})
	request := func(path, body, ip string, status int) map[string]interface{} {
		t.Helper()
		req := httptest.NewRequest("POST", "/api/v1/auth"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = ip + ":1234"
		response, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		var result map[string]interface{}
		if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != status {
			t.Fatalf("%s got %d: %+v, want %d", path, response.StatusCode, result, status)
		}
		return result
	}
	key, public := testKey(t)
	body, err := json.Marshal(deviceRequest{DeviceID: "phone", DeviceName: "Android", PublicKeyPEM: public})
	if err != nil {
		t.Fatal(err)
	}
	request("/register-device", string(body), "192.0.2.1", 201)
	request("/register-device", string(body), "192.0.2.1", 200)
	challenge := request("/challenge", `{"device_id":"phone"}`, "192.0.2.1", 200)
	if _, err := time.Parse(time.RFC3339, challenge["expires_at"].(string)); err != nil {
		t.Fatal(err)
	}
	sig := signChallenge(t, key, challenge["challenge"].(string))
	verifyBody := `{"device_id":"phone","signature_b64":"` + sig + `"}`
	verified := request("/verify-challenge", verifyBody, "192.0.2.1", 200)
	if verified["expires_in"] != float64(900) || verified["access_token"] == "" {
		t.Fatalf("unexpected token response: %+v", verified)
	}
	request("/verify-challenge", verifyBody, "192.0.2.1", 410)

	// Different device IDs cannot bypass the IP limit.
	for i := 0; i < 4; i++ {
		request("/challenge", `{"device_id":"other"}`, "192.0.2.1", 200)
	}
	request("/challenge", `{"device_id":"new"}`, "192.0.2.1", 429)
}

func TestRateLimitsByIPAndDevice(t *testing.T) {
	db := testDatabase(t)
	for _, path := range []string{"/challenge", "/verify-challenge"} {
		for _, scope := range []string{"ip", "device"} {
			t.Run(path+"/"+scope, func(t *testing.T) {
				service := NewService(NewSQLDeviceStore(db), NewMemoryChallengeStore(), testTokens(t), user.NewUserService(db))
				// Only the test app trusts this header, to simulate separate peers.
				app := fiber.New(fiber.Config{ProxyHeader: "X-Forwarded-For"})
				handler := NewHandler(service, slog.New(slog.NewJSONHandler(io.Discard, nil)))
				handler.RegisterRoutes(app, func(c fiber.Ctx) error { return c.Next() })
				for i := 0; i < 6; i++ {
					id, ip := "device", "192.0.2.1"
					if scope == "ip" {
						id += string(rune('a' + i))
					} else {
						ip = "192.0.2." + string(rune('1'+i))
					}
					req := httptest.NewRequest("POST", "/api/v1/auth"+path, strings.NewReader(`{"device_id":"`+id+`"}`))
					req.Header.Set("Content-Type", "application/json")
					req.Header.Set("X-Forwarded-For", ip)
					response, err := app.Test(req)
					if err != nil {
						t.Fatal(err)
					}
					response.Body.Close()
					expected := 200
					if path == "/verify-challenge" {
						expected = 410
					}
					if i == 5 {
						expected = 429
					}
					if response.StatusCode != expected {
						t.Fatalf("attempt %d got %d, want %d", i+1, response.StatusCode, expected)
					}
				}
			})
		}
	}
}

func TestChallengeBackendSelection(t *testing.T) {
	db := testDatabase(t)
	t.Setenv("JWT_SIGNING_KEY", strings.Repeat("s", 32))
	log := slog.New(slog.NewJSONHandler(io.Discard, nil))
	users := user.NewUserService(db)
	for _, mode := range []string{"unset", "available", "unavailable"} {
		t.Run(mode, func(t *testing.T) {
			url := ""
			var server *miniredis.Miniredis
			if mode != "unset" {
				server = miniredis.RunT(t)
				url = "redis://" + server.Addr()
				if mode == "unavailable" {
					server.SetError("backend unavailable")
				}
			}
			t.Setenv("REDIS_URL", url)
			handler, _, closeStore, err := NewFromEnvironment(db, users, log)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				if err := closeStore(); err != nil {
					t.Error(err)
				}
			})
			if mode == "available" {
				if _, ok := handler.service.challenges.(*RedisChallengeStore); !ok {
					t.Fatal("expected Redis backend")
				}
				server.SetError("backend unavailable")
				if _, _, err := handler.service.Challenge(context.Background(), "device"); err == nil {
					t.Fatal("runtime Redis failure did not fail closed")
				}
			} else if _, ok := handler.service.challenges.(*MemoryChallengeStore); !ok {
				t.Fatal("expected memory fallback")
			}
		})
	}
}

func TestJWTValidation(t *testing.T) {
	tokens := testTokens(t)
	now := time.Now()
	for _, scenario := range []string{"valid", "expired", "missing expiry", "wrong issuer", "wrong algorithm", "wrong key"} {
		t.Run(scenario, func(t *testing.T) {
			claims := jwt.RegisteredClaims{
				Subject: "alice", Issuer: "issuer", Audience: jwt.ClaimStrings{"audience"},
				IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(time.Minute)),
			}

			method := jwt.SigningMethodHS256
			key := bytes.Repeat([]byte("s"), 32)
			switch scenario {
			case "expired":
				claims.ExpiresAt = jwt.NewNumericDate(now.Add(-time.Minute))
			case "missing expiry":
				claims.ExpiresAt = nil
			case "wrong issuer":
				claims.Issuer = "other"
			case "wrong algorithm":
				method = jwt.SigningMethodHS384
			case "wrong key":
				key = bytes.Repeat([]byte("x"), 32)
			}
			raw, err := jwt.NewWithClaims(method, claims).SignedString(key)
			if err != nil {
				t.Fatal(err)
			}
			_, err = tokens.Validate(raw)
			if (err == nil) != (scenario == "valid") {
				t.Fatalf("validation: %v", err)
			}
		})
	}
}
