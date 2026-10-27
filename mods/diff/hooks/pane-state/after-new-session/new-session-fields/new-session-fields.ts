import { NO_BODIES } from '../../no-bodies'

/**
 * What `/clear` and `/resume` reset: the pick, the source, the turns and
 * the bodies; the fetch itself stays.
 */
export const NEW_SESSION_FIELDS = Object.freeze({
  selectedPath: null,
  source: Object.freeze({ kind: 'current' }),
  turns: Object.freeze([]),
  bodies: NO_BODIES,
} as const)
