package db

import (
	"fmt"
	"log"
	"os"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/reports"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/workouts"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func NewDatabase() (*gorm.DB, error) {
	// Update these with your actual PostgreSQL credentials
	host := os.Getenv("SPENDING_TRACKER_POSTGRES_HOST")
	user := os.Getenv("SPENDING_TRACKER_POSTGRES_USER")
	password := os.Getenv("SPENDING_TRACKER_POSTGRES_PASSWORD")
	dbname := os.Getenv("SPENDING_TRACKER_POSTGRES_DB")
	if host == "" || user == "" || password == "" || dbname == "" {
		log.Fatal("PostgreSQL environment variables are not set properly.")
	}
	port := os.Getenv("SPENDING_TRACKER_POSTGRES_PORT")
	if port == "" {
		port = "5432" // Default PostgreSQL port
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		host, user, password, dbname, port)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	log.Println("Connected to PostgreSQL successfully!")

	log.Printf("Running AutoMigrate...")
	if err := db.AutoMigrate(
		&reports.Transaction{},
		&reports.CategoryRule{},
		&reports.CycleIncomeCategory{},
		&LocationEntity{},
		&TagEntity{},
		&LocationTagEntity{},
		&ProjectEntity{},
		&TaskEntity{},
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
