/**
 * What the plugin reads of the environment once a session to describe it in
 * every row, as the CLI's own rows describe theirs.
 *
 * Each field is one variable as `$.env.get` answers it, undefined when
 * unset, or only whether it is set where its value is a secret or names a
 * person or a host; context/ reduces each to the value the CLI's column has.
 */
export type Facts = {
  readonly entrypoint: string | undefined
  readonly agentSdkVersion: string | undefined
  readonly hostPlatform: string | undefined
  readonly os: string | undefined
  readonly processorArchitecture: string | undefined
  readonly shellPath: string | undefined
  readonly ci: string | undefined
  readonly claubbit: string | undefined
  readonly githubActions: string | undefined
  readonly claudeCodeAction: string | undefined
  readonly claudeCodeRemote: string | undefined
  readonly remoteEnvironmentType: string | undefined
  readonly containerId: string | undefined
  readonly remoteSessionId: string | undefined
  readonly tags: string | undefined
  readonly hasSessionAccessToken: boolean
  readonly hasSessionIngressTokenFile: boolean
  readonly hasWebsocketAuthFileDescriptor: boolean
  readonly githubEventName: string | undefined
  readonly runnerEnvironment: string | undefined
  readonly runnerOs: string | undefined
  readonly githubActionPath: string | undefined
  readonly githubActorId: string | undefined
  readonly githubRepositoryId: string | undefined
  readonly githubRepositoryOwnerId: string | undefined
  readonly sweBenchRunId: string | undefined
  readonly sweBenchInstanceId: string | undefined
  readonly sweBenchTaskId: string | undefined
  readonly hasP4Port: boolean
  readonly wslDistroName: string | undefined
  readonly hasCursorTraceId: boolean
  readonly vscodeGitAskpassMain: string | undefined
  readonly bundleIdentifier: string | undefined
  readonly hasVisualStudioVersion: boolean
  readonly terminalEmulator: string | undefined
  readonly term: string | undefined
  readonly termProgram: string | undefined
  readonly hasTmux: boolean
  readonly hasSty: boolean
  readonly hasKonsoleVersion: boolean
  readonly hasGnomeTerminalService: boolean
  readonly hasXtermVersion: boolean
  readonly hasVteVersion: boolean
  readonly hasTerminatorUuid: boolean
  readonly hasKittyWindowId: boolean
  readonly hasAlacrittyLog: boolean
  readonly hasTilixId: boolean
  readonly hasWtSession: boolean
  readonly hasSessionName: boolean
  readonly msystem: string | undefined
  readonly hasConEmuAnsi: boolean
  readonly hasConEmuPid: boolean
  readonly hasConEmuTask: boolean
  readonly hasSshConnection: boolean
  readonly hasSshClient: boolean
  readonly hasSshTty: boolean
}
