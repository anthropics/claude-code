import { keptOf } from '../../../kept-of'

/**
 * `+N -M` as diffStat draws it, as plain text: what a row measures to know
 * where its counts start; empty at 0/0.
 *
 * @param added lines added
 * @param removed lines removed
 * @returns the text
 */
export const statTextOf = (added: number, removed: number) =>
  keptOf([
    added > 0 ? `+${added}` : null,
    removed > 0 ? `-${removed}` : null,
  ]).join(' ')
