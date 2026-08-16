package db

type LocationEntity struct {
	ID          int         `gorm:"column:Id;primaryKey;autoIncrement"`
	Title       string      `gorm:"column:Title;not null"`
	URL         *string     `gorm:"column:Url"`
	Lat         float64     `gorm:"column:Lat;not null"`
	Lng         float64     `gorm:"column:Lng;not null"`
	Description *string     `gorm:"column:Description"`
	Tags        []TagEntity `gorm:"many2many:LocationTag;joinForeignKey:LocationId;joinReferences:TagId"`
}

func (LocationEntity) TableName() string { return "Locations" }

type TagEntity struct {
	ID   int    `gorm:"column:Id;primaryKey;autoIncrement"`
	Name string `gorm:"column:Name;uniqueIndex;not null"`
}

func (TagEntity) TableName() string { return "Tags" }

type LocationTagEntity struct {
	LocationID int `gorm:"column:LocationId;primaryKey"`
	TagID      int `gorm:"column:TagId;primaryKey"`
}

func (LocationTagEntity) TableName() string { return "LocationTag" }

type ProjectEntity struct {
	ID          int     `gorm:"column:Id;primaryKey;autoIncrement"`
	Name        string  `gorm:"column:Name;uniqueIndex;not null"`
	Description *string `gorm:"column:Description"`
}

func (ProjectEntity) TableName() string { return "Projects" }

type TaskEntity struct {
	ID          int           `gorm:"column:Id;primaryKey;autoIncrement"`
	ProjectID   int           `gorm:"column:ProjectId;not null;index:IX_Tasks_ProjectId_TaskDate,priority:1"`
	Name        string        `gorm:"column:Name;not null"`
	Cost        float64       `gorm:"column:Cost;not null"`
	TaskDate    string        `gorm:"column:TaskDate;not null;index:IX_Tasks_ProjectId_TaskDate,priority:2"`
	SentOn      *string       `gorm:"column:SentOn"`
	Description *string       `gorm:"column:Description"`
	Project     ProjectEntity `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:RESTRICT"`
}

func (TaskEntity) TableName() string { return "Tasks" }

type CycleIncomeCategoryEntity struct {
	ID           string `gorm:"column:Id;primaryKey"`
	Category     string `gorm:"column:Category;uniqueIndex;not null"`
	CreatedAtUTC string `gorm:"column:CreatedAtUtc;not null"`
	UpdatedAtUTC string `gorm:"column:UpdatedAtUtc;not null"`
}

func (CycleIncomeCategoryEntity) TableName() string { return "CycleIncomeCategories" }
