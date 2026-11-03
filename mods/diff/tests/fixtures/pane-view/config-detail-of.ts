import type Views from '../../../hooks/views'
import { SMALL_BODY } from './small-body.js'

/**
 * A config file as the detail view takes it: untracked with no body read,
 * or tracked with a small body ready.
 *
 * @param isUntracked whether the file is untracked
 * @returns the detail model
 */
export const configDetailOf = (isUntracked: boolean): Views.DetailModel => ({
  words: { untrackedNoteOf: () => ['New file not yet staged.'] },
  path: 'src/app/config.ts',
  displayPath: 'src/app/config.ts',
  isUntracked,
  isBinary: false,
  body: isUntracked ? undefined : SMALL_BODY,
  isArmed: false,
})
