package notes

import (
	"encoding/json"
	"time"
)

const (
	FolderTypeBuyList   = "buy_list"
	FolderTypeTasksList = "tasks_list"
	FolderTypeDiary     = "diary"
)

type NoteStyle struct {
	Bold            bool   `json:"bold"`
	Italic          bool   `json:"italic"`
	TextColor       string `json:"textColor"`
	BackgroundColor string `json:"backgroundColor"`
	FontSize        int    `json:"fontSize"`
}

type NoteResponse struct {
	ID          uint      `json:"id"`
	FolderID    uint      `json:"folderId"`
	Position    int       `json:"position"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	Description *string   `json:"description"`
	EndDate     *string   `json:"endDate"`
	Completed   bool      `json:"completed"`
	Style       NoteStyle `json:"style"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type NoteFolderTreeResponse struct {
	ID       uint                     `json:"id"`
	Name     string                   `json:"name"`
	Type     string                   `json:"type"`
	Position int                      `json:"position"`
	ParentID *uint                    `json:"parentId"`
	Children []NoteFolderTreeResponse `json:"children"`
	Notes    []NoteResponse           `json:"notes"`
}

type CreateFolderRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=100"`
	Type     string `json:"type" validate:"omitempty,oneof=buy_list tasks_list diary"`
	ParentID *uint  `json:"parentId"`
	Position int    `json:"position" validate:"gte=0"`
}

type UpdateFolderRequest struct {
	Name     *string `json:"name" validate:"omitempty,min=1,max=100"`
	Type     *string `json:"type" validate:"omitempty,oneof=buy_list tasks_list diary"`
	ParentID *uint   `json:"parentId"`
	Position *int    `json:"position" validate:"omitempty,gte=0"`
}

type CreateNoteRequest struct {
	FolderID    uint      `json:"folderId" validate:"required,gt=0"`
	Position    int       `json:"position" validate:"gte=0"`
	Title       string    `json:"title" validate:"required,min=1,max=200"`
	Content     string    `json:"content"`
	Description *string   `json:"description"`
	EndDate     *string   `json:"endDate"`
	Completed   bool      `json:"completed"`
	Style       NoteStyle `json:"style"`
}

type UpdateNoteRequest struct {
	FolderID       *uint      `json:"folderId,omitempty"`
	Position       *int       `json:"position,omitempty" validate:"omitempty,gte=0"`
	Title          *string    `json:"title,omitempty" validate:"omitempty,min=1,max=200"`
	Content        *string    `json:"content,omitempty"`
	Description    *string    `json:"description,omitempty"`
	EndDate        *string    `json:"endDate,omitempty"`
	Completed      *bool      `json:"completed,omitempty"`
	Style          *NoteStyle `json:"style,omitempty"`
	descriptionSet bool
}

func (req *UpdateNoteRequest) UnmarshalJSON(data []byte) error {
	type updateRequest UpdateNoteRequest
	var payload struct {
		updateRequest
		Description json.RawMessage `json:"description"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return err
	}
	result := UpdateNoteRequest(payload.updateRequest)
	// A nil pointer alone cannot distinguish an omitted description from JSON null.
	if payload.Description != nil {
		if err := json.Unmarshal(payload.Description, &result.Description); err != nil {
			return err
		}
		result.descriptionSet = true
	}
	*req = result
	return nil
}
