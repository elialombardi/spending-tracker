package main

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/your/repo/spendingtracker.go/internal/db"
	"github.com/your/repo/spendingtracker.go/internal/models"
)

func listProjects(c *fiber.Ctx) error {
	projects, err := db.FetchProjects(database)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(projects)
}

func getProject(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	project, err := db.FetchProjectByID(database, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(project)
}

func createProject(c *fiber.Ctx) error {
	var payload models.Project
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Name) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Name required")
	}

	project, err := db.InsertProject(database, payload)
	if err != nil {
		if db.IsUniqueConstraint(err) {
			return c.Status(fiber.StatusConflict).SendString("Project already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Location("/api/projects/" + strconv.Itoa(project.ID))
	return c.Status(fiber.StatusCreated).JSON(project)
}

func updateProject(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var payload models.Project
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Name) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Name required")
	}

	project, err := db.ReplaceProject(database, id, payload)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		if db.IsUniqueConstraint(err) {
			return c.Status(fiber.StatusConflict).SendString("Project already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(project)
}

func deleteProject(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	deleted, err := db.DeleteProjectByID(database, id)
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

func listTasks(c *fiber.Ctx) error {
	tasks, err := db.FetchTasks(database)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(tasks)
}

func getTask(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	task, err := db.FetchTaskByID(database, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(task)
}

func createTask(c *fiber.Ctx) error {
	var payload models.Task
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if err := validateTaskPayload(payload); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString(err.Error())
	}

	task, err := db.InsertTask(database, payload)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "foreign key") {
			return c.Status(fiber.StatusBadRequest).SendString("Project does not exist")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Location("/api/tasks/" + strconv.Itoa(task.ID))
	return c.Status(fiber.StatusCreated).JSON(task)
}

func updateTask(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var payload models.Task
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if err := validateTaskPayload(payload); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString(err.Error())
	}

	task, err := db.ReplaceTask(database, id, payload)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		if strings.Contains(strings.ToLower(err.Error()), "foreign key") {
			return c.Status(fiber.StatusBadRequest).SendString("Project does not exist")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(task)
}

func deleteTask(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	deleted, err := db.DeleteTaskByID(database, id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"success": true})
}

func validateTaskPayload(payload models.Task) error {
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
