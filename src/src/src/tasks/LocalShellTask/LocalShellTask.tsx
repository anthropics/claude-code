import { feature } from 'bun:bundle';
import { stat } from 'fs/promises';
import { OUTPUT_FILE_TAG, STATUS_TAG, SUMMARY_TAG, TASK_ID_TAG, TASK_NOTIFICATION_TAG, TOOL_USE_ID_TAG } from '../../constants/xml.js';
import { abortSpeculation } from '../../services/PromptSuggestion/speculation.js';
import type { AppState } from '../../state/AppState.js';
import type { LocalShellSpawnInput, SetAppState, Task, TaskContext, TaskHandle } from '../../Task.js';
import { createTaskStateBase } from '../../Task.js';
import type { AgentId } from '../../types/ids.js';
import { registerCleanup } from '../../utils/cleanupRegistry.js';
import { tailFile } from '../../utils/fsOperations.js';
import { logError } from '../../utils/log.js';
import { enqueuePendingNotification } from '../../utils/messageQueueManager.js';
import type { ShellCommand } from '../../utils/ShellCommand.js';
import { evictTaskOutput, getTaskOutputPath } from '../../utils/task/diskOutput.js';
import { registerTask, updateTaskState } from '../../utils/task/framework.js';
import { escapeXml } from '../../utils/xml.js';
import { backgroundAgentTask, isLocalAgentTask } from '../LocalAgentTask/LocalAgentTask.js';
import { isMainSessionTask } from '../LocalMainSessionTask.js';
import { type BashTaskKind, isLocalShellTask, type LocalShellTaskState } from './guards.js';
import { killTask } from './killShellTasks.js';

/** Prefix that identifies a LocalShellTask summary to the UI collapse transform. */
export const BACKGROUND_BASH_SUMMARY_PREFIX = 'Background command ';
const STALL_CHECK_INTERVAL_MS = 5_000;
const STALL_THRESHOLD_MS = 45_000;
const STALL_TAIL_BYTES = 1024;

// Last-line patterns that suggest a command is blocked waiting for keyboard
// input. Used to gate the stall notification — we stay silent on commands that
// are merely slow (git log -S, long builds) and only notify when the tail
// looks like an interactive prompt the model can act on. See CC-1175.
const PROMPT_PATTERNS = [/\(y\/n\)/i,
// (Y/n), (y/N)
/\[y\/n\]/i,
// [Y/n], [y/N]
/\(yes\/no\)/i, /\b(?:Do you|Would you|Shall I|Are you sure|Ready to)\b.*\? *$/i,
// directed questions
/Press (any key|Enter)/i, /Continue\?/i, /Overwrite\?/i];
export function looksLikePrompt(tail: string): boolean {
  const lastLine = tail.trimEnd().split('\n').pop() ?? '';
  return PROMPT_PATTERNS.some(p => p.test(lastLine));
}

// Output-side analog of peekForStdinData (utils/process.ts): fire a one-shot
// notification if output stops growing and the tail looks like a prompt.
function startStallWatchdog(taskId: string, description: string, kind: BashTaskKind | undefined, toolUseId?: string, agentId?: AgentId): () => void {
  if (kind === 'monitor') return () => {};
  const outputPath = getTaskOutputPath(taskId);
  let lastSize = 0;
  let lastGrowth = Date.now();
  let cancelled = false;
  const timer = setInterval(() => {
    void stat(outputPath).then(s => {
      if (s.size > lastSize) {
        lastSize = s.size;
        lastGrowth = Date.now();
        return;
      }
      if (Date.now() - lastGrowth < STALL_THRESHOLD_MS) return;
      void tailFile(outputPath, STALL_TAIL_BYTES).then(({
        content
      }) => {
        if (cancelled) return;
        if (!looksLikePrompt(content)) {
          // Not a prompt — keep watching. Reset so the next check is
          // 45s out instead of re-reading the tail on every tick.
          lastGrowth = Date.now();
          return;
        }
        // Latch before the async-boundary-visible side effects so an
        // overlapping tick's callback sees cancelled=true and bails.
        cancelled = true;
        clearInterval(timer);
        const toolUseIdLine = toolUseId ? `\n<${TOOL_USE_ID_TAG}>${toolUseId}</${TOOL_USE_ID_TAG}>` : '';
        const summary = `${BACKGROUND_BASH_SUMMARY_PREFIX}"${description}" appears to be waiting for interactive input`;
        // No <status> tag — print.ts treats <status> as a terminal
        // signal and an unknown value falls through to 'completed',
        // falsely closing the task for SDK consumers. Statusless
        // notifications are skipped by the SDK emitter (progress ping).
        const message = `<${TASK_NOTIFICATION_TAG}>
<${TASK_ID_TAG}>${taskId}</${TASK_ID_TAG}>${toolUseIdLine}
<${OUTPUT_FILE_TAG}>${outputPath}</${OUTPUT_FILE_TAG}>
<${SUMMARY_TAG}>${escapeXml(summary)}</${SUMMARY_TAG}>
</${TASK_NOTIFICATION_TAG}>
Last output:
${content.trimEnd()}

The command is likely blocked on an interactive prompt. Kill this task and re-run with piped input (e.g., \`echo y | command\`) or a non-interactive flag if one exists.`;
        enqueuePendingNotification({
          value: message,
          mode: 'task-notification',
          priority: 'next',
          agentId
        });
      }, () => {});
    }, () => {} // File may not exist yet
    );
  }, STALL_CHECK_INTERVAL_MS);
  timer.unref();
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}
function enqueueShellNotification(taskId: string, description: string, status: 'completed' | 'failed' | 'killed', exitCode: number | undefined, setAppState: SetAppState, toolUseId?: string, kind: BashTaskKind = 'bash', agentId?: AgentId): void {
  // Atomically check and set notified flag to prevent duplicate notifications.
  // If the task was already marked as notified (e.g., by TaskStopTool), skip
  // enqueueing to avoid sending redundant messages to the model.
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
  if (!shouldEnqueue) {
    return;
  }

  // Abort any active speculation — background task state changed, so speculated
  // results may reference stale task output. The prompt suggestion text is
  // preserved; only the pre-computed response is discarded.
  abortSpeculation(setAppState);
  let summary: string;
  if (feature('MONITOR_TOOL') && kind === 'monitor') {
    // Monitor is streaming-only (post-#22764) — the script exiting means
    // the stream ended, not "condition met". Distinct from the bash prefix
    // so Monitor completions don't fold into the "N background commands
    // completed" collapse.
    switch (status) {
      case 'completed':
        summary = `Monitor "${description}" stream ended`;
        break;
      case 'failed':
        summary = `Monitor "${description}" script failed${exitCode !== undefined ? ` (exit ${exitCode})` : ''}`;
        break;
      case 'killed':
        summary = `Monitor "${description}" stopped`;
        break;
    }
  } else {
    switch (status) {
      case 'completed':
        summary = `${BACKGROUND_BASH_SUMMARY_PREFIX}"${description}" completed${exitCode !== undefined ? ` (exit code ${exitCode})` : ''}`;
        break;
      case 'failed':
        summary = `${BACKGROUND_BASH_SUMMARY_PREFIX}"${description}" failed${exitCode !== undefined ? ` with exit code ${exitCode}` : ''}`;
        break;
      case 'killed':
        summary = `${BACKGROUND_BASH_SUMMARY_PREFIX}"${description}" was stopped`;
        break;
    }
  }
  const outputPath = getTaskOutputPath(taskId);
  const toolUseIdLine = toolUseId ? `\n<${TOOL_USE_ID_TAG}>${toolUseId}</${TOOL_USE_ID_TAG}>` : '';
  const message = `<${TASK_NOTIFICATION_TAG}>
<${TASK_ID_TAG}>${taskId}</${TASK_ID_TAG}>${toolUseIdLine}
<${OUTPUT_FILE_TAG}>${outputPath}</${OUTPUT_FILE_TAG}>
<${STATUS_TAG}>${status}</${STATUS_TAG}>
<${SUMMARY_TAG}>${escapeXml(summary)}</${SUMMARY_TAG}>
</${TASK_NOTIFICATION_TAG}>`;
  enqueuePendingNotification({
    value: message,
    mode: 'task-notification',
    priority: feature('MONITOR_TOOL') ? 'next' : 'later',
    agentId
  });
}
export const LocalShellTask: Task = {
  name: 'LocalShellTask',
  type: 'local_bash',
  async kill(taskId, setAppState) {
    killTask(taskId, setAppState);
  }
};
export async function spawnShellTask(input: LocalShellSpawnInput & {
  shellCommand: ShellCommand;
}, context: TaskContext): Promise<TaskHandle> {
  const {
    command,
    description,
    shellCommand,
    toolUseId,
    agentId,
    kind
  } = input;
  const {
    setAppState
  } = context;

  // TaskOutput owns the data — use its taskId so disk writes are consistent
  const {
    taskOutput
  } = shellCommand;
  const taskId = taskOutput.taskId;
  const unregisterCleanup = registerCleanup(async () => {
    killTask(taskId, setAppState);
  });
  const taskState: LocalShellTaskState = {
    ...createTaskStateBase(taskId, 'local_bash', description, toolUseId),
    type: 'local_bash',
    status: 'running',
    command,
    completionStatusSentInAttachment: false,
    shellCommand,
    unregisterCleanup,
    lastReportedTotalLines: 0,
    isBackgrounded: true,
    agentId,
    kind
  };
  registerTask(taskState, setAppState);

  // Data flows through TaskOutput automatically — no stream listeners needed.
  // Just transition to backgrounded state so the process keeps running.
  shellCommand.background(taskId);
  const cancelStallWatchdog = startStallWatchdog(taskId, description, kind, toolUseId, agentId);
  void shellCommand.result.then(async result => {
    cancelStallWatchdog();
    await flushAndCleanup(shellCommand);
    let wasKilled = false;
    updateTaskState<LocalShellTaskState>(taskId, setAppState, task => {
      if (task.status === 'killed') {
        wasKilled = true;
        return task;
      }
      return {
        ...task,
        status: result.code === 0 ? 'completed' : 'failed',
        result: {
          code: result.code,
          interrupted: result.interrupted
        },
        shellCommand: null,
        unregisterCleanup: undefined,
        endTime: Date.now()
      };
    });
    enqueueShellNotification(taskId, description, wasKilled ? 'killed' : result.code === 0 ? 'completed' : 'failed', result.code, setAppState, toolUseId, kind, agentId);
    void evictTaskOutput(taskId);
  });
  return {
    taskId,
    cleanup: () => {
      unregisterCleanup();
    }
  };
}

/**
 * Register a foreground task that could be backgrounded later.
 * Called when a bash command has been running long enough to show the BackgroundHint.
 * @returns taskId for the registered task
 */
export function registerForeground(input: LocalShellSpawnInput & {
  shellCommand: ShellCommand;
}, setAppState: SetAppState, toolUseId?: string): string {
  const {
    command,
    description,
    shellCommand,
    agentId
  } = input;
  const taskId = shellCommand.taskOutput.taskId;
  const unregisterCleanup = registerCleanup(async () => {
    killTask(taskId, setAppState);
  });
  const taskState: LocalShellTaskState = {
    ...createTaskStateBase(taskId, 'local_bash', description, toolUseId),
    type: 'local_bash',
    status: 'running',
    command,
    completionStatusSentInAttachment: false,
    shellCommand,
    unregisterCleanup,
    lastReportedTotalLines: 0,
    isBackgrounded: false,
    // Not yet backgrounded - running in foreground
    agentId
  };
  registerTask(taskState, setAppState);
  return taskId;
}

/**
 * Background a specific foreground task.
 * @returns true if backgrounded successfully, false otherwise
 */
function backgroundTask(taskId: string, getAppState: () => AppState, setAppState: SetAppState): boolean {
  // Step 1: Get the task and shell command from current state
  const state = getAppState();
  const task = state.tasks[taskId];
  if (!isLocalShellTask(task) || task.isBackgrounded || !task.shellCommand) {
    return false;
  }
  const shellCommand = task.shellCommand;
  const description = task.description;
  const {
    toolUseId,
    kind,
    agentId
  } = task;

  // Transition to backgrounded — TaskOutput continues receiving data automatically
  if (!shellCommand.background(taskId)) {
    return false;
  }
  setAppState(prev => {
    const prevTask = prev.tasks[taskId];
    if (!isLocalShellTask(prevTask) || prevTask.isBackgrounded) {
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
  const cancelStallWatchdog = startStallWatchdog(taskId, description, kind, toolUseId, agentId);

  // Set up result handler
  void shellCommand.result.then(async result => {
    cancelStallWatchdog();
    await flushAndCleanup(shellCommand);
    let wasKilled = false;
    let cleanupFn: (() => void) | undefined;
    updateTaskState<LocalShellTaskState>(taskId, setAppState, t => {
      if (t.status === 'killed') {
        wasKilled = true;
        return t;
      }

      // Capture cleanup function to call outside of updater
      cleanupFn = t.unregisterCleanup;
      return {
        ...t,
        status: result.code === 0 ? 'completed' : 'failed',
        result: {
          code: result.code,
          interrupted: result.interrupted
        },
        shellCommand: null,
        unregisterCleanup: undefined,
        endTime: Date.now()
      };
    });

    // Call cleanup outside of the state updater (avoid side effects in updater)
    cleanupFn?.();
    if (wasKilled) {
      enqueueShellNotification(taskId, description, 'killed', result.code, setAppState, toolUseId, kind, agentId);
    } else {
      const finalStatus = result.code === 0 ? 'completed' : 'failed';
      enqueueShellNotification(taskId, description, finalStatus, result.code, setAppState, toolUseId, kind, agentId);
    }
    void evictTaskOutput(taskId);
  });
  return true;
}

/**
 * Background ALL foreground tasks (bash commands and agents).
 * Called when user presses Ctrl+B to background all running tasks.
 */
/**
 * Check if there are any foreground tasks (bash or agent) that can be backgrounded.
 * Used to determine whether Ctrl+B should background existing tasks vs. background the session.
 */
export function hasForegroundTasks(state: AppState): boolean {
  return Object.values(state.tasks).some(task => {
    if (isLocalShellTask(task) && !task.isBackgrounded && task.shellCommand) {
      return true;
    }
    // Exclude main session tasks - they display in the main view, not as foreground tasks
    if (isLocalAgentTask(task) && !task.isBackgrounded && !isMainSessionTask(task)) {
      return true;
    }
    return false;
  });
}
export function backgroundAll(getAppState: () => AppState, setAppState: SetAppState): void {
  const state = getAppState();

  // Background all foreground bash tasks
  const foregroundBashTaskIds = Object.keys(state.tasks).filter(id => {
    const task = state.tasks[id];
    return isLocalShellTask(task) && !task.isBackgrounded && task.shellCommand;
  });
  for (const taskId of foregroundBashTaskIds) {
    backgroundTask(taskId, getAppState, setAppState);
  }

  // Background all foreground agent tasks
  const foregroundAgentTaskIds = Object.keys(state.tasks).filter(id => {
    const task = state.tasks[id];
    return isLocalAgentTask(task) && !task.isBackgrounded;
  });
  for (const taskId of foregroundAgentTaskIds) {
    backgroundAgentTask(taskId, getAppState, setAppState);
  }
}

/**
 * Background an already-registered foreground task in-place.
 * Unlike spawn(), this does NOT re-register the task — it flips isBackgrounded
 * on the existing registration and sets up a completion handler.
 * Used when the auto-background timer fires after registerForeground() has
 * already registered the task (avoiding duplicate task_started SDK events
 * and leaked cleanup callbacks).
 */
export function backgroundExistingForegroundTask(taskId: string, shellCommand: ShellCommand, description: string, setAppState: SetAppState, toolUseId?: string): boolean {
  if (!shellCommand.background(taskId)) {
    return false;
  }
  let agentId: AgentId | undefined;
  setAppState(prev => {
    const prevTask = prev.tasks[taskId];
    if (!isLocalShellTask(prevTask) || prevTask.isBackgrounded) {
      return prev;
    }
    agentId = prevTask.agentId;
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
  const cancelStallWatchdog = startStallWatchdog(taskId, description, undefined, toolUseId, agentId);

  // Set up result handler (mirrors backgroundTask's handler)
  void shellCommand.result.then(async result => {
    cancelStallWatchdog();
    await flushAndCleanup(shellCommand);
    let wasKilled = false;
    let cleanupFn: (() => void) | undefined;
    updateTaskState<LocalShellTaskState>(taskId, setAppState, t => {
      if (t.status === 'killed') {
        wasKilled = true;
        return t;
      }
      cleanupFn = t.unregisterCleanup;
      return {
        ...t,
        status: result.code === 0 ? 'completed' : 'failed',
        result: {
          code: result.code,
          interrupted: result.interrupted
        },
        shellCommand: null,
        unregisterCleanup: undefined,
        endTime: Date.now()
      };
    });
    cleanupFn?.();
    const finalStatus = wasKilled ? 'killed' : result.code === 0 ? 'completed' : 'failed';
    enqueueShellNotification(taskId, description, finalStatus, result.code, setAppState, toolUseId, undefined, agentId);
    void evictTaskOutput(taskId);
  });
  return true;
}

/**
 * Mark a task as notified to suppress a pending enqueueShellNotification.
 * Used when backgrounding raced with completion — the tool result already
 * carries the full output, so the <task_notification> would be redundant.
 */
export function markTaskNotified(taskId: string, setAppState: SetAppState): void {
  updateTaskState(taskId, setAppState, t => t.notified ? t : {
    ...t,
    notified: true
  });
}

/**
 * Unregister a foreground task when the command completes without being backgrounded.
 */
export function unregisterForeground(taskId: string, setAppState: SetAppState): void {
  let cleanupFn: (() => void) | undefined;
  setAppState(prev => {
    const task = prev.tasks[taskId];
    // Only remove if it's a foreground task (not backgrounded)
    if (!isLocalShellTask(task) || task.isBackgrounded) {
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
async function flushAndCleanup(shellCommand: ShellCommand): Promise<void> {
  try {
    await shellCommand.taskOutput.flush();
    shellCommand.cleanup();
  } catch (error) {
    logError(error);
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwic3RhdCIsIk9VVFBVVF9GSUxFX1RBRyIsIlNUQVRVU19UQUciLCJTVU1NQVJZX1RBRyIsIlRBU0tfSURfVEFHIiwiVEFTS19OT1RJRklDQVRJT05fVEFHIiwiVE9PTF9VU0VfSURfVEFHIiwiYWJvcnRTcGVjdWxhdGlvbiIsIkFwcFN0YXRlIiwiTG9jYWxTaGVsbFNwYXduSW5wdXQiLCJTZXRBcHBTdGF0ZSIsIlRhc2siLCJUYXNrQ29udGV4dCIsIlRhc2tIYW5kbGUiLCJjcmVhdGVUYXNrU3RhdGVCYXNlIiwiQWdlbnRJZCIsInJlZ2lzdGVyQ2xlYW51cCIsInRhaWxGaWxlIiwibG9nRXJyb3IiLCJlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbiIsIlNoZWxsQ29tbWFuZCIsImV2aWN0VGFza091dHB1dCIsImdldFRhc2tPdXRwdXRQYXRoIiwicmVnaXN0ZXJUYXNrIiwidXBkYXRlVGFza1N0YXRlIiwiZXNjYXBlWG1sIiwiYmFja2dyb3VuZEFnZW50VGFzayIsImlzTG9jYWxBZ2VudFRhc2siLCJpc01haW5TZXNzaW9uVGFzayIsIkJhc2hUYXNrS2luZCIsImlzTG9jYWxTaGVsbFRhc2siLCJMb2NhbFNoZWxsVGFza1N0YXRlIiwia2lsbFRhc2siLCJCQUNLR1JPVU5EX0JBU0hfU1VNTUFSWV9QUkVGSVgiLCJTVEFMTF9DSEVDS19JTlRFUlZBTF9NUyIsIlNUQUxMX1RIUkVTSE9MRF9NUyIsIlNUQUxMX1RBSUxfQllURVMiLCJQUk9NUFRfUEFUVEVSTlMiLCJsb29rc0xpa2VQcm9tcHQiLCJ0YWlsIiwibGFzdExpbmUiLCJ0cmltRW5kIiwic3BsaXQiLCJwb3AiLCJzb21lIiwicCIsInRlc3QiLCJzdGFydFN0YWxsV2F0Y2hkb2ciLCJ0YXNrSWQiLCJkZXNjcmlwdGlvbiIsImtpbmQiLCJ0b29sVXNlSWQiLCJhZ2VudElkIiwib3V0cHV0UGF0aCIsImxhc3RTaXplIiwibGFzdEdyb3d0aCIsIkRhdGUiLCJub3ciLCJjYW5jZWxsZWQiLCJ0aW1lciIsInNldEludGVydmFsIiwidGhlbiIsInMiLCJzaXplIiwiY29udGVudCIsImNsZWFySW50ZXJ2YWwiLCJ0b29sVXNlSWRMaW5lIiwic3VtbWFyeSIsIm1lc3NhZ2UiLCJ2YWx1ZSIsIm1vZGUiLCJwcmlvcml0eSIsInVucmVmIiwiZW5xdWV1ZVNoZWxsTm90aWZpY2F0aW9uIiwic3RhdHVzIiwiZXhpdENvZGUiLCJzZXRBcHBTdGF0ZSIsInNob3VsZEVucXVldWUiLCJ0YXNrIiwibm90aWZpZWQiLCJ1bmRlZmluZWQiLCJMb2NhbFNoZWxsVGFzayIsIm5hbWUiLCJ0eXBlIiwia2lsbCIsInNwYXduU2hlbGxUYXNrIiwiaW5wdXQiLCJzaGVsbENvbW1hbmQiLCJjb250ZXh0IiwiUHJvbWlzZSIsImNvbW1hbmQiLCJ0YXNrT3V0cHV0IiwidW5yZWdpc3RlckNsZWFudXAiLCJ0YXNrU3RhdGUiLCJjb21wbGV0aW9uU3RhdHVzU2VudEluQXR0YWNobWVudCIsImxhc3RSZXBvcnRlZFRvdGFsTGluZXMiLCJpc0JhY2tncm91bmRlZCIsImJhY2tncm91bmQiLCJjYW5jZWxTdGFsbFdhdGNoZG9nIiwicmVzdWx0IiwiZmx1c2hBbmRDbGVhbnVwIiwid2FzS2lsbGVkIiwiY29kZSIsImludGVycnVwdGVkIiwiZW5kVGltZSIsImNsZWFudXAiLCJyZWdpc3RlckZvcmVncm91bmQiLCJiYWNrZ3JvdW5kVGFzayIsImdldEFwcFN0YXRlIiwic3RhdGUiLCJ0YXNrcyIsInByZXYiLCJwcmV2VGFzayIsImNsZWFudXBGbiIsInQiLCJmaW5hbFN0YXR1cyIsImhhc0ZvcmVncm91bmRUYXNrcyIsIk9iamVjdCIsInZhbHVlcyIsImJhY2tncm91bmRBbGwiLCJmb3JlZ3JvdW5kQmFzaFRhc2tJZHMiLCJrZXlzIiwiZmlsdGVyIiwiaWQiLCJmb3JlZ3JvdW5kQWdlbnRUYXNrSWRzIiwiYmFja2dyb3VuZEV4aXN0aW5nRm9yZWdyb3VuZFRhc2siLCJtYXJrVGFza05vdGlmaWVkIiwidW5yZWdpc3RlckZvcmVncm91bmQiLCJyZW1vdmVkIiwicmVzdCIsImZsdXNoIiwiZXJyb3IiXSwic291cmNlcyI6WyJMb2NhbFNoZWxsVGFzay50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZmVhdHVyZSB9IGZyb20gJ2J1bjpidW5kbGUnXG5pbXBvcnQgeyBzdGF0IH0gZnJvbSAnZnMvcHJvbWlzZXMnXG5pbXBvcnQge1xuICBPVVRQVVRfRklMRV9UQUcsXG4gIFNUQVRVU19UQUcsXG4gIFNVTU1BUllfVEFHLFxuICBUQVNLX0lEX1RBRyxcbiAgVEFTS19OT1RJRklDQVRJT05fVEFHLFxuICBUT09MX1VTRV9JRF9UQUcsXG59IGZyb20gJy4uLy4uL2NvbnN0YW50cy94bWwuanMnXG5pbXBvcnQgeyBhYm9ydFNwZWN1bGF0aW9uIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvUHJvbXB0U3VnZ2VzdGlvbi9zcGVjdWxhdGlvbi5qcydcbmltcG9ydCB0eXBlIHsgQXBwU3RhdGUgfSBmcm9tICcuLi8uLi9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB0eXBlIHtcbiAgTG9jYWxTaGVsbFNwYXduSW5wdXQsXG4gIFNldEFwcFN0YXRlLFxuICBUYXNrLFxuICBUYXNrQ29udGV4dCxcbiAgVGFza0hhbmRsZSxcbn0gZnJvbSAnLi4vLi4vVGFzay5qcydcbmltcG9ydCB7IGNyZWF0ZVRhc2tTdGF0ZUJhc2UgfSBmcm9tICcuLi8uLi9UYXNrLmpzJ1xuaW1wb3J0IHR5cGUgeyBBZ2VudElkIH0gZnJvbSAnLi4vLi4vdHlwZXMvaWRzLmpzJ1xuaW1wb3J0IHsgcmVnaXN0ZXJDbGVhbnVwIH0gZnJvbSAnLi4vLi4vdXRpbHMvY2xlYW51cFJlZ2lzdHJ5LmpzJ1xuaW1wb3J0IHsgdGFpbEZpbGUgfSBmcm9tICcuLi8uLi91dGlscy9mc09wZXJhdGlvbnMuanMnXG5pbXBvcnQgeyBsb2dFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2xvZy5qcydcbmltcG9ydCB7IGVucXVldWVQZW5kaW5nTm90aWZpY2F0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvbWVzc2FnZVF1ZXVlTWFuYWdlci5qcydcbmltcG9ydCB0eXBlIHsgU2hlbGxDb21tYW5kIH0gZnJvbSAnLi4vLi4vdXRpbHMvU2hlbGxDb21tYW5kLmpzJ1xuaW1wb3J0IHtcbiAgZXZpY3RUYXNrT3V0cHV0LFxuICBnZXRUYXNrT3V0cHV0UGF0aCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvdGFzay9kaXNrT3V0cHV0LmpzJ1xuaW1wb3J0IHsgcmVnaXN0ZXJUYXNrLCB1cGRhdGVUYXNrU3RhdGUgfSBmcm9tICcuLi8uLi91dGlscy90YXNrL2ZyYW1ld29yay5qcydcbmltcG9ydCB7IGVzY2FwZVhtbCB9IGZyb20gJy4uLy4uL3V0aWxzL3htbC5qcydcbmltcG9ydCB7XG4gIGJhY2tncm91bmRBZ2VudFRhc2ssXG4gIGlzTG9jYWxBZ2VudFRhc2ssXG59IGZyb20gJy4uL0xvY2FsQWdlbnRUYXNrL0xvY2FsQWdlbnRUYXNrLmpzJ1xuaW1wb3J0IHsgaXNNYWluU2Vzc2lvblRhc2sgfSBmcm9tICcuLi9Mb2NhbE1haW5TZXNzaW9uVGFzay5qcydcbmltcG9ydCB7XG4gIHR5cGUgQmFzaFRhc2tLaW5kLFxuICBpc0xvY2FsU2hlbGxUYXNrLFxuICB0eXBlIExvY2FsU2hlbGxUYXNrU3RhdGUsXG59IGZyb20gJy4vZ3VhcmRzLmpzJ1xuaW1wb3J0IHsga2lsbFRhc2sgfSBmcm9tICcuL2tpbGxTaGVsbFRhc2tzLmpzJ1xuXG4vKiogUHJlZml4IHRoYXQgaWRlbnRpZmllcyBhIExvY2FsU2hlbGxUYXNrIHN1bW1hcnkgdG8gdGhlIFVJIGNvbGxhcHNlIHRyYW5zZm9ybS4gKi9cbmV4cG9ydCBjb25zdCBCQUNLR1JPVU5EX0JBU0hfU1VNTUFSWV9QUkVGSVggPSAnQmFja2dyb3VuZCBjb21tYW5kICdcblxuY29uc3QgU1RBTExfQ0hFQ0tfSU5URVJWQUxfTVMgPSA1XzAwMFxuY29uc3QgU1RBTExfVEhSRVNIT0xEX01TID0gNDVfMDAwXG5jb25zdCBTVEFMTF9UQUlMX0JZVEVTID0gMTAyNFxuXG4vLyBMYXN0LWxpbmUgcGF0dGVybnMgdGhhdCBzdWdnZXN0IGEgY29tbWFuZCBpcyBibG9ja2VkIHdhaXRpbmcgZm9yIGtleWJvYXJkXG4vLyBpbnB1dC4gVXNlZCB0byBnYXRlIHRoZSBzdGFsbCBub3RpZmljYXRpb24g4oCUIHdlIHN0YXkgc2lsZW50IG9uIGNvbW1hbmRzIHRoYXRcbi8vIGFyZSBtZXJlbHkgc2xvdyAoZ2l0IGxvZyAtUywgbG9uZyBidWlsZHMpIGFuZCBvbmx5IG5vdGlmeSB3aGVuIHRoZSB0YWlsXG4vLyBsb29rcyBsaWtlIGFuIGludGVyYWN0aXZlIHByb21wdCB0aGUgbW9kZWwgY2FuIGFjdCBvbi4gU2VlIENDLTExNzUuXG5jb25zdCBQUk9NUFRfUEFUVEVSTlMgPSBbXG4gIC9cXCh5XFwvblxcKS9pLCAvLyAoWS9uKSwgKHkvTilcbiAgL1xcW3lcXC9uXFxdL2ksIC8vIFtZL25dLCBbeS9OXVxuICAvXFwoeWVzXFwvbm9cXCkvaSxcbiAgL1xcYig/OkRvIHlvdXxXb3VsZCB5b3V8U2hhbGwgSXxBcmUgeW91IHN1cmV8UmVhZHkgdG8pXFxiLipcXD8gKiQvaSwgLy8gZGlyZWN0ZWQgcXVlc3Rpb25zXG4gIC9QcmVzcyAoYW55IGtleXxFbnRlcikvaSxcbiAgL0NvbnRpbnVlXFw/L2ksXG4gIC9PdmVyd3JpdGVcXD8vaSxcbl1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvb2tzTGlrZVByb21wdCh0YWlsOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgbGFzdExpbmUgPSB0YWlsLnRyaW1FbmQoKS5zcGxpdCgnXFxuJykucG9wKCkgPz8gJydcbiAgcmV0dXJuIFBST01QVF9QQVRURVJOUy5zb21lKHAgPT4gcC50ZXN0KGxhc3RMaW5lKSlcbn1cblxuLy8gT3V0cHV0LXNpZGUgYW5hbG9nIG9mIHBlZWtGb3JTdGRpbkRhdGEgKHV0aWxzL3Byb2Nlc3MudHMpOiBmaXJlIGEgb25lLXNob3Rcbi8vIG5vdGlmaWNhdGlvbiBpZiBvdXRwdXQgc3RvcHMgZ3Jvd2luZyBhbmQgdGhlIHRhaWwgbG9va3MgbGlrZSBhIHByb21wdC5cbmZ1bmN0aW9uIHN0YXJ0U3RhbGxXYXRjaGRvZyhcbiAgdGFza0lkOiBzdHJpbmcsXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmcsXG4gIGtpbmQ6IEJhc2hUYXNrS2luZCB8IHVuZGVmaW5lZCxcbiAgdG9vbFVzZUlkPzogc3RyaW5nLFxuICBhZ2VudElkPzogQWdlbnRJZCxcbik6ICgpID0+IHZvaWQge1xuICBpZiAoa2luZCA9PT0gJ21vbml0b3InKSByZXR1cm4gKCkgPT4ge31cbiAgY29uc3Qgb3V0cHV0UGF0aCA9IGdldFRhc2tPdXRwdXRQYXRoKHRhc2tJZClcbiAgbGV0IGxhc3RTaXplID0gMFxuICBsZXQgbGFzdEdyb3d0aCA9IERhdGUubm93KClcbiAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlXG5cbiAgY29uc3QgdGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgdm9pZCBzdGF0KG91dHB1dFBhdGgpLnRoZW4oXG4gICAgICBzID0+IHtcbiAgICAgICAgaWYgKHMuc2l6ZSA+IGxhc3RTaXplKSB7XG4gICAgICAgICAgbGFzdFNpemUgPSBzLnNpemVcbiAgICAgICAgICBsYXN0R3Jvd3RoID0gRGF0ZS5ub3coKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIGlmIChEYXRlLm5vdygpIC0gbGFzdEdyb3d0aCA8IFNUQUxMX1RIUkVTSE9MRF9NUykgcmV0dXJuXG4gICAgICAgIHZvaWQgdGFpbEZpbGUob3V0cHV0UGF0aCwgU1RBTExfVEFJTF9CWVRFUykudGhlbihcbiAgICAgICAgICAoeyBjb250ZW50IH0pID0+IHtcbiAgICAgICAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVyblxuICAgICAgICAgICAgaWYgKCFsb29rc0xpa2VQcm9tcHQoY29udGVudCkpIHtcbiAgICAgICAgICAgICAgLy8gTm90IGEgcHJvbXB0IOKAlCBrZWVwIHdhdGNoaW5nLiBSZXNldCBzbyB0aGUgbmV4dCBjaGVjayBpc1xuICAgICAgICAgICAgICAvLyA0NXMgb3V0IGluc3RlYWQgb2YgcmUtcmVhZGluZyB0aGUgdGFpbCBvbiBldmVyeSB0aWNrLlxuICAgICAgICAgICAgICBsYXN0R3Jvd3RoID0gRGF0ZS5ub3coKVxuICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIExhdGNoIGJlZm9yZSB0aGUgYXN5bmMtYm91bmRhcnktdmlzaWJsZSBzaWRlIGVmZmVjdHMgc28gYW5cbiAgICAgICAgICAgIC8vIG92ZXJsYXBwaW5nIHRpY2sncyBjYWxsYmFjayBzZWVzIGNhbmNlbGxlZD10cnVlIGFuZCBiYWlscy5cbiAgICAgICAgICAgIGNhbmNlbGxlZCA9IHRydWVcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwodGltZXIpXG4gICAgICAgICAgICBjb25zdCB0b29sVXNlSWRMaW5lID0gdG9vbFVzZUlkXG4gICAgICAgICAgICAgID8gYFxcbjwke1RPT0xfVVNFX0lEX1RBR30+JHt0b29sVXNlSWR9PC8ke1RPT0xfVVNFX0lEX1RBR30+YFxuICAgICAgICAgICAgICA6ICcnXG4gICAgICAgICAgICBjb25zdCBzdW1tYXJ5ID0gYCR7QkFDS0dST1VORF9CQVNIX1NVTU1BUllfUFJFRklYfVwiJHtkZXNjcmlwdGlvbn1cIiBhcHBlYXJzIHRvIGJlIHdhaXRpbmcgZm9yIGludGVyYWN0aXZlIGlucHV0YFxuICAgICAgICAgICAgLy8gTm8gPHN0YXR1cz4gdGFnIOKAlCBwcmludC50cyB0cmVhdHMgPHN0YXR1cz4gYXMgYSB0ZXJtaW5hbFxuICAgICAgICAgICAgLy8gc2lnbmFsIGFuZCBhbiB1bmtub3duIHZhbHVlIGZhbGxzIHRocm91Z2ggdG8gJ2NvbXBsZXRlZCcsXG4gICAgICAgICAgICAvLyBmYWxzZWx5IGNsb3NpbmcgdGhlIHRhc2sgZm9yIFNESyBjb25zdW1lcnMuIFN0YXR1c2xlc3NcbiAgICAgICAgICAgIC8vIG5vdGlmaWNhdGlvbnMgYXJlIHNraXBwZWQgYnkgdGhlIFNESyBlbWl0dGVyIChwcm9ncmVzcyBwaW5nKS5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgPCR7VEFTS19OT1RJRklDQVRJT05fVEFHfT5cbjwke1RBU0tfSURfVEFHfT4ke3Rhc2tJZH08LyR7VEFTS19JRF9UQUd9PiR7dG9vbFVzZUlkTGluZX1cbjwke09VVFBVVF9GSUxFX1RBR30+JHtvdXRwdXRQYXRofTwvJHtPVVRQVVRfRklMRV9UQUd9PlxuPCR7U1VNTUFSWV9UQUd9PiR7ZXNjYXBlWG1sKHN1bW1hcnkpfTwvJHtTVU1NQVJZX1RBR30+XG48LyR7VEFTS19OT1RJRklDQVRJT05fVEFHfT5cbkxhc3Qgb3V0cHV0OlxuJHtjb250ZW50LnRyaW1FbmQoKX1cblxuVGhlIGNvbW1hbmQgaXMgbGlrZWx5IGJsb2NrZWQgb24gYW4gaW50ZXJhY3RpdmUgcHJvbXB0LiBLaWxsIHRoaXMgdGFzayBhbmQgcmUtcnVuIHdpdGggcGlwZWQgaW5wdXQgKGUuZy4sIFxcYGVjaG8geSB8IGNvbW1hbmRcXGApIG9yIGEgbm9uLWludGVyYWN0aXZlIGZsYWcgaWYgb25lIGV4aXN0cy5gXG4gICAgICAgICAgICBlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbih7XG4gICAgICAgICAgICAgIHZhbHVlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICBtb2RlOiAndGFzay1ub3RpZmljYXRpb24nLFxuICAgICAgICAgICAgICBwcmlvcml0eTogJ25leHQnLFxuICAgICAgICAgICAgICBhZ2VudElkLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9LFxuICAgICAgICAgICgpID0+IHt9LFxuICAgICAgICApXG4gICAgICB9LFxuICAgICAgKCkgPT4ge30sIC8vIEZpbGUgbWF5IG5vdCBleGlzdCB5ZXRcbiAgICApXG4gIH0sIFNUQUxMX0NIRUNLX0lOVEVSVkFMX01TKVxuICB0aW1lci51bnJlZigpXG5cbiAgcmV0dXJuICgpID0+IHtcbiAgICBjYW5jZWxsZWQgPSB0cnVlXG4gICAgY2xlYXJJbnRlcnZhbCh0aW1lcilcbiAgfVxufVxuXG5mdW5jdGlvbiBlbnF1ZXVlU2hlbGxOb3RpZmljYXRpb24oXG4gIHRhc2tJZDogc3RyaW5nLFxuICBkZXNjcmlwdGlvbjogc3RyaW5nLFxuICBzdGF0dXM6ICdjb21wbGV0ZWQnIHwgJ2ZhaWxlZCcgfCAna2lsbGVkJyxcbiAgZXhpdENvZGU6IG51bWJlciB8IHVuZGVmaW5lZCxcbiAgc2V0QXBwU3RhdGU6IFNldEFwcFN0YXRlLFxuICB0b29sVXNlSWQ/OiBzdHJpbmcsXG4gIGtpbmQ6IEJhc2hUYXNrS2luZCA9ICdiYXNoJyxcbiAgYWdlbnRJZD86IEFnZW50SWQsXG4pOiB2b2lkIHtcbiAgLy8gQXRvbWljYWxseSBjaGVjayBhbmQgc2V0IG5vdGlmaWVkIGZsYWcgdG8gcHJldmVudCBkdXBsaWNhdGUgbm90aWZpY2F0aW9ucy5cbiAgLy8gSWYgdGhlIHRhc2sgd2FzIGFscmVhZHkgbWFya2VkIGFzIG5vdGlmaWVkIChlLmcuLCBieSBUYXNrU3RvcFRvb2wpLCBza2lwXG4gIC8vIGVucXVldWVpbmcgdG8gYXZvaWQgc2VuZGluZyByZWR1bmRhbnQgbWVzc2FnZXMgdG8gdGhlIG1vZGVsLlxuICBsZXQgc2hvdWxkRW5xdWV1ZSA9IGZhbHNlXG4gIHVwZGF0ZVRhc2tTdGF0ZSh0YXNrSWQsIHNldEFwcFN0YXRlLCB0YXNrID0+IHtcbiAgICBpZiAodGFzay5ub3RpZmllZCkge1xuICAgICAgcmV0dXJuIHRhc2tcbiAgICB9XG4gICAgc2hvdWxkRW5xdWV1ZSA9IHRydWVcbiAgICByZXR1cm4geyAuLi50YXNrLCBub3RpZmllZDogdHJ1ZSB9XG4gIH0pXG5cbiAgaWYgKCFzaG91bGRFbnF1ZXVlKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICAvLyBBYm9ydCBhbnkgYWN0aXZlIHNwZWN1bGF0aW9uIOKAlCBiYWNrZ3JvdW5kIHRhc2sgc3RhdGUgY2hhbmdlZCwgc28gc3BlY3VsYXRlZFxuICAvLyByZXN1bHRzIG1heSByZWZlcmVuY2Ugc3RhbGUgdGFzayBvdXRwdXQuIFRoZSBwcm9tcHQgc3VnZ2VzdGlvbiB0ZXh0IGlzXG4gIC8vIHByZXNlcnZlZDsgb25seSB0aGUgcHJlLWNvbXB1dGVkIHJlc3BvbnNlIGlzIGRpc2NhcmRlZC5cbiAgYWJvcnRTcGVjdWxhdGlvbihzZXRBcHBTdGF0ZSlcblxuICBsZXQgc3VtbWFyeTogc3RyaW5nXG4gIGlmIChmZWF0dXJlKCdNT05JVE9SX1RPT0wnKSAmJiBraW5kID09PSAnbW9uaXRvcicpIHtcbiAgICAvLyBNb25pdG9yIGlzIHN0cmVhbWluZy1vbmx5IChwb3N0LSMyMjc2NCkg4oCUIHRoZSBzY3JpcHQgZXhpdGluZyBtZWFuc1xuICAgIC8vIHRoZSBzdHJlYW0gZW5kZWQsIG5vdCBcImNvbmRpdGlvbiBtZXRcIi4gRGlzdGluY3QgZnJvbSB0aGUgYmFzaCBwcmVmaXhcbiAgICAvLyBzbyBNb25pdG9yIGNvbXBsZXRpb25zIGRvbid0IGZvbGQgaW50byB0aGUgXCJOIGJhY2tncm91bmQgY29tbWFuZHNcbiAgICAvLyBjb21wbGV0ZWRcIiBjb2xsYXBzZS5cbiAgICBzd2l0Y2ggKHN0YXR1cykge1xuICAgICAgY2FzZSAnY29tcGxldGVkJzpcbiAgICAgICAgc3VtbWFyeSA9IGBNb25pdG9yIFwiJHtkZXNjcmlwdGlvbn1cIiBzdHJlYW0gZW5kZWRgXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdmYWlsZWQnOlxuICAgICAgICBzdW1tYXJ5ID0gYE1vbml0b3IgXCIke2Rlc2NyaXB0aW9ufVwiIHNjcmlwdCBmYWlsZWQke2V4aXRDb2RlICE9PSB1bmRlZmluZWQgPyBgIChleGl0ICR7ZXhpdENvZGV9KWAgOiAnJ31gXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdraWxsZWQnOlxuICAgICAgICBzdW1tYXJ5ID0gYE1vbml0b3IgXCIke2Rlc2NyaXB0aW9ufVwiIHN0b3BwZWRgXG4gICAgICAgIGJyZWFrXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHN3aXRjaCAoc3RhdHVzKSB7XG4gICAgICBjYXNlICdjb21wbGV0ZWQnOlxuICAgICAgICBzdW1tYXJ5ID0gYCR7QkFDS0dST1VORF9CQVNIX1NVTU1BUllfUFJFRklYfVwiJHtkZXNjcmlwdGlvbn1cIiBjb21wbGV0ZWQke2V4aXRDb2RlICE9PSB1bmRlZmluZWQgPyBgIChleGl0IGNvZGUgJHtleGl0Q29kZX0pYCA6ICcnfWBcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2ZhaWxlZCc6XG4gICAgICAgIHN1bW1hcnkgPSBgJHtCQUNLR1JPVU5EX0JBU0hfU1VNTUFSWV9QUkVGSVh9XCIke2Rlc2NyaXB0aW9ufVwiIGZhaWxlZCR7ZXhpdENvZGUgIT09IHVuZGVmaW5lZCA/IGAgd2l0aCBleGl0IGNvZGUgJHtleGl0Q29kZX1gIDogJyd9YFxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAna2lsbGVkJzpcbiAgICAgICAgc3VtbWFyeSA9IGAke0JBQ0tHUk9VTkRfQkFTSF9TVU1NQVJZX1BSRUZJWH1cIiR7ZGVzY3JpcHRpb259XCIgd2FzIHN0b3BwZWRgXG4gICAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgY29uc3Qgb3V0cHV0UGF0aCA9IGdldFRhc2tPdXRwdXRQYXRoKHRhc2tJZClcbiAgY29uc3QgdG9vbFVzZUlkTGluZSA9IHRvb2xVc2VJZFxuICAgID8gYFxcbjwke1RPT0xfVVNFX0lEX1RBR30+JHt0b29sVXNlSWR9PC8ke1RPT0xfVVNFX0lEX1RBR30+YFxuICAgIDogJydcbiAgY29uc3QgbWVzc2FnZSA9IGA8JHtUQVNLX05PVElGSUNBVElPTl9UQUd9PlxuPCR7VEFTS19JRF9UQUd9PiR7dGFza0lkfTwvJHtUQVNLX0lEX1RBR30+JHt0b29sVXNlSWRMaW5lfVxuPCR7T1VUUFVUX0ZJTEVfVEFHfT4ke291dHB1dFBhdGh9PC8ke09VVFBVVF9GSUxFX1RBR30+XG48JHtTVEFUVVNfVEFHfT4ke3N0YXR1c308LyR7U1RBVFVTX1RBR30+XG48JHtTVU1NQVJZX1RBR30+JHtlc2NhcGVYbWwoc3VtbWFyeSl9PC8ke1NVTU1BUllfVEFHfT5cbjwvJHtUQVNLX05PVElGSUNBVElPTl9UQUd9PmBcblxuICBlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbih7XG4gICAgdmFsdWU6IG1lc3NhZ2UsXG4gICAgbW9kZTogJ3Rhc2stbm90aWZpY2F0aW9uJyxcbiAgICBwcmlvcml0eTogZmVhdHVyZSgnTU9OSVRPUl9UT09MJykgPyAnbmV4dCcgOiAnbGF0ZXInLFxuICAgIGFnZW50SWQsXG4gIH0pXG59XG5cbmV4cG9ydCBjb25zdCBMb2NhbFNoZWxsVGFzazogVGFzayA9IHtcbiAgbmFtZTogJ0xvY2FsU2hlbGxUYXNrJyxcbiAgdHlwZTogJ2xvY2FsX2Jhc2gnLFxuICBhc3luYyBraWxsKHRhc2tJZCwgc2V0QXBwU3RhdGUpIHtcbiAgICBraWxsVGFzayh0YXNrSWQsIHNldEFwcFN0YXRlKVxuICB9LFxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3Bhd25TaGVsbFRhc2soXG4gIGlucHV0OiBMb2NhbFNoZWxsU3Bhd25JbnB1dCAmIHsgc2hlbGxDb21tYW5kOiBTaGVsbENvbW1hbmQgfSxcbiAgY29udGV4dDogVGFza0NvbnRleHQsXG4pOiBQcm9taXNlPFRhc2tIYW5kbGU+IHtcbiAgY29uc3QgeyBjb21tYW5kLCBkZXNjcmlwdGlvbiwgc2hlbGxDb21tYW5kLCB0b29sVXNlSWQsIGFnZW50SWQsIGtpbmQgfSA9IGlucHV0XG4gIGNvbnN0IHsgc2V0QXBwU3RhdGUgfSA9IGNvbnRleHRcblxuICAvLyBUYXNrT3V0cHV0IG93bnMgdGhlIGRhdGEg4oCUIHVzZSBpdHMgdGFza0lkIHNvIGRpc2sgd3JpdGVzIGFyZSBjb25zaXN0ZW50XG4gIGNvbnN0IHsgdGFza091dHB1dCB9ID0gc2hlbGxDb21tYW5kXG4gIGNvbnN0IHRhc2tJZCA9IHRhc2tPdXRwdXQudGFza0lkXG5cbiAgY29uc3QgdW5yZWdpc3RlckNsZWFudXAgPSByZWdpc3RlckNsZWFudXAoYXN5bmMgKCkgPT4ge1xuICAgIGtpbGxUYXNrKHRhc2tJZCwgc2V0QXBwU3RhdGUpXG4gIH0pXG5cbiAgY29uc3QgdGFza1N0YXRlOiBMb2NhbFNoZWxsVGFza1N0YXRlID0ge1xuICAgIC4uLmNyZWF0ZVRhc2tTdGF0ZUJhc2UodGFza0lkLCAnbG9jYWxfYmFzaCcsIGRlc2NyaXB0aW9uLCB0b29sVXNlSWQpLFxuICAgIHR5cGU6ICdsb2NhbF9iYXNoJyxcbiAgICBzdGF0dXM6ICdydW5uaW5nJyxcbiAgICBjb21tYW5kLFxuICAgIGNvbXBsZXRpb25TdGF0dXNTZW50SW5BdHRhY2htZW50OiBmYWxzZSxcbiAgICBzaGVsbENvbW1hbmQsXG4gICAgdW5yZWdpc3RlckNsZWFudXAsXG4gICAgbGFzdFJlcG9ydGVkVG90YWxMaW5lczogMCxcbiAgICBpc0JhY2tncm91bmRlZDogdHJ1ZSxcbiAgICBhZ2VudElkLFxuICAgIGtpbmQsXG4gIH1cblxuICByZWdpc3RlclRhc2sodGFza1N0YXRlLCBzZXRBcHBTdGF0ZSlcblxuICAvLyBEYXRhIGZsb3dzIHRocm91Z2ggVGFza091dHB1dCBhdXRvbWF0aWNhbGx5IOKAlCBubyBzdHJlYW0gbGlzdGVuZXJzIG5lZWRlZC5cbiAgLy8gSnVzdCB0cmFuc2l0aW9uIHRvIGJhY2tncm91bmRlZCBzdGF0ZSBzbyB0aGUgcHJvY2VzcyBrZWVwcyBydW5uaW5nLlxuICBzaGVsbENvbW1hbmQuYmFja2dyb3VuZCh0YXNrSWQpXG5cbiAgY29uc3QgY2FuY2VsU3RhbGxXYXRjaGRvZyA9IHN0YXJ0U3RhbGxXYXRjaGRvZyhcbiAgICB0YXNrSWQsXG4gICAgZGVzY3JpcHRpb24sXG4gICAga2luZCxcbiAgICB0b29sVXNlSWQsXG4gICAgYWdlbnRJZCxcbiAgKVxuXG4gIHZvaWQgc2hlbGxDb21tYW5kLnJlc3VsdC50aGVuKGFzeW5jIHJlc3VsdCA9PiB7XG4gICAgY2FuY2VsU3RhbGxXYXRjaGRvZygpXG4gICAgYXdhaXQgZmx1c2hBbmRDbGVhbnVwKHNoZWxsQ29tbWFuZClcbiAgICBsZXQgd2FzS2lsbGVkID0gZmFsc2VcblxuICAgIHVwZGF0ZVRhc2tTdGF0ZTxMb2NhbFNoZWxsVGFza1N0YXRlPih0YXNrSWQsIHNldEFwcFN0YXRlLCB0YXNrID0+IHtcbiAgICAgIGlmICh0YXNrLnN0YXR1cyA9PT0gJ2tpbGxlZCcpIHtcbiAgICAgICAgd2FzS2lsbGVkID0gdHJ1ZVxuICAgICAgICByZXR1cm4gdGFza1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi50YXNrLFxuICAgICAgICBzdGF0dXM6IHJlc3VsdC5jb2RlID09PSAwID8gJ2NvbXBsZXRlZCcgOiAnZmFpbGVkJyxcbiAgICAgICAgcmVzdWx0OiB7IGNvZGU6IHJlc3VsdC5jb2RlLCBpbnRlcnJ1cHRlZDogcmVzdWx0LmludGVycnVwdGVkIH0sXG4gICAgICAgIHNoZWxsQ29tbWFuZDogbnVsbCxcbiAgICAgICAgdW5yZWdpc3RlckNsZWFudXA6IHVuZGVmaW5lZCxcbiAgICAgICAgZW5kVGltZTogRGF0ZS5ub3coKSxcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgZW5xdWV1ZVNoZWxsTm90aWZpY2F0aW9uKFxuICAgICAgdGFza0lkLFxuICAgICAgZGVzY3JpcHRpb24sXG4gICAgICB3YXNLaWxsZWQgPyAna2lsbGVkJyA6IHJlc3VsdC5jb2RlID09PSAwID8gJ2NvbXBsZXRlZCcgOiAnZmFpbGVkJyxcbiAgICAgIHJlc3VsdC5jb2RlLFxuICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICB0b29sVXNlSWQsXG4gICAgICBraW5kLFxuICAgICAgYWdlbnRJZCxcbiAgICApXG5cbiAgICB2b2lkIGV2aWN0VGFza091dHB1dCh0YXNrSWQpXG4gIH0pXG5cbiAgcmV0dXJuIHtcbiAgICB0YXNrSWQsXG4gICAgY2xlYW51cDogKCkgPT4ge1xuICAgICAgdW5yZWdpc3RlckNsZWFudXAoKVxuICAgIH0sXG4gIH1cbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhIGZvcmVncm91bmQgdGFzayB0aGF0IGNvdWxkIGJlIGJhY2tncm91bmRlZCBsYXRlci5cbiAqIENhbGxlZCB3aGVuIGEgYmFzaCBjb21tYW5kIGhhcyBiZWVuIHJ1bm5pbmcgbG9uZyBlbm91Z2ggdG8gc2hvdyB0aGUgQmFja2dyb3VuZEhpbnQuXG4gKiBAcmV0dXJucyB0YXNrSWQgZm9yIHRoZSByZWdpc3RlcmVkIHRhc2tcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyRm9yZWdyb3VuZChcbiAgaW5wdXQ6IExvY2FsU2hlbGxTcGF3bklucHV0ICYgeyBzaGVsbENvbW1hbmQ6IFNoZWxsQ29tbWFuZCB9LFxuICBzZXRBcHBTdGF0ZTogU2V0QXBwU3RhdGUsXG4gIHRvb2xVc2VJZD86IHN0cmluZyxcbik6IHN0cmluZyB7XG4gIGNvbnN0IHsgY29tbWFuZCwgZGVzY3JpcHRpb24sIHNoZWxsQ29tbWFuZCwgYWdlbnRJZCB9ID0gaW5wdXRcblxuICBjb25zdCB0YXNrSWQgPSBzaGVsbENvbW1hbmQudGFza091dHB1dC50YXNrSWRcblxuICBjb25zdCB1bnJlZ2lzdGVyQ2xlYW51cCA9IHJlZ2lzdGVyQ2xlYW51cChhc3luYyAoKSA9PiB7XG4gICAga2lsbFRhc2sodGFza0lkLCBzZXRBcHBTdGF0ZSlcbiAgfSlcblxuICBjb25zdCB0YXNrU3RhdGU6IExvY2FsU2hlbGxUYXNrU3RhdGUgPSB7XG4gICAgLi4uY3JlYXRlVGFza1N0YXRlQmFzZSh0YXNrSWQsICdsb2NhbF9iYXNoJywgZGVzY3JpcHRpb24sIHRvb2xVc2VJZCksXG4gICAgdHlwZTogJ2xvY2FsX2Jhc2gnLFxuICAgIHN0YXR1czogJ3J1bm5pbmcnLFxuICAgIGNvbW1hbmQsXG4gICAgY29tcGxldGlvblN0YXR1c1NlbnRJbkF0dGFjaG1lbnQ6IGZhbHNlLFxuICAgIHNoZWxsQ29tbWFuZCxcbiAgICB1bnJlZ2lzdGVyQ2xlYW51cCxcbiAgICBsYXN0UmVwb3J0ZWRUb3RhbExpbmVzOiAwLFxuICAgIGlzQmFja2dyb3VuZGVkOiBmYWxzZSwgLy8gTm90IHlldCBiYWNrZ3JvdW5kZWQgLSBydW5uaW5nIGluIGZvcmVncm91bmRcbiAgICBhZ2VudElkLFxuICB9XG5cbiAgcmVnaXN0ZXJUYXNrKHRhc2tTdGF0ZSwgc2V0QXBwU3RhdGUpXG4gIHJldHVybiB0YXNrSWRcbn1cblxuLyoqXG4gKiBCYWNrZ3JvdW5kIGEgc3BlY2lmaWMgZm9yZWdyb3VuZCB0YXNrLlxuICogQHJldHVybnMgdHJ1ZSBpZiBiYWNrZ3JvdW5kZWQgc3VjY2Vzc2Z1bGx5LCBmYWxzZSBvdGhlcndpc2VcbiAqL1xuZnVuY3Rpb24gYmFja2dyb3VuZFRhc2soXG4gIHRhc2tJZDogc3RyaW5nLFxuICBnZXRBcHBTdGF0ZTogKCkgPT4gQXBwU3RhdGUsXG4gIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZSxcbik6IGJvb2xlYW4ge1xuICAvLyBTdGVwIDE6IEdldCB0aGUgdGFzayBhbmQgc2hlbGwgY29tbWFuZCBmcm9tIGN1cnJlbnQgc3RhdGVcbiAgY29uc3Qgc3RhdGUgPSBnZXRBcHBTdGF0ZSgpXG4gIGNvbnN0IHRhc2sgPSBzdGF0ZS50YXNrc1t0YXNrSWRdXG4gIGlmICghaXNMb2NhbFNoZWxsVGFzayh0YXNrKSB8fCB0YXNrLmlzQmFja2dyb3VuZGVkIHx8ICF0YXNrLnNoZWxsQ29tbWFuZCkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgY29uc3Qgc2hlbGxDb21tYW5kID0gdGFzay5zaGVsbENvbW1hbmRcbiAgY29uc3QgZGVzY3JpcHRpb24gPSB0YXNrLmRlc2NyaXB0aW9uXG4gIGNvbnN0IHsgdG9vbFVzZUlkLCBraW5kLCBhZ2VudElkIH0gPSB0YXNrXG5cbiAgLy8gVHJhbnNpdGlvbiB0byBiYWNrZ3JvdW5kZWQg4oCUIFRhc2tPdXRwdXQgY29udGludWVzIHJlY2VpdmluZyBkYXRhIGF1dG9tYXRpY2FsbHlcbiAgaWYgKCFzaGVsbENvbW1hbmQuYmFja2dyb3VuZCh0YXNrSWQpKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICBjb25zdCBwcmV2VGFzayA9IHByZXYudGFza3NbdGFza0lkXVxuICAgIGlmICghaXNMb2NhbFNoZWxsVGFzayhwcmV2VGFzaykgfHwgcHJldlRhc2suaXNCYWNrZ3JvdW5kZWQpIHtcbiAgICAgIHJldHVybiBwcmV2XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAuLi5wcmV2LFxuICAgICAgdGFza3M6IHtcbiAgICAgICAgLi4ucHJldi50YXNrcyxcbiAgICAgICAgW3Rhc2tJZF06IHsgLi4ucHJldlRhc2ssIGlzQmFja2dyb3VuZGVkOiB0cnVlIH0sXG4gICAgICB9LFxuICAgIH1cbiAgfSlcblxuICBjb25zdCBjYW5jZWxTdGFsbFdhdGNoZG9nID0gc3RhcnRTdGFsbFdhdGNoZG9nKFxuICAgIHRhc2tJZCxcbiAgICBkZXNjcmlwdGlvbixcbiAgICBraW5kLFxuICAgIHRvb2xVc2VJZCxcbiAgICBhZ2VudElkLFxuICApXG5cbiAgLy8gU2V0IHVwIHJlc3VsdCBoYW5kbGVyXG4gIHZvaWQgc2hlbGxDb21tYW5kLnJlc3VsdC50aGVuKGFzeW5jIHJlc3VsdCA9PiB7XG4gICAgY2FuY2VsU3RhbGxXYXRjaGRvZygpXG4gICAgYXdhaXQgZmx1c2hBbmRDbGVhbnVwKHNoZWxsQ29tbWFuZClcbiAgICBsZXQgd2FzS2lsbGVkID0gZmFsc2VcbiAgICBsZXQgY2xlYW51cEZuOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWRcblxuICAgIHVwZGF0ZVRhc2tTdGF0ZTxMb2NhbFNoZWxsVGFza1N0YXRlPih0YXNrSWQsIHNldEFwcFN0YXRlLCB0ID0+IHtcbiAgICAgIGlmICh0LnN0YXR1cyA9PT0gJ2tpbGxlZCcpIHtcbiAgICAgICAgd2FzS2lsbGVkID0gdHJ1ZVxuICAgICAgICByZXR1cm4gdFxuICAgICAgfVxuXG4gICAgICAvLyBDYXB0dXJlIGNsZWFudXAgZnVuY3Rpb24gdG8gY2FsbCBvdXRzaWRlIG9mIHVwZGF0ZXJcbiAgICAgIGNsZWFudXBGbiA9IHQudW5yZWdpc3RlckNsZWFudXBcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4udCxcbiAgICAgICAgc3RhdHVzOiByZXN1bHQuY29kZSA9PT0gMCA/ICdjb21wbGV0ZWQnIDogJ2ZhaWxlZCcsXG4gICAgICAgIHJlc3VsdDogeyBjb2RlOiByZXN1bHQuY29kZSwgaW50ZXJydXB0ZWQ6IHJlc3VsdC5pbnRlcnJ1cHRlZCB9LFxuICAgICAgICBzaGVsbENvbW1hbmQ6IG51bGwsXG4gICAgICAgIHVucmVnaXN0ZXJDbGVhbnVwOiB1bmRlZmluZWQsXG4gICAgICAgIGVuZFRpbWU6IERhdGUubm93KCksXG4gICAgICB9XG4gICAgfSlcblxuICAgIC8vIENhbGwgY2xlYW51cCBvdXRzaWRlIG9mIHRoZSBzdGF0ZSB1cGRhdGVyIChhdm9pZCBzaWRlIGVmZmVjdHMgaW4gdXBkYXRlcilcbiAgICBjbGVhbnVwRm4/LigpXG5cbiAgICBpZiAod2FzS2lsbGVkKSB7XG4gICAgICBlbnF1ZXVlU2hlbGxOb3RpZmljYXRpb24oXG4gICAgICAgIHRhc2tJZCxcbiAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICdraWxsZWQnLFxuICAgICAgICByZXN1bHQuY29kZSxcbiAgICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICAgIHRvb2xVc2VJZCxcbiAgICAgICAga2luZCxcbiAgICAgICAgYWdlbnRJZCxcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZmluYWxTdGF0dXMgPSByZXN1bHQuY29kZSA9PT0gMCA/ICdjb21wbGV0ZWQnIDogJ2ZhaWxlZCdcbiAgICAgIGVucXVldWVTaGVsbE5vdGlmaWNhdGlvbihcbiAgICAgICAgdGFza0lkLFxuICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgZmluYWxTdGF0dXMsXG4gICAgICAgIHJlc3VsdC5jb2RlLFxuICAgICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgICAgdG9vbFVzZUlkLFxuICAgICAgICBraW5kLFxuICAgICAgICBhZ2VudElkLFxuICAgICAgKVxuICAgIH1cblxuICAgIHZvaWQgZXZpY3RUYXNrT3V0cHV0KHRhc2tJZClcbiAgfSlcblxuICByZXR1cm4gdHJ1ZVxufVxuXG4vKipcbiAqIEJhY2tncm91bmQgQUxMIGZvcmVncm91bmQgdGFza3MgKGJhc2ggY29tbWFuZHMgYW5kIGFnZW50cykuXG4gKiBDYWxsZWQgd2hlbiB1c2VyIHByZXNzZXMgQ3RybCtCIHRvIGJhY2tncm91bmQgYWxsIHJ1bm5pbmcgdGFza3MuXG4gKi9cbi8qKlxuICogQ2hlY2sgaWYgdGhlcmUgYXJlIGFueSBmb3JlZ3JvdW5kIHRhc2tzIChiYXNoIG9yIGFnZW50KSB0aGF0IGNhbiBiZSBiYWNrZ3JvdW5kZWQuXG4gKiBVc2VkIHRvIGRldGVybWluZSB3aGV0aGVyIEN0cmwrQiBzaG91bGQgYmFja2dyb3VuZCBleGlzdGluZyB0YXNrcyB2cy4gYmFja2dyb3VuZCB0aGUgc2Vzc2lvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc0ZvcmVncm91bmRUYXNrcyhzdGF0ZTogQXBwU3RhdGUpOiBib29sZWFuIHtcbiAgcmV0dXJuIE9iamVjdC52YWx1ZXMoc3RhdGUudGFza3MpLnNvbWUodGFzayA9PiB7XG4gICAgaWYgKGlzTG9jYWxTaGVsbFRhc2sodGFzaykgJiYgIXRhc2suaXNCYWNrZ3JvdW5kZWQgJiYgdGFzay5zaGVsbENvbW1hbmQpIHtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICAgIC8vIEV4Y2x1ZGUgbWFpbiBzZXNzaW9uIHRhc2tzIC0gdGhleSBkaXNwbGF5IGluIHRoZSBtYWluIHZpZXcsIG5vdCBhcyBmb3JlZ3JvdW5kIHRhc2tzXG4gICAgaWYgKFxuICAgICAgaXNMb2NhbEFnZW50VGFzayh0YXNrKSAmJlxuICAgICAgIXRhc2suaXNCYWNrZ3JvdW5kZWQgJiZcbiAgICAgICFpc01haW5TZXNzaW9uVGFzayh0YXNrKVxuICAgICkge1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiYWNrZ3JvdW5kQWxsKFxuICBnZXRBcHBTdGF0ZTogKCkgPT4gQXBwU3RhdGUsXG4gIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZSxcbik6IHZvaWQge1xuICBjb25zdCBzdGF0ZSA9IGdldEFwcFN0YXRlKClcblxuICAvLyBCYWNrZ3JvdW5kIGFsbCBmb3JlZ3JvdW5kIGJhc2ggdGFza3NcbiAgY29uc3QgZm9yZWdyb3VuZEJhc2hUYXNrSWRzID0gT2JqZWN0LmtleXMoc3RhdGUudGFza3MpLmZpbHRlcihpZCA9PiB7XG4gICAgY29uc3QgdGFzayA9IHN0YXRlLnRhc2tzW2lkXVxuICAgIHJldHVybiBpc0xvY2FsU2hlbGxUYXNrKHRhc2spICYmICF0YXNrLmlzQmFja2dyb3VuZGVkICYmIHRhc2suc2hlbGxDb21tYW5kXG4gIH0pXG4gIGZvciAoY29uc3QgdGFza0lkIG9mIGZvcmVncm91bmRCYXNoVGFza0lkcykge1xuICAgIGJhY2tncm91bmRUYXNrKHRhc2tJZCwgZ2V0QXBwU3RhdGUsIHNldEFwcFN0YXRlKVxuICB9XG5cbiAgLy8gQmFja2dyb3VuZCBhbGwgZm9yZWdyb3VuZCBhZ2VudCB0YXNrc1xuICBjb25zdCBmb3JlZ3JvdW5kQWdlbnRUYXNrSWRzID0gT2JqZWN0LmtleXMoc3RhdGUudGFza3MpLmZpbHRlcihpZCA9PiB7XG4gICAgY29uc3QgdGFzayA9IHN0YXRlLnRhc2tzW2lkXVxuICAgIHJldHVybiBpc0xvY2FsQWdlbnRUYXNrKHRhc2spICYmICF0YXNrLmlzQmFja2dyb3VuZGVkXG4gIH0pXG4gIGZvciAoY29uc3QgdGFza0lkIG9mIGZvcmVncm91bmRBZ2VudFRhc2tJZHMpIHtcbiAgICBiYWNrZ3JvdW5kQWdlbnRUYXNrKHRhc2tJZCwgZ2V0QXBwU3RhdGUsIHNldEFwcFN0YXRlKVxuICB9XG59XG5cbi8qKlxuICogQmFja2dyb3VuZCBhbiBhbHJlYWR5LXJlZ2lzdGVyZWQgZm9yZWdyb3VuZCB0YXNrIGluLXBsYWNlLlxuICogVW5saWtlIHNwYXduKCksIHRoaXMgZG9lcyBOT1QgcmUtcmVnaXN0ZXIgdGhlIHRhc2sg4oCUIGl0IGZsaXBzIGlzQmFja2dyb3VuZGVkXG4gKiBvbiB0aGUgZXhpc3RpbmcgcmVnaXN0cmF0aW9uIGFuZCBzZXRzIHVwIGEgY29tcGxldGlvbiBoYW5kbGVyLlxuICogVXNlZCB3aGVuIHRoZSBhdXRvLWJhY2tncm91bmQgdGltZXIgZmlyZXMgYWZ0ZXIgcmVnaXN0ZXJGb3JlZ3JvdW5kKCkgaGFzXG4gKiBhbHJlYWR5IHJlZ2lzdGVyZWQgdGhlIHRhc2sgKGF2b2lkaW5nIGR1cGxpY2F0ZSB0YXNrX3N0YXJ0ZWQgU0RLIGV2ZW50c1xuICogYW5kIGxlYWtlZCBjbGVhbnVwIGNhbGxiYWNrcykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYWNrZ3JvdW5kRXhpc3RpbmdGb3JlZ3JvdW5kVGFzayhcbiAgdGFza0lkOiBzdHJpbmcsXG4gIHNoZWxsQ29tbWFuZDogU2hlbGxDb21tYW5kLFxuICBkZXNjcmlwdGlvbjogc3RyaW5nLFxuICBzZXRBcHBTdGF0ZTogU2V0QXBwU3RhdGUsXG4gIHRvb2xVc2VJZD86IHN0cmluZyxcbik6IGJvb2xlYW4ge1xuICBpZiAoIXNoZWxsQ29tbWFuZC5iYWNrZ3JvdW5kKHRhc2tJZCkpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGxldCBhZ2VudElkOiBBZ2VudElkIHwgdW5kZWZpbmVkXG4gIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgIGNvbnN0IHByZXZUYXNrID0gcHJldi50YXNrc1t0YXNrSWRdXG4gICAgaWYgKCFpc0xvY2FsU2hlbGxUYXNrKHByZXZUYXNrKSB8fCBwcmV2VGFzay5pc0JhY2tncm91bmRlZCkge1xuICAgICAgcmV0dXJuIHByZXZcbiAgICB9XG4gICAgYWdlbnRJZCA9IHByZXZUYXNrLmFnZW50SWRcbiAgICByZXR1cm4ge1xuICAgICAgLi4ucHJldixcbiAgICAgIHRhc2tzOiB7XG4gICAgICAgIC4uLnByZXYudGFza3MsXG4gICAgICAgIFt0YXNrSWRdOiB7IC4uLnByZXZUYXNrLCBpc0JhY2tncm91bmRlZDogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICB9XG4gIH0pXG5cbiAgY29uc3QgY2FuY2VsU3RhbGxXYXRjaGRvZyA9IHN0YXJ0U3RhbGxXYXRjaGRvZyhcbiAgICB0YXNrSWQsXG4gICAgZGVzY3JpcHRpb24sXG4gICAgdW5kZWZpbmVkLFxuICAgIHRvb2xVc2VJZCxcbiAgICBhZ2VudElkLFxuICApXG5cbiAgLy8gU2V0IHVwIHJlc3VsdCBoYW5kbGVyIChtaXJyb3JzIGJhY2tncm91bmRUYXNrJ3MgaGFuZGxlcilcbiAgdm9pZCBzaGVsbENvbW1hbmQucmVzdWx0LnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcbiAgICBjYW5jZWxTdGFsbFdhdGNoZG9nKClcbiAgICBhd2FpdCBmbHVzaEFuZENsZWFudXAoc2hlbGxDb21tYW5kKVxuICAgIGxldCB3YXNLaWxsZWQgPSBmYWxzZVxuICAgIGxldCBjbGVhbnVwRm46ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZFxuXG4gICAgdXBkYXRlVGFza1N0YXRlPExvY2FsU2hlbGxUYXNrU3RhdGU+KHRhc2tJZCwgc2V0QXBwU3RhdGUsIHQgPT4ge1xuICAgICAgaWYgKHQuc3RhdHVzID09PSAna2lsbGVkJykge1xuICAgICAgICB3YXNLaWxsZWQgPSB0cnVlXG4gICAgICAgIHJldHVybiB0XG4gICAgICB9XG4gICAgICBjbGVhbnVwRm4gPSB0LnVucmVnaXN0ZXJDbGVhbnVwXG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi50LFxuICAgICAgICBzdGF0dXM6IHJlc3VsdC5jb2RlID09PSAwID8gJ2NvbXBsZXRlZCcgOiAnZmFpbGVkJyxcbiAgICAgICAgcmVzdWx0OiB7IGNvZGU6IHJlc3VsdC5jb2RlLCBpbnRlcnJ1cHRlZDogcmVzdWx0LmludGVycnVwdGVkIH0sXG4gICAgICAgIHNoZWxsQ29tbWFuZDogbnVsbCxcbiAgICAgICAgdW5yZWdpc3RlckNsZWFudXA6IHVuZGVmaW5lZCxcbiAgICAgICAgZW5kVGltZTogRGF0ZS5ub3coKSxcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgY2xlYW51cEZuPy4oKVxuXG4gICAgY29uc3QgZmluYWxTdGF0dXMgPSB3YXNLaWxsZWRcbiAgICAgID8gJ2tpbGxlZCdcbiAgICAgIDogcmVzdWx0LmNvZGUgPT09IDBcbiAgICAgICAgPyAnY29tcGxldGVkJ1xuICAgICAgICA6ICdmYWlsZWQnXG4gICAgZW5xdWV1ZVNoZWxsTm90aWZpY2F0aW9uKFxuICAgICAgdGFza0lkLFxuICAgICAgZGVzY3JpcHRpb24sXG4gICAgICBmaW5hbFN0YXR1cyxcbiAgICAgIHJlc3VsdC5jb2RlLFxuICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICB0b29sVXNlSWQsXG4gICAgICB1bmRlZmluZWQsXG4gICAgICBhZ2VudElkLFxuICAgIClcblxuICAgIHZvaWQgZXZpY3RUYXNrT3V0cHV0KHRhc2tJZClcbiAgfSlcblxuICByZXR1cm4gdHJ1ZVxufVxuXG4vKipcbiAqIE1hcmsgYSB0YXNrIGFzIG5vdGlmaWVkIHRvIHN1cHByZXNzIGEgcGVuZGluZyBlbnF1ZXVlU2hlbGxOb3RpZmljYXRpb24uXG4gKiBVc2VkIHdoZW4gYmFja2dyb3VuZGluZyByYWNlZCB3aXRoIGNvbXBsZXRpb24g4oCUIHRoZSB0b29sIHJlc3VsdCBhbHJlYWR5XG4gKiBjYXJyaWVzIHRoZSBmdWxsIG91dHB1dCwgc28gdGhlIDx0YXNrX25vdGlmaWNhdGlvbj4gd291bGQgYmUgcmVkdW5kYW50LlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFya1Rhc2tOb3RpZmllZChcbiAgdGFza0lkOiBzdHJpbmcsXG4gIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZSxcbik6IHZvaWQge1xuICB1cGRhdGVUYXNrU3RhdGUodGFza0lkLCBzZXRBcHBTdGF0ZSwgdCA9PlxuICAgIHQubm90aWZpZWQgPyB0IDogeyAuLi50LCBub3RpZmllZDogdHJ1ZSB9LFxuICApXG59XG5cbi8qKlxuICogVW5yZWdpc3RlciBhIGZvcmVncm91bmQgdGFzayB3aGVuIHRoZSBjb21tYW5kIGNvbXBsZXRlcyB3aXRob3V0IGJlaW5nIGJhY2tncm91bmRlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHVucmVnaXN0ZXJGb3JlZ3JvdW5kKFxuICB0YXNrSWQ6IHN0cmluZyxcbiAgc2V0QXBwU3RhdGU6IFNldEFwcFN0YXRlLFxuKTogdm9pZCB7XG4gIGxldCBjbGVhbnVwRm46ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZFxuXG4gIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgIGNvbnN0IHRhc2sgPSBwcmV2LnRhc2tzW3Rhc2tJZF1cbiAgICAvLyBPbmx5IHJlbW92ZSBpZiBpdCdzIGEgZm9yZWdyb3VuZCB0YXNrIChub3QgYmFja2dyb3VuZGVkKVxuICAgIGlmICghaXNMb2NhbFNoZWxsVGFzayh0YXNrKSB8fCB0YXNrLmlzQmFja2dyb3VuZGVkKSB7XG4gICAgICByZXR1cm4gcHJldlxuICAgIH1cblxuICAgIC8vIENhcHR1cmUgY2xlYW51cCBmdW5jdGlvbiB0byBjYWxsIG91dHNpZGUgb2YgdXBkYXRlclxuICAgIGNsZWFudXBGbiA9IHRhc2sudW5yZWdpc3RlckNsZWFudXBcblxuICAgIGNvbnN0IHsgW3Rhc2tJZF06IHJlbW92ZWQsIC4uLnJlc3QgfSA9IHByZXYudGFza3NcbiAgICByZXR1cm4geyAuLi5wcmV2LCB0YXNrczogcmVzdCB9XG4gIH0pXG5cbiAgLy8gQ2FsbCBjbGVhbnVwIG91dHNpZGUgb2YgdGhlIHN0YXRlIHVwZGF0ZXIgKGF2b2lkIHNpZGUgZWZmZWN0cyBpbiB1cGRhdGVyKVxuICBjbGVhbnVwRm4/LigpXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZsdXNoQW5kQ2xlYW51cChzaGVsbENvbW1hbmQ6IFNoZWxsQ29tbWFuZCk6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGF3YWl0IHNoZWxsQ29tbWFuZC50YXNrT3V0cHV0LmZsdXNoKClcbiAgICBzaGVsbENvbW1hbmQuY2xlYW51cCgpXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nRXJyb3IoZXJyb3IpXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBU0EsT0FBTyxRQUFRLFlBQVk7QUFDcEMsU0FBU0Ms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