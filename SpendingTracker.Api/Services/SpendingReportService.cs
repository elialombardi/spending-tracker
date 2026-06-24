using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using SpendingTracker.Api.Contracts;
using SpendingTracker.Api.Data;
using SpendingTracker.Api.Models;

namespace SpendingTracker.Api.Services;

public sealed class SpendingReportService(SpendingDbContext dbContext)
{
    public async Task<IReadOnlyList<CycleOptionResponse>> GetCycleOptionsAsync(CancellationToken cancellationToken)
    {
        var cycleAnchorCategories = await GetConfiguredCycleIncomeCategoriesAsync(cancellationToken);
        var incomeDates = await BuildCycleAnchorQuery(cycleAnchorCategories)
            .Select(transaction => transaction.BookingDate)
            .Distinct()
            .OrderBy(date => date)
            .ToListAsync(cancellationToken);

        if (incomeDates.Count == 0)
        {
            return [];
        }

        var cycleOptions = new List<CycleOptionResponse>(incomeDates.Count);
        for (var index = 0; index < incomeDates.Count; index++)
        {
            var cycleStart = incomeDates[index];
            var nextCycleStart = index + 1 < incomeDates.Count ? incomeDates[index + 1] : (DateOnly?)null;
            var cycleEnd = nextCycleStart?.AddDays(-1) ?? cycleStart.AddMonths(1).AddDays(-1);
            cycleOptions.Add(new CycleOptionResponse(cycleStart, cycleEnd));
        }

        return cycleOptions
            .OrderByDescending(option => option.From)
            .ToList();
    }

    public async Task<MonthlyReportResponse> GetMonthlyReportAsync(int year, int month, CancellationToken cancellationToken)
    {
        var (from, to) = await GetIncomeAnchoredRangeAsync(year, month, cancellationToken);
        var transactions = await GetTransactionsInRangeAsync(from, to, cancellationToken);
        return BuildMonthlyReport(year, month, from, to, transactions);
    }

    public async Task<MonthlyReportResponse?> GetCycleReportAsync(DateOnly cycleStart, CancellationToken cancellationToken)
    {
        var cycleRange = await GetCycleRangeAsync(cycleStart, cancellationToken);
        if (cycleRange is null)
        {
            return null;
        }

        var (from, to) = cycleRange.Value;
        var transactions = await GetTransactionsInRangeAsync(from, to, cancellationToken);
        return BuildMonthlyReport(cycleStart.Year, cycleStart.Month, from, to, transactions);
    }

    public async Task<ReportExportResult?> ExportMonthlyReportAsync(int year, int month, string format, CancellationToken cancellationToken)
    {
        var normalizedFormat = format.Trim().ToLowerInvariant();
        var (from, to) = await GetIncomeAnchoredRangeAsync(year, month, cancellationToken);
        var transactions = await GetTransactionsInRangeAsync(from, to, cancellationToken);
        var report = BuildMonthlyReport(year, month, from, to, transactions);

        return normalizedFormat switch
        {
            "csv" => BuildCsvExport(report, transactions),
            "xlsx" => BuildExcelExport(report, transactions),
            _ => null
        };
    }

    public async Task<ReportExportResult?> ExportCycleReportAsync(DateOnly cycleStart, string format, CancellationToken cancellationToken)
    {
        var cycleRange = await GetCycleRangeAsync(cycleStart, cancellationToken);
        if (cycleRange is null)
        {
            return null;
        }

        var normalizedFormat = format.Trim().ToLowerInvariant();
        var (from, to) = cycleRange.Value;
        var transactions = await GetTransactionsInRangeAsync(from, to, cancellationToken);
        var report = BuildMonthlyReport(cycleStart.Year, cycleStart.Month, from, to, transactions);

        return normalizedFormat switch
        {
            "csv" => BuildCsvExport(report, transactions),
            "xlsx" => BuildExcelExport(report, transactions),
            _ => null
        };
    }

    private async Task<List<BankTransaction>> GetTransactionsInRangeAsync(DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var transactions = await dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.BookingDate >= from && transaction.BookingDate <= to && !transaction.ExcludeFromCalculations)
            .ToListAsync(cancellationToken);

        return transactions
            .OrderByDescending(transaction => transaction.BookingDate)
            .ThenByDescending(transaction => transaction.ImportedAtUtc)
            .ToList();
    }

    private static MonthlyReportResponse BuildMonthlyReport(int year, int month, DateOnly from, DateOnly to, IReadOnlyList<BankTransaction> transactions)
    {
        var expenses = transactions.Where(transaction => transaction.Amount < 0).ToList();
        var incomes = transactions.Where(transaction => transaction.Amount > 0).ToList();

        var categories = expenses
            .GroupBy(transaction => string.IsNullOrWhiteSpace(transaction.Category) ? "Uncategorized" : transaction.Category!)
            .Select(group => new CategorySpendResponse(
                group.Key,
                Math.Round(group.Sum(transaction => Math.Abs(transaction.Amount)), 2),
                group.Count(),
                0m))
            .OrderByDescending(group => group.TotalSpent)
            .ToList();

        var totalSpent = categories.Sum(category => category.TotalSpent);
        var normalizedCategories = categories
            .Select(category => category with
            {
                ShareOfSpent = totalSpent == 0m ? 0m : Math.Round(category.TotalSpent / totalSpent, 4)
            })
            .ToList();

        var topMerchants = expenses
            .GroupBy(transaction => transaction.MerchantKey)
            .Select(group => new MerchantSpendResponse(
                group.Key,
                group.Select(transaction => transaction.Category).FirstOrDefault(category => !string.IsNullOrWhiteSpace(category)),
                Math.Round(group.Sum(transaction => Math.Abs(transaction.Amount)), 2),
                group.Count()))
            .OrderByDescending(group => group.TotalSpent)
            .Take(8)
            .ToList();

        var largestExpenses = expenses
            .OrderByDescending(transaction => Math.Abs(transaction.Amount))
            .Take(12)
            .Select(MapReportTransaction)
            .ToList();

        return new MonthlyReportResponse(
            year,
            month,
            from,
            to,
            transactions.Count,
            totalSpent,
            Math.Round(incomes.Sum(transaction => transaction.Amount), 2),
            normalizedCategories.Where(category => category.Category == "Uncategorized").Sum(category => category.TotalSpent),
            normalizedCategories,
            topMerchants,
            largestExpenses);
    }

    private static ReportExportResult BuildCsvExport(MonthlyReportResponse report, IReadOnlyList<BankTransaction> transactions)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Year,Month,From,To,TotalTransactions,TotalSpent,TotalIncome,UncategorizedSpent");
        builder.AppendLine(string.Join(",",
            report.Year.ToString(CultureInfo.InvariantCulture),
            report.Month.ToString(CultureInfo.InvariantCulture),
            report.From.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            report.To.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            report.TotalTransactions.ToString(CultureInfo.InvariantCulture),
            report.TotalSpent.ToString("0.00", CultureInfo.InvariantCulture),
            report.TotalIncome.ToString("0.00", CultureInfo.InvariantCulture),
            report.UncategorizedSpent.ToString("0.00", CultureInfo.InvariantCulture)));

        builder.AppendLine();
        builder.AppendLine("Category,TotalSpent,Transactions,ShareOfSpent");
        foreach (var category in report.Categories)
        {
            builder.AppendLine(string.Join(",",
                EscapeCsv(category.Category),
                category.TotalSpent.ToString("0.00", CultureInfo.InvariantCulture),
                category.Transactions.ToString(CultureInfo.InvariantCulture),
                category.ShareOfSpent.ToString("0.0000", CultureInfo.InvariantCulture)));
        }

        builder.AppendLine();
        builder.AppendLine("BookingDate,ValueDate,Direction,Amount,Category,MerchantKey,NeedsReview,Description");
        foreach (var transaction in transactions)
        {
            builder.AppendLine(string.Join(",",
                transaction.BookingDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                transaction.ValueDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                transaction.Amount < 0 ? "expense" : "income",
                transaction.Amount.ToString("0.00", CultureInfo.InvariantCulture),
                EscapeCsv(transaction.Category ?? string.Empty),
                EscapeCsv(transaction.MerchantKey),
                transaction.NeedsReview ? "true" : "false",
                EscapeCsv(transaction.RawDescription)));
        }

        return new ReportExportResult(
            Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(builder.ToString())).ToArray(),
            "text/csv",
            $"spending-report-{report.From:yyyy-MM-dd}_to_{report.To:yyyy-MM-dd}.csv");
    }

    private static ReportExportResult BuildExcelExport(MonthlyReportResponse report, IReadOnlyList<BankTransaction> transactions)
    {
        using var workbook = new XLWorkbook();

        var overviewSheet = workbook.AddWorksheet("Overview");
        overviewSheet.Cell("A1").Value = "Cycle start";
        overviewSheet.Cell("B1").Value = $"{report.From:yyyy-MM-dd}";
        overviewSheet.Cell("A2").Value = "Income cycle";
        overviewSheet.Cell("B2").Value = $"{report.From:yyyy-MM-dd} to {report.To:yyyy-MM-dd}";
        overviewSheet.Cell("A3").Value = "Total transactions";
        overviewSheet.Cell("B3").Value = report.TotalTransactions;
        overviewSheet.Cell("A4").Value = "Total spent";
        overviewSheet.Cell("B4").Value = report.TotalSpent;
        overviewSheet.Cell("A5").Value = "Total income";
        overviewSheet.Cell("B5").Value = report.TotalIncome;
        overviewSheet.Cell("A6").Value = "Uncategorized spent";
        overviewSheet.Cell("B6").Value = report.UncategorizedSpent;
        overviewSheet.Range("A1:B6").Style.Font.Bold = true;
        overviewSheet.Column("A").Width = 22;
        overviewSheet.Column("B").Width = 20;

        var categorySheet = workbook.AddWorksheet("Categories");
        categorySheet.Cell("A1").InsertTable(report.Categories.Select(category => new
        {
            category.Category,
            category.TotalSpent,
            category.Transactions,
            category.ShareOfSpent
        }), "CategoryBreakdown", true);

        var transactionSheet = workbook.AddWorksheet("Transactions");
        transactionSheet.Cell("A1").InsertTable(transactions.Select(transaction => new
        {
            BookingDate = transaction.BookingDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ValueDate = transaction.ValueDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            Direction = transaction.Amount < 0 ? "expense" : "income",
            Amount = transaction.Amount,
            Category = transaction.Category ?? string.Empty,
            MerchantKey = transaction.MerchantKey,
            NeedsReview = transaction.NeedsReview,
            Description = transaction.RawDescription
        }), "Transactions", true);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        return new ReportExportResult(
            stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"spending-report-{report.From:yyyy-MM-dd}_to_{report.To:yyyy-MM-dd}.xlsx");
    }

    private async Task<(DateOnly From, DateOnly To)> GetIncomeAnchoredRangeAsync(int year, int month, CancellationToken cancellationToken)
    {
        var calendarMonthStart = new DateOnly(year, month, 1);
        var calendarMonthEnd = calendarMonthStart.AddMonths(1).AddDays(-1);
        var cycleAnchorCategories = await GetConfiguredCycleIncomeCategoriesAsync(cancellationToken);

        var cycleStart = await BuildCycleAnchorQuery(cycleAnchorCategories)
            .Where(transaction => transaction.BookingDate <= calendarMonthEnd)
            .OrderByDescending(transaction => transaction.BookingDate)
            .Select(transaction => (DateOnly?)transaction.BookingDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (cycleStart is null)
        {
            return (calendarMonthStart, calendarMonthEnd);
        }

        var nextIncomeDate = await BuildCycleAnchorQuery(cycleAnchorCategories)
            .Where(transaction => transaction.BookingDate > cycleStart.Value)
            .OrderBy(transaction => transaction.BookingDate)
            .Select(transaction => (DateOnly?)transaction.BookingDate)
            .FirstOrDefaultAsync(cancellationToken);

        var cycleEnd = nextIncomeDate?.AddDays(-1) ?? cycleStart.Value.AddMonths(1).AddDays(-1);
        return (cycleStart.Value, cycleEnd);
    }

    private async Task<(DateOnly From, DateOnly To)?> GetCycleRangeAsync(DateOnly cycleStart, CancellationToken cancellationToken)
    {
        var cycleAnchorCategories = await GetConfiguredCycleIncomeCategoriesAsync(cancellationToken);
        var cycleExists = await BuildCycleAnchorQuery(cycleAnchorCategories)
            .AnyAsync(transaction => transaction.BookingDate == cycleStart, cancellationToken);

        if (!cycleExists)
        {
            return null;
        }

        var nextIncomeDate = await BuildCycleAnchorQuery(cycleAnchorCategories)
            .Where(transaction => transaction.BookingDate > cycleStart)
            .OrderBy(transaction => transaction.BookingDate)
            .Select(transaction => (DateOnly?)transaction.BookingDate)
            .FirstOrDefaultAsync(cancellationToken);

        var cycleEnd = nextIncomeDate?.AddDays(-1) ?? cycleStart.AddMonths(1).AddDays(-1);
        return (cycleStart, cycleEnd);
    }

    private IQueryable<BankTransaction> BuildCycleAnchorQuery(IReadOnlyList<string> cycleAnchorCategories)
    {
        var query = dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.Amount > 0 && !transaction.ExcludeFromCalculations);

        if (cycleAnchorCategories.Count == 0)
        {
            return query;
        }

        return query.Where(transaction =>
            !string.IsNullOrWhiteSpace(transaction.Category) &&
            cycleAnchorCategories.Contains(transaction.Category!));
    }

    private Task<List<string>> GetConfiguredCycleIncomeCategoriesAsync(CancellationToken cancellationToken)
    {
        return dbContext.CycleIncomeCategories
            .AsNoTracking()
            .OrderBy(entry => entry.Category)
            .Select(entry => entry.Category)
            .ToListAsync(cancellationToken);
    }

    private static string EscapeCsv(string value)
    {
        var normalized = value.Replace("\r", " ").Replace("\n", " ");
        if (normalized.Contains(',') || normalized.Contains('"'))
        {
            return $"\"{normalized.Replace("\"", "\"\"")}\"";
        }

        return normalized;
    }

    private static ReportTransactionResponse MapReportTransaction(BankTransaction transaction)
    {
        return new ReportTransactionResponse(
            transaction.Id,
            transaction.BookingDate,
            transaction.ValueDate,
            transaction.Amount,
            transaction.Amount < 0 ? "expense" : "income",
            transaction.RawDescription,
            transaction.MerchantKey,
            transaction.Category,
            transaction.NeedsReview);
    }
}

public sealed record ReportExportResult(byte[] Content, string ContentType, string FileName);