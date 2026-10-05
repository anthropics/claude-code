import type { Settings } from 'claude-code'

import { attempted } from '../attempted'
import Policy from '../policy'
import { toolRegistered } from '../tool-registered'
import type ToolRegistered from '../tool-registered'
import type Types from './types'

/**
 * The `tool.register` hook's failure handler: the failed hook's last run
 * when it made one, else the hook's own decision made again.
 *
 * Its policy read fails closed and cannot throw: a read that rejects, or
 * throws where it is made, refuses a caller in the user tier.
 *
 * @param e the tool being added
 * @param next the handler's continuation, with the caller's origin
 * @param read the handler's own read of managed policy
 * @returns the registration's answer
 */
export const registerCaught = <E, R>(
  e: E,
  next: Types.CaughtNext<E, R> & ToolRegistered.RegisterNext<E, R>,
  read: () => Promise<Settings>,
) =>
  next.called
    ? next(e)
    : toolRegistered(e, next, () =>
        Policy.decidedByPolicy(attempted(read), Policy.hasMcpAllowlist),
      )
