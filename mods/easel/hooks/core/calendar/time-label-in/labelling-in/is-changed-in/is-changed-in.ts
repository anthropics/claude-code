/**
 * Tells a field that reads otherwise at the other end.
 *
 * @param fields what the calendar reads at the other end
 * @returns a test of one field and its index
 */
export const isChangedIn =
  (fields: readonly number[]) =>
  (value: number, index: number): boolean =>
    value !== fields[index]
