package youtube

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

func statisticsTestClient(t testing.TB) (*youtube.Service, *int) {
	t.Helper()
	calls := new(int)
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		*calls++
		ids := strings.Split(request.URL.Query().Get("id"), ",")
		if len(ids) > 50 {
			return nil, errors.New("channel statistics request exceeds the API's 50-ID limit")
		}
		items := make([]*youtube.Channel, len(ids))
		for i, id := range ids {
			items[i] = &youtube.Channel{Id: id, Statistics: &youtube.ChannelStatistics{SubscriberCount: 5, VideoCount: 10, ViewCount: 50}}
		}
		body, err := json.Marshal(youtube.ChannelListResponse{Items: items})
		if err != nil {
			return nil, err
		}
		return jsonResponse(string(body), 200), nil
	})}
	api, err := youtube.NewService(context.Background(), option.WithHTTPClient(client))
	if err != nil {
		t.Fatal(err)
	}
	return api, calls
}

func TestChannelStatisticsBatchLimitAndValues(t *testing.T) {
	api, calls := statisticsTestClient(t)
	ids := make([]string, 120)
	for i := range ids {
		ids[i] = fmt.Sprintf("channel-%d", i)
	}
	stats, err := loadChannelStatistics(context.Background(), api, ids)
	if err != nil {
		t.Fatal(err)
	}
	if *calls != 3 || len(stats) != 120 || stats["channel-119"].SubscriberCount != 5 {
		t.Fatalf("calls = %d, statistics = %d", *calls, len(stats))
	}
}

func TestSubscriptionPaginationBatchesStatisticsAndUsesResourceID(t *testing.T) {
	subscriptionCalls, statisticsCalls := 0, 0
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		switch {
		case strings.HasSuffix(request.URL.Path, "/subscriptions"):
			subscriptionCalls++
			start, end, next := 0, 50, "next"
			if request.URL.Query().Get("pageToken") == "next" {
				start, end, next = 50, 75, ""
			}
			items := make([]*youtube.Subscription, 0, end-start)
			for i := start; i < end; i++ {
				items = append(items, &youtube.Subscription{Snippet: &youtube.SubscriptionSnippet{
					ChannelId: "owner", ResourceId: &youtube.ResourceId{ChannelId: "target-" + strconv.Itoa(i)}, Title: "Channel",
				}})
			}
			body, err := json.Marshal(youtube.SubscriptionListResponse{Items: items, NextPageToken: next})
			if err != nil {
				return nil, err
			}
			return jsonResponse(string(body), 200), nil
		case strings.HasSuffix(request.URL.Path, "/channels"):
			statisticsCalls++
			ids := strings.Split(request.URL.Query().Get("id"), ",")
			if len(ids) > 50 {
				return nil, errors.New("too many channel IDs")
			}
			items := make([]*youtube.Channel, len(ids))
			for i, id := range ids {
				items[i] = &youtube.Channel{Id: id, Statistics: &youtube.ChannelStatistics{SubscriberCount: 1}}
			}
			body, err := json.Marshal(youtube.ChannelListResponse{Items: items})
			if err != nil {
				return nil, err
			}
			return jsonResponse(string(body), 200), nil
		default:
			return nil, errors.New("unexpected request")
		}
	})}
	api, err := youtube.NewService(context.Background(), option.WithHTTPClient(client))
	if err != nil {
		t.Fatal(err)
	}
	channels, err := loadSubscribedChannels(context.Background(), api)
	if err != nil {
		t.Fatal(err)
	}
	if len(channels) != 75 || subscriptionCalls != 2 || statisticsCalls != 2 || channels[74].ID != "target-74" || channels[74].SubscriberCount != 1 {
		t.Fatalf("channels = %d, subscriptions = %d, statistics = %d", len(channels), subscriptionCalls, statisticsCalls)
	}
}

func TestStatisticsFailureIsNotReplacedByZeroCounts(t *testing.T) {
	for _, body := range []string{
		`{"items":[{"id":"one","statistics":{"subscriberCount":"18446744073709551615"}}]}`,
		`{"items":[{"id":"one"}]}`,
	} {
		client := &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) { return jsonResponse(body, 200), nil })}
		api, err := youtube.NewService(context.Background(), option.WithHTTPClient(client))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := loadChannelStatistics(context.Background(), api, []string{"one"}); err == nil {
			t.Fatal("invalid statistics were silently accepted")
		}
	}
}

func BenchmarkChannelStatistics(b *testing.B) {
	ids := make([]string, 100)
	for i := range ids {
		ids[i] = fmt.Sprintf("channel-%d", i)
	}
	b.Run("per-channel-baseline", func(b *testing.B) {
		api, calls := statisticsTestClient(b)
		b.ReportAllocs()
		for b.Loop() {
			for _, id := range ids {
				if _, err := loadChannelStatistics(context.Background(), api, []string{id}); err != nil {
					b.Fatal(err)
				}
			}
		}
		b.ReportMetric(float64(*calls)/float64(b.N), "requests/op")
	})
	b.Run("batched", func(b *testing.B) {
		api, calls := statisticsTestClient(b)
		b.ReportAllocs()
		for b.Loop() {
			stats, err := loadChannelStatistics(context.Background(), api, ids)
			if err != nil || len(stats) != len(ids) {
				b.Fatalf("statistics = %d, error = %v", len(stats), err)
			}
		}
		b.ReportMetric(float64(*calls)/float64(b.N), "requests/op")
	})
}
