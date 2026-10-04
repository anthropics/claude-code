import { describe, expect, test, tier } from 'claude-code/testing'

import Git from '../../../hooks/git'

tier('builtin')

describe('is-safe-ref-name', () => {
  test('branch refs under refs/ pass', () => {
    for (const ref of ['refs/heads/main', 'refs/heads/me/fh-diff_mod.2']) {
      expect(Git.isSafeRefName(ref), ref).toBe(true)
    }
  })

  test('climbing, absolute, backslashed, control or lock names fail', () => {
    for (const ref of [
      '',
      'refs/../../etc/passwd',
      '/refs/heads/main',
      'refs\\heads\\main',
      'refs/heads/ma\u001bin',
      'refs/heads/main.lock',
      'refs/heads/.hidden',
      'heads/main',
      'refs//main',
    ]) {
      expect(Git.isSafeRefName(ref), ref).toBe(false)
    }
  })
})
