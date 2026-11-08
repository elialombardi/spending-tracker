package notes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestHandlersBindAndValidatePositions(t *testing.T) {
	service := NewNotesService(newNotesTestDB(t))
	folder, err := service.CreateFolder(&CreateFolderRequest{Name: "Folder", Position: 5})
	if err != nil {
		t.Fatal(err)
	}
	note, err := service.CreateNote(&CreateNoteRequest{FolderID: folder.ID, Title: "Note", Position: 5})
	if err != nil {
		t.Fatal(err)
	}
	handler := NewNotesHandler(service)
	app := fiber.New()
	app.Post("/folders", handler.CreateFolder)
	app.Put("/folders/:id", handler.UpdateFolder)
	app.Post("/notes", handler.CreateNote)
	app.Put("/notes/:id", handler.UpdateNote)

	routes := []struct {
		name   string
		method string
		path   string
		fields string
		status int
	}{
		{"create folder", http.MethodPost, "/folders", `"name":"New folder"`, http.StatusCreated},
		{"update folder", http.MethodPut, fmt.Sprintf("/folders/%d", folder.ID), `"name":"Folder"`, http.StatusOK},
		{"create note", http.MethodPost, "/notes", fmt.Sprintf(`"folderId":%d,"title":"New note"`, folder.ID), http.StatusCreated},
		{"update note", http.MethodPut, fmt.Sprintf("/notes/%d", note.ID), `"title":"Note"`, http.StatusOK},
	}
	positions := []struct {
		name   string
		value  string
		status int
	}{
		{"positive", "7", 0},
		{"omitted", "", 0},
		{"zero", "0", 0},
		{"negative", "-1", http.StatusUnprocessableEntity},
		{"fractional", "1.5", http.StatusBadRequest},
		{"string", `"bad"`, http.StatusBadRequest},
	}
	for _, route := range routes {
		for _, position := range positions {
			t.Run(route.name+"/"+position.name, func(t *testing.T) {
				body := route.fields
				if position.value != "" {
					body += `,"position":` + position.value
				}
				req := httptest.NewRequest(route.method, route.path, strings.NewReader("{"+body+"}"))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req)
				if err != nil {
					t.Fatal(err)
				}
				defer resp.Body.Close()
				wantStatus := position.status
				if wantStatus == 0 {
					wantStatus = route.status
				}
				if resp.StatusCode != wantStatus {
					t.Fatalf("status = %d, want %d", resp.StatusCode, wantStatus)
				}
				if position.status != 0 {
					return
				}
				var response struct {
					Position *int `json:"position"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
					t.Fatal(err)
				}
				wantPosition := 0
				if position.value == "7" || (position.value == "" && route.method == http.MethodPut) {
					wantPosition = 7
				}
				if response.Position == nil || *response.Position != wantPosition {
					t.Fatalf("position = %v, want %d", response.Position, wantPosition)
				}
			})
		}
	}
}
