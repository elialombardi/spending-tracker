package locations

import (
	"errors"
	"strconv"
	"strings"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/auth"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type LocationTagHandler struct {
	service *LocationService
}

func NewLocationTagHandler(service *LocationService) *LocationTagHandler {
	return &LocationTagHandler{service: service}
}

func (h *LocationTagHandler) RegisterRoutes(app *fiber.App) {
	app.Get("/locations", auth.AuthRequired(h.listLocations, []string{"Reader", "Writer", "Admin"}))
	app.Get("/locations/:id", auth.AuthRequired(h.getLocation, []string{"Reader", "Writer", "Admin"}))
	app.Post("/locations", auth.AuthRequired(h.createLocation, []string{"Writer", "Admin"}))
	app.Put("/locations/:id", auth.AuthRequired(h.updateLocation, []string{"Writer", "Admin"}))
	app.Delete("/locations/:id", auth.AuthRequired(h.deleteLocation, []string{"Writer", "Admin"}))
	app.Post("/locations/:id/tags", auth.AuthRequired(h.toggleLocationTag, []string{"Writer", "Admin"}))
	app.Get("/tags", auth.AuthRequired(h.listTags, []string{"Reader", "Writer", "Admin"}))
	app.Post("/tags", auth.AuthRequired(h.createTag, []string{"Writer", "Admin"}))
	app.Patch("/tags/:name", auth.AuthRequired(h.renameTag, []string{"Writer", "Admin"}))
	app.Delete("/tags/:name", auth.AuthRequired(h.deleteTag, []string{"Writer", "Admin"}))
}

func (h *LocationTagHandler) listLocations(c *fiber.Ctx) error {
	locations, err := h.service.ListLocations()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	response := make([]Location, 0, len(locations))
	for _, location := range locations {
		response = append(response, mapLocationEntity(location))
	}
	return c.JSON(response)
}

func (h *LocationTagHandler) getLocation(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	location, err := h.service.GetLocation(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(mapLocationEntity(location))
}

func (h *LocationTagHandler) createLocation(c *fiber.Ctx) error {
	var payload Location
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Title) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Title required")
	}

	entityPayload := db.LocationEntity{
		Title:       strings.TrimSpace(payload.Title),
		URL:         nullableStringPointer(payload.Url),
		Lat:         payload.Lat,
		Lng:         payload.Lng,
		Description: nullableStringPointer(payload.Description),
	}

	location, err := h.service.CreateLocation(entityPayload, payload.Tags)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Location("/locations/" + strconv.Itoa(location.ID))
	return c.Status(fiber.StatusCreated).JSON(mapLocationEntity(location))
}

func (h *LocationTagHandler) updateLocation(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var payload Location
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Title) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Title required")
	}

	entityPayload := db.LocationEntity{
		Title:       strings.TrimSpace(payload.Title),
		URL:         nullableStringPointer(payload.Url),
		Lat:         payload.Lat,
		Lng:         payload.Lng,
		Description: nullableStringPointer(payload.Description),
	}

	location, err := h.service.UpdateLocation(id, entityPayload, payload.Tags)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(mapLocationEntity(location))
}

func (h *LocationTagHandler) deleteLocation(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	deleted, err := h.service.DeleteLocation(id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *LocationTagHandler) toggleLocationTag(c *fiber.Ctx) error {
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

	location, err := h.service.ToggleLocationTag(id, payload.Tag, payload.Present)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(mapLocationEntity(location))
}

func (h *LocationTagHandler) listTags(c *fiber.Ctx) error {
	tags, err := h.service.ListTags()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	response := make([]string, 0, len(tags))
	for _, tag := range tags {
		response = append(response, tag.Name)
	}
	return c.JSON(response)
}

func (h *LocationTagHandler) createTag(c *fiber.Ctx) error {
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

	if err := h.service.CreateTag(payload.Name); err != nil {
		if db.IsUniqueConstraint(err) {
			return c.Status(fiber.StatusConflict).SendString("Tag already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(payload.Name)
}

func (h *LocationTagHandler) renameTag(c *fiber.Ctx) error {
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

	renamed, err := h.service.RenameTag(oldName, payload.NewName)
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

func (h *LocationTagHandler) deleteTag(c *fiber.Ctx) error {
	deleted, err := h.service.DeleteTag(c.Params("name"))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"success": true})
}

func mapLocationEntity(location db.LocationEntity) Location {
	tags := make([]string, 0, len(location.Tags))
	for _, tag := range location.Tags {
		tags = append(tags, tag.Name)
	}

	response := Location{
		ID:    location.ID,
		Title: location.Title,
		Tags:  tags,
		Lat:   location.Lat,
		Lng:   location.Lng,
	}
	if location.URL != nil {
		response.Url = *location.URL
	}
	if location.Description != nil {
		response.Description = *location.Description
	}
	return response
}

func nullableStringPointer(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
