import type Types from '../types'

/**
 * The staged rows of an unborn HEAD with the working tree's unstaged edits
 * folded in, as the built-in panel overlays them.
 *
 * Against the empty tree every surviving line is an addition: a path in
 * both diffs shows added = staged + unstaged added − unstaged removed
 * (never below 0), removed stays 0, and the added total moves with it.
 *
 * @param staged `git diff --cached --numstat`, capped
 * @param unstaged plain `git diff --numstat`, uncapped
 * @returns the staged result with corrected rows and totals
 */
export function overlayUnstaged(
  staged: Types.NumstatResult,
  unstaged: Types.NumstatResult,
): Types.NumstatResult {
  const edits = new Map(unstaged.files.map(file => [file.path, file]))

  const files = staged.files.map(file => {
    const edit = edits.get(file.path)

    if (!edit) {
      return file
    }

    const isBinary = file.isBinary || edit.isBinary

    const added = isBinary
      ? 0
      : Math.max(0, file.added + edit.added - edit.removed)

    return { ...file, added, removed: 0, isBinary }
  })

  const linesAdded =
    staged.stats.linesAdded +
    files.reduce((sum, file) => sum + file.added, 0) -
    staged.files.reduce((sum, file) => sum + file.added, 0)

  const stats = { ...staged.stats, linesAdded }

  return { stats, files }
}
