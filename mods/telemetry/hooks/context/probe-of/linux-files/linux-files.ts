import type Deployment from '../../../deployment'
import type { LinuxDistro } from '../../linux-distro-of'

/**
 * What the Linux files say for the rows: the distribution, the WSL release,
 * and the two deployments whose signal is a file (EC2, Docker).
 */
export type LinuxFiles = {
  readonly distro: LinuxDistro
  readonly wslVersion: string | undefined
  readonly fileSignals: readonly Deployment.DeploymentSignal[]
}
