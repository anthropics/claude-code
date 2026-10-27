import type { SentSession } from '../sent-session.js'
import { base64Decoded } from './base64-decoded.js'
import { batchOf } from './batch-of.js'

/**
 * Every row the session's posts carried, in order, held steady for a test:
 * a row's random id and timestamp told as present, its metadata decoded.
 *
 * @param session what the plugin did
 * @returns each row's type and fields, with `metadata` decoded
 */
export const rowsOf = (session: SentSession): unknown[] =>
  session.posts.flatMap(post =>
    batchOf(post).events.map(event => {
      const { event_id, client_timestamp, additional_metadata, ...rest } =
        event.event_data

      return {
        event_type: event.event_type,
        hasEventId:
          typeof event_id === 'string' && /^[0-9a-f-]{36}$/.test(event_id),
        hasTimestamp: typeof client_timestamp === 'string',
        ...rest,
        metadata: JSON.parse(base64Decoded(String(additional_metadata))),
      }
    }),
  )
