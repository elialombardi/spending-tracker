package notes

import (
	"database/sql"
	"reflect"
	"testing"
	"time"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
)

func newNotesTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	sqlDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	sqlDB.SetMaxOpenConns(1)
	database, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := database.AutoMigrate(&db.NoteFolderEntity{}, &db.NoteEntity{}); err != nil {
		t.Fatal(err)
	}
	return database
}

func TestListFolderTreePreservesNestedNotesAndOrdering(t *testing.T) {
	database := newNotesTestDB(t)
	rootID, childID, grandchildID := uint(1), uint(2), uint(3)
	folders := []db.NoteFolderEntity{
		{ID: rootID, Name: "Z root"},
		{ID: childID, Name: "Z child", ParentID: &rootID},
		{ID: grandchildID, Name: "Grandchild", ParentID: &childID},
		{ID: 4, Name: "Great-grandchild", ParentID: &grandchildID},
		{ID: 5, Name: "A child", ParentID: &rootID},
		{ID: 6, Name: "A root"},
	}
	if err := database.Create(&folders).Error; err != nil {
		t.Fatal(err)
	}

	service := NewNotesService(database)
	noteIDsByFolder := make(map[uint][]uint)
	for _, folderID := range []uint{rootID, childID, grandchildID, 4} {
		for i := 0; i < 2; i++ {
			note, err := service.CreateNote(&CreateNoteRequest{
				FolderID: folderID,
				Title:    "Nested note",
				Content:  "Preserved content",
			})
			if err != nil {
				t.Fatal(err)
			}
			updatedAt := time.Date(2026, 10, 27, 12, i, 0, 0, time.UTC)
			if err := database.Model(&db.NoteEntity{}).Where("id = ?", note.ID).
				Update("updated_at", updatedAt).Error; err != nil {
				t.Fatal(err)
			}
			noteIDsByFolder[folderID] = append([]uint{note.ID}, noteIDsByFolder[folderID]...)
		}
	}

	for attempt := 0; attempt < 20; attempt++ {
		tree, err := service.ListFolderTree()
		if err != nil {
			t.Fatal(err)
		}
		if len(tree) != 2 || tree[0].ID != 6 || tree[1].ID != rootID {
			t.Fatalf("unexpected root ordering: %+v", tree)
		}
		root := tree[1]
		if len(root.Children) != 2 || root.Children[0].ID != 5 || root.Children[1].ID != childID {
			t.Fatalf("unexpected child ordering: %+v", root.Children)
		}
		child := root.Children[1]
		if len(child.Children) != 1 || child.Children[0].ID != grandchildID {
			t.Fatalf("missing grandchild: %+v", child.Children)
		}
		grandchild := child.Children[0]
		if len(grandchild.Children) != 1 || grandchild.Children[0].ID != 4 {
			t.Fatalf("missing great-grandchild: %+v", grandchild.Children)
		}

		var checkNode func(NoteFolderTreeResponse)
		checkNode = func(node NoteFolderTreeResponse) {
			if node.Children == nil || node.Notes == nil {
				t.Errorf("folder %d has null children or notes", node.ID)
			}
			gotIDs := make([]uint, 0, len(node.Notes))
			for _, note := range node.Notes {
				gotIDs = append(gotIDs, note.ID)
				if note.FolderID != node.ID || note.Title != "Nested note" || note.Content != "Preserved content" {
					t.Errorf("unexpected note in folder %d: %+v", node.ID, note)
				}
			}
			wantIDs := noteIDsByFolder[node.ID]
			if wantIDs == nil {
				wantIDs = []uint{}
			}
			if !reflect.DeepEqual(gotIDs, wantIDs) {
				t.Errorf("folder %d notes = %v, want %v", node.ID, gotIDs, wantIDs)
			}
			for _, child := range node.Children {
				if child.ParentID == nil || *child.ParentID != node.ID {
					t.Errorf("folder %d has incorrect parent: %v", child.ID, child.ParentID)
				}
				checkNode(child)
			}
		}
		for _, root := range tree {
			checkNode(root)
		}
		if t.Failed() {
			return
		}
	}
}

func TestListFolderTreeEmpty(t *testing.T) {
	service := NewNotesService(newNotesTestDB(t))
	tree, err := service.ListFolderTree()
	if err != nil {
		t.Fatal(err)
	}

	if tree == nil || len(tree) != 0 {
		t.Fatalf("got %+v, want an empty array", tree)
	}
}

func TestPositionsPersistAndOrderWithinSiblingGroups(t *testing.T) {
	database := newNotesTestDB(t)
	service := NewNotesService(database)
	root, err := service.CreateFolder(&CreateFolderRequest{Name: "A root", Position: 10})
	if err != nil {
		t.Fatal(err)
	}
	first, err := service.CreateFolder(&CreateFolderRequest{Name: "Z root", Position: 1})
	if err != nil {
		t.Fatal(err)
	}
	child, err := service.CreateFolder(&CreateFolderRequest{Name: "A child", ParentID: &root.ID, Position: 10})
	if err != nil {
		t.Fatal(err)
	}
	firstChild, err := service.CreateFolder(&CreateFolderRequest{Name: "Z child", ParentID: &root.ID, Position: 1})
	if err != nil {
		t.Fatal(err)
	}
	if root.Position != 10 || first.Position != 1 || child.Position != 10 || firstChild.Position != 1 {
		t.Fatal("create folder responses did not include positions")
	}
	later, err := service.CreateNote(&CreateNoteRequest{FolderID: child.ID, Title: "Later", Position: 10})
	if err != nil {
		t.Fatal(err)
	}
	earlier, err := service.CreateNote(&CreateNoteRequest{FolderID: child.ID, Title: "Earlier", Position: 1})
	if err != nil {
		t.Fatal(err)
	}
	if later.Position != 10 || earlier.Position != 1 {
		t.Fatal("create note responses did not include positions")
	}
	tree, err := service.ListFolderTree()
	if err != nil {
		t.Fatal(err)
	}
	if len(tree) != 2 || tree[0].ID != first.ID || tree[1].ID != root.ID || tree[1].Position != 10 {
		t.Fatalf("unexpected roots: %+v", tree)
	}
	children := tree[1].Children
	if len(children) != 2 || children[0].ID != firstChild.ID || children[1].ID != child.ID || children[1].Position != 10 {
		t.Fatalf("unexpected children: %+v", children)
	}
	notes := children[1].Notes
	if len(notes) != 2 || notes[0].ID != earlier.ID || notes[1].ID != later.ID || notes[1].Position != 10 {
		t.Fatalf("unexpected notes: %+v", notes)
	}

	newPosition := 20
	updatedFolder, err := service.UpdateFolder(first.ID, &UpdateFolderRequest{Position: &newPosition})
	if err != nil || updatedFolder.Position != newPosition {
		t.Fatalf("update folder: %+v, %v", updatedFolder, err)
	}
	updatedNote, err := service.UpdateNote(earlier.ID, &UpdateNoteRequest{Position: &newPosition})
	if err != nil || updatedNote.Position != newPosition {
		t.Fatalf("update note: %+v, %v", updatedNote, err)
	}
	name, title := "Renamed folder", "Renamed note"
	updatedFolder, err = service.UpdateFolder(first.ID, &UpdateFolderRequest{Name: &name})
	if err != nil || updatedFolder.Position != newPosition {
		t.Fatalf("omitted folder position: %+v, %v", updatedFolder, err)
	}
	updatedNote, err = service.UpdateNote(earlier.ID, &UpdateNoteRequest{Title: &title})
	if err != nil || updatedNote.Position != newPosition {
		t.Fatalf("omitted note position: %+v, %v", updatedNote, err)
	}
	tree, err = service.ListFolderTree()
	if err != nil {
		t.Fatal(err)
	}
	if tree[0].ID != root.ID || tree[0].Children[1].Notes[0].ID != later.ID {
		t.Fatalf("positions did not reorder tree: %+v", tree)
	}

	zero := 0
	updatedFolder, err = service.UpdateFolder(first.ID, &UpdateFolderRequest{Position: &zero})
	if err != nil || updatedFolder.Position != 0 {
		t.Fatalf("zero folder position: %+v, %v", updatedFolder, err)
	}
	updatedNote, err = service.UpdateNote(earlier.ID, &UpdateNoteRequest{Position: &zero})
	if err != nil || updatedNote.Position != 0 {
		t.Fatalf("zero note position: %+v, %v", updatedNote, err)
	}
	tree, err = service.ListFolderTree()
	if err != nil {
		t.Fatal(err)
	}
	if tree[0].ID != first.ID || tree[1].Children[1].Notes[0].ID != earlier.ID {
		t.Fatalf("zero positions did not reorder tree: %+v", tree)
	}

	negative := -1
	if _, err := service.CreateFolder(&CreateFolderRequest{Name: "Invalid", Position: negative}); err == nil {
		t.Error("negative create folder position accepted")
	}
	if _, err := service.CreateNote(&CreateNoteRequest{FolderID: root.ID, Title: "Invalid", Position: negative}); err == nil {
		t.Error("negative create note position accepted")
	}
	if _, err := service.UpdateFolder(first.ID, &UpdateFolderRequest{Position: &negative}); err == nil {
		t.Error("negative update folder position accepted")
	}
	if _, err := service.UpdateNote(earlier.ID, &UpdateNoteRequest{Position: &negative}); err == nil {
		t.Error("negative update note position accepted")
	}
}

func TestPositionTiesUseDeterministicIDs(t *testing.T) {
	database := newNotesTestDB(t)
	folders := []db.NoteFolderEntity{{ID: 2, Name: "Same", Position: 3}, {ID: 1, Name: "Same", Position: 3}}
	if err := database.Create(&folders).Error; err != nil {
		t.Fatal(err)
	}
	updatedAt := time.Date(2026, 11, 8, 12, 0, 0, 0, time.UTC)
	notes := []db.NoteEntity{
		{ID: 2, FolderID: 1, Title: "Same", Position: 3, UpdatedAt: updatedAt},
		{ID: 1, FolderID: 1, Title: "Same", Position: 3, UpdatedAt: updatedAt},
	}
	if err := database.Create(&notes).Error; err != nil {
		t.Fatal(err)
	}
	tree, err := NewNotesService(database).ListFolderTree()
	if err != nil {
		t.Fatal(err)
	}
	if len(tree) != 2 || tree[0].ID != 1 || tree[1].ID != 2 {
		t.Fatalf("unexpected folder ties: %+v", tree)
	}
	if len(tree[0].Notes) != 2 || tree[0].Notes[0].ID != 1 || tree[0].Notes[1].ID != 2 {
		t.Fatalf("unexpected note ties: %+v", tree[0].Notes)
	}
}

func TestPositionMigrationDefaultsExistingRecords(t *testing.T) {
	database := newNotesTestDB(t)
	// Recreate the pre-position schema to verify additive migration of existing data.
	statements := []string{
		"DROP TABLE notes",
		"DROP TABLE note_folders",
		"CREATE TABLE note_folders (id integer PRIMARY KEY AUTOINCREMENT, name text NOT NULL, parent_id integer)",
		"CREATE TABLE notes (id integer PRIMARY KEY AUTOINCREMENT, folder_id integer NOT NULL, title text NOT NULL, content text NOT NULL, style_json text NOT NULL DEFAULT '{}', created_at datetime, updated_at datetime)",
		"INSERT INTO note_folders (id, name) VALUES (1, 'Existing folder')",
		"INSERT INTO notes (id, folder_id, title, content) VALUES (1, 1, 'Existing note', 'Existing content')",
	}
	for _, statement := range statements {
		if err := database.Exec(statement).Error; err != nil {
			t.Fatal(err)
		}
	}
	for attempt := 0; attempt < 2; attempt++ {
		if err := database.AutoMigrate(&db.NoteFolderEntity{}, &db.NoteEntity{}); err != nil {
			t.Fatal(err)
		}
		tree, err := NewNotesService(database).ListFolderTree()
		if err != nil {
			t.Fatal(err)
		}
		if len(tree) != 1 || tree[0].Position != 0 || tree[0].Name != "Existing folder" ||
			tree[0].Type != FolderTypeDiary || len(tree[0].Notes) != 1 ||
			tree[0].Notes[0].Position != 0 || tree[0].Notes[0].Content != "Existing content" ||
			tree[0].Notes[0].Description != nil || tree[0].Notes[0].EndDate != nil || tree[0].Notes[0].Completed {
			t.Fatalf("migration changed existing data: %+v", tree)
		}
	}
}

func TestFolderTypesAndHiddenNoteFieldsSurviveConversion(t *testing.T) {
	service := NewNotesService(newNotesTestDB(t))
	folder, err := service.CreateFolder(&CreateFolderRequest{Name: "Diary"})
	if err != nil {
		t.Fatal(err)
	}
	if folder.Type != FolderTypeDiary {
		t.Fatalf("default type = %q", folder.Type)
	}
	child, err := service.CreateFolder(&CreateFolderRequest{Name: "Child", ParentID: &folder.ID})
	if err != nil {
		t.Fatal(err)
	}
	endDate := "2026-11-30"
	description := "Task description"
	note, err := service.CreateNote(&CreateNoteRequest{
		FolderID: folder.ID, Title: "Title", Content: "Diary content",
		Description: &description, EndDate: &endDate, Completed: true,
		Style: NoteStyle{Bold: true, Italic: true, TextColor: "#123456", FontSize: 24},
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, folderType := range []string{FolderTypeBuyList, FolderTypeTasksList, FolderTypeDiary} {
		updated, err := service.UpdateFolder(folder.ID, &UpdateFolderRequest{Type: &folderType})
		if err != nil {
			t.Fatal(err)
		}
		if updated.Type != folderType {
			t.Fatalf("updated type = %q", updated.Type)
		}
		tree, err := service.ListFolderTree()
		if err != nil {
			t.Fatal(err)
		}
		if tree[0].Type != folderType || tree[0].Children[0].Type != FolderTypeDiary {
			t.Fatalf("folder conversion affected child type: %+v", tree)
		}
		if !reflect.DeepEqual(tree[0].Notes[0], *note) {
			t.Fatalf("conversion changed note: %+v", tree[0].Notes[0])
		}
	}
	buyList := FolderTypeBuyList
	if _, err := service.UpdateFolder(folder.ID, &UpdateFolderRequest{Type: &buyList}); err != nil {
		t.Fatal(err)
	}
	name := "Renamed"
	updated, err := service.UpdateFolder(folder.ID, &UpdateFolderRequest{Name: &name})
	if err != nil || updated.Type != FolderTypeBuyList {
		t.Fatalf("omitted type was not preserved: %+v, %v", updated, err)
	}
	completed := false
	updatedNote, err := service.UpdateNote(note.ID, &UpdateNoteRequest{Completed: &completed, FolderID: &child.ID})
	if err != nil {
		t.Fatal(err)
	}
	if updatedNote.Completed || !reflect.DeepEqual(updatedNote.Description, note.Description) || updatedNote.Content != note.Content ||
		updatedNote.EndDate == nil || *updatedNote.EndDate != endDate || updatedNote.Style != note.Style {
		t.Fatalf("partial update lost hidden fields: %+v", updatedNote)
	}
	clear := ""
	updatedNote, err = service.UpdateNote(note.ID, &UpdateNoteRequest{EndDate: &clear, Description: &clear})
	if err != nil || updatedNote.EndDate != nil || updatedNote.Description == nil || *updatedNote.Description != "" || updatedNote.Content != note.Content {
		t.Fatalf("clear date/description: %+v, %v", updatedNote, err)
	}
}

func TestNullableDescriptionMigrationPreservesExistingValues(t *testing.T) {
	database := newNotesTestDB(t)
	service := NewNotesService(database)
	folder, err := service.CreateFolder(&CreateFolderRequest{Name: "Existing"})
	if err != nil {
		t.Fatal(err)
	}
	statements := []string{
		"DROP TABLE notes",
		"CREATE TABLE notes (" +
			"id integer PRIMARY KEY AUTOINCREMENT, folder_id integer NOT NULL, " +
			"position integer NOT NULL DEFAULT 0, title text NOT NULL, content text NOT NULL, " +
			"description text NOT NULL DEFAULT '', end_date text, " +
			"completed numeric NOT NULL DEFAULT false, style_json text NOT NULL DEFAULT '{}', " +
			"created_at datetime, updated_at datetime)",
	}
	for _, statement := range statements {
		if err := database.Exec(statement).Error; err != nil {
			t.Fatal(err)
		}
	}
	for _, description := range []string{"Existing details", ""} {
		if err := database.Exec("INSERT INTO notes (folder_id, title, content, description) VALUES (?, ?, ?, ?)",
			folder.ID, "Existing note", "Keep content", description).Error; err != nil {
			t.Fatal(err)
		}
	}
	for range 2 {
		if err := database.AutoMigrate(&db.NoteEntity{}); err != nil {
			t.Fatal(err)
		}
		var stored []db.NoteEntity
		if err := database.Order("id ASC").Find(&stored).Error; err != nil {
			t.Fatal(err)
		}
		if stored[0].Description == nil || *stored[0].Description != "Existing details" ||
			stored[1].Description == nil || *stored[1].Description != "" ||
			stored[0].Content != "Keep content" || stored[1].Content != "Keep content" {
			t.Fatalf("migration changed existing notes: %+v", stored)
		}
	}
	note, err := service.CreateNote(&CreateNoteRequest{FolderID: folder.ID, Title: "No description"})
	if err != nil {
		t.Fatal(err)
	}
	var stored db.NoteEntity
	if err := database.First(&stored, note.ID).Error; err != nil {
		t.Fatal(err)
	}
	if note.Description != nil || stored.Description != nil {
		t.Fatal("missing description was not stored and returned as NULL after migration")
	}
	columns, err := database.Migrator().ColumnTypes(&db.NoteEntity{})
	if err != nil {
		t.Fatal(err)
	}
	for _, column := range columns {
		if column.Name() == "description" {
			if nullable, ok := column.Nullable(); !ok || !nullable {
				t.Fatal("description column is not nullable")
			}
			if _, hasDefault := column.DefaultValue(); hasDefault {
				t.Fatal("description column still has the old empty-string default")
			}
			return
		}
	}
	t.Fatal("description column missing")
}

func TestNotesRejectInvalidTypesAndDates(t *testing.T) {
	service := NewNotesService(newNotesTestDB(t))
	folder, err := service.CreateFolder(&CreateFolderRequest{Name: "Tasks", Type: FolderTypeTasksList})
	if err != nil {
		t.Fatal(err)
	}
	note, err := service.CreateNote(&CreateNoteRequest{FolderID: folder.ID, Title: "Task"})
	if err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{"unknown", "buy list", "DIARY", ""} {
		if value != "" {
			if _, err := service.CreateFolder(&CreateFolderRequest{Name: "Invalid", Type: value}); err == nil {
				t.Fatalf("accepted folder type %q on create", value)
			}
		}
		if _, err := service.UpdateFolder(folder.ID, &UpdateFolderRequest{Type: &value}); err == nil {
			t.Fatalf("accepted folder type %q on update", value)
		}
	}
	for _, value := range []string{"2026-02-29", "2026-11-31", "2026-1-01", "tomorrow", "2026-11-10T07:00:00Z"} {
		if _, err := service.CreateNote(&CreateNoteRequest{FolderID: folder.ID, Title: "Bad", EndDate: &value}); err == nil {
			t.Fatalf("accepted date %q on create", value)
		}
		if _, err := service.UpdateNote(note.ID, &UpdateNoteRequest{EndDate: &value}); err == nil {
			t.Fatalf("accepted date %q on update", value)
		}
	}
	valid := "2028-02-29"
	if _, err := service.UpdateNote(note.ID, &UpdateNoteRequest{EndDate: &valid}); err != nil {
		t.Fatalf("rejected valid leap day: %v", err)
	}
}
