package youtube

import (
	"context"
	"net/http"
	"os"
	"sync"
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
	ctx         context.Context
	cancel      context.CancelFunc
	jobMu       sync.Mutex
	jobWG       sync.WaitGroup
	jobSlots    chan struct{}
	stopping    bool
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
	ctx, cancel := context.WithCancel(context.Background())

	return &Service{
		db:          db,
		apiKey:      apiKey,
		oauthConfig: config,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
		ctx:         ctx,
		cancel:      cancel,
		jobSlots:    make(chan struct{}, 4),
	}
}

func (s *Service) Cancel() {
	s.cancel()
}

func (s *Service) Shutdown(ctx context.Context) error {
	s.cancel()
	s.jobMu.Lock()
	s.stopping = true
	s.jobMu.Unlock()
	done := make(chan struct{})
	go func() {
		s.jobWG.Wait()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
