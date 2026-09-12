// XML tag names used to mark skill/command metadata in messages
export const COMMAND_NAME_TAG = 'command-name'
export const COMMAND_MESSAGE_TAG = 'command-message'
export const COMMAND_ARGS_TAG = 'command-args'

// XML tag names for terminal/bash command input and output in user messages
// These wrap content that represents terminal activity, not actual user prompts
export const BASH_INPUT_TAG = 'bash-input'
export const BASH_STDOUT_TAG = 'bash-stdout'
export const BASH_STDERR_TAG = 'bash-stderr'
export const LOCAL_COMMAND_STDOUT_TAG = 'local-command-stdout'
export const LOCAL_COMMAND_STDERR_TAG = 'local-command-stderr'
export const LOCAL_COMMAND_CAVEAT_TAG = 'local-command-caveat'

// All terminal-related tags that indicate a message is terminal output, not a user prompt
export const TERMINAL_OUTPUT_TAGS = [
  BASH_INPUT_TAG,
  BASH_STDOUT_TAG,
  BASH_STDERR_TAG,
  LOCAL_COMMAND_STDOUT_TAG,
  LOCAL_COMMAND_STDERR_TAG,
  LOCAL_COMMAND_CAVEAT_TAG,
] as const

export const TICK_TAG = 'tick'

// XML tag names for task notifications (background task completions)
export const TASK_NOTIFICATION_TAG = 'task-notification'
export const TASK_ID_TAG = 'task-id'
export const TOOL_USE_ID_TAG = 'tool-use-id'
export const TASK_TYPE_TAG = 'task-type'
export const OUTPUT_FILE_TAG = 'output-file'
export const STATUS_TAG = 'status'
export const SUMMARY_TAG = 'summary'
export const REASON_TAG = 'reason'
export const WORKTREE_TAG = 'worktree'
export const WORKTREE_PATH_TAG = 'worktreePath'
export const WORKTREE_BRANCH_TAG = 'worktreeBranch'

// XML tag names for ultraplan mode (remote parallel planning sessions)
export const ULTRAPLAN_TAG = 'ultraplan'

// XML tag name for remote /review results (teleported review session output).
// Remote session wraps its final review in this tag; local poller extracts it.
export const REMOTE_REVIEW_TAG = 'remote-review'

// run_hunt.sh's heartbeat echoes the orchestrator's progress.json inside this
// tag every ~10s. Local poller parses the latest for the task-status line.
export const REMOTE_REVIEW_PROGRESS_TAG = 'remote-review-progress'

// XML tag name for teammate messages (swarm inter-agent communication)
export const TEAMMATE_MESSAGE_TAG = 'teammate-message'

// XML tag name for external channel messages
export const CHANNEL_MESSAGE_TAG = 'channel-message'
export const CHANNEL_TAG = 'channel'

// XML tag name for cross-session UDS messages (another Claude session's inbox)
export const CROSS_SESSION_MESSAGE_TAG = 'cross-session-message'

// XML tag wrapping the rules/format boilerplate in a fork child's first message.
// Lets the transcript renderer collapse the boilerplate and show only the directive.
export const FORK_BOILERPLATE_TAG = 'fork-boilerplate'
// Prefix before the directive text, stripped by the renderer. Keep in sync
// across buildChildMessage (generates) and UserForkBoilerplateMessage (parses).
export const FORK_DIRECTIVE_PREFIX = 'Your directive: '

// Common argument patterns for slash commands that request help
export const COMMON_HELP_ARGS = ['help', '-h', '--help']

// Common argument patterns for slash commands that request current state/info
export const COMMON_INFO_ARGS = [
  'list',
  'show',
  'display',
  'current',
  'view',
  'get',
  'check',
  'describe',
  'print',
  'version',
  'about',
  'status',
  '?',
]
