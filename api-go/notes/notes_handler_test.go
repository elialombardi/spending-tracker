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

func TestHandlersBindFolderTypesAndListFields(t *testing.T) {
	service := NewNotesService(newNotesTestDB(t))
	handler := NewNotesHandler(service)
	app := fiber.New()
	app.Get("/folders/tree", handler.ListFolderTree)
	app.Post("/folders", handler.CreateFolder)
	app.Put("/folders/:id", handler.UpdateFolder)
	app.Post("/notes", handler.CreateNote)
	app.Put("/notes/:id", handler.UpdateNote)

	request := func(method, path, body string, status int, result interface{}) {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != status {
			t.Fatalf("%s %s: status = %d, want %d", method, path, resp.StatusCode, status)
		}
		if result != nil {
			if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
				t.Fatal(err)
			}
		}
	}
	var folder NoteFolderTreeResponse
	request("POST", "/folders", `{"name":"Default"}`, 201, &folder)
	if folder.Type != FolderTypeDiary {
		t.Fatalf("default response type = %q", folder.Type)
	}
	folderPath := fmt.Sprintf("/folders/%d", folder.ID)
	for _, folderType := range []string{FolderTypeBuyList, FolderTypeTasksList, FolderTypeDiary} {
		request("PUT", folderPath, fmt.Sprintf(`{"type":%q}`, folderType), 200, &folder)
		if folder.Type != folderType {
			t.Fatalf("response type = %q", folder.Type)
		}
	}
	request("POST", "/folders", `{"name":"Bad","type":"unknown"}`, 422, nil)
	request("PUT", folderPath, `{"type":""}`, 422, nil)
	request("PUT", folderPath, `{"type":"unknown"}`, 422, nil)
	request("PUT", folderPath, `{"type":123}`, 400, nil)
	var note NoteResponse
	request("POST", "/notes", fmt.Sprintf(`{"folderId":%d,"title":"Buy milk"}`, folder.ID), 201, &note)
	if note.Completed || note.EndDate != nil || note.Content != "" {
		t.Fatalf("unexpected list defaults: %+v", note)
	}
	notePath := fmt.Sprintf("/notes/%d", note.ID)
	request("PUT", notePath, `{"description":"Details","endDate":"2026-12-01","completed":true}`, 200, &note)
	if note.Description != "Details" || note.EndDate == nil || *note.EndDate != "2026-12-01" || !note.Completed {
		t.Fatalf("list fields not bound: %+v", note)
	}
	request("PUT", notePath, `{"title":"Updated"}`, 200, &note)
	if !note.Completed || note.EndDate == nil || note.Description != "Details" {
		t.Fatalf("omitted fields were reset: %+v", note)
	}
	request("PUT", notePath, `{"completed":false,"endDate":""}`, 200, &note)
	if note.Completed || note.EndDate != nil {
		t.Fatalf("explicit resets not applied: %+v", note)
	}
	request("PUT", notePath, `{"endDate":"2026-02-29"}`, 400, nil)
	request("POST", "/notes", fmt.Sprintf(`{"folderId":%d,"title":"Bad","endDate":"2026-11-31"}`, folder.ID), 400, nil)
	request("PUT", notePath, `{"completed":"yes"}`, 400, nil)
	var tree []NoteFolderTreeResponse
	request("GET", "/folders/tree", "", 200, &tree)
	if len(tree) != 1 || tree[0].Type != FolderTypeDiary || len(tree[0].Notes) != 1 ||
		tree[0].Notes[0].Completed || tree[0].Notes[0].Description != "Details" || tree[0].Notes[0].EndDate != nil {
		t.Fatalf("tree did not preserve list fields: %+v", tree)
	}
}

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
