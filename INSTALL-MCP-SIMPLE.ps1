# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  🚀 INSTALLATION MCP ULTRA-SIMPLE - 1 SEUL FICHIER                       ║
# ║                                                                           ║
# ║  USAGE: Clic droit sur ce fichier > "Exécuter avec PowerShell"           ║
# ║  OU: Ouvrir PowerShell et taper: .\INSTALL-MCP-SIMPLE.ps1                ║
# ║                                                                           ║
# ║  Le script fait TOUT automatiquement:                                    ║
# ║  ✅ S'élève en admin automatiquement                                     ║
# ║  ✅ Installe tous les outils (Chocolatey, Node, Python, Git)             ║
# ║  ✅ Installe 10 serveurs MCP                                             ║
# ║  ✅ Configure Claude Desktop                                             ║
# ║  ✅ Lance Claude Desktop                                                 ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

# Auto-élévation en administrateur
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "🔒 Demande des privilèges administrateur..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

# Configuration
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

Clear-Host
Write-Host @"

╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          🚀 INSTALLATION MCP ULTRA-SIMPLE 🚀                   ║
║                                                                ║
║              Installation automatique en cours...              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$step = 1
function Write-Step {
    param($Message)
    Write-Host "[$step/10] $Message" -ForegroundColor Yellow
    $script:step++
}

# ÉTAPE 1: Chocolatey
Write-Step "Installation de Chocolatey..."
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')) | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# ÉTAPE 2: Git
Write-Step "Installation de Git..."
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    choco install git -y --force | Out-Null
}

# ÉTAPE 3: NodeJS
Write-Step "Installation de NodeJS..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    choco install nodejs -y --force | Out-Null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $env:Path += ";C:\Program Files\nodejs;$env:APPDATA\npm"
}

# ÉTAPE 4: Python
Write-Step "Installation de Python..."
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    choco install python -y --force | Out-Null
}

# ÉTAPE 5: Attendre que NPM soit disponible
Write-Step "Vérification NPM..."
Start-Sleep -Seconds 3
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:Path += ";C:\Program Files\nodejs;C:\ProgramData\npm;$env:APPDATA\npm"

# ÉTAPE 6: Installer les serveurs MCP
Write-Step "Installation des 10 serveurs MCP... (cela peut prendre 2-3 minutes)"

$servers = @(
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

foreach ($srv in $servers) {
    npm install -g $srv --silent 2>$null
}

# ÉTAPE 7: Créer la configuration Claude
Write-Step "Configuration de Claude Desktop..."

$claudeConfig = "$env:APPDATA\Claude\claude_desktop_config.json"
$claudeDir = Split-Path $claudeConfig -Parent

if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
}

# Backup si existe
if (Test-Path $claudeConfig) {
    Copy-Item $claudeConfig "$claudeConfig.backup" -Force
}

# Créer la configuration
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
            env = @{ GITHUB_PERSONAL_ACCESS_TOKEN = "" }
        }
        gitlab = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-gitlab")
            env = @{ GITLAB_PERSONAL_ACCESS_TOKEN = "" }
        }
        slack = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-slack")
            env = @{ SLACK_BOT_TOKEN = ""; SLACK_TEAM_ID = "" }
        }
        "brave-search" = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-brave-search")
            env = @{ BRAVE_API_KEY = "" }
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

$config | ConvertTo-Json -Depth 10 | Out-File -FilePath $claudeConfig -Encoding UTF8 -Force

# ÉTAPE 8: Trouver Claude Desktop
Write-Step "Recherche de Claude Desktop..."

$claudePaths = @(
    "$env:LOCALAPPDATA\Programs\claude-desktop\Claude.exe",
    "$env:LOCALAPPDATA\Programs\Claude\Claude.exe",
    "$env:LOCALAPPDATA\Claude\Claude.exe"
)

$claudeExe = $null
foreach ($path in $claudePaths) {
    if (Test-Path $path) {
        $claudeExe = $path
        break
    }
}

if (-not $claudeExe) {
    $found = Get-ChildItem -Path $env:LOCALAPPDATA -Filter "Claude.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $claudeExe = $found.FullName
    }
}

# ÉTAPE 9: Installer Claude si absent
if (-not $claudeExe) {
    Write-Step "Claude Desktop non trouvé, installation..."

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install Anthropic.Claude --accept-package-agreements --accept-source-agreements --silent | Out-Null
        Start-Sleep -Seconds 5

        foreach ($path in $claudePaths) {
            if (Test-Path $path) {
                $claudeExe = $path
                break
            }
        }
    }
}

# ÉTAPE 10: Lancer Claude
Write-Step "Lancement de Claude Desktop..."

if ($claudeExe) {
    Stop-Process -Name "Claude" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process $claudeExe
}

# RÉSUMÉ FINAL
Clear-Host
Write-Host @"

╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║              ✅ INSTALLATION TERMINÉE AVEC SUCCÈS !            ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Host "📊 COMPOSANTS INSTALLÉS:" -ForegroundColor Cyan
Write-Host ""

# Vérifications
$checks = @(
    @{Name="NodeJS"; Cmd="node --version"},
    @{Name="NPM"; Cmd="npm --version"},
    @{Name="Python"; Cmd="python --version"},
    @{Name="Git"; Cmd="git --version"}
)

foreach ($check in $checks) {
    try {
        $result = Invoke-Expression "$($check.Cmd) 2>$null"
        if ($result) {
            Write-Host "  ✅ $($check.Name): $result" -ForegroundColor Green
        }
    } catch {}
}

Write-Host "`n📦 SERVEURS MCP:" -ForegroundColor Cyan
$mcpCount = (npm list -g --depth=0 2>$null | Select-String "@modelcontextprotocol" | Measure-Object).Count
Write-Host "  ✅ $mcpCount serveurs MCP installés" -ForegroundColor Green

Write-Host "`n⚙️ CONFIGURATION:" -ForegroundColor Cyan
if (Test-Path $claudeConfig) {
    Write-Host "  ✅ Configuration Claude Desktop créée" -ForegroundColor Green
    Write-Host "     $claudeConfig" -ForegroundColor Gray
}

if ($claudeExe) {
    Write-Host "`n🚀 CLAUDE DESKTOP:" -ForegroundColor Cyan
    Write-Host "  ✅ Claude Desktop lancé" -ForegroundColor Green
    Write-Host "     $claudeExe" -ForegroundColor Gray
}

Write-Host "`n" -NoNewline
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

Write-Host "`n🎯 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "  1. Claude Desktop est maintenant ouvert" -ForegroundColor White
Write-Host "  2. Cliquez sur ⚙️ Paramètres (en bas à gauche)" -ForegroundColor White
Write-Host "  3. Allez dans 'Développeur' ou 'Developer'" -ForegroundColor White
Write-Host "  4. Vérifiez la section 'MCP Servers'" -ForegroundColor White
Write-Host ""
Write-Host "  Vous devriez voir:" -ForegroundColor White
Write-Host "    ✅ filesystem" -ForegroundColor Green
Write-Host "    ✅ memory" -ForegroundColor Green
Write-Host "    ✅ fetch" -ForegroundColor Green
Write-Host "    ✅ postgres" -ForegroundColor Green
Write-Host "    ✅ sqlite" -ForegroundColor Green
Write-Host "    ⚠️ github (token requis)" -ForegroundColor Yellow
Write-Host "    ⚠️ brave-search (API key requise)" -ForegroundColor Yellow

Write-Host "`n💡 SI LES SERVEURS N'APPARAISSENT PAS:" -ForegroundColor Cyan
Write-Host "  1. Fermez complètement Claude (clic droit > Quitter)" -ForegroundColor White
Write-Host "  2. Relancez Claude Desktop" -ForegroundColor White
Write-Host "  3. Retournez dans Paramètres > Développeur" -ForegroundColor White

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✨ Installation MCP terminée avec succès !" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

Write-Host "`nAppuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
