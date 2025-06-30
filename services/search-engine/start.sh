#!/bin/bash

# Search Engine Service Startup Script

echo "🚀 Starting Search Engine Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Set default environment variables if not set
export PORT=${PORT:-3002}
export REGISTRY_URL=${REGISTRY_URL:-http://localhost:4321}
export EVAULT_BASE_URL=${EVAULT_BASE_URL:-http://localhost:4000}

echo "🔧 Configuration:"
echo "   Port: $PORT"
echo "   Registry URL: $REGISTRY_URL"
echo "   eVault URL: $EVAULT_BASE_URL"
echo ""

# Start the service
echo "🌟 Starting service..."
npm start 