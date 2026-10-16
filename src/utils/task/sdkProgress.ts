import type { SdkWorkflowProgress } from '../../types/tools.js'
import { enqueueSdkEvent } from '../sdkEventQueue.js'

/**
 * Emit a `task_progress` SDK event. Shared by background agents (per tool_use
 * in runAsyncAgentLifecycle) and workflows (per flushProgress batch). Accepts
 * already-computed primitives so callers can derive them from their own state
 * shapes (ProgressTracker for agents, LocalWorkflowTaskState for workflows).
 */
export function emitTaskProgress(params: {
  taskId: string
  toolUseId: string | undefined
  description: string
  startTime: number
  totalTokens: number
  toolUses: number
  lastToolName?: string
  summary?: string
  workflowProgress?: SdkWorkflowProgress[]
}): void {
  enqueueSdkEvent({
    type: 'system',
    subtype: 'task_progress',
    task_id: params.taskId,
    tool_use_id: params.toolUseId,
    description: params.description,
    usage: {
      total_tokens: params.totalTokens,
      tool_uses: params.toolUses,
      duration_ms: Date.now() - params.startTime,
    },
    last_tool_name: params.lastToolName,
    summary: params.summary,
    workflow_progress: params.workflowProgress,
  })
}
