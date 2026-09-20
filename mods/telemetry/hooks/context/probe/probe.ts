import type Deployment from '../../deployment'
import type { Facts } from '../../facts'
import type { Identity } from '../identity'
import type { LinuxDistro } from '../linux-distro-of'
import type { Machine } from '../machine'

/**
 * Everything gathered for the session's context before it is shaped: the
 * variables, the identity, the machine, the Linux files and the directory.
 */
export type Probe = {
  readonly facts: Facts
  readonly signals: readonly Deployment.DeploymentSignal[]
  readonly identity: Identity
  readonly machine: Machine
  readonly platform: string
  readonly isInteractive: boolean
  readonly distro: LinuxDistro
  readonly wslVersion: string | undefined
  readonly vcs: string | undefined
  readonly remoteHash: string | undefined
}
