#!/bin/bash
set -e

# --- Configuration ---
# Change this to your remote server's IP address
export GATEWAY_HOST=${GATEWAY_HOST:-"192.168.1.50"} 
PROXY_PORT=5174
VITE_PORT=5173

# Get the directory where this script is located
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Cleanup function to kill background processes on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down dev services..."
  kill $PROXY_PID $VITE_PID 2>/dev/null || true
  exit 0
}

# Trap interruption signals (Ctrl+C, termination, etc.)
trap cleanup EXIT INT TERM

echo "Starting Remote Backend Bridge..."
echo "🔗 Gateway: $GATEWAY_HOST"

# 1. Start the Proxy (Background)
# Explicitly using node to run the proxy script
node dev-proxy.mjs &
PROXY_PID=$!

# 2. Start Vite (Background)
# We point Vite's API base to our local proxy port
echo "🚀 Starting Vite on port $VITE_PORT..."
VITE_API_BASE=http://localhost:$PROXY_PORT npx vite --host 0.0.0.0 --port $VITE_PORT &
VITE_PID=$!

# Wait for processes to finish (POSIX compliant for macOS/Linux)
wait $PROXY_PID $VITE_PID