#!/bin/sh
set -e

# Create parent directory first - this is critical for SQLite
# The parent directory MUST exist before creating subdirectories
mkdir -p /app/data
mkdir -p /app/data/mapping-dbs

# Create SQLite mapping database directories if they don't exist
# This ensures directories exist even when volumes are mounted
mkdir -p /app/data/mapping-dbs/pictique
mkdir -p /app/data/mapping-dbs/evoting
mkdir -p /app/data/mapping-dbs/dreamsync
mkdir -p /app/data/mapping-dbs/cerberus
mkdir -p /app/data/mapping-dbs/group-charter
mkdir -p /app/data/mapping-dbs/blabsy

# Ensure proper permissions (read/write/execute for owner and group)
chmod -R 755 /app/data/mapping-dbs 2>/dev/null || true

# Execute the command passed to the entrypoint
exec "$@"

