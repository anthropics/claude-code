import { feature } from 'bun:bundle';

// Bugfix for corepack auto-pinning, which adds yarnpkg to peoples' package.jsons
// eslint-disable-next-line custom-rules/no-top-level-side-effects
process.env.COREPACK_ENABLE_AUTO_PIN = '0';

// Set max heap size for child processes in CCR environments (containers have 16GB)
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level, custom-rules/safe-env-boolean-check
if (process.env.CLAUDE_CODE_REMOTE === 'true') {
  // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
  const existing = process.env.NODE_OPTIONS || '';
  // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
  process.env.NODE_OPTIONS = existing ? `${existing} --max-old-space-size=8192` : '--max-old-space-size=8192';
}

// Harness-science L0 ablation baseline. Inlined here (not init.ts) because
// BashTool/AgentTool/PowerShellTool capture DISABLE_BACKGROUND_TASKS into
// module-level consts at import time — init() runs too late. feature() gate
// DCEs this entire block from external builds.
// eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
if (feature('ABLATION_BASELINE') && process.env.CLAUDE_CODE_ABLATION_BASELINE) {
  for (const k of ['CLAUDE_CODE_SIMPLE', 'CLAUDE_CODE_DISABLE_THINKING', 'DISABLE_INTERLEAVED_THINKING', 'DISABLE_COMPACT', 'DISABLE_AUTO_COMPACT', 'CLAUDE_CODE_DISABLE_AUTO_MEMORY', 'CLAUDE_CODE_DISABLE_BACKGROUND_TASKS']) {
    // eslint-disable-next-line custom-rules/no-top-level-side-effects, custom-rules/no-process-env-top-level
    process.env[k] ??= '1';
  }
}

/**
 * Bootstrap entrypoint - checks for special flags before loading the full CLI.
 * All imports are dynamic to minimize module evaluation for fast paths.
 * Fast-path for --version has zero imports beyond this file.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Fast-path for --version/-v: zero module loading needed
  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v' || args[0] === '-V')) {
    // MACRO.VERSION is inlined at build time
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`${MACRO.VERSION} (Claude Code)`);
    return;
  }

  // For all other paths, load the startup profiler
  const {
    profileCheckpoint
  } = await import('../utils/startupProfiler.js');
  profileCheckpoint('cli_entry');

  // Fast-path for --dump-system-prompt: output the rendered system prompt and exit.
  // Used by prompt sensitivity evals to extract the system prompt at a specific commit.
  // Ant-only: eliminated from external builds via feature flag.
  if (feature('DUMP_SYSTEM_PROMPT') && args[0] === '--dump-system-prompt') {
    profileCheckpoint('cli_dump_system_prompt_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      getMainLoopModel
    } = await import('../utils/model/model.js');
    const modelIdx = args.indexOf('--model');
    const model = modelIdx !== -1 && args[modelIdx + 1] || getMainLoopModel();
    const {
      getSystemPrompt
    } = await import('../constants/prompts.js');
    const prompt = await getSystemPrompt([], model);
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(prompt.join('\n'));
    return;
  }
  if (process.argv[2] === '--claude-in-chrome-mcp') {
    profileCheckpoint('cli_claude_in_chrome_mcp_path');
    const {
      runClaudeInChromeMcpServer
    } = await import('../utils/claudeInChrome/mcpServer.js');
    await runClaudeInChromeMcpServer();
    return;
  } else if (process.argv[2] === '--chrome-native-host') {
    profileCheckpoint('cli_chrome_native_host_path');
    const {
      runChromeNativeHost
    } = await import('../utils/claudeInChrome/chromeNativeHost.js');
    await runChromeNativeHost();
    return;
  } else if (feature('CHICAGO_MCP') && process.argv[2] === '--computer-use-mcp') {
    profileCheckpoint('cli_computer_use_mcp_path');
    const {
      runComputerUseMcpServer
    } = await import('../utils/computerUse/mcpServer.js');
    await runComputerUseMcpServer();
    return;
  }

  // Fast-path for `--daemon-worker=<kind>` (internal — supervisor spawns this).
  // Must come before the daemon subcommand check: spawned per-worker, so
  // perf-sensitive. No enableConfigs(), no analytics sinks at this layer —
  // workers are lean. If a worker kind needs configs/auth (assistant will),
  // it calls them inside its run() fn.
  if (feature('DAEMON') && args[0] === '--daemon-worker') {
    const {
      runDaemonWorker
    } = await import('../daemon/workerRegistry.js');
    await runDaemonWorker(args[1]);
    return;
  }

  // Fast-path for `claude remote-control` (also accepts legacy `claude remote` / `claude sync` / `claude bridge`):
  // serve local machine as bridge environment.
  // feature() must stay inline for build-time dead code elimination;
  // isBridgeEnabled() checks the runtime GrowthBook gate.
  if (feature('BRIDGE_MODE') && (args[0] === 'remote-control' || args[0] === 'rc' || args[0] === 'remote' || args[0] === 'sync' || args[0] === 'bridge')) {
    profileCheckpoint('cli_bridge_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      getBridgeDisabledReason,
      checkBridgeMinVersion
    } = await import('../bridge/bridgeEnabled.js');
    const {
      BRIDGE_LOGIN_ERROR
    } = await import('../bridge/types.js');
    const {
      bridgeMain
    } = await import('../bridge/bridgeMain.js');
    const {
      exitWithError
    } = await import('../utils/process.js');

    // Auth check must come before the GrowthBook gate check — without auth,
    // GrowthBook has no user context and would return a stale/default false.
    // getBridgeDisabledReason awaits GB init, so the returned value is fresh
    // (not the stale disk cache), but init still needs auth headers to work.
    const {
      getClaudeAIOAuthTokens
    } = await import('../utils/auth.js');
    if (!getClaudeAIOAuthTokens()?.accessToken) {
      exitWithError(BRIDGE_LOGIN_ERROR);
    }
    const disabledReason = await getBridgeDisabledReason();
    if (disabledReason) {
      exitWithError(`Error: ${disabledReason}`);
    }
    const versionError = checkBridgeMinVersion();
    if (versionError) {
      exitWithError(versionError);
    }

    // Bridge is a remote control feature - check policy limits
    const {
      waitForPolicyLimitsToLoad,
      isPolicyAllowed
    } = await import('../services/policyLimits/index.js');
    await waitForPolicyLimitsToLoad();
    if (!isPolicyAllowed('allow_remote_control')) {
      exitWithError("Error: Remote Control is disabled by your organization's policy.");
    }
    await bridgeMain(args.slice(1));
    return;
  }

  // Fast-path for `claude daemon [subcommand]`: long-running supervisor.
  if (feature('DAEMON') && args[0] === 'daemon') {
    profileCheckpoint('cli_daemon_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      initSinks
    } = await import('../utils/sinks.js');
    initSinks();
    const {
      daemonMain
    } = await import('../daemon/main.js');
    await daemonMain(args.slice(1));
    return;
  }

  // Fast-path for `claude ps|logs|attach|kill` and `--bg`/`--background`.
  // Session management against the ~/.claude/sessions/ registry. Flag
  // literals are inlined so bg.js only loads when actually dispatching.
  if (feature('BG_SESSIONS') && (args[0] === 'ps' || args[0] === 'logs' || args[0] === 'attach' || args[0] === 'kill' || args.includes('--bg') || args.includes('--background'))) {
    profileCheckpoint('cli_bg_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const bg = await import('../cli/bg.js');
    switch (args[0]) {
      case 'ps':
        await bg.psHandler(args.slice(1));
        break;
      case 'logs':
        await bg.logsHandler(args[1]);
        break;
      case 'attach':
        await bg.attachHandler(args[1]);
        break;
      case 'kill':
        await bg.killHandler(args[1]);
        break;
      default:
        await bg.handleBgFlag(args);
    }
    return;
  }

  // Fast-path for template job commands.
  if (feature('TEMPLATES') && (args[0] === 'new' || args[0] === 'list' || args[0] === 'reply')) {
    profileCheckpoint('cli_templates_path');
    const {
      templatesMain
    } = await import('../cli/handlers/templateJobs.js');
    await templatesMain(args);
    // process.exit (not return) — mountFleetView's Ink TUI can leave event
    // loop handles that prevent natural exit.
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(0);
  }

  // Fast-path for `claude environment-runner`: headless BYOC runner.
  // feature() must stay inline for build-time dead code elimination.
  if (feature('BYOC_ENVIRONMENT_RUNNER') && args[0] === 'environment-runner') {
    profileCheckpoint('cli_environment_runner_path');
    const {
      environmentRunnerMain
    } = await import('../environment-runner/main.js');
    await environmentRunnerMain(args.slice(1));
    return;
  }

  // Fast-path for `claude self-hosted-runner`: headless self-hosted-runner
  // targeting the SelfHostedRunnerWorkerService API (register + poll; poll IS
  // heartbeat). feature() must stay inline for build-time dead code elimination.
  if (feature('SELF_HOSTED_RUNNER') && args[0] === 'self-hosted-runner') {
    profileCheckpoint('cli_self_hosted_runner_path');
    const {
      selfHostedRunnerMain
    } = await import('../self-hosted-runner/main.js');
    await selfHostedRunnerMain(args.slice(1));
    return;
  }

  // Fast-path for --worktree --tmux: exec into tmux before loading full CLI
  const hasTmuxFlag = args.includes('--tmux') || args.includes('--tmux=classic');
  if (hasTmuxFlag && (args.includes('-w') || args.includes('--worktree') || args.some(a => a.startsWith('--worktree=')))) {
    profileCheckpoint('cli_tmux_worktree_fast_path');
    const {
      enableConfigs
    } = await import('../utils/config.js');
    enableConfigs();
    const {
      isWorktreeModeEnabled
    } = await import('../utils/worktreeModeEnabled.js');
    if (isWorktreeModeEnabled()) {
      const {
        execIntoTmuxWorktree
      } = await import('../utils/worktree.js');
      const result = await execIntoTmuxWorktree(args);
      if (result.handled) {
        return;
      }
      // If not handled (e.g., error), fall through to normal CLI
      if (result.error) {
        const {
          exitWithError
        } = await import('../utils/process.js');
        exitWithError(result.error);
      }
    }
  }

  // Redirect common update flag mistakes to the update subcommand
  if (args.length === 1 && (args[0] === '--update' || args[0] === '--upgrade')) {
    process.argv = [process.argv[0]!, process.argv[1]!, 'update'];
  }

  // --bare: set SIMPLE early so gates fire during module eval / commander
  // option building (not just inside the action handler).
  if (args.includes('--bare')) {
    process.env.CLAUDE_CODE_SIMPLE = '1';
  }

  // No special flags detected, load and run the full CLI
  const {
    startCapturingEarlyInput
  } = await import('../utils/earlyInput.js');
  startCapturingEarlyInput();
  profileCheckpoint('cli_before_main_import');
  const {
    main: cliMain
  } = await import('../main.js');
  profileCheckpoint('cli_after_main_import');
  await cliMain();
  profileCheckpoint('cli_after_main_complete');
}

// eslint-disable-next-line custom-rules/no-top-level-side-effects
void main();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwicHJvY2VzcyIsImVudiIsIkNPUkVQQUNLX0VOQUJMRV9BVVRPX1BJTiIsIkNMQVVERV9DT0RFX1JFTU9URSIsImV4aXN0aW5nIiwiTk9ERV9PUFRJT05TIiwiQ0xBVURFX0NPREVfQUJMQVRJT05fQkFTRUxJTkUiLCJrIiwibWFpbiIsIlByb21pc2UiLCJhcmdzIiwiYXJndiIsInNsaWNlIiwibGVuZ3RoIiwiY29uc29sZSIsImxvZyIsIk1BQ1JPIiwiVkVSU0lPTiIsInByb2ZpbGVDaGVja3BvaW50IiwiZW5hYmxlQ29uZmlncyIsImdldE1haW5Mb29wTW9kZWwiLCJtb2RlbElkeCIsImluZGV4T2YiLCJtb2RlbCIsImdldFN5c3RlbVByb21wdCIsInByb21wdCIsImpvaW4iLCJydW5DbGF1ZGVJbkNocm9tZU1jcFNlcnZlciIsInJ1bkNocm9tZU5hdGl2ZUhvc3QiLCJydW5Db21wdXRlclVzZU1jcFNlcnZlciIsInJ1bkRhZW1vbldvcmtlciIsImdldEJyaWRnZURpc2FibGVkUmVhc29uIiwiY2hlY2tCcmlkZ2VNaW5WZXJzaW9uIiwiQlJJREdFX0xPR0lOX0VSUk9SIiwiYnJpZGdlTWFpbiIsImV4aXRXaXRoRXJyb3IiLCJnZXRDbGF1ZGVBSU9BdXRoVG9rZW5zIiwiYWNjZXNzVG9rZW4iLCJkaXNhYmxlZFJlYXNvbiIsInZlcnNpb25FcnJvciIsIndhaXRGb3JQb2xpY3lMaW1pdHNUb0xvYWQiLCJpc1BvbGljeUFsbG93ZWQiLCJpbml0U2lua3MiLCJkYWVtb25NYWluIiwiaW5jbHVkZXMiLCJiZyIsInBzSGFuZGxlciIsImxvZ3NIYW5kbGVyIiwiYXR0YWNoSGFuZGxlciIsImtpbGxIYW5kbGVyIiwiaGFuZGxlQmdGbGFnIiwidGVtcGxhdGVzTWFpbiIsImV4aXQiLCJlbnZpcm9ubWVudFJ1bm5lck1haW4iLCJzZWxmSG9zdGVkUnVubmVyTWFpbiIsImhhc1RtdXhGbGFnIiwic29tZSIsImEiLCJzdGFydHNXaXRoIiwiaXNXb3JrdHJlZU1vZGVFbmFibGVkIiwiZXhlY0ludG9UbXV4V29ya3RyZWUiLCJyZXN1bHQiLCJoYW5kbGVkIiwiZXJyb3IiLCJDTEFVREVfQ09ERV9TSU1QTEUiLCJzdGFydENhcHR1cmluZ0Vhcmx5SW5wdXQiLCJjbGlNYWluIl0sInNvdXJjZXMiOlsiY2xpLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcblxuLy8gQnVnZml4IGZvciBjb3JlcGFjayBhdXRvLXBpbm5pbmcsIHdoaWNoIGFkZHMgeWFybnBrZyB0byBwZW9wbGVzJyBwYWNrYWdlLmpzb25zXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL25vLXRvcC1sZXZlbC1zaWRlLWVmZmVjdHNcbnByb2Nlc3MuZW52LkNPUkVQQUNLX0VOQUJMRV9BVVRPX1BJTiA9ICcwJ1xuXG4vLyBTZXQgbWF4IGhlYXAgc2l6ZSBmb3IgY2hpbGQgcHJvY2Vzc2VzIGluIENDUiBlbnZpcm9ubWVudHMgKGNvbnRhaW5lcnMgaGF2ZSAxNkdCKVxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby10b3AtbGV2ZWwtc2lkZS1lZmZlY3RzLCBjdXN0b20tcnVsZXMvbm8tcHJvY2Vzcy1lbnYtdG9wLWxldmVsLCBjdXN0b20tcnVsZXMvc2FmZS1lbnYtYm9vbGVhbi1jaGVja1xuaWYgKHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX1JFTU9URSA9PT0gJ3RydWUnKSB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tdG9wLWxldmVsLXNpZGUtZWZmZWN0cywgY3VzdG9tLXJ1bGVzL25vLXByb2Nlc3MtZW52LXRvcC1sZXZlbFxuICBjb25zdCBleGlzdGluZyA9IHByb2Nlc3MuZW52Lk5PREVfT1BUSU9OUyB8fCAnJ1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL25vLXRvcC1sZXZlbC1zaWRlLWVmZmVjdHMsIGN1c3RvbS1ydWxlcy9uby1wcm9jZXNzLWVudi10b3AtbGV2ZWxcbiAgcHJvY2Vzcy5lbnYuTk9ERV9PUFRJT05TID0gZXhpc3RpbmdcbiAgICA/IGAke2V4aXN0aW5nfSAtLW1heC1vbGQtc3BhY2Utc2l6ZT04MTkyYFxuICAgIDogJy0tbWF4LW9sZC1zcGFjZS1zaXplPTgxOTInXG59XG5cbi8vIEhhcm5lc3Mtc2NpZW5jZSBMMCBhYmxhdGlvbiBiYXNlbGluZS4gSW5saW5lZCBoZXJlIChub3QgaW5pdC50cykgYmVjYXVzZVxuLy8gQmFzaFRvb2wvQWdlbnRUb29sL1Bvd2VyU2hlbGxUb29sIGNhcHR1cmUgRElTQUJMRV9CQUNLR1JPVU5EX1RBU0tTIGludG9cbi8vIG1vZHVsZS1sZXZlbCBjb25zdHMgYXQgaW1wb3J0IHRpbWUg4oCUIGluaXQoKSBydW5zIHRvbyBsYXRlLiBmZWF0dXJlKCkgZ2F0ZVxuLy8gRENFcyB0aGlzIGVudGlyZSBibG9jayBmcm9tIGV4dGVybmFsIGJ1aWxkcy5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tdG9wLWxldmVsLXNpZGUtZWZmZWN0cywgY3VzdG9tLXJ1bGVzL25vLXByb2Nlc3MtZW52LXRvcC1sZXZlbFxuaWYgKGZlYXR1cmUoJ0FCTEFUSU9OX0JBU0VMSU5FJykgJiYgcHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfQUJMQVRJT05fQkFTRUxJTkUpIHtcbiAgZm9yIChjb25zdCBrIG9mIFtcbiAgICAnQ0xBVURFX0NPREVfU0lNUExFJyxcbiAgICAnQ0xBVURFX0NPREVfRElTQUJMRV9USElOS0lORycsXG4gICAgJ0RJU0FCTEVfSU5URVJMRUFWRURfVEhJTktJTkcnLFxuICAgICdESVNBQkxFX0NPTVBBQ1QnLFxuICAgICdESVNBQkxFX0FVVE9fQ09NUEFDVCcsXG4gICAgJ0NMQVVERV9DT0RFX0RJU0FCTEVfQVVUT19NRU1PUlknLFxuICAgICdDTEFVREVfQ09ERV9ESVNBQkxFX0JBQ0tHUk9VTkRfVEFTS1MnLFxuICBdKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby10b3AtbGV2ZWwtc2lkZS1lZmZlY3RzLCBjdXN0b20tcnVsZXMvbm8tcHJvY2Vzcy1lbnYtdG9wLWxldmVsXG4gICAgcHJvY2Vzcy5lbnZba10gPz89ICcxJ1xuICB9XG59XG5cbi8qKlxuICogQm9vdHN0cmFwIGVudHJ5cG9pbnQgLSBjaGVja3MgZm9yIHNwZWNpYWwgZmxhZ3MgYmVmb3JlIGxvYWRpbmcgdGhlIGZ1bGwgQ0xJLlxuICogQWxsIGltcG9ydHMgYXJlIGR5bmFtaWMgdG8gbWluaW1pemUgbW9kdWxlIGV2YWx1YXRpb24gZm9yIGZhc3QgcGF0aHMuXG4gKiBGYXN0LXBhdGggZm9yIC0tdmVyc2lvbiBoYXMgemVybyBpbXBvcnRzIGJleW9uZCB0aGlzIGZpbGUuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIG1haW4oKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGFyZ3MgPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMilcblxuICAvLyBGYXN0LXBhdGggZm9yIC0tdmVyc2lvbi8tdjogemVybyBtb2R1bGUgbG9hZGluZyBuZWVkZWRcbiAgaWYgKFxuICAgIGFyZ3MubGVuZ3RoID09PSAxICYmXG4gICAgKGFyZ3NbMF0gPT09ICctLXZlcnNpb24nIHx8IGFyZ3NbMF0gPT09ICctdicgfHwgYXJnc1swXSA9PT0gJy1WJylcbiAgKSB7XG4gICAgLy8gTUFDUk8uVkVSU0lPTiBpcyBpbmxpbmVkIGF0IGJ1aWxkIHRpbWVcbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgY29uc29sZS5sb2coYCR7TUFDUk8uVkVSU0lPTn0gKENsYXVkZSBDb2RlKWApXG4gICAgcmV0dXJuXG4gIH1cblxuICAvLyBGb3IgYWxsIG90aGVyIHBhdGhzLCBsb2FkIHRoZSBzdGFydHVwIHByb2ZpbGVyXG4gIGNvbnN0IHsgcHJvZmlsZUNoZWNrcG9pbnQgfSA9IGF3YWl0IGltcG9ydCgnLi4vdXRpbHMvc3RhcnR1cFByb2ZpbGVyLmpzJylcbiAgcHJvZmlsZUNoZWNrcG9pbnQoJ2NsaV9lbnRyeScpXG5cbiAgLy8gRmFzdC1wYXRoIGZvciAtLWR1bXAtc3lzdGVtLXByb21wdDogb3V0cHV0IHRoZSByZW5kZXJlZCBzeXN0ZW0gcHJvbXB0IGFuZCBleGl0LlxuICAvLyBVc2VkIGJ5IHByb21wdCBzZW5zaXRpdml0eSBldmFscyB0byBleHRyYWN0IHRoZSBzeXN0ZW0gcHJvbXB0IGF0IGEgc3BlY2lmaWMgY29tbWl0LlxuICAvLyBBbnQtb25seTogZWxpbWluYXRlZCBmcm9tIGV4dGVybmFsIGJ1aWxkcyB2aWEgZmVhdHVyZSBmbGFnLlxuICBpZiAoZmVhdHVyZSgnRFVNUF9TWVNURU1fUFJPTVBUJykgJiYgYXJnc1swXSA9PT0gJy0tZHVtcC1zeXN0ZW0tcHJvbXB0Jykge1xuICAgIHByb2ZpbGVDaGVja3BvaW50KCdjbGlfZHVtcF9zeXN0ZW1fcHJvbXB0X3BhdGgnKVxuICAgIGNvbnN0IHsgZW5hYmxlQ29uZmlncyB9ID0gYXdhaXQgaW1wb3J0KCcuLi91dGlscy9jb25maWcuanMnKVxuICAgIGVuYWJsZUNvbmZpZ3MoKVxuICAgIGNvbnN0IHsgZ2V0TWFpbkxvb3BNb2RlbCB9ID0gYXdhaXQgaW1wb3J0KCcuLi91dGlscy9tb2RlbC9tb2RlbC5qcycpXG4gICAgY29uc3QgbW9kZWxJZHggPSBhcmdzLmluZGV4T2YoJy0tbW9kZWwnKVxuICAgIGNvbnN0IG1vZGVsID0gKG1vZGVsSWR4ICE9PSAtMSAmJiBhcmdzW21vZGVsSWR4ICsgMV0pIHx8IGdldE1haW5Mb29wTW9kZWwoKVxuICAgIGNvbnN0IHsgZ2V0U3lzdGVtUHJvbXB0IH0gPSBhd2FpdCBpbXBvcnQoJy4uL2NvbnN0YW50cy9wcm9tcHRzLmpzJylcbiAgICBjb25zdCBwcm9tcHQgPSBhd2FpdCBnZXRTeXN0ZW1Qcm9tcHQoW10sIG1vZGVsKVxuICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Db25zb2xlOjogaW50ZW50aW9uYWwgY29uc29sZSBvdXRwdXRcbiAgICBjb25zb2xlLmxvZyhwcm9tcHQuam9pbignXFxuJykpXG4gICAgcmV0dXJuXG4gIH1cblxuICBpZiAocHJvY2Vzcy5hcmd2WzJdID09PSAnLS1jbGF1ZGUtaW4tY2hyb21lLW1jcCcpIHtcbiAgICBwcm9maWxlQ2hlY2twb2ludCgnY2xpX2NsYXVkZV9pbl9jaHJvbWVfbWNwX3BhdGgnKVxuICAgIGNvbnN0IHsgcnVuQ2xhdWRlSW5DaHJvbWVNY3BTZXJ2ZXIgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICcuLi91dGlscy9jbGF1ZGVJbkNocm9tZS9tY3BTZXJ2ZXIuanMnXG4gICAgKVxuICAgIGF3YWl0IHJ1bkNsYXVkZUluQ2hyb21lTWNwU2VydmVyKClcbiAgICByZXR1cm5cbiAgfSBlbHNlIGlmIChwcm9jZXNzLmFyZ3ZbMl0gPT09ICctLWNocm9tZS1uYXRpdmUtaG9zdCcpIHtcbiAgICBwcm9maWxlQ2hlY2twb2ludCgnY2xpX2Nocm9tZV9uYXRpdmVfaG9zdF9wYXRoJylcbiAgICBjb25zdCB7IHJ1bkNocm9tZU5hdGl2ZUhvc3QgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICcuLi91dGlscy9jbGF1ZGVJbkNocm9tZS9jaHJvbWVOYXRpdmVIb3N0LmpzJ1xuICAgIClcbiAgICBhd2FpdCBydW5DaHJvbWVOYXRpdmVIb3N0KClcbiAgICByZXR1cm5cbiAgfSBlbHNlIGlmIChcbiAgICBmZWF0dXJlKCdDSElDQUdPX01DUCcpICYmXG4gICAgcHJvY2Vzcy5hcmd2WzJdID09PSAnLS1jb21wdXRlci11c2UtbWNwJ1xuICApIHtcbiAgICBwcm9maWxlQ2hlY2twb2ludCgnY2xpX2NvbXB1dGVyX3VzZV9tY3BfcGF0aCcpXG4gICAgY29uc3QgeyBydW5Db21wdXRlclVzZU1jcFNlcnZlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgJy4uL3V0aWxzL2NvbXB1dGVyVXNlL21jcFNlcnZlci5qcydcbiAgICApXG4gICAgYXdhaXQgcnVuQ29tcHV0ZXJVc2VNY3BTZXJ2ZXIoKVxuICAgIHJldHVyblxuICB9XG5cbiAgLy8gRmFzdC1wYXRoIGZvciBgLS1kYWVtb24td29ya2VyPTxraW5kPmAgKGludGVybmFsIOKAlCBzdXBlcnZpc29yIHNwYXducyB0aGlzKS5cbiAgLy8gTXVzdCBjb21lIGJlZm9yZSB0aGUgZGFlbW9uIHN1YmNvbW1hbmQgY2hlY2s6IHNwYXduZWQgcGVyLXdvcmtlciwgc29cbiAgLy8gcGVyZi1zZW5zaXRpdmUuIE5vIGVuYWJsZUNvbmZpZ3MoKSwgbm8gYW5hbHl0aWNzIHNpbmtzIGF0IHRoaXMgbGF5ZXIg4oCUXG4gIC8vIHdvcmtlcnMgYXJlIGxlYW4uIElmIGEgd29ya2VyIGtpbmQgbmVlZHMgY29uZmlncy9hdXRoIChhc3Npc3RhbnQgd2lsbCksXG4gIC8vIGl0IGNhbGxzIHRoZW0gaW5zaWRlIGl0cyBydW4oKSBmbi5cbiAgaWYgKGZlYXR1cmUoJ0RBRU1PTicpICYmIGFyZ3NbMF0gPT09ICctLWRhZW1vbi13b3JrZXInKSB7XG4gICAgY29uc3QgeyBydW5EYWVtb25Xb3JrZXIgfSA9IGF3YWl0IGltcG9ydCgnLi4vZGFlbW9uL3dvcmtlclJlZ2lzdHJ5LmpzJylcbiAgICBhd2FpdCBydW5EYWVtb25Xb3JrZXIoYXJnc1sxXSlcbiAgICByZXR1cm5cbiAgfVxuXG4gIC8vIEZhc3QtcGF0aCBmb3IgYGNsYXVkZSByZW1vdGUtY29udHJvbGAgKGFsc28gYWNjZXB0cyBsZWdhY3kgYGNsYXVkZSByZW1vdGVgIC8gYGNsYXVkZSBzeW5jYCAvIGBjbGF1ZGUgYnJpZGdlYCk6XG4gIC8vIHNlcnZlIGxvY2FsIG1hY2hpbmUgYXMgYnJpZGdlIGVudmlyb25tZW50LlxuICAvLyBmZWF0dXJlKCkgbXVzdCBzdGF5IGlubGluZSBmb3IgYnVpbGQtdGltZSBkZWFkIGNvZGUgZWxpbWluYXRpb247XG4gIC8vIGlzQnJpZGdlRW5hYmxlZCgpIGNoZWNrcyB0aGUgcnVudGltZSBHcm93dGhCb29rIGdhdGUuXG4gIGlmIChcbiAgICBmZWF0dXJlKCdCUklER0VfTU9ERScpICYmXG4gICAgKGFyZ3NbMF0gPT09ICdyZW1vdGUtY29udHJvbCcgfHxcbiAgICAgIGFyZ3NbMF0gPT09ICdyYycgfHxcbiAgICAgIGFyZ3NbMF0gPT09ICdyZW1vdGUnIHx8XG4gICAgICBhcmdzWzBdID09PSAnc3luYycgfHxcbiAgICAgIGFyZ3NbMF0gPT09ICdicmlkZ2UnKVxuICApIHtcbiAgICBwcm9maWxlQ2hlY2twb2ludCgnY2xpX2JyaWRnZV9wYXRoJylcbiAgICBjb25zdCB7IGVuYWJsZUNvbmZpZ3MgfSA9IGF3YWl0IGltcG9ydCgnLi4vdXRpbHMvY29uZmlnLmpzJylcbiAgICBlbmFibGVDb25maWdzKClcblxuICAgIGNvbnN0IHsgZ2V0QnJpZGdlRGlzYWJsZWRSZWFzb24sIGNoZWNrQnJpZGdlTWluVmVyc2lvbiB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgJy4uL2JyaWRnZS9icmlkZ2VFbmFibGVkLmpzJ1xuICAgIClcbiAgICBjb25zdCB7IEJSSURHRV9MT0dJTl9FUlJPUiB9ID0gYXdhaXQgaW1wb3J0KCcuLi9icmlkZ2UvdHlwZXMuanMnKVxuICAgIGNvbnN0IHsgYnJpZGdlTWFpbiB9ID0gYXdhaXQgaW1wb3J0KCcuLi9icmlkZ2UvYnJpZGdlTWFpbi5qcycpXG4gICAgY29uc3QgeyBleGl0V2l0aEVycm9yIH0gPSBhd2FpdCBpbXBvcnQoJy4uL3V0aWxzL3Byb2Nlc3MuanMnKVxuXG4gICAgLy8gQXV0aCBjaGVjayBtdXN0IGNvbWUgYmVmb3JlIHRoZSBHcm93dGhCb29rIGdhdGUgY2hlY2sg4oCUIHdpdGhvdXQgYXV0aCxcbiAgICAvLyBHcm93dGhCb29rIGhhcyBubyB1c2VyIGNvbnRleHQgYW5kIHdvdWxkIHJldHVybiBhIHN0YWxlL2RlZmF1bHQgZmFsc2UuXG4gICAgLy8gZ2V0QnJpZGdlRGlzYWJsZWRSZWFzb24gYXdhaXRzIEdCIGluaXQsIHNvIHRoZSByZXR1cm5lZCB2YWx1ZSBpcyBmcmVzaFxuICAgIC8vIChub3QgdGhlIHN0YWxlIGRpc2sgY2FjaGUpLCBidXQgaW5pdCBzdGlsbCBuZWVkcyBhdXRoIGhlYWRlcnMgdG8gd29yay5cbiAgICBjb25zdCB7IGdldENsYXVkZUFJT0F1dGhUb2tlbnMgfSA9IGF3YWl0IGltcG9ydCgnLi4vdXRpbHMvYXV0aC5qcycpXG4gICAgaWYgKCFnZXRDbGF1ZGVBSU9BdXRoVG9rZW5zKCk/LmFjY2Vzc1Rva2VuKSB7XG4gICAgICBleGl0V2l0aEVycm9yKEJSSURHRV9MT0dJTl9FUlJPUilcbiAgICB9XG4gICAgY29uc3QgZGlzYWJsZWRSZWFzb24gPSBhd2FpdCBnZXRCcmlkZ2VEaXNhYmxlZFJlYXNvbigpXG4gICAgaWYgKGRpc2FibGVkUmVhc29uKSB7XG4gICAgICBleGl0V2l0aEVycm9yKGBFcnJvcjogJHtkaXNhYmxlZFJlYXNvbn1gKVxuICAgIH1cbiAgICBjb25zdCB2ZXJzaW9uRXJyb3IgPSBjaGVja0JyaWRnZU1pblZlcnNpb24oKVxuICAgIGlmICh2ZXJzaW9uRXJyb3IpIHtcbiAgICAgIGV4aXRXaXRoRXJyb3IodmVyc2lvbkVycm9yKVxuICAgIH1cblxuICAgIC8vIEJyaWRnZSBpcyBhIHJlbW90ZSBjb250cm9sIGZlYXR1cmUgLSBjaGVjayBwb2xpY3kgbGltaXRzXG4gICAgY29uc3QgeyB3YWl0Rm9yUG9saWN5TGltaXRzVG9Mb2FkLCBpc1BvbGljeUFsbG93ZWQgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICcuLi9zZXJ2aWNlcy9wb2xpY3lMaW1pdHMvaW5kZXguanMnXG4gICAgKVxuICAgIGF3YWl0IHdhaXRGb3JQb2xpY3lMaW1pdHNUb0xvYWQoKVxuICAgIGlmICghaXNQb2xpY3lBbGxvd2VkKCdhbGxvd19yZW1vdGVfY29udHJvbCcpKSB7XG4gICAgICBleGl0V2l0aEVycm9yKFxuICAgICAgICBcIkVycm9yOiBSZW1vdGUgQ29udHJvbCBpcyBkaXNhYmxlZCBieSB5b3VyIG9yZ2FuaXphdGlvbidzIHBvbGljeS5cIixcbiAgICAgIClcbiAgICB9XG5cbiAgICBhd2FpdCBicmlkZ2VNYWluKGFyZ3Muc2xpY2UoMSkpXG4gICAgcmV0dXJuXG4gIH1cblxuICAvLyBGYXN0LXBhdGggZm9yIGBjbGF1ZGUgZGFlbW9uIFtzdWJjb21tYW5kXWA6IGxvbmctcnVubmluZyBzdXBlcnZpc29yLlxuICBpZiAoZmVhdHVyZSgnREFFTU9OJykgJiYgYXJnc1swXSA9PT0gJ2RhZW1vbicpIHtcbiAgICBwcm9maWxlQ2hlY2twb2ludCgnY2xpX2RhZW1vbl9wYXRoJylcbiAgICBjb25zdCB7IGVuYWJsZUNvbmZpZ3MgfSA9IGF3YWl0IGltcG9ydCgnLi4vdXRpbHMvY29uZmlnLmpzJylcbiAgICBlbmFibGVDb25maWdzKClcbiAgICBjb25zdCB7IGluaXRTaW5rcyB9ID0gYXdhaXQgaW1wb3J0KCcuLi91dGlscy9zaW5rcy5qcycpXG4gICAgaW5pdFNpbmtzKClcbiAgICBjb25zdCB7IGRhZW1vbk1haW4gfSA9IGF3YWl0IGltcG9ydCgnLi4vZGFlbW9uL21haW4uanMnKVxuICAgIGF3YWl0IGRhZW1vbk1haW4oYXJncy5zbGljZSgxKSlcbiAgICByZXR1cm5cbiAgfVxuXG4gIC8vIEZhc3QtcGF0aCBmb3IgYGNsYXVkZSBwc3xsb2dzfGF0dGFjaHxraWxsYCBhbmQgYC0tYmdgL2AtLWJhY2tncm91bmRgLlxuICAvLyBTZXNzaW9uIG1hbmFnZW1lbnQgYWdhaW5zdCB0aGUgfi8uY2xhdWRlL3Nlc3Npb25zLyByZWdpc3RyeS4gRmxhZ1xuICAvLyBsaXRlcmFscyBhcmUgaW5saW5lZCBzbyBiZy5qcyBvbmx5IGxvYWRzIHdoZW4gYWN0dWFsbHkgZGlzcGF0Y2hpbmcuXG4gIGlmIChcbiAgICBmZWF0dXJlKCdCR19TRVNTSU9OUycpICYmXG4gICAgKGFyZ3NbMF0gPT09ICdwcycgfHxcbiAgICAgIGFyZ3NbMF0gPT09ICdsb2dzJyB8fFxuICAgICAgYXJnc1swXSA9PT0gJ2F0dGFjaCcgfHxcbiAgICAgIGFyZ3NbMF0gPT09ICdraWxsJyB8fFxuICAgICAgYXJncy5pbmNsdWRlcygnLS1iZycpIHx8XG4gICAgICBhcmdzLmluY2x1ZGVzKCctLWJhY2tncm91bmQnKSlcbiAgKSB7XG4gICAgcHJvZmlsZUNoZWNrcG9pbnQoJ2NsaV9iZ19wYXRoJylcbiAgICBjb25zdCB7IGVuYWJsZUNvbmZpZ3MgfSA9IGF3YWl0IGltcG9ydCgnLi4vdXRpbHMvY29uZmlnLmpzJylcbiAgICBlbmFibGVDb25maWdzKClcbiAgICBjb25zdCBiZyA9IGF3YWl0IGltcG9ydCgnLi4vY2xpL2JnLmpzJylcbiAgICBzd2l0Y2ggKGFyZ3NbMF0pIHtcbiAgICAgIGNhc2UgJ3BzJzpcbiAgICAgICAgYXdhaXQgYmcucHNIYW5kbGVyKGFyZ3Muc2xpY2UoMSkpXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdsb2dzJzpcbiAgICAgICAgYXdhaXQgYmcubG9nc0hhbmRsZXIoYXJnc1sxXSlcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2F0dGFjaCc6XG4gICAgICAgIGF3YWl0IGJnLmF0dGFjaEhhbmRsZXIoYXJnc1sxXSlcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2tpbGwnOlxuICAgICAgICBhd2FpdCBiZy5raWxsSGFuZGxlcihhcmdzWzFdKVxuICAgICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXdhaXQgYmcuaGFuZGxlQmdGbGFnKGFyZ3MpXG4gICAgfVxuICAgIHJldHVyblxuICB9XG5cbiAgLy8gRmFzdC1wYXRoIGZvciB0ZW1wbGF0ZSBqb2IgY29tbWFuZHMuXG4gIGlmIChcbiAgICBmZWF0dXJlKCdURU1QTEFURVMnKSAmJlxuICAgIChhcmdzWzBdID09PSAnbmV3JyB8fCBhcmdzWzBdID09PSAnbGlzdCcgfHwgYXJnc1swXSA9PT0gJ3JlcGx5JylcbiAgKSB7XG4gICAgcHJvZmlsZUNoZWNrcG9pbnQoJ2NsaV90ZW1wbGF0ZXNfcGF0aCcpXG4gICAgY29uc3QgeyB0ZW1wbGF0ZXNNYWluIH0gPSBhd2FpdCBpbXBvcnQoJy4uL2NsaS9oYW5kbGVycy90ZW1wbGF0ZUpvYnMuanMnKVxuICAgIGF3YWl0IHRlbXBsYXRlc01haW4oYXJncylcbiAgICAvLyBwcm9jZXNzLmV4aXQgKG5vdCByZXR1cm4pIOKAlCBtb3VudEZsZWV0VmlldydzIEluayBUVUkgY2FuIGxlYXZlIGV2ZW50XG4gICAgLy8gbG9vcCBoYW5kbGVzIHRoYXQgcHJldmVudCBuYXR1cmFsIGV4aXQuXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby1wcm9jZXNzLWV4aXRcbiAgICBwcm9jZXNzLmV4aXQoMClcbiAgfVxuXG4gIC8vIEZhc3QtcGF0aCBmb3IgYGNsYXVkZSBlbnZpcm9ubWVudC1ydW5uZXJgOiBoZWFkbGVzcyBCWU9DIHJ1bm5lci5cbiAgLy8gZmVhdHVyZSgpIG11c3Qgc3RheSBpbmxpbmUgZm9yIGJ1aWxkLXRpbWUgZGVhZCBjb2RlIGVsaW1pbmF0aW9uLlxuICBpZiAoZmVhdHVyZSgnQllPQ19FTlZJUk9OTUVOVF9SVU5ORVInKSAmJiBhcmdzWzBdID09PSAnZW52aXJvbm1lbnQtcnVubmVyJykge1xuICAgIHByb2ZpbGVDaGVja3BvaW50KCdjbGlfZW52aXJvbm1lbnRfcnVubmVyX3BhdGgnKVxuICAgIGNvbnN0IHsgZW52aXJvbm1lbnRSdW5uZXJNYWluIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAnLi4vZW52aXJvbm1lbnQtcnVubmVyL21haW4uanMnXG4gICAgKVxuICAgIGF3YWl0IGVudmlyb25tZW50UnVubmVyTWFpbihhcmdzLnNsaWNlKDEpKVxuICAgIHJldHVyblxuICB9XG5cbiAgLy8gRmFzdC1wYXRoIGZvciBgY2xhdWRlIHNlbGYtaG9zdGVkLXJ1bm5lcmA6IGhlYWRsZXNzIHNlbGYtaG9zdGVkLXJ1bm5lclxuICAvLyB0YXJnZXRpbmcgdGhlIFNlbGZIb3N0ZWRSdW5uZXJXb3JrZXJTZXJ2aWNlIEFQSSAocmVnaXN0ZXIgKyBwb2xsOyBwb2xsIElTXG4gIC8vIGhlYXJ0YmVhdCkuIGZlYXR1cmUoKSBtdXN0IHN0YXkgaW5saW5lIGZvciBidWlsZC10aW1lIGRlYWQgY29kZSBlbGltaW5hdGlvbi5cbiAgaWYgKGZlYXR1cmUoJ1NFTEZfSE9TVEVEX1JVTk5FUicpICYmIGFyZ3NbMF0gPT09ICdzZWxmLWhvc3RlZC1ydW5uZXInKSB7XG4gICAgcHJvZmlsZUNoZWNrcG9pbnQoJ2NsaV9zZWxmX2hvc3RlZF9ydW5uZXJfcGF0aCcpXG4gICAgY29uc3QgeyBzZWxmSG9zdGVkUnVubmVyTWFpbiB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgJy4uL3NlbGYtaG9zdGVkLXJ1bm5lci9tYWluLmpzJ1xuICAgIClcbiAgICBhd2FpdCBzZWxmSG9zdGVkUnVubmVyTWFpbihhcmdzLnNsaWNlKDEpKVxuICAgIHJldHVyblxuICB9XG5cbiAgLy8gRmFzdC1wYXRoIGZvciAtLXdvcmt0cmVlIC0tdG11eDogZXhlYyBpbnRvIHRtdXggYmVmb3JlIGxvYWRpbmcgZnVsbCBDTElcbiAgY29uc3QgaGFzVG11eEZsYWcgPSBhcmdzLmluY2x1ZGVzKCctLXRtdXgnKSB8fCBhcmdzLmluY2x1ZGVzKCctLXRtdXg9Y2xhc3NpYycpXG4gIGlmIChcbiAgICBoYXNUbXV4RmxhZyAmJlxuICAgIChhcmdzLmluY2x1ZGVzKCctdycpIHx8XG4gICAgICBhcmdzLmluY2x1ZGVzKCctLXdvcmt0cmVlJykgfHxcbiAgICAgIGFyZ3Muc29tZShhID0+IGEuc3RhcnRzV2l0aCgnLS13b3JrdHJlZT0nKSkpXG4gICkge1xuICAgIHByb2ZpbGVDaGVja3BvaW50KCdjbGlfdG11eF93b3JrdHJlZV9mYXN0X3BhdGgnKVxuICAgIGNvbnN0IHsgZW5hYmxlQ29uZmlncyB9ID0gYXdhaXQgaW1wb3J0KCcuLi91dGlscy9jb25maWcuanMnKVxuICAgIGVuYWJsZUNvbmZpZ3MoKVxuICAgIGNvbnN0IHsgaXNXb3JrdHJlZU1vZGVFbmFibGVkIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAnLi4vdXRpbHMvd29ya3RyZWVNb2RlRW5hYmxlZC5qcydcbiAgICApXG4gICAgaWYgKGlzV29ya3RyZWVNb2RlRW5hYmxlZCgpKSB7XG4gICAgICBjb25zdCB7IGV4ZWNJbnRvVG11eFdvcmt0cmVlIH0gPSBhd2FpdCBpbXBvcnQoJy4uL3V0aWxzL3dvcmt0cmVlLmpzJylcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGV4ZWNJbnRvVG11eFdvcmt0cmVlKGFyZ3MpXG4gICAgICBpZiAocmVzdWx0LmhhbmRsZWQpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICAvLyBJZiBub3QgaGFuZGxlZCAoZS5nLiwgZXJyb3IpLCBmYWxsIHRocm91Z2ggdG8gbm9ybWFsIENMSVxuICAgICAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgICBjb25zdCB7IGV4aXRXaXRoRXJyb3IgfSA9IGF3YWl0IGltcG9ydCgnLi4vdXRpbHMvcHJvY2Vzcy5qcycpXG4gICAgICAgIGV4aXRXaXRoRXJyb3IocmVzdWx0LmVycm9yKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFJlZGlyZWN0IGNvbW1vbiB1cGRhdGUgZmxhZyBtaXN0YWtlcyB0byB0aGUgdXBkYXRlIHN1YmNvbW1hbmRcbiAgaWYgKFxuICAgIGFyZ3MubGVuZ3RoID09PSAxICYmXG4gICAgKGFyZ3NbMF0gPT09ICctLXVwZGF0ZScgfHwgYXJnc1swXSA9PT0gJy0tdXBncmFkZScpXG4gICkge1xuICAgIHByb2Nlc3MuYXJndiA9IFtwcm9jZXNzLmFyZ3ZbMF0hLCBwcm9jZXNzLmFyZ3ZbMV0hLCAndXBkYXRlJ11cbiAgfVxuXG4gIC8vIC0tYmFyZTogc2V0IFNJTVBMRSBlYXJseSBzbyBnYXRlcyBmaXJlIGR1cmluZyBtb2R1bGUgZXZhbCAvIGNvbW1hbmRlclxuICAvLyBvcHRpb24gYnVpbGRpbmcgKG5vdCBqdXN0IGluc2lkZSB0aGUgYWN0aW9uIGhhbmRsZXIpLlxuICBpZiAoYXJncy5pbmNsdWRlcygnLS1iYXJlJykpIHtcbiAgICBwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9TSU1QTEUgPSAnMSdcbiAgfVxuXG4gIC8vIE5vIHNwZWNpYWwgZmxhZ3MgZGV0ZWN0ZWQsIGxvYWQgYW5kIHJ1biB0aGUgZnVsbCBDTElcbiAgY29uc3QgeyBzdGFydENhcHR1cmluZ0Vhcmx5SW5wdXQgfSA9IGF3YWl0IGltcG9ydCgnLi4vdXRpbHMvZWFybHlJbnB1dC5qcycpXG4gIHN0YXJ0Q2FwdHVyaW5nRWFybHlJbnB1dCgpXG4gIHByb2ZpbGVDaGVja3BvaW50KCdjbGlfYmVmb3JlX21haW5faW1wb3J0JylcbiAgY29uc3QgeyBtYWluOiBjbGlNYWluIH0gPSBhd2FpdCBpbXBvcnQoJy4uL21haW4uanMnKVxuICBwcm9maWxlQ2hlY2twb2ludCgnY2xpX2FmdGVyX21haW5faW1wb3J0JylcbiAgYXdhaXQgY2xpTWFpbigpXG4gIHByb2ZpbGVDaGVja3BvaW50KCdjbGlfYWZ0ZXJfbWFpbl9jb21wbGV0ZScpXG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tdG9wLWxldmVsLXNpZGUtZWZmZWN0c1xudm9pZCBtYWluKClcbiJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBU0EsT0FBTyxRQUFRLFlBQVk7O0FBRXBDO0FBQ0E7QUFDQUMsT0FBTyxDQUFDQyxHQUFHLENBQUNDLHdCQUF3QixHQUFHLEdBQUc7O0FBRTFDO0FBQ0E7QUFDQSxJQUFJRixPQUFPLENBQUNDLEdBQUcsQ0FBQ0Usa0JBQWtCLEtBQUssTUFBTSxFQUFFO0VBQzdDO0VBQ0EsTUFBTUMsUUFBUSxHQUFHSixPQUFPLENBQUNDLEdBQUcsQ0FBQ0ksWUFBWSxJQUFJLEVBQUU7RUFDL0M7RUFDQUwsT0FBTyxDQUFDQyxHQUFHLENBQUNJLFlBQVksR0FBR0QsUUFBUSxHQUMvQixHQUFHQSxRQUFRLDRCQUE0QixHQUN2QywyQkFBMkI7QUFDakM7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUlMLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJQyxP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