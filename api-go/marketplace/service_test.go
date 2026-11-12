package marketplace

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
)

type providerFunc func(context.Context, string, int64) ([]Listing, error)

func (f providerFunc) Search(ctx context.Context, keywords string, maximum int64) ([]Listing, error) {
	return f(ctx, keywords, maximum)
}

type notifierFunc func(context.Context, string) error

func (f notifierFunc) Send(ctx context.Context, text string) error { return f(ctx, text) }

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	conn.SetMaxOpenConns(1)
	db, err := gorm.Open(sqlite.New(sqlite.Config{Conn: conn}), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err := db.AutoMigrate(&Search{}, &Match{}); err != nil {
			t.Fatal(err)
		}
	}
	return db
}

func input() SearchInput {
	return SearchInput{Keywords: " bicycle ", Marketplaces: []string{"ebay"}, MaxPriceCents: 10000}
}

func save(t *testing.T, s *Service, owner uint) Search {
	t.Helper()
	result, err := s.Save(context.Background(), owner, 0, input())
	if err != nil {
		t.Fatal(err)
	}
	return *result
}

func due(t *testing.T, db *gorm.DB, id uint) {
	t.Helper()
	if err := db.Model(&Search{}).Where("id = ?", id).Update("next_check_at", time.Now().Add(-time.Hour)).Error; err != nil {
		t.Fatal(err)
	}
}

func listing(id string, price int64) Listing {
	return Listing{ID: id, Title: "Bicycle", URL: "https://www.ebay.it/itm/" + id, PriceCents: price, Currency: "EUR"}
}

func TestDailyStrictThresholdDeduplicationAndPersistence(t *testing.T) {
	db := testDB(t)
	var messages []string
	calls := 0
	provider := providerFunc(func(_ context.Context, keywords string, maximum int64) ([]Listing, error) {
		calls++
		if keywords != "bicycle" || maximum != 10000 {
			t.Fatalf("unexpected query %q / %d", keywords, maximum)
		}
		foreign := listing("foreign", 100)
		foreign.Currency = "USD"
		return []Listing{listing("below", 9999), listing("equal", 10000), listing("above", 10001),
			listing("negative", -1), foreign, listing("below", 9999)}, nil
	})
	notifier := notifierFunc(func(_ context.Context, text string) error {
		messages = append(messages, text)
		return nil
	})
	service := NewService(db, provider, notifier)
	search := save(t, service, 1)
	if err := service.RunDaily(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(messages) != 1 || !strings.Contains(messages[0], "EUR 99.99") ||
		!strings.Contains(messages[0], "https://www.ebay.it/itm/below") {
		t.Fatalf("unexpected notifications: %v", messages)
	}
	matches, err := service.Matches(context.Background(), 1, search.ID)
	if err != nil || len(matches) != 1 || matches[0].NotifiedAt == nil {
		t.Fatalf("matches = %+v, error = %v", matches, err)
	}
	searches, err := service.List(context.Background(), 1)
	if err != nil || len(searches) != 1 || searches[0].LastCheckedAt == nil || searches[0].LastError != "" {
		t.Fatalf("searches = %+v, error = %v", searches, err)
	}
	if searches[0].NextCheckAt.UTC().Hour() != 0 || !searches[0].NextCheckAt.After(time.Now()) {
		t.Fatalf("next daily check = %v", searches[0].NextCheckAt)
	}
	service = NewService(db, provider, notifier)
	if err := service.RunDaily(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("restart repeated today's search: %d calls", calls)
	}
	due(t, db, search.ID)
	if err := service.RunDaily(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls != 2 || len(messages) != 1 {
		t.Fatalf("persistent deduplication failed: %d calls / %v", calls, messages)
	}
}

func TestFailedNotificationRetriesOnlyCurrentQualifyingListings(t *testing.T) {
	db := testDB(t)
	price := int64(9000)
	fail := true
	sends := 0
	s := NewService(db, providerFunc(func(context.Context, string, int64) ([]Listing, error) {
		return []Listing{listing("retry", price)}, nil
	}), notifierFunc(func(_ context.Context, message string) error {
		sends++
		if fail {
			return errors.New("Telegram unavailable")
		}
		if !strings.Contains(message, "EUR 80.00") {
			t.Fatalf("notification used stale price: %s", message)
		}
		return nil
	}))
	search := save(t, s, 1)
	if err := s.RunDaily(context.Background()); err == nil {
		t.Fatal("notification failure was hidden")
	}
	rows, _ := s.List(context.Background(), 1)
	if !strings.Contains(rows[0].LastError, "Telegram unavailable") || rows[0].LockedUntil != nil {
		t.Fatalf("failure status not persisted: %+v", rows)
	}
	matches, err := s.Matches(context.Background(), 1, search.ID)
	if err != nil || len(matches) != 1 || matches[0].NotifiedAt != nil {
		t.Fatalf("failed notification marked sent: %+v / %v", matches, err)
	}
	price = 10000
	fail = false
	due(t, db, search.ID)
	if err := s.RunDaily(context.Background()); err != nil {
		t.Fatal(err)
	}
	if sends != 1 {
		t.Fatal("sent stale pending notification for a listing no longer below maximum")
	}
	price = 8000
	due(t, db, search.ID)
	if err := s.RunDaily(context.Background()); err != nil {
		t.Fatal(err)
	}
	matches, err = s.Matches(context.Background(), 1, search.ID)
	if err != nil || sends != 2 || matches[0].NotifiedAt == nil || matches[0].PriceCents != 8000 {
		t.Fatalf("retry failed: sends=%d, matches=%+v, error=%v", sends, matches, err)
	}
}

func TestOwnershipUpdatesPauseAndDelete(t *testing.T) {
	db := testDB(t)
	s := NewService(db, nil, nil)
	search := save(t, s, 1)
	other := save(t, s, 2)
	if rows, err := s.List(context.Background(), 2); err != nil || len(rows) != 1 || rows[0].ID != other.ID {
		t.Fatalf("list leaked another user's search: %+v / %v", rows, err)
	}
	if _, err := s.Save(context.Background(), 2, search.ID, input()); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("cross-user update = %v", err)
	}
	if err := s.Delete(context.Background(), 2, search.ID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("cross-user delete = %v", err)
	}
	if _, err := s.Matches(context.Background(), 2, search.ID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("cross-user matches = %v", err)
	}
	match := Match{SearchID: search.ID, Marketplace: "ebay", ItemID: "test"}
	if err := db.Create(&match).Error; err != nil {
		t.Fatal(err)
	}
	update := input()
	update.Keywords = "New keywords"
	disabled := false
	update.Enabled = &disabled
	updated, err := s.Save(context.Background(), 1, search.ID, update)
	if err != nil || updated.Enabled || updated.Keywords != "New keywords" {
		t.Fatalf("update = %+v / %v", updated, err)
	}
	matches, err := s.Matches(context.Background(), 1, search.ID)
	if err != nil || len(matches) != 0 {
		t.Fatalf("criteria change did not reset history: %+v / %v", matches, err)
	}
	if err := db.Model(&Search{}).Where("id = ?", other.ID).Update("enabled", false).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.RunDaily(context.Background()); err != nil {
		t.Fatalf("paused searches ran: %v", err)
	}
	match.ID = 0
	if err := db.Create(&match).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(context.Background(), 1, search.ID); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := db.Model(&Match{}).Where("search_id = ?", search.ID).Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("orphaned matches: %d / %v", count, err)
	}
}

func TestWorkerClaimPreventsConcurrentChecksAndEdits(t *testing.T) {
	db := testDB(t)
	entered, release := make(chan struct{}), make(chan struct{})
	s := NewService(db, providerFunc(func(ctx context.Context, _ string, _ int64) ([]Listing, error) {
		close(entered)
		select {
		case <-release:
			return nil, nil
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}), notifierFunc(func(context.Context, string) error { return nil }))
	search := save(t, s, 1)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- s.RunDaily(ctx) }()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("worker did not start")
	}
	if err := s.RunDaily(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Save(context.Background(), 1, search.ID, input()); !errors.Is(err, ErrBusy) {
		t.Fatalf("concurrent edit = %v", err)
	}
	if err := s.Delete(context.Background(), 1, search.ID); !errors.Is(err, ErrBusy) {
		t.Fatalf("concurrent delete = %v", err)
	}
	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestMissingConfigurationAndProviderErrorsArePersisted(t *testing.T) {
	for _, test := range []struct {
		name     string
		provider Provider
		notifier Notifier
		want     string
	}{
		{"missing eBay", nil, nil, "eBay is not configured"},
		{"missing Telegram", providerFunc(func(context.Context, string, int64) ([]Listing, error) {
			t.Fatal("provider called without Telegram")
			return nil, nil
		}), nil, "Telegram is not configured"},
		{"provider failure", providerFunc(func(context.Context, string, int64) ([]Listing, error) {
			return nil, errors.New("provider unavailable")
		}), notifierFunc(func(context.Context, string) error { return nil }), "provider unavailable"},
	} {
		t.Run(test.name, func(t *testing.T) {
			s := NewService(testDB(t), test.provider, test.notifier)
			save(t, s, 1)
			if err := s.RunDaily(context.Background()); err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("error = %v", err)
			}
			rows, err := s.List(context.Background(), 1)
			if err != nil || len(rows) != 1 || !strings.Contains(rows[0].LastError, test.want) ||
				rows[0].LastCheckedAt == nil || rows[0].LockedUntil != nil {
				t.Fatalf("failure status = %+v / %v", rows, err)
			}
		})
	}
}

func TestSchedulerCancellationDrainsAndPersistsFailure(t *testing.T) {
	db := testDB(t)
	entered := make(chan struct{})
	service := NewService(db, providerFunc(func(ctx context.Context, _ string, _ int64) ([]Listing, error) {
		close(entered)
		<-ctx.Done()
		return nil, ctx.Err()
	}), notifierFunc(func(context.Context, string) error { return nil }))
	save(t, service, 1)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := service.StartBackgroundSync(ctx)
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("scheduler did not run immediately")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("scheduler did not drain after cancellation")
	}
	searches, err := service.List(context.Background(), 1)
	if err != nil || len(searches) != 1 || !strings.Contains(searches[0].LastError, "context canceled") ||
		searches[0].LockedUntil != nil || searches[0].LastCheckedAt == nil {
		t.Fatalf("cancellation status = %+v / %v", searches, err)
	}
}

func TestFailedSearchDoesNotPreventOtherSearches(t *testing.T) {
	db := testDB(t)
	sends := 0
	service := NewService(db, providerFunc(func(_ context.Context, keywords string, _ int64) ([]Listing, error) {
		if keywords == "bicycle" {
			return nil, errors.New("first search failed")
		}
		return []Listing{listing("working", 100)}, nil
	}), notifierFunc(func(context.Context, string) error {
		sends++
		return nil
	}))
	save(t, service, 1)
	second := input()
	second.Keywords = "helmet"
	if _, err := service.Save(context.Background(), 1, 0, second); err != nil {
		t.Fatal(err)
	}
	if err := service.RunDaily(context.Background()); err == nil || !strings.Contains(err.Error(), "first search failed") {
		t.Fatalf("failure was hidden: %v", err)
	}
	if sends != 1 {
		t.Fatalf("failed search blocked healthy search: %d messages", sends)
	}
}

func TestInputValidation(t *testing.T) {
	for _, mutate := range []func(*SearchInput){
		func(i *SearchInput) { i.Keywords = " " },
		func(i *SearchInput) { i.Keywords = strings.Repeat("x", 101) },
		func(i *SearchInput) { i.Marketplaces = nil },
		func(i *SearchInput) { i.Marketplaces = []string{"facebook"} },
		func(i *SearchInput) { i.Marketplaces = []string{"subito"} },
		func(i *SearchInput) { i.Marketplaces = []string{"ebay", "ebay"} },
		func(i *SearchInput) { i.MaxPriceCents = 0 },
		func(i *SearchInput) { i.MaxPriceCents = -1 },
		func(i *SearchInput) { i.MaxPriceCents = 9007199254740992 },
	} {
		i := input()
		mutate(&i)
		if err := validateInput(&i); err == nil {
			t.Fatalf("accepted invalid input %+v", i)
		}
	}
}
