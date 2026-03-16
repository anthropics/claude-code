# fix-scroll-to-top.ps1
# Fixes terminal scroll-to-top during Claude Code agent execution.
#
# Root cause: Ink's rendering emits \x1B[H (cursor home = row 1, col 1)
# in clearTerminal, exitAlternateScreen, and handleResume. Terminal
# emulators follow the cursor, snapping viewport to the top.
#
# This patch removes \x1B[H from 3 locations, keeping \x1B[2J (erase
# screen) intact. The diff engine handles cursor positioning correctly
# without cursor-home.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File fix-scroll-to-top.ps1
#
# Requires: npm-installed Claude Code (npm install -g @anthropic-ai/claude-code)
# Re-run after every npm update.
#
# Related: https://github.com/anthropics/claude-code/issues/34794
#          https://github.com/anthropics/claude-code/pull/34798

param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$cliPath = "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code\cli.js"

if (-not (Test-Path $cliPath)) {
    Write-Host "ERROR: Claude Code npm install not found at $cliPath" -ForegroundColor Red
    Write-Host "Run: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
    exit 1
}

$code = [System.IO.File]::ReadAllText($cliPath, [System.Text.Encoding]::UTF8)

# --- Patch definitions (3 fixes) ---

# Fix 1: LH8() - clearTerminal: remove +HK6 (cursor home)
$fix1_orig = 'function LH8(){if(process.platform==="win32")if(HU3())return jO1+$H8+HK6;else return jO1+wU3;return jO1+$H8+HK6}'
$fix1_new  = 'function LH8(){if(process.platform==="win32")if(HU3())return jO1+$H8;else return jO1+wU3;return jO1+$H8}'

# Fix 2: exitAlternateScreen() - remove \x1B[H
$fix2_orig = 'exitAlternateScreen(){if(this.options.stdout.write("\x1B[2J\x1B[H"+(this.altScreenActive?NO1:"\x1B[?1049l")+"\x1B[?25l")'
$fix2_new  = 'exitAlternateScreen(){if(this.options.stdout.write("\x1B[2J"+(this.altScreenActive?NO1:"\x1B[?1049l")+"\x1B[?25l")'

# Fix 3: handleResume() SIGCONT - remove \x1B[H
$fix3_orig = 'this.options.stdout.write(kH8+"\x1B[2J\x1B[H"+(this.altScreenMouseTracking?NO1:""))'
$fix3_new  = 'this.options.stdout.write(kH8+"\x1B[2J"+(this.altScreenMouseTracking?NO1:""))'

# --- Uninstall ---

if ($Uninstall) {
    $reverted = 0
    if ($code.Contains($fix1_new)) { $code = $code.Replace($fix1_new, $fix1_orig); $reverted++ }
    if ($code.Contains($fix2_new)) { $code = $code.Replace($fix2_new, $fix2_orig); $reverted++ }
    if ($code.Contains($fix3_new)) { $code = $code.Replace($fix3_new, $fix3_orig); $reverted++ }
    if ($reverted -gt 0) {
        [System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
        Write-Host "Reverted $reverted patch(es)." -ForegroundColor Green
    } else {
        Write-Host "No patches to revert." -ForegroundColor Yellow
    }
    exit 0
}

# --- Apply patches ---

$applied = 0
$skipped = 0

# Fix 1
if ($code.Contains($fix1_new)) {
    Write-Host "[Fix 1/3] LH8() already patched." -ForegroundColor Green; $skipped++
} elseif ($code.Contains($fix1_orig)) {
    $code = $code.Replace($fix1_orig, $fix1_new); $applied++
    Write-Host "[Fix 1/3] LH8() patched - removed cursor home from clearTerminal." -ForegroundColor Green
} else {
    Write-Host "[Fix 1/3] LH8() pattern not found - version may have changed." -ForegroundColor Red
}

# Fix 2
if ($code.Contains($fix2_new)) {
    Write-Host "[Fix 2/3] exitAlternateScreen() already patched." -ForegroundColor Green; $skipped++
} elseif ($code.Contains($fix2_orig)) {
    $code = $code.Replace($fix2_orig, $fix2_new); $applied++
    Write-Host "[Fix 2/3] exitAlternateScreen() patched - removed cursor home." -ForegroundColor Green
} else {
    Write-Host "[Fix 2/3] exitAlternateScreen() pattern not found." -ForegroundColor Red
}

# Fix 3
if ($code.Contains($fix3_new)) {
    Write-Host "[Fix 3/3] handleResume() already patched." -ForegroundColor Green; $skipped++
} elseif ($code.Contains($fix3_orig)) {
    $code = $code.Replace($fix3_orig, $fix3_new); $applied++
    Write-Host "[Fix 3/3] handleResume() patched - removed cursor home from SIGCONT." -ForegroundColor Green
} else {
    Write-Host "[Fix 3/3] handleResume() pattern not found." -ForegroundColor Red
}

# --- Write ---

if ($applied -gt 0) {
    [System.IO.File]::WriteAllText($cliPath, $code, [System.Text.Encoding]::UTF8)
}

Write-Host ""
Write-Host "Done: $applied applied, $skipped already patched." -ForegroundColor Cyan
Write-Host "Run Claude Code via: $env:APPDATA\npm\claude.cmd" -ForegroundColor White
Write-Host "To revert: powershell -File $PSCommandPath -Uninstall" -ForegroundColor Gray
