package locations

import (
	"errors"
	"strings"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"gorm.io/gorm"
)

type LocationService struct {
	db *gorm.DB
}

func NewLocationService(database *gorm.DB) *LocationService {
	return &LocationService{db: database}
}

func (s *LocationService) ListLocations() ([]db.LocationEntity, error) {
	var locations []db.LocationEntity
	err := s.db.Preload("Tags", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("Name ASC")
	}).Order("Id ASC").Find(&locations).Error
	return locations, err
}

func (s *LocationService) GetLocation(id int) (db.LocationEntity, error) {
	var location db.LocationEntity
	err := s.db.Preload("Tags", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("Name ASC")
	}).First(&location, "Id = ?", id).Error
	return location, err
}

func (s *LocationService) CreateLocation(payload db.LocationEntity, tags []string) (db.LocationEntity, error) {
	var created db.LocationEntity
	err := s.db.Transaction(func(tx *gorm.DB) error {
		payload.ID = 0
		if err := tx.Create(&payload).Error; err != nil {
			return err
		}
		if err := s.replaceLocationTagsTx(tx, payload.ID, tags); err != nil {
			return err
		}
		return tx.Preload("Tags", func(q *gorm.DB) *gorm.DB {
			return q.Order("Name ASC")
		}).First(&created, "Id = ?", payload.ID).Error
	})
	return created, err
}

func (s *LocationService) UpdateLocation(id int, payload db.LocationEntity, tags []string) (db.LocationEntity, error) {
	var updated db.LocationEntity
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var existing db.LocationEntity
		if err := tx.First(&existing, "Id = ?", id).Error; err != nil {
			return err
		}
		existing.Title = payload.Title
		existing.URL = payload.URL
		existing.Lat = payload.Lat
		existing.Lng = payload.Lng
		existing.Description = payload.Description
		if err := tx.Save(&existing).Error; err != nil {
			return err
		}
		if err := tx.Where("LocationId = ?", id).Delete(&db.LocationTagEntity{}).Error; err != nil {
			return err
		}
		if err := s.replaceLocationTagsTx(tx, id, tags); err != nil {
			return err
		}
		return tx.Preload("Tags", func(q *gorm.DB) *gorm.DB {
			return q.Order("Name ASC")
		}).First(&updated, "Id = ?", id).Error
	})
	return updated, err
}

func (s *LocationService) DeleteLocation(id int) (bool, error) {
	result := s.db.Delete(&db.LocationEntity{}, "Id = ?", id)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func (s *LocationService) ToggleLocationTag(id int, tagName string, present bool) (db.LocationEntity, error) {
	var location db.LocationEntity
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&db.LocationEntity{}, "Id = ?", id).Error; err != nil {
			return err
		}
		tag, err := s.ensureTagTx(tx, tagName)
		if err != nil {
			return err
		}
		if present {
			join := db.LocationTagEntity{LocationID: id, TagID: tag.ID}
			if err := tx.FirstOrCreate(&join, join).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Where("LocationId = ? AND TagId = ?", id, tag.ID).Delete(&db.LocationTagEntity{}).Error; err != nil {
				return err
			}
		}
		return tx.Preload("Tags", func(q *gorm.DB) *gorm.DB {
			return q.Order("Name ASC")
		}).First(&location, "Id = ?", id).Error
	})
	return location, err
}

func (s *LocationService) ListTags() ([]db.TagEntity, error) {
	var tags []db.TagEntity
	err := s.db.Order("Name ASC").Find(&tags).Error
	return tags, err
}

func (s *LocationService) CreateTag(name string) error {
	return s.db.Create(&db.TagEntity{Name: name}).Error
}

func (s *LocationService) RenameTag(oldName, newName string) (bool, error) {
	result := s.db.Model(&db.TagEntity{}).Where("Name = ?", oldName).Update("Name", newName)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func (s *LocationService) DeleteTag(name string) (bool, error) {
	result := s.db.Where("Name = ?", name).Delete(&db.TagEntity{})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func (s *LocationService) replaceLocationTagsTx(tx *gorm.DB, locationID int, tags []string) error {
	normalized := normalizeTags(tags)
	for _, tagName := range normalized {
		tag, err := s.ensureTagTx(tx, tagName)
		if err != nil {
			return err
		}
		join := db.LocationTagEntity{LocationID: locationID, TagID: tag.ID}
		if err := tx.FirstOrCreate(&join, join).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *LocationService) ensureTagTx(tx *gorm.DB, name string) (db.TagEntity, error) {
	var tag db.TagEntity
	err := tx.Where("Name = ?", name).First(&tag).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		tag = db.TagEntity{Name: name}
		if err := tx.Create(&tag).Error; err != nil {
			return db.TagEntity{}, err
		}
		return tag, nil
	}
	return tag, err
}

func normalizeTags(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}
