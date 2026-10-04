import type { On } from 'claude-code'

/**
 * Answers `$.fs` over /work holding the named files, MOVED_IN's two when
 * none is given, each last written at time 0, before any session began.
 *
 * @param on the test's `on`
 * @param names the files /work holds
 */
export function oldFiles(
  on: On,
  names: readonly string[] = ['old.ts', 'moved.ts'],
) {
  on('fs.list', () => ({
    value: names.map(name => ({
      name,
      kind: 'file' as const,
      size: 2,
      isLink: false,
    })),
  }))

  on('fs.stat', () => ({
    value: { kind: 'file', size: 2, mtimeMs: 0, isLink: false },
  }))
}
