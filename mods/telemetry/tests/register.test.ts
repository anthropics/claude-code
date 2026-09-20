import { describe, expect, mock, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'
import Fixtures from './fixtures'

tier('builtin')

const tiers = ['builtin', 'core', 'user', 'prepend', 'append'] as const

describe('register', () => {
  test(
    'rows queued through $.telemetry.log go out as one complete batch',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      await $.session.start(Fixtures.STARTED)

      const first = await $.command.run(
        Fixtures.record(Fixtures.surveyAnswer()),
      )

      await $.command.run(Fixtures.record({ event: 'again', props: { n: 1 } }))

      expect(first).toEqual({ text: 'queued' })
      expect(session.posts, 'nothing before the window passes').toEqual([])

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(
        session.posts.map(post => [
          post.url,
          post.init?.method,
          post.init?.auth,
          post.init?.headers,
        ]),
      ).toEqual([
        [
          'https://api.anthropic.com/api/event_logging/v2/batch',
          'POST',
          'the-handle',
          {
            'Content-Type': 'application/json',
            'x-service-name': 'claude-code',
          },
        ],
      ])

      expect(Fixtures.rowsOf(session)).toHaveLength(2)
      expect(Fixtures.rowsOf(session)[0]).toEqual(Fixtures.EXPECTED_ROW)

      expect(Fixtures.rowsOf(session)[1]).toMatchObject({
        event_name: 'tengu_plugin_again',
        metadata: { rh: Fixtures.REMOTE_HASH, n: 1 },
      })

      expect(session.lines).toEqual(['telemetry: sent 2 row(s)'])
    },
  )

  test(
    'a full queue goes out at once, before the window',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      for (let row = 0; row < Hooks.BATCH_ROWS; row++) {
        await $.command.run(Fixtures.record({ event: 'x', props: { row } }))
      }

      await session.clock.settle()

      expect(session.posts).toHaveLength(1)
      expect(Fixtures.rowsOf(session)).toHaveLength(Hooks.BATCH_ROWS)
    },
  )

  test(
    'the end of the session sends what still waits',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      await $.session.start(Fixtures.STARTED)
      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await $.session.end(Fixtures.ENDED)

      expect(Fixtures.rowsOf(session)).toEqual([Fixtures.EXPECTED_ROW])
    },
  )

  test(
    'a tengu_ name is kept; an external build sends no address',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, { ...Fixtures.SENDING_ENV, USER_TYPE: 'external' })

      const session = Fixtures.firstPartySession(on)

      await $.command.run(
        Fixtures.record({
          ...Fixtures.surveyAnswer(),
          event: 'tengu_repl_diff_panel_shown',
        }),
      )

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(Fixtures.rowsOf(session)[0]).toMatchObject({
        event_name: 'tengu_repl_diff_panel_shown',
        user_type: 'external',
        device_id: Fixtures.DEVICE_ID,
      })

      expect(Fixtures.rowsOf(session)[0]).not.toHaveProperty('email')
    },
  )

  test(
    'nothing is sent where any switch has analytics off',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      let environment: Readonly<Record<string, string>> = {}

      on('env.get', ($, e) => ({ value: environment[e.name] }))

      const session = Fixtures.firstPartySession(on)
      const answers: (string | undefined)[] = []

      for (const off of Fixtures.ANALYTICS_OFF_ENVIRONMENTS) {
        environment = { ...Fixtures.SENDING_ENV, ...off }

        answers.push(
          (await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))).text,
        )

        await session.clock.advance(Hooks.BATCH_WINDOW_MS)
      }

      const withheld = session.posts.length

      environment = Fixtures.SENDING_ENV

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(answers).toEqual(
        Fixtures.ANALYTICS_OFF_ENVIRONMENTS.map(() => 'queued'),
      )

      expect(withheld, 'nothing posted while any switch was off').toBe(0)

      expect(
        session.posts,
        'one batch once every switch is clear',
      ).toHaveLength(1)
    },
  )

  test(
    'a gateway the managed policy pins sends nothing',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on, {
        policy: { kind: 'settings', settings: { forceLoginMethod: 'gateway' } },
      })

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(session.posts).toEqual([])
    },
  )

  test(
    'unreadable switches send nothing, and the debug log says why',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on, {
        policy: { kind: 'unreadable' },
      })

      const { text } = await $.command.run(
        Fixtures.record(Fixtures.surveyAnswer()),
      )

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({ text, posts: session.posts }).toEqual({
        text: 'queued',
        posts: [],
      })

      expect(session.reads, 'nothing of the machine is read either').toEqual([])

      expect(session.lines.at(-1)).toStartWith(
        'telemetry: the analytics switches could not be read, so nothing is ' +
          'sent (',
      )
    },
  )

  test(
    'a host-managed third-party provider follows DISABLE_TELEMETRY',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      let environment = Fixtures.HOST_MANAGED_BEDROCK_ENV

      on('env.get', ($, e) => ({ value: environment[e.name] }))

      const session = Fixtures.firstPartySession(on)

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      const managed = session.posts.length

      environment = { ...environment, DISABLE_TELEMETRY: '1' }

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({ managed, afterOptOut: session.posts.length }).toEqual({
        managed: 1,
        afterOptOut: 1,
      })
    },
  )

  test(
    'marks go out as the feature events, by their own names',
    { plugins: [Fixtures.marking] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)
      const answers: (string | undefined)[] = []

      for (const entry of [
        { feature: 'learn_page', kind: 'ok' },
        { feature: 'learn_page', kind: 'sad', reason: 'blocked' },
        { feature: 'suggest_learning', kind: 'bad', reason: 'api_error' },
      ]) {
        answers.push((await $.command.run(Fixtures.mark(entry))).text)
      }

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(answers).toEqual(['queued', 'queued', 'queued'])

      expect(
        Fixtures.rowsOf(session),
        'one batch, the feature events by their own names, no plugin prefix',
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
    'a mark with a bad kind or a wrong reason is refused, nothing queued',
    { plugins: [Fixtures.marking] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

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

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(session.posts).toEqual([])
    },
  )

  test(
    'with no first-party credential nothing is sent, and the debug log says so',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on, {
        authorizations: [null],
      })

      const { text } = await $.command.run(
        Fixtures.record(Fixtures.surveyAnswer()),
      )

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({ text, posts: session.posts }).toEqual({
        text: 'queued',
        posts: [],
      })

      expect(session.lines.at(-1)).toBe(
        'telemetry: 1 row(s) not sent: this session has no first-party ' +
          'credential to authorize',
      )
    },
  )

  test(
    'a server error is tried once more; a second one drops the batch',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on, {
        answers: [Fixtures.REFUSED, Fixtures.REFUSED],
      })

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)
      await session.clock.advance(Hooks.RETRY_DELAY_MS)

      expect(session.posts).toHaveLength(2)

      expect(session.lines.at(-1)).toBe(
        'telemetry: 1 row(s) not sent: the ingest answered 500',
      )
    },
  )

  test(
    'a server error then an acceptance sends the batch',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on, {
        answers: [Fixtures.REFUSED, Fixtures.ACCEPTED],
      })

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)
      await session.clock.advance(Hooks.RETRY_DELAY_MS)

      expect(session.posts.map(post => post.init?.body)).toEqual([
        session.posts[0]?.init?.body,
        session.posts[0]?.init?.body,
      ])

      expect(session.lines.at(-1)).toBe('telemetry: sent 1 row(s)')
    },
  )

  test(
    'a client error is not retried',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on, {
        answers: [Fixtures.REJECTED],
      })

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)
      await session.clock.advance(Hooks.RETRY_DELAY_MS)

      expect(session.posts).toHaveLength(1)

      expect(session.lines.at(-1)).toBe(
        'telemetry: 1 row(s) not sent: the ingest answered 400',
      )
    },
  )

  test(
    'free text and a malformed entry are refused, nothing queued',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

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

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(session.posts).toEqual([])
    },
  )

  test(
    'a number that is not finite is refused, nothing queued',
    {
      plugins: [
        {
          name: 'counting',
          tier: 'builtin',
          register(on) {
            on('command.run', { command: 'count' }, $ =>
              $.telemetry.log({ event: 'x', props: { n: Number.NaN } }).then(
                () => ({ text: 'queued' }),
                (error: unknown) => ({ text: String(error) }),
              ),
            )
          },
        },
      ],
    },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      const { text } = await $.command.run({
        command: 'count',
        args: '',
        origin: { kind: 'composer' },
        presentation: Fixtures.FULLSCREEN,
      })

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(text).toEndWith('$.telemetry.log: props.n: a number is finite')
      expect(session.posts).toEqual([])
    },
  )

  test(
    'the config, the machine and the variables are read once a session',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)
      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({
        posts: session.posts.length,
        configReads: session.reads.filter(path => path === Fixtures.CONFIG_PATH)
          .length,
        runs: session.runs.map(run => run.argv.slice(0, 2)),
      }).toEqual({ posts: 2, configReads: 1, runs: [['sh', '-c']] })
    },
  )

  test(
    'on Windows the platform is read off the environment and no program runs',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.WINDOWS_ENV)

      const session = Fixtures.firstPartySession(on)

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(Fixtures.rowsOf(session)[0]).toMatchObject({
        env: {
          platform: 'win32',
          platform_raw: 'win32',
          arch: 'x64',
          shell: 'cmd',
          terminal: 'windows-terminal',
          deployment_environment: 'unknown-win32',
        },
      })

      expect(session.runs).toEqual([])
    },
  )

  test(
    'on Linux the distribution, kernel, WSL and EC2 come from their files',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, { ...Fixtures.SENDING_ENV, WSL_DISTRO_NAME: 'Ubuntu' })

      const session = Fixtures.firstPartySession(on, {
        probeOutput: Fixtures.LINUX_PROBED,
        files: Fixtures.LINUX_FILES,
        existing: ['/.dockerenv'],
      })

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(Fixtures.rowsOf(session)[0]).toMatchObject({
        env: {
          platform: 'linux',
          platform_raw: 'linux',
          arch: 'x64',
          terminal: 'ghostty',
          package_managers: 'npm',
          runtimes: 'node',
          linux_distro_id: 'ubuntu',
          linux_distro_version: '24.04',
          linux_kernel: '6.6.87.2-microsoft-standard-WSL2',
          wsl_version: '2',
          deployment_environment: 'aws-ec2',
        },
      })
    },
  )

  test(
    'in a GitHub Actions run the client and the workflow ids ride along',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.GITHUB_ACTION_ENV)

      const session = Fixtures.firstPartySession(on)

      await $.command.run(Fixtures.record(Fixtures.surveyAnswer()))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect(Fixtures.rowsOf(session)[0]).toMatchObject({
        client_type: 'github-action',
        entrypoint: 'claude-code-github-action',
        env: {
          is_ci: true,
          is_github_action: true,
          is_claude_code_action: true,
          deployment_environment: 'github-actions',
          github_event_name: 'pull_request',
          github_actions_runner_os: 'Linux',
          github_actions_runner_environment: 'github-hosted',
          github_action_ref: 'v1',
          github_actions_metadata: {
            actor_id: '11',
            repository_id: '22',
            repository_owner_id: '33',
          },
        },
      })
    },
  )

  test(
    'a failed authorize is not held against the next batch',
    { plugins: [Fixtures.recording] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on, {
        authorizations: ['refused', Fixtures.BEARER],
      })

      await $.command.run(Fixtures.record({ event: 'x' }))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      const postsAfterFirst = session.posts.length

      await $.command.run(Fixtures.record({ event: 'x' }))
      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({ postsAfterFirst, posts: session.posts.length }).toEqual({
        postsAfterFirst: 0,
        posts: 1,
      })

      expect(session.lines[0]).toContain('the credential store is locked')
    },
  )

  test(
    'a plugin a person installed is refused, and its own hook carries on',
    { plugins: [Fixtures.visiting] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      const { text } = await $.command.run(
        Fixtures.typed('visit', Fixtures.surveyAnswer()),
      )

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({ text, posts: session.posts }).toEqual({
        text: `HooksError: visiting: $.telemetry.log: ${Hooks.REFUSED.deny}`,
        posts: [],
      })
    },
  )

  test(
    'a plugin an administrator prepended is refused too',
    { plugins: [Fixtures.managing] },
    async ($, on) => {
      mock.env(on, Fixtures.SENDING_ENV)

      const session = Fixtures.firstPartySession(on)

      const { text } = await $.command.run(
        Fixtures.typed('manage', { feature: 'learn_page', kind: 'ok' }),
      )

      await session.clock.advance(Hooks.BATCH_WINDOW_MS)

      expect({ text, posts: session.posts }).toEqual({
        text: `HooksError: managing: $.telemetry.mark: ${Hooks.REFUSED.deny}`,
        posts: [],
      })
    },
  )

  test('the gate serves built-ins and core, throws on no origin', () => {
    expect(tiers.map(tier => Hooks.served({}, Fixtures.nextOf(tier)))).toEqual([
      'served',
      'served',
      Hooks.REFUSED,
      Hooks.REFUSED,
      Hooks.REFUSED,
    ])

    expect(() => Hooks.served({}, Fixtures.nextOf(undefined))).toThrow(
      '$.telemetry: the call names no origin',
    )
  })

  test('a gate that threw refuses; a refusal from beneath passes up', () => {
    expect(Hooks.caught({}, Fixtures.failingNext(false))).toEqual(Hooks.REFUSED)

    expect(() => Hooks.caught({}, Fixtures.failingNext(true))).toThrow(
      'beneath refused the entry',
    )
  })
})
