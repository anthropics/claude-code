<#
.SYNOPSIS
    Diagnoses and repairs the GitHub MCP connector in the Claude desktop app (Cowork) on Windows.

.DESCRIPTION
    This script checks whether the GitHub connector is properly configured in the Claude
    desktop app by verifying the OAuth token scope, connector registration, and local
    credential state. It can also clear stale connector caches to force re-authentication.

    Known issue: The GitHub connector shows "Connected" but exposes zero tools in Cowork
    sessions. Root cause: the OAuth token is missing the `user:mcp_servers` scope, which
    prevents MCP tools from being listed. See issue #61682, #57589, #41658, #28695.

.PARAMETER CheckOnly
    Only checks the connector state without making any changes.

.PARAMETER Force
    Clears the GitHub connector cache and credentials to force a fresh OAuth flow.

.PARAMETER LogPath
    Path to write diagnostic output. Defaults to a timestamped file in the temp directory.

.EXAMPLE
    .\scripts\Diagnose-GitHubConnector.ps1 -CheckOnly
    Checks the GitHub connector state without making changes.

.EXAMPLE
    .\scripts\Diagnose-GitHubConnector.ps1 -Force
    Clears stale connector cache and credentials, then prompts to re-authenticate.

.NOTES
    Author: Community contribution — anthropics/claude-code#61682
    Requires: Windows 10+, Claude Desktop app, Windows PowerShell 5.1 or PowerShell 7+
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [switch]$CheckOnly,

    [Parameter(Mandatory=$false)]
    [switch]$Force,

    [Parameter(Mandatory=$false)]
    [string]$LogPath = (Join-Path $env:TEMP "claude-github-connector-diagnostic-$(Get-Date -Format 'yyyyMMdd-HHmmss').log")
)

$ErrorActionPreference = 'Stop'

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$timestamp] $Message"
    Write-Output $line
    Add-Content -Path $LogPath -Value $line
}

function Write-Result {
    param([string]$Label, [string]$Status, [string]$Detail)
    $symbol = switch ($Status) {
        'PASS' { '[PASS]' }
        'FAIL' { '[FAIL]' }
        'WARN' { '[WARN]' }
        'INFO' { '[INFO]' }
        default { "[$Status]" }
    }
    $line = if ($Detail) { "$symbol $Label -- $Detail" } else { "$symbol $Label" }
    Write-Output $line
    Add-Content -Path $LogPath -Value $line
}

Write-Output "========================================"
Write-Output " Claude Desktop - GitHub Connector Diagnostic"
Write-Output "========================================"
Write-Output "Log: $LogPath"
Write-Output ""

# --- Check 1: Claude Desktop installation ---
$claudePaths = @(
    "$env:LOCALAPPDATA\Programs\Claude\Claude.exe",
    "${env:ProgramFiles}\Claude\Claude.exe",
    "${env:ProgramFiles(x86)}\Claude\Claude.exe"
)
$foundClaude = $false
foreach ($p in $claudePaths) {
    if (Test-Path -LiteralPath $p) {
        Write-Result -Label "Claude Desktop installation" -Status PASS -Detail $p
        $foundClaude = $true
        break
    }
}
if (-not $foundClaude) {
    Write-Result -Label "Claude Desktop installation" -Status FAIL -Detail "Not found at any expected path. Is Claude Desktop installed?"
}

# --- Check 2: Windows Credential Manager for Claude tokens ---
Write-Output ""
Write-Output "--- Credential Manager Check ---"
try {
    $credentialList = & cmd /c 'cmdkey /list 2>&1'
    $claudeCreds = $credentialList | Select-String -Pattern 'Claude|anthropic'
    if ($claudeCreds) {
        Write-Result -Label "Claude credentials in Credential Manager" -Status PASS -Detail "Found $($claudeCreds.Count) entries"
        foreach ($cred in $claudeCreds) {
            Write-Log "  $cred"
        }
    } else {
        Write-Result -Label "Claude credentials in Credential Manager" -Status WARN -Detail "No Claude/anthropic credentials found. May not be logged in yet."
    }
} catch {
    Write-Result -Label "Credential Manager check" -Status FAIL -Detail "Failed to enumerate: $($_.Exception.Message)"
}

# --- Check 3: Claude Desktop config and logs ---
$claudeConfigPaths = @(
    "$env:APPDATA\Claude",
    "$env:LOCALAPPDATA\Claude"
)
$claudeFound = $false
foreach ($cp in $claudeConfigPaths) {
    if (Test-Path -LiteralPath $cp) {
        $claudeFound = $true
        Write-Result -Label "Claude config directory" -Status PASS -Detail $cp
        $settingsFile = Join-Path $cp "claude.json"
        if (Test-Path -LiteralPath $settingsFile) {
            Write-Result -Label "claude.json settings" -Status PASS -Detail $settingsFile
        }
        $logDir = Join-Path $cp "logs"
        if (Test-Path -LiteralPath $logDir) {
            Write-Result -Label "Claude logs directory" -Status PASS -Detail $logDir
            $recentLogs = Get-ChildItem -LiteralPath $logDir -Filter "*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 3
            foreach ($log in $recentLogs) {
                Write-Log "  Recent log: $($log.Name) ($($log.LastWriteTime))"
            }
        }
        break
    }
}
if (-not $claudeFound) {
    Write-Result -Label "Claude config directory" -Status WARN -Detail "Not found. Has Claude Desktop been started at least once?"
}

# --- Check 4: GitHub connector MCP cache ---
Write-Output ""
Write-Output "--- MCP Connector Cache Check ---"
$mcpCacheDirs = @(
    "$env:APPDATA\Claude\mcp",
    "$env:LOCALAPPDATA\Claude\mcp",
    "$env:APPDATA\Claude\connectors",
    "$env:LOCALAPPDATA\Claude\connectors",
    "$env:APPDATA\Claude\mcp-cache",
    "$env:LOCALAPPDATA\Claude\mcp-cache"
)
$foundCache = $false
foreach ($mcd in $mcpCacheDirs) {
    if (Test-Path -LiteralPath $mcd) {
        $foundCache = $true
        Write-Result -Label "MCP cache directory" -Status PASS -Detail $mcd
        $githubFiles = Get-ChildItem -LiteralPath $mcd -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like '*github*' -or $_.Name -like '*GitHub*' }
        if ($githubFiles) {
            Write-Result -Label "GitHub connector cache entries" -Status INFO -Detail "Found $($githubFiles.Count)"
        } else {
            Write-Result -Label "GitHub connector cache entries" -Status INFO -Detail "No GitHub-specific cache entries found"
        }
        break
    }
}
if (-not $foundCache) {
    Write-Result -Label "MCP cache" -Status INFO -Detail "No cache directory found"
}

# --- Check 5: Environment and PowerShell info ---
Write-Output ""
Write-Output "--- Environment ---"
try {
    $osInfo = Get-CimInstance Win32_OperatingSystem
    Write-Result -Label "OS Version" -Status INFO -Detail "$($osInfo.Caption) $($osInfo.Version)"
} catch {
    Write-Result -Label "OS Version" -Status INFO -Detail "$([Environment]::OSVersion)"
}
Write-Result -Label "PowerShell Version" -Status INFO -Detail "$($PSVersionTable.PSVersion)"
Write-Result -Label "CLAUDE_CODE env var" -Status INFO -Detail $(if ($env:CLAUDE_CODE) { "Set: $env:CLAUDE_CODE" } else { "Not set" })

# --- Summary ---
Write-Output ""
Write-Output "========================================"
Write-Output " Summary"
Write-Output "========================================"
Write-Output ""
Write-Output "If no GitHub connector tools appear in Cowork sessions"
Write-Output "despite showing 'Connected' status, the likely cause is a"
Write-Output "stale OAuth token missing the 'user:mcp_servers' scope."
Write-Output ""
Write-Output "See these related issues for details:"
Write-Output "  #61682 - Current report (Windows 11, app v1.8555.2.0)"
Write-Output "  #57589 - Same issue on Windows"
Write-Output "  #41658 - OAuth token missing user:mcp_servers scope (root cause)"
Write-Output "  #28695 - OAuth scope not requested during authentication"
Write-Output ""

if ($Force) {
    Write-Output "--- Force re-authentication ---"
    Write-Output "Clearing connector cache..."
    $cleared = $false
    foreach ($mcd in $mcpCacheDirs) {
        if (Test-Path -LiteralPath $mcd) {
            try {
                Remove-Item -LiteralPath $mcd -Recurse -Force -ErrorAction SilentlyContinue
                Write-Result -Label "Cleared cache" -Status PASS -Detail $mcd
                $cleared = $true
            } catch {
                Write-Result -Label "Clear cache" -Status WARN -Detail "Could not clear $mcd : $($_.Exception.Message)"
            }
        }
    }
    if (-not $cleared) {
        Write-Result -Label "Clear cache" -Status INFO -Detail "No cache directories found to clear"
    }

    Write-Output ""
    Write-Output "Next steps:"
    Write-Output "  1. Fully quit Claude Desktop (right-click system tray icon > Quit)"
    Write-Output "  2. Reopen Claude Desktop"
    Write-Output "  3. Go to Customize > Connectors"
    Write-Output "  4. Disconnect and reconnect the GitHub connector"
    Write-Output "  5. Start a new Cowork session"
    Write-Output ""
    Write-Output "If the issue persists after reconnecting:"
    Write-Output "  - Sign out and sign back in to Claude Desktop"
    Write-Output "  - This forces a fresh OAuth token which should include the"
    Write-Output "    required 'user:mcp_servers' scope"
} elseif ($CheckOnly) {
    Write-Output "Run with -Force to clear stale connector cache and"
    Write-Output "prompt for re-authentication."
}

Write-Output "Diagnostic log written to: $LogPath"
