#!/bin/bash
# Apex Gloves International - start both backend and frontend.
set -e

# Start backend server in background
cd "$(dirname "$0")/backend"
npm run dev &
BACKEND_PID=$!

# Start frontend server (exposed port for preview)
cd "$(dirname "$0")/frontend"
npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
