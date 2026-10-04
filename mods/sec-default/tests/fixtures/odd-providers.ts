import type { Origin } from 'claude-code'

/**
 * Providers no site pins: tierless, or of a tier the engine does not have.
 *
 * Only a plugin's own `$` call can hand one down; sec-default fails closed
 * on it.
 */
export const ODD_PROVIDERS: readonly Origin[] = [
  { plugin: 'x' },
  { plugin: 'x', tier: 'managed' },
] as readonly unknown[] as readonly Origin[]
