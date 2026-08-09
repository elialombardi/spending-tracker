package reports

// db model definitions that map to the existing schema. Use explicit column
// tags so we can keep Go-friendly field names while matching the DB.

type Tabler interface {
	TableName() string
}

type Transaction struct {
	ID                      string  `gorm:"column:Id;primaryKey"`
	AccountNumber           string  `gorm:"column:AccountNumber"`
	BookingDate             string  `gorm:"column:BookingDate"`
	ValueDate               string  `gorm:"column:ValueDate"`
	Amount                  float64 `gorm:"column:Amount"`
	RawDescription          string  `gorm:"column:RawDescription"`
	MerchantKey             string  `gorm:"column:MerchantKey"`
	Category                string  `gorm:"column:Category"`
	SuggestedCategory       string  `gorm:"column:SuggestedCategory"`
	SuggestionConfidence    float64 `gorm:"column:SuggestionConfidence"`
	NeedsReview             bool    `gorm:"column:NeedsReview"`
	ExcludeFromCalculations bool    `gorm:"column:ExcludeFromCalculations"`
	ImportedAtUtc           string  `gorm:"column:ImportedAtUtc"`
	IsMonthlyRecurring      bool    `gorm:"column:IsMonthlyRecurring"`
	IsSending               bool    `gorm:"column:IsSending"`
}

func (Transaction) TableName() string { return "Transactions" }

type CategoryRule struct {
	ID           string `gorm:"column:Id;primaryKey"`
	MerchantKey  string `gorm:"column:MerchantKey"`
	Category     string `gorm:"column:Category"`
	Behavior     string `gorm:"column:Behavior"`
	AppliedCount int    `gorm:"column:AppliedCount"`
	CreatedAtUtc string `gorm:"column:CreatedAtUtc"`
	UpdatedAtUtc string `gorm:"column:UpdatedAtUtc"`
}

func (CategoryRule) TableName() string { return "CategoryRules" }

type CycleIncomeCategory struct {
	ID           string `gorm:"column:Id;primaryKey"`
	Category     string `gorm:"column:Category"`
	CreatedAtUtc string `gorm:"column:CreatedAtUtc"`
	UpdatedAtUtc string `gorm:"column:UpdatedAtUtc"`
}

func (CycleIncomeCategory) TableName() string { return "CycleIncomeCategories" }
