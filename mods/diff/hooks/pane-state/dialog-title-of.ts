import type { DialogTitle } from './dialog-title'
import type { PaneModel } from './pane-model'
import { pickedTurnOf } from './picked-turn-of'
import { turnTitleOf } from './turn-title-of'

/**
 * The inline pane's heading (DiffDialog's title): the picked turn and its
 * prompt's opening words, or what the working tree is compared with.
 *
 * An unborn HEAD lists staged and new files; a branch diff names its base;
 * anything else is the uncommitted changes against HEAD.
 *
 * @param model the pane's state
 * @returns the title and its dim subtitle
 */
export function dialogTitleOf(model: PaneModel): DialogTitle {
  const turn = pickedTurnOf(model)
  const source = model.data?.source
  const isUnborn = model.data?.isUnborn === true
  const isBranch = source?.kind === 'branch'

  function currentOf(): DialogTitle {
    switch (true) {
      case isUnborn:
        return { title: 'Staged and new files', subtitle: '(no commits yet)' }
      case isBranch && source?.kind === 'branch':
        return {
          title: 'Branch changes',
          subtitle: `(vs ${source.baseBranch})`,
        }
      default:
        return { title: 'Uncommitted changes', subtitle: '(git diff HEAD)' }
    }
  }

  return turn ? turnTitleOf(turn) : currentOf()
}
