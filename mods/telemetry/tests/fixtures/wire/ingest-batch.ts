import type { IngestEvent } from './ingest-event.js'

/**
 * The body of one post to the ingest, parsed: its events.
 */
export type IngestBatch = {
  events: readonly IngestEvent[]
}
