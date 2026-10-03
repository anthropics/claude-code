import { describe, expect, test, tier } from 'claude-code/testing'

import Policy from '../../hooks/policy'
import Fixtures from '../fixtures'

tier('prepend')

describe('is-pinned-variable', () => {
  test('a name managed env sets is pinned, in any case; no other is', () => {
    expect(
      ['CORP_PROXY', 'corp_proxy', 'Corp_Proxy', 'CORP', 'CORP_PROXY_2'].map(
        name => Policy.isPinnedVariable(Fixtures.PINNING_POLICY, name),
      ),
    ).toEqual([true, true, true, false, false])
  })

  test('whichever case managed env itself spells it in', () => {
    expect(
      ['CORP_PROXY', 'corp_proxy', 'CORP'].map(name =>
        Policy.isPinnedVariable(Fixtures.LOWER_CASE_PINNING_POLICY, name),
      ),
    ).toEqual([true, true, false])
  })

  test('a name managed env sets to nothing is pinned all the same', () => {
    expect(
      Policy.isPinnedVariable({ env: { CORP_PROXY: '' } }, 'CORP_PROXY'),
    ).toBe(true)
  })

  test('settings with no env pin nothing', () => {
    expect(
      [Fixtures.MANAGED_POLICY, {}, { env: {} }].map(policy =>
        Policy.isPinnedVariable(policy, 'CORP_PROXY'),
      ),
    ).toEqual([false, false, false])
  })
})
