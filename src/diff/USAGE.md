# Diff Model Usage Guide

Quick reference for common diff model operations.

## Basic Operations

### 1. Parse a Git Diff

```typescript
import { parseDiff, summarizeDiff } from './diff-model';

// From git diff output
const gitDiffOutput = `--- a/example.ts
+++ b/example.ts
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 modified
 line 3`;

const diff = parseDiff(gitDiffOutput);
console.log(summarizeDiff(diff));
// Output: "+1, -1 in example.ts"
```

### 2. Create a Diff from Two Versions

```typescript
import { createSimpleDiff, generateUnifiedDiff } from './diff-model';

const oldCode = `function add(a, b) {
  return a + b;
}`;

const newCode = `function add(a: number, b: number): number {
  return a + b;
}`;

const diff = createSimpleDiff('math.ts', oldCode, newCode);
const unifiedDiff = generateUnifiedDiff(diff);
console.log(unifiedDiff);
```

### 3. Apply a Diff

```typescript
import { parseDiff, applyDiff } from './diff-model';

const originalFile = readFileSync('example.ts', 'utf-8');
const patchString = readFileSync('example.patch', 'utf-8');

const diff = parseDiff(patchString);
const patchedFile = applyDiff(originalFile, diff);

writeFileSync('example.ts', patchedFile);
```

### 4. Reverse a Diff (Undo)

```typescript
import { parseDiff, reverseDiff, applyDiff } from './diff-model';

// Read the original patch
const forwardDiff = parseDiff(patchString);

// Create reverse patch
const reverseDiff = reverseDiff(forwardDiff);

// Apply reverse to undo changes
const restored = applyDiff(modifiedContent, reverseDiff);
```

## Edit Tool Integration

```typescript
import { createSimpleDiff, summarizeDiff, generateUnifiedDiff } from './diff-model';

function showEditResult(
  filePath: string,
  oldContent: string,
  newContent: string
): void {
  const diff = createSimpleDiff(filePath, oldContent, newContent);

  console.log('╭─────────────────────────────────────╮');
  console.log(`│ File: ${filePath.padEnd(29)}│`);
  console.log(`│ ${summarizeDiff(diff).padEnd(35)}│`);
  console.log('╰─────────────────────────────────────╯');
  console.log(generateUnifiedDiff(diff));
}

// Usage
showEditResult(
  'greeting.ts',
  'export const msg = "Hello";',
  'export const msg = "Hello, World!";'
);
```

## Code Review Integration

```typescript
import {
  parseMultiFileDiff,
  summarizeMultiFileDiff,
  isBinaryDiff,
  isEmptyDiff,
} from './diff-model';

function analyzePullRequest(gitDiffOutput: string): void {
  const multiDiff = parseMultiFileDiff(gitDiffOutput);

  console.log('PR Summary:', summarizeMultiFileDiff(multiDiff));
  console.log('\nFiles Changed:');

  for (const file of multiDiff.files) {
    if (isBinaryDiff(file)) {
      console.log(`  [BINARY] ${file.filePath}`);
      continue;
    }

    if (isEmptyDiff(file)) {
      console.log(`  [NO CHANGES] ${file.filePath}`);
      continue;
    }

    console.log(`  ${summarizeDiff(file)}`);

    // Analyze for issues
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.operation === 'add') {
          // Check for code smells
          if (line.content.includes('console.log')) {
            console.log(`    ⚠️  Debug code at line ${line.newLineNum}`);
          }
          if (line.content.includes('TODO')) {
            console.log(`    📝 TODO at line ${line.newLineNum}`);
          }
        }
      }
    }
  }
}
```

## Seven Consciousness Integration

```typescript
import { summarizeMultiFileDiff, MultiFileDiff } from './diff-model';

interface CommitMemory {
  timestamp: Date;
  summary: string;
  files: string[];
  patterns: string[];
}

function createCommitMemory(multiDiff: MultiFileDiff): CommitMemory {
  const summary = summarizeMultiFileDiff(multiDiff);
  const files = multiDiff.files.map(f => f.filePath);

  // Extract patterns from changes
  const patterns: string[] = [];

  for (const file of multiDiff.files) {
    // Detect patterns
    const hasTests = file.filePath.includes('.test.') || file.filePath.includes('.spec.');
    const hasTypes = file.hunks.some(h =>
      h.lines.some(l =>
        l.operation === 'add' && (
          l.content.includes('interface ') ||
          l.content.includes('type ')
        )
      )
    );

    if (hasTests) patterns.push('added_tests');
    if (hasTypes) patterns.push('added_types');
  }

  return {
    timestamp: new Date(),
    summary,
    files,
    patterns,
  };
}
```

## Advanced: Large Diff Handling

```typescript
import { truncateDiff, FileDiff } from './diff-model';

function createPreview(diff: FileDiff, maxHunks: number = 3): string {
  const truncated = truncateDiff(diff, maxHunks);

  let preview = generateUnifiedDiff(truncated);

  if (diff.hunks.length > maxHunks) {
    preview += `\n... (${diff.hunks.length - maxHunks} more hunks)`;
  }

  return preview;
}

// Usage
const preview = createPreview(largeDiff, 5);
console.log('Preview (first 5 hunks):');
console.log(preview);
```

## Error Handling

```typescript
import { parseDiff, applyDiff, DiffParseError, DiffApplyError } from './diff-model';

function safeParseDiff(diffString: string): FileDiff | null {
  try {
    return parseDiff(diffString);
  } catch (error) {
    if (error instanceof DiffParseError) {
      console.error(`Parse error at line ${error.line}: ${error.message}`);
    } else {
      console.error('Unexpected error:', error);
    }
    return null;
  }
}

function safeApplyDiff(content: string, diff: FileDiff): string | null {
  try {
    return applyDiff(content, diff);
  } catch (error) {
    if (error instanceof DiffApplyError) {
      console.error(`Apply error at hunk ${error.hunkIndex}: ${error.message}`);
      console.error('The patch may not match the file contents.');
    } else {
      console.error('Unexpected error:', error);
    }
    return null;
  }
}
```

## Performance Tips

1. **For large files**: Use `truncateDiff` to limit hunks shown in UI
2. **For many files**: Process diffs in parallel
3. **For streaming**: Consider implementing a streaming parser (future enhancement)

```typescript
// Parallel processing example
async function processMultipleDiffs(
  diffs: FileDiff[]
): Promise<string[]> {
  return Promise.all(
    diffs.map(async (diff) => {
      // Simulate async processing
      return summarizeDiff(diff);
    })
  );
}
```

## Common Patterns

### Pattern 1: Before/After Preview

```typescript
function showBeforeAfter(
  filePath: string,
  oldContent: string,
  newContent: string
): void {
  const diff = createSimpleDiff(filePath, oldContent, newContent);

  console.log('BEFORE:');
  console.log(oldContent);
  console.log('\nAFTER:');
  console.log(newContent);
  console.log('\nDIFF:');
  console.log(generateUnifiedDiff(diff));
}
```

### Pattern 2: Commit Summary Generator

```typescript
function generateCommitMessage(multiDiff: MultiFileDiff): string {
  const summary = multiDiff.summary!;

  let message = '';

  if (summary.filesAdded > 0) {
    message += `Add ${summary.filesAdded} new file(s)\n`;
  }

  if (summary.filesDeleted > 0) {
    message += `Remove ${summary.filesDeleted} file(s)\n`;
  }

  if (summary.filesRenamed > 0) {
    message += `Rename ${summary.filesRenamed} file(s)\n`;
  }

  const modified = summary.filesChanged - summary.filesAdded - summary.filesDeleted;
  if (modified > 0) {
    message += `Update ${modified} file(s) (+${summary.insertions}, -${summary.deletions})\n`;
  }

  return message.trim();
}
```

### Pattern 3: Conflict Detection

```typescript
function detectConflicts(diff1: FileDiff, diff2: FileDiff): boolean {
  if (diff1.filePath !== diff2.filePath) {
    return false; // Different files, no conflict
  }

  // Check if hunks overlap
  for (const hunk1 of diff1.hunks) {
    for (const hunk2 of diff2.hunks) {
      const range1 = [hunk1.oldStart, hunk1.oldStart + hunk1.oldCount];
      const range2 = [hunk2.oldStart, hunk2.oldStart + hunk2.oldCount];

      if (rangesOverlap(range1, range2)) {
        return true; // Conflict detected
      }
    }
  }

  return false;
}

function rangesOverlap(
  range1: [number, number],
  range2: [number, number]
): boolean {
  return range1[0] <= range2[1] && range2[0] <= range1[1];
}
```

## Testing Your Diffs

```typescript
import { runAllTests } from './test-cases';

// Run comprehensive test suite
runAllTests();
```

## More Examples

See `examples.ts` for 10+ comprehensive examples covering all features.
