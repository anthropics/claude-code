# CCTTB Bot Setup Script for Windows
# Run this script in PowerShell as Administrator

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "CCTTB Trading Bot - Setup Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator. Some features may fail." -ForegroundColor Yellow
    Write-Host "To run as admin: Right-click PowerShell -> Run as Administrator" -ForegroundColor Yellow
    Write-Host ""
}

# Step 1: Check Git Installation
Write-Host "[1/6] Checking Git installation..." -ForegroundColor Green
$gitVersion = git --version 2>$null
if ($gitVersion) {
    Write-Host "  ✅ Git is installed: $gitVersion" -ForegroundColor Green
} else {
    Write-Host "  ❌ Git not found! Please install Git first:" -ForegroundColor Red
    Write-Host "     Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Step 2: Check Google Cloud SDK
Write-Host ""
Write-Host "[2/6] Checking Google Cloud SDK..." -ForegroundColor Green
$gcloudVersion = gcloud --version 2>$null
if ($gcloudVersion) {
    Write-Host "  ✅ Google Cloud SDK is installed" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Google Cloud SDK not found (optional)" -ForegroundColor Yellow
    Write-Host "     Download from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
}

# Step 3: Create credential directories
Write-Host ""
Write-Host "[3/6] Creating credential directories..." -ForegroundColor Green

$credentialPaths = @(
    "$env:USERPROFILE\Documents\cAlgo\ServiceAccount",
    "C:\cAlgo\ServiceAccount",
    "$PSScriptRoot"
)

foreach ($path in $credentialPaths) {
    if (Test-Path $path) {
        Write-Host "  ✅ Directory exists: $path" -ForegroundColor Green
    } else {
        try {
            New-Item -Path $path -ItemType Directory -Force | Out-Null
            Write-Host "  ✅ Created directory: $path" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  Could not create: $path" -ForegroundColor Yellow
        }
    }
}

# Step 4: Check for credentials file
Write-Host ""
Write-Host "[4/6] Checking for service account credentials..." -ForegroundColor Green

$credFound = $false
$credLocations = @(
    "$env:USERPROFILE\Documents\cAlgo\ServiceAccount\credentials.json",
    "C:\cAlgo\ServiceAccount\credentials.json",
    "$PSScriptRoot\credentials.json",
    "C:\ccttb-credentials\ccttb-bot-key.json"
)

foreach ($loc in $credLocations) {
    if (Test-Path $loc) {
        Write-Host "  ✅ Found credentials at: $loc" -ForegroundColor Green
        $credFound = $true

        # Offer to copy to standard location
        $standardPath = "$env:USERPROFILE\Documents\cAlgo\ServiceAccount\credentials.json"
        if ($loc -ne $standardPath -and -not (Test-Path $standardPath)) {
            $copy = Read-Host "  Copy to standard location? (Y/N)"
            if ($copy -eq "Y" -or $copy -eq "y") {
                Copy-Item $loc $standardPath -Force
                Write-Host "  ✅ Copied to: $standardPath" -ForegroundColor Green
            }
        }
        break
    }
}

if (-not $credFound) {
    Write-Host "  ❌ No credentials file found!" -ForegroundColor Red
    Write-Host "  📋 Please place your ccttb-bot-key.json file in one of these locations:" -ForegroundColor Yellow
    foreach ($loc in $credLocations) {
        Write-Host "     - $loc" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  Or set environment variable:" -ForegroundColor Yellow
    Write-Host "     `$env:CCTTB_SERVICE_ACCOUNT_PATH = 'C:\path\to\your\credentials.json'" -ForegroundColor Cyan
}

# Step 5: Set environment variable (optional)
Write-Host ""
Write-Host "[5/6] Environment variable configuration..." -ForegroundColor Green

if ($credFound) {
    $setEnv = Read-Host "Set CCTTB_SERVICE_ACCOUNT_PATH environment variable? (Y/N)"
    if ($setEnv -eq "Y" -or $setEnv -eq "y") {
        $credPath = $credLocations | Where-Object { Test-Path $_ } | Select-Object -First 1
        [System.Environment]::SetEnvironmentVariable("CCTTB_SERVICE_ACCOUNT_PATH", $credPath, [System.EnvironmentVariableTarget]::User)
        Write-Host "  ✅ Environment variable set to: $credPath" -ForegroundColor Green
    }
}

# Step 6: Authenticate with Google Cloud
Write-Host ""
Write-Host "[6/6] Google Cloud Authentication..." -ForegroundColor Green

if ($credFound -and $gcloudVersion) {
    $credPath = $credLocations | Where-Object { Test-Path $_ } | Select-Object -First 1
    $auth = Read-Host "Authenticate with Google Cloud now? (Y/N)"
    if ($auth -eq "Y" -or $auth -eq "y") {
        Write-Host "  Activating service account..." -ForegroundColor Cyan
        gcloud auth activate-service-account --key-file="$credPath"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Authentication successful!" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Authentication failed. Check your credentials file." -ForegroundColor Red
        }
    }
}

# Summary
Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Credential directories created" -ForegroundColor Green
if ($credFound) {
    Write-Host "✅ Service account credentials found" -ForegroundColor Green
} else {
    Write-Host "⚠️  Service account credentials NOT found - please add them!" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "📖 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Build the bot in cTrader (or run: dotnet build)" -ForegroundColor White
Write-Host "2. Load the bot on a chart (EURUSD M5 or XAUUSD M1)" -ForegroundColor White
Write-Host "3. Check logs for: [Gemini] ✅ Found credentials at..." -ForegroundColor White
Write-Host ""
Write-Host "📚 For detailed documentation, see: ALL_FIXES_SUMMARY_NOV20.md" -ForegroundColor Cyan
Write-Host ""
