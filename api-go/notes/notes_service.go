package notes

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

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

	if err := s.db.Order("position ASC").Order("name ASC").Order("id ASC").Find(&folders).Error; err != nil {
		return nil, err
	}
	if err := s.db.Order("position ASC").Order("updated_at DESC").Order("id ASC").Find(&notes).Error; err != nil {
		return nil, err
	}

	nodesByID := make(map[uint]*NoteFolderTreeResponse, len(folders))
	childrenByParent := make(map[uint][]*NoteFolderTreeResponse)
	var roots []*NoteFolderTreeResponse

	for _, folder := range folders {
		folderNode := &NoteFolderTreeResponse{
			ID:       folder.ID,
			Name:     folder.Name,
			Type:     folder.Type,
			Position: folder.Position,
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

	for _, note := range notes {
		folderNode, ok := nodesByID[note.FolderID]
		if !ok {
			continue
		}
		folderNode.Notes = append(folderNode.Notes, mapNoteEntity(note))
	}

	var buildTree func(*NoteFolderTreeResponse) NoteFolderTreeResponse
	buildTree = func(node *NoteFolderTreeResponse) NoteFolderTreeResponse {
		result := *node
		for _, child := range childrenByParent[node.ID] {
			result.Children = append(result.Children, buildTree(child))
		}
		return result
	}

	response := make([]NoteFolderTreeResponse, 0, len(roots))
	for _, root := range roots {
		response = append(response, buildTree(root))
	}
	return response, nil
}

func (s *notesService) CreateFolder(req *CreateFolderRequest) (*NoteFolderTreeResponse, error) {
	folderType := req.Type
	if folderType == "" {
		folderType = FolderTypeDiary
	}
	if err := validateFolderType(folderType); err != nil {
		return nil, err
	}
	if req.Position < 0 {
		return nil, errors.New("position must be a non-negative integer")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, errors.New("folder name is required")
	}
	if req.ParentID != nil {
		if err := s.ensureFolderExists(*req.ParentID); err != nil {
			return nil, err
		}
	}

	entity := db.NoteFolderEntity{Name: name, Type: folderType, ParentID: req.ParentID, Position: req.Position}
	if err := s.db.Create(&entity).Error; err != nil {
		return nil, err
	}

	return &NoteFolderTreeResponse{
		ID:       entity.ID,
		Name:     entity.Name,
		Type:     entity.Type,
		Position: entity.Position,
		ParentID: entity.ParentID,
		Children: []NoteFolderTreeResponse{},
		Notes:    []NoteResponse{},
	}, nil
}

func (s *notesService) UpdateFolder(id uint, req *UpdateFolderRequest) (*NoteFolderTreeResponse, error) {
	if req.Type != nil {
		if err := validateFolderType(*req.Type); err != nil {
			return nil, err
		}
	}
	if req.Position != nil && *req.Position < 0 {
		return nil, errors.New("position must be a non-negative integer")
	}
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

	if req.Position != nil {
		entity.Position = *req.Position
	}
	if req.Type != nil {
		entity.Type = *req.Type
	}
	if err := s.db.Save(&entity).Error; err != nil {
		return nil, err
	}

	return &NoteFolderTreeResponse{
		ID:       entity.ID,
		Name:     entity.Name,
		Type:     entity.Type,
		Position: entity.Position,
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
	endDate, err := normalizeEndDate(req.EndDate)
	if err != nil {
		return nil, err
	}
	if req.Position < 0 {
		return nil, errors.New("position must be a non-negative integer")
	}
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
		FolderID:    req.FolderID,
		Position:    req.Position,
		Title:       title,
		Content:     req.Content,
		Description: req.Description,
		EndDate:     endDate,
		Completed:   req.Completed,
		StyleJSON:   styleJSON,
	}
	if err := s.db.Create(&entity).Error; err != nil {
		return nil, err
	}

	response := mapNoteEntity(entity)
	return &response, nil
}

func (s *notesService) UpdateNote(id uint, req *UpdateNoteRequest) (*NoteResponse, error) {
	if req.Position != nil && *req.Position < 0 {
		return nil, errors.New("position must be a non-negative integer")
	}
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
	if req.Description != nil || req.descriptionSet {
		entity.Description = req.Description
	}
	if req.EndDate != nil {
		endDate, err := normalizeEndDate(req.EndDate)
		if err != nil {
			return nil, err
		}
		entity.EndDate = endDate
	}
	if req.Completed != nil {
		entity.Completed = *req.Completed
	}
	if req.Position != nil {
		entity.Position = *req.Position
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
		ID:          entity.ID,
		FolderID:    entity.FolderID,
		Position:    entity.Position,
		Title:       entity.Title,
		Content:     entity.Content,
		Description: entity.Description,
		EndDate:     entity.EndDate,
		Completed:   entity.Completed,
		Style:       style,
		CreatedAt:   entity.CreatedAt,
		UpdatedAt:   entity.UpdatedAt,
	}
}

func validateFolderType(value string) error {
	switch value {
	case FolderTypeDiary, FolderTypeBuyList, FolderTypeTasksList:
		return nil
	default:
		return errors.New("folder type must be buy_list, tasks_list or diary")
	}
}

func normalizeEndDate(value *string) (*string, error) {
	if value == nil || *value == "" {
		return nil, nil
	}
	if _, err := time.Parse(time.DateOnly, *value); err != nil {
		return nil, errors.New("end date must be a valid date in YYYY-MM-DD format")
	}
	return value, nil
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
