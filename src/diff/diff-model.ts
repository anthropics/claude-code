/**
 * Diff Model for Claude Code
 *
 * A comprehensive, strongly-typed TypeScript model for representing code changes.
 * Supports unified diff format parsing/generation, diff application, reversal, and summarization.
 *
 * Design principles:
 * - Immutable data structures (readonly properties)
 * - Strong TypeScript typing (no any)
 * - Clear naming conventions
 * - Comprehensive edge case handling
 *
 * @module diff-model
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Type of operation performed on a line.
 *
 * - `add`: Line was inserted (new content)
 * - `delete`: Line was removed (old content)
 * - `modify`: Line was changed (represented as delete + add pair)
 * - `context`: Unchanged line shown for readability
 */
export type DiffOperation = 'add' | 'delete' | 'modify' | 'context';

/**
 * Type of change made to a file.
 *
 * - `add`: New file created
 * - `delete`: File removed
 * - `modify`: File content changed
 * - `rename`: File renamed (preserves content, path changed)
 */
export type FileChangeType = 'add' | 'delete' | 'modify' | 'rename';

/**
 * Represents a single line in a diff.
 *
 * @property operation - The type of change (add, delete, modify, context)
 * @property content - The actual line content (without +/- prefix)
 * @property oldLineNum - Line number in the original file (undefined for additions)
 * @property newLineNum - Line number in the new file (undefined for deletions)
 */
export interface DiffLine {
  readonly operation: DiffOperation;
  readonly content: string;
  readonly oldLineNum?: number;
  readonly newLineNum?: number;
}

/**
 * Represents a contiguous block of changes (hunk) in a file.
 *
 * In unified diff format, hunks are marked with:
 * @@ -oldStart,oldCount +newStart,newCount @@
 *
 * @property oldStart - Starting line number in the original file
 * @property oldCount - Number of lines from original file in this hunk
 * @property newStart - Starting line number in the new file
 * @property newCount - Number of lines from new file in this hunk
 * @property lines - Array of line changes in this hunk
 * @property header - Optional context header (e.g., function name)
 */
export interface DiffHunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly lines: readonly DiffLine[];
  readonly header?: string;
}

/**
 * Metadata associated with a file diff.
 *
 * @property author - Person who made the change
 * @property timestamp - When the change was made
 * @property message - Commit message or description
 * @property isBinary - Whether the file is binary (cannot show line-level changes)
 * @property oldMode - File permissions in original (e.g., "100644")
 * @property newMode - File permissions in new version
 */
export interface DiffMetadata {
  readonly author?: string;
  readonly timestamp?: Date;
  readonly message?: string;
  readonly isBinary?: boolean;
  readonly oldMode?: string;
  readonly newMode?: string;
}

/**
 * Represents changes to a single file.
 *
 * @property filePath - Path to the file (relative or absolute)
 * @property oldFilePath - Original path (for renames)
 * @property changeType - Type of file change (add, delete, modify, rename)
 * @property hunks - Array of change hunks in the file
 * @property metadata - Additional information about the change
 */
export interface FileDiff {
  readonly filePath: string;
  readonly oldFilePath?: string;
  readonly changeType: FileChangeType;
  readonly hunks: readonly DiffHunk[];
  readonly metadata?: DiffMetadata;
}

/**
 * Summary statistics for multiple file changes.
 *
 * @property filesChanged - Total number of files modified
 * @property insertions - Total lines added across all files
 * @property deletions - Total lines removed across all files
 * @property filesAdded - Number of new files created
 * @property filesDeleted - Number of files removed
 * @property filesRenamed - Number of files renamed
 */
export interface DiffSummary {
  readonly filesChanged: number;
  readonly insertions: number;
  readonly deletions: number;
  readonly filesAdded: number;
  readonly filesDeleted: number;
  readonly filesRenamed: number;
}

/**
 * Represents changes across multiple files.
 *
 * @property files - Array of file changes
 * @property summary - Aggregate statistics (optional, calculated if not provided)
 */
export interface MultiFileDiff {
  readonly files: readonly FileDiff[];
  readonly summary?: DiffSummary;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when diff parsing fails.
 */
export class DiffParseError extends Error {
  constructor(message: string, public readonly line?: number) {
    super(message);
    this.name = 'DiffParseError';
  }
}

/**
 * Error thrown when diff application fails.
 */
export class DiffApplyError extends Error {
  constructor(message: string, public readonly hunkIndex?: number) {
    super(message);
    this.name = 'DiffApplyError';
  }
}

// ============================================================================
// Helper Functions: Parsing
// ============================================================================

/**
 * Parse a unified diff string into a structured FileDiff object.
 *
 * Supports standard unified diff format (git diff output):
 * ```
 * --- a/file.ts
 * +++ b/file.ts
 * @@ -10,5 +10,6 @@ function example() {
 *    const x = 1;
 * -  const y = 2;
 * +  const y = 3;
 * +  const z = 4;
 *    return x + y;
 *  }
 * ```
 *
 * @param unifiedDiffString - The unified diff text to parse
 * @returns Parsed FileDiff object
 * @throws DiffParseError if the diff format is invalid
 *
 * @example
 * ```typescript
 * const diff = parseDiff(`
 * --- a/example.ts
 * +++ b/example.ts
 * @@ -1,3 +1,3 @@
 *  line 1
 * -line 2
 * +line 2 modified
 *  line 3
 * `);
 * ```
 */
export function parseDiff(unifiedDiffString: string): FileDiff {
  const lines = unifiedDiffString.split('\n');
  let lineIndex = 0;

  // Parse file headers
  let oldFilePath: string | undefined;
  let newFilePath: string | undefined;
  let changeType: FileChangeType = 'modify';
  let isBinary = false;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (line.startsWith('--- ')) {
      oldFilePath = line.slice(4).replace(/^a\//, '');
      lineIndex++;
    } else if (line.startsWith('+++ ')) {
      newFilePath = line.slice(4).replace(/^b\//, '');
      lineIndex++;
      break;
    } else if (line.includes('Binary files')) {
      isBinary = true;
      // Extract file paths from "Binary files a/path and b/path differ"
      const match = line.match(/Binary files (.+?) and (.+?) differ/);
      if (match) {
        oldFilePath = match[1].replace(/^a\//, '');
        newFilePath = match[2].replace(/^b\//, '');
      }
      lineIndex++;
      break;
    } else {
      lineIndex++;
    }
  }

  if (!newFilePath) {
    throw new DiffParseError('Could not find file path in diff header');
  }

  // Determine change type
  if (oldFilePath === '/dev/null') {
    changeType = 'add';
    oldFilePath = undefined;
  } else if (newFilePath === '/dev/null') {
    changeType = 'delete';
  } else if (oldFilePath && oldFilePath !== newFilePath) {
    changeType = 'rename';
  }

  // Parse hunks (skip for binary files)
  const hunks: DiffHunk[] = [];

  if (!isBinary) {
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];

      if (line.startsWith('@@')) {
        const hunk = parseHunk(lines, lineIndex);
        hunks.push(hunk.hunk);
        lineIndex = hunk.nextLineIndex;
      } else {
        lineIndex++;
      }
    }
  }

  return {
    filePath: newFilePath,
    oldFilePath: oldFilePath !== newFilePath ? oldFilePath : undefined,
    changeType,
    hunks,
    metadata: isBinary ? { isBinary: true } : undefined,
  };
}

/**
 * Parse a single hunk from diff lines.
 * Internal helper for parseDiff.
 */
function parseHunk(
  lines: string[],
  startIndex: number
): { hunk: DiffHunk; nextLineIndex: number } {
  const headerLine = lines[startIndex];

  // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@ optional context
  const headerMatch = headerLine.match(
    /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/
  );

  if (!headerMatch) {
    throw new DiffParseError(`Invalid hunk header: ${headerLine}`, startIndex);
  }

  const oldStart = parseInt(headerMatch[1], 10);
  const oldCount = headerMatch[2] ? parseInt(headerMatch[2], 10) : 1;
  const newStart = parseInt(headerMatch[3], 10);
  const newCount = headerMatch[4] ? parseInt(headerMatch[4], 10) : 1;
  const header = headerMatch[5]?.trim() || undefined;

  const hunkLines: DiffLine[] = [];
  let lineIndex = startIndex + 1;
  let oldLineNum = oldStart;
  let newLineNum = newStart;

  // Parse lines until we hit the next hunk or end of diff
  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    if (line.startsWith('@@')) {
      break; // Next hunk
    }

    if (line.startsWith('+')) {
      hunkLines.push({
        operation: 'add',
        content: line.slice(1),
        newLineNum: newLineNum++,
      });
    } else if (line.startsWith('-')) {
      hunkLines.push({
        operation: 'delete',
        content: line.slice(1),
        oldLineNum: oldLineNum++,
      });
    } else if (line.startsWith(' ')) {
      hunkLines.push({
        operation: 'context',
        content: line.slice(1),
        oldLineNum: oldLineNum++,
        newLineNum: newLineNum++,
      });
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file" - skip
      lineIndex++;
      continue;
    } else if (line.trim() === '') {
      // Empty line could be context
      hunkLines.push({
        operation: 'context',
        content: '',
        oldLineNum: oldLineNum++,
        newLineNum: newLineNum++,
      });
    } else {
      break; // End of hunk
    }

    lineIndex++;
  }

  return {
    hunk: {
      oldStart,
      oldCount,
      newStart,
      newCount,
      lines: hunkLines,
      header,
    },
    nextLineIndex: lineIndex,
  };
}

/**
 * Parse a multi-file unified diff string.
 *
 * Handles diffs containing multiple files (e.g., from `git diff` with multiple files).
 *
 * @param unifiedDiffString - The unified diff text containing multiple files
 * @returns MultiFileDiff object with all parsed files
 *
 * @example
 * ```typescript
 * const multiDiff = parseMultiFileDiff(gitDiffOutput);
 * console.log(`Changed ${multiDiff.files.length} files`);
 * ```
 */
export function parseMultiFileDiff(unifiedDiffString: string): MultiFileDiff {
  const files: FileDiff[] = [];
  const sections = splitDiffIntoFiles(unifiedDiffString);

  for (const section of sections) {
    try {
      files.push(parseDiff(section));
    } catch (error) {
      // Skip unparseable sections but continue processing others
      console.warn('Failed to parse diff section:', error);
    }
  }

  return {
    files,
    summary: calculateSummary(files),
  };
}

/**
 * Split a multi-file diff into individual file sections.
 * Internal helper for parseMultiFileDiff.
 */
function splitDiffIntoFiles(diffString: string): string[] {
  const sections: string[] = [];
  const lines = diffString.split('\n');
  let currentSection: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // New file section starts with "diff --git" or "--- "
    if ((line.startsWith('diff --git') || line.startsWith('--- ')) && currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
      currentSection = [];
    }

    currentSection.push(line);
  }

  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }

  return sections;
}

// ============================================================================
// Helper Functions: Generation
// ============================================================================

/**
 * Generate a unified diff string from a FileDiff object.
 *
 * Produces standard unified diff format compatible with patch tools.
 *
 * @param fileDiff - The structured diff to convert
 * @returns Unified diff string
 *
 * @example
 * ```typescript
 * const diffString = generateUnifiedDiff(fileDiff);
 * console.log(diffString);
 * // Output:
 * // --- a/example.ts
 * // +++ b/example.ts
 * // @@ -1,3 +1,3 @@
 * //  line 1
 * // -line 2
 * // +line 2 modified
 * //  line 3
 * ```
 */
export function generateUnifiedDiff(fileDiff: FileDiff): string {
  const lines: string[] = [];

  // File headers
  const oldPath = fileDiff.oldFilePath || fileDiff.filePath;
  const newPath = fileDiff.filePath;

  if (fileDiff.changeType === 'add') {
    lines.push(`--- /dev/null`);
    lines.push(`+++ b/${newPath}`);
  } else if (fileDiff.changeType === 'delete') {
    lines.push(`--- a/${oldPath}`);
    lines.push(`+++ /dev/null`);
  } else {
    lines.push(`--- a/${oldPath}`);
    lines.push(`+++ b/${newPath}`);
  }

  // Binary file marker
  if (fileDiff.metadata?.isBinary) {
    lines.push(`Binary files a/${oldPath} and b/${newPath} differ`);
    return lines.join('\n');
  }

  // Hunks
  for (const hunk of fileDiff.hunks) {
    const header = hunk.header ? ` ${hunk.header}` : '';
    lines.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@${header}`
    );

    for (const line of hunk.lines) {
      const prefix = getLinePrefix(line.operation);
      lines.push(`${prefix}${line.content}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get the prefix character for a line based on its operation.
 * Internal helper for generateUnifiedDiff.
 */
function getLinePrefix(operation: DiffOperation): string {
  switch (operation) {
    case 'add':
      return '+';
    case 'delete':
      return '-';
    case 'context':
    case 'modify':
      return ' ';
  }
}

/**
 * Generate a unified diff string from a MultiFileDiff object.
 *
 * @param multiFileDiff - The multi-file diff to convert
 * @returns Unified diff string containing all files
 *
 * @example
 * ```typescript
 * const diffString = generateMultiFileDiff(multiFileDiff);
 * ```
 */
export function generateMultiFileDiff(multiFileDiff: MultiFileDiff): string {
  return multiFileDiff.files.map(generateUnifiedDiff).join('\n\n');
}

// ============================================================================
// Helper Functions: Application
// ============================================================================

/**
 * Apply a diff to original content to produce new content.
 *
 * Takes the original file content and applies the changes specified in the diff,
 * producing the new file content.
 *
 * @param originalContent - The original file content (as string)
 * @param fileDiff - The diff to apply
 * @returns The new file content after applying the diff
 * @throws DiffApplyError if the diff cannot be applied (e.g., context mismatch)
 *
 * @example
 * ```typescript
 * const original = "line 1\nline 2\nline 3";
 * const newContent = applyDiff(original, fileDiff);
 * console.log(newContent); // "line 1\nline 2 modified\nline 3"
 * ```
 */
export function applyDiff(originalContent: string, fileDiff: FileDiff): string {
  if (fileDiff.changeType === 'add') {
    return reconstructFromHunks(fileDiff.hunks, 'new');
  }

  if (fileDiff.changeType === 'delete') {
    return '';
  }

  const originalLines = originalContent.split('\n');
  const newLines: string[] = [];
  let originalIndex = 0;

  for (let hunkIndex = 0; hunkIndex < fileDiff.hunks.length; hunkIndex++) {
    const hunk = fileDiff.hunks[hunkIndex];

    // Copy lines before this hunk
    while (originalIndex < hunk.oldStart - 1) {
      newLines.push(originalLines[originalIndex]);
      originalIndex++;
    }

    // Apply hunk
    for (const line of hunk.lines) {
      if (line.operation === 'add') {
        newLines.push(line.content);
      } else if (line.operation === 'delete') {
        // Verify the line matches
        const expectedLine = originalLines[originalIndex];
        if (expectedLine !== line.content) {
          throw new DiffApplyError(
            `Line mismatch at line ${originalIndex + 1}: expected "${line.content}", got "${expectedLine}"`,
            hunkIndex
          );
        }
        originalIndex++;
      } else if (line.operation === 'context') {
        // Verify context line matches
        const expectedLine = originalLines[originalIndex];
        if (expectedLine !== line.content) {
          throw new DiffApplyError(
            `Context mismatch at line ${originalIndex + 1}: expected "${line.content}", got "${expectedLine}"`,
            hunkIndex
          );
        }
        newLines.push(line.content);
        originalIndex++;
      }
    }
  }

  // Copy remaining lines after last hunk
  while (originalIndex < originalLines.length) {
    newLines.push(originalLines[originalIndex]);
    originalIndex++;
  }

  return newLines.join('\n');
}

/**
 * Reconstruct file content from hunks (for new files or deletions).
 * Internal helper for applyDiff.
 */
function reconstructFromHunks(
  hunks: readonly DiffHunk[],
  mode: 'old' | 'new'
): string {
  const lines: string[] = [];

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (mode === 'new' && (line.operation === 'add' || line.operation === 'context')) {
        lines.push(line.content);
      } else if (mode === 'old' && (line.operation === 'delete' || line.operation === 'context')) {
        lines.push(line.content);
      }
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Helper Functions: Reversal
// ============================================================================

/**
 * Reverse a diff (swap add/delete operations).
 *
 * Useful for undoing changes or creating inverse patches.
 *
 * @param fileDiff - The diff to reverse
 * @returns A new FileDiff with operations reversed
 *
 * @example
 * ```typescript
 * const originalDiff = parseDiff(diffString);
 * const reversedDiff = reverseDiff(originalDiff);
 *
 * // Applying reversed diff to new content should give original content
 * const newContent = applyDiff(original, originalDiff);
 * const restoredOriginal = applyDiff(newContent, reversedDiff);
 * ```
 */
export function reverseDiff(fileDiff: FileDiff): FileDiff {
  // Reverse change type
  let changeType: FileChangeType = fileDiff.changeType;
  if (fileDiff.changeType === 'add') {
    changeType = 'delete';
  } else if (fileDiff.changeType === 'delete') {
    changeType = 'add';
  }

  // Swap file paths
  const newFilePath = fileDiff.oldFilePath || fileDiff.filePath;
  const oldFilePath = fileDiff.changeType === 'rename' ? fileDiff.filePath : undefined;

  // Reverse hunks
  const reversedHunks: DiffHunk[] = fileDiff.hunks.map((hunk) => ({
    oldStart: hunk.newStart,
    oldCount: hunk.newCount,
    newStart: hunk.oldStart,
    newCount: hunk.oldCount,
    lines: hunk.lines.map(reverseLine),
    header: hunk.header,
  }));

  return {
    filePath: newFilePath,
    oldFilePath,
    changeType,
    hunks: reversedHunks,
    metadata: fileDiff.metadata,
  };
}

/**
 * Reverse a single diff line.
 * Internal helper for reverseDiff.
 */
function reverseLine(line: DiffLine): DiffLine {
  let operation: DiffOperation = line.operation;

  if (line.operation === 'add') {
    operation = 'delete';
  } else if (line.operation === 'delete') {
    operation = 'add';
  }

  return {
    operation,
    content: line.content,
    oldLineNum: line.newLineNum,
    newLineNum: line.oldLineNum,
  };
}

// ============================================================================
// Helper Functions: Summarization
// ============================================================================

/**
 * Generate a human-readable summary of a FileDiff.
 *
 * Produces a concise description like "+5 lines, -3 lines" or "New file: +42 lines".
 *
 * @param fileDiff - The diff to summarize
 * @returns Human-readable summary string
 *
 * @example
 * ```typescript
 * const summary = summarizeDiff(fileDiff);
 * console.log(summary); // "+5 lines, -3 lines in example.ts"
 * ```
 */
export function summarizeDiff(fileDiff: FileDiff): string {
  if (fileDiff.metadata?.isBinary) {
    return `Binary file: ${fileDiff.filePath}`;
  }

  let additions = 0;
  let deletions = 0;

  for (const hunk of fileDiff.hunks) {
    for (const line of hunk.lines) {
      if (line.operation === 'add') {
        additions++;
      } else if (line.operation === 'delete') {
        deletions++;
      }
    }
  }

  const parts: string[] = [];

  if (fileDiff.changeType === 'add') {
    parts.push(`New file: +${additions} lines`);
  } else if (fileDiff.changeType === 'delete') {
    parts.push(`Deleted file: -${deletions} lines`);
  } else if (fileDiff.changeType === 'rename') {
    parts.push(`Renamed: ${fileDiff.oldFilePath} → ${fileDiff.filePath}`);
    if (additions > 0 || deletions > 0) {
      parts.push(`(+${additions}, -${deletions})`);
    }
  } else {
    if (additions > 0) {
      parts.push(`+${additions}`);
    }
    if (deletions > 0) {
      parts.push(`-${deletions}`);
    }
    if (additions === 0 && deletions === 0) {
      parts.push('No changes');
    }
  }

  return `${parts.join(', ')} in ${fileDiff.filePath}`;
}

/**
 * Calculate summary statistics for multiple file diffs.
 *
 * @param files - Array of FileDiff objects
 * @returns DiffSummary with aggregate statistics
 *
 * @example
 * ```typescript
 * const summary = calculateSummary(fileDiffs);
 * console.log(`${summary.filesChanged} files changed, +${summary.insertions}, -${summary.deletions}`);
 * ```
 */
export function calculateSummary(files: readonly FileDiff[]): DiffSummary {
  let insertions = 0;
  let deletions = 0;
  let filesAdded = 0;
  let filesDeleted = 0;
  let filesRenamed = 0;

  for (const file of files) {
    if (file.changeType === 'add') {
      filesAdded++;
    } else if (file.changeType === 'delete') {
      filesDeleted++;
    } else if (file.changeType === 'rename') {
      filesRenamed++;
    }

    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.operation === 'add') {
          insertions++;
        } else if (line.operation === 'delete') {
          deletions++;
        }
      }
    }
  }

  return {
    filesChanged: files.length,
    insertions,
    deletions,
    filesAdded,
    filesDeleted,
    filesRenamed,
  };
}

/**
 * Generate a human-readable summary of a MultiFileDiff.
 *
 * @param multiFileDiff - The multi-file diff to summarize
 * @returns Human-readable summary string
 *
 * @example
 * ```typescript
 * const summary = summarizeMultiFileDiff(multiFileDiff);
 * console.log(summary); // "3 files changed, +42 insertions, -17 deletions"
 * ```
 */
export function summarizeMultiFileDiff(multiFileDiff: MultiFileDiff): string {
  const summary = multiFileDiff.summary || calculateSummary(multiFileDiff.files);

  const parts: string[] = [];

  parts.push(`${summary.filesChanged} ${summary.filesChanged === 1 ? 'file' : 'files'} changed`);

  if (summary.insertions > 0) {
    parts.push(`+${summary.insertions} ${summary.insertions === 1 ? 'insertion' : 'insertions'}`);
  }

  if (summary.deletions > 0) {
    parts.push(`-${summary.deletions} ${summary.deletions === 1 ? 'deletion' : 'deletions'}`);
  }

  const fileTypeChanges: string[] = [];
  if (summary.filesAdded > 0) {
    fileTypeChanges.push(`${summary.filesAdded} added`);
  }
  if (summary.filesDeleted > 0) {
    fileTypeChanges.push(`${summary.filesDeleted} deleted`);
  }
  if (summary.filesRenamed > 0) {
    fileTypeChanges.push(`${summary.filesRenamed} renamed`);
  }

  if (fileTypeChanges.length > 0) {
    parts.push(`(${fileTypeChanges.join(', ')})`);
  }

  return parts.join(', ');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a simple FileDiff for testing or programmatic generation.
 *
 * @param filePath - Path to the file
 * @param oldContent - Original content
 * @param newContent - New content
 * @returns FileDiff representing the change
 *
 * @example
 * ```typescript
 * const diff = createSimpleDiff(
 *   'example.ts',
 *   'line 1\nline 2\nline 3',
 *   'line 1\nline 2 modified\nline 3'
 * );
 * ```
 */
export function createSimpleDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): FileDiff {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const diffLines: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  // Simple line-by-line comparison (not optimal, but straightforward)
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldLine === newLine) {
      diffLines.push({
        operation: 'context',
        content: oldLine,
        oldLineNum: oldIndex + 1,
        newLineNum: newIndex + 1,
      });
      oldIndex++;
      newIndex++;
    } else if (oldIndex < oldLines.length && !newLines.includes(oldLine)) {
      diffLines.push({
        operation: 'delete',
        content: oldLine,
        oldLineNum: oldIndex + 1,
      });
      oldIndex++;
    } else if (newIndex < newLines.length) {
      diffLines.push({
        operation: 'add',
        content: newLine,
        newLineNum: newIndex + 1,
      });
      newIndex++;
    } else {
      oldIndex++;
    }
  }

  const hunk: DiffHunk = {
    oldStart: 1,
    oldCount: oldLines.length,
    newStart: 1,
    newCount: newLines.length,
    lines: diffLines,
  };

  let changeType: FileChangeType = 'modify';
  if (oldContent === '') {
    changeType = 'add';
  } else if (newContent === '') {
    changeType = 'delete';
  }

  return {
    filePath,
    changeType,
    hunks: [hunk],
  };
}

/**
 * Truncate a large diff to a maximum number of hunks.
 * Useful for displaying previews or handling very large diffs.
 *
 * @param fileDiff - The diff to truncate
 * @param maxHunks - Maximum number of hunks to keep
 * @returns Truncated FileDiff
 *
 * @example
 * ```typescript
 * const preview = truncateDiff(largeDiff, 3);
 * ```
 */
export function truncateDiff(fileDiff: FileDiff, maxHunks: number): FileDiff {
  if (fileDiff.hunks.length <= maxHunks) {
    return fileDiff;
  }

  return {
    ...fileDiff,
    hunks: fileDiff.hunks.slice(0, maxHunks),
  };
}

/**
 * Check if a FileDiff represents a binary file.
 *
 * @param fileDiff - The diff to check
 * @returns True if the file is binary
 */
export function isBinaryDiff(fileDiff: FileDiff): boolean {
  return fileDiff.metadata?.isBinary === true;
}

/**
 * Check if a FileDiff has no actual changes (empty diff).
 *
 * @param fileDiff - The diff to check
 * @returns True if there are no additions or deletions
 */
export function isEmptyDiff(fileDiff: FileDiff): boolean {
  for (const hunk of fileDiff.hunks) {
    for (const line of hunk.lines) {
      if (line.operation === 'add' || line.operation === 'delete') {
        return false;
      }
    }
  }
  return true;
}
