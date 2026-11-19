/**
 * What a line says of a column in which no cell was read.
 *
 * @param isOfLists whether the cells of the column are lists
 * @returns the words that stand in for the tallies
 */
export const emptyTextOf = (isOfLists: boolean): string =>
  isOfLists
    ? 'lists, which are not read. Pass one row for each item as data, ' +
      'with the fields beside the list repeated'
    : 'empty'
