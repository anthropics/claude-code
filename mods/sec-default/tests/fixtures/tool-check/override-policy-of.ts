import type { Settings } from 'claude-code'

/**
 * Settings that carry this plugin's own `allowModsToOverrideDenyRules`
 * option with the value given, where managed settings hold it.
 *
 * @param value what the option is set to
 * @returns the settings
 */
export const overridePolicyOf = (value: unknown): Settings => ({
  pluginConfigs: {
    'cc-plugin-sec-default@builtin': {
      options: { allowModsToOverrideDenyRules: value },
    },
  },
})
