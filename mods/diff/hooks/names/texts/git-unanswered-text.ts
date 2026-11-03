/**
 * `/diff`'s answer when git did not say whether this is a repository.
 *
 * It timed out: the directory is unknown, not outside one. A git that
 * cannot start has answered, and gets the not-a-repository text.
 */
export const GIT_UNANSWERED_TEXT =
  "The diff panel couldn't read git state — git didn't answer; run /diff " +
  'again'
