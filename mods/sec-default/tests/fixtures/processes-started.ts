import type { On } from 'claude-code'

/**
 * A session starting, where each process a plugin starts reaches the engine
 * and is kept as `<plugin> <run or spawn>`. None starts.
 *
 * @param on the test's `on`
 * @returns what was started, in order
 */
export function processesStarted(on: On) {
  const kept: string[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))

  on('process.run', ($, e, next) => {
    kept.push(`${next.origin.plugin} run`)

    return {
      value: {
        exitCode: 0,
        stdout: '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })

  on('process.spawn', async function* ($, e, next) {
    kept.push(`${next.origin.plugin} spawn`)
    yield { stream: 'stdout', text: 'ran' }

    return { value: { code: 0, signal: null } }
  })

  return kept
}
