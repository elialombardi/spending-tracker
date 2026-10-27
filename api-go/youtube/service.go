package youtube

import (
	"net/http"
	"os"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/youtube/v3"
	"gorm.io/gorm"
)

// Service holds the core dependencies for the YouTube feature
type Service struct {
	db          *gorm.DB
	apiKey      string
	oauthConfig *oauth2.Config
	httpClient  *http.Client
}
type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

// NewService creates a new YouTube service instance
func NewService(db *gorm.DB, oauthConfig OAuthConfig) *Service {
	config := &oauth2.Config{
		ClientID:     oauthConfig.ClientID,
		ClientSecret: oauthConfig.ClientSecret,
		RedirectURL:  oauthConfig.RedirectURL,
		Scopes: []string{
			youtube.YoutubeReadonlyScope,
		},
		Endpoint: google.Endpoint,
	}

	apiKey := os.Getenv("YOUTUBE_API_KEY")
	if apiKey == "" {
		// You might want to handle this differently
		apiKey = "your-api-key" // Should come from config
	}

	return &Service{
		db:          db,
		apiKey:      apiKey,
		oauthConfig: config,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}
}
