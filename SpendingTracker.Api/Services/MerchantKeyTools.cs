using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using SpendingTracker.Api.Models;

namespace SpendingTracker.Api.Services;

internal static partial class MerchantKeyTools
{
    private static readonly HashSet<string> AlwaysReviewMerchants = new(StringComparer.Ordinal)
    {
        "AMAZON"
    };

    private static readonly string[] KnownPrefixes =
    [
        "PAGAMENTO POS",
        "DOMICILIAZIONE (ADDEBITO DIRETTO SEPA)",
        "DOMICILIAZIONE",
        "BONIFICO SEPA",
        "BONIFICO",
        "GIROCONTO",
        "PRELIEVO ATM",
        "PAGAMENTO",
        "ADDEBITO CARTA"
    ];

    public static string CollapseWhitespace(string value)
    {
        return MultiSpaceRegex().Replace(value.Trim(), " ");
    }

    public static string NormalizeForFingerprint(string value)
    {
        return CollapseWhitespace(value).ToUpperInvariant();
    }

    public static string ExtractMerchantKey(string rawDescription)
    {
        var merchant = NormalizeForFingerprint(rawDescription);

        foreach (var prefix in KnownPrefixes)
        {
            if (merchant.StartsWith(prefix, StringComparison.Ordinal))
            {
                merchant = merchant[prefix.Length..].TrimStart();
                break;
            }
        }

        merchant = SumUpRegex().Replace(merchant, string.Empty);
        merchant = PayPalRegex().Replace(merchant, "$1");
        merchant = AmazonMktpRegex().Replace(merchant, "AMAZON");
        merchant = AmazonItRegex().Replace(merchant, "AMAZON");
        merchant = DaznRegex().Replace(merchant, "DAZN");
        merchant = InstantTransferReferenceRegex().Replace(merchant, " ");
        merchant = SepaReferenceRegex().Replace(merchant, string.Empty);
        merchant = CardOperationRegex().Replace(merchant, string.Empty);
        merchant = OperationSuffixRegex().Replace(merchant, string.Empty);
        merchant = TrailingLocationRegex().Replace(merchant, string.Empty);
        merchant = TerminalCodeRegex().Replace(merchant, string.Empty);
        merchant = merchant
            .Replace("'", " ")
            .Replace(".", " ")
            .Replace(",", " ")
            .Replace("/", " ");
        merchant = merchant.Replace("*", " ");
        merchant = CollapseWhitespace(merchant);

        return merchant.Trim('-', ' ', ':');
    }

    public static string CreateFingerprint(string accountNumber, DateOnly bookingDate, DateOnly valueDate, decimal amount, string rawDescription)
    {
        var payload = string.Join(
            "|",
            accountNumber.Trim(),
            bookingDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            valueDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            amount.ToString("0.00", CultureInfo.InvariantCulture),
            NormalizeForFingerprint(rawDescription));

        using var sha256 = SHA256.Create();
        return Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    public static CategorySuggestion MatchCategory(string merchantKey, IReadOnlyCollection<CategoryRule> rules)
    {
        if (string.IsNullOrWhiteSpace(merchantKey) || rules.Count == 0)
        {
            return CategorySuggestion.ForBehavior(GetDefaultRuleBehavior(merchantKey));
        }

        var exact = rules.FirstOrDefault(rule => string.Equals(rule.MerchantKey, merchantKey, StringComparison.Ordinal));
        if (exact is not null)
        {
            if (exact.Behavior == MerchantRuleBehavior.AlwaysReview)
            {
                return CategorySuggestion.ForBehavior(MerchantRuleBehavior.AlwaysReview);
            }

            return new CategorySuggestion(exact.Category, 1d, true);
        }

        if (GetDefaultRuleBehavior(merchantKey) == MerchantRuleBehavior.AlwaysReview)
        {
            return CategorySuggestion.ForBehavior(MerchantRuleBehavior.AlwaysReview);
        }

        var best = rules
            .Where(rule => rule.Behavior == MerchantRuleBehavior.AutoApply && !string.IsNullOrWhiteSpace(rule.Category))
            .Select(rule => new
            {
                rule.Category,
                Similarity = CalculateSimilarity(merchantKey, rule.MerchantKey)
            })
            .OrderByDescending(candidate => candidate.Similarity)
            .FirstOrDefault();

        if (best is null || best.Similarity < 0.72d)
        {
            return CategorySuggestion.None;
        }

        return new CategorySuggestion(best.Category, Math.Round(best.Similarity, 2), false);
    }

    public static MerchantRuleBehavior GetDefaultRuleBehavior(string merchantKey)
    {
        return AlwaysReviewMerchants.Contains(merchantKey)
            ? MerchantRuleBehavior.AlwaysReview
            : MerchantRuleBehavior.AutoApply;
    }

    private static double CalculateSimilarity(string left, string right)
    {
        if (string.Equals(left, right, StringComparison.Ordinal))
        {
            return 1d;
        }

        var leftTokens = left.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.Ordinal)
            .ToHashSet(StringComparer.Ordinal);
        var rightTokens = right.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.Ordinal)
            .ToHashSet(StringComparer.Ordinal);

        if (leftTokens.Count == 0 || rightTokens.Count == 0)
        {
            return 0d;
        }

        var overlap = leftTokens.Intersect(rightTokens, StringComparer.Ordinal).Count();
        var union = leftTokens.Union(rightTokens, StringComparer.Ordinal).Count();
        var jaccard = union == 0 ? 0d : (double)overlap / union;
        var prefixBonus = left.StartsWith(right, StringComparison.Ordinal) || right.StartsWith(left, StringComparison.Ordinal)
            ? 0.15d
            : 0d;

        return Math.Min(0.99d, jaccard + prefixBonus);
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex MultiSpaceRegex();

    [GeneratedRegex(@"^SUMUP\s+\*?")]
    private static partial Regex SumUpRegex();

    [GeneratedRegex(@"^PAYPAL\s+\*(.+)$")]
    private static partial Regex PayPalRegex();

    [GeneratedRegex(@"\bAMZN MKTP IT\*[A-Z0-9]+\b")]
    private static partial Regex AmazonMktpRegex();

    [GeneratedRegex(@"\bAMAZON\.IT\*[A-Z0-9]+\b")]
    private static partial Regex AmazonItRegex();

    [GeneratedRegex(@"\bWWW\.DAZN\.COM\b")]
    private static partial Regex DaznRegex();

    [GeneratedRegex(@"\bTRN\s+[A-Z0-9]+\s+BENEF\.?\s+")]
    private static partial Regex InstantTransferReferenceRegex();

    [GeneratedRegex(@"\s+CID\.[A-Z0-9\.]+\s+MAN\.[A-Z0-9]+.*")]
    private static partial Regex SepaReferenceRegex();

    [GeneratedRegex(@"\s+\d{2}/\d{2}/\d{4}\s+\d{2}\.\d{2}\s+[A-Z ]+\s+OP\.\d+\s+CARTA\s+\*+\d+$")]
    private static partial Regex CardOperationRegex();

    [GeneratedRegex(@"\s+OP\.\d+.*")]
    private static partial Regex OperationSuffixRegex();

    [GeneratedRegex(@"\s+\d{2}/\d{2}/\d{4}\s+\d{2}\.\d{2}.*$")]
    private static partial Regex TrailingLocationRegex();

    [GeneratedRegex(@"\s+[A-Z0-9]{8,}$")]
    private static partial Regex TerminalCodeRegex();
}

internal sealed record CategorySuggestion(string? Category, double? Confidence, bool ExactMatch)
{
    public static CategorySuggestion None { get; } = new(null, null, false);

    public static CategorySuggestion ForBehavior(MerchantRuleBehavior behavior)
    {
        return behavior == MerchantRuleBehavior.AlwaysReview
            ? new CategorySuggestion(null, null, false)
            : None;
    }
}