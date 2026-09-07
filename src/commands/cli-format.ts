/**
 * Terminal output formatting utilities for the instructions sync CLI.
 *
 * Provides consistent styling for:
 * - Status indicators (success, error, warning, info)
 * - Table formatting for version history
 * - Unified diff rendering with ANSI colors
 * - Progress indicators and section headers
 *
 * All formatting is done through plain ANSI escape sequences to avoid
 * external dependencies. Colors degrade gracefully when NO_COLOR is set
 * or the terminal does not support ANSI.
 */

// ---------------------------------------------------------------------------
// Color support detection
// ---------------------------------------------------------------------------

const supportsColor = (): boolean => {
  if (process.env["NO_COLOR"] !== undefined) return false;
  if (process.env["FORCE_COLOR"] !== undefined) return true;
  if (!process.stdout.isTTY) return false;
  return true;
};

const COLOR_ENABLED = supportsColor();

export const isInteractivePromptAvailable = (): boolean =>
  Boolean(process.stdin.isTTY && process.stderr.isTTY);

// ---------------------------------------------------------------------------
// ANSI escape codes
// ---------------------------------------------------------------------------

const RESET = COLOR_ENABLED ? "\x1b[0m" : "";
const BOLD = COLOR_ENABLED ? "\x1b[1m" : "";
const DIM = COLOR_ENABLED ? "\x1b[2m" : "";
const RED = COLOR_ENABLED ? "\x1b[31m" : "";
const GREEN = COLOR_ENABLED ? "\x1b[32m" : "";
const YELLOW = COLOR_ENABLED ? "\x1b[33m" : "";
const BLUE = COLOR_ENABLED ? "\x1b[34m" : "";
const CYAN = COLOR_ENABLED ? "\x1b[36m" : "";
// Reserved for future use:
// const RED_BG = COLOR_ENABLED ? "\x1b[41m" : "";
// const GREEN_BG = COLOR_ENABLED ? "\x1b[42m" : "";
// const WHITE = COLOR_ENABLED ? "\x1b[37m" : "";

// ---------------------------------------------------------------------------
// Status indicators
// ---------------------------------------------------------------------------

export function success(message: string): string {
  return `${GREEN}${BOLD}OK${RESET} ${message}`;
}

export function error(message: string): string {
  return `${RED}${BOLD}Error${RESET} ${message}`;
}

export function warning(message: string): string {
  return `${YELLOW}${BOLD}Warning${RESET} ${message}`;
}

export function info(message: string): string {
  return `${BLUE}${BOLD}Info${RESET} ${message}`;
}

export function dim(message: string): string {
  return `${DIM}${message}${RESET}`;
}

export function bold(message: string): string {
  return `${BOLD}${message}${RESET}`;
}

export function cyan(message: string): string {
  return `${CYAN}${message}${RESET}`;
}

export function green(message: string): string {
  return `${GREEN}${message}${RESET}`;
}

export function red(message: string): string {
  return `${RED}${message}${RESET}`;
}

export function yellow(message: string): string {
  return `${YELLOW}${message}${RESET}`;
}

// ---------------------------------------------------------------------------
// Section formatting
// ---------------------------------------------------------------------------

export function sectionHeader(title: string): string {
  return `\n${BOLD}${title}${RESET}`;
}

export function keyValue(key: string, value: string): string {
  return `  ${DIM}${key}:${RESET} ${value}`;
}

export function indented(message: string, level: number = 1): string {
  const indent = "  ".repeat(level);
  return `${indent}${message}`;
}

// ---------------------------------------------------------------------------
// Table formatting (for version history)
// ---------------------------------------------------------------------------

export interface TableColumn {
  readonly header: string;
  readonly width: number;
  readonly align?: "left" | "right";
}

export function formatTable(
  columns: ReadonlyArray<TableColumn>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): string {
  const lines: string[] = [];

  // Header
  const headerCells = columns.map((col) => padCell(col.header, col.width, col.align ?? "left"));
  lines.push(`  ${BOLD}${headerCells.join("  ")}${RESET}`);

  // Separator
  const separator = columns.map((col) => "-".repeat(col.width));
  lines.push(`  ${DIM}${separator.join("  ")}${RESET}`);

  // Rows
  for (const row of rows) {
    const cells = columns.map((col, i) => {
      const value = i < row.length ? row[i] : "";
      return padCell(value, col.width, col.align ?? "left");
    });
    lines.push(`  ${cells.join("  ")}`);
  }

  return lines.join("\n");
}

function padCell(value: string, width: number, align: "left" | "right"): string {
  const truncated = value.length > width ? value.slice(0, width - 1) + "~" : value;
  if (align === "right") {
    return truncated.padStart(width);
  }
  return truncated.padEnd(width);
}

// ---------------------------------------------------------------------------
// Unified diff rendering
// ---------------------------------------------------------------------------

/**
 * Renders a unified diff with ANSI colors for terminal display.
 *
 * Added lines are shown in green, removed lines in red, and context lines
 * in the default color. Section headers (@@ markers) are shown in cyan.
 */
export function renderColoredDiff(
  oldContent: string,
  newContent: string,
  oldLabel: string = "local",
  newLabel: string = "cloud",
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const diff = computeUnifiedDiff(oldLines, newLines, oldLabel, newLabel);

  return diff
    .map((line) => {
      if (line.startsWith("---") || line.startsWith("+++")) {
        return `${BOLD}${line}${RESET}`;
      }
      if (line.startsWith("@@")) {
        return `${CYAN}${line}${RESET}`;
      }
      if (line.startsWith("+")) {
        return `${GREEN}${line}${RESET}`;
      }
      if (line.startsWith("-")) {
        return `${RED}${line}${RESET}`;
      }
      return line;
    })
    .join("\n");
}

/**
 * Computes a unified diff between two arrays of lines.
 * Uses a simple LCS-based algorithm suitable for CLAUDE.md files
 * (typically under 500 lines).
 */
function computeUnifiedDiff(
  oldLines: ReadonlyArray<string>,
  newLines: ReadonlyArray<string>,
  oldLabel: string,
  newLabel: string,
  contextSize: number = 3,
): string[] {
  const result: string[] = [];

  result.push(`--- a/${oldLabel}`);
  result.push(`+++ b/${newLabel}`);

  // Simple diff: compute edit operations using Myers-like approach
  const edits = computeEdits(oldLines, newLines);

  // Group edits into hunks with context
  const hunks = groupIntoHunks(edits, oldLines, newLines, contextSize);

  for (const hunk of hunks) {
    result.push(
      `@@ -${hunk.oldStart + 1},${hunk.oldCount} +${hunk.newStart + 1},${hunk.newCount} @@`,
    );
    for (const line of hunk.lines) {
      result.push(line);
    }
  }

  return result;
}

interface Edit {
  readonly kind: "keep" | "add" | "remove";
  readonly oldIndex: number;
  readonly newIndex: number;
  readonly text: string;
}

interface Hunk {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly lines: string[];
}

/**
 * Computes a sequence of edit operations between two line arrays
 * using a longest common subsequence approach.
 */
function computeEdits(
  oldLines: ReadonlyArray<string>,
  newLines: ReadonlyArray<string>,
): Edit[] {
  const lcs = computeLCS(oldLines, newLines);
  const edits: Edit[] = [];

  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < oldLines.length || ni < newLines.length) {
    if (li < lcs.length && oi === lcs[li].oldIndex && ni === lcs[li].newIndex) {
      edits.push({ kind: "keep", oldIndex: oi, newIndex: ni, text: oldLines[oi] });
      oi++;
      ni++;
      li++;
    } else if (oi < oldLines.length && (li >= lcs.length || oi < lcs[li].oldIndex)) {
      edits.push({ kind: "remove", oldIndex: oi, newIndex: ni, text: oldLines[oi] });
      oi++;
    } else if (ni < newLines.length && (li >= lcs.length || ni < lcs[li].newIndex)) {
      edits.push({ kind: "add", oldIndex: oi, newIndex: ni, text: newLines[ni] });
      ni++;
    }
  }

  return edits;
}

interface LCSEntry {
  readonly oldIndex: number;
  readonly newIndex: number;
}

/**
 * Computes the longest common subsequence between two line arrays.
 * Uses a standard dynamic programming approach.
 */
function computeLCS(
  oldLines: ReadonlyArray<string>,
  newLines: ReadonlyArray<string>,
): LCSEntry[] {
  const m = oldLines.length;
  const n = newLines.length;

  // DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the actual LCS
  const result: LCSEntry[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Groups a sequence of edits into hunks with context lines.
 */
function groupIntoHunks(
  edits: ReadonlyArray<Edit>,
  _oldLines: ReadonlyArray<string>,
  _newLines: ReadonlyArray<string>,
  contextSize: number,
): Hunk[] {
  if (edits.length === 0) return [];

  // Find ranges of changes with context
  const changeIndices: number[] = [];
  for (let i = 0; i < edits.length; i++) {
    if (edits[i].kind !== "keep") {
      changeIndices.push(i);
    }
  }

  if (changeIndices.length === 0) return [];

  // Group adjacent changes (within 2*contextSize of each other)
  const groups: number[][] = [];
  let currentGroup: number[] = [changeIndices[0]];

  for (let i = 1; i < changeIndices.length; i++) {
    if (changeIndices[i] - changeIndices[i - 1] <= 2 * contextSize + 1) {
      currentGroup.push(changeIndices[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [changeIndices[i]];
    }
  }
  groups.push(currentGroup);

  // Build hunks from groups
  const hunks: Hunk[] = [];
  for (const group of groups) {
    const start = Math.max(0, group[0] - contextSize);
    const end = Math.min(edits.length - 1, group[group.length - 1] + contextSize);

    const lines: string[] = [];
    let oldCount = 0;
    let newCount = 0;
    let oldStart = -1;
    let newStart = -1;

    for (let i = start; i <= end; i++) {
      const edit = edits[i];
      if (oldStart === -1) {
        oldStart = edit.oldIndex;
        newStart = edit.newIndex;
      }

      switch (edit.kind) {
        case "keep":
          lines.push(` ${edit.text}`);
          oldCount++;
          newCount++;
          break;
        case "remove":
          lines.push(`-${edit.text}`);
          oldCount++;
          break;
        case "add":
          lines.push(`+${edit.text}`);
          newCount++;
          break;
      }
    }

    hunks.push({
      oldStart: oldStart >= 0 ? oldStart : 0,
      oldCount,
      newStart: newStart >= 0 ? newStart : 0,
      newCount,
      lines,
    });
  }

  return hunks;
}

// ---------------------------------------------------------------------------
// Conflict markers for manual merge
// ---------------------------------------------------------------------------

/**
 * Generates a file with Git-style conflict markers for manual resolution.
 */
export function generateConflictMarkers(
  localContent: string,
  cloudContent: string,
): string {
  return [
    "<<<<<<< LOCAL (your machine)",
    localContent,
    "=======",
    cloudContent,
    ">>>>>>> CLOUD (synced)",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Byte formatting
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

export function formatTimestamp(epochMs: number): string {
  return new Date(epochMs).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

export function formatRelativeTime(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// ---------------------------------------------------------------------------
// Prompt helpers (for stdin reading)
// ---------------------------------------------------------------------------

/**
 * Reads a single line from stdin. This is the low-level primitive used
 * by the interactive prompts. Prompts are displayed via stderr to keep
 * stdout clean for piped output.
 */
export async function promptLine(prompt: string): Promise<string> {
  if (!isInteractivePromptAvailable()) {
    throw new NonInteractivePromptError(
      "Interactive prompt requested but stdin/stderr is not a TTY.",
    );
  }

  return new Promise((resolve) => {
    process.stderr.write(prompt);
    const chunks: Buffer[] = [];

    const onData = (chunk: Buffer): void => {
      chunks.push(chunk);
      const text = Buffer.concat(chunks).toString("utf-8");
      if (text.includes("\n")) {
        process.stdin.removeListener("data", onData);
        process.stdin.pause();
        resolve(text.trim());
      }
    };

    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

/**
 * Prompts the user for a yes/no confirmation.
 * Returns true if the user answered yes.
 */
export async function confirm(question: string, defaultYes: boolean = false): Promise<boolean> {
  if (!isInteractivePromptAvailable()) {
    return defaultYes;
  }

  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = await promptLine(`${question} ${dim(hint)} `);

  if (answer === "") return defaultYes;
  return answer.toLowerCase().startsWith("y");
}

/**
 * Prompts the user to choose from a set of options.
 * Returns the key of the chosen option.
 */
export async function choose(
  question: string,
  options: ReadonlyArray<{ key: string; label: string }>,
): Promise<string> {
  if (!isInteractivePromptAvailable()) {
    throw new NonInteractivePromptError(
      `Interactive choice requested for '${question}' in non-interactive mode.`,
    );
  }

  const optionLabels = options.map((o) => `[${bold(o.key.toUpperCase())}]${o.label.slice(1)}`);
  const prompt = `${question}\n${optionLabels.join(" | ")}\n> `;

  while (true) {
    const answer = await promptLine(prompt);
    const normalized = answer.toLowerCase().trim();
    const match = options.find(
      (o) => o.key.toLowerCase() === normalized || o.label.toLowerCase().startsWith(normalized),
    );
    if (match) return match.key;
    process.stderr.write(`${warning("Invalid choice. Please select one of the options above.")}\n`);
  }
}

export class NonInteractivePromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonInteractivePromptError";
  }
}
