import type { HttpResponse, SessionAuthorization } from 'claude-code'

import type { PolicyOption } from './policy-option.js'

/**
 * How a test's session differs from the plain one.
 *
 * What `authorize` and the ingest answer in turn (`refused`: the store will
 * not open; the last repeats), the managed policy (`unreadable` when it
 * cannot be read), and the machine's files, markers and probe output.
 */
export type SessionOptions = {
  readonly authorizations?: readonly (SessionAuthorization | 'refused')[]
  readonly answers?: readonly HttpResponse[]
  readonly policy?: PolicyOption
  readonly files?: Readonly<Record<string, string>>
  readonly existing?: readonly string[]
  readonly probeOutput?: string
}
