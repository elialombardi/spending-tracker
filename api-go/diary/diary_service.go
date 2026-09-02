package diary

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

type Service interface {
	GetEntries(ctx context.Context, userID uint, req ListEntriesRequest) ([]DiaryEntryDTO, int64, error)
	GetEntryByDate(ctx context.Context, userID uint, date time.Time) (*DiaryEntryDTO, error)
	CreateEntry(ctx context.Context, userID uint, date time.Time, content string) (*DiaryEntryDTO, error)
	UpdateEntry(ctx context.Context, userID uint, date time.Time, content string) (*DiaryEntryDTO, error)
}

type service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) Service {
	return &service{db: db}
}

// GetEntries returns paginated entries with optional search and date filters.
func (s *service) GetEntries(ctx context.Context, userID uint, req ListEntriesRequest) ([]DiaryEntryDTO, int64, error) {
	query := s.db.WithContext(ctx).Model(&DiaryEntry{}).Where("user_id = ?", userID)

	if req.Search != "" {
		query = query.Where("content LIKE ?", "%"+req.Search+"%")
	}
	if req.From != "" {
		from, err := time.Parse("2006-01-02", req.From)
		if err == nil {
			query = query.Where("date >= ?", from)
		}
	}
	if req.To != "" {
		to, err := time.Parse("2006-01-02", req.To)
		if err == nil {
			query = query.Where("date <= ?", to)
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := req.Page
	if page < 1 {
		page = 1
	}
	limit := req.Limit
	if limit < 1 {
		limit = 20
	} else if limit > 100 {
		limit = 100
	}
	offset := (page - 1) * limit

	var entries []DiaryEntry
	if err := query.Order("date DESC").Limit(limit).Offset(offset).Find(&entries).Error; err != nil {
		return nil, 0, err
	}

	dtos := make([]DiaryEntryDTO, len(entries))
	for i, e := range entries {
		dtos[i] = toDTO(e)
	}
	return dtos, total, nil
}

func (s *service) GetEntryByDate(ctx context.Context, userID uint, date time.Time) (*DiaryEntryDTO, error) {
	var entry DiaryEntry
	if err := s.db.WithContext(ctx).Where("user_id = ? AND date = ?", userID, date).First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	dto := toDTO(entry)
	return &dto, nil
}

func (s *service) CreateEntry(ctx context.Context, userID uint, date time.Time, content string) (*DiaryEntryDTO, error) {
	// Check if entry already exists for that user and date
	var count int64
	if err := s.db.WithContext(ctx).Model(&DiaryEntry{}).Where("user_id = ? AND date = ?", userID, date).Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, errors.New("entry already exists for this date")
	}

	entry := DiaryEntry{
		UserID:  userID,
		Date:    date,
		Content: content,
	}
	if err := s.db.WithContext(ctx).Create(&entry).Error; err != nil {
		return nil, err
	}
	dto := toDTO(entry)
	return &dto, nil
}

func (s *service) UpdateEntry(ctx context.Context, userID uint, date time.Time, content string) (*DiaryEntryDTO, error) {
	var entry DiaryEntry
	if err := s.db.WithContext(ctx).Where("user_id = ? AND date = ?", userID, date).First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // or return nil, errors.New("not found")
		}
		return nil, err
	}
	entry.Content = content
	if err := s.db.WithContext(ctx).Save(&entry).Error; err != nil {
		return nil, err
	}
	dto := toDTO(entry)
	return &dto, nil
}

func toDTO(e DiaryEntry) DiaryEntryDTO {
	return DiaryEntryDTO{
		ID:        e.ID,
		Date:      e.Date.Format("2006-01-02"),
		Content:   e.Content,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
	}
}
