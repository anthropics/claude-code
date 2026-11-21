import * as React from 'react'
import { useAppState, useAppStateStore } from '../../state/AppState.js'
import {
  getActiveAgentForInput,
  getViewedTeammateTask,
} from '../../state/selectors.js'
import {
  AGENT_COLOR_TO_THEME_COLOR,
  AGENT_COLORS,
  type AgentColorName,
  getAgentColor,
} from '../../tools/AgentTool/agentColorManager.js'
import { getStandaloneAgentName } from '../../utils/standaloneAgent.js'
import { isInsideTmux } from '../../utils/swarm/backends/detection.js'
import {
  getCachedDetectionResult,
  isInProcessEnabled,
} from '../../utils/swarm/backends/registry.js'
import { getSwarmSocketName } from '../../utils/swarm/constants.js'
import {
  getAgentName,
  getTeammateColor,
  getTeamName,
  isTeammate,
} from '../../utils/teammate.js'
import { isInProcessTeammate } from '../../utils/teammateContext.js'
import type { Theme } from '../../utils/theme.js'

type SwarmBannerInfo = {
  text: string
  bgColor: keyof Theme
} | null

/**
 * Hook that returns banner information for swarm, standalone agent, or --agent CLI context.
 * - Leader (not in tmux): Returns "tmux -L ... attach" command with cyan background
 * - Leader (in tmux / in-process): Falls through to standalone-agent check — shows
 *   /rename name + /color background if set, else null
 * - Teammate: Returns "teammate@team" format with their assigned color background
 * - Viewing a background agent (CoordinatorTaskPanel): Returns agent name with its color
 * - Standalone agent: Returns agent name with their color background (no @team)
 * - --agent CLI flag: Returns "@agentName" with cyan background
 */
export function useSwarmBanner(): SwarmBannerInfo {
  const teamContext = useAppState(s => s.teamContext)
  const standaloneAgentContext = useAppState(s => s.standaloneAgentContext)
  const agent = useAppState(s => s.agent)
  // Subscribe so the banner updates on enter/exit teammate view even though
  // getActiveAgentForInput reads it from store.getState().
  useAppState(s => s.viewingAgentTaskId)
  const store = useAppStateStore()
  const [insideTmux, setInsideTmux] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    void isInsideTmux().then(setInsideTmux)
  }, [])

  const state = store.getState()

  // Teammate process: show @agentName with assigned color.
  // In-process teammates run headless — their banner shows in the leader UI instead.
  if (isTeammate() && !isInProcessTeammate()) {
    const agentName = getAgentName()
    if (agentName && getTeamName()) {
      return {
        text: `@${agentName}`,
        bgColor: toThemeColor(
          teamContext?.selfAgentColor ?? getTeammateColor(),
        ),
      }
    }
  }

  // Leader with spawned teammates: tmux-attach hint when external, else show
  // the viewed teammate's name when inside tmux / native panes / in-process.
  const hasTeammates =
    teamContext?.teamName &&
    teamContext.teammates &&
    Object.keys(teamContext.teammates).length > 0
  if (hasTeammates) {
    const viewedTeammate = getViewedTeammateTask(state)
    const viewedColor = toThemeColor(viewedTeammate?.identity.color)
    const inProcessMode = isInProcessEnabled()
    const nativePanes = getCachedDetectionResult()?.isNative ?? false

    if (insideTmux === false && !inProcessMode && !nativePanes) {
      return {
        text: `View teammates: \`tmux -L ${getSwarmSocketName()} a\``,
        bgColor: viewedColor,
      }
    }
    if (
      (insideTmux === true || inProcessMode || nativePanes) &&
      viewedTeammate
    ) {
      return {
        text: `@${viewedTeammate.identity.agentName}`,
        bgColor: viewedColor,
      }
    }
    // insideTmux === null: still loading — fall through.
    // Not viewing a teammate: fall through so /rename and /color are honored.
  }

  // Viewing a background agent (CoordinatorTaskPanel): local_agent tasks aren't
  // InProcessTeammates, so getViewedTeammateTask misses them. Reverse-lookup the
  // name from agentNameRegistry the same way CoordinatorAgentStatus does.
  const active = getActiveAgentForInput(state)
  if (active.type === 'named_agent') {
    const task = active.task
    let name: string | undefined
    for (const [n, id] of state.agentNameRegistry) {
      if (id === task.id) {
        name = n
        break
      }
    }
    return {
      text: name ? `@${name}` : task.description,
      bgColor: getAgentColor(task.agentType) ?? 'cyan_FOR_SUBAGENTS_ONLY',
    }
  }

  // Standalone agent (/rename, /color): name and/or custom color, no @team.
  const standaloneName = getStandaloneAgentName(state)
  const standaloneColor = standaloneAgentContext?.color
  if (standaloneName || standaloneColor) {
    return {
      text: standaloneName ?? '',
      bgColor: toThemeColor(standaloneColor),
    }
  }

  // --agent CLI flag (when not handled above).
  if (agent) {
    const agentDef = state.agentDefinitions.activeAgents.find(
      a => a.agentType === agent,
    )
    return {
      text: agent,
      bgColor: toThemeColor(agentDef?.color, 'promptBorder'),
    }
  }

  return null
}

function toThemeColor(
  colorName: string | undefined,
  fallback: keyof Theme = 'cyan_FOR_SUBAGENTS_ONLY',
): keyof Theme {
  return colorName && AGENT_COLORS.includes(colorName as AgentColorName)
    ? AGENT_COLOR_TO_THEME_COLOR[colorName as AgentColorName]
    : fallback
}
