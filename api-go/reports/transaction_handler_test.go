package reports

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/gofiber/fiber/v3"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
)

func newSummaryTestApp(t *testing.T) (*gorm.DB, *fiber.App) {
	t.Helper()
	sqlDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	sqlDB.SetMaxOpenConns(1)
	database, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := database.AutoMigrate(&Transaction{}); err != nil {
		t.Fatal(err)
	}
	app := fiber.New()
	handler := NewTransactionHandler(NewTransactionService(database))
	app.Get("/summary", handler.getTransactionsSummary)
	return database, app
}

func TestTransactionsSummaryCountsTransactionsAndPreservesFilters(t *testing.T) {
	database, app := newSummaryTestApp(t)
	rows := []Transaction{
		{ID: "food-1", BookingDate: "2026-10-01", Amount: -10.25, Category: "Food"},
		{ID: "food-2", BookingDate: "2026-10-31", Amount: -19.75, Category: "Food"},
		{ID: "fuel", BookingDate: "2026-10-15", Amount: -5, Category: "Fuel"},
		{ID: "empty-1", BookingDate: "2026-10-15", Amount: -1},
		{ID: "empty-2", BookingDate: "2026-10-15", Amount: -1},
		{ID: "spaces", BookingDate: "2026-10-15", Amount: -3, Category: "   "},
		{ID: "null-1", BookingDate: "2026-10-15", Amount: -2},
		{ID: "null-2", BookingDate: "2026-10-15", Amount: -2},
		{ID: "uncategorized", BookingDate: "2026-10-15", Amount: -1, Category: "Uncategorized"},
		{ID: "excluded", BookingDate: "2026-10-15", Amount: -100, Category: "Food", ExcludeFromCalculations: true},
		{ID: "income", BookingDate: "2026-10-15", Amount: 100, Category: "Food"},
		{ID: "zero", BookingDate: "2026-10-15", Amount: 0, Category: "Food"},
		{ID: "before", BookingDate: "2026-09-30", Amount: -100, Category: "Food"},
		{ID: "after", BookingDate: "2026-11-01", Amount: -100, Category: "Food"},
	}
	if err := database.Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Model(&Transaction{}).Where("id IN ?", []string{"null-1", "null-2"}).Update("category", nil).Error; err != nil {
		t.Fatal(err)
	}

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/summary?from=2026-10-01&to=2026-10-31", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	var summary SpendingSummaryResponse
	if err := json.NewDecoder(resp.Body).Decode(&summary); err != nil {
		t.Fatal(err)
	}
	if summary.From == nil || *summary.From != "2026-10-01" || summary.To == nil || *summary.To != "2026-10-31" {
		t.Fatalf("unexpected date bounds: %+v", summary)
	}
	if summary.TotalSpent != 45 || summary.UncategorizedSpent != 10 {
		t.Fatalf("unexpected spending totals: %+v", summary)
	}
	want := []CategorySpendResponse{
		{Category: "Food", TotalSpent: 30, Transactions: 2, ShareOfSpent: 0.6667},
		{Category: "Uncategorized", TotalSpent: 10, Transactions: 6, ShareOfSpent: 0.2222},
		{Category: "Fuel", TotalSpent: 5, Transactions: 1, ShareOfSpent: 0.1111},
	}
	if !reflect.DeepEqual(summary.Categories, want) {
		t.Fatalf("categories = %+v, want %+v", summary.Categories, want)
	}
}

func TestTransactionsSummaryEmpty(t *testing.T) {
	_, app := newSummaryTestApp(t)
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/summary", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	var summary SpendingSummaryResponse
	if err := json.NewDecoder(resp.Body).Decode(&summary); err != nil {
		t.Fatal(err)
	}
	want := SpendingSummaryResponse{Categories: []CategorySpendResponse{}}
	if !reflect.DeepEqual(summary, want) {
		t.Fatalf("summary = %+v, want %+v", summary, want)
	}
}

func TestTransactionsSummaryErrors(t *testing.T) {
	tests := []struct {
		name      string
		path      string
		dropTable bool
		status    int
	}{
		{"invalid from", "/summary?from=invalid", false, http.StatusBadRequest},
		{"invalid to", "/summary?to=invalid", false, http.StatusBadRequest},
		{"database failure", "/summary", true, http.StatusInternalServerError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			database, app := newSummaryTestApp(t)
			if tt.dropTable {
				if err := database.Migrator().DropTable(&Transaction{}); err != nil {
					t.Fatal(err)
				}
			}
			resp, err := app.Test(httptest.NewRequest(http.MethodGet, tt.path, nil))
			if err != nil {
				t.Fatal(err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tt.status {
				t.Fatalf("status = %d, want %d", resp.StatusCode, tt.status)
			}
		})
	}
}
