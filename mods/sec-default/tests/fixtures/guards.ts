import type { Plugin } from 'claude-code/testing'

import { idleGuard } from './idle-guard.js'
import { registering } from './registering.js'

/**
 * A `user`-tier plugin named `guard`, in each shape `plugin.register` shows.
 */
export const GUARDS: readonly (readonly [string, Plugin])[] = [
  ['with a module', registering('guard')],
  ['with no module', idleGuard],
]
