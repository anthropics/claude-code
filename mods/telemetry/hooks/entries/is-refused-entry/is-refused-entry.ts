import type { RefusedEntry } from '../refused-entry'

/**
 * Whether an error is an entry's refusal (`refusal`), and so carries the
 * reason to deny with, rather than something that went wrong on the way.
 *
 * @param error what a check threw
 * @returns whether it is a refused entry's error
 */
export const isRefusedEntry = (error: unknown): error is RefusedEntry =>
  error instanceof Error && 'what' in error && typeof error.what === 'string'
