/**
 * What a host that compiles the module in says itself. An installed copy has
 * none of it, and asks `$`.
 */
export type Host = {
  /**
   * Whether the session renders for a screen reader, the flag
   * `--ax-screen-reader` included.
   */
  isReaderOn?: () => boolean

  /**
   * Whether a chart call waits for the answers of its own batch.
   */
  isBatchAwaited?: () => boolean

  /**
   * Whether the organization's policy withholds charts.
   */
  isRegulated?: () => boolean
}
