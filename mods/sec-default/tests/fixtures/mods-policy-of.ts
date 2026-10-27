import type { Settings } from 'claude-code'

/**
 * Managed settings holding `allowManagedModsOnly` at the value given, where
 * an administrator writes it: the built-in's own `pluginConfigs` entry.
 *
 * @param value what the option is set to
 * @returns the managed settings
 */
export const modsPolicyOf = (value: boolean | number | string): Settings => ({
  pluginConfigs: {
    'cc-plugin-sec-default@builtin': {
      options: { allowManagedModsOnly: value },
    },
  },
})
