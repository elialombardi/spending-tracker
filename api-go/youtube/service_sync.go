package youtube

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/jobs"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const syncTimeout = 10 * time.Minute

var (
	ErrYouTubeNotConnected = errors.New("YouTube is not connected; connect your Google account before syncing subscriptions")
	ErrSyncInProgress      = errors.New("a sync is already pending or running")
)

func (s *Service) connectedUserIDs() ([]uint, error) {
	var userIDs []uint
	if err := s.db.WithContext(s.ctx).Model(&OAuthToken{}).Pluck("user_id", &userIDs).Error; err != nil {
		return nil, fmt.Errorf("failed to get YouTube-connected users: %w", err)
	}
	return userIDs, nil
}

func (s *Service) getOAuthToken(userID uint) (*OAuthToken, error) {
	return s.getOAuthTokenContext(s.ctx, userID)
}

func (s *Service) getOAuthTokenContext(ctx context.Context, userID uint) (*OAuthToken, error) {
	var token OAuthToken
	result := s.db.WithContext(ctx).Where("user_id = ?", userID).Limit(1).Find(&token)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to load YouTube OAuth token: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, ErrYouTubeNotConnected
	}
	return &token, nil
}

func (s *Service) StartBackgroundSync(ctx context.Context) <-chan struct{} {
	return jobs.Start(ctx, 6*time.Hour, func(context.Context) { s.runBackgroundSync() })
}

func (s *Service) runBackgroundSync() {
	if err := s.SyncAllUsersSubscriptions(); err != nil && !errors.Is(err, ErrYouTubeNotConnected) {
		log.Printf("[YouTube] Background sync: %v", err)
	}
}

func (s *Service) SyncAllUsersSubscriptions() error {
	userIDs, err := s.connectedUserIDs()
	if err != nil {
		return err
	}
	if len(userIDs) == 0 {
		return ErrYouTubeNotConnected
	}
	var failures []error
	for _, userID := range userIDs {
		if s.ctx.Err() != nil {
			return errors.Join(append(failures, s.ctx.Err())...)
		}
		if _, err := s.SyncAllSubscribedChannels(userID); err != nil && !errors.Is(err, ErrSyncInProgress) {
			failures = append(failures, fmt.Errorf("sync user %d: %w", userID, err))
		}
	}
	return errors.Join(failures...)
}

func (s *Service) youtubeClient(ctx context.Context, userID uint, requireOAuth bool) (*youtube.Service, error) {
	token, err := s.getOAuthTokenContext(ctx, userID)
	client := s.httpClient
	if err == nil {
		oauthToken := &oauth2.Token{
			AccessToken: token.AccessToken, RefreshToken: token.RefreshToken,
			TokenType: token.TokenType, Expiry: token.Expiry,
		}
		client = s.oauthConfig.Client(context.WithValue(ctx, oauth2.HTTPClient, s.httpClient), oauthToken)
		client.Timeout = s.httpClient.Timeout
	} else if !errors.Is(err, ErrYouTubeNotConnected) || requireOAuth || s.apiKey == "" {
		return nil, err
	}
	api, err := youtube.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("create YouTube client: %w", err)
	}
	return api, nil
}

func (s *Service) fetchSubscribedChannelsWithOAuth(userID uint) ([]YoutubeChannel, error) {
	ctx, cancel := context.WithTimeout(s.ctx, syncTimeout)
	defer cancel()
	api, err := s.youtubeClient(ctx, userID, true)
	if err != nil {
		return nil, err
	}
	return loadSubscribedChannels(ctx, api)
}

func thumbnailURL(thumbnails *youtube.ThumbnailDetails) string {
	if thumbnails == nil {
		return ""
	}
	for _, thumbnail := range []*youtube.Thumbnail{thumbnails.High, thumbnails.Medium, thumbnails.Default} {
		if thumbnail != nil && thumbnail.Url != "" {
			return thumbnail.Url
		}
	}
	return ""
}

func loadSubscribedChannels(ctx context.Context, api *youtube.Service) ([]YoutubeChannel, error) {
	channels := []YoutubeChannel{}
	pageToken := ""
	for {
		response, err := api.Subscriptions.List([]string{"snippet"}).
			Mine(true).MaxResults(50).PageToken(pageToken).Context(ctx).Do()
		if err != nil {
			return nil, fmt.Errorf("fetch subscriptions: %w", err)
		}
		ids := make([]string, 0, len(response.Items))
		for _, item := range response.Items {
			if item.Snippet == nil || item.Snippet.ResourceId == nil || item.Snippet.ResourceId.ChannelId == "" {
				return nil, errors.New("subscription is missing its subscribed channel ID")
			}
			ids = append(ids, item.Snippet.ResourceId.ChannelId)
		}
		stats, err := loadChannelStatistics(ctx, api, ids)
		if err != nil {
			return nil, err
		}
		for _, item := range response.Items {
			id := item.Snippet.ResourceId.ChannelId
			counts, present := stats[id]
			if !present {
				return nil, fmt.Errorf("statistics unavailable for subscribed channel %s", id)
			}
			channels = append(channels, YoutubeChannel{
				ID: id, Name: item.Snippet.Title, Description: item.Snippet.Description,
				Thumbnail:       thumbnailURL(item.Snippet.Thumbnails),
				SubscriberCount: counts.SubscriberCount, VideoCount: counts.VideoCount, ViewCount: counts.ViewCount,
			})
		}
		if response.NextPageToken == "" {
			return channels, nil
		}
		if response.NextPageToken == pageToken {
			return nil, errors.New("YouTube returned a repeated subscription page token")
		}
		pageToken = response.NextPageToken
	}
}

type channelStats struct {
	SubscriberCount int64
	VideoCount      int64
	ViewCount       int64
}

func loadChannelStatistics(ctx context.Context, api *youtube.Service, ids []string) (map[string]channelStats, error) {
	result := make(map[string]channelStats, len(ids))
	for start := 0; start < len(ids); start += 50 {
		end := min(start+50, len(ids))
		response, err := api.Channels.List([]string{"statistics"}).Id(strings.Join(ids[start:end], ",")).Context(ctx).Do()
		if err != nil {
			return nil, fmt.Errorf("fetch channel statistics: %w", err)
		}
		for _, item := range response.Items {
			stats := item.Statistics
			if stats == nil || stats.SubscriberCount > math.MaxInt64 || stats.VideoCount > math.MaxInt64 || stats.ViewCount > math.MaxInt64 {
				return nil, fmt.Errorf("channel %s statistics are missing or exceed the supported count range", item.Id)
			}
			result[item.Id] = channelStats{
				SubscriberCount: int64(stats.SubscriberCount), VideoCount: int64(stats.VideoCount), ViewCount: int64(stats.ViewCount),
			}
		}
	}
	return result, nil
}

func (s *Service) SyncAllSubscribedChannels(userID uint) (*SyncLog, error) {
	if _, err := s.getOAuthToken(userID); err != nil {
		return nil, err
	}
	return s.startSync(userID, "subscriptions", "")
}

func (s *Service) SyncAllChannels(userID uint) (*SyncLog, error) {
	return s.startSync(userID, "all", "")
}

func (s *Service) SyncChannel(userID uint, channelID string) (*SyncLog, error) {
	return s.startSync(userID, "channel", channelID)
}

func (s *Service) SyncTagChannels(userID uint, tagID string) (*SyncLog, error) {
	return s.startSync(userID, "tag", tagID)
}

func expireSyncs(database *gorm.DB, userID uint) error {
	return database.Model(&SyncLog{}).Where("user_id = ? AND status IN ? AND created_at < ?", userID, []string{"pending", "running"}, time.Now().UTC().Add(-syncTimeout)).
		Updates(map[string]any{"status": "failed", "error_message": "Sync expired before completion.", "completed_at": time.Now().UTC()}).Error
}

func (s *Service) startSync(userID uint, syncType, targetID string) (*SyncLog, error) {
	s.jobMu.Lock()
	defer s.jobMu.Unlock()
	if s.stopping || s.ctx.Err() != nil {
		return nil, errors.New("YouTube sync service is shutting down")
	}
	syncLog := &SyncLog{ID: uuid.NewString(), UserID: userID, Type: syncType, TargetID: targetID, Status: "pending", CreatedAt: time.Now().UTC()}
	err := s.db.WithContext(s.ctx).Transaction(func(tx *gorm.DB) error {
		// The user row serializes claims across application instances without adding a unique constraint to existing logs.
		var owner struct{ ID uint }
		if err := tx.Table("users").Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").Where("id = ?", userID).Take(&owner).Error; err != nil {
			return fmt.Errorf("lock sync owner: %w", err)
		}
		if err := expireSyncs(tx, userID); err != nil {
			return err
		}
		var active int64
		if err := tx.Model(&SyncLog{}).Where("user_id = ? AND status IN ?", userID, []string{"pending", "running"}).Count(&active).Error; err != nil {
			return err
		}
		if active > 0 {
			return ErrSyncInProgress
		}
		return tx.Create(syncLog).Error
	})
	if err != nil {
		return nil, err
	}
	s.jobWG.Add(1)
	go func() {
		defer s.jobWG.Done()
		ctx, cancel := context.WithDeadline(s.ctx, syncLog.CreatedAt.Add(syncTimeout))
		defer cancel()
		var err error
		select {
		case s.jobSlots <- struct{}{}:
			defer func() { <-s.jobSlots }()
			err = s.performSync(ctx, *syncLog)
		case <-ctx.Done():
			err = ctx.Err()
		}
		s.finishSync(syncLog.ID, err)
	}()
	return syncLog, nil
}

func (s *Service) updateSync(ctx context.Context, id string, updates map[string]any) error {
	result := s.db.WithContext(ctx).Model(&SyncLog{}).Where("id = ? AND status = ?", id, "running").Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("sync is no longer running")
	}
	return nil
}

func (s *Service) finishSync(id string, syncErr error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	status, message := "completed", ""
	if syncErr != nil {
		status, message = "failed", syncErr.Error()
		log.Printf("[YouTube] Sync %s failed: %v", id, syncErr)
	}
	result := s.db.WithContext(ctx).Model(&SyncLog{}).Where("id = ? AND status IN ?", id, []string{"pending", "running"}).
		Updates(map[string]any{"status": status, "error_message": message, "completed_at": time.Now().UTC()})
	if result.Error != nil {
		log.Printf("[YouTube] Cannot persist final status for sync %s: %v", id, result.Error)
	} else if result.RowsAffected != 1 {
		log.Printf("[YouTube] Sync %s was already terminated", id)
	}
}

func (s *Service) fetchChannelVideos(ctx context.Context, api *youtube.Service, channelID string) ([]YoutubeVideo, error) {
	var options []googleapi.CallOption
	if s.apiKey != "" {
		options = append(options, googleapi.QueryParameter("key", s.apiKey))
	}
	response, err := api.Search.List([]string{"snippet"}).ChannelId(channelID).
		Order("date").MaxResults(50).Type("video").Context(ctx).Do(options...)
	if err != nil {
		return nil, fmt.Errorf("fetch videos for channel %s: %w", channelID, err)
	}
	videos := make([]YoutubeVideo, 0, len(response.Items))
	for _, item := range response.Items {
		if item.Id == nil || item.Id.VideoId == "" || item.Snippet == nil {
			return nil, errors.New("YouTube video result is missing its ID or snippet")
		}
		publishedAt, err := time.Parse(time.RFC3339, item.Snippet.PublishedAt)
		if err != nil {
			return nil, fmt.Errorf("parse publication date for video %s: %w", item.Id.VideoId, err)
		}
		videos = append(videos, YoutubeVideo{
			ID: item.Id.VideoId, ChannelID: channelID, Title: item.Snippet.Title,
			Description: item.Snippet.Description, Thumbnail: thumbnailURL(item.Snippet.Thumbnails),
			PublishedAt: publishedAt, URL: "https://www.youtube.com/watch?v=" + item.Id.VideoId,
		})
	}
	return videos, nil
}

func (s *Service) persistChannel(ctx context.Context, channel YoutubeChannel, videos []YoutubeVideo, refreshDetails bool) (int, error) {
	added := 0
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if refreshDetails {
			var existing YoutubeChannel
			result := tx.Where("id = ? AND user_id = ?", channel.ID, channel.UserID).Limit(1).Find(&existing)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				if err := tx.Omit("Tags", "Videos").Create(&channel).Error; err != nil {
					return err
				}
			} else if err := tx.Model(&existing).Updates(map[string]any{
				"name": channel.Name, "description": channel.Description, "thumbnail": channel.Thumbnail,
				"subscriber_count": channel.SubscriberCount, "video_count": channel.VideoCount,
				"view_count": channel.ViewCount,
			}).Error; err != nil {
				return err
			}
		}
		if len(videos) > 0 {
			ids := make([]string, len(videos))
			for i := range videos {
				ids[i] = videos[i].ID
			}
			var existing []string
			if err := tx.Model(&YoutubeVideo{}).Where("id IN ?", ids).Pluck("id", &existing).Error; err != nil {
				return err
			}
			known := make(map[string]bool, len(existing))
			for _, id := range existing {
				known[id] = true
			}
			for _, video := range videos {
				if !known[video.ID] {
					added++
					known[video.ID] = true
				}
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "id"}},
				DoUpdates: clause.AssignmentColumns([]string{"title", "description", "thumbnail", "published_at", "url", "updated_at"}),
			}).CreateInBatches(&videos, 50).Error; err != nil {
				return err
			}
		}
		result := tx.Model(&YoutubeChannel{}).Where("id = ? AND user_id = ?", channel.ID, channel.UserID).Update("last_synced_at", time.Now().UTC())
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return errors.New("channel no longer belongs to the syncing user")
		}
		return nil
	})
	return added, err
}

func (s *Service) SyncChannelVideos(userID uint, channelID string) error {
	ctx, cancel := context.WithTimeout(s.ctx, syncTimeout)
	defer cancel()
	var channel YoutubeChannel
	if err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", channelID, userID).First(&channel).Error; err != nil {
		return fmt.Errorf("channel not found: %w", err)
	}
	api, err := s.youtubeClient(ctx, userID, false)
	if err != nil {
		return err
	}
	videos, err := s.fetchChannelVideos(ctx, api, channelID)
	if err != nil {
		return err
	}
	_, err = s.persistChannel(ctx, channel, videos, false)
	return err
}

func (s *Service) performSync(ctx context.Context, syncLog SyncLog) error {
	result := s.db.WithContext(ctx).Model(&SyncLog{}).Where("id = ? AND status = ?", syncLog.ID, "pending").
		Updates(map[string]any{"status": "running", "started_at": time.Now().UTC()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("sync is no longer pending")
	}
	var channels []YoutubeChannel
	var api *youtube.Service
	var err error
	if syncLog.Type == "subscriptions" {
		api, err = s.youtubeClient(ctx, syncLog.UserID, true)
		if err == nil {
			channels, err = loadSubscribedChannels(ctx, api)
		}
	} else {
		query := s.db.WithContext(ctx).Model(&YoutubeChannel{}).Where("youtube_channels.user_id = ?", syncLog.UserID)
		switch syncLog.Type {
		case "all":
		case "channel":
			query = query.Where("youtube_channels.id = ?", syncLog.TargetID)
		case "tag":
			query = query.Joins("JOIN channel_tags ON channel_tags.channel_id = youtube_channels.id").Where("channel_tags.tag_id = ?", syncLog.TargetID)
		default:
			return fmt.Errorf("unsupported sync type %q", syncLog.Type)
		}
		err = query.Find(&channels).Error
		if err == nil && len(channels) > 0 {
			api, err = s.youtubeClient(ctx, syncLog.UserID, false)
		}
	}
	if err != nil {
		return err
	}
	if err := s.updateSync(ctx, syncLog.ID, map[string]any{"total_channels": len(channels)}); err != nil {
		return err
	}
	var failures []error
	processed, added := 0, 0
	for _, channel := range channels {
		if ctx.Err() != nil {
			return errors.Join(append(failures, ctx.Err())...)
		}
		channel.UserID = syncLog.UserID
		videos, err := s.fetchChannelVideos(ctx, api, channel.ID)
		if err == nil {
			var count int
			count, err = s.persistChannel(ctx, channel, videos, syncLog.Type == "subscriptions")
			if err == nil {
				processed++
				added += count
			}
		}
		if err != nil {
			failures = append(failures, fmt.Errorf("sync channel %s: %w", channel.ID, err))
		}
		if err := s.updateSync(ctx, syncLog.ID, map[string]any{"processed_channels": processed, "total_videos_added": added}); err != nil {
			return errors.Join(append(failures, err)...)
		}
	}
	return errors.Join(failures...)
}

func syncLogResponse(entry SyncLog) *SyncLogResponse {
	return &SyncLogResponse{
		ID: entry.ID, Type: entry.Type, Status: entry.Status, TotalChannels: entry.TotalChannels,
		ProcessedChannels: entry.ProcessedChannels, TotalVideosAdded: entry.TotalVideosAdded,
		ErrorMessage: entry.ErrorMessage, StartedAt: entry.StartedAt, CompletedAt: entry.CompletedAt,
	}
}

func (s *Service) GetSyncStatus(userID uint) (*SyncStatusResponse, error) {
	if err := expireSyncs(s.db, userID); err != nil {
		return nil, err
	}
	response := &SyncStatusResponse{}
	var current SyncLog
	result := s.db.Where("user_id = ? AND status IN ?", userID, []string{"pending", "running"}).Order("created_at DESC").Limit(1).Find(&current)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected > 0 {
		response.IsSyncing = true
		response.CurrentSync = syncLogResponse(current)
	}
	var last SyncLog
	result = s.db.Where("user_id = ? AND status IN ?", userID, []string{"completed", "failed"}).Order("created_at DESC").Limit(1).Find(&last)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected > 0 {
		response.LastSync = syncLogResponse(last)
	}
	return response, nil
}
