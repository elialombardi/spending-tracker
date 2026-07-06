using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendingTracker.Api.Authentication;
using SpendingTracker.Api.Contracts;
using SpendingTracker.Api.Models;
using SpendingTracker.Api.Services;

namespace SpendingTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class CategoriesController(TransactionImportService importService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategoryResponse>>> GetCategories(CancellationToken cancellationToken)
    {
        var categories = await importService.GetCategoriesAsync(cancellationToken);
        return Ok(categories);
    }

    [HttpGet("cycle-income")]
    [ProducesResponseType(typeof(CycleIncomeCategoriesResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CycleIncomeCategoriesResponse>> GetCycleIncomeCategories(CancellationToken cancellationToken)
    {
        var cycleIncomeCategories = await importService.GetCycleIncomeCategoriesAsync(cancellationToken);
        return Ok(cycleIncomeCategories);
    }

    [HttpPut("cycle-income")]
    [Authorize(Policy = AuthPolicies.ApiWriter)]
    [ProducesResponseType(typeof(CycleIncomeCategoriesResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CycleIncomeCategoriesResponse>> UpdateCycleIncomeCategories(
        [FromBody] UpdateCycleIncomeCategoriesRequest request,
        CancellationToken cancellationToken)
    {
        var cycleIncomeCategories = await importService.UpdateCycleIncomeCategoriesAsync(request, cancellationToken);
        return Ok(cycleIncomeCategories);
    }

    [HttpGet("mappings")]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryMappingResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CategoryMappingResponse>>> GetCategoryMappings(CancellationToken cancellationToken)
    {
        var mappings = await importService.GetCategoryMappingsAsync(cancellationToken);
        return Ok(mappings);
    }

    [HttpPut("mappings/{mappingId:guid}")]
    [Authorize(Policy = AuthPolicies.ApiWriter)]
    [ProducesResponseType(typeof(CategoryMappingResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoryMappingResponse>> UpdateCategoryMapping(
        Guid mappingId,
        [FromBody] UpdateCategoryMappingRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Behavior == MerchantRuleBehavior.AutoApply && string.IsNullOrWhiteSpace(request.Category))
        {
            return BadRequest("Category is required for auto-apply mappings.");
        }

        var mapping = await importService.UpdateCategoryMappingAsync(mappingId, request, cancellationToken);
        if (mapping is null)
        {
            return NotFound();
        }

        return Ok(mapping);
    }

    [HttpDelete("mappings/{mappingId:guid}")]
    [Authorize(Policy = AuthPolicies.ApiWriter)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCategoryMapping(Guid mappingId, CancellationToken cancellationToken)
    {
        var deleted = await importService.DeleteCategoryMappingAsync(mappingId, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }
}