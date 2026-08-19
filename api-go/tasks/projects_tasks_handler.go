package tasks

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ProjectTaskHandler struct {
	service *ProjectTaskService
}

func NewProjectTaskHandler(service *ProjectTaskService) *ProjectTaskHandler {
	return &ProjectTaskHandler{service: service}
}

func (h *ProjectTaskHandler) RegisterRoutes(app *fiber.App, authMiddleware *user.AuthMiddleware) {
	api := app.Group("/api")

	projectRoutes := api.Group("/projects", authMiddleware.Authenticate)
	{
		projectRoutes.Get("/", h.listProjects)
		projectRoutes.Get("/:id", h.getProject)
		projectRoutes.Post("/", h.createProject)
		projectRoutes.Put("/:id", h.updateProject)
		projectRoutes.Delete("/:id", h.deleteProject)

	}
	taskRoutes := api.Group("/tasks", authMiddleware.Authenticate)
	{
		taskRoutes.Get("/", h.listTasks)
		taskRoutes.Get("/:id", h.getTask)
		taskRoutes.Post("/", h.createTask)
		taskRoutes.Put("/:id", h.updateTask)
		taskRoutes.Delete("/:id", h.deleteTask)
	}
}

func (h *ProjectTaskHandler) listProjects(c *fiber.Ctx) error {
	projects, err := h.service.ListProjects()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	response := make([]Project, 0, len(projects))
	for _, project := range projects {
		response = append(response, mapProjectEntity(project))
	}
	return c.JSON(response)
}

func (h *ProjectTaskHandler) getProject(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	project, err := h.service.GetProject(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(mapProjectEntity(project))
}

func (h *ProjectTaskHandler) createProject(c *fiber.Ctx) error {
	var payload Project
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Name) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Name required")
	}

	project, err := h.service.CreateProject(db.ProjectEntity{
		Name:        strings.TrimSpace(payload.Name),
		Description: nullableStringPointer(payload.Description),
	})
	if err != nil {
		if db.IsUniqueConstraint(err) {
			return c.Status(fiber.StatusConflict).SendString("Project already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Location("/api/projects/" + strconv.Itoa(project.ID))
	return c.Status(fiber.StatusCreated).JSON(mapProjectEntity(project))
}

func (h *ProjectTaskHandler) updateProject(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var payload Project
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Name) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Name required")
	}

	project, err := h.service.UpdateProject(id, db.ProjectEntity{
		Name:        strings.TrimSpace(payload.Name),
		Description: nullableStringPointer(payload.Description),
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		if db.IsUniqueConstraint(err) {
			return c.Status(fiber.StatusConflict).SendString("Project already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(mapProjectEntity(project))
}

func (h *ProjectTaskHandler) deleteProject(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	deleted, err := h.service.DeleteProject(id)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "foreign key") {
			return c.Status(fiber.StatusConflict).SendString("Project is referenced by existing tasks")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *ProjectTaskHandler) listTasks(c *fiber.Ctx) error {
	tasks, err := h.service.ListTasks()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	response := make([]TaskDetails, 0, len(tasks))
	for _, task := range tasks {
		response = append(response, mapTaskWithProject(task))
	}
	return c.JSON(response)
}

func (h *ProjectTaskHandler) getTask(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	task, err := h.service.GetTask(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(mapTaskWithProject(task))
}

func (h *ProjectTaskHandler) createTask(c *fiber.Ctx) error {
	var payload Task
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if err := validateTaskPayload(payload); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString(err.Error())
	}

	task, err := h.service.CreateTask(db.TaskEntity{
		ProjectID:   &payload.ProjectID,
		Name:        strings.TrimSpace(payload.Name),
		Cost:        payload.Cost,
		TaskDate:    strings.TrimSpace(payload.Date),
		SentOn:      nullableStringPointer(payload.SentOn),
		Description: nullableStringPointer(payload.Description),
	})
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "foreign key") {
			return c.Status(fiber.StatusBadRequest).SendString("Project does not exist")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Location("/api/tasks/" + strconv.Itoa(task.Task.ID))
	return c.Status(fiber.StatusCreated).JSON(mapTaskWithProject(task))
}

func (h *ProjectTaskHandler) updateTask(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var payload Task
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if err := validateTaskPayload(payload); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString(err.Error())
	}

	task, err := h.service.UpdateTask(id, db.TaskEntity{
		ProjectID:   &payload.ProjectID,
		Name:        strings.TrimSpace(payload.Name),
		Cost:        payload.Cost,
		TaskDate:    strings.TrimSpace(payload.Date),
		SentOn:      nullableStringPointer(payload.SentOn),
		Description: nullableStringPointer(payload.Description),
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		if strings.Contains(strings.ToLower(err.Error()), "foreign key") {
			return c.Status(fiber.StatusBadRequest).SendString("Project does not exist")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(mapTaskWithProject(task))
}

func (h *ProjectTaskHandler) deleteTask(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	deleted, err := h.service.DeleteTask(id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"success": true})
}

func mapProjectEntity(project db.ProjectEntity) Project {
	response := Project{
		ID:   project.ID,
		Name: project.Name,
	}
	if project.Description != nil {
		response.Description = *project.Description
	}
	return response
}

func mapTaskWithProject(task TaskWithProject) TaskDetails {
	var projectID int
	if task.Task.ProjectID != nil {
		projectID = *task.Task.ProjectID
	}

	response := TaskDetails{
		ID:          task.Task.ID,
		ProjectID:   projectID,
		ProjectName: task.Project.Name,
		Name:        task.Task.Name,
		Cost:        task.Task.Cost,
		Date:        task.Task.TaskDate,
	}
	if task.Task.SentOn != nil {
		response.SentOn = *task.Task.SentOn
	}
	if task.Task.Description != nil {
		response.Description = *task.Task.Description
	}
	return response
}

func validateTaskPayload(payload Task) error {
	if payload.ProjectID <= 0 {
		return errors.New("ProjectId required")
	}
	if strings.TrimSpace(payload.Name) == "" {
		return errors.New("Name required")
	}
	if strings.TrimSpace(payload.Date) == "" {
		return errors.New("Date required")
	}
	if _, err := time.Parse("2006-01-02", strings.TrimSpace(payload.Date)); err != nil {
		return errors.New("Date must be yyyy-MM-dd")
	}
	if strings.TrimSpace(payload.SentOn) != "" {
		if _, err := time.Parse("2006-01-02", strings.TrimSpace(payload.SentOn)); err != nil {
			return errors.New("SentOn must be yyyy-MM-dd")
		}
	}
	return nil
}

func nullableStringPointer(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
