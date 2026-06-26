using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using SpendingTracker.Api.Data;

namespace SpendingTracker.Api.Services;

public sealed class SpendingDatabaseInitializer(SpendingDbContext dbContext)
{
    private const string InitialMigrationId = "20260616134357_AddLocationsAndTags";
    private const string ExcludeFromCalculationsMigrationId = "20260624040415_AddExcludeFromCalculations";
    private const string IsMonthlyRecurringMigrationId = "20260625080000_AddIsMonthlyRecurring";

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await BootstrapLegacyMigrationHistoryAsync(cancellationToken);
        await ReconcileTransactionSchemaAsync(cancellationToken);
        await dbContext.Database.MigrateAsync(cancellationToken);
        await EnsureCategoryRuleBehaviorColumnAsync(cancellationToken);
        await EnsureCycleIncomeCategoriesTableAsync(cancellationToken);
        await EnsureLocationsAndTagsSchemaAsync(cancellationToken);
        await EnsureInitialIndexesAsync(cancellationToken);
        await MarkIncomingTransactionsAsResolvedAsync(cancellationToken);
    }

    private async Task BootstrapLegacyMigrationHistoryAsync(CancellationToken cancellationToken)
    {
        var appliedMigrations = (await dbContext.Database.GetAppliedMigrationsAsync(cancellationToken)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (appliedMigrations.Count > 0)
        {
            return;
        }

        if (!await TableExistsAsync("Transactions", cancellationToken))
        {
            return;
        }

        await EnsureCategoryRuleBehaviorColumnAsync(cancellationToken);
        await EnsureCycleIncomeCategoriesTableAsync(cancellationToken);
        await EnsureLocationsAndTagsSchemaAsync(cancellationToken);
        await EnsureInitialIndexesAsync(cancellationToken);
        await EnsureMigrationHistoryTableAsync(cancellationToken);

        var productVersion = dbContext.Model.GetProductVersion() ?? "9.0.6";
        await InsertMigrationHistoryRowAsync(InitialMigrationId, productVersion, cancellationToken);

        if (await ColumnExistsAsync("Transactions", "ExcludeFromCalculations", cancellationToken))
        {
            await InsertMigrationHistoryRowAsync(ExcludeFromCalculationsMigrationId, productVersion, cancellationToken);
        }

        if (await ColumnExistsAsync("Transactions", "IsMonthlyRecurring", cancellationToken))
        {
            await InsertMigrationHistoryRowAsync(IsMonthlyRecurringMigrationId, productVersion, cancellationToken);
        }
    }

    private async Task ReconcileTransactionSchemaAsync(CancellationToken cancellationToken)
    {
        if (!await TableExistsAsync("Transactions", cancellationToken))
        {
            return;
        }

        var appliedMigrations = (await dbContext.Database.GetAppliedMigrationsAsync(cancellationToken)).ToHashSet(StringComparer.OrdinalIgnoreCase);

        await EnsureTransactionColumnForAppliedMigrationAsync(
            appliedMigrations,
            ExcludeFromCalculationsMigrationId,
            "ExcludeFromCalculations",
            cancellationToken);

        await EnsureTransactionColumnForAppliedMigrationAsync(
            appliedMigrations,
            IsMonthlyRecurringMigrationId,
            "IsMonthlyRecurring",
            cancellationToken);
    }

    private async Task EnsureCycleIncomeCategoriesTableAsync(CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "CycleIncomeCategories" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_CycleIncomeCategories" PRIMARY KEY,
                "Category" TEXT NOT NULL,
                "CreatedAtUtc" TEXT NOT NULL,
                "UpdatedAtUtc" TEXT NOT NULL
            );
            """,
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CycleIncomeCategories_Category"
            ON "CycleIncomeCategories" ("Category");
            """,
            cancellationToken);
    }

    private async Task EnsureLocationsAndTagsSchemaAsync(CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "Locations" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_Locations" PRIMARY KEY AUTOINCREMENT,
                "Title" TEXT NOT NULL,
                "Url" TEXT NULL,
                "Lat" REAL NOT NULL,
                "Lng" REAL NOT NULL,
                "Description" TEXT NULL
            );
            """,
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "Tags" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_Tags" PRIMARY KEY AUTOINCREMENT,
                "Name" TEXT NOT NULL
            );
            """,
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "LocationTag" (
                "LocationId" INTEGER NOT NULL,
                "TagId" INTEGER NOT NULL,
                CONSTRAINT "PK_LocationTag" PRIMARY KEY ("LocationId", "TagId"),
                CONSTRAINT "FK_LocationTag_Locations_LocationId" FOREIGN KEY ("LocationId") REFERENCES "Locations" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_LocationTag_Tags_TagId" FOREIGN KEY ("TagId") REFERENCES "Tags" ("Id") ON DELETE CASCADE
            );
            """,
            cancellationToken);
    }

    private async Task EnsureInitialIndexesAsync(CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_CategoryRules_MerchantKey\" ON \"CategoryRules\" (\"MerchantKey\");",
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_CycleIncomeCategories_Category\" ON \"CycleIncomeCategories\" (\"Category\");",
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            "CREATE INDEX IF NOT EXISTS \"IX_LocationTag_TagId\" ON \"LocationTag\" (\"TagId\");",
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Tags_Name\" ON \"Tags\" (\"Name\");",
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            "CREATE INDEX IF NOT EXISTS \"IX_Transactions_BookingDate_Category\" ON \"Transactions\" (\"BookingDate\", \"Category\");",
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            "CREATE INDEX IF NOT EXISTS \"IX_Transactions_NeedsReview\" ON \"Transactions\" (\"NeedsReview\");",
            cancellationToken);

        await dbContext.Database.ExecuteSqlRawAsync(
            "CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Transactions_SourceFingerprint\" ON \"Transactions\" (\"SourceFingerprint\");",
            cancellationToken);
    }

    private async Task MarkIncomingTransactionsAsResolvedAsync(CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            """
            UPDATE "Transactions"
            SET "NeedsReview" = 0,
                "SuggestedCategory" = NULL,
                "SuggestionConfidence" = NULL
            WHERE "Amount" > 0 AND "NeedsReview" = 1;
            """,
            cancellationToken);
    }

    private async Task EnsureCategoryRuleBehaviorColumnAsync(CancellationToken cancellationToken)
    {
        var connection = dbContext.Database.GetDbConnection();
        var shouldCloseConnection = connection.State != ConnectionState.Open;

        if (shouldCloseConnection)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA table_info('CategoryRules');";

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            var hasBehaviorColumn = false;
            while (await reader.ReadAsync(cancellationToken))
            {
                if (string.Equals(reader.GetString(1), "Behavior", StringComparison.OrdinalIgnoreCase))
                {
                    hasBehaviorColumn = true;
                    break;
                }
            }

            await reader.DisposeAsync();

            if (!hasBehaviorColumn)
            {
                await dbContext.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"CategoryRules\" ADD COLUMN \"Behavior\" TEXT NOT NULL DEFAULT 'AutoApply';",
                    cancellationToken);
            }
        }
        finally
        {
            if (shouldCloseConnection)
            {
                await connection.CloseAsync();
            }
        }
    }

    private async Task EnsureMigrationHistoryTableAsync(CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
                "MigrationId" TEXT NOT NULL CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY,
                "ProductVersion" TEXT NOT NULL
            );
            """,
            cancellationToken);
    }

    private async Task EnsureTransactionColumnForAppliedMigrationAsync(
        HashSet<string> appliedMigrations,
        string migrationId,
        string columnName,
        CancellationToken cancellationToken)
    {
        if (!appliedMigrations.Contains(migrationId) || await ColumnExistsAsync("Transactions", columnName, cancellationToken))
        {
            return;
        }

        var sql = columnName switch
        {
            "ExcludeFromCalculations" => "ALTER TABLE \"Transactions\" ADD COLUMN \"ExcludeFromCalculations\" INTEGER NOT NULL DEFAULT 0;",
            "IsMonthlyRecurring" => "ALTER TABLE \"Transactions\" ADD COLUMN \"IsMonthlyRecurring\" INTEGER NOT NULL DEFAULT 0;",
            _ => throw new InvalidOperationException($"Unsupported Transactions column: {columnName}")
        };

        await dbContext.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }

    private async Task InsertMigrationHistoryRowAsync(
        string migrationId,
        string productVersion,
        CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            SELECT {migrationId}, {productVersion}
            WHERE NOT EXISTS (
                SELECT 1
                FROM "__EFMigrationsHistory"
                WHERE "MigrationId" = {migrationId}
            );
            """,
            cancellationToken);
    }

    private async Task<bool> TableExistsAsync(string tableName, CancellationToken cancellationToken)
    {
        var connection = dbContext.Database.GetDbConnection();
        var shouldCloseConnection = connection.State != ConnectionState.Open;

        if (shouldCloseConnection)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = $tableName LIMIT 1;";

            var parameter = command.CreateParameter();
            parameter.ParameterName = "$tableName";
            parameter.Value = tableName;
            command.Parameters.Add(parameter);

            var result = await command.ExecuteScalarAsync(cancellationToken);
            return result is not null;
        }
        finally
        {
            if (shouldCloseConnection)
            {
                await connection.CloseAsync();
            }
        }
    }

    private async Task<bool> ColumnExistsAsync(string tableName, string columnName, CancellationToken cancellationToken)
    {
        var connection = dbContext.Database.GetDbConnection();
        var shouldCloseConnection = connection.State != ConnectionState.Open;

        if (shouldCloseConnection)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"PRAGMA table_info(\"{tableName}\");";

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }
        finally
        {
            if (shouldCloseConnection)
            {
                await connection.CloseAsync();
            }
        }
    }
}