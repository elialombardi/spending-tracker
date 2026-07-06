using System.IO;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SpendingTracker.Api.Authentication;
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

var authOptions = builder.Configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>() ?? new AuthOptions();
AuthOptionsValidator.Validate(authOptions);

builder.Services.AddSingleton(authOptions);
builder.Services.AddSingleton<AuthTokenService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = authOptions.Issuer,
            ValidAudience = authOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authOptions.SigningKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = options.DefaultPolicy;
    options.AddPolicy(AuthPolicies.ApiWriter, policy => policy.RequireRole(AuthRoles.Writer, AuthRoles.Admin));
});

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

// Allow overriding the DB file via environment variable inside containers
var envDbPath = Environment.GetEnvironmentVariable("SPENDING_TRACKER_DB");
var configuredConnectionString = !string.IsNullOrEmpty(envDbPath)
    ? $"Data Source={envDbPath}"
    : builder.Configuration.GetConnectionString("SpendingTracker")
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
    app.MapOpenApi().AllowAnonymous();
}

if (app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

// Enable CORS
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

// Static UI serving removed — API-only application
app.MapControllers();

app.Run();
