import { profileCheckpoint } from '../utils/startupProfiler.js'
import '../bootstrap/state.js'
import '../utils/config.js'
import type { Attributes, MetricOptions } from '@opentelemetry/api'
import memoize from 'lodash-es/memoize.js'
import { getIsNonInteractiveSession } from 'src/bootstrap/state.js'
import type { AttributedCounter } from '../bootstrap/state.js'
import { getSessionCounter, setMeter } from '../bootstrap/state.js'
import { shutdownLspServerManager } from '../services/lsp/manager.js'
import { populateOAuthAccountInfoIfNeeded } from '../services/oauth/client.js'
import {
  initializePolicyLimitsLoadingPromise,
  isPolicyLimitsEligible,
} from '../services/policyLimits/index.js'
import {
  initializeRemoteManagedSettingsLoadingPromise,
  isEligibleForRemoteManagedSettings,
  waitForRemoteManagedSettingsToLoad,
} from '../services/remoteManagedSettings/index.js'
import { preconnectAnthropicApi } from '../utils/apiPreconnect.js'
import { applyExtraCACertsFromConfig } from '../utils/caCertsConfig.js'
import { registerCleanup } from '../utils/cleanupRegistry.js'
import { enableConfigs, recordFirstStartTime } from '../utils/config.js'
import { logForDebugging } from '../utils/debug.js'
import { detectCurrentRepository } from '../utils/detectRepository.js'
import { logForDiagnosticsNoPII } from '../utils/diagLogs.js'
import { initJetBrainsDetection } from '../utils/envDynamic.js'
import { isEnvTruthy } from '../utils/envUtils.js'
import { ConfigParseError, errorMessage } from '../utils/errors.js'
// showInvalidConfigDialog is dynamically imported in the error path to avoid loading React at init
import {
  gracefulShutdownSync,
  setupGracefulShutdown,
} from '../utils/gracefulShutdown.js'
import {
  applyConfigEnvironmentVariables,
  applySafeConfigEnvironmentVariables,
} from '../utils/managedEnv.js'
import { configureGlobalMTLS } from '../utils/mtls.js'
import {
  ensureScratchpadDir,
  isScratchpadEnabled,
} from '../utils/permissions/filesystem.js'
// initializeTelemetry is loaded lazily via import() in setMeterState() to defer
// ~400KB of OpenTelemetry + protobuf modules until telemetry is actually initialized.
// gRPC exporters (~700KB via @grpc/grpc-js) are further lazy-loaded within instrumentation.ts.
import { configureGlobalAgents } from '../utils/proxy.js'
import { isBetaTracingEnabled } from '../utils/telemetry/betaSessionTracing.js'
import { getTelemetryAttributes } from '../utils/telemetryAttributes.js'
import { setShellIfWindows } from '../utils/windowsPaths.js'

// initialize1PEventLogging is dynamically imported to defer OpenTelemetry sdk-logs/resources

// Track if telemetry has been initialized to prevent double initialization
let telemetryInitialized = false

export const init = memoize(async (): Promise<void> => {
  const initStartTime = Date.now()
  logForDiagnosticsNoPII('info', 'init_started')
  profileCheckpoint('init_function_start')

  // Validate configs are valid and enable configuration system
  try {
    const configsStart = Date.now()
    enableConfigs()
    logForDiagnosticsNoPII('info', 'init_configs_enabled', {
      duration_ms: Date.now() - configsStart,
    })
    profileCheckpoint('init_configs_enabled')

    // Apply only safe environment variables before trust dialog
    // Full environment variables are applied after trust is established
    const envVarsStart = Date.now()
    applySafeConfigEnvironmentVariables()

    // Apply NODE_EXTRA_CA_CERTS from settings.json to process.env early,
    // before any TLS connections. Bun caches the TLS cert store at boot
    // via BoringSSL, so this must happen before the first TLS handshake.
    applyExtraCACertsFromConfig()

    logForDiagnosticsNoPII('info', 'init_safe_env_vars_applied', {
      duration_ms: Date.now() - envVarsStart,
    })
    profileCheckpoint('init_safe_env_vars_applied')

    // Make sure things get flushed on exit
    setupGracefulShutdown()
    profileCheckpoint('init_after_graceful_shutdown')

    // Initialize 1P event logging (no security concerns, but deferred to avoid
    // loading OpenTelemetry sdk-logs at startup). growthbook.js is already in
    // the module cache by this point (firstPartyEventLogger imports it), so the
    // second dynamic import adds no load cost.
    void Promise.all([
      import('../services/analytics/firstPartyEventLogger.js'),
      import('../services/analytics/growthbook.js'),
    ]).then(([fp, gb]) => {
      fp.initialize1PEventLogging()
      // Rebuild the logger provider if tengu_1p_event_batch_config changes
      // mid-session. Change detection (isEqual) is inside the handler so
      // unchanged refreshes are no-ops.
      gb.onGrowthBookRefresh(() => {
        void fp.reinitialize1PEventLoggingIfConfigChanged()
      })
    })
    profileCheckpoint('init_after_1p_event_logging')

    // Populate OAuth account info if it is not already cached in config. This is needed since the
    // OAuth account info may not be populated when logging in through the VSCode extension.
    void populateOAuthAccountInfoIfNeeded()
    profileCheckpoint('init_after_oauth_populate')

    // Initialize JetBrains IDE detection asynchronously (populates cache for later sync access)
    void initJetBrainsDetection()
    profileCheckpoint('init_after_jetbrains_detection')

    // Detect GitHub repository asynchronously (populates cache for gitDiff PR linking)
    void detectCurrentRepository()

    // Initialize the loading promise early so that other systems (like plugin hooks)
    // can await remote settings loading. The promise includes a timeout to prevent
    // deadlocks if loadRemoteManagedSettings() is never called (e.g., Agent SDK tests).
    if (isEligibleForRemoteManagedSettings()) {
      initializeRemoteManagedSettingsLoadingPromise()
    }
    if (isPolicyLimitsEligible()) {
      initializePolicyLimitsLoadingPromise()
    }
    profileCheckpoint('init_after_remote_settings_check')

    // Record the first start time
    recordFirstStartTime()

    // Configure global mTLS settings
    const mtlsStart = Date.now()
    logForDebugging('[init] configureGlobalMTLS starting')
    configureGlobalMTLS()
    logForDiagnosticsNoPII('info', 'init_mtls_configured', {
      duration_ms: Date.now() - mtlsStart,
    })
    logForDebugging('[init] configureGlobalMTLS complete')

    // Configure global HTTP agents (proxy and/or mTLS)
    const proxyStart = Date.now()
    logForDebugging('[init] configureGlobalAgents starting')
    configureGlobalAgents()
    logForDiagnosticsNoPII('info', 'init_proxy_configured', {
      duration_ms: Date.now() - proxyStart,
    })
    logForDebugging('[init] configureGlobalAgents complete')
    profileCheckpoint('init_network_configured')

    // Preconnect to the Anthropic API — overlap TCP+TLS handshake
    // (~100-200ms) with the ~100ms of action-handler work before the API
    // request. After CA certs + proxy agents are configured so the warmed
    // connection uses the right transport. Fire-and-forget; skipped for
    // proxy/mTLS/unix/cloud-provider where the SDK's dispatcher wouldn't
    // reuse the global pool.
    preconnectAnthropicApi()

    // CCR upstreamproxy: start the local CONNECT relay so agent subprocesses
    // can reach org-configured upstreams with credential injection. Gated on
    // CLAUDE_CODE_REMOTE + GrowthBook; fail-open on any error. Lazy import so
    // non-CCR startups don't pay the module load. The getUpstreamProxyEnv
    // function is registered with subprocessEnv.ts so subprocess spawning can
    // inject proxy vars without a static import of the upstreamproxy module.
    if (isEnvTruthy(process.env.CLAUDE_CODE_REMOTE)) {
      try {
        const { initUpstreamProxy, getUpstreamProxyEnv } = await import(
          '../upstreamproxy/upstreamproxy.js'
        )
        const { registerUpstreamProxyEnvFn } = await import(
          '../utils/subprocessEnv.js'
        )
        registerUpstreamProxyEnvFn(getUpstreamProxyEnv)
        await initUpstreamProxy()
      } catch (err) {
        logForDebugging(
          `[init] upstreamproxy init failed: ${err instanceof Error ? err.message : String(err)}; continuing without proxy`,
          { level: 'warn' },
        )
      }
    }

    // Set up git-bash if relevant
    setShellIfWindows()

    // Register LSP manager cleanup (initialization happens in main.tsx after --plugin-dir is processed)
    registerCleanup(shutdownLspServerManager)

    // gh-32730: teams created by subagents (or main agent without
    // explicit TeamDelete) were left on disk forever. Register cleanup
    // for all teams created this session. Lazy import: swarm code is
    // behind feature gate and most sessions never create teams.
    registerCleanup(async () => {
      const { cleanupSessionTeams } = await import(
        '../utils/swarm/teamHelpers.js'
      )
      await cleanupSessionTeams()
    })

    // Initialize scratchpad directory if enabled
    if (isScratchpadEnabled()) {
      const scratchpadStart = Date.now()
      await ensureScratchpadDir()
      logForDiagnosticsNoPII('info', 'init_scratchpad_created', {
        duration_ms: Date.now() - scratchpadStart,
      })
    }

    logForDiagnosticsNoPII('info', 'init_completed', {
      duration_ms: Date.now() - initStartTime,
    })
    profileCheckpoint('init_function_end')
  } catch (error) {
    if (error instanceof ConfigParseError) {
      // Skip the interactive Ink dialog when we can't safely render it.
      // The dialog breaks JSON consumers (e.g. desktop marketplace plugin
      // manager running `plugin marketplace list --json` in a VM sandbox).
      if (getIsNonInteractiveSession()) {
        process.stderr.write(
          `Configuration error in ${error.filePath}: ${error.message}\n`,
        )
        gracefulShutdownSync(1)
        return
      }

      // Show the invalid config dialog with the error object and wait for it to complete
      return import('../components/InvalidConfigDialog.js').then(m =>
        m.showInvalidConfigDialog({ error }),
      )
      // Dialog itself handles process.exit, so we don't need additional cleanup here
    } else {
      // For non-config errors, rethrow them
      throw error
    }
  }
})

/**
 * Initialize telemetry after trust has been granted.
 * For remote-settings-eligible users, waits for settings to load (non-blocking),
 * then re-applies env vars (to include remote settings) before initializing telemetry.
 * For non-eligible users, initializes telemetry immediately.
 * This should only be called once, after the trust dialog has been accepted.
 */
export function initializeTelemetryAfterTrust(): void {
  if (isEligibleForRemoteManagedSettings()) {
    // For SDK/headless mode with beta tracing, initialize eagerly first
    // to ensure the tracer is ready before the first query runs.
    // The async path below will still run but doInitializeTelemetry() guards against double init.
    if (getIsNonInteractiveSession() && isBetaTracingEnabled()) {
      void doInitializeTelemetry().catch(error => {
        logForDebugging(
          `[3P telemetry] Eager telemetry init failed (beta tracing): ${errorMessage(error)}`,
          { level: 'error' },
        )
      })
    }
    logForDebugging(
      '[3P telemetry] Waiting for remote managed settings before telemetry init',
    )
    void waitForRemoteManagedSettingsToLoad()
      .then(async () => {
        logForDebugging(
          '[3P telemetry] Remote managed settings loaded, initializing telemetry',
        )
        // Re-apply env vars to pick up remote settings before initializing telemetry.
        applyConfigEnvironmentVariables()
        await doInitializeTelemetry()
      })
      .catch(error => {
        logForDebugging(
          `[3P telemetry] Telemetry init failed (remote settings path): ${errorMessage(error)}`,
          { level: 'error' },
        )
      })
  } else {
    void doInitializeTelemetry().catch(error => {
      logForDebugging(
        `[3P telemetry] Telemetry init failed: ${errorMessage(error)}`,
        { level: 'error' },
      )
    })
  }
}

async function doInitializeTelemetry(): Promise<void> {
  if (telemetryInitialized) {
    // Already initialized, nothing to do
    return
  }

  // Set flag before init to prevent double initialization
  telemetryInitialized = true
  try {
    await setMeterState()
  } catch (error) {
    // Reset flag on failure so subsequent calls can retry
    telemetryInitialized = false
    throw error
  }
}

async function setMeterState(): Promise<void> {
  // Lazy-load instrumentation to defer ~400KB of OpenTelemetry + protobuf
  const { initializeTelemetry } = await import(
    '../utils/telemetry/instrumentation.js'
  )
  // Initialize customer OTLP telemetry (metrics, logs, traces)
  const meter = await initializeTelemetry()
  if (meter) {
    // Create factory function for attributed counters
    const createAttributedCounter = (
      name: string,
      options: MetricOptions,
    ): AttributedCounter => {
      const counter = meter?.createCounter(name, options)

      return {
        add(value: number, additionalAttributes: Attributes = {}) {
          // Always fetch fresh telemetry attributes to ensure they're up to date
          const currentAttributes = getTelemetryAttributes()
          const mergedAttributes = {
            ...currentAttributes,
            ...additionalAttributes,
          }
          counter?.add(value, mergedAttributes)
        },
      }
    }

    setMeter(meter, createAttributedCounter)

    // Increment session counter here because the startup telemetry path
    // runs before this async initialization completes, so the counter
    // would be null there.
    getSessionCounter()?.add(1)
  }
}
