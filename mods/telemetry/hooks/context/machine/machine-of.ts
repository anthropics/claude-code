import type { SessionMachine } from 'claude-code'

import type { Facts } from '../../facts'
import { archOf } from './arch-of'
import type { Machine } from './machine'

/**
 * Names the machine once: on Windows (the `OS` variable or the engine says so)
 * with no kernel or PATH lists, elsewhere from `$.session.machine()`.
 *
 * An engine that does not answer, or answers in another shape, leaves the
 * system unnamed (`unknown`) and the lists empty; nothing is retried.
 *
 * @param machine the engine's read of the machine
 * @param facts the variables as read, for the Windows answer
 * @returns the machine as named
 */
export async function machineOf(
  machine: () => Promise<SessionMachine>,
  facts: Facts,
): Promise<Machine> {
  if (facts.os === 'Windows_NT') {
    return windowsMachine(facts.processorArchitecture ?? '')
  }

  try {
    const named = await machine()

    return named.sysname === 'Windows_NT'
      ? windowsMachine(named.machine)
      : {
          platformRaw: named.sysname.trim().toLowerCase() || 'unknown',
          arch: archOf(named.machine),
          kernel: named.release.trim() || undefined,
          packageManagers: named.packageManagers.join(','),
          runtimes: named.runtimes.join(','),
        }
  } catch {
    return {
      platformRaw: 'unknown',
      arch: archOf(''),
      kernel: undefined,
      packageManagers: '',
      runtimes: '',
    }
  }
}

/**
 * The Windows answer: the architecture from what names it, and nothing the
 * rows take from a Unix machine.
 *
 * @param architecture PROCESSOR_ARCHITECTURE, or the engine's hardware name
 * @returns the machine as named on Windows
 */
function windowsMachine(architecture: string): Machine {
  return {
    platformRaw: 'win32',
    arch: archOf(architecture),
    kernel: undefined,
    packageManagers: '',
    runtimes: '',
  }
}
