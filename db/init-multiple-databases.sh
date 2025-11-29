#!/bin/bash
set -e

# Get the list of databases from environment variable
# Default to empty if not set
POSTGRES_MULTIPLE_DATABASES=${POSTGRES_MULTIPLE_DATABASES:-}

# If no databases specified, exit
if [ -z "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "No databases specified in POSTGRES_MULTIPLE_DATABASES"
    exit 0
fi

echo "Creating multiple databases..."

# Split the comma-separated list and create each database
IFS=',' read -ra DATABASES <<< "$POSTGRES_MULTIPLE_DATABASES"
for db in "${DATABASES[@]}"; do
    # Trim whitespace
    db=$(echo "$db" | xargs)

    if [ -n "$db" ]; then
        # Check if database exists
        DB_EXISTS=$(psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>/dev/null || echo "")

        if [ "$DB_EXISTS" = "1" ]; then
            echo "Database $db already exists, skipping..."
        else
            echo "Creating database: $db"
            # Create the database directly (not inside a function)
            psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
                CREATE DATABASE "$db";
EOSQL
        fi
    fi
done

echo "Multiple databases created successfully!"

