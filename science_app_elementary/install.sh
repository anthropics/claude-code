#!/bin/bash
# اسکریپت نصب و راه‌اندازی برنامه
# Installation script for Science Education App

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Science Education App - Installation Script         ║"
echo "║         نصب برنامه آموزش علوم تجربی                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check Python version
echo "Checking Python version..."
python3 --version

if [ $? -ne 0 ]; then
    echo "✗ Python 3 is not installed!"
    echo "Please install Python 3.7 or higher from python.org"
    exit 1
fi

echo "✓ Python is installed"
echo ""

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv

if [ $? -ne 0 ]; then
    echo "✗ Failed to create virtual environment"
    exit 1
fi

echo "✓ Virtual environment created"
echo ""

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "✗ Failed to install dependencies"
    exit 1
fi

echo "✓ All dependencies installed"
echo ""

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p assets/videos
mkdir -p assets/images
mkdir -p assets/sounds
mkdir -p assets/fonts
mkdir -p content

echo "✓ Directories created"
echo ""

# Success message
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  Installation Complete!                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Add video files to assets/videos/"
echo "3. Run the application: python main.py"
echo ""
echo "For PDF content extraction:"
echo "  python extract_pdf_content.py"
echo ""
echo "For documentation, see:"
echo "  - README_FA.md (Persian)"
echo "  - README.md (English)"
echo "  - HOW_TO_ADD_PDF_CONTENT.md"
echo ""
echo "Happy teaching! 🎓"
