import type { SessionMessage } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import Turns from '../../hooks/turns'
import Fixtures from '../fixtures'

tier('builtin')

describe('has-edited-turn', () => {
  test('answers as turnDiffsOf lists', () => {
    const prompt = Fixtures.promptOf('go')
    const edit = Fixtures.editsOf(Fixtures.editPatchOf(['+a']))
    const other = Fixtures.editsOf({ stdout: 'x' }, 'text', null)

    const staged = Fixtures.editsOf({
      ...Fixtures.editPatchOf(['+a']),
      staged: true,
    })

    const created = Fixtures.editsOf({
      type: 'create',
      filePath: '/r/new.ts',
      content: 'a\n',
      structuredPatch: [],
    })

    const transcripts: SessionMessage[][] = [
      [],
      [edit],
      [edit, prompt],
      [prompt, other, staged],
      [{ ...Fixtures.toolResults(), text: 'result' }, edit],
      [prompt, { ...edit, role: 'user', text: '' }],
      [prompt, edit],
      [prompt, created],
      [prompt, other, Fixtures.toolResults(), prompt, edit],
    ]

    expect(transcripts.map(Turns.hasEditedTurn)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
      true,
    ])

    expect(transcripts.map(Turns.hasEditedTurn)).toEqual(
      transcripts.map(rows => Turns.turnDiffsOf(rows).length > 0),
    )
  })

  test('reads no row past the first edit', () => {
    const read: number[] = []

    const rows = [
      Fixtures.promptOf('go'),
      Fixtures.editsOf(Fixtures.editPatchOf(['+a'])),
      Fixtures.editsOf(Fixtures.editPatchOf(['+b'])),
    ].map((row, at) => ({
      ...row,
      get toolUses() {
        read.push(at)

        return row.toolUses
      },
    }))

    expect(Turns.hasEditedTurn(rows)).toBe(true)
    expect(read).toEqual([1])
  })
})
