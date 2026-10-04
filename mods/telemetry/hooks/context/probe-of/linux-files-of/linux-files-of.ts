import type { TelemetryDeps } from '../../../telemetry-deps'
import { linuxDistroOf } from '../../linux-distro-of'
import { wslVersionOf } from '../../wsl-version-of'
import type { LinuxFiles } from '../linux-files'

/**
 * Reads the four Linux files the rows draw on, on Linux alone; elsewhere,
 * and for each file that cannot be read, the answer is empty.
 *
 * @param deps the calls on the nouns beneath
 * @param isLinux whether the machine named itself Linux
 * @returns what the files say
 */
export async function linuxFilesOf(
  deps: TelemetryDeps,
  isLinux: boolean,
): Promise<LinuxFiles> {
  const [distro, wslVersion, isEc2, isDocker] = await Promise.all([
    isLinux
      ? linuxDistroOf(() => deps.read('/etc/os-release'))
      : { id: undefined, version: undefined },
    isLinux ? wslVersionOf(() => deps.read('/proc/version')) : undefined,
    isLinux
      ? deps.read('/sys/hypervisor/uuid').then(
          uuid => uuid.startsWith('ec2'),
          () => false,
        )
      : false,
    isLinux ? deps.exists('/.dockerenv').catch(() => false) : false,
  ])

  return {
    distro,
    wslVersion,
    fileSignals: [
      ['aws-ec2', isEc2],
      ['docker', isDocker],
    ],
  }
}
