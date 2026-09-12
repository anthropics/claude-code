/**
 * Git can be weaponized for sandbox escape via two vectors:
 * 1. Bare-repo attack: if cwd contains HEAD + objects/ + refs/ but no valid
 *    .git/HEAD, Git treats cwd as a bare repository and runs hooks from cwd.
 * 2. Git-internal write + git: a compound command creates HEAD/objects/refs/
 *    hooks/ then runs git — the git subcommand executes the freshly-created
 *    malicious hooks.
 */

import { basename, posix, resolve, sep } from 'path'
import { getCwd } from '../../utils/cwd.js'
import { PS_TOKENIZER_DASH_CHARS } from '../../utils/powershell/parser.js'

/**
 * If a normalized path starts with `../<cwd-basename>/`, it re-enters cwd
 * via the parent — resolve it to the cwd-relative form. posix.normalize
 * preserves leading `..` (no cwd context), so `../project/hooks` with
 * cwd=/x/project stays `../project/hooks` and misses the `hooks/` prefix
 * match even though it resolves to the same directory at runtime.
 * Check/use divergence: validator sees `../project/hooks`, PowerShell
 * resolves against cwd to `hooks`.
 */
function resolveCwdReentry(normalized: string): string {
  if (!normalized.startsWith('../')) return normalized
  const cwdBase = basename(getCwd()).toLowerCase()
  if (!cwdBase) return normalized
  // Iteratively strip `../<cwd-basename>/` pairs (handles `../../p/p/hooks`
  // when cwd has repeated basename segments is unlikely, but one-level is
  // the common attack).
  const prefix = '../' + cwdBase + '/'
  let s = normalized
  while (s.startsWith(prefix)) {
    s = s.slice(prefix.length)
  }
  // Also handle exact `../<cwd-basename>` (no trailing slash)
  if (s === '../' + cwdBase) return '.'
  return s
}

/**
 * Normalize PS arg text → canonical path for git-internal matching.
 * Order matters: structural strips first (colon-bound param, quotes,
 * backtick escapes, provider prefix, drive-relative prefix), then NTFS
 * per-component trailing-strip (spaces always; dots only if not `./..`
 * after space-strip), then posix.normalize (resolves `..`, `.`, `//`),
 * then case-fold.
 */
function normalizeGitPathArg(arg: string): string {
  let s = arg
  // Normalize parameter prefixes: dash chars (–, —, ―) and forward-slash
  // (PS 5.1). /Path:hooks/pre-commit → extract colon-bound value. (bug #28)
  if (s.length > 0 && (PS_TOKENIZER_DASH_CHARS.has(s[0]!) || s[0] === '/')) {
    const c = s.indexOf(':', 1)
    if (c > 0) s = s.slice(c + 1)
  }
  s = s.replace(/^['"]|['"]$/g, '')
  s = s.replace(/`/g, '')
  // PS provider-qualified path: FileSystem::hooks/pre-commit → hooks/pre-commit
  // Also handles fully-qualified form: Microsoft.PowerShell.Core\FileSystem::path
  s = s.replace(/^(?:[A-Za-z0-9_.]+\\){0,3}FileSystem::/i, '')
  // Drive-relative C:foo (no separator after colon) is cwd-relative on that
  // drive. C:\foo (WITH separator) is absolute and must NOT match — the
  // negative lookahead preserves it.
  s = s.replace(/^[A-Za-z]:(?![/\\])/, '')
  s = s.replace(/\\/g, '/')
  // Win32 CreateFileW per-component: iteratively strip trailing spaces,
  // then trailing dots, stopping if the result is `.` or `..` (special).
  // `.. ` → `..`, `.. .` → `..`, `...` → '' → `.`, `hooks .` → `hooks`.
  // Originally-'' (leading slash split) stays '' (absolute-path marker).
  s = s
    .split('/')
    .map(c => {
      if (c === '') return c
      let prev
      do {
        prev = c
        c = c.replace(/ +$/, '')
        if (c === '.' || c === '..') return c
        c = c.replace(/\.+$/, '')
      } while (c !== prev)
      return c || '.'
    })
    .join('/')
  s = posix.normalize(s)
  if (s.startsWith('./')) s = s.slice(2)
  return s.toLowerCase()
}

const GIT_INTERNAL_PREFIXES = ['head', 'objects', 'refs', 'hooks'] as const

/**
 * SECURITY: Resolve a normalized path that escapes cwd (leading `../` or
 * absolute) against the actual cwd, then check if it lands back INSIDE cwd.
 * If so, strip cwd and return the cwd-relative remainder for prefix matching.
 * If it lands outside cwd, return null (genuinely external — path-validation's
 * concern). Covers `..\<cwd-basename>\HEAD` and `C:\<full-cwd>\HEAD` which
 * posix.normalize alone cannot resolve (it leaves leading `..` as-is).
 *
 * This is the SOLE guard for the bare-repo HEAD attack. path-validation's
 * DANGEROUS_FILES deliberately excludes bare `HEAD` (false-positive risk
 * on legitimate non-git files named HEAD) and DANGEROUS_DIRECTORIES
 * matches per-segment `.git` only — so `<cwd>/HEAD` passes that layer.
 * The cwd-resolution here is load-bearing; do not remove without adding
 * an alternative guard.
 */
function resolveEscapingPathToCwdRelative(n: string): string | null {
  const cwd = getCwd()
  // Reconstruct a platform-resolvable path from the posix-normalized form.
  // `n` has forward slashes (normalizeGitPathArg converted \\ → /); resolve()
  // handles forward slashes on Windows.
  const abs = resolve(cwd, n)
  const cwdWithSep = cwd.endsWith(sep) ? cwd : cwd + sep
  // Case-insensitive comparison: normalizeGitPathArg lowercased `n`, so
  // resolve() output has lowercase components from `n` but cwd may be
  // mixed-case (e.g. C:\Users\...). Windows paths are case-insensitive.
  const absLower = abs.toLowerCase()
  const cwdLower = cwd.toLowerCase()
  const cwdWithSepLower = cwdWithSep.toLowerCase()
  if (absLower === cwdLower) return '.'
  if (!absLower.startsWith(cwdWithSepLower)) return null
  return abs.slice(cwdWithSep.length).replace(/\\/g, '/').toLowerCase()
}

function matchesGitInternalPrefix(n: string): boolean {
  if (n === 'head' || n === '.git') return true
  if (n.startsWith('.git/') || /^git~\d+($|\/)/.test(n)) return true
  for (const p of GIT_INTERNAL_PREFIXES) {
    if (p === 'head') continue
    if (n === p || n.startsWith(p + '/')) return true
  }
  return false
}

/**
 * True if arg (raw PS arg text) resolves to a git-internal path in cwd.
 * Covers both bare-repo paths (hooks/, refs/) and standard-repo paths
 * (.git/hooks/, .git/config).
 */
export function isGitInternalPathPS(arg: string): boolean {
  const n = resolveCwdReentry(normalizeGitPathArg(arg))
  if (matchesGitInternalPrefix(n)) return true
  // SECURITY: leading `../` or absolute paths that resolveCwdReentry and
  // posix.normalize couldn't fully resolve. Resolve against actual cwd — if
  // the result lands back in cwd at a git-internal location, the guard must
  // still fire.
  if (n.startsWith('../') || n.startsWith('/') || /^[a-z]:/.test(n)) {
    const rel = resolveEscapingPathToCwdRelative(n)
    if (rel !== null && matchesGitInternalPrefix(rel)) return true
  }
  return false
}

/**
 * True if arg resolves to a path inside .git/ (standard-repo metadata dir).
 * Unlike isGitInternalPathPS, does NOT match bare-repo-style root-level
 * `hooks/`, `refs/` etc. — those are common project directory names.
 */
export function isDotGitPathPS(arg: string): boolean {
  const n = resolveCwdReentry(normalizeGitPathArg(arg))
  if (matchesDotGitPrefix(n)) return true
  // SECURITY: same cwd-resolution as isGitInternalPathPS — catch
  // `..\<cwd-basename>\.git\hooks\pre-commit` that lands back in cwd.
  if (n.startsWith('../') || n.startsWith('/') || /^[a-z]:/.test(n)) {
    const rel = resolveEscapingPathToCwdRelative(n)
    if (rel !== null && matchesDotGitPrefix(rel)) return true
  }
  return false
}

function matchesDotGitPrefix(n: string): boolean {
  if (n === '.git' || n.startsWith('.git/')) return true
  // NTFS 8.3 short names: .git becomes GIT~1 (or GIT~2, etc. if multiple
  // dotfiles start with "git"). normalizeGitPathArg lowercases, so check
  // for git~N as the first component.
  return /^git~\d+($|\/)/.test(n)
}
