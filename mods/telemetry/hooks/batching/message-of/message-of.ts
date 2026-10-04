/**
 * What a batch's failure says, for the refusal each of its rows rejects
 * with: the error's own message, or the value as text.
 *
 * @param error what sending the batch threw
 * @returns the message
 */
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
