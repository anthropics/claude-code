import type Backend from '../../../hooks/backend'

/**
 * A backend host around one runner: every other member answers nothing (no
 * file, no mtime, no listing, time zero, a base callback that ignores).
 *
 * @param run the host's runner
 * @returns the host
 */
export const backendHostOf = (
  run: Backend.BackendHost['run'],
): Backend.BackendHost => ({
  run,
  readFile: () => Promise.reject(new Error('ENOENT')),
  mtimeOf: () => Promise.resolve(null),
  entryKindsOf: () => Promise.resolve(null),
  nowMs: () => Promise.resolve(0),
  sessionStartMsOf: () => 0,
  onBranchBase: () => undefined,
})
