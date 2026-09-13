import type Views from '../../../hooks/views'
import { SMALL_BODY } from './small-body.js'

/**
 * A selected config file as the detail view takes it: untracked with no
 * body read, or tracked with a small body ready.
 *
 * @param isUntracked whether the file is untracked
 * @returns the detail model
 */
export const configDetailOf = (isUntracked: boolean): Views.DetailModel => ({
  words: { untrackedNoteOf: () => ['New file not yet staged.'] },
  path: 'src/app/config.ts',
  renamedFrom: null,
  isUntracked,
  isBinary: false,
  body: isUntracked ? null : SMALL_BODY,
  bodyState: isUntracked ? 'idle' : 'ready',
  isArmed: false,
})
