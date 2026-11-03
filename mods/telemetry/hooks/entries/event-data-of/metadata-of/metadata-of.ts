import type Batching from '../../../batching'

/**
 * The row's `additional_metadata`: its properties as base64 JSON, the
 * repository's remote hash beside them as the CLI's own rows carry it.
 *
 * @param row the row as it was queued
 * @param remoteHash the session's remote hash, when it is in a repository
 * @returns the base64 text
 */
export const metadataOf = (
  row: Batching.PendingRow,
  remoteHash: string | undefined,
) => btoa(JSON.stringify({ rh: remoteHash, ...row.fields.props }))
