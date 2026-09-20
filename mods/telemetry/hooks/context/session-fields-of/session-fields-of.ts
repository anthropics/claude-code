import type { Facts } from '../../facts'
import { clientTypeOf } from '../client-type-of'
import { entrypointOf } from '../entrypoint-of'
import type { SessionFields } from '../session-fields'
import { versionOf } from '../version-of'

/**
 * The session's constant row fields from the variables as read: the client,
 * the entrypoint, the SDK's version and a benchmark run's ids.
 *
 * @param facts the variables as read once for the session
 * @returns the fields
 */
export const sessionFieldsOf = (facts: Facts): SessionFields => ({
  clientType: clientTypeOf(facts),
  entrypoint: entrypointOf(facts.entrypoint),
  agentSdkVersion: versionOf(facts.agentSdkVersion),
  sweBenchRunId: facts.sweBenchRunId || undefined,
  sweBenchInstanceId: facts.sweBenchInstanceId || undefined,
  sweBenchTaskId: facts.sweBenchTaskId || undefined,
})
