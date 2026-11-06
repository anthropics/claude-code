import type { PermissionRule } from 'src/utils/permissions/PermissionRule.js'
import { getSettingsForSource } from 'src/utils/settings/settings.js'
import type { SettingsJson } from 'src/utils/settings/types.js'
import { BASH_TOOL_NAME } from '../../tools/BashTool/toolName.js'
import { SAFE_ENV_VARS } from '../../utils/managedEnvConstants.js'
import { getPermissionRulesForSource } from '../../utils/permissions/permissionsLoader.js'

function hasHooks(settings: SettingsJson | null): boolean {
  if (settings === null || settings.disableAllHooks) {
    return false
  }
  if (settings.statusLine) {
    return true
  }
  if (settings.fileSuggestion) {
    return true
  }
  if (!settings.hooks) {
    return false
  }
  for (const hookConfig of Object.values(settings.hooks)) {
    if (hookConfig.length > 0) {
      return true
    }
  }
  return false
}

export function getHooksSources(): string[] {
  const sources: string[] = []

  const projectSettings = getSettingsForSource('projectSettings')
  if (hasHooks(projectSettings)) {
    sources.push('.claude/settings.json')
  }

  const localSettings = getSettingsForSource('localSettings')
  if (hasHooks(localSettings)) {
    sources.push('.claude/settings.local.json')
  }

  return sources
}

function hasBashPermission(rules: PermissionRule[]): boolean {
  return rules.some(
    rule =>
      rule.ruleBehavior === 'allow' &&
      (rule.ruleValue.toolName === BASH_TOOL_NAME ||
        rule.ruleValue.toolName.startsWith(BASH_TOOL_NAME + '(')),
  )
}

/**
 * Get which setting sources have bash allow rules.
 * Returns an array of file paths that have bash permissions.
 */
export function getBashPermissionSources(): string[] {
  const sources: string[] = []

  const projectRules = getPermissionRulesForSource('projectSettings')
  if (hasBashPermission(projectRules)) {
    sources.push('.claude/settings.json')
  }

  const localRules = getPermissionRulesForSource('localSettings')
  if (hasBashPermission(localRules)) {
    sources.push('.claude/settings.local.json')
  }

  return sources
}

/**
 * Format a list of items with proper "and" conjunction.
 * @param items - Array of items to format
 * @param limit - Optional limit for how many items to show before summarizing (ignored if 0)
 */
export function formatListWithAnd(items: string[], limit?: number): string {
  if (items.length === 0) return ''

  // Ignore limit if it's 0
  const effectiveLimit = limit === 0 ? undefined : limit

  // If no limit or items are within limit, use normal formatting
  if (!effectiveLimit || items.length <= effectiveLimit) {
    if (items.length === 1) return items[0]!
    if (items.length === 2) return `${items[0]} and ${items[1]}`

    const lastItem = items[items.length - 1]!
    const allButLast = items.slice(0, -1)
    return `${allButLast.join(', ')}, and ${lastItem}`
  }

  // If we have more items than the limit, show first few and count the rest
  const shown = items.slice(0, effectiveLimit)
  const remaining = items.length - effectiveLimit

  if (shown.length === 1) {
    return `${shown[0]} and ${remaining} more`
  }

  return `${shown.join(', ')}, and ${remaining} more`
}

/**
 * Check if settings have otelHeadersHelper configured
 */
function hasOtelHeadersHelper(settings: SettingsJson | null): boolean {
  return !!settings?.otelHeadersHelper
}

/**
 * Get which setting sources have otelHeadersHelper configured.
 * Returns an array of file paths that have otelHeadersHelper.
 */
export function getOtelHeadersHelperSources(): string[] {
  const sources: string[] = []

  const projectSettings = getSettingsForSource('projectSettings')
  if (hasOtelHeadersHelper(projectSettings)) {
    sources.push('.claude/settings.json')
  }

  const localSettings = getSettingsForSource('localSettings')
  if (hasOtelHeadersHelper(localSettings)) {
    sources.push('.claude/settings.local.json')
  }

  return sources
}

/**
 * Check if settings have apiKeyHelper configured
 */
function hasApiKeyHelper(settings: SettingsJson | null): boolean {
  return !!settings?.apiKeyHelper
}

/**
 * Get which setting sources have apiKeyHelper configured.
 * Returns an array of file paths that have apiKeyHelper.
 */
export function getApiKeyHelperSources(): string[] {
  const sources: string[] = []

  const projectSettings = getSettingsForSource('projectSettings')
  if (hasApiKeyHelper(projectSettings)) {
    sources.push('.claude/settings.json')
  }

  const localSettings = getSettingsForSource('localSettings')
  if (hasApiKeyHelper(localSettings)) {
    sources.push('.claude/settings.local.json')
  }

  return sources
}

/**
 * Check if settings have AWS commands configured
 */
function hasAwsCommands(settings: SettingsJson | null): boolean {
  return !!(settings?.awsAuthRefresh || settings?.awsCredentialExport)
}

/**
 * Get which setting sources have AWS commands configured.
 * Returns an array of file paths that have awsAuthRefresh or awsCredentialExport.
 */
export function getAwsCommandsSources(): string[] {
  const sources: string[] = []

  const projectSettings = getSettingsForSource('projectSettings')
  if (hasAwsCommands(projectSettings)) {
    sources.push('.claude/settings.json')
  }

  const localSettings = getSettingsForSource('localSettings')
  if (hasAwsCommands(localSettings)) {
    sources.push('.claude/settings.local.json')
  }

  return sources
}

/**
 * Check if settings have GCP commands configured
 */
function hasGcpCommands(settings: SettingsJson | null): boolean {
  return !!settings?.gcpAuthRefresh
}

/**
 * Get which setting sources have GCP commands configured.
 * Returns an array of file paths that have gcpAuthRefresh.
 */
export function getGcpCommandsSources(): string[] {
  const sources: string[] = []

  const projectSettings = getSettingsForSource('projectSettings')
  if (hasGcpCommands(projectSettings)) {
    sources.push('.claude/settings.json')
  }

  const localSettings = getSettingsForSource('localSettings')
  if (hasGcpCommands(localSettings)) {
    sources.push('.claude/settings.local.json')
  }

  return sources
}

/**
 * Check if settings have dangerous environment variables configured.
 * Any env var NOT in SAFE_ENV_VARS is considered dangerous.
 */
function hasDangerousEnvVars(settings: SettingsJson | null): boolean {
  if (!settings?.env) {
    return false
  }
  return Object.keys(settings.env).some(
    key => !SAFE_ENV_VARS.has(key.toUpperCase()),
  )
}

/**
 * Get which setting sources have dangerous environment variables configured.
 * Returns an array of file paths that have env vars not in SAFE_ENV_VARS.
 */
export function getDangerousEnvVarsSources(): string[] {
  const sources: string[] = []

  const projectSettings = getSettingsForSource('projectSettings')
  if (hasDangerousEnvVars(projectSettings)) {
    sources.push('.claude/settings.json')
  }

  const localSettings = getSettingsForSource('localSettings')
  if (hasDangerousEnvVars(localSettings)) {
    sources.push('.claude/settings.local.json')
  }

  return sources
}
