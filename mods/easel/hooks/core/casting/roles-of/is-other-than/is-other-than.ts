/**
 * A column that is the x axis is neither a value nor a split: this keeps
 * the other names of a list.
 *
 * @param taken the name that is left out, undefined where there is none
 * @returns a test of whether a name is another one
 */
export const isOtherThan =
  (taken: string | undefined): ((name: string) => boolean) =>
  name =>
    name !== taken
