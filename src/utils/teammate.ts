/**
 * Teammate utilities for agent swarm coordination
 *
 * These helpers identify whether this Claude Code instance is running as a
 * spawned teammate in a swarm. Teammates receive their identity via CLI
 * arguments (--agent-id, --team-name, etc.) which are stored in dynamicTeamContext.
 *
 * For in-process teammates (running in the same process), AsyncLocalStorage
 * provides isolated context per teammate, preventing concurrent overwrites.
 *
 * Priority order for identity resolution:
 * 1. AsyncLocalStorage (in-process teammates) - via teammateContext.ts
 * 2. dynamicTeamContext (tmux teammates via CLI args)
 */

// Re-export in-process teammate utilities from teammateContext.ts
export {
  createTeammateContext,
  getTeammateContext,
  isInProcessTeammate,
  runWithTeammateContext,
  type TeammateContext,
} from './teammateContext.js'

import type { AppState } from '../state/AppState.js'
import { isEnvTruthy } from './envUtils.js'
import { getTeammateContext } from './teammateContext.js'

/**
 * Returns the parent session ID for this teammate.
 * For in-process teammates, this is the team lead's session ID.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux teammates).
 */
export function getParentSessionId(): string | undefined {
  const inProcessCtx = getTeammateContext()
  if (inProcessCtx) return inProcessCtx.parentSessionId
  return dynamicTeamContext?.parentSessionId
}

/**
 * Dynamic team context for runtime team joining.
 * When set, these values take precedence over environment variables.
 */
let dynamicTeamContext: {
  agentId: string
  agentName: string
  teamName: string
  color?: string
  planModeRequired: boolean
  parentSessionId?: string
} | null = null

/**
 * Set the dynamic team context (called when joining a team at runtime)
 */
export function setDynamicTeamContext(
  context: {
    agentId: string
    agentName: string
    teamName: string
    color?: string
    planModeRequired: boolean
    parentSessionId?: string
  } | null,
): void {
  dynamicTeamContext = context
}

/**
 * Clear the dynamic team context (called when leaving a team)
 */
export function clearDynamicTeamContext(): void {
  dynamicTeamContext = null
}

/**
 * Get the current dynamic team context (for inspection/debugging)
 */
export function getDynamicTeamContext(): typeof dynamicTeamContext {
  return dynamicTeamContext
}

/**
 * Returns the agent ID if this session is running as a teammate in a swarm,
 * or undefined if running as a standalone session.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux via CLI args).
 */
export function getAgentId(): string | undefined {
  const inProcessCtx = getTeammateContext()
  if (inProcessCtx) return inProcessCtx.agentId
  return dynamicTeamContext?.agentId
}

/**
 * Returns the agent name if this session is running as a teammate in a swarm.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux via CLI args).
 */
export function getAgentName(): string | undefined {
  const inProcessCtx = getTeammateContext()
  if (inProcessCtx) return inProcessCtx.agentName
  return dynamicTeamContext?.agentName
}

/**
 * Returns the team name if this session is part of a team.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux via CLI args) > passed teamContext.
 * Pass teamContext from AppState to support leaders who don't have dynamicTeamContext set.
 *
 * @param teamContext - Optional team context from AppState (for leaders)
 */
export function getTeamName(teamContext?: {
  teamName: string
}): string | undefined {
  const inProcessCtx = getTeammateContext()
  if (inProcessCtx) return inProcessCtx.teamName
  if (dynamicTeamContext?.teamName) return dynamicTeamContext.teamName
  return teamContext?.teamName
}

/**
 * Returns true if this session is running as a teammate in a swarm.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux via CLI args).
 * For tmux teammates, requires BOTH an agent ID AND a team name.
 */
export function isTeammate(): boolean {
  // In-process teammates run within the same process
  const inProcessCtx = getTeammateContext()
  if (inProcessCtx) return true
  // Tmux teammates require both agent ID and team name
  return !!(dynamicTeamContext?.agentId && dynamicTeamContext?.teamName)
}

/**
 * Returns the teammate's assigned color,
 * or undefined if not running as a teammate or no color assigned.
 * Priority: AsyncLocalStorage (in-process) > dynamicTeamContext (tmux teammates).
 */
export function getTeammateColor(): string | undefined {
  const inProcessCtx = getTeammateContext()
  if (inProcessCtx) return inProcessCtx.color
  return dynamicTeamContext?.color
}

/**
 * Returns true if this teammate session requires plan mode before implementation.
 * When enabled, the teammate must enter plan mode and get approval before writing code.
 * Priority: AsyncLocalStorage > dynamicTeamContext > env var.
 */
export function isPlanModeRequired(): boolean {
  const inProcessCtx = getTeammateContext()
  if (inProcessCtx) return inProcessCtx.planModeRequired
  if (dynamicTeamContext !== null) {
    return dynamicTeamContext.planModeRequired
  }
  return isEnvTruthy(process.env.CLAUDE_CODE_PLAN_MODE_REQUIRED)
}

/**
 * Check if this session is a team lead.
 *
 * A session is considered a team lead if:
 * 1. A team context exists with a leadAgentId, AND
 * 2. Either:
 *    - Our CLAUDE_CODE_AGENT_ID matches the leadAgentId, OR
 *    - We have no CLAUDE_CODE_AGENT_ID set (backwards compat: the original
 *      session that created the team before agent IDs were standardized)
 *
 * @param teamContext - The team context from AppState, if any
 * @returns true if this session is the team lead
 */
export function isTeamLead(
  teamContext:
    | {
        leadAgentId: string
      }
    | undefined,
): boolean {
  if (!teamContext?.leadAgentId) {
    return false
  }

  // Use getAgentId() for AsyncLocalStorage support (in-process teammates)
  const myAgentId = getAgentId()
  const leadAgentId = teamContext.leadAgentId

  // If my agent ID matches the lead agent ID, I'm the lead
  if (myAgentId === leadAgentId) {
    return true
  }

  // Backwards compat: if no agent ID is set and we have a team context,
  // this is the original session that created the team (the lead)
  if (!myAgentId) {
    return true
  }

  return false
}

/**
 * Checks if there are any active in-process teammates running.
 * Used by headless/print mode to determine if we should wait for teammates
 * before exiting.
 */
export function hasActiveInProcessTeammates(appState: AppState): boolean {
  // Check for running in-process teammate tasks
  for (const task of Object.values(appState.tasks)) {
    if (task.type === 'in_process_teammate' && task.status === 'running') {
      return true
    }
  }
  return false
}

/**
 * Checks if there are in-process teammates still actively working on tasks.
 * Returns true if any teammate is running but NOT idle (still processing).
 * Used to determine if we should wait before sending shutdown prompts.
 */
export function hasWorkingInProcessTeammates(appState: AppState): boolean {
  for (const task of Object.values(appState.tasks)) {
    if (
      task.type === 'in_process_teammate' &&
      task.status === 'running' &&
      !task.isIdle
    ) {
      return true
    }
  }
  return false
}

/**
 * Returns a promise that resolves when all working in-process teammates become idle.
 * Registers callbacks on each working teammate's task - they call these when idle.
 * Returns immediately if no teammates are working.
 */
export function waitForTeammatesToBecomeIdle(
  setAppState: (f: (prev: AppState) => AppState) => void,
  appState: AppState,
): Promise<void> {
  const workingTaskIds: string[] = []

  for (const [taskId, task] of Object.entries(appState.tasks)) {
    if (
      task.type === 'in_process_teammate' &&
      task.status === 'running' &&
      !task.isIdle
    ) {
      workingTaskIds.push(taskId)
    }
  }

  if (workingTaskIds.length === 0) {
    return Promise.resolve()
  }

  // Create a promise that resolves when all working teammates become idle
  return new Promise<void>(resolve => {
    let remaining = workingTaskIds.length

    const onIdle = (): void => {
      remaining--
      if (remaining === 0) {
        // biome-ignore lint/nursery/noFloatingPromises: resolve is a callback, not a Promise
        resolve()
      }
    }

    // Register callback on each working teammate
    // Check current isIdle state to handle race where teammate became idle
    // between our initial snapshot and this callback registration
    setAppState(prev => {
      const newTasks = { ...prev.tasks }
      for (const taskId of workingTaskIds) {
        const task = newTasks[taskId]
        if (task && task.type === 'in_process_teammate') {
          // If task is already idle, call onIdle immediately
          if (task.isIdle) {
            onIdle()
          } else {
            newTasks[taskId] = {
              ...task,
              onIdleCallbacks: [...(task.onIdleCallbacks ?? []), onIdle],
            }
          }
        }
      }
      return { ...prev, tasks: newTasks }
    })
  })
}
