package fuel

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// FuelRecord represents a fuel fill record
type FuelRecord struct {
	ID        string    `gorm:"primaryKey;type:uuid" json:"id"`
	UserID    uint      `gorm:"type:bigint;not null;index" json:"userId"`
	FillType  string    `gorm:"type:varchar(20);not null" json:"fillType"` // "gpl" or "benzina"
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
}

// FuelStats represents aggregated fuel statistics
type FuelStats struct {
	TotalFills        int    `json:"totalFills"`
	GPLCount          int    `json:"gplCount"`
	BenzinaCount      int    `json:"benzinaCount"`
	FillsUntilBenzina int    `json:"fillsUntilBenzina"`
	NextFillType      string `json:"nextFillType"` // "gpl" or "benzina"
}

// CreateFuelRequest represents the request to create a fuel record
type CreateFuelRequest struct {
	FillType string `json:"fillType" validate:"required,oneof=gpl benzina"`
}

// FuelResponse represents the response for fuel operations
type FuelResponse struct {
	ID        string    `json:"id"`
	UserID    uint      `json:"userId"`
	FillType  string    `json:"fillType"`
	CreatedAt time.Time `json:"createdAt"`
}

// ToResponse converts a FuelRecord to FuelResponse
func (f *FuelRecord) ToResponse() *FuelResponse {
	return &FuelResponse{
		ID:        f.ID,
		UserID:    f.UserID,
		FillType:  f.FillType,
		CreatedAt: f.CreatedAt,
	}
}

// BeforeCreate hook to generate UUID
func (f *FuelRecord) BeforeCreate(tx *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	return nil
}
