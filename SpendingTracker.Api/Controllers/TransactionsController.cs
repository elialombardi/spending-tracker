using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendingTracker.Api.Authentication;
using SpendingTracker.Api.Contracts;
using SpendingTracker.Api.Services;

namespace SpendingTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class TransactionsController(TransactionImportService importService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<TransactionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<TransactionResponse>>> GetTransactions(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] string? direction,
        [FromQuery] string? category,
        [FromQuery] bool? needsReview,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(direction)
            && !string.Equals(direction, "income", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(direction, "expense", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Direction must be either 'income' or 'expense'.");
        }

        var transactions = await importService.GetTransactionsAsync(from, to, direction, category, needsReview, cancellationToken);
        return Ok(transactions);
    }

    [HttpGet("summary")]
    [ProducesResponseType(typeof(SpendingSummaryResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<SpendingSummaryResponse>> GetSummary(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken)
    {
        var summary = await importService.GetSummaryAsync(from, to, cancellationToken);
        return Ok(summary);
    }

    [HttpPost("{transactionId:guid}/categorize")]
    [Authorize(Policy = AuthPolicies.ApiWriter)]
    [ProducesResponseType(typeof(TransactionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionResponse>> CategorizeTransaction(
        Guid transactionId,
        [FromBody] CategorizeTransactionRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Category))
        {
            return BadRequest("Category is required.");
        }

        var transaction = await importService.CategorizeAsync(transactionId, request, cancellationToken);
        if (transaction is null)
        {
            return NotFound();
        }

        return Ok(transaction);
    }
}