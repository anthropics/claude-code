import { describe, expect, test, tier } from 'claude-code/testing'

import Parse from '../../../hooks/git/parse'

tier('builtin')

describe('parse-shortstat', () => {
  test('files, insertions and deletions; either tail optional', () => {
    expect(
      Parse.parseShortstat(
        ' 3 files changed, 10 insertions(+), 2 deletions(-)\n',
      ),
    ).toEqual({ filesCount: 3, linesAdded: 10, linesRemoved: 2 })

    expect(Parse.parseShortstat(' 1 file changed, 1 insertion(+)\n')).toEqual({
      filesCount: 1,
      linesAdded: 1,
      linesRemoved: 0,
    })

    expect(Parse.parseShortstat(' 1 file changed, 4 deletions(-)\n')).toEqual({
      filesCount: 1,
      linesAdded: 0,
      linesRemoved: 4,
    })
  })

  test('an empty diff prints nothing and parses to null', () => {
    expect(Parse.parseShortstat('')).toBeNull()
  })
})
