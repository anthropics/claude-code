import { feature } from 'bun:bundle';
import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import { copyFile, stat as fsStat, truncate as fsTruncate, link } from 'fs/promises';
import * as React from 'react';
import type { CanUseToolFn } from 'src/hooks/useCanUseTool.js';
import type { AppState } from 'src/state/AppState.js';
import { z } from 'zod/v4';
import { getKairosActive } from '../../bootstrap/state.js';
import { TOOL_SUMMARY_MAX_LENGTH } from '../../constants/toolLimits.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../../services/analytics/index.js';
import { notifyVscodeFileUpdated } from '../../services/mcp/vscodeSdkMcp.js';
import type { SetToolJSXFn, ToolCallProgress, ToolUseContext, ValidationResult } from '../../Tool.js';
import { buildTool, type ToolDef } from '../../Tool.js';
import { backgroundExistingForegroundTask, markTaskNotified, registerForeground, spawnShellTask, unregisterForeground } from '../../tasks/LocalShellTask/LocalShellTask.js';
import type { AgentId } from '../../types/ids.js';
import type { AssistantMessage } from '../../types/message.js';
import { parseForSecurity } from '../../utils/bash/ast.js';
import { splitCommand_DEPRECATED, splitCommandWithOperators } from '../../utils/bash/commands.js';
import { extractClaudeCodeHints } from '../../utils/claudeCodeHints.js';
import { detectCodeIndexingFromCommand } from '../../utils/codeIndexing.js';
import { isEnvTruthy } from '../../utils/envUtils.js';
import { isENOENT, ShellError } from '../../utils/errors.js';
import { detectFileEncoding, detectLineEndings, getFileModificationTime, writeTextContent } from '../../utils/file.js';
import { fileHistoryEnabled, fileHistoryTrackEdit } from '../../utils/fileHistory.js';
import { truncate } from '../../utils/format.js';
import { getFsImplementation } from '../../utils/fsOperations.js';
import { lazySchema } from '../../utils/lazySchema.js';
import { expandPath } from '../../utils/path.js';
import type { PermissionResult } from '../../utils/permissions/PermissionResult.js';
import { maybeRecordPluginHint } from '../../utils/plugins/hintRecommendation.js';
import { exec } from '../../utils/Shell.js';
import type { ExecResult } from '../../utils/ShellCommand.js';
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter.js';
import { semanticBoolean } from '../../utils/semanticBoolean.js';
import { semanticNumber } from '../../utils/semanticNumber.js';
import { EndTruncatingAccumulator } from '../../utils/stringUtils.js';
import { getTaskOutputPath } from '../../utils/task/diskOutput.js';
import { TaskOutput } from '../../utils/task/TaskOutput.js';
import { isOutputLineTruncated } from '../../utils/terminal.js';
import { buildLargeToolResultMessage, ensureToolResultsDir, generatePreview, getToolResultPath, PREVIEW_SIZE_BYTES } from '../../utils/toolResultStorage.js';
import { userFacingName as fileEditUserFacingName } from '../FileEditTool/UI.js';
import { trackGitOperations } from '../shared/gitOperationTracking.js';
import { bashToolHasPermission, commandHasAnyCd, matchWildcardPattern, permissionRuleExtractPrefix } from './bashPermissions.js';
import { interpretCommandResult } from './commandSemantics.js';
import { getDefaultTimeoutMs, getMaxTimeoutMs, getSimplePrompt } from './prompt.js';
import { checkReadOnlyConstraints } from './readOnlyValidation.js';
import { parseSedEditCommand } from './sedEditParser.js';
import { shouldUseSandbox } from './shouldUseSandbox.js';
import { BASH_TOOL_NAME } from './toolName.js';
import { BackgroundHint, renderToolResultMessage, renderToolUseErrorMessage, renderToolUseMessage, renderToolUseProgressMessage, renderToolUseQueuedMessage } from './UI.js';
import { buildImageToolResult, isImageOutput, resetCwdIfOutsideProject, resizeShellImageOutput, stdErrAppendShellResetMessage, stripEmptyLines } from './utils.js';
const EOL = '\n';

// Progress display constants
const PROGRESS_THRESHOLD_MS = 2000; // Show progress after 2 seconds
// In assistant mode, blocking bash auto-backgrounds after this many ms in the main agent
const ASSISTANT_BLOCKING_BUDGET_MS = 15_000;

// Search commands for collapsible display (grep, find, etc.)
const BASH_SEARCH_COMMANDS = new Set(['find', 'grep', 'rg', 'ag', 'ack', 'locate', 'which', 'whereis']);

// Read/view commands for collapsible display (cat, head, etc.)
const BASH_READ_COMMANDS = new Set(['cat', 'head', 'tail', 'less', 'more',
// Analysis commands
'wc', 'stat', 'file', 'strings',
// Data processing — commonly used to parse/transform file content in pipes
'jq', 'awk', 'cut', 'sort', 'uniq', 'tr']);

// Directory-listing commands for collapsible display (ls, tree, du).
// Split from BASH_READ_COMMANDS so the summary says "Listed N directories"
// instead of the misleading "Read N files".
const BASH_LIST_COMMANDS = new Set(['ls', 'tree', 'du']);

// Commands that are semantic-neutral in any position — pure output/status commands
// that don't change the read/search nature of the overall pipeline.
// e.g. `ls dir && echo "---" && ls dir2` is still a read-only compound command.
const BASH_SEMANTIC_NEUTRAL_COMMANDS = new Set(['echo', 'printf', 'true', 'false', ':' // bash no-op
]);

// Commands that typically produce no stdout on success
const BASH_SILENT_COMMANDS = new Set(['mv', 'cp', 'rm', 'mkdir', 'rmdir', 'chmod', 'chown', 'chgrp', 'touch', 'ln', 'cd', 'export', 'unset', 'wait']);

/**
 * Checks if a bash command is a search or read operation.
 * Used to determine if the command should be collapsed in the UI.
 * Returns an object indicating whether it's a search or read operation.
 *
 * For pipelines (e.g., `cat file | bq`), ALL parts must be search/read commands
 * for the whole command to be considered collapsible.
 *
 * Semantic-neutral commands (echo, printf, true, false, :) are skipped in any
 * position, as they're pure output/status commands that don't affect the read/search
 * nature of the pipeline (e.g. `ls dir && echo "---" && ls dir2` is still a read).
 */
export function isSearchOrReadBashCommand(command: string): {
  isSearch: boolean;
  isRead: boolean;
  isList: boolean;
} {
  let partsWithOperators: string[];
  try {
    partsWithOperators = splitCommandWithOperators(command);
  } catch {
    // If we can't parse the command due to malformed syntax,
    // it's not a search/read command
    return {
      isSearch: false,
      isRead: false,
      isList: false
    };
  }
  if (partsWithOperators.length === 0) {
    return {
      isSearch: false,
      isRead: false,
      isList: false
    };
  }
  let hasSearch = false;
  let hasRead = false;
  let hasList = false;
  let hasNonNeutralCommand = false;
  let skipNextAsRedirectTarget = false;
  for (const part of partsWithOperators) {
    if (skipNextAsRedirectTarget) {
      skipNextAsRedirectTarget = false;
      continue;
    }
    if (part === '>' || part === '>>' || part === '>&') {
      skipNextAsRedirectTarget = true;
      continue;
    }
    if (part === '||' || part === '&&' || part === '|' || part === ';') {
      continue;
    }
    const baseCommand = part.trim().split(/\s+/)[0];
    if (!baseCommand) {
      continue;
    }
    if (BASH_SEMANTIC_NEUTRAL_COMMANDS.has(baseCommand)) {
      continue;
    }
    hasNonNeutralCommand = true;
    const isPartSearch = BASH_SEARCH_COMMANDS.has(baseCommand);
    const isPartRead = BASH_READ_COMMANDS.has(baseCommand);
    const isPartList = BASH_LIST_COMMANDS.has(baseCommand);
    if (!isPartSearch && !isPartRead && !isPartList) {
      return {
        isSearch: false,
        isRead: false,
        isList: false
      };
    }
    if (isPartSearch) hasSearch = true;
    if (isPartRead) hasRead = true;
    if (isPartList) hasList = true;
  }

  // Only neutral commands (e.g., just "echo foo") -- not collapsible
  if (!hasNonNeutralCommand) {
    return {
      isSearch: false,
      isRead: false,
      isList: false
    };
  }
  return {
    isSearch: hasSearch,
    isRead: hasRead,
    isList: hasList
  };
}

/**
 * Checks if a bash command is expected to produce no stdout on success.
 * Used to show "Done" instead of "(No output)" in the UI.
 */
function isSilentBashCommand(command: string): boolean {
  let partsWithOperators: string[];
  try {
    partsWithOperators = splitCommandWithOperators(command);
  } catch {
    return false;
  }
  if (partsWithOperators.length === 0) {
    return false;
  }
  let hasNonFallbackCommand = false;
  let lastOperator: string | null = null;
  let skipNextAsRedirectTarget = false;
  for (const part of partsWithOperators) {
    if (skipNextAsRedirectTarget) {
      skipNextAsRedirectTarget = false;
      continue;
    }
    if (part === '>' || part === '>>' || part === '>&') {
      skipNextAsRedirectTarget = true;
      continue;
    }
    if (part === '||' || part === '&&' || part === '|' || part === ';') {
      lastOperator = part;
      continue;
    }
    const baseCommand = part.trim().split(/\s+/)[0];
    if (!baseCommand) {
      continue;
    }
    if (lastOperator === '||' && BASH_SEMANTIC_NEUTRAL_COMMANDS.has(baseCommand)) {
      continue;
    }
    hasNonFallbackCommand = true;
    if (!BASH_SILENT_COMMANDS.has(baseCommand)) {
      return false;
    }
  }
  return hasNonFallbackCommand;
}

// Commands that should not be auto-backgrounded
const DISALLOWED_AUTO_BACKGROUND_COMMANDS = ['sleep' // Sleep should run in foreground unless explicitly backgrounded by user
];

// Check if background tasks are disabled at module load time
const isBackgroundTasksDisabled =
// eslint-disable-next-line custom-rules/no-process-env-top-level -- Intentional: schema must be defined at module load
isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS);
const fullInputSchema = lazySchema(() => z.strictObject({
  command: z.string().describe('The command to execute'),
  timeout: semanticNumber(z.number().optional()).describe(`Optional timeout in milliseconds (max ${getMaxTimeoutMs()})`),
  description: z.string().optional().describe(`Clear, concise description of what this command does in active voice. Never use words like "complex" or "risk" in the description - just describe what it does.

For simple commands (git, npm, standard CLI tools), keep it brief (5-10 words):
- ls → "List files in current directory"
- git status → "Show working tree status"
- npm install → "Install package dependencies"

For commands that are harder to parse at a glance (piped commands, obscure flags, etc.), add enough context to clarify what it does:
- find . -name "*.tmp" -exec rm {} \\; → "Find and delete all .tmp files recursively"
- git reset --hard origin/main → "Discard all local changes and match remote main"
- curl -s url | jq '.data[]' → "Fetch JSON from URL and extract data array elements"`),
  run_in_background: semanticBoolean(z.boolean().optional()).describe(`Set to true to run this command in the background. Use Read to read the output later.`),
  dangerouslyDisableSandbox: semanticBoolean(z.boolean().optional()).describe('Set this to true to dangerously override sandbox mode and run commands without sandboxing.'),
  _simulatedSedEdit: z.object({
    filePath: z.string(),
    newContent: z.string()
  }).optional().describe('Internal: pre-computed sed edit result from preview')
}));

// Always omit _simulatedSedEdit from the model-facing schema. It is an internal-only
// field set by SedEditPermissionRequest after the user approves a sed edit preview.
// Exposing it in the schema would let the model bypass permission checks and the
// sandbox by pairing an innocuous command with an arbitrary file write.
// Also conditionally remove run_in_background when background tasks are disabled.
const inputSchema = lazySchema(() => isBackgroundTasksDisabled ? fullInputSchema().omit({
  run_in_background: true,
  _simulatedSedEdit: true
}) : fullInputSchema().omit({
  _simulatedSedEdit: true
}));
type InputSchema = ReturnType<typeof inputSchema>;

// Use fullInputSchema for the type to always include run_in_background
// (even when it's omitted from the schema, the code needs to handle it)
export type BashToolInput = z.infer<ReturnType<typeof fullInputSchema>>;
const COMMON_BACKGROUND_COMMANDS = ['npm', 'yarn', 'pnpm', 'node', 'python', 'python3', 'go', 'cargo', 'make', 'docker', 'terraform', 'webpack', 'vite', 'jest', 'pytest', 'curl', 'wget', 'build', 'test', 'serve', 'watch', 'dev'] as const;
function getCommandTypeForLogging(command: string): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  const parts = splitCommand_DEPRECATED(command);
  if (parts.length === 0) return 'other' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;

  // Check each part of the command to see if any match common background commands
  for (const part of parts) {
    const baseCommand = part.split(' ')[0] || '';
    if (COMMON_BACKGROUND_COMMANDS.includes(baseCommand as (typeof COMMON_BACKGROUND_COMMANDS)[number])) {
      return baseCommand as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    }
  }
  return 'other' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
}
const outputSchema = lazySchema(() => z.object({
  stdout: z.string().describe('The standard output of the command'),
  stderr: z.string().describe('The standard error output of the command'),
  rawOutputPath: z.string().optional().describe('Path to raw output file for large MCP tool outputs'),
  interrupted: z.boolean().describe('Whether the command was interrupted'),
  isImage: z.boolean().optional().describe('Flag to indicate if stdout contains image data'),
  backgroundTaskId: z.string().optional().describe('ID of the background task if command is running in background'),
  backgroundedByUser: z.boolean().optional().describe('True if the user manually backgrounded the command with Ctrl+B'),
  assistantAutoBackgrounded: z.boolean().optional().describe('True if assistant-mode auto-backgrounded a long-running blocking command'),
  dangerouslyDisableSandbox: z.boolean().optional().describe('Flag to indicate if sandbox mode was overridden'),
  returnCodeInterpretation: z.string().optional().describe('Semantic interpretation for non-error exit codes with special meaning'),
  noOutputExpected: z.boolean().optional().describe('Whether the command is expected to produce no output on success'),
  structuredContent: z.array(z.any()).optional().describe('Structured content blocks'),
  persistedOutputPath: z.string().optional().describe('Path to the persisted full output in tool-results dir (set when output is too large for inline)'),
  persistedOutputSize: z.number().optional().describe('Total size of the output in bytes (set when output is too large for inline)')
}));
type OutputSchema = ReturnType<typeof outputSchema>;
export type Out = z.infer<OutputSchema>;

// Re-export BashProgress from centralized types to break import cycles
export type { BashProgress } from '../../types/tools.js';
import type { BashProgress } from '../../types/tools.js';

/**
 * Checks if a command is allowed to be automatically backgrounded
 * @param command The command to check
 * @returns false for commands that should not be auto-backgrounded (like sleep)
 */
function isAutobackgroundingAllowed(command: string): boolean {
  const parts = splitCommand_DEPRECATED(command);
  if (parts.length === 0) return true;

  // Get the first part which should be the base command
  const baseCommand = parts[0]?.trim();
  if (!baseCommand) return true;
  return !DISALLOWED_AUTO_BACKGROUND_COMMANDS.includes(baseCommand);
}

/**
 * Detect standalone or leading `sleep N` patterns that should use Monitor
 * instead. Catches `sleep 5`, `sleep 5 && check`, `sleep 5; check` — but
 * not sleep inside pipelines, subshells, or scripts (those are fine).
 */
export function detectBlockedSleepPattern(command: string): string | null {
  const parts = splitCommand_DEPRECATED(command);
  if (parts.length === 0) return null;
  const first = parts[0]?.trim() ?? '';
  // Bare `sleep N` or `sleep N.N` as the first subcommand.
  // Float durations (sleep 0.5) are allowed — those are legit pacing, not polls.
  const m = /^sleep\s+(\d+)\s*$/.exec(first);
  if (!m) return null;
  const secs = parseInt(m[1]!, 10);
  if (secs < 2) return null; // sub-2s sleeps are fine (rate limiting, pacing)

  // `sleep N` alone → "what are you waiting for?"
  // `sleep N && check` → "use Monitor { command: check }"
  const rest = parts.slice(1).join(' ').trim();
  return rest ? `sleep ${secs} followed by: ${rest}` : `standalone sleep ${secs}`;
}

/**
 * Checks if a command contains tools that shouldn't run in sandbox
 * This includes:
 * - Dynamic config-based disabled commands and substrings (tengu_sandbox_disabled_commands)
 * - User-configured commands from settings.json (sandbox.excludedCommands)
 *
 * User-configured commands support the same pattern syntax as permission rules:
 * - Exact matches: "npm run lint"
 * - Prefix patterns: "npm run test:*"
 */

type SimulatedSedEditResult = {
  data: Out;
};
type SimulatedSedEditContext = Pick<ToolUseContext, 'readFileState' | 'updateFileHistoryState'>;

/**
 * Applies a simulated sed edit directly instead of running sed.
 * This is used by the permission dialog to ensure what the user previews
 * is exactly what gets written to the file.
 */
async function applySedEdit(simulatedEdit: {
  filePath: string;
  newContent: string;
}, toolUseContext: SimulatedSedEditContext, parentMessage?: AssistantMessage): Promise<SimulatedSedEditResult> {
  const {
    filePath,
    newContent
  } = simulatedEdit;
  const absoluteFilePath = expandPath(filePath);
  const fs = getFsImplementation();

  // Read original content for VS Code notification
  const encoding = detectFileEncoding(absoluteFilePath);
  let originalContent: string;
  try {
    originalContent = await fs.readFile(absoluteFilePath, {
      encoding
    });
  } catch (e) {
    if (isENOENT(e)) {
      return {
        data: {
          stdout: '',
          stderr: `sed: ${filePath}: No such file or directory\nExit code 1`,
          interrupted: false
        }
      };
    }
    throw e;
  }

  // Track file history before making changes (for undo support)
  if (fileHistoryEnabled() && parentMessage) {
    await fileHistoryTrackEdit(toolUseContext.updateFileHistoryState, absoluteFilePath, parentMessage.uuid);
  }

  // Detect line endings and write new content
  const endings = detectLineEndings(absoluteFilePath);
  writeTextContent(absoluteFilePath, newContent, encoding, endings);

  // Notify VS Code about the file change
  notifyVscodeFileUpdated(absoluteFilePath, originalContent, newContent);

  // Update read timestamp to invalidate stale writes
  toolUseContext.readFileState.set(absoluteFilePath, {
    content: newContent,
    timestamp: getFileModificationTime(absoluteFilePath),
    offset: undefined,
    limit: undefined
  });

  // Return success result matching sed output format (sed produces no output on success)
  return {
    data: {
      stdout: '',
      stderr: '',
      interrupted: false
    }
  };
}
export const BashTool = buildTool({
  name: BASH_TOOL_NAME,
  searchHint: 'execute shell commands',
  // 30K chars - tool result persistence threshold
  maxResultSizeChars: 30_000,
  strict: true,
  async description({
    description
  }) {
    return description || 'Run shell command';
  },
  async prompt() {
    return getSimplePrompt();
  },
  isConcurrencySafe(input) {
    return this.isReadOnly?.(input) ?? false;
  },
  isReadOnly(input) {
    const compoundCommandHasCd = commandHasAnyCd(input.command);
    const result = checkReadOnlyConstraints(input, compoundCommandHasCd);
    return result.behavior === 'allow';
  },
  toAutoClassifierInput(input) {
    return input.command;
  },
  async preparePermissionMatcher({
    command
  }) {
    // Hook `if` filtering is "no match → skip hook" (deny-like semantics), so
    // compound commands must fire the hook if ANY subcommand matches. Without
    // splitting, `ls && git push` would bypass a `Bash(git *)` security hook.
    const parsed = await parseForSecurity(command);
    if (parsed.kind !== 'simple') {
      // parse-unavailable / too-complex: fail safe by running the hook.
      return () => true;
    }
    // Match on argv (strips leading VAR=val) so `FOO=bar git push` still
    // matches `Bash(git *)`.
    const subcommands = parsed.commands.map(c => c.argv.join(' '));
    return pattern => {
      const prefix = permissionRuleExtractPrefix(pattern);
      return subcommands.some(cmd => {
        if (prefix !== null) {
          return cmd === prefix || cmd.startsWith(`${prefix} `);
        }
        return matchWildcardPattern(pattern, cmd);
      });
    };
  },
  isSearchOrReadCommand(input) {
    const parsed = inputSchema().safeParse(input);
    if (!parsed.success) return {
      isSearch: false,
      isRead: false,
      isList: false
    };
    return isSearchOrReadBashCommand(parsed.data.command);
  },
  get inputSchema(): InputSchema {
    return inputSchema();
  },
  get outputSchema(): OutputSchema {
    return outputSchema();
  },
  userFacingName(input) {
    if (!input) {
      return 'Bash';
    }
    // Render sed in-place edits as file edits
    if (input.command) {
      const sedInfo = parseSedEditCommand(input.command);
      if (sedInfo) {
        return fileEditUserFacingName({
          file_path: sedInfo.filePath,
          old_string: 'x'
        });
      }
    }
    // Env var FIRST: shouldUseSandbox → splitCommand_DEPRECATED → shell-quote's
    // `new RegExp` per call. userFacingName runs per-render for every bash
    // message in history; with ~50 msgs + one slow-to-tokenize command, this
    // exceeds the shimmer tick → transition abort → infinite retry (#21605).
    return isEnvTruthy(process.env.CLAUDE_CODE_BASH_SANDBOX_SHOW_INDICATOR) && shouldUseSandbox(input) ? 'SandboxedBash' : 'Bash';
  },
  getToolUseSummary(input) {
    if (!input?.command) {
      return null;
    }
    const {
      command,
      description
    } = input;
    if (description) {
      return description;
    }
    return truncate(command, TOOL_SUMMARY_MAX_LENGTH);
  },
  getActivityDescription(input) {
    if (!input?.command) {
      return 'Running command';
    }
    const desc = input.description ?? truncate(input.command, TOOL_SUMMARY_MAX_LENGTH);
    return `Running ${desc}`;
  },
  async validateInput(input: BashToolInput): Promise<ValidationResult> {
    if (feature('MONITOR_TOOL') && !isBackgroundTasksDisabled && !input.run_in_background) {
      const sleepPattern = detectBlockedSleepPattern(input.command);
      if (sleepPattern !== null) {
        return {
          result: false,
          message: `Blocked: ${sleepPattern}. Run blocking commands in the background with run_in_background: true — you'll get a completion notification when done. For streaming events (watching logs, polling APIs), use the Monitor tool. If you genuinely need a delay (rate limiting, deliberate pacing), keep it under 2 seconds.`,
          errorCode: 10
        };
      }
    }
    return {
      result: true
    };
  },
  async checkPermissions(input, context): Promise<PermissionResult> {
    return bashToolHasPermission(input, context);
  },
  renderToolUseMessage,
  renderToolUseProgressMessage,
  renderToolUseQueuedMessage,
  renderToolResultMessage,
  // BashToolResultMessage shows <OutputLine content={stdout}> + stderr.
  // UI never shows persistedOutputPath wrapper, backgroundInfo — those are
  // model-facing (mapToolResult... below).
  extractSearchText({
    stdout,
    stderr
  }) {
    return stderr ? `${stdout}\n${stderr}` : stdout;
  },
  mapToolResultToToolResultBlockParam({
    interrupted,
    stdout,
    stderr,
    isImage,
    backgroundTaskId,
    backgroundedByUser,
    assistantAutoBackgrounded,
    structuredContent,
    persistedOutputPath,
    persistedOutputSize
  }, toolUseID): ToolResultBlockParam {
    // Handle structured content
    if (structuredContent && structuredContent.length > 0) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: structuredContent
      };
    }

    // For image data, format as image content block for Claude
    if (isImage) {
      const block = buildImageToolResult(stdout, toolUseID);
      if (block) return block;
    }
    let processedStdout = stdout;
    if (stdout) {
      // Replace any leading newlines or lines with only whitespace
      processedStdout = stdout.replace(/^(\s*\n)+/, '');
      // Still trim the end as before
      processedStdout = processedStdout.trimEnd();
    }

    // For large output that was persisted to disk, build <persisted-output>
    // message for the model. The UI never sees this — it uses data.stdout.
    if (persistedOutputPath) {
      const preview = generatePreview(processedStdout, PREVIEW_SIZE_BYTES);
      processedStdout = buildLargeToolResultMessage({
        filepath: persistedOutputPath,
        originalSize: persistedOutputSize ?? 0,
        isJson: false,
        preview: preview.preview,
        hasMore: preview.hasMore
      });
    }
    let errorMessage = stderr.trim();
    if (interrupted) {
      if (stderr) errorMessage += EOL;
      errorMessage += '<error>Command was aborted before completion</error>';
    }
    let backgroundInfo = '';
    if (backgroundTaskId) {
      const outputPath = getTaskOutputPath(backgroundTaskId);
      if (assistantAutoBackgrounded) {
        backgroundInfo = `Command exceeded the assistant-mode blocking budget (${ASSISTANT_BLOCKING_BUDGET_MS / 1000}s) and was moved to the background with ID: ${backgroundTaskId}. It is still running — you will be notified when it completes. Output is being written to: ${outputPath}. In assistant mode, delegate long-running work to a subagent or use run_in_background to keep this conversation responsive.`;
      } else if (backgroundedByUser) {
        backgroundInfo = `Command was manually backgrounded by user with ID: ${backgroundTaskId}. Output is being written to: ${outputPath}`;
      } else {
        backgroundInfo = `Command running in background with ID: ${backgroundTaskId}. Output is being written to: ${outputPath}`;
      }
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: [processedStdout, errorMessage, backgroundInfo].filter(Boolean).join('\n'),
      is_error: interrupted
    };
  },
  async call(input: BashToolInput, toolUseContext, _canUseTool?: CanUseToolFn, parentMessage?: AssistantMessage, onProgress?: ToolCallProgress<BashProgress>) {
    // Handle simulated sed edit - apply directly instead of running sed
    // This ensures what the user previewed is exactly what gets written
    if (input._simulatedSedEdit) {
      return applySedEdit(input._simulatedSedEdit, toolUseContext, parentMessage);
    }
    const {
      abortController,
      getAppState,
      setAppState,
      setToolJSX
    } = toolUseContext;
    const stdoutAccumulator = new EndTruncatingAccumulator();
    let stderrForShellReset = '';
    let interpretationResult: ReturnType<typeof interpretCommandResult> | undefined;
    let progressCounter = 0;
    let wasInterrupted = false;
    let result: ExecResult;
    const isMainThread = !toolUseContext.agentId;
    const preventCwdChanges = !isMainThread;
    try {
      // Use the new async generator version of runShellCommand
      const commandGenerator = runShellCommand({
        input,
        abortController,
        // Use the always-shared task channel so async agents' background
        // bash tasks are actually registered (and killable on agent exit).
        setAppState: toolUseContext.setAppStateForTasks ?? setAppState,
        setToolJSX,
        preventCwdChanges,
        isMainThread,
        toolUseId: toolUseContext.toolUseId,
        agentId: toolUseContext.agentId
      });

      // Consume the generator and capture the return value
      let generatorResult;
      do {
        generatorResult = await commandGenerator.next();
        if (!generatorResult.done && onProgress) {
          const progress = generatorResult.value;
          onProgress({
            toolUseID: `bash-progress-${progressCounter++}`,
            data: {
              type: 'bash_progress',
              output: progress.output,
              fullOutput: progress.fullOutput,
              elapsedTimeSeconds: progress.elapsedTimeSeconds,
              totalLines: progress.totalLines,
              totalBytes: progress.totalBytes,
              taskId: progress.taskId,
              timeoutMs: progress.timeoutMs
            }
          });
        }
      } while (!generatorResult.done);

      // Get the final result from the generator's return value
      result = generatorResult.value;
      trackGitOperations(input.command, result.code, result.stdout);
      const isInterrupt = result.interrupted && abortController.signal.reason === 'interrupt';

      // stderr is interleaved in stdout (merged fd) — result.stdout has both
      stdoutAccumulator.append((result.stdout || '').trimEnd() + EOL);

      // Interpret the command result using semantic rules
      interpretationResult = interpretCommandResult(input.command, result.code, result.stdout || '', '');

      // Check for git index.lock error (stderr is in stdout now)
      if (result.stdout && result.stdout.includes(".git/index.lock': File exists")) {
        logEvent('tengu_git_index_lock_error', {});
      }
      if (interpretationResult.isError && !isInterrupt) {
        // Only add exit code if it's actually an error
        if (result.code !== 0) {
          stdoutAccumulator.append(`Exit code ${result.code}`);
        }
      }
      if (!preventCwdChanges) {
        const appState = getAppState();
        if (resetCwdIfOutsideProject(appState.toolPermissionContext)) {
          stderrForShellReset = stdErrAppendShellResetMessage('');
        }
      }

      // Annotate output with sandbox violations if any (stderr is in stdout)
      const outputWithSbFailures = SandboxManager.annotateStderrWithSandboxFailures(input.command, result.stdout || '');
      if (result.preSpawnError) {
        throw new Error(result.preSpawnError);
      }
      if (interpretationResult.isError && !isInterrupt) {
        // stderr is merged into stdout (merged fd); outputWithSbFailures
        // already has the full output. Pass '' for stdout to avoid
        // duplication in getErrorParts() and processBashCommand.
        throw new ShellError('', outputWithSbFailures, result.code, result.interrupted);
      }
      wasInterrupted = result.interrupted;
    } finally {
      if (setToolJSX) setToolJSX(null);
    }

    // Get final string from accumulator
    const stdout = stdoutAccumulator.toString();

    // Large output: the file on disk has more than getMaxOutputLength() bytes.
    // stdout already contains the first chunk (from getStdout()). Copy the
    // output file to the tool-results dir so the model can read it via
    // FileRead. If > 64 MB, truncate after copying.
    const MAX_PERSISTED_SIZE = 64 * 1024 * 1024;
    let persistedOutputPath: string | undefined;
    let persistedOutputSize: number | undefined;
    if (result.outputFilePath && result.outputTaskId) {
      try {
        const fileStat = await fsStat(result.outputFilePath);
        persistedOutputSize = fileStat.size;
        await ensureToolResultsDir();
        const dest = getToolResultPath(result.outputTaskId, false);
        if (fileStat.size > MAX_PERSISTED_SIZE) {
          await fsTruncate(result.outputFilePath, MAX_PERSISTED_SIZE);
        }
        try {
          await link(result.outputFilePath, dest);
        } catch {
          await copyFile(result.outputFilePath, dest);
        }
        persistedOutputPath = dest;
      } catch {
        // File may already be gone — stdout preview is sufficient
      }
    }
    const commandType = input.command.split(' ')[0];
    logEvent('tengu_bash_tool_command_executed', {
      command_type: commandType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      stdout_length: stdout.length,
      stderr_length: 0,
      exit_code: result.code,
      interrupted: wasInterrupted
    });

    // Log code indexing tool usage
    const codeIndexingTool = detectCodeIndexingFromCommand(input.command);
    if (codeIndexingTool) {
      logEvent('tengu_code_indexing_tool_used', {
        tool: codeIndexingTool as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        source: 'cli' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        success: result.code === 0
      });
    }
    let strippedStdout = stripEmptyLines(stdout);

    // Claude Code hints protocol: CLIs/SDKs gated on CLAUDECODE=1 emit a
    // `<claude-code-hint />` tag to stderr (merged into stdout here). Scan,
    // record for useClaudeCodeHintRecommendation to surface, then strip
    // so the model never sees the tag — a zero-token side channel.
    // Stripping runs unconditionally (subagent output must stay clean too);
    // only the dialog recording is main-thread-only.
    const extracted = extractClaudeCodeHints(strippedStdout, input.command);
    strippedStdout = extracted.stripped;
    if (isMainThread && extracted.hints.length > 0) {
      for (const hint of extracted.hints) maybeRecordPluginHint(hint);
    }
    let isImage = isImageOutput(strippedStdout);

    // Cap image dimensions + size if present (CC-304 — see
    // resizeShellImageOutput). Scope the decoded buffer so it can be reclaimed
    // before we build the output Out object.
    let compressedStdout = strippedStdout;
    if (isImage) {
      const resized = await resizeShellImageOutput(strippedStdout, result.outputFilePath, persistedOutputSize);
      if (resized) {
        compressedStdout = resized;
      } else {
        // Parse failed or file too large (e.g. exceeds MAX_IMAGE_FILE_SIZE).
        // Keep isImage in sync with what we actually send so the UI label stays
        // accurate — mapToolResultToToolResultBlockParam's defensive
        // fallthrough will send text, not an image block.
        isImage = false;
      }
    }
    const data: Out = {
      stdout: compressedStdout,
      stderr: stderrForShellReset,
      interrupted: wasInterrupted,
      isImage,
      returnCodeInterpretation: interpretationResult?.message,
      noOutputExpected: isSilentBashCommand(input.command),
      backgroundTaskId: result.backgroundTaskId,
      backgroundedByUser: result.backgroundedByUser,
      assistantAutoBackgrounded: result.assistantAutoBackgrounded,
      dangerouslyDisableSandbox: 'dangerouslyDisableSandbox' in input ? input.dangerouslyDisableSandbox as boolean | undefined : undefined,
      persistedOutputPath,
      persistedOutputSize
    };
    return {
      data
    };
  },
  renderToolUseErrorMessage,
  isResultTruncated(output: Out): boolean {
    return isOutputLineTruncated(output.stdout) || isOutputLineTruncated(output.stderr);
  }
} satisfies ToolDef<InputSchema, Out, BashProgress>);
async function* runShellCommand({
  input,
  abortController,
  setAppState,
  setToolJSX,
  preventCwdChanges,
  isMainThread,
  toolUseId,
  agentId
}: {
  input: BashToolInput;
  abortController: AbortController;
  setAppState: (f: (prev: AppState) => AppState) => void;
  setToolJSX?: SetToolJSXFn;
  preventCwdChanges?: boolean;
  isMainThread?: boolean;
  toolUseId?: string;
  agentId?: AgentId;
}): AsyncGenerator<{
  type: 'progress';
  output: string;
  fullOutput: string;
  elapsedTimeSeconds: number;
  totalLines: number;
  totalBytes?: number;
  taskId?: string;
  timeoutMs?: number;
}, ExecResult, void> {
  const {
    command,
    description,
    timeout,
    run_in_background
  } = input;
  const timeoutMs = timeout || getDefaultTimeoutMs();
  let fullOutput = '';
  let lastProgressOutput = '';
  let lastTotalLines = 0;
  let lastTotalBytes = 0;
  let backgroundShellId: string | undefined = undefined;
  let assistantAutoBackgrounded = false;

  // Progress signal: resolved by onProgress callback from the shared poller,
  // waking the generator to yield a progress update.
  let resolveProgress: (() => void) | null = null;
  function createProgressSignal(): Promise<null> {
    return new Promise<null>(resolve => {
      resolveProgress = () => resolve(null);
    });
  }

  // Determine if auto-backgrounding should be enabled
  // Only enable for commands that are allowed to be auto-backgrounded
  // and when background tasks are not disabled
  const shouldAutoBackground = !isBackgroundTasksDisabled && isAutobackgroundingAllowed(command);
  const shellCommand = await exec(command, abortController.signal, 'bash', {
    timeout: timeoutMs,
    onProgress(lastLines, allLines, totalLines, totalBytes, isIncomplete) {
      lastProgressOutput = lastLines;
      fullOutput = allLines;
      lastTotalLines = totalLines;
      lastTotalBytes = isIncomplete ? totalBytes : 0;
      // Wake the generator so it yields the new progress data
      const resolve = resolveProgress;
      if (resolve) {
        resolveProgress = null;
        resolve();
      }
    },
    preventCwdChanges,
    shouldUseSandbox: shouldUseSandbox(input),
    shouldAutoBackground
  });

  // Start the command execution
  const resultPromise = shellCommand.result;

  // Helper to spawn a background task and return its ID
  async function spawnBackgroundTask(): Promise<string> {
    const handle = await spawnShellTask({
      command,
      description: description || command,
      shellCommand,
      toolUseId,
      agentId
    }, {
      abortController,
      getAppState: () => {
        // We don't have direct access to getAppState here, but spawn doesn't
        // actually use it during the spawn process
        throw new Error('getAppState not available in runShellCommand context');
      },
      setAppState
    });
    return handle.taskId;
  }

  // Helper to start backgrounding with optional logging
  function startBackgrounding(eventName: string, backgroundFn?: (shellId: string) => void): void {
    // If a foreground task is already registered (via registerForeground in the
    // progress loop), background it in-place instead of re-spawning. Re-spawning
    // would overwrite tasks[taskId], emit a duplicate task_started SDK event,
    // and leak the first cleanup callback.
    if (foregroundTaskId) {
      if (!backgroundExistingForegroundTask(foregroundTaskId, shellCommand, description || command, setAppState, toolUseId)) {
        return;
      }
      backgroundShellId = foregroundTaskId;
      logEvent(eventName, {
        command_type: getCommandTypeForLogging(command)
      });
      backgroundFn?.(foregroundTaskId);
      return;
    }

    // No foreground task registered — spawn a new background task
    // Note: spawn is essentially synchronous despite being async
    void spawnBackgroundTask().then(shellId => {
      backgroundShellId = shellId;

      // Wake the generator's Promise.race so it sees backgroundShellId.
      // Without this, if the poller has stopped ticking for this task
      // (no output + shared-poller race with sibling stopPolling calls)
      // and the process is hung on I/O, the race at line ~1357 never
      // resolves and the generator deadlocks despite being backgrounded.
      const resolve = resolveProgress;
      if (resolve) {
        resolveProgress = null;
        resolve();
      }
      logEvent(eventName, {
        command_type: getCommandTypeForLogging(command)
      });
      if (backgroundFn) {
        backgroundFn(shellId);
      }
    });
  }

  // Set up auto-backgrounding on timeout if enabled
  // Only background commands that are allowed to be auto-backgrounded (not sleep, etc.)
  if (shellCommand.onTimeout && shouldAutoBackground) {
    shellCommand.onTimeout(backgroundFn => {
      startBackgrounding('tengu_bash_command_timeout_backgrounded', backgroundFn);
    });
  }

  // In assistant mode, the main agent should stay responsive. Auto-background
  // blocking commands after ASSISTANT_BLOCKING_BUDGET_MS so the agent can keep
  // coordinating instead of waiting. The command keeps running — no state loss.
  if (feature('KAIROS') && getKairosActive() && isMainThread && !isBackgroundTasksDisabled && run_in_background !== true) {
    setTimeout(() => {
      if (shellCommand.status === 'running' && backgroundShellId === undefined) {
        assistantAutoBackgrounded = true;
        startBackgrounding('tengu_bash_command_assistant_auto_backgrounded');
      }
    }, ASSISTANT_BLOCKING_BUDGET_MS).unref();
  }

  // Handle Claude asking to run it in the background explicitly
  // When explicitly requested via run_in_background, always honor the request
  // regardless of the command type (isAutobackgroundingAllowed only applies to automatic backgrounding)
  // Skip if background tasks are disabled - run in foreground instead
  if (run_in_background === true && !isBackgroundTasksDisabled) {
    const shellId = await spawnBackgroundTask();
    logEvent('tengu_bash_command_explicitly_backgrounded', {
      command_type: getCommandTypeForLogging(command)
    });
    return {
      stdout: '',
      stderr: '',
      code: 0,
      interrupted: false,
      backgroundTaskId: shellId
    };
  }

  // Wait for the initial threshold before showing progress
  const startTime = Date.now();
  let foregroundTaskId: string | undefined = undefined;
  {
    const initialResult = await Promise.race([resultPromise, new Promise<null>(resolve => {
      const t = setTimeout((r: (v: null) => void) => r(null), PROGRESS_THRESHOLD_MS, resolve);
      t.unref();
    })]);
    if (initialResult !== null) {
      shellCommand.cleanup();
      return initialResult;
    }
    if (backgroundShellId) {
      return {
        stdout: '',
        stderr: '',
        code: 0,
        interrupted: false,
        backgroundTaskId: backgroundShellId,
        assistantAutoBackgrounded
      };
    }
  }

  // Start polling the output file for progress. The poller's #tick calls
  // onProgress every second, which resolves progressSignal below.
  TaskOutput.startPolling(shellCommand.taskOutput.taskId);

  // Progress loop: wake is driven by the shared poller calling onProgress,
  // which resolves the progressSignal.
  try {
    while (true) {
      const progressSignal = createProgressSignal();
      const result = await Promise.race([resultPromise, progressSignal]);
      if (result !== null) {
        // Race: backgrounding fired (15s timer / onTimeout / Ctrl+B) but the
        // command completed before the next poll tick. #handleExit sets
        // backgroundTaskId but skips outputFilePath (it assumes the background
        // message or <task_notification> will carry the path). Strip
        // backgroundTaskId so the model sees a clean completed command,
        // reconstruct outputFilePath for large outputs, and suppress the
        // redundant <task_notification> from the .then() handler.
        // Check result.backgroundTaskId (not the closure var) to also cover
        // Ctrl+B, which calls shellCommand.background() directly.
        if (result.backgroundTaskId !== undefined) {
          markTaskNotified(result.backgroundTaskId, setAppState);
          const fixedResult: ExecResult = {
            ...result,
            backgroundTaskId: undefined
          };
          // Mirror ShellCommand.#handleExit's large-output branch that was
          // skipped because #backgroundTaskId was set.
          const {
            taskOutput
          } = shellCommand;
          if (taskOutput.stdoutToFile && !taskOutput.outputFileRedundant) {
            fixedResult.outputFilePath = taskOutput.path;
            fixedResult.outputFileSize = taskOutput.outputFileSize;
            fixedResult.outputTaskId = taskOutput.taskId;
          }
          shellCommand.cleanup();
          return fixedResult;
        }
        // Command has completed - return the actual result
        // If we registered as a foreground task, unregister it
        if (foregroundTaskId) {
          unregisterForeground(foregroundTaskId, setAppState);
        }
        // Clean up stream resources for foreground commands
        // (backgrounded commands are cleaned up by LocalShellTask)
        shellCommand.cleanup();
        return result;
      }

      // Check if command was backgrounded (either via old mechanism or new backgroundAll)
      if (backgroundShellId) {
        return {
          stdout: '',
          stderr: '',
          code: 0,
          interrupted: false,
          backgroundTaskId: backgroundShellId,
          assistantAutoBackgrounded
        };
      }

      // Check if this foreground task was backgrounded via backgroundAll()
      if (foregroundTaskId) {
        // shellCommand.status becomes 'backgrounded' when background() is called
        if (shellCommand.status === 'backgrounded') {
          return {
            stdout: '',
            stderr: '',
            code: 0,
            interrupted: false,
            backgroundTaskId: foregroundTaskId,
            backgroundedByUser: true
          };
        }
      }

      // Time for a progress update
      const elapsed = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsed / 1000);

      // Show minimal backgrounding UI if available
      // Skip if background tasks are disabled
      if (!isBackgroundTasksDisabled && backgroundShellId === undefined && elapsedSeconds >= PROGRESS_THRESHOLD_MS / 1000 && setToolJSX) {
        // Register this command as a foreground task so it can be backgrounded via Ctrl+B
        if (!foregroundTaskId) {
          foregroundTaskId = registerForeground({
            command,
            description: description || command,
            shellCommand,
            agentId
          }, setAppState, toolUseId);
        }
        setToolJSX({
          jsx: <BackgroundHint />,
          shouldHidePromptInput: false,
          shouldContinueAnimation: true,
          showSpinner: true
        });
      }
      yield {
        type: 'progress',
        fullOutput,
        output: lastProgressOutput,
        elapsedTimeSeconds: elapsedSeconds,
        totalLines: lastTotalLines,
        totalBytes: lastTotalBytes,
        taskId: shellCommand.taskOutput.taskId,
        ...(timeout ? {
          timeoutMs
        } : undefined)
      };
    }
  } finally {
    TaskOutput.stopPolling(shellCommand.taskOutput.taskId);
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiVG9vbFJlc3VsdEJsb2NrUGFyYW0iLCJjb3B5RmlsZSIsInN0YXQiLCJmc1N0YXQiLCJ0cnVuY2F0ZSIsImZzVHJ1bmNhdGUiLCJsaW5rIiwiUmVhY3QiLCJDYW5Vc2VUb29sRm4iLCJBcHBTdGF0ZSIsInoiLCJnZXRLYWlyb3NBY3RpdmUiLCJUT09MX1NVTU1BUllfTUFYX0xFTkdUSCIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJsb2dFdmVudCIsIm5vdGlmeVZzY29kZUZpbGVVcGRhdGVkIiwiU2V0VG9vbEpTWEZuIiwiVG9vbENhbGxQcm9ncmVzcyIsIlRvb2xVc2VDb250ZXh0IiwiVmFsaWRhdGlvblJlc3VsdCIsImJ1aWxkVG9vbCIsIlRvb2xEZWYiLCJiYWNrZ3JvdW5kRXhpc3RpbmdGb3JlZ3JvdW5kVGFzayIsIm1hcmtUYXNrTm90aWZpZWQiLCJyZWdpc3RlckZvcmVncm91bmQiLCJzcGF3blNoZWxsVGFzayIsInVucmVnaXN0ZXJGb3JlZ3JvdW5kIiwiQWdlbnRJZCIsIkFzc2lzdGFudE1lc3NhZ2UiLCJwYXJzZUZvclNlY3VyaXR5Iiwic3BsaXRDb21tYW5kX0RFUFJFQ0FURUQiLCJzcGxpdENvbW1hbmRXaXRoT3BlcmF0b3JzIiwiZXh0cmFjdENsYXVkZUNvZGVIaW50cyIsImRldGVjdENvZGVJbmRleGluZ0Zyb21Db21tYW5kIiwiaXNFbnZUcnV0aHkiLCJpc0VOT0VOVCIsIlNoZWxsRXJyb3IiLCJkZXRlY3RGaWxlRW5jb2RpbmciLCJkZXRlY3RMaW5lRW5kaW5ncyIsImdldEZpbGVNb2RpZmljYXRpb25UaW1lIiwid3JpdGVUZXh0Q29udGVudCIsImZpbGVIaXN0b3J5RW5hYmxlZCIsImZpbGVIaXN0b3J5VHJhY2tFZGl0IiwiZ2V0RnNJbXBsZW1lbnRhdGlvbiIsImxhenlTY2hlbWEiLCJleHBhbmRQYXRoIiwiUGVybWlzc2lvblJlc3VsdCIsIm1heWJlUmVjb3JkUGx1Z2luSGludCIsImV4ZWMiLCJFeGVjUmVzdWx0IiwiU2FuZGJveE1hbmFnZXIiLCJzZW1hbnRpY0Jvb2xlYW4iLCJzZW1hbnRpY051bWJlciIsIkVuZFRydW5jYXRpbmdBY2N1bXVsYXRvciIsImdldFRhc2tPdXRwdXRQYXRoIiwiVGFza091dHB1dCIsImlzT3V0cHV0TGluZVRydW5jYXRlZCIsImJ1aWxkTGFyZ2VUb29sUmVzdWx0TWVzc2FnZSIsImVuc3VyZVRvb2xSZXN1bHRzRGlyIiwiZ2VuZXJhdGVQcmV2aWV3IiwiZ2V0VG9vbFJlc3VsdFBhdGgiLCJQUkVWSUVXX1NJWkVfQllURVMiLCJ1c2VyRmFjaW5nTmFtZSIsImZpbGVFZGl0VXNlckZhY2luZ05hbWUiLCJ0cmFja0dpdE9wZXJhdGlvbnMiLCJiYXNoVG9vbEhhc1Blcm1pc3Npb24iLCJjb21tYW5kSGFzQW55Q2QiLCJtYXRjaFdpbGRjYXJkUGF0dGVybiIsInBlcm1pc3Npb25SdWxlRXh0cmFjdFByZWZpeCIsImludGVycHJldENvbW1hbmRSZXN1bHQiLCJnZXREZWZhdWx0VGltZW91dE1zIiwiZ2V0TWF4VGltZW91dE1zIiwiZ2V0U2ltcGxlUHJvbXB0IiwiY2hlY2tSZWFkT25seUNvbnN0cmFpbnRzIiwicGFyc2VTZWRFZGl0Q29tbWFuZCIsInNob3VsZFVzZVNhbmRib3giLCJCQVNIX1RPT0xfTkFNRSIsIkJhY2tncm91bmRIaW50IiwicmVuZGVyVG9vbFJlc3VsdE1lc3NhZ2UiLCJyZW5kZXJUb29sVXNlRXJyb3JNZXNzYWdlIiwicmVuZGVyVG9vbFVzZU1lc3NhZ2UiLCJyZW5kZXJUb29sVXNlUHJvZ3Jlc3NNZXNzYWdlIiwicmVuZGVyVG9vbFVzZVF1ZXVlZE1lc3NhZ2UiLCJidWlsZEltYWdlVG9vbFJlc3VsdCIsImlzSW1hZ2VPdXRwdXQiLCJyZXNldEN3ZElmT3V0c2lkZVByb2plY3QiLCJyZXNpemVTaGVsbEltYWdlT3V0cHV0Iiwic3RkRXJyQXBwZW5kU2hlbGxSZXNldE1lc3NhZ2UiLCJzdHJpcEVtcHR5TGluZXMiLCJFT0wiLCJQUk9HUkVTU19USFJFU0hPTERfTVMiLCJBU1NJU1RBTlRfQkxPQ0tJTkdfQlVER0VUX01TIiwiQkFTSF9TRUFSQ0hfQ09NTUFORFMiLCJTZXQiLCJCQVNIX1JFQURfQ09NTUFORFMiLCJCQVNIX0xJU1RfQ09NTUFORFMiLCJCQVNIX1NFTUFOVElDX05FVVRSQUxfQ09NTUFORFMiLCJCQVNIX1NJTEVOVF9DT01NQU5EUyIsImlzU2VhcmNoT3JSZWFkQmFzaENvbW1hbmQiLCJjb21tYW5kIiwiaXNTZWFyY2giLCJpc1JlYWQiLCJpc0xpc3QiLCJwYXJ0c1dpdGhPcGVyYXRvcnMiLCJsZW5ndGgiLCJoYXNTZWFyY2giLCJoYXNSZWFkIiwiaGFzTGlzdCIsImhhc05vbk5ldXRyYWxDb21tYW5kIiwic2tpcE5leHRBc1JlZGlyZWN0VGFyZ2V0IiwicGFydCIsImJhc2VDb21tYW5kIiwidHJpbSIsInNwbGl0IiwiaGFzIiwiaXNQYXJ0U2VhcmNoIiwiaXNQYXJ0UmVhZCIsImlzUGFydExpc3QiLCJpc1NpbGVudEJhc2hDb21tYW5kIiwiaGFzTm9uRmFsbGJhY2tDb21tYW5kIiwibGFzdE9wZXJhdG9yIiwiRElTQUxMT1dFRF9BVVRPX0JBQ0tHUk9VTkRfQ09NTUFORFMiLCJpc0JhY2tncm91bmRUYXNrc0Rpc2FibGVkIiwicHJvY2VzcyIsImVudiIsIkNMQVVERV9DT0RFX0RJU0FCTEVfQkFDS0dST1VORF9UQVNLUyIsImZ1bGxJbnB1dFNjaGVtYSIsInN0cmljdE9iamVjdCIsInN0cmluZyIsImRlc2NyaWJlIiwidGltZW91dCIsIm51bWJlciIsIm9wdGlvbmFsIiwiZGVzY3JpcHRpb24iLCJydW5faW5fYmFja2dyb3VuZCIsImJvb2xlYW4iLCJkYW5nZXJvdXNseURpc2FibGVTYW5kYm94IiwiX3NpbXVsYXRlZFNlZEVkaXQiLCJvYmplY3QiLCJmaWxlUGF0aCIsIm5ld0NvbnRlbnQiLCJpbnB1dFNjaGVtYSIsIm9taXQiLCJJbnB1dFNjaGVtYSIsIlJldHVyblR5cGUiLCJCYXNoVG9vbElucHV0IiwiaW5mZXIiLCJDT01NT05fQkFDS0dST1VORF9DT01NQU5EUyIsImNvbnN0IiwiZ2V0Q29tbWFuZFR5cGVGb3JMb2dnaW5nIiwicGFydHMiLCJpbmNsdWRlcyIsIm91dHB1dFNjaGVtYSIsInN0ZG91dCIsInN0ZGVyciIsInJhd091dHB1dFBhdGgiLCJpbnRlcnJ1cHRlZCIsImlzSW1hZ2UiLCJiYWNrZ3JvdW5kVGFza0lkIiwiYmFja2dyb3VuZGVkQnlVc2VyIiwiYXNzaXN0YW50QXV0b0JhY2tncm91bmRlZCIsInJldHVybkNvZGVJbnRlcnByZXRhdGlvbiIsIm5vT3V0cHV0RXhwZWN0ZWQiLCJzdHJ1Y3R1cmVkQ29udGVudCIsImFycmF5IiwiYW55IiwicGVyc2lzdGVkT3V0cHV0UGF0aCIsInBlcnNpc3RlZE91dHB1dFNpemUiLCJPdXRwdXRTY2hlbWEiLCJPdXQiLCJCYXNoUHJvZ3Jlc3MiLCJpc0F1dG9iYWNrZ3JvdW5kaW5nQWxsb3dlZCIsImRldGVjdEJsb2NrZWRTbGVlcFBhdHRlcm4iLCJmaXJzdCIsIm0iLCJzZWNzIiwicGFyc2VJbnQiLCJyZXN0Iiwic2xpY2UiLCJqb2luIiwiU2ltdWxhdGVkU2VkRWRpdFJlc3VsdCIsImRhdGEiLCJTaW11bGF0ZWRTZWRFZGl0Q29udGV4dCIsIlBpY2siLCJhcHBseVNlZEVkaXQiLCJzaW11bGF0ZWRFZGl0IiwidG9vbFVzZUNvbnRleHQiLCJwYXJlbnRNZXNzYWdlIiwiUHJvbWlzZSIsImFic29sdXRlRmlsZVBhdGgiLCJmcyIsImVuY29kaW5nIiwib3JpZ2luYWxDb250ZW50IiwicmVhZEZpbGUiLCJlIiwidXBkYXRlRmlsZUhpc3RvcnlTdGF0ZSIsInV1aWQiLCJlbmRpbmdzIiwicmVhZEZpbGVTdGF0ZSIsInNldCIsImNvbnRlbnQiLCJ0aW1lc3RhbXAiLCJvZmZzZXQiLCJ1bmRlZmluZWQiLCJsaW1pdCIsIkJhc2hUb29sIiwibmFtZSIsInNlYXJjaEhpbnQiLCJtYXhSZXN1bHRTaXplQ2hhcnMiLCJzdHJpY3QiLCJwcm9tcHQiLCJpc0NvbmN1cnJlbmN5U2FmZSIsImlucHV0IiwiaXNSZWFkT25seSIsImNvbXBvdW5kQ29tbWFuZEhhc0NkIiwicmVzdWx0IiwiYmVoYXZpb3IiLCJ0b0F1dG9DbGFzc2lmaWVySW5wdXQiLCJwcmVwYXJlUGVybWlzc2lvbk1hdGNoZXIiLCJwYXJzZWQiLCJraW5kIiwic3ViY29tbWFuZHMiLCJjb21tYW5kcyIsIm1hcCIsImMiLCJhcmd2IiwicGF0dGVybiIsInByZWZpeCIsInNvbWUiLCJjbWQiLCJzdGFydHNXaXRoIiwiaXNTZWFyY2hPclJlYWRDb21tYW5kIiwic2FmZVBhcnNlIiwic3VjY2VzcyIsInNlZEluZm8iLCJmaWxlX3BhdGgiLCJvbGRfc3RyaW5nIiwiQ0xBVURFX0NPREVfQkFTSF9TQU5EQk9YX1NIT1dfSU5ESUNBVE9SIiwiZ2V0VG9vbFVzZVN1bW1hcnkiLCJnZXRBY3Rpdml0eURlc2NyaXB0aW9uIiwiZGVzYyIsInZhbGlkYXRlSW5wdXQiLCJzbGVlcFBhdHRlcm4iLCJtZXNzYWdlIiwiZXJyb3JDb2RlIiwiY2hlY2tQZXJtaXNzaW9ucyIsImNvbnRleHQiLCJleHRyYWN0U2VhcmNoVGV4dCIsIm1hcFRvb2xSZXN1bHRUb1Rvb2xSZXN1bHRCbG9ja1BhcmFtIiwidG9vbFVzZUlEIiwidG9vbF91c2VfaWQiLCJ0eXBlIiwiYmxvY2siLCJwcm9jZXNzZWRTdGRvdXQiLCJyZXBsYWNlIiwidHJpbUVuZCIsInByZXZpZXciLCJmaWxlcGF0aCIsIm9yaWdpbmFsU2l6ZSIsImlzSnNvbiIsImhhc01vcmUiLCJlcnJvck1lc3NhZ2UiLCJiYWNrZ3JvdW5kSW5mbyIsIm91dHB1dFBhdGgiLCJmaWx0ZXIiLCJCb29sZWFuIiwiaXNfZXJyb3IiLCJjYWxsIiwiX2NhblVzZVRvb2wiLCJvblByb2dyZXNzIiwiYWJvcnRDb250cm9sbGVyIiwiZ2V0QXBwU3RhdGUiLCJzZXRBcHBTdGF0ZSIsInNldFRvb2xKU1giLCJzdGRvdXRBY2N1bXVsYXRvciIsInN0ZGVyckZvclNoZWxsUmVzZXQiLCJpbnRlcnByZXRhdGlvblJlc3VsdCIsInByb2dyZXNzQ291bnRlciIsIndhc0ludGVycnVwdGVkIiwiaXNNYWluVGhyZWFkIiwiYWdlbnRJZCIsInByZXZlbnRDd2RDaGFuZ2VzIiwiY29tbWFuZEdlbmVyYXRvciIsInJ1blNoZWxsQ29tbWFuZCIsInNldEFwcFN0YXRlRm9yVGFza3MiLCJ0b29sVXNlSWQiLCJnZW5lcmF0b3JSZXN1bHQiLCJuZXh0IiwiZG9uZSIsInByb2dyZXNzIiwidmFsdWUiLCJvdXRwdXQiLCJmdWxsT3V0cHV0IiwiZWxhcHNlZFRpbWVTZWNvbmRzIiwidG90YWxMaW5lcyIsInRvdGFsQnl0ZXMiLCJ0YXNrSWQiLCJ0aW1lb3V0TXMiLCJjb2RlIiwiaXNJbnRlcnJ1cHQiLCJzaWduYWwiLCJyZWFzb24iLCJhcHBlbmQiLCJpc0Vycm9yIiwiYXBwU3RhdGUiLCJ0b29sUGVybWlzc2lvbkNvbnRleHQiLCJvdXRwdXRXaXRoU2JGYWlsdXJlcyIsImFubm90YXRlU3RkZXJyV2l0aFNhbmRib3hGYWlsdXJlcyIsInByZVNwYXduRXJyb3IiLCJFcnJvciIsInRvU3RyaW5nIiwiTUFYX1BFUlNJU1RFRF9TSVpFIiwib3V0cHV0RmlsZVBhdGgiLCJvdXRwdXRUYXNrSWQiLCJmaWxlU3RhdCIsInNpemUiLCJkZXN0IiwiY29tbWFuZFR5cGUiLCJjb21tYW5kX3R5cGUiLCJzdGRvdXRfbGVuZ3RoIiwic3RkZXJyX2xlbmd0aCIsImV4aXRfY29kZSIsImNvZGVJbmRleGluZ1Rvb2wiLCJ0b29sIiwic291cmNlIiwic3RyaXBwZWRTdGRvdXQiLCJleHRyYWN0ZWQiLCJzdHJpcHBlZCIsImhpbnRzIiwiaGludCIsImNvbXByZXNzZWRTdGRvdXQiLCJyZXNpemVkIiwiaXNSZXN1bHRUcnVuY2F0ZWQiLCJBYm9ydENvbnRyb2xsZXIiLCJmIiwicHJldiIsIkFzeW5jR2VuZXJhdG9yIiwibGFzdFByb2dyZXNzT3V0cHV0IiwibGFzdFRvdGFsTGluZXMiLCJsYXN0VG90YWxCeXRlcyIsImJhY2tncm91bmRTaGVsbElkIiwicmVzb2x2ZVByb2dyZXNzIiwiY3JlYXRlUHJvZ3Jlc3NTaWduYWwiLCJyZXNvbHZlIiwic2hvdWxkQXV0b0JhY2tncm91bmQiLCJzaGVsbENvbW1hbmQiLCJsYXN0TGluZXMiLCJhbGxMaW5lcyIsImlzSW5jb21wbGV0ZSIsInJlc3VsdFByb21pc2UiLCJzcGF3bkJhY2tncm91bmRUYXNrIiwiaGFuZGxlIiwic3RhcnRCYWNrZ3JvdW5kaW5nIiwiZXZlbnROYW1lIiwiYmFja2dyb3VuZEZuIiwic2hlbGxJZCIsImZvcmVncm91bmRUYXNrSWQiLCJ0aGVuIiwib25UaW1lb3V0Iiwic2V0VGltZW91dCIsInN0YXR1cyIsInVucmVmIiwic3RhcnRUaW1lIiwiRGF0ZSIsIm5vdyIsImluaXRpYWxSZXN1bHQiLCJyYWNlIiwidCIsInIiLCJ2IiwiY2xlYW51cCIsInN0YXJ0UG9sbGluZyIsInRhc2tPdXRwdXQiLCJwcm9ncmVzc1NpZ25hbCIsImZpeGVkUmVzdWx0Iiwic3Rkb3V0VG9GaWxlIiwib3V0cHV0RmlsZVJlZHVuZGFudCIsInBhdGgiLCJvdXRwdXRGaWxlU2l6ZSIsImVsYXBzZWQiLCJlbGFwc2VkU2Vjb25kcyIsIk1hdGgiLCJmbG9vciIsImpzeCIsInNob3VsZEhpZGVQcm9tcHRJbnB1dCIsInNob3VsZENvbnRpbnVlQW5pbWF0aW9uIiwic2hvd1NwaW5uZXIiLCJzdG9wUG9sbGluZyJdLCJzb3VyY2VzIjpbIkJhc2hUb29sLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbmltcG9ydCB0eXBlIHsgVG9vbFJlc3VsdEJsb2NrUGFyYW0gfSBmcm9tICdAYW50aHJvcGljLWFpL3Nkay9yZXNvdXJjZXMvaW5kZXgubWpzJ1xuaW1wb3J0IHtcbiAgY29weUZpbGUsXG4gIHN0YXQgYXMgZnNTdGF0LFxuICB0cnVuY2F0ZSBhcyBmc1RydW5jYXRlLFxuICBsaW5rLFxufSBmcm9tICdmcy9wcm9taXNlcydcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHR5cGUgeyBDYW5Vc2VUb29sRm4gfSBmcm9tICdzcmMvaG9va3MvdXNlQ2FuVXNlVG9vbC5qcydcbmltcG9ydCB0eXBlIHsgQXBwU3RhdGUgfSBmcm9tICdzcmMvc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgeyB6IH0gZnJvbSAnem9kL3Y0J1xuaW1wb3J0IHsgZ2V0S2Fpcm9zQWN0aXZlIH0gZnJvbSAnLi4vLi4vYm9vdHN0cmFwL3N0YXRlLmpzJ1xuaW1wb3J0IHsgVE9PTF9TVU1NQVJZX01BWF9MRU5HVEggfSBmcm9tICcuLi8uLi9jb25zdGFudHMvdG9vbExpbWl0cy5qcydcbmltcG9ydCB7XG4gIHR5cGUgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgbG9nRXZlbnQsXG59IGZyb20gJy4uLy4uL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB7IG5vdGlmeVZzY29kZUZpbGVVcGRhdGVkIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWNwL3ZzY29kZVNka01jcC5qcydcbmltcG9ydCB0eXBlIHtcbiAgU2V0VG9vbEpTWEZuLFxuICBUb29sQ2FsbFByb2dyZXNzLFxuICBUb29sVXNlQ29udGV4dCxcbiAgVmFsaWRhdGlvblJlc3VsdCxcbn0gZnJvbSAnLi4vLi4vVG9vbC5qcydcbmltcG9ydCB7IGJ1aWxkVG9vbCwgdHlwZSBUb29sRGVmIH0gZnJvbSAnLi4vLi4vVG9vbC5qcydcbmltcG9ydCB7XG4gIGJhY2tncm91bmRFeGlzdGluZ0ZvcmVncm91bmRUYXNrLFxuICBtYXJrVGFza05vdGlmaWVkLFxuICByZWdpc3RlckZvcmVncm91bmQsXG4gIHNwYXduU2hlbGxUYXNrLFxuICB1bnJlZ2lzdGVyRm9yZWdyb3VuZCxcbn0gZnJvbSAnLi4vLi4vdGFza3MvTG9jYWxTaGVsbFRhc2svTG9jYWxTaGVsbFRhc2suanMnXG5pbXBvcnQgdHlwZSB7IEFnZW50SWQgfSBmcm9tICcuLi8uLi90eXBlcy9pZHMuanMnXG5pbXBvcnQgdHlwZSB7IEFzc2lzdGFudE1lc3NhZ2UgfSBmcm9tICcuLi8uLi90eXBlcy9tZXNzYWdlLmpzJ1xuaW1wb3J0IHsgcGFyc2VGb3JTZWN1cml0eSB9IGZyb20gJy4uLy4uL3V0aWxzL2Jhc2gvYXN0LmpzJ1xuaW1wb3J0IHtcbiAgc3BsaXRDb21tYW5kX0RFUFJFQ0FURUQsXG4gIHNwbGl0Q29tbWFuZFdpdGhPcGVyYXRvcnMsXG59IGZyb20gJy4uLy4uL3V0aWxzL2Jhc2gvY29tbWFuZHMuanMnXG5pbXBvcnQgeyBleHRyYWN0Q2xhdWRlQ29kZUhpbnRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY2xhdWRlQ29kZUhpbnRzLmpzJ1xuaW1wb3J0IHsgZGV0ZWN0Q29kZUluZGV4aW5nRnJvbUNvbW1hbmQgfSBmcm9tICcuLi8uLi91dGlscy9jb2RlSW5kZXhpbmcuanMnXG5pbXBvcnQgeyBpc0VudlRydXRoeSB9IGZyb20gJy4uLy4uL3V0aWxzL2VudlV0aWxzLmpzJ1xuaW1wb3J0IHsgaXNFTk9FTlQsIFNoZWxsRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcnMuanMnXG5pbXBvcnQge1xuICBkZXRlY3RGaWxlRW5jb2RpbmcsXG4gIGRldGVjdExpbmVFbmRpbmdzLFxuICBnZXRGaWxlTW9kaWZpY2F0aW9uVGltZSxcbiAgd3JpdGVUZXh0Q29udGVudCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvZmlsZS5qcydcbmltcG9ydCB7XG4gIGZpbGVIaXN0b3J5RW5hYmxlZCxcbiAgZmlsZUhpc3RvcnlUcmFja0VkaXQsXG59IGZyb20gJy4uLy4uL3V0aWxzL2ZpbGVIaXN0b3J5LmpzJ1xuaW1wb3J0IHsgdHJ1bmNhdGUgfSBmcm9tICcuLi8uLi91dGlscy9mb3JtYXQuanMnXG5pbXBvcnQgeyBnZXRGc0ltcGxlbWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvZnNPcGVyYXRpb25zLmpzJ1xuaW1wb3J0IHsgbGF6eVNjaGVtYSB9IGZyb20gJy4uLy4uL3V0aWxzL2xhenlTY2hlbWEuanMnXG5pbXBvcnQgeyBleHBhbmRQYXRoIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGF0aC5qcydcbmltcG9ydCB0eXBlIHsgUGVybWlzc2lvblJlc3VsdCB9IGZyb20gJy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL1Blcm1pc3Npb25SZXN1bHQuanMnXG5pbXBvcnQgeyBtYXliZVJlY29yZFBsdWdpbkhpbnQgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL2hpbnRSZWNvbW1lbmRhdGlvbi5qcydcbmltcG9ydCB7IGV4ZWMgfSBmcm9tICcuLi8uLi91dGlscy9TaGVsbC5qcydcbmltcG9ydCB0eXBlIHsgRXhlY1Jlc3VsdCB9IGZyb20gJy4uLy4uL3V0aWxzL1NoZWxsQ29tbWFuZC5qcydcbmltcG9ydCB7IFNhbmRib3hNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2FuZGJveC9zYW5kYm94LWFkYXB0ZXIuanMnXG5pbXBvcnQgeyBzZW1hbnRpY0Jvb2xlYW4gfSBmcm9tICcuLi8uLi91dGlscy9zZW1hbnRpY0Jvb2xlYW4uanMnXG5pbXBvcnQgeyBzZW1hbnRpY051bWJlciB9IGZyb20gJy4uLy4uL3V0aWxzL3NlbWFudGljTnVtYmVyLmpzJ1xuaW1wb3J0IHsgRW5kVHJ1bmNhdGluZ0FjY3VtdWxhdG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3RyaW5nVXRpbHMuanMnXG5pbXBvcnQgeyBnZXRUYXNrT3V0cHV0UGF0aCB9IGZyb20gJy4uLy4uL3V0aWxzL3Rhc2svZGlza091dHB1dC5qcydcbmltcG9ydCB7IFRhc2tPdXRwdXQgfSBmcm9tICcuLi8uLi91dGlscy90YXNrL1Rhc2tPdXRwdXQuanMnXG5pbXBvcnQgeyBpc091dHB1dExpbmVUcnVuY2F0ZWQgfSBmcm9tICcuLi8uLi91dGlscy90ZXJtaW5hbC5qcydcbmltcG9ydCB7XG4gIGJ1aWxkTGFyZ2VUb29sUmVzdWx0TWVzc2FnZSxcbiAgZW5zdXJlVG9vbFJlc3VsdHNEaXIsXG4gIGdlbmVyYXRlUHJldmlldyxcbiAgZ2V0VG9vbFJlc3VsdFBhdGgsXG4gIFBSRVZJRVdfU0laRV9CWVRFUyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvdG9vbFJlc3VsdFN0b3JhZ2UuanMnXG5pbXBvcnQgeyB1c2VyRmFjaW5nTmFtZSBhcyBmaWxlRWRpdFVzZXJGYWNpbmdOYW1lIH0gZnJvbSAnLi4vRmlsZUVkaXRUb29sL1VJLmpzJ1xuaW1wb3J0IHsgdHJhY2tHaXRPcGVyYXRpb25zIH0gZnJvbSAnLi4vc2hhcmVkL2dpdE9wZXJhdGlvblRyYWNraW5nLmpzJ1xuaW1wb3J0IHtcbiAgYmFzaFRvb2xIYXNQZXJtaXNzaW9uLFxuICBjb21tYW5kSGFzQW55Q2QsXG4gIG1hdGNoV2lsZGNhcmRQYXR0ZXJuLFxuICBwZXJtaXNzaW9uUnVsZUV4dHJhY3RQcmVmaXgsXG59IGZyb20gJy4vYmFzaFBlcm1pc3Npb25zLmpzJ1xuaW1wb3J0IHsgaW50ZXJwcmV0Q29tbWFuZFJlc3VsdCB9IGZyb20gJy4vY29tbWFuZFNlbWFudGljcy5qcydcbmltcG9ydCB7XG4gIGdldERlZmF1bHRUaW1lb3V0TXMsXG4gIGdldE1heFRpbWVvdXRNcyxcbiAgZ2V0U2ltcGxlUHJvbXB0LFxufSBmcm9tICcuL3Byb21wdC5qcydcbmltcG9ydCB7IGNoZWNrUmVhZE9ubHlDb25zdHJhaW50cyB9IGZyb20gJy4vcmVhZE9ubHlWYWxpZGF0aW9uLmpzJ1xuaW1wb3J0IHsgcGFyc2VTZWRFZGl0Q29tbWFuZCB9IGZyb20gJy4vc2VkRWRpdFBhcnNlci5qcydcbmltcG9ydCB7IHNob3VsZFVzZVNhbmRib3ggfSBmcm9tICcuL3Nob3VsZFVzZVNhbmRib3guanMnXG5pbXBvcnQgeyBCQVNIX1RPT0xfTkFNRSB9IGZyb20gJy4vdG9vbE5hbWUuanMnXG5pbXBvcnQge1xuICBCYWNrZ3JvdW5kSGludCxcbiAgcmVuZGVyVG9vbFJlc3VsdE1lc3NhZ2UsXG4gIHJlbmRlclRvb2xVc2VFcnJvck1lc3NhZ2UsXG4gIHJlbmRlclRvb2xVc2VNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlUHJvZ3Jlc3NNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlUXVldWVkTWVzc2FnZSxcbn0gZnJvbSAnLi9VSS5qcydcbmltcG9ydCB7XG4gIGJ1aWxkSW1hZ2VUb29sUmVzdWx0LFxuICBpc0ltYWdlT3V0cHV0LFxuICByZXNldEN3ZElmT3V0c2lkZVByb2plY3QsXG4gIHJlc2l6ZVNoZWxsSW1hZ2VPdXRwdXQsXG4gIHN0ZEVyckFwcGVuZFNoZWxsUmVzZXRNZXNzYWdlLFxuICBzdHJpcEVtcHR5TGluZXMsXG59IGZyb20gJy4vdXRpbHMuanMnXG5cbmNvbnN0IEVPTCA9ICdcXG4nXG5cbi8vIFByb2dyZXNzIGRpc3BsYXkgY29uc3RhbnRzXG5jb25zdCBQUk9HUkVTU19USFJFU0hPTERfTVMgPSAyMDAwIC8vIFNob3cgcHJvZ3Jlc3MgYWZ0ZXIgMiBzZWNvbmRzXG4vLyBJbiBhc3Npc3RhbnQgbW9kZSwgYmxvY2tpbmcgYmFzaCBhdXRvLWJhY2tncm91bmRzIGFmdGVyIHRoaXMgbWFueSBtcyBpbiB0aGUgbWFpbiBhZ2VudFxuY29uc3QgQVNTSVNUQU5UX0JMT0NLSU5HX0JVREdFVF9NUyA9IDE1XzAwMFxuXG4vLyBTZWFyY2ggY29tbWFuZHMgZm9yIGNvbGxhcHNpYmxlIGRpc3BsYXkgKGdyZXAsIGZpbmQsIGV0Yy4pXG5jb25zdCBCQVNIX1NFQVJDSF9DT01NQU5EUyA9IG5ldyBTZXQoW1xuICAnZmluZCcsXG4gICdncmVwJyxcbiAgJ3JnJyxcbiAgJ2FnJyxcbiAgJ2FjaycsXG4gICdsb2NhdGUnLFxuICAnd2hpY2gnLFxuICAnd2hlcmVpcycsXG5dKVxuXG4vLyBSZWFkL3ZpZXcgY29tbWFuZHMgZm9yIGNvbGxhcHNpYmxlIGRpc3BsYXkgKGNhdCwgaGVhZCwgZXRjLilcbmNvbnN0IEJBU0hfUkVBRF9DT01NQU5EUyA9IG5ldyBTZXQoW1xuICAnY2F0JyxcbiAgJ2hlYWQnLFxuICAndGFpbCcsXG4gICdsZXNzJyxcbiAgJ21vcmUnLFxuICAvLyBBbmFseXNpcyBjb21tYW5kc1xuICAnd2MnLFxuICAnc3RhdCcsXG4gICdmaWxlJyxcbiAgJ3N0cmluZ3MnLFxuICAvLyBEYXRhIHByb2Nlc3Npbmcg4oCUIGNvbW1vbmx5IHVzZWQgdG8gcGFyc2UvdHJhbnNmb3JtIGZpbGUgY29udGVudCBpbiBwaXBlc1xuICAnanEnLFxuICAnYXdrJyxcbiAgJ2N1dCcsXG4gICdzb3J0JyxcbiAgJ3VuaXEnLFxuICAndHInLFxuXSlcblxuLy8gRGlyZWN0b3J5LWxpc3RpbmcgY29tbWFuZHMgZm9yIGNvbGxhcHNpYmxlIGRpc3BsYXkgKGxzLCB0cmVlLCBkdSkuXG4vLyBTcGxpdCBmcm9tIEJBU0hfUkVBRF9DT01NQU5EUyBzbyB0aGUgc3VtbWFyeSBzYXlzIFwiTGlzdGVkIE4gZGlyZWN0b3JpZXNcIlxuLy8gaW5zdGVhZCBvZiB0aGUgbWlzbGVhZGluZyBcIlJlYWQgTiBmaWxlc1wiLlxuY29uc3QgQkFTSF9MSVNUX0NPTU1BTkRTID0gbmV3IFNldChbJ2xzJywgJ3RyZWUnLCAnZHUnXSlcblxuLy8gQ29tbWFuZHMgdGhhdCBhcmUgc2VtYW50aWMtbmV1dHJhbCBpbiBhbnkgcG9zaXRpb24g4oCUIHB1cmUgb3V0cHV0L3N0YXR1cyBjb21tYW5kc1xuLy8gdGhhdCBkb24ndCBjaGFuZ2UgdGhlIHJlYWQvc2VhcmNoIG5hdHVyZSBvZiB0aGUgb3ZlcmFsbCBwaXBlbGluZS5cbi8vIGUuZy4gYGxzIGRpciAmJiBlY2hvIFwiLS0tXCIgJiYgbHMgZGlyMmAgaXMgc3RpbGwgYSByZWFkLW9ubHkgY29tcG91bmQgY29tbWFuZC5cbmNvbnN0IEJBU0hfU0VNQU5USUNfTkVVVFJBTF9DT01NQU5EUyA9IG5ldyBTZXQoW1xuICAnZWNobycsXG4gICdwcmludGYnLFxuICAndHJ1ZScsXG4gICdmYWxzZScsXG4gICc6JywgLy8gYmFzaCBuby1vcFxuXSlcblxuLy8gQ29tbWFuZHMgdGhhdCB0eXBpY2FsbHkgcHJvZHVjZSBubyBzdGRvdXQgb24gc3VjY2Vzc1xuY29uc3QgQkFTSF9TSUxFTlRfQ09NTUFORFMgPSBuZXcgU2V0KFtcbiAgJ212JyxcbiAgJ2NwJyxcbiAgJ3JtJyxcbiAgJ21rZGlyJyxcbiAgJ3JtZGlyJyxcbiAgJ2NobW9kJyxcbiAgJ2Nob3duJyxcbiAgJ2NoZ3JwJyxcbiAgJ3RvdWNoJyxcbiAgJ2xuJyxcbiAgJ2NkJyxcbiAgJ2V4cG9ydCcsXG4gICd1bnNldCcsXG4gICd3YWl0Jyxcbl0pXG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgYmFzaCBjb21tYW5kIGlzIGEgc2VhcmNoIG9yIHJlYWQgb3BlcmF0aW9uLlxuICogVXNlZCB0byBkZXRlcm1pbmUgaWYgdGhlIGNvbW1hbmQgc2hvdWxkIGJlIGNvbGxhcHNlZCBpbiB0aGUgVUkuXG4gKiBSZXR1cm5zIGFuIG9iamVjdCBpbmRpY2F0aW5nIHdoZXRoZXIgaXQncyBhIHNlYXJjaCBvciByZWFkIG9wZXJhdGlvbi5cbiAqXG4gKiBGb3IgcGlwZWxpbmVzIChlLmcuLCBgY2F0IGZpbGUgfCBicWApLCBBTEwgcGFydHMgbXVzdCBiZSBzZWFyY2gvcmVhZCBjb21tYW5kc1xuICogZm9yIHRoZSB3aG9sZSBjb21tYW5kIHRvIGJlIGNvbnNpZGVyZWQgY29sbGFwc2libGUuXG4gKlxuICogU2VtYW50aWMtbmV1dHJhbCBjb21tYW5kcyAoZWNobywgcHJpbnRmLCB0cnVlLCBmYWxzZSwgOikgYXJlIHNraXBwZWQgaW4gYW55XG4gKiBwb3NpdGlvbiwgYXMgdGhleSdyZSBwdXJlIG91dHB1dC9zdGF0dXMgY29tbWFuZHMgdGhhdCBkb24ndCBhZmZlY3QgdGhlIHJlYWQvc2VhcmNoXG4gKiBuYXR1cmUgb2YgdGhlIHBpcGVsaW5lIChlLmcuIGBscyBkaXIgJiYgZWNobyBcIi0tLVwiICYmIGxzIGRpcjJgIGlzIHN0aWxsIGEgcmVhZCkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1NlYXJjaE9yUmVhZEJhc2hDb21tYW5kKGNvbW1hbmQ6IHN0cmluZyk6IHtcbiAgaXNTZWFyY2g6IGJvb2xlYW5cbiAgaXNSZWFkOiBib29sZWFuXG4gIGlzTGlzdDogYm9vbGVhblxufSB7XG4gIGxldCBwYXJ0c1dpdGhPcGVyYXRvcnM6IHN0cmluZ1tdXG4gIHRyeSB7XG4gICAgcGFydHNXaXRoT3BlcmF0b3JzID0gc3BsaXRDb21tYW5kV2l0aE9wZXJhdG9ycyhjb21tYW5kKVxuICB9IGNhdGNoIHtcbiAgICAvLyBJZiB3ZSBjYW4ndCBwYXJzZSB0aGUgY29tbWFuZCBkdWUgdG8gbWFsZm9ybWVkIHN5bnRheCxcbiAgICAvLyBpdCdzIG5vdCBhIHNlYXJjaC9yZWFkIGNvbW1hbmRcbiAgICByZXR1cm4geyBpc1NlYXJjaDogZmFsc2UsIGlzUmVhZDogZmFsc2UsIGlzTGlzdDogZmFsc2UgfVxuICB9XG5cbiAgaWYgKHBhcnRzV2l0aE9wZXJhdG9ycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4geyBpc1NlYXJjaDogZmFsc2UsIGlzUmVhZDogZmFsc2UsIGlzTGlzdDogZmFsc2UgfVxuICB9XG5cbiAgbGV0IGhhc1NlYXJjaCA9IGZhbHNlXG4gIGxldCBoYXNSZWFkID0gZmFsc2VcbiAgbGV0IGhhc0xpc3QgPSBmYWxzZVxuICBsZXQgaGFzTm9uTmV1dHJhbENvbW1hbmQgPSBmYWxzZVxuICBsZXQgc2tpcE5leHRBc1JlZGlyZWN0VGFyZ2V0ID0gZmFsc2VcblxuICBmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHNXaXRoT3BlcmF0b3JzKSB7XG4gICAgaWYgKHNraXBOZXh0QXNSZWRpcmVjdFRhcmdldCkge1xuICAgICAgc2tpcE5leHRBc1JlZGlyZWN0VGFyZ2V0ID0gZmFsc2VcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKHBhcnQgPT09ICc+JyB8fCBwYXJ0ID09PSAnPj4nIHx8IHBhcnQgPT09ICc+JicpIHtcbiAgICAgIHNraXBOZXh0QXNSZWRpcmVjdFRhcmdldCA9IHRydWVcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKHBhcnQgPT09ICd8fCcgfHwgcGFydCA9PT0gJyYmJyB8fCBwYXJ0ID09PSAnfCcgfHwgcGFydCA9PT0gJzsnKSB7XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGNvbnN0IGJhc2VDb21tYW5kID0gcGFydC50cmltKCkuc3BsaXQoL1xccysvKVswXVxuICAgIGlmICghYmFzZUNvbW1hbmQpIHtcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKEJBU0hfU0VNQU5USUNfTkVVVFJBTF9DT01NQU5EUy5oYXMoYmFzZUNvbW1hbmQpKSB7XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGhhc05vbk5ldXRyYWxDb21tYW5kID0gdHJ1ZVxuXG4gICAgY29uc3QgaXNQYXJ0U2VhcmNoID0gQkFTSF9TRUFSQ0hfQ09NTUFORFMuaGFzKGJhc2VDb21tYW5kKVxuICAgIGNvbnN0IGlzUGFydFJlYWQgPSBCQVNIX1JFQURfQ09NTUFORFMuaGFzKGJhc2VDb21tYW5kKVxuICAgIGNvbnN0IGlzUGFydExpc3QgPSBCQVNIX0xJU1RfQ09NTUFORFMuaGFzKGJhc2VDb21tYW5kKVxuXG4gICAgaWYgKCFpc1BhcnRTZWFyY2ggJiYgIWlzUGFydFJlYWQgJiYgIWlzUGFydExpc3QpIHtcbiAgICAgIHJldHVybiB7IGlzU2VhcmNoOiBmYWxzZSwgaXNSZWFkOiBmYWxzZSwgaXNMaXN0OiBmYWxzZSB9XG4gICAgfVxuXG4gICAgaWYgKGlzUGFydFNlYXJjaCkgaGFzU2VhcmNoID0gdHJ1ZVxuICAgIGlmIChpc1BhcnRSZWFkKSBoYXNSZWFkID0gdHJ1ZVxuICAgIGlmIChpc1BhcnRMaXN0KSBoYXNMaXN0ID0gdHJ1ZVxuICB9XG5cbiAgLy8gT25seSBuZXV0cmFsIGNvbW1hbmRzIChlLmcuLCBqdXN0IFwiZWNobyBmb29cIikgLS0gbm90IGNvbGxhcHNpYmxlXG4gIGlmICghaGFzTm9uTmV1dHJhbENvbW1hbmQpIHtcbiAgICByZXR1cm4geyBpc1NlYXJjaDogZmFsc2UsIGlzUmVhZDogZmFsc2UsIGlzTGlzdDogZmFsc2UgfVxuICB9XG5cbiAgcmV0dXJuIHsgaXNTZWFyY2g6IGhhc1NlYXJjaCwgaXNSZWFkOiBoYXNSZWFkLCBpc0xpc3Q6IGhhc0xpc3QgfVxufVxuXG4vKipcbiAqIENoZWNrcyBpZiBhIGJhc2ggY29tbWFuZCBpcyBleHBlY3RlZCB0byBwcm9kdWNlIG5vIHN0ZG91dCBvbiBzdWNjZXNzLlxuICogVXNlZCB0byBzaG93IFwiRG9uZVwiIGluc3RlYWQgb2YgXCIoTm8gb3V0cHV0KVwiIGluIHRoZSBVSS5cbiAqL1xuZnVuY3Rpb24gaXNTaWxlbnRCYXNoQ29tbWFuZChjb21tYW5kOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgbGV0IHBhcnRzV2l0aE9wZXJhdG9yczogc3RyaW5nW11cbiAgdHJ5IHtcbiAgICBwYXJ0c1dpdGhPcGVyYXRvcnMgPSBzcGxpdENvbW1hbmRXaXRoT3BlcmF0b3JzKGNvbW1hbmQpXG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgaWYgKHBhcnRzV2l0aE9wZXJhdG9ycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGxldCBoYXNOb25GYWxsYmFja0NvbW1hbmQgPSBmYWxzZVxuICBsZXQgbGFzdE9wZXJhdG9yOiBzdHJpbmcgfCBudWxsID0gbnVsbFxuICBsZXQgc2tpcE5leHRBc1JlZGlyZWN0VGFyZ2V0ID0gZmFsc2VcblxuICBmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHNXaXRoT3BlcmF0b3JzKSB7XG4gICAgaWYgKHNraXBOZXh0QXNSZWRpcmVjdFRhcmdldCkge1xuICAgICAgc2tpcE5leHRBc1JlZGlyZWN0VGFyZ2V0ID0gZmFsc2VcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKHBhcnQgPT09ICc+JyB8fCBwYXJ0ID09PSAnPj4nIHx8IHBhcnQgPT09ICc+JicpIHtcbiAgICAgIHNraXBOZXh0QXNSZWRpcmVjdFRhcmdldCA9IHRydWVcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKHBhcnQgPT09ICd8fCcgfHwgcGFydCA9PT0gJyYmJyB8fCBwYXJ0ID09PSAnfCcgfHwgcGFydCA9PT0gJzsnKSB7XG4gICAgICBsYXN0T3BlcmF0b3IgPSBwYXJ0XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGNvbnN0IGJhc2VDb21tYW5kID0gcGFydC50cmltKCkuc3BsaXQoL1xccysvKVswXVxuICAgIGlmICghYmFzZUNvbW1hbmQpIHtcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgbGFzdE9wZXJhdG9yID09PSAnfHwnICYmXG4gICAgICBCQVNIX1NFTUFOVElDX05FVVRSQUxfQ09NTUFORFMuaGFzKGJhc2VDb21tYW5kKVxuICAgICkge1xuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBoYXNOb25GYWxsYmFja0NvbW1hbmQgPSB0cnVlXG5cbiAgICBpZiAoIUJBU0hfU0lMRU5UX0NPTU1BTkRTLmhhcyhiYXNlQ29tbWFuZCkpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBoYXNOb25GYWxsYmFja0NvbW1hbmRcbn1cblxuLy8gQ29tbWFuZHMgdGhhdCBzaG91bGQgbm90IGJlIGF1dG8tYmFja2dyb3VuZGVkXG5jb25zdCBESVNBTExPV0VEX0FVVE9fQkFDS0dST1VORF9DT01NQU5EUyA9IFtcbiAgJ3NsZWVwJywgLy8gU2xlZXAgc2hvdWxkIHJ1biBpbiBmb3JlZ3JvdW5kIHVubGVzcyBleHBsaWNpdGx5IGJhY2tncm91bmRlZCBieSB1c2VyXG5dXG5cbi8vIENoZWNrIGlmIGJhY2tncm91bmQgdGFza3MgYXJlIGRpc2FibGVkIGF0IG1vZHVsZSBsb2FkIHRpbWVcbmNvbnN0IGlzQmFja2dyb3VuZFRhc2tzRGlzYWJsZWQgPVxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL25vLXByb2Nlc3MtZW52LXRvcC1sZXZlbCAtLSBJbnRlbnRpb25hbDogc2NoZW1hIG11c3QgYmUgZGVmaW5lZCBhdCBtb2R1bGUgbG9hZFxuICBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9ESVNBQkxFX0JBQ0tHUk9VTkRfVEFTS1MpXG5cbmNvbnN0IGZ1bGxJbnB1dFNjaGVtYSA9IGxhenlTY2hlbWEoKCkgPT5cbiAgei5zdHJpY3RPYmplY3Qoe1xuICAgIGNvbW1hbmQ6IHouc3RyaW5nKCkuZGVzY3JpYmUoJ1RoZSBjb21tYW5kIHRvIGV4ZWN1dGUnKSxcbiAgICB0aW1lb3V0OiBzZW1hbnRpY051bWJlcih6Lm51bWJlcigpLm9wdGlvbmFsKCkpLmRlc2NyaWJlKFxuICAgICAgYE9wdGlvbmFsIHRpbWVvdXQgaW4gbWlsbGlzZWNvbmRzIChtYXggJHtnZXRNYXhUaW1lb3V0TXMoKX0pYCxcbiAgICApLFxuICAgIGRlc2NyaXB0aW9uOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC5vcHRpb25hbCgpXG4gICAgICAuZGVzY3JpYmUoYENsZWFyLCBjb25jaXNlIGRlc2NyaXB0aW9uIG9mIHdoYXQgdGhpcyBjb21tYW5kIGRvZXMgaW4gYWN0aXZlIHZvaWNlLiBOZXZlciB1c2Ugd29yZHMgbGlrZSBcImNvbXBsZXhcIiBvciBcInJpc2tcIiBpbiB0aGUgZGVzY3JpcHRpb24gLSBqdXN0IGRlc2NyaWJlIHdoYXQgaXQgZG9lcy5cblxuRm9yIHNpbXBsZSBjb21tYW5kcyAoZ2l0LCBucG0sIHN0YW5kYXJkIENMSSB0b29scyksIGtlZXAgaXQgYnJpZWYgKDUtMTAgd29yZHMpOlxuLSBscyDihpIgXCJMaXN0IGZpbGVzIGluIGN1cnJlbnQgZGlyZWN0b3J5XCJcbi0gZ2l0IHN0YXR1cyDihpIgXCJTaG93IHdvcmtpbmcgdHJlZSBzdGF0dXNcIlxuLSBucG0gaW5zdGFsbCDihpIgXCJJbnN0YWxsIHBhY2thZ2UgZGVwZW5kZW5jaWVzXCJcblxuRm9yIGNvbW1hbmRzIHRoYXQgYXJlIGhhcmRlciB0byBwYXJzZSBhdCBhIGdsYW5jZSAocGlwZWQgY29tbWFuZHMsIG9ic2N1cmUgZmxhZ3MsIGV0Yy4pLCBhZGQgZW5vdWdoIGNvbnRleHQgdG8gY2xhcmlmeSB3aGF0IGl0IGRvZXM6XG4tIGZpbmQgLiAtbmFtZSBcIioudG1wXCIgLWV4ZWMgcm0ge30gXFxcXDsg4oaSIFwiRmluZCBhbmQgZGVsZXRlIGFsbCAudG1wIGZpbGVzIHJlY3Vyc2l2ZWx5XCJcbi0gZ2l0IHJlc2V0IC0taGFyZCBvcmlnaW4vbWFpbiDihpIgXCJEaXNjYXJkIGFsbCBsb2NhbCBjaGFuZ2VzIGFuZCBtYXRjaCByZW1vdGUgbWFpblwiXG4tIGN1cmwgLXMgdXJsIHwganEgJy5kYXRhW10nIOKGkiBcIkZldGNoIEpTT04gZnJvbSBVUkwgYW5kIGV4dHJhY3QgZGF0YSBhcnJheSBlbGVtZW50c1wiYCksXG4gICAgcnVuX2luX2JhY2tncm91bmQ6IHNlbWFudGljQm9vbGVhbih6LmJvb2xlYW4oKS5vcHRpb25hbCgpKS5kZXNjcmliZShcbiAgICAgIGBTZXQgdG8gdHJ1ZSB0byBydW4gdGhpcyBjb21tYW5kIGluIHRoZSBiYWNrZ3JvdW5kLiBVc2UgUmVhZCB0byByZWFkIHRoZSBvdXRwdXQgbGF0ZXIuYCxcbiAgICApLFxuICAgIGRhbmdlcm91c2x5RGlzYWJsZVNhbmRib3g6IHNlbWFudGljQm9vbGVhbih6LmJvb2xlYW4oKS5vcHRpb25hbCgpKS5kZXNjcmliZShcbiAgICAgICdTZXQgdGhpcyB0byB0cnVlIHRvIGRhbmdlcm91c2x5IG92ZXJyaWRlIHNhbmRib3ggbW9kZSBhbmQgcnVuIGNvbW1hbmRzIHdpdGhvdXQgc2FuZGJveGluZy4nLFxuICAgICksXG4gICAgX3NpbXVsYXRlZFNlZEVkaXQ6IHpcbiAgICAgIC5vYmplY3Qoe1xuICAgICAgICBmaWxlUGF0aDogei5zdHJpbmcoKSxcbiAgICAgICAgbmV3Q29udGVudDogei5zdHJpbmcoKSxcbiAgICAgIH0pXG4gICAgICAub3B0aW9uYWwoKVxuICAgICAgLmRlc2NyaWJlKCdJbnRlcm5hbDogcHJlLWNvbXB1dGVkIHNlZCBlZGl0IHJlc3VsdCBmcm9tIHByZXZpZXcnKSxcbiAgfSksXG4pXG5cbi8vIEFsd2F5cyBvbWl0IF9zaW11bGF0ZWRTZWRFZGl0IGZyb20gdGhlIG1vZGVsLWZhY2luZyBzY2hlbWEuIEl0IGlzIGFuIGludGVybmFsLW9ubHlcbi8vIGZpZWxkIHNldCBieSBTZWRFZGl0UGVybWlzc2lvblJlcXVlc3QgYWZ0ZXIgdGhlIHVzZXIgYXBwcm92ZXMgYSBzZWQgZWRpdCBwcmV2aWV3LlxuLy8gRXhwb3NpbmcgaXQgaW4gdGhlIHNjaGVtYSB3b3VsZCBsZXQgdGhlIG1vZGVsIGJ5cGFzcyBwZXJtaXNzaW9uIGNoZWNrcyBhbmQgdGhlXG4vLyBzYW5kYm94IGJ5IHBhaXJpbmcgYW4gaW5ub2N1b3VzIGNvbW1hbmQgd2l0aCBhbiBhcmJpdHJhcnkgZmlsZSB3cml0ZS5cbi8vIEFsc28gY29uZGl0aW9uYWxseSByZW1vdmUgcnVuX2luX2JhY2tncm91bmQgd2hlbiBiYWNrZ3JvdW5kIHRhc2tzIGFyZSBkaXNhYmxlZC5cbmNvbnN0IGlucHV0U2NoZW1hID0gbGF6eVNjaGVtYSgoKSA9PlxuICBpc0JhY2tncm91bmRUYXNrc0Rpc2FibGVkXG4gICAgPyBmdWxsSW5wdXRTY2hlbWEoKS5vbWl0KHtcbiAgICAgICAgcnVuX2luX2JhY2tncm91bmQ6IHRydWUsXG4gICAgICAgIF9zaW11bGF0ZWRTZWRFZGl0OiB0cnVlLFxuICAgICAgfSlcbiAgICA6IGZ1bGxJbnB1dFNjaGVtYSgpLm9taXQoeyBfc2ltdWxhdGVkU2VkRWRpdDogdHJ1ZSB9KSxcbilcbnR5cGUgSW5wdXRTY2hlbWEgPSBSZXR1cm5UeXBlPHR5cGVvZiBpbnB1dFNjaGVtYT5cblxuLy8gVXNlIGZ1bGxJbnB1dFNjaGVtYSBmb3IgdGhlIHR5cGUgdG8gYWx3YXlzIGluY2x1ZGUgcnVuX2luX2JhY2tncm91bmRcbi8vIChldmVuIHdoZW4gaXQncyBvbWl0dGVkIGZyb20gdGhlIHNjaGVtYSwgdGhlIGNvZGUgbmVlZHMgdG8gaGFuZGxlIGl0KVxuZXhwb3J0IHR5cGUgQmFzaFRvb2xJbnB1dCA9IHouaW5mZXI8UmV0dXJuVHlwZTx0eXBlb2YgZnVsbElucHV0U2NoZW1hPj5cblxuY29uc3QgQ09NTU9OX0JBQ0tHUk9VTkRfQ09NTUFORFMgPSBbXG4gICducG0nLFxuICAneWFybicsXG4gICdwbnBtJyxcbiAgJ25vZGUnLFxuICAncHl0aG9uJyxcbiAgJ3B5dGhvbjMnLFxuICAnZ28nLFxuICAnY2FyZ28nLFxuICAnbWFrZScsXG4gICdkb2NrZXInLFxuICAndGVycmFmb3JtJyxcbiAgJ3dlYnBhY2snLFxuICAndml0ZScsXG4gICdqZXN0JyxcbiAgJ3B5dGVzdCcsXG4gICdjdXJsJyxcbiAgJ3dnZXQnLFxuICAnYnVpbGQnLFxuICAndGVzdCcsXG4gICdzZXJ2ZScsXG4gICd3YXRjaCcsXG4gICdkZXYnLFxuXSBhcyBjb25zdFxuXG5mdW5jdGlvbiBnZXRDb21tYW5kVHlwZUZvckxvZ2dpbmcoXG4gIGNvbW1hbmQ6IHN0cmluZyxcbik6IEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMge1xuICBjb25zdCBwYXJ0cyA9IHNwbGl0Q29tbWFuZF9ERVBSRUNBVEVEKGNvbW1hbmQpXG4gIGlmIChwYXJ0cy5sZW5ndGggPT09IDApXG4gICAgcmV0dXJuICdvdGhlcicgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIU1xuXG4gIC8vIENoZWNrIGVhY2ggcGFydCBvZiB0aGUgY29tbWFuZCB0byBzZWUgaWYgYW55IG1hdGNoIGNvbW1vbiBiYWNrZ3JvdW5kIGNvbW1hbmRzXG4gIGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuICAgIGNvbnN0IGJhc2VDb21tYW5kID0gcGFydC5zcGxpdCgnICcpWzBdIHx8ICcnXG4gICAgaWYgKFxuICAgICAgQ09NTU9OX0JBQ0tHUk9VTkRfQ09NTUFORFMuaW5jbHVkZXMoXG4gICAgICAgIGJhc2VDb21tYW5kIGFzICh0eXBlb2YgQ09NTU9OX0JBQ0tHUk9VTkRfQ09NTUFORFMpW251bWJlcl0sXG4gICAgICApXG4gICAgKSB7XG4gICAgICByZXR1cm4gYmFzZUNvbW1hbmQgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIU1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiAnb3RoZXInIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFNcbn1cblxuY29uc3Qgb3V0cHV0U2NoZW1hID0gbGF6eVNjaGVtYSgoKSA9PlxuICB6Lm9iamVjdCh7XG4gICAgc3Rkb3V0OiB6LnN0cmluZygpLmRlc2NyaWJlKCdUaGUgc3RhbmRhcmQgb3V0cHV0IG9mIHRoZSBjb21tYW5kJyksXG4gICAgc3RkZXJyOiB6LnN0cmluZygpLmRlc2NyaWJlKCdUaGUgc3RhbmRhcmQgZXJyb3Igb3V0cHV0IG9mIHRoZSBjb21tYW5kJyksXG4gICAgcmF3T3V0cHV0UGF0aDogelxuICAgICAgLnN0cmluZygpXG4gICAgICAub3B0aW9uYWwoKVxuICAgICAgLmRlc2NyaWJlKCdQYXRoIHRvIHJhdyBvdXRwdXQgZmlsZSBmb3IgbGFyZ2UgTUNQIHRvb2wgb3V0cHV0cycpLFxuICAgIGludGVycnVwdGVkOiB6LmJvb2xlYW4oKS5kZXNjcmliZSgnV2hldGhlciB0aGUgY29tbWFuZCB3YXMgaW50ZXJydXB0ZWQnKSxcbiAgICBpc0ltYWdlOiB6XG4gICAgICAuYm9vbGVhbigpXG4gICAgICAub3B0aW9uYWwoKVxuICAgICAgLmRlc2NyaWJlKCdGbGFnIHRvIGluZGljYXRlIGlmIHN0ZG91dCBjb250YWlucyBpbWFnZSBkYXRhJyksXG4gICAgYmFja2dyb3VuZFRhc2tJZDogelxuICAgICAgLnN0cmluZygpXG4gICAgICAub3B0aW9uYWwoKVxuICAgICAgLmRlc2NyaWJlKFxuICAgICAgICAnSUQgb2YgdGhlIGJhY2tncm91bmQgdGFzayBpZiBjb21tYW5kIGlzIHJ1bm5pbmcgaW4gYmFja2dyb3VuZCcsXG4gICAgICApLFxuICAgIGJhY2tncm91bmRlZEJ5VXNlcjogelxuICAgICAgLmJvb2xlYW4oKVxuICAgICAgLm9wdGlvbmFsKClcbiAgICAgIC5kZXNjcmliZShcbiAgICAgICAgJ1RydWUgaWYgdGhlIHVzZXIgbWFudWFsbHkgYmFja2dyb3VuZGVkIHRoZSBjb21tYW5kIHdpdGggQ3RybCtCJyxcbiAgICAgICksXG4gICAgYXNzaXN0YW50QXV0b0JhY2tncm91bmRlZDogelxuICAgICAgLmJvb2xlYW4oKVxuICAgICAgLm9wdGlvbmFsKClcbiAgICAgIC5kZXNjcmliZShcbiAgICAgICAgJ1RydWUgaWYgYXNzaXN0YW50LW1vZGUgYXV0by1iYWNrZ3JvdW5kZWQgYSBsb25nLXJ1bm5pbmcgYmxvY2tpbmcgY29tbWFuZCcsXG4gICAgICApLFxuICAgIGRhbmdlcm91c2x5RGlzYWJsZVNhbmRib3g6IHpcbiAgICAgIC5ib29sZWFuKClcbiAgICAgIC5vcHRpb25hbCgpXG4gICAgICAuZGVzY3JpYmUoJ0ZsYWcgdG8gaW5kaWNhdGUgaWYgc2FuZGJveCBtb2RlIHdhcyBvdmVycmlkZGVuJyksXG4gICAgcmV0dXJuQ29kZUludGVycHJldGF0aW9uOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC5vcHRpb25hbCgpXG4gICAgICAuZGVzY3JpYmUoXG4gICAgICAgICdTZW1hbnRpYyBpbnRlcnByZXRhdGlvbiBmb3Igbm9uLWVycm9yIGV4aXQgY29kZXMgd2l0aCBzcGVjaWFsIG1lYW5pbmcnLFxuICAgICAgKSxcbiAgICBub091dHB1dEV4cGVjdGVkOiB6XG4gICAgICAuYm9vbGVhbigpXG4gICAgICAub3B0aW9uYWwoKVxuICAgICAgLmRlc2NyaWJlKFxuICAgICAgICAnV2hldGhlciB0aGUgY29tbWFuZCBpcyBleHBlY3RlZCB0byBwcm9kdWNlIG5vIG91dHB1dCBvbiBzdWNjZXNzJyxcbiAgICAgICksXG4gICAgc3RydWN0dXJlZENvbnRlbnQ6IHpcbiAgICAgIC5hcnJheSh6LmFueSgpKVxuICAgICAgLm9wdGlvbmFsKClcbiAgICAgIC5kZXNjcmliZSgnU3RydWN0dXJlZCBjb250ZW50IGJsb2NrcycpLFxuICAgIHBlcnNpc3RlZE91dHB1dFBhdGg6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLm9wdGlvbmFsKClcbiAgICAgIC5kZXNjcmliZShcbiAgICAgICAgJ1BhdGggdG8gdGhlIHBlcnNpc3RlZCBmdWxsIG91dHB1dCBpbiB0b29sLXJlc3VsdHMgZGlyIChzZXQgd2hlbiBvdXRwdXQgaXMgdG9vIGxhcmdlIGZvciBpbmxpbmUpJyxcbiAgICAgICksXG4gICAgcGVyc2lzdGVkT3V0cHV0U2l6ZTogelxuICAgICAgLm51bWJlcigpXG4gICAgICAub3B0aW9uYWwoKVxuICAgICAgLmRlc2NyaWJlKFxuICAgICAgICAnVG90YWwgc2l6ZSBvZiB0aGUgb3V0cHV0IGluIGJ5dGVzIChzZXQgd2hlbiBvdXRwdXQgaXMgdG9vIGxhcmdlIGZvciBpbmxpbmUpJyxcbiAgICAgICksXG4gIH0pLFxuKVxuXG50eXBlIE91dHB1dFNjaGVtYSA9IFJldHVyblR5cGU8dHlwZW9mIG91dHB1dFNjaGVtYT5cbmV4cG9ydCB0eXBlIE91dCA9IHouaW5mZXI8T3V0cHV0U2NoZW1hPlxuXG4vLyBSZS1leHBvcnQgQmFzaFByb2dyZXNzIGZyb20gY2VudHJhbGl6ZWQgdHlwZXMgdG8gYnJlYWsgaW1wb3J0IGN5Y2xlc1xuZXhwb3J0IHR5cGUgeyBCYXNoUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi90eXBlcy90b29scy5qcydcblxuaW1wb3J0IHR5cGUgeyBCYXNoUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi90eXBlcy90b29scy5qcydcblxuLyoqXG4gKiBDaGVja3MgaWYgYSBjb21tYW5kIGlzIGFsbG93ZWQgdG8gYmUgYXV0b21hdGljYWxseSBiYWNrZ3JvdW5kZWRcbiAqIEBwYXJhbSBjb21tYW5kIFRoZSBjb21tYW5kIHRvIGNoZWNrXG4gKiBAcmV0dXJucyBmYWxzZSBmb3IgY29tbWFuZHMgdGhhdCBzaG91bGQgbm90IGJlIGF1dG8tYmFja2dyb3VuZGVkIChsaWtlIHNsZWVwKVxuICovXG5mdW5jdGlvbiBpc0F1dG9iYWNrZ3JvdW5kaW5nQWxsb3dlZChjb21tYW5kOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgcGFydHMgPSBzcGxpdENvbW1hbmRfREVQUkVDQVRFRChjb21tYW5kKVxuICBpZiAocGFydHMubGVuZ3RoID09PSAwKSByZXR1cm4gdHJ1ZVxuXG4gIC8vIEdldCB0aGUgZmlyc3QgcGFydCB3aGljaCBzaG91bGQgYmUgdGhlIGJhc2UgY29tbWFuZFxuICBjb25zdCBiYXNlQ29tbWFuZCA9IHBhcnRzWzBdPy50cmltKClcbiAgaWYgKCFiYXNlQ29tbWFuZCkgcmV0dXJuIHRydWVcblxuICByZXR1cm4gIURJU0FMTE9XRURfQVVUT19CQUNLR1JPVU5EX0NPTU1BTkRTLmluY2x1ZGVzKGJhc2VDb21tYW5kKVxufVxuXG4vKipcbiAqIERldGVjdCBzdGFuZGFsb25lIG9yIGxlYWRpbmcgYHNsZWVwIE5gIHBhdHRlcm5zIHRoYXQgc2hvdWxkIHVzZSBNb25pdG9yXG4gKiBpbnN0ZWFkLiBDYXRjaGVzIGBzbGVlcCA1YCwgYHNsZWVwIDUgJiYgY2hlY2tgLCBgc2xlZXAgNTsgY2hlY2tgIOKAlCBidXRcbiAqIG5vdCBzbGVlcCBpbnNpZGUgcGlwZWxpbmVzLCBzdWJzaGVsbHMsIG9yIHNjcmlwdHMgKHRob3NlIGFyZSBmaW5lKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRldGVjdEJsb2NrZWRTbGVlcFBhdHRlcm4oY29tbWFuZDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IHBhcnRzID0gc3BsaXRDb21tYW5kX0RFUFJFQ0FURUQoY29tbWFuZClcbiAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGxcblxuICBjb25zdCBmaXJzdCA9IHBhcnRzWzBdPy50cmltKCkgPz8gJydcbiAgLy8gQmFyZSBgc2xlZXAgTmAgb3IgYHNsZWVwIE4uTmAgYXMgdGhlIGZpcnN0IHN1YmNvbW1hbmQuXG4gIC8vIEZsb2F0IGR1cmF0aW9ucyAoc2xlZXAgMC41KSBhcmUgYWxsb3dlZCDigJQgdGhvc2UgYXJlIGxlZ2l0IHBhY2luZywgbm90IHBvbGxzLlxuICBjb25zdCBtID0gL15zbGVlcFxccysoXFxkKylcXHMqJC8uZXhlYyhmaXJzdClcbiAgaWYgKCFtKSByZXR1cm4gbnVsbFxuICBjb25zdCBzZWNzID0gcGFyc2VJbnQobVsxXSEsIDEwKVxuICBpZiAoc2VjcyA8IDIpIHJldHVybiBudWxsIC8vIHN1Yi0ycyBzbGVlcHMgYXJlIGZpbmUgKHJhdGUgbGltaXRpbmcsIHBhY2luZylcblxuICAvLyBgc2xlZXAgTmAgYWxvbmUg4oaSIFwid2hhdCBhcmUgeW91IHdhaXRpbmcgZm9yP1wiXG4gIC8vIGBzbGVlcCBOICYmIGNoZWNrYCDihpIgXCJ1c2UgTW9uaXRvciB7IGNvbW1hbmQ6IGNoZWNrIH1cIlxuICBjb25zdCByZXN0ID0gcGFydHMuc2xpY2UoMSkuam9pbignICcpLnRyaW0oKVxuICByZXR1cm4gcmVzdFxuICAgID8gYHNsZWVwICR7c2Vjc30gZm9sbG93ZWQgYnk6ICR7cmVzdH1gXG4gICAgOiBgc3RhbmRhbG9uZSBzbGVlcCAke3NlY3N9YFxufVxuXG4vKipcbiAqIENoZWNrcyBpZiBhIGNvbW1hbmQgY29udGFpbnMgdG9vbHMgdGhhdCBzaG91bGRuJ3QgcnVuIGluIHNhbmRib3hcbiAqIFRoaXMgaW5jbHVkZXM6XG4gKiAtIER5bmFtaWMgY29uZmlnLWJhc2VkIGRpc2FibGVkIGNvbW1hbmRzIGFuZCBzdWJzdHJpbmdzICh0ZW5ndV9zYW5kYm94X2Rpc2FibGVkX2NvbW1hbmRzKVxuICogLSBVc2VyLWNvbmZpZ3VyZWQgY29tbWFuZHMgZnJvbSBzZXR0aW5ncy5qc29uIChzYW5kYm94LmV4Y2x1ZGVkQ29tbWFuZHMpXG4gKlxuICogVXNlci1jb25maWd1cmVkIGNvbW1hbmRzIHN1cHBvcnQgdGhlIHNhbWUgcGF0dGVybiBzeW50YXggYXMgcGVybWlzc2lvbiBydWxlczpcbiAqIC0gRXhhY3QgbWF0Y2hlczogXCJucG0gcnVuIGxpbnRcIlxuICogLSBQcmVmaXggcGF0dGVybnM6IFwibnBtIHJ1biB0ZXN0OipcIlxuICovXG5cbnR5cGUgU2ltdWxhdGVkU2VkRWRpdFJlc3VsdCA9IHtcbiAgZGF0YTogT3V0XG59XG5cbnR5cGUgU2ltdWxhdGVkU2VkRWRpdENvbnRleHQgPSBQaWNrPFxuICBUb29sVXNlQ29udGV4dCxcbiAgJ3JlYWRGaWxlU3RhdGUnIHwgJ3VwZGF0ZUZpbGVIaXN0b3J5U3RhdGUnXG4+XG5cbi8qKlxuICogQXBwbGllcyBhIHNpbXVsYXRlZCBzZWQgZWRpdCBkaXJlY3RseSBpbnN0ZWFkIG9mIHJ1bm5pbmcgc2VkLlxuICogVGhpcyBpcyB1c2VkIGJ5IHRoZSBwZXJtaXNzaW9uIGRpYWxvZyB0byBlbnN1cmUgd2hhdCB0aGUgdXNlciBwcmV2aWV3c1xuICogaXMgZXhhY3RseSB3aGF0IGdldHMgd3JpdHRlbiB0byB0aGUgZmlsZS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gYXBwbHlTZWRFZGl0KFxuICBzaW11bGF0ZWRFZGl0OiB7IGZpbGVQYXRoOiBzdHJpbmc7IG5ld0NvbnRlbnQ6IHN0cmluZyB9LFxuICB0b29sVXNlQ29udGV4dDogU2ltdWxhdGVkU2VkRWRpdENvbnRleHQsXG4gIHBhcmVudE1lc3NhZ2U/OiBBc3Npc3RhbnRNZXNzYWdlLFxuKTogUHJvbWlzZTxTaW11bGF0ZWRTZWRFZGl0UmVzdWx0PiB7XG4gIGNvbnN0IHsgZmlsZVBhdGgsIG5ld0NvbnRlbnQgfSA9IHNpbXVsYXRlZEVkaXRcbiAgY29uc3QgYWJzb2x1dGVGaWxlUGF0aCA9IGV4cGFuZFBhdGgoZmlsZVBhdGgpXG4gIGNvbnN0IGZzID0gZ2V0RnNJbXBsZW1lbnRhdGlvbigpXG5cbiAgLy8gUmVhZCBvcmlnaW5hbCBjb250ZW50IGZvciBWUyBDb2RlIG5vdGlmaWNhdGlvblxuICBjb25zdCBlbmNvZGluZyA9IGRldGVjdEZpbGVFbmNvZGluZyhhYnNvbHV0ZUZpbGVQYXRoKVxuICBsZXQgb3JpZ2luYWxDb250ZW50OiBzdHJpbmdcbiAgdHJ5IHtcbiAgICBvcmlnaW5hbENvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShhYnNvbHV0ZUZpbGVQYXRoLCB7IGVuY29kaW5nIH0pXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoaXNFTk9FTlQoZSkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBzdGRvdXQ6ICcnLFxuICAgICAgICAgIHN0ZGVycjogYHNlZDogJHtmaWxlUGF0aH06IE5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnlcXG5FeGl0IGNvZGUgMWAsXG4gICAgICAgICAgaW50ZXJydXB0ZWQ6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBlXG4gIH1cblxuICAvLyBUcmFjayBmaWxlIGhpc3RvcnkgYmVmb3JlIG1ha2luZyBjaGFuZ2VzIChmb3IgdW5kbyBzdXBwb3J0KVxuICBpZiAoZmlsZUhpc3RvcnlFbmFibGVkKCkgJiYgcGFyZW50TWVzc2FnZSkge1xuICAgIGF3YWl0IGZpbGVIaXN0b3J5VHJhY2tFZGl0KFxuICAgICAgdG9vbFVzZUNvbnRleHQudXBkYXRlRmlsZUhpc3RvcnlTdGF0ZSxcbiAgICAgIGFic29sdXRlRmlsZVBhdGgsXG4gICAgICBwYXJlbnRNZXNzYWdlLnV1aWQsXG4gICAgKVxuICB9XG5cbiAgLy8gRGV0ZWN0IGxpbmUgZW5kaW5ncyBhbmQgd3JpdGUgbmV3IGNvbnRlbnRcbiAgY29uc3QgZW5kaW5ncyA9IGRldGVjdExpbmVFbmRpbmdzKGFic29sdXRlRmlsZVBhdGgpXG4gIHdyaXRlVGV4dENvbnRlbnQoYWJzb2x1dGVGaWxlUGF0aCwgbmV3Q29udGVudCwgZW5jb2RpbmcsIGVuZGluZ3MpXG5cbiAgLy8gTm90aWZ5IFZTIENvZGUgYWJvdXQgdGhlIGZpbGUgY2hhbmdlXG4gIG5vdGlmeVZzY29kZUZpbGVVcGRhdGVkKGFic29sdXRlRmlsZVBhdGgsIG9yaWdpbmFsQ29udGVudCwgbmV3Q29udGVudClcblxuICAvLyBVcGRhdGUgcmVhZCB0aW1lc3RhbXAgdG8gaW52YWxpZGF0ZSBzdGFsZSB3cml0ZXNcbiAgdG9vbFVzZUNvbnRleHQucmVhZEZpbGVTdGF0ZS5zZXQoYWJzb2x1dGVGaWxlUGF0aCwge1xuICAgIGNvbnRlbnQ6IG5ld0NvbnRlbnQsXG4gICAgdGltZXN0YW1wOiBnZXRGaWxlTW9kaWZpY2F0aW9uVGltZShhYnNvbHV0ZUZpbGVQYXRoKSxcbiAgICBvZmZzZXQ6IHVuZGVmaW5lZCxcbiAgICBsaW1pdDogdW5kZWZpbmVkLFxuICB9KVxuXG4gIC8vIFJldHVybiBzdWNjZXNzIHJlc3VsdCBtYXRjaGluZyBzZWQgb3V0cHV0IGZvcm1hdCAoc2VkIHByb2R1Y2VzIG5vIG91dHB1dCBvbiBzdWNjZXNzKVxuICByZXR1cm4ge1xuICAgIGRhdGE6IHtcbiAgICAgIHN0ZG91dDogJycsXG4gICAgICBzdGRlcnI6ICcnLFxuICAgICAgaW50ZXJydXB0ZWQ6IGZhbHNlLFxuICAgIH0sXG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IEJhc2hUb29sID0gYnVpbGRUb29sKHtcbiAgbmFtZTogQkFTSF9UT09MX05BTUUsXG4gIHNlYXJjaEhpbnQ6ICdleGVjdXRlIHNoZWxsIGNvbW1hbmRzJyxcbiAgLy8gMzBLIGNoYXJzIC0gdG9vbCByZXN1bHQgcGVyc2lzdGVuY2UgdGhyZXNob2xkXG4gIG1heFJlc3VsdFNpemVDaGFyczogMzBfMDAwLFxuICBzdHJpY3Q6IHRydWUsXG4gIGFzeW5jIGRlc2NyaXB0aW9uKHsgZGVzY3JpcHRpb24gfSkge1xuICAgIHJldHVybiBkZXNjcmlwdGlvbiB8fCAnUnVuIHNoZWxsIGNvbW1hbmQnXG4gIH0sXG4gIGFzeW5jIHByb21wdCgpIHtcbiAgICByZXR1cm4gZ2V0U2ltcGxlUHJvbXB0KClcbiAgfSxcbiAgaXNDb25jdXJyZW5jeVNhZmUoaW5wdXQpIHtcbiAgICByZXR1cm4gdGhpcy5pc1JlYWRPbmx5Py4oaW5wdXQpID8/IGZhbHNlXG4gIH0sXG4gIGlzUmVhZE9ubHkoaW5wdXQpIHtcbiAgICBjb25zdCBjb21wb3VuZENvbW1hbmRIYXNDZCA9IGNvbW1hbmRIYXNBbnlDZChpbnB1dC5jb21tYW5kKVxuICAgIGNvbnN0IHJlc3VsdCA9IGNoZWNrUmVhZE9ubHlDb25zdHJhaW50cyhpbnB1dCwgY29tcG91bmRDb21tYW5kSGFzQ2QpXG4gICAgcmV0dXJuIHJlc3VsdC5iZWhhdmlvciA9PT0gJ2FsbG93J1xuICB9LFxuICB0b0F1dG9DbGFzc2lmaWVySW5wdXQoaW5wdXQpIHtcbiAgICByZXR1cm4gaW5wdXQuY29tbWFuZFxuICB9LFxuICBhc3luYyBwcmVwYXJlUGVybWlzc2lvbk1hdGNoZXIoeyBjb21tYW5kIH0pIHtcbiAgICAvLyBIb29rIGBpZmAgZmlsdGVyaW5nIGlzIFwibm8gbWF0Y2gg4oaSIHNraXAgaG9va1wiIChkZW55LWxpa2Ugc2VtYW50aWNzKSwgc29cbiAgICAvLyBjb21wb3VuZCBjb21tYW5kcyBtdXN0IGZpcmUgdGhlIGhvb2sgaWYgQU5ZIHN1YmNvbW1hbmQgbWF0Y2hlcy4gV2l0aG91dFxuICAgIC8vIHNwbGl0dGluZywgYGxzICYmIGdpdCBwdXNoYCB3b3VsZCBieXBhc3MgYSBgQmFzaChnaXQgKilgIHNlY3VyaXR5IGhvb2suXG4gICAgY29uc3QgcGFyc2VkID0gYXdhaXQgcGFyc2VGb3JTZWN1cml0eShjb21tYW5kKVxuICAgIGlmIChwYXJzZWQua2luZCAhPT0gJ3NpbXBsZScpIHtcbiAgICAgIC8vIHBhcnNlLXVuYXZhaWxhYmxlIC8gdG9vLWNvbXBsZXg6IGZhaWwgc2FmZSBieSBydW5uaW5nIHRoZSBob29rLlxuICAgICAgcmV0dXJuICgpID0+IHRydWVcbiAgICB9XG4gICAgLy8gTWF0Y2ggb24gYXJndiAoc3RyaXBzIGxlYWRpbmcgVkFSPXZhbCkgc28gYEZPTz1iYXIgZ2l0IHB1c2hgIHN0aWxsXG4gICAgLy8gbWF0Y2hlcyBgQmFzaChnaXQgKilgLlxuICAgIGNvbnN0IHN1YmNvbW1hbmRzID0gcGFyc2VkLmNvbW1hbmRzLm1hcChjID0+IGMuYXJndi5qb2luKCcgJykpXG4gICAgcmV0dXJuIHBhdHRlcm4gPT4ge1xuICAgICAgY29uc3QgcHJlZml4ID0gcGVybWlzc2lvblJ1bGVFeHRyYWN0UHJlZml4KHBhdHRlcm4pXG4gICAgICByZXR1cm4gc3ViY29tbWFuZHMuc29tZShjbWQgPT4ge1xuICAgICAgICBpZiAocHJlZml4ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIGNtZCA9PT0gcHJlZml4IHx8IGNtZC5zdGFydHNXaXRoKGAke3ByZWZpeH0gYClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF0Y2hXaWxkY2FyZFBhdHRlcm4ocGF0dGVybiwgY21kKVxuICAgICAgfSlcbiAgICB9XG4gIH0sXG4gIGlzU2VhcmNoT3JSZWFkQ29tbWFuZChpbnB1dCkge1xuICAgIGNvbnN0IHBhcnNlZCA9IGlucHV0U2NoZW1hKCkuc2FmZVBhcnNlKGlucHV0KVxuICAgIGlmICghcGFyc2VkLnN1Y2Nlc3MpXG4gICAgICByZXR1cm4geyBpc1NlYXJjaDogZmFsc2UsIGlzUmVhZDogZmFsc2UsIGlzTGlzdDogZmFsc2UgfVxuICAgIHJldHVybiBpc1NlYXJjaE9yUmVhZEJhc2hDb21tYW5kKHBhcnNlZC5kYXRhLmNvbW1hbmQpXG4gIH0sXG4gIGdldCBpbnB1dFNjaGVtYSgpOiBJbnB1dFNjaGVtYSB7XG4gICAgcmV0dXJuIGlucHV0U2NoZW1hKClcbiAgfSxcbiAgZ2V0IG91dHB1dFNjaGVtYSgpOiBPdXRwdXRTY2hlbWEge1xuICAgIHJldHVybiBvdXRwdXRTY2hlbWEoKVxuICB9LFxuICB1c2VyRmFjaW5nTmFtZShpbnB1dCkge1xuICAgIGlmICghaW5wdXQpIHtcbiAgICAgIHJldHVybiAnQmFzaCdcbiAgICB9XG4gICAgLy8gUmVuZGVyIHNlZCBpbi1wbGFjZSBlZGl0cyBhcyBmaWxlIGVkaXRzXG4gICAgaWYgKGlucHV0LmNvbW1hbmQpIHtcbiAgICAgIGNvbnN0IHNlZEluZm8gPSBwYXJzZVNlZEVkaXRDb21tYW5kKGlucHV0LmNvbW1hbmQpXG4gICAgICBpZiAoc2VkSW5mbykge1xuICAgICAgICByZXR1cm4gZmlsZUVkaXRVc2VyRmFjaW5nTmFtZSh7XG4gICAgICAgICAgZmlsZV9wYXRoOiBzZWRJbmZvLmZpbGVQYXRoLFxuICAgICAgICAgIG9sZF9zdHJpbmc6ICd4JyxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRW52IHZhciBGSVJTVDogc2hvdWxkVXNlU2FuZGJveCDihpIgc3BsaXRDb21tYW5kX0RFUFJFQ0FURUQg4oaSIHNoZWxsLXF1b3RlJ3NcbiAgICAvLyBgbmV3IFJlZ0V4cGAgcGVyIGNhbGwuIHVzZXJGYWNpbmdOYW1lIHJ1bnMgcGVyLXJlbmRlciBmb3IgZXZlcnkgYmFzaFxuICAgIC8vIG1lc3NhZ2UgaW4gaGlzdG9yeTsgd2l0aCB+NTAgbXNncyArIG9uZSBzbG93LXRvLXRva2VuaXplIGNvbW1hbmQsIHRoaXNcbiAgICAvLyBleGNlZWRzIHRoZSBzaGltbWVyIHRpY2sg4oaSIHRyYW5zaXRpb24gYWJvcnQg4oaSIGluZmluaXRlIHJldHJ5ICgjMjE2MDUpLlxuICAgIHJldHVybiBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9CQVNIX1NBTkRCT1hfU0hPV19JTkRJQ0FUT1IpICYmXG4gICAgICBzaG91bGRVc2VTYW5kYm94KGlucHV0KVxuICAgICAgPyAnU2FuZGJveGVkQmFzaCdcbiAgICAgIDogJ0Jhc2gnXG4gIH0sXG4gIGdldFRvb2xVc2VTdW1tYXJ5KGlucHV0KSB7XG4gICAgaWYgKCFpbnB1dD8uY29tbWFuZCkge1xuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgY29uc3QgeyBjb21tYW5kLCBkZXNjcmlwdGlvbiB9ID0gaW5wdXRcbiAgICBpZiAoZGVzY3JpcHRpb24pIHtcbiAgICAgIHJldHVybiBkZXNjcmlwdGlvblxuICAgIH1cbiAgICByZXR1cm4gdHJ1bmNhdGUoY29tbWFuZCwgVE9PTF9TVU1NQVJZX01BWF9MRU5HVEgpXG4gIH0sXG4gIGdldEFjdGl2aXR5RGVzY3JpcHRpb24oaW5wdXQpIHtcbiAgICBpZiAoIWlucHV0Py5jb21tYW5kKSB7XG4gICAgICByZXR1cm4gJ1J1bm5pbmcgY29tbWFuZCdcbiAgICB9XG4gICAgY29uc3QgZGVzYyA9XG4gICAgICBpbnB1dC5kZXNjcmlwdGlvbiA/PyB0cnVuY2F0ZShpbnB1dC5jb21tYW5kLCBUT09MX1NVTU1BUllfTUFYX0xFTkdUSClcbiAgICByZXR1cm4gYFJ1bm5pbmcgJHtkZXNjfWBcbiAgfSxcbiAgYXN5bmMgdmFsaWRhdGVJbnB1dChpbnB1dDogQmFzaFRvb2xJbnB1dCk6IFByb21pc2U8VmFsaWRhdGlvblJlc3VsdD4ge1xuICAgIGlmIChcbiAgICAgIGZlYXR1cmUoJ01PTklUT1JfVE9PTCcpICYmXG4gICAgICAhaXNCYWNrZ3JvdW5kVGFza3NEaXNhYmxlZCAmJlxuICAgICAgIWlucHV0LnJ1bl9pbl9iYWNrZ3JvdW5kXG4gICAgKSB7XG4gICAgICBjb25zdCBzbGVlcFBhdHRlcm4gPSBkZXRlY3RCbG9ja2VkU2xlZXBQYXR0ZXJuKGlucHV0LmNvbW1hbmQpXG4gICAgICBpZiAoc2xlZXBQYXR0ZXJuICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcmVzdWx0OiBmYWxzZSxcbiAgICAgICAgICBtZXNzYWdlOiBgQmxvY2tlZDogJHtzbGVlcFBhdHRlcm59LiBSdW4gYmxvY2tpbmcgY29tbWFuZHMgaW4gdGhlIGJhY2tncm91bmQgd2l0aCBydW5faW5fYmFja2dyb3VuZDogdHJ1ZSDigJQgeW91J2xsIGdldCBhIGNvbXBsZXRpb24gbm90aWZpY2F0aW9uIHdoZW4gZG9uZS4gRm9yIHN0cmVhbWluZyBldmVudHMgKHdhdGNoaW5nIGxvZ3MsIHBvbGxpbmcgQVBJcyksIHVzZSB0aGUgTW9uaXRvciB0b29sLiBJZiB5b3UgZ2VudWluZWx5IG5lZWQgYSBkZWxheSAocmF0ZSBsaW1pdGluZywgZGVsaWJlcmF0ZSBwYWNpbmcpLCBrZWVwIGl0IHVuZGVyIDIgc2Vjb25kcy5gLFxuICAgICAgICAgIGVycm9yQ29kZTogMTAsXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgcmVzdWx0OiB0cnVlIH1cbiAgfSxcbiAgYXN5bmMgY2hlY2tQZXJtaXNzaW9ucyhpbnB1dCwgY29udGV4dCk6IFByb21pc2U8UGVybWlzc2lvblJlc3VsdD4ge1xuICAgIHJldHVybiBiYXNoVG9vbEhhc1Blcm1pc3Npb24oaW5wdXQsIGNvbnRleHQpXG4gIH0sXG4gIHJlbmRlclRvb2xVc2VNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlUHJvZ3Jlc3NNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlUXVldWVkTWVzc2FnZSxcbiAgcmVuZGVyVG9vbFJlc3VsdE1lc3NhZ2UsXG4gIC8vIEJhc2hUb29sUmVzdWx0TWVzc2FnZSBzaG93cyA8T3V0cHV0TGluZSBjb250ZW50PXtzdGRvdXR9PiArIHN0ZGVyci5cbiAgLy8gVUkgbmV2ZXIgc2hvd3MgcGVyc2lzdGVkT3V0cHV0UGF0aCB3cmFwcGVyLCBiYWNrZ3JvdW5kSW5mbyDigJQgdGhvc2UgYXJlXG4gIC8vIG1vZGVsLWZhY2luZyAobWFwVG9vbFJlc3VsdC4uLiBiZWxvdykuXG4gIGV4dHJhY3RTZWFyY2hUZXh0KHsgc3Rkb3V0LCBzdGRlcnIgfSkge1xuICAgIHJldHVybiBzdGRlcnIgPyBgJHtzdGRvdXR9XFxuJHtzdGRlcnJ9YCA6IHN0ZG91dFxuICB9LFxuICBtYXBUb29sUmVzdWx0VG9Ub29sUmVzdWx0QmxvY2tQYXJhbShcbiAgICB7XG4gICAgICBpbnRlcnJ1cHRlZCxcbiAgICAgIHN0ZG91dCxcbiAgICAgIHN0ZGVycixcbiAgICAgIGlzSW1hZ2UsXG4gICAgICBiYWNrZ3JvdW5kVGFza0lkLFxuICAgICAgYmFja2dyb3VuZGVkQnlVc2VyLFxuICAgICAgYXNzaXN0YW50QXV0b0JhY2tncm91bmRlZCxcbiAgICAgIHN0cnVjdHVyZWRDb250ZW50LFxuICAgICAgcGVyc2lzdGVkT3V0cHV0UGF0aCxcbiAgICAgIHBlcnNpc3RlZE91dHB1dFNpemUsXG4gICAgfSxcbiAgICB0b29sVXNlSUQsXG4gICk6IFRvb2xSZXN1bHRCbG9ja1BhcmFtIHtcbiAgICAvLyBIYW5kbGUgc3RydWN0dXJlZCBjb250ZW50XG4gICAgaWYgKHN0cnVjdHVyZWRDb250ZW50ICYmIHN0cnVjdHVyZWRDb250ZW50Lmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvb2xfdXNlX2lkOiB0b29sVXNlSUQsXG4gICAgICAgIHR5cGU6ICd0b29sX3Jlc3VsdCcsXG4gICAgICAgIGNvbnRlbnQ6IHN0cnVjdHVyZWRDb250ZW50LFxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZvciBpbWFnZSBkYXRhLCBmb3JtYXQgYXMgaW1hZ2UgY29udGVudCBibG9jayBmb3IgQ2xhdWRlXG4gICAgaWYgKGlzSW1hZ2UpIHtcbiAgICAgIGNvbnN0IGJsb2NrID0gYnVpbGRJbWFnZVRvb2xSZXN1bHQoc3Rkb3V0LCB0b29sVXNlSUQpXG4gICAgICBpZiAoYmxvY2spIHJldHVybiBibG9ja1xuICAgIH1cblxuICAgIGxldCBwcm9jZXNzZWRTdGRvdXQgPSBzdGRvdXRcbiAgICBpZiAoc3Rkb3V0KSB7XG4gICAgICAvLyBSZXBsYWNlIGFueSBsZWFkaW5nIG5ld2xpbmVzIG9yIGxpbmVzIHdpdGggb25seSB3aGl0ZXNwYWNlXG4gICAgICBwcm9jZXNzZWRTdGRvdXQgPSBzdGRvdXQucmVwbGFjZSgvXihcXHMqXFxuKSsvLCAnJylcbiAgICAgIC8vIFN0aWxsIHRyaW0gdGhlIGVuZCBhcyBiZWZvcmVcbiAgICAgIHByb2Nlc3NlZFN0ZG91dCA9IHByb2Nlc3NlZFN0ZG91dC50cmltRW5kKClcbiAgICB9XG5cbiAgICAvLyBGb3IgbGFyZ2Ugb3V0cHV0IHRoYXQgd2FzIHBlcnNpc3RlZCB0byBkaXNrLCBidWlsZCA8cGVyc2lzdGVkLW91dHB1dD5cbiAgICAvLyBtZXNzYWdlIGZvciB0aGUgbW9kZWwuIFRoZSBVSSBuZXZlciBzZWVzIHRoaXMg4oCUIGl0IHVzZXMgZGF0YS5zdGRvdXQuXG4gICAgaWYgKHBlcnNpc3RlZE91dHB1dFBhdGgpIHtcbiAgICAgIGNvbnN0IHByZXZpZXcgPSBnZW5lcmF0ZVByZXZpZXcocHJvY2Vzc2VkU3Rkb3V0LCBQUkVWSUVXX1NJWkVfQllURVMpXG4gICAgICBwcm9jZXNzZWRTdGRvdXQgPSBidWlsZExhcmdlVG9vbFJlc3VsdE1lc3NhZ2Uoe1xuICAgICAgICBmaWxlcGF0aDogcGVyc2lzdGVkT3V0cHV0UGF0aCxcbiAgICAgICAgb3JpZ2luYWxTaXplOiBwZXJzaXN0ZWRPdXRwdXRTaXplID8/IDAsXG4gICAgICAgIGlzSnNvbjogZmFsc2UsXG4gICAgICAgIHByZXZpZXc6IHByZXZpZXcucHJldmlldyxcbiAgICAgICAgaGFzTW9yZTogcHJldmlldy5oYXNNb3JlLFxuICAgICAgfSlcbiAgICB9XG5cbiAgICBsZXQgZXJyb3JNZXNzYWdlID0gc3RkZXJyLnRyaW0oKVxuICAgIGlmIChpbnRlcnJ1cHRlZCkge1xuICAgICAgaWYgKHN0ZGVycikgZXJyb3JNZXNzYWdlICs9IEVPTFxuICAgICAgZXJyb3JNZXNzYWdlICs9ICc8ZXJyb3I+Q29tbWFuZCB3YXMgYWJvcnRlZCBiZWZvcmUgY29tcGxldGlvbjwvZXJyb3I+J1xuICAgIH1cblxuICAgIGxldCBiYWNrZ3JvdW5kSW5mbyA9ICcnXG4gICAgaWYgKGJhY2tncm91bmRUYXNrSWQpIHtcbiAgICAgIGNvbnN0IG91dHB1dFBhdGggPSBnZXRUYXNrT3V0cHV0UGF0aChiYWNrZ3JvdW5kVGFza0lkKVxuICAgICAgaWYgKGFzc2lzdGFudEF1dG9CYWNrZ3JvdW5kZWQpIHtcbiAgICAgICAgYmFja2dyb3VuZEluZm8gPSBgQ29tbWFuZCBleGNlZWRlZCB0aGUgYXNzaXN0YW50LW1vZGUgYmxvY2tpbmcgYnVkZ2V0ICgke0FTU0lTVEFOVF9CTE9DS0lOR19CVURHRVRfTVMgLyAxMDAwfXMpIGFuZCB3YXMgbW92ZWQgdG8gdGhlIGJhY2tncm91bmQgd2l0aCBJRDogJHtiYWNrZ3JvdW5kVGFza0lkfS4gSXQgaXMgc3RpbGwgcnVubmluZyDigJQgeW91IHdpbGwgYmUgbm90aWZpZWQgd2hlbiBpdCBjb21wbGV0ZXMuIE91dHB1dCBpcyBiZWluZyB3cml0dGVuIHRvOiAke291dHB1dFBhdGh9LiBJbiBhc3Npc3RhbnQgbW9kZSwgZGVsZWdhdGUgbG9uZy1ydW5uaW5nIHdvcmsgdG8gYSBzdWJhZ2VudCBvciB1c2UgcnVuX2luX2JhY2tncm91bmQgdG8ga2VlcCB0aGlzIGNvbnZlcnNhdGlvbiByZXNwb25zaXZlLmBcbiAgICAgIH0gZWxzZSBpZiAoYmFja2dyb3VuZGVkQnlVc2VyKSB7XG4gICAgICAgIGJhY2tncm91bmRJbmZvID0gYENvbW1hbmQgd2FzIG1hbnVhbGx5IGJhY2tncm91bmRlZCBieSB1c2VyIHdpdGggSUQ6ICR7YmFja2dyb3VuZFRhc2tJZH0uIE91dHB1dCBpcyBiZWluZyB3cml0dGVuIHRvOiAke291dHB1dFBhdGh9YFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmFja2dyb3VuZEluZm8gPSBgQ29tbWFuZCBydW5uaW5nIGluIGJhY2tncm91bmQgd2l0aCBJRDogJHtiYWNrZ3JvdW5kVGFza0lkfS4gT3V0cHV0IGlzIGJlaW5nIHdyaXR0ZW4gdG86ICR7b3V0cHV0UGF0aH1gXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHRvb2xfdXNlX2lkOiB0b29sVXNlSUQsXG4gICAgICB0eXBlOiAndG9vbF9yZXN1bHQnLFxuICAgICAgY29udGVudDogW3Byb2Nlc3NlZFN0ZG91dCwgZXJyb3JNZXNzYWdlLCBiYWNrZ3JvdW5kSW5mb11cbiAgICAgICAgLmZpbHRlcihCb29sZWFuKVxuICAgICAgICAuam9pbignXFxuJyksXG4gICAgICBpc19lcnJvcjogaW50ZXJydXB0ZWQsXG4gICAgfVxuICB9LFxuICBhc3luYyBjYWxsKFxuICAgIGlucHV0OiBCYXNoVG9vbElucHV0LFxuICAgIHRvb2xVc2VDb250ZXh0LFxuICAgIF9jYW5Vc2VUb29sPzogQ2FuVXNlVG9vbEZuLFxuICAgIHBhcmVudE1lc3NhZ2U/OiBBc3Npc3RhbnRNZXNzYWdlLFxuICAgIG9uUHJvZ3Jlc3M/OiBUb29sQ2FsbFByb2dyZXNzPEJhc2hQcm9ncmVzcz4sXG4gICkge1xuICAgIC8vIEhhbmRsZSBzaW11bGF0ZWQgc2VkIGVkaXQgLSBhcHBseSBkaXJlY3RseSBpbnN0ZWFkIG9mIHJ1bm5pbmcgc2VkXG4gICAgLy8gVGhpcyBlbnN1cmVzIHdoYXQgdGhlIHVzZXIgcHJldmlld2VkIGlzIGV4YWN0bHkgd2hhdCBnZXRzIHdyaXR0ZW5cbiAgICBpZiAoaW5wdXQuX3NpbXVsYXRlZFNlZEVkaXQpIHtcbiAgICAgIHJldHVybiBhcHBseVNlZEVkaXQoXG4gICAgICAgIGlucHV0Ll9zaW11bGF0ZWRTZWRFZGl0LFxuICAgICAgICB0b29sVXNlQ29udGV4dCxcbiAgICAgICAgcGFyZW50TWVzc2FnZSxcbiAgICAgIClcbiAgICB9XG5cbiAgICBjb25zdCB7IGFib3J0Q29udHJvbGxlciwgZ2V0QXBwU3RhdGUsIHNldEFwcFN0YXRlLCBzZXRUb29sSlNYIH0gPVxuICAgICAgdG9vbFVzZUNvbnRleHRcblxuICAgIGNvbnN0IHN0ZG91dEFjY3VtdWxhdG9yID0gbmV3IEVuZFRydW5jYXRpbmdBY2N1bXVsYXRvcigpXG4gICAgbGV0IHN0ZGVyckZvclNoZWxsUmVzZXQgPSAnJ1xuICAgIGxldCBpbnRlcnByZXRhdGlvblJlc3VsdDpcbiAgICAgIHwgUmV0dXJuVHlwZTx0eXBlb2YgaW50ZXJwcmV0Q29tbWFuZFJlc3VsdD5cbiAgICAgIHwgdW5kZWZpbmVkXG5cbiAgICBsZXQgcHJvZ3Jlc3NDb3VudGVyID0gMFxuICAgIGxldCB3YXNJbnRlcnJ1cHRlZCA9IGZhbHNlXG4gICAgbGV0IHJlc3VsdDogRXhlY1Jlc3VsdFxuXG4gICAgY29uc3QgaXNNYWluVGhyZWFkID0gIXRvb2xVc2VDb250ZXh0LmFnZW50SWRcbiAgICBjb25zdCBwcmV2ZW50Q3dkQ2hhbmdlcyA9ICFpc01haW5UaHJlYWRcblxuICAgIHRyeSB7XG4gICAgICAvLyBVc2UgdGhlIG5ldyBhc3luYyBnZW5lcmF0b3IgdmVyc2lvbiBvZiBydW5TaGVsbENvbW1hbmRcbiAgICAgIGNvbnN0IGNvbW1hbmRHZW5lcmF0b3IgPSBydW5TaGVsbENvbW1hbmQoe1xuICAgICAgICBpbnB1dCxcbiAgICAgICAgYWJvcnRDb250cm9sbGVyLFxuICAgICAgICAvLyBVc2UgdGhlIGFsd2F5cy1zaGFyZWQgdGFzayBjaGFubmVsIHNvIGFzeW5jIGFnZW50cycgYmFja2dyb3VuZFxuICAgICAgICAvLyBiYXNoIHRhc2tzIGFyZSBhY3R1YWxseSByZWdpc3RlcmVkIChhbmQga2lsbGFibGUgb24gYWdlbnQgZXhpdCkuXG4gICAgICAgIHNldEFwcFN0YXRlOiB0b29sVXNlQ29udGV4dC5zZXRBcHBTdGF0ZUZvclRhc2tzID8/IHNldEFwcFN0YXRlLFxuICAgICAgICBzZXRUb29sSlNYLFxuICAgICAgICBwcmV2ZW50Q3dkQ2hhbmdlcyxcbiAgICAgICAgaXNNYWluVGhyZWFkLFxuICAgICAgICB0b29sVXNlSWQ6IHRvb2xVc2VDb250ZXh0LnRvb2xVc2VJZCxcbiAgICAgICAgYWdlbnRJZDogdG9vbFVzZUNvbnRleHQuYWdlbnRJZCxcbiAgICAgIH0pXG5cbiAgICAgIC8vIENvbnN1bWUgdGhlIGdlbmVyYXRvciBhbmQgY2FwdHVyZSB0aGUgcmV0dXJuIHZhbHVlXG4gICAgICBsZXQgZ2VuZXJhdG9yUmVzdWx0XG4gICAgICBkbyB7XG4gICAgICAgIGdlbmVyYXRvclJlc3VsdCA9IGF3YWl0IGNvbW1hbmRHZW5lcmF0b3IubmV4dCgpXG4gICAgICAgIGlmICghZ2VuZXJhdG9yUmVzdWx0LmRvbmUgJiYgb25Qcm9ncmVzcykge1xuICAgICAgICAgIGNvbnN0IHByb2dyZXNzID0gZ2VuZXJhdG9yUmVzdWx0LnZhbHVlXG4gICAgICAgICAgb25Qcm9ncmVzcyh7XG4gICAgICAgICAgICB0b29sVXNlSUQ6IGBiYXNoLXByb2dyZXNzLSR7cHJvZ3Jlc3NDb3VudGVyKyt9YCxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgdHlwZTogJ2Jhc2hfcHJvZ3Jlc3MnLFxuICAgICAgICAgICAgICBvdXRwdXQ6IHByb2dyZXNzLm91dHB1dCxcbiAgICAgICAgICAgICAgZnVsbE91dHB1dDogcHJvZ3Jlc3MuZnVsbE91dHB1dCxcbiAgICAgICAgICAgICAgZWxhcHNlZFRpbWVTZWNvbmRzOiBwcm9ncmVzcy5lbGFwc2VkVGltZVNlY29uZHMsXG4gICAgICAgICAgICAgIHRvdGFsTGluZXM6IHByb2dyZXNzLnRvdGFsTGluZXMsXG4gICAgICAgICAgICAgIHRvdGFsQnl0ZXM6IHByb2dyZXNzLnRvdGFsQnl0ZXMsXG4gICAgICAgICAgICAgIHRhc2tJZDogcHJvZ3Jlc3MudGFza0lkLFxuICAgICAgICAgICAgICB0aW1lb3V0TXM6IHByb2dyZXNzLnRpbWVvdXRNcyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfSB3aGlsZSAoIWdlbmVyYXRvclJlc3VsdC5kb25lKVxuXG4gICAgICAvLyBHZXQgdGhlIGZpbmFsIHJlc3VsdCBmcm9tIHRoZSBnZW5lcmF0b3IncyByZXR1cm4gdmFsdWVcbiAgICAgIHJlc3VsdCA9IGdlbmVyYXRvclJlc3VsdC52YWx1ZVxuXG4gICAgICB0cmFja0dpdE9wZXJhdGlvbnMoaW5wdXQuY29tbWFuZCwgcmVzdWx0LmNvZGUsIHJlc3VsdC5zdGRvdXQpXG5cbiAgICAgIGNvbnN0IGlzSW50ZXJydXB0ID1cbiAgICAgICAgcmVzdWx0LmludGVycnVwdGVkICYmIGFib3J0Q29udHJvbGxlci5zaWduYWwucmVhc29uID09PSAnaW50ZXJydXB0J1xuXG4gICAgICAvLyBzdGRlcnIgaXMgaW50ZXJsZWF2ZWQgaW4gc3Rkb3V0IChtZXJnZWQgZmQpIOKAlCByZXN1bHQuc3Rkb3V0IGhhcyBib3RoXG4gICAgICBzdGRvdXRBY2N1bXVsYXRvci5hcHBlbmQoKHJlc3VsdC5zdGRvdXQgfHwgJycpLnRyaW1FbmQoKSArIEVPTClcblxuICAgICAgLy8gSW50ZXJwcmV0IHRoZSBjb21tYW5kIHJlc3VsdCB1c2luZyBzZW1hbnRpYyBydWxlc1xuICAgICAgaW50ZXJwcmV0YXRpb25SZXN1bHQgPSBpbnRlcnByZXRDb21tYW5kUmVzdWx0KFxuICAgICAgICBpbnB1dC5jb21tYW5kLFxuICAgICAgICByZXN1bHQuY29kZSxcbiAgICAgICAgcmVzdWx0LnN0ZG91dCB8fCAnJyxcbiAgICAgICAgJycsXG4gICAgICApXG5cbiAgICAgIC8vIENoZWNrIGZvciBnaXQgaW5kZXgubG9jayBlcnJvciAoc3RkZXJyIGlzIGluIHN0ZG91dCBub3cpXG4gICAgICBpZiAoXG4gICAgICAgIHJlc3VsdC5zdGRvdXQgJiZcbiAgICAgICAgcmVzdWx0LnN0ZG91dC5pbmNsdWRlcyhcIi5naXQvaW5kZXgubG9jayc6IEZpbGUgZXhpc3RzXCIpXG4gICAgICApIHtcbiAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2dpdF9pbmRleF9sb2NrX2Vycm9yJywge30pXG4gICAgICB9XG5cbiAgICAgIGlmIChpbnRlcnByZXRhdGlvblJlc3VsdC5pc0Vycm9yICYmICFpc0ludGVycnVwdCkge1xuICAgICAgICAvLyBPbmx5IGFkZCBleGl0IGNvZGUgaWYgaXQncyBhY3R1YWxseSBhbiBlcnJvclxuICAgICAgICBpZiAocmVzdWx0LmNvZGUgIT09IDApIHtcbiAgICAgICAgICBzdGRvdXRBY2N1bXVsYXRvci5hcHBlbmQoYEV4aXQgY29kZSAke3Jlc3VsdC5jb2RlfWApXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFwcmV2ZW50Q3dkQ2hhbmdlcykge1xuICAgICAgICBjb25zdCBhcHBTdGF0ZSA9IGdldEFwcFN0YXRlKClcbiAgICAgICAgaWYgKHJlc2V0Q3dkSWZPdXRzaWRlUHJvamVjdChhcHBTdGF0ZS50b29sUGVybWlzc2lvbkNvbnRleHQpKSB7XG4gICAgICAgICAgc3RkZXJyRm9yU2hlbGxSZXNldCA9IHN0ZEVyckFwcGVuZFNoZWxsUmVzZXRNZXNzYWdlKCcnKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFubm90YXRlIG91dHB1dCB3aXRoIHNhbmRib3ggdmlvbGF0aW9ucyBpZiBhbnkgKHN0ZGVyciBpcyBpbiBzdGRvdXQpXG4gICAgICBjb25zdCBvdXRwdXRXaXRoU2JGYWlsdXJlcyA9XG4gICAgICAgIFNhbmRib3hNYW5hZ2VyLmFubm90YXRlU3RkZXJyV2l0aFNhbmRib3hGYWlsdXJlcyhcbiAgICAgICAgICBpbnB1dC5jb21tYW5kLFxuICAgICAgICAgIHJlc3VsdC5zdGRvdXQgfHwgJycsXG4gICAgICAgIClcblxuICAgICAgaWYgKHJlc3VsdC5wcmVTcGF3bkVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihyZXN1bHQucHJlU3Bhd25FcnJvcilcbiAgICAgIH1cbiAgICAgIGlmIChpbnRlcnByZXRhdGlvblJlc3VsdC5pc0Vycm9yICYmICFpc0ludGVycnVwdCkge1xuICAgICAgICAvLyBzdGRlcnIgaXMgbWVyZ2VkIGludG8gc3Rkb3V0IChtZXJnZWQgZmQpOyBvdXRwdXRXaXRoU2JGYWlsdXJlc1xuICAgICAgICAvLyBhbHJlYWR5IGhhcyB0aGUgZnVsbCBvdXRwdXQuIFBhc3MgJycgZm9yIHN0ZG91dCB0byBhdm9pZFxuICAgICAgICAvLyBkdXBsaWNhdGlvbiBpbiBnZXRFcnJvclBhcnRzKCkgYW5kIHByb2Nlc3NCYXNoQ29tbWFuZC5cbiAgICAgICAgdGhyb3cgbmV3IFNoZWxsRXJyb3IoXG4gICAgICAgICAgJycsXG4gICAgICAgICAgb3V0cHV0V2l0aFNiRmFpbHVyZXMsXG4gICAgICAgICAgcmVzdWx0LmNvZGUsXG4gICAgICAgICAgcmVzdWx0LmludGVycnVwdGVkLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICB3YXNJbnRlcnJ1cHRlZCA9IHJlc3VsdC5pbnRlcnJ1cHRlZFxuICAgIH0gZmluYWxseSB7XG4gICAgICBpZiAoc2V0VG9vbEpTWCkgc2V0VG9vbEpTWChudWxsKVxuICAgIH1cblxuICAgIC8vIEdldCBmaW5hbCBzdHJpbmcgZnJvbSBhY2N1bXVsYXRvclxuICAgIGNvbnN0IHN0ZG91dCA9IHN0ZG91dEFjY3VtdWxhdG9yLnRvU3RyaW5nKClcblxuICAgIC8vIExhcmdlIG91dHB1dDogdGhlIGZpbGUgb24gZGlzayBoYXMgbW9yZSB0aGFuIGdldE1heE91dHB1dExlbmd0aCgpIGJ5dGVzLlxuICAgIC8vIHN0ZG91dCBhbHJlYWR5IGNvbnRhaW5zIHRoZSBmaXJzdCBjaHVuayAoZnJvbSBnZXRTdGRvdXQoKSkuIENvcHkgdGhlXG4gICAgLy8gb3V0cHV0IGZpbGUgdG8gdGhlIHRvb2wtcmVzdWx0cyBkaXIgc28gdGhlIG1vZGVsIGNhbiByZWFkIGl0IHZpYVxuICAgIC8vIEZpbGVSZWFkLiBJZiA+IDY0IE1CLCB0cnVuY2F0ZSBhZnRlciBjb3B5aW5nLlxuICAgIGNvbnN0IE1BWF9QRVJTSVNURURfU0laRSA9IDY0ICogMTAyNCAqIDEwMjRcbiAgICBsZXQgcGVyc2lzdGVkT3V0cHV0UGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgbGV0IHBlcnNpc3RlZE91dHB1dFNpemU6IG51bWJlciB8IHVuZGVmaW5lZFxuICAgIGlmIChyZXN1bHQub3V0cHV0RmlsZVBhdGggJiYgcmVzdWx0Lm91dHB1dFRhc2tJZCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmlsZVN0YXQgPSBhd2FpdCBmc1N0YXQocmVzdWx0Lm91dHB1dEZpbGVQYXRoKVxuICAgICAgICBwZXJzaXN0ZWRPdXRwdXRTaXplID0gZmlsZVN0YXQuc2l6ZVxuXG4gICAgICAgIGF3YWl0IGVuc3VyZVRvb2xSZXN1bHRzRGlyKClcbiAgICAgICAgY29uc3QgZGVzdCA9IGdldFRvb2xSZXN1bHRQYXRoKHJlc3VsdC5vdXRwdXRUYXNrSWQsIGZhbHNlKVxuICAgICAgICBpZiAoZmlsZVN0YXQuc2l6ZSA+IE1BWF9QRVJTSVNURURfU0laRSkge1xuICAgICAgICAgIGF3YWl0IGZzVHJ1bmNhdGUocmVzdWx0Lm91dHB1dEZpbGVQYXRoLCBNQVhfUEVSU0lTVEVEX1NJWkUpXG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBsaW5rKHJlc3VsdC5vdXRwdXRGaWxlUGF0aCwgZGVzdClcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgYXdhaXQgY29weUZpbGUocmVzdWx0Lm91dHB1dEZpbGVQYXRoLCBkZXN0KVxuICAgICAgICB9XG4gICAgICAgIHBlcnNpc3RlZE91dHB1dFBhdGggPSBkZXN0XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gRmlsZSBtYXkgYWxyZWFkeSBiZSBnb25lIOKAlCBzdGRvdXQgcHJldmlldyBpcyBzdWZmaWNpZW50XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY29tbWFuZFR5cGUgPSBpbnB1dC5jb21tYW5kLnNwbGl0KCcgJylbMF1cblxuICAgIGxvZ0V2ZW50KCd0ZW5ndV9iYXNoX3Rvb2xfY29tbWFuZF9leGVjdXRlZCcsIHtcbiAgICAgIGNvbW1hbmRfdHlwZTpcbiAgICAgICAgY29tbWFuZFR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIHN0ZG91dF9sZW5ndGg6IHN0ZG91dC5sZW5ndGgsXG4gICAgICBzdGRlcnJfbGVuZ3RoOiAwLFxuICAgICAgZXhpdF9jb2RlOiByZXN1bHQuY29kZSxcbiAgICAgIGludGVycnVwdGVkOiB3YXNJbnRlcnJ1cHRlZCxcbiAgICB9KVxuXG4gICAgLy8gTG9nIGNvZGUgaW5kZXhpbmcgdG9vbCB1c2FnZVxuICAgIGNvbnN0IGNvZGVJbmRleGluZ1Rvb2wgPSBkZXRlY3RDb2RlSW5kZXhpbmdGcm9tQ29tbWFuZChpbnB1dC5jb21tYW5kKVxuICAgIGlmIChjb2RlSW5kZXhpbmdUb29sKSB7XG4gICAgICBsb2dFdmVudCgndGVuZ3VfY29kZV9pbmRleGluZ190b29sX3VzZWQnLCB7XG4gICAgICAgIHRvb2w6IGNvZGVJbmRleGluZ1Rvb2wgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgc291cmNlOlxuICAgICAgICAgICdjbGknIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5jb2RlID09PSAwLFxuICAgICAgfSlcbiAgICB9XG5cbiAgICBsZXQgc3RyaXBwZWRTdGRvdXQgPSBzdHJpcEVtcHR5TGluZXMoc3Rkb3V0KVxuXG4gICAgLy8gQ2xhdWRlIENvZGUgaGludHMgcHJvdG9jb2w6IENMSXMvU0RLcyBnYXRlZCBvbiBDTEFVREVDT0RFPTEgZW1pdCBhXG4gICAgLy8gYDxjbGF1ZGUtY29kZS1oaW50IC8+YCB0YWcgdG8gc3RkZXJyIChtZXJnZWQgaW50byBzdGRvdXQgaGVyZSkuIFNjYW4sXG4gICAgLy8gcmVjb3JkIGZvciB1c2VDbGF1ZGVDb2RlSGludFJlY29tbWVuZGF0aW9uIHRvIHN1cmZhY2UsIHRoZW4gc3RyaXBcbiAgICAvLyBzbyB0aGUgbW9kZWwgbmV2ZXIgc2VlcyB0aGUgdGFnIOKAlCBhIHplcm8tdG9rZW4gc2lkZSBjaGFubmVsLlxuICAgIC8vIFN0cmlwcGluZyBydW5zIHVuY29uZGl0aW9uYWxseSAoc3ViYWdlbnQgb3V0cHV0IG11c3Qgc3RheSBjbGVhbiB0b28pO1xuICAgIC8vIG9ubHkgdGhlIGRpYWxvZyByZWNvcmRpbmcgaXMgbWFpbi10aHJlYWQtb25seS5cbiAgICBjb25zdCBleHRyYWN0ZWQgPSBleHRyYWN0Q2xhdWRlQ29kZUhpbnRzKHN0cmlwcGVkU3Rkb3V0LCBpbnB1dC5jb21tYW5kKVxuICAgIHN0cmlwcGVkU3Rkb3V0ID0gZXh0cmFjdGVkLnN0cmlwcGVkXG4gICAgaWYgKGlzTWFpblRocmVhZCAmJiBleHRyYWN0ZWQuaGludHMubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChjb25zdCBoaW50IG9mIGV4dHJhY3RlZC5oaW50cykgbWF5YmVSZWNvcmRQbHVnaW5IaW50KGhpbnQpXG4gICAgfVxuXG4gICAgbGV0IGlzSW1hZ2UgPSBpc0ltYWdlT3V0cHV0KHN0cmlwcGVkU3Rkb3V0KVxuXG4gICAgLy8gQ2FwIGltYWdlIGRpbWVuc2lvbnMgKyBzaXplIGlmIHByZXNlbnQgKENDLTMwNCDigJQgc2VlXG4gICAgLy8gcmVzaXplU2hlbGxJbWFnZU91dHB1dCkuIFNjb3BlIHRoZSBkZWNvZGVkIGJ1ZmZlciBzbyBpdCBjYW4gYmUgcmVjbGFpbWVkXG4gICAgLy8gYmVmb3JlIHdlIGJ1aWxkIHRoZSBvdXRwdXQgT3V0IG9iamVjdC5cbiAgICBsZXQgY29tcHJlc3NlZFN0ZG91dCA9IHN0cmlwcGVkU3Rkb3V0XG4gICAgaWYgKGlzSW1hZ2UpIHtcbiAgICAgIGNvbnN0IHJlc2l6ZWQgPSBhd2FpdCByZXNpemVTaGVsbEltYWdlT3V0cHV0KFxuICAgICAgICBzdHJpcHBlZFN0ZG91dCxcbiAgICAgICAgcmVzdWx0Lm91dHB1dEZpbGVQYXRoLFxuICAgICAgICBwZXJzaXN0ZWRPdXRwdXRTaXplLFxuICAgICAgKVxuICAgICAgaWYgKHJlc2l6ZWQpIHtcbiAgICAgICAgY29tcHJlc3NlZFN0ZG91dCA9IHJlc2l6ZWRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFBhcnNlIGZhaWxlZCBvciBmaWxlIHRvbyBsYXJnZSAoZS5nLiBleGNlZWRzIE1BWF9JTUFHRV9GSUxFX1NJWkUpLlxuICAgICAgICAvLyBLZWVwIGlzSW1hZ2UgaW4gc3luYyB3aXRoIHdoYXQgd2UgYWN0dWFsbHkgc2VuZCBzbyB0aGUgVUkgbGFiZWwgc3RheXNcbiAgICAgICAgLy8gYWNjdXJhdGUg4oCUIG1hcFRvb2xSZXN1bHRUb1Rvb2xSZXN1bHRCbG9ja1BhcmFtJ3MgZGVmZW5zaXZlXG4gICAgICAgIC8vIGZhbGx0aHJvdWdoIHdpbGwgc2VuZCB0ZXh0LCBub3QgYW4gaW1hZ2UgYmxvY2suXG4gICAgICAgIGlzSW1hZ2UgPSBmYWxzZVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGRhdGE6IE91dCA9IHtcbiAgICAgIHN0ZG91dDogY29tcHJlc3NlZFN0ZG91dCxcbiAgICAgIHN0ZGVycjogc3RkZXJyRm9yU2hlbGxSZXNldCxcbiAgICAgIGludGVycnVwdGVkOiB3YXNJbnRlcnJ1cHRlZCxcbiAgICAgIGlzSW1hZ2UsXG4gICAgICByZXR1cm5Db2RlSW50ZXJwcmV0YXRpb246IGludGVycHJldGF0aW9uUmVzdWx0Py5tZXNzYWdlLFxuICAgICAgbm9PdXRwdXRFeHBlY3RlZDogaXNTaWxlbnRCYXNoQ29tbWFuZChpbnB1dC5jb21tYW5kKSxcbiAgICAgIGJhY2tncm91bmRUYXNrSWQ6IHJlc3VsdC5iYWNrZ3JvdW5kVGFza0lkLFxuICAgICAgYmFja2dyb3VuZGVkQnlVc2VyOiByZXN1bHQuYmFja2dyb3VuZGVkQnlVc2VyLFxuICAgICAgYXNzaXN0YW50QXV0b0JhY2tncm91bmRlZDogcmVzdWx0LmFzc2lzdGFudEF1dG9CYWNrZ3JvdW5kZWQsXG4gICAgICBkYW5nZXJvdXNseURpc2FibGVTYW5kYm94OlxuICAgICAgICAnZGFuZ2Vyb3VzbHlEaXNhYmxlU2FuZGJveCcgaW4gaW5wdXRcbiAgICAgICAgICA/IChpbnB1dC5kYW5nZXJvdXNseURpc2FibGVTYW5kYm94IGFzIGJvb2xlYW4gfCB1bmRlZmluZWQpXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICBwZXJzaXN0ZWRPdXRwdXRQYXRoLFxuICAgICAgcGVyc2lzdGVkT3V0cHV0U2l6ZSxcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YSxcbiAgICB9XG4gIH0sXG4gIHJlbmRlclRvb2xVc2VFcnJvck1lc3NhZ2UsXG4gIGlzUmVzdWx0VHJ1bmNhdGVkKG91dHB1dDogT3V0KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIChcbiAgICAgIGlzT3V0cHV0TGluZVRydW5jYXRlZChvdXRwdXQuc3Rkb3V0KSB8fFxuICAgICAgaXNPdXRwdXRMaW5lVHJ1bmNhdGVkKG91dHB1dC5zdGRlcnIpXG4gICAgKVxuICB9LFxufSBzYXRpc2ZpZXMgVG9vbERlZjxJbnB1dFNjaGVtYSwgT3V0LCBCYXNoUHJvZ3Jlc3M+KVxuXG5hc3luYyBmdW5jdGlvbiogcnVuU2hlbGxDb21tYW5kKHtcbiAgaW5wdXQsXG4gIGFib3J0Q29udHJvbGxlcixcbiAgc2V0QXBwU3RhdGUsXG4gIHNldFRvb2xKU1gsXG4gIHByZXZlbnRDd2RDaGFuZ2VzLFxuICBpc01haW5UaHJlYWQsXG4gIHRvb2xVc2VJZCxcbiAgYWdlbnRJZCxcbn06IHtcbiAgaW5wdXQ6IEJhc2hUb29sSW5wdXRcbiAgYWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXJcbiAgc2V0QXBwU3RhdGU6IChmOiAocHJldjogQXBwU3RhdGUpID0+IEFwcFN0YXRlKSA9PiB2b2lkXG4gIHNldFRvb2xKU1g/OiBTZXRUb29sSlNYRm5cbiAgcHJldmVudEN3ZENoYW5nZXM/OiBib29sZWFuXG4gIGlzTWFpblRocmVhZD86IGJvb2xlYW5cbiAgdG9vbFVzZUlkPzogc3RyaW5nXG4gIGFnZW50SWQ/OiBBZ2VudElkXG59KTogQXN5bmNHZW5lcmF0b3I8XG4gIHtcbiAgICB0eXBlOiAncHJvZ3Jlc3MnXG4gICAgb3V0cHV0OiBzdHJpbmdcbiAgICBmdWxsT3V0cHV0OiBzdHJpbmdcbiAgICBlbGFwc2VkVGltZVNlY29uZHM6IG51bWJlclxuICAgIHRvdGFsTGluZXM6IG51bWJlclxuICAgIHRvdGFsQnl0ZXM/OiBudW1iZXJcbiAgICB0YXNrSWQ/OiBzdHJpbmdcbiAgICB0aW1lb3V0TXM/OiBudW1iZXJcbiAgfSxcbiAgRXhlY1Jlc3VsdCxcbiAgdm9pZFxuPiB7XG4gIGNvbnN0IHsgY29tbWFuZCwgZGVzY3JpcHRpb24sIHRpbWVvdXQsIHJ1bl9pbl9iYWNrZ3JvdW5kIH0gPSBpbnB1dFxuICBjb25zdCB0aW1lb3V0TXMgPSB0aW1lb3V0IHx8IGdldERlZmF1bHRUaW1lb3V0TXMoKVxuXG4gIGxldCBmdWxsT3V0cHV0ID0gJydcbiAgbGV0IGxhc3RQcm9ncmVzc091dHB1dCA9ICcnXG4gIGxldCBsYXN0VG90YWxMaW5lcyA9IDBcbiAgbGV0IGxhc3RUb3RhbEJ5dGVzID0gMFxuICBsZXQgYmFja2dyb3VuZFNoZWxsSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuICBsZXQgYXNzaXN0YW50QXV0b0JhY2tncm91bmRlZCA9IGZhbHNlXG5cbiAgLy8gUHJvZ3Jlc3Mgc2lnbmFsOiByZXNvbHZlZCBieSBvblByb2dyZXNzIGNhbGxiYWNrIGZyb20gdGhlIHNoYXJlZCBwb2xsZXIsXG4gIC8vIHdha2luZyB0aGUgZ2VuZXJhdG9yIHRvIHlpZWxkIGEgcHJvZ3Jlc3MgdXBkYXRlLlxuICBsZXQgcmVzb2x2ZVByb2dyZXNzOiAoKCkgPT4gdm9pZCkgfCBudWxsID0gbnVsbFxuICBmdW5jdGlvbiBjcmVhdGVQcm9ncmVzc1NpZ25hbCgpOiBQcm9taXNlPG51bGw+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8bnVsbD4ocmVzb2x2ZSA9PiB7XG4gICAgICByZXNvbHZlUHJvZ3Jlc3MgPSAoKSA9PiByZXNvbHZlKG51bGwpXG4gICAgfSlcbiAgfVxuXG4gIC8vIERldGVybWluZSBpZiBhdXRvLWJhY2tncm91bmRpbmcgc2hvdWxkIGJlIGVuYWJsZWRcbiAgLy8gT25seSBlbmFibGUgZm9yIGNvbW1hbmRzIHRoYXQgYXJlIGFsbG93ZWQgdG8gYmUgYXV0by1iYWNrZ3JvdW5kZWRcbiAgLy8gYW5kIHdoZW4gYmFja2dyb3VuZCB0YXNrcyBhcmUgbm90IGRpc2FibGVkXG4gIGNvbnN0IHNob3VsZEF1dG9CYWNrZ3JvdW5kID1cbiAgICAhaXNCYWNrZ3JvdW5kVGFza3NEaXNhYmxlZCAmJiBpc0F1dG9iYWNrZ3JvdW5kaW5nQWxsb3dlZChjb21tYW5kKVxuXG4gIGNvbnN0IHNoZWxsQ29tbWFuZCA9IGF3YWl0IGV4ZWMoY29tbWFuZCwgYWJvcnRDb250cm9sbGVyLnNpZ25hbCwgJ2Jhc2gnLCB7XG4gICAgdGltZW91dDogdGltZW91dE1zLFxuICAgIG9uUHJvZ3Jlc3MobGFzdExpbmVzLCBhbGxMaW5lcywgdG90YWxMaW5lcywgdG90YWxCeXRlcywgaXNJbmNvbXBsZXRlKSB7XG4gICAgICBsYXN0UHJvZ3Jlc3NPdXRwdXQgPSBsYXN0TGluZXNcbiAgICAgIGZ1bGxPdXRwdXQgPSBhbGxMaW5lc1xuICAgICAgbGFzdFRvdGFsTGluZXMgPSB0b3RhbExpbmVzXG4gICAgICBsYXN0VG90YWxCeXRlcyA9IGlzSW5jb21wbGV0ZSA/IHRvdGFsQnl0ZXMgOiAwXG4gICAgICAvLyBXYWtlIHRoZSBnZW5lcmF0b3Igc28gaXQgeWllbGRzIHRoZSBuZXcgcHJvZ3Jlc3MgZGF0YVxuICAgICAgY29uc3QgcmVzb2x2ZSA9IHJlc29sdmVQcm9ncmVzc1xuICAgICAgaWYgKHJlc29sdmUpIHtcbiAgICAgICAgcmVzb2x2ZVByb2dyZXNzID0gbnVsbFxuICAgICAgICByZXNvbHZlKClcbiAgICAgIH1cbiAgICB9LFxuICAgIHByZXZlbnRDd2RDaGFuZ2VzLFxuICAgIHNob3VsZFVzZVNhbmRib3g6IHNob3VsZFVzZVNhbmRib3goaW5wdXQpLFxuICAgIHNob3VsZEF1dG9CYWNrZ3JvdW5kLFxuICB9KVxuXG4gIC8vIFN0YXJ0IHRoZSBjb21tYW5kIGV4ZWN1dGlvblxuICBjb25zdCByZXN1bHRQcm9taXNlID0gc2hlbGxDb21tYW5kLnJlc3VsdFxuXG4gIC8vIEhlbHBlciB0byBzcGF3biBhIGJhY2tncm91bmQgdGFzayBhbmQgcmV0dXJuIGl0cyBJRFxuICBhc3luYyBmdW5jdGlvbiBzcGF3bkJhY2tncm91bmRUYXNrKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgaGFuZGxlID0gYXdhaXQgc3Bhd25TaGVsbFRhc2soXG4gICAgICB7XG4gICAgICAgIGNvbW1hbmQsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbiB8fCBjb21tYW5kLFxuICAgICAgICBzaGVsbENvbW1hbmQsXG4gICAgICAgIHRvb2xVc2VJZCxcbiAgICAgICAgYWdlbnRJZCxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGFib3J0Q29udHJvbGxlcixcbiAgICAgICAgZ2V0QXBwU3RhdGU6ICgpID0+IHtcbiAgICAgICAgICAvLyBXZSBkb24ndCBoYXZlIGRpcmVjdCBhY2Nlc3MgdG8gZ2V0QXBwU3RhdGUgaGVyZSwgYnV0IHNwYXduIGRvZXNuJ3RcbiAgICAgICAgICAvLyBhY3R1YWxseSB1c2UgaXQgZHVyaW5nIHRoZSBzcGF3biBwcm9jZXNzXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ2dldEFwcFN0YXRlIG5vdCBhdmFpbGFibGUgaW4gcnVuU2hlbGxDb21tYW5kIGNvbnRleHQnLFxuICAgICAgICAgIClcbiAgICAgICAgfSxcbiAgICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICB9LFxuICAgIClcbiAgICByZXR1cm4gaGFuZGxlLnRhc2tJZFxuICB9XG5cbiAgLy8gSGVscGVyIHRvIHN0YXJ0IGJhY2tncm91bmRpbmcgd2l0aCBvcHRpb25hbCBsb2dnaW5nXG4gIGZ1bmN0aW9uIHN0YXJ0QmFja2dyb3VuZGluZyhcbiAgICBldmVudE5hbWU6IHN0cmluZyxcbiAgICBiYWNrZ3JvdW5kRm4/OiAoc2hlbGxJZDogc3RyaW5nKSA9PiB2b2lkLFxuICApOiB2b2lkIHtcbiAgICAvLyBJZiBhIGZvcmVncm91bmQgdGFzayBpcyBhbHJlYWR5IHJlZ2lzdGVyZWQgKHZpYSByZWdpc3RlckZvcmVncm91bmQgaW4gdGhlXG4gICAgLy8gcHJvZ3Jlc3MgbG9vcCksIGJhY2tncm91bmQgaXQgaW4tcGxhY2UgaW5zdGVhZCBvZiByZS1zcGF3bmluZy4gUmUtc3Bhd25pbmdcbiAgICAvLyB3b3VsZCBvdmVyd3JpdGUgdGFza3NbdGFza0lkXSwgZW1pdCBhIGR1cGxpY2F0ZSB0YXNrX3N0YXJ0ZWQgU0RLIGV2ZW50LFxuICAgIC8vIGFuZCBsZWFrIHRoZSBmaXJzdCBjbGVhbnVwIGNhbGxiYWNrLlxuICAgIGlmIChmb3JlZ3JvdW5kVGFza0lkKSB7XG4gICAgICBpZiAoXG4gICAgICAgICFiYWNrZ3JvdW5kRXhpc3RpbmdGb3JlZ3JvdW5kVGFzayhcbiAgICAgICAgICBmb3JlZ3JvdW5kVGFza0lkLFxuICAgICAgICAgIHNoZWxsQ29tbWFuZCxcbiAgICAgICAgICBkZXNjcmlwdGlvbiB8fCBjb21tYW5kLFxuICAgICAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgICAgIHRvb2xVc2VJZCxcbiAgICAgICAgKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgYmFja2dyb3VuZFNoZWxsSWQgPSBmb3JlZ3JvdW5kVGFza0lkXG4gICAgICBsb2dFdmVudChldmVudE5hbWUsIHtcbiAgICAgICAgY29tbWFuZF90eXBlOiBnZXRDb21tYW5kVHlwZUZvckxvZ2dpbmcoY29tbWFuZCksXG4gICAgICB9KVxuICAgICAgYmFja2dyb3VuZEZuPy4oZm9yZWdyb3VuZFRhc2tJZClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIE5vIGZvcmVncm91bmQgdGFzayByZWdpc3RlcmVkIOKAlCBzcGF3biBhIG5ldyBiYWNrZ3JvdW5kIHRhc2tcbiAgICAvLyBOb3RlOiBzcGF3biBpcyBlc3NlbnRpYWxseSBzeW5jaHJvbm91cyBkZXNwaXRlIGJlaW5nIGFzeW5jXG4gICAgdm9pZCBzcGF3bkJhY2tncm91bmRUYXNrKCkudGhlbihzaGVsbElkID0+IHtcbiAgICAgIGJhY2tncm91bmRTaGVsbElkID0gc2hlbGxJZFxuXG4gICAgICAvLyBXYWtlIHRoZSBnZW5lcmF0b3IncyBQcm9taXNlLnJhY2Ugc28gaXQgc2VlcyBiYWNrZ3JvdW5kU2hlbGxJZC5cbiAgICAgIC8vIFdpdGhvdXQgdGhpcywgaWYgdGhlIHBvbGxlciBoYXMgc3RvcHBlZCB0aWNraW5nIGZvciB0aGlzIHRhc2tcbiAgICAgIC8vIChubyBvdXRwdXQgKyBzaGFyZWQtcG9sbGVyIHJhY2Ugd2l0aCBzaWJsaW5nIHN0b3BQb2xsaW5nIGNhbGxzKVxuICAgICAgLy8gYW5kIHRoZSBwcm9jZXNzIGlzIGh1bmcgb24gSS9PLCB0aGUgcmFjZSBhdCBsaW5lIH4xMzU3IG5ldmVyXG4gICAgICAvLyByZXNvbHZlcyBhbmQgdGhlIGdlbmVyYXRvciBkZWFkbG9ja3MgZGVzcGl0ZSBiZWluZyBiYWNrZ3JvdW5kZWQuXG4gICAgICBjb25zdCByZXNvbHZlID0gcmVzb2x2ZVByb2dyZXNzXG4gICAgICBpZiAocmVzb2x2ZSkge1xuICAgICAgICByZXNvbHZlUHJvZ3Jlc3MgPSBudWxsXG4gICAgICAgIHJlc29sdmUoKVxuICAgICAgfVxuXG4gICAgICBsb2dFdmVudChldmVudE5hbWUsIHtcbiAgICAgICAgY29tbWFuZF90eXBlOiBnZXRDb21tYW5kVHlwZUZvckxvZ2dpbmcoY29tbWFuZCksXG4gICAgICB9KVxuXG4gICAgICBpZiAoYmFja2dyb3VuZEZuKSB7XG4gICAgICAgIGJhY2tncm91bmRGbihzaGVsbElkKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICAvLyBTZXQgdXAgYXV0by1iYWNrZ3JvdW5kaW5nIG9uIHRpbWVvdXQgaWYgZW5hYmxlZFxuICAvLyBPbmx5IGJhY2tncm91bmQgY29tbWFuZHMgdGhhdCBhcmUgYWxsb3dlZCB0byBiZSBhdXRvLWJhY2tncm91bmRlZCAobm90IHNsZWVwLCBldGMuKVxuICBpZiAoc2hlbGxDb21tYW5kLm9uVGltZW91dCAmJiBzaG91bGRBdXRvQmFja2dyb3VuZCkge1xuICAgIHNoZWxsQ29tbWFuZC5vblRpbWVvdXQoYmFja2dyb3VuZEZuID0+IHtcbiAgICAgIHN0YXJ0QmFja2dyb3VuZGluZyhcbiAgICAgICAgJ3Rlbmd1X2Jhc2hfY29tbWFuZF90aW1lb3V0X2JhY2tncm91bmRlZCcsXG4gICAgICAgIGJhY2tncm91bmRGbixcbiAgICAgIClcbiAgICB9KVxuICB9XG5cbiAgLy8gSW4gYXNzaXN0YW50IG1vZGUsIHRoZSBtYWluIGFnZW50IHNob3VsZCBzdGF5IHJlc3BvbnNpdmUuIEF1dG8tYmFja2dyb3VuZFxuICAvLyBibG9ja2luZyBjb21tYW5kcyBhZnRlciBBU1NJU1RBTlRfQkxPQ0tJTkdfQlVER0VUX01TIHNvIHRoZSBhZ2VudCBjYW4ga2VlcFxuICAvLyBjb29yZGluYXRpbmcgaW5zdGVhZCBvZiB3YWl0aW5nLiBUaGUgY29tbWFuZCBrZWVwcyBydW5uaW5nIOKAlCBubyBzdGF0ZSBsb3NzLlxuICBpZiAoXG4gICAgZmVhdHVyZSgnS0FJUk9TJykgJiZcbiAgICBnZXRLYWlyb3NBY3RpdmUoKSAmJlxuICAgIGlzTWFpblRocmVhZCAmJlxuICAgICFpc0JhY2tncm91bmRUYXNrc0Rpc2FibGVkICYmXG4gICAgcnVuX2luX2JhY2tncm91bmQgIT09IHRydWVcbiAgKSB7XG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAoXG4gICAgICAgIHNoZWxsQ29tbWFuZC5zdGF0dXMgPT09ICdydW5uaW5nJyAmJlxuICAgICAgICBiYWNrZ3JvdW5kU2hlbGxJZCA9PT0gdW5kZWZpbmVkXG4gICAgICApIHtcbiAgICAgICAgYXNzaXN0YW50QXV0b0JhY2tncm91bmRlZCA9IHRydWVcbiAgICAgICAgc3RhcnRCYWNrZ3JvdW5kaW5nKCd0ZW5ndV9iYXNoX2NvbW1hbmRfYXNzaXN0YW50X2F1dG9fYmFja2dyb3VuZGVkJylcbiAgICAgIH1cbiAgICB9LCBBU1NJU1RBTlRfQkxPQ0tJTkdfQlVER0VUX01TKS51bnJlZigpXG4gIH1cblxuICAvLyBIYW5kbGUgQ2xhdWRlIGFza2luZyB0byBydW4gaXQgaW4gdGhlIGJhY2tncm91bmQgZXhwbGljaXRseVxuICAvLyBXaGVuIGV4cGxpY2l0bHkgcmVxdWVzdGVkIHZpYSBydW5faW5fYmFja2dyb3VuZCwgYWx3YXlzIGhvbm9yIHRoZSByZXF1ZXN0XG4gIC8vIHJlZ2FyZGxlc3Mgb2YgdGhlIGNvbW1hbmQgdHlwZSAoaXNBdXRvYmFja2dyb3VuZGluZ0FsbG93ZWQgb25seSBhcHBsaWVzIHRvIGF1dG9tYXRpYyBiYWNrZ3JvdW5kaW5nKVxuICAvLyBTa2lwIGlmIGJhY2tncm91bmQgdGFza3MgYXJlIGRpc2FibGVkIC0gcnVuIGluIGZvcmVncm91bmQgaW5zdGVhZFxuICBpZiAocnVuX2luX2JhY2tncm91bmQgPT09IHRydWUgJiYgIWlzQmFja2dyb3VuZFRhc2tzRGlzYWJsZWQpIHtcbiAgICBjb25zdCBzaGVsbElkID0gYXdhaXQgc3Bhd25CYWNrZ3JvdW5kVGFzaygpXG5cbiAgICBsb2dFdmVudCgndGVuZ3VfYmFzaF9jb21tYW5kX2V4cGxpY2l0bHlfYmFja2dyb3VuZGVkJywge1xuICAgICAgY29tbWFuZF90eXBlOiBnZXRDb21tYW5kVHlwZUZvckxvZ2dpbmcoY29tbWFuZCksXG4gICAgfSlcblxuICAgIHJldHVybiB7XG4gICAgICBzdGRvdXQ6ICcnLFxuICAgICAgc3RkZXJyOiAnJyxcbiAgICAgIGNvZGU6IDAsXG4gICAgICBpbnRlcnJ1cHRlZDogZmFsc2UsXG4gICAgICBiYWNrZ3JvdW5kVGFza0lkOiBzaGVsbElkLFxuICAgIH1cbiAgfVxuXG4gIC8vIFdhaXQgZm9yIHRoZSBpbml0aWFsIHRocmVzaG9sZCBiZWZvcmUgc2hvd2luZyBwcm9ncmVzc1xuICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpXG4gIGxldCBmb3JlZ3JvdW5kVGFza0lkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcblxuICB7XG4gICAgY29uc3QgaW5pdGlhbFJlc3VsdCA9IGF3YWl0IFByb21pc2UucmFjZShbXG4gICAgICByZXN1bHRQcm9taXNlLFxuICAgICAgbmV3IFByb21pc2U8bnVsbD4ocmVzb2x2ZSA9PiB7XG4gICAgICAgIGNvbnN0IHQgPSBzZXRUaW1lb3V0KFxuICAgICAgICAgIChyOiAodjogbnVsbCkgPT4gdm9pZCkgPT4gcihudWxsKSxcbiAgICAgICAgICBQUk9HUkVTU19USFJFU0hPTERfTVMsXG4gICAgICAgICAgcmVzb2x2ZSxcbiAgICAgICAgKVxuICAgICAgICB0LnVucmVmKClcbiAgICAgIH0pLFxuICAgIF0pXG5cbiAgICBpZiAoaW5pdGlhbFJlc3VsdCAhPT0gbnVsbCkge1xuICAgICAgc2hlbGxDb21tYW5kLmNsZWFudXAoKVxuICAgICAgcmV0dXJuIGluaXRpYWxSZXN1bHRcbiAgICB9XG5cbiAgICBpZiAoYmFja2dyb3VuZFNoZWxsSWQpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0ZG91dDogJycsXG4gICAgICAgIHN0ZGVycjogJycsXG4gICAgICAgIGNvZGU6IDAsXG4gICAgICAgIGludGVycnVwdGVkOiBmYWxzZSxcbiAgICAgICAgYmFja2dyb3VuZFRhc2tJZDogYmFja2dyb3VuZFNoZWxsSWQsXG4gICAgICAgIGFzc2lzdGFudEF1dG9CYWNrZ3JvdW5kZWQsXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gU3RhcnQgcG9sbGluZyB0aGUgb3V0cHV0IGZpbGUgZm9yIHByb2dyZXNzLiBUaGUgcG9sbGVyJ3MgI3RpY2sgY2FsbHNcbiAgLy8gb25Qcm9ncmVzcyBldmVyeSBzZWNvbmQsIHdoaWNoIHJlc29sdmVzIHByb2dyZXNzU2lnbmFsIGJlbG93LlxuICBUYXNrT3V0cHV0LnN0YXJ0UG9sbGluZyhzaGVsbENvbW1hbmQudGFza091dHB1dC50YXNrSWQpXG5cbiAgLy8gUHJvZ3Jlc3MgbG9vcDogd2FrZSBpcyBkcml2ZW4gYnkgdGhlIHNoYXJlZCBwb2xsZXIgY2FsbGluZyBvblByb2dyZXNzLFxuICAvLyB3aGljaCByZXNvbHZlcyB0aGUgcHJvZ3Jlc3NTaWduYWwuXG4gIHRyeSB7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHByb2dyZXNzU2lnbmFsID0gY3JlYXRlUHJvZ3Jlc3NTaWduYWwoKVxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtyZXN1bHRQcm9taXNlLCBwcm9ncmVzc1NpZ25hbF0pXG5cbiAgICAgIGlmIChyZXN1bHQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gUmFjZTogYmFja2dyb3VuZGluZyBmaXJlZCAoMTVzIHRpbWVyIC8gb25UaW1lb3V0IC8gQ3RybCtCKSBidXQgdGhlXG4gICAgICAgIC8vIGNvbW1hbmQgY29tcGxldGVkIGJlZm9yZSB0aGUgbmV4dCBwb2xsIHRpY2suICNoYW5kbGVFeGl0IHNldHNcbiAgICAgICAgLy8gYmFja2dyb3VuZFRhc2tJZCBidXQgc2tpcHMgb3V0cHV0RmlsZVBhdGggKGl0IGFzc3VtZXMgdGhlIGJhY2tncm91bmRcbiAgICAgICAgLy8gbWVzc2FnZSBvciA8dGFza19ub3RpZmljYXRpb24+IHdpbGwgY2FycnkgdGhlIHBhdGgpLiBTdHJpcFxuICAgICAgICAvLyBiYWNrZ3JvdW5kVGFza0lkIHNvIHRoZSBtb2RlbCBzZWVzIGEgY2xlYW4gY29tcGxldGVkIGNvbW1hbmQsXG4gICAgICAgIC8vIHJlY29uc3RydWN0IG91dHB1dEZpbGVQYXRoIGZvciBsYXJnZSBvdXRwdXRzLCBhbmQgc3VwcHJlc3MgdGhlXG4gICAgICAgIC8vIHJlZHVuZGFudCA8dGFza19ub3RpZmljYXRpb24+IGZyb20gdGhlIC50aGVuKCkgaGFuZGxlci5cbiAgICAgICAgLy8gQ2hlY2sgcmVzdWx0LmJhY2tncm91bmRUYXNrSWQgKG5vdCB0aGUgY2xvc3VyZSB2YXIpIHRvIGFsc28gY292ZXJcbiAgICAgICAgLy8gQ3RybCtCLCB3aGljaCBjYWxscyBzaGVsbENvbW1hbmQuYmFja2dyb3VuZCgpIGRpcmVjdGx5LlxuICAgICAgICBpZiAocmVzdWx0LmJhY2tncm91bmRUYXNrSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIG1hcmtUYXNrTm90aWZpZWQocmVzdWx0LmJhY2tncm91bmRUYXNrSWQsIHNldEFwcFN0YXRlKVxuICAgICAgICAgIGNvbnN0IGZpeGVkUmVzdWx0OiBFeGVjUmVzdWx0ID0ge1xuICAgICAgICAgICAgLi4ucmVzdWx0LFxuICAgICAgICAgICAgYmFja2dyb3VuZFRhc2tJZDogdW5kZWZpbmVkLFxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBNaXJyb3IgU2hlbGxDb21tYW5kLiNoYW5kbGVFeGl0J3MgbGFyZ2Utb3V0cHV0IGJyYW5jaCB0aGF0IHdhc1xuICAgICAgICAgIC8vIHNraXBwZWQgYmVjYXVzZSAjYmFja2dyb3VuZFRhc2tJZCB3YXMgc2V0LlxuICAgICAgICAgIGNvbnN0IHsgdGFza091dHB1dCB9ID0gc2hlbGxDb21tYW5kXG4gICAgICAgICAgaWYgKHRhc2tPdXRwdXQuc3Rkb3V0VG9GaWxlICYmICF0YXNrT3V0cHV0Lm91dHB1dEZpbGVSZWR1bmRhbnQpIHtcbiAgICAgICAgICAgIGZpeGVkUmVzdWx0Lm91dHB1dEZpbGVQYXRoID0gdGFza091dHB1dC5wYXRoXG4gICAgICAgICAgICBmaXhlZFJlc3VsdC5vdXRwdXRGaWxlU2l6ZSA9IHRhc2tPdXRwdXQub3V0cHV0RmlsZVNpemVcbiAgICAgICAgICAgIGZpeGVkUmVzdWx0Lm91dHB1dFRhc2tJZCA9IHRhc2tPdXRwdXQudGFza0lkXG4gICAgICAgICAgfVxuICAgICAgICAgIHNoZWxsQ29tbWFuZC5jbGVhbnVwKClcbiAgICAgICAgICByZXR1cm4gZml4ZWRSZXN1bHRcbiAgICAgICAgfVxuICAgICAgICAvLyBDb21tYW5kIGhhcyBjb21wbGV0ZWQgLSByZXR1cm4gdGhlIGFjdHVhbCByZXN1bHRcbiAgICAgICAgLy8gSWYgd2UgcmVnaXN0ZXJlZCBhcyBhIGZvcmVncm91bmQgdGFzaywgdW5yZWdpc3RlciBpdFxuICAgICAgICBpZiAoZm9yZWdyb3VuZFRhc2tJZCkge1xuICAgICAgICAgIHVucmVnaXN0ZXJGb3JlZ3JvdW5kKGZvcmVncm91bmRUYXNrSWQsIHNldEFwcFN0YXRlKVxuICAgICAgICB9XG4gICAgICAgIC8vIENsZWFuIHVwIHN0cmVhbSByZXNvdXJjZXMgZm9yIGZvcmVncm91bmQgY29tbWFuZHNcbiAgICAgICAgLy8gKGJhY2tncm91bmRlZCBjb21tYW5kcyBhcmUgY2xlYW5lZCB1cCBieSBMb2NhbFNoZWxsVGFzaylcbiAgICAgICAgc2hlbGxDb21tYW5kLmNsZWFudXAoKVxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIGlmIGNvbW1hbmQgd2FzIGJhY2tncm91bmRlZCAoZWl0aGVyIHZpYSBvbGQgbWVjaGFuaXNtIG9yIG5ldyBiYWNrZ3JvdW5kQWxsKVxuICAgICAgaWYgKGJhY2tncm91bmRTaGVsbElkKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3Rkb3V0OiAnJyxcbiAgICAgICAgICBzdGRlcnI6ICcnLFxuICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgaW50ZXJydXB0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGJhY2tncm91bmRUYXNrSWQ6IGJhY2tncm91bmRTaGVsbElkLFxuICAgICAgICAgIGFzc2lzdGFudEF1dG9CYWNrZ3JvdW5kZWQsXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgdGhpcyBmb3JlZ3JvdW5kIHRhc2sgd2FzIGJhY2tncm91bmRlZCB2aWEgYmFja2dyb3VuZEFsbCgpXG4gICAgICBpZiAoZm9yZWdyb3VuZFRhc2tJZCkge1xuICAgICAgICAvLyBzaGVsbENvbW1hbmQuc3RhdHVzIGJlY29tZXMgJ2JhY2tncm91bmRlZCcgd2hlbiBiYWNrZ3JvdW5kKCkgaXMgY2FsbGVkXG4gICAgICAgIGlmIChzaGVsbENvbW1hbmQuc3RhdHVzID09PSAnYmFja2dyb3VuZGVkJykge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGRvdXQ6ICcnLFxuICAgICAgICAgICAgc3RkZXJyOiAnJyxcbiAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICBpbnRlcnJ1cHRlZDogZmFsc2UsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kVGFza0lkOiBmb3JlZ3JvdW5kVGFza0lkLFxuICAgICAgICAgICAgYmFja2dyb3VuZGVkQnlVc2VyOiB0cnVlLFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUaW1lIGZvciBhIHByb2dyZXNzIHVwZGF0ZVxuICAgICAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBzdGFydFRpbWVcbiAgICAgIGNvbnN0IGVsYXBzZWRTZWNvbmRzID0gTWF0aC5mbG9vcihlbGFwc2VkIC8gMTAwMClcblxuICAgICAgLy8gU2hvdyBtaW5pbWFsIGJhY2tncm91bmRpbmcgVUkgaWYgYXZhaWxhYmxlXG4gICAgICAvLyBTa2lwIGlmIGJhY2tncm91bmQgdGFza3MgYXJlIGRpc2FibGVkXG4gICAgICBpZiAoXG4gICAgICAgICFpc0JhY2tncm91bmRUYXNrc0Rpc2FibGVkICYmXG4gICAgICAgIGJhY2tncm91bmRTaGVsbElkID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgZWxhcHNlZFNlY29uZHMgPj0gUFJPR1JFU1NfVEhSRVNIT0xEX01TIC8gMTAwMCAmJlxuICAgICAgICBzZXRUb29sSlNYXG4gICAgICApIHtcbiAgICAgICAgLy8gUmVnaXN0ZXIgdGhpcyBjb21tYW5kIGFzIGEgZm9yZWdyb3VuZCB0YXNrIHNvIGl0IGNhbiBiZSBiYWNrZ3JvdW5kZWQgdmlhIEN0cmwrQlxuICAgICAgICBpZiAoIWZvcmVncm91bmRUYXNrSWQpIHtcbiAgICAgICAgICBmb3JlZ3JvdW5kVGFza0lkID0gcmVnaXN0ZXJGb3JlZ3JvdW5kKFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjb21tYW5kLFxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24gfHwgY29tbWFuZCxcbiAgICAgICAgICAgICAgc2hlbGxDb21tYW5kLFxuICAgICAgICAgICAgICBhZ2VudElkLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgICAgICAgdG9vbFVzZUlkLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuXG4gICAgICAgIHNldFRvb2xKU1goe1xuICAgICAgICAgIGpzeDogPEJhY2tncm91bmRIaW50IC8+LFxuICAgICAgICAgIHNob3VsZEhpZGVQcm9tcHRJbnB1dDogZmFsc2UsXG4gICAgICAgICAgc2hvdWxkQ29udGludWVBbmltYXRpb246IHRydWUsXG4gICAgICAgICAgc2hvd1NwaW5uZXI6IHRydWUsXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICB5aWVsZCB7XG4gICAgICAgIHR5cGU6ICdwcm9ncmVzcycsXG4gICAgICAgIGZ1bGxPdXRwdXQsXG4gICAgICAgIG91dHB1dDogbGFzdFByb2dyZXNzT3V0cHV0LFxuICAgICAgICBlbGFwc2VkVGltZVNlY29uZHM6IGVsYXBzZWRTZWNvbmRzLFxuICAgICAgICB0b3RhbExpbmVzOiBsYXN0VG90YWxMaW5lcyxcbiAgICAgICAgdG90YWxCeXRlczogbGFzdFRvdGFsQnl0ZXMsXG4gICAgICAgIHRhc2tJZDogc2hlbGxDb21tYW5kLnRhc2tPdXRwdXQudGFza0lkLFxuICAgICAgICAuLi4odGltZW91dCA/IHsgdGltZW91dE1zIH0gOiB1bmRlZmluZWQpLFxuICAgICAgfVxuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICBUYXNrT3V0cHV0LnN0b3BQb2xsaW5nKHNoZWxsQ29tbWFuZC50YXNrT3V0cHV0LnRhc2tJZClcbiAgfVxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxTQUFTQSxPQUFPLFFBQVEsWUFBWTtBQUNwQyxjQUFjQyxvQkFBb0IsUUFBUSx1Q0FBdUM7QUFDakYsU0FDRUMsUUFBUSxFQUNSQyxJQUFJLElBQUlDLE1BQU0sRUFDZEMsUUFBUSxJQUFJQyxVQUFVLEVBQ3RCQyxJQUFJLFFBQ0MsYUFBYTtBQUNwQixPQUFPLEtBQUtDLEtBQUssTUFBTSxPQUFPO0FBQzlCLGNBQWNDLFlBQVksUUFBUSw0QkFBNEI7QUFDOUQsY0FBY0MsUUFBUSxRQUFRLHVCQUF1QjtBQUNyRCxTQUFTQyxDQUFDLFFBQVEsUUFBUTtBQUMxQixTQUFTQyxlQUFlLFFBQVEsMEJBQTBCO0FBQzFELFNBQVNDLHVCQUF1QixRQUFRLCtCQUEr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