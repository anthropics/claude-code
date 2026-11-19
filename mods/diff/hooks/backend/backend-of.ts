import Git from '../git'
import type { Backend, BackendHost, BackendProbe } from './types'
import { vcsBackendOf } from './vcs-backend-of'

/**
 * The backend holding the session's directory: the system's `vcs.detect`
 * names where a hook serves it and the plugin has no reader of its own, else
 * another system's when its probe answers first, else git's, else none.
 *
 * Probes are asked before git so one may claim a working copy by its own
 * rule (the nearer of two markers, say); each answers null wherever git
 * should govern.
 *
 * @param host the bound host's runner and probes
 * @param probes probes for other version-control systems by slug, in order
 * (INSTALLED_BACKEND_PROBES at the pane; none as published)
 * @param isDeclined the probes and git already found none, so are not asked
 * @returns the pinned backend, or null outside any working tree
 */
export async function backendOf(
  host: BackendHost,
  probes: ReadonlyMap<string, BackendProbe>,
  isDeclined = false,
): Promise<Backend | null> {
  const copy = await host.detect()

  const isMods = copy !== null && copy.vcs !== 'git' && !probes.has(copy.vcs)
  const served = isMods ? await vcsBackendOf(host, copy) : null

  if (served || isDeclined) {
    return served
  }

  for (const probe of probes.values()) {
    const backend = await probe(host)

    if (backend) {
      return backend
    }
  }

  return Git.gitBackendOf(host)
}
