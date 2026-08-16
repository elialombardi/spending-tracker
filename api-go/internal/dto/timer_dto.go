package dto

import "time"

// CreateTimerRequest represents payload to create/add an interval timer
type CreateTimerRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=100"`
	Duration int    `json:"duration" validate:"required,gt=0"` // duration in seconds
	Color    string `json:"color" validate:"omitempty,hexcolor"`
}

// UpdateTimerRequest represents payload for updating an interval timer
type UpdateTimerRequest struct {
	Name     string `json:"name" validate:"omitempty,min=1,max=100"`
	Duration int    `json:"duration" validate:"omitempty,gt=0"`
	Color    string `json:"color" validate:"omitempty,hexcolor"`
}

// TimerResponse represents JSON returned to the client
type TimerResponse struct {
	ID        uint      `json:"id"`
	SessionID uint      `json:"sessionId"`
	Name      string    `json:"name"`
	Duration  int       `json:"duration"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
