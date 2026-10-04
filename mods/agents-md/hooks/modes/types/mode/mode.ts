/**
 * Which project instructions the plugin loads: the `instructionFiles`
 * option.
 *
 * `claude-md` loads none of its own, the engine's CLAUDE.md walk standing
 * alone; `claude-md-or-agents-md` loads AGENTS.md where the project has no
 * CLAUDE.md; `claude-md-and-agents-md` loads AGENTS.md beside CLAUDE.md;
 * `managed-only` loads neither, taking the project's and the person's
 * CLAUDE.md files out of the conversation's context.
 */
export type Mode =
  | 'claude-md'
  | 'claude-md-or-agents-md'
  | 'claude-md-and-agents-md'
  | 'managed-only'
