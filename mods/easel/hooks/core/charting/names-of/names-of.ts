import type Reading from '../../reading'

/**
 * Joined for a note, in the order given.
 *
 * @param seriesToName the series whose names are wanted
 * @returns the names with commas between
 */
export const namesOf = (seriesToName: Reading.Series[]): string =>
  seriesToName.map(series => series.name).join(', ')
