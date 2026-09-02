package boxing_events

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"gorm.io/gorm"
)

type Service interface {
	List(ctx context.Context, userID uint, filter Filter) ([]EventResponse, int64, error)
	Get(ctx context.Context, id, userID uint) (*EventResponse, error)
	Create(ctx context.Context, userID uint, req CreateEventRequest) (*EventResponse, error)
	Update(ctx context.Context, id, userID uint, req UpdateEventRequest) (*EventResponse, error)
	Delete(ctx context.Context, id, userID uint) error
	Export(ctx context.Context, userID uint, filter Filter, format string) ([]byte, string, error) // returns data, filename, error
	SyncFromPinnacle(ctx context.Context) (int, error)
	StartBackgroundSync(stopCh <-chan struct{})
}

type Filter struct {
	Title     string
	Location  string
	StartFrom *time.Time
	StartTo   *time.Time
	Status    string // "upcoming" or "past"
	Page      int
	Limit     int
}

type service struct {
	db             *gorm.DB
	pinnacleClient *PinnacleClient
}

func NewService(db *gorm.DB, pinnacleClient *PinnacleClient) Service {
	return &service{db: db, pinnacleClient: pinnacleClient}
}

func (s *service) List(ctx context.Context, userID uint, filter Filter) ([]EventResponse, int64, error) {
	query := s.db.WithContext(ctx).Model(&BoxingEvent{})

	if filter.Title != "" {
		query = query.Where("title LIKE ?", "%"+filter.Title+"%")
	}
	if filter.Location != "" {
		query = query.Where("location LIKE ?", "%"+filter.Location+"%")
	}
	if filter.StartFrom != nil {
		query = query.Where("start_date >= ?", filter.StartFrom)
	}
	if filter.StartTo != nil {
		query = query.Where("start_date <= ?", filter.StartTo)
	}
	now := time.Now()
	switch filter.Status {
	case "upcoming":
		query = query.Where("start_date > ?", now)
	case "past":
		query = query.Where("start_date <= ?", now)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	limit := filter.Limit
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	var events []BoxingEvent
	if err := query.Offset(offset).Limit(limit).Order("start_date ASC").Find(&events).Error; err != nil {
		return nil, 0, err
	}

	responses := make([]EventResponse, len(events))
	for i, e := range events {
		responses[i] = toResponse(e)
	}
	return responses, total, nil
}

func (s *service) Get(ctx context.Context, id, userID uint) (*EventResponse, error) {
	var event BoxingEvent
	if err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).First(&event).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	res := toResponse(event)
	return &res, nil
}

func (s *service) Create(ctx context.Context, userID uint, req CreateEventRequest) (*EventResponse, error) {
	event := BoxingEvent{
		UserID:      userID,
		Title:       req.Title,
		StartDate:   req.StartDate,
		EndDate:     req.EndDate,
		Location:    req.Location,
		Description: req.Description,
	}
	if err := s.db.WithContext(ctx).Create(&event).Error; err != nil {
		return nil, err
	}
	res := toResponse(event)
	return &res, nil
}

func (s *service) Update(ctx context.Context, id, userID uint, req UpdateEventRequest) (*EventResponse, error) {
	var event BoxingEvent
	if err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).First(&event).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	updates := map[string]interface{}{}
	if req.Title != nil {
		updates["title"] = *req.Title
	}
	if req.StartDate != nil {
		updates["start_date"] = *req.StartDate
	}
	if req.EndDate != nil {
		updates["end_date"] = req.EndDate
	}
	if req.Location != nil {
		updates["location"] = *req.Location
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(&event).Updates(updates).Error; err != nil {
			return nil, err
		}
		// reload
		if err := s.db.WithContext(ctx).First(&event, id).Error; err != nil {
			return nil, err
		}
	}

	res := toResponse(event)
	return &res, nil
}

func (s *service) Delete(ctx context.Context, id, userID uint) error {
	result := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).Delete(&BoxingEvent{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return nil // not found but idempotent
	}
	return nil
}

func (s *service) Export(ctx context.Context, userID uint, filter Filter, format string) ([]byte, string, error) {
	// ignore pagination, fetch all matching events
	filter.Page = 0
	filter.Limit = 0
	events, _, err := s.List(ctx, userID, filter)
	if err != nil {
		return nil, "", err
	}

	if format == "ics" {
		// Generate iCalendar file
		content, err := generateICS(events)
		if err != nil {
			return nil, "", err
		}
		return content, "boxing_events.ics", nil
	}

	// default CSV
	content, err := generateCSV(events)
	if err != nil {
		return nil, "", err
	}
	return content, "boxing_events.csv", nil
}

func (s *service) SyncFromPinnacle(ctx context.Context) (int, error) {
	events, err := s.pinnacleClient.FetchPrematchBoxingEvents()
	if err != nil {
		return 0, err
	}

	var created, updated int
	for _, pe := range events {
		startDate, err := time.Parse(time.RFC3339, pe.Starts)
		if err != nil {
			// log and skip
			continue
		}

		// Build our model
		event := BoxingEvent{
			Title:       fmt.Sprintf("%s vs %s", pe.Home, pe.Away),
			StartDate:   startDate,
			EndDate:     nil, // Pinnacle doesn't provide end date
			Location:    pe.LeagueName,
			Description: fmt.Sprintf("League: %s", pe.LeagueName),
			ExternalID:  fmt.Sprintf("%d", pe.EventID),
			Source:      "pinnacle",
			UserID:      0, // system user (shared)
		}

		// Upsert by ExternalID
		var existing BoxingEvent
		result := s.db.WithContext(ctx).
			Where("external_id = ? AND source = ?", event.ExternalID, "pinnacle").
			First(&existing)

		if result.Error == nil {
			// Update existing
			existing.Title = event.Title
			existing.StartDate = event.StartDate
			existing.Location = event.Location
			existing.Description = event.Description
			// (we keep EndDate as nil)
			if err := s.db.WithContext(ctx).Save(&existing).Error; err != nil {
				return 0, err
			}
			updated++
		} else if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// Create new
			if err := s.db.WithContext(ctx).Create(&event).Error; err != nil {
				return 0, err
			}
			created++
		} else {
			return 0, result.Error
		}
	}

	return created + updated, nil
}

func (s *service) StartBackgroundSync(stopCh <-chan struct{}) {
	go func() {
		// Run immediately on start
		runSync(s)

		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				runSync(s)
			case <-stopCh:
				log.Println("Background sync stopped")
				return
			}
		}
	}()
}

// Separate function for the actual sync with logging and locking
var syncMutex sync.Mutex

func runSync(s *service) {
	// Prevent overlapping runs (if sync takes longer than interval)
	if !syncMutex.TryLock() {
		log.Println("Sync already in progress, skipping")
		return
	}
	defer syncMutex.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	count, err := s.SyncFromPinnacle(ctx)
	if err != nil {
		log.Printf("Background sync failed: %v", err)
	} else {
		log.Printf("Background sync completed: %d events processed", count)
	}
}

func toResponse(e BoxingEvent) EventResponse {
	return EventResponse{
		ID:          e.ID,
		Title:       e.Title,
		StartDate:   e.StartDate,
		EndDate:     e.EndDate,
		Location:    e.Location,
		Description: e.Description,
		CreatedAt:   e.CreatedAt,
		UpdatedAt:   e.UpdatedAt,
	}
}

// CSV generation
func generateCSV(events []EventResponse) ([]byte, error) {
	// implement using encoding/csv
	return nil, fmt.Errorf("TODO: implement CSV generation")
}

// ICS generation
func generateICS(events []EventResponse) ([]byte, error) {
	// implement using simple string builder
	return nil, fmt.Errorf("TODO: implement ICS generation")
}
