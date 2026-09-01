package di

import (
	"github.com/samber/do/v2"
	"gorm.io/gorm"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/diary"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/locations"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/notes"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/reports"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/tasks"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/workouts"
)

type AppContainer struct {
	DB                 *gorm.DB
	ProjectTaskService *tasks.ProjectTaskService
	ProjectTaskHandler *tasks.ProjectTaskHandler
	LocationService    *locations.LocationService
	LocationTagHandler *locations.LocationTagHandler
	WorkoutService     workouts.WorkoutService
	WorkoutHandler     *workouts.WorkoutHandler
	NotesService       notes.NotesService
	NotesHandler       *notes.NotesHandler
	TransactionService *reports.TransactionService
	TransactionHandler *reports.TransactionHandler
	UserService        user.UserService
	UserHandler        *user.UserHandler
	AuthMiddleware     *user.AuthMiddleware
	DiaryService       diary.Service
	DiaryHandler       *diary.Handler
}

// InitializeApp sets up the dependency graph using samber/do
func InitializeApp() (*AppContainer, error) {
	injector := do.New()

	// 1. Register providers in the injector container
	do.Provide(injector, func(i do.Injector) (*gorm.DB, error) {
		return db.NewDatabase()
	})
	do.Provide(injector, func(i do.Injector) (user.UserService, error) {
		dbConn := do.MustInvoke[*gorm.DB](i)
		return user.NewUserService(dbConn), nil
	})
	do.Provide(injector, func(i do.Injector) (user.AuthService, error) {
		userService := do.MustInvoke[user.UserService](i)
		return user.NewAuthService(userService), nil
	})

	do.Provide(injector, func(i do.Injector) (*user.UserHandler, error) {
		userService := do.MustInvoke[user.UserService](i)
		authService := do.MustInvoke[user.AuthService](i)
		return user.NewUserHandler(userService, authService), nil
	})

	do.Provide(injector, func(i do.Injector) (*user.AuthMiddleware, error) {
		authService := do.MustInvoke[user.AuthService](i)
		return user.NewAuthMiddleware(authService), nil
	})

	do.Provide(injector, func(i do.Injector) (*tasks.ProjectTaskService, error) {
		dbConn := do.MustInvoke[*gorm.DB](i)
		return tasks.NewProjectTaskService(dbConn), nil
	})

	do.Provide(injector, func(i do.Injector) (*tasks.ProjectTaskHandler, error) {
		ptService := do.MustInvoke[*tasks.ProjectTaskService](i)
		return tasks.NewProjectTaskHandler(ptService), nil
	})

	do.Provide(injector, func(i do.Injector) (*locations.LocationService, error) {
		dbConn := do.MustInvoke[*gorm.DB](i)
		return locations.NewLocationService(dbConn), nil
	})
	// 	projectTaskHandler := NewProjectTaskHandler(container.ProjectTaskService)
	do.Provide(injector, func(i do.Injector) (*locations.LocationTagHandler, error) {
		locService := do.MustInvoke[*locations.LocationService](i)
		return locations.NewLocationTagHandler(locService), nil
	})

	do.Provide(injector, func(i do.Injector) (workouts.WorkoutService, error) {
		dbConn := do.MustInvoke[*gorm.DB](i)
		return workouts.NewWorkoutService(dbConn), nil
	})
	do.Provide(injector, func(i do.Injector) (*workouts.WorkoutHandler, error) {
		wService := do.MustInvoke[workouts.WorkoutService](i)
		return workouts.NewWorkoutHandler(wService), nil
	})
	do.Provide(injector, func(i do.Injector) (notes.NotesService, error) {
		dbConn := do.MustInvoke[*gorm.DB](i)
		return notes.NewNotesService(dbConn), nil
	})
	do.Provide(injector, func(i do.Injector) (*notes.NotesHandler, error) {
		nService := do.MustInvoke[notes.NotesService](i)
		return notes.NewNotesHandler(nService), nil
	})

	do.Provide(injector, func(i do.Injector) (*reports.TransactionService, error) {
		dbConn := do.MustInvoke[*gorm.DB](i)
		return reports.NewTransactionService(dbConn), nil
	})

	do.Provide(injector, func(i do.Injector) (*reports.TransactionHandler, error) {
		txService := do.MustInvoke[*reports.TransactionService](i)
		return reports.NewTransactionHandler(txService), nil
	})

	do.Provide(injector, func(i do.Injector) (diary.Service, error) {
		db := do.MustInvoke[*gorm.DB](i)
		return diary.NewService(db), nil
	})

	do.Provide(injector, func(i do.Injector) (*diary.Handler, error) {
		service := do.MustInvoke[diary.Service](i)
		return diary.NewHandler(service), nil
	})

	// 2. Resolve dependencies into your AppContainer struct
	return &AppContainer{
		DB:                 do.MustInvoke[*gorm.DB](injector),
		ProjectTaskService: do.MustInvoke[*tasks.ProjectTaskService](injector),
		ProjectTaskHandler: do.MustInvoke[*tasks.ProjectTaskHandler](injector),
		LocationService:    do.MustInvoke[*locations.LocationService](injector),
		LocationTagHandler: do.MustInvoke[*locations.LocationTagHandler](injector),
		WorkoutService:     do.MustInvoke[workouts.WorkoutService](injector),
		WorkoutHandler:     do.MustInvoke[*workouts.WorkoutHandler](injector),
		NotesService:       do.MustInvoke[notes.NotesService](injector),
		NotesHandler:       do.MustInvoke[*notes.NotesHandler](injector),
		TransactionService: do.MustInvoke[*reports.TransactionService](injector),
		TransactionHandler: do.MustInvoke[*reports.TransactionHandler](injector),
		UserService:        do.MustInvoke[user.UserService](injector),
		UserHandler:        do.MustInvoke[*user.UserHandler](injector),
		AuthMiddleware:     do.MustInvoke[*user.AuthMiddleware](injector),
		DiaryService:       do.MustInvoke[diary.Service](injector),
		DiaryHandler:       do.MustInvoke[*diary.Handler](injector),
	}, nil
}
