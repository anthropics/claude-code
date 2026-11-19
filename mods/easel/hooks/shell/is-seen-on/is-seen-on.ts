/**
 * A headless session has no surface, and nobody watches a subagent work: a
 * hook asks this of the main conversation alone.
 *
 * @param surfaces where the session draws, as the host lists them
 * @returns whether a person sees what the main conversation draws
 */
export const isSeenOn = (surfaces: readonly unknown[]): boolean =>
  surfaces.length > 0
