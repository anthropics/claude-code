import type Batching from '../../batching'
import type { BatchStamp } from '../batch-stamp'
import { authOf } from './auth-of'
import { metadataOf } from './metadata-of'

/**
 * One row as a ClaudeCodeInternalEvent, keyed as the plugin builds it;
 * wireOf spells it for the ingest.
 *
 * Its id, name and time, who and where it is from, the session's fields,
 * its `env` block, and its properties in `additionalMetadata`.
 *
 * @param row the row as it was queued
 * @param stamp what the batch stamps on every row
 * @returns the event's data
 */
export const eventDataOf = (row: Batching.PendingRow, stamp: BatchStamp) => ({
  eventId: row.eventId,
  eventName: row.fields.name,
  clientTimestamp: row.loggedAt,
  deviceId: stamp.context.identity.deviceId,
  email: stamp.context.identity.email,
  auth: authOf(stamp.context.identity),
  sessionId: stamp.sessionId,
  model: stamp.model,
  userType: stamp.userType,
  isInteractive: stamp.isInteractive,
  ...stamp.context.session,
  env: { ...stamp.context.environment, isClaudeAiAuth: stamp.isClaudeAiAuth },
  additionalMetadata: metadataOf(row, stamp.context.remoteHash),
})
