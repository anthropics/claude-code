import type Turns from '../../../hooks/turns'

/**
 * The second turn of a session as the turns model keeps it: one created
 * file, its hunk cut at the line cap.
 */
export const TURN_TWO: Turns.TurnDiff = {
  index: 2,
  preview: 'fix it',
  files: [
    {
      path: '/r/a.ts',
      hunks: [{ oldStart: 1, newStart: 1, lines: ['+x'] }],
      added: 1,
      removed: 0,
      isNewFile: true,
      isTruncated: true,
    },
  ],
}
