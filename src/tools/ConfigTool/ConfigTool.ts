import { feature } from 'bun:bundle'
import { z } from 'zod/v4'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  type GlobalConfig,
  getGlobalConfig,
  getRemoteControlAtStartup,
  saveGlobalConfig,
} from '../../utils/config.js'
import { errorMessage } from '../../utils/errors.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logError } from '../../utils/log.js'
import {
  getInitialSettings,
  updateSettingsForSource,
} from '../../utils/settings/settings.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { CONFIG_TOOL_NAME } from './constants.js'
import { DESCRIPTION, generatePrompt } from './prompt.js'
import {
  getConfig,
  getOptionsForSetting,
  getPath,
  isSupported,
} from './supportedSettings.js'
import {
  renderToolResultMessage,
  renderToolUseMessage,
  renderToolUseRejectedMessage,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    setting: z
      .string()
      .describe(
        'The setting key (e.g., "theme", "model", "permissions.defaultMode")',
      ),
    value: z
      .union([z.string(), z.boolean(), z.number()])
      .optional()
      .describe('The new value. Omit to get current value.'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean(),
    operation: z.enum(['get', 'set']).optional(),
    setting: z.string().optional(),
    value: z.unknown().optional(),
    previousValue: z.unknown().optional(),
    newValue: z.unknown().optional(),
    error: z.string().optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Input = z.infer<InputSchema>
export type Output = z.infer<OutputSchema>

export const ConfigTool = buildTool({
  name: CONFIG_TOOL_NAME,
  searchHint: 'get or set Claude Code settings (theme, model)',
  maxResultSizeChars: 100_000,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return generatePrompt()
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName() {
    return 'Config'
  },
  shouldDefer: true,
  isConcurrencySafe() {
    return true
  },
  isReadOnly(input: Input) {
    return input.value === undefined
  },
  toAutoClassifierInput(input) {
    return input.value === undefined
      ? input.setting
      : `${input.setting} = ${input.value}`
  },
  async checkPermissions(input: Input) {
    // Auto-allow reading configs
    if (input.value === undefined) {
      return { behavior: 'allow' as const, updatedInput: input }
    }
    return {
      behavior: 'ask' as const,
      message: `Set ${input.setting} to ${jsonStringify(input.value)}`,
    }
  },
  renderToolUseMessage,
  renderToolResultMessage,
  renderToolUseRejectedMessage,
  async call({ setting, value }: Input, context): Promise<{ data: Output }> {
    // 1. Check if setting is supported
    // Voice settings are registered at build-time (feature('VOICE_MODE')), but
    // must also be gated at runtime. When the kill-switch is on, treat
    // voiceEnabled as an unknown setting so no voice-specific strings leak.
    if (feature('VOICE_MODE') && setting === 'voiceEnabled') {
      const { isVoiceGrowthBookEnabled } = await import(
        '../../voice/voiceModeEnabled.js'
      )
      if (!isVoiceGrowthBookEnabled()) {
        return {
          data: { success: false, error: `Unknown setting: "${setting}"` },
        }
      }
    }
    if (!isSupported(setting)) {
      return {
        data: { success: false, error: `Unknown setting: "${setting}"` },
      }
    }

    const config = getConfig(setting)!
    const path = getPath(setting)

    // 2. GET operation
    if (value === undefined) {
      const currentValue = getValue(config.source, path)
      const displayValue = config.formatOnRead
        ? config.formatOnRead(currentValue)
        : currentValue
      return {
        data: { success: true, operation: 'get', setting, value: displayValue },
      }
    }

    // 3. SET operation

    // Handle "default" — unset the config key so it falls back to the
    // platform-aware default (determined by the bridge feature gate).
    if (
      setting === 'remoteControlAtStartup' &&
      typeof value === 'string' &&
      value.toLowerCase().trim() === 'default'
    ) {
      saveGlobalConfig(prev => {
        if (prev.remoteControlAtStartup === undefined) return prev
        const next = { ...prev }
        delete next.remoteControlAtStartup
        return next
      })
      const resolved = getRemoteControlAtStartup()
      // Sync to AppState so useReplBridge reacts immediately
      context.setAppState(prev => {
        if (prev.replBridgeEnabled === resolved && !prev.replBridgeOutboundOnly)
          return prev
        return {
          ...prev,
          replBridgeEnabled: resolved,
          replBridgeOutboundOnly: false,
        }
      })
      return {
        data: {
          success: true,
          operation: 'set',
          setting,
          value: resolved,
        },
      }
    }

    let finalValue: unknown = value

    // Coerce and validate boolean values
    if (config.type === 'boolean') {
      if (typeof value === 'string') {
        const lower = value.toLowerCase().trim()
        if (lower === 'true') finalValue = true
        else if (lower === 'false') finalValue = false
      }
      if (typeof finalValue !== 'boolean') {
        return {
          data: {
            success: false,
            operation: 'set',
            setting,
            error: `${setting} requires true or false.`,
          },
        }
      }
    }

    // Check options
    const options = getOptionsForSetting(setting)
    if (options && !options.includes(String(finalValue))) {
      return {
        data: {
          success: false,
          operation: 'set',
          setting,
          error: `Invalid value "${value}". Options: ${options.join(', ')}`,
        },
      }
    }

    // Async validation (e.g., model API check)
    if (config.validateOnWrite) {
      const result = await config.validateOnWrite(finalValue)
      if (!result.valid) {
        return {
          data: {
            success: false,
            operation: 'set',
            setting,
            error: result.error,
          },
        }
      }
    }

    // Pre-flight checks for voice mode
    if (
      feature('VOICE_MODE') &&
      setting === 'voiceEnabled' &&
      finalValue === true
    ) {
      const { isVoiceModeEnabled } = await import(
        '../../voice/voiceModeEnabled.js'
      )
      if (!isVoiceModeEnabled()) {
        const { isAnthropicAuthEnabled } = await import('../../utils/auth.js')
        return {
          data: {
            success: false,
            error: !isAnthropicAuthEnabled()
              ? 'Voice mode requires a Claude.ai account. Please run /login to sign in.'
              : 'Voice mode is not available.',
          },
        }
      }
      const { isVoiceStreamAvailable } = await import(
        '../../services/voiceStreamSTT.js'
      )
      const {
        checkRecordingAvailability,
        checkVoiceDependencies,
        requestMicrophonePermission,
      } = await import('../../services/voice.js')

      const recording = await checkRecordingAvailability()
      if (!recording.available) {
        return {
          data: {
            success: false,
            error:
              recording.reason ??
              'Voice mode is not available in this environment.',
          },
        }
      }
      if (!isVoiceStreamAvailable()) {
        return {
          data: {
            success: false,
            error:
              'Voice mode requires a Claude.ai account. Please run /login to sign in.',
          },
        }
      }
      const deps = await checkVoiceDependencies()
      if (!deps.available) {
        return {
          data: {
            success: false,
            error:
              'No audio recording tool found.' +
              (deps.installCommand ? ` Run: ${deps.installCommand}` : ''),
          },
        }
      }
      if (!(await requestMicrophonePermission())) {
        let guidance: string
        if (process.platform === 'win32') {
          guidance = 'Settings \u2192 Privacy \u2192 Microphone'
        } else if (process.platform === 'linux') {
          guidance = "your system's audio settings"
        } else {
          guidance =
            'System Settings \u2192 Privacy & Security \u2192 Microphone'
        }
        return {
          data: {
            success: false,
            error: `Microphone access is denied. To enable it, go to ${guidance}, then try again.`,
          },
        }
      }
    }

    const previousValue = getValue(config.source, path)

    // 4. Write to storage
    try {
      if (config.source === 'global') {
        const key = path[0]
        if (!key) {
          return {
            data: {
              success: false,
              operation: 'set',
              setting,
              error: 'Invalid setting path',
            },
          }
        }
        saveGlobalConfig(prev => {
          if (prev[key as keyof GlobalConfig] === finalValue) return prev
          return { ...prev, [key]: finalValue }
        })
      } else {
        const update = buildNestedObject(path, finalValue)
        const result = updateSettingsForSource('userSettings', update)
        if (result.error) {
          return {
            data: {
              success: false,
              operation: 'set',
              setting,
              error: result.error.message,
            },
          }
        }
      }

      // 5a. Voice needs notifyChange so applySettingsChange resyncs
      // AppState.settings (useVoiceEnabled reads settings.voiceEnabled)
      // and the settings cache resets for the next /voice read.
      if (feature('VOICE_MODE') && setting === 'voiceEnabled') {
        const { settingsChangeDetector } = await import(
          '../../utils/settings/changeDetector.js'
        )
        settingsChangeDetector.notifyChange('userSettings')
      }

      // 5b. Sync to AppState if needed for immediate UI effect
      if (config.appStateKey) {
        const appKey = config.appStateKey
        context.setAppState(prev => {
          if (prev[appKey] === finalValue) return prev
          return { ...prev, [appKey]: finalValue }
        })
      }

      // Sync remoteControlAtStartup to AppState so the bridge reacts
      // immediately (the config key differs from the AppState field name,
      // so the generic appStateKey mechanism can't handle this).
      if (setting === 'remoteControlAtStartup') {
        const resolved = getRemoteControlAtStartup()
        context.setAppState(prev => {
          if (
            prev.replBridgeEnabled === resolved &&
            !prev.replBridgeOutboundOnly
          )
            return prev
          return {
            ...prev,
            replBridgeEnabled: resolved,
            replBridgeOutboundOnly: false,
          }
        })
      }

      logEvent('tengu_config_tool_changed', {
        setting:
          setting as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        value: String(
          finalValue,
        ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })

      return {
        data: {
          success: true,
          operation: 'set',
          setting,
          previousValue,
          newValue: finalValue,
        },
      }
    } catch (error) {
      logError(error)
      return {
        data: {
          success: false,
          operation: 'set',
          setting,
          error: errorMessage(error),
        },
      }
    }
  },
  mapToolResultToToolResultBlockParam(content: Output, toolUseID: string) {
    if (content.success) {
      if (content.operation === 'get') {
        return {
          tool_use_id: toolUseID,
          type: 'tool_result' as const,
          content: `${content.setting} = ${jsonStringify(content.value)}`,
        }
      }
      return {
        tool_use_id: toolUseID,
        type: 'tool_result' as const,
        content: `Set ${content.setting} to ${jsonStringify(content.newValue)}`,
      }
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: `Error: ${content.error}`,
      is_error: true,
    }
  },
} satisfies ToolDef<InputSchema, Output>)

function getValue(source: 'global' | 'settings', path: string[]): unknown {
  if (source === 'global') {
    const config = getGlobalConfig()
    const key = path[0]
    if (!key) return undefined
    return config[key as keyof GlobalConfig]
  }
  const settings = getInitialSettings()
  let current: unknown = settings
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

function buildNestedObject(
  path: string[],
  value: unknown,
): Record<string, unknown> {
  if (path.length === 0) {
    return {}
  }
  const key = path[0]!
  if (path.length === 1) {
    return { [key]: value }
  }
  return { [key]: buildNestedObject(path.slice(1), value) }
}
