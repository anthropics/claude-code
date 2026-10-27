import type { Settings } from 'claude-code'

import Policy from '../policy'
import { serverNameRefusal } from './server-name-refusal.js'
import { TOOL_REGISTER_REFUSAL } from './tool-register-refusal.js'

/**
 * Why managed policy refuses a tool to a plugin a person installed, if it
 * does.
 *
 * Either an MCP allowlist is in force, or the tool would be called by a name
 * that reads as a tool of a server of the organization's.
 *
 * @param policy the managed settings, as `$.settings.read` answers them
 * @param plugin the registering plugin's name
 * @param tool the tool's own name, as the plugin registers it
 * @param id the id the engine recorded for the registering plugin, where
 *           the mod heard its admission
 * @returns the refusal, or undefined when the plugin may add its tool
 */
export const registerRefusalOf = (
  policy: Settings,
  plugin: string,
  tool: string,
  id?: string,
) =>
  Policy.hasMcpAllowlist(policy)
    ? TOOL_REGISTER_REFUSAL
    : Policy.namesOrgTool(policy, plugin, tool, id)
      ? serverNameRefusal(plugin)
      : undefined
