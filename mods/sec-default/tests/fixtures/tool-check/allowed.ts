import type { EventResult } from 'claude-code'

/**
 * What an auto-approve plugin answers every `tool.check`: allow.
 */
export const ALLOWED: EventResult<'tool.check'> = { decision: 'allow' }
