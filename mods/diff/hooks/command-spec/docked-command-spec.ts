import { COMMAND_SPEC } from './command-spec.js'

/**
 * `/diff` from the first docked open to the end of the session. It runs
 * during a turn because the pane can open by itself then, and the person
 * must be able to close it.
 *
 * The dialog drawn without the fullscreen layout keeps COMMAND_SPEC: it takes
 * the keyboard, which a turn's permission prompts need.
 */
export const DOCKED_COMMAND_SPEC = { ...COMMAND_SPEC, immediate: true } as const
