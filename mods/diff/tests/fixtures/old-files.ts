import type { On } from 'claude-code'

/**
 * Answers `$.fs` over /work holding MOVED_IN's two files, both last
 * written at time 0, before any session began.
 *
 * @param on the test's `on`
 */
export function oldFiles(on: On) {
  on('fs.list', () => ({
    value: [
      { name: 'old.ts', kind: 'file', size: 2, isLink: false },
      { name: 'moved.ts', kind: 'file', size: 2, isLink: false },
    ],
  }))

  on('fs.stat', () => ({
    value: { kind: 'file', size: 2, mtimeMs: 0, isLink: false },
  }))
}
