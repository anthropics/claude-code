# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║  🧪 TEST D'INSTALLATION MCP - Validation complète                             ║
# ║  Usage: .\test-mcp-installation.ps1                                           ║
# ║  Description: Vérifie que tous les composants MCP sont correctement installés ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

$ErrorActionPreference = "SilentlyContinue"

# Bannière
Clear-Host
Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║           🧪 TEST D'INSTALLATION NEMESIS MCP OMEGA             ║
║                  Validation Complète                           ║
╚════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

Write-Host "`n🔍 Démarrage des tests de validation...`n" -ForegroundColor Yellow

$global:testResults = @()
$global:totalTests = 0
$global:passedTests = 0

function Test-Component {
    param(
        [string]$Name,
        [scriptblock]$TestScript,
        [string]$Category = "Général"
    )

    $global:totalTests++
    Write-Host "[$Category] Test: $Name..." -NoNewline -ForegroundColor Gray

    try {
        $result = & $TestScript
        if ($result) {
            Write-Host " ✅" -ForegroundColor Green
            $global:passedTests++
            $global:testResults += @{
                Name = $Name
                Category = $Category
                Status = "PASS"
                Details = $result
            }
            return $true
        } else {
            Write-Host " ❌" -ForegroundColor Red
            $global:testResults += @{
                Name = $Name
                Category = $Category
                Status = "FAIL"
                Details = "Test échoué"
            }
            return $false
        }
    } catch {
        Write-Host " ❌ (Erreur: $_)" -ForegroundColor Red
        $global:testResults += @{
            Name = $Name
            Category = $Category
            Status = "ERROR"
            Details = $_.Exception.Message
        }
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DES OUTILS DE BASE
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "📦 OUTILS DE BASE" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

Test-Component -Name "Chocolatey" -Category "Outils" -TestScript {
    $choco = Get-Command choco -ErrorAction SilentlyContinue
    if ($choco) { return choco --version }
    return $null
}

Test-Component -Name "Git" -Category "Outils" -TestScript {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) { return git --version }
    return $null
}

Test-Component -Name "NodeJS" -Category "Outils" -TestScript {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) { return node --version }
    return $null
}

Test-Component -Name "NPM" -Category "Outils" -TestScript {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if ($npm) { return "v$(npm --version)" }
    return $null
}

Test-Component -Name "Python" -Category "Outils" -TestScript {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) { return python --version }
    return $null
}

Test-Component -Name "JQ" -Category "Outils" -TestScript {
    $jq = Get-Command jq -ErrorAction SilentlyContinue
    if ($jq) { return jq --version }
    return $null
}

# ═══════════════════════════════════════════════════════════════════════════════
# TESTS DES SERVEURS MCP
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🔌 SERVEURS MCP NPM" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

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
    Test-Component -Name "MCP $server" -Category "MCP" -TestScript {
        $package = "@modelcontextprotocol/server-$server"
        $installed = npm list -g $package 2>$null
        if ($LASTEXITCODE -eq 0) {
            $version = $installed | Select-String "$package@" | ForEach-Object { $_ -replace '.*@([0-9.]+).*', '$1' }
            return "v$version"
        }
        return $null
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# TESTS CONFIGURATION CLAUDE
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "⚙️ CONFIGURATION CLAUDE DESKTOP" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$CLAUDE_CONFIG = "$env:APPDATA\Claude\claude_desktop_config.json"

Test-Component -Name "Fichier de configuration existe" -Category "Claude" -TestScript {
    if (Test-Path $CLAUDE_CONFIG) {
        return (Get-Item $CLAUDE_CONFIG).FullName
    }
    return $null
}

Test-Component -Name "Configuration JSON valide" -Category "Claude" -TestScript {
    if (Test-Path $CLAUDE_CONFIG) {
        try {
            $config = Get-Content $CLAUDE_CONFIG -Raw | ConvertFrom-Json
            return "Valide"
        } catch {
            return $null
        }
    }
    return $null
}

Test-Component -Name "Section mcpServers présente" -Category "Claude" -TestScript {
    if (Test-Path $CLAUDE_CONFIG) {
        $config = Get-Content $CLAUDE_CONFIG -Raw | ConvertFrom-Json
        if ($config.mcpServers) {
            $count = ($config.mcpServers.PSObject.Properties | Measure-Object).Count
            return "$count serveurs configurés"
        }
    }
    return $null
}

Test-Component -Name "Mode développeur activé" -Category "Claude" -TestScript {
    if (Test-Path $CLAUDE_CONFIG) {
        $config = Get-Content $CLAUDE_CONFIG -Raw | ConvertFrom-Json
        if ($config.developerMode -eq $true) {
            return "Activé"
        }
    }
    return $null
}

# ═══════════════════════════════════════════════════════════════════════════════
# TESTS CLAUDE DESKTOP
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🖥️ APPLICATION CLAUDE DESKTOP" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$claudePaths = @(
    "$env:LOCALAPPDATA\Programs\claude-desktop\Claude.exe",
    "$env:LOCALAPPDATA\Claude\Claude.exe",
    "C:\Program Files\Claude\Claude.exe"
)

Test-Component -Name "Claude.exe installé" -Category "Claude" -TestScript {
    foreach ($path in $claudePaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    return $null
}

Test-Component -Name "Processus Claude actif" -Category "Claude" -TestScript {
    $proc = Get-Process "Claude" -ErrorAction SilentlyContinue
    if ($proc) {
        return "PID: $($proc.Id)"
    }
    return $null
}

# ═══════════════════════════════════════════════════════════════════════════════
# TESTS OPTIONNELS
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🐳 COMPOSANTS OPTIONNELS" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

Test-Component -Name "Docker Desktop installé" -Category "Optionnel" -TestScript {
    $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        return "Installé"
    }
    return $null
}

Test-Component -Name "Docker actif" -Category "Optionnel" -TestScript {
    $dockerInfo = docker info 2>$null
    if ($?) {
        return "Actif"
    }
    return $null
}

# ═══════════════════════════════════════════════════════════════════════════════
# RAPPORT FINAL
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                   📊 RAPPORT DE VALIDATION                     ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green

$successRate = [math]::Round(($global:passedTests / $global:totalTests) * 100, 1)

Write-Host "`n📈 RÉSUMÉ :" -ForegroundColor Cyan
Write-Host "─────────────" -ForegroundColor DarkGray
Write-Host "Total de tests : $global:totalTests" -ForegroundColor White
Write-Host "Tests réussis  : $global:passedTests" -ForegroundColor Green
Write-Host "Tests échoués  : $($global:totalTests - $global:passedTests)" -ForegroundColor $(if($global:passedTests -eq $global:totalTests){"Gray"}else{"Red"})
Write-Host "Taux de succès : $successRate%" -ForegroundColor $(if($successRate -ge 80){"Green"}elseif($successRate -ge 50){"Yellow"}else{"Red"})

# Détails par catégorie
Write-Host "`n📂 DÉTAILS PAR CATÉGORIE :" -ForegroundColor Cyan
Write-Host "─────────────────────────" -ForegroundColor DarkGray

$categories = $global:testResults | Group-Object Category
foreach ($cat in $categories) {
    $passed = ($cat.Group | Where-Object { $_.Status -eq "PASS" }).Count
    $total = $cat.Group.Count
    $catRate = [math]::Round(($passed / $total) * 100)

    Write-Host "`n$($cat.Name) : $passed/$total ($catRate%)" -ForegroundColor $(if($catRate -eq 100){"Green"}elseif($catRate -ge 50){"Yellow"}else{"Red"})

    foreach ($result in $cat.Group) {
        $icon = switch ($result.Status) {
            "PASS" { "✅" }
            "FAIL" { "❌" }
            "ERROR" { "⚠️" }
        }
        Write-Host "  $icon $($result.Name)" -ForegroundColor Gray
    }
}

# Tests échoués
$failed = $global:testResults | Where-Object { $_.Status -ne "PASS" }
if ($failed) {
    Write-Host "`n⚠️ TESTS ÉCHOUÉS :" -ForegroundColor Yellow
    Write-Host "─────────────────" -ForegroundColor DarkGray
    foreach ($test in $failed) {
        Write-Host "• $($test.Category)/$($test.Name) : $($test.Details)" -ForegroundColor Red
    }
}

# Recommandations
Write-Host "`n💡 RECOMMANDATIONS :" -ForegroundColor Cyan
Write-Host "───────────────────" -ForegroundColor DarkGray

if ($successRate -lt 80) {
    Write-Host "⚠️ Certains composants critiques sont manquants" -ForegroundColor Yellow
    Write-Host "   → Relancez le script d'installation NEMESIS-MCP-ULTIMATE.ps1" -ForegroundColor White
}

if (-not (Get-Process "Claude" -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️ Claude Desktop n'est pas actif" -ForegroundColor Yellow
    Write-Host "   → Lancez Claude Desktop manuellement" -ForegroundColor White
}

$claudeConfigMissing = -not (Test-Path $CLAUDE_CONFIG)
if ($claudeConfigMissing) {
    Write-Host "❌ Configuration Claude manquante" -ForegroundColor Red
    Write-Host "   → Relancez le script d'installation" -ForegroundColor White
}

if ($successRate -ge 80 -and (Get-Process "Claude" -ErrorAction SilentlyContinue) -and (Test-Path $CLAUDE_CONFIG)) {
    Write-Host "✅ Installation complète et fonctionnelle !" -ForegroundColor Green
    Write-Host "   → Ouvrez Claude Desktop et allez dans Paramètres > Développeur" -ForegroundColor White
}

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "🧪 Test de validation terminé" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray

Write-Host "`nAppuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
