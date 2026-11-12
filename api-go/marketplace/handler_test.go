package marketplace

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/gofiber/fiber/v3"
)

type testAuth struct{}

func (testAuth) GenerateToken(*user.User) (*user.AuthTokenResponse, error) {
	return nil, errors.New("not used")
}
func (testAuth) ValidateToken(token string) (*user.User, error) {
	if token == "owner" {
		return &user.User{ID: 1}, nil
	}
	if token == "other" {
		return &user.User{ID: 2}, nil
	}
	return nil, errors.New("invalid token")
}

func TestSearchRoutesAuthenticationOwnershipAndValidation(t *testing.T) {
	service := NewService(testDB(t), nil, nil)
	app := fiber.New()
	NewHandler(service).RegisterRoutes(app, user.NewAuthMiddleware(testAuth{}), true)
	request := func(method, path, token, body string, status int) []byte {
		t.Helper()
		req := httptest.NewRequest(method, "/api/marketplace-searches"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		response, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		data, err := io.ReadAll(response.Body)
		if err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != status {
			t.Fatalf("%s %s = %d, want %d: %s", method, path, response.StatusCode, status, data)
		}
		return data
	}
	request("GET", "", "", "", http.StatusUnauthorized)
	config := request("GET", "/configuration", "owner", "", 200)
	if !strings.Contains(string(config), `"telegramConfigured":false`) || !strings.Contains(string(config), `"available":false`) {
		t.Fatalf("configuration hides unavailable integrations: %s", config)
	}
	body := `{"keywords":"bike","maxPriceCents":10000,"marketplaces":["ebay"],"enabled":true}`
	created := request("POST", "", "owner", body, 201)
	var search Search
	if err := json.Unmarshal(created, &search); err != nil || search.ID == 0 || !search.Enabled {
		t.Fatalf("create = %s / %v", created, err)
	}
	if string(request("GET", "", "other", "", 200)) != "[]" {
		t.Fatal("search list leaked another user's rules")
	}
	for _, method := range []string{"PUT", "DELETE"} {
		request(method, "/1", "other", body, 404)
	}
	request("GET", "/1/matches", "other", "", 404)
	request("PUT", "/0", "owner", body, 400)
	request("DELETE", "/invalid", "owner", "", 400)
	request("POST", "", "owner", "{", 400)
	request("POST", "", "owner", `{"keywords":"bike","maxPriceCents":1.5,"marketplaces":["ebay"]}`, 400)
	request("POST", "", "owner", `{"keywords":"bike","maxPriceCents":100,"marketplaces":["facebook"]}`, 422)
	request("POST", "", "owner", `{"keywords":"bike","maxPriceCents":0,"marketplaces":["ebay"]}`, 422)
	request("PUT", "/1", "owner", strings.Replace(body, `"enabled":true`, `"enabled":false`, 1), 200)
	request("GET", "/1/matches", "owner", "", 200)
	request("DELETE", "/1", "owner", "", 204)
	request("GET", "/1/matches", "owner", "", 404)
}
