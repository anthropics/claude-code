/**
 * Whether a line after a hunk header is a body line (added, removed or
 * context) rather than a note such as `\ No newline at end of file`.
 *
 * @param line one line of `git diff` output
 * @returns whether it starts with `+`, `-` or a space
 */
export const isBodyLine = (line: string) =>
  line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')
