#!/usr/bin/env node

/**
 * Claude Code Hook: Task Output Cleanup
 *
 * Prunes oversized .output files from /tmp/claude-{uid}/ to prevent
 * unbounded disk usage. Background tasks and subagents can produce
 * .output files that grow without limit (observed 46GB+ per file).
 *
 * Runs on SessionStart (startup, resume, compact) to keep disk usage
 * in check without requiring manual intervention.
 *
 * Configuration via environment variables:
 *   CLAUDE_TMP_CLEANUP_MAX_FILE_MB   - Max size per .output file (default: 100)
 *   CLAUDE_TMP_CLEANUP_MAX_TOTAL_GB  - Max total size before pruning old files (default: 5)
 *   CLAUDE_TMP_CLEANUP_MAX_AGE_HOURS - Max age for .output files (default: 72)
 *   CLAUDE_TMP_CLEANUP_DISABLED      - Set to "1" to disable cleanup
 */

import { readdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

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

if (process.env.CLAUDE_TMP_CLEANUP_DISABLED === "1") {
  process.exit(0);
}

// Determine the tmp directory: /tmp/claude-{uid} on macOS/Linux
const uid = process.getuid?.();
const tmpBase =
  process.platform === "darwin"
    ? `/private/tmp/claude-${uid}`
    : `/tmp/claude-${uid}`;

if (!existsSync(tmpBase)) {
  process.exit(0);
}

const now = Date.now();
let deletedCount = 0;
let freedBytes = 0;

/**
 * Recursively find all .output files under the tmp directory.
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
    if (entry.isDirectory()) {
      results.push(...findOutputFiles(fullPath));
    } else if (entry.name.endsWith(".output")) {
      try {
        const stat = statSync(fullPath);
        results.push({ path: fullPath, size: stat.size, mtimeMs: stat.mtimeMs });
      } catch {
        // File may have been deleted between readdir and stat
      }
    }
  }
  return results;
}

const files = findOutputFiles(tmpBase);

// Pass 1: Delete files that exceed per-file size limit
for (const file of files) {
  if (file.size > MAX_FILE_BYTES) {
    try {
      unlinkSync(file.path);
      freedBytes += file.size;
      deletedCount++;
      file.deleted = true;
    } catch {
      // Ignore deletion errors
    }
  }
}

// Pass 2: Delete files older than max age
for (const file of files) {
  if (file.deleted) continue;
  if (now - file.mtimeMs > MAX_AGE_MS) {
    try {
      unlinkSync(file.path);
      freedBytes += file.size;
      deletedCount++;
      file.deleted = true;
    } catch {
      // Ignore deletion errors
    }
  }
}

// Pass 3: If total remaining size exceeds budget, delete largest files first
const remaining = files
  .filter((f) => !f.deleted)
  .sort((a, b) => b.size - a.size);
let totalRemaining = remaining.reduce((sum, f) => sum + f.size, 0);

for (const file of remaining) {
  if (totalRemaining <= MAX_TOTAL_BYTES) break;
  try {
    unlinkSync(file.path);
    totalRemaining -= file.size;
    freedBytes += file.size;
    deletedCount++;
  } catch {
    // Ignore deletion errors
  }
}

// Report only if cleanup actually happened
if (deletedCount > 0) {
  const freedMB = (freedBytes / (1024 * 1024)).toFixed(1);
  const freedGB = (freedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const display = freedBytes > 1024 * 1024 * 1024 ? `${freedGB} GB` : `${freedMB} MB`;
  process.stdout.write(
    `[tmp-cleanup] Pruned ${deletedCount} task output file${deletedCount === 1 ? "" : "s"}, freed ${display}\n`
  );
}
