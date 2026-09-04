package fuel

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

const (
	FillTypeGPL     = "gpl"
	FillTypeBenzina = "benzina"
	FillsPerCycle   = 4
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// CreateFuelRecord creates a new fuel fill record
func (s *Service) CreateFuelRecord(userID uint, fillType string) (*FuelRecord, error) {
	if fillType != FillTypeGPL && fillType != FillTypeBenzina {
		return nil, errors.New("invalid fill type: must be 'gpl' or 'benzina'")
	}

	record := &FuelRecord{
		UserID:   userID,
		FillType: fillType,
	}

	if err := s.db.Create(record).Error; err != nil {
		return nil, err
	}

	return record, nil
}

// GetUserRecords returns all fuel records for a user
func (s *Service) GetUserRecords(userID uint) ([]FuelRecord, error) {
	var records []FuelRecord
	if err := s.db.Where("user_id = ?", userID).Order("created_at desc").Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// GetUserStats calculates fuel statistics for a user
func (s *Service) GetUserStats(userID uint) (*FuelStats, error) {
	var records []FuelRecord
	if err := s.db.Where("user_id = ?", userID).Order("created_at asc").Find(&records).Error; err != nil {
		return nil, err
	}

	totalFills := len(records)
	gplCount := 0
	benzinaCount := 0

	for _, record := range records {
		switch record.FillType {
		case FillTypeGPL:
			gplCount++
		case FillTypeBenzina:
			benzinaCount++
		}
	}

	// Calculate fills until next benzina
	// Count GPL fills since last benzina
	fillsSinceLastBenzina := 0
	for i := len(records) - 1; i >= 0; i-- {
		if records[i].FillType == FillTypeBenzina {
			break
		}
		if records[i].FillType == FillTypeGPL {
			fillsSinceLastBenzina++
		}
	}

	// If no benzina yet, count all GPL fills
	if benzinaCount == 0 {
		fillsSinceLastBenzina = gplCount
	}

	fillsUntilBenzina := FillsPerCycle - fillsSinceLastBenzina
	if fillsUntilBenzina < 0 {
		fillsUntilBenzina = 0
	}

	nextFillType := FillTypeGPL
	if fillsUntilBenzina == 0 {
		nextFillType = FillTypeBenzina
	}

	return &FuelStats{
		TotalFills:        totalFills,
		GPLCount:          gplCount,
		BenzinaCount:      benzinaCount,
		FillsUntilBenzina: fillsUntilBenzina,
		NextFillType:      nextFillType,
	}, nil
}

// GetLastFuelRecord returns the most recent fuel record for a user
func (s *Service) GetLastFuelRecord(userID uint) (*FuelRecord, error) {
	var record FuelRecord
	if err := s.db.Where("user_id = ?", userID).Order("created_at desc").First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

// GetRecordsInDateRange returns records for a user within a date range
func (s *Service) GetRecordsInDateRange(userID uint, startDate, endDate time.Time) ([]FuelRecord, error) {
	var records []FuelRecord
	if err := s.db.Where("user_id = ? AND created_at BETWEEN ? AND ?", userID, startDate, endDate).
		Order("created_at desc").
		Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// DeleteRecord deletes a fuel record (admin only)
func (s *Service) DeleteRecord(recordID string) error {
	result := s.db.Delete(&FuelRecord{}, "id = ?", recordID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("record not found")
	}
	return nil
}

// DeleteUserRecords deletes all records for a user (admin only)
func (s *Service) DeleteUserRecords(userID uint) error {
	return s.db.Where("user_id = ?", userID).Delete(&FuelRecord{}).Error
}
