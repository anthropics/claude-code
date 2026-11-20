import type { On } from 'claude-code'

import {
  blockedToolRefusal,
  directCallRefusal,
  unreadCeilingRefusal,
} from './rules'

/**
 * Registers the hooks of each rule under rules/.
 *
 * The mod is on only once the session knows its organization is under HIPAA, by
 * its answer or this machine's record of the login, and holds nothing before
 * then or in a launch that fetches no policy.
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

  on(
    'tool.check',
    { isCeilingUnread: true },
    ($, e, next) => unreadCeilingRefusal(e.tool, next.origin) ?? next(e),
  ).catch(($, e, next) => unreadCeilingRefusal(e.tool, next.origin) ?? next(e))

  // Each names a fact beside `op`: alone, it would count for every tool call before one is raised.
  const op = /^(fs|process)\./

  on(
    'tool.check',
    { op, ceiling: 'deny' },
    ($, e, next) => directCallRefusal(e, next.origin) ?? next(e),
  ).catch(($, e, next) => directCallRefusal(e, next.origin) ?? next(e))

  on(
    'tool.check',
    { op, isCeilingUnread: true },
    ($, e, next) => directCallRefusal(e, next.origin) ?? next(e),
  ).catch(($, e, next) => directCallRefusal(e, next.origin) ?? next(e))
}
