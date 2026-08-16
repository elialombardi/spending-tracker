package dto

import "time"

// CreateWorkoutRequest represents payload to assemble an ordered set of sessions into a workout
type CreateWorkoutRequest struct {
	Name       string `json:"name" validate:"required,min=1,max=150"`
	SessionIDs []uint `json:"sessionIds" validate:"required,min=1,dive,gt=0"` // Ordered session foreign keys
}

// UpdateWorkoutRequest represents payload for updating workout details/ordering
type UpdateWorkoutRequest struct {
	Name       *string `json:"name" validate:"omitempty,min=1,max=150"`
	SessionIDs []uint  `json:"sessionIds" validate:"omitempty,min=1,dive,gt=0"`
}

// WorkoutResponse represents full hydrated workout returned to client
type WorkoutResponse struct {
	ID        uint              `json:"id"`
	Name      string            `json:"name"`
	Sessions  []SessionResponse `json:"sessions"` // Ordered sessions
	CreatedAt time.Time         `json:"createdAt"`
	UpdatedAt time.Time         `json:"updatedAt"`
}
