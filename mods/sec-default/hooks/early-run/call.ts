/**
 * One tool call as `$.tool.check` is asked about it: the tool and its input.
 */
export type Call = {
  tool: string
  input: Readonly<Record<string, unknown>>
  /** What the tool's allowed calls under way hold: to run that is no repeat of this call. */
  served?: readonly string[]
  /** The same by argument, in its place for a tool outside the code tools. */
  servedAt?: ReadonlyMap<string, readonly string[]>
  /** On a script, which stays remembered once it is allowed. */
  isAllowed?: true
}
