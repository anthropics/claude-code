import type { SessionMessagesResult } from 'claude-code'

/**
 * What the host answers when asked for a conversation's rows: its messages, or
 * a refusal.
 *
 * It is the host's own type, so a change of the answer fails the type check
 * here.
 */
export type SessionRead = SessionMessagesResult
