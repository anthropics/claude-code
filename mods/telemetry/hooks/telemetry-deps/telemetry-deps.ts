import type {
  FsEntry,
  HttpInit,
  HttpResponse,
  ProcessRunResult,
  SessionAuthorization,
  SessionRepo,
  Timer,
} from 'claude-code'

import type { ConfigLocation } from '../config-location'
import type Deployment from '../deployment'
import type { Environment } from '../environment'
import type { Facts } from '../facts'
import type { PolicyPins } from '../policy-pins'

/**
 * What `telemetryOf` reaches on the nouns beneath, each a call on the
 * plugin's own `$`.
 *
 * The session, the environment, files, one process, the clock, one fetch
 * and the debug log.
 */
export type TelemetryDeps = {
  /**
   * Resolves the session's held credential, or null.
   */
  authorize: () => Promise<SessionAuthorization>

  /**
   * The session's id, for the batch.
   */
  id: () => Promise<string>

  /**
   * The session's model, for the batch.
   */
  model: () => Promise<string>

  /**
   * Whether a person is at the prompt: what `session.start` said, else
   * whether the session draws on a terminal.
   */
  isInteractive: () => Promise<boolean>

  /**
   * Reads, before each batch, the build's user type and every analytics-off
   * variable.
   */
  environment: () => Promise<Environment>

  /**
   * Reads the managed policy's gateway pins.
   */
  policy: () => Promise<PolicyPins>

  /**
   * Reads, once a session, the variables that describe it in a row.
   */
  facts: () => Promise<Facts>

  /**
   * Reads, once a session, whether each deployment's variable holds.
   */
  deployment: () => Promise<readonly Deployment.DeploymentSignal[]>

  /**
   * Reads where the CLI's global config file is.
   */
  configLocation: () => Promise<ConfigLocation>

  /**
   * The directory the session runs in.
   */
  cwd: () => Promise<string>

  /**
   * The repository the session runs in, or null.
   */
  repo: () => Promise<SessionRepo | null>

  /**
   * Reads a file as text; rejects when it cannot be read.
   */
  read: (path: string) => Promise<string>

  /**
   * Lists a directory; rejects when it cannot be listed.
   */
  list: (path: string) => Promise<readonly FsEntry[]>

  /**
   * Whether a path exists.
   */
  exists: (path: string) => Promise<boolean>

  /**
   * Runs one program to its end.
   */
  run: (argv: readonly string[]) => Promise<ProcessRunResult>

  /**
   * Posts a batch to the ingest with the credential handle.
   */
  fetch: (url: string, init: HttpInit) => Promise<HttpResponse>

  /**
   * Calls `fn` once after `ms` milliseconds.
   */
  after: (ms: number, fn: () => void) => Timer

  /**
   * Resolves after `ms` milliseconds.
   */
  sleep: (ms: number) => Promise<void>

  /**
   * Writes one line to the debug log.
   */
  debug: (text: string) => void
}
