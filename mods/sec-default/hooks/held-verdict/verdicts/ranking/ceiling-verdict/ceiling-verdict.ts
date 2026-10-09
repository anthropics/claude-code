/**
 * The verdict a ceiling holds a call at: the ceiling itself when it is one
 * of the three verdicts, else a deny.
 *
 * So a ceiling this plugin does not know lifts nothing: it fails closed.
 *
 * @param ceiling the question's `ceiling`, as the engine names it
 * @returns the most permissive verdict within the ceiling
 */
export const ceilingVerdict = (ceiling: string) =>
  (['allow', 'ask', 'deny'] as const).find(known => known === ceiling) ?? 'deny'
