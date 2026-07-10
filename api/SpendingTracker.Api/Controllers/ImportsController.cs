using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendingTracker.Api.Authentication;
using SpendingTracker.Api.Contracts;
using SpendingTracker.Api.Services;

namespace SpendingTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class ImportsController(TransactionImportService importService) : ControllerBase
{
    [HttpPost("poste-italiane")]
    [Authorize(Policy = AuthPolicies.ApiWriter)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ImportResultResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ImportResultResponse>> ImportPosteItaliane([FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest("A non-empty Excel file is required.");
        }

        if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Only .xlsx Poste Italiane exports are supported.");
        }

        await using var stream = file.OpenReadStream();
        var result = await importService.ImportAsync(stream, file.FileName, cancellationToken);

        return Ok(result);
    }
}