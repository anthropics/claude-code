/**
 * Test Cases for diff-model.ts
 *
 * These are example test cases demonstrating how to test the diff model.
 * Can be adapted to any testing framework (Jest, Mocha, etc.)
 */

import {
  parseDiff,
  parseMultiFileDiff,
  generateUnifiedDiff,
  applyDiff,
  reverseDiff,
  summarizeDiff,
  summarizeMultiFileDiff,
  createSimpleDiff,
  truncateDiff,
  isBinaryDiff,
  isEmptyDiff,
  DiffParseError,
  DiffApplyError,
  FileDiff,
  DiffLine,
  DiffHunk,
} from './diff-model';

// ============================================================================
// Test Suite: parseDiff
// ============================================================================

export function test_parseDiff_basicModification(): void {
  const input = `--- a/example.ts
+++ b/example.ts
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 modified
 line 3`;

  const result = parseDiff(input);

  assertEqual(result.filePath, 'example.ts');
  assertEqual(result.changeType, 'modify');
  assertEqual(result.hunks.length, 1);

  const hunk = result.hunks[0];
  assertEqual(hunk.oldStart, 1);
  assertEqual(hunk.oldCount, 3);
  assertEqual(hunk.newStart, 1);
  assertEqual(hunk.newCount, 3);
  assertEqual(hunk.lines.length, 3);

  assertEqual(hunk.lines[0].operation, 'context');
  assertEqual(hunk.lines[1].operation, 'delete');
  assertEqual(hunk.lines[2].operation, 'add');

  console.log('✓ test_parseDiff_basicModification passed');
}

export function test_parseDiff_newFile(): void {
  const input = `--- /dev/null
+++ b/new-file.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return "Hello";
+}`;

  const result = parseDiff(input);

  assertEqual(result.filePath, 'new-file.ts');
  assertEqual(result.changeType, 'add');
  assertEqual(result.oldFilePath, undefined);
  assertEqual(result.hunks.length, 1);

  const hunk = result.hunks[0];
  assertEqual(hunk.lines.every(line => line.operation === 'add'), true);

  console.log('✓ test_parseDiff_newFile passed');
}

export function test_parseDiff_deletedFile(): void {
  const input = `--- a/old-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function old() {
-  return "Old";
-}`;

  const result = parseDiff(input);

  assertEqual(result.filePath, '/dev/null');
  assertEqual(result.changeType, 'delete');
  assertEqual(result.oldFilePath, 'old-file.ts');

  console.log('✓ test_parseDiff_deletedFile passed');
}

export function test_parseDiff_binaryFile(): void {
  const input = 'Binary files a/image.png and b/image.png differ';

  const result = parseDiff(input);

  assertEqual(result.filePath, 'image.png');
  assertEqual(result.metadata?.isBinary, true);
  assertEqual(result.hunks.length, 0);

  console.log('✓ test_parseDiff_binaryFile passed');
}

export function test_parseDiff_multipleHunks(): void {
  const input = `--- a/example.ts
+++ b/example.ts
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 modified
 line 3
@@ -10,2 +10,3 @@
 line 10
+line 11
 line 12`;

  const result = parseDiff(input);

  assertEqual(result.hunks.length, 2);
  assertEqual(result.hunks[0].oldStart, 1);
  assertEqual(result.hunks[1].oldStart, 10);

  console.log('✓ test_parseDiff_multipleHunks passed');
}

export function test_parseDiff_withHeader(): void {
  const input = `--- a/example.ts
+++ b/example.ts
@@ -10,5 +10,6 @@ function example() {
   const x = 1;
-  const y = 2;
+  const y = 3;
   return x + y;
 }`;

  const result = parseDiff(input);

  assertEqual(result.hunks[0].header, 'function example() {');

  console.log('✓ test_parseDiff_withHeader passed');
}

export function test_parseDiff_invalidInput(): void {
  try {
    parseDiff('This is not a valid diff');
    throw new Error('Should have thrown DiffParseError');
  } catch (error) {
    assertEqual(error instanceof DiffParseError, true);
  }

  console.log('✓ test_parseDiff_invalidInput passed');
}

// ============================================================================
// Test Suite: generateUnifiedDiff
// ============================================================================

export function test_generateUnifiedDiff_basic(): void {
  const lines: DiffLine[] = [
    { operation: 'context', content: 'line 1', oldLineNum: 1, newLineNum: 1 },
    { operation: 'delete', content: 'line 2', oldLineNum: 2 },
    { operation: 'add', content: 'line 2 modified', newLineNum: 2 },
    { operation: 'context', content: 'line 3', oldLineNum: 3, newLineNum: 3 },
  ];

  const hunk: DiffHunk = {
    oldStart: 1,
    oldCount: 3,
    newStart: 1,
    newCount: 3,
    lines,
  };

  const fileDiff: FileDiff = {
    filePath: 'example.ts',
    changeType: 'modify',
    hunks: [hunk],
  };

  const result = generateUnifiedDiff(fileDiff);

  assertContains(result, '--- a/example.ts');
  assertContains(result, '+++ b/example.ts');
  assertContains(result, '@@ -1,3 +1,3 @@');
  assertContains(result, ' line 1');
  assertContains(result, '-line 2');
  assertContains(result, '+line 2 modified');
  assertContains(result, ' line 3');

  console.log('✓ test_generateUnifiedDiff_basic passed');
}

export function test_generateUnifiedDiff_newFile(): void {
  const fileDiff: FileDiff = {
    filePath: 'new.ts',
    changeType: 'add',
    hunks: [
      {
        oldStart: 0,
        oldCount: 0,
        newStart: 1,
        newCount: 1,
        lines: [{ operation: 'add', content: 'new content', newLineNum: 1 }],
      },
    ],
  };

  const result = generateUnifiedDiff(fileDiff);

  assertContains(result, '--- /dev/null');
  assertContains(result, '+++ b/new.ts');

  console.log('✓ test_generateUnifiedDiff_newFile passed');
}

export function test_generateUnifiedDiff_binaryFile(): void {
  const fileDiff: FileDiff = {
    filePath: 'image.png',
    changeType: 'modify',
    hunks: [],
    metadata: { isBinary: true },
  };

  const result = generateUnifiedDiff(fileDiff);

  assertContains(result, 'Binary files');
  assertContains(result, 'image.png');

  console.log('✓ test_generateUnifiedDiff_binaryFile passed');
}

// ============================================================================
// Test Suite: applyDiff
// ============================================================================

export function test_applyDiff_basic(): void {
  const original = 'line 1\nline 2\nline 3';
  const diff = createSimpleDiff('test.ts', original, 'line 1\nline 2 modified\nline 3');

  const result = applyDiff(original, diff);

  assertEqual(result, 'line 1\nline 2 modified\nline 3');

  console.log('✓ test_applyDiff_basic passed');
}

export function test_applyDiff_additions(): void {
  const original = 'line 1\nline 2';
  const diff = createSimpleDiff('test.ts', original, 'line 1\nline 2\nline 3');

  const result = applyDiff(original, diff);

  assertEqual(result, 'line 1\nline 2\nline 3');

  console.log('✓ test_applyDiff_additions passed');
}

export function test_applyDiff_deletions(): void {
  const original = 'line 1\nline 2\nline 3';
  const diff = createSimpleDiff('test.ts', original, 'line 1\nline 3');

  const result = applyDiff(original, diff);

  assertEqual(result, 'line 1\nline 3');

  console.log('✓ test_applyDiff_deletions passed');
}

export function test_applyDiff_newFile(): void {
  const diff = createSimpleDiff('new.ts', '', 'line 1\nline 2');

  const result = applyDiff('', diff);

  assertEqual(result, 'line 1\nline 2');

  console.log('✓ test_applyDiff_newFile passed');
}

export function test_applyDiff_deleteFile(): void {
  const original = 'line 1\nline 2';
  const diff = createSimpleDiff('delete.ts', original, '');

  const result = applyDiff(original, diff);

  assertEqual(result, '');

  console.log('✓ test_applyDiff_deleteFile passed');
}

export function test_applyDiff_contextMismatch(): void {
  const original = 'different content\nline 2\nline 3';

  const diffString = `--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,3 @@
-line 1
+line 1 modified
 line 2
 line 3`;

  const diff = parseDiff(diffString);

  try {
    applyDiff(original, diff);
    throw new Error('Should have thrown DiffApplyError');
  } catch (error) {
    assertEqual(error instanceof DiffApplyError, true);
  }

  console.log('✓ test_applyDiff_contextMismatch passed');
}

// ============================================================================
// Test Suite: reverseDiff
// ============================================================================

export function test_reverseDiff_basic(): void {
  const original = 'line 1\nline 2\nline 3';
  const modified = 'line 1\nline 2 modified\nline 3';

  const forwardDiff = createSimpleDiff('test.ts', original, modified);
  const reversedDiff = reverseDiff(forwardDiff);

  const result = applyDiff(modified, reversedDiff);

  assertEqual(result, original);

  console.log('✓ test_reverseDiff_basic passed');
}

export function test_reverseDiff_newFile(): void {
  const diff = createSimpleDiff('new.ts', '', 'content');
  const reversed = reverseDiff(diff);

  assertEqual(diff.changeType, 'add');
  assertEqual(reversed.changeType, 'delete');

  console.log('✓ test_reverseDiff_newFile passed');
}

export function test_reverseDiff_deleteFile(): void {
  const diff = createSimpleDiff('delete.ts', 'content', '');
  const reversed = reverseDiff(diff);

  assertEqual(diff.changeType, 'delete');
  assertEqual(reversed.changeType, 'add');

  console.log('✓ test_reverseDiff_deleteFile passed');
}

// ============================================================================
// Test Suite: summarizeDiff
// ============================================================================

export function test_summarizeDiff_modification(): void {
  const diff = createSimpleDiff('test.ts', 'line 1\nline 2\nline 3', 'line 1\nline 2 modified\nline 3\nline 4');

  const summary = summarizeDiff(diff);

  assertContains(summary, 'test.ts');
  assertContains(summary, '+2'); // 1 modified (shown as delete+add) + 1 new = 2 additions
  assertContains(summary, '-1'); // 1 modified (delete part)

  console.log('✓ test_summarizeDiff_modification passed');
}

export function test_summarizeDiff_newFile(): void {
  const diff = createSimpleDiff('new.ts', '', 'line 1\nline 2');

  const summary = summarizeDiff(diff);

  assertContains(summary, 'New file');
  assertContains(summary, 'new.ts');

  console.log('✓ test_summarizeDiff_newFile passed');
}

export function test_summarizeDiff_deleteFile(): void {
  const diff = createSimpleDiff('delete.ts', 'line 1\nline 2', '');

  const summary = summarizeDiff(diff);

  assertContains(summary, 'Deleted file');
  assertContains(summary, 'delete.ts');

  console.log('✓ test_summarizeDiff_deleteFile passed');
}

export function test_summarizeDiff_binaryFile(): void {
  const diff: FileDiff = {
    filePath: 'image.png',
    changeType: 'modify',
    hunks: [],
    metadata: { isBinary: true },
  };

  const summary = summarizeDiff(diff);

  assertContains(summary, 'Binary file');
  assertContains(summary, 'image.png');

  console.log('✓ test_summarizeDiff_binaryFile passed');
}

export function test_summarizeDiff_rename(): void {
  const diff: FileDiff = {
    filePath: 'new-name.ts',
    oldFilePath: 'old-name.ts',
    changeType: 'rename',
    hunks: [],
  };

  const summary = summarizeDiff(diff);

  assertContains(summary, 'Renamed');
  assertContains(summary, 'old-name.ts');
  assertContains(summary, 'new-name.ts');

  console.log('✓ test_summarizeDiff_rename passed');
}

// ============================================================================
// Test Suite: parseMultiFileDiff
// ============================================================================

export function test_parseMultiFileDiff_basic(): void {
  const input = `--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,2 @@
-line 1
+line 1 modified
 line 2
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,3 @@
 line 1
+line 2
 line 3`;

  const result = parseMultiFileDiff(input);

  assertEqual(result.files.length, 2);
  assertEqual(result.files[0].filePath, 'file1.ts');
  assertEqual(result.files[1].filePath, 'file2.ts');

  console.log('✓ test_parseMultiFileDiff_basic passed');
}

export function test_summarizeMultiFileDiff(): void {
  const diff1 = createSimpleDiff('file1.ts', 'a\nb\nc', 'a\nb modified\nc\nd');
  const diff2 = createSimpleDiff('file2.ts', '', 'new content');

  const multiDiff = {
    files: [diff1, diff2],
  };

  const summary = summarizeMultiFileDiff(multiDiff);

  assertContains(summary, '2 files');
  assertContains(summary, 'insertion');
  assertContains(summary, '1 added');

  console.log('✓ test_summarizeMultiFileDiff passed');
}

// ============================================================================
// Test Suite: Utility Functions
// ============================================================================

export function test_createSimpleDiff(): void {
  const diff = createSimpleDiff('test.ts', 'old', 'new');

  assertEqual(diff.filePath, 'test.ts');
  assertEqual(diff.changeType, 'modify');
  assertEqual(diff.hunks.length, 1);

  console.log('✓ test_createSimpleDiff passed');
}

export function test_truncateDiff(): void {
  const lines: DiffLine[] = [
    { operation: 'add', content: 'line', newLineNum: 1 },
  ];

  const hunks: DiffHunk[] = Array.from({ length: 10 }, (_, i) => ({
    oldStart: i * 10,
    oldCount: 1,
    newStart: i * 10,
    newCount: 1,
    lines,
  }));

  const diff: FileDiff = {
    filePath: 'large.ts',
    changeType: 'modify',
    hunks,
  };

  const truncated = truncateDiff(diff, 3);

  assertEqual(truncated.hunks.length, 3);
  assertEqual(diff.hunks.length, 10); // Original unchanged

  console.log('✓ test_truncateDiff passed');
}

export function test_isBinaryDiff(): void {
  const binaryDiff: FileDiff = {
    filePath: 'image.png',
    changeType: 'modify',
    hunks: [],
    metadata: { isBinary: true },
  };

  const textDiff: FileDiff = {
    filePath: 'text.ts',
    changeType: 'modify',
    hunks: [],
  };

  assertEqual(isBinaryDiff(binaryDiff), true);
  assertEqual(isBinaryDiff(textDiff), false);

  console.log('✓ test_isBinaryDiff passed');
}

export function test_isEmptyDiff(): void {
  const emptyDiff: FileDiff = {
    filePath: 'test.ts',
    changeType: 'modify',
    hunks: [
      {
        oldStart: 1,
        oldCount: 2,
        newStart: 1,
        newCount: 2,
        lines: [
          { operation: 'context', content: 'line 1', oldLineNum: 1, newLineNum: 1 },
          { operation: 'context', content: 'line 2', oldLineNum: 2, newLineNum: 2 },
        ],
      },
    ],
  };

  const nonEmptyDiff: FileDiff = {
    filePath: 'test.ts',
    changeType: 'modify',
    hunks: [
      {
        oldStart: 1,
        oldCount: 1,
        newStart: 1,
        newCount: 1,
        lines: [
          { operation: 'add', content: 'new line', newLineNum: 1 },
        ],
      },
    ],
  };

  assertEqual(isEmptyDiff(emptyDiff), true);
  assertEqual(isEmptyDiff(nonEmptyDiff), false);

  console.log('✓ test_isEmptyDiff passed');
}

// ============================================================================
// Test Helpers
// ============================================================================

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: expected ${expected}, got ${actual}`);
  }
}

function assertContains(text: string, substring: string): void {
  if (!text.includes(substring)) {
    throw new Error(`Assertion failed: "${text}" does not contain "${substring}"`);
  }
}

// ============================================================================
// Run All Tests
// ============================================================================

export function runAllTests(): void {
  console.log('Running diff-model test suite...\n');

  const tests = [
    // parseDiff tests
    test_parseDiff_basicModification,
    test_parseDiff_newFile,
    test_parseDiff_deletedFile,
    test_parseDiff_binaryFile,
    test_parseDiff_multipleHunks,
    test_parseDiff_withHeader,
    test_parseDiff_invalidInput,

    // generateUnifiedDiff tests
    test_generateUnifiedDiff_basic,
    test_generateUnifiedDiff_newFile,
    test_generateUnifiedDiff_binaryFile,

    // applyDiff tests
    test_applyDiff_basic,
    test_applyDiff_additions,
    test_applyDiff_deletions,
    test_applyDiff_newFile,
    test_applyDiff_deleteFile,
    test_applyDiff_contextMismatch,

    // reverseDiff tests
    test_reverseDiff_basic,
    test_reverseDiff_newFile,
    test_reverseDiff_deleteFile,

    // summarizeDiff tests
    test_summarizeDiff_modification,
    test_summarizeDiff_newFile,
    test_summarizeDiff_deleteFile,
    test_summarizeDiff_binaryFile,
    test_summarizeDiff_rename,

    // parseMultiFileDiff tests
    test_parseMultiFileDiff_basic,
    test_summarizeMultiFileDiff,

    // Utility tests
    test_createSimpleDiff,
    test_truncateDiff,
    test_isBinaryDiff,
    test_isEmptyDiff,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      passed++;
    } catch (error) {
      console.error(`✗ ${test.name} failed:`, error);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(60)}`);

  if (failed === 0) {
    console.log('✓ All tests passed!');
  }
}

// Uncomment to run all tests:
// runAllTests();
