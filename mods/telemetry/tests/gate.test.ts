import { describe, expect, mock, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'
import Fixtures from './fixtures'

tier('builtin')

const refusal = `HooksError: reaching: $.telemetry.log: ${Hooks.REFUSED.deny}`

describe('gate', () => {
  test(
    'the table an engine.create step is handed serves no one above either',
    { plugins: [Fixtures.recording, Fixtures.reaching] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      on('tool.call', () => ({ result: 'read' }))

      await $.session.start(Fixtures.STARTED)
      await session.clock.advance(1)
      await $.tool.call(Fixtures.READ_TOOL)

      const during = (await $.command.run(Fixtures.typed('reach', {}))).text

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({
        isServedDuringCreate: during === 'served',
        later: session.lines.filter(line => !line.startsWith('telemetry: ')),
        rows: Fixtures.rowsOf(session).map(Fixtures.eventNameOf),
      }).toEqual({
        isServedDuringCreate: false,
        later: [`timer: ${refusal}`, `tool: ${refusal}`],
        rows: ['tengu_plugin_survey_answered'],
      })
    },
  )

  test(
    'a module that keeps the table to call later never loads',
    { plugins: [Fixtures.holding] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      const held = await $.command
        .run(Fixtures.typed('hold', {}))
        .then(result => result.text, String)

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({
        isLoaded: !String(held).includes('did not load'),
        posts: session.posts,
      }).toEqual({ isLoaded: false, posts: [] })
    },
  )

  test(
    'a hook above may rename a row a built-in sends, never send its own',
    { plugins: [Fixtures.recording, Fixtures.meddling] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)
      const own = (await $.command.run(Fixtures.typed('meddle', {}))).text

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({
        own,
        rows: Fixtures.rowsOf(session).map(Fixtures.eventNameOf),
      }).toEqual({
        own: `HooksError: meddling: $.telemetry.log: ${Hooks.REFUSED.deny}`,
        rows: ['tengu_plugin_renamed'],
      })
    },
  )

  test(
    'a hook above that answers without going on sends nothing at all',
    { plugins: [Fixtures.recording, Fixtures.swallowing] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      const answer = (
        await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      ).text

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({ answer, posts: session.posts }).toEqual({
        answer: 'queued',
        posts: [],
      })
    },
  )

  test(
    'a step above cannot hand up its own telemetry in place of this one',
    { plugins: [Fixtures.recording, Fixtures.replacing] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)
      const own = (await $.command.run(Fixtures.typed('replace', {}))).text

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({
        own,
        rows: Fixtures.rowsOf(session).map(Fixtures.eventNameOf),
      }).toEqual({
        own: `HooksError: replacing: $.telemetry.log: ${Hooks.REFUSED.deny}`,
        rows: ['tengu_plugin_survey_answered'],
      })
    },
  )
})
