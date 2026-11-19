import type Types from '../types'

/**
 * Whether two numbers land on the same sample of the same series.
 *
 * @param reading the table as read
 * @returns true if some sample takes more than one row
 */
export function hasRowsToCombine(reading: Types.TableReading): boolean {
  const samplePlaces = reading.readings
    .filter(cell => cell.value !== null)
    .map(cell => JSON.stringify([cell.groupLabels, cell.ms]))

  return new Set(samplePlaces).size < samplePlaces.length
}
