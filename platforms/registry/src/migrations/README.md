# Database Migrations

This directory contains database migrations for the registry service. Migrations are used to track and apply database schema changes.

## Available Commands

-   Generate a new migration based on entity changes:

    ```bash
    npm run migration:generate src/migrations/MigrationName
    ```

-   Create an empty migration file:

    ```bash
    npm run migration:create src/migrations/MigrationName
    ```

-   Run pending migrations:

    ```bash
    npm run migration:run
    ```

-   Revert the last migration:
    ```bash
    npm run migration:revert
    ```

## Migration Naming Convention

Please follow this naming convention for migration files:

-   Use PascalCase for migration names
-   Include a timestamp prefix (automatically added by TypeORM)
-   Example: `1234567890-CreateVaultTable.ts`

## Best Practices

1. Always review generated migrations before running them
2. Test migrations in development before applying to production
3. Keep migrations small and focused on specific changes
4. Never modify existing migrations that have been committed
5. Always backup your database before running migrations in production
