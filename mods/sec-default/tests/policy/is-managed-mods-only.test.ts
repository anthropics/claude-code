import { describe, expect, test, tier } from 'claude-code/testing'

import Policy from '../../hooks/policy'
import Fixtures from '../fixtures'

tier('prepend')

describe('is-managed-mods-only', () => {
  test('true locks; absent or false leaves mods as they are', () => {
    expect(
      [
        Fixtures.modsPolicyOf(true),
        Fixtures.modsPolicyOf(false),
        Fixtures.NO_ALLOWLIST,
        {},
      ].map(Policy.isManagedModsOnly),
    ).toEqual([true, false, false, false])
  })

  test('a value mistyped still locks, as a managed lock reads', () => {
    expect(
      [
        Fixtures.modsPolicyOf('true'),
        Fixtures.modsPolicyOf('false'),
        Fixtures.modsPolicyOf(1),
        Fixtures.modsPolicyOf(0),
      ].map(Policy.isManagedModsOnly),
    ).toEqual([true, true, true, true])
  })

  test('only its own pluginConfigs entry is read', () => {
    expect(
      [
        { allowManagedModsOnly: true },
        { pluginConfigs: { allowManagedModsOnly: true } },
        {
          pluginConfigs: {
            'guard@corp-market': { options: { allowManagedModsOnly: true } },
          },
        },
        { pluginConfigs: 'cc-plugin-sec-default@builtin' },
      ].map(Policy.isManagedModsOnly),
    ).toEqual([false, false, false, false])
  })
})
