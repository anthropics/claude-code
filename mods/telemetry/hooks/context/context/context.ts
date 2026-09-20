import type { EnvironmentFields } from '../environment-fields'
import type { Identity } from '../identity'
import type { SessionFields } from '../session-fields'

/**
 * Everything a row carries that holds for the whole session, gathered once
 * before the first batch.
 *
 * Who it is from, the session's constant fields, its `env` block, and the
 * repository's remote hash for the metadata.
 */
export type Context = {
  readonly identity: Identity
  readonly session: SessionFields
  readonly environment: EnvironmentFields
  readonly remoteHash: string | undefined
}
