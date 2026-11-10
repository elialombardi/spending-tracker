package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type Client struct {
	token  string
	chatID string
	http   *http.Client
}

// New returns nil when Telegram is not configured.
func New(token, chatID string) (*Client, error) {
	if token == "" && chatID == "" {
		return nil, nil
	}
	if !regexp.MustCompile(`^[0-9]+:[A-Za-z0-9_-]+$`).MatchString(token) || strings.TrimSpace(chatID) == "" {
		return nil, errors.New("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be configured with a valid bot token and nonempty chat ID")
	}
	return &Client{
		token: token, chatID: strings.TrimSpace(chatID),
		http: &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		}},
	}, nil
}

func (c *Client) Send(ctx context.Context, text string) error {
	body, err := json.Marshal(struct {
		ChatID string `json:"chat_id"`
		Text   string `json:"text"`
	}{c.chatID, text})
	if err != nil {
		return fmt.Errorf("encode Telegram message: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.telegram.org/bot"+c.token+"/sendMessage", bytes.NewReader(body))
	if err != nil {
		return errors.New("create Telegram request")
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(request)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		// Transport errors contain the request URL, which includes the bot token.
		return errors.New("Telegram request failed (transport error or timeout)")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("Telegram returned HTTP %d", response.StatusCode)
	}
	var result struct {
		OK bool `json:"ok"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 64*1024)).Decode(&result); err != nil {
		return errors.New("invalid Telegram response")
	}
	if !result.OK {
		return errors.New("Telegram rejected the message")
	}
	return nil
}
