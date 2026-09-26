import type { SessionAppendInput } from 'claude-code'

/**
 * The context an organization's settings hook attached for the model, as the
 * engine raises the row before keeping it.
 */
export const HOOK_CONTEXT_ROW: SessionAppendInput = {
  message: {
    type: 'attachment',
    name: 'hook_additional_context',
    role: 'user',
    isMeta: true,
    content: [{ type: 'text', text: 'the org says: ask before deploying' }],
  },
  door: 'hook-context',
  origin: { kind: 'hook', event: 'UserPromptSubmit' },
  uuid: '6f0d3c1e-5b7a-4c2e-9a41-2d8e7f3b9c10',
}
