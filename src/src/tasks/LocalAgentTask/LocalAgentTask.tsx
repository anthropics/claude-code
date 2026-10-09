import { getSdkAgentProgressSummariesEnabled } from '../../bootstrap/state.js';
import { OUTPUT_FILE_TAG, STATUS_TAG, SUMMARY_TAG, TASK_ID_TAG, TASK_NOTIFICATION_TAG, TOOL_USE_ID_TAG, WORKTREE_BRANCH_TAG, WORKTREE_PATH_TAG, WORKTREE_TAG } from '../../constants/xml.js';
import { abortSpeculation } from '../../services/PromptSuggestion/speculation.js';
import type { AppState } from '../../state/AppState.js';
import type { SetAppState, Task, TaskStateBase } from '../../Task.js';
import { createTaskStateBase } from '../../Task.js';
import type { Tools } from '../../Tool.js';
import { findToolByName } from '../../Tool.js';
import type { AgentToolResult } from '../../tools/AgentTool/agentToolUtils.js';
import type { AgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js';
import { SYNTHETIC_OUTPUT_TOOL_NAME } from '../../tools/SyntheticOutputTool/SyntheticOutputTool.js';
import { asAgentId } from '../../types/ids.js';
import type { Message } from '../../types/message.js';
import { createAbortController, createChildAbortController } from '../../utils/abortController.js';
import { registerCleanup } from '../../utils/cleanupRegistry.js';
import { getToolSearchOrReadInfo } from '../../utils/collapseReadSearch.js';
import { enqueuePendingNotification } from '../../utils/messageQueueManager.js';
import { getAgentTranscriptPath } from '../../utils/sessionStorage.js';
import { evictTaskOutput, getTaskOutputPath, initTaskOutputAsSymlink } from '../../utils/task/diskOutput.js';
import { PANEL_GRACE_MS, registerTask, updateTaskState } from '../../utils/task/framework.js';
import { emitTaskProgress } from '../../utils/task/sdkProgress.js';
import type { TaskState } from '../types.js';
export type ToolActivity = {
  toolName: string;
  input: Record<string, unknown>;
  /** Pre-computed activity description from the tool, e.g. "Reading src/foo.ts" */
  activityDescription?: string;
  /** Pre-computed: true if this is a search operation (Grep, Glob, etc.) */
  isSearch?: boolean;
  /** Pre-computed: true if this is a read operation (Read, cat, etc.) */
  isRead?: boolean;
};
export type AgentProgress = {
  toolUseCount: number;
  tokenCount: number;
  lastActivity?: ToolActivity;
  recentActivities?: ToolActivity[];
  summary?: string;
};
const MAX_RECENT_ACTIVITIES = 5;
export type ProgressTracker = {
  toolUseCount: number;
  // Track input and output separately to avoid double-counting.
  // input_tokens in Claude API is cumulative per turn (includes all previous context),
  // so we keep the latest value. output_tokens is per-turn, so we sum those.
  latestInputTokens: number;
  cumulativeOutputTokens: number;
  recentActivities: ToolActivity[];
};
export function createProgressTracker(): ProgressTracker {
  return {
    toolUseCount: 0,
    latestInputTokens: 0,
    cumulativeOutputTokens: 0,
    recentActivities: []
  };
}
export function getTokenCountFromTracker(tracker: ProgressTracker): number {
  return tracker.latestInputTokens + tracker.cumulativeOutputTokens;
}

/**
 * Resolver function that returns a human-readable activity description
 * for a given tool name and input. Used to pre-compute descriptions
 * from Tool.getActivityDescription() at recording time.
 */
export type ActivityDescriptionResolver = (toolName: string, input: Record<string, unknown>) => string | undefined;
export function updateProgressFromMessage(tracker: ProgressTracker, message: Message, resolveActivityDescription?: ActivityDescriptionResolver, tools?: Tools): void {
  if (message.type !== 'assistant') {
    return;
  }
  const usage = message.message.usage;
  // Keep latest input (it's cumulative in the API), sum outputs
  tracker.latestInputTokens = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  tracker.cumulativeOutputTokens += usage.output_tokens;
  for (const content of message.message.content) {
    if (content.type === 'tool_use') {
      tracker.toolUseCount++;
      // Omit StructuredOutput from preview - it's an internal tool
      if (content.name !== SYNTHETIC_OUTPUT_TOOL_NAME) {
        const input = content.input as Record<string, unknown>;
        const classification = tools ? getToolSearchOrReadInfo(content.name, input, tools) : undefined;
        tracker.recentActivities.push({
          toolName: content.name,
          input,
          activityDescription: resolveActivityDescription?.(content.name, input),
          isSearch: classification?.isSearch,
          isRead: classification?.isRead
        });
      }
    }
  }
  while (tracker.recentActivities.length > MAX_RECENT_ACTIVITIES) {
    tracker.recentActivities.shift();
  }
}
export function getProgressUpdate(tracker: ProgressTracker): AgentProgress {
  return {
    toolUseCount: tracker.toolUseCount,
    tokenCount: getTokenCountFromTracker(tracker),
    lastActivity: tracker.recentActivities.length > 0 ? tracker.recentActivities[tracker.recentActivities.length - 1] : undefined,
    recentActivities: [...tracker.recentActivities]
  };
}

/**
 * Creates an ActivityDescriptionResolver from a tools list.
 * Looks up the tool by name and calls getActivityDescription if available.
 */
export function createActivityDescriptionResolver(tools: Tools): ActivityDescriptionResolver {
  return (toolName, input) => {
    const tool = findToolByName(tools, toolName);
    return tool?.getActivityDescription?.(input) ?? undefined;
  };
}
export type LocalAgentTaskState = TaskStateBase & {
  type: 'local_agent';
  agentId: string;
  prompt: string;
  selectedAgent?: AgentDefinition;
  agentType: string;
  model?: string;
  abortController?: AbortController;
  unregisterCleanup?: () => void;
  error?: string;
  result?: AgentToolResult;
  progress?: AgentProgress;
  retrieved: boolean;
  messages?: Message[];
  // Track what we last reported for computing deltas
  lastReportedToolCount: number;
  lastReportedTokenCount: number;
  // Whether the task has been backgrounded (false = foreground running, true = backgrounded)
  isBackgrounded: boolean;
  // Messages queued mid-turn via SendMessage, drained at tool-round boundaries
  pendingMessages: string[];
  // UI is holding this task: blocks eviction, enables stream-append, triggers
  // disk bootstrap. Set by enterTeammateView. Separate from viewingAgentTaskId
  // (which is "what am I LOOKING at") — retain is "what am I HOLDING."
  retain: boolean;
  // Bootstrap has read the sidechain JSONL and UUID-merged into messages.
  // One-shot per retain cycle; stream appends from there.
  diskLoaded: boolean;
  // Panel visibility deadline. undefined = no deadline (running or retained);
  // timestamp = hide + GC-eligible after this time. Set at terminal transition
  // and on unselect; cleared on retain.
  evictAfter?: number;
};
export function isLocalAgentTask(task: unknown): task is LocalAgentTaskState {
  return typeof task === 'object' && task !== null && 'type' in task && task.type === 'local_agent';
}

/**
 * A local_agent task that the CoordinatorTaskPanel manages (not main-session).
 * For ants, these render in the panel instead of the background-task pill.
 * This is the ONE predicate that all pill/panel filters must agree on — if
 * the gate changes, change it here.
 */
export function isPanelAgentTask(t: unknown): t is LocalAgentTaskState {
  return isLocalAgentTask(t) && t.agentType !== 'main-session';
}
export function queuePendingMessage(taskId: string, msg: string, setAppState: (f: (prev: AppState) => AppState) => void): void {
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => ({
    ...task,
    pendingMessages: [...task.pendingMessages, msg]
  }));
}

/**
 * Append a message to task.messages so it appears in the viewed transcript
 * immediately. Caller constructs the Message (breaks the messages.ts cycle).
 * queuePendingMessage and resumeAgentBackground route the prompt to the
 * agent's API input but don't touch the display.
 */
export function appendMessageToLocalAgent(taskId: string, message: Message, setAppState: (f: (prev: AppState) => AppState) => void): void {
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => ({
    ...task,
    messages: [...(task.messages ?? []), message]
  }));
}
export function drainPendingMessages(taskId: string, getAppState: () => AppState, setAppState: (f: (prev: AppState) => AppState) => void): string[] {
  const task = getAppState().tasks[taskId];
  if (!isLocalAgentTask(task) || task.pendingMessages.length === 0) {
    return [];
  }
  const drained = task.pendingMessages;
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, t => ({
    ...t,
    pendingMessages: []
  }));
  return drained;
}

/**
 * Enqueue an agent notification to the message queue.
 */
export function enqueueAgentNotification({
  taskId,
  description,
  status,
  error,
  setAppState,
  finalMessage,
  usage,
  toolUseId,
  worktreePath,
  worktreeBranch
}: {
  taskId: string;
  description: string;
  status: 'completed' | 'failed' | 'killed';
  error?: string;
  setAppState: SetAppState;
  finalMessage?: string;
  usage?: {
    totalTokens: number;
    toolUses: number;
    durationMs: number;
  };
  toolUseId?: string;
  worktreePath?: string;
  worktreeBranch?: string;
}): void {
  // Atomically check and set notified flag to prevent duplicate notifications.
  // If the task was already marked as notified (e.g., by TaskStopTool), skip
  // enqueueing to avoid sending redundant messages to the model.
  let shouldEnqueue = false;
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => {
    if (task.notified) {
      return task;
    }
    shouldEnqueue = true;
    return {
      ...task,
      notified: true
    };
  });
  if (!shouldEnqueue) {
    return;
  }

  // Abort any active speculation — background task state changed, so speculated
  // results may reference stale task output. The prompt suggestion text is
  // preserved; only the pre-computed response is discarded.
  abortSpeculation(setAppState);
  const summary = status === 'completed' ? `Agent "${description}" completed` : status === 'failed' ? `Agent "${description}" failed: ${error || 'Unknown error'}` : `Agent "${description}" was stopped`;
  const outputPath = getTaskOutputPath(taskId);
  const toolUseIdLine = toolUseId ? `\n<${TOOL_USE_ID_TAG}>${toolUseId}</${TOOL_USE_ID_TAG}>` : '';
  const resultSection = finalMessage ? `\n<result>${finalMessage}</result>` : '';
  const usageSection = usage ? `\n<usage><total_tokens>${usage.totalTokens}</total_tokens><tool_uses>${usage.toolUses}</tool_uses><duration_ms>${usage.durationMs}</duration_ms></usage>` : '';
  const worktreeSection = worktreePath ? `\n<${WORKTREE_TAG}><${WORKTREE_PATH_TAG}>${worktreePath}</${WORKTREE_PATH_TAG}>${worktreeBranch ? `<${WORKTREE_BRANCH_TAG}>${worktreeBranch}</${WORKTREE_BRANCH_TAG}>` : ''}</${WORKTREE_TAG}>` : '';
  const message = `<${TASK_NOTIFICATION_TAG}>
<${TASK_ID_TAG}>${taskId}</${TASK_ID_TAG}>${toolUseIdLine}
<${OUTPUT_FILE_TAG}>${outputPath}</${OUTPUT_FILE_TAG}>
<${STATUS_TAG}>${status}</${STATUS_TAG}>
<${SUMMARY_TAG}>${summary}</${SUMMARY_TAG}>${resultSection}${usageSection}${worktreeSection}
</${TASK_NOTIFICATION_TAG}>`;
  enqueuePendingNotification({
    value: message,
    mode: 'task-notification'
  });
}

/**
 * LocalAgentTask - Handles background agent execution.
 *
 * Replaces the AsyncAgent implementation from src/tools/AgentTool/asyncAgentUtils.ts
 * with a unified Task interface.
 */
export const LocalAgentTask: Task = {
  name: 'LocalAgentTask',
  type: 'local_agent',
  async kill(taskId, setAppState) {
    killAsyncAgent(taskId, setAppState);
  }
};

/**
 * Kill an agent task. No-op if already killed/completed.
 */
export function killAsyncAgent(taskId: string, setAppState: SetAppState): void {
  let killed = false;
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') {
      return task;
    }
    killed = true;
    task.abortController?.abort();
    task.unregisterCleanup?.();
    return {
      ...task,
      status: 'killed',
      endTime: Date.now(),
      evictAfter: task.retain ? undefined : Date.now() + PANEL_GRACE_MS,
      abortController: undefined,
      unregisterCleanup: undefined,
      selectedAgent: undefined
    };
  });
  if (killed) {
    void evictTaskOutput(taskId);
  }
}

/**
 * Kill all running agent tasks.
 * Used by ESC cancellation in coordinator mode to stop all subagents.
 */
export function killAllRunningAgentTasks(tasks: Record<string, TaskState>, setAppState: SetAppState): void {
  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.type === 'local_agent' && task.status === 'running') {
      killAsyncAgent(taskId, setAppState);
    }
  }
}

/**
 * Mark a task as notified without enqueueing a notification.
 * Used by chat:killAgents bulk kill to suppress per-agent async notifications
 * when a single aggregate message is sent instead.
 */
export function markAgentsNotified(taskId: string, setAppState: SetAppState): void {
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => {
    if (task.notified) {
      return task;
    }
    return {
      ...task,
      notified: true
    };
  });
}

/**
 * Update progress for an agent task.
 * Preserves the existing summary field so that background summarization
 * results are not clobbered by progress updates from assistant messages.
 */
export function updateAgentProgress(taskId: string, progress: AgentProgress, setAppState: SetAppState): void {
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') {
      return task;
    }
    const existingSummary = task.progress?.summary;
    return {
      ...task,
      progress: existingSummary ? {
        ...progress,
        summary: existingSummary
      } : progress
    };
  });
}

/**
 * Update the background summary for an agent task.
 * Called by the periodic summarization service to store a 1-2 sentence progress summary.
 */
export function updateAgentSummary(taskId: string, summary: string, setAppState: SetAppState): void {
  let captured: {
    tokenCount: number;
    toolUseCount: number;
    startTime: number;
    toolUseId: string | undefined;
  } | null = null;
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') {
      return task;
    }
    captured = {
      tokenCount: task.progress?.tokenCount ?? 0,
      toolUseCount: task.progress?.toolUseCount ?? 0,
      startTime: task.startTime,
      toolUseId: task.toolUseId
    };
    return {
      ...task,
      progress: {
        ...task.progress,
        toolUseCount: task.progress?.toolUseCount ?? 0,
        tokenCount: task.progress?.tokenCount ?? 0,
        summary
      }
    };
  });

  // Emit summary to SDK consumers (e.g. VS Code subagent panel). No-op in TUI.
  // Gate on the SDK option so coordinator-mode sessions without the flag don't
  // leak summary events to consumers who didn't opt in.
  if (captured && getSdkAgentProgressSummariesEnabled()) {
    const {
      tokenCount,
      toolUseCount,
      startTime,
      toolUseId
    } = captured;
    emitTaskProgress({
      taskId,
      toolUseId,
      description: summary,
      startTime,
      totalTokens: tokenCount,
      toolUses: toolUseCount,
      summary
    });
  }
}

/**
 * Complete an agent task with result.
 */
export function completeAgentTask(result: AgentToolResult, setAppState: SetAppState): void {
  const taskId = result.agentId;
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') {
      return task;
    }
    task.unregisterCleanup?.();
    return {
      ...task,
      status: 'completed',
      result,
      endTime: Date.now(),
      evictAfter: task.retain ? undefined : Date.now() + PANEL_GRACE_MS,
      abortController: undefined,
      unregisterCleanup: undefined,
      selectedAgent: undefined
    };
  });
  void evictTaskOutput(taskId);
  // Note: Notification is sent by AgentTool via enqueueAgentNotification
}

/**
 * Fail an agent task with error.
 */
export function failAgentTask(taskId: string, error: string, setAppState: SetAppState): void {
  updateTaskState<LocalAgentTaskState>(taskId, setAppState, task => {
    if (task.status !== 'running') {
      return task;
    }
    task.unregisterCleanup?.();
    return {
      ...task,
      status: 'failed',
      error,
      endTime: Date.now(),
      evictAfter: task.retain ? undefined : Date.now() + PANEL_GRACE_MS,
      abortController: undefined,
      unregisterCleanup: undefined,
      selectedAgent: undefined
    };
  });
  void evictTaskOutput(taskId);
  // Note: Notification is sent by AgentTool via enqueueAgentNotification
}

/**
 * Register an agent task.
 * Called by AgentTool to create a new background agent.
 *
 * @param parentAbortController - Optional parent abort controller. If provided,
 *   the agent's abort controller will be a child that auto-aborts when parent aborts.
 *   This ensures subagents are aborted when their parent (e.g., in-process teammate) aborts.
 */
export function registerAsyncAgent({
  agentId,
  description,
  prompt,
  selectedAgent,
  setAppState,
  parentAbortController,
  toolUseId
}: {
  agentId: string;
  description: string;
  prompt: string;
  selectedAgent: AgentDefinition;
  setAppState: SetAppState;
  parentAbortController?: AbortController;
  toolUseId?: string;
}): LocalAgentTaskState {
  void initTaskOutputAsSymlink(agentId, getAgentTranscriptPath(asAgentId(agentId)));

  // Create abort controller - if parent provided, create child that auto-aborts with parent
  const abortController = parentAbortController ? createChildAbortController(parentAbortController) : createAbortController();
  const taskState: LocalAgentTaskState = {
    ...createTaskStateBase(agentId, 'local_agent', description, toolUseId),
    type: 'local_agent',
    status: 'running',
    agentId,
    prompt,
    selectedAgent,
    agentType: selectedAgent.agentType ?? 'general-purpose',
    abortController,
    retrieved: false,
    lastReportedToolCount: 0,
    lastReportedTokenCount: 0,
    isBackgrounded: true,
    // registerAsyncAgent immediately backgrounds
    pendingMessages: [],
    retain: false,
    diskLoaded: false
  };

  // Register cleanup handler
  const unregisterCleanup = registerCleanup(async () => {
    killAsyncAgent(agentId, setAppState);
  });
  taskState.unregisterCleanup = unregisterCleanup;

  // Register task in AppState
  registerTask(taskState, setAppState);
  return taskState;
}

// Map of taskId -> resolve function for background signals
// When backgroundAgentTask is called, it resolves the corresponding promise
const backgroundSignalResolvers = new Map<string, () => void>();

/**
 * Register a foreground agent task that could be backgrounded later.
 * Called when an agent has been running long enough to show the BackgroundHint.
 * @returns object with taskId and backgroundSignal promise
 */
export function registerAgentForeground({
  agentId,
  description,
  prompt,
  selectedAgent,
  setAppState,
  autoBackgroundMs,
  toolUseId
}: {
  agentId: string;
  description: string;
  prompt: string;
  selectedAgent: AgentDefinition;
  setAppState: SetAppState;
  autoBackgroundMs?: number;
  toolUseId?: string;
}): {
  taskId: string;
  backgroundSignal: Promise<void>;
  cancelAutoBackground?: () => void;
} {
  void initTaskOutputAsSymlink(agentId, getAgentTranscriptPath(asAgentId(agentId)));
  const abortController = createAbortController();
  const unregisterCleanup = registerCleanup(async () => {
    killAsyncAgent(agentId, setAppState);
  });
  const taskState: LocalAgentTaskState = {
    ...createTaskStateBase(agentId, 'local_agent', description, toolUseId),
    type: 'local_agent',
    status: 'running',
    agentId,
    prompt,
    selectedAgent,
    agentType: selectedAgent.agentType ?? 'general-purpose',
    abortController,
    unregisterCleanup,
    retrieved: false,
    lastReportedToolCount: 0,
    lastReportedTokenCount: 0,
    isBackgrounded: false,
    // Not yet backgrounded - running in foreground
    pendingMessages: [],
    retain: false,
    diskLoaded: false
  };

  // Create background signal promise
  let resolveBackgroundSignal: () => void;
  const backgroundSignal = new Promise<void>(resolve => {
    resolveBackgroundSignal = resolve;
  });
  backgroundSignalResolvers.set(agentId, resolveBackgroundSignal!);
  registerTask(taskState, setAppState);

  // Auto-background after timeout if configured
  let cancelAutoBackground: (() => void) | undefined;
  if (autoBackgroundMs !== undefined && autoBackgroundMs > 0) {
    const timer = setTimeout((setAppState, agentId) => {
      // Mark task as backgrounded and resolve the signal
      setAppState(prev => {
        const prevTask = prev.tasks[agentId];
        if (!isLocalAgentTask(prevTask) || prevTask.isBackgrounded) {
          return prev;
        }
        return {
          ...prev,
          tasks: {
            ...prev.tasks,
            [agentId]: {
              ...prevTask,
              isBackgrounded: true
            }
          }
        };
      });
      const resolver = backgroundSignalResolvers.get(agentId);
      if (resolver) {
        resolver();
        backgroundSignalResolvers.delete(agentId);
      }
    }, autoBackgroundMs, setAppState, agentId);
    cancelAutoBackground = () => clearTimeout(timer);
  }
  return {
    taskId: agentId,
    backgroundSignal,
    cancelAutoBackground
  };
}

/**
 * Background a specific foreground agent task.
 * @returns true if backgrounded successfully, false otherwise
 */
export function backgroundAgentTask(taskId: string, getAppState: () => AppState, setAppState: SetAppState): boolean {
  const state = getAppState();
  const task = state.tasks[taskId];
  if (!isLocalAgentTask(task) || task.isBackgrounded) {
    return false;
  }

  // Update state to mark as backgrounded
  setAppState(prev => {
    const prevTask = prev.tasks[taskId];
    if (!isLocalAgentTask(prevTask)) {
      return prev;
    }
    return {
      ...prev,
      tasks: {
        ...prev.tasks,
        [taskId]: {
          ...prevTask,
          isBackgrounded: true
        }
      }
    };
  });

  // Resolve the background signal to interrupt the agent loop
  const resolver = backgroundSignalResolvers.get(taskId);
  if (resolver) {
    resolver();
    backgroundSignalResolvers.delete(taskId);
  }
  return true;
}

/**
 * Unregister a foreground agent task when the agent completes without being backgrounded.
 */
export function unregisterAgentForeground(taskId: string, setAppState: SetAppState): void {
  // Clean up the background signal resolver
  backgroundSignalResolvers.delete(taskId);
  let cleanupFn: (() => void) | undefined;
  setAppState(prev => {
    const task = prev.tasks[taskId];
    // Only remove if it's a foreground task (not backgrounded)
    if (!isLocalAgentTask(task) || task.isBackgrounded) {
      return prev;
    }

    // Capture cleanup function to call outside of updater
    cleanupFn = task.unregisterCleanup;
    const {
      [taskId]: removed,
      ...rest
    } = prev.tasks;
    return {
      ...prev,
      tasks: rest
    };
  });

  // Call cleanup outside of the state updater (avoid side effects in updater)
  cleanupFn?.();
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJnZXRTZGtBZ2VudFByb2dyZXNzU3VtbWFyaWVzRW5hYmxlZCIsIk9VVFBVVF9GSUxFX1RBRyIsIlNUQVRVU19UQUciLCJTVU1NQVJZX1RBRyIsIlRBU0tfSURfVEFHIiwiVEFTS19OT1RJRklDQVRJT05fVEFHIiwiVE9PTF9VU0VfSURfVEFHIiwiV09SS1RSRUVfQlJBTkNIX1RBRyIsIldPUktUUkVFX1BBVEhfVEFHIiwiV09SS1RSRUVfVEFHIiwiYWJvcnRTcGVjdWxhdGlvbiIsIkFwcFN0YXRlIiwiU2V0QXBwU3RhdGUiLCJUYXNrIiwiVGFza1N0YXRlQmFzZSIsImNyZWF0ZVRhc2tTdGF0ZUJhc2UiLCJUb29scyIsImZpbmRUb29sQnlOYW1lIiwiQWdlbnRUb29sUmVzdWx0IiwiQWdlbnREZWZpbml0aW9uIiwiU1lOVEhFVElDX09VVFBVVF9UT09MX05BTUUiLCJhc0FnZW50SWQiLCJNZXNzYWdlIiwiY3JlYXRlQWJvcnRDb250cm9sbGVyIiwiY3JlYXRlQ2hpbGRBYm9ydENvbnRyb2xsZXIiLCJyZWdpc3RlckNsZWFudXAiLCJnZXRUb29sU2VhcmNoT3JSZWFkSW5mbyIsImVucXVldWVQZW5kaW5nTm90aWZpY2F0aW9uIiwiZ2V0QWdlbnRUcmFuc2NyaXB0UGF0aCIsImV2aWN0VGFza091dHB1dCIsImdldFRhc2tPdXRwdXRQYXRoIiwiaW5pdFRhc2tPdXRwdXRBc1N5bWxpbmsiLCJQQU5FTF9HUkFDRV9NUyIsInJlZ2lzdGVyVGFzayIsInVwZGF0ZVRhc2tTdGF0ZSIsImVtaXRUYXNrUHJvZ3Jlc3MiLCJUYXNrU3RhdGUiLCJUb29sQWN0aXZpdHkiLCJ0b29sTmFtZSIsImlucHV0IiwiUmVjb3JkIiwiYWN0aXZpdHlEZXNjcmlwdGlvbiIsImlzU2VhcmNoIiwiaXNSZWFkIiwiQWdlbnRQcm9ncmVzcyIsInRvb2xVc2VDb3VudCIsInRva2VuQ291bnQiLCJsYXN0QWN0aXZpdHkiLCJyZWNlbnRBY3Rpdml0aWVzIiwic3VtbWFyeSIsIk1BWF9SRUNFTlRfQUNUSVZJVElFUyIsIlByb2dyZXNzVHJhY2tlciIsImxhdGVzdElucHV0VG9rZW5zIiwiY3VtdWxhdGl2ZU91dHB1dFRva2VucyIsImNyZWF0ZVByb2dyZXNzVHJhY2tlciIsImdldFRva2VuQ291bnRGcm9tVHJhY2tlciIsInRyYWNrZXIiLCJBY3Rpdml0eURlc2NyaXB0aW9uUmVzb2x2ZXIiLCJ1cGRhdGVQcm9ncmVzc0Zyb21NZXNzYWdlIiwibWVzc2FnZSIsInJlc29sdmVBY3Rpdml0eURlc2NyaXB0aW9uIiwidG9vbHMiLCJ0eXBlIiwidXNhZ2UiLCJpbnB1dF90b2tlbnMiLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyIsIm91dHB1dF90b2tlbnMiLCJjb250ZW50IiwibmFtZSIsImNsYXNzaWZpY2F0aW9uIiwidW5kZWZpbmVkIiwicHVzaCIsImxlbmd0aCIsInNoaWZ0IiwiZ2V0UHJvZ3Jlc3NVcGRhdGUiLCJjcmVhdGVBY3Rpdml0eURlc2NyaXB0aW9uUmVzb2x2ZXIiLCJ0b29sIiwiZ2V0QWN0aXZpdHlEZXNjcmlwdGlvbiIsIkxvY2FsQWdlbnRUYXNrU3RhdGUiLCJhZ2VudElkIiwicHJvbXB0Iiwic2VsZWN0ZWRBZ2VudCIsImFnZW50VHlwZSIsIm1vZGVsIiwiYWJvcnRDb250cm9sbGVyIiwiQWJvcnRDb250cm9sbGVyIiwidW5yZWdpc3RlckNsZWFudXAiLCJlcnJvciIsInJlc3VsdCIsInByb2dyZXNzIiwicmV0cmlldmVkIiwibWVzc2FnZXMiLCJsYXN0UmVwb3J0ZWRUb29sQ291bnQiLCJsYXN0UmVwb3J0ZWRUb2tlbkNvdW50IiwiaXNCYWNrZ3JvdW5kZWQiLCJwZW5kaW5nTWVzc2FnZXMiLCJyZXRhaW4iLCJkaXNrTG9hZGVkIiwiZXZpY3RBZnRlciIsImlzTG9jYWxBZ2VudFRhc2siLCJ0YXNrIiwiaXNQYW5lbEFnZW50VGFzayIsInQiLCJxdWV1ZVBlbmRpbmdNZXNzYWdlIiwidGFza0lkIiwibXNnIiwic2V0QXBwU3RhdGUiLCJmIiwicHJldiIsImFwcGVuZE1lc3NhZ2VUb0xvY2FsQWdlbnQiLCJkcmFpblBlbmRpbmdNZXNzYWdlcyIsImdldEFwcFN0YXRlIiwidGFza3MiLCJkcmFpbmVkIiwiZW5xdWV1ZUFnZW50Tm90aWZpY2F0aW9uIiwiZGVzY3JpcHRpb24iLCJzdGF0dXMiLCJmaW5hbE1lc3NhZ2UiLCJ0b29sVXNlSWQiLCJ3b3JrdHJlZVBhdGgiLCJ3b3JrdHJlZUJyYW5jaCIsInRvdGFsVG9rZW5zIiwidG9vbFVzZXMiLCJkdXJhdGlvbk1zIiwic2hvdWxkRW5xdWV1ZSIsIm5vdGlmaWVkIiwib3V0cHV0UGF0aCIsInRvb2xVc2VJZExpbmUiLCJyZXN1bHRTZWN0aW9uIiwidXNhZ2VTZWN0aW9uIiwid29ya3RyZWVTZWN0aW9uIiwidmFsdWUiLCJtb2RlIiwiTG9jYWxBZ2VudFRhc2siLCJraWxsIiwia2lsbEFzeW5jQWdlbnQiLCJraWxsZWQiLCJhYm9ydCIsImVuZFRpbWUiLCJEYXRlIiwibm93Iiwia2lsbEFsbFJ1bm5pbmdBZ2VudFRhc2tzIiwiT2JqZWN0IiwiZW50cmllcyIsIm1hcmtBZ2VudHNOb3RpZmllZCIsInVwZGF0ZUFnZW50UHJvZ3Jlc3MiLCJleGlzdGluZ1N1bW1hcnkiLCJ1cGRhdGVBZ2VudFN1bW1hcnkiLCJjYXB0dXJlZCIsInN0YXJ0VGltZSIsImNvbXBsZXRlQWdlbnRUYXNrIiwiZmFpbEFnZW50VGFzayIsInJlZ2lzdGVyQXN5bmNBZ2VudCIsInBhcmVudEFib3J0Q29udHJvbGxlciIsInRhc2tTdGF0ZSIsImJhY2tncm91bmRTaWduYWxSZXNvbHZlcnMiLCJNYXAiLCJyZWdpc3RlckFnZW50Rm9yZWdyb3VuZCIsImF1dG9CYWNrZ3JvdW5kTXMiLCJiYWNrZ3JvdW5kU2lnbmFsIiwiUHJvbWlzZSIsImNhbmNlbEF1dG9CYWNrZ3JvdW5kIiwicmVzb2x2ZUJhY2tncm91bmRTaWduYWwiLCJyZXNvbHZlIiwic2V0IiwidGltZXIiLCJzZXRUaW1lb3V0IiwicHJldlRhc2siLCJyZXNvbHZlciIsImdldCIsImRlbGV0ZSIsImNsZWFyVGltZW91dCIsImJhY2tncm91bmRBZ2VudFRhc2siLCJzdGF0ZSIsInVucmVnaXN0ZXJBZ2VudEZvcmVncm91bmQiLCJjbGVhbnVwRm4iLCJyZW1vdmVkIiwicmVzdCJdLCJzb3VyY2VzIjpbIkxvY2FsQWdlbnRUYXNrLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBnZXRTZGtBZ2VudFByb2dyZXNzU3VtbWFyaWVzRW5hYmxlZCB9IGZyb20gJy4uLy4uL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB7XG4gIE9VVFBVVF9GSUxFX1RBRyxcbiAgU1RBVFVTX1RBRyxcbiAgU1VNTUFSWV9UQUcsXG4gIFRBU0tfSURfVEFHLFxuICBUQVNLX05PVElGSUNBVElPTl9UQUcsXG4gIFRPT0xfVVNFX0lEX1RBRyxcbiAgV09SS1RSRUVfQlJBTkNIX1RBRyxcbiAgV09SS1RSRUVfUEFUSF9UQUcsXG4gIFdPUktUUkVFX1RBRyxcbn0gZnJvbSAnLi4vLi4vY29uc3RhbnRzL3htbC5qcydcbmltcG9ydCB7IGFib3J0U3BlY3VsYXRpb24gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9Qcm9tcHRTdWdnZXN0aW9uL3NwZWN1bGF0aW9uLmpzJ1xuaW1wb3J0IHR5cGUgeyBBcHBTdGF0ZSB9IGZyb20gJy4uLy4uL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHR5cGUgeyBTZXRBcHBTdGF0ZSwgVGFzaywgVGFza1N0YXRlQmFzZSB9IGZyb20gJy4uLy4uL1Rhc2suanMnXG5pbXBvcnQgeyBjcmVhdGVUYXNrU3RhdGVCYXNlIH0gZnJvbSAnLi4vLi4vVGFzay5qcydcbmltcG9ydCB0eXBlIHsgVG9vbHMgfSBmcm9tICcuLi8uLi9Ub29sLmpzJ1xuaW1wb3J0IHsgZmluZFRvb2xCeU5hbWUgfSBmcm9tICcuLi8uLi9Ub29sLmpzJ1xuaW1wb3J0IHR5cGUgeyBBZ2VudFRvb2xSZXN1bHQgfSBmcm9tICcuLi8uLi90b29scy9BZ2VudFRvb2wvYWdlbnRUb29sVXRpbHMuanMnXG5pbXBvcnQgdHlwZSB7IEFnZW50RGVmaW5pdGlvbiB9IGZyb20gJy4uLy4uL3Rvb2xzL0FnZW50VG9vbC9sb2FkQWdlbnRzRGlyLmpzJ1xuaW1wb3J0IHsgU1lOVEhFVElDX09VVFBVVF9UT09MX05BTUUgfSBmcm9tICcuLi8uLi90b29scy9TeW50aGV0aWNPdXRwdXRUb29sL1N5bnRoZXRpY091dHB1dFRvb2wuanMnXG5pbXBvcnQgeyBhc0FnZW50SWQgfSBmcm9tICcuLi8uLi90eXBlcy9pZHMuanMnXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UgfSBmcm9tICcuLi8uLi90eXBlcy9tZXNzYWdlLmpzJ1xuaW1wb3J0IHtcbiAgY3JlYXRlQWJvcnRDb250cm9sbGVyLFxuICBjcmVhdGVDaGlsZEFib3J0Q29udHJvbGxlcixcbn0gZnJvbSAnLi4vLi4vdXRpbHMvYWJvcnRDb250cm9sbGVyLmpzJ1xuaW1wb3J0IHsgcmVnaXN0ZXJDbGVhbnVwIH0gZnJvbSAnLi4vLi4vdXRpbHMvY2xlYW51cFJlZ2lzdHJ5LmpzJ1xuaW1wb3J0IHsgZ2V0VG9vbFNlYXJjaE9yUmVhZEluZm8gfSBmcm9tICcuLi8uLi91dGlscy9jb2xsYXBzZVJlYWRTZWFyY2guanMnXG5pbXBvcnQgeyBlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbiB9IGZyb20gJy4uLy4uL3V0aWxzL21lc3NhZ2VRdWV1ZU1hbmFnZXIuanMnXG5pbXBvcnQgeyBnZXRBZ2VudFRyYW5zY3JpcHRQYXRoIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2Vzc2lvblN0b3JhZ2UuanMnXG5pbXBvcnQge1xuICBldmljdFRhc2tPdXRwdXQsXG4gIGdldFRhc2tPdXRwdXRQYXRoLFxuICBpbml0VGFza091dHB1dEFzU3ltbGluayxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvdGFzay9kaXNrT3V0cHV0LmpzJ1xuaW1wb3J0IHtcbiAgUEFORUxfR1JBQ0VfTVMsXG4gIHJlZ2lzdGVyVGFzayxcbiAgdXBkYXRlVGFza1N0YXRlLFxufSBmcm9tICcuLi8uLi91dGlscy90YXNrL2ZyYW1ld29yay5qcydcbmltcG9ydCB7IGVtaXRUYXNrUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi91dGlscy90YXNrL3Nka1Byb2dyZXNzLmpzJ1xuaW1wb3J0IHR5cGUgeyBUYXNrU3RhdGUgfSBmcm9tICcuLi90eXBlcy5qcydcblxuZXhwb3J0IHR5cGUgVG9vbEFjdGl2aXR5ID0ge1xuICB0b29sTmFtZTogc3RyaW5nXG4gIGlucHV0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPlxuICAvKiogUHJlLWNvbXB1dGVkIGFjdGl2aXR5IGRlc2NyaXB0aW9uIGZyb20gdGhlIHRvb2wsIGUuZy4gXCJSZWFkaW5nIHNyYy9mb28udHNcIiAqL1xuICBhY3Rpdml0eURlc2NyaXB0aW9uPzogc3RyaW5nXG4gIC8qKiBQcmUtY29tcHV0ZWQ6IHRydWUgaWYgdGhpcyBpcyBhIHNlYXJjaCBvcGVyYXRpb24gKEdyZXAsIEdsb2IsIGV0Yy4pICovXG4gIGlzU2VhcmNoPzogYm9vbGVhblxuICAvKiogUHJlLWNvbXB1dGVkOiB0cnVlIGlmIHRoaXMgaXMgYSByZWFkIG9wZXJhdGlvbiAoUmVhZCwgY2F0LCBldGMuKSAqL1xuICBpc1JlYWQ/OiBib29sZWFuXG59XG5cbmV4cG9ydCB0eXBlIEFnZW50UHJvZ3Jlc3MgPSB7XG4gIHRvb2xVc2VDb3VudDogbnVtYmVyXG4gIHRva2VuQ291bnQ6IG51bWJlclxuICBsYXN0QWN0aXZpdHk/OiBUb29sQWN0aXZpdHlcbiAgcmVjZW50QWN0aXZpdGllcz86IFRvb2xBY3Rpdml0eVtdXG4gIHN1bW1hcnk/OiBzdHJpbmdcbn1cblxuY29uc3QgTUFYX1JFQ0VOVF9BQ1RJVklUSUVTID0gNVxuXG5leHBvcnQgdHlwZSBQcm9ncmVzc1RyYWNrZXIgPSB7XG4gIHRvb2xVc2VDb3VudDogbnVtYmVyXG4gIC8vIFRyYWNrIGlucHV0IGFuZCBvdXRwdXQgc2VwYXJhdGVseSB0byBhdm9pZCBkb3VibGUtY291bnRpbmcuXG4gIC8vIGlucHV0X3Rva2VucyBpbiBDbGF1ZGUgQVBJIGlzIGN1bXVsYXRpdmUgcGVyIHR1cm4gKGluY2x1ZGVzIGFsbCBwcmV2aW91cyBjb250ZXh0KSxcbiAgLy8gc28gd2Uga2VlcCB0aGUgbGF0ZXN0IHZhbHVlLiBvdXRwdXRfdG9rZW5zIGlzIHBlci10dXJuLCBzbyB3ZSBzdW0gdGhvc2UuXG4gIGxhdGVzdElucHV0VG9rZW5zOiBudW1iZXJcbiAgY3VtdWxhdGl2ZU91dHB1dFRva2VuczogbnVtYmVyXG4gIHJlY2VudEFjdGl2aXRpZXM6IFRvb2xBY3Rpdml0eVtdXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQcm9ncmVzc1RyYWNrZXIoKTogUHJvZ3Jlc3NUcmFja2VyIHtcbiAgcmV0dXJuIHtcbiAgICB0b29sVXNlQ291bnQ6IDAsXG4gICAgbGF0ZXN0SW5wdXRUb2tlbnM6IDAsXG4gICAgY3VtdWxhdGl2ZU91dHB1dFRva2VuczogMCxcbiAgICByZWNlbnRBY3Rpdml0aWVzOiBbXSxcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VG9rZW5Db3VudEZyb21UcmFja2VyKHRyYWNrZXI6IFByb2dyZXNzVHJhY2tlcik6IG51bWJlciB7XG4gIHJldHVybiB0cmFja2VyLmxhdGVzdElucHV0VG9rZW5zICsgdHJhY2tlci5jdW11bGF0aXZlT3V0cHV0VG9rZW5zXG59XG5cbi8qKlxuICogUmVzb2x2ZXIgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgaHVtYW4tcmVhZGFibGUgYWN0aXZpdHkgZGVzY3JpcHRpb25cbiAqIGZvciBhIGdpdmVuIHRvb2wgbmFtZSBhbmQgaW5wdXQuIFVzZWQgdG8gcHJlLWNvbXB1dGUgZGVzY3JpcHRpb25zXG4gKiBmcm9tIFRvb2wuZ2V0QWN0aXZpdHlEZXNjcmlwdGlvbigpIGF0IHJlY29yZGluZyB0aW1lLlxuICovXG5leHBvcnQgdHlwZSBBY3Rpdml0eURlc2NyaXB0aW9uUmVzb2x2ZXIgPSAoXG4gIHRvb2xOYW1lOiBzdHJpbmcsXG4gIGlucHV0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPixcbikgPT4gc3RyaW5nIHwgdW5kZWZpbmVkXG5cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVQcm9ncmVzc0Zyb21NZXNzYWdlKFxuICB0cmFja2VyOiBQcm9ncmVzc1RyYWNrZXIsXG4gIG1lc3NhZ2U6IE1lc3NhZ2UsXG4gIHJlc29sdmVBY3Rpdml0eURlc2NyaXB0aW9uPzogQWN0aXZpdHlEZXNjcmlwdGlvblJlc29sdmVyLFxuICB0b29scz86IFRvb2xzLFxuKTogdm9pZCB7XG4gIGlmIChtZXNzYWdlLnR5cGUgIT09ICdhc3Npc3RhbnQnKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgY29uc3QgdXNhZ2UgPSBtZXNzYWdlLm1lc3NhZ2UudXNhZ2VcbiAgLy8gS2VlcCBsYXRlc3QgaW5wdXQgKGl0J3MgY3VtdWxhdGl2ZSBpbiB0aGUgQVBJKSwgc3VtIG91dHB1dHNcbiAgdHJhY2tlci5sYXRlc3RJbnB1dFRva2VucyA9XG4gICAgdXNhZ2UuaW5wdXRfdG9rZW5zICtcbiAgICAodXNhZ2UuY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zID8/IDApICtcbiAgICAodXNhZ2UuY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMgPz8gMClcbiAgdHJhY2tlci5jdW11bGF0aXZlT3V0cHV0VG9rZW5zICs9IHVzYWdlLm91dHB1dF90b2tlbnNcbiAgZm9yIChjb25zdCBjb250ZW50IG9mIG1lc3NhZ2UubWVzc2FnZS5jb250ZW50KSB7XG4gICAgaWYgKGNvbnRlbnQudHlwZSA9PT0gJ3Rvb2xfdXNlJykge1xuICAgICAgdHJhY2tlci50b29sVXNlQ291bnQrK1xuICAgICAgLy8gT21pdCBTdHJ1Y3R1cmVkT3V0cHV0IGZyb20gcHJldmlldyAtIGl0J3MgYW4gaW50ZXJuYWwgdG9vbFxuICAgICAgaWYgKGNvbnRlbnQubmFtZSAhPT0gU1lOVEhFVElDX09VVFBVVF9UT09MX05BTUUpIHtcbiAgICAgICAgY29uc3QgaW5wdXQgPSBjb250ZW50LmlucHV0IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gICAgICAgIGNvbnN0IGNsYXNzaWZpY2F0aW9uID0gdG9vbHNcbiAgICAgICAgICA/IGdldFRvb2xTZWFyY2hPclJlYWRJbmZvKGNvbnRlbnQubmFtZSwgaW5wdXQsIHRvb2xzKVxuICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgIHRyYWNrZXIucmVjZW50QWN0aXZpdGllcy5wdXNoKHtcbiAgICAgICAgICB0b29sTmFtZTogY29udGVudC5uYW1lLFxuICAgICAgICAgIGlucHV0LFxuICAgICAgICAgIGFjdGl2aXR5RGVzY3JpcHRpb246IHJlc29sdmVBY3Rpdml0eURlc2NyaXB0aW9uPy4oXG4gICAgICAgICAgICBjb250ZW50Lm5hbWUsXG4gICAgICAgICAgICBpbnB1dCxcbiAgICAgICAgICApLFxuICAgICAgICAgIGlzU2VhcmNoOiBjbGFzc2lmaWNhdGlvbj8uaXNTZWFyY2gsXG4gICAgICAgICAgaXNSZWFkOiBjbGFzc2lmaWNhdGlvbj8uaXNSZWFkLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgfVxuICB3aGlsZSAodHJhY2tlci5yZWNlbnRBY3Rpdml0aWVzLmxlbmd0aCA+IE1BWF9SRUNFTlRfQUNUSVZJVElFUykge1xuICAgIHRyYWNrZXIucmVjZW50QWN0aXZpdGllcy5zaGlmdCgpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByb2dyZXNzVXBkYXRlKHRyYWNrZXI6IFByb2dyZXNzVHJhY2tlcik6IEFnZW50UHJvZ3Jlc3Mge1xuICByZXR1cm4ge1xuICAgIHRvb2xVc2VDb3VudDogdHJhY2tlci50b29sVXNlQ291bnQsXG4gICAgdG9rZW5Db3VudDogZ2V0VG9rZW5Db3VudEZyb21UcmFja2VyKHRyYWNrZXIpLFxuICAgIGxhc3RBY3Rpdml0eTpcbiAgICAgIHRyYWNrZXIucmVjZW50QWN0aXZpdGllcy5sZW5ndGggPiAwXG4gICAgICAgID8gdHJhY2tlci5yZWNlbnRBY3Rpdml0aWVzW3RyYWNrZXIucmVjZW50QWN0aXZpdGllcy5sZW5ndGggLSAxXVxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICByZWNlbnRBY3Rpdml0aWVzOiBbLi4udHJhY2tlci5yZWNlbnRBY3Rpdml0aWVzXSxcbiAgfVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYW4gQWN0aXZpdHlEZXNjcmlwdGlvblJlc29sdmVyIGZyb20gYSB0b29scyBsaXN0LlxuICogTG9va3MgdXAgdGhlIHRvb2wgYnkgbmFtZSBhbmQgY2FsbHMgZ2V0QWN0aXZpdHlEZXNjcmlwdGlvbiBpZiBhdmFpbGFibGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBY3Rpdml0eURlc2NyaXB0aW9uUmVzb2x2ZXIoXG4gIHRvb2xzOiBUb29scyxcbik6IEFjdGl2aXR5RGVzY3JpcHRpb25SZXNvbHZlciB7XG4gIHJldHVybiAodG9vbE5hbWUsIGlucHV0KSA9PiB7XG4gICAgY29uc3QgdG9vbCA9IGZpbmRUb29sQnlOYW1lKHRvb2xzLCB0b29sTmFtZSlcbiAgICByZXR1cm4gdG9vbD8uZ2V0QWN0aXZpdHlEZXNjcmlwdGlvbj8uKGlucHV0KSA/PyB1bmRlZmluZWRcbiAgfVxufVxuXG5leHBvcnQgdHlwZSBMb2NhbEFnZW50VGFza1N0YXRlID0gVGFza1N0YXRlQmFzZSAmIHtcbiAgdHlwZTogJ2xvY2FsX2FnZW50J1xuICBhZ2VudElkOiBzdHJpbmdcbiAgcHJvbXB0OiBzdHJpbmdcbiAgc2VsZWN0ZWRBZ2VudD86IEFnZW50RGVmaW5pdGlvblxuICBhZ2VudFR5cGU6IHN0cmluZ1xuICBtb2RlbD86IHN0cmluZ1xuICBhYm9ydENvbnRyb2xsZXI/OiBBYm9ydENvbnRyb2xsZXJcbiAgdW5yZWdpc3RlckNsZWFudXA/OiAoKSA9PiB2b2lkXG4gIGVycm9yPzogc3RyaW5nXG4gIHJlc3VsdD86IEFnZW50VG9vbFJlc3VsdFxuICBwcm9ncmVzcz86IEFnZW50UHJvZ3Jlc3NcbiAgcmV0cmlldmVkOiBib29sZWFuXG4gIG1lc3NhZ2VzPzogTWVzc2FnZVtdXG4gIC8vIFRyYWNrIHdoYXQgd2UgbGFzdCByZXBvcnRlZCBmb3IgY29tcHV0aW5nIGRlbHRhc1xuICBsYXN0UmVwb3J0ZWRUb29sQ291bnQ6IG51bWJlclxuICBsYXN0UmVwb3J0ZWRUb2tlbkNvdW50OiBudW1iZXJcbiAgLy8gV2hldGhlciB0aGUgdGFzayBoYXMgYmVlbiBiYWNrZ3JvdW5kZWQgKGZhbHNlID0gZm9yZWdyb3VuZCBydW5uaW5nLCB0cnVlID0gYmFja2dyb3VuZGVkKVxuICBpc0JhY2tncm91bmRlZDogYm9vbGVhblxuICAvLyBNZXNzYWdlcyBxdWV1ZWQgbWlkLXR1cm4gdmlhIFNlbmRNZXNzYWdlLCBkcmFpbmVkIGF0IHRvb2wtcm91bmQgYm91bmRhcmllc1xuICBwZW5kaW5nTWVzc2FnZXM6IHN0cmluZ1tdXG4gIC8vIFVJIGlzIGhvbGRpbmcgdGhpcyB0YXNrOiBibG9ja3MgZXZpY3Rpb24sIGVuYWJsZXMgc3RyZWFtLWFwcGVuZCwgdHJpZ2dlcnNcbiAgLy8gZGlzayBib290c3RyYXAuIFNldCBieSBlbnRlclRlYW1tYXRlVmlldy4gU2VwYXJhdGUgZnJvbSB2aWV3aW5nQWdlbnRUYXNrSWRcbiAgLy8gKHdoaWNoIGlzIFwid2hhdCBhbSBJIExPT0tJTkcgYXRcIikg4oCUIHJldGFpbiBpcyBcIndoYXQgYW0gSSBIT0xESU5HLlwiXG4gIHJldGFpbjogYm9vbGVhblxuICAvLyBCb290c3RyYXAgaGFzIHJlYWQgdGhlIHNpZGVjaGFpbiBKU09OTCBhbmQgVVVJRC1tZXJnZWQgaW50byBtZXNzYWdlcy5cbiAgLy8gT25lLXNob3QgcGVyIHJldGFpbiBjeWNsZTsgc3RyZWFtIGFwcGVuZHMgZnJvbSB0aGVyZS5cbiAgZGlza0xvYWRlZDogYm9vbGVhblxuICAvLyBQYW5lbCB2aXNpYmlsaXR5IGRlYWRsaW5lLiB1bmRlZmluZWQgPSBubyBkZWFkbGluZSAocnVubmluZyBvciByZXRhaW5lZCk7XG4gIC8vIHRpbWVzdGFtcCA9IGhpZGUgKyBHQy1lbGlnaWJsZSBhZnRlciB0aGlzIHRpbWUuIFNldCBhdCB0ZXJtaW5hbCB0cmFuc2l0aW9uXG4gIC8vIGFuZCBvbiB1bnNlbGVjdDsgY2xlYXJlZCBvbiByZXRhaW4uXG4gIGV2aWN0QWZ0ZXI/OiBudW1iZXJcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzTG9jYWxBZ2VudFRhc2sodGFzazogdW5rbm93bik6IHRhc2sgaXMgTG9jYWxBZ2VudFRhc2tTdGF0ZSB7XG4gIHJldHVybiAoXG4gICAgdHlwZW9mIHRhc2sgPT09ICdvYmplY3QnICYmXG4gICAgdGFzayAhPT0gbnVsbCAmJlxuICAgICd0eXBlJyBpbiB0YXNrICYmXG4gICAgdGFzay50eXBlID09PSAnbG9jYWxfYWdlbnQnXG4gIClcbn1cblxuLyoqXG4gKiBBIGxvY2FsX2FnZW50IHRhc2sgdGhhdCB0aGUgQ29vcmRpbmF0b3JUYXNrUGFuZWwgbWFuYWdlcyAobm90IG1haW4tc2Vzc2lvbikuXG4gKiBGb3IgYW50cywgdGhlc2UgcmVuZGVyIGluIHRoZSBwYW5lbCBpbnN0ZWFkIG9mIHRoZSBiYWNrZ3JvdW5kLXRhc2sgcGlsbC5cbiAqIFRoaXMgaXMgdGhlIE9ORSBwcmVkaWNhdGUgdGhhdCBhbGwgcGlsbC9wYW5lbCBmaWx0ZXJzIG11c3QgYWdyZWUgb24g4oCUIGlmXG4gKiB0aGUgZ2F0ZSBjaGFuZ2VzLCBjaGFuZ2UgaXQgaGVyZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGFuZWxBZ2VudFRhc2sodDogdW5rbm93bik6IHQgaXMgTG9jYWxBZ2VudFRhc2tTdGF0ZSB7XG4gIHJldHVybiBpc0xvY2FsQWdlbnRUYXNrKHQpICYmIHQuYWdlbnRUeXBlICE9PSAnbWFpbi1zZXNzaW9uJ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcXVldWVQZW5kaW5nTWVzc2FnZShcbiAgdGFza0lkOiBzdHJpbmcsXG4gIG1zZzogc3RyaW5nLFxuICBzZXRBcHBTdGF0ZTogKGY6IChwcmV2OiBBcHBTdGF0ZSkgPT4gQXBwU3RhdGUpID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgdXBkYXRlVGFza1N0YXRlPExvY2FsQWdlbnRUYXNrU3RhdGU+KHRhc2tJZCwgc2V0QXBwU3RhdGUsIHRhc2sgPT4gKHtcbiAgICAuLi50YXNrLFxuICAgIHBlbmRpbmdNZXNzYWdlczogWy4uLnRhc2sucGVuZGluZ01lc3NhZ2VzLCBtc2ddLFxuICB9KSlcbn1cblxuLyoqXG4gKiBBcHBlbmQgYSBtZXNzYWdlIHRvIHRhc2subWVzc2FnZXMgc28gaXQgYXBwZWFycyBpbiB0aGUgdmlld2VkIHRyYW5zY3JpcHRcbiAqIGltbWVkaWF0ZWx5LiBDYWxsZXIgY29uc3RydWN0cyB0aGUgTWVzc2FnZSAoYnJlYWtzIHRoZSBtZXNzYWdlcy50cyBjeWNsZSkuXG4gKiBxdWV1ZVBlbmRpbmdNZXNzYWdlIGFuZCByZXN1bWVBZ2VudEJhY2tncm91bmQgcm91dGUgdGhlIHByb21wdCB0byB0aGVcbiAqIGFnZW50J3MgQVBJIGlucHV0IGJ1dCBkb24ndCB0b3VjaCB0aGUgZGlzcGxheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZE1lc3NhZ2VUb0xvY2FsQWdlbnQoXG4gIHRhc2tJZDogc3RyaW5nLFxuICBtZXNzYWdlOiBNZXNzYWdlLFxuICBzZXRBcHBTdGF0ZTogKGY6IChwcmV2OiBBcHBTdGF0ZSkgPT4gQXBwU3RhdGUpID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgdXBkYXRlVGFza1N0YXRlPExvY2FsQWdlbnRUYXNrU3RhdGU+KHRhc2tJZCwgc2V0QXBwU3RhdGUsIHRhc2sgPT4gKHtcbiAgICAuLi50YXNrLFxuICAgIG1lc3NhZ2VzOiBbLi4uKHRhc2subWVzc2FnZXMgPz8gW10pLCBtZXNzYWdlXSxcbiAgfSkpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkcmFpblBlbmRpbmdNZXNzYWdlcyhcbiAgdGFza0lkOiBzdHJpbmcsXG4gIGdldEFwcFN0YXRlOiAoKSA9PiBBcHBTdGF0ZSxcbiAgc2V0QXBwU3RhdGU6IChmOiAocHJldjogQXBwU3RhdGUpID0+IEFwcFN0YXRlKSA9PiB2b2lkLFxuKTogc3RyaW5nW10ge1xuICBjb25zdCB0YXNrID0gZ2V0QXBwU3RhdGUoKS50YXNrc1t0YXNrSWRdXG4gIGlmICghaXNMb2NhbEFnZW50VGFzayh0YXNrKSB8fCB0YXNrLnBlbmRpbmdNZXNzYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gW11cbiAgfVxuICBjb25zdCBkcmFpbmVkID0gdGFzay5wZW5kaW5nTWVzc2FnZXNcbiAgdXBkYXRlVGFza1N0YXRlPExvY2FsQWdlbnRUYXNrU3RhdGU+KHRhc2tJZCwgc2V0QXBwU3RhdGUsIHQgPT4gKHtcbiAgICAuLi50LFxuICAgIHBlbmRpbmdNZXNzYWdlczogW10sXG4gIH0pKVxuICByZXR1cm4gZHJhaW5lZFxufVxuXG4vKipcbiAqIEVucXVldWUgYW4gYWdlbnQgbm90aWZpY2F0aW9uIHRvIHRoZSBtZXNzYWdlIHF1ZXVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5xdWV1ZUFnZW50Tm90aWZpY2F0aW9uKHtcbiAgdGFza0lkLFxuICBkZXNjcmlwdGlvbixcbiAgc3RhdHVzLFxuICBlcnJvcixcbiAgc2V0QXBwU3RhdGUsXG4gIGZpbmFsTWVzc2FnZSxcbiAgdXNhZ2UsXG4gIHRvb2xVc2VJZCxcbiAgd29ya3RyZWVQYXRoLFxuICB3b3JrdHJlZUJyYW5jaCxcbn06IHtcbiAgdGFza0lkOiBzdHJpbmdcbiAgZGVzY3JpcHRpb246IHN0cmluZ1xuICBzdGF0dXM6ICdjb21wbGV0ZWQnIHwgJ2ZhaWxlZCcgfCAna2lsbGVkJ1xuICBlcnJvcj86IHN0cmluZ1xuICBzZXRBcHBTdGF0ZTogU2V0QXBwU3RhdGVcbiAgZmluYWxNZXNzYWdlPzogc3RyaW5nXG4gIHVzYWdlPzoge1xuICAgIHRvdGFsVG9rZW5zOiBudW1iZXJcbiAgICB0b29sVXNlczogbnVtYmVyXG4gICAgZHVyYXRpb25NczogbnVtYmVyXG4gIH1cbiAgdG9vbFVzZUlkPzogc3RyaW5nXG4gIHdvcmt0cmVlUGF0aD86IHN0cmluZ1xuICB3b3JrdHJlZUJyYW5jaD86IHN0cmluZ1xufSk6IHZvaWQge1xuICAvLyBBdG9taWNhbGx5IGNoZWNrIGFuZCBzZXQgbm90aWZpZWQgZmxhZyB0byBwcmV2ZW50IGR1cGxpY2F0ZSBub3RpZmljYXRpb25zLlxuICAvLyBJZiB0aGUgdGFzayB3YXMgYWxyZWFkeSBtYXJrZWQgYXMgbm90aWZpZWQgKGUuZy4sIGJ5IFRhc2tTdG9wVG9vbCksIHNraXBcbiAgLy8gZW5xdWV1ZWluZyB0byBhdm9pZCBzZW5kaW5nIHJlZHVuZGFudCBtZXNzYWdlcyB0byB0aGUgbW9kZWwuXG4gIGxldCBzaG91bGRFbnF1ZXVlID0gZmFsc2VcbiAgdXBkYXRlVGFza1N0YXRlPExvY2FsQWdlbnRUYXNrU3RhdGU+KHRhc2tJZCwgc2V0QXBwU3RhdGUsIHRhc2sgPT4ge1xuICAgIGlmICh0YXNrLm5vdGlmaWVkKSB7XG4gICAgICByZXR1cm4gdGFza1xuICAgIH1cbiAgICBzaG91bGRFbnF1ZXVlID0gdHJ1ZVxuICAgIHJldHVybiB7XG4gICAgICAuLi50YXNrLFxuICAgICAgbm90aWZpZWQ6IHRydWUsXG4gICAgfVxuICB9KVxuXG4gIGlmICghc2hvdWxkRW5xdWV1ZSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgLy8gQWJvcnQgYW55IGFjdGl2ZSBzcGVjdWxhdGlvbiDigJQgYmFja2dyb3VuZCB0YXNrIHN0YXRlIGNoYW5nZWQsIHNvIHNwZWN1bGF0ZWRcbiAgLy8gcmVzdWx0cyBtYXkgcmVmZXJlbmNlIHN0YWxlIHRhc2sgb3V0cHV0LiBUaGUgcHJvbXB0IHN1Z2dlc3Rpb24gdGV4dCBpc1xuICAvLyBwcmVzZXJ2ZWQ7IG9ubHkgdGhlIHByZS1jb21wdXRlZCByZXNwb25zZSBpcyBkaXNjYXJkZWQuXG4gIGFib3J0U3BlY3VsYXRpb24oc2V0QXBwU3RhdGUpXG5cbiAgY29uc3Qgc3VtbWFyeSA9XG4gICAgc3RhdHVzID09PSAnY29tcGxldGVkJ1xuICAgICAgPyBgQWdlbnQgXCIke2Rlc2NyaXB0aW9ufVwiIGNvbXBsZXRlZGBcbiAgICAgIDogc3RhdHVzID09PSAnZmFpbGVkJ1xuICAgICAgICA/IGBBZ2VudCBcIiR7ZGVzY3JpcHRpb259XCIgZmFpbGVkOiAke2Vycm9yIHx8ICdVbmtub3duIGVycm9yJ31gXG4gICAgICAgIDogYEFnZW50IFwiJHtkZXNjcmlwdGlvbn1cIiB3YXMgc3RvcHBlZGBcblxuICBjb25zdCBvdXRwdXRQYXRoID0gZ2V0VGFza091dHB1dFBhdGgodGFza0lkKVxuICBjb25zdCB0b29sVXNlSWRMaW5lID0gdG9vbFVzZUlkXG4gICAgPyBgXFxuPCR7VE9PTF9VU0VfSURfVEFHfT4ke3Rvb2xVc2VJZH08LyR7VE9PTF9VU0VfSURfVEFHfT5gXG4gICAgOiAnJ1xuICBjb25zdCByZXN1bHRTZWN0aW9uID0gZmluYWxNZXNzYWdlID8gYFxcbjxyZXN1bHQ+JHtmaW5hbE1lc3NhZ2V9PC9yZXN1bHQ+YCA6ICcnXG4gIGNvbnN0IHVzYWdlU2VjdGlvbiA9IHVzYWdlXG4gICAgPyBgXFxuPHVzYWdlPjx0b3RhbF90b2tlbnM+JHt1c2FnZS50b3RhbFRva2Vuc308L3RvdGFsX3Rva2Vucz48dG9vbF91c2VzPiR7dXNhZ2UudG9vbFVzZXN9PC90b29sX3VzZXM+PGR1cmF0aW9uX21zPiR7dXNhZ2UuZHVyYXRpb25Nc308L2R1cmF0aW9uX21zPjwvdXNhZ2U+YFxuICAgIDogJydcbiAgY29uc3Qgd29ya3RyZWVTZWN0aW9uID0gd29ya3RyZWVQYXRoXG4gICAgPyBgXFxuPCR7V09SS1RSRUVfVEFHfT48JHtXT1JLVFJFRV9QQVRIX1RBR30+JHt3b3JrdHJlZVBhdGh9PC8ke1dPUktUUkVFX1BBVEhfVEFHfT4ke3dvcmt0cmVlQnJhbmNoID8gYDwke1dPUktUUkVFX0JSQU5DSF9UQUd9PiR7d29ya3RyZWVCcmFuY2h9PC8ke1dPUktUUkVFX0JSQU5DSF9UQUd9PmAgOiAnJ308LyR7V09SS1RSRUVfVEFHfT5gXG4gICAgOiAnJ1xuXG4gIGNvbnN0IG1lc3NhZ2UgPSBgPCR7VEFTS19OT1RJRklDQVRJT05fVEFHfT5cbjwke1RBU0tfSURfVEFHfT4ke3Rhc2tJZH08LyR7VEFTS19JRF9UQUd9PiR7dG9vbFVzZUlkTGluZX1cbjwke09VVFBVVF9GSUxFX1RBR30+JHtvdXRwdXRQYXRofTwvJHtPVVRQVVRfRklMRV9UQUd9PlxuPCR7U1RBVFVTX1RBR30+JHtzdGF0dXN9PC8ke1NUQVRVU19UQUd9PlxuPCR7U1VNTUFSWV9UQUd9PiR7c3VtbWFyeX08LyR7U1VNTUFSWV9UQUd9PiR7cmVzdWx0U2VjdGlvbn0ke3VzYWdlU2VjdGlvbn0ke3dvcmt0cmVlU2VjdGlvbn1cbjwvJHtUQVNLX05PVElGSUNBVElPTl9UQUd9PmBcblxuICBlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbih7IHZhbHVlOiBtZXNzYWdlLCBtb2RlOiAndGFzay1ub3RpZmljYXRpb24nIH0pXG59XG5cbi8qKlxuICogTG9jYWxBZ2VudFRhc2sgLSBIYW5kbGVzIGJhY2tncm91bmQgYWdlbnQgZXhlY3V0aW9uLlxuICpcbiAqIFJlcGxhY2VzIHRoZSBBc3luY0FnZW50IGltcGxlbWVudGF0aW9uIGZyb20gc3JjL3Rvb2xzL0FnZW50VG9vbC9hc3luY0FnZW50VXRpbHMudHNcbiAqIHdpdGggYSB1bmlmaWVkIFRhc2sgaW50ZXJmYWNlLlxuICovXG5leHBvcnQgY29uc3QgTG9jYWxBZ2VudFRhc2s6IFRhc2sgPSB7XG4gIG5hbWU6ICdMb2NhbEFnZW50VGFzaycsXG4gIHR5cGU6ICdsb2NhbF9hZ2VudCcsXG5cbiAgYXN5bmMga2lsbCh0YXNrSWQsIHNldEFwcFN0YXRlKSB7XG4gICAga2lsbEFzeW5jQWdlbnQodGFza0lkLCBzZXRBcHBTdGF0ZSlcbiAgfSxcbn1cblxuLyoqXG4gKiBLaWxsIGFuIGFnZW50IHRhc2suIE5vLW9wIGlmIGFscmVhZHkga2lsbGVkL2NvbXBsZXRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGtpbGxBc3luY0FnZW50KHRhc2tJZDogc3RyaW5nLCBzZXRBcHBTdGF0ZTogU2V0QXBwU3RhdGUpOiB2b2lkIHtcbiAgbGV0IGtpbGxlZCA9IGZhbHNlXG4gIHVwZGF0ZVRhc2tTdGF0ZTxMb2NhbEFnZW50VGFza1N0YXRlPih0YXNrSWQsIHNldEFwcFN0YXRlLCB0YXNrID0+IHtcbiAgICBpZiAodGFzay5zdGF0dXMgIT09ICdydW5uaW5nJykge1xuICAgICAgcmV0dXJuIHRhc2tcbiAgICB9XG4gICAga2lsbGVkID0gdHJ1ZVxuICAgIHRhc2suYWJvcnRDb250cm9sbGVyPy5hYm9ydCgpXG4gICAgdGFzay51bnJlZ2lzdGVyQ2xlYW51cD8uKClcbiAgICByZXR1cm4ge1xuICAgICAgLi4udGFzayxcbiAgICAgIHN0YXR1czogJ2tpbGxlZCcsXG4gICAgICBlbmRUaW1lOiBEYXRlLm5vdygpLFxuICAgICAgZXZpY3RBZnRlcjogdGFzay5yZXRhaW4gPyB1bmRlZmluZWQgOiBEYXRlLm5vdygpICsgUEFORUxfR1JBQ0VfTVMsXG4gICAgICBhYm9ydENvbnRyb2xsZXI6IHVuZGVmaW5lZCxcbiAgICAgIHVucmVnaXN0ZXJDbGVhbnVwOiB1bmRlZmluZWQsXG4gICAgICBzZWxlY3RlZEFnZW50OiB1bmRlZmluZWQsXG4gICAgfVxuICB9KVxuICBpZiAoa2lsbGVkKSB7XG4gICAgdm9pZCBldmljdFRhc2tPdXRwdXQodGFza0lkKVxuICB9XG59XG5cbi8qKlxuICogS2lsbCBhbGwgcnVubmluZyBhZ2VudCB0YXNrcy5cbiAqIFVzZWQgYnkgRVNDIGNhbmNlbGxhdGlvbiBpbiBjb29yZGluYXRvciBtb2RlIHRvIHN0b3AgYWxsIHN1YmFnZW50cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGtpbGxBbGxSdW5uaW5nQWdlbnRUYXNrcyhcbiAgdGFza3M6IFJlY29yZDxzdHJpbmcsIFRhc2tTdGF0ZT4sXG4gIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZSxcbik6IHZvaWQge1xuICBmb3IgKGNvbnN0IFt0YXNrSWQsIHRhc2tdIG9mIE9iamVjdC5lbnRyaWVzKHRhc2tzKSkge1xuICAgIGlmICh0YXNrLnR5cGUgPT09ICdsb2NhbF9hZ2VudCcgJiYgdGFzay5zdGF0dXMgPT09ICdydW5uaW5nJykge1xuICAgICAga2lsbEFzeW5jQWdlbnQodGFza0lkLCBzZXRBcHBTdGF0ZSlcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBNYXJrIGEgdGFzayBhcyBub3RpZmllZCB3aXRob3V0IGVucXVldWVpbmcgYSBub3RpZmljYXRpb24uXG4gKiBVc2VkIGJ5IGNoYXQ6a2lsbEFnZW50cyBidWxrIGtpbGwgdG8gc3VwcHJlc3MgcGVyLWFnZW50IGFzeW5jIG5vdGlmaWNhdGlvbnNcbiAqIHdoZW4gYSBzaW5nbGUgYWdncmVnYXRlIG1lc3NhZ2UgaXMgc2VudCBpbnN0ZWFkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFya0FnZW50c05vdGlmaWVkKFxuICB0YXNrSWQ6IHN0cmluZyxcbiAgc2V0QXBwU3RhdGU6IFNldEFwcFN0YXRlLFxuKTogdm9pZCB7XG4gIHVwZGF0ZVRhc2tTdGF0ZTxMb2NhbEFnZW50VGFza1N0YXRlPih0YXNrSWQsIHNldEFwcFN0YXRlLCB0YXNrID0+IHtcbiAgICBpZiAodGFzay5ub3RpZmllZCkge1xuICAgICAgcmV0dXJuIHRhc2tcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnRhc2ssXG4gICAgICBub3RpZmllZDogdHJ1ZSxcbiAgICB9XG4gIH0pXG59XG5cbi8qKlxuICogVXBkYXRlIHByb2dyZXNzIGZvciBhbiBhZ2VudCB0YXNrLlxuICogUHJlc2VydmVzIHRoZSBleGlzdGluZyBzdW1tYXJ5IGZpZWxkIHNvIHRoYXQgYmFja2dyb3VuZCBzdW1tYXJpemF0aW9uXG4gKiByZXN1bHRzIGFyZSBub3QgY2xvYmJlcmVkIGJ5IHByb2dyZXNzIHVwZGF0ZXMgZnJvbSBhc3Npc3RhbnQgbWVzc2FnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVBZ2VudFByb2dyZXNzKFxuICB0YXNrSWQ6IHN0cmluZyxcbiAgcHJvZ3Jlc3M6IEFnZW50UHJvZ3Jlc3MsXG4gIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZSxcbik6IHZvaWQge1xuICB1cGRhdGVUYXNrU3RhdGU8TG9jYWxBZ2VudFRhc2tTdGF0ZT4odGFza0lkLCBzZXRBcHBTdGF0ZSwgdGFzayA9PiB7XG4gICAgaWYgKHRhc2suc3RhdHVzICE9PSAncnVubmluZycpIHtcbiAgICAgIHJldHVybiB0YXNrXG4gICAgfVxuXG4gICAgY29uc3QgZXhpc3RpbmdTdW1tYXJ5ID0gdGFzay5wcm9ncmVzcz8uc3VtbWFyeVxuICAgIHJldHVybiB7XG4gICAgICAuLi50YXNrLFxuICAgICAgcHJvZ3Jlc3M6IGV4aXN0aW5nU3VtbWFyeVxuICAgICAgICA/IHsgLi4ucHJvZ3Jlc3MsIHN1bW1hcnk6IGV4aXN0aW5nU3VtbWFyeSB9XG4gICAgICAgIDogcHJvZ3Jlc3MsXG4gICAgfVxuICB9KVxufVxuXG4vKipcbiAqIFVwZGF0ZSB0aGUgYmFja2dyb3VuZCBzdW1tYXJ5IGZvciBhbiBhZ2VudCB0YXNrLlxuICogQ2FsbGVkIGJ5IHRoZSBwZXJpb2RpYyBzdW1tYXJpemF0aW9uIHNlcnZpY2UgdG8gc3RvcmUgYSAxLTIgc2VudGVuY2UgcHJvZ3Jlc3Mgc3VtbWFyeS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVwZGF0ZUFnZW50U3VtbWFyeShcbiAgdGFza0lkOiBzdHJpbmcsXG4gIHN1bW1hcnk6IHN0cmluZyxcbiAgc2V0QXBwU3RhdGU6IFNldEFwcFN0YXRlLFxuKTogdm9pZCB7XG4gIGxldCBjYXB0dXJlZDoge1xuICAgIHRva2VuQ291bnQ6IG51bWJlclxuICAgIHRvb2xVc2VDb3VudDogbnVtYmVyXG4gICAgc3RhcnRUaW1lOiBudW1iZXJcbiAgICB0b29sVXNlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZFxuICB9IHwgbnVsbCA9IG51bGxcblxuICB1cGRhdGVUYXNrU3RhdGU8TG9jYWxBZ2VudFRhc2tTdGF0ZT4odGFza0lkLCBzZXRBcHBTdGF0ZSwgdGFzayA9PiB7XG4gICAgaWYgKHRhc2suc3RhdHVzICE9PSAncnVubmluZycpIHtcbiAgICAgIHJldHVybiB0YXNrXG4gICAgfVxuXG4gICAgY2FwdHVyZWQgPSB7XG4gICAgICB0b2tlbkNvdW50OiB0YXNrLnByb2dyZXNzPy50b2tlbkNvdW50ID8/IDAsXG4gICAgICB0b29sVXNlQ291bnQ6IHRhc2sucHJvZ3Jlc3M/LnRvb2xVc2VDb3VudCA/PyAwLFxuICAgICAgc3RhcnRUaW1lOiB0YXNrLnN0YXJ0VGltZSxcbiAgICAgIHRvb2xVc2VJZDogdGFzay50b29sVXNlSWQsXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLnRhc2ssXG4gICAgICBwcm9ncmVzczoge1xuICAgICAgICAuLi50YXNrLnByb2dyZXNzLFxuICAgICAgICB0b29sVXNlQ291bnQ6IHRhc2sucHJvZ3Jlc3M/LnRvb2xVc2VDb3VudCA/PyAwLFxuICAgICAgICB0b2tlbkNvdW50OiB0YXNrLnByb2dyZXNzPy50b2tlbkNvdW50ID8/IDAsXG4gICAgICAgIHN1bW1hcnksXG4gICAgICB9LFxuICAgIH1cbiAgfSlcblxuICAvLyBFbWl0IHN1bW1hcnkgdG8gU0RLIGNvbnN1bWVycyAoZS5nLiBWUyBDb2RlIHN1YmFnZW50IHBhbmVsKS4gTm8tb3AgaW4gVFVJLlxuICAvLyBHYXRlIG9uIHRoZSBTREsgb3B0aW9uIHNvIGNvb3JkaW5hdG9yLW1vZGUgc2Vzc2lvbnMgd2l0aG91dCB0aGUgZmxhZyBkb24ndFxuICAvLyBsZWFrIHN1bW1hcnkgZXZlbnRzIHRvIGNvbnN1bWVycyB3aG8gZGlkbid0IG9wdCBpbi5cbiAgaWYgKGNhcHR1cmVkICYmIGdldFNka0FnZW50UHJvZ3Jlc3NTdW1tYXJpZXNFbmFibGVkKCkpIHtcbiAgICBjb25zdCB7IHRva2VuQ291bnQsIHRvb2xVc2VDb3VudCwgc3RhcnRUaW1lLCB0b29sVXNlSWQgfSA9IGNhcHR1cmVkXG4gICAgZW1pdFRhc2tQcm9ncmVzcyh7XG4gICAgICB0YXNrSWQsXG4gICAgICB0b29sVXNlSWQsXG4gICAgICBkZXNjcmlwdGlvbjogc3VtbWFyeSxcbiAgICAgIHN0YXJ0VGltZSxcbiAgICAgIHRvdGFsVG9rZW5zOiB0b2tlbkNvdW50LFxuICAgICAgdG9vbFVzZXM6IHRvb2xVc2VDb3VudCxcbiAgICAgIHN1bW1hcnksXG4gICAgfSlcbiAgfVxufVxuXG4vKipcbiAqIENvbXBsZXRlIGFuIGFnZW50IHRhc2sgd2l0aCByZXN1bHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21wbGV0ZUFnZW50VGFzayhcbiAgcmVzdWx0OiBBZ2VudFRvb2xSZXN1bHQsXG4gIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZSxcbik6IHZvaWQge1xuICBjb25zdCB0YXNrSWQgPSByZXN1bHQuYWdlbnRJZFxuICB1cGRhdGVUYXNrU3RhdGU8TG9jYWxBZ2VudFRhc2tTdGF0ZT4odGFza0lkLCBzZXRBcHBTdGF0ZSwgdGFzayA9PiB7XG4gICAgaWYgKHRhc2suc3RhdHVzICE9PSAncnVubmluZycpIHtcbiAgICAgIHJldHVybiB0YXNrXG4gICAgfVxuXG4gICAgdGFzay51bnJlZ2lzdGVyQ2xlYW51cD8uKClcblxuICAgIHJldHVybiB7XG4gICAgICAuLi50YXNrLFxuICAgICAgc3RhdHVzOiAnY29tcGxldGVkJyxcbiAgICAgIHJlc3VsdCxcbiAgICAgIGVuZFRpbWU6IERhdGUubm93KCksXG4gICAgICBldmljdEFmdGVyOiB0YXNrLnJldGFpbiA/IHVuZGVmaW5lZCA6IERhdGUubm93KCkgKyBQQU5FTF9HUkFDRV9NUyxcbiAgICAgIGFib3J0Q29udHJvbGxlcjogdW5kZWZpbmVkLFxuICAgICAgdW5yZWdpc3RlckNsZWFudXA6IHVuZGVmaW5lZCxcbiAgICAgIHNlbGVjdGVkQWdlbnQ6IHVuZGVmaW5lZCxcbiAgICB9XG4gIH0pXG4gIHZvaWQgZXZpY3RUYXNrT3V0cHV0KHRhc2tJZClcbiAgLy8gTm90ZTogTm90aWZpY2F0aW9uIGlzIHNlbnQgYnkgQWdlbnRUb29sIHZpYSBlbnF1ZXVlQWdlbnROb3RpZmljYXRpb25cbn1cblxuLyoqXG4gKiBGYWlsIGFuIGFnZW50IHRhc2sgd2l0aCBlcnJvci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZhaWxBZ2VudFRhc2soXG4gIHRhc2tJZDogc3RyaW5nLFxuICBlcnJvcjogc3RyaW5nLFxuICBzZXRBcHBTdGF0ZTogU2V0QXBwU3RhdGUsXG4pOiB2b2lkIHtcbiAgdXBkYXRlVGFza1N0YXRlPExvY2FsQWdlbnRUYXNrU3RhdGU+KHRhc2tJZCwgc2V0QXBwU3RhdGUsIHRhc2sgPT4ge1xuICAgIGlmICh0YXNrLnN0YXR1cyAhPT0gJ3J1bm5pbmcnKSB7XG4gICAgICByZXR1cm4gdGFza1xuICAgIH1cblxuICAgIHRhc2sudW5yZWdpc3RlckNsZWFudXA/LigpXG5cbiAgICByZXR1cm4ge1xuICAgICAgLi4udGFzayxcbiAgICAgIHN0YXR1czogJ2ZhaWxlZCcsXG4gICAgICBlcnJvcixcbiAgICAgIGVuZFRpbWU6IERhdGUubm93KCksXG4gICAgICBldmljdEFmdGVyOiB0YXNrLnJldGFpbiA/IHVuZGVmaW5lZCA6IERhdGUubm93KCkgKyBQQU5FTF9HUkFDRV9NUyxcbiAgICAgIGFib3J0Q29udHJvbGxlcjogdW5kZWZpbmVkLFxuICAgICAgdW5yZWdpc3RlckNsZWFudXA6IHVuZGVmaW5lZCxcbiAgICAgIHNlbGVjdGVkQWdlbnQ6IHVuZGVmaW5lZCxcbiAgICB9XG4gIH0pXG4gIHZvaWQgZXZpY3RUYXNrT3V0cHV0KHRhc2tJZClcbiAgLy8gTm90ZTogTm90aWZpY2F0aW9uIGlzIHNlbnQgYnkgQWdlbnRUb29sIHZpYSBlbnF1ZXVlQWdlbnROb3RpZmljYXRpb25cbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhbiBhZ2VudCB0YXNrLlxuICogQ2FsbGVkIGJ5IEFnZW50VG9vbCB0byBjcmVhdGUgYSBuZXcgYmFja2dyb3VuZCBhZ2VudC5cbiAqXG4gKiBAcGFyYW0gcGFyZW50QWJvcnRDb250cm9sbGVyIC0gT3B0aW9uYWwgcGFyZW50IGFib3J0IGNvbnRyb2xsZXIuIElmIHByb3ZpZGVkLFxuICogICB0aGUgYWdlbnQncyBhYm9ydCBjb250cm9sbGVyIHdpbGwgYmUgYSBjaGlsZCB0aGF0IGF1dG8tYWJvcnRzIHdoZW4gcGFyZW50IGFib3J0cy5cbiAqICAgVGhpcyBlbnN1cmVzIHN1YmFnZW50cyBhcmUgYWJvcnRlZCB3aGVuIHRoZWlyIHBhcmVudCAoZS5nLiwgaW4tcHJvY2VzcyB0ZWFtbWF0ZSkgYWJvcnRzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJBc3luY0FnZW50KHtcbiAgYWdlbnRJZCxcbiAgZGVzY3JpcHRpb24sXG4gIHByb21wdCxcbiAgc2VsZWN0ZWRBZ2VudCxcbiAgc2V0QXBwU3RhdGUsXG4gIHBhcmVudEFib3J0Q29udHJvbGxlcixcbiAgdG9vbFVzZUlkLFxufToge1xuICBhZ2VudElkOiBzdHJpbmdcbiAgZGVzY3JpcHRpb246IHN0cmluZ1xuICBwcm9tcHQ6IHN0cmluZ1xuICBzZWxlY3RlZEFnZW50OiBBZ2VudERlZmluaXRpb25cbiAgc2V0QXBwU3RhdGU6IFNldEFwcFN0YXRlXG4gIHBhcmVudEFib3J0Q29udHJvbGxlcj86IEFib3J0Q29udHJvbGxlclxuICB0b29sVXNlSWQ/OiBzdHJpbmdcbn0pOiBMb2NhbEFnZW50VGFza1N0YXRlIHtcbiAgdm9pZCBpbml0VGFza091dHB1dEFzU3ltbGluayhcbiAgICBhZ2VudElkLFxuICAgIGdldEFnZW50VHJhbnNjcmlwdFBhdGgoYXNBZ2VudElkKGFnZW50SWQpKSxcbiAgKVxuXG4gIC8vIENyZWF0ZSBhYm9ydCBjb250cm9sbGVyIC0gaWYgcGFyZW50IHByb3ZpZGVkLCBjcmVhdGUgY2hpbGQgdGhhdCBhdXRvLWFib3J0cyB3aXRoIHBhcmVudFxuICBjb25zdCBhYm9ydENvbnRyb2xsZXIgPSBwYXJlbnRBYm9ydENvbnRyb2xsZXJcbiAgICA/IGNyZWF0ZUNoaWxkQWJvcnRDb250cm9sbGVyKHBhcmVudEFib3J0Q29udHJvbGxlcilcbiAgICA6IGNyZWF0ZUFib3J0Q29udHJvbGxlcigpXG5cbiAgY29uc3QgdGFza1N0YXRlOiBMb2NhbEFnZW50VGFza1N0YXRlID0ge1xuICAgIC4uLmNyZWF0ZVRhc2tTdGF0ZUJhc2UoYWdlbnRJZCwgJ2xvY2FsX2FnZW50JywgZGVzY3JpcHRpb24sIHRvb2xVc2VJZCksXG4gICAgdHlwZTogJ2xvY2FsX2FnZW50JyxcbiAgICBzdGF0dXM6ICdydW5uaW5nJyxcbiAgICBhZ2VudElkLFxuICAgIHByb21wdCxcbiAgICBzZWxlY3RlZEFnZW50LFxuICAgIGFnZW50VHlwZTogc2VsZWN0ZWRBZ2VudC5hZ2VudFR5cGUgPz8gJ2dlbmVyYWwtcHVycG9zZScsXG4gICAgYWJvcnRDb250cm9sbGVyLFxuICAgIHJldHJpZXZlZDogZmFsc2UsXG4gICAgbGFzdFJlcG9ydGVkVG9vbENvdW50OiAwLFxuICAgIGxhc3RSZXBvcnRlZFRva2VuQ291bnQ6IDAsXG4gICAgaXNCYWNrZ3JvdW5kZWQ6IHRydWUsIC8vIHJlZ2lzdGVyQXN5bmNBZ2VudCBpbW1lZGlhdGVseSBiYWNrZ3JvdW5kc1xuICAgIHBlbmRpbmdNZXNzYWdlczogW10sXG4gICAgcmV0YWluOiBmYWxzZSxcbiAgICBkaXNrTG9hZGVkOiBmYWxzZSxcbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIGNsZWFudXAgaGFuZGxlclxuICBjb25zdCB1bnJlZ2lzdGVyQ2xlYW51cCA9IHJlZ2lzdGVyQ2xlYW51cChhc3luYyAoKSA9PiB7XG4gICAga2lsbEFzeW5jQWdlbnQoYWdlbnRJZCwgc2V0QXBwU3RhdGUpXG4gIH0pXG5cbiAgdGFza1N0YXRlLnVucmVnaXN0ZXJDbGVhbnVwID0gdW5yZWdpc3RlckNsZWFudXBcblxuICAvLyBSZWdpc3RlciB0YXNrIGluIEFwcFN0YXRlXG4gIHJlZ2lzdGVyVGFzayh0YXNrU3RhdGUsIHNldEFwcFN0YXRlKVxuXG4gIHJldHVybiB0YXNrU3RhdGVcbn1cblxuLy8gTWFwIG9mIHRhc2tJZCAtPiByZXNvbHZlIGZ1bmN0aW9uIGZvciBiYWNrZ3JvdW5kIHNpZ25hbHNcbi8vIFdoZW4gYmFja2dyb3VuZEFnZW50VGFzayBpcyBjYWxsZWQsIGl0IHJlc29sdmVzIHRoZSBjb3JyZXNwb25kaW5nIHByb21pc2VcbmNvbnN0IGJhY2tncm91bmRTaWduYWxSZXNvbHZlcnMgPSBuZXcgTWFwPHN0cmluZywgKCkgPT4gdm9pZD4oKVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgZm9yZWdyb3VuZCBhZ2VudCB0YXNrIHRoYXQgY291bGQgYmUgYmFja2dyb3VuZGVkIGxhdGVyLlxuICogQ2FsbGVkIHdoZW4gYW4gYWdlbnQgaGFzIGJlZW4gcnVubmluZyBsb25nIGVub3VnaCB0byBzaG93IHRoZSBCYWNrZ3JvdW5kSGludC5cbiAqIEByZXR1cm5zIG9iamVjdCB3aXRoIHRhc2tJZCBhbmQgYmFja2dyb3VuZFNpZ25hbCBwcm9taXNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckFnZW50Rm9yZWdyb3VuZCh7XG4gIGFnZW50SWQsXG4gIGRlc2NyaXB0aW9uLFxuICBwcm9tcHQsXG4gIHNlbGVjdGVkQWdlbnQsXG4gIHNldEFwcFN0YXRlLFxuICBhdXRvQmFja2dyb3VuZE1zLFxuICB0b29sVXNlSWQsXG59OiB7XG4gIGFnZW50SWQ6IHN0cmluZ1xuICBkZXNjcmlwdGlvbjogc3RyaW5nXG4gIHByb21wdDogc3RyaW5nXG4gIHNlbGVjdGVkQWdlbnQ6IEFnZW50RGVmaW5pdGlvblxuICBzZXRBcHBTdGF0ZTogU2V0QXBwU3RhdGVcbiAgYXV0b0JhY2tncm91bmRNcz86IG51bWJlclxuICB0b29sVXNlSWQ/OiBzdHJpbmdcbn0pOiB7XG4gIHRhc2tJZDogc3RyaW5nXG4gIGJhY2tncm91bmRTaWduYWw6IFByb21pc2U8dm9pZD5cbiAgY2FuY2VsQXV0b0JhY2tncm91bmQ/OiAoKSA9PiB2b2lkXG59IHtcbiAgdm9pZCBpbml0VGFza091dHB1dEFzU3ltbGluayhcbiAgICBhZ2VudElkLFxuICAgIGdldEFnZW50VHJhbnNjcmlwdFBhdGgoYXNBZ2VudElkKGFnZW50SWQpKSxcbiAgKVxuXG4gIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IGNyZWF0ZUFib3J0Q29udHJvbGxlcigpXG5cbiAgY29uc3QgdW5yZWdpc3RlckNsZWFudXAgPSByZWdpc3RlckNsZWFudXAoYXN5bmMgKCkgPT4ge1xuICAgIGtpbGxBc3luY0FnZW50KGFnZW50SWQsIHNldEFwcFN0YXRlKVxuICB9KVxuXG4gIGNvbnN0IHRhc2tTdGF0ZTogTG9jYWxBZ2VudFRhc2tTdGF0ZSA9IHtcbiAgICAuLi5jcmVhdGVUYXNrU3RhdGVCYXNlKGFnZW50SWQsICdsb2NhbF9hZ2VudCcsIGRlc2NyaXB0aW9uLCB0b29sVXNlSWQpLFxuICAgIHR5cGU6ICdsb2NhbF9hZ2VudCcsXG4gICAgc3RhdHVzOiAncnVubmluZycsXG4gICAgYWdlbnRJZCxcbiAgICBwcm9tcHQsXG4gICAgc2VsZWN0ZWRBZ2VudCxcbiAgICBhZ2VudFR5cGU6IHNlbGVjdGVkQWdlbnQuYWdlbnRUeXBlID8/ICdnZW5lcmFsLXB1cnBvc2UnLFxuICAgIGFib3J0Q29udHJvbGxlcixcbiAgICB1bnJlZ2lzdGVyQ2xlYW51cCxcbiAgICByZXRyaWV2ZWQ6IGZhbHNlLFxuICAgIGxhc3RSZXBvcnRlZFRvb2xDb3VudDogMCxcbiAgICBsYXN0UmVwb3J0ZWRUb2tlbkNvdW50OiAwLFxuICAgIGlzQmFja2dyb3VuZGVkOiBmYWxzZSwgLy8gTm90IHlldCBiYWNrZ3JvdW5kZWQgLSBydW5uaW5nIGluIGZvcmVncm91bmRcbiAgICBwZW5kaW5nTWVzc2FnZXM6IFtdLFxuICAgIHJldGFpbjogZmFsc2UsXG4gICAgZGlza0xvYWRlZDogZmFsc2UsXG4gIH1cblxuICAvLyBDcmVhdGUgYmFja2dyb3VuZCBzaWduYWwgcHJvbWlzZVxuICBsZXQgcmVzb2x2ZUJhY2tncm91bmRTaWduYWw6ICgpID0+IHZvaWRcbiAgY29uc3QgYmFja2dyb3VuZFNpZ25hbCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuICAgIHJlc29sdmVCYWNrZ3JvdW5kU2lnbmFsID0gcmVzb2x2ZVxuICB9KVxuICBiYWNrZ3JvdW5kU2lnbmFsUmVzb2x2ZXJzLnNldChhZ2VudElkLCByZXNvbHZlQmFja2dyb3VuZFNpZ25hbCEpXG5cbiAgcmVnaXN0ZXJUYXNrKHRhc2tTdGF0ZSwgc2V0QXBwU3RhdGUpXG5cbiAgLy8gQXV0by1iYWNrZ3JvdW5kIGFmdGVyIHRpbWVvdXQgaWYgY29uZmlndXJlZFxuICBsZXQgY2FuY2VsQXV0b0JhY2tncm91bmQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZFxuICBpZiAoYXV0b0JhY2tncm91bmRNcyAhPT0gdW5kZWZpbmVkICYmIGF1dG9CYWNrZ3JvdW5kTXMgPiAwKSB7XG4gICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgKHNldEFwcFN0YXRlLCBhZ2VudElkKSA9PiB7XG4gICAgICAgIC8vIE1hcmsgdGFzayBhcyBiYWNrZ3JvdW5kZWQgYW5kIHJlc29sdmUgdGhlIHNpZ25hbFxuICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgICBjb25zdCBwcmV2VGFzayA9IHByZXYudGFza3NbYWdlbnRJZF1cbiAgICAgICAgICBpZiAoIWlzTG9jYWxBZ2VudFRhc2socHJldlRhc2spIHx8IHByZXZUYXNrLmlzQmFja2dyb3VuZGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJldlxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgIHRhc2tzOiB7XG4gICAgICAgICAgICAgIC4uLnByZXYudGFza3MsXG4gICAgICAgICAgICAgIFthZ2VudElkXTogeyAuLi5wcmV2VGFzaywgaXNCYWNrZ3JvdW5kZWQ6IHRydWUgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBjb25zdCByZXNvbHZlciA9IGJhY2tncm91bmRTaWduYWxSZXNvbHZlcnMuZ2V0KGFnZW50SWQpXG4gICAgICAgIGlmIChyZXNvbHZlcikge1xuICAgICAgICAgIHJlc29sdmVyKClcbiAgICAgICAgICBiYWNrZ3JvdW5kU2lnbmFsUmVzb2x2ZXJzLmRlbGV0ZShhZ2VudElkKVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYXV0b0JhY2tncm91bmRNcyxcbiAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgYWdlbnRJZCxcbiAgICApXG4gICAgY2FuY2VsQXV0b0JhY2tncm91bmQgPSAoKSA9PiBjbGVhclRpbWVvdXQodGltZXIpXG4gIH1cblxuICByZXR1cm4geyB0YXNrSWQ6IGFnZW50SWQsIGJhY2tncm91bmRTaWduYWwsIGNhbmNlbEF1dG9CYWNrZ3JvdW5kIH1cbn1cblxuLyoqXG4gKiBCYWNrZ3JvdW5kIGEgc3BlY2lmaWMgZm9yZWdyb3VuZCBhZ2VudCB0YXNrLlxuICogQHJldHVybnMgdHJ1ZSBpZiBiYWNrZ3JvdW5kZWQgc3VjY2Vzc2Z1bGx5LCBmYWxzZSBvdGhlcndpc2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJhY2tncm91bmRBZ2VudFRhc2soXG4gIHRhc2tJZDogc3RyaW5nLFxuICBnZXRBcHBTdGF0ZTogKCkgPT4gQXBwU3RhdGUsXG4gIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZSxcbik6IGJvb2xlYW4ge1xuICBjb25zdCBzdGF0ZSA9IGdldEFwcFN0YXRlKClcbiAgY29uc3QgdGFzayA9IHN0YXRlLnRhc2tzW3Rhc2tJZF1cbiAgaWYgKCFpc0xvY2FsQWdlbnRUYXNrKHRhc2spIHx8IHRhc2suaXNCYWNrZ3JvdW5kZWQpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIC8vIFVwZGF0ZSBzdGF0ZSB0byBtYXJrIGFzIGJhY2tncm91bmRlZFxuICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICBjb25zdCBwcmV2VGFzayA9IHByZXYudGFza3NbdGFza0lkXVxuICAgIGlmICghaXNMb2NhbEFnZW50VGFzayhwcmV2VGFzaykpIHtcbiAgICAgIHJldHVybiBwcmV2XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAuLi5wcmV2LFxuICAgICAgdGFza3M6IHtcbiAgICAgICAgLi4ucHJldi50YXNrcyxcbiAgICAgICAgW3Rhc2tJZF06IHsgLi4ucHJldlRhc2ssIGlzQmFja2dyb3VuZGVkOiB0cnVlIH0sXG4gICAgICB9LFxuICAgIH1cbiAgfSlcblxuICAvLyBSZXNvbHZlIHRoZSBiYWNrZ3JvdW5kIHNpZ25hbCB0byBpbnRlcnJ1cHQgdGhlIGFnZW50IGxvb3BcbiAgY29uc3QgcmVzb2x2ZXIgPSBiYWNrZ3JvdW5kU2lnbmFsUmVzb2x2ZXJzLmdldCh0YXNrSWQpXG4gIGlmIChyZXNvbHZlcikge1xuICAgIHJlc29sdmVyKClcbiAgICBiYWNrZ3JvdW5kU2lnbmFsUmVzb2x2ZXJzLmRlbGV0ZSh0YXNrSWQpXG4gIH1cblxuICByZXR1cm4gdHJ1ZVxufVxuXG4vKipcbiAqIFVucmVnaXN0ZXIgYSBmb3JlZ3JvdW5kIGFnZW50IHRhc2sgd2hlbiB0aGUgYWdlbnQgY29tcGxldGVzIHdpdGhvdXQgYmVpbmcgYmFja2dyb3VuZGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5yZWdpc3RlckFnZW50Rm9yZWdyb3VuZChcbiAgdGFza0lkOiBzdHJpbmcsXG4gIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZSxcbik6IHZvaWQge1xuICAvLyBDbGVhbiB1cCB0aGUgYmFja2dyb3VuZCBzaWduYWwgcmVzb2x2ZXJcbiAgYmFja2dyb3VuZFNpZ25hbFJlc29sdmVycy5kZWxldGUodGFza0lkKVxuXG4gIGxldCBjbGVhbnVwRm46ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZFxuXG4gIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgIGNvbnN0IHRhc2sgPSBwcmV2LnRhc2tzW3Rhc2tJZF1cbiAgICAvLyBPbmx5IHJlbW92ZSBpZiBpdCdzIGEgZm9yZWdyb3VuZCB0YXNrIChub3QgYmFja2dyb3VuZGVkKVxuICAgIGlmICghaXNMb2NhbEFnZW50VGFzayh0YXNrKSB8fCB0YXNrLmlzQmFja2dyb3VuZGVkKSB7XG4gICAgICByZXR1cm4gcHJldlxuICAgIH1cblxuICAgIC8vIENhcHR1cmUgY2xlYW51cCBmdW5jdGlvbiB0byBjYWxsIG91dHNpZGUgb2YgdXBkYXRlclxuICAgIGNsZWFudXBGbiA9IHRhc2sudW5yZWdpc3RlckNsZWFudXBcblxuICAgIGNvbnN0IHsgW3Rhc2tJZF06IHJlbW92ZWQsIC4uLnJlc3QgfSA9IHByZXYudGFza3NcbiAgICByZXR1cm4geyAuLi5wcmV2LCB0YXNrczogcmVzdCB9XG4gIH0pXG5cbiAgLy8gQ2FsbCBjbGVhbnVwIG91dHNpZGUgb2YgdGhlIHN0YXRlIHVwZGF0ZXIgKGF2b2lkIHNpZGUgZWZmZWN0cyBpbiB1cGRhdGVyKVxuICBjbGVhbnVwRm4/LigpXG59XG4iXSwibWFwcGluZ3MiOiJBQUFBLFNBQVNBLG1DQUFtQyxRQUFRLDBCQUEwQjtBQUM5RSxTQUNFQyxlQUFlLEVBQ2ZDLFVBQVUsRUFDVkMsV0FBVyxFQUNYQyxXQUFXLEVBQ1hDLHFCQUFxQixFQUNyQkMsZUFBZSxFQUNmQyxtQkFBbUIsRUFDbkJDLGlCQUFpQixFQUNqQkMsWUFBWSxRQUNQLHdCQUF3QjtBQUMvQixTQUFTQyxnQkFBZ0IsUUFBUSxnREFBZ0Q7QUFDakYsY0FBY0MsUUFBUSxRQUFRLHlCQUF5QjtBQUN2RCxjQUFjQyxXQUFXLEVBQUVDLElBQUksRUFBRUMsYUFBYSxRQUFRLGVBQWU7QUFDckUsU0FBU0MsbUJBQW1CLFFBQVEsZUFBZTtBQUNuRCxjQUFjQyxLQUFLLFFBQVEsZUFBZTtBQUMxQyxTQUFTQyxjQUFjLFFBQVEsZUFBZTtBQUM5QyxjQUFjQyxlQUFlLFFBQVEseUNBQXlDO0FBQzlFLGNBQWNDLGVBQWUsUUFBUSx3Q0FBd0M7QUFDN0UsU0FBU0MsMEJBQTBCLFFBQVEsd0RBQXdEO0FBQ25HLFNBQVNDLFNBQVMsUUFBUSxvQkFBb0I7QUFDOUMsY0FBY0MsT0FBTyxRQUFRLHdCQUF3QjtBQUNyRCxTQUNFQyxxQkFBcUIsRUFDckJDLDBCQUEwQixRQUNyQixnQ0FBZ0M7QUFDdkMsU0FBU0MsZUFBZSxRQUFRLGdDQUFnQztBQUNoRSxTQUFTQyx1QkFBdUIsUUFBUSxtQ0FBbUM7QUFDM0UsU0FBU0MsMEJBQTBCLFFBQVEsb0NBQW9DO0FBQy9FLFNBQVNDLHNCQUFzQixRQUFRLCtCQUErQjtBQUN0RSxTQUNFQyxlQUFlLEVBQ2ZDLGlC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