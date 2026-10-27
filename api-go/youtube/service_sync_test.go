package youtube

import (
	"bytes"
	"database/sql"
	"errors"
	"log"
	"strings"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	_ "modernc.org/sqlite"
)

func newSyncTestService(t *testing.T) (*Service, *bytes.Buffer) {
	t.Helper()
	sqlDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := sqlDB.Close(); err != nil {
			t.Error(err)
		}
	})
	sqlDB.SetMaxOpenConns(1)
	var output bytes.Buffer
	db, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{
		Logger: logger.New(log.New(&output, "", 0), logger.Config{LogLevel: logger.Info}),
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&OAuthToken{}, &SyncLog{}); err != nil {
		t.Fatal(err)
	}
	return NewService(db, OAuthConfig{}), &output
}

func TestConnectedUserIDs(t *testing.T) {
	service, _ := newSyncTestService(t)
	if err := service.db.Exec("CREATE TABLE users (id INTEGER PRIMARY KEY)").Error; err != nil {
		t.Fatal(err)
	}
	if err := service.db.Exec("INSERT INTO users (id) VALUES (1), (2)").Error; err != nil {
		t.Fatal(err)
	}
	token := OAuthToken{UserID: 1, AccessToken: "test-token"}
	if err := service.db.Create(&token).Error; err != nil {
		t.Fatal(err)
	}

	userIDs, err := service.connectedUserIDs()
	if err != nil {
		t.Fatal(err)
	}
	if len(userIDs) != 1 || userIDs[0] != 1 {
		t.Fatalf("connected users = %v, want [1]; user 2 has not connected YouTube", userIDs)
	}
}

func TestMissingOAuthToken(t *testing.T) {
	service, output := newSyncTestService(t)
	output.Reset()

	if _, err := service.SyncAllSubscribedChannels(2); !errors.Is(err, ErrYouTubeNotConnected) {
		t.Fatalf("sync error = %v, want ErrYouTubeNotConnected", err)
	}
	if _, err := service.fetchSubscribedChannelsWithOAuth(2); !errors.Is(err, ErrYouTubeNotConnected) {
		t.Fatalf("fetch error = %v, want ErrYouTubeNotConnected", err)
	}
	if strings.Contains(output.String(), "record not found") {
		t.Fatal("an expected missing token must not emit a GORM record-not-found error")
	}
	var count int64
	if err := service.db.Model(&SyncLog{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("sync log count = %d, want 0", count)
	}
}

func TestGetOAuthToken(t *testing.T) {
	service, _ := newSyncTestService(t)
	if err := service.db.Create(&OAuthToken{UserID: 2, AccessToken: "test-token"}).Error; err != nil {
		t.Fatal(err)
	}
	token, err := service.getOAuthToken(2)
	if err != nil {
		t.Fatal(err)
	}
	if token.UserID != 2 || token.AccessToken != "test-token" {
		t.Fatal("saved OAuth token was not loaded correctly")
	}
}

func TestNoConnectedUsers(t *testing.T) {
	service, output := newSyncTestService(t)
	output.Reset()
	service.runBackgroundSync()
	if strings.Contains(output.String(), "youtube_sync_logs") {
		t.Fatal("background sync should not attempt to sync users without tokens")
	}
	if err := service.SyncAllUsersSubscriptions(); !errors.Is(err, ErrYouTubeNotConnected) {
		t.Fatalf("bulk sync error = %v, want ErrYouTubeNotConnected", err)
	}
}

func TestOAuthDatabaseErrors(t *testing.T) {
	service, _ := newSyncTestService(t)
	if err := service.db.Migrator().DropTable(&OAuthToken{}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.connectedUserIDs(); err == nil {
		t.Fatal("expected connected-user query to report the missing table")
	}
	if _, err := service.getOAuthToken(2); err == nil || errors.Is(err, ErrYouTubeNotConnected) {
		t.Fatalf("token query error = %v; database failures must not be treated as disconnected users", err)
	}
	if err := service.SyncAllUsersSubscriptions(); err == nil || errors.Is(err, ErrYouTubeNotConnected) {
		t.Fatalf("bulk sync error = %v; database failures must not be treated as disconnected users", err)
	}
}
