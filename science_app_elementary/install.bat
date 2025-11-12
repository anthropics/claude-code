@echo off
REM اسکریپت نصب برای ویندوز
REM Windows Installation Script for Science Education App

echo ╔══════════════════════════════════════════════════════════╗
echo ║     Science Education App - Installation Script         ║
echo ║         نصب برنامه آموزش علوم تجربی                      ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM Check Python version
echo Checking Python version...
python --version

if %errorlevel% neq 0 (
    echo ✗ Python is not installed!
    echo Please install Python 3.7 or higher from python.org
    pause
    exit /b 1
)

echo ✓ Python is installed
echo.

REM Create virtual environment
echo Creating virtual environment...
python -m venv venv

if %errorlevel% neq 0 (
    echo ✗ Failed to create virtual environment
    pause
    exit /b 1
)

echo ✓ Virtual environment created
echo.

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo ✗ Failed to install dependencies
    pause
    exit /b 1
)

echo ✓ All dependencies installed
echo.

REM Create necessary directories
echo Creating necessary directories...
if not exist assets\videos mkdir assets\videos
if not exist assets\images mkdir assets\images
if not exist assets\sounds mkdir assets\sounds
if not exist assets\fonts mkdir assets\fonts
if not exist content mkdir content

echo ✓ Directories created
echo.

REM Success message
echo ╔══════════════════════════════════════════════════════════╗
echo ║                  Installation Complete!                  ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Next steps:
echo 1. Activate virtual environment: venv\Scripts\activate.bat
echo 2. Add video files to assets\videos\
echo 3. Run the application: python main.py
echo.
echo For PDF content extraction:
echo   python extract_pdf_content.py
echo.
echo For documentation, see:
echo   - README_FA.md (Persian)
echo   - README.md (English)
echo   - HOW_TO_ADD_PDF_CONTENT.md
echo.
echo Happy teaching! 🎓
echo.
pause
