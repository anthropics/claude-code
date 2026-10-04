/**
 * Whether git printed an object name: 40 or 64 lowercase hex digits, the
 * only shape a merge-base may take before it reaches a `git diff` argv.
 *
 * @param text one trimmed line of git output
 * @returns whether it is a full object name
 */
export const isSha = (text: string) =>
  /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(text)
