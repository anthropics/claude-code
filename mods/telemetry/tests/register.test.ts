import type { Args } from 'claude-code'
import { describe, expect, mock, test, tier } from 'claude-code/testing'

import Fixtures from './fixtures'

tier('builtin')

describe('register', () => {
  test(
    'a $.telemetry.log call from a plugin posts one first-party row',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, { USER_TYPE: 'ant' })

      const posts = Fixtures.firstPartySession(on)

      expect(
        await $.command.run(Fixtures.record(Fixtures.surveyAnswer())),
      ).toEqual({ text: 'sent' })

      expect(
        posts.map(post => [post.url, post.init?.method, post.init?.auth]),
      ).toEqual([
        [
          'https://api.anthropic.com/api/event_logging/v2/batch',
          'POST',
          'the-handle',
        ],
      ])

      expect(posts.map(Fixtures.rowOf)).toEqual([
        {
          event_type: 'ClaudeCodeInternalEvent',
          hasTimestamp: true,
          event_name: 'tengu_plugin_survey_answered',
          session_id: 'the-session',
          model: 'the-model',
          user_type: 'ant',
          metadata: { answer: 2, page: 'ready', seen: true },
        },
      ])
    },
  )

  test(
    'a row already named tengu_ is sent under its own name',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, {})

      const posts = Fixtures.firstPartySession(on)

      await $.command.run(
        Fixtures.record({
          ...Fixtures.surveyAnswer(),
          event: 'tengu_repl_diff_panel_shown',
        }),
      )

      expect(posts.map(Fixtures.batchOf)).toMatchObject([
        {
          events: [
            {
              event_data: {
                event_name: 'tengu_repl_diff_panel_shown',
                user_type: 'external',
              },
            },
          ],
        },
      ])
    },
  )

  test(
    'nothing is sent where any switch has analytics off',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      let environment: Readonly<Record<string, string>> = {}

      on('env.get', ($, e) => ({ value: environment[e.name] }))

      const posts = Fixtures.firstPartySession(on)
      const answers: (string | undefined)[] = []

      for (const off of Fixtures.ANALYTICS_OFF_ENVIRONMENTS) {
        environment = { USER_TYPE: 'ant', ...off }

        answers.push(
          (await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))).text,
        )
      }

      const withheld = posts.length

      environment = { USER_TYPE: 'ant' }

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))

      expect(answers).toEqual(
        Fixtures.ANALYTICS_OFF_ENVIRONMENTS.map(() => 'sent'),
      )

      expect(withheld, 'nothing posted while any switch was off').toBe(0)
      expect(posts, 'then one row once every switch is clear').toHaveLength(1)
    },
  )

  test(
    'a third-party provider the host manages sends nothing too',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, {
        CLAUDE_CODE_USE_BEDROCK: '1',
        CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: '1',
      })

      const posts = Fixtures.firstPartySession(on)

      const { text } = await $.command.run(
        Fixtures.record(Fixtures.surveyAnswer()),
      )

      expect({ text, posts }).toEqual({ text: 'sent', posts: [] })
    },
  )

  test(
    'a $.telemetry.mark call posts the feature row by its own name',
    { plugins: [Fixtures.marking] },
    async ($, on) => {
      mock.env(on, { USER_TYPE: 'ant' })

      const posts = Fixtures.firstPartySession(on)
      const answers: (string | undefined)[] = []

      for (const entry of [
        { feature: 'learn_page', kind: 'ok' },
        { feature: 'learn_page', kind: 'sad', reason: 'blocked' },
        { feature: 'suggest_learning', kind: 'bad', reason: 'api_error' },
      ]) {
        answers.push((await $.command.run(Fixtures.mark(entry))).text)
      }

      expect(answers).toEqual(['sent', 'sent', 'sent'])

      expect(
        posts.map(Fixtures.rowOf),
        'the feature events by their own names, no plugin prefix',
      ).toMatchObject([
        {
          event_name: 'tengu_feature_ok',
          metadata: { feature_name: 'learn_page' },
        },
        {
          event_name: 'tengu_feature_sad',
          metadata: { feature_name: 'learn_page', error_code: 'blocked' },
        },
        {
          event_name: 'tengu_feature_bad',
          metadata: {
            feature_name: 'suggest_learning',
            error_code: 'api_error',
          },
        },
      ])
    },
  )

  test(
    'a mark with a bad kind or a wrong reason is refused, nothing sent',
    { plugins: [Fixtures.marking] },
    async ($, on) => {
      mock.env(on, { USER_TYPE: 'ant' })

      const posts = Fixtures.firstPartySession(on)

      const refusalFor = async (entry: unknown) =>
        (await $.command.run(Fixtures.mark(entry))).text

      expect(
        await refusalFor({ feature: 'learn_page', kind: 'meh' }),
      ).toEndWith("$.telemetry.mark: kind: 'ok', 'sad' or 'bad'")

      expect(
        await refusalFor({ feature: 'learn_page', kind: 'bad' }),
      ).toEndWith(
        '$.telemetry.mark: reason: a bad mark names why, a snake_case token',
      )

      expect(
        await refusalFor({ feature: 'learn_page', kind: 'ok', reason: 'x' }),
      ).toEndWith('$.telemetry.mark: reason: an ok mark carries none')

      expect(await refusalFor({ feature: 'Learn Page', kind: 'ok' })).toEndWith(
        '$.telemetry.mark: takes a feature name, a snake_case token',
      )

      expect(await refusalFor('x')).toEndWith(
        '$.telemetry.mark: takes one entry, { feature, kind, reason?, props? }',
      )

      expect(posts).toEqual([])
    },
  )

  test(
    'a session with no first-party credential is refused, nothing sent',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, {})

      const posts = Fixtures.firstPartySession(on, null)

      const { text } = await $.command.run(
        Fixtures.record(Fixtures.surveyAnswer()),
      )

      expect(text).toEndWith(
        '$.telemetry.log: this session has no first-party credential to ' +
          'authorize',
      )

      expect(posts).toEqual([])
    },
  )

  test(
    "the ingest's refusal rejects the caller's promise",
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, {})

      const posts = Fixtures.firstPartySession(
        on,
        Fixtures.BEARER,
        Fixtures.REFUSED,
      )

      const { text } = await $.command.run(
        Fixtures.record(Fixtures.surveyAnswer()),
      )

      expect(text).toEndWith('$.telemetry.log: the ingest answered 500')
      expect(posts).toHaveLength(1)
    },
  )

  test(
    'free text and a malformed entry are refused, nothing sent',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, {})

      const posts = Fixtures.firstPartySession(on)

      const refusalFor = async (entry: unknown) =>
        (
          await $.command.run({
            ...Fixtures.record(Fixtures.surveyAnswer()),
            args: JSON.stringify(entry),
          })
        ).text

      expect(
        await refusalFor({ event: 'x', props: { note: 'hello world' } }),
      ).toEndWith(
        '$.telemetry.log: props.note: free text is refused; a string is a ' +
          'Choice, { value, of: [...] }',
      )

      expect(
        await refusalFor({
          event: 'x',
          props: { page: { value: 'elsewhere', of: ['ready', 'later'] } },
        }),
      ).toEndWith(
        '$.telemetry.log: props.page.value: one of the members of `of`',
      )

      expect(await refusalFor({ event: 'Survey' })).toEndWith(
        '$.telemetry.log: takes an event name, a snake_case token',
      )

      expect(
        await refusalFor({ event: 'x', props: { 'a path': 1 } }),
      ).toEndWith('$.telemetry.log: props: every key is a snake_case token')

      expect(await refusalFor('x')).toEndWith(
        '$.telemetry.log: takes one entry, { event, props? }',
      )

      expect(posts).toEqual([])
    },
  )

  test(
    'a number that is not finite is refused, nothing sent',
    {
      plugins: [
        {
          name: 'counting',
          register(on) {
            on('command.run', { command: 'count' }, $ =>
              $.telemetry.log({ event: 'x', props: { n: Number.NaN } }).then(
                () => ({ text: 'sent' }),
                (error: unknown) => ({ text: String(error) }),
              ),
            )
          },
        },
      ],
    },
    async ($, on) => {
      mock.env(on, {})

      const posts = Fixtures.firstPartySession(on)

      const { text } = await $.command.run({
        command: 'count',
        args: '',
        origin: { kind: 'composer' },
      })

      expect(text).toEndWith('$.telemetry.log: props.n: a number is finite')
      expect(posts).toEqual([])
    },
  )

  test(
    'a failed authorize is not memoized; a retry sends',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      const posts: Args<'http.fetch'>[] = []

      let authorizations = 0

      mock.env(on, {})
      on('session.id', () => ({ value: 'the-session' }))
      on('session.model', () => ({ value: 'the-model' }))

      on('session.authorize', () => {
        authorizations += 1

        const isFirstAuthorization = authorizations === 1

        return isFirstAuthorization
          ? { deny: 'transient' }
          : { value: Fixtures.BEARER }
      })

      on('http.fetch', ($, e) => {
        posts.push(e)

        return { value: Fixtures.ACCEPTED }
      })

      const first = await $.command.run(Fixtures.record({ event: 'x' }))
      const postsAfterFirst = posts.length
      const second = await $.command.run(Fixtures.record({ event: 'x' }))

      expect(first.text).toContain('transient')
      expect(postsAfterFirst).toBe(0)
      expect(second.text).toBe('sent')
      expect(posts).toHaveLength(1)
    },
  )
})
