# fix-scroll-to-top.ps1 (v3 — render throttle only)
#
# Root cause: Windows Terminal bug microsoft/terminal#14774
# SetConsoleCursorPosition always scrolls viewport to cursor, even when visible.
# Every Ink re-render triggers cursor positioning → viewport jumps.
#
# Fix: increase render throttle from 16ms (60fps) to 1000ms (1fps).
# Gives 1 full second of uninterrupted reading between viewport resets.
# Trade-off: streaming text appears in ~1 second chunks.
#
# Previous approaches that did NOT work:
# - Cursor-up clamping (stdout interceptor): WT bug triggers on ANY cursor move
# - Disabling synchronized update mode: causes flickering
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File fix-scroll-to-top.ps1
#
# Related: https://github.com/anthropics/claude-code/issues/34794
#          https://github.com/anthropics/claude-code/pull/34798
#          https://github.com/microsoft/terminal/issues/14774

param([switch]$Uninstall)

$ErrorActionPreference = "Stop"
$cliPath = "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code\cli.js"

if (-not (Test-Path $cliPath)) {
    Write-Host "ERROR: npm install not found. Run: npm install -g @anthropic-ai/claude-code" -ForegroundColor Red
    exit 1
}

$code = [System.IO.File]::ReadAllText($cliPath, [System.Text.Encoding]::UTF8)

if ($Uninstall) {
    if ($code.Contains('var SK6=1000;')) {
        $code = $code.Replace('var SK6=1000;', 'var SK6=16;')
        [System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
        Write-Host "Reverted render throttle to 16ms." -ForegroundColor Green
    } else {
        Write-Host "No patch to revert." -ForegroundColor Yellow
    }
    exit 0
}

if ($code.Contains('var SK6=1000;')) {
    Write-Host "Already patched (1000ms throttle)." -ForegroundColor Green
} elseif ($code.Contains('var SK6=16;')) {
    $code = $code.Replace('var SK6=16;', 'var SK6=1000;')
    [System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
    Write-Host "Applied render throttle: 16ms -> 1000ms (1fps)." -ForegroundColor Green
} else {
    Write-Host "ERROR: SK6 pattern not found — version may have changed." -ForegroundColor Red
    exit 1
}

Write-Host "Run: $env:APPDATA\npm\claude.cmd" -ForegroundColor Cyan
Write-Host "Revert: powershell -File $PSCommandPath -Uninstall" -ForegroundColor Gray
