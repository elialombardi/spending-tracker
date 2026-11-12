package auth

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestChallengeStores(t *testing.T) {
	for _, backend := range []string{"memory", "redis"} {
		t.Run(backend, func(t *testing.T) {
			now := time.Now()
			var store ChallengeStore
			var expire func()
			if backend == "memory" {
				memory := NewMemoryChallengeStore()
				memory.now = func() time.Time { return now }
				store = memory
				expire = func() { now = now.Add(ChallengeTTL) }
			} else {
				server := miniredis.RunT(t)
				client := redis.NewClient(&redis.Options{Addr: server.Addr()})
				t.Cleanup(func() { client.Close() })
				store = NewRedisChallengeStore(client)
				expire = func() { server.FastForward(ChallengeTTL) }
			}
			ctx := context.Background()
			put := func(id string, nonce byte) {
				t.Helper()
				err := store.Put(ctx, id, Challenge{Nonce: []byte{nonce}, ExpiresAt: now.Add(ChallengeTTL)})
				if err != nil {
					t.Fatal(err)
				}
			}
			put("device", 1)
			put("device", 2)
			value, err := store.Consume(ctx, "device")
			if err != nil || len(value.Nonce) != 1 || value.Nonce[0] != 2 {
				t.Fatalf("replacement challenge: %+v, %v", value, err)
			}
			if _, err := store.Consume(ctx, "device"); !errors.Is(err, ErrChallengeMissing) {
				t.Fatalf("replayed challenge: %v", err)
			}
			put("concurrent", 3)
			var successes atomic.Int32
			var wg sync.WaitGroup
			for i := 0; i < 20; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					if _, err := store.Consume(ctx, "concurrent"); err == nil {
						successes.Add(1)
					} else if !errors.Is(err, ErrChallengeMissing) {
						t.Errorf("consume: %v", err)
					}
				}()
			}
			wg.Wait()
			if successes.Load() != 1 {
				t.Fatalf("concurrent successes = %d, want 1", successes.Load())
			}
			put("expired", 4)
			expire()
			if _, err := store.Consume(ctx, "expired"); !errors.Is(err, ErrChallengeMissing) {
				t.Fatalf("expired challenge: %v", err)
			}
		})
	}
}

func TestRedisErrorsDoNotProduceChallenges(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
	t.Cleanup(func() { client.Close() })
	store := NewRedisChallengeStore(client)
	server.SetError("backend unavailable")
	if err := store.Put(context.Background(), "device", Challenge{ExpiresAt: time.Now().Add(ChallengeTTL)}); err == nil {
		t.Fatal("expected write error")
	}
	if _, err := store.Consume(context.Background(), "device"); err == nil || errors.Is(err, ErrChallengeMissing) {
		t.Fatalf("backend failure incorrectly treated as missing: %v", err)
	}
}
