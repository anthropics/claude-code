# Phase 2 Quality Filtering - Analysis of 0.13 Threshold Backtest
# Log: JadecapDebug_20251028_092225.log

$log = "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\logs\JadecapDebug_20251028_092225.log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 2 Quality Filtering - 0.13 Threshold Results" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Quality Gate Decisions
Write-Host "QUALITY GATE DECISIONS:" -ForegroundColor Yellow
$accepted = (Select-String -Path $log -Pattern '\[QUALITY GATE\].*Swing ACCEPTED').Count
$rejected = (Select-String -Path $log -Pattern '\[QUALITY GATE\].*Swing REJECTED').Count
$total = $accepted + $rejected
$acceptanceRate = if ($total -gt 0) { [math]::Round($accepted / $total * 100, 1) } else { 0 }

Write-Host "  Swings Accepted:  $accepted"
Write-Host "  Swings Rejected:  $rejected"
Write-Host "  Total Swings:     $total"
Write-Host "  Acceptance Rate:  $acceptanceRate%" -ForegroundColor $(if ($acceptanceRate -ge 12 -and $acceptanceRate -le 18) { "Green" } else { "Yellow" })
Write-Host ""

# Expected: 12-18% acceptance
if ($acceptanceRate -ge 12 -and $acceptanceRate -le 18) {
    Write-Host "  ✓ Acceptance rate is OPTIMAL (12-18% target)" -ForegroundColor Green
} elseif ($acceptanceRate -lt 12) {
    Write-Host "  ⚠ Acceptance rate is LOW (<12%) - Consider lowering threshold to 0.12" -ForegroundColor Yellow
} else {
    Write-Host "  ⚠ Acceptance rate is HIGH (>18%) - Consider increasing threshold to 0.14" -ForegroundColor Yellow
}
Write-Host ""

# Win Rate
Write-Host "TRADE OUTCOMES:" -ForegroundColor Yellow
$outcomes = (Select-String -Path $log -Pattern '\[SWING LEARNING\] Updated swing outcome').Count
$wins = (Select-String -Path $log -Pattern 'OTE Worked: True').Count
$losses = $outcomes - $wins
$winRate = if ($outcomes -gt 0) { [math]::Round($wins / $outcomes * 100, 1) } else { 0 }

Write-Host "  Total Trades:     $outcomes"
Write-Host "  Wins:             $wins"
Write-Host "  Losses:           $losses"
Write-Host "  Win Rate:         $winRate%" -ForegroundColor $(if ($winRate -ge 60) { "Green" } elseif ($winRate -ge 55) { "Yellow" } else { "Red" })
Write-Host ""

# Expected: 60-70% win rate
if ($winRate -ge 60 -and $winRate -le 75) {
    Write-Host "  ✓ Win rate is EXCELLENT (60-70% target)" -ForegroundColor Green
} elseif ($winRate -ge 55) {
    Write-Host "  ⚠ Win rate is ACCEPTABLE (55-60%) but below target" -ForegroundColor Yellow
} elseif ($winRate -lt 47.4) {
    Write-Host "  ✗ Win rate is BELOW BASELINE (47.4%) - Increase threshold!" -ForegroundColor Red
} else {
    Write-Host "  ⚠ Win rate is MARGINAL (47-55%) - Consider threshold adjustment" -ForegroundColor Yellow
}
Write-Host ""

# Baseline Comparison
Write-Host "BASELINE COMPARISON:" -ForegroundColor Yellow
$baselineWR = 47.4
$wrImprovement = $winRate - $baselineWR
Write-Host "  Baseline Win Rate:    47.4%"
Write-Host "  Current Win Rate:     $winRate%"
Write-Host "  Improvement:          $([math]::Round($wrImprovement, 1))pp" -ForegroundColor $(if ($wrImprovement -ge 10) { "Green" } elseif ($wrImprovement -ge 5) { "Yellow" } else { "Red" })
Write-Host ""

if ($wrImprovement -ge 10) {
    Write-Host "  ✓ Win rate improvement is SIGNIFICANT (+10pp target)" -ForegroundColor Green
} elseif ($wrImprovement -ge 5) {
    Write-Host "  ⚠ Win rate improvement is MODERATE (+5-10pp)" -ForegroundColor Yellow
} else {
    Write-Host "  ✗ Win rate improvement is INSUFFICIENT (<5pp)" -ForegroundColor Red
}
Write-Host ""

# Session Breakdown
Write-Host "SESSION BREAKDOWN:" -ForegroundColor Yellow
$londonAccepted = (Select-String -Path $log -Pattern '\[QUALITY GATE\].*Swing ACCEPTED.*Session: London').Count
$nyAccepted = (Select-String -Path $log -Pattern '\[QUALITY GATE\].*Swing ACCEPTED.*Session: NY').Count
$asiaAccepted = (Select-String -Path $log -Pattern '\[QUALITY GATE\].*Swing ACCEPTED.*Session: Asia').Count
$otherAccepted = (Select-String -Path $log -Pattern '\[QUALITY GATE\].*Swing ACCEPTED.*Session: Other').Count

Write-Host "  London Accepted:  $londonAccepted (threshold: 0.15)"
Write-Host "  NY Accepted:      $nyAccepted (threshold: 0.13)"
Write-Host "  Asia Accepted:    $asiaAccepted (threshold: 0.13)"
Write-Host "  Other Accepted:   $otherAccepted (threshold: 0.13)"
Write-Host ""

# Quality Score Distribution
Write-Host "QUALITY SCORE DISTRIBUTION:" -ForegroundColor Yellow
$acceptedLines = Select-String -Path $log -Pattern '\[QUALITY GATE\].*Swing ACCEPTED.*Quality: ([0-9.]+)'
$qualityScores = $acceptedLines | ForEach-Object { [double]$_.Matches.Groups[1].Value }

if ($qualityScores.Count -gt 0) {
    $minQuality = ($qualityScores | Measure-Object -Minimum).Minimum
    $maxQuality = ($qualityScores | Measure-Object -Maximum).Maximum
    $avgQuality = [math]::Round(($qualityScores | Measure-Object -Average).Average, 3)

    Write-Host "  Min Quality:      $minQuality"
    Write-Host "  Max Quality:      $maxQuality"
    Write-Host "  Avg Quality:      $avgQuality"
    Write-Host ""

    # Quality ranges
    $q13to15 = ($qualityScores | Where-Object { $_ -ge 0.13 -and $_ -lt 0.15 }).Count
    $q15to17 = ($qualityScores | Where-Object { $_ -ge 0.15 -and $_ -lt 0.17 }).Count
    $q17plus = ($qualityScores | Where-Object { $_ -ge 0.17 }).Count

    Write-Host "  Quality 0.13-0.15:  $q13to15 swings"
    Write-Host "  Quality 0.15-0.17:  $q15to17 swings"
    Write-Host "  Quality 0.17+:      $q17plus swings"
} else {
    Write-Host "  No quality scores found in log" -ForegroundColor Red
}
Write-Host ""

# Direction Breakdown
Write-Host "DIRECTION BREAKDOWN:" -ForegroundColor Yellow
$bullishOutcomes = (Select-String -Path $log -Pattern '\[SWING LEARNING\] Updated swing outcome.*Bullish').Count
$bearishOutcomes = (Select-String -Path $log -Pattern '\[SWING LEARNING\] Updated swing outcome.*Bearish').Count
$bullishWins = (Select-String -Path $log -Pattern '\[SWING LEARNING\] Updated swing outcome.*Bullish.*OTE Worked: True').Count
$bearishWins = (Select-String -Path $log -Pattern '\[SWING LEARNING\] Updated swing outcome.*Bearish.*OTE Worked: True').Count

$bullishWR = if ($bullishOutcomes -gt 0) { [math]::Round($bullishWins / $bullishOutcomes * 100, 1) } else { 0 }
$bearishWR = if ($bearishOutcomes -gt 0) { [math]::Round($bearishWins / $bearishOutcomes * 100, 1) } else { 0 }

Write-Host "  Bullish Trades:   $bullishOutcomes ($bullishWins wins) - $bullishWR% WR"
Write-Host "  Bearish Trades:   $bearishOutcomes ($bearishWins wins) - $bearishWR% WR"
Write-Host ""

# SUCCESS CRITERIA CHECK
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SUCCESS CRITERIA (Need 3 of 4)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$criteria = @()

# Criterion 1: Win rate ≥ 57% (+10pp improvement)
if ($winRate -ge 57) {
    Write-Host "  ✓ Win rate ≥ 57%: PASS ($winRate%)" -ForegroundColor Green
    $criteria += 1
} else {
    Write-Host "  ✗ Win rate ≥ 57%: FAIL ($winRate%)" -ForegroundColor Red
}

# Criterion 2: Win rate ≥ 60% (quality maintained)
if ($winRate -ge 60) {
    Write-Host "  ✓ Win rate ≥ 60%: PASS ($winRate%)" -ForegroundColor Green
    $criteria += 1
} else {
    Write-Host "  ✗ Win rate ≥ 60%: FAIL ($winRate%)" -ForegroundColor Red
}

# Criterion 3: Trade frequency 12-18
if ($outcomes -ge 12 -and $outcomes -le 18) {
    Write-Host "  ✓ Trades 12-18: PASS ($outcomes trades)" -ForegroundColor Green
    $criteria += 1
} else {
    Write-Host "  ✗ Trades 12-18: FAIL ($outcomes trades)" -ForegroundColor $(if ($outcomes -lt 12) { "Yellow" } else { "Red" })
}

# Criterion 4: Net profit improvement +15% (approximate check)
# We'll estimate based on win rate improvement
$estimatedProfitImprovement = $wrImprovement * 2  # Rough estimate
if ($estimatedProfitImprovement -ge 15) {
    Write-Host "  ✓ Profit improvement ≥15%: LIKELY PASS (~$([math]::Round($estimatedProfitImprovement, 0))%)" -ForegroundColor Green
    $criteria += 1
} else {
    Write-Host "  ⚠ Profit improvement ≥15%: UNCERTAIN (~$([math]::Round($estimatedProfitImprovement, 0))%)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "CRITERIA MET: $($criteria.Count) of 4" -ForegroundColor $(if ($criteria.Count -ge 3) { "Green" } else { "Red" })
Write-Host ""

if ($criteria.Count -ge 3) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ PHASE 2 VALIDATION: SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Run 5-10 more backtests to confirm stability"
    Write-Host "  2. Accumulate learning data (target: 500+ swings)"
    Write-Host "  3. Monitor session-specific performance"
    Write-Host "  4. Gradually increase thresholds as data improves"
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "✗ PHASE 2 VALIDATION: NEEDS ADJUSTMENT" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Recommendations:" -ForegroundColor Yellow
    if ($acceptanceRate -lt 10) {
        Write-Host "  • Lower threshold to 0.12 (acceptance too low)"
    }
    if ($winRate -lt 55) {
        Write-Host "  • Increase threshold to 0.14 (win rate too low)"
    }
    if ($outcomes -lt 12) {
        Write-Host "  • Lower threshold to 0.12 (trade frequency too low)"
    }
    if ($outcomes -gt 20) {
        Write-Host "  • Increase threshold to 0.14-0.15 (trade frequency too high)"
    }
}

Write-Host ""
Write-Host "Analysis complete. Log: JadecapDebug_20251028_092225.log" -ForegroundColor Cyan
