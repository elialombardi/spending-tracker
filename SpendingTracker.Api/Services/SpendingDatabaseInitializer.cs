using System.Data;
using Microsoft.EntityFrameworkCore;
using SpendingTracker.Api.Data;

namespace SpendingTracker.Api.Services;

public sealed class SpendingDatabaseInitializer(SpendingDbContext dbContext)
{
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await dbContext.Database.EnsureCreatedAsync(cancellationToken);
        await EnsureCategoryRuleBehaviorColumnAsync(cancellationToken);
        await EnsureCycleIncomeCategoriesTableAsync(cancellationToken);
        await MarkIncomingTransactionsAsResolvedAsync(cancellationToken);
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
}