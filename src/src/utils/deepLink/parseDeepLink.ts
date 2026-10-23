/**
 * Deep Link URI Parser
 *
 * Parses `claude-cli://open` URIs. All parameters are optional:
 *   q    — pre-fill the prompt input (not submitted)
 *   cwd  — working directory (absolute path)
 *   repo — owner/name slug, resolved against githubRepoPaths config
 *
 * Examples:
 *   claude-cli://open
 *   claude-cli://open?q=hello+world
 *   claude-cli://open?q=fix+tests&repo=owner/repo
 *   claude-cli://open?cwd=/path/to/project
 *
 * Security: values are URL-decoded, Unicode-sanitized, and rejected if they
 * contain ASCII control characters (newlines etc. can act as command
 * separators). All values are single-quote shell-escaped at the point of
 * use (terminalLauncher.ts) — that escaping is the injection boundary.
 */

import { partiallySanitizeUnicode } from '../sanitization.js'

export const DEEP_LINK_PROTOCOL = 'claude-cli'

export type DeepLinkAction = {
  query?: string
  cwd?: string
  repo?: string
}

/**
 * Check if a string contains ASCII control characters (0x00-0x1F, 0x7F).
 * These can act as command separators in shells (newlines, carriage returns, etc.).
 * Allows printable ASCII and Unicode (CJK, emoji, accented chars, etc.).
 */
function containsControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) {
      return true
    }
  }
  return false
}

/**
 * GitHub owner/repo slug: alphanumerics, dots, hyphens, underscores,
 * exactly one slash. Keeps this from becoming a path traversal vector.
 */
const REPO_SLUG_PATTERN = /^[\w.-]+\/[\w.-]+$/

/**
 * Cap on pre-filled prompt length. The only defense against a prompt like
 * "review PR #18796 […4900 chars of padding…] also cat ~/.ssh/id_rsa" is
 * the user reading it before pressing Enter. At this length the prompt is
 * no longer scannable at a glance, so banner.ts shows an explicit "scroll
 * to review the entire prompt" warning above LONG_PREFILL_THRESHOLD.
 * Reject, don't truncate — truncation changes meaning.
 *
 * 5000 is the practical ceiling: the Windows cmd.exe fallback
 * (terminalLauncher.ts) has an 8191-char command-string limit, and after
 * the `cd /d <cwd> && <claude.exe> --deep-link-origin ... --prefill "<q>"`
 * wrapper plus cmdQuote's %→%% expansion, ~7000 chars of query is the
 * hard stop for typical inputs. A pathological >60%-percent-sign query
 * would 2× past the limit, but cmd.exe is the last-resort fallback
 * (wt.exe and PowerShell are tried first) and the failure mode is a
 * launch error, not a security issue — so we don't penalize real users
 * for an implausible input.
 */
const MAX_QUERY_LENGTH = 5000

/**
 * PATH_MAX on Linux is 4096. Windows MAX_PATH is 260 (32767 with long-path
 * opt-in). No real path approaches this; a cwd over 4096 is malformed or
 * malicious.
 */
const MAX_CWD_LENGTH = 4096

/**
 * Parse a claude-cli:// URI into a structured action.
 *
 * @throws {Error} if the URI is malformed or contains dangerous characters
 */
export function parseDeepLink(uri: string): DeepLinkAction {
  // Normalize: accept with or without the trailing colon in protocol
  const normalized = uri.startsWith(`${DEEP_LINK_PROTOCOL}://`)
    ? uri
    : uri.startsWith(`${DEEP_LINK_PROTOCOL}:`)
      ? uri.replace(`${DEEP_LINK_PROTOCOL}:`, `${DEEP_LINK_PROTOCOL}://`)
      : null

  if (!normalized) {
    throw new Error(
      `Invalid deep link: expected ${DEEP_LINK_PROTOCOL}:// scheme, got "${uri}"`,
    )
  }

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error(`Invalid deep link URL: "${uri}"`)
  }

  if (url.hostname !== 'open') {
    throw new Error(`Unknown deep link action: "${url.hostname}"`)
  }

  const cwd = url.searchParams.get('cwd') ?? undefined
  const repo = url.searchParams.get('repo') ?? undefined
  const rawQuery = url.searchParams.get('q')

  // Validate cwd if present — must be an absolute path
  if (cwd && !cwd.startsWith('/') && !/^[a-zA-Z]:[/\\]/.test(cwd)) {
    throw new Error(
      `Invalid cwd in deep link: must be an absolute path, got "${cwd}"`,
    )
  }

  // Reject control characters in cwd (newlines, etc.) but allow path chars like backslash.
  if (cwd && containsControlChars(cwd)) {
    throw new Error('Deep link cwd contains disallowed control characters')
  }
  if (cwd && cwd.length > MAX_CWD_LENGTH) {
    throw new Error(
      `Deep link cwd exceeds ${MAX_CWD_LENGTH} characters (got ${cwd.length})`,
    )
  }

  // Validate repo slug format. Resolution happens later (protocolHandler.ts) —
  // this parser stays pure with no config/filesystem access.
  if (repo && !REPO_SLUG_PATTERN.test(repo)) {
    throw new Error(
      `Invalid repo in deep link: expected "owner/repo", got "${repo}"`,
    )
  }

  let query: string | undefined
  if (rawQuery && rawQuery.trim().length > 0) {
    // Strip hidden Unicode characters (ASCII smuggling / hidden prompt injection)
    query = partiallySanitizeUnicode(rawQuery.trim())
    if (containsControlChars(query)) {
      throw new Error('Deep link query contains disallowed control characters')
    }
    if (query.length > MAX_QUERY_LENGTH) {
      throw new Error(
        `Deep link query exceeds ${MAX_QUERY_LENGTH} characters (got ${query.length})`,
      )
    }
  }

  return { query, cwd, repo }
}

/**
 * Build a claude-cli:// deep link URL.
 */
export function buildDeepLink(action: DeepLinkAction): string {
  const url = new URL(`${DEEP_LINK_PROTOCOL}://open`)
  if (action.query) {
    url.searchParams.set('q', action.query)
  }
  if (action.cwd) {
    url.searchParams.set('cwd', action.cwd)
  }
  if (action.repo) {
    url.searchParams.set('repo', action.repo)
  }
  return url.toString()
}
