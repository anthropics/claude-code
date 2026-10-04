/**
 * A thrown or rejected value as the words it carries: an Error's message,
 * anything else as a string.
 *
 * @param error what was caught
 * @returns the message
 */
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
