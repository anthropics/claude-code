#!/bin/bash
# اسکریپت اجرای برنامه
# Run Script for Science Education App

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        Science Education App - Elementary Grade 3        ║"
echo "║              برنامه آموزش علوم پایه سوم                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Starting application..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "✗ Virtual environment not found!"
    echo "Please run install.sh first"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Run the application
python main.py

# Deactivate when done
deactivate
