package main

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/your/repo/spendingtracker.go/internal/db"
	"github.com/your/repo/spendingtracker.go/internal/models"
)

func listLocations(c *fiber.Ctx) error {
	locations, err := db.FetchLocations(database, 0)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(locations)
}

func getLocation(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	location, err := db.FetchLocationByID(database, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(location)
}

func createLocation(c *fiber.Ctx) error {
	var payload models.Location
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Title) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Title required")
	}

	location, err := db.InsertLocation(database, payload)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Location("/locations/" + strconv.Itoa(location.ID))
	return c.Status(fiber.StatusCreated).JSON(location)
}

func updateLocation(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var payload models.Location
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Title) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Title required")
	}

	location, err := db.ReplaceLocation(database, id, payload)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(location)
}

func deleteLocation(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	deleted, err := db.DeleteLocationByID(database, id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"success": true})
}

func toggleLocationTag(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var payload struct {
		Tag     string `json:"tag"`
		Present bool   `json:"present"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	payload.Tag = strings.TrimSpace(payload.Tag)
	if payload.Tag == "" {
		return c.Status(fiber.StatusBadRequest).SendString("tag required")
	}

	location, err := db.UpdateLocationTag(database, id, payload.Tag, payload.Present)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(location)
}

func listTags(c *fiber.Ctx) error {
	tags, err := db.FetchTags(database)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(tags)
}

func createTag(c *fiber.Ctx) error {
	var payload struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	payload.Name = strings.TrimSpace(payload.Name)
	if payload.Name == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Name required")
	}

	if err := db.InsertTag(database, payload.Name); err != nil {
		if db.IsUniqueConstraint(err) {
			return c.Status(fiber.StatusConflict).SendString("Tag already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(payload.Name)
}

func renameTag(c *fiber.Ctx) error {
	oldName := c.Params("name")
	var payload struct {
		NewName string `json:"newName"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	payload.NewName = strings.TrimSpace(payload.NewName)
	if payload.NewName == "" {
		return c.Status(fiber.StatusBadRequest).SendString("newName required")
	}

	renamed, err := db.RenameTagByName(database, oldName, payload.NewName)
	if err != nil {
		if db.IsUniqueConstraint(err) {
			return c.Status(fiber.StatusConflict).SendString("Tag with newName already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !renamed {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"oldName": oldName, "newName": payload.NewName})
}

func deleteTag(c *fiber.Ctx) error {
	deleted, err := db.DeleteTagByName(database, c.Params("name"))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"success": true})
}
