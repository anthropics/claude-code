import { describe, expect, test, tier } from 'claude-code/testing'

import Parse from '../../../hooks/git/parse'
import Limits from '../../../hooks/limits'
import Fixtures from '../../fixtures'

tier('builtin')

describe('parse-file-diff', () => {
  test('hunk starts and marked lines; header and notes skipped', () => {
    const parsed = Parse.parseFileDiff(
      `${Fixtures.FILE_DIFF_HEADER}@@ -1,3 +1,3 @@\n one\n-two\n+two ` +
        `changed\n three\n\\ No newline at end of file\n@@ -10 +10,2 @@ fn\n ` +
        `ctx\n+added\n`,
    )

    expect(parsed.isLarge).toBe(false)
    expect(parsed.isTruncated).toBe(false)

    expect(parsed.hunks).toEqual([
      {
        oldStart: 1,
        newStart: 1,
        lines: [' one', '-two', '+two changed', ' three'],
      },
      { oldStart: 10, newStart: 10, lines: [' ctx', '+added'] },
    ])
  })

  test('a removed line that starts with dashes is body, not a header', () => {
    expect(
      Parse.parseFileDiff(
        `${Fixtures.FILE_DIFF_HEADER}@@ -1 +1 @@\n---- old rule\n+--- new ` +
          `rule\n`,
      ).hunks[0]?.lines,
    ).toEqual(['---- old rule', '+--- new rule'])
  })

  test('the body is cut at the line cap and marked truncated', () => {
    const body = Array.from(
      { length: Limits.MAX_LINES_PER_FILE + Fixtures.PAST_THE_CAP },
      (_, at) => `+${at}`,
    ).join('\n')

    const parsed = Parse.parseFileDiff(
      `${Fixtures.FILE_DIFF_HEADER}@@ -0,0 +1,405 @@\n${body}\n`,
    )

    expect(parsed.hunks[0]?.lines).toHaveLength(Limits.MAX_LINES_PER_FILE)
    expect(parsed.isTruncated).toBe(true)
  })

  test('a diff past the byte cap is large and has no hunks', () => {
    expect(
      Parse.parseFileDiff(
        `${Fixtures.FILE_DIFF_HEADER}@@ -1 +1 ` +
          `@@\n+${'x'.repeat(Limits.MAX_DIFF_BYTES)}\n`,
      ),
    ).toEqual({ hunks: [], isTruncated: false, isLarge: true })
  })
})
