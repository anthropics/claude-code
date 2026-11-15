import type { Settings } from 'claude-code'

import { NO_ALLOWLIST } from './no-allowlist.js'

/**
 * Managed settings that leave the test's `guard` a person's own.
 */
export const NOT_NAMING_GUARD: readonly (readonly [string, Settings])[] = [
  ['policy names no plugin', NO_ALLOWLIST],
  [
    'its entry is false',
    { enabledPlugins: { 'guard@claude-plugin-test': false } },
  ],
  [
    'policy names it under another source, or by its name alone',
    { enabledPlugins: { 'guard@corp': true }, prependPlugins: ['guard'] },
  ],
  [
    'the keys hold no list of ids',
    {
      enabledPlugins: 'guard@claude-plugin-test',
      prependPlugins: 'guard@claude-plugin-test',
      appendPlugins: [null],
    },
  ],
]
