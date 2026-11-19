import Patterns from '../../../patterns'

/**
 * What a host writes in place of the part it cut from an output.
 */
export const TRUNCATION_LINES: readonly RegExp[] = [
  /<persisted-output>/,
  /<truncated-output>/,
  /Output too large.*/,
  /\(output truncated[^)\n]*\)/,
  Patterns.DUCKDB_FOOT,
  Patterns.BRACKET_NOTE,
  /Error: result \(.* exceeds maximum allowed tokens.*/,
]
