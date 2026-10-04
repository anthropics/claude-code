/**
 * The environment of an internal build's session on a Mac, in Ghostty under
 * zsh, signed in, its config under HOME: every switch clear, so rows go.
 */
export const SENDING_ENV: Readonly<Record<string, string>> = {
  USER_TYPE: 'ant',
  CLAUDE_CODE_ENTRYPOINT: 'cli',
  TERM_PROGRAM: 'ghostty',
  SHELL: '/bin/zsh',
  HOME: '/Users/person',
}
