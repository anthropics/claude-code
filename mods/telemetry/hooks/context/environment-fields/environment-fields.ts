import type { GithubActionsFields } from './github-actions-fields'

/**
 * The `env` block every row of the session carries, as the CLI's own rows
 * carry it, before its keys are spelled for the wire (Entries.wireOf).
 *
 * The machine, the terminal and shell, CI and GitHub Actions, the remote
 * container, the deployment. `isClaudeAiAuth` follows the credential each
 * batch is sent with and joins these then; an absent field is undefined.
 */
export type EnvironmentFields = {
  readonly platform: string
  readonly platformRaw: string
  readonly arch: string
  readonly terminal: string
  readonly shell: string
  readonly packageManagers: string
  readonly runtimes: string
  readonly isCi: boolean
  readonly isClaubbit: boolean
  readonly isGithubAction: boolean
  readonly isClaudeCodeAction: boolean
  readonly isClaudeCodeRemote: boolean
  readonly isLocalAgentMode: boolean
  readonly isConductor: boolean
  readonly deploymentEnvironment: string
  readonly remoteEnvironmentType: string | undefined
  readonly claudeCodeContainerId: string | undefined
  readonly claudeCodeRemoteSessionId: string | undefined
  readonly tags: readonly string[] | undefined
  readonly githubEventName: string | undefined
  readonly githubActionsRunnerEnvironment: string | undefined
  readonly githubActionsRunnerOs: string | undefined
  readonly githubActionRef: string | undefined
  readonly githubActionsMetadata: GithubActionsFields | undefined
  readonly wslVersion: string | undefined
  readonly linuxDistroId: string | undefined
  readonly linuxDistroVersion: string | undefined
  readonly linuxKernel: string | undefined
  readonly vcs: string | undefined
}
