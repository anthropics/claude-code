import type Turns from '../../turns'
import type { DialogTitle } from '../dialog-title'

/**
 * A picked turn's heading, as the built-in dialog titles its tab: the
 * turn's number, then its prompt's opening words in quotes when it has any.
 *
 * @param turn the turn
 * @returns the title and its dim subtitle
 */
export const turnTitleOf = (
  turn: Pick<Turns.TurnDiff, 'index' | 'preview'>,
): DialogTitle => ({
  title: `Turn ${turn.index}`,
  subtitle: turn.preview === '' ? '' : `"${turn.preview}"`,
})
