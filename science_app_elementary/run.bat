@echo off
REM اسکریپت اجرای برنامه برای ویندوز
REM Windows Run Script for Science Education App

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║        Science Education App - Elementary Grade 3        ║
echo ║              برنامه آموزش علوم پایه سوم                  ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Starting application...
echo.

REM Check if virtual environment exists
if not exist venv (
    echo ✗ Virtual environment not found!
    echo Please run install.bat first
    pause
    exit /b 1
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Run the application
python main.py

REM Deactivate when done
deactivate

pause
