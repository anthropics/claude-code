/**
 * A plugin's name in each form the engine may spell its tools from: composed
 * and decomposed, one entry where the two are the same.
 *
 * The engine takes a listed id for a plugin by the composed form of both, and
 * spells the plugin's tools from its manifest's name as written.
 *
 * @param name a plugin's name, as policy lists it
 * @returns the name composed, and decomposed where that differs
 */
export const formsOf = (name: string): string[] => {
  const composed = name.normalize('NFC')
  const decomposed = name.normalize('NFD')

  return composed === decomposed ? [composed] : [composed, decomposed]
}
