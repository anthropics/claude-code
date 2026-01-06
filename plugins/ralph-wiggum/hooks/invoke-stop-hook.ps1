#Requires -Version 5.1
<#
.SYNOPSIS
    Ralph Wiggum stop hook wrapper for Windows
    Calls the native PowerShell stop hook
#>

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$stopHook = Join-Path $scriptDir "stop-hook.ps1"

# Pipe stdin through to the PowerShell stop hook
$input | & powershell -NoProfile -ExecutionPolicy Bypass -File $stopHook
exit $LASTEXITCODE
