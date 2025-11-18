# Multi-File Patch Engine

A robust, transaction-based patch engine for applying changes to multiple files atomically with validation, backup, and rollback capabilities.

## Overview

The Multi-File Patch Engine solves a critical problem in code editing tools: **partial application of multi-file changes**. When editing multiple files as part of a refactoring or feature change, if any file fails to update, the codebase is left in a broken state with some files changed and others not.

This engine implements **atomic transactions** with **all-or-nothing semantics**: either all files are successfully modified, or none are, preventing broken intermediate states.

## Key Features

- ✅ **Atomic Transactions**: All files succeed or all rollback
- ✅ **Pre-flight Validation**: Catch errors before modifying anything
- ✅ **Automatic Backups**: Every file backed up before modification
- ✅ **Conflict Detection**: Detect concurrent modifications (mtime, content)
- ✅ **Rollback Capability**: Restore from backups on failure
- ✅ **Dry-Run Mode**: Preview changes without applying
- ✅ **Detailed Error Reporting**: Know exactly what failed and why
- ✅ **Safe File Operations**: Atomic write (write to temp, then rename)

## Architecture

### Transaction Model

The patch engine follows a **4-phase transaction model**:

```
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: VALIDATE                                      │
│  • Check file existence (for modify/delete ops)         │
│  • Validate line numbers are in range                   │
│  • Detect conflicts (mtime, content changes)            │
│  • Check write permissions                              │
│  • Verify parent directories exist (for create ops)     │
│  ⚠️  NO MODIFICATIONS - Read-only phase                 │
└─────────────────────────────────────────────────────────┘
                         ↓
         ┌───────────────────────────┐
         │ Validation passed?        │
         └───────────────────────────┘
                         ↓ Yes
┌─────────────────────────────────────────────────────────┐
│  PHASE 2: BACKUP                                        │
│  • Create backup directory (.claude-backup/backup-*)    │
│  • Copy all existing files to backup                    │
│  • Save metadata (paths, timestamps, sizes)             │
│  • Mark new files (no backup needed)                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  PHASE 3: APPLY                                         │
│  • For each file:                                       │
│    - Write new content to .tmp file                     │
│    - Rename .tmp to target (atomic operation)           │
│    - If ANY file fails → STOP immediately               │
│  • Track affected files and statistics                  │
└─────────────────────────────────────────────────────────┘
                         ↓
         ┌───────────────────────────┐
         │ All files applied?        │
         └───────────────────────────┘
          ↓ Yes              ↓ No
┌──────────────────┐  ┌──────────────────┐
│  PHASE 4: COMMIT │  │  PHASE 4: ROLLBACK│
│  • Success!      │  │  • Restore files  │
│  • Cleanup       │  │  • from backups   │
│    backups       │  │  • Keep backups   │
│    (optional)    │  │  • for debugging  │
└──────────────────┘  └──────────────────┘
```

### Backup Strategy

**Location:**
- Default: `.claude-backup/` in project root
- Configurable via `PatchOptions.backupDir`
- Each backup in timestamped subdirectory: `backup-{timestamp}/`

**Naming:**
- Format: `{filename}.{hash}.bak`
- Hash: First 8 chars of MD5 hash of file path (handles duplicates)
- Example: `app.ts.a1b2c3d4.bak`

**Metadata:**
- Stored in `metadata.json` within backup directory
- Contains:
  - Original file paths
  - Backup file paths
  - Original mtimes (modification times)
  - Original file sizes
  - Whether file existed before patch (for new files)
  - Working directory
  - Timestamp

**Cleanup:**
- Auto-cleanup on success (configurable via `autoCleanup` option)
- Kept on failure for debugging and manual recovery
- Manual cleanup available via backup management functions

**Example Backup Structure:**
```
.claude-backup/
├── backup-1700000000000/
│   ├── metadata.json
│   ├── app.ts.a1b2c3d4.bak
│   ├── utils.ts.e5f6g7h8.bak
│   └── test.ts.i9j0k1l2.bak
└── backup-1700000001000/
    ├── metadata.json
    └── ...
```

## API Reference

### Main Functions

#### `applyMultiFilePatch(multiFileDiff, options)`

Apply a multi-file patch atomically.

**Parameters:**
- `multiFileDiff`: `MultiFileDiff` - The set of file changes
- `options`: `PatchOptions` - Configuration options

**Returns:** `Promise<PatchResult>`

**Options:**
```typescript
interface PatchOptions {
  dryRun?: boolean;          // Preview without applying (default: false)
  backupDir?: string;        // Backup directory (default: '.claude-backup')
  validateOnly?: boolean;    // Only validate, no backup/apply (default: false)
  onConflict?: 'error' | 'warn' | 'merge';  // Conflict handling (default: 'error')
  autoCleanup?: boolean;     // Cleanup backups on success (default: true)
  verbose?: boolean;         // Detailed logging (default: false)
}
```

**Example:**
```typescript
const result = await applyMultiFilePatch(diff, {
  dryRun: false,
  backupDir: '.claude-backup',
  onConflict: 'error',
  autoCleanup: true,
  verbose: true,
});

if (result.success) {
  console.log(`Modified ${result.affectedFiles.length} files`);
} else {
  console.error('Patch failed:', result.errors);
}
```

#### `rollbackPatch(patchResult)`

Rollback a patch by restoring files from backups.

**Parameters:**
- `patchResult`: `PatchResult` - Result from `applyMultiFilePatch()`

**Returns:** `Promise<{ success: boolean; errors: PatchError[] }>`

**Example:**
```typescript
const patchResult = await applyMultiFilePatch(diff);

if (patchResult.success) {
  // Run tests...
  if (testsFailed) {
    await rollbackPatch(patchResult);
  }
}
```

#### `listBackups(backupRootDir)`

List all available backups.

**Parameters:**
- `backupRootDir`: `string` - Backup root directory (default: '.claude-backup')

**Returns:** `Array<{ dir: string; timestamp: number; fileCount: number }>`

#### `loadBackupMetadata(backupDir)`

Load metadata from a backup directory.

**Parameters:**
- `backupDir`: `string` - Path to backup directory

**Returns:** `BackupMetadata | null`

## Usage Examples

### Example 1: Basic Multi-File Refactoring

```typescript
import { applyMultiFilePatch } from './patch-engine';
import { MultiFileDiff } from './types';

// Rename a function across 3 files
const diff: MultiFileDiff = {
  files: [
    {
      filePath: '/src/utils.ts',
      changeType: 'modify',
      oldContent: 'export function oldName() { ... }',
      newContent: 'export function newName() { ... }',
    },
    {
      filePath: '/src/app.ts',
      changeType: 'modify',
      oldContent: 'import { oldName } from "./utils";',
      newContent: 'import { newName } from "./utils";',
    },
    {
      filePath: '/src/test.ts',
      changeType: 'modify',
      oldContent: 'expect(oldName()).toBe(...);',
      newContent: 'expect(newName()).toBe(...);',
    },
  ],
  description: 'Rename oldName to newName',
};

const result = await applyMultiFilePatch(diff);

if (result.success) {
  console.log('✓ Refactoring complete');
} else {
  console.error('✗ Refactoring failed:', result.errors);
}
```

### Example 2: Preview with Dry-Run

```typescript
// Preview changes first
const dryRunResult = await applyMultiFilePatch(diff, { dryRun: true });

console.log(`Would modify ${dryRunResult.affectedFiles.length} files:`);
dryRunResult.affectedFiles.forEach(f => console.log(`  - ${f}`));

// Apply for real if preview looks good
if (confirm('Apply these changes?')) {
  await applyMultiFilePatch(diff);
}
```

### Example 3: Validation Only

```typescript
// Check if patch can be applied without actually applying it
const validationResult = await applyMultiFilePatch(diff, {
  validateOnly: true
});

if (validationResult.success) {
  console.log('✓ Patch is valid and can be applied');
} else {
  console.error('✗ Validation failed:', validationResult.errors);
}
```

### Example 4: Handle Conflicts

```typescript
const result = await applyMultiFilePatch(diff, {
  onConflict: 'warn'  // Continue with warnings instead of erroring
});

if (result.warnings.length > 0) {
  console.warn('Conflicts detected:');
  result.warnings.forEach(w => console.warn(`  - ${w}`));
}
```

### Example 5: Apply with Manual Rollback

```typescript
const result = await applyMultiFilePatch(diff, {
  autoCleanup: false  // Keep backups
});

if (result.success) {
  // Run tests
  const testsPassed = await runTests();

  if (!testsPassed) {
    console.log('Tests failed, rolling back...');
    await rollbackPatch(result);
  } else {
    console.log('Tests passed, cleaning up backups...');
    // Backups auto-cleaned if autoCleanup: true
  }
}
```

### Example 6: Large Codebase Refactoring

```typescript
import * as fs from 'fs';
import * as path from 'path';

// Find all files that need to be updated
const filesToUpdate = findFilesWithPattern('oldFunctionName');

// Build multi-file diff
const diff: MultiFileDiff = {
  files: filesToUpdate.map(file => ({
    filePath: file,
    changeType: 'modify',
    oldContent: fs.readFileSync(file, 'utf-8'),
    newContent: fs.readFileSync(file, 'utf-8')
      .replace(/oldFunctionName/g, 'newFunctionName'),
  })),
  description: 'Rename oldFunctionName to newFunctionName globally',
};

// Apply with backup retention
const result = await applyMultiFilePatch(diff, {
  backupDir: '.claude-backup',
  autoCleanup: false,  // Keep backups until tests pass
  verbose: true,
});

console.log(`Modified ${result.stats?.filesModified} files`);
console.log(`Lines changed: +${result.stats?.linesAdded} -${result.stats?.linesRemoved}`);
console.log(`Duration: ${result.stats?.duration}ms`);
```

## Error Handling

### Error Types

The engine reports errors with detailed context:

```typescript
interface PatchError {
  type: 'validation' | 'backup' | 'application' | 'rollback' | 'conflict';
  filePath?: string;
  message: string;
  cause?: Error;
  context?: {
    lineNumber?: number;
    expectedContent?: string;
    actualContent?: string;
    [key: string]: unknown;
  };
}
```

### Common Errors

**Validation Errors:**
- File not found (for modify/delete)
- Invalid line numbers
- Parent directory missing (for create)
- No write permission
- Content/mtime conflicts

**Backup Errors:**
- Cannot create backup directory
- Cannot copy file to backup
- Cannot write metadata

**Application Errors:**
- Cannot write to file
- Temp file creation failed
- Atomic rename failed

**Rollback Errors:**
- Backup file not found
- Cannot restore from backup
- Missing backup metadata

### Best Practices

1. **Always validate first** (use `validateOnly: true` or `dryRun: true`)
2. **Keep backups** until you verify success (set `autoCleanup: false`)
3. **Run tests** before cleaning up backups
4. **Use verbose mode** during development for detailed logs
5. **Handle conflicts** appropriately for your use case
6. **Check permissions** before large operations
7. **Monitor disk space** for large refactorings (backups consume space)

## Integration with Edit Tool

The patch engine is designed to integrate with Claude Code's Edit tool:

```typescript
// In Edit tool implementation
import { applyMultiFilePatch } from './diff/patch-engine';

async function editMultipleFiles(edits: EditRequest[]) {
  // Convert edit requests to MultiFileDiff
  const diff = convertEditsToMultiFileDiff(edits);

  // Apply with patch engine
  const result = await applyMultiFilePatch(diff, {
    backupDir: '.claude-backup',
    onConflict: 'warn',
    verbose: false,
  });

  if (result.success) {
    console.log(`✓ Applied changes to ${result.affectedFiles.length} files`);
    if (result.backupDir) {
      console.log(`  Backup: ${result.backupDir}`);
    }
  } else {
    console.error('✗ Edit failed:', result.errors);
    if (result.backupDir) {
      console.error(`  Backup preserved at: ${result.backupDir}`);
    }
  }

  return result;
}
```

## Testing

Run the examples to test the patch engine:

```bash
cd src/diff
npx ts-node examples.ts
```

This will run all 8 example scenarios demonstrating:
1. Success case (3 files modified)
2. Validation failure (file doesn't exist)
3. Application failure & rollback
4. Conflict detection (mtime mismatch)
5. Dry-run mode (preview only)
6. Validate-only mode
7. Backup management
8. Large refactoring (function rename across files)

## Performance Considerations

- **Backup overhead**: Copying files adds ~10-50ms per file
- **Validation overhead**: Stat/read operations add ~5-20ms per file
- **Atomic writes**: Write-to-temp-then-rename adds ~2-5ms per file
- **Metadata I/O**: JSON serialization adds ~5-10ms total

**Example timings** (on typical hardware):
- 5 files, ~100 lines each: ~50-100ms total
- 50 files, ~500 lines each: ~500-1000ms total
- 500 files, ~1000 lines each: ~5-10s total

For very large operations (1000+ files), consider:
- Batching into smaller transactions
- Using faster backup storage (SSD vs HDD)
- Disabling verbose logging
- Running validation separately from application

## Thread Safety

⚠️ **Not thread-safe**: Do not run multiple `applyMultiFilePatch()` calls concurrently on overlapping file sets. Use a queue or mutex for concurrent operations.

## License

Part of Claude Code - see main repository LICENSE
