/**
 * The plugins among those named that a person has not been told about yet
 * in this session, each once however many of its links were named.
 *
 * @param told the names already told
 * @param names the names one run of the chain gave
 * @returns the names to tell now, in the order given
 */
export const untold = (told: ReadonlySet<string>, names: readonly string[]) =>
  names.filter((name, at) => !told.has(name) && names.indexOf(name) === at)
