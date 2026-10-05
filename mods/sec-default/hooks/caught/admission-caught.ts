import { admissionFailure } from '../admission-failure'
import { managedModsOnlyRefusal } from '../managed-mods-only-refusal'
import { quietly } from '../quietly'
import type Types from './types'

/**
 * The `plugin.register` hook's failure handler: the failed hook's last run
 * when it made one, else the module is refused.
 *
 * It names the failure in the debug log; that call's outcome changes
 * nothing of the answer.
 *
 * @param e the module being judged
 * @param next the handler's continuation, with why the hook failed
 * @param log the handler's own line to the debug log
 * @returns the admission's answer
 */
export function admissionCaught<E extends Types.Judged, R>(
  e: E,
  next: Types.CaughtNext<E, R> & Types.Failed,
  log: (line: string) => unknown,
) {
  quietly(() => log(admissionFailure(e.name, next.error)))

  return next.called ? next(e) : { refuse: managedModsOnlyRefusal(e.name) }
}
