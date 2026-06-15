using Microsoft.AspNetCore.Mvc;
using SpendingTracker.Api.Contracts;
using SpendingTracker.Api.Services;

namespace SpendingTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ReportsController(SpendingReportService reportService) : ControllerBase
{
    [HttpGet("cycles")]
    [ProducesResponseType(typeof(IReadOnlyList<CycleOptionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CycleOptionResponse>>> GetCycles(CancellationToken cancellationToken)
    {
        var cycles = await reportService.GetCycleOptionsAsync(cancellationToken);
        return Ok(cycles);
    }

    [HttpGet("cycle")]
    [ProducesResponseType(typeof(MonthlyReportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MonthlyReportResponse>> GetCycleReport(
        [FromQuery] DateOnly? cycleStart,
        CancellationToken cancellationToken)
    {
        if (cycleStart is null)
        {
            return BadRequest("Cycle start is required.");
        }

        var report = await reportService.GetCycleReportAsync(cycleStart.Value, cancellationToken);
        if (report is null)
        {
            return NotFound();
        }

        return Ok(report);
    }

    [HttpGet("cycle/export")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ExportCycleReport(
        [FromQuery] DateOnly? cycleStart,
        [FromQuery] string format = "csv",
        CancellationToken cancellationToken = default)
    {
        if (cycleStart is null)
        {
            return BadRequest("Cycle start is required.");
        }

        if (!IsSupportedFormat(format))
        {
            return BadRequest("Supported formats are csv and xlsx.");
        }

        var exportResult = await reportService.ExportCycleReportAsync(cycleStart.Value, format, cancellationToken);
        if (exportResult is null)
        {
            return NotFound();
        }

        return File(exportResult.Content, exportResult.ContentType, exportResult.FileName);
    }

    [HttpGet("monthly")]
    [ProducesResponseType(typeof(MonthlyReportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<MonthlyReportResponse>> GetMonthlyReport(
        [FromQuery] int year,
        [FromQuery] int month,
        CancellationToken cancellationToken)
    {
        if (!TryValidateMonth(year, month, out var errorMessage))
        {
            return BadRequest(errorMessage);
        }

        var report = await reportService.GetMonthlyReportAsync(year, month, cancellationToken);
        return Ok(report);
    }

    [HttpGet("monthly/export")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ExportMonthlyReport(
        [FromQuery] int year,
        [FromQuery] int month,
        [FromQuery] string format = "csv",
        CancellationToken cancellationToken = default)
    {
        if (!TryValidateMonth(year, month, out var errorMessage))
        {
            return BadRequest(errorMessage);
        }

        if (!IsSupportedFormat(format))
        {
            return BadRequest("Supported formats are csv and xlsx.");
        }

        var exportResult = await reportService.ExportMonthlyReportAsync(year, month, format, cancellationToken);
        if (exportResult is null)
        {
            return BadRequest("Supported formats are csv and xlsx.");
        }

        return File(exportResult.Content, exportResult.ContentType, exportResult.FileName);
    }

    private static bool IsSupportedFormat(string format)
    {
        var normalizedFormat = format.Trim().ToLowerInvariant();
        return normalizedFormat is "csv" or "xlsx";
    }

    private static bool TryValidateMonth(int year, int month, out string? errorMessage)
    {
        if (year is < 2000 or > 2100)
        {
            errorMessage = "Year must be between 2000 and 2100.";
            return false;
        }

        if (month is < 1 or > 12)
        {
            errorMessage = "Month must be between 1 and 12.";
            return false;
        }

        errorMessage = null;
        return true;
    }
}