/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import Limits from '../../limits'
import PaneState from '../../pane-state'
import type { Kit } from '../kit'

/**
 * The pick between the working tree and a turn's edits (`Current`, then
 * `T<n>` per turn, newest first), drawn only when a turn exists.
 *
 * As DiffDialog hides its tabs with one source. Past MAX_LISTED_TURNS it
 * lists them in pages that share their two end turns: the engine keeps the
 * highlight by row, so only a pick of an end turn may move the list. Its
 * label counts what is listed, and such an end says where it leads.
 *
 * @param kit the elements and the handlers
 * @param model what is picked now and the turns to pick from
 * @returns the picker, or null without turns
 */
export function sourcePicker(
  kit: Kit,
  model: PaneState.PaneModel,
): RenderElement | null {
  const { Select } = kit.ui
  const { source, turns } = model
  const hasTurns = turns.length > 0

  const picked = PaneState.pickedTurnOf(model)
  const pickedAt = picked === undefined ? -1 : turns.indexOf(picked)

  const step = Limits.MAX_LISTED_TURNS - 2
  const lastPage = Math.ceil((turns.length - Limits.MAX_LISTED_TURNS) / step)
  const page = Math.min(Math.floor((pickedAt - 1) / step), lastPage)
  const first = step * Math.max(0, page)

  const listed = turns.slice(first, first + Limits.MAX_LISTED_TURNS)
  const hasOlder = first + listed.length < turns.length

  return hasTurns ? (
    <Select
      key="source"
      label={
        listed.length < turns.length
          ? `${listed.length} of ${turns.length}`
          : 'source'
      }
      options={[
        { value: 'current', label: 'Current' },
        ...listed.map((turn, at) => ({
          value: String(turn.index),
          label:
            first > 0 && at === 0
              ? `T${turn.index} (pick for newer)`
              : hasOlder && at === listed.length - 1
                ? `T${turn.index} (pick for older)`
                : `T${turn.index}`,
        })),
      ]}
      value={source.kind === 'current' ? 'current' : String(source.index)}
      onSelect={value => kit.actions.chooseSource(value)}
    />
  ) : null
}
