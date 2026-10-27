package youtube

import (
	"testing"
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/youtube/v3"
	"gorm.io/gorm"
)

func TestNewService(t *testing.T) {
	t.Setenv("YOUTUBE_API_KEY", "test-api-key")
	db := &gorm.DB{}
	config := OAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		RedirectURL:  "http://localhost/oauth/callback",
	}

	service := NewService(db, config)

	if service.db != db {
		t.Fatal("service did not retain the database dependency")
	}
	if service.apiKey != "test-api-key" {
		t.Errorf("API key = %q, want test-api-key", service.apiKey)
	}
	if service.oauthConfig.ClientID != config.ClientID ||
		service.oauthConfig.ClientSecret != config.ClientSecret ||
		service.oauthConfig.RedirectURL != config.RedirectURL {
		t.Error("service did not retain the supplied OAuth configuration")
	}
	if service.oauthConfig.Endpoint != google.Endpoint {
		t.Error("OAuth endpoint is not Google's endpoint")
	}
	if len(service.oauthConfig.Scopes) != 1 ||
		service.oauthConfig.Scopes[0] != youtube.YoutubeReadonlyScope {
		t.Errorf("unexpected OAuth scopes: %v", service.oauthConfig.Scopes)
	}
	if service.httpClient == nil || service.httpClient.Timeout != 30*time.Second {
		t.Error("HTTP client must have a 30-second timeout")
	}
}
