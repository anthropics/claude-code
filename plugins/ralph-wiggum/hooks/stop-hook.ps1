#Requires -Version 5.1
<#
.SYNOPSIS
    Ralph Wiggum Stop Hook (Windows Port)
    Prevents session exit when a ralph-loop is active
    Feeds Claude's output back as input to continue the loop

.DESCRIPTION
    Windows PowerShell port of the original bash stop-hook.sh
    Ported by Richard Moore (Starrtec)
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# Read hook input from stdin
$hookInput = [Console]::In.ReadToEnd()

# Check if ralph-loop is active
$ralphStateFile = ".claude/ralph-loop.local.md"

if (-not (Test-Path $ralphStateFile)) {
    # No active loop - allow exit
    exit 0
}

# Read state file content
$stateContent = Get-Content $ralphStateFile -Raw

# Parse YAML frontmatter (between --- markers)
if ($stateContent -match '(?s)^---\r?\n(.+?)\r?\n---') {
    $frontmatter = $Matches[1]
} else {
    Write-Error "Ralph loop: State file has invalid format (no frontmatter)"
    Remove-Item $ralphStateFile -Force
    exit 0
}

# Extract values from frontmatter
$iteration = $null
$maxIterations = $null
$completionPromise = $null

foreach ($line in $frontmatter -split '\r?\n') {
    if ($line -match '^iteration:\s*(\d+)') {
        $iteration = [int]$Matches[1]
    }
    elseif ($line -match '^max_iterations:\s*(\d+)') {
        $maxIterations = [int]$Matches[1]
    }
    elseif ($line -match '^completion_promise:\s*"?([^"]*)"?') {
        $completionPromise = $Matches[1]
        if ($completionPromise -eq 'null') { $completionPromise = $null }
    }
}

# Validate iteration field
if ($null -eq $iteration) {
    Write-Host @"
Ralph loop: State file corrupted
   File: $ralphStateFile
   Problem: 'iteration' field is not a valid number

   This usually means the state file was manually edited or corrupted.
   Ralph loop is stopping. Run /ralph-loop again to start fresh.
"@ -ForegroundColor Yellow
    Remove-Item $ralphStateFile -Force
    exit 0
}

# Validate max_iterations field
if ($null -eq $maxIterations) {
    Write-Host @"
Ralph loop: State file corrupted
   File: $ralphStateFile
   Problem: 'max_iterations' field is not a valid number

   This usually means the state file was manually edited or corrupted.
   Ralph loop is stopping. Run /ralph-loop again to start fresh.
"@ -ForegroundColor Yellow
    Remove-Item $ralphStateFile -Force
    exit 0
}

# Check if max iterations reached
if ($maxIterations -gt 0 -and $iteration -ge $maxIterations) {
    Write-Host "Ralph loop: Max iterations ($maxIterations) reached." -ForegroundColor Red
    Remove-Item $ralphStateFile -Force
    exit 0
}

# Get transcript path from hook input
try {
    $hookData = $hookInput | ConvertFrom-Json
    $transcriptPath = $hookData.transcript_path
} catch {
    Write-Host @"
Ralph loop: Failed to parse hook input
   Error: $_
   Ralph loop is stopping.
"@ -ForegroundColor Yellow
    Remove-Item $ralphStateFile -Force
    exit 0
}

if (-not (Test-Path $transcriptPath)) {
    Write-Host @"
Ralph loop: Transcript file not found
   Expected: $transcriptPath
   This is unusual and may indicate a Claude Code internal issue.
   Ralph loop is stopping.
"@ -ForegroundColor Yellow
    Remove-Item $ralphStateFile -Force
    exit 0
}

# Read transcript (JSONL format - one JSON per line)
$transcriptContent = Get-Content $transcriptPath -Raw

# Find all assistant messages
$assistantLines = @()
foreach ($line in $transcriptContent -split '\r?\n') {
    if ($line -match '"role"\s*:\s*"assistant"') {
        $assistantLines += $line
    }
}

if ($assistantLines.Count -eq 0) {
    Write-Host @"
Ralph loop: No assistant messages found in transcript
   Transcript: $transcriptPath
   This is unusual and may indicate a transcript format issue
   Ralph loop is stopping.
"@ -ForegroundColor Yellow
    Remove-Item $ralphStateFile -Force
    exit 0
}

# Get last assistant message
$lastLine = $assistantLines[-1]

try {
    $lastMessage = $lastLine | ConvertFrom-Json
    # Extract text content from message
    $textParts = @()
    foreach ($content in $lastMessage.message.content) {
        if ($content.type -eq 'text') {
            $textParts += $content.text
        }
    }
    $lastOutput = $textParts -join "`n"
} catch {
    Write-Host @"
Ralph loop: Failed to parse assistant message JSON
   Error: $_
   This may indicate a transcript format issue
   Ralph loop is stopping.
"@ -ForegroundColor Yellow
    Remove-Item $ralphStateFile -Force
    exit 0
}

if ([string]::IsNullOrWhiteSpace($lastOutput)) {
    Write-Host "Ralph loop: Assistant message contained no text content`n   Ralph loop is stopping." -ForegroundColor Yellow
    Remove-Item $ralphStateFile -Force
    exit 0
}

# Check for completion promise (only if set)
if ($completionPromise) {
    # Extract text from <promise> tags (first occurrence)
    if ($lastOutput -match '(?s)<promise>(.*?)</promise>') {
        $promiseText = $Matches[1].Trim() -replace '\s+', ' '

        if ($promiseText -eq $completionPromise) {
            Write-Host "Ralph loop: Detected <promise>$completionPromise</promise>" -ForegroundColor Green
            Remove-Item $ralphStateFile -Force
            exit 0
        }
    }
}

# Not complete - continue loop with SAME PROMPT
$nextIteration = $iteration + 1

# Extract prompt (everything after the closing ---)
# Skip frontmatter and get the rest
if ($stateContent -match '(?s)^---\r?\n.+?\r?\n---\r?\n(.*)$') {
    $promptText = $Matches[1].Trim()
} else {
    $promptText = ""
}

if ([string]::IsNullOrWhiteSpace($promptText)) {
    Write-Host @"
Ralph loop: State file corrupted or incomplete
   File: $ralphStateFile
   Problem: No prompt text found

   This usually means:
     - State file was manually edited
     - File was corrupted during writing

   Ralph loop is stopping. Run /ralph-loop again to start fresh.
"@ -ForegroundColor Yellow
    Remove-Item $ralphStateFile -Force
    exit 0
}

# Update iteration in state file
$updatedContent = $stateContent -replace 'iteration:\s*\d+', "iteration: $nextIteration"
Set-Content -Path $ralphStateFile -Value $updatedContent -NoNewline

# Build system message
if ($completionPromise) {
    $systemMsg = "Ralph iteration $nextIteration | To stop: output <promise>$completionPromise</promise> (ONLY when statement is TRUE - do not lie to exit!)"
} else {
    $systemMsg = "Ralph iteration $nextIteration | No completion promise set - loop runs infinitely"
}

# Output JSON to block the stop and feed prompt back
$output = @{
    decision = "block"
    reason = $promptText
    systemMessage = $systemMsg
} | ConvertTo-Json -Compress

Write-Output $output

exit 0
