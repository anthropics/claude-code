import { describe, expect, test, tier } from 'claude-code/testing'

import { isOutsideWorkingTree } from '../hooks/is-outside-working-tree'

tier('builtin')

describe('is-outside-working-tree', () => {
  const WORK = { cwd: '/work/src', toplevel: '/work' }

  test('the top and what is spelled under it are inside', () => {
    for (const path of [
      '/work',
      '/work/',
      '/work/app.ts',
      '/work//src/./deep/../a.ts',
      'a.ts',
      './deep/a.ts',
      '../app.ts',
    ]) {
      expect(isOutsideWorkingTree(path, WORK), path).toBe(false)
    }
  })

  test('elsewhere, climbed out, or a sibling sharing its spelling: outside', () => {
    for (const path of [
      '/',
      '/tmp/notes.md',
      '/workshop/a.ts',
      '/work-old/a.ts',
      '/work/../etc/hosts',
      '../../elsewhere/a.ts',
    ]) {
      expect(isOutsideWorkingTree(path, WORK), path).toBe(true)
    }
  })

  test('a drive-letter tree: either separator, any case', () => {
    const tree = { cwd: 'C:\\Users\\me\\work', toplevel: 'C:/Users/me/work' }

    expect(isOutsideWorkingTree('c:\\users\\me\\work\\a.ts', tree)).toBe(false)
    expect(isOutsideWorkingTree('src\\a.ts', tree)).toBe(false)
    expect(isOutsideWorkingTree('C:\\Users\\me\\workshop\\a.ts', tree)).toBe(
      true,
    )
    expect(isOutsideWorkingTree('D:\\Users\\me\\work\\a.ts', tree)).toBe(true)
  })

  test('a tree at the root holds every path', () => {
    expect(isOutsideWorkingTree('/tmp/a.ts', { cwd: '/', toplevel: '/' })).toBe(
      false,
    )
  })

  test("a session's directory spelled outside its own top proves nothing", () => {
    const linked = { cwd: '/tmp/work', toplevel: '/private/tmp/work' }

    expect(isOutsideWorkingTree('/tmp/work/a.ts', linked)).toBe(false)
    expect(isOutsideWorkingTree('/elsewhere/a.ts', linked)).toBe(false)
  })
})
