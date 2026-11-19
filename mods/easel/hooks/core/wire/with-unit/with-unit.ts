import Cells from '../../cells'

/**
 * Units reach the reader only inside a cell. An unknown one is left off.
 *
 * @param value the cell as the service gave it
 * @param unit the short name of what the cell is counted in, or `''`
 * @returns the cell with its unit after it, or the cell as it came
 */
export function withUnit(value: unknown, unit: string): unknown {
  const isKnownUnit =
    unit !== '' && Cells.readNumber(`1 ${unit}`).kind === 'number'

  return isKnownUnit && value !== null ? `${value} ${unit}` : value
}
