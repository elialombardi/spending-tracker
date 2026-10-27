package youtube

import "time"

// ChannelResponse represents a channel in API responses
type ChannelResponse struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Description     string          `json:"description"`
	Thumbnail       string          `json:"thumbnail"`
	SubscriberCount int64           `json:"subscriberCount"`
	VideoCount      int64           `json:"videoCount"`
	ViewCount       int64           `json:"viewCount"`
	CustomURL       string          `json:"customUrl"`
	Country         string          `json:"country"`
	LastSyncedAt    *time.Time      `json:"lastSyncedAt"`
	Tags            []TagResponse   `json:"tags"`
	RecentVideos    []VideoResponse `json:"recentVideos,omitempty"`
}

// VideoResponse represents a video in API responses
type VideoResponse struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Thumbnail   string    `json:"thumbnail"`
	PublishedAt time.Time `json:"publishedAt"`
	Duration    string    `json:"duration"`
	ViewCount   int64     `json:"viewCount"`
	URL         string    `json:"url"`
}

// TagResponse represents a tag in API responses
type TagResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Color        string `json:"color"`
	ChannelCount int    `json:"channelCount"`
}

// CreateTagRequest represents the request body for creating a tag
type CreateTagRequest struct {
	Name        string `json:"name" validate:"required,max=100"`
	Description string `json:"description" validate:"max=500"`
	Color       string `json:"color" validate:"len=7"`
}

// UpdateTagRequest represents the request body for updating a tag
type UpdateTagRequest struct {
	Name        string `json:"name" validate:"max=100"`
	Description string `json:"description" validate:"max=500"`
	Color       string `json:"color" validate:"len=7"`
}

// AddTagsRequest represents the request body for adding tags to a channel
type AddTagsRequest struct {
	TagIDs []string `json:"tagIds" validate:"required,min=1"`
}

// RemoveTagsRequest represents the request body for removing tags from a channel
type RemoveTagsRequest struct {
	TagIDs []string `json:"tagIds" validate:"required,min=1"`
}

// SyncStatusResponse represents the sync status
type SyncStatusResponse struct {
	IsSyncing   bool             `json:"isSyncing"`
	LastSync    *SyncLogResponse `json:"lastSync"`
	CurrentSync *SyncLogResponse `json:"currentSync"`
}

// SyncLogResponse represents a sync log in API responses
type SyncLogResponse struct {
	ID                string     `json:"id"`
	Type              string     `json:"type"`
	Status            string     `json:"status"`
	TotalChannels     int        `json:"totalChannels"`
	ProcessedChannels int        `json:"processedChannels"`
	TotalVideosAdded  int        `json:"totalVideosAdded"`
	ErrorMessage      string     `json:"errorMessage,omitempty"`
	StartedAt         *time.Time `json:"startedAt"`
	CompletedAt       *time.Time `json:"completedAt"`
}

// ChannelsByTagResponse represents channels grouped by tag
type ChannelsByTagResponse struct {
	Tag      TagResponse       `json:"tag"`
	Channels []ChannelResponse `json:"channels"`
}
