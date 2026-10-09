/**
 * What the debug line reads of a hook's failure: its kind and what it said.
 */
export type FailureRead = {
  readonly kind: string
  readonly message?: string
}
