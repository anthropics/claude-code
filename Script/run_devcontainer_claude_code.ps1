<#
.SYNOPSIS
    Automates the setup and connection to an advanced DevContainer environment using either Docker or Podman on Windows.

.DESCRIPTION
    This script automates the process of initializing, starting, and connecting to a DevContainer
    with experimental features enabled, using either Docker or Podman as the container backend. 
    It includes options for enabling various feature sets and customizing the development environment.
    The script must be executed from the root directory of your project and assumes the script 
    is located in a 'Script' subdirectory.

.PARAMETER Backend
    Specifies the container backend to use. Valid values are 'docker' or 'podman'.

.PARAMETER EnableExperimental
    Enable experimental features in Claude Code and development tools. Default: $true

.PARAMETER EnableAlpha
    Enable alpha features for cutting-edge functionality. Default: $true

.PARAMETER EnableBeta
    Enable beta features for enhanced capabilities. Default: $true

.PARAMETER InstallAdvancedTools
    Install additional advanced development tools. Default: $true

.PARAMETER ClaudeVersion
    Specify the Claude Code version to install. Default: "1.0.108"

.PARAMETER RebuildContainer
    Force rebuild of the container even if it exists. Default: $false

.EXAMPLE
    .\Script\run_devcontainer_claude_code.ps1 -Backend docker
    Uses Docker with all experimental features enabled.

.EXAMPLE
    .\Script\run_devcontainer_claude_code.ps1 -Backend podman -EnableExperimental $false
    Uses Podman with experimental features disabled.

.EXAMPLE
    .\Script\run_devcontainer_claude_code.ps1 -Backend docker -ClaudeVersion "latest" -RebuildContainer $true
    Uses Docker, installs latest Claude Code, and forces container rebuild.

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
    [string]$Backend,
    
    [Parameter(Mandatory=$false)]
    [bool]$EnableExperimental = $true,
    
    [Parameter(Mandatory=$false)]
    [bool]$EnableAlpha = $true,
    
    [Parameter(Mandatory=$false)]
    [bool]$EnableBeta = $true,
    
    [Parameter(Mandatory=$false)]
    [bool]$InstallAdvancedTools = $true,
    
    [Parameter(Mandatory=$false)]
    [string]$ClaudeVersion = "1.0.108",
    
    [Parameter(Mandatory=$false)]
    [bool]$RebuildContainer = $false
)

# Notify script start
Write-Host "--- Advanced DevContainer Startup & Connection Script ---" -ForegroundColor Cyan
Write-Host "Using backend: $($Backend)" -ForegroundColor Green
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  - Experimental Features: $EnableExperimental" -ForegroundColor Gray
Write-Host "  - Alpha Features: $EnableAlpha" -ForegroundColor Gray
Write-Host "  - Beta Features: $EnableBeta" -ForegroundColor Gray
Write-Host "  - Advanced Tools: $InstallAdvancedTools" -ForegroundColor Gray
Write-Host "  - Claude Version: $ClaudeVersion" -ForegroundColor Gray
Write-Host "  - Rebuild Container: $RebuildContainer" -ForegroundColor Gray

# --- Prerequisite Check ---
Write-Host "Checking for required commands..."
try {
    Get-Command $Backend -ErrorAction Stop | Out-Null
    Write-Host "- $($Backend) command found."
    Get-Command devcontainer -ErrorAction Stop | Out-Null
    Write-Host "- devcontainer command found."
}
catch {
    Write-Error "A required command is not installed or not in your PATH."
    Write-Error "Please ensure '$($_.Exception.Message.Split(':')[0])' and 'devcontainer' are installed and accessible."
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

# --- Step 3: Bring up DevContainer with advanced options ---
Write-Host "Bringing up Advanced DevContainer in the current folder..." -ForegroundColor Cyan

# Set environment variables for build args
$env:ENABLE_EXPERIMENTAL_FEATURES = $EnableExperimental.ToString().ToLower()
$env:ENABLE_ALPHA_FEATURES = $EnableAlpha.ToString().ToLower()
$env:ENABLE_BETA_FEATURES = $EnableBeta.ToString().ToLower()
$env:INSTALL_ADVANCED_TOOLS = $InstallAdvancedTools.ToString().ToLower()
$env:CLAUDE_CODE_VERSION = $ClaudeVersion

try {
    $arguments = @('up', '--workspace-folder', '.')
    
    if ($Backend -eq 'podman') {
        $arguments += '--docker-path', 'podman'
    }
    
    if ($RebuildContainer) {
        $arguments += '--rebuild'
        Write-Host "Forcing container rebuild..." -ForegroundColor Yellow
    }
    
    Write-Host "Executing: devcontainer $($arguments -join ' ')" -ForegroundColor Gray
    & devcontainer @arguments
    Write-Host "DevContainer startup process completed." -ForegroundColor Green
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
Write-Host "Executing 'claude' command with experimental features and starting zsh session..." -ForegroundColor Cyan
Write-Host "Container ID: $containerId" -ForegroundColor Gray

# Create a welcome script for the container
$welcomeScript = @"
echo "=== Advanced Claude Code Development Environment ==="
echo "🚀 Experimental Features: $EnableExperimental"
echo "🔬 Alpha Features: $EnableAlpha"  
echo "🧪 Beta Features: $EnableBeta"
echo "🛠️  Advanced Tools: $InstallAdvancedTools"
echo "📦 Claude Version: $ClaudeVersion"
echo ""
echo "Available commands:"
echo "  claude          - Start Claude Code"
echo "  lazygit         - Advanced Git UI (if enabled)"
echo "  gh copilot      - GitHub Copilot CLI (if enabled)"
echo "  starship        - Modern shell prompt (if enabled)"
echo ""
echo "Starting Claude Code..."
claude
echo ""
echo "Welcome to your advanced development environment!"
echo "Type 'exit' to leave this session."
exec zsh
"@

try {
    $welcomeScript | & $Backend exec -i $containerId sh -c 'cat > /tmp/welcome.sh && chmod +x /tmp/welcome.sh'
    & $Backend exec -it $containerId zsh -c '/tmp/welcome.sh'
    Write-Host "Interactive session ended." -ForegroundColor Green
} catch {
    $displayCommand = "$Backend exec -it $containerId zsh -c '/tmp/welcome.sh'"
    Write-Error "Failed to execute command inside container (Command: $displayCommand): $($_.Exception.Message)"
    exit 1
}

# Notify script completion
Write-Host "--- Script completed ---"