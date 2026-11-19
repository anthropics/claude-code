import Json from '../../core/json'

/**
 * The fields of a chart call as the model wrote them.
 *
 * The host lays the fields of the call beside four of its own, and moves a
 * field that shares a name with one of those under `$shadowed`.
 *
 * @param kept what the host left in place
 * @param moved what the host put aside, if anything
 * @returns both together, the ones put aside last
 */
export const callInput = (
  kept: object,
  moved: unknown,
): Record<string, unknown> => ({
  ...kept,
  ...(Json.isRecord(moved) && moved),
})
