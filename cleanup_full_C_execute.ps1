#Requires -RunAsAdministrator
<#
╔══════════════════════════════════════════════════════════════════════════════╗
║                    NEMESIS OMEGA — SYSTEM CLEANUP ENGINE                    ║
║                     cleanup_full_C_execute.ps1 v2.0                        ║
║                                                                            ║
║  Auteur  : Pierre TAGNARD — NEMESIS Architecture                           ║
║  Date    : 2025-02-05                                                      ║
║  Licence : Usage interne — Cabinet CGP                                     ║
║                                                                            ║
║  PHASES :                                                                  ║
║    0 — Snapshot & Backup état initial                                      ║
║    1 — Audit espace disque (Top consommateurs)                             ║
║    2 — Optimisation RAM & Performance                                      ║
║    3 — Réorganisation arborescence complète                                ║
║    4 — Bureau minimaliste (5 icônes max)                                   ║
║    5 — Purge dossiers vides                                                ║
║    6 — Optimisations système complémentaires                               ║
║                                                                            ║
║  USAGE : Exécuter en tant qu'Administrateur                                ║
║    .\cleanup_full_C_execute.ps1                         (mode interactif)  ║
║    .\cleanup_full_C_execute.ps1 -DryRun                 (simulation)       ║
║    .\cleanup_full_C_execute.ps1 -Phase 1                (phase unique)     ║
║    .\cleanup_full_C_execute.ps1 -SkipConfirm            (auto-confirm)     ║
╚══════════════════════════════════════════════════════════════════════════════╝
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [ValidateRange(0,6)]
    [int[]]$Phase = @(0,1,2,3,4,5,6),
    [switch]$SkipConfirm,
    [string]$UserProfile = $env:USERPROFILE,
    [string]$LogDir = "$env:USERPROFILE\Documents\02_NEMESIS\Logs"
)

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║                     CONFIGURATION & VARIABLES GLOBALES                  ║
# ╚══════════════════════════════════════════════════════════════════════════╝

$ErrorActionPreference = "Stop"
$script:Timestamp      = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$script:LogFile        = "$LogDir\CLEANUP_$Timestamp.log"
$script:SnapshotFile   = "$UserProfile\Documents\SNAPSHOT_AVANT_$Timestamp.md"
$script:ReportFile     = "$UserProfile\Documents\02_NEMESIS\Logs\AUDIT_REPORT_$Timestamp.md"
$script:TotalFreed     = 0
$script:ActionsLog     = [System.Collections.ArrayList]::new()
$script:DesktopPath    = [Environment]::GetFolderPath("Desktop")
$script:DocumentsPath  = [Environment]::GetFolderPath("MyDocuments")
$script:DownloadsPath  = "$UserProfile\Downloads"
$script:Username       = $env:USERNAME

# Palette de couleurs console
$script:Colors = @{
    Phase   = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Data    = "DarkCyan"
    Title   = "Magenta"
}

# Arborescence cible
$script:TargetTree = @{
    "01_CGP-PROFESSIONNEL" = @("Clients", "Réglementaire", "Modèles", "Formations", "Compta-Cabinet")
    "02_NEMESIS"           = @("Architecture", "Agents", "MCP-Servers", "Docker", "Prompts", "Logs")
    "03_DEV-TECH"          = @("Scripts", "Projets", "Sandbox", "Docs-Tech")
    "04_PERSONNEL"         = @("Famille", "Administratif", "Santé", "Généalogie", "Divers")
    "05_ARCHIVES"          = @("2024", "2023", "Ancien")
    "00_INBOX"             = @()
}

# Services Windows candidats à la désactivation
$script:DisableServices = @(
    @{ Name = "SysMain";            Desc = "Superfetch (inutile sur SSD)";       Risk = "Low" }
    @{ Name = "DiagTrack";          Desc = "Télémétrie Microsoft";               Risk = "Low" }
    @{ Name = "MapsBroker";         Desc = "Gestionnaire cartes téléchargées";   Risk = "Low" }
    @{ Name = "RetailDemo";         Desc = "Service démo magasin";               Risk = "Low" }
    @{ Name = "WMPNetworkSvc";      Desc = "Partage réseau WMP";                Risk = "Low" }
    @{ Name = "Fax";                Desc = "Service Fax";                        Risk = "Low" }
    @{ Name = "TabletInputService"; Desc = "Saisie tablette/stylet";             Risk = "Medium" }
    @{ Name = "XblAuthManager";     Desc = "Xbox Live Auth";                     Risk = "Low" }
    @{ Name = "XboxNetApiSvc";      Desc = "Xbox Live Networking";               Risk = "Low" }
    @{ Name = "XblGameSave";        Desc = "Xbox Game Save";                     Risk = "Low" }
)

# Patterns de fichiers à purger
$script:PurgePatterns = @{
    TempFiles     = @("*.tmp", "*.bak", "*.old", "~*", "*.log.old", "Thumbs.db", "desktop.ini")
    CacheDirs     = @("node_modules", "__pycache__", ".cache", ".tmp", "Cache", "CachedData")
    LargeUseless  = @("*.iso", "*.msi", "*.exe")  # Dans Downloads uniquement
    OldDownloads  = 7  # Jours avant purge dans Downloads
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║                         FONCTIONS UTILITAIRES                           ║
# ╚══════════════════════════════════════════════════════════════════════════╝

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO","WARN","ERROR","SUCCESS","PHASE","ACTION","DATA")]
        [string]$Level = "INFO"
    )
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$ts] [$Level] $Message"

    # Écriture fichier log
    if (Test-Path (Split-Path $script:LogFile -Parent)) {
        Add-Content -Path $script:LogFile -Value $logEntry -ErrorAction SilentlyContinue
    }

    # Écriture console colorée
    $color = switch ($Level) {
        "PHASE"   { $script:Colors.Phase }
        "SUCCESS" { $script:Colors.Success }
        "WARN"    { $script:Colors.Warning }
        "ERROR"   { $script:Colors.Error }
        "ACTION"  { $script:Colors.Title }
        "DATA"    { $script:Colors.Data }
        default   { $script:Colors.Info }
    }

    $prefix = switch ($Level) {
        "PHASE"   { "═══ " }
        "SUCCESS" { " ✅ " }
        "WARN"    { " ⚠️  " }
        "ERROR"   { " ❌ " }
        "ACTION"  { " 🔧 " }
        "DATA"    { " 📊 " }
        default   { " ℹ️  " }
    }

    Write-Host "$prefix$Message" -ForegroundColor $color
}

function Write-Banner {
    param([string]$Title, [int]$PhaseNum)
    $banner = @"

╔══════════════════════════════════════════════════════════════════════════════╗
║  PHASE $PhaseNum — $($Title.ToUpper().PadRight(62))║
╚══════════════════════════════════════════════════════════════════════════════╝
"@
    Write-Host $banner -ForegroundColor $script:Colors.Phase
    Write-Log "DÉBUT PHASE $PhaseNum — $Title" -Level "PHASE"
}

function Confirm-Action {
    param([string]$Message)
    if ($SkipConfirm) { return $true }
    if ($DryRun) {
        Write-Log "[DRY-RUN] Skipped: $Message" -Level "WARN"
        return $false
    }
    $response = Read-Host "$Message (O/N)"
    return ($response -eq 'O' -or $response -eq 'o' -or $response -eq 'Y' -or $response -eq 'y')
}

function Get-FolderSize {
    param([string]$Path)
    try {
        $size = (Get-ChildItem -Path $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
                 Measure-Object -Property Length -Sum).Sum
        return [math]::Round($size / 1GB, 3)
    } catch {
        return 0
    }
}

function Format-Size {
    param([double]$Bytes)
    if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

function Initialize-LogDirectory {
    $dirs = @(
        $LogDir,
        (Split-Path $script:SnapshotFile -Parent)
    )
    foreach ($dir in $dirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Log "Dossier créé : $dir" -Level "INFO"
        }
    }
}

function Show-ProgressBar {
    param(
        [int]$Current,
        [int]$Total,
        [string]$Activity
    )
    $pct = [math]::Round(($Current / [math]::Max($Total,1)) * 100)
    Write-Progress -Activity $Activity -Status "$pct% Complete" -PercentComplete $pct
}

function Get-DiskInfo {
    Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3" |
        Select-Object DeviceID,
            @{N='TotalGB';  E={[math]::Round($_.Size/1GB,1)}},
            @{N='FreeGB';   E={[math]::Round($_.FreeSpace/1GB,1)}},
            @{N='UsedGB';   E={[math]::Round(($_.Size - $_.FreeSpace)/1GB,1)}},
            @{N='FreePct';  E={[math]::Round(($_.FreeSpace/$_.Size)*100,1)}}
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║               PHASE 0 — SNAPSHOT & BACKUP ÉTAT INITIAL                  ║
# ╚══════════════════════════════════════════════════════════════════════════╝

function Invoke-Phase0 {
    Write-Banner "SNAPSHOT & BACKUP ÉTAT INITIAL" 0
    Initialize-LogDirectory

    $snapshot = [System.Text.StringBuilder]::new()
    [void]$snapshot.AppendLine("# 📸 SNAPSHOT SYSTÈME — $script:Timestamp")
    [void]$snapshot.AppendLine("---")
    [void]$snapshot.AppendLine("")

    # --- Info système ---
    [void]$snapshot.AppendLine("## 💻 Information Système")
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $ram = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)

    [void]$snapshot.AppendLine("- **OS** : $($os.Caption) $($os.Version)")
    [void]$snapshot.AppendLine("- **CPU** : $($cpu.Name)")
    [void]$snapshot.AppendLine("- **RAM** : $ram GB")
    [void]$snapshot.AppendLine("")

    # --- Espace disque ---
    [void]$snapshot.AppendLine("## 💾 Espace Disque")
    [void]$snapshot.AppendLine("| Disque | Total | Utilisé | Libre | Libre % |")
    [void]$snapshot.AppendLine("|--------|-------|---------|-------|---------|")
    Get-DiskInfo | ForEach-Object {
        [void]$snapshot.AppendLine("| $($_.DeviceID) | $($_.TotalGB) GB | $($_.UsedGB) GB | $($_.FreeGB) GB | $($_.FreePct)% |")
    }
    [void]$snapshot.AppendLine("")

    # --- Arborescence Bureau ---
    [void]$snapshot.AppendLine("## 🖥️ Contenu Bureau Actuel")
    Get-ChildItem $script:DesktopPath -ErrorAction SilentlyContinue | ForEach-Object {
        $type = if ($_.PSIsContainer) { "📁" } elseif ($_.Extension -eq ".lnk") { "🔗" } else { "📄" }
        [void]$snapshot.AppendLine("- $type ``$($_.Name)``")
    }
    [void]$snapshot.AppendLine("")

    # --- Arborescence Documents (2 niveaux) ---
    [void]$snapshot.AppendLine("## 📁 Arborescence Documents (2 niveaux)")
    [void]$snapshot.AppendLine('```')
    Get-ChildItem $script:DocumentsPath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        [void]$snapshot.AppendLine("├── $($_.Name)")
        Get-ChildItem $_.FullName -Directory -ErrorAction SilentlyContinue | Select-Object -First 10 | ForEach-Object {
            [void]$snapshot.AppendLine("│   ├── $($_.Name)")
        }
    }
    [void]$snapshot.AppendLine('```')
    [void]$snapshot.AppendLine("")

    # --- Applications installées ---
    [void]$snapshot.AppendLine("## 📦 Applications Installées (Top 50 par taille)")
    [void]$snapshot.AppendLine("| Application | Taille estimée | Date install |")
    [void]$snapshot.AppendLine("|-------------|----------------|--------------|")

    $apps = @()
    $regPaths = @(
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    foreach ($rp in $regPaths) {
        try {
            $apps += Get-ItemProperty $rp -ErrorAction SilentlyContinue |
                     Where-Object { $_.DisplayName -and $_.EstimatedSize } |
                     Select-Object DisplayName, EstimatedSize, InstallDate
        } catch {}
    }
    $apps | Sort-Object EstimatedSize -Descending | Select-Object -First 50 | ForEach-Object {
        $sizeMB = [math]::Round($_.EstimatedSize / 1024, 1)
        [void]$snapshot.AppendLine("| $($_.DisplayName) | $sizeMB MB | $($_.InstallDate) |")
    }
    [void]$snapshot.AppendLine("")

    # --- Programmes démarrage ---
    [void]$snapshot.AppendLine("## 🚀 Programmes au Démarrage")
    try {
        Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue | ForEach-Object {
            [void]$snapshot.AppendLine("- ``$($_.Name)`` → $($_.Command)")
        }
    } catch {}
    [void]$snapshot.AppendLine("")

    # --- Écriture snapshot ---
    $snapshot.ToString() | Out-File -FilePath $script:SnapshotFile -Encoding UTF8
    Write-Log "Snapshot sauvegardé : $($script:SnapshotFile)" -Level "SUCCESS"
    Write-Log "Phase 0 terminée — Filet de sécurité en place" -Level "SUCCESS"
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║             PHASE 1 — AUDIT ESPACE DISQUE (TOP CONSOMMATEURS)           ║
# ╚══════════════════════════════════════════════════════════════════════════╝

function Invoke-Phase1 {
    Write-Banner "AUDIT ESPACE DISQUE" 1

    $report = [System.Text.StringBuilder]::new()
    [void]$report.AppendLine("# 📊 RAPPORT AUDIT DISQUE — $script:Timestamp")
    [void]$report.AppendLine("---")

    # --- Espace disque global ---
    Write-Log "Analyse espace disque global..." -Level "INFO"
    [void]$report.AppendLine("## Espace Disque Global")
    [void]$report.AppendLine("| Disque | Total | Libre | Libre % |")
    [void]$report.AppendLine("|--------|-------|-------|---------|")
    Get-DiskInfo | ForEach-Object {
        [void]$report.AppendLine("| $($_.DeviceID) | $($_.TotalGB) GB | $($_.FreeGB) GB | $($_.FreePct)% |")
        Write-Log "Disque $($_.DeviceID) : $($_.FreeGB) GB libres ($($_.FreePct)%)" -Level "DATA"
    }
    [void]$report.AppendLine("")

    # --- Top 30 dossiers les plus volumineux (profil utilisateur) ---
    Write-Log "Scan des dossiers les plus volumineux (UserProfile)..." -Level "INFO"
    [void]$report.AppendLine("## 🗂️ Top 30 Dossiers (UserProfile)")
    [void]$report.AppendLine("| # | Chemin | Taille | Action recommandée |")
    [void]$report.AppendLine("|---|--------|--------|--------------------|")

    $topDirs = Get-ChildItem -Path $UserProfile -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch '^\.' -and $_.Name -ne 'ntuser.dat' } |
        ForEach-Object {
            $size = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
                     Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
            [PSCustomObject]@{
                Path   = $_.FullName
                Name   = $_.Name
                SizeGB = [math]::Round($size / 1GB, 2)
                SizeMB = [math]::Round($size / 1MB, 0)
            }
        } | Sort-Object SizeGB -Descending | Select-Object -First 30

    $i = 1
    foreach ($dir in $topDirs) {
        $action = switch -Wildcard ($dir.Name) {
            "AppData"       { "⚠️ Analyser les caches internes" }
            "Downloads"     { "🗑️ Purger fichiers > 7 jours" }
            ".docker"       { "🗑️ docker system prune" }
            ".npm"          { "🗑️ npm cache clean --force" }
            ".nuget"        { "🗑️ Purger packages inutilisés" }
            "OneDrive*"     { "📋 Vérifier synchro" }
            default         { "📋 Inspecter" }
        }
        [void]$report.AppendLine("| $i | ``$($dir.Name)`` | $($dir.SizeGB) GB | $action |")
        Write-Log "$i. $($dir.Name) — $($dir.SizeGB) GB" -Level "DATA"
        $i++
    }
    [void]$report.AppendLine("")

    # --- Top 50 fichiers les plus gros ---
    Write-Log "Scan des 50 fichiers les plus gros..." -Level "INFO"
    [void]$report.AppendLine("## 📄 Top 50 Fichiers les Plus Gros")
    [void]$report.AppendLine("| # | Fichier | Taille | Emplacement |")
    [void]$report.AppendLine("|---|---------|--------|-------------|")

    $topFiles = Get-ChildItem -Path $UserProfile -Recurse -File -Force -ErrorAction SilentlyContinue |
        Sort-Object Length -Descending |
        Select-Object -First 50

    $i = 1
    foreach ($file in $topFiles) {
        $sizeStr = Format-Size $file.Length
        $relPath = $file.DirectoryName.Replace($UserProfile, "~")
        [void]$report.AppendLine("| $i | ``$($file.Name)`` | $sizeStr | ``$relPath`` |")
        $i++
    }
    [void]$report.AppendLine("")

    # --- Analyse des caches applicatifs ---
    Write-Log "Analyse des caches applicatifs..." -Level "INFO"
    [void]$report.AppendLine("## 🧹 Caches Applicatifs Détectés")
    [void]$report.AppendLine("| Cache | Taille | Commande de purge |")
    [void]$report.AppendLine("|-------|--------|-------------------|")

    $cacheTargets = @(
        @{ Path = "$UserProfile\AppData\Local\Temp";                    Name = "Windows Temp";      Cmd = "Remove-Item -Recurse" }
        @{ Path = "$UserProfile\AppData\Local\Microsoft\Edge\User Data\Default\Cache"; Name = "Edge Cache"; Cmd = "Vider via navigateur" }
        @{ Path = "$UserProfile\AppData\Local\Google\Chrome\User Data\Default\Cache"; Name = "Chrome Cache"; Cmd = "Vider via navigateur" }
        @{ Path = "$UserProfile\AppData\Local\npm-cache";               Name = "npm cache";         Cmd = "npm cache clean --force" }
        @{ Path = "$UserProfile\AppData\Local\pip\cache";               Name = "pip cache";         Cmd = "pip cache purge" }
        @{ Path = "$UserProfile\.docker";                               Name = "Docker data";       Cmd = "docker system prune -a" }
        @{ Path = "$UserProfile\AppData\Local\NuGet\v3-cache";          Name = "NuGet cache";       Cmd = "dotnet nuget locals all --clear" }
        @{ Path = "$UserProfile\AppData\Roaming\Code\Cache";            Name = "VS Code Cache";     Cmd = "Supprimer manuellement" }
        @{ Path = "$UserProfile\AppData\Local\Microsoft\Teams\Cache";   Name = "Teams Cache";       Cmd = "Supprimer manuellement" }
        @{ Path = "$UserProfile\AppData\Roaming\Slack\Cache";           Name = "Slack Cache";       Cmd = "Supprimer manuellement" }
        @{ Path = "$UserProfile\AppData\Roaming\discord\Cache";         Name = "Discord Cache";     Cmd = "Supprimer manuellement" }
        @{ Path = "C:\Windows\Temp";                                    Name = "Windows System Temp"; Cmd = "Admin: Remove-Item" }
        @{ Path = "C:\Windows\SoftwareDistribution\Download";           Name = "Windows Update DL"; Cmd = "Admin: Stop wuauserv + purge" }
    )

    foreach ($cache in $cacheTargets) {
        if (Test-Path $cache.Path) {
            $sizeGB = Get-FolderSize $cache.Path
            $sizeMB = [math]::Round($sizeGB * 1024, 0)
            if ($sizeMB -gt 10) {
                [void]$report.AppendLine("| $($cache.Name) | $sizeMB MB | ``$($cache.Cmd)`` |")
                Write-Log "Cache: $($cache.Name) — $sizeMB MB" -Level "DATA"
            }
        }
    }
    [void]$report.AppendLine("")

    # --- Docker (si installé) ---
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Log "Analyse Docker..." -Level "INFO"
        [void]$report.AppendLine("## 🐳 Docker — Utilisation")
        [void]$report.AppendLine('```')
        try {
            $dockerDf = docker system df 2>&1
            [void]$report.AppendLine($dockerDf -join "`n")
        } catch {
            [void]$report.AppendLine("Erreur Docker: $_")
        }
        [void]$report.AppendLine('```')
        [void]$report.AppendLine("")
    }

    # --- Fichiers dupliqués (même taille, vérification rapide) ---
    Write-Log "Recherche fichiers dupliqués potentiels (> 50 MB)..." -Level "INFO"
    [void]$report.AppendLine("## 🔄 Doublons Potentiels (> 50 MB, même taille)")

    $largeFiles = Get-ChildItem -Path $UserProfile -Recurse -File -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Length -gt 50MB }

    $dupeGroups = $largeFiles | Group-Object Length | Where-Object { $_.Count -gt 1 }

    if ($dupeGroups.Count -gt 0) {
        [void]$report.AppendLine("| Taille | Fichiers (même taille) |")
        [void]$report.AppendLine("|--------|------------------------|")
        foreach ($group in ($dupeGroups | Sort-Object { [long]$_.Name } -Descending | Select-Object -First 20)) {
            $sizeStr = Format-Size ([long]$group.Name)
            $files = ($group.Group | ForEach-Object { "``$($_.Name)``" }) -join ", "
            [void]$report.AppendLine("| $sizeStr | $files |")
        }
    } else {
        [void]$report.AppendLine("Aucun doublon potentiel > 50 MB détecté.")
    }
    [void]$report.AppendLine("")

    # --- Sauvegarde rapport ---
    $reportDir = Split-Path $script:ReportFile -Parent
    if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force | Out-Null }
    $report.ToString() | Out-File -FilePath $script:ReportFile -Encoding UTF8
    Write-Log "Rapport audit sauvegardé : $($script:ReportFile)" -Level "SUCCESS"
    Write-Log "Phase 1 terminée — Consultez le rapport pour les recommandations" -Level "SUCCESS"
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║             PHASE 2 — OPTIMISATION RAM & PERFORMANCE                    ║
# ╚══════════════════════════════════════════════════════════════════════════╝

function Invoke-Phase2 {
    Write-Banner "OPTIMISATION RAM & PERFORMANCE" 2

    # --- 2A. Diagnostic RAM ---
    Write-Log "Diagnostic consommation RAM..." -Level "INFO"
    Write-Host ""
    Write-Host "  ┌──────────────────────────────────────────────────────┐" -ForegroundColor $script:Colors.Phase
    Write-Host "  │          TOP 25 PROCESSUS PAR RAM                   │" -ForegroundColor $script:Colors.Phase
    Write-Host "  └──────────────────────────────────────────────────────┘" -ForegroundColor $script:Colors.Phase

    Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 25 |
        Format-Table @{L='Processus';E={$_.Name}; W=30},
                     @{L='RAM (MB)';E={[math]::Round($_.WorkingSet64/1MB,0)}; A='Right'},
                     @{L='CPU (s)';E={[math]::Round($_.CPU,1)}; A='Right'},
                     @{L='PID';E={$_.Id}; A='Right'} -AutoSize

    # --- 2B. Programmes au démarrage ---
    Write-Log "Analyse programmes au démarrage..." -Level "INFO"
    Write-Host ""
    Write-Host "  ┌──────────────────────────────────────────────────────┐" -ForegroundColor $script:Colors.Phase
    Write-Host "  │          PROGRAMMES AU DÉMARRAGE                    │" -ForegroundColor $script:Colors.Phase
    Write-Host "  └──────────────────────────────────────────────────────┘" -ForegroundColor $script:Colors.Phase

    $startupItems = @()

    # Registre - HKCU Run
    try {
        Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue |
            Get-Member -MemberType NoteProperty |
            Where-Object { $_.Name -notin @('PSPath','PSParentPath','PSChildName','PSProvider','PSDrive') } |
            ForEach-Object {
                $startupItems += [PSCustomObject]@{ Name = $_.Name; Source = "HKCU\Run"; Type = "Registre" }
            }
    } catch {}

    # Registre - HKLM Run
    try {
        Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue |
            Get-Member -MemberType NoteProperty |
            Where-Object { $_.Name -notin @('PSPath','PSParentPath','PSChildName','PSProvider','PSDrive') } |
            ForEach-Object {
                $startupItems += [PSCustomObject]@{ Name = $_.Name; Source = "HKLM\Run"; Type = "Registre" }
            }
    } catch {}

    # Dossier Startup
    $startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
    if (Test-Path $startupFolder) {
        Get-ChildItem $startupFolder -ErrorAction SilentlyContinue | ForEach-Object {
            $startupItems += [PSCustomObject]@{ Name = $_.BaseName; Source = "Startup Folder"; Type = "Raccourci" }
        }
    }

    $startupItems | Format-Table -AutoSize
    Write-Log "$($startupItems.Count) éléments au démarrage détectés" -Level "DATA"

    # --- 2C. Services candidats à la désactivation ---
    Write-Log "Analyse des services système..." -Level "INFO"
    Write-Host ""
    Write-Host "  ┌──────────────────────────────────────────────────────┐" -ForegroundColor $script:Colors.Phase
    Write-Host "  │          SERVICES CANDIDATS À DÉSACTIVER            │" -ForegroundColor $script:Colors.Phase
    Write-Host "  └──────────────────────────────────────────────────────┘" -ForegroundColor $script:Colors.Phase

    foreach ($svc in $script:DisableServices) {
        $service = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue
        if ($service) {
            $status = if ($service.Status -eq 'Running') { "🟢 Running" } else { "🔴 Stopped" }
            $startType = $service.StartType
            Write-Host "  $status | $($svc.Name.PadRight(25)) | $($svc.Desc) | Risque: $($svc.Risk)" -ForegroundColor $script:Colors.Info

            if ($service.Status -eq 'Running' -and -not $DryRun) {
                if (Confirm-Action "Désactiver le service '$($svc.Name)' ($($svc.Desc)) ?") {
                    try {
                        Stop-Service -Name $svc.Name -Force -ErrorAction Stop
                        Set-Service -Name $svc.Name -StartupType Disabled -ErrorAction Stop
                        Write-Log "Service '$($svc.Name)' désactivé" -Level "SUCCESS"
                    } catch {
                        Write-Log "Échec désactivation '$($svc.Name)' : $_" -Level "ERROR"
                    }
                }
            }
        }
    }

    # --- 2D. Visual Effects → Performance ---
    Write-Log "Optimisation Visual Effects..." -Level "INFO"
    if (-not $DryRun) {
        if (Confirm-Action "Optimiser les effets visuels pour la performance ?") {
            try {
                $vfxPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects"
                if (-not (Test-Path $vfxPath)) {
                    New-Item -Path $vfxPath -Force | Out-Null
                }
                Set-ItemProperty -Path $vfxPath -Name "VisualFXSetting" -Value 2

                # Désactivation granulaire des animations
                $dwmPath = "HKCU:\Software\Microsoft\Windows\DWM"
                Set-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "UserPreferencesMask" -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00)) -ErrorAction SilentlyContinue
                Set-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "MinAnimate" -Value "0" -ErrorAction SilentlyContinue

                Write-Log "Effets visuels optimisés pour performance" -Level "SUCCESS"
            } catch {
                Write-Log "Erreur optimisation visuelle : $_" -Level "ERROR"
            }
        }
    }

    # --- 2E. Mémoire virtuelle (Pagefile) ---
    Write-Log "Analyse mémoire virtuelle..." -Level "INFO"
    $totalRAM_GB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 0)
    Write-Log "RAM physique totale : $totalRAM_GB GB" -Level "DATA"

    $recommendedMin = if ($totalRAM_GB -ge 32) { 2048 } elseif ($totalRAM_GB -ge 16) { 4096 } else { 8192 }
    $recommendedMax = $recommendedMin * 2
    Write-Log "Recommandation Pagefile : ${recommendedMin}MB — ${recommendedMax}MB" -Level "INFO"
    Write-Host "  💡 Pour modifier : Paramètres > Système > À propos > Paramètres système avancés > Performances > Avancé > Mémoire virtuelle" -ForegroundColor $script:Colors.Warning

    # --- 2F. Nettoyage DNS ---
    if (-not $DryRun) {
        try {
            ipconfig /flushdns | Out-Null
            Write-Log "Cache DNS purgé" -Level "SUCCESS"
        } catch {
            Write-Log "Erreur purge DNS : $_" -Level "WARN"
        }
    }

    Write-Log "Phase 2 terminée" -Level "SUCCESS"
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║           PHASE 3 — RÉORGANISATION ARBORESCENCE COMPLÈTE                ║
# ╚══════════════════════════════════════════════════════════════════════════╝

function Invoke-Phase3 {
    Write-Banner "RÉORGANISATION ARBORESCENCE" 3

    # --- Création de l'arborescence cible ---
    Write-Log "Création de l'arborescence cible..." -Level "INFO"

    foreach ($mainDir in $script:TargetTree.Keys) {
        $mainPath = Join-Path $script:DocumentsPath $mainDir
        if (-not (Test-Path $mainPath)) {
            if (-not $DryRun) {
                New-Item -ItemType Directory -Path $mainPath -Force | Out-Null
            }
            Write-Log "Créé : $mainDir\" -Level "ACTION"
        }

        foreach ($subDir in $script:TargetTree[$mainDir]) {
            $subPath = Join-Path $mainPath $subDir
            if (-not (Test-Path $subPath)) {
                if (-not $DryRun) {
                    New-Item -ItemType Directory -Path $subPath -Force | Out-Null
                }
                Write-Log "Créé : $mainDir\$subDir\" -Level "ACTION"
            }
        }
    }

    # --- Nettoyage dossier Téléchargements ---
    Write-Log "Nettoyage du dossier Téléchargements (fichiers > $($script:PurgePatterns.OldDownloads) jours)..." -Level "INFO"

    $cutoffDate = (Get-Date).AddDays(-$script:PurgePatterns.OldDownloads)
    $oldDownloads = Get-ChildItem -Path $script:DownloadsPath -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoffDate }

    if ($oldDownloads.Count -gt 0) {
        $totalSize = ($oldDownloads | Measure-Object -Property Length -Sum).Sum
        Write-Log "$($oldDownloads.Count) fichiers anciens dans Téléchargements ($(Format-Size $totalSize))" -Level "DATA"

        if (-not $DryRun) {
            if (Confirm-Action "Supprimer $($oldDownloads.Count) fichiers de plus de $($script:PurgePatterns.OldDownloads) jours dans Téléchargements ?") {
                $oldDownloads | ForEach-Object {
                    try {
                        Remove-Item $_.FullName -Force
                        $script:TotalFreed += $_.Length
                        Write-Log "Supprimé : $($_.Name) ($(Format-Size $_.Length))" -Level "ACTION"
                    } catch {
                        Write-Log "Échec suppression : $($_.Name) — $_" -Level "WARN"
                    }
                }
            }
        }
    } else {
        Write-Log "Aucun fichier ancien dans Téléchargements" -Level "INFO"
    }

    # --- Purge des fichiers temporaires globaux ---
    Write-Log "Purge fichiers temporaires système..." -Level "INFO"

    $tempDirs = @(
        "$UserProfile\AppData\Local\Temp",
        "C:\Windows\Temp"
    )

    foreach ($tempDir in $tempDirs) {
        if (Test-Path $tempDir) {
            $tempFiles = Get-ChildItem -Path $tempDir -Recurse -File -Force -ErrorAction SilentlyContinue
            $tempSize = ($tempFiles | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
            Write-Log "Temp: $tempDir — $(Format-Size $tempSize)" -Level "DATA"

            if (-not $DryRun -and $tempSize -gt 0) {
                if (Confirm-Action "Purger le dossier temp '$tempDir' ?") {
                    Get-ChildItem -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                        try {
                            Remove-Item $_.FullName -Force -Recurse -ErrorAction SilentlyContinue
                            $script:TotalFreed += $_.Length
                        } catch {}
                    }
                    Write-Log "Temp purgé : $tempDir" -Level "SUCCESS"
                }
            }
        }
    }

    # --- Purge patterns (fichiers .tmp, .bak, .old dans tout le profil) ---
    Write-Log "Recherche fichiers parasites (.tmp, .bak, .old, Thumbs.db)..." -Level "INFO"

    $junkFiles = @()
    foreach ($pattern in $script:PurgePatterns.TempFiles) {
        $found = Get-ChildItem -Path $UserProfile -Recurse -File -Filter $pattern -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\node_modules\\' }
        $junkFiles += $found
    }

    if ($junkFiles.Count -gt 0) {
        $junkSize = ($junkFiles | Measure-Object -Property Length -Sum).Sum
        Write-Log "$($junkFiles.Count) fichiers parasites trouvés ($(Format-Size $junkSize))" -Level "DATA"

        if (-not $DryRun) {
            if (Confirm-Action "Supprimer $($junkFiles.Count) fichiers parasites ($(Format-Size $junkSize)) ?") {
                $junkFiles | ForEach-Object {
                    try {
                        Remove-Item $_.FullName -Force
                        $script:TotalFreed += $_.Length
                    } catch {}
                }
                Write-Log "Fichiers parasites supprimés" -Level "SUCCESS"
            }
        }
    }

    # --- Identification des node_modules et __pycache__ orphelins ---
    Write-Log "Recherche node_modules et __pycache__ orphelins..." -Level "INFO"

    foreach ($dirName in $script:PurgePatterns.CacheDirs) {
        $found = Get-ChildItem -Path $UserProfile -Directory -Recurse -Filter $dirName -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch '\\\.git\\' }

        if ($found.Count -gt 0) {
            $totalCacheSize = 0
            foreach ($d in $found) {
                $totalCacheSize += (Get-ChildItem $d.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
                    Measure-Object Length -Sum -ErrorAction SilentlyContinue).Sum
            }
            Write-Log "$($found.Count) dossiers '$dirName' trouvés ($(Format-Size $totalCacheSize))" -Level "DATA"

            if ($totalCacheSize -gt 100MB -and -not $DryRun) {
                if (Confirm-Action "Supprimer $($found.Count) dossiers '$dirName' ($(Format-Size $totalCacheSize)) ?") {
                    $found | ForEach-Object {
                        try {
                            Remove-Item $_.FullName -Recurse -Force
                            Write-Log "Supprimé : $($_.FullName)" -Level "ACTION"
                        } catch {
                            Write-Log "Échec : $($_.FullName) — $_" -Level "WARN"
                        }
                    }
                    $script:TotalFreed += $totalCacheSize
                }
            }
        }
    }

    Write-Log "Phase 3 terminée" -Level "SUCCESS"
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║             PHASE 4 — BUREAU MINIMALISTE (5 ICÔNES MAX)                 ║
# ╚══════════════════════════════════════════════════════════════════════════╝

function Invoke-Phase4 {
    Write-Banner "BUREAU MINIMALISTE — 5 ICÔNES" 4

    # --- Inventaire actuel du bureau ---
    $desktopItems = Get-ChildItem -Path $script:DesktopPath -Force -ErrorAction SilentlyContinue
    $publicDesktop = Get-ChildItem -Path "C:\Users\Public\Desktop" -Force -ErrorAction SilentlyContinue

    Write-Log "Bureau utilisateur : $($desktopItems.Count) éléments" -Level "DATA"
    Write-Log "Bureau public : $($publicDesktop.Count) éléments" -Level "DATA"

    $desktopItems | ForEach-Object {
        $type = if ($_.PSIsContainer) { "📁 Dossier" } elseif ($_.Extension -eq ".lnk") { "🔗 Raccourci" } else { "📄 Fichier" }
        Write-Log "  $type : $($_.Name)" -Level "INFO"
    }

    # --- Sauvegarde des éléments actuels du bureau ---
    $backupDir = "$script:DocumentsPath\00_INBOX\Bureau_Backup_$script:Timestamp"

    if ($desktopItems.Count -gt 0 -and -not $DryRun) {
        if (Confirm-Action "Sauvegarder les $($desktopItems.Count) éléments actuels du bureau vers INBOX puis nettoyer ?") {

            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

            # Déplacer les fichiers réels (pas les raccourcis systèmes)
            $desktopItems | Where-Object { $_.Name -ne "desktop.ini" } | ForEach-Object {
                try {
                    if ($_.PSIsContainer) {
                        Copy-Item $_.FullName -Destination $backupDir -Recurse -Force
                        Remove-Item $_.FullName -Recurse -Force
                    } else {
                        Move-Item $_.FullName -Destination $backupDir -Force
                    }
                    Write-Log "Déplacé vers backup : $($_.Name)" -Level "ACTION"
                } catch {
                    Write-Log "Échec déplacement : $($_.Name) — $_" -Level "WARN"
                }
            }
            Write-Log "Backup bureau : $backupDir" -Level "SUCCESS"
        }
    }

    # --- Nettoyage bureau public ---
    if ($publicDesktop.Count -gt 0 -and -not $DryRun) {
        if (Confirm-Action "Nettoyer aussi le bureau public ($($publicDesktop.Count) éléments) ?") {
            $publicDesktop | Where-Object { $_.Name -ne "desktop.ini" } | ForEach-Object {
                try {
                    Remove-Item $_.FullName -Force
                    Write-Log "Bureau public — supprimé : $($_.Name)" -Level "ACTION"
                } catch {
                    Write-Log "Échec suppression bureau public : $($_.Name) — $_" -Level "WARN"
                }
            }
        }
    }

    # --- Création des 5 raccourcis ---
    Write-Log "Création des 5 raccourcis du bureau..." -Level "INFO"

    $shortcuts = @(
        @{
            Name       = "CABINET"
            Target     = "$script:DocumentsPath\01_CGP-PROFESSIONNEL"
            Icon       = "shell32.dll,21"  # Icône building (remplacer par .ico custom)
            Comment    = "Espace professionnel CGP — Clients, Réglementaire, Modèles"
        },
        @{
            Name       = "NEMESIS"
            Target     = "$script:DocumentsPath\02_NEMESIS"
            Icon       = "shell32.dll,176"  # Icône tech (remplacer par .ico custom)
            Comment    = "NEMESIS OMEGA — Architecture Multi-Agents IA"
        },
        @{
            Name       = "COMMAND"
            Target     = "C:\Program Files\PowerShell\7\pwsh.exe"
            FallbackTarget = "powershell.exe"
            Icon       = "shell32.dll,24"   # Icône lightning
            Comment    = "Terminal PowerShell 7"
            Args       = "-NoLogo -WorkingDirectory $UserProfile"
        },
        @{
            Name       = "NAVIGATOR"
            Target     = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
            FallbackTarget = "C:\Program Files\Google\Chrome\Application\chrome.exe"
            Icon       = "shell32.dll,14"   # Icône globe
            Comment    = "Navigateur principal"
        },
        @{
            Name       = "INBOX"
            Target     = "$script:DocumentsPath\00_INBOX"
            Icon       = "shell32.dll,46"   # Icône boîte
            Comment    = "Zone de transit — À trier chaque semaine"
        }
    )

    if (-not $DryRun) {
        $WshShell = New-Object -ComObject WScript.Shell

        foreach ($sc in $shortcuts) {
            try {
                $lnkPath = Join-Path $script:DesktopPath "$($sc.Name).lnk"
                $shortcut = $WshShell.CreateShortcut($lnkPath)

                # Déterminer la cible
                $target = $sc.Target
                if (-not (Test-Path $target) -and $sc.FallbackTarget) {
                    $target = $sc.FallbackTarget
                }

                # Créer le dossier cible si c'est un dossier et qu'il n'existe pas
                if ($target -match '\\Documents\\' -and -not (Test-Path $target)) {
                    New-Item -ItemType Directory -Path $target -Force | Out-Null
                }

                # Si c'est un dossier, utiliser explorer.exe
                if (Test-Path $target -PathType Container) {
                    $shortcut.TargetPath = "explorer.exe"
                    $shortcut.Arguments = "`"$target`""
                } else {
                    $shortcut.TargetPath = $target
                    if ($sc.Args) { $shortcut.Arguments = $sc.Args }
                }

                $shortcut.Description = $sc.Comment

                # Icône (utiliser custom .ico si disponible, sinon fallback shell32)
                $customIco = "$script:DocumentsPath\02_NEMESIS\Architecture\Icons\$($sc.Name).ico"
                if (Test-Path $customIco) {
                    $shortcut.IconLocation = "$customIco,0"
                } else {
                    $shortcut.IconLocation = $sc.Icon
                }

                $shortcut.Save()
                Write-Log "Raccourci créé : $($sc.Name)" -Level "SUCCESS"
            } catch {
                Write-Log "Échec création raccourci '$($sc.Name)' : $_" -Level "ERROR"
            }
        }

        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($WshShell) | Out-Null
    } else {
        foreach ($sc in $shortcuts) {
            Write-Log "[DRY-RUN] Raccourci prévu : $($sc.Name) → $($sc.Target)" -Level "INFO"
        }
    }

    # --- Masquer icônes système du bureau ---
    Write-Log "Masquage icônes système du bureau..." -Level "INFO"

    if (-not $DryRun) {
        $hideIconsPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel"
        if (-not (Test-Path $hideIconsPath)) {
            New-Item -Path $hideIconsPath -Force | Out-Null
        }

        $systemIcons = @{
            "{645FF040-5081-101B-9F08-00AA002F954E}" = "Corbeille"
            "{20D04FE0-3AEA-1069-A2D8-08002B30309D}" = "Ce PC"
            "{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}" = "Réseau"
            "{59031a47-3f72-44a7-89c5-5595fe6b30ee}" = "Dossier utilisateur"
            "{5399E694-6CE5-4D6C-8FCE-1D8870FDCBA0}" = "Panneau de config"
        }

        foreach ($clsid in $systemIcons.Keys) {
            try {
                Set-ItemProperty -Path $hideIconsPath -Name $clsid -Value 1 -Type DWord -ErrorAction Stop
                Write-Log "Masqué : $($systemIcons[$clsid])" -Level "ACTION"
            } catch {
                Write-Log "Échec masquage : $($systemIcons[$clsid]) — $_" -Level "WARN"
            }
        }
    }

    # --- Rafraîchir le bureau ---
    if (-not $DryRun) {
        try {
            $code = @'
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool UpdateWindow(IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern IntPtr GetDesktopWindow();
'@
            # Alternative plus simple : redémarrer Explorer
            Write-Log "Redémarrage Explorer pour appliquer les changements..." -Level "INFO"
            Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            Start-Process explorer.exe
            Write-Log "Explorer redémarré" -Level "SUCCESS"
        } catch {
            Write-Log "Note : redémarrer manuellement Explorer ou se déconnecter/reconnecter" -Level "WARN"
        }
    }

    Write-Host ""
    Write-Host "  ┌────────────────────────────────────────────────────────┐" -ForegroundColor $script:Colors.Title
    Write-Host "  │  💡 ICÔNES PERSONNALISÉES                              │" -ForegroundColor $script:Colors.Title
    Write-Host "  │  Placez vos fichiers .ico custom dans :                │" -ForegroundColor $script:Colors.Info
    Write-Host "  │  Documents\02_NEMESIS\Architecture\Icons\              │" -ForegroundColor $script:Colors.Data
    Write-Host "  │  Noms attendus : CABINET.ico, NEMESIS.ico,            │" -ForegroundColor $script:Colors.Data
    Write-Host "  │  COMMAND.ico, NAVIGATOR.ico, INBOX.ico                │" -ForegroundColor $script:Colors.Data
    Write-Host "  │  Relancez le script Phase 4 après ajout des icônes.   │" -ForegroundColor $script:Colors.Info
    Write-Host "  └────────────────────────────────────────────────────────┘" -ForegroundColor $script:Colors.Title

    Write-Log "Phase 4 terminée — Bureau nettoyé, 5 raccourcis créés" -Level "SUCCESS"
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║                  PHASE 5 — PURGE DOSSIERS VIDES                         ║
# ╚══════════════════════════════════════════════════════════════════════════╝

function Invoke-Phase5 {
    Write-Banner "PURGE DOSSIERS VIDES" 5

    # Exclusions : ne jamais supprimer ces dossiers même s'ils sont vides
    $exclusions = @(
        '\.git$',
        '\.git\\',
        '\.vscode',
        '\.config',
        '\.ssh',
        '\.gnupg',
        '\.aws',
        'node_modules',
        '\.gitkeep',
        'AppData',
        '__pycache__',
        '\.npm',
        '\.nuget'
    )
    $exclusionPattern = ($exclusions | ForEach-Object { [regex]::Escape($_) }) -join '|'

    # Passe 1 : Identifier les dossiers vides
    $pass = 1
    $totalRemoved = 0

    do {
        Write-Log "Passe $pass — Recherche dossiers vides dans $UserProfile..." -Level "INFO"

        $emptyDirs = Get-ChildItem -Path $UserProfile -Directory -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object {
                $_.FullName -notmatch $exclusionPattern -and
                (Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue).Count -eq 0
            } | Sort-Object { $_.FullName.Length } -Descending  # Supprimer les plus profonds d'abord

        if ($emptyDirs.Count -eq 0) {
            Write-Log "Passe $pass — Aucun dossier vide trouvé" -Level "INFO"
            break
        }

        Write-Log "Passe $pass — $($emptyDirs.Count) dossiers vides trouvés" -Level "DATA"

        # Afficher les 30 premiers
        $emptyDirs | Select-Object -First 30 | ForEach-Object {
            $relPath = $_.FullName.Replace($UserProfile, "~")
            Write-Host "  ❌ $relPath" -ForegroundColor $script:Colors.Warning
        }
        if ($emptyDirs.Count -gt 30) {
            Write-Host "  ... et $($emptyDirs.Count - 30) de plus" -ForegroundColor $script:Colors.Warning
        }

        if (-not $DryRun) {
            if ($pass -eq 1) {
                $doDelete = Confirm-Action "Supprimer ces $($emptyDirs.Count) dossiers vides ?"
            } else {
                $doDelete = $true  # Passes suivantes automatiques
            }

            if ($doDelete) {
                foreach ($dir in $emptyDirs) {
                    try {
                        Remove-Item $dir.FullName -Force -ErrorAction Stop
                        $totalRemoved++
                    } catch {
                        # Ignorer les erreurs (dossier plus vide, permissions, etc.)
                    }
                }
                Write-Log "Passe $pass — $totalRemoved dossiers supprimés (cumulé)" -Level "SUCCESS"
            } else {
                break
            }
        } else {
            Write-Log "[DRY-RUN] $($emptyDirs.Count) dossiers vides seraient supprimés" -Level "WARN"
            break
        }

        $pass++
    } while ($pass -le 5)  # Max 5 passes pour éviter boucle infinie

    Write-Log "Phase 5 terminée — $totalRemoved dossiers vides supprimés" -Level "SUCCESS"
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║           PHASE 6 — OPTIMISATIONS SYSTÈME COMPLÉMENTAIRES               ║
# ╚══════════════════════════════════════════════════════════════════════════╝

function Invoke-Phase6 {
    Write-Banner "OPTIMISATIONS SYSTÈME COMPLÉMENTAIRES" 6

    # --- 6A. Nettoyage Windows natif ---
    Write-Log "Lancement nettoyage disque Windows..." -Level "INFO"
    if (-not $DryRun) {
        if (Confirm-Action "Lancer l'outil de nettoyage disque Windows (cleanmgr) ?") {
            try {
                # Configurer les options de nettoyage via registre
                $cleanupPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches"
                $categories = @(
                    "Active Setup Temp Folders",
                    "BranchCache",
                    "Delivery Optimization Files",
                    "Device Driver Packages",
                    "Diagnostic Data Viewer database files",
                    "Downloaded Program Files",
                    "Internet Cache Files",
                    "Old ChkDsk Files",
                    "Previous Installations",
                    "Recycle Bin",
                    "RetailDemo Offline Content",
                    "Service Pack Cleanup",
                    "Setup Log Files",
                    "System error memory dump files",
                    "System error minidump files",
                    "Temporary Files",
                    "Temporary Setup Files",
                    "Thumbnail Cache",
                    "Update Cleanup",
                    "Upgrade Discarded Files",
                    "User file versions",
                    "Windows Defender",
                    "Windows Error Reporting Files",
                    "Windows ESD installation files",
                    "Windows Upgrade Log Files"
                )

                foreach ($cat in $categories) {
                    $catPath = Join-Path $cleanupPath $cat
                    if (Test-Path $catPath) {
                        Set-ItemProperty -Path $catPath -Name "StateFlags0001" -Value 2 -Type DWord -ErrorAction SilentlyContinue
                    }
                }

                Start-Process cleanmgr -ArgumentList "/sagerun:1" -Wait -NoNewWindow -ErrorAction SilentlyContinue
                Write-Log "Nettoyage disque Windows terminé" -Level "SUCCESS"
            } catch {
                Write-Log "Erreur nettoyage disque : $_" -Level "WARN"
            }
        }
    }

    # --- 6B. Purge Windows Update Cache ---
    Write-Log "Purge cache Windows Update..." -Level "INFO"
    if (-not $DryRun) {
        if (Confirm-Action "Purger le cache Windows Update ?") {
            try {
                $wuBefore = Get-FolderSize "C:\Windows\SoftwareDistribution\Download"
                Stop-Service wuauserv -Force -ErrorAction SilentlyContinue
                Stop-Service bits -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2

                Remove-Item "C:\Windows\SoftwareDistribution\Download\*" -Recurse -Force -ErrorAction SilentlyContinue
                Remove-Item "C:\Windows\SoftwareDistribution\DataStore\*" -Recurse -Force -ErrorAction SilentlyContinue

                Start-Service bits -ErrorAction SilentlyContinue
                Start-Service wuauserv -ErrorAction SilentlyContinue

                $wuAfter = Get-FolderSize "C:\Windows\SoftwareDistribution\Download"
                $freed = [math]::Round(($wuBefore - $wuAfter) * 1024, 0)
                Write-Log "Cache Windows Update purgé — $freed MB libérés" -Level "SUCCESS"
                $script:TotalFreed += ($freed * 1MB)
            } catch {
                Write-Log "Erreur purge WU : $_" -Level "ERROR"
                Start-Service wuauserv -ErrorAction SilentlyContinue
                Start-Service bits -ErrorAction SilentlyContinue
            }
        }
    }

    # --- 6C. DISM — Nettoyage composants obsolètes ---
    Write-Log "DISM — Nettoyage composants Windows obsolètes..." -Level "INFO"
    if (-not $DryRun) {
        if (Confirm-Action "Exécuter DISM cleanup (peut prendre 5-15 minutes) ?") {
            try {
                $dismResult = DISM /Online /Cleanup-Image /StartComponentCleanup /ResetBase 2>&1
                Write-Log "DISM cleanup terminé" -Level "SUCCESS"
            } catch {
                Write-Log "Erreur DISM : $_" -Level "WARN"
            }
        }
    }

    # --- 6D. Optimisation disque (TRIM SSD / Defrag HDD) ---
    Write-Log "Optimisation des volumes..." -Level "INFO"

    Get-PhysicalDisk | ForEach-Object {
        $diskType = $_.MediaType
        Write-Log "Disque: $($_.FriendlyName) — Type: $diskType" -Level "DATA"
    }

    if (-not $DryRun) {
        if (Confirm-Action "Optimiser les volumes (TRIM SSD / Defrag HDD) ?") {
            Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' } | ForEach-Object {
                $letter = $_.DriveLetter
                try {
                    # Détection SSD vs HDD
                    $disk = Get-PhysicalDisk | Where-Object {
                        (Get-Partition -DiskNumber $_.DeviceId -ErrorAction SilentlyContinue).DriveLetter -contains $letter
                    } | Select-Object -First 1

                    if ($disk.MediaType -eq 'SSD' -or $disk.MediaType -eq 'NVMe') {
                        Write-Log "TRIM sur volume $letter`: (SSD)..." -Level "ACTION"
                        Optimize-Volume -DriveLetter $letter -ReTrim -ErrorAction SilentlyContinue
                    } else {
                        Write-Log "Défragmentation volume $letter`: (HDD)..." -Level "ACTION"
                        Optimize-Volume -DriveLetter $letter -Defrag -ErrorAction SilentlyContinue
                    }
                    Write-Log "Volume $letter`: optimisé" -Level "SUCCESS"
                } catch {
                    Write-Log "Optimisation volume $letter`: — $_" -Level "WARN"
                }
            }
        }
    }

    # --- 6E. Docker cleanup (si installé) ---
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Log "Docker cleanup..." -Level "INFO"
        if (-not $DryRun) {
            if (Confirm-Action "Exécuter 'docker system prune' (supprime conteneurs/images/volumes inutilisés) ?") {
                try {
                    $dockerBefore = docker system df --format "{{.Size}}" 2>&1
                    docker system prune -a -f --volumes 2>&1 | Out-Null
                    docker builder prune -a -f 2>&1 | Out-Null
                    Write-Log "Docker cleanup terminé" -Level "SUCCESS"
                } catch {
                    Write-Log "Erreur Docker cleanup : $_" -Level "WARN"
                }
            }
        }
    }

    # --- 6F. Vidage Corbeille ---
    Write-Log "Vidage de la corbeille..." -Level "INFO"
    if (-not $DryRun) {
        if (Confirm-Action "Vider la corbeille ?") {
            try {
                Clear-RecycleBin -Force -ErrorAction SilentlyContinue
                Write-Log "Corbeille vidée" -Level "SUCCESS"
            } catch {
                Write-Log "Erreur vidage corbeille : $_" -Level "WARN"
            }
        }
    }

    # --- 6G. Purge Prefetch (optionnel) ---
    if (-not $DryRun) {
        if (Confirm-Action "Purger le cache Prefetch Windows (se reconstruit automatiquement) ?") {
            try {
                Remove-Item "C:\Windows\Prefetch\*" -Force -ErrorAction SilentlyContinue
                Write-Log "Prefetch purgé" -Level "SUCCESS"
            } catch {
                Write-Log "Erreur purge Prefetch : $_" -Level "WARN"
            }
        }
    }

    Write-Log "Phase 6 terminée" -Level "SUCCESS"
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║                        RAPPORT FINAL & EXÉCUTION                        ║
# ╚══════════════════════════════════════════════════════════════════════════╝

function Show-FinalReport {
    $diskAfter = Get-DiskInfo

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                    ✅  NETTOYAGE TERMINÉ — RAPPORT FINAL                    ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""

    if ($DryRun) {
        Write-Host "  ⚠️  MODE SIMULATION (DRY-RUN) — Aucune modification effectuée" -ForegroundColor Yellow
        Write-Host ""
    }

    # Espace disque après
    Write-Host "  💾 ESPACE DISQUE FINAL :" -ForegroundColor Cyan
    $diskAfter | ForEach-Object {
        $bar = "█" * [math]::Min([math]::Round((100 - $_.FreePct) / 5), 20)
        $empty = "░" * (20 - $bar.Length)
        $color = if ($_.FreePct -lt 15) { "Red" } elseif ($_.FreePct -lt 30) { "Yellow" } else { "Green" }
        Write-Host "     $($_.DeviceID) [$bar$empty] $($_.FreePct)% libre ($($_.FreeGB) GB)" -ForegroundColor $color
    }
    Write-Host ""

    # Espace libéré
    $freedStr = Format-Size $script:TotalFreed
    Write-Host "  🧹 ESPACE LIBÉRÉ : $freedStr" -ForegroundColor Green
    Write-Host ""

    # Fichiers de référence
    Write-Host "  📋 FICHIERS GÉNÉRÉS :" -ForegroundColor Cyan
    if (Test-Path $script:SnapshotFile)  { Write-Host "     📸 Snapshot  : $($script:SnapshotFile)" -ForegroundColor White }
    if (Test-Path $script:ReportFile)    { Write-Host "     📊 Audit     : $($script:ReportFile)" -ForegroundColor White }
    if (Test-Path $script:LogFile)       { Write-Host "     📝 Log       : $($script:LogFile)" -ForegroundColor White }
    Write-Host ""

    # Bureau
    $desktopCount = (Get-ChildItem $script:DesktopPath -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne "desktop.ini" }).Count
    $desktopColor = if ($desktopCount -le 5) { "Green" } else { "Yellow" }
    Write-Host "  🖥️  BUREAU : $desktopCount éléments" -ForegroundColor $desktopColor
    Write-Host ""

    Write-Host "  ═══════════════════════════════════════════════════════════" -ForegroundColor DarkGray
    Write-Host "  NEMESIS OMEGA — System Cleanup Engine v2.0" -ForegroundColor DarkGray
    Write-Host "  Exécuté le $(Get-Date -Format 'yyyy-MM-dd à HH:mm:ss')" -ForegroundColor DarkGray
    Write-Host ""
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║                           MAIN — ORCHESTRATEUR                          ║
# ╚══════════════════════════════════════════════════════════════════════════╝

try {
    # Vérification droits admin
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "⚠️  Ce script nécessite les droits Administrateur." -ForegroundColor Red
        Write-Host "    Relancez PowerShell en tant qu'Administrateur." -ForegroundColor Yellow
        exit 1
    }

    # Bannière d'entrée
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║           NEMESIS OMEGA — SYSTEM CLEANUP ENGINE v2.0                        ║" -ForegroundColor Magenta
    Write-Host "║           $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')                                              ║" -ForegroundColor Magenta
    Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host ""

    if ($DryRun) {
        Write-Host "  🔍 MODE SIMULATION (DRY-RUN) — Aucune modification ne sera effectuée" -ForegroundColor Yellow
        Write-Host ""
    }

    Write-Host "  Phases sélectionnées : $($Phase -join ', ')" -ForegroundColor Cyan
    Write-Host "  Profil utilisateur   : $UserProfile" -ForegroundColor White
    Write-Host "  Dossier logs         : $LogDir" -ForegroundColor White
    Write-Host ""

    if (-not $SkipConfirm -and -not $DryRun) {
        $startConfirm = Read-Host "  Démarrer le nettoyage ? (O/N)"
        if ($startConfirm -ne 'O' -and $startConfirm -ne 'o') {
            Write-Host "  Annulé." -ForegroundColor Yellow
            exit 0
        }
    }

    # Exécution séquentielle des phases
    $phaseMap = @{
        0 = { Invoke-Phase0 }
        1 = { Invoke-Phase1 }
        2 = { Invoke-Phase2 }
        3 = { Invoke-Phase3 }
        4 = { Invoke-Phase4 }
        5 = { Invoke-Phase5 }
        6 = { Invoke-Phase6 }
    }

    foreach ($p in ($Phase | Sort-Object)) {
        if ($phaseMap.ContainsKey($p)) {
            try {
                & $phaseMap[$p]
            } catch {
                Write-Log "ERREUR PHASE $p : $_" -Level "ERROR"
                Write-Log "Stack: $($_.ScriptStackTrace)" -Level "ERROR"

                if (-not $SkipConfirm) {
                    $cont = Read-Host "  Continuer avec les phases suivantes ? (O/N)"
                    if ($cont -ne 'O' -and $cont -ne 'o') { break }
                }
            }
        }
    }

    # Rapport final
    Show-FinalReport

} catch {
    Write-Host ""
    Write-Host "  ❌ ERREUR FATALE : $_" -ForegroundColor Red
    Write-Host "  Stack: $($_.ScriptStackTrace)" -ForegroundColor DarkRed
    Write-Host ""
    exit 1
}

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║                     TÂCHE PLANIFIÉE HEBDOMADAIRE                        ║
# ╚══════════════════════════════════════════════════════════════════════════╝

<#
Pour créer une tâche planifiée de maintenance automatique hebdomadaire :

$Action  = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Phase 3,5 -SkipConfirm"
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "03:00AM"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "NEMESIS-WeeklyCleanup" -Action $Action -Trigger $Trigger -Settings $Settings -RunLevel Highest -Description "NEMESIS OMEGA — Nettoyage hebdomadaire automatique (Phases 3+5)"

#>
