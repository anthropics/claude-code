# Comprehensive Trade Analysis Script for SELL Entry Diagnosis
# Analyzes logs to extract trade direction, bias, MSS context, PnL, session info

param(
    [string]$LogFile = "C:\Users\Administrator\Documents\cAlgo\Data\cBots\CCTTB\data\logs\JadecapDebug_20251026_114433.log"
)

$log = Get-Content $LogFile

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CCTTB SELL ENTRY DIAGNOSTIC ANALYSIS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Extract all closed positions
$closedPositions = @()
foreach ($line in $log) {
    if ($line -match 'Position closed: (\w+_\d+).*PnL: ([-\d.]+)') {
        $closedPositions += [PSCustomObject]@{
            PositionId = $matches[1]
            PnL = [double]$matches[2]
            Result = if ([double]$matches[2] -gt 0) { "WIN" } else { "LOSS" }
        }
    }
}

Write-Host "1. CLOSED POSITIONS SUMMARY" -ForegroundColor Yellow
Write-Host ("=" * 50)
$closedPositions | Format-Table -AutoSize
Write-Host "Total: $($closedPositions.Count) | Wins: $(($closedPositions | Where-Object { `$_.Result -eq 'WIN' }).Count) | Losses: $(($closedPositions | Where-Object { `$_.Result -eq 'LOSS' }).Count)`n"

# Extract OTE entries with context
$oteEntries = @()
$lineNum = 0
foreach ($line in $log) {
    $lineNum++
    if ($line -match 'ENTRY OTE: dir=(Bullish|Bearish)') {
        $direction = $matches[1]
        $timestamp = if ($line -match '(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})') { $matches[1] } else { "Unknown" }

        # Look back 50 lines for bias and MSS context
        $contextStart = [Math]::Max(0, $lineNum - 50)
        $contextLines = $log[$contextStart..($lineNum-1)]

        $dailyBias = "Unknown"
        $mssDir = "Unknown"
        $oppLiq = 0

        foreach ($ctx in $contextLines) {
            if ($ctx -match 'dailyBias=(\w+)') { $dailyBias = $matches[1] }
            if ($ctx -match 'activeMssDir=(\w+)') { $mssDir = $matches[1] }
            if ($ctx -match 'OppLiq=([\d.]+)') { $oppLiq = [double]$matches[1] }
        }

        $oteEntries += [PSCustomObject]@{
            Timestamp = $timestamp
            Direction = $direction
            DailyBias = $dailyBias
            MSSDir = $mssDir
            OppLiq = $oppLiq
            BiasAligned = ($direction -eq $dailyBias)
        }
    }
}

Write-Host "2. OTE ENTRY SIGNALS ANALYSIS" -ForegroundColor Yellow
Write-Host ("=" * 50)
$oteEntries | Format-Table -AutoSize

$bullishEntries = ($oteEntries | Where-Object { $_.Direction -eq "Bullish" }).Count
$bearishEntries = ($oteEntries | Where-Object { $_.Direction -eq "Bearish" }).Count

Write-Host "`nBullish OTE Signals: $bullishEntries"
Write-Host "Bearish OTE Signals: $bearishEntries"
Write-Host "Bearish/Bullish Ratio: $(if ($bullishEntries -gt 0) { [Math]::Round($bearishEntries / $bullishEntries, 2) } else { 'N/A' })`n"

# Bias alignment analysis
$biasAligned = ($oteEntries | Where-Object { $_.BiasAligned -eq $true }).Count
$biasConflict = ($oteEntries | Where-Object { $_.BiasAligned -eq $false }).Count

Write-Host "3. BIAS ALIGNMENT ANALYSIS" -ForegroundColor Yellow
Write-Host ("=" * 50)
Write-Host "Entries ALIGNED with daily bias: $biasAligned"
Write-Host "Entries CONFLICTING with daily bias: $biasConflict"
Write-Host "Conflict Rate: $(if (($biasAligned + $biasConflict) -gt 0) { [Math]::Round($biasConflict / ($biasAligned + $biasConflict) * 100, 1) } else { 0 })%`n"

# Extract MSS signals
$mssSignals = @()
foreach ($line in $log) {
    if ($line -match 'MSS Lifecycle: LOCKED.*dir=(\w+)') {
        $mssSignals += $matches[1]
    }
}

$mssBullish = ($mssSignals | Where-Object { $_ -eq "Bullish" }).Count
$mssBearish = ($mssSignals | Where-Object { $_ -eq "Bearish" }).Count

Write-Host "4. MSS SIGNAL DISTRIBUTION" -ForegroundColor Yellow
Write-Host ("=" * 50)
Write-Host "Bullish MSS Locked: $mssBullish"
Write-Host "Bearish MSS Locked: $mssBearish"
Write-Host "Bearish/Bullish MSS Ratio: $(if ($mssBullish -gt 0) { [Math]::Round($mssBearish / $mssBullish, 2) } else { 'N/A' })`n"

# Extract sweep events
$sweepsBullish = ($log | Select-String -Pattern "Sweep.*EQL.*Bullish" -AllMatches).Matches.Count
$sweepsBearish = ($log | Select-String -Pattern "Sweep.*EQH.*Bearish" -AllMatches).Matches.Count

Write-Host "5. LIQUIDITY SWEEP DISTRIBUTION" -ForegroundColor Yellow
Write-Host ("=" * 50)
Write-Host "Bullish Sweeps (EQL): $sweepsBullish"
Write-Host "Bearish Sweeps (EQH): $sweepsBearish"
Write-Host "Bearish/Bullish Sweep Ratio: $(if ($sweepsBullish -gt 0) { [Math]::Round($sweepsBearish / $sweepsBullish, 2) } else { 'N/A' })`n"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DIAGNOSTIC COMPLETE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
