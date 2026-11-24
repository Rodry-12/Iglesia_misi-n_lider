START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId" = '20261024044431_ExplicitOperatorPermissions') THEN
    CREATE TABLE auth_app.user_grant_permissions (
        access_grant_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        CONSTRAINT "PK_user_grant_permissions" PRIMARY KEY (access_grant_id, permission_id),
        CONSTRAINT "FK_user_grant_permissions_user_access_grants_access_grant_id" FOREIGN KEY (access_grant_id) REFERENCES auth_app.user_access_grants (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId" = '20261024044431_ExplicitOperatorPermissions') THEN
    CREATE INDEX "IX_user_grant_permissions_permission_id" ON auth_app.user_grant_permissions (permission_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId" = '20261024044431_ExplicitOperatorPermissions') THEN
    INSERT INTO auth_app.__ef_migrations_history ("MigrationId", "ProductVersion")
    VALUES ('20261024044431_ExplicitOperatorPermissions', '10.0.13');
    END IF;
END $EF$;
COMMIT;

