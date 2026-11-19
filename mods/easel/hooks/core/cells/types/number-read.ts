import type { NotRead } from './not-read'

/**
 * `value` has any multiple worked in: `2k` is 2000. `unit` is the base unit, ''
 * for a plain count, and null for zero, which takes the unit of its column.
 */
export type NumberRead =
  | { kind: 'number'; value: number; unit: string | null }
  | NotRead
