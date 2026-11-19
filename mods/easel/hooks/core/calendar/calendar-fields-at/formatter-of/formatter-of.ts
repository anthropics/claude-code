import { memoisedByZone } from './memoised-by-zone'

/**
 * A formatter is a function of its zone alone, and to build one for each
 * sample costs more than all else in a reading: each zone gets one.
 *
 * `Intl` throws on a zone it does not know before one is kept.
 *
 * @param zone the IANA name of a time zone
 * @returns the formatter of wall-clock fields in that zone
 */
export const formatterOf = memoisedByZone(
  zone =>
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: zone,
      dateStyle: 'short',
      timeStyle: 'medium',
    }),
)
