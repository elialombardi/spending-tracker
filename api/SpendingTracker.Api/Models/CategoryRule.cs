namespace SpendingTracker.Api.Models;

public sealed class CategoryRule
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string MerchantKey { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public MerchantRuleBehavior Behavior { get; set; } = MerchantRuleBehavior.AutoApply;

    public int AppliedCount { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }
}