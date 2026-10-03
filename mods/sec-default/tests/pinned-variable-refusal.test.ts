import { describe, expect, test, tier } from 'claude-code/testing'

import Hooks from '../hooks'

tier('prepend')

describe('pinned-variable-refusal', () => {
  test('it names the setting and the variable, and not who set it', () => {
    expect(Hooks.pinnedVariableRefusal('CORP_PROXY')).toBe(
      'env (managed): CORP_PROXY is not for plugins outside policy to change',
    )
  })
})
