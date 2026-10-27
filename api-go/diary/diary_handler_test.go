package diary

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
)

type bindingService struct {
	userID  uint
	listReq ListEntriesRequest
	date    time.Time
	content string
}

func (s *bindingService) GetEntries(_ context.Context, userID uint, req ListEntriesRequest) ([]DiaryEntryDTO, int64, error) {
	s.userID, s.listReq = userID, req
	return []DiaryEntryDTO{}, 0, nil
}

func (s *bindingService) CreateEntry(_ context.Context, userID uint, date time.Time, content string) (*DiaryEntryDTO, error) {
	s.userID, s.date, s.content = userID, date, content
	return &DiaryEntryDTO{ID: 1, Date: date.Format("2006-01-02"), Content: content}, nil
}

func (s *bindingService) GetEntryByDate(context.Context, uint, time.Time) (*DiaryEntryDTO, error) {
	return nil, errors.New("unexpected GetEntryByDate call")
}

func (s *bindingService) UpdateEntry(context.Context, uint, time.Time, string) (*DiaryEntryDTO, error) {
	return nil, errors.New("unexpected UpdateEntry call")
}

func TestHandlerBinding(t *testing.T) {
	tests := []struct {
		name        string
		method      string
		path        string
		contentType string
		body        string
		status      int
	}{
		{"query", http.MethodGet, "/entries?page=2&limit=5&search=hello&from=2026-10-01&to=2026-10-31", "", "", http.StatusOK},
		{"invalid query", http.MethodGet, "/entries?page=invalid", "", "", http.StatusBadRequest},
		{"json", http.MethodPost, "/entries", "application/json", `{"date":"2026-10-27","content":"hello"}`, http.StatusCreated},
		{"json charset", http.MethodPost, "/entries", "application/json; charset=utf-8", `{"date":"2026-10-27","content":"hello"}`, http.StatusCreated},
		{"invalid json", http.MethodPost, "/entries", "application/json", `{"date":`, http.StatusBadRequest},
		{"unsupported body", http.MethodPost, "/entries", "text/plain", "hello", http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &bindingService{}
			handler := NewHandler(service)
			app := fiber.New()
			app.Use(func(c fiber.Ctx) error {
				c.Locals(user.UserIDKey, uint(42))
				return c.Next()
			})
			app.Get("/entries", handler.ListEntries)
			app.Post("/entries", handler.CreateEntry)

			req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
			req.Header.Set("Content-Type", tt.contentType)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tt.status {
				t.Fatalf("got status %d, want %d", resp.StatusCode, tt.status)
			}
			switch tt.status {
			case http.StatusOK:
				want := ListEntriesRequest{Page: 2, Limit: 5, Search: "hello", From: "2026-10-01", To: "2026-10-31"}
				if service.userID != 42 || service.listReq != want {
					t.Fatalf("unexpected service arguments: user %d, request %+v", service.userID, service.listReq)
				}
			case http.StatusCreated:
				if service.userID != 42 || service.date.Format("2006-01-02") != "2026-10-27" || service.content != "hello" {
					t.Fatalf("unexpected service arguments: %+v", service)
				}
				var entry DiaryEntryDTO
				if err := json.NewDecoder(resp.Body).Decode(&entry); err != nil {
					t.Fatal(err)
				}
				if entry.ID != 1 || entry.Date != "2026-10-27" || entry.Content != "hello" {
					t.Fatalf("unexpected response: %+v", entry)
				}
			case http.StatusBadRequest:
				if service.userID != 0 {
					t.Fatal("invalid input reached the service")
				}
			}
		})
	}
}
