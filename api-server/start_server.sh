#!/bin/bash
# Quick start script for Claude Code API Server

set -e

echo "Claude Code API Server - Quick Start"
echo "====================================="
echo

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo
    echo "⚠️  IMPORTANT: Please edit .env and set your configuration!"
    echo "   Especially: CLAUDE_API_KEY, DEFAULT_WORKING_DIR"
    echo
    read -p "Press Enter to continue or Ctrl+C to exit and edit .env first..."
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
    echo
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "✓ Dependencies installed"
echo

# Load environment variables
echo "Loading configuration from .env..."
export $(cat .env | grep -v '^#' | xargs)
echo "✓ Configuration loaded"
echo

# Check Claude Code availability
echo "Checking Claude Code CLI..."
if command -v "${CLAUDE_CODE_PATH:-claude}" &> /dev/null; then
    echo "✓ Claude Code found at: $(command -v ${CLAUDE_CODE_PATH:-claude})"
else
    echo "⚠️  Claude Code not found. Please ensure it's installed and in PATH."
    echo "   Or set CLAUDE_CODE_PATH in .env to the correct location."
fi
echo

# Start server
echo "Starting API server..."
echo "Server will be available at: http://${HOST:-0.0.0.0}:${PORT:-8000}"
echo "API Documentation: http://${HOST:-0.0.0.0}:${PORT:-8000}/docs"
echo
echo "Press Ctrl+C to stop the server"
echo
python server.py
