package db

import (
	"log"
	"strings"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/reports"
	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/workouts"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// NewDatabase opens a *sql.DB using the project's SQLite driver (modernc.org/sqlite)
// and then hands that connection to GORM so we avoid depending on CGO (mattn/go-sqlite3).
func NewDatabase() (*gorm.DB, error) {
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

func seedDefaultLocations(gormDB *gorm.DB) error {
	var count int64
	if err := gormDB.Model(&LocationEntity{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	defaults := []LocationEntity{
		{Title: "Central Park", URL: ptr("https://www.nycgovparks.org/parks/central-park"), Lat: 40.7829, Lng: -73.9654, Description: ptr("Great for kids")},
		{Title: "Joe's Pizza", URL: ptr("https://www.joespizza.com"), Lat: 40.7308, Lng: -73.9973, Description: ptr("Classic NY slice")},
	}
	tags := [][]string{{"kids"}, {"restaurant"}}

	for i := range defaults {
		if err := gormDB.Create(&defaults[i]).Error; err != nil {
			return err
		}
		for _, tagName := range tags[i] {
			name := strings.TrimSpace(tagName)
			if name == "" {
				continue
			}
			var tag TagEntity
			err := gormDB.Where("Name = ?", name).First(&tag).Error
			if err != nil {
				if err != gorm.ErrRecordNotFound {
					return err
				}
				if err := gormDB.Create(&TagEntity{Name: name}).Error; err != nil {
					return err
				}
				if err := gormDB.Where("Name = ?", name).First(&tag).Error; err != nil {
					return err
				}
			}
			join := LocationTagEntity{LocationID: defaults[i].ID, TagID: tag.ID}
			if err := gormDB.FirstOrCreate(&join, join).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func ptr(value string) *string {
	return &value
}
