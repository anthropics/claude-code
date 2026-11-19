/**
 * Where a JSON value lies, and what its tables are said to come from.
 */
export type JsonPlace = {
  /**
   * The keys that lead to the value, joined by dots; none at the root.
   */
  path?: string

  /**
   * What its tables of records are said to come from; plain JSON where
   * none is given.
   */
  source?: string
}
