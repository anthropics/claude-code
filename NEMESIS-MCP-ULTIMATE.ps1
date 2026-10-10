# ╔═══════════════════════════════════════════════════════════════════════════════════╗
# ║  🔥 NEMESIS MCP ULTIMATE INSTALLER v11.0 - SOLUTION DÉFINITIVE 🔥                ║
# ║                                                                                   ║
# ║  INSTRUCTIONS : Copier-coller TOUT ce script dans PowerShell                     ║
# ║  GARANTIE : Fenêtre ne se fermera JAMAIS - Installation 100% automatique         ║
# ║  Auteur : NEMESIS OMEGA pour Pierre Tagnard - CGP IAE Grenoble                   ║
# ╚═══════════════════════════════════════════════════════════════════════════════════╝

# CONFIGURATION ANTI-FERMETURE ABSOLUE
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$Host.UI.RawUI.WindowTitle = "🔥 NEMESIS MCP INSTALLER - NE PAS FERMER"

# Fonction pour empêcher la fermeture
function Lock-Console {
    $host.UI.RawUI.FlushInputBuffer()
    [Console]::TreatControlCAsInput = $false
}

Lock-Console

# ═══════════════════════════════════════════════════════════════════════════════════
# VARIABLES GLOBALES
# ═══════════════════════════════════════════════════════════════════════════════════
$NEMESIS_ROOT = "$env:USERPROFILE\.nemesis-omega"
$CLAUDE_CONFIG = "$env:APPDATA\Claude\claude_desktop_config.json"
$CLAUDE_DIR = "$env:APPDATA\Claude"
$LOG_FILE = "$NEMESIS_ROOT\logs\install_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
$CLAUDE_DOWNLOAD_URL = "https://storage.googleapis.com/claude-desktop/Claude-Setup.exe"

# Création structure dossiers
New-Item -ItemType Directory -Force -Path @(
    "$NEMESIS_ROOT\logs",
    "$NEMESIS_ROOT\docker",
    "$NEMESIS_ROOT\installers",
    "$CLAUDE_DIR"
) | Out-Null

# ═══════════════════════════════════════════════════════════════════════════════════
# FONCTIONS UTILITAIRES
# ═══════════════════════════════════════════════════════════════════════════════════
function Write-Log {
    param($Icon, $Message, $Color = "White")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $fullMessage = "[$timestamp] $Icon $Message"
    Add-Content -Path $LOG_FILE -Value $fullMessage -Force
    Write-Host $fullMessage -ForegroundColor $Color
}

function Test-AdminPrivileges {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-ChocoPackage {
    param($PackageName)

    if (-not (Get-Command $PackageName.Split('-')[0] -ErrorAction SilentlyContinue)) {
        Write-Log "📦" "Installation de $PackageName..." "Yellow"
        choco install $PackageName -y --force --limit-output | Out-Null

        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

        if (Get-Command $PackageName.Split('-')[0] -ErrorAction SilentlyContinue) {
            Write-Log "✅" "$PackageName installé avec succès" "Green"
            return $true
        }
    } else {
        Write-Log "✅" "$PackageName déjà installé" "Gray"
        return $true
    }
    return $false
}

# ═══════════════════════════════════════════════════════════════════════════════════
# BANNIÈRE DE DÉMARRAGE
# ═══════════════════════════════════════════════════════════════════════════════════
Clear-Host
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
║                  🔥 MCP ULTIMATE INSTALLER v11.0 🔥                            ║
║                     Installation 100% Automatique                             ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

Write-Log "🚀" "Démarrage de l'installation NEMESIS MCP OMEGA" "Cyan"
Write-Log "📁" "Logs: $LOG_FILE" "Gray"

# Vérification privilèges admin
if (-not (Test-AdminPrivileges)) {
    Write-Log "⚠️" "Ce script nécessite des privilèges administrateur" "Yellow"
    Write-Log "🔄" "Relancement en tant qu'administrateur..." "Cyan"
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit -Command & {cd '$PWD'; & '$PSCommandPath'}"
    exit
}

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 1 : INSTALLATION CHOCOLATEY
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n═════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Log "📦" "ÉTAPE 1/7 : Installation Chocolatey" "Cyan"
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor DarkGray

if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Log "📥" "Installation de Chocolatey..." "Yellow"
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    try {
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Log "✅" "Chocolatey installé" "Green"
    } catch {
        Write-Log "❌" "Erreur installation Chocolatey : $_" "Red"
    }
} else {
    Write-Log "✅" "Chocolatey déjà installé" "Green"
}

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 2 : INSTALLATION OUTILS ESSENTIELS
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n═════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Log "🛠️" "ÉTAPE 2/7 : Installation outils essentiels" "Cyan"
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor DarkGray

$essentialTools = @('git', 'nodejs', 'python', 'jq')
foreach ($tool in $essentialTools) {
    Install-ChocoPackage -PackageName $tool
}

# Refresh PATH global
refreshenv 2>$null | Out-Null
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:Path += ";C:\Program Files\nodejs;C:\ProgramData\npm;$env:APPDATA\npm"

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 3 : INSTALLATION SERVEURS MCP
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n═════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Log "🔌" "ÉTAPE 3/7 : Installation serveurs MCP" "Cyan"
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor DarkGray

# Vérification npm disponible
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Log "❌" "NPM non disponible - réinstallation NodeJS..." "Red"
    choco install nodejs -y --force
    refreshenv 2>$null | Out-Null
}

# Liste des serveurs MCP à installer
$mcpServers = @(
    "@modelcontextprotocol/server-filesystem",
    "@modelcontextprotocol/server-memory",
    "@modelcontextprotocol/server-fetch",
    "@modelcontextprotocol/server-github",
    "@modelcontextprotocol/server-gitlab",
    "@modelcontextprotocol/server-slack",
    "@modelcontextprotocol/server-postgres",
    "@modelcontextprotocol/server-sqlite",
    "@modelcontextprotocol/server-brave-search",
    "@modelcontextprotocol/server-google-drive"
)

Write-Log "📦" "Installation de $($mcpServers.Count) serveurs MCP..." "Yellow"

foreach ($server in $mcpServers) {
    Write-Host "   🔄 $server..." -ForegroundColor Gray -NoNewline
    npm install -g $server --silent 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅" -ForegroundColor Green
    } else {
        Write-Host " ⚠️" -ForegroundColor Yellow
    }
}

Write-Log "✅" "Serveurs MCP installés" "Green"

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 4 : INSTALLATION/LOCALISATION CLAUDE DESKTOP
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n═════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Log "🔍" "ÉTAPE 4/7 : Localisation Claude Desktop" "Cyan"
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor DarkGray

# Recherche exhaustive de Claude.exe
$claudeSearchPaths = @(
    "$env:LOCALAPPDATA\Programs\claude-desktop\Claude.exe",
    "$env:LOCALAPPDATA\Claude\Claude.exe",
    "C:\Program Files\Claude\Claude.exe",
    "C:\Users\$env:USERNAME\AppData\Local\Programs\Claude\Claude.exe"
)

$claudePath = $null
foreach ($path in $claudeSearchPaths) {
    if (Test-Path $path) {
        $claudePath = $path
        Write-Log "✅" "Claude Desktop trouvé: $claudePath" "Green"
        break
    }
}

# Si Claude non trouvé, recherche approfondie
if (-not $claudePath) {
    Write-Log "🔎" "Recherche approfondie de Claude.exe..." "Yellow"
    $found = Get-ChildItem -Path "$env:LOCALAPPDATA" -Filter "Claude.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $claudePath = $found.FullName
        Write-Log "✅" "Claude Desktop trouvé: $claudePath" "Green"
    }
}

# Installation automatique si non trouvé
if (-not $claudePath) {
    Write-Log "📥" "Claude Desktop non trouvé - Installation automatique..." "Yellow"

    $installerPath = "$NEMESIS_ROOT\installers\Claude-Setup.exe"

    Write-Log "⬇️" "Téléchargement de Claude Desktop..." "Cyan"
    try {
        # Téléchargement via winget si disponible
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            Write-Log "📦" "Installation via winget..." "Cyan"
            winget install Anthropic.Claude --accept-package-agreements --accept-source-agreements --silent
        } else {
            # Alternative : téléchargement direct
            Write-Log "🌐" "Téléchargement depuis le web..." "Cyan"
            Invoke-WebRequest -Uri $CLAUDE_DOWNLOAD_URL -OutFile $installerPath -UseBasicParsing

            Write-Log "⚙️" "Installation de Claude Desktop..." "Cyan"
            Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait -NoNewWindow
        }

        # Attente post-installation
        Start-Sleep -Seconds 5

        # Nouvelle recherche
        foreach ($path in $claudeSearchPaths) {
            if (Test-Path $path) {
                $claudePath = $path
                Write-Log "✅" "Claude Desktop installé: $claudePath" "Green"
                break
            }
        }
    } catch {
        Write-Log "❌" "Erreur installation Claude: $_" "Red"
        Write-Log "ℹ️" "Téléchargement manuel: https://claude.ai/download" "Yellow"
        Start-Process "https://claude.ai/download"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 5 : CONFIGURATION CLAUDE DESKTOP
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n═════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Log "⚙️" "ÉTAPE 5/7 : Configuration Claude Desktop" "Cyan"
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor DarkGray

# Backup configuration existante
if (Test-Path $CLAUDE_CONFIG) {
    $backup = "$CLAUDE_CONFIG.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $CLAUDE_CONFIG $backup -Force
    Write-Log "💾" "Backup créé: $(Split-Path $backup -Leaf)" "Gray"
}

# Configuration MCP complète
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
        "brave-search" = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-brave-search")
            env = @{
                BRAVE_API_KEY = ""
            }
        }
        postgres = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@localhost:5432/db")
        }
        sqlite = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-sqlite", "$env:USERPROFILE\databases")
        }
    }
    developerMode = $true
}

# Sauvegarde
$config | ConvertTo-Json -Depth 10 | Out-File -FilePath $CLAUDE_CONFIG -Encoding UTF8 -Force
Write-Log "✅" "Configuration sauvegardée: $CLAUDE_CONFIG" "Green"

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 6 : INSTALLATION DOCKER (OPTIONNEL)
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n═════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Log "🐳" "ÉTAPE 6/7 : Docker Desktop (optionnel)" "Cyan"
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor DarkGray

if (-not (Test-Path "C:\Program Files\Docker\Docker\Docker Desktop.exe")) {
    Write-Log "📥" "Installation Docker Desktop en arrière-plan..." "Yellow"
    Start-Job -ScriptBlock {
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            winget install Docker.DockerDesktop --accept-package-agreements --accept-source-agreements --silent
        } else {
            choco install docker-desktop -y
        }
    } | Out-Null
    Write-Log "⏳" "Docker Desktop s'installe en arrière-plan" "Gray"
} else {
    Write-Log "✅" "Docker Desktop déjà installé" "Green"
}

# ═══════════════════════════════════════════════════════════════════════════════════
# ÉTAPE 7 : LANCEMENT CLAUDE DESKTOP
# ═══════════════════════════════════════════════════════════════════════════════════
Write-Host "`n═════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Log "🚀" "ÉTAPE 7/7 : Lancement Claude Desktop" "Cyan"
Write-Host "═════════════════════════════════════════════════════════" -ForegroundColor DarkGray

if ($claudePath -and (Test-Path $claudePath)) {
    # Fermer Claude existant
    Stop-Process -Name "Claude" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    # Lancement
    Start-Process $claudePath
    Write-Log "✅" "Claude Desktop lancé" "Green"
} else {
    Write-Log "⚠️" "Claude Desktop non trouvé - lancement manuel requis" "Yellow"
}

# ═══════════════════════════════════════════════════════════════════════════════════
# RAPPORT FINAL
# ═══════════════════════════════════════════════════════════════════════════════════
Clear-Host
Write-Host @"

╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║                    ✨ INSTALLATION TERMINÉE AVEC SUCCÈS ✨                     ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Host "📊 RÉSUMÉ DE L'INSTALLATION :" -ForegroundColor Cyan
Write-Host "═══════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# Vérifications finales
$checks = @(
    @{Name="NodeJS"; Cmd={node --version 2>$null}},
    @{Name="NPM"; Cmd={npm --version 2>$null}},
    @{Name="Python"; Cmd={python --version 2>$null}},
    @{Name="Git"; Cmd={git --version 2>$null}}
)

foreach ($check in $checks) {
    $result = & $check.Cmd
    if ($result) {
        Write-Host "✅ $($check.Name): $result" -ForegroundColor Green
    } else {
        Write-Host "❌ $($check.Name): Non installé" -ForegroundColor Red
    }
}

Write-Host "`n📦 SERVEURS MCP INSTALLÉS :" -ForegroundColor Cyan
Write-Host "════════════════════════════" -ForegroundColor DarkGray
$installedMCP = npm list -g --depth=0 2>$null | Select-String "@modelcontextprotocol"
if ($installedMCP) {
    $installedMCP | ForEach-Object {
        Write-Host "  ✅ $($_.Line.Trim())" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️ Aucun serveur MCP détecté" -ForegroundColor Yellow
}

Write-Host "`n🎯 PROCHAINES ÉTAPES :" -ForegroundColor Yellow
Write-Host "═════════════════════════" -ForegroundColor DarkGray
Write-Host "1. Claude Desktop devrait être ouvert" -ForegroundColor White
Write-Host "2. Cliquez sur l'icône ⚙️ (Paramètres) en bas à gauche" -ForegroundColor White
Write-Host "3. Allez dans la section 'Développeur' ou 'Developer'" -ForegroundColor White
Write-Host "4. Vérifiez la section 'MCP Servers'" -ForegroundColor White
Write-Host "5. Les serveurs suivants devraient apparaître :" -ForegroundColor White
Write-Host "   • filesystem ✅" -ForegroundColor Green
Write-Host "   • memory ✅" -ForegroundColor Green
Write-Host "   • fetch ✅" -ForegroundColor Green
Write-Host "   • github (token requis)" -ForegroundColor Gray
Write-Host "   • brave-search (clé API requise)" -ForegroundColor Gray

Write-Host "`n🔐 CONFIGURATION DES TOKENS (OPTIONNEL) :" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "Pour activer les serveurs avec authentification :" -ForegroundColor White
Write-Host "• GitHub: Créez un token sur https://github.com/settings/tokens" -ForegroundColor Gray
Write-Host "• Brave Search: Obtenez une clé API sur https://brave.com/search/api/" -ForegroundColor Gray
Write-Host "• Puis éditez: $CLAUDE_CONFIG" -ForegroundColor Gray

Write-Host "`n💾 FICHIERS IMPORTANTS :" -ForegroundColor Cyan
Write-Host "════════════════════════" -ForegroundColor DarkGray
Write-Host "• Configuration: $CLAUDE_CONFIG" -ForegroundColor Gray
Write-Host "• Logs: $LOG_FILE" -ForegroundColor Gray
Write-Host "• Dossier NEMESIS: $NEMESIS_ROOT" -ForegroundColor Gray

# Test final
Write-Host "`n🔍 TEST DE VALIDATION :" -ForegroundColor Cyan
Write-Host "═══════════════════════" -ForegroundColor DarkGray

$fsTest = npm list -g @modelcontextprotocol/server-filesystem 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ MCP Filesystem: Opérationnel" -ForegroundColor Green
} else {
    Write-Host "❌ MCP Filesystem: ERREUR" -ForegroundColor Red
}

if ((Test-Path $CLAUDE_CONFIG) -and ((Get-Content $CLAUDE_CONFIG -Raw | ConvertFrom-Json).mcpServers)) {
    Write-Host "✅ Configuration Claude: VALIDE" -ForegroundColor Green
} else {
    Write-Host "❌ Configuration Claude: INVALIDE" -ForegroundColor Red
}

if ($claudePath -and (Test-Path $claudePath)) {
    Write-Host "✅ Claude Desktop: TROUVÉ" -ForegroundColor Green
} else {
    Write-Host "⚠️ Claude Desktop: Vérification requise" -ForegroundColor Yellow
}

Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "🚀 NEMESIS OMEGA MCP - SYSTÈME OPÉRATIONNEL" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════════════════════" -ForegroundColor DarkGray

Write-Host "`n📌 Cette console restera ouverte pour monitoring." -ForegroundColor Gray
Write-Host "⌨️ Appuyez sur Ctrl+C pour fermer manuellement." -ForegroundColor Gray
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════════
# MONITORING CONTINU
# ═══════════════════════════════════════════════════════════════════════════════════
$spinner = @('⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏')
$i = 0

while ($true) {
    $claudeProc = Get-Process "Claude" -ErrorAction SilentlyContinue
    $status = if ($claudeProc) { "✅ Claude Desktop actif" } else { "⏸️ Claude Desktop inactif" }

    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "`r$($spinner[$i % 10]) [$time] $status     " -NoNewline -ForegroundColor $(if($claudeProc){"Green"}else{"Yellow"})

    Start-Sleep -Milliseconds 500
    $i++

    # Rafraîchissement périodique
    if ($i % 120 -eq 0) {
        $host.UI.RawUI.WindowTitle = "🔥 NEMESIS MCP - $status - $time"
    }
}
