import { useEffect, useRef } from 'react'
import { getIsRemoteMode } from '../../bootstrap/state.js'
import {
  type Notification,
  useNotifications,
} from '../../context/notifications.js'
import { useAppState } from '../../state/AppState.js'
import { isInProcessTeammateTask } from '../../tasks/InProcessTeammateTask/types.js'

function parseCount(notif: Notification): number {
  if (!('text' in notif)) {
    return 1
  }
  const match = notif.text.match(/^(\d+)/)
  return match?.[1] ? parseInt(match[1], 10) : 1
}

function foldSpawn(acc: Notification, _incoming: Notification): Notification {
  return makeSpawnNotif(parseCount(acc) + 1)
}

function makeSpawnNotif(count: number): Notification {
  return {
    key: 'teammate-spawn',
    text: count === 1 ? '1 agent spawned' : `${count} agents spawned`,
    priority: 'low',
    timeoutMs: 5000,
    fold: foldSpawn,
  }
}

function foldShutdown(
  acc: Notification,
  _incoming: Notification,
): Notification {
  return makeShutdownNotif(parseCount(acc) + 1)
}

function makeShutdownNotif(count: number): Notification {
  return {
    key: 'teammate-shutdown',
    text: count === 1 ? '1 agent shut down' : `${count} agents shut down`,
    priority: 'low',
    timeoutMs: 5000,
    fold: foldShutdown,
  }
}

/**
 * Fires batched notifications when in-process teammates spawn or shut down.
 * Uses fold() to combine repeated events into a single notification
 * like "3 agents spawned" or "2 agents shut down".
 */
export function useTeammateLifecycleNotification(): void {
  const tasks = useAppState(s => s.tasks)
  const { addNotification } = useNotifications()
  const seenRunningRef = useRef<Set<string>>(new Set())
  const seenCompletedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (getIsRemoteMode()) return
    for (const [id, task] of Object.entries(tasks)) {
      if (!isInProcessTeammateTask(task)) {
        continue
      }

      if (task.status === 'running' && !seenRunningRef.current.has(id)) {
        seenRunningRef.current.add(id)
        addNotification(makeSpawnNotif(1))
      }

      if (task.status === 'completed' && !seenCompletedRef.current.has(id)) {
        seenCompletedRef.current.add(id)
        addNotification(makeShutdownNotif(1))
      }
    }
  }, [tasks, addNotification])
}
