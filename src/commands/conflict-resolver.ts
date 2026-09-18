/**
 * Interactive conflict resolution UI for cloud-synced CLAUDE.md.
 *
 * When both local and cloud versions have diverged since the last sync,
 * this module presents the user with an interactive resolution flow:
 *
 *   [K]eep local  -- discard cloud changes, push local to cloud
 *   [T]ake remote  -- discard local changes, pull cloud to local
 *   [M]erge manually  -- open $EDITOR with conflict markers
 *   [D]iff  -- show unified diff, then re-prompt
 *
 * The flow is designed to be intuitive for developers familiar with
 * git merge conflict resolution patterns.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

import {
  bold,
  choose,
  confirm,
  dim,
  error,
  generateConflictMarkers,
  info,
  isInteractivePromptAvailable,
  renderColoredDiff,
  sectionHeader,
  warning,
  yellow,
} from "./cli-format.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConflictResolution =
  | { readonly kind: "keep-local" }
  | { readonly kind: "take-remote" }
  | { readonly kind: "merged"; readonly content: string }
  | { readonly kind: "aborted" };

export interface ConflictContext {
  /** The local CLAUDE.md content */
  readonly localContent: string;
  /** The cloud/remote CLAUDE.md content */
  readonly cloudContent: string;
  /** Human-readable identifier of who made the cloud change */
  readonly cloudUpdatedBy: string;
  /** ISO timestamp of the cloud change */
  readonly cloudUpdatedAt: string;
}

interface EditorCommand {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the interactive conflict resolution flow.
 *
 * This function handles the full interaction loop, including showing diffs
 * and re-prompting after the user views a diff.
 */
export async function resolveConflict(
  context: ConflictContext,
): Promise<ConflictResolution> {
  const output = process.stderr;

  if (!isInteractivePromptAvailable()) {
    output.write(
      `${warning("Conflict resolution requires an interactive terminal. Aborting without changes.")}\n`,
    );
    return { kind: "aborted" };
  }

  output.write("\n");
  output.write(
    `${yellow(bold("Cloud instructions conflict detected."))}\n`,
  );
  output.write(
    `${dim(`Remote was updated by ${context.cloudUpdatedBy} at ${context.cloudUpdatedAt}.`)}\n`,
  );
  output.write(
    `${dim("Both local and cloud have changed since the last sync.")}\n`,
  );
  output.write("\n");

  // Show summary of changes
  const localLines = context.localContent.split("\n").length;
  const cloudLines = context.cloudContent.split("\n").length;
  const localSize = Buffer.byteLength(context.localContent, "utf-8");
  const cloudSize = Buffer.byteLength(context.cloudContent, "utf-8");

  output.write(`  ${bold("Local:")}  ${localLines} lines, ${formatBytesShort(localSize)}\n`);
  output.write(`  ${bold("Cloud:")}  ${cloudLines} lines, ${formatBytesShort(cloudSize)}\n`);
  output.write("\n");

  // Interactive resolution loop
  while (true) {
    const choice = await choose("Choose resolution:", [
      { key: "k", label: "Keep local (push to cloud)" },
      { key: "t", label: "Take remote (pull from cloud)" },
      { key: "m", label: "Merge manually (open in editor)" },
      { key: "d", label: "Diff (show changes)" },
    ]);

    switch (choice) {
      case "k":
        return handleKeepLocal(output);

      case "t":
        return handleTakeRemote(output);

      case "m":
        return handleManualMerge(context, output);

      case "d":
        showDiff(context, output);
        // After showing diff, loop back to re-prompt
        continue;

      default:
        output.write(`${warning("Unrecognized choice. Please try again.")}\n`);
        continue;
    }
  }
}

// ---------------------------------------------------------------------------
// Resolution handlers
// ---------------------------------------------------------------------------

async function handleKeepLocal(
  output: NodeJS.WritableStream,
): Promise<ConflictResolution> {
  const confirmed = await confirm("Keep local version and push to cloud?");
  if (!confirmed) {
    output.write(`${dim("Cancelled. No changes made.")}\n`);
    return { kind: "aborted" };
  }
  return { kind: "keep-local" };
}

async function handleTakeRemote(
  output: NodeJS.WritableStream,
): Promise<ConflictResolution> {
  const confirmed = await confirm("Take cloud version and overwrite local?");
  if (!confirmed) {
    output.write(`${dim("Cancelled. No changes made.")}\n`);
    return { kind: "aborted" };
  }
  return { kind: "take-remote" };
}

async function handleManualMerge(
  context: ConflictContext,
  output: NodeJS.WritableStream,
): Promise<ConflictResolution> {
  const editor = resolveEditor();

  if (editor === null) {
    output.write(
      `${error("No editor found. Set $EDITOR or $VISUAL environment variable.")}\n`,
    );
    output.write(`${dim("Example: export EDITOR=vim")}\n`);
    return { kind: "aborted" };
  }

  // Generate conflict file with markers
  const conflictContent = generateConflictMarkers(
    context.localContent,
    context.cloudContent,
  );

  const tmpFile = path.join(
    tmpdir(),
    `claude-merge-${randomBytes(4).toString("hex")}.md`,
  );

  try {
    await fs.writeFile(tmpFile, conflictContent, "utf-8");

    output.write(
      `\n${info(`Opening merge file in ${bold([editor.command, ...editor.args].join(" "))}...`)}\n`,
    );
    output.write(
      `${dim("Resolve the conflict markers, save, and close the editor.")}\n`,
    );
    output.write(
      `${dim("Conflict markers: <<<<<<< LOCAL ... ======= ... >>>>>>> CLOUD")}\n\n`,
    );

    // Open editor synchronously -- blocks until editor is closed
    try {
      const result = spawnSync(editor.command, [...editor.args, tmpFile], {
        stdio: "inherit",
        shell: false,
        timeout: 0, // no timeout for editor
      });
      if (result.error !== undefined) {
        output.write(
          `${error(`Failed to launch editor '${editor.command}': ${result.error.message}`)}\n`,
        );
        return { kind: "aborted" };
      }
      if (result.status !== 0 && result.status !== null) {
        output.write(
          `${error(`Editor exited with code ${result.status}.`)}\n`,
        );
        return { kind: "aborted" };
      }
    } catch {
      output.write(`${error("Editor exited with an error.")}\n`);
      return { kind: "aborted" };
    }

    // Read the result
    const mergedContent = await fs.readFile(tmpFile, "utf-8");

    // Check if conflict markers remain
    if (hasConflictMarkers(mergedContent)) {
      output.write(
        `${warning("Conflict markers are still present in the file.")}\n`,
      );
      const proceed = await confirm("Save anyway?", false);
      if (!proceed) {
        output.write(`${dim("Aborted. No changes made.")}\n`);
        return { kind: "aborted" };
      }
    }

    // Check if content is empty
    if (mergedContent.trim().length === 0) {
      output.write(`${warning("Merged content is empty.")}\n`);
      const proceed = await confirm("Save empty content?", false);
      if (!proceed) {
        output.write(`${dim("Aborted. No changes made.")}\n`);
        return { kind: "aborted" };
      }
    }

    return { kind: "merged", content: mergedContent };
  } finally {
    // Clean up temp file
    await fs.unlink(tmpFile).catch(() => {});
  }
}

function showDiff(
  context: ConflictContext,
  output: NodeJS.WritableStream,
): void {
  output.write(sectionHeader("Diff: local vs. cloud") + "\n\n");

  const diff = renderColoredDiff(
    context.localContent,
    context.cloudContent,
    "local (CLAUDE.md)",
    "cloud (synced)",
  );

  output.write(diff);
  output.write("\n\n");
}

// ---------------------------------------------------------------------------
// Editor resolution
// ---------------------------------------------------------------------------

function resolveEditor(): EditorCommand | null {
  const visual = process.env["VISUAL"];
  if (visual && visual.length > 0) return parseEditorCommand(visual);

  const editor = process.env["EDITOR"];
  if (editor && editor.length > 0) return parseEditorCommand(editor);

  // Try common editors
  const candidates = ["code --wait", "vim", "vi", "nano"];
  for (const candidate of candidates) {
    const parsedCandidate = parseEditorCommand(candidate);
    if (parsedCandidate === null) {
      continue;
    }
    const binary = parsedCandidate.command;
    const probe = spawnSync("which", [binary], {
      stdio: "ignore",
      shell: false,
    });
    if (probe.status === 0) {
      return parsedCandidate;
    }
  }

  return null;
}

/**
 * Parse an editor command string without invoking a shell.
 * Reject command values that include shell metacharacters to prevent injection.
 */
function parseEditorCommand(raw: string): EditorCommand | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Shell metacharacters are not allowed in editor command values.
  if (/[|&;<>()`$\\]/.test(trimmed)) {
    return null;
  }

  const tokens = splitCommandTokens(trimmed);
  if (tokens.length === 0) {
    return null;
  }

  return {
    command: tokens[0],
    args: tokens.slice(1),
  };
}

function splitCommandTokens(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote !== null) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (quote !== null) {
    // Unbalanced quote -> reject by returning empty.
    return [];
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Conflict marker detection
// ---------------------------------------------------------------------------

function hasConflictMarkers(content: string): boolean {
  return (
    content.includes("<<<<<<< LOCAL") &&
    content.includes("=======") &&
    content.includes(">>>>>>> CLOUD")
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatBytesShort(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
