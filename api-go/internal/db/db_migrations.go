package db

import (
	"database/sql"
	"log"
)

func EnsureSchema(database *sql.DB) error {
	// 1. Create Base Tables

	statements := []string{
		// `DROP TABLE IF EXISTS Transactions;`,
		// `DROP TABLE IF EXISTS CategoryRules;`,
		// `DROP TABLE IF EXISTS CycleIncomeCategories;`,
		// `DROP TABLE IF EXISTS Locations;`,
		// `DROP TABLE IF EXISTS Tags;`,
		// `DROP TABLE IF EXISTS LocationTag;`,
		// `DROP TABLE IF EXISTS Projects;`,
		// `DROP TABLE IF EXISTS Tasks;`,
		// `DROP TABLE IF EXISTS workout_sessions;`,
		// `DROP TABLE IF EXISTS WorkoutSessions;`,
		// `DROP TABLE IF EXISTS sessions;`,
		// `DROP TABLE IF EXISTS workouts;`,
		// `DROP TABLE IF EXISTS timers;`,
		`CREATE TABLE IF NOT EXISTS Transactions (
            Id TEXT NOT NULL PRIMARY KEY,
            AccountNumber TEXT NOT NULL DEFAULT '',
            BookingDate TEXT NOT NULL,
            ValueDate TEXT NOT NULL,
            Amount REAL NOT NULL,
            DebitAmount REAL NOT NULL DEFAULT 0,
            CreditAmount REAL NOT NULL DEFAULT 0,
            RawDescription TEXT NOT NULL DEFAULT '',
            NormalizedDescription TEXT NOT NULL DEFAULT '',
            MerchantKey TEXT NOT NULL DEFAULT '',
            Category TEXT NULL,
            SuggestedCategory TEXT NULL,
            SuggestionConfidence REAL NULL,
            NeedsReview INTEGER NOT NULL DEFAULT 0,
            ExcludeFromCalculations INTEGER NOT NULL DEFAULT 0,
            SourceFingerprint TEXT NOT NULL DEFAULT '',
            SourceFileName TEXT NOT NULL DEFAULT '',
            ImportedAtUtc TEXT NOT NULL,
            IsMonthlyRecurring INTEGER NOT NULL DEFAULT 0,
            IsSending INTEGER NOT NULL DEFAULT 0
        );`,
		`CREATE UNIQUE INDEX IF NOT EXISTS IX_Transactions_SourceFingerprint ON Transactions(SourceFingerprint);`,
		`CREATE INDEX IF NOT EXISTS IX_Transactions_BookingDate_Category ON Transactions(BookingDate, Category);`,
		`CREATE INDEX IF NOT EXISTS IX_Transactions_NeedsReview ON Transactions(NeedsReview);`,
		`CREATE TABLE IF NOT EXISTS CategoryRules (
            Id TEXT NOT NULL PRIMARY KEY,
            MerchantKey TEXT NOT NULL UNIQUE,
            Category TEXT NOT NULL DEFAULT '',
            Behavior TEXT NOT NULL,
            AppliedCount INTEGER NOT NULL DEFAULT 0,
            CreatedAtUtc TEXT NOT NULL,
            UpdatedAtUtc TEXT NOT NULL
        );`,
		`CREATE TABLE IF NOT EXISTS CycleIncomeCategories (
            Id TEXT NOT NULL PRIMARY KEY,
            Category TEXT NOT NULL UNIQUE,
            CreatedAtUtc TEXT NOT NULL,
            UpdatedAtUtc TEXT NOT NULL
        );`,
		`CREATE TABLE IF NOT EXISTS Locations (
            Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            Title TEXT NOT NULL,
            Url TEXT NULL,
            Lat REAL NOT NULL,
            Lng REAL NOT NULL,
            Description TEXT NULL
        );`,
		`CREATE TABLE IF NOT EXISTS Tags (
            Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL UNIQUE
        );`,
		`CREATE TABLE IF NOT EXISTS LocationTag (
            LocationId INTEGER NOT NULL,
            TagId INTEGER NOT NULL,
            PRIMARY KEY (LocationId, TagId),
            FOREIGN KEY (LocationId) REFERENCES Locations(Id) ON DELETE CASCADE,
            FOREIGN KEY (TagId) REFERENCES Tags(Id) ON DELETE CASCADE
        );`,
		`CREATE TABLE IF NOT EXISTS Projects (
            Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            Name TEXT NOT NULL UNIQUE,
            Description TEXT NULL
        );`,
		`CREATE TABLE IF NOT EXISTS Tasks (
            Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            ProjectId INTEGER NOT NULL,
            Name TEXT NOT NULL,
            Cost REAL NOT NULL,
            TaskDate TEXT NOT NULL,
            SentOn TEXT NULL,
            Description TEXT NULL,
            FOREIGN KEY (ProjectId) REFERENCES Projects(Id) ON DELETE RESTRICT
        );`,
		`CREATE INDEX IF NOT EXISTS IX_Tasks_ProjectId_TaskDate ON Tasks(ProjectId, TaskDate);`,

		// --- Workout Domain Schema (GORM snake_case aligned) ---
		`CREATE TABLE IF NOT EXISTS Sessions (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            rounds INTEGER NOT NULL DEFAULT 1,
            cycles INTEGER NOT NULL DEFAULT 1,
            cycle_rest_duration INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NULL,
            updated_at DATETIME NULL,
            deleted_at DATETIME NULL
        );`,
		// `CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON Sessions(deleted_at);`,

		`CREATE TABLE IF NOT EXISTS Timers (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            duration INTEGER NOT NULL,
            color VARCHAR(10) NULL,
            created_at DATETIME NULL,
            updated_at DATETIME NULL,
            FOREIGN KEY (session_id) REFERENCES Sessions(id) ON DELETE CASCADE
        );`,
		// `CREATE INDEX IF NOT EXISTS idx_timers_session_id ON Timers(session_id);`,

		`CREATE TABLE IF NOT EXISTS Workouts (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(150) NOT NULL,
            created_at DATETIME NULL,
            updated_at DATETIME NULL,
            deleted_at DATETIME NULL
        );`,
		// `CREATE INDEX IF NOT EXISTS idx_workouts_deleted_at ON Workouts(deleted_at);`,

		`CREATE TABLE IF NOT EXISTS WorkoutSessions (
            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            workout_id INTEGER NOT NULL,
            session_id INTEGER NOT NULL,
            "order" INTEGER NOT NULL,
            FOREIGN KEY (workout_id) REFERENCES Workouts(id) ON DELETE CASCADE,
            FOREIGN KEY (session_id) REFERENCES Sessions(id)
        );`,
		// `CREATE INDEX IF NOT EXISTS idx_workout_sessions_workout_id ON WorkoutSessions(workout_id);`,
		// `CREATE INDEX IF NOT EXISTS idx_workout_sessions_session_id ON WorkoutSessions(session_id);`,
	}

	for _, statement := range statements {
		log.Printf("Executing SQL statement: %s", statement)
		if _, err := database.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}
