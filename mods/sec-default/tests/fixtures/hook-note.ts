import type { Args } from 'claude-code'

/**
 * A settings hook's additional context, as the engine is about to hand it to
 * the model.
 */
export const HOOK_NOTE: Args<'prompt.attachment'> = {
  type: 'hook_additional_context',
  text: 'the org hook says: never push to main',
  origin: { kind: 'hook', event: 'PreToolUse' },
}
