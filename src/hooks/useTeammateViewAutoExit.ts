import { useEffect } from 'react'
import { useAppState, useSetAppState } from '../state/AppState.js'
import { exitTeammateView } from '../state/teammateViewHelpers.js'
import { isInProcessTeammateTask } from '../tasks/InProcessTeammateTask/types.js'

/**
 * Auto-exits teammate viewing mode when the viewed teammate
 * is killed or encounters an error. Users stay viewing completed
 * teammates so they can review the full transcript.
 */
export function useTeammateViewAutoExit(): void {
  const setAppState = useSetAppState()
  const viewingAgentTaskId = useAppState(s => s.viewingAgentTaskId)
  // Select only the viewed task, not the full tasks map — otherwise every
  // streaming update from any teammate re-renders this hook.
  const task = useAppState(s =>
    s.viewingAgentTaskId ? s.tasks[s.viewingAgentTaskId] : undefined,
  )

  const viewedTask = task && isInProcessTeammateTask(task) ? task : undefined
  const viewedStatus = viewedTask?.status
  const viewedError = viewedTask?.error
  const taskExists = task !== undefined

  useEffect(() => {
    // Not viewing any teammate
    if (!viewingAgentTaskId) {
      return
    }

    // Task no longer exists in the map — evicted out from under us.
    // Check raw `task` not teammate-narrowed `viewedTask`; local_agent
    // tasks exist but narrow to undefined, which would eject immediately.
    if (!taskExists) {
      exitTeammateView(setAppState)
      return
    }
    // Status checks below are teammate-only (viewedTask is teammate-narrowed).
    // For local_agent, viewedStatus is undefined → all checks falsy → no eject.
    if (!viewedTask) return

    // Auto-exit if teammate is killed, stopped, has error, or is no longer running
    // This handles shutdown scenarios where teammate becomes inactive
    if (
      viewedStatus === 'killed' ||
      viewedStatus === 'failed' ||
      viewedError ||
      (viewedStatus !== 'running' &&
        viewedStatus !== 'completed' &&
        viewedStatus !== 'pending')
    ) {
      exitTeammateView(setAppState)
      return
    }
  }, [
    viewingAgentTaskId,
    taskExists,
    viewedTask,
    viewedStatus,
    viewedError,
    setAppState,
  ])
}
