/**
 * Multi-File Patch Engine - Usage Examples
 *
 * This file demonstrates how to use the patch engine for various scenarios:
 * - Applying a multi-file patch
 * - Handling conflicts
 * - Rolling back on failure
 * - Dry-run mode
 */

import { applyMultiFilePatch, rollbackPatch, listBackups, loadBackupMetadata } from './patch-engine';
import { MultiFileDiff, FileDiff, PatchOptions } from './types';
import * as fs from 'fs';

// ====================
// EXAMPLE 1: SUCCESS CASE
// ====================

/**
 * Apply a multi-file patch successfully
 */
async function example1_successCase() {
  console.log('\n=== EXAMPLE 1: Success Case ===\n');

  // Create a multi-file diff
  const multiFileDiff: MultiFileDiff = {
    files: [
      {
        filePath: '/tmp/test-patch/file1.ts',
        changeType: 'modify',
        oldContent: 'const x = 1;\n',
        newContent: 'const x = 2;\n',
      },
      {
        filePath: '/tmp/test-patch/file2.ts',
        changeType: 'modify',
        oldContent: 'const y = 1;\n',
        newContent: 'const y = 2;\n',
      },
      {
        filePath: '/tmp/test-patch/file3.ts',
        changeType: 'create',
        newContent: 'const z = 3;\n',
      },
    ],
    description: 'Update constants across multiple files',
    timestamp: Date.now(),
  };

  // Setup test files
  fs.mkdirSync('/tmp/test-patch', { recursive: true });
  fs.writeFileSync('/tmp/test-patch/file1.ts', 'const x = 1;\n');
  fs.writeFileSync('/tmp/test-patch/file2.ts', 'const y = 1;\n');

  // Apply the patch
  const result = await applyMultiFilePatch(multiFileDiff, {
    backupDir: '/tmp/test-patch-backups',
    autoCleanup: false, // Keep backups for demonstration
    verbose: true,
  });

  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`✓ Successfully applied changes to ${result.affectedFiles.length} files`);
    console.log(`  Files modified: ${result.stats?.filesModified}`);
    console.log(`  Files created: ${result.stats?.filesCreated}`);
    console.log(`  Lines added: ${result.stats?.linesAdded}`);
    console.log(`  Duration: ${result.stats?.duration}ms`);
    console.log(`  Backup directory: ${result.backupDir}`);
  } else {
    console.error('✗ Patch failed:', result.errors);
  }
}

// ====================
// EXAMPLE 2: VALIDATION FAILURE
// ====================

/**
 * Demonstrate validation catching errors before modifying files
 */
async function example2_validationFailure() {
  console.log('\n=== EXAMPLE 2: Validation Failure ===\n');

  const multiFileDiff: MultiFileDiff = {
    files: [
      {
        filePath: '/tmp/test-patch/file1.ts',
        changeType: 'modify',
        oldContent: 'const x = 1;\n',
        newContent: 'const x = 2;\n',
      },
      {
        filePath: '/tmp/test-patch/non-existent-file.ts',
        changeType: 'modify', // This will fail - file doesn't exist
        oldContent: 'old',
        newContent: 'new',
      },
      {
        filePath: '/tmp/test-patch/file3.ts',
        changeType: 'modify',
        oldContent: 'const z = 3;\n',
        newContent: 'const z = 4;\n',
      },
    ],
    description: 'Patch with invalid file reference',
  };

  const result = await applyMultiFilePatch(multiFileDiff, {
    verbose: true,
  });

  if (!result.success) {
    console.log('✓ Validation correctly caught errors:');
    result.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. [${error.type}] ${error.message}`);
      if (error.filePath) {
        console.log(`     File: ${error.filePath}`);
      }
    });
    console.log('\n✓ No files were modified (atomic validation)');
  } else {
    console.error('✗ Unexpected success - validation should have failed');
  }
}

// ====================
// EXAMPLE 3: APPLICATION FAILURE & ROLLBACK
// ====================

/**
 * Demonstrate rollback when application fails
 */
async function example3_applicationFailureAndRollback() {
  console.log('\n=== EXAMPLE 3: Application Failure & Rollback ===\n');

  // Setup: Create test files
  fs.mkdirSync('/tmp/test-patch', { recursive: true });
  fs.writeFileSync('/tmp/test-patch/file1.ts', 'const x = 1;\n');
  fs.writeFileSync('/tmp/test-patch/file2.ts', 'const y = 1;\n');

  const multiFileDiff: MultiFileDiff = {
    files: [
      {
        filePath: '/tmp/test-patch/file1.ts',
        changeType: 'modify',
        oldContent: 'const x = 1;\n',
        newContent: 'const x = 100;\n',
      },
      {
        filePath: '/tmp/test-patch/file2.ts',
        changeType: 'modify',
        oldContent: 'const y = 1;\n',
        newContent: 'const y = 200;\n',
      },
    ],
    description: 'Patch that will be rolled back',
  };

  // Apply patch
  const result = await applyMultiFilePatch(multiFileDiff, {
    backupDir: '/tmp/test-patch-backups',
    autoCleanup: false,
    verbose: true,
  });

  if (result.success) {
    console.log('✓ Patch applied successfully');
    console.log('  Affected files:', result.affectedFiles);

    // Now simulate a need to rollback (e.g., tests failed)
    console.log('\n  Simulating test failure... initiating rollback');

    const rollbackResult = await rollbackPatch(result);

    if (rollbackResult.success) {
      console.log('✓ Rollback successful!');
      console.log('  All files restored to original state');

      // Verify rollback
      const file1Content = fs.readFileSync('/tmp/test-patch/file1.ts', 'utf-8');
      const file2Content = fs.readFileSync('/tmp/test-patch/file2.ts', 'utf-8');

      console.log(`  file1.ts content: "${file1Content.trim()}" (should be "const x = 1;")`);
      console.log(`  file2.ts content: "${file2Content.trim()}" (should be "const y = 1;")`);
    } else {
      console.error('✗ Rollback failed:', rollbackResult.errors);
    }
  }
}

// ====================
// EXAMPLE 4: CONFLICT DETECTION
// ====================

/**
 * Demonstrate conflict detection when file is modified externally
 */
async function example4_conflictDetection() {
  console.log('\n=== EXAMPLE 4: Conflict Detection ===\n');

  // Setup: Create a test file
  fs.mkdirSync('/tmp/test-patch', { recursive: true });
  fs.writeFileSync('/tmp/test-patch/file1.ts', 'const x = 1;\n');

  // Get file stats for conflict detection
  const stats = fs.statSync('/tmp/test-patch/file1.ts');
  const originalMtime = stats.mtimeMs;

  // Wait a bit and modify the file externally
  await new Promise(resolve => setTimeout(resolve, 100));
  fs.writeFileSync('/tmp/test-patch/file1.ts', 'const x = 999; // Modified externally\n');

  // Create diff with old mtime (will detect conflict)
  const multiFileDiff: MultiFileDiff = {
    files: [
      {
        filePath: '/tmp/test-patch/file1.ts',
        changeType: 'modify',
        oldContent: 'const x = 1;\n',
        newContent: 'const x = 2;\n',
        metadata: {
          mtime: originalMtime, // Old mtime - will trigger conflict
        },
      },
    ],
    description: 'Patch with mtime conflict',
  };

  // Test with error on conflict (default)
  console.log('Testing with onConflict: "error"');
  const result1 = await applyMultiFilePatch(multiFileDiff, {
    onConflict: 'error',
    verbose: true,
  });

  if (!result1.success) {
    console.log('✓ Conflict correctly detected and blocked:');
    result1.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. [${error.type}] ${error.message}`);
    });
  }

  // Test with warning on conflict
  console.log('\nTesting with onConflict: "warn"');
  const result2 = await applyMultiFilePatch(multiFileDiff, {
    onConflict: 'warn',
    verbose: true,
  });

  if (result2.warnings.length > 0) {
    console.log('✓ Conflicts generated warnings:');
    result2.warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning}`);
    });
  }

  // Note: In a real implementation with 'merge' strategy,
  // you would attempt to merge changes intelligently
}

// ====================
// EXAMPLE 5: DRY-RUN MODE
// ====================

/**
 * Preview changes without applying them
 */
async function example5_dryRunMode() {
  console.log('\n=== EXAMPLE 5: Dry-Run Mode ===\n');

  // Setup
  fs.mkdirSync('/tmp/test-patch', { recursive: true });
  fs.writeFileSync('/tmp/test-patch/file1.ts', 'const x = 1;\n');

  const multiFileDiff: MultiFileDiff = {
    files: [
      {
        filePath: '/tmp/test-patch/file1.ts',
        changeType: 'modify',
        oldContent: 'const x = 1;\n',
        newContent: 'const x = 100;\n',
      },
      {
        filePath: '/tmp/test-patch/file2.ts',
        changeType: 'create',
        newContent: 'const y = 200;\n',
      },
    ],
    description: 'Preview these changes',
  };

  const result = await applyMultiFilePatch(multiFileDiff, {
    dryRun: true,
    verbose: true,
  });

  console.log('Dry-run result:');
  console.log(`  Would affect ${result.affectedFiles.length} files:`, result.affectedFiles);
  console.log(`  Files to be modified: ${result.stats?.filesModified}`);
  console.log(`  Files to be created: ${result.stats?.filesCreated}`);
  console.log(`  Lines to be added: ${result.stats?.linesAdded}`);

  // Verify files weren't actually modified
  const file1Content = fs.readFileSync('/tmp/test-patch/file1.ts', 'utf-8');
  const file2Exists = fs.existsSync('/tmp/test-patch/file2.ts');

  console.log('\nVerification:');
  console.log(`  file1.ts unchanged: ${file1Content === 'const x = 1;\n' ? '✓' : '✗'}`);
  console.log(`  file2.ts not created: ${!file2Exists ? '✓' : '✗'}`);
}

// ====================
// EXAMPLE 6: VALIDATE-ONLY MODE
// ====================

/**
 * Only validate without creating backups or applying changes
 */
async function example6_validateOnlyMode() {
  console.log('\n=== EXAMPLE 6: Validate-Only Mode ===\n');

  // Setup
  fs.mkdirSync('/tmp/test-patch', { recursive: true });
  fs.writeFileSync('/tmp/test-patch/file1.ts', 'const x = 1;\n');

  const multiFileDiff: MultiFileDiff = {
    files: [
      {
        filePath: '/tmp/test-patch/file1.ts',
        changeType: 'modify',
        oldContent: 'const x = 1;\n',
        newContent: 'const x = 100;\n',
      },
      {
        filePath: '/tmp/test-patch/non-existent.ts',
        changeType: 'modify',
        oldContent: 'old',
        newContent: 'new',
      },
    ],
    description: 'Validate this patch',
  };

  const result = await applyMultiFilePatch(multiFileDiff, {
    validateOnly: true,
    verbose: true,
  });

  if (!result.success) {
    console.log('✓ Validation completed. Found errors:');
    result.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. [${error.type}] ${error.filePath}: ${error.message}`);
    });
  } else {
    console.log('✓ Validation passed - patch can be applied safely');
  }

  console.log('\nNote: No backups created, no files modified (validate-only mode)');
}

// ====================
// EXAMPLE 7: BACKUP MANAGEMENT
// ====================

/**
 * List and manage backups
 */
async function example7_backupManagement() {
  console.log('\n=== EXAMPLE 7: Backup Management ===\n');

  // List all available backups
  const backups = listBackups('/tmp/test-patch-backups');

  console.log(`Found ${backups.length} backup(s):`);
  backups.forEach((backup, i) => {
    const date = new Date(backup.timestamp);
    console.log(`  ${i + 1}. ${backup.dir}`);
    console.log(`     Created: ${date.toISOString()}`);
    console.log(`     Files: ${backup.fileCount}`);
  });

  // Load metadata for the most recent backup
  if (backups.length > 0) {
    console.log('\nMost recent backup details:');
    const metadata = loadBackupMetadata(backups[0].dir);

    if (metadata) {
      console.log(`  Backup directory: ${metadata.backupDir}`);
      console.log(`  Working directory: ${metadata.workingDir}`);
      console.log(`  Timestamp: ${new Date(metadata.timestamp).toISOString()}`);
      console.log(`  Files backed up:`);

      for (const [originalPath, fileInfo] of metadata.files.entries()) {
        console.log(`    - ${originalPath}`);
        console.log(`      Backup: ${fileInfo.backupPath}`);
        console.log(`      Size: ${fileInfo.originalSize} bytes`);
        console.log(`      Existed: ${fileInfo.existed}`);
      }
    }
  }
}

// ====================
// EXAMPLE 8: LARGE REFACTORING
// ====================

/**
 * Example of using the patch engine for a large refactoring
 * (e.g., renaming a function across multiple files)
 */
async function example8_largeRefactoring() {
  console.log('\n=== EXAMPLE 8: Large Refactoring ===\n');

  // Setup: Create multiple files that use a function
  fs.mkdirSync('/tmp/test-patch/src', { recursive: true });

  fs.writeFileSync('/tmp/test-patch/src/utils.ts',
    'export function oldFunctionName() {\n  return "hello";\n}\n'
  );

  fs.writeFileSync('/tmp/test-patch/src/app.ts',
    'import { oldFunctionName } from "./utils";\n\nconsole.log(oldFunctionName());\n'
  );

  fs.writeFileSync('/tmp/test-patch/src/test.ts',
    'import { oldFunctionName } from "./utils";\n\ntest("it works", () => {\n  expect(oldFunctionName()).toBe("hello");\n});\n'
  );

  // Create a patch to rename the function everywhere
  const multiFileDiff: MultiFileDiff = {
    files: [
      {
        filePath: '/tmp/test-patch/src/utils.ts',
        changeType: 'modify',
        oldContent: 'export function oldFunctionName() {\n  return "hello";\n}\n',
        newContent: 'export function newFunctionName() {\n  return "hello";\n}\n',
      },
      {
        filePath: '/tmp/test-patch/src/app.ts',
        changeType: 'modify',
        oldContent: 'import { oldFunctionName } from "./utils";\n\nconsole.log(oldFunctionName());\n',
        newContent: 'import { newFunctionName } from "./utils";\n\nconsole.log(newFunctionName());\n',
      },
      {
        filePath: '/tmp/test-patch/src/test.ts',
        changeType: 'modify',
        oldContent: 'import { oldFunctionName } from "./utils";\n\ntest("it works", () => {\n  expect(oldFunctionName()).toBe("hello");\n});\n',
        newContent: 'import { newFunctionName } from "./utils";\n\ntest("it works", () => {\n  expect(newFunctionName()).toBe("hello");\n});\n',
      },
    ],
    description: 'Rename oldFunctionName to newFunctionName across codebase',
    metadata: {
      source: 'refactoring-tool',
      taskId: 'REF-123',
    },
  };

  // Apply with dry-run first to preview
  console.log('Step 1: Dry-run to preview changes...\n');
  const dryRunResult = await applyMultiFilePatch(multiFileDiff, {
    dryRun: true,
    verbose: false,
  });

  console.log(`Would modify ${dryRunResult.affectedFiles.length} files:`);
  dryRunResult.affectedFiles.forEach(file => console.log(`  - ${file}`));

  // Apply for real
  console.log('\nStep 2: Applying changes...\n');
  const result = await applyMultiFilePatch(multiFileDiff, {
    backupDir: '/tmp/test-patch-backups',
    autoCleanup: false,
    verbose: false,
  });

  if (result.success) {
    console.log('✓ Refactoring completed successfully!');
    console.log(`  Files modified: ${result.stats?.filesModified}`);
    console.log(`  Duration: ${result.stats?.duration}ms`);
    console.log(`  Backup: ${result.backupDir}`);
    console.log('\n  If tests pass, backup can be cleaned up.');
    console.log('  If tests fail, use rollbackPatch() to revert.');
  } else {
    console.error('✗ Refactoring failed:', result.errors);
  }
}

// ====================
// RUN ALL EXAMPLES
// ====================

export async function runAllExamples() {
  try {
    await example1_successCase();
    await example2_validationFailure();
    await example3_applicationFailureAndRollback();
    await example4_conflictDetection();
    await example5_dryRunMode();
    await example6_validateOnlyMode();
    await example7_backupManagement();
    await example8_largeRefactoring();

    console.log('\n=== All examples completed ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// If running this file directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
