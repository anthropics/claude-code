import { feature } from 'bun:bundle';
import { appendFileSync } from 'fs';
import React from 'react';
import { logEvent } from 'src/services/analytics/index.js';
import { gracefulShutdown, gracefulShutdownSync } from 'src/utils/gracefulShutdown.js';
import { type ChannelEntry, getAllowedChannels, setAllowedChannels, setHasDevChannels, setSessionTrustAccepted, setStatsStore } from './bootstrap/state.js';
import type { Command } from './commands.js';
import { createStatsStore, type StatsStore } from './context/stats.js';
import { getSystemContext } from './context.js';
import { initializeTelemetryAfterTrust } from './entrypoints/init.js';
import { isSynchronizedOutputSupported } from './ink/terminal.js';
import type { RenderOptions, Root, TextProps } from './ink.js';
import { KeybindingSetup } from './keybindings/KeybindingProviderSetup.js';
import { startDeferredPrefetches } from './main.js';
import { checkGate_CACHED_OR_BLOCKING, initializeGrowthBook, resetGrowthBook } from './services/analytics/growthbook.js';
import { isQualifiedForGrove } from './services/api/grove.js';
import { handleMcpjsonServerApprovals } from './services/mcpServerApproval.js';
import { AppStateProvider } from './state/AppState.js';
import { onChangeAppState } from './state/onChangeAppState.js';
import { normalizeApiKeyForConfig } from './utils/authPortable.js';
import { getExternalClaudeMdIncludes, getMemoryFiles, shouldShowClaudeMdExternalIncludesWarning } from './utils/claudemd.js';
import { checkHasTrustDialogAccepted, getCustomApiKeyStatus, getGlobalConfig, saveGlobalConfig } from './utils/config.js';
import { updateDeepLinkTerminalPreference } from './utils/deepLink/terminalPreference.js';
import { isEnvTruthy, isRunningOnHomespace } from './utils/envUtils.js';
import { type FpsMetrics, FpsTracker } from './utils/fpsTracker.js';
import { updateGithubRepoPathMapping } from './utils/githubRepoPathMapping.js';
import { applyConfigEnvironmentVariables } from './utils/managedEnv.js';
import type { PermissionMode } from './utils/permissions/PermissionMode.js';
import { getBaseRenderOptions } from './utils/renderOptions.js';
import { getSettingsWithAllErrors } from './utils/settings/allErrors.js';
import { hasAutoModeOptIn, hasSkipDangerousModePermissionPrompt } from './utils/settings/settings.js';
export function completeOnboarding(): void {
  saveGlobalConfig(current => ({
    ...current,
    hasCompletedOnboarding: true,
    lastOnboardingVersion: MACRO.VERSION
  }));
}
export function showDialog<T = void>(root: Root, renderer: (done: (result: T) => void) => React.ReactNode): Promise<T> {
  return new Promise<T>(resolve => {
    const done = (result: T): void => void resolve(result);
    root.render(renderer(done));
  });
}

/**
 * Render an error message through Ink, then unmount and exit.
 * Use this for fatal errors after the Ink root has been created —
 * console.error is swallowed by Ink's patchConsole, so we render
 * through the React tree instead.
 */
export async function exitWithError(root: Root, message: string, beforeExit?: () => Promise<void>): Promise<never> {
  return exitWithMessage(root, message, {
    color: 'error',
    beforeExit
  });
}

/**
 * Render a message through Ink, then unmount and exit.
 * Use this for messages after the Ink root has been created —
 * console output is swallowed by Ink's patchConsole, so we render
 * through the React tree instead.
 */
export async function exitWithMessage(root: Root, message: string, options?: {
  color?: TextProps['color'];
  exitCode?: number;
  beforeExit?: () => Promise<void>;
}): Promise<never> {
  const {
    Text
  } = await import('./ink.js');
  const color = options?.color;
  const exitCode = options?.exitCode ?? 1;
  root.render(color ? <Text color={color}>{message}</Text> : <Text>{message}</Text>);
  root.unmount();
  await options?.beforeExit?.();
  // eslint-disable-next-line custom-rules/no-process-exit -- exit after Ink unmount
  process.exit(exitCode);
}

/**
 * Show a setup dialog wrapped in AppStateProvider + KeybindingSetup.
 * Reduces boilerplate in showSetupScreens() where every dialog needs these wrappers.
 */
export function showSetupDialog<T = void>(root: Root, renderer: (done: (result: T) => void) => React.ReactNode, options?: {
  onChangeAppState?: typeof onChangeAppState;
}): Promise<T> {
  return showDialog<T>(root, done => <AppStateProvider onChangeAppState={options?.onChangeAppState}>
      <KeybindingSetup>{renderer(done)}</KeybindingSetup>
    </AppStateProvider>);
}

/**
 * Render the main UI into the root and wait for it to exit.
 * Handles the common epilogue: start deferred prefetches, wait for exit, graceful shutdown.
 */
export async function renderAndRun(root: Root, element: React.ReactNode): Promise<void> {
  root.render(element);
  startDeferredPrefetches();
  await root.waitUntilExit();
  await gracefulShutdown(0);
}
export async function showSetupScreens(root: Root, permissionMode: PermissionMode, allowDangerouslySkipPermissions: boolean, commands?: Command[], claudeInChrome?: boolean, devChannels?: ChannelEntry[]): Promise<boolean> {
  if ("production" === 'test' || isEnvTruthy(false) || process.env.IS_DEMO // Skip onboarding in demo mode
  ) {
    return false;
  }
  const config = getGlobalConfig();
  let onboardingShown = false;
  if (!config.theme || !config.hasCompletedOnboarding // always show onboarding at least once
  ) {
    onboardingShown = true;
    const {
      Onboarding
    } = await import('./components/Onboarding.js');
    await showSetupDialog(root, done => <Onboarding onDone={() => {
      completeOnboarding();
      void done();
    }} />, {
      onChangeAppState
    });
  }

  // Always show the trust dialog in interactive sessions, regardless of permission mode.
  // The trust dialog is the workspace trust boundary — it warns about untrusted repos
  // and checks CLAUDE.md external includes. bypassPermissions mode
  // only affects tool execution permissions, not workspace trust.
  // Note: non-interactive sessions (CI/CD with -p) never reach showSetupScreens at all.
  // Skip permission checks in claubbit
  if (!isEnvTruthy(process.env.CLAUBBIT)) {
    // Fast-path: skip TrustDialog import+render when CWD is already trusted.
    // If it returns true, the TrustDialog would auto-resolve regardless of
    // security features, so we can skip the dynamic import and render cycle.
    if (!checkHasTrustDialogAccepted()) {
      const {
        TrustDialog
      } = await import('./components/TrustDialog/TrustDialog.js');
      await showSetupDialog(root, done => <TrustDialog commands={commands} onDone={done} />);
    }

    // Signal that trust has been verified for this session.
    // GrowthBook checks this to decide whether to include auth headers.
    setSessionTrustAccepted(true);

    // Reset and reinitialize GrowthBook after trust is established.
    // Defense for login/logout: clears any prior client so the next init
    // picks up fresh auth headers.
    resetGrowthBook();
    void initializeGrowthBook();

    // Now that trust is established, prefetch system context if it wasn't already
    void getSystemContext();

    // If settings are valid, check for any mcp.json servers that need approval
    const {
      errors: allErrors
    } = getSettingsWithAllErrors();
    if (allErrors.length === 0) {
      await handleMcpjsonServerApprovals(root);
    }

    // Check for claude.md includes that need approval
    if (await shouldShowClaudeMdExternalIncludesWarning()) {
      const externalIncludes = getExternalClaudeMdIncludes(await getMemoryFiles(true));
      const {
        ClaudeMdExternalIncludesDialog
      } = await import('./components/ClaudeMdExternalIncludesDialog.js');
      await showSetupDialog(root, done => <ClaudeMdExternalIncludesDialog onDone={done} isStandaloneDialog externalIncludes={externalIncludes} />);
    }
  }

  // Track current repo path for teleport directory switching (fire-and-forget)
  // This must happen AFTER trust to prevent untrusted directories from poisoning the mapping
  void updateGithubRepoPathMapping();
  if (feature('LODESTONE')) {
    updateDeepLinkTerminalPreference();
  }

  // Apply full environment variables after trust dialog is accepted OR in bypass mode
  // In bypass mode (CI/CD, automation), we trust the environment so apply all variables
  // In normal mode, this happens after the trust dialog is accepted
  // This includes potentially dangerous environment variables from untrusted sources
  applyConfigEnvironmentVariables();

  // Initialize telemetry after env vars are applied so OTEL endpoint env vars and
  // otelHeadersHelper (which requires trust to execute) are available.
  // Defer to next tick so the OTel dynamic import resolves after first render
  // instead of during the pre-render microtask queue.
  setImmediate(() => initializeTelemetryAfterTrust());
  if (await isQualifiedForGrove()) {
    const {
      GroveDialog
    } = await import('src/components/grove/Grove.js');
    const decision = await showSetupDialog<string>(root, done => <GroveDialog showIfAlreadyViewed={false} location={onboardingShown ? 'onboarding' : 'policy_update_modal'} onDone={done} />);
    if (decision === 'escape') {
      logEvent('tengu_grove_policy_exited', {});
      gracefulShutdownSync(0);
      return false;
    }
  }

  // Check for custom API key
  // On homespace, ANTHROPIC_API_KEY is preserved in process.env for child
  // processes but ignored by Claude Code itself (see auth.ts).
  if (process.env.ANTHROPIC_API_KEY && !isRunningOnHomespace()) {
    const customApiKeyTruncated = normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY);
    const keyStatus = getCustomApiKeyStatus(customApiKeyTruncated);
    if (keyStatus === 'new') {
      const {
        ApproveApiKey
      } = await import('./components/ApproveApiKey.js');
      await showSetupDialog<boolean>(root, done => <ApproveApiKey customApiKeyTruncated={customApiKeyTruncated} onDone={done} />, {
        onChangeAppState
      });
    }
  }
  if ((permissionMode === 'bypassPermissions' || allowDangerouslySkipPermissions) && !hasSkipDangerousModePermissionPrompt()) {
    const {
      BypassPermissionsModeDialog
    } = await import('./components/BypassPermissionsModeDialog.js');
    await showSetupDialog(root, done => <BypassPermissionsModeDialog onAccept={done} />);
  }
  if (feature('TRANSCRIPT_CLASSIFIER')) {
    // Only show the opt-in dialog if auto mode actually resolved — if the
    // gate denied it (org not allowlisted, settings disabled), showing
    // consent for an unavailable feature is pointless. The
    // verifyAutoModeGateAccess notification will explain why instead.
    if (permissionMode === 'auto' && !hasAutoModeOptIn()) {
      const {
        AutoModeOptInDialog
      } = await import('./components/AutoModeOptInDialog.js');
      await showSetupDialog(root, done => <AutoModeOptInDialog onAccept={done} onDecline={() => gracefulShutdownSync(1)} declineExits />);
    }
  }

  // --dangerously-load-development-channels confirmation. On accept, append
  // dev channels to any --channels list already set in main.tsx. Org policy
  // is NOT bypassed — gateChannelServer() still runs; this flag only exists
  // to sidestep the --channels approved-server allowlist.
  if (feature('KAIROS') || feature('KAIROS_CHANNELS')) {
    // gateChannelServer and ChannelsNotice read tengu_harbor after this
    // function returns. A cold disk cache (fresh install, or first run after
    // the flag was added server-side) defaults to false and silently drops
    // channel notifications for the whole session — gh#37026.
    // checkGate_CACHED_OR_BLOCKING returns immediately if disk already says
    // true; only blocks on a cold/stale-false cache (awaits the same memoized
    // initializeGrowthBook promise fired earlier). Also warms the
    // isChannelsEnabled() check in the dev-channels dialog below.
    if (getAllowedChannels().length > 0 || (devChannels?.length ?? 0) > 0) {
      await checkGate_CACHED_OR_BLOCKING('tengu_harbor');
    }
    if (devChannels && devChannels.length > 0) {
      const [{
        isChannelsEnabled
      }, {
        getClaudeAIOAuthTokens
      }] = await Promise.all([import('./services/mcp/channelAllowlist.js'), import('./utils/auth.js')]);
      // Skip the dialog when channels are blocked (tengu_harbor off or no
      // OAuth) — accepting then immediately seeing "not available" in
      // ChannelsNotice is worse than no dialog. Append entries anyway so
      // ChannelsNotice renders the blocked branch with the dev entries
      // named. dev:true here is for the flag label in ChannelsNotice
      // (hasNonDev check); the allowlist bypass it also grants is moot
      // since the gate blocks upstream.
      if (!isChannelsEnabled() || !getClaudeAIOAuthTokens()?.accessToken) {
        setAllowedChannels([...getAllowedChannels(), ...devChannels.map(c => ({
          ...c,
          dev: true
        }))]);
        setHasDevChannels(true);
      } else {
        const {
          DevChannelsDialog
        } = await import('./components/DevChannelsDialog.js');
        await showSetupDialog(root, done => <DevChannelsDialog channels={devChannels} onAccept={() => {
          // Mark dev entries per-entry so the allowlist bypass doesn't leak
          // to --channels entries when both flags are passed.
          setAllowedChannels([...getAllowedChannels(), ...devChannels.map(c => ({
            ...c,
            dev: true
          }))]);
          setHasDevChannels(true);
          void done();
        }} />);
      }
    }
  }

  // Show Chrome onboarding for first-time Claude in Chrome users
  if (claudeInChrome && !getGlobalConfig().hasCompletedClaudeInChromeOnboarding) {
    const {
      ClaudeInChromeOnboarding
    } = await import('./components/ClaudeInChromeOnboarding.js');
    await showSetupDialog(root, done => <ClaudeInChromeOnboarding onDone={done} />);
  }
  return onboardingShown;
}
export function getRenderContext(exitOnCtrlC: boolean): {
  renderOptions: RenderOptions;
  getFpsMetrics: () => FpsMetrics | undefined;
  stats: StatsStore;
} {
  let lastFlickerTime = 0;
  const baseOptions = getBaseRenderOptions(exitOnCtrlC);

  // Log analytics event when stdin override is active
  if (baseOptions.stdin) {
    logEvent('tengu_stdin_interactive', {});
  }
  const fpsTracker = new FpsTracker();
  const stats = createStatsStore();
  setStatsStore(stats);

  // Bench mode: when set, append per-frame phase timings as JSONL for
  // offline analysis by bench/repl-scroll.ts. Captures the full TUI
  // render pipeline (yoga → screen buffer → diff → optimize → stdout)
  // so perf work on any phase can be validated against real user flows.
  const frameTimingLogPath = process.env.CLAUDE_CODE_FRAME_TIMING_LOG;
  return {
    getFpsMetrics: () => fpsTracker.getMetrics(),
    stats,
    renderOptions: {
      ...baseOptions,
      onFrame: event => {
        fpsTracker.record(event.durationMs);
        stats.observe('frame_duration_ms', event.durationMs);
        if (frameTimingLogPath && event.phases) {
          // Bench-only env-var-gated path: sync write so no frames dropped
          // on abrupt exit. ~100 bytes at ≤60fps is negligible. rss/cpu are
          // single syscalls; cpu is cumulative — bench side computes delta.
          const line =
          // eslint-disable-next-line custom-rules/no-direct-json-operations -- tiny object, hot bench path
          JSON.stringify({
            total: event.durationMs,
            ...event.phases,
            rss: process.memoryUsage.rss(),
            cpu: process.cpuUsage()
          }) + '\n';
          // eslint-disable-next-line custom-rules/no-sync-fs -- bench-only, sync so no frames dropped on exit
          appendFileSync(frameTimingLogPath, line);
        }
        // Skip flicker reporting for terminals with synchronized output —
        // DEC 2026 buffers between BSU/ESU so clear+redraw is atomic.
        if (isSynchronizedOutputSupported()) {
          return;
        }
        for (const flicker of event.flickers) {
          if (flicker.reason === 'resize') {
            continue;
          }
          const now = Date.now();
          if (now - lastFlickerTime < 1000) {
            logEvent('tengu_flicker', {
              desiredHeight: flicker.desiredHeight,
              actualHeight: flicker.availableHeight,
              reason: flicker.reason
            } as unknown as Record<string, boolean | number | undefined>);
          }
          lastFlickerTime = now;
        }
      }
    }
  };
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiYXBwZW5kRmlsZVN5bmMiLCJSZWFjdCIsImxvZ0V2ZW50IiwiZ3JhY2VmdWxTaHV0ZG93biIsImdyYWNlZnVsU2h1dGRvd25TeW5jIiwiQ2hhbm5lbEVudHJ5IiwiZ2V0QWxsb3dlZENoYW5uZWxzIiwic2V0QWxsb3dlZENoYW5uZWxzIiwic2V0SGFzRGV2Q2hhbm5lbHMiLCJzZXRTZXNzaW9uVHJ1c3RBY2NlcHRlZCIsInNldFN0YXRzU3RvcmUiLCJDb21tYW5kIiwiY3JlYXRlU3RhdHNTdG9yZSIsIlN0YXRzU3RvcmUiLCJnZXRTeXN0ZW1Db250ZXh0IiwiaW5pdGlhbGl6ZVRlbGVtZXRyeUFmdGVyVHJ1c3QiLCJpc1N5bmNocm9uaXplZE91dHB1dFN1cHBvcnRlZCIsIlJlbmRlck9wdGlvbnMiLCJSb290IiwiVGV4dFByb3BzIiwiS2V5YmluZGluZ1NldHVwIiwic3RhcnREZWZlcnJlZFByZWZldGNoZXMiLCJjaGVja0dhdGVfQ0FDSEVEX09SX0JMT0NLSU5HIiwiaW5pdGlhbGl6ZUdyb3d0aEJvb2siLCJyZXNldEdyb3d0aEJvb2siLCJpc1F1YWxpZmllZEZvckdyb3ZlIiwiaGFuZGxlTWNwanNvblNlcnZlckFwcHJvdmFscyIsIkFwcFN0YXRlUHJvdmlkZXIiLCJvbkNoYW5nZUFwcFN0YXRlIiwibm9ybWFsaXplQXBpS2V5Rm9yQ29uZmlnIiwiZ2V0RXh0ZXJuYWxDbGF1ZGVNZEluY2x1ZGVzIiwiZ2V0TWVtb3J5RmlsZXMiLCJzaG91bGRTaG93Q2xhdWRlTWRFeHRlcm5hbEluY2x1ZGVzV2FybmluZyIsImNoZWNrSGFzVHJ1c3REaWFsb2dBY2NlcHRlZCIsImdldEN1c3RvbUFwaUtleVN0YXR1cyIsImdldEdsb2JhbENvbmZpZyIsInNhdmVHbG9iYWxDb25maWciLCJ1cGRhdGVEZWVwTGlua1Rlcm1pbmFsUHJlZmVyZW5jZSIsImlzRW52VHJ1dGh5IiwiaXNSdW5uaW5nT25Ib21lc3BhY2UiLCJGcHNNZXRyaWNzIiwiRnBzVHJhY2tlciIsInVwZGF0ZUdpdGh1YlJlcG9QYXRoTWFwcGluZyIsImFwcGx5Q29uZmlnRW52aXJvbm1lbnRWYXJpYWJsZXMiLCJQZXJtaXNzaW9uTW9kZSIsImdldEJhc2VSZW5kZXJPcHRpb25zIiwiZ2V0U2V0dGluZ3NXaXRoQWxsRXJyb3JzIiwiaGFzQXV0b01vZGVPcHRJbiIsImhhc1NraXBEYW5nZXJvdXNNb2RlUGVybWlzc2lvblByb21wdCIsImNvbXBsZXRlT25ib2FyZGluZyIsImN1cnJlbnQiLCJoYXNDb21wbGV0ZWRPbmJvYXJkaW5nIiwibGFzdE9uYm9hcmRpbmdWZXJzaW9uIiwiTUFDUk8iLCJWRVJTSU9OIiwic2hvd0RpYWxvZyIsInJvb3QiLCJyZW5kZXJlciIsImRvbmUiLCJyZXN1bHQiLCJUIiwiUmVhY3ROb2RlIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZW5kZXIiLCJleGl0V2l0aEVycm9yIiwibWVzc2FnZSIsImJlZm9yZUV4aXQiLCJleGl0V2l0aE1lc3NhZ2UiLCJjb2xvciIsIm9wdGlvbnMiLCJleGl0Q29kZSIsIlRleHQiLCJ1bm1vdW50IiwicHJvY2VzcyIsImV4aXQiLCJzaG93U2V0dXBEaWFsb2ciLCJyZW5kZXJBbmRSdW4iLCJlbGVtZW50Iiwid2FpdFVudGlsRXhpdCIsInNob3dTZXR1cFNjcmVlbnMiLCJwZXJtaXNzaW9uTW9kZSIsImFsbG93RGFuZ2Vyb3VzbHlTa2lwUGVybWlzc2lvbnMiLCJjb21tYW5kcyIsImNsYXVkZUluQ2hyb21lIiwiZGV2Q2hhbm5lbHMiLCJlbnYiLCJJU19ERU1PIiwiY29uZmlnIiwib25ib2FyZGluZ1Nob3duIiwidGhlbWUiLCJPbmJvYXJkaW5nIiwiQ0xBVUJCSVQiLCJUcnVzdERpYWxvZyIsImVycm9ycyIsImFsbEVycm9ycyIsImxlbmd0aCIsImV4dGVybmFsSW5jbHVkZXMiLCJDbGF1ZGVNZEV4dGVybmFsSW5jbHVkZXNEaWFsb2ciLCJzZXRJbW1lZGlhdGUiLCJHcm92ZURpYWxvZyIsImRlY2lzaW9uIiwiQU5USFJPUElDX0FQSV9LRVkiLCJjdXN0b21BcGlLZXlUcnVuY2F0ZWQiLCJrZXlTdGF0dXMiLCJBcHByb3ZlQXBpS2V5IiwiQnlwYXNzUGVybWlzc2lvbnNNb2RlRGlhbG9nIiwiQXV0b01vZGVPcHRJbkRpYWxvZyIsImlzQ2hhbm5lbHNFbmFibGVkIiwiZ2V0Q2xhdWRlQUlPQXV0aFRva2VucyIsImFsbCIsImFjY2Vzc1Rva2VuIiwibWFwIiwiYyIsImRldiIsIkRldkNoYW5uZWxzRGlhbG9nIiwiaGFzQ29tcGxldGVkQ2xhdWRlSW5DaHJvbWVPbmJvYXJkaW5nIiwiQ2xhdWRlSW5DaHJvbWVPbmJvYXJkaW5nIiwiZ2V0UmVuZGVyQ29udGV4dCIsImV4aXRPbkN0cmxDIiwicmVuZGVyT3B0aW9ucyIsImdldEZwc01ldHJpY3MiLCJzdGF0cyIsImxhc3RGbGlja2VyVGltZSIsImJhc2VPcHRpb25zIiwic3RkaW4iLCJmcHNUcmFja2VyIiwiZnJhbWVUaW1pbmdMb2dQYXRoIiwiQ0xBVURFX0NPREVfRlJBTUVfVElNSU5HX0xPRyIsImdldE1ldHJpY3MiLCJvbkZyYW1lIiwiZXZlbnQiLCJyZWNvcmQiLCJkdXJhdGlvbk1zIiwib2JzZXJ2ZSIsInBoYXNlcyIsImxpbmUiLCJKU09OIiwic3RyaW5naWZ5IiwidG90YWwiLCJyc3MiLCJtZW1vcnlVc2FnZSIsImNwdSIsImNwdVVzYWdlIiwiZmxpY2tlciIsImZsaWNrZXJzIiwicmVhc29uIiwibm93IiwiRGF0ZSIsImRlc2lyZWRIZWlnaHQiLCJhY3R1YWxIZWlnaHQiLCJhdmFpbGFibGVIZWlnaHQiLCJSZWNvcmQiXSwic291cmNlcyI6WyJpbnRlcmFjdGl2ZUhlbHBlcnMudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IHsgYXBwZW5kRmlsZVN5bmMgfSBmcm9tICdmcydcbmltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IGxvZ0V2ZW50IH0gZnJvbSAnc3JjL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB7XG4gIGdyYWNlZnVsU2h1dGRvd24sXG4gIGdyYWNlZnVsU2h1dGRvd25TeW5jLFxufSBmcm9tICdzcmMvdXRpbHMvZ3JhY2VmdWxTaHV0ZG93bi5qcydcbmltcG9ydCB7XG4gIHR5cGUgQ2hhbm5lbEVudHJ5LFxuICBnZXRBbGxvd2VkQ2hhbm5lbHMsXG4gIHNldEFsbG93ZWRDaGFubmVscyxcbiAgc2V0SGFzRGV2Q2hhbm5lbHMsXG4gIHNldFNlc3Npb25UcnVzdEFjY2VwdGVkLFxuICBzZXRTdGF0c1N0b3JlLFxufSBmcm9tICcuL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB0eXBlIHsgQ29tbWFuZCB9IGZyb20gJy4vY29tbWFuZHMuanMnXG5pbXBvcnQgeyBjcmVhdGVTdGF0c1N0b3JlLCB0eXBlIFN0YXRzU3RvcmUgfSBmcm9tICcuL2NvbnRleHQvc3RhdHMuanMnXG5pbXBvcnQgeyBnZXRTeXN0ZW1Db250ZXh0IH0gZnJvbSAnLi9jb250ZXh0LmpzJ1xuaW1wb3J0IHsgaW5pdGlhbGl6ZVRlbGVtZXRyeUFmdGVyVHJ1c3QgfSBmcm9tICcuL2VudHJ5cG9pbnRzL2luaXQuanMnXG5pbXBvcnQgeyBpc1N5bmNocm9uaXplZE91dHB1dFN1cHBvcnRlZCB9IGZyb20gJy4vaW5rL3Rlcm1pbmFsLmpzJ1xuaW1wb3J0IHR5cGUgeyBSZW5kZXJPcHRpb25zLCBSb290LCBUZXh0UHJvcHMgfSBmcm9tICcuL2luay5qcydcbmltcG9ydCB7IEtleWJpbmRpbmdTZXR1cCB9IGZyb20gJy4va2V5YmluZGluZ3MvS2V5YmluZGluZ1Byb3ZpZGVyU2V0dXAuanMnXG5pbXBvcnQgeyBzdGFydERlZmVycmVkUHJlZmV0Y2hlcyB9IGZyb20gJy4vbWFpbi5qcydcbmltcG9ydCB7XG4gIGNoZWNrR2F0ZV9DQUNIRURfT1JfQkxPQ0tJTkcsXG4gIGluaXRpYWxpemVHcm93dGhCb29rLFxuICByZXNldEdyb3d0aEJvb2ssXG59IGZyb20gJy4vc2VydmljZXMvYW5hbHl0aWNzL2dyb3d0aGJvb2suanMnXG5pbXBvcnQgeyBpc1F1YWxpZmllZEZvckdyb3ZlIH0gZnJvbSAnLi9zZXJ2aWNlcy9hcGkvZ3JvdmUuanMnXG5pbXBvcnQgeyBoYW5kbGVNY3Bqc29uU2VydmVyQXBwcm92YWxzIH0gZnJvbSAnLi9zZXJ2aWNlcy9tY3BTZXJ2ZXJBcHByb3ZhbC5qcydcbmltcG9ydCB7IEFwcFN0YXRlUHJvdmlkZXIgfSBmcm9tICcuL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHsgb25DaGFuZ2VBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUvb25DaGFuZ2VBcHBTdGF0ZS5qcydcbmltcG9ydCB7IG5vcm1hbGl6ZUFwaUtleUZvckNvbmZpZyB9IGZyb20gJy4vdXRpbHMvYXV0aFBvcnRhYmxlLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0RXh0ZXJuYWxDbGF1ZGVNZEluY2x1ZGVzLFxuICBnZXRNZW1vcnlGaWxlcyxcbiAgc2hvdWxkU2hvd0NsYXVkZU1kRXh0ZXJuYWxJbmNsdWRlc1dhcm5pbmcsXG59IGZyb20gJy4vdXRpbHMvY2xhdWRlbWQuanMnXG5pbXBvcnQge1xuICBjaGVja0hhc1RydXN0RGlhbG9nQWNjZXB0ZWQsXG4gIGdldEN1c3RvbUFwaUtleVN0YXR1cyxcbiAgZ2V0R2xvYmFsQ29uZmlnLFxuICBzYXZlR2xvYmFsQ29uZmlnLFxufSBmcm9tICcuL3V0aWxzL2NvbmZpZy5qcydcbmltcG9ydCB7IHVwZGF0ZURlZXBMaW5rVGVybWluYWxQcmVmZXJlbmNlIH0gZnJvbSAnLi91dGlscy9kZWVwTGluay90ZXJtaW5hbFByZWZlcmVuY2UuanMnXG5pbXBvcnQgeyBpc0VudlRydXRoeSwgaXNSdW5uaW5nT25Ib21lc3BhY2UgfSBmcm9tICcuL3V0aWxzL2VudlV0aWxzLmpzJ1xuaW1wb3J0IHsgdHlwZSBGcHNNZXRyaWNzLCBGcHNUcmFja2VyIH0gZnJvbSAnLi91dGlscy9mcHNUcmFja2VyLmpzJ1xuaW1wb3J0IHsgdXBkYXRlR2l0aHViUmVwb1BhdGhNYXBwaW5nIH0gZnJvbSAnLi91dGlscy9naXRodWJSZXBvUGF0aE1hcHBpbmcuanMnXG5pbXBvcnQgeyBhcHBseUNvbmZpZ0Vudmlyb25tZW50VmFyaWFibGVzIH0gZnJvbSAnLi91dGlscy9tYW5hZ2VkRW52LmpzJ1xuaW1wb3J0IHR5cGUgeyBQZXJtaXNzaW9uTW9kZSB9IGZyb20gJy4vdXRpbHMvcGVybWlzc2lvbnMvUGVybWlzc2lvbk1vZGUuanMnXG5pbXBvcnQgeyBnZXRCYXNlUmVuZGVyT3B0aW9ucyB9IGZyb20gJy4vdXRpbHMvcmVuZGVyT3B0aW9ucy5qcydcbmltcG9ydCB7IGdldFNldHRpbmdzV2l0aEFsbEVycm9ycyB9IGZyb20gJy4vdXRpbHMvc2V0dGluZ3MvYWxsRXJyb3JzLmpzJ1xuaW1wb3J0IHtcbiAgaGFzQXV0b01vZGVPcHRJbixcbiAgaGFzU2tpcERhbmdlcm91c01vZGVQZXJtaXNzaW9uUHJvbXB0LFxufSBmcm9tICcuL3V0aWxzL3NldHRpbmdzL3NldHRpbmdzLmpzJ1xuXG5leHBvcnQgZnVuY3Rpb24gY29tcGxldGVPbmJvYXJkaW5nKCk6IHZvaWQge1xuICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAuLi5jdXJyZW50LFxuICAgIGhhc0NvbXBsZXRlZE9uYm9hcmRpbmc6IHRydWUsXG4gICAgbGFzdE9uYm9hcmRpbmdWZXJzaW9uOiBNQUNSTy5WRVJTSU9OLFxuICB9KSlcbn1cbmV4cG9ydCBmdW5jdGlvbiBzaG93RGlhbG9nPFQgPSB2b2lkPihcbiAgcm9vdDogUm9vdCxcbiAgcmVuZGVyZXI6IChkb25lOiAocmVzdWx0OiBUKSA9PiB2b2lkKSA9PiBSZWFjdC5SZWFjdE5vZGUsXG4pOiBQcm9taXNlPFQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlPFQ+KHJlc29sdmUgPT4ge1xuICAgIGNvbnN0IGRvbmUgPSAocmVzdWx0OiBUKTogdm9pZCA9PiB2b2lkIHJlc29sdmUocmVzdWx0KVxuICAgIHJvb3QucmVuZGVyKHJlbmRlcmVyKGRvbmUpKVxuICB9KVxufVxuXG4vKipcbiAqIFJlbmRlciBhbiBlcnJvciBtZXNzYWdlIHRocm91Z2ggSW5rLCB0aGVuIHVubW91bnQgYW5kIGV4aXQuXG4gKiBVc2UgdGhpcyBmb3IgZmF0YWwgZXJyb3JzIGFmdGVyIHRoZSBJbmsgcm9vdCBoYXMgYmVlbiBjcmVhdGVkIOKAlFxuICogY29uc29sZS5lcnJvciBpcyBzd2FsbG93ZWQgYnkgSW5rJ3MgcGF0Y2hDb25zb2xlLCBzbyB3ZSByZW5kZXJcbiAqIHRocm91Z2ggdGhlIFJlYWN0IHRyZWUgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4aXRXaXRoRXJyb3IoXG4gIHJvb3Q6IFJvb3QsXG4gIG1lc3NhZ2U6IHN0cmluZyxcbiAgYmVmb3JlRXhpdD86ICgpID0+IFByb21pc2U8dm9pZD4sXG4pOiBQcm9taXNlPG5ldmVyPiB7XG4gIHJldHVybiBleGl0V2l0aE1lc3NhZ2Uocm9vdCwgbWVzc2FnZSwgeyBjb2xvcjogJ2Vycm9yJywgYmVmb3JlRXhpdCB9KVxufVxuXG4vKipcbiAqIFJlbmRlciBhIG1lc3NhZ2UgdGhyb3VnaCBJbmssIHRoZW4gdW5tb3VudCBhbmQgZXhpdC5cbiAqIFVzZSB0aGlzIGZvciBtZXNzYWdlcyBhZnRlciB0aGUgSW5rIHJvb3QgaGFzIGJlZW4gY3JlYXRlZCDigJRcbiAqIGNvbnNvbGUgb3V0cHV0IGlzIHN3YWxsb3dlZCBieSBJbmsncyBwYXRjaENvbnNvbGUsIHNvIHdlIHJlbmRlclxuICogdGhyb3VnaCB0aGUgUmVhY3QgdHJlZSBpbnN0ZWFkLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhpdFdpdGhNZXNzYWdlKFxuICByb290OiBSb290LFxuICBtZXNzYWdlOiBzdHJpbmcsXG4gIG9wdGlvbnM/OiB7XG4gICAgY29sb3I/OiBUZXh0UHJvcHNbJ2NvbG9yJ11cbiAgICBleGl0Q29kZT86IG51bWJlclxuICAgIGJlZm9yZUV4aXQ/OiAoKSA9PiBQcm9taXNlPHZvaWQ+XG4gIH0sXG4pOiBQcm9taXNlPG5ldmVyPiB7XG4gIGNvbnN0IHsgVGV4dCB9ID0gYXdhaXQgaW1wb3J0KCcuL2luay5qcycpXG4gIGNvbnN0IGNvbG9yID0gb3B0aW9ucz8uY29sb3JcbiAgY29uc3QgZXhpdENvZGUgPSBvcHRpb25zPy5leGl0Q29kZSA/PyAxXG4gIHJvb3QucmVuZGVyKFxuICAgIGNvbG9yID8gPFRleHQgY29sb3I9e2NvbG9yfT57bWVzc2FnZX08L1RleHQ+IDogPFRleHQ+e21lc3NhZ2V9PC9UZXh0PixcbiAgKVxuICByb290LnVubW91bnQoKVxuICBhd2FpdCBvcHRpb25zPy5iZWZvcmVFeGl0Py4oKVxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL25vLXByb2Nlc3MtZXhpdCAtLSBleGl0IGFmdGVyIEluayB1bm1vdW50XG4gIHByb2Nlc3MuZXhpdChleGl0Q29kZSlcbn1cblxuLyoqXG4gKiBTaG93IGEgc2V0dXAgZGlhbG9nIHdyYXBwZWQgaW4gQXBwU3RhdGVQcm92aWRlciArIEtleWJpbmRpbmdTZXR1cC5cbiAqIFJlZHVjZXMgYm9pbGVycGxhdGUgaW4gc2hvd1NldHVwU2NyZWVucygpIHdoZXJlIGV2ZXJ5IGRpYWxvZyBuZWVkcyB0aGVzZSB3cmFwcGVycy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNob3dTZXR1cERpYWxvZzxUID0gdm9pZD4oXG4gIHJvb3Q6IFJvb3QsXG4gIHJlbmRlcmVyOiAoZG9uZTogKHJlc3VsdDogVCkgPT4gdm9pZCkgPT4gUmVhY3QuUmVhY3ROb2RlLFxuICBvcHRpb25zPzogeyBvbkNoYW5nZUFwcFN0YXRlPzogdHlwZW9mIG9uQ2hhbmdlQXBwU3RhdGUgfSxcbik6IFByb21pc2U8VD4ge1xuICByZXR1cm4gc2hvd0RpYWxvZzxUPihyb290LCBkb25lID0+IChcbiAgICA8QXBwU3RhdGVQcm92aWRlciBvbkNoYW5nZUFwcFN0YXRlPXtvcHRpb25zPy5vbkNoYW5nZUFwcFN0YXRlfT5cbiAgICAgIDxLZXliaW5kaW5nU2V0dXA+e3JlbmRlcmVyKGRvbmUpfTwvS2V5YmluZGluZ1NldHVwPlxuICAgIDwvQXBwU3RhdGVQcm92aWRlcj5cbiAgKSlcbn1cblxuLyoqXG4gKiBSZW5kZXIgdGhlIG1haW4gVUkgaW50byB0aGUgcm9vdCBhbmQgd2FpdCBmb3IgaXQgdG8gZXhpdC5cbiAqIEhhbmRsZXMgdGhlIGNvbW1vbiBlcGlsb2d1ZTogc3RhcnQgZGVmZXJyZWQgcHJlZmV0Y2hlcywgd2FpdCBmb3IgZXhpdCwgZ3JhY2VmdWwgc2h1dGRvd24uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZW5kZXJBbmRSdW4oXG4gIHJvb3Q6IFJvb3QsXG4gIGVsZW1lbnQ6IFJlYWN0LlJlYWN0Tm9kZSxcbik6IFByb21pc2U8dm9pZD4ge1xuICByb290LnJlbmRlcihlbGVtZW50KVxuICBzdGFydERlZmVycmVkUHJlZmV0Y2hlcygpXG4gIGF3YWl0IHJvb3Qud2FpdFVudGlsRXhpdCgpXG4gIGF3YWl0IGdyYWNlZnVsU2h1dGRvd24oMClcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNob3dTZXR1cFNjcmVlbnMoXG4gIHJvb3Q6IFJvb3QsXG4gIHBlcm1pc3Npb25Nb2RlOiBQZXJtaXNzaW9uTW9kZSxcbiAgYWxsb3dEYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uczogYm9vbGVhbixcbiAgY29tbWFuZHM/OiBDb21tYW5kW10sXG4gIGNsYXVkZUluQ2hyb21lPzogYm9vbGVhbixcbiAgZGV2Q2hhbm5lbHM/OiBDaGFubmVsRW50cnlbXSxcbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBpZiAoXG4gICAgXCJwcm9kdWN0aW9uXCIgPT09ICd0ZXN0JyB8fFxuICAgIGlzRW52VHJ1dGh5KGZhbHNlKSB8fFxuICAgIHByb2Nlc3MuZW52LklTX0RFTU8gLy8gU2tpcCBvbmJvYXJkaW5nIGluIGRlbW8gbW9kZVxuICApIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGNvbnN0IGNvbmZpZyA9IGdldEdsb2JhbENvbmZpZygpXG4gIGxldCBvbmJvYXJkaW5nU2hvd24gPSBmYWxzZVxuICBpZiAoXG4gICAgIWNvbmZpZy50aGVtZSB8fFxuICAgICFjb25maWcuaGFzQ29tcGxldGVkT25ib2FyZGluZyAvLyBhbHdheXMgc2hvdyBvbmJvYXJkaW5nIGF0IGxlYXN0IG9uY2VcbiAgKSB7XG4gICAgb25ib2FyZGluZ1Nob3duID0gdHJ1ZVxuICAgIGNvbnN0IHsgT25ib2FyZGluZyB9ID0gYXdhaXQgaW1wb3J0KCcuL2NvbXBvbmVudHMvT25ib2FyZGluZy5qcycpXG4gICAgYXdhaXQgc2hvd1NldHVwRGlhbG9nKFxuICAgICAgcm9vdCxcbiAgICAgIGRvbmUgPT4gKFxuICAgICAgICA8T25ib2FyZGluZ1xuICAgICAgICAgIG9uRG9uZT17KCkgPT4ge1xuICAgICAgICAgICAgY29tcGxldGVPbmJvYXJkaW5nKClcbiAgICAgICAgICAgIHZvaWQgZG9uZSgpXG4gICAgICAgICAgfX1cbiAgICAgICAgLz5cbiAgICAgICksXG4gICAgICB7IG9uQ2hhbmdlQXBwU3RhdGUgfSxcbiAgICApXG4gIH1cblxuICAvLyBBbHdheXMgc2hvdyB0aGUgdHJ1c3QgZGlhbG9nIGluIGludGVyYWN0aXZlIHNlc3Npb25zLCByZWdhcmRsZXNzIG9mIHBlcm1pc3Npb24gbW9kZS5cbiAgLy8gVGhlIHRydXN0IGRpYWxvZyBpcyB0aGUgd29ya3NwYWNlIHRydXN0IGJvdW5kYXJ5IOKAlCBpdCB3YXJucyBhYm91dCB1bnRydXN0ZWQgcmVwb3NcbiAgLy8gYW5kIGNoZWNrcyBDTEFVREUubWQgZXh0ZXJuYWwgaW5jbHVkZXMuIGJ5cGFzc1Blcm1pc3Npb25zIG1vZGVcbiAgLy8gb25seSBhZmZlY3RzIHRvb2wgZXhlY3V0aW9uIHBlcm1pc3Npb25zLCBub3Qgd29ya3NwYWNlIHRydXN0LlxuICAvLyBOb3RlOiBub24taW50ZXJhY3RpdmUgc2Vzc2lvbnMgKENJL0NEIHdpdGggLXApIG5ldmVyIHJlYWNoIHNob3dTZXR1cFNjcmVlbnMgYXQgYWxsLlxuICAvLyBTa2lwIHBlcm1pc3Npb24gY2hlY2tzIGluIGNsYXViYml0XG4gIGlmICghaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0xBVUJCSVQpKSB7XG4gICAgLy8gRmFzdC1wYXRoOiBza2lwIFRydXN0RGlhbG9nIGltcG9ydCtyZW5kZXIgd2hlbiBDV0QgaXMgYWxyZWFkeSB0cnVzdGVkLlxuICAgIC8vIElmIGl0IHJldHVybnMgdHJ1ZSwgdGhlIFRydXN0RGlhbG9nIHdvdWxkIGF1dG8tcmVzb2x2ZSByZWdhcmRsZXNzIG9mXG4gICAgLy8gc2VjdXJpdHkgZmVhdHVyZXMsIHNvIHdlIGNhbiBza2lwIHRoZSBkeW5hbWljIGltcG9ydCBhbmQgcmVuZGVyIGN5Y2xlLlxuICAgIGlmICghY2hlY2tIYXNUcnVzdERpYWxvZ0FjY2VwdGVkKCkpIHtcbiAgICAgIGNvbnN0IHsgVHJ1c3REaWFsb2cgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICAgJy4vY29tcG9uZW50cy9UcnVzdERpYWxvZy9UcnVzdERpYWxvZy5qcydcbiAgICAgIClcbiAgICAgIGF3YWl0IHNob3dTZXR1cERpYWxvZyhyb290LCBkb25lID0+IChcbiAgICAgICAgPFRydXN0RGlhbG9nIGNvbW1hbmRzPXtjb21tYW5kc30gb25Eb25lPXtkb25lfSAvPlxuICAgICAgKSlcbiAgICB9XG5cbiAgICAvLyBTaWduYWwgdGhhdCB0cnVzdCBoYXMgYmVlbiB2ZXJpZmllZCBmb3IgdGhpcyBzZXNzaW9uLlxuICAgIC8vIEdyb3d0aEJvb2sgY2hlY2tzIHRoaXMgdG8gZGVjaWRlIHdoZXRoZXIgdG8gaW5jbHVkZSBhdXRoIGhlYWRlcnMuXG4gICAgc2V0U2Vzc2lvblRydXN0QWNjZXB0ZWQodHJ1ZSlcblxuICAgIC8vIFJlc2V0IGFuZCByZWluaXRpYWxpemUgR3Jvd3RoQm9vayBhZnRlciB0cnVzdCBpcyBlc3RhYmxpc2hlZC5cbiAgICAvLyBEZWZlbnNlIGZvciBsb2dpbi9sb2dvdXQ6IGNsZWFycyBhbnkgcHJpb3IgY2xpZW50IHNvIHRoZSBuZXh0IGluaXRcbiAgICAvLyBwaWNrcyB1cCBmcmVzaCBhdXRoIGhlYWRlcnMuXG4gICAgcmVzZXRHcm93dGhCb29rKClcbiAgICB2b2lkIGluaXRpYWxpemVHcm93dGhCb29rKClcblxuICAgIC8vIE5vdyB0aGF0IHRydXN0IGlzIGVzdGFibGlzaGVkLCBwcmVmZXRjaCBzeXN0ZW0gY29udGV4dCBpZiBpdCB3YXNuJ3QgYWxyZWFkeVxuICAgIHZvaWQgZ2V0U3lzdGVtQ29udGV4dCgpXG5cbiAgICAvLyBJZiBzZXR0aW5ncyBhcmUgdmFsaWQsIGNoZWNrIGZvciBhbnkgbWNwLmpzb24gc2VydmVycyB0aGF0IG5lZWQgYXBwcm92YWxcbiAgICBjb25zdCB7IGVycm9yczogYWxsRXJyb3JzIH0gPSBnZXRTZXR0aW5nc1dpdGhBbGxFcnJvcnMoKVxuICAgIGlmIChhbGxFcnJvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICBhd2FpdCBoYW5kbGVNY3Bqc29uU2VydmVyQXBwcm92YWxzKHJvb3QpXG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZm9yIGNsYXVkZS5tZCBpbmNsdWRlcyB0aGF0IG5lZWQgYXBwcm92YWxcbiAgICBpZiAoYXdhaXQgc2hvdWxkU2hvd0NsYXVkZU1kRXh0ZXJuYWxJbmNsdWRlc1dhcm5pbmcoKSkge1xuICAgICAgY29uc3QgZXh0ZXJuYWxJbmNsdWRlcyA9IGdldEV4dGVybmFsQ2xhdWRlTWRJbmNsdWRlcyhcbiAgICAgICAgYXdhaXQgZ2V0TWVtb3J5RmlsZXModHJ1ZSksXG4gICAgICApXG4gICAgICBjb25zdCB7IENsYXVkZU1kRXh0ZXJuYWxJbmNsdWRlc0RpYWxvZyB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAnLi9jb21wb25lbnRzL0NsYXVkZU1kRXh0ZXJuYWxJbmNsdWRlc0RpYWxvZy5qcydcbiAgICAgIClcbiAgICAgIGF3YWl0IHNob3dTZXR1cERpYWxvZyhyb290LCBkb25lID0+IChcbiAgICAgICAgPENsYXVkZU1kRXh0ZXJuYWxJbmNsdWRlc0RpYWxvZ1xuICAgICAgICAgIG9uRG9uZT17ZG9uZX1cbiAgICAgICAgICBpc1N0YW5kYWxvbmVEaWFsb2dcbiAgICAgICAgICBleHRlcm5hbEluY2x1ZGVzPXtleHRlcm5hbEluY2x1ZGVzfVxuICAgICAgICAvPlxuICAgICAgKSlcbiAgICB9XG4gIH1cblxuICAvLyBUcmFjayBjdXJyZW50IHJlcG8gcGF0aCBmb3IgdGVsZXBvcnQgZGlyZWN0b3J5IHN3aXRjaGluZyAoZmlyZS1hbmQtZm9yZ2V0KVxuICAvLyBUaGlzIG11c3QgaGFwcGVuIEFGVEVSIHRydXN0IHRvIHByZXZlbnQgdW50cnVzdGVkIGRpcmVjdG9yaWVzIGZyb20gcG9pc29uaW5nIHRoZSBtYXBwaW5nXG4gIHZvaWQgdXBkYXRlR2l0aHViUmVwb1BhdGhNYXBwaW5nKClcbiAgaWYgKGZlYXR1cmUoJ0xPREVTVE9ORScpKSB7XG4gICAgdXBkYXRlRGVlcExpbmtUZXJtaW5hbFByZWZlcmVuY2UoKVxuICB9XG5cbiAgLy8gQXBwbHkgZnVsbCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYWZ0ZXIgdHJ1c3QgZGlhbG9nIGlzIGFjY2VwdGVkIE9SIGluIGJ5cGFzcyBtb2RlXG4gIC8vIEluIGJ5cGFzcyBtb2RlIChDSS9DRCwgYXV0b21hdGlvbiksIHdlIHRydXN0IHRoZSBlbnZpcm9ubWVudCBzbyBhcHBseSBhbGwgdmFyaWFibGVzXG4gIC8vIEluIG5vcm1hbCBtb2RlLCB0aGlzIGhhcHBlbnMgYWZ0ZXIgdGhlIHRydXN0IGRpYWxvZyBpcyBhY2NlcHRlZFxuICAvLyBUaGlzIGluY2x1ZGVzIHBvdGVudGlhbGx5IGRhbmdlcm91cyBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZnJvbSB1bnRydXN0ZWQgc291cmNlc1xuICBhcHBseUNvbmZpZ0Vudmlyb25tZW50VmFyaWFibGVzKClcblxuICAvLyBJbml0aWFsaXplIHRlbGVtZXRyeSBhZnRlciBlbnYgdmFycyBhcmUgYXBwbGllZCBzbyBPVEVMIGVuZHBvaW50IGVudiB2YXJzIGFuZFxuICAvLyBvdGVsSGVhZGVyc0hlbHBlciAod2hpY2ggcmVxdWlyZXMgdHJ1c3QgdG8gZXhlY3V0ZSkgYXJlIGF2YWlsYWJsZS5cbiAgLy8gRGVmZXIgdG8gbmV4dCB0aWNrIHNvIHRoZSBPVGVsIGR5bmFtaWMgaW1wb3J0IHJlc29sdmVzIGFmdGVyIGZpcnN0IHJlbmRlclxuICAvLyBpbnN0ZWFkIG9mIGR1cmluZyB0aGUgcHJlLXJlbmRlciBtaWNyb3Rhc2sgcXVldWUuXG4gIHNldEltbWVkaWF0ZSgoKSA9PiBpbml0aWFsaXplVGVsZW1ldHJ5QWZ0ZXJUcnVzdCgpKVxuXG4gIGlmIChhd2FpdCBpc1F1YWxpZmllZEZvckdyb3ZlKCkpIHtcbiAgICBjb25zdCB7IEdyb3ZlRGlhbG9nIH0gPSBhd2FpdCBpbXBvcnQoJ3NyYy9jb21wb25lbnRzL2dyb3ZlL0dyb3ZlLmpzJylcbiAgICBjb25zdCBkZWNpc2lvbiA9IGF3YWl0IHNob3dTZXR1cERpYWxvZzxzdHJpbmc+KHJvb3QsIGRvbmUgPT4gKFxuICAgICAgPEdyb3ZlRGlhbG9nXG4gICAgICAgIHNob3dJZkFscmVhZHlWaWV3ZWQ9e2ZhbHNlfVxuICAgICAgICBsb2NhdGlvbj17b25ib2FyZGluZ1Nob3duID8gJ29uYm9hcmRpbmcnIDogJ3BvbGljeV91cGRhdGVfbW9kYWwnfVxuICAgICAgICBvbkRvbmU9e2RvbmV9XG4gICAgICAvPlxuICAgICkpXG4gICAgaWYgKGRlY2lzaW9uID09PSAnZXNjYXBlJykge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2dyb3ZlX3BvbGljeV9leGl0ZWQnLCB7fSlcbiAgICAgIGdyYWNlZnVsU2h1dGRvd25TeW5jKDApXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cblxuICAvLyBDaGVjayBmb3IgY3VzdG9tIEFQSSBrZXlcbiAgLy8gT24gaG9tZXNwYWNlLCBBTlRIUk9QSUNfQVBJX0tFWSBpcyBwcmVzZXJ2ZWQgaW4gcHJvY2Vzcy5lbnYgZm9yIGNoaWxkXG4gIC8vIHByb2Nlc3NlcyBidXQgaWdub3JlZCBieSBDbGF1ZGUgQ29kZSBpdHNlbGYgKHNlZSBhdXRoLnRzKS5cbiAgaWYgKHByb2Nlc3MuZW52LkFOVEhST1BJQ19BUElfS0VZICYmICFpc1J1bm5pbmdPbkhvbWVzcGFjZSgpKSB7XG4gICAgY29uc3QgY3VzdG9tQXBpS2V5VHJ1bmNhdGVkID0gbm9ybWFsaXplQXBpS2V5Rm9yQ29uZmlnKFxuICAgICAgcHJvY2Vzcy5lbnYuQU5USFJPUElDX0FQSV9LRVksXG4gICAgKVxuICAgIGNvbnN0IGtleVN0YXR1cyA9IGdldEN1c3RvbUFwaUtleVN0YXR1cyhjdXN0b21BcGlLZXlUcnVuY2F0ZWQpXG4gICAgaWYgKGtleVN0YXR1cyA9PT0gJ25ldycpIHtcbiAgICAgIGNvbnN0IHsgQXBwcm92ZUFwaUtleSB9ID0gYXdhaXQgaW1wb3J0KCcuL2NvbXBvbmVudHMvQXBwcm92ZUFwaUtleS5qcycpXG4gICAgICBhd2FpdCBzaG93U2V0dXBEaWFsb2c8Ym9vbGVhbj4oXG4gICAgICAgIHJvb3QsXG4gICAgICAgIGRvbmUgPT4gKFxuICAgICAgICAgIDxBcHByb3ZlQXBpS2V5XG4gICAgICAgICAgICBjdXN0b21BcGlLZXlUcnVuY2F0ZWQ9e2N1c3RvbUFwaUtleVRydW5jYXRlZH1cbiAgICAgICAgICAgIG9uRG9uZT17ZG9uZX1cbiAgICAgICAgICAvPlxuICAgICAgICApLFxuICAgICAgICB7IG9uQ2hhbmdlQXBwU3RhdGUgfSxcbiAgICAgIClcbiAgICB9XG4gIH1cblxuICBpZiAoXG4gICAgKHBlcm1pc3Npb25Nb2RlID09PSAnYnlwYXNzUGVybWlzc2lvbnMnIHx8XG4gICAgICBhbGxvd0Rhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zKSAmJlxuICAgICFoYXNTa2lwRGFuZ2Vyb3VzTW9kZVBlcm1pc3Npb25Qcm9tcHQoKVxuICApIHtcbiAgICBjb25zdCB7IEJ5cGFzc1Blcm1pc3Npb25zTW9kZURpYWxvZyB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgJy4vY29tcG9uZW50cy9CeXBhc3NQZXJtaXNzaW9uc01vZGVEaWFsb2cuanMnXG4gICAgKVxuICAgIGF3YWl0IHNob3dTZXR1cERpYWxvZyhyb290LCBkb25lID0+IChcbiAgICAgIDxCeXBhc3NQZXJtaXNzaW9uc01vZGVEaWFsb2cgb25BY2NlcHQ9e2RvbmV9IC8+XG4gICAgKSlcbiAgfVxuXG4gIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSkge1xuICAgIC8vIE9ubHkgc2hvdyB0aGUgb3B0LWluIGRpYWxvZyBpZiBhdXRvIG1vZGUgYWN0dWFsbHkgcmVzb2x2ZWQg4oCUIGlmIHRoZVxuICAgIC8vIGdhdGUgZGVuaWVkIGl0IChvcmcgbm90IGFsbG93bGlzdGVkLCBzZXR0aW5ncyBkaXNhYmxlZCksIHNob3dpbmdcbiAgICAvLyBjb25zZW50IGZvciBhbiB1bmF2YWlsYWJsZSBmZWF0dXJlIGlzIHBvaW50bGVzcy4gVGhlXG4gICAgLy8gdmVyaWZ5QXV0b01vZGVHYXRlQWNjZXNzIG5vdGlmaWNhdGlvbiB3aWxsIGV4cGxhaW4gd2h5IGluc3RlYWQuXG4gICAgaWYgKHBlcm1pc3Npb25Nb2RlID09PSAnYXV0bycgJiYgIWhhc0F1dG9Nb2RlT3B0SW4oKSkge1xuICAgICAgY29uc3QgeyBBdXRvTW9kZU9wdEluRGlhbG9nIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICcuL2NvbXBvbmVudHMvQXV0b01vZGVPcHRJbkRpYWxvZy5qcydcbiAgICAgIClcbiAgICAgIGF3YWl0IHNob3dTZXR1cERpYWxvZyhyb290LCBkb25lID0+IChcbiAgICAgICAgPEF1dG9Nb2RlT3B0SW5EaWFsb2dcbiAgICAgICAgICBvbkFjY2VwdD17ZG9uZX1cbiAgICAgICAgICBvbkRlY2xpbmU9eygpID0+IGdyYWNlZnVsU2h1dGRvd25TeW5jKDEpfVxuICAgICAgICAgIGRlY2xpbmVFeGl0c1xuICAgICAgICAvPlxuICAgICAgKSlcbiAgICB9XG4gIH1cblxuICAvLyAtLWRhbmdlcm91c2x5LWxvYWQtZGV2ZWxvcG1lbnQtY2hhbm5lbHMgY29uZmlybWF0aW9uLiBPbiBhY2NlcHQsIGFwcGVuZFxuICAvLyBkZXYgY2hhbm5lbHMgdG8gYW55IC0tY2hhbm5lbHMgbGlzdCBhbHJlYWR5IHNldCBpbiBtYWluLnRzeC4gT3JnIHBvbGljeVxuICAvLyBpcyBOT1QgYnlwYXNzZWQg4oCUIGdhdGVDaGFubmVsU2VydmVyKCkgc3RpbGwgcnVuczsgdGhpcyBmbGFnIG9ubHkgZXhpc3RzXG4gIC8vIHRvIHNpZGVzdGVwIHRoZSAtLWNoYW5uZWxzIGFwcHJvdmVkLXNlcnZlciBhbGxvd2xpc3QuXG4gIGlmIChmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQ0hBTk5FTFMnKSkge1xuICAgIC8vIGdhdGVDaGFubmVsU2VydmVyIGFuZCBDaGFubmVsc05vdGljZSByZWFkIHRlbmd1X2hhcmJvciBhZnRlciB0aGlzXG4gICAgLy8gZnVuY3Rpb24gcmV0dXJucy4gQSBjb2xkIGRpc2sgY2FjaGUgKGZyZXNoIGluc3RhbGwsIG9yIGZpcnN0IHJ1biBhZnRlclxuICAgIC8vIHRoZSBmbGFnIHdhcyBhZGRlZCBzZXJ2ZXItc2lkZSkgZGVmYXVsdHMgdG8gZmFsc2UgYW5kIHNpbGVudGx5IGRyb3BzXG4gICAgLy8gY2hhbm5lbCBub3RpZmljYXRpb25zIGZvciB0aGUgd2hvbGUgc2Vzc2lvbiDigJQgZ2gjMzcwMjYuXG4gICAgLy8gY2hlY2tHYXRlX0NBQ0hFRF9PUl9CTE9DS0lORyByZXR1cm5zIGltbWVkaWF0ZWx5IGlmIGRpc2sgYWxyZWFkeSBzYXlzXG4gICAgLy8gdHJ1ZTsgb25seSBibG9ja3Mgb24gYSBjb2xkL3N0YWxlLWZhbHNlIGNhY2hlIChhd2FpdHMgdGhlIHNhbWUgbWVtb2l6ZWRcbiAgICAvLyBpbml0aWFsaXplR3Jvd3RoQm9vayBwcm9taXNlIGZpcmVkIGVhcmxpZXIpLiBBbHNvIHdhcm1zIHRoZVxuICAgIC8vIGlzQ2hhbm5lbHNFbmFibGVkKCkgY2hlY2sgaW4gdGhlIGRldi1jaGFubmVscyBkaWFsb2cgYmVsb3cuXG4gICAgaWYgKGdldEFsbG93ZWRDaGFubmVscygpLmxlbmd0aCA+IDAgfHwgKGRldkNoYW5uZWxzPy5sZW5ndGggPz8gMCkgPiAwKSB7XG4gICAgICBhd2FpdCBjaGVja0dhdGVfQ0FDSEVEX09SX0JMT0NLSU5HKCd0ZW5ndV9oYXJib3InKVxuICAgIH1cblxuICAgIGlmIChkZXZDaGFubmVscyAmJiBkZXZDaGFubmVscy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBbeyBpc0NoYW5uZWxzRW5hYmxlZCB9LCB7IGdldENsYXVkZUFJT0F1dGhUb2tlbnMgfV0gPVxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgaW1wb3J0KCcuL3NlcnZpY2VzL21jcC9jaGFubmVsQWxsb3dsaXN0LmpzJyksXG4gICAgICAgICAgaW1wb3J0KCcuL3V0aWxzL2F1dGguanMnKSxcbiAgICAgICAgXSlcbiAgICAgIC8vIFNraXAgdGhlIGRpYWxvZyB3aGVuIGNoYW5uZWxzIGFyZSBibG9ja2VkICh0ZW5ndV9oYXJib3Igb2ZmIG9yIG5vXG4gICAgICAvLyBPQXV0aCkg4oCUIGFjY2VwdGluZyB0aGVuIGltbWVkaWF0ZWx5IHNlZWluZyBcIm5vdCBhdmFpbGFibGVcIiBpblxuICAgICAgLy8gQ2hhbm5lbHNOb3RpY2UgaXMgd29yc2UgdGhhbiBubyBkaWFsb2cuIEFwcGVuZCBlbnRyaWVzIGFueXdheSBzb1xuICAgICAgLy8gQ2hhbm5lbHNOb3RpY2UgcmVuZGVycyB0aGUgYmxvY2tlZCBicmFuY2ggd2l0aCB0aGUgZGV2IGVudHJpZXNcbiAgICAgIC8vIG5hbWVkLiBkZXY6dHJ1ZSBoZXJlIGlzIGZvciB0aGUgZmxhZyBsYWJlbCBpbiBDaGFubmVsc05vdGljZVxuICAgICAgLy8gKGhhc05vbkRldiBjaGVjayk7IHRoZSBhbGxvd2xpc3QgYnlwYXNzIGl0IGFsc28gZ3JhbnRzIGlzIG1vb3RcbiAgICAgIC8vIHNpbmNlIHRoZSBnYXRlIGJsb2NrcyB1cHN0cmVhbS5cbiAgICAgIGlmICghaXNDaGFubmVsc0VuYWJsZWQoKSB8fCAhZ2V0Q2xhdWRlQUlPQXV0aFRva2VucygpPy5hY2Nlc3NUb2tlbikge1xuICAgICAgICBzZXRBbGxvd2VkQ2hhbm5lbHMoW1xuICAgICAgICAgIC4uLmdldEFsbG93ZWRDaGFubmVscygpLFxuICAgICAgICAgIC4uLmRldkNoYW5uZWxzLm1hcChjID0+ICh7IC4uLmMsIGRldjogdHJ1ZSB9KSksXG4gICAgICAgIF0pXG4gICAgICAgIHNldEhhc0RldkNoYW5uZWxzKHRydWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB7IERldkNoYW5uZWxzRGlhbG9nIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICAgJy4vY29tcG9uZW50cy9EZXZDaGFubmVsc0RpYWxvZy5qcydcbiAgICAgICAgKVxuICAgICAgICBhd2FpdCBzaG93U2V0dXBEaWFsb2cocm9vdCwgZG9uZSA9PiAoXG4gICAgICAgICAgPERldkNoYW5uZWxzRGlhbG9nXG4gICAgICAgICAgICBjaGFubmVscz17ZGV2Q2hhbm5lbHN9XG4gICAgICAgICAgICBvbkFjY2VwdD17KCkgPT4ge1xuICAgICAgICAgICAgICAvLyBNYXJrIGRldiBlbnRyaWVzIHBlci1lbnRyeSBzbyB0aGUgYWxsb3dsaXN0IGJ5cGFzcyBkb2Vzbid0IGxlYWtcbiAgICAgICAgICAgICAgLy8gdG8gLS1jaGFubmVscyBlbnRyaWVzIHdoZW4gYm90aCBmbGFncyBhcmUgcGFzc2VkLlxuICAgICAgICAgICAgICBzZXRBbGxvd2VkQ2hhbm5lbHMoW1xuICAgICAgICAgICAgICAgIC4uLmdldEFsbG93ZWRDaGFubmVscygpLFxuICAgICAgICAgICAgICAgIC4uLmRldkNoYW5uZWxzLm1hcChjID0+ICh7IC4uLmMsIGRldjogdHJ1ZSB9KSksXG4gICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgIHNldEhhc0RldkNoYW5uZWxzKHRydWUpXG4gICAgICAgICAgICAgIHZvaWQgZG9uZSgpXG4gICAgICAgICAgICB9fVxuICAgICAgICAgIC8+XG4gICAgICAgICkpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gU2hvdyBDaHJvbWUgb25ib2FyZGluZyBmb3IgZmlyc3QtdGltZSBDbGF1ZGUgaW4gQ2hyb21lIHVzZXJzXG4gIGlmIChcbiAgICBjbGF1ZGVJbkNocm9tZSAmJlxuICAgICFnZXRHbG9iYWxDb25maWcoKS5oYXNDb21wbGV0ZWRDbGF1ZGVJbkNocm9tZU9uYm9hcmRpbmdcbiAgKSB7XG4gICAgY29uc3QgeyBDbGF1ZGVJbkNocm9tZU9uYm9hcmRpbmcgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICcuL2NvbXBvbmVudHMvQ2xhdWRlSW5DaHJvbWVPbmJvYXJkaW5nLmpzJ1xuICAgIClcbiAgICBhd2FpdCBzaG93U2V0dXBEaWFsb2cocm9vdCwgZG9uZSA9PiAoXG4gICAgICA8Q2xhdWRlSW5DaHJvbWVPbmJvYXJkaW5nIG9uRG9uZT17ZG9uZX0gLz5cbiAgICApKVxuICB9XG5cbiAgcmV0dXJuIG9uYm9hcmRpbmdTaG93blxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVuZGVyQ29udGV4dChleGl0T25DdHJsQzogYm9vbGVhbik6IHtcbiAgcmVuZGVyT3B0aW9uczogUmVuZGVyT3B0aW9uc1xuICBnZXRGcHNNZXRyaWNzOiAoKSA9PiBGcHNNZXRyaWNzIHwgdW5kZWZpbmVkXG4gIHN0YXRzOiBTdGF0c1N0b3JlXG59IHtcbiAgbGV0IGxhc3RGbGlja2VyVGltZSA9IDBcbiAgY29uc3QgYmFzZU9wdGlvbnMgPSBnZXRCYXNlUmVuZGVyT3B0aW9ucyhleGl0T25DdHJsQylcblxuICAvLyBMb2cgYW5hbHl0aWNzIGV2ZW50IHdoZW4gc3RkaW4gb3ZlcnJpZGUgaXMgYWN0aXZlXG4gIGlmIChiYXNlT3B0aW9ucy5zdGRpbikge1xuICAgIGxvZ0V2ZW50KCd0ZW5ndV9zdGRpbl9pbnRlcmFjdGl2ZScsIHt9KVxuICB9XG5cbiAgY29uc3QgZnBzVHJhY2tlciA9IG5ldyBGcHNUcmFja2VyKClcbiAgY29uc3Qgc3RhdHMgPSBjcmVhdGVTdGF0c1N0b3JlKClcbiAgc2V0U3RhdHNTdG9yZShzdGF0cylcblxuICAvLyBCZW5jaCBtb2RlOiB3aGVuIHNldCwgYXBwZW5kIHBlci1mcmFtZSBwaGFzZSB0aW1pbmdzIGFzIEpTT05MIGZvclxuICAvLyBvZmZsaW5lIGFuYWx5c2lzIGJ5IGJlbmNoL3JlcGwtc2Nyb2xsLnRzLiBDYXB0dXJlcyB0aGUgZnVsbCBUVUlcbiAgLy8gcmVuZGVyIHBpcGVsaW5lICh5b2dhIOKGkiBzY3JlZW4gYnVmZmVyIOKGkiBkaWZmIOKGkiBvcHRpbWl6ZSDihpIgc3Rkb3V0KVxuICAvLyBzbyBwZXJmIHdvcmsgb24gYW55IHBoYXNlIGNhbiBiZSB2YWxpZGF0ZWQgYWdhaW5zdCByZWFsIHVzZXIgZmxvd3MuXG4gIGNvbnN0IGZyYW1lVGltaW5nTG9nUGF0aCA9IHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0ZSQU1FX1RJTUlOR19MT0dcbiAgcmV0dXJuIHtcbiAgICBnZXRGcHNNZXRyaWNzOiAoKSA9PiBmcHNUcmFja2VyLmdldE1ldHJpY3MoKSxcbiAgICBzdGF0cyxcbiAgICByZW5kZXJPcHRpb25zOiB7XG4gICAgICAuLi5iYXNlT3B0aW9ucyxcbiAgICAgIG9uRnJhbWU6IGV2ZW50ID0+IHtcbiAgICAgICAgZnBzVHJhY2tlci5yZWNvcmQoZXZlbnQuZHVyYXRpb25NcylcbiAgICAgICAgc3RhdHMub2JzZXJ2ZSgnZnJhbWVfZHVyYXRpb25fbXMnLCBldmVudC5kdXJhdGlvbk1zKVxuICAgICAgICBpZiAoZnJhbWVUaW1pbmdMb2dQYXRoICYmIGV2ZW50LnBoYXNlcykge1xuICAgICAgICAgIC8vIEJlbmNoLW9ubHkgZW52LXZhci1nYXRlZCBwYXRoOiBzeW5jIHdyaXRlIHNvIG5vIGZyYW1lcyBkcm9wcGVkXG4gICAgICAgICAgLy8gb24gYWJydXB0IGV4aXQuIH4xMDAgYnl0ZXMgYXQg4omkNjBmcHMgaXMgbmVnbGlnaWJsZS4gcnNzL2NwdSBhcmVcbiAgICAgICAgICAvLyBzaW5nbGUgc3lzY2FsbHM7IGNwdSBpcyBjdW11bGF0aXZlIOKAlCBiZW5jaCBzaWRlIGNvbXB1dGVzIGRlbHRhLlxuICAgICAgICAgIGNvbnN0IGxpbmUgPVxuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby1kaXJlY3QtanNvbi1vcGVyYXRpb25zIC0tIHRpbnkgb2JqZWN0LCBob3QgYmVuY2ggcGF0aFxuICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICB0b3RhbDogZXZlbnQuZHVyYXRpb25NcyxcbiAgICAgICAgICAgICAgLi4uZXZlbnQucGhhc2VzLFxuICAgICAgICAgICAgICByc3M6IHByb2Nlc3MubWVtb3J5VXNhZ2UucnNzKCksXG4gICAgICAgICAgICAgIGNwdTogcHJvY2Vzcy5jcHVVc2FnZSgpLFxuICAgICAgICAgICAgfSkgKyAnXFxuJ1xuICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tc3luYy1mcyAtLSBiZW5jaC1vbmx5LCBzeW5jIHNvIG5vIGZyYW1lcyBkcm9wcGVkIG9uIGV4aXRcbiAgICAgICAgICBhcHBlbmRGaWxlU3luYyhmcmFtZVRpbWluZ0xvZ1BhdGgsIGxpbmUpXG4gICAgICAgIH1cbiAgICAgICAgLy8gU2tpcCBmbGlja2VyIHJlcG9ydGluZyBmb3IgdGVybWluYWxzIHdpdGggc3luY2hyb25pemVkIG91dHB1dCDigJRcbiAgICAgICAgLy8gREVDIDIwMjYgYnVmZmVycyBiZXR3ZWVuIEJTVS9FU1Ugc28gY2xlYXIrcmVkcmF3IGlzIGF0b21pYy5cbiAgICAgICAgaWYgKGlzU3luY2hyb25pemVkT3V0cHV0U3VwcG9ydGVkKCkpIHtcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZsaWNrZXIgb2YgZXZlbnQuZmxpY2tlcnMpIHtcbiAgICAgICAgICBpZiAoZmxpY2tlci5yZWFzb24gPT09ICdyZXNpemUnKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpXG4gICAgICAgICAgaWYgKG5vdyAtIGxhc3RGbGlja2VyVGltZSA8IDEwMDApIHtcbiAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9mbGlja2VyJywge1xuICAgICAgICAgICAgICBkZXNpcmVkSGVpZ2h0OiBmbGlja2VyLmRlc2lyZWRIZWlnaHQsXG4gICAgICAgICAgICAgIGFjdHVhbEhlaWdodDogZmxpY2tlci5hdmFpbGFibGVIZWlnaHQsXG4gICAgICAgICAgICAgIHJlYXNvbjogZmxpY2tlci5yZWFzb24sXG4gICAgICAgICAgICB9IGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgYm9vbGVhbiB8IG51bWJlciB8IHVuZGVmaW5lZD4pXG4gICAgICAgICAgfVxuICAgICAgICAgIGxhc3RGbGlja2VyVGltZSA9IG5vd1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0sXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBU0EsT0FBTyxRQUFRLFlBQVk7QUFDcEMsU0FBU0MsY0FBYyxRQUFRLElBQUk7QUFDbkMsT0FBT0MsS0FBSyxNQUFNLE9BQU87QUFDekIsU0FBU0MsUUFBUSxRQUFRLGlDQUFpQztBQUMxRCxTQUNFQyxnQkFBZ0IsRUFDaEJDLG9CQUFvQixRQUNmLCtCQUErQjtBQUN0QyxTQUNFLEtBQUtDLFlBQVksRUFDakJDLGtCQUFrQixFQUNsQkMsa0JBQWtCLEVBQ2xCQyxpQkFBaUIsRUFDakJDLHVCQUF1QixFQUN2QkMsYUFBYSxRQUNSLHNCQUFzQjtBQUM3QixjQUFjQyxPQUFPLFFBQVEsZUFBZTtBQUM1QyxTQUFTQyxnQkFBZ0IsRUFBRSxLQUFLQyxVQUFVLFFBQVEsb0JBQW9CO0FBQ3RFLFNBQVNDLGdCQUFnQixRQUFRLGNBQWM7QUFDL0MsU0FBU0MsNkJBQTZCLFFBQVEsdUJBQXVCO0FBQ3JFLFNBQVNDLDZCQUE2QixRQUFRLG1CQUFtQjtBQUNqRSxjQUFjQyxhQUFhLEVBQUVDLElBQUksRUFBRUMsU0FBUyxRQUFR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