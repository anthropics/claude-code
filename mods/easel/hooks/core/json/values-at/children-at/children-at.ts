import { isRecord } from '../../is-record'

/**
 * What one move along a trail reaches: every item, every value, or the one
 * child under a key or at an index.
 *
 * @param parent where the move starts
 * @param step a key, an index, `[]` or `*`
 * @returns the children, none where the move leads nowhere
 */
export function childrenAt(parent: unknown, step: string): unknown[] {
  if (step === '[]') {
    return Array.isArray(parent) ? parent : []
  }

  if (step === '*') {
    return isRecord(parent) ? Object.values(parent) : []
  }

  const hasItem = Array.isArray(parent) && parent[Number(step)] !== undefined
  const hasField = isRecord(parent) && parent[step] !== undefined

  return hasItem ? [parent[Number(step)]] : hasField ? [parent[step]] : []
}
