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

function Assert-NativeCommandSucceeded {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Command,

        [Parameter(Mandatory=$true)]
        [int]$ExitCode
    )

    # PowerShell does not turn a native program's nonzero exit code into a
    # catchable exception. The caller passes $LASTEXITCODE immediately after
    # each native command so this script can return the same code to its caller.
    if ($ExitCode -ne 0) {
        # Override a caller-supplied Stop preference so reporting the error cannot
        # jump into an outer catch and replace the native exit code with 1.
        Write-Error "Native command '$Command' failed with exit code $ExitCode." -ErrorAction Continue
        exit $ExitCode
    }
}

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

    $machineName = 'claudeVM'

    # Query once so rerunning the script does not treat an existing or running
    # machine as an initialization/startup failure.
    Write-Host "Checking Podman machine '$machineName'..."
    try {
        $machineListOutput = & podman machine list --format json
        Assert-NativeCommandSucceeded -Command "podman machine list --format json" -ExitCode $LASTEXITCODE

        $machineListJson = ($machineListOutput -join [Environment]::NewLine).Trim()
        if (-not $machineListJson) {
            throw "Podman returned an empty machine list response."
        }

        $machines = @(($machineListJson | ConvertFrom-Json -ErrorAction Stop))
        $matchingMachines = @($machines | Where-Object { $_.Name -eq $machineName })
        if ($matchingMachines.Count -gt 1) {
            throw "Podman returned more than one machine named '$machineName'."
        }

        $machineExists = $matchingMachines.Count -eq 1
        $machineIsRunning = $machineExists -and [bool]$matchingMachines[0].Running
    } catch {
        Write-Error "Failed to inspect Podman machines: $($_.Exception.Message)"
        exit 1
    }

    # --- Step 1a: Initialize Podman machine ---
    if (-not $machineExists) {
        Write-Host "Initializing Podman machine '$machineName'..."
        try {
            & podman machine init $machineName
            Assert-NativeCommandSucceeded -Command "podman machine init $machineName" -ExitCode $LASTEXITCODE
            Write-Host "Podman machine '$machineName' initialized."
        } catch {
            Write-Error "Failed to initialize Podman machine: $($_.Exception.Message)"
            exit 1 # Exit script on error
        }
    } else {
        Write-Host "Podman machine '$machineName' already exists; skipping initialization."
    }

    # --- Step 1b: Start Podman machine ---
    if (-not $machineIsRunning) {
        Write-Host "Starting Podman machine '$machineName'..."
        try {
            & podman machine start $machineName -q
            Assert-NativeCommandSucceeded -Command "podman machine start $machineName -q" -ExitCode $LASTEXITCODE
            Write-Host "Podman machine started."
        } catch {
            Write-Error "Failed to start Podman machine: $($_.Exception.Message)"
            exit 1
        }
    } else {
        Write-Host "Podman machine '$machineName' is already running; skipping startup."
    }

    # --- Step 2: Set default connection ---
    Write-Host "Setting default Podman connection to 'claudeVM'..."
    try {
        & podman system connection default claudeVM
        Assert-NativeCommandSucceeded -Command "podman system connection default claudeVM" -ExitCode $LASTEXITCODE
        Write-Host "Default connection set."
    } catch {
        Write-Error "Failed to set default Podman connection: $($_.Exception.Message)"
        exit 1
    }

} elseif ($Backend -eq 'docker') {
    Write-Host "--- Docker Backend Initialization ---"

    # --- Step 1 & 2: Check Docker Desktop ---
    Write-Host "Checking if Docker Desktop is running and docker command is available..."
    try {
        docker info | Out-Null
        Assert-NativeCommandSucceeded -Command "docker info" -ExitCode $LASTEXITCODE
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
    Assert-NativeCommandSucceeded -Command "devcontainer $($arguments -join ' ')" -ExitCode $LASTEXITCODE
    Write-Host "DevContainer startup process completed."
} catch {
    Write-Error "Failed to bring up DevContainer: $($_.Exception.Message)"
    exit 1
}

# --- Step 4: Get DevContainer ID ---
Write-Host "Finding the DevContainer ID..."
$currentFolder = (Get-Location).Path

try {
    $containerIdOutput = & $Backend ps --filter "label=devcontainer.local_folder=$currentFolder" --format '{{.ID}}'
    Assert-NativeCommandSucceeded -Command "$Backend ps --filter label=devcontainer.local_folder=<workspace> --format {{.ID}}" -ExitCode $LASTEXITCODE
    $containerIds = @(
        (($containerIdOutput -join [Environment]::NewLine) -split '\r?\n') |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ }
    )
} catch {
    $displayCommand = "$Backend ps --filter `"label=devcontainer.local_folder=$currentFolder`" --format '{{.ID}}'"
    Write-Error "Failed to get container ID (Command: $displayCommand): $($_.Exception.Message)"
    exit 1
}

if ($containerIds.Count -eq 0) {
    Write-Error "Could not find DevContainer ID for the current folder ('$currentFolder')."
    Write-Error "Please check if 'devcontainer up' was successful and the container is running."
    exit 1
}

if ($containerIds.Count -gt 1) {
    Write-Error "Expected one DevContainer for the current folder ('$currentFolder'), but found $($containerIds.Count)."
    Write-Error "Remove stale duplicate containers before rerunning this script."
    exit 1
}

$containerId = $containerIds[0]
Write-Host "Found container ID: $containerId"

# --- Step 5 & 6: Execute command and enter interactive shell inside container ---
Write-Host "Executing 'claude' command and then starting zsh session inside container $($containerId)..."
try {
    & $Backend exec -it $containerId zsh -c 'claude || exit $?; exec zsh'
    Assert-NativeCommandSucceeded -Command "$Backend exec -it <container-id> zsh -c <command>" -ExitCode $LASTEXITCODE
    Write-Host "Interactive session ended."
} catch {
    $displayCommand = "$Backend exec -it $containerId zsh -c 'claude || exit `$?; exec zsh'"
    Write-Error "Failed to execute command inside container (Command: $displayCommand): $($_.Exception.Message)"
    exit 1
}

# Notify script completion
Write-Host "--- Script completed ---"
