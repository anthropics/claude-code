import type { EngineInterface, On } from 'claude-code'

import Context from './context'
import Gate from './gate'
import IsAnalyticsOff from './is-analytics-off'
import type { Sender } from './sender'
import { telemetryOf } from './telemetry-of'

/**
 * Registers the plugin's hooks: its engine.create step adds `$.telemetry`
 * over the nouns beneath; session.start and session.end feed and flush it.
 *
 * `log` and `mark` queue a row for a built-in caller and refuse any other;
 * a gate that throws refuses too, a refusal from beneath stays as it is. A
 * batch goes out on a timer, when full, and when the session ends.
 *
 * @param on the engine's registrar
 */
export function register(on: On) {
  let sender: Sender | undefined
  let isInteractive: boolean | undefined

  on('telemetry.*', (_$, e, next) => Gate.served(e, next)).catch(
    (_$, e, next) => Gate.caught(e, next),
  )

  on('session.start', (_$, e, next) => {
    isInteractive = e.isInteractive

    return next(e)
  })

  on('session.end', async (_$, e, next) => {
    await sender?.flush()

    return next(e)
  })

  on('engine.create', async (_$, e, next) => {
    const beneath = await next(e)

    sender = telemetryOf({
      authorize: () => beneath.session.authorize(),
      id: () => beneath.session.id(),
      model: () => beneath.session.model(),
      isInteractive: async () =>
        isInteractive ??
        (await beneath.session.surfaces()).includes('terminal'),
      environment: async () => ({
        userType: await beneath.env.get('USER_TYPE'),
        nodeEnv: await beneath.env.get('NODE_ENV'),
        disableTelemetry: await beneath.env.get('DISABLE_TELEMETRY'),
        disableNonessentialTraffic: await beneath.env.get(
          'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
        ),
        doNotTrack: await beneath.env.get('DO_NOT_TRACK'),
        customOauthUrl: await beneath.env.get('CLAUDE_CODE_CUSTOM_OAUTH_URL'),
        useGateway: await beneath.env.get('CLAUDE_CODE_USE_GATEWAY'),
        providerManagedByHost: await beneath.env.get(
          'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST',
        ),
        useBedrock: await beneath.env.get('CLAUDE_CODE_USE_BEDROCK'),
        useVertex: await beneath.env.get('CLAUDE_CODE_USE_VERTEX'),
        useFoundry: await beneath.env.get('CLAUDE_CODE_USE_FOUNDRY'),
        useAnthropicAws: await beneath.env.get('CLAUDE_CODE_USE_ANTHROPIC_AWS'),
        useAnthropicGoogleCloud: await beneath.env.get(
          'CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD',
        ),
        useMantle: await beneath.env.get('CLAUDE_CODE_USE_MANTLE'),
      }),
      policy: () => beneath.settings.read({ source: 'policy' }),
      facts: async () => ({
        entrypoint: await beneath.env.get('CLAUDE_CODE_ENTRYPOINT'),
        agentSdkVersion: await beneath.env.get('CLAUDE_AGENT_SDK_VERSION'),
        hostPlatform: await beneath.env.get('CLAUDE_CODE_HOST_PLATFORM'),
        os: await beneath.env.get('OS'),
        processorArchitecture: await beneath.env.get('PROCESSOR_ARCHITECTURE'),
        shellPath:
          (await beneath.env.get('SHELL')) ??
          (await beneath.env.get('COMSPEC')),
        ci: await beneath.env.get('CI'),
        claubbit: await beneath.env.get('CLAUBBIT'),
        githubActions: await beneath.env.get('GITHUB_ACTIONS'),
        claudeCodeAction: await beneath.env.get('CLAUDE_CODE_ACTION'),
        claudeCodeRemote: await beneath.env.get('CLAUDE_CODE_REMOTE'),
        remoteEnvironmentType: await beneath.env.get(
          'CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE',
        ),
        containerId: await beneath.env.get('CLAUDE_CODE_CONTAINER_ID'),
        remoteSessionId: await beneath.env.get('CLAUDE_CODE_REMOTE_SESSION_ID'),
        tags: await beneath.env.get('CLAUDE_CODE_TAGS'),
        hasSessionAccessToken: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('CLAUDE_CODE_SESSION_ACCESS_TOKEN'),
        ),
        hasSessionIngressTokenFile: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('CLAUDE_SESSION_INGRESS_TOKEN_FILE'),
        ),
        hasWebsocketAuthFileDescriptor: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR'),
        ),
        githubEventName: await beneath.env.get('GITHUB_EVENT_NAME'),
        runnerEnvironment: await beneath.env.get('RUNNER_ENVIRONMENT'),
        runnerOs: await beneath.env.get('RUNNER_OS'),
        githubActionPath: await beneath.env.get('GITHUB_ACTION_PATH'),
        githubActorId: await beneath.env.get('GITHUB_ACTOR_ID'),
        githubRepositoryId: await beneath.env.get('GITHUB_REPOSITORY_ID'),
        githubRepositoryOwnerId: await beneath.env.get(
          'GITHUB_REPOSITORY_OWNER_ID',
        ),
        sweBenchRunId: await beneath.env.get('SWE_BENCH_RUN_ID'),
        sweBenchInstanceId: await beneath.env.get('SWE_BENCH_INSTANCE_ID'),
        sweBenchTaskId: await beneath.env.get('SWE_BENCH_TASK_ID'),
        hasP4Port: IsAnalyticsOff.isEnvSet(await beneath.env.get('P4PORT')),
        wslDistroName: await beneath.env.get('WSL_DISTRO_NAME'),
        hasCursorTraceId: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('CURSOR_TRACE_ID'),
        ),
        vscodeGitAskpassMain: await beneath.env.get('VSCODE_GIT_ASKPASS_MAIN'),
        bundleIdentifier: await beneath.env.get('__CFBundleIdentifier'),
        hasVisualStudioVersion: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('VisualStudioVersion'),
        ),
        terminalEmulator: await beneath.env.get('TERMINAL_EMULATOR'),
        term: await beneath.env.get('TERM'),
        termProgram: await beneath.env.get('TERM_PROGRAM'),
        hasTmux: IsAnalyticsOff.isEnvSet(await beneath.env.get('TMUX')),
        hasSty: IsAnalyticsOff.isEnvSet(await beneath.env.get('STY')),
        hasKonsoleVersion: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('KONSOLE_VERSION'),
        ),
        hasGnomeTerminalService: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('GNOME_TERMINAL_SERVICE'),
        ),
        hasXtermVersion: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('XTERM_VERSION'),
        ),
        hasVteVersion: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('VTE_VERSION'),
        ),
        hasTerminatorUuid: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('TERMINATOR_UUID'),
        ),
        hasKittyWindowId: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('KITTY_WINDOW_ID'),
        ),
        hasAlacrittyLog: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('ALACRITTY_LOG'),
        ),
        hasTilixId: IsAnalyticsOff.isEnvSet(await beneath.env.get('TILIX_ID')),
        hasWtSession: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('WT_SESSION'),
        ),
        hasSessionName: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('SESSIONNAME'),
        ),
        msystem: await beneath.env.get('MSYSTEM'),
        hasConEmuAnsi: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('ConEmuANSI'),
        ),
        hasConEmuPid: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('ConEmuPID'),
        ),
        hasConEmuTask: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('ConEmuTask'),
        ),
        hasSshConnection: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('SSH_CONNECTION'),
        ),
        hasSshClient: IsAnalyticsOff.isEnvSet(
          await beneath.env.get('SSH_CLIENT'),
        ),
        hasSshTty: IsAnalyticsOff.isEnvSet(await beneath.env.get('SSH_TTY')),
      }),
      deployment: async () => [
        [
          'codespaces',
          IsAnalyticsOff.isEnvTruthy(await beneath.env.get('CODESPACES')),
        ],
        [
          'gitpod',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('GITPOD_WORKSPACE_ID')),
        ],
        ['coder', IsAnalyticsOff.isEnvTruthy(await beneath.env.get('CODER'))],
        [
          'coder',
          IsAnalyticsOff.isEnvSet(
            await beneath.env.get('CODER_WORKSPACE_NAME'),
          ),
        ],
        ['devpod', IsAnalyticsOff.isEnvTruthy(await beneath.env.get('DEVPOD'))],
        [
          'devpod',
          IsAnalyticsOff.isEnvSet(
            await beneath.env.get('DEVPOD_WORKSPACE_UID'),
          ),
        ],
        [
          'daytona',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('DAYTONA_WS_ID')),
        ],
        [
          'gcp-cloud-workstations',
          IsAnalyticsOff.isEnvTruthy(
            await beneath.env.get('GOOGLE_CLOUD_WORKSTATIONS'),
          ),
        ],
        [
          'aws-cloud9',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('C9_PID')),
        ],
        [
          'aws-cloud9',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('C9_USER')),
        ],
        ['replit', IsAnalyticsOff.isEnvSet(await beneath.env.get('REPL_ID'))],
        ['replit', IsAnalyticsOff.isEnvSet(await beneath.env.get('REPL_SLUG'))],
        [
          'glitch',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('PROJECT_DOMAIN')),
        ],
        ['vercel', IsAnalyticsOff.isEnvTruthy(await beneath.env.get('VERCEL'))],
        [
          'railway',
          IsAnalyticsOff.isEnvSet(
            await beneath.env.get('RAILWAY_ENVIRONMENT_NAME'),
          ),
        ],
        [
          'railway',
          IsAnalyticsOff.isEnvSet(
            await beneath.env.get('RAILWAY_SERVICE_NAME'),
          ),
        ],
        ['render', IsAnalyticsOff.isEnvTruthy(await beneath.env.get('RENDER'))],
        [
          'netlify',
          IsAnalyticsOff.isEnvTruthy(await beneath.env.get('NETLIFY')),
        ],
        ['heroku', IsAnalyticsOff.isEnvSet(await beneath.env.get('DYNO'))],
        [
          'fly.io',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('FLY_APP_NAME')),
        ],
        [
          'fly.io',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('FLY_MACHINE_ID')),
        ],
        [
          'cloudflare-pages',
          IsAnalyticsOff.isEnvTruthy(await beneath.env.get('CF_PAGES')),
        ],
        [
          'deno-deploy',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('DENO_DEPLOYMENT_ID')),
        ],
        [
          'aws-lambda',
          IsAnalyticsOff.isEnvSet(
            await beneath.env.get('AWS_LAMBDA_FUNCTION_NAME'),
          ),
        ],
        [
          'aws-fargate',
          (await beneath.env.get('AWS_EXECUTION_ENV')) === 'AWS_ECS_FARGATE',
        ],
        [
          'aws-ecs',
          (await beneath.env.get('AWS_EXECUTION_ENV')) === 'AWS_ECS_EC2',
        ],
        [
          'gcp-cloud-run',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('K_SERVICE')),
        ],
        [
          'gcp',
          IsAnalyticsOff.isEnvSet(
            await beneath.env.get('GOOGLE_CLOUD_PROJECT'),
          ),
        ],
        [
          'azure-app-service',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('WEBSITE_SITE_NAME')),
        ],
        [
          'azure-app-service',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('WEBSITE_SKU')),
        ],
        [
          'azure-functions',
          IsAnalyticsOff.isEnvSet(
            await beneath.env.get('AZURE_FUNCTIONS_ENVIRONMENT'),
          ),
        ],
        [
          'digitalocean-app-platform',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('APP_URL')) &&
            String(await beneath.env.get('APP_URL')).includes(
              'ondigitalocean.app',
            ),
        ],
        [
          'huggingface-spaces',
          IsAnalyticsOff.isEnvSet(
            await beneath.env.get('SPACE_CREATOR_USER_ID'),
          ),
        ],
        [
          'github-actions',
          IsAnalyticsOff.isEnvTruthy(await beneath.env.get('GITHUB_ACTIONS')),
        ],
        [
          'gitlab-ci',
          IsAnalyticsOff.isEnvTruthy(await beneath.env.get('GITLAB_CI')),
        ],
        [
          'circleci',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('CIRCLECI')),
        ],
        [
          'buildkite',
          IsAnalyticsOff.isEnvSet(await beneath.env.get('BUILDKITE')),
        ],
        ['ci', IsAnalyticsOff.isEnvTruthy(await beneath.env.get('CI'))],
        [
          'kubernetes',
          IsAnalyticsOff.isEnvSet(
            await beneath.env.get('KUBERNETES_SERVICE_HOST'),
          ),
        ],
      ],
      configLocation: async () => ({
        configDir: await beneath.env.get('CLAUDE_CONFIG_DIR'),
        home: await beneath.env.get('HOME'),
        userProfile: await beneath.env.get('USERPROFILE'),
      }),
      cwd: () => beneath.session.cwd(),
      repo: () => beneath.session.repo(),
      read: path => beneath.fs.read(path),
      list: path => beneath.fs.list(path),
      exists: path => beneath.fs.exists(path),
      run: argv =>
        beneath.process.run(argv, { timeoutMs: Context.PROBE_TIMEOUT_MS }),
      fetch: (url, init) => beneath.http.fetch(url, init),
      after: (ms, fn) => beneath.clock.after(ms, fn),
      sleep: ms => beneath.clock.sleep(ms),
      debug: text => beneath.ui.log(text, { to: 'debug' }),
    })

    const telemetry: EngineInterface['telemetry'] = sender.telemetry

    return { ...beneath, telemetry }
  })
}
