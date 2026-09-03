package locations

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
)

// Config holds application configuration
type Config struct {
	GeoapifyAPIKey string
	Timeout        time.Duration
}

// GeoapifyRequest represents the request to Geoapify API
type GeoapifyRequest struct {
	Text   string `json:"text" query:"text"`
	Format string `json:"format" query:"format"`
	Limit  int    `json:"limit" query:"limit"`
	Lang   string `json:"lang" query:"lang"`
	Type   string `json:"type" query:"type"`
	Filter string `json:"filter" query:"filter"`
	Bias   string `json:"bias" query:"bias"`
	APIKey string `json:"apiKey" query:"apiKey"`
}

// GeoapifyResponse is a generic wrapper for Geoapify responses
type GeoapifyResponse struct {
	Results []map[string]interface{} `json:"results"`
	Query   map[string]interface{}   `json:"query"`
	Error   string                   `json:"error,omitempty"`
}

// loadConfig loads configuration from environment variables
func loadConfig() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	config := &Config{
		GeoapifyAPIKey: os.Getenv("GEOAPIFY_API_KEY"),
		Timeout:        30 * time.Second,
	}

	// Set defaults
	if config.GeoapifyAPIKey == "" {
		config.GeoapifyAPIKey = "beda7b674b274da98447806454bf6cbe" // Your provided key
	}

	return config, nil
}

// NewGeoapifyProxy creates a new proxy instance
func NewGeoapifyProxy(config *Config) *GeoapifyProxy {
	return &GeoapifyProxy{
		config: config,
		client: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

// GeoapifyProxy handles proxying requests to Geoapify API
type GeoapifyProxy struct {
	config *Config
	client *http.Client
}

// proxyRequest handles the actual proxying to Geoapify
func (p *GeoapifyProxy) proxyRequest(c *fiber.Ctx, path string) error {
	// Parse query parameters
	var req GeoapifyRequest
	if err := c.QueryParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid query parameters",
		})
	}

	// Use API key from config if not provided in request
	apiKey := req.APIKey
	if apiKey == "" {
		apiKey = p.config.GeoapifyAPIKey
	}

	// Build the Geoapify API URL
	baseURL := "https://api.geoapify.com"
	targetURL := fmt.Sprintf("%s%s", baseURL, path)

	// Build query parameters
	params := url.Values{}
	if req.Text != "" {
		params.Add("text", req.Text)
	}
	if req.Format != "" {
		params.Add("format", req.Format)
	}
	if req.Limit > 0 {
		params.Add("limit", fmt.Sprintf("%d", req.Limit))
	}
	if req.Lang != "" {
		params.Add("lang", req.Lang)
	}
	if req.Type != "" {
		params.Add("type", req.Type)
	}
	if req.Filter != "" {
		params.Add("filter", req.Filter)
	}
	if req.Bias != "" {
		params.Add("bias", req.Bias)
	}
	params.Add("apiKey", apiKey)

	// Append query parameters to URL
	if len(params) > 0 {
		targetURL = targetURL + "?" + params.Encode()
	}

	log.Printf("Proxying request to: %s", targetURL)

	// Create the HTTP request
	httpReq, err := http.NewRequestWithContext(c.Context(), c.Method(), targetURL, nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create request",
		})
	}

	// Set headers
	httpReq.Header.Set("Accept", "application/json")
	// Don't set Accept-Encoding to let Go handle it automatically, or set it to identity
	httpReq.Header.Set("Accept-Encoding", "identity") // Request uncompressed data
	httpReq.Header.Set("User-Agent", "Geoapify-Proxy/1.0")

	// Forward the request
	resp, err := p.client.Do(httpReq)
	if err != nil {
		log.Printf("Error forwarding request: %v", err)
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to connect to Geoapify: %v", err),
		})
	}
	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to read response",
		})
	}

	// Log first few bytes for debugging
	if len(body) > 0 {
		log.Printf("First 10 bytes of response: %v", body[:min(10, len(body))])
	}

	// Check if the response is gzipped (magic bytes: 0x1F 0x8B)
	isGzipped := len(body) >= 2 && body[0] == 0x1F && body[1] == 0x8B

	if isGzipped {
		log.Println("Detected gzip compressed response, decompressing...")

		// Create a gzip reader
		gzipReader, err := gzip.NewReader(bytes.NewReader(body))
		if err != nil {
			log.Printf("Failed to create gzip reader: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to decompress gzip response",
			})
		}
		defer gzipReader.Close()

		// Read decompressed data
		decompressedBody, err := io.ReadAll(gzipReader)
		if err != nil {
			log.Printf("Failed to read decompressed data: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to read decompressed response",
			})
		}

		body = decompressedBody
		log.Printf("Decompressed body length: %d bytes", len(body))
	}

	// Check if Geoapify returned an error
	if resp.StatusCode != http.StatusOK {
		var errorResponse map[string]interface{}
		if err := json.Unmarshal(body, &errorResponse); err == nil {
			return c.Status(resp.StatusCode).JSON(errorResponse)
		}
		return c.Status(resp.StatusCode).SendString(string(body))
	}

	// Parse the JSON response
	var jsonResponse map[string]interface{}
	if err := json.Unmarshal(body, &jsonResponse); err != nil {
		log.Printf("Failed to parse JSON: %v", err)
		// If it's not JSON, return as string
		return c.Status(resp.StatusCode).SendString(string(body))
	}

	// Log success
	if results, exists := jsonResponse["results"]; exists {
		if resultsSlice, ok := results.([]interface{}); ok {
			log.Printf("Successfully fetched %d results", len(resultsSlice))
		}
	}

	// Set response headers
	c.Set("Content-Type", "application/json")
	c.Set("Cache-Control", "public, max-age=300")
	c.Set("Vary", "Accept-Encoding")

	// Return the JSON response
	return c.Status(resp.StatusCode).JSON(jsonResponse)
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Router handles routing to different Geoapify endpoints
func (p *GeoapifyProxy) Router(app *fiber.App) {
	// Geocoding endpoints
	app.Get("/v1/geocode/search", func(c *fiber.Ctx) error {
		return p.proxyRequest(c, "/v1/geocode/search")
	})

	app.Get("/v1/geocode/reverse", func(c *fiber.Ctx) error {
		return p.proxyRequest(c, "/v1/geocode/reverse")
	})

	app.Get("/v1/geocode/autocomplete", func(c *fiber.Ctx) error {
		return p.proxyRequest(c, "/v1/geocode/autocomplete")
	})

	// Places endpoints
	app.Get("/v2/places", func(c *fiber.Ctx) error {
		return p.proxyRequest(c, "/v2/places")
	})

	// Routing endpoints
	app.Get("/v1/routing", func(c *fiber.Ctx) error {
		return p.proxyRequest(c, "/v1/routing")
	})

	app.Get("/v1/routing/waypoints", func(c *fiber.Ctx) error {
		return p.proxyRequest(c, "/v1/routing/waypoints")
	})

	// Isoline endpoints
	app.Get("/v1/isoline", func(c *fiber.Ctx) error {
		return p.proxyRequest(c, "/v1/isoline")
	})

	// Catch-all for any other Geoapify endpoint
	app.All("/*", func(c *fiber.Ctx) error {
		path := c.Path()
		// Only proxy if the path starts with /v1/ or /v2/
		if strings.HasPrefix(path, "/v1/") || strings.HasPrefix(path, "/v2/") {
			return p.proxyRequest(c, path)
		}
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Endpoint not found",
		})
	})
}
