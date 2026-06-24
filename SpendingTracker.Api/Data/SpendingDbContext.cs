using Microsoft.EntityFrameworkCore;
using SpendingTracker.Api.Models;

namespace SpendingTracker.Api.Data;

public sealed class SpendingDbContext(DbContextOptions<SpendingDbContext> options) : DbContext(options)
{
    public DbSet<BankTransaction> Transactions => Set<BankTransaction>();

    public DbSet<CategoryRule> CategoryRules => Set<CategoryRule>();

    public DbSet<CycleIncomeCategory> CycleIncomeCategories => Set<CycleIncomeCategory>();

    // Locations and tags
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Tag> Tags => Set<Tag>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var transactions = modelBuilder.Entity<BankTransaction>();
        transactions.Property(transaction => transaction.AccountNumber).HasMaxLength(64);
        transactions.Property(transaction => transaction.RawDescription).HasMaxLength(1024);
        transactions.Property(transaction => transaction.NormalizedDescription).HasMaxLength(1024);
        transactions.Property(transaction => transaction.MerchantKey).HasMaxLength(256);
        transactions.Property(transaction => transaction.Category).HasMaxLength(128);
        transactions.Property(transaction => transaction.SuggestedCategory).HasMaxLength(128);
        transactions.Property(transaction => transaction.SourceFingerprint).HasMaxLength(64);
        transactions.Property(transaction => transaction.SourceFileName).HasMaxLength(260);
        transactions.HasIndex(transaction => transaction.SourceFingerprint).IsUnique();
        transactions.HasIndex(transaction => new { transaction.BookingDate, transaction.Category });
        transactions.HasIndex(transaction => transaction.NeedsReview);

        var rules = modelBuilder.Entity<CategoryRule>();
        rules.Property(rule => rule.MerchantKey).HasMaxLength(256);
        rules.Property(rule => rule.Category).HasMaxLength(128);
        rules.Property(rule => rule.Behavior).HasConversion<string>().HasMaxLength(32);
        rules.HasIndex(rule => rule.MerchantKey).IsUnique();

        var cycleIncomeCategories = modelBuilder.Entity<CycleIncomeCategory>();
        cycleIncomeCategories.Property(category => category.Category).HasMaxLength(128);
        cycleIncomeCategories.HasIndex(category => category.Category).IsUnique();

        // Locations / Tags
        var locations = modelBuilder.Entity<Location>();
        locations.Property(l => l.Title).IsRequired().HasMaxLength(256);
        locations.Property(l => l.Url).HasMaxLength(2048);
        locations.Property(l => l.Description).HasMaxLength(2000);

        var tags = modelBuilder.Entity<Tag>();
        tags.Property(t => t.Name).IsRequired().HasMaxLength(128);
        tags.HasIndex(t => t.Name).IsUnique();

        // many-to-many join table
        modelBuilder.Entity<Location>()
            .HasMany(l => l.Tags)
            .WithMany(t => t.Locations)
            .UsingEntity<Dictionary<string, object>>(
                "LocationTag",
                j => j.HasOne<Tag>().WithMany().HasForeignKey("TagId").OnDelete(DeleteBehavior.Cascade),
                j => j.HasOne<Location>().WithMany().HasForeignKey("LocationId").OnDelete(DeleteBehavior.Cascade),
                j => j.HasKey("LocationId", "TagId")
            );
    }
}