using System.Text.Json.Serialization;
using System.IO;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SpendingTracker.Api.Data;
using SpendingTracker.Api.Services;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    WebRootPath = Directory.GetCurrentDirectory()
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddOpenApi();

// CORS: allow cross-origin requests for API clients (adjust policy as needed)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var configuredConnectionString = builder.Configuration.GetConnectionString("SpendingTracker")
    ?? "Data Source=App_Data/spending-tracker.db";
var sqliteConnectionBuilder = new SqliteConnectionStringBuilder(configuredConnectionString);

if (!Path.IsPathRooted(sqliteConnectionBuilder.DataSource))
{
    sqliteConnectionBuilder.DataSource = Path.Combine(builder.Environment.ContentRootPath, sqliteConnectionBuilder.DataSource);
}

var databaseDirectory = Path.GetDirectoryName(sqliteConnectionBuilder.DataSource);
if (!string.IsNullOrWhiteSpace(databaseDirectory))
{
    Directory.CreateDirectory(databaseDirectory);
}

builder.Services.AddDbContext<SpendingDbContext>(options =>
{
    options.UseSqlite(sqliteConnectionBuilder.ConnectionString);
});
builder.Services.AddScoped<PosteItalianeWorkbookParser>();
builder.Services.AddScoped<SpendingDatabaseInitializer>();
builder.Services.AddScoped<SpendingReportService>();
builder.Services.AddScoped<TransactionImportService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var databaseInitializer = scope.ServiceProvider.GetRequiredService<SpendingDatabaseInitializer>();
    await databaseInitializer.InitializeAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

// Enable CORS
app.UseCors("AllowAll");

// Static UI serving removed — API-only application
app.MapControllers();

app.Run();
