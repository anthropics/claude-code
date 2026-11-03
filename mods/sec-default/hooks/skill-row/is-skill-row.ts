import type { Args } from 'claude-code'

import { SKILL_TOOL } from './skill-tool.js'

/**
 * Whether a row on its way into the conversation is one a call of the Skill
 * tool hands over: a skill's body, an organization's among them.
 *
 * Whose skill it is the row does not say, so every such row counts.
 *
 * @param e the row, as `session.append` carries it
 * @returns true for a Skill call's row
 */
export const isSkillRow = (e: Args<'session.append'>): boolean =>
  e.origin.kind === 'tool' && e.origin.tool === SKILL_TOOL
