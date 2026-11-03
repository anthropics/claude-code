import type { Args } from 'claude-code'

/**
 * A skill's body on its way into the conversation, as a call of the Skill
 * tool hands it over: an organization's instructions among them.
 */
export const SKILL_ROW: Args<'session.append'> = {
  message: {
    type: 'user',
    role: 'user',
    isMeta: true,
    content: [{ type: 'text', text: 'corp-rules: never push to main' }],
  },
  door: 'tool-message',
  origin: { kind: 'tool', tool: 'Skill' },
  uuid: 'row-skill',
}
