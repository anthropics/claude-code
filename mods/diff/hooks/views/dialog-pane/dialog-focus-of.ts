import Limits from '../../limits'
import type PaneState from '../../pane-state'
import Sections from '../sections'
import { dialogEntriesOf } from './dialog-entries-of'
import { dialogWindowOf } from './dialog-window-of'

/**
 * What the focus ring landing on a dialog row makes of the list: that file
 * selected, the window re-centred, the key of the row drawn where it sits.
 *
 * DiffFileList's selection, which stops at an end where the ring wraps: a
 * jump across three or more rows from the first or last file is `stay`.
 * The ring goes to the row holding the file's place after the re-centre.
 *
 * @param model the pane's state
 * @param element the key of the element taking the ring
 * @returns the selection and the key to land on, `stay`, or null for a key
 *   that is none of the listed rows'
 */
export function dialogFocusOf(
  model: PaneState.PaneModel,
  element: string | undefined,
): PaneState.DialogFocus | 'stay' | null {
  const entries = dialogEntriesOf(model)
  const paths = entries.map(entry => entry.path)
  const keys = entries.map(entry => Sections.fileKeyOf(entry))
  const picked = keys.indexOf(element ?? '')
  const current = Math.max(0, paths.indexOf(model.selectedPath ?? ''))
  const before = dialogWindowOf(model, paths)

  const lastDrawn =
    Math.min(paths.length, before + Limits.MAX_VISIBLE_FILES) - 1

  const selectedPath = paths[picked] ?? null

  const landing =
    keys[before + picked - dialogWindowOf({ selectedPath }, paths)]

  const isOverStart = current === 0 && picked === lastDrawn
  const isOverEnd = current === paths.length - 1 && picked === before
  const isFar = lastDrawn - before >= 2
  const isRow = selectedPath !== null && landing !== undefined
  const isWrap = isFar && (isOverEnd || isOverStart)

  return isWrap ? 'stay' : isRow ? { selectedPath, landing } : null
}
