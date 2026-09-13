#!/usr/bin/env node

/**
 * Claude Code SessionStart Hook: Temporary File Cleanup
 *
 * Prunes two categories of leaked files from the Claude Code tmp directory:
 *
 * 1. Task .output files — Background tasks and subagents capture stdout/stderr
 *    to .output files with no size cap. Interactive prompts in non-interactive
 *    shells, verbose builds, and runaway processes can produce individual files
 *    exceeding 46 GB (95 GB+ total observed in a single session).
 *
 * 2. CWD tracking files (claude-*-cwd) — Small 22-byte files that accumulate
 *    at a rate of ~174/day and are never cleaned up on crash or abnormal exit.
 *
 * Runs on SessionStart to catch leftovers from crashed sessions. Configurable
 * via environment variables. All filesystem operations are symlink-safe.
 *
 * @see https://github.com/anthropics/claude-code/issues/26911
 * @see https://github.com/anthropics/claude-code/issues/39909
 * @see https://github.com/anthropics/claude-code/issues/8856
 */

import {
  existsSync,
  lstatSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { platform } from "node:os";

// -- Configuration (all overridable via environment variables) ----------------

const MAX_FILE_BYTES =
  (parseInt(process.env.CLAUDE_TMP_CLEANUP_MAX_FILE_MB, 10) || 100) *
  1024 *
  1024;

const MAX_TOTAL_BYTES =
  (parseInt(process.env.CLAUDE_TMP_CLEANUP_MAX_TOTAL_GB, 10) || 5) *
  1024 *
  1024 *
  1024;

const MAX_AGE_MS =
  (parseInt(process.env.CLAUDE_TMP_CLEANUP_MAX_AGE_HOURS, 10) || 72) *
  60 *
  60 *
  1000;

const CWD_MAX_AGE_MS =
  (parseInt(process.env.CLAUDE_TMP_CLEANUP_CWD_MAX_AGE_HOURS, 10) || 24) *
  60 *
  60 *
  1000;

if (process.env.CLAUDE_TMP_CLEANUP_DISABLED === "1") {
  process.exit(0);
}

// -- Platform detection ------------------------------------------------------

// process.getuid() is only available on POSIX (macOS, Linux).
// On Windows, Claude Code uses a different tmp path convention that this
// plugin does not currently handle.
const getuid = process.getuid;
if (typeof getuid !== "function") {
  process.exit(0);
}

const uid = getuid.call(process);
const tmpBase =
  platform() === "darwin"
    ? `/private/tmp/claude-${uid}`
    : `/tmp/claude-${uid}`;

const resolvedTmpBase = resolve(tmpBase);

if (!existsSync(resolvedTmpBase)) {
  process.exit(0);
}

// -- Helpers -----------------------------------------------------------------

const now = Date.now();
let deletedCount = 0;
let freedBytes = 0;
let cwdDeletedCount = 0;

/**
 * Safely stat a path using lstat (does not follow symlinks).
 * Returns null if the path cannot be accessed.
 */
function safeLstat(filePath) {
  try {
    return lstatSync(filePath);
  } catch {
    return null;
  }
}

/**
 * Safely delete a file. Returns the file size if successful, 0 otherwise.
 */
function safeUnlink(filePath) {
  try {
    const stat = safeLstat(filePath);
    if (!stat) return 0;

    // Only delete regular files — never follow symlinks
    if (!stat.isFile()) return 0;

    const size = stat.size;
    unlinkSync(filePath);
    return size;
  } catch {
    return 0;
  }
}

/**
 * Verify that a resolved path is still within the tmp base directory.
 * Prevents path traversal via symlinked directories.
 */
function isWithinTmpBase(filePath) {
  return resolve(filePath).startsWith(resolvedTmpBase + "/");
}

/**
 * Recursively find all .output files under the tmp directory.
 * Skips symlinks at every level to prevent directory traversal attacks.
 */
function findOutputFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Never follow symlinks — prevents traversal outside /tmp
    if (entry.isSymbolicLink()) continue;

    if (entry.isDirectory()) {
      results.push(...findOutputFiles(fullPath));
    } else if (entry.name.endsWith(".output") && entry.isFile()) {
      if (!isWithinTmpBase(fullPath)) continue;
      const stat = safeLstat(fullPath);
      if (stat && stat.isFile()) {
        results.push({
          path: fullPath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          deleted: false,
        });
      }
    }
  }
  return results;
}

// -- Pass 1: Prune .output files ---------------------------------------------

const files = findOutputFiles(resolvedTmpBase);

// 1a. Delete files that exceed the per-file size limit
for (const file of files) {
  if (file.size > MAX_FILE_BYTES) {
    const freed = safeUnlink(file.path);
    if (freed > 0) {
      freedBytes += freed;
      deletedCount++;
      file.deleted = true;
    }
  }
}

// 1b. Delete files older than the max age
for (const file of files) {
  if (file.deleted) continue;
  if (now - file.mtimeMs > MAX_AGE_MS) {
    const freed = safeUnlink(file.path);
    if (freed > 0) {
      freedBytes += freed;
      deletedCount++;
      file.deleted = true;
    }
  }
}

// 1c. If total remaining size exceeds budget, delete largest files first
const remaining = files
  .filter((f) => !f.deleted)
  .sort((a, b) => b.size - a.size);
let totalRemaining = remaining.reduce((sum, f) => sum + f.size, 0);

for (const file of remaining) {
  if (totalRemaining <= MAX_TOTAL_BYTES) break;
  const freed = safeUnlink(file.path);
  if (freed > 0) {
    totalRemaining -= freed;
    freedBytes += freed;
    deletedCount++;
  }
}

// -- Pass 2: Clean stale cwd tracking files ----------------------------------

// CWD files match the pattern: claude-XXXX-cwd (4 hex chars)
const cwdPattern = /^claude-[0-9a-f]{4}-cwd$/;

try {
  const tmpParent = resolve(resolvedTmpBase, "..");
  const tmpEntries = readdirSync(tmpParent, { withFileTypes: true });

  for (const entry of tmpEntries) {
    if (!cwdPattern.test(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;
    if (!entry.isFile()) continue;

    const fullPath = join(tmpParent, entry.name);
    const stat = safeLstat(fullPath);
    if (!stat || !stat.isFile()) continue;

    // Only delete stale cwd files (older than threshold)
    if (now - stat.mtimeMs > CWD_MAX_AGE_MS) {
      // Verify ownership — only delete files owned by the current user
      if (stat.uid !== uid) continue;

      const freed = safeUnlink(fullPath);
      if (freed > 0) {
        freedBytes += freed;
        cwdDeletedCount++;
      }
    }
  }
} catch {
  // Parent directory not readable — skip cwd cleanup
}

// -- Report ------------------------------------------------------------------

const totalDeleted = deletedCount + cwdDeletedCount;

if (totalDeleted > 0) {
  const parts = [];
  if (deletedCount > 0) {
    parts.push(`${deletedCount} task output file${deletedCount === 1 ? "" : "s"}`);
  }
  if (cwdDeletedCount > 0) {
    parts.push(`${cwdDeletedCount} stale cwd file${cwdDeletedCount === 1 ? "" : "s"}`);
  }

  const freedMB = (freedBytes / (1024 * 1024)).toFixed(1);
  const freedGB = (freedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const display =
    freedBytes >= 1024 * 1024 * 1024 ? `${freedGB} GB` : `${freedMB} MB`;

  process.stdout.write(
    `[tmp-cleanup] Pruned ${parts.join(" and ")}, freed ${display}\n`
  );
}
