/**
 * The leading argv of every `git diff` the plugin runs: the config the
 * engine's own diff panel pins, `core.quotePath=false`, and raw-blob flags.
 *
 * Root-relative paths whatever `diff.relative` says, non-ASCII paths as
 * their own bytes, no optional locks, no child `git status` in a dirty
 * submodule, and no external diff or textconv driver even on a stats pass.
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
  '--ignore-submodules=dirty',
  '--submodule=short',
] as const
