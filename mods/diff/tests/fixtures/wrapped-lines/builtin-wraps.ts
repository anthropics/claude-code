/**
 * The built-in panel's empty-state lines as Ink wraps them (trim off,
 * hard) at each width the layout case tries, keyed by line then width.
 */
export const BUILTIN_WRAPS: Readonly<
  Record<string, Readonly<Record<number, readonly string[]>>>
> = {
  'No changes this session': {
    8: ['No ', 'changes ', 'this ', 'session'],
    23: ['No changes this session'],
    24: ['No changes this session'],
    48: ['No changes this session'],
    70: ['No changes this session'],
  },
  "Couldn't read the git diff — it will retry on the next change": {
    8: [
      "Couldn't",
      ' read ',
      'the git ',
      'diff — ',
      'it will ',
      'retry on',
      ' the ',
      'next ',
      'change',
    ],
    23: [
      "Couldn't read the git ",
      'diff — it will retry on',
      ' the next change',
    ],
    24: [
      "Couldn't read the git ",
      'diff — it will retry on ',
      'the next change',
    ],
    48: ["Couldn't read the git diff — it will retry on ", 'the next change'],
    70: ["Couldn't read the git diff — it will retry on the next change"],
  },
  'No base branch to compare against — showing changes vs HEAD': {
    8: [
      'No base ',
      'branch ',
      'to ',
      'compare ',
      'against ',
      '— ',
      'showing ',
      'changes ',
      'vs HEAD',
    ],
    23: ['No base branch to ', 'compare against — ', 'showing changes vs HEAD'],
    24: ['No base branch to ', 'compare against — ', 'showing changes vs HEAD'],
    48: ['No base branch to compare against — showing ', 'changes vs HEAD'],
    70: ['No base branch to compare against — showing changes vs HEAD'],
  },
  'Tests and generated files are hidden · click "show" above to view them': {
    8: [
      'Tests ',
      'and gene',
      'rated ',
      'files ',
      'are ',
      'hidden ·',
      ' click ',
      '"show" ',
      'above to',
      ' view ',
      'them',
    ],
    23: [
      'Tests and generated ',
      'files are hidden · ',
      'click "show" above to ',
      'view them',
    ],
    24: [
      'Tests and generated ',
      'files are hidden · click',
      ' "show" above to view ',
      'them',
    ],
    48: [
      'Tests and generated files are hidden · click ',
      '"show" above to view them',
    ],
    70: [
      'Tests and generated files are hidden · click "show" above to view them',
    ],
  },
  'No changes vs a-release-branch-with-a-name-longer-than-a-row-of-the-pane': {
    8: [
      'No ',
      'changes ',
      'vs a-rel',
      'ease-bra',
      'nch-with',
      '-a-name-',
      'longer-t',
      'han-a-ro',
      'w-of-the',
      '-pane',
    ],
    23: [
      'No changes vs ',
      'a-release-branch-with-a',
      '-name-longer-than-a-row',
      '-of-the-pane',
    ],
    24: [
      'No changes vs a-release-',
      'branch-with-a-name-longe',
      'r-than-a-row-of-the-pane',
    ],
    48: [
      'No changes vs a-release-branch-with-a-name-longe',
      'r-than-a-row-of-the-pane',
    ],
    70: [
      'No changes vs ',
      'a-release-branch-with-a-name-longer-than-a-row-of-the-pane',
    ],
  },
}
