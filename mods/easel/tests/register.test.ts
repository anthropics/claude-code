import { describe, expect, test, tier } from 'claude-code/testing'

import Fixtures from './fixtures'

tier('builtin')

describe('register', () => {
  test('a chart call draws', async ($, on) => {
    Fixtures.watchedTerminal(on)

    const answer = await $.tool.call({
      tool: 'mcp__easel__chart',
      data: 'fruit,crates\napples,12\npears,7\nplums,3',
      x: 'fruit',
      y: ['crates'],
    })

    expect(answer).toMatchObject({
      result: [{ type: 'text', text: expect.stringContaining('bar chart') }],
    })
    expect(JSON.stringify(answer)).toContain('apples: 12')
  })

  test('the answer of a metrics service gets an automatic chart', async ($, on) => {
    Fixtures.watchedTerminal(on)
    on('tool.call', { tool: Fixtures.QUERY_TOOL }, () => ({
      result: Fixtures.METRICS,
    }))

    const answer = await $.tool.call({ tool: Fixtures.QUERY_TOOL })
    const drawn = JSON.stringify(
      await $.ui.render(Fixtures.queryRow(Fixtures.METRICS)),
    )

    expect(JSON.stringify(answer)).toContain('easel made an auto chart')
    expect(drawn).toContain(Fixtures.HOST_ROW)
    expect(drawn).toContain('auto chart')
    expect(drawn).toContain('kettle')
  })

  test('any other answer gets none', async ($, on) => {
    Fixtures.watchedTerminal(on)
    on('tool.call', { tool: Fixtures.QUERY_TOOL }, () => ({
      result: Fixtures.ROWS,
    }))

    const answer = await $.tool.call({ tool: Fixtures.QUERY_TOOL })
    const drawn = JSON.stringify(
      await $.ui.render(Fixtures.queryRow(Fixtures.ROWS)),
    )

    expect(JSON.stringify(answer)).not.toContain('auto chart')
    expect(drawn).toContain(Fixtures.HOST_ROW)
    expect(drawn).not.toContain('auto chart')
  })
})
