/**
 * Whether a line `rev-parse --path-format=absolute` printed is an absolute
 * path (POSIX or drive-letter), and so neither relative nor an echoed flag.
 *
 * @param line one line of rev-parse output
 * @returns whether it names an absolute path
 */
export const isAbsolutePath = (line: string) =>
  line.startsWith('/') || /^[A-Za-z]:[\\/]/.test(line)
