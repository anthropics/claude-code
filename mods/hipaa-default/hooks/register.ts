import type { On } from 'claude-code'

import { blockedToolRefusal } from './rules'

/**
 * Registers the hooks, one for each rule under rules/.
 *
 * No call on `$` here: a hook that call reached would run with this one left out.
 *
 * @param on the engine's registrar
 */
export function register(on: On): void {
  on(
    'tool.check',
    { ceiling: 'deny' },
    ($, e, next) => blockedToolRefusal(e.tool, next.origin) ?? next(e),
  ).catch(($, e, next) => blockedToolRefusal(e.tool, next.origin) ?? next(e))
}
