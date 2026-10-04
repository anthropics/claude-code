import type Backend from '../../../backend'
import type Git from '../../../git'

/**
 * One file as its body draws it.
 *
 * Its name as listed, what kind of row it is, its hunks once read (undefined
 * while they load, null when the backend could not read them), whether it is
 * armed for the next prompt, and the backend's words for an untracked note.
 */
export type DetailModel = {
  words: Pick<Backend.BackendWords, 'untrackedNoteOf'>
  path: string
  displayPath: string
  isUntracked: boolean
  isBinary: boolean
  body: Git.FileHunks | null | undefined
  isArmed: boolean
}
