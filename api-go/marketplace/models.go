package marketplace

import "time"

type Search struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	UserID        uint       `gorm:"index;not null" json:"-"`
	Keywords      string     `gorm:"not null" json:"keywords"`
	Marketplaces  []string   `gorm:"serializer:json;not null" json:"marketplaces"`
	MaxPriceCents int64      `gorm:"not null" json:"maxPriceCents"`
	Enabled       bool       `json:"enabled"`
	LastCheckedAt *time.Time `json:"lastCheckedAt"`
	LastError     string     `json:"lastError"`
	NextCheckAt   time.Time  `gorm:"index" json:"nextCheckAt"`
	LockedUntil   *time.Time `json:"-"`
	Revision      uint       `gorm:"not null" json:"-"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

func (Search) TableName() string { return "marketplace_searches" }

type Match struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	SearchID    uint       `gorm:"uniqueIndex:marketplace_match;index;not null" json:"searchId"`
	Marketplace string     `gorm:"uniqueIndex:marketplace_match;not null" json:"marketplace"`
	ItemID      string     `gorm:"uniqueIndex:marketplace_match;not null" json:"itemId"`
	Title       string     `json:"title"`
	URL         string     `json:"url"`
	PriceCents  int64      `json:"priceCents"`
	NotifiedAt  *time.Time `json:"notifiedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
}

func (Match) TableName() string { return "marketplace_matches" }

type SearchInput struct {
	Keywords      string   `json:"keywords"`
	Marketplaces  []string `json:"marketplaces"`
	MaxPriceCents int64    `json:"maxPriceCents"`
	Enabled       *bool    `json:"enabled"`
}

type Listing struct {
	ID         string
	Title      string
	URL        string
	PriceCents int64
	Currency   string
}
