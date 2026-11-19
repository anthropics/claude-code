import type Reading from '../../reading'

/**
 * Of the first. The caller knows whether the others have the same unit.
 *
 * @param seriesToRead the series, of which only the first is read
 * @returns its unit, or '' where there is no series
 */
export const unitOf = (seriesToRead: Reading.Series[]): string =>
  seriesToRead[0]?.unit ?? ''
