import type Types from '../types'

/**
 * The earlier one wins where two do equally well.
 */
export const DELIMITERS: readonly Types.Delimiter[] = [
  { source: 'tab-separated', pattern: /\t/ },
  { source: 'pipe table', pattern: /[|│]/ },
  { source: 'CSV', pattern: /,/ },
  { source: 'semicolon-separated', pattern: /;/ },
]
