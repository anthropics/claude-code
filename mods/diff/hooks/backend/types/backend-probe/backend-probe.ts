import type { Backend } from '../backend'
import type { BackendHost } from '../backend-host'

/**
 * Probes the session's directory for one backend's working tree: the
 * backend when it holds the directory, else null.
 *
 * Null too where git should govern it instead (Git.gitBackendOf is git's).
 */
export type BackendProbe = (host: BackendHost) => Promise<Backend | null>
