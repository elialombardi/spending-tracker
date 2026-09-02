package boxing_events

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type PinnacleClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewPinnacleClient() *PinnacleClient {
	apiKey := os.Getenv("PINNACLE_API_KEY")
	baseURL := os.Getenv("PINNACLE_BASE_URL")

	return &PinnacleClient{
		baseURL:    baseURL,
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Response structures (only fields we need)
type PinnacleMarketsResponse struct {
	SportID   int             `json:"sport_id"`
	SportName string          `json:"sport_name"`
	Last      int64           `json:"last"`
	LastCall  int64           `json:"last_call"`
	Events    []PinnacleEvent `json:"events"`
}

type PinnacleEvent struct {
	EventID    int64                  `json:"event_id"`
	SportID    int                    `json:"sport_id"`
	LeagueID   int                    `json:"league_id"`
	LeagueName string                 `json:"league_name"`
	Starts     string                 `json:"starts"` // ISO 8601
	Last       int64                  `json:"last"`
	Home       string                 `json:"home"`
	Away       string                 `json:"away"`
	EventType  string                 `json:"event_type"`
	Periods    map[string]interface{} `json:"periods"` // we only need existence
}

// FetchPrematchBoxingEvents retrieves upcoming (prematch) boxing events from Pinnacle.
func (c *PinnacleClient) FetchPrematchBoxingEvents() ([]PinnacleEvent, error) {
	url := fmt.Sprintf("%s/kit/v1/markets?sport_id=9&event_type=prematch", c.baseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-portal-apikey", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pinnacle API error: %d %s", resp.StatusCode, string(body))
	}

	var result PinnacleMarketsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Events, nil
}
