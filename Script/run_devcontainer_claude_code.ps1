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

# Notify script start
Write-Host "--- DevContainer Startup & Connection Script ---"
Write-Host "Using backend: $($Backend)"

# --- Prerequisite Check ---
Write-Host "Checking for required commands..."
try {
    if (-not (Get-Command $Backend -ErrorAction SilentlyContinue)) {
        throw "Required command '$($Backend)' not found."
    }
    Write-Host "- $($Backend) command found."
    if (-not (Get-Command devcontainer -ErrorAction SilentlyContinue)) {
        throw "Required command 'devcontainer' not found."
    }
    Write-Host "- devcontainer command found."
}
catch {
    Write-Error "A required command is not installed or not in your PATH. $($_.Exception.Message)"
    Write-Error "Please ensure both '$Backend' and 'devcontainer' are installed and accessible in your system's PATH."
    exit 1
}


# --- Backend-Specific Initialization ---
if ($Backend -eq 'podman') {
    Write-Host "--- Podman Backend Initialization ---"

    # --- Step 1a: Initialize Podman machine ---
    Write-Host "Initializing Podman machine 'claudeVM'..."
    try {
        & podman machine init claudeVM
        Write-Host "Podman machine 'claudeVM' initialized or already exists."
    } catch {
        Write-Error "Failed to initialize Podman machine: $($_.Exception.Message)"
        exit 1 # Exit script on error
    }

    # --- Step 1b: Start Podman machine ---
    Write-Host "Starting Podman machine 'claudeVM'..."
    try {
        & podman machine start claudeVM -q
        Write-Host "Podman machine started or already running."
    } catch {
        Write-Error "Failed to start Podman machine: $($_.Exception.Message)"
        exit 1
    }

    # --- Step 2: Set default connection ---
    Write-Host "Setting default Podman connection to 'claudeVM'..."
    try {
        & podman system connection default claudeVM
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
    $arguments = @('up', '--workspace-folder', '.')
    if ($Backend -eq 'podman') {
        $arguments += '--docker-path', 'podman'
    }
    & devcontainer @arguments
    Write-Host "DevContainer startup process completed."
} catch {
    Write-Error "Failed to bring up DevContainer: $($_.Exception.Message)"
    exit 1
}

# --- Step 4: Get DevContainer ID ---
Write-Host "Finding the DevContainer ID..."
$currentFolder = (Get-Location).Path

try {
    $containerId = (& $Backend ps --filter "label=devcontainer.local_folder=$currentFolder" --format '{{.ID}}').Trim()
} catch {
    $displayCommand = "$Backend ps --filter `"label=devcontainer.local_folder=$currentFolder`" --format '{{.ID}}'"
    Write-Error "Failed to get container ID (Command: $displayCommand): $($_.Exception.Message)"
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
    & $Backend exec -it $containerId zsh -c 'claude; exec zsh'
    Write-Host "Interactive session ended."
} catch {
    $displayCommand = "$Backend exec -it $containerId zsh -c 'claude; exec zsh'"
    Write-Error "Failed to execute command inside container (Command: $displayCommand): $($_.Exception.Message)"
    exit 1
}

# Notify script completion
Write-Host "--- Script completed ---"