import Limits from '../../limits'
import PaneState from '../../pane-state'
import { dialogEntriesOf } from './dialog-entries-of'
import { dialogWindowOf } from './dialog-window-of'

/**
 * The rows the dialog's content takes as dialogPane draws it, for the
 * `rows` an inline open asks for: title, blank, count, picker, body, hints.
 *
 * The body is the message line, the list's window with its `more files`
 * rows, or the file's name, rule and hunk lines (their wraps not counted:
 * the layout caps a long file anyway and its arrows scroll it).
 *
 * @param model the pane's state
 * @returns the rows wanted
 */
export function dialogRowsOf(model: PaneState.PaneModel): number {
  const entries = dialogEntriesOf(model)

  const hasCount =
    PaneState.pickedTurnOf(model) !== undefined || model.data !== null

  const isPaged = entries.length > Limits.MAX_VISIBLE_FILES
  const picked = entries.find(entry => entry.path === model.selectedPath)
  const isDetail = model.dialogView === 'detail' && picked !== undefined

  const start = dialogWindowOf(
    model,
    entries.map(entry => entry.path),
  )

  const lines = (picked?.body?.hunks ?? []).reduce(
    (sum, hunk) => sum + 1 + hunk.lines.length,
    0,
  )

  const listed = Math.min(entries.length - start, Limits.MAX_VISIBLE_FILES)

  const isEmpty = entries.length === 0
  const listRows = isEmpty ? 1 : listed + (isPaged ? 2 : 0)
  const bodyRows = isDetail ? 2 + Math.max(1, lines) : listRows

  return (
    2 + Number(hasCount) + Number(model.turns.length > 0) + 2 + bodyRows + 1
  )
}
