using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpendingTracker.Api.Data;
using SpendingTracker.Api.Models;

namespace SpendingTracker.Api.Controllers;

[ApiController]
[Route("tags")]
public class TagsController : ControllerBase
{
    private readonly SpendingDbContext _db;

    public TagsController(SpendingDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var tags = await _db.Tags.OrderBy(t => t.Name).Select(t => t.Name).ToListAsync();
        return Ok(tags);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTagDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name required");
        var existing = await _db.Tags.FirstOrDefaultAsync(t => t.Name == dto.Name);
        if (existing != null) return Conflict("Tag already exists");
        var tag = new Tag { Name = dto.Name };
        _db.Tags.Add(tag);
        await _db.SaveChangesAsync();
        return Ok(tag.Name);
    }

    [HttpPatch("{name}")]
    public async Task<IActionResult> Rename(string name, [FromBody] RenameTagDto dto)
    {
        var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Name == name);
        if (tag == null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.NewName)) return BadRequest("newName required");
        // simple rename, ensure uniqueness
        var conflict = await _db.Tags.FirstOrDefaultAsync(t => t.Name == dto.NewName);
        if (conflict != null) return Conflict("Tag with newName already exists");
        var old = tag.Name;
        tag.Name = dto.NewName;
        await _db.SaveChangesAsync();
        return Ok(new { oldName = old, newName = tag.Name });
    }

    [HttpDelete("{name}")]
    public async Task<IActionResult> Delete(string name)
    {
        var tag = await _db.Tags.Include(t => t.Locations).FirstOrDefaultAsync(t => t.Name == name);
        if (tag == null) return NotFound();
        // Remove relationships first
        tag.Locations.Clear();
        _db.Tags.Remove(tag);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    public record CreateTagDto(string Name);
    public record RenameTagDto(string NewName);
}
