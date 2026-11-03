import type Backend from '../../backend'

/**
 * The pane's git words, unquoted as DiffDetailView words them.
 *
 * Compared with HEAD, read by `git diff`, untracked files listed by git and
 * staged with `git add :/…`.
 */
export const GIT_WORDS: Backend.BackendWords = Object.freeze({
  base: 'HEAD',
  diffCommand: 'git diff',
  lister: 'git',
  untrackedNoteOf: (path: string, isPasteable: boolean) => [
    'New file not yet staged.',
    isPasteable
      ? `Run \`git add :/${path}\` to see line counts.`
      : 'Stage it with git add to see line counts.',
  ],
})
