/**
 * Where managed settings hold this plugin's options: its own `pluginConfigs`
 * entry, keyed by the id the CLI builds it in under.
 */
export const OWN_OPTIONS_PATH = [
  'pluginConfigs',
  'cc-plugin-sec-default@builtin',
  'options',
] as const
