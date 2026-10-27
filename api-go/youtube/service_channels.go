package youtube

import (
	"fmt"

	"gorm.io/gorm"
)

// GetUserChannels returns all channels the user is subscribed to
func (s *Service) GetUserChannels(userID uint, includeVideos bool, limit int) ([]YoutubeChannel, error) {
	var channels []YoutubeChannel

	query := s.db.Where("user_id = ?", userID)

	if includeVideos {
		query = query.Preload("Videos", func(db *gorm.DB) *gorm.DB {
			return db.Order("published_at DESC").Limit(5)
		})
	}

	query = query.Preload("Tags").Order("name ASC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Find(&channels).Error
	return channels, err
}

// GetUntaggedChannels returns channels without any tags
func (s *Service) GetUntaggedChannels(userID uint) ([]YoutubeChannel, error) {
	var channels []YoutubeChannel

	err := s.db.Where("user_id = ? AND NOT EXISTS (SELECT 1 FROM channel_tags WHERE channel_tags.channel_id = youtube_channels.id)", userID).
		Order("name ASC").
		Find(&channels).Error

	return channels, err
}

// GetChannelByID returns a channel by ID
func (s *Service) GetChannelByID(channelID, userID uint) (*YoutubeChannel, error) {
	var channel YoutubeChannel
	err := s.db.Where("id = ? AND user_id = ?", channelID, userID).
		Preload("Tags").
		Preload("Videos", func(db *gorm.DB) *gorm.DB {
			return db.Order("published_at DESC").Limit(20)
		}).
		First(&channel).Error

	if err != nil {
		return nil, err
	}
	return &channel, nil
}

// AddTagsToChannel adds tags to a channel
func (s *Service) AddTagsToChannel(channelID, userID uint, tagIDs []string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Verify the channel belongs to the user
		var channel YoutubeChannel
		if err := tx.Where("id = ? AND user_id = ?", channelID, userID).First(&channel).Error; err != nil {
			return fmt.Errorf("channel not found: %w", err)
		}

		// Verify all tags exist
		var tags []Tag
		if err := tx.Where("id IN ?", tagIDs).Find(&tags).Error; err != nil {
			return err
		}

		if len(tags) != len(tagIDs) {
			return fmt.Errorf("one or more tags not found")
		}

		// Add tags to channel
		for _, tag := range tags {
			if err := tx.Model(&channel).Association("Tags").Append(&tag); err != nil {
				return err
			}
		}

		return nil
	})
}

// RemoveTagsFromChannel removes tags from a channel
func (s *Service) RemoveTagsFromChannel(channelID, userID uint, tagIDs []string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var channel YoutubeChannel
		if err := tx.Where("id = ? AND user_id = ?", channelID, userID).First(&channel).Error; err != nil {
			return fmt.Errorf("channel not found: %w", err)
		}

		var tags []Tag
		if err := tx.Where("id IN ?", tagIDs).Find(&tags).Error; err != nil {
			return err
		}

		for _, tag := range tags {
			if err := tx.Model(&channel).Association("Tags").Delete(&tag); err != nil {
				return err
			}
		}

		return nil
	})
}
