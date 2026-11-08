package notes

import "time"

type NoteStyle struct {
	Bold            bool   `json:"bold"`
	Italic          bool   `json:"italic"`
	TextColor       string `json:"textColor"`
	BackgroundColor string `json:"backgroundColor"`
	FontSize        int    `json:"fontSize"`
}

type NoteResponse struct {
	ID        uint      `json:"id"`
	FolderID  uint      `json:"folderId"`
	Position  int       `json:"position"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Style     NoteStyle `json:"style"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type NoteFolderTreeResponse struct {
	ID       uint                     `json:"id"`
	Name     string                   `json:"name"`
	Position int                      `json:"position"`
	ParentID *uint                    `json:"parentId"`
	Children []NoteFolderTreeResponse `json:"children"`
	Notes    []NoteResponse           `json:"notes"`
}

type CreateFolderRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=100"`
	ParentID *uint  `json:"parentId"`
	Position int    `json:"position" validate:"gte=0"`
}

type UpdateFolderRequest struct {
	Name     *string `json:"name" validate:"omitempty,min=1,max=100"`
	ParentID *uint   `json:"parentId"`
	Position *int    `json:"position" validate:"omitempty,gte=0"`
}

type CreateNoteRequest struct {
	FolderID uint      `json:"folderId" validate:"required,gt=0"`
	Position int       `json:"position" validate:"gte=0"`
	Title    string    `json:"title" validate:"required,min=1,max=200"`
	Content  string    `json:"content"`
	Style    NoteStyle `json:"style"`
}

type UpdateNoteRequest struct {
	FolderID *uint      `json:"folderId,omitempty"`
	Position *int       `json:"position,omitempty" validate:"omitempty,gte=0"`
	Title    *string    `json:"title,omitempty" validate:"omitempty,min=1,max=200"`
	Content  *string    `json:"content,omitempty"`
	Style    *NoteStyle `json:"style,omitempty"`
}
