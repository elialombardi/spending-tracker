package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func configureStaticApp(app *fiber.App) {
	staticDir := getenv("STATIC_DIR", "./public")
	info, err := os.Stat(staticDir)
	if err != nil || !info.IsDir() {
		log.Printf("static app disabled: directory %q not available", staticDir)
		return
	}

	app.Static("/", staticDir)
	app.Get("*", func(c *fiber.Ctx) error {
		if c.Method() != fiber.MethodGet && c.Method() != fiber.MethodHead {
			return c.SendStatus(fiber.StatusNotFound)
		}

		requestPath := c.Path()
		if strings.HasPrefix(requestPath, "/api/") {
			return c.SendStatus(fiber.StatusNotFound)
		}
		if filepath.Ext(requestPath) != "" {
			return c.SendStatus(fiber.StatusNotFound)
		}
		acceptsHTML := strings.Contains(strings.ToLower(c.Get(fiber.HeaderAccept)), "text/html")
		if !acceptsHTML {
			return c.SendStatus(fiber.StatusNotFound)
		}

		return c.SendFile(filepath.Join(staticDir, "index.html"))
	})
	log.Printf("serving static app from %s", staticDir)
}
