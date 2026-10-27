package youtube

// GetLatestVideosForUser returns the latest videos from all subscribed channels
func (s *Service) GetLatestVideosForUser(userID uint, limit int) ([]YoutubeVideo, error) {
	var videos []YoutubeVideo

	subQuery := s.db.Model(&YoutubeChannel{}).Select("id").Where("user_id = ?", userID)

	err := s.db.Where("channel_id IN (?)", subQuery).
		Preload("Channel").
		Order("published_at DESC").
		Limit(limit).
		Find(&videos).Error

	return videos, err
}

// GetLatestVideosForTag returns the latest videos from channels with a specific tag
func (s *Service) GetLatestVideosForTag(userID uint, tagID string, limit int) ([]YoutubeVideo, error) {
	var videos []YoutubeVideo

	// Get channel IDs that belong to the user and have the tag
	var channelIDs []string
	err := s.db.Table("youtube_channels").
		Select("youtube_channels.id").
		Joins("JOIN channel_tags ON channel_tags.channel_id = youtube_channels.id").
		Where("youtube_channels.user_id = ? AND channel_tags.tag_id = ?", userID, tagID).
		Pluck("youtube_channels.id", &channelIDs).Error

	if err != nil {
		return nil, err
	}

	if len(channelIDs) == 0 {
		return []YoutubeVideo{}, nil
	}

	err = s.db.Where("channel_id IN ?", channelIDs).
		Preload("Channel").
		Order("published_at DESC").
		Limit(limit).
		Find(&videos).Error

	return videos, err
}
