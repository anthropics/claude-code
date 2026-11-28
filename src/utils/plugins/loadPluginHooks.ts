import memoize from 'lodash-es/memoize.js'
import type { HookEvent } from 'src/entrypoints/agentSdkTypes.js'
import {
  clearRegisteredPluginHooks,
  getRegisteredHooks,
  registerHookCallbacks,
} from '../../bootstrap/state.js'
import type { LoadedPlugin } from '../../types/plugin.js'
import { logForDebugging } from '../debug.js'
import { settingsChangeDetector } from '../settings/changeDetector.js'
import {
  getSettings_DEPRECATED,
  getSettingsForSource,
} from '../settings/settings.js'
import type { PluginHookMatcher } from '../settings/types.js'
import { jsonStringify } from '../slowOperations.js'
import { clearPluginCache, loadAllPluginsCacheOnly } from './pluginLoader.js'

// Track if hot reload subscription is set up
let hotReloadSubscribed = false

// Snapshot of enabledPlugins for change detection in hot reload
let lastPluginSettingsSnapshot: string | undefined

/**
 * Convert plugin hooks configuration to native matchers with plugin context
 */
function convertPluginHooksToMatchers(
  plugin: LoadedPlugin,
): Record<HookEvent, PluginHookMatcher[]> {
  const pluginMatchers: Record<HookEvent, PluginHookMatcher[]> = {
    PreToolUse: [],
    PostToolUse: [],
    PostToolUseFailure: [],
    PermissionDenied: [],
    Notification: [],
    UserPromptSubmit: [],
    SessionStart: [],
    SessionEnd: [],
    Stop: [],
    StopFailure: [],
    SubagentStart: [],
    SubagentStop: [],
    PreCompact: [],
    PostCompact: [],
    PermissionRequest: [],
    Setup: [],
    TeammateIdle: [],
    TaskCreated: [],
    TaskCompleted: [],
    Elicitation: [],
    ElicitationResult: [],
    ConfigChange: [],
    WorktreeCreate: [],
    WorktreeRemove: [],
    InstructionsLoaded: [],
    CwdChanged: [],
    FileChanged: [],
  }

  if (!plugin.hooksConfig) {
    return pluginMatchers
  }

  // Process each hook event - pass through all hook types with plugin context
  for (const [event, matchers] of Object.entries(plugin.hooksConfig)) {
    const hookEvent = event as HookEvent
    if (!pluginMatchers[hookEvent]) {
      continue
    }

    for (const matcher of matchers) {
      if (matcher.hooks.length > 0) {
        pluginMatchers[hookEvent].push({
          matcher: matcher.matcher,
          hooks: matcher.hooks,
          pluginRoot: plugin.path,
          pluginName: plugin.name,
          pluginId: plugin.source,
        })
      }
    }
  }

  return pluginMatchers
}

/**
 * Load and register hooks from all enabled plugins
 */
export const loadPluginHooks = memoize(async (): Promise<void> => {
  const { enabled } = await loadAllPluginsCacheOnly()
  const allPluginHooks: Record<HookEvent, PluginHookMatcher[]> = {
    PreToolUse: [],
    PostToolUse: [],
    PostToolUseFailure: [],
    PermissionDenied: [],
    Notification: [],
    UserPromptSubmit: [],
    SessionStart: [],
    SessionEnd: [],
    Stop: [],
    StopFailure: [],
    SubagentStart: [],
    SubagentStop: [],
    PreCompact: [],
    PostCompact: [],
    PermissionRequest: [],
    Setup: [],
    TeammateIdle: [],
    TaskCreated: [],
    TaskCompleted: [],
    Elicitation: [],
    ElicitationResult: [],
    ConfigChange: [],
    WorktreeCreate: [],
    WorktreeRemove: [],
    InstructionsLoaded: [],
    CwdChanged: [],
    FileChanged: [],
  }

  // Process each enabled plugin
  for (const plugin of enabled) {
    if (!plugin.hooksConfig) {
      continue
    }

    logForDebugging(`Loading hooks from plugin: ${plugin.name}`)
    const pluginMatchers = convertPluginHooksToMatchers(plugin)

    // Merge plugin hooks into the main collection
    for (const event of Object.keys(pluginMatchers) as HookEvent[]) {
      allPluginHooks[event].push(...pluginMatchers[event])
    }
  }

  // Clear-then-register as an atomic pair. Previously the clear lived in
  // clearPluginHookCache(), which meant any clearAllCaches() call (from
  // /plugins UI, pluginInstallationHelpers, thinkback, etc.) wiped plugin
  // hooks from STATE.registeredHooks and left them wiped until someone
  // happened to call loadPluginHooks() again. SessionStart explicitly awaits
  // loadPluginHooks() before firing so it always re-registered; Stop has no
  // such guard, so plugin Stop hooks silently never fired after any plugin
  // management operation (gh-29767). Doing the clear here makes the swap
  // atomic — old hooks stay valid until this point, new hooks take over.
  clearRegisteredPluginHooks()
  registerHookCallbacks(allPluginHooks)

  const totalHooks = Object.values(allPluginHooks).reduce(
    (sum, matchers) => sum + matchers.reduce((s, m) => s + m.hooks.length, 0),
    0,
  )
  logForDebugging(
    `Registered ${totalHooks} hooks from ${enabled.length} plugins`,
  )
})

export function clearPluginHookCache(): void {
  // Only invalidate the memoize — do NOT wipe STATE.registeredHooks here.
  // Wiping here left plugin hooks dead between clearAllCaches() and the next
  // loadPluginHooks() call, which for Stop hooks might never happen
  // (gh-29767). The clear now lives inside loadPluginHooks() as an atomic
  // clear-then-register, so old hooks stay valid until the fresh load swaps
  // them out.
  loadPluginHooks.cache?.clear?.()
}

/**
 * Remove hooks from plugins no longer in the enabled set, without adding
 * hooks from newly-enabled plugins. Called from clearAllCaches() so
 * uninstalled/disabled plugins stop firing hooks immediately (gh-36995),
 * while newly-enabled plugins wait for /reload-plugins — consistent with
 * how commands/agents/MCP behave.
 *
 * The full swap (clear + register all) still happens via loadPluginHooks(),
 * which /reload-plugins awaits.
 */
export async function pruneRemovedPluginHooks(): Promise<void> {
  // Early return when nothing to prune — avoids seeding the loadAllPluginsCacheOnly
  // memoize in test/preload.ts beforeEach (which clears registeredHooks).
  if (!getRegisteredHooks()) return
  const { enabled } = await loadAllPluginsCacheOnly()
  const enabledRoots = new Set(enabled.map(p => p.path))

  // Re-read after the await: a concurrent loadPluginHooks() (hot-reload)
  // could have swapped STATE.registeredHooks during the gap. Holding the
  // pre-await reference would compute survivors from stale data.
  const current = getRegisteredHooks()
  if (!current) return

  // Collect plugin hooks whose pluginRoot is still enabled, then swap via
  // the existing clear+register pair (same atomic-pair pattern as
  // loadPluginHooks above). Callback hooks are preserved by
  // clearRegisteredPluginHooks; we only need to re-register survivors.
  const survivors: Partial<Record<HookEvent, PluginHookMatcher[]>> = {}
  for (const [event, matchers] of Object.entries(current)) {
    const kept = matchers.filter(
      (m): m is PluginHookMatcher =>
        'pluginRoot' in m && enabledRoots.has(m.pluginRoot),
    )
    if (kept.length > 0) survivors[event as HookEvent] = kept
  }

  clearRegisteredPluginHooks()
  registerHookCallbacks(survivors)
}

/**
 * Reset hot reload subscription state. Only for testing.
 */
export function resetHotReloadState(): void {
  hotReloadSubscribed = false
  lastPluginSettingsSnapshot = undefined
}

/**
 * Build a stable string snapshot of the settings that feed into
 * `loadAllPluginsCacheOnly()` for change detection. Sorts keys so comparison is
 * deterministic regardless of insertion order.
 *
 * Hashes FOUR fields — not just enabledPlugins — because the memoized
 * loadAllPluginsCacheOnly() also reads strictKnownMarketplaces, blockedMarketplaces
 * (pluginLoader.ts:1933 via getBlockedMarketplaces), and
 * extraKnownMarketplaces. If remote managed settings set only one of
 * these (no enabledPlugins), a snapshot keyed only on enabledPlugins
 * would never diff, the listener would skip, and the memoized result
 * would retain the pre-remote marketplace allow/blocklist.
 * See #23085 / #23152 poisoned-cache discussion (Slack C09N89L3VNJ).
 */
// Exported for testing — the listener at setupPluginHookHotReload uses this
// for change detection; tests verify it diffs on the fields that matter.
export function getPluginAffectingSettingsSnapshot(): string {
  const merged = getSettings_DEPRECATED()
  const policy = getSettingsForSource('policySettings')
  // Key-sort the two Record fields so insertion order doesn't flap the hash.
  // Array fields (strictKnownMarketplaces, blockedMarketplaces) have
  // schema-stable order.
  const sortKeys = <T extends Record<string, unknown>>(o: T | undefined) =>
    o ? Object.fromEntries(Object.entries(o).sort()) : {}
  return jsonStringify({
    enabledPlugins: sortKeys(merged.enabledPlugins),
    extraKnownMarketplaces: sortKeys(merged.extraKnownMarketplaces),
    strictKnownMarketplaces: policy?.strictKnownMarketplaces ?? [],
    blockedMarketplaces: policy?.blockedMarketplaces ?? [],
  })
}

/**
 * Set up hot reload for plugin hooks when remote settings change.
 * When policySettings changes (e.g., from remote managed settings),
 * compares the plugin-affecting settings snapshot and only reloads if it
 * actually changed.
 */
export function setupPluginHookHotReload(): void {
  if (hotReloadSubscribed) {
    return
  }
  hotReloadSubscribed = true

  // Capture the initial snapshot so the first policySettings change can compare
  lastPluginSettingsSnapshot = getPluginAffectingSettingsSnapshot()

  settingsChangeDetector.subscribe(source => {
    if (source === 'policySettings') {
      const newSnapshot = getPluginAffectingSettingsSnapshot()
      if (newSnapshot === lastPluginSettingsSnapshot) {
        logForDebugging(
          'Plugin hooks: skipping reload, plugin-affecting settings unchanged',
        )
        return
      }

      lastPluginSettingsSnapshot = newSnapshot
      logForDebugging(
        'Plugin hooks: reloading due to plugin-affecting settings change',
      )

      // Clear all plugin-related caches
      clearPluginCache('loadPluginHooks: plugin-affecting settings changed')
      clearPluginHookCache()

      // Reload hooks (fire-and-forget, don't block)
      void loadPluginHooks()
    }
  })
}
