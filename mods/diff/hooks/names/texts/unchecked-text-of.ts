/**
 * The line in place of a list whose files are not answered for.
 *
 * @param isLoading whether the answers are still to come
 * @returns the line
 */
export const uncheckedTextOf = (isLoading: boolean) =>
  isLoading ? 'Loading diff…' : "Read permissions couldn't be checked"
