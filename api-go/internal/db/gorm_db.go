package db

import (
	"fmt"
	"log"
	"os"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/reports"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/user"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/workouts"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func NewDatabase() (*gorm.DB, error) {
	databaseURL := os.Getenv("SPENDING_TRACKER_CONNECTION_STRING")
	if databaseURL == "" {
		log.Fatal("SPENDING_TRACKER_CONNECTION_STRING environment variable is not set.")
	}

	// Open the connection using GORM and the connection string
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	log.Println("Connected to PostgreSQL successfully!")

	log.Printf("Running AutoMigrate...")
	if err := db.AutoMigrate(
		&user.User{},
		&reports.Transaction{},
		&reports.CategoryRule{},
		&reports.CycleIncomeCategory{},
		&LocationEntity{},
		&TagEntity{},
		&LocationTagEntity{},
		&ProjectEntity{},
		&TaskEntity{},
		&NoteFolderEntity{},
		&NoteEntity{},
		&workouts.Session{},
		&workouts.Timer{},
		&workouts.Workout{},
		&workouts.WorkoutSession{},
	); err != nil {
		return nil, err
	}
	log.Printf("AutoMigrate completed successfully.")

	return db, nil
}
