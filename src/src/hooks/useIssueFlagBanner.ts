import { useMemo, useRef } from 'react'
import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import type { Message } from '../types/message.js'
import { getUserMessageText } from '../utils/messages.js'

const EXTERNAL_COMMAND_PATTERNS = [
  /\bcurl\b/,
  /\bwget\b/,
  /\bssh\b/,
  /\bkubectl\b/,
  /\bsrun\b/,
  /\bdocker\b/,
  /\bbq\b/,
  /\bgsutil\b/,
  /\bgcloud\b/,
  /\baws\b/,
  /\bgit\s+push\b/,
  /\bgit\s+pull\b/,
  /\bgit\s+fetch\b/,
  /\bgh\s+(pr|issue)\b/,
  /\bnc\b/,
  /\bncat\b/,
  /\btelnet\b/,
  /\bftp\b/,
]

const FRICTION_PATTERNS = [
  // "No," or "No!" at start — comma/exclamation implies correction tone
  // (avoids "No problem", "No thanks", "No I think we should...")
  /^no[,!]\s/i,
  // Direct corrections about Claude's output
  /\bthat'?s (wrong|incorrect|not (what|right|correct))\b/i,
  /\bnot what I (asked|wanted|meant|said)\b/i,
  // Referencing prior instructions Claude missed
  /\bI (said|asked|wanted|told you|already said)\b/i,
  // Questioning Claude's actions
  /\bwhy did you\b/i,
  /\byou should(n'?t| not)? have\b/i,
  /\byou were supposed to\b/i,
  // Explicit retry/revert of Claude's work
  /\btry again\b/i,
  /\b(undo|revert) (that|this|it|what you)\b/i,
]

export function isSessionContainerCompatible(messages: Message[]): boolean {
  for (const msg of messages) {
    if (msg.type !== 'assistant') {
      continue
    }
    const content = msg.message.content
    if (!Array.isArray(content)) {
      continue
    }
    for (const block of content) {
      if (block.type !== 'tool_use' || !('name' in block)) {
        continue
      }
      const toolName = block.name as string
      if (toolName.startsWith('mcp__')) {
        return false
      }
      if (toolName === BASH_TOOL_NAME) {
        const input = (block as { input?: Record<string, unknown> }).input
        const command = (input?.command as string) || ''
        if (EXTERNAL_COMMAND_PATTERNS.some(p => p.test(command))) {
          return false
        }
      }
    }
  }
  return true
}

export function hasFrictionSignal(messages: Message[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.type !== 'user') {
      continue
    }
    const text = getUserMessageText(msg)
    if (!text) {
      continue
    }
    return FRICTION_PATTERNS.some(p => p.test(text))
  }
  return false
}

const MIN_SUBMIT_COUNT = 3
const COOLDOWN_MS = 30 * 60 * 1000

export function useIssueFlagBanner(
  messages: Message[],
  submitCount: number,
): boolean {
  if (process.env.USER_TYPE !== 'ant') {
    return false
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: process.env.USER_TYPE is a compile-time constant
  const lastTriggeredAtRef = useRef(0)
  // biome-ignore lint/correctness/useHookAtTopLevel: process.env.USER_TYPE is a compile-time constant
  const activeForSubmitRef = useRef(-1)

  // Memoize the O(messages) scans. This hook runs on every REPL render
  // (including every keystroke), but messages is stable during typing.
  // isSessionContainerCompatible walks all messages + regex-tests each
  // bash command — by far the heaviest work here.
  // biome-ignore lint/correctness/useHookAtTopLevel: process.env.USER_TYPE is a compile-time constant
  const shouldTrigger = useMemo(
    () => isSessionContainerCompatible(messages) && hasFrictionSignal(messages),
    [messages],
  )

  // Keep showing the banner until the user submits another message
  if (activeForSubmitRef.current === submitCount) {
    return true
  }

  if (Date.now() - lastTriggeredAtRef.current < COOLDOWN_MS) {
    return false
  }
  if (submitCount < MIN_SUBMIT_COUNT) {
    return false
  }
  if (!shouldTrigger) {
    return false
  }

  lastTriggeredAtRef.current = Date.now()
  activeForSubmitRef.current = submitCount
  return true
}
