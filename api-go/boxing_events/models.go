package boxing_events

import (
	"time"

	"gorm.io/gorm"
)

type BoxingEvent struct {
	gorm.Model
	UserID      uint       `gorm:"not null;index" json:"-"`
	Title       string     `gorm:"not null" json:"title"`
	StartDate   time.Time  `gorm:"not null" json:"start_date"`
	EndDate     *time.Time `json:"end_date,omitempty"`
	Location    string     `json:"location"`
	Description string     `json:"description"`
}

// DTOs
type CreateEventRequest struct {
	Title       string     `json:"title" validate:"required"`
	StartDate   time.Time  `json:"start_date" validate:"required"`
	EndDate     *time.Time `json:"end_date"`
	Location    string     `json:"location"`
	Description string     `json:"description"`
}

type UpdateEventRequest struct {
	Title       *string    `json:"title"`
	StartDate   *time.Time `json:"start_date"`
	EndDate     *time.Time `json:"end_date"`
	Location    *string    `json:"location"`
	Description *string    `json:"description"`
}

type EventResponse struct {
	ID          uint       `json:"id"`
	Title       string     `json:"title"`
	StartDate   time.Time  `json:"start_date"`
	EndDate     *time.Time `json:"end_date"`
	Location    string     `json:"location"`
	Description string     `json:"description"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
