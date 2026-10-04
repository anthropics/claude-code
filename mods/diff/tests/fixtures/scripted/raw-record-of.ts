/**
 * One changed file's record as `git diff --raw -z` prints it: the modes,
 * the object names and the status, then the path, each NUL-ended.
 *
 * @param path the path as git holds it
 * @returns the record
 */
export const rawRecordOf = (path: string) =>
  `:100644 100644 5626abf 0000000 M\0${path}\0`
