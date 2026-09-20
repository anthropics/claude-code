import type { TelemetryDeps } from '../../telemetry-deps'
import Identity from '../identity'
import Machine from '../machine'
import type { Probe } from '../probe'
import { remoteHashOf } from '../remote-hash-of'
import { vcsOf } from '../vcs-of'
import { linuxFilesOf } from './linux-files-of'

/**
 * Gathers what holds for the whole session through the nouns beneath: the
 * variables, the global config, one machine probe, the directory, the remote.
 *
 * Each read that fails leaves its part empty; the Linux files are read on
 * Linux alone.
 *
 * @param deps the calls on the nouns beneath
 * @param isInteractive whether a person is at the prompt
 * @returns what was gathered, for context-of to shape
 */
export async function probeOf(
  deps: TelemetryDeps,
  isInteractive: boolean,
): Promise<Probe> {
  const [facts, signals, location, environment, cwd, repo] = await Promise.all([
    deps.facts(),
    deps.deployment(),
    deps.configLocation(),
    deps.environment(),
    deps.cwd().catch(() => undefined),
    deps.repo().catch(() => null),
  ])

  const [identity, machine, vcs, remoteHash] = await Promise.all([
    Identity.identityOf(deps.read, location, environment.userType === 'ant'),
    Machine.machineOf(deps.run, facts),
    cwd === undefined ? undefined : vcsOf(deps.list, cwd, facts.hasP4Port),
    remoteHashOf(repo?.remote),
  ])

  const files = await linuxFilesOf(deps, machine.platformRaw === 'linux')

  return {
    facts,
    signals: [...signals, ...files.fileSignals],
    identity,
    machine,
    platform: Machine.platformOf(facts.hostPlatform, machine.platformRaw),
    isInteractive,
    distro: files.distro,
    wslVersion: files.wslVersion,
    vcs,
    remoteHash,
  }
}
