package auth

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrChallengeMissing = errors.New("challenge missing or expired")
	ErrUnauthorized     = errors.New("authentication failed")
)

const ChallengeTTL = 60 * time.Second

type Challenge struct {
	Nonce     []byte    `json:"nonce"`
	KeyHash   [32]byte  `json:"key_hash"`
	UserID    uint      `json:"user_id"`
	ExpiresAt time.Time `json:"expires_at"`
}

type ChallengeStore interface {
	Put(context.Context, string, Challenge) error
	Consume(context.Context, string) (Challenge, error)
}

type MemoryChallengeStore struct {
	mu    sync.RWMutex
	items map[string]Challenge
	now   func() time.Time
}

func NewMemoryChallengeStore() *MemoryChallengeStore {
	return &MemoryChallengeStore{items: make(map[string]Challenge), now: time.Now}
}

func (s *MemoryChallengeStore) Put(ctx context.Context, id string, value Challenge) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	for key, item := range s.items {
		if !now.Before(item.ExpiresAt) {
			delete(s.items, key)
		}
	}
	value.Nonce = append([]byte(nil), value.Nonce...)
	s.items[id] = value
	return nil
}

func (s *MemoryChallengeStore) Consume(ctx context.Context, id string) (Challenge, error) {
	if err := ctx.Err(); err != nil {
		return Challenge{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	value, ok := s.items[id]
	delete(s.items, id)
	if !ok || !s.now().Before(value.ExpiresAt) {
		return Challenge{}, ErrChallengeMissing
	}
	return value, nil
}

type RedisChallengeStore struct {
	client *redis.Client
}

func NewRedisChallengeStore(client *redis.Client) *RedisChallengeStore {
	return &RedisChallengeStore{client: client}
}

func (s *RedisChallengeStore) Put(ctx context.Context, id string, value Challenge) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	ttl := time.Until(value.ExpiresAt)
	if ttl <= 0 {
		return ErrChallengeMissing
	}
	return s.client.Set(ctx, "auth:challenge:"+id, data, ttl).Err()
}

func (s *RedisChallengeStore) Consume(ctx context.Context, id string) (Challenge, error) {
	data, err := s.client.GetDel(ctx, "auth:challenge:"+id).Bytes()
	if errors.Is(err, redis.Nil) {
		return Challenge{}, ErrChallengeMissing
	}
	if err != nil {
		return Challenge{}, err
	}
	var value Challenge
	if err := json.Unmarshal(data, &value); err != nil {
		return Challenge{}, err
	}
	if !time.Now().Before(value.ExpiresAt) {
		return Challenge{}, ErrChallengeMissing
	}
	return value, nil
}

type Device struct {
	DeviceID     string `gorm:"primaryKey;size:128"`
	UserID       uint   `gorm:"not null;index"`
	PublicKeyPEM string `gorm:"not null"`
	DeviceName   string `gorm:"size:200;not null"`
}

type DeviceStore interface {
	Find(context.Context, string) (Device, error)
	Upsert(context.Context, Device) (bool, error)
	List(context.Context, uint) ([]Device, error)
	Rename(context.Context, uint, string, string) error
	Delete(context.Context, uint, string) error
}

type SQLDeviceStore struct {
	db *gorm.DB
}

func NewSQLDeviceStore(db *gorm.DB) *SQLDeviceStore {
	return &SQLDeviceStore{db: db}
}

func (s *SQLDeviceStore) Find(ctx context.Context, id string) (Device, error) {
	var device Device
	err := s.db.WithContext(ctx).Where("device_id = ?", id).First(&device).Error
	return device, err
}

func (s *SQLDeviceStore) List(ctx context.Context, userID uint) ([]Device, error) {
	devices := make([]Device, 0)
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).
		Order("device_name ASC").Order("device_id ASC").Find(&devices).Error
	return devices, err
}

func (s *SQLDeviceStore) Rename(ctx context.Context, userID uint, id, name string) error {
	result := s.db.WithContext(ctx).Model(&Device{}).
		Where("user_id = ? AND device_id = ?", userID, id).
		Update("device_name", name)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *SQLDeviceStore) Delete(ctx context.Context, userID uint, id string) error {
	result := s.db.WithContext(ctx).Where("user_id = ? AND device_id = ?", userID, id).Delete(&Device{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *SQLDeviceStore) Upsert(ctx context.Context, device Device) (bool, error) {
	created := false
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&device)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 1 {
			created = true
			return nil
		}
		result = tx.Model(&Device{}).
			Where("device_id = ? AND user_id = ?", device.DeviceID, device.UserID).
			Updates(map[string]interface{}{
				"public_key_pem": device.PublicKeyPEM,
				"device_name":    device.DeviceName,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrUnauthorized
		}
		return nil
	})
	return created, err
}
