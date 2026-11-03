import type { Args } from 'claude-code'

/**
 * A settings hook's additional context as the row a conversation is about
 * to keep of it.
 */
export const HOOK_CONTEXT_ROW: Args<'session.append'> = {
  message: {
    type: 'attachment',
    name: 'hook_additional_context',
    role: 'user',
    content: [{ type: 'text', text: 'the org hook says: never push to main' }],
  },
  door: 'hook-context',
  origin: { kind: 'hook', event: 'PreToolUse' },
  uuid: 'row-hook-context',
}
