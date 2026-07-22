import { createHash } from 'crypto'
import { join } from 'path'
import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'
import type { AgentMcpServerInfo } from '../../components/mcp/types.js'
import type { Tool } from '../../Tool.js'
import type { AgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js'
import { getCwd } from '../../utils/cwd.js'
import { getGlobalClaudeFile } from '../../utils/env.js'
import { isSettingSourceEnabled } from '../../utils/settings/constants.js'
import {
  getSettings_DEPRECATED,
  hasSkipDangerousModePermissionPrompt,
} from '../../utils/settings/settings.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { getEnterpriseMcpFilePath, getMcpConfigByName } from './config.js'
import { mcpInfoFromString } from './mcpStringUtils.js'
import { normalizeNameForMCP } from './normalization.js'
import {
  type ConfigScope,
  ConfigScopeSchema,
  type MCPServerConnection,
  type McpHTTPServerConfig,
  type McpServerConfig,
  type McpSSEServerConfig,
  type McpStdioServerConfig,
  type McpWebSocketServerConfig,
  type ScopedMcpServerConfig,
  type ServerResource,
} from './types.js'

/**
 * Filters tools by MCP server name
 *
 * @param tools Array of tools to filter
 * @param serverName Name of the MCP server
 * @returns Tools belonging to the specified server
 */
export function filterToolsByServer(tools: Tool[], serverName: string): Tool[] {
  const prefix = `mcp__${normalizeNameForMCP(serverName)}__`
  return tools.filter(tool => tool.name?.startsWith(prefix))
}

/**
 * True when a command belongs to the given MCP server.
 *
 * MCP **prompts** are named `mcp__<server>__<prompt>` (wire-format constraint);
 * MCP **skills** are named `<server>:<skill>` (matching plugin/nested-dir skill
 * naming). Both live in `mcp.commands`, so cleanup and filtering must match
 * either shape.
 */
export function commandBelongsToServer(
  command: Command,
  serverName: string,
): boolean {
  const normalized = normalizeNameForMCP(serverName)
  const name = command.name
  if (!name) return false
  return (
    name.startsWith(`mcp__${normalized}__`) || name.startsWith(`${normalized}:`)
  )
}

/**
 * Filters commands by MCP server name
 * @param commands Array of commands to filter
 * @param serverName Name of the MCP server
 * @returns Commands belonging to the specified server
 */
export function filterCommandsByServer(
  commands: Command[],
  serverName: string,
): Command[] {
  return commands.filter(c => commandBelongsToServer(c, serverName))
}

/**
 * Filters MCP **prompts** (not skills) by server. Used by the `/mcp` menu
 * capabilities display — skills are a separate feature shown in `/skills`,
 * so they mustn't inflate the "prompts" capability badge.
 *
 * The distinguisher is `loadedFrom === 'mcp'`: MCP skills set it, MCP
 * prompts don't (they use `isMcp: true` instead).
 */
export function filterMcpPromptsByServer(
  commands: Command[],
  serverName: string,
): Command[] {
  return commands.filter(
    c =>
      commandBelongsToServer(c, serverName) &&
      !(c.type === 'prompt' && c.loadedFrom === 'mcp'),
  )
}

/**
 * Filters resources by MCP server name
 * @param resources Array of resources to filter
 * @param serverName Name of the MCP server
 * @returns Resources belonging to the specified server
 */
export function filterResourcesByServer(
  resources: ServerResource[],
  serverName: string,
): ServerResource[] {
  return resources.filter(resource => resource.server === serverName)
}

/**
 * Removes tools belonging to a specific MCP server
 * @param tools Array of tools
 * @param serverName Name of the MCP server to exclude
 * @returns Tools not belonging to the specified server
 */
export function excludeToolsByServer(
  tools: Tool[],
  serverName: string,
): Tool[] {
  const prefix = `mcp__${normalizeNameForMCP(serverName)}__`
  return tools.filter(tool => !tool.name?.startsWith(prefix))
}

/**
 * Removes commands belonging to a specific MCP server
 * @param commands Array of commands
 * @param serverName Name of the MCP server to exclude
 * @returns Commands not belonging to the specified server
 */
export function excludeCommandsByServer(
  commands: Command[],
  serverName: string,
): Command[] {
  return commands.filter(c => !commandBelongsToServer(c, serverName))
}

/**
 * Removes resources belonging to a specific MCP server
 * @param resources Map of server resources
 * @param serverName Name of the MCP server to exclude
 * @returns Resources map without the specified server
 */
export function excludeResourcesByServer(
  resources: Record<string, ServerResource[]>,
  serverName: string,
): Record<string, ServerResource[]> {
  const result = { ...resources }
  delete result[serverName]
  return result
}

/**
 * Stable hash of an MCP server config for change detection on /reload-plugins.
 * Excludes `scope` (provenance, not content — moving a server from .mcp.json
 * to settings.json shouldn't reconnect it). Keys sorted so `{a:1,b:2}` and
 * `{b:2,a:1}` hash the same.
 */
export function hashMcpConfig(config: ScopedMcpServerConfig): string {
  const { scope: _scope, ...rest } = config
  const stable = jsonStringify(rest, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(obj).sort()) sorted[k] = obj[k]
      return sorted
    }
    return v
  })
  return createHash('sha256').update(stable).digest('hex').slice(0, 16)
}

/**
 * Remove stale MCP clients and their tools/commands/resources. A client is
 * stale if:
 *   - scope 'dynamic' and name no longer in configs (plugin disabled), or
 *   - config hash changed (args/url/env edited in .mcp.json) — any scope
 *
 * The removal case is scoped to 'dynamic' so /reload-plugins can't
 * accidentally disconnect a user-configured server that's just temporarily
 * absent from the in-memory config (e.g. during a partial reload). The
 * config-changed case applies to all scopes — if the config actually changed
 * on disk, reconnecting is what you want.
 *
 * Returns the stale clients so the caller can disconnect them (clearServerCache).
 */
export function excludeStalePluginClients(
  mcp: {
    clients: MCPServerConnection[]
    tools: Tool[]
    commands: Command[]
    resources: Record<string, ServerResource[]>
  },
  configs: Record<string, ScopedMcpServerConfig>,
): {
  clients: MCPServerConnection[]
  tools: Tool[]
  commands: Command[]
  resources: Record<string, ServerResource[]>
  stale: MCPServerConnection[]
} {
  const stale = mcp.clients.filter(c => {
    const fresh = configs[c.name]
    if (!fresh) return c.config.scope === 'dynamic'
    return hashMcpConfig(c.config) !== hashMcpConfig(fresh)
  })
  if (stale.length === 0) {
    return { ...mcp, stale: [] }
  }

  let { tools, commands, resources } = mcp
  for (const s of stale) {
    tools = excludeToolsByServer(tools, s.name)
    commands = excludeCommandsByServer(commands, s.name)
    resources = excludeResourcesByServer(resources, s.name)
  }
  const staleNames = new Set(stale.map(c => c.name))

  return {
    clients: mcp.clients.filter(c => !staleNames.has(c.name)),
    tools,
    commands,
    resources,
    stale,
  }
}

/**
 * Checks if a tool name belongs to a specific MCP server
 * @param toolName The tool name to check
 * @param serverName The server name to match against
 * @returns True if the tool belongs to the specified server
 */
export function isToolFromMcpServer(
  toolName: string,
  serverName: string,
): boolean {
  const info = mcpInfoFromString(toolName)
  return info?.serverName === serverName
}

/**
 * Checks if a tool belongs to any MCP server
 * @param tool The tool to check
 * @returns True if the tool is from an MCP server
 */
export function isMcpTool(tool: Tool): boolean {
  return tool.name?.startsWith('mcp__') || tool.isMcp === true
}

/**
 * Checks if a command belongs to any MCP server
 * @param command The command to check
 * @returns True if the command is from an MCP server
 */
export function isMcpCommand(command: Command): boolean {
  return command.name?.startsWith('mcp__') || command.isMcp === true
}

/**
 * Describe the file path for a given MCP config scope.
 * @param scope The config scope ('user', 'project', 'local', or 'dynamic')
 * @returns A description of where the config is stored
 */
export function describeMcpConfigFilePath(scope: ConfigScope): string {
  switch (scope) {
    case 'user':
      return getGlobalClaudeFile()
    case 'project':
      return join(getCwd(), '.mcp.json')
    case 'local':
      return `${getGlobalClaudeFile()} [project: ${getCwd()}]`
    case 'dynamic':
      return 'Dynamically configured'
    case 'enterprise':
      return getEnterpriseMcpFilePath()
    case 'claudeai':
      return 'claude.ai'
    default:
      return scope
  }
}

export function getScopeLabel(scope: ConfigScope): string {
  switch (scope) {
    case 'local':
      return 'Local config (private to you in this project)'
    case 'project':
      return 'Project config (shared via .mcp.json)'
    case 'user':
      return 'User config (available in all your projects)'
    case 'dynamic':
      return 'Dynamic config (from command line)'
    case 'enterprise':
      return 'Enterprise config (managed by your organization)'
    case 'claudeai':
      return 'claude.ai config'
    default:
      return scope
  }
}

export function ensureConfigScope(scope?: string): ConfigScope {
  if (!scope) return 'local'

  if (!ConfigScopeSchema().options.includes(scope as ConfigScope)) {
    throw new Error(
      `Invalid scope: ${scope}. Must be one of: ${ConfigScopeSchema().options.join(', ')}`,
    )
  }

  return scope as ConfigScope
}

export function ensureTransport(type?: string): 'stdio' | 'sse' | 'http' {
  if (!type) return 'stdio'

  if (type !== 'stdio' && type !== 'sse' && type !== 'http') {
    throw new Error(
      `Invalid transport type: ${type}. Must be one of: stdio, sse, http`,
    )
  }

  return type as 'stdio' | 'sse' | 'http'
}

export function parseHeaders(headerArray: string[]): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const header of headerArray) {
    const colonIndex = header.indexOf(':')
    if (colonIndex === -1) {
      throw new Error(
        `Invalid header format: "${header}". Expected format: "Header-Name: value"`,
      )
    }

    const key = header.substring(0, colonIndex).trim()
    const value = header.substring(colonIndex + 1).trim()

    if (!key) {
      throw new Error(
        `Invalid header: "${header}". Header name cannot be empty.`,
      )
    }

    headers[key] = value
  }

  return headers
}

export function getProjectMcpServerStatus(
  serverName: string,
): 'approved' | 'rejected' | 'pending' {
  const settings = getSettings_DEPRECATED()
  const normalizedName = normalizeNameForMCP(serverName)

  // TODO: This fails an e2e test if the ?. is not present. This is likely a bug in the e2e test.
  // Will fix this in a follow-up PR.
  if (
    settings?.disabledMcpjsonServers?.some(
      name => normalizeNameForMCP(name) === normalizedName,
    )
  ) {
    return 'rejected'
  }

  if (
    settings?.enabledMcpjsonServers?.some(
      name => normalizeNameForMCP(name) === normalizedName,
    ) ||
    settings?.enableAllProjectMcpServers
  ) {
    return 'approved'
  }

  // In bypass permissions mode (--dangerously-skip-permissions), there's no way
  // to show an approval popup. Auto-approve if projectSettings is enabled since
  // the user has explicitly chosen to bypass all permission checks.
  // SECURITY: We intentionally only check skipDangerousModePermissionPrompt via
  // hasSkipDangerousModePermissionPrompt(), which reads from userSettings/localSettings/
  // flagSettings/policySettings but NOT projectSettings (repo-level .claude/settings.json).
  // This is intentional: a repo should not be able to accept the bypass dialog on behalf of
  // users. We also do NOT check getSessionBypassPermissionsMode() here because
  // sessionBypassPermissionsMode can be set from project settings before the dialog is shown,
  // which would allow RCE attacks via malicious project settings.
  if (
    hasSkipDangerousModePermissionPrompt() &&
    isSettingSourceEnabled('projectSettings')
  ) {
    return 'approved'
  }

  // In non-interactive mode (SDK, claude -p, piped input), there's no way to
  // show an approval popup. Auto-approve if projectSettings is enabled since:
  // 1. The user/developer explicitly chose to run in this mode
  // 2. For SDK, projectSettings is off by default - they must explicitly enable it
  // 3. For -p mode, the help text warns to only use in trusted directories
  if (
    getIsNonInteractiveSession() &&
    isSettingSourceEnabled('projectSettings')
  ) {
    return 'approved'
  }

  return 'pending'
}

/**
 * Get the scope/settings source for an MCP server from a tool name
 * @param toolName MCP tool name (format: mcp__serverName__toolName)
 * @returns ConfigScope or null if not an MCP tool or server not found
 */
export function getMcpServerScopeFromToolName(
  toolName: string,
): ConfigScope | null {
  if (!isMcpTool({ name: toolName } as Tool)) {
    return null
  }

  // Extract server name from tool name (format: mcp__serverName__toolName)
  const mcpInfo = mcpInfoFromString(toolName)
  if (!mcpInfo) {
    return null
  }

  // Look up server config
  const serverConfig = getMcpConfigByName(mcpInfo.serverName)

  // Fallback: claude.ai servers have normalized names starting with "claude_ai_"
  // but aren't in getMcpConfigByName (they're fetched async separately)
  if (!serverConfig && mcpInfo.serverName.startsWith('claude_ai_')) {
    return 'claudeai'
  }

  return serverConfig?.scope ?? null
}

// Type guards for MCP server config types
function isStdioConfig(
  config: McpServerConfig,
): config is McpStdioServerConfig {
  return config.type === 'stdio' || config.type === undefined
}

function isSSEConfig(config: McpServerConfig): config is McpSSEServerConfig {
  return config.type === 'sse'
}

function isHTTPConfig(config: McpServerConfig): config is McpHTTPServerConfig {
  return config.type === 'http'
}

function isWebSocketConfig(
  config: McpServerConfig,
): config is McpWebSocketServerConfig {
  return config.type === 'ws'
}

/**
 * Extracts MCP server definitions from agent frontmatter and groups them by server name.
 * This is used to show agent-specific MCP servers in the /mcp command.
 *
 * @param agents Array of agent definitions
 * @returns Array of AgentMcpServerInfo, grouped by server name with list of source agents
 */
export function extractAgentMcpServers(
  agents: AgentDefinition[],
): AgentMcpServerInfo[] {
  // Map: server name -> { config, sourceAgents }
  const serverMap = new Map<
    string,
    {
      config: McpServerConfig & { name: string }
      sourceAgents: string[]
    }
  >()

  for (const agent of agents) {
    if (!agent.mcpServers?.length) continue

    for (const spec of agent.mcpServers) {
      // Skip string references - these refer to servers already in global config
      if (typeof spec === 'string') continue

      // Inline definition as { [name]: config }
      const entries = Object.entries(spec)
      if (entries.length !== 1) continue

      const [serverName, serverConfig] = entries[0]!
      const existing = serverMap.get(serverName)

      if (existing) {
        // Add this agent as another source
        if (!existing.sourceAgents.includes(agent.agentType)) {
          existing.sourceAgents.push(agent.agentType)
        }
      } else {
        // New server
        serverMap.set(serverName, {
          config: { ...serverConfig, name: serverName } as McpServerConfig & {
            name: string
          },
          sourceAgents: [agent.agentType],
        })
      }
    }
  }

  // Convert map to array of AgentMcpServerInfo
  // Only include transport types supported by AgentMcpServerInfo
  const result: AgentMcpServerInfo[] = []
  for (const [name, { config, sourceAgents }] of serverMap) {
    // Use type guards to properly narrow the discriminated union type
    // Only include transport types that are supported by AgentMcpServerInfo
    if (isStdioConfig(config)) {
      result.push({
        name,
        sourceAgents,
        transport: 'stdio',
        command: config.command,
        needsAuth: false,
      })
    } else if (isSSEConfig(config)) {
      result.push({
        name,
        sourceAgents,
        transport: 'sse',
        url: config.url,
        needsAuth: true,
      })
    } else if (isHTTPConfig(config)) {
      result.push({
        name,
        sourceAgents,
        transport: 'http',
        url: config.url,
        needsAuth: true,
      })
    } else if (isWebSocketConfig(config)) {
      result.push({
        name,
        sourceAgents,
        transport: 'ws',
        url: config.url,
        needsAuth: false,
      })
    }
    // Skip unsupported transport types (sdk, claudeai-proxy, sse-ide, ws-ide)
    // These are internal types not meant for agent MCP server display
  }

  return result.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Extracts the MCP server base URL (without query string) for analytics logging.
 * Query strings are stripped because they can contain access tokens.
 * Trailing slashes are also removed for normalization.
 * Returns undefined for stdio/sdk servers or if URL parsing fails.
 */
export function getLoggingSafeMcpBaseUrl(
  config: McpServerConfig,
): string | undefined {
  if (!('url' in config) || typeof config.url !== 'string') {
    return undefined
  }

  try {
    const url = new URL(config.url)
    url.search = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return undefined
  }
}
