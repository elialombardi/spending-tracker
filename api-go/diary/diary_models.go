package diary

import (
	"time"

	"gorm.io/gorm"
)

// DiaryEntry represents a diary entry for a specific user and date.
type DiaryEntry struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"not null;index:idx_user_date,unique" json:"-"`
	Date      time.Time      `gorm:"type:date;not null;index:idx_user_date,unique" json:"date"`
	Content   string         `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// DTOs
type DiaryEntryDTO struct {
	ID        uint      `json:"id"`
	Date      string    `json:"date"` // YYYY-MM-DD
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateEntryRequest struct {
	Date    string `json:"date" validate:"required,datetime=2006-01-02"`
	Content string `json:"content" validate:"required,min=1,max=10000"`
}

type UpdateEntryRequest struct {
	Content string `json:"content" validate:"required,min=1,max=10000"`
}

type ListEntriesRequest struct {
	Search string `query:"search"`
	From   string `query:"from"` // YYYY-MM-DD
	To     string `query:"to"`
	Page   int    `query:"page"`
	Limit  int    `query:"limit"`
}
