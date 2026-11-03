/**
 * A file name safe to paste, unquoted, into a stage command in any shell
 * (POSIX, PowerShell, cmd).
 *
 * Letters and digits of any script and `._/@+-` only: no quote of any
 * kind, no separator and no substitution can ride in it.
 */
export const SAFE_PATHSPEC_PATTERN = /^[\p{L}\p{N}._/@+-]+$/u
