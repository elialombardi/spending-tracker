package reports

import (
	"database/sql"
	"errors"
	"regexp"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	dateLayout                       = "2006-01-02"
	merchantRuleBehaviorAutoApply    = "AutoApply"
	merchantRuleBehaviorAlwaysReview = "AlwaysReview"
)

var alwaysReviewMerchants = map[string]struct{}{
	"AMAZON": {},
}

var (
	sumUpRegex                    = regexp.MustCompile(`^SUMUP\s+\*?`)
	payPalRegex                   = regexp.MustCompile(`^PAYPAL\s+\*(.+)$`)
	amazonMktpRegex               = regexp.MustCompile(`\bAMZN MKTP IT\*[A-Z0-9]+\b`)
	amazonItRegex                 = regexp.MustCompile(`\bAMAZON\.IT\*[A-Z0-9]+\b`)
	daznRegex                     = regexp.MustCompile(`\bWWW\.DAZN\.COM\b`)
	instantTransferReferenceRegex = regexp.MustCompile(`\bTRN\s+[A-Z0-9]+\s+BENEF\.?\s+`)
	sepaReferenceRegex            = regexp.MustCompile(`\s+CID\.[A-Z0-9\.]+\s+MAN\.[A-Z0-9]+.*`)
	cardOperationRegex            = regexp.MustCompile(`\s+\d{2}/\d{2}/\d{4}\s+\d{2}\.\d{2}\s+[A-Z ]+\s+OP\.\d+\s+CARTA\s+\*+\d+$`)
	operationSuffixRegex          = regexp.MustCompile(`\s+OP\.\d+.*`)
	trailingLocationRegex         = regexp.MustCompile(`\s+\d{2}/\d{2}/\d{4}\s+\d{2}\.\d{2}.*$`)
	terminalCodeRegex             = regexp.MustCompile(`\s+[A-Z0-9]{8,}$`)
)

type TransactionService struct {
	db *gorm.DB
}

func NewTransactionService(db *gorm.DB) *TransactionService {
	return &TransactionService{db: db}
}

func (s *TransactionService) FetchTransactions(from, to *time.Time, direction, category string, hasNeedsReview bool, needsReview bool) ([]Transaction, error) {
	query := s.db.Model(&Transaction{})

	if from != nil {
		query = query.Where("booking_date >= ?", from.Format(dateLayout))
	}
	if to != nil {
		query = query.Where("booking_date <= ?", to.Format(dateLayout))
	}
	if direction != "" {
		if strings.EqualFold(direction, "income") {
			query = query.Where("amount > ?", 0)
		} else {
			query = query.Where("amount < ?", 0)
		}
	}
	if hasNeedsReview {
		query = query.Where("needs_review = ?", needsReview)
	}
	if category != "" {
		if strings.EqualFold(category, "uncategorized") {
			query = query.Where("category IS NULL OR TRIM(category) = ''")
		} else {
			query = query.Where("category = ?", category)
		}
	}

	query = query.Order("booking_date DESC, imported_at_utc DESC")

	var transactions []Transaction
	if err := query.Find(&transactions).Error; err != nil {
		return nil, err
	}
	return transactions, nil
}

type CategorySummary struct {
	Category *string `gorm:"column:category"`
	Amount   float64 `gorm:"column:amount"`
}

func (s *TransactionService) FetchCategorySummary(from, to *time.Time) ([]CategorySummary, error) {
	query := s.db.Model(&Transaction{}).
		Select("category, SUM(ABS(amount)) AS amount").
		Where("amount < ? AND exclude_from_calculations = ?", 0, false).
		Group("category")

	if from != nil {
		query = query.Where("booking_date >= ?", from.Format(dateLayout))
	}
	if to != nil {
		query = query.Where("booking_date <= ?", to.Format(dateLayout))
	}

	var results []CategorySummary
	if err := query.Scan(&results).Error; err != nil {
		return nil, err
	}
	return results, nil
}

type CategoryCount struct {
	Category string `gorm:"column:category"`
	Count    int    `gorm:"column:count"`
}

func (s *TransactionService) FetchCategoryRuleCounts() ([]CategoryCount, error) {
	var rows []CategoryCount
	err := s.db.Model(&CategoryRule{}).
		Select("category, COUNT(1) AS count").
		Where("behavior = ? AND TRIM(category) <> ''", merchantRuleBehaviorAutoApply).
		Group("category").
		Scan(&rows).Error
	return rows, err
}

func (s *TransactionService) FetchTransactionCategoryCounts() ([]CategoryCount, error) {
	var rows []CategoryCount
	err := s.db.Model(&Transaction{}).
		Select("category, COUNT(1) AS count").
		Where("exclude_from_calculations = ? AND category IS NOT NULL AND TRIM(category) <> ''", false).
		Group("category").
		Scan(&rows).Error
	return rows, err
}

func (s *TransactionService) FetchCycleIncomeCategoryCounts() ([]CategoryCount, error) {
	var rows []CategoryCount
	err := s.db.Model(&Transaction{}).
		Select("category, COUNT(1) AS count").
		Where("amount > ? AND exclude_from_calculations = ? AND category IS NOT NULL AND TRIM(category) <> ''", 0, false).
		Group("category").
		Scan(&rows).Error
	return rows, err
}

func (s *TransactionService) FetchCategoryMappings() ([]CategoryRule, error) {
	var rules []CategoryRule
	if err := s.db.Order("merchant_key ASC").Find(&rules).Error; err != nil {
		return nil, err
	}
	return rules, nil
}

func (s *TransactionService) FetchTransactionByID(transactionID string) (Transaction, error) {
	var txRow Transaction
	err := s.db.Where("id = ?", transactionID).First(&txRow).Error
	return txRow, err
}

func (s *TransactionService) GetMerchantRuleBehavior(merchantKey string) (string, error) {
	var rule CategoryRule
	err := s.db.Where("merchant_key = ?", merchantKey).First(&rule).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return defaultRuleBehavior(merchantKey), nil
	}
	if err != nil {
		return "", err
	}
	return normalizeBehavior(rule.Behavior), nil
}

func (s *TransactionService) SaveCategoryMapping(mappingID, behavior, category string) (CategoryRule, bool, error) {
	var updated CategoryRule

	err := s.db.Transaction(func(tx *gorm.DB) error {
		var existing CategoryRule
		if err := tx.Where("id = ?", mappingID).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return gorm.ErrRecordNotFound
			}
			return err
		}

		appliedCount := existing.AppliedCount
		storedCategory := ""
		if behavior == merchantRuleBehaviorAutoApply {
			storedCategory = category
			count, err := s.applyCategoryToMerchantTransactionsTx(tx, existing.MerchantKey, category)
			if err != nil {
				return err
			}
			if count > appliedCount {
				appliedCount = count
			}
		}

		now := time.Now().UTC().Format(time.RFC3339)
		if err := tx.Model(&CategoryRule{}).
			Where("id = ?", mappingID).
			Updates(map[string]any{
				"Category":     storedCategory,
				"Behavior":     behavior,
				"AppliedCount": appliedCount,
				"UpdatedAtUtc": now,
			}).Error; err != nil {
			return err
		}

		return tx.Where("id = ?", mappingID).First(&updated).Error
	})

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return CategoryRule{}, false, nil
	}
	if err != nil {
		return CategoryRule{}, false, err
	}
	return updated, true, nil
}

func (s *TransactionService) RemoveCategoryMapping(mappingID string) (bool, error) {
	result := s.db.Where("id = ?", mappingID).Delete(&CategoryRule{})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func (s *TransactionService) ApplyCategorization(transactionID string, request CategorizeTransactionRequest, category string) (Transaction, bool, string, error) {
	var finalBehavior string

	err := s.db.Transaction(func(tx *gorm.DB) error {
		var row Transaction
		if err := tx.Where("id = ?", transactionID).First(&row).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return gorm.ErrRecordNotFound
			}
			return err
		}

		merchantKey := row.MerchantKey
		if request.MerchantKey != nil && strings.TrimSpace(*request.MerchantKey) != "" {
			merchantKey = extractMerchantKey(*request.MerchantKey)
		}

		behavior := defaultRuleBehavior(merchantKey)
		if request.RuleBehavior != nil && normalizeBehavior(*request.RuleBehavior) != "" {
			behavior = normalizeBehavior(*request.RuleBehavior)
		}

		if err := tx.Model(&Transaction{}).
			Where("id = ?", transactionID).
			Updates(map[string]any{
				"Category":                category,
				"MerchantKey":             merchantKey,
				"NeedsReview":             false,
				"SuggestedCategory":       nil,
				"SuggestionConfidence":    nil,
				"ExcludeFromCalculations": request.ExcludeFromCalculations,
				"IsMonthlyRecurring":      request.IsMonthlyRecurring,
			}).Error; err != nil {
			return err
		}

		finalBehavior = behavior
		if request.SaveRule {
			if err := s.upsertCategoryRuleTx(tx, merchantKey, category, behavior); err != nil {
				return err
			}
			if behavior == merchantRuleBehaviorAutoApply {
				if err := tx.Model(&Transaction{}).
					Where("merchant_key = ?", merchantKey).
					Updates(map[string]any{
						"Category":             category,
						"MerchantKey":          merchantKey,
						"NeedsReview":          false,
						"SuggestedCategory":    nil,
						"SuggestionConfidence": nil,
					}).Error; err != nil {
					return err
				}
			}
		} else {
			ruleBehavior, err := s.getMerchantRuleBehaviorTx(tx, merchantKey)
			if err != nil {
				return err
			}
			finalBehavior = ruleBehavior
		}

		return nil
	})

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Transaction{}, false, "", nil
	}
	if err != nil {
		return Transaction{}, false, "", err
	}

	updated, err := s.FetchTransactionByID(transactionID)
	if err != nil {
		return Transaction{}, false, "", err
	}
	return updated, true, finalBehavior, nil
}

func (s *TransactionService) UpsertCategoryRule(merchantKey, category, behavior string) (CategoryRule, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		return s.upsertCategoryRuleTx(tx, merchantKey, category, behavior)
	})
	if err != nil {
		return CategoryRule{}, err
	}

	var rule CategoryRule
	if err := s.db.Where("merchant_key = ?", merchantKey).First(&rule).Error; err != nil {
		return CategoryRule{}, err
	}
	return rule, nil
}

func (s *TransactionService) upsertCategoryRuleTx(tx *gorm.DB, merchantKey, category, behavior string) error {
	now := time.Now().UTC().Format(time.RFC3339)

	var existing CategoryRule
	err := tx.Where("merchant_key = ?", merchantKey).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		storedCategory := ""
		if behavior == merchantRuleBehaviorAutoApply {
			storedCategory = category
		}
		newRule := CategoryRule{
			ID:           newUUID(),
			MerchantKey:  merchantKey,
			Category:     storedCategory,
			Behavior:     behavior,
			AppliedCount: 1,
			CreatedAtUtc: now,
			UpdatedAtUtc: now,
		}
		return tx.Create(&newRule).Error
	}
	if err != nil {
		return err
	}

	storedCategory := ""
	if behavior == merchantRuleBehaviorAutoApply {
		storedCategory = category
	}

	return tx.Model(&CategoryRule{}).
		Where("id = ?", existing.ID).
		Updates(map[string]any{
			"Category":     storedCategory,
			"Behavior":     behavior,
			"AppliedCount": existing.AppliedCount + 1,
			"UpdatedAtUtc": now,
		}).Error
}

func (s *TransactionService) applyCategoryToMerchantTransactionsTx(tx *gorm.DB, merchantKey, category string) (int, error) {
	result := tx.Model(&Transaction{}).
		Where("merchant_key = ? AND Amount < ?", merchantKey, 0).
		Updates(map[string]any{
			"Category":             category,
			"NeedsReview":          false,
			"SuggestedCategory":    nil,
			"SuggestionConfidence": nil,
		})
	if result.Error != nil {
		return 0, result.Error
	}
	return int(result.RowsAffected), nil
}

// SendTransactions updates the IsSending flag for the provided transaction IDs
// and returns the number of rows affected.
func (s *TransactionService) SendTransactions(ids []string, isSending bool) (int64, error) {
	cleanIDs := make([]string, 0, len(ids))
	for _, id := range ids {
		trimmed := strings.TrimSpace(id)
		if trimmed != "" {
			cleanIDs = append(cleanIDs, trimmed)
		}
	}

	if len(cleanIDs) == 0 {
		return 0, nil
	}
	res := s.db.Model(&Transaction{}).
		Where("id IN ?", cleanIDs).
		Updates(map[string]any{"IsSending": isSending})
	if res.Error != nil {
		return 0, res.Error
	}
	return res.RowsAffected, nil
}

func (s *TransactionService) getMerchantRuleBehaviorTx(tx *gorm.DB, merchantKey string) (string, error) {
	var rule CategoryRule
	err := tx.Where("merchant_key = ?", merchantKey).First(&rule).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return defaultRuleBehavior(merchantKey), nil
	}
	if err != nil {
		return "", err
	}
	return normalizeBehavior(rule.Behavior), nil
}

func (s *TransactionService) CountMatchingTransactions(merchantKey string) (int, error) {
	var count int64
	err := s.db.Model(&Transaction{}).
		Where("merchant_key = ? AND amount < ? AND exclude_from_calculations = ?", merchantKey, 0, false).
		Count(&count).Error
	return int(count), err
}

func (s *TransactionService) ResolveMerchantRuleBehavior(merchantKey string, lookup map[string]string) string {
	if behavior, ok := lookup[merchantKey]; ok && behavior != "" {
		return behavior
	}
	return defaultRuleBehavior(merchantKey)
}

func (s *TransactionService) FetchRuleBehaviorLookup() (map[string]string, error) {
	var rules []CategoryRule
	if err := s.db.Select("merchant_key", "behavior").Find(&rules).Error; err != nil {
		return nil, err
	}

	lookup := map[string]string{}
	for _, r := range rules {
		lookup[r.MerchantKey] = normalizeBehavior(r.Behavior)
	}
	return lookup, nil
}

func (s *TransactionService) FetchCategories() ([]CategoryResponse, error) {
	ruleCounts, err := s.FetchCategoryRuleCounts()
	if err != nil {
		return nil, err
	}
	txCounts, err := s.FetchTransactionCategoryCounts()
	if err != nil {
		return nil, err
	}

	rulesByCategory := map[string]int{}
	for _, row := range ruleCounts {
		rulesByCategory[row.Category] = row.Count
	}

	response := make([]CategoryResponse, 0, len(txCounts))
	for _, row := range txCounts {
		response = append(response, CategoryResponse{
			Name:         row.Category,
			Rules:        rulesByCategory[row.Category],
			Transactions: row.Count,
		})
	}
	sort.Slice(response, func(i, j int) bool { return response[i].Name < response[j].Name })
	return response, nil
}

func (s *TransactionService) FetchCycleIncomeCategories() (CycleIncomeCategoriesResponse, error) {
	configured, err := s.fetchConfiguredCycleIncomeCategories()
	if err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}
	anchors, err := s.fetchCycleAnchorDates(configured)
	if err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}

	response := CycleIncomeCategoriesResponse{
		UsesAllIncomeTransactions: len(configured) == 0,
		Categories:                []CycleIncomeCategoryOptionResponse{},
	}

	for _, category := range configured {
		var count int64
		if err := s.db.Model(&Transaction{}).
			Where("amount > ? AND exclude_from_calculations = ? AND category = ?", 0, false, category).
			Count(&count).Error; err != nil {
			return CycleIncomeCategoriesResponse{}, err
		}

		response.Categories = append(response.Categories, CycleIncomeCategoryOptionResponse{
			Name:               category,
			IncomeTransactions: int(count),
			DefinesCycle:       count > 0 && len(anchors) > 0,
		})
	}

	return response, nil
}

func (s *TransactionService) SaveCycleIncomeCategories(categories []string) (CycleIncomeCategoriesResponse, error) {
	normalized := normalizeCategoryNames(categories)
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("1 = 1").Delete(&CycleIncomeCategory{}).Error; err != nil {
			return err
		}
		now := time.Now().UTC().Format(time.RFC3339)
		for _, category := range normalized {
			entry := CycleIncomeCategory{
				ID:           newUUID(),
				Category:     category,
				CreatedAtUtc: now,
				UpdatedAtUtc: now,
			}
			if err := tx.Create(&entry).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return CycleIncomeCategoriesResponse{}, err
	}

	return s.FetchCycleIncomeCategories()
}

func (s *TransactionService) UpdateTransactionAmount(transactionID string, amount float64) (Transaction, string, bool, error) {
	var behavior string

	err := s.db.Transaction(func(tx *gorm.DB) error {
		var current Transaction
		if err := tx.Where("id = ?", transactionID).First(&current).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return gorm.ErrRecordNotFound
			}
			return err
		}

		debit := 0.0
		credit := 0.0
		if amount < 0 {
			debit = -amount
		} else {
			credit = amount
		}

		if err := tx.Model(&Transaction{}).
			Where("id = ?", transactionID).
			Updates(map[string]any{
				"Amount":       amount,
				"DebitAmount":  debit,
				"CreditAmount": credit,
			}).Error; err != nil {
			return err
		}

		ruleBehavior, err := s.getMerchantRuleBehaviorTx(tx, current.MerchantKey)
		if err != nil {
			behavior = defaultRuleBehavior(current.MerchantKey)
		} else {
			behavior = ruleBehavior
		}
		return nil
	})

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Transaction{}, "", false, nil
	}
	if err != nil {
		return Transaction{}, "", false, err
	}

	updated, err := s.FetchTransactionByID(transactionID)
	if err != nil {
		return Transaction{}, "", false, err
	}

	return updated, behavior, true, nil
}

func (s *TransactionService) ImportParsedTransactions(accountNumber string, fileName string, transactions []ParsedTransaction) (ImportResultResponse, error) {
	return importParsedTransactions(s.db, accountNumber, fileName, transactions)
}

func (s *TransactionService) FetchCycleOptions() ([]CycleOptionResponse, error) {
	return fetchCycleOptions(s.db)
}

func (s *TransactionService) FetchCycleReport(cycleStart string) (MonthlyReportResponse, bool, error) {
	return buildCycleReport(s.db, cycleStart)
}

func (s *TransactionService) ExportCycleReport(cycleStart string, format string) ([]byte, string, string, bool, error) {
	return exportCycleReportData(s.db, cycleStart, format)
}

func (s *TransactionService) FetchMonthlyReport(year int, month int) (MonthlyReportResponse, error) {
	return buildMonthlyReportByMonth(s.db, year, month)
}

func (s *TransactionService) ExportMonthlyReport(year int, month int, format string) ([]byte, string, string, error) {
	return exportMonthlyReportData(s.db, year, month, format)
}

func (s *TransactionService) fetchConfiguredCycleIncomeCategories() ([]string, error) {
	var categories []CycleIncomeCategory
	if err := s.db.Order("Category ASC").Find(&categories).Error; err != nil {
		return nil, err
	}
	result := make([]string, 0, len(categories))
	for _, c := range categories {
		result = append(result, c.Category)
	}
	return result, nil
}

func (s *TransactionService) fetchCycleAnchorDates(configured []string) ([]string, error) {
	query := s.db.Model(&Transaction{}).
		Select("DISTINCT booking_date").
		Where("amount > ? AND exclude_from_calculations = ?", 0, false)

	if len(configured) > 0 {
		query = query.Where("Category IN ?", configured)
	}

	type row struct {
		BookingDate string `gorm:"column:booking_date"`
	}
	var rows []row
	if err := query.Order("booking_date ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}

	anchors := make([]string, 0, len(rows))
	for _, r := range rows {
		anchors = append(anchors, r.BookingDate)
	}
	return anchors, nil
}

func (s *TransactionService) sqlDB() (*sql.DB, error) {
	return s.db.DB()
}
