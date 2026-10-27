package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestConfigureStaticApp(t *testing.T) {
	dir := t.TempDir()
	for name, content := range map[string]string{
		"index.html": "<html>app</html>",
		"app.js":     "console.log('app');",
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("STATIC_DIR", dir)

	app := fiber.New()
	app.Get("/api/version", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"version": "test"})
	})
	configureStaticApp(app)

	tests := []struct {
		name   string
		method string
		path   string
		accept string
		status int
		body   string
	}{
		{"index", http.MethodGet, "/", "", http.StatusOK, "<html>app</html>"},
		{"asset", http.MethodGet, "/app.js", "", http.StatusOK, "console.log('app');"},
		{"spa route", http.MethodGet, "/diary/entries", "text/html", http.StatusOK, "<html>app</html>"},
		{"head asset", http.MethodHead, "/app.js", "", http.StatusOK, ""},
		{"head spa route", http.MethodHead, "/diary/entries", "text/html", http.StatusOK, ""},
		{"api route", http.MethodGet, "/api/version", "text/html", http.StatusOK, `{"version":"test"}`},
		{"missing api", http.MethodGet, "/api/missing", "text/html", http.StatusNotFound, "Not Found"},
		{"missing asset", http.MethodGet, "/missing.js", "text/html", http.StatusNotFound, "Not Found"},
		{"non html", http.MethodGet, "/diary/entries", "application/json", http.StatusNotFound, "Not Found"},
		{"post", http.MethodPost, "/diary/entries", "text/html", http.StatusMethodNotAllowed, "Method Not Allowed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			req.Header.Set("Accept", tt.accept)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				t.Fatal(err)
			}
			if resp.StatusCode != tt.status || string(body) != tt.body {
				t.Fatalf("got %d %q, want %d %q", resp.StatusCode, body, tt.status, tt.body)
			}
		})
	}
}

func TestConfigureStaticAppMissingDirectory(t *testing.T) {
	t.Setenv("STATIC_DIR", filepath.Join(t.TempDir(), "missing"))
	app := fiber.New()
	configureStaticApp(app)

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("got status %d, want %d", resp.StatusCode, http.StatusNotFound)
	}
}
