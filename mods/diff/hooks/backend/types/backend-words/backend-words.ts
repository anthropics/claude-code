/**
 * The words the pane draws that name the backend.
 *
 * What uncommitted mode compares against, the command whose failure the
 * empty state names, the tool that lists untracked files, and the note
 * under an untracked row.
 */
export type BackendWords = {
  /**
   * What the working tree is compared with outside branch mode: `HEAD`.
   */
  base: string

  /**
   * The command a failed fetch could not read: `git diff`.
   */
  diffCommand: string

  /**
   * The program that lists untracked files: `git`.
   */
  lister: string

  /**
   * The dim lines under an untracked row: what it is, and how to get its
   * line counts (a pasteable command only when the path is safe to paste).
   */
  untrackedNoteOf: (path: string, isPasteable: boolean) => readonly string[]
}
