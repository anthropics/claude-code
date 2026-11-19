/**
 * Makes the test of whether a value differs from the one that a list holds
 * at the same place.
 *
 * @param others the list to compare against, place by place
 * @returns the test, which takes a value and its place
 */
export const isDifferentIn =
  (others: readonly number[]) =>
  (value: number, index: number): boolean =>
    value !== others[index]
