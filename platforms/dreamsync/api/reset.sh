#!/bin/bash

# DreamSync API Reset Script
# This script resets the DreamSync API database using proper TypeORM commands

echo "🔄 Resetting DreamSync API..."

# Check if .env file exists
if [ ! -f "../../../.env" ]; then
    echo "❌ .env file not found at ../../../.env"
    echo "Please create a .env file with the required environment variables"
    exit 1
fi

# Load environment variables
source ../../../.env

# Check if database URL is set
if [ -z "$DREAMSYNC_DATABASE_URL" ]; then
    echo "❌ DREAMSYNC_DATABASE_URL not set in .env file"
    exit 1
fi

echo "🏗️  Generating migration from entities..."

# Generate migration from entities
npm run migration:generate

if [ $? -eq 0 ]; then
    echo "✅ Migration generated successfully"
else
    echo "❌ Migration generation failed"
    exit 1
fi

echo "🏗️  Running migrations..."

# Run migrations
npm run migration:run

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
else
    echo "❌ Migrations failed"
    exit 1
fi

echo "🎉 DreamSync API reset completed!"
echo "You can now start the server with: npm run dev"