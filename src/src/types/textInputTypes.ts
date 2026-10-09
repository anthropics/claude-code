import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { UUID } from 'crypto'
import type React from 'react'
import type { PermissionResult } from '../entrypoints/agentSdkTypes.js'
import type { Key } from '../ink.js'
import type { PastedContent } from '../utils/config.js'
import type { ImageDimensions } from '../utils/imageResizer.js'
import type { TextHighlight } from '../utils/textHighlighting.js'
import type { AgentId } from './ids.js'
import type { AssistantMessage, MessageOrigin } from './message.js'

/**
 * Inline ghost text for mid-input command autocomplete
 */
export type InlineGhostText = {
  /** The ghost text to display (e.g., "mit" for /commit) */
  readonly text: string
  /** The full command name (e.g., "commit") */
  readonly fullCommand: string
  /** Position in the input where the ghost text should appear */
  readonly insertPosition: number
}

/**
 * Base props for text input components
 */
export type BaseTextInputProps = {
  /**
   * Optional callback for handling history navigation on up arrow at start of input
   */
  readonly onHistoryUp?: () => void

  /**
   * Optional callback for handling history navigation on down arrow at end of input
   */
  readonly onHistoryDown?: () => void

  /**
   * Text to display when `value` is empty.
   */
  readonly placeholder?: string

  /**
   * Allow multi-line input via line ending with backslash (default: `true`)
   */
  readonly multiline?: boolean

  /**
   * Listen to user's input. Useful in case there are multiple input components
   * at the same time and input must be "routed" to a specific component.
   */
  readonly focus?: boolean

  /**
   * Replace all chars and mask the value. Useful for password inputs.
   */
  readonly mask?: string

  /**
   * Whether to show cursor and allow navigation inside text input with arrow keys.
   */
  readonly showCursor?: boolean

  /**
   * Highlight pasted text
   */
  readonly highlightPastedText?: boolean

  /**
   * Value to display in a text input.
   */
  readonly value: string

  /**
   * Function to call when value updates.
   */
  readonly onChange: (value: string) => void

  /**
   * Function to call when `Enter` is pressed, where first argument is a value of the input.
   */
  readonly onSubmit?: (value: string) => void

  /**
   * Function to call when Ctrl+C is pressed to exit.
   */
  readonly onExit?: () => void

  /**
   * Optional callback to show exit message
   */
  readonly onExitMessage?: (show: boolean, key?: string) => void

  /**
   * Optional callback to show custom message
   */
  // readonly onMessage?: (show: boolean, message?: string) => void

  /**
   * Optional callback to reset history position
   */
  readonly onHistoryReset?: () => void

  /**
   * Optional callback when input is cleared (e.g., double-escape)
   */
  readonly onClearInput?: () => void

  /**
   * Number of columns to wrap text at
   */
  readonly columns: number

  /**
   * Maximum visible lines for the input viewport. When the wrapped input
   * exceeds this many lines, only lines around the cursor are rendered.
   */
  readonly maxVisibleLines?: number

  /**
   * Optional callback when an image is pasted
   */
  readonly onImagePaste?: (
    base64Image: string,
    mediaType?: string,
    filename?: string,
    dimensions?: ImageDimensions,
    sourcePath?: string,
  ) => void

  /**
   * Optional callback when a large text (over 800 chars) is pasted
   */
  readonly onPaste?: (text: string) => void

  /**
   * Callback when the pasting state changes
   */
  readonly onIsPastingChange?: (isPasting: boolean) => void

  /**
   * Whether to disable cursor movement for up/down arrow keys
   */
  readonly disableCursorMovementForUpDownKeys?: boolean

  /**
   * Skip the text-level double-press escape handler. Set this when a
   * keybinding context (e.g. Autocomplete) owns escape — the keybinding's
   * stopImmediatePropagation can't shield the text input because child
   * effects register useInput listeners before parent effects.
   */
  readonly disableEscapeDoublePress?: boolean

  /**
   * The offset of the cursor within the text
   */
  readonly cursorOffset: number

  /**
   * Callback to set the offset of the cursor
   */
  onChangeCursorOffset: (offset: number) => void

  /**
   * Optional hint text to display after command input
   * Used for showing available arguments for commands
   */
  readonly argumentHint?: string

  /**
   * Optional callback for undo functionality
   */
  readonly onUndo?: () => void

  /**
   * Whether to render the text with dim color
   */
  readonly dimColor?: boolean

  /**
   * Optional text highlights for search results or other highlighting
   */
  readonly highlights?: TextHighlight[]

  /**
   * Optional custom React element to render as placeholder.
   * When provided, overrides the standard `placeholder` string rendering.
   */
  readonly placeholderElement?: React.ReactNode

  /**
   * Optional inline ghost text for mid-input command autocomplete
   */
  readonly inlineGhostText?: InlineGhostText

  /**
   * Optional filter applied to raw input before key routing. Return the
   * (possibly transformed) input string; returning '' for a non-empty
   * input drops the event.
   */
  readonly inputFilter?: (input: string, key: Key) => string
}

/**
 * Extended props for VimTextInput
 */
export type VimTextInputProps = BaseTextInputProps & {
  /**
   * Initial vim mode to use
   */
  readonly initialMode?: VimMode

  /**
   * Optional callback for mode changes
   */
  readonly onModeChange?: (mode: VimMode) => void
}

/**
 * Vim editor modes
 */
export type VimMode = 'INSERT' | 'NORMAL'

/**
 * Common properties for input hook results
 */
export type BaseInputState = {
  onInput: (input: string, key: Key) => void
  renderedValue: string
  offset: number
  setOffset: (offset: number) => void
  /** Cursor line (0-indexed) within the rendered text, accounting for wrapping. */
  cursorLine: number
  /** Cursor column (display-width) within the current line. */
  cursorColumn: number
  /** Character offset in the full text where the viewport starts (0 when no windowing). */
  viewportCharOffset: number
  /** Character offset in the full text where the viewport ends (text.length when no windowing). */
  viewportCharEnd: number

  // For paste handling
  isPasting?: boolean
  pasteState?: {
    chunks: string[]
    timeoutId: ReturnType<typeof setTimeout> | null
  }
}

/**
 * State for text input
 */
export type TextInputState = BaseInputState

/**
 * State for vim input with mode
 */
export type VimInputState = BaseInputState & {
  mode: VimMode
  setMode: (mode: VimMode) => void
}

/**
 * Input modes for the prompt
 */
export type PromptInputMode =
  | 'bash'
  | 'prompt'
  | 'orphaned-permission'
  | 'task-notification'

export type EditablePromptInputMode = Exclude<
  PromptInputMode,
  `${string}-notification`
>

/**
 * Queue priority levels. Same semantics in both normal and proactive mode.
 *
 *  - `now`   — Interrupt and send immediately. Aborts any in-flight tool
 *              call (equivalent to Esc + send). Consumers (print.ts,
 *              REPL.tsx) subscribe to queue changes and abort when they
 *              see a 'now' command.
 *  - `next`  — Mid-turn drain. Let the current tool call finish, then
 *              send this message between the tool result and the next API
 *              round-trip. Wakes an in-progress SleepTool call.
 *  - `later` — End-of-turn drain. Wait for the current turn to finish,
 *              then process as a new query. Wakes an in-progress SleepTool
 *              call (query.ts upgrades the drain threshold after sleep so
 *              the message is attached to the same turn).
 *
 * The SleepTool is only available in proactive mode, so "wakes SleepTool"
 * is a no-op in normal mode.
 */
export type QueuePriority = 'now' | 'next' | 'later'

/**
 * Queued command type
 */
export type QueuedCommand = {
  value: string | Array<ContentBlockParam>
  mode: PromptInputMode
  /** Defaults to the priority implied by `mode` when enqueued. */
  priority?: QueuePriority
  uuid?: UUID
  orphanedPermission?: OrphanedPermission
  /** Raw pasted contents including images. Images are resized at execution time. */
  pastedContents?: Record<number, PastedContent>
  /**
   * The input string before [Pasted text #N] placeholders were expanded.
   * Used for ultraplan keyword detection so pasted content containing the
   * keyword does not trigger a CCR session. Falls back to `value` when
   * unset (bridge/UDS/MCP sources have no paste expansion).
   */
  preExpansionValue?: string
  /**
   * When true, the input is treated as plain text even if it starts with `/`.
   * Used for remotely-received messages (e.g. bridge/CCR) that should not
   * trigger local slash commands or skills.
   */
  skipSlashCommands?: boolean
  /**
   * When true, slash commands are dispatched but filtered through
   * isBridgeSafeCommand() — 'local-jsx' and terminal-only commands return
   * a helpful error instead of executing. Set by the Remote Control bridge
   * inbound path so mobile/web clients can run skills and benign commands
   * without re-exposing the PR #19134 bug (/model popping the local picker).
   */
  bridgeOrigin?: boolean
  /**
   * When true, the resulting UserMessage gets `isMeta: true` — hidden in the
   * transcript UI but visible to the model. Used by system-generated prompts
   * (proactive ticks, teammate messages, resource updates) that route through
   * the queue instead of calling `onQuery` directly.
   */
  isMeta?: boolean
  /**
   * Provenance of this command. Stamped onto the resulting UserMessage so the
   * transcript records origin structurally (not just via XML tags in content).
   * undefined = human (keyboard).
   */
  origin?: MessageOrigin
  /**
   * Workload tag threaded through to cc_workload= in the billing-header
   * attribution block. The queue is the async boundary between the cron
   * scheduler firing and the turn actually running — a user prompt can slip
   * in between — so the tag rides on the QueuedCommand itself and is only
   * hoisted into bootstrap state when THIS command is dequeued.
   */
  workload?: string
  /**
   * Agent that should receive this notification. Undefined = main thread.
   * Subagents run in-process and share the module-level command queue; the
   * drain gate in query.ts filters by this field so a subagent's background
   * task notifications don't leak into the coordinator's context (PR #18453
   * unified the queue but lost the isolation the dual-queue accidentally had).
   */
  agentId?: AgentId
}

/**
 * Type guard for image PastedContent with non-empty data. Empty-content
 * images (e.g. from a 0-byte file drag) yield empty base64 strings that
 * the API rejects with `image cannot be empty`. Use this at every site
 * that converts PastedContent → ImageBlockParam so the filter and the
 * ID list stay in sync.
 */
export function isValidImagePaste(c: PastedContent): boolean {
  return c.type === 'image' && c.content.length > 0
}

/** Extract image paste IDs from a QueuedCommand's pastedContents. */
export function getImagePasteIds(
  pastedContents: Record<number, PastedContent> | undefined,
): number[] | undefined {
  if (!pastedContents) {
    return undefined
  }
  const ids = Object.values(pastedContents)
    .filter(isValidImagePaste)
    .map(c => c.id)
  return ids.length > 0 ? ids : undefined
}

export type OrphanedPermission = {
  permissionResult: PermissionResult
  assistantMessage: AssistantMessage
}
