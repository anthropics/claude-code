import { getCwd } from './cwd.js'
import { logForDebugging } from './debug.js'
import { getRemoteUrl } from './git.js'

export type ParsedRepository = {
  host: string
  owner: string
  name: string
}

const repositoryWithHostCache = new Map<string, ParsedRepository | null>()

export function clearRepositoryCaches(): void {
  repositoryWithHostCache.clear()
}

export async function detectCurrentRepository(): Promise<string | null> {
  const result = await detectCurrentRepositoryWithHost()
  if (!result) return null
  // Only return results for github.com to avoid breaking downstream consumers
  // that assume the result is a github.com repository.
  // Use detectCurrentRepositoryWithHost() for GHE support.
  if (result.host !== 'github.com') return null
  return `${result.owner}/${result.name}`
}

/**
 * Like detectCurrentRepository, but also returns the host (e.g. "github.com"
 * or a GHE hostname). Callers that need to construct URLs against a specific
 * GitHub host should use this variant.
 */
export async function detectCurrentRepositoryWithHost(): Promise<ParsedRepository | null> {
  const cwd = getCwd()

  if (repositoryWithHostCache.has(cwd)) {
    return repositoryWithHostCache.get(cwd) ?? null
  }

  try {
    const remoteUrl = await getRemoteUrl()
    logForDebugging(`Git remote URL: ${remoteUrl}`)
    if (!remoteUrl) {
      logForDebugging('No git remote URL found')
      repositoryWithHostCache.set(cwd, null)
      return null
    }

    const parsed = parseGitRemote(remoteUrl)
    logForDebugging(
      `Parsed repository: ${parsed ? `${parsed.host}/${parsed.owner}/${parsed.name}` : null} from URL: ${remoteUrl}`,
    )
    repositoryWithHostCache.set(cwd, parsed)
    return parsed
  } catch (error) {
    logForDebugging(`Error detecting repository: ${error}`)
    repositoryWithHostCache.set(cwd, null)
    return null
  }
}

/**
 * Synchronously returns the cached github.com repository for the current cwd
 * as "owner/name", or null if it hasn't been resolved yet or the host is not
 * github.com. Call detectCurrentRepository() first to populate the cache.
 *
 * Callers construct github.com URLs, so GHE hosts are filtered out here.
 */
export function getCachedRepository(): string | null {
  const parsed = repositoryWithHostCache.get(getCwd())
  if (!parsed || parsed.host !== 'github.com') return null
  return `${parsed.owner}/${parsed.name}`
}

/**
 * Parses a git remote URL into host, owner, and name components.
 * Accepts any host (github.com, GHE instances, etc.).
 *
 * Supports:
 *   https://host/owner/repo.git
 *   git@host:owner/repo.git
 *   ssh://git@host/owner/repo.git
 *   git://host/owner/repo.git
 *   https://host/owner/repo (no .git)
 *
 * Note: repo names can contain dots (e.g., cc.kurs.web)
 */
export function parseGitRemote(input: string): ParsedRepository | null {
  const trimmed = input.trim()

  // SSH format: git@host:owner/repo.git
  const sshMatch = trimmed.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (sshMatch?.[1] && sshMatch[2] && sshMatch[3]) {
    if (!looksLikeRealHostname(sshMatch[1])) return null
    return {
      host: sshMatch[1],
      owner: sshMatch[2],
      name: sshMatch[3],
    }
  }

  // URL format: https://host/owner/repo.git, ssh://git@host/owner/repo, git://host/owner/repo
  const urlMatch = trimmed.match(
    /^(https?|ssh|git):\/\/(?:[^@]+@)?([^/:]+(?::\d+)?)\/([^/]+)\/([^/]+?)(?:\.git)?$/,
  )
  if (urlMatch?.[1] && urlMatch[2] && urlMatch[3] && urlMatch[4]) {
    const protocol = urlMatch[1]
    const hostWithPort = urlMatch[2]
    const hostWithoutPort = hostWithPort.split(':')[0] ?? ''
    if (!looksLikeRealHostname(hostWithoutPort)) return null
    // Only preserve port for HTTPS — SSH/git ports are not usable for constructing
    // web URLs (e.g. ssh://git@ghe.corp.com:2222 → port 2222 is SSH, not HTTPS).
    const host =
      protocol === 'https' || protocol === 'http'
        ? hostWithPort
        : hostWithoutPort
    return {
      host,
      owner: urlMatch[3],
      name: urlMatch[4],
    }
  }

  return null
}

/**
 * Parses a git remote URL or "owner/repo" string and returns "owner/repo".
 * Only returns results for github.com hosts — GHE URLs return null.
 * Use parseGitRemote() for GHE support.
 * Also accepts plain "owner/repo" strings for backward compatibility.
 */
export function parseGitHubRepository(input: string): string | null {
  const trimmed = input.trim()

  // Try parsing as a full remote URL first.
  // Only return results for github.com hosts — existing callers (VS Code extension,
  // bridge) assume this function is GitHub.com-specific. Use parseGitRemote() directly
  // for GHE support.
  const parsed = parseGitRemote(trimmed)
  if (parsed) {
    if (parsed.host !== 'github.com') return null
    return `${parsed.owner}/${parsed.name}`
  }

  // If no URL pattern matched, check if it's already in owner/repo format
  if (
    !trimmed.includes('://') &&
    !trimmed.includes('@') &&
    trimmed.includes('/')
  ) {
    const parts = trimmed.split('/')
    if (parts.length === 2 && parts[0] && parts[1]) {
      // Remove .git extension if present
      const repo = parts[1].replace(/\.git$/, '')
      return `${parts[0]}/${repo}`
    }
  }

  logForDebugging(`Could not parse repository from: ${trimmed}`)
  return null
}

/**
 * Checks whether a hostname looks like a real domain name rather than an
 * SSH config alias. A simple dot-check is not enough because aliases like
 * "github.com-work" still contain a dot. We additionally require that the
 * last segment (the TLD) is purely alphabetic — real TLDs (com, org, io, net)
 * never contain hyphens or digits.
 */
function looksLikeRealHostname(host: string): boolean {
  if (!host.includes('.')) return false
  const lastSegment = host.split('.').pop()
  if (!lastSegment) return false
  // Real TLDs are purely alphabetic (e.g., "com", "org", "io").
  // SSH aliases like "github.com-work" have a last segment "com-work" which
  // contains a hyphen.
  return /^[a-zA-Z]+$/.test(lastSegment)
}
