package reports

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/gofiber/fiber/v3"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	_ "modernc.org/sqlite"
)

func newReportsTestDatabase(t testing.TB) *gorm.DB {
	t.Helper()
	sqlDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { sqlDB.Close() })
	database, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err := database.AutoMigrate(&Transaction{}, &CategoryRule{}); err != nil {
		t.Fatal(err)
	}
	return database
}

func TestCategoryMappingsUseOneQueryAndPreserveCounts(t *testing.T) {
	database := newReportsTestDatabase(t)
	rules := []CategoryRule{
		{ID: "a", MerchantKey: "A", Category: "Food", AppliedCount: 9},
		{ID: "b", MerchantKey: "B", Behavior: merchantRuleBehaviorAlwaysReview},
	}
	if err := database.Create(&rules).Error; err != nil {
		t.Fatal(err)
	}
	rows := []Transaction{
		{ID: "a1", MerchantKey: "A", Amount: -10},
		{ID: "a2", MerchantKey: "A", Amount: -20},
		{ID: "income", MerchantKey: "A", Amount: 30},
		{ID: "excluded", MerchantKey: "A", Amount: -40, ExcludeFromCalculations: true},
		{ID: "zero", MerchantKey: "B"},
	}
	if err := database.Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	queries := 0
	countQuery := func(query *gorm.DB) {
		if !query.DryRun {
			queries++
		}
	}
	if err := database.Callback().Query().Before("gorm:query").Register("test:query-count", countQuery); err != nil {
		t.Fatal(err)
	}
	if err := database.Callback().Row().Before("gorm:row").Register("test:row-count", countQuery); err != nil {
		t.Fatal(err)
	}
	mappings, err := NewTransactionService(database).FetchCategoryMappings()
	if err != nil {
		t.Fatal(err)
	}
	if queries != 1 {
		t.Fatalf("queries = %d, want 1", queries)
	}
	if len(mappings) != 2 || mappings[0].MatchingTransactions != 2 || mappings[1].MatchingTransactions != 0 || mappings[0].AppliedCount != 9 {
		t.Fatalf("unexpected mappings: %+v", mappings)
	}
	if err := database.Migrator().DropTable(&Transaction{}); err != nil {
		t.Fatal(err)
	}
	if _, err := NewTransactionService(database).FetchCategoryMappings(); err == nil {
		t.Fatal("expected query error")
	}
}

func TestTransactionPaginationPreservesLegacyArraysAndFilters(t *testing.T) {
	database := newReportsTestDatabase(t)
	rows := []Transaction{
		{ID: "a", BookingDate: "2026-10-01", Amount: -10, Category: "Food", NeedsReview: true},
		{ID: "b", BookingDate: "2026-10-01", Amount: -10, Category: "Food", NeedsReview: true},
		{ID: "c", BookingDate: "2026-10-01", Amount: -10, Category: "Food", NeedsReview: true},
		{ID: "d", BookingDate: "2026-10-01", Amount: 10, Category: "Income"},
		{ID: "e", BookingDate: "2026-09-01", Amount: -10, Category: "Food", NeedsReview: true},
	}
	if err := database.Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	app := fiber.New()
	app.Get("/transactions", NewTransactionHandler(NewTransactionService(database)).listTransactions)
	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/transactions", nil))
	if err != nil {
		t.Fatal(err)
	}
	var legacy []TransactionResponse
	if err := json.NewDecoder(response.Body).Decode(&legacy); err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusOK || len(legacy) != 5 {
		t.Fatalf("legacy status = %d, rows = %+v", response.StatusCode, legacy)
	}
	for _, test := range []struct {
		query string
		ids   []string
		total int64
		page  int
		limit int
		pages int64
	}{
		{"?page=1&limit=2", []string{"d", "c"}, 5, 1, 2, 3},
		{"?page=2&limit=2", []string{"b", "a"}, 5, 2, 2, 3},
		{"?page=4&limit=2", []string{}, 5, 4, 2, 3},
		{"?limit=2&from=2026-10-01&to=2026-10-01&direction=expense&category=Food&needsReview=true", []string{"c", "b"}, 3, 1, 2, 2},
		{"?page=1&category=Missing", []string{}, 0, 1, 50, 0},
	} {
		t.Run(test.query, func(t *testing.T) {
			response, err := app.Test(httptest.NewRequest(http.MethodGet, "/transactions"+test.query, nil))
			if err != nil {
				t.Fatal(err)
			}
			defer response.Body.Close()
			var page struct {
				Data []TransactionResponse `json:"data"`
				Meta struct {
					Page       int   `json:"page"`
					Limit      int   `json:"limit"`
					Total      int64 `json:"total"`
					TotalPages int64 `json:"totalPages"`
				} `json:"meta"`
			}
			if err := json.NewDecoder(response.Body).Decode(&page); err != nil {
				t.Fatal(err)
			}
			ids := make([]string, len(page.Data))
			for i, row := range page.Data {
				ids[i] = row.TransactionID
			}
			if response.StatusCode != http.StatusOK || page.Data == nil || !reflect.DeepEqual(ids, test.ids) || page.Meta.Page != test.page || page.Meta.Limit != test.limit || page.Meta.Total != test.total || page.Meta.TotalPages != test.pages {
				t.Fatalf("status = %d, page = %+v, ids = %v", response.StatusCode, page, ids)
			}
		})
	}
	for _, query := range []string{"?page=", "?limit=", "?page=0", "?page=-1", "?limit=0", "?limit=201", "?page=oops", "?limit=1.5", "?page=9223372036854775807&limit=200", "?page=9999999999999999999999999"} {
		t.Run(query, func(t *testing.T) {
			response, err := app.Test(httptest.NewRequest(http.MethodGet, "/transactions"+query, nil))
			if err != nil {
				t.Fatal(err)
			}
			defer response.Body.Close()
			if response.StatusCode != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", response.StatusCode)
			}
		})
	}
}

func TestReportIndexesAreAdditiveAndIdempotent(t *testing.T) {
	database := newReportsTestDatabase(t)
	if err := database.Create(&[]Transaction{{ID: "one", SourceFingerprint: "duplicate"}, {ID: "two", SourceFingerprint: "duplicate"}}).Error; err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err := database.AutoMigrate(&Transaction{}, &CategoryRule{}); err != nil {
			t.Fatal(err)
		}
	}
	for _, index := range []string{"idx_transactions_booking_imported_id", "idx_transactions_merchant_expense", "idx_transactions_fingerprint"} {
		if !database.Migrator().HasIndex(&Transaction{}, index) {
			t.Errorf("missing index %s", index)
		}
	}
	if !database.Migrator().HasIndex(&CategoryRule{}, "idx_category_rules_merchant") {
		t.Error("missing category rule merchant index")
	}
	var count int64
	if err := database.Model(&Transaction{}).Count(&count).Error; err != nil || count != 2 {
		t.Fatalf("count = %d, error = %v", count, err)
	}
}
func BenchmarkCategoryMappings(b *testing.B) {
	database := newReportsTestDatabase(b)
	rules := make([]CategoryRule, 100)
	rows := make([]Transaction, 1000)
	for i := range rules {
		rules[i] = CategoryRule{ID: fmt.Sprint(i), MerchantKey: fmt.Sprintf("MERCHANT-%03d", i)}
	}
	for i := range rows {
		rows[i] = Transaction{ID: fmt.Sprint(i), MerchantKey: rules[i%len(rules)].MerchantKey, Amount: -10}
	}
	if err := database.Create(&rules).Error; err != nil {
		b.Fatal(err)
	}
	if err := database.CreateInBatches(&rows, 100).Error; err != nil {
		b.Fatal(err)
	}
	service := NewTransactionService(database)
	b.Run("per-rule-baseline", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			var mappings []CategoryRule
			if err := database.Order("merchant_key ASC").Find(&mappings).Error; err != nil {
				b.Fatal(err)
			}
			for _, mapping := range mappings {
				if _, err := service.CountMatchingTransactions(mapping.MerchantKey); err != nil {
					b.Fatal(err)
				}
			}
		}
	})
	b.Run("grouped", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			mappings, err := service.FetchCategoryMappings()
			if err != nil || len(mappings) != len(rules) {
				b.Fatalf("mappings = %d, error = %v", len(mappings), err)
			}
		}
	})
}
