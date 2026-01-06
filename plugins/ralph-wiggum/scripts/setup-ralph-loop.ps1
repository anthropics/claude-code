#Requires -Version 5.1
<#
.SYNOPSIS
    Ralph Loop Setup Script (Windows Port)
    Creates state file for in-session Ralph loop

.DESCRIPTION
    Windows PowerShell port of the original setup-ralph-loop.sh
    Ported by Richard Moore (Starrtec)

.PARAMETER Prompt
    The task prompt for the Ralph loop (can be multiple words)

.PARAMETER MaxIterations
    Maximum iterations before auto-stop (default: 0 = unlimited)

.PARAMETER CompletionPromise
    Promise phrase that signals completion

.PARAMETER Help
    Show help message

.EXAMPLE
    setup-ralph-loop.ps1 "Build a todo API" -MaxIterations 20 -CompletionPromise "DONE"
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$PromptParts,

    [Alias('max-iterations')]
    [int]$MaxIterations = 0,

    [Alias('completion-promise')]
    [string]$CompletionPromise = $null,

    [Alias('h')]
    [switch]$Help
)

if ($Help) {
    @"
Ralph Loop - Interactive self-referential development loop (Windows)

USAGE:
  /ralph-loop [PROMPT...] [OPTIONS]

ARGUMENTS:
  PROMPT...    Initial prompt to start the loop (can be multiple words)

OPTIONS:
  -MaxIterations <n>         Maximum iterations before auto-stop (default: unlimited)
  -CompletionPromise <text>  Promise phrase (signals completion)
  -Help                      Show this help message

DESCRIPTION:
  Starts a Ralph Wiggum loop in your CURRENT session. The stop hook prevents
  exit and feeds your output back as input until completion or iteration limit.

  To signal completion, you must output: <promise>YOUR_PHRASE</promise>

  Use this for:
  - Interactive iteration where you want to see progress
  - Tasks requiring self-correction and refinement
  - Learning how Ralph works

EXAMPLES:
  /ralph-loop Build a todo API -CompletionPromise 'DONE' -MaxIterations 20
  /ralph-loop -MaxIterations 10 Fix the auth bug
  /ralph-loop Refactor cache layer  (runs forever)
  /ralph-loop -CompletionPromise 'TASK COMPLETE' Create a REST API

STOPPING:
  Only by reaching -MaxIterations or detecting -CompletionPromise
  No manual stop - Ralph runs infinitely by default!

MONITORING:
  # View current iteration:
  Get-Content .claude/ralph-loop.local.md | Select-String 'iteration:'

  # View full state:
  Get-Content .claude/ralph-loop.local.md | Select-Object -First 10
"@
    exit 0
}

# Join all prompt parts
$Prompt = ($PromptParts -join ' ').Trim()

# Validate prompt is non-empty
if ([string]::IsNullOrWhiteSpace($Prompt)) {
    Write-Host @"
Error: No prompt provided

   Ralph needs a task description to work on.

   Examples:
     /ralph-loop Build a REST API for todos
     /ralph-loop Fix the auth bug -MaxIterations 20
     /ralph-loop -CompletionPromise 'DONE' Refactor code

   For all options: /ralph-loop -Help
"@ -ForegroundColor Red
    exit 1
}

# Validate MaxIterations
if ($MaxIterations -lt 0) {
    Write-Host "Error: -MaxIterations must be 0 or positive, got: $MaxIterations" -ForegroundColor Red
    exit 1
}

# Create .claude directory if needed
if (-not (Test-Path ".claude")) {
    New-Item -ItemType Directory -Path ".claude" -Force | Out-Null
}

# Format completion promise for YAML
if ($CompletionPromise) {
    $completionPromiseYaml = "`"$CompletionPromise`""
} else {
    $completionPromiseYaml = "null"
}

# Get current UTC timestamp
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# Create state file with YAML frontmatter
$stateContent = @"
---
active: true
iteration: 1
max_iterations: $MaxIterations
completion_promise: $completionPromiseYaml
started_at: "$timestamp"
---

$Prompt
"@

Set-Content -Path ".claude/ralph-loop.local.md" -Value $stateContent -NoNewline

# Format display values
$maxIterDisplay = if ($MaxIterations -gt 0) { $MaxIterations } else { "unlimited" }
$promiseDisplay = if ($CompletionPromise) { "$CompletionPromise (ONLY output when TRUE - do not lie!)" } else { "none (runs forever)" }

# Output setup message
Write-Host @"
Ralph loop activated in this session!

Iteration: 1
Max iterations: $maxIterDisplay
Completion promise: $promiseDisplay

The stop hook is now active. When you try to exit, the SAME PROMPT will be
fed back to you. You'll see your previous work in files, creating a
self-referential loop where you iteratively improve on the same task.

To monitor: Get-Content .claude/ralph-loop.local.md | Select-Object -First 10

WARNING: This loop cannot be stopped manually! It will run infinitely
    unless you set -MaxIterations or -CompletionPromise.

"@ -ForegroundColor Cyan

# Output the initial prompt
Write-Host ""
Write-Host $Prompt

# Display completion promise requirements if set
if ($CompletionPromise) {
    Write-Host @"

===============================================================
CRITICAL - Ralph Loop Completion Promise
===============================================================

To complete this loop, output this EXACT text:
  <promise>$CompletionPromise</promise>

STRICT REQUIREMENTS (DO NOT VIOLATE):
  * Use <promise> XML tags EXACTLY as shown above
  * The statement MUST be completely and unequivocally TRUE
  * Do NOT output false statements to exit the loop
  * Do NOT lie even if you think you should exit

IMPORTANT - Do not circumvent the loop:
  Even if you believe you're stuck, the task is impossible,
  or you've been running too long - you MUST NOT output a
  false promise statement. The loop is designed to continue
  until the promise is GENUINELY TRUE. Trust the process.

  If the loop should stop, the promise statement will become
  true naturally. Do not force it by lying.
===============================================================
"@ -ForegroundColor Yellow
}
