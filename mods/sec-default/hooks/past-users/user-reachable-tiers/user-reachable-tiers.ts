/**
 * The provider tiers whose subject the user tier may still rewrite: a
 * person's plugin, a bundled one, the engine.
 *
 * Any other provider, or none, is the organization's (fail closed).
 */
export const USER_REACHABLE_TIERS: readonly unknown[] = Object.freeze([
  'user',
  'builtin',
  'core',
])
