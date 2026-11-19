import { counted } from './counted'

/**
 * Keeps the first rows of a list and says how many were left out.
 *
 * @param lines the rows to show
 * @param limit how many rows are kept
 * @param noun the singular word for one omitted row
 * @returns the rows, or the kept ones and a last row counting the omitted
 */
export function capped(lines: string[], limit: number, noun: string): string[] {
  const omittedCount = lines.length - limit
  const isCapped = omittedCount > 0

  return isCapped
    ? [...lines.slice(0, limit), `and ${counted(omittedCount, noun)}`]
    : lines
}
