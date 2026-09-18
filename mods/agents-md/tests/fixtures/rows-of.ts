import type { Row, Started } from './types'

/**
 * What the plugin handed the telemetry noun so far, read off the transcript
 * lines RECORDING wrote, in the order handed; other lines are passed over.
 *
 * @param started the session's start, whose lines hold the rows
 * @returns the `[op, entry]` pairs
 */
export const rowsOf = (started: Started): Row[] =>
  started.lines
    .filter(line => line.startsWith('log ') || line.startsWith('mark '))
    .map((line): Row => {
      const at = line.indexOf(' ')

      return [line.slice(0, at), JSON.parse(line.slice(at + 1))]
    })
