import type { RenderableMessage } from '../types/message.js'
import {
  INTERRUPT_MESSAGE,
  INTERRUPT_MESSAGE_FOR_TOOL_USE,
} from './messages.js'

const SYSTEM_REMINDER_CLOSE = '</system-reminder>'

// UserTextMessage.tsx:~84 replaces these with <InterruptedByUser />
// (renders 'Interrupted · /issue...'). Raw text never appears on screen;
// searching it yields phantom matches — /terr → in[terr]upted.
const RENDERED_AS_SENTINEL = new Set([
  INTERRUPT_MESSAGE,
  INTERRUPT_MESSAGE_FOR_TOOL_USE,
])

const searchTextCache = new WeakMap<RenderableMessage, string>()

/** Flatten a RenderableMessage to lowercased searchable text. WeakMap-
 *  cached — messages are append-only and immutable so a hit is always
 *  valid. Lowercased at cache time: the only caller immediately
 *  .toLowerCase()d the result, re-lowering ~1.5MB on every keystroke
 *  (the backspace hang). Returns '' for non-searchable types. */
export function renderableSearchText(msg: RenderableMessage): string {
  const cached = searchTextCache.get(msg)
  if (cached !== undefined) return cached
  const result = computeSearchText(msg).toLowerCase()
  searchTextCache.set(msg, result)
  return result
}

function computeSearchText(msg: RenderableMessage): string {
  let raw = ''
  switch (msg.type) {
    case 'user': {
      const c = msg.message.content
      if (typeof c === 'string') {
        raw = RENDERED_AS_SENTINEL.has(c) ? '' : c
      } else {
        const parts: string[] = []
        for (const b of c) {
          if (b.type === 'text') {
            if (!RENDERED_AS_SENTINEL.has(b.text)) parts.push(b.text)
          } else if (b.type === 'tool_result') {
            // b.content is the MODEL-facing serialization (from each tool's
            // mapToolResultToToolResultBlockParam) — adds system-reminders,
            // <persisted-output> wrappers, backgroundInfo strings,
            // CYBER_RISK_MITIGATION_REMINDER. The UI
            // renders msg.toolUseResult (the tool's native Out) via
            // renderToolResultMessage — DIFFERENT text. Indexing b.content
            // yields phantoms: /malware → matches the reminder, /background
            // → matches the model-only ID string, none render.
            //
            // Duck-type the native Out instead. Covers the common shapes:
            // Bash {stdout,stderr}, Grep {content,filenames}, Read
            // {file.content}. Unknown shapes index empty — under-count is
            // honest, phantom is a lie. Proper fix is per-tool
            // extractSearchText(Out) on the Tool interface (TODO).
            parts.push(toolResultSearchText(msg.toolUseResult))
          }
        }
        raw = parts.join('\n')
      }
      break
    }
    case 'assistant': {
      const c = msg.message.content
      if (Array.isArray(c)) {
        // text blocks + tool_use inputs. tool_use renders as "⏺ Bash(cmd)"
        // — the command/pattern/path is visible and searchable-expected.
        // Skip thinking (hidden by hidePastThinking in transcript mount).
        raw = c
          .flatMap(b => {
            if (b.type === 'text') return [b.text]
            if (b.type === 'tool_use') return [toolUseSearchText(b.input)]
            return []
          })
          .join('\n')
      }
      break
    }
    case 'attachment': {
      // relevant_memories renders full m.content in transcript mode
      // (AttachmentMessage.tsx <Ansi>{m.content}</Ansi>). Visible but
      // unsearchable without this — [ dump finds it, / doesn't.
      if (msg.attachment.type === 'relevant_memories') {
        raw = msg.attachment.memories.map(m => m.content).join('\n')
      } else if (
        // Mid-turn prompts — queued while an agent is running. Render via
        // UserTextMessage (AttachmentMessage.tsx:~348). stickyPromptText
        // (VirtualMessageList.tsx:~103) has the same guards — mirror here.
        msg.attachment.type === 'queued_command' &&
        msg.attachment.commandMode !== 'task-notification' &&
        !msg.attachment.isMeta
      ) {
        const p = msg.attachment.prompt
        raw =
          typeof p === 'string'
            ? p
            : p.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('\n')
      }
      break
    }
    case 'collapsed_read_search': {
      // relevant_memories attachments are absorbed into collapse groups
      // (collapseReadSearch.ts); their content is visible in transcript mode
      // via CollapsedReadSearchContent, so mirror it here for / search.
      if (msg.relevantMemories) {
        raw = msg.relevantMemories.map(m => m.content).join('\n')
      }
      break
    }
    default:
      // grouped_tool_use, system — no text content
      break
  }
  // Strip <system-reminder> anywhere — Claude context, not user-visible.
  // Mid-message on cc -c resumes (memory reminders between prompt lines).
  let t = raw
  let open = t.indexOf('<system-reminder>')
  while (open >= 0) {
    const close = t.indexOf(SYSTEM_REMINDER_CLOSE, open)
    if (close < 0) break
    t = t.slice(0, open) + t.slice(close + SYSTEM_REMINDER_CLOSE.length)
    open = t.indexOf('<system-reminder>')
  }
  return t
}

/** Tool invocation display: renderToolUseMessage shows input fields like
 *  command (Bash), pattern (Grep), file_path (Read/Edit), prompt (Agent).
 *  Same duck-type strategy as toolResultSearchText — known field names,
 *  unknown → empty. Under-count > phantom. */
export function toolUseSearchText(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const o = input as Record<string, unknown>
  const parts: string[] = []
  // renderToolUseMessage typically shows one or two of these as the
  // primary argument. tool_name itself is in the "⏺ Bash(...)" chrome,
  // handled by under-count (the overlay matches it but we don't count it).
  for (const k of [
    'command',
    'pattern',
    'file_path',
    'path',
    'prompt',
    'description',
    'query',
    'url',
    'skill', // SkillTool
  ]) {
    const v = o[k]
    if (typeof v === 'string') parts.push(v)
  }
  // args[] (Tmux/TungstenTool), files[] (SendUserFile) — tool-use
  // renders the joined array as the primary display. Under-count > skip.
  for (const k of ['args', 'files']) {
    const v = o[k]
    if (Array.isArray(v) && v.every(x => typeof x === 'string')) {
      parts.push((v as string[]).join(' '))
    }
  }
  return parts.join('\n')
}

/** Duck-type the tool's native Out for searchable text. Known shapes:
 *  {stdout,stderr} (Bash/Shell), {content} (Grep), {file:{content}} (Read),
 *  {filenames:[]} (Grep/Glob), {output} (generic). Falls back to concating
 *  all top-level string fields — crude but better than indexing model-chatter.
 *  Empty for unknown shapes: under-count > phantom. */
export function toolResultSearchText(r: unknown): string {
  if (!r || typeof r !== 'object') return typeof r === 'string' ? r : ''
  const o = r as Record<string, unknown>
  // Known shapes first (common tools).
  if (typeof o.stdout === 'string') {
    const err = typeof o.stderr === 'string' ? o.stderr : ''
    return o.stdout + (err ? '\n' + err : '')
  }
  if (
    o.file &&
    typeof o.file === 'object' &&
    typeof (o.file as { content?: unknown }).content === 'string'
  ) {
    return (o.file as { content: string }).content
  }
  // Known output-field names only. A blind walk would index metadata
  // the UI doesn't show (rawOutputPath, backgroundTaskId, filePath,
  // durationMs-as-string). Allowlist the fields tools actually render.
  // Tools not matching any shape index empty — add them here as found.
  const parts: string[] = []
  for (const k of ['content', 'output', 'result', 'text', 'message']) {
    const v = o[k]
    if (typeof v === 'string') parts.push(v)
  }
  for (const k of ['filenames', 'lines', 'results']) {
    const v = o[k]
    if (Array.isArray(v) && v.every(x => typeof x === 'string')) {
      parts.push((v as string[]).join('\n'))
    }
  }
  return parts.join('\n')
}
