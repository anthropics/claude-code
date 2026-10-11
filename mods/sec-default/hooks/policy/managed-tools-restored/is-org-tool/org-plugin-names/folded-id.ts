/**
 * A plugin's id as the engine compares ids: NFC, then lower case.
 *
 * A mod imports nothing from the engine, so its rule is copied here; a test
 * in the engine's tree holds the copy equal to it.
 *
 * @param id an id as written, `<name>@<source>`
 * @returns the fold
 */
export const foldedId = (id: string): string =>
  id.normalize('NFC').toLowerCase()
