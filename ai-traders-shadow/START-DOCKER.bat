@echo off
REM AI Trader's Shadow - Docker Quick Start Script for Windows
REM This script starts the entire application with one double-click

echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║                                                                  ║
echo ║         🐳 AI TRADER'S SHADOW - DOCKER DEPLOYMENT 🐳             ║
echo ║                                                                  ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.

REM Check if Docker is running
echo [1/4] Checking Docker...
docker version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running!
    echo.
    echo Please start Docker Desktop first:
    echo   1. Open Docker Desktop from Start Menu
    echo   2. Wait for Docker to start ^(green icon in system tray^)
    echo   3. Run this script again
    echo.
    pause
    exit /b 1
)
echo ✅ Docker is running

REM Check if docker-compose file exists
echo.
echo [2/4] Checking docker-compose file...
if not exist "docker-compose.local.yml" (
    echo ❌ docker-compose.local.yml not found!
    echo.
    echo Please make sure you're in the ai-traders-shadow directory
    echo.
    pause
    exit /b 1
)
echo ✅ docker-compose.local.yml found

REM Stop any existing containers
echo.
echo [3/4] Stopping existing containers...
docker-compose -f docker-compose.local.yml down >nul 2>&1
echo ✅ Cleaned up existing containers

REM Start services
echo.
echo [4/4] Starting services...
echo.
echo This will take a few minutes the first time ^(downloading images^)
echo Please wait...
echo.

docker-compose -f docker-compose.local.yml up --build

REM If user pressed Ctrl+C
echo.
echo ════════════════════════════════════════════════════════════════════
echo Services stopped.
echo.
echo To start again, run: START-DOCKER.bat
echo To stop services: docker-compose -f docker-compose.local.yml down
echo ════════════════════════════════════════════════════════════════════
echo.
pause
