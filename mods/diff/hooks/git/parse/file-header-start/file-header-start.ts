/**
 * How the line that opens one file's patch starts. No line inside a patch
 * starts so: a hunk's lines start with a space, `+`, `-` or a backslash.
 */
export const FILE_HEADER_START = 'diff --git '
