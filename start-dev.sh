#!/bin/bash

# Claude Code Extended - Development Server Startup Script
# This script starts the backend server for testing with mobile apps

echo "🚀 Starting Claude Code Extended Development Server"
echo "================================================"

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

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Claude Code Extended Environment Variables
CLAUDE_PORT=3000
CLAUDE_HOST=0.0.0.0
CLAUDE_JWT_SECRET=dev-secret-key-change-in-production
CLAUDE_SESSION_TIMEOUT=86400000
CLAUDE_DB_PATH=./data/claude-code.db
TAILSCALE_ENABLED=false
NODE_ENV=development
EOF
    echo "✅ .env file created with default values"
fi

# Create data directory if it doesn't exist
mkdir -p data

# Get local IP address for mobile testing
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
else
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

echo ""
echo "📱 Mobile App Connection Info:"
echo "-------------------------------"
echo "Server URL: http://$LOCAL_IP:3000"
echo "WebSocket URL: ws://$LOCAL_IP:3000/ws"
echo ""
echo "Use these URLs in your mobile app settings to connect."
echo ""
echo "🔐 Default Credentials:"
echo "Username: admin"
echo "Password: admin123"
echo ""
echo "⚠️  Note: This is for development only. Use proper authentication in production."
echo ""

# Start the development server
echo "🚀 Starting server in development mode..."
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev