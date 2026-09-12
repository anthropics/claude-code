import { z } from 'zod/v4'
import { getSessionId } from '../../bootstrap/state.js'
import { logEvent } from '../../services/analytics/index.js'
import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/metadata.js'
import type { Tool } from '../../Tool.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { formatAgentId } from '../../utils/agentId.js'
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'
import { getCwd } from '../../utils/cwd.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  getDefaultMainLoopModel,
  parseUserSpecifiedModel,
} from '../../utils/model/model.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { getResolvedTeammateMode } from '../../utils/swarm/backends/registry.js'
import { TEAM_LEAD_NAME } from '../../utils/swarm/constants.js'
import type { TeamFile } from '../../utils/swarm/teamHelpers.js'
import {
  getTeamFilePath,
  readTeamFile,
  registerTeamForSessionCleanup,
  sanitizeName,
  writeTeamFileAsync,
} from '../../utils/swarm/teamHelpers.js'
import { assignTeammateColor } from '../../utils/swarm/teammateLayoutManager.js'
import {
  ensureTasksDir,
  resetTaskList,
  setLeaderTeamName,
} from '../../utils/tasks.js'
import { generateWordSlug } from '../../utils/words.js'
import { TEAM_CREATE_TOOL_NAME } from './constants.js'
import { getPrompt } from './prompt.js'
import { renderToolUseMessage } from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    team_name: z.string().describe('Name for the new team to create.'),
    description: z.string().optional().describe('Team description/purpose.'),
    agent_type: z
      .string()
      .optional()
      .describe(
        'Type/role of the team lead (e.g., "researcher", "test-runner"). ' +
          'Used for team file and inter-agent coordination.',
      ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

export type Output = {
  team_name: string
  team_file_path: string
  lead_agent_id: string
}

export type Input = z.infer<InputSchema>

/**
 * Generates a unique team name by checking if the provided name already exists.
 * If the name already exists, generates a new word slug.
 */
function generateUniqueTeamName(providedName: string): string {
  // If the team doesn't exist, use the provided name
  if (!readTeamFile(providedName)) {
    return providedName
  }

  // Team exists, generate a new unique name
  return generateWordSlug()
}

export const TeamCreateTool: Tool<InputSchema, Output> = buildTool({
  name: TEAM_CREATE_TOOL_NAME,
  searchHint: 'create a multi-agent swarm team',
  maxResultSizeChars: 100_000,
  shouldDefer: true,

  userFacingName() {
    return ''
  },

  get inputSchema(): InputSchema {
    return inputSchema()
  },

  isEnabled() {
    return isAgentSwarmsEnabled()
  },

  toAutoClassifierInput(input) {
    return input.team_name
  },

  async validateInput(input, _context) {
    if (!input.team_name || input.team_name.trim().length === 0) {
      return {
        result: false,
        message: 'team_name is required for TeamCreate',
        errorCode: 9,
      }
    }
    return { result: true }
  },

  async description() {
    return 'Create a new team for coordinating multiple agents'
  },

  async prompt() {
    return getPrompt()
  },

  mapToolResultToToolResultBlockParam(data, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: [
        {
          type: 'text' as const,
          text: jsonStringify(data),
        },
      ],
    }
  },

  async call(input, context) {
    const { setAppState, getAppState } = context
    const { team_name, description: _description, agent_type } = input

    // Check if already in a team - restrict to one team per leader
    const appState = getAppState()
    const existingTeam = appState.teamContext?.teamName

    if (existingTeam) {
      throw new Error(
        `Already leading team "${existingTeam}". A leader can only manage one team at a time. Use TeamDelete to end the current team before creating a new one.`,
      )
    }

    // If team already exists, generate a unique name instead of failing
    const finalTeamName = generateUniqueTeamName(team_name)

    // Generate a deterministic agent ID for the team lead
    const leadAgentId = formatAgentId(TEAM_LEAD_NAME, finalTeamName)
    const leadAgentType = agent_type || TEAM_LEAD_NAME
    // Get the team lead's current model from AppState (handles session model, settings, CLI override)
    const leadModel = parseUserSpecifiedModel(
      appState.mainLoopModelForSession ??
        appState.mainLoopModel ??
        getDefaultMainLoopModel(),
    )

    const teamFilePath = getTeamFilePath(finalTeamName)

    const teamFile: TeamFile = {
      name: finalTeamName,
      description: _description,
      createdAt: Date.now(),
      leadAgentId,
      leadSessionId: getSessionId(), // Store actual session ID for team discovery
      members: [
        {
          agentId: leadAgentId,
          name: TEAM_LEAD_NAME,
          agentType: leadAgentType,
          model: leadModel,
          joinedAt: Date.now(),
          tmuxPaneId: '',
          cwd: getCwd(),
          subscriptions: [],
        },
      ],
    }

    await writeTeamFileAsync(finalTeamName, teamFile)
    // Track for session-end cleanup — teams were left on disk forever
    // unless explicitly TeamDelete'd (gh-32730).
    registerTeamForSessionCleanup(finalTeamName)

    // Reset and create the corresponding task list directory (Team = Project = TaskList)
    // This ensures task numbering starts fresh at 1 for each new swarm
    const taskListId = sanitizeName(finalTeamName)
    await resetTaskList(taskListId)
    await ensureTasksDir(taskListId)

    // Register the team name so getTaskListId() returns it for the leader.
    // Without this, the leader falls through to getSessionId() and writes tasks
    // to a different directory than tmux/iTerm2 teammates expect.
    setLeaderTeamName(sanitizeName(finalTeamName))

    // Update AppState with team context
    setAppState(prev => ({
      ...prev,
      teamContext: {
        teamName: finalTeamName,
        teamFilePath,
        leadAgentId,
        teammates: {
          [leadAgentId]: {
            name: TEAM_LEAD_NAME,
            agentType: leadAgentType,
            color: assignTeammateColor(leadAgentId),
            tmuxSessionName: '',
            tmuxPaneId: '',
            cwd: getCwd(),
            spawnedAt: Date.now(),
          },
        },
      },
    }))

    logEvent('tengu_team_created', {
      team_name:
        finalTeamName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      teammate_count: 1,
      lead_agent_type:
        leadAgentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      teammate_mode:
        getResolvedTeammateMode() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })

    // Note: We intentionally don't set CLAUDE_CODE_AGENT_ID for the team lead because:
    // 1. The lead is not a "teammate" - isTeammate() should return false for them
    // 2. Their ID is deterministic (team-lead@teamName) and can be derived when needed
    // 3. Setting it would cause isTeammate() to return true, breaking inbox polling
    // Team name is stored in AppState.teamContext, not process.env

    return {
      data: {
        team_name: finalTeamName,
        team_file_path: teamFilePath,
        lead_agent_id: leadAgentId,
      },
    }
  },

  renderToolUseMessage,
} satisfies ToolDef<InputSchema, Output>)
