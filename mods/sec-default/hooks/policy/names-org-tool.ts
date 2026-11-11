import type { Settings } from 'claude-code'

import { readsAsOrgTool } from './reads-as-org-tool'

/**
 * Whether the tool a plugin registers would read as the organization's: it
 * is called `mcp__<plugin>__<tool>`, read as readsAsOrgTool reads a name.
 *
 * So a plugin named as one of them in any case or with other separators, one
 * whose name and tool together spell a prefix, and one whose tool's own name
 * folds to nothing all count.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param plugin the registering plugin's name
 * @param tool the tool's own name, as the plugin registers it
 * @param id the id the engine recorded for the registering plugin
 *           (`<name>@<source>`), where the mod heard its admission
 * @returns true when the tool would read as the organization's
 */
export function namesOrgTool(
  policy: Settings,
  plugin: string,
  tool: string,
  id?: string,
): boolean {
  return readsAsOrgTool(policy, `mcp__${plugin}__${tool}`, id)
}
