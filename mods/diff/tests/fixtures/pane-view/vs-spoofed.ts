import type Git from '../../../hooks/git'

/**
 * A branch comparison whose base branch name hides a right-to-left
 * override, to prove the view strips format characters.
 */
export const VS_SPOOFED: Pick<Git.DiffData, 'mode' | 'source'> = {
  mode: 'branch',
  source: { kind: 'branch', baseBranch: 'ma\u202Eniam', baseRef: 'abc' },
}
