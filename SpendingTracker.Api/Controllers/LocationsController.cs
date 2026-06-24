using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpendingTracker.Api.Data;
using SpendingTracker.Api.Models;

namespace SpendingTracker.Api.Controllers;

[ApiController]
[Route("locations")]
public class LocationsController : ControllerBase
{
    private readonly SpendingDbContext _db;

    public LocationsController(SpendingDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var locations = await _db.Locations
            .Include(l => l.Tags)
            .ToListAsync();

        return Ok(locations.Select(l => ToDto(l)));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var loc = await _db.Locations.Include(l => l.Tags).FirstOrDefaultAsync(l => l.Id == id);
        if (loc == null) return NotFound();
        return Ok(ToDto(loc));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLocationDto dto)
    {
        var location = new Location
        {
            Title = dto.Title,
            Url = dto.Url,
            Lat = dto.Lat,
            Lng = dto.Lng,
            Description = dto.Description
        };

        // attach existing tags or create new
        foreach (var tagName in dto.Tags ?? Enumerable.Empty<string>())
        {
            var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Name == tagName) ?? new Tag { Name = tagName };
            location.Tags.Add(tag);
        }

        _db.Locations.Add(location);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = location.Id }, ToDto(location));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateLocationDto dto)
    {
        var location = await _db.Locations.Include(l => l.Tags).FirstOrDefaultAsync(l => l.Id == id);
        if (location == null) return NotFound();

        location.Title = dto.Title;
        location.Url = dto.Url;
        location.Lat = dto.Lat;
        location.Lng = dto.Lng;
        location.Description = dto.Description;

        // replace tags
        location.Tags.Clear();
        foreach (var tagName in dto.Tags ?? Enumerable.Empty<string>())
        {
            var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Name == tagName) ?? new Tag { Name = tagName };
            location.Tags.Add(tag);
        }

        await _db.SaveChangesAsync();
        return Ok(ToDto(location));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var location = await _db.Locations.FindAsync(id);
        if (location == null) return NotFound();
        _db.Locations.Remove(location);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpPost("{id:int}/tags")]
    public async Task<IActionResult> ToggleTag(int id, [FromBody] ToggleTagDto dto)
    {
        var location = await _db.Locations.Include(l => l.Tags).FirstOrDefaultAsync(l => l.Id == id);
        if (location == null) return NotFound();

        var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Name == dto.Tag);
        if (dto.Present)
        {
            if (tag == null)
            {
                tag = new Tag { Name = dto.Tag };
                _db.Tags.Add(tag);
            }
            if (!location.Tags.Any(t => t.Name == tag.Name))
            {
                location.Tags.Add(tag);
            }
        }
        else
        {
            if (tag != null)
            {
                var existing = location.Tags.FirstOrDefault(t => t.Name == tag.Name);
                if (existing != null) location.Tags.Remove(existing);
            }
        }

        await _db.SaveChangesAsync();
        return Ok(ToDto(location));
    }

    // DTOs + helpers
    private static object ToDto(Location l) => new
    {
        id = l.Id,
        title = l.Title,
        tags = l.Tags.Select(t => t.Name).ToArray(),
        url = l.Url,
        lat = l.Lat,
        lng = l.Lng,
        description = l.Description
    };

    public record CreateLocationDto(string Title, string? Url, double Lat, double Lng, string? Description, string[]? Tags);
    public record UpdateLocationDto(string Title, string? Url, double Lat, double Lng, string? Description, string[]? Tags);
    public record ToggleTagDto(string Tag, bool Present);
}
