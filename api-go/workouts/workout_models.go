package workouts

import (
	"time"

	"gorm.io/gorm"
)

// Session represents a configured set of interval timers
type Session struct {
	ID                   uint           `gorm:"primaryKey" json:"id"`
	Name                 string         `gorm:"type:varchar(100);not null" json:"name"`
	Rounds               int            `gorm:"not null;default:1" json:"rounds"`
	Cycles               int            `gorm:"not null;default:1" json:"cycles"`
	CycleRestDuration    int            `gorm:"not null;default:0" json:"CycleRestDuration"`
	RoundPrepareDuration int            `gorm:"not null;default:0" json:"roundPrepareDuration"`
	Timers               []Timer        `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE;" json:"timers"`
	CreatedAt            time.Time      `json:"createdAt"`
	UpdatedAt            time.Time      `json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Session) TableName() string { return "Sessions" }

// Timer represents an individual interval step inside a session
type Timer struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	SessionID uint      `gorm:"not null;index" json:"sessionId"`
	Name      string    `gorm:"type:varchar(100);not null" json:"name"`
	Duration  int       `gorm:"not null" json:"duration"` // Duration in seconds
	Color     string    `gorm:"type:varchar(10)" json:"color"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (Timer) TableName() string { return "Timers" }

// Workout represents an ordered assembly of sessions
type Workout struct {
	ID        uint             `gorm:"primaryKey" json:"id"`
	Name      string           `gorm:"type:varchar(150);not null" json:"name"`
	Sessions  []WorkoutSession `gorm:"foreignKey:WorkoutID;constraint:OnDelete:CASCADE;" json:"sessions"`
	CreatedAt time.Time        `json:"createdAt"`
	UpdatedAt time.Time        `json:"updatedAt"`
	DeletedAt gorm.DeletedAt   `gorm:"index" json:"-"`
}

func (Workout) TableName() string { return "Workouts" }

// WorkoutSession handles ordered mapping between Workouts and Sessions
type WorkoutSession struct {
	ID        uint    `gorm:"primaryKey" json:"id"`
	WorkoutID uint    `gorm:"not null;index" json:"workoutId"`
	SessionID uint    `gorm:"not null;index" json:"sessionId"`
	Order     int     `gorm:"not null" json:"order"` // Execution sequence order
	Session   Session `gorm:"foreignKey:SessionID" json:"session"`
}

func (WorkoutSession) TableName() string { return "WorkoutSession" }
