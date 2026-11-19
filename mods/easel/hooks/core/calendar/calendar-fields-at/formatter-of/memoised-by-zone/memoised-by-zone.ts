/**
 * Keeps what a function of a zone makes, where only the lookup it returns
 * can reach it.
 *
 * Bounded: what throws on a zone is not kept, so only zones that were made
 * something for are held.
 *
 * @param make what to make for a zone the first time it is asked for
 * @returns the lookup, which makes at most once for each zone
 */
export function memoisedByZone<Made>(
  make: (zone: string) => Made,
): (zone: string) => Made {
  const madeByZone = new Map<string, Made>()

  return zone => {
    const made = madeByZone.get(zone) ?? make(zone)
    madeByZone.set(zone, made)

    return made
  }
}
