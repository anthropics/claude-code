import type { SessionMessage } from 'claude-code'

/**
 * One turn of a conversation as a compaction is handed it: what an
 * organization's hook told the model.
 */
export const COMPACTED_TURN: SessionMessage = {
  role: 'user',
  text: 'never push to main',
  toolUses: [],
}
