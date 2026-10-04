/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import { keptOf } from '../../kept-of'
import Names from '../../names'
import type PaneState from '../../pane-state'
import type Entries from '../entries'
import type { Kit } from '../kit'
import Layout from '../layout'
import Sections from '../sections'
import Plan from './plan'
import type { DockPlan } from './types'

/**
 * The docked list block (ReplDiffSidebar's summary rows): the window's rows
 * between its edge rows, the untracked note, the noise toggle.
 *
 * The edge rows count the files out of the window and take the built-in's
 * list keys; files past the row cap join the lower one. Empty with no row
 * and no noise to toggle.
 *
 * @param kit the elements, the handlers, the width
 * @param model the pane's state
 * @param plan the docked pane's decisions over that state
 * @returns the block's rows
 */
export function listBlockOf(
  kit: Kit,
  model: PaneState.PaneModel,
  plan: DockPlan,
): RenderElement[] {
  const { shown, above, below } = Plan.listWindowOf(model, plan)
  const { noiseCount } = plan.partition
  const { notShown } = plan.totals
  const hasNoise = !plan.turn && noiseCount > 0
  const hasMoreAbove = above > 0
  const hasMoreBelow = below > 0
  const hasNotShown = notShown > 0
  const noiseFace = model.isNoiseShown ? 'hide' : 'show'

  const lower = keptOf([
    hasMoreBelow ? `${below} ${Names.MORE_BELOW_TEXT}` : null,
    hasNotShown ? `${notShown} not shown` : null,
  ]).join(' · ')

  const rowOf = (entry: Entries.BodyEntry) =>
    Sections.fileRow(
      kit,
      {
        key: Sections.fileKeyOf(entry),
        path: entry.path,
        displayPath: entry.displayPath,
        added: entry.added,
        removed: entry.removed,
        note: null,
        isSelected: false,
      },
      () => kit.actions.selectFile(entry.path),
    )

  const upperEdge = hasMoreAbove
    ? Sections.listEdgeButton(kit, 'list-up', `↑ ${above} more above`)
    : null

  const lowerEdge = hasMoreBelow
    ? Sections.listEdgeButton(kit, 'list-down', `↓ ${lower}`)
    : hasNotShown
      ? Sections.dimNote(kit, `… ${lower}`)
      : null

  const noiseToggle = hasNoise
    ? Sections.toggleRow(kit, 'noise', {
        label: `${Layout.plural(noiseCount, 'test')}/generated (${noiseFace})`,
        onPress: kit.actions.toggleNoise,
      })
    : null

  return Sections.present([
    upperEdge,
    ...shown.map(rowOf),
    lowerEdge,
    plan.isUntrackedNoted
      ? Sections.dimNote(kit, Names.untrackedWithheldTextOf(model))
      : null,
    noiseToggle,
  ])
}
