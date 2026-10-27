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
