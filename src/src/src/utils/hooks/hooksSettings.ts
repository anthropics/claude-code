import { resolve } from 'path'
import type { HookEvent } from 'src/entrypoints/agentSdkTypes.js'
import { getSessionId } from '../../bootstrap/state.js'
import type { AppState } from '../../state/AppState.js'
import type { EditableSettingSource } from '../settings/constants.js'
import { SOURCES } from '../settings/constants.js'
import {
  getSettingsFilePathForSource,
  getSettingsForSource,
} from '../settings/settings.js'
import type { HookCommand, HookMatcher } from '../settings/types.js'
import { DEFAULT_HOOK_SHELL } from '../shell/shellProvider.js'
import { getSessionHooks } from './sessionHooks.js'

export type HookSource =
  | EditableSettingSource
  | 'policySettings'
  | 'pluginHook'
  | 'sessionHook'
  | 'builtinHook'

export interface IndividualHookConfig {
  event: HookEvent
  config: HookCommand
  matcher?: string
  source: HookSource
  pluginName?: string
}

/**
 * Check if two hooks are equal (comparing only command/prompt content, not timeout)
 */
export function isHookEqual(
  a: HookCommand | { type: 'function'; timeout?: number },
  b: HookCommand | { type: 'function'; timeout?: number },
): boolean {
  if (a.type !== b.type) return false

  // Use switch for exhaustive type checking
  // Note: We only compare command/prompt content, not timeout
  // `if` is part of identity: same command with different `if` conditions
  // are distinct hooks (e.g., setup.sh if=Bash(git *) vs if=Bash(npm *)).
  const sameIf = (x: { if?: string }, y: { if?: string }) =>
    (x.if ?? '') === (y.if ?? '')
  switch (a.type) {
    case 'command':
      // shell is part of identity: same command string with different
      // shells are distinct hooks. Default 'bash' so undefined === 'bash'.
      return (
        b.type === 'command' &&
        a.command === b.command &&
        (a.shell ?? DEFAULT_HOOK_SHELL) === (b.shell ?? DEFAULT_HOOK_SHELL) &&
        sameIf(a, b)
      )
    case 'prompt':
      return b.type === 'prompt' && a.prompt === b.prompt && sameIf(a, b)
    case 'agent':
      return b.type === 'agent' && a.prompt === b.prompt && sameIf(a, b)
    case 'http':
      return b.type === 'http' && a.url === b.url && sameIf(a, b)
    case 'function':
      // Function hooks can't be compared (no stable identifier)
      return false
  }
}

/** Get the display text for a hook */
export function getHookDisplayText(
  hook: HookCommand | { type: 'callback' | 'function'; statusMessage?: string },
): string {
  // Return custom status message if provided
  if ('statusMessage' in hook && hook.statusMessage) {
    return hook.statusMessage
  }

  switch (hook.type) {
    case 'command':
      return hook.command
    case 'prompt':
      return hook.prompt
    case 'agent':
      return hook.prompt
    case 'http':
      return hook.url
    case 'callback':
      return 'callback'
    case 'function':
      return 'function'
  }
}

export function getAllHooks(appState: AppState): IndividualHookConfig[] {
  const hooks: IndividualHookConfig[] = []

  // Check if restricted to managed hooks only
  const policySettings = getSettingsForSource('policySettings')
  const restrictedToManagedOnly = policySettings?.allowManagedHooksOnly === true

  // If allowManagedHooksOnly is set, don't show any hooks in the UI
  // (user/project/local are blocked, and managed hooks are intentionally hidden)
  if (!restrictedToManagedOnly) {
    // Get hooks from all editable sources
    const sources = [
      'userSettings',
      'projectSettings',
      'localSettings',
    ] as EditableSettingSource[]

    // Track which settings files we've already processed to avoid duplicates
    // (e.g., when running from home directory, userSettings and projectSettings
    // both resolve to ~/.claude/settings.json)
    const seenFiles = new Set<string>()

    for (const source of sources) {
      const filePath = getSettingsFilePathForSource(source)
      if (filePath) {
        const resolvedPath = resolve(filePath)
        if (seenFiles.has(resolvedPath)) {
          continue
        }
        seenFiles.add(resolvedPath)
      }

      const sourceSettings = getSettingsForSource(source)
      if (!sourceSettings?.hooks) {
        continue
      }

      for (const [event, matchers] of Object.entries(sourceSettings.hooks)) {
        for (const matcher of matchers as HookMatcher[]) {
          for (const hookCommand of matcher.hooks) {
            hooks.push({
              event: event as HookEvent,
              config: hookCommand,
              matcher: matcher.matcher,
              source,
            })
          }
        }
      }
    }
  }

  // Get session hooks
  const sessionId = getSessionId()
  const sessionHooks = getSessionHooks(appState, sessionId)
  for (const [event, matchers] of sessionHooks.entries()) {
    for (const matcher of matchers) {
      for (const hookCommand of matcher.hooks) {
        hooks.push({
          event,
          config: hookCommand,
          matcher: matcher.matcher,
          source: 'sessionHook',
        })
      }
    }
  }

  return hooks
}

export function getHooksForEvent(
  appState: AppState,
  event: HookEvent,
): IndividualHookConfig[] {
  return getAllHooks(appState).filter(hook => hook.event === event)
}

export function hookSourceDescriptionDisplayString(source: HookSource): string {
  switch (source) {
    case 'userSettings':
      return 'User settings (~/.claude/settings.json)'
    case 'projectSettings':
      return 'Project settings (.claude/settings.json)'
    case 'localSettings':
      return 'Local settings (.claude/settings.local.json)'
    case 'pluginHook':
      // TODO: Get the actual plugin hook file paths instead of using glob pattern
      // We should capture the specific plugin paths during hook registration and display them here
      // e.g., "Plugin hooks (~/.claude/plugins/repos/source/example-plugin/example-plugin/hooks/hooks.json)"
      return 'Plugin hooks (~/.claude/plugins/*/hooks/hooks.json)'
    case 'sessionHook':
      return 'Session hooks (in-memory, temporary)'
    case 'builtinHook':
      return 'Built-in hooks (registered internally by Claude Code)'
    default:
      return source as string
  }
}

export function hookSourceHeaderDisplayString(source: HookSource): string {
  switch (source) {
    case 'userSettings':
      return 'User Settings'
    case 'projectSettings':
      return 'Project Settings'
    case 'localSettings':
      return 'Local Settings'
    case 'pluginHook':
      return 'Plugin Hooks'
    case 'sessionHook':
      return 'Session Hooks'
    case 'builtinHook':
      return 'Built-in Hooks'
    default:
      return source as string
  }
}

export function hookSourceInlineDisplayString(source: HookSource): string {
  switch (source) {
    case 'userSettings':
      return 'User'
    case 'projectSettings':
      return 'Project'
    case 'localSettings':
      return 'Local'
    case 'pluginHook':
      return 'Plugin'
    case 'sessionHook':
      return 'Session'
    case 'builtinHook':
      return 'Built-in'
    default:
      return source as string
  }
}

export function sortMatchersByPriority(
  matchers: string[],
  hooksByEventAndMatcher: Record<
    string,
    Record<string, IndividualHookConfig[]>
  >,
  selectedEvent: HookEvent,
): string[] {
  // Create a priority map based on SOURCES order (lower index = higher priority)
  const sourcePriority = SOURCES.reduce(
    (acc, source, index) => {
      acc[source] = index
      return acc
    },
    {} as Record<EditableSettingSource, number>,
  )

  return [...matchers].sort((a, b) => {
    const aHooks = hooksByEventAndMatcher[selectedEvent]?.[a] || []
    const bHooks = hooksByEventAndMatcher[selectedEvent]?.[b] || []

    const aSources = Array.from(new Set(aHooks.map(h => h.source)))
    const bSources = Array.from(new Set(bHooks.map(h => h.source)))

    // Sort by highest priority source first (lowest priority number)
    // Plugin hooks get lowest priority (highest number)
    const getSourcePriority = (source: HookSource) =>
      source === 'pluginHook' || source === 'builtinHook'
        ? 999
        : sourcePriority[source as EditableSettingSource]

    const aHighestPriority = Math.min(...aSources.map(getSourcePriority))
    const bHighestPriority = Math.min(...bSources.map(getSourcePriority))

    if (aHighestPriority !== bHighestPriority) {
      return aHighestPriority - bHighestPriority
    }

    // If same priority, sort by matcher name
    return a.localeCompare(b)
  })
}
