import type { ToolUseBlock } from '@anthropic-ai/sdk/resources';
import { getRemoteSessionUrl } from '../../constants/product.js';
import { OUTPUT_FILE_TAG, REMOTE_REVIEW_PROGRESS_TAG, REMOTE_REVIEW_TAG, STATUS_TAG, SUMMARY_TAG, TASK_ID_TAG, TASK_NOTIFICATION_TAG, TASK_TYPE_TAG, TOOL_USE_ID_TAG, ULTRAPLAN_TAG } from '../../constants/xml.js';
import type { SDKAssistantMessage, SDKMessage } from '../../entrypoints/agentSdkTypes.js';
import type { SetAppState, Task, TaskContext, TaskStateBase } from '../../Task.js';
import { createTaskStateBase, generateTaskId } from '../../Task.js';
import { TodoWriteTool } from '../../tools/TodoWriteTool/TodoWriteTool.js';
import { type BackgroundRemoteSessionPrecondition, checkBackgroundRemoteSessionEligibility } from '../../utils/background/remote/remoteSession.js';
import { logForDebugging } from '../../utils/debug.js';
import { logError } from '../../utils/log.js';
import { enqueuePendingNotification } from '../../utils/messageQueueManager.js';
import { extractTag, extractTextContent } from '../../utils/messages.js';
import { emitTaskTerminatedSdk } from '../../utils/sdkEventQueue.js';
import { deleteRemoteAgentMetadata, listRemoteAgentMetadata, type RemoteAgentMetadata, writeRemoteAgentMetadata } from '../../utils/sessionStorage.js';
import { jsonStringify } from '../../utils/slowOperations.js';
import { appendTaskOutput, evictTaskOutput, getTaskOutputPath, initTaskOutput } from '../../utils/task/diskOutput.js';
import { registerTask, updateTaskState } from '../../utils/task/framework.js';
import { fetchSession } from '../../utils/teleport/api.js';
import { archiveRemoteSession, pollRemoteSessionEvents } from '../../utils/teleport.js';
import type { TodoList } from '../../utils/todo/types.js';
import type { UltraplanPhase } from '../../utils/ultraplan/ccrSession.js';
export type RemoteAgentTaskState = TaskStateBase & {
  type: 'remote_agent';
  remoteTaskType: RemoteTaskType;
  /** Task-specific metadata (PR number, repo, etc.). */
  remoteTaskMetadata?: RemoteTaskMetadata;
  sessionId: string; // Original session ID for API calls
  command: string;
  title: string;
  todoList: TodoList;
  log: SDKMessage[];
  /**
   * Long-running agent that will not be marked as complete after the first `result`.
   */
  isLongRunning?: boolean;
  /**
   * When the local poller started watching this task (at spawn or on restore).
   * Review timeout clocks from here so a restore doesn't immediately time out
   * a task spawned >30min ago.
   */
  pollStartedAt: number;
  /** True when this task was created by a teleported /ultrareview command. */
  isRemoteReview?: boolean;
  /** Parsed from the orchestrator's <remote-review-progress> heartbeat echoes. */
  reviewProgress?: {
    stage?: 'finding' | 'verifying' | 'synthesizing';
    bugsFound: number;
    bugsVerified: number;
    bugsRefuted: number;
  };
  isUltraplan?: boolean;
  /**
   * Scanner-derived pill state. Undefined = running. `needs_input` when the
   * remote asked a clarifying question and is idle; `plan_ready` when
   * ExitPlanMode is awaiting browser approval. Surfaced in the pill badge
   * and detail dialog status line.
   */
  ultraplanPhase?: Exclude<UltraplanPhase, 'running'>;
};
const REMOTE_TASK_TYPES = ['remote-agent', 'ultraplan', 'ultrareview', 'autofix-pr', 'background-pr'] as const;
export type RemoteTaskType = (typeof REMOTE_TASK_TYPES)[number];
function isRemoteTaskType(v: string | undefined): v is RemoteTaskType {
  return (REMOTE_TASK_TYPES as readonly string[]).includes(v ?? '');
}
export type AutofixPrRemoteTaskMetadata = {
  owner: string;
  repo: string;
  prNumber: number;
};
export type RemoteTaskMetadata = AutofixPrRemoteTaskMetadata;

/**
 * Called on every poll tick for tasks with a matching remoteTaskType. Return a
 * non-null string to complete the task (string becomes the notification text),
 * or null to keep polling. Checkers that hit external APIs should self-throttle.
 */
export type RemoteTaskCompletionChecker = (remoteTaskMetadata: RemoteTaskMetadata | undefined) => Promise<string | null>;
const completionCheckers = new Map<RemoteTaskType, RemoteTaskCompletionChecker>();

/**
 * Register a completion checker for a remote task type. Invoked on every poll
 * tick; survives --resume via the sidecar's remoteTaskType + remoteTaskMetadata.
 */
export function registerCompletionChecker(remoteTaskType: RemoteTaskType, checker: RemoteTaskCompletionChecker): void {
  completionCheckers.set(remoteTaskType, checker);
}

/**
 * Persist a remote-agent metadata entry to the session sidecar.
 * Fire-and-forget — persistence failures must not block task registration.
 */
async function persistRemoteAgentMetadata(meta: RemoteAgentMetadata): Promise<void> {
  try {
    await writeRemoteAgentMetadata(meta.taskId, meta);
  } catch (e) {
    logForDebugging(`persistRemoteAgentMetadata failed: ${String(e)}`);
  }
}

/**
 * Remove a remote-agent metadata entry from the session sidecar.
 * Called on task completion/kill so restored sessions don't resurrect
 * tasks that already finished.
 */
async function removeRemoteAgentMetadata(taskId: string): Promise<void> {
  try {
    await deleteRemoteAgentMetadata(taskId);
  } catch (e) {
    logForDebugging(`removeRemoteAgentMetadata failed: ${String(e)}`);
  }
}

// Precondition error result
export type RemoteAgentPreconditionResult = {
  eligible: true;
} | {
  eligible: false;
  errors: BackgroundRemoteSessionPrecondition[];
};

/**
 * Check eligibility for creating a remote agent session.
 */
export async function checkRemoteAgentEligibility({
  skipBundle = false
}: {
  skipBundle?: boolean;
} = {}): Promise<RemoteAgentPreconditionResult> {
  const errors = await checkBackgroundRemoteSessionEligibility({
    skipBundle
  });
  if (errors.length > 0) {
    return {
      eligible: false,
      errors
    };
  }
  return {
    eligible: true
  };
}

/**
 * Format precondition error for display.
 */
export function formatPreconditionError(error: BackgroundRemoteSessionPrecondition): string {
  switch (error.type) {
    case 'not_logged_in':
      return 'Please run /login and sign in with your Claude.ai account (not Console).';
    case 'no_remote_environment':
      return 'No cloud environment available. Set one up at https://claude.ai/code/onboarding?magic=env-setup';
    case 'not_in_git_repo':
      return 'Background tasks require a git repository. Initialize git or run from a git repository.';
    case 'no_git_remote':
      return 'Background tasks require a GitHub remote. Add one with `git remote add origin REPO_URL`.';
    case 'github_app_not_installed':
      return 'The Claude GitHub app must be installed on this repository first.\nhttps://github.com/apps/claude/installations/new';
    case 'policy_blocked':
      return "Remote sessions are disabled by your organization's policy. Contact your organization admin to enable them.";
  }
}

/**
 * Enqueue a remote task notification to the message queue.
 */
function enqueueRemoteNotification(taskId: string, title: string, status: 'completed' | 'failed' | 'killed', setAppState: SetAppState, toolUseId?: string): void {
  // Atomically check and set notified flag to prevent duplicate notifications.
  if (!markTaskNotified(taskId, setAppState)) return;
  const statusText = status === 'completed' ? 'completed successfully' : status === 'failed' ? 'failed' : 'was stopped';
  const toolUseIdLine = toolUseId ? `\n<${TOOL_USE_ID_TAG}>${toolUseId}</${TOOL_USE_ID_TAG}>` : '';
  const outputPath = getTaskOutputPath(taskId);
  const message = `<${TASK_NOTIFICATION_TAG}>
<${TASK_ID_TAG}>${taskId}</${TASK_ID_TAG}>${toolUseIdLine}
<${TASK_TYPE_TAG}>remote_agent</${TASK_TYPE_TAG}>
<${OUTPUT_FILE_TAG}>${outputPath}</${OUTPUT_FILE_TAG}>
<${STATUS_TAG}>${status}</${STATUS_TAG}>
<${SUMMARY_TAG}>Remote task "${title}" ${statusText}</${SUMMARY_TAG}>
</${TASK_NOTIFICATION_TAG}>`;
  enqueuePendingNotification({
    value: message,
    mode: 'task-notification'
  });
}

/**
 * Atomically mark a task as notified. Returns true if this call flipped the
 * flag (caller should enqueue), false if already notified (caller should skip).
 */
function markTaskNotified(taskId: string, setAppState: SetAppState): boolean {
  let shouldEnqueue = false;
  updateTaskState(taskId, setAppState, task => {
    if (task.notified) {
      return task;
    }
    shouldEnqueue = true;
    return {
      ...task,
      notified: true
    };
  });
  return shouldEnqueue;
}

/**
 * Extract the plan content from the remote session log.
 * Searches all assistant messages for <ultraplan>...</ultraplan> tags.
 */
export function extractPlanFromLog(log: SDKMessage[]): string | null {
  // Walk backwards through assistant messages to find <ultraplan> content
  for (let i = log.length - 1; i >= 0; i--) {
    const msg = log[i];
    if (msg?.type !== 'assistant') continue;
    const fullText = extractTextContent(msg.message.content, '\n');
    const plan = extractTag(fullText, ULTRAPLAN_TAG);
    if (plan?.trim()) return plan.trim();
  }
  return null;
}

/**
 * Enqueue an ultraplan-specific failure notification. Unlike enqueueRemoteNotification
 * this does NOT instruct the model to read the raw output file (a JSONL dump that is
 * useless for plan extraction).
 */
export function enqueueUltraplanFailureNotification(taskId: string, sessionId: string, reason: string, setAppState: SetAppState): void {
  if (!markTaskNotified(taskId, setAppState)) return;
  const sessionUrl = getRemoteTaskSessionUrl(sessionId);
  const message = `<${TASK_NOTIFICATION_TAG}>
<${TASK_ID_TAG}>${taskId}</${TASK_ID_TAG}>
<${TASK_TYPE_TAG}>remote_agent</${TASK_TYPE_TAG}>
<${STATUS_TAG}>failed</${STATUS_TAG}>
<${SUMMARY_TAG}>Ultraplan failed: ${reason}</${SUMMARY_TAG}>
</${TASK_NOTIFICATION_TAG}>
The remote Ultraplan session did not produce a plan (${reason}). Inspect the session at ${sessionUrl} and tell the user to retry locally with plan mode.`;
  enqueuePendingNotification({
    value: message,
    mode: 'task-notification'
  });
}

/**
 * Extract review content from the remote session log.
 *
 * Two producers, two event shapes:
 * - bughunter mode: run_hunt.sh is a SessionStart hook; its echo lands as
 *   {type:'system', subtype:'hook_progress', stdout:'...'}. Claude never
 *   takes a turn so there are zero assistant messages.
 * - prompt mode: a real assistant turn wraps the review in the tag.
 *
 * Scans hook_progress first since bughunter is the intended production path
 * and prompt mode is the dev/fallback. Newest-first in both cases — the tag
 * appears once at the end of the run so reverse iteration short-circuits.
 */
function extractReviewFromLog(log: SDKMessage[]): string | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const msg = log[i];
    // The final echo before hook exit may land in either the last
    // hook_progress or the terminal hook_response depending on buffering;
    // both have flat stdout.
    if (msg?.type === 'system' && (msg.subtype === 'hook_progress' || msg.subtype === 'hook_response')) {
      const tagged = extractTag(msg.stdout, REMOTE_REVIEW_TAG);
      if (tagged?.trim()) return tagged.trim();
    }
  }
  for (let i = log.length - 1; i >= 0; i--) {
    const msg = log[i];
    if (msg?.type !== 'assistant') continue;
    const fullText = extractTextContent(msg.message.content, '\n');
    const tagged = extractTag(fullText, REMOTE_REVIEW_TAG);
    if (tagged?.trim()) return tagged.trim();
  }

  // Hook-stdout concat fallback: a single echo should land in one event, but
  // large JSON payloads can flush across two if the pipe buffer fills
  // mid-write. Per-message scan above misses a tag split across events.
  const hookStdout = log.filter(msg => msg.type === 'system' && (msg.subtype === 'hook_progress' || msg.subtype === 'hook_response')).map(msg => msg.stdout).join('');
  const hookTagged = extractTag(hookStdout, REMOTE_REVIEW_TAG);
  if (hookTagged?.trim()) return hookTagged.trim();

  // Fallback: concatenate all assistant text in chronological order.
  const allText = log.filter((msg): msg is SDKAssistantMessage => msg.type === 'assistant').map(msg => extractTextContent(msg.message.content, '\n')).join('\n').trim();
  return allText || null;
}

/**
 * Tag-only variant of extractReviewFromLog for delta scanning.
 *
 * Returns non-null ONLY when an explicit <remote-review> tag is found.
 * Unlike extractReviewFromLog, this does NOT fall back to concatenated
 * assistant text. This is critical for the delta scan: in prompt mode,
 * early untagged assistant messages (e.g. "I'm analyzing the diff...")
 * would trigger the fallback and prematurely set cachedReviewContent,
 * completing the review before the actual tagged output arrives.
 */
function extractReviewTagFromLog(log: SDKMessage[]): string | null {
  // hook_progress / hook_response per-message scan (bughunter path)
  for (let i = log.length - 1; i >= 0; i--) {
    const msg = log[i];
    if (msg?.type === 'system' && (msg.subtype === 'hook_progress' || msg.subtype === 'hook_response')) {
      const tagged = extractTag(msg.stdout, REMOTE_REVIEW_TAG);
      if (tagged?.trim()) return tagged.trim();
    }
  }

  // assistant text per-message scan (prompt mode)
  for (let i = log.length - 1; i >= 0; i--) {
    const msg = log[i];
    if (msg?.type !== 'assistant') continue;
    const fullText = extractTextContent(msg.message.content, '\n');
    const tagged = extractTag(fullText, REMOTE_REVIEW_TAG);
    if (tagged?.trim()) return tagged.trim();
  }

  // Hook-stdout concat fallback for split tags
  const hookStdout = log.filter(msg => msg.type === 'system' && (msg.subtype === 'hook_progress' || msg.subtype === 'hook_response')).map(msg => msg.stdout).join('');
  const hookTagged = extractTag(hookStdout, REMOTE_REVIEW_TAG);
  if (hookTagged?.trim()) return hookTagged.trim();
  return null;
}

/**
 * Enqueue a remote-review completion notification. Injects the review text
 * directly into the message queue so the local model receives it on the next
 * turn — no file indirection, no mode change. Session is kept alive so the
 * claude.ai URL stays a durable record the user can revisit; TTL handles cleanup.
 */
function enqueueRemoteReviewNotification(taskId: string, reviewContent: string, setAppState: SetAppState): void {
  if (!markTaskNotified(taskId, setAppState)) return;
  const message = `<${TASK_NOTIFICATION_TAG}>
<${TASK_ID_TAG}>${taskId}</${TASK_ID_TAG}>
<${TASK_TYPE_TAG}>remote_agent</${TASK_TYPE_TAG}>
<${STATUS_TAG}>completed</${STATUS_TAG}>
<${SUMMARY_TAG}>Remote review completed</${SUMMARY_TAG}>
</${TASK_NOTIFICATION_TAG}>
The remote review produced the following findings:

${reviewContent}`;
  enqueuePendingNotification({
    value: message,
    mode: 'task-notification'
  });
}

/**
 * Enqueue a remote-review failure notification.
 */
function enqueueRemoteReviewFailureNotification(taskId: string, reason: string, setAppState: SetAppState): void {
  if (!markTaskNotified(taskId, setAppState)) return;
  const message = `<${TASK_NOTIFICATION_TAG}>
<${TASK_ID_TAG}>${taskId}</${TASK_ID_TAG}>
<${TASK_TYPE_TAG}>remote_agent</${TASK_TYPE_TAG}>
<${STATUS_TAG}>failed</${STATUS_TAG}>
<${SUMMARY_TAG}>Remote review failed: ${reason}</${SUMMARY_TAG}>
</${TASK_NOTIFICATION_TAG}>
Remote review did not produce output (${reason}). Tell the user to retry /ultrareview, or use /review for a local review instead.`;
  enqueuePendingNotification({
    value: message,
    mode: 'task-notification'
  });
}

/**
 * Extract todo list from SDK messages (finds last TodoWrite tool use).
 */
function extractTodoListFromLog(log: SDKMessage[]): TodoList {
  const todoListMessage = log.findLast((msg): msg is SDKAssistantMessage => msg.type === 'assistant' && msg.message.content.some(block => block.type === 'tool_use' && block.name === TodoWriteTool.name));
  if (!todoListMessage) {
    return [];
  }
  const input = todoListMessage.message.content.find((block): block is ToolUseBlock => block.type === 'tool_use' && block.name === TodoWriteTool.name)?.input;
  if (!input) {
    return [];
  }
  const parsedInput = TodoWriteTool.inputSchema.safeParse(input);
  if (!parsedInput.success) {
    return [];
  }
  return parsedInput.data.todos;
}

/**
 * Register a remote agent task in the unified task framework.
 * Bundles task ID generation, output init, state creation, registration, and polling.
 * Callers remain responsible for custom pre-registration logic (git dialogs, transcript upload, teleport options).
 */
export function registerRemoteAgentTask(options: {
  remoteTaskType: RemoteTaskType;
  session: {
    id: string;
    title: string;
  };
  command: string;
  context: TaskContext;
  toolUseId?: string;
  isRemoteReview?: boolean;
  isUltraplan?: boolean;
  isLongRunning?: boolean;
  remoteTaskMetadata?: RemoteTaskMetadata;
}): {
  taskId: string;
  sessionId: string;
  cleanup: () => void;
} {
  const {
    remoteTaskType,
    session,
    command,
    context,
    toolUseId,
    isRemoteReview,
    isUltraplan,
    isLongRunning,
    remoteTaskMetadata
  } = options;
  const taskId = generateTaskId('remote_agent');

  // Create the output file before registering the task.
  // RemoteAgentTask uses appendTaskOutput() (not TaskOutput), so
  // the file must exist for readers before any output arrives.
  void initTaskOutput(taskId);
  const taskState: RemoteAgentTaskState = {
    ...createTaskStateBase(taskId, 'remote_agent', session.title, toolUseId),
    type: 'remote_agent',
    remoteTaskType,
    status: 'running',
    sessionId: session.id,
    command,
    title: session.title,
    todoList: [],
    log: [],
    isRemoteReview,
    isUltraplan,
    isLongRunning,
    pollStartedAt: Date.now(),
    remoteTaskMetadata
  };
  registerTask(taskState, context.setAppState);

  // Persist identity to the session sidecar so --resume can reconnect to
  // still-running remote sessions. Status is not stored — it's fetched
  // fresh from CCR on restore.
  void persistRemoteAgentMetadata({
    taskId,
    remoteTaskType,
    sessionId: session.id,
    title: session.title,
    command,
    spawnedAt: Date.now(),
    toolUseId,
    isUltraplan,
    isRemoteReview,
    isLongRunning,
    remoteTaskMetadata
  });

  // Ultraplan lifecycle is owned by startDetachedPoll in ultraplan.tsx. Generic
  // polling still runs so session.log populates for the detail view's progress
  // counts; the result-lookup guard below prevents early completion.
  // TODO(#23985): fold ExitPlanModeScanner into this poller, drop startDetachedPoll.
  const stopPolling = startRemoteSessionPolling(taskId, context);
  return {
    taskId,
    sessionId: session.id,
    cleanup: stopPolling
  };
}

/**
 * Restore remote-agent tasks from the session sidecar on --resume.
 *
 * Scans remote-agents/, fetches live CCR status for each, reconstructs
 * RemoteAgentTaskState into AppState.tasks, and restarts polling for sessions
 * still running. Sessions that are archived or 404 have their sidecar file
 * removed. Must run after switchSession() so getSessionId() points at the
 * resumed session's sidecar directory.
 */
export async function restoreRemoteAgentTasks(context: TaskContext): Promise<void> {
  try {
    await restoreRemoteAgentTasksImpl(context);
  } catch (e) {
    logForDebugging(`restoreRemoteAgentTasks failed: ${String(e)}`);
  }
}
async function restoreRemoteAgentTasksImpl(context: TaskContext): Promise<void> {
  const persisted = await listRemoteAgentMetadata();
  if (persisted.length === 0) return;
  for (const meta of persisted) {
    let remoteStatus: string;
    try {
      const session = await fetchSession(meta.sessionId);
      remoteStatus = session.session_status;
    } catch (e) {
      // Only 404 means the CCR session is truly gone. Auth errors (401,
      // missing OAuth token) are recoverable via /login — the remote
      // session is still running. fetchSession throws plain Error for all
      // 4xx (validateStatus treats <500 as success), so isTransientNetworkError
      // can't distinguish them; match the 404 message instead.
      if (e instanceof Error && e.message.startsWith('Session not found:')) {
        logForDebugging(`restoreRemoteAgentTasks: dropping ${meta.taskId} (404: ${String(e)})`);
        void removeRemoteAgentMetadata(meta.taskId);
      } else {
        logForDebugging(`restoreRemoteAgentTasks: skipping ${meta.taskId} (recoverable: ${String(e)})`);
      }
      continue;
    }
    if (remoteStatus === 'archived') {
      // Session ended while the local client was offline. Don't resurrect.
      void removeRemoteAgentMetadata(meta.taskId);
      continue;
    }
    const taskState: RemoteAgentTaskState = {
      ...createTaskStateBase(meta.taskId, 'remote_agent', meta.title, meta.toolUseId),
      type: 'remote_agent',
      remoteTaskType: isRemoteTaskType(meta.remoteTaskType) ? meta.remoteTaskType : 'remote-agent',
      status: 'running',
      sessionId: meta.sessionId,
      command: meta.command,
      title: meta.title,
      todoList: [],
      log: [],
      isRemoteReview: meta.isRemoteReview,
      isUltraplan: meta.isUltraplan,
      isLongRunning: meta.isLongRunning,
      startTime: meta.spawnedAt,
      pollStartedAt: Date.now(),
      remoteTaskMetadata: meta.remoteTaskMetadata as RemoteTaskMetadata | undefined
    };
    registerTask(taskState, context.setAppState);
    void initTaskOutput(meta.taskId);
    startRemoteSessionPolling(meta.taskId, context);
  }
}

/**
 * Start polling for remote session updates.
 * Returns a cleanup function to stop polling.
 */
function startRemoteSessionPolling(taskId: string, context: TaskContext): () => void {
  let isRunning = true;
  const POLL_INTERVAL_MS = 1000;
  const REMOTE_REVIEW_TIMEOUT_MS = 30 * 60 * 1000;
  // Remote sessions flip to 'idle' between tool turns. With 100+ rapid
  // turns, a 1s poll WILL catch a transient idle mid-run. Require stable
  // idle (no log growth for N consecutive polls) before believing it.
  const STABLE_IDLE_POLLS = 5;
  let consecutiveIdlePolls = 0;
  let lastEventId: string | null = null;
  let accumulatedLog: SDKMessage[] = [];
  // Cached across ticks so we don't re-scan the full log. Tag appears once
  // at end of run; scanning only the delta (response.newEvents) is O(new).
  let cachedReviewContent: string | null = null;
  const poll = async (): Promise<void> => {
    if (!isRunning) return;
    try {
      const appState = context.getAppState();
      const task = appState.tasks?.[taskId] as RemoteAgentTaskState | undefined;
      if (!task || task.status !== 'running') {
        // Task was killed externally (TaskStopTool) or already terminal.
        // Session left alive so the claude.ai URL stays valid — the run_hunt.sh
        // post_stage() calls land as assistant events there, and the user may
        // want to revisit them after closing the terminal. TTL reaps it.
        return;
      }
      const response = await pollRemoteSessionEvents(task.sessionId, lastEventId);
      lastEventId = response.lastEventId;
      const logGrew = response.newEvents.length > 0;
      if (logGrew) {
        accumulatedLog = [...accumulatedLog, ...response.newEvents];
        const deltaText = response.newEvents.map(msg => {
          if (msg.type === 'assistant') {
            return msg.message.content.filter(block => block.type === 'text').map(block => 'text' in block ? block.text : '').join('\n');
          }
          return jsonStringify(msg);
        }).join('\n');
        if (deltaText) {
          appendTaskOutput(taskId, deltaText + '\n');
        }
      }
      if (response.sessionStatus === 'archived') {
        updateTaskState<RemoteAgentTaskState>(taskId, context.setAppState, t => t.status === 'running' ? {
          ...t,
          status: 'completed',
          endTime: Date.now()
        } : t);
        enqueueRemoteNotification(taskId, task.title, 'completed', context.setAppState, task.toolUseId);
        void evictTaskOutput(taskId);
        void removeRemoteAgentMetadata(taskId);
        return;
      }
      const checker = completionCheckers.get(task.remoteTaskType);
      if (checker) {
        const completionResult = await checker(task.remoteTaskMetadata);
        if (completionResult !== null) {
          updateTaskState<RemoteAgentTaskState>(taskId, context.setAppState, t => t.status === 'running' ? {
            ...t,
            status: 'completed',
            endTime: Date.now()
          } : t);
          enqueueRemoteNotification(taskId, completionResult, 'completed', context.setAppState, task.toolUseId);
          void evictTaskOutput(taskId);
          void removeRemoteAgentMetadata(taskId);
          return;
        }
      }

      // Ultraplan: result(success) fires after every CCR turn, so it must not
      // drive completion — startDetachedPoll owns that via ExitPlanMode scan.
      // Long-running monitors (autofix-pr) emit result per notification cycle,
      // so the same skip applies.
      const result = task.isUltraplan || task.isLongRunning ? undefined : accumulatedLog.findLast(msg => msg.type === 'result');

      // For remote-review: <remote-review> in hook_progress stdout is the
      // bughunter path's completion signal. Scan only the delta to stay O(new);
      // tag appears once at end of run so we won't miss it across ticks.
      // For the failure signal, debounce idle: remote sessions briefly flip
      // to 'idle' between every tool turn, so a single idle observation means
      // nothing. Require STABLE_IDLE_POLLS consecutive idle polls with no log
      // growth.
      if (task.isRemoteReview && logGrew && cachedReviewContent === null) {
        cachedReviewContent = extractReviewTagFromLog(response.newEvents);
      }
      // Parse live progress counts from the orchestrator's heartbeat echoes.
      // hook_progress stdout is cumulative (every echo since hook start), so
      // each event contains all progress tags. Grab the LAST occurrence —
      // extractTag returns the first match which would always be the earliest
      // value (0/0).
      let newProgress: RemoteAgentTaskState['reviewProgress'];
      if (task.isRemoteReview && logGrew) {
        const open = `<${REMOTE_REVIEW_PROGRESS_TAG}>`;
        const close = `</${REMOTE_REVIEW_PROGRESS_TAG}>`;
        for (const ev of response.newEvents) {
          if (ev.type === 'system' && (ev.subtype === 'hook_progress' || ev.subtype === 'hook_response')) {
            const s = ev.stdout;
            const closeAt = s.lastIndexOf(close);
            const openAt = closeAt === -1 ? -1 : s.lastIndexOf(open, closeAt);
            if (openAt !== -1 && closeAt > openAt) {
              try {
                const p = JSON.parse(s.slice(openAt + open.length, closeAt)) as {
                  stage?: 'finding' | 'verifying' | 'synthesizing';
                  bugs_found?: number;
                  bugs_verified?: number;
                  bugs_refuted?: number;
                };
                newProgress = {
                  stage: p.stage,
                  bugsFound: p.bugs_found ?? 0,
                  bugsVerified: p.bugs_verified ?? 0,
                  bugsRefuted: p.bugs_refuted ?? 0
                };
              } catch {
                // ignore malformed progress
              }
            }
          }
        }
      }
      // Hook events count as output only for remote-review — bughunter's
      // SessionStart hook produces zero assistant turns so stableIdle would
      // never arm without this.
      const hasAnyOutput = accumulatedLog.some(msg => msg.type === 'assistant' || task.isRemoteReview && msg.type === 'system' && (msg.subtype === 'hook_progress' || msg.subtype === 'hook_response'));
      if (response.sessionStatus === 'idle' && !logGrew && hasAnyOutput) {
        consecutiveIdlePolls++;
      } else {
        consecutiveIdlePolls = 0;
      }
      const stableIdle = consecutiveIdlePolls >= STABLE_IDLE_POLLS;
      // stableIdle is a prompt-mode completion signal (Claude stops writing
      // → session idles → done). In bughunter mode the session is "idle" the
      // entire time the SessionStart hook runs; the previous guard checked
      // hasAssistantEvents as a prompt-mode proxy, but post_stage() now
      // writes assistant events in bughunter mode too, so that check
      // misfires between heartbeats. Presence of a SessionStart hook event
      // is the discriminator — bughunter mode always has one (run_hunt.sh),
      // prompt mode never does — and it arrives before the kickoff
      // post_stage so there's no race. When the hook is running, only the
      // <remote-review> tag or the 30min timeout complete the task.
      // Filtering on hook_event avoids a (theoretical) non-SessionStart hook
      // in prompt mode from blocking stableIdle — the code_review container
      // only registers SessionStart, but the 30min-hang failure mode is
      // worth defending against.
      const hasSessionStartHook = accumulatedLog.some(m => m.type === 'system' && (m.subtype === 'hook_started' || m.subtype === 'hook_progress' || m.subtype === 'hook_response') && (m as {
        hook_event?: string;
      }).hook_event === 'SessionStart');
      const hasAssistantEvents = accumulatedLog.some(m => m.type === 'assistant');
      const sessionDone = task.isRemoteReview && (cachedReviewContent !== null || !hasSessionStartHook && stableIdle && hasAssistantEvents);
      const reviewTimedOut = task.isRemoteReview && Date.now() - task.pollStartedAt > REMOTE_REVIEW_TIMEOUT_MS;
      const newStatus = result ? result.subtype === 'success' ? 'completed' as const : 'failed' as const : sessionDone || reviewTimedOut ? 'completed' as const : accumulatedLog.length > 0 ? 'running' as const : 'starting' as const;

      // Update task state. Guard against terminal states — if stopTask raced
      // while pollRemoteSessionEvents was in-flight (status set to 'killed',
      // notified set to true), bail without overwriting status or proceeding to
      // side effects (notification, permission-mode flip).
      let raceTerminated = false;
      updateTaskState<RemoteAgentTaskState>(taskId, context.setAppState, prevTask => {
        if (prevTask.status !== 'running') {
          raceTerminated = true;
          return prevTask;
        }
        // No log growth and status unchanged → nothing to report. Return
        // same ref so updateTaskState skips the spread and 18 s.tasks
        // subscribers (REPL, Spinner, PromptInput, ...) don't re-render.
        // newProgress only arrives via log growth (heartbeat echo is a
        // hook_progress event), so !logGrew already covers no-update.
        const statusUnchanged = newStatus === 'running' || newStatus === 'starting';
        if (!logGrew && statusUnchanged) {
          return prevTask;
        }
        return {
          ...prevTask,
          status: newStatus === 'starting' ? 'running' : newStatus,
          log: accumulatedLog,
          // Only re-scan for TodoWrite when log grew — log is append-only,
          // so no growth means no new tool_use blocks. Avoids findLast +
          // some + find + safeParse every second when idle.
          todoList: logGrew ? extractTodoListFromLog(accumulatedLog) : prevTask.todoList,
          reviewProgress: newProgress ?? prevTask.reviewProgress,
          endTime: result || sessionDone || reviewTimedOut ? Date.now() : undefined
        };
      });
      if (raceTerminated) return;

      // Send notification if task completed or timed out
      if (result || sessionDone || reviewTimedOut) {
        const finalStatus = result && result.subtype !== 'success' ? 'failed' : 'completed';

        // For remote-review tasks: inject the review text directly into the
        // message queue. No mode change, no file indirection — the local model
        // just sees the review appear as a task-notification on its next turn.
        // Session kept alive — run_hunt.sh's post_stage() has already written
        // the formatted findings as an assistant event, so the claude.ai URL
        // stays a durable record the user can revisit. TTL handles cleanup.
        if (task.isRemoteReview) {
          // cachedReviewContent hit the tag in the delta scan. Full-log scan
          // catches the stableIdle path where the tag arrived in an earlier
          // tick but the delta scan wasn't wired yet (first poll after resume).
          const reviewContent = cachedReviewContent ?? extractReviewFromLog(accumulatedLog);
          if (reviewContent && finalStatus === 'completed') {
            enqueueRemoteReviewNotification(taskId, reviewContent, context.setAppState);
            void evictTaskOutput(taskId);
            void removeRemoteAgentMetadata(taskId);
            return; // Stop polling
          }

          // No output or remote error — mark failed with a review-specific message.
          updateTaskState(taskId, context.setAppState, t => ({
            ...t,
            status: 'failed'
          }));
          const reason = result && result.subtype !== 'success' ? 'remote session returned an error' : reviewTimedOut && !sessionDone ? 'remote session exceeded 30 minutes' : 'no review output — orchestrator may have exited early';
          enqueueRemoteReviewFailureNotification(taskId, reason, context.setAppState);
          void evictTaskOutput(taskId);
          void removeRemoteAgentMetadata(taskId);
          return; // Stop polling
        }
        enqueueRemoteNotification(taskId, task.title, finalStatus, context.setAppState, task.toolUseId);
        void evictTaskOutput(taskId);
        void removeRemoteAgentMetadata(taskId);
        return; // Stop polling
      }
    } catch (error) {
      logError(error);
      // Reset so an API error doesn't let non-consecutive idle polls accumulate.
      consecutiveIdlePolls = 0;

      // Check review timeout even when the API call fails — without this,
      // persistent API errors skip the timeout check and poll forever.
      try {
        const appState = context.getAppState();
        const task = appState.tasks?.[taskId] as RemoteAgentTaskState | undefined;
        if (task?.isRemoteReview && task.status === 'running' && Date.now() - task.pollStartedAt > REMOTE_REVIEW_TIMEOUT_MS) {
          updateTaskState(taskId, context.setAppState, t => ({
            ...t,
            status: 'failed',
            endTime: Date.now()
          }));
          enqueueRemoteReviewFailureNotification(taskId, 'remote session exceeded 30 minutes', context.setAppState);
          void evictTaskOutput(taskId);
          void removeRemoteAgentMetadata(taskId);
          return; // Stop polling
        }
      } catch {
        // Best effort — if getAppState fails, continue polling
      }
    }

    // Continue polling
    if (isRunning) {
      setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  // Start polling
  void poll();

  // Return cleanup function
  return () => {
    isRunning = false;
  };
}

/**
 * RemoteAgentTask - Handles remote Claude.ai session execution.
 *
 * Replaces the BackgroundRemoteSession implementation from:
 * - src/utils/background/remote/remoteSession.ts
 * - src/components/tasks/BackgroundTaskStatus.tsx (polling logic)
 */
export const RemoteAgentTask: Task = {
  name: 'RemoteAgentTask',
  type: 'remote_agent',
  async kill(taskId, setAppState) {
    let toolUseId: string | undefined;
    let description: string | undefined;
    let sessionId: string | undefined;
    let killed = false;
    updateTaskState<RemoteAgentTaskState>(taskId, setAppState, task => {
      if (task.status !== 'running') {
        return task;
      }
      toolUseId = task.toolUseId;
      description = task.description;
      sessionId = task.sessionId;
      killed = true;
      return {
        ...task,
        status: 'killed',
        notified: true,
        endTime: Date.now()
      };
    });

    // Close the task_started bookend for SDK consumers. The poll loop's
    // early-return when status!=='running' won't emit a notification.
    if (killed) {
      emitTaskTerminatedSdk(taskId, 'stopped', {
        toolUseId,
        summary: description
      });
      // Archive the remote session so it stops consuming cloud resources.
      if (sessionId) {
        void archiveRemoteSession(sessionId).catch(e => logForDebugging(`RemoteAgentTask archive failed: ${String(e)}`));
      }
    }
    void evictTaskOutput(taskId);
    void removeRemoteAgentMetadata(taskId);
    logForDebugging(`RemoteAgentTask ${taskId} killed, archiving session ${sessionId ?? 'unknown'}`);
  }
};

/**
 * Get the session URL for a remote task.
 */
export function getRemoteTaskSessionUrl(sessionId: string): string {
  return getRemoteSessionUrl(sessionId, process.env.SESSION_INGRESS_URL);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJUb29sVXNlQmxvY2siLCJnZXRSZW1vdGVTZXNzaW9uVXJsIiwiT1VUUFVUX0ZJTEVfVEFHIiwiUkVNT1RFX1JFVklFV19QUk9HUkVTU19UQUciLCJSRU1PVEVfUkVWSUVXX1RBRyIsIlNUQVRVU19UQUciLCJTVU1NQVJZX1RBRyIsIlRBU0tfSURfVEFHIiwiVEFTS19OT1RJRklDQVRJT05fVEFHIiwiVEFTS19UWVBFX1RBRyIsIlRPT0xfVVNFX0lEX1RBRyIsIlVMVFJBUExBTl9UQUciLCJTREtBc3Npc3RhbnRNZXNzYWdlIiwiU0RLTWVzc2FnZSIsIlNldEFwcFN0YXRlIiwiVGFzayIsIlRhc2tDb250ZXh0IiwiVGFza1N0YXRlQmFzZSIsImNyZWF0ZVRhc2tTdGF0ZUJhc2UiLCJnZW5lcmF0ZVRhc2tJZCIsIlRvZG9Xcml0ZVRvb2wiLCJCYWNrZ3JvdW5kUmVtb3RlU2Vzc2lvblByZWNvbmRpdGlvbiIsImNoZWNrQmFja2dyb3VuZFJlbW90ZVNlc3Npb25FbGlnaWJpbGl0eSIsImxvZ0ZvckRlYnVnZ2luZyIsImxvZ0Vycm9yIiwiZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24iLCJleHRyYWN0VGFnIiwiZXh0cmFjdFRleHRDb250ZW50IiwiZW1pdFRhc2tUZXJtaW5hdGVkU2RrIiwiZGVsZXRlUmVtb3RlQWdlbnRNZXRhZGF0YSIsImxpc3RSZW1vdGVBZ2VudE1ldGFkYXRhIiwiUmVtb3RlQWdlbnRNZXRhZGF0YSIsIndyaXRlUmVtb3RlQWdlbnRNZXRhZGF0YSIsImpzb25TdHJpbmdpZnkiLCJhcHBlbmRUYXNrT3V0cHV0IiwiZXZpY3RUYXNrT3V0cHV0IiwiZ2V0VGFza091dHB1dFBhdGgiLCJpbml0VGFza091dHB1dCIsInJlZ2lzdGVyVGFzayIsInVwZGF0ZVRhc2tTdGF0ZSIsImZldGNoU2Vzc2lvbiIsImFyY2hpdmVSZW1vdGVTZXNzaW9uIiwicG9sbFJlbW90ZVNlc3Npb25FdmVudHMiLCJUb2RvTGlzdCIsIlVsdHJhcGxhblBoYXNlIiwiUmVtb3RlQWdlbnRUYXNrU3RhdGUiLCJ0eXBlIiwicmVtb3RlVGFza1R5cGUiLCJSZW1vdGVUYXNrVHlwZSIsInJlbW90ZVRhc2tNZXRhZGF0YSIsIlJlbW90ZVRhc2tNZXRhZGF0YSIsInNlc3Npb25JZCIsImNvbW1hbmQiLCJ0aXRsZSIsInRvZG9MaXN0IiwibG9nIiwiaXNMb25nUnVubmluZyIsInBvbGxTdGFydGVkQXQiLCJpc1JlbW90ZVJldmlldyIsInJldmlld1Byb2dyZXNzIiwic3RhZ2UiLCJidWdzRm91bmQiLCJidWdzVmVyaWZpZWQiLCJidWdzUmVmdXRlZCIsImlzVWx0cmFwbGFuIiwidWx0cmFwbGFuUGhhc2UiLCJFeGNsdWRlIiwiUkVNT1RFX1RBU0tfVFlQRVMiLCJjb25zdCIsImlzUmVtb3RlVGFza1R5cGUiLCJ2IiwiaW5jbHVkZXMiLCJBdXRvZml4UHJSZW1vdGVUYXNrTWV0YWRhdGEiLCJvd25lciIsInJlcG8iLCJwck51bWJlciIsIlJlbW90ZVRhc2tDb21wbGV0aW9uQ2hlY2tlciIsIlByb21pc2UiLCJjb21wbGV0aW9uQ2hlY2tlcnMiLCJNYXAiLCJyZWdpc3RlckNvbXBsZXRpb25DaGVja2VyIiwiY2hlY2tlciIsInNldCIsInBlcnNpc3RSZW1vdGVBZ2VudE1ldGFkYXRhIiwibWV0YSIsInRhc2tJZCIsImUiLCJTdHJpbmciLCJyZW1vdmVSZW1vdGVBZ2VudE1ldGFkYXRhIiwiUmVtb3RlQWdlbnRQcmVjb25kaXRpb25SZXN1bHQiLCJlbGlnaWJsZSIsImVycm9ycyIsImNoZWNrUmVtb3RlQWdlbnRFbGlnaWJpbGl0eSIsInNraXBCdW5kbGUiLCJsZW5ndGgiLCJmb3JtYXRQcmVjb25kaXRpb25FcnJvciIsImVycm9yIiwiZW5xdWV1ZVJlbW90ZU5vdGlmaWNhdGlvbiIsInN0YXR1cyIsInNldEFwcFN0YXRlIiwidG9vbFVzZUlkIiwibWFya1Rhc2tOb3RpZmllZCIsInN0YXR1c1RleHQiLCJ0b29sVXNlSWRMaW5lIiwib3V0cHV0UGF0aCIsIm1lc3NhZ2UiLCJ2YWx1ZSIsIm1vZGUiLCJzaG91bGRFbnF1ZXVlIiwidGFzayIsIm5vdGlmaWVkIiwiZXh0cmFjdFBsYW5Gcm9tTG9nIiwiaSIsIm1zZyIsImZ1bGxUZXh0IiwiY29udGVudCIsInBsYW4iLCJ0cmltIiwiZW5xdWV1ZVVsdHJhcGxhbkZhaWx1cmVOb3RpZmljYXRpb24iLCJyZWFzb24iLCJzZXNzaW9uVXJsIiwiZ2V0UmVtb3RlVGFza1Nlc3Npb25VcmwiLCJleHRyYWN0UmV2aWV3RnJvbUxvZyIsInN1YnR5cGUiLCJ0YWdnZWQiLCJzdGRvdXQiLCJob29rU3Rkb3V0IiwiZmlsdGVyIiwibWFwIiwiam9pbiIsImhvb2tUYWdnZWQiLCJhbGxUZXh0IiwiZXh0cmFjdFJldmlld1RhZ0Zyb21Mb2ciLCJlbnF1ZXVlUmVtb3RlUmV2aWV3Tm90aWZpY2F0aW9uIiwicmV2aWV3Q29udGVudCIsImVucXVldWVSZW1vdGVSZXZpZXdGYWlsdXJlTm90aWZpY2F0aW9uIiwiZXh0cmFjdFRvZG9MaXN0RnJvbUxvZyIsInRvZG9MaXN0TWVzc2FnZSIsImZpbmRMYXN0Iiwic29tZSIsImJsb2NrIiwibmFtZSIsImlucHV0IiwiZmluZCIsInBhcnNlZElucHV0IiwiaW5wdXRTY2hlbWEiLCJzYWZlUGFyc2UiLCJzdWNjZXNzIiwiZGF0YSIsInRvZG9zIiwicmVnaXN0ZXJSZW1vdGVBZ2VudFRhc2siLCJvcHRpb25zIiwic2Vzc2lvbiIsImlkIiwiY29udGV4dCIsImNsZWFudXAiLCJ0YXNrU3RhdGUiLCJEYXRlIiwibm93Iiwic3Bhd25lZEF0Iiwic3RvcFBvbGxpbmciLCJzdGFydFJlbW90ZVNlc3Npb25Qb2xsaW5nIiwicmVzdG9yZVJlbW90ZUFnZW50VGFza3MiLCJyZXN0b3JlUmVtb3RlQWdlbnRUYXNrc0ltcGwiLCJwZXJzaXN0ZWQiLCJyZW1vdGVTdGF0dXMiLCJzZXNzaW9uX3N0YXR1cyIsIkVycm9yIiwic3RhcnRzV2l0aCIsInN0YXJ0VGltZSIsImlzUnVubmluZyIsIlBPTExfSU5URVJWQUxfTVMiLCJSRU1PVEVfUkVWSUVXX1RJTUVPVVRfTVMiLCJTVEFCTEVfSURMRV9QT0xMUyIsImNvbnNlY3V0aXZlSWRsZVBvbGxzIiwibGFzdEV2ZW50SWQiLCJhY2N1bXVsYXRlZExvZyIsImNhY2hlZFJldmlld0NvbnRlbnQiLCJwb2xsIiwiYXBwU3RhdGUiLCJnZXRBcHBTdGF0ZSIsInRhc2tzIiwicmVzcG9uc2UiLCJsb2dHcmV3IiwibmV3RXZlbnRzIiwiZGVsdGFUZXh0IiwidGV4dCIsInNlc3Npb25TdGF0dXMiLCJ0IiwiZW5kVGltZSIsImdldCIsImNvbXBsZXRpb25SZXN1bHQiLCJyZXN1bHQiLCJ1bmRlZmluZWQiLCJuZXdQcm9ncmVzcyIsIm9wZW4iLCJjbG9zZSIsImV2IiwicyIsImNsb3NlQXQiLCJsYXN0SW5kZXhPZiIsIm9wZW5BdCIsInAiLCJKU09OIiwicGFyc2UiLCJzbGljZSIsImJ1Z3NfZm91bmQiLCJidWdzX3ZlcmlmaWVkIiwiYnVnc19yZWZ1dGVkIiwiaGFzQW55T3V0cHV0Iiwic3RhYmxlSWRsZSIsImhhc1Nlc3Npb25TdGFydEhvb2siLCJtIiwiaG9va19ldmVudCIsImhhc0Fzc2lzdGFudEV2ZW50cyIsInNlc3Npb25Eb25lIiwicmV2aWV3VGltZWRPdXQiLCJuZXdTdGF0dXMiLCJyYWNlVGVybWluYXRlZCIsInByZXZUYXNrIiwic3RhdHVzVW5jaGFuZ2VkIiwiZmluYWxTdGF0dXMiLCJzZXRUaW1lb3V0IiwiUmVtb3RlQWdlbnRUYXNrIiwia2lsbCIsImRlc2NyaXB0aW9uIiwia2lsbGVkIiwic3VtbWFyeSIsImNhdGNoIiwicHJvY2VzcyIsImVudiIsIlNFU1NJT05fSU5HUkVTU19VUkwiXSwic291cmNlcyI6WyJSZW1vdGVBZ2VudFRhc2sudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgVG9vbFVzZUJsb2NrIH0gZnJvbSAnQGFudGhyb3BpYy1haS9zZGsvcmVzb3VyY2VzJ1xuaW1wb3J0IHsgZ2V0UmVtb3RlU2Vzc2lvblVybCB9IGZyb20gJy4uLy4uL2NvbnN0YW50cy9wcm9kdWN0LmpzJ1xuaW1wb3J0IHtcbiAgT1VUUFVUX0ZJTEVfVEFHLFxuICBSRU1PVEVfUkVWSUVXX1BST0dSRVNTX1RBRyxcbiAgUkVNT1RFX1JFVklFV19UQUcsXG4gIFNUQVRVU19UQUcsXG4gIFNVTU1BUllfVEFHLFxuICBUQVNLX0lEX1RBRyxcbiAgVEFTS19OT1RJRklDQVRJT05fVEFHLFxuICBUQVNLX1RZUEVfVEFHLFxuICBUT09MX1VTRV9JRF9UQUcsXG4gIFVMVFJBUExBTl9UQUcsXG59IGZyb20gJy4uLy4uL2NvbnN0YW50cy94bWwuanMnXG5pbXBvcnQgdHlwZSB7XG4gIFNES0Fzc2lzdGFudE1lc3NhZ2UsXG4gIFNES01lc3NhZ2UsXG59IGZyb20gJy4uLy4uL2VudHJ5cG9pbnRzL2FnZW50U2RrVHlwZXMuanMnXG5pbXBvcnQgdHlwZSB7XG4gIFNldEFwcFN0YXRlLFxuICBUYXNrLFxuICBUYXNrQ29udGV4dCxcbiAgVGFza1N0YXRlQmFzZSxcbn0gZnJvbSAnLi4vLi4vVGFzay5qcydcbmltcG9ydCB7IGNyZWF0ZVRhc2tTdGF0ZUJhc2UsIGdlbmVyYXRlVGFza0lkIH0gZnJvbSAnLi4vLi4vVGFzay5qcydcbmltcG9ydCB7IFRvZG9Xcml0ZVRvb2wgfSBmcm9tICcuLi8uLi90b29scy9Ub2RvV3JpdGVUb29sL1RvZG9Xcml0ZVRvb2wuanMnXG5pbXBvcnQge1xuICB0eXBlIEJhY2tncm91bmRSZW1vdGVTZXNzaW9uUHJlY29uZGl0aW9uLFxuICBjaGVja0JhY2tncm91bmRSZW1vdGVTZXNzaW9uRWxpZ2liaWxpdHksXG59IGZyb20gJy4uLy4uL3V0aWxzL2JhY2tncm91bmQvcmVtb3RlL3JlbW90ZVNlc3Npb24uanMnXG5pbXBvcnQgeyBsb2dGb3JEZWJ1Z2dpbmcgfSBmcm9tICcuLi8uLi91dGlscy9kZWJ1Zy5qcydcbmltcG9ydCB7IGxvZ0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHsgZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24gfSBmcm9tICcuLi8uLi91dGlscy9tZXNzYWdlUXVldWVNYW5hZ2VyLmpzJ1xuaW1wb3J0IHsgZXh0cmFjdFRhZywgZXh0cmFjdFRleHRDb250ZW50IH0gZnJvbSAnLi4vLi4vdXRpbHMvbWVzc2FnZXMuanMnXG5pbXBvcnQgeyBlbWl0VGFza1Rlcm1pbmF0ZWRTZGsgfSBmcm9tICcuLi8uLi91dGlscy9zZGtFdmVudFF1ZXVlLmpzJ1xuaW1wb3J0IHtcbiAgZGVsZXRlUmVtb3RlQWdlbnRNZXRhZGF0YSxcbiAgbGlzdFJlbW90ZUFnZW50TWV0YWRhdGEsXG4gIHR5cGUgUmVtb3RlQWdlbnRNZXRhZGF0YSxcbiAgd3JpdGVSZW1vdGVBZ2VudE1ldGFkYXRhLFxufSBmcm9tICcuLi8uLi91dGlscy9zZXNzaW9uU3RvcmFnZS5qcydcbmltcG9ydCB7IGpzb25TdHJpbmdpZnkgfSBmcm9tICcuLi8uLi91dGlscy9zbG93T3BlcmF0aW9ucy5qcydcbmltcG9ydCB7XG4gIGFwcGVuZFRhc2tPdXRwdXQsXG4gIGV2aWN0VGFza091dHB1dCxcbiAgZ2V0VGFza091dHB1dFBhdGgsXG4gIGluaXRUYXNrT3V0cHV0LFxufSBmcm9tICcuLi8uLi91dGlscy90YXNrL2Rpc2tPdXRwdXQuanMnXG5pbXBvcnQgeyByZWdpc3RlclRhc2ssIHVwZGF0ZVRhc2tTdGF0ZSB9IGZyb20gJy4uLy4uL3V0aWxzL3Rhc2svZnJhbWV3b3JrLmpzJ1xuaW1wb3J0IHsgZmV0Y2hTZXNzaW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvdGVsZXBvcnQvYXBpLmpzJ1xuaW1wb3J0IHtcbiAgYXJjaGl2ZVJlbW90ZVNlc3Npb24sXG4gIHBvbGxSZW1vdGVTZXNzaW9uRXZlbnRzLFxufSBmcm9tICcuLi8uLi91dGlscy90ZWxlcG9ydC5qcydcbmltcG9ydCB0eXBlIHsgVG9kb0xpc3QgfSBmcm9tICcuLi8uLi91dGlscy90b2RvL3R5cGVzLmpzJ1xuaW1wb3J0IHR5cGUgeyBVbHRyYXBsYW5QaGFzZSB9IGZyb20gJy4uLy4uL3V0aWxzL3VsdHJhcGxhbi9jY3JTZXNzaW9uLmpzJ1xuXG5leHBvcnQgdHlwZSBSZW1vdGVBZ2VudFRhc2tTdGF0ZSA9IFRhc2tTdGF0ZUJhc2UgJiB7XG4gIHR5cGU6ICdyZW1vdGVfYWdlbnQnXG4gIHJlbW90ZVRhc2tUeXBlOiBSZW1vdGVUYXNrVHlwZVxuICAvKiogVGFzay1zcGVjaWZpYyBtZXRhZGF0YSAoUFIgbnVtYmVyLCByZXBvLCBldGMuKS4gKi9cbiAgcmVtb3RlVGFza01ldGFkYXRhPzogUmVtb3RlVGFza01ldGFkYXRhXG4gIHNlc3Npb25JZDogc3RyaW5nIC8vIE9yaWdpbmFsIHNlc3Npb24gSUQgZm9yIEFQSSBjYWxsc1xuICBjb21tYW5kOiBzdHJpbmdcbiAgdGl0bGU6IHN0cmluZ1xuICB0b2RvTGlzdDogVG9kb0xpc3RcbiAgbG9nOiBTREtNZXNzYWdlW11cbiAgLyoqXG4gICAqIExvbmctcnVubmluZyBhZ2VudCB0aGF0IHdpbGwgbm90IGJlIG1hcmtlZCBhcyBjb21wbGV0ZSBhZnRlciB0aGUgZmlyc3QgYHJlc3VsdGAuXG4gICAqL1xuICBpc0xvbmdSdW5uaW5nPzogYm9vbGVhblxuICAvKipcbiAgICogV2hlbiB0aGUgbG9jYWwgcG9sbGVyIHN0YXJ0ZWQgd2F0Y2hpbmcgdGhpcyB0YXNrIChhdCBzcGF3biBvciBvbiByZXN0b3JlKS5cbiAgICogUmV2aWV3IHRpbWVvdXQgY2xvY2tzIGZyb20gaGVyZSBzbyBhIHJlc3RvcmUgZG9lc24ndCBpbW1lZGlhdGVseSB0aW1lIG91dFxuICAgKiBhIHRhc2sgc3Bhd25lZCA+MzBtaW4gYWdvLlxuICAgKi9cbiAgcG9sbFN0YXJ0ZWRBdDogbnVtYmVyXG4gIC8qKiBUcnVlIHdoZW4gdGhpcyB0YXNrIHdhcyBjcmVhdGVkIGJ5IGEgdGVsZXBvcnRlZCAvdWx0cmFyZXZpZXcgY29tbWFuZC4gKi9cbiAgaXNSZW1vdGVSZXZpZXc/OiBib29sZWFuXG4gIC8qKiBQYXJzZWQgZnJvbSB0aGUgb3JjaGVzdHJhdG9yJ3MgPHJlbW90ZS1yZXZpZXctcHJvZ3Jlc3M+IGhlYXJ0YmVhdCBlY2hvZXMuICovXG4gIHJldmlld1Byb2dyZXNzPzoge1xuICAgIHN0YWdlPzogJ2ZpbmRpbmcnIHwgJ3ZlcmlmeWluZycgfCAnc3ludGhlc2l6aW5nJ1xuICAgIGJ1Z3NGb3VuZDogbnVtYmVyXG4gICAgYnVnc1ZlcmlmaWVkOiBudW1iZXJcbiAgICBidWdzUmVmdXRlZDogbnVtYmVyXG4gIH1cbiAgaXNVbHRyYXBsYW4/OiBib29sZWFuXG4gIC8qKlxuICAgKiBTY2FubmVyLWRlcml2ZWQgcGlsbCBzdGF0ZS4gVW5kZWZpbmVkID0gcnVubmluZy4gYG5lZWRzX2lucHV0YCB3aGVuIHRoZVxuICAgKiByZW1vdGUgYXNrZWQgYSBjbGFyaWZ5aW5nIHF1ZXN0aW9uIGFuZCBpcyBpZGxlOyBgcGxhbl9yZWFkeWAgd2hlblxuICAgKiBFeGl0UGxhbk1vZGUgaXMgYXdhaXRpbmcgYnJvd3NlciBhcHByb3ZhbC4gU3VyZmFjZWQgaW4gdGhlIHBpbGwgYmFkZ2VcbiAgICogYW5kIGRldGFpbCBkaWFsb2cgc3RhdHVzIGxpbmUuXG4gICAqL1xuICB1bHRyYXBsYW5QaGFzZT86IEV4Y2x1ZGU8VWx0cmFwbGFuUGhhc2UsICdydW5uaW5nJz5cbn1cblxuY29uc3QgUkVNT1RFX1RBU0tfVFlQRVMgPSBbXG4gICdyZW1vdGUtYWdlbnQnLFxuICAndWx0cmFwbGFuJyxcbiAgJ3VsdHJhcmV2aWV3JyxcbiAgJ2F1dG9maXgtcHInLFxuICAnYmFja2dyb3VuZC1wcicsXG5dIGFzIGNvbnN0XG5leHBvcnQgdHlwZSBSZW1vdGVUYXNrVHlwZSA9ICh0eXBlb2YgUkVNT1RFX1RBU0tfVFlQRVMpW251bWJlcl1cblxuZnVuY3Rpb24gaXNSZW1vdGVUYXNrVHlwZSh2OiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2IGlzIFJlbW90ZVRhc2tUeXBlIHtcbiAgcmV0dXJuIChSRU1PVEVfVEFTS19UWVBFUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXModiA/PyAnJylcbn1cblxuZXhwb3J0IHR5cGUgQXV0b2ZpeFByUmVtb3RlVGFza01ldGFkYXRhID0ge1xuICBvd25lcjogc3RyaW5nXG4gIHJlcG86IHN0cmluZ1xuICBwck51bWJlcjogbnVtYmVyXG59XG5cbmV4cG9ydCB0eXBlIFJlbW90ZVRhc2tNZXRhZGF0YSA9IEF1dG9maXhQclJlbW90ZVRhc2tNZXRhZGF0YVxuXG4vKipcbiAqIENhbGxlZCBvbiBldmVyeSBwb2xsIHRpY2sgZm9yIHRhc2tzIHdpdGggYSBtYXRjaGluZyByZW1vdGVUYXNrVHlwZS4gUmV0dXJuIGFcbiAqIG5vbi1udWxsIHN0cmluZyB0byBjb21wbGV0ZSB0aGUgdGFzayAoc3RyaW5nIGJlY29tZXMgdGhlIG5vdGlmaWNhdGlvbiB0ZXh0KSxcbiAqIG9yIG51bGwgdG8ga2VlcCBwb2xsaW5nLiBDaGVja2VycyB0aGF0IGhpdCBleHRlcm5hbCBBUElzIHNob3VsZCBzZWxmLXRocm90dGxlLlxuICovXG5leHBvcnQgdHlwZSBSZW1vdGVUYXNrQ29tcGxldGlvbkNoZWNrZXIgPSAoXG4gIHJlbW90ZVRhc2tNZXRhZGF0YTogUmVtb3RlVGFza01ldGFkYXRhIHwgdW5kZWZpbmVkLFxuKSA9PiBQcm9taXNlPHN0cmluZyB8IG51bGw+XG5cbmNvbnN0IGNvbXBsZXRpb25DaGVja2VycyA9IG5ldyBNYXA8XG4gIFJlbW90ZVRhc2tUeXBlLFxuICBSZW1vdGVUYXNrQ29tcGxldGlvbkNoZWNrZXJcbj4oKVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgY29tcGxldGlvbiBjaGVja2VyIGZvciBhIHJlbW90ZSB0YXNrIHR5cGUuIEludm9rZWQgb24gZXZlcnkgcG9sbFxuICogdGljazsgc3Vydml2ZXMgLS1yZXN1bWUgdmlhIHRoZSBzaWRlY2FyJ3MgcmVtb3RlVGFza1R5cGUgKyByZW1vdGVUYXNrTWV0YWRhdGEuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNvbXBsZXRpb25DaGVja2VyKFxuICByZW1vdGVUYXNrVHlwZTogUmVtb3RlVGFza1R5cGUsXG4gIGNoZWNrZXI6IFJlbW90ZVRhc2tDb21wbGV0aW9uQ2hlY2tlcixcbik6IHZvaWQge1xuICBjb21wbGV0aW9uQ2hlY2tlcnMuc2V0KHJlbW90ZVRhc2tUeXBlLCBjaGVja2VyKVxufVxuXG4vKipcbiAqIFBlcnNpc3QgYSByZW1vdGUtYWdlbnQgbWV0YWRhdGEgZW50cnkgdG8gdGhlIHNlc3Npb24gc2lkZWNhci5cbiAqIEZpcmUtYW5kLWZvcmdldCDigJQgcGVyc2lzdGVuY2UgZmFpbHVyZXMgbXVzdCBub3QgYmxvY2sgdGFzayByZWdpc3RyYXRpb24uXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHBlcnNpc3RSZW1vdGVBZ2VudE1ldGFkYXRhKFxuICBtZXRhOiBSZW1vdGVBZ2VudE1ldGFkYXRhLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgd3JpdGVSZW1vdGVBZ2VudE1ldGFkYXRhKG1ldGEudGFza0lkLCBtZXRhKVxuICB9IGNhdGNoIChlKSB7XG4gICAgbG9nRm9yRGVidWdnaW5nKGBwZXJzaXN0UmVtb3RlQWdlbnRNZXRhZGF0YSBmYWlsZWQ6ICR7U3RyaW5nKGUpfWApXG4gIH1cbn1cblxuLyoqXG4gKiBSZW1vdmUgYSByZW1vdGUtYWdlbnQgbWV0YWRhdGEgZW50cnkgZnJvbSB0aGUgc2Vzc2lvbiBzaWRlY2FyLlxuICogQ2FsbGVkIG9uIHRhc2sgY29tcGxldGlvbi9raWxsIHNvIHJlc3RvcmVkIHNlc3Npb25zIGRvbid0IHJlc3VycmVjdFxuICogdGFza3MgdGhhdCBhbHJlYWR5IGZpbmlzaGVkLlxuICovXG5hc3luYyBmdW5jdGlvbiByZW1vdmVSZW1vdGVBZ2VudE1ldGFkYXRhKHRhc2tJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgZGVsZXRlUmVtb3RlQWdlbnRNZXRhZGF0YSh0YXNrSWQpXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2dGb3JEZWJ1Z2dpbmcoYHJlbW92ZVJlbW90ZUFnZW50TWV0YWRhdGEgZmFpbGVkOiAke1N0cmluZyhlKX1gKVxuICB9XG59XG5cbi8vIFByZWNvbmRpdGlvbiBlcnJvciByZXN1bHRcbmV4cG9ydCB0eXBlIFJlbW90ZUFnZW50UHJlY29uZGl0aW9uUmVzdWx0ID1cbiAgfCB7XG4gICAgICBlbGlnaWJsZTogdHJ1ZVxuICAgIH1cbiAgfCB7XG4gICAgICBlbGlnaWJsZTogZmFsc2VcbiAgICAgIGVycm9yczogQmFja2dyb3VuZFJlbW90ZVNlc3Npb25QcmVjb25kaXRpb25bXVxuICAgIH1cblxuLyoqXG4gKiBDaGVjayBlbGlnaWJpbGl0eSBmb3IgY3JlYXRpbmcgYSByZW1vdGUgYWdlbnQgc2Vzc2lvbi5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoZWNrUmVtb3RlQWdlbnRFbGlnaWJpbGl0eSh7XG4gIHNraXBCdW5kbGUgPSBmYWxzZSxcbn06IHtcbiAgc2tpcEJ1bmRsZT86IGJvb2xlYW5cbn0gPSB7fSk6IFByb21pc2U8UmVtb3RlQWdlbnRQcmVjb25kaXRpb25SZXN1bHQ+IHtcbiAgY29uc3QgZXJyb3JzID0gYXdhaXQgY2hlY2tCYWNrZ3JvdW5kUmVtb3RlU2Vzc2lvbkVsaWdpYmlsaXR5KHsgc2tpcEJ1bmRsZSB9KVxuICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4geyBlbGlnaWJsZTogZmFsc2UsIGVycm9ycyB9XG4gIH1cbiAgcmV0dXJuIHsgZWxpZ2libGU6IHRydWUgfVxufVxuXG4vKipcbiAqIEZvcm1hdCBwcmVjb25kaXRpb24gZXJyb3IgZm9yIGRpc3BsYXkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRQcmVjb25kaXRpb25FcnJvcihcbiAgZXJyb3I6IEJhY2tncm91bmRSZW1vdGVTZXNzaW9uUHJlY29uZGl0aW9uLFxuKTogc3RyaW5nIHtcbiAgc3dpdGNoIChlcnJvci50eXBlKSB7XG4gICAgY2FzZSAnbm90X2xvZ2dlZF9pbic6XG4gICAgICByZXR1cm4gJ1BsZWFzZSBydW4gL2xvZ2luIGFuZCBzaWduIGluIHdpdGggeW91ciBDbGF1ZGUuYWkgYWNjb3VudCAobm90IENvbnNvbGUpLidcbiAgICBjYXNlICdub19yZW1vdGVfZW52aXJvbm1lbnQnOlxuICAgICAgcmV0dXJuICdObyBjbG91ZCBlbnZpcm9ubWVudCBhdmFpbGFibGUuIFNldCBvbmUgdXAgYXQgaHR0cHM6Ly9jbGF1ZGUuYWkvY29kZS9vbmJvYXJkaW5nP21hZ2ljPWVudi1zZXR1cCdcbiAgICBjYXNlICdub3RfaW5fZ2l0X3JlcG8nOlxuICAgICAgcmV0dXJuICdCYWNrZ3JvdW5kIHRhc2tzIHJlcXVpcmUgYSBnaXQgcmVwb3NpdG9yeS4gSW5pdGlhbGl6ZSBnaXQgb3IgcnVuIGZyb20gYSBnaXQgcmVwb3NpdG9yeS4nXG4gICAgY2FzZSAnbm9fZ2l0X3JlbW90ZSc6XG4gICAgICByZXR1cm4gJ0JhY2tncm91bmQgdGFza3MgcmVxdWlyZSBhIEdpdEh1YiByZW1vdGUuIEFkZCBvbmUgd2l0aCBgZ2l0IHJlbW90ZSBhZGQgb3JpZ2luIFJFUE9fVVJMYC4nXG4gICAgY2FzZSAnZ2l0aHViX2FwcF9ub3RfaW5zdGFsbGVkJzpcbiAgICAgIHJldHVybiAnVGhlIENsYXVkZSBHaXRIdWIgYXBwIG11c3QgYmUgaW5zdGFsbGVkIG9uIHRoaXMgcmVwb3NpdG9yeSBmaXJzdC5cXG5odHRwczovL2dpdGh1Yi5jb20vYXBwcy9jbGF1ZGUvaW5zdGFsbGF0aW9ucy9uZXcnXG4gICAgY2FzZSAncG9saWN5X2Jsb2NrZWQnOlxuICAgICAgcmV0dXJuIFwiUmVtb3RlIHNlc3Npb25zIGFyZSBkaXNhYmxlZCBieSB5b3VyIG9yZ2FuaXphdGlvbidzIHBvbGljeS4gQ29udGFjdCB5b3VyIG9yZ2FuaXphdGlvbiBhZG1pbiB0byBlbmFibGUgdGhlbS5cIlxuICB9XG59XG5cbi8qKlxuICogRW5xdWV1ZSBhIHJlbW90ZSB0YXNrIG5vdGlmaWNhdGlvbiB0byB0aGUgbWVzc2FnZSBxdWV1ZS5cbiAqL1xuZnVuY3Rpb24gZW5xdWV1ZVJlbW90ZU5vdGlmaWNhdGlvbihcbiAgdGFza0lkOiBzdHJpbmcsXG4gIHRpdGxlOiBzdHJpbmcsXG4gIHN0YXR1czogJ2NvbXBsZXRlZCcgfCAnZmFpbGVkJyB8ICdraWxsZWQnLFxuICBzZXRBcHBTdGF0ZTogU2V0QXBwU3RhdGUsXG4gIHRvb2xVc2VJZD86IHN0cmluZyxcbik6IHZvaWQge1xuICAvLyBBdG9taWNhbGx5IGNoZWNrIGFuZCBzZXQgbm90aWZpZWQgZmxhZyB0byBwcmV2ZW50IGR1cGxpY2F0ZSBub3RpZmljYXRpb25zLlxuICBpZiAoIW1hcmtUYXNrTm90aWZpZWQodGFza0lkLCBzZXRBcHBTdGF0ZSkpIHJldHVyblxuXG4gIGNvbnN0IHN0YXR1c1RleHQgPVxuICAgIHN0YXR1cyA9PT0gJ2NvbXBsZXRlZCdcbiAgICAgID8gJ2NvbXBsZXRlZCBzdWNjZXNzZnVsbHknXG4gICAgICA6IHN0YXR1cyA9PT0gJ2ZhaWxlZCdcbiAgICAgICAgPyAnZmFpbGVkJ1xuICAgICAgICA6ICd3YXMgc3RvcHBlZCdcblxuICBjb25zdCB0b29sVXNlSWRMaW5lID0gdG9vbFVzZUlkXG4gICAgPyBgXFxuPCR7VE9PTF9VU0VfSURfVEFHfT4ke3Rvb2xVc2VJZH08LyR7VE9PTF9VU0VfSURfVEFHfT5gXG4gICAgOiAnJ1xuXG4gIGNvbnN0IG91dHB1dFBhdGggPSBnZXRUYXNrT3V0cHV0UGF0aCh0YXNrSWQpXG4gIGNvbnN0IG1lc3NhZ2UgPSBgPCR7VEFTS19OT1RJRklDQVRJT05fVEFHfT5cbjwke1RBU0tfSURfVEFHfT4ke3Rhc2tJZH08LyR7VEFTS19JRF9UQUd9PiR7dG9vbFVzZUlkTGluZX1cbjwke1RBU0tfVFlQRV9UQUd9PnJlbW90ZV9hZ2VudDwvJHtUQVNLX1RZUEVfVEFHfT5cbjwke09VVFBVVF9GSUxFX1RBR30+JHtvdXRwdXRQYXRofTwvJHtPVVRQVVRfRklMRV9UQUd9PlxuPCR7U1RBVFVTX1RBR30+JHtzdGF0dXN9PC8ke1NUQVRVU19UQUd9PlxuPCR7U1VNTUFSWV9UQUd9PlJlbW90ZSB0YXNrIFwiJHt0aXRsZX1cIiAke3N0YXR1c1RleHR9PC8ke1NVTU1BUllfVEFHfT5cbjwvJHtUQVNLX05PVElGSUNBVElPTl9UQUd9PmBcblxuICBlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbih7IHZhbHVlOiBtZXNzYWdlLCBtb2RlOiAndGFzay1ub3RpZmljYXRpb24nIH0pXG59XG5cbi8qKlxuICogQXRvbWljYWxseSBtYXJrIGEgdGFzayBhcyBub3RpZmllZC4gUmV0dXJucyB0cnVlIGlmIHRoaXMgY2FsbCBmbGlwcGVkIHRoZVxuICogZmxhZyAoY2FsbGVyIHNob3VsZCBlbnF1ZXVlKSwgZmFsc2UgaWYgYWxyZWFkeSBub3RpZmllZCAoY2FsbGVyIHNob3VsZCBza2lwKS5cbiAqL1xuZnVuY3Rpb24gbWFya1Rhc2tOb3RpZmllZCh0YXNrSWQ6IHN0cmluZywgc2V0QXBwU3RhdGU6IFNldEFwcFN0YXRlKTogYm9vbGVhbiB7XG4gIGxldCBzaG91bGRFbnF1ZXVlID0gZmFsc2VcbiAgdXBkYXRlVGFza1N0YXRlKHRhc2tJZCwgc2V0QXBwU3RhdGUsIHRhc2sgPT4ge1xuICAgIGlmICh0YXNrLm5vdGlmaWVkKSB7XG4gICAgICByZXR1cm4gdGFza1xuICAgIH1cbiAgICBzaG91bGRFbnF1ZXVlID0gdHJ1ZVxuICAgIHJldHVybiB7IC4uLnRhc2ssIG5vdGlmaWVkOiB0cnVlIH1cbiAgfSlcbiAgcmV0dXJuIHNob3VsZEVucXVldWVcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHRoZSBwbGFuIGNvbnRlbnQgZnJvbSB0aGUgcmVtb3RlIHNlc3Npb24gbG9nLlxuICogU2VhcmNoZXMgYWxsIGFzc2lzdGFudCBtZXNzYWdlcyBmb3IgPHVsdHJhcGxhbj4uLi48L3VsdHJhcGxhbj4gdGFncy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RQbGFuRnJvbUxvZyhsb2c6IFNES01lc3NhZ2VbXSk6IHN0cmluZyB8IG51bGwge1xuICAvLyBXYWxrIGJhY2t3YXJkcyB0aHJvdWdoIGFzc2lzdGFudCBtZXNzYWdlcyB0byBmaW5kIDx1bHRyYXBsYW4+IGNvbnRlbnRcbiAgZm9yIChsZXQgaSA9IGxvZy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IG1zZyA9IGxvZ1tpXVxuICAgIGlmIChtc2c/LnR5cGUgIT09ICdhc3Npc3RhbnQnKSBjb250aW51ZVxuICAgIGNvbnN0IGZ1bGxUZXh0ID0gZXh0cmFjdFRleHRDb250ZW50KG1zZy5tZXNzYWdlLmNvbnRlbnQsICdcXG4nKVxuICAgIGNvbnN0IHBsYW4gPSBleHRyYWN0VGFnKGZ1bGxUZXh0LCBVTFRSQVBMQU5fVEFHKVxuICAgIGlmIChwbGFuPy50cmltKCkpIHJldHVybiBwbGFuLnRyaW0oKVxuICB9XG4gIHJldHVybiBudWxsXG59XG5cbi8qKlxuICogRW5xdWV1ZSBhbiB1bHRyYXBsYW4tc3BlY2lmaWMgZmFpbHVyZSBub3RpZmljYXRpb24uIFVubGlrZSBlbnF1ZXVlUmVtb3RlTm90aWZpY2F0aW9uXG4gKiB0aGlzIGRvZXMgTk9UIGluc3RydWN0IHRoZSBtb2RlbCB0byByZWFkIHRoZSByYXcgb3V0cHV0IGZpbGUgKGEgSlNPTkwgZHVtcCB0aGF0IGlzXG4gKiB1c2VsZXNzIGZvciBwbGFuIGV4dHJhY3Rpb24pLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5xdWV1ZVVsdHJhcGxhbkZhaWx1cmVOb3RpZmljYXRpb24oXG4gIHRhc2tJZDogc3RyaW5nLFxuICBzZXNzaW9uSWQ6IHN0cmluZyxcbiAgcmVhc29uOiBzdHJpbmcsXG4gIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZSxcbik6IHZvaWQge1xuICBpZiAoIW1hcmtUYXNrTm90aWZpZWQodGFza0lkLCBzZXRBcHBTdGF0ZSkpIHJldHVyblxuXG4gIGNvbnN0IHNlc3Npb25VcmwgPSBnZXRSZW1vdGVUYXNrU2Vzc2lvblVybChzZXNzaW9uSWQpXG4gIGNvbnN0IG1lc3NhZ2UgPSBgPCR7VEFTS19OT1RJRklDQVRJT05fVEFHfT5cbjwke1RBU0tfSURfVEFHfT4ke3Rhc2tJZH08LyR7VEFTS19JRF9UQUd9PlxuPCR7VEFTS19UWVBFX1RBR30+cmVtb3RlX2FnZW50PC8ke1RBU0tfVFlQRV9UQUd9PlxuPCR7U1RBVFVTX1RBR30+ZmFpbGVkPC8ke1NUQVRVU19UQUd9PlxuPCR7U1VNTUFSWV9UQUd9PlVsdHJhcGxhbiBmYWlsZWQ6ICR7cmVhc29ufTwvJHtTVU1NQVJZX1RBR30+XG48LyR7VEFTS19OT1RJRklDQVRJT05fVEFHfT5cblRoZSByZW1vdGUgVWx0cmFwbGFuIHNlc3Npb24gZGlkIG5vdCBwcm9kdWNlIGEgcGxhbiAoJHtyZWFzb259KS4gSW5zcGVjdCB0aGUgc2Vzc2lvbiBhdCAke3Nlc3Npb25Vcmx9IGFuZCB0ZWxsIHRoZSB1c2VyIHRvIHJldHJ5IGxvY2FsbHkgd2l0aCBwbGFuIG1vZGUuYFxuXG4gIGVucXVldWVQZW5kaW5nTm90aWZpY2F0aW9uKHsgdmFsdWU6IG1lc3NhZ2UsIG1vZGU6ICd0YXNrLW5vdGlmaWNhdGlvbicgfSlcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHJldmlldyBjb250ZW50IGZyb20gdGhlIHJlbW90ZSBzZXNzaW9uIGxvZy5cbiAqXG4gKiBUd28gcHJvZHVjZXJzLCB0d28gZXZlbnQgc2hhcGVzOlxuICogLSBidWdodW50ZXIgbW9kZTogcnVuX2h1bnQuc2ggaXMgYSBTZXNzaW9uU3RhcnQgaG9vazsgaXRzIGVjaG8gbGFuZHMgYXNcbiAqICAge3R5cGU6J3N5c3RlbScsIHN1YnR5cGU6J2hvb2tfcHJvZ3Jlc3MnLCBzdGRvdXQ6Jy4uLid9LiBDbGF1ZGUgbmV2ZXJcbiAqICAgdGFrZXMgYSB0dXJuIHNvIHRoZXJlIGFyZSB6ZXJvIGFzc2lzdGFudCBtZXNzYWdlcy5cbiAqIC0gcHJvbXB0IG1vZGU6IGEgcmVhbCBhc3Npc3RhbnQgdHVybiB3cmFwcyB0aGUgcmV2aWV3IGluIHRoZSB0YWcuXG4gKlxuICogU2NhbnMgaG9va19wcm9ncmVzcyBmaXJzdCBzaW5jZSBidWdodW50ZXIgaXMgdGhlIGludGVuZGVkIHByb2R1Y3Rpb24gcGF0aFxuICogYW5kIHByb21wdCBtb2RlIGlzIHRoZSBkZXYvZmFsbGJhY2suIE5ld2VzdC1maXJzdCBpbiBib3RoIGNhc2VzIOKAlCB0aGUgdGFnXG4gKiBhcHBlYXJzIG9uY2UgYXQgdGhlIGVuZCBvZiB0aGUgcnVuIHNvIHJldmVyc2UgaXRlcmF0aW9uIHNob3J0LWNpcmN1aXRzLlxuICovXG5mdW5jdGlvbiBleHRyYWN0UmV2aWV3RnJvbUxvZyhsb2c6IFNES01lc3NhZ2VbXSk6IHN0cmluZyB8IG51bGwge1xuICBmb3IgKGxldCBpID0gbG9nLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3QgbXNnID0gbG9nW2ldXG4gICAgLy8gVGhlIGZpbmFsIGVjaG8gYmVmb3JlIGhvb2sgZXhpdCBtYXkgbGFuZCBpbiBlaXRoZXIgdGhlIGxhc3RcbiAgICAvLyBob29rX3Byb2dyZXNzIG9yIHRoZSB0ZXJtaW5hbCBob29rX3Jlc3BvbnNlIGRlcGVuZGluZyBvbiBidWZmZXJpbmc7XG4gICAgLy8gYm90aCBoYXZlIGZsYXQgc3Rkb3V0LlxuICAgIGlmIChcbiAgICAgIG1zZz8udHlwZSA9PT0gJ3N5c3RlbScgJiZcbiAgICAgIChtc2cuc3VidHlwZSA9PT0gJ2hvb2tfcHJvZ3Jlc3MnIHx8IG1zZy5zdWJ0eXBlID09PSAnaG9va19yZXNwb25zZScpXG4gICAgKSB7XG4gICAgICBjb25zdCB0YWdnZWQgPSBleHRyYWN0VGFnKG1zZy5zdGRvdXQsIFJFTU9URV9SRVZJRVdfVEFHKVxuICAgICAgaWYgKHRhZ2dlZD8udHJpbSgpKSByZXR1cm4gdGFnZ2VkLnRyaW0oKVxuICAgIH1cbiAgfVxuXG4gIGZvciAobGV0IGkgPSBsb2cubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBtc2cgPSBsb2dbaV1cbiAgICBpZiAobXNnPy50eXBlICE9PSAnYXNzaXN0YW50JykgY29udGludWVcbiAgICBjb25zdCBmdWxsVGV4dCA9IGV4dHJhY3RUZXh0Q29udGVudChtc2cubWVzc2FnZS5jb250ZW50LCAnXFxuJylcbiAgICBjb25zdCB0YWdnZWQgPSBleHRyYWN0VGFnKGZ1bGxUZXh0LCBSRU1PVEVfUkVWSUVXX1RBRylcbiAgICBpZiAodGFnZ2VkPy50cmltKCkpIHJldHVybiB0YWdnZWQudHJpbSgpXG4gIH1cblxuICAvLyBIb29rLXN0ZG91dCBjb25jYXQgZmFsbGJhY2s6IGEgc2luZ2xlIGVjaG8gc2hvdWxkIGxhbmQgaW4gb25lIGV2ZW50LCBidXRcbiAgLy8gbGFyZ2UgSlNPTiBwYXlsb2FkcyBjYW4gZmx1c2ggYWNyb3NzIHR3byBpZiB0aGUgcGlwZSBidWZmZXIgZmlsbHNcbiAgLy8gbWlkLXdyaXRlLiBQZXItbWVzc2FnZSBzY2FuIGFib3ZlIG1pc3NlcyBhIHRhZyBzcGxpdCBhY3Jvc3MgZXZlbnRzLlxuICBjb25zdCBob29rU3Rkb3V0ID0gbG9nXG4gICAgLmZpbHRlcihcbiAgICAgIG1zZyA9PlxuICAgICAgICBtc2cudHlwZSA9PT0gJ3N5c3RlbScgJiZcbiAgICAgICAgKG1zZy5zdWJ0eXBlID09PSAnaG9va19wcm9ncmVzcycgfHwgbXNnLnN1YnR5cGUgPT09ICdob29rX3Jlc3BvbnNlJyksXG4gICAgKVxuICAgIC5tYXAobXNnID0+IG1zZy5zdGRvdXQpXG4gICAgLmpvaW4oJycpXG4gIGNvbnN0IGhvb2tUYWdnZWQgPSBleHRyYWN0VGFnKGhvb2tTdGRvdXQsIFJFTU9URV9SRVZJRVdfVEFHKVxuICBpZiAoaG9va1RhZ2dlZD8udHJpbSgpKSByZXR1cm4gaG9va1RhZ2dlZC50cmltKClcblxuICAvLyBGYWxsYmFjazogY29uY2F0ZW5hdGUgYWxsIGFzc2lzdGFudCB0ZXh0IGluIGNocm9ub2xvZ2ljYWwgb3JkZXIuXG4gIGNvbnN0IGFsbFRleHQgPSBsb2dcbiAgICAuZmlsdGVyKChtc2cpOiBtc2cgaXMgU0RLQXNzaXN0YW50TWVzc2FnZSA9PiBtc2cudHlwZSA9PT0gJ2Fzc2lzdGFudCcpXG4gICAgLm1hcChtc2cgPT4gZXh0cmFjdFRleHRDb250ZW50KG1zZy5tZXNzYWdlLmNvbnRlbnQsICdcXG4nKSlcbiAgICAuam9pbignXFxuJylcbiAgICAudHJpbSgpXG5cbiAgcmV0dXJuIGFsbFRleHQgfHwgbnVsbFxufVxuXG4vKipcbiAqIFRhZy1vbmx5IHZhcmlhbnQgb2YgZXh0cmFjdFJldmlld0Zyb21Mb2cgZm9yIGRlbHRhIHNjYW5uaW5nLlxuICpcbiAqIFJldHVybnMgbm9uLW51bGwgT05MWSB3aGVuIGFuIGV4cGxpY2l0IDxyZW1vdGUtcmV2aWV3PiB0YWcgaXMgZm91bmQuXG4gKiBVbmxpa2UgZXh0cmFjdFJldmlld0Zyb21Mb2csIHRoaXMgZG9lcyBOT1QgZmFsbCBiYWNrIHRvIGNvbmNhdGVuYXRlZFxuICogYXNzaXN0YW50IHRleHQuIFRoaXMgaXMgY3JpdGljYWwgZm9yIHRoZSBkZWx0YSBzY2FuOiBpbiBwcm9tcHQgbW9kZSxcbiAqIGVhcmx5IHVudGFnZ2VkIGFzc2lzdGFudCBtZXNzYWdlcyAoZS5nLiBcIkknbSBhbmFseXppbmcgdGhlIGRpZmYuLi5cIilcbiAqIHdvdWxkIHRyaWdnZXIgdGhlIGZhbGxiYWNrIGFuZCBwcmVtYXR1cmVseSBzZXQgY2FjaGVkUmV2aWV3Q29udGVudCxcbiAqIGNvbXBsZXRpbmcgdGhlIHJldmlldyBiZWZvcmUgdGhlIGFjdHVhbCB0YWdnZWQgb3V0cHV0IGFycml2ZXMuXG4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RSZXZpZXdUYWdGcm9tTG9nKGxvZzogU0RLTWVzc2FnZVtdKTogc3RyaW5nIHwgbnVsbCB7XG4gIC8vIGhvb2tfcHJvZ3Jlc3MgLyBob29rX3Jlc3BvbnNlIHBlci1tZXNzYWdlIHNjYW4gKGJ1Z2h1bnRlciBwYXRoKVxuICBmb3IgKGxldCBpID0gbG9nLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3QgbXNnID0gbG9nW2ldXG4gICAgaWYgKFxuICAgICAgbXNnPy50eXBlID09PSAnc3lzdGVtJyAmJlxuICAgICAgKG1zZy5zdWJ0eXBlID09PSAnaG9va19wcm9ncmVzcycgfHwgbXNnLnN1YnR5cGUgPT09ICdob29rX3Jlc3BvbnNlJylcbiAgICApIHtcbiAgICAgIGNvbnN0IHRhZ2dlZCA9IGV4dHJhY3RUYWcobXNnLnN0ZG91dCwgUkVNT1RFX1JFVklFV19UQUcpXG4gICAgICBpZiAodGFnZ2VkPy50cmltKCkpIHJldHVybiB0YWdnZWQudHJpbSgpXG4gICAgfVxuICB9XG5cbiAgLy8gYXNzaXN0YW50IHRleHQgcGVyLW1lc3NhZ2Ugc2NhbiAocHJvbXB0IG1vZGUpXG4gIGZvciAobGV0IGkgPSBsb2cubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBtc2cgPSBsb2dbaV1cbiAgICBpZiAobXNnPy50eXBlICE9PSAnYXNzaXN0YW50JykgY29udGludWVcbiAgICBjb25zdCBmdWxsVGV4dCA9IGV4dHJhY3RUZXh0Q29udGVudChtc2cubWVzc2FnZS5jb250ZW50LCAnXFxuJylcbiAgICBjb25zdCB0YWdnZWQgPSBleHRyYWN0VGFnKGZ1bGxUZXh0LCBSRU1PVEVfUkVWSUVXX1RBRylcbiAgICBpZiAodGFnZ2VkPy50cmltKCkpIHJldHVybiB0YWdnZWQudHJpbSgpXG4gIH1cblxuICAvLyBIb29rLXN0ZG91dCBjb25jYXQgZmFsbGJhY2sgZm9yIHNwbGl0IHRhZ3NcbiAgY29uc3QgaG9va1N0ZG91dCA9IGxvZ1xuICAgIC5maWx0ZXIoXG4gICAgICBtc2cgPT5cbiAgICAgICAgbXNnLnR5cGUgPT09ICdzeXN0ZW0nICYmXG4gICAgICAgIChtc2cuc3VidHlwZSA9PT0gJ2hvb2tfcHJvZ3Jlc3MnIHx8IG1zZy5zdWJ0eXBlID09PSAnaG9va19yZXNwb25zZScpLFxuICAgIClcbiAgICAubWFwKG1zZyA9PiBtc2cuc3Rkb3V0KVxuICAgIC5qb2luKCcnKVxuICBjb25zdCBob29rVGFnZ2VkID0gZXh0cmFjdFRhZyhob29rU3Rkb3V0LCBSRU1PVEVfUkVWSUVXX1RBRylcbiAgaWYgKGhvb2tUYWdnZWQ/LnRyaW0oKSkgcmV0dXJuIGhvb2tUYWdnZWQudHJpbSgpXG5cbiAgcmV0dXJuIG51bGxcbn1cblxuLyoqXG4gKiBFbnF1ZXVlIGEgcmVtb3RlLXJldmlldyBjb21wbGV0aW9uIG5vdGlmaWNhdGlvbi4gSW5qZWN0cyB0aGUgcmV2aWV3IHRleHRcbiAqIGRpcmVjdGx5IGludG8gdGhlIG1lc3NhZ2UgcXVldWUgc28gdGhlIGxvY2FsIG1vZGVsIHJlY2VpdmVzIGl0IG9uIHRoZSBuZXh0XG4gKiB0dXJuIOKAlCBubyBmaWxlIGluZGlyZWN0aW9uLCBubyBtb2RlIGNoYW5nZS4gU2Vzc2lvbiBpcyBrZXB0IGFsaXZlIHNvIHRoZVxuICogY2xhdWRlLmFpIFVSTCBzdGF5cyBhIGR1cmFibGUgcmVjb3JkIHRoZSB1c2VyIGNhbiByZXZpc2l0OyBUVEwgaGFuZGxlcyBjbGVhbnVwLlxuICovXG5mdW5jdGlvbiBlbnF1ZXVlUmVtb3RlUmV2aWV3Tm90aWZpY2F0aW9uKFxuICB0YXNrSWQ6IHN0cmluZyxcbiAgcmV2aWV3Q29udGVudDogc3RyaW5nLFxuICBzZXRBcHBTdGF0ZTogU2V0QXBwU3RhdGUsXG4pOiB2b2lkIHtcbiAgaWYgKCFtYXJrVGFza05vdGlmaWVkKHRhc2tJZCwgc2V0QXBwU3RhdGUpKSByZXR1cm5cblxuICBjb25zdCBtZXNzYWdlID0gYDwke1RBU0tfTk9USUZJQ0FUSU9OX1RBR30+XG48JHtUQVNLX0lEX1RBR30+JHt0YXNrSWR9PC8ke1RBU0tfSURfVEFHfT5cbjwke1RBU0tfVFlQRV9UQUd9PnJlbW90ZV9hZ2VudDwvJHtUQVNLX1RZUEVfVEFHfT5cbjwke1NUQVRVU19UQUd9PmNvbXBsZXRlZDwvJHtTVEFUVVNfVEFHfT5cbjwke1NVTU1BUllfVEFHfT5SZW1vdGUgcmV2aWV3IGNvbXBsZXRlZDwvJHtTVU1NQVJZX1RBR30+XG48LyR7VEFTS19OT1RJRklDQVRJT05fVEFHfT5cblRoZSByZW1vdGUgcmV2aWV3IHByb2R1Y2VkIHRoZSBmb2xsb3dpbmcgZmluZGluZ3M6XG5cbiR7cmV2aWV3Q29udGVudH1gXG5cbiAgZW5xdWV1ZVBlbmRpbmdOb3RpZmljYXRpb24oeyB2YWx1ZTogbWVzc2FnZSwgbW9kZTogJ3Rhc2stbm90aWZpY2F0aW9uJyB9KVxufVxuXG4vKipcbiAqIEVucXVldWUgYSByZW1vdGUtcmV2aWV3IGZhaWx1cmUgbm90aWZpY2F0aW9uLlxuICovXG5mdW5jdGlvbiBlbnF1ZXVlUmVtb3RlUmV2aWV3RmFpbHVyZU5vdGlmaWNhdGlvbihcbiAgdGFza0lkOiBzdHJpbmcsXG4gIHJlYXNvbjogc3RyaW5nLFxuICBzZXRBcHBTdGF0ZTogU2V0QXBwU3RhdGUsXG4pOiB2b2lkIHtcbiAgaWYgKCFtYXJrVGFza05vdGlmaWVkKHRhc2tJZCwgc2V0QXBwU3RhdGUpKSByZXR1cm5cblxuICBjb25zdCBtZXNzYWdlID0gYDwke1RBU0tfTk9USUZJQ0FUSU9OX1RBR30+XG48JHtUQVNLX0lEX1RBR30+JHt0YXNrSWR9PC8ke1RBU0tfSURfVEFHfT5cbjwke1RBU0tfVFlQRV9UQUd9PnJlbW90ZV9hZ2VudDwvJHtUQVNLX1RZUEVfVEFHfT5cbjwke1NUQVRVU19UQUd9PmZhaWxlZDwvJHtTVEFUVVNfVEFHfT5cbjwke1NVTU1BUllfVEFHfT5SZW1vdGUgcmV2aWV3IGZhaWxlZDogJHtyZWFzb259PC8ke1NVTU1BUllfVEFHfT5cbjwvJHtUQVNLX05PVElGSUNBVElPTl9UQUd9PlxuUmVtb3RlIHJldmlldyBkaWQgbm90IHByb2R1Y2Ugb3V0cHV0ICgke3JlYXNvbn0pLiBUZWxsIHRoZSB1c2VyIHRvIHJldHJ5IC91bHRyYXJldmlldywgb3IgdXNlIC9yZXZpZXcgZm9yIGEgbG9jYWwgcmV2aWV3IGluc3RlYWQuYFxuXG4gIGVucXVldWVQZW5kaW5nTm90aWZpY2F0aW9uKHsgdmFsdWU6IG1lc3NhZ2UsIG1vZGU6ICd0YXNrLW5vdGlmaWNhdGlvbicgfSlcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHRvZG8gbGlzdCBmcm9tIFNESyBtZXNzYWdlcyAoZmluZHMgbGFzdCBUb2RvV3JpdGUgdG9vbCB1c2UpLlxuICovXG5mdW5jdGlvbiBleHRyYWN0VG9kb0xpc3RGcm9tTG9nKGxvZzogU0RLTWVzc2FnZVtdKTogVG9kb0xpc3Qge1xuICBjb25zdCB0b2RvTGlzdE1lc3NhZ2UgPSBsb2cuZmluZExhc3QoXG4gICAgKG1zZyk6IG1zZyBpcyBTREtBc3Npc3RhbnRNZXNzYWdlID0+XG4gICAgICBtc2cudHlwZSA9PT0gJ2Fzc2lzdGFudCcgJiZcbiAgICAgIG1zZy5tZXNzYWdlLmNvbnRlbnQuc29tZShcbiAgICAgICAgYmxvY2sgPT4gYmxvY2sudHlwZSA9PT0gJ3Rvb2xfdXNlJyAmJiBibG9jay5uYW1lID09PSBUb2RvV3JpdGVUb29sLm5hbWUsXG4gICAgICApLFxuICApXG4gIGlmICghdG9kb0xpc3RNZXNzYWdlKSB7XG4gICAgcmV0dXJuIFtdXG4gIH1cblxuICBjb25zdCBpbnB1dCA9IHRvZG9MaXN0TWVzc2FnZS5tZXNzYWdlLmNvbnRlbnQuZmluZChcbiAgICAoYmxvY2spOiBibG9jayBpcyBUb29sVXNlQmxvY2sgPT5cbiAgICAgIGJsb2NrLnR5cGUgPT09ICd0b29sX3VzZScgJiYgYmxvY2submFtZSA9PT0gVG9kb1dyaXRlVG9vbC5uYW1lLFxuICApPy5pbnB1dFxuICBpZiAoIWlucHV0KSB7XG4gICAgcmV0dXJuIFtdXG4gIH1cblxuICBjb25zdCBwYXJzZWRJbnB1dCA9IFRvZG9Xcml0ZVRvb2wuaW5wdXRTY2hlbWEuc2FmZVBhcnNlKGlucHV0KVxuICBpZiAoIXBhcnNlZElucHV0LnN1Y2Nlc3MpIHtcbiAgICByZXR1cm4gW11cbiAgfVxuXG4gIHJldHVybiBwYXJzZWRJbnB1dC5kYXRhLnRvZG9zXG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSByZW1vdGUgYWdlbnQgdGFzayBpbiB0aGUgdW5pZmllZCB0YXNrIGZyYW1ld29yay5cbiAqIEJ1bmRsZXMgdGFzayBJRCBnZW5lcmF0aW9uLCBvdXRwdXQgaW5pdCwgc3RhdGUgY3JlYXRpb24sIHJlZ2lzdHJhdGlvbiwgYW5kIHBvbGxpbmcuXG4gKiBDYWxsZXJzIHJlbWFpbiByZXNwb25zaWJsZSBmb3IgY3VzdG9tIHByZS1yZWdpc3RyYXRpb24gbG9naWMgKGdpdCBkaWFsb2dzLCB0cmFuc2NyaXB0IHVwbG9hZCwgdGVsZXBvcnQgb3B0aW9ucykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclJlbW90ZUFnZW50VGFzayhvcHRpb25zOiB7XG4gIHJlbW90ZVRhc2tUeXBlOiBSZW1vdGVUYXNrVHlwZVxuICBzZXNzaW9uOiB7IGlkOiBzdHJpbmc7IHRpdGxlOiBzdHJpbmcgfVxuICBjb21tYW5kOiBzdHJpbmdcbiAgY29udGV4dDogVGFza0NvbnRleHRcbiAgdG9vbFVzZUlkPzogc3RyaW5nXG4gIGlzUmVtb3RlUmV2aWV3PzogYm9vbGVhblxuICBpc1VsdHJhcGxhbj86IGJvb2xlYW5cbiAgaXNMb25nUnVubmluZz86IGJvb2xlYW5cbiAgcmVtb3RlVGFza01ldGFkYXRhPzogUmVtb3RlVGFza01ldGFkYXRhXG59KToge1xuICB0YXNrSWQ6IHN0cmluZ1xuICBzZXNzaW9uSWQ6IHN0cmluZ1xuICBjbGVhbnVwOiAoKSA9PiB2b2lkXG59IHtcbiAgY29uc3Qge1xuICAgIHJlbW90ZVRhc2tUeXBlLFxuICAgIHNlc3Npb24sXG4gICAgY29tbWFuZCxcbiAgICBjb250ZXh0LFxuICAgIHRvb2xVc2VJZCxcbiAgICBpc1JlbW90ZVJldmlldyxcbiAgICBpc1VsdHJhcGxhbixcbiAgICBpc0xvbmdSdW5uaW5nLFxuICAgIHJlbW90ZVRhc2tNZXRhZGF0YSxcbiAgfSA9IG9wdGlvbnNcbiAgY29uc3QgdGFza0lkID0gZ2VuZXJhdGVUYXNrSWQoJ3JlbW90ZV9hZ2VudCcpXG5cbiAgLy8gQ3JlYXRlIHRoZSBvdXRwdXQgZmlsZSBiZWZvcmUgcmVnaXN0ZXJpbmcgdGhlIHRhc2suXG4gIC8vIFJlbW90ZUFnZW50VGFzayB1c2VzIGFwcGVuZFRhc2tPdXRwdXQoKSAobm90IFRhc2tPdXRwdXQpLCBzb1xuICAvLyB0aGUgZmlsZSBtdXN0IGV4aXN0IGZvciByZWFkZXJzIGJlZm9yZSBhbnkgb3V0cHV0IGFycml2ZXMuXG4gIHZvaWQgaW5pdFRhc2tPdXRwdXQodGFza0lkKVxuXG4gIGNvbnN0IHRhc2tTdGF0ZTogUmVtb3RlQWdlbnRUYXNrU3RhdGUgPSB7XG4gICAgLi4uY3JlYXRlVGFza1N0YXRlQmFzZSh0YXNrSWQsICdyZW1vdGVfYWdlbnQnLCBzZXNzaW9uLnRpdGxlLCB0b29sVXNlSWQpLFxuICAgIHR5cGU6ICdyZW1vdGVfYWdlbnQnLFxuICAgIHJlbW90ZVRhc2tUeXBlLFxuICAgIHN0YXR1czogJ3J1bm5pbmcnLFxuICAgIHNlc3Npb25JZDogc2Vzc2lvbi5pZCxcbiAgICBjb21tYW5kLFxuICAgIHRpdGxlOiBzZXNzaW9uLnRpdGxlLFxuICAgIHRvZG9MaXN0OiBbXSxcbiAgICBsb2c6IFtdLFxuICAgIGlzUmVtb3RlUmV2aWV3LFxuICAgIGlzVWx0cmFwbGFuLFxuICAgIGlzTG9uZ1J1bm5pbmcsXG4gICAgcG9sbFN0YXJ0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICByZW1vdGVUYXNrTWV0YWRhdGEsXG4gIH1cblxuICByZWdpc3RlclRhc2sodGFza1N0YXRlLCBjb250ZXh0LnNldEFwcFN0YXRlKVxuXG4gIC8vIFBlcnNpc3QgaWRlbnRpdHkgdG8gdGhlIHNlc3Npb24gc2lkZWNhciBzbyAtLXJlc3VtZSBjYW4gcmVjb25uZWN0IHRvXG4gIC8vIHN0aWxsLXJ1bm5pbmcgcmVtb3RlIHNlc3Npb25zLiBTdGF0dXMgaXMgbm90IHN0b3JlZCDigJQgaXQncyBmZXRjaGVkXG4gIC8vIGZyZXNoIGZyb20gQ0NSIG9uIHJlc3RvcmUuXG4gIHZvaWQgcGVyc2lzdFJlbW90ZUFnZW50TWV0YWRhdGEoe1xuICAgIHRhc2tJZCxcbiAgICByZW1vdGVUYXNrVHlwZSxcbiAgICBzZXNzaW9uSWQ6IHNlc3Npb24uaWQsXG4gICAgdGl0bGU6IHNlc3Npb24udGl0bGUsXG4gICAgY29tbWFuZCxcbiAgICBzcGF3bmVkQXQ6IERhdGUubm93KCksXG4gICAgdG9vbFVzZUlkLFxuICAgIGlzVWx0cmFwbGFuLFxuICAgIGlzUmVtb3RlUmV2aWV3LFxuICAgIGlzTG9uZ1J1bm5pbmcsXG4gICAgcmVtb3RlVGFza01ldGFkYXRhLFxuICB9KVxuXG4gIC8vIFVsdHJhcGxhbiBsaWZlY3ljbGUgaXMgb3duZWQgYnkgc3RhcnREZXRhY2hlZFBvbGwgaW4gdWx0cmFwbGFuLnRzeC4gR2VuZXJpY1xuICAvLyBwb2xsaW5nIHN0aWxsIHJ1bnMgc28gc2Vzc2lvbi5sb2cgcG9wdWxhdGVzIGZvciB0aGUgZGV0YWlsIHZpZXcncyBwcm9ncmVzc1xuICAvLyBjb3VudHM7IHRoZSByZXN1bHQtbG9va3VwIGd1YXJkIGJlbG93IHByZXZlbnRzIGVhcmx5IGNvbXBsZXRpb24uXG4gIC8vIFRPRE8oIzIzOTg1KTogZm9sZCBFeGl0UGxhbk1vZGVTY2FubmVyIGludG8gdGhpcyBwb2xsZXIsIGRyb3Agc3RhcnREZXRhY2hlZFBvbGwuXG4gIGNvbnN0IHN0b3BQb2xsaW5nID0gc3RhcnRSZW1vdGVTZXNzaW9uUG9sbGluZyh0YXNrSWQsIGNvbnRleHQpXG5cbiAgcmV0dXJuIHtcbiAgICB0YXNrSWQsXG4gICAgc2Vzc2lvbklkOiBzZXNzaW9uLmlkLFxuICAgIGNsZWFudXA6IHN0b3BQb2xsaW5nLFxuICB9XG59XG5cbi8qKlxuICogUmVzdG9yZSByZW1vdGUtYWdlbnQgdGFza3MgZnJvbSB0aGUgc2Vzc2lvbiBzaWRlY2FyIG9uIC0tcmVzdW1lLlxuICpcbiAqIFNjYW5zIHJlbW90ZS1hZ2VudHMvLCBmZXRjaGVzIGxpdmUgQ0NSIHN0YXR1cyBmb3IgZWFjaCwgcmVjb25zdHJ1Y3RzXG4gKiBSZW1vdGVBZ2VudFRhc2tTdGF0ZSBpbnRvIEFwcFN0YXRlLnRhc2tzLCBhbmQgcmVzdGFydHMgcG9sbGluZyBmb3Igc2Vzc2lvbnNcbiAqIHN0aWxsIHJ1bm5pbmcuIFNlc3Npb25zIHRoYXQgYXJlIGFyY2hpdmVkIG9yIDQwNCBoYXZlIHRoZWlyIHNpZGVjYXIgZmlsZVxuICogcmVtb3ZlZC4gTXVzdCBydW4gYWZ0ZXIgc3dpdGNoU2Vzc2lvbigpIHNvIGdldFNlc3Npb25JZCgpIHBvaW50cyBhdCB0aGVcbiAqIHJlc3VtZWQgc2Vzc2lvbidzIHNpZGVjYXIgZGlyZWN0b3J5LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzdG9yZVJlbW90ZUFnZW50VGFza3MoXG4gIGNvbnRleHQ6IFRhc2tDb250ZXh0LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgYXdhaXQgcmVzdG9yZVJlbW90ZUFnZW50VGFza3NJbXBsKGNvbnRleHQpXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBsb2dGb3JEZWJ1Z2dpbmcoYHJlc3RvcmVSZW1vdGVBZ2VudFRhc2tzIGZhaWxlZDogJHtTdHJpbmcoZSl9YClcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZXN0b3JlUmVtb3RlQWdlbnRUYXNrc0ltcGwoXG4gIGNvbnRleHQ6IFRhc2tDb250ZXh0LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHBlcnNpc3RlZCA9IGF3YWl0IGxpc3RSZW1vdGVBZ2VudE1ldGFkYXRhKClcbiAgaWYgKHBlcnNpc3RlZC5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGZvciAoY29uc3QgbWV0YSBvZiBwZXJzaXN0ZWQpIHtcbiAgICBsZXQgcmVtb3RlU3RhdHVzOiBzdHJpbmdcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGZldGNoU2Vzc2lvbihtZXRhLnNlc3Npb25JZClcbiAgICAgIHJlbW90ZVN0YXR1cyA9IHNlc3Npb24uc2Vzc2lvbl9zdGF0dXNcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBPbmx5IDQwNCBtZWFucyB0aGUgQ0NSIHNlc3Npb24gaXMgdHJ1bHkgZ29uZS4gQXV0aCBlcnJvcnMgKDQwMSxcbiAgICAgIC8vIG1pc3NpbmcgT0F1dGggdG9rZW4pIGFyZSByZWNvdmVyYWJsZSB2aWEgL2xvZ2luIOKAlCB0aGUgcmVtb3RlXG4gICAgICAvLyBzZXNzaW9uIGlzIHN0aWxsIHJ1bm5pbmcuIGZldGNoU2Vzc2lvbiB0aHJvd3MgcGxhaW4gRXJyb3IgZm9yIGFsbFxuICAgICAgLy8gNHh4ICh2YWxpZGF0ZVN0YXR1cyB0cmVhdHMgPDUwMCBhcyBzdWNjZXNzKSwgc28gaXNUcmFuc2llbnROZXR3b3JrRXJyb3JcbiAgICAgIC8vIGNhbid0IGRpc3Rpbmd1aXNoIHRoZW07IG1hdGNoIHRoZSA0MDQgbWVzc2FnZSBpbnN0ZWFkLlxuICAgICAgaWYgKGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm1lc3NhZ2Uuc3RhcnRzV2l0aCgnU2Vzc2lvbiBub3QgZm91bmQ6JykpIHtcbiAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgIGByZXN0b3JlUmVtb3RlQWdlbnRUYXNrczogZHJvcHBpbmcgJHttZXRhLnRhc2tJZH0gKDQwNDogJHtTdHJpbmcoZSl9KWAsXG4gICAgICAgIClcbiAgICAgICAgdm9pZCByZW1vdmVSZW1vdGVBZ2VudE1ldGFkYXRhKG1ldGEudGFza0lkKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgIGByZXN0b3JlUmVtb3RlQWdlbnRUYXNrczogc2tpcHBpbmcgJHttZXRhLnRhc2tJZH0gKHJlY292ZXJhYmxlOiAke1N0cmluZyhlKX0pYCxcbiAgICAgICAgKVxuICAgICAgfVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAocmVtb3RlU3RhdHVzID09PSAnYXJjaGl2ZWQnKSB7XG4gICAgICAvLyBTZXNzaW9uIGVuZGVkIHdoaWxlIHRoZSBsb2NhbCBjbGllbnQgd2FzIG9mZmxpbmUuIERvbid0IHJlc3VycmVjdC5cbiAgICAgIHZvaWQgcmVtb3ZlUmVtb3RlQWdlbnRNZXRhZGF0YShtZXRhLnRhc2tJZClcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgY29uc3QgdGFza1N0YXRlOiBSZW1vdGVBZ2VudFRhc2tTdGF0ZSA9IHtcbiAgICAgIC4uLmNyZWF0ZVRhc2tTdGF0ZUJhc2UoXG4gICAgICAgIG1ldGEudGFza0lkLFxuICAgICAgICAncmVtb3RlX2FnZW50JyxcbiAgICAgICAgbWV0YS50aXRsZSxcbiAgICAgICAgbWV0YS50b29sVXNlSWQsXG4gICAgICApLFxuICAgICAgdHlwZTogJ3JlbW90ZV9hZ2VudCcsXG4gICAgICByZW1vdGVUYXNrVHlwZTogaXNSZW1vdGVUYXNrVHlwZShtZXRhLnJlbW90ZVRhc2tUeXBlKVxuICAgICAgICA/IG1ldGEucmVtb3RlVGFza1R5cGVcbiAgICAgICAgOiAncmVtb3RlLWFnZW50JyxcbiAgICAgIHN0YXR1czogJ3J1bm5pbmcnLFxuICAgICAgc2Vzc2lvbklkOiBtZXRhLnNlc3Npb25JZCxcbiAgICAgIGNvbW1hbmQ6IG1ldGEuY29tbWFuZCxcbiAgICAgIHRpdGxlOiBtZXRhLnRpdGxlLFxuICAgICAgdG9kb0xpc3Q6IFtdLFxuICAgICAgbG9nOiBbXSxcbiAgICAgIGlzUmVtb3RlUmV2aWV3OiBtZXRhLmlzUmVtb3RlUmV2aWV3LFxuICAgICAgaXNVbHRyYXBsYW46IG1ldGEuaXNVbHRyYXBsYW4sXG4gICAgICBpc0xvbmdSdW5uaW5nOiBtZXRhLmlzTG9uZ1J1bm5pbmcsXG4gICAgICBzdGFydFRpbWU6IG1ldGEuc3Bhd25lZEF0LFxuICAgICAgcG9sbFN0YXJ0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgIHJlbW90ZVRhc2tNZXRhZGF0YTogbWV0YS5yZW1vdGVUYXNrTWV0YWRhdGEgYXNcbiAgICAgICAgfCBSZW1vdGVUYXNrTWV0YWRhdGFcbiAgICAgICAgfCB1bmRlZmluZWQsXG4gICAgfVxuXG4gICAgcmVnaXN0ZXJUYXNrKHRhc2tTdGF0ZSwgY29udGV4dC5zZXRBcHBTdGF0ZSlcbiAgICB2b2lkIGluaXRUYXNrT3V0cHV0KG1ldGEudGFza0lkKVxuICAgIHN0YXJ0UmVtb3RlU2Vzc2lvblBvbGxpbmcobWV0YS50YXNrSWQsIGNvbnRleHQpXG4gIH1cbn1cblxuLyoqXG4gKiBTdGFydCBwb2xsaW5nIGZvciByZW1vdGUgc2Vzc2lvbiB1cGRhdGVzLlxuICogUmV0dXJucyBhIGNsZWFudXAgZnVuY3Rpb24gdG8gc3RvcCBwb2xsaW5nLlxuICovXG5mdW5jdGlvbiBzdGFydFJlbW90ZVNlc3Npb25Qb2xsaW5nKFxuICB0YXNrSWQ6IHN0cmluZyxcbiAgY29udGV4dDogVGFza0NvbnRleHQsXG4pOiAoKSA9PiB2b2lkIHtcbiAgbGV0IGlzUnVubmluZyA9IHRydWVcbiAgY29uc3QgUE9MTF9JTlRFUlZBTF9NUyA9IDEwMDBcbiAgY29uc3QgUkVNT1RFX1JFVklFV19USU1FT1VUX01TID0gMzAgKiA2MCAqIDEwMDBcbiAgLy8gUmVtb3RlIHNlc3Npb25zIGZsaXAgdG8gJ2lkbGUnIGJldHdlZW4gdG9vbCB0dXJucy4gV2l0aCAxMDArIHJhcGlkXG4gIC8vIHR1cm5zLCBhIDFzIHBvbGwgV0lMTCBjYXRjaCBhIHRyYW5zaWVudCBpZGxlIG1pZC1ydW4uIFJlcXVpcmUgc3RhYmxlXG4gIC8vIGlkbGUgKG5vIGxvZyBncm93dGggZm9yIE4gY29uc2VjdXRpdmUgcG9sbHMpIGJlZm9yZSBiZWxpZXZpbmcgaXQuXG4gIGNvbnN0IFNUQUJMRV9JRExFX1BPTExTID0gNVxuICBsZXQgY29uc2VjdXRpdmVJZGxlUG9sbHMgPSAwXG4gIGxldCBsYXN0RXZlbnRJZDogc3RyaW5nIHwgbnVsbCA9IG51bGxcbiAgbGV0IGFjY3VtdWxhdGVkTG9nOiBTREtNZXNzYWdlW10gPSBbXVxuICAvLyBDYWNoZWQgYWNyb3NzIHRpY2tzIHNvIHdlIGRvbid0IHJlLXNjYW4gdGhlIGZ1bGwgbG9nLiBUYWcgYXBwZWFycyBvbmNlXG4gIC8vIGF0IGVuZCBvZiBydW47IHNjYW5uaW5nIG9ubHkgdGhlIGRlbHRhIChyZXNwb25zZS5uZXdFdmVudHMpIGlzIE8obmV3KS5cbiAgbGV0IGNhY2hlZFJldmlld0NvbnRlbnQ6IHN0cmluZyB8IG51bGwgPSBudWxsXG5cbiAgY29uc3QgcG9sbCA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICBpZiAoIWlzUnVubmluZykgcmV0dXJuXG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgYXBwU3RhdGUgPSBjb250ZXh0LmdldEFwcFN0YXRlKClcbiAgICAgIGNvbnN0IHRhc2sgPSBhcHBTdGF0ZS50YXNrcz8uW3Rhc2tJZF0gYXMgUmVtb3RlQWdlbnRUYXNrU3RhdGUgfCB1bmRlZmluZWRcbiAgICAgIGlmICghdGFzayB8fCB0YXNrLnN0YXR1cyAhPT0gJ3J1bm5pbmcnKSB7XG4gICAgICAgIC8vIFRhc2sgd2FzIGtpbGxlZCBleHRlcm5hbGx5IChUYXNrU3RvcFRvb2wpIG9yIGFscmVhZHkgdGVybWluYWwuXG4gICAgICAgIC8vIFNlc3Npb24gbGVmdCBhbGl2ZSBzbyB0aGUgY2xhdWRlLmFpIFVSTCBzdGF5cyB2YWxpZCDigJQgdGhlIHJ1bl9odW50LnNoXG4gICAgICAgIC8vIHBvc3Rfc3RhZ2UoKSBjYWxscyBsYW5kIGFzIGFzc2lzdGFudCBldmVudHMgdGhlcmUsIGFuZCB0aGUgdXNlciBtYXlcbiAgICAgICAgLy8gd2FudCB0byByZXZpc2l0IHRoZW0gYWZ0ZXIgY2xvc2luZyB0aGUgdGVybWluYWwuIFRUTCByZWFwcyBpdC5cbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcG9sbFJlbW90ZVNlc3Npb25FdmVudHMoXG4gICAgICAgIHRhc2suc2Vzc2lvbklkLFxuICAgICAgICBsYXN0RXZlbnRJZCxcbiAgICAgIClcbiAgICAgIGxhc3RFdmVudElkID0gcmVzcG9uc2UubGFzdEV2ZW50SWRcbiAgICAgIGNvbnN0IGxvZ0dyZXcgPSByZXNwb25zZS5uZXdFdmVudHMubGVuZ3RoID4gMFxuICAgICAgaWYgKGxvZ0dyZXcpIHtcbiAgICAgICAgYWNjdW11bGF0ZWRMb2cgPSBbLi4uYWNjdW11bGF0ZWRMb2csIC4uLnJlc3BvbnNlLm5ld0V2ZW50c11cbiAgICAgICAgY29uc3QgZGVsdGFUZXh0ID0gcmVzcG9uc2UubmV3RXZlbnRzXG4gICAgICAgICAgLm1hcChtc2cgPT4ge1xuICAgICAgICAgICAgaWYgKG1zZy50eXBlID09PSAnYXNzaXN0YW50Jykge1xuICAgICAgICAgICAgICByZXR1cm4gbXNnLm1lc3NhZ2UuY29udGVudFxuICAgICAgICAgICAgICAgIC5maWx0ZXIoYmxvY2sgPT4gYmxvY2sudHlwZSA9PT0gJ3RleHQnKVxuICAgICAgICAgICAgICAgIC5tYXAoYmxvY2sgPT4gKCd0ZXh0JyBpbiBibG9jayA/IGJsb2NrLnRleHQgOiAnJykpXG4gICAgICAgICAgICAgICAgLmpvaW4oJ1xcbicpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4ganNvblN0cmluZ2lmeShtc2cpXG4gICAgICAgICAgfSlcbiAgICAgICAgICAuam9pbignXFxuJylcbiAgICAgICAgaWYgKGRlbHRhVGV4dCkge1xuICAgICAgICAgIGFwcGVuZFRhc2tPdXRwdXQodGFza0lkLCBkZWx0YVRleHQgKyAnXFxuJylcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocmVzcG9uc2Uuc2Vzc2lvblN0YXR1cyA9PT0gJ2FyY2hpdmVkJykge1xuICAgICAgICB1cGRhdGVUYXNrU3RhdGU8UmVtb3RlQWdlbnRUYXNrU3RhdGU+KHRhc2tJZCwgY29udGV4dC5zZXRBcHBTdGF0ZSwgdCA9PlxuICAgICAgICAgIHQuc3RhdHVzID09PSAncnVubmluZydcbiAgICAgICAgICAgID8geyAuLi50LCBzdGF0dXM6ICdjb21wbGV0ZWQnLCBlbmRUaW1lOiBEYXRlLm5vdygpIH1cbiAgICAgICAgICAgIDogdCxcbiAgICAgICAgKVxuICAgICAgICBlbnF1ZXVlUmVtb3RlTm90aWZpY2F0aW9uKFxuICAgICAgICAgIHRhc2tJZCxcbiAgICAgICAgICB0YXNrLnRpdGxlLFxuICAgICAgICAgICdjb21wbGV0ZWQnLFxuICAgICAgICAgIGNvbnRleHQuc2V0QXBwU3RhdGUsXG4gICAgICAgICAgdGFzay50b29sVXNlSWQsXG4gICAgICAgIClcbiAgICAgICAgdm9pZCBldmljdFRhc2tPdXRwdXQodGFza0lkKVxuICAgICAgICB2b2lkIHJlbW92ZVJlbW90ZUFnZW50TWV0YWRhdGEodGFza0lkKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgY29uc3QgY2hlY2tlciA9IGNvbXBsZXRpb25DaGVja2Vycy5nZXQodGFzay5yZW1vdGVUYXNrVHlwZSlcbiAgICAgIGlmIChjaGVja2VyKSB7XG4gICAgICAgIGNvbnN0IGNvbXBsZXRpb25SZXN1bHQgPSBhd2FpdCBjaGVja2VyKHRhc2sucmVtb3RlVGFza01ldGFkYXRhKVxuICAgICAgICBpZiAoY29tcGxldGlvblJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgICAgIHVwZGF0ZVRhc2tTdGF0ZTxSZW1vdGVBZ2VudFRhc2tTdGF0ZT4oXG4gICAgICAgICAgICB0YXNrSWQsXG4gICAgICAgICAgICBjb250ZXh0LnNldEFwcFN0YXRlLFxuICAgICAgICAgICAgdCA9PlxuICAgICAgICAgICAgICB0LnN0YXR1cyA9PT0gJ3J1bm5pbmcnXG4gICAgICAgICAgICAgICAgPyB7IC4uLnQsIHN0YXR1czogJ2NvbXBsZXRlZCcsIGVuZFRpbWU6IERhdGUubm93KCkgfVxuICAgICAgICAgICAgICAgIDogdCxcbiAgICAgICAgICApXG4gICAgICAgICAgZW5xdWV1ZVJlbW90ZU5vdGlmaWNhdGlvbihcbiAgICAgICAgICAgIHRhc2tJZCxcbiAgICAgICAgICAgIGNvbXBsZXRpb25SZXN1bHQsXG4gICAgICAgICAgICAnY29tcGxldGVkJyxcbiAgICAgICAgICAgIGNvbnRleHQuc2V0QXBwU3RhdGUsXG4gICAgICAgICAgICB0YXNrLnRvb2xVc2VJZCxcbiAgICAgICAgICApXG4gICAgICAgICAgdm9pZCBldmljdFRhc2tPdXRwdXQodGFza0lkKVxuICAgICAgICAgIHZvaWQgcmVtb3ZlUmVtb3RlQWdlbnRNZXRhZGF0YSh0YXNrSWQpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVWx0cmFwbGFuOiByZXN1bHQoc3VjY2VzcykgZmlyZXMgYWZ0ZXIgZXZlcnkgQ0NSIHR1cm4sIHNvIGl0IG11c3Qgbm90XG4gICAgICAvLyBkcml2ZSBjb21wbGV0aW9uIOKAlCBzdGFydERldGFjaGVkUG9sbCBvd25zIHRoYXQgdmlhIEV4aXRQbGFuTW9kZSBzY2FuLlxuICAgICAgLy8gTG9uZy1ydW5uaW5nIG1vbml0b3JzIChhdXRvZml4LXByKSBlbWl0IHJlc3VsdCBwZXIgbm90aWZpY2F0aW9uIGN5Y2xlLFxuICAgICAgLy8gc28gdGhlIHNhbWUgc2tpcCBhcHBsaWVzLlxuICAgICAgY29uc3QgcmVzdWx0ID1cbiAgICAgICAgdGFzay5pc1VsdHJhcGxhbiB8fCB0YXNrLmlzTG9uZ1J1bm5pbmdcbiAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgIDogYWNjdW11bGF0ZWRMb2cuZmluZExhc3QobXNnID0+IG1zZy50eXBlID09PSAncmVzdWx0JylcblxuICAgICAgLy8gRm9yIHJlbW90ZS1yZXZpZXc6IDxyZW1vdGUtcmV2aWV3PiBpbiBob29rX3Byb2dyZXNzIHN0ZG91dCBpcyB0aGVcbiAgICAgIC8vIGJ1Z2h1bnRlciBwYXRoJ3MgY29tcGxldGlvbiBzaWduYWwuIFNjYW4gb25seSB0aGUgZGVsdGEgdG8gc3RheSBPKG5ldyk7XG4gICAgICAvLyB0YWcgYXBwZWFycyBvbmNlIGF0IGVuZCBvZiBydW4gc28gd2Ugd29uJ3QgbWlzcyBpdCBhY3Jvc3MgdGlja3MuXG4gICAgICAvLyBGb3IgdGhlIGZhaWx1cmUgc2lnbmFsLCBkZWJvdW5jZSBpZGxlOiByZW1vdGUgc2Vzc2lvbnMgYnJpZWZseSBmbGlwXG4gICAgICAvLyB0byAnaWRsZScgYmV0d2VlbiBldmVyeSB0b29sIHR1cm4sIHNvIGEgc2luZ2xlIGlkbGUgb2JzZXJ2YXRpb24gbWVhbnNcbiAgICAgIC8vIG5vdGhpbmcuIFJlcXVpcmUgU1RBQkxFX0lETEVfUE9MTFMgY29uc2VjdXRpdmUgaWRsZSBwb2xscyB3aXRoIG5vIGxvZ1xuICAgICAgLy8gZ3Jvd3RoLlxuICAgICAgaWYgKHRhc2suaXNSZW1vdGVSZXZpZXcgJiYgbG9nR3JldyAmJiBjYWNoZWRSZXZpZXdDb250ZW50ID09PSBudWxsKSB7XG4gICAgICAgIGNhY2hlZFJldmlld0NvbnRlbnQgPSBleHRyYWN0UmV2aWV3VGFnRnJvbUxvZyhyZXNwb25zZS5uZXdFdmVudHMpXG4gICAgICB9XG4gICAgICAvLyBQYXJzZSBsaXZlIHByb2dyZXNzIGNvdW50cyBmcm9tIHRoZSBvcmNoZXN0cmF0b3IncyBoZWFydGJlYXQgZWNob2VzLlxuICAgICAgLy8gaG9va19wcm9ncmVzcyBzdGRvdXQgaXMgY3VtdWxhdGl2ZSAoZXZlcnkgZWNobyBzaW5jZSBob29rIHN0YXJ0KSwgc29cbiAgICAgIC8vIGVhY2ggZXZlbnQgY29udGFpbnMgYWxsIHByb2dyZXNzIHRhZ3MuIEdyYWIgdGhlIExBU1Qgb2NjdXJyZW5jZSDigJRcbiAgICAgIC8vIGV4dHJhY3RUYWcgcmV0dXJucyB0aGUgZmlyc3QgbWF0Y2ggd2hpY2ggd291bGQgYWx3YXlzIGJlIHRoZSBlYXJsaWVzdFxuICAgICAgLy8gdmFsdWUgKDAvMCkuXG4gICAgICBsZXQgbmV3UHJvZ3Jlc3M6IFJlbW90ZUFnZW50VGFza1N0YXRlWydyZXZpZXdQcm9ncmVzcyddXG4gICAgICBpZiAodGFzay5pc1JlbW90ZVJldmlldyAmJiBsb2dHcmV3KSB7XG4gICAgICAgIGNvbnN0IG9wZW4gPSBgPCR7UkVNT1RFX1JFVklFV19QUk9HUkVTU19UQUd9PmBcbiAgICAgICAgY29uc3QgY2xvc2UgPSBgPC8ke1JFTU9URV9SRVZJRVdfUFJPR1JFU1NfVEFHfT5gXG4gICAgICAgIGZvciAoY29uc3QgZXYgb2YgcmVzcG9uc2UubmV3RXZlbnRzKSB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgZXYudHlwZSA9PT0gJ3N5c3RlbScgJiZcbiAgICAgICAgICAgIChldi5zdWJ0eXBlID09PSAnaG9va19wcm9ncmVzcycgfHwgZXYuc3VidHlwZSA9PT0gJ2hvb2tfcmVzcG9uc2UnKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgY29uc3QgcyA9IGV2LnN0ZG91dFxuICAgICAgICAgICAgY29uc3QgY2xvc2VBdCA9IHMubGFzdEluZGV4T2YoY2xvc2UpXG4gICAgICAgICAgICBjb25zdCBvcGVuQXQgPSBjbG9zZUF0ID09PSAtMSA/IC0xIDogcy5sYXN0SW5kZXhPZihvcGVuLCBjbG9zZUF0KVxuICAgICAgICAgICAgaWYgKG9wZW5BdCAhPT0gLTEgJiYgY2xvc2VBdCA+IG9wZW5BdCkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHAgPSBKU09OLnBhcnNlKFxuICAgICAgICAgICAgICAgICAgcy5zbGljZShvcGVuQXQgKyBvcGVuLmxlbmd0aCwgY2xvc2VBdCksXG4gICAgICAgICAgICAgICAgKSBhcyB7XG4gICAgICAgICAgICAgICAgICBzdGFnZT86ICdmaW5kaW5nJyB8ICd2ZXJpZnlpbmcnIHwgJ3N5bnRoZXNpemluZydcbiAgICAgICAgICAgICAgICAgIGJ1Z3NfZm91bmQ/OiBudW1iZXJcbiAgICAgICAgICAgICAgICAgIGJ1Z3NfdmVyaWZpZWQ/OiBudW1iZXJcbiAgICAgICAgICAgICAgICAgIGJ1Z3NfcmVmdXRlZD86IG51bWJlclxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBuZXdQcm9ncmVzcyA9IHtcbiAgICAgICAgICAgICAgICAgIHN0YWdlOiBwLnN0YWdlLFxuICAgICAgICAgICAgICAgICAgYnVnc0ZvdW5kOiBwLmJ1Z3NfZm91bmQgPz8gMCxcbiAgICAgICAgICAgICAgICAgIGJ1Z3NWZXJpZmllZDogcC5idWdzX3ZlcmlmaWVkID8/IDAsXG4gICAgICAgICAgICAgICAgICBidWdzUmVmdXRlZDogcC5idWdzX3JlZnV0ZWQgPz8gMCxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIC8vIGlnbm9yZSBtYWxmb3JtZWQgcHJvZ3Jlc3NcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gSG9vayBldmVudHMgY291bnQgYXMgb3V0cHV0IG9ubHkgZm9yIHJlbW90ZS1yZXZpZXcg4oCUIGJ1Z2h1bnRlcidzXG4gICAgICAvLyBTZXNzaW9uU3RhcnQgaG9vayBwcm9kdWNlcyB6ZXJvIGFzc2lzdGFudCB0dXJucyBzbyBzdGFibGVJZGxlIHdvdWxkXG4gICAgICAvLyBuZXZlciBhcm0gd2l0aG91dCB0aGlzLlxuICAgICAgY29uc3QgaGFzQW55T3V0cHV0ID0gYWNjdW11bGF0ZWRMb2cuc29tZShcbiAgICAgICAgbXNnID0+XG4gICAgICAgICAgbXNnLnR5cGUgPT09ICdhc3Npc3RhbnQnIHx8XG4gICAgICAgICAgKHRhc2suaXNSZW1vdGVSZXZpZXcgJiZcbiAgICAgICAgICAgIG1zZy50eXBlID09PSAnc3lzdGVtJyAmJlxuICAgICAgICAgICAgKG1zZy5zdWJ0eXBlID09PSAnaG9va19wcm9ncmVzcycgfHxcbiAgICAgICAgICAgICAgbXNnLnN1YnR5cGUgPT09ICdob29rX3Jlc3BvbnNlJykpLFxuICAgICAgKVxuICAgICAgaWYgKHJlc3BvbnNlLnNlc3Npb25TdGF0dXMgPT09ICdpZGxlJyAmJiAhbG9nR3JldyAmJiBoYXNBbnlPdXRwdXQpIHtcbiAgICAgICAgY29uc2VjdXRpdmVJZGxlUG9sbHMrK1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc2VjdXRpdmVJZGxlUG9sbHMgPSAwXG4gICAgICB9XG4gICAgICBjb25zdCBzdGFibGVJZGxlID0gY29uc2VjdXRpdmVJZGxlUG9sbHMgPj0gU1RBQkxFX0lETEVfUE9MTFNcbiAgICAgIC8vIHN0YWJsZUlkbGUgaXMgYSBwcm9tcHQtbW9kZSBjb21wbGV0aW9uIHNpZ25hbCAoQ2xhdWRlIHN0b3BzIHdyaXRpbmdcbiAgICAgIC8vIOKGkiBzZXNzaW9uIGlkbGVzIOKGkiBkb25lKS4gSW4gYnVnaHVudGVyIG1vZGUgdGhlIHNlc3Npb24gaXMgXCJpZGxlXCIgdGhlXG4gICAgICAvLyBlbnRpcmUgdGltZSB0aGUgU2Vzc2lvblN0YXJ0IGhvb2sgcnVuczsgdGhlIHByZXZpb3VzIGd1YXJkIGNoZWNrZWRcbiAgICAgIC8vIGhhc0Fzc2lzdGFudEV2ZW50cyBhcyBhIHByb21wdC1tb2RlIHByb3h5LCBidXQgcG9zdF9zdGFnZSgpIG5vd1xuICAgICAgLy8gd3JpdGVzIGFzc2lzdGFudCBldmVudHMgaW4gYnVnaHVudGVyIG1vZGUgdG9vLCBzbyB0aGF0IGNoZWNrXG4gICAgICAvLyBtaXNmaXJlcyBiZXR3ZWVuIGhlYXJ0YmVhdHMuIFByZXNlbmNlIG9mIGEgU2Vzc2lvblN0YXJ0IGhvb2sgZXZlbnRcbiAgICAgIC8vIGlzIHRoZSBkaXNjcmltaW5hdG9yIOKAlCBidWdodW50ZXIgbW9kZSBhbHdheXMgaGFzIG9uZSAocnVuX2h1bnQuc2gpLFxuICAgICAgLy8gcHJvbXB0IG1vZGUgbmV2ZXIgZG9lcyDigJQgYW5kIGl0IGFycml2ZXMgYmVmb3JlIHRoZSBraWNrb2ZmXG4gICAgICAvLyBwb3N0X3N0YWdlIHNvIHRoZXJlJ3Mgbm8gcmFjZS4gV2hlbiB0aGUgaG9vayBpcyBydW5uaW5nLCBvbmx5IHRoZVxuICAgICAgLy8gPHJlbW90ZS1yZXZpZXc+IHRhZyBvciB0aGUgMzBtaW4gdGltZW91dCBjb21wbGV0ZSB0aGUgdGFzay5cbiAgICAgIC8vIEZpbHRlcmluZyBvbiBob29rX2V2ZW50IGF2b2lkcyBhICh0aGVvcmV0aWNhbCkgbm9uLVNlc3Npb25TdGFydCBob29rXG4gICAgICAvLyBpbiBwcm9tcHQgbW9kZSBmcm9tIGJsb2NraW5nIHN0YWJsZUlkbGUg4oCUIHRoZSBjb2RlX3JldmlldyBjb250YWluZXJcbiAgICAgIC8vIG9ubHkgcmVnaXN0ZXJzIFNlc3Npb25TdGFydCwgYnV0IHRoZSAzMG1pbi1oYW5nIGZhaWx1cmUgbW9kZSBpc1xuICAgICAgLy8gd29ydGggZGVmZW5kaW5nIGFnYWluc3QuXG4gICAgICBjb25zdCBoYXNTZXNzaW9uU3RhcnRIb29rID0gYWNjdW11bGF0ZWRMb2cuc29tZShcbiAgICAgICAgbSA9PlxuICAgICAgICAgIG0udHlwZSA9PT0gJ3N5c3RlbScgJiZcbiAgICAgICAgICAobS5zdWJ0eXBlID09PSAnaG9va19zdGFydGVkJyB8fFxuICAgICAgICAgICAgbS5zdWJ0eXBlID09PSAnaG9va19wcm9ncmVzcycgfHxcbiAgICAgICAgICAgIG0uc3VidHlwZSA9PT0gJ2hvb2tfcmVzcG9uc2UnKSAmJlxuICAgICAgICAgIChtIGFzIHsgaG9va19ldmVudD86IHN0cmluZyB9KS5ob29rX2V2ZW50ID09PSAnU2Vzc2lvblN0YXJ0JyxcbiAgICAgIClcbiAgICAgIGNvbnN0IGhhc0Fzc2lzdGFudEV2ZW50cyA9IGFjY3VtdWxhdGVkTG9nLnNvbWUoXG4gICAgICAgIG0gPT4gbS50eXBlID09PSAnYXNzaXN0YW50JyxcbiAgICAgIClcbiAgICAgIGNvbnN0IHNlc3Npb25Eb25lID1cbiAgICAgICAgdGFzay5pc1JlbW90ZVJldmlldyAmJlxuICAgICAgICAoY2FjaGVkUmV2aWV3Q29udGVudCAhPT0gbnVsbCB8fFxuICAgICAgICAgICghaGFzU2Vzc2lvblN0YXJ0SG9vayAmJiBzdGFibGVJZGxlICYmIGhhc0Fzc2lzdGFudEV2ZW50cykpXG4gICAgICBjb25zdCByZXZpZXdUaW1lZE91dCA9XG4gICAgICAgIHRhc2suaXNSZW1vdGVSZXZpZXcgJiZcbiAgICAgICAgRGF0ZS5ub3coKSAtIHRhc2sucG9sbFN0YXJ0ZWRBdCA+IFJFTU9URV9SRVZJRVdfVElNRU9VVF9NU1xuICAgICAgY29uc3QgbmV3U3RhdHVzID0gcmVzdWx0XG4gICAgICAgID8gcmVzdWx0LnN1YnR5cGUgPT09ICdzdWNjZXNzJ1xuICAgICAgICAgID8gKCdjb21wbGV0ZWQnIGFzIGNvbnN0KVxuICAgICAgICAgIDogKCdmYWlsZWQnIGFzIGNvbnN0KVxuICAgICAgICA6IHNlc3Npb25Eb25lIHx8IHJldmlld1RpbWVkT3V0XG4gICAgICAgICAgPyAoJ2NvbXBsZXRlZCcgYXMgY29uc3QpXG4gICAgICAgICAgOiBhY2N1bXVsYXRlZExvZy5sZW5ndGggPiAwXG4gICAgICAgICAgICA/ICgncnVubmluZycgYXMgY29uc3QpXG4gICAgICAgICAgICA6ICgnc3RhcnRpbmcnIGFzIGNvbnN0KVxuXG4gICAgICAvLyBVcGRhdGUgdGFzayBzdGF0ZS4gR3VhcmQgYWdhaW5zdCB0ZXJtaW5hbCBzdGF0ZXMg4oCUIGlmIHN0b3BUYXNrIHJhY2VkXG4gICAgICAvLyB3aGlsZSBwb2xsUmVtb3RlU2Vzc2lvbkV2ZW50cyB3YXMgaW4tZmxpZ2h0IChzdGF0dXMgc2V0IHRvICdraWxsZWQnLFxuICAgICAgLy8gbm90aWZpZWQgc2V0IHRvIHRydWUpLCBiYWlsIHdpdGhvdXQgb3ZlcndyaXRpbmcgc3RhdHVzIG9yIHByb2NlZWRpbmcgdG9cbiAgICAgIC8vIHNpZGUgZWZmZWN0cyAobm90aWZpY2F0aW9uLCBwZXJtaXNzaW9uLW1vZGUgZmxpcCkuXG4gICAgICBsZXQgcmFjZVRlcm1pbmF0ZWQgPSBmYWxzZVxuICAgICAgdXBkYXRlVGFza1N0YXRlPFJlbW90ZUFnZW50VGFza1N0YXRlPihcbiAgICAgICAgdGFza0lkLFxuICAgICAgICBjb250ZXh0LnNldEFwcFN0YXRlLFxuICAgICAgICBwcmV2VGFzayA9PiB7XG4gICAgICAgICAgaWYgKHByZXZUYXNrLnN0YXR1cyAhPT0gJ3J1bm5pbmcnKSB7XG4gICAgICAgICAgICByYWNlVGVybWluYXRlZCA9IHRydWVcbiAgICAgICAgICAgIHJldHVybiBwcmV2VGFza1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBObyBsb2cgZ3Jvd3RoIGFuZCBzdGF0dXMgdW5jaGFuZ2VkIOKGkiBub3RoaW5nIHRvIHJlcG9ydC4gUmV0dXJuXG4gICAgICAgICAgLy8gc2FtZSByZWYgc28gdXBkYXRlVGFza1N0YXRlIHNraXBzIHRoZSBzcHJlYWQgYW5kIDE4IHMudGFza3NcbiAgICAgICAgICAvLyBzdWJzY3JpYmVycyAoUkVQTCwgU3Bpbm5lciwgUHJvbXB0SW5wdXQsIC4uLikgZG9uJ3QgcmUtcmVuZGVyLlxuICAgICAgICAgIC8vIG5ld1Byb2dyZXNzIG9ubHkgYXJyaXZlcyB2aWEgbG9nIGdyb3d0aCAoaGVhcnRiZWF0IGVjaG8gaXMgYVxuICAgICAgICAgIC8vIGhvb2tfcHJvZ3Jlc3MgZXZlbnQpLCBzbyAhbG9nR3JldyBhbHJlYWR5IGNvdmVycyBuby11cGRhdGUuXG4gICAgICAgICAgY29uc3Qgc3RhdHVzVW5jaGFuZ2VkID1cbiAgICAgICAgICAgIG5ld1N0YXR1cyA9PT0gJ3J1bm5pbmcnIHx8IG5ld1N0YXR1cyA9PT0gJ3N0YXJ0aW5nJ1xuICAgICAgICAgIGlmICghbG9nR3JldyAmJiBzdGF0dXNVbmNoYW5nZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmV2VGFza1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4ucHJldlRhc2ssXG4gICAgICAgICAgICBzdGF0dXM6IG5ld1N0YXR1cyA9PT0gJ3N0YXJ0aW5nJyA/ICdydW5uaW5nJyA6IG5ld1N0YXR1cyxcbiAgICAgICAgICAgIGxvZzogYWNjdW11bGF0ZWRMb2csXG4gICAgICAgICAgICAvLyBPbmx5IHJlLXNjYW4gZm9yIFRvZG9Xcml0ZSB3aGVuIGxvZyBncmV3IOKAlCBsb2cgaXMgYXBwZW5kLW9ubHksXG4gICAgICAgICAgICAvLyBzbyBubyBncm93dGggbWVhbnMgbm8gbmV3IHRvb2xfdXNlIGJsb2Nrcy4gQXZvaWRzIGZpbmRMYXN0ICtcbiAgICAgICAgICAgIC8vIHNvbWUgKyBmaW5kICsgc2FmZVBhcnNlIGV2ZXJ5IHNlY29uZCB3aGVuIGlkbGUuXG4gICAgICAgICAgICB0b2RvTGlzdDogbG9nR3Jld1xuICAgICAgICAgICAgICA/IGV4dHJhY3RUb2RvTGlzdEZyb21Mb2coYWNjdW11bGF0ZWRMb2cpXG4gICAgICAgICAgICAgIDogcHJldlRhc2sudG9kb0xpc3QsXG4gICAgICAgICAgICByZXZpZXdQcm9ncmVzczogbmV3UHJvZ3Jlc3MgPz8gcHJldlRhc2sucmV2aWV3UHJvZ3Jlc3MsXG4gICAgICAgICAgICBlbmRUaW1lOlxuICAgICAgICAgICAgICByZXN1bHQgfHwgc2Vzc2lvbkRvbmUgfHwgcmV2aWV3VGltZWRPdXQgPyBEYXRlLm5vdygpIDogdW5kZWZpbmVkLFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIClcbiAgICAgIGlmIChyYWNlVGVybWluYXRlZCkgcmV0dXJuXG5cbiAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9uIGlmIHRhc2sgY29tcGxldGVkIG9yIHRpbWVkIG91dFxuICAgICAgaWYgKHJlc3VsdCB8fCBzZXNzaW9uRG9uZSB8fCByZXZpZXdUaW1lZE91dCkge1xuICAgICAgICBjb25zdCBmaW5hbFN0YXR1cyA9XG4gICAgICAgICAgcmVzdWx0ICYmIHJlc3VsdC5zdWJ0eXBlICE9PSAnc3VjY2VzcycgPyAnZmFpbGVkJyA6ICdjb21wbGV0ZWQnXG5cbiAgICAgICAgLy8gRm9yIHJlbW90ZS1yZXZpZXcgdGFza3M6IGluamVjdCB0aGUgcmV2aWV3IHRleHQgZGlyZWN0bHkgaW50byB0aGVcbiAgICAgICAgLy8gbWVzc2FnZSBxdWV1ZS4gTm8gbW9kZSBjaGFuZ2UsIG5vIGZpbGUgaW5kaXJlY3Rpb24g4oCUIHRoZSBsb2NhbCBtb2RlbFxuICAgICAgICAvLyBqdXN0IHNlZXMgdGhlIHJldmlldyBhcHBlYXIgYXMgYSB0YXNrLW5vdGlmaWNhdGlvbiBvbiBpdHMgbmV4dCB0dXJuLlxuICAgICAgICAvLyBTZXNzaW9uIGtlcHQgYWxpdmUg4oCUIHJ1bl9odW50LnNoJ3MgcG9zdF9zdGFnZSgpIGhhcyBhbHJlYWR5IHdyaXR0ZW5cbiAgICAgICAgLy8gdGhlIGZvcm1hdHRlZCBmaW5kaW5ncyBhcyBhbiBhc3Npc3RhbnQgZXZlbnQsIHNvIHRoZSBjbGF1ZGUuYWkgVVJMXG4gICAgICAgIC8vIHN0YXlzIGEgZHVyYWJsZSByZWNvcmQgdGhlIHVzZXIgY2FuIHJldmlzaXQuIFRUTCBoYW5kbGVzIGNsZWFudXAuXG4gICAgICAgIGlmICh0YXNrLmlzUmVtb3RlUmV2aWV3KSB7XG4gICAgICAgICAgLy8gY2FjaGVkUmV2aWV3Q29udGVudCBoaXQgdGhlIHRhZyBpbiB0aGUgZGVsdGEgc2Nhbi4gRnVsbC1sb2cgc2NhblxuICAgICAgICAgIC8vIGNhdGNoZXMgdGhlIHN0YWJsZUlkbGUgcGF0aCB3aGVyZSB0aGUgdGFnIGFycml2ZWQgaW4gYW4gZWFybGllclxuICAgICAgICAgIC8vIHRpY2sgYnV0IHRoZSBkZWx0YSBzY2FuIHdhc24ndCB3aXJlZCB5ZXQgKGZpcnN0IHBvbGwgYWZ0ZXIgcmVzdW1lKS5cbiAgICAgICAgICBjb25zdCByZXZpZXdDb250ZW50ID1cbiAgICAgICAgICAgIGNhY2hlZFJldmlld0NvbnRlbnQgPz8gZXh0cmFjdFJldmlld0Zyb21Mb2coYWNjdW11bGF0ZWRMb2cpXG4gICAgICAgICAgaWYgKHJldmlld0NvbnRlbnQgJiYgZmluYWxTdGF0dXMgPT09ICdjb21wbGV0ZWQnKSB7XG4gICAgICAgICAgICBlbnF1ZXVlUmVtb3RlUmV2aWV3Tm90aWZpY2F0aW9uKFxuICAgICAgICAgICAgICB0YXNrSWQsXG4gICAgICAgICAgICAgIHJldmlld0NvbnRlbnQsXG4gICAgICAgICAgICAgIGNvbnRleHQuc2V0QXBwU3RhdGUsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICB2b2lkIGV2aWN0VGFza091dHB1dCh0YXNrSWQpXG4gICAgICAgICAgICB2b2lkIHJlbW92ZVJlbW90ZUFnZW50TWV0YWRhdGEodGFza0lkKVxuICAgICAgICAgICAgcmV0dXJuIC8vIFN0b3AgcG9sbGluZ1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5vIG91dHB1dCBvciByZW1vdGUgZXJyb3Ig4oCUIG1hcmsgZmFpbGVkIHdpdGggYSByZXZpZXctc3BlY2lmaWMgbWVzc2FnZS5cbiAgICAgICAgICB1cGRhdGVUYXNrU3RhdGUodGFza0lkLCBjb250ZXh0LnNldEFwcFN0YXRlLCB0ID0+ICh7XG4gICAgICAgICAgICAuLi50LFxuICAgICAgICAgICAgc3RhdHVzOiAnZmFpbGVkJyxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICBjb25zdCByZWFzb24gPVxuICAgICAgICAgICAgcmVzdWx0ICYmIHJlc3VsdC5zdWJ0eXBlICE9PSAnc3VjY2VzcydcbiAgICAgICAgICAgICAgPyAncmVtb3RlIHNlc3Npb24gcmV0dXJuZWQgYW4gZXJyb3InXG4gICAgICAgICAgICAgIDogcmV2aWV3VGltZWRPdXQgJiYgIXNlc3Npb25Eb25lXG4gICAgICAgICAgICAgICAgPyAncmVtb3RlIHNlc3Npb24gZXhjZWVkZWQgMzAgbWludXRlcydcbiAgICAgICAgICAgICAgICA6ICdubyByZXZpZXcgb3V0cHV0IOKAlCBvcmNoZXN0cmF0b3IgbWF5IGhhdmUgZXhpdGVkIGVhcmx5J1xuICAgICAgICAgIGVucXVldWVSZW1vdGVSZXZpZXdGYWlsdXJlTm90aWZpY2F0aW9uKFxuICAgICAgICAgICAgdGFza0lkLFxuICAgICAgICAgICAgcmVhc29uLFxuICAgICAgICAgICAgY29udGV4dC5zZXRBcHBTdGF0ZSxcbiAgICAgICAgICApXG4gICAgICAgICAgdm9pZCBldmljdFRhc2tPdXRwdXQodGFza0lkKVxuICAgICAgICAgIHZvaWQgcmVtb3ZlUmVtb3RlQWdlbnRNZXRhZGF0YSh0YXNrSWQpXG4gICAgICAgICAgcmV0dXJuIC8vIFN0b3AgcG9sbGluZ1xuICAgICAgICB9XG5cbiAgICAgICAgZW5xdWV1ZVJlbW90ZU5vdGlmaWNhdGlvbihcbiAgICAgICAgICB0YXNrSWQsXG4gICAgICAgICAgdGFzay50aXRsZSxcbiAgICAgICAgICBmaW5hbFN0YXR1cyxcbiAgICAgICAgICBjb250ZXh0LnNldEFwcFN0YXRlLFxuICAgICAgICAgIHRhc2sudG9vbFVzZUlkLFxuICAgICAgICApXG4gICAgICAgIHZvaWQgZXZpY3RUYXNrT3V0cHV0KHRhc2tJZClcbiAgICAgICAgdm9pZCByZW1vdmVSZW1vdGVBZ2VudE1ldGFkYXRhKHRhc2tJZClcbiAgICAgICAgcmV0dXJuIC8vIFN0b3AgcG9sbGluZ1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dFcnJvcihlcnJvcilcbiAgICAgIC8vIFJlc2V0IHNvIGFuIEFQSSBlcnJvciBkb2Vzbid0IGxldCBub24tY29uc2VjdXRpdmUgaWRsZSBwb2xscyBhY2N1bXVsYXRlLlxuICAgICAgY29uc2VjdXRpdmVJZGxlUG9sbHMgPSAwXG5cbiAgICAgIC8vIENoZWNrIHJldmlldyB0aW1lb3V0IGV2ZW4gd2hlbiB0aGUgQVBJIGNhbGwgZmFpbHMg4oCUIHdpdGhvdXQgdGhpcyxcbiAgICAgIC8vIHBlcnNpc3RlbnQgQVBJIGVycm9ycyBza2lwIHRoZSB0aW1lb3V0IGNoZWNrIGFuZCBwb2xsIGZvcmV2ZXIuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBhcHBTdGF0ZSA9IGNvbnRleHQuZ2V0QXBwU3RhdGUoKVxuICAgICAgICBjb25zdCB0YXNrID0gYXBwU3RhdGUudGFza3M/Llt0YXNrSWRdIGFzXG4gICAgICAgICAgfCBSZW1vdGVBZ2VudFRhc2tTdGF0ZVxuICAgICAgICAgIHwgdW5kZWZpbmVkXG4gICAgICAgIGlmIChcbiAgICAgICAgICB0YXNrPy5pc1JlbW90ZVJldmlldyAmJlxuICAgICAgICAgIHRhc2suc3RhdHVzID09PSAncnVubmluZycgJiZcbiAgICAgICAgICBEYXRlLm5vdygpIC0gdGFzay5wb2xsU3RhcnRlZEF0ID4gUkVNT1RFX1JFVklFV19USU1FT1VUX01TXG4gICAgICAgICkge1xuICAgICAgICAgIHVwZGF0ZVRhc2tTdGF0ZSh0YXNrSWQsIGNvbnRleHQuc2V0QXBwU3RhdGUsIHQgPT4gKHtcbiAgICAgICAgICAgIC4uLnQsXG4gICAgICAgICAgICBzdGF0dXM6ICdmYWlsZWQnLFxuICAgICAgICAgICAgZW5kVGltZTogRGF0ZS5ub3coKSxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICBlbnF1ZXVlUmVtb3RlUmV2aWV3RmFpbHVyZU5vdGlmaWNhdGlvbihcbiAgICAgICAgICAgIHRhc2tJZCxcbiAgICAgICAgICAgICdyZW1vdGUgc2Vzc2lvbiBleGNlZWRlZCAzMCBtaW51dGVzJyxcbiAgICAgICAgICAgIGNvbnRleHQuc2V0QXBwU3RhdGUsXG4gICAgICAgICAgKVxuICAgICAgICAgIHZvaWQgZXZpY3RUYXNrT3V0cHV0KHRhc2tJZClcbiAgICAgICAgICB2b2lkIHJlbW92ZVJlbW90ZUFnZW50TWV0YWRhdGEodGFza0lkKVxuICAgICAgICAgIHJldHVybiAvLyBTdG9wIHBvbGxpbmdcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIEJlc3QgZWZmb3J0IOKAlCBpZiBnZXRBcHBTdGF0ZSBmYWlscywgY29udGludWUgcG9sbGluZ1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvbnRpbnVlIHBvbGxpbmdcbiAgICBpZiAoaXNSdW5uaW5nKSB7XG4gICAgICBzZXRUaW1lb3V0KHBvbGwsIFBPTExfSU5URVJWQUxfTVMpXG4gICAgfVxuICB9XG5cbiAgLy8gU3RhcnQgcG9sbGluZ1xuICB2b2lkIHBvbGwoKVxuXG4gIC8vIFJldHVybiBjbGVhbnVwIGZ1bmN0aW9uXG4gIHJldHVybiAoKSA9PiB7XG4gICAgaXNSdW5uaW5nID0gZmFsc2VcbiAgfVxufVxuXG4vKipcbiAqIFJlbW90ZUFnZW50VGFzayAtIEhhbmRsZXMgcmVtb3RlIENsYXVkZS5haSBzZXNzaW9uIGV4ZWN1dGlvbi5cbiAqXG4gKiBSZXBsYWNlcyB0aGUgQmFja2dyb3VuZFJlbW90ZVNlc3Npb24gaW1wbGVtZW50YXRpb24gZnJvbTpcbiAqIC0gc3JjL3V0aWxzL2JhY2tncm91bmQvcmVtb3RlL3JlbW90ZVNlc3Npb24udHNcbiAqIC0gc3JjL2NvbXBvbmVudHMvdGFza3MvQmFja2dyb3VuZFRhc2tTdGF0dXMudHN4IChwb2xsaW5nIGxvZ2ljKVxuICovXG5leHBvcnQgY29uc3QgUmVtb3RlQWdlbnRUYXNrOiBUYXNrID0ge1xuICBuYW1lOiAnUmVtb3RlQWdlbnRUYXNrJyxcbiAgdHlwZTogJ3JlbW90ZV9hZ2VudCcsXG4gIGFzeW5jIGtpbGwodGFza0lkLCBzZXRBcHBTdGF0ZSkge1xuICAgIGxldCB0b29sVXNlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgIGxldCBkZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgbGV0IHNlc3Npb25JZDogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgbGV0IGtpbGxlZCA9IGZhbHNlXG4gICAgdXBkYXRlVGFza1N0YXRlPFJlbW90ZUFnZW50VGFza1N0YXRlPih0YXNrSWQsIHNldEFwcFN0YXRlLCB0YXNrID0+IHtcbiAgICAgIGlmICh0YXNrLnN0YXR1cyAhPT0gJ3J1bm5pbmcnKSB7XG4gICAgICAgIHJldHVybiB0YXNrXG4gICAgICB9XG4gICAgICB0b29sVXNlSWQgPSB0YXNrLnRvb2xVc2VJZFxuICAgICAgZGVzY3JpcHRpb24gPSB0YXNrLmRlc2NyaXB0aW9uXG4gICAgICBzZXNzaW9uSWQgPSB0YXNrLnNlc3Npb25JZFxuICAgICAga2lsbGVkID0gdHJ1ZVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4udGFzayxcbiAgICAgICAgc3RhdHVzOiAna2lsbGVkJyxcbiAgICAgICAgbm90aWZpZWQ6IHRydWUsXG4gICAgICAgIGVuZFRpbWU6IERhdGUubm93KCksXG4gICAgICB9XG4gICAgfSlcblxuICAgIC8vIENsb3NlIHRoZSB0YXNrX3N0YXJ0ZWQgYm9va2VuZCBmb3IgU0RLIGNvbnN1bWVycy4gVGhlIHBvbGwgbG9vcCdzXG4gICAgLy8gZWFybHktcmV0dXJuIHdoZW4gc3RhdHVzIT09J3J1bm5pbmcnIHdvbid0IGVtaXQgYSBub3RpZmljYXRpb24uXG4gICAgaWYgKGtpbGxlZCkge1xuICAgICAgZW1pdFRhc2tUZXJtaW5hdGVkU2RrKHRhc2tJZCwgJ3N0b3BwZWQnLCB7XG4gICAgICAgIHRvb2xVc2VJZCxcbiAgICAgICAgc3VtbWFyeTogZGVzY3JpcHRpb24sXG4gICAgICB9KVxuICAgICAgLy8gQXJjaGl2ZSB0aGUgcmVtb3RlIHNlc3Npb24gc28gaXQgc3RvcHMgY29uc3VtaW5nIGNsb3VkIHJlc291cmNlcy5cbiAgICAgIGlmIChzZXNzaW9uSWQpIHtcbiAgICAgICAgdm9pZCBhcmNoaXZlUmVtb3RlU2Vzc2lvbihzZXNzaW9uSWQpLmNhdGNoKGUgPT5cbiAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoYFJlbW90ZUFnZW50VGFzayBhcmNoaXZlIGZhaWxlZDogJHtTdHJpbmcoZSl9YCksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2b2lkIGV2aWN0VGFza091dHB1dCh0YXNrSWQpXG4gICAgdm9pZCByZW1vdmVSZW1vdGVBZ2VudE1ldGFkYXRhKHRhc2tJZClcbiAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICBgUmVtb3RlQWdlbnRUYXNrICR7dGFza0lkfSBraWxsZWQsIGFyY2hpdmluZyBzZXNzaW9uICR7c2Vzc2lvbklkID8/ICd1bmtub3duJ31gLFxuICAgIClcbiAgfSxcbn1cblxuLyoqXG4gKiBHZXQgdGhlIHNlc3Npb24gVVJMIGZvciBhIHJlbW90ZSB0YXNrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVtb3RlVGFza1Nlc3Npb25Vcmwoc2Vzc2lvbklkOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZ2V0UmVtb3RlU2Vzc2lvblVybChzZXNzaW9uSWQsIHByb2Nlc3MuZW52LlNFU1NJT05fSU5HUkVTU19VUkwpXG59XG4iXSwibWFwcGluZ3MiOiJBQUFBLGNBQWNBLFlBQVksUUFBUSw2QkFBNkI7QUFDL0QsU0FBU0MsbUJBQW1CLFFBQVEsNEJBQTRCO0FBQ2hFLFNBQ0VDLGVBQWUsRUFDZkMsMEJBQTBCLEVBQzFCQyxpQkFBaUIsRUFDakJDLFVBQVUsRUFDVkMsV0FBVyxFQUNYQyxXQUFXLEVBQ1hDLHFCQUFxQixFQUNyQkMsYUFBYSxFQUNiQyxlQUFlLEVBQ2ZDLGFBQWEsUUFDUix3QkFBd0I7QUFDL0IsY0FD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