import type Git from '../../../git'
import type { Host } from '../../../host'

/**
 * What pinning a backend takes from the bound host: its raw process runner,
 * file probes, clock, session start and branch-base listener.
 *
 * Each backend names its own program, argv lead, environment and timeout
 * to the runner; the session's start is read as it stands at each fetch
 * (a later `session.start` moves it).
 */
export type BackendHost = Pick<Host, 'run' | 'readFile'> &
  Pick<Git.GitDeps, 'mtimeOf' | 'entryKindsOf' | 'onBranchBase'> & {
    /**
     * The engine's clock, in milliseconds (`$.clock.now`).
     */
    nowMs: () => Promise<number>

    /**
     * When the current session began, read at each fetch.
     */
    sessionStartMsOf: () => number
  }
