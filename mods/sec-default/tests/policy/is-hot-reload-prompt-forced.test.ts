import { describe, expect, test, tier } from 'claude-code/testing'

import Policy from '../../hooks/policy'

tier('prepend')

const policyOf = (value: boolean | number | string) => ({
  pluginConfigs: {
    'cc-plugin-sec-default@builtin': {
      options: { forceHotReloadPrompt: value },
    },
  },
})

describe('is-hot-reload-prompt-forced', () => {
  test('on unless absent or false, a mistyped value included', () => {
    expect(
      [policyOf(true), policyOf('true'), policyOf(1), policyOf(false), {}].map(
        Policy.isHotReloadPromptForced,
      ),
    ).toEqual([true, true, true, false, false])
  })

  test('only its own pluginConfigs entry is read', () => {
    expect(
      Policy.isHotReloadPromptForced({
        pluginConfigs: {
          'guard@corp-market': { options: { forceHotReloadPrompt: true } },
        },
      }),
    ).toBe(false)
  })
})
