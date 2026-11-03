/**
 * One event of a batch posted to the ingest: its type and its data fields.
 */
export type IngestEvent = {
  event_type: string
  event_data: Record<string, unknown>
}
