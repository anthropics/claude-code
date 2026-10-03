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
    # A non-zero exit here usually just means the machine already exists, so this
    # is intentionally tolerated rather than fatal.
    Write-Host "Initializing Podman machine 'claudeVM'..."
    & podman machine init claudeVM
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "'podman machine init claudeVM' exited with code $LASTEXITCODE (the machine may already exist). Continuing."
    } else {
        Write-Host "Podman machine 'claudeVM' initialized."
    }

    # --- Step 1b: Start Podman machine ---
    # Likewise tolerated: starting an already-running machine exits non-zero.
    Write-Host "Starting Podman machine 'claudeVM'..."
    & podman machine start claudeVM -q
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "'podman machine start claudeVM' exited with code $LASTEXITCODE (the machine may already be running). Continuing."
    } else {
        Write-Host "Podman machine started."
    }

    # --- Step 2: Set default connection ---
    Write-Host "Setting default Podman connection to 'claudeVM'..."
    & podman system connection default claudeVM
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set default Podman connection (exit code $LASTEXITCODE); it may already be set."
    } else {
        Write-Host "Default connection set."
    }

} elseif ($Backend -eq 'docker') {
    Write-Host "--- Docker Backend Initialization ---"

    # --- Step 1 & 2: Check Docker Desktop ---
    Write-Host "Checking if Docker Desktop is running and docker command is available..."
    & docker info | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker Desktop is not running or docker command not found (exit code $LASTEXITCODE)."
        Write-Error "Please ensure Docker Desktop is running."
        exit 1
    }
    Write-Host "Docker Desktop (daemon) is running."
}

# --- Step 3: Bring up DevContainer ---
Write-Host "Bringing up DevContainer in the current folder..."
$arguments = @('up', '--workspace-folder', '.')
if ($Backend -eq 'podman') {
    $arguments += '--docker-path', 'podman'
}
& devcontainer @arguments
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to bring up DevContainer (Command: devcontainer $($arguments -join ' ') - exit code $LASTEXITCODE)."
    exit 1
}
Write-Host "DevContainer startup process completed."

# --- Step 4: Get DevContainer ID ---
Write-Host "Finding the DevContainer ID..."
$currentFolder = (Get-Location).Path
$displayCommand = "$Backend ps --filter `"label=devcontainer.local_folder=$currentFolder`" --format '{{.ID}}'"

# Note: no .Trim() here - when nothing matches, the command emits no output and
# calling a method on the resulting $null would throw before the check below.
$containerId = & $Backend ps --filter "label=devcontainer.local_folder=$currentFolder" --format '{{.ID}}'
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to get container ID (Command: $displayCommand - exit code $LASTEXITCODE)."
    exit 1
}

# Multiple matches would otherwise be passed on as an array and break 'exec'.
$containerId = ($containerId | Select-Object -First 1)
if ([string]::IsNullOrWhiteSpace($containerId)) {
    Write-Error "Could not find DevContainer ID for the current folder ('$currentFolder')."
    Write-Error "Please check if 'devcontainer up' was successful and the container is running."
    exit 1
}
$containerId = $containerId.Trim()
Write-Host "Found container ID: $containerId"

# --- Step 5 & 6: Execute command and enter interactive shell inside container ---
Write-Host "Executing 'claude' command and then starting zsh session inside container $($containerId)..."
& $Backend exec -it $containerId zsh -c 'claude; exec zsh'
if ($LASTEXITCODE -ne 0) {
    $displayCommand = "$Backend exec -it $containerId zsh -c 'claude; exec zsh'"
    Write-Error "Failed to execute command inside container (Command: $displayCommand - exit code $LASTEXITCODE)."
    exit 1
}
Write-Host "Interactive session ended."

# Notify script completion
Write-Host "--- Script completed ---"