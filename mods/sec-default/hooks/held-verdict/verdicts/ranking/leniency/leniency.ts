/**
 * How permissive each `tool.check` verdict is, the refusal lowest: a link
 * loosened a verdict when its own ranks above the one handed up to it.
 */
export const LENIENCY = Object.freeze({ deny: 0, ask: 1, allow: 2 })
