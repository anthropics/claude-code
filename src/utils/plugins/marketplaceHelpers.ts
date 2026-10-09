import isEqual from 'lodash-es/isEqual.js'
import { toError } from '../errors.js'
import { logError } from '../log.js'
import { getSettingsForSource } from '../settings/settings.js'
import { plural } from '../stringUtils.js'
import { checkGitAvailable } from './gitAvailability.js'
import { getMarketplace } from './marketplaceManager.js'
import type { KnownMarketplace, MarketplaceSource } from './schemas.js'

/**
 * Format plugin failure details for user display
 * @param failures - Array of failures with names and reasons
 * @param includeReasons - Whether to include failure reasons (true for full errors, false for summaries)
 * @returns Formatted string like "plugin-a (reason); plugin-b (reason)" or "plugin-a, plugin-b"
 */
export function formatFailureDetails(
  failures: Array<{ name: string; reason?: string; error?: string }>,
  includeReasons: boolean,
): string {
  const maxShow = 2
  const details = failures
    .slice(0, maxShow)
    .map(f => {
      const reason = f.reason || f.error || 'unknown error'
      return includeReasons ? `${f.name} (${reason})` : f.name
    })
    .join(includeReasons ? '; ' : ', ')

  const remaining = failures.length - maxShow
  const moreText = remaining > 0 ? ` and ${remaining} more` : ''

  return `${details}${moreText}`
}

/**
 * Extract source display string from marketplace configuration
 */
export function getMarketplaceSourceDisplay(source: MarketplaceSource): string {
  switch (source.source) {
    case 'github':
      return source.repo
    case 'url':
      return source.url
    case 'git':
      return source.url
    case 'directory':
      return source.path
    case 'file':
      return source.path
    case 'settings':
      return `settings:${source.name}`
    default:
      return 'Unknown source'
  }
}

/**
 * Create a plugin ID from plugin name and marketplace name
 */
export function createPluginId(
  pluginName: string,
  marketplaceName: string,
): string {
  return `${pluginName}@${marketplaceName}`
}

/**
 * Load marketplaces with graceful degradation for individual failures.
 * Blocked marketplaces (per enterprise policy) are excluded from the results.
 */
export async function loadMarketplacesWithGracefulDegradation(
  config: Record<string, KnownMarketplace>,
): Promise<{
  marketplaces: Array<{
    name: string
    config: KnownMarketplace
    data: Awaited<ReturnType<typeof getMarketplace>> | null
  }>
  failures: Array<{ name: string; error: string }>
}> {
  const marketplaces: Array<{
    name: string
    config: KnownMarketplace
    data: Awaited<ReturnType<typeof getMarketplace>> | null
  }> = []
  const failures: Array<{ name: string; error: string }> = []

  for (const [name, marketplaceConfig] of Object.entries(config)) {
    // Skip marketplaces blocked by enterprise policy
    if (!isSourceAllowedByPolicy(marketplaceConfig.source)) {
      continue
    }

    let data = null
    try {
      data = await getMarketplace(name)
    } catch (err) {
      // Track individual marketplace failures but continue loading others
      const errorMessage = err instanceof Error ? err.message : String(err)
      failures.push({ name, error: errorMessage })

      // Log for monitoring
      logError(toError(err))
    }

    marketplaces.push({
      name,
      config: marketplaceConfig,
      data,
    })
  }

  return { marketplaces, failures }
}

/**
 * Format marketplace loading failures into appropriate user messages
 */
export function formatMarketplaceLoadingErrors(
  failures: Array<{ name: string; error: string }>,
  successCount: number,
): { type: 'warning' | 'error'; message: string } | null {
  if (failures.length === 0) {
    return null
  }

  // If some marketplaces succeeded, show warning
  if (successCount > 0) {
    const message =
      failures.length === 1
        ? `Warning: Failed to load marketplace '${failures[0]!.name}': ${failures[0]!.error}`
        : `Warning: Failed to load ${failures.length} marketplaces: ${formatFailureNames(failures)}`
    return { type: 'warning', message }
  }

  // All marketplaces failed - this is a critical error
  return {
    type: 'error',
    message: `Failed to load all marketplaces. Errors: ${formatFailureErrors(failures)}`,
  }
}

function formatFailureNames(
  failures: Array<{ name: string; error: string }>,
): string {
  return failures.map(f => f.name).join(', ')
}

function formatFailureErrors(
  failures: Array<{ name: string; error: string }>,
): string {
  return failures.map(f => `${f.name}: ${f.error}`).join('; ')
}

/**
 * Get the strict marketplace source allowlist from policy settings.
 * Returns null if no restriction is in place, or an array of allowed sources.
 */
export function getStrictKnownMarketplaces(): MarketplaceSource[] | null {
  const policySettings = getSettingsForSource('policySettings')
  if (!policySettings?.strictKnownMarketplaces) {
    return null // No restrictions
  }
  return policySettings.strictKnownMarketplaces
}

/**
 * Get the marketplace source blocklist from policy settings.
 * Returns null if no blocklist is in place, or an array of blocked sources.
 */
export function getBlockedMarketplaces(): MarketplaceSource[] | null {
  const policySettings = getSettingsForSource('policySettings')
  if (!policySettings?.blockedMarketplaces) {
    return null // No blocklist
  }
  return policySettings.blockedMarketplaces
}

/**
 * Get the custom plugin trust message from policy settings.
 * Returns undefined if not configured.
 */
export function getPluginTrustMessage(): string | undefined {
  return getSettingsForSource('policySettings')?.pluginTrustMessage
}

/**
 * Compare two MarketplaceSource objects for equality.
 * Sources are equal if they have the same type and all relevant fields match.
 */
function areSourcesEqual(a: MarketplaceSource, b: MarketplaceSource): boolean {
  if (a.source !== b.source) return false

  switch (a.source) {
    case 'url':
      return a.url === (b as typeof a).url
    case 'github':
      return (
        a.repo === (b as typeof a).repo &&
        (a.ref || undefined) === ((b as typeof a).ref || undefined) &&
        (a.path || undefined) === ((b as typeof a).path || undefined)
      )
    case 'git':
      return (
        a.url === (b as typeof a).url &&
        (a.ref || undefined) === ((b as typeof a).ref || undefined) &&
        (a.path || undefined) === ((b as typeof a).path || undefined)
      )
    case 'npm':
      return a.package === (b as typeof a).package
    case 'file':
      return a.path === (b as typeof a).path
    case 'directory':
      return a.path === (b as typeof a).path
    case 'settings':
      return (
        a.name === (b as typeof a).name &&
        isEqual(a.plugins, (b as typeof a).plugins)
      )
    default:
      return false
  }
}

/**
 * Extract the host/domain from a marketplace source.
 * Used for hostPattern matching in strictKnownMarketplaces.
 *
 * Currently only supports github, git, and url sources.
 * npm, file, and directory sources are not supported for hostPattern matching.
 *
 * @param source - The marketplace source to extract host from
 * @returns The hostname string, or null if extraction fails or source type not supported
 */
export function extractHostFromSource(
  source: MarketplaceSource,
): string | null {
  switch (source.source) {
    case 'github':
      // GitHub shorthand always means github.com
      return 'github.com'

    case 'git': {
      // SSH format: user@HOST:path (e.g., git@github.com:owner/repo.git)
      const sshMatch = source.url.match(/^[^@]+@([^:]+):/)
      if (sshMatch?.[1]) {
        return sshMatch[1]
      }
      // HTTPS format: extract hostname from URL
      try {
        return new URL(source.url).hostname
      } catch {
        return null
      }
    }

    case 'url':
      try {
        return new URL(source.url).hostname
      } catch {
        return null
      }

    // npm, file, directory, hostPattern, pathPattern sources are not supported for hostPattern matching
    default:
      return null
  }
}

/**
 * Check if a source matches a hostPattern entry.
 * Extracts the host from the source and tests it against the regex pattern.
 *
 * @param source - The marketplace source to check
 * @param pattern - The hostPattern entry from strictKnownMarketplaces
 * @returns true if the source's host matches the pattern
 */
function doesSourceMatchHostPattern(
  source: MarketplaceSource,
  pattern: MarketplaceSource & { source: 'hostPattern' },
): boolean {
  const host = extractHostFromSource(source)
  if (!host) {
    return false
  }

  try {
    const regex = new RegExp(pattern.hostPattern)
    return regex.test(host)
  } catch {
    // Invalid regex - log and return false
    logError(new Error(`Invalid hostPattern regex: ${pattern.hostPattern}`))
    return false
  }
}

/**
 * Check if a source matches a pathPattern entry.
 * Tests the source's .path (file and directory sources only) against the regex pattern.
 *
 * @param source - The marketplace source to check
 * @param pattern - The pathPattern entry from strictKnownMarketplaces
 * @returns true if the source's path matches the pattern
 */
function doesSourceMatchPathPattern(
  source: MarketplaceSource,
  pattern: MarketplaceSource & { source: 'pathPattern' },
): boolean {
  // Only file and directory sources have a .path to match against
  if (source.source !== 'file' && source.source !== 'directory') {
    return false
  }

  try {
    const regex = new RegExp(pattern.pathPattern)
    return regex.test(source.path)
  } catch {
    logError(new Error(`Invalid pathPattern regex: ${pattern.pathPattern}`))
    return false
  }
}

/**
 * Get hosts from hostPattern entries in the allowlist.
 * Used to provide helpful error messages.
 */
export function getHostPatternsFromAllowlist(): string[] {
  const allowlist = getStrictKnownMarketplaces()
  if (!allowlist) return []

  return allowlist
    .filter(
      (entry): entry is MarketplaceSource & { source: 'hostPattern' } =>
        entry.source === 'hostPattern',
    )
    .map(entry => entry.hostPattern)
}

/**
 * Extract GitHub owner/repo from a git URL if it's a GitHub URL.
 * Returns null if not a GitHub URL.
 *
 * Handles:
 * - git@github.com:owner/repo.git
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo
 */
function extractGitHubRepoFromGitUrl(url: string): string | null {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/)
  if (sshMatch && sshMatch[1]) {
    return sshMatch[1]
  }

  // HTTPS format: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/,
  )
  if (httpsMatch && httpsMatch[1]) {
    return httpsMatch[1]
  }

  return null
}

/**
 * Check if a blocked ref/path constraint matches a source.
 * If the blocklist entry has no ref/path, it matches ALL refs/paths (wildcard).
 * If the blocklist entry has a specific ref/path, it only matches that exact value.
 */
function blockedConstraintMatches(
  blockedValue: string | undefined,
  sourceValue: string | undefined,
): boolean {
  // If blocklist doesn't specify a constraint, it's a wildcard - matches anything
  if (!blockedValue) {
    return true
  }
  // If blocklist specifies a constraint, source must match exactly
  return (blockedValue || undefined) === (sourceValue || undefined)
}

/**
 * Check if two sources refer to the same GitHub repository, even if using
 * different source types (github vs git with GitHub URL).
 *
 * Blocklist matching is asymmetric:
 * - If blocklist entry has no ref/path, it blocks ALL refs/paths (wildcard)
 * - If blocklist entry has a specific ref/path, only that exact value is blocked
 */
function areSourcesEquivalentForBlocklist(
  source: MarketplaceSource,
  blocked: MarketplaceSource,
): boolean {
  // Check exact same source type
  if (source.source === blocked.source) {
    switch (source.source) {
      case 'github': {
        const b = blocked as typeof source
        if (source.repo !== b.repo) return false
        return (
          blockedConstraintMatches(b.ref, source.ref) &&
          blockedConstraintMatches(b.path, source.path)
        )
      }
      case 'git': {
        const b = blocked as typeof source
        if (source.url !== b.url) return false
        return (
          blockedConstraintMatches(b.ref, source.ref) &&
          blockedConstraintMatches(b.path, source.path)
        )
      }
      case 'url':
        return source.url === (blocked as typeof source).url
      case 'npm':
        return source.package === (blocked as typeof source).package
      case 'file':
        return source.path === (blocked as typeof source).path
      case 'directory':
        return source.path === (blocked as typeof source).path
      case 'settings':
        return source.name === (blocked as typeof source).name
      default:
        return false
    }
  }

  // Check if a git source matches a github blocklist entry
  if (source.source === 'git' && blocked.source === 'github') {
    const extractedRepo = extractGitHubRepoFromGitUrl(source.url)
    if (extractedRepo === blocked.repo) {
      return (
        blockedConstraintMatches(blocked.ref, source.ref) &&
        blockedConstraintMatches(blocked.path, source.path)
      )
    }
  }

  // Check if a github source matches a git blocklist entry (GitHub URL)
  if (source.source === 'github' && blocked.source === 'git') {
    const extractedRepo = extractGitHubRepoFromGitUrl(blocked.url)
    if (extractedRepo === source.repo) {
      return (
        blockedConstraintMatches(blocked.ref, source.ref) &&
        blockedConstraintMatches(blocked.path, source.path)
      )
    }
  }

  return false
}

/**
 * Check if a marketplace source is explicitly in the blocklist.
 * Used for error message differentiation.
 *
 * This also catches attempts to bypass a github blocklist entry by using
 * git URLs (e.g., git@github.com:owner/repo.git or https://github.com/owner/repo.git).
 */
export function isSourceInBlocklist(source: MarketplaceSource): boolean {
  const blocklist = getBlockedMarketplaces()
  if (blocklist === null) {
    return false
  }
  return blocklist.some(blocked =>
    areSourcesEquivalentForBlocklist(source, blocked),
  )
}

/**
 * Check if a marketplace source is allowed by enterprise policy.
 * Returns true if allowed (or no policy), false if blocked.
 * This check happens BEFORE downloading, so blocked sources never touch the filesystem.
 *
 * Policy precedence:
 * 1. blockedMarketplaces (blocklist) - if source matches, it's blocked
 * 2. strictKnownMarketplaces (allowlist) - if set, source must be in the list
 */
export function isSourceAllowedByPolicy(source: MarketplaceSource): boolean {
  // Check blocklist first (takes precedence)
  if (isSourceInBlocklist(source)) {
    return false
  }

  // Then check allowlist
  const allowlist = getStrictKnownMarketplaces()
  if (allowlist === null) {
    return true // No restrictions
  }

  // Check each entry in the allowlist
  return allowlist.some(allowed => {
    // Handle hostPattern entries - match by extracted host
    if (allowed.source === 'hostPattern') {
      return doesSourceMatchHostPattern(source, allowed)
    }
    // Handle pathPattern entries - match file/directory .path by regex
    if (allowed.source === 'pathPattern') {
      return doesSourceMatchPathPattern(source, allowed)
    }
    // Handle regular source entries - exact match
    return areSourcesEqual(source, allowed)
  })
}

/**
 * Format a MarketplaceSource for display in error messages
 */
export function formatSourceForDisplay(source: MarketplaceSource): string {
  switch (source.source) {
    case 'github':
      return `github:${source.repo}${source.ref ? `@${source.ref}` : ''}`
    case 'url':
      return source.url
    case 'git':
      return `git:${source.url}${source.ref ? `@${source.ref}` : ''}`
    case 'npm':
      return `npm:${source.package}`
    case 'file':
      return `file:${source.path}`
    case 'directory':
      return `dir:${source.path}`
    case 'hostPattern':
      return `hostPattern:${source.hostPattern}`
    case 'pathPattern':
      return `pathPattern:${source.pathPattern}`
    case 'settings':
      return `settings:${source.name} (${source.plugins.length} ${plural(source.plugins.length, 'plugin')})`
    default:
      return 'unknown source'
  }
}

/**
 * Reasons why no marketplaces are available in the Discover screen
 */
export type EmptyMarketplaceReason =
  | 'git-not-installed'
  | 'all-blocked-by-policy'
  | 'policy-restricts-sources'
  | 'all-marketplaces-failed'
  | 'no-marketplaces-configured'
  | 'all-plugins-installed'

/**
 * Detect why no marketplaces are available.
 * Checks in order of priority: git availability → policy restrictions → config state → failures
 */
export async function detectEmptyMarketplaceReason({
  configuredMarketplaceCount,
  failedMarketplaceCount,
}: {
  configuredMarketplaceCount: number
  failedMarketplaceCount: number
}): Promise<EmptyMarketplaceReason> {
  // Check if git is installed (required for most marketplace sources)
  const gitAvailable = await checkGitAvailable()
  if (!gitAvailable) {
    return 'git-not-installed'
  }

  // Check policy restrictions
  const allowlist = getStrictKnownMarketplaces()
  if (allowlist !== null) {
    if (allowlist.length === 0) {
      // Policy explicitly blocks all marketplaces
      return 'all-blocked-by-policy'
    }
    // Policy restricts which sources can be used
    if (configuredMarketplaceCount === 0) {
      return 'policy-restricts-sources'
    }
  }

  // Check if any marketplaces are configured
  if (configuredMarketplaceCount === 0) {
    return 'no-marketplaces-configured'
  }

  // Check if all configured marketplaces failed to load
  if (
    failedMarketplaceCount > 0 &&
    failedMarketplaceCount === configuredMarketplaceCount
  ) {
    return 'all-marketplaces-failed'
  }

  // Marketplaces are configured and loaded, but no plugins available
  // This typically means all plugins are already installed
  return 'all-plugins-installed'
}
