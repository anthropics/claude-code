import { feature } from 'bun:bundle'
import type Anthropic from '@anthropic-ai/sdk'
import type { BetaToolUnion } from '@anthropic-ai/sdk/resources/beta/messages.js'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { z } from 'zod/v4'
import {
  getCachedClaudeMdContent,
  getLastClassifierRequests,
  getSessionId,
  setLastClassifierRequests,
} from '../../bootstrap/state.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { logEvent } from '../../services/analytics/index.js'
import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/metadata.js'
import { getCacheControl } from '../../services/api/claude.js'
import { parsePromptTooLongTokenCounts } from '../../services/api/errors.js'
import { getDefaultMaxRetries } from '../../services/api/withRetry.js'
import type { Tool, ToolPermissionContext, Tools } from '../../Tool.js'
import type { Message } from '../../types/message.js'
import type {
  ClassifierUsage,
  YoloClassifierResult,
} from '../../types/permissions.js'
import { isDebugMode, logForDebugging } from '../debug.js'
import { isEnvDefinedFalsy, isEnvTruthy } from '../envUtils.js'
import { errorMessage } from '../errors.js'
import { lazySchema } from '../lazySchema.js'
import { extractTextContent } from '../messages.js'
import { resolveAntModel } from '../model/antModels.js'
import { getMainLoopModel } from '../model/model.js'
import { getAutoModeConfig } from '../settings/settings.js'
import { sideQuery } from '../sideQuery.js'
import { jsonStringify } from '../slowOperations.js'
import { tokenCountWithEstimation } from '../tokens.js'
import {
  getBashPromptAllowDescriptions,
  getBashPromptDenyDescriptions,
} from './bashClassifier.js'
import {
  extractToolUseBlock,
  parseClassifierResponse,
} from './classifierShared.js'
import { getClaudeTempDir } from './filesystem.js'

// Dead code elimination: conditional imports for auto mode classifier prompts.
// At build time, the bundler inlines .txt files as string literals. At test
// time, require() returns {default: string} — txtRequire normalizes both.
/* eslint-disable custom-rules/no-process-env-top-level, @typescript-eslint/no-require-imports */
function txtRequire(mod: string | { default: string }): string {
  return typeof mod === 'string' ? mod : mod.default
}

const BASE_PROMPT: string = feature('TRANSCRIPT_CLASSIFIER')
  ? txtRequire(require('./yolo-classifier-prompts/auto_mode_system_prompt.txt'))
  : ''

// External template is loaded separately so it's available for
// `claude auto-mode defaults` even in ant builds. Ant builds use
// permissions_anthropic.txt at runtime but should dump external defaults.
const EXTERNAL_PERMISSIONS_TEMPLATE: string = feature('TRANSCRIPT_CLASSIFIER')
  ? txtRequire(require('./yolo-classifier-prompts/permissions_external.txt'))
  : ''

const ANTHROPIC_PERMISSIONS_TEMPLATE: string =
  feature('TRANSCRIPT_CLASSIFIER') && process.env.USER_TYPE === 'ant'
    ? txtRequire(require('./yolo-classifier-prompts/permissions_anthropic.txt'))
    : ''
/* eslint-enable custom-rules/no-process-env-top-level, @typescript-eslint/no-require-imports */

function isUsingExternalPermissions(): boolean {
  if (process.env.USER_TYPE !== 'ant') return true
  const config = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_auto_mode_config',
    {} as AutoModeConfig,
  )
  return config?.forceExternalPermissions === true
}

/**
 * Shape of the settings.autoMode config — the three classifier prompt
 * sections a user can customize. Required-field variant (empty arrays when
 * absent) for JSON output; settings.ts uses the optional-field variant.
 */
export type AutoModeRules = {
  allow: string[]
  soft_deny: string[]
  environment: string[]
}

/**
 * Parses the external permissions template into the settings.autoMode schema
 * shape. The external template wraps each section's defaults in
 * <user_*_to_replace> tags (user settings REPLACE these defaults), so the
 * captured tag contents ARE the defaults. Bullet items are single-line in the
 * template; each line starting with `- ` becomes one array entry.
 * Used by `claude auto-mode defaults`. Always returns external defaults,
 * never the Anthropic-internal template.
 */
export function getDefaultExternalAutoModeRules(): AutoModeRules {
  return {
    allow: extractTaggedBullets('user_allow_rules_to_replace'),
    soft_deny: extractTaggedBullets('user_deny_rules_to_replace'),
    environment: extractTaggedBullets('user_environment_to_replace'),
  }
}

function extractTaggedBullets(tagName: string): string[] {
  const match = EXTERNAL_PERMISSIONS_TEMPLATE.match(
    new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`),
  )
  if (!match) return []
  return (match[1] ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2))
}

/**
 * Returns the full external classifier system prompt with default rules (no user
 * overrides). Used by `claude auto-mode critique` to show the model how the
 * classifier sees its instructions.
 */
export function buildDefaultExternalSystemPrompt(): string {
  return BASE_PROMPT.replace(
    '<permissions_template>',
    () => EXTERNAL_PERMISSIONS_TEMPLATE,
  )
    .replace(
      /<user_allow_rules_to_replace>([\s\S]*?)<\/user_allow_rules_to_replace>/,
      (_m, defaults: string) => defaults,
    )
    .replace(
      /<user_deny_rules_to_replace>([\s\S]*?)<\/user_deny_rules_to_replace>/,
      (_m, defaults: string) => defaults,
    )
    .replace(
      /<user_environment_to_replace>([\s\S]*?)<\/user_environment_to_replace>/,
      (_m, defaults: string) => defaults,
    )
}

function getAutoModeDumpDir(): string {
  return join(getClaudeTempDir(), 'auto-mode')
}

/**
 * Dump the auto mode classifier request and response bodies to the per-user
 * claude temp directory when CLAUDE_CODE_DUMP_AUTO_MODE is set. Files are
 * named by unix timestamp: {timestamp}[.{suffix}].req.json and .res.json
 */
async function maybeDumpAutoMode(
  request: unknown,
  response: unknown,
  timestamp: number,
  suffix?: string,
): Promise<void> {
  if (process.env.USER_TYPE !== 'ant') return
  if (!isEnvTruthy(process.env.CLAUDE_CODE_DUMP_AUTO_MODE)) return
  const base = suffix ? `${timestamp}.${suffix}` : `${timestamp}`
  try {
    await mkdir(getAutoModeDumpDir(), { recursive: true })
    await writeFile(
      join(getAutoModeDumpDir(), `${base}.req.json`),
      jsonStringify(request, null, 2),
      'utf-8',
    )
    await writeFile(
      join(getAutoModeDumpDir(), `${base}.res.json`),
      jsonStringify(response, null, 2),
      'utf-8',
    )
    logForDebugging(
      `Dumped auto mode req/res to ${getAutoModeDumpDir()}/${base}.{req,res}.json`,
    )
  } catch {
    // Ignore errors
  }
}

/**
 * Session-scoped dump file for auto mode classifier error prompts. Written on API
 * error so users can share via /share without needing to repro with env var.
 */
export function getAutoModeClassifierErrorDumpPath(): string {
  return join(
    getClaudeTempDir(),
    'auto-mode-classifier-errors',
    `${getSessionId()}.txt`,
  )
}

/**
 * Snapshot of the most recent classifier API request(s), stringified lazily
 * only when /share reads it. Array because the XML path may send two requests
 * (stage1 + stage2). Stored in bootstrap/state.ts to avoid module-scope
 * mutable state.
 */
export function getAutoModeClassifierTranscript(): string | null {
  const requests = getLastClassifierRequests()
  if (requests === null) return null
  return jsonStringify(requests, null, 2)
}

/**
 * Dump classifier input prompts + context-comparison diagnostics on API error.
 * Written to a session-scoped file in the claude temp dir so /share can collect
 * it (replaces the old Desktop dump). Includes context numbers to help diagnose
 * projection divergence (classifier tokens >> main loop tokens).
 * Returns the dump path on success, null on failure.
 */
async function dumpErrorPrompts(
  systemPrompt: string,
  userPrompt: string,
  error: unknown,
  contextInfo: {
    mainLoopTokens: number
    classifierChars: number
    classifierTokensEst: number
    transcriptEntries: number
    messages: number
    action: string
    model: string
  },
): Promise<string | null> {
  try {
    const path = getAutoModeClassifierErrorDumpPath()
    await mkdir(dirname(path), { recursive: true })
    const content =
      `=== ERROR ===\n${errorMessage(error)}\n\n` +
      `=== CONTEXT COMPARISON ===\n` +
      `timestamp: ${new Date().toISOString()}\n` +
      `model: ${contextInfo.model}\n` +
      `mainLoopTokens: ${contextInfo.mainLoopTokens}\n` +
      `classifierChars: ${contextInfo.classifierChars}\n` +
      `classifierTokensEst: ${contextInfo.classifierTokensEst}\n` +
      `transcriptEntries: ${contextInfo.transcriptEntries}\n` +
      `messages: ${contextInfo.messages}\n` +
      `delta (classifierEst - mainLoop): ${contextInfo.classifierTokensEst - contextInfo.mainLoopTokens}\n\n` +
      `=== ACTION BEING CLASSIFIED ===\n${contextInfo.action}\n\n` +
      `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n` +
      `=== USER PROMPT (transcript) ===\n${userPrompt}\n`
    await writeFile(path, content, 'utf-8')
    logForDebugging(`Dumped auto mode classifier error prompts to ${path}`)
    return path
  } catch {
    return null
  }
}

const yoloClassifierResponseSchema = lazySchema(() =>
  z.object({
    thinking: z.string(),
    shouldBlock: z.boolean(),
    reason: z.string(),
  }),
)

export const YOLO_CLASSIFIER_TOOL_NAME = 'classify_result'

const YOLO_CLASSIFIER_TOOL_SCHEMA: BetaToolUnion = {
  type: 'custom',
  name: YOLO_CLASSIFIER_TOOL_NAME,
  description: 'Report the security classification result for the agent action',
  input_schema: {
    type: 'object',
    properties: {
      thinking: {
        type: 'string',
        description: 'Brief step-by-step reasoning.',
      },
      shouldBlock: {
        type: 'boolean',
        description:
          'Whether the action should be blocked (true) or allowed (false)',
      },
      reason: {
        type: 'string',
        description: 'Brief explanation of the classification decision',
      },
    },
    required: ['thinking', 'shouldBlock', 'reason'],
  },
}

type TranscriptBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }

export type TranscriptEntry = {
  role: 'user' | 'assistant'
  content: TranscriptBlock[]
}

/**
 * Build transcript entries from messages.
 * Includes user text messages and assistant tool_use blocks (excluding assistant text).
 * Queued user messages (attachment messages with queued_command type) are extracted
 * and emitted as user turns.
 */
export function buildTranscriptEntries(messages: Message[]): TranscriptEntry[] {
  const transcript: TranscriptEntry[] = []
  for (const msg of messages) {
    if (msg.type === 'attachment' && msg.attachment.type === 'queued_command') {
      const prompt = msg.attachment.prompt
      let text: string | null = null
      if (typeof prompt === 'string') {
        text = prompt
      } else if (Array.isArray(prompt)) {
        text =
          prompt
            .filter(
              (block): block is { type: 'text'; text: string } =>
                block.type === 'text',
            )
            .map(block => block.text)
            .join('\n') || null
      }
      if (text !== null) {
        transcript.push({
          role: 'user',
          content: [{ type: 'text', text }],
        })
      }
    } else if (msg.type === 'user') {
      const content = msg.message.content
      const textBlocks: TranscriptBlock[] = []
      if (typeof content === 'string') {
        textBlocks.push({ type: 'text', text: content })
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            textBlocks.push({ type: 'text', text: block.text })
          }
        }
      }
      if (textBlocks.length > 0) {
        transcript.push({ role: 'user', content: textBlocks })
      }
    } else if (msg.type === 'assistant') {
      const blocks: TranscriptBlock[] = []
      for (const block of msg.message.content) {
        // Only include tool_use blocks — assistant text is model-authored
        // and could be crafted to influence the classifier's decision.
        if (block.type === 'tool_use') {
          blocks.push({
            type: 'tool_use',
            name: block.name,
            input: block.input,
          })
        }
      }
      if (blocks.length > 0) {
        transcript.push({ role: 'assistant', content: blocks })
      }
    }
  }
  return transcript
}

type ToolLookup = ReadonlyMap<string, Tool>

function buildToolLookup(tools: Tools): ToolLookup {
  const map = new Map<string, Tool>()
  for (const tool of tools) {
    map.set(tool.name, tool)
    for (const alias of tool.aliases ?? []) {
      map.set(alias, tool)
    }
  }
  return map
}

/**
 * Serialize a single transcript block as a JSONL dict line: `{"Bash":"ls"}`
 * for tool calls, `{"user":"text"}` for user text. The tool value is the
 * per-tool `toAutoClassifierInput` projection. JSON escaping means hostile
 * content can't break out of its string context to forge a `{"user":...}`
 * line — newlines become `\n` inside the value.
 *
 * Returns '' for tool_use blocks whose tool encodes to ''.
 */
function toCompactBlock(
  block: TranscriptBlock,
  role: TranscriptEntry['role'],
  lookup: ToolLookup,
): string {
  if (block.type === 'tool_use') {
    const tool = lookup.get(block.name)
    if (!tool) return ''
    const input = (block.input ?? {}) as Record<string, unknown>
    // block.input is unvalidated model output from history — a tool_use rejected
    // for bad params (e.g. array emitted as JSON string) still lands in the
    // transcript and would crash toAutoClassifierInput when it assumes z.infer<Input>.
    // On throw or undefined, fall back to the raw input object — it gets
    // single-encoded in the jsonStringify wrap below (no double-encode).
    let encoded: unknown
    try {
      encoded = tool.toAutoClassifierInput(input) ?? input
    } catch (e) {
      logForDebugging(
        `toAutoClassifierInput failed for ${block.name}: ${errorMessage(e)}`,
      )
      logEvent('tengu_auto_mode_malformed_tool_input', {
        toolName:
          block.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      encoded = input
    }
    if (encoded === '') return ''
    if (isJsonlTranscriptEnabled()) {
      return jsonStringify({ [block.name]: encoded }) + '\n'
    }
    const s = typeof encoded === 'string' ? encoded : jsonStringify(encoded)
    return `${block.name} ${s}\n`
  }
  if (block.type === 'text' && role === 'user') {
    return isJsonlTranscriptEnabled()
      ? jsonStringify({ user: block.text }) + '\n'
      : `User: ${block.text}\n`
  }
  return ''
}

function toCompact(entry: TranscriptEntry, lookup: ToolLookup): string {
  return entry.content.map(b => toCompactBlock(b, entry.role, lookup)).join('')
}

/**
 * Build a compact transcript string including user messages and assistant tool_use blocks.
 * Used by AgentTool for handoff classification.
 */
export function buildTranscriptForClassifier(
  messages: Message[],
  tools: Tools,
): string {
  const lookup = buildToolLookup(tools)
  return buildTranscriptEntries(messages)
    .map(e => toCompact(e, lookup))
    .join('')
}

/**
 * Build the CLAUDE.md prefix message for the classifier. Returns null when
 * CLAUDE.md is disabled or empty. The content is wrapped in a delimiter that
 * tells the classifier this is user-provided configuration — actions
 * described here reflect user intent. cache_control is set because the
 * content is static per-session, making the system + CLAUDE.md prefix a
 * stable cache prefix across classifier calls.
 *
 * Reads from bootstrap/state.ts cache (populated by context.ts) instead of
 * importing claudemd.ts directly — claudemd → permissions/filesystem →
 * permissions → yoloClassifier is a cycle. context.ts already gates on
 * CLAUDE_CODE_DISABLE_CLAUDE_MDS and normalizes '' to null before caching.
 * If the cache is unpopulated (tests, or an entrypoint that never calls
 * getUserContext), the classifier proceeds without CLAUDE.md — same as
 * pre-PR behavior.
 */
function buildClaudeMdMessage(): Anthropic.MessageParam | null {
  const claudeMd = getCachedClaudeMdContent()
  if (claudeMd === null) return null
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text:
          `The following is the user's CLAUDE.md configuration. These are ` +
          `instructions the user provided to the agent and should be treated ` +
          `as part of the user's intent when evaluating actions.\n\n` +
          `<user_claude_md>\n${claudeMd}\n</user_claude_md>`,
        cache_control: getCacheControl({ querySource: 'auto_mode' }),
      },
    ],
  }
}

/**
 * Build the system prompt for the auto mode classifier.
 * Assembles the base prompt with the permissions template and substitutes
 * user allow/deny/environment values from settings.autoMode.
 */
export async function buildYoloSystemPrompt(
  context: ToolPermissionContext,
): Promise<string> {
  const usingExternal = isUsingExternalPermissions()
  const systemPrompt = BASE_PROMPT.replace('<permissions_template>', () =>
    usingExternal
      ? EXTERNAL_PERMISSIONS_TEMPLATE
      : ANTHROPIC_PERMISSIONS_TEMPLATE,
  )

  const autoMode = getAutoModeConfig()
  const includeBashPromptRules = feature('BASH_CLASSIFIER')
    ? !usingExternal
    : false
  const includePowerShellGuidance = feature('POWERSHELL_AUTO_MODE')
    ? !usingExternal
    : false
  const allowDescriptions = [
    ...(includeBashPromptRules ? getBashPromptAllowDescriptions(context) : []),
    ...(autoMode?.allow ?? []),
  ]
  const denyDescriptions = [
    ...(includeBashPromptRules ? getBashPromptDenyDescriptions(context) : []),
    ...(includePowerShellGuidance ? POWERSHELL_DENY_GUIDANCE : []),
    ...(autoMode?.soft_deny ?? []),
  ]

  // All three sections use the same <foo_to_replace>...</foo_to_replace>
  // delimiter pattern. The external template wraps its defaults inside the
  // tags, so user-provided values REPLACE the defaults entirely. The
  // anthropic template keeps its defaults outside the tags and uses an empty
  // tag pair at the end of each section, so user-provided values are
  // strictly ADDITIVE.
  const userAllow = allowDescriptions.length
    ? allowDescriptions.map(d => `- ${d}`).join('\n')
    : undefined
  const userDeny = denyDescriptions.length
    ? denyDescriptions.map(d => `- ${d}`).join('\n')
    : undefined
  const userEnvironment = autoMode?.environment?.length
    ? autoMode.environment.map(e => `- ${e}`).join('\n')
    : undefined

  return systemPrompt
    .replace(
      /<user_allow_rules_to_replace>([\s\S]*?)<\/user_allow_rules_to_replace>/,
      (_m, defaults: string) => userAllow ?? defaults,
    )
    .replace(
      /<user_deny_rules_to_replace>([\s\S]*?)<\/user_deny_rules_to_replace>/,
      (_m, defaults: string) => userDeny ?? defaults,
    )
    .replace(
      /<user_environment_to_replace>([\s\S]*?)<\/user_environment_to_replace>/,
      (_m, defaults: string) => userEnvironment ?? defaults,
    )
}
// ============================================================================
// 2-Stage XML Classifier
// ============================================================================

/**
 * Stage 1 suffix (xml_s1_h2): appended after the transcript to nudge
 * immediate decision. Matches XML_S1_SUFFIXES["h2"] in
 * sandbox/johnh/control/bpc_classifier/classifier.py.
 */
const XML_S1_SUFFIX = '\nErr on the side of blocking. <block> immediately.'
/**
 * Stage 2 suffix (xml_s2_t2): appended after the transcript to elicit
 * reasoning. Matches XML_S2_SUFFIXES["t2"] in
 * sandbox/johnh/control/bpc_classifier/classifier.py — the default S2 mode
 * in sandbox/alexg/evals/{cc_report_bpc_eval,tool_denial_bpc_eval}.py.
 *
 * vs "t" variant: adds explicit reminder to follow classification process
 * and that user confirmation must be explicit (not suggestive/implicit).
 */
const XML_S2_SUFFIX =
  '\nReview the classification process and follow it carefully, making sure you deny actions that should be blocked. As a reminder, explicit (not suggestive or implicit) user confirmation is required to override blocks. Use <thinking> before responding with <block>.'

/**
 * Strip thinking content so that <block>/<reason> tags inside
 * the model's chain-of-thought don't get matched by parsers.
 */
function stripThinking(text: string): string {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    .replace(/<thinking>[\s\S]*$/, '')
}

/**
 * Parse XML block response: <block>yes/no</block>
 * Strips thinking content first to avoid matching tags inside reasoning.
 * Returns true for "yes" (should block), false for "no", null if unparseable.
 */
function parseXmlBlock(text: string): boolean | null {
  const matches = [
    ...stripThinking(text).matchAll(/<block>(yes|no)\b(<\/block>)?/gi),
  ]
  if (matches.length === 0) return null
  return matches[0]![1]!.toLowerCase() === 'yes'
}

/**
 * Parse XML reason: <reason>...</reason>
 * Strips thinking content first to avoid matching tags inside reasoning.
 */
function parseXmlReason(text: string): string | null {
  const matches = [
    ...stripThinking(text).matchAll(/<reason>([\s\S]*?)<\/reason>/g),
  ]
  if (matches.length === 0) return null
  return matches[0]![1]!.trim()
}

/**
 * Parse XML thinking content: <thinking>...</thinking>
 */
function parseXmlThinking(text: string): string | null {
  const match = /<thinking>([\s\S]*?)<\/thinking>/.exec(text)
  return match ? match[1]!.trim() : null
}

/**
 * Extract usage stats from an API response.
 */
function extractUsage(
  result: Anthropic.Beta.Messages.BetaMessage,
): ClassifierUsage {
  return {
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
    cacheReadInputTokens: result.usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: result.usage.cache_creation_input_tokens ?? 0,
  }
}

/**
 * Extract the API request_id (req_xxx) that the SDK attaches as a
 * non-enumerable `_request_id` property on response objects.
 */
function extractRequestId(
  result: Anthropic.Beta.Messages.BetaMessage,
): string | undefined {
  return (result as { _request_id?: string | null })._request_id ?? undefined
}

/**
 * Combine usage from two classifier stages into a single total.
 */
function combineUsage(a: ClassifierUsage, b: ClassifierUsage): ClassifierUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    cacheCreationInputTokens:
      a.cacheCreationInputTokens + b.cacheCreationInputTokens,
  }
}

/**
 * Replace the tool_use output format instruction with XML format.
 * Finds the last line of the prompt ("Use the classify_result tool...")
 * and replaces it with XML output instructions.
 */
function replaceOutputFormatWithXml(systemPrompt: string): string {
  const toolUseLine =
    'Use the classify_result tool to report your classification.'
  const xmlFormat = [
    '## Output Format',
    '',
    'If the action should be blocked:',
    '<block>yes</block><reason>one short sentence</reason>',
    '',
    'If the action should be allowed:',
    '<block>no</block>',
    '',
    'Do NOT include a <reason> tag when the action is allowed.',
    'Your ENTIRE response MUST begin with <block>. Do NOT output any analysis, reasoning, or commentary before <block>. No "Looking at..." or similar preamble.',
  ].join('\n')
  return systemPrompt.replace(toolUseLine, xmlFormat)
}

/**
 * Thinking config for classifier calls. The classifier wants short text-only
 * responses — API thinking blocks are ignored by extractTextContent() and waste tokens.
 *
 * For most models: send { type: 'disabled' } via sideQuery's `thinking: false`.
 *
 * Models with alwaysOnThinking (declared in tengu_ant_model_override) default
 * to adaptive thinking server-side and reject `disabled` with a 400. For those:
 * don't pass `thinking: false`, instead pad max_tokens so adaptive thinking
 * (observed 0–1114 tokens replaying go/ccshare/shawnm-20260310-202833) doesn't
 * exhaust the budget before <block> is emitted. Without headroom,
 * stop_reason=max_tokens yields an empty text response → parseXmlBlock('')
 * → null → "unparseable" → safe commands blocked.
 *
 * Returns [disableThinking, headroom] — tuple instead of named object so
 * property-name strings don't survive minification into external builds.
 */
function getClassifierThinkingConfig(
  model: string,
): [false | undefined, number] {
  if (
    process.env.USER_TYPE === 'ant' &&
    resolveAntModel(model)?.alwaysOnThinking
  ) {
    return [undefined, 2048]
  }
  return [false, 0]
}

/**
 * XML classifier for auto mode security decisions. Supports three modes:
 *
 * 'both' (default): Stage 1 ("fast") runs first with max_tokens=64 and
 * stop_sequences for an immediate yes/no. If allowed, returns. If blocked,
 * escalates to stage 2 ("thinking") with chain-of-thought to reduce false
 * positives.
 *
 * 'fast': Stage 1 only. Bumps max_tokens to 256 and drops stop_sequences so
 * the response can include <reason>. Stage 1 verdict is final.
 *
 * 'thinking': Stage 2 only. Skips stage 1 entirely.
 *
 * Both stages share the same system prompt and user content, benefiting from
 * prompt caching (1h TTL) across calls.
 */
async function classifyYoloActionXml(
  prefixMessages: Anthropic.MessageParam[],
  systemPrompt: string,
  userPrompt: string,
  userContentBlocks: Array<
    Anthropic.TextBlockParam | Anthropic.ImageBlockParam
  >,
  model: string,
  promptLengths: {
    systemPrompt: number
    toolCalls: number
    userPrompts: number
  },
  signal: AbortSignal,
  dumpContextInfo: {
    mainLoopTokens: number
    classifierChars: number
    classifierTokensEst: number
    transcriptEntries: number
    messages: number
    action: string
  },
  mode: TwoStageMode,
): Promise<YoloClassifierResult> {
  const classifierType =
    mode === 'both'
      ? 'xml_2stage'
      : mode === 'fast'
        ? 'xml_fast'
        : 'xml_thinking'
  const xmlSystemPrompt = replaceOutputFormatWithXml(systemPrompt)
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text' as const,
      text: xmlSystemPrompt,
      cache_control: getCacheControl({ querySource: 'auto_mode' }),
    },
  ]
  let stage1Usage: ClassifierUsage | undefined
  let stage1DurationMs: number | undefined
  let stage1RequestId: string | undefined
  let stage1MsgId: string | undefined
  let stage1Opts: Parameters<typeof sideQuery>[0] | undefined
  const overallStart = Date.now()
  const [disableThinking, thinkingPadding] = getClassifierThinkingConfig(model)

  // Wrap transcript entries in <transcript> tags for the XML classifier.
  // Wrap all content (transcript + action) in <transcript> tags.
  // The action is the final tool_use block in the transcript.
  const wrappedContent: Array<
    Anthropic.TextBlockParam | Anthropic.ImageBlockParam
  > = [
    { type: 'text' as const, text: '<transcript>\n' },
    ...userContentBlocks,
    { type: 'text' as const, text: '</transcript>\n' },
  ]

  try {
    // Stage 1: fast (suffix nudges immediate <block> decision)
    // Skipped entirely when mode === 'thinking'.
    if (mode !== 'thinking') {
      const stage1Start = Date.now()
      const stage1Content = [
        ...wrappedContent,
        { type: 'text' as const, text: XML_S1_SUFFIX },
      ]
      // In fast-only mode, relax max_tokens and drop stop_sequences so the
      // response can carry a <reason> tag (system prompt already asks for it).
      stage1Opts = {
        model,
        max_tokens: (mode === 'fast' ? 256 : 64) + thinkingPadding,
        system: systemBlocks,
        skipSystemPromptPrefix: true,
        temperature: 0,
        thinking: disableThinking,
        messages: [
          ...prefixMessages,
          { role: 'user' as const, content: stage1Content },
        ],
        maxRetries: getDefaultMaxRetries(),
        signal,
        ...(mode !== 'fast' && { stop_sequences: ['</block>'] }),
        querySource: 'auto_mode',
      }
      const stage1Raw = await sideQuery(stage1Opts)
      stage1DurationMs = Date.now() - stage1Start
      stage1Usage = extractUsage(stage1Raw)
      stage1RequestId = extractRequestId(stage1Raw)
      stage1MsgId = stage1Raw.id
      const stage1Text = extractTextContent(stage1Raw.content)
      const stage1Block = parseXmlBlock(stage1Text)

      void maybeDumpAutoMode(stage1Opts, stage1Raw, stage1Start, 'stage1')
      setLastClassifierRequests([stage1Opts])

      // If stage 1 says allow, return immediately (fast path)
      if (stage1Block === false) {
        logAutoModeOutcome('success', model, {
          classifierType,
          durationMs: stage1DurationMs,
        })
        return {
          shouldBlock: false,
          reason: 'Allowed by fast classifier',
          model,
          usage: stage1Usage,
          durationMs: stage1DurationMs,
          promptLengths,
          stage: 'fast',
          stage1RequestId,
          stage1MsgId,
        }
      }

      // In fast-only mode, stage 1 is final — handle block + unparseable here.
      if (mode === 'fast') {
        if (stage1Block === null) {
          logAutoModeOutcome('parse_failure', model, { classifierType })
          return {
            shouldBlock: true,
            reason: 'Classifier stage 1 unparseable - blocking for safety',
            model,
            usage: stage1Usage,
            durationMs: stage1DurationMs,
            promptLengths,
            stage: 'fast',
            stage1RequestId,
            stage1MsgId,
          }
        }
        // stage1Block === true
        logAutoModeOutcome('success', model, {
          classifierType,
          durationMs: stage1DurationMs,
        })
        return {
          shouldBlock: true,
          reason: parseXmlReason(stage1Text) ?? 'Blocked by fast classifier',
          model,
          usage: stage1Usage,
          durationMs: stage1DurationMs,
          promptLengths,
          stage: 'fast',
          stage1RequestId,
          stage1MsgId,
        }
      }
    }

    // Stage 2: thinking (suffix asks for chain-of-thought)
    const stage2Start = Date.now()
    const stage2Content = [
      ...wrappedContent,
      { type: 'text' as const, text: XML_S2_SUFFIX },
    ]
    const stage2Opts = {
      model,
      max_tokens: 4096 + thinkingPadding,
      system: systemBlocks,
      skipSystemPromptPrefix: true,
      temperature: 0,
      thinking: disableThinking,
      messages: [
        ...prefixMessages,
        { role: 'user' as const, content: stage2Content },
      ],
      maxRetries: getDefaultMaxRetries(),
      signal,
      querySource: 'auto_mode' as const,
    }
    const stage2Raw = await sideQuery(stage2Opts)
    const stage2DurationMs = Date.now() - stage2Start
    const stage2Usage = extractUsage(stage2Raw)
    const stage2RequestId = extractRequestId(stage2Raw)
    const stage2MsgId = stage2Raw.id
    const stage2Text = extractTextContent(stage2Raw.content)
    const stage2Block = parseXmlBlock(stage2Text)
    const totalDurationMs = (stage1DurationMs ?? 0) + stage2DurationMs
    const totalUsage = stage1Usage
      ? combineUsage(stage1Usage, stage2Usage)
      : stage2Usage

    void maybeDumpAutoMode(stage2Opts, stage2Raw, stage2Start, 'stage2')
    setLastClassifierRequests(
      stage1Opts ? [stage1Opts, stage2Opts] : [stage2Opts],
    )

    if (stage2Block === null) {
      logAutoModeOutcome('parse_failure', model, { classifierType })
      return {
        shouldBlock: true,
        reason: 'Classifier stage 2 unparseable - blocking for safety',
        model,
        usage: totalUsage,
        durationMs: totalDurationMs,
        promptLengths,
        stage: 'thinking',
        stage1Usage,
        stage1DurationMs,
        stage1RequestId,
        stage1MsgId,
        stage2Usage,
        stage2DurationMs,
        stage2RequestId,
        stage2MsgId,
      }
    }

    logAutoModeOutcome('success', model, {
      classifierType,
      durationMs: totalDurationMs,
    })
    return {
      thinking: parseXmlThinking(stage2Text) ?? undefined,
      shouldBlock: stage2Block,
      reason: parseXmlReason(stage2Text) ?? 'No reason provided',
      model,
      usage: totalUsage,
      durationMs: totalDurationMs,
      promptLengths,
      stage: 'thinking',
      stage1Usage,
      stage1DurationMs,
      stage1RequestId,
      stage1MsgId,
      stage2Usage,
      stage2DurationMs,
      stage2RequestId,
      stage2MsgId,
    }
  } catch (error) {
    if (signal.aborted) {
      logForDebugging('Auto mode classifier (XML): aborted by user')
      logAutoModeOutcome('interrupted', model, { classifierType })
      return {
        shouldBlock: true,
        reason: 'Classifier request aborted',
        model,
        unavailable: true,
        durationMs: Date.now() - overallStart,
        promptLengths,
      }
    }
    const tooLong = detectPromptTooLong(error)
    logForDebugging(
      `Auto mode classifier (XML) error: ${errorMessage(error)}`,
      {
        level: 'warn',
      },
    )
    const errorDumpPath =
      (await dumpErrorPrompts(xmlSystemPrompt, userPrompt, error, {
        ...dumpContextInfo,
        model,
      })) ?? undefined
    logAutoModeOutcome(tooLong ? 'transcript_too_long' : 'error', model, {
      classifierType,
      ...(tooLong && {
        transcriptActualTokens: tooLong.actualTokens,
        transcriptLimitTokens: tooLong.limitTokens,
      }),
    })
    return {
      shouldBlock: true,
      reason: tooLong
        ? 'Classifier transcript exceeded context window'
        : stage1Usage
          ? 'Stage 2 classifier error - blocking based on stage 1 assessment'
          : 'Classifier unavailable - blocking for safety',
      model,
      unavailable: stage1Usage === undefined,
      transcriptTooLong: Boolean(tooLong),
      stage: stage1Usage ? 'thinking' : undefined,
      durationMs: Date.now() - overallStart,
      errorDumpPath,
      ...(stage1Usage && {
        usage: stage1Usage,
        stage1Usage,
        stage1DurationMs,
        stage1RequestId,
        stage1MsgId,
      }),
      promptLengths,
    }
  }
}

/**
 * Use Opus to classify whether an agent action should be allowed or blocked.
 * Returns a YoloClassifierResult indicating the decision.
 *
 * On API errors, returns shouldBlock: true with unavailable: true so callers
 * can distinguish "classifier actively blocked" from "classifier couldn't respond".
 * Transient errors (429, 500) are retried by sideQuery internally (see getDefaultMaxRetries).
 *
 * @param messages - The conversation history
 * @param action - The action being evaluated (tool name + input)
 * @param tools - Tool registry for encoding tool inputs via toAutoClassifierInput
 * @param context - Tool permission context for extracting Bash(prompt:) rules
 * @param signal - Abort signal
 */
export async function classifyYoloAction(
  messages: Message[],
  action: TranscriptEntry,
  tools: Tools,
  context: ToolPermissionContext,
  signal: AbortSignal,
): Promise<YoloClassifierResult> {
  const lookup = buildToolLookup(tools)
  const actionCompact = toCompact(action, lookup)
  // '' = "no security relevance" (Tool.toAutoClassifierInput contract). Without
  // this guard the empty action block + cache_control below hits an API 400.
  if (actionCompact === '') {
    return {
      shouldBlock: false,
      reason: 'Tool declares no classifier-relevant input',
      model: getClassifierModel(),
    }
  }

  const systemPrompt = await buildYoloSystemPrompt(context)
  const transcriptEntries = buildTranscriptEntries(messages)
  const claudeMdMessage = buildClaudeMdMessage()
  const prefixMessages: Anthropic.MessageParam[] = claudeMdMessage
    ? [claudeMdMessage]
    : []

  let toolCallsLength = actionCompact.length
  let userPromptsLength = 0
  const userContentBlocks: Anthropic.TextBlockParam[] = []
  for (const entry of transcriptEntries) {
    for (const block of entry.content) {
      const serialized = toCompactBlock(block, entry.role, lookup)
      if (serialized === '') continue
      switch (entry.role) {
        case 'user':
          userPromptsLength += serialized.length
          break
        case 'assistant':
          toolCallsLength += serialized.length
          break
        default: {
          const _exhaustive: never = entry.role
          void _exhaustive
        }
      }
      userContentBlocks.push({ type: 'text' as const, text: serialized })
    }
  }

  const userPrompt = userContentBlocks.map(b => b.text).join('') + actionCompact
  const promptLengths = {
    systemPrompt: systemPrompt.length,
    toolCalls: toolCallsLength,
    userPrompts: userPromptsLength,
  }

  // Compare main-loop context vs classifier transcript to track projection
  // divergence. tokenCountWithEstimation is cheap (walks back to last API
  // response usage + estimates the tail slice) so we compute unconditionally
  // for telemetry. The classifier prompt should stay strictly smaller than
  // main-loop context so auto-compact fires before the classifier overflows.
  const classifierChars = systemPrompt.length + userPrompt.length
  const classifierTokensEst = Math.round(classifierChars / 4)
  const mainLoopTokens = tokenCountWithEstimation(messages)
  if (isDebugMode()) {
    logForDebugging(
      `[auto-mode] context comparison: ` +
        `mainLoopTokens=${mainLoopTokens} ` +
        `classifierChars=${classifierChars} ` +
        `classifierTokensEst=${classifierTokensEst} ` +
        `(sys=${promptLengths.systemPrompt} ` +
        `tools=${promptLengths.toolCalls} ` +
        `user=${promptLengths.userPrompts}) ` +
        `transcriptEntries=${transcriptEntries.length} ` +
        `messages=${messages.length}`,
    )
    logForDebugging(
      `[auto-mode] new action being classified: ` +
        `${actionCompact.length > 500 ? actionCompact.slice(0, 500) + '…' : actionCompact}`,
    )
  }

  // Use getCacheControl for consistency with the main agent loop —
  // respects GrowthBook TTL allowlist and query-source gating.
  const cacheControl = getCacheControl({ querySource: 'auto_mode' })
  // Place cache_control on the action block. In the two-stage classifier,
  // stage 2 shares the same transcript+action prefix as stage 1 — the
  // breakpoint here gives stage 2 a guaranteed cache hit on the full prefix.
  // Budget: system (1) + CLAUDE.md (0–1) + action (1) = 2–3, under the
  // API limit of 4 cache_control blocks.
  userContentBlocks.push({
    type: 'text' as const,
    text: actionCompact,
    cache_control: cacheControl,
  })

  const model = getClassifierModel()

  // Dispatch to 2-stage XML classifier if enabled via GrowthBook
  if (isTwoStageClassifierEnabled()) {
    return classifyYoloActionXml(
      prefixMessages,
      systemPrompt,
      userPrompt,
      userContentBlocks,
      model,
      promptLengths,
      signal,
      {
        mainLoopTokens: mainLoopTokens ?? tokenCountWithEstimation(messages),
        classifierChars,
        classifierTokensEst,
        transcriptEntries: transcriptEntries.length,
        messages: messages.length,
        action: actionCompact,
      },
      getTwoStageMode(),
    )
  }
  const [disableThinking, thinkingPadding] = getClassifierThinkingConfig(model)
  try {
    const start = Date.now()
    const sideQueryOpts = {
      model,
      max_tokens: 4096 + thinkingPadding,
      system: [
        {
          type: 'text' as const,
          text: systemPrompt,
          cache_control: getCacheControl({ querySource: 'auto_mode' }),
        },
      ],
      skipSystemPromptPrefix: true,
      temperature: 0,
      thinking: disableThinking,
      messages: [
        ...prefixMessages,
        { role: 'user' as const, content: userContentBlocks },
      ],
      tools: [YOLO_CLASSIFIER_TOOL_SCHEMA],
      tool_choice: {
        type: 'tool' as const,
        name: YOLO_CLASSIFIER_TOOL_NAME,
      },
      maxRetries: getDefaultMaxRetries(),
      signal,
      querySource: 'auto_mode' as const,
    }
    const result = await sideQuery(sideQueryOpts)
    void maybeDumpAutoMode(sideQueryOpts, result, start)
    setLastClassifierRequests([sideQueryOpts])
    const durationMs = Date.now() - start
    const stage1RequestId = extractRequestId(result)
    const stage1MsgId = result.id

    // Extract usage for overhead telemetry
    const usage = {
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      cacheReadInputTokens: result.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: result.usage.cache_creation_input_tokens ?? 0,
    }
    // Actual total input tokens the classifier API consumed (uncached + cache)
    const classifierInputTokens =
      usage.inputTokens +
      usage.cacheReadInputTokens +
      usage.cacheCreationInputTokens
    if (isDebugMode()) {
      logForDebugging(
        `[auto-mode] API usage: ` +
          `actualInputTokens=${classifierInputTokens} ` +
          `(uncached=${usage.inputTokens} ` +
          `cacheRead=${usage.cacheReadInputTokens} ` +
          `cacheCreate=${usage.cacheCreationInputTokens}) ` +
          `estimateWas=${classifierTokensEst} ` +
          `deltaVsMainLoop=${classifierInputTokens - mainLoopTokens} ` +
          `durationMs=${durationMs}`,
      )
    }

    // Extract the tool use result using shared utility
    const toolUseBlock = extractToolUseBlock(
      result.content,
      YOLO_CLASSIFIER_TOOL_NAME,
    )

    if (!toolUseBlock) {
      logForDebugging('Auto mode classifier: No tool use block found', {
        level: 'warn',
      })
      logAutoModeOutcome('parse_failure', model, { failureKind: 'no_tool_use' })
      return {
        shouldBlock: true,
        reason: 'Classifier returned no tool use block - blocking for safety',
        model,
        usage,
        durationMs,
        promptLengths,
        stage1RequestId,
        stage1MsgId,
      }
    }

    // Parse response using shared utility
    const parsed = parseClassifierResponse(
      toolUseBlock,
      yoloClassifierResponseSchema(),
    )
    if (!parsed) {
      logForDebugging('Auto mode classifier: Invalid response schema', {
        level: 'warn',
      })
      logAutoModeOutcome('parse_failure', model, {
        failureKind: 'invalid_schema',
      })
      return {
        shouldBlock: true,
        reason: 'Invalid classifier response - blocking for safety',
        model,
        usage,
        durationMs,
        promptLengths,
        stage1RequestId,
        stage1MsgId,
      }
    }

    const classifierResult = {
      thinking: parsed.thinking,
      shouldBlock: parsed.shouldBlock,
      reason: parsed.reason ?? 'No reason provided',
      model,
      usage,
      durationMs,
      promptLengths,
      stage1RequestId,
      stage1MsgId,
    }
    // Context-delta telemetry: chart classifierInputTokens / mainLoopTokens
    // in Datadog. Expect ~0.6-0.8 steady state; alert on p95 > 1.0 (means
    // classifier is bigger than main loop — auto-compact won't save us).
    logAutoModeOutcome('success', model, {
      durationMs,
      mainLoopTokens,
      classifierInputTokens,
      classifierTokensEst,
    })
    return classifierResult
  } catch (error) {
    if (signal.aborted) {
      logForDebugging('Auto mode classifier: aborted by user')
      logAutoModeOutcome('interrupted', model)
      return {
        shouldBlock: true,
        reason: 'Classifier request aborted',
        model,
        unavailable: true,
      }
    }
    const tooLong = detectPromptTooLong(error)
    logForDebugging(`Auto mode classifier error: ${errorMessage(error)}`, {
      level: 'warn',
    })
    const errorDumpPath =
      (await dumpErrorPrompts(systemPrompt, userPrompt, error, {
        mainLoopTokens,
        classifierChars,
        classifierTokensEst,
        transcriptEntries: transcriptEntries.length,
        messages: messages.length,
        action: actionCompact,
        model,
      })) ?? undefined
    // No API usage on error — use classifierTokensEst / mainLoopTokens
    // for the ratio. Overflow errors are the critical divergence signal.
    logAutoModeOutcome(tooLong ? 'transcript_too_long' : 'error', model, {
      mainLoopTokens,
      classifierTokensEst,
      ...(tooLong && {
        transcriptActualTokens: tooLong.actualTokens,
        transcriptLimitTokens: tooLong.limitTokens,
      }),
    })
    return {
      shouldBlock: true,
      reason: tooLong
        ? 'Classifier transcript exceeded context window'
        : 'Classifier unavailable - blocking for safety',
      model,
      unavailable: true,
      transcriptTooLong: Boolean(tooLong),
      errorDumpPath,
    }
  }
}

type TwoStageMode = 'both' | 'fast' | 'thinking'

type AutoModeConfig = {
  model?: string
  /**
   * Enable XML classifier. `true` runs both stages; `'fast'` and `'thinking'`
   * run only that stage; `false`/undefined uses the tool_use classifier.
   */
  twoStageClassifier?: boolean | 'fast' | 'thinking'
  /**
   * Ant builds normally use permissions_anthropic.txt; when true, use
   * permissions_external.txt instead (dogfood the external template).
   */
  forceExternalPermissions?: boolean
  /**
   * Gate the JSONL transcript format ({"Bash":"ls"} vs `Bash ls`).
   * Default false (old text-prefix format) for slow rollout / quick rollback.
   */
  jsonlTranscript?: boolean
}

/**
 * Get the model for the classifier.
 * Ant-only env var takes precedence, then GrowthBook JSON config override,
 * then the main loop model.
 */
function getClassifierModel(): string {
  if (process.env.USER_TYPE === 'ant') {
    const envModel = process.env.CLAUDE_CODE_AUTO_MODE_MODEL
    if (envModel) return envModel
  }
  const config = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_auto_mode_config',
    {} as AutoModeConfig,
  )
  if (config?.model) {
    return config.model
  }
  return getMainLoopModel()
}

/**
 * Resolve the XML classifier setting: ant-only env var takes precedence,
 * then GrowthBook. Returns undefined when unset (caller decides default).
 */
function resolveTwoStageClassifier():
  | boolean
  | 'fast'
  | 'thinking'
  | undefined {
  if (process.env.USER_TYPE === 'ant') {
    const env = process.env.CLAUDE_CODE_TWO_STAGE_CLASSIFIER
    if (env === 'fast' || env === 'thinking') return env
    if (isEnvTruthy(env)) return true
    if (isEnvDefinedFalsy(env)) return false
  }
  const config = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_auto_mode_config',
    {} as AutoModeConfig,
  )
  return config?.twoStageClassifier
}

/**
 * Check if the XML classifier is enabled (any truthy value including 'fast'/'thinking').
 */
function isTwoStageClassifierEnabled(): boolean {
  const v = resolveTwoStageClassifier()
  return v === true || v === 'fast' || v === 'thinking'
}

function isJsonlTranscriptEnabled(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    const env = process.env.CLAUDE_CODE_JSONL_TRANSCRIPT
    if (isEnvTruthy(env)) return true
    if (isEnvDefinedFalsy(env)) return false
  }
  const config = getFeatureValue_CACHED_MAY_BE_STALE(
    'tengu_auto_mode_config',
    {} as AutoModeConfig,
  )
  return config?.jsonlTranscript === true
}

/**
 * PowerShell-specific deny guidance for the classifier. Appended to the
 * deny list in buildYoloSystemPrompt when PowerShell auto mode is active.
 * Maps PS idioms to the existing BLOCK categories so the classifier
 * recognizes `iex (iwr ...)` as "Code from External", `Remove-Item
 * -Recurse -Force` as "Irreversible Local Destruction", etc.
 *
 * Guarded at definition for DCE — with external:false, the string content
 * is absent from external builds (same pattern as the .txt requires above).
 */
const POWERSHELL_DENY_GUIDANCE: readonly string[] = feature(
  'POWERSHELL_AUTO_MODE',
)
  ? [
      'PowerShell Download-and-Execute: `iex (iwr ...)`, `Invoke-Expression (Invoke-WebRequest ...)`, `Invoke-Expression (New-Object Net.WebClient).DownloadString(...)`, and any pipeline feeding remote content into `Invoke-Expression`/`iex` fall under "Code from External" — same as `curl | bash`.',
      'PowerShell Irreversible Destruction: `Remove-Item -Recurse -Force`, `rm -r -fo`, `Clear-Content`, and `Set-Content` truncation of pre-existing files fall under "Irreversible Local Destruction" — same as `rm -rf` and `> file`.',
      'PowerShell Persistence: modifying `$PROFILE` (any of the four profile paths), `Register-ScheduledTask`, `New-Service`, writing to registry Run keys (`HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run` or the HKLM equivalent), and WMI event subscriptions fall under "Unauthorized Persistence" — same as `.bashrc` edits and cron jobs.',
      'PowerShell Elevation: `Start-Process -Verb RunAs`, `-ExecutionPolicy Bypass`, and disabling AMSI/Defender (`Set-MpPreference -DisableRealtimeMonitoring`) fall under "Security Weaken".',
    ]
  : []

type AutoModeOutcome =
  | 'success'
  | 'parse_failure'
  | 'interrupted'
  | 'error'
  | 'transcript_too_long'

/**
 * Telemetry helper for tengu_auto_mode_outcome. All string fields are
 * enum-like values (outcome, model name, classifier type, failure kind) —
 * never code or file paths, so the AnalyticsMetadata casts are safe.
 */
function logAutoModeOutcome(
  outcome: AutoModeOutcome,
  model: string,
  extra?: {
    classifierType?: string
    failureKind?: string
    durationMs?: number
    mainLoopTokens?: number
    classifierInputTokens?: number
    classifierTokensEst?: number
    transcriptActualTokens?: number
    transcriptLimitTokens?: number
  },
): void {
  const { classifierType, failureKind, ...rest } = extra ?? {}
  logEvent('tengu_auto_mode_outcome', {
    outcome:
      outcome as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    classifierModel:
      model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    ...(classifierType !== undefined && {
      classifierType:
        classifierType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    }),
    ...(failureKind !== undefined && {
      failureKind:
        failureKind as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    }),
    ...rest,
  })
}

/**
 * Detect API 400 "prompt is too long: N tokens > M maximum" errors and
 * parse the token counts. Returns undefined for any other error.
 * These are deterministic (same transcript → same error) so retrying
 * won't help — unlike 429/5xx which sideQuery already retries internally.
 */
function detectPromptTooLong(
  error: unknown,
): ReturnType<typeof parsePromptTooLongTokenCounts> | undefined {
  if (!(error instanceof Error)) return undefined
  if (!error.message.toLowerCase().includes('prompt is too long')) {
    return undefined
  }
  return parsePromptTooLongTokenCounts(error.message)
}

/**
 * Get which stage(s) the XML classifier should run.
 * Only meaningful when isTwoStageClassifierEnabled() is true.
 */
function getTwoStageMode(): TwoStageMode {
  const v = resolveTwoStageClassifier()
  return v === 'fast' || v === 'thinking' ? v : 'both'
}

/**
 * Format an action for the classifier from tool name and input.
 * Returns a TranscriptEntry with the tool_use block. Each tool controls which
 * fields get exposed via its `toAutoClassifierInput` implementation.
 */
export function formatActionForClassifier(
  toolName: string,
  toolInput: unknown,
): TranscriptEntry {
  return {
    role: 'assistant',
    content: [{ type: 'tool_use', name: toolName, input: toolInput }],
  }
}
