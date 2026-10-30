import { randomUUID } from 'crypto'
import { rm } from 'fs'
import { appendFile, copyFile, mkdir } from 'fs/promises'
import { dirname, isAbsolute, join, relative } from 'path'
import { getCwdState } from '../../bootstrap/state.js'
import type { CompletionBoundary } from '../../state/AppStateStore.js'
import {
  type AppState,
  IDLE_SPECULATION_STATE,
  type SpeculationResult,
  type SpeculationState,
} from '../../state/AppStateStore.js'
import { commandHasAnyCd } from '../../tools/BashTool/bashPermissions.js'
import { checkReadOnlyConstraints } from '../../tools/BashTool/readOnlyValidation.js'
import type { SpeculationAcceptMessage } from '../../types/logs.js'
import type { Message } from '../../types/message.js'
import { createChildAbortController } from '../../utils/abortController.js'
import { count } from '../../utils/array.js'
import { getGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { errorMessage } from '../../utils/errors.js'
import {
  type FileStateCache,
  mergeFileStateCaches,
  READ_FILE_STATE_CACHE_SIZE,
} from '../../utils/fileStateCache.js'
import {
  type CacheSafeParams,
  createCacheSafeParams,
  runForkedAgent,
} from '../../utils/forkedAgent.js'
import { formatDuration, formatNumber } from '../../utils/format.js'
import type { REPLHookContext } from '../../utils/hooks/postSamplingHooks.js'
import { logError } from '../../utils/log.js'
import type { SetAppState } from '../../utils/messageQueueManager.js'
import {
  createSystemMessage,
  createUserMessage,
  INTERRUPT_MESSAGE,
  INTERRUPT_MESSAGE_FOR_TOOL_USE,
} from '../../utils/messages.js'
import { getClaudeTempDir } from '../../utils/permissions/filesystem.js'
import { extractReadFilesFromMessages } from '../../utils/queryHelpers.js'
import { getTranscriptPath } from '../../utils/sessionStorage.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../analytics/index.js'
import {
  generateSuggestion,
  getPromptVariant,
  getSuggestionSuppressReason,
  logSuggestionSuppressed,
  shouldFilterSuggestion,
} from './promptSuggestion.js'

const MAX_SPECULATION_TURNS = 20
const MAX_SPECULATION_MESSAGES = 100

const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit'])
const SAFE_READ_ONLY_TOOLS = new Set([
  'Read',
  'Glob',
  'Grep',
  'ToolSearch',
  'LSP',
  'TaskGet',
  'TaskList',
])

function safeRemoveOverlay(overlayPath: string): void {
  rm(
    overlayPath,
    { recursive: true, force: true, maxRetries: 3, retryDelay: 100 },
    () => {},
  )
}

function getOverlayPath(id: string): string {
  return join(getClaudeTempDir(), 'speculation', String(process.pid), id)
}

function denySpeculation(
  message: string,
  reason: string,
): {
  behavior: 'deny'
  message: string
  decisionReason: { type: 'other'; reason: string }
} {
  return {
    behavior: 'deny',
    message,
    decisionReason: { type: 'other', reason },
  }
}

async function copyOverlayToMain(
  overlayPath: string,
  writtenPaths: Set<string>,
  cwd: string,
): Promise<boolean> {
  let allCopied = true
  for (const rel of writtenPaths) {
    const src = join(overlayPath, rel)
    const dest = join(cwd, rel)
    try {
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(src, dest)
    } catch {
      allCopied = false
      logForDebugging(`[Speculation] Failed to copy ${rel} to main`)
    }
  }
  return allCopied
}

export type ActiveSpeculationState = Extract<
  SpeculationState,
  { status: 'active' }
>

function logSpeculation(
  id: string,
  outcome: 'accepted' | 'aborted' | 'error',
  startTime: number,
  suggestionLength: number,
  messages: Message[],
  boundary: CompletionBoundary | null,
  extras?: Record<string, string | number | boolean | undefined>,
): void {
  logEvent('tengu_speculation', {
    speculation_id:
      id as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    outcome:
      outcome as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    duration_ms: Date.now() - startTime,
    suggestion_length: suggestionLength,
    tools_executed: countToolsInMessages(messages),
    completed: boundary !== null,
    boundary_type: boundary?.type as
      | AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      | undefined,
    boundary_tool: getBoundaryTool(boundary) as
      | AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      | undefined,
    boundary_detail: getBoundaryDetail(boundary) as
      | AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      | undefined,
    ...extras,
  })
}

function countToolsInMessages(messages: Message[]): number {
  const blocks = messages
    .filter(isUserMessageWithArrayContent)
    .flatMap(m => m.message.content)
    .filter(
      (b): b is { type: string; is_error?: boolean } =>
        typeof b === 'object' && b !== null && 'type' in b,
    )
  return count(blocks, b => b.type === 'tool_result' && !b.is_error)
}

function getBoundaryTool(
  boundary: CompletionBoundary | null,
): string | undefined {
  if (!boundary) return undefined
  switch (boundary.type) {
    case 'bash':
      return 'Bash'
    case 'edit':
    case 'denied_tool':
      return boundary.toolName
    case 'complete':
      return undefined
  }
}

function getBoundaryDetail(
  boundary: CompletionBoundary | null,
): string | undefined {
  if (!boundary) return undefined
  switch (boundary.type) {
    case 'bash':
      return boundary.command.slice(0, 200)
    case 'edit':
      return boundary.filePath
    case 'denied_tool':
      return boundary.detail
    case 'complete':
      return undefined
  }
}

function isUserMessageWithArrayContent(
  m: Message,
): m is Message & { message: { content: unknown[] } } {
  return m.type === 'user' && 'message' in m && Array.isArray(m.message.content)
}

export function prepareMessagesForInjection(messages: Message[]): Message[] {
  // Find tool_use IDs that have SUCCESSFUL results (not errors/interruptions)
  // Pending tool_use blocks (no result) and interrupted ones will be stripped
  type ToolResult = {
    type: 'tool_result'
    tool_use_id: string
    is_error?: boolean
    content?: unknown
  }
  const isToolResult = (b: unknown): b is ToolResult =>
    typeof b === 'object' &&
    b !== null &&
    (b as ToolResult).type === 'tool_result' &&
    typeof (b as ToolResult).tool_use_id === 'string'
  const isSuccessful = (b: ToolResult) =>
    !b.is_error &&
    !(
      typeof b.content === 'string' &&
      b.content.includes(INTERRUPT_MESSAGE_FOR_TOOL_USE)
    )

  const toolIdsWithSuccessfulResults = new Set(
    messages
      .filter(isUserMessageWithArrayContent)
      .flatMap(m => m.message.content)
      .filter(isToolResult)
      .filter(isSuccessful)
      .map(b => b.tool_use_id),
  )

  const keep = (b: {
    type: string
    id?: string
    tool_use_id?: string
    text?: string
  }) =>
    b.type !== 'thinking' &&
    b.type !== 'redacted_thinking' &&
    !(b.type === 'tool_use' && !toolIdsWithSuccessfulResults.has(b.id!)) &&
    !(
      b.type === 'tool_result' &&
      !toolIdsWithSuccessfulResults.has(b.tool_use_id!)
    ) &&
    // Abort during speculation yields a standalone interrupt user message
    // (query.ts createUserInterruptionMessage). Strip it so it isn't surfaced
    // to the model as real user input.
    !(
      b.type === 'text' &&
      (b.text === INTERRUPT_MESSAGE ||
        b.text === INTERRUPT_MESSAGE_FOR_TOOL_USE)
    )

  return messages
    .map(msg => {
      if (!('message' in msg) || !Array.isArray(msg.message.content)) return msg
      const content = msg.message.content.filter(keep)
      if (content.length === msg.message.content.length) return msg
      if (content.length === 0) return null
      // Drop messages where all remaining blocks are whitespace-only text
      // (API rejects these with 400: "text content blocks must contain non-whitespace text")
      const hasNonWhitespaceContent = content.some(
        (b: { type: string; text?: string }) =>
          b.type !== 'text' || (b.text !== undefined && b.text.trim() !== ''),
      )
      if (!hasNonWhitespaceContent) return null
      return { ...msg, message: { ...msg.message, content } } as typeof msg
    })
    .filter((m): m is Message => m !== null)
}

function createSpeculationFeedbackMessage(
  messages: Message[],
  boundary: CompletionBoundary | null,
  timeSavedMs: number,
  sessionTotalMs: number,
): Message | null {
  if (process.env.USER_TYPE !== 'ant') return null

  if (messages.length === 0 || timeSavedMs === 0) return null

  const toolUses = countToolsInMessages(messages)
  const tokens = boundary?.type === 'complete' ? boundary.outputTokens : null

  const parts = []
  if (toolUses > 0) {
    parts.push(`Speculated ${toolUses} tool ${toolUses === 1 ? 'use' : 'uses'}`)
  } else {
    const turns = messages.length
    parts.push(`Speculated ${turns} ${turns === 1 ? 'turn' : 'turns'}`)
  }

  if (tokens !== null) {
    parts.push(`${formatNumber(tokens)} tokens`)
  }

  const savedText = `+${formatDuration(timeSavedMs)} saved`
  const sessionSuffix =
    sessionTotalMs !== timeSavedMs
      ? ` (${formatDuration(sessionTotalMs)} this session)`
      : ''

  return createSystemMessage(
    `[ANT-ONLY] ${parts.join(' · ')} · ${savedText}${sessionSuffix}`,
    'warning',
  )
}

function updateActiveSpeculationState(
  setAppState: SetAppState,
  updater: (state: ActiveSpeculationState) => Partial<ActiveSpeculationState>,
): void {
  setAppState(prev => {
    if (prev.speculation.status !== 'active') return prev
    const current = prev.speculation as ActiveSpeculationState
    const updates = updater(current)
    // Check if any values actually changed to avoid unnecessary re-renders
    const hasChanges = Object.entries(updates).some(
      ([key, value]) => current[key as keyof ActiveSpeculationState] !== value,
    )
    if (!hasChanges) return prev
    return {
      ...prev,
      speculation: { ...current, ...updates },
    }
  })
}

function resetSpeculationState(setAppState: SetAppState): void {
  setAppState(prev => {
    if (prev.speculation.status === 'idle') return prev
    return { ...prev, speculation: IDLE_SPECULATION_STATE }
  })
}

export function isSpeculationEnabled(): boolean {
  const enabled =
    process.env.USER_TYPE === 'ant' &&
    (getGlobalConfig().speculationEnabled ?? true)
  logForDebugging(`[Speculation] enabled=${enabled}`)
  return enabled
}

async function generatePipelinedSuggestion(
  context: REPLHookContext,
  suggestionText: string,
  speculatedMessages: Message[],
  setAppState: SetAppState,
  parentAbortController: AbortController,
): Promise<void> {
  try {
    const appState = context.toolUseContext.getAppState()
    const suppressReason = getSuggestionSuppressReason(appState)
    if (suppressReason) {
      logSuggestionSuppressed(`pipeline_${suppressReason}`)
      return
    }

    const augmentedContext: REPLHookContext = {
      ...context,
      messages: [
        ...context.messages,
        createUserMessage({ content: suggestionText }),
        ...speculatedMessages,
      ],
    }

    const pipelineAbortController = createChildAbortController(
      parentAbortController,
    )
    if (pipelineAbortController.signal.aborted) return

    const promptId = getPromptVariant()
    const { suggestion, generationRequestId } = await generateSuggestion(
      pipelineAbortController,
      promptId,
      createCacheSafeParams(augmentedContext),
    )

    if (pipelineAbortController.signal.aborted) return
    if (shouldFilterSuggestion(suggestion, promptId)) return

    logForDebugging(
      `[Speculation] Pipelined suggestion: "${suggestion!.slice(0, 50)}..."`,
    )
    updateActiveSpeculationState(setAppState, () => ({
      pipelinedSuggestion: {
        text: suggestion!,
        promptId,
        generationRequestId,
      },
    }))
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    logForDebugging(
      `[Speculation] Pipelined suggestion failed: ${errorMessage(error)}`,
    )
  }
}

export async function startSpeculation(
  suggestionText: string,
  context: REPLHookContext,
  setAppState: (f: (prev: AppState) => AppState) => void,
  isPipelined = false,
  cacheSafeParams?: CacheSafeParams,
): Promise<void> {
  if (!isSpeculationEnabled()) return

  // Abort any existing speculation before starting a new one
  abortSpeculation(setAppState)

  const id = randomUUID().slice(0, 8)

  const abortController = createChildAbortController(
    context.toolUseContext.abortController,
  )

  if (abortController.signal.aborted) return

  const startTime = Date.now()
  const messagesRef = { current: [] as Message[] }
  const writtenPathsRef = { current: new Set<string>() }
  const overlayPath = getOverlayPath(id)
  const cwd = getCwdState()

  try {
    await mkdir(overlayPath, { recursive: true })
  } catch {
    logForDebugging('[Speculation] Failed to create overlay directory')
    return
  }

  const contextRef = { current: context }

  setAppState(prev => ({
    ...prev,
    speculation: {
      status: 'active',
      id,
      abort: () => abortController.abort(),
      startTime,
      messagesRef,
      writtenPathsRef,
      boundary: null,
      suggestionLength: suggestionText.length,
      toolUseCount: 0,
      isPipelined,
      contextRef,
    },
  }))

  logForDebugging(`[Speculation] Starting speculation ${id}`)

  try {
    const result = await runForkedAgent({
      promptMessages: [createUserMessage({ content: suggestionText })],
      cacheSafeParams: cacheSafeParams ?? createCacheSafeParams(context),
      skipTranscript: true,
      canUseTool: async (tool, input) => {
        const isWriteTool = WRITE_TOOLS.has(tool.name)
        const isSafeReadOnlyTool = SAFE_READ_ONLY_TOOLS.has(tool.name)

        // Check permission mode BEFORE allowing file edits
        if (isWriteTool) {
          const appState = context.toolUseContext.getAppState()
          const { mode, isBypassPermissionsModeAvailable } =
            appState.toolPermissionContext

          const canAutoAcceptEdits =
            mode === 'acceptEdits' ||
            mode === 'bypassPermissions' ||
            (mode === 'plan' && isBypassPermissionsModeAvailable)

          if (!canAutoAcceptEdits) {
            logForDebugging(`[Speculation] Stopping at file edit: ${tool.name}`)
            const editPath = (
              'file_path' in input ? input.file_path : undefined
            ) as string | undefined
            updateActiveSpeculationState(setAppState, () => ({
              boundary: {
                type: 'edit',
                toolName: tool.name,
                filePath: editPath ?? '',
                completedAt: Date.now(),
              },
            }))
            abortController.abort()
            return denySpeculation(
              'Speculation paused: file edit requires permission',
              'speculation_edit_boundary',
            )
          }
        }

        // Handle file path rewriting for overlay isolation
        if (isWriteTool || isSafeReadOnlyTool) {
          const pathKey =
            'notebook_path' in input
              ? 'notebook_path'
              : 'path' in input
                ? 'path'
                : 'file_path'
          const filePath = input[pathKey] as string | undefined
          if (filePath) {
            const rel = relative(cwd, filePath)
            if (isAbsolute(rel) || rel.startsWith('..')) {
              if (isWriteTool) {
                logForDebugging(
                  `[Speculation] Denied ${tool.name}: path outside cwd: ${filePath}`,
                )
                return denySpeculation(
                  'Write outside cwd not allowed during speculation',
                  'speculation_write_outside_root',
                )
              }
              return {
                behavior: 'allow' as const,
                updatedInput: input,
                decisionReason: {
                  type: 'other' as const,
                  reason: 'speculation_read_outside_root',
                },
              }
            }

            if (isWriteTool) {
              // Copy-on-write: copy original to overlay if not yet there
              if (!writtenPathsRef.current.has(rel)) {
                const overlayFile = join(overlayPath, rel)
                await mkdir(dirname(overlayFile), { recursive: true })
                try {
                  await copyFile(join(cwd, rel), overlayFile)
                } catch {
                  // Original may not exist (new file creation) - that's fine
                }
                writtenPathsRef.current.add(rel)
              }
              input = { ...input, [pathKey]: join(overlayPath, rel) }
            } else {
              // Read: redirect to overlay if file was previously written
              if (writtenPathsRef.current.has(rel)) {
                input = { ...input, [pathKey]: join(overlayPath, rel) }
              }
              // Otherwise read from main (no rewrite)
            }

            logForDebugging(
              `[Speculation] ${isWriteTool ? 'Write' : 'Read'} ${filePath} -> ${input[pathKey]}`,
            )

            return {
              behavior: 'allow' as const,
              updatedInput: input,
              decisionReason: {
                type: 'other' as const,
                reason: 'speculation_file_access',
              },
            }
          }
          // Read tools without explicit path (e.g. Glob/Grep defaulting to CWD) are safe
          if (isSafeReadOnlyTool) {
            return {
              behavior: 'allow' as const,
              updatedInput: input,
              decisionReason: {
                type: 'other' as const,
                reason: 'speculation_read_default_cwd',
              },
            }
          }
          // Write tools with undefined path → fall through to default deny
        }

        // Stop at non-read-only bash commands
        if (tool.name === 'Bash') {
          const command =
            'command' in input && typeof input.command === 'string'
              ? input.command
              : ''
          if (
            !command ||
            checkReadOnlyConstraints({ command }, commandHasAnyCd(command))
              .behavior !== 'allow'
          ) {
            logForDebugging(
              `[Speculation] Stopping at bash: ${command.slice(0, 50) || 'missing command'}`,
            )
            updateActiveSpeculationState(setAppState, () => ({
              boundary: { type: 'bash', command, completedAt: Date.now() },
            }))
            abortController.abort()
            return denySpeculation(
              'Speculation paused: bash boundary',
              'speculation_bash_boundary',
            )
          }
          // Read-only bash command — allow during speculation
          return {
            behavior: 'allow' as const,
            updatedInput: input,
            decisionReason: {
              type: 'other' as const,
              reason: 'speculation_readonly_bash',
            },
          }
        }

        // Deny all other tools by default
        logForDebugging(`[Speculation] Stopping at denied tool: ${tool.name}`)
        const detail = String(
          ('url' in input && input.url) ||
            ('file_path' in input && input.file_path) ||
            ('path' in input && input.path) ||
            ('command' in input && input.command) ||
            '',
        ).slice(0, 200)
        updateActiveSpeculationState(setAppState, () => ({
          boundary: {
            type: 'denied_tool',
            toolName: tool.name,
            detail,
            completedAt: Date.now(),
          },
        }))
        abortController.abort()
        return denySpeculation(
          `Tool ${tool.name} not allowed during speculation`,
          'speculation_unknown_tool',
        )
      },
      querySource: 'speculation',
      forkLabel: 'speculation',
      maxTurns: MAX_SPECULATION_TURNS,
      overrides: { abortController, requireCanUseTool: true },
      onMessage: msg => {
        if (msg.type === 'assistant' || msg.type === 'user') {
          messagesRef.current.push(msg)
          if (messagesRef.current.length >= MAX_SPECULATION_MESSAGES) {
            abortController.abort()
          }
          if (isUserMessageWithArrayContent(msg)) {
            const newTools = count(
              msg.message.content as { type: string; is_error?: boolean }[],
              b => b.type === 'tool_result' && !b.is_error,
            )
            if (newTools > 0) {
              updateActiveSpeculationState(setAppState, prev => ({
                toolUseCount: prev.toolUseCount + newTools,
              }))
            }
          }
        }
      },
    })

    if (abortController.signal.aborted) return

    updateActiveSpeculationState(setAppState, () => ({
      boundary: {
        type: 'complete' as const,
        completedAt: Date.now(),
        outputTokens: result.totalUsage.output_tokens,
      },
    }))

    logForDebugging(
      `[Speculation] Complete: ${countToolsInMessages(messagesRef.current)} tools`,
    )

    // Pipeline: generate the next suggestion while we wait for the user to accept
    void generatePipelinedSuggestion(
      contextRef.current,
      suggestionText,
      messagesRef.current,
      setAppState,
      abortController,
    )
  } catch (error) {
    abortController.abort()

    if (error instanceof Error && error.name === 'AbortError') {
      safeRemoveOverlay(overlayPath)
      resetSpeculationState(setAppState)
      return
    }

    safeRemoveOverlay(overlayPath)

    // eslint-disable-next-line no-restricted-syntax -- custom fallback message, not toError(e)
    logError(error instanceof Error ? error : new Error('Speculation failed'))

    logSpeculation(
      id,
      'error',
      startTime,
      suggestionText.length,
      messagesRef.current,
      null,
      {
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: errorMessage(error).slice(
          0,
          200,
        ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        error_phase:
          'start' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        is_pipelined: isPipelined,
      },
    )

    resetSpeculationState(setAppState)
  }
}

export async function acceptSpeculation(
  state: SpeculationState,
  setAppState: (f: (prev: AppState) => AppState) => void,
  cleanMessageCount: number,
): Promise<SpeculationResult | null> {
  if (state.status !== 'active') return null

  const {
    id,
    messagesRef,
    writtenPathsRef,
    abort,
    startTime,
    suggestionLength,
    isPipelined,
  } = state
  const messages = messagesRef.current
  const overlayPath = getOverlayPath(id)
  const acceptedAt = Date.now()

  abort()

  if (cleanMessageCount > 0) {
    await copyOverlayToMain(overlayPath, writtenPathsRef.current, getCwdState())
  }
  safeRemoveOverlay(overlayPath)

  // Use snapshot boundary as default (available since state.status === 'active' was checked above)
  let boundary: CompletionBoundary | null = state.boundary
  let timeSavedMs =
    Math.min(acceptedAt, boundary?.completedAt ?? Infinity) - startTime

  setAppState(prev => {
    // Refine with latest React state if speculation is still active
    if (prev.speculation.status === 'active' && prev.speculation.boundary) {
      boundary = prev.speculation.boundary
      const endTime = Math.min(acceptedAt, boundary.completedAt ?? Infinity)
      timeSavedMs = endTime - startTime
    }
    return {
      ...prev,
      speculation: IDLE_SPECULATION_STATE,
      speculationSessionTimeSavedMs:
        prev.speculationSessionTimeSavedMs + timeSavedMs,
    }
  })

  logForDebugging(
    boundary === null
      ? `[Speculation] Accept ${id}: still running, using ${messages.length} messages`
      : `[Speculation] Accept ${id}: already complete`,
  )

  logSpeculation(
    id,
    'accepted',
    startTime,
    suggestionLength,
    messages,
    boundary,
    {
      message_count: messages.length,
      time_saved_ms: timeSavedMs,
      is_pipelined: isPipelined,
    },
  )

  if (timeSavedMs > 0) {
    const entry: SpeculationAcceptMessage = {
      type: 'speculation-accept',
      timestamp: new Date().toISOString(),
      timeSavedMs,
    }
    void appendFile(getTranscriptPath(), jsonStringify(entry) + '\n', {
      mode: 0o600,
    }).catch(() => {
      logForDebugging(
        '[Speculation] Failed to write speculation-accept to transcript',
      )
    })
  }

  return { messages, boundary, timeSavedMs }
}

export function abortSpeculation(setAppState: SetAppState): void {
  setAppState(prev => {
    if (prev.speculation.status !== 'active') return prev

    const {
      id,
      abort,
      startTime,
      boundary,
      suggestionLength,
      messagesRef,
      isPipelined,
    } = prev.speculation

    logForDebugging(`[Speculation] Aborting ${id}`)

    logSpeculation(
      id,
      'aborted',
      startTime,
      suggestionLength,
      messagesRef.current,
      boundary,
      { abort_reason: 'user_typed', is_pipelined: isPipelined },
    )

    abort()
    safeRemoveOverlay(getOverlayPath(id))

    return { ...prev, speculation: IDLE_SPECULATION_STATE }
  })
}

export async function handleSpeculationAccept(
  speculationState: ActiveSpeculationState,
  speculationSessionTimeSavedMs: number,
  setAppState: SetAppState,
  input: string,
  deps: {
    setMessages: (f: (prev: Message[]) => Message[]) => void
    readFileState: { current: FileStateCache }
    cwd: string
  },
): Promise<{ queryRequired: boolean }> {
  try {
    const { setMessages, readFileState, cwd } = deps

    // Clear prompt suggestion state. logOutcomeAtSubmission logged the accept
    // but was called with skipReset to avoid aborting speculation before we use it.
    setAppState(prev => {
      if (
        prev.promptSuggestion.text === null &&
        prev.promptSuggestion.promptId === null
      ) {
        return prev
      }
      return {
        ...prev,
        promptSuggestion: {
          text: null,
          promptId: null,
          shownAt: 0,
          acceptedAt: 0,
          generationRequestId: null,
        },
      }
    })

    // Capture speculation messages before any state updates - must be stable reference
    const speculationMessages = speculationState.messagesRef.current
    let cleanMessages = prepareMessagesForInjection(speculationMessages)

    // Inject user message first for instant visual feedback before any async work
    const userMessage = createUserMessage({ content: input })
    setMessages(prev => [...prev, userMessage])

    const result = await acceptSpeculation(
      speculationState,
      setAppState,
      cleanMessages.length,
    )

    const isComplete = result?.boundary?.type === 'complete'

    // When speculation didn't complete, the follow-up query needs the
    // conversation to end with a user message. Drop trailing assistant
    // messages — models that don't support prefill
    // reject conversations ending with an assistant turn. The model will
    // regenerate this content in the follow-up query.
    if (!isComplete) {
      const lastNonAssistant = cleanMessages.findLastIndex(
        m => m.type !== 'assistant',
      )
      cleanMessages = cleanMessages.slice(0, lastNonAssistant + 1)
    }

    const timeSavedMs = result?.timeSavedMs ?? 0
    const newSessionTotal = speculationSessionTimeSavedMs + timeSavedMs
    const feedbackMessage = createSpeculationFeedbackMessage(
      cleanMessages,
      result?.boundary ?? null,
      timeSavedMs,
      newSessionTotal,
    )

    // Inject speculated messages
    setMessages(prev => [...prev, ...cleanMessages])

    const extracted = extractReadFilesFromMessages(
      cleanMessages,
      cwd,
      READ_FILE_STATE_CACHE_SIZE,
    )
    readFileState.current = mergeFileStateCaches(
      readFileState.current,
      extracted,
    )

    if (feedbackMessage) {
      setMessages(prev => [...prev, feedbackMessage])
    }

    logForDebugging(
      `[Speculation] ${result?.boundary?.type ?? 'incomplete'}, injected ${cleanMessages.length} messages`,
    )

    // Promote pipelined suggestion if speculation completed fully
    if (isComplete && speculationState.pipelinedSuggestion) {
      const { text, promptId, generationRequestId } =
        speculationState.pipelinedSuggestion
      logForDebugging(
        `[Speculation] Promoting pipelined suggestion: "${text.slice(0, 50)}..."`,
      )
      setAppState(prev => ({
        ...prev,
        promptSuggestion: {
          text,
          promptId,
          shownAt: Date.now(),
          acceptedAt: 0,
          generationRequestId,
        },
      }))

      // Start speculation on the pipelined suggestion
      const augmentedContext: REPLHookContext = {
        ...speculationState.contextRef.current,
        messages: [
          ...speculationState.contextRef.current.messages,
          createUserMessage({ content: input }),
          ...cleanMessages,
        ],
      }
      void startSpeculation(text, augmentedContext, setAppState, true)
    }

    return { queryRequired: !isComplete }
  } catch (error) {
    // Fail open: log error and fall back to normal query flow
    /* eslint-disable no-restricted-syntax -- custom fallback message, not toError(e) */
    logError(
      error instanceof Error
        ? error
        : new Error('handleSpeculationAccept failed'),
    )
    /* eslint-enable no-restricted-syntax */
    logSpeculation(
      speculationState.id,
      'error',
      speculationState.startTime,
      speculationState.suggestionLength,
      speculationState.messagesRef.current,
      speculationState.boundary,
      {
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: errorMessage(error).slice(
          0,
          200,
        ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        error_phase:
          'accept' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        is_pipelined: speculationState.isPipelined,
      },
    )
    safeRemoveOverlay(getOverlayPath(speculationState.id))
    resetSpeculationState(setAppState)
    // Query required so user's message is processed normally (without speculated work)
    return { queryRequired: true }
  }
}
