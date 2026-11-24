import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'

tier('builtin')

const ID = 'Code-Review@official'
const DONE = { event: 'done' }

const propsOf = (count: number) =>
  Object.fromEntries(Array.from({ length: count }, (_, at) => [`k${at}`, at]))

describe('entries', () => {
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
    expect(() =>
      Hooks.checkedFields({ ...DONE, props: { pluginId: 1 } }, ID),
    ).toThrow('snake_case')

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
    ]) {
      const props = { [key]: 1 }

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
