import type Batching from '../batching'
import type { BatchStamp } from './batch-stamp'
import { eventDataOf } from './event-data-of'
import { wireOf } from './wire-of'

/**
 * The first-party event batch for the queued rows, shaped as the CLI's own
 * event exporter shapes its batches: one ClaudeCodeInternalEvent per row.
 *
 * @param rows the rows as they were queued, oldest first
 * @param stamp what the batch stamps on every row
 * @returns the batch's JSON text, ready to POST to the ingest
 */
export const batchOf = (
  rows: readonly Batching.PendingRow[],
  stamp: BatchStamp,
) =>
  JSON.stringify({
    events: rows.map(row => ({
      event_type: 'ClaudeCodeInternalEvent',
      event_data: wireOf(eventDataOf(row, stamp)),
    })),
  })
