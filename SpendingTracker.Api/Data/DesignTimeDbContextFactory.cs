using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SpendingTracker.Api.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<SpendingDbContext>
{
    public SpendingDbContext CreateDbContext(string[] args)
    {
        var builder = new DbContextOptionsBuilder<SpendingDbContext>();

        var dataDir = Path.Combine(Directory.GetCurrentDirectory(), "App_Data");
        Directory.CreateDirectory(dataDir);
        var dbPath = Path.Combine(dataDir, "spending-tracker.db");
        var conn = $"Data Source={dbPath}";
        builder.UseSqlite(conn);
        return new SpendingDbContext(builder.Options);
    }
}
