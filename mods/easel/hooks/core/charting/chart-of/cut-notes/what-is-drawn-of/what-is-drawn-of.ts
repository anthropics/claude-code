/**
 * Says which of all the series the drawn ones are.
 *
 * @param drawnAloneCount how many series are drawn on their own
 * @returns the words that stand between what was cut and the count of all
 */
export function whatIsDrawnOf(drawnAloneCount: number): string {
  const isOneDrawnAlone = drawnAloneCount === 1

  return isOneDrawnAlone
    ? 'this is the largest'
    : `these are the ${drawnAloneCount} largest`
}
