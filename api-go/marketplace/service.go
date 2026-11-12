package marketplace

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/jobs"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Provider interface {
	Search(context.Context, string, int64) ([]Listing, error)
}

type Notifier interface {
	Send(context.Context, string) error
}

var ErrBusy = errors.New("this search is being checked; try again shortly")

type Service struct {
	db       *gorm.DB
	provider Provider
	notifier Notifier
}

func NewService(db *gorm.DB, provider Provider, notifier Notifier) *Service {
	return &Service{db: db, provider: provider, notifier: notifier}
}

func validateInput(input *SearchInput) error {
	input.Keywords = strings.TrimSpace(input.Keywords)
	if input.Keywords == "" || utf8.RuneCountInString(input.Keywords) > 100 {
		return errors.New("keywords must contain 1-100 characters")
	}
	// Integer cents keep the strict threshold exact, including at the boundary.
	if input.MaxPriceCents <= 0 || input.MaxPriceCents > 9007199254740991 {
		return errors.New("maxPriceCents must be a positive safe integer")
	}
	if len(input.Marketplaces) != 1 || input.Marketplaces[0] != "ebay" {
		return errors.New("select eBay; Facebook Marketplace and Subito.it are not connected yet")
	}
	return nil
}

func (s *Service) List(ctx context.Context, userID uint) ([]Search, error) {
	searches := make([]Search, 0)
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC, id DESC").Find(&searches).Error
	return searches, err
}

func (s *Service) Save(ctx context.Context, userID, id uint, input SearchInput) (*Search, error) {
	if err := validateInput(&input); err != nil {
		return nil, err
	}
	var result Search
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if id == 0 {
			result = Search{UserID: userID, Enabled: true}
		} else if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", id, userID).First(&result).Error; err != nil {
			return err
		}
		if result.LockedUntil != nil && result.LockedUntil.After(time.Now()) {
			return ErrBusy
		}
		criteriaChanged := result.Keywords != input.Keywords || result.MaxPriceCents != input.MaxPriceCents
		result.Keywords, result.MaxPriceCents, result.Marketplaces = input.Keywords, input.MaxPriceCents, input.Marketplaces
		if input.Enabled != nil {
			result.Enabled = *input.Enabled
		}
		result.Revision++
		result.NextCheckAt = time.Now()
		result.LastError = ""
		if criteriaChanged {
			result.LastCheckedAt = nil
			if id != 0 {
				if err := tx.Where("search_id = ?", id).Delete(&Match{}).Error; err != nil {
					return err
				}
			}
		}
		return tx.Save(&result).Error
	})
	return &result, err
}

func (s *Service) Delete(ctx context.Context, userID, id uint) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var search Search
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", id, userID).First(&search).Error; err != nil {
			return err
		}
		if search.LockedUntil != nil && search.LockedUntil.After(time.Now()) {
			return ErrBusy
		}
		if err := tx.Where("search_id = ?", id).Delete(&Match{}).Error; err != nil {
			return err
		}
		return tx.Delete(&search).Error
	})
}

func (s *Service) Matches(ctx context.Context, userID, id uint) ([]Match, error) {
	var search Search
	if err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).First(&search).Error; err != nil {
		return nil, err
	}
	matches := make([]Match, 0)
	err := s.db.WithContext(ctx).Where("search_id = ?", id).Order("created_at DESC, id DESC").Limit(50).Find(&matches).Error
	return matches, err
}

func (s *Service) StartBackgroundSync(ctx context.Context) <-chan struct{} {
	return jobs.Start(ctx, 24*time.Hour, func(ctx context.Context) {
		if err := s.RunDaily(ctx); err != nil {
			log.Printf("Marketplace daily search: %v", err)
		}
	})
}

func (s *Service) RunDaily(ctx context.Context) error {
	var searches []Search
	now := time.Now()
	if err := s.db.WithContext(ctx).Where("enabled = ? AND next_check_at <= ? AND (locked_until IS NULL OR locked_until < ?)", true, now, now).
		Order("id").Find(&searches).Error; err != nil {
		return err
	}
	var failures []error
	for _, search := range searches {
		if ctx.Err() != nil {
			return errors.Join(append(failures, ctx.Err())...)
		}
		lease := time.Now().Add(3 * time.Minute)
		claim := s.db.WithContext(ctx).Model(&Search{}).
			Where("id = ? AND revision = ? AND enabled = ? AND next_check_at <= ? AND (locked_until IS NULL OR locked_until < ?)",
				search.ID, search.Revision, true, time.Now(), time.Now()).
			Update("locked_until", lease)
		if claim.Error != nil {
			failures = append(failures, claim.Error)
			continue
		}
		if claim.RowsAffected == 0 {
			continue
		}
		checkCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		checkErr := s.check(checkCtx, search)
		cancel()
		finished := time.Now()
		nextDay := now.UTC().Truncate(24 * time.Hour).Add(24 * time.Hour)
		message := ""
		if checkErr != nil {
			message = checkErr.Error()
			failures = append(failures, fmt.Errorf("search %d: %w", search.ID, checkErr))
		}
		// Record cancellation too, before the application closes the database.
		persistCtx, stop := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		err := s.db.WithContext(persistCtx).Model(&Search{}).Where("id = ? AND revision = ? AND locked_until = ?", search.ID, search.Revision, lease).
			Updates(map[string]any{"last_checked_at": finished, "last_error": message,
				"locked_until": nil, "next_check_at": nextDay}).Error
		stop()
		if err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}

func (s *Service) check(ctx context.Context, search Search) error {
	if s.provider == nil {
		return errors.New("eBay is not configured; set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET")
	}
	if s.notifier == nil {
		return errors.New("Telegram is not configured; set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID")
	}
	listings, err := s.provider.Search(ctx, search.Keywords, search.MaxPriceCents)
	if err != nil {
		return err
	}
	for _, listing := range listings {
		if listing.Currency != "EUR" || listing.PriceCents < 0 || listing.PriceCents >= search.MaxPriceCents {
			continue
		}
		if listing.ID == "" || strings.TrimSpace(listing.Title) == "" || !validEbayURL(listing.URL) {
			return errors.New("eBay returned a listing with missing details or an invalid URL")
		}
		match := Match{SearchID: search.ID, Marketplace: "ebay", ItemID: listing.ID, Title: listing.Title,
			URL: listing.URL, PriceCents: listing.PriceCents}
		if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&match).Error; err != nil {
			return err
		}
		var saved Match
		if err := s.db.WithContext(ctx).Where("search_id = ? AND marketplace = ? AND item_id = ?", search.ID, "ebay", listing.ID).
			First(&saved).Error; err != nil {
			return err
		}
		if saved.NotifiedAt != nil {
			continue
		}
		if err := s.db.WithContext(ctx).Model(&saved).Updates(map[string]any{
			"title": listing.Title, "url": listing.URL, "price_cents": listing.PriceCents,
		}).Error; err != nil {
			return err
		}
		text := fmt.Sprintf("Marketplace search: %s\n%s\nEUR %s (maximum EUR %s, item price only)\neBay\n%s",
			search.Keywords, truncateTitle(listing.Title), euroAmount(listing.PriceCents), euroAmount(search.MaxPriceCents), listing.URL)
		if err := s.notifier.Send(ctx, text); err != nil {
			return fmt.Errorf("send Telegram notification: %w", err)
		}
		if err := s.db.WithContext(ctx).Model(&Match{}).Where("id = ?", saved.ID).Update("notified_at", time.Now()).Error; err != nil {
			return err
		}
	}
	return nil
}

func validEbayURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || len(raw) > 2048 {
		return false
	}
	host := strings.ToLower(u.Hostname())
	return host == "ebay.it" || strings.HasSuffix(host, ".ebay.it") || host == "ebay.com" || strings.HasSuffix(host, ".ebay.com")
}

func truncateTitle(title string) string {
	runes := []rune(title)
	if len(runes) > 300 {
		return string(runes[:300]) + "..."
	}
	return title
}
