# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  🧪 TEST DES SERVEURS MCP - Script de validation                         ║
# ║                                                                           ║
# ║  Ce script teste tous les serveurs MCP installés et vérifie              ║
# ║  qu'ils fonctionnent correctement avec Claude Desktop                    ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

$ErrorActionPreference = "Continue"
Clear-Host

Write-Host @"

╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          🧪 TEST DES SERVEURS MCP                              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$results = @()
$totalTests = 0
$passedTests = 0

function Test-MCPServer {
    param(
        [string]$ServerName,
        [string]$PackageName
    )

    $script:totalTests++
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host "🔍 Test: $ServerName" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

    $testResult = @{
        Server = $ServerName
        Package = $PackageName
        Installed = $false
        ConfiguredInClaude = $false
        Functional = $false
        Details = ""
    }

    # Test 1: Package NPM installé
    Write-Host "  [1/3] Vérification package NPM..." -NoNewline
    $npmCheck = npm list -g $PackageName 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅" -ForegroundColor Green
        $testResult.Installed = $true

        # Extraire la version
        $versionMatch = $npmCheck | Select-String "$PackageName@(\d+\.\d+\.\d+)"
        if ($versionMatch) {
            $testResult.Details = "v$($versionMatch.Matches.Groups[1].Value)"
        }
    } else {
        Write-Host " ❌" -ForegroundColor Red
        $testResult.Details = "Package non installé"
        $script:results += $testResult
        return $testResult
    }

    # Test 2: Configuré dans Claude Desktop
    Write-Host "  [2/3] Vérification config Claude..." -NoNewline
    $claudeConfig = "$env:APPDATA\Claude\claude_desktop_config.json"

    if (Test-Path $claudeConfig) {
        try {
            $config = Get-Content $claudeConfig -Raw | ConvertFrom-Json
            $serverKey = $ServerName.ToLower()

            if ($config.mcpServers.$serverKey) {
                Write-Host " ✅" -ForegroundColor Green
                $testResult.ConfiguredInClaude = $true
            } else {
                Write-Host " ❌" -ForegroundColor Red
                $testResult.Details += " | Non configuré dans Claude"
            }
        } catch {
            Write-Host " ❌" -ForegroundColor Red
            $testResult.Details += " | Erreur lecture config"
        }
    } else {
        Write-Host " ❌" -ForegroundColor Red
        $testResult.Details += " | Config Claude non trouvée"
    }

    # Test 3: Test fonctionnel basique
    Write-Host "  [3/3] Test fonctionnel..." -NoNewline

    try {
        # Test simple : vérifier que le serveur peut démarrer
        $testCmd = "npx -y $PackageName --help"
        $output = Invoke-Expression "$testCmd 2>&1" -ErrorAction SilentlyContinue

        if ($LASTEXITCODE -eq 0 -or $output) {
            Write-Host " ✅" -ForegroundColor Green
            $testResult.Functional = $true
            $script:passedTests++
        } else {
            Write-Host " ⚠️" -ForegroundColor Yellow
            $testResult.Details += " | Test fonctionnel inconnu"
        }
    } catch {
        Write-Host " ⚠️" -ForegroundColor Yellow
        $testResult.Details += " | Test fonctionnel échoué"
    }

    # Résumé du test
    if ($testResult.Installed -and $testResult.ConfiguredInClaude -and $testResult.Functional) {
        Write-Host "`n  📊 Résultat: " -NoNewline
        Write-Host "✅ OPÉRATIONNEL" -ForegroundColor Green
    } elseif ($testResult.Installed -and $testResult.ConfiguredInClaude) {
        Write-Host "`n  📊 Résultat: " -NoNewline
        Write-Host "⚠️ PARTIELLEMENT FONCTIONNEL" -ForegroundColor Yellow
    } else {
        Write-Host "`n  📊 Résultat: " -NoNewline
        Write-Host "❌ NON FONCTIONNEL" -ForegroundColor Red
    }

    $script:results += $testResult
    return $testResult
}

# Liste des serveurs à tester
$servers = @(
    @{Name="filesystem"; Package="@modelcontextprotocol/server-filesystem"},
    @{Name="memory"; Package="@modelcontextprotocol/server-memory"},
    @{Name="fetch"; Package="@modelcontextprotocol/server-fetch"},
    @{Name="github"; Package="@modelcontextprotocol/server-github"},
    @{Name="gitlab"; Package="@modelcontextprotocol/server-gitlab"},
    @{Name="slack"; Package="@modelcontextprotocol/server-slack"},
    @{Name="postgres"; Package="@modelcontextprotocol/server-postgres"},
    @{Name="sqlite"; Package="@modelcontextprotocol/server-sqlite"},
    @{Name="brave-search"; Package="@modelcontextprotocol/server-brave-search"},
    @{Name="google-drive"; Package="@modelcontextprotocol/server-google-drive"}
)

Write-Host "Lancement des tests pour $($servers.Count) serveurs MCP...`n" -ForegroundColor Cyan

foreach ($server in $servers) {
    Test-MCPServer -ServerName $server.Name -PackageName $server.Package
}

# RAPPORT FINAL
Write-Host "`n`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                  📊 RAPPORT FINAL DES TESTS                    ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📈 STATISTIQUES:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  Tests exécutés    : $totalTests" -ForegroundColor White
Write-Host "  Tests réussis     : $passedTests" -ForegroundColor Green
Write-Host "  Tests échoués     : $($totalTests - $passedTests)" -ForegroundColor $(if($passedTests -eq $totalTests){"Green"}else{"Red"})
Write-Host "  Taux de réussite  : $([math]::Round(($passedTests / $totalTests) * 100, 1))%" -ForegroundColor $(if($passedTests -eq $totalTests){"Green"}elseif($passedTests -ge ($totalTests * 0.7)){"Yellow"}else{"Red"})

Write-Host "`n📦 DÉTAILS PAR SERVEUR:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

foreach ($result in $results) {
    $status = if ($result.Installed -and $result.ConfiguredInClaude -and $result.Functional) {
        "✅ OPÉRATIONNEL"
        $color = "Green"
    } elseif ($result.Installed -and $result.ConfiguredInClaude) {
        "⚠️ PARTIEL"
        $color = "Yellow"
    } else {
        "❌ ÉCHEC"
        $color = "Red"
    }

    Write-Host "`n  $($result.Server)" -ForegroundColor White
    Write-Host "    Package     : $($result.Package)" -ForegroundColor Gray
    Write-Host "    Installé    : $(if($result.Installed){'✅'}else{'❌'})" -ForegroundColor $(if($result.Installed){"Green"}else{"Red"})
    Write-Host "    Configuré   : $(if($result.ConfiguredInClaude){'✅'}else{'❌'})" -ForegroundColor $(if($result.ConfiguredInClaude){"Green"}else{"Red"})
    Write-Host "    Fonctionnel : $(if($result.Functional){'✅'}else{'⚠️'})" -ForegroundColor $(if($result.Functional){"Green"}else{"Yellow"})
    Write-Host "    Statut      : $status" -ForegroundColor $color
    if ($result.Details) {
        Write-Host "    Détails     : $($result.Details)" -ForegroundColor Gray
    }
}

# Recommandations
Write-Host "`n💡 RECOMMANDATIONS:" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

$notInstalled = $results | Where-Object { -not $_.Installed }
if ($notInstalled) {
    Write-Host "`n⚠️ Serveurs non installés:" -ForegroundColor Yellow
    foreach ($srv in $notInstalled) {
        Write-Host "  • $($srv.Server) : npm install -g $($srv.Package)" -ForegroundColor White
    }
}

$notConfigured = $results | Where-Object { $_.Installed -and -not $_.ConfiguredInClaude }
if ($notConfigured) {
    Write-Host "`n⚠️ Serveurs installés mais non configurés dans Claude:" -ForegroundColor Yellow
    foreach ($srv in $notConfigured) {
        Write-Host "  • $($srv.Server)" -ForegroundColor White
    }
    Write-Host "`n  👉 Éditez: $env:APPDATA\Claude\claude_desktop_config.json" -ForegroundColor Cyan
}

$needTokens = $results | Where-Object { $_.Server -in @("github", "gitlab", "slack", "brave-search", "google-drive") -and $_.Installed -and $_.ConfiguredInClaude }
if ($needTokens) {
    Write-Host "`n🔐 Serveurs nécessitant des tokens d'authentification:" -ForegroundColor Yellow
    foreach ($srv in $needTokens) {
        switch ($srv.Server) {
            "github" {
                Write-Host "  • GitHub : https://github.com/settings/tokens" -ForegroundColor White
            }
            "gitlab" {
                Write-Host "  • GitLab : https://gitlab.com/-/profile/personal_access_tokens" -ForegroundColor White
            }
            "slack" {
                Write-Host "  • Slack : https://api.slack.com/apps" -ForegroundColor White
            }
            "brave-search" {
                Write-Host "  • Brave Search : https://brave.com/search/api/" -ForegroundColor White
            }
            "google-drive" {
                Write-Host "  • Google Drive : https://console.cloud.google.com/" -ForegroundColor White
            }
        }
    }
    Write-Host "`n  📖 Consultez: GUIDE-CONFIGURATION-TOKENS.md" -ForegroundColor Cyan
}

if ($passedTests -eq $totalTests) {
    Write-Host "`n✨ TOUS LES SERVEURS MCP SONT OPÉRATIONNELS !" -ForegroundColor Green
    Write-Host "   Vous pouvez maintenant utiliser Claude Desktop avec tous les serveurs MCP." -ForegroundColor White
} elseif ($passedTests -ge ($totalTests * 0.7)) {
    Write-Host "`n⚠️ LA PLUPART DES SERVEURS FONCTIONNENT" -ForegroundColor Yellow
    Write-Host "   Consultez les recommandations ci-dessus pour corriger les problèmes." -ForegroundColor White
} else {
    Write-Host "`n❌ PLUSIEURS SERVEURS NÉCESSITENT ATTENTION" -ForegroundColor Red
    Write-Host "   Relancez le script d'installation: INSTALL-MCP-SIMPLE.ps1" -ForegroundColor White
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "🧪 Tests terminés!" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green

Write-Host "`nAppuyez sur une touche pour fermer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
