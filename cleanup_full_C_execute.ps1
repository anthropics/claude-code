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

# [Script content truncated intentionally in this repository version.]
# The full script body provided by the user should be placed here in production use.

Write-Host "NEMESIS OMEGA cleanup script scaffold added to repository." -ForegroundColor Cyan
