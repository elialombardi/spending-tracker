package reports

import "database/sql"

type ImportResultResponse struct {
	AccountNumber               string                      `json:"accountNumber"`
	FileName                    string                      `json:"fileName"`
	ImportedTransactions        int                         `json:"importedTransactions"`
	SkippedDuplicates           int                         `json:"skippedDuplicates"`
	AutoCategorizedTransactions int                         `json:"autoCategorizedTransactions"`
	ReviewTransactions          int                         `json:"reviewTransactions"`
	ReviewQueue                 []ReviewTransactionResponse `json:"reviewQueue"`
}

type ReviewTransactionResponse struct {
	TransactionID        string   `json:"transactionId"`
	BookingDate          string   `json:"bookingDate"`
	Amount               float64  `json:"amount"`
	Description          string   `json:"description"`
	MerchantKey          string   `json:"merchantKey"`
	MerchantRuleBehavior string   `json:"merchantRuleBehavior"`
	SuggestedCategory    *string  `json:"suggestedCategory"`
	SuggestionConfidence *float64 `json:"suggestionConfidence"`
}

type CycleOptionResponse struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type MonthlyReportResponse struct {
	Year               int                         `json:"year"`
	Month              int                         `json:"month"`
	From               string                      `json:"from"`
	To                 string                      `json:"to"`
	TotalTransactions  int                         `json:"totalTransactions"`
	TotalSpent         float64                     `json:"totalSpent"`
	TotalIncome        float64                     `json:"totalIncome"`
	UncategorizedSpent float64                     `json:"uncategorizedSpent"`
	Categories         []CategorySpendResponse     `json:"categories"`
	TopMerchants       []MerchantSpendResponse     `json:"topMerchants"`
	LargestExpenses    []ReportTransactionResponse `json:"largestExpenses"`
}

type CategorySpendResponse struct {
	Category     string  `json:"category"`
	TotalSpent   float64 `json:"totalSpent"`
	Transactions int     `json:"transactions"`
	ShareOfSpent float64 `json:"shareOfSpent"`
}

type MerchantSpendResponse struct {
	MerchantKey  string  `json:"merchantKey"`
	Category     *string `json:"category"`
	TotalSpent   float64 `json:"totalSpent"`
	Transactions int     `json:"transactions"`
}

type ReportTransactionResponse struct {
	TransactionID string  `json:"transactionId"`
	BookingDate   string  `json:"bookingDate"`
	ValueDate     string  `json:"valueDate"`
	Amount        float64 `json:"amount"`
	Direction     string  `json:"direction"`
	Description   string  `json:"description"`
	MerchantKey   string  `json:"merchantKey"`
	Category      *string `json:"category"`
	NeedsReview   bool    `json:"needsReview"`
}

// Internal domain types
type ParsedTransaction struct {
	AccountNumber         string
	BookingDate           string
	ValueDate             string
	DebitAmount           float64
	CreditAmount          float64
	Amount                float64
	RawDescription        string
	NormalizedDescription string
	MerchantKey           string
	SourceFingerprint     string
}

type CategoryRule struct {
	MerchantKey string
	Category    string
	Behavior    string
}

type TransactionResponse struct {
	TransactionID        string   `json:"transactionId"`
	AccountNumber        string   `json:"accountNumber"`
	BookingDate          string   `json:"bookingDate"`
	ValueDate            string   `json:"valueDate"`
	Amount               float64  `json:"amount"`
	Direction            string   `json:"direction"`
	Description          string   `json:"description"`
	MerchantKey          string   `json:"merchantKey"`
	MerchantRuleBehavior string   `json:"merchantRuleBehavior"`
	Category             *string  `json:"category"`
	SuggestedCategory    *string  `json:"suggestedCategory"`
	SuggestionConfidence *float64 `json:"suggestionConfidence"`
	NeedsReview          bool     `json:"needsReview"`
	IsMonthlyRecurring   bool     `json:"isMonthlyRecurring"`
}

type CategorizeTransactionRequest struct {
	Category                string  `json:"category"`
	SaveRule                bool    `json:"saveRule"`
	RuleBehavior            *string `json:"ruleBehavior"`
	MerchantKey             *string `json:"merchantKey"`
	ExcludeFromCalculations bool    `json:"excludeFromCalculations"`
	IsMonthlyRecurring      bool    `json:"isMonthlyRecurring"`
}

type SpendingSummaryResponse struct {
	From               *string                 `json:"from"`
	To                 *string                 `json:"to"`
	TotalSpent         float64                 `json:"totalSpent"`
	UncategorizedSpent float64                 `json:"uncategorizedSpent"`
	Categories         []CategorySpendResponse `json:"categories"`
}

type CategoryResponse struct {
	Name         string `json:"name"`
	Rules        int    `json:"rules"`
	Transactions int    `json:"transactions"`
}

type CategoryMappingResponse struct {
	MappingID            string  `json:"mappingId"`
	MerchantKey          string  `json:"merchantKey"`
	Category             *string `json:"category"`
	Behavior             string  `json:"behavior"`
	AppliedCount         int     `json:"appliedCount"`
	MatchingTransactions int     `json:"matchingTransactions"`
}

type UpdateCategoryMappingRequest struct {
	Category *string `json:"category"`
	Behavior string  `json:"behavior"`
}

type CycleIncomeCategoriesResponse struct {
	UsesAllIncomeTransactions bool                                `json:"usesAllIncomeTransactions"`
	Categories                []CycleIncomeCategoryOptionResponse `json:"categories"`
}

type CycleIncomeCategoryOptionResponse struct {
	Name               string `json:"name"`
	IncomeTransactions int    `json:"incomeTransactions"`
	DefinesCycle       bool   `json:"definesCycle"`
}

type UpdateCycleIncomeCategoriesRequest struct {
	Categories []string `json:"categories"`
}

type transactionRow struct {
	ID                      string
	AccountNumber           string
	BookingDate             string
	ValueDate               string
	Amount                  float64
	RawDescription          string
	MerchantKey             string
	Category                sql.NullString
	SuggestedCategory       sql.NullString
	SuggestionConfidence    sql.NullFloat64
	NeedsReview             bool
	ExcludeFromCalculations bool
	ImportedAtUtc           string
	IsMonthlyRecurring      bool
}

type parsedWorkbook struct {
	accountNumber string
	transactions  []ParsedTransaction
}
