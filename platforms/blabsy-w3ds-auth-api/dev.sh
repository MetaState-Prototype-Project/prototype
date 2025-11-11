#!/bin/sh
set -e

# Initial build
pnpm build

# Start TypeScript compiler in watch mode in background
tsc --watch &
TSC_PID=$!

# Start nodemon watching dist
nodemon --watch dist dist/index.js &
NODEMON_PID=$!

# Trap signals to kill background processes
trap 'kill $TSC_PID $NODEMON_PID 2>/dev/null; exit' INT TERM

# Wait for either process to exit
wait $TSC_PID $NODEMON_PID

