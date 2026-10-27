package youtube

import (
	"time"

	"gorm.io/gorm"
)

type OAuthToken struct {
	UserID       uint   `gorm:"primaryKey"`
	AccessToken  string `gorm:"type:text;not null"`
	RefreshToken string `gorm:"type:text"`
	TokenType    string `gorm:"size:50"`
	Expiry       time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// YoutubeChannel represents a YouTube channel
type YoutubeChannel struct {
	ID              string `gorm:"primaryKey;type:varchar(100)"`
	UserID          uint   `gorm:"type:bigint;not null;index"`
	Name            string `gorm:"not null"`
	Description     string
	Thumbnail       string
	PublishedAt     *time.Time
	SubscriberCount int64
	VideoCount      int64
	ViewCount       int64
	CustomURL       string
	Country         string
	LastSyncedAt    *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       gorm.DeletedAt `gorm:"index"`

	// Relationships
	Tags   []Tag          `gorm:"many2many:channel_tags;"`
	Videos []YoutubeVideo `gorm:"foreignKey:ChannelID"`
}

func (YoutubeChannel) TableName() string { return "youtube_channels" }
func (YoutubeVideo) TableName() string   { return "youtube_videos" }
func (Tag) TableName() string            { return "youtube_tags" }
func (ChannelTag) TableName() string     { return "channel_tags" }
func (SyncLog) TableName() string        { return "youtube_sync_logs" }
func (Subscription) TableName() string   { return "youtube_subscriptions" }

// YoutubeVideo represents a YouTube video
type YoutubeVideo struct {
	ID           string `gorm:"primaryKey;type:varchar(100)"`
	ChannelID    string `gorm:"type:varchar(100);index;not null"`
	Title        string `gorm:"not null"`
	Description  string
	Thumbnail    string
	PublishedAt  time.Time `gorm:"index"`
	Duration     string
	ViewCount    int64
	LikeCount    int64
	CommentCount int64
	URL          string
	CreatedAt    time.Time
	UpdatedAt    time.Time

	// Relationships
	Channel *YoutubeChannel `gorm:"foreignKey:ChannelID"`
}

// Tag represents a tag that can be applied to channels
type Tag struct {
	ID          string `gorm:"primaryKey;type:varchar(36)"`
	Name        string `gorm:"unique;not null;size:100"`
	Description string
	Color       string `gorm:"size:7"` // Hex color code
	CreatedBy   uint   `gorm:"type:bigint;not null;index"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`

	// Relationships
	Channels []YoutubeChannel `gorm:"many2many:channel_tags;"`
}

// ChannelTag represents the junction table for channels and tags
type ChannelTag struct {
	ChannelID string `gorm:"type:varchar(100);primaryKey"`
	TagID     string `gorm:"type:varchar(36);primaryKey"`
	CreatedAt time.Time
}

// SyncLog represents a sync operation log
type SyncLog struct {
	ID                string `gorm:"primaryKey;type:varchar(36)"`
	UserID            uint   `gorm:"type:bigint;not null;index"`
	Type              string `gorm:"size:20;not null"`  // "all", "channel", "tag"
	TargetID          string `gorm:"type:varchar(100)"` // Channel ID or Tag ID
	Status            string `gorm:"size:20;not null"`  // "pending", "running", "completed", "failed"
	TotalChannels     int
	ProcessedChannels int
	TotalVideosAdded  int
	ErrorMessage      string
	StartedAt         *time.Time
	CompletedAt       *time.Time
	CreatedAt         time.Time
}

// Subscription represents a user's subscription to a YouTube channel
// This is essentially the same as the UserID - ChannelID link in YoutubeChannel
// but kept as a separate concept for clarity
type Subscription struct {
	UserID    uint   `gorm:"type:bigint;not null;index;primaryKey"`
	ChannelID string `gorm:"type:varchar(100);primaryKey"`
	CreatedAt time.Time
}
