package workouts

import (
	"time"

	"gorm.io/gorm"
)

// Session represents a configured set of interval timers
type Session struct {
	ID                   uint           `gorm:"column:id;primaryKey" json:"id"`
	Name                 string         `gorm:"column:name;type:varchar(100);not null" json:"name"`
	Rounds               int            `gorm:"column:rounds;not null;default:1" json:"rounds"`
	Cycles               int            `gorm:"column:cycles;not null;default:1" json:"cycles"`
	CycleRestDuration    int            `gorm:"column:cycle_rest_duration;not null;default:0" json:"cycle_rest_duration"`
	RoundPrepareDuration int            `gorm:"column:round_prepare_duration;not null;default:0" json:"round_prepare_duration"`
	Timers               []Timer        `gorm:"foreignKey:SessionID;constraint:OnDelete:CASCADE;" json:"timers"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Session) TableName() string { return "sessions" }

// Timer represents an individual interval step inside a session
type Timer struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	SessionID uint      `gorm:"not null;index" json:"session_id"`
	Name      string    `gorm:"type:varchar(100);not null" json:"name"`
	Duration  int       `gorm:"not null" json:"duration"` // Duration in seconds
	Color     string    `gorm:"type:varchar(10)" json:"color"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Timer) TableName() string { return "timers" }

// Workout represents an ordered assembly of sessions
type Workout struct {
	ID        uint             `gorm:"primaryKey" json:"id"`
	Name      string           `gorm:"type:varchar(150);not null" json:"name"`
	Sessions  []WorkoutSession `gorm:"foreignKey:WorkoutID;constraint:OnDelete:CASCADE;" json:"sessions"`
	CreatedAt time.Time        `json:"created_at"`
	UpdatedAt time.Time        `json:"updated_at"`
	DeletedAt gorm.DeletedAt   `gorm:"index" json:"-"`
}

func (Workout) TableName() string { return "workouts" }

// WorkoutSession handles ordered mapping between Workouts and Sessions
type WorkoutSession struct {
	ID        uint    `gorm:"primaryKey" json:"id"`
	WorkoutID uint    `gorm:"not null;index" json:"workout_id"`
	SessionID uint    `gorm:"not null;index" json:"session_id"`
	Order     int     `gorm:"not null" json:"order"` // Execution sequence order
	Session   Session `gorm:"foreignKey:SessionID" json:"session"`
}

func (WorkoutSession) TableName() string { return "workout_sessions" }
