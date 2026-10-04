import type Git from '../../git'
import type { PaneModel } from '../pane-model'

/**
 * One base mode's name in the picker, worded as the built-in's base line
 * (diffBaseLabel) words the mode it shows.
 *
 * Branch mode names its base branch from the data, or once its own fetch
 * settled without one says what stands in; uncommitted names the working
 * tree's base. The requested mode carries an ellipsis while pending.
 *
 * @param mode the mode to name
 * @param model the mode the person picked, the last good fetch, the words
 * @returns the label
 */
export function modeLabelOf(
  mode: Git.BaseMode,
  model: Pick<PaneModel, 'requestedMode' | 'data' | 'words'>,
): string {
  const { data } = model
  const source = data?.source
  const isPending = data !== null && model.requestedMode !== data.mode
  const isRequested = mode === model.requestedMode
  const suffix = isRequested && isPending ? '…' : ''
  const base = source?.kind === 'working-tree' ? source.base : model.words.base
  const isSettledBranch = isRequested && !isPending && data?.mode === 'branch'

  function nameOf(): string {
    switch (mode) {
      case 'session':
        return 'this session'
      case 'uncommitted':
        return `uncommitted (vs ${base})`
      case 'branch':
        if (source?.kind === 'branch') {
          return `branch vs ${source.baseBranch}`
        }

        return isSettledBranch ? `vs ${base} (no base branch)` : 'branch diff'
    }
  }

  return `${nameOf()}${suffix}`
}
