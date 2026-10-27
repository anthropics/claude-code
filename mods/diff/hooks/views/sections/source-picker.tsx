/* @jsxRuntime classic */
/* @jsx h */
/* @jsxFrag Fragment */
import type { RenderElement } from 'claude-code'

import type PaneState from '../../pane-state'
import type { Kit } from '../kit'

/**
 * The pick between the working tree and a turn's edits (`Current`, then
 * `T<n>` per turn, newest first), drawn only when a turn exists.
 *
 * As DiffDialog hides its tabs with one source.
 *
 * @param kit the elements and the handlers
 * @param model what is picked now and the turns to pick from
 * @returns the picker, or null without turns
 */
export function sourcePicker(
  kit: Kit,
  model: Pick<PaneState.PaneModel, 'source' | 'turns'>,
): RenderElement | null {
  const { Select } = kit.ui
  const { source, turns } = model
  const hasTurns = turns.length > 0

  return hasTurns ? (
    <Select
      key="source"
      label="source"
      options={[
        { value: 'current', label: 'Current' },
        ...turns.map(turn => ({
          value: String(turn.index),
          label: `T${turn.index}`,
        })),
      ]}
      value={source.kind === 'current' ? 'current' : String(source.index)}
      onSelect={value => kit.actions.chooseSource(value)}
    />
  ) : null
}
