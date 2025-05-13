#------------------------------------------------------------------------------
# Script: run_devcontainer_claude_code.ps1
# Author: [Your Name or Project Name]
# Description: Automates the setup and connection to a DevContainer environment
#              using either Docker or Podman on Windows.
#
# IMPORTANT USAGE REQUIREMENT:
# This script MUST be executed from the ROOT directory of your project.
# It assumes the script file itself is located in a 'Script' subdirectory.
#
# Assumed Project Structure:
# Project/
# ├── .devcontainer/
# └── Script/
#     └── run_devcontainer_claude_code.ps1  <-- This script's location
#
# How to Run:
# 1. Open PowerShell.
# 2. Change your current directory to the project root:
#    cd c:\path\to\your\Project
# 3. Execute the script, specifying the container backend:
#    .\Script\run_devcontainer_claude_code.ps1 -Backend <docker|podman>
#
# The -Backend parameter is mandatory and accepts 'docker' or 'podman'.
#------------------------------------------------------------------------------
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Backend
)

# Notify script start
Write-Host "--- DevContainer Startup & Connection Script ---"
Write-Host "Using backend: $($Backend)"

# Validate the input backend
if ($Backend -notin @('docker', 'podman')) {
    Write-Error "Invalid backend specified. Please use 'docker' or 'podman'."
    Write-Host "Usage: ." + $MyInvocation.MyCommand.Definition + " -Backend <docker|podman>"
    exit 1
}

# --- Backend-Specific Initialization ---
if ($Backend -eq 'podman') {
    Write-Host "--- Podman Backend Initialization ---"

    # --- Step 1a: Initialize Podman machine ---
    Write-Host "Initializing Podman machine 'claudeVM'..."
    try {
        podman machine init claudeVM
        Write-Host "Podman machine 'claudeVM' initialized or already exists."
    } catch {
        Write-Error "Failed to initialize Podman machine: $($_.Exception.Message)"
        exit 1 # Exit script on error
    }

    # --- Step 1b: Start Podman machine ---
    Write-Host "Starting Podman machine 'claudeVM'..."
    try {
        podman machine start claudeVM -q
        Write-Host "Podman machine started or already running."
    } catch {
        Write-Error "Failed to start Podman machine: $($_.Exception.Message)"
        exit 1
    }

    # --- Step 2: Set default connection ---
    Write-Host "Setting default Podman connection to 'claudeVM'..."
    try {
        podman system connection default claudeVM
        Write-Host "Default connection set."
    } catch {
        Write-Warning "Failed to set default Podman connection (may be already set or machine issue): $($_.Exception.Message)"
    }

} elseif ($Backend -eq 'docker') {
    Write-Host "--- Docker Backend Initialization ---"

    # --- Step 1 & 2: Check Docker Desktop ---
    Write-Host "Checking if Docker Desktop is running and docker command is available..."
    try {
        docker info | Out-Null
        Write-Host "Docker Desktop (daemon) is running."
    } catch {
        Write-Error "Docker Desktop is not running or docker command not found."
        Write-Error "Please ensure Docker Desktop is running."
        exit 1
    }
}

# --- Step 3: Bring up DevContainer ---
Write-Host "Bringing up DevContainer in the current folder..."
try {
    $devcontainerUpCommand = "devcontainer up --workspace-folder ."
    if ($Backend -eq 'podman') {
        $devcontainerUpCommand += " --docker-path podman"
    }
    Invoke-Expression $devcontainerUpCommand
    Write-Host "DevContainer startup process completed."
} catch {
    Write-Error "Failed to bring up DevContainer: $($_.Exception.Message)"
    exit 1
}

# --- Step 4: Get DevContainer ID ---
Write-Host "Finding the DevContainer ID..."
$currentFolder = (Get-Location).Path

$psCommand = "$($Backend) ps --filter ""label=devcontainer.local_folder=$currentFolder"" --format ""{{.ID}}"""

try {
    $containerId = $(Invoke-Expression $psCommand).Trim()
} catch {
    Write-Error "Failed to get container ID (Command: $psCommand): $($_.Exception.Message)"
    exit 1
}

if (-not $containerId) {
    Write-Error "Could not find DevContainer ID for the current folder ('$currentFolder')."
    Write-Error "Please check if 'devcontainer up' was successful and the container is running."
    exit 1
}
Write-Host "Found container ID: $containerId"

# --- Step 5 & 6: Execute command and enter interactive shell inside container ---
Write-Host "Executing 'claude' command and then starting zsh session inside container $($containerId)..."
try {
    $execCommand = "$($Backend) exec -it $containerId zsh -c 'claude; exec zsh'"
    Invoke-Expression $execCommand

    Write-Host "Interactive session ended."

} catch {
    Write-Error "Failed to execute command inside container (Command: $execCommand): $($_.Exception.Message)"
    exit 1
}

# Notify script completion
Write-Host "--- Script completed ---"