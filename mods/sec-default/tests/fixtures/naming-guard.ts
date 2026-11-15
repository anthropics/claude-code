import type { Settings } from 'claude-code'

import { ENABLING_GUARD } from './enabling-guard.js'

/**
 * Each way managed settings name the test's `guard` as the organization's.
 */
export const NAMING_GUARD: readonly (readonly [string, Settings])[] = [
  ['enabled', ENABLING_GUARD],
  [
    'enabled by a version list',
    { enabledPlugins: { 'guard@claude-plugin-test': ['^1.0.0'] } },
  ],
  [
    'enabled in another letter case',
    { enabledPlugins: { 'Guard@Claude-Plugin-Test': true } },
  ],
  ['only prepended', { prependPlugins: ['guard@claude-plugin-test'] }],
  ['only appended', { appendPlugins: ['guard@claude-plugin-test'] }],
  [
    'listed in another letter case, among entries that are no id',
    { prependPlugins: 'guard', appendPlugins: [1, 'GUARD@claude-plugin-test'] },
  ],
]
