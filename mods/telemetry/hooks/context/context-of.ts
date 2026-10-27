import type { TelemetryDeps } from '../telemetry-deps'
import type { Context } from './context'
import { environmentFieldsOf } from './environment-fields-of'
import { probeOf } from './probe-of'
import { sessionFieldsOf } from './session-fields-of'

/**
 * Gathers and shapes what holds for the whole session, once: who the rows
 * are from, the session's fields, its `env` block and the remote hash.
 *
 * Nothing in it is a secret or a path: every field is the closed value the
 * CLI's own column holds.
 *
 * @param deps the calls on the nouns beneath
 * @param isInteractive whether a person is at the prompt
 * @returns the session's context for every batch after
 */
export async function contextOf(
  deps: TelemetryDeps,
  isInteractive: boolean,
): Promise<Context> {
  const probe = await probeOf(deps, isInteractive)

  return {
    identity: probe.identity,
    session: sessionFieldsOf(probe.facts),
    environment: environmentFieldsOf(probe),
    remoteHash: probe.remoteHash,
  }
}
