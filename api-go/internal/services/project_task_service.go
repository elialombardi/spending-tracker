package services

import (
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"gorm.io/gorm"
)

type ProjectTaskService struct {
	db *gorm.DB
}

type TaskWithProject struct {
	Task    db.TaskEntity
	Project db.ProjectEntity
}

func NewProjectTaskService(database *gorm.DB) *ProjectTaskService {
	return &ProjectTaskService{db: database}
}

func (s *ProjectTaskService) ListProjects() ([]db.ProjectEntity, error) {
	var projects []db.ProjectEntity
	err := s.db.Order("Name ASC, Id ASC").Find(&projects).Error
	return projects, err
}

func (s *ProjectTaskService) GetProject(id int) (db.ProjectEntity, error) {
	var project db.ProjectEntity
	err := s.db.First(&project, "Id = ?", id).Error
	return project, err
}

func (s *ProjectTaskService) CreateProject(payload db.ProjectEntity) (db.ProjectEntity, error) {
	payload.ID = 0
	if err := s.db.Create(&payload).Error; err != nil {
		return db.ProjectEntity{}, err
	}
	return payload, nil
}

func (s *ProjectTaskService) UpdateProject(id int, payload db.ProjectEntity) (db.ProjectEntity, error) {
	var existing db.ProjectEntity
	if err := s.db.First(&existing, "Id = ?", id).Error; err != nil {
		return db.ProjectEntity{}, err
	}
	existing.Name = payload.Name
	existing.Description = payload.Description
	if err := s.db.Save(&existing).Error; err != nil {
		return db.ProjectEntity{}, err
	}
	return existing, nil
}

func (s *ProjectTaskService) DeleteProject(id int) (bool, error) {
	result := s.db.Delete(&db.ProjectEntity{}, "Id = ?", id)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func (s *ProjectTaskService) ListTasks() ([]TaskWithProject, error) {
	var tasks []db.TaskEntity
	err := s.db.Preload("Project").Order("TaskDate DESC, Id DESC").Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	result := make([]TaskWithProject, 0, len(tasks))
	for _, task := range tasks {
		result = append(result, TaskWithProject{Task: task, Project: task.Project})
	}
	return result, nil
}

func (s *ProjectTaskService) GetTask(id int) (TaskWithProject, error) {
	var task db.TaskEntity
	if err := s.db.Preload("Project").First(&task, "Id = ?", id).Error; err != nil {
		return TaskWithProject{}, err
	}
	return TaskWithProject{Task: task, Project: task.Project}, nil
}

func (s *ProjectTaskService) CreateTask(payload db.TaskEntity) (TaskWithProject, error) {
	payload.ID = 0
	if err := s.db.Create(&payload).Error; err != nil {
		return TaskWithProject{}, err
	}
	return s.GetTask(payload.ID)
}

func (s *ProjectTaskService) UpdateTask(id int, payload db.TaskEntity) (TaskWithProject, error) {
	var existing db.TaskEntity
	if err := s.db.First(&existing, "Id = ?", id).Error; err != nil {
		return TaskWithProject{}, err
	}
	existing.ProjectID = payload.ProjectID
	existing.Name = payload.Name
	existing.Cost = payload.Cost
	existing.TaskDate = payload.TaskDate
	existing.SentOn = payload.SentOn
	existing.Description = payload.Description
	if err := s.db.Save(&existing).Error; err != nil {
		return TaskWithProject{}, err
	}
	return s.GetTask(id)
}

func (s *ProjectTaskService) DeleteTask(id int) (bool, error) {
	result := s.db.Delete(&db.TaskEntity{}, "Id = ?", id)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}
