/**
 * Marketplace manager for Claude Code plugins
 *
 * This module provides functionality to:
 * - Manage known marketplace sources (URLs, GitHub repos, npm packages, local files)
 * - Cache marketplace manifests locally for offline access
 * - Install plugins from marketplace entries
 * - Track and update marketplace configurations
 *
 * File structure managed by this module:
 * ~/.claude/
 *   └── plugins/
 *       ├── known_marketplaces.json    # Configuration of all known marketplaces
 *       └── marketplaces/              # Cache directory for marketplace data
 *           ├── my-marketplace.json    # Cached marketplace from URL source
 *           └── github-marketplace/    # Cloned repository for GitHub source
 *               └── .claude-plugin/
 *                   └── marketplace.json
 */

import axios from 'axios'
import { writeFile } from 'fs/promises'
import isEqual from 'lodash-es/isEqual.js'
import memoize from 'lodash-es/memoize.js'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'path'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { logForDebugging } from '../debug.js'
import { isEnvTruthy } from '../envUtils.js'
import {
  ConfigParseError,
  errorMessage,
  getErrnoCode,
  isENOENT,
  toError,
} from '../errors.js'
import { execFileNoThrow, execFileNoThrowWithCwd } from '../execFileNoThrow.js'
import { getFsImplementation } from '../fsOperations.js'
import { gitExe } from '../git.js'
import { logError } from '../log.js'
import {
  getInitialSettings,
  getSettingsForSource,
  updateSettingsForSource,
} from '../settings/settings.js'
import type { SettingsJson } from '../settings/types.js'
import {
  jsonParse,
  jsonStringify,
  writeFileSync_DEPRECATED,
} from '../slowOperations.js'
import {
  getAddDirEnabledPlugins,
  getAddDirExtraMarketplaces,
} from './addDirPluginSettings.js'
import { markPluginVersionOrphaned } from './cacheUtils.js'
import { classifyFetchError, logPluginFetch } from './fetchTelemetry.js'
import { removeAllPluginsForMarketplace } from './installedPluginsManager.js'
import {
  extractHostFromSource,
  formatSourceForDisplay,
  getHostPatternsFromAllowlist,
  getStrictKnownMarketplaces,
  isSourceAllowedByPolicy,
  isSourceInBlocklist,
} from './marketplaceHelpers.js'
import {
  OFFICIAL_MARKETPLACE_NAME,
  OFFICIAL_MARKETPLACE_SOURCE,
} from './officialMarketplace.js'
import { fetchOfficialMarketplaceFromGcs } from './officialMarketplaceGcs.js'
import {
  deletePluginDataDir,
  getPluginSeedDirs,
  getPluginsDirectory,
} from './pluginDirectories.js'
import { parsePluginIdentifier } from './pluginIdentifier.js'
import { deletePluginOptions } from './pluginOptionsStorage.js'
import {
  isLocalMarketplaceSource,
  type KnownMarketplace,
  type KnownMarketplacesFile,
  KnownMarketplacesFileSchema,
  type MarketplaceSource,
  type PluginMarketplace,
  type PluginMarketplaceEntry,
  PluginMarketplaceSchema,
  validateOfficialNameSource,
} from './schemas.js'

/**
 * Result of loading and caching a marketplace
 */
type LoadedPluginMarketplace = {
  marketplace: PluginMarketplace
  cachePath: string
}

/**
 * Get the path to the known marketplaces configuration file
 * Using a function instead of a constant allows proper mocking in tests
 */
function getKnownMarketplacesFile(): string {
  return join(getPluginsDirectory(), 'known_marketplaces.json')
}

/**
 * Get the path to the marketplaces cache directory
 * Using a function instead of a constant allows proper mocking in tests
 */
export function getMarketplacesCacheDir(): string {
  return join(getPluginsDirectory(), 'marketplaces')
}

/**
 * Memoized inner function to get marketplace data.
 * This caches the marketplace in memory after loading from disk or network.
 */

/**
 * Clear all cached marketplace data (for testing)
 */
export function clearMarketplacesCache(): void {
  getMarketplace.cache?.clear?.()
}

/**
 * Configuration for known marketplaces
 */
export type KnownMarketplacesConfig = KnownMarketplacesFile

/**
 * Declared marketplace entry (intent layer).
 *
 * Structurally compatible with settings `extraKnownMarketplaces` entries, but
 * adds `sourceIsFallback` for implicit built-in declarations. This is NOT a
 * settings-schema field — it's only ever set in code (never parsed from JSON).
 */
export type DeclaredMarketplace = {
  source: MarketplaceSource
  installLocation?: string
  autoUpdate?: boolean
  /**
   * Presence suffices. When set, diffMarketplaces treats an already-materialized
   * entry as upToDate regardless of source shape — never reports sourceChanged.
   *
   * Used for the implicit official-marketplace declaration: we want "clone from
   * GitHub if missing", not "replace with GitHub if present under a different
   * source". Without this, a seed dir that registers the official marketplace
   * under e.g. an internal-mirror source would be stomped by a GitHub re-clone.
   */
  sourceIsFallback?: boolean
}

/**
 * Get declared marketplace intent from merged settings and --add-dir sources.
 * This is what SHOULD exist — used by the reconciler to find gaps.
 *
 * The official marketplace is implicitly declared with `sourceIsFallback: true`
 * when any enabled plugin references it.
 */
export function getDeclaredMarketplaces(): Record<string, DeclaredMarketplace> {
  const implicit: Record<string, DeclaredMarketplace> = {}

  // Only the official marketplace can be implicitly declared — it's the one
  // built-in source we know. Other marketplaces have no default source to inject.
  // Explicitly-disabled entries (value: false) don't count.
  const enabledPlugins = {
    ...getAddDirEnabledPlugins(),
    ...(getInitialSettings().enabledPlugins ?? {}),
  }
  for (const [pluginId, value] of Object.entries(enabledPlugins)) {
    if (
      value &&
      parsePluginIdentifier(pluginId).marketplace === OFFICIAL_MARKETPLACE_NAME
    ) {
      implicit[OFFICIAL_MARKETPLACE_NAME] = {
        source: OFFICIAL_MARKETPLACE_SOURCE,
        sourceIsFallback: true,
      }
      break
    }
  }

  // Lowest precedence: implicit < --add-dir < merged settings.
  // An explicit extraKnownMarketplaces entry for claude-plugins-official
  // in --add-dir or settings wins.
  return {
    ...implicit,
    ...getAddDirExtraMarketplaces(),
    ...(getInitialSettings().extraKnownMarketplaces ?? {}),
  }
}

/**
 * Find which editable settings source declared a marketplace.
 * Checks in reverse precedence order (highest priority last) so the
 * result is the source that "wins" in the merged view.
 * Returns null if the marketplace isn't declared in any editable source.
 */
export function getMarketplaceDeclaringSource(
  name: string,
): 'userSettings' | 'projectSettings' | 'localSettings' | null {
  // Check highest-precedence editable sources first — the one that wins
  // in the merged view is the one we should write back to.
  const editableSources: Array<
    'localSettings' | 'projectSettings' | 'userSettings'
  > = ['localSettings', 'projectSettings', 'userSettings']

  for (const source of editableSources) {
    const settings = getSettingsForSource(source)
    if (settings?.extraKnownMarketplaces?.[name]) {
      return source
    }
  }
  return null
}

/**
 * Save a marketplace entry to settings (intent layer).
 * Does NOT touch known_marketplaces.json (state layer).
 *
 * @param name - The marketplace name
 * @param entry - The marketplace config
 * @param settingSource - Which settings source to write to (defaults to userSettings)
 */
export function saveMarketplaceToSettings(
  name: string,
  entry: DeclaredMarketplace,
  settingSource:
    | 'userSettings'
    | 'projectSettings'
    | 'localSettings' = 'userSettings',
): void {
  const existing = getSettingsForSource(settingSource) ?? {}
  const current = { ...existing.extraKnownMarketplaces }
  current[name] = entry
  updateSettingsForSource(settingSource, { extraKnownMarketplaces: current })
}

/**
 * Load known marketplaces configuration from disk
 *
 * Reads the configuration file at ~/.claude/plugins/known_marketplaces.json
 * which contains a mapping of marketplace names to their sources and metadata.
 *
 * Example configuration file content:
 * ```json
 * {
 *   "official-marketplace": {
 *     "source": { "source": "url", "url": "https://example.com/marketplace.json" },
 *     "installLocation": "/Users/me/.claude/plugins/marketplaces/official-marketplace.json",
 *     "lastUpdated": "2024-01-15T10:30:00.000Z"
 *   },
 *   "company-plugins": {
 *     "source": { "source": "github", "repo": "mycompany/plugins" },
 *     "installLocation": "/Users/me/.claude/plugins/marketplaces/company-plugins",
 *     "lastUpdated": "2024-01-14T15:45:00.000Z"
 *   }
 * }
 * ```
 *
 * @returns Configuration object mapping marketplace names to their metadata
 */
export async function loadKnownMarketplacesConfig(): Promise<KnownMarketplacesConfig> {
  const fs = getFsImplementation()
  const configFile = getKnownMarketplacesFile()

  try {
    const content = await fs.readFile(configFile, {
      encoding: 'utf-8',
    })
    const data = jsonParse(content)
    // Validate against schema
    const parsed = KnownMarketplacesFileSchema().safeParse(data)
    if (!parsed.success) {
      const errorMsg = `Marketplace configuration file is corrupted: ${parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      logForDebugging(errorMsg, {
        level: 'error',
      })
      throw new ConfigParseError(errorMsg, configFile, data)
    }
    return parsed.data
  } catch (error) {
    if (isENOENT(error)) {
      return {}
    }
    // If it's already a ConfigParseError, re-throw it
    if (error instanceof ConfigParseError) {
      throw error
    }
    // For JSON parse errors or I/O errors, throw with helpful message
    const errorMsg = `Failed to load marketplace configuration: ${errorMessage(error)}`
    logForDebugging(errorMsg, {
      level: 'error',
    })
    throw new Error(errorMsg)
  }
}

/**
 * Load known marketplaces config, returning {} on any error instead of throwing.
 *
 * Use this on read-only paths (plugin loading, feature checks) where a corrupted
 * config should degrade gracefully rather than crash. DO NOT use on load→mutate→save
 * paths — returning {} there would cause the save to overwrite the corrupted file
 * with just the new entry, permanently destroying the user's other entries. The
 * throwing variant preserves the file so the user can fix the corruption and recover.
 */
export async function loadKnownMarketplacesConfigSafe(): Promise<KnownMarketplacesConfig> {
  try {
    return await loadKnownMarketplacesConfig()
  } catch {
    // Inner function already logged via logForDebugging. Don't logError here —
    // corrupted user config isn't a Claude Code bug, shouldn't hit the error file.
    return {}
  }
}

/**
 * Save known marketplaces configuration to disk
 *
 * Writes the configuration to ~/.claude/plugins/known_marketplaces.json,
 * creating the directory structure if it doesn't exist.
 *
 * @param config - The marketplace configuration to save
 */
export async function saveKnownMarketplacesConfig(
  config: KnownMarketplacesConfig,
): Promise<void> {
  // Validate before saving
  const parsed = KnownMarketplacesFileSchema().safeParse(config)
  const configFile = getKnownMarketplacesFile()

  if (!parsed.success) {
    throw new ConfigParseError(
      `Invalid marketplace config: ${parsed.error.message}`,
      configFile,
      config,
    )
  }

  const fs = getFsImplementation()
  // Get directory from config file path to ensure consistency
  const dir = join(configFile, '..')
  await fs.mkdir(dir)
  writeFileSync_DEPRECATED(configFile, jsonStringify(parsed.data, null, 2), {
    encoding: 'utf-8',
    flush: true,
  })
}

/**
 * Register marketplaces from the read-only seed directories into the primary
 * known_marketplaces.json.
 *
 * The seed's known_marketplaces.json contains installLocation paths pointing
 * into the seed dir itself. Registering those entries into the primary JSON
 * makes them visible to all marketplace readers (getMarketplaceCacheOnly,
 * getPluginByIdCacheOnly, etc.) without any loader changes — they just follow
 * the installLocation wherever it points.
 *
 * Seed entries always win for marketplaces declared in the seed — the seed is
 * admin-managed (baked into the container image). If admin updates the seed
 * in a new image, those changes propagate on next boot. Users opt out of seed
 * plugins via `plugin disable`, not by removing the marketplace.
 *
 * With multiple seed dirs (path-delimiter-separated), first-seed-wins: a
 * marketplace name claimed by an earlier seed is skipped by later seeds.
 *
 * autoUpdate is forced to false since the seed is read-only and git-pull would
 * fail. installLocation is computed from the runtime seedDir, not trusted from
 * the seed's JSON (handles multi-stage Docker mount-path drift).
 *
 * Idempotent: second call with unchanged seed writes nothing.
 *
 * @returns true if any marketplace entries were written/changed (caller should
 *   clear caches so earlier plugin-load passes don't keep stale "marketplace
 *   not found" state)
 */
export async function registerSeedMarketplaces(): Promise<boolean> {
  const seedDirs = getPluginSeedDirs()
  if (seedDirs.length === 0) return false

  const primary = await loadKnownMarketplacesConfig()
  // First-seed-wins across this registration pass. Can't use the isEqual check
  // alone — two seeds with the same name will have different installLocations.
  const claimed = new Set<string>()
  let changed = 0

  for (const seedDir of seedDirs) {
    const seedConfig = await readSeedKnownMarketplaces(seedDir)
    if (!seedConfig) continue

    for (const [name, seedEntry] of Object.entries(seedConfig)) {
      if (claimed.has(name)) continue

      // Compute installLocation relative to THIS seedDir, not the build-time
      // path baked into the seed's JSON. Handles multi-stage Docker builds
      // where the seed is mounted at a different path than where it was built.
      const resolvedLocation = await findSeedMarketplaceLocation(seedDir, name)
      if (!resolvedLocation) {
        // Seed content missing (incomplete build) — leave primary alone, but
        // don't claim the name either: a later seed may have working content.
        logForDebugging(
          `Seed marketplace '${name}' not found under ${seedDir}/marketplaces/, skipping`,
          { level: 'warn' },
        )
        continue
      }
      claimed.add(name)

      const desired: KnownMarketplace = {
        source: seedEntry.source,
        installLocation: resolvedLocation,
        lastUpdated: seedEntry.lastUpdated,
        autoUpdate: false,
      }

      // Skip if primary already matches — idempotent no-op, no write.
      if (isEqual(primary[name], desired)) continue

      // Seed wins — admin-managed. Overwrite any existing primary entry.
      primary[name] = desired
      changed++
    }
  }

  if (changed > 0) {
    await saveKnownMarketplacesConfig(primary)
    logForDebugging(`Synced ${changed} marketplace(s) from seed dir(s)`)
    return true
  }
  return false
}

async function readSeedKnownMarketplaces(
  seedDir: string,
): Promise<KnownMarketplacesConfig | null> {
  const seedJsonPath = join(seedDir, 'known_marketplaces.json')
  try {
    const content = await getFsImplementation().readFile(seedJsonPath, {
      encoding: 'utf-8',
    })
    const parsed = KnownMarketplacesFileSchema().safeParse(jsonParse(content))
    if (!parsed.success) {
      logForDebugging(
        `Seed known_marketplaces.json invalid at ${seedDir}: ${parsed.error.message}`,
        { level: 'warn' },
      )
      return null
    }
    return parsed.data
  } catch (e) {
    if (!isENOENT(e)) {
      logForDebugging(
        `Failed to read seed known_marketplaces.json at ${seedDir}: ${e}`,
        { level: 'warn' },
      )
    }
    return null
  }
}

/**
 * Locate a marketplace in the seed directory by name.
 *
 * Probes the canonical locations under seedDir/marketplaces/ rather than
 * trusting the seed's stored installLocation (which may have a stale absolute
 * path from a different build-time mount point).
 *
 * @returns Readable location, or null if neither format exists/validates
 */
async function findSeedMarketplaceLocation(
  seedDir: string,
  name: string,
): Promise<string | null> {
  const dirCandidate = join(seedDir, 'marketplaces', name)
  const jsonCandidate = join(seedDir, 'marketplaces', `${name}.json`)
  for (const candidate of [dirCandidate, jsonCandidate]) {
    try {
      await readCachedMarketplace(candidate)
      return candidate
    } catch {
      // Try next candidate
    }
  }
  return null
}

/**
 * If installLocation points into a configured seed directory, return that seed
 * directory. Seed-managed entries are admin-controlled — users can't
 * remove/refresh/modify them (they'd be overwritten by registerSeedMarketplaces
 * on next startup). Returning the specific seed lets error messages name it.
 */
function seedDirFor(installLocation: string): string | undefined {
  return getPluginSeedDirs().find(
    d => installLocation === d || installLocation.startsWith(d + sep),
  )
}

/**
 * Git pull operation (exported for testing)
 *
 * Pulls latest changes with a configurable timeout (default 120s, override via CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS).
 * Provides helpful error messages for common failure scenarios.
 * If a ref is specified, fetches and checks out that specific branch or tag.
 */
// Environment variables to prevent git from prompting for credentials
const GIT_NO_PROMPT_ENV = {
  GIT_TERMINAL_PROMPT: '0', // Prevent terminal credential prompts
  GIT_ASKPASS: '', // Disable askpass GUI programs
}

const DEFAULT_PLUGIN_GIT_TIMEOUT_MS = 120 * 1000

function getPluginGitTimeoutMs(): number {
  const envValue = process.env.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS
  if (envValue) {
    const parsed = parseInt(envValue, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return DEFAULT_PLUGIN_GIT_TIMEOUT_MS
}

export async function gitPull(
  cwd: string,
  ref?: string,
  options?: { disableCredentialHelper?: boolean; sparsePaths?: string[] },
): Promise<{ code: number; stderr: string }> {
  logForDebugging(`git pull: cwd=${cwd} ref=${ref ?? 'default'}`)
  const env = { ...process.env, ...GIT_NO_PROMPT_ENV }
  const credentialArgs = options?.disableCredentialHelper
    ? ['-c', 'credential.helper=']
    : []

  if (ref) {
    const fetchResult = await execFileNoThrowWithCwd(
      gitExe(),
      [...credentialArgs, 'fetch', 'origin', ref],
      { cwd, timeout: getPluginGitTimeoutMs(), stdin: 'ignore', env },
    )

    if (fetchResult.code !== 0) {
      return enhanceGitPullErrorMessages(fetchResult)
    }

    const checkoutResult = await execFileNoThrowWithCwd(
      gitExe(),
      [...credentialArgs, 'checkout', ref],
      { cwd, timeout: getPluginGitTimeoutMs(), stdin: 'ignore', env },
    )

    if (checkoutResult.code !== 0) {
      return enhanceGitPullErrorMessages(checkoutResult)
    }

    const pullResult = await execFileNoThrowWithCwd(
      gitExe(),
      [...credentialArgs, 'pull', 'origin', ref],
      { cwd, timeout: getPluginGitTimeoutMs(), stdin: 'ignore', env },
    )
    if (pullResult.code !== 0) {
      return enhanceGitPullErrorMessages(pullResult)
    }
    await gitSubmoduleUpdate(cwd, credentialArgs, env, options?.sparsePaths)
    return pullResult
  }

  const result = await execFileNoThrowWithCwd(
    gitExe(),
    [...credentialArgs, 'pull', 'origin', 'HEAD'],
    { cwd, timeout: getPluginGitTimeoutMs(), stdin: 'ignore', env },
  )
  if (result.code !== 0) {
    return enhanceGitPullErrorMessages(result)
  }
  await gitSubmoduleUpdate(cwd, credentialArgs, env, options?.sparsePaths)
  return result
}

/**
 * Sync submodule working dirs after a successful pull. gitClone() uses
 * --recurse-submodules, but gitPull() didn't — the parent repo's submodule
 * pointer would advance while the working dir stayed at the old commit,
 * making plugin sources in submodules unresolvable after marketplace update.
 * Non-fatal: a failed submodule update logs a warning; most marketplaces
 * don't use submodules at all. (gh-30696)
 *
 * Skipped for sparse clones — gitClone's sparse path intentionally omits
 * --recurse-submodules to preserve partial-clone bandwidth savings, and
 * .gitmodules is a root file that cone-mode sparse-checkout always
 * materializes, so the .gitmodules gate alone can't distinguish sparse repos.
 *
 * Perf: git-submodule is a bash script that spawns ~20 subprocesses (~35ms+)
 * even when no submodules exist. .gitmodules is a tracked file — pull
 * materializes it iff the repo has submodules — so gate on its presence to
 * skip the spawn for the common case.
 *
 * --init performs first-contact clone of newly-added submodules, so maintain
 * parity with gitClone's non-sparse path: StrictHostKeyChecking=yes for
 * fail-closed SSH (unknown hosts reject rather than silently populate
 * known_hosts), and --depth 1 for shallow clone (matching --shallow-submodules).
 * --depth only affects not-yet-initialized submodules; existing shallow
 * submodules are unaffected.
 */
async function gitSubmoduleUpdate(
  cwd: string,
  credentialArgs: string[],
  env: NodeJS.ProcessEnv,
  sparsePaths: string[] | undefined,
): Promise<void> {
  if (sparsePaths && sparsePaths.length > 0) return
  const hasGitmodules = await getFsImplementation()
    .stat(join(cwd, '.gitmodules'))
    .then(
      () => true,
      () => false,
    )
  if (!hasGitmodules) return
  const result = await execFileNoThrowWithCwd(
    gitExe(),
    [
      '-c',
      'core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes',
      ...credentialArgs,
      'submodule',
      'update',
      '--init',
      '--recursive',
      '--depth',
      '1',
    ],
    { cwd, timeout: getPluginGitTimeoutMs(), stdin: 'ignore', env },
  )
  if (result.code !== 0) {
    logForDebugging(
      `git submodule update failed (non-fatal): ${result.stderr}`,
      { level: 'warn' },
    )
  }
}

/**
 * Enhance error messages for git pull failures
 */
function enhanceGitPullErrorMessages(result: {
  code: number
  stderr: string
  error?: string
}): { code: number; stderr: string } {
  if (result.code === 0) {
    return result
  }

  // Detect execa timeout kills via the error field (stderr won't contain "timed out"
  // when the process is killed by SIGTERM — the timeout info is only in error)
  if (result.error?.includes('timed out')) {
    const timeoutSec = Math.round(getPluginGitTimeoutMs() / 1000)
    return {
      ...result,
      stderr: `Git pull timed out after ${timeoutSec}s. Try increasing the timeout via CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS environment variable.\n\nOriginal error: ${result.stderr}`,
    }
  }

  // Detect SSH host key verification failures (check before the generic
  // 'Could not read from remote' catch — that string appears in both cases).
  // OpenSSH emits "Host key verification failed" for BOTH host-not-in-known_hosts
  // and host-key-has-changed — the latter also includes the "REMOTE HOST
  // IDENTIFICATION HAS CHANGED" banner, which needs different remediation.
  if (result.stderr.includes('REMOTE HOST IDENTIFICATION HAS CHANGED')) {
    return {
      ...result,
      stderr: `SSH host key for this marketplace's git host has changed (server key rotation or possible MITM). Remove the stale entry with: ssh-keygen -R <host>\nThen connect once manually to accept the new key.\n\nOriginal error: ${result.stderr}`,
    }
  }
  if (result.stderr.includes('Host key verification failed')) {
    return {
      ...result,
      stderr: `SSH host key verification failed while updating marketplace. The host key is not in your known_hosts file. Connect once manually to add it (e.g., ssh -T git@<host>), or remove and re-add the marketplace with an HTTPS URL.\n\nOriginal error: ${result.stderr}`,
    }
  }

  // Detect SSH authentication failures
  if (
    result.stderr.includes('Permission denied (publickey)') ||
    result.stderr.includes('Could not read from remote repository')
  ) {
    return {
      ...result,
      stderr: `SSH authentication failed while updating marketplace. Please ensure your SSH keys are configured.\n\nOriginal error: ${result.stderr}`,
    }
  }

  // Detect network issues
  if (
    result.stderr.includes('timed out') ||
    result.stderr.includes('Could not resolve host')
  ) {
    return {
      ...result,
      stderr: `Network error while updating marketplace. Please check your internet connection.\n\nOriginal error: ${result.stderr}`,
    }
  }

  return result
}

/**
 * Check if SSH is likely to work for GitHub
 * This is a quick heuristic check that avoids the full clone timeout
 *
 * Uses StrictHostKeyChecking=yes (not accept-new) so an unknown github.com
 * host key fails closed rather than being silently added to known_hosts.
 * This prevents a network-level MITM from poisoning known_hosts on first
 * contact. Users who already have github.com in known_hosts see no change;
 * users who don't are routed to the HTTPS clone path.
 *
 * @returns true if SSH auth succeeds and github.com is already trusted
 */
async function isGitHubSshLikelyConfigured(): Promise<boolean> {
  try {
    // Quick SSH connection test with 2 second timeout
    // This fails fast if SSH isn't configured
    const result = await execFileNoThrow(
      'ssh',
      [
        '-T',
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=2',
        '-o',
        'StrictHostKeyChecking=yes',
        'git@github.com',
      ],
      {
        timeout: 3000, // 3 second total timeout
      },
    )

    // SSH to github.com always returns exit code 1 with "successfully authenticated"
    // or exit code 255 with "Permission denied" - we want the former
    const configured =
      result.code === 1 &&
      (result.stderr?.includes('successfully authenticated') ||
        result.stdout?.includes('successfully authenticated'))
    logForDebugging(
      `SSH config check: code=${result.code} configured=${configured}`,
    )
    return configured
  } catch (error) {
    // Any error means SSH isn't configured properly
    logForDebugging(`SSH configuration check failed: ${errorMessage(error)}`, {
      level: 'warn',
    })
    return false
  }
}

/**
 * Check if a git error indicates authentication failure.
 * Used to provide enhanced error messages for auth failures.
 */
function isAuthenticationError(stderr: string): boolean {
  return (
    stderr.includes('Authentication failed') ||
    stderr.includes('could not read Username') ||
    stderr.includes('terminal prompts disabled') ||
    stderr.includes('403') ||
    stderr.includes('401')
  )
}

/**
 * Extract the SSH host from a git URL for error messaging.
 * Matches the SSH format user@host:path (e.g., git@github.com:owner/repo.git).
 */
function extractSshHost(gitUrl: string): string | null {
  const match = gitUrl.match(/^[^@]+@([^:]+):/)
  return match?.[1] ?? null
}

/**
 * Git clone operation (exported for testing)
 *
 * Clones a git repository with a configurable timeout (default 120s, override via CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS)
 * and larger repositories. Provides helpful error messages for common failure scenarios.
 * Optionally checks out a specific branch or tag.
 *
 * Does NOT disable credential helpers — this allows the user's existing auth setup
 * (gh auth, keychain, git-credential-store, etc.) to work natively for private repos.
 * Interactive prompts are still prevented via GIT_TERMINAL_PROMPT=0, GIT_ASKPASS='',
 * stdin: 'ignore', and BatchMode=yes for SSH.
 *
 * Uses StrictHostKeyChecking=yes (not accept-new): unknown SSH hosts fail closed
 * with a clear message rather than being silently trusted on first contact. For
 * the github source type, the preflight check routes unknown-host users to HTTPS
 * automatically; for explicit git@host:… URLs, users see an actionable error.
 */
export async function gitClone(
  gitUrl: string,
  targetPath: string,
  ref?: string,
  sparsePaths?: string[],
): Promise<{ code: number; stderr: string }> {
  const useSparse = sparsePaths && sparsePaths.length > 0
  const args = [
    '-c',
    'core.sshCommand=ssh -o BatchMode=yes -o StrictHostKeyChecking=yes',
    'clone',
    '--depth',
    '1',
  ]

  if (useSparse) {
    // Partial clone: skip blob download until checkout, defer checkout until
    // after sparse-checkout is configured. Submodules are intentionally dropped
    // for sparse clones — sparse monorepos rarely need them, and recursing
    // submodules would defeat the partial-clone bandwidth savings.
    args.push('--filter=blob:none', '--no-checkout')
  } else {
    args.push('--recurse-submodules', '--shallow-submodules')
  }

  if (ref) {
    args.push('--branch', ref)
  }

  args.push(gitUrl, targetPath)

  const timeoutMs = getPluginGitTimeoutMs()
  logForDebugging(
    `git clone: url=${redactUrlCredentials(gitUrl)} ref=${ref ?? 'default'} timeout=${timeoutMs}ms`,
  )

  const result = await execFileNoThrowWithCwd(gitExe(), args, {
    timeout: timeoutMs,
    stdin: 'ignore',
    env: { ...process.env, ...GIT_NO_PROMPT_ENV },
  })

  // Scrub credentials from execa's error/stderr fields before any logging or
  // returning. execa's shortMessage embeds the full command line (including
  // the credentialed URL), and result.stderr may also contain it on some git
  // versions.
  const redacted = redactUrlCredentials(gitUrl)
  if (gitUrl !== redacted) {
    if (result.error) result.error = result.error.replaceAll(gitUrl, redacted)
    if (result.stderr)
      result.stderr = result.stderr.replaceAll(gitUrl, redacted)
  }

  if (result.code === 0) {
    if (useSparse) {
      // Configure the sparse cone, then materialize only those paths.
      // `sparse-checkout set --cone` handles both init and path selection
      // in a single step on git >= 2.25.
      const sparseResult = await execFileNoThrowWithCwd(
        gitExe(),
        ['sparse-checkout', 'set', '--cone', '--', ...sparsePaths],
        {
          cwd: targetPath,
          timeout: timeoutMs,
          stdin: 'ignore',
          env: { ...process.env, ...GIT_NO_PROMPT_ENV },
        },
      )
      if (sparseResult.code !== 0) {
        return {
          code: sparseResult.code,
          stderr: `git sparse-checkout set failed: ${sparseResult.stderr}`,
        }
      }

      const checkoutResult = await execFileNoThrowWithCwd(
        gitExe(),
        // ref was already passed to clone via --branch, so HEAD points to it;
        // if no ref, HEAD points to the remote's default branch.
        ['checkout', 'HEAD'],
        {
          cwd: targetPath,
          timeout: timeoutMs,
          stdin: 'ignore',
          env: { ...process.env, ...GIT_NO_PROMPT_ENV },
        },
      )
      if (checkoutResult.code !== 0) {
        return {
          code: checkoutResult.code,
          stderr: `git checkout after sparse-checkout failed: ${checkoutResult.stderr}`,
        }
      }
    }
    logForDebugging(`git clone succeeded: ${redactUrlCredentials(gitUrl)}`)
    return result
  }

  logForDebugging(
    `git clone failed: url=${redactUrlCredentials(gitUrl)} code=${result.code} error=${result.error ?? 'none'} stderr=${result.stderr}`,
    { level: 'warn' },
  )

  // Detect timeout kills — when execFileNoThrowWithCwd kills the process via SIGTERM,
  // stderr may only contain partial output (e.g. "Cloning into '...'") with no
  // "timed out" string. Check the error field from execa which contains the
  // timeout message.
  if (result.error?.includes('timed out')) {
    return {
      ...result,
      stderr: `Git clone timed out after ${Math.round(timeoutMs / 1000)}s. The repository may be too large for the current timeout. Set CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS to increase it (e.g., 300000 for 5 minutes).\n\nOriginal error: ${result.stderr}`,
    }
  }

  // Enhance error messages for common scenarios
  if (result.stderr) {
    // Host key verification failure — check FIRST, before the generic
    // 'Could not read from remote repository' catch (that string appears
    // in both stderr outputs, so order matters). OpenSSH emits
    // "Host key verification failed" for BOTH host-not-in-known_hosts and
    // host-key-has-changed; distinguish them by the key-change banner.
    if (result.stderr.includes('REMOTE HOST IDENTIFICATION HAS CHANGED')) {
      const host = extractSshHost(gitUrl)
      const removeHint = host ? `ssh-keygen -R ${host}` : 'ssh-keygen -R <host>'
      return {
        ...result,
        stderr: `SSH host key has changed (server key rotation or possible MITM). Remove the stale known_hosts entry:\n  ${removeHint}\nThen connect once manually to verify and accept the new key.\n\nOriginal error: ${result.stderr}`,
      }
    }
    if (result.stderr.includes('Host key verification failed')) {
      const host = extractSshHost(gitUrl)
      const connectHint = host ? `ssh -T git@${host}` : 'ssh -T git@<host>'
      return {
        ...result,
        stderr: `SSH host key is not in your known_hosts file. To add it, connect once manually (this will show the fingerprint for you to verify):\n  ${connectHint}\n\nOr use an HTTPS URL instead (recommended for public repos).\n\nOriginal error: ${result.stderr}`,
      }
    }

    if (
      result.stderr.includes('Permission denied (publickey)') ||
      result.stderr.includes('Could not read from remote repository')
    ) {
      return {
        ...result,
        stderr: `SSH authentication failed. Please ensure your SSH keys are configured for GitHub, or use an HTTPS URL instead.\n\nOriginal error: ${result.stderr}`,
      }
    }

    if (isAuthenticationError(result.stderr)) {
      return {
        ...result,
        stderr: `HTTPS authentication failed. Please ensure your credential helper is configured (e.g., gh auth login).\n\nOriginal error: ${result.stderr}`,
      }
    }

    if (
      result.stderr.includes('timed out') ||
      result.stderr.includes('timeout') ||
      result.stderr.includes('Could not resolve host')
    ) {
      return {
        ...result,
        stderr: `Network error or timeout while cloning repository. Please check your internet connection and try again.\n\nOriginal error: ${result.stderr}`,
      }
    }
  }

  // Fallback for empty stderr — gh-28373: user saw "Failed to clone
  // marketplace repository:" with nothing after the colon. Git CAN fail
  // without writing to stderr (stdout instead, or output swallowed by
  // credential helper / signal). execa's error field has the execa-level
  // message (command, exit code, signal); exit code is the minimum.
  if (!result.stderr) {
    return {
      code: result.code,
      stderr:
        result.error ||
        `git clone exited with code ${result.code} (no stderr output). Run with --debug to see the full command.`,
    }
  }

  return result
}

/**
 * Progress callback for marketplace operations.
 *
 * This callback is invoked at various stages during marketplace operations
 * (downloading, git operations, validation, etc.) to provide user feedback.
 *
 * IMPORTANT: Implementations should handle errors internally and not throw exceptions.
 * If a callback throws, it will be caught and logged but won't abort the operation.
 *
 * @param message - Human-readable progress message to display to the user
 */
export type MarketplaceProgressCallback = (message: string) => void

/**
 * Safely invoke a progress callback, catching and logging any errors.
 * Prevents callback errors from aborting marketplace operations.
 *
 * @param onProgress - The progress callback to invoke
 * @param message - Progress message to pass to the callback
 */
function safeCallProgress(
  onProgress: MarketplaceProgressCallback | undefined,
  message: string,
): void {
  if (!onProgress) return
  try {
    onProgress(message)
  } catch (callbackError) {
    logForDebugging(`Progress callback error: ${errorMessage(callbackError)}`, {
      level: 'warn',
    })
  }
}

/**
 * Reconcile the on-disk sparse-checkout state with the desired config.
 *
 * Runs before gitPull to handle transitions:
 * - Full→Sparse or SparseA→SparseB: run `sparse-checkout set --cone` (idempotent)
 * - Sparse→Full: return non-zero so caller falls back to rm+reclone. Avoids
 *   `sparse-checkout disable` on a --filter=blob:none partial clone, which would
 *   trigger a lazy fetch of every blob in the monorepo.
 * - Full→Full (common case): single local `git config --get` check, no-op.
 *
 * Failures here (ENOENT, not a repo) are harmless — gitPull will also fail and
 * trigger the clone path, which establishes the correct state from scratch.
 */
export async function reconcileSparseCheckout(
  cwd: string,
  sparsePaths: string[] | undefined,
): Promise<{ code: number; stderr: string }> {
  const env = { ...process.env, ...GIT_NO_PROMPT_ENV }

  if (sparsePaths && sparsePaths.length > 0) {
    return execFileNoThrowWithCwd(
      gitExe(),
      ['sparse-checkout', 'set', '--cone', '--', ...sparsePaths],
      { cwd, timeout: getPluginGitTimeoutMs(), stdin: 'ignore', env },
    )
  }

  const check = await execFileNoThrowWithCwd(
    gitExe(),
    ['config', '--get', 'core.sparseCheckout'],
    { cwd, stdin: 'ignore', env },
  )
  if (check.code === 0 && check.stdout.trim() === 'true') {
    return {
      code: 1,
      stderr:
        'sparsePaths removed from config but repository is sparse; re-cloning for full checkout',
    }
  }
  return { code: 0, stderr: '' }
}

/**
 * Cache a marketplace from a git repository
 *
 * Clones or updates a git repository containing marketplace data.
 * If the repository already exists at cachePath, pulls the latest changes.
 * If pulling fails, removes the directory and re-clones.
 *
 * Example repository structure:
 * ```
 * my-marketplace/
 *   ├── .claude-plugin/
 *   │   └── marketplace.json    # Default location for marketplace manifest
 *   ├── plugins/                # Plugin implementations
 *   └── README.md
 * ```
 *
 * @param gitUrl - The git URL to clone (https or ssh)
 * @param cachePath - Local directory path to clone/update the repository
 * @param ref - Optional git branch or tag to checkout
 * @param onProgress - Optional callback to report progress
 */
async function cacheMarketplaceFromGit(
  gitUrl: string,
  cachePath: string,
  ref?: string,
  sparsePaths?: string[],
  onProgress?: MarketplaceProgressCallback,
  options?: { disableCredentialHelper?: boolean },
): Promise<void> {
  const fs = getFsImplementation()

  // Attempt incremental update; fall back to re-clone if the repo is absent,
  // stale, or otherwise not updatable. Using pull-first avoids a stat-before-operate
  // TOCTOU check: gitPull returns non-zero when cachePath is missing or has no .git.
  const timeoutSec = Math.round(getPluginGitTimeoutMs() / 1000)
  safeCallProgress(
    onProgress,
    `Refreshing marketplace cache (timeout: ${timeoutSec}s)…`,
  )

  // Reconcile sparse-checkout config before pulling. If this requires a re-clone
  // (Sparse→Full transition) or fails (missing dir, not a repo), skip straight
  // to the rm+clone fallback.
  const reconcileResult = await reconcileSparseCheckout(cachePath, sparsePaths)
  if (reconcileResult.code === 0) {
    const pullStarted = performance.now()
    const pullResult = await gitPull(cachePath, ref, {
      disableCredentialHelper: options?.disableCredentialHelper,
      sparsePaths,
    })
    logPluginFetch(
      'marketplace_pull',
      gitUrl,
      pullResult.code === 0 ? 'success' : 'failure',
      performance.now() - pullStarted,
      pullResult.code === 0 ? undefined : classifyFetchError(pullResult.stderr),
    )
    if (pullResult.code === 0) return
    logForDebugging(`git pull failed, will re-clone: ${pullResult.stderr}`, {
      level: 'warn',
    })
  } else {
    logForDebugging(
      `sparse-checkout reconcile requires re-clone: ${reconcileResult.stderr}`,
    )
  }

  try {
    await fs.rm(cachePath, { recursive: true })
    // rm succeeded — a stale or partially-cloned directory existed; log for diagnostics
    logForDebugging(
      `Found stale marketplace directory at ${cachePath}, cleaning up to allow re-clone`,
      { level: 'warn' },
    )
    safeCallProgress(
      onProgress,
      'Found stale directory, cleaning up and re-cloning…',
    )
  } catch (rmError) {
    if (!isENOENT(rmError)) {
      const rmErrorMsg = errorMessage(rmError)
      throw new Error(
        `Failed to clean up existing marketplace directory. Please manually delete the directory at ${cachePath} and try again.\n\nTechnical details: ${rmErrorMsg}`,
      )
    }
    // ENOENT — cachePath didn't exist, this is a fresh install, nothing to clean up
  }

  // Clone the repository (one attempt — no internal retry loop)
  const refMessage = ref ? ` (ref: ${ref})` : ''
  safeCallProgress(
    onProgress,
    `Cloning repository (timeout: ${timeoutSec}s): ${redactUrlCredentials(gitUrl)}${refMessage}`,
  )
  const cloneStarted = performance.now()
  const result = await gitClone(gitUrl, cachePath, ref, sparsePaths)
  logPluginFetch(
    'marketplace_clone',
    gitUrl,
    result.code === 0 ? 'success' : 'failure',
    performance.now() - cloneStarted,
    result.code === 0 ? undefined : classifyFetchError(result.stderr),
  )
  if (result.code !== 0) {
    // Clean up any partial directory created by the failed clone so the next
    // attempt starts fresh. Best-effort: if this fails, the stale dir will be
    // auto-detected and removed at the top of the next call.
    try {
      await fs.rm(cachePath, { recursive: true, force: true })
    } catch {
      // ignore
    }
    throw new Error(`Failed to clone marketplace repository: ${result.stderr}`)
  }
  safeCallProgress(onProgress, 'Clone complete, validating marketplace…')
}

/**
 * Redact header values for safe logging
 *
 * @param headers - Headers to redact
 * @returns Headers with values replaced by '***REDACTED***'
 */
function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key]) => [key, '***REDACTED***']),
  )
}

/**
 * Redact userinfo (username:password) in a URL to avoid logging credentials.
 *
 * Marketplace URLs may embed credentials (e.g. GitHub PATs in
 * `https://user:token@github.com/org/repo`). Debug logs and progress output
 * are written to disk and may be included in bug reports, so credentials must
 * be redacted before logging.
 *
 * Redacts all credentials from http(s) URLs:
 *   https://user:token@github.com/repo → https://***:***@github.com/repo
 *   https://:token@github.com/repo     → https://:***@github.com/repo
 *   https://token@github.com/repo      → https://***@github.com/repo
 *
 * Both username and password are redacted unconditionally on http(s) because
 * it is impossible to distinguish `placeholder:secret` (e.g. x-access-token:ghp_...)
 * from `secret:placeholder` (e.g. ghp_...:x-oauth-basic) by parsing alone.
 * Non-http(s) schemes (ssh://git@...) and non-URL inputs (`owner/repo` shorthand)
 * pass through unchanged.
 */
function redactUrlCredentials(urlString: string): string {
  try {
    const parsed = new URL(urlString)
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    if (isHttp && (parsed.username || parsed.password)) {
      if (parsed.username) parsed.username = '***'
      if (parsed.password) parsed.password = '***'
      return parsed.toString()
    }
  } catch {
    // Not a valid URL — safe as-is
  }
  return urlString
}

/**
 * Cache a marketplace from a URL
 *
 * Downloads a marketplace.json file from a URL and saves it locally.
 * Creates the cache directory structure if it doesn't exist.
 *
 * Example marketplace.json structure:
 * ```json
 * {
 *   "name": "my-marketplace",
 *   "owner": { "name": "John Doe", "email": "john@example.com" },
 *   "plugins": [
 *     {
 *       "id": "my-plugin",
 *       "name": "My Plugin",
 *       "source": "./plugins/my-plugin.json",
 *       "category": "productivity",
 *       "description": "A helpful plugin"
 *     }
 *   ]
 * }
 * ```
 *
 * @param url - The URL to download the marketplace.json from
 * @param cachePath - Local file path to save the downloaded marketplace
 * @param customHeaders - Optional custom HTTP headers for authentication
 * @param onProgress - Optional callback to report progress
 */
async function cacheMarketplaceFromUrl(
  url: string,
  cachePath: string,
  customHeaders?: Record<string, string>,
  onProgress?: MarketplaceProgressCallback,
): Promise<void> {
  const fs = getFsImplementation()

  const redactedUrl = redactUrlCredentials(url)
  safeCallProgress(onProgress, `Downloading marketplace from ${redactedUrl}`)
  logForDebugging(`Downloading marketplace from URL: ${redactedUrl}`)
  if (customHeaders && Object.keys(customHeaders).length > 0) {
    logForDebugging(
      `Using custom headers: ${jsonStringify(redactHeaders(customHeaders))}`,
    )
  }

  const headers = {
    ...customHeaders,
    // User-Agent must come last to prevent override (for consistency with WebFetch)
    'User-Agent': 'Claude-Code-Plugin-Manager',
  }

  let response
  const fetchStarted = performance.now()
  try {
    response = await axios.get(url, {
      timeout: 10000,
      headers,
    })
  } catch (error) {
    logPluginFetch(
      'marketplace_url',
      url,
      'failure',
      performance.now() - fetchStarted,
      classifyFetchError(error),
    )
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error(
          `Could not connect to ${redactedUrl}. Please check your internet connection and verify the URL is correct.\n\nTechnical details: ${error.message}`,
        )
      }
      if (error.code === 'ETIMEDOUT') {
        throw new Error(
          `Request timed out while downloading marketplace from ${redactedUrl}. The server may be slow or unreachable.\n\nTechnical details: ${error.message}`,
        )
      }
      if (error.response) {
        throw new Error(
          `HTTP ${error.response.status} error while downloading marketplace from ${redactedUrl}. The marketplace file may not exist at this URL.\n\nTechnical details: ${error.message}`,
        )
      }
    }
    throw new Error(
      `Failed to download marketplace from ${redactedUrl}: ${errorMessage(error)}`,
    )
  }

  safeCallProgress(onProgress, 'Validating marketplace data')
  // Validate the response is a valid marketplace
  const result = PluginMarketplaceSchema().safeParse(response.data)
  if (!result.success) {
    logPluginFetch(
      'marketplace_url',
      url,
      'failure',
      performance.now() - fetchStarted,
      'invalid_schema',
    )
    throw new ConfigParseError(
      `Invalid marketplace schema from URL: ${result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      redactedUrl,
      response.data,
    )
  }
  logPluginFetch(
    'marketplace_url',
    url,
    'success',
    performance.now() - fetchStarted,
  )

  safeCallProgress(onProgress, 'Saving marketplace to cache')
  // Ensure cache directory exists
  const cacheDir = join(cachePath, '..')
  await fs.mkdir(cacheDir)

  // Write the validated marketplace file
  writeFileSync_DEPRECATED(cachePath, jsonStringify(result.data, null, 2), {
    encoding: 'utf-8',
    flush: true,
  })
}

/**
 * Generate a cache path for a marketplace source
 */
function getCachePathForSource(source: MarketplaceSource): string {
  const tempName =
    source.source === 'github'
      ? source.repo.replace('/', '-')
      : source.source === 'npm'
        ? source.package.replace('@', '').replace('/', '-')
        : source.source === 'file'
          ? basename(source.path).replace('.json', '')
          : source.source === 'directory'
            ? basename(source.path)
            : 'temp_' + Date.now()
  return tempName
}

/**
 * Parse and validate JSON file with a Zod schema
 */
async function parseFileWithSchema<T>(
  filePath: string,
  schema: {
    safeParse: (data: unknown) => {
      success: boolean
      data?: T
      error?: {
        issues: Array<{ path: PropertyKey[]; message: string }>
      }
    }
  },
): Promise<T> {
  const fs = getFsImplementation()
  const content = await fs.readFile(filePath, { encoding: 'utf-8' })
  let data: unknown
  try {
    data = jsonParse(content)
  } catch (error) {
    throw new ConfigParseError(
      `Invalid JSON in ${filePath}: ${errorMessage(error)}`,
      filePath,
      content,
    )
  }
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ConfigParseError(
      `Invalid schema: ${filePath} ${result.error?.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      filePath,
      data,
    )
  }
  return result.data!
}

/**
 * Load and cache a marketplace from its source
 *
 * Handles different source types:
 * - URL: Downloads marketplace.json directly
 * - GitHub: Clones repo and looks for .claude-plugin/marketplace.json
 * - Git: Clones repository from git URL
 * - NPM: (Not yet implemented) Would fetch from npm package
 * - File: Reads from local filesystem
 *
 * After loading, validates the marketplace schema and renames the cache
 * to match the marketplace's actual name from the manifest.
 *
 * Cache structure:
 * ~/.claude/plugins/marketplaces/
 *   ├── official-marketplace.json     # From URL source
 *   ├── github-marketplace/          # From GitHub/Git source
 *   │   └── .claude-plugin/
 *   │       └── marketplace.json
 *   └── local-marketplace.json       # From file source
 *
 * @param source - The marketplace source to load from
 * @param onProgress - Optional callback to report progress
 * @returns Object containing the validated marketplace and its cache path
 * @throws If marketplace file not found or validation fails
 */
async function loadAndCacheMarketplace(
  source: MarketplaceSource,
  onProgress?: MarketplaceProgressCallback,
): Promise<LoadedPluginMarketplace> {
  const fs = getFsImplementation()
  const cacheDir = getMarketplacesCacheDir()

  // Ensure cache directory exists
  await fs.mkdir(cacheDir)

  let temporaryCachePath: string
  let marketplacePath: string
  let cleanupNeeded = false

  // Generate a temp name for the cache path
  const tempName = getCachePathForSource(source)

  try {
    switch (source.source) {
      case 'url': {
        // Direct URL to marketplace.json
        temporaryCachePath = join(cacheDir, `${tempName}.json`)
        cleanupNeeded = true
        await cacheMarketplaceFromUrl(
          source.url,
          temporaryCachePath,
          source.headers,
          onProgress,
        )
        marketplacePath = temporaryCachePath
        break
      }

      case 'github': {
        // Smart SSH/HTTPS selection: check if SSH is configured before trying it
        // This avoids waiting for timeout on SSH when it's not configured
        const sshUrl = `git@github.com:${source.repo}.git`
        const httpsUrl = `https://github.com/${source.repo}.git`
        temporaryCachePath = join(cacheDir, tempName)
        cleanupNeeded = true

        let lastError: Error | null = null

        // Quick check if SSH is likely to work
        const sshConfigured = await isGitHubSshLikelyConfigured()

        if (sshConfigured) {
          // SSH looks good, try it first
          safeCallProgress(onProgress, `Cloning via SSH: ${sshUrl}`)
          try {
            await cacheMarketplaceFromGit(
              sshUrl,
              temporaryCachePath,
              source.ref,
              source.sparsePaths,
              onProgress,
            )
          } catch (err) {
            lastError = toError(err)

            // Log SSH failure for monitoring
            logError(lastError)

            // SSH failed despite being configured, try HTTPS fallback
            safeCallProgress(
              onProgress,
              `SSH clone failed, retrying with HTTPS: ${httpsUrl}`,
            )

            logForDebugging(
              `SSH clone failed for ${source.repo} despite SSH being configured, falling back to HTTPS`,
              { level: 'info' },
            )

            // Clean up failed SSH attempt if it created anything
            await fs.rm(temporaryCachePath, { recursive: true, force: true })

            // Try HTTPS
            try {
              await cacheMarketplaceFromGit(
                httpsUrl,
                temporaryCachePath,
                source.ref,
                source.sparsePaths,
                onProgress,
              )
              lastError = null // Success!
            } catch (httpsErr) {
              // HTTPS also failed - use HTTPS error as the final error
              lastError = toError(httpsErr)

              // Log HTTPS failure for monitoring (both SSH and HTTPS failed)
              logError(lastError)
            }
          }
        } else {
          // SSH not configured, go straight to HTTPS
          safeCallProgress(
            onProgress,
            `SSH not configured, cloning via HTTPS: ${httpsUrl}`,
          )

          logForDebugging(
            `SSH not configured for GitHub, using HTTPS for ${source.repo}`,
            { level: 'info' },
          )

          try {
            await cacheMarketplaceFromGit(
              httpsUrl,
              temporaryCachePath,
              source.ref,
              source.sparsePaths,
              onProgress,
            )
          } catch (err) {
            lastError = toError(err)

            // Always try SSH as fallback for ANY HTTPS failure
            // Log HTTPS failure for monitoring
            logError(lastError)

            // HTTPS failed, try SSH as fallback
            safeCallProgress(
              onProgress,
              `HTTPS clone failed, retrying with SSH: ${sshUrl}`,
            )

            logForDebugging(
              `HTTPS clone failed for ${source.repo} (${lastError.message}), falling back to SSH`,
              { level: 'info' },
            )

            // Clean up failed HTTPS attempt if it created anything
            await fs.rm(temporaryCachePath, { recursive: true, force: true })

            // Try SSH
            try {
              await cacheMarketplaceFromGit(
                sshUrl,
                temporaryCachePath,
                source.ref,
                source.sparsePaths,
                onProgress,
              )
              lastError = null // Success!
            } catch (sshErr) {
              // SSH also failed - use SSH error as the final error
              lastError = toError(sshErr)

              // Log SSH failure for monitoring (both HTTPS and SSH failed)
              logError(lastError)
            }
          }
        }

        // If we still have an error, throw it
        if (lastError) {
          throw lastError
        }

        marketplacePath = join(
          temporaryCachePath,
          source.path || '.claude-plugin/marketplace.json',
        )
        break
      }

      case 'git': {
        temporaryCachePath = join(cacheDir, tempName)
        cleanupNeeded = true
        await cacheMarketplaceFromGit(
          source.url,
          temporaryCachePath,
          source.ref,
          source.sparsePaths,
          onProgress,
        )
        marketplacePath = join(
          temporaryCachePath,
          source.path || '.claude-plugin/marketplace.json',
        )
        break
      }

      case 'npm': {
        // TODO: Implement npm package support
        throw new Error('NPM marketplace sources not yet implemented')
      }

      case 'file': {
        // For local files, resolve paths relative to marketplace root directory
        // File sources point to .claude-plugin/marketplace.json, so the marketplace
        // root is two directories up (parent of .claude-plugin/)
        // Resolve to absolute so error messages show the actual path checked
        // (legacy known_marketplaces.json entries may have relative paths)
        const absPath = resolve(source.path)
        marketplacePath = absPath
        temporaryCachePath = dirname(dirname(absPath))
        cleanupNeeded = false
        break
      }

      case 'directory': {
        // For directories, look for .claude-plugin/marketplace.json
        // Resolve to absolute so error messages show the actual path checked
        // (legacy known_marketplaces.json entries may have relative paths)
        const absPath = resolve(source.path)
        marketplacePath = join(absPath, '.claude-plugin', 'marketplace.json')
        temporaryCachePath = absPath
        cleanupNeeded = false
        break
      }

      case 'settings': {
        // Inline manifest from settings.json — no fetch. Synthesize the
        // marketplace.json on disk so getMarketplaceCacheOnly reads it
        // like any other source. The plugins array already passed
        // PluginMarketplaceEntrySchema validation when settings were parsed;
        // the post-switch parseFileWithSchema re-validates the full
        // PluginMarketplaceSchema (catches schema drift between the two).
        //
        // Writing to source.name up front means the rename below is a no-op
        // (temporaryCachePath === finalCachePath). known_marketplaces.json
        // stores this source object including the plugins array, so
        // diffMarketplaces detects settings edits via isEqual — no special
        // dirty-tracking needed.
        temporaryCachePath = join(cacheDir, source.name)
        marketplacePath = join(
          temporaryCachePath,
          '.claude-plugin',
          'marketplace.json',
        )
        cleanupNeeded = false
        await fs.mkdir(dirname(marketplacePath))
        // No `satisfies PluginMarketplace` here: source.plugins is the narrow
        // SettingsMarketplacePlugin type (no strict/.default(), no manifest
        // fields). The parseFileWithSchema(PluginMarketplaceSchema()) call
        // below widens and validates — that's the real check.
        await writeFile(
          marketplacePath,
          jsonStringify(
            {
              name: source.name,
              owner: source.owner ?? { name: 'settings' },
              plugins: source.plugins,
            },
            null,
            2,
          ),
        )
        break
      }

      default:
        throw new Error(`Unsupported marketplace source type`)
    }

    // Load and validate the marketplace
    logForDebugging(`Reading marketplace from ${marketplacePath}`)
    let marketplace: PluginMarketplace
    try {
      marketplace = await parseFileWithSchema(
        marketplacePath,
        PluginMarketplaceSchema(),
      )
    } catch (e) {
      if (isENOENT(e)) {
        throw new Error(`Marketplace file not found at ${marketplacePath}`)
      }
      throw new Error(
        `Failed to parse marketplace file at ${marketplacePath}: ${errorMessage(e)}`,
      )
    }

    // Now rename the cache path to use the marketplace's actual name
    const finalCachePath = join(cacheDir, marketplace.name)
    // Defense-in-depth: the schema rejects path separators, .., and . in marketplace.name,
    // but verify the computed path is a strict subdirectory of cacheDir before fs.rm.
    // A malicious marketplace.json with a crafted name must never cause us to rm outside
    // cacheDir, nor rm cacheDir itself (e.g. name "." → join normalizes to cacheDir).
    const resolvedFinal = resolve(finalCachePath)
    const resolvedCacheDir = resolve(cacheDir)
    if (!resolvedFinal.startsWith(resolvedCacheDir + sep)) {
      throw new Error(
        `Marketplace name '${marketplace.name}' resolves to a path outside the cache directory`,
      )
    }
    // Don't rename if it's a local file or directory, or already has the right name
    if (
      temporaryCachePath !== finalCachePath &&
      !isLocalMarketplaceSource(source)
    ) {
      try {
        // Remove the destination if it already exists, then rename
        try {
          onProgress?.('Cleaning up old marketplace cache…')
        } catch (callbackError) {
          logForDebugging(
            `Progress callback error: ${errorMessage(callbackError)}`,
            { level: 'warn' },
          )
        }
        await fs.rm(finalCachePath, { recursive: true, force: true })
        // Rename temp cache to final name
        await fs.rename(temporaryCachePath, finalCachePath)
        temporaryCachePath = finalCachePath
        cleanupNeeded = false // Successfully renamed, no cleanup needed
      } catch (error) {
        const errorMsg = errorMessage(error)
        throw new Error(
          `Failed to finalize marketplace cache. Please manually delete the directory at ${finalCachePath} if it exists and try again.\n\nTechnical details: ${errorMsg}`,
        )
      }
    }

    return { marketplace, cachePath: temporaryCachePath }
  } catch (error) {
    // Clean up any temporary files/directories on error
    if (
      cleanupNeeded &&
      temporaryCachePath! &&
      !isLocalMarketplaceSource(source)
    ) {
      try {
        await fs.rm(temporaryCachePath!, { recursive: true, force: true })
      } catch (cleanupError) {
        logForDebugging(
          `Warning: Failed to clean up temporary marketplace cache at ${temporaryCachePath}: ${errorMessage(cleanupError)}`,
          { level: 'warn' },
        )
      }
    }
    throw error
  }
}

/**
 * Add a marketplace source to the known marketplaces
 *
 * The marketplace is fetched, validated, and cached locally.
 * The configuration is saved to ~/.claude/plugins/known_marketplaces.json.
 *
 * @param source - MarketplaceSource object representing the marketplace source.
 *                 Callers should parse user input into MarketplaceSource format
 *                 (see AddMarketplace.parseMarketplaceInput for handling shortcuts like "owner/repo").
 * @param onProgress - Optional callback for progress updates during marketplace installation
 * @throws If source format is invalid or marketplace cannot be loaded
 */
export async function addMarketplaceSource(
  source: MarketplaceSource,
  onProgress?: MarketplaceProgressCallback,
): Promise<{
  name: string
  alreadyMaterialized: boolean
  resolvedSource: MarketplaceSource
}> {
  // Resolve relative directory/file paths to absolute so state is cwd-independent
  let resolvedSource = source
  if (isLocalMarketplaceSource(source) && !isAbsolute(source.path)) {
    resolvedSource = { ...source, path: resolve(source.path) }
  }

  // Check policy FIRST, before any network/filesystem operations
  // This prevents downloading/cloning when the source is blocked
  if (!isSourceAllowedByPolicy(resolvedSource)) {
    // Check if explicitly blocked vs not in allowlist for better error messages
    if (isSourceInBlocklist(resolvedSource)) {
      throw new Error(
        `Marketplace source '${formatSourceForDisplay(resolvedSource)}' is blocked by enterprise policy.`,
      )
    }
    // Not in allowlist - build helpful error message
    const allowlist = getStrictKnownMarketplaces() || []
    const hostPatterns = getHostPatternsFromAllowlist()
    const sourceHost = extractHostFromSource(resolvedSource)

    let errorMessage = `Marketplace source '${formatSourceForDisplay(resolvedSource)}'`
    if (sourceHost) {
      errorMessage += ` (${sourceHost})`
    }
    errorMessage += ' is blocked by enterprise policy.'

    if (allowlist.length > 0) {
      errorMessage += ` Allowed sources: ${allowlist.map(s => formatSourceForDisplay(s)).join(', ')}`
    } else {
      errorMessage += ' No external marketplaces are allowed.'
    }

    // If source is a github shorthand and there are hostPatterns, suggest using full URL
    if (resolvedSource.source === 'github' && hostPatterns.length > 0) {
      errorMessage +=
        `\n\nTip: The shorthand "${resolvedSource.repo}" assumes github.com. ` +
        `For internal GitHub Enterprise, use the full URL:\n` +
        `  git@your-github-host.com:${resolvedSource.repo}.git`
    }

    throw new Error(errorMessage)
  }

  // Source-idempotency: if this exact source already exists, skip clone
  const existingConfig = await loadKnownMarketplacesConfig()
  for (const [existingName, existingEntry] of Object.entries(existingConfig)) {
    if (isEqual(existingEntry.source, resolvedSource)) {
      logForDebugging(
        `Source already materialized as '${existingName}', skipping clone`,
      )
      return { name: existingName, alreadyMaterialized: true, resolvedSource }
    }
  }

  // Load and cache the marketplace to validate it and get its name
  const { marketplace, cachePath } = await loadAndCacheMarketplace(
    resolvedSource,
    onProgress,
  )

  // Validate that reserved names come from official sources
  const sourceValidationError = validateOfficialNameSource(
    marketplace.name,
    resolvedSource,
  )
  if (sourceValidationError) {
    throw new Error(sourceValidationError)
  }

  // Name collision with different source: overwrite (settings intent wins).
  // Seed-managed entries are admin-controlled and cannot be overwritten.
  // Re-read config after clone (may take a while; another process may have written).
  const config = await loadKnownMarketplacesConfig()
  const oldEntry = config[marketplace.name]
  if (oldEntry) {
    const seedDir = seedDirFor(oldEntry.installLocation)
    if (seedDir) {
      throw new Error(
        `Marketplace '${marketplace.name}' is seed-managed (${seedDir}). ` +
          `To use a different source, ask your admin to update the seed, ` +
          `or use a different marketplace name.`,
      )
    }
    logForDebugging(
      `Marketplace '${marketplace.name}' exists with different source — overwriting`,
    )
    // Clean up the old cache if it's not a user-owned local path AND it
    // actually differs from the new cachePath. loadAndCacheMarketplace writes
    // to cachePath BEFORE we get here — rm-ing the same dir deletes the fresh
    // write. Settings sources always land on the same dir (name → path);
    // git sources hit this latently when the source repo changes but the
    // fetched marketplace.json declares the same name. Only rm when locations
    // genuinely differ (the only case where there's a stale dir to clean).
    //
    // Defensively validate the stored path before rm: a corrupted
    // installLocation (gh-32793, gh-32661) could point at the user's project
    // dir. If it's outside the cache dir, skip cleanup — the stale dir (if
    // any) is harmless, and blocking the re-add would prevent the user from
    // fixing the corruption.
    if (!isLocalMarketplaceSource(oldEntry.source)) {
      const cacheDir = resolve(getMarketplacesCacheDir())
      const resolvedOld = resolve(oldEntry.installLocation)
      const resolvedNew = resolve(cachePath)
      if (resolvedOld === resolvedNew) {
        // Same dir — loadAndCacheMarketplace already overwrote in place.
        // Nothing to clean.
      } else if (
        resolvedOld === cacheDir ||
        resolvedOld.startsWith(cacheDir + sep)
      ) {
        const fs = getFsImplementation()
        await fs.rm(oldEntry.installLocation, { recursive: true, force: true })
      } else {
        logForDebugging(
          `Skipping cleanup of old installLocation (${oldEntry.installLocation}) — ` +
            `outside ${cacheDir}. The path is corrupted; leaving it alone and ` +
            `overwriting the config entry.`,
          { level: 'warn' },
        )
      }
    }
  }

  // Update config using the marketplace's actual name
  config[marketplace.name] = {
    source: resolvedSource,
    installLocation: cachePath,
    lastUpdated: new Date().toISOString(),
  }
  await saveKnownMarketplacesConfig(config)

  logForDebugging(`Added marketplace source: ${marketplace.name}`)

  return { name: marketplace.name, alreadyMaterialized: false, resolvedSource }
}

/**
 * Remove a marketplace source from known marketplaces
 *
 * Removes the marketplace configuration and cleans up cached files.
 * Deletes both directory caches (for git sources) and file caches (for URL sources).
 * Also cleans up the marketplace from settings.json (extraKnownMarketplaces) and
 * removes related plugin entries from enabledPlugins.
 *
 * @param name - The marketplace name to remove
 * @throws If marketplace with given name is not found
 */
export async function removeMarketplaceSource(name: string): Promise<void> {
  const config = await loadKnownMarketplacesConfig()

  if (!config[name]) {
    throw new Error(`Marketplace '${name}' not found`)
  }

  // Seed-registered marketplaces are admin-baked into the container — removing
  // them is a category error. They'd resurrect on next startup anyway. Guide
  // the user to the right action instead.
  const entry = config[name]
  const seedDir = seedDirFor(entry.installLocation)
  if (seedDir) {
    throw new Error(
      `Marketplace '${name}' is registered from the read-only seed directory ` +
        `(${seedDir}) and will be re-registered on next startup. ` +
        `To stop using its plugins: claude plugin disable <plugin>@${name}`,
    )
  }

  // Remove from config
  delete config[name]
  await saveKnownMarketplacesConfig(config)

  // Clean up cached files (both directory and JSON formats)
  const fs = getFsImplementation()
  const cacheDir = getMarketplacesCacheDir()
  const cachePath = join(cacheDir, name)
  await fs.rm(cachePath, { recursive: true, force: true })
  const jsonCachePath = join(cacheDir, `${name}.json`)
  await fs.rm(jsonCachePath, { force: true })

  // Clean up settings.json - remove marketplace from extraKnownMarketplaces
  // and remove related plugin entries from enabledPlugins

  // Check each editable settings source
  const editableSources: Array<
    'userSettings' | 'projectSettings' | 'localSettings'
  > = ['userSettings', 'projectSettings', 'localSettings']

  for (const source of editableSources) {
    const settings = getSettingsForSource(source)
    if (!settings) continue

    let needsUpdate = false
    const updates: {
      extraKnownMarketplaces?: typeof settings.extraKnownMarketplaces
      enabledPlugins?: typeof settings.enabledPlugins
    } = {}

    // Remove from extraKnownMarketplaces if present
    if (settings.extraKnownMarketplaces?.[name]) {
      const updatedMarketplaces: Partial<
        SettingsJson['extraKnownMarketplaces']
      > = { ...settings.extraKnownMarketplaces }
      // Use undefined values (NOT delete) to signal key removal via mergeWith
      updatedMarketplaces[name] = undefined
      updates.extraKnownMarketplaces =
        updatedMarketplaces as SettingsJson['extraKnownMarketplaces']
      needsUpdate = true
    }

    // Remove related plugins from enabledPlugins (format: "plugin@marketplace")
    if (settings.enabledPlugins) {
      const marketplaceSuffix = `@${name}`
      const updatedPlugins = { ...settings.enabledPlugins }
      let removedPlugins = false

      for (const pluginId in updatedPlugins) {
        if (pluginId.endsWith(marketplaceSuffix)) {
          updatedPlugins[pluginId] = undefined
          removedPlugins = true
        }
      }

      if (removedPlugins) {
        updates.enabledPlugins = updatedPlugins
        needsUpdate = true
      }
    }

    // Update settings if changes were made
    if (needsUpdate) {
      const result = updateSettingsForSource(source, updates)
      if (result.error) {
        logError(result.error)
        logForDebugging(
          `Failed to clean up marketplace '${name}' from ${source} settings: ${result.error.message}`,
        )
      } else {
        logForDebugging(
          `Cleaned up marketplace '${name}' from ${source} settings`,
        )
      }
    }
  }

  // Remove plugins from installed_plugins.json and mark orphaned paths.
  // Also wipe their stored options/secrets — after marketplace removal
  // zero installations remain, same "last scope gone" condition as
  // uninstallPluginOp.
  const { orphanedPaths, removedPluginIds } =
    removeAllPluginsForMarketplace(name)
  for (const installPath of orphanedPaths) {
    await markPluginVersionOrphaned(installPath)
  }
  for (const pluginId of removedPluginIds) {
    deletePluginOptions(pluginId)
    await deletePluginDataDir(pluginId)
  }

  logForDebugging(`Removed marketplace source: ${name}`)
}

/**
 * Read a cached marketplace from disk without updating it
 *
 * @param installLocation - Path to the cached marketplace
 * @returns The marketplace object
 * @throws If marketplace file not found or invalid
 */
async function readCachedMarketplace(
  installLocation: string,
): Promise<PluginMarketplace> {
  // For git-sourced directories, the manifest lives at .claude-plugin/marketplace.json.
  // For url/file/directory sources it is the installLocation itself.
  // Try the nested path first; fall back to installLocation when it is a plain file
  // (ENOTDIR) or the nested file is simply missing (ENOENT).
  const nestedPath = join(installLocation, '.claude-plugin', 'marketplace.json')
  try {
    return await parseFileWithSchema(nestedPath, PluginMarketplaceSchema())
  } catch (e) {
    if (e instanceof ConfigParseError) throw e
    const code = getErrnoCode(e)
    if (code !== 'ENOENT' && code !== 'ENOTDIR') throw e
  }
  return await parseFileWithSchema(installLocation, PluginMarketplaceSchema())
}

/**
 * Get a specific marketplace by name from cache only (no network).
 * Returns null if cache is missing or corrupted.
 * Use this for startup paths that should never block on network.
 */
export async function getMarketplaceCacheOnly(
  name: string,
): Promise<PluginMarketplace | null> {
  const fs = getFsImplementation()
  const configFile = getKnownMarketplacesFile()

  try {
    const content = await fs.readFile(configFile, { encoding: 'utf-8' })
    const config = jsonParse(content) as KnownMarketplacesConfig
    const entry = config[name]

    if (!entry) {
      return null
    }

    return await readCachedMarketplace(entry.installLocation)
  } catch (error) {
    if (isENOENT(error)) {
      return null
    }
    logForDebugging(
      `Failed to read cached marketplace ${name}: ${errorMessage(error)}`,
      { level: 'warn' },
    )
    return null
  }
}

/**
 * Get a specific marketplace by name
 *
 * First attempts to read from cache. Only fetches from source if:
 * - No cached version exists
 * - Cache is invalid/corrupted
 *
 * This avoids unnecessary network/git operations on every access.
 * Use refreshMarketplace() to explicitly update from source.
 *
 * @param name - The marketplace name to fetch
 * @returns The marketplace object or null if not found/failed
 */
export const getMarketplace = memoize(
  async (name: string): Promise<PluginMarketplace> => {
    const config = await loadKnownMarketplacesConfig()
    const entry = config[name]

    if (!entry) {
      throw new Error(
        `Marketplace '${name}' not found in configuration. Available marketplaces: ${Object.keys(config).join(', ')}`,
      )
    }

    // Legacy entries (pre-#19708) may have relative paths in global config.
    // These are meaningless outside the project that wrote them — resolving
    // against process.cwd() produces the wrong path. Give actionable guidance
    // instead of a misleading ENOENT.
    if (
      isLocalMarketplaceSource(entry.source) &&
      !isAbsolute(entry.source.path)
    ) {
      throw new Error(
        `Marketplace "${name}" has a relative source path (${entry.source.path}) ` +
          `in known_marketplaces.json — this is stale state from an older ` +
          `Claude Code version. Run 'claude marketplace remove ${name}' and ` +
          `re-add it from the original project directory.`,
      )
    }

    // Try to read from disk cache
    try {
      return await readCachedMarketplace(entry.installLocation)
    } catch (error) {
      // Log cache corruption before re-fetching
      logForDebugging(
        `Cache corrupted or missing for marketplace ${name}, re-fetching from source: ${errorMessage(error)}`,
        {
          level: 'warn',
        },
      )
    }

    // Cache doesn't exist or is invalid, fetch from source
    let marketplace: PluginMarketplace
    try {
      ;({ marketplace } = await loadAndCacheMarketplace(entry.source))
    } catch (error) {
      throw new Error(
        `Failed to load marketplace "${name}" from source (${entry.source.source}): ${errorMessage(error)}`,
      )
    }

    // Update lastUpdated only when we actually fetch
    config[name]!.lastUpdated = new Date().toISOString()
    await saveKnownMarketplacesConfig(config)

    return marketplace
  },
)

/**
 * Get plugin by ID from cache only (no network calls).
 * Returns null if marketplace cache is missing or corrupted.
 * Use this for startup paths that should never block on network.
 *
 * @param pluginId - The plugin ID in format "name@marketplace"
 * @returns The plugin entry or null if not found/cache missing
 */
export async function getPluginByIdCacheOnly(pluginId: string): Promise<{
  entry: PluginMarketplaceEntry
  marketplaceInstallLocation: string
} | null> {
  const { name: pluginName, marketplace: marketplaceName } =
    parsePluginIdentifier(pluginId)
  if (!pluginName || !marketplaceName) {
    return null
  }

  const fs = getFsImplementation()
  const configFile = getKnownMarketplacesFile()

  try {
    const content = await fs.readFile(configFile, { encoding: 'utf-8' })
    const config = jsonParse(content) as KnownMarketplacesConfig
    const marketplaceConfig = config[marketplaceName]

    if (!marketplaceConfig) {
      return null
    }

    const marketplace = await getMarketplaceCacheOnly(marketplaceName)
    if (!marketplace) {
      return null
    }

    const plugin = marketplace.plugins.find(p => p.name === pluginName)
    if (!plugin) {
      return null
    }

    return {
      entry: plugin,
      marketplaceInstallLocation: marketplaceConfig.installLocation,
    }
  } catch {
    return null
  }
}

/**
 * Get plugin by ID from a specific marketplace
 *
 * First tries cache-only lookup. If cache is missing/corrupted,
 * falls back to fetching from source.
 *
 * @param pluginId - The plugin ID in format "name@marketplace"
 * @returns The plugin entry or null if not found
 */
export async function getPluginById(pluginId: string): Promise<{
  entry: PluginMarketplaceEntry
  marketplaceInstallLocation: string
} | null> {
  // Try cache-only first (fast path)
  const cached = await getPluginByIdCacheOnly(pluginId)
  if (cached) {
    return cached
  }

  // Cache miss - try fetching from source
  const { name: pluginName, marketplace: marketplaceName } =
    parsePluginIdentifier(pluginId)
  if (!pluginName || !marketplaceName) {
    return null
  }

  try {
    const config = await loadKnownMarketplacesConfig()
    const marketplaceConfig = config[marketplaceName]
    if (!marketplaceConfig) {
      return null
    }

    const marketplace = await getMarketplace(marketplaceName)
    const plugin = marketplace.plugins.find(p => p.name === pluginName)

    if (!plugin) {
      return null
    }

    return {
      entry: plugin,
      marketplaceInstallLocation: marketplaceConfig.installLocation,
    }
  } catch (error) {
    logForDebugging(
      `Could not find plugin ${pluginId}: ${errorMessage(error)}`,
      { level: 'debug' },
    )
    return null
  }
}

/**
 * Refresh all marketplace caches
 *
 * Updates all configured marketplaces from their sources.
 * Continues refreshing even if some marketplaces fail.
 * Updates lastUpdated timestamps for successful refreshes.
 *
 * This is useful for:
 * - Periodic updates to get new plugins
 * - Syncing after network connectivity is restored
 * - Ensuring caches are up-to-date before browsing
 *
 * @returns Promise that resolves when all refresh attempts complete
 */
export async function refreshAllMarketplaces(): Promise<void> {
  const config = await loadKnownMarketplacesConfig()

  for (const [name, entry] of Object.entries(config)) {
    // Seed-managed marketplaces are controlled by the seed image — refreshing
    // them is pointless (registerSeedMarketplaces overwrites on next startup).
    if (seedDirFor(entry.installLocation)) {
      logForDebugging(
        `Skipping seed-managed marketplace '${name}' in bulk refresh`,
      )
      continue
    }
    // settings-sourced marketplaces have no upstream — see refreshMarketplace.
    if (entry.source.source === 'settings') {
      continue
    }
    // inc-5046: same GCS intercept as refreshMarketplace() — bulk update
    // hits this path on `claude plugin marketplace update` (no name arg).
    if (name === OFFICIAL_MARKETPLACE_NAME) {
      const sha = await fetchOfficialMarketplaceFromGcs(
        entry.installLocation,
        getMarketplacesCacheDir(),
      )
      if (sha !== null) {
        config[name]!.lastUpdated = new Date().toISOString()
        continue
      }
      if (
        !getFeatureValue_CACHED_MAY_BE_STALE(
          'tengu_plugin_official_mkt_git_fallback',
          true,
        )
      ) {
        logForDebugging(
          `Skipping official marketplace bulk refresh: GCS failed, git fallback disabled`,
        )
        continue
      }
      // fall through to git
    }
    try {
      const { cachePath } = await loadAndCacheMarketplace(entry.source)
      config[name]!.lastUpdated = new Date().toISOString()
      config[name]!.installLocation = cachePath
    } catch (error) {
      logForDebugging(
        `Failed to refresh marketplace ${name}: ${errorMessage(error)}`,
        {
          level: 'error',
        },
      )
    }
  }

  await saveKnownMarketplacesConfig(config)
}

/**
 * Refresh a single marketplace cache
 *
 * Updates a specific marketplace from its source by doing an in-place update.
 * For git sources, runs git pull in the existing directory.
 * For URL sources, re-downloads to the existing file.
 * Clears the memoization cache and updates the lastUpdated timestamp.
 *
 * @param name - The name of the marketplace to refresh
 * @param onProgress - Optional callback to report progress
 * @throws If marketplace not found or refresh fails
 */
export async function refreshMarketplace(
  name: string,
  onProgress?: MarketplaceProgressCallback,
  options?: { disableCredentialHelper?: boolean },
): Promise<void> {
  const config = await loadKnownMarketplacesConfig()
  const entry = config[name]

  if (!entry) {
    throw new Error(
      `Marketplace '${name}' not found. Available marketplaces: ${Object.keys(config).join(', ')}`,
    )
  }

  // Clear the memoization cache for this specific marketplace
  getMarketplace.cache?.delete?.(name)

  // settings-sourced marketplaces have no upstream to pull. Edits to the
  // inline plugins array surface as sourceChanged in the reconciler, which
  // re-materializes via addMarketplaceSource — refresh is not the vehicle.
  if (entry.source.source === 'settings') {
    logForDebugging(
      `Skipping refresh for settings-sourced marketplace '${name}' — no upstream`,
    )
    return
  }

  try {
    // For updates, use the existing installLocation directly (in-place update)
    const installLocation = entry.installLocation
    const source = entry.source

    // Seed-managed marketplaces are controlled by the seed image. Refreshing
    // would be pointless — registerSeedMarketplaces() overwrites installLocation
    // back to seed on next startup. Error with guidance instead.
    const seedDir = seedDirFor(installLocation)
    if (seedDir) {
      throw new Error(
        `Marketplace '${name}' is seed-managed (${seedDir}) and its content is ` +
          `controlled by the seed image. To update: ask your admin to update the seed.`,
      )
    }

    // For remote sources (github/git/url), installLocation must be inside the
    // marketplaces cache dir. A corrupted value (gh-32793, gh-32661 — e.g.
    // Windows path read on WSL, literal tilde, manual edit) can point at the
    // user's project. cacheMarketplaceFromGit would then run git ops with that
    // cwd (git walks up to the user's .git) and fs.rm it on pull failure.
    // Refuse instead of auto-fixing so the user knows their state is corrupted.
    if (!isLocalMarketplaceSource(source)) {
      const cacheDir = resolve(getMarketplacesCacheDir())
      const resolvedLoc = resolve(installLocation)
      if (resolvedLoc !== cacheDir && !resolvedLoc.startsWith(cacheDir + sep)) {
        throw new Error(
          `Marketplace '${name}' has a corrupted installLocation ` +
            `(${installLocation}) — expected a path inside ${cacheDir}. ` +
            `This can happen after cross-platform path writes or manual edits ` +
            `to known_marketplaces.json. ` +
            `Run: claude plugin marketplace remove "${name}" and re-add it.`,
        )
      }
    }

    // inc-5046: official marketplace fetches from a GCS mirror instead of
    // git-cloning GitHub. Special-cased by NAME (not a new source type) so
    // no data migration is needed — existing known_marketplaces.json entries
    // still say source:'github', which is true (GCS is a mirror).
    if (name === OFFICIAL_MARKETPLACE_NAME) {
      const sha = await fetchOfficialMarketplaceFromGcs(
        installLocation,
        getMarketplacesCacheDir(),
      )
      if (sha !== null) {
        config[name] = { ...entry, lastUpdated: new Date().toISOString() }
        await saveKnownMarketplacesConfig(config)
        return
      }
      // GCS failed — fall through to git ONLY if the kill-switch allows.
      // Default true (backend write perms are pending as of inc-5046); flip
      // to false via GrowthBook once the backend is confirmed live so new
      // clients NEVER hit GitHub for the official marketplace.
      if (
        !getFeatureValue_CACHED_MAY_BE_STALE(
          'tengu_plugin_official_mkt_git_fallback',
          true,
        )
      ) {
        // Throw, don't return — every other failure path in this function
        // throws, and callers like ManageMarketplaces.tsx:259 increment
        // updatedCount on any non-throwing return. A silent return would
        // report "Updated 1 marketplace" when nothing was refreshed.
        throw new Error(
          'Official marketplace GCS fetch failed and git fallback is disabled',
        )
      }
      logForDebugging('Official marketplace GCS failed; falling back to git', {
        level: 'warn',
      })
      // ...falls through to source.source === 'github' branch below
    }

    // Update based on source type
    if (source.source === 'github' || source.source === 'git') {
      // Git sources: do in-place git pull
      if (source.source === 'github') {
        // Same SSH/HTTPS fallback as loadAndCacheMarketplace: if the pull
        // succeeds the remote URL in .git/config is used, but a re-clone
        // needs a URL — pick the right protocol up-front and fall back.
        const sshUrl = `git@github.com:${source.repo}.git`
        const httpsUrl = `https://github.com/${source.repo}.git`

        if (isEnvTruthy(process.env.CLAUDE_CODE_REMOTE)) {
          // CCR: always HTTPS (no SSH keys available)
          await cacheMarketplaceFromGit(
            httpsUrl,
            installLocation,
            source.ref,
            source.sparsePaths,
            onProgress,
            options,
          )
        } else {
          const sshConfigured = await isGitHubSshLikelyConfigured()
          const primaryUrl = sshConfigured ? sshUrl : httpsUrl
          const fallbackUrl = sshConfigured ? httpsUrl : sshUrl

          try {
            await cacheMarketplaceFromGit(
              primaryUrl,
              installLocation,
              source.ref,
              source.sparsePaths,
              onProgress,
              options,
            )
          } catch {
            logForDebugging(
              `Marketplace refresh failed with ${sshConfigured ? 'SSH' : 'HTTPS'} for ${source.repo}, falling back to ${sshConfigured ? 'HTTPS' : 'SSH'}`,
              { level: 'info' },
            )
            await cacheMarketplaceFromGit(
              fallbackUrl,
              installLocation,
              source.ref,
              source.sparsePaths,
              onProgress,
              options,
            )
          }
        }
      } else {
        // Explicit git URL: use as-is (no fallback available)
        await cacheMarketplaceFromGit(
          source.url,
          installLocation,
          source.ref,
          source.sparsePaths,
          onProgress,
          options,
        )
      }
      // Validate that marketplace.json still exists after update
      // The repo may have been restructured or deprecated
      try {
        await readCachedMarketplace(installLocation)
      } catch {
        const sourceDisplay =
          source.source === 'github'
            ? source.repo
            : redactUrlCredentials(source.url)
        const reason =
          name === 'claude-code-plugins'
            ? `We've deprecated "claude-code-plugins" in favor of "claude-plugins-official".`
            : `This marketplace may have been deprecated or moved to a new location.`
        throw new Error(
          `The marketplace.json file is no longer present in this repository.\n\n` +
            `${reason}\n` +
            `Source: ${sourceDisplay}\n\n` +
            `You can remove this marketplace with: claude plugin marketplace remove "${name}"`,
        )
      }
    } else if (source.source === 'url') {
      // URL sources: re-download to existing file
      await cacheMarketplaceFromUrl(
        source.url,
        installLocation,
        source.headers,
        onProgress,
      )
    } else if (isLocalMarketplaceSource(source)) {
      // Local sources: no remote to update from, but validate the file still exists and is valid
      safeCallProgress(onProgress, 'Validating local marketplace')
      // Read and validate to ensure the marketplace file is still valid
      await readCachedMarketplace(installLocation)
    } else {
      throw new Error(`Unsupported marketplace source type for refresh`)
    }

    // Update lastUpdated timestamp
    config[name]!.lastUpdated = new Date().toISOString()
    await saveKnownMarketplacesConfig(config)

    logForDebugging(`Successfully refreshed marketplace: ${name}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logForDebugging(`Failed to refresh marketplace ${name}: ${errorMessage}`, {
      level: 'error',
    })
    throw new Error(`Failed to refresh marketplace '${name}': ${errorMessage}`)
  }
}

/**
 * Set the autoUpdate flag for a marketplace
 *
 * When autoUpdate is enabled, the marketplace and its installed plugins
 * will be automatically updated on startup.
 *
 * @param name - The name of the marketplace to update
 * @param autoUpdate - Whether to enable auto-update
 * @throws If marketplace not found
 */
export async function setMarketplaceAutoUpdate(
  name: string,
  autoUpdate: boolean,
): Promise<void> {
  const config = await loadKnownMarketplacesConfig()
  const entry = config[name]

  if (!entry) {
    throw new Error(
      `Marketplace '${name}' not found. Available marketplaces: ${Object.keys(config).join(', ')}`,
    )
  }

  // Seed-managed marketplaces always have autoUpdate: false (read-only, git-pull
  // would fail). Toggle appears to work but registerSeedMarketplaces overwrites
  // it on next startup. Error with guidance instead of silent revert.
  const seedDir = seedDirFor(entry.installLocation)
  if (seedDir) {
    throw new Error(
      `Marketplace '${name}' is seed-managed (${seedDir}) and ` +
        `auto-update is always disabled for seed content. ` +
        `To update: ask your admin to update the seed.`,
    )
  }

  // Only update if the value is actually changing
  if (entry.autoUpdate === autoUpdate) {
    return
  }

  config[name] = {
    ...entry,
    autoUpdate,
  }
  await saveKnownMarketplacesConfig(config)

  // Also update intent in settings if declared there — write to the SAME
  // source that declared it to avoid creating duplicates at wrong scope
  const declaringSource = getMarketplaceDeclaringSource(name)
  if (declaringSource) {
    const declared =
      getSettingsForSource(declaringSource)?.extraKnownMarketplaces?.[name]
    if (declared) {
      saveMarketplaceToSettings(
        name,
        { source: declared.source, autoUpdate },
        declaringSource,
      )
    }
  }

  logForDebugging(`Set autoUpdate=${autoUpdate} for marketplace: ${name}`)
}

export const _test = {
  redactUrlCredentials,
}
