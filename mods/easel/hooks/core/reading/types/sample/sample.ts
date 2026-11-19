/**
 * A null value is a gap: an empty cell, or a period the series skipped.
 */
export type Sample = { ms: number; value: number | null }
