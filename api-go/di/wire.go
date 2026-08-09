//go:build wireinject
// +build wireinject

package di

import (
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/services"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/reports"
	"github.com/google/wire"
	"gorm.io/gorm"
)

type AppContainer struct {
	DB                 *gorm.DB
	ProjectTaskService *services.ProjectTaskService
	LocationService    *services.LocationService
	TransactionHandler *reports.TransactionHandler
}

func InitializeApp() (*AppContainer, error) {
	wire.Build(
		db.NewDatabase,
		services.NewProjectTaskService,
		services.NewLocationService,
		reports.NewTransactionService,
		reports.NewTransactionHandler,
		wire.Struct(new(AppContainer), "DB", "ProjectTaskService", "LocationService", "TransactionHandler"),
	)
	return &AppContainer{}, nil
}
