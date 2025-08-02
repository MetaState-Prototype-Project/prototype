#!/bin/bash

set -e # Exit on any error

# Go into psql and run SQL commands as postgres user
echo "[INFO] Resetting Postgres DB..."
psql <<EOF
DROP DATABASE IF EXISTS pic;
CREATE DATABASE pic;
EOF

# Run pnpm migration
echo "[INFO] Running migrations..."
pnpm migration:run

# Reset local folders
echo "[INFO] Cleaning local data folders..."
rm -rf ~/data/pic
rm -rf ~/data/blabsy

echo "[INFO] Recreating folders..."
mkdir -p ~/data/pic
mkdir -p ~/data/blabsy

echo "[INFO] Setting permissions..."
chmod -R 777 ~/data

echo "[DONE] All tasks completed successfully."
