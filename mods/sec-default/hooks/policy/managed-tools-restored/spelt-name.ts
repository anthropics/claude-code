import { nameOfId } from './is-org-tool/org-plugin-names'

/**
 * A registered tool's name as policy is read against it: one listed by its
 * name alone is told by its plugin's.
 *
 * @param tool the tool's name, as the model sees it
 * @param plugin the name or the id of the plugin that registered it
 * @returns the `mcp__` spelling
 */
export const speltName = (tool: string, plugin: string): string =>
  tool.startsWith('mcp__') ? tool : `mcp__${nameOfId(plugin)}__${tool}`
