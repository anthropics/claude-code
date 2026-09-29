import { describe, expect, test, tier } from 'claude-code/testing'

import Policy from '../../hooks/policy'
import Fixtures from '../fixtures'

tier('prepend')

describe('deny-rules-hold', () => {
  test('deny rules hold unless the option is the literal true', () => {
    expect(
      [true, 'true', 1, false, undefined].map(value =>
        Policy.denyRulesHold(Fixtures.overridePolicyOf(value)),
      ),
    ).toEqual([false, true, true, true, true])
  })

  test('settings with no entry for this plugin hold them', () => {
    expect(
      [Fixtures.MANAGED_POLICY, {}, { pluginConfigs: 'x' }].map(
        Policy.denyRulesHold,
      ),
    ).toEqual([true, true, true])
  })
})
