import type { UUID } from 'crypto'
import { getSessionId } from '../../bootstrap/state.js'
import type { ToolUseContext } from '../../Tool.js'
import {
  AGENT_COLORS,
  type AgentColorName,
} from '../../tools/AgentTool/agentColorManager.js'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import {
  getTranscriptPath,
  saveAgentColor,
} from '../../utils/sessionStorage.js'
import { isTeammate } from '../../utils/teammate.js'

const RESET_ALIASES = ['default', 'reset', 'none', 'gray', 'grey'] as const

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
  args: string,
): Promise<null> {
  // Teammates cannot set their own color
  if (isTeammate()) {
    onDone(
      'Cannot set color: This session is a swarm teammate. Teammate colors are assigned by the team leader.',
      { display: 'system' },
    )
    return null
  }

  if (!args || args.trim() === '') {
    const colorList = AGENT_COLORS.join(', ')
    onDone(`Please provide a color. Available colors: ${colorList}, default`, {
      display: 'system',
    })
    return null
  }

  const colorArg = args.trim().toLowerCase()

  // Handle reset to default (gray)
  if (RESET_ALIASES.includes(colorArg as (typeof RESET_ALIASES)[number])) {
    const sessionId = getSessionId() as UUID
    const fullPath = getTranscriptPath()

    // Use "default" sentinel (not empty string) so truthiness guards
    // in sessionStorage.ts persist the reset across session restarts
    await saveAgentColor(sessionId, 'default', fullPath)

    context.setAppState(prev => ({
      ...prev,
      standaloneAgentContext: {
        ...prev.standaloneAgentContext,
        name: prev.standaloneAgentContext?.name ?? '',
        color: undefined,
      },
    }))

    onDone('Session color reset to default', { display: 'system' })
    return null
  }

  if (!AGENT_COLORS.includes(colorArg as AgentColorName)) {
    const colorList = AGENT_COLORS.join(', ')
    onDone(
      `Invalid color "${colorArg}". Available colors: ${colorList}, default`,
      { display: 'system' },
    )
    return null
  }

  const sessionId = getSessionId() as UUID
  const fullPath = getTranscriptPath()

  // Save to transcript for persistence across sessions
  await saveAgentColor(sessionId, colorArg, fullPath)

  // Update AppState for immediate effect
  context.setAppState(prev => ({
    ...prev,
    standaloneAgentContext: {
      ...prev.standaloneAgentContext,
      name: prev.standaloneAgentContext?.name ?? '',
      color: colorArg as AgentColorName,
    },
  }))

  onDone(`Session color set to: ${colorArg}`, { display: 'system' })
  return null
}
