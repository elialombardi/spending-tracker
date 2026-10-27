package youtube

import (
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GetTags returns all tags
func (s *Service) GetTags() ([]Tag, error) {
	var tags []Tag
	err := s.db.Order("name ASC").Find(&tags).Error
	return tags, err
}

// CreateTag creates a new tag
func (s *Service) CreateTag(userID uint, req CreateTagRequest) (*Tag, error) {
	tag := &Tag{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Description: req.Description,
		Color:       req.Color,
		CreatedBy:   userID,
	}

	err := s.db.Create(tag).Error
	if err != nil {
		return nil, err
	}
	return tag, nil
}

// UpdateTag updates an existing tag
func (s *Service) UpdateTag(tagID, userID uint, req UpdateTagRequest) (*Tag, error) {
	var tag Tag
	if err := s.db.Where("id = ?", tagID).First(&tag).Error; err != nil {
		return nil, err
	}

	// Only admins can update tags
	if req.Name != "" {
		tag.Name = req.Name
	}
	if req.Description != "" {
		tag.Description = req.Description
	}
	if req.Color != "" {
		tag.Color = req.Color
	}

	err := s.db.Save(&tag).Error
	if err != nil {
		return nil, err
	}
	return &tag, nil
}

// DeleteTag deletes a tag
func (s *Service) DeleteTag(tagID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// First remove all associations
		if err := tx.Exec("DELETE FROM channel_tags WHERE tag_id = ?", tagID).Error; err != nil {
			return err
		}

		// Then delete the tag
		return tx.Delete(&Tag{}, "id = ?", tagID).Error
	})
}

// GetTagByID returns a tag by ID
func (s *Service) GetTagByID(tagID string) (*Tag, error) {
	var tag Tag
	err := s.db.Preload("Channels").First(&tag, "id = ?", tagID).Error
	if err != nil {
		return nil, err
	}
	return &tag, nil
}
