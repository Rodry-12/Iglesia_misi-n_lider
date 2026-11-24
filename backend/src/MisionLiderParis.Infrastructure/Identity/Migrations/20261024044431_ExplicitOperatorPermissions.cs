using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MisionLiderParis.Infrastructure.Identity.Migrations
{
    /// <inheritdoc />
    public partial class ExplicitOperatorPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_grant_permissions",
                schema: "auth_app",
                columns: table => new
                {
                    access_grant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    permission_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_grant_permissions", x => new { x.access_grant_id, x.permission_id });
                    table.ForeignKey(
                        name: "FK_user_grant_permissions_user_access_grants_access_grant_id",
                        column: x => x.access_grant_id,
                        principalSchema: "auth_app",
                        principalTable: "user_access_grants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_grant_permissions_permission_id",
                schema: "auth_app",
                table: "user_grant_permissions",
                column: "permission_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_grant_permissions",
                schema: "auth_app");
        }
    }
}
