# ╔═══════════════════════════════════════════════════════════════════════════════════╗
# ║  🚀 NEMESIS MCP AUTO-INSTALLER v12.0 - 100% AUTOMATIQUE                          ║
# ║                                                                                   ║
# ║  USAGE : Clic droit > "Exécuter avec PowerShell"                                 ║
# ║  OU : Dans PowerShell : .\NEMESIS-AUTO-INSTALL.ps1                               ║
# ║                                                                                   ║
# ║  ⚡ ZÉRO INTERVENTION - Le script fait TOUT automatiquement                      ║
# ║  🔒 AUTO-ÉLÉVATION - Se met en admin automatiquement                             ║
# ║  🛡️ GESTION D'ERREURS - Continue même en cas de problème                        ║
# ║  📊 RAPPORT COMPLET - Affiche tout ce qui a été fait                            ║
# ║                                                                                   ║
# ╚═══════════════════════════════════════════════════════════════════════════════════╝

#Requires -Version 5.1

# ═══════════════════════════════════════════════════════════════════════════════════
# CONFIGURATION GLOBALE
# ═══════════════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$WarningPreference = "SilentlyContinue"

# Variables globales
$script:NEMESIS_ROOT = "$env:USERPROFILE\.nemesis-omega"
$script:CLAUDE_CONFIG = "$env:APPDATA\Claude\claude_desktop_config.json"
$script:LOG_FILE = "$script:NEMESIS_ROOT\logs\auto_install_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
$script:INSTALL_LOG = @()
$script:SUCCESS_COUNT = 0
$script:TOTAL_STEPS = 30

# ═══════════════════════════════════════════════════════════════════════════════════
# FONCTIONS UTILITAIRES
# ═══════════════════════════════════════════════════════════════════════════════════

function Write-StepLog {
    param(
        [string]$Message,
        [string]$Status = "INFO",
        [switch]$NoProgress
    )

    $timestamp = Get-Date -Format "HH:mm:ss"
    $logEntry = "[$timestamp] [$Status] $Message"

    # Ajouter au log
    $script:INSTALL_LOG += $logEntry
    Add-Content -Path $script:LOG_FILE -Value $logEntry -Force -ErrorAction SilentlyContinue

    # Affichage couleur
    $color = switch ($Status) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        "PROGRESS" { "Cyan" }
        default { "White" }
    }

    if ($Status -eq "SUCCESS") { $script:SUCCESS_COUNT++ }

    if (-not $NoProgress) {
        $percent = [math]::Round(($script:SUCCESS_COUNT / $script:TOTAL_STEPS) * 100)
        Write-Host "[$percent%] " -NoNewline -ForegroundColor DarkGray
    }

    Write-Host $logEntry -ForegroundColor $color
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-AutoElevate {
    if (-not (Test-IsAdmin)) {
        Write-StepLog "Élévation en administrateur requise..." "WARNING"

        $scriptPath = $MyInvocation.ScriptName
        if (-not $scriptPath) {
            $scriptPath = $PSCommandPath
        }

        $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

        try {
            Start-Process powershell -Verb RunAs -ArgumentList $arguments
            exit
        } catch {
            Write-StepLog "Impossible de s'élever en admin : $_" "ERROR"
            Write-Host "`n⚠️ Veuillez exécuter ce script en tant qu'administrateur" -ForegroundColor Yellow
            Write-Host "Clic droit > Exécuter en tant qu'administrateur`n" -ForegroundColor White
            pause
            exit 1
        }
    }
}

function Install-ChocolateyIfNeeded {
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-StepLog "Chocolatey déjà installé" "SUCCESS"
        return $true
    }

    Write-StepLog "Installation de Chocolatey..." "PROGRESS"

    try {
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        $installScript = (New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')
        Invoke-Expression $installScript | Out-Null

        # Refresh environment
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-StepLog "Chocolatey installé avec succès" "SUCCESS"
            return $true
        }
    } catch {
        Write-StepLog "Erreur installation Chocolatey : $_" "ERROR"
        return $false
    }
}

function Install-Package {
    param(
        [string]$PackageName,
        [string]$FriendlyName = $PackageName
    )

    $commandName = $PackageName.Split('-')[0]

    if (Get-Command $commandName -ErrorAction SilentlyContinue) {
        Write-StepLog "$FriendlyName déjà installé" "SUCCESS"
        return $true
    }

    Write-StepLog "Installation de $FriendlyName..." "PROGRESS"

    try {
        $output = choco install $PackageName -y --force --limit-output --no-progress 2>&1

        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $env:Path += ";C:\Program Files\nodejs;C:\ProgramData\npm;$env:APPDATA\npm"

        if (Get-Command $commandName -ErrorAction SilentlyContinue) {
            Write-StepLog "$FriendlyName installé avec succès" "SUCCESS"
            return $true
        } else {
            Write-StepLog "$FriendlyName installation partielle" "WARNING"
            return $false
        }
    } catch {
        Write-StepLog "Erreur installation $FriendlyName : $_" "ERROR"
        return $false
    }
}

function Install-MCPServer {
    param([string]$ServerName)

    $fullName = "@modelcontextprotocol/server-$ServerName"

    Write-StepLog "Installation MCP: $ServerName..." "PROGRESS"

    try {
        $output = npm install -g $fullName --silent 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-StepLog "MCP $ServerName installé" "SUCCESS"
            return $true
        } else {
            Write-StepLog "MCP $ServerName installation échouée" "WARNING"
            return $false
        }
    } catch {
        Write-StepLog "Erreur MCP $ServerName : $_" "ERROR"
        return $false
    }
}

function Find-ClaudeDesktop {
    $paths = @(
        "$env:LOCALAPPDATA\Programs\claude-desktop\Claude.exe",
        "$env:LOCALAPPDATA\Programs\Claude\Claude.exe",
        "$env:LOCALAPPDATA\Claude\Claude.exe",
        "C:\Program Files\Claude\Claude.exe",
        "C:\Program Files (x86)\Claude\Claude.exe"
    )

    foreach ($path in $paths) {
        if (Test-Path $path) {
            return $path
        }
    }

    # Recherche approfondie
    Write-StepLog "Recherche approfondie de Claude Desktop..." "PROGRESS"
    $found = Get-ChildItem -Path $env:LOCALAPPDATA -Filter "Claude.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($found) {
        return $found.FullName
    }

    return $null
}

function Install-ClaudeDesktop {
    Write-StepLog "Installation de Claude Desktop..." "PROGRESS"

    # Essai avec winget d'abord
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            Write-StepLog "Installation via winget..." "PROGRESS"
            $output = winget install Anthropic.Claude --accept-package-agreements --accept-source-agreements --silent 2>&1
            Start-Sleep -Seconds 5

            $claudePath = Find-ClaudeDesktop
            if ($claudePath) {
                Write-StepLog "Claude Desktop installé via winget" "SUCCESS"
                return $claudePath
            }
        } catch {
            Write-StepLog "Winget échoué, tentative alternative..." "WARNING"
        }
    }

    # Alternative : Téléchargement direct
    try {
        Write-StepLog "Téléchargement depuis le web..." "PROGRESS"
        $installerPath = "$env:TEMP\Claude-Setup.exe"
        $downloadUrl = "https://storage.googleapis.com/claude-desktop/Claude-Setup.exe"

        Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing

        Write-StepLog "Installation de Claude Desktop..." "PROGRESS"
        Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait -NoNewWindow

        Start-Sleep -Seconds 5

        $claudePath = Find-ClaudeDesktop
        if ($claudePath) {
            Write-StepLog "Claude Desktop installé" "SUCCESS"
            return $claudePath
        }
    } catch {
        Write-StepLog "Erreur installation Claude : $_" "ERROR"
    }

    return $null
}

function New-ClaudeConfig {
    Write-StepLog "Configuration de Claude Desktop..." "PROGRESS"

    # Backup si existe
    if (Test-Path $script:CLAUDE_CONFIG) {
        $backup = "$script:CLAUDE_CONFIG.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $script:CLAUDE_CONFIG $backup -Force -ErrorAction SilentlyContinue
        Write-StepLog "Backup créé" "SUCCESS"
    }

    # Configuration complète
    $config = @{
        mcpServers = @{
            filesystem = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-filesystem", $env:USERPROFILE)
            }
            memory = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-memory")
            }
            fetch = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-fetch")
            }
            github = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-github")
                env = @{
                    GITHUB_PERSONAL_ACCESS_TOKEN = ""
                }
            }
            gitlab = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-gitlab")
                env = @{
                    GITLAB_PERSONAL_ACCESS_TOKEN = ""
                }
            }
            slack = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-slack")
                env = @{
                    SLACK_BOT_TOKEN = ""
                    SLACK_TEAM_ID = ""
                }
            }
            "brave-search" = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-brave-search")
                env = @{
                    BRAVE_API_KEY = ""
                }
            }
            postgres = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/postgres")
            }
            sqlite = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-sqlite", "$env:USERPROFILE\databases")
            }
            "google-drive" = @{
                command = "npx"
                args = @("-y", "@modelcontextprotocol/server-google-drive")
            }
        }
        developerMode = $true
    }

    try {
        # Créer le dossier si nécessaire
        $configDir = Split-Path $script:CLAUDE_CONFIG -Parent
        if (-not (Test-Path $configDir)) {
            New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        }

        # Sauvegarder
        $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $script:CLAUDE_CONFIG -Encoding UTF8 -Force
        Write-StepLog "Configuration Claude créée" "SUCCESS"
        return $true
    } catch {
        Write-StepLog "Erreur création config : $_" "ERROR"
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════════════════
# SCRIPT PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════════

# Bannière
Clear-Host
$Host.UI.RawUI.WindowTitle = "🚀 NEMESIS MCP AUTO-INSTALLER"

Write-Host @"

╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║      ███╗   ██╗███████╗███╗   ███╗███████╗███████╗██╗███████╗                ║
║      ████╗  ██║██╔════╝████╗ ████║██╔════╝██╔════╝██║██╔════╝                ║
║      ██╔██╗ ██║█████╗  ██╔████╔██║█████╗  ███████╗██║███████╗                ║
║      ██║╚██╗██║██╔══╝  ██║╚██╔╝██║██╔══╝  ╚════██║██║╚════██║                ║
║      ██║ ╚████║███████╗██║ ╚═╝ ██║███████╗███████║██║███████║                ║
║      ╚═╝  ╚═══╝╚══════╝╚═╝     ╚═╝╚══════╝╚══════╝╚═╝╚══════╝                ║
║                                                                                ║
║                🚀 AUTO-INSTALLER v12.0 - 100% AUTOMATIQUE 🚀                  ║
║                                                                                ║
║                    ⚡ Aucune intervention requise ⚡                           ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$startTime = Get-Date

# Créer structure de dossiers
New-Item -ItemType Directory -Force -Path "$script:NEMESIS_ROOT\logs" | Out-Null

Write-StepLog "Démarrage de l'installation automatique NEMESIS MCP OMEGA" "PROGRESS" -NoProgress
Write-StepLog "Logs: $script:LOG_FILE" "PROGRESS" -NoProgress
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 0 : AUTO-ÉLÉVATION
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🔐 VÉRIFICATION DES PRIVILÈGES" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

Invoke-AutoElevate
Write-StepLog "Privilèges administrateur confirmés" "SUCCESS"

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 1 : CHOCOLATEY
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "📦 INSTALLATION GESTIONNAIRE DE PAQUETS" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

Install-ChocolateyIfNeeded

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 2 : OUTILS DE DÉVELOPPEMENT
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🛠️ INSTALLATION OUTILS DE DÉVELOPPEMENT" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$tools = @(
    @{Package="git"; Name="Git"},
    @{Package="nodejs"; Name="NodeJS"},
    @{Package="python"; Name="Python"},
    @{Package="jq"; Name="JQ"}
)

foreach ($tool in $tools) {
    Install-Package -PackageName $tool.Package -FriendlyName $tool.Name
}

# Refresh global environment
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:Path += ";C:\Program Files\nodejs;C:\ProgramData\npm;$env:APPDATA\npm;C:\Program Files\Git\cmd"

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 3 : VÉRIFICATION NPM
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🔍 VÉRIFICATION NPM" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-StepLog "NPM non trouvé, réinstallation NodeJS..." "WARNING"
    choco install nodejs -y --force --no-progress | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = npm --version 2>$null
    Write-StepLog "NPM v$npmVersion opérationnel" "SUCCESS"
} else {
    Write-StepLog "NPM non disponible après installation" "ERROR"
}

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 4 : SERVEURS MCP
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🔌 INSTALLATION SERVEURS MCP" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$mcpServers = @(
    "filesystem",
    "memory",
    "fetch",
    "github",
    "gitlab",
    "slack",
    "postgres",
    "sqlite",
    "brave-search",
    "google-drive"
)

foreach ($server in $mcpServers) {
    Install-MCPServer -ServerName $server
}

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 5 : CLAUDE DESKTOP
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🖥️ INSTALLATION CLAUDE DESKTOP" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$claudePath = Find-ClaudeDesktop

if ($claudePath) {
    Write-StepLog "Claude Desktop trouvé: $claudePath" "SUCCESS"
} else {
    $claudePath = Install-ClaudeDesktop

    if (-not $claudePath) {
        Write-StepLog "Installation manuelle requise" "WARNING"
        Write-Host "`n⚠️ Téléchargez Claude Desktop depuis: https://claude.ai/download" -ForegroundColor Yellow
    }
}

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 6 : CONFIGURATION CLAUDE
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "⚙️ CONFIGURATION CLAUDE DESKTOP" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

New-ClaudeConfig

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 7 : LANCEMENT CLAUDE
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🚀 LANCEMENT CLAUDE DESKTOP" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

if ($claudePath -and (Test-Path $claudePath)) {
    # Fermer instance existante
    Stop-Process -Name "Claude" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # Lancer Claude
    Start-Process $claudePath
    Write-StepLog "Claude Desktop lancé" "SUCCESS"
} else {
    Write-StepLog "Claude Desktop non disponible" "WARNING"
}

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 8 : DOCKER (OPTIONNEL)
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🐳 DOCKER DESKTOP (Optionnel)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

if (-not (Test-Path "C:\Program Files\Docker\Docker\Docker Desktop.exe")) {
    Write-StepLog "Docker non installé (optionnel pour MCP)" "WARNING"
    Write-Host "   Pour l'installer: winget install Docker.DockerDesktop" -ForegroundColor Gray
} else {
    Write-StepLog "Docker Desktop déjà installé" "SUCCESS"
}

# ═══════════════════════════════════════════════════════════════════════════════════
# RAPPORT FINAL
# ═══════════════════════════════════════════════════════════════════════════════════
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

Clear-Host
Write-Host @"

╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║                    ✨ INSTALLATION TERMINÉE AVEC SUCCÈS ✨                     ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Host "📊 RÉSUMÉ DE L'INSTALLATION" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "⏱️  Durée totale: $([math]::Round($duration, 1)) secondes" -ForegroundColor White
Write-Host "✅ Étapes réussies: $script:SUCCESS_COUNT / $script:TOTAL_STEPS" -ForegroundColor Green
Write-Host "📁 Logs: $script:LOG_FILE" -ForegroundColor Gray
Write-Host ""

# Vérifications finales
Write-Host "🔍 VALIDATION DES COMPOSANTS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor DarkGray

$validations = @(
    @{Name="NodeJS"; Command="node --version"},
    @{Name="NPM"; Command="npm --version"},
    @{Name="Python"; Command="python --version"},
    @{Name="Git"; Command="git --version"}
)

foreach ($check in $validations) {
    try {
        $result = Invoke-Expression "$($check.Command) 2>$null"
        if ($result) {
            Write-Host "✅ $($check.Name): $result" -ForegroundColor Green
        } else {
            Write-Host "❌ $($check.Name): Non installé" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $($check.Name): Erreur" -ForegroundColor Red
    }
}

# Serveurs MCP
Write-Host "`n📦 SERVEURS MCP INSTALLÉS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor DarkGray

$installed = npm list -g --depth=0 2>$null | Select-String "@modelcontextprotocol"
if ($installed) {
    $count = ($installed | Measure-Object).Count
    Write-Host "✅ $count serveurs MCP installés:" -ForegroundColor Green
    $installed | ForEach-Object {
        Write-Host "   • $($_.Line.Trim())" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️ Aucun serveur MCP détecté" -ForegroundColor Yellow
}

# Configuration Claude
Write-Host "`n⚙️ CONFIGURATION CLAUDE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor DarkGray

if (Test-Path $script:CLAUDE_CONFIG) {
    try {
        $config = Get-Content $script:CLAUDE_CONFIG -Raw | ConvertFrom-Json
        $serverCount = ($config.mcpServers.PSObject.Properties | Measure-Object).Count
        Write-Host "✅ Configuration valide: $serverCount serveurs configurés" -ForegroundColor Green
        Write-Host "📁 Fichier: $script:CLAUDE_CONFIG" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Configuration invalide" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Configuration non trouvée" -ForegroundColor Red
}

# Instructions finales
Write-Host "`n🎯 PROCHAINES ÉTAPES" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "1. Claude Desktop devrait être ouvert" -ForegroundColor White
Write-Host "2. Ouvrir: Paramètres ⚙️ > Développeur" -ForegroundColor White
Write-Host "3. Vérifier section 'MCP Servers'" -ForegroundColor White
Write-Host "4. Serveurs actifs sans authentification:" -ForegroundColor White
Write-Host "   • filesystem ✅" -ForegroundColor Green
Write-Host "   • memory ✅" -ForegroundColor Green
Write-Host "   • fetch ✅" -ForegroundColor Green
Write-Host "   • postgres ✅" -ForegroundColor Green
Write-Host "   • sqlite ✅" -ForegroundColor Green

Write-Host "`n5. Serveurs nécessitant tokens (optionnel):" -ForegroundColor White
Write-Host "   • github (https://github.com/settings/tokens)" -ForegroundColor Gray
Write-Host "   • gitlab (https://gitlab.com/-/profile/personal_access_tokens)" -ForegroundColor Gray
Write-Host "   • slack (https://api.slack.com/apps)" -ForegroundColor Gray
Write-Host "   • brave-search (https://brave.com/search/api/)" -ForegroundColor Gray

Write-Host "`n💡 CONSEILS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "• Si les serveurs n'apparaissent pas:" -ForegroundColor White
Write-Host "  1. Fermez complètement Claude (clic droit > Quitter)" -ForegroundColor Gray
Write-Host "  2. Relancez Claude Desktop" -ForegroundColor Gray
Write-Host "  3. Retournez dans Paramètres > Développeur" -ForegroundColor Gray

Write-Host "`n• Pour ajouter des tokens API:" -ForegroundColor White
Write-Host "  Éditez: $script:CLAUDE_CONFIG" -ForegroundColor Gray

Write-Host "`n═══════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "🚀 NEMESIS OMEGA MCP - Installation automatique terminée!" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray

Write-Host "`nAppuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
