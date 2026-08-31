package db

import (
	"log"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/reports"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/workouts"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// NewDatabase opens a *sql.DB using the project's SQLite driver (modernc.org/sqlite)
// and then hands that connection to GORM so we avoid depending on CGO (mattn/go-sqlite3).
func NewDatabaseSQLite() (*gorm.DB, error) {
	log.Println("Setting up GORM database connection...")

	// Open a database/sql connection using the project's OpenDatabase helper
	sqlDB, err := OpenDatabase()
	if err != nil {
		return nil, err
	}

	// if err := EnsureSchema(sqlDB); err != nil {
	// 	return nil, err
	// }

	// Provide the existing *sql.DB connection to GORM's sqlite driver.
	// This makes GORM use the modernc.org/sqlite driver registered on database/sql
	gormDB, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	log.Printf("Running AutoMigrate...")
	if err := gormDB.AutoMigrate(
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

	return gormDB, nil
}
