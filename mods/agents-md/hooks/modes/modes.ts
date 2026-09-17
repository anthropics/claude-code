import type { Mode } from './types'

/**
 * Every mode, in the order the option's description names them.
 */
export const MODES: readonly Mode[] = [
  'claude',
  'agents-fallback',
  'both',
  'none',
]
