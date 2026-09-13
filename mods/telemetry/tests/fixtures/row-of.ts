import type { Args } from 'claude-code'

import { base64Decoded } from './base64-decoded.js'
import { batchOf } from './batch-of.js'

/**
 * The one row a post to the ingest carries, held steady for a test: its
 * random id and timestamp dropped, `hasTimestamp` and `metadata` decoded.
 *
 * @param post the `http.fetch` the plugin made
 * @returns the row's type, whether it was stamped, its fields and metadata
 */
export function rowOf(post: Args<'http.fetch'>): unknown {
  const [event] = batchOf(post).events

  const {
    event_id: _eventId,
    client_timestamp,
    additional_metadata,
    ...rest
  } = event?.event_data ?? {}

  return {
    event_type: event?.event_type,
    hasTimestamp: typeof client_timestamp === 'string',
    ...rest,
    metadata: JSON.parse(base64Decoded(String(additional_metadata))),
  }
}
