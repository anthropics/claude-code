import { createHash } from 'crypto'
import type { AssistantMessage, UserMessage } from '../types/message.js'

/**
 * Hardcoded salt from backend validation.
 * Must match exactly for fingerprint validation to pass.
 */
export const FINGERPRINT_SALT = '59cf53e54c78'

/**
 * Extracts text content from the first user message.
 *
 * @param messages - Array of internal message types
 * @returns First text content, or empty string if not found
 */
export function extractFirstMessageText(
  messages: (UserMessage | AssistantMessage)[],
): string {
  const firstUserMessage = messages.find(msg => msg.type === 'user')
  if (!firstUserMessage) {
    return ''
  }

  const content = firstUserMessage.message.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    const textBlock = content.find(block => block.type === 'text')
    if (textBlock && textBlock.type === 'text') {
      return textBlock.text
    }
  }

  return ''
}

/**
 * Computes 3-character fingerprint for Claude Code attribution.
 * Algorithm: SHA256(SALT + msg[4] + msg[7] + msg[20] + version)[:3]
 * IMPORTANT: Do not change this method without careful coordination with
 * 1P and 3P (Bedrock, Vertex, Azure) APIs.
 *
 * @param messageText - First user message text content
 * @param version - Version string (from MACRO.VERSION)
 * @returns 3-character hex fingerprint
 */
export function computeFingerprint(
  messageText: string,
  version: string,
): string {
  // Extract chars at indices [4, 7, 20], use "0" if index not found
  const indices = [4, 7, 20]
  const chars = indices.map(i => messageText[i] || '0').join('')

  const fingerprintInput = `${FINGERPRINT_SALT}${chars}${version}`

  // SHA256 hash, return first 3 hex chars
  const hash = createHash('sha256').update(fingerprintInput).digest('hex')
  return hash.slice(0, 3)
}

/**
 * Computes fingerprint from the first user message.
 *
 * @param messages - Array of normalized messages
 * @returns 3-character hex fingerprint
 */
export function computeFingerprintFromMessages(
  messages: (UserMessage | AssistantMessage)[],
): string {
  const firstMessageText = extractFirstMessageText(messages)
  return computeFingerprint(firstMessageText, MACRO.VERSION)
}
