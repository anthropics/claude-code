/**
 * What in the git directory says a rebase stopped mid-way: `head`, the file
 * naming the commit it stopped at, beside a folder the rebase still keeps.
 *
 * `head` alone is no sign: git leaves it behind a rebase that finished.
 * The folder is `merge`, or `apply` while it holds the file `rebasing`
 * (without it the folder is a stopped `git am`'s).
 */
export const REBASE_MARKS = {
  head: 'REBASE_HEAD',
  merge: 'rebase-merge',
  apply: 'rebase-apply',
  rebasing: 'rebasing',
} as const
