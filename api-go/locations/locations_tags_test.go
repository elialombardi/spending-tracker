package locations

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strconv"
	"testing"

	"github.com/elialombardi/spending-tracker/api-go/spending-tracker.go/internal/db"
	"github.com/gofiber/fiber/v3"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
)

func TestUpdateLocationPersistsJSONPayload(t *testing.T) {
	sqlDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	sqlDB.SetMaxOpenConns(1)
	database, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := database.AutoMigrate(&db.LocationEntity{}, &db.TagEntity{}, &db.LocationTagEntity{}); err != nil {
		t.Fatal(err)
	}
	service := NewLocationService(database)
	original, err := service.CreateLocation(db.LocationEntity{Title: "Original", Lat: 41, Lng: 12}, []string{"old"})
	if err != nil {
		t.Fatal(err)
	}
	want := Location{
		ID: original.ID, Title: "Updated", Tags: []string{"new"}, Url: "https://example.com/updated",
		Lat: 42.5, Lng: 13.5, Description: "Updated description",
	}
	payload, err := json.Marshal(want)
	if err != nil {
		t.Fatal(err)
	}
	app := fiber.New()
	app.Put("/api/locations/:id", NewLocationTagHandler(service).updateLocation)
	req := httptest.NewRequest(http.MethodPut, "/api/locations/"+strconv.Itoa(original.ID), bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	var got Location
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("response = %+v, want %+v", got, want)
	}
	stored, err := service.GetLocation(original.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got := mapLocationEntity(stored); !reflect.DeepEqual(got, want) {
		t.Fatalf("stored location = %+v, want %+v", got, want)
	}
}
