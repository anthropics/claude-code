import { describe, expect, test, tier } from 'claude-code/testing'

import Views from '../../../hooks/views'
import Fixtures from '../../fixtures'

tier('builtin')

describe('detail-view', () => {
  test('each hunk draws as a diff Code named by the path', async ($, on) => {
    Fixtures.drawsPane(
      on,
      kit =>
        Views.detailView(
          kit,
          {
            words: { untrackedNoteOf: () => [] },
            path: 'src/app/config.ts',
            displayPath: 'src/app/config.ts',
            isUntracked: false,
            isBinary: false,
            body: {
              hunks: [
                {
                  oldStart: 1,
                  newStart: 1,
                  lines: [' a = 1', '-b = 2', '+b = 3', ' c = 4'],
                },
                {
                  oldStart: Fixtures.BIG_LINES,
                  newStart: Fixtures.BIG_LINES,
                  lines: [' x = 1', '+y = 2'],
                },
              ],
              isTruncated: false,
              isLarge: false,
            },
            isArmed: false,
          },
          Views.BODY_BUDGET,
        ).element,
    )

    const tree = await $.ui.render(Fixtures.VIEW_PANE)

    expect(Fixtures.codesIn(tree)).toEqual([
      {
        source: [
          '@@ -1,3 +1,3 @@',
          ' a = 1',
          '-b = 2',
          '+b = 3',
          ' c = 4',
        ].join('\n'),
        format: 'diff',
        path: 'src/app/config.ts',
      },
      {
        source: ['@@ -1000,1 +1000,2 @@', ' x = 1', '+y = 2'].join('\n'),
        format: 'diff',
        path: 'src/app/config.ts',
      },
    ])

    expect(Fixtures.isDrawn(tree), 'the engine took the tree').toBe(true)
    expect(Fixtures.jsonOf(tree)).not.toContain('truncated')
  })

  test("the name sits over the built-in's dim rule", async ($, on) => {
    let isUntracked = false

    Fixtures.drawsPane(
      on,
      kit =>
        Views.detailView(
          kit,
          Fixtures.configDetailOf(isUntracked),
          Views.BODY_BUDGET,
        ).element,
    )

    for (const untracked of [false, true]) {
      isUntracked = untracked

      const [name, rule, body] = Fixtures.childrenOf(
        await $.ui.render(Fixtures.VIEW_PANE),
      )

      expect(Fixtures.stringsOf(name)).toContain('src/app/config.ts')
      expect(Fixtures.stringsOf(rule)).toEqual(['─'.repeat(Fixtures.COLUMNS)])
      expect(body).toBeDefined()
    }
  })
})
