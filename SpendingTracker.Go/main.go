package main

import (
	"database/sql"
	"errors"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/golang-jwt/jwt/v5"
	_ "modernc.org/sqlite"
)

type Location struct {
	ID          int      `json:"id"`
	Title       string   `json:"title"`
	Tags        []string `json:"tags"`
	Url         string   `json:"url,omitempty"`
	Lat         float64  `json:"lat"`
	Lng         float64  `json:"lng"`
	Description string   `json:"description,omitempty"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthTokenResponse struct {
	AccessToken string    `json:"accessToken"`
	TokenType   string    `json:"tokenType"`
	ExpiresAt   time.Time `json:"expiresAt"`
	Username    string    `json:"username"`
	Role        string    `json:"role"`
}

type AuthClaims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

type User struct {
	Username string
	Password string
	Role     string
}

var (
	db                *sql.DB
	users             = map[string]User{}
	jwtKey            []byte
	jwtIssuer         string
	jwtAudience       string
	tokenLifetimeMins int
)

func main() {
	configureUsers()
	configureJwt()

	var err error
	db, err = openDatabase()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := ensureSchema(db); err != nil {
		log.Fatal(err)
	}
	if err := seedDefaultLocations(db); err != nil {
		log.Fatal(err)
	}

	app := fiber.New()
	app.Use(cors.New())

	app.Post("/api/auth/token", handleToken)
	app.Post("/api/imports/poste-italiane", authRequired(importPosteItaliane, []string{"Writer", "Admin"}))
	app.Get("/api/transactions", authRequired(listTransactions, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/transactions/summary", authRequired(getTransactionsSummary, []string{"Reader", "Writer", "Admin"}))
	app.Post("/api/transactions/:transactionId/categorize", authRequired(categorizeTransaction, []string{"Writer", "Admin"}))
	app.Get("/api/categories", authRequired(listCategories, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/categories/cycle-income", authRequired(getCycleIncomeCategories, []string{"Reader", "Writer", "Admin"}))
	app.Put("/api/categories/cycle-income", authRequired(updateCycleIncomeCategories, []string{"Writer", "Admin"}))
	app.Get("/api/categories/mappings", authRequired(listCategoryMappings, []string{"Reader", "Writer", "Admin"}))
	app.Put("/api/categories/mappings/:mappingId", authRequired(updateCategoryMapping, []string{"Writer", "Admin"}))
	app.Delete("/api/categories/mappings/:mappingId", authRequired(deleteCategoryMapping, []string{"Writer", "Admin"}))
	app.Get("/api/reports/cycles", authRequired(getReportCycles, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/cycle", authRequired(getCycleReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/cycle/export", authRequired(exportCycleReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/monthly", authRequired(getMonthlyReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/api/reports/monthly/export", authRequired(exportMonthlyReport, []string{"Reader", "Writer", "Admin"}))
	app.Get("/locations", authRequired(listLocations, []string{"Reader", "Writer", "Admin"}))
	app.Get("/locations/:id", authRequired(getLocation, []string{"Reader", "Writer", "Admin"}))
	app.Post("/locations", authRequired(createLocation, []string{"Writer", "Admin"}))
	app.Put("/locations/:id", authRequired(updateLocation, []string{"Writer", "Admin"}))
	app.Delete("/locations/:id", authRequired(deleteLocation, []string{"Writer", "Admin"}))
	app.Post("/locations/:id/tags", authRequired(toggleLocationTag, []string{"Writer", "Admin"}))
	app.Get("/tags", authRequired(listTags, []string{"Reader", "Writer", "Admin"}))
	app.Post("/tags", authRequired(createTag, []string{"Writer", "Admin"}))
	app.Patch("/tags/:name", authRequired(renameTag, []string{"Writer", "Admin"}))
	app.Delete("/tags/:name", authRequired(deleteTag, []string{"Writer", "Admin"}))

	port := getenv("PORT", "7004")
	log.Printf("starting Go API on :%s\n", port)
	log.Fatal(app.Listen(":" + port))
}

func configureUsers() {
	adminUsername := getenv("SPENDING_TRACKER_ADMIN_USERNAME", "admin")
	adminPassword := getenv("SPENDING_TRACKER_ADMIN_PASSWORD", "dev-password-change-me")
	writerUsername := getenv("SPENDING_TRACKER_WRITER_USERNAME", "user")
	writerPassword := getenv("SPENDING_TRACKER_WRITER_PASSWORD", "dev-password-change-me")

	users[strings.ToLower(adminUsername)] = User{Username: adminUsername, Password: adminPassword, Role: "Admin"}
	users[strings.ToLower(writerUsername)] = User{Username: writerUsername, Password: writerPassword, Role: "Writer"}
}

func configureJwt() {
	jwtKey = []byte(getenv("JWT_SIGNING_KEY", "dev-only-signing-key-change-before-production-2026-07-06"))
	jwtIssuer = getenv("JWT_ISSUER", "SpendingTracker.Api")
	jwtAudience = getenv("JWT_AUDIENCE", "SpendingTracker.Client")
	tokenLifetimeMins = getenvInt("JWT_TOKEN_LIFETIME_MINUTES", 480)
}

func openDatabase() (*sql.DB, error) {
	dbPath := getenv("SPENDING_TRACKER_DB", filepath.Join("App_Data", "spending-tracker.db"))
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

func ensureSchema(database *sql.DB) error {
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
	}

	for _, statement := range statements {
		if _, err := database.Exec(statement); err != nil {
			return err
		}
	}
	return nil
}

func seedDefaultLocations(database *sql.DB) error {
	var count int
	if err := database.QueryRow(`SELECT COUNT(1) FROM Locations;`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	defaults := []Location{
		{Title: "Central Park", Tags: []string{"kids"}, Url: "https://www.nycgovparks.org/parks/central-park", Lat: 40.7829, Lng: -73.9654, Description: "Great for kids"},
		{Title: "Joe's Pizza", Tags: []string{"restaurant"}, Url: "https://www.joespizza.com", Lat: 40.7308, Lng: -73.9973, Description: "Classic NY slice"},
	}

	for _, location := range defaults {
		if _, err := insertLocation(database, location); err != nil {
			return err
		}
	}
	return nil
}

func getenv(key, def string) string {
	value := os.Getenv(key)
	if value == "" {
		return def
	}
	return value
}

func getenvInt(key string, def int) int {
	value := os.Getenv(key)
	if value == "" {
		return def
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return def
	}
	return parsed
}

func handleToken(c *fiber.Ctx) error {
	var request LoginRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.ErrBadRequest
	}

	user, ok := users[strings.ToLower(strings.TrimSpace(request.Username))]
	if !ok || user.Password != request.Password {
		return c.SendStatus(fiber.StatusUnauthorized)
	}

	now := time.Now().UTC()
	expiresAt := now.Add(time.Duration(tokenLifetimeMins) * time.Minute)
	claims := AuthClaims{
		Role: user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.Username,
			Issuer:    jwtIssuer,
			Audience:  jwt.ClaimStrings{jwtAudience},
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        strconv.FormatInt(now.UnixNano(), 10),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(jwtKey)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	return c.JSON(AuthTokenResponse{
		AccessToken: signed,
		TokenType:   "Bearer",
		ExpiresAt:   expiresAt,
		Username:    user.Username,
		Role:        user.Role,
	})
}

func authRequired(next fiber.Handler, allowedRoles []string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if !setUserFromHeader(c) {
			return c.SendStatus(fiber.StatusUnauthorized)
		}

		role, _ := c.Locals("role").(string)
		for _, allowedRole := range allowedRoles {
			if role == allowedRole {
				return next(c)
			}
		}

		return c.SendStatus(fiber.StatusForbidden)
	}
}

func setUserFromHeader(c *fiber.Ctx) bool {
	authorization := c.Get("Authorization")
	if !strings.HasPrefix(authorization, "Bearer ") {
		return false
	}

	tokenString := strings.TrimPrefix(authorization, "Bearer ")
	claims := &AuthClaims{}
	parsed, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		func(token *jwt.Token) (interface{}, error) {
			if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, errors.New("unexpected signing method")
			}
			return jwtKey, nil
		},
		jwt.WithAudience(jwtAudience),
		jwt.WithIssuer(jwtIssuer),
	)
	if err != nil || !parsed.Valid {
		return false
	}

	c.Locals("username", claims.Subject)
	c.Locals("role", claims.Role)
	return true
}

func listLocations(c *fiber.Ctx) error {
	locations, err := fetchLocations(db, 0)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(locations)
}

func getLocation(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	location, err := fetchLocationByID(db, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(location)
}

func createLocation(c *fiber.Ctx) error {
	var payload Location
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Title) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Title required")
	}

	location, err := insertLocation(db, payload)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	c.Location("/locations/" + strconv.Itoa(location.ID))
	return c.Status(fiber.StatusCreated).JSON(location)
}

func updateLocation(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var payload Location
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	if strings.TrimSpace(payload.Title) == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Title required")
	}

	location, err := replaceLocation(db, id, payload)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(location)
}

func deleteLocation(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	deleted, err := deleteLocationByID(db, id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"success": true})
}

func toggleLocationTag(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var payload struct {
		Tag     string `json:"tag"`
		Present bool   `json:"present"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	payload.Tag = strings.TrimSpace(payload.Tag)
	if payload.Tag == "" {
		return c.Status(fiber.StatusBadRequest).SendString("tag required")
	}

	location, err := updateLocationTag(db, id, payload.Tag, payload.Present)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(location)
}

func listTags(c *fiber.Ctx) error {
	tags, err := fetchTags(db)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(tags)
}

func createTag(c *fiber.Ctx) error {
	var payload struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	payload.Name = strings.TrimSpace(payload.Name)
	if payload.Name == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Name required")
	}

	if err := insertTag(db, payload.Name); err != nil {
		if isUniqueConstraint(err) {
			return c.Status(fiber.StatusConflict).SendString("Tag already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	return c.JSON(payload.Name)
}

func renameTag(c *fiber.Ctx) error {
	oldName := c.Params("name")
	var payload struct {
		NewName string `json:"newName"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	payload.NewName = strings.TrimSpace(payload.NewName)
	if payload.NewName == "" {
		return c.Status(fiber.StatusBadRequest).SendString("newName required")
	}

	renamed, err := renameTagByName(db, oldName, payload.NewName)
	if err != nil {
		if isUniqueConstraint(err) {
			return c.Status(fiber.StatusConflict).SendString("Tag with newName already exists")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !renamed {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"oldName": oldName, "newName": payload.NewName})
}

func deleteTag(c *fiber.Ctx) error {
	deleted, err := deleteTagByName(db, c.Params("name"))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}
	if !deleted {
		return c.SendStatus(fiber.StatusNotFound)
	}
	return c.JSON(fiber.Map{"success": true})
}

func fetchLocations(database *sql.DB, id int) ([]Location, error) {
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

	byID := map[int]*Location{}
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
			location = &Location{ID: locationID, Title: title, Lat: lat, Lng: lng, Tags: []string{}}
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

	locations := make([]Location, 0, len(order))
	for _, locationID := range order {
		locations = append(locations, *byID[locationID])
	}
	return locations, nil
}

func fetchLocationByID(database *sql.DB, id int) (Location, error) {
	locations, err := fetchLocations(database, id)
	if err != nil {
		return Location{}, err
	}
	if len(locations) == 0 {
		return Location{}, sql.ErrNoRows
	}
	return locations[0], nil
}

func insertLocation(database *sql.DB, payload Location) (Location, error) {
	tx, err := database.Begin()
	if err != nil {
		return Location{}, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO Locations (Title, Url, Lat, Lng, Description) VALUES (?, ?, ?, ?, ?);`,
		strings.TrimSpace(payload.Title), nullableString(payload.Url), payload.Lat, payload.Lng, nullableString(payload.Description),
	)
	if err != nil {
		return Location{}, err
	}
	id64, err := result.LastInsertId()
	if err != nil {
		return Location{}, err
	}
	id := int(id64)
	if err := replaceLocationTagsTx(tx, id, normalizeTags(payload.Tags)); err != nil {
		return Location{}, err
	}
	if err := tx.Commit(); err != nil {
		return Location{}, err
	}
	return fetchLocationByID(database, id)
}

func replaceLocation(database *sql.DB, id int, payload Location) (Location, error) {
	tx, err := database.Begin()
	if err != nil {
		return Location{}, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`UPDATE Locations SET Title = ?, Url = ?, Lat = ?, Lng = ?, Description = ? WHERE Id = ?;`,
		strings.TrimSpace(payload.Title), nullableString(payload.Url), payload.Lat, payload.Lng, nullableString(payload.Description), id,
	)
	if err != nil {
		return Location{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Location{}, err
	}
	if affected == 0 {
		return Location{}, sql.ErrNoRows
	}
	if _, err := tx.Exec(`DELETE FROM LocationTag WHERE LocationId = ?;`, id); err != nil {
		return Location{}, err
	}
	if err := replaceLocationTagsTx(tx, id, normalizeTags(payload.Tags)); err != nil {
		return Location{}, err
	}
	if err := tx.Commit(); err != nil {
		return Location{}, err
	}
	return fetchLocationByID(database, id)
}

func deleteLocationByID(database *sql.DB, id int) (bool, error) {
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

func updateLocationTag(database *sql.DB, id int, tag string, present bool) (Location, error) {
	tx, err := database.Begin()
	if err != nil {
		return Location{}, err
	}
	defer tx.Rollback()

	var exists int
	if err := tx.QueryRow(`SELECT COUNT(1) FROM Locations WHERE Id = ?;`, id).Scan(&exists); err != nil {
		return Location{}, err
	}
	if exists == 0 {
		return Location{}, sql.ErrNoRows
	}

	tagID, err := ensureTagTx(tx, tag)
	if err != nil {
		return Location{}, err
	}

	if present {
		if _, err := tx.Exec(`INSERT OR IGNORE INTO LocationTag (LocationId, TagId) VALUES (?, ?);`, id, tagID); err != nil {
			return Location{}, err
		}
	} else {
		if _, err := tx.Exec(`DELETE FROM LocationTag WHERE LocationId = ? AND TagId = ?;`, id, tagID); err != nil {
			return Location{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return Location{}, err
	}
	return fetchLocationByID(database, id)
}

func fetchTags(database *sql.DB) ([]string, error) {
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

func insertTag(database *sql.DB, name string) error {
	_, err := database.Exec(`INSERT INTO Tags (Name) VALUES (?);`, name)
	return err
}

func renameTagByName(database *sql.DB, oldName, newName string) (bool, error) {
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

func deleteTagByName(database *sql.DB, name string) (bool, error) {
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

func replaceLocationTagsTx(tx *sql.Tx, locationID int, tags []string) error {
	for _, tag := range tags {
		tagID, err := ensureTagTx(tx, tag)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`INSERT OR IGNORE INTO LocationTag (LocationId, TagId) VALUES (?, ?);`, locationID, tagID); err != nil {
			return err
		}
	}
	return nil
}

func ensureTagTx(tx *sql.Tx, name string) (int, error) {
	if _, err := tx.Exec(`INSERT OR IGNORE INTO Tags (Name) VALUES (?);`, name); err != nil {
		return 0, err
	}
	var id int
	if err := tx.QueryRow(`SELECT Id FROM Tags WHERE Name = ?;`, name).Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

func normalizeTags(values []string) []string {
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

func nullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func isUniqueConstraint(err error) bool {
	return strings.Contains(strings.ToLower(err.Error()), "unique constraint failed")
}
