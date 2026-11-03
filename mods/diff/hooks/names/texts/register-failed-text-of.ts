/**
 * The transcript line when `/diff` could not be registered for a reason
 * other than the built-in holding it: the person learns the pane is off.
 *
 * @param reason the refusal's message
 * @returns the line
 */
export const registerFailedTextOf = (reason: string) =>
  `could not register /diff: ${reason}; the diff panel is unavailable this ` +
  `session`
