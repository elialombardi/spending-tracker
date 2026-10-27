package youtube

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func jsonResponse(body string, status int) *http.Response {
	return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(body))}
}

func newLifecycleTestService(t *testing.T) *Service {
	t.Helper()
	service, output := newSyncTestService(t)
	t.Cleanup(func() {
		if t.Failed() {
			t.Log(output.String())
		}
	})
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := service.Shutdown(ctx); err != nil {
			t.Error(err)
		}
	})
	if err := service.db.Exec("CREATE TABLE users (id INTEGER PRIMARY KEY)").Error; err != nil {
		t.Fatal(err)
	}
	if err := service.db.Exec("INSERT INTO users (id) VALUES (1), (2)").Error; err != nil {
		t.Fatal(err)
	}
	if err := service.db.AutoMigrate(&YoutubeChannel{}, &YoutubeVideo{}); err != nil {
		t.Fatal(err)
	}
	if err := service.db.Create(&OAuthToken{UserID: 1, AccessToken: "test-token", Expiry: time.Now().Add(time.Hour)}).Error; err != nil {
		t.Fatal(err)
	}
	return service
}

func waitForSyncWorkers(t *testing.T, service *Service) {
	t.Helper()
	done := make(chan struct{})
	go func() { service.jobWG.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("sync workers did not finish")
	}
}

func TestPendingSyncOwnershipAndShutdown(t *testing.T) {
	service := newLifecycleTestService(t)
	for range cap(service.jobSlots) {
		service.jobSlots <- struct{}{}
	}
	job, err := service.SyncAllChannels(1)
	if err != nil {
		t.Fatal(err)
	}
	for range 10 {
		if _, err := service.SyncAllChannels(1); !errors.Is(err, ErrSyncInProgress) {
			t.Fatalf("duplicate job error = %v", err)
		}
	}
	other := NewService(service.db, OAuthConfig{})
	defer other.Cancel()
	if _, err := other.SyncAllChannels(1); !errors.Is(err, ErrSyncInProgress) {
		t.Fatalf("second service claimed an active user: %v", err)
	}
	status, err := service.GetSyncStatus(1)
	if err != nil || !status.IsSyncing || status.CurrentSync.Status != "pending" {
		t.Fatalf("status = %+v, error = %v", status, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := service.Shutdown(ctx); err != nil {
		t.Fatal(err)
	}
	var finished SyncLog
	if err := service.db.First(&finished, "id = ?", job.ID).Error; err != nil {
		t.Fatal(err)
	}
	if finished.Status != "failed" || finished.CompletedAt == nil || !strings.Contains(finished.ErrorMessage, "canceled") {
		t.Fatalf("cancelled pending job = %+v", finished)
	}
	if _, err := service.SyncAllChannels(1); err == nil {
		t.Fatal("shutdown service accepted a new job")
	}
}

func TestRunningSyncCancellationReachesHTTPRequest(t *testing.T) {
	service := newLifecycleTestService(t)
	started := make(chan struct{})
	service.httpClient.Transport = roundTripFunc(func(request *http.Request) (*http.Response, error) {
		close(started)
		<-request.Context().Done()
		return nil, request.Context().Err()
	})
	job, err := service.SyncAllSubscribedChannels(1)
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("sync did not start its HTTP request")
	}
	if _, err := service.SyncAllSubscribedChannels(1); !errors.Is(err, ErrSyncInProgress) {
		t.Fatalf("duplicate running job error = %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := service.Shutdown(ctx); err != nil {
		t.Fatal(err)
	}
	var finished SyncLog
	if err := service.db.First(&finished, "id = ?", job.ID).Error; err != nil {
		t.Fatal(err)
	}
	if finished.Status != "failed" || finished.CompletedAt == nil || !strings.Contains(finished.ErrorMessage, "canceled") {
		t.Fatalf("cancelled running job = %+v", finished)
	}
}

func TestSyncPersistsProgressAndCountsOnlyNewVideos(t *testing.T) {
	service := newLifecycleTestService(t)
	failVideos := false
	service.httpClient.Transport = roundTripFunc(func(request *http.Request) (*http.Response, error) {
		switch {
		case strings.HasSuffix(request.URL.Path, "/subscriptions"):
			return jsonResponse(`{"items":[{"snippet":{"channelId":"owner-not-target","resourceId":{"channelId":"subscribed-channel"},"title":"Channel"}}]}`, 200), nil
		case strings.HasSuffix(request.URL.Path, "/channels"):
			if request.URL.Query().Get("id") != "subscribed-channel" {
				t.Error("statistics requested for the subscription owner instead of the subscribed channel")
			}
			return jsonResponse(`{"items":[{"id":"subscribed-channel","statistics":{"subscriberCount":"5","videoCount":"10","viewCount":"50"}}]}`, 200), nil
		case strings.HasSuffix(request.URL.Path, "/search"):
			if failVideos {
				return jsonResponse(`{"error":{"code":403,"message":"Quota exhausted"}}`, 403), nil
			}
			return jsonResponse(`{"items":[{"id":{"videoId":"video-1"},"snippet":{"title":"Video","publishedAt":"2026-10-01T10:00:00Z"}}]}`, 200), nil
		default:
			return nil, errors.New("unexpected YouTube request")
		}
	})
	for run := range 3 {
		failVideos = run == 2
		job, err := service.SyncAllSubscribedChannels(1)
		if err != nil {
			t.Fatal(err)
		}
		waitForSyncWorkers(t, service)
		var finished SyncLog
		if err := service.db.First(&finished, "id = ?", job.ID).Error; err != nil {
			t.Fatal(err)
		}
		if run == 2 {
			if finished.Status != "failed" || !strings.Contains(finished.ErrorMessage, "Quota exhausted") || finished.CompletedAt == nil {
				t.Fatalf("failed job = %+v", finished)
			}
			continue
		}
		wantAdded := 1 - run
		if finished.Status != "completed" || finished.ProcessedChannels != 1 || finished.TotalChannels != 1 || finished.TotalVideosAdded != wantAdded || finished.CompletedAt == nil {
			t.Fatalf("successful job = %+v", finished)
		}
	}
	var channel YoutubeChannel
	if err := service.db.First(&channel, "id = ?", "subscribed-channel").Error; err != nil {
		t.Fatal(err)
	}
	if channel.SubscriberCount != 5 || channel.LastSyncedAt == nil || channel.UserID != 1 {
		t.Fatalf("channel = %+v", channel)
	}
	var count int64
	if err := service.db.Model(&YoutubeVideo{}).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("video count = %d, error = %v", count, err)
	}
}

func TestExpiredSyncCanBeReclaimedAndDatabaseErrorsSurface(t *testing.T) {
	service := newLifecycleTestService(t)
	old := SyncLog{ID: "expired", UserID: 1, Type: "all", Status: "running", CreatedAt: time.Now().UTC().Add(-syncTimeout - time.Minute)}
	if err := service.db.Create(&old).Error; err != nil {
		t.Fatal(err)
	}
	for range cap(service.jobSlots) {
		service.jobSlots <- struct{}{}
	}
	if _, err := service.SyncAllChannels(1); err != nil {
		t.Fatal(err)
	}
	if err := service.db.First(&old, "id = ?", old.ID).Error; err != nil {
		t.Fatal(err)
	}
	if old.Status != "failed" || old.CompletedAt == nil {
		t.Fatalf("expired job = %+v", old)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := service.Shutdown(ctx); err != nil {
		t.Fatal(err)
	}
	if err := service.db.Migrator().DropTable(&SyncLog{}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.GetSyncStatus(1); err == nil {
		t.Fatal("sync-status database failure was ignored")
	}
}
