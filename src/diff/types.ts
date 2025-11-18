/**
 * Diff Model Types
 *
 * These types represent file differences and multi-file patches
 * used by the patch engine for atomic multi-file operations.
 */

/**
 * Type of change operation
 */
export type ChangeType = 'create' | 'modify' | 'delete';

/**
 * Represents a single line change in a file
 */
export interface LineChange {
  /** Line number (1-based) */
  lineNumber: number;
  /** Original content (for modify/delete) */
  oldContent?: string;
  /** New content (for create/modify) */
  newContent?: string;
  /** Type of change */
  type: 'add' | 'remove' | 'modify';
}

/**
 * Represents a hunk of changes (contiguous block)
 */
export interface Hunk {
  /** Starting line number in original file */
  oldStart: number;
  /** Number of lines in original file */
  oldLines: number;
  /** Starting line number in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** Individual line changes */
  changes: LineChange[];
}

/**
 * Represents changes to a single file
 */
export interface FileDiff {
  /** Absolute path to the file */
  filePath: string;
  /** Type of operation */
  changeType: ChangeType;
  /** Original content (for modify/delete operations) */
  oldContent?: string;
  /** New content (for create/modify operations) */
  newContent?: string;
  /** Hunks of changes (for granular diffs) */
  hunks?: Hunk[];
  /** File metadata */
  metadata?: {
    /** Last modified timestamp (for conflict detection) */
    mtime?: number;
    /** File size */
    size?: number;
    /** File permissions */
    mode?: number;
  };
}

/**
 * Represents changes to multiple files (a patch set)
 */
export interface MultiFileDiff {
  /** Array of file differences */
  files: FileDiff[];
  /** Optional description of the change set */
  description?: string;
  /** Timestamp when diff was created */
  timestamp?: number;
  /** Metadata about the diff */
  metadata?: {
    /** Author/source of the changes */
    source?: string;
    /** Related issue/task ID */
    taskId?: string;
    /** Any additional context */
    [key: string]: unknown;
  };
}

/**
 * Options for applying patches
 */
export interface PatchOptions {
  /** Dry-run mode: validate but don't apply changes */
  dryRun?: boolean;
  /** Directory for backup files (default: .claude-backup) */
  backupDir?: string;
  /** Only validate, don't apply or backup */
  validateOnly?: boolean;
  /** Conflict resolution strategy */
  onConflict?: 'error' | 'warn' | 'merge';
  /** Auto-cleanup backups on success */
  autoCleanup?: boolean;
  /** Verbose error reporting */
  verbose?: boolean;
}

/**
 * Result of a patch operation
 */
export interface PatchResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Files that were modified */
  affectedFiles: string[];
  /** Errors encountered (if any) */
  errors: PatchError[];
  /** Warnings (non-fatal issues) */
  warnings: string[];
  /** Backup directory (if backups were created) */
  backupDir?: string;
  /** Backup metadata for rollback */
  backupMetadata?: BackupMetadata;
  /** Statistics about the operation */
  stats?: {
    filesProcessed: number;
    filesModified: number;
    filesCreated: number;
    filesDeleted: number;
    linesAdded: number;
    linesRemoved: number;
    duration: number; // milliseconds
  };
}

/**
 * Error during patch operation
 */
export interface PatchError {
  /** Type of error */
  type: 'validation' | 'backup' | 'application' | 'rollback' | 'conflict';
  /** File that caused the error */
  filePath?: string;
  /** Error message */
  message: string;
  /** Underlying error object */
  cause?: Error;
  /** Additional context */
  context?: {
    lineNumber?: number;
    expectedContent?: string;
    actualContent?: string;
    [key: string]: unknown;
  };
}

/**
 * Metadata for backup files
 */
export interface BackupMetadata {
  /** Backup directory path */
  backupDir: string;
  /** Timestamp when backup was created */
  timestamp: number;
  /** Map of original file paths to backup file paths */
  files: Map<string, BackupFileInfo>;
  /** Original working directory */
  workingDir: string;
}

/**
 * Information about a backed-up file
 */
export interface BackupFileInfo {
  /** Path to the backup file */
  backupPath: string;
  /** Original file path */
  originalPath: string;
  /** Original modification time */
  originalMtime: number;
  /** Original file size */
  originalSize: number;
  /** Whether the file existed before (false for new files) */
  existed: boolean;
}

/**
 * Conflict detected during validation
 */
export interface Conflict {
  /** File where conflict was detected */
  filePath: string;
  /** Type of conflict */
  type: 'mtime' | 'content' | 'missing' | 'permissions';
  /** Expected value */
  expected: unknown;
  /** Actual value */
  actual: unknown;
  /** Description of the conflict */
  message: string;
}
