package db

import (
	"time"

	"github.com/google/uuid"
)

type LocationEntity struct {
	ID          int         `gorm:"column:id;primaryKey;autoIncrement"`
	Title       string      `gorm:"column:title;not null"`
	URL         *string     `gorm:"column:url"`
	Lat         float64     `gorm:"column:lat;not null"`
	Lng         float64     `gorm:"column:lng;not null"`
	Description *string     `gorm:"column:description"`
	Tags        []TagEntity `gorm:"many2many:location_tag;joinForeignKey:location_id;joinReferences:tag_id"`
}

func (LocationEntity) TableName() string { return "locations" }

type TagEntity struct {
	ID   int    `gorm:"column:id;primaryKey;autoIncrement"`
	Name string `gorm:"column:name;uniqueIndex;not null"`
}

func (TagEntity) TableName() string { return "tags" }

type LocationTagEntity struct {
	LocationID int `gorm:"column:location_id;primaryKey"`
	TagID      int `gorm:"column:tag_id;primaryKey"`
}

func (LocationTagEntity) TableName() string { return "location_tag" }

type ProjectEntity struct {
	// ID          int     `gorm:"column:id;primaryKey;autoIncrement"`
	ID          uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	Name        string    `gorm:"column:name;uniqueIndex;not null"`
	Description *string   `gorm:"column:description"`
}

func (ProjectEntity) TableName() string { return "projects" }

type TaskEntity struct {
	ID          uuid.UUID     `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	ProjectID   *uuid.UUID    `gorm:"column:project_id;index:IX_Tasks_ProjectId_TaskDate,priority:1"`
	Name        string        `gorm:"column:name;not null"`
	Cost        float64       `gorm:"column:cost;not null"`
	TaskDate    string        `gorm:"column:task_date;not null;index:IX_Tasks_ProjectId_TaskDate,priority:2"`
	SentOn      *string       `gorm:"column:sent_on"`
	Description *string       `gorm:"column:description"`
	Project     ProjectEntity `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:RESTRICT"`
}

func (TaskEntity) TableName() string { return "tasks" }

type NoteFolderEntity struct {
	ID       uint              `gorm:"column:id;primaryKey;autoIncrement"`
	Name     string            `gorm:"column:name;not null"`
	ParentID *uint             `gorm:"column:parent_id;index"`
	Parent   *NoteFolderEntity `gorm:"foreignKey:ParentID;references:ID;constraint:OnDelete:CASCADE"`
}

func (NoteFolderEntity) TableName() string { return "note_folders" }

type NoteEntity struct {
	ID        uint      `gorm:"column:id;primaryKey;autoIncrement"`
	FolderID  uint      `gorm:"column:folder_id;not null;index"`
	Title     string    `gorm:"column:title;not null"`
	Content   string    `gorm:"column:content;type:text;not null"`
	StyleJSON string    `gorm:"column:style_json;type:text;not null;default:'{}'"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (NoteEntity) TableName() string { return "notes" }

type CycleIncomeCategoryEntity struct {
	ID           string `gorm:"column:id;primaryKey"`
	Category     string `gorm:"column:category;uniqueIndex;not null"`
	CreatedAtUTC string `gorm:"column:created_at_utc;not null"`
	UpdatedAtUTC string `gorm:"column:updated_at_utc;not null"`
}

func (CycleIncomeCategoryEntity) TableName() string { return "cycle_income_categories" }
