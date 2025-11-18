/**
 * Usage Examples for diff-model.ts
 *
 * This file demonstrates how to use the diff model types and helper functions.
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
  FileDiff,
  MultiFileDiff,
  DiffLine,
  DiffHunk,
} from './diff-model';

// ============================================================================
// Example 1: Creating a FileDiff Programmatically
// ============================================================================

export function example1_createFileDiff(): void {
  console.log('=== Example 1: Create FileDiff ===\n');

  // Method 1: Using createSimpleDiff helper
  const originalContent = `function greet(name: string): string {
  return "Hello, " + name;
}`;

  const newContent = `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}`;

  const diff = createSimpleDiff('greeting.ts', originalContent, newContent);

  console.log('File:', diff.filePath);
  console.log('Change type:', diff.changeType);
  console.log('Summary:', summarizeDiff(diff));
  console.log('\nGenerated diff:\n', generateUnifiedDiff(diff));

  // Method 2: Manual construction
  const lines: DiffLine[] = [
    {
      operation: 'context',
      content: 'function greet(name: string): string {',
      oldLineNum: 1,
      newLineNum: 1,
    },
    {
      operation: 'delete',
      content: '  return "Hello, " + name;',
      oldLineNum: 2,
    },
    {
      operation: 'add',
      content: '  return `Hello, ${name}!`;',
      newLineNum: 2,
    },
    {
      operation: 'context',
      content: '}',
      oldLineNum: 3,
      newLineNum: 3,
    },
  ];

  const hunk: DiffHunk = {
    oldStart: 1,
    oldCount: 3,
    newStart: 1,
    newCount: 3,
    lines,
  };

  const manualDiff: FileDiff = {
    filePath: 'greeting.ts',
    changeType: 'modify',
    hunks: [hunk],
  };

  console.log('\nManually created diff:');
  console.log('Summary:', summarizeDiff(manualDiff));
}

// ============================================================================
// Example 2: Parsing a Unified Diff
// ============================================================================

export function example2_parseUnifiedDiff(): void {
  console.log('\n=== Example 2: Parse Unified Diff ===\n');

  const unifiedDiffString = `--- a/example.ts
+++ b/example.ts
@@ -10,5 +10,6 @@ function example() {
   const x = 1;
-  const y = 2;
+  const y = 3;
+  const z = 4;
   return x + y;
 }`;

  const parsed = parseDiff(unifiedDiffString);

  console.log('Parsed diff:');
  console.log('File:', parsed.filePath);
  console.log('Change type:', parsed.changeType);
  console.log('Number of hunks:', parsed.hunks.length);
  console.log('Summary:', summarizeDiff(parsed));

  // Inspect the first hunk
  const firstHunk = parsed.hunks[0];
  console.log('\nFirst hunk:');
  console.log(`  Range: @@ -${firstHunk.oldStart},${firstHunk.oldCount} +${firstHunk.newStart},${firstHunk.newCount} @@`);
  console.log('  Lines:');
  for (const line of firstHunk.lines) {
    const prefix = line.operation === 'add' ? '+' : line.operation === 'delete' ? '-' : ' ';
    console.log(`    ${prefix} ${line.content}`);
  }
}

// ============================================================================
// Example 3: Applying a Diff
// ============================================================================

export function example3_applyDiff(): void {
  console.log('\n=== Example 3: Apply Diff ===\n');

  const originalContent = `function example() {
  const x = 1;
  const y = 2;
  return x + y;
}`;

  const unifiedDiffString = `--- a/example.ts
+++ b/example.ts
@@ -1,5 +1,6 @@
 function example() {
   const x = 1;
-  const y = 2;
+  const y = 3;
+  const z = 4;
   return x + y;
 }`;

  const diff = parseDiff(unifiedDiffString);

  console.log('Original content:');
  console.log(originalContent);

  const newContent = applyDiff(originalContent, diff);

  console.log('\nAfter applying diff:');
  console.log(newContent);

  console.log('\nExpected changes:');
  console.log('  - Line 3: "const y = 2;" → "const y = 3;"');
  console.log('  - Line 4: Added "const z = 4;"');
}

// ============================================================================
// Example 4: Reversing a Diff
// ============================================================================

export function example4_reverseDiff(): void {
  console.log('\n=== Example 4: Reverse Diff ===\n');

  const originalContent = 'line 1\nline 2\nline 3';
  const newContent = 'line 1\nline 2 modified\nline 3\nline 4';

  const forwardDiff = createSimpleDiff('example.txt', originalContent, newContent);

  console.log('Forward diff summary:', summarizeDiff(forwardDiff));
  console.log('\nForward diff:');
  console.log(generateUnifiedDiff(forwardDiff));

  const reversedDiff = reverseDiff(forwardDiff);

  console.log('\nReversed diff summary:', summarizeDiff(reversedDiff));
  console.log('\nReversed diff:');
  console.log(generateUnifiedDiff(reversedDiff));

  // Verify: applying reversed diff to new content should give original
  const restoredOriginal = applyDiff(newContent, reversedDiff);
  console.log('\nVerification:');
  console.log('Original matches restored?', originalContent === restoredOriginal);
}

// ============================================================================
// Example 5: Summarizing Changes
// ============================================================================

export function example5_summarizeDiff(): void {
  console.log('\n=== Example 5: Summarize Diff ===\n');

  // Example: New file
  const newFileDiff = createSimpleDiff(
    'new-feature.ts',
    '',
    'export function newFeature() {\n  return "Hello";\n}'
  );
  console.log('New file:', summarizeDiff(newFileDiff));

  // Example: Deleted file
  const deletedFileDiff = createSimpleDiff(
    'old-code.ts',
    'const old = true;\nconsole.log(old);',
    ''
  );
  console.log('Deleted file:', summarizeDiff(deletedFileDiff));

  // Example: Modified file
  const modifiedFileDiff = createSimpleDiff(
    'updated.ts',
    'const x = 1;\nconst y = 2;\nconst z = 3;',
    'const x = 1;\nconst y = 5;\nconst z = 3;\nconst w = 4;'
  );
  console.log('Modified file:', summarizeDiff(modifiedFileDiff));

  // Example: Renamed file
  const renamedFileDiff: FileDiff = {
    filePath: 'new-name.ts',
    oldFilePath: 'old-name.ts',
    changeType: 'rename',
    hunks: [],
  };
  console.log('Renamed file:', summarizeDiff(renamedFileDiff));
}

// ============================================================================
// Example 6: Multi-File Diff
// ============================================================================

export function example6_multiFileDiff(): void {
  console.log('\n=== Example 6: Multi-File Diff ===\n');

  const multiDiffString = `--- a/file1.ts
+++ b/file1.ts
@@ -1,3 +1,3 @@
 const x = 1;
-const y = 2;
+const y = 3;
 const z = 3;
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,3 @@
 function test() {
+  console.log("Hello");
   return true;
 }
--- /dev/null
+++ b/file3.ts
@@ -0,0 +1,3 @@
+export function newFunc() {
+  return "New";
+}`;

  const multiDiff = parseMultiFileDiff(multiDiffString);

  console.log('Multi-file diff parsed:');
  console.log('Number of files:', multiDiff.files.length);
  console.log('\nOverall summary:', summarizeMultiFileDiff(multiDiff));

  console.log('\nPer-file summaries:');
  for (const file of multiDiff.files) {
    console.log(`  - ${summarizeDiff(file)}`);
  }

  if (multiDiff.summary) {
    console.log('\nDetailed statistics:');
    console.log(`  Files changed: ${multiDiff.summary.filesChanged}`);
    console.log(`  Insertions: +${multiDiff.summary.insertions}`);
    console.log(`  Deletions: -${multiDiff.summary.deletions}`);
    console.log(`  Files added: ${multiDiff.summary.filesAdded}`);
    console.log(`  Files deleted: ${multiDiff.summary.filesDeleted}`);
    console.log(`  Files renamed: ${multiDiff.summary.filesRenamed}`);
  }
}

// ============================================================================
// Example 7: Binary File Handling
// ============================================================================

export function example7_binaryFile(): void {
  console.log('\n=== Example 7: Binary File Handling ===\n');

  const binaryDiffString = `Binary files a/image.png and b/image.png differ`;

  const binaryDiff = parseDiff(binaryDiffString);

  console.log('Binary file diff:');
  console.log('File:', binaryDiff.filePath);
  console.log('Is binary?', binaryDiff.metadata?.isBinary);
  console.log('Summary:', summarizeDiff(binaryDiff));
  console.log('\nGenerated diff:');
  console.log(generateUnifiedDiff(binaryDiff));
}

// ============================================================================
// Example 8: Integration with Edit Tool
// ============================================================================

export function example8_editToolIntegration(): void {
  console.log('\n=== Example 8: Edit Tool Integration ===\n');

  // Simulate an edit operation
  const originalFileContent = `class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}`;

  const newFileContent = `class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}`;

  const diff = createSimpleDiff('calculator.ts', originalFileContent, newFileContent);

  console.log('Edit tool would display:');
  console.log('─'.repeat(60));
  console.log(`File: ${diff.filePath}`);
  console.log(`Summary: ${summarizeDiff(diff)}`);
  console.log('─'.repeat(60));
  console.log(generateUnifiedDiff(diff));
  console.log('─'.repeat(60));
}

// ============================================================================
// Example 9: Seven Consciousness Integration
// ============================================================================

export function example9_sevenIntegration(): void {
  console.log('\n=== Example 9: Seven Consciousness Integration ===\n');

  // Simulate a commit with multiple file changes
  const file1 = createSimpleDiff(
    'auth.ts',
    'export function login() { }',
    'export function login(user: User) {\n  return authenticate(user);\n}'
  );

  const file2 = createSimpleDiff(
    'types.ts',
    'export type User = { name: string; };',
    'export type User = {\n  name: string;\n  email: string;\n};'
  );

  const multiDiff: MultiFileDiff = {
    files: [file1, file2],
  };

  // Seven would use this to create a memory
  const commitSummary = summarizeMultiFileDiff(multiDiff);

  console.log('Seven consciousness memory entry:');
  console.log('─'.repeat(60));
  console.log('Commit summary:', commitSummary);
  console.log('\nChanges:');
  for (const file of multiDiff.files) {
    console.log(`  - ${summarizeDiff(file)}`);
  }
  console.log('─'.repeat(60));
  console.log('\nPattern learned: "Added authentication with user types"');
}

// ============================================================================
// Example 10: Error Handling
// ============================================================================

export function example10_errorHandling(): void {
  console.log('\n=== Example 10: Error Handling ===\n');

  // Example: Parsing invalid diff
  try {
    const invalidDiff = 'This is not a valid diff';
    parseDiff(invalidDiff);
  } catch (error) {
    console.log('Parse error caught:', error instanceof Error ? error.message : error);
  }

  // Example: Applying diff with context mismatch
  try {
    const diff = parseDiff(`--- a/test.ts
+++ b/test.ts
@@ -1,2 +1,2 @@
-line 1
+line 1 modified
 line 2`);

    const wrongContent = 'different line 1\nline 2';
    applyDiff(wrongContent, diff);
  } catch (error) {
    console.log('Apply error caught:', error instanceof Error ? error.message : error);
  }

  console.log('\nError handling ensures diff operations are safe and predictable.');
}

// ============================================================================
// Run All Examples
// ============================================================================

export function runAllExamples(): void {
  example1_createFileDiff();
  example2_parseUnifiedDiff();
  example3_applyDiff();
  example4_reverseDiff();
  example5_summarizeDiff();
  example6_multiFileDiff();
  example7_binaryFile();
  example8_editToolIntegration();
  example9_sevenIntegration();
  example10_errorHandling();

  console.log('\n=== All Examples Complete ===');
}

// Uncomment to run all examples:
// runAllExamples();
