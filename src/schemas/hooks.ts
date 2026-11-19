/**
 * Hook Zod schemas extracted to break import cycles.
 *
 * This file contains hook-related schema definitions that were originally
 * in src/utils/settings/types.ts. By extracting them here, we break the
 * circular dependency between settings/types.ts and plugins/schemas.ts.
 *
 * Both files now import from this shared location instead of each other.
 */

import { HOOK_EVENTS, type HookEvent } from 'src/entrypoints/agentSdkTypes.js'
import { z } from 'zod/v4'
import { lazySchema } from '../utils/lazySchema.js'
import { SHELL_TYPES } from '../utils/shell/shellProvider.js'

// Shared schema for the `if` condition field.
// Uses permission rule syntax (e.g., "Bash(git *)", "Read(*.ts)") to filter hooks
// before spawning. Evaluated against the hook input's tool_name and tool_input.
const IfConditionSchema = lazySchema(() =>
  z
    .string()
    .optional()
    .describe(
      'Permission rule syntax to filter when this hook runs (e.g., "Bash(git *)"). ' +
        'Only runs if the tool call matches the pattern. Avoids spawning hooks for non-matching commands.',
    ),
)

// Internal factory for individual hook schemas (shared between exported
// discriminated union members and the HookCommandSchema factory)
function buildHookSchemas() {
  const BashCommandHookSchema = z.object({
    type: z.literal('command').describe('Shell command hook type'),
    command: z.string().describe('Shell command to execute'),
    if: IfConditionSchema(),
    shell: z
      .enum(SHELL_TYPES)
      .optional()
      .describe(
        "Shell interpreter. 'bash' uses your $SHELL (bash/zsh/sh); 'powershell' uses pwsh. Defaults to bash.",
      ),
    timeout: z
      .number()
      .positive()
      .optional()
      .describe('Timeout in seconds for this specific command'),
    statusMessage: z
      .string()
      .optional()
      .describe('Custom status message to display in spinner while hook runs'),
    once: z
      .boolean()
      .optional()
      .describe('If true, hook runs once and is removed after execution'),
    async: z
      .boolean()
      .optional()
      .describe('If true, hook runs in background without blocking'),
    asyncRewake: z
      .boolean()
      .optional()
      .describe(
        'If true, hook runs in background and wakes the model on exit code 2 (blocking error). Implies async.',
      ),
  })

  const PromptHookSchema = z.object({
    type: z.literal('prompt').describe('LLM prompt hook type'),
    prompt: z
      .string()
      .describe(
        'Prompt to evaluate with LLM. Use $ARGUMENTS placeholder for hook input JSON.',
      ),
    if: IfConditionSchema(),
    timeout: z
      .number()
      .positive()
      .optional()
      .describe('Timeout in seconds for this specific prompt evaluation'),
    // @[MODEL LAUNCH]: Update the example model ID in the .describe() strings below (prompt + agent hooks).
    model: z
      .string()
      .optional()
      .describe(
        'Model to use for this prompt hook (e.g., "claude-sonnet-4-6"). If not specified, uses the default small fast model.',
      ),
    statusMessage: z
      .string()
      .optional()
      .describe('Custom status message to display in spinner while hook runs'),
    once: z
      .boolean()
      .optional()
      .describe('If true, hook runs once and is removed after execution'),
  })

  const HttpHookSchema = z.object({
    type: z.literal('http').describe('HTTP hook type'),
    url: z.string().url().describe('URL to POST the hook input JSON to'),
    if: IfConditionSchema(),
    timeout: z
      .number()
      .positive()
      .optional()
      .describe('Timeout in seconds for this specific request'),
    headers: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        'Additional headers to include in the request. Values may reference environment variables using $VAR_NAME or ${VAR_NAME} syntax (e.g., "Authorization": "Bearer $MY_TOKEN"). Only variables listed in allowedEnvVars will be interpolated.',
      ),
    allowedEnvVars: z
      .array(z.string())
      .optional()
      .describe(
        'Explicit list of environment variable names that may be interpolated in header values. Only variables listed here will be resolved; all other $VAR references are left as empty strings. Required for env var interpolation to work.',
      ),
    statusMessage: z
      .string()
      .optional()
      .describe('Custom status message to display in spinner while hook runs'),
    once: z
      .boolean()
      .optional()
      .describe('If true, hook runs once and is removed after execution'),
  })

  const AgentHookSchema = z.object({
    type: z.literal('agent').describe('Agentic verifier hook type'),
    // DO NOT add .transform() here. This schema is used by parseSettingsFile,
    // and updateSettingsForSource round-trips the parsed result through
    // JSON.stringify — a transformed function value is silently dropped,
    // deleting the user's prompt from settings.json (gh-24920, CC-79). The
    // transform (from #10594) wrapped the string in `(_msgs) => prompt`
    // for a programmatic-construction use case in ExitPlanModeV2Tool that
    // has since been refactored into VerifyPlanExecutionTool, which no
    // longer constructs AgentHook objects at all.
    prompt: z
      .string()
      .describe(
        'Prompt describing what to verify (e.g. "Verify that unit tests ran and passed."). Use $ARGUMENTS placeholder for hook input JSON.',
      ),
    if: IfConditionSchema(),
    timeout: z
      .number()
      .positive()
      .optional()
      .describe('Timeout in seconds for agent execution (default 60)'),
    model: z
      .string()
      .optional()
      .describe(
        'Model to use for this agent hook (e.g., "claude-sonnet-4-6"). If not specified, uses Haiku.',
      ),
    statusMessage: z
      .string()
      .optional()
      .describe('Custom status message to display in spinner while hook runs'),
    once: z
      .boolean()
      .optional()
      .describe('If true, hook runs once and is removed after execution'),
  })

  return {
    BashCommandHookSchema,
    PromptHookSchema,
    HttpHookSchema,
    AgentHookSchema,
  }
}

/**
 * Schema for hook command (excludes function hooks - they can't be persisted)
 */
export const HookCommandSchema = lazySchema(() => {
  const {
    BashCommandHookSchema,
    PromptHookSchema,
    AgentHookSchema,
    HttpHookSchema,
  } = buildHookSchemas()
  return z.discriminatedUnion('type', [
    BashCommandHookSchema,
    PromptHookSchema,
    AgentHookSchema,
    HttpHookSchema,
  ])
})

/**
 * Schema for matcher configuration with multiple hooks
 */
export const HookMatcherSchema = lazySchema(() =>
  z.object({
    matcher: z
      .string()
      .optional()
      .describe('String pattern to match (e.g. tool names like "Write")'), // String (e.g. Write) to match values related to the hook event, e.g. tool names
    hooks: z
      .array(HookCommandSchema())
      .describe('List of hooks to execute when the matcher matches'),
  }),
)

/**
 * Schema for hooks configuration
 * The key is the hook event. The value is an array of matcher configurations.
 * Uses partialRecord since not all hook events need to be defined.
 */
export const HooksSchema = lazySchema(() =>
  z.partialRecord(z.enum(HOOK_EVENTS), z.array(HookMatcherSchema())),
)

// Inferred types from schemas
export type HookCommand = z.infer<ReturnType<typeof HookCommandSchema>>
export type BashCommandHook = Extract<HookCommand, { type: 'command' }>
export type PromptHook = Extract<HookCommand, { type: 'prompt' }>
export type AgentHook = Extract<HookCommand, { type: 'agent' }>
export type HttpHook = Extract<HookCommand, { type: 'http' }>
export type HookMatcher = z.infer<ReturnType<typeof HookMatcherSchema>>
export type HooksSettings = Partial<Record<HookEvent, HookMatcher[]>>
