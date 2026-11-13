import { c as _c } from "react/compiler-runtime";
import React from 'react';
import { z } from 'zod/v4';
import { FallbackToolUseErrorMessage } from '../../components/FallbackToolUseErrorMessage.js';
import { FallbackToolUseRejectedMessage } from '../../components/FallbackToolUseRejectedMessage.js';
import { MessageResponse } from '../../components/MessageResponse.js';
import { Box, Text } from '../../ink.js';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay.js';
import type { TaskType } from '../../Task.js';
import type { Tool } from '../../Tool.js';
import { buildTool, type ToolDef } from '../../Tool.js';
import type { LocalAgentTaskState } from '../../tasks/LocalAgentTask/LocalAgentTask.js';
import type { LocalShellTaskState } from '../../tasks/LocalShellTask/guards.js';
import type { RemoteAgentTaskState } from '../../tasks/RemoteAgentTask/RemoteAgentTask.js';
import type { TaskState } from '../../tasks/types.js';
import { AbortError } from '../../utils/errors.js';
import { lazySchema } from '../../utils/lazySchema.js';
import { extractTextContent } from '../../utils/messages.js';
import { semanticBoolean } from '../../utils/semanticBoolean.js';
import { sleep } from '../../utils/sleep.js';
import { jsonParse } from '../../utils/slowOperations.js';
import { countCharInString } from '../../utils/stringUtils.js';
import { getTaskOutput } from '../../utils/task/diskOutput.js';
import { updateTaskState } from '../../utils/task/framework.js';
import { formatTaskOutput } from '../../utils/task/outputFormatting.js';
import type { ThemeName } from '../../utils/theme.js';
import { AgentPromptDisplay, AgentResponseDisplay } from '../AgentTool/UI.js';
import BashToolResultMessage from '../BashTool/BashToolResultMessage.js';
import { TASK_OUTPUT_TOOL_NAME } from './constants.js';
const inputSchema = lazySchema(() => z.strictObject({
  task_id: z.string().describe('The task ID to get output from'),
  block: semanticBoolean(z.boolean().default(true)).describe('Whether to wait for completion'),
  timeout: z.number().min(0).max(600000).default(30000).describe('Max wait time in ms')
}));
type InputSchema = ReturnType<typeof inputSchema>;
type TaskOutputToolInput = z.infer<InputSchema>;

// Unified output type covering all task types
type TaskOutput = {
  task_id: string;
  task_type: TaskType;
  status: string;
  description: string;
  output: string;
  exitCode?: number | null;
  error?: string;
  // For agents
  prompt?: string;
  result?: string;
};
type TaskOutputToolOutput = {
  retrieval_status: 'success' | 'timeout' | 'not_ready';
  task: TaskOutput | null;
};

// Re-export Progress from centralized types to break import cycles
export type { TaskOutputProgress as Progress } from '../../types/tools.js';

// Get output for any task type
async function getTaskOutputData(task: TaskState): Promise<TaskOutput> {
  let output: string;
  if (task.type === 'local_bash') {
    const bashTask = task as LocalShellTaskState;
    const taskOutputObj = bashTask.shellCommand?.taskOutput;
    if (taskOutputObj) {
      const stdout = await taskOutputObj.getStdout();
      const stderr = taskOutputObj.getStderr();
      output = [stdout, stderr].filter(Boolean).join('\n');
    } else {
      output = await getTaskOutput(task.id);
    }
  } else {
    output = await getTaskOutput(task.id);
  }
  const baseOutput: TaskOutput = {
    task_id: task.id,
    task_type: task.type,
    status: task.status,
    description: task.description,
    output
  };

  // Add type-specific fields
  if (task.type === 'local_bash') {
    const bashTask = task as LocalShellTaskState;
    return {
      ...baseOutput,
      exitCode: bashTask.result?.code ?? null
    };
  }
  if (task.type === 'local_agent') {
    const agentTask = task as LocalAgentTaskState;
    // Prefer the clean final answer from the in-memory result over the raw
    // JSONL transcript on disk. The disk output is a symlink to the full
    // session transcript (every message, tool use, etc.), not just the
    // subagent's answer. The in-memory result contains only the final
    // assistant text content blocks.
    const cleanResult = agentTask.result ? extractTextContent(agentTask.result.content, '\n') : undefined;
    return {
      ...baseOutput,
      prompt: agentTask.prompt,
      result: cleanResult || output,
      output: cleanResult || output,
      error: agentTask.error
    };
  }
  if (task.type === 'remote_agent') {
    const remoteTask = task as RemoteAgentTaskState;
    return {
      ...baseOutput,
      prompt: remoteTask.command
    };
  }
  return baseOutput;
}

// Wait for task to complete
async function waitForTaskCompletion(taskId: string, getAppState: () => {
  tasks?: Record<string, TaskState>;
}, timeoutMs: number, abortController?: AbortController): Promise<TaskState | null> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    // Check abort signal
    if (abortController?.signal.aborted) {
      throw new AbortError();
    }
    const state = getAppState();
    const task = state.tasks?.[taskId] as TaskState | undefined;
    if (!task) {
      return null;
    }
    if (task.status !== 'running' && task.status !== 'pending') {
      return task;
    }

    // Wait before polling again
    await sleep(100);
  }

  // Timeout - return current state
  const finalState = getAppState();
  return finalState.tasks?.[taskId] as TaskState ?? null;
}
export const TaskOutputTool: Tool<InputSchema, TaskOutputToolOutput> = buildTool({
  name: TASK_OUTPUT_TOOL_NAME,
  searchHint: 'read output/logs from a background task',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  // Backwards-compatible aliases for renamed tools
  aliases: ['AgentOutputTool', 'BashOutputTool'],
  userFacingName() {
    return 'Task Output';
  },
  get inputSchema(): InputSchema {
    return inputSchema();
  },
  async description() {
    return '[Deprecated] — prefer Read on the task output file path';
  },
  isConcurrencySafe(_input) {
    return this.isReadOnly?.(_input) ?? false;
  },
  isEnabled() {
    return "external" !== 'ant';
  },
  isReadOnly(_input) {
    return true;
  },
  toAutoClassifierInput(input) {
    return input.task_id;
  },
  async prompt() {
    return `DEPRECATED: Prefer using the Read tool on the task's output file path instead. Background tasks return their output file path in the tool result, and you receive a <task-notification> with the same path when the task completes — Read that file directly.

- Retrieves output from a running or completed task (background shell, agent, or remote session)
- Takes a task_id parameter identifying the task
- Returns the task output along with status information
- Use block=true (default) to wait for task completion
- Use block=false for non-blocking check of current status
- Task IDs can be found using the /tasks command
- Works with all task types: background shells, async agents, and remote sessions`;
  },
  async validateInput({
    task_id
  }, {
    getAppState
  }) {
    if (!task_id) {
      return {
        result: false,
        message: 'Task ID is required',
        errorCode: 1
      };
    }
    const appState = getAppState();
    const task = appState.tasks?.[task_id] as TaskState | undefined;
    if (!task) {
      return {
        result: false,
        message: `No task found with ID: ${task_id}`,
        errorCode: 2
      };
    }
    return {
      result: true
    };
  },
  async call(input: TaskOutputToolInput, toolUseContext, _canUseTool, _parentMessage, onProgress) {
    const {
      task_id,
      block,
      timeout
    } = input;
    const appState = toolUseContext.getAppState();
    const task = appState.tasks?.[task_id] as TaskState | undefined;
    if (!task) {
      throw new Error(`No task found with ID: ${task_id}`);
    }
    if (!block) {
      // Non-blocking: return current state
      if (task.status !== 'running' && task.status !== 'pending') {
        // Mark as notified
        updateTaskState(task_id, toolUseContext.setAppState, t => ({
          ...t,
          notified: true
        }));
        return {
          data: {
            retrieval_status: 'success' as const,
            task: await getTaskOutputData(task)
          }
        };
      }
      return {
        data: {
          retrieval_status: 'not_ready' as const,
          task: await getTaskOutputData(task)
        }
      };
    }

    // Blocking: wait for completion
    if (onProgress) {
      onProgress({
        toolUseID: `task-output-waiting-${Date.now()}`,
        data: {
          type: 'waiting_for_task',
          taskDescription: task.description,
          taskType: task.type
        }
      });
    }
    const completedTask = await waitForTaskCompletion(task_id, toolUseContext.getAppState, timeout, toolUseContext.abortController);
    if (!completedTask) {
      return {
        data: {
          retrieval_status: 'timeout' as const,
          task: null
        }
      };
    }
    if (completedTask.status === 'running' || completedTask.status === 'pending') {
      return {
        data: {
          retrieval_status: 'timeout' as const,
          task: await getTaskOutputData(completedTask)
        }
      };
    }

    // Mark as notified
    updateTaskState(task_id, toolUseContext.setAppState, t => ({
      ...t,
      notified: true
    }));
    return {
      data: {
        retrieval_status: 'success' as const,
        task: await getTaskOutputData(completedTask)
      }
    };
  },
  mapToolResultToToolResultBlockParam(data, toolUseID) {
    const parts: string[] = [];
    parts.push(`<retrieval_status>${data.retrieval_status}</retrieval_status>`);
    if (data.task) {
      parts.push(`<task_id>${data.task.task_id}</task_id>`);
      parts.push(`<task_type>${data.task.task_type}</task_type>`);
      parts.push(`<status>${data.task.status}</status>`);
      if (data.task.exitCode !== undefined && data.task.exitCode !== null) {
        parts.push(`<exit_code>${data.task.exitCode}</exit_code>`);
      }
      if (data.task.output?.trim()) {
        const {
          content
        } = formatTaskOutput(data.task.output, data.task.task_id);
        parts.push(`<output>\n${content.trimEnd()}\n</output>`);
      }
      if (data.task.error) {
        parts.push(`<error>${data.task.error}</error>`);
      }
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: parts.join('\n\n')
    };
  },
  renderToolUseMessage(input) {
    const {
      block = true
    } = input;
    if (!block) {
      return 'non-blocking';
    }
    return '';
  },
  renderToolUseTag(input) {
    if (!input.task_id) {
      return null;
    }
    return <Text dimColor> {input.task_id}</Text>;
  },
  renderToolUseProgressMessage(progressMessages) {
    const lastProgress = progressMessages[progressMessages.length - 1];
    const progressData = lastProgress?.data as {
      taskDescription?: string;
      taskType?: string;
    } | undefined;
    return <Box flexDirection="column">
          {progressData?.taskDescription && <Text>&nbsp;&nbsp;{progressData.taskDescription}</Text>}
          <Text>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Waiting for task{' '}
            <Text dimColor>(esc to give additional instructions)</Text>
          </Text>
        </Box>;
  },
  renderToolResultMessage(content, _, {
    verbose,
    theme
  }) {
    return <TaskOutputResultDisplay content={content} verbose={verbose} theme={theme} />;
  },
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />;
  },
  renderToolUseErrorMessage(result, {
    verbose
  }) {
    return <FallbackToolUseErrorMessage result={result} verbose={verbose} />;
  }
} satisfies ToolDef<InputSchema, TaskOutputToolOutput>);
function TaskOutputResultDisplay(t0) {
  const $ = _c(54);
  const {
    content,
    verbose: t1,
    theme
  } = t0;
  const verbose = t1 === undefined ? false : t1;
  const expandShortcut = useShortcutDisplay("app:toggleTranscript", "Global", "ctrl+o");
  let t2;
  if ($[0] !== content) {
    t2 = typeof content === "string" ? jsonParse(content) : content;
    $[0] = content;
    $[1] = t2;
  } else {
    t2 = $[1];
  }
  const result = t2;
  if (!result.task) {
    let t3;
    if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
      t3 = <MessageResponse><Text dimColor={true}>No task output available</Text></MessageResponse>;
      $[2] = t3;
    } else {
      t3 = $[2];
    }
    return t3;
  }
  const {
    task
  } = result;
  if (task.task_type === "local_bash") {
    let t3;
    if ($[3] !== task.error || $[4] !== task.output) {
      t3 = {
        stdout: task.output,
        stderr: "",
        isImage: false,
        dangerouslyDisableSandbox: true,
        returnCodeInterpretation: task.error
      };
      $[3] = task.error;
      $[4] = task.output;
      $[5] = t3;
    } else {
      t3 = $[5];
    }
    const bashOut = t3;
    let t4;
    if ($[6] !== bashOut || $[7] !== verbose) {
      t4 = <BashToolResultMessage content={bashOut} verbose={verbose} />;
      $[6] = bashOut;
      $[7] = verbose;
      $[8] = t4;
    } else {
      t4 = $[8];
    }
    return t4;
  }
  if (task.task_type === "local_agent") {
    const lineCount = task.result ? countCharInString(task.result, "\n") + 1 : 0;
    if (result.retrieval_status === "success") {
      if (verbose) {
        let t3;
        if ($[9] !== lineCount || $[10] !== task.description) {
          t3 = <Text>{task.description} ({lineCount} lines)</Text>;
          $[9] = lineCount;
          $[10] = task.description;
          $[11] = t3;
        } else {
          t3 = $[11];
        }
        let t4;
        if ($[12] !== task.prompt || $[13] !== theme) {
          t4 = task.prompt && <AgentPromptDisplay prompt={task.prompt} theme={theme} dim={true} />;
          $[12] = task.prompt;
          $[13] = theme;
          $[14] = t4;
        } else {
          t4 = $[14];
        }
        let t5;
        if ($[15] !== task.result || $[16] !== theme) {
          t5 = task.result && <Box marginTop={1}><AgentResponseDisplay content={[{
              type: "text",
              text: task.result
            }]} theme={theme} /></Box>;
          $[15] = task.result;
          $[16] = theme;
          $[17] = t5;
        } else {
          t5 = $[17];
        }
        let t6;
        if ($[18] !== task.error) {
          t6 = task.error && <Box flexDirection="column" marginTop={1}><Text color="error" bold={true}>Error:</Text><Box paddingLeft={2}><Text color="error">{task.error}</Text></Box></Box>;
          $[18] = task.error;
          $[19] = t6;
        } else {
          t6 = $[19];
        }
        let t7;
        if ($[20] !== t4 || $[21] !== t5 || $[22] !== t6) {
          t7 = <Box flexDirection="column" paddingLeft={2} marginTop={1}>{t4}{t5}{t6}</Box>;
          $[20] = t4;
          $[21] = t5;
          $[22] = t6;
          $[23] = t7;
        } else {
          t7 = $[23];
        }
        let t8;
        if ($[24] !== t3 || $[25] !== t7) {
          t8 = <Box flexDirection="column">{t3}{t7}</Box>;
          $[24] = t3;
          $[25] = t7;
          $[26] = t8;
        } else {
          t8 = $[26];
        }
        return t8;
      }
      let t3;
      if ($[27] !== expandShortcut) {
        t3 = <MessageResponse><Text dimColor={true}>Read output ({expandShortcut} to expand)</Text></MessageResponse>;
        $[27] = expandShortcut;
        $[28] = t3;
      } else {
        t3 = $[28];
      }
      return t3;
    }
    if (result.retrieval_status === "timeout" || task.status === "running") {
      let t3;
      if ($[29] === Symbol.for("react.memo_cache_sentinel")) {
        t3 = <MessageResponse><Text dimColor={true}>Task is still running…</Text></MessageResponse>;
        $[29] = t3;
      } else {
        t3 = $[29];
      }
      return t3;
    }
    if (result.retrieval_status === "not_ready") {
      let t3;
      if ($[30] === Symbol.for("react.memo_cache_sentinel")) {
        t3 = <MessageResponse><Text dimColor={true}>Task is still running…</Text></MessageResponse>;
        $[30] = t3;
      } else {
        t3 = $[30];
      }
      return t3;
    }
    let t3;
    if ($[31] === Symbol.for("react.memo_cache_sentinel")) {
      t3 = <MessageResponse><Text dimColor={true}>Task not ready</Text></MessageResponse>;
      $[31] = t3;
    } else {
      t3 = $[31];
    }
    return t3;
  }
  if (task.task_type === "remote_agent") {
    let t3;
    if ($[32] !== task.description || $[33] !== task.status) {
      t3 = <Text>  {task.description} [{task.status}]</Text>;
      $[32] = task.description;
      $[33] = task.status;
      $[34] = t3;
    } else {
      t3 = $[34];
    }
    let t4;
    if ($[35] !== task.output || $[36] !== verbose) {
      t4 = task.output && verbose && <Box paddingLeft={4} marginTop={1}><Text>{task.output}</Text></Box>;
      $[35] = task.output;
      $[36] = verbose;
      $[37] = t4;
    } else {
      t4 = $[37];
    }
    let t5;
    if ($[38] !== expandShortcut || $[39] !== task.output || $[40] !== verbose) {
      t5 = !verbose && task.output && <Text dimColor={true}>{"     "}({expandShortcut} to expand)</Text>;
      $[38] = expandShortcut;
      $[39] = task.output;
      $[40] = verbose;
      $[41] = t5;
    } else {
      t5 = $[41];
    }
    let t6;
    if ($[42] !== t3 || $[43] !== t4 || $[44] !== t5) {
      t6 = <Box flexDirection="column">{t3}{t4}{t5}</Box>;
      $[42] = t3;
      $[43] = t4;
      $[44] = t5;
      $[45] = t6;
    } else {
      t6 = $[45];
    }
    return t6;
  }
  let t3;
  if ($[46] !== task.description || $[47] !== task.status) {
    t3 = <Text>  {task.description} [{task.status}]</Text>;
    $[46] = task.description;
    $[47] = task.status;
    $[48] = t3;
  } else {
    t3 = $[48];
  }
  let t4;
  if ($[49] !== task.output) {
    t4 = task.output && <Box paddingLeft={4}><Text>{task.output.slice(0, 500)}</Text></Box>;
    $[49] = task.output;
    $[50] = t4;
  } else {
    t4 = $[50];
  }
  let t5;
  if ($[51] !== t3 || $[52] !== t4) {
    t5 = <Box flexDirection="column">{t3}{t4}</Box>;
    $[51] = t3;
    $[52] = t4;
    $[53] = t5;
  } else {
    t5 = $[53];
  }
  return t5;
}
export default TaskOutputTool;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsInoiLCJGYWxsYmFja1Rvb2xVc2VFcnJvck1lc3NhZ2UiLCJGYWxsYmFja1Rvb2xVc2VSZWplY3RlZE1lc3NhZ2UiLCJNZXNzYWdlUmVzcG9uc2UiLCJCb3giLCJUZXh0IiwidXNlU2hvcnRjdXREaXNwbGF5IiwiVGFza1R5cGUiLCJUb29sIiwiYnVpbGRUb29sIiwiVG9vbERlZiIsIkxvY2FsQWdlbnRUYXNrU3RhdGUiLCJMb2NhbFNoZWxsVGFza1N0YXRlIiwiUmVtb3RlQWdlbnRUYXNrU3RhdGUiLCJUYXNrU3RhdGUiLCJBYm9ydEVycm9yIiwibGF6eVNjaGVtYSIsImV4dHJhY3RUZXh0Q29udGVudCIsInNlbWFudGljQm9vbGVhbiIsInNsZWVwIiwianNvblBhcnNlIiwiY291bnRDaGFySW5TdHJpbmciLCJnZXRUYXNrT3V0cHV0IiwidXBkYXRlVGFza1N0YXRlIiwiZm9ybWF0VGFza091dHB1dCIsIlRoZW1lTmFtZSIsIkFnZW50UHJvbXB0RGlzcGxheSIsIkFnZW50UmVzcG9uc2VEaXNwbGF5IiwiQmFzaFRvb2xSZXN1bHRNZXNzYWdlIiwiVEFTS19PVVRQVVRfVE9PTF9OQU1FIiwiaW5wdXRTY2hlbWEiLCJzdHJpY3RPYmplY3QiLCJ0YXNrX2lkIiwic3RyaW5nIiwiZGVzY3JpYmUiLCJibG9jayIsImJvb2xlYW4iLCJkZWZhdWx0IiwidGltZW91dCIsIm51bWJlciIsIm1pbiIsIm1heCIsIklucHV0U2NoZW1hIiwiUmV0dXJuVHlwZSIsIlRhc2tPdXRwdXRUb29sSW5wdXQiLCJpbmZlciIsIlRhc2tPdXRwdXQiLCJ0YXNrX3R5cGUiLCJzdGF0dXMiLCJkZXNjcmlwdGlvbiIsIm91dHB1dCIsImV4aXRDb2RlIiwiZXJyb3IiLCJwcm9tcHQiLCJyZXN1bHQiLCJUYXNrT3V0cHV0VG9vbE91dHB1dCIsInJldHJpZXZhbF9zdGF0dXMiLCJ0YXNrIiwiVGFza091dHB1dFByb2dyZXNzIiwiUHJvZ3Jlc3MiLCJnZXRUYXNrT3V0cHV0RGF0YSIsIlByb21pc2UiLCJ0eXBlIiwiYmFzaFRhc2siLCJ0YXNrT3V0cHV0T2JqIiwic2hlbGxDb21tYW5kIiwidGFza091dHB1dCIsInN0ZG91dCIsImdldFN0ZG91dCIsInN0ZGVyciIsImdldFN0ZGVyciIsImZpbHRlciIsIkJvb2xlYW4iLCJqb2luIiwiaWQiLCJiYXNlT3V0cHV0IiwiY29kZSIsImFnZW50VGFzayIsImNsZWFuUmVzdWx0IiwiY29udGVudCIsInVuZGVmaW5lZCIsInJlbW90ZVRhc2siLCJjb21tYW5kIiwid2FpdEZvclRhc2tDb21wbGV0aW9uIiwidGFza0lkIiwiZ2V0QXBwU3RhdGUiLCJ0YXNrcyIsIlJlY29yZCIsInRpbWVvdXRNcyIsImFib3J0Q29udHJvbGxlciIsIkFib3J0Q29udHJvbGxlciIsInN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJzaWduYWwiLCJhYm9ydGVkIiwic3RhdGUiLCJmaW5hbFN0YXRlIiwiVGFza091dHB1dFRvb2wiLCJuYW1lIiwic2VhcmNoSGludCIsIm1heFJlc3VsdFNpemVDaGFycyIsInNob3VsZERlZmVyIiwiYWxpYXNlcyIsInVzZXJGYWNpbmdOYW1lIiwiaXNDb25jdXJyZW5jeVNhZmUiLCJfaW5wdXQiLCJpc1JlYWRPbmx5IiwiaXNFbmFibGVkIiwidG9BdXRvQ2xhc3NpZmllcklucHV0IiwiaW5wdXQiLCJ2YWxpZGF0ZUlucHV0IiwibWVzc2FnZSIsImVycm9yQ29kZSIsImFwcFN0YXRlIiwiY2FsbCIsInRvb2xVc2VDb250ZXh0IiwiX2NhblVzZVRvb2wiLCJfcGFyZW50TWVzc2FnZSIsIm9uUHJvZ3Jlc3MiLCJFcnJvciIsInNldEFwcFN0YXRlIiwidCIsIm5vdGlmaWVkIiwiZGF0YSIsImNvbnN0IiwidG9vbFVzZUlEIiwidGFza0Rlc2NyaXB0aW9uIiwidGFza1R5cGUiLCJjb21wbGV0ZWRUYXNrIiwibWFwVG9vbFJlc3VsdFRvVG9vbFJlc3VsdEJsb2NrUGFyYW0iLCJwYXJ0cyIsInB1c2giLCJ0cmltIiwidHJpbUVuZCIsInRvb2xfdXNlX2lkIiwicmVuZGVyVG9vbFVzZU1lc3NhZ2UiLCJyZW5kZXJUb29sVXNlVGFnIiwicmVuZGVyVG9vbFVzZVByb2dyZXNzTWVzc2FnZSIsInByb2dyZXNzTWVzc2FnZXMiLCJsYXN0UHJvZ3Jlc3MiLCJsZW5ndGgiLCJwcm9ncmVzc0RhdGEiLCJyZW5kZXJUb29sUmVzdWx0TWVzc2FnZSIsIl8iLCJ2ZXJib3NlIiwidGhlbWUiLCJyZW5kZXJUb29sVXNlUmVqZWN0ZWRNZXNzYWdlIiwicmVuZGVyVG9vbFVzZUVycm9yTWVzc2FnZSIsIlRhc2tPdXRwdXRSZXN1bHREaXNwbGF5IiwidDAiLCIkIiwiX2MiLCJ0MSIsImV4cGFuZFNob3J0Y3V0IiwidDIiLCJ0MyIsIlN5bWJvbCIsImZvciIsImlzSW1hZ2UiLCJkYW5nZXJvdXNseURpc2FibGVTYW5kYm94IiwicmV0dXJuQ29kZUludGVycHJldGF0aW9uIiwiYmFzaE91dCIsInQ0IiwibGluZUNvdW50IiwidDUiLCJ0ZXh0IiwidDYiLCJ0NyIsInQ4Iiwic2xpY2UiXSwic291cmNlcyI6WyJUYXNrT3V0cHV0VG9vbC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgeiB9IGZyb20gJ3pvZC92NCdcbmltcG9ydCB7IEZhbGxiYWNrVG9vbFVzZUVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvRmFsbGJhY2tUb29sVXNlRXJyb3JNZXNzYWdlLmpzJ1xuaW1wb3J0IHsgRmFsbGJhY2tUb29sVXNlUmVqZWN0ZWRNZXNzYWdlIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9GYWxsYmFja1Rvb2xVc2VSZWplY3RlZE1lc3NhZ2UuanMnXG5pbXBvcnQgeyBNZXNzYWdlUmVzcG9uc2UgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL01lc3NhZ2VSZXNwb25zZS5qcydcbmltcG9ydCB7IEJveCwgVGV4dCB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7IHVzZVNob3J0Y3V0RGlzcGxheSB9IGZyb20gJy4uLy4uL2tleWJpbmRpbmdzL3VzZVNob3J0Y3V0RGlzcGxheS5qcydcbmltcG9ydCB0eXBlIHsgVGFza1R5cGUgfSBmcm9tICcuLi8uLi9UYXNrLmpzJ1xuaW1wb3J0IHR5cGUgeyBUb29sIH0gZnJvbSAnLi4vLi4vVG9vbC5qcydcbmltcG9ydCB7IGJ1aWxkVG9vbCwgdHlwZSBUb29sRGVmIH0gZnJvbSAnLi4vLi4vVG9vbC5qcydcbmltcG9ydCB0eXBlIHsgTG9jYWxBZ2VudFRhc2tTdGF0ZSB9IGZyb20gJy4uLy4uL3Rhc2tzL0xvY2FsQWdlbnRUYXNrL0xvY2FsQWdlbnRUYXNrLmpzJ1xuaW1wb3J0IHR5cGUgeyBMb2NhbFNoZWxsVGFza1N0YXRlIH0gZnJvbSAnLi4vLi4vdGFza3MvTG9jYWxTaGVsbFRhc2svZ3VhcmRzLmpzJ1xuaW1wb3J0IHR5cGUgeyBSZW1vdGVBZ2VudFRhc2tTdGF0ZSB9IGZyb20gJy4uLy4uL3Rhc2tzL1JlbW90ZUFnZW50VGFzay9SZW1vdGVBZ2VudFRhc2suanMnXG5pbXBvcnQgdHlwZSB7IFRhc2tTdGF0ZSB9IGZyb20gJy4uLy4uL3Rhc2tzL3R5cGVzLmpzJ1xuaW1wb3J0IHsgQWJvcnRFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9ycy5qcydcbmltcG9ydCB7IGxhenlTY2hlbWEgfSBmcm9tICcuLi8uLi91dGlscy9sYXp5U2NoZW1hLmpzJ1xuaW1wb3J0IHsgZXh0cmFjdFRleHRDb250ZW50IH0gZnJvbSAnLi4vLi4vdXRpbHMvbWVzc2FnZXMuanMnXG5pbXBvcnQgeyBzZW1hbnRpY0Jvb2xlYW4gfSBmcm9tICcuLi8uLi91dGlscy9zZW1hbnRpY0Jvb2xlYW4uanMnXG5pbXBvcnQgeyBzbGVlcCB9IGZyb20gJy4uLy4uL3V0aWxzL3NsZWVwLmpzJ1xuaW1wb3J0IHsganNvblBhcnNlIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2xvd09wZXJhdGlvbnMuanMnXG5pbXBvcnQgeyBjb3VudENoYXJJblN0cmluZyB9IGZyb20gJy4uLy4uL3V0aWxzL3N0cmluZ1V0aWxzLmpzJ1xuaW1wb3J0IHsgZ2V0VGFza091dHB1dCB9IGZyb20gJy4uLy4uL3V0aWxzL3Rhc2svZGlza091dHB1dC5qcydcbmltcG9ydCB7IHVwZGF0ZVRhc2tTdGF0ZSB9IGZyb20gJy4uLy4uL3V0aWxzL3Rhc2svZnJhbWV3b3JrLmpzJ1xuaW1wb3J0IHsgZm9ybWF0VGFza091dHB1dCB9IGZyb20gJy4uLy4uL3V0aWxzL3Rhc2svb3V0cHV0Rm9ybWF0dGluZy5qcydcbmltcG9ydCB0eXBlIHsgVGhlbWVOYW1lIH0gZnJvbSAnLi4vLi4vdXRpbHMvdGhlbWUuanMnXG5pbXBvcnQgeyBBZ2VudFByb21wdERpc3BsYXksIEFnZW50UmVzcG9uc2VEaXNwbGF5IH0gZnJvbSAnLi4vQWdlbnRUb29sL1VJLmpzJ1xuaW1wb3J0IEJhc2hUb29sUmVzdWx0TWVzc2FnZSBmcm9tICcuLi9CYXNoVG9vbC9CYXNoVG9vbFJlc3VsdE1lc3NhZ2UuanMnXG5pbXBvcnQgeyBUQVNLX09VVFBVVF9UT09MX05BTUUgfSBmcm9tICcuL2NvbnN0YW50cy5qcydcblxuY29uc3QgaW5wdXRTY2hlbWEgPSBsYXp5U2NoZW1hKCgpID0+XG4gIHouc3RyaWN0T2JqZWN0KHtcbiAgICB0YXNrX2lkOiB6LnN0cmluZygpLmRlc2NyaWJlKCdUaGUgdGFzayBJRCB0byBnZXQgb3V0cHV0IGZyb20nKSxcbiAgICBibG9jazogc2VtYW50aWNCb29sZWFuKHouYm9vbGVhbigpLmRlZmF1bHQodHJ1ZSkpLmRlc2NyaWJlKFxuICAgICAgJ1doZXRoZXIgdG8gd2FpdCBmb3IgY29tcGxldGlvbicsXG4gICAgKSxcbiAgICB0aW1lb3V0OiB6XG4gICAgICAubnVtYmVyKClcbiAgICAgIC5taW4oMClcbiAgICAgIC5tYXgoNjAwMDAwKVxuICAgICAgLmRlZmF1bHQoMzAwMDApXG4gICAgICAuZGVzY3JpYmUoJ01heCB3YWl0IHRpbWUgaW4gbXMnKSxcbiAgfSksXG4pXG50eXBlIElucHV0U2NoZW1hID0gUmV0dXJuVHlwZTx0eXBlb2YgaW5wdXRTY2hlbWE+XG5cbnR5cGUgVGFza091dHB1dFRvb2xJbnB1dCA9IHouaW5mZXI8SW5wdXRTY2hlbWE+XG5cbi8vIFVuaWZpZWQgb3V0cHV0IHR5cGUgY292ZXJpbmcgYWxsIHRhc2sgdHlwZXNcbnR5cGUgVGFza091dHB1dCA9IHtcbiAgdGFza19pZDogc3RyaW5nXG4gIHRhc2tfdHlwZTogVGFza1R5cGVcbiAgc3RhdHVzOiBzdHJpbmdcbiAgZGVzY3JpcHRpb246IHN0cmluZ1xuICBvdXRwdXQ6IHN0cmluZ1xuICBleGl0Q29kZT86IG51bWJlciB8IG51bGxcbiAgZXJyb3I/OiBzdHJpbmdcbiAgLy8gRm9yIGFnZW50c1xuICBwcm9tcHQ/OiBzdHJpbmdcbiAgcmVzdWx0Pzogc3RyaW5nXG59XG5cbnR5cGUgVGFza091dHB1dFRvb2xPdXRwdXQgPSB7XG4gIHJldHJpZXZhbF9zdGF0dXM6ICdzdWNjZXNzJyB8ICd0aW1lb3V0JyB8ICdub3RfcmVhZHknXG4gIHRhc2s6IFRhc2tPdXRwdXQgfCBudWxsXG59XG5cbi8vIFJlLWV4cG9ydCBQcm9ncmVzcyBmcm9tIGNlbnRyYWxpemVkIHR5cGVzIHRvIGJyZWFrIGltcG9ydCBjeWNsZXNcbmV4cG9ydCB0eXBlIHsgVGFza091dHB1dFByb2dyZXNzIGFzIFByb2dyZXNzIH0gZnJvbSAnLi4vLi4vdHlwZXMvdG9vbHMuanMnXG5cbi8vIEdldCBvdXRwdXQgZm9yIGFueSB0YXNrIHR5cGVcbmFzeW5jIGZ1bmN0aW9uIGdldFRhc2tPdXRwdXREYXRhKHRhc2s6IFRhc2tTdGF0ZSk6IFByb21pc2U8VGFza091dHB1dD4ge1xuICBsZXQgb3V0cHV0OiBzdHJpbmdcbiAgaWYgKHRhc2sudHlwZSA9PT0gJ2xvY2FsX2Jhc2gnKSB7XG4gICAgY29uc3QgYmFzaFRhc2sgPSB0YXNrIGFzIExvY2FsU2hlbGxUYXNrU3RhdGVcbiAgICBjb25zdCB0YXNrT3V0cHV0T2JqID0gYmFzaFRhc2suc2hlbGxDb21tYW5kPy50YXNrT3V0cHV0XG4gICAgaWYgKHRhc2tPdXRwdXRPYmopIHtcbiAgICAgIGNvbnN0IHN0ZG91dCA9IGF3YWl0IHRhc2tPdXRwdXRPYmouZ2V0U3Rkb3V0KClcbiAgICAgIGNvbnN0IHN0ZGVyciA9IHRhc2tPdXRwdXRPYmouZ2V0U3RkZXJyKClcbiAgICAgIG91dHB1dCA9IFtzdGRvdXQsIHN0ZGVycl0uZmlsdGVyKEJvb2xlYW4pLmpvaW4oJ1xcbicpXG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dCA9IGF3YWl0IGdldFRhc2tPdXRwdXQodGFzay5pZClcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgb3V0cHV0ID0gYXdhaXQgZ2V0VGFza091dHB1dCh0YXNrLmlkKVxuICB9XG5cbiAgY29uc3QgYmFzZU91dHB1dDogVGFza091dHB1dCA9IHtcbiAgICB0YXNrX2lkOiB0YXNrLmlkLFxuICAgIHRhc2tfdHlwZTogdGFzay50eXBlLFxuICAgIHN0YXR1czogdGFzay5zdGF0dXMsXG4gICAgZGVzY3JpcHRpb246IHRhc2suZGVzY3JpcHRpb24sXG4gICAgb3V0cHV0LFxuICB9XG5cbiAgLy8gQWRkIHR5cGUtc3BlY2lmaWMgZmllbGRzXG4gIGlmICh0YXNrLnR5cGUgPT09ICdsb2NhbF9iYXNoJykge1xuICAgIGNvbnN0IGJhc2hUYXNrID0gdGFzayBhcyBMb2NhbFNoZWxsVGFza1N0YXRlXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2VPdXRwdXQsXG4gICAgICBleGl0Q29kZTogYmFzaFRhc2sucmVzdWx0Py5jb2RlID8/IG51bGwsXG4gICAgfVxuICB9XG5cbiAgaWYgKHRhc2sudHlwZSA9PT0gJ2xvY2FsX2FnZW50Jykge1xuICAgIGNvbnN0IGFnZW50VGFzayA9IHRhc2sgYXMgTG9jYWxBZ2VudFRhc2tTdGF0ZVxuICAgIC8vIFByZWZlciB0aGUgY2xlYW4gZmluYWwgYW5zd2VyIGZyb20gdGhlIGluLW1lbW9yeSByZXN1bHQgb3ZlciB0aGUgcmF3XG4gICAgLy8gSlNPTkwgdHJhbnNjcmlwdCBvbiBkaXNrLiBUaGUgZGlzayBvdXRwdXQgaXMgYSBzeW1saW5rIHRvIHRoZSBmdWxsXG4gICAgLy8gc2Vzc2lvbiB0cmFuc2NyaXB0IChldmVyeSBtZXNzYWdlLCB0b29sIHVzZSwgZXRjLiksIG5vdCBqdXN0IHRoZVxuICAgIC8vIHN1YmFnZW50J3MgYW5zd2VyLiBUaGUgaW4tbWVtb3J5IHJlc3VsdCBjb250YWlucyBvbmx5IHRoZSBmaW5hbFxuICAgIC8vIGFzc2lzdGFudCB0ZXh0IGNvbnRlbnQgYmxvY2tzLlxuICAgIGNvbnN0IGNsZWFuUmVzdWx0ID0gYWdlbnRUYXNrLnJlc3VsdFxuICAgICAgPyBleHRyYWN0VGV4dENvbnRlbnQoYWdlbnRUYXNrLnJlc3VsdC5jb250ZW50LCAnXFxuJylcbiAgICAgIDogdW5kZWZpbmVkXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2VPdXRwdXQsXG4gICAgICBwcm9tcHQ6IGFnZW50VGFzay5wcm9tcHQsXG4gICAgICByZXN1bHQ6IGNsZWFuUmVzdWx0IHx8IG91dHB1dCxcbiAgICAgIG91dHB1dDogY2xlYW5SZXN1bHQgfHwgb3V0cHV0LFxuICAgICAgZXJyb3I6IGFnZW50VGFzay5lcnJvcixcbiAgICB9XG4gIH1cblxuICBpZiAodGFzay50eXBlID09PSAncmVtb3RlX2FnZW50Jykge1xuICAgIGNvbnN0IHJlbW90ZVRhc2sgPSB0YXNrIGFzIFJlbW90ZUFnZW50VGFza1N0YXRlXG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmJhc2VPdXRwdXQsXG4gICAgICBwcm9tcHQ6IHJlbW90ZVRhc2suY29tbWFuZCxcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYmFzZU91dHB1dFxufVxuXG4vLyBXYWl0IGZvciB0YXNrIHRvIGNvbXBsZXRlXG5hc3luYyBmdW5jdGlvbiB3YWl0Rm9yVGFza0NvbXBsZXRpb24oXG4gIHRhc2tJZDogc3RyaW5nLFxuICBnZXRBcHBTdGF0ZTogKCkgPT4geyB0YXNrcz86IFJlY29yZDxzdHJpbmcsIFRhc2tTdGF0ZT4gfSxcbiAgdGltZW91dE1zOiBudW1iZXIsXG4gIGFib3J0Q29udHJvbGxlcj86IEFib3J0Q29udHJvbGxlcixcbik6IFByb21pc2U8VGFza1N0YXRlIHwgbnVsbD4ge1xuICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpXG5cbiAgd2hpbGUgKERhdGUubm93KCkgLSBzdGFydFRpbWUgPCB0aW1lb3V0TXMpIHtcbiAgICAvLyBDaGVjayBhYm9ydCBzaWduYWxcbiAgICBpZiAoYWJvcnRDb250cm9sbGVyPy5zaWduYWwuYWJvcnRlZCkge1xuICAgICAgdGhyb3cgbmV3IEFib3J0RXJyb3IoKVxuICAgIH1cblxuICAgIGNvbnN0IHN0YXRlID0gZ2V0QXBwU3RhdGUoKVxuICAgIGNvbnN0IHRhc2sgPSBzdGF0ZS50YXNrcz8uW3Rhc2tJZF0gYXMgVGFza1N0YXRlIHwgdW5kZWZpbmVkXG5cbiAgICBpZiAoIXRhc2spIHtcbiAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgaWYgKHRhc2suc3RhdHVzICE9PSAncnVubmluZycgJiYgdGFzay5zdGF0dXMgIT09ICdwZW5kaW5nJykge1xuICAgICAgcmV0dXJuIHRhc2tcbiAgICB9XG5cbiAgICAvLyBXYWl0IGJlZm9yZSBwb2xsaW5nIGFnYWluXG4gICAgYXdhaXQgc2xlZXAoMTAwKVxuICB9XG5cbiAgLy8gVGltZW91dCAtIHJldHVybiBjdXJyZW50IHN0YXRlXG4gIGNvbnN0IGZpbmFsU3RhdGUgPSBnZXRBcHBTdGF0ZSgpXG4gIHJldHVybiAoZmluYWxTdGF0ZS50YXNrcz8uW3Rhc2tJZF0gYXMgVGFza1N0YXRlKSA/PyBudWxsXG59XG5cbmV4cG9ydCBjb25zdCBUYXNrT3V0cHV0VG9vbDogVG9vbDxJbnB1dFNjaGVtYSwgVGFza091dHB1dFRvb2xPdXRwdXQ+ID1cbiAgYnVpbGRUb29sKHtcbiAgICBuYW1lOiBUQVNLX09VVFBVVF9UT09MX05BTUUsXG4gICAgc2VhcmNoSGludDogJ3JlYWQgb3V0cHV0L2xvZ3MgZnJvbSBhIGJhY2tncm91bmQgdGFzaycsXG4gICAgbWF4UmVzdWx0U2l6ZUNoYXJzOiAxMDBfMDAwLFxuICAgIHNob3VsZERlZmVyOiB0cnVlLFxuICAgIC8vIEJhY2t3YXJkcy1jb21wYXRpYmxlIGFsaWFzZXMgZm9yIHJlbmFtZWQgdG9vbHNcbiAgICBhbGlhc2VzOiBbJ0FnZW50T3V0cHV0VG9vbCcsICdCYXNoT3V0cHV0VG9vbCddLFxuXG4gICAgdXNlckZhY2luZ05hbWUoKSB7XG4gICAgICByZXR1cm4gJ1Rhc2sgT3V0cHV0J1xuICAgIH0sXG5cbiAgICBnZXQgaW5wdXRTY2hlbWEoKTogSW5wdXRTY2hlbWEge1xuICAgICAgcmV0dXJuIGlucHV0U2NoZW1hKClcbiAgICB9LFxuXG4gICAgYXN5bmMgZGVzY3JpcHRpb24oKSB7XG4gICAgICByZXR1cm4gJ1tEZXByZWNhdGVkXSDigJQgcHJlZmVyIFJlYWQgb24gdGhlIHRhc2sgb3V0cHV0IGZpbGUgcGF0aCdcbiAgICB9LFxuXG4gICAgaXNDb25jdXJyZW5jeVNhZmUoX2lucHV0KSB7XG4gICAgICByZXR1cm4gdGhpcy5pc1JlYWRPbmx5Py4oX2lucHV0KSA/PyBmYWxzZVxuICAgIH0sXG5cbiAgICBpc0VuYWJsZWQoKSB7XG4gICAgICByZXR1cm4gXCJleHRlcm5hbFwiICE9PSAnYW50J1xuICAgIH0sXG5cbiAgICBpc1JlYWRPbmx5KF9pbnB1dCkge1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9LFxuICAgIHRvQXV0b0NsYXNzaWZpZXJJbnB1dChpbnB1dCkge1xuICAgICAgcmV0dXJuIGlucHV0LnRhc2tfaWRcbiAgICB9LFxuXG4gICAgYXN5bmMgcHJvbXB0KCkge1xuICAgICAgcmV0dXJuIGBERVBSRUNBVEVEOiBQcmVmZXIgdXNpbmcgdGhlIFJlYWQgdG9vbCBvbiB0aGUgdGFzaydzIG91dHB1dCBmaWxlIHBhdGggaW5zdGVhZC4gQmFja2dyb3VuZCB0YXNrcyByZXR1cm4gdGhlaXIgb3V0cHV0IGZpbGUgcGF0aCBpbiB0aGUgdG9vbCByZXN1bHQsIGFuZCB5b3UgcmVjZWl2ZSBhIDx0YXNrLW5vdGlmaWNhdGlvbj4gd2l0aCB0aGUgc2FtZSBwYXRoIHdoZW4gdGhlIHRhc2sgY29tcGxldGVzIOKAlCBSZWFkIHRoYXQgZmlsZSBkaXJlY3RseS5cblxuLSBSZXRyaWV2ZXMgb3V0cHV0IGZyb20gYSBydW5uaW5nIG9yIGNvbXBsZXRlZCB0YXNrIChiYWNrZ3JvdW5kIHNoZWxsLCBhZ2VudCwgb3IgcmVtb3RlIHNlc3Npb24pXG4tIFRha2VzIGEgdGFza19pZCBwYXJhbWV0ZXIgaWRlbnRpZnlpbmcgdGhlIHRhc2tcbi0gUmV0dXJucyB0aGUgdGFzayBvdXRwdXQgYWxvbmcgd2l0aCBzdGF0dXMgaW5mb3JtYXRpb25cbi0gVXNlIGJsb2NrPXRydWUgKGRlZmF1bHQpIHRvIHdhaXQgZm9yIHRhc2sgY29tcGxldGlvblxuLSBVc2UgYmxvY2s9ZmFsc2UgZm9yIG5vbi1ibG9ja2luZyBjaGVjayBvZiBjdXJyZW50IHN0YXR1c1xuLSBUYXNrIElEcyBjYW4gYmUgZm91bmQgdXNpbmcgdGhlIC90YXNrcyBjb21tYW5kXG4tIFdvcmtzIHdpdGggYWxsIHRhc2sgdHlwZXM6IGJhY2tncm91bmQgc2hlbGxzLCBhc3luYyBhZ2VudHMsIGFuZCByZW1vdGUgc2Vzc2lvbnNgXG4gICAgfSxcblxuICAgIGFzeW5jIHZhbGlkYXRlSW5wdXQoeyB0YXNrX2lkIH0sIHsgZ2V0QXBwU3RhdGUgfSkge1xuICAgICAgaWYgKCF0YXNrX2lkKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcmVzdWx0OiBmYWxzZSxcbiAgICAgICAgICBtZXNzYWdlOiAnVGFzayBJRCBpcyByZXF1aXJlZCcsXG4gICAgICAgICAgZXJyb3JDb2RlOiAxLFxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGFwcFN0YXRlID0gZ2V0QXBwU3RhdGUoKVxuICAgICAgY29uc3QgdGFzayA9IGFwcFN0YXRlLnRhc2tzPy5bdGFza19pZF0gYXMgVGFza1N0YXRlIHwgdW5kZWZpbmVkXG5cbiAgICAgIGlmICghdGFzaykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHJlc3VsdDogZmFsc2UsXG4gICAgICAgICAgbWVzc2FnZTogYE5vIHRhc2sgZm91bmQgd2l0aCBJRDogJHt0YXNrX2lkfWAsXG4gICAgICAgICAgZXJyb3JDb2RlOiAyLFxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7IHJlc3VsdDogdHJ1ZSB9XG4gICAgfSxcblxuICAgIGFzeW5jIGNhbGwoXG4gICAgICBpbnB1dDogVGFza091dHB1dFRvb2xJbnB1dCxcbiAgICAgIHRvb2xVc2VDb250ZXh0LFxuICAgICAgX2NhblVzZVRvb2wsXG4gICAgICBfcGFyZW50TWVzc2FnZSxcbiAgICAgIG9uUHJvZ3Jlc3MsXG4gICAgKSB7XG4gICAgICBjb25zdCB7IHRhc2tfaWQsIGJsb2NrLCB0aW1lb3V0IH0gPSBpbnB1dFxuXG4gICAgICBjb25zdCBhcHBTdGF0ZSA9IHRvb2xVc2VDb250ZXh0LmdldEFwcFN0YXRlKClcbiAgICAgIGNvbnN0IHRhc2sgPSBhcHBTdGF0ZS50YXNrcz8uW3Rhc2tfaWRdIGFzIFRhc2tTdGF0ZSB8IHVuZGVmaW5lZFxuXG4gICAgICBpZiAoIXRhc2spIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyB0YXNrIGZvdW5kIHdpdGggSUQ6ICR7dGFza19pZH1gKVxuICAgICAgfVxuXG4gICAgICBpZiAoIWJsb2NrKSB7XG4gICAgICAgIC8vIE5vbi1ibG9ja2luZzogcmV0dXJuIGN1cnJlbnQgc3RhdGVcbiAgICAgICAgaWYgKHRhc2suc3RhdHVzICE9PSAncnVubmluZycgJiYgdGFzay5zdGF0dXMgIT09ICdwZW5kaW5nJykge1xuICAgICAgICAgIC8vIE1hcmsgYXMgbm90aWZpZWRcbiAgICAgICAgICB1cGRhdGVUYXNrU3RhdGUodGFza19pZCwgdG9vbFVzZUNvbnRleHQuc2V0QXBwU3RhdGUsIHQgPT4gKHtcbiAgICAgICAgICAgIC4uLnQsXG4gICAgICAgICAgICBub3RpZmllZDogdHJ1ZSxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICByZXRyaWV2YWxfc3RhdHVzOiAnc3VjY2VzcycgYXMgY29uc3QsXG4gICAgICAgICAgICAgIHRhc2s6IGF3YWl0IGdldFRhc2tPdXRwdXREYXRhKHRhc2spLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICByZXRyaWV2YWxfc3RhdHVzOiAnbm90X3JlYWR5JyBhcyBjb25zdCxcbiAgICAgICAgICAgIHRhc2s6IGF3YWl0IGdldFRhc2tPdXRwdXREYXRhKHRhc2spLFxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQmxvY2tpbmc6IHdhaXQgZm9yIGNvbXBsZXRpb25cbiAgICAgIGlmIChvblByb2dyZXNzKSB7XG4gICAgICAgIG9uUHJvZ3Jlc3Moe1xuICAgICAgICAgIHRvb2xVc2VJRDogYHRhc2stb3V0cHV0LXdhaXRpbmctJHtEYXRlLm5vdygpfWAsXG4gICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgdHlwZTogJ3dhaXRpbmdfZm9yX3Rhc2snLFxuICAgICAgICAgICAgdGFza0Rlc2NyaXB0aW9uOiB0YXNrLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgdGFza1R5cGU6IHRhc2sudHlwZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICBjb25zdCBjb21wbGV0ZWRUYXNrID0gYXdhaXQgd2FpdEZvclRhc2tDb21wbGV0aW9uKFxuICAgICAgICB0YXNrX2lkLFxuICAgICAgICB0b29sVXNlQ29udGV4dC5nZXRBcHBTdGF0ZSxcbiAgICAgICAgdGltZW91dCxcbiAgICAgICAgdG9vbFVzZUNvbnRleHQuYWJvcnRDb250cm9sbGVyLFxuICAgICAgKVxuXG4gICAgICBpZiAoIWNvbXBsZXRlZFRhc2spIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICByZXRyaWV2YWxfc3RhdHVzOiAndGltZW91dCcgYXMgY29uc3QsXG4gICAgICAgICAgICB0YXNrOiBudWxsLFxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBjb21wbGV0ZWRUYXNrLnN0YXR1cyA9PT0gJ3J1bm5pbmcnIHx8XG4gICAgICAgIGNvbXBsZXRlZFRhc2suc3RhdHVzID09PSAncGVuZGluZydcbiAgICAgICkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHJldHJpZXZhbF9zdGF0dXM6ICd0aW1lb3V0JyBhcyBjb25zdCxcbiAgICAgICAgICAgIHRhc2s6IGF3YWl0IGdldFRhc2tPdXRwdXREYXRhKGNvbXBsZXRlZFRhc2spLFxuICAgICAgICAgIH0sXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gTWFyayBhcyBub3RpZmllZFxuICAgICAgdXBkYXRlVGFza1N0YXRlKHRhc2tfaWQsIHRvb2xVc2VDb250ZXh0LnNldEFwcFN0YXRlLCB0ID0+ICh7XG4gICAgICAgIC4uLnQsXG4gICAgICAgIG5vdGlmaWVkOiB0cnVlLFxuICAgICAgfSkpXG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICByZXRyaWV2YWxfc3RhdHVzOiAnc3VjY2VzcycgYXMgY29uc3QsXG4gICAgICAgICAgdGFzazogYXdhaXQgZ2V0VGFza091dHB1dERhdGEoY29tcGxldGVkVGFzayksXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgfSxcblxuICAgIG1hcFRvb2xSZXN1bHRUb1Rvb2xSZXN1bHRCbG9ja1BhcmFtKGRhdGEsIHRvb2xVc2VJRCkge1xuICAgICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW11cblxuICAgICAgcGFydHMucHVzaChcbiAgICAgICAgYDxyZXRyaWV2YWxfc3RhdHVzPiR7ZGF0YS5yZXRyaWV2YWxfc3RhdHVzfTwvcmV0cmlldmFsX3N0YXR1cz5gLFxuICAgICAgKVxuXG4gICAgICBpZiAoZGF0YS50YXNrKSB7XG4gICAgICAgIHBhcnRzLnB1c2goYDx0YXNrX2lkPiR7ZGF0YS50YXNrLnRhc2tfaWR9PC90YXNrX2lkPmApXG4gICAgICAgIHBhcnRzLnB1c2goYDx0YXNrX3R5cGU+JHtkYXRhLnRhc2sudGFza190eXBlfTwvdGFza190eXBlPmApXG4gICAgICAgIHBhcnRzLnB1c2goYDxzdGF0dXM+JHtkYXRhLnRhc2suc3RhdHVzfTwvc3RhdHVzPmApXG5cbiAgICAgICAgaWYgKGRhdGEudGFzay5leGl0Q29kZSAhPT0gdW5kZWZpbmVkICYmIGRhdGEudGFzay5leGl0Q29kZSAhPT0gbnVsbCkge1xuICAgICAgICAgIHBhcnRzLnB1c2goYDxleGl0X2NvZGU+JHtkYXRhLnRhc2suZXhpdENvZGV9PC9leGl0X2NvZGU+YClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkYXRhLnRhc2sub3V0cHV0Py50cmltKCkpIHtcbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnQgfSA9IGZvcm1hdFRhc2tPdXRwdXQoXG4gICAgICAgICAgICBkYXRhLnRhc2sub3V0cHV0LFxuICAgICAgICAgICAgZGF0YS50YXNrLnRhc2tfaWQsXG4gICAgICAgICAgKVxuICAgICAgICAgIHBhcnRzLnB1c2goYDxvdXRwdXQ+XFxuJHtjb250ZW50LnRyaW1FbmQoKX1cXG48L291dHB1dD5gKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEudGFzay5lcnJvcikge1xuICAgICAgICAgIHBhcnRzLnB1c2goYDxlcnJvcj4ke2RhdGEudGFzay5lcnJvcn08L2Vycm9yPmApXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9vbF91c2VfaWQ6IHRvb2xVc2VJRCxcbiAgICAgICAgdHlwZTogJ3Rvb2xfcmVzdWx0JyBhcyBjb25zdCxcbiAgICAgICAgY29udGVudDogcGFydHMuam9pbignXFxuXFxuJyksXG4gICAgICB9XG4gICAgfSxcblxuICAgIHJlbmRlclRvb2xVc2VNZXNzYWdlKGlucHV0KSB7XG4gICAgICBjb25zdCB7IGJsb2NrID0gdHJ1ZSB9ID0gaW5wdXRcbiAgICAgIGlmICghYmxvY2spIHtcbiAgICAgICAgcmV0dXJuICdub24tYmxvY2tpbmcnXG4gICAgICB9XG4gICAgICByZXR1cm4gJydcbiAgICB9LFxuXG4gICAgcmVuZGVyVG9vbFVzZVRhZyhpbnB1dCkge1xuICAgICAgaWYgKCFpbnB1dC50YXNrX2lkKSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICByZXR1cm4gPFRleHQgZGltQ29sb3I+IHtpbnB1dC50YXNrX2lkfTwvVGV4dD5cbiAgICB9LFxuXG4gICAgcmVuZGVyVG9vbFVzZVByb2dyZXNzTWVzc2FnZShwcm9ncmVzc01lc3NhZ2VzKSB7XG4gICAgICBjb25zdCBsYXN0UHJvZ3Jlc3MgPSBwcm9ncmVzc01lc3NhZ2VzW3Byb2dyZXNzTWVzc2FnZXMubGVuZ3RoIC0gMV1cbiAgICAgIGNvbnN0IHByb2dyZXNzRGF0YSA9IGxhc3RQcm9ncmVzcz8uZGF0YSBhc1xuICAgICAgICB8IHsgdGFza0Rlc2NyaXB0aW9uPzogc3RyaW5nOyB0YXNrVHlwZT86IHN0cmluZyB9XG4gICAgICAgIHwgdW5kZWZpbmVkXG5cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIHtwcm9ncmVzc0RhdGE/LnRhc2tEZXNjcmlwdGlvbiAmJiAoXG4gICAgICAgICAgICA8VGV4dD4mbmJzcDsmbmJzcDt7cHJvZ3Jlc3NEYXRhLnRhc2tEZXNjcmlwdGlvbn08L1RleHQ+XG4gICAgICAgICAgKX1cbiAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICZuYnNwOyZuYnNwOyZuYnNwOyZuYnNwOyZuYnNwO1dhaXRpbmcgZm9yIHRhc2t7JyAnfVxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+KGVzYyB0byBnaXZlIGFkZGl0aW9uYWwgaW5zdHJ1Y3Rpb25zKTwvVGV4dD5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKVxuICAgIH0sXG5cbiAgICByZW5kZXJUb29sUmVzdWx0TWVzc2FnZShjb250ZW50LCBfLCB7IHZlcmJvc2UsIHRoZW1lIH0pIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxUYXNrT3V0cHV0UmVzdWx0RGlzcGxheVxuICAgICAgICAgIGNvbnRlbnQ9e2NvbnRlbnR9XG4gICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICB0aGVtZT17dGhlbWV9XG4gICAgICAgIC8+XG4gICAgICApXG4gICAgfSxcblxuICAgIHJlbmRlclRvb2xVc2VSZWplY3RlZE1lc3NhZ2UoKSB7XG4gICAgICByZXR1cm4gPEZhbGxiYWNrVG9vbFVzZVJlamVjdGVkTWVzc2FnZSAvPlxuICAgIH0sXG5cbiAgICByZW5kZXJUb29sVXNlRXJyb3JNZXNzYWdlKHJlc3VsdCwgeyB2ZXJib3NlIH0pIHtcbiAgICAgIHJldHVybiA8RmFsbGJhY2tUb29sVXNlRXJyb3JNZXNzYWdlIHJlc3VsdD17cmVzdWx0fSB2ZXJib3NlPXt2ZXJib3NlfSAvPlxuICAgIH0sXG4gIH0gc2F0aXNmaWVzIFRvb2xEZWY8SW5wdXRTY2hlbWEsIFRhc2tPdXRwdXRUb29sT3V0cHV0PilcblxuZnVuY3Rpb24gVGFza091dHB1dFJlc3VsdERpc3BsYXkoe1xuICBjb250ZW50LFxuICB2ZXJib3NlID0gZmFsc2UsXG4gIHRoZW1lLFxufToge1xuICBjb250ZW50OiBzdHJpbmcgfCBUYXNrT3V0cHV0VG9vbE91dHB1dFxuICB2ZXJib3NlPzogYm9vbGVhblxuICB0aGVtZTogVGhlbWVOYW1lXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgZXhwYW5kU2hvcnRjdXQgPSB1c2VTaG9ydGN1dERpc3BsYXkoXG4gICAgJ2FwcDp0b2dnbGVUcmFuc2NyaXB0JyxcbiAgICAnR2xvYmFsJyxcbiAgICAnY3RybCtvJyxcbiAgKVxuICBjb25zdCByZXN1bHQ6IFRhc2tPdXRwdXRUb29sT3V0cHV0ID1cbiAgICB0eXBlb2YgY29udGVudCA9PT0gJ3N0cmluZycgPyBqc29uUGFyc2UoY29udGVudCkgOiBjb250ZW50XG5cbiAgaWYgKCFyZXN1bHQudGFzaykge1xuICAgIHJldHVybiAoXG4gICAgICA8TWVzc2FnZVJlc3BvbnNlPlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5ObyB0YXNrIG91dHB1dCBhdmFpbGFibGU8L1RleHQ+XG4gICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICApXG4gIH1cblxuICBjb25zdCB7IHRhc2sgfSA9IHJlc3VsdFxuXG4gIC8vIEZvciBzaGVsbCB0YXNrcywgcmVuZGVyIGxpa2UgQmFzaFRvb2xSZXN1bHRNZXNzYWdlXG4gIGlmICh0YXNrLnRhc2tfdHlwZSA9PT0gJ2xvY2FsX2Jhc2gnKSB7XG4gICAgY29uc3QgYmFzaE91dCA9IHtcbiAgICAgIHN0ZG91dDogdGFzay5vdXRwdXQsXG4gICAgICBzdGRlcnI6ICcnLFxuICAgICAgaXNJbWFnZTogZmFsc2UsXG4gICAgICBkYW5nZXJvdXNseURpc2FibGVTYW5kYm94OiB0cnVlLFxuICAgICAgcmV0dXJuQ29kZUludGVycHJldGF0aW9uOiB0YXNrLmVycm9yLFxuICAgIH1cbiAgICByZXR1cm4gPEJhc2hUb29sUmVzdWx0TWVzc2FnZSBjb250ZW50PXtiYXNoT3V0fSB2ZXJib3NlPXt2ZXJib3NlfSAvPlxuICB9XG5cbiAgLy8gRm9yIGFnZW50IHRhc2tzLCByZW5kZXIgd2l0aCBwcm9tcHQvcmVzcG9uc2UgZGlzcGxheVxuICBpZiAodGFzay50YXNrX3R5cGUgPT09ICdsb2NhbF9hZ2VudCcpIHtcbiAgICBjb25zdCBsaW5lQ291bnQgPSB0YXNrLnJlc3VsdCA/IGNvdW50Q2hhckluU3RyaW5nKHRhc2sucmVzdWx0LCAnXFxuJykgKyAxIDogMFxuXG4gICAgaWYgKHJlc3VsdC5yZXRyaWV2YWxfc3RhdHVzID09PSAnc3VjY2VzcycpIHtcbiAgICAgIGlmICh2ZXJib3NlKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICAge3Rhc2suZGVzY3JpcHRpb259ICh7bGluZUNvdW50fSBsaW5lcylcbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHBhZGRpbmdMZWZ0PXsyfSBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICB7dGFzay5wcm9tcHQgJiYgKFxuICAgICAgICAgICAgICAgIDxBZ2VudFByb21wdERpc3BsYXkgcHJvbXB0PXt0YXNrLnByb21wdH0gdGhlbWU9e3RoZW1lfSBkaW0gLz5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAge3Rhc2sucmVzdWx0ICYmIChcbiAgICAgICAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICAgICAgICA8QWdlbnRSZXNwb25zZURpc3BsYXlcbiAgICAgICAgICAgICAgICAgICAgY29udGVudD17W3sgdHlwZTogJ3RleHQnLCB0ZXh0OiB0YXNrLnJlc3VsdCB9XX1cbiAgICAgICAgICAgICAgICAgICAgdGhlbWU9e3RoZW1lfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAge3Rhc2suZXJyb3IgJiYgKFxuICAgICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCIgYm9sZD5cbiAgICAgICAgICAgICAgICAgICAgRXJyb3I6XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfT5cbiAgICAgICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPnt0YXNrLmVycm9yfTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxNZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+UmVhZCBvdXRwdXQgKHtleHBhbmRTaG9ydGN1dH0gdG8gZXhwYW5kKTwvVGV4dD5cbiAgICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgICApXG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdC5yZXRyaWV2YWxfc3RhdHVzID09PSAndGltZW91dCcgfHwgdGFzay5zdGF0dXMgPT09ICdydW5uaW5nJykge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPE1lc3NhZ2VSZXNwb25zZT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5UYXNrIGlzIHN0aWxsIHJ1bm5pbmfigKY8L1RleHQ+XG4gICAgICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICAgICAgKVxuICAgIH1cblxuICAgIGlmIChyZXN1bHQucmV0cmlldmFsX3N0YXR1cyA9PT0gJ25vdF9yZWFkeScpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxNZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+VGFzayBpcyBzdGlsbCBydW5uaW5n4oCmPC9UZXh0PlxuICAgICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICAgIClcbiAgICB9XG5cbiAgICByZXR1cm4gKFxuICAgICAgPE1lc3NhZ2VSZXNwb25zZT5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+VGFzayBub3QgcmVhZHk8L1RleHQ+XG4gICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICApXG4gIH1cblxuICAvLyBGb3IgcmVtb3RlIGFnZW50IHRhc2tzXG4gIGlmICh0YXNrLnRhc2tfdHlwZSA9PT0gJ3JlbW90ZV9hZ2VudCcpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxUZXh0PlxuICAgICAgICAgICZuYnNwOyZuYnNwO3t0YXNrLmRlc2NyaXB0aW9ufSBbe3Rhc2suc3RhdHVzfV1cbiAgICAgICAgPC9UZXh0PlxuICAgICAgICB7dGFzay5vdXRwdXQgJiYgdmVyYm9zZSAmJiAoXG4gICAgICAgICAgPEJveCBwYWRkaW5nTGVmdD17NH0gbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgIDxUZXh0Pnt0YXNrLm91dHB1dH08L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG4gICAgICAgIHshdmVyYm9zZSAmJiB0YXNrLm91dHB1dCAmJiAoXG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICB7JyAgICAgJ30oe2V4cGFuZFNob3J0Y3V0fSB0byBleHBhbmQpXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICApfVxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgLy8gRGVmYXVsdCByZW5kZXJpbmdcbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIDxUZXh0PlxuICAgICAgICAmbmJzcDsmbmJzcDt7dGFzay5kZXNjcmlwdGlvbn0gW3t0YXNrLnN0YXR1c31dXG4gICAgICA8L1RleHQ+XG4gICAgICB7dGFzay5vdXRwdXQgJiYgKFxuICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXs0fT5cbiAgICAgICAgICA8VGV4dD57dGFzay5vdXRwdXQuc2xpY2UoMCwgNTAwKX08L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICA8L0JveD5cbiAgKVxufVxuXG5leHBvcnQgZGVmYXVsdCBUYXNrT3V0cHV0VG9vbFxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBT0EsS0FBSyxNQUFNLE9BQU87QUFDekIsU0FBU0MsQ0FBQyxRQUFRLFFBQVE7QUFDMUIsU0FBU0MsMkJBQTJCLFFBQVEsaURBQWlEO0FBQzdGLFNBQVNDLDhCQUE4QixRQUFRLG9EQUFvRDtBQUNuRyxTQUFTQyxlQUFlLFFBQVEscUNBQXFDO0FBQ3JFLFNBQVNDLEdBQUcsRUFBRUMsSUFBSSxRQUFRLGNBQWM7QUFDeEMsU0FBU0Msa0JBQWtCLFFBQVEseUNBQXlDO0FBQzVFLGNBQWNDLFFBQVEsUUFBUSxlQUFlO0FBQzdDLGNBQWNDLElBQUksUUFBUSxlQUFlO0FBQ3pDLFNBQVNDLFNBQVMsRUFBRSxLQUFLQyxPQUFPLFFBQVEsZUFBZTtBQUN2RCxjQUFjQyxtQkFBbUIsUUFBUSw4Q0FBOEM7QUFDdkYsY0FBY0MsbUJBQW1CLFFBQVEsc0NBQXNDO0FBQy9FLGNBQWNDLG9CQUFvQixRQUFRLGdEQUFnRDtBQUMxRixjQUFjQyxTQUFTLFFBQVEsc0JBQXNCO0FBQ3JELFNBQVNDLFVBQVUsUUFBUSx1QkFBdUI7QUFDbEQsU0FBU0MsVUFBVSxRQUFRLDJCQUEyQjtBQUN0RCxTQUFTQyxrQkFBa0IsUUFBUSx5QkFBeUI7QUFDNUQsU0FBU0MsZUFBZSxRQUFRLGdDQUFnQztBQUNoRSxTQUFTQyxLQUFLLFFBQVEsc0JBQXNCO0FBQzVDLFNBQVNDLFNBQVMsUUFBUSwrQkFBK0I7QUFDekQsU0FBU0MsaUJBQWlCLFFBQVEsNEJBQTRCO0FBQzlELFNBQVNDLGFBQWEsUUFBUSxnQ0FBZ0M7QUFDOUQsU0FBU0MsZUFBZSxRQUFRLCtCQUErQjtBQUMvRCxTQUFTQyxnQkFBZ0IsUUFBUSxzQ0FBc0M7QUFDdkUsY0FBY0MsU0FBUyxRQUFRLHNCQUFzQjtBQUNyRCxTQUFTQyxrQkFBa0IsRUFBRUMsb0JBQW9CLFFBQVEsb0JBQW9CO0FBQzdFLE9BQU9DLHFCQUFxQixNQUFNLHNDQUFzQztBQUN4RSxTQUFTQyxxQkFBcUIsUUFBUSxnQkFBZ0I7QUFFdEQsTUFBTUMsV0FBVyxHQUFHZCxVQUFVLENBQUMsTUFDN0JoQixDQUFDLENBQUMrQixZQUFZLENBQUM7RUFDYkMsT0FBTyxFQUFFaEMsQ0FBQyxDQUFDaUMsTUFBTSxDQUFDLENBQUMsQ0FBQ0MsUUFBUSxDQUFDLGdDQUFnQyxDQUFDO0VBQzlEQyxLQUFLLEVBQUVqQixlQUFlLENBQUNsQixDQUFDLENBQUNvQyxPQUFPLENBQUMsQ0FBQyxDQUFDQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQ0gsUUFBUSxDQUN4RCxnQ0FDRixDQUFDO0VBQ0RJLE9BQU8sRUFBRXRDLENBQUMsQ0FDUHVDLE1BQU0sQ0FBQyxDQUFDLENBQ1JDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FDTkMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUNYSixPQUFPLENBQUMsS0FBSyxDQUFDLENBQ2RILFFBQVEsQ0FBQyxxQkFBcUI7QUFDbkMsQ0FBQyxDQUNILENBQUM7QUFDRCxLQUFLUSxXQUFXLEdBQUdDLFVBQVUsQ0FBQyxPQUFPYixXQUFXLENBQUM7QUFFakQsS0FBS2MsbUJBQW1CLEdBQUc1QyxDQUFDLENBQUM2QyxLQUFLLENBQUNILFdBQVcsQ0FBQzs7QUFFL0M7QUFDQSxLQUFLSSxVQUFVLEdBQUc7RUFDaEJkLE9BQU8sRUFBRSxNQUFNO0VBQ2ZlLFNBQVMsRUFBRXhDLFFBQVE7RUFDbkJ5QyxNQUFNLEVBQUUsTUFBTTtFQUNkQyxXQUFXLEVBQUUsTUFBTTtFQUNuQkMsTUFBTSxFQUFFLE1BQU07RUFDZEMsUUFBUSxDQUFDLEVBQUUsTUFBTSxHQUFHLElBQUk7RUFDeEJDLEtBQUssQ0FBQyxFQUFFLE1BQU07RUFDZDtFQUNBQyxNQUFNLENBQUMsRUFBRSxNQUFNO0VBQ2ZDLE1BQU0sQ0FBQyxFQUFFLE1BQU07QUFDakIsQ0FBQztBQUVELEtBQUtDLG9CQUFvQixHQUFHO0VBQzFCQyxnQkFBZ0IsRUFBRSxTQUFTLEdBQUcsU0FBUyxHQUFHLFdBQVc7RUFDckRDLElBQUksRUFBRVgsVUFBVSxHQUFHLElBQUk7QUFDekIsQ0FBQzs7QUFFRDtBQUNBLGNBQWNZLGtCQUFrQixJQUFJQyxRQUFRLFFBQVEsc0JBQXNCOztBQUUxRTtBQUNBLGVBQWVDLGlCQUFpQkEsQ0FBQ0gsSUFBSSxFQUFFM0MsU0FBUyxDQUFDLEVBQUUrQyxPQUFPLENBQUNmLFVBQVUsQ0FBQyxDQUFDO0VBQ3JFLElBQUlJLE1BQU0sRUFBRSxNQUFNO0VBQ2xCLElBQUlPLElBQUksQ0FBQ0ssSUFBSSxLQUFLLFlBQVksRUFBRTtJQUM5QixNQUFNQyxRQUFRLEdBQUdOLElBQUksSUFBSTdDLG1CQUFtQjtJQUM1QyxNQUFNb0QsYUFBYSxHQUFHRCxRQUFRLENBQUNFLFlBQVksRUFBRUMsVUFBVTtJQUN2RCxJQUFJRixhQUFhLEVBQUU7TUFDakIsTUFBTUcsTUFBTSxHQUFHLE1BQU1ILGFBQWEsQ0FBQ0ksU0FBUyxDQUFDLENBQUM7TUFDOUMsTUFBTUMsTUFBTSxHQUFHTCxhQUFhLENBQUNNLFNBQVMsQ0FBQyxDQUFDO01BQ3hDcEIsTUFBTSxHQUFHLENBQUNpQixNQUFNLEVBQUVFLE1BQU0sQ0FBQyxDQUFDRSxNQUFNLENBQUNDLE9BQU8sQ0FBQyxDQUFDQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ3RELENBQUMsTUFBTTtNQUNMdkIsTUFBTSxHQUFHLE1BQU01QixhQUFhLENBQUNtQyxJQUFJLENBQUNpQixFQUFFLENBQUM7SUFDdkM7RUFDRixDQUFDLE1BQU07SUFDTHhCLE1BQU0sR0FBRyxNQUFNNUIsYUFBYSxDQUFDbUMsSUFBSSxDQUFDaUIsRUFBRSxDQUFDO0VBQ3ZDO0VBRUEsTUFBTUMsVUFBVSxFQUFFN0IsVUFBVSxHQUFHO0lBQzdCZCxPQUFPLEVBQUV5QixJQUFJLENBQUNpQixFQUFFO0lBQ2hCM0IsU0FBUyxFQUFFVSxJQUFJLENBQUNLLElBQUk7SUFDcEJkLE1BQU0sRUFBRVMsSUFBSSxDQUFDVCxNQUFNO0lBQ25CQyxXQUFXLEVBQUVRLElBQUksQ0FBQ1IsV0FBVztJQUM3QkM7RUFDRixDQUFDOztFQUVEO0VBQ0EsSUFBSU8sSUFBSSxDQUFDSyxJQUFJLEtBQUssWUFBWSxFQUFFO0lBQzlCLE1BQU1DLFFBQVEsR0FBR04sSUFBSSxJQUFJN0MsbUJBQW1CO0lBQzVDLE9BQU87TUFDTCxHQUFHK0QsVUFBVTtNQUNieEIsUUFBUSxFQUFFWSxRQUFRLENBQUNULE1BQU0sRUFBRXNCLElBQUksSUFBSTtJQUNyQyxDQUFDO0VBQ0g7RUFFQSxJQUFJbkIsSUFBSSxDQUFDSyxJQUFJLEtBQUssYUFBYSxFQUFFO0lBQy9CLE1BQU1lLFNBQVMsR0FBR3BCLElBQUksSUFBSTlDLG1CQUFtQjtJQUM3QztJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsTUFBTW1FLFdBQVcsR0FBR0QsU0FBUyxDQUFDdkIsTUFBTSxHQUNoQ3JDLGtCQUFrQixDQUFDNEQsU0FBUyxDQUFDdkIsTUFBTSxDQUFDeUIsT0FBTyxFQUFFLElBQUksQ0FBQyxHQUNsREMsU0FBUztJQUNiLE9BQU87TUFDTCxHQUFHTCxVQUFVO01BQ2J0QixNQUFNLEVBQUV3QixTQUFTLENBQUN4QixNQUFNO01BQ3hCQyxNQUFNLEVBQUV3QixXQUFXLElBQUk1QixNQUFNO01BQzdCQSxNQUFNLEVBQUU0QixXQUFXLElBQUk1QixNQUFNO01BQzdCRSxLQUFLLEVBQUV5QixTQUFTLENBQUN6QjtJQUNuQixDQUFDO0VBQ0g7RUFFQSxJQUFJSyxJQUFJLENBQUNLLElBQUksS0FBSyxjQUFjLEVBQUU7SUFDaEMsTUFBTW1CLFVBQVUsR0FBR3hCLElBQUksSUFBSTVDLG9CQUFvQjtJQUMvQyxPQUFPO01BQ0wsR0FBRzhELFVBQVU7TUFDYnRCLE1BQU0sRUFBRTRCLFVBQVUsQ0FBQ0M7SUFDckIsQ0FBQztFQUNIO0VBRUEsT0FBT1AsVUFBVTtBQUNuQjs7QUFFQTtBQUNBLGVBQWVRLHFCQUFxQkEsQ0FDbENDLE1BQU0sRUFBRSxNQUFNLEVBQ2RDLFdBQVcsRUFBRSxHQUFHLEdBQUc7RUFBRUMsS0FBSyxDQUFDLEVBQUVDLE1BQU0sQ0FBQyxNQUFNLEVBQUV6RSxTQUFTLENBQUM7QUFBQyxDQUFDLEVBQ3hEMEUsU0FBUyxFQUFFLE1BQU0sRUFDakJDLGVBQWlDLENBQWpCLEVBQUVDLGVBQWUsQ0FDbEMsRUFBRTdCLE9BQU8sQ0FBQy9DLFNBQVMsR0FBRyxJQUFJLENBQUMsQ0FBQztFQUMzQixNQUFNNkUsU0FBUyxHQUFHQyxJQUFJLENBQUNDLEdBQUcsQ0FBQyxDQUFDO0VBRTVCLE9BQU9ELElBQUksQ0FBQ0MsR0FBRyxDQUFDLENBQUMsR0FBR0YsU0FBUyxHQUFHSCxTQUFTLEVBQUU7SUFDekM7SUFDQSxJQUFJQyxlQUFlLEVBQUVLLE1BQU0sQ0FBQ0MsT0FBTyxFQUFFO01BQ25DLE1BQU0sSUFBSWhGLFVBQVUsQ0FBQyxDQUFDO0lBQ3hCO0lBRUEsTUFBTWlGLEtBQUssR0FBR1gsV0FBVyxDQUFDLENBQUM7SUFDM0IsTUFBTTVCLElBQUksR0FBR3VDLEtBQUssQ0FBQ1YsS0FBSyxHQUFHRixNQUFNLENBQUMsSUFBSXRFLFNBQVMsR0FBRyxTQUFTO0lBRTNELElBQUksQ0FBQzJDLElBQUksRUFBRTtNQUNULE9BQU8sSUFBSTtJQUNiO0lBRUEsSUFBSUEsSUFBSSxDQUFDVCxNQUFNLEtBQUssU0FBUyxJQUFJUyxJQUFJLENBQUNULE1BQU0sS0FBSyxTQUFTLEVBQUU7TUFDMUQsT0FBT1MsSUFBSTtJQUNiOztJQUVBO0lBQ0EsTUFBTXRDLEtBQUssQ0FBQyxHQUFHLENBQUM7RUFDbEI7O0VBRUE7RUFDQSxNQUFNOEUsVUFBVSxHQUFHWixXQUFXLENBQUMsQ0FBQztFQUNoQyxPQUFRWSxVQUFVLENBQUNYLEtBQUssR0FBR0YsTUFBTSxDQUFDLElBQUl0RSxTQUFTLElBQUssSUFBSTtBQUMxRDtBQUVBLE9BQU8sTUFBTW9GLGNBQWMsRUFBRTFGLElBQUksQ0FBQ2tDLFdBQVcsRUFBRWEsb0JBQW9CLENBQUMsR0FDbEU5QyxTQUFTLENBQUM7RUFDUjBGLElBQUksRUFBRXRFLHFCQUFxQjtFQUMzQnVFLFVBQVUsRUFBRSx5Q0FBeUM7RUFDckRDLGtCQUFrQixFQUFFLE9BQU87RUFDM0JDLFdBQVcsRUFBRSxJQUFJO0VBQ2pCO0VBQ0FDLE9BQU8sRUFBRSxDQUFDLGlCQUFpQixFQUFFLGdCQUFnQixDQUFDO0VBRTlDQyxjQUFjQSxDQUFBLEVBQUc7SUFDZixPQUFPLGFBQWE7RUFDdEIsQ0FBQztFQUVELElBQUkxRSxXQUFXQSxDQUFBLENBQUUsRUFBRVksV0FBVyxDQUFDO0lBQzdCLE9BQU9aLFdBQVcsQ0FBQyxDQUFDO0VBQ3RCLENBQUM7RUFFRCxNQUFNbUIsV0FBV0EsQ0FBQSxFQUFHO0lBQ2xCLE9BQU8seURBQXlEO0VBQ2xFLENBQUM7RUFFRHdELGlCQUFpQkEsQ0FBQ0MsTUFBTSxFQUFFO0lBQ3hCLE9BQU8sSUFBSSxDQUFDQyxVQUFVLEdBQUdELE1BQU0sQ0FBQyxJQUFJLEtBQUs7RUFDM0MsQ0FBQztFQUVERSxTQUFTQSxDQUFBLEVBQUc7SUFDVixPQUFPLFVBQVUsS0FBSyxLQUFLO0VBQzdCLENBQUM7RUFFREQsVUFBVUEsQ0FBQ0QsTUFBTSxFQUFFO0lBQ2pCLE9BQU8sSUFBSTtFQUNiLENBQUM7RUFDREcscUJBQXFCQSxDQUFDQyxLQUFLLEVBQUU7SUFDM0IsT0FBT0EsS0FBSyxDQUFDOUUsT0FBTztFQUN0QixDQUFDO0VBRUQsTUFBTXFCLE1BQU1BLENBQUEsRUFBRztJQUNiLE9BQU87QUFDYjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtGQUFrRjtFQUM5RSxDQUFDO0VBRUQsTUFBTTBELGFBQWFBLENBQUM7SUFBRS9FO0VBQVEsQ0FBQyxFQUFFO0lBQUVxRDtFQUFZLENBQUMsRUFBRTtJQUNoRCxJQUFJLENBQUNyRCxPQUFPLEVBQUU7TUFDWixPQUFPO1FBQ0xzQixNQUFNLEVBQUUsS0FBSztRQUNiMEQsT0FBTyxFQUFFLHFCQUFxQjtRQUM5QkMsU0FBUyxFQUFFO01BQ2IsQ0FBQztJQUNIO0lBRUEsTUFBTUMsUUFBUSxHQUFHN0IsV0FBVyxDQUFDLENBQUM7SUFDOUIsTUFBTTVCLElBQUksR0FBR3lELFFBQVEsQ0FBQzVCLEtBQUssR0FBR3RELE9BQU8sQ0FBQyxJQUFJbEIsU0FBUyxHQUFHLFNBQVM7SUFFL0QsSUFBSSxDQUFDMkMsSUFBSSxFQUFFO01BQ1QsT0FBTztRQUNMSCxNQUFNLEVBQUUsS0FBSztRQUNiMEQsT0FBTyxFQUFFLDBCQUEwQmhGLE9BQU8sRUFBRTtRQUM1Q2lGLFNBQVMsRUFBRTtNQUNiLENBQUM7SUFDSDtJQUVBLE9BQU87TUFBRTNELE1BQU0sRUFBRTtJQUFLLENBQUM7RUFDekIsQ0FBQztFQUVELE1BQU02RCxJQUFJQSxDQUNSTCxLQUFLLEVBQUVsRSxtQkFBbUIsRUFDMUJ3RSxjQUFjLEVBQ2RDLFdBQVcsRUFDWEMsY0FBYyxFQUNkQyxVQUFVLEVBQ1Y7SUFDQSxNQUFNO01BQUV2RixPQUFPO01BQUVHLEtBQUs7TUFBRUc7SUFBUSxDQUFDLEdBQUd3RSxLQUFLO0lBRXpDLE1BQU1JLFFBQVEsR0FBR0UsY0FBYyxDQUFDL0IsV0FBVyxDQUFDLENBQUM7SUFDN0MsTUFBTTVCLElBQUksR0FBR3lELFFBQVEsQ0FBQzVCLEtBQUssR0FBR3RELE9BQU8sQ0FBQyxJQUFJbEIsU0FBUyxHQUFHLFNBQVM7SUFFL0QsSUFBSSxDQUFDMkMsSUFBSSxFQUFFO01BQ1QsTUFBTSxJQUFJK0QsS0FBSyxDQUFDLDBCQUEwQnhGLE9BQU8sRUFBRSxDQUFDO0lBQ3REO0lBRUEsSUFBSSxDQUFDRyxLQUFLLEVBQUU7TUFDVjtNQUNBLElBQUlzQixJQUFJLENBQUNULE1BQU0sS0FBSyxTQUFTLElBQUlTLElBQUksQ0FBQ1QsTUFBTSxLQUFLLFNBQVMsRUFBRTtRQUMxRDtRQUNBekIsZUFBZSxDQUFDUyxPQUFPLEVBQUVvRixjQUFjLENBQUNLLFdBQVcsRUFBRUMsQ0FBQyxLQUFLO1VBQ3pELEdBQUdBLENBQUM7VUFDSkMsUUFBUSxFQUFFO1FBQ1osQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPO1VBQ0xDLElBQUksRUFBRTtZQUNKcEUsZ0JBQWdCLEVBQUUsU0FBUyxJQUFJcUUsS0FBSztZQUNwQ3BFLElBQUksRUFBRSxNQUFNRyxpQkFBaUIsQ0FBQ0gsSUFBSTtVQUNwQztRQUNGLENBQUM7TUFDSDtNQUNBLE9BQU87UUFDTG1FLElBQUksRUFBRTtVQUNKcEUsZ0JBQWdCLEVBQUUsV0FBVyxJQUFJcUUsS0FBSztVQUN0Q3BFLElBQUksRUFBRSxNQUFNRyxpQkFBaUIsQ0FBQ0gsSUFBSTtRQUNwQztNQUNGLENBQUM7SUFDSDs7SUFFQTtJQUNBLElBQUk4RCxVQUFVLEVBQUU7TUFDZEEsVUFBVSxDQUFDO1FBQ1RPLFNBQVMsRUFBRSx1QkFBdUJsQyxJQUFJLENBQUNDLEdBQUcsQ0FBQyxDQUFDLEVBQUU7UUFDOUMrQixJQUFJLEVBQUU7VUFDSjlELElBQUksRUFBRSxrQkFBa0I7VUFDeEJpRSxlQUFlLEVBQUV0RSxJQUFJLENBQUNSLFdBQVc7VUFDakMrRSxRQUFRLEVBQUV2RSxJQUFJLENBQUNLO1FBQ2pCO01BQ0YsQ0FBQyxDQUFDO0lBQ0o7SUFFQSxNQUFNbUUsYUFBYSxHQUFHLE1BQU05QyxxQkFBcUIsQ0FDL0NuRCxPQUFPLEVBQ1BvRixjQUFjLENBQUMvQixXQUFXLEVBQzFCL0MsT0FBTyxFQUNQOEUsY0FBYyxDQUFDM0IsZUFDakIsQ0FBQztJQUVELElBQUksQ0FBQ3dDLGFBQWEsRUFBRTtNQUNsQixPQUFPO1FBQ0xMLElBQUksRUFBRTtVQUNKcEUsZ0JBQWdCLEVBQUUsU0FBUyxJQUFJcUUsS0FBSztVQUNwQ3BFLElBQUksRUFBRTtRQUNSO01BQ0YsQ0FBQztJQUNIO0lBRUEsSUFDRXdFLGFBQWEsQ0FBQ2pGLE1BQU0sS0FBSyxTQUFTLElBQ2xDaUYsYUFBYSxDQUFDakYsTUFBTSxLQUFLLFNBQVMsRUFDbEM7TUFDQSxPQUFPO1FBQ0w0RSxJQUFJLEVBQUU7VUFDSnBFLGdCQUFnQixFQUFFLFNBQVMsSUFBSXFFLEtBQUs7VUFDcENwRSxJQUFJLEVBQUUsTUFBTUcsaUJBQWlCLENBQUNxRSxhQUFhO1FBQzdDO01BQ0YsQ0FBQztJQUNIOztJQUVBO0lBQ0ExRyxlQUFlLENBQUNTLE9BQU8sRUFBRW9GLGNBQWMsQ0FBQ0ssV0FBVyxFQUFFQyxDQUFDLEtBQUs7TUFDekQsR0FBR0EsQ0FBQztNQUNKQyxRQUFRLEVBQUU7SUFDWixDQUFDLENBQUMsQ0FBQztJQUVILE9BQU87TUFDTEMsSUFBSSxFQUFFO1FBQ0pwRSxnQkFBZ0IsRUFBRSxTQUFTLElBQUlxRSxLQUFLO1FBQ3BDcEUsSUFBSSxFQUFFLE1BQU1HLGlCQUFpQixDQUFDcUUsYUFBYTtNQUM3QztJQUNGLENBQUM7RUFDSCxDQUFDO0VBRURDLG1DQUFtQ0EsQ0FBQ04sSUFBSSxFQUFFRSxTQUFTLEVBQUU7SUFDbkQsTUFBTUssS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUU7SUFFMUJBLEtBQUssQ0FBQ0MsSUFBSSxDQUNSLHFCQUFxQlIsSUFBSSxDQUFDcEUsZ0JBQWdCLHFCQUM1QyxDQUFDO0lBRUQsSUFBSW9FLElBQUksQ0FBQ25FLElBQUksRUFBRTtNQUNiMEUsS0FBSyxDQUFDQyxJQUFJLENBQUMsWUFBWVIsSUFBSSxDQUFDbkUsSUFBSSxDQUFDekIsT0FBTyxZQUFZLENBQUM7TUFDckRtRyxLQUFLLENBQUNDLElBQUksQ0FBQyxjQUFjUixJQUFJLENBQUNuRSxJQUFJLENBQUNWLFNBQVMsY0FBYyxDQUFDO01BQzNEb0YsS0FBSyxDQUFDQyxJQUFJLENBQUMsV0FBV1IsSUFBSSxDQUFDbkUsSUFBSSxDQUFDVCxNQUFNLFdBQVcsQ0FBQztNQUVsRCxJQUFJNEUsSUFBSSxDQUFDbkUsSUFBSSxDQUFDTixRQUFRLEtBQUs2QixTQUFTLElBQUk0QyxJQUFJLENBQUNuRSxJQUFJLENBQUNOLFFBQVEsS0FBSyxJQUFJLEVBQUU7UUFDbkVnRixLQUFLLENBQUNDLElBQUksQ0FBQyxjQUFjUixJQUFJLENBQUNuRSxJQUFJLENBQUNOLFFBQVEsY0FBYyxDQUFDO01BQzVEO01BRUEsSUFBSXlFLElBQUksQ0FBQ25FLElBQUksQ0FBQ1AsTUFBTSxFQUFFbUYsSUFBSSxDQUFDLENBQUMsRUFBRTtRQUM1QixNQUFNO1VBQUV0RDtRQUFRLENBQUMsR0FBR3ZELGdCQUFnQixDQUNsQ29HLElBQUksQ0FBQ25FLElBQUksQ0FBQ1AsTUFBTSxFQUNoQjBFLElBQUksQ0FBQ25FLElBQUksQ0FBQ3pCLE9BQ1osQ0FBQztRQUNEbUcsS0FBSyxDQUFDQyxJQUFJLENBQUMsYUFBYXJELE9BQU8sQ0FBQ3VELE9BQU8sQ0FBQyxDQUFDLGFBQWEsQ0FBQztNQUN6RDtNQUVBLElBQUlWLElBQUksQ0FBQ25FLElBQUksQ0FBQ0wsS0FBSyxFQUFFO1FBQ25CK0UsS0FBSyxDQUFDQyxJQUFJLENBQUMsVUFBVVIsSUFBSSxDQUFDbkUsSUFBSSxDQUFDTCxLQUFLLFVBQVUsQ0FBQztNQUNqRDtJQUNGO0lBRUEsT0FBTztNQUNMbUYsV0FBVyxFQUFFVCxTQUFTO01BQ3RCaEUsSUFBSSxFQUFFLGFBQWEsSUFBSStELEtBQUs7TUFDNUI5QyxPQUFPLEVBQUVvRCxLQUFLLENBQUMxRCxJQUFJLENBQUMsTUFBTTtJQUM1QixDQUFDO0VBQ0gsQ0FBQztFQUVEK0Qsb0JBQW9CQSxDQUFDMUIsS0FBSyxFQUFFO0lBQzFCLE1BQU07TUFBRTNFLEtBQUssR0FBRztJQUFLLENBQUMsR0FBRzJFLEtBQUs7SUFDOUIsSUFBSSxDQUFDM0UsS0FBSyxFQUFFO01BQ1YsT0FBTyxjQUFjO0lBQ3ZCO0lBQ0EsT0FBTyxFQUFFO0VBQ1gsQ0FBQztFQUVEc0csZ0JBQWdCQSxDQUFDM0IsS0FBSyxFQUFFO0lBQ3RCLElBQUksQ0FBQ0EsS0FBSyxDQUFDOUUsT0FBTyxFQUFFO01BQ2xCLE9BQU8sSUFBSTtJQUNiO0lBQ0EsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDOEUsS0FBSyxDQUFDOUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDO0VBQy9DLENBQUM7RUFFRDBHLDRCQUE0QkEsQ0FBQ0MsZ0JBQWdCLEVBQUU7SUFDN0MsTUFBTUMsWUFBWSxHQUFHRCxnQkFBZ0IsQ0FBQ0EsZ0JBQWdCLENBQUNFLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDbEUsTUFBTUMsWUFBWSxHQUFHRixZQUFZLEVBQUVoQixJQUFJLElBQ25DO01BQUVHLGVBQWUsQ0FBQyxFQUFFLE1BQU07TUFBRUMsUUFBUSxDQUFDLEVBQUUsTUFBTTtJQUFDLENBQUMsR0FDL0MsU0FBUztJQUViLE9BQ0UsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLFFBQVE7QUFDbkMsVUFBVSxDQUFDYyxZQUFZLEVBQUVmLGVBQWUsSUFDNUIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDZSxZQUFZLENBQUNmLGVBQWUsQ0FBQyxFQUFFLElBQUksQ0FDdkQ7QUFDWCxVQUFVLENBQUMsSUFBSTtBQUNmLDBEQUEwRCxDQUFDLEdBQUc7QUFDOUQsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMscUNBQXFDLEVBQUUsSUFBSTtBQUN0RSxVQUFVLEVBQUUsSUFBSTtBQUNoQixRQUFRLEVBQUUsR0FBRyxDQUFDO0VBRVYsQ0FBQztFQUVEZ0IsdUJBQXVCQSxDQUFDaEUsT0FBTyxFQUFFaUUsQ0FBQyxFQUFFO0lBQUVDLE9BQU87SUFBRUM7RUFBTSxDQUFDLEVBQUU7SUFDdEQsT0FDRSxDQUFDLHVCQUF1QixDQUN0QixPQUFPLENBQUMsQ0FBQ25FLE9BQU8sQ0FBQyxDQUNqQixPQUFPLENBQUMsQ0FBQ2tFLE9BQU8sQ0FBQyxDQUNqQixLQUFLLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLEdBQ2I7RUFFTixDQUFDO0VBRURDLDRCQUE0QkEsQ0FBQSxFQUFHO0lBQzdCLE9BQU8sQ0FBQyw4QkFBOEIsR0FBRztFQUMzQyxDQUFDO0VBRURDLHlCQUF5QkEsQ0FBQzlGLE1BQU0sRUFBRTtJQUFFMkY7RUFBUSxDQUFDLEVBQUU7SUFDN0MsT0FBTyxDQUFDLDJCQUEyQixDQUFDLE1BQU0sQ0FBQyxDQUFDM0YsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMyRixPQUFPLENBQUMsR0FBRztFQUMxRTtBQUNGLENBQUMsV0FBV3ZJLE9BQU8sQ0FBQ2dDLFdBQVcsRUFBRWEsb0JBQW9CLENBQUMsQ0FBQztBQUV6RCxTQUFBOEYsd0JBQUFDLEVBQUE7RUFBQSxNQUFBQyxDQUFBLEdBQUFDLEVBQUE7RUFBaUM7SUFBQXpFLE9BQUE7SUFBQWtFLE9BQUEsRUFBQVEsRUFBQTtJQUFBUDtFQUFBLElBQUFJLEVBUWhDO0VBTkMsTUFBQUwsT0FBQSxHQUFBUSxFQUFlLEtBQWZ6RSxTQUFlLEdBQWYsS0FBZSxHQUFmeUUsRUFBZTtFQU9mLE1BQUFDLGNBQUEsR0FBdUJwSixrQkFBa0IsQ0FDdkMsc0JBQXNCLEVBQ3RCLFFBQVEsRUFDUixRQUNGLENBQUM7RUFBQSxJQUFBcUosRUFBQTtFQUFBLElBQUFKLENBQUEsUUFBQXhFLE9BQUE7SUFFQzRFLEVBQUEsVUFBTzVFLE9BQU8sS0FBSyxRQUF1QyxHQUE1QjNELFNBQVMsQ0FBQzJELE9BQWlCLENBQUMsR0FBMURBLE9BQTBEO0lBQUF3RSxDQUFBLE1BQUF4RSxPQUFBO0lBQUF3RSxDQUFBLE1BQUFJLEVBQUE7RUFBQTtJQUFBQSxFQUFBLEdBQUFKLENBQUE7RUFBQTtFQUQ1RCxNQUFBakcsTUFBQSxHQUNFcUcsRUFBMEQ7RUFFNUQsSUFBSSxDQUFDckcsTUFBTSxDQUFBRyxJQUFLO0lBQUEsSUFBQW1HLEVBQUE7SUFBQSxJQUFBTCxDQUFBLFFBQUFNLE1BQUEsQ0FBQUMsR0FBQTtNQUVaRixFQUFBLElBQUMsZUFBZSxDQUNkLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBUixLQUFPLENBQUMsQ0FBQyx3QkFBd0IsRUFBdEMsSUFBSSxDQUNQLEVBRkMsZUFBZSxDQUVFO01BQUFMLENBQUEsTUFBQUssRUFBQTtJQUFBO01BQUFBLEVBQUEsR0FBQUwsQ0FBQTtJQUFBO0lBQUEsT0FGbEJLLEVBRWtCO0VBQUE7RUFJdEI7SUFBQW5HO0VBQUEsSUFBaUJILE1BQU07RUFHdkIsSUFBSUcsSUFBSSxDQUFBVixTQUFVLEtBQUssWUFBWTtJQUFBLElBQUE2RyxFQUFBO0lBQUEsSUFBQUwsQ0FBQSxRQUFBOUYsSUFBQSxDQUFBTCxLQUFBLElBQUFtRyxDQUFBLFFBQUE5RixJQUFBLENBQUFQLE1BQUE7TUFDakIwRyxFQUFBO1FBQUF6RixNQUFBLEVBQ05WLElBQUksQ0FBQVAsTUFBTztRQUFBbUIsTUFBQSxFQUNYLEVBQUU7UUFBQTBGLE9BQUEsRUFDRCxLQUFLO1FBQUFDLHlCQUFBLEVBQ2EsSUFBSTtRQUFBQyx3QkFBQSxFQUNMeEcsSUFBSSxDQUFBTDtNQUNoQyxDQUFDO01BQUFtRyxDQUFBLE1BQUE5RixJQUFBLENBQUFMLEtBQUE7TUFBQW1HLENBQUEsTUFBQTlGLElBQUEsQ0FBQVAsTUFBQTtNQUFBcUcsQ0FBQSxNQUFBSyxFQUFBO0lBQUE7TUFBQUEsRUFBQSxHQUFBTCxDQUFBO0lBQUE7SUFORCxNQUFBVyxPQUFBLEdBQWdCTixFQU1mO0lBQUEsSUFBQU8sRUFBQTtJQUFBLElBQUFaLENBQUEsUUFBQVcsT0FBQSxJQUFBWCxDQUFBLFFBQUFOLE9BQUE7TUFDTWtCLEVBQUEsSUFBQyxxQkFBcUIsQ0FBVUQsT0FBTyxDQUFQQSxRQUFNLENBQUMsQ0FBV2pCLE9BQU8sQ0FBUEEsUUFBTSxDQUFDLEdBQUk7TUFBQU0sQ0FBQSxNQUFBVyxPQUFBO01BQUFYLENBQUEsTUFBQU4sT0FBQTtNQUFBTSxDQUFBLE1BQUFZLEVBQUE7SUFBQTtNQUFBQSxFQUFBLEdBQUFaLENBQUE7SUFBQTtJQUFBLE9BQTdEWSxFQUE2RDtFQUFBO0VBSXRFLElBQUkxRyxJQUFJLENBQUFWLFNBQVUsS0FBSyxhQUFhO0lBQ2xDLE1BQUFxSCxTQUFBLEdBQWtCM0csSUFBSSxDQUFBSCxNQUFzRCxHQUE1Q2pDLGlCQUFpQixDQUFDb0MsSUFBSSxDQUFBSCxNQUFPLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBSyxHQUExRCxDQUEwRDtJQUU1RSxJQUFJQSxNQUFNLENBQUFFLGdCQUFpQixLQUFLLFNBQVM7TUFDdkMsSUFBSXlGLE9BQU87UUFBQSxJQUFBVyxFQUFBO1FBQUEsSUFBQUwsQ0FBQSxRQUFBYSxTQUFBLElBQUFiLENBQUEsU0FBQTlGLElBQUEsQ0FBQVIsV0FBQTtVQUdMMkcsRUFBQSxJQUFDLElBQUksQ0FDRixDQUFBbkcsSUFBSSxDQUFBUixXQUFXLENBQUUsRUFBR21ILFVBQVEsQ0FBRSxPQUNqQyxFQUZDLElBQUksQ0FFRTtVQUFBYixDQUFBLE1BQUFhLFNBQUE7VUFBQWIsQ0FBQSxPQUFBOUYsSUFBQSxDQUFBUixXQUFBO1VBQUFzRyxDQUFBLE9BQUFLLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFMLENBQUE7UUFBQTtRQUFBLElBQUFZLEVBQUE7UUFBQSxJQUFBWixDQUFBLFNBQUE5RixJQUFBLENBQUFKLE1BQUEsSUFBQWtHLENBQUEsU0FBQUwsS0FBQTtVQUVKaUIsRUFBQSxHQUFBMUcsSUFBSSxDQUFBSixNQUVKLElBREMsQ0FBQyxrQkFBa0IsQ0FBUyxNQUFXLENBQVgsQ0FBQUksSUFBSSxDQUFBSixNQUFNLENBQUMsQ0FBUzZGLEtBQUssQ0FBTEEsTUFBSSxDQUFDLENBQUUsR0FBRyxDQUFILEtBQUUsQ0FBQyxHQUMzRDtVQUFBSyxDQUFBLE9BQUE5RixJQUFBLENBQUFKLE1BQUE7VUFBQWtHLENBQUEsT0FBQUwsS0FBQTtVQUFBSyxDQUFBLE9BQUFZLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFaLENBQUE7UUFBQTtRQUFBLElBQUFjLEVBQUE7UUFBQSxJQUFBZCxDQUFBLFNBQUE5RixJQUFBLENBQUFILE1BQUEsSUFBQWlHLENBQUEsU0FBQUwsS0FBQTtVQUNBbUIsRUFBQSxHQUFBNUcsSUFBSSxDQUFBSCxNQU9KLElBTkMsQ0FBQyxHQUFHLENBQVksU0FBQyxDQUFELEdBQUMsQ0FDZixDQUFDLG9CQUFvQixDQUNWLE9BQXFDLENBQXJDLEVBQUM7Y0FBQVEsSUFBQSxFQUFRLE1BQU07Y0FBQXdHLElBQUEsRUFBUTdHLElBQUksQ0FBQUg7WUFBUSxDQUFDLEVBQUMsQ0FDdkM0RixLQUFLLENBQUxBLE1BQUksQ0FBQyxHQUVoQixFQUxDLEdBQUcsQ0FNTDtVQUFBSyxDQUFBLE9BQUE5RixJQUFBLENBQUFILE1BQUE7VUFBQWlHLENBQUEsT0FBQUwsS0FBQTtVQUFBSyxDQUFBLE9BQUFjLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFkLENBQUE7UUFBQTtRQUFBLElBQUFnQixFQUFBO1FBQUEsSUFBQWhCLENBQUEsU0FBQTlGLElBQUEsQ0FBQUwsS0FBQTtVQUNBbUgsRUFBQSxHQUFBOUcsSUFBSSxDQUFBTCxLQVNKLElBUkMsQ0FBQyxHQUFHLENBQWUsYUFBUSxDQUFSLFFBQVEsQ0FBWSxTQUFDLENBQUQsR0FBQyxDQUN0QyxDQUFDLElBQUksQ0FBTyxLQUFPLENBQVAsT0FBTyxDQUFDLElBQUksQ0FBSixLQUFHLENBQUMsQ0FBQyxNQUV6QixFQUZDLElBQUksQ0FHTCxDQUFDLEdBQUcsQ0FBYyxXQUFDLENBQUQsR0FBQyxDQUNqQixDQUFDLElBQUksQ0FBTyxLQUFPLENBQVAsT0FBTyxDQUFFLENBQUFLLElBQUksQ0FBQUwsS0FBSyxDQUFFLEVBQS9CLElBQUksQ0FDUCxFQUZDLEdBQUcsQ0FHTixFQVBDLEdBQUcsQ0FRTDtVQUFBbUcsQ0FBQSxPQUFBOUYsSUFBQSxDQUFBTCxLQUFBO1VBQUFtRyxDQUFBLE9BQUFnQixFQUFBO1FBQUE7VUFBQUEsRUFBQSxHQUFBaEIsQ0FBQTtRQUFBO1FBQUEsSUFBQWlCLEVBQUE7UUFBQSxJQUFBakIsQ0FBQSxTQUFBWSxFQUFBLElBQUFaLENBQUEsU0FBQWMsRUFBQSxJQUFBZCxDQUFBLFNBQUFnQixFQUFBO1VBckJIQyxFQUFBLElBQUMsR0FBRyxDQUFlLGFBQVEsQ0FBUixRQUFRLENBQWMsV0FBQyxDQUFELEdBQUMsQ0FBYSxTQUFDLENBQUQsR0FBQyxDQUNyRCxDQUFBTCxFQUVELENBQ0MsQ0FBQUUsRUFPRCxDQUNDLENBQUFFLEVBU0QsQ0FDRixFQXRCQyxHQUFHLENBc0JFO1VBQUFoQixDQUFBLE9BQUFZLEVBQUE7VUFBQVosQ0FBQSxPQUFBYyxFQUFBO1VBQUFkLENBQUEsT0FBQWdCLEVBQUE7VUFBQWhCLENBQUEsT0FBQWlCLEVBQUE7UUFBQTtVQUFBQSxFQUFBLEdBQUFqQixDQUFBO1FBQUE7UUFBQSxJQUFBa0IsRUFBQTtRQUFBLElBQUFsQixDQUFBLFNBQUFLLEVBQUEsSUFBQUwsQ0FBQSxTQUFBaUIsRUFBQTtVQTFCUkMsRUFBQSxJQUFDLEdBQUcsQ0FBZSxhQUFRLENBQVIsUUFBUSxDQUN6QixDQUFBYixFQUVNLENBQ04sQ0FBQVksRUFzQkssQ0FDUCxFQTNCQyxHQUFHLENBMkJFO1VBQUFqQixDQUFBLE9BQUFLLEVBQUE7VUFBQUwsQ0FBQSxPQUFBaUIsRUFBQTtVQUFBakIsQ0FBQSxPQUFBa0IsRUFBQTtRQUFBO1VBQUFBLEVBQUEsR0FBQWxCLENBQUE7UUFBQTtRQUFBLE9BM0JOa0IsRUEyQk07TUFBQTtNQUVULElBQUFiLEVBQUE7TUFBQSxJQUFBTCxDQUFBLFNBQUFHLGNBQUE7UUFFQ0UsRUFBQSxJQUFDLGVBQWUsQ0FDZCxDQUFDLElBQUksQ0FBQyxRQUFRLENBQVIsS0FBTyxDQUFDLENBQUMsYUFBY0YsZUFBYSxDQUFFLFdBQVcsRUFBdEQsSUFBSSxDQUNQLEVBRkMsZUFBZSxDQUVFO1FBQUFILENBQUEsT0FBQUcsY0FBQTtRQUFBSCxDQUFBLE9BQUFLLEVBQUE7TUFBQTtRQUFBQSxFQUFBLEdBQUFMLENBQUE7TUFBQTtNQUFBLE9BRmxCSyxFQUVrQjtJQUFBO0lBSXRCLElBQUl0RyxNQUFNLENBQUFFLGdCQUFpQixLQUFLLFNBQXNDLElBQXpCQyxJQUFJLENBQUFULE1BQU8sS0FBSyxTQUFTO01BQUEsSUFBQTRHLEVBQUE7TUFBQSxJQUFBTCxDQUFBLFNBQUFNLE1BQUEsQ0FBQUMsR0FBQTtRQUVsRUYsRUFBQSxJQUFDLGVBQWUsQ0FDZCxDQUFDLElBQUksQ0FBQyxRQUFRLENBQVIsS0FBTyxDQUFDLENBQUMsc0JBQXNCLEVBQXBDLElBQUksQ0FDUCxFQUZDLGVBQWUsQ0FFRTtRQUFBTCxDQUFBLE9BQUFLLEVBQUE7TUFBQTtRQUFBQSxFQUFBLEdBQUFMLENBQUE7TUFBQTtNQUFBLE9BRmxCSyxFQUVrQjtJQUFBO0lBSXRCLElBQUl0RyxNQUFNLENBQUFFLGdCQUFpQixLQUFLLFdBQVc7TUFBQSxJQUFBb0csRUFBQTtNQUFBLElBQUFMLENBQUEsU0FBQU0sTUFBQSxDQUFBQyxHQUFBO1FBRXZDRixFQUFBLElBQUMsZUFBZSxDQUNkLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBUixLQUFPLENBQUMsQ0FBQyxzQkFBc0IsRUFBcEMsSUFBSSxDQUNQLEVBRkMsZUFBZSxDQUVFO1FBQUFMLENBQUEsT0FBQUssRUFBQTtNQUFBO1FBQUFBLEVBQUEsR0FBQUwsQ0FBQTtNQUFBO01BQUEsT0FGbEJLLEVBRWtCO0lBQUE7SUFFckIsSUFBQUEsRUFBQTtJQUFBLElBQUFMLENBQUEsU0FBQU0sTUFBQSxDQUFBQyxHQUFBO01BR0NGLEVBQUEsSUFBQyxlQUFlLENBQ2QsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFSLEtBQU8sQ0FBQyxDQUFDLGNBQWMsRUFBNUIsSUFBSSxDQUNQLEVBRkMsZUFBZSxDQUVFO01BQUFMLENBQUEsT0FBQUssRUFBQTtJQUFBO01BQUFBLEVBQUEsR0FBQUwsQ0FBQTtJQUFBO0lBQUEsT0FGbEJLLEVBRWtCO0VBQUE7RUFLdEIsSUFBSW5HLElBQUksQ0FBQVYsU0FBVSxLQUFLLGNBQWM7SUFBQSxJQUFBNkcsRUFBQTtJQUFBLElBQUFMLENBQUEsU0FBQTlGLElBQUEsQ0FBQVIsV0FBQSxJQUFBc0csQ0FBQSxTQUFBOUYsSUFBQSxDQUFBVCxNQUFBO01BRy9CNEcsRUFBQSxJQUFDLElBQUksQ0FBQyxFQUNTLENBQUFuRyxJQUFJLENBQUFSLFdBQVcsQ0FBRSxFQUFHLENBQUFRLElBQUksQ0FBQVQsTUFBTSxDQUFFLENBQy9DLEVBRkMsSUFBSSxDQUVFO01BQUF1RyxDQUFBLE9BQUE5RixJQUFBLENBQUFSLFdBQUE7TUFBQXNHLENBQUEsT0FBQTlGLElBQUEsQ0FBQVQsTUFBQTtNQUFBdUcsQ0FBQSxPQUFBSyxFQUFBO0lBQUE7TUFBQUEsRUFBQSxHQUFBTCxDQUFBO0lBQUE7SUFBQSxJQUFBWSxFQUFBO0lBQUEsSUFBQVosQ0FBQSxTQUFBOUYsSUFBQSxDQUFBUCxNQUFBLElBQUFxRyxDQUFBLFNBQUFOLE9BQUE7TUFDTmtCLEVBQUEsR0FBQTFHLElBQUksQ0FBQVAsTUFBa0IsSUFBdEIrRixPQUlBLElBSEMsQ0FBQyxHQUFHLENBQWMsV0FBQyxDQUFELEdBQUMsQ0FBYSxTQUFDLENBQUQsR0FBQyxDQUMvQixDQUFDLElBQUksQ0FBRSxDQUFBeEYsSUFBSSxDQUFBUCxNQUFNLENBQUUsRUFBbEIsSUFBSSxDQUNQLEVBRkMsR0FBRyxDQUdMO01BQUFxRyxDQUFBLE9BQUE5RixJQUFBLENBQUFQLE1BQUE7TUFBQXFHLENBQUEsT0FBQU4sT0FBQTtNQUFBTSxDQUFBLE9BQUFZLEVBQUE7SUFBQTtNQUFBQSxFQUFBLEdBQUFaLENBQUE7SUFBQTtJQUFBLElBQUFjLEVBQUE7SUFBQSxJQUFBZCxDQUFBLFNBQUFHLGNBQUEsSUFBQUgsQ0FBQSxTQUFBOUYsSUFBQSxDQUFBUCxNQUFBLElBQUFxRyxDQUFBLFNBQUFOLE9BQUE7TUFDQW9CLEVBQUEsSUFBQ3BCLE9BQXNCLElBQVh4RixJQUFJLENBQUFQLE1BSWhCLElBSEMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFSLEtBQU8sQ0FBQyxDQUNYLFFBQU0sQ0FBRSxDQUFFd0csZUFBYSxDQUFFLFdBQzVCLEVBRkMsSUFBSSxDQUdOO01BQUFILENBQUEsT0FBQUcsY0FBQTtNQUFBSCxDQUFBLE9BQUE5RixJQUFBLENBQUFQLE1BQUE7TUFBQXFHLENBQUEsT0FBQU4sT0FBQTtNQUFBTSxDQUFBLE9BQUFjLEVBQUE7SUFBQTtNQUFBQSxFQUFBLEdBQUFkLENBQUE7SUFBQTtJQUFBLElBQUFnQixFQUFBO0lBQUEsSUFBQWhCLENBQUEsU0FBQUssRUFBQSxJQUFBTCxDQUFBLFNBQUFZLEVBQUEsSUFBQVosQ0FBQSxTQUFBYyxFQUFBO01BYkhFLEVBQUEsSUFBQyxHQUFHLENBQWUsYUFBUSxDQUFSLFFBQVEsQ0FDekIsQ0FBQVgsRUFFTSxDQUNMLENBQUFPLEVBSUQsQ0FDQyxDQUFBRSxFQUlELENBQ0YsRUFkQyxHQUFHLENBY0U7TUFBQWQsQ0FBQSxPQUFBSyxFQUFBO01BQUFMLENBQUEsT0FBQVksRUFBQTtNQUFBWixDQUFBLE9BQUFjLEVBQUE7TUFBQWQsQ0FBQSxPQUFBZ0IsRUFBQTtJQUFBO01BQUFBLEVBQUEsR0FBQWhCLENBQUE7SUFBQTtJQUFBLE9BZE5nQixFQWNNO0VBQUE7RUFFVCxJQUFBWCxFQUFBO0VBQUEsSUFBQUwsQ0FBQSxTQUFBOUYsSUFBQSxDQUFBUixXQUFBLElBQUFzRyxDQUFBLFNBQUE5RixJQUFBLENBQUFULE1BQUE7SUFLRzRHLEVBQUEsSUFBQyxJQUFJLENBQUMsRUFDUyxDQUFBbkcsSUFBSSxDQUFBUixXQUFXLENBQUUsRUFBRyxDQUFBUSxJQUFJLENBQUFULE1BQU0sQ0FBRSxDQUMvQyxFQUZDLElBQUksQ0FFRTtJQUFBdUcsQ0FBQSxPQUFBOUYsSUFBQSxDQUFBUixXQUFBO0lBQUFzRyxDQUFBLE9BQUE5RixJQUFBLENBQUFULE1BQUE7SUFBQXVHLENBQUEsT0FBQUssRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQUwsQ0FBQTtFQUFBO0VBQUEsSUFBQVksRUFBQTtFQUFBLElBQUFaLENBQUEsU0FBQTlGLElBQUEsQ0FBQVAsTUFBQTtJQUNOaUgsRUFBQSxHQUFBMUcsSUFBSSxDQUFBUCxNQUlKLElBSEMsQ0FBQyxHQUFHLENBQWMsV0FBQyxDQUFELEdBQUMsQ0FDakIsQ0FBQyxJQUFJLENBQUUsQ0FBQU8sSUFBSSxDQUFBUCxNQUFPLENBQUF3SCxLQUFNLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxFQUFoQyxJQUFJLENBQ1AsRUFGQyxHQUFHLENBR0w7SUFBQW5CLENBQUEsT0FBQTlGLElBQUEsQ0FBQVAsTUFBQTtJQUFBcUcsQ0FBQSxPQUFBWSxFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBWixDQUFBO0VBQUE7RUFBQSxJQUFBYyxFQUFBO0VBQUEsSUFBQWQsQ0FBQSxTQUFBSyxFQUFBLElBQUFMLENBQUEsU0FBQVksRUFBQTtJQVJIRSxFQUFBLElBQUMsR0FBRyxDQUFlLGFBQVEsQ0FBUixRQUFRLENBQ3pCLENBQUFULEVBRU0sQ0FDTCxDQUFBTyxFQUlELENBQ0YsRUFUQyxHQUFHLENBU0U7SUFBQVosQ0FBQSxPQUFBSyxFQUFBO0lBQUFMLENBQUEsT0FBQVksRUFBQTtJQUFBWixDQUFBLE9BQUFjLEVBQUE7RUFBQTtJQUFBQSxFQUFBLEdBQUFkLENBQUE7RUFBQTtFQUFBLE9BVE5jLEVBU007QUFBQTtBQUlWLGVBQWVuRSxjQUFjIiwiaWdub3JlTGlzdCI6W119