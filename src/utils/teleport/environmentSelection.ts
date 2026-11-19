import { SETTING_SOURCES, type SettingSource } from '../settings/constants.js'
import {
  getSettings_DEPRECATED,
  getSettingsForSource,
} from '../settings/settings.js'
import { type EnvironmentResource, fetchEnvironments } from './environments.js'

export type EnvironmentSelectionInfo = {
  availableEnvironments: EnvironmentResource[]
  selectedEnvironment: EnvironmentResource | null
  selectedEnvironmentSource: SettingSource | null
}

/**
 * Gets information about available environments and the currently selected one.
 *
 * @returns Promise<EnvironmentSelectionInfo> containing:
 *   - availableEnvironments: all environments from the API
 *   - selectedEnvironment: the environment that would be used (based on settings or first available),
 *     or null if no environments are available
 *   - selectedEnvironmentSource: the SettingSource where defaultEnvironmentId is configured,
 *     or null if using the default (first environment)
 */
export async function getEnvironmentSelectionInfo(): Promise<EnvironmentSelectionInfo> {
  // Fetch available environments
  const environments = await fetchEnvironments()

  if (environments.length === 0) {
    return {
      availableEnvironments: [],
      selectedEnvironment: null,
      selectedEnvironmentSource: null,
    }
  }

  // Get the merged settings to see what would actually be used
  const mergedSettings = getSettings_DEPRECATED()
  const defaultEnvironmentId = mergedSettings?.remote?.defaultEnvironmentId

  // Find which environment would be selected
  let selectedEnvironment: EnvironmentResource =
    environments.find(env => env.kind !== 'bridge') ?? environments[0]!
  let selectedEnvironmentSource: SettingSource | null = null

  if (defaultEnvironmentId) {
    const matchingEnvironment = environments.find(
      env => env.environment_id === defaultEnvironmentId,
    )

    if (matchingEnvironment) {
      selectedEnvironment = matchingEnvironment

      // Find which source has this setting
      // Iterate from lowest to highest priority, so the last match wins (highest priority)
      for (let i = SETTING_SOURCES.length - 1; i >= 0; i--) {
        const source = SETTING_SOURCES[i]
        if (!source || source === 'flagSettings') {
          // Skip flagSettings as it's not a normal source we check
          continue
        }
        const sourceSettings = getSettingsForSource(source)
        if (
          sourceSettings?.remote?.defaultEnvironmentId === defaultEnvironmentId
        ) {
          selectedEnvironmentSource = source
          break
        }
      }
    }
  }

  return {
    availableEnvironments: environments,
    selectedEnvironment,
    selectedEnvironmentSource,
  }
}
