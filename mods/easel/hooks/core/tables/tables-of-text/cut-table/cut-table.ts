import type Casting from '../../../casting'

/**
 * The empty placeholder of a text that its host truncated.
 *
 * @returns a table with no columns and no rows, which states that it is cut
 */
export const cutTable = (): Casting.Table => ({
  source: 'a cut text',
  columns: [],
  rows: [],
  hasMadeUpNames: false,
  isCut: true,
})
