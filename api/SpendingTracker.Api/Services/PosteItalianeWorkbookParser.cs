using System.Globalization;
using System.Text.RegularExpressions;
using ClosedXML.Excel;

namespace SpendingTracker.Api.Services;

public sealed class PosteItalianeWorkbookParser
{
    private static readonly CultureInfo ItalianCulture = CultureInfo.GetCultureInfo("it-IT");

    public ParsedWorkbook Parse(Stream stream)
    {
        using var workbook = new XLWorkbook(stream);
        var worksheet = workbook.Worksheets.First();
        var headerRowNumber = FindHeaderRowNumber(worksheet);
        var accountNumber = ReadAccountNumber(worksheet);
        var transactions = new List<ParsedTransaction>();

        foreach (var row in worksheet.RowsUsed().Where(candidate => candidate.RowNumber() > headerRowNumber))
        {
            var description = MerchantKeyTools.CollapseWhitespace(row.Cell(5).GetString());
            var debit = ReadAmount(row.Cell(3));
            var credit = ReadAmount(row.Cell(4));

            if (string.IsNullOrWhiteSpace(description) && debit == 0m && credit == 0m)
            {
                continue;
            }

            var bookingDate = ReadDate(row.Cell(1));
            var valueDate = ReadDate(row.Cell(2));
            var amount = credit > 0m ? credit : -debit;
            var merchantKey = MerchantKeyTools.ExtractMerchantKey(description);

            transactions.Add(new ParsedTransaction(
                accountNumber,
                bookingDate,
                valueDate,
                debit,
                credit,
                amount,
                description,
                MerchantKeyTools.NormalizeForFingerprint(description),
                merchantKey,
                MerchantKeyTools.CreateFingerprint(accountNumber, bookingDate, valueDate, amount, description)));
        }

        return new ParsedWorkbook(accountNumber, transactions);
    }

    private static int FindHeaderRowNumber(IXLWorksheet worksheet)
    {
        var headerRow = worksheet.RowsUsed().FirstOrDefault(row =>
        {
            var firstCell = MerchantKeyTools.NormalizeForFingerprint(row.Cell(1).GetString());
            var fifthCell = MerchantKeyTools.NormalizeForFingerprint(row.Cell(5).GetString());
            return firstCell == "DATA CONTABILE" && fifthCell == "DESCRIZIONE OPERAZIONI";
        });

        if (headerRow is null)
        {
            throw new InvalidDataException("Could not find the Poste Italiane transaction header row.");
        }

        return headerRow.RowNumber();
    }

    private static string ReadAccountNumber(IXLWorksheet worksheet)
    {
        foreach (var row in worksheet.RowsUsed().Take(20))
        {
            var rowText = string.Join(" ", row.CellsUsed().Select(cell => cell.GetFormattedString().Trim()));
            var match = Regex.Match(rowText, @"Conto\s+BancoPosta\s+n\.:\s*(\S+)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            if (match.Success)
            {
                return match.Groups[1].Value.Trim();
            }
        }

        return "UNKNOWN";
    }

    private static DateOnly ReadDate(IXLCell cell)
    {
        if (cell.TryGetValue<DateTime>(out var dateTime))
        {
            return DateOnly.FromDateTime(dateTime);
        }

        if (cell.TryGetValue<double>(out var serialDate))
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serialDate));
        }

        var text = cell.GetFormattedString().Trim();
        if (DateTime.TryParse(text, ItalianCulture, DateTimeStyles.None, out dateTime))
        {
            return DateOnly.FromDateTime(dateTime);
        }

        throw new InvalidDataException($"Could not parse date value '{text}'.");
    }

    private static decimal ReadAmount(IXLCell cell)
    {
        if (cell.IsEmpty())
        {
            return 0m;
        }

        if (cell.TryGetValue<decimal>(out var amount))
        {
            return amount;
        }

        if (cell.TryGetValue<double>(out var numericAmount))
        {
            return Convert.ToDecimal(numericAmount, CultureInfo.InvariantCulture);
        }

        var text = cell.GetFormattedString().Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return 0m;
        }

        if (decimal.TryParse(text, NumberStyles.Number | NumberStyles.AllowLeadingSign, ItalianCulture, out amount))
        {
            return amount;
        }

        if (decimal.TryParse(text, NumberStyles.Number | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out amount))
        {
            return amount;
        }

        throw new InvalidDataException($"Could not parse amount value '{text}'.");
    }
}

public sealed record ParsedWorkbook(string AccountNumber, IReadOnlyList<ParsedTransaction> Transactions);

public sealed record ParsedTransaction(
    string AccountNumber,
    DateOnly BookingDate,
    DateOnly ValueDate,
    decimal DebitAmount,
    decimal CreditAmount,
    decimal Amount,
    string RawDescription,
    string NormalizedDescription,
    string MerchantKey,
    string SourceFingerprint);