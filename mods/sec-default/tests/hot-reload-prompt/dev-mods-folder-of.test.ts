import { describe, expect, test, tier } from 'claude-code/testing'

import HotReloadPrompt from '../../hooks/hot-reload-prompt'

tier('prepend')

describe('dev-mods-folder-of', () => {
  test('names the folder a plugin sits directly in, whatever the home', () => {
    expect(
      [
        '/home/me/.claude/dev-mods/abc-1/mine',
        '/custom/config/dev-mods/abc-1/other/',
        'C:\\Users\\me\\.claude\\dev-mods\\abc-1\\mine',
      ].map(HotReloadPrompt.devModsFolderOf),
    ).toEqual(['dev-mods/abc-1', 'dev-mods/abc-1', 'dev-mods/abc-1'])
  })

  test('names the folder itself, where a plugin sits at its top', () => {
    expect(
      [
        '/home/me/.claude/dev-mods/abc-1',
        '/home/me/.claude/dev-mods/abc-1/',
        'C:\\Users\\me\\.claude\\dev-mods\\abc-1',
      ].map(HotReloadPrompt.devModsFolderOf),
    ).toEqual(['dev-mods/abc-1', 'dev-mods/abc-1', 'dev-mods/abc-1'])
  })

  test('one session is not another', () => {
    expect(HotReloadPrompt.devModsFolderOf('/h/dev-mods/abc-2/mine')).not.toBe(
      HotReloadPrompt.devModsFolderOf('/h/dev-mods/abc-1/mine'),
    )
  })

  test('anything under the folder counts, however the rest of the path parses', () => {
    expect(
      [
        '/h/dev-mods/abc-1/a\\b',
        '/h/dev-mods/abc-1/mine/deeper',
        '/h/dev-mods/abc-1/dev-mods',
        '/dev-mods/old/.claude/dev-mods/abc-1/mine',
      ].map(HotReloadPrompt.devModsFolderOf),
    ).toEqual(Array(4).fill('dev-mods/abc-1'))
  })

  test('a child named like the pair on POSIX is not a folder', () => {
    expect(
      [
        '/h/dev-mods/NEW/dev-mods\\OLD',
        '/h/dev-mods/NEW/dev-mods\\OLD/mine',
      ].map(HotReloadPrompt.devModsFolderOf),
    ).toEqual(Array(2).fill('dev-mods/NEW'))
    expect(HotReloadPrompt.devModsFolderOf('/h/mine/dev-mods\\OLD')).toBe(
      undefined,
    )
  })

  test('anywhere else is no such folder', () => {
    expect(
      ['/home/me/.claude/plugins/mine', '/home/me/dev-mods'].map(
        HotReloadPrompt.devModsFolderOf,
      ),
    ).toEqual([undefined, undefined])
  })
})
