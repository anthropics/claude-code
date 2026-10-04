import Limits from '../../../limits'
import type PaneState from '../../../pane-state'
import type { BodyLayout, DockPlan } from '../types'
import Segments from './segments'

/**
 * The docked pane's scrolling body laid out under its pinned rows: the
 * segments and their rows, the window's rows, the files' and list's rows.
 *
 * The pinned rows are counted as sidebarPane draws them (header, base or
 * turn line, todo bar, list block); read from the box last drawn (`place`),
 * so before any draw the window shows nothing and the top stays 0.
 *
 * @param model the pane's state
 * @param plan the docked pane's decisions over that state
 * @returns the layout
 */
export function bodyLayoutOf(
  model: PaneState.PaneModel,
  plan: DockPlan,
): BodyLayout {
  const segments = Segments.segmentsOf(model, plan)
  const window = Segments.listWindowOf(model, plan)
  const hasNoise = !plan.turn && plan.partition.noiseCount > 0
  const isListed = plan.message.length === 0
  const hasList = isListed && (plan.rows.length > 0 || hasNoise)

  const listRows = hasList
    ? window.shown.length +
      Number(window.above > 0) +
      Number(window.below > 0 || plan.totals.notShown > 0) +
      Number(plan.isUntrackedNoted) +
      Number(hasNoise) +
      2
    : Number(isListed)

  const headRows =
    1 + Number(plan.line !== null) + (model.todos.total > 0 ? 2 : 0)

  const tops = new Map<string, number>()

  const visibleRows = Math.max(
    0,
    model.place.rows - Limits.PANE_TOP_PAD_ROWS - headRows - listRows,
  )

  let extent = 0

  for (const segment of segments) {
    if (segment.kind === 'rule' && segment.path !== null) {
      tops.set(segment.path, extent)
    }

    extent += Segments.segmentRowsOf(segment)
  }

  const listTop = Limits.PANE_TOP_PAD_ROWS + headRows + 1

  return {
    segments,
    extent,
    visibleRows,
    maxTop: Math.max(0, extent - visibleRows),
    tops,
    listTop,
    listEnd: hasList ? listTop + listRows - 2 : listTop,
  }
}
