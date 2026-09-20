import Deployment from '../../deployment'
import IsAnalyticsOff from '../../is-analytics-off'
import type { EnvironmentFields } from '../environment-fields'
import type { Probe } from '../probe'
import { shellOf } from '../shell-of'
import { terminalOf } from '../terminal-of'
import { actionRefOf } from './action-ref-of'
import { githubActionsFieldsOf } from './github-actions-fields-of'
import { tagsOf } from './tags-of'

/**
 * The rows' `env` block from what was probed, valued as the CLI's own is;
 * the GitHub Actions fields only inside a workflow, the Linux ones on Linux.
 *
 * @param probe what was gathered for the session
 * @returns the block
 */
export function environmentFieldsOf(probe: Probe): EnvironmentFields {
  const { facts, machine, platform } = probe
  const isGithubAction = IsAnalyticsOff.isEnvTruthy(facts.githubActions)
  const isLinux = machine.platformRaw === 'linux'

  return {
    platform,
    platformRaw: machine.platformRaw,
    arch: machine.arch,
    terminal: terminalOf(facts, platform, probe.isInteractive),
    shell: shellOf(facts.shellPath),
    packageManagers: machine.packageManagers,
    runtimes: machine.runtimes,
    isCi: IsAnalyticsOff.isEnvTruthy(facts.ci),
    isClaubbit: IsAnalyticsOff.isEnvTruthy(facts.claubbit),
    isGithubAction,
    isClaudeCodeAction: IsAnalyticsOff.isEnvTruthy(facts.claudeCodeAction),
    isClaudeCodeRemote: IsAnalyticsOff.isEnvTruthy(facts.claudeCodeRemote),
    isLocalAgentMode: facts.entrypoint === 'local-agent',
    isConductor: facts.bundleIdentifier === 'com.conductor.app',
    deploymentEnvironment: Deployment.deploymentOf(probe.signals, platform),
    remoteEnvironmentType: facts.remoteEnvironmentType,
    claudeCodeContainerId: facts.containerId,
    claudeCodeRemoteSessionId: facts.remoteSessionId,
    tags: tagsOf(facts.tags),
    githubEventName: isGithubAction ? facts.githubEventName : undefined,
    githubActionsRunnerEnvironment: isGithubAction
      ? facts.runnerEnvironment
      : undefined,
    githubActionsRunnerOs: isGithubAction ? facts.runnerOs : undefined,
    githubActionRef: isGithubAction
      ? actionRefOf(facts.githubActionPath)
      : undefined,
    githubActionsMetadata: isGithubAction
      ? githubActionsFieldsOf(facts)
      : undefined,
    wslVersion: probe.wslVersion,
    linuxDistroId: probe.distro.id,
    linuxDistroVersion: probe.distro.version,
    linuxKernel: isLinux ? machine.kernel : undefined,
    vcs: probe.vcs,
  }
}
