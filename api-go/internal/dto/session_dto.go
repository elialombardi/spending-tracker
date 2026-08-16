package dto

import "time"

// CreateSessionRequest represents payload to create a workout session block (e.g. Tabata)
type CreateSessionRequest struct {
	Name               string               `json:"name" validate:"required,min=1,max=100"`
	Rounds             int                  `json:"rounds" validate:"required,gt=0"`
	Cycles             int                  `json:"cycles" validate:"required,gt=0"`
	CycleRelaxDuration int                  `json:"cycleRelaxDuration" validate:"gte=0"` // in seconds
	Timers             []CreateTimerRequest `json:"timers" validate:"required,min=1,dive"`
}

// UpdateSessionRequest represents optional payload to update a session block
type UpdateSessionRequest struct {
	Name               *string              `json:"name" validate:"omitempty,min=1,max=100"`
	Rounds             *int                 `json:"rounds" validate:"omitempty,gt=0"`
	Cycles             *int                 `json:"cycles" validate:"omitempty,gt=0"`
	CycleRelaxDuration *int                 `json:"cycleRelaxDuration" validate:"omitempty,gte=0"`
	Timers             []CreateTimerRequest `json:"timers" validate:"omitempty,min=1,dive"`
}

// SessionResponse represents JSON payload for sessions
type SessionResponse struct {
	ID                 uint            `json:"id"`
	Name               string          `json:"name"`
	Rounds             int             `json:"rounds"`
	Cycles             int             `json:"cycles"`
	CycleRelaxDuration int             `json:"cycleRelaxDuration"`
	Timers             []TimerResponse `json:"timers"`
	CreatedAt          time.Time       `json:"createdAt"`
	UpdatedAt          time.Time       `json:"updatedAt"`
}
