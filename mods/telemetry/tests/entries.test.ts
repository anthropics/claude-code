import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'

tier('builtin')

const ID = 'Code-Review@official'
const DONE = { event: 'done' }

const propsOf = (count: number) =>
  Object.fromEntries(Array.from({ length: count }, (_, at) => [`k${at}`, at]))

const choiceOf = (value: string) => ({ value, of: [value] })

describe('entries', () => {
  test('mixed-case words go as spelled, key or member, whoever calls', () => {
    for (const text of [
      'idleMinutes',
      'timeToFirstKeystrokeMs',
      'PreToolUse',
      'acceptEdits',
      'dontAsk',
      'costUSD',
      'toolUseID',
      'isOAuthFlow',
      'isMcp',
      'isFullscreen',
      'nameUtf16Length',
      'cacheEphemeral1hTokens',
      'userSettings_Bash_scoped',
      'REPL',
      'toString',
      'toJSON',
      'hasOwnProperty',
      `${'Word'.repeat(15)}Last`,
    ]) {
      for (const pluginId of [undefined, ID]) {
        const props = { [text]: 1, any: choiceOf(text) }
        const fields = Hooks.checkedFields({ ...DONE, props }, pluginId)
        const row = { fields, eventId: '', loggedAt: '' }

        expect(JSON.parse(atob(Hooks.metadataOf(row, undefined)))).toEqual({
          [text]: 1,
          any: text,
          ...(pluginId !== undefined && { pluginId }),
        })

        expect(
          Hooks.checkedMark({ feature: 'f', kind: 'ok', props }, pluginId)
            .props,
        ).toMatchObject({ [text]: 1, any: text })
      }
    }
  })

  test('mixed-case text that is not words is refused, whoever calls', () => {
    for (const text of [
      // Free text, paths, addresses and host names.
      'Hello World',
      'Users/Shared',
      'C:\\Users',
      'README.md',
      'Team@Example',
      'Office-MacBook-Pro',
      'Word\n',
      // Past ASCII, a letter that lowercases into it included.
      'Caf\u00e9',
      '\u212aey',
      // Past the length, or not starting as a token does.
      `${'Word'.repeat(16)}s`,
      '_Word',
      // Ids and keys.
      'toolu_01AbCdEfGhJkMnPqRsTuVwXy',
      'req_011CAbCdEfGhJkMnPqRsTuVw',
      'tok_abCdEfGhJkMnPqRs',
      'U0ABCDE1234',
      'D1E2A3D4-BEEF-4A5B-8C9D-0E1F2A3B4C5D',
      'DEADBEEF',
      'eyJhbGciOiJub25lIn0',
      'WDJB-MJHT',
      // One rule of the shape each.
      'ENOENT',
      'NO_SUCH_TOOL',
      'costUSDToEUR',
      'userHTTPSCount',
      'orderNo123',
      'stage1Part2',
      'user_12Count',
      'planS3',
      'abEcWord',
      'MsgCtxWord',
      'Abcdfgh',
    ]) {
      for (const pluginId of [undefined, ID]) {
        for (const [props, reason] of [
          [{ [text]: 1 }, 'props: every key is'],
          [{ any: choiceOf(text) }, 'props.any.of: a list of'],
          [{ any: { value: 'a', of: ['a', text] } }, 'props.any.of: a list of'],
        ] as const) {
          expect(() =>
            Hooks.checkedFields({ ...DONE, props }, pluginId),
          ).toThrow(reason)

          expect(() =>
            Hooks.checkedMark({ feature: 'f', kind: 'ok', props }, pluginId),
          ).toThrow(reason)
        }
      }
    }
  })

  test('an event, a feature and a reason stay lowercase', () => {
    expect(() => Hooks.checkedFields({ event: 'scanDone' })).toThrow(
      'snake_case token',
    )

    for (const mark of [
      { feature: 'scanPage', kind: 'ok' },
      { feature: 'f', kind: 'sad', reason: 'timedOut' },
    ]) {
      expect(() => Hooks.checkedMark(mark)).toThrow('snake_case token')
    }
  })

  test('pluginId in any case, or a key given twice, is refused to all', () => {
    for (const pluginId of [undefined, ID]) {
      for (const key of ['pluginId', 'pluginid', 'PluginId', 'pluginID']) {
        expect(() =>
          Hooks.checkedFields({ ...DONE, props: { [key]: 1 } }, pluginId),
        ).toThrow(`props.${key}: this key is reserved`)
      }

      expect(() =>
        Hooks.checkedFields(
          { ...DONE, props: { pageCount: 1, pagecount: 2 } },
          pluginId,
        ),
      ).toThrow('props.pagecount: repeats a key')
    }
  })

  test('a Choice goes under a plain camelCase key, in its one spelling', () => {
    const sent = (key: string, value: unknown, pluginId?: string) =>
      Hooks.checkedFields({ ...DONE, props: { [key]: value } }, pluginId).props[
        key
      ]

    for (const pluginId of [undefined, ID]) {
      for (const key of [
        'cacheColdBy',
        'stage2Outcome',
        'toolUseID',
        'messageUUID',
        'statusAtPTL',
        'gitBranch',
        'exitCause',
        'command_name',
        'commandname',
      ]) {
        expect(sent(key, choiceOf('a'), pluginId)).toBe('a')
      }

      for (const key of [
        // Not plain camelCase.
        'PickedOne',
        'picked_One',
        'pickedOne_',
        'pickedONE',
        'pickedURLKind',
        // Another spelling of a key that is read by one.
        'subagentName',
        'parentAgentId',
        'parentAgentID',
        'errorTopFrame',
        'commandType',
        'errorName',
        'windowModel',
        'originalModel',
        'fallbackModel',
        'fromModel',
        'toModel',
        'modelId',
        'chainEntry',
        'fallBackFrom',
        'shorTname',
        'gitBraNch',
        'reaSon',
        'teamName',
        'workflowName',
        'hostName',
        'exitcauSe',
        'flagGed',
      ]) {
        expect(() => sent(key, choiceOf('a'), pluginId)).toThrow(
          `props.${key}: this spelling takes no Choice`,
        )
        expect(sent(key, 1, pluginId)).toBe(1)
      }
    }

    for (const key of ['commandName', 'agentType']) {
      expect(sent(key, choiceOf('a'))).toBe('a')
      expect(sent(key, true, ID)).toBe(true)
      expect(() => sent(key, choiceOf('a'), ID)).toThrow(
        `props.${key}: takes a number or a boolean`,
      )
    }

    for (const key of ['pluginRepository', 'marketplaceName', 'featureName']) {
      expect(() => sent(key, choiceOf('a'))).toThrow('takes no Choice')
    }
  })

  test('a key beside a reserved name stays free', () => {
    const props = {
      plugins_count: 1,
      pluginsCount: 1,
      request_id: 1,
      tool_name: choiceOf('Bash'),
      short_name: choiceOf('a'),
      attribution_mode: 1,
      modelCount: choiceOf('many'),
      hadError: true,
    }

    expect(
      Object.keys(Hooks.checkedFields({ ...DONE, props }, ID).props),
    ).toEqual([...Object.keys(props), 'pluginId'])
  })

  test('twenty properties go, one more is refused, whoever calls', () => {
    for (const pluginId of [undefined, ID]) {
      const stamp = pluginId === undefined ? 0 : 1
      const log = (count: number) =>
        Hooks.checkedFields({ ...DONE, props: propsOf(count) }, pluginId)
      const mark = (count: number) =>
        Hooks.checkedMark(
          { feature: 'f', kind: 'ok', props: propsOf(count) },
          pluginId,
        )

      expect(Object.keys(log(20).props)).toHaveLength(20 + stamp)
      expect(Object.keys(mark(20).props)).toHaveLength(21 + stamp)
      expect(() => log(21)).toThrow('at most 20 properties')
      expect(() => mark(21)).toThrow('at most 20 properties')
    }
  })

  test("an installed plugin's row and mark go under its folded name", () => {
    expect(Hooks.checkedFields(DONE, ID)).toEqual({
      name: 'tengu_plugin_code_review__done',
      props: { pluginId: ID },
    })

    expect(
      Hooks.checkedMark({ feature: 'tool_bash', kind: 'ok' }, ID).props,
    ).toEqual({ feature_name: 'plugin_code_review__tool_bash', pluginId: ID })
  })

  test('no plugin spells the name of another', () => {
    expect(Hooks.checkedFields({ event: 'b__c' }, 'a@m').name).not.toBe(
      Hooks.checkedFields({ event: 'c' }, 'a-b@m').name,
    )

    expect(() => Hooks.checkedFields({ event: '_b__c' }, 'a@m')).toThrow(
      'snake_case',
    )

    expect(() =>
      Hooks.checkedMark({ feature: '_b__c', kind: 'ok' }, 'a@m'),
    ).toThrow('snake_case')
  })

  test("an installed plugin names no event as the CLI's own", () => {
    expect(() => Hooks.checkedFields({ event: 'tengu_init' }, ID)).toThrow(
      'no tengu_ prefix',
    )
  })

  test('every name folds to a token, and its id leaves as it is', () => {
    for (const [name, owner] of [
      ['a-b', 'a_b'],
      ['A.B', 'a_b'],
      ['a--b', 'a_b'],
      ['a__b', 'a_b'],
      ['a-_.b', 'a_b'],
      ['a-', 'a'],
      ['_a_', 'a'],
      ['1password', '1password'],
      ['@scope/a', 'scope_a'],
      ['caf\u00e9', 'caf'],
      ['\u30c4\u30fc\u30eb', 'unnamed'],
      ['a'.repeat(200), 'a'.repeat(48)],
      [`${'a'.repeat(47)}-b`, 'a'.repeat(47)],
    ]) {
      const pluginId = `${name}@m`
      const event = 'e'.repeat(64)
      const fields = Hooks.checkedFields({ event }, pluginId)
      const row = { fields, eventId: '', loggedAt: '' }

      expect(fields.name).toBe(`tengu_plugin_${owner}__${event}`)
      expect(fields.name.length).toBeLessThanOrEqual(128)

      expect(JSON.parse(atob(Hooks.metadataOf(row, undefined)))).toEqual({
        pluginId,
      })

      expect(
        Hooks.checkedMark({ feature: 'f', kind: 'ok' }, pluginId).props,
      ).toEqual({ feature_name: `plugin_${owner}__f`, pluginId })
    }
  })

  test("the keys naming a row's owner, and the CLI's own, are refused", () => {
    for (const key of [
      'plugin_id',
      'plugin_id_hash',
      'plugin_name',
      'marketplace_name',
      'is_official_plugin',
      'feature_name',
      'error_code',
      'hook_event',
      'sample_rate',
      'rh',
      'provider',
      'prompt_source',
      'pluginName',
      'Plugin_Name',
      'marketplaceName',
      'isOfficialPlugin',
      'ISOfficial',
      'attributionPlugin',
      'attributionMcpServer',
      'featureName',
      'errorCode',
      'hookEvent',
      'sampleRate',
      'samPle_rate',
      'RH',
      'Provider',
      'promptSource',
      'requestId',
      'requestID',
      'toolName',
      'mcpServerName',
    ]) {
      const props = { [key]: 1 }

      expect(Hooks.checkedFields({ ...DONE, props }).props).toEqual(props)

      const reserved = `props.${key}: this key is reserved`

      expect(() => Hooks.checkedFields({ ...DONE, props }, ID)).toThrow(
        reserved,
      )

      expect(() =>
        Hooks.checkedMark({ feature: 'f', kind: 'ok', props }, ID),
      ).toThrow(reserved)
    }
  })

  test('a key read as an error takes a number or a boolean, no Choice', () => {
    const props = { scan_error: { value: 'late', of: ['late'] } }
    const refused = 'props.scan_error: takes a number or a boolean'

    expect(() => Hooks.checkedFields({ ...DONE, props }, ID)).toThrow(refused)

    expect(() =>
      Hooks.checkedMark({ feature: 'f', kind: 'ok', props }, ID),
    ).toThrow(refused)

    expect(() =>
      Hooks.checkedFields(
        { ...DONE, props: { scanError: choiceOf('a') } },
        ID,
      ),
    ).toThrow('props.scanError: takes a number or a boolean')

    expect(Hooks.checkedFields({ ...DONE, props }).props).toEqual({
      scan_error: 'late',
    })

    expect(
      Hooks.checkedFields(
        { ...DONE, props: { scan_error: 1, had_error: true } },
        ID,
      ).props,
    ).toEqual({ scan_error: 1, had_error: true, pluginId: ID })
  })

  test('a model is read as one in any case, by its key or its text', () => {
    for (const [key, text] of [
      ['modelId', 'a'],
      ['stage2Model', 'a'],
      ['shortName', 'a'],
      ['any', 'Claude-Faux-2'],
    ] as const) {
      const props = { [key]: text }

      expect(() => Hooks.ownedBy(ID, { name: 'e', props }, 'log')).toThrow(
        'a Choice names no model',
      )
    }
  })

  test('free text is refused from an installed plugin too', () => {
    expect(() =>
      Hooks.checkedFields({ ...DONE, props: { note: 'typed' } }, ID),
    ).toThrow('free text is refused')
  })

  test("a built-in's fields are as it named them, key order kept", () => {
    const props = { page: 1 }

    expect(
      JSON.stringify([
        Hooks.checkedFields({ event: 'tengu_init', props }),
        Hooks.checkedMark({ feature: 'f', kind: 'ok', props }),
        Hooks.checkedMark({ feature: 'f', kind: 'sad', reason: 'r', props }),
      ]),
    ).toBe(
      '[{"name":"tengu_init","props":{"page":1}},' +
        '{"name":"tengu_feature_ok","props":{"feature_name":"f","page":1}},' +
        '{"name":"tengu_feature_sad","props":' +
        '{"page":1,"feature_name":"f","error_code":"r"}}]',
    )
  })
})
