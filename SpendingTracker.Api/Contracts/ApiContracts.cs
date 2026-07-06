using SpendingTracker.Api.Models;

namespace SpendingTracker.Api.Contracts;

public sealed record LoginRequest(
    string Username,
    string Password);

public sealed record AuthTokenResponse(
    string AccessToken,
    string TokenType,
    DateTimeOffset ExpiresAt,
    string Username,
    string Role);

public sealed record ImportResultResponse(
    string AccountNumber,
    string FileName,
    int ImportedTransactions,
    int SkippedDuplicates,
    int AutoCategorizedTransactions,
    int ReviewTransactions,
    IReadOnlyList<ReviewTransactionResponse> ReviewQueue);

public sealed record ReviewTransactionResponse(
    Guid TransactionId,
    DateOnly BookingDate,
    decimal Amount,
    string Description,
    string MerchantKey,
    MerchantRuleBehavior MerchantRuleBehavior,
    string? SuggestedCategory,
    double? SuggestionConfidence);

public sealed record TransactionResponse(
    Guid TransactionId,
    string AccountNumber,
    DateOnly BookingDate,
    DateOnly ValueDate,
    decimal Amount,
    string Direction,
    string Description,
    string MerchantKey,
    MerchantRuleBehavior MerchantRuleBehavior,
    string? Category,
    string? SuggestedCategory,
    double? SuggestionConfidence,
    bool NeedsReview,
    bool IsMonthlyRecurring);

public sealed record CategorizeTransactionRequest(
    string Category,
    bool SaveRule = true,
    MerchantRuleBehavior? RuleBehavior = null,
    string? MerchantKey = null,
    bool ExcludeFromCalculations = false,
    bool IsMonthlyRecurring = false);

public sealed record SpendingSummaryResponse(
    DateOnly? From,
    DateOnly? To,
    decimal TotalSpent,
    decimal UncategorizedSpent,
    IReadOnlyList<CategorySpendResponse> Categories);

public sealed record CategorySpendResponse(
    string Category,
    decimal TotalSpent,
    int Transactions,
    decimal ShareOfSpent);

public sealed record CategoryResponse(
    string Name,
    int Rules,
    int Transactions);

public sealed record CategoryMappingResponse(
    Guid MappingId,
    string MerchantKey,
    string? Category,
    MerchantRuleBehavior Behavior,
    int AppliedCount,
    int MatchingTransactions);

public sealed record UpdateCategoryMappingRequest(
    string? Category,
    MerchantRuleBehavior Behavior = MerchantRuleBehavior.AutoApply);

public sealed record CycleIncomeCategoriesResponse(
    bool UsesAllIncomeTransactions,
    IReadOnlyList<CycleIncomeCategoryOptionResponse> Categories);

public sealed record CycleIncomeCategoryOptionResponse(
    string Name,
    int IncomeTransactions,
    bool DefinesCycle);

public sealed record UpdateCycleIncomeCategoriesRequest(
    IReadOnlyList<string>? Categories);

public sealed record CycleOptionResponse(
    DateOnly From,
    DateOnly To);

public sealed record MonthlyReportResponse(
    int Year,
    int Month,
    DateOnly From,
    DateOnly To,
    int TotalTransactions,
    decimal TotalSpent,
    decimal TotalIncome,
    decimal UncategorizedSpent,
    IReadOnlyList<CategorySpendResponse> Categories,
    IReadOnlyList<MerchantSpendResponse> TopMerchants,
    IReadOnlyList<ReportTransactionResponse> LargestExpenses);

public sealed record MerchantSpendResponse(
    string MerchantKey,
    string? Category,
    decimal TotalSpent,
    int Transactions);

public sealed record ReportTransactionResponse(
    Guid TransactionId,
    DateOnly BookingDate,
    DateOnly ValueDate,
    decimal Amount,
    string Direction,
    string Description,
    string MerchantKey,
    string? Category,
    bool NeedsReview);