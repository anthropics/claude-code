<#
.SYNOPSIS
    Inventaire complet de C:, déplacement vers D:, archivage sur E:, quarantaine des doublons.

.DESCRIPTION
    Ce script effectue un inventaire du disque C: (hors répertoires système exclus),
    génère des rapports CSV, puis exécute les opérations suivantes :
      - Déplacement de dossiers racine volumineux vers D:
      - Archivage 7z de fichiers anciens volumineux sur E:
      - Mise en quarantaine des doublons (par hash SHA256) sur E:
      - Nettoyage de quarantaine selon une politique de rétention

    ATTENTION : ce script effectue des déplacements et copies réels lorsque -DryRun
    n'est pas spécifié. Lisez les instructions avant exécution.

.PARAMETER DryRun
    Mode simulation : génère les rapports et plans sans effectuer d'actions.

.PARAMETER KeepCopies
    Nombre de copies de doublons à conserver (défaut : 2).

.PARAMETER RetentionDaysQuarantine
    Nombre de jours de rétention en quarantaine avant suppression (défaut : 30).

.PARAMETER OldYearsThreshold
    Seuil en années pour considérer un fichier comme ancien (défaut : 2).

.PARAMETER TopN
    Nombre de fichiers les plus volumineux à lister (défaut : 100).

.PARAMETER MinSizeMBToConsider
    Taille minimale en Mo pour qu'un dossier/fichier soit candidat à une action (défaut : 50).

.PARAMETER SkipHash
    Désactive le calcul des hash SHA256 (accélère l'exécution mais pas de détection de doublons).

.PARAMETER Force
    Supprime les confirmations interactives pour les opérations destructives.

.EXAMPLE
    .\cleanup_full_C_execute.ps1 -DryRun
    Exécute en mode simulation sans aucune modification.

.EXAMPLE
    .\cleanup_full_C_execute.ps1 -TopN 50 -MinSizeMBToConsider 100
    Limite l'inventaire au top 50 et ne considère que les éléments > 100 Mo.

.NOTES
    Prérequis :
    - Exécuter en Administrateur
    - Disques D: et E: montés et accessibles
    - 7-Zip installé pour l'archivage .7z (optionnel)
    - Créer un point de restauration Windows avant exécution
#>

#Requires -Version 5.1
#Requires -RunAsAdministrator

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [switch]$DryRun,

    [ValidateRange(1, 100)]
    [int]$KeepCopies = 2,

    [ValidateRange(1, 365)]
    [int]$RetentionDaysQuarantine = 30,

    [ValidateRange(1, 50)]
    [int]$OldYearsThreshold = 2,

    [ValidateRange(10, 10000)]
    [int]$TopN = 100,

    [ValidateRange(1, 100000)]
    [int]$MinSizeMBToConsider = 50,

    [switch]$SkipHash,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# =========================================================================
# Configuration
# =========================================================================
$SevenZipPath = 'C:\Program Files\7-Zip\7z.exe'

$ExcludePaths = @(
    'C:\Windows',
    'C:\Program Files',
    'C:\Program Files (x86)',
    'C:\ProgramData',
    'C:\$Recycle.Bin',
    'C:\System Volume Information',
    'C:\Recovery',
    'C:\PerfLogs',
    'C:\pagefile.sys',
    'C:\hiberfil.sys',
    'C:\swapfile.sys'
)

$DriveC = 'C:\'
$DriveD = 'D:\'
$DriveE = 'E:\'

$ReportDir             = 'C:\Temp\RapportsNettoyage'
$BackupDirOnE          = Join-Path $DriveE 'SauvegardeAvantNettoyage'
$ArchiveDirOnE         = Join-Path $DriveE 'Archives'
$QuarantineDirOnE      = Join-Path $DriveE 'Quarantaine_Suppression'
$LogFile               = Join-Path $ReportDir 'cleanup_log.txt'

# Compteurs pour le résumé
$script:Stats = @{
    FilesMoved          = 0
    FilesArchived       = 0
    DuplicatesQuarantined = 0
    ErrorCount          = 0
    SpaceFreedMB        = 0
}

# =========================================================================
# Fonctions utilitaires
# =========================================================================
function Write-Log {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Message)
    $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Verbose $line
    Write-Host $line
}

function Test-DriveReady {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Label)
    if (-not (Test-Path $Path)) {
        throw "Le disque $Label ($Path) n'existe pas ou n'est pas monté."
    }
    $drive = Get-PSDrive -Name $Path[0] -ErrorAction SilentlyContinue
    if (-not $drive) {
        throw "Impossible de lire les informations du disque $Label ($Path)."
    }
    return $drive
}

function Test-Excluded {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$FullPath)
    foreach ($ex in $ExcludePaths) {
        if ($FullPath -like "$ex*") { return $true }
    }
    return $false
}

function Get-DriveSpaceGB {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$DriveLetter)
    $d = Get-PSDrive -Name $DriveLetter -ErrorAction SilentlyContinue
    if ($d -and $d.Free) { return [math]::Round($d.Free / 1GB, 2) }
    return 0
}

function Test-SufficientSpace {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$DriveLetter,
        [Parameter(Mandatory)][double]$RequiredMB,
        [string]$OperationDescription = 'opération'
    )
    $freeGB = Get-DriveSpaceGB -DriveLetter $DriveLetter
    $freeMB = $freeGB * 1024
    if ($freeMB -lt ($RequiredMB * 1.1)) {  # Marge de 10%
        Write-Log "[AVERTISSEMENT] Espace insuffisant sur ${DriveLetter}: pour $OperationDescription. Requis: $([math]::Round($RequiredMB, 0)) Mo, Disponible: $([math]::Round($freeMB, 0)) Mo"
        return $false
    }
    return $true
}

function Get-RelativeQuarantinePath {
    <#
    .SYNOPSIS
        Génère un chemin de destination unique en quarantaine, préservant la structure relative.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$SourcePath,
        [Parameter(Mandatory)][string]$QuarantineRoot
    )
    # Préserver la structure de répertoires pour éviter les collisions de noms
    $relative = $SourcePath
    if ($relative.StartsWith('C:\', [System.StringComparison]::OrdinalIgnoreCase)) {
        $relative = $relative.Substring(3)
    }
    return Join-Path $QuarantineRoot $relative
}

function Test-RobocopySuccess {
    <#
    .SYNOPSIS
        Vérifie le code retour de robocopy.
        Codes 0-7 = succès, 8+ = erreur.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][int]$ExitCode)
    return $ExitCode -lt 8
}

# =========================================================================
# Démarrage
# =========================================================================
New-Item -Path $ReportDir -ItemType Directory -Force | Out-Null
Write-Log "================================================================"
Write-Log "Démarrage du script cleanup_full_C_execute.ps1"
Write-Log "Mode: $(if ($DryRun) { 'SIMULATION (DryRun)' } else { 'EXÉCUTION RÉELLE' })"
Write-Log "Paramètres: TopN=$TopN, MinSizeMB=$MinSizeMBToConsider, OldYears=$OldYearsThreshold, SkipHash=$SkipHash"
Write-Log "================================================================"

# Démarrer la transcription pour audit complet
$transcriptPath = Join-Path $ReportDir ("transcript_{0}.log" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
Start-Transcript -Path $transcriptPath -Append | Out-Null

try {
    # =====================================================================
    # Vérification des disques
    # =====================================================================
    $driveInfoC = Test-DriveReady -Path $DriveC -Label 'C'
    $driveInfoD = Test-DriveReady -Path $DriveD -Label 'D'
    $driveInfoE = Test-DriveReady -Path $DriveE -Label 'E'

    Write-Log "Disques vérifiés - C: $(Get-DriveSpaceGB 'C') Go libre, D: $(Get-DriveSpaceGB 'D') Go libre, E: $(Get-DriveSpaceGB 'E') Go libre"

    if (-not $DryRun) {
        New-Item -Path $BackupDirOnE -ItemType Directory -Force | Out-Null
        New-Item -Path $ArchiveDirOnE -ItemType Directory -Force | Out-Null
        New-Item -Path $QuarantineDirOnE -ItemType Directory -Force | Out-Null
    }

    if (-not (Test-Path $SevenZipPath)) {
        Write-Log "[INFO] 7-Zip non trouvé à $SevenZipPath. L'archivage .7z sera désactivé."
        $SevenZipPath = $null
    }

    # =====================================================================
    # 1. SCAN UNIQUE de C: — un seul parcours récursif pour tout l'inventaire
    # =====================================================================
    Write-Log "Scan unique de C: en cours (peut prendre du temps selon la taille du disque)..."

    $allFiles = [System.Collections.Generic.List[PSCustomObject]]::new()
    $scanCount = 0
    $scanErrors = 0

    Get-ChildItem -Path $DriveC -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
        if (-not (Test-Excluded $_.FullName)) {
            $allFiles.Add([PSCustomObject]@{
                FullName      = $_.FullName
                Name          = $_.Name
                Extension     = $_.Extension.ToLowerInvariant()
                SizeMB        = [math]::Round($_.Length / 1MB, 2)
                Length         = $_.Length
                LastWriteTime = $_.LastWriteTime
                DirectoryName = $_.DirectoryName
            })
        }
        $scanCount++
        if ($scanCount % 50000 -eq 0) {
            Write-Progress -Activity "Scan de C:" -Status "$scanCount fichiers analysés, $($allFiles.Count) retenus" -PercentComplete -1
        }
    }
    Write-Progress -Activity "Scan de C:" -Completed

    Write-Log "Scan terminé: $($allFiles.Count) fichiers retenus sur $scanCount analysés."

    # =====================================================================
    # 2. Rapport : Top N fichiers par taille
    # =====================================================================
    Write-Log "Génération du rapport Top $TopN fichiers par taille..."

    $topFiles = $allFiles |
        Sort-Object Length -Descending |
        Select-Object -First $TopN FullName, SizeMB, LastWriteTime

    $topCsv = Join-Path $ReportDir "Top${TopN}_C_by_size.csv"
    $topFiles | Export-Csv -Path $topCsv -NoTypeInformation -Encoding UTF8
    Write-Log "Rapport créé: $topCsv"

    # =====================================================================
    # 3. Rapport : Fichiers anciens (> OldYearsThreshold ans)
    # =====================================================================
    $cutoff = (Get-Date).AddYears(-$OldYearsThreshold)
    Write-Log "Recherche des fichiers non modifiés depuis $($cutoff.ToString('yyyy-MM-dd'))..."

    $oldFiles = $allFiles |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        Sort-Object SizeMB -Descending

    $oldCsv = Join-Path $ReportDir "OldFiles_C_over${OldYearsThreshold}y.csv"
    $oldFiles | Select-Object FullName, SizeMB, LastWriteTime |
        Export-Csv -Path $oldCsv -NoTypeInformation -Encoding UTF8
    Write-Log "Rapport créé: $oldCsv ($($oldFiles.Count) fichiers anciens trouvés)"

    # =====================================================================
    # 4. Détection de doublons par SHA256 (optimisée : pré-filtre par taille)
    # =====================================================================
    $hashList     = [System.Collections.Generic.List[PSCustomObject]]::new()
    $dupActions   = [System.Collections.Generic.List[PSCustomObject]]::new()
    $dupsGrouped  = @()

    if (-not $SkipHash) {
        Write-Log "Détection de doublons — pré-filtre par taille identique..."

        # Étape 1 : regrouper par taille, ne garder que les groupes avec > 1 fichier
        $sizeGroups = $allFiles |
            Where-Object { $_.Length -gt 0 } |
            Group-Object Length |
            Where-Object { $_.Count -gt 1 }

        $candidateCount = ($sizeGroups | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
        Write-Log "  $candidateCount fichiers candidats (taille identique) dans $($sizeGroups.Count) groupes."

        # Étape 2 : calculer le hash uniquement pour ces fichiers
        $hashProgress = 0
        foreach ($group in $sizeGroups) {
            foreach ($fileInfo in $group.Group) {
                $hashProgress++
                if ($hashProgress % 1000 -eq 0) {
                    Write-Progress -Activity "Calcul des hash SHA256" -Status "$hashProgress / $candidateCount" `
                        -PercentComplete ([math]::Min(100, [math]::Round($hashProgress / $candidateCount * 100)))
                }
                try {
                    $h = Get-FileHash -Path $fileInfo.FullName -Algorithm SHA256 -ErrorAction Stop
                    $hashList.Add([PSCustomObject]@{
                        Path          = $fileInfo.FullName
                        Hash          = $h.Hash
                        SizeMB        = $fileInfo.SizeMB
                        Length        = $fileInfo.Length
                        LastWriteTime = $fileInfo.LastWriteTime
                    })
                } catch {
                    Write-Log "[AVERTISSEMENT] Hash impossible: $($fileInfo.FullName) — $($_.Exception.Message)"
                    $script:Stats.ErrorCount++
                }
            }
        }
        Write-Progress -Activity "Calcul des hash SHA256" -Completed

        # Étape 3 : identifier les vrais doublons
        $dupsGrouped = $hashList | Group-Object Hash | Where-Object { $_.Count -gt 1 }
        $totalDuplicateFiles = ($dupsGrouped | ForEach-Object { $_.Count - 1 } | Measure-Object -Sum).Sum
        if (-not $totalDuplicateFiles) { $totalDuplicateFiles = 0 }

        $dupsCsv = Join-Path $ReportDir "Duplicates_C_hash.csv"
        $dupsGrouped | ForEach-Object { $_.Group } |
            Select-Object Path, Hash, SizeMB, LastWriteTime |
            Export-Csv -Path $dupsCsv -NoTypeInformation -Encoding UTF8
        Write-Log "Rapport doublons créé: $dupsCsv ($($dupsGrouped.Count) groupes, $totalDuplicateFiles fichiers en double)"

        # Construire le plan de quarantaine des doublons
        foreach ($g in $dupsGrouped) {
            $sorted = $g.Group | Sort-Object LastWriteTime -Descending
            # Garder le plus récent, déplacer les autres
            $toMove = $sorted | Select-Object -Skip $KeepCopies
            foreach ($f in $toMove) {
                $dest = Get-RelativeQuarantinePath -SourcePath $f.Path -QuarantineRoot $QuarantineDirOnE
                $dupActions.Add([PSCustomObject]@{
                    Source      = $f.Path
                    Destination = $dest
                    SizeMB      = $f.SizeMB
                    Hash        = $f.Hash
                })
            }
        }

        $dupPlanCsv = Join-Path $ReportDir "DupMovePlan_C.csv"
        $dupActions | Export-Csv -Path $dupPlanCsv -NoTypeInformation -Encoding UTF8
        Write-Log "Plan quarantaine doublons créé: $dupPlanCsv ($($dupActions.Count) fichiers à déplacer)"
    } else {
        Write-Log "[INFO] Détection de doublons désactivée (paramètre -SkipHash)."
    }

    # =====================================================================
    # 5. Identifier dossiers racine volumineux sous C: candidats au déplacement
    # =====================================================================
    Write-Log "Identification des dossiers racine volumineux sur C:..."

    $candidateDirs = [System.Collections.Generic.List[PSCustomObject]]::new()

    # Dossiers dangereux à ne JAMAIS déplacer (en plus des exclusions système)
    $neverMoveDirs = @(
        'C:\Users',
        'C:\Temp',
        'C:\Intel',
        'C:\AMD',
        'C:\NVIDIA',
        'C:\MSOCache',
        'C:\OneDriveTemp',
        'C:\Drivers'
    )

    Get-ChildItem -Path $DriveC -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $fullPath = $_.FullName
        if (-not (Test-Excluded $fullPath)) {
            # Vérifier que ce n'est pas un dossier critique
            $isCritical = $false
            foreach ($nd in $neverMoveDirs) {
                if ($fullPath -eq $nd -or $fullPath -like "$nd\*") {
                    $isCritical = $true
                    break
                }
            }
            if ($isCritical) { return }

            try {
                $size = (Get-ChildItem -Path $fullPath -Recurse -File -ErrorAction SilentlyContinue |
                    Measure-Object -Property Length -Sum).Sum
                $sizeMB = if ($size) { [math]::Round($size / 1MB, 2) } else { 0 }
                if ($sizeMB -ge $MinSizeMBToConsider) {
                    $candidateDirs.Add([PSCustomObject]@{
                        Path   = $fullPath
                        SizeMB = $sizeMB
                    })
                }
            } catch {
                Write-Log "[AVERTISSEMENT] Erreur calcul taille pour $fullPath : $($_.Exception.Message)"
            }
        }
    }

    $candidateDirs = $candidateDirs | Sort-Object SizeMB -Descending
    $movePlanCsv = Join-Path $ReportDir "MoveCandidates_C_root.csv"
    $candidateDirs | Export-Csv -Path $movePlanCsv -NoTypeInformation -Encoding UTF8
    Write-Log "Plan de déplacement créé: $movePlanCsv ($($candidateDirs.Count) dossiers candidats)"

    # =====================================================================
    # 5b. Identifier fichiers anciens volumineux candidats à l'archivage
    # =====================================================================
    $oldLarge = $oldFiles | Where-Object { $_.SizeMB -ge $MinSizeMBToConsider }
    $archivePlanCsv = Join-Path $ReportDir "ArchiveCandidates_C.csv"
    $oldLarge | Select-Object FullName, SizeMB, LastWriteTime |
        Export-Csv -Path $archivePlanCsv -NoTypeInformation -Encoding UTF8
    Write-Log "Plan d'archivage créé: $archivePlanCsv ($(@($oldLarge).Count) fichiers candidats)"

    # =====================================================================
    # 6. Sauvegarde des rapports sur E:
    # =====================================================================
    Write-Log "Copie des rapports sur E:..."
    if (-not $DryRun) {
        Get-ChildItem -Path $ReportDir -File | ForEach-Object {
            $dest = Join-Path $BackupDirOnE $_.Name
            Copy-Item -Path $_.FullName -Destination $dest -Force
            Write-Log "  Rapport copié: $($_.Name) -> E:"
        }
    } else {
        Write-Log "  [SIMULATION] Rapports non copiés."
    }

    # =====================================================================
    # 7. EXÉCUTION DES ACTIONS (si pas DryRun)
    # =====================================================================
    if ($DryRun) {
        Write-Log "================================================================"
        Write-Log "MODE SIMULATION — Aucune action effectuée."
        Write-Log "Consultez les rapports CSV pour vérifier les opérations planifiées."
        Write-Log "Relancez sans -DryRun pour exécuter les actions."
        Write-Log "================================================================"
    } else {
        Write-Log "================================================================"
        Write-Log "DÉBUT DES ACTIONS RÉELLES"
        Write-Log "================================================================"

        # Confirmation globale si -Force n'est pas utilisé
        if (-not $Force) {
            Write-Log "Résumé des actions planifiées :"
            Write-Log "  - Dossiers à déplacer vers D:  : $($candidateDirs.Count)"
            Write-Log "  - Fichiers à archiver sur E:   : $(@($oldLarge).Count)"
            Write-Log "  - Doublons à mettre en quarantaine : $($dupActions.Count)"
            Write-Host ""
            Write-Host "ATTENTION : Ces opérations vont déplacer/archiver des fichiers de manière irréversible." -ForegroundColor Yellow
            Write-Host "Avez-vous bien créé un point de restauration et une sauvegarde ?" -ForegroundColor Yellow

            if (-not $PSCmdlet.ShouldProcess("C:\", "Exécuter toutes les opérations de nettoyage")) {
                Write-Log "Opération annulée par l'utilisateur."
                return
            }
        }

        # -----------------------------------------------------------------
        # 7a. Déplacer dossiers candidats vers D: avec robocopy /MOVE
        # -----------------------------------------------------------------
        Write-Log "--- Déplacement de dossiers vers D: ---"
        $totalMoveSizeMB = ($candidateDirs | Measure-Object SizeMB -Sum).Sum
        if ($totalMoveSizeMB) {
            if (-not (Test-SufficientSpace -DriveLetter 'D' -RequiredMB $totalMoveSizeMB -OperationDescription 'déplacements vers D:')) {
                Write-Log "[ERREUR] Espace insuffisant sur D: — déplacements annulés."
            } else {
                $moveIndex = 0
                foreach ($c in $candidateDirs) {
                    $moveIndex++
                    $src = $c.Path
                    $destDir = Join-Path $DriveD ([IO.Path]::GetFileName($src))

                    if (Test-Path $destDir) {
                        Write-Log "  [IGNORÉ] Le dossier existe déjà sur D: : $destDir"
                        continue
                    }

                    Write-Progress -Activity "Déplacement vers D:" -Status "$src ($($c.SizeMB) Mo)" `
                        -PercentComplete ([math]::Round($moveIndex / $candidateDirs.Count * 100))

                    Write-Log "  Déplacement: $src -> $destDir ($($c.SizeMB) Mo)"
                    $robocopyOutput = & robocopy $src $destDir /MOVE /E /R:3 /W:5 /MT:8 /NP /LOG+:"$ReportDir\robocopy_move.log" 2>&1
                    $rc = $LASTEXITCODE

                    if (Test-RobocopySuccess -ExitCode $rc) {
                        Write-Log "  [OK] robocopy terminé (code: $rc) pour $src"
                        $script:Stats.FilesMoved++
                        $script:Stats.SpaceFreedMB += $c.SizeMB
                    } else {
                        Write-Log "  [ERREUR] robocopy a échoué (code: $rc) pour $src — vérifiez robocopy_move.log"
                        $script:Stats.ErrorCount++
                    }
                }
                Write-Progress -Activity "Déplacement vers D:" -Completed
            }
        } else {
            Write-Log "  Aucun dossier candidat au déplacement."
        }

        # -----------------------------------------------------------------
        # 7b. Archiver fichiers anciens volumineux sur E: en .7z
        # -----------------------------------------------------------------
        Write-Log "--- Archivage de fichiers anciens sur E: ---"
        if ($SevenZipPath -and @($oldLarge).Count -gt 0) {
            $archiveSizeMB = ($oldLarge | Measure-Object SizeMB -Sum).Sum
            if (-not (Test-SufficientSpace -DriveLetter 'E' -RequiredMB $archiveSizeMB -OperationDescription 'archivage sur E:')) {
                Write-Log "[ERREUR] Espace insuffisant sur E: — archivage annulé."
            } else {
                $archiveIndex = 0
                foreach ($row in $oldLarge) {
                    $archiveIndex++
                    $fullPath = $row.FullName
                    if (-not (Test-Path $fullPath)) {
                        Write-Log "  [IGNORÉ] Fichier introuvable (peut-être déjà déplacé): $fullPath"
                        continue
                    }

                    # Nom d'archive unique basé sur le chemin relatif
                    $safeName = $fullPath.Substring(3) -replace '[\\/]', '_'
                    $archivePath = Join-Path $ArchiveDirOnE "$safeName.7z"

                    if (Test-Path $archivePath) {
                        Write-Log "  [IGNORÉ] Archive existante: $archivePath"
                        continue
                    }

                    Write-Progress -Activity "Archivage sur E:" -Status "$fullPath ($($row.SizeMB) Mo)" `
                        -PercentComplete ([math]::Round($archiveIndex / @($oldLarge).Count * 100))

                    Write-Log "  Archivage: $fullPath -> $archivePath ($($row.SizeMB) Mo)"
                    try {
                        & $SevenZipPath a -t7z $archivePath $fullPath -mx=9 -bso0 -bsp0 2>&1 | Out-Null
                        if ($LASTEXITCODE -eq 0) {
                            Write-Log "  [OK] Archive créée: $archivePath"
                            $script:Stats.FilesArchived++
                        } else {
                            Write-Log "  [ERREUR] 7-Zip code retour $LASTEXITCODE pour $fullPath"
                            $script:Stats.ErrorCount++
                        }
                    } catch {
                        Write-Log "  [ERREUR] Archivage échoué pour $fullPath : $($_.Exception.Message)"
                        $script:Stats.ErrorCount++
                    }
                }
                Write-Progress -Activity "Archivage sur E:" -Completed
            }
        } elseif (-not $SevenZipPath) {
            Write-Log "  [INFO] 7-Zip non disponible — archivage désactivé."
        } else {
            Write-Log "  Aucun fichier ancien volumineux à archiver."
        }

        # -----------------------------------------------------------------
        # 7c. Déplacer doublons vers quarantaine sur E:
        # -----------------------------------------------------------------
        Write-Log "--- Mise en quarantaine des doublons ---"
        if ($dupActions.Count -gt 0) {
            $dupSizeMB = ($dupActions | Measure-Object SizeMB -Sum).Sum
            if (-not (Test-SufficientSpace -DriveLetter 'E' -RequiredMB $dupSizeMB -OperationDescription 'quarantaine doublons')) {
                Write-Log "[ERREUR] Espace insuffisant sur E: — quarantaine annulée."
            } else {
                $dupIndex = 0
                foreach ($act in $dupActions) {
                    $dupIndex++
                    if ($dupIndex % 100 -eq 0) {
                        Write-Progress -Activity "Quarantaine des doublons" -Status "$dupIndex / $($dupActions.Count)" `
                            -PercentComplete ([math]::Round($dupIndex / $dupActions.Count * 100))
                    }

                    if (-not (Test-Path $act.Source)) {
                        Write-Log "  [IGNORÉ] Fichier introuvable: $($act.Source)"
                        continue
                    }

                    try {
                        $destDir = [IO.Path]::GetDirectoryName($act.Destination)
                        if (-not (Test-Path $destDir)) {
                            New-Item -Path $destDir -ItemType Directory -Force | Out-Null
                        }
                        Move-Item -Path $act.Source -Destination $act.Destination -Force
                        Write-Log "  [OK] Doublon déplacé: $($act.Source)"
                        $script:Stats.DuplicatesQuarantined++
                        $script:Stats.SpaceFreedMB += $act.SizeMB
                    } catch {
                        Write-Log "  [ERREUR] Déplacement doublon $($act.Source): $($_.Exception.Message)"
                        $script:Stats.ErrorCount++
                    }
                }
                Write-Progress -Activity "Quarantaine des doublons" -Completed
            }
        } else {
            Write-Log "  Aucun doublon à mettre en quarantaine."
        }
    }

    # =====================================================================
    # 8. Gestion de la rétention en quarantaine
    # =====================================================================
    Write-Log "--- Vérification de la rétention en quarantaine ---"
    if (Test-Path $QuarantineDirOnE) {
        $quarantineOld = Get-ChildItem -Path $QuarantineDirOnE -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDaysQuarantine) }

        if ($quarantineOld -and $quarantineOld.Count -gt 0) {
            $quarantineOldCsv = Join-Path $ReportDir "Quarantine_OldToDelete_C.csv"
            $quarantineOld | Select-Object FullName, @{Name='SizeMB';Expression={[math]::Round($_.Length/1MB,2)}}, LastWriteTime |
                Export-Csv -Path $quarantineOldCsv -NoTypeInformation -Encoding UTF8
            Write-Log "Rapport rétention quarantaine: $quarantineOldCsv ($($quarantineOld.Count) fichiers expirés)"
            Write-Log "[INFO] Les fichiers expirés en quarantaine ne sont PAS supprimés automatiquement."
            Write-Log "[INFO] Examinez le rapport et supprimez manuellement si souhaité."
        } else {
            Write-Log "  Aucun fichier expiré en quarantaine."
        }
    }

    # =====================================================================
    # 9. Résumé final
    # =====================================================================
    Write-Log "================================================================"
    Write-Log "RÉSUMÉ D'EXÉCUTION"
    Write-Log "================================================================"
    Write-Log "  Mode                      : $(if ($DryRun) { 'SIMULATION' } else { 'EXÉCUTION RÉELLE' })"
    Write-Log "  Fichiers scannés          : $($allFiles.Count)"
    Write-Log "  Fichiers anciens trouvés  : $($oldFiles.Count)"
    Write-Log "  Groupes de doublons       : $($dupsGrouped.Count)"
    Write-Log "  Dossiers déplacés vers D: : $($script:Stats.FilesMoved)"
    Write-Log "  Fichiers archivés sur E:  : $($script:Stats.FilesArchived)"
    Write-Log "  Doublons en quarantaine   : $($script:Stats.DuplicatesQuarantined)"
    Write-Log "  Espace libéré (estimé)    : $([math]::Round($script:Stats.SpaceFreedMB, 2)) Mo"
    Write-Log "  Erreurs                   : $($script:Stats.ErrorCount)"
    Write-Log "  C: espace libre           : $(Get-DriveSpaceGB 'C') Go"
    Write-Log "  D: espace libre           : $(Get-DriveSpaceGB 'D') Go"
    Write-Log "  E: espace libre           : $(Get-DriveSpaceGB 'E') Go"
    Write-Log "================================================================"
    Write-Log "Rapports disponibles dans : $ReportDir"
    Write-Log "Log complet               : $LogFile"
    Write-Log "Transcription             : $transcriptPath"
    Write-Log "Script terminé."

} catch {
    Write-Log "[ERREUR FATALE] $($_.Exception.Message)"
    Write-Log "Pile d'appels: $($_.ScriptStackTrace)"
    throw
} finally {
    Stop-Transcript -ErrorAction SilentlyContinue | Out-Null
}
