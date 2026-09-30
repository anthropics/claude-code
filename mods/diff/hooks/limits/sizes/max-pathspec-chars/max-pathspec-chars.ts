/**
 * How many characters of paths one git child is handed on its command
 * line; the rest are asked of a further child.
 *
 * Windows holds a whole command line to 32,767 characters and doubles a
 * quote or a backslash it has to escape: twice this, the quotes around each
 * path and the leading arguments stay under it.
 */
export const MAX_PATHSPEC_CHARS = 12_000
