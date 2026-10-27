import type { Args } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import Record from '../hooks/record'
import Fixtures from './fixtures'

tier('builtin')

describe('record', () => {
  test('a read marks how its hunks went, by the same names', async ($, on) => {
    let refusal: string | null = null

    const marked = Fixtures.keeping<Args<'telemetry.mark'>>()

    const world = Fixtures.inRepository(on, Fixtures.TWO_FILES, {
      hunksRefusal: () => refusal,
    })

    on('telemetry.mark', marked.hook)
    on('tool.call', () => ({ result: 'ran' }))

    await $.session.start(Fixtures.SESSION)
    await $.command.run(Fixtures.DIFF)
    await world.clock.advance(Fixtures.SETTLE_MS)

    refusal = Fixtures.GIT_HUNG

    await $.tool.call({ tool: 'Bash', command: 'make' })
    await world.clock.advance(Fixtures.SETTLE_MS)

    expect(
      marked.kept.filter(mark => mark.feature === Record.FEATURES.read),
      'one row a read: the counts came both times, the bodies once',
    ).toEqual([
      { feature: 'repl_diff_read', kind: 'ok' },
      { feature: 'repl_diff_read', kind: 'sad', reason: 'git_hunks_failed' },
    ])
  })
})
