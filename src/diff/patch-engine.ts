/**
 * Multi-File Patch Engine
 *
 * Provides atomic, transactional application of multi-file patches with:
 * - Validation phase (pre-flight checks)
 * - Backup phase (for rollback)
 * - Application phase (atomic changes)
 * - Rollback capability (restore on failure)
 * - Conflict detection
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import {
  MultiFileDiff,
  FileDiff,
  PatchOptions,
  PatchResult,
  PatchError,
  BackupMetadata,
  BackupFileInfo,
  Conflict,
} from './types';

/**
 * Default patch options
 */
const DEFAULT_OPTIONS: Required<PatchOptions> = {
  dryRun: false,
  backupDir: '.claude-backup',
  validateOnly: false,
  onConflict: 'error',
  autoCleanup: true,
  verbose: false,
};

/**
 * Apply a multi-file patch atomically
 *
 * Transaction phases:
 * 1. VALIDATE: Check files, line numbers, permissions (no modification)
 * 2. BACKUP: Copy originals to backup dir
 * 3. APPLY: Write new content (all or nothing)
 * 4. COMMIT: Delete backups OR ROLLBACK: Restore from backups
 *
 * @param multiFileDiff The set of file changes to apply
 * @param options Patch application options
 * @returns Result of the patch operation
 */
export async function applyMultiFilePatch(
  multiFileDiff: MultiFileDiff,
  options: PatchOptions = {}
): Promise<PatchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  const result: PatchResult = {
    success: false,
    affectedFiles: [],
    errors: [],
    warnings: [],
    stats: {
      filesProcessed: 0,
      filesModified: 0,
      filesCreated: 0,
      filesDeleted: 0,
      linesAdded: 0,
      linesRemoved: 0,
      duration: 0,
    },
  };

  try {
    // PHASE 1: VALIDATE
    if (opts.verbose) {
      console.log('Phase 1: Validation');
    }

    const validationResult = await validatePatch(multiFileDiff, opts);
    result.errors.push(...validationResult.errors);
    result.warnings.push(...validationResult.warnings);

    if (validationResult.errors.length > 0) {
      if (opts.verbose) {
        console.error('Validation failed:', validationResult.errors);
      }
      return result;
    }

    if (opts.validateOnly) {
      result.success = true;
      return result;
    }

    // PHASE 2: BACKUP
    if (!opts.dryRun) {
      if (opts.verbose) {
        console.log('Phase 2: Backup');
      }

      const backupResult = await backupFiles(multiFileDiff, opts);

      if (!backupResult.success) {
        result.errors.push(...backupResult.errors);
        return result;
      }

      result.backupDir = backupResult.backupDir;
      result.backupMetadata = backupResult.metadata;
    }

    // PHASE 3: APPLY
    if (opts.verbose) {
      console.log('Phase 3: Apply changes');
    }

    const applicationResult = await applyChanges(multiFileDiff, opts);

    if (!applicationResult.success) {
      result.errors.push(...applicationResult.errors);

      // PHASE 4: ROLLBACK on failure
      if (result.backupMetadata && !opts.dryRun) {
        if (opts.verbose) {
          console.error('Application failed, rolling back...');
        }

        const rollbackResult = await rollbackPatch(result);

        if (!rollbackResult.success) {
          result.errors.push({
            type: 'rollback',
            message: 'Rollback failed! Manual intervention required.',
            cause: new Error('Rollback failure'),
            context: { rollbackErrors: rollbackResult.errors },
          });
        }
      }

      return result;
    }

    // Success! Update result
    result.success = true;
    result.affectedFiles = applicationResult.affectedFiles;
    result.stats = applicationResult.stats;

    // PHASE 4: CLEANUP (if auto-cleanup enabled)
    if (opts.autoCleanup && result.backupMetadata && !opts.dryRun) {
      if (opts.verbose) {
        console.log('Phase 4: Cleanup backups');
      }
      await cleanupBackups(result.backupMetadata);
    }

  } catch (error) {
    result.errors.push({
      type: 'application',
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  } finally {
    result.stats!.duration = Date.now() - startTime;
  }

  return result;
}

/**
 * Validate a patch before applying
 */
async function validatePatch(
  multiFileDiff: MultiFileDiff,
  opts: Required<PatchOptions>
): Promise<{ errors: PatchError[]; warnings: string[] }> {
  const errors: PatchError[] = [];
  const warnings: string[] = [];

  for (const fileDiff of multiFileDiff.files) {
    try {
      // Check file existence for modify/delete operations
      if (fileDiff.changeType === 'modify' || fileDiff.changeType === 'delete') {
        if (!fs.existsSync(fileDiff.filePath)) {
          errors.push({
            type: 'validation',
            filePath: fileDiff.filePath,
            message: `File does not exist: ${fileDiff.filePath}`,
          });
          continue;
        }

        // Check for concurrent modifications (mtime check)
        const stats = fs.statSync(fileDiff.filePath);
        const actualMtime = stats.mtimeMs;

        if (fileDiff.metadata?.mtime && actualMtime !== fileDiff.metadata.mtime) {
          const conflict: Conflict = {
            filePath: fileDiff.filePath,
            type: 'mtime',
            expected: fileDiff.metadata.mtime,
            actual: actualMtime,
            message: `File has been modified since diff was created (expected mtime: ${fileDiff.metadata.mtime}, actual: ${actualMtime})`,
          };

          if (opts.onConflict === 'error') {
            errors.push({
              type: 'conflict',
              filePath: fileDiff.filePath,
              message: conflict.message,
              context: { conflict },
            });
          } else if (opts.onConflict === 'warn') {
            warnings.push(`Conflict in ${fileDiff.filePath}: ${conflict.message}`);
          }
        }

        // Validate file content matches expected
        if (fileDiff.oldContent !== undefined) {
          const actualContent = fs.readFileSync(fileDiff.filePath, 'utf-8');

          if (actualContent !== fileDiff.oldContent) {
            const conflict: Conflict = {
              filePath: fileDiff.filePath,
              type: 'content',
              expected: fileDiff.oldContent,
              actual: actualContent,
              message: 'File content has changed since diff was created',
            };

            if (opts.onConflict === 'error') {
              errors.push({
                type: 'conflict',
                filePath: fileDiff.filePath,
                message: conflict.message,
                context: { conflict },
              });
            } else if (opts.onConflict === 'warn') {
              warnings.push(`Content conflict in ${fileDiff.filePath}`);
            }
          }
        }
      }

      // Check that parent directory exists for create operations
      if (fileDiff.changeType === 'create') {
        const parentDir = path.dirname(fileDiff.filePath);

        if (!fs.existsSync(parentDir)) {
          errors.push({
            type: 'validation',
            filePath: fileDiff.filePath,
            message: `Parent directory does not exist: ${parentDir}`,
          });
          continue;
        }

        // Warn if file already exists
        if (fs.existsSync(fileDiff.filePath)) {
          warnings.push(`File already exists (will be overwritten): ${fileDiff.filePath}`);
        }
      }

      // Check write permissions
      await checkWritePermission(fileDiff, errors);

      // Validate line numbers in hunks
      if (fileDiff.hunks && fileDiff.hunks.length > 0) {
        const content = fileDiff.oldContent || fs.readFileSync(fileDiff.filePath, 'utf-8');
        const lines = content.split('\n');

        for (const hunk of fileDiff.hunks) {
          if (hunk.oldStart < 1 || hunk.oldStart > lines.length + 1) {
            errors.push({
              type: 'validation',
              filePath: fileDiff.filePath,
              message: `Invalid hunk start line: ${hunk.oldStart} (file has ${lines.length} lines)`,
              context: { lineNumber: hunk.oldStart },
            });
          }

          if (hunk.oldStart + hunk.oldLines - 1 > lines.length) {
            errors.push({
              type: 'validation',
              filePath: fileDiff.filePath,
              message: `Hunk extends beyond file end: ${hunk.oldStart + hunk.oldLines - 1} (file has ${lines.length} lines)`,
              context: { lineNumber: hunk.oldStart + hunk.oldLines - 1 },
            });
          }
        }
      }

    } catch (error) {
      errors.push({
        type: 'validation',
        filePath: fileDiff.filePath,
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  return { errors, warnings };
}

/**
 * Check write permission for a file
 */
async function checkWritePermission(
  fileDiff: FileDiff,
  errors: PatchError[]
): Promise<void> {
  try {
    if (fs.existsSync(fileDiff.filePath)) {
      // Check if we can write to existing file
      fs.accessSync(fileDiff.filePath, fs.constants.W_OK);
    } else {
      // Check if we can write to parent directory
      const parentDir = path.dirname(fileDiff.filePath);
      fs.accessSync(parentDir, fs.constants.W_OK);
    }
  } catch (error) {
    errors.push({
      type: 'validation',
      filePath: fileDiff.filePath,
      message: `No write permission for ${fileDiff.filePath}`,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * Backup files before applying changes
 */
async function backupFiles(
  multiFileDiff: MultiFileDiff,
  opts: Required<PatchOptions>
): Promise<{ success: boolean; errors: PatchError[]; backupDir?: string; metadata?: BackupMetadata }> {
  const errors: PatchError[] = [];
  const timestamp = Date.now();

  // Create backup directory
  let backupDir: string;

  if (path.isAbsolute(opts.backupDir)) {
    backupDir = opts.backupDir;
  } else {
    backupDir = path.join(process.cwd(), opts.backupDir);
  }

  backupDir = path.join(backupDir, `backup-${timestamp}`);

  try {
    fs.mkdirSync(backupDir, { recursive: true });
  } catch (error) {
    errors.push({
      type: 'backup',
      message: `Failed to create backup directory: ${backupDir}`,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
    return { success: false, errors };
  }

  const metadata: BackupMetadata = {
    backupDir,
    timestamp,
    files: new Map(),
    workingDir: process.cwd(),
  };

  // Backup each file that will be modified or deleted
  for (const fileDiff of multiFileDiff.files) {
    if (fileDiff.changeType === 'create' && !fs.existsSync(fileDiff.filePath)) {
      // No backup needed for new files that don't exist yet
      metadata.files.set(fileDiff.filePath, {
        backupPath: '',
        originalPath: fileDiff.filePath,
        originalMtime: 0,
        originalSize: 0,
        existed: false,
      });
      continue;
    }

    if (!fs.existsSync(fileDiff.filePath)) {
      // File doesn't exist, skip backup
      continue;
    }

    try {
      const stats = fs.statSync(fileDiff.filePath);
      const hash = crypto.createHash('md5').update(fileDiff.filePath).digest('hex').slice(0, 8);
      const backupFileName = `${path.basename(fileDiff.filePath)}.${hash}.bak`;
      const backupPath = path.join(backupDir, backupFileName);

      // Copy file to backup
      fs.copyFileSync(fileDiff.filePath, backupPath);

      metadata.files.set(fileDiff.filePath, {
        backupPath,
        originalPath: fileDiff.filePath,
        originalMtime: stats.mtimeMs,
        originalSize: stats.size,
        existed: true,
      });

    } catch (error) {
      errors.push({
        type: 'backup',
        filePath: fileDiff.filePath,
        message: `Failed to backup file: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // Save backup metadata
  try {
    const metadataPath = path.join(backupDir, 'metadata.json');
    const metadataObj = {
      ...metadata,
      files: Array.from(metadata.files.entries()).map(([key, value]) => ({ key, value })),
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadataObj, null, 2));
  } catch (error) {
    errors.push({
      type: 'backup',
      message: `Failed to save backup metadata: ${error instanceof Error ? error.message : String(error)}`,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }

  return {
    success: errors.length === 0,
    errors,
    backupDir,
    metadata,
  };
}

/**
 * Apply changes to files
 */
async function applyChanges(
  multiFileDiff: MultiFileDiff,
  opts: Required<PatchOptions>
): Promise<{ success: boolean; errors: PatchError[]; affectedFiles: string[]; stats: PatchResult['stats'] }> {
  const errors: PatchError[] = [];
  const affectedFiles: string[] = [];
  const stats = {
    filesProcessed: 0,
    filesModified: 0,
    filesCreated: 0,
    filesDeleted: 0,
    linesAdded: 0,
    linesRemoved: 0,
    duration: 0,
  };

  for (const fileDiff of multiFileDiff.files) {
    stats.filesProcessed++;

    try {
      if (opts.dryRun) {
        // In dry-run mode, just log what would happen
        affectedFiles.push(fileDiff.filePath);
        updateStatsForDiff(fileDiff, stats);
        continue;
      }

      switch (fileDiff.changeType) {
        case 'create':
        case 'modify':
          if (fileDiff.newContent === undefined) {
            errors.push({
              type: 'application',
              filePath: fileDiff.filePath,
              message: 'New content is required for create/modify operations',
            });
            continue;
          }

          // Write to temp file first, then rename (atomic operation)
          const tempPath = `${fileDiff.filePath}.tmp.${Date.now()}`;

          try {
            fs.writeFileSync(tempPath, fileDiff.newContent, 'utf-8');
            fs.renameSync(tempPath, fileDiff.filePath);

            affectedFiles.push(fileDiff.filePath);

            if (fileDiff.changeType === 'create') {
              stats.filesCreated++;
            } else {
              stats.filesModified++;
            }

            updateStatsForDiff(fileDiff, stats);

          } catch (error) {
            // Clean up temp file if it exists
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
            throw error;
          }
          break;

        case 'delete':
          fs.unlinkSync(fileDiff.filePath);
          affectedFiles.push(fileDiff.filePath);
          stats.filesDeleted++;

          if (fileDiff.oldContent) {
            stats.linesRemoved += fileDiff.oldContent.split('\n').length;
          }
          break;

        default:
          errors.push({
            type: 'application',
            filePath: fileDiff.filePath,
            message: `Unknown change type: ${fileDiff.changeType}`,
          });
      }

    } catch (error) {
      errors.push({
        type: 'application',
        filePath: fileDiff.filePath,
        message: `Failed to apply changes: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : new Error(String(error)),
      });

      // Stop on first error to maintain atomicity
      break;
    }
  }

  return {
    success: errors.length === 0,
    errors,
    affectedFiles,
    stats,
  };
}

/**
 * Update statistics based on a file diff
 */
function updateStatsForDiff(fileDiff: FileDiff, stats: PatchResult['stats']): void {
  if (!stats) return;

  if (fileDiff.oldContent && fileDiff.newContent) {
    const oldLines = fileDiff.oldContent.split('\n').length;
    const newLines = fileDiff.newContent.split('\n').length;

    if (newLines > oldLines) {
      stats.linesAdded += newLines - oldLines;
    } else if (oldLines > newLines) {
      stats.linesRemoved += oldLines - newLines;
    }
  } else if (fileDiff.newContent) {
    stats.linesAdded += fileDiff.newContent.split('\n').length;
  } else if (fileDiff.oldContent) {
    stats.linesRemoved += fileDiff.oldContent.split('\n').length;
  }
}

/**
 * Rollback a patch by restoring from backups
 */
export async function rollbackPatch(patchResult: PatchResult): Promise<{ success: boolean; errors: PatchError[] }> {
  const errors: PatchError[] = [];

  if (!patchResult.backupMetadata) {
    errors.push({
      type: 'rollback',
      message: 'No backup metadata available for rollback',
    });
    return { success: false, errors };
  }

  const { backupDir, files } = patchResult.backupMetadata;

  // Restore each file from backup
  for (const [originalPath, fileInfo] of files.entries()) {
    try {
      if (!fileInfo.existed) {
        // File was created by the patch, delete it
        if (fs.existsSync(originalPath)) {
          fs.unlinkSync(originalPath);
        }
      } else if (fileInfo.backupPath && fs.existsSync(fileInfo.backupPath)) {
        // Restore from backup
        fs.copyFileSync(fileInfo.backupPath, originalPath);
      } else {
        errors.push({
          type: 'rollback',
          filePath: originalPath,
          message: `Backup file not found: ${fileInfo.backupPath}`,
        });
      }
    } catch (error) {
      errors.push({
        type: 'rollback',
        filePath: originalPath,
        message: `Failed to restore file: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // Don't delete backup directory on rollback - keep it for debugging

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Clean up backup files after successful patch
 */
async function cleanupBackups(metadata: BackupMetadata): Promise<void> {
  try {
    if (fs.existsSync(metadata.backupDir)) {
      fs.rmSync(metadata.backupDir, { recursive: true, force: true });
    }
  } catch (error) {
    // Silently fail - cleanup is not critical
    console.warn(`Failed to cleanup backup directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Load backup metadata from a backup directory
 */
export function loadBackupMetadata(backupDir: string): BackupMetadata | null {
  try {
    const metadataPath = path.join(backupDir, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    const metadataObj = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    return {
      ...metadataObj,
      files: new Map(metadataObj.files.map((entry: { key: string; value: BackupFileInfo }) => [entry.key, entry.value])),
    };
  } catch (error) {
    console.error(`Failed to load backup metadata: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * List all available backups
 */
export function listBackups(backupRootDir: string = '.claude-backup'): Array<{ dir: string; timestamp: number; fileCount: number }> {
  const backups: Array<{ dir: string; timestamp: number; fileCount: number }> = [];

  try {
    const backupRoot = path.isAbsolute(backupRootDir)
      ? backupRootDir
      : path.join(process.cwd(), backupRootDir);

    if (!fs.existsSync(backupRoot)) {
      return backups;
    }

    const entries = fs.readdirSync(backupRoot);

    for (const entry of entries) {
      const fullPath = path.join(backupRoot, entry);

      if (fs.statSync(fullPath).isDirectory()) {
        const metadata = loadBackupMetadata(fullPath);

        if (metadata) {
          backups.push({
            dir: fullPath,
            timestamp: metadata.timestamp,
            fileCount: metadata.files.size,
          });
        }
      }
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp - a.timestamp);

  } catch (error) {
    console.error(`Failed to list backups: ${error instanceof Error ? error.message : String(error)}`);
  }

  return backups;
}
