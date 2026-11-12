package marketplace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Ebay struct {
	clientID, secret string
	http             *http.Client
	baseURL          string
	mu               sync.Mutex
	token            string
	expiresAt        time.Time
}

func NewEbay(clientID, secret string) (*Ebay, error) {
	if clientID == "" && secret == "" {
		return nil, nil
	}
	if strings.TrimSpace(clientID) == "" || strings.TrimSpace(secret) == "" {
		return nil, errors.New("EBAY_CLIENT_ID and EBAY_CLIENT_SECRET must both be configured")
	}
	return &Ebay{clientID: clientID, secret: secret, baseURL: "https://api.ebay.com",
		http: &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		}}}, nil
}

func (e *Ebay) accessToken(ctx context.Context) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.token != "" && time.Now().Before(e.expiresAt) {
		return e.token, nil
	}
	form := url.Values{"grant_type": {"client_credentials"}, "scope": {"https://api.ebay.com/oauth/api_scope"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.baseURL+"/identity/v1/oauth2/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(e.clientID, e.secret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var token struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := e.request(req, &token); err != nil {
		return "", fmt.Errorf("eBay authorization: %w", err)
	}
	if token.AccessToken == "" || token.ExpiresIn <= 60 {
		return "", errors.New("eBay returned an invalid access token")
	}
	e.token = token.AccessToken
	e.expiresAt = time.Now().Add(time.Duration(token.ExpiresIn-60) * time.Second)
	return e.token, nil
}

func (e *Ebay) request(req *http.Request, target any) error {
	resp, err := e.http.Do(req)
	if err != nil {
		if req.Context().Err() != nil {
			return req.Context().Err()
		}
		return errors.New("eBay request failed (transport error or timeout)")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("eBay returned HTTP %d", resp.StatusCode)
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4*1024*1024)).Decode(target); err != nil {
		return errors.New("invalid eBay response")
	}
	return nil
}

func (e *Ebay) Search(ctx context.Context, keywords string, maximum int64) ([]Listing, error) {
	token, err := e.accessToken(ctx)
	if err != nil {
		return nil, err
	}
	listings := make([]Listing, 0)
	for offset := 0; offset < 10000; offset += 200 {
		query := url.Values{
			"q": {keywords}, "limit": {"200"}, "offset": {strconv.Itoa(offset)},
			"filter": {fmt.Sprintf("price:[0..%s],priceCurrency:EUR,deliveryCountry:IT,buyingOptions:{FIXED_PRICE}", euroAmount(maximum))},
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, e.baseURL+"/buy/browse/v1/item_summary/search?"+query.Encode(), nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("X-EBAY-C-MARKETPLACE-ID", "EBAY_IT")
		var page struct {
			Total *int `json:"total"`
			Items []struct {
				ID    string `json:"itemId"`
				Title string `json:"title"`
				URL   string `json:"itemWebUrl"`
				Price struct {
					Value    string `json:"value"`
					Currency string `json:"currency"`
				} `json:"price"`
			} `json:"itemSummaries"`
		}
		if err := e.request(req, &page); err != nil {
			return nil, err
		}
		if page.Total == nil || *page.Total < 0 {
			return nil, errors.New("eBay response is missing a valid total")
		}
		if *page.Total > 10000 {
			return nil, errors.New("eBay search exceeds 10,000 results; use more specific keywords")
		}
		for _, item := range page.Items {
			price, err := parseEuroCents(item.Price.Value)
			if err != nil {
				return nil, fmt.Errorf("invalid eBay listing price: %w", err)
			}
			listings = append(listings, Listing{ID: item.ID, Title: item.Title, URL: item.URL,
				PriceCents: price, Currency: item.Price.Currency})
		}
		if offset+len(page.Items) >= *page.Total {
			return listings, nil
		}
		if len(page.Items) == 0 {
			return nil, errors.New("eBay returned an incomplete search page")
		}
	}
	return nil, errors.New("eBay search pagination limit reached")
}

func euroAmount(cents int64) string {
	return fmt.Sprintf("%d.%02d", cents/100, cents%100)
}

func parseEuroCents(value string) (int64, error) {
	whole, fraction, _ := strings.Cut(value, ".")
	if whole == "" || len(fraction) > 2 {
		return 0, errors.New("expected a non-negative price with at most two decimals")
	}
	digits := whole + fraction + strings.Repeat("0", 2-len(fraction))
	for _, digit := range digits {
		if digit < '0' || digit > '9' {
			return 0, errors.New("invalid price digits")
		}
	}
	return strconv.ParseInt(digits, 10, 64)
}
