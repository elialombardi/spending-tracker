namespace SpendingTracker.Api.Models;

public sealed class BankTransaction
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string AccountNumber { get; set; } = string.Empty;

    public DateOnly BookingDate { get; set; }

    public DateOnly ValueDate { get; set; }

    public decimal Amount { get; set; }

    public decimal DebitAmount { get; set; }

    public decimal CreditAmount { get; set; }

    public string RawDescription { get; set; } = string.Empty;

    public string NormalizedDescription { get; set; } = string.Empty;

    public string MerchantKey { get; set; } = string.Empty;

    public string? Category { get; set; }

    public string? SuggestedCategory { get; set; }

    public double? SuggestionConfidence { get; set; }

    public bool NeedsReview { get; set; }

    public string SourceFingerprint { get; set; } = string.Empty;

    public string SourceFileName { get; set; } = string.Empty;

    public DateTimeOffset ImportedAtUtc { get; set; }
}