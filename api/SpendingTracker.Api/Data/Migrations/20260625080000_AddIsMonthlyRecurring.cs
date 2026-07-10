using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SpendingTracker.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIsMonthlyRecurring : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsMonthlyRecurring",
                table: "Transactions",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsMonthlyRecurring",
                table: "Transactions");
        }
    }
}
