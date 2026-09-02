package notes

import (
	"strconv"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
)

type NotesHandler struct {
	service  NotesService
	validate *validator.Validate
}

func NewNotesHandler(service NotesService) *NotesHandler {
	return &NotesHandler{
		service:  service,
		validate: validator.New(),
	}
}

func (h *NotesHandler) RegisterRoutes(app *fiber.App, authMiddleware *user.AuthMiddleware) {
	api := app.Group("/api")

	folders := api.Group("/note-folders", authMiddleware.Authenticate)
	folders.Get("/tree", h.ListFolderTree)
	folders.Post("/", h.CreateFolder)
	folders.Put("/:id", h.UpdateFolder)
	folders.Delete("/:id", h.DeleteFolder)

	notes := api.Group("/notes", authMiddleware.Authenticate)
	notes.Post("/", h.CreateNote)
	notes.Put("/:id", h.UpdateNote)
	notes.Delete("/:id", h.DeleteNote)
}

func (h *NotesHandler) ListFolderTree(c *fiber.Ctx) error {
	tree, err := h.service.ListFolderTree()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tree)
}

func (h *NotesHandler) CreateFolder(c *fiber.Ctx) error {
	var req CreateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}
	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}

	resp, err := h.service.CreateFolder(&req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

func (h *NotesHandler) UpdateFolder(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	var req UpdateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}
	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}

	resp, updateErr := h.service.UpdateFolder(uint(id), &req)
	if updateErr != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": updateErr.Error()})
	}
	return c.JSON(resp)
}

func (h *NotesHandler) DeleteFolder(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	if err := h.service.DeleteFolder(uint(id)); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *NotesHandler) CreateNote(c *fiber.Ctx) error {
	var req CreateNoteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}
	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}

	resp, err := h.service.CreateNote(&req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(resp)
}

func (h *NotesHandler) UpdateNote(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	var req UpdateNoteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON body"})
	}
	if err := h.validate.Struct(&req); err != nil {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{"error": err.Error()})
	}

	resp, updateErr := h.service.UpdateNote(uint(id), &req)
	if updateErr != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": updateErr.Error()})
	}
	return c.JSON(resp)
}

func (h *NotesHandler) DeleteNote(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID parameter"})
	}

	if err := h.service.DeleteNote(uint(id)); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
