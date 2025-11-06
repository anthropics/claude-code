# Phase 2 Data Collection - Progress Checker
# Monitors learning data accumulation during data collection phase

$historyPath = "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\learning\history.json"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 2 Data Collection Progress" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-Not (Test-Path $historyPath)) {
    Write-Host "ERROR: history.json not found at: $historyPath" -ForegroundColor Red
    exit 1
}

$history = Get-Content $historyPath | ConvertFrom-Json

# Current Status
Write-Host "CURRENT STATUS:" -ForegroundColor Yellow
$totalSwings = $history.SwingStats.TotalSwings
$successfulOTEs = $history.SwingStats.SuccessfulOTEs
$successRate = [math]::Round($history.SwingStats.AverageOTESuccessRate * 100, 1)
$lastUpdated = $history.LastUpdated

Write-Host "  Total Swings:      $totalSwings"
Write-Host "  Successful OTEs:   $successfulOTEs"
Write-Host "  Success Rate:      $successRate%"
Write-Host "  Last Updated:      $lastUpdated"
Write-Host ""

# Progress to Target
Write-Host "PROGRESS TO TARGET:" -ForegroundColor Yellow
$targetSwings = 500
$targetSuccessRate = 45.0
$remainingSwings = $targetSwings - $totalSwings
$progressPercent = [math]::Round(($totalSwings / $targetSwings) * 100, 1)

Write-Host "  Target Swings:     $targetSwings"
Write-Host "  Current:           $totalSwings / $targetSwings ($progressPercent%)"
Write-Host "  Remaining:         $remainingSwings swings"

if ($remainingSwings -gt 0) {
    $estimatedBacktests = [math]::Ceiling($remainingSwings / 50)
    Write-Host "  Estimated Tests:   $estimatedBacktests more backtests needed (50 swings/test avg)" -ForegroundColor Yellow
} else {
    Write-Host "  Status:            TARGET REACHED!" -ForegroundColor Green
}
Write-Host ""

# Success Rate Check
Write-Host "SUCCESS RATE CHECK:" -ForegroundColor Yellow
Write-Host "  Current:           $successRate%"
Write-Host "  Target:            $targetSuccessRate%+"
if ($successRate -ge $targetSuccessRate) {
    Write-Host "  Status:            SUCCESS RATE NORMALIZED" -ForegroundColor Green
} elseif ($successRate -ge 25) {
    Write-Host "  Status:            Improving (25%+) - Continue data collection" -ForegroundColor Yellow
} elseif ($successRate -ge 15) {
    Write-Host "  Status:            Low (15-25%) - Need more data" -ForegroundColor Yellow
} else {
    Write-Host "  Status:            Very Low (<15%) - Need significantly more data" -ForegroundColor Red
}
Write-Host ""

# Session Breakdown
Write-Host "SESSION BREAKDOWN:" -ForegroundColor Yellow
$sessions = $history.SwingStats.SuccessRateBySession
foreach ($session in $sessions.PSObject.Properties) {
    $sessionName = $session.Name
    $sessionRate = [math]::Round($session.Value * 100, 1)
    $color = if ($sessionRate -ge 40) { "Green" } elseif ($sessionRate -ge 20) { "Yellow" } else { "Red" }
    Write-Host "  $($sessionName):".PadRight(15) "$sessionRate%" -ForegroundColor $color
}
Write-Host ""

# Direction Breakdown
Write-Host "DIRECTION BREAKDOWN:" -ForegroundColor Yellow
$directions = $history.SwingStats.SuccessRateByDirection
foreach ($direction in $directions.PSObject.Properties) {
    $directionName = $direction.Name
    $directionRate = [math]::Round($direction.Value * 100, 1)
    $color = if ($directionRate -ge 40) { "Green" } elseif ($directionRate -ge 20) { "Yellow" } else { "Red" }
    Write-Host "  $($directionName):".PadRight(15) "$directionRate%" -ForegroundColor $color
}
Write-Host ""

# Swing Size Distribution
Write-Host "SWING SIZE DISTRIBUTION:" -ForegroundColor Yellow
$swingSizes = $history.SwingStats.SuccessRateBySwingSize
foreach ($size in $swingSizes.PSObject.Properties) {
    $sizeName = $size.Name
    $sizeRate = [math]::Round($size.Value * 100, 1)
    $color = if ($sizeRate -ge 40) { "Green" } elseif ($sizeRate -ge 20) { "Yellow" } else { "Red" }
    Write-Host "  $($sizeName) pips:".PadRight(15) "$sizeRate%" -ForegroundColor $color
}
Write-Host ""

# Readiness Check
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "READINESS FOR QUALITY FILTERING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$readinessCriteria = @()

# Criterion 1: Total Swings >= 500
if ($totalSwings -ge 500) {
    Write-Host "  1. Total Swings >= 500:     PASS ($totalSwings swings)" -ForegroundColor Green
    $readinessCriteria += 1
} else {
    Write-Host "  1. Total Swings >= 500:     FAIL ($totalSwings / 500)" -ForegroundColor Red
}

# Criterion 2: Success Rate >= 40%
if ($successRate -ge 40) {
    Write-Host "  2. Success Rate >= 40%:     PASS ($successRate%)" -ForegroundColor Green
    $readinessCriteria += 1
} else {
    Write-Host "  2. Success Rate >= 40%:     FAIL ($successRate%)" -ForegroundColor Red
}

# Criterion 3: Multiple sessions have data
$sessionsWithData = 0
foreach ($session in $sessions.PSObject.Properties) {
    if ($session.Value -gt 0) { $sessionsWithData++ }
}
if ($sessionsWithData -ge 2) {
    Write-Host "  3. Sessions with Data >= 2: PASS ($sessionsWithData sessions)" -ForegroundColor Green
    $readinessCriteria += 1
} else {
    Write-Host "  3. Sessions with Data >= 2: FAIL ($sessionsWithData sessions)" -ForegroundColor Red
}

# Criterion 4: Both directions have data
$directionsWithData = 0
foreach ($direction in $directions.PSObject.Properties) {
    if ($direction.Value -gt 0) { $directionsWithData++ }
}
if ($directionsWithData -ge 2) {
    Write-Host "  4. Directions with Data:    PASS ($directionsWithData directions)" -ForegroundColor Green
    $readinessCriteria += 1
} else {
    Write-Host "  4. Directions with Data:    FAIL ($directionsWithData directions)" -ForegroundColor Red
}

Write-Host ""
Write-Host "READINESS SCORE: $($readinessCriteria.Count) / 4 criteria met" -ForegroundColor $(if ($readinessCriteria.Count -ge 3) { "Green" } else { "Yellow" })
Write-Host ""

# Recommendations
if ($readinessCriteria.Count -ge 3) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "READY TO RE-ENABLE QUALITY FILTERING!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Run validation test to check quality score distribution"
    Write-Host "  2. Set threshold to 75th percentile of quality scores (typically 0.20-0.30)"
    Write-Host "  3. Re-enable filtering: EnableSwingQualityFilter = true"
    Write-Host "  4. Rebuild bot and run validation backtest"
    Write-Host "  5. Verify 60-75% win rate with 15-30% acceptance"
    Write-Host ""
    Write-Host "See: PHASE2_DATA_COLLECTION_GUIDE.md (Phase B)" -ForegroundColor Cyan
} else {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "CONTINUE DATA COLLECTION" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Actions Needed:" -ForegroundColor Yellow

    if ($totalSwings -lt 500) {
        $needed = [math]::Ceiling(($targetSwings - $totalSwings) / 50)
        Write-Host "  - Run $needed more backtests (target: 500 swings)"
    }

    if ($successRate -lt 40) {
        Write-Host "  - Continue running backtests until success rate normalizes to 40%+"
    }

    if ($sessionsWithData -lt 2) {
        Write-Host "  - Run backtests across different sessions (London, NY, Asia)"
    }

    if ($directionsWithData -lt 2) {
        Write-Host "  - Ensure backtests include both bullish and bearish market conditions"
    }

    Write-Host ""
    Write-Host "See: PHASE2_DATA_COLLECTION_GUIDE.md (Phase A)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Progress check complete. Run this script after each batch of backtests." -ForegroundColor Cyan
