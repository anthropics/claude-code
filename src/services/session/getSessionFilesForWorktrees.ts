/**
 * Proposed fix for: --resume shows no sessions when cwd is a bare repo root
 * with worktrees.
 *
 * Issue: https://github.com/anthropics/claude-code/issues/48110
 *
 * Root cause
 * ----------
 * `git worktree list --porcelain` does not include the bare repo root as a
 * worktree entry — it lists only the `.bare` directory and each linked
 * worktree.  When a user runs Claude from the bare root, sessions are created
 * under `getProjectDir(cwd)` (e.g. `-Users-foo-work-repo`), but the resume
 * picker's multi-worktree branch only scans project directories whose names
 * match the *worktree* paths (e.g. `-Users-foo-work-repo--bare`,
 * `-Users-foo-work-repo-develop`).  The bare root's project directory is
 * never matched, so its sessions are invisible.
 *
 * Fix
 * ---
 * After the worktree-matching loop, ensure the current cwd's own project
 * directory is always included in the scan set.  This is a no-op when the cwd
 * is itself a worktree (already matched), and only adds a directory when the
 * cwd falls outside the worktree list — exactly the bare-root case.
 *
 * The change below is shown as a complete, readable reconstruction of the
 * function with the fix applied.  The only addition is the block marked
 * "FIX" near the end.
 */

import { Dirent } from "fs";
import { readdir } from "fs/promises";
import { join, sep, basename } from "path";

// -- Assumed imports from the existing codebase ----------------------------------
// import { getCwd }            from "../cwd";
// import { getProjectDir, getProjectsDir, sanitizePath } from "./projectDir";
// import { getSessionFilesLite } from "./getSessionFilesLite";
// import { deduplicateBySessionId } from "./dedup";

interface SessionLog {
  sessionId: string;
  projectPath?: string;
  [key: string]: unknown;
}

// Placeholder signatures — real implementations already exist in the codebase.
declare function getCwd(): string;
declare function getProjectDir(cwd: string): string;
declare function getProjectsDir(): string;
declare function sanitizePath(p: string): string;
declare function getSessionFilesLite(
  projectDir: string,
  maxCount?: number,
  projectPath?: string,
): Promise<SessionLog[]>;
declare function deduplicateBySessionId(logs: SessionLog[]): SessionLog[];
declare function debug(msg: string): void;

// ---------------------------------------------------------------------------

export async function getSessionFilesForWorktrees(
  worktreePaths: string[],
  maxCount?: number,
): Promise<SessionLog[]> {
  const projectsDir = getProjectsDir();
  const cwd = getCwd();

  // Single / no worktree — just scan the cwd's project directory.
  if (worktreePaths.length <= 1) {
    return getSessionFilesLite(getProjectDir(cwd), undefined, cwd);
  }

  // Multi-worktree — scan every project directory that matches a worktree.
  const isWindows = process.platform === "win32";

  const prefixes = worktreePaths.map((wtPath) => {
    const sanitized = sanitizePath(wtPath);
    return {
      path: wtPath,
      prefix: isWindows ? sanitized.toLowerCase() : sanitized,
    };
  });

  // Longest prefix first so the most-specific worktree wins.
  prefixes.sort((a, b) => b.prefix.length - a.prefix.length);

  const matched = new Set<string>();
  let entries: Dirent[];

  try {
    entries = await readdir(projectsDir, { withFileTypes: true });
  } catch (err) {
    debug(
      `Failed to read projects dir ${projectsDir}, falling back to current project: ${err}`,
    );
    return getSessionFilesLite(getProjectDir(cwd), maxCount, cwd);
  }

  const matchedDirs: Array<{ projectDir: string; wtPath: string }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirName = isWindows ? entry.name.toLowerCase() : entry.name;
    if (matched.has(dirName)) continue;

    for (const { path: wtPath, prefix } of prefixes) {
      if (dirName === prefix || dirName.startsWith(prefix + "-")) {
        matched.add(dirName);
        matchedDirs.push({
          projectDir: join(projectsDir, entry.name),
          wtPath,
        });
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // FIX: Always include the cwd's own project directory.
  //
  // In a bare-repo layout the cwd (the repo root containing .git and .bare)
  // is *not* listed by `git worktree list`, so the matching loop above will
  // never pick it up — even though sessions are written there.  Adding it
  // unconditionally is safe: deduplicateBySessionId() at the end of the
  // pipeline already handles overlapping session IDs.
  // -----------------------------------------------------------------------
  const cwdProjectDir = getProjectDir(cwd);
  const cwdDirName = isWindows
    ? basename(cwdProjectDir).toLowerCase()
    : basename(cwdProjectDir);

  if (!matched.has(cwdDirName)) {
    matchedDirs.push({ projectDir: cwdProjectDir, wtPath: cwd });
  }
  // -----------------------------------------------------------------------

  // Load session files from all matched directories in parallel.
  const allSessionFiles = await Promise.all(
    matchedDirs.map(({ projectDir, wtPath }) =>
      getSessionFilesLite(projectDir, undefined, wtPath),
    ),
  );

  return deduplicateBySessionId(allSessionFiles.flat());
}
