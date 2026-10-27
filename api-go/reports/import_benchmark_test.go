package reports

import (
	"fmt"
	"testing"
)

func BenchmarkImportTransactions(b *testing.B) {
	database := newReportsTestDatabase(b)
	rules := make([]CategoryRule, 10)
	for i := range rules {
		rules[i] = CategoryRule{ID: fmt.Sprint(i), MerchantKey: fmt.Sprintf("MERCHANT %d", i), Category: "Food", Behavior: merchantRuleBehaviorAutoApply}
	}
	if err := database.Create(&rules).Error; err != nil {
		b.Fatal(err)
	}
	rows := make([]ParsedTransaction, 1000)
	for i := range rows {
		rows[i] = ParsedTransaction{
			AccountNumber: "benchmark", BookingDate: "2026-10-01", ValueDate: "2026-10-01",
			Amount: -10, DebitAmount: 10, MerchantKey: fmt.Sprintf("MERCHANT %d", i%10),
			RawDescription: "Benchmark purchase", SourceFingerprint: fmt.Sprint(i),
		}
	}
	b.ReportAllocs()
	for b.Loop() {
		result, err := importParsedTransactions(database, "benchmark", "benchmark.xlsx", rows)
		if err != nil || result.ImportedTransactions != len(rows) {
			b.Fatalf("imported = %d, error = %v", result.ImportedTransactions, err)
		}
		b.StopTimer()
		if err := database.Exec("DELETE FROM transactions").Error; err != nil {
			b.Fatal(err)
		}
		b.StartTimer()
	}
}
