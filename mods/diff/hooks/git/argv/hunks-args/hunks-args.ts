/**
 * What the hunks read adds to the shared diff argv: the listed names and
 * every file's patch from one child, each file as it reads when asked alone.
 *
 * `--raw -z` heads the answer with the names as git holds them, NUL-ended
 * and never quoted; no rename is paired among the paths asked together, as
 * none can be for one path; the header's `a/` and `b/` hold whatever a
 * person's `diff.noprefix`, `diff.mnemonicPrefix` or prefixes are set to.
 */
export const HUNKS_ARGS = [
  '--no-renames',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--raw',
  '-z',
  '-p',
] as const
