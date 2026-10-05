/**
 * The tiers whose subject, or whose own call, the user tier may still hear
 * and rewrite: a person's plugin, a bundled one, the engine.
 *
 * Any other provider or caller, or none, is the organization's (fail closed).
 */
export const USER_REACHABLE_TIERS: readonly unknown[] = Object.freeze([
  'user',
  'builtin',
  'core',
])
