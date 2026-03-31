// Background task entry for auto-dream (memory consolidation subagent).
// Makes the otherwise-invisible forked agent visible in the footer pill and
// Shift+Down dialog. The dream agent itself is unchanged — this is pure UI
// surfacing via the existing task registry.

import { rollbackConsolidationLock } from '../../services/autoDream/consolidationLock.js'
import type { SetAppState, Task, TaskStateBase } from '../../Task.js'
import { createTaskStateBase, generateTaskId } from '../../Task.js'
import { registerTask, updateTaskState } from '../../utils/task/framework.js'

// Keep only the N most recent turns for live display.
const MAX_TURNS = 30

// A single assistant turn from the dream agent, tool uses collapsed to a count.
export type DreamTurn = {
  text: string
  toolUseCount: number
}

// No phase detection — the dream prompt has a 4-stage structure
// (orient/gather/consolidate/prune) but we don't parse it. Just flip from
// 'starting' to 'updating' when the first Edit/Write tool_use lands.
export type DreamPhase = 'starting' | 'updating'

export type DreamTaskState = TaskStateBase & {
  type: 'dream'
  phase: DreamPhase
  sessionsReviewing: number
  /**
   * Paths observed in Edit/Write tool_use blocks via onMessage. This is an
   * INCOMPLETE reflection of what the dream agent actually changed — it misses
   * any bash-mediated writes and only captures the tool calls we pattern-match.
   * Treat as "at least these were touched", not "only these were touched".
   */
  filesTouched: string[]
  /** Assistant text responses, tool uses collapsed. Prompt is NOT included. */
  turns: DreamTurn[]
  abortController?: AbortController
  /** Stashed so kill can rewind the lock mtime (same path as fork-failure). */
  priorMtime: number
}

export function isDreamTask(task: unknown): task is DreamTaskState {
  return (
    typeof task === 'object' &&
    task !== null &&
    'type' in task &&
    task.type === 'dream'
  )
}

export function registerDreamTask(
  setAppState: SetAppState,
  opts: {
    sessionsReviewing: number
    priorMtime: number
    abortController: AbortController
  },
): string {
  const id = generateTaskId('dream')
  const task: DreamTaskState = {
    ...createTaskStateBase(id, 'dream', 'dreaming'),
    type: 'dream',
    status: 'running',
    phase: 'starting',
    sessionsReviewing: opts.sessionsReviewing,
    filesTouched: [],
    turns: [],
    abortController: opts.abortController,
    priorMtime: opts.priorMtime,
  }
  registerTask(task, setAppState)
  return id
}

export function addDreamTurn(
  taskId: string,
  turn: DreamTurn,
  touchedPaths: string[],
  setAppState: SetAppState,
): void {
  updateTaskState<DreamTaskState>(taskId, setAppState, task => {
    const seen = new Set(task.filesTouched)
    const newTouched = touchedPaths.filter(p => !seen.has(p) && seen.add(p))
    // Skip the update entirely if the turn is empty AND nothing new was
    // touched. Avoids re-rendering on pure no-ops.
    if (
      turn.text === '' &&
      turn.toolUseCount === 0 &&
      newTouched.length === 0
    ) {
      return task
    }
    return {
      ...task,
      phase: newTouched.length > 0 ? 'updating' : task.phase,
      filesTouched:
        newTouched.length > 0
          ? [...task.filesTouched, ...newTouched]
          : task.filesTouched,
      turns: task.turns.slice(-(MAX_TURNS - 1)).concat(turn),
    }
  })
}

export function completeDreamTask(
  taskId: string,
  setAppState: SetAppState,
): void {
  // notified: true immediately — dream has no model-facing notification path
  // (it's UI-only), and eviction requires terminal + notified. The inline
  // appendSystemMessage completion note IS the user surface.
  updateTaskState<DreamTaskState>(taskId, setAppState, task => ({
    ...task,
    status: 'completed',
    endTime: Date.now(),
    notified: true,
    abortController: undefined,
  }))
}

export function failDreamTask(taskId: string, setAppState: SetAppState): void {
  updateTaskState<DreamTaskState>(taskId, setAppState, task => ({
    ...task,
    status: 'failed',
    endTime: Date.now(),
    notified: true,
    abortController: undefined,
  }))
}

export const DreamTask: Task = {
  name: 'DreamTask',
  type: 'dream',

  async kill(taskId, setAppState) {
    let priorMtime: number | undefined
    updateTaskState<DreamTaskState>(taskId, setAppState, task => {
      if (task.status !== 'running') return task
      task.abortController?.abort()
      priorMtime = task.priorMtime
      return {
        ...task,
        status: 'killed',
        endTime: Date.now(),
        notified: true,
        abortController: undefined,
      }
    })
    // Rewind the lock mtime so the next session can retry. Same path as the
    // fork-failure catch in autoDream.ts. If updateTaskState was a no-op
    // (already terminal), priorMtime stays undefined and we skip.
    if (priorMtime !== undefined) {
      await rollbackConsolidationLock(priorMtime)
    }
  },
}
