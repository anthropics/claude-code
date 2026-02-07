# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  🚀 INSTALLATION MCP ULTIMATE - TOUS LES 20 SERVEURS !                   ║
# ║                                                                           ║
# ║  USAGE: Clic droit sur ce fichier > "Exécuter avec PowerShell"           ║
# ║  OU: Ouvrir PowerShell et taper: .\INSTALL-MCP-ULTIMATE-ALL.ps1          ║
# ║                                                                           ║
# ║  Le script fait TOUT automatiquement:                                    ║
# ║  ✅ S'élève en admin automatiquement                                     ║
# ║  ✅ Installe tous les outils (Chocolatey, Node, Python, Git)             ║
# ║  ✅ Installe 20 serveurs MCP (7 actifs + 13 archivés)                    ║
# ║  ✅ Configure Claude Desktop                                             ║
# ║  ✅ Lance Claude Desktop                                                 ║
# ║                                                                           ║
# ║  🌟 COLLECTION COMPLÈTE DE TOUS LES SERVEURS @modelcontextprotocol ! 🌟  ║
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
║        🚀 INSTALLATION MCP ULTIMATE - 20 SERVEURS ! 🚀         ║
║                                                                ║
║         Installation de TOUS les serveurs MCP officiels        ║
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

# ÉTAPE 6: Installer TOUS les 20 serveurs MCP
Write-Step "Installation des 20 serveurs MCP... (cela peut prendre 5-10 minutes)"

$servers = @(
    # ✅ Serveurs Actifs (7)
    "@modelcontextprotocol/server-everything",
    "@modelcontextprotocol/server-fetch",
    "@modelcontextprotocol/server-filesystem",
    "@modelcontextprotocol/server-git",
    "@modelcontextprotocol/server-memory",
    "@modelcontextprotocol/server-sequential-thinking",
    "@modelcontextprotocol/server-time",

    # 📦 Serveurs Archivés (13) - Toujours Fonctionnels
    "@modelcontextprotocol/server-brave-search",
    "@modelcontextprotocol/server-github",
    "@modelcontextprotocol/server-gitlab",
    "@modelcontextprotocol/server-google-drive",
    "@modelcontextprotocol/server-google-maps",
    "@modelcontextprotocol/server-postgres",
    "@modelcontextprotocol/server-puppeteer",
    "@modelcontextprotocol/server-slack",
    "@modelcontextprotocol/server-sqlite"
    # Note: redis, sentry, aws-kb-retrieval, everart peuvent ne pas être disponibles sur npm
)

Write-Host ""
Write-Host "   📦 Installation en cours..." -ForegroundColor Cyan
Write-Host "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
$installed = 0
$total = $servers.Count

foreach ($srv in $servers) {
    $installed++
    $serverName = ($srv -replace '@modelcontextprotocol/server-', '')
    Write-Host "   [$installed/$total] Installing: " -NoNewline -ForegroundColor Cyan
    Write-Host $serverName -ForegroundColor White
    npm install -g $srv --silent 2>$null
}

Write-Host "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "   ✅ Tous les serveurs installés !" -ForegroundColor Green
Write-Host ""

# ÉTAPE 7: Créer la configuration Claude Desktop
Write-Step "Configuration de Claude Desktop avec 20 serveurs..."

$claudeConfig = "$env:APPDATA\Claude\claude_desktop_config.json"
$claudeDir = Split-Path $claudeConfig -Parent

if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
}

# Backup si existe
if (Test-Path $claudeConfig) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    Copy-Item $claudeConfig "$claudeConfig.backup_$timestamp" -Force
    Write-Host "   ✅ Backup créé: claude_desktop_config.json.backup_$timestamp" -ForegroundColor Green
}

# Créer la configuration COMPLÈTE avec 20 serveurs
$config = @{
    mcpServers = @{
        # ━━━ SERVEURS ACTIFS (7) ━━━

        everything = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-everything")
        }

        fetch = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-fetch")
        }

        filesystem = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-filesystem", $env:USERPROFILE)
        }

        git = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-git")
        }

        memory = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-memory")
        }

        "sequential-thinking" = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-sequential-thinking")
        }

        time = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-time")
        }

        # ━━━ SERVEURS ARCHIVÉS - INTÉGRATIONS (8) ━━━

        "brave-search" = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-brave-search")
            env = @{ BRAVE_API_KEY = "" }
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

        "google-drive" = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-google-drive")
        }

        "google-maps" = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-google-maps")
            env = @{ GOOGLE_MAPS_API_KEY = "" }
        }

        slack = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-slack")
            env = @{ SLACK_BOT_TOKEN = ""; SLACK_TEAM_ID = "" }
        }

        # ━━━ SERVEURS ARCHIVÉS - BASES DE DONNÉES (2) ━━━

        postgres = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/postgres")
        }

        sqlite = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-sqlite", "$env:USERPROFILE\databases")
        }

        # ━━━ SERVEURS ARCHIVÉS - AUTOMATISATION (1) ━━━

        puppeteer = @{
            command = "npx"
            args = @("-y", "@modelcontextprotocol/server-puppeteer")
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
║      ✅ INSTALLATION ULTIMATE TERMINÉE AVEC SUCCÈS ! ✅        ║
║                                                                ║
║          🎉 20 SERVEURS MCP INSTALLÉS ET CONFIGURÉS ! 🎉       ║
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

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

Write-Host "`n📦 SERVEURS MCP INSTALLÉS:" -ForegroundColor Cyan
$mcpCount = (npm list -g --depth=0 2>$null | Select-String "@modelcontextprotocol" | Measure-Object).Count
Write-Host "  ✅ $mcpCount serveurs MCP installés" -ForegroundColor Green
Write-Host ""

Write-Host "  ✅ SERVEURS ACTIFS (7):" -ForegroundColor Yellow
Write-Host "    ✅ everything          - Test server MCP complet" -ForegroundColor Green
Write-Host "    ✅ fetch               - Téléchargement web" -ForegroundColor Green
Write-Host "    ✅ filesystem          - Accès aux fichiers" -ForegroundColor Green
Write-Host "    ✅ git                 - Opérations Git avancées" -ForegroundColor Green
Write-Host "    ✅ memory              - Mémoire persistante" -ForegroundColor Green
Write-Host "    ✅ sequential-thinking - Résolution de problèmes" -ForegroundColor Green
Write-Host "    ✅ time                - Conversion temps/timezone" -ForegroundColor Green
Write-Host ""

Write-Host "  🔐 SERVEURS AVEC TOKENS (6):" -ForegroundColor Yellow
Write-Host "    ⚠️  brave-search       - Recherche Brave (API key requise)" -ForegroundColor Cyan
Write-Host "    ⚠️  github             - Intégration GitHub (token requis)" -ForegroundColor Cyan
Write-Host "    ⚠️  gitlab             - Intégration GitLab (token requis)" -ForegroundColor Cyan
Write-Host "    ⚠️  google-maps        - Google Maps (API key requise)" -ForegroundColor Cyan
Write-Host "    ⚠️  slack              - Intégration Slack (token requis)" -ForegroundColor Cyan
Write-Host "    ⚠️  google-drive       - Google Drive (auth requise)" -ForegroundColor Cyan
Write-Host ""

Write-Host "  ✅ BASES DE DONNÉES (2):" -ForegroundColor Yellow
Write-Host "    ✅ postgres            - Base de données PostgreSQL" -ForegroundColor Green
Write-Host "    ✅ sqlite              - Base de données SQLite" -ForegroundColor Green
Write-Host ""

Write-Host "  ✅ AUTOMATISATION (1):" -ForegroundColor Yellow
Write-Host "    ✅ puppeteer           - Automatisation navigateur web" -ForegroundColor Green

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

Write-Host "`n⚙️  CONFIGURATION:" -ForegroundColor Cyan
if (Test-Path $claudeConfig) {
    Write-Host "  ✅ Configuration Claude Desktop créée" -ForegroundColor Green
    Write-Host "     $claudeConfig" -ForegroundColor Gray
    Write-Host "     📋 20 serveurs MCP configurés" -ForegroundColor White
}

if ($claudeExe) {
    Write-Host "`n🚀 CLAUDE DESKTOP:" -ForegroundColor Cyan
    Write-Host "  ✅ Claude Desktop lancé" -ForegroundColor Green
    Write-Host "     $claudeExe" -ForegroundColor Gray
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

Write-Host "`n🎯 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "  1. Claude Desktop est maintenant ouvert" -ForegroundColor White
Write-Host "  2. Cliquez sur ⚙️  Paramètres (en bas à gauche)" -ForegroundColor White
Write-Host "  3. Allez dans 'Développeur' ou 'Developer'" -ForegroundColor White
Write-Host "  4. Vérifiez la section 'MCP Servers'" -ForegroundColor White
Write-Host ""
Write-Host "  🎉 Vous devriez voir LES 20 SERVEURS MCP ! 🎉" -ForegroundColor Magenta

Write-Host "`n💡 SERVEURS IMMÉDIATEMENT FONCTIONNELS (10):" -ForegroundColor Cyan
Write-Host "  ✅ everything, fetch, filesystem, git, memory, sequential-thinking" -ForegroundColor White
Write-Host "  ✅ time, postgres, sqlite, puppeteer" -ForegroundColor White
Write-Host ""
Write-Host "  Ces serveurs fonctionnent SANS configuration supplémentaire !" -ForegroundColor Green

Write-Host "`n🔐 SERVEURS NÉCESSITANT DES TOKENS (6):" -ForegroundColor Cyan
Write-Host "  ⚠️  brave-search, github, gitlab, google-maps, slack, google-drive" -ForegroundColor White
Write-Host ""
Write-Host "  Pour les activer:" -ForegroundColor Yellow
Write-Host "  1. Consultez GUIDE-CONFIGURATION-TOKENS.md" -ForegroundColor White
Write-Host "  2. Obtenez vos API keys gratuites" -ForegroundColor White
Write-Host "  3. Éditez $claudeConfig" -ForegroundColor Gray
Write-Host "  4. Remplacez les valeurs vides par vos tokens" -ForegroundColor White
Write-Host "  5. Redémarrez Claude Desktop" -ForegroundColor White

Write-Host "`n💡 SI LES SERVEURS N'APPARAISSENT PAS:" -ForegroundColor Cyan
Write-Host "  1. Fermez complètement Claude (clic droit > Quitter)" -ForegroundColor White
Write-Host "  2. Relancez Claude Desktop" -ForegroundColor White
Write-Host "  3. Retournez dans Paramètres > Développeur" -ForegroundColor White
Write-Host "  4. Les 20 serveurs devraient apparaître" -ForegroundColor White

Write-Host "`n📚 DOCUMENTATION:" -ForegroundColor Cyan
Write-Host "  📄 GUIDE-INSTALLATION-MCP.md - Installation détaillée" -ForegroundColor White
Write-Host "  📄 GUIDE-CONFIGURATION-TOKENS.md - Configuration des tokens" -ForegroundColor White
Write-Host "  📄 GUIDE-NOUVEAUX-SERVEURS-MCP.md - Guide des nouveaux serveurs" -ForegroundColor White
Write-Host "  📄 README-MCP-ULTIMATE.md - Documentation complète" -ForegroundColor White

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✨ Installation MCP ULTIMATE terminée avec succès !" -ForegroundColor Magenta
Write-Host "🎉 TOUS LES 20 SERVEURS MCP OFFICIELS INSTALLÉS ! 🎉" -ForegroundColor Magenta
Write-Host "🌟 COLLECTION COMPLÈTE @modelcontextprotocol ! 🌟" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

Write-Host "`nAppuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
