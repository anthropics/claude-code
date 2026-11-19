/**
 * What a table holds in one place, read here as a number or as a time.
 *
 * A cell is either read in full or reported as not read, with the reason:
 * nothing is guessed.
 */
export type Cell = string | number | boolean | null
