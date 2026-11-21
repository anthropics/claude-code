import memoize from 'lodash-es/memoize.js'
import type { HookEvent } from 'src/entrypoints/agentSdkTypes.js'
import { getRegisteredHooks } from '../../bootstrap/state.js'
import type { AppState } from '../../state/AppState.js'
import {
  getAllHooks,
  type IndividualHookConfig,
  sortMatchersByPriority,
} from './hooksSettings.js'

export type MatcherMetadata = {
  fieldToMatch: string
  values: string[]
}

export type HookEventMetadata = {
  summary: string
  description: string
  matcherMetadata?: MatcherMetadata
}

// Hook event metadata configuration.
// Resolver uses sorted-joined string key so that callers passing a fresh
// toolNames array each render (e.g. HooksConfigMenu) hit the cache instead
// of leaking a new entry per call.
export const getHookEventMetadata = memoize(
  function (toolNames: string[]): Record<HookEvent, HookEventMetadata> {
    return {
      PreToolUse: {
        summary: 'Before tool execution',
        description:
          'Input to command is JSON of tool call arguments.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to model and block tool call\nOther exit codes - show stderr to user only but continue with tool call',
        matcherMetadata: {
          fieldToMatch: 'tool_name',
          values: toolNames,
        },
      },
      PostToolUse: {
        summary: 'After tool execution',
        description:
          'Input to command is JSON with fields "inputs" (tool call arguments) and "response" (tool call response).\nExit code 0 - stdout shown in transcript mode (ctrl+o)\nExit code 2 - show stderr to model immediately\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'tool_name',
          values: toolNames,
        },
      },
      PostToolUseFailure: {
        summary: 'After tool execution fails',
        description:
          'Input to command is JSON with tool_name, tool_input, tool_use_id, error, error_type, is_interrupt, and is_timeout.\nExit code 0 - stdout shown in transcript mode (ctrl+o)\nExit code 2 - show stderr to model immediately\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'tool_name',
          values: toolNames,
        },
      },
      PermissionDenied: {
        summary: 'After auto mode classifier denies a tool call',
        description:
          'Input to command is JSON with tool_name, tool_input, tool_use_id, and reason.\nReturn {"hookSpecificOutput":{"hookEventName":"PermissionDenied","retry":true}} to tell the model it may retry.\nExit code 0 - stdout shown in transcript mode (ctrl+o)\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'tool_name',
          values: toolNames,
        },
      },
      Notification: {
        summary: 'When notifications are sent',
        description:
          'Input to command is JSON with notification message and type.\nExit code 0 - stdout/stderr not shown\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'notification_type',
          values: [
            'permission_prompt',
            'idle_prompt',
            'auth_success',
            'elicitation_dialog',
            'elicitation_complete',
            'elicitation_response',
          ],
        },
      },
      UserPromptSubmit: {
        summary: 'When the user submits a prompt',
        description:
          'Input to command is JSON with original user prompt text.\nExit code 0 - stdout shown to Claude\nExit code 2 - block processing, erase original prompt, and show stderr to user only\nOther exit codes - show stderr to user only',
      },
      SessionStart: {
        summary: 'When a new session is started',
        description:
          'Input to command is JSON with session start source.\nExit code 0 - stdout shown to Claude\nBlocking errors are ignored\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'source',
          values: ['startup', 'resume', 'clear', 'compact'],
        },
      },
      Stop: {
        summary: 'Right before Claude concludes its response',
        description:
          'Exit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to model and continue conversation\nOther exit codes - show stderr to user only',
      },
      StopFailure: {
        summary: 'When the turn ends due to an API error',
        description:
          'Fires instead of Stop when an API error (rate limit, auth failure, etc.) ended the turn. Fire-and-forget — hook output and exit codes are ignored.',
        matcherMetadata: {
          fieldToMatch: 'error',
          values: [
            'rate_limit',
            'authentication_failed',
            'billing_error',
            'invalid_request',
            'server_error',
            'max_output_tokens',
            'unknown',
          ],
        },
      },
      SubagentStart: {
        summary: 'When a subagent (Agent tool call) is started',
        description:
          'Input to command is JSON with agent_id and agent_type.\nExit code 0 - stdout shown to subagent\nBlocking errors are ignored\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'agent_type',
          values: [], // Will be populated with available agent types
        },
      },
      SubagentStop: {
        summary:
          'Right before a subagent (Agent tool call) concludes its response',
        description:
          'Input to command is JSON with agent_id, agent_type, and agent_transcript_path.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to subagent and continue having it run\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'agent_type',
          values: [], // Will be populated with available agent types
        },
      },
      PreCompact: {
        summary: 'Before conversation compaction',
        description:
          'Input to command is JSON with compaction details.\nExit code 0 - stdout appended as custom compact instructions\nExit code 2 - block compaction\nOther exit codes - show stderr to user only but continue with compaction',
        matcherMetadata: {
          fieldToMatch: 'trigger',
          values: ['manual', 'auto'],
        },
      },
      PostCompact: {
        summary: 'After conversation compaction',
        description:
          'Input to command is JSON with compaction details and the summary.\nExit code 0 - stdout shown to user\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'trigger',
          values: ['manual', 'auto'],
        },
      },
      SessionEnd: {
        summary: 'When a session is ending',
        description:
          'Input to command is JSON with session end reason.\nExit code 0 - command completes successfully\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'reason',
          values: ['clear', 'logout', 'prompt_input_exit', 'other'],
        },
      },
      PermissionRequest: {
        summary: 'When a permission dialog is displayed',
        description:
          'Input to command is JSON with tool_name, tool_input, and tool_use_id.\nOutput JSON with hookSpecificOutput containing decision to allow or deny.\nExit code 0 - use hook decision if provided\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'tool_name',
          values: toolNames,
        },
      },
      Setup: {
        summary: 'Repo setup hooks for init and maintenance',
        description:
          'Input to command is JSON with trigger (init or maintenance).\nExit code 0 - stdout shown to Claude\nBlocking errors are ignored\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'trigger',
          values: ['init', 'maintenance'],
        },
      },
      TeammateIdle: {
        summary: 'When a teammate is about to go idle',
        description:
          'Input to command is JSON with teammate_name and team_name.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to teammate and prevent idle (teammate continues working)\nOther exit codes - show stderr to user only',
      },
      TaskCreated: {
        summary: 'When a task is being created',
        description:
          'Input to command is JSON with task_id, task_subject, task_description, teammate_name, and team_name.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to model and prevent task creation\nOther exit codes - show stderr to user only',
      },
      TaskCompleted: {
        summary: 'When a task is being marked as completed',
        description:
          'Input to command is JSON with task_id, task_subject, task_description, teammate_name, and team_name.\nExit code 0 - stdout/stderr not shown\nExit code 2 - show stderr to model and prevent task completion\nOther exit codes - show stderr to user only',
      },
      Elicitation: {
        summary: 'When an MCP server requests user input (elicitation)',
        description:
          'Input to command is JSON with mcp_server_name, message, and requested_schema.\nOutput JSON with hookSpecificOutput containing action (accept/decline/cancel) and optional content.\nExit code 0 - use hook response if provided\nExit code 2 - deny the elicitation\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'mcp_server_name',
          values: [],
        },
      },
      ElicitationResult: {
        summary: 'After a user responds to an MCP elicitation',
        description:
          'Input to command is JSON with mcp_server_name, action, content, mode, and elicitation_id.\nOutput JSON with hookSpecificOutput containing optional action and content to override the response.\nExit code 0 - use hook response if provided\nExit code 2 - block the response (action becomes decline)\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'mcp_server_name',
          values: [],
        },
      },
      ConfigChange: {
        summary: 'When configuration files change during a session',
        description:
          'Input to command is JSON with source (user_settings, project_settings, local_settings, policy_settings, skills) and file_path.\nExit code 0 - allow the change\nExit code 2 - block the change from being applied to the session\nOther exit codes - show stderr to user only',
        matcherMetadata: {
          fieldToMatch: 'source',
          values: [
            'user_settings',
            'project_settings',
            'local_settings',
            'policy_settings',
            'skills',
          ],
        },
      },
      InstructionsLoaded: {
        summary: 'When an instruction file (CLAUDE.md or rule) is loaded',
        description:
          'Input to command is JSON with file_path, memory_type (User, Project, Local, Managed), load_reason (session_start, nested_traversal, path_glob_match, include, compact), globs (optional — the paths: frontmatter patterns that matched), trigger_file_path (optional — the file Claude touched that caused the load), and parent_file_path (optional — the file that @-included this one).\nExit code 0 - command completes successfully\nOther exit codes - show stderr to user only\nThis hook is observability-only and does not support blocking.',
        matcherMetadata: {
          fieldToMatch: 'load_reason',
          values: [
            'session_start',
            'nested_traversal',
            'path_glob_match',
            'include',
            'compact',
          ],
        },
      },
      WorktreeCreate: {
        summary: 'Create an isolated worktree for VCS-agnostic isolation',
        description:
          'Input to command is JSON with name (suggested worktree slug).\nStdout should contain the absolute path to the created worktree directory.\nExit code 0 - worktree created successfully\nOther exit codes - worktree creation failed',
      },
      WorktreeRemove: {
        summary: 'Remove a previously created worktree',
        description:
          'Input to command is JSON with worktree_path (absolute path to worktree).\nExit code 0 - worktree removed successfully\nOther exit codes - show stderr to user only',
      },
      CwdChanged: {
        summary: 'After the working directory changes',
        description:
          'Input to command is JSON with old_cwd and new_cwd.\nCLAUDE_ENV_FILE is set — write bash exports there to apply env to subsequent BashTool commands.\nHook output can include hookSpecificOutput.watchPaths (array of absolute paths) to register with the FileChanged watcher.\nExit code 0 - command completes successfully\nOther exit codes - show stderr to user only',
      },
      FileChanged: {
        summary: 'When a watched file changes',
        description:
          'Input to command is JSON with file_path and event (change, add, unlink).\nCLAUDE_ENV_FILE is set — write bash exports there to apply env to subsequent BashTool commands.\nThe matcher field specifies filenames to watch in the current directory (e.g. ".envrc|.env").\nHook output can include hookSpecificOutput.watchPaths (array of absolute paths) to dynamically update the watch list.\nExit code 0 - command completes successfully\nOther exit codes - show stderr to user only',
      },
    }
  },
  toolNames => toolNames.slice().sort().join(','),
)

// Group hooks by event and matcher
export function groupHooksByEventAndMatcher(
  appState: AppState,
  toolNames: string[],
): Record<HookEvent, Record<string, IndividualHookConfig[]>> {
  const grouped: Record<HookEvent, Record<string, IndividualHookConfig[]>> = {
    PreToolUse: {},
    PostToolUse: {},
    PostToolUseFailure: {},
    PermissionDenied: {},
    Notification: {},
    UserPromptSubmit: {},
    SessionStart: {},
    SessionEnd: {},
    Stop: {},
    StopFailure: {},
    SubagentStart: {},
    SubagentStop: {},
    PreCompact: {},
    PostCompact: {},
    PermissionRequest: {},
    Setup: {},
    TeammateIdle: {},
    TaskCreated: {},
    TaskCompleted: {},
    Elicitation: {},
    ElicitationResult: {},
    ConfigChange: {},
    WorktreeCreate: {},
    WorktreeRemove: {},
    InstructionsLoaded: {},
    CwdChanged: {},
    FileChanged: {},
  }

  const metadata = getHookEventMetadata(toolNames)

  // Include hooks from settings files
  getAllHooks(appState).forEach(hook => {
    const eventGroup = grouped[hook.event]
    if (eventGroup) {
      // For events without matchers, use empty string as key
      const matcherKey =
        metadata[hook.event].matcherMetadata !== undefined
          ? hook.matcher || ''
          : ''
      if (!eventGroup[matcherKey]) {
        eventGroup[matcherKey] = []
      }
      eventGroup[matcherKey].push(hook)
    }
  })

  // Include registered hooks (e.g., plugin hooks)
  const registeredHooks = getRegisteredHooks()
  if (registeredHooks) {
    for (const [event, matchers] of Object.entries(registeredHooks)) {
      const hookEvent = event as HookEvent
      const eventGroup = grouped[hookEvent]
      if (!eventGroup) continue

      for (const matcher of matchers) {
        const matcherKey = matcher.matcher || ''

        // Only PluginHookMatcher has pluginRoot; HookCallbackMatcher (internal
        // callbacks like attributionHooks, sessionFileAccessHooks) does not.
        if ('pluginRoot' in matcher) {
          eventGroup[matcherKey] ??= []
          for (const hook of matcher.hooks) {
            eventGroup[matcherKey].push({
              event: hookEvent,
              config: hook,
              matcher: matcher.matcher,
              source: 'pluginHook',
              pluginName: matcher.pluginId,
            })
          }
        } else if (process.env.USER_TYPE === 'ant') {
          eventGroup[matcherKey] ??= []
          for (const _hook of matcher.hooks) {
            eventGroup[matcherKey].push({
              event: hookEvent,
              config: {
                type: 'command',
                command: '[ANT-ONLY] Built-in Hook',
              },
              matcher: matcher.matcher,
              source: 'builtinHook',
            })
          }
        }
      }
    }
  }

  return grouped
}

// Get sorted matchers for a specific event
export function getSortedMatchersForEvent(
  hooksByEventAndMatcher: Record<
    HookEvent,
    Record<string, IndividualHookConfig[]>
  >,
  event: HookEvent,
): string[] {
  const matchers = Object.keys(hooksByEventAndMatcher[event] || {})
  return sortMatchersByPriority(matchers, hooksByEventAndMatcher, event)
}

// Get hooks for a specific event and matcher
export function getHooksForMatcher(
  hooksByEventAndMatcher: Record<
    HookEvent,
    Record<string, IndividualHookConfig[]>
  >,
  event: HookEvent,
  matcher: string | null,
): IndividualHookConfig[] {
  // For events without matchers, hooks are stored with empty string as key
  // because the record keys must be strings.
  const matcherKey = matcher ?? ''
  return hooksByEventAndMatcher[event]?.[matcherKey] ?? []
}

// Get metadata for a specific event's matcher
export function getMatcherMetadata(
  event: HookEvent,
  toolNames: string[],
): MatcherMetadata | undefined {
  return getHookEventMetadata(toolNames)[event].matcherMetadata
}
