import type { VcsWorkingCopy } from 'claude-code'

/**
 * A working copy of a made-up system at /work, on revision 7, whose mainline
 * is named.
 */
export const ACME_COPY: VcsWorkingCopy = {
  vcs: 'acme',
  root: '/work',
  mainRoot: null,
  revision: '7',
  branch: null,
  defaultBranch: 'mainline',
  remote: null,
}
