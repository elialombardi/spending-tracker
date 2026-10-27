package reports

// db model definitions that map to the existing schema. Use explicit column
// tags so we can keep Go-friendly field names while matching the DB.

type Tabler interface {
	TableName() string
}

type Transaction struct {
	ID                      string  `gorm:"column:id;primaryKey;index:idx_transactions_booking_imported_id,priority:3,sort:desc"`
	AccountNumber           string  `gorm:"column:account_number"`
	BookingDate             string  `gorm:"column:booking_date;index:idx_transactions_booking_imported_id,priority:1,sort:desc"`
	ValueDate               string  `gorm:"column:value_date"`
	Amount                  float64 `gorm:"column:amount"`
	DebitAmount             float64 `gorm:"column:debit_amount"`
	CreditAmount            float64 `gorm:"column:credit_amount"`
	RawDescription          string  `gorm:"column:raw_description"`
	NormalizedDescription   string  `gorm:"column:normalized_description"`
	MerchantKey             string  `gorm:"column:merchant_key;index:idx_transactions_merchant_expense,where:amount < 0 AND exclude_from_calculations = false"`
	Category                string  `gorm:"column:category"`
	SuggestedCategory       string  `gorm:"column:suggested_category"`
	SuggestionConfidence    float64 `gorm:"column:suggestion_confidence"`
	NeedsReview             bool    `gorm:"column:needs_review"`
	ExcludeFromCalculations bool    `gorm:"column:exclude_from_calculations"`
	SourceFingerprint       string  `gorm:"column:source_fingerprint;index:idx_transactions_fingerprint"`
	SourceFileName          string  `gorm:"column:source_file_name"`
	ImportedAtUtc           string  `gorm:"column:imported_at_utc;index:idx_transactions_booking_imported_id,priority:2,sort:desc"`
	IsMonthlyRecurring      bool    `gorm:"column:is_monthly_recurring"`
	IsSending               bool    `gorm:"column:is_sending"`
}

func (Transaction) TableName() string { return "transactions" }

type CategoryRule struct {
	ID           string `gorm:"column:id;primaryKey"`
	MerchantKey  string `gorm:"column:merchant_key;index:idx_category_rules_merchant"`
	Category     string `gorm:"column:category"`
	Behavior     string `gorm:"column:behavior"`
	AppliedCount int    `gorm:"column:applied_count"`
	CreatedAtUtc string `gorm:"column:created_at_utc"`
	UpdatedAtUtc string `gorm:"column:updated_at_utc"`
}

func (CategoryRule) TableName() string { return "category_rules" }

type CycleIncomeCategory struct {
	ID           string `gorm:"column:id;primaryKey"`
	Category     string `gorm:"column:category"`
	CreatedAtUtc string `gorm:"column:created_at_utc"`
	UpdatedAtUtc string `gorm:"column:updated_at_utc"`
}

func (CycleIncomeCategory) TableName() string { return "cycle_income_categories" }
