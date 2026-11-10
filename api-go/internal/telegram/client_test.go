package telegram

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestConfiguration(t *testing.T) {
	client, err := New("", "")
	if err != nil || client != nil {
		t.Fatalf("unconfigured client = %v, %v", client, err)
	}
	for _, config := range [][2]string{
		{"123:secret", ""}, {"", "-100123"}, {"invalid", "123"},
		{"123:secret/path", "123"}, {"123:secret", "  "},
	} {
		if _, err := New(config[0], config[1]); err == nil {
			t.Fatalf("expected invalid configuration for %q", config[1])
		}
	}
}

func TestSendTelegramMessage(t *testing.T) {
	client, err := New("123:test_token", " -100123 ")
	if err != nil {
		t.Fatal(err)
	}
	client.http.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != http.MethodPost || r.URL.String() != "https://api.telegram.org/bot123:test_token/sendMessage" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Fatal("expected JSON request")
		}
		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if len(payload) != 2 || payload["chat_id"] != "-100123" || payload["text"] != "Task <due> & ready" {
			t.Fatalf("unexpected payload: %+v", payload)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"ok":true,"result":{"message_id":1}}`))}, nil
	})
	if err := client.Send(context.Background(), "Task <due> & ready"); err != nil {
		t.Fatal(err)
	}
}

func TestSendFailuresDoNotLeakToken(t *testing.T) {
	for _, test := range []struct {
		name   string
		status int
		body   string
		err    error
	}{
		{"unauthorized", 401, `{"ok":false}`, nil},
		{"rate limit", 429, `{"ok":false}`, nil},
		{"rejected", 200, `{"ok":false}`, nil},
		{"malformed", 200, `{`, nil},
		{"transport", 0, "", errors.New("request https://api.telegram.org/bot123:secret/sendMessage failed")},
	} {
		t.Run(test.name, func(t *testing.T) {
			client, err := New("123:secret", "123")
			if err != nil {
				t.Fatal(err)
			}
			client.http.Transport = roundTripFunc(func(*http.Request) (*http.Response, error) {
				if test.err != nil {
					return nil, test.err
				}
				return &http.Response{StatusCode: test.status, Body: io.NopCloser(strings.NewReader(test.body))}, nil
			})
			err = client.Send(context.Background(), "message")
			if err == nil || strings.Contains(err.Error(), "secret") {
				t.Fatalf("expected sanitized error, got %v", err)
			}
		})
	}
}

func TestSendCancellation(t *testing.T) {
	client, err := New("123:secret", "123")
	if err != nil {
		t.Fatal(err)
	}
	client.http.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return nil, r.Context().Err()
	})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := client.Send(ctx, "message"); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancellation, got %v", err)
	}
}
