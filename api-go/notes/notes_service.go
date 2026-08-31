package notes

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"gorm.io/gorm"
)

type NotesService interface {
	ListFolderTree() ([]NoteFolderTreeResponse, error)
	CreateFolder(req *CreateFolderRequest) (*NoteFolderTreeResponse, error)
	UpdateFolder(id uint, req *UpdateFolderRequest) (*NoteFolderTreeResponse, error)
	DeleteFolder(id uint) error
	CreateNote(req *CreateNoteRequest) (*NoteResponse, error)
	UpdateNote(id uint, req *UpdateNoteRequest) (*NoteResponse, error)
	DeleteNote(id uint) error
}

type notesService struct {
	db *gorm.DB
}

func NewNotesService(dbConn *gorm.DB) NotesService {
	return &notesService{db: dbConn}
}

func (s *notesService) ListFolderTree() ([]NoteFolderTreeResponse, error) {
	var folders []db.NoteFolderEntity
	var notes []db.NoteEntity

	if err := s.db.Order("name ASC").Find(&folders).Error; err != nil {
		return nil, err
	}
	if err := s.db.Order("updated_at DESC").Find(&notes).Error; err != nil {
		return nil, err
	}

	nodesByID := make(map[uint]*NoteFolderTreeResponse, len(folders))
	childrenByParent := make(map[uint][]*NoteFolderTreeResponse)
	var roots []*NoteFolderTreeResponse

	for _, folder := range folders {
		folderNode := &NoteFolderTreeResponse{
			ID:       folder.ID,
			Name:     folder.Name,
			ParentID: folder.ParentID,
			Children: []NoteFolderTreeResponse{},
			Notes:    []NoteResponse{},
		}
		nodesByID[folder.ID] = folderNode
		if folder.ParentID == nil {
			roots = append(roots, folderNode)
			continue
		}
		childrenByParent[*folder.ParentID] = append(childrenByParent[*folder.ParentID], folderNode)
	}

	for id, node := range nodesByID {
		children := childrenByParent[id]
		if len(children) == 0 {
			continue
		}
		for _, child := range children {
			node.Children = append(node.Children, *child)
		}
	}

	for _, note := range notes {
		folderNode, ok := nodesByID[note.FolderID]
		if !ok {
			continue
		}
		folderNode.Notes = append(folderNode.Notes, mapNoteEntity(note))
	}

	response := make([]NoteFolderTreeResponse, 0, len(roots))
	for _, root := range roots {
		response = append(response, *root)
	}
	return response, nil
}

func (s *notesService) CreateFolder(req *CreateFolderRequest) (*NoteFolderTreeResponse, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("folder name is required")
	}
	if req.ParentID != nil {
		if err := s.ensureFolderExists(*req.ParentID); err != nil {
			return nil, err
		}
	}

	entity := db.NoteFolderEntity{Name: name, ParentID: req.ParentID}
	if err := s.db.Create(&entity).Error; err != nil {
		return nil, err
	}

	return &NoteFolderTreeResponse{
		ID:       entity.ID,
		Name:     entity.Name,
		ParentID: entity.ParentID,
		Children: []NoteFolderTreeResponse{},
		Notes:    []NoteResponse{},
	}, nil
}

func (s *notesService) UpdateFolder(id uint, req *UpdateFolderRequest) (*NoteFolderTreeResponse, error) {
	var entity db.NoteFolderEntity
	if err := s.db.First(&entity, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("folder not found")
		}
		return nil, err
	}

	if req.Name != nil {
		trimmedName := strings.TrimSpace(*req.Name)
		if trimmedName == "" {
			return nil, errors.New("folder name is required")
		}
		entity.Name = trimmedName
	}

	if req.ParentID != nil {
		if *req.ParentID == id {
			return nil, errors.New("folder cannot be its own parent")
		}
		if err := s.ensureFolderExists(*req.ParentID); err != nil {
			return nil, err
		}
		if cycle, err := s.wouldCreateCycle(id, *req.ParentID); err != nil {
			return nil, err
		} else if cycle {
			return nil, errors.New("folder parent cannot be a descendant")
		}
		entity.ParentID = req.ParentID
	}

	if err := s.db.Save(&entity).Error; err != nil {
		return nil, err
	}

	return &NoteFolderTreeResponse{
		ID:       entity.ID,
		Name:     entity.Name,
		ParentID: entity.ParentID,
		Children: []NoteFolderTreeResponse{},
		Notes:    []NoteResponse{},
	}, nil
}

func (s *notesService) DeleteFolder(id uint) error {
	result := s.db.Delete(&db.NoteFolderEntity{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("folder not found")
	}
	return nil
}

func (s *notesService) CreateNote(req *CreateNoteRequest) (*NoteResponse, error) {
	if err := s.ensureFolderExists(req.FolderID); err != nil {
		return nil, err
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("note title is required")
	}

	styleJSON, err := marshalStyle(req.Style)
	if err != nil {
		return nil, err
	}

	entity := db.NoteEntity{
		FolderID:  req.FolderID,
		Title:     title,
		Content:   req.Content,
		StyleJSON: styleJSON,
	}
	if err := s.db.Create(&entity).Error; err != nil {
		return nil, err
	}

	response := mapNoteEntity(entity)
	return &response, nil
}

func (s *notesService) UpdateNote(id uint, req *UpdateNoteRequest) (*NoteResponse, error) {
	var entity db.NoteEntity
	if err := s.db.First(&entity, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("note not found")
		}
		return nil, err
	}

	if req.FolderID != nil {
		if err := s.ensureFolderExists(*req.FolderID); err != nil {
			return nil, err
		}
		entity.FolderID = *req.FolderID
	}
	if req.Title != nil {
		trimmedTitle := strings.TrimSpace(*req.Title)
		if trimmedTitle == "" {
			return nil, errors.New("note title is required")
		}
		entity.Title = trimmedTitle
	}
	if req.Content != nil {
		entity.Content = *req.Content
	}
	if req.Style != nil {
		styleJSON, err := marshalStyle(*req.Style)
		if err != nil {
			return nil, err
		}
		entity.StyleJSON = styleJSON
	}

	if err := s.db.Save(&entity).Error; err != nil {
		return nil, err
	}

	response := mapNoteEntity(entity)
	return &response, nil
}

func (s *notesService) DeleteNote(id uint) error {
	result := s.db.Delete(&db.NoteEntity{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("note not found")
	}
	return nil
}

func (s *notesService) ensureFolderExists(folderID uint) error {
	var count int64
	if err := s.db.Model(&db.NoteFolderEntity{}).Where("id = ?", folderID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("folder not found")
	}
	return nil
}

func (s *notesService) wouldCreateCycle(folderID uint, candidateParentID uint) (bool, error) {
	current := candidateParentID
	for {
		if current == folderID {
			return true, nil
		}
		var parent db.NoteFolderEntity
		if err := s.db.Select("id", "parent_id").First(&parent, current).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return false, nil
			}
			return false, err
		}
		if parent.ParentID == nil {
			return false, nil
		}
		current = *parent.ParentID
	}
}

func mapNoteEntity(entity db.NoteEntity) NoteResponse {
	style := NoteStyle{
		TextColor:       "#1f2937",
		BackgroundColor: "#ffffff",
		FontSize:        16,
	}
	if entity.StyleJSON != "" {
		_ = json.Unmarshal([]byte(entity.StyleJSON), &style)
	}
	return NoteResponse{
		ID:        entity.ID,
		FolderID:  entity.FolderID,
		Title:     entity.Title,
		Content:   entity.Content,
		Style:     style,
		CreatedAt: entity.CreatedAt,
		UpdatedAt: entity.UpdatedAt,
	}
}

func marshalStyle(style NoteStyle) (string, error) {
	if style.TextColor == "" {
		style.TextColor = "#1f2937"
	}
	if style.BackgroundColor == "" {
		style.BackgroundColor = "#ffffff"
	}
	if style.FontSize <= 0 {
		style.FontSize = 16
	}

	raw, err := json.Marshal(style)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}
