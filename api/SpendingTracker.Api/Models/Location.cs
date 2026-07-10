using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SpendingTracker.Api.Models;

public class Location
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(256)]
    public string Title { get; set; } = null!;

    [MaxLength(2048)]
    public string? Url { get; set; }

    public double Lat { get; set; }

    public double Lng { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }

    public ICollection<Tag> Tags { get; set; } = new List<Tag>();
}
