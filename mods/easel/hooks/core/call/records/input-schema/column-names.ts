/**
 * The schema of a field that holds the names of columns.
 */
export const COLUMN_NAMES = {
  type: 'array',
  items: { type: 'string' },
} as const
