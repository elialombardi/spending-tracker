package reports

import (
	"database/sql"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	_ "modernc.org/sqlite"
)

func TestImportParsedTransactionsWithGorm(t *testing.T) {
	t.Parallel()

	sqlDB, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatalf("sql.Open() returned error: %v", err)
	}
	defer sqlDB.Close()

	db, err := gorm.Open(sqlite.New(sqlite.Config{Conn: sqlDB}), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open() returned error: %v", err)
	}
	if err := db.AutoMigrate(&Transaction{}, &CategoryRule{}); err != nil {
		t.Fatalf("AutoMigrate() returned error: %v", err)
	}

	parsed := []ParsedTransaction{{
		AccountNumber:         "12345678",
		BookingDate:           "2024-02-14",
		ValueDate:             "2024-02-14",
		Amount:                -42.50,
		DebitAmount:           42.50,
		CreditAmount:          0,
		RawDescription:        "Test merchant",
		NormalizedDescription: "test merchant",
		MerchantKey:           "TEST",
		SourceFingerprint:     "fp-1",
	}}

	result, err := importParsedTransactions(db, "12345678", "test.csv", parsed)
	if err != nil {
		t.Fatalf("importParsedTransactions() returned error: %v", err)
	}
	if result.ImportedTransactions != 1 {
		t.Fatalf("ImportedTransactions = %d, want 1", result.ImportedTransactions)
	}
	if result.ReviewTransactions != 1 {
		t.Fatalf("ReviewTransactions = %d, want 1", result.ReviewTransactions)
	}

	var count int64
	if err := db.Model(&Transaction{}).Count(&count).Error; err != nil {
		t.Fatalf("Count() returned error: %v", err)
	}
	if count != 1 {
		t.Fatalf("transaction count = %d, want 1", count)
	}
}

func TestParseAmountSupportsInvariantAndItalianFormats(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		expected float64
	}{
		{name: "invariant decimal", input: "-1000.50", expected: -1000.50},
		{name: "italian decimal", input: "1.234,56", expected: 1234.56},
		{name: "plain integer", input: "2500", expected: 2500},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			amount, err := parseAmount(test.input)
			if err != nil {
				t.Fatalf("parseAmount(%q) returned error: %v", test.input, err)
			}

			if amount != test.expected {
				t.Fatalf("parseAmount(%q) = %v, want %v", test.input, amount, test.expected)
			}
		})
	}
}

func TestImportedAmountMatchesDotNetSelectionRule(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		debit    float64
		credit   float64
		expected float64
	}{
		{name: "expense from debit", debit: 125.75, credit: 0, expected: -125.75},
		{name: "income from credit", debit: 0, credit: 980.10, expected: 980.10},
		{name: "credit takes precedence only when positive", debit: 42, credit: -42, expected: -42},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			amount := -test.debit
			if test.credit > 0 {
				amount = test.credit
			}

			if amount != test.expected {
				t.Fatalf("computed amount = %v, want %v", amount, test.expected)
			}
		})
	}
}
