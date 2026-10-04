import type { ProcessRunResult } from 'claude-code'

import type { Facts } from '../../facts'
import { archOf } from './arch-of'
import type { Machine } from './machine'
import { PROBE_SCRIPT } from './probe-script'

/**
 * Probes the machine once: on Windows (the `OS` variable says so) from the
 * environment alone, elsewhere with one `sh` run of PROBE_SCRIPT.
 *
 * A probe that fails or exits non-zero leaves the system unnamed
 * (`unknown`) and the lists empty; nothing is retried.
 *
 * @param run runs one program to its end
 * @param facts the variables as read, for the Windows answer
 * @returns the machine as probed
 */
export async function machineOf(
  run: (argv: readonly string[]) => Promise<ProcessRunResult>,
  facts: Facts,
): Promise<Machine> {
  if (facts.os === 'Windows_NT') {
    return {
      platformRaw: 'win32',
      arch: archOf(facts.processorArchitecture ?? ''),
      kernel: undefined,
      packageManagers: '',
      runtimes: '',
    }
  }

  let result: ProcessRunResult | undefined

  try {
    result = await run(['sh', '-c', PROBE_SCRIPT])
  } catch {
    result = undefined
  }

  const [system = '', kernel = '', machine = '', managers = '', runtimes = ''] =
    (result?.exitCode === 0 ? result.stdout.split('\n') : []).map(line =>
      line.trim(),
    )

  return {
    platformRaw: system.toLowerCase() || 'unknown',
    arch: archOf(machine),
    kernel: kernel || undefined,
    packageManagers: managers.replace(/,$/, ''),
    runtimes: runtimes.replace(/,$/, ''),
  }
}
