package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

func SetupDatabaseFile(envVariable string) (string, error) {
	if envVariable == "" {
		envVariable = "SPENDING_TRACKER_DB_PATH"
	}

	dbPath := os.Getenv(envVariable)
	if dbPath == "" {
		dbPath = filepath.Join("App_Data", "spending-tracker.db")
	}
	if !filepath.IsAbs(dbPath) {
		cwd, err := os.Getwd()
		if err != nil {
			return "", err
		}
		dbPath = filepath.Join(cwd, dbPath)
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return "", fmt.Errorf("create database directory %q: %w", filepath.Dir(dbPath), err)
	}
	file, err := os.OpenFile(dbPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return "", fmt.Errorf("open database file %q: %w", dbPath, err)
	}
	if err := file.Close(); err != nil {
		return "", fmt.Errorf("close database file %q: %w", dbPath, err)
	}
	return dbPath, nil
}

func OpenDatabase() (*sql.DB, error) {
	dbPath, err := SetupDatabaseFile("SPENDING_TRACKER_DB_PATH")
	if err != nil {
		return nil, err
	}

	database, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open SQLite database %q: %w", dbPath, err)
	}
	database.SetMaxOpenConns(1)
	database.SetMaxIdleConns(1)
	if _, err := database.Exec("PRAGMA journal_mode = WAL;"); err != nil {
		database.Close()
		return nil, fmt.Errorf("set SQLite journal mode for %q: %w", dbPath, err)
	}
	if _, err := database.Exec("PRAGMA busy_timeout = 5000;"); err != nil {
		database.Close()
		return nil, fmt.Errorf("set SQLite busy timeout for %q: %w", dbPath, err)
	}
	if _, err := database.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		database.Close()
		return nil, fmt.Errorf("initialize SQLite database %q: %w", dbPath, err)
	}
	return database, nil
}

func backfillLegacyTaskColumns(database *sql.DB) error {
	var projectID int
	err := database.QueryRow(`SELECT Id FROM Projects ORDER BY Id LIMIT 1;`).Scan(&projectID)
	if err != nil {
		if err != sql.ErrNoRows {
			return err
		}

		result, insertErr := database.Exec(`INSERT INTO Projects (Name, Description) VALUES (?, ?);`, "General", nil)
		if insertErr != nil {
			return insertErr
		}
		id64, idErr := result.LastInsertId()
		if idErr != nil {
			return idErr
		}
		projectID = int(id64)
	}

	if _, err := database.Exec(`UPDATE Tasks SET ProjectId = ? WHERE ProjectId IS NULL OR ProjectId = 0;`, projectID); err != nil {
		return err
	}
	if _, err := database.Exec(`UPDATE Tasks SET Cost = 0 WHERE Cost IS NULL;`); err != nil {
		return err
	}

	return nil
}

func ensureColumn(database *sql.DB, tableName, columnName, alterStatement string) error {
	rows, err := database.Query(`PRAGMA table_info(` + tableName + `);`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var dataType string
		var notNull int
		var defaultValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &pk); err != nil {
			return err
		}
		if strings.EqualFold(name, columnName) {
			return rows.Err()
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = database.Exec(alterStatement)
	return err
}

func IsUniqueConstraint(err error) bool {
	if err == nil {
		return false
	}
	if strings.Contains(err.Error(), "UNIQUE constraint failed") {
		return true
	}
	if strings.Contains(err.Error(), "UNIQUE constraint violation") {
		return true
	}
	return false
}
