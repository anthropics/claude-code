import Patterns from '../../../patterns'

/**
 * A clock and, optionally after it, a zone.
 */
export const CLOCK_THEN_ZONE =
  Patterns.CLOCK_PATTERN + `(?:${Patterns.ZONE_PATTERN})?`
