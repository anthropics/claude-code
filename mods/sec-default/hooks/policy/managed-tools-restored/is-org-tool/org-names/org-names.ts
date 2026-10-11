import type { Settings } from 'claude-code'

import { orgPluginNames } from '../org-plugin-names'
import { orgServerNames } from '../org-server-names'

/**
 * Every name whose tools are the organization's: the MCP servers its policy
 * names or delivers, and the plugins it seats itself.
 *
 * Each seated plugin counts twice: by its name, and by its scope
 * (`plugin_<name>`), under which the engine spells the MCP servers the
 * plugin's own manifest declares.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param own the engine-recorded id of the plugin that asks for itself,
 *            whose own name is left out (orgPluginNames)
 * @returns the names, servers first
 */
export const orgNames = (policy: Settings, own?: string): string[] => [
  ...orgServerNames(policy),
  ...orgPluginNames(policy, own).flatMap(name => [name, `plugin_${name}`]),
]
