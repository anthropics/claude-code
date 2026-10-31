import memoize from 'lodash-es/memoize.js'
import { basename } from 'path'
import { isAutoMemoryEnabled } from '../../memdir/paths.js'
import type { AgentColorName } from '../../tools/AgentTool/agentColorManager.js'
import {
  type AgentMemoryScope,
  loadAgentMemoryPrompt,
} from '../../tools/AgentTool/agentMemory.js'
import type { AgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js'
import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../../tools/FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../../tools/FileWriteTool/prompt.js'
import { getPluginErrorMessage } from '../../types/plugin.js'
import { logForDebugging } from '../debug.js'
import { EFFORT_LEVELS, parseEffortValue } from '../effort.js'
import {
  coerceDescriptionToString,
  parseFrontmatter,
  parsePositiveIntFromFrontmatter,
} from '../frontmatterParser.js'
import { getFsImplementation, isDuplicatePath } from '../fsOperations.js'
import {
  parseAgentToolsFromFrontmatter,
  parseSlashCommandToolsFromFrontmatter,
} from '../markdownConfigLoader.js'
import { loadAllPluginsCacheOnly } from './pluginLoader.js'
import {
  loadPluginOptions,
  substitutePluginVariables,
  substituteUserConfigInContent,
} from './pluginOptionsStorage.js'
import type { PluginManifest } from './schemas.js'
import { walkPluginMarkdown } from './walkPluginMarkdown.js'

const VALID_MEMORY_SCOPES: AgentMemoryScope[] = ['user', 'project', 'local']

async function loadAgentsFromDirectory(
  agentsPath: string,
  pluginName: string,
  sourceName: string,
  pluginPath: string,
  pluginManifest: PluginManifest,
  loadedPaths: Set<string>,
): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = []
  await walkPluginMarkdown(
    agentsPath,
    async (fullPath, namespace) => {
      const agent = await loadAgentFromFile(
        fullPath,
        pluginName,
        namespace,
        sourceName,
        pluginPath,
        pluginManifest,
        loadedPaths,
      )
      if (agent) agents.push(agent)
    },
    { logLabel: 'agents' },
  )
  return agents
}

async function loadAgentFromFile(
  filePath: string,
  pluginName: string,
  namespace: string[],
  sourceName: string,
  pluginPath: string,
  pluginManifest: PluginManifest,
  loadedPaths: Set<string>,
): Promise<AgentDefinition | null> {
  const fs = getFsImplementation()
  if (isDuplicatePath(fs, filePath, loadedPaths)) {
    return null
  }
  try {
    const content = await fs.readFile(filePath, { encoding: 'utf-8' })
    const { frontmatter, content: markdownContent } = parseFrontmatter(
      content,
      filePath,
    )

    const baseAgentName =
      (frontmatter.name as string) || basename(filePath).replace(/\.md$/, '')

    // Apply namespace prefixing like we do for commands
    const nameParts = [pluginName, ...namespace, baseAgentName]
    const agentType = nameParts.join(':')

    // Parse agent metadata from frontmatter
    const whenToUse =
      coerceDescriptionToString(frontmatter.description, agentType) ??
      coerceDescriptionToString(frontmatter['when-to-use'], agentType) ??
      `Agent from ${pluginName} plugin`

    let tools = parseAgentToolsFromFrontmatter(frontmatter.tools)
    const skills = parseSlashCommandToolsFromFrontmatter(frontmatter.skills)
    const color = frontmatter.color as AgentColorName | undefined
    const modelRaw = frontmatter.model
    let model: string | undefined
    if (typeof modelRaw === 'string' && modelRaw.trim().length > 0) {
      const trimmed = modelRaw.trim()
      model = trimmed.toLowerCase() === 'inherit' ? 'inherit' : trimmed
    }
    const backgroundRaw = frontmatter.background
    const background =
      backgroundRaw === 'true' || backgroundRaw === true ? true : undefined
    // Substitute ${CLAUDE_PLUGIN_ROOT} so agents can reference bundled files,
    // and ${user_config.X} (non-sensitive only) so they can embed configured
    // usernames, endpoints, etc. Sensitive refs resolve to a placeholder.
    let systemPrompt = substitutePluginVariables(markdownContent.trim(), {
      path: pluginPath,
      source: sourceName,
    })
    if (pluginManifest.userConfig) {
      systemPrompt = substituteUserConfigInContent(
        systemPrompt,
        loadPluginOptions(sourceName),
        pluginManifest.userConfig,
      )
    }

    // Parse memory scope
    const memoryRaw = frontmatter.memory as string | undefined
    let memory: AgentMemoryScope | undefined
    if (memoryRaw !== undefined) {
      if (VALID_MEMORY_SCOPES.includes(memoryRaw as AgentMemoryScope)) {
        memory = memoryRaw as AgentMemoryScope
      } else {
        logForDebugging(
          `Plugin agent file ${filePath} has invalid memory value '${memoryRaw}'. Valid options: ${VALID_MEMORY_SCOPES.join(', ')}`,
        )
      }
    }

    // Parse isolation mode
    const isolationRaw = frontmatter.isolation as string | undefined
    const isolation =
      isolationRaw === 'worktree' ? ('worktree' as const) : undefined

    // Parse effort (string level or integer)
    const effortRaw = frontmatter.effort
    const effort =
      effortRaw !== undefined ? parseEffortValue(effortRaw) : undefined
    if (effortRaw !== undefined && effort === undefined) {
      logForDebugging(
        `Plugin agent file ${filePath} has invalid effort '${effortRaw}'. Valid options: ${EFFORT_LEVELS.join(', ')} or an integer`,
      )
    }

    // permissionMode, hooks, and mcpServers are intentionally NOT parsed for
    // plugin agents. Plugins are third-party marketplace code; these fields
    // escalate what the agent can do beyond what the user approved at install
    // time. For this level of control, define the agent in .claude/agents/
    // where the user explicitly wrote the frontmatter. (Note: plugins can
    // still ship hooks and MCP servers at the manifest level — that's the
    // install-time trust boundary. Per-agent declarations would let a single
    // agent file buried in agents/ silently add them.) See PR #22558 review.
    for (const field of ['permissionMode', 'hooks', 'mcpServers'] as const) {
      if (frontmatter[field] !== undefined) {
        logForDebugging(
          `Plugin agent file ${filePath} sets ${field}, which is ignored for plugin agents. Use .claude/agents/ for this level of control.`,
          { level: 'warn' },
        )
      }
    }

    // Parse maxTurns
    const maxTurnsRaw = frontmatter.maxTurns
    const maxTurns = parsePositiveIntFromFrontmatter(maxTurnsRaw)
    if (maxTurnsRaw !== undefined && maxTurns === undefined) {
      logForDebugging(
        `Plugin agent file ${filePath} has invalid maxTurns '${maxTurnsRaw}'. Must be a positive integer.`,
      )
    }

    // Parse disallowedTools
    const disallowedTools =
      frontmatter.disallowedTools !== undefined
        ? parseAgentToolsFromFrontmatter(frontmatter.disallowedTools)
        : undefined

    // If memory is enabled, inject Write/Edit/Read tools for memory access
    if (isAutoMemoryEnabled() && memory && tools !== undefined) {
      const toolSet = new Set(tools)
      for (const tool of [
        FILE_WRITE_TOOL_NAME,
        FILE_EDIT_TOOL_NAME,
        FILE_READ_TOOL_NAME,
      ]) {
        if (!toolSet.has(tool)) {
          tools = [...tools, tool]
        }
      }
    }

    return {
      agentType,
      whenToUse,
      tools,
      ...(disallowedTools !== undefined ? { disallowedTools } : {}),
      ...(skills !== undefined ? { skills } : {}),
      getSystemPrompt: () => {
        if (isAutoMemoryEnabled() && memory) {
          const memoryPrompt = loadAgentMemoryPrompt(agentType, memory)
          return systemPrompt + '\n\n' + memoryPrompt
        }
        return systemPrompt
      },
      source: 'plugin' as const,
      color,
      model,
      filename: baseAgentName,
      plugin: sourceName,
      ...(background ? { background } : {}),
      ...(memory ? { memory } : {}),
      ...(isolation ? { isolation } : {}),
      ...(effort !== undefined ? { effort } : {}),
      ...(maxTurns !== undefined ? { maxTurns } : {}),
    } as AgentDefinition
  } catch (error) {
    logForDebugging(`Failed to load agent from ${filePath}: ${error}`, {
      level: 'error',
    })
    return null
  }
}

export const loadPluginAgents = memoize(
  async (): Promise<AgentDefinition[]> => {
    // Only load agents from enabled plugins
    const { enabled, errors } = await loadAllPluginsCacheOnly()

    if (errors.length > 0) {
      logForDebugging(
        `Plugin loading errors: ${errors.map(e => getPluginErrorMessage(e)).join(', ')}`,
      )
    }

    // Process plugins in parallel; each plugin has its own loadedPaths scope
    const perPluginAgents = await Promise.all(
      enabled.map(async (plugin): Promise<AgentDefinition[]> => {
        // Track loaded file paths to prevent duplicates within this plugin
        const loadedPaths = new Set<string>()
        const pluginAgents: AgentDefinition[] = []

        // Load agents from default agents directory
        if (plugin.agentsPath) {
          try {
            const agents = await loadAgentsFromDirectory(
              plugin.agentsPath,
              plugin.name,
              plugin.source,
              plugin.path,
              plugin.manifest,
              loadedPaths,
            )
            pluginAgents.push(...agents)

            if (agents.length > 0) {
              logForDebugging(
                `Loaded ${agents.length} agents from plugin ${plugin.name} default directory`,
              )
            }
          } catch (error) {
            logForDebugging(
              `Failed to load agents from plugin ${plugin.name} default directory: ${error}`,
              { level: 'error' },
            )
          }
        }

        // Load agents from additional paths specified in manifest
        if (plugin.agentsPaths) {
          // Process all agentsPaths in parallel. isDuplicatePath is synchronous
          // (check-and-add), so concurrent access to loadedPaths is safe.
          const pathResults = await Promise.all(
            plugin.agentsPaths.map(
              async (agentPath): Promise<AgentDefinition[]> => {
                try {
                  const fs = getFsImplementation()
                  const stats = await fs.stat(agentPath)

                  if (stats.isDirectory()) {
                    // Load all .md files from directory
                    const agents = await loadAgentsFromDirectory(
                      agentPath,
                      plugin.name,
                      plugin.source,
                      plugin.path,
                      plugin.manifest,
                      loadedPaths,
                    )

                    if (agents.length > 0) {
                      logForDebugging(
                        `Loaded ${agents.length} agents from plugin ${plugin.name} custom path: ${agentPath}`,
                      )
                    }
                    return agents
                  } else if (stats.isFile() && agentPath.endsWith('.md')) {
                    // Load single agent file
                    const agent = await loadAgentFromFile(
                      agentPath,
                      plugin.name,
                      [],
                      plugin.source,
                      plugin.path,
                      plugin.manifest,
                      loadedPaths,
                    )
                    if (agent) {
                      logForDebugging(
                        `Loaded agent from plugin ${plugin.name} custom file: ${agentPath}`,
                      )
                      return [agent]
                    }
                  }
                  return []
                } catch (error) {
                  logForDebugging(
                    `Failed to load agents from plugin ${plugin.name} custom path ${agentPath}: ${error}`,
                    { level: 'error' },
                  )
                  return []
                }
              },
            ),
          )
          for (const agents of pathResults) {
            pluginAgents.push(...agents)
          }
        }
        return pluginAgents
      }),
    )

    const allAgents = perPluginAgents.flat()
    logForDebugging(`Total plugin agents loaded: ${allAgents.length}`)
    return allAgents
  },
)

export function clearPluginAgentCache(): void {
  loadPluginAgents.cache?.clear?.()
}
