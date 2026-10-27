package youtube

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"time"

	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"google.golang.org/api/youtube/v3"
	"gorm.io/gorm"
)

var ErrYouTubeNotConnected = errors.New("YouTube is not connected; connect your Google account before syncing subscriptions")

func (s *Service) connectedUserIDs() ([]uint, error) {
	var userIDs []uint
	if err := s.db.Model(&OAuthToken{}).Pluck("user_id", &userIDs).Error; err != nil {
		return nil, fmt.Errorf("failed to get YouTube-connected users: %w", err)
	}
	return userIDs, nil
}

func (s *Service) getOAuthToken(userID uint) (*OAuthToken, error) {
	var token OAuthToken
	result := s.db.Where("user_id = ?", userID).Limit(1).Find(&token)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to load YouTube OAuth token: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, ErrYouTubeNotConnected
	}
	return &token, nil
}

// StartBackgroundSync starts a background goroutine that periodically syncs all channels
// for connected users. It runs immediately on start and then every 6 hours.
func (s *Service) StartBackgroundSync(stopCh <-chan struct{}) {
	go func() {
		log.Println("[YouTube] Starting background sync service...")

		// Run immediately on start
		s.runBackgroundSync()

		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				log.Println("[YouTube] Running scheduled background sync...")
				s.runBackgroundSync()
			case <-stopCh:
				log.Println("[YouTube] Background sync stopped")
				return
			}
		}
	}()
}

// runBackgroundSync performs the actual background sync for connected users
func (s *Service) runBackgroundSync() {
	userIDs, err := s.connectedUserIDs()
	if err != nil {
		log.Printf("[YouTube] Failed to get users for background sync: %v", err)
		return
	}

	if len(userIDs) == 0 {
		log.Println("[YouTube] No YouTube-connected users found. Skipping background sync.")
		return
	}

	log.Printf("[YouTube] Background sync started for %d users", len(userIDs))

	// Sync for each user
	successCount := 0
	failCount := 0

	for _, userID := range userIDs {
		if err := s.syncUserChannelsInBackground(userID); err != nil {
			log.Printf("[YouTube] Failed to sync user %d: %v", userID, err)
			failCount++
		} else {
			successCount++
		}
	}

	log.Printf("[YouTube] Background sync completed: %d succeeded, %d failed", successCount, failCount)
}

// syncUserChannelsInBackground syncs all channels for a specific user
func (s *Service) syncUserChannelsInBackground(userID uint) error {
	// Check if user already has a sync running
	var runningSync SyncLog
	err := s.db.Where("user_id = ? AND status = ?", userID, "running").
		Order("created_at DESC").
		First(&runningSync).Error

	if err == nil {
		log.Printf("[YouTube] User %d already has a sync in progress, skipping", userID)
		return nil
	}

	// Start sync - this will fetch subscriptions from YouTube
	_, err = s.SyncAllSubscribedChannels(userID)
	if err != nil {
		return fmt.Errorf("failed to start sync: %w", err)
	}

	log.Printf("[YouTube] Started sync for user %d", userID)
	return nil
}

// SyncAllUsersSubscriptions syncs subscriptions for connected users (manual trigger)
func (s *Service) SyncAllUsersSubscriptions() error {
	userIDs, err := s.connectedUserIDs()
	if err != nil {
		return err
	}

	if len(userIDs) == 0 {
		return ErrYouTubeNotConnected
	}

	log.Printf("[YouTube] Manually syncing subscriptions for %d users", len(userIDs))

	successCount := 0
	failCount := 0

	for _, userID := range userIDs {
		_, err := s.SyncAllSubscribedChannels(userID)
		if err != nil {
			log.Printf("[YouTube] Failed to sync for user %d: %v", userID, err)
			failCount++
		} else {
			successCount++
		}
	}

	log.Printf("[YouTube] Manual sync completed: %d succeeded, %d failed", successCount, failCount)
	return nil
}

// fetchSubscribedChannelsWithOAuth fetches all channels the user is subscribed to using OAuth
func (s *Service) fetchSubscribedChannelsWithOAuth(userID uint) ([]YoutubeChannel, error) {
	// Get user's OAuth token
	token, err := s.getOAuthToken(userID)
	if err != nil {
		return nil, err
	}

	oauthToken := &oauth2.Token{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		Expiry:       token.Expiry,
	}

	client := s.oauthConfig.Client(context.Background(), oauthToken)
	service, err := youtube.New(client)
	if err != nil {
		return nil, fmt.Errorf("failed to create YouTube service: %w", err)
	}

	var allChannels []YoutubeChannel
	pageToken := ""

	for {
		call := service.Subscriptions.List([]string{"snippet", "contentDetails"}).
			Mine(true).
			MaxResults(50)

		if pageToken != "" {
			call = call.PageToken(pageToken)
		}

		response, err := call.Do()
		if err != nil {
			return nil, fmt.Errorf("failed to fetch subscriptions: %w", err)
		}

		for _, item := range response.Items {
			// Get channel statistics
			stats, err := s.fetchChannelStatisticsWithOAuth(client, item.Snippet.ChannelId)
			if err != nil {
				stats = &channelStats{}
			}

			thumbnail := item.Snippet.Thumbnails.High.Url
			if thumbnail == "" {
				thumbnail = item.Snippet.Thumbnails.Medium.Url
			}
			if thumbnail == "" {
				thumbnail = item.Snippet.Thumbnails.Default.Url
			}

			channel := YoutubeChannel{
				ID:              item.Snippet.ChannelId,
				Name:            item.Snippet.Title,
				Description:     item.Snippet.Description,
				Thumbnail:       thumbnail,
				SubscriberCount: stats.SubscriberCount,
				VideoCount:      stats.VideoCount,
				ViewCount:       stats.ViewCount,
			}

			allChannels = append(allChannels, channel)
		}

		if response.NextPageToken == "" {
			break
		}
		pageToken = response.NextPageToken
	}

	return allChannels, nil
}

// fetchChannelStatisticsWithOAuth fetches statistics using OAuth client
func (s *Service) fetchChannelStatisticsWithOAuth(client *http.Client, channelID string) (*channelStats, error) {
	service, err := youtube.New(client)
	if err != nil {
		return nil, err
	}

	call := service.Channels.List([]string{"statistics"}).Id(channelID)
	response, err := call.Do()
	if err != nil {
		return nil, err
	}

	if len(response.Items) == 0 {
		return &channelStats{}, nil
	}

	stats := response.Items[0].Statistics
	if stats.SubscriberCount > math.MaxInt64 || stats.VideoCount > math.MaxInt64 || stats.ViewCount > math.MaxInt64 {
		return nil, fmt.Errorf("channel %s statistics exceed the supported count range", channelID)
	}
	return &channelStats{
		SubscriberCount: int64(stats.SubscriberCount),
		VideoCount:      int64(stats.VideoCount),
		ViewCount:       int64(stats.ViewCount),
	}, nil
}

// SyncAllSubscribedChannels fetches all channels the user is subscribed to from YouTube using OAuth
func (s *Service) SyncAllSubscribedChannels(userID uint) (*SyncLog, error) {
	// Get user's OAuth token
	token, err := s.getOAuthToken(userID)
	if err != nil {
		return nil, err
	}

	// Create OAuth2 client
	oauthToken := &oauth2.Token{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		Expiry:       token.Expiry,
	}

	client := s.oauthConfig.Client(context.Background(), oauthToken)

	// Create YouTube service with OAuth client
	_, err = youtube.New(client)
	if err != nil {
		return nil, fmt.Errorf("failed to create YouTube service: %w", err)
	}

	// Use OAuth to fetch subscriptions
	return s.startSync(userID, "subscriptions", "")
}

// SyncAllChannels triggers a sync for all user channels
func (s *Service) SyncAllChannels(userID uint) (*SyncLog, error) {
	return s.startSync(userID, "all", "")
}

// SyncChannel triggers a sync for a specific channel
func (s *Service) SyncChannel(userID uint, channelID string) (*SyncLog, error) {
	return s.startSync(userID, "channel", channelID)
}

// SyncTagChannels triggers a sync for all channels with a specific tag
func (s *Service) SyncTagChannels(userID uint, tagID string) (*SyncLog, error) {
	return s.startSync(userID, "tag", tagID)
}

// startSync starts a new sync operation
func (s *Service) startSync(userID uint, syncType, targetID string) (*SyncLog, error) {
	// Check if there's already a running sync
	var runningSync SyncLog
	err := s.db.Where("user_id = ? AND status = ?", userID, "running").
		Order("created_at DESC").
		First(&runningSync).Error

	if err == nil {
		return nil, fmt.Errorf("a sync is already in progress")
	}

	syncLog := &SyncLog{
		ID:        uuid.New().String(),
		UserID:    userID,
		Type:      syncType,
		TargetID:  targetID,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	err = s.db.Create(syncLog).Error
	if err != nil {
		return nil, err
	}

	// Start sync in background
	go s.performSync(syncLog.ID, syncType, targetID, userID)

	return syncLog, nil
}

// fetchSubscribedChannels fetches all channels the user is subscribed to from YouTube
func (s *Service) fetchSubscribedChannels() ([]YoutubeChannel, error) {
	var allChannels []YoutubeChannel
	pageToken := ""

	for {
		// YouTube API endpoint for subscriptions
		apiURL := fmt.Sprintf(
			"https://www.googleapis.com/youtube/v3/subscriptions?key=%s&part=snippet%%2CcontentDetails&mine=true&maxResults=50",
			s.apiKey,
		)

		if pageToken != "" {
			apiURL += fmt.Sprintf("&pageToken=%s", pageToken)
		}

		resp, err := s.httpClient.Get(apiURL)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch subscriptions: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("YouTube API error: %s, body: %s", resp.Status, string(body))
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read response: %w", err)
		}

		var result struct {
			Items []struct {
				Snippet struct {
					Title       string `json:"title"`
					Description string `json:"description"`
					ChannelID   string `json:"channelId"`
					Thumbnails  struct {
						Default struct {
							URL string `json:"url"`
						} `json:"default"`
						Medium struct {
							URL string `json:"url"`
						} `json:"medium"`
						High struct {
							URL string `json:"url"`
						} `json:"high"`
					} `json:"thumbnails"`
					PublishedAt time.Time `json:"publishedAt"`
				} `json:"snippet"`
				ContentDetails struct {
					TotalItemCount int `json:"totalItemCount"`
				} `json:"contentDetails"`
			} `json:"items"`
			NextPageToken string `json:"nextPageToken"`
			PageInfo      struct {
				TotalResults int `json:"totalResults"`
			} `json:"pageInfo"`
		}

		if err := json.Unmarshal(body, &result); err != nil {
			return nil, fmt.Errorf("failed to parse response: %w", err)
		}

		// Process each subscription
		for _, item := range result.Items {
			// Get channel statistics
			stats, err := s.fetchChannelStatistics(item.Snippet.ChannelID)
			if err != nil {
				// Log error but continue with basic info
				stats = &channelStats{}
			}

			thumbnail := item.Snippet.Thumbnails.High.URL
			if thumbnail == "" {
				thumbnail = item.Snippet.Thumbnails.Medium.URL
			}
			if thumbnail == "" {
				thumbnail = item.Snippet.Thumbnails.Default.URL
			}

			channel := YoutubeChannel{
				ID:              item.Snippet.ChannelID,
				Name:            item.Snippet.Title,
				Description:     item.Snippet.Description,
				Thumbnail:       thumbnail,
				SubscriberCount: stats.SubscriberCount,
				VideoCount:      stats.VideoCount,
				ViewCount:       stats.ViewCount,
				PublishedAt:     &item.Snippet.PublishedAt,
			}

			allChannels = append(allChannels, channel)
		}

		// Check if there are more pages
		if result.NextPageToken == "" {
			break
		}
		pageToken = result.NextPageToken
	}

	return allChannels, nil
}

// channelStats holds statistics for a YouTube channel
type channelStats struct {
	SubscriberCount int64 `json:"subscriberCount"`
	VideoCount      int64 `json:"videoCount"`
	ViewCount       int64 `json:"viewCount"`
}

// fetchChannelStatistics fetches statistics for a specific channel
func (s *Service) fetchChannelStatistics(channelID string) (*channelStats, error) {
	apiURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/channels?key=%s&id=%s&part=statistics",
		s.apiKey, channelID,
	)

	resp, err := s.httpClient.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("YouTube API error: %s, body: %s", resp.Status, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Items []struct {
			Statistics struct {
				SubscriberCount string `json:"subscriberCount"`
				VideoCount      string `json:"videoCount"`
				ViewCount       string `json:"viewCount"`
			} `json:"statistics"`
		} `json:"items"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	if len(result.Items) == 0 {
		return &channelStats{}, nil
	}

	var stats channelStats
	fmt.Sscanf(result.Items[0].Statistics.SubscriberCount, "%d", &stats.SubscriberCount)
	fmt.Sscanf(result.Items[0].Statistics.VideoCount, "%d", &stats.VideoCount)
	fmt.Sscanf(result.Items[0].Statistics.ViewCount, "%d", &stats.ViewCount)

	return &stats, nil
}

// fetchChannelVideos fetches videos from a specific YouTube channel
func (s *Service) fetchChannelVideos(channelID string) ([]YoutubeVideo, error) {
	apiURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/search?key=%s&channelId=%s&part=snippet,id&order=date&maxResults=50",
		s.apiKey, channelID,
	)

	resp, err := s.httpClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch videos for channel %s: %w", channelID, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("YouTube API error: %s, body: %s", resp.Status, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result struct {
		Items []struct {
			ID struct {
				VideoID string `json:"videoId"`
			} `json:"id"`
			Snippet struct {
				Title       string `json:"title"`
				Description string `json:"description"`
				Thumbnails  struct {
					Default struct {
						URL string `json:"url"`
					} `json:"default"`
					Medium struct {
						URL string `json:"url"`
					} `json:"medium"`
					High struct {
						URL string `json:"url"`
					} `json:"high"`
				} `json:"thumbnails"`
				PublishedAt time.Time `json:"publishedAt"`
			} `json:"snippet"`
		} `json:"items"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	var videos []YoutubeVideo
	for _, item := range result.Items {
		// Skip if not a video (could be playlist, etc.)
		if item.ID.VideoID == "" {
			continue
		}

		thumbnail := item.Snippet.Thumbnails.High.URL
		if thumbnail == "" {
			thumbnail = item.Snippet.Thumbnails.Medium.URL
		}
		if thumbnail == "" {
			thumbnail = item.Snippet.Thumbnails.Default.URL
		}

		video := YoutubeVideo{
			ID:          item.ID.VideoID,
			Title:       item.Snippet.Title,
			Description: item.Snippet.Description,
			Thumbnail:   thumbnail,
			PublishedAt: item.Snippet.PublishedAt,
			URL:         fmt.Sprintf("https://www.youtube.com/watch?v=%s", item.ID.VideoID),
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		videos = append(videos, video)
	}

	return videos, nil
}

// SyncChannelVideos fetches videos for a specific channel
func (s *Service) SyncChannelVideos(userID uint, channelID string) error {
	// Verify channel belongs to user
	var channel YoutubeChannel
	if err := s.db.Where("id = ? AND user_id = ?", channelID, userID).First(&channel).Error; err != nil {
		return fmt.Errorf("channel not found: %w", err)
	}

	videos, err := s.fetchChannelVideos(channelID)
	if err != nil {
		return err
	}

	// Save videos in transaction
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, video := range videos {
			video.ChannelID = channelID
			if err := tx.Save(&video).Error; err != nil {
				return err
			}
		}

		// Update last synced time
		now := time.Now()
		if err := tx.Model(&YoutubeChannel{}).Where("id = ?", channelID).Update("last_synced_at", now).Error; err != nil {
			return err
		}

		return nil
	})
}

// performSync performs the actual sync operation
func (s *Service) performSync(syncID, syncType, targetID string, userID uint) {
	// Update status to running
	now := time.Now()
	s.db.Model(&SyncLog{}).Where("id = ?", syncID).Updates(map[string]interface{}{
		"status":     "running",
		"started_at": now,
	})

	switch syncType {
	case "subscriptions":
		// Fetch all subscribed channels from YouTube
		channels, err := s.fetchSubscribedChannels()
		if err != nil {
			s.db.Model(&SyncLog{}).Where("id = ?", syncID).Updates(map[string]interface{}{
				"status":        "failed",
				"error_message": fmt.Sprintf("Error fetching subscriptions: %v", err),
				"completed_at":  time.Now(),
			})
			return
		}

		if len(channels) == 0 {
			// User has no subscriptions
			s.db.Model(&SyncLog{}).Where("id = ?", syncID).Updates(map[string]interface{}{
				"status":             "completed",
				"processed_channels": 0,
				"total_videos_added": 0,
				"total_channels":     0,
				"completed_at":       time.Now(),
			})
			log.Printf("[YouTube] User %d has no subscriptions", userID)
			return
		}

		// Update total channels
		s.db.Model(&SyncLog{}).Where("id = ?", syncID).Update("total_channels", len(channels))

		// Save channels and sync videos
		totalVideosAdded := 0
		processedChannels := 0

		for _, channel := range channels {
			// Check if channel already exists for this user
			var existingChannel YoutubeChannel
			err := s.db.Where("id = ? AND user_id = ?", channel.ID, userID).First(&existingChannel).Error

			if err == gorm.ErrRecordNotFound {
				// New channel - set user ID and create
				channel.UserID = userID
				if err := s.db.Create(&channel).Error; err != nil {
					log.Printf("[YouTube] Failed to create channel %s: %v", channel.ID, err)
					continue
				}
				log.Printf("[YouTube] Added new channel: %s for user %d", channel.Name, userID)
			} else if err == nil {
				// Existing channel - update info
				channel.UserID = userID
				if err := s.db.Model(&YoutubeChannel{}).Where("id = ? AND user_id = ?", channel.ID, userID).
					Updates(map[string]interface{}{
						"name":             channel.Name,
						"description":      channel.Description,
						"thumbnail":        channel.Thumbnail,
						"subscriber_count": channel.SubscriberCount,
						"video_count":      channel.VideoCount,
						"view_count":       channel.ViewCount,
						"published_at":     channel.PublishedAt,
					}).Error; err != nil {
					log.Printf("[YouTube] Failed to update channel %s: %v", channel.ID, err)
					continue
				}
			} else {
				log.Printf("[YouTube] Error checking channel %s: %v", channel.ID, err)
				continue
			}

			// Fetch videos for this channel
			videos, err := s.fetchChannelVideos(channel.ID)
			if err != nil {
				log.Printf("[YouTube] Failed to fetch videos for channel %s: %v", channel.ID, err)
				// Continue with other channels
			} else {
				for _, video := range videos {
					// Check if video already exists
					var existingVideo YoutubeVideo
					err := s.db.Where("id = ? AND channel_id = ?", video.ID, channel.ID).First(&existingVideo).Error
					if err == gorm.ErrRecordNotFound {
						// New video
						video.ChannelID = channel.ID
						if err := s.db.Create(&video).Error; err == nil {
							totalVideosAdded++
						}
					} else if err == nil {
						// Update existing video
						if err := s.db.Model(&YoutubeVideo{}).Where("id = ? AND channel_id = ?", video.ID, channel.ID).
							Updates(map[string]interface{}{
								"title":       video.Title,
								"description": video.Description,
								"thumbnail":   video.Thumbnail,
								"view_count":  video.ViewCount,
								"updated_at":  time.Now(),
							}).Error; err == nil {
							// Don't count as new, but still track
						}
					}
				}
			}

			// Update channel last synced time
			s.db.Model(&YoutubeChannel{}).Where("id = ? AND user_id = ?", channel.ID, userID).
				Update("last_synced_at", time.Now())

			processedChannels++

			// Update progress
			s.db.Model(&SyncLog{}).Where("id = ?", syncID).Updates(map[string]interface{}{
				"processed_channels": processedChannels,
				"total_videos_added": totalVideosAdded,
			})
		}

		// Update final status
		s.db.Model(&SyncLog{}).Where("id = ?", syncID).Updates(map[string]interface{}{
			"status":             "completed",
			"processed_channels": processedChannels,
			"total_videos_added": totalVideosAdded,
			"completed_at":       time.Now(),
		})

		log.Printf("[YouTube] Sync completed for user %d: %d channels, %d videos added",
			userID, processedChannels, totalVideosAdded)

	case "all", "channel", "tag":
		// Existing sync logic for channels already in database
		var channels []YoutubeChannel
		var err error

		switch syncType {
		case "all":
			err = s.db.Where("user_id = ?", userID).Find(&channels).Error
		case "channel":
			err = s.db.Where("id = ? AND user_id = ?", targetID, userID).Find(&channels).Error
		case "tag":
			err = s.db.Table("youtube_channels").
				Select("youtube_channels.*").
				Joins("JOIN channel_tags ON channel_tags.channel_id = youtube_channels.id").
				Where("youtube_channels.user_id = ? AND channel_tags.tag_id = ?", userID, targetID).
				Find(&channels).Error
		}

		if err != nil {
			s.db.Model(&SyncLog{}).Where("id = ?", syncID).Updates(map[string]interface{}{
				"status":        "failed",
				"error_message": fmt.Sprintf("Error fetching channels: %v", err),
				"completed_at":  time.Now(),
			})
			return
		}

		if len(channels) == 0 {
			s.db.Model(&SyncLog{}).Where("id = ?", syncID).Updates(map[string]interface{}{
				"status":             "completed",
				"processed_channels": 0,
				"total_videos_added": 0,
				"total_channels":     0,
				"completed_at":       time.Now(),
			})
			return
		}

		// Update total channels
		s.db.Model(&SyncLog{}).Where("id = ?", syncID).Update("total_channels", len(channels))

		// Sync each channel
		totalVideosAdded := 0
		processedChannels := 0

		for _, channel := range channels {
			videos, err := s.fetchChannelVideos(channel.ID)
			if err != nil {
				continue
			}

			for _, video := range videos {
				video.ChannelID = channel.ID
				if err := s.db.Save(&video).Error; err == nil {
					totalVideosAdded++
				}
			}

			s.db.Model(&YoutubeChannel{}).Where("id = ?", channel.ID).Update("last_synced_at", time.Now())
			processedChannels++

			s.db.Model(&SyncLog{}).Where("id = ?", syncID).Updates(map[string]interface{}{
				"processed_channels": processedChannels,
				"total_videos_added": totalVideosAdded,
			})
		}

		s.db.Model(&SyncLog{}).Where("id = ?", syncID).Updates(map[string]interface{}{
			"status":             "completed",
			"processed_channels": processedChannels,
			"total_videos_added": totalVideosAdded,
			"completed_at":       time.Now(),
		})
	}
}

// GetSyncStatus returns the sync status for a user
func (s *Service) GetSyncStatus(userID uint) (*SyncStatusResponse, error) {
	var currentSync SyncLog
	err := s.db.Where("user_id = ? AND status = ?", userID, "running").
		Order("created_at DESC").
		First(&currentSync).Error

	isSyncing := err == nil

	var lastSync SyncLog
	err = s.db.Where("user_id = ? AND status IN ?", userID, []string{"completed", "failed"}).
		Order("created_at DESC").
		First(&lastSync).Error

	var lastSyncResponse *SyncLogResponse
	if err == nil {
		lastSyncResponse = &SyncLogResponse{
			ID:                lastSync.ID,
			Type:              lastSync.Type,
			Status:            lastSync.Status,
			TotalChannels:     lastSync.TotalChannels,
			ProcessedChannels: lastSync.ProcessedChannels,
			TotalVideosAdded:  lastSync.TotalVideosAdded,
			ErrorMessage:      lastSync.ErrorMessage,
			StartedAt:         lastSync.StartedAt,
			CompletedAt:       lastSync.CompletedAt,
		}
	}

	var currentSyncResponse *SyncLogResponse
	if isSyncing {
		currentSyncResponse = &SyncLogResponse{
			ID:                currentSync.ID,
			Type:              currentSync.Type,
			Status:            currentSync.Status,
			TotalChannels:     currentSync.TotalChannels,
			ProcessedChannels: currentSync.ProcessedChannels,
			TotalVideosAdded:  currentSync.TotalVideosAdded,
			StartedAt:         currentSync.StartedAt,
		}
	}

	return &SyncStatusResponse{
		IsSyncing:   isSyncing,
		LastSync:    lastSyncResponse,
		CurrentSync: currentSyncResponse,
	}, nil
}
