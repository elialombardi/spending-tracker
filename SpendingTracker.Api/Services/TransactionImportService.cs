using Microsoft.EntityFrameworkCore;
using SpendingTracker.Api.Contracts;
using SpendingTracker.Api.Data;
using SpendingTracker.Api.Models;

namespace SpendingTracker.Api.Services;

public sealed class TransactionImportService(SpendingDbContext dbContext, PosteItalianeWorkbookParser workbookParser)
{
    public async Task<ImportResultResponse> ImportAsync(Stream workbookStream, string fileName, CancellationToken cancellationToken)
    {
        var parsedWorkbook = workbookParser.Parse(workbookStream);
        var candidateFingerprints = parsedWorkbook.Transactions
            .Select(transaction => transaction.SourceFingerprint)
            .ToHashSet(StringComparer.Ordinal);

        var existingFingerprints = await dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => candidateFingerprints.Contains(transaction.SourceFingerprint))
            .Select(transaction => transaction.SourceFingerprint)
            .ToListAsync(cancellationToken);

        var knownFingerprints = existingFingerprints.ToHashSet(StringComparer.Ordinal);
        var rules = await dbContext.CategoryRules
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var ruleBehaviorLookup = rules.ToDictionary(rule => rule.MerchantKey, rule => rule.Behavior, StringComparer.Ordinal);

        var now = DateTimeOffset.UtcNow;
        var importedTransactions = new List<BankTransaction>();
        var skippedDuplicates = 0;
        var autoCategorized = 0;

        foreach (var parsedTransaction in parsedWorkbook.Transactions)
        {
            if (!knownFingerprints.Add(parsedTransaction.SourceFingerprint))
            {
                skippedDuplicates++;
                continue;
            }

            var suggestion = MerchantKeyTools.MatchCategory(parsedTransaction.MerchantKey, rules);
            var isIncomingMoney = parsedTransaction.Amount > 0;
            var transaction = new BankTransaction
            {
                AccountNumber = parsedTransaction.AccountNumber,
                BookingDate = parsedTransaction.BookingDate,
                ValueDate = parsedTransaction.ValueDate,
                Amount = parsedTransaction.Amount,
                DebitAmount = parsedTransaction.DebitAmount,
                CreditAmount = parsedTransaction.CreditAmount,
                RawDescription = parsedTransaction.RawDescription,
                NormalizedDescription = parsedTransaction.NormalizedDescription,
                MerchantKey = parsedTransaction.MerchantKey,
                SourceFingerprint = parsedTransaction.SourceFingerprint,
                SourceFileName = fileName,
                ImportedAtUtc = now,
                NeedsReview = !isIncomingMoney,
                SuggestedCategory = isIncomingMoney ? null : suggestion.Category,
                SuggestionConfidence = isIncomingMoney ? null : suggestion.Confidence
            };

            if (!isIncomingMoney && suggestion.ExactMatch && !string.IsNullOrWhiteSpace(suggestion.Category))
            {
                transaction.Category = suggestion.Category;
                transaction.NeedsReview = false;
                transaction.SuggestedCategory = null;
                transaction.SuggestionConfidence = null;
                autoCategorized++;
            }

            importedTransactions.Add(transaction);
            dbContext.Transactions.Add(transaction);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var reviewQueue = importedTransactions
            .Where(transaction => transaction.NeedsReview)
            .OrderByDescending(transaction => Math.Abs(transaction.Amount))
            .Select(transaction => MapReview(transaction, ResolveMerchantRuleBehavior(transaction.MerchantKey, ruleBehaviorLookup)))
            .ToList();

        return new ImportResultResponse(
            parsedWorkbook.AccountNumber,
            fileName,
            importedTransactions.Count,
            skippedDuplicates,
            autoCategorized,
            reviewQueue.Count,
            reviewQueue);
    }

    public async Task<IReadOnlyList<TransactionResponse>> GetTransactionsAsync(
        DateOnly? from,
        DateOnly? to,
        string? direction,
        string? category,
        bool? needsReview,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Transactions.AsNoTracking().AsQueryable();

        if (from is not null)
        {
            query = query.Where(transaction => transaction.BookingDate >= from.Value);
        }

        if (to is not null)
        {
            query = query.Where(transaction => transaction.BookingDate <= to.Value);
        }

        if (!string.IsNullOrWhiteSpace(direction))
        {
            query = direction.Trim().ToLowerInvariant() switch
            {
                "income" => query.Where(transaction => transaction.Amount > 0),
                "expense" => query.Where(transaction => transaction.Amount < 0),
                _ => query
            };
        }

        if (needsReview is not null)
        {
            query = query.Where(transaction => transaction.NeedsReview == needsReview.Value);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            if (string.Equals(category, "uncategorized", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(transaction => string.IsNullOrEmpty(transaction.Category));
            }
            else
            {
                query = query.Where(transaction => transaction.Category == category);
            }
        }

        var transactions = await query.ToListAsync(cancellationToken);
        var ruleBehaviorLookup = await GetMerchantRuleBehaviorLookupAsync(cancellationToken);

        return transactions
            .OrderByDescending(transaction => transaction.BookingDate)
            .ThenByDescending(transaction => transaction.ImportedAtUtc)
            .Select(transaction => MapTransaction(transaction, ResolveMerchantRuleBehavior(transaction.MerchantKey, ruleBehaviorLookup)))
            .ToList();
    }

    public async Task<SpendingSummaryResponse> GetSummaryAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var query = dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.Amount < 0);

        if (from is not null)
        {
            query = query.Where(transaction => transaction.BookingDate >= from.Value);
        }

        if (to is not null)
        {
            query = query.Where(transaction => transaction.BookingDate <= to.Value);
        }

        var expenses = await query.ToListAsync(cancellationToken);
        var groupedExpenses = expenses
            .GroupBy(transaction => string.IsNullOrWhiteSpace(transaction.Category) ? "Uncategorized" : transaction.Category!)
            .Select(group => new
            {
                Category = group.Key,
                TotalSpent = Math.Round(group.Sum(transaction => Math.Abs(transaction.Amount)), 2),
                Transactions = group.Count()
            })
            .OrderByDescending(group => group.TotalSpent)
            .ToList();

        var totalSpent = groupedExpenses.Sum(group => group.TotalSpent);
        var uncategorizedSpent = groupedExpenses
            .Where(group => group.Category == "Uncategorized")
            .Sum(group => group.TotalSpent);

        var categories = groupedExpenses
            .Select(group => new CategorySpendResponse(
                group.Category,
                group.TotalSpent,
                group.Transactions,
                totalSpent == 0m ? 0m : Math.Round(group.TotalSpent / totalSpent, 4)))
            .ToList();

        return new SpendingSummaryResponse(from, to, totalSpent, uncategorizedSpent, categories);
    }

    public async Task<IReadOnlyList<CategoryResponse>> GetCategoriesAsync(CancellationToken cancellationToken)
    {
        var ruleCounts = await dbContext.CategoryRules
            .AsNoTracking()
            .Where(rule => rule.Behavior == MerchantRuleBehavior.AutoApply && !string.IsNullOrWhiteSpace(rule.Category))
            .GroupBy(rule => rule.Category)
            .Select(group => new { Category = group.Key, Rules = group.Count() })
            .ToListAsync(cancellationToken);

        var transactionCounts = await dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => !string.IsNullOrWhiteSpace(transaction.Category))
            .GroupBy(transaction => transaction.Category!)
            .Select(group => new { Category = group.Key, Transactions = group.Count() })
            .ToListAsync(cancellationToken);

        var ruleLookup = ruleCounts.ToDictionary(entry => entry.Category, entry => entry.Rules, StringComparer.OrdinalIgnoreCase);
        var transactionLookup = transactionCounts.ToDictionary(entry => entry.Category, entry => entry.Transactions, StringComparer.OrdinalIgnoreCase);

        var categories = ruleLookup.Keys
            .Union(transactionLookup.Keys, StringComparer.OrdinalIgnoreCase)
            .OrderBy(category => category, StringComparer.OrdinalIgnoreCase)
            .Select(category => new CategoryResponse(
                category,
                ruleLookup.GetValueOrDefault(category, 0),
                transactionLookup.GetValueOrDefault(category, 0)))
            .ToList();

        return categories;
    }

    public async Task<CycleIncomeCategoriesResponse> GetCycleIncomeCategoriesAsync(CancellationToken cancellationToken)
    {
        var configuredCategories = await dbContext.CycleIncomeCategories
            .AsNoTracking()
            .OrderBy(entry => entry.Category)
            .Select(entry => entry.Category)
            .ToListAsync(cancellationToken);

        var incomeCategoryCounts = await dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.Amount > 0 && !string.IsNullOrWhiteSpace(transaction.Category))
            .GroupBy(transaction => transaction.Category!)
            .Select(group => new
            {
                Category = group.Key,
                IncomeTransactions = group.Count()
            })
            .ToListAsync(cancellationToken);

        var configuredSet = configuredCategories.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var transactionLookup = incomeCategoryCounts.ToDictionary(
            entry => entry.Category,
            entry => entry.IncomeTransactions,
            StringComparer.OrdinalIgnoreCase);

        var categories = configuredSet
            .Union(transactionLookup.Keys, StringComparer.OrdinalIgnoreCase)
            .OrderBy(category => category, StringComparer.OrdinalIgnoreCase)
            .Select(category => new CycleIncomeCategoryOptionResponse(
                category,
                transactionLookup.GetValueOrDefault(category, 0),
                configuredSet.Contains(category)))
            .ToList();

        return new CycleIncomeCategoriesResponse(configuredSet.Count == 0, categories);
    }

    public async Task<CycleIncomeCategoriesResponse> UpdateCycleIncomeCategoriesAsync(
        UpdateCycleIncomeCategoriesRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedCategories = NormalizeCategories(request.Categories);
        var normalizedSet = normalizedCategories.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existingCategories = await dbContext.CycleIncomeCategories.ToListAsync(cancellationToken);
        var existingLookup = existingCategories.ToDictionary(entry => entry.Category, StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;

        foreach (var existingCategory in existingCategories)
        {
            if (!normalizedSet.Contains(existingCategory.Category))
            {
                dbContext.CycleIncomeCategories.Remove(existingCategory);
            }
        }

        foreach (var category in normalizedCategories)
        {
            if (existingLookup.TryGetValue(category, out var existingCategory))
            {
                existingCategory.Category = category;
                existingCategory.UpdatedAtUtc = now;
                continue;
            }

            dbContext.CycleIncomeCategories.Add(new CycleIncomeCategory
            {
                Category = category,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return await GetCycleIncomeCategoriesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CategoryMappingResponse>> GetCategoryMappingsAsync(CancellationToken cancellationToken)
    {
        var rules = await dbContext.CategoryRules
            .AsNoTracking()
            .OrderBy(rule => rule.MerchantKey)
            .ToListAsync(cancellationToken);

        if (rules.Count == 0)
        {
            return [];
        }

        var merchantKeys = rules
            .Select(rule => rule.MerchantKey)
            .ToList();

        var transactionCounts = await dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.Amount < 0 && merchantKeys.Contains(transaction.MerchantKey))
            .GroupBy(transaction => transaction.MerchantKey)
            .Select(group => new
            {
                MerchantKey = group.Key,
                Transactions = group.Count()
            })
            .ToListAsync(cancellationToken);

        var transactionLookup = transactionCounts.ToDictionary(
            entry => entry.MerchantKey,
            entry => entry.Transactions,
            StringComparer.Ordinal);

        return rules
            .Select(rule => MapCategoryMapping(rule, transactionLookup.GetValueOrDefault(rule.MerchantKey, 0)))
            .ToList();
    }

    public async Task<CategoryMappingResponse?> UpdateCategoryMappingAsync(
        Guid mappingId,
        UpdateCategoryMappingRequest request,
        CancellationToken cancellationToken)
    {
        var rule = await dbContext.CategoryRules.SingleOrDefaultAsync(
            currentRule => currentRule.Id == mappingId,
            cancellationToken);

        if (rule is null)
        {
            return null;
        }

        var category = MerchantKeyTools.CollapseWhitespace(request.Category ?? string.Empty);
        rule.Behavior = request.Behavior;
        rule.Category = request.Behavior == MerchantRuleBehavior.AutoApply ? category : string.Empty;
        rule.UpdatedAtUtc = DateTimeOffset.UtcNow;

        if (request.Behavior == MerchantRuleBehavior.AutoApply)
        {
            var relatedTransactions = await dbContext.Transactions
                .Where(transaction => transaction.MerchantKey == rule.MerchantKey && transaction.Amount < 0)
                .ToListAsync(cancellationToken);

            foreach (var relatedTransaction in relatedTransactions)
            {
                ApplyCategory(relatedTransaction, category, rule.MerchantKey);
            }

            rule.AppliedCount = Math.Max(rule.AppliedCount, relatedTransactions.Count);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var matchingTransactions = await dbContext.Transactions
            .AsNoTracking()
            .CountAsync(
                transaction => transaction.MerchantKey == rule.MerchantKey && transaction.Amount < 0,
                cancellationToken);

        return MapCategoryMapping(rule, matchingTransactions);
    }

    public async Task<bool> DeleteCategoryMappingAsync(Guid mappingId, CancellationToken cancellationToken)
    {
        var rule = await dbContext.CategoryRules.SingleOrDefaultAsync(
            currentRule => currentRule.Id == mappingId,
            cancellationToken);

        if (rule is null)
        {
            return false;
        }

        dbContext.CategoryRules.Remove(rule);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<TransactionResponse?> CategorizeAsync(
        Guid transactionId,
        CategorizeTransactionRequest request,
        CancellationToken cancellationToken)
    {
        var transaction = await dbContext.Transactions.SingleOrDefaultAsync(
            currentTransaction => currentTransaction.Id == transactionId,
            cancellationToken);

        if (transaction is null)
        {
            return null;
        }

        var category = MerchantKeyTools.CollapseWhitespace(request.Category);
        var merchantKey = string.IsNullOrWhiteSpace(request.MerchantKey)
            ? transaction.MerchantKey
            : MerchantKeyTools.ExtractMerchantKey(request.MerchantKey);
        var ruleBehavior = request.RuleBehavior ?? MerchantKeyTools.GetDefaultRuleBehavior(merchantKey);
        var now = DateTimeOffset.UtcNow;

        ApplyCategory(transaction, category, merchantKey);

        if (request.SaveRule && !string.IsNullOrWhiteSpace(merchantKey))
        {
            var rule = await dbContext.CategoryRules.SingleOrDefaultAsync(
                currentRule => currentRule.MerchantKey == merchantKey,
                cancellationToken);

            if (ruleBehavior == MerchantRuleBehavior.AutoApply)
            {
                var relatedTransactions = await dbContext.Transactions
                    .Where(currentTransaction => currentTransaction.MerchantKey == merchantKey)
                    .ToListAsync(cancellationToken);

                foreach (var relatedTransaction in relatedTransactions)
                {
                    ApplyCategory(relatedTransaction, category, merchantKey);
                }

                if (rule is null)
                {
                    dbContext.CategoryRules.Add(new CategoryRule
                    {
                        MerchantKey = merchantKey,
                        Category = category,
                        Behavior = MerchantRuleBehavior.AutoApply,
                        AppliedCount = Math.Max(1, relatedTransactions.Count),
                        CreatedAtUtc = now,
                        UpdatedAtUtc = now
                    });
                }
                else
                {
                    rule.Category = category;
                    rule.Behavior = MerchantRuleBehavior.AutoApply;
                    rule.AppliedCount += Math.Max(1, relatedTransactions.Count);
                    rule.UpdatedAtUtc = now;
                }
            }
            else
            {
                if (rule is null)
                {
                    dbContext.CategoryRules.Add(new CategoryRule
                    {
                        MerchantKey = merchantKey,
                        Category = string.Empty,
                        Behavior = MerchantRuleBehavior.AlwaysReview,
                        AppliedCount = 1,
                        CreatedAtUtc = now,
                        UpdatedAtUtc = now
                    });
                }
                else
                {
                    rule.Category = string.Empty;
                    rule.Behavior = MerchantRuleBehavior.AlwaysReview;
                    rule.AppliedCount += 1;
                    rule.UpdatedAtUtc = now;
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var finalBehavior = request.SaveRule
            ? ruleBehavior
            : await GetMerchantRuleBehaviorAsync(merchantKey, cancellationToken);

        return MapTransaction(transaction, finalBehavior);
    }

    private async Task<Dictionary<string, MerchantRuleBehavior>> GetMerchantRuleBehaviorLookupAsync(CancellationToken cancellationToken)
    {
        var rules = await dbContext.CategoryRules
            .AsNoTracking()
            .Select(rule => new { rule.MerchantKey, rule.Behavior })
            .ToListAsync(cancellationToken);

        return rules.ToDictionary(rule => rule.MerchantKey, rule => rule.Behavior, StringComparer.Ordinal);
    }

    private async Task<MerchantRuleBehavior> GetMerchantRuleBehaviorAsync(string merchantKey, CancellationToken cancellationToken)
    {
        var existingRuleBehavior = await dbContext.CategoryRules
            .AsNoTracking()
            .Where(rule => rule.MerchantKey == merchantKey)
            .Select(rule => (MerchantRuleBehavior?)rule.Behavior)
            .SingleOrDefaultAsync(cancellationToken);

        return existingRuleBehavior ?? MerchantKeyTools.GetDefaultRuleBehavior(merchantKey);
    }

    private static MerchantRuleBehavior ResolveMerchantRuleBehavior(
        string merchantKey,
        IReadOnlyDictionary<string, MerchantRuleBehavior> ruleBehaviorLookup)
    {
        return ruleBehaviorLookup.TryGetValue(merchantKey, out var behavior)
            ? behavior
            : MerchantKeyTools.GetDefaultRuleBehavior(merchantKey);
    }

    private static List<string> NormalizeCategories(IReadOnlyList<string>? categories)
    {
        if (categories is null || categories.Count == 0)
        {
            return [];
        }

        return categories
            .Select(category => MerchantKeyTools.CollapseWhitespace(category ?? string.Empty))
            .Where(category => !string.IsNullOrWhiteSpace(category))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(category => category, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static void ApplyCategory(BankTransaction transaction, string category, string merchantKey)
    {
        transaction.Category = category;
        transaction.MerchantKey = merchantKey;
        transaction.NeedsReview = false;
        transaction.SuggestedCategory = null;
        transaction.SuggestionConfidence = null;
    }

    private static ReviewTransactionResponse MapReview(BankTransaction transaction, MerchantRuleBehavior merchantRuleBehavior)
    {
        return new ReviewTransactionResponse(
            transaction.Id,
            transaction.BookingDate,
            Math.Abs(transaction.Amount),
            transaction.RawDescription,
            transaction.MerchantKey,
            merchantRuleBehavior,
            transaction.SuggestedCategory,
            transaction.SuggestionConfidence);
    }

    private static CategoryMappingResponse MapCategoryMapping(CategoryRule rule, int matchingTransactions)
    {
        return new CategoryMappingResponse(
            rule.Id,
            rule.MerchantKey,
            string.IsNullOrWhiteSpace(rule.Category) ? null : rule.Category,
            rule.Behavior,
            rule.AppliedCount,
            matchingTransactions);
    }

    private static TransactionResponse MapTransaction(BankTransaction transaction, MerchantRuleBehavior merchantRuleBehavior)
    {
        return new TransactionResponse(
            transaction.Id,
            transaction.AccountNumber,
            transaction.BookingDate,
            transaction.ValueDate,
            transaction.Amount,
            transaction.Amount < 0 ? "expense" : "income",
            transaction.RawDescription,
            transaction.MerchantKey,
            merchantRuleBehavior,
            transaction.Category,
            transaction.SuggestedCategory,
            transaction.SuggestionConfidence,
            transaction.NeedsReview);
    }
}