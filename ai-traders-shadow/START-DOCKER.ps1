# AI Trader's Shadow - Docker Quick Start Script for Windows (PowerShell)
# This script starts the entire application with one command

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                                  ║" -ForegroundColor Cyan
Write-Host "║         🐳 AI TRADER'S SHADOW - DOCKER DEPLOYMENT 🐳             ║" -ForegroundColor Cyan
Write-Host "║                                                                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "[1/5] Checking Docker..." -ForegroundColor Yellow
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker Desktop first:" -ForegroundColor Yellow
    Write-Host "  1. Open Docker Desktop from Start Menu"
    Write-Host "  2. Wait for Docker to start (green icon in system tray)"
    Write-Host "  3. Run this script again"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if docker-compose file exists
Write-Host ""
Write-Host "[2/5] Checking docker-compose file..." -ForegroundColor Yellow
if (-Not (Test-Path "docker-compose.local.yml")) {
    Write-Host "❌ docker-compose.local.yml not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please make sure you're in the ai-traders-shadow directory" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ docker-compose.local.yml found" -ForegroundColor Green

# Check if database is setup
Write-Host ""
Write-Host "[3/5] Checking database setup..." -ForegroundColor Yellow
if (-Not (Test-Path "setup_database.py")) {
    Write-Host "⚠️  setup_database.py not found" -ForegroundColor Yellow
} else {
    Write-Host "✅ Database setup script found" -ForegroundColor Green
    Write-Host ""
    $setupDb = Read-Host "Do you want to setup database now? (y/n)"
    if ($setupDb -eq "y" -or $setupDb -eq "Y") {
        Write-Host "Setting up database..." -ForegroundColor Yellow
        python setup_database.py
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database setup complete" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Database setup failed, but continuing..." -ForegroundColor Yellow
        }
    }
}

# Stop any existing containers
Write-Host ""
Write-Host "[4/5] Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.local.yml down 2>&1 | Out-Null
Write-Host "✅ Cleaned up existing containers" -ForegroundColor Green

# Start services
Write-Host ""
Write-Host "[5/5] Starting services..." -ForegroundColor Yellow
Write-Host ""
Write-Host "This will take a few minutes the first time (downloading images)" -ForegroundColor Cyan
Write-Host "Please wait..." -ForegroundColor Cyan
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Once started, access your application at:" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend:   http://localhost:8000" -ForegroundColor Cyan
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop services" -ForegroundColor Yellow
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

docker-compose -f docker-compose.local.yml up --build

# If user pressed Ctrl+C
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Services stopped." -ForegroundColor Yellow
Write-Host ""
Write-Host "To start again:   .\START-DOCKER.ps1" -ForegroundColor Cyan
Write-Host "To stop services: docker-compose -f docker-compose.local.yml down" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
