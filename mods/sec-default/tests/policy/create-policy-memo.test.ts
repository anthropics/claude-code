import type { Settings } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import Policy from '../../hooks/policy'
import Fixtures from '../fixtures'

tier('prepend')

describe('create-policy-memo', () => {
  function countedRead() {
    let reads = 0

    function read(): Promise<Settings> {
      reads += 1

      return Promise.resolve(Fixtures.MANAGED_POLICY)
    }

    return { read, reads: () => reads }
  }

  test('a burst of reads inside the window is one read', async () => {
    let at = 0

    const memo = Policy.createPolicyMemo(Policy.POLICY_MEMO_MS, () => at)
    const { read, reads } = countedRead()
    const burst = await Promise.all([memo(read), memo(read), memo(read)])

    at += Policy.POLICY_MEMO_MS

    await memo(read)

    expect(burst).toEqual([
      Fixtures.MANAGED_POLICY,
      Fixtures.MANAGED_POLICY,
      Fixtures.MANAGED_POLICY,
    ])

    expect(reads()).toBe(1)
  })

  test('past the window the next decision reads again', async () => {
    let at = 0

    const memo = Policy.createPolicyMemo(Policy.POLICY_MEMO_MS, () => at)
    const { read, reads } = countedRead()

    await memo(read)

    at += Policy.POLICY_MEMO_MS + 1

    await memo(read)

    expect(reads()).toBe(2)
  })

  test('a failed read is served for its window: fails closed', async () => {
    const memo = Policy.createPolicyMemo(Policy.POLICY_MEMO_MS, () => 0)

    let reads = 0

    function failing(): Promise<Settings> {
      reads += 1

      return Promise.reject(new Error('settings unreadable'))
    }

    await expect(memo(failing)).rejects.toThrow('settings unreadable')
    await expect(memo(failing)).rejects.toThrow('settings unreadable')
    expect(reads).toBe(1)
  })
})
