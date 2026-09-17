/**
 * Which project instructions the plugin loads: the `projectInstructions`
 * option.
 *
 * `claude` loads none of its own, the engine's CLAUDE.md walk standing alone;
 * `agents-fallback` loads AGENTS.md where the project has no CLAUDE.md;
 * `both` loads AGENTS.md beside CLAUDE.md; `none` loads neither, taking the
 * engine's CLAUDE.md block out of the conversation's context.
 */
export type Mode = 'claude' | 'agents-fallback' | 'both' | 'none'
