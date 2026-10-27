package reports

import (
	"bytes"
	"fmt"
	"testing"

	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

type workbookFile struct{ *bytes.Reader }

func (workbookFile) Close() error { return nil }

func TestWorkbookIteratorPreservesAccountDatesAndFingerprints(t *testing.T) {
	book := excelize.NewFile()
	defer book.Close()
	sheet := book.GetSheetName(0)
	fixture := [][]any{
		{"Statement"},
		{"Data contabile", "Data valuta", "Addebiti", "Accrediti", "Descrizione operazioni"},
		{"01/10/2026", "02/10/2026", "12,50", "", "  Test   merchant "},
		{"Conto BancoPosta n.: 12345"},
		{"03/10/2026", "03/10/2026", "", "1000.50", "Salary"},
	}
	for i, row := range fixture {
		if err := book.SetSheetRow(sheet, fmt.Sprintf("A%d", i+1), &row); err != nil {
			t.Fatal(err)
		}
	}
	content, err := book.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := parsePosteItalianeWorkbook(workbookFile{bytes.NewReader(content.Bytes())})
	if err != nil {
		t.Fatal(err)
	}
	if parsed.accountNumber != "12345" || len(parsed.transactions) != 2 {
		t.Fatalf("parsed workbook = %+v", parsed)
	}
	row := parsed.transactions[0]
	if row.AccountNumber != "12345" || row.BookingDate != "2026-10-01" || row.ValueDate != "2026-10-02" || row.Amount != -12.5 || row.RawDescription != "Test merchant" {
		t.Fatalf("first row = %+v", row)
	}
	if row.SourceFingerprint != createFingerprint("12345", row.BookingDate, row.ValueDate, row.Amount, row.RawDescription) || parsed.transactions[1].Amount != 1000.5 {
		t.Fatal("account discovery, fingerprint, or income amount changed")
	}
}

func TestImportBatchQueryCountAndDuplicateAccounting(t *testing.T) {
	database := newReportsTestDatabase(t)
	if err := database.Create(&CategoryRule{ID: "food", MerchantKey: "TEST", Category: "Food", Behavior: merchantRuleBehaviorAutoApply}).Error; err != nil {
		t.Fatal(err)
	}
	queries := 0
	countQuery := func(query *gorm.DB) {
		if !query.DryRun {
			queries++
		}
	}
	if err := database.Callback().Query().Before("gorm:query").Register("test:import-query", countQuery); err != nil {
		t.Fatal(err)
	}
	if err := database.Callback().Row().Before("gorm:row").Register("test:import-row", countQuery); err != nil {
		t.Fatal(err)
	}
	if err := database.Callback().Create().Before("gorm:create").Register("test:import-create", countQuery); err != nil {
		t.Fatal(err)
	}
	rows := make([]ParsedTransaction, 1000)
	for i := range rows {
		rows[i] = ParsedTransaction{
			AccountNumber: "123", BookingDate: "2026-10-01", ValueDate: "2026-10-01",
			Amount: -10, DebitAmount: 10, MerchantKey: "TEST", SourceFingerprint: fmt.Sprint(i),
		}
	}
	result, err := importParsedTransactions(database, "123", "test.xlsx", rows)
	if err != nil {
		t.Fatal(err)
	}
	if queries != 8 || result.ImportedTransactions != 1000 || result.AutoCategorizedTransactions != 1000 || result.ReviewTransactions != 0 {
		t.Fatalf("queries = %d, result = %+v", queries, result)
	}
	rows = append(rows, rows[0])
	result, err = importParsedTransactions(database, "123", "again.xlsx", rows)
	if err != nil {
		t.Fatal(err)
	}
	if result.ImportedTransactions != 0 || result.SkippedDuplicates != 1001 {
		t.Fatalf("duplicate import = %+v", result)
	}
}

func TestImportPreservesReviewSemanticsAndRollsBackFailedBatch(t *testing.T) {
	database := newReportsTestDatabase(t)
	rules := []CategoryRule{
		{ID: "food", MerchantKey: "FOOD", Category: "Food", Behavior: merchantRuleBehaviorAutoApply},
		{ID: "review", MerchantKey: "REVIEW", Category: "Ignored", Behavior: merchantRuleBehaviorAlwaysReview},
	}
	if err := database.Create(&rules).Error; err != nil {
		t.Fatal(err)
	}
	rows := []ParsedTransaction{
		{MerchantKey: "FOOD", Amount: -10, SourceFingerprint: "auto"},
		{MerchantKey: "REVIEW", Amount: -20, SourceFingerprint: "review"},
		{MerchantKey: "AMAZON", Amount: -30, SourceFingerprint: "amazon"},
		{MerchantKey: "FOOD", Amount: 100, SourceFingerprint: "income"},
		{MerchantKey: "NEW MERCHANT", Amount: 0, SourceFingerprint: "zero"},
		{MerchantKey: "FOOD", Amount: -10, SourceFingerprint: "auto"},
	}
	result, err := importParsedTransactions(database, "123", "review.xlsx", rows)
	if err != nil {
		t.Fatal(err)
	}
	if result.ImportedTransactions != 5 || result.SkippedDuplicates != 1 || result.AutoCategorizedTransactions != 1 || result.ReviewTransactions != 3 {
		t.Fatalf("review import = %+v", result)
	}
	if result.ReviewQueue[0].Amount != 30 || result.ReviewQueue[0].MerchantRuleBehavior != merchantRuleBehaviorAlwaysReview {
		t.Fatalf("review order or behavior changed: %+v", result.ReviewQueue)
	}
	if err := database.Exec("CREATE TRIGGER reject_batch BEFORE INSERT ON transactions WHEN NEW.source_fingerprint = 'reject' BEGIN SELECT RAISE(FAIL, 'reject batch'); END").Error; err != nil {
		t.Fatal(err)
	}
	failing := make([]ParsedTransaction, 201)
	for i := range failing {
		failing[i] = ParsedTransaction{MerchantKey: "FOOD", Amount: -1, SourceFingerprint: fmt.Sprintf("batch-%d", i)}
	}
	failing[200].SourceFingerprint = "reject"
	if _, err := importParsedTransactions(database, "123", "failure.xlsx", failing); err == nil {
		t.Fatal("expected second-batch database failure")
	}
	var count int64
	if err := database.Model(&Transaction{}).Count(&count).Error; err != nil || count != 5 {
		t.Fatalf("failed import did not roll back its first batch: count = %d, error = %v", count, err)
	}
}
