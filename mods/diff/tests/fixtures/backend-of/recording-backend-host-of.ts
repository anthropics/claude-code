import type { ProcessRunResult } from 'claude-code'

import Scripted from '../scripted'
import { backendHostOf } from './backend-host-of.js'
import type { RecordingBackendHost } from './recording-backend-host.js'

/**
 * A backend host whose runner answers from a script and notes each program
 * it was asked to run.
 *
 * @param script git's answers by subcommand
 * @returns the host and the programs it ran, in order
 */
export function recordingBackendHostOf(
  script: Readonly<Record<string, ProcessRunResult>>,
): RecordingBackendHost {
  const programs: (string | undefined)[] = []
  const scripted = Scripted.scriptedGitOf(script)

  const host = backendHostOf(([program, ...rest]) => {
    programs.push(program)

    return scripted.run(rest)
  })

  return { host, programs }
}
