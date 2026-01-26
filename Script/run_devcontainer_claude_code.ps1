<#
.SYNOPSIS
    Automates the setup and connection to a DevContainer environment using either Docker or Podman on Windows.

.DESCRIPTION
    This script automates the process of initializing, starting, and connecting to a DevContainer
    using either Docker or Podman as the container backend. It must be executed from the root
    directory of your project and assumes the script is located in a 'Script' subdirectory.

.PARAMETER Backend
    Specifies the container backend to use. Valid values are 'docker' or 'podman'.

.EXAMPLE
    .\Script\run_devcontainer_claude_code.ps1 -Backend docker
    Uses Docker as the container backend.

.EXAMPLE
    .\Script\run_devcontainer_claude_code.ps1 -Backend podman
    Uses Podman as the container backend.

.NOTES
    Project Structure:
    Project/
    ├── .devcontainer/
    └── Script/
        └── run_devcontainer_claude_code.ps1
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('docker','podman')]
    [string]$Backend
)

# Set error handling
$ErrorActionPreference = 'Stop'

# Notify script start
Write-Host "--- DevContainer Startup & Connection Script ---"
Write-Host "Using backend: $Backend"

# --- Prerequisite Check ---
Write-Host "Checking for required commands..."

if (-not (Get-Command $Backend -ErrorAction SilentlyContinue)) {
    Write-Error "Required command '$Backend' not found."
    Write-Error "Please ensure '$Backend' is installed and accessible in your system's PATH."
    exit 1
}
Write-Host "- $Backend command found."

if (-not (Get-Command devcontainer -ErrorAction SilentlyContinue)) {
    Write-Error "Required command 'devcontainer' not found."
    Write-Error "Please ensure 'devcontainer' CLI is installed and accessible in your system's PATH."
    exit 1
}
Write-Host "- devcontainer command found."

# --- Validate .devcontainer directory exists ---
if (-not (Test-Path ".devcontainer")) {
    Write-Error "No .devcontainer directory found in current folder."
    Write-Error "Please ensure you're running this from the project root."
    exit 1
}
Write-Host "- .devcontainer directory found."

# --- Backend-Specific Initialization ---
if ($Backend -eq 'podman') {
    Write-Host "--- Podman Backend Initialization ---"

    # --- Step 1a: Check if Podman machine exists, initialize if not ---
    Write-Host "Checking for Podman machine 'claudeVM'..."
    $existingMachines = & podman machine list --format '{{.Name}}' 2>$null
    $machineExists = $existingMachines -contains 'claudeVM'
    
    if (-not $machineExists) {
        Write-Host "Initializing Podman machine 'claudeVM'..."
        & podman machine init claudeVM 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to initialize Podman machine 'claudeVM'."
            exit 1
        }
        Write-Host "Podman machine 'claudeVM' initialized."
    } else {
        Write-Host "Podman machine 'claudeVM' already exists."
    }

    # --- Step 1b: Start Podman machine if not running ---
    Write-Host "Checking Podman machine state..."
    $machineInfoJson = & podman machine inspect claudeVM 2>$null
    $inspectExitCode = $LASTEXITCODE
    $machineInfo = $null
    if ($inspectExitCode -ne 0) {
        Write-Error "Failed to inspect Podman machine 'claudeVM'. Exit code: $inspectExitCode"
        exit 1
    }
    if (-not [string]::IsNullOrWhiteSpace($machineInfoJson)) {
        try {
            $machineInfo = $machineInfoJson | ConvertFrom-Json
        } catch {
            Write-Error "Failed to parse 'podman machine inspect claudeVM' output as JSON: $_"
            exit 1
        }
    } else {
        Write-Error "Received empty output from 'podman machine inspect claudeVM'."
        exit 1
    }
    $machineState = if ($machineInfo) { $machineInfo.State } else { $null }
    
    if ($machineState -ne 'running') {
        Write-Host "Starting Podman machine 'claudeVM'..."
        & podman machine start -q claudeVM 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start Podman machine 'claudeVM'."
            exit 1
        }
        Write-Host "Podman machine 'claudeVM' started."
    } else {
        Write-Host "Podman machine 'claudeVM' is already running."
    }

    # --- Step 2: Set default connection ---
    Write-Host "Setting default Podman connection to 'claudeVM'..."
    & podman system connection default claudeVM 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set default Podman connection (may be already set)."
    } else {
        Write-Host "Default connection set."
    }

} elseif ($Backend -eq 'docker') {
    Write-Host "--- Docker Backend Initialization ---"

    # --- Step 1 & 2: Check Docker Desktop ---
    Write-Host "Checking if Docker Desktop is running..."
    & docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker Desktop is not running or docker command not functional."
        Write-Error "Please ensure Docker Desktop is running."
        exit 1
    }
    Write-Host "Docker Desktop (daemon) is running."
}

# --- Step 3: Bring up DevContainer ---
Write-Host "Bringing up DevContainer in the current folder..."

$arguments = @('up', '--workspace-folder', '.')
if ($Backend -eq 'podman') {
    $arguments += @('--docker-path', 'podman')
}

& devcontainer @arguments 2>&1 | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to bring up DevContainer."
    exit 1
}
Write-Host "DevContainer startup process completed."

# --- Step 4: Get DevContainer ID ---
Write-Host "Finding the DevContainer ID..."
$currentFolder = (Get-Location).Path

# Use a variable for the filter to handle paths with spaces correctly
$filterLabel = "label=devcontainer.local_folder=$currentFolder"
$containerOutput = & $Backend ps --filter $filterLabel --format '{{.ID}}' 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to query container list."
    Write-Error "Command output: $containerOutput"
    exit 1
}

$containerId = ($containerOutput | Select-Object -First 1)
if ($containerId) {
    $containerId = $containerId.Trim()
}

if (-not $containerId) {
    Write-Error "Could not find DevContainer ID for the current folder ('$currentFolder')."
    Write-Error "Please check if 'devcontainer up' was successful and the container is running."
    Write-Host "Debug: Running containers with devcontainer labels:"
    & $Backend ps --filter "label=devcontainer.local_folder" --format 'ID={{.ID}} Labels={{.Labels}}'
    exit 1
}
Write-Host "Found container ID: $containerId"

# --- Step 5 & 6: Execute command and enter interactive shell inside container ---
Write-Host "Executing 'claude' command and then starting zsh session inside container $containerId..."

# Check if running in interactive mode
if ([Environment]::UserInteractive -and $Host.UI.RawUI.KeyAvailable -ne $null) {
    & $Backend exec -it $containerId zsh -c 'claude; exec zsh'
    $execExitCode = $LASTEXITCODE
} else {
    Write-Warning "Non-interactive environment detected. Running without -it flags."
    & $Backend exec $containerId zsh -c 'claude'
    $execExitCode = $LASTEXITCODE
}

if ($execExitCode -ne 0) {
    Write-Error "Command inside container exited with code: $execExitCode"
    exit 1
}

Write-Host "Interactive session ended."

# Notify script completion
Write-Host "--- Script completed ---"

