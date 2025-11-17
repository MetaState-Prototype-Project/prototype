#!/bin/sh
set -e

# For pnpm workspaces, dependencies need to be installed at the root
# Check if dependencies are actually installed by looking for actual binaries
# Check for ts-node which is needed by most services
LOCK_FILE="/app/node_modules/.install-lock"
MAX_WAIT=300  # 5 minutes max wait

if [ ! -f "/app/node_modules/.bin/ts-node" ] && [ ! -f "/app/platforms/registry/node_modules/.bin/ts-node" ]; then
    # Try to acquire lock - wait if another container is installing
    WAIT_TIME=0
    while [ -f "$LOCK_FILE" ] && [ $WAIT_TIME -lt $MAX_WAIT ]; do
        echo "⏳ Waiting for another container to finish installing dependencies..."
        sleep 5
        WAIT_TIME=$((WAIT_TIME + 5))
        # Re-check if install completed while waiting
        if [ -f "/app/node_modules/.bin/ts-node" ]; then
            echo "✅ Dependencies installed by another container"
            exec "$@"
        fi
    done
    
    if [ $WAIT_TIME -ge $MAX_WAIT ]; then
        echo "❌ Timeout waiting for dependency installation"
        exit 1
    fi
    
    # Create lock file
    touch "$LOCK_FILE"
    
    echo "⚠️  Installing workspace dependencies at root (first run only)..."
    cd /app
    if pnpm install --frozen-lockfile; then
        echo "✅ Dependencies installed"
    else
        echo "❌ Failed to install dependencies"
        rm -f "$LOCK_FILE"
        exit 1
    fi
    
    # Remove lock file
    rm -f "$LOCK_FILE"
else
    echo "✅ Dependencies already installed"
fi

# Run the command passed to the container
# The working_dir is set by docker-compose, so $PWD should already be correct
# But we ensure we're in the right place by letting docker-compose handle it
exec "$@"

