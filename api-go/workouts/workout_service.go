package workouts

import (
	"errors"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/dto"
	"gorm.io/gorm"
)

type WorkoutService interface {
	// Session Operations
	CreateSession(req *dto.CreateSessionRequest) (*dto.SessionResponse, error)
	GetSessionByID(id uint) (*dto.SessionResponse, error)
	ListSessions(query *dto.PaginationQuery) (*dto.PaginatedResponse[dto.SessionResponse], error)
	UpdateSession(id uint, req *dto.UpdateSessionRequest) (*dto.SessionResponse, error)
	DeleteSession(id uint) error

	// Workout Operations
	CreateWorkout(req *dto.CreateWorkoutRequest) (*dto.WorkoutResponse, error)
	GetWorkoutByID(id uint) (*dto.WorkoutResponse, error)
	ListWorkouts(query *dto.PaginationQuery) (*dto.PaginatedResponse[dto.WorkoutResponse], error)
	UpdateWorkout(id uint, req *dto.UpdateWorkoutRequest) (*dto.WorkoutResponse, error)
	DeleteWorkout(id uint) error
}

type workoutService struct {
	db *gorm.DB
}

func NewWorkoutService(db *gorm.DB) WorkoutService {
	return &workoutService{db: db}
}

// --- Session Logic ---

func (s *workoutService) CreateSession(req *dto.CreateSessionRequest) (*dto.SessionResponse, error) {
	session := Session{
		Name:                 req.Name,
		Rounds:               req.Rounds,
		Cycles:               req.Cycles,
		CycleRestDuration:    req.CycleRestDuration,
		RoundPrepareDuration: req.RoundPrepareDuration,
	}

	for _, t := range req.Timers {
		session.Timers = append(session.Timers, Timer{
			Name:     t.Name,
			Duration: t.Duration,
			Color:    t.Color,
		})
	}

	if err := s.db.Create(&session).Error; err != nil {
		return nil, err
	}

	return mapSessionToResponse(&session), nil
}

func (s *workoutService) GetSessionByID(id uint) (*dto.SessionResponse, error) {
	var session Session
	if err := s.db.Preload("Timers").First(&session, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("session not found")
		}
		return nil, err
	}
	return mapSessionToResponse(&session), nil
}

func (s *workoutService) ListSessions(query *dto.PaginationQuery) (*dto.PaginatedResponse[dto.SessionResponse], error) {
	var sessions []Session
	var total int64

	dbQuery := s.db.Model(&Session{})
	if query.Search != "" {
		dbQuery = dbQuery.Where("name LIKE ?", "%"+query.Search+"%")
	}

	dbQuery.Count(&total)

	offset := (query.Page - 1) * query.Limit
	if err := dbQuery.Preload("Timers").Offset(offset).Limit(query.Limit).Find(&sessions).Error; err != nil {
		return nil, err
	}

	responses := make([]dto.SessionResponse, len(sessions))
	for i, sess := range sessions {
		responses[i] = *mapSessionToResponse(&sess)
	}

	totalPages := int((total + int64(query.Limit) - 1) / int64(query.Limit))

	return &dto.PaginatedResponse[dto.SessionResponse]{
		Data: responses,
		Meta: dto.PaginatedMeta{
			TotalItems: total,
			TotalPages: totalPages,
			Page:       query.Page,
			Limit:      query.Limit,
		},
	}, nil
}

func (s *workoutService) UpdateSession(id uint, req *dto.UpdateSessionRequest) (*dto.SessionResponse, error) {
	var session Session
	if err := s.db.Preload("Timers").First(&session, id).Error; err != nil {
		return nil, errors.New("session not found")
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if req.Name != nil {
			session.Name = *req.Name
		}
		if req.Rounds != nil {
			session.Rounds = *req.Rounds
		}
		if req.Cycles != nil {
			session.Cycles = *req.Cycles
		}
		if req.CycleRestDuration != nil {
			session.CycleRestDuration = *req.CycleRestDuration
		}
		if req.RoundPrepareDuration != nil {
			session.RoundPrepareDuration = *req.RoundPrepareDuration
		}

		if req.Timers != nil {
			// Replace existing timers
			if err := tx.Where("session_id = ?", session.ID).Delete(&Timer{}).Error; err != nil {
				return err
			}
			newTimers := make([]Timer, len(req.Timers))
			for i, t := range req.Timers {
				newTimers[i] = Timer{
					SessionID: session.ID,
					Name:      t.Name,
					Duration:  t.Duration,
					Color:     t.Color,
				}
			}
			session.Timers = newTimers
		}

		return tx.Save(&session).Error
	})

	if err != nil {
		return nil, err
	}

	return mapSessionToResponse(&session), nil
}

func (s *workoutService) DeleteSession(id uint) error {
	result := s.db.Delete(&Session{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("session not found")
	}
	return nil
}

// --- Workout Assembly Logic ---

func (s *workoutService) CreateWorkout(req *dto.CreateWorkoutRequest) (*dto.WorkoutResponse, error) {
	workout := Workout{
		Name: req.Name,
	}

	for i, sessID := range req.SessionIDs {
		workout.Sessions = append(workout.Sessions, WorkoutSession{
			SessionID: sessID,
			Order:     i + 1,
		})
	}

	if err := s.db.Create(&workout).Error; err != nil {
		return nil, err
	}

	return s.GetWorkoutByID(workout.ID)
}

func (s *workoutService) GetWorkoutByID(id uint) (*dto.WorkoutResponse, error) {
	var workout Workout
	if err := s.db.Preload("Sessions", func(db *gorm.DB) *gorm.DB {
		return db.Order(`"WorkoutSession"."order" ASC`)
	}).Preload("Sessions.Session").Preload("Sessions.Session.Timers").First(&workout, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("workout not found")
		}
		return nil, err
	}

	return mapWorkoutToResponse(&workout), nil
}

func (s *workoutService) ListWorkouts(query *dto.PaginationQuery) (*dto.PaginatedResponse[dto.WorkoutResponse], error) {
	var workouts []Workout
	var total int64

	dbQuery := s.db.Model(&Workout{})
	if query.Search != "" {
		dbQuery = dbQuery.Where("name LIKE ?", "%"+query.Search+"%")
	}

	dbQuery.Count(&total)

	offset := (query.Page - 1) * query.Limit
	err := dbQuery.Preload("Sessions", func(db *gorm.DB) *gorm.DB {
		return db.Order(`"WorkoutSession"."order" ASC`)
	}).Preload("Sessions.Session").Preload("Sessions.Session.Timers").
		Offset(offset).Limit(query.Limit).Find(&workouts).Error

	if err != nil {
		return nil, err
	}

	responses := make([]dto.WorkoutResponse, len(workouts))
	for i, w := range workouts {
		responses[i] = *mapWorkoutToResponse(&w)
	}

	totalPages := int((total + int64(query.Limit) - 1) / int64(query.Limit))

	return &dto.PaginatedResponse[dto.WorkoutResponse]{
		Data: responses,
		Meta: dto.PaginatedMeta{
			TotalItems: total,
			TotalPages: totalPages,
			Page:       query.Page,
			Limit:      query.Limit,
		},
	}, nil
}

func (s *workoutService) UpdateWorkout(id uint, req *dto.UpdateWorkoutRequest) (*dto.WorkoutResponse, error) {
	var workout Workout
	if err := s.db.First(&workout, id).Error; err != nil {
		return nil, errors.New("workout not found")
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if req.Name != nil {
			workout.Name = *req.Name
			if err := tx.Save(&workout).Error; err != nil {
				return err
			}
		}

		if req.SessionIDs != nil {
			// Clear existing session mappings and rebuild order
			if err := tx.Where("workout_id = ?", workout.ID).Delete(&WorkoutSession{}).Error; err != nil {
				return err
			}

			for i, sessID := range req.SessionIDs {
				ws := WorkoutSession{
					WorkoutID: workout.ID,
					SessionID: sessID,
					Order:     i + 1,
				}
				if err := tx.Create(&ws).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return s.GetWorkoutByID(workout.ID)
}

func (s *workoutService) DeleteWorkout(id uint) error {
	result := s.db.Delete(&Workout{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("workout not found")
	}
	return nil
}

// --- Helper Functions ---

func mapSessionToResponse(s *Session) *dto.SessionResponse {
	timers := make([]dto.TimerResponse, len(s.Timers))
	for i, t := range s.Timers {
		timers[i] = dto.TimerResponse{
			ID:        t.ID,
			SessionID: t.SessionID,
			Name:      t.Name,
			Duration:  t.Duration,
			Color:     t.Color,
			CreatedAt: t.CreatedAt,
			UpdatedAt: t.UpdatedAt,
		}
	}

	return &dto.SessionResponse{
		ID:                   s.ID,
		Name:                 s.Name,
		Rounds:               s.Rounds,
		Cycles:               s.Cycles,
		CycleRestDuration:    s.CycleRestDuration,
		RoundPrepareDuration: s.RoundPrepareDuration,
		Timers:               timers,
		CreatedAt:            s.CreatedAt,
		UpdatedAt:            s.UpdatedAt,
	}
}

func mapWorkoutToResponse(w *Workout) *dto.WorkoutResponse {
	sessions := make([]dto.SessionResponse, len(w.Sessions))
	for i, ws := range w.Sessions {
		sessions[i] = *mapSessionToResponse(&ws.Session)
	}

	return &dto.WorkoutResponse{
		ID:        w.ID,
		Name:      w.Name,
		Sessions:  sessions,
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
	}
}
