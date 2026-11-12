package marketplace

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func TestEbayOAuthItalyFiltersAndPagination(t *testing.T) {
	tokens, pages := 0, 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/identity/v1/oauth2/token" {
			tokens++
			id, secret, ok := r.BasicAuth()
			if !ok || id != "client" || secret != "secret" {
				t.Error("missing OAuth client authentication")
			}
			if err := r.ParseForm(); err != nil {
				t.Error(err)
				return
			}
			if r.Form.Get("grant_type") != "client_credentials" || r.Form.Get("scope") != "https://api.ebay.com/oauth/api_scope" {
				t.Errorf("unexpected OAuth form %v", r.Form)
			}
			fmt.Fprint(w, `{"access_token":"test-token","expires_in":7200}`)
			return
		}
		pages++
		if r.URL.Path != "/buy/browse/v1/item_summary/search" || r.Header.Get("Authorization") != "Bearer test-token" ||
			r.Header.Get("X-EBAY-C-MARKETPLACE-ID") != "EBAY_IT" {
			t.Errorf("incorrect eBay request: %s / %v", r.URL, r.Header)
		}
		q := r.URL.Query()
		if q.Get("q") != "bicycle & helmet" || q.Get("limit") != "200" ||
			q.Get("filter") != "price:[0..100.00],priceCurrency:EUR,deliveryCountry:IT,buyingOptions:{FIXED_PRICE}" {
			t.Errorf("unexpected filters %v", q)
		}
		offset, err := strconv.Atoi(q.Get("offset"))
		if err != nil {
			t.Error(err)
			return
		}
		items := make([]map[string]any, 0)
		for i := offset; i < min(offset+200, 201); i++ {
			items = append(items, map[string]any{"itemId": strconv.Itoa(i), "title": "Bicycle",
				"itemWebUrl": "https://www.ebay.it/itm/" + strconv.Itoa(i),
				"price":      map[string]string{"value": "99.99", "currency": "EUR"}})
		}
		if err := json.NewEncoder(w).Encode(map[string]any{"total": 201, "itemSummaries": items}); err != nil {
			t.Error(err)
		}
	}))
	defer server.Close()
	e, err := NewEbay("client", "secret")
	if err != nil {
		t.Fatal(err)
	}
	e.baseURL, e.http = server.URL, server.Client()
	for range 2 {
		items, err := e.Search(context.Background(), "bicycle & helmet", 10000)
		if err != nil || len(items) != 201 || items[0].PriceCents != 9999 {
			t.Fatalf("items=%d / error=%v", len(items), err)
		}
	}
	if tokens != 1 || pages != 4 {
		t.Fatalf("OAuth cache or pagination failed: tokens=%d / pages=%d", tokens, pages)
	}
}

func TestEbayErrorsAreNotEmptySuccessfulSearches(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		status     int
	}{
		{"rate limit", `{"errors":[]}`, 429},
		{"unauthorized", `{}`, 401},
		{"malformed", `{`, 200},
		{"missing total", `{}`, 200},
		{"excessive results", `{"total":10001}`, 200},
		{"incomplete page", `{"total":1,"itemSummaries":[]}`, 200},
		{"invalid price", `{"total":1,"itemSummaries":[{"price":{"value":"NaN","currency":"EUR"}}]}`, 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if strings.Contains(r.URL.Path, "oauth2/token") {
					fmt.Fprint(w, `{"access_token":"test","expires_in":7200}`)
					return
				}
				w.WriteHeader(tc.status)
				fmt.Fprint(w, tc.body)
			}))
			defer server.Close()
			e, _ := NewEbay("client", "secret")
			e.baseURL, e.http = server.URL, server.Client()
			if _, err := e.Search(context.Background(), "test", 100); err == nil {
				t.Fatal("expected explicit provider error")
			}
		})
	}
}

func TestEbayConfigurationAndExactPrices(t *testing.T) {
	if e, err := NewEbay("", ""); err != nil || e != nil {
		t.Fatalf("disabled configuration = %v / %v", e, err)
	}
	for _, pair := range [][2]string{{"id", ""}, {"", "secret"}, {" ", "secret"}} {
		if _, err := NewEbay(pair[0], pair[1]); err == nil {
			t.Fatal("partial configuration accepted")
		}
	}
	for text, want := range map[string]int64{"0": 0, "0.01": 1, "99.99": 9999, "100": 10000, "1.5": 150} {
		if got, err := parseEuroCents(text); err != nil || got != want {
			t.Fatalf("parse %q = %d / %v", text, got, err)
		}
	}
	for _, text := range []string{"", "-1", "NaN", "1.001", "1,23", "1e2", "999999999999999999999"} {
		if _, err := parseEuroCents(text); err == nil {
			t.Fatalf("accepted invalid price %q", text)
		}
	}
}
