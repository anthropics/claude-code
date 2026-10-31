import { DIAMOND_FILLED, DIAMOND_OPEN } from '../constants/figures.js'
import { count } from '../utils/array.js'
import type { BackgroundTaskState } from './types.js'

/**
 * Produces the compact footer-pill label for a set of background tasks.
 * Used by both the footer pill and the turn-duration transcript line so the
 * two surfaces agree on terminology.
 */
export function getPillLabel(tasks: BackgroundTaskState[]): string {
  const n = tasks.length
  const allSameType = tasks.every(t => t.type === tasks[0]!.type)

  if (allSameType) {
    switch (tasks[0]!.type) {
      case 'local_bash': {
        const monitors = count(
          tasks,
          t => t.type === 'local_bash' && t.kind === 'monitor',
        )
        const shells = n - monitors
        const parts: string[] = []
        if (shells > 0)
          parts.push(shells === 1 ? '1 shell' : `${shells} shells`)
        if (monitors > 0)
          parts.push(monitors === 1 ? '1 monitor' : `${monitors} monitors`)
        return parts.join(', ')
      }
      case 'in_process_teammate': {
        const teamCount = new Set(
          tasks.map(t =>
            t.type === 'in_process_teammate' ? t.identity.teamName : '',
          ),
        ).size
        return teamCount === 1 ? '1 team' : `${teamCount} teams`
      }
      case 'local_agent':
        return n === 1 ? '1 local agent' : `${n} local agents`
      case 'remote_agent': {
        const first = tasks[0]!
        // Per design mockup: ◇ open diamond while running/needs-input,
        // ◆ filled once ExitPlanMode is awaiting approval.
        if (n === 1 && first.type === 'remote_agent' && first.isUltraplan) {
          switch (first.ultraplanPhase) {
            case 'plan_ready':
              return `${DIAMOND_FILLED} ultraplan ready`
            case 'needs_input':
              return `${DIAMOND_OPEN} ultraplan needs your input`
            default:
              return `${DIAMOND_OPEN} ultraplan`
          }
        }
        return n === 1
          ? `${DIAMOND_OPEN} 1 cloud session`
          : `${DIAMOND_OPEN} ${n} cloud sessions`
      }
      case 'local_workflow':
        return n === 1 ? '1 background workflow' : `${n} background workflows`
      case 'monitor_mcp':
        return n === 1 ? '1 monitor' : `${n} monitors`
      case 'dream':
        return 'dreaming'
    }
  }

  return `${n} background ${n === 1 ? 'task' : 'tasks'}`
}

/**
 * True when the pill should show the dimmed " · ↓ to view" call-to-action.
 * Per the state diagram: only the two attention states (needs_input,
 * plan_ready) surface the CTA; plain running shows just the diamond + label.
 */
export function pillNeedsCta(tasks: BackgroundTaskState[]): boolean {
  if (tasks.length !== 1) return false
  const t = tasks[0]!
  return (
    t.type === 'remote_agent' &&
    t.isUltraplan === true &&
    t.ultraplanPhase !== undefined
  )
}
