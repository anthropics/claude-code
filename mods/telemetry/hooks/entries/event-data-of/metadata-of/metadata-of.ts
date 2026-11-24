import type Batching from '../../../batching'

/**
 * The row's `additional_metadata`: its properties as base64 JSON, the
 * repository's remote hash beside them as the CLI's own rows carry it.
 *
 * Past ASCII, as a plugin's id may be, the JSON is escaped: btoa takes bytes.
 *
 * @param row the row as it was queued
 * @param remoteHash the session's remote hash, when it is in a repository
 * @returns the base64 text
 */
export const metadataOf = (
  row: Batching.PendingRow,
  remoteHash: string | undefined,
) =>
  btoa(
    JSON.stringify({ rh: remoteHash, ...row.fields.props }).replace(
      /[\u0080-\uffff]/g,
      unit => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`,
    ),
  )
