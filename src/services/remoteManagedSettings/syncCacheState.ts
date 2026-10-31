/**
 * Leaf state module for the remote-managed-settings sync cache.
 *
 * Split from syncCache.ts to break the settings.ts → syncCache.ts → auth.ts →
 * settings.ts cycle. auth.ts sits inside the large settings SCC; importing it
 * from settings.ts's own dependency chain pulls hundreds of modules into the
 * eagerly-evaluated SCC at startup.
 *
 * This module imports only leaves (path, envUtils, file, json, types,
 * settings/settingsCache — also a leaf, only type-imports validation). settings.ts
 * reads the cache from here. syncCache.ts keeps isRemoteManagedSettingsEligible
 * (the auth-touching part) and re-exports everything from here for callers that
 * don't care about the cycle.
 *
 * Eligibility is a tri-state here: undefined (not yet determined — return
 * null), false (ineligible — return null), true (proceed). managedEnv.ts
 * calls isRemoteManagedSettingsEligible() just before the policySettings
 * read — after userSettings/flagSettings env vars are applied, so the check
 * sees config-provided CLAUDE_CODE_USE_BEDROCK/ANTHROPIC_BASE_URL. That call
 * computes once and mirrors the result here via setEligibility(). Every
 * subsequent read hits the cached bool instead of re-running the auth chain.
 */

import { join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { readFileSync } from '../../utils/fileRead.js'
import { stripBOM } from '../../utils/jsonRead.js'
import { resetSettingsCache } from '../../utils/settings/settingsCache.js'
import type { SettingsJson } from '../../utils/settings/types.js'
import { jsonParse } from '../../utils/slowOperations.js'

const SETTINGS_FILENAME = 'remote-settings.json'

let sessionCache: SettingsJson | null = null
let eligible: boolean | undefined

export function setSessionCache(value: SettingsJson | null): void {
  sessionCache = value
}

export function resetSyncCache(): void {
  sessionCache = null
  eligible = undefined
}

export function setEligibility(v: boolean): boolean {
  eligible = v
  return v
}

export function getSettingsPath(): string {
  return join(getClaudeConfigHomeDir(), SETTINGS_FILENAME)
}

// sync IO — settings pipeline is sync. fileRead and jsonRead are leaves;
// file.ts and json.ts both sit in the settings SCC.
function loadSettings(): SettingsJson | null {
  try {
    const content = readFileSync(getSettingsPath())
    const data: unknown = jsonParse(stripBOM(content))
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null
    }
    return data as SettingsJson
  } catch {
    return null
  }
}

export function getRemoteManagedSettingsSyncFromCache(): SettingsJson | null {
  if (eligible !== true) return null
  if (sessionCache) return sessionCache
  const cachedSettings = loadSettings()
  if (cachedSettings) {
    sessionCache = cachedSettings
    // Remote settings just became available for the first time. Any merged
    // getSettings_DEPRECATED() result cached before this moment is missing
    // the policySettings layer (the `eligible !== true` guard above returned
    // null). Flush so the next merged read re-merges with this layer visible.
    //
    // Fires at most once: subsequent calls hit `if (sessionCache)` above.
    // When called from loadSettingsFromDisk() (settings.ts:546), the merged
    // cache is still null (setSessionSettingsCache runs at :732 after
    // loadSettingsFromDisk returns) — no-op. The async-fetch arm (index.ts
    // setSessionCache + notifyChange) already handles its own reset.
    //
    // gh-23085: isBridgeEnabled() at main.tsx Commander-definition time
    // (before preAction → init() → isRemoteManagedSettingsEligible()) reached
    // getSettings_DEPRECATED() at auth.ts:115. The try/catch in bridgeEnabled
    // swallowed the later getGlobalConfig() throw, but the merged settings
    // cache was already poisoned. See managedSettingsHeadless.int.test.ts.
    resetSettingsCache()
    return cachedSettings
  }
  return null
}
