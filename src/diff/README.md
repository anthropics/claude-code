# Diff Model

A comprehensive TypeScript diff model for representing and manipulating code changes in Claude Code.

## Overview

The diff model provides:
- **Strong typing**: All types are strictly typed (no `any`)
- **Immutability**: All data structures use `readonly` properties
- **Unified diff support**: Parse and generate standard unified diff format
- **Helper functions**: Common operations like apply, reverse, and summarize
- **Edge case handling**: Binary files, empty files, large diffs

## Quick Start

```typescript
import {
  parseDiff,
  generateUnifiedDiff,
  applyDiff,
  reverseDiff,
  summarizeDiff,
  createSimpleDiff,
} from './diff-model';

// Parse a unified diff
const diff = parseDiff(unifiedDiffString);

// Apply to original content
const newContent = applyDiff(originalContent, diff);

// Generate summary
const summary = summarizeDiff(diff);
console.log(summary); // "+5 lines, -3 lines in example.ts"
```

## Core Types

### DiffOperation
```typescript
type DiffOperation = 'add' | 'delete' | 'modify' | 'context';
```
Represents the type of change to a line.

### DiffLine
```typescript
interface DiffLine {
  readonly operation: DiffOperation;
  readonly content: string;
  readonly oldLineNum?: number;  // undefined for additions
  readonly newLineNum?: number;  // undefined for deletions
}
```
Represents a single line in a diff.

### DiffHunk
```typescript
interface DiffHunk {
  readonly oldStart: number;     // Starting line in original
  readonly oldCount: number;     // Lines from original
  readonly newStart: number;     // Starting line in new
  readonly newCount: number;     // Lines in new
  readonly lines: readonly DiffLine[];
  readonly header?: string;      // Optional context (e.g., function name)
}
```
Represents a contiguous block of changes.

### FileDiff
```typescript
interface FileDiff {
  readonly filePath: string;
  readonly oldFilePath?: string;      // For renames
  readonly changeType: FileChangeType;
  readonly hunks: readonly DiffHunk[];
  readonly metadata?: DiffMetadata;
}
```
Represents all changes to a single file.

### MultiFileDiff
```typescript
interface MultiFileDiff {
  readonly files: readonly FileDiff[];
  readonly summary?: DiffSummary;
}
```
Represents changes across multiple files.

## Helper Functions

### Parsing

#### `parseDiff(unifiedDiffString: string): FileDiff`
Parse a unified diff string into a structured FileDiff object.

```typescript
const diff = parseDiff(`
--- a/example.ts
+++ b/example.ts
@@ -1,3 +1,3 @@
 line 1
-line 2
+line 2 modified
 line 3
`);
```

#### `parseMultiFileDiff(unifiedDiffString: string): MultiFileDiff`
Parse a multi-file diff string.

### Generation

#### `generateUnifiedDiff(fileDiff: FileDiff): string`
Convert a FileDiff to unified diff format.

```typescript
const diffString = generateUnifiedDiff(fileDiff);
```

#### `generateMultiFileDiff(multiFileDiff: MultiFileDiff): string`
Convert a MultiFileDiff to unified diff format.

### Application

#### `applyDiff(originalContent: string, fileDiff: FileDiff): string`
Apply a diff to original content to produce new content.

```typescript
const newContent = applyDiff(originalContent, diff);
```

**Throws**: `DiffApplyError` if context doesn't match.

### Reversal

#### `reverseDiff(fileDiff: FileDiff): FileDiff`
Reverse a diff (swap add/delete operations).

```typescript
const reversedDiff = reverseDiff(originalDiff);
const restored = applyDiff(newContent, reversedDiff);
// restored === originalContent
```

### Summarization

#### `summarizeDiff(fileDiff: FileDiff): string`
Generate human-readable summary of a single file diff.

```typescript
const summary = summarizeDiff(diff);
// "+5, -3 in example.ts"
// "New file: +42 lines"
// "Binary file: image.png"
```

#### `summarizeMultiFileDiff(multiFileDiff: MultiFileDiff): string`
Generate human-readable summary of multiple file diffs.

```typescript
const summary = summarizeMultiFileDiff(multiDiff);
// "3 files changed, +42 insertions, -17 deletions (1 added, 1 deleted)"
```

#### `calculateSummary(files: readonly FileDiff[]): DiffSummary`
Calculate aggregate statistics for multiple files.

### Utilities

#### `createSimpleDiff(filePath: string, oldContent: string, newContent: string): FileDiff`
Create a FileDiff from old and new content.

```typescript
const diff = createSimpleDiff(
  'example.ts',
  'old content',
  'new content'
);
```

#### `truncateDiff(fileDiff: FileDiff, maxHunks: number): FileDiff`
Truncate a diff to a maximum number of hunks (for previews).

#### `isBinaryDiff(fileDiff: FileDiff): boolean`
Check if a diff represents a binary file.

#### `isEmptyDiff(fileDiff: FileDiff): boolean`
Check if a diff has no actual changes.

## Error Handling

### DiffParseError
Thrown when parsing a diff string fails.

```typescript
try {
  const diff = parseDiff(invalidString);
} catch (error) {
  if (error instanceof DiffParseError) {
    console.error(`Parse error at line ${error.line}: ${error.message}`);
  }
}
```

### DiffApplyError
Thrown when applying a diff fails (e.g., context mismatch).

```typescript
try {
  const result = applyDiff(content, diff);
} catch (error) {
  if (error instanceof DiffApplyError) {
    console.error(`Apply error at hunk ${error.hunkIndex}: ${error.message}`);
  }
}
```

## Integration Examples

### Edit Tool Integration
```typescript
// When showing file changes in Edit tool
const diff = createSimpleDiff(filePath, oldContent, newContent);

console.log(`File: ${diff.filePath}`);
console.log(`Summary: ${summarizeDiff(diff)}`);
console.log(generateUnifiedDiff(diff));
```

### Seven Consciousness Integration
```typescript
// When committing changes to Seven's memory
const multiDiff: MultiFileDiff = {
  files: [diff1, diff2, diff3],
};

const summary = summarizeMultiFileDiff(multiDiff);
// Store in memory: "3 files changed, +42 insertions, -17 deletions"
```

### Code Review Integration
```typescript
// Analyzing PR changes
const prDiff = parseMultiFileDiff(gitDiffOutput);

for (const file of prDiff.files) {
  if (isBinaryDiff(file)) {
    console.log(`Binary file changed: ${file.filePath}`);
    continue;
  }

  console.log(summarizeDiff(file));

  // Analyze each hunk for code review
  for (const hunk of file.hunks) {
    analyzeHunkForIssues(hunk);
  }
}
```

## Edge Cases

### Empty Files
```typescript
// New file creation
const newFile = createSimpleDiff('new.ts', '', 'content');
// changeType: 'add'

// File deletion
const deletedFile = createSimpleDiff('old.ts', 'content', '');
// changeType: 'delete'
```

### Binary Files
```typescript
const binaryDiff = parseDiff('Binary files a/image.png and b/image.png differ');
console.log(isBinaryDiff(binaryDiff)); // true
console.log(summarizeDiff(binaryDiff)); // "Binary file: image.png"
```

### Large Diffs
```typescript
// Truncate for preview
const preview = truncateDiff(largeDiff, 5); // Keep first 5 hunks

// Check if diff is too large
if (diff.hunks.length > 100) {
  console.warn('Very large diff detected');
}
```

### File Renames
```typescript
const renamedFile: FileDiff = {
  filePath: 'new-name.ts',
  oldFilePath: 'old-name.ts',
  changeType: 'rename',
  hunks: [],
};
```

## Design Principles

1. **Immutability**: All properties are `readonly`. Functions return new objects rather than mutating existing ones.

2. **Strong Typing**: No use of `any` type. All types are explicitly defined.

3. **Clear Naming**: Operation names are self-explanatory (`add`, `delete`, `context`).

4. **Comprehensive Documentation**: All types and functions have JSDoc comments.

5. **Error Safety**: Proper error types with context (line numbers, hunk indices).

## Testing

See `examples.ts` for comprehensive usage examples and `test-cases.ts` for unit test examples.

Run examples:
```typescript
import { runAllExamples } from './examples';
runAllExamples();
```

## Future Enhancements

Potential additions (not yet implemented):
- Merge conflict detection and resolution
- Three-way merge support
- Syntax-aware diffing (semantic diff)
- Performance optimization for very large files
- Streaming diff parser for memory efficiency
- Integration with git for commit history analysis
