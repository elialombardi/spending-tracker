package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/your/repo/spendingtracker.go/internal/models"
	_ "modernc.org/sqlite"
)

func OpenDatabase() (*sql.DB, error) {
	dbPath := os.Getenv("SPENDING_TRACKER_DB")
	if dbPath == "" {
		dbPath = filepath.Join("App_Data", "spending-tracker.db")
	}
	if !filepath.IsAbs(dbPath) {
		cwd, err := os.Getwd()
		if err != nil {
			return nil, err
		}
		dbPath = filepath.Join(cwd, dbPath)
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		return nil, err
	}

	database, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	if _, err := database.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		database.Close()
		return nil, err
	}
	return database, nil
}

func EnsureSchema(database *sql.DB) error {
	statements := []string{
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
            IsMonthlyRecurring INTEGER NOT NULL DEFAULT 0
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
	}

	for _, statement := range statements {
		if _, err := database.Exec(statement); err != nil {
			return err
		}
	}
	if err := ensureColumn(database, "Tasks", "SentOn", `ALTER TABLE Tasks ADD COLUMN SentOn TEXT NULL;`); err != nil {
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

func SeedDefaultLocations(database *sql.DB) error {
	var count int
	if err := database.QueryRow(`SELECT COUNT(1) FROM Locations;`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	defaults := []models.Location{
		{Title: "Central Park", Tags: []string{"kids"}, Url: "https://www.nycgovparks.org/parks/central-park", Lat: 40.7829, Lng: -73.9654, Description: "Great for kids"},
		{Title: "Joe's Pizza", Tags: []string{"restaurant"}, Url: "https://www.joespizza.com", Lat: 40.7308, Lng: -73.9973, Description: "Classic NY slice"},
	}

	for _, location := range defaults {
		if _, err := InsertLocation(database, location); err != nil {
			return err
		}
	}
	return nil
}

func FetchLocations(database *sql.DB, id int) ([]models.Location, error) {
	query := `
        SELECT l.Id, l.Title, l.Url, l.Lat, l.Lng, l.Description, t.Name
        FROM Locations l
        LEFT JOIN LocationTag lt ON lt.LocationId = l.Id
        LEFT JOIN Tags t ON t.Id = lt.TagId`
	args := []any{}
	if id > 0 {
		query += ` WHERE l.Id = ?`
		args = append(args, id)
	}
	query += ` ORDER BY l.Id, t.Name`

	rows, err := database.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byID := map[int]*models.Location{}
	order := []int{}
	for rows.Next() {
		var locationID int
		var title string
		var url sql.NullString
		var lat float64
		var lng float64
		var description sql.NullString
		var tag sql.NullString
		if err := rows.Scan(&locationID, &title, &url, &lat, &lng, &description, &tag); err != nil {
			return nil, err
		}

		location, ok := byID[locationID]
		if !ok {
			location = &models.Location{ID: locationID, Title: title, Lat: lat, Lng: lng, Tags: []string{}}
			if url.Valid {
				location.Url = url.String
			}
			if description.Valid {
				location.Description = description.String
			}
			byID[locationID] = location
			order = append(order, locationID)
		}
		if tag.Valid {
			location.Tags = append(location.Tags, tag.String)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	locations := make([]models.Location, 0, len(order))
	for _, locationID := range order {
		locations = append(locations, *byID[locationID])
	}
	return locations, nil
}

func FetchLocationByID(database *sql.DB, id int) (models.Location, error) {
	locations, err := FetchLocations(database, id)
	if err != nil {
		return models.Location{}, err
	}
	if len(locations) == 0 {
		return models.Location{}, sql.ErrNoRows
	}
	return locations[0], nil
}

func InsertLocation(database *sql.DB, payload models.Location) (models.Location, error) {
	tx, err := database.Begin()
	if err != nil {
		return models.Location{}, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO Locations (Title, Url, Lat, Lng, Description) VALUES (?, ?, ?, ?, ?);`,
		strings.TrimSpace(payload.Title), NullableString(payload.Url), payload.Lat, payload.Lng, NullableString(payload.Description),
	)
	if err != nil {
		return models.Location{}, err
	}
	id64, err := result.LastInsertId()
	if err != nil {
		return models.Location{}, err
	}
	id := int(id64)
	if err := ReplaceLocationTagsTx(tx, id, NormalizeTags(payload.Tags)); err != nil {
		return models.Location{}, err
	}
	if err := tx.Commit(); err != nil {
		return models.Location{}, err
	}
	return FetchLocationByID(database, id)
}

func ReplaceLocation(database *sql.DB, id int, payload models.Location) (models.Location, error) {
	tx, err := database.Begin()
	if err != nil {
		return models.Location{}, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`UPDATE Locations SET Title = ?, Url = ?, Lat = ?, Lng = ?, Description = ? WHERE Id = ?;`,
		strings.TrimSpace(payload.Title), NullableString(payload.Url), payload.Lat, payload.Lng, NullableString(payload.Description), id,
	)
	if err != nil {
		return models.Location{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return models.Location{}, err
	}
	if affected == 0 {
		return models.Location{}, sql.ErrNoRows
	}
	if _, err := tx.Exec(`DELETE FROM LocationTag WHERE LocationId = ?;`, id); err != nil {
		return models.Location{}, err
	}
	if err := ReplaceLocationTagsTx(tx, id, NormalizeTags(payload.Tags)); err != nil {
		return models.Location{}, err
	}
	if err := tx.Commit(); err != nil {
		return models.Location{}, err
	}
	return FetchLocationByID(database, id)
}

func DeleteLocationByID(database *sql.DB, id int) (bool, error) {
	result, err := database.Exec(`DELETE FROM Locations WHERE Id = ?;`, id)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func UpdateLocationTag(database *sql.DB, id int, tag string, present bool) (models.Location, error) {
	tx, err := database.Begin()
	if err != nil {
		return models.Location{}, err
	}
	defer tx.Rollback()

	var exists int
	if err := tx.QueryRow(`SELECT COUNT(1) FROM Locations WHERE Id = ?;`, id).Scan(&exists); err != nil {
		return models.Location{}, err
	}
	if exists == 0 {
		return models.Location{}, sql.ErrNoRows
	}

	tagID, err := EnsureTagTx(tx, tag)
	if err != nil {
		return models.Location{}, err
	}

	if present {
		if _, err := tx.Exec(`INSERT OR IGNORE INTO LocationTag (LocationId, TagId) VALUES (?, ?);`, id, tagID); err != nil {
			return models.Location{}, err
		}
	} else {
		if _, err := tx.Exec(`DELETE FROM LocationTag WHERE LocationId = ? AND TagId = ?;`, id, tagID); err != nil {
			return models.Location{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return models.Location{}, err
	}
	return FetchLocationByID(database, id)
}

func FetchTags(database *sql.DB) ([]string, error) {
	rows, err := database.Query(`SELECT Name FROM Tags ORDER BY Name;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := []string{}
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Strings(tags)
	return tags, nil
}

func InsertTag(database *sql.DB, name string) error {
	_, err := database.Exec(`INSERT INTO Tags (Name) VALUES (?);`, name)
	return err
}

func RenameTagByName(database *sql.DB, oldName, newName string) (bool, error) {
	result, err := database.Exec(`UPDATE Tags SET Name = ? WHERE Name = ?;`, newName, oldName)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func DeleteTagByName(database *sql.DB, name string) (bool, error) {
	result, err := database.Exec(`DELETE FROM Tags WHERE Name = ?;`, name)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}

func ReplaceLocationTagsTx(tx *sql.Tx, locationID int, tags []string) error {
	for _, tag := range tags {
		tagID, err := EnsureTagTx(tx, tag)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT OR IGNORE INTO LocationTag (LocationId, TagId) VALUES (?, ?);`, locationID, tagID); err != nil {
			return err
		}
	}
	return nil
}

func EnsureTagTx(tx *sql.Tx, name string) (int, error) {
	if _, err := tx.Exec(`INSERT OR IGNORE INTO Tags (Name) VALUES (?);`, name); err != nil {
		return 0, err
	}
	var id int
	if err := tx.QueryRow(`SELECT Id FROM Tags WHERE Name = ?;`, name).Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

func NormalizeTags(values []string) []string {
	unique := map[string]struct{}{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			unique[trimmed] = struct{}{}
		}
	}
	result := make([]string, 0, len(unique))
	for value := range unique {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func NullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func IsUniqueConstraint(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "unique constraint failed")
}
