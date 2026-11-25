/**
 * The open pane's HEAD poll as gitWordOf names it where no file answers.
 *
 * On disk the poll lists `.git` and spawns nothing, so a test that
 * lists the session's spawns as the built-in's lets this word by.
 */
export const POLL_WORD = 'rev-parse HEAD'
