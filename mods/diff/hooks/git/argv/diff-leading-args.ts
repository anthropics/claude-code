/**
 * The leading argv of every `git diff` the plugin runs: the config the
 * engine's own diff panel pins, `core.quotePath=false`, and raw-blob flags.
 *
 * Root-relative paths whatever `diff.relative` says, non-ASCII paths as
 * their own bytes, no optional locks, no child `git status` in a dirty
 * submodule, and no external diff or textconv driver even on a stats pass.
 * A `git add -N` file counts as an empty file in the index, so `--cached`
 * lists it; the working tree against a commit reads the same either way.
 */
export const DIFF_LEADING_ARGS = [
  '--no-optional-locks',
  '-c',
  'diff.relative=false',
  '-c',
  'core.quotePath=false',
  'diff',
  '--no-ext-diff',
  '--no-textconv',
  '--ita-visible-in-index',
  '--ignore-submodules=dirty',
  '--submodule=short',
] as const
