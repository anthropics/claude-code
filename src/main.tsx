// These side-effects must run before all other imports:
// 1. profileCheckpoint marks entry before heavy module evaluation begins
// 2. startMdmRawRead fires MDM subprocesses (plutil/reg query) so they run in
//    parallel with the remaining ~135ms of imports below
// 3. startKeychainPrefetch fires both macOS keychain reads (OAuth + legacy API
//    key) in parallel — isRemoteManagedSettingsEligible() otherwise reads them
//    sequentially via sync spawn inside applySafeConfigEnvironmentVariables()
//    (~65ms on every macOS startup)
import { profileCheckpoint, profileReport } from './utils/startupProfiler.js';

// eslint-disable-next-line custom-rules/no-top-level-side-effects
profileCheckpoint('main_tsx_entry');
import { startMdmRawRead } from './utils/settings/mdm/rawRead.js';

// eslint-disable-next-line custom-rules/no-top-level-side-effects
startMdmRawRead();
import { ensureKeychainPrefetchCompleted, startKeychainPrefetch } from './utils/secureStorage/keychainPrefetch.js';

// eslint-disable-next-line custom-rules/no-top-level-side-effects
startKeychainPrefetch();
import { feature } from 'bun:bundle';
import { Command as CommanderCommand, InvalidArgumentError, Option } from '@commander-js/extra-typings';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import mapValues from 'lodash-es/mapValues.js';
import pickBy from 'lodash-es/pickBy.js';
import uniqBy from 'lodash-es/uniqBy.js';
import React from 'react';
import { getOauthConfig } from './constants/oauth.js';
import { getRemoteSessionUrl } from './constants/product.js';
import { getSystemContext, getUserContext } from './context.js';
import { init, initializeTelemetryAfterTrust } from './entrypoints/init.js';
import { addToHistory } from './history.js';
import type { Root } from './ink.js';
import { launchRepl } from './replLauncher.js';
import { hasGrowthBookEnvOverride, initializeGrowthBook, refreshGrowthBookAfterAuthChange } from './services/analytics/growthbook.js';
import { fetchBootstrapData } from './services/api/bootstrap.js';
import { type DownloadResult, downloadSessionFiles, type FilesApiConfig, parseFileSpecs } from './services/api/filesApi.js';
import { prefetchPassesEligibility } from './services/api/referral.js';
import { prefetchOfficialMcpUrls } from './services/mcp/officialRegistry.js';
import type { McpSdkServerConfig, McpServerConfig, ScopedMcpServerConfig } from './services/mcp/types.js';
import { isPolicyAllowed, loadPolicyLimits, refreshPolicyLimits, waitForPolicyLimitsToLoad } from './services/policyLimits/index.js';
import { loadRemoteManagedSettings, refreshRemoteManagedSettings } from './services/remoteManagedSettings/index.js';
import type { ToolInputJSONSchema } from './Tool.js';
import { createSyntheticOutputTool, isSyntheticOutputToolEnabled } from './tools/SyntheticOutputTool/SyntheticOutputTool.js';
import { getTools } from './tools.js';
import { canUserConfigureAdvisor, getInitialAdvisorSetting, isAdvisorEnabled, isValidAdvisorModel, modelSupportsAdvisor } from './utils/advisor.js';
import { isAgentSwarmsEnabled } from './utils/agentSwarmsEnabled.js';
import { count, uniq } from './utils/array.js';
import { installAsciicastRecorder } from './utils/asciicast.js';
import { getSubscriptionType, isClaudeAISubscriber, prefetchAwsCredentialsAndBedRockInfoIfSafe, prefetchGcpCredentialsIfSafe, validateForceLoginOrg } from './utils/auth.js';
import { checkHasTrustDialogAccepted, getGlobalConfig, getRemoteControlAtStartup, isAutoUpdaterDisabled, saveGlobalConfig } from './utils/config.js';
import { seedEarlyInput, stopCapturingEarlyInput } from './utils/earlyInput.js';
import { getInitialEffortSetting, parseEffortValue } from './utils/effort.js';
import { getInitialFastModeSetting, isFastModeEnabled, prefetchFastModeStatus, resolveFastModeStatusFromCache } from './utils/fastMode.js';
import { applyConfigEnvironmentVariables } from './utils/managedEnv.js';
import { createSystemMessage, createUserMessage } from './utils/messages.js';
import { getPlatform } from './utils/platform.js';
import { getBaseRenderOptions } from './utils/renderOptions.js';
import { getSessionIngressAuthToken } from './utils/sessionIngressAuth.js';
import { settingsChangeDetector } from './utils/settings/changeDetector.js';
import { skillChangeDetector } from './utils/skills/skillChangeDetector.js';
import { jsonParse, writeFileSync_DEPRECATED } from './utils/slowOperations.js';
import { computeInitialTeamContext } from './utils/swarm/reconnection.js';
import { initializeWarningHandler } from './utils/warningHandler.js';
import { isWorktreeModeEnabled } from './utils/worktreeModeEnabled.js';

// Lazy require to avoid circular dependency: teammate.ts -> AppState.tsx -> ... -> main.tsx
/* eslint-disable @typescript-eslint/no-require-imports */
const getTeammateUtils = () => require('./utils/teammate.js') as typeof import('./utils/teammate.js');
const getTeammatePromptAddendum = () => require('./utils/swarm/teammatePromptAddendum.js') as typeof import('./utils/swarm/teammatePromptAddendum.js');
const getTeammateModeSnapshot = () => require('./utils/swarm/backends/teammateModeSnapshot.js') as typeof import('./utils/swarm/backends/teammateModeSnapshot.js');
/* eslint-enable @typescript-eslint/no-require-imports */
// Dead code elimination: conditional import for COORDINATOR_MODE
/* eslint-disable @typescript-eslint/no-require-imports */
const coordinatorModeModule = feature('COORDINATOR_MODE') ? require('./coordinator/coordinatorMode.js') as typeof import('./coordinator/coordinatorMode.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */
// Dead code elimination: conditional import for KAIROS (assistant mode)
/* eslint-disable @typescript-eslint/no-require-imports */
const assistantModule = feature('KAIROS') ? require('./assistant/index.js') as typeof import('./assistant/index.js') : null;
const kairosGate = feature('KAIROS') ? require('./assistant/gate.js') as typeof import('./assistant/gate.js') : null;
import { relative, resolve } from 'path';
import { isAnalyticsDisabled } from 'src/services/analytics/config.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { initializeAnalyticsGates } from 'src/services/analytics/sink.js';
import { getOriginalCwd, setAdditionalDirectoriesForClaudeMd, setIsRemoteMode, setMainLoopModelOverride, setMainThreadAgentType, setTeleportedSessionInfo } from './bootstrap/state.js';
import { filterCommandsForRemoteMode, getCommands } from './commands.js';
import type { StatsStore } from './context/stats.js';
import { launchAssistantInstallWizard, launchAssistantSessionChooser, launchInvalidSettingsDialog, launchResumeChooser, launchSnapshotUpdateDialog, launchTeleportRepoMismatchDialog, launchTeleportResumeWrapper } from './dialogLaunchers.js';
import { SHOW_CURSOR } from './ink/termio/dec.js';
import { exitWithError, exitWithMessage, getRenderContext, renderAndRun, showSetupScreens } from './interactiveHelpers.js';
import { initBuiltinPlugins } from './plugins/bundled/index.js';
/* eslint-enable @typescript-eslint/no-require-imports */
import { checkQuotaStatus } from './services/claudeAiLimits.js';
import { getMcpToolsCommandsAndResources, prefetchAllMcpResources } from './services/mcp/client.js';
import { VALID_INSTALLABLE_SCOPES, VALID_UPDATE_SCOPES } from './services/plugins/pluginCliCommands.js';
import { initBundledSkills } from './skills/bundled/index.js';
import type { AgentColorName } from './tools/AgentTool/agentColorManager.js';
import { getActiveAgentsFromList, getAgentDefinitionsWithOverrides, isBuiltInAgent, isCustomAgent, parseAgentsFromJson } from './tools/AgentTool/loadAgentsDir.js';
import type { LogOption } from './types/logs.js';
import type { Message as MessageType } from './types/message.js';
import { assertMinVersion } from './utils/autoUpdater.js';
import { CLAUDE_IN_CHROME_SKILL_HINT, CLAUDE_IN_CHROME_SKILL_HINT_WITH_WEBBROWSER } from './utils/claudeInChrome/prompt.js';
import { setupClaudeInChrome, shouldAutoEnableClaudeInChrome, shouldEnableClaudeInChrome } from './utils/claudeInChrome/setup.js';
import { getContextWindowForModel } from './utils/context.js';
import { loadConversationForResume } from './utils/conversationRecovery.js';
import { buildDeepLinkBanner } from './utils/deepLink/banner.js';
import { hasNodeOption, isBareMode, isEnvTruthy, isInProtectedNamespace } from './utils/envUtils.js';
import { refreshExampleCommands } from './utils/exampleCommands.js';
import type { FpsMetrics } from './utils/fpsTracker.js';
import { getWorktreePaths } from './utils/getWorktreePaths.js';
import { findGitRoot, getBranch, getIsGit, getWorktreeCount } from './utils/git.js';
import { getGhAuthStatus } from './utils/github/ghAuthStatus.js';
import { safeParseJSON } from './utils/json.js';
import { logError } from './utils/log.js';
import { getModelDeprecationWarning } from './utils/model/deprecation.js';
import { getDefaultMainLoopModel, getUserSpecifiedModelSetting, normalizeModelStringForAPI, parseUserSpecifiedModel } from './utils/model/model.js';
import { ensureModelStringsInitialized } from './utils/model/modelStrings.js';
import { PERMISSION_MODES } from './utils/permissions/PermissionMode.js';
import { checkAndDisableBypassPermissions, getAutoModeEnabledStateIfCached, initializeToolPermissionContext, initialPermissionModeFromCLI, isDefaultPermissionModeAuto, parseToolListFromCLI, removeDangerousPermissions, stripDangerousPermissionsForAutoMode, verifyAutoModeGateAccess } from './utils/permissions/permissionSetup.js';
import { cleanupOrphanedPluginVersionsInBackground } from './utils/plugins/cacheUtils.js';
import { initializeVersionedPlugins } from './utils/plugins/installedPluginsManager.js';
import { getManagedPluginNames } from './utils/plugins/managedPlugins.js';
import { getGlobExclusionsForPluginCache } from './utils/plugins/orphanedPluginFilter.js';
import { getPluginSeedDirs } from './utils/plugins/pluginDirectories.js';
import { countFilesRoundedRg } from './utils/ripgrep.js';
import { processSessionStartHooks, processSetupHooks } from './utils/sessionStart.js';
import { cacheSessionTitle, getSessionIdFromLog, loadTranscriptFromFile, saveAgentSetting, saveMode, searchSessionsByCustomTitle, sessionIdExists } from './utils/sessionStorage.js';
import { ensureMdmSettingsLoaded } from './utils/settings/mdm/settings.js';
import { getInitialSettings, getManagedSettingsKeysForLogging, getSettingsForSource, getSettingsWithErrors } from './utils/settings/settings.js';
import { resetSettingsCache } from './utils/settings/settingsCache.js';
import type { ValidationError } from './utils/settings/validation.js';
import { DEFAULT_TASKS_MODE_TASK_LIST_ID, TASK_STATUSES } from './utils/tasks.js';
import { logPluginLoadErrors, logPluginsEnabledForSession } from './utils/telemetry/pluginTelemetry.js';
import { logSkillsLoaded } from './utils/telemetry/skillLoadedEvent.js';
import { generateTempFilePath } from './utils/tempfile.js';
import { validateUuid } from './utils/uuid.js';
// Plugin startup checks are now handled non-blockingly in REPL.tsx

import { registerMcpAddCommand } from 'src/commands/mcp/addCommand.js';
import { registerMcpXaaIdpCommand } from 'src/commands/mcp/xaaIdpCommand.js';
import { logPermissionContextForAnts } from 'src/services/internalLogging.js';
import { fetchClaudeAIMcpConfigsIfEligible } from 'src/services/mcp/claudeai.js';
import { clearServerCache } from 'src/services/mcp/client.js';
import { areMcpConfigsAllowedWithEnterpriseMcpConfig, dedupClaudeAiMcpServers, doesEnterpriseMcpConfigExist, filterMcpServersByPolicy, getClaudeCodeMcpConfigs, getMcpServerSignature, parseMcpConfig, parseMcpConfigFromFilePath } from 'src/services/mcp/config.js';
import { excludeCommandsByServer, excludeResourcesByServer } from 'src/services/mcp/utils.js';
import { isXaaEnabled } from 'src/services/mcp/xaaIdpLogin.js';
import { getRelevantTips } from 'src/services/tips/tipRegistry.js';
import { logContextMetrics } from 'src/utils/api.js';
import { CLAUDE_IN_CHROME_MCP_SERVER_NAME, isClaudeInChromeMCPServer } from 'src/utils/claudeInChrome/common.js';
import { registerCleanup } from 'src/utils/cleanupRegistry.js';
import { eagerParseCliFlag } from 'src/utils/cliArgs.js';
import { createEmptyAttributionState } from 'src/utils/commitAttribution.js';
import { countConcurrentSessions, registerSession, updateSessionName } from 'src/utils/concurrentSessions.js';
import { getCwd } from 'src/utils/cwd.js';
import { logForDebugging, setHasFormattedOutput } from 'src/utils/debug.js';
import { errorMessage, getErrnoCode, isENOENT, TeleportOperationError, toError } from 'src/utils/errors.js';
import { getFsImplementation, safeResolvePath } from 'src/utils/fsOperations.js';
import { gracefulShutdown, gracefulShutdownSync } from 'src/utils/gracefulShutdown.js';
import { setAllHookEventsEnabled } from 'src/utils/hooks/hookEvents.js';
import { refreshModelCapabilities } from 'src/utils/model/modelCapabilities.js';
import { peekForStdinData, writeToStderr } from 'src/utils/process.js';
import { setCwd } from 'src/utils/Shell.js';
import { type ProcessedResume, processResumedConversation } from 'src/utils/sessionRestore.js';
import { parseSettingSourcesFlag } from 'src/utils/settings/constants.js';
import { plural } from 'src/utils/stringUtils.js';
import { type ChannelEntry, getInitialMainLoopModel, getIsNonInteractiveSession, getSdkBetas, getSessionId, getUserMsgOptIn, setAllowedChannels, setAllowedSettingSources, setChromeFlagOverride, setClientType, setCwdState, setDirectConnectServerUrl, setFlagSettingsPath, setInitialMainLoopModel, setInlinePlugins, setIsInteractive, setKairosActive, setOriginalCwd, setQuestionPreviewFormat, setSdkBetas, setSessionBypassPermissionsMode, setSessionPersistenceDisabled, setSessionSource, setUserMsgOptIn, switchSession } from './bootstrap/state.js';

/* eslint-disable @typescript-eslint/no-require-imports */
const autoModeStateModule = feature('TRANSCRIPT_CLASSIFIER') ? require('./utils/permissions/autoModeState.js') as typeof import('./utils/permissions/autoModeState.js') : null;

// TeleportRepoMismatchDialog, TeleportResumeWrapper dynamically imported at call sites
import { migrateAutoUpdatesToSettings } from './migrations/migrateAutoUpdatesToSettings.js';
import { migrateBypassPermissionsAcceptedToSettings } from './migrations/migrateBypassPermissionsAcceptedToSettings.js';
import { migrateEnableAllProjectMcpServersToSettings } from './migrations/migrateEnableAllProjectMcpServersToSettings.js';
import { migrateFennecToOpus } from './migrations/migrateFennecToOpus.js';
import { migrateLegacyOpusToCurrent } from './migrations/migrateLegacyOpusToCurrent.js';
import { migrateOpusToOpus1m } from './migrations/migrateOpusToOpus1m.js';
import { migrateReplBridgeEnabledToRemoteControlAtStartup } from './migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.js';
import { migrateSonnet1mToSonnet45 } from './migrations/migrateSonnet1mToSonnet45.js';
import { migrateSonnet45ToSonnet46 } from './migrations/migrateSonnet45ToSonnet46.js';
import { resetAutoModeOptInForDefaultOffer } from './migrations/resetAutoModeOptInForDefaultOffer.js';
import { resetProToOpusDefault } from './migrations/resetProToOpusDefault.js';
import { createRemoteSessionConfig } from './remote/RemoteSessionManager.js';
/* eslint-enable @typescript-eslint/no-require-imports */
// teleportWithProgress dynamically imported at call site
import { createDirectConnectSession, DirectConnectError } from './server/createDirectConnectSession.js';
import { initializeLspServerManager } from './services/lsp/manager.js';
import { shouldEnablePromptSuggestion } from './services/PromptSuggestion/promptSuggestion.js';
import { type AppState, getDefaultAppState, IDLE_SPECULATION_STATE } from './state/AppStateStore.js';
import { onChangeAppState } from './state/onChangeAppState.js';
import { createStore } from './state/store.js';
import { asSessionId } from './types/ids.js';
import { filterAllowedSdkBetas } from './utils/betas.js';
import { isInBundledMode, isRunningWithBun } from './utils/bundledMode.js';
import { logForDiagnosticsNoPII } from './utils/diagLogs.js';
import { filterExistingPaths, getKnownPathsForRepo } from './utils/githubRepoPathMapping.js';
import { clearPluginCache, loadAllPluginsCacheOnly } from './utils/plugins/pluginLoader.js';
import { migrateChangelogFromConfig } from './utils/releaseNotes.js';
import { SandboxManager } from './utils/sandbox/sandbox-adapter.js';
import { fetchSession, prepareApiRequest } from './utils/teleport/api.js';
import { checkOutTeleportedSessionBranch, processMessagesForTeleportResume, teleportToRemoteWithErrorHandling, validateGitState, validateSessionRepository } from './utils/teleport.js';
import { shouldEnableThinkingByDefault, type ThinkingConfig } from './utils/thinking.js';
import { initUser, resetUserCache } from './utils/user.js';
import { getTmuxInstallInstructions, isTmuxAvailable, parsePRReference } from './utils/worktree.js';

// eslint-disable-next-line custom-rules/no-top-level-side-effects
profileCheckpoint('main_tsx_imports_loaded');

/**
 * Log managed settings keys to Statsig for analytics.
 * This is called after init() completes to ensure settings are loaded
 * and environment variables are applied before model resolution.
 */
function logManagedSettings(): void {
  try {
    const policySettings = getSettingsForSource('policySettings');
    if (policySettings) {
      const allKeys = getManagedSettingsKeysForLogging(policySettings);
      logEvent('tengu_managed_settings_loaded', {
        keyCount: allKeys.length,
        keys: allKeys.join(',') as unknown as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  } catch {
    // Silently ignore errors - this is just for analytics
  }
}

// Check if running in debug/inspection mode
function isBeingDebugged() {
  const isBun = isRunningWithBun();

  // Check for inspect flags in process arguments (including all variants)
  const hasInspectArg = process.execArgv.some(arg => {
    if (isBun) {
      // Note: Bun has an issue with single-file executables where application arguments
      // from process.argv leak into process.execArgv (similar to https://github.com/oven-sh/bun/issues/11673)
      // This breaks use of --debug mode if we omit this branch
      // We're fine to skip that check, because Bun doesn't support Node.js legacy --debug or --debug-brk flags
      return /--inspect(-brk)?/.test(arg);
    } else {
      // In Node.js, check for both --inspect and legacy --debug flags
      return /--inspect(-brk)?|--debug(-brk)?/.test(arg);
    }
  });

  // Check if NODE_OPTIONS contains inspect flags
  const hasInspectEnv = process.env.NODE_OPTIONS && /--inspect(-brk)?|--debug(-brk)?/.test(process.env.NODE_OPTIONS);

  // Check if inspector is available and active (indicates debugging)
  try {
    // Dynamic import would be better but is async - use global object instead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inspector = (global as any).require('inspector');
    const hasInspectorUrl = !!inspector.url();
    return hasInspectorUrl || hasInspectArg || hasInspectEnv;
  } catch {
    // Ignore error and fall back to argument detection
    return hasInspectArg || hasInspectEnv;
  }
}

// Exit if we detect node debugging or inspection
if ("external" !== 'ant' && isBeingDebugged()) {
  // Use process.exit directly here since we're in the top-level code before imports
  // and gracefulShutdown is not yet available
  // eslint-disable-next-line custom-rules/no-top-level-side-effects
  process.exit(1);
}

/**
 * Per-session skill/plugin telemetry. Called from both the interactive path
 * and the headless -p path (before runHeadless) — both go through
 * main.tsx but branch before the interactive startup path, so it needs two
 * call sites here rather than one here + one in QueryEngine.
 */
function logSessionTelemetry(): void {
  const model = parseUserSpecifiedModel(getInitialMainLoopModel() ?? getDefaultMainLoopModel());
  void logSkillsLoaded(getCwd(), getContextWindowForModel(model, getSdkBetas()));
  void loadAllPluginsCacheOnly().then(({
    enabled,
    errors
  }) => {
    const managedNames = getManagedPluginNames();
    logPluginsEnabledForSession(enabled, managedNames, getPluginSeedDirs());
    logPluginLoadErrors(errors, managedNames);
  }).catch(err => logError(err));
}
function getCertEnvVarTelemetry(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (process.env.NODE_EXTRA_CA_CERTS) {
    result.has_node_extra_ca_certs = true;
  }
  if (process.env.CLAUDE_CODE_CLIENT_CERT) {
    result.has_client_cert = true;
  }
  if (hasNodeOption('--use-system-ca')) {
    result.has_use_system_ca = true;
  }
  if (hasNodeOption('--use-openssl-ca')) {
    result.has_use_openssl_ca = true;
  }
  return result;
}
async function logStartupTelemetry(): Promise<void> {
  if (isAnalyticsDisabled()) return;
  const [isGit, worktreeCount, ghAuthStatus] = await Promise.all([getIsGit(), getWorktreeCount(), getGhAuthStatus()]);
  logEvent('tengu_startup_telemetry', {
    is_git: isGit,
    worktree_count: worktreeCount,
    gh_auth_status: ghAuthStatus as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    sandbox_enabled: SandboxManager.isSandboxingEnabled(),
    are_unsandboxed_commands_allowed: SandboxManager.areUnsandboxedCommandsAllowed(),
    is_auto_bash_allowed_if_sandbox_enabled: SandboxManager.isAutoAllowBashIfSandboxedEnabled(),
    auto_updater_disabled: isAutoUpdaterDisabled(),
    prefers_reduced_motion: getInitialSettings().prefersReducedMotion ?? false,
    ...getCertEnvVarTelemetry()
  });
}

// @[MODEL LAUNCH]: Consider any migrations you may need for model strings. See migrateSonnet1mToSonnet45.ts for an example.
// Bump this when adding a new sync migration so existing users re-run the set.
const CURRENT_MIGRATION_VERSION = 11;
function runMigrations(): void {
  if (getGlobalConfig().migrationVersion !== CURRENT_MIGRATION_VERSION) {
    migrateAutoUpdatesToSettings();
    migrateBypassPermissionsAcceptedToSettings();
    migrateEnableAllProjectMcpServersToSettings();
    resetProToOpusDefault();
    migrateSonnet1mToSonnet45();
    migrateLegacyOpusToCurrent();
    migrateSonnet45ToSonnet46();
    migrateOpusToOpus1m();
    migrateReplBridgeEnabledToRemoteControlAtStartup();
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      resetAutoModeOptInForDefaultOffer();
    }
    if ("external" === 'ant') {
      migrateFennecToOpus();
    }
    saveGlobalConfig(prev => prev.migrationVersion === CURRENT_MIGRATION_VERSION ? prev : {
      ...prev,
      migrationVersion: CURRENT_MIGRATION_VERSION
    });
  }
  // Async migration - fire and forget since it's non-blocking
  migrateChangelogFromConfig().catch(() => {
    // Silently ignore migration errors - will retry on next startup
  });
}

/**
 * Prefetch system context (including git status) only when it's safe to do so.
 * Git commands can execute arbitrary code via hooks and config (e.g., core.fsmonitor,
 * diff.external), so we must only run them after trust is established or in
 * non-interactive mode where trust is implicit.
 */
function prefetchSystemContextIfSafe(): void {
  const isNonInteractiveSession = getIsNonInteractiveSession();

  // In non-interactive mode (--print), trust dialog is skipped and
  // execution is considered trusted (as documented in help text)
  if (isNonInteractiveSession) {
    logForDiagnosticsNoPII('info', 'prefetch_system_context_non_interactive');
    void getSystemContext();
    return;
  }

  // In interactive mode, only prefetch if trust has already been established
  const hasTrust = checkHasTrustDialogAccepted();
  if (hasTrust) {
    logForDiagnosticsNoPII('info', 'prefetch_system_context_has_trust');
    void getSystemContext();
  } else {
    logForDiagnosticsNoPII('info', 'prefetch_system_context_skipped_no_trust');
  }
  // Otherwise, don't prefetch - wait for trust to be established first
}

/**
 * Start background prefetches and housekeeping that are NOT needed before first render.
 * These are deferred from setup() to reduce event loop contention and child process
 * spawning during the critical startup path.
 * Call this after the REPL has been rendered.
 */
export function startDeferredPrefetches(): void {
  // This function runs after first render, so it doesn't block the initial paint.
  // However, the spawned processes and async work still contend for CPU and event
  // loop time, which skews startup benchmarks (CPU profiles, time-to-first-render
  // measurements). Skip all of it when we're only measuring startup performance.
  if (isEnvTruthy(process.env.CLAUDE_CODE_EXIT_AFTER_FIRST_RENDER) ||
  // --bare: skip ALL prefetches. These are cache-warms for the REPL's
  // first-turn responsiveness (initUser, getUserContext, tips, countFiles,
  // modelCapabilities, change detectors). Scripted -p calls don't have a
  // "user is typing" window to hide this work in — it's pure overhead on
  // the critical path.
  isBareMode()) {
    return;
  }

  // Process-spawning prefetches (consumed at first API call, user is still typing)
  void initUser();
  void getUserContext();
  prefetchSystemContextIfSafe();
  void getRelevantTips();
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK) && !isEnvTruthy(process.env.CLAUDE_CODE_SKIP_BEDROCK_AUTH)) {
    void prefetchAwsCredentialsAndBedRockInfoIfSafe();
  }
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX) && !isEnvTruthy(process.env.CLAUDE_CODE_SKIP_VERTEX_AUTH)) {
    void prefetchGcpCredentialsIfSafe();
  }
  void countFilesRoundedRg(getCwd(), AbortSignal.timeout(3000), []);

  // Analytics and feature flag initialization
  void initializeAnalyticsGates();
  void prefetchOfficialMcpUrls();
  void refreshModelCapabilities();

  // File change detectors deferred from init() to unblock first render
  void settingsChangeDetector.initialize();
  if (!isBareMode()) {
    void skillChangeDetector.initialize();
  }

  // Event loop stall detector — logs when the main thread is blocked >500ms
  if ("external" === 'ant') {
    void import('./utils/eventLoopStallDetector.js').then(m => m.startEventLoopStallDetector());
  }
}
function loadSettingsFromFlag(settingsFile: string): void {
  try {
    const trimmedSettings = settingsFile.trim();
    const looksLikeJson = trimmedSettings.startsWith('{') && trimmedSettings.endsWith('}');
    let settingsPath: string;
    if (looksLikeJson) {
      // It's a JSON string - validate and create temp file
      const parsedJson = safeParseJSON(trimmedSettings);
      if (!parsedJson) {
        process.stderr.write(chalk.red('Error: Invalid JSON provided to --settings\n'));
        process.exit(1);
      }

      // Create a temporary file and write the JSON to it.
      // Use a content-hash-based path instead of random UUID to avoid
      // busting the Anthropic API prompt cache. The settings path ends up
      // in the Bash tool's sandbox denyWithinAllow list, which is part of
      // the tool description sent to the API. A random UUID per subprocess
      // changes the tool description on every query() call, invalidating
      // the cache prefix and causing a 12x input token cost penalty.
      // The content hash ensures identical settings produce the same path
      // across process boundaries (each SDK query() spawns a new process).
      settingsPath = generateTempFilePath('claude-settings', '.json', {
        contentHash: trimmedSettings
      });
      writeFileSync_DEPRECATED(settingsPath, trimmedSettings, 'utf8');
    } else {
      // It's a file path - resolve and validate by attempting to read
      const {
        resolvedPath: resolvedSettingsPath
      } = safeResolvePath(getFsImplementation(), settingsFile);
      try {
        readFileSync(resolvedSettingsPath, 'utf8');
      } catch (e) {
        if (isENOENT(e)) {
          process.stderr.write(chalk.red(`Error: Settings file not found: ${resolvedSettingsPath}\n`));
          process.exit(1);
        }
        throw e;
      }
      settingsPath = resolvedSettingsPath;
    }
    setFlagSettingsPath(settingsPath);
    resetSettingsCache();
  } catch (error) {
    if (error instanceof Error) {
      logError(error);
    }
    process.stderr.write(chalk.red(`Error processing settings: ${errorMessage(error)}\n`));
    process.exit(1);
  }
}
function loadSettingSourcesFromFlag(settingSourcesArg: string): void {
  try {
    const sources = parseSettingSourcesFlag(settingSourcesArg);
    setAllowedSettingSources(sources);
    resetSettingsCache();
  } catch (error) {
    if (error instanceof Error) {
      logError(error);
    }
    process.stderr.write(chalk.red(`Error processing --setting-sources: ${errorMessage(error)}\n`));
    process.exit(1);
  }
}

/**
 * Parse and load settings flags early, before init()
 * This ensures settings are filtered from the start of initialization
 */
function eagerLoadSettings(): void {
  profileCheckpoint('eagerLoadSettings_start');
  // Parse --settings flag early to ensure settings are loaded before init()
  const settingsFile = eagerParseCliFlag('--settings');
  if (settingsFile) {
    loadSettingsFromFlag(settingsFile);
  }

  // Parse --setting-sources flag early to control which sources are loaded
  const settingSourcesArg = eagerParseCliFlag('--setting-sources');
  if (settingSourcesArg !== undefined) {
    loadSettingSourcesFromFlag(settingSourcesArg);
  }
  profileCheckpoint('eagerLoadSettings_end');
}
function initializeEntrypoint(isNonInteractive: boolean): void {
  // Skip if already set (e.g., by SDK or other entrypoints)
  if (process.env.CLAUDE_CODE_ENTRYPOINT) {
    return;
  }
  const cliArgs = process.argv.slice(2);

  // Check for MCP serve command (handle flags before mcp serve, e.g., --debug mcp serve)
  const mcpIndex = cliArgs.indexOf('mcp');
  if (mcpIndex !== -1 && cliArgs[mcpIndex + 1] === 'serve') {
    process.env.CLAUDE_CODE_ENTRYPOINT = 'mcp';
    return;
  }
  if (isEnvTruthy(process.env.CLAUDE_CODE_ACTION)) {
    process.env.CLAUDE_CODE_ENTRYPOINT = 'claude-code-github-action';
    return;
  }

  // Note: 'local-agent' entrypoint is set by the local agent mode launcher
  // via CLAUDE_CODE_ENTRYPOINT env var (handled by early return above)

  // Set based on interactive status
  process.env.CLAUDE_CODE_ENTRYPOINT = isNonInteractive ? 'sdk-cli' : 'cli';
}

// Set by early argv processing when `claude open <url>` is detected (interactive mode only)
type PendingConnect = {
  url: string | undefined;
  authToken: string | undefined;
  dangerouslySkipPermissions: boolean;
};
const _pendingConnect: PendingConnect | undefined = feature('DIRECT_CONNECT') ? {
  url: undefined,
  authToken: undefined,
  dangerouslySkipPermissions: false
} : undefined;

// Set by early argv processing when `claude assistant [sessionId]` is detected
type PendingAssistantChat = {
  sessionId?: string;
  discover: boolean;
};
const _pendingAssistantChat: PendingAssistantChat | undefined = feature('KAIROS') ? {
  sessionId: undefined,
  discover: false
} : undefined;

// `claude ssh <host> [dir]` — parsed from argv early (same pattern as
// DIRECT_CONNECT above) so the main command path can pick it up and hand
// the REPL an SSH-backed session instead of a local one.
type PendingSSH = {
  host: string | undefined;
  cwd: string | undefined;
  permissionMode: string | undefined;
  dangerouslySkipPermissions: boolean;
  /** --local: spawn the child CLI directly, skip ssh/probe/deploy. e2e test mode. */
  local: boolean;
  /** Extra CLI args to forward to the remote CLI on initial spawn (--resume, -c). */
  extraCliArgs: string[];
};
const _pendingSSH: PendingSSH | undefined = feature('SSH_REMOTE') ? {
  host: undefined,
  cwd: undefined,
  permissionMode: undefined,
  dangerouslySkipPermissions: false,
  local: false,
  extraCliArgs: []
} : undefined;
export async function main() {
  profileCheckpoint('main_function_start');

  // SECURITY: Prevent Windows from executing commands from current directory
  // This must be set before ANY command execution to prevent PATH hijacking attacks
  // See: https://docs.microsoft.com/en-us/windows/win32/api/processenv/nf-processenv-searchpathw
  process.env.NoDefaultCurrentDirectoryInExePath = '1';

  // Initialize warning handler early to catch warnings
  initializeWarningHandler();
  process.on('exit', () => {
    resetCursor();
  });
  process.on('SIGINT', () => {
    // In print mode, print.ts registers its own SIGINT handler that aborts
    // the in-flight query and calls gracefulShutdown; skip here to avoid
    // preempting it with a synchronous process.exit().
    if (process.argv.includes('-p') || process.argv.includes('--print')) {
      return;
    }
    process.exit(0);
  });
  profileCheckpoint('main_warning_handler_initialized');

  // Check for cc:// or cc+unix:// URL in argv — rewrite so the main command
  // handles it, giving the full interactive TUI instead of a stripped-down subcommand.
  // For headless (-p), we rewrite to the internal `open` subcommand.
  if (feature('DIRECT_CONNECT')) {
    const rawCliArgs = process.argv.slice(2);
    const ccIdx = rawCliArgs.findIndex(a => a.startsWith('cc://') || a.startsWith('cc+unix://'));
    if (ccIdx !== -1 && _pendingConnect) {
      const ccUrl = rawCliArgs[ccIdx]!;
      const {
        parseConnectUrl
      } = await import('./server/parseConnectUrl.js');
      const parsed = parseConnectUrl(ccUrl);
      _pendingConnect.dangerouslySkipPermissions = rawCliArgs.includes('--dangerously-skip-permissions');
      if (rawCliArgs.includes('-p') || rawCliArgs.includes('--print')) {
        // Headless: rewrite to internal `open` subcommand
        const stripped = rawCliArgs.filter((_, i) => i !== ccIdx);
        const dspIdx = stripped.indexOf('--dangerously-skip-permissions');
        if (dspIdx !== -1) {
          stripped.splice(dspIdx, 1);
        }
        process.argv = [process.argv[0]!, process.argv[1]!, 'open', ccUrl, ...stripped];
      } else {
        // Interactive: strip cc:// URL and flags, run main command
        _pendingConnect.url = parsed.serverUrl;
        _pendingConnect.authToken = parsed.authToken;
        const stripped = rawCliArgs.filter((_, i) => i !== ccIdx);
        const dspIdx = stripped.indexOf('--dangerously-skip-permissions');
        if (dspIdx !== -1) {
          stripped.splice(dspIdx, 1);
        }
        process.argv = [process.argv[0]!, process.argv[1]!, ...stripped];
      }
    }
  }

  // Handle deep link URIs early — this is invoked by the OS protocol handler
  // and should bail out before full init since it only needs to parse the URI
  // and open a terminal.
  if (feature('LODESTONE')) {
    const handleUriIdx = process.argv.indexOf('--handle-uri');
    if (handleUriIdx !== -1 && process.argv[handleUriIdx + 1]) {
      const {
        enableConfigs
      } = await import('./utils/config.js');
      enableConfigs();
      const uri = process.argv[handleUriIdx + 1]!;
      const {
        handleDeepLinkUri
      } = await import('./utils/deepLink/protocolHandler.js');
      const exitCode = await handleDeepLinkUri(uri);
      process.exit(exitCode);
    }

    // macOS URL handler: when LaunchServices launches our .app bundle, the
    // URL arrives via Apple Event (not argv). LaunchServices overwrites
    // __CFBundleIdentifier to the launching bundle's ID, which is a precise
    // positive signal — cheaper than importing and guessing with heuristics.
    if (process.platform === 'darwin' && process.env.__CFBundleIdentifier === 'com.anthropic.claude-code-url-handler') {
      const {
        enableConfigs
      } = await import('./utils/config.js');
      enableConfigs();
      const {
        handleUrlSchemeLaunch
      } = await import('./utils/deepLink/protocolHandler.js');
      const urlSchemeResult = await handleUrlSchemeLaunch();
      process.exit(urlSchemeResult ?? 1);
    }
  }

  // `claude assistant [sessionId]` — stash and strip so the main
  // command handles it, giving the full interactive TUI. Position-0 only
  // (matching the ssh pattern below) — indexOf would false-positive on
  // `claude -p "explain assistant"`. Root-flag-before-subcommand
  // (e.g. `--debug assistant`) falls through to the stub, which
  // prints usage.
  if (feature('KAIROS') && _pendingAssistantChat) {
    const rawArgs = process.argv.slice(2);
    if (rawArgs[0] === 'assistant') {
      const nextArg = rawArgs[1];
      if (nextArg && !nextArg.startsWith('-')) {
        _pendingAssistantChat.sessionId = nextArg;
        rawArgs.splice(0, 2); // drop 'assistant' and sessionId
        process.argv = [process.argv[0]!, process.argv[1]!, ...rawArgs];
      } else if (!nextArg) {
        _pendingAssistantChat.discover = true;
        rawArgs.splice(0, 1); // drop 'assistant'
        process.argv = [process.argv[0]!, process.argv[1]!, ...rawArgs];
      }
      // else: `claude assistant --help` → fall through to stub
    }
  }

  // `claude ssh <host> [dir]` — strip from argv so the main command handler
  // runs (full interactive TUI), stash the host/dir for the REPL branch at
  // ~line 3720 to pick up. Headless (-p) mode not supported in v1: SSH
  // sessions need the local REPL to drive them (interrupt, permissions).
  if (feature('SSH_REMOTE') && _pendingSSH) {
    const rawCliArgs = process.argv.slice(2);
    // SSH-specific flags can appear before the host positional (e.g.
    // `ssh --permission-mode auto host /tmp` — standard POSIX flags-before-
    // positionals). Pull them all out BEFORE checking whether a host was
    // given, so `claude ssh --permission-mode auto host` and `claude ssh host
    // --permission-mode auto` are equivalent. The host check below only needs
    // to guard against `-h`/`--help` (which commander should handle).
    if (rawCliArgs[0] === 'ssh') {
      const localIdx = rawCliArgs.indexOf('--local');
      if (localIdx !== -1) {
        _pendingSSH.local = true;
        rawCliArgs.splice(localIdx, 1);
      }
      const dspIdx = rawCliArgs.indexOf('--dangerously-skip-permissions');
      if (dspIdx !== -1) {
        _pendingSSH.dangerouslySkipPermissions = true;
        rawCliArgs.splice(dspIdx, 1);
      }
      const pmIdx = rawCliArgs.indexOf('--permission-mode');
      if (pmIdx !== -1 && rawCliArgs[pmIdx + 1] && !rawCliArgs[pmIdx + 1]!.startsWith('-')) {
        _pendingSSH.permissionMode = rawCliArgs[pmIdx + 1];
        rawCliArgs.splice(pmIdx, 2);
      }
      const pmEqIdx = rawCliArgs.findIndex(a => a.startsWith('--permission-mode='));
      if (pmEqIdx !== -1) {
        _pendingSSH.permissionMode = rawCliArgs[pmEqIdx]!.split('=')[1];
        rawCliArgs.splice(pmEqIdx, 1);
      }
      // Forward session-resume + model flags to the remote CLI's initial spawn.
      // --continue/-c and --resume <uuid> operate on the REMOTE session history
      // (which persists under the remote's ~/.claude/projects/<cwd>/).
      // --model controls which model the remote uses.
      const extractFlag = (flag: string, opts: {
        hasValue?: boolean;
        as?: string;
      } = {}) => {
        const i = rawCliArgs.indexOf(flag);
        if (i !== -1) {
          _pendingSSH.extraCliArgs.push(opts.as ?? flag);
          const val = rawCliArgs[i + 1];
          if (opts.hasValue && val && !val.startsWith('-')) {
            _pendingSSH.extraCliArgs.push(val);
            rawCliArgs.splice(i, 2);
          } else {
            rawCliArgs.splice(i, 1);
          }
        }
        const eqI = rawCliArgs.findIndex(a => a.startsWith(`${flag}=`));
        if (eqI !== -1) {
          _pendingSSH.extraCliArgs.push(opts.as ?? flag, rawCliArgs[eqI]!.slice(flag.length + 1));
          rawCliArgs.splice(eqI, 1);
        }
      };
      extractFlag('-c', {
        as: '--continue'
      });
      extractFlag('--continue');
      extractFlag('--resume', {
        hasValue: true
      });
      extractFlag('--model', {
        hasValue: true
      });
    }
    // After pre-extraction, any remaining dash-arg at [1] is either -h/--help
    // (commander handles) or an unknown-to-ssh flag (fall through to commander
    // so it surfaces a proper error). Only a non-dash arg is the host.
    if (rawCliArgs[0] === 'ssh' && rawCliArgs[1] && !rawCliArgs[1].startsWith('-')) {
      _pendingSSH.host = rawCliArgs[1];
      // Optional positional cwd.
      let consumed = 2;
      if (rawCliArgs[2] && !rawCliArgs[2].startsWith('-')) {
        _pendingSSH.cwd = rawCliArgs[2];
        consumed = 3;
      }
      const rest = rawCliArgs.slice(consumed);

      // Headless (-p) mode is not supported with SSH in v1 — reject early
      // so the flag doesn't silently cause local execution.
      if (rest.includes('-p') || rest.includes('--print')) {
        process.stderr.write('Error: headless (-p/--print) mode is not supported with claude ssh\n');
        gracefulShutdownSync(1);
        return;
      }

      // Rewrite argv so the main command sees remaining flags but not `ssh`.
      process.argv = [process.argv[0]!, process.argv[1]!, ...rest];
    }
  }

  // Check for -p/--print and --init-only flags early to set isInteractiveSession before init()
  // This is needed because telemetry initialization calls auth functions that need this flag
  const cliArgs = process.argv.slice(2);
  const hasPrintFlag = cliArgs.includes('-p') || cliArgs.includes('--print');
  const hasInitOnlyFlag = cliArgs.includes('--init-only');
  const hasSdkUrl = cliArgs.some(arg => arg.startsWith('--sdk-url'));
  const isNonInteractive = hasPrintFlag || hasInitOnlyFlag || hasSdkUrl || !process.stdout.isTTY;

  // Stop capturing early input for non-interactive modes
  if (isNonInteractive) {
    stopCapturingEarlyInput();
  }

  // Set simplified tracking fields
  const isInteractive = !isNonInteractive;
  setIsInteractive(isInteractive);

  // Initialize entrypoint based on mode - needs to be set before any event is logged
  initializeEntrypoint(isNonInteractive);

  // Determine client type
  const clientType = (() => {
    if (isEnvTruthy(process.env.GITHUB_ACTIONS)) return 'github-action';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-ts') return 'sdk-typescript';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-py') return 'sdk-python';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'sdk-cli') return 'sdk-cli';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'claude-vscode') return 'claude-vscode';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'local-agent') return 'local-agent';
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'claude-desktop') return 'claude-desktop';

    // Check if session-ingress token is provided (indicates remote session)
    const hasSessionIngressToken = process.env.CLAUDE_CODE_SESSION_ACCESS_TOKEN || process.env.CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR;
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'remote' || hasSessionIngressToken) {
      return 'remote';
    }
    return 'cli';
  })();
  setClientType(clientType);
  const previewFormat = process.env.CLAUDE_CODE_QUESTION_PREVIEW_FORMAT;
  if (previewFormat === 'markdown' || previewFormat === 'html') {
    setQuestionPreviewFormat(previewFormat);
  } else if (!clientType.startsWith('sdk-') &&
  // Desktop and CCR pass previewFormat via toolConfig; when the feature is
  // gated off they pass undefined — don't override that with markdown.
  clientType !== 'claude-desktop' && clientType !== 'local-agent' && clientType !== 'remote') {
    setQuestionPreviewFormat('markdown');
  }

  // Tag sessions created via `claude remote-control` so the backend can identify them
  if (process.env.CLAUDE_CODE_ENVIRONMENT_KIND === 'bridge') {
    setSessionSource('remote-control');
  }
  profileCheckpoint('main_client_type_determined');

  // Parse and load settings flags early, before init()
  eagerLoadSettings();
  profileCheckpoint('main_before_run');
  await run();
  profileCheckpoint('main_after_run');
}
async function getInputPrompt(prompt: string, inputFormat: 'text' | 'stream-json'): Promise<string | AsyncIterable<string>> {
  if (!process.stdin.isTTY &&
  // Input hijacking breaks MCP.
  !process.argv.includes('mcp')) {
    if (inputFormat === 'stream-json') {
      return process.stdin;
    }
    process.stdin.setEncoding('utf8');
    let data = '';
    const onData = (chunk: string) => {
      data += chunk;
    };
    process.stdin.on('data', onData);
    // If no data arrives in 3s, stop waiting and warn. Stdin is likely an
    // inherited pipe from a parent that isn't writing (subprocess spawned
    // without explicit stdin handling). 3s covers slow producers like curl,
    // jq on large files, python with import overhead. The warning makes
    // silent data loss visible for the rare producer that's slower still.
    const timedOut = await peekForStdinData(process.stdin, 3000);
    process.stdin.off('data', onData);
    if (timedOut) {
      process.stderr.write('Warning: no stdin data received in 3s, proceeding without it. ' + 'If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.\n');
    }
    return [prompt, data].filter(Boolean).join('\n');
  }
  return prompt;
}
async function run(): Promise<CommanderCommand> {
  profileCheckpoint('run_function_start');

  // Create help config that sorts options by long option name.
  // Commander supports compareOptions at runtime but @commander-js/extra-typings
  // doesn't include it in the type definitions, so we use Object.assign to add it.
  function createSortedHelpConfig(): {
    sortSubcommands: true;
    sortOptions: true;
  } {
    const getOptionSortKey = (opt: Option): string => opt.long?.replace(/^--/, '') ?? opt.short?.replace(/^-/, '') ?? '';
    return Object.assign({
      sortSubcommands: true,
      sortOptions: true
    } as const, {
      compareOptions: (a: Option, b: Option) => getOptionSortKey(a).localeCompare(getOptionSortKey(b))
    });
  }
  const program = new CommanderCommand().configureHelp(createSortedHelpConfig()).enablePositionalOptions();
  profileCheckpoint('run_commander_initialized');

  // Use preAction hook to run initialization only when executing a command,
  // not when displaying help. This avoids the need for env variable signaling.
  program.hook('preAction', async thisCommand => {
    profileCheckpoint('preAction_start');
    // Await async subprocess loads started at module evaluation (lines 12-20).
    // Nearly free — subprocesses complete during the ~135ms of imports above.
    // Must resolve before init() which triggers the first settings read
    // (applySafeConfigEnvironmentVariables → getSettingsForSource('policySettings')
    // → isRemoteManagedSettingsEligible → sync keychain reads otherwise ~65ms).
    await Promise.all([ensureMdmSettingsLoaded(), ensureKeychainPrefetchCompleted()]);
    profileCheckpoint('preAction_after_mdm');
    await init();
    profileCheckpoint('preAction_after_init');

    // process.title on Windows sets the console title directly; on POSIX,
    // terminal shell integration may mirror the process name to the tab.
    // After init() so settings.json env can also gate this (gh-4765).
    if (!isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_TERMINAL_TITLE)) {
      process.title = 'claude';
    }

    // Attach logging sinks so subcommand handlers can use logEvent/logError.
    // Before PR #11106 logEvent dispatched directly; after, events queue until
    // a sink attaches. setup() attaches sinks for the default command, but
    // subcommands (doctor, mcp, plugin, auth) never call setup() and would
    // silently drop events on process.exit(). Both inits are idempotent.
    const {
      initSinks
    } = await import('./utils/sinks.js');
    initSinks();
    profileCheckpoint('preAction_after_sinks');

    // gh-33508: --plugin-dir is a top-level program option. The default
    // action reads it from its own options destructure, but subcommands
    // (plugin list, plugin install, mcp *) have their own actions and
    // never see it. Wire it up here so getInlinePlugins() works everywhere.
    // thisCommand.opts() is typed {} here because this hook is attached
    // before .option('--plugin-dir', ...) in the chain — extra-typings
    // builds the type as options are added. Narrow with a runtime guard;
    // the collect accumulator + [] default guarantee string[] in practice.
    const pluginDir = thisCommand.getOptionValue('pluginDir');
    if (Array.isArray(pluginDir) && pluginDir.length > 0 && pluginDir.every(p => typeof p === 'string')) {
      setInlinePlugins(pluginDir);
      clearPluginCache('preAction: --plugin-dir inline plugins');
    }
    runMigrations();
    profileCheckpoint('preAction_after_migrations');

    // Load remote managed settings for enterprise customers (non-blocking)
    // Fails open - if fetch fails, continues without remote settings
    // Settings are applied via hot-reload when they arrive
    // Must happen after init() to ensure config reading is allowed
    void loadRemoteManagedSettings();
    void loadPolicyLimits();
    profileCheckpoint('preAction_after_remote_settings');

    // Load settings sync (non-blocking, fail-open)
    // CLI: uploads local settings to remote (CCR download is handled by print.ts)
    if (feature('UPLOAD_USER_SETTINGS')) {
      void import('./services/settingsSync/index.js').then(m => m.uploadUserSettingsInBackground());
    }
    profileCheckpoint('preAction_after_settings_sync');
  });
  program.name('claude').description(`Claude Code - starts an interactive session by default, use -p/--print for non-interactive output`).argument('[prompt]', 'Your prompt', String)
  // Subcommands inherit helpOption via commander's copyInheritedSettings —
  // setting it once here covers mcp, plugin, auth, and all other subcommands.
  .helpOption('-h, --help', 'Display help for command').option('-d, --debug [filter]', 'Enable debug mode with optional category filtering (e.g., "api,hooks" or "!1p,!file")', (_value: string | true) => {
    // If value is provided, it will be the filter string
    // If not provided but flag is present, value will be true
    // The actual filtering is handled in debug.ts by parsing process.argv
    return true;
  }).addOption(new Option('-d2e, --debug-to-stderr', 'Enable debug mode (to stderr)').argParser(Boolean).hideHelp()).option('--debug-file <path>', 'Write debug logs to a specific file path (implicitly enables debug mode)', () => true).option('--verbose', 'Override verbose mode setting from config', () => true).option('-p, --print', 'Print response and exit (useful for pipes). Note: The workspace trust dialog is skipped when Claude is run with the -p mode. Only use this flag in directories you trust.', () => true).option('--bare', 'Minimal mode: skip hooks, LSP, plugin sync, attribution, auto-memory, background prefetches, keychain reads, and CLAUDE.md auto-discovery. Sets CLAUDE_CODE_SIMPLE=1. Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings (OAuth and keychain are never read). 3P providers (Bedrock/Vertex/Foundry) use their own credentials. Skills still resolve via /skill-name. Explicitly provide context via: --system-prompt[-file], --append-system-prompt[-file], --add-dir (CLAUDE.md dirs), --mcp-config, --settings, --agents, --plugin-dir.', () => true).addOption(new Option('--init', 'Run Setup hooks with init trigger, then continue').hideHelp()).addOption(new Option('--init-only', 'Run Setup and SessionStart:startup hooks, then exit').hideHelp()).addOption(new Option('--maintenance', 'Run Setup hooks with maintenance trigger, then continue').hideHelp()).addOption(new Option('--output-format <format>', 'Output format (only works with --print): "text" (default), "json" (single result), or "stream-json" (realtime streaming)').choices(['text', 'json', 'stream-json'])).addOption(new Option('--json-schema <schema>', 'JSON Schema for structured output validation. ' + 'Example: {"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}').argParser(String)).option('--include-hook-events', 'Include all hook lifecycle events in the output stream (only works with --output-format=stream-json)', () => true).option('--include-partial-messages', 'Include partial message chunks as they arrive (only works with --print and --output-format=stream-json)', () => true).addOption(new Option('--input-format <format>', 'Input format (only works with --print): "text" (default), or "stream-json" (realtime streaming input)').choices(['text', 'stream-json'])).option('--mcp-debug', '[DEPRECATED. Use --debug instead] Enable MCP debug mode (shows MCP server errors)', () => true).option('--dangerously-skip-permissions', 'Bypass all permission checks. Recommended only for sandboxes with no internet access.', () => true).option('--allow-dangerously-skip-permissions', 'Enable bypassing all permission checks as an option, without it being enabled by default. Recommended only for sandboxes with no internet access.', () => true).addOption(new Option('--thinking <mode>', 'Thinking mode: enabled (equivalent to adaptive), disabled').choices(['enabled', 'adaptive', 'disabled']).hideHelp()).addOption(new Option('--max-thinking-tokens <tokens>', '[DEPRECATED. Use --thinking instead for newer models] Maximum number of thinking tokens (only works with --print)').argParser(Number).hideHelp()).addOption(new Option('--max-turns <turns>', 'Maximum number of agentic turns in non-interactive mode. This will early exit the conversation after the specified number of turns. (only works with --print)').argParser(Number).hideHelp()).addOption(new Option('--max-budget-usd <amount>', 'Maximum dollar amount to spend on API calls (only works with --print)').argParser(value => {
    const amount = Number(value);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('--max-budget-usd must be a positive number greater than 0');
    }
    return amount;
  })).addOption(new Option('--task-budget <tokens>', 'API-side task budget in tokens (output_config.task_budget)').argParser(value => {
    const tokens = Number(value);
    if (isNaN(tokens) || tokens <= 0 || !Number.isInteger(tokens)) {
      throw new Error('--task-budget must be a positive integer');
    }
    return tokens;
  }).hideHelp()).option('--replay-user-messages', 'Re-emit user messages from stdin back on stdout for acknowledgment (only works with --input-format=stream-json and --output-format=stream-json)', () => true).addOption(new Option('--enable-auth-status', 'Enable auth status messages in SDK mode').default(false).hideHelp()).option('--allowedTools, --allowed-tools <tools...>', 'Comma or space-separated list of tool names to allow (e.g. "Bash(git:*) Edit")').option('--tools <tools...>', 'Specify the list of available tools from the built-in set. Use "" to disable all tools, "default" to use all tools, or specify tool names (e.g. "Bash,Edit,Read").').option('--disallowedTools, --disallowed-tools <tools...>', 'Comma or space-separated list of tool names to deny (e.g. "Bash(git:*) Edit")').option('--mcp-config <configs...>', 'Load MCP servers from JSON files or strings (space-separated)').addOption(new Option('--permission-prompt-tool <tool>', 'MCP tool to use for permission prompts (only works with --print)').argParser(String).hideHelp()).addOption(new Option('--system-prompt <prompt>', 'System prompt to use for the session').argParser(String)).addOption(new Option('--system-prompt-file <file>', 'Read system prompt from a file').argParser(String).hideHelp()).addOption(new Option('--append-system-prompt <prompt>', 'Append a system prompt to the default system prompt').argParser(String)).addOption(new Option('--append-system-prompt-file <file>', 'Read system prompt from a file and append to the default system prompt').argParser(String).hideHelp()).addOption(new Option('--permission-mode <mode>', 'Permission mode to use for the session').argParser(String).choices(PERMISSION_MODES)).option('-c, --continue', 'Continue the most recent conversation in the current directory', () => true).option('-r, --resume [value]', 'Resume a conversation by session ID, or open interactive picker with optional search term', value => value || true).option('--fork-session', 'When resuming, create a new session ID instead of reusing the original (use with --resume or --continue)', () => true).addOption(new Option('--prefill <text>', 'Pre-fill the prompt input with text without submitting it').hideHelp()).addOption(new Option('--deep-link-origin', 'Signal that this session was launched from a deep link').hideHelp()).addOption(new Option('--deep-link-repo <slug>', 'Repo slug the deep link ?repo= parameter resolved to the current cwd').hideHelp()).addOption(new Option('--deep-link-last-fetch <ms>', 'FETCH_HEAD mtime in epoch ms, precomputed by the deep link trampoline').argParser(v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }).hideHelp()).option('--from-pr [value]', 'Resume a session linked to a PR by PR number/URL, or open interactive picker with optional search term', value => value || true).option('--no-session-persistence', 'Disable session persistence - sessions will not be saved to disk and cannot be resumed (only works with --print)').addOption(new Option('--resume-session-at <message id>', 'When resuming, only messages up to and including the assistant message with <message.id> (use with --resume in print mode)').argParser(String).hideHelp()).addOption(new Option('--rewind-files <user-message-id>', 'Restore files to state at the specified user message and exit (requires --resume)').hideHelp())
  // @[MODEL LAUNCH]: Update the example model ID in the --model help text.
  .option('--model <model>', `Model for the current session. Provide an alias for the latest model (e.g. 'sonnet' or 'opus') or a model's full name (e.g. 'claude-sonnet-4-6').`).addOption(new Option('--effort <level>', `Effort level for the current session (low, medium, high, max)`).argParser((rawValue: string) => {
    const value = rawValue.toLowerCase();
    const allowed = ['low', 'medium', 'high', 'max'];
    if (!allowed.includes(value)) {
      throw new InvalidArgumentError(`It must be one of: ${allowed.join(', ')}`);
    }
    return value;
  })).option('--agent <agent>', `Agent for the current session. Overrides the 'agent' setting.`).option('--betas <betas...>', 'Beta headers to include in API requests (API key users only)').option('--fallback-model <model>', 'Enable automatic fallback to specified model when default model is overloaded (only works with --print)').addOption(new Option('--workload <tag>', 'Workload tag for billing-header attribution (cc_workload). Process-scoped; set by SDK daemon callers that spawn subprocesses for cron work. (only works with --print)').hideHelp()).option('--settings <file-or-json>', 'Path to a settings JSON file or a JSON string to load additional settings from').option('--add-dir <directories...>', 'Additional directories to allow tool access to').option('--ide', 'Automatically connect to IDE on startup if exactly one valid IDE is available', () => true).option('--strict-mcp-config', 'Only use MCP servers from --mcp-config, ignoring all other MCP configurations', () => true).option('--session-id <uuid>', 'Use a specific session ID for the conversation (must be a valid UUID)').option('-n, --name <name>', 'Set a display name for this session (shown in /resume and terminal title)').option('--agents <json>', 'JSON object defining custom agents (e.g. \'{"reviewer": {"description": "Reviews code", "prompt": "You are a code reviewer"}}\')').option('--setting-sources <sources>', 'Comma-separated list of setting sources to load (user, project, local).')
  // gh-33508: <paths...> (variadic) consumed everything until the next
  // --flag. `claude --plugin-dir /path mcp add --transport http` swallowed
  // `mcp` and `add` as paths, then choked on --transport as an unknown
  // top-level option. Single-value + collect accumulator means each
  // --plugin-dir takes exactly one arg; repeat the flag for multiple dirs.
  .option('--plugin-dir <path>', 'Load plugins from a directory for this session only (repeatable: --plugin-dir A --plugin-dir B)', (val: string, prev: string[]) => [...prev, val], [] as string[]).option('--disable-slash-commands', 'Disable all skills', () => true).option('--chrome', 'Enable Claude in Chrome integration').option('--no-chrome', 'Disable Claude in Chrome integration').option('--file <specs...>', 'File resources to download at startup. Format: file_id:relative_path (e.g., --file file_abc:doc.txt file_def:img.png)').action(async (prompt, options) => {
    profileCheckpoint('action_handler_start');

    // --bare = one-switch minimal mode. Sets SIMPLE so all the existing
    // gates fire (CLAUDE.md, skills, hooks inside executeHooks, agent
    // dir-walk). Must be set before setup() / any of the gated work runs.
    if ((options as {
      bare?: boolean;
    }).bare) {
      process.env.CLAUDE_CODE_SIMPLE = '1';
    }

    // Ignore "code" as a prompt - treat it the same as no prompt
    if (prompt === 'code') {
      logEvent('tengu_code_prompt_ignored', {});
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.warn(chalk.yellow('Tip: You can launch Claude Code with just `claude`'));
      prompt = undefined;
    }

    // Log event for any single-word prompt
    if (prompt && typeof prompt === 'string' && !/\s/.test(prompt) && prompt.length > 0) {
      logEvent('tengu_single_word_prompt', {
        length: prompt.length
      });
    }

    // Assistant mode: when .claude/settings.json has assistant: true AND
    // the tengu_kairos GrowthBook gate is on, force brief on. Permission
    // mode is left to the user — settings defaultMode or --permission-mode
    // apply as normal. REPL-typed messages already default to 'next'
    // priority (messageQueueManager.enqueue) so they drain mid-turn between
    // tool calls. SendUserMessage (BriefTool) is enabled via the brief env
    // var. SleepTool stays disabled (its isEnabled() gates on proactive).
    // kairosEnabled is computed once here and reused at the
    // getAssistantSystemPromptAddendum() call site further down.
    //
    // Trust gate: .claude/settings.json is attacker-controllable in an
    // untrusted clone. We run ~1000 lines before showSetupScreens() shows
    // the trust dialog, and by then we've already appended
    // .claude/agents/assistant.md to the system prompt. Refuse to activate
    // until the directory has been explicitly trusted.
    let kairosEnabled = false;
    let assistantTeamContext: Awaited<ReturnType<NonNullable<typeof assistantModule>['initializeAssistantTeam']>> | undefined;
    if (feature('KAIROS') && (options as {
      assistant?: boolean;
    }).assistant && assistantModule) {
      // --assistant (Agent SDK daemon mode): force the latch before
      // isAssistantMode() runs below. The daemon has already checked
      // entitlement — don't make the child re-check tengu_kairos.
      assistantModule.markAssistantForced();
    }
    if (feature('KAIROS') && assistantModule?.isAssistantMode() &&
    // Spawned teammates share the leader's cwd + settings.json, so
    // isAssistantMode() is true for them too. --agent-id being set
    // means we ARE a spawned teammate (extractTeammateOptions runs
    // ~170 lines later so check the raw commander option) — don't
    // re-init the team or override teammateMode/proactive/brief.
    !(options as {
      agentId?: unknown;
    }).agentId && kairosGate) {
      if (!checkHasTrustDialogAccepted()) {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.warn(chalk.yellow('Assistant mode disabled: directory is not trusted. Accept the trust dialog and restart.'));
      } else {
        // Blocking gate check — returns cached `true` instantly; if disk
        // cache is false/missing, lazily inits GrowthBook and fetches fresh
        // (max ~5s). --assistant skips the gate entirely (daemon is
        // pre-entitled).
        kairosEnabled = assistantModule.isAssistantForced() || (await kairosGate.isKairosEnabled());
        if (kairosEnabled) {
          const opts = options as {
            brief?: boolean;
          };
          opts.brief = true;
          setKairosActive(true);
          // Pre-seed an in-process team so Agent(name: "foo") spawns
          // teammates without TeamCreate. Must run BEFORE setup() captures
          // the teammateMode snapshot (initializeAssistantTeam calls
          // setCliTeammateModeOverride internally).
          assistantTeamContext = await assistantModule.initializeAssistantTeam();
        }
      }
    }
    const {
      debug = false,
      debugToStderr = false,
      dangerouslySkipPermissions,
      allowDangerouslySkipPermissions = false,
      tools: baseTools = [],
      allowedTools = [],
      disallowedTools = [],
      mcpConfig = [],
      permissionMode: permissionModeCli,
      addDir = [],
      fallbackModel,
      betas = [],
      ide = false,
      sessionId,
      includeHookEvents,
      includePartialMessages
    } = options;
    if (options.prefill) {
      seedEarlyInput(options.prefill);
    }

    // Promise for file downloads - started early, awaited before REPL renders
    let fileDownloadPromise: Promise<DownloadResult[]> | undefined;
    const agentsJson = options.agents;
    const agentCli = options.agent;
    if (feature('BG_SESSIONS') && agentCli) {
      process.env.CLAUDE_CODE_AGENT = agentCli;
    }

    // NOTE: LSP manager initialization is intentionally deferred until after
    // the trust dialog is accepted. This prevents plugin LSP servers from
    // executing code in untrusted directories before user consent.

    // Extract these separately so they can be modified if needed
    let outputFormat = options.outputFormat;
    let inputFormat = options.inputFormat;
    let verbose = options.verbose ?? getGlobalConfig().verbose;
    let print = options.print;
    const init = options.init ?? false;
    const initOnly = options.initOnly ?? false;
    const maintenance = options.maintenance ?? false;

    // Extract disable slash commands flag
    const disableSlashCommands = options.disableSlashCommands || false;

    // Extract tasks mode options (ant-only)
    const tasksOption = "external" === 'ant' && (options as {
      tasks?: boolean | string;
    }).tasks;
    const taskListId = tasksOption ? typeof tasksOption === 'string' ? tasksOption : DEFAULT_TASKS_MODE_TASK_LIST_ID : undefined;
    if ("external" === 'ant' && taskListId) {
      process.env.CLAUDE_CODE_TASK_LIST_ID = taskListId;
    }

    // Extract worktree option
    // worktree can be true (flag without value) or a string (custom name or PR reference)
    const worktreeOption = isWorktreeModeEnabled() ? (options as {
      worktree?: boolean | string;
    }).worktree : undefined;
    let worktreeName = typeof worktreeOption === 'string' ? worktreeOption : undefined;
    const worktreeEnabled = worktreeOption !== undefined;

    // Check if worktree name is a PR reference (#N or GitHub PR URL)
    let worktreePRNumber: number | undefined;
    if (worktreeName) {
      const prNum = parsePRReference(worktreeName);
      if (prNum !== null) {
        worktreePRNumber = prNum;
        worktreeName = undefined; // slug will be generated in setup()
      }
    }

    // Extract tmux option (requires --worktree)
    const tmuxEnabled = isWorktreeModeEnabled() && (options as {
      tmux?: boolean;
    }).tmux === true;

    // Validate tmux option
    if (tmuxEnabled) {
      if (!worktreeEnabled) {
        process.stderr.write(chalk.red('Error: --tmux requires --worktree\n'));
        process.exit(1);
      }
      if (getPlatform() === 'windows') {
        process.stderr.write(chalk.red('Error: --tmux is not supported on Windows\n'));
        process.exit(1);
      }
      if (!(await isTmuxAvailable())) {
        process.stderr.write(chalk.red(`Error: tmux is not installed.\n${getTmuxInstallInstructions()}\n`));
        process.exit(1);
      }
    }

    // Extract teammate options (for tmux-spawned agents)
    // Declared outside the if block so it's accessible later for system prompt addendum
    let storedTeammateOpts: TeammateOptions | undefined;
    if (isAgentSwarmsEnabled()) {
      // Extract agent identity options (for tmux-spawned agents)
      // These replace the CLAUDE_CODE_* environment variables
      const teammateOpts = extractTeammateOptions(options);
      storedTeammateOpts = teammateOpts;

      // If any teammate identity option is provided, all three required ones must be present
      const hasAnyTeammateOpt = teammateOpts.agentId || teammateOpts.agentName || teammateOpts.teamName;
      const hasAllRequiredTeammateOpts = teammateOpts.agentId && teammateOpts.agentName && teammateOpts.teamName;
      if (hasAnyTeammateOpt && !hasAllRequiredTeammateOpts) {
        process.stderr.write(chalk.red('Error: --agent-id, --agent-name, and --team-name must all be provided together\n'));
        process.exit(1);
      }

      // If teammate identity is provided via CLI, set up dynamicTeamContext
      if (teammateOpts.agentId && teammateOpts.agentName && teammateOpts.teamName) {
        getTeammateUtils().setDynamicTeamContext?.({
          agentId: teammateOpts.agentId,
          agentName: teammateOpts.agentName,
          teamName: teammateOpts.teamName,
          color: teammateOpts.agentColor,
          planModeRequired: teammateOpts.planModeRequired ?? false,
          parentSessionId: teammateOpts.parentSessionId
        });
      }

      // Set teammate mode CLI override if provided
      // This must be done before setup() captures the snapshot
      if (teammateOpts.teammateMode) {
        getTeammateModeSnapshot().setCliTeammateModeOverride?.(teammateOpts.teammateMode);
      }
    }

    // Extract remote sdk options
    const sdkUrl = (options as {
      sdkUrl?: string;
    }).sdkUrl ?? undefined;

    // Allow env var to enable partial messages (used by sandbox gateway for baku)
    const effectiveIncludePartialMessages = includePartialMessages || isEnvTruthy(process.env.CLAUDE_CODE_INCLUDE_PARTIAL_MESSAGES);

    // Enable all hook event types when explicitly requested via SDK option
    // or when running in CLAUDE_CODE_REMOTE mode (CCR needs them).
    // Without this, only SessionStart and Setup events are emitted.
    if (includeHookEvents || isEnvTruthy(process.env.CLAUDE_CODE_REMOTE)) {
      setAllHookEventsEnabled(true);
    }

    // Auto-set input/output formats, verbose mode, and print mode when SDK URL is provided
    if (sdkUrl) {
      // If SDK URL is provided, automatically use stream-json formats unless explicitly set
      if (!inputFormat) {
        inputFormat = 'stream-json';
      }
      if (!outputFormat) {
        outputFormat = 'stream-json';
      }
      // Auto-enable verbose mode unless explicitly disabled or already set
      if (options.verbose === undefined) {
        verbose = true;
      }
      // Auto-enable print mode unless explicitly disabled
      if (!options.print) {
        print = true;
      }
    }

    // Extract teleport option
    const teleport = (options as {
      teleport?: string | true;
    }).teleport ?? null;

    // Extract remote option (can be true if no description provided, or a string)
    const remoteOption = (options as {
      remote?: string | true;
    }).remote;
    const remote = remoteOption === true ? '' : remoteOption ?? null;

    // Extract --remote-control / --rc flag (enable bridge in interactive session)
    const remoteControlOption = (options as {
      remoteControl?: string | true;
    }).remoteControl ?? (options as {
      rc?: string | true;
    }).rc;
    // Actual bridge check is deferred to after showSetupScreens() so that
    // trust is established and GrowthBook has auth headers.
    let remoteControl = false;
    const remoteControlName = typeof remoteControlOption === 'string' && remoteControlOption.length > 0 ? remoteControlOption : undefined;

    // Validate session ID if provided
    if (sessionId) {
      // Check for conflicting flags
      // --session-id can be used with --continue or --resume when --fork-session is also provided
      // (to specify a custom ID for the forked session)
      if ((options.continue || options.resume) && !options.forkSession) {
        process.stderr.write(chalk.red('Error: --session-id can only be used with --continue or --resume if --fork-session is also specified.\n'));
        process.exit(1);
      }

      // When --sdk-url is provided (bridge/remote mode), the session ID is a
      // server-assigned tagged ID (e.g. "session_local_01...") rather than a
      // UUID. Skip UUID validation and local existence checks in that case.
      if (!sdkUrl) {
        const validatedSessionId = validateUuid(sessionId);
        if (!validatedSessionId) {
          process.stderr.write(chalk.red('Error: Invalid session ID. Must be a valid UUID.\n'));
          process.exit(1);
        }

        // Check if session ID already exists
        if (sessionIdExists(validatedSessionId)) {
          process.stderr.write(chalk.red(`Error: Session ID ${validatedSessionId} is already in use.\n`));
          process.exit(1);
        }
      }
    }

    // Download file resources if specified via --file flag
    const fileSpecs = (options as {
      file?: string[];
    }).file;
    if (fileSpecs && fileSpecs.length > 0) {
      // Get session ingress token (provided by EnvManager via CLAUDE_CODE_SESSION_ACCESS_TOKEN)
      const sessionToken = getSessionIngressAuthToken();
      if (!sessionToken) {
        process.stderr.write(chalk.red('Error: Session token required for file downloads. CLAUDE_CODE_SESSION_ACCESS_TOKEN must be set.\n'));
        process.exit(1);
      }

      // Resolve session ID: prefer remote session ID, fall back to internal session ID
      const fileSessionId = process.env.CLAUDE_CODE_REMOTE_SESSION_ID || getSessionId();
      const files = parseFileSpecs(fileSpecs);
      if (files.length > 0) {
        // Use ANTHROPIC_BASE_URL if set (by EnvManager), otherwise use OAuth config
        // This ensures consistency with session ingress API in all environments
        const config: FilesApiConfig = {
          baseUrl: process.env.ANTHROPIC_BASE_URL || getOauthConfig().BASE_API_URL,
          oauthToken: sessionToken,
          sessionId: fileSessionId
        };

        // Start download without blocking startup - await before REPL renders
        fileDownloadPromise = downloadSessionFiles(files, config);
      }
    }

    // Get isNonInteractiveSession from state (was set before init())
    const isNonInteractiveSession = getIsNonInteractiveSession();

    // Validate that fallback model is different from main model
    if (fallbackModel && options.model && fallbackModel === options.model) {
      process.stderr.write(chalk.red('Error: Fallback model cannot be the same as the main model. Please specify a different model for --fallback-model.\n'));
      process.exit(1);
    }

    // Handle system prompt options
    let systemPrompt = options.systemPrompt;
    if (options.systemPromptFile) {
      if (options.systemPrompt) {
        process.stderr.write(chalk.red('Error: Cannot use both --system-prompt and --system-prompt-file. Please use only one.\n'));
        process.exit(1);
      }
      try {
        const filePath = resolve(options.systemPromptFile);
        systemPrompt = readFileSync(filePath, 'utf8');
      } catch (error) {
        const code = getErrnoCode(error);
        if (code === 'ENOENT') {
          process.stderr.write(chalk.red(`Error: System prompt file not found: ${resolve(options.systemPromptFile)}\n`));
          process.exit(1);
        }
        process.stderr.write(chalk.red(`Error reading system prompt file: ${errorMessage(error)}\n`));
        process.exit(1);
      }
    }

    // Handle append system prompt options
    let appendSystemPrompt = options.appendSystemPrompt;
    if (options.appendSystemPromptFile) {
      if (options.appendSystemPrompt) {
        process.stderr.write(chalk.red('Error: Cannot use both --append-system-prompt and --append-system-prompt-file. Please use only one.\n'));
        process.exit(1);
      }
      try {
        const filePath = resolve(options.appendSystemPromptFile);
        appendSystemPrompt = readFileSync(filePath, 'utf8');
      } catch (error) {
        const code = getErrnoCode(error);
        if (code === 'ENOENT') {
          process.stderr.write(chalk.red(`Error: Append system prompt file not found: ${resolve(options.appendSystemPromptFile)}\n`));
          process.exit(1);
        }
        process.stderr.write(chalk.red(`Error reading append system prompt file: ${errorMessage(error)}\n`));
        process.exit(1);
      }
    }

    // Add teammate-specific system prompt addendum for tmux teammates
    if (isAgentSwarmsEnabled() && storedTeammateOpts?.agentId && storedTeammateOpts?.agentName && storedTeammateOpts?.teamName) {
      const addendum = getTeammatePromptAddendum().TEAMMATE_SYSTEM_PROMPT_ADDENDUM;
      appendSystemPrompt = appendSystemPrompt ? `${appendSystemPrompt}\n\n${addendum}` : addendum;
    }
    const {
      mode: permissionMode,
      notification: permissionModeNotification
    } = initialPermissionModeFromCLI({
      permissionModeCli,
      dangerouslySkipPermissions
    });

    // Store session bypass permissions mode for trust dialog check
    setSessionBypassPermissionsMode(permissionMode === 'bypassPermissions');
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      // autoModeFlagCli is the "did the user intend auto this session" signal.
      // Set when: --enable-auto-mode, --permission-mode auto, resolved mode
      // is auto, OR settings defaultMode is auto but the gate denied it
      // (permissionMode resolved to default with no explicit CLI override).
      // Used by verifyAutoModeGateAccess to decide whether to notify on
      // auto-unavailable, and by tengu_auto_mode_config opt-in carousel.
      if ((options as {
        enableAutoMode?: boolean;
      }).enableAutoMode || permissionModeCli === 'auto' || permissionMode === 'auto' || !permissionModeCli && isDefaultPermissionModeAuto()) {
        autoModeStateModule?.setAutoModeFlagCli(true);
      }
    }

    // Parse the MCP config files/strings if provided
    let dynamicMcpConfig: Record<string, ScopedMcpServerConfig> = {};
    if (mcpConfig && mcpConfig.length > 0) {
      // Process mcpConfig array
      const processedConfigs = mcpConfig.map(config => config.trim()).filter(config => config.length > 0);
      let allConfigs: Record<string, McpServerConfig> = {};
      const allErrors: ValidationError[] = [];
      for (const configItem of processedConfigs) {
        let configs: Record<string, McpServerConfig> | null = null;
        let errors: ValidationError[] = [];

        // First try to parse as JSON string
        const parsedJson = safeParseJSON(configItem);
        if (parsedJson) {
          const result = parseMcpConfig({
            configObject: parsedJson,
            filePath: 'command line',
            expandVars: true,
            scope: 'dynamic'
          });
          if (result.config) {
            configs = result.config.mcpServers;
          } else {
            errors = result.errors;
          }
        } else {
          // Try as file path
          const configPath = resolve(configItem);
          const result = parseMcpConfigFromFilePath({
            filePath: configPath,
            expandVars: true,
            scope: 'dynamic'
          });
          if (result.config) {
            configs = result.config.mcpServers;
          } else {
            errors = result.errors;
          }
        }
        if (errors.length > 0) {
          allErrors.push(...errors);
        } else if (configs) {
          // Merge configs, later ones override earlier ones
          allConfigs = {
            ...allConfigs,
            ...configs
          };
        }
      }
      if (allErrors.length > 0) {
        const formattedErrors = allErrors.map(err => `${err.path ? err.path + ': ' : ''}${err.message}`).join('\n');
        logForDebugging(`--mcp-config validation failed (${allErrors.length} errors): ${formattedErrors}`, {
          level: 'error'
        });
        process.stderr.write(`Error: Invalid MCP configuration:\n${formattedErrors}\n`);
        process.exit(1);
      }
      if (Object.keys(allConfigs).length > 0) {
        // SDK hosts (Nest/Desktop) own their server naming and may reuse
        // built-in names — skip reserved-name checks for type:'sdk'.
        const nonSdkConfigNames = Object.entries(allConfigs).filter(([, config]) => config.type !== 'sdk').map(([name]) => name);
        let reservedNameError: string | null = null;
        if (nonSdkConfigNames.some(isClaudeInChromeMCPServer)) {
          reservedNameError = `Invalid MCP configuration: "${CLAUDE_IN_CHROME_MCP_SERVER_NAME}" is a reserved MCP name.`;
        } else if (feature('CHICAGO_MCP')) {
          const {
            isComputerUseMCPServer,
            COMPUTER_USE_MCP_SERVER_NAME
          } = await import('src/utils/computerUse/common.js');
          if (nonSdkConfigNames.some(isComputerUseMCPServer)) {
            reservedNameError = `Invalid MCP configuration: "${COMPUTER_USE_MCP_SERVER_NAME}" is a reserved MCP name.`;
          }
        }
        if (reservedNameError) {
          // stderr+exit(1) — a throw here becomes a silent unhandled
          // rejection in stream-json mode (void main() in cli.tsx).
          process.stderr.write(`Error: ${reservedNameError}\n`);
          process.exit(1);
        }

        // Add dynamic scope to all configs. type:'sdk' entries pass through
        // unchanged — they're extracted into sdkMcpConfigs downstream and
        // passed to print.ts. The Python SDK relies on this path (it doesn't
        // send sdkMcpServers in the initialize message). Dropping them here
        // broke Coworker (inc-5122). The policy filter below already exempts
        // type:'sdk', and the entries are inert without an SDK transport on
        // stdin, so there's no bypass risk from letting them through.
        const scopedConfigs = mapValues(allConfigs, config => ({
          ...config,
          scope: 'dynamic' as const
        }));

        // Enforce managed policy (allowedMcpServers / deniedMcpServers) on
        // --mcp-config servers. Without this, the CLI flag bypasses the
        // enterprise allowlist that user/project/local configs go through in
        // getClaudeCodeMcpConfigs — callers spread dynamicMcpConfig back on
        // top of filtered results. Filter here at the source so all
        // downstream consumers see the policy-filtered set.
        const {
          allowed,
          blocked
        } = filterMcpServersByPolicy(scopedConfigs);
        if (blocked.length > 0) {
          process.stderr.write(`Warning: MCP ${plural(blocked.length, 'server')} blocked by enterprise policy: ${blocked.join(', ')}\n`);
        }
        dynamicMcpConfig = {
          ...dynamicMcpConfig,
          ...allowed
        };
      }
    }

    // Extract Claude in Chrome option and enforce claude.ai subscriber check (unless user is ant)
    const chromeOpts = options as {
      chrome?: boolean;
    };
    // Store the explicit CLI flag so teammates can inherit it
    setChromeFlagOverride(chromeOpts.chrome);
    const enableClaudeInChrome = shouldEnableClaudeInChrome(chromeOpts.chrome) && ("external" === 'ant' || isClaudeAISubscriber());
    const autoEnableClaudeInChrome = !enableClaudeInChrome && shouldAutoEnableClaudeInChrome();
    if (enableClaudeInChrome) {
      const platform = getPlatform();
      try {
        logEvent('tengu_claude_in_chrome_setup', {
          platform: platform as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        const {
          mcpConfig: chromeMcpConfig,
          allowedTools: chromeMcpTools,
          systemPrompt: chromeSystemPrompt
        } = setupClaudeInChrome();
        dynamicMcpConfig = {
          ...dynamicMcpConfig,
          ...chromeMcpConfig
        };
        allowedTools.push(...chromeMcpTools);
        if (chromeSystemPrompt) {
          appendSystemPrompt = appendSystemPrompt ? `${chromeSystemPrompt}\n\n${appendSystemPrompt}` : chromeSystemPrompt;
        }
      } catch (error) {
        logEvent('tengu_claude_in_chrome_setup_failed', {
          platform: platform as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        logForDebugging(`[Claude in Chrome] Error: ${error}`);
        logError(error);
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.error(`Error: Failed to run with Claude in Chrome.`);
        process.exit(1);
      }
    } else if (autoEnableClaudeInChrome) {
      try {
        const {
          mcpConfig: chromeMcpConfig
        } = setupClaudeInChrome();
        dynamicMcpConfig = {
          ...dynamicMcpConfig,
          ...chromeMcpConfig
        };
        const hint = feature('WEB_BROWSER_TOOL') && typeof Bun !== 'undefined' && 'WebView' in Bun ? CLAUDE_IN_CHROME_SKILL_HINT_WITH_WEBBROWSER : CLAUDE_IN_CHROME_SKILL_HINT;
        appendSystemPrompt = appendSystemPrompt ? `${appendSystemPrompt}\n\n${hint}` : hint;
      } catch (error) {
        // Silently skip any errors for the auto-enable
        logForDebugging(`[Claude in Chrome] Error (auto-enable): ${error}`);
      }
    }

    // Extract strict MCP config flag
    const strictMcpConfig = options.strictMcpConfig || false;

    // Check if enterprise MCP configuration exists. When it does, only allow dynamic MCP
    // configs that contain special server types (sdk)
    if (doesEnterpriseMcpConfigExist()) {
      if (strictMcpConfig) {
        process.stderr.write(chalk.red('You cannot use --strict-mcp-config when an enterprise MCP config is present'));
        process.exit(1);
      }

      // For --mcp-config, allow if all servers are internal types (sdk)
      if (dynamicMcpConfig && !areMcpConfigsAllowedWithEnterpriseMcpConfig(dynamicMcpConfig)) {
        process.stderr.write(chalk.red('You cannot dynamically configure MCP servers when an enterprise MCP config is present'));
        process.exit(1);
      }
    }

    // chicago MCP: guarded Computer Use (app allowlist + frontmost gate +
    // SCContentFilter screenshots). Ant-only, GrowthBook-gated — failures
    // are silent (this is dogfooding). Platform + interactive checks inline
    // so non-macOS / print-mode ants skip the heavy @ant/computer-use-mcp
    // import entirely. gates.js is light (type-only package import).
    //
    // Placed AFTER the enterprise-MCP-config check: that check rejects any
    // dynamicMcpConfig entry with `type !== 'sdk'`, and our config is
    // `type: 'stdio'`. An enterprise-config ant with the GB gate on would
    // otherwise process.exit(1). Chrome has the same latent issue but has
    // shipped without incident; chicago places itself correctly.
    if (feature('CHICAGO_MCP') && getPlatform() === 'macos' && !getIsNonInteractiveSession()) {
      try {
        const {
          getChicagoEnabled
        } = await import('src/utils/computerUse/gates.js');
        if (getChicagoEnabled()) {
          const {
            setupComputerUseMCP
          } = await import('src/utils/computerUse/setup.js');
          const {
            mcpConfig,
            allowedTools: cuTools
          } = setupComputerUseMCP();
          dynamicMcpConfig = {
            ...dynamicMcpConfig,
            ...mcpConfig
          };
          allowedTools.push(...cuTools);
        }
      } catch (error) {
        logForDebugging(`[Computer Use MCP] Setup failed: ${errorMessage(error)}`);
      }
    }

    // Store additional directories for CLAUDE.md loading (controlled by env var)
    setAdditionalDirectoriesForClaudeMd(addDir);

    // Channel server allowlist from --channels flag — servers whose
    // inbound push notifications should register this session. The option
    // is added inside a feature() block so TS doesn't know about it
    // on the options type — same pattern as --assistant at main.tsx:1824.
    // devChannels is deferred: showSetupScreens shows a confirmation dialog
    // and only appends to allowedChannels on accept.
    let devChannels: ChannelEntry[] | undefined;
    if (feature('KAIROS') || feature('KAIROS_CHANNELS')) {
      // Parse plugin:name@marketplace / server:Y tags into typed entries.
      // Tag decides trust model downstream: plugin-kind hits marketplace
      // verification + GrowthBook allowlist, server-kind always fails
      // allowlist (schema is plugin-only) unless dev flag is set.
      // Untagged or marketplace-less plugin entries are hard errors —
      // silently not-matching in the gate would look like channels are
      // "on" but nothing ever fires.
      const parseChannelEntries = (raw: string[], flag: string): ChannelEntry[] => {
        const entries: ChannelEntry[] = [];
        const bad: string[] = [];
        for (const c of raw) {
          if (c.startsWith('plugin:')) {
            const rest = c.slice(7);
            const at = rest.indexOf('@');
            if (at <= 0 || at === rest.length - 1) {
              bad.push(c);
            } else {
              entries.push({
                kind: 'plugin',
                name: rest.slice(0, at),
                marketplace: rest.slice(at + 1)
              });
            }
          } else if (c.startsWith('server:') && c.length > 7) {
            entries.push({
              kind: 'server',
              name: c.slice(7)
            });
          } else {
            bad.push(c);
          }
        }
        if (bad.length > 0) {
          process.stderr.write(chalk.red(`${flag} entries must be tagged: ${bad.join(', ')}\n` + `  plugin:<name>@<marketplace>  — plugin-provided channel (allowlist enforced)\n` + `  server:<name>                — manually configured MCP server\n`));
          process.exit(1);
        }
        return entries;
      };
      const channelOpts = options as {
        channels?: string[];
        dangerouslyLoadDevelopmentChannels?: string[];
      };
      const rawChannels = channelOpts.channels;
      const rawDev = channelOpts.dangerouslyLoadDevelopmentChannels;
      // Always parse + set. ChannelsNotice reads getAllowedChannels() and
      // renders the appropriate branch (disabled/noAuth/policyBlocked/
      // listening) in the startup screen. gateChannelServer() enforces.
      // --channels works in both interactive and print/SDK modes; dev-channels
      // stays interactive-only (requires a confirmation dialog).
      let channelEntries: ChannelEntry[] = [];
      if (rawChannels && rawChannels.length > 0) {
        channelEntries = parseChannelEntries(rawChannels, '--channels');
        setAllowedChannels(channelEntries);
      }
      if (!isNonInteractiveSession) {
        if (rawDev && rawDev.length > 0) {
          devChannels = parseChannelEntries(rawDev, '--dangerously-load-development-channels');
        }
      }
      // Flag-usage telemetry. Plugin identifiers are logged (same tier as
      // tengu_plugin_installed — public-registry-style names); server-kind
      // names are not (MCP-server-name tier, opt-in-only elsewhere).
      // Per-server gate outcomes land in tengu_mcp_channel_gate once
      // servers connect. Dev entries go through a confirmation dialog after
      // this — dev_plugins captures what was typed, not what was accepted.
      if (channelEntries.length > 0 || (devChannels?.length ?? 0) > 0) {
        const joinPluginIds = (entries: ChannelEntry[]) => {
          const ids = entries.flatMap(e => e.kind === 'plugin' ? [`${e.name}@${e.marketplace}`] : []);
          return ids.length > 0 ? ids.sort().join(',') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS : undefined;
        };
        logEvent('tengu_mcp_channel_flags', {
          channels_count: channelEntries.length,
          dev_count: devChannels?.length ?? 0,
          plugins: joinPluginIds(channelEntries),
          dev_plugins: joinPluginIds(devChannels ?? [])
        });
      }
    }

    // SDK opt-in for SendUserMessage via --tools. All sessions require
    // explicit opt-in; listing it in --tools signals intent. Runs BEFORE
    // initializeToolPermissionContext so getToolsForDefaultPreset() sees
    // the tool as enabled when computing the base-tools disallow filter.
    // Conditional require avoids leaking the tool-name string into
    // external builds.
    if ((feature('KAIROS') || feature('KAIROS_BRIEF')) && baseTools.length > 0) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const {
        BRIEF_TOOL_NAME,
        LEGACY_BRIEF_TOOL_NAME
      } = require('./tools/BriefTool/prompt.js') as typeof import('./tools/BriefTool/prompt.js');
      const {
        isBriefEntitled
      } = require('./tools/BriefTool/BriefTool.js') as typeof import('./tools/BriefTool/BriefTool.js');
      /* eslint-enable @typescript-eslint/no-require-imports */
      const parsed = parseToolListFromCLI(baseTools);
      if ((parsed.includes(BRIEF_TOOL_NAME) || parsed.includes(LEGACY_BRIEF_TOOL_NAME)) && isBriefEntitled()) {
        setUserMsgOptIn(true);
      }
    }

    // This await replaces blocking existsSync/statSync calls that were already in
    // the startup path. Wall-clock time is unchanged; we just yield to the event
    // loop during the fs I/O instead of blocking it. See #19661.
    const initResult = await initializeToolPermissionContext({
      allowedToolsCli: allowedTools,
      disallowedToolsCli: disallowedTools,
      baseToolsCli: baseTools,
      permissionMode,
      allowDangerouslySkipPermissions,
      addDirs: addDir
    });
    let toolPermissionContext = initResult.toolPermissionContext;
    const {
      warnings,
      dangerousPermissions,
      overlyBroadBashPermissions
    } = initResult;

    // Handle overly broad shell allow rules for ant users (Bash(*), PowerShell(*))
    if ("external" === 'ant' && overlyBroadBashPermissions.length > 0) {
      for (const permission of overlyBroadBashPermissions) {
        logForDebugging(`Ignoring overly broad shell permission ${permission.ruleDisplay} from ${permission.sourceDisplay}`);
      }
      toolPermissionContext = removeDangerousPermissions(toolPermissionContext, overlyBroadBashPermissions);
    }
    if (feature('TRANSCRIPT_CLASSIFIER') && dangerousPermissions.length > 0) {
      toolPermissionContext = stripDangerousPermissionsForAutoMode(toolPermissionContext);
    }

    // Print any warnings from initialization
    warnings.forEach(warning => {
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.error(warning);
    });
    void assertMinVersion();

    // claude.ai config fetch: -p mode only (interactive uses useManageMCPConnections
    // two-phase loading). Kicked off here to overlap with setup(); awaited
    // before runHeadless so single-turn -p sees connectors. Skipped under
    // enterprise/strict MCP to preserve policy boundaries.
    const claudeaiConfigPromise: Promise<Record<string, ScopedMcpServerConfig>> = isNonInteractiveSession && !strictMcpConfig && !doesEnterpriseMcpConfigExist() &&
    // --bare / SIMPLE: skip claude.ai proxy servers (datadog, Gmail,
    // Slack, BigQuery, PubMed — 6-14s each to connect). Scripted calls
    // that need MCP pass --mcp-config explicitly.
    !isBareMode() ? fetchClaudeAIMcpConfigsIfEligible().then(configs => {
      const {
        allowed,
        blocked
      } = filterMcpServersByPolicy(configs);
      if (blocked.length > 0) {
        process.stderr.write(`Warning: claude.ai MCP ${plural(blocked.length, 'server')} blocked by enterprise policy: ${blocked.join(', ')}\n`);
      }
      return allowed;
    }) : Promise.resolve({});

    // Kick off MCP config loading early (safe - just reads files, no execution).
    // Both interactive and -p use getClaudeCodeMcpConfigs (local file reads only).
    // The local promise is awaited later (before prefetchAllMcpResources) to
    // overlap config I/O with setup(), commands loading, and trust dialog.
    logForDebugging('[STARTUP] Loading MCP configs...');
    const mcpConfigStart = Date.now();
    let mcpConfigResolvedMs: number | undefined;
    // --bare skips auto-discovered MCP (.mcp.json, user settings, plugins) —
    // only explicit --mcp-config works. dynamicMcpConfig is spread onto
    // allMcpConfigs downstream so it survives this skip.
    const mcpConfigPromise = (strictMcpConfig || isBareMode() ? Promise.resolve({
      servers: {} as Record<string, ScopedMcpServerConfig>
    }) : getClaudeCodeMcpConfigs(dynamicMcpConfig)).then(result => {
      mcpConfigResolvedMs = Date.now() - mcpConfigStart;
      return result;
    });

    // NOTE: We do NOT call prefetchAllMcpResources here - that's deferred until after trust dialog

    if (inputFormat && inputFormat !== 'text' && inputFormat !== 'stream-json') {
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.error(`Error: Invalid input format "${inputFormat}".`);
      process.exit(1);
    }
    if (inputFormat === 'stream-json' && outputFormat !== 'stream-json') {
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.error(`Error: --input-format=stream-json requires output-format=stream-json.`);
      process.exit(1);
    }

    // Validate sdkUrl is only used with appropriate formats (formats are auto-set above)
    if (sdkUrl) {
      if (inputFormat !== 'stream-json' || outputFormat !== 'stream-json') {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.error(`Error: --sdk-url requires both --input-format=stream-json and --output-format=stream-json.`);
        process.exit(1);
      }
    }

    // Validate replayUserMessages is only used with stream-json formats
    if (options.replayUserMessages) {
      if (inputFormat !== 'stream-json' || outputFormat !== 'stream-json') {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.error(`Error: --replay-user-messages requires both --input-format=stream-json and --output-format=stream-json.`);
        process.exit(1);
      }
    }

    // Validate includePartialMessages is only used with print mode and stream-json output
    if (effectiveIncludePartialMessages) {
      if (!isNonInteractiveSession || outputFormat !== 'stream-json') {
        writeToStderr(`Error: --include-partial-messages requires --print and --output-format=stream-json.`);
        process.exit(1);
      }
    }

    // Validate --no-session-persistence is only used with print mode
    if (options.sessionPersistence === false && !isNonInteractiveSession) {
      writeToStderr(`Error: --no-session-persistence can only be used with --print mode.`);
      process.exit(1);
    }
    const effectivePrompt = prompt || '';
    let inputPrompt = await getInputPrompt(effectivePrompt, (inputFormat ?? 'text') as 'text' | 'stream-json');
    profileCheckpoint('action_after_input_prompt');

    // Activate proactive mode BEFORE getTools() so SleepTool.isEnabled()
    // (which returns isProactiveActive()) passes and Sleep is included.
    // The later REPL-path maybeActivateProactive() calls are idempotent.
    maybeActivateProactive(options);
    let tools = getTools(toolPermissionContext);

    // Apply coordinator mode tool filtering for headless path
    // (mirrors useMergedTools.ts filtering for REPL/interactive path)
    if (feature('COORDINATOR_MODE') && isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE)) {
      const {
        applyCoordinatorToolFilter
      } = await import('./utils/toolPool.js');
      tools = applyCoordinatorToolFilter(tools);
    }
    profileCheckpoint('action_tools_loaded');
    let jsonSchema: ToolInputJSONSchema | undefined;
    if (isSyntheticOutputToolEnabled({
      isNonInteractiveSession
    }) && options.jsonSchema) {
      jsonSchema = jsonParse(options.jsonSchema) as ToolInputJSONSchema;
    }
    if (jsonSchema) {
      const syntheticOutputResult = createSyntheticOutputTool(jsonSchema);
      if ('tool' in syntheticOutputResult) {
        // Add SyntheticOutputTool to the tools array AFTER getTools() filtering.
        // This tool is excluded from normal filtering (see tools.ts) because it's
        // an implementation detail for structured output, not a user-controlled tool.
        tools = [...tools, syntheticOutputResult.tool];
        logEvent('tengu_structured_output_enabled', {
          schema_property_count: Object.keys(jsonSchema.properties as Record<string, unknown> || {}).length as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          has_required_fields: Boolean(jsonSchema.required) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      } else {
        logEvent('tengu_structured_output_failure', {
          error: 'Invalid JSON schema' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }
    }

    // IMPORTANT: setup() must be called before any other code that depends on the cwd or worktree setup
    profileCheckpoint('action_before_setup');
    logForDebugging('[STARTUP] Running setup()...');
    const setupStart = Date.now();
    const {
      setup
    } = await import('./setup.js');
    const messagingSocketPath = feature('UDS_INBOX') ? (options as {
      messagingSocketPath?: string;
    }).messagingSocketPath : undefined;
    // Parallelize setup() with commands+agents loading. setup()'s ~28ms is
    // mostly startUdsMessaging (socket bind, ~20ms) — not disk-bound, so it
    // doesn't contend with getCommands' file reads. Gated on !worktreeEnabled
    // since --worktree makes setup() process.chdir() (setup.ts:203), and
    // commands/agents need the post-chdir cwd.
    const preSetupCwd = getCwd();
    // Register bundled skills/plugins before kicking getCommands() — they're
    // pure in-memory array pushes (<1ms, zero I/O) that getBundledSkills()
    // reads synchronously. Previously ran inside setup() after ~20ms of
    // await points, so the parallel getCommands() memoized an empty list.
    if (process.env.CLAUDE_CODE_ENTRYPOINT !== 'local-agent') {
      initBuiltinPlugins();
      initBundledSkills();
    }
    const setupPromise = setup(preSetupCwd, permissionMode, allowDangerouslySkipPermissions, worktreeEnabled, worktreeName, tmuxEnabled, sessionId ? validateUuid(sessionId) : undefined, worktreePRNumber, messagingSocketPath);
    const commandsPromise = worktreeEnabled ? null : getCommands(preSetupCwd);
    const agentDefsPromise = worktreeEnabled ? null : getAgentDefinitionsWithOverrides(preSetupCwd);
    // Suppress transient unhandledRejection if these reject during the
    // ~28ms setupPromise await before Promise.all joins them below.
    commandsPromise?.catch(() => {});
    agentDefsPromise?.catch(() => {});
    await setupPromise;
    logForDebugging(`[STARTUP] setup() completed in ${Date.now() - setupStart}ms`);
    profileCheckpoint('action_after_setup');

    // Replay user messages into stream-json only when the socket was
    // explicitly requested. The auto-generated socket is passive — it
    // lets tools inject if they want to, but turning it on by default
    // shouldn't reshape stream-json for SDK consumers who never touch it.
    // Callers who inject and also want those injections visible in the
    // stream pass --messaging-socket-path explicitly (or --replay-user-messages).
    let effectiveReplayUserMessages = !!options.replayUserMessages;
    if (feature('UDS_INBOX')) {
      if (!effectiveReplayUserMessages && outputFormat === 'stream-json') {
        effectiveReplayUserMessages = !!(options as {
          messagingSocketPath?: string;
        }).messagingSocketPath;
      }
    }
    if (getIsNonInteractiveSession()) {
      // Apply full merged settings env now (including project-scoped
      // .claude/settings.json PATH/GIT_DIR/GIT_WORK_TREE) so gitExe() and
      // the git spawn below see it. Trust is implicit in -p mode; the
      // docstring at managedEnv.ts:96-97 says this applies "potentially
      // dangerous environment variables such as LD_PRELOAD, PATH" from all
      // sources. The later call in the isNonInteractiveSession block below
      // is idempotent (Object.assign, configureGlobalAgents ejects prior
      // interceptor) and picks up any plugin-contributed env after plugin
      // init. Project settings are already loaded here:
      // applySafeConfigEnvironmentVariables in init() called
      // getSettings_DEPRECATED at managedEnv.ts:86 which merges all enabled
      // sources including projectSettings/localSettings.
      applyConfigEnvironmentVariables();

      // Spawn git status/log/branch now so the subprocess execution overlaps
      // with the getCommands await below and startDeferredPrefetches. After
      // setup() so cwd is final (setup.ts:254 may process.chdir(worktreePath)
      // for --worktree) and after the applyConfigEnvironmentVariables above
      // so PATH/GIT_DIR/GIT_WORK_TREE from all sources (trusted + project)
      // are applied. getSystemContext is memoized; the
      // prefetchSystemContextIfSafe call in startDeferredPrefetches becomes
      // a cache hit. The microtask from await getIsGit() drains at the
      // getCommands Promise.all await below. Trust is implicit in -p mode
      // (same gate as prefetchSystemContextIfSafe).
      void getSystemContext();
      // Kick getUserContext now too — its first await (fs.readFile in
      // getMemoryFiles) yields naturally, so the CLAUDE.md directory walk
      // runs during the ~280ms overlap window before the context
      // Promise.all join in print.ts. The void getUserContext() in
      // startDeferredPrefetches becomes a memoize cache-hit.
      void getUserContext();
      // Kick ensureModelStringsInitialized now — for Bedrock this triggers
      // a 100-200ms profile fetch that was awaited serially at
      // print.ts:739. updateBedrockModelStrings is sequential()-wrapped so
      // the await joins the in-flight fetch. Non-Bedrock is a sync
      // early-return (zero-cost).
      void ensureModelStringsInitialized();
    }

    // Apply --name: cache-only so no orphan file is created before the
    // session ID is finalized by --continue/--resume. materializeSessionFile
    // persists it on the first user message; REPL's useTerminalTitle reads it
    // via getCurrentSessionTitle.
    const sessionNameArg = options.name?.trim();
    if (sessionNameArg) {
      cacheSessionTitle(sessionNameArg);
    }

    // Ant model aliases (capybara-fast etc.) resolve via the
    // tengu_ant_model_override GrowthBook flag. _CACHED_MAY_BE_STALE reads
    // disk synchronously; disk is populated by a fire-and-forget write. On a
    // cold cache, parseUserSpecifiedModel returns the unresolved alias, the
    // API 404s, and -p exits before the async write lands — crashloop on
    // fresh pods. Awaiting init here populates the in-memory payload map that
    // _CACHED_MAY_BE_STALE now checks first. Gated so the warm path stays
    // non-blocking:
    //  - explicit model via --model or ANTHROPIC_MODEL (both feed alias resolution)
    //  - no env override (which short-circuits _CACHED_MAY_BE_STALE before disk)
    //  - flag absent from disk (== null also catches pre-#22279 poisoned null)
    const explicitModel = options.model || process.env.ANTHROPIC_MODEL;
    if ("external" === 'ant' && explicitModel && explicitModel !== 'default' && !hasGrowthBookEnvOverride('tengu_ant_model_override') && getGlobalConfig().cachedGrowthBookFeatures?.['tengu_ant_model_override'] == null) {
      await initializeGrowthBook();
    }

    // Special case the default model with the null keyword
    // NOTE: Model resolution happens after setup() to ensure trust is established before AWS auth
    const userSpecifiedModel = options.model === 'default' ? getDefaultMainLoopModel() : options.model;
    const userSpecifiedFallbackModel = fallbackModel === 'default' ? getDefaultMainLoopModel() : fallbackModel;

    // Reuse preSetupCwd unless setup() chdir'd (worktreeEnabled). Saves a
    // getCwd() syscall in the common path.
    const currentCwd = worktreeEnabled ? getCwd() : preSetupCwd;
    logForDebugging('[STARTUP] Loading commands and agents...');
    const commandsStart = Date.now();
    // Join the promises kicked before setup() (or start fresh if
    // worktreeEnabled gated the early kick). Both memoized by cwd.
    const [commands, agentDefinitionsResult] = await Promise.all([commandsPromise ?? getCommands(currentCwd), agentDefsPromise ?? getAgentDefinitionsWithOverrides(currentCwd)]);
    logForDebugging(`[STARTUP] Commands and agents loaded in ${Date.now() - commandsStart}ms`);
    profileCheckpoint('action_commands_loaded');

    // Parse CLI agents if provided via --agents flag
    let cliAgents: typeof agentDefinitionsResult.activeAgents = [];
    if (agentsJson) {
      try {
        const parsedAgents = safeParseJSON(agentsJson);
        if (parsedAgents) {
          cliAgents = parseAgentsFromJson(parsedAgents, 'flagSettings');
        }
      } catch (error) {
        logError(error);
      }
    }

    // Merge CLI agents with existing ones
    const allAgents = [...agentDefinitionsResult.allAgents, ...cliAgents];
    const agentDefinitions = {
      ...agentDefinitionsResult,
      allAgents,
      activeAgents: getActiveAgentsFromList(allAgents)
    };

    // Look up main thread agent from CLI flag or settings
    const agentSetting = agentCli ?? getInitialSettings().agent;
    let mainThreadAgentDefinition: (typeof agentDefinitions.activeAgents)[number] | undefined;
    if (agentSetting) {
      mainThreadAgentDefinition = agentDefinitions.activeAgents.find(agent => agent.agentType === agentSetting);
      if (!mainThreadAgentDefinition) {
        logForDebugging(`Warning: agent "${agentSetting}" not found. ` + `Available agents: ${agentDefinitions.activeAgents.map(a => a.agentType).join(', ')}. ` + `Using default behavior.`);
      }
    }

    // Store the main thread agent type in bootstrap state so hooks can access it
    setMainThreadAgentType(mainThreadAgentDefinition?.agentType);

    // Log agent flag usage — only log agent name for built-in agents to avoid leaking custom agent names
    if (mainThreadAgentDefinition) {
      logEvent('tengu_agent_flag', {
        agentType: isBuiltInAgent(mainThreadAgentDefinition) ? mainThreadAgentDefinition.agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS : 'custom' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        ...(agentCli && {
          source: 'cli' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        })
      });
    }

    // Persist agent setting to session transcript for resume view display and restoration
    if (mainThreadAgentDefinition?.agentType) {
      saveAgentSetting(mainThreadAgentDefinition.agentType);
    }

    // Apply the agent's system prompt for non-interactive sessions
    // (interactive mode uses buildEffectiveSystemPrompt instead)
    if (isNonInteractiveSession && mainThreadAgentDefinition && !systemPrompt && !isBuiltInAgent(mainThreadAgentDefinition)) {
      const agentSystemPrompt = mainThreadAgentDefinition.getSystemPrompt();
      if (agentSystemPrompt) {
        systemPrompt = agentSystemPrompt;
      }
    }

    // initialPrompt goes first so its slash command (if any) is processed;
    // user-provided text becomes trailing context.
    // Only concatenate when inputPrompt is a string. When it's an
    // AsyncIterable (SDK stream-json mode), template interpolation would
    // call .toString() producing "[object Object]". The AsyncIterable case
    // is handled in print.ts via structuredIO.prependUserMessage().
    if (mainThreadAgentDefinition?.initialPrompt) {
      if (typeof inputPrompt === 'string') {
        inputPrompt = inputPrompt ? `${mainThreadAgentDefinition.initialPrompt}\n\n${inputPrompt}` : mainThreadAgentDefinition.initialPrompt;
      } else if (!inputPrompt) {
        inputPrompt = mainThreadAgentDefinition.initialPrompt;
      }
    }

    // Compute effective model early so hooks can run in parallel with MCP
    // If user didn't specify a model but agent has one, use the agent's model
    let effectiveModel = userSpecifiedModel;
    if (!effectiveModel && mainThreadAgentDefinition?.model && mainThreadAgentDefinition.model !== 'inherit') {
      effectiveModel = parseUserSpecifiedModel(mainThreadAgentDefinition.model);
    }
    setMainLoopModelOverride(effectiveModel);

    // Compute resolved model for hooks (use user-specified model at launch)
    setInitialMainLoopModel(getUserSpecifiedModelSetting() || null);
    const initialMainLoopModel = getInitialMainLoopModel();
    const resolvedInitialModel = parseUserSpecifiedModel(initialMainLoopModel ?? getDefaultMainLoopModel());
    let advisorModel: string | undefined;
    if (isAdvisorEnabled()) {
      const advisorOption = canUserConfigureAdvisor() ? (options as {
        advisor?: string;
      }).advisor : undefined;
      if (advisorOption) {
        logForDebugging(`[AdvisorTool] --advisor ${advisorOption}`);
        if (!modelSupportsAdvisor(resolvedInitialModel)) {
          process.stderr.write(chalk.red(`Error: The model "${resolvedInitialModel}" does not support the advisor tool.\n`));
          process.exit(1);
        }
        const normalizedAdvisorModel = normalizeModelStringForAPI(parseUserSpecifiedModel(advisorOption));
        if (!isValidAdvisorModel(normalizedAdvisorModel)) {
          process.stderr.write(chalk.red(`Error: The model "${advisorOption}" cannot be used as an advisor.\n`));
          process.exit(1);
        }
      }
      advisorModel = canUserConfigureAdvisor() ? advisorOption ?? getInitialAdvisorSetting() : advisorOption;
      if (advisorModel) {
        logForDebugging(`[AdvisorTool] Advisor model: ${advisorModel}`);
      }
    }

    // For tmux teammates with --agent-type, append the custom agent's prompt
    if (isAgentSwarmsEnabled() && storedTeammateOpts?.agentId && storedTeammateOpts?.agentName && storedTeammateOpts?.teamName && storedTeammateOpts?.agentType) {
      // Look up the custom agent definition
      const customAgent = agentDefinitions.activeAgents.find(a => a.agentType === storedTeammateOpts.agentType);
      if (customAgent) {
        // Get the prompt - need to handle both built-in and custom agents
        let customPrompt: string | undefined;
        if (customAgent.source === 'built-in') {
          // Built-in agents have getSystemPrompt that takes toolUseContext
          // We can't access full toolUseContext here, so skip for now
          logForDebugging(`[teammate] Built-in agent ${storedTeammateOpts.agentType} - skipping custom prompt (not supported)`);
        } else {
          // Custom agents have getSystemPrompt that takes no args
          customPrompt = customAgent.getSystemPrompt();
        }

        // Log agent memory loaded event for tmux teammates
        if (customAgent.memory) {
          logEvent('tengu_agent_memory_loaded', {
            ...("external" === 'ant' && {
              agent_type: customAgent.agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
            }),
            scope: customAgent.memory as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            source: 'teammate' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
        }
        if (customPrompt) {
          const customInstructions = `\n# Custom Agent Instructions\n${customPrompt}`;
          appendSystemPrompt = appendSystemPrompt ? `${appendSystemPrompt}\n\n${customInstructions}` : customInstructions;
        }
      } else {
        logForDebugging(`[teammate] Custom agent ${storedTeammateOpts.agentType} not found in available agents`);
      }
    }
    maybeActivateBrief(options);
    // defaultView: 'chat' is a persisted opt-in — check entitlement and set
    // userMsgOptIn so the tool + prompt section activate. Interactive-only:
    // defaultView is a display preference; SDK sessions have no display, and
    // the assistant installer writes defaultView:'chat' to settings.local.json
    // which would otherwise leak into --print sessions in the same directory.
    // Runs right after maybeActivateBrief() so all startup opt-in paths fire
    // BEFORE any isBriefEnabled() read below (proactive prompt's
    // briefVisibility). A persisted 'chat' after a GB kill-switch falls
    // through (entitlement fails).
    if ((feature('KAIROS') || feature('KAIROS_BRIEF')) && !getIsNonInteractiveSession() && !getUserMsgOptIn() && getInitialSettings().defaultView === 'chat') {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const {
        isBriefEntitled
      } = require('./tools/BriefTool/BriefTool.js') as typeof import('./tools/BriefTool/BriefTool.js');
      /* eslint-enable @typescript-eslint/no-require-imports */
      if (isBriefEntitled()) {
        setUserMsgOptIn(true);
      }
    }
    // Coordinator mode has its own system prompt and filters out Sleep, so
    // the generic proactive prompt would tell it to call a tool it can't
    // access and conflict with delegation instructions.
    if ((feature('PROACTIVE') || feature('KAIROS')) && ((options as {
      proactive?: boolean;
    }).proactive || isEnvTruthy(process.env.CLAUDE_CODE_PROACTIVE)) && !coordinatorModeModule?.isCoordinatorMode()) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const briefVisibility = feature('KAIROS') || feature('KAIROS_BRIEF') ? (require('./tools/BriefTool/BriefTool.js') as typeof import('./tools/BriefTool/BriefTool.js')).isBriefEnabled() ? 'Call SendUserMessage at checkpoints to mark where things stand.' : 'The user will see any text you output.' : 'The user will see any text you output.';
      /* eslint-enable @typescript-eslint/no-require-imports */
      const proactivePrompt = `\n# Proactive Mode\n\nYou are in proactive mode. Take initiative — explore, act, and make progress without waiting for instructions.\n\nStart by briefly greeting the user.\n\nYou will receive periodic <tick> prompts. These are check-ins. Do whatever seems most useful, or call Sleep if there's nothing to do. ${briefVisibility}`;
      appendSystemPrompt = appendSystemPrompt ? `${appendSystemPrompt}\n\n${proactivePrompt}` : proactivePrompt;
    }
    if (feature('KAIROS') && kairosEnabled && assistantModule) {
      const assistantAddendum = assistantModule.getAssistantSystemPromptAddendum();
      appendSystemPrompt = appendSystemPrompt ? `${appendSystemPrompt}\n\n${assistantAddendum}` : assistantAddendum;
    }

    // Ink root is only needed for interactive sessions — patchConsole in the
    // Ink constructor would swallow console output in headless mode.
    let root!: Root;
    let getFpsMetrics!: () => FpsMetrics | undefined;
    let stats!: StatsStore;

    // Show setup screens after commands are loaded
    if (!isNonInteractiveSession) {
      const ctx = getRenderContext(false);
      getFpsMetrics = ctx.getFpsMetrics;
      stats = ctx.stats;
      // Install asciicast recorder before Ink mounts (ant-only, opt-in via CLAUDE_CODE_TERMINAL_RECORDING=1)
      if ("external" === 'ant') {
        installAsciicastRecorder();
      }
      const {
        createRoot
      } = await import('./ink.js');
      root = await createRoot(ctx.renderOptions);

      // Log startup time now, before any blocking dialog renders. Logging
      // from REPL's first render (the old location) included however long
      // the user sat on trust/OAuth/onboarding/resume-picker — p99 was ~70s
      // dominated by dialog-wait time, not code-path startup.
      logEvent('tengu_timer', {
        event: 'startup' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        durationMs: Math.round(process.uptime() * 1000)
      });
      logForDebugging('[STARTUP] Running showSetupScreens()...');
      const setupScreensStart = Date.now();
      const onboardingShown = await showSetupScreens(root, permissionMode, allowDangerouslySkipPermissions, commands, enableClaudeInChrome, devChannels);
      logForDebugging(`[STARTUP] showSetupScreens() completed in ${Date.now() - setupScreensStart}ms`);

      // Now that trust is established and GrowthBook has auth headers,
      // resolve the --remote-control / --rc entitlement gate.
      if (feature('BRIDGE_MODE') && remoteControlOption !== undefined) {
        const {
          getBridgeDisabledReason
        } = await import('./bridge/bridgeEnabled.js');
        const disabledReason = await getBridgeDisabledReason();
        remoteControl = disabledReason === null;
        if (disabledReason) {
          process.stderr.write(chalk.yellow(`${disabledReason}\n--rc flag ignored.\n`));
        }
      }

      // Check for pending agent memory snapshot updates (only for --agent mode, ant-only)
      if (feature('AGENT_MEMORY_SNAPSHOT') && mainThreadAgentDefinition && isCustomAgent(mainThreadAgentDefinition) && mainThreadAgentDefinition.memory && mainThreadAgentDefinition.pendingSnapshotUpdate) {
        const agentDef = mainThreadAgentDefinition;
        const choice = await launchSnapshotUpdateDialog(root, {
          agentType: agentDef.agentType,
          scope: agentDef.memory!,
          snapshotTimestamp: agentDef.pendingSnapshotUpdate!.snapshotTimestamp
        });
        if (choice === 'merge') {
          const {
            buildMergePrompt
          } = await import('./components/agents/SnapshotUpdateDialog.js');
          const mergePrompt = buildMergePrompt(agentDef.agentType, agentDef.memory!);
          inputPrompt = inputPrompt ? `${mergePrompt}\n\n${inputPrompt}` : mergePrompt;
        }
        agentDef.pendingSnapshotUpdate = undefined;
      }

      // Skip executing /login if we just completed onboarding for it
      if (onboardingShown && prompt?.trim().toLowerCase() === '/login') {
        prompt = '';
      }
      if (onboardingShown) {
        // Refresh auth-dependent services now that the user has logged in during onboarding.
        // Keep in sync with the post-login logic in src/commands/login.tsx
        void refreshRemoteManagedSettings();
        void refreshPolicyLimits();
        // Clear user data cache BEFORE GrowthBook refresh so it picks up fresh credentials
        resetUserCache();
        // Refresh GrowthBook after login to get updated feature flags (e.g., for claude.ai MCPs)
        refreshGrowthBookAfterAuthChange();
        // Clear any stale trusted device token then enroll for Remote Control.
        // Both self-gate on tengu_sessions_elevated_auth_enforcement internally
        // — enrollTrustedDevice() via checkGate_CACHED_OR_BLOCKING (awaits
        // the GrowthBook reinit above), clearTrustedDeviceToken() via the
        // sync cached check (acceptable since clear is idempotent).
        void import('./bridge/trustedDevice.js').then(m => {
          m.clearTrustedDeviceToken();
          return m.enrollTrustedDevice();
        });
      }

      // Validate that the active token's org matches forceLoginOrgUUID (if set
      // in managed settings). Runs after onboarding so managed settings and
      // login state are fully loaded.
      const orgValidation = await validateForceLoginOrg();
      if (!orgValidation.valid) {
        await exitWithError(root, orgValidation.message);
      }
    }

    // If gracefulShutdown was initiated (e.g., user rejected trust dialog),
    // process.exitCode will be set. Skip all subsequent operations that could
    // trigger code execution before the process exits (e.g. we don't want apiKeyHelper
    // to run if trust was not established).
    if (process.exitCode !== undefined) {
      logForDebugging('Graceful shutdown initiated, skipping further initialization');
      return;
    }

    // Initialize LSP manager AFTER trust is established (or in non-interactive mode
    // where trust is implicit). This prevents plugin LSP servers from executing
    // code in untrusted directories before user consent.
    // Must be after inline plugins are set (if any) so --plugin-dir LSP servers are included.
    initializeLspServerManager();

    // Show settings validation errors after trust is established
    // MCP config errors don't block settings from loading, so exclude them
    if (!isNonInteractiveSession) {
      const {
        errors
      } = getSettingsWithErrors();
      const nonMcpErrors = errors.filter(e => !e.mcpErrorMetadata);
      if (nonMcpErrors.length > 0) {
        await launchInvalidSettingsDialog(root, {
          settingsErrors: nonMcpErrors,
          onExit: () => gracefulShutdownSync(1)
        });
      }
    }

    // Check quota status, fast mode, passes eligibility, and bootstrap data
    // after trust is established. These make API calls which could trigger
    // apiKeyHelper execution.
    // --bare / SIMPLE: skip — these are cache-warms for the REPL's
    // first-turn responsiveness (quota, passes, fastMode, bootstrap data). Fast
    // mode doesn't apply to the Agent SDK anyway (see getFastModeUnavailableReason).
    const bgRefreshThrottleMs = getFeatureValue_CACHED_MAY_BE_STALE('tengu_cicada_nap_ms', 0);
    const lastPrefetched = getGlobalConfig().startupPrefetchedAt ?? 0;
    const skipStartupPrefetches = isBareMode() || bgRefreshThrottleMs > 0 && Date.now() - lastPrefetched < bgRefreshThrottleMs;
    if (!skipStartupPrefetches) {
      const lastPrefetchedInfo = lastPrefetched > 0 ? ` last ran ${Math.round((Date.now() - lastPrefetched) / 1000)}s ago` : '';
      logForDebugging(`Starting background startup prefetches${lastPrefetchedInfo}`);
      checkQuotaStatus().catch(error => logError(error));

      // Fetch bootstrap data from the server and update all cache values.
      void fetchBootstrapData();

      // TODO: Consolidate other prefetches into a single bootstrap request.
      void prefetchPassesEligibility();
      if (!getFeatureValue_CACHED_MAY_BE_STALE('tengu_miraculo_the_bard', false)) {
        void prefetchFastModeStatus();
      } else {
        // Kill switch skips the network call, not org-policy enforcement.
        // Resolve from cache so orgStatus doesn't stay 'pending' (which
        // getFastModeUnavailableReason treats as permissive).
        resolveFastModeStatusFromCache();
      }
      if (bgRefreshThrottleMs > 0) {
        saveGlobalConfig(current => ({
          ...current,
          startupPrefetchedAt: Date.now()
        }));
      }
    } else {
      logForDebugging(`Skipping startup prefetches, last ran ${Math.round((Date.now() - lastPrefetched) / 1000)}s ago`);
      // Resolve fast mode org status from cache (no network)
      resolveFastModeStatusFromCache();
    }
    if (!isNonInteractiveSession) {
      void refreshExampleCommands(); // Pre-fetch example commands (runs git log, no API call)
    }

    // Resolve MCP configs (started early, overlaps with setup/trust dialog work)
    const {
      servers: existingMcpConfigs
    } = await mcpConfigPromise;
    logForDebugging(`[STARTUP] MCP configs resolved in ${mcpConfigResolvedMs}ms (awaited at +${Date.now() - mcpConfigStart}ms)`);
    // CLI flag (--mcp-config) should override file-based configs, matching settings precedence
    const allMcpConfigs = {
      ...existingMcpConfigs,
      ...dynamicMcpConfig
    };

    // Separate SDK configs from regular MCP configs
    const sdkMcpConfigs: Record<string, McpSdkServerConfig> = {};
    const regularMcpConfigs: Record<string, ScopedMcpServerConfig> = {};
    for (const [name, config] of Object.entries(allMcpConfigs)) {
      const typedConfig = config as ScopedMcpServerConfig | McpSdkServerConfig;
      if (typedConfig.type === 'sdk') {
        sdkMcpConfigs[name] = typedConfig as McpSdkServerConfig;
      } else {
        regularMcpConfigs[name] = typedConfig as ScopedMcpServerConfig;
      }
    }
    profileCheckpoint('action_mcp_configs_loaded');

    // Prefetch MCP resources after trust dialog (this is where execution happens).
    // Interactive mode only: print mode defers connects until headlessStore exists
    // and pushes per-server (below), so ToolSearch's pending-client handling works
    // and one slow server doesn't block the batch.
    const localMcpPromise = isNonInteractiveSession ? Promise.resolve({
      clients: [],
      tools: [],
      commands: []
    }) : prefetchAllMcpResources(regularMcpConfigs);
    const claudeaiMcpPromise = isNonInteractiveSession ? Promise.resolve({
      clients: [],
      tools: [],
      commands: []
    }) : claudeaiConfigPromise.then(configs => Object.keys(configs).length > 0 ? prefetchAllMcpResources(configs) : {
      clients: [],
      tools: [],
      commands: []
    });
    // Merge with dedup by name: each prefetchAllMcpResources call independently
    // adds helper tools (ListMcpResourcesTool, ReadMcpResourceTool) via
    // local dedup flags, so merging two calls can yield duplicates. print.ts
    // already uniqBy's the final tool pool, but dedup here keeps appState clean.
    const mcpPromise = Promise.all([localMcpPromise, claudeaiMcpPromise]).then(([local, claudeai]) => ({
      clients: [...local.clients, ...claudeai.clients],
      tools: uniqBy([...local.tools, ...claudeai.tools], 'name'),
      commands: uniqBy([...local.commands, ...claudeai.commands], 'name')
    }));

    // Start hooks early so they run in parallel with MCP connections.
    // Skip for initOnly/init/maintenance (handled separately), non-interactive
    // (handled via setupTrigger), and resume/continue (conversationRecovery.ts
    // fires 'resume' instead — without this guard, hooks fire TWICE on /resume
    // and the second systemMessage clobbers the first. gh-30825)
    const hooksPromise = initOnly || init || maintenance || isNonInteractiveSession || options.continue || options.resume ? null : processSessionStartHooks('startup', {
      agentType: mainThreadAgentDefinition?.agentType,
      model: resolvedInitialModel
    });

    // MCP never blocks REPL render OR turn 1 TTFT. useManageMCPConnections
    // populates appState.mcp async as servers connect (connectToServer is
    // memoized — the prefetch calls above and the hook converge on the same
    // connections). getToolUseContext reads store.getState() fresh via
    // computeTools(), so turn 1 sees whatever's connected by query time.
    // Slow servers populate for turn 2+. Matches interactive-no-prompt
    // behavior. Print mode: per-server push into headlessStore (below).
    const hookMessages: Awaited<NonNullable<typeof hooksPromise>> = [];
    // Suppress transient unhandledRejection — the prefetch warms the
    // memoized connectToServer cache but nobody awaits it in interactive.
    mcpPromise.catch(() => {});
    const mcpClients: Awaited<typeof mcpPromise>['clients'] = [];
    const mcpTools: Awaited<typeof mcpPromise>['tools'] = [];
    const mcpCommands: Awaited<typeof mcpPromise>['commands'] = [];
    let thinkingEnabled = shouldEnableThinkingByDefault();
    let thinkingConfig: ThinkingConfig = thinkingEnabled !== false ? {
      type: 'adaptive'
    } : {
      type: 'disabled'
    };
    if (options.thinking === 'adaptive' || options.thinking === 'enabled') {
      thinkingEnabled = true;
      thinkingConfig = {
        type: 'adaptive'
      };
    } else if (options.thinking === 'disabled') {
      thinkingEnabled = false;
      thinkingConfig = {
        type: 'disabled'
      };
    } else {
      const maxThinkingTokens = process.env.MAX_THINKING_TOKENS ? parseInt(process.env.MAX_THINKING_TOKENS, 10) : options.maxThinkingTokens;
      if (maxThinkingTokens !== undefined) {
        if (maxThinkingTokens > 0) {
          thinkingEnabled = true;
          thinkingConfig = {
            type: 'enabled',
            budgetTokens: maxThinkingTokens
          };
        } else if (maxThinkingTokens === 0) {
          thinkingEnabled = false;
          thinkingConfig = {
            type: 'disabled'
          };
        }
      }
    }
    logForDiagnosticsNoPII('info', 'started', {
      version: MACRO.VERSION,
      is_native_binary: isInBundledMode()
    });
    registerCleanup(async () => {
      logForDiagnosticsNoPII('info', 'exited');
    });
    void logTenguInit({
      hasInitialPrompt: Boolean(prompt),
      hasStdin: Boolean(inputPrompt),
      verbose,
      debug,
      debugToStderr,
      print: print ?? false,
      outputFormat: outputFormat ?? 'text',
      inputFormat: inputFormat ?? 'text',
      numAllowedTools: allowedTools.length,
      numDisallowedTools: disallowedTools.length,
      mcpClientCount: Object.keys(allMcpConfigs).length,
      worktreeEnabled,
      skipWebFetchPreflight: getInitialSettings().skipWebFetchPreflight,
      githubActionInputs: process.env.GITHUB_ACTION_INPUTS,
      dangerouslySkipPermissionsPassed: dangerouslySkipPermissions ?? false,
      permissionMode,
      modeIsBypass: permissionMode === 'bypassPermissions',
      allowDangerouslySkipPermissionsPassed: allowDangerouslySkipPermissions,
      systemPromptFlag: systemPrompt ? options.systemPromptFile ? 'file' : 'flag' : undefined,
      appendSystemPromptFlag: appendSystemPrompt ? options.appendSystemPromptFile ? 'file' : 'flag' : undefined,
      thinkingConfig,
      assistantActivationPath: feature('KAIROS') && kairosEnabled ? assistantModule?.getAssistantActivationPath() : undefined
    });

    // Log context metrics once at initialization
    void logContextMetrics(regularMcpConfigs, toolPermissionContext);
    void logPermissionContextForAnts(null, 'initialization');
    logManagedSettings();

    // Register PID file for concurrent-session detection (~/.claude/sessions/)
    // and fire multi-clauding telemetry. Lives here (not init.ts) so only the
    // REPL path registers — not subcommands like `claude doctor`. Chained:
    // count must run after register's write completes or it misses our own file.
    void registerSession().then(registered => {
      if (!registered) return;
      if (sessionNameArg) {
        void updateSessionName(sessionNameArg);
      }
      void countConcurrentSessions().then(count => {
        if (count >= 2) {
          logEvent('tengu_concurrent_sessions', {
            num_sessions: count
          });
        }
      });
    });

    // Initialize versioned plugins system (triggers V1→V2 migration if
    // needed). Then run orphan GC, THEN warm the Grep/Glob exclusion cache.
    // Sequencing matters: the warmup scans disk for .orphaned_at markers,
    // so it must see the GC's Pass 1 (remove markers from reinstalled
    // versions) and Pass 2 (stamp unmarked orphans) already applied. The
    // warm also lands before autoupdate (fires on first submit in REPL)
    // can orphan this session's active version underneath us.
    // --bare / SIMPLE: skip plugin version sync + orphan cleanup. These
    // are install/upgrade bookkeeping that scripted calls don't need —
    // the next interactive session will reconcile. The await here was
    // blocking -p on a marketplace round-trip.
    if (isBareMode()) {
      // skip — no-op
    } else if (isNonInteractiveSession) {
      // In headless mode, await to ensure plugin sync completes before CLI exits
      await initializeVersionedPlugins();
      profileCheckpoint('action_after_plugins_init');
      void cleanupOrphanedPluginVersionsInBackground().then(() => getGlobExclusionsForPluginCache());
    } else {
      // In interactive mode, fire-and-forget — this is purely bookkeeping
      // that doesn't affect runtime behavior of the current session
      void initializeVersionedPlugins().then(async () => {
        profileCheckpoint('action_after_plugins_init');
        await cleanupOrphanedPluginVersionsInBackground();
        void getGlobExclusionsForPluginCache();
      });
    }
    const setupTrigger = initOnly || init ? 'init' : maintenance ? 'maintenance' : null;
    if (initOnly) {
      applyConfigEnvironmentVariables();
      await processSetupHooks('init', {
        forceSyncExecution: true
      });
      await processSessionStartHooks('startup', {
        forceSyncExecution: true
      });
      gracefulShutdownSync(0);
      return;
    }

    // --print mode
    if (isNonInteractiveSession) {
      if (outputFormat === 'stream-json' || outputFormat === 'json') {
        setHasFormattedOutput(true);
      }

      // Apply full environment variables in print mode since trust dialog is bypassed
      // This includes potentially dangerous environment variables from untrusted sources
      // but print mode is considered trusted (as documented in help text)
      applyConfigEnvironmentVariables();

      // Initialize telemetry after env vars are applied so OTEL endpoint env vars and
      // otelHeadersHelper (which requires trust to execute) are available.
      initializeTelemetryAfterTrust();

      // Kick SessionStart hooks now so the subprocess spawn overlaps with
      // MCP connect + plugin init + print.ts import below. loadInitialMessages
      // joins this at print.ts:4397. Guarded same as loadInitialMessages —
      // continue/resume/teleport paths don't fire startup hooks (or fire them
      // conditionally inside the resume branch, where this promise is
      // undefined and the ?? fallback runs). Also skip when setupTrigger is
      // set — those paths run setup hooks first (print.ts:544), and session
      // start hooks must wait until setup completes.
      const sessionStartHooksPromise = options.continue || options.resume || teleport || setupTrigger ? undefined : processSessionStartHooks('startup');
      // Suppress transient unhandledRejection if this rejects before
      // loadInitialMessages awaits it. Downstream await still observes the
      // rejection — this just prevents the spurious global handler fire.
      sessionStartHooksPromise?.catch(() => {});
      profileCheckpoint('before_validateForceLoginOrg');
      // Validate org restriction for non-interactive sessions
      const orgValidation = await validateForceLoginOrg();
      if (!orgValidation.valid) {
        process.stderr.write(orgValidation.message + '\n');
        process.exit(1);
      }

      // Headless mode supports all prompt commands and some local commands
      // If disableSlashCommands is true, return empty array
      const commandsHeadless = disableSlashCommands ? [] : commands.filter(command => command.type === 'prompt' && !command.disableNonInteractive || command.type === 'local' && command.supportsNonInteractive);
      const defaultState = getDefaultAppState();
      const headlessInitialState: AppState = {
        ...defaultState,
        mcp: {
          ...defaultState.mcp,
          clients: mcpClients,
          commands: mcpCommands,
          tools: mcpTools
        },
        toolPermissionContext,
        effortValue: parseEffortValue(options.effort) ?? getInitialEffortSetting(),
        ...(isFastModeEnabled() && {
          fastMode: getInitialFastModeSetting(effectiveModel ?? null)
        }),
        ...(isAdvisorEnabled() && advisorModel && {
          advisorModel
        }),
        // kairosEnabled gates the async fire-and-forget path in
        // executeForkedSlashCommand (processSlashCommand.tsx:132) and
        // AgentTool's shouldRunAsync. The REPL initialState sets this at
        // ~3459; headless was defaulting to false, so the daemon child's
        // scheduled tasks and Agent-tool calls ran synchronously — N
        // overdue cron tasks on spawn = N serial subagent turns blocking
        // user input. Computed at :1620, well before this branch.
        ...(feature('KAIROS') ? {
          kairosEnabled
        } : {})
      };

      // Init app state
      const headlessStore = createStore(headlessInitialState, onChangeAppState);

      // Check if bypassPermissions should be disabled based on Statsig gate
      // This runs in parallel to the code below, to avoid blocking the main loop.
      if (toolPermissionContext.mode === 'bypassPermissions' || allowDangerouslySkipPermissions) {
        void checkAndDisableBypassPermissions(toolPermissionContext);
      }

      // Async check of auto mode gate — corrects state and disables auto if needed.
      // Gated on TRANSCRIPT_CLASSIFIER (not USER_TYPE) so GrowthBook kill switch runs for external builds too.
      if (feature('TRANSCRIPT_CLASSIFIER')) {
        void verifyAutoModeGateAccess(toolPermissionContext, headlessStore.getState().fastMode).then(({
          updateContext
        }) => {
          headlessStore.setState(prev => {
            const nextCtx = updateContext(prev.toolPermissionContext);
            if (nextCtx === prev.toolPermissionContext) return prev;
            return {
              ...prev,
              toolPermissionContext: nextCtx
            };
          });
        });
      }

      // Set global state for session persistence
      if (options.sessionPersistence === false) {
        setSessionPersistenceDisabled(true);
      }

      // Store SDK betas in global state for context window calculation
      // Only store allowed betas (filters by allowlist and subscriber status)
      setSdkBetas(filterAllowedSdkBetas(betas));

      // Print-mode MCP: per-server incremental push into headlessStore.
      // Mirrors useManageMCPConnections — push pending first (so ToolSearch's
      // pending-check at ToolSearchTool.ts:334 sees them), then replace with
      // connected/failed as each server settles.
      const connectMcpBatch = (configs: Record<string, ScopedMcpServerConfig>, label: string): Promise<void> => {
        if (Object.keys(configs).length === 0) return Promise.resolve();
        headlessStore.setState(prev => ({
          ...prev,
          mcp: {
            ...prev.mcp,
            clients: [...prev.mcp.clients, ...Object.entries(configs).map(([name, config]) => ({
              name,
              type: 'pending' as const,
              config
            }))]
          }
        }));
        return getMcpToolsCommandsAndResources(({
          client,
          tools,
          commands
        }) => {
          headlessStore.setState(prev => ({
            ...prev,
            mcp: {
              ...prev.mcp,
              clients: prev.mcp.clients.some(c => c.name === client.name) ? prev.mcp.clients.map(c => c.name === client.name ? client : c) : [...prev.mcp.clients, client],
              tools: uniqBy([...prev.mcp.tools, ...tools], 'name'),
              commands: uniqBy([...prev.mcp.commands, ...commands], 'name')
            }
          }));
        }, configs).catch(err => logForDebugging(`[MCP] ${label} connect error: ${err}`));
      };
      // Await all MCP configs — print mode is often single-turn, so
      // "late-connecting servers visible next turn" doesn't help. SDK init
      // message and turn-1 tool list both need configured MCP tools present.
      // Zero-server case is free via the early return in connectMcpBatch.
      // Connectors parallelize inside getMcpToolsCommandsAndResources
      // (processBatched with Promise.all). claude.ai is awaited too — its
      // fetch was kicked off early (line ~2558) so only residual time blocks
      // here. --bare skips claude.ai entirely for perf-sensitive scripts.
      profileCheckpoint('before_connectMcp');
      await connectMcpBatch(regularMcpConfigs, 'regular');
      profileCheckpoint('after_connectMcp');
      // Dedup: suppress plugin MCP servers that duplicate a claude.ai
      // connector (connector wins), then connect claude.ai servers.
      // Bounded wait — #23725 made this blocking so single-turn -p sees
      // connectors, but with 40+ slow connectors tengu_startup_perf p99
      // climbed to 76s. If fetch+connect doesn't finish in time, proceed;
      // the promise keeps running and updates headlessStore in the
      // background so turn 2+ still sees connectors.
      const CLAUDE_AI_MCP_TIMEOUT_MS = 5_000;
      const claudeaiConnect = claudeaiConfigPromise.then(claudeaiConfigs => {
        if (Object.keys(claudeaiConfigs).length > 0) {
          const claudeaiSigs = new Set<string>();
          for (const config of Object.values(claudeaiConfigs)) {
            const sig = getMcpServerSignature(config);
            if (sig) claudeaiSigs.add(sig);
          }
          const suppressed = new Set<string>();
          for (const [name, config] of Object.entries(regularMcpConfigs)) {
            if (!name.startsWith('plugin:')) continue;
            const sig = getMcpServerSignature(config);
            if (sig && claudeaiSigs.has(sig)) suppressed.add(name);
          }
          if (suppressed.size > 0) {
            logForDebugging(`[MCP] Lazy dedup: suppressing ${suppressed.size} plugin server(s) that duplicate claude.ai connectors: ${[...suppressed].join(', ')}`);
            // Disconnect before filtering from state. Only connected
            // servers need cleanup — clearServerCache on a never-connected
            // server triggers a real connect just to kill it (memoize
            // cache-miss path, see useManageMCPConnections.ts:870).
            for (const c of headlessStore.getState().mcp.clients) {
              if (!suppressed.has(c.name) || c.type !== 'connected') continue;
              c.client.onclose = undefined;
              void clearServerCache(c.name, c.config).catch(() => {});
            }
            headlessStore.setState(prev => {
              let {
                clients,
                tools,
                commands,
                resources
              } = prev.mcp;
              clients = clients.filter(c => !suppressed.has(c.name));
              tools = tools.filter(t => !t.mcpInfo || !suppressed.has(t.mcpInfo.serverName));
              for (const name of suppressed) {
                commands = excludeCommandsByServer(commands, name);
                resources = excludeResourcesByServer(resources, name);
              }
              return {
                ...prev,
                mcp: {
                  ...prev.mcp,
                  clients,
                  tools,
                  commands,
                  resources
                }
              };
            });
          }
        }
        // Suppress claude.ai connectors that duplicate an enabled
        // manual server (URL-signature match). Plugin dedup above only
        // handles `plugin:*` keys; this catches manual `.mcp.json` entries.
        // plugin:* must be excluded here — step 1 already suppressed
        // those (claude.ai wins); leaving them in suppresses the
        // connector too, and neither survives (gh-39974).
        const nonPluginConfigs = pickBy(regularMcpConfigs, (_, n) => !n.startsWith('plugin:'));
        const {
          servers: dedupedClaudeAi
        } = dedupClaudeAiMcpServers(claudeaiConfigs, nonPluginConfigs);
        return connectMcpBatch(dedupedClaudeAi, 'claudeai');
      });
      let claudeaiTimer: ReturnType<typeof setTimeout> | undefined;
      const claudeaiTimedOut = await Promise.race([claudeaiConnect.then(() => false), new Promise<boolean>(resolve => {
        claudeaiTimer = setTimeout(r => r(true), CLAUDE_AI_MCP_TIMEOUT_MS, resolve);
      })]);
      if (claudeaiTimer) clearTimeout(claudeaiTimer);
      if (claudeaiTimedOut) {
        logForDebugging(`[MCP] claude.ai connectors not ready after ${CLAUDE_AI_MCP_TIMEOUT_MS}ms — proceeding; background connection continues`);
      }
      profileCheckpoint('after_connectMcp_claudeai');

      // In headless mode, start deferred prefetches immediately (no user typing delay)
      // --bare / SIMPLE: startDeferredPrefetches early-returns internally.
      // backgroundHousekeeping (initExtractMemories, pruneShellSnapshots,
      // cleanupOldMessageFiles) and sdkHeapDumpMonitor are all bookkeeping
      // that scripted calls don't need — the next interactive session reconciles.
      if (!isBareMode()) {
        startDeferredPrefetches();
        void import('./utils/backgroundHousekeeping.js').then(m => m.startBackgroundHousekeeping());
        if ("external" === 'ant') {
          void import('./utils/sdkHeapDumpMonitor.js').then(m => m.startSdkMemoryMonitor());
        }
      }
      logSessionTelemetry();
      profileCheckpoint('before_print_import');
      const {
        runHeadless
      } = await import('src/cli/print.js');
      profileCheckpoint('after_print_import');
      void runHeadless(inputPrompt, () => headlessStore.getState(), headlessStore.setState, commandsHeadless, tools, sdkMcpConfigs, agentDefinitions.activeAgents, {
        continue: options.continue,
        resume: options.resume,
        verbose: verbose,
        outputFormat: outputFormat,
        jsonSchema,
        permissionPromptToolName: options.permissionPromptTool,
        allowedTools,
        thinkingConfig,
        maxTurns: options.maxTurns,
        maxBudgetUsd: options.maxBudgetUsd,
        taskBudget: options.taskBudget ? {
          total: options.taskBudget
        } : undefined,
        systemPrompt,
        appendSystemPrompt,
        userSpecifiedModel: effectiveModel,
        fallbackModel: userSpecifiedFallbackModel,
        teleport,
        sdkUrl,
        replayUserMessages: effectiveReplayUserMessages,
        includePartialMessages: effectiveIncludePartialMessages,
        forkSession: options.forkSession || false,
        resumeSessionAt: options.resumeSessionAt || undefined,
        rewindFiles: options.rewindFiles,
        enableAuthStatus: options.enableAuthStatus,
        agent: agentCli,
        workload: options.workload,
        setupTrigger: setupTrigger ?? undefined,
        sessionStartHooksPromise
      });
      return;
    }

    // Log model config at startup
    logEvent('tengu_startup_manual_model_config', {
      cli_flag: options.model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      env_var: process.env.ANTHROPIC_MODEL as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      settings_file: (getInitialSettings() || {}).model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      subscriptionType: getSubscriptionType() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      agent: agentSetting as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });

    // Get deprecation warning for the initial model (resolvedInitialModel computed earlier for hooks parallelization)
    const deprecationWarning = getModelDeprecationWarning(resolvedInitialModel);

    // Build initial notification queue
    const initialNotifications: Array<{
      key: string;
      text: string;
      color?: 'warning';
      priority: 'high';
    }> = [];
    if (permissionModeNotification) {
      initialNotifications.push({
        key: 'permission-mode-notification',
        text: permissionModeNotification,
        priority: 'high'
      });
    }
    if (deprecationWarning) {
      initialNotifications.push({
        key: 'model-deprecation-warning',
        text: deprecationWarning,
        color: 'warning',
        priority: 'high'
      });
    }
    if (overlyBroadBashPermissions.length > 0) {
      const displayList = uniq(overlyBroadBashPermissions.map(p => p.ruleDisplay));
      const displays = displayList.join(', ');
      const sources = uniq(overlyBroadBashPermissions.map(p => p.sourceDisplay)).join(', ');
      const n = displayList.length;
      initialNotifications.push({
        key: 'overly-broad-bash-notification',
        text: `${displays} allow ${plural(n, 'rule')} from ${sources} ${plural(n, 'was', 'were')} ignored \u2014 not available for Ants, please use auto-mode instead`,
        color: 'warning',
        priority: 'high'
      });
    }
    const effectiveToolPermissionContext = {
      ...toolPermissionContext,
      mode: isAgentSwarmsEnabled() && getTeammateUtils().isPlanModeRequired() ? 'plan' as const : toolPermissionContext.mode
    };
    // All startup opt-in paths (--tools, --brief, defaultView) have fired
    // above; initialIsBriefOnly just reads the resulting state.
    const initialIsBriefOnly = feature('KAIROS') || feature('KAIROS_BRIEF') ? getUserMsgOptIn() : false;
    const fullRemoteControl = remoteControl || getRemoteControlAtStartup() || kairosEnabled;
    let ccrMirrorEnabled = false;
    if (feature('CCR_MIRROR') && !fullRemoteControl) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const {
        isCcrMirrorEnabled
      } = require('./bridge/bridgeEnabled.js') as typeof import('./bridge/bridgeEnabled.js');
      /* eslint-enable @typescript-eslint/no-require-imports */
      ccrMirrorEnabled = isCcrMirrorEnabled();
    }
    const initialState: AppState = {
      settings: getInitialSettings(),
      tasks: {},
      agentNameRegistry: new Map(),
      verbose: verbose ?? getGlobalConfig().verbose ?? false,
      mainLoopModel: initialMainLoopModel,
      mainLoopModelForSession: null,
      isBriefOnly: initialIsBriefOnly,
      expandedView: getGlobalConfig().showSpinnerTree ? 'teammates' : getGlobalConfig().showExpandedTodos ? 'tasks' : 'none',
      showTeammateMessagePreview: isAgentSwarmsEnabled() ? false : undefined,
      selectedIPAgentIndex: -1,
      coordinatorTaskIndex: -1,
      viewSelectionMode: 'none',
      footerSelection: null,
      toolPermissionContext: effectiveToolPermissionContext,
      agent: mainThreadAgentDefinition?.agentType,
      agentDefinitions,
      mcp: {
        clients: [],
        tools: [],
        commands: [],
        resources: {},
        pluginReconnectKey: 0
      },
      plugins: {
        enabled: [],
        disabled: [],
        commands: [],
        errors: [],
        installationStatus: {
          marketplaces: [],
          plugins: []
        },
        needsRefresh: false
      },
      statusLineText: undefined,
      kairosEnabled,
      remoteSessionUrl: undefined,
      remoteConnectionStatus: 'connecting',
      remoteBackgroundTaskCount: 0,
      replBridgeEnabled: fullRemoteControl || ccrMirrorEnabled,
      replBridgeExplicit: remoteControl,
      replBridgeOutboundOnly: ccrMirrorEnabled,
      replBridgeConnected: false,
      replBridgeSessionActive: false,
      replBridgeReconnecting: false,
      replBridgeConnectUrl: undefined,
      replBridgeSessionUrl: undefined,
      replBridgeEnvironmentId: undefined,
      replBridgeSessionId: undefined,
      replBridgeError: undefined,
      replBridgeInitialName: remoteControlName,
      showRemoteCallout: false,
      notifications: {
        current: null,
        queue: initialNotifications
      },
      elicitation: {
        queue: []
      },
      todos: {},
      remoteAgentTaskSuggestions: [],
      fileHistory: {
        snapshots: [],
        trackedFiles: new Set(),
        snapshotSequence: 0
      },
      attribution: createEmptyAttributionState(),
      thinkingEnabled,
      promptSuggestionEnabled: shouldEnablePromptSuggestion(),
      sessionHooks: new Map(),
      inbox: {
        messages: []
      },
      promptSuggestion: {
        text: null,
        promptId: null,
        shownAt: 0,
        acceptedAt: 0,
        generationRequestId: null
      },
      speculation: IDLE_SPECULATION_STATE,
      speculationSessionTimeSavedMs: 0,
      skillImprovement: {
        suggestion: null
      },
      workerSandboxPermissions: {
        queue: [],
        selectedIndex: 0
      },
      pendingWorkerRequest: null,
      pendingSandboxRequest: null,
      authVersion: 0,
      initialMessage: inputPrompt ? {
        message: createUserMessage({
          content: String(inputPrompt)
        })
      } : null,
      effortValue: parseEffortValue(options.effort) ?? getInitialEffortSetting(),
      activeOverlays: new Set<string>(),
      fastMode: getInitialFastModeSetting(resolvedInitialModel),
      ...(isAdvisorEnabled() && advisorModel && {
        advisorModel
      }),
      // Compute teamContext synchronously to avoid useEffect setState during render.
      // KAIROS: assistantTeamContext takes precedence — set earlier in the
      // KAIROS block so Agent(name: "foo") can spawn in-process teammates
      // without TeamCreate. computeInitialTeamContext() is for tmux-spawned
      // teammates reading their own identity, not the assistant-mode leader.
      teamContext: feature('KAIROS') ? assistantTeamContext ?? computeInitialTeamContext?.() : computeInitialTeamContext?.()
    };

    // Add CLI initial prompt to history
    if (inputPrompt) {
      addToHistory(String(inputPrompt));
    }
    const initialTools = mcpTools;

    // Increment numStartups synchronously — first-render readers like
    // shouldShowEffortCallout (via useState initializer) need the updated
    // value before setImmediate fires. Defer only telemetry.
    saveGlobalConfig(current => ({
      ...current,
      numStartups: (current.numStartups ?? 0) + 1
    }));
    setImmediate(() => {
      void logStartupTelemetry();
      logSessionTelemetry();
    });

    // Set up per-turn session environment data uploader (ant-only build).
    // Default-enabled for all ant users when working in an Anthropic-owned
    // repo. Captures git/filesystem state (NOT transcripts) at each turn so
    // environments can be recreated at any user message index. Gating:
    //   - Build-time: this import is stubbed in external builds.
    //   - Runtime: uploader checks github.com/anthropics/* remote + gcloud auth.
    //   - Safety: CLAUDE_CODE_DISABLE_SESSION_DATA_UPLOAD=1 bypasses (tests set this).
    // Import is dynamic + async to avoid adding startup latency.
    const sessionUploaderPromise = "external" === 'ant' ? import('./utils/sessionDataUploader.js') : null;

    // Defer session uploader resolution to the onTurnComplete callback to avoid
    // adding a new top-level await in main.tsx (performance-critical path).
    // The per-turn auth logic in sessionDataUploader.ts handles unauthenticated
    // state gracefully (re-checks each turn, so auth recovery mid-session works).
    const uploaderReady = sessionUploaderPromise ? sessionUploaderPromise.then(mod => mod.createSessionTurnUploader()).catch(() => null) : null;
    const sessionConfig = {
      debug: debug || debugToStderr,
      commands: [...commands, ...mcpCommands],
      initialTools,
      mcpClients,
      autoConnectIdeFlag: ide,
      mainThreadAgentDefinition,
      disableSlashCommands,
      dynamicMcpConfig,
      strictMcpConfig,
      systemPrompt,
      appendSystemPrompt,
      taskListId,
      thinkingConfig,
      ...(uploaderReady && {
        onTurnComplete: (messages: MessageType[]) => {
          void uploaderReady.then(uploader => uploader?.(messages));
        }
      })
    };

    // Shared context for processResumedConversation calls
    const resumeContext = {
      modeApi: coordinatorModeModule,
      mainThreadAgentDefinition,
      agentDefinitions,
      currentCwd,
      cliAgents,
      initialState
    };
    if (options.continue) {
      // Continue the most recent conversation directly
      let resumeSucceeded = false;
      try {
        const resumeStart = performance.now();

        // Clear stale caches before resuming to ensure fresh file/skill discovery
        const {
          clearSessionCaches
        } = await import('./commands/clear/caches.js');
        clearSessionCaches();
        const result = await loadConversationForResume(undefined /* sessionId */, undefined /* sourceFile */);
        if (!result) {
          logEvent('tengu_continue', {
            success: false
          });
          return await exitWithError(root, 'No conversation found to continue');
        }
        const loaded = await processResumedConversation(result, {
          forkSession: !!options.forkSession,
          includeAttribution: true,
          transcriptPath: result.fullPath
        }, resumeContext);
        if (loaded.restoredAgentDef) {
          mainThreadAgentDefinition = loaded.restoredAgentDef;
        }
        maybeActivateProactive(options);
        maybeActivateBrief(options);
        logEvent('tengu_continue', {
          success: true,
          resume_duration_ms: Math.round(performance.now() - resumeStart)
        });
        resumeSucceeded = true;
        await launchRepl(root, {
          getFpsMetrics,
          stats,
          initialState: loaded.initialState
        }, {
          ...sessionConfig,
          mainThreadAgentDefinition: loaded.restoredAgentDef ?? mainThreadAgentDefinition,
          initialMessages: loaded.messages,
          initialFileHistorySnapshots: loaded.fileHistorySnapshots,
          initialContentReplacements: loaded.contentReplacements,
          initialAgentName: loaded.agentName,
          initialAgentColor: loaded.agentColor
        }, renderAndRun);
      } catch (error) {
        if (!resumeSucceeded) {
          logEvent('tengu_continue', {
            success: false
          });
        }
        logError(error);
        process.exit(1);
      }
    } else if (feature('DIRECT_CONNECT') && _pendingConnect?.url) {
      // `claude connect <url>` — full interactive TUI connected to a remote server
      let directConnectConfig;
      try {
        const session = await createDirectConnectSession({
          serverUrl: _pendingConnect.url,
          authToken: _pendingConnect.authToken,
          cwd: getOriginalCwd(),
          dangerouslySkipPermissions: _pendingConnect.dangerouslySkipPermissions
        });
        if (session.workDir) {
          setOriginalCwd(session.workDir);
          setCwdState(session.workDir);
        }
        setDirectConnectServerUrl(_pendingConnect.url);
        directConnectConfig = session.config;
      } catch (err) {
        return await exitWithError(root, err instanceof DirectConnectError ? err.message : String(err), () => gracefulShutdown(1));
      }
      const connectInfoMessage = createSystemMessage(`Connected to server at ${_pendingConnect.url}\nSession: ${directConnectConfig.sessionId}`, 'info');
      await launchRepl(root, {
        getFpsMetrics,
        stats,
        initialState
      }, {
        debug: debug || debugToStderr,
        commands,
        initialTools: [],
        initialMessages: [connectInfoMessage],
        mcpClients: [],
        autoConnectIdeFlag: ide,
        mainThreadAgentDefinition,
        disableSlashCommands,
        directConnectConfig,
        thinkingConfig
      }, renderAndRun);
      return;
    } else if (feature('SSH_REMOTE') && _pendingSSH?.host) {
      // `claude ssh <host> [dir]` — probe remote, deploy binary if needed,
      // spawn ssh with unix-socket -R forward to a local auth proxy, hand
      // the REPL an SSHSession. Tools run remotely, UI renders locally.
      // `--local` skips probe/deploy/ssh and spawns the current binary
      // directly with the same env — e2e test of the proxy/auth plumbing.
      const {
        createSSHSession,
        createLocalSSHSession,
        SSHSessionError
      } = await import('./ssh/createSSHSession.js');
      let sshSession;
      try {
        if (_pendingSSH.local) {
          process.stderr.write('Starting local ssh-proxy test session...\n');
          sshSession = createLocalSSHSession({
            cwd: _pendingSSH.cwd,
            permissionMode: _pendingSSH.permissionMode,
            dangerouslySkipPermissions: _pendingSSH.dangerouslySkipPermissions
          });
        } else {
          process.stderr.write(`Connecting to ${_pendingSSH.host}…\n`);
          // In-place progress: \r + EL0 (erase to end of line). Final \n on
          // success so the next message lands on a fresh line. No-op when
          // stderr isn't a TTY (piped/redirected) — \r would just emit noise.
          const isTTY = process.stderr.isTTY;
          let hadProgress = false;
          sshSession = await createSSHSession({
            host: _pendingSSH.host,
            cwd: _pendingSSH.cwd,
            localVersion: MACRO.VERSION,
            permissionMode: _pendingSSH.permissionMode,
            dangerouslySkipPermissions: _pendingSSH.dangerouslySkipPermissions,
            extraCliArgs: _pendingSSH.extraCliArgs
          }, isTTY ? {
            onProgress: msg => {
              hadProgress = true;
              process.stderr.write(`\r  ${msg}\x1b[K`);
            }
          } : {});
          if (hadProgress) process.stderr.write('\n');
        }
        setOriginalCwd(sshSession.remoteCwd);
        setCwdState(sshSession.remoteCwd);
        setDirectConnectServerUrl(_pendingSSH.local ? 'local' : _pendingSSH.host);
      } catch (err) {
        return await exitWithError(root, err instanceof SSHSessionError ? err.message : String(err), () => gracefulShutdown(1));
      }
      const sshInfoMessage = createSystemMessage(_pendingSSH.local ? `Local ssh-proxy test session\ncwd: ${sshSession.remoteCwd}\nAuth: unix socket → local proxy` : `SSH session to ${_pendingSSH.host}\nRemote cwd: ${sshSession.remoteCwd}\nAuth: unix socket -R → local proxy`, 'info');
      await launchRepl(root, {
        getFpsMetrics,
        stats,
        initialState
      }, {
        debug: debug || debugToStderr,
        commands,
        initialTools: [],
        initialMessages: [sshInfoMessage],
        mcpClients: [],
        autoConnectIdeFlag: ide,
        mainThreadAgentDefinition,
        disableSlashCommands,
        sshSession,
        thinkingConfig
      }, renderAndRun);
      return;
    } else if (feature('KAIROS') && _pendingAssistantChat && (_pendingAssistantChat.sessionId || _pendingAssistantChat.discover)) {
      // `claude assistant [sessionId]` — REPL as a pure viewer client
      // of a remote assistant session. The agentic loop runs remotely; this
      // process streams live events and POSTs messages. History is lazy-
      // loaded by useAssistantHistory on scroll-up (no blocking fetch here).
      const {
        discoverAssistantSessions
      } = await import('./assistant/sessionDiscovery.js');
      let targetSessionId = _pendingAssistantChat.sessionId;

      // Discovery flow — list bridge environments, filter sessions
      if (!targetSessionId) {
        let sessions;
        try {
          sessions = await discoverAssistantSessions();
        } catch (e) {
          return await exitWithError(root, `Failed to discover sessions: ${e instanceof Error ? e.message : e}`, () => gracefulShutdown(1));
        }
        if (sessions.length === 0) {
          let installedDir: string | null;
          try {
            installedDir = await launchAssistantInstallWizard(root);
          } catch (e) {
            return await exitWithError(root, `Assistant installation failed: ${e instanceof Error ? e.message : e}`, () => gracefulShutdown(1));
          }
          if (installedDir === null) {
            await gracefulShutdown(0);
            process.exit(0);
          }
          // The daemon needs a few seconds to spin up its worker and
          // establish a bridge session before discovery will find it.
          return await exitWithMessage(root, `Assistant installed in ${installedDir}. The daemon is starting up — run \`claude assistant\` again in a few seconds to connect.`, {
            exitCode: 0,
            beforeExit: () => gracefulShutdown(0)
          });
        }
        if (sessions.length === 1) {
          targetSessionId = sessions[0]!.id;
        } else {
          const picked = await launchAssistantSessionChooser(root, {
            sessions
          });
          if (!picked) {
            await gracefulShutdown(0);
            process.exit(0);
          }
          targetSessionId = picked;
        }
      }

      // Auth — call prepareApiRequest() once for orgUUID, but use a
      // getAccessToken closure for the token so reconnects get fresh tokens.
      const {
        checkAndRefreshOAuthTokenIfNeeded,
        getClaudeAIOAuthTokens
      } = await import('./utils/auth.js');
      await checkAndRefreshOAuthTokenIfNeeded();
      let apiCreds;
      try {
        apiCreds = await prepareApiRequest();
      } catch (e) {
        return await exitWithError(root, `Error: ${e instanceof Error ? e.message : 'Failed to authenticate'}`, () => gracefulShutdown(1));
      }
      const getAccessToken = (): string => getClaudeAIOAuthTokens()?.accessToken ?? apiCreds.accessToken;

      // Brief mode activation: setKairosActive(true) satisfies BOTH opt-in
      // and entitlement for isBriefEnabled() (BriefTool.ts:124-132).
      setKairosActive(true);
      setUserMsgOptIn(true);
      setIsRemoteMode(true);
      const remoteSessionConfig = createRemoteSessionConfig(targetSessionId, getAccessToken, apiCreds.orgUUID, /* hasInitialPrompt */false, /* viewerOnly */true);
      const infoMessage = createSystemMessage(`Attached to assistant session ${targetSessionId.slice(0, 8)}…`, 'info');
      const assistantInitialState: AppState = {
        ...initialState,
        isBriefOnly: true,
        kairosEnabled: false,
        replBridgeEnabled: false
      };
      const remoteCommands = filterCommandsForRemoteMode(commands);
      await launchRepl(root, {
        getFpsMetrics,
        stats,
        initialState: assistantInitialState
      }, {
        debug: debug || debugToStderr,
        commands: remoteCommands,
        initialTools: [],
        initialMessages: [infoMessage],
        mcpClients: [],
        autoConnectIdeFlag: ide,
        mainThreadAgentDefinition,
        disableSlashCommands,
        remoteSessionConfig,
        thinkingConfig
      }, renderAndRun);
      return;
    } else if (options.resume || options.fromPr || teleport || remote !== null) {
      // Handle resume flow - from file (ant-only), session ID, or interactive selector

      // Clear stale caches before resuming to ensure fresh file/skill discovery
      const {
        clearSessionCaches
      } = await import('./commands/clear/caches.js');
      clearSessionCaches();
      let messages: MessageType[] | null = null;
      let processedResume: ProcessedResume | undefined = undefined;
      let maybeSessionId = validateUuid(options.resume);
      let searchTerm: string | undefined = undefined;
      // Store full LogOption when found by custom title (for cross-worktree resume)
      let matchedLog: LogOption | null = null;
      // PR filter for --from-pr flag
      let filterByPr: boolean | number | string | undefined = undefined;

      // Handle --from-pr flag
      if (options.fromPr) {
        if (options.fromPr === true) {
          // Show all sessions with linked PRs
          filterByPr = true;
        } else if (typeof options.fromPr === 'string') {
          // Could be a PR number or URL
          filterByPr = options.fromPr;
        }
      }

      // If resume value is not a UUID, try exact match by custom title first
      if (options.resume && typeof options.resume === 'string' && !maybeSessionId) {
        const trimmedValue = options.resume.trim();
        if (trimmedValue) {
          const matches = await searchSessionsByCustomTitle(trimmedValue, {
            exact: true
          });
          if (matches.length === 1) {
            // Exact match found - store full LogOption for cross-worktree resume
            matchedLog = matches[0]!;
            maybeSessionId = getSessionIdFromLog(matchedLog) ?? null;
          } else {
            // No match or multiple matches - use as search term for picker
            searchTerm = trimmedValue;
          }
        }
      }

      // --remote and --teleport both create/resume Claude Code Web (CCR) sessions.
      // Remote Control (--rc) is a separate feature gated in initReplBridge.ts.
      if (remote !== null || teleport) {
        await waitForPolicyLimitsToLoad();
        if (!isPolicyAllowed('allow_remote_sessions')) {
          return await exitWithError(root, "Error: Remote sessions are disabled by your organization's policy.", () => gracefulShutdown(1));
        }
      }
      if (remote !== null) {
        // Create remote session (optionally with initial prompt)
        const hasInitialPrompt = remote.length > 0;

        // Check if TUI mode is enabled - description is only optional in TUI mode
        const isRemoteTuiEnabled = getFeatureValue_CACHED_MAY_BE_STALE('tengu_remote_backend', false);
        if (!isRemoteTuiEnabled && !hasInitialPrompt) {
          return await exitWithError(root, 'Error: --remote requires a description.\nUsage: claude --remote "your task description"', () => gracefulShutdown(1));
        }
        logEvent('tengu_remote_create_session', {
          has_initial_prompt: String(hasInitialPrompt) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });

        // Pass current branch so CCR clones the repo at the right revision
        const currentBranch = await getBranch();
        const createdSession = await teleportToRemoteWithErrorHandling(root, hasInitialPrompt ? remote : null, new AbortController().signal, currentBranch || undefined);
        if (!createdSession) {
          logEvent('tengu_remote_create_session_error', {
            error: 'unable_to_create_session' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
          return await exitWithError(root, 'Error: Unable to create remote session', () => gracefulShutdown(1));
        }
        logEvent('tengu_remote_create_session_success', {
          session_id: createdSession.id as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });

        // Check if new remote TUI mode is enabled via feature gate
        if (!isRemoteTuiEnabled) {
          // Original behavior: print session info and exit
          process.stdout.write(`Created remote session: ${createdSession.title}\n`);
          process.stdout.write(`View: ${getRemoteSessionUrl(createdSession.id)}?m=0\n`);
          process.stdout.write(`Resume with: claude --teleport ${createdSession.id}\n`);
          await gracefulShutdown(0);
          process.exit(0);
        }

        // New behavior: start local TUI with CCR engine
        // Mark that we're in remote mode for command visibility
        setIsRemoteMode(true);
        switchSession(asSessionId(createdSession.id));

        // Get OAuth credentials for remote session
        let apiCreds: {
          accessToken: string;
          orgUUID: string;
        };
        try {
          apiCreds = await prepareApiRequest();
        } catch (error) {
          logError(toError(error));
          return await exitWithError(root, `Error: ${errorMessage(error) || 'Failed to authenticate'}`, () => gracefulShutdown(1));
        }

        // Create remote session config for the REPL
        const {
          getClaudeAIOAuthTokens: getTokensForRemote
        } = await import('./utils/auth.js');
        const getAccessTokenForRemote = (): string => getTokensForRemote()?.accessToken ?? apiCreds.accessToken;
        const remoteSessionConfig = createRemoteSessionConfig(createdSession.id, getAccessTokenForRemote, apiCreds.orgUUID, hasInitialPrompt);

        // Add remote session info as initial system message
        const remoteSessionUrl = `${getRemoteSessionUrl(createdSession.id)}?m=0`;
        const remoteInfoMessage = createSystemMessage(`/remote-control is active. Code in CLI or at ${remoteSessionUrl}`, 'info');

        // Create initial user message from the prompt if provided (CCR echoes it back but we ignore that)
        const initialUserMessage = hasInitialPrompt ? createUserMessage({
          content: remote
        }) : null;

        // Set remote session URL in app state for footer indicator
        const remoteInitialState = {
          ...initialState,
          remoteSessionUrl
        };

        // Pre-filter commands to only include remote-safe ones.
        // CCR's init response may further refine the list (via handleRemoteInit in REPL).
        const remoteCommands = filterCommandsForRemoteMode(commands);
        await launchRepl(root, {
          getFpsMetrics,
          stats,
          initialState: remoteInitialState
        }, {
          debug: debug || debugToStderr,
          commands: remoteCommands,
          initialTools: [],
          initialMessages: initialUserMessage ? [remoteInfoMessage, initialUserMessage] : [remoteInfoMessage],
          mcpClients: [],
          autoConnectIdeFlag: ide,
          mainThreadAgentDefinition,
          disableSlashCommands,
          remoteSessionConfig,
          thinkingConfig
        }, renderAndRun);
        return;
      } else if (teleport) {
        if (teleport === true || teleport === '') {
          // Interactive mode: show task selector and handle resume
          logEvent('tengu_teleport_interactive_mode', {});
          logForDebugging('selectAndResumeTeleportTask: Starting teleport flow...');
          const teleportResult = await launchTeleportResumeWrapper(root);
          if (!teleportResult) {
            // User cancelled or error occurred
            await gracefulShutdown(0);
            process.exit(0);
          }
          const {
            branchError
          } = await checkOutTeleportedSessionBranch(teleportResult.branch);
          messages = processMessagesForTeleportResume(teleportResult.log, branchError);
        } else if (typeof teleport === 'string') {
          logEvent('tengu_teleport_resume_session', {
            mode: 'direct' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
          try {
            // First, fetch session and validate repository before checking git state
            const sessionData = await fetchSession(teleport);
            const repoValidation = await validateSessionRepository(sessionData);

            // Handle repo mismatch or not in repo cases
            if (repoValidation.status === 'mismatch' || repoValidation.status === 'not_in_repo') {
              const sessionRepo = repoValidation.sessionRepo;
              if (sessionRepo) {
                // Check for known paths
                const knownPaths = getKnownPathsForRepo(sessionRepo);
                const existingPaths = await filterExistingPaths(knownPaths);
                if (existingPaths.length > 0) {
                  // Show directory switch dialog
                  const selectedPath = await launchTeleportRepoMismatchDialog(root, {
                    targetRepo: sessionRepo,
                    initialPaths: existingPaths
                  });
                  if (selectedPath) {
                    // Change to the selected directory
                    process.chdir(selectedPath);
                    setCwd(selectedPath);
                    setOriginalCwd(selectedPath);
                  } else {
                    // User cancelled
                    await gracefulShutdown(0);
                  }
                } else {
                  // No known paths - show original error
                  throw new TeleportOperationError(`You must run claude --teleport ${teleport} from a checkout of ${sessionRepo}.`, chalk.red(`You must run claude --teleport ${teleport} from a checkout of ${chalk.bold(sessionRepo)}.\n`));
                }
              }
            } else if (repoValidation.status === 'error') {
              throw new TeleportOperationError(repoValidation.errorMessage || 'Failed to validate session', chalk.red(`Error: ${repoValidation.errorMessage || 'Failed to validate session'}\n`));
            }
            await validateGitState();

            // Use progress UI for teleport
            const {
              teleportWithProgress
            } = await import('./components/TeleportProgress.js');
            const result = await teleportWithProgress(root, teleport);
            // Track teleported session for reliability logging
            setTeleportedSessionInfo({
              sessionId: teleport
            });
            messages = result.messages;
          } catch (error) {
            if (error instanceof TeleportOperationError) {
              process.stderr.write(error.formattedMessage + '\n');
            } else {
              logError(error);
              process.stderr.write(chalk.red(`Error: ${errorMessage(error)}\n`));
            }
            await gracefulShutdown(1);
          }
        }
      }
      if ("external" === 'ant') {
        if (options.resume && typeof options.resume === 'string' && !maybeSessionId) {
          // Check for ccshare URL (e.g. https://go/ccshare/boris-20260311-211036)
          const {
            parseCcshareId,
            loadCcshare
          } = await import('./utils/ccshareResume.js');
          const ccshareId = parseCcshareId(options.resume);
          if (ccshareId) {
            try {
              const resumeStart = performance.now();
              const logOption = await loadCcshare(ccshareId);
              const result = await loadConversationForResume(logOption, undefined);
              if (result) {
                processedResume = await processResumedConversation(result, {
                  forkSession: true,
                  transcriptPath: result.fullPath
                }, resumeContext);
                if (processedResume.restoredAgentDef) {
                  mainThreadAgentDefinition = processedResume.restoredAgentDef;
                }
                logEvent('tengu_session_resumed', {
                  entrypoint: 'ccshare' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                  success: true,
                  resume_duration_ms: Math.round(performance.now() - resumeStart)
                });
              } else {
                logEvent('tengu_session_resumed', {
                  entrypoint: 'ccshare' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                  success: false
                });
              }
            } catch (error) {
              logEvent('tengu_session_resumed', {
                entrypoint: 'ccshare' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                success: false
              });
              logError(error);
              await exitWithError(root, `Unable to resume from ccshare: ${errorMessage(error)}`, () => gracefulShutdown(1));
            }
          } else {
            const resolvedPath = resolve(options.resume);
            try {
              const resumeStart = performance.now();
              let logOption;
              try {
                // Attempt to load as a transcript file; ENOENT falls through to session-ID handling
                logOption = await loadTranscriptFromFile(resolvedPath);
              } catch (error) {
                if (!isENOENT(error)) throw error;
                // ENOENT: not a file path — fall through to session-ID handling
              }
              if (logOption) {
                const result = await loadConversationForResume(logOption, undefined /* sourceFile */);
                if (result) {
                  processedResume = await processResumedConversation(result, {
                    forkSession: !!options.forkSession,
                    transcriptPath: result.fullPath
                  }, resumeContext);
                  if (processedResume.restoredAgentDef) {
                    mainThreadAgentDefinition = processedResume.restoredAgentDef;
                  }
                  logEvent('tengu_session_resumed', {
                    entrypoint: 'file' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                    success: true,
                    resume_duration_ms: Math.round(performance.now() - resumeStart)
                  });
                } else {
                  logEvent('tengu_session_resumed', {
                    entrypoint: 'file' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                    success: false
                  });
                }
              }
            } catch (error) {
              logEvent('tengu_session_resumed', {
                entrypoint: 'file' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                success: false
              });
              logError(error);
              await exitWithError(root, `Unable to load transcript from file: ${options.resume}`, () => gracefulShutdown(1));
            }
          }
        }
      }

      // If not loaded as a file, try as session ID
      if (maybeSessionId) {
        // Resume specific session by ID
        const sessionId = maybeSessionId;
        try {
          const resumeStart = performance.now();
          // Use matchedLog if available (for cross-worktree resume by custom title)
          // Otherwise fall back to sessionId string (for direct UUID resume)
          const result = await loadConversationForResume(matchedLog ?? sessionId, undefined);
          if (!result) {
            logEvent('tengu_session_resumed', {
              entrypoint: 'cli_flag' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              success: false
            });
            return await exitWithError(root, `No conversation found with session ID: ${sessionId}`);
          }
          const fullPath = matchedLog?.fullPath ?? result.fullPath;
          processedResume = await processResumedConversation(result, {
            forkSession: !!options.forkSession,
            sessionIdOverride: sessionId,
            transcriptPath: fullPath
          }, resumeContext);
          if (processedResume.restoredAgentDef) {
            mainThreadAgentDefinition = processedResume.restoredAgentDef;
          }
          logEvent('tengu_session_resumed', {
            entrypoint: 'cli_flag' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            success: true,
            resume_duration_ms: Math.round(performance.now() - resumeStart)
          });
        } catch (error) {
          logEvent('tengu_session_resumed', {
            entrypoint: 'cli_flag' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            success: false
          });
          logError(error);
          await exitWithError(root, `Failed to resume session ${sessionId}`);
        }
      }

      // Await file downloads before rendering REPL (files must be available)
      if (fileDownloadPromise) {
        try {
          const results = await fileDownloadPromise;
          const failedCount = count(results, r => !r.success);
          if (failedCount > 0) {
            process.stderr.write(chalk.yellow(`Warning: ${failedCount}/${results.length} file(s) failed to download.\n`));
          }
        } catch (error) {
          return await exitWithError(root, `Error downloading files: ${errorMessage(error)}`);
        }
      }

      // If we have a processed resume or teleport messages, render the REPL
      const resumeData = processedResume ?? (Array.isArray(messages) ? {
        messages,
        fileHistorySnapshots: undefined,
        agentName: undefined,
        agentColor: undefined as AgentColorName | undefined,
        restoredAgentDef: mainThreadAgentDefinition,
        initialState,
        contentReplacements: undefined
      } : undefined);
      if (resumeData) {
        maybeActivateProactive(options);
        maybeActivateBrief(options);
        await launchRepl(root, {
          getFpsMetrics,
          stats,
          initialState: resumeData.initialState
        }, {
          ...sessionConfig,
          mainThreadAgentDefinition: resumeData.restoredAgentDef ?? mainThreadAgentDefinition,
          initialMessages: resumeData.messages,
          initialFileHistorySnapshots: resumeData.fileHistorySnapshots,
          initialContentReplacements: resumeData.contentReplacements,
          initialAgentName: resumeData.agentName,
          initialAgentColor: resumeData.agentColor
        }, renderAndRun);
      } else {
        // Show interactive selector (includes same-repo worktrees)
        // Note: ResumeConversation loads logs internally to ensure proper GC after selection
        await launchResumeChooser(root, {
          getFpsMetrics,
          stats,
          initialState
        }, getWorktreePaths(getOriginalCwd()), {
          ...sessionConfig,
          initialSearchQuery: searchTerm,
          forkSession: options.forkSession,
          filterByPr
        });
      }
    } else {
      // Pass unresolved hooks promise to REPL so it can render immediately
      // instead of blocking ~500ms waiting for SessionStart hooks to finish.
      // REPL will inject hook messages when they resolve and await them before
      // the first API call so the model always sees hook context.
      const pendingHookMessages = hooksPromise && hookMessages.length === 0 ? hooksPromise : undefined;
      profileCheckpoint('action_after_hooks');
      maybeActivateProactive(options);
      maybeActivateBrief(options);
      // Persist the current mode for fresh sessions so future resumes know what mode was used
      if (feature('COORDINATOR_MODE')) {
        saveMode(coordinatorModeModule?.isCoordinatorMode() ? 'coordinator' : 'normal');
      }

      // If launched via a deep link, show a provenance banner so the user
      // knows the session originated externally. Linux xdg-open and
      // browsers with "always allow" set dispatch the link with no OS-level
      // confirmation, so this is the only signal the user gets that the
      // prompt — and the working directory / CLAUDE.md it implies — came
      // from an external source rather than something they typed.
      let deepLinkBanner: ReturnType<typeof createSystemMessage> | null = null;
      if (feature('LODESTONE')) {
        if (options.deepLinkOrigin) {
          logEvent('tengu_deep_link_opened', {
            has_prefill: Boolean(options.prefill),
            has_repo: Boolean(options.deepLinkRepo)
          });
          deepLinkBanner = createSystemMessage(buildDeepLinkBanner({
            cwd: getCwd(),
            prefillLength: options.prefill?.length,
            repo: options.deepLinkRepo,
            lastFetch: options.deepLinkLastFetch !== undefined ? new Date(options.deepLinkLastFetch) : undefined
          }), 'warning');
        } else if (options.prefill) {
          deepLinkBanner = createSystemMessage('Launched with a pre-filled prompt — review it before pressing Enter.', 'warning');
        }
      }
      const initialMessages = deepLinkBanner ? [deepLinkBanner, ...hookMessages] : hookMessages.length > 0 ? hookMessages : undefined;
      await launchRepl(root, {
        getFpsMetrics,
        stats,
        initialState
      }, {
        ...sessionConfig,
        initialMessages,
        pendingHookMessages
      }, renderAndRun);
    }
  }).version(`${MACRO.VERSION} (Claude Code)`, '-v, --version', 'Output the version number');

  // Worktree flags
  program.option('-w, --worktree [name]', 'Create a new git worktree for this session (optionally specify a name)');
  program.option('--tmux', 'Create a tmux session for the worktree (requires --worktree). Uses iTerm2 native panes when available; use --tmux=classic for traditional tmux.');
  if (canUserConfigureAdvisor()) {
    program.addOption(new Option('--advisor <model>', 'Enable the server-side advisor tool with the specified model (alias or full ID).').hideHelp());
  }
  if ("external" === 'ant') {
    program.addOption(new Option('--delegate-permissions', '[ANT-ONLY] Alias for --permission-mode auto.').implies({
      permissionMode: 'auto'
    }));
    program.addOption(new Option('--dangerously-skip-permissions-with-classifiers', '[ANT-ONLY] Deprecated alias for --permission-mode auto.').hideHelp().implies({
      permissionMode: 'auto'
    }));
    program.addOption(new Option('--afk', '[ANT-ONLY] Deprecated alias for --permission-mode auto.').hideHelp().implies({
      permissionMode: 'auto'
    }));
    program.addOption(new Option('--tasks [id]', '[ANT-ONLY] Tasks mode: watch for tasks and auto-process them. Optional id is used as both the task list ID and agent ID (defaults to "tasklist").').argParser(String).hideHelp());
    program.option('--agent-teams', '[ANT-ONLY] Force Claude to use multi-agent mode for solving problems', () => true);
  }
  if (feature('TRANSCRIPT_CLASSIFIER')) {
    program.addOption(new Option('--enable-auto-mode', 'Opt in to auto mode').hideHelp());
  }
  if (feature('PROACTIVE') || feature('KAIROS')) {
    program.addOption(new Option('--proactive', 'Start in proactive autonomous mode'));
  }
  if (feature('UDS_INBOX')) {
    program.addOption(new Option('--messaging-socket-path <path>', 'Unix domain socket path for the UDS messaging server (defaults to a tmp path)'));
  }
  if (feature('KAIROS') || feature('KAIROS_BRIEF')) {
    program.addOption(new Option('--brief', 'Enable SendUserMessage tool for agent-to-user communication'));
  }
  if (feature('KAIROS')) {
    program.addOption(new Option('--assistant', 'Force assistant mode (Agent SDK daemon use)').hideHelp());
  }
  if (feature('KAIROS') || feature('KAIROS_CHANNELS')) {
    program.addOption(new Option('--channels <servers...>', 'MCP servers whose channel notifications (inbound push) should register this session. Space-separated server names.').hideHelp());
    program.addOption(new Option('--dangerously-load-development-channels <servers...>', 'Load channel servers not on the approved allowlist. For local channel development only. Shows a confirmation dialog at startup.').hideHelp());
  }

  // Teammate identity options (set by leader when spawning tmux teammates)
  // These replace the CLAUDE_CODE_* environment variables
  program.addOption(new Option('--agent-id <id>', 'Teammate agent ID').hideHelp());
  program.addOption(new Option('--agent-name <name>', 'Teammate display name').hideHelp());
  program.addOption(new Option('--team-name <name>', 'Team name for swarm coordination').hideHelp());
  program.addOption(new Option('--agent-color <color>', 'Teammate UI color').hideHelp());
  program.addOption(new Option('--plan-mode-required', 'Require plan mode before implementation').hideHelp());
  program.addOption(new Option('--parent-session-id <id>', 'Parent session ID for analytics correlation').hideHelp());
  program.addOption(new Option('--teammate-mode <mode>', 'How to spawn teammates: "tmux", "in-process", or "auto"').choices(['auto', 'tmux', 'in-process']).hideHelp());
  program.addOption(new Option('--agent-type <type>', 'Custom agent type for this teammate').hideHelp());

  // Enable SDK URL for all builds but hide from help
  program.addOption(new Option('--sdk-url <url>', 'Use remote WebSocket endpoint for SDK I/O streaming (only with -p and stream-json format)').hideHelp());

  // Enable teleport/remote flags for all builds but keep them undocumented until GA
  program.addOption(new Option('--teleport [session]', 'Resume a teleport session, optionally specify session ID').hideHelp());
  program.addOption(new Option('--remote [description]', 'Create a remote session with the given description').hideHelp());
  if (feature('BRIDGE_MODE')) {
    program.addOption(new Option('--remote-control [name]', 'Start an interactive session with Remote Control enabled (optionally named)').argParser(value => value || true).hideHelp());
    program.addOption(new Option('--rc [name]', 'Alias for --remote-control').argParser(value => value || true).hideHelp());
  }
  if (feature('HARD_FAIL')) {
    program.addOption(new Option('--hard-fail', 'Crash on logError calls instead of silently logging').hideHelp());
  }
  profileCheckpoint('run_main_options_built');

  // -p/--print mode: skip subcommand registration. The 52 subcommands
  // (mcp, auth, plugin, skill, task, config, doctor, update, etc.) are
  // never dispatched in print mode — commander routes the prompt to the
  // default action. The subcommand registration path was measured at ~65ms
  // on baseline — mostly the isBridgeEnabled() call (25ms settings Zod parse
  // + 40ms sync keychain subprocess), both hidden by the try/catch that
  // always returns false before enableConfigs(). cc:// URLs are rewritten to
  // `open` at main() line ~851 BEFORE this runs, so argv check is safe here.
  const isPrintMode = process.argv.includes('-p') || process.argv.includes('--print');
  const isCcUrl = process.argv.some(a => a.startsWith('cc://') || a.startsWith('cc+unix://'));
  if (isPrintMode && !isCcUrl) {
    profileCheckpoint('run_before_parse');
    await program.parseAsync(process.argv);
    profileCheckpoint('run_after_parse');
    return program;
  }

  // claude mcp

  const mcp = program.command('mcp').description('Configure and manage MCP servers').configureHelp(createSortedHelpConfig()).enablePositionalOptions();
  mcp.command('serve').description(`Start the Claude Code MCP server`).option('-d, --debug', 'Enable debug mode', () => true).option('--verbose', 'Override verbose mode setting from config', () => true).action(async ({
    debug,
    verbose
  }: {
    debug?: boolean;
    verbose?: boolean;
  }) => {
    const {
      mcpServeHandler
    } = await import('./cli/handlers/mcp.js');
    await mcpServeHandler({
      debug,
      verbose
    });
  });

  // Register the mcp add subcommand (extracted for testability)
  registerMcpAddCommand(mcp);
  if (isXaaEnabled()) {
    registerMcpXaaIdpCommand(mcp);
  }
  mcp.command('remove <name>').description('Remove an MCP server').option('-s, --scope <scope>', 'Configuration scope (local, user, or project) - if not specified, removes from whichever scope it exists in').action(async (name: string, options: {
    scope?: string;
  }) => {
    const {
      mcpRemoveHandler
    } = await import('./cli/handlers/mcp.js');
    await mcpRemoveHandler(name, options);
  });
  mcp.command('list').description('List configured MCP servers. Note: The workspace trust dialog is skipped and stdio servers from .mcp.json are spawned for health checks. Only use this command in directories you trust.').action(async () => {
    const {
      mcpListHandler
    } = await import('./cli/handlers/mcp.js');
    await mcpListHandler();
  });
  mcp.command('get <name>').description('Get details about an MCP server. Note: The workspace trust dialog is skipped and stdio servers from .mcp.json are spawned for health checks. Only use this command in directories you trust.').action(async (name: string) => {
    const {
      mcpGetHandler
    } = await import('./cli/handlers/mcp.js');
    await mcpGetHandler(name);
  });
  mcp.command('add-json <name> <json>').description('Add an MCP server (stdio or SSE) with a JSON string').option('-s, --scope <scope>', 'Configuration scope (local, user, or project)', 'local').option('--client-secret', 'Prompt for OAuth client secret (or set MCP_CLIENT_SECRET env var)').action(async (name: string, json: string, options: {
    scope?: string;
    clientSecret?: true;
  }) => {
    const {
      mcpAddJsonHandler
    } = await import('./cli/handlers/mcp.js');
    await mcpAddJsonHandler(name, json, options);
  });
  mcp.command('add-from-claude-desktop').description('Import MCP servers from Claude Desktop (Mac and WSL only)').option('-s, --scope <scope>', 'Configuration scope (local, user, or project)', 'local').action(async (options: {
    scope?: string;
  }) => {
    const {
      mcpAddFromDesktopHandler
    } = await import('./cli/handlers/mcp.js');
    await mcpAddFromDesktopHandler(options);
  });
  mcp.command('reset-project-choices').description('Reset all approved and rejected project-scoped (.mcp.json) servers within this project').action(async () => {
    const {
      mcpResetChoicesHandler
    } = await import('./cli/handlers/mcp.js');
    await mcpResetChoicesHandler();
  });

  // claude server
  if (feature('DIRECT_CONNECT')) {
    program.command('server').description('Start a Claude Code session server').option('--port <number>', 'HTTP port', '0').option('--host <string>', 'Bind address', '0.0.0.0').option('--auth-token <token>', 'Bearer token for auth').option('--unix <path>', 'Listen on a unix domain socket').option('--workspace <dir>', 'Default working directory for sessions that do not specify cwd').option('--idle-timeout <ms>', 'Idle timeout for detached sessions in ms (0 = never expire)', '600000').option('--max-sessions <n>', 'Maximum concurrent sessions (0 = unlimited)', '32').action(async (opts: {
      port: string;
      host: string;
      authToken?: string;
      unix?: string;
      workspace?: string;
      idleTimeout: string;
      maxSessions: string;
    }) => {
      const {
        randomBytes
      } = await import('crypto');
      const {
        startServer
      } = await import('./server/server.js');
      const {
        SessionManager
      } = await import('./server/sessionManager.js');
      const {
        DangerousBackend
      } = await import('./server/backends/dangerousBackend.js');
      const {
        printBanner
      } = await import('./server/serverBanner.js');
      const {
        createServerLogger
      } = await import('./server/serverLog.js');
      const {
        writeServerLock,
        removeServerLock,
        probeRunningServer
      } = await import('./server/lockfile.js');
      const existing = await probeRunningServer();
      if (existing) {
        process.stderr.write(`A claude server is already running (pid ${existing.pid}) at ${existing.httpUrl}\n`);
        process.exit(1);
      }
      const authToken = opts.authToken ?? `sk-ant-cc-${randomBytes(16).toString('base64url')}`;
      const config = {
        port: parseInt(opts.port, 10),
        host: opts.host,
        authToken,
        unix: opts.unix,
        workspace: opts.workspace,
        idleTimeoutMs: parseInt(opts.idleTimeout, 10),
        maxSessions: parseInt(opts.maxSessions, 10)
      };
      const backend = new DangerousBackend();
      const sessionManager = new SessionManager(backend, {
        idleTimeoutMs: config.idleTimeoutMs,
        maxSessions: config.maxSessions
      });
      const logger = createServerLogger();
      const server = startServer(config, sessionManager, logger);
      const actualPort = server.port ?? config.port;
      printBanner(config, authToken, actualPort);
      await writeServerLock({
        pid: process.pid,
        port: actualPort,
        host: config.host,
        httpUrl: config.unix ? `unix:${config.unix}` : `http://${config.host}:${actualPort}`,
        startedAt: Date.now()
      });
      let shuttingDown = false;
      const shutdown = async () => {
        if (shuttingDown) return;
        shuttingDown = true;
        // Stop accepting new connections before tearing down sessions.
        server.stop(true);
        await sessionManager.destroyAll();
        await removeServerLock();
        process.exit(0);
      };
      process.once('SIGINT', () => void shutdown());
      process.once('SIGTERM', () => void shutdown());
    });
  }

  // `claude ssh <host> [dir]` — registered here only so --help shows it.
  // The actual interactive flow is handled by early argv rewriting in main()
  // (parallels the DIRECT_CONNECT/cc:// pattern above). If commander reaches
  // this action it means the argv rewrite didn't fire (e.g. user ran
  // `claude ssh` with no host) — just print usage.
  if (feature('SSH_REMOTE')) {
    program.command('ssh <host> [dir]').description('Run Claude Code on a remote host over SSH. Deploys the binary and ' + 'tunnels API auth back through your local machine — no remote setup needed.').option('--permission-mode <mode>', 'Permission mode for the remote session').option('--dangerously-skip-permissions', 'Skip all permission prompts on the remote (dangerous)').option('--local', 'e2e test mode — spawn the child CLI locally (skip ssh/deploy). ' + 'Exercises the auth proxy and unix-socket plumbing without a remote host.').action(async () => {
      // Argv rewriting in main() should have consumed `ssh <host>` before
      // commander runs. Reaching here means host was missing or the
      // rewrite predicate didn't match.
      process.stderr.write('Usage: claude ssh <user@host | ssh-config-alias> [dir]\n\n' + "Runs Claude Code on a remote Linux host. You don't need to install\n" + 'anything on the remote or run `claude auth login` there — the binary is\n' + 'deployed over SSH and API auth tunnels back through your local machine.\n');
      process.exit(1);
    });
  }

  // claude connect — subcommand only handles -p (headless) mode.
  // Interactive mode (without -p) is handled by early argv rewriting in main()
  // which redirects to the main command with full TUI support.
  if (feature('DIRECT_CONNECT')) {
    program.command('open <cc-url>').description('Connect to a Claude Code server (internal — use cc:// URLs)').option('-p, --print [prompt]', 'Print mode (headless)').option('--output-format <format>', 'Output format: text, json, stream-json', 'text').action(async (ccUrl: string, opts: {
      print?: string | boolean;
      outputFormat: string;
    }) => {
      const {
        parseConnectUrl
      } = await import('./server/parseConnectUrl.js');
      const {
        serverUrl,
        authToken
      } = parseConnectUrl(ccUrl);
      let connectConfig;
      try {
        const session = await createDirectConnectSession({
          serverUrl,
          authToken,
          cwd: getOriginalCwd(),
          dangerouslySkipPermissions: _pendingConnect?.dangerouslySkipPermissions
        });
        if (session.workDir) {
          setOriginalCwd(session.workDir);
          setCwdState(session.workDir);
        }
        setDirectConnectServerUrl(serverUrl);
        connectConfig = session.config;
      } catch (err) {
        // biome-ignore lint/suspicious/noConsole: intentional error output
        console.error(err instanceof DirectConnectError ? err.message : String(err));
        process.exit(1);
      }
      const {
        runConnectHeadless
      } = await import('./server/connectHeadless.js');
      const prompt = typeof opts.print === 'string' ? opts.print : '';
      const interactive = opts.print === true;
      await runConnectHeadless(connectConfig, prompt, opts.outputFormat, interactive);
    });
  }

  // claude auth

  const auth = program.command('auth').description('Manage authentication').configureHelp(createSortedHelpConfig());
  auth.command('login').description('Sign in to your Anthropic account').option('--email <email>', 'Pre-populate email address on the login page').option('--sso', 'Force SSO login flow').option('--console', 'Use Anthropic Console (API usage billing) instead of Claude subscription').option('--claudeai', 'Use Claude subscription (default)').action(async ({
    email,
    sso,
    console: useConsole,
    claudeai
  }: {
    email?: string;
    sso?: boolean;
    console?: boolean;
    claudeai?: boolean;
  }) => {
    const {
      authLogin
    } = await import('./cli/handlers/auth.js');
    await authLogin({
      email,
      sso,
      console: useConsole,
      claudeai
    });
  });
  auth.command('status').description('Show authentication status').option('--json', 'Output as JSON (default)').option('--text', 'Output as human-readable text').action(async (opts: {
    json?: boolean;
    text?: boolean;
  }) => {
    const {
      authStatus
    } = await import('./cli/handlers/auth.js');
    await authStatus(opts);
  });
  auth.command('logout').description('Log out from your Anthropic account').action(async () => {
    const {
      authLogout
    } = await import('./cli/handlers/auth.js');
    await authLogout();
  });

  /**
   * Helper function to handle marketplace command errors consistently.
   * Logs the error and exits the process with status 1.
   * @param error The error that occurred
   * @param action Description of the action that failed
   */
  // Hidden flag on all plugin/marketplace subcommands to target cowork_plugins.
  const coworkOption = () => new Option('--cowork', 'Use cowork_plugins directory').hideHelp();

  // Plugin validate command
  const pluginCmd = program.command('plugin').alias('plugins').description('Manage Claude Code plugins').configureHelp(createSortedHelpConfig());
  pluginCmd.command('validate <path>').description('Validate a plugin or marketplace manifest').addOption(coworkOption()).action(async (manifestPath: string, options: {
    cowork?: boolean;
  }) => {
    const {
      pluginValidateHandler
    } = await import('./cli/handlers/plugins.js');
    await pluginValidateHandler(manifestPath, options);
  });

  // Plugin list command
  pluginCmd.command('list').description('List installed plugins').option('--json', 'Output as JSON').option('--available', 'Include available plugins from marketplaces (requires --json)').addOption(coworkOption()).action(async (options: {
    json?: boolean;
    available?: boolean;
    cowork?: boolean;
  }) => {
    const {
      pluginListHandler
    } = await import('./cli/handlers/plugins.js');
    await pluginListHandler(options);
  });

  // Marketplace subcommands
  const marketplaceCmd = pluginCmd.command('marketplace').description('Manage Claude Code marketplaces').configureHelp(createSortedHelpConfig());
  marketplaceCmd.command('add <source>').description('Add a marketplace from a URL, path, or GitHub repo').addOption(coworkOption()).option('--sparse <paths...>', 'Limit checkout to specific directories via git sparse-checkout (for monorepos). Example: --sparse .claude-plugin plugins').option('--scope <scope>', 'Where to declare the marketplace: user (default), project, or local').action(async (source: string, options: {
    cowork?: boolean;
    sparse?: string[];
    scope?: string;
  }) => {
    const {
      marketplaceAddHandler
    } = await import('./cli/handlers/plugins.js');
    await marketplaceAddHandler(source, options);
  });
  marketplaceCmd.command('list').description('List all configured marketplaces').option('--json', 'Output as JSON').addOption(coworkOption()).action(async (options: {
    json?: boolean;
    cowork?: boolean;
  }) => {
    const {
      marketplaceListHandler
    } = await import('./cli/handlers/plugins.js');
    await marketplaceListHandler(options);
  });
  marketplaceCmd.command('remove <name>').alias('rm').description('Remove a configured marketplace').addOption(coworkOption()).action(async (name: string, options: {
    cowork?: boolean;
  }) => {
    const {
      marketplaceRemoveHandler
    } = await import('./cli/handlers/plugins.js');
    await marketplaceRemoveHandler(name, options);
  });
  marketplaceCmd.command('update [name]').description('Update marketplace(s) from their source - updates all if no name specified').addOption(coworkOption()).action(async (name: string | undefined, options: {
    cowork?: boolean;
  }) => {
    const {
      marketplaceUpdateHandler
    } = await import('./cli/handlers/plugins.js');
    await marketplaceUpdateHandler(name, options);
  });

  // Plugin install command
  pluginCmd.command('install <plugin>').alias('i').description('Install a plugin from available marketplaces (use plugin@marketplace for specific marketplace)').option('-s, --scope <scope>', 'Installation scope: user, project, or local', 'user').addOption(coworkOption()).action(async (plugin: string, options: {
    scope?: string;
    cowork?: boolean;
  }) => {
    const {
      pluginInstallHandler
    } = await import('./cli/handlers/plugins.js');
    await pluginInstallHandler(plugin, options);
  });

  // Plugin uninstall command
  pluginCmd.command('uninstall <plugin>').alias('remove').alias('rm').description('Uninstall an installed plugin').option('-s, --scope <scope>', 'Uninstall from scope: user, project, or local', 'user').option('--keep-data', "Preserve the plugin's persistent data directory (~/.claude/plugins/data/{id}/)").addOption(coworkOption()).action(async (plugin: string, options: {
    scope?: string;
    cowork?: boolean;
    keepData?: boolean;
  }) => {
    const {
      pluginUninstallHandler
    } = await import('./cli/handlers/plugins.js');
    await pluginUninstallHandler(plugin, options);
  });

  // Plugin enable command
  pluginCmd.command('enable <plugin>').description('Enable a disabled plugin').option('-s, --scope <scope>', `Installation scope: ${VALID_INSTALLABLE_SCOPES.join(', ')} (default: auto-detect)`).addOption(coworkOption()).action(async (plugin: string, options: {
    scope?: string;
    cowork?: boolean;
  }) => {
    const {
      pluginEnableHandler
    } = await import('./cli/handlers/plugins.js');
    await pluginEnableHandler(plugin, options);
  });

  // Plugin disable command
  pluginCmd.command('disable [plugin]').description('Disable an enabled plugin').option('-a, --all', 'Disable all enabled plugins').option('-s, --scope <scope>', `Installation scope: ${VALID_INSTALLABLE_SCOPES.join(', ')} (default: auto-detect)`).addOption(coworkOption()).action(async (plugin: string | undefined, options: {
    scope?: string;
    cowork?: boolean;
    all?: boolean;
  }) => {
    const {
      pluginDisableHandler
    } = await import('./cli/handlers/plugins.js');
    await pluginDisableHandler(plugin, options);
  });

  // Plugin update command
  pluginCmd.command('update <plugin>').description('Update a plugin to the latest version (restart required to apply)').option('-s, --scope <scope>', `Installation scope: ${VALID_UPDATE_SCOPES.join(', ')} (default: user)`).addOption(coworkOption()).action(async (plugin: string, options: {
    scope?: string;
    cowork?: boolean;
  }) => {
    const {
      pluginUpdateHandler
    } = await import('./cli/handlers/plugins.js');
    await pluginUpdateHandler(plugin, options);
  });
  // END ANT-ONLY

  // Setup token command
  program.command('setup-token').description('Set up a long-lived authentication token (requires Claude subscription)').action(async () => {
    const [{
      setupTokenHandler
    }, {
      createRoot
    }] = await Promise.all([import('./cli/handlers/util.js'), import('./ink.js')]);
    const root = await createRoot(getBaseRenderOptions(false));
    await setupTokenHandler(root);
  });

  // Agents command - list configured agents
  program.command('agents').description('List configured agents').option('--setting-sources <sources>', 'Comma-separated list of setting sources to load (user, project, local).').action(async () => {
    const {
      agentsHandler
    } = await import('./cli/handlers/agents.js');
    await agentsHandler();
    process.exit(0);
  });
  if (feature('TRANSCRIPT_CLASSIFIER')) {
    // Skip when tengu_auto_mode_config.enabled === 'disabled' (circuit breaker).
    // Reads from disk cache — GrowthBook isn't initialized at registration time.
    if (getAutoModeEnabledStateIfCached() !== 'disabled') {
      const autoModeCmd = program.command('auto-mode').description('Inspect auto mode classifier configuration');
      autoModeCmd.command('defaults').description('Print the default auto mode environment, allow, and deny rules as JSON').action(async () => {
        const {
          autoModeDefaultsHandler
        } = await import('./cli/handlers/autoMode.js');
        autoModeDefaultsHandler();
        process.exit(0);
      });
      autoModeCmd.command('config').description('Print the effective auto mode config as JSON: your settings where set, defaults otherwise').action(async () => {
        const {
          autoModeConfigHandler
        } = await import('./cli/handlers/autoMode.js');
        autoModeConfigHandler();
        process.exit(0);
      });
      autoModeCmd.command('critique').description('Get AI feedback on your custom auto mode rules').option('--model <model>', 'Override which model is used').action(async options => {
        const {
          autoModeCritiqueHandler
        } = await import('./cli/handlers/autoMode.js');
        await autoModeCritiqueHandler(options);
        process.exit();
      });
    }
  }

  // Remote Control command — connect local environment to claude.ai/code.
  // The actual command is intercepted by the fast-path in cli.tsx before
  // Commander.js runs, so this registration exists only for help output.
  // Always hidden: isBridgeEnabled() at this point (before enableConfigs)
  // would throw inside isClaudeAISubscriber → getGlobalConfig and return
  // false via the try/catch — but not before paying ~65ms of side effects
  // (25ms settings Zod parse + 40ms sync `security` keychain subprocess).
  // The dynamic visibility never worked; the command was always hidden.
  if (feature('BRIDGE_MODE')) {
    program.command('remote-control', {
      hidden: true
    }).alias('rc').description('Connect your local environment for remote-control sessions via claude.ai/code').action(async () => {
      // Unreachable — cli.tsx fast-path handles this command before main.tsx loads.
      // If somehow reached, delegate to bridgeMain.
      const {
        bridgeMain
      } = await import('./bridge/bridgeMain.js');
      await bridgeMain(process.argv.slice(3));
    });
  }
  if (feature('KAIROS')) {
    program.command('assistant [sessionId]').description('Attach the REPL as a client to a running bridge session. Discovers sessions via API if no sessionId given.').action(() => {
      // Argv rewriting above should have consumed `assistant [id]`
      // before commander runs. Reaching here means a root flag came first
      // (e.g. `--debug assistant`) and the position-0 predicate
      // didn't match. Print usage like the ssh stub does.
      process.stderr.write('Usage: claude assistant [sessionId]\n\n' + 'Attach the REPL as a viewer client to a running bridge session.\n' + 'Omit sessionId to discover and pick from available sessions.\n');
      process.exit(1);
    });
  }

  // Doctor command - check installation health
  program.command('doctor').description('Check the health of your Claude Code auto-updater. Note: The workspace trust dialog is skipped and stdio servers from .mcp.json are spawned for health checks. Only use this command in directories you trust.').action(async () => {
    const [{
      doctorHandler
    }, {
      createRoot
    }] = await Promise.all([import('./cli/handlers/util.js'), import('./ink.js')]);
    const root = await createRoot(getBaseRenderOptions(false));
    await doctorHandler(root);
  });

  // claude update
  //
  // For SemVer-compliant versioning with build metadata (X.X.X+SHA):
  // - We perform exact string comparison (including SHA) to detect any change
  // - This ensures users always get the latest build, even when only the SHA changes
  // - UI shows both versions including build metadata for clarity
  program.command('update').alias('upgrade').description('Check for updates and install if available').action(async () => {
    const {
      update
    } = await import('src/cli/update.js');
    await update();
  });

  // claude up — run the project's CLAUDE.md "# claude up" setup instructions.
  if ("external" === 'ant') {
    program.command('up').description('[ANT-ONLY] Initialize or upgrade the local dev environment using the "# claude up" section of the nearest CLAUDE.md').action(async () => {
      const {
        up
      } = await import('src/cli/up.js');
      await up();
    });
  }

  // claude rollback (ant-only)
  // Rolls back to previous releases
  if ("external" === 'ant') {
    program.command('rollback [target]').description('[ANT-ONLY] Roll back to a previous release\n\nExamples:\n  claude rollback                                    Go 1 version back from current\n  claude rollback 3                                  Go 3 versions back from current\n  claude rollback 2.0.73-dev.20251217.t190658        Roll back to a specific version').option('-l, --list', 'List recent published versions with ages').option('--dry-run', 'Show what would be installed without installing').option('--safe', 'Roll back to the server-pinned safe version (set by oncall during incidents)').action(async (target?: string, options?: {
      list?: boolean;
      dryRun?: boolean;
      safe?: boolean;
    }) => {
      const {
        rollback
      } = await import('src/cli/rollback.js');
      await rollback(target, options);
    });
  }

  // claude install
  program.command('install [target]').description('Install Claude Code native build. Use [target] to specify version (stable, latest, or specific version)').option('--force', 'Force installation even if already installed').action(async (target: string | undefined, options: {
    force?: boolean;
  }) => {
    const {
      installHandler
    } = await import('./cli/handlers/util.js');
    await installHandler(target, options);
  });

  // ant-only commands
  if ("external" === 'ant') {
    const validateLogId = (value: string) => {
      const maybeSessionId = validateUuid(value);
      if (maybeSessionId) return maybeSessionId;
      return Number(value);
    };
    // claude log
    program.command('log').description('[ANT-ONLY] Manage conversation logs.').argument('[number|sessionId]', 'A number (0, 1, 2, etc.) to display a specific log, or the sesssion ID (uuid) of a log', validateLogId).action(async (logId: string | number | undefined) => {
      const {
        logHandler
      } = await import('./cli/handlers/ant.js');
      await logHandler(logId);
    });

    // claude error
    program.command('error').description('[ANT-ONLY] View error logs. Optionally provide a number (0, -1, -2, etc.) to display a specific log.').argument('[number]', 'A number (0, 1, 2, etc.) to display a specific log', parseInt).action(async (number: number | undefined) => {
      const {
        errorHandler
      } = await import('./cli/handlers/ant.js');
      await errorHandler(number);
    });

    // claude export
    program.command('export').description('[ANT-ONLY] Export a conversation to a text file.').usage('<source> <outputFile>').argument('<source>', 'Session ID, log index (0, 1, 2...), or path to a .json/.jsonl log file').argument('<outputFile>', 'Output file path for the exported text').addHelpText('after', `
Examples:
  $ claude export 0 conversation.txt                Export conversation at log index 0
  $ claude export <uuid> conversation.txt           Export conversation by session ID
  $ claude export input.json output.txt             Render JSON log file to text
  $ claude export <uuid>.jsonl output.txt           Render JSONL session file to text`).action(async (source: string, outputFile: string) => {
      const {
        exportHandler
      } = await import('./cli/handlers/ant.js');
      await exportHandler(source, outputFile);
    });
    if ("external" === 'ant') {
      const taskCmd = program.command('task').description('[ANT-ONLY] Manage task list tasks');
      taskCmd.command('create <subject>').description('Create a new task').option('-d, --description <text>', 'Task description').option('-l, --list <id>', 'Task list ID (defaults to "tasklist")').action(async (subject: string, opts: {
        description?: string;
        list?: string;
      }) => {
        const {
          taskCreateHandler
        } = await import('./cli/handlers/ant.js');
        await taskCreateHandler(subject, opts);
      });
      taskCmd.command('list').description('List all tasks').option('-l, --list <id>', 'Task list ID (defaults to "tasklist")').option('--pending', 'Show only pending tasks').option('--json', 'Output as JSON').action(async (opts: {
        list?: string;
        pending?: boolean;
        json?: boolean;
      }) => {
        const {
          taskListHandler
        } = await import('./cli/handlers/ant.js');
        await taskListHandler(opts);
      });
      taskCmd.command('get <id>').description('Get details of a task').option('-l, --list <id>', 'Task list ID (defaults to "tasklist")').action(async (id: string, opts: {
        list?: string;
      }) => {
        const {
          taskGetHandler
        } = await import('./cli/handlers/ant.js');
        await taskGetHandler(id, opts);
      });
      taskCmd.command('update <id>').description('Update a task').option('-l, --list <id>', 'Task list ID (defaults to "tasklist")').option('-s, --status <status>', `Set status (${TASK_STATUSES.join(', ')})`).option('--subject <text>', 'Update subject').option('-d, --description <text>', 'Update description').option('--owner <agentId>', 'Set owner').option('--clear-owner', 'Clear owner').action(async (id: string, opts: {
        list?: string;
        status?: string;
        subject?: string;
        description?: string;
        owner?: string;
        clearOwner?: boolean;
      }) => {
        const {
          taskUpdateHandler
        } = await import('./cli/handlers/ant.js');
        await taskUpdateHandler(id, opts);
      });
      taskCmd.command('dir').description('Show the tasks directory path').option('-l, --list <id>', 'Task list ID (defaults to "tasklist")').action(async (opts: {
        list?: string;
      }) => {
        const {
          taskDirHandler
        } = await import('./cli/handlers/ant.js');
        await taskDirHandler(opts);
      });
    }

    // claude completion <shell>
    program.command('completion <shell>', {
      hidden: true
    }).description('Generate shell completion script (bash, zsh, or fish)').option('--output <file>', 'Write completion script directly to a file instead of stdout').action(async (shell: string, opts: {
      output?: string;
    }) => {
      const {
        completionHandler
      } = await import('./cli/handlers/ant.js');
      await completionHandler(shell, opts, program);
    });
  }
  profileCheckpoint('run_before_parse');
  await program.parseAsync(process.argv);
  profileCheckpoint('run_after_parse');

  // Record final checkpoint for total_time calculation
  profileCheckpoint('main_after_run');

  // Log startup perf to Statsig (sampled) and output detailed report if enabled
  profileReport();
  return program;
}
async function logTenguInit({
  hasInitialPrompt,
  hasStdin,
  verbose,
  debug,
  debugToStderr,
  print,
  outputFormat,
  inputFormat,
  numAllowedTools,
  numDisallowedTools,
  mcpClientCount,
  worktreeEnabled,
  skipWebFetchPreflight,
  githubActionInputs,
  dangerouslySkipPermissionsPassed,
  permissionMode,
  modeIsBypass,
  allowDangerouslySkipPermissionsPassed,
  systemPromptFlag,
  appendSystemPromptFlag,
  thinkingConfig,
  assistantActivationPath
}: {
  hasInitialPrompt: boolean;
  hasStdin: boolean;
  verbose: boolean;
  debug: boolean;
  debugToStderr: boolean;
  print: boolean;
  outputFormat: string;
  inputFormat: string;
  numAllowedTools: number;
  numDisallowedTools: number;
  mcpClientCount: number;
  worktreeEnabled: boolean;
  skipWebFetchPreflight: boolean | undefined;
  githubActionInputs: string | undefined;
  dangerouslySkipPermissionsPassed: boolean;
  permissionMode: string;
  modeIsBypass: boolean;
  allowDangerouslySkipPermissionsPassed: boolean;
  systemPromptFlag: 'file' | 'flag' | undefined;
  appendSystemPromptFlag: 'file' | 'flag' | undefined;
  thinkingConfig: ThinkingConfig;
  assistantActivationPath: string | undefined;
}): Promise<void> {
  try {
    logEvent('tengu_init', {
      entrypoint: 'claude' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      hasInitialPrompt,
      hasStdin,
      verbose,
      debug,
      debugToStderr,
      print,
      outputFormat: outputFormat as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      inputFormat: inputFormat as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      numAllowedTools,
      numDisallowedTools,
      mcpClientCount,
      worktree: worktreeEnabled,
      skipWebFetchPreflight,
      ...(githubActionInputs && {
        githubActionInputs: githubActionInputs as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      dangerouslySkipPermissionsPassed,
      permissionMode: permissionMode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      modeIsBypass,
      inProtectedNamespace: isInProtectedNamespace(),
      allowDangerouslySkipPermissionsPassed,
      thinkingType: thinkingConfig.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...(systemPromptFlag && {
        systemPromptFlag: systemPromptFlag as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      ...(appendSystemPromptFlag && {
        appendSystemPromptFlag: appendSystemPromptFlag as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      is_simple: isBareMode() || undefined,
      is_coordinator: feature('COORDINATOR_MODE') && coordinatorModeModule?.isCoordinatorMode() ? true : undefined,
      ...(assistantActivationPath && {
        assistantActivationPath: assistantActivationPath as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      autoUpdatesChannel: (getInitialSettings().autoUpdatesChannel ?? 'latest') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...("external" === 'ant' ? (() => {
        const cwd = getCwd();
        const gitRoot = findGitRoot(cwd);
        const rp = gitRoot ? relative(gitRoot, cwd) || '.' : undefined;
        return rp ? {
          relativeProjectPath: rp as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        } : {};
      })() : {})
    });
  } catch (error) {
    logError(error);
  }
}
function maybeActivateProactive(options: unknown): void {
  if ((feature('PROACTIVE') || feature('KAIROS')) && ((options as {
    proactive?: boolean;
  }).proactive || isEnvTruthy(process.env.CLAUDE_CODE_PROACTIVE))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const proactiveModule = require('./proactive/index.js');
    if (!proactiveModule.isProactiveActive()) {
      proactiveModule.activateProactive('command');
    }
  }
}
function maybeActivateBrief(options: unknown): void {
  if (!(feature('KAIROS') || feature('KAIROS_BRIEF'))) return;
  const briefFlag = (options as {
    brief?: boolean;
  }).brief;
  const briefEnv = isEnvTruthy(process.env.CLAUDE_CODE_BRIEF);
  if (!briefFlag && !briefEnv) return;
  // --brief / CLAUDE_CODE_BRIEF are explicit opt-ins: check entitlement,
  // then set userMsgOptIn to activate the tool + prompt section. The env
  // var also grants entitlement (isBriefEntitled() reads it), so setting
  // CLAUDE_CODE_BRIEF=1 alone force-enables for dev/testing — no GB gate
  // needed. initialIsBriefOnly reads getUserMsgOptIn() directly.
  // Conditional require: static import would leak the tool name string
  // into external builds via BriefTool.ts → prompt.ts.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const {
    isBriefEntitled
  } = require('./tools/BriefTool/BriefTool.js') as typeof import('./tools/BriefTool/BriefTool.js');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const entitled = isBriefEntitled();
  if (entitled) {
    setUserMsgOptIn(true);
  }
  // Fire unconditionally once intent is seen: enabled=false captures the
  // "user tried but was gated" failure mode in Datadog.
  logEvent('tengu_brief_mode_enabled', {
    enabled: entitled,
    gated: !entitled,
    source: (briefEnv ? 'env' : 'flag') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  });
}
function resetCursor() {
  const terminal = process.stderr.isTTY ? process.stderr : process.stdout.isTTY ? process.stdout : undefined;
  terminal?.write(SHOW_CURSOR);
}
type TeammateOptions = {
  agentId?: string;
  agentName?: string;
  teamName?: string;
  agentColor?: string;
  planModeRequired?: boolean;
  parentSessionId?: string;
  teammateMode?: 'auto' | 'tmux' | 'in-process';
  agentType?: string;
};
function extractTeammateOptions(options: unknown): TeammateOptions {
  if (typeof options !== 'object' || options === null) {
    return {};
  }
  const opts = options as Record<string, unknown>;
  const teammateMode = opts.teammateMode;
  return {
    agentId: typeof opts.agentId === 'string' ? opts.agentId : undefined,
    agentName: typeof opts.agentName === 'string' ? opts.agentName : undefined,
    teamName: typeof opts.teamName === 'string' ? opts.teamName : undefined,
    agentColor: typeof opts.agentColor === 'string' ? opts.agentColor : undefined,
    planModeRequired: typeof opts.planModeRequired === 'boolean' ? opts.planModeRequired : undefined,
    parentSessionId: typeof opts.parentSessionId === 'string' ? opts.parentSessionId : undefined,
    teammateMode: teammateMode === 'auto' || teammateMode === 'tmux' || teammateMode === 'in-process' ? teammateMode : undefined,
    agentType: typeof opts.agentType === 'string' ? opts.agentType : undefined
  };
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJwcm9maWxlQ2hlY2twb2ludCIsInByb2ZpbGVSZXBvcnQiLCJzdGFydE1kbVJhd1JlYWQiLCJlbnN1cmVLZXljaGFpblByZWZldGNoQ29tcGxldGVkIiwic3RhcnRLZXljaGFpblByZWZldGNoIiwiZmVhdHVyZSIsIkNvbW1hbmQiLCJDb21tYW5kZXJDb21tYW5kIiwiSW52YWxpZEFyZ3VtZW50RXJyb3IiLCJPcHRpb24iLCJjaGFsayIsInJlYWRGaWxlU3luYyIsIm1hcFZhbHVlcyIsInBpY2tCeSIsInVuaXFCeSIsIlJlYWN0IiwiZ2V0T2F1dGhDb25maWciLCJnZXRSZW1vdGVTZXNzaW9uVXJsIiwiZ2V0U3lzdGVtQ29udGV4dCIsImdldFVzZXJDb250ZXh0IiwiaW5pdCIsImluaXRpYWxpemVUZWxlbWV0cnlBZnRlclRydXN0IiwiYWRkVG9IaXN0b3J5IiwiUm9vdCIsImxhdW5jaFJlcGwiLCJoYXNHcm93dGhCb29rRW52T3ZlcnJpZGUiLCJpbml0aWFsaXplR3Jvd3RoQm9vayIsInJlZnJlc2hHcm93dGhCb29rQWZ0ZXJBdXRoQ2hhbmdlIiwiZmV0Y2hCb290c3RyYXBEYXRhIiwiRG93bmxvYWRSZXN1bHQiLCJkb3dubG9hZFNlc3Npb25GaWxlcyIsIkZpbGVzQXBpQ29uZmlnIiwicGFyc2VGaWxlU3BlY3MiLCJwcmVmZXRjaFBhc3Nlc0VsaWdpYmlsaXR5IiwicHJlZmV0Y2hPZmZpY2lhbE1jcFVybHMiLCJNY3BTZGtTZXJ2ZXJDb25maWciLCJNY3BTZXJ2ZXJDb25maWciLCJTY29wZWRNY3BTZXJ2ZXJDb25maWciLCJpc1BvbGljeUFsbG93ZWQiLCJsb2FkUG9saWN5TGltaXRzIiwicmVmcmVzaFBvbGljeUxpbWl0cyIsIndhaXRGb3JQb2xpY3lMaW1pdHNUb0xvYWQiLCJsb2FkUmVtb3RlTWFuYWdlZFNldHRpbmdzIiwicmVmcmVzaFJlbW90ZU1hbmFnZWRTZXR0aW5ncyIsIlRvb2xJbnB1dEpTT05TY2hlbWEiLCJjcmVhdGVTeW50aGV0aWNPdXRwdXRUb29sIiwiaXNTeW50aGV0aWNPdXRwdXRUb29sRW5hYmxlZCIsImdldFRvb2xzIiwiY2FuVXNlckNvbmZpZ3VyZUFkdmlzb3IiLCJnZXRJbml0aWFsQWR2aXNvclNldHRpbmciLCJpc0Fkdmlzb3JFbmFibGVkIiwiaXNWYWxpZEFkdmlzb3JNb2RlbCIsIm1vZGVsU3VwcG9ydHNBZHZpc29yIiwiaXNBZ2VudFN3YXJtc0VuYWJsZWQiLCJjb3VudCIsInVuaXEiLCJpbnN0YWxsQXNjaWljYXN0UmVjb3JkZXIiLCJnZXRTdWJzY3JpcHRpb25UeXBlIiwiaXNDbGF1ZGVBSVN1YnNjcmliZXIiLCJwcmVmZXRjaEF3c0NyZWRlbnRpYWxzQW5kQmVkUm9ja0luZm9JZlNhZmUiLCJwcmVmZXRjaEdjcENyZWRlbnRpYWxzSWZTYWZlIiwidmFsaWRhdGVGb3JjZUxvZ2luT3JnIiwiY2hlY2tIYXNUcnVzdERpYWxvZ0FjY2VwdGVkIiwiZ2V0R2xvYmFsQ29uZmlnIiwiZ2V0UmVtb3RlQ29udHJvbEF0U3RhcnR1cCIsImlzQXV0b1VwZGF0ZXJEaXNhYmxlZCIsInNhdmVHbG9iYWxDb25maWciLCJzZWVkRWFybHlJbnB1dCIsInN0b3BDYXB0dXJpbmdFYXJseUlucHV0IiwiZ2V0SW5pdGlhbEVmZm9ydFNldHRpbmciLCJwYXJzZUVmZm9ydFZhbHVlIiwiZ2V0SW5pdGlhbEZhc3RNb2RlU2V0dGluZyIsImlzRmFzdE1vZGVFbmFibGVkIiwicHJlZmV0Y2hGYXN0TW9kZVN0YXR1cyIsInJlc29sdmVGYXN0TW9kZVN0YXR1c0Zyb21DYWNoZSIsImFwcGx5Q29uZmlnRW52aXJvbm1lbnRWYXJpYWJsZXMiLCJjcmVhdGVTeXN0ZW1NZXNzYWdlIiwiY3JlYXRlVXNlck1lc3NhZ2UiLCJnZXRQbGF0Zm9ybSIsImdldEJhc2VSZW5kZXJPcHRpb25zIiwiZ2V0U2Vzc2lvbkluZ3Jlc3NBdXRoVG9rZW4iLCJzZXR0aW5nc0NoYW5nZURldGVjdG9yIiwic2tpbGxDaGFuZ2VEZXRlY3RvciIsImpzb25QYXJzZSIsIndyaXRlRmlsZVN5bmNfREVQUkVDQVRFRCIsImNvbXB1dGVJbml0aWFsVGVhbUNvbnRleHQiLCJpbml0aWFsaXplV2FybmluZ0hhbmRsZXIiLCJpc1dvcmt0cmVlTW9kZUVuYWJsZWQiLCJnZXRUZWFtbWF0ZVV0aWxzIiwicmVxdWlyZSIsImdldFRlYW1tYXRlUHJvbXB0QWRkZW5kdW0iLCJnZXRUZWFtbWF0ZU1vZGVTbmFwc2hvdCIsImNvb3JkaW5hdG9yTW9kZU1vZHVsZSIsImFzc2lzdGFudE1vZHVsZSIsImthaXJvc0dhdGUiLCJyZWxhdGl2ZSIsInJlc29sdmUiLCJpc0FuYWx5dGljc0Rpc2FibGVkIiwiZ2V0RmVhdHVyZVZhbHVlX0NBQ0hFRF9NQVlfQkVfU1RBTEUiLCJBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTIiwibG9nRXZlbnQiLCJpbml0aWFsaXplQW5hbHl0aWNzR2F0ZXMiLCJnZXRPcmlnaW5hbEN3ZCIsInNldEFkZGl0aW9uYWxEaXJlY3Rvcmllc0ZvckNsYXVkZU1kIiwic2V0SXNSZW1vdGVNb2RlIiwic2V0TWFpbkxvb3BNb2RlbE92ZXJyaWRlIiwic2V0TWFpblRocmVhZEFnZW50VHlwZSIsInNldFRlbGVwb3J0ZWRTZXNzaW9uSW5mbyIsImZpbHRlckNvbW1hbmRzRm9yUmVtb3RlTW9kZSIsImdldENvbW1hbmRzIiwiU3RhdHNTdG9yZSIsImxhdW5jaEFzc2lzdGFudEluc3RhbGxXaXphcmQiLCJsYXVuY2hBc3Npc3RhbnRTZXNzaW9uQ2hvb3NlciIsImxhdW5jaEludmFsaWRTZXR0aW5nc0RpYWxvZyIsImxhdW5jaFJlc3VtZUNob29zZXIiLCJsYXVuY2hTbmFwc2hvdFVwZGF0ZURpYWxvZyIsImxhdW5jaFRlbGVwb3J0UmVwb01pc21hdGNoRGlhbG9nIiwibGF1bmNoVGVsZXBvcnRSZXN1bWVXcmFwcGVyIiwiU0hPV19DVVJTT1IiLCJleGl0V2l0aEVycm9yIiwiZXhpdFdpdGhNZXNzYWdlIiwiZ2V0UmVuZGVyQ29udGV4dCIsInJlbmRlckFuZFJ1biIsInNob3dTZXR1cFNjcmVlbnMiLCJpbml0QnVpbHRpblBsdWdpbnMiLCJjaGVja1F1b3RhU3RhdHVzIiwiZ2V0TWNwVG9vbHNDb21tYW5kc0FuZFJlc291cmNlcyIsInByZWZldGNoQWxsTWNwUmVzb3VyY2VzIiwiVkFMSURfSU5TVEFMTEFCTEVfU0NPUEVTIiwiVkFMSURfVVBEQVRFX1NDT1BFUyIsImluaXRCdW5kbGVkU2tpbGxzIiwiQWdlbnRDb2xvck5hbWUiLCJnZXRBY3RpdmVBZ2VudHNGcm9tTGlzdCIsImdldEFnZW50RGVmaW5pdGlvbnNXaXRoT3ZlcnJpZGVzIiwiaXNCdWlsdEluQWdlbnQiLCJpc0N1c3RvbUFnZW50IiwicGFyc2VBZ2VudHNGcm9tSnNvbiIsIkxvZ09wdGlvbiIsIk1lc3NhZ2UiLCJNZXNzYWdlVHlwZSIsImFzc2VydE1pblZlcnNpb24iLCJDTEFVREVfSU5fQ0hST01FX1NLSUxMX0hJTlQiLCJDTEFVREVfSU5fQ0hST01FX1NLSUxMX0hJTlRfV0lUSF9XRUJCUk9XU0VSIiwic2V0dXBDbGF1ZGVJbkNocm9tZSIsInNob3VsZEF1dG9FbmFibGVDbGF1ZGVJbkNocm9tZSIsInNob3VsZEVuYWJsZUNsYXVkZUluQ2hyb21lIiwiZ2V0Q29udGV4dFdpbmRvd0Zvck1vZGVsIiwibG9hZENvbnZlcnNhdGlvbkZvclJlc3VtZSIsImJ1aWxkRGVlcExpbmtCYW5uZXIiLCJoYXNOb2RlT3B0aW9uIiwiaXNCYXJlTW9kZSIsImlzRW52VHJ1dGh5IiwiaXNJblByb3RlY3RlZE5hbWVzcGFjZSIsInJlZnJlc2hFeGFtcGxlQ29tbWFuZHMiLCJGcHNNZXRyaWNzIiwiZ2V0V29ya3RyZWVQYXRocyIsImZpbmRHaXRSb290IiwiZ2V0QnJhbmNoIiwiZ2V0SXNHaXQiLCJnZXRXb3JrdHJlZUNvdW50IiwiZ2V0R2hBdXRoU3RhdHVzIiwic2FmZVBhcnNlSlNPTiIsImxvZ0Vycm9yIiwiZ2V0TW9kZWxEZXByZWNhdGlvbldhcm5pbmciLCJnZXREZWZhdWx0TWFpbkxvb3BNb2RlbCIsImdldFVzZXJTcGVjaWZpZWRNb2RlbFNldHRpbmciLCJub3JtYWxpemVNb2RlbFN0cmluZ0ZvckFQSSIsInBhcnNlVXNlclNwZWNpZmllZE1vZGVsIiwiZW5zdXJlTW9kZWxTdHJpbmdzSW5pdGlhbGl6ZWQiLCJQRVJNSVNTSU9OX01PREVTIiwiY2hlY2tBbmREaXNhYmxlQnlwYXNzUGVybWlzc2lvbnMiLCJnZXRBdXRvTW9kZUVuYWJsZWRTdGF0ZUlmQ2FjaGVkIiwiaW5pdGlhbGl6ZVRvb2xQZXJtaXNzaW9uQ29udGV4dCIsImluaXRpYWxQZXJtaXNzaW9uTW9kZUZyb21DTEkiLCJpc0RlZmF1bHRQZXJtaXNzaW9uTW9kZUF1dG8iLCJwYXJzZVRvb2xMaXN0RnJvbUNMSSIsInJlbW92ZURhbmdlcm91c1Blcm1pc3Npb25zIiwic3RyaXBEYW5nZXJvdXNQZXJtaXNzaW9uc0ZvckF1dG9Nb2RlIiwidmVyaWZ5QXV0b01vZGVHYXRlQWNjZXNzIiwiY2xlYW51cE9ycGhhbmVkUGx1Z2luVmVyc2lvbnNJbkJhY2tncm91bmQiLCJpbml0aWFsaXplVmVyc2lvbmVkUGx1Z2lucyIsImdldE1hbmFnZWRQbHVnaW5OYW1lcyIsImdldEdsb2JFeGNsdXNpb25zRm9yUGx1Z2luQ2FjaGUiLCJnZXRQbHVnaW5TZWVkRGlycyIsImNvdW50RmlsZXNSb3VuZGVkUmciLCJwcm9jZXNzU2Vzc2lvblN0YXJ0SG9va3MiLCJwcm9jZXNzU2V0dXBIb29rcyIsImNhY2hlU2Vzc2lvblRpdGxlIiwiZ2V0U2Vzc2lvbklkRnJvbUxvZyIsImxvYWRUcmFuc2NyaXB0RnJvbUZpbGUiLCJzYXZlQWdlbnRTZXR0aW5nIiwic2F2ZU1vZGUiLCJzZWFyY2hTZXNzaW9uc0J5Q3VzdG9tVGl0bGUiLCJzZXNzaW9uSWRFeGlzdHMiLCJlbnN1cmVNZG1TZXR0aW5nc0xvYWRlZCIsImdldEluaXRpYWxTZXR0aW5ncyIsImdldE1hbmFnZWRTZXR0aW5nc0tleXNGb3JMb2dnaW5nIiwiZ2V0U2V0dGluZ3NGb3JTb3VyY2UiLCJnZXRTZXR0aW5nc1dpdGhFcnJvcnMiLCJyZXNldFNldHRpbmdzQ2FjaGUiLCJWYWxpZGF0aW9uRXJyb3IiLCJERUZBVUxUX1RBU0tTX01PREVfVEFTS19MSVNUX0lEIiwiVEFTS19TVEFUVVNFUyIsImxvZ1BsdWdpbkxvYWRFcnJvcnMiLCJsb2dQbHVnaW5zRW5hYmxlZEZvclNlc3Npb24iLCJsb2dTa2lsbHNMb2FkZWQiLCJnZW5lcmF0ZVRlbXBGaWxlUGF0aCIsInZhbGlkYXRlVXVpZCIsInJlZ2lzdGVyTWNwQWRkQ29tbWFuZCIsInJlZ2lzdGVyTWNwWGFhSWRwQ29tbWFuZCIsImxvZ1Blcm1pc3Npb25Db250ZXh0Rm9yQW50cyIsImZldGNoQ2xhdWRlQUlNY3BDb25maWdzSWZFbGlnaWJsZSIsImNsZWFyU2VydmVyQ2FjaGUiLCJhcmVNY3BDb25maWdzQWxsb3dlZFdpdGhFbnRlcnByaXNlTWNwQ29uZmlnIiwiZGVkdXBDbGF1ZGVBaU1jcFNlcnZlcnMiLCJkb2VzRW50ZXJwcmlzZU1jcENvbmZpZ0V4aXN0IiwiZmlsdGVyTWNwU2VydmVyc0J5UG9saWN5IiwiZ2V0Q2xhdWRlQ29kZU1jcENvbmZpZ3MiLCJnZXRNY3BTZXJ2ZXJTaWduYXR1cmUiLCJwYXJzZU1jcENvbmZpZyIsInBhcnNlTWNwQ29uZmlnRnJvbUZpbGVQYXRoIiwiZXhjbHVkZUNvbW1hbmRzQnlTZXJ2ZXIiLCJleGNsdWRlUmVzb3VyY2VzQnlTZXJ2ZXIiLCJpc1hhYUVuYWJsZWQiLCJnZXRSZWxldmFudFRpcHMiLCJsb2dDb250ZXh0TWV0cmljcyIsIkNMQVVERV9JTl9DSFJPTUVfTUNQX1NFUlZFUl9OQU1FIiwiaXNDbGF1ZGVJbkNocm9tZU1DUFNlcnZlciIsInJlZ2lzdGVyQ2xlYW51cCIsImVhZ2VyUGFyc2VDbGlGbGFnIiwiY3JlYXRlRW1wdHlBdHRyaWJ1dGlvblN0YXRlIiwiY291bnRDb25jdXJyZW50U2Vzc2lvbnMiLCJyZWdpc3RlclNlc3Npb24iLCJ1cGRhdGVTZXNzaW9uTmFtZSIsImdldEN3ZCIsImxvZ0ZvckRlYnVnZ2luZyIsInNldEhhc0Zvcm1hdHRlZE91dHB1dCIsImVycm9yTWVzc2FnZSIsImdldEVycm5vQ29kZSIsImlzRU5PRU5UIiwiVGVsZXBvcnRPcGVyYXRpb25FcnJvciIsInRvRXJyb3IiLCJnZXRGc0ltcGxlbWVudGF0aW9uIiwic2FmZVJlc29sdmVQYXRoIiwiZ3JhY2VmdWxTaHV0ZG93biIsImdyYWNlZnVsU2h1dGRvd25TeW5jIiwic2V0QWxsSG9va0V2ZW50c0VuYWJsZWQiLCJyZWZyZXNoTW9kZWxDYXBhYmlsaXRpZXMiLCJwZWVrRm9yU3RkaW5EYXRhIiwid3JpdGVUb1N0ZGVyciIsInNldEN3ZCIsIlByb2Nlc3NlZFJlc3VtZSIsInByb2Nlc3NSZXN1bWVkQ29udmVyc2F0aW9uIiwicGFyc2VTZXR0aW5nU291cmNlc0ZsYWciLCJwbHVyYWwiLCJDaGFubmVsRW50cnkiLCJnZXRJbml0aWFsTWFpbkxvb3BNb2RlbCIsImdldElzTm9uSW50ZXJhY3RpdmVTZXNzaW9uIiwiZ2V0U2RrQmV0YXMiLCJnZXRTZXNzaW9uSWQiLCJnZXRVc2VyTXNnT3B0SW4iLCJzZXRBbGxvd2VkQ2hhbm5lbHMiLCJzZXRBbGxvd2VkU2V0dGluZ1NvdXJjZXMiLCJzZXRDaHJvbWVGbGFnT3ZlcnJpZGUiLCJzZXRDbGllbnRUeXBlIiwic2V0Q3dkU3RhdGUiLCJzZXREaXJlY3RDb25uZWN0U2VydmVyVXJsIiwic2V0RmxhZ1NldHRpbmdzUGF0aCIsInNldEluaXRpYWxNYWluTG9vcE1vZGVsIiwic2V0SW5saW5lUGx1Z2lucyIsInNldElzSW50ZXJhY3RpdmUiLCJzZXRLYWlyb3NBY3RpdmUiLCJzZXRPcmlnaW5hbEN3ZCIsInNldFF1ZXN0aW9uUHJldmlld0Zvcm1hdCIsInNldFNka0JldGFzIiwic2V0U2Vzc2lvbkJ5cGFzc1Blcm1pc3Npb25zTW9kZSIsInNldFNlc3Npb25QZXJzaXN0ZW5jZURpc2FibGVkIiwic2V0U2Vzc2lvblNvdXJjZSIsInNldFVzZXJNc2dPcHRJbiIsInN3aXRjaFNlc3Npb24iLCJhdXRvTW9kZVN0YXRlTW9kdWxlIiwibWlncmF0ZUF1dG9VcGRhdGVzVG9TZXR0aW5ncyIsIm1pZ3JhdGVCeXBhc3NQZXJtaXNzaW9uc0FjY2VwdGVkVG9TZXR0aW5ncyIsIm1pZ3JhdGVFbmFibGVBbGxQcm9qZWN0TWNwU2VydmVyc1RvU2V0dGluZ3MiLCJtaWdyYXRlRmVubmVjVG9PcHVzIiwibWlncmF0ZUxlZ2FjeU9wdXNUb0N1cnJlbnQiLCJtaWdyYXRlT3B1c1RvT3B1czFtIiwibWlncmF0ZVJlcGxCcmlkZ2VFbmFibGVkVG9SZW1vdGVDb250cm9sQXRTdGFydHVwIiwibWlncmF0ZVNvbm5ldDFtVG9Tb25uZXQ0NSIsIm1pZ3JhdGVTb25uZXQ0NVRvU29ubmV0NDYiLCJyZXNldEF1dG9Nb2RlT3B0SW5Gb3JEZWZhdWx0T2ZmZXIiLCJyZXNldFByb1RvT3B1c0RlZmF1bHQiLCJjcmVhdGVSZW1vdGVTZXNzaW9uQ29uZmlnIiwiY3JlYXRlRGlyZWN0Q29ubmVjdFNlc3Npb24iLCJEaXJlY3RDb25uZWN0RXJyb3IiLCJpbml0aWFsaXplTHNwU2VydmVyTWFuYWdlciIsInNob3VsZEVuYWJsZVByb21wdFN1Z2dlc3Rpb24iLCJBcHBTdGF0ZSIsImdldERlZmF1bHRBcHBTdGF0ZSIsIklETEVfU1BFQ1VMQVRJT05fU1RBVEUiLCJvbkNoYW5nZUFwcFN0YXRlIiwiY3JlYXRlU3RvcmUiLCJhc1Nlc3Npb25JZCIsImZpbHRlckFsbG93ZWRTZGtCZXRhcyIsImlzSW5CdW5kbGVkTW9kZSIsImlzUnVubmluZ1dpdGhCdW4iLCJsb2dGb3JEaWFnbm9zdGljc05vUElJIiwiZmlsdGVyRXhpc3RpbmdQYXRocyIsImdldEtub3duUGF0aHNGb3JSZXBvIiwiY2xlYXJQbHVnaW5DYWNoZSIsImxvYWRBbGxQbHVnaW5zQ2FjaGVPbmx5IiwibWlncmF0ZUNoYW5nZWxvZ0Zyb21Db25maWciLCJTYW5kYm94TWFuYWdlciIsImZldGNoU2Vzc2lvbiIsInByZXBhcmVBcGlSZXF1ZXN0IiwiY2hlY2tPdXRUZWxlcG9ydGVkU2Vzc2lvbkJyYW5jaCIsInByb2Nlc3NNZXNzYWdlc0ZvclRlbGVwb3J0UmVzdW1lIiwidGVsZXBvcnRUb1JlbW90ZVdpdGhFcnJvckhhbmRsaW5nIiwidmFsaWRhdGVHaXRTdGF0ZSIsInZhbGlkYXRlU2Vzc2lvblJlcG9zaXRvcnkiLCJzaG91bGRFbmFibGVUaGlua2luZ0J5RGVmYXVsdCIsIlRoaW5raW5nQ29uZmlnIiwiaW5pdFVzZXIiLCJyZXNldFVzZXJDYWNoZSIsImdldFRtdXhJbnN0YWxsSW5zdHJ1Y3Rpb25zIiwiaXNUbXV4QXZhaWxhYmxlIiwicGFyc2VQUlJlZmVyZW5jZSIsImxvZ01hbmFnZWRTZXR0aW5ncyIsInBvbGljeVNldHRpbmdzIiwiYWxsS2V5cyIsImtleUNvdW50IiwibGVuZ3RoIiwia2V5cyIsImpvaW4iLCJpc0JlaW5nRGVidWdnZWQiLCJpc0J1biIsImhhc0luc3BlY3RBcmciLCJwcm9jZXNzIiwiZXhlY0FyZ3YiLCJzb21lIiwiYXJnIiwidGVzdCIsImhhc0luc3BlY3RFbnYiLCJlbnYiLCJOT0RFX09QVElPTlMiLCJpbnNwZWN0b3IiLCJnbG9iYWwiLCJoYXNJbnNwZWN0b3JVcmwiLCJ1cmwiLCJleGl0IiwibG9nU2Vzc2lvblRlbGVtZXRyeSIsIm1vZGVsIiwidGhlbiIsImVuYWJsZWQiLCJlcnJvcnMiLCJtYW5hZ2VkTmFtZXMiLCJjYXRjaCIsImVyciIsImdldENlcnRFbnZWYXJUZWxlbWV0cnkiLCJSZWNvcmQiLCJyZXN1bHQiLCJOT0RFX0VYVFJBX0NBX0NFUlRTIiwiaGFzX25vZGVfZXh0cmFfY2FfY2VydHMiLCJDTEFVREVfQ09ERV9DTElFTlRfQ0VSVCIsImhhc19jbGllbnRfY2VydCIsImhhc191c2Vfc3lzdGVtX2NhIiwiaGFzX3VzZV9vcGVuc3NsX2NhIiwibG9nU3RhcnR1cFRlbGVtZXRyeSIsIlByb21pc2UiLCJpc0dpdCIsIndvcmt0cmVlQ291bnQiLCJnaEF1dGhTdGF0dXMiLCJhbGwiLCJpc19naXQiLCJ3b3JrdHJlZV9jb3VudCIsImdoX2F1dGhfc3RhdHVzIiwic2FuZGJveF9lbmFibGVkIiwiaXNTYW5kYm94aW5nRW5hYmxlZCIsImFyZV91bnNhbmRib3hlZF9jb21tYW5kc19hbGxvd2VkIiwiYXJlVW5zYW5kYm94ZWRDb21tYW5kc0FsbG93ZWQiLCJpc19hdXRvX2Jhc2hfYWxsb3dlZF9pZl9zYW5kYm94X2VuYWJsZWQiLCJpc0F1dG9BbGxvd0Jhc2hJZlNhbmRib3hlZEVuYWJsZWQiLCJhdXRvX3VwZGF0ZXJfZGlzYWJsZWQiLCJwcmVmZXJzX3JlZHVjZWRfbW90aW9uIiwicHJlZmVyc1JlZHVjZWRNb3Rpb24iLCJDVVJSRU5UX01JR1JBVElPTl9WRVJTSU9OIiwicnVuTWlncmF0aW9ucyIsIm1pZ3JhdGlvblZlcnNpb24iLCJwcmV2IiwicHJlZmV0Y2hTeXN0ZW1Db250ZXh0SWZTYWZlIiwiaXNOb25JbnRlcmFjdGl2ZVNlc3Npb24iLCJoYXNUcnVzdCIsInN0YXJ0RGVmZXJyZWRQcmVmZXRjaGVzIiwiQ0xBVURFX0NPREVfRVhJVF9BRlRFUl9GSVJTVF9SRU5ERVIiLCJDTEFVREVfQ09ERV9VU0VfQkVEUk9DSyIsIkNMQVVERV9DT0RFX1NLSVBfQkVEUk9DS19BVVRIIiwiQ0xBVURFX0NPREVfVVNFX1ZFUlRFWCIsIkNMQVVERV9DT0RFX1NLSVBfVkVSVEVYX0FVVEgiLCJBYm9ydFNpZ25hbCIsInRpbWVvdXQiLCJpbml0aWFsaXplIiwibSIsInN0YXJ0RXZlbnRMb29wU3RhbGxEZXRlY3RvciIsImxvYWRTZXR0aW5nc0Zyb21GbGFnIiwic2V0dGluZ3NGaWxlIiwidHJpbW1lZFNldHRpbmdzIiwidHJpbSIsImxvb2tzTGlrZUpzb24iLCJzdGFydHNXaXRoIiwiZW5kc1dpdGgiLCJzZXR0aW5nc1BhdGgiLCJwYXJzZWRKc29uIiwic3RkZXJyIiwid3JpdGUiLCJyZWQiLCJjb250ZW50SGFzaCIsInJlc29sdmVkUGF0aCIsInJlc29sdmVkU2V0dGluZ3NQYXRoIiwiZSIsImVycm9yIiwiRXJyb3IiLCJsb2FkU2V0dGluZ1NvdXJjZXNGcm9tRmxhZyIsInNldHRpbmdTb3VyY2VzQXJnIiwic291cmNlcyIsImVhZ2VyTG9hZFNldHRpbmdzIiwidW5kZWZpbmVkIiwiaW5pdGlhbGl6ZUVudHJ5cG9pbnQiLCJpc05vbkludGVyYWN0aXZlIiwiQ0xBVURFX0NPREVfRU5UUllQT0lOVCIsImNsaUFyZ3MiLCJhcmd2Iiwic2xpY2UiLCJtY3BJbmRleCIsImluZGV4T2YiLCJDTEFVREVfQ09ERV9BQ1RJT04iLCJQZW5kaW5nQ29ubmVjdCIsImF1dGhUb2tlbiIsImRhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zIiwiX3BlbmRpbmdDb25uZWN0IiwiUGVuZGluZ0Fzc2lzdGFudENoYXQiLCJzZXNzaW9uSWQiLCJkaXNjb3ZlciIsIl9wZW5kaW5nQXNzaXN0YW50Q2hhdCIsIlBlbmRpbmdTU0giLCJob3N0IiwiY3dkIiwicGVybWlzc2lvbk1vZGUiLCJsb2NhbCIsImV4dHJhQ2xpQXJncyIsIl9wZW5kaW5nU1NIIiwibWFpbiIsIk5vRGVmYXVsdEN1cnJlbnREaXJlY3RvcnlJbkV4ZVBhdGgiLCJvbiIsInJlc2V0Q3Vyc29yIiwiaW5jbHVkZXMiLCJyYXdDbGlBcmdzIiwiY2NJZHgiLCJmaW5kSW5kZXgiLCJhIiwiY2NVcmwiLCJwYXJzZUNvbm5lY3RVcmwiLCJwYXJzZWQiLCJzdHJpcHBlZCIsImZpbHRlciIsIl8iLCJpIiwiZHNwSWR4Iiwic3BsaWNlIiwic2VydmVyVXJsIiwiaGFuZGxlVXJpSWR4IiwiZW5hYmxlQ29uZmlncyIsInVyaSIsImhhbmRsZURlZXBMaW5rVXJpIiwiZXhpdENvZGUiLCJwbGF0Zm9ybSIsIl9fQ0ZCdW5kbGVJZGVudGlmaWVyIiwiaGFuZGxlVXJsU2NoZW1lTGF1bmNoIiwidXJsU2NoZW1lUmVzdWx0IiwicmF3QXJncyIsIm5leHRBcmciLCJsb2NhbElkeCIsInBtSWR4IiwicG1FcUlkeCIsInNwbGl0IiwiZXh0cmFjdEZsYWciLCJmbGFnIiwib3B0cyIsImhhc1ZhbHVlIiwiYXMiLCJwdXNoIiwidmFsIiwiZXFJIiwiY29uc3VtZWQiLCJyZXN0IiwiaGFzUHJpbnRGbGFnIiwiaGFzSW5pdE9ubHlGbGFnIiwiaGFzU2RrVXJsIiwic3Rkb3V0IiwiaXNUVFkiLCJpc0ludGVyYWN0aXZlIiwiY2xpZW50VHlwZSIsIkdJVEhVQl9BQ1RJT05TIiwiaGFzU2Vzc2lvbkluZ3Jlc3NUb2tlbiIsIkNMQVVERV9DT0RFX1NFU1NJT05fQUNDRVNTX1RPS0VOIiwiQ0xBVURFX0NPREVfV0VCU09DS0VUX0FVVEhfRklMRV9ERVNDUklQVE9SIiwicHJldmlld0Zvcm1hdCIsIkNMQVVERV9DT0RFX1FVRVNUSU9OX1BSRVZJRVdfRk9STUFUIiwiQ0xBVURFX0NPREVfRU5WSVJPTk1FTlRfS0lORCIsInJ1biIsImdldElucHV0UHJvbXB0IiwicHJvbXB0IiwiaW5wdXRGb3JtYXQiLCJBc3luY0l0ZXJhYmxlIiwic3RkaW4iLCJzZXRFbmNvZGluZyIsImRhdGEiLCJvbkRhdGEiLCJjaHVuayIsInRpbWVkT3V0Iiwib2ZmIiwiQm9vbGVhbiIsImNyZWF0ZVNvcnRlZEhlbHBDb25maWciLCJzb3J0U3ViY29tbWFuZHMiLCJzb3J0T3B0aW9ucyIsImdldE9wdGlvblNvcnRLZXkiLCJvcHQiLCJsb25nIiwicmVwbGFjZSIsInNob3J0IiwiT2JqZWN0IiwiYXNzaWduIiwiY29uc3QiLCJjb21wYXJlT3B0aW9ucyIsImIiLCJsb2NhbGVDb21wYXJlIiwicHJvZ3JhbSIsImNvbmZpZ3VyZUhlbHAiLCJlbmFibGVQb3NpdGlvbmFsT3B0aW9ucyIsImhvb2siLCJ0aGlzQ29tbWFuZCIsIkNMQVVERV9DT0RFX0RJU0FCTEVfVEVSTUlOQUxfVElUTEUiLCJ0aXRsZSIsImluaXRTaW5rcyIsInBsdWdpbkRpciIsImdldE9wdGlvblZhbHVlIiwiQXJyYXkiLCJpc0FycmF5IiwiZXZlcnkiLCJwIiwidXBsb2FkVXNlclNldHRpbmdzSW5CYWNrZ3JvdW5kIiwibmFtZSIsImRlc2NyaXB0aW9uIiwiYXJndW1lbnQiLCJTdHJpbmciLCJoZWxwT3B0aW9uIiwib3B0aW9uIiwiX3ZhbHVlIiwiYWRkT3B0aW9uIiwiYXJnUGFyc2VyIiwiaGlkZUhlbHAiLCJjaG9pY2VzIiwiTnVtYmVyIiwidmFsdWUiLCJhbW91bnQiLCJpc05hTiIsInRva2VucyIsImlzSW50ZWdlciIsImRlZmF1bHQiLCJ2IiwibiIsImlzRmluaXRlIiwicmF3VmFsdWUiLCJ0b0xvd2VyQ2FzZSIsImFsbG93ZWQiLCJhY3Rpb24iLCJvcHRpb25zIiwiYmFyZSIsIkNMQVVERV9DT0RFX1NJTVBMRSIsImNvbnNvbGUiLCJ3YXJuIiwieWVsbG93Iiwia2Fpcm9zRW5hYmxlZCIsImFzc2lzdGFudFRlYW1Db250ZXh0IiwiQXdhaXRlZCIsIlJldHVyblR5cGUiLCJOb25OdWxsYWJsZSIsImFzc2lzdGFudCIsIm1hcmtBc3Npc3RhbnRGb3JjZWQiLCJpc0Fzc2lzdGFudE1vZGUiLCJhZ2VudElkIiwiaXNBc3Npc3RhbnRGb3JjZWQiLCJpc0thaXJvc0VuYWJsZWQiLCJicmllZiIsImluaXRpYWxpemVBc3Npc3RhbnRUZWFtIiwiZGVidWciLCJkZWJ1Z1RvU3RkZXJyIiwiYWxsb3dEYW5nZXJvdXNseVNraXBQZXJtaXNzaW9ucyIsInRvb2xzIiwiYmFzZVRvb2xzIiwiYWxsb3dlZFRvb2xzIiwiZGlzYWxsb3dlZFRvb2xzIiwibWNwQ29uZmlnIiwicGVybWlzc2lvbk1vZGVDbGkiLCJhZGREaXIiLCJmYWxsYmFja01vZGVsIiwiYmV0YXMiLCJpZGUiLCJpbmNsdWRlSG9va0V2ZW50cyIsImluY2x1ZGVQYXJ0aWFsTWVzc2FnZXMiLCJwcmVmaWxsIiwiZmlsZURvd25sb2FkUHJvbWlzZSIsImFnZW50c0pzb24iLCJhZ2VudHMiLCJhZ2VudENsaSIsImFnZW50IiwiQ0xBVURFX0NPREVfQUdFTlQiLCJvdXRwdXRGb3JtYXQiLCJ2ZXJib3NlIiwicHJpbnQiLCJpbml0T25seSIsIm1haW50ZW5hbmNlIiwiZGlzYWJsZVNsYXNoQ29tbWFuZHMiLCJ0YXNrc09wdGlvbiIsInRhc2tzIiwidGFza0xpc3RJZCIsIkNMQVVERV9DT0RFX1RBU0tfTElTVF9JRCIsIndvcmt0cmVlT3B0aW9uIiwid29ya3RyZWUiLCJ3b3JrdHJlZU5hbWUiLCJ3b3JrdHJlZUVuYWJsZWQiLCJ3b3JrdHJlZVBSTnVtYmVyIiwicHJOdW0iLCJ0bXV4RW5hYmxlZCIsInRtdXgiLCJzdG9yZWRUZWFtbWF0ZU9wdHMiLCJUZWFtbWF0ZU9wdGlvbnMiLCJ0ZWFtbWF0ZU9wdHMiLCJleHRyYWN0VGVhbW1hdGVPcHRpb25zIiwiaGFzQW55VGVhbW1hdGVPcHQiLCJhZ2VudE5hbWUiLCJ0ZWFtTmFtZSIsImhhc0FsbFJlcXVpcmVkVGVhbW1hdGVPcHRzIiwic2V0RHluYW1pY1RlYW1Db250ZXh0IiwiY29sb3IiLCJhZ2VudENvbG9yIiwicGxhbk1vZGVSZXF1aXJlZCIsInBhcmVudFNlc3Npb25JZCIsInRlYW1tYXRlTW9kZSIsInNldENsaVRlYW1tYXRlTW9kZU92ZXJyaWRlIiwic2RrVXJsIiwiZWZmZWN0aXZlSW5jbHVkZVBhcnRpYWxNZXNzYWdlcyIsIkNMQVVERV9DT0RFX0lOQ0xVREVfUEFSVElBTF9NRVNTQUdFUyIsIkNMQVVERV9DT0RFX1JFTU9URSIsInRlbGVwb3J0IiwicmVtb3RlT3B0aW9uIiwicmVtb3RlIiwicmVtb3RlQ29udHJvbE9wdGlvbiIsInJlbW90ZUNvbnRyb2wiLCJyYyIsInJlbW90ZUNvbnRyb2xOYW1lIiwiY29udGludWUiLCJyZXN1bWUiLCJmb3JrU2Vzc2lvbiIsInZhbGlkYXRlZFNlc3Npb25JZCIsImZpbGVTcGVjcyIsImZpbGUiLCJzZXNzaW9uVG9rZW4iLCJmaWxlU2Vzc2lvbklkIiwiQ0xBVURFX0NPREVfUkVNT1RFX1NFU1NJT05fSUQiLCJmaWxlcyIsImNvbmZpZyIsImJhc2VVcmwiLCJBTlRIUk9QSUNfQkFTRV9VUkwiLCJCQVNFX0FQSV9VUkwiLCJvYXV0aFRva2VuIiwic3lzdGVtUHJvbXB0Iiwic3lzdGVtUHJvbXB0RmlsZSIsImZpbGVQYXRoIiwiY29kZSIsImFwcGVuZFN5c3RlbVByb21wdCIsImFwcGVuZFN5c3RlbVByb21wdEZpbGUiLCJhZGRlbmR1bSIsIlRFQU1NQVRFX1NZU1RFTV9QUk9NUFRfQURERU5EVU0iLCJtb2RlIiwibm90aWZpY2F0aW9uIiwicGVybWlzc2lvbk1vZGVOb3RpZmljYXRpb24iLCJlbmFibGVBdXRvTW9kZSIsInNldEF1dG9Nb2RlRmxhZ0NsaSIsImR5bmFtaWNNY3BDb25maWciLCJwcm9jZXNzZWRDb25maWdzIiwibWFwIiwiYWxsQ29uZmlncyIsImFsbEVycm9ycyIsImNvbmZpZ0l0ZW0iLCJjb25maWdzIiwiY29uZmlnT2JqZWN0IiwiZXhwYW5kVmFycyIsInNjb3BlIiwibWNwU2VydmVycyIsImNvbmZpZ1BhdGgiLCJmb3JtYXR0ZWRFcnJvcnMiLCJwYXRoIiwibWVzc2FnZSIsImxldmVsIiwibm9uU2RrQ29uZmlnTmFtZXMiLCJlbnRyaWVzIiwidHlwZSIsInJlc2VydmVkTmFtZUVycm9yIiwiaXNDb21wdXRlclVzZU1DUFNlcnZlciIsIkNPTVBVVEVSX1VTRV9NQ1BfU0VSVkVSX05BTUUiLCJzY29wZWRDb25maWdzIiwiYmxvY2tlZCIsImNocm9tZU9wdHMiLCJjaHJvbWUiLCJlbmFibGVDbGF1ZGVJbkNocm9tZSIsImF1dG9FbmFibGVDbGF1ZGVJbkNocm9tZSIsImNocm9tZU1jcENvbmZpZyIsImNocm9tZU1jcFRvb2xzIiwiY2hyb21lU3lzdGVtUHJvbXB0IiwiaGludCIsIkJ1biIsInN0cmljdE1jcENvbmZpZyIsImdldENoaWNhZ29FbmFibGVkIiwic2V0dXBDb21wdXRlclVzZU1DUCIsImN1VG9vbHMiLCJkZXZDaGFubmVscyIsInBhcnNlQ2hhbm5lbEVudHJpZXMiLCJyYXciLCJiYWQiLCJjIiwiYXQiLCJraW5kIiwibWFya2V0cGxhY2UiLCJjaGFubmVsT3B0cyIsImNoYW5uZWxzIiwiZGFuZ2Vyb3VzbHlMb2FkRGV2ZWxvcG1lbnRDaGFubmVscyIsInJhd0NoYW5uZWxzIiwicmF3RGV2IiwiY2hhbm5lbEVudHJpZXMiLCJqb2luUGx1Z2luSWRzIiwiaWRzIiwiZmxhdE1hcCIsInNvcnQiLCJjaGFubmVsc19jb3VudCIsImRldl9jb3VudCIsInBsdWdpbnMiLCJkZXZfcGx1Z2lucyIsIkJSSUVGX1RPT0xfTkFNRSIsIkxFR0FDWV9CUklFRl9UT09MX05BTUUiLCJpc0JyaWVmRW50aXRsZWQiLCJpbml0UmVzdWx0IiwiYWxsb3dlZFRvb2xzQ2xpIiwiZGlzYWxsb3dlZFRvb2xzQ2xpIiwiYmFzZVRvb2xzQ2xpIiwiYWRkRGlycyIsInRvb2xQZXJtaXNzaW9uQ29udGV4dCIsIndhcm5pbmdzIiwiZGFuZ2Vyb3VzUGVybWlzc2lvbnMiLCJvdmVybHlCcm9hZEJhc2hQZXJtaXNzaW9ucyIsInBlcm1pc3Npb24iLCJydWxlRGlzcGxheSIsInNvdXJjZURpc3BsYXkiLCJmb3JFYWNoIiwid2FybmluZyIsImNsYXVkZWFpQ29uZmlnUHJvbWlzZSIsIm1jcENvbmZpZ1N0YXJ0IiwiRGF0ZSIsIm5vdyIsIm1jcENvbmZpZ1Jlc29sdmVkTXMiLCJtY3BDb25maWdQcm9taXNlIiwic2VydmVycyIsInJlcGxheVVzZXJNZXNzYWdlcyIsInNlc3Npb25QZXJzaXN0ZW5jZSIsImVmZmVjdGl2ZVByb21wdCIsImlucHV0UHJvbXB0IiwibWF5YmVBY3RpdmF0ZVByb2FjdGl2ZSIsIkNMQVVERV9DT0RFX0NPT1JESU5BVE9SX01PREUiLCJhcHBseUNvb3JkaW5hdG9yVG9vbEZpbHRlciIsImpzb25TY2hlbWEiLCJzeW50aGV0aWNPdXRwdXRSZXN1bHQiLCJ0b29sIiwic2NoZW1hX3Byb3BlcnR5X2NvdW50IiwicHJvcGVydGllcyIsImhhc19yZXF1aXJlZF9maWVsZHMiLCJyZXF1aXJlZCIsInNldHVwU3RhcnQiLCJzZXR1cCIsIm1lc3NhZ2luZ1NvY2tldFBhdGgiLCJwcmVTZXR1cEN3ZCIsInNldHVwUHJvbWlzZSIsImNvbW1hbmRzUHJvbWlzZSIsImFnZW50RGVmc1Byb21pc2UiLCJlZmZlY3RpdmVSZXBsYXlVc2VyTWVzc2FnZXMiLCJzZXNzaW9uTmFtZUFyZyIsImV4cGxpY2l0TW9kZWwiLCJBTlRIUk9QSUNfTU9ERUwiLCJjYWNoZWRHcm93dGhCb29rRmVhdHVyZXMiLCJ1c2VyU3BlY2lmaWVkTW9kZWwiLCJ1c2VyU3BlY2lmaWVkRmFsbGJhY2tNb2RlbCIsImN1cnJlbnRDd2QiLCJjb21tYW5kc1N0YXJ0IiwiY29tbWFuZHMiLCJhZ2VudERlZmluaXRpb25zUmVzdWx0IiwiY2xpQWdlbnRzIiwiYWN0aXZlQWdlbnRzIiwicGFyc2VkQWdlbnRzIiwiYWxsQWdlbnRzIiwiYWdlbnREZWZpbml0aW9ucyIsImFnZW50U2V0dGluZyIsIm1haW5UaHJlYWRBZ2VudERlZmluaXRpb24iLCJmaW5kIiwiYWdlbnRUeXBlIiwic291cmNlIiwiYWdlbnRTeXN0ZW1Qcm9tcHQiLCJnZXRTeXN0ZW1Qcm9tcHQiLCJpbml0aWFsUHJvbXB0IiwiZWZmZWN0aXZlTW9kZWwiLCJpbml0aWFsTWFpbkxvb3BNb2RlbCIsInJlc29sdmVkSW5pdGlhbE1vZGVsIiwiYWR2aXNvck1vZGVsIiwiYWR2aXNvck9wdGlvbiIsImFkdmlzb3IiLCJub3JtYWxpemVkQWR2aXNvck1vZGVsIiwiY3VzdG9tQWdlbnQiLCJjdXN0b21Qcm9tcHQiLCJtZW1vcnkiLCJhZ2VudF90eXBlIiwiY3VzdG9tSW5zdHJ1Y3Rpb25zIiwibWF5YmVBY3RpdmF0ZUJyaWVmIiwiZGVmYXVsdFZpZXciLCJwcm9hY3RpdmUiLCJDTEFVREVfQ09ERV9QUk9BQ1RJVkUiLCJpc0Nvb3JkaW5hdG9yTW9kZSIsImJyaWVmVmlzaWJpbGl0eSIsImlzQnJpZWZFbmFibGVkIiwicHJvYWN0aXZlUHJvbXB0IiwiYXNzaXN0YW50QWRkZW5kdW0iLCJnZXRBc3Npc3RhbnRTeXN0ZW1Qcm9tcHRBZGRlbmR1bSIsInJvb3QiLCJnZXRGcHNNZXRyaWNzIiwic3RhdHMiLCJjdHgiLCJjcmVhdGVSb290IiwicmVuZGVyT3B0aW9ucyIsImV2ZW50IiwiZHVyYXRpb25NcyIsIk1hdGgiLCJyb3VuZCIsInVwdGltZSIsInNldHVwU2NyZWVuc1N0YXJ0Iiwib25ib2FyZGluZ1Nob3duIiwiZ2V0QnJpZGdlRGlzYWJsZWRSZWFzb24iLCJkaXNhYmxlZFJlYXNvbiIsInBlbmRpbmdTbmFwc2hvdFVwZGF0ZSIsImFnZW50RGVmIiwiY2hvaWNlIiwic25hcHNob3RUaW1lc3RhbXAiLCJidWlsZE1lcmdlUHJvbXB0IiwibWVyZ2VQcm9tcHQiLCJjbGVhclRydXN0ZWREZXZpY2VUb2tlbiIsImVucm9sbFRydXN0ZWREZXZpY2UiLCJvcmdWYWxpZGF0aW9uIiwidmFsaWQiLCJub25NY3BFcnJvcnMiLCJtY3BFcnJvck1ldGFkYXRhIiwic2V0dGluZ3NFcnJvcnMiLCJvbkV4aXQiLCJiZ1JlZnJlc2hUaHJvdHRsZU1zIiwibGFzdFByZWZldGNoZWQiLCJzdGFydHVwUHJlZmV0Y2hlZEF0Iiwic2tpcFN0YXJ0dXBQcmVmZXRjaGVzIiwibGFzdFByZWZldGNoZWRJbmZvIiwiY3VycmVudCIsImV4aXN0aW5nTWNwQ29uZmlncyIsImFsbE1jcENvbmZpZ3MiLCJzZGtNY3BDb25maWdzIiwicmVndWxhck1jcENvbmZpZ3MiLCJ0eXBlZENvbmZpZyIsImxvY2FsTWNwUHJvbWlzZSIsImNsaWVudHMiLCJjbGF1ZGVhaU1jcFByb21pc2UiLCJtY3BQcm9taXNlIiwiY2xhdWRlYWkiLCJob29rc1Byb21pc2UiLCJob29rTWVzc2FnZXMiLCJtY3BDbGllbnRzIiwibWNwVG9vbHMiLCJtY3BDb21tYW5kcyIsInRoaW5raW5nRW5hYmxlZCIsInRoaW5raW5nQ29uZmlnIiwidGhpbmtpbmciLCJtYXhUaGlua2luZ1Rva2VucyIsIk1BWF9USElOS0lOR19UT0tFTlMiLCJwYXJzZUludCIsImJ1ZGdldFRva2VucyIsInZlcnNpb24iLCJNQUNSTyIsIlZFUlNJT04iLCJpc19uYXRpdmVfYmluYXJ5IiwibG9nVGVuZ3VJbml0IiwiaGFzSW5pdGlhbFByb21wdCIsImhhc1N0ZGluIiwibnVtQWxsb3dlZFRvb2xzIiwibnVtRGlzYWxsb3dlZFRvb2xzIiwibWNwQ2xpZW50Q291bnQiLCJza2lwV2ViRmV0Y2hQcmVmbGlnaHQiLCJnaXRodWJBY3Rpb25JbnB1dHMiLCJHSVRIVUJfQUNUSU9OX0lOUFVUUyIsImRhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zUGFzc2VkIiwibW9kZUlzQnlwYXNzIiwiYWxsb3dEYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uc1Bhc3NlZCIsInN5c3RlbVByb21wdEZsYWciLCJhcHBlbmRTeXN0ZW1Qcm9tcHRGbGFnIiwiYXNzaXN0YW50QWN0aXZhdGlvblBhdGgiLCJnZXRBc3Npc3RhbnRBY3RpdmF0aW9uUGF0aCIsInJlZ2lzdGVyZWQiLCJudW1fc2Vzc2lvbnMiLCJzZXR1cFRyaWdnZXIiLCJmb3JjZVN5bmNFeGVjdXRpb24iLCJzZXNzaW9uU3RhcnRIb29rc1Byb21pc2UiLCJjb21tYW5kc0hlYWRsZXNzIiwiY29tbWFuZCIsImRpc2FibGVOb25JbnRlcmFjdGl2ZSIsInN1cHBvcnRzTm9uSW50ZXJhY3RpdmUiLCJkZWZhdWx0U3RhdGUiLCJoZWFkbGVzc0luaXRpYWxTdGF0ZSIsIm1jcCIsImVmZm9ydFZhbHVlIiwiZWZmb3J0IiwiZmFzdE1vZGUiLCJoZWFkbGVzc1N0b3JlIiwiZ2V0U3RhdGUiLCJ1cGRhdGVDb250ZXh0Iiwic2V0U3RhdGUiLCJuZXh0Q3R4IiwiY29ubmVjdE1jcEJhdGNoIiwibGFiZWwiLCJjbGllbnQiLCJDTEFVREVfQUlfTUNQX1RJTUVPVVRfTVMiLCJjbGF1ZGVhaUNvbm5lY3QiLCJjbGF1ZGVhaUNvbmZpZ3MiLCJjbGF1ZGVhaVNpZ3MiLCJTZXQiLCJ2YWx1ZXMiLCJzaWciLCJhZGQiLCJzdXBwcmVzc2VkIiwiaGFzIiwic2l6ZSIsIm9uY2xvc2UiLCJyZXNvdXJjZXMiLCJ0IiwibWNwSW5mbyIsInNlcnZlck5hbWUiLCJub25QbHVnaW5Db25maWdzIiwiZGVkdXBlZENsYXVkZUFpIiwiY2xhdWRlYWlUaW1lciIsInNldFRpbWVvdXQiLCJjbGF1ZGVhaVRpbWVkT3V0IiwicmFjZSIsInIiLCJjbGVhclRpbWVvdXQiLCJzdGFydEJhY2tncm91bmRIb3VzZWtlZXBpbmciLCJzdGFydFNka01lbW9yeU1vbml0b3IiLCJydW5IZWFkbGVzcyIsInBlcm1pc3Npb25Qcm9tcHRUb29sTmFtZSIsInBlcm1pc3Npb25Qcm9tcHRUb29sIiwibWF4VHVybnMiLCJtYXhCdWRnZXRVc2QiLCJ0YXNrQnVkZ2V0IiwidG90YWwiLCJyZXN1bWVTZXNzaW9uQXQiLCJyZXdpbmRGaWxlcyIsImVuYWJsZUF1dGhTdGF0dXMiLCJ3b3JrbG9hZCIsImNsaV9mbGFnIiwiZW52X3ZhciIsInNldHRpbmdzX2ZpbGUiLCJzdWJzY3JpcHRpb25UeXBlIiwiZGVwcmVjYXRpb25XYXJuaW5nIiwiaW5pdGlhbE5vdGlmaWNhdGlvbnMiLCJrZXkiLCJ0ZXh0IiwicHJpb3JpdHkiLCJkaXNwbGF5TGlzdCIsImRpc3BsYXlzIiwiZWZmZWN0aXZlVG9vbFBlcm1pc3Npb25Db250ZXh0IiwiaXNQbGFuTW9kZVJlcXVpcmVkIiwiaW5pdGlhbElzQnJpZWZPbmx5IiwiZnVsbFJlbW90ZUNvbnRyb2wiLCJjY3JNaXJyb3JFbmFibGVkIiwiaXNDY3JNaXJyb3JFbmFibGVkIiwiaW5pdGlhbFN0YXRlIiwic2V0dGluZ3MiLCJhZ2VudE5hbWVSZWdpc3RyeSIsIk1hcCIsIm1haW5Mb29wTW9kZWwiLCJtYWluTG9vcE1vZGVsRm9yU2Vzc2lvbiIsImlzQnJpZWZPbmx5IiwiZXhwYW5kZWRWaWV3Iiwic2hvd1NwaW5uZXJUcmVlIiwic2hvd0V4cGFuZGVkVG9kb3MiLCJzaG93VGVhbW1hdGVNZXNzYWdlUHJldmlldyIsInNlbGVjdGVkSVBBZ2VudEluZGV4IiwiY29vcmRpbmF0b3JUYXNrSW5kZXgiLCJ2aWV3U2VsZWN0aW9uTW9kZSIsImZvb3RlclNlbGVjdGlvbiIsInBsdWdpblJlY29ubmVjdEtleSIsImRpc2FibGVkIiwiaW5zdGFsbGF0aW9uU3RhdHVzIiwibWFya2V0cGxhY2VzIiwibmVlZHNSZWZyZXNoIiwic3RhdHVzTGluZVRleHQiLCJyZW1vdGVTZXNzaW9uVXJsIiwicmVtb3RlQ29ubmVjdGlvblN0YXR1cyIsInJlbW90ZUJhY2tncm91bmRUYXNrQ291bnQiLCJyZXBsQnJpZGdlRW5hYmxlZCIsInJlcGxCcmlkZ2VFeHBsaWNpdCIsInJlcGxCcmlkZ2VPdXRib3VuZE9ubHkiLCJyZXBsQnJpZGdlQ29ubmVjdGVkIiwicmVwbEJyaWRnZVNlc3Npb25BY3RpdmUiLCJyZXBsQnJpZGdlUmVjb25uZWN0aW5nIiwicmVwbEJyaWRnZUNvbm5lY3RVcmwiLCJyZXBsQnJpZGdlU2Vzc2lvblVybCIsInJlcGxCcmlkZ2VFbnZpcm9ubWVudElkIiwicmVwbEJyaWRnZVNlc3Npb25JZCIsInJlcGxCcmlkZ2VFcnJvciIsInJlcGxCcmlkZ2VJbml0aWFsTmFtZSIsInNob3dSZW1vdGVDYWxsb3V0Iiwibm90aWZpY2F0aW9ucyIsInF1ZXVlIiwiZWxpY2l0YXRpb24iLCJ0b2RvcyIsInJlbW90ZUFnZW50VGFza1N1Z2dlc3Rpb25zIiwiZmlsZUhpc3RvcnkiLCJzbmFwc2hvdHMiLCJ0cmFja2VkRmlsZXMiLCJzbmFwc2hvdFNlcXVlbmNlIiwiYXR0cmlidXRpb24iLCJwcm9tcHRTdWdnZXN0aW9uRW5hYmxlZCIsInNlc3Npb25Ib29rcyIsImluYm94IiwibWVzc2FnZXMiLCJwcm9tcHRTdWdnZXN0aW9uIiwicHJvbXB0SWQiLCJzaG93bkF0IiwiYWNjZXB0ZWRBdCIsImdlbmVyYXRpb25SZXF1ZXN0SWQiLCJzcGVjdWxhdGlvbiIsInNwZWN1bGF0aW9uU2Vzc2lvblRpbWVTYXZlZE1zIiwic2tpbGxJbXByb3ZlbWVudCIsInN1Z2dlc3Rpb24iLCJ3b3JrZXJTYW5kYm94UGVybWlzc2lvbnMiLCJzZWxlY3RlZEluZGV4IiwicGVuZGluZ1dvcmtlclJlcXVlc3QiLCJwZW5kaW5nU2FuZGJveFJlcXVlc3QiLCJhdXRoVmVyc2lvbiIsImluaXRpYWxNZXNzYWdlIiwiY29udGVudCIsImFjdGl2ZU92ZXJsYXlzIiwidGVhbUNvbnRleHQiLCJpbml0aWFsVG9vbHMiLCJudW1TdGFydHVwcyIsInNldEltbWVkaWF0ZSIsInNlc3Npb25VcGxvYWRlclByb21pc2UiLCJ1cGxvYWRlclJlYWR5IiwibW9kIiwiY3JlYXRlU2Vzc2lvblR1cm5VcGxvYWRlciIsInNlc3Npb25Db25maWciLCJhdXRvQ29ubmVjdElkZUZsYWciLCJvblR1cm5Db21wbGV0ZSIsInVwbG9hZGVyIiwicmVzdW1lQ29udGV4dCIsIm1vZGVBcGkiLCJyZXN1bWVTdWNjZWVkZWQiLCJyZXN1bWVTdGFydCIsInBlcmZvcm1hbmNlIiwiY2xlYXJTZXNzaW9uQ2FjaGVzIiwic3VjY2VzcyIsImxvYWRlZCIsImluY2x1ZGVBdHRyaWJ1dGlvbiIsInRyYW5zY3JpcHRQYXRoIiwiZnVsbFBhdGgiLCJyZXN0b3JlZEFnZW50RGVmIiwicmVzdW1lX2R1cmF0aW9uX21zIiwiaW5pdGlhbE1lc3NhZ2VzIiwiaW5pdGlhbEZpbGVIaXN0b3J5U25hcHNob3RzIiwiZmlsZUhpc3RvcnlTbmFwc2hvdHMiLCJpbml0aWFsQ29udGVudFJlcGxhY2VtZW50cyIsImNvbnRlbnRSZXBsYWNlbWVudHMiLCJpbml0aWFsQWdlbnROYW1lIiwiaW5pdGlhbEFnZW50Q29sb3IiLCJkaXJlY3RDb25uZWN0Q29uZmlnIiwic2Vzc2lvbiIsIndvcmtEaXIiLCJjb25uZWN0SW5mb01lc3NhZ2UiLCJjcmVhdGVTU0hTZXNzaW9uIiwiY3JlYXRlTG9jYWxTU0hTZXNzaW9uIiwiU1NIU2Vzc2lvbkVycm9yIiwic3NoU2Vzc2lvbiIsImhhZFByb2dyZXNzIiwibG9jYWxWZXJzaW9uIiwib25Qcm9ncmVzcyIsIm1zZyIsInJlbW90ZUN3ZCIsInNzaEluZm9NZXNzYWdlIiwiZGlzY292ZXJBc3Npc3RhbnRTZXNzaW9ucyIsInRhcmdldFNlc3Npb25JZCIsInNlc3Npb25zIiwiaW5zdGFsbGVkRGlyIiwiYmVmb3JlRXhpdCIsImlkIiwicGlja2VkIiwiY2hlY2tBbmRSZWZyZXNoT0F1dGhUb2tlbklmTmVlZGVkIiwiZ2V0Q2xhdWRlQUlPQXV0aFRva2VucyIsImFwaUNyZWRzIiwiZ2V0QWNjZXNzVG9rZW4iLCJhY2Nlc3NUb2tlbiIsInJlbW90ZVNlc3Npb25Db25maWciLCJvcmdVVUlEIiwiaW5mb01lc3NhZ2UiLCJhc3Npc3RhbnRJbml0aWFsU3RhdGUiLCJyZW1vdGVDb21tYW5kcyIsImZyb21QciIsInByb2Nlc3NlZFJlc3VtZSIsIm1heWJlU2Vzc2lvbklkIiwic2VhcmNoVGVybSIsIm1hdGNoZWRMb2ciLCJmaWx0ZXJCeVByIiwidHJpbW1lZFZhbHVlIiwibWF0Y2hlcyIsImV4YWN0IiwiaXNSZW1vdGVUdWlFbmFibGVkIiwiaGFzX2luaXRpYWxfcHJvbXB0IiwiY3VycmVudEJyYW5jaCIsImNyZWF0ZWRTZXNzaW9uIiwiQWJvcnRDb250cm9sbGVyIiwic2lnbmFsIiwic2Vzc2lvbl9pZCIsImdldFRva2Vuc0ZvclJlbW90ZSIsImdldEFjY2Vzc1Rva2VuRm9yUmVtb3RlIiwicmVtb3RlSW5mb01lc3NhZ2UiLCJpbml0aWFsVXNlck1lc3NhZ2UiLCJyZW1vdGVJbml0aWFsU3RhdGUiLCJ0ZWxlcG9ydFJlc3VsdCIsImJyYW5jaEVycm9yIiwiYnJhbmNoIiwibG9nIiwic2Vzc2lvbkRhdGEiLCJyZXBvVmFsaWRhdGlvbiIsInN0YXR1cyIsInNlc3Npb25SZXBvIiwia25vd25QYXRocyIsImV4aXN0aW5nUGF0aHMiLCJzZWxlY3RlZFBhdGgiLCJ0YXJnZXRSZXBvIiwiaW5pdGlhbFBhdGhzIiwiY2hkaXIiLCJib2xkIiwidGVsZXBvcnRXaXRoUHJvZ3Jlc3MiLCJmb3JtYXR0ZWRNZXNzYWdlIiwicGFyc2VDY3NoYXJlSWQiLCJsb2FkQ2NzaGFyZSIsImNjc2hhcmVJZCIsImxvZ09wdGlvbiIsImVudHJ5cG9pbnQiLCJzZXNzaW9uSWRPdmVycmlkZSIsInJlc3VsdHMiLCJmYWlsZWRDb3VudCIsInJlc3VtZURhdGEiLCJpbml0aWFsU2VhcmNoUXVlcnkiLCJwZW5kaW5nSG9va01lc3NhZ2VzIiwiZGVlcExpbmtCYW5uZXIiLCJkZWVwTGlua09yaWdpbiIsImhhc19wcmVmaWxsIiwiaGFzX3JlcG8iLCJkZWVwTGlua1JlcG8iLCJwcmVmaWxsTGVuZ3RoIiwicmVwbyIsImxhc3RGZXRjaCIsImRlZXBMaW5rTGFzdEZldGNoIiwiaW1wbGllcyIsImlzUHJpbnRNb2RlIiwiaXNDY1VybCIsInBhcnNlQXN5bmMiLCJtY3BTZXJ2ZUhhbmRsZXIiLCJtY3BSZW1vdmVIYW5kbGVyIiwibWNwTGlzdEhhbmRsZXIiLCJtY3BHZXRIYW5kbGVyIiwianNvbiIsImNsaWVudFNlY3JldCIsIm1jcEFkZEpzb25IYW5kbGVyIiwibWNwQWRkRnJvbURlc2t0b3BIYW5kbGVyIiwibWNwUmVzZXRDaG9pY2VzSGFuZGxlciIsInBvcnQiLCJ1bml4Iiwid29ya3NwYWNlIiwiaWRsZVRpbWVvdXQiLCJtYXhTZXNzaW9ucyIsInJhbmRvbUJ5dGVzIiwic3RhcnRTZXJ2ZXIiLCJTZXNzaW9uTWFuYWdlciIsIkRhbmdlcm91c0JhY2tlbmQiLCJwcmludEJhbm5lciIsImNyZWF0ZVNlcnZlckxvZ2dlciIsIndyaXRlU2VydmVyTG9jayIsInJlbW92ZVNlcnZlckxvY2siLCJwcm9iZVJ1bm5pbmdTZXJ2ZXIiLCJleGlzdGluZyIsInBpZCIsImh0dHBVcmwiLCJ0b1N0cmluZyIsImlkbGVUaW1lb3V0TXMiLCJiYWNrZW5kIiwic2Vzc2lvbk1hbmFnZXIiLCJsb2dnZXIiLCJzZXJ2ZXIiLCJhY3R1YWxQb3J0Iiwic3RhcnRlZEF0Iiwic2h1dHRpbmdEb3duIiwic2h1dGRvd24iLCJzdG9wIiwiZGVzdHJveUFsbCIsIm9uY2UiLCJjb25uZWN0Q29uZmlnIiwicnVuQ29ubmVjdEhlYWRsZXNzIiwiaW50ZXJhY3RpdmUiLCJhdXRoIiwiZW1haWwiLCJzc28iLCJ1c2VDb25zb2xlIiwiYXV0aExvZ2luIiwiYXV0aFN0YXR1cyIsImF1dGhMb2dvdXQiLCJjb3dvcmtPcHRpb24iLCJwbHVnaW5DbWQiLCJhbGlhcyIsIm1hbmlmZXN0UGF0aCIsImNvd29yayIsInBsdWdpblZhbGlkYXRlSGFuZGxlciIsImF2YWlsYWJsZSIsInBsdWdpbkxpc3RIYW5kbGVyIiwibWFya2V0cGxhY2VDbWQiLCJzcGFyc2UiLCJtYXJrZXRwbGFjZUFkZEhhbmRsZXIiLCJtYXJrZXRwbGFjZUxpc3RIYW5kbGVyIiwibWFya2V0cGxhY2VSZW1vdmVIYW5kbGVyIiwibWFya2V0cGxhY2VVcGRhdGVIYW5kbGVyIiwicGx1Z2luIiwicGx1Z2luSW5zdGFsbEhhbmRsZXIiLCJrZWVwRGF0YSIsInBsdWdpblVuaW5zdGFsbEhhbmRsZXIiLCJwbHVnaW5FbmFibGVIYW5kbGVyIiwicGx1Z2luRGlzYWJsZUhhbmRsZXIiLCJwbHVnaW5VcGRhdGVIYW5kbGVyIiwic2V0dXBUb2tlbkhhbmRsZXIiLCJhZ2VudHNIYW5kbGVyIiwiYXV0b01vZGVDbWQiLCJhdXRvTW9kZURlZmF1bHRzSGFuZGxlciIsImF1dG9Nb2RlQ29uZmlnSGFuZGxlciIsImF1dG9Nb2RlQ3JpdGlxdWVIYW5kbGVyIiwiaGlkZGVuIiwiYnJpZGdlTWFpbiIsImRvY3RvckhhbmRsZXIiLCJ1cGRhdGUiLCJ1cCIsInRhcmdldCIsImxpc3QiLCJkcnlSdW4iLCJzYWZlIiwicm9sbGJhY2siLCJmb3JjZSIsImluc3RhbGxIYW5kbGVyIiwidmFsaWRhdGVMb2dJZCIsImxvZ0lkIiwibG9nSGFuZGxlciIsIm51bWJlciIsImVycm9ySGFuZGxlciIsInVzYWdlIiwiYWRkSGVscFRleHQiLCJvdXRwdXRGaWxlIiwiZXhwb3J0SGFuZGxlciIsInRhc2tDbWQiLCJzdWJqZWN0IiwidGFza0NyZWF0ZUhhbmRsZXIiLCJwZW5kaW5nIiwidGFza0xpc3RIYW5kbGVyIiwidGFza0dldEhhbmRsZXIiLCJvd25lciIsImNsZWFyT3duZXIiLCJ0YXNrVXBkYXRlSGFuZGxlciIsInRhc2tEaXJIYW5kbGVyIiwic2hlbGwiLCJvdXRwdXQiLCJjb21wbGV0aW9uSGFuZGxlciIsImluUHJvdGVjdGVkTmFtZXNwYWNlIiwidGhpbmtpbmdUeXBlIiwiaXNfc2ltcGxlIiwiaXNfY29vcmRpbmF0b3IiLCJhdXRvVXBkYXRlc0NoYW5uZWwiLCJnaXRSb290IiwicnAiLCJyZWxhdGl2ZVByb2plY3RQYXRoIiwicHJvYWN0aXZlTW9kdWxlIiwiaXNQcm9hY3RpdmVBY3RpdmUiLCJhY3RpdmF0ZVByb2FjdGl2ZSIsImJyaWVmRmxhZyIsImJyaWVmRW52IiwiQ0xBVURFX0NPREVfQlJJRUYiLCJlbnRpdGxlZCIsImdhdGVkIiwidGVybWluYWwiXSwic291cmNlcyI6WyJtYWluLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBUaGVzZSBzaWRlLWVmZmVjdHMgbXVzdCBydW4gYmVmb3JlIGFsbCBvdGhlciBpbXBvcnRzOlxuLy8gMS4gcHJvZmlsZUNoZWNrcG9pbnQgbWFya3MgZW50cnkgYmVmb3JlIGhlYXZ5IG1vZHVsZSBldmFsdWF0aW9uIGJlZ2luc1xuLy8gMi4gc3RhcnRNZG1SYXdSZWFkIGZpcmVzIE1ETSBzdWJwcm9jZXNzZXMgKHBsdXRpbC9yZWcgcXVlcnkpIHNvIHRoZXkgcnVuIGluXG4vLyAgICBwYXJhbGxlbCB3aXRoIHRoZSByZW1haW5pbmcgfjEzNW1zIG9mIGltcG9ydHMgYmVsb3dcbi8vIDMuIHN0YXJ0S2V5Y2hhaW5QcmVmZXRjaCBmaXJlcyBib3RoIG1hY09TIGtleWNoYWluIHJlYWRzIChPQXV0aCArIGxlZ2FjeSBBUElcbi8vICAgIGtleSkgaW4gcGFyYWxsZWwg4oCUIGlzUmVtb3RlTWFuYWdlZFNldHRpbmdzRWxpZ2libGUoKSBvdGhlcndpc2UgcmVhZHMgdGhlbVxuLy8gICAgc2VxdWVudGlhbGx5IHZpYSBzeW5jIHNwYXduIGluc2lkZSBhcHBseVNhZmVDb25maWdFbnZpcm9ubWVudFZhcmlhYmxlcygpXG4vLyAgICAofjY1bXMgb24gZXZlcnkgbWFjT1Mgc3RhcnR1cClcbmltcG9ydCB7IHByb2ZpbGVDaGVja3BvaW50LCBwcm9maWxlUmVwb3J0IH0gZnJvbSAnLi91dGlscy9zdGFydHVwUHJvZmlsZXIuanMnXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tdG9wLWxldmVsLXNpZGUtZWZmZWN0c1xucHJvZmlsZUNoZWNrcG9pbnQoJ21haW5fdHN4X2VudHJ5JylcblxuaW1wb3J0IHsgc3RhcnRNZG1SYXdSZWFkIH0gZnJvbSAnLi91dGlscy9zZXR0aW5ncy9tZG0vcmF3UmVhZC5qcydcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby10b3AtbGV2ZWwtc2lkZS1lZmZlY3RzXG5zdGFydE1kbVJhd1JlYWQoKVxuXG5pbXBvcnQge1xuICBlbnN1cmVLZXljaGFpblByZWZldGNoQ29tcGxldGVkLFxuICBzdGFydEtleWNoYWluUHJlZmV0Y2gsXG59IGZyb20gJy4vdXRpbHMvc2VjdXJlU3RvcmFnZS9rZXljaGFpblByZWZldGNoLmpzJ1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL25vLXRvcC1sZXZlbC1zaWRlLWVmZmVjdHNcbnN0YXJ0S2V5Y2hhaW5QcmVmZXRjaCgpXG5cbmltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IHtcbiAgQ29tbWFuZCBhcyBDb21tYW5kZXJDb21tYW5kLFxuICBJbnZhbGlkQXJndW1lbnRFcnJvcixcbiAgT3B0aW9uLFxufSBmcm9tICdAY29tbWFuZGVyLWpzL2V4dHJhLXR5cGluZ3MnXG5pbXBvcnQgY2hhbGsgZnJvbSAnY2hhbGsnXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdmcydcbmltcG9ydCBtYXBWYWx1ZXMgZnJvbSAnbG9kYXNoLWVzL21hcFZhbHVlcy5qcydcbmltcG9ydCBwaWNrQnkgZnJvbSAnbG9kYXNoLWVzL3BpY2tCeS5qcydcbmltcG9ydCB1bmlxQnkgZnJvbSAnbG9kYXNoLWVzL3VuaXFCeS5qcydcbmltcG9ydCBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IGdldE9hdXRoQ29uZmlnIH0gZnJvbSAnLi9jb25zdGFudHMvb2F1dGguanMnXG5pbXBvcnQgeyBnZXRSZW1vdGVTZXNzaW9uVXJsIH0gZnJvbSAnLi9jb25zdGFudHMvcHJvZHVjdC5qcydcbmltcG9ydCB7IGdldFN5c3RlbUNvbnRleHQsIGdldFVzZXJDb250ZXh0IH0gZnJvbSAnLi9jb250ZXh0LmpzJ1xuaW1wb3J0IHsgaW5pdCwgaW5pdGlhbGl6ZVRlbGVtZXRyeUFmdGVyVHJ1c3QgfSBmcm9tICcuL2VudHJ5cG9pbnRzL2luaXQuanMnXG5pbXBvcnQgeyBhZGRUb0hpc3RvcnkgfSBmcm9tICcuL2hpc3RvcnkuanMnXG5pbXBvcnQgdHlwZSB7IFJvb3QgfSBmcm9tICcuL2luay5qcydcbmltcG9ydCB7IGxhdW5jaFJlcGwgfSBmcm9tICcuL3JlcGxMYXVuY2hlci5qcydcbmltcG9ydCB7XG4gIGhhc0dyb3d0aEJvb2tFbnZPdmVycmlkZSxcbiAgaW5pdGlhbGl6ZUdyb3d0aEJvb2ssXG4gIHJlZnJlc2hHcm93dGhCb29rQWZ0ZXJBdXRoQ2hhbmdlLFxufSBmcm9tICcuL3NlcnZpY2VzL2FuYWx5dGljcy9ncm93dGhib29rLmpzJ1xuaW1wb3J0IHsgZmV0Y2hCb290c3RyYXBEYXRhIH0gZnJvbSAnLi9zZXJ2aWNlcy9hcGkvYm9vdHN0cmFwLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBEb3dubG9hZFJlc3VsdCxcbiAgZG93bmxvYWRTZXNzaW9uRmlsZXMsXG4gIHR5cGUgRmlsZXNBcGlDb25maWcsXG4gIHBhcnNlRmlsZVNwZWNzLFxufSBmcm9tICcuL3NlcnZpY2VzL2FwaS9maWxlc0FwaS5qcydcbmltcG9ydCB7IHByZWZldGNoUGFzc2VzRWxpZ2liaWxpdHkgfSBmcm9tICcuL3NlcnZpY2VzL2FwaS9yZWZlcnJhbC5qcydcbmltcG9ydCB7IHByZWZldGNoT2ZmaWNpYWxNY3BVcmxzIH0gZnJvbSAnLi9zZXJ2aWNlcy9tY3Avb2ZmaWNpYWxSZWdpc3RyeS5qcydcbmltcG9ydCB0eXBlIHtcbiAgTWNwU2RrU2VydmVyQ29uZmlnLFxuICBNY3BTZXJ2ZXJDb25maWcsXG4gIFNjb3BlZE1jcFNlcnZlckNvbmZpZyxcbn0gZnJvbSAnLi9zZXJ2aWNlcy9tY3AvdHlwZXMuanMnXG5pbXBvcnQge1xuICBpc1BvbGljeUFsbG93ZWQsXG4gIGxvYWRQb2xpY3lMaW1pdHMsXG4gIHJlZnJlc2hQb2xpY3lMaW1pdHMsXG4gIHdhaXRGb3JQb2xpY3lMaW1pdHNUb0xvYWQsXG59IGZyb20gJy4vc2VydmljZXMvcG9saWN5TGltaXRzL2luZGV4LmpzJ1xuaW1wb3J0IHtcbiAgbG9hZFJlbW90ZU1hbmFnZWRTZXR0aW5ncyxcbiAgcmVmcmVzaFJlbW90ZU1hbmFnZWRTZXR0aW5ncyxcbn0gZnJvbSAnLi9zZXJ2aWNlcy9yZW1vdGVNYW5hZ2VkU2V0dGluZ3MvaW5kZXguanMnXG5pbXBvcnQgdHlwZSB7IFRvb2xJbnB1dEpTT05TY2hlbWEgfSBmcm9tICcuL1Rvb2wuanMnXG5pbXBvcnQge1xuICBjcmVhdGVTeW50aGV0aWNPdXRwdXRUb29sLFxuICBpc1N5bnRoZXRpY091dHB1dFRvb2xFbmFibGVkLFxufSBmcm9tICcuL3Rvb2xzL1N5bnRoZXRpY091dHB1dFRvb2wvU3ludGhldGljT3V0cHV0VG9vbC5qcydcbmltcG9ydCB7IGdldFRvb2xzIH0gZnJvbSAnLi90b29scy5qcydcbmltcG9ydCB7XG4gIGNhblVzZXJDb25maWd1cmVBZHZpc29yLFxuICBnZXRJbml0aWFsQWR2aXNvclNldHRpbmcsXG4gIGlzQWR2aXNvckVuYWJsZWQsXG4gIGlzVmFsaWRBZHZpc29yTW9kZWwsXG4gIG1vZGVsU3VwcG9ydHNBZHZpc29yLFxufSBmcm9tICcuL3V0aWxzL2Fkdmlzb3IuanMnXG5pbXBvcnQgeyBpc0FnZW50U3dhcm1zRW5hYmxlZCB9IGZyb20gJy4vdXRpbHMvYWdlbnRTd2FybXNFbmFibGVkLmpzJ1xuaW1wb3J0IHsgY291bnQsIHVuaXEgfSBmcm9tICcuL3V0aWxzL2FycmF5LmpzJ1xuaW1wb3J0IHsgaW5zdGFsbEFzY2lpY2FzdFJlY29yZGVyIH0gZnJvbSAnLi91dGlscy9hc2NpaWNhc3QuanMnXG5pbXBvcnQge1xuICBnZXRTdWJzY3JpcHRpb25UeXBlLFxuICBpc0NsYXVkZUFJU3Vic2NyaWJlcixcbiAgcHJlZmV0Y2hBd3NDcmVkZW50aWFsc0FuZEJlZFJvY2tJbmZvSWZTYWZlLFxuICBwcmVmZXRjaEdjcENyZWRlbnRpYWxzSWZTYWZlLFxuICB2YWxpZGF0ZUZvcmNlTG9naW5PcmcsXG59IGZyb20gJy4vdXRpbHMvYXV0aC5qcydcbmltcG9ydCB7XG4gIGNoZWNrSGFzVHJ1c3REaWFsb2dBY2NlcHRlZCxcbiAgZ2V0R2xvYmFsQ29uZmlnLFxuICBnZXRSZW1vdGVDb250cm9sQXRTdGFydHVwLFxuICBpc0F1dG9VcGRhdGVyRGlzYWJsZWQsXG4gIHNhdmVHbG9iYWxDb25maWcsXG59IGZyb20gJy4vdXRpbHMvY29uZmlnLmpzJ1xuaW1wb3J0IHsgc2VlZEVhcmx5SW5wdXQsIHN0b3BDYXB0dXJpbmdFYXJseUlucHV0IH0gZnJvbSAnLi91dGlscy9lYXJseUlucHV0LmpzJ1xuaW1wb3J0IHsgZ2V0SW5pdGlhbEVmZm9ydFNldHRpbmcsIHBhcnNlRWZmb3J0VmFsdWUgfSBmcm9tICcuL3V0aWxzL2VmZm9ydC5qcydcbmltcG9ydCB7XG4gIGdldEluaXRpYWxGYXN0TW9kZVNldHRpbmcsXG4gIGlzRmFzdE1vZGVFbmFibGVkLFxuICBwcmVmZXRjaEZhc3RNb2RlU3RhdHVzLFxuICByZXNvbHZlRmFzdE1vZGVTdGF0dXNGcm9tQ2FjaGUsXG59IGZyb20gJy4vdXRpbHMvZmFzdE1vZGUuanMnXG5pbXBvcnQgeyBhcHBseUNvbmZpZ0Vudmlyb25tZW50VmFyaWFibGVzIH0gZnJvbSAnLi91dGlscy9tYW5hZ2VkRW52LmpzJ1xuaW1wb3J0IHsgY3JlYXRlU3lzdGVtTWVzc2FnZSwgY3JlYXRlVXNlck1lc3NhZ2UgfSBmcm9tICcuL3V0aWxzL21lc3NhZ2VzLmpzJ1xuaW1wb3J0IHsgZ2V0UGxhdGZvcm0gfSBmcm9tICcuL3V0aWxzL3BsYXRmb3JtLmpzJ1xuaW1wb3J0IHsgZ2V0QmFzZVJlbmRlck9wdGlvbnMgfSBmcm9tICcuL3V0aWxzL3JlbmRlck9wdGlvbnMuanMnXG5pbXBvcnQgeyBnZXRTZXNzaW9uSW5ncmVzc0F1dGhUb2tlbiB9IGZyb20gJy4vdXRpbHMvc2Vzc2lvbkluZ3Jlc3NBdXRoLmpzJ1xuaW1wb3J0IHsgc2V0dGluZ3NDaGFuZ2VEZXRlY3RvciB9IGZyb20gJy4vdXRpbHMvc2V0dGluZ3MvY2hhbmdlRGV0ZWN0b3IuanMnXG5pbXBvcnQgeyBza2lsbENoYW5nZURldGVjdG9yIH0gZnJvbSAnLi91dGlscy9za2lsbHMvc2tpbGxDaGFuZ2VEZXRlY3Rvci5qcydcbmltcG9ydCB7IGpzb25QYXJzZSwgd3JpdGVGaWxlU3luY19ERVBSRUNBVEVEIH0gZnJvbSAnLi91dGlscy9zbG93T3BlcmF0aW9ucy5qcydcbmltcG9ydCB7IGNvbXB1dGVJbml0aWFsVGVhbUNvbnRleHQgfSBmcm9tICcuL3V0aWxzL3N3YXJtL3JlY29ubmVjdGlvbi5qcydcbmltcG9ydCB7IGluaXRpYWxpemVXYXJuaW5nSGFuZGxlciB9IGZyb20gJy4vdXRpbHMvd2FybmluZ0hhbmRsZXIuanMnXG5pbXBvcnQgeyBpc1dvcmt0cmVlTW9kZUVuYWJsZWQgfSBmcm9tICcuL3V0aWxzL3dvcmt0cmVlTW9kZUVuYWJsZWQuanMnXG5cbi8vIExhenkgcmVxdWlyZSB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmN5OiB0ZWFtbWF0ZS50cyAtPiBBcHBTdGF0ZS50c3ggLT4gLi4uIC0+IG1haW4udHN4XG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5jb25zdCBnZXRUZWFtbWF0ZVV0aWxzID0gKCkgPT5cbiAgcmVxdWlyZSgnLi91dGlscy90ZWFtbWF0ZS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vdXRpbHMvdGVhbW1hdGUuanMnKVxuY29uc3QgZ2V0VGVhbW1hdGVQcm9tcHRBZGRlbmR1bSA9ICgpID0+XG4gIHJlcXVpcmUoJy4vdXRpbHMvc3dhcm0vdGVhbW1hdGVQcm9tcHRBZGRlbmR1bS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vdXRpbHMvc3dhcm0vdGVhbW1hdGVQcm9tcHRBZGRlbmR1bS5qcycpXG5jb25zdCBnZXRUZWFtbWF0ZU1vZGVTbmFwc2hvdCA9ICgpID0+XG4gIHJlcXVpcmUoJy4vdXRpbHMvc3dhcm0vYmFja2VuZHMvdGVhbW1hdGVNb2RlU25hcHNob3QuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuL3V0aWxzL3N3YXJtL2JhY2tlbmRzL3RlYW1tYXRlTW9kZVNuYXBzaG90LmpzJylcbi8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuLy8gRGVhZCBjb2RlIGVsaW1pbmF0aW9uOiBjb25kaXRpb25hbCBpbXBvcnQgZm9yIENPT1JESU5BVE9SX01PREVcbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmNvbnN0IGNvb3JkaW5hdG9yTW9kZU1vZHVsZSA9IGZlYXR1cmUoJ0NPT1JESU5BVE9SX01PREUnKVxuICA/IChyZXF1aXJlKCcuL2Nvb3JkaW5hdG9yL2Nvb3JkaW5hdG9yTW9kZS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vY29vcmRpbmF0b3IvY29vcmRpbmF0b3JNb2RlLmpzJykpXG4gIDogbnVsbFxuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4vLyBEZWFkIGNvZGUgZWxpbWluYXRpb246IGNvbmRpdGlvbmFsIGltcG9ydCBmb3IgS0FJUk9TIChhc3Npc3RhbnQgbW9kZSlcbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmNvbnN0IGFzc2lzdGFudE1vZHVsZSA9IGZlYXR1cmUoJ0tBSVJPUycpXG4gID8gKHJlcXVpcmUoJy4vYXNzaXN0YW50L2luZGV4LmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi9hc3Npc3RhbnQvaW5kZXguanMnKSlcbiAgOiBudWxsXG5jb25zdCBrYWlyb3NHYXRlID0gZmVhdHVyZSgnS0FJUk9TJylcbiAgPyAocmVxdWlyZSgnLi9hc3Npc3RhbnQvZ2F0ZS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vYXNzaXN0YW50L2dhdGUuanMnKSlcbiAgOiBudWxsXG5cbmltcG9ydCB7IHJlbGF0aXZlLCByZXNvbHZlIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7IGlzQW5hbHl0aWNzRGlzYWJsZWQgfSBmcm9tICdzcmMvc2VydmljZXMvYW5hbHl0aWNzL2NvbmZpZy5qcydcbmltcG9ydCB7IGdldEZlYXR1cmVWYWx1ZV9DQUNIRURfTUFZX0JFX1NUQUxFIH0gZnJvbSAnc3JjL3NlcnZpY2VzL2FuYWx5dGljcy9ncm93dGhib29rLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnc3JjL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB7IGluaXRpYWxpemVBbmFseXRpY3NHYXRlcyB9IGZyb20gJ3NyYy9zZXJ2aWNlcy9hbmFseXRpY3Mvc2luay5qcydcbmltcG9ydCB7XG4gIGdldE9yaWdpbmFsQ3dkLFxuICBzZXRBZGRpdGlvbmFsRGlyZWN0b3JpZXNGb3JDbGF1ZGVNZCxcbiAgc2V0SXNSZW1vdGVNb2RlLFxuICBzZXRNYWluTG9vcE1vZGVsT3ZlcnJpZGUsXG4gIHNldE1haW5UaHJlYWRBZ2VudFR5cGUsXG4gIHNldFRlbGVwb3J0ZWRTZXNzaW9uSW5mbyxcbn0gZnJvbSAnLi9ib290c3RyYXAvc3RhdGUuanMnXG5pbXBvcnQgeyBmaWx0ZXJDb21tYW5kc0ZvclJlbW90ZU1vZGUsIGdldENvbW1hbmRzIH0gZnJvbSAnLi9jb21tYW5kcy5qcydcbmltcG9ydCB0eXBlIHsgU3RhdHNTdG9yZSB9IGZyb20gJy4vY29udGV4dC9zdGF0cy5qcydcbmltcG9ydCB7XG4gIGxhdW5jaEFzc2lzdGFudEluc3RhbGxXaXphcmQsXG4gIGxhdW5jaEFzc2lzdGFudFNlc3Npb25DaG9vc2VyLFxuICBsYXVuY2hJbnZhbGlkU2V0dGluZ3NEaWFsb2csXG4gIGxhdW5jaFJlc3VtZUNob29zZXIsXG4gIGxhdW5jaFNuYXBzaG90VXBkYXRlRGlhbG9nLFxuICBsYXVuY2hUZWxlcG9ydFJlcG9NaXNtYXRjaERpYWxvZyxcbiAgbGF1bmNoVGVsZXBvcnRSZXN1bWVXcmFwcGVyLFxufSBmcm9tICcuL2RpYWxvZ0xhdW5jaGVycy5qcydcbmltcG9ydCB7IFNIT1dfQ1VSU09SIH0gZnJvbSAnLi9pbmsvdGVybWlvL2RlYy5qcydcbmltcG9ydCB7XG4gIGV4aXRXaXRoRXJyb3IsXG4gIGV4aXRXaXRoTWVzc2FnZSxcbiAgZ2V0UmVuZGVyQ29udGV4dCxcbiAgcmVuZGVyQW5kUnVuLFxuICBzaG93U2V0dXBTY3JlZW5zLFxufSBmcm9tICcuL2ludGVyYWN0aXZlSGVscGVycy5qcydcbmltcG9ydCB7IGluaXRCdWlsdGluUGx1Z2lucyB9IGZyb20gJy4vcGx1Z2lucy9idW5kbGVkL2luZGV4LmpzJ1xuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5pbXBvcnQgeyBjaGVja1F1b3RhU3RhdHVzIH0gZnJvbSAnLi9zZXJ2aWNlcy9jbGF1ZGVBaUxpbWl0cy5qcydcbmltcG9ydCB7XG4gIGdldE1jcFRvb2xzQ29tbWFuZHNBbmRSZXNvdXJjZXMsXG4gIHByZWZldGNoQWxsTWNwUmVzb3VyY2VzLFxufSBmcm9tICcuL3NlcnZpY2VzL21jcC9jbGllbnQuanMnXG5pbXBvcnQge1xuICBWQUxJRF9JTlNUQUxMQUJMRV9TQ09QRVMsXG4gIFZBTElEX1VQREFURV9TQ09QRVMsXG59IGZyb20gJy4vc2VydmljZXMvcGx1Z2lucy9wbHVnaW5DbGlDb21tYW5kcy5qcydcbmltcG9ydCB7IGluaXRCdW5kbGVkU2tpbGxzIH0gZnJvbSAnLi9za2lsbHMvYnVuZGxlZC9pbmRleC5qcydcbmltcG9ydCB0eXBlIHsgQWdlbnRDb2xvck5hbWUgfSBmcm9tICcuL3Rvb2xzL0FnZW50VG9vbC9hZ2VudENvbG9yTWFuYWdlci5qcydcbmltcG9ydCB7XG4gIGdldEFjdGl2ZUFnZW50c0Zyb21MaXN0LFxuICBnZXRBZ2VudERlZmluaXRpb25zV2l0aE92ZXJyaWRlcyxcbiAgaXNCdWlsdEluQWdlbnQsXG4gIGlzQ3VzdG9tQWdlbnQsXG4gIHBhcnNlQWdlbnRzRnJvbUpzb24sXG59IGZyb20gJy4vdG9vbHMvQWdlbnRUb29sL2xvYWRBZ2VudHNEaXIuanMnXG5pbXBvcnQgdHlwZSB7IExvZ09wdGlvbiB9IGZyb20gJy4vdHlwZXMvbG9ncy5qcydcbmltcG9ydCB0eXBlIHsgTWVzc2FnZSBhcyBNZXNzYWdlVHlwZSB9IGZyb20gJy4vdHlwZXMvbWVzc2FnZS5qcydcbmltcG9ydCB7IGFzc2VydE1pblZlcnNpb24gfSBmcm9tICcuL3V0aWxzL2F1dG9VcGRhdGVyLmpzJ1xuaW1wb3J0IHtcbiAgQ0xBVURFX0lOX0NIUk9NRV9TS0lMTF9ISU5ULFxuICBDTEFVREVfSU5fQ0hST01FX1NLSUxMX0hJTlRfV0lUSF9XRUJCUk9XU0VSLFxufSBmcm9tICcuL3V0aWxzL2NsYXVkZUluQ2hyb21lL3Byb21wdC5qcydcbmltcG9ydCB7XG4gIHNldHVwQ2xhdWRlSW5DaHJvbWUsXG4gIHNob3VsZEF1dG9FbmFibGVDbGF1ZGVJbkNocm9tZSxcbiAgc2hvdWxkRW5hYmxlQ2xhdWRlSW5DaHJvbWUsXG59IGZyb20gJy4vdXRpbHMvY2xhdWRlSW5DaHJvbWUvc2V0dXAuanMnXG5pbXBvcnQgeyBnZXRDb250ZXh0V2luZG93Rm9yTW9kZWwgfSBmcm9tICcuL3V0aWxzL2NvbnRleHQuanMnXG5pbXBvcnQgeyBsb2FkQ29udmVyc2F0aW9uRm9yUmVzdW1lIH0gZnJvbSAnLi91dGlscy9jb252ZXJzYXRpb25SZWNvdmVyeS5qcydcbmltcG9ydCB7IGJ1aWxkRGVlcExpbmtCYW5uZXIgfSBmcm9tICcuL3V0aWxzL2RlZXBMaW5rL2Jhbm5lci5qcydcbmltcG9ydCB7XG4gIGhhc05vZGVPcHRpb24sXG4gIGlzQmFyZU1vZGUsXG4gIGlzRW52VHJ1dGh5LFxuICBpc0luUHJvdGVjdGVkTmFtZXNwYWNlLFxufSBmcm9tICcuL3V0aWxzL2VudlV0aWxzLmpzJ1xuaW1wb3J0IHsgcmVmcmVzaEV4YW1wbGVDb21tYW5kcyB9IGZyb20gJy4vdXRpbHMvZXhhbXBsZUNvbW1hbmRzLmpzJ1xuaW1wb3J0IHR5cGUgeyBGcHNNZXRyaWNzIH0gZnJvbSAnLi91dGlscy9mcHNUcmFja2VyLmpzJ1xuaW1wb3J0IHsgZ2V0V29ya3RyZWVQYXRocyB9IGZyb20gJy4vdXRpbHMvZ2V0V29ya3RyZWVQYXRocy5qcydcbmltcG9ydCB7XG4gIGZpbmRHaXRSb290LFxuICBnZXRCcmFuY2gsXG4gIGdldElzR2l0LFxuICBnZXRXb3JrdHJlZUNvdW50LFxufSBmcm9tICcuL3V0aWxzL2dpdC5qcydcbmltcG9ydCB7IGdldEdoQXV0aFN0YXR1cyB9IGZyb20gJy4vdXRpbHMvZ2l0aHViL2doQXV0aFN0YXR1cy5qcydcbmltcG9ydCB7IHNhZmVQYXJzZUpTT04gfSBmcm9tICcuL3V0aWxzL2pzb24uanMnXG5pbXBvcnQgeyBsb2dFcnJvciB9IGZyb20gJy4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHsgZ2V0TW9kZWxEZXByZWNhdGlvbldhcm5pbmcgfSBmcm9tICcuL3V0aWxzL21vZGVsL2RlcHJlY2F0aW9uLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0RGVmYXVsdE1haW5Mb29wTW9kZWwsXG4gIGdldFVzZXJTcGVjaWZpZWRNb2RlbFNldHRpbmcsXG4gIG5vcm1hbGl6ZU1vZGVsU3RyaW5nRm9yQVBJLFxuICBwYXJzZVVzZXJTcGVjaWZpZWRNb2RlbCxcbn0gZnJvbSAnLi91dGlscy9tb2RlbC9tb2RlbC5qcydcbmltcG9ydCB7IGVuc3VyZU1vZGVsU3RyaW5nc0luaXRpYWxpemVkIH0gZnJvbSAnLi91dGlscy9tb2RlbC9tb2RlbFN0cmluZ3MuanMnXG5pbXBvcnQgeyBQRVJNSVNTSU9OX01PREVTIH0gZnJvbSAnLi91dGlscy9wZXJtaXNzaW9ucy9QZXJtaXNzaW9uTW9kZS5qcydcbmltcG9ydCB7XG4gIGNoZWNrQW5kRGlzYWJsZUJ5cGFzc1Blcm1pc3Npb25zLFxuICBnZXRBdXRvTW9kZUVuYWJsZWRTdGF0ZUlmQ2FjaGVkLFxuICBpbml0aWFsaXplVG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICBpbml0aWFsUGVybWlzc2lvbk1vZGVGcm9tQ0xJLFxuICBpc0RlZmF1bHRQZXJtaXNzaW9uTW9kZUF1dG8sXG4gIHBhcnNlVG9vbExpc3RGcm9tQ0xJLFxuICByZW1vdmVEYW5nZXJvdXNQZXJtaXNzaW9ucyxcbiAgc3RyaXBEYW5nZXJvdXNQZXJtaXNzaW9uc0ZvckF1dG9Nb2RlLFxuICB2ZXJpZnlBdXRvTW9kZUdhdGVBY2Nlc3MsXG59IGZyb20gJy4vdXRpbHMvcGVybWlzc2lvbnMvcGVybWlzc2lvblNldHVwLmpzJ1xuaW1wb3J0IHsgY2xlYW51cE9ycGhhbmVkUGx1Z2luVmVyc2lvbnNJbkJhY2tncm91bmQgfSBmcm9tICcuL3V0aWxzL3BsdWdpbnMvY2FjaGVVdGlscy5qcydcbmltcG9ydCB7IGluaXRpYWxpemVWZXJzaW9uZWRQbHVnaW5zIH0gZnJvbSAnLi91dGlscy9wbHVnaW5zL2luc3RhbGxlZFBsdWdpbnNNYW5hZ2VyLmpzJ1xuaW1wb3J0IHsgZ2V0TWFuYWdlZFBsdWdpbk5hbWVzIH0gZnJvbSAnLi91dGlscy9wbHVnaW5zL21hbmFnZWRQbHVnaW5zLmpzJ1xuaW1wb3J0IHsgZ2V0R2xvYkV4Y2x1c2lvbnNGb3JQbHVnaW5DYWNoZSB9IGZyb20gJy4vdXRpbHMvcGx1Z2lucy9vcnBoYW5lZFBsdWdpbkZpbHRlci5qcydcbmltcG9ydCB7IGdldFBsdWdpblNlZWREaXJzIH0gZnJvbSAnLi91dGlscy9wbHVnaW5zL3BsdWdpbkRpcmVjdG9yaWVzLmpzJ1xuaW1wb3J0IHsgY291bnRGaWxlc1JvdW5kZWRSZyB9IGZyb20gJy4vdXRpbHMvcmlwZ3JlcC5qcydcbmltcG9ydCB7XG4gIHByb2Nlc3NTZXNzaW9uU3RhcnRIb29rcyxcbiAgcHJvY2Vzc1NldHVwSG9va3MsXG59IGZyb20gJy4vdXRpbHMvc2Vzc2lvblN0YXJ0LmpzJ1xuaW1wb3J0IHtcbiAgY2FjaGVTZXNzaW9uVGl0bGUsXG4gIGdldFNlc3Npb25JZEZyb21Mb2csXG4gIGxvYWRUcmFuc2NyaXB0RnJvbUZpbGUsXG4gIHNhdmVBZ2VudFNldHRpbmcsXG4gIHNhdmVNb2RlLFxuICBzZWFyY2hTZXNzaW9uc0J5Q3VzdG9tVGl0bGUsXG4gIHNlc3Npb25JZEV4aXN0cyxcbn0gZnJvbSAnLi91dGlscy9zZXNzaW9uU3RvcmFnZS5qcydcbmltcG9ydCB7IGVuc3VyZU1kbVNldHRpbmdzTG9hZGVkIH0gZnJvbSAnLi91dGlscy9zZXR0aW5ncy9tZG0vc2V0dGluZ3MuanMnXG5pbXBvcnQge1xuICBnZXRJbml0aWFsU2V0dGluZ3MsXG4gIGdldE1hbmFnZWRTZXR0aW5nc0tleXNGb3JMb2dnaW5nLFxuICBnZXRTZXR0aW5nc0ZvclNvdXJjZSxcbiAgZ2V0U2V0dGluZ3NXaXRoRXJyb3JzLFxufSBmcm9tICcuL3V0aWxzL3NldHRpbmdzL3NldHRpbmdzLmpzJ1xuaW1wb3J0IHsgcmVzZXRTZXR0aW5nc0NhY2hlIH0gZnJvbSAnLi91dGlscy9zZXR0aW5ncy9zZXR0aW5nc0NhY2hlLmpzJ1xuaW1wb3J0IHR5cGUgeyBWYWxpZGF0aW9uRXJyb3IgfSBmcm9tICcuL3V0aWxzL3NldHRpbmdzL3ZhbGlkYXRpb24uanMnXG5pbXBvcnQge1xuICBERUZBVUxUX1RBU0tTX01PREVfVEFTS19MSVNUX0lELFxuICBUQVNLX1NUQVRVU0VTLFxufSBmcm9tICcuL3V0aWxzL3Rhc2tzLmpzJ1xuaW1wb3J0IHtcbiAgbG9nUGx1Z2luTG9hZEVycm9ycyxcbiAgbG9nUGx1Z2luc0VuYWJsZWRGb3JTZXNzaW9uLFxufSBmcm9tICcuL3V0aWxzL3RlbGVtZXRyeS9wbHVnaW5UZWxlbWV0cnkuanMnXG5pbXBvcnQgeyBsb2dTa2lsbHNMb2FkZWQgfSBmcm9tICcuL3V0aWxzL3RlbGVtZXRyeS9za2lsbExvYWRlZEV2ZW50LmpzJ1xuaW1wb3J0IHsgZ2VuZXJhdGVUZW1wRmlsZVBhdGggfSBmcm9tICcuL3V0aWxzL3RlbXBmaWxlLmpzJ1xuaW1wb3J0IHsgdmFsaWRhdGVVdWlkIH0gZnJvbSAnLi91dGlscy91dWlkLmpzJ1xuLy8gUGx1Z2luIHN0YXJ0dXAgY2hlY2tzIGFyZSBub3cgaGFuZGxlZCBub24tYmxvY2tpbmdseSBpbiBSRVBMLnRzeFxuXG5pbXBvcnQgeyByZWdpc3Rlck1jcEFkZENvbW1hbmQgfSBmcm9tICdzcmMvY29tbWFuZHMvbWNwL2FkZENvbW1hbmQuanMnXG5pbXBvcnQgeyByZWdpc3Rlck1jcFhhYUlkcENvbW1hbmQgfSBmcm9tICdzcmMvY29tbWFuZHMvbWNwL3hhYUlkcENvbW1hbmQuanMnXG5pbXBvcnQgeyBsb2dQZXJtaXNzaW9uQ29udGV4dEZvckFudHMgfSBmcm9tICdzcmMvc2VydmljZXMvaW50ZXJuYWxMb2dnaW5nLmpzJ1xuaW1wb3J0IHsgZmV0Y2hDbGF1ZGVBSU1jcENvbmZpZ3NJZkVsaWdpYmxlIH0gZnJvbSAnc3JjL3NlcnZpY2VzL21jcC9jbGF1ZGVhaS5qcydcbmltcG9ydCB7IGNsZWFyU2VydmVyQ2FjaGUgfSBmcm9tICdzcmMvc2VydmljZXMvbWNwL2NsaWVudC5qcydcbmltcG9ydCB7XG4gIGFyZU1jcENvbmZpZ3NBbGxvd2VkV2l0aEVudGVycHJpc2VNY3BDb25maWcsXG4gIGRlZHVwQ2xhdWRlQWlNY3BTZXJ2ZXJzLFxuICBkb2VzRW50ZXJwcmlzZU1jcENvbmZpZ0V4aXN0LFxuICBmaWx0ZXJNY3BTZXJ2ZXJzQnlQb2xpY3ksXG4gIGdldENsYXVkZUNvZGVNY3BDb25maWdzLFxuICBnZXRNY3BTZXJ2ZXJTaWduYXR1cmUsXG4gIHBhcnNlTWNwQ29uZmlnLFxuICBwYXJzZU1jcENvbmZpZ0Zyb21GaWxlUGF0aCxcbn0gZnJvbSAnc3JjL3NlcnZpY2VzL21jcC9jb25maWcuanMnXG5pbXBvcnQge1xuICBleGNsdWRlQ29tbWFuZHNCeVNlcnZlcixcbiAgZXhjbHVkZVJlc291cmNlc0J5U2VydmVyLFxufSBmcm9tICdzcmMvc2VydmljZXMvbWNwL3V0aWxzLmpzJ1xuaW1wb3J0IHsgaXNYYWFFbmFibGVkIH0gZnJvbSAnc3JjL3NlcnZpY2VzL21jcC94YWFJZHBMb2dpbi5qcydcbmltcG9ydCB7IGdldFJlbGV2YW50VGlwcyB9IGZyb20gJ3NyYy9zZXJ2aWNlcy90aXBzL3RpcFJlZ2lzdHJ5LmpzJ1xuaW1wb3J0IHsgbG9nQ29udGV4dE1ldHJpY3MgfSBmcm9tICdzcmMvdXRpbHMvYXBpLmpzJ1xuaW1wb3J0IHtcbiAgQ0xBVURFX0lOX0NIUk9NRV9NQ1BfU0VSVkVSX05BTUUsXG4gIGlzQ2xhdWRlSW5DaHJvbWVNQ1BTZXJ2ZXIsXG59IGZyb20gJ3NyYy91dGlscy9jbGF1ZGVJbkNocm9tZS9jb21tb24uanMnXG5pbXBvcnQgeyByZWdpc3RlckNsZWFudXAgfSBmcm9tICdzcmMvdXRpbHMvY2xlYW51cFJlZ2lzdHJ5LmpzJ1xuaW1wb3J0IHsgZWFnZXJQYXJzZUNsaUZsYWcgfSBmcm9tICdzcmMvdXRpbHMvY2xpQXJncy5qcydcbmltcG9ydCB7IGNyZWF0ZUVtcHR5QXR0cmlidXRpb25TdGF0ZSB9IGZyb20gJ3NyYy91dGlscy9jb21taXRBdHRyaWJ1dGlvbi5qcydcbmltcG9ydCB7XG4gIGNvdW50Q29uY3VycmVudFNlc3Npb25zLFxuICByZWdpc3RlclNlc3Npb24sXG4gIHVwZGF0ZVNlc3Npb25OYW1lLFxufSBmcm9tICdzcmMvdXRpbHMvY29uY3VycmVudFNlc3Npb25zLmpzJ1xuaW1wb3J0IHsgZ2V0Q3dkIH0gZnJvbSAnc3JjL3V0aWxzL2N3ZC5qcydcbmltcG9ydCB7IGxvZ0ZvckRlYnVnZ2luZywgc2V0SGFzRm9ybWF0dGVkT3V0cHV0IH0gZnJvbSAnc3JjL3V0aWxzL2RlYnVnLmpzJ1xuaW1wb3J0IHtcbiAgZXJyb3JNZXNzYWdlLFxuICBnZXRFcnJub0NvZGUsXG4gIGlzRU5PRU5ULFxuICBUZWxlcG9ydE9wZXJhdGlvbkVycm9yLFxuICB0b0Vycm9yLFxufSBmcm9tICdzcmMvdXRpbHMvZXJyb3JzLmpzJ1xuaW1wb3J0IHsgZ2V0RnNJbXBsZW1lbnRhdGlvbiwgc2FmZVJlc29sdmVQYXRoIH0gZnJvbSAnc3JjL3V0aWxzL2ZzT3BlcmF0aW9ucy5qcydcbmltcG9ydCB7XG4gIGdyYWNlZnVsU2h1dGRvd24sXG4gIGdyYWNlZnVsU2h1dGRvd25TeW5jLFxufSBmcm9tICdzcmMvdXRpbHMvZ3JhY2VmdWxTaHV0ZG93bi5qcydcbmltcG9ydCB7IHNldEFsbEhvb2tFdmVudHNFbmFibGVkIH0gZnJvbSAnc3JjL3V0aWxzL2hvb2tzL2hvb2tFdmVudHMuanMnXG5pbXBvcnQgeyByZWZyZXNoTW9kZWxDYXBhYmlsaXRpZXMgfSBmcm9tICdzcmMvdXRpbHMvbW9kZWwvbW9kZWxDYXBhYmlsaXRpZXMuanMnXG5pbXBvcnQgeyBwZWVrRm9yU3RkaW5EYXRhLCB3cml0ZVRvU3RkZXJyIH0gZnJvbSAnc3JjL3V0aWxzL3Byb2Nlc3MuanMnXG5pbXBvcnQgeyBzZXRDd2QgfSBmcm9tICdzcmMvdXRpbHMvU2hlbGwuanMnXG5pbXBvcnQge1xuICB0eXBlIFByb2Nlc3NlZFJlc3VtZSxcbiAgcHJvY2Vzc1Jlc3VtZWRDb252ZXJzYXRpb24sXG59IGZyb20gJ3NyYy91dGlscy9zZXNzaW9uUmVzdG9yZS5qcydcbmltcG9ydCB7IHBhcnNlU2V0dGluZ1NvdXJjZXNGbGFnIH0gZnJvbSAnc3JjL3V0aWxzL3NldHRpbmdzL2NvbnN0YW50cy5qcydcbmltcG9ydCB7IHBsdXJhbCB9IGZyb20gJ3NyYy91dGlscy9zdHJpbmdVdGlscy5qcydcbmltcG9ydCB7XG4gIHR5cGUgQ2hhbm5lbEVudHJ5LFxuICBnZXRJbml0aWFsTWFpbkxvb3BNb2RlbCxcbiAgZ2V0SXNOb25JbnRlcmFjdGl2ZVNlc3Npb24sXG4gIGdldFNka0JldGFzLFxuICBnZXRTZXNzaW9uSWQsXG4gIGdldFVzZXJNc2dPcHRJbixcbiAgc2V0QWxsb3dlZENoYW5uZWxzLFxuICBzZXRBbGxvd2VkU2V0dGluZ1NvdXJjZXMsXG4gIHNldENocm9tZUZsYWdPdmVycmlkZSxcbiAgc2V0Q2xpZW50VHlwZSxcbiAgc2V0Q3dkU3RhdGUsXG4gIHNldERpcmVjdENvbm5lY3RTZXJ2ZXJVcmwsXG4gIHNldEZsYWdTZXR0aW5nc1BhdGgsXG4gIHNldEluaXRpYWxNYWluTG9vcE1vZGVsLFxuICBzZXRJbmxpbmVQbHVnaW5zLFxuICBzZXRJc0ludGVyYWN0aXZlLFxuICBzZXRLYWlyb3NBY3RpdmUsXG4gIHNldE9yaWdpbmFsQ3dkLFxuICBzZXRRdWVzdGlvblByZXZpZXdGb3JtYXQsXG4gIHNldFNka0JldGFzLFxuICBzZXRTZXNzaW9uQnlwYXNzUGVybWlzc2lvbnNNb2RlLFxuICBzZXRTZXNzaW9uUGVyc2lzdGVuY2VEaXNhYmxlZCxcbiAgc2V0U2Vzc2lvblNvdXJjZSxcbiAgc2V0VXNlck1zZ09wdEluLFxuICBzd2l0Y2hTZXNzaW9uLFxufSBmcm9tICcuL2Jvb3RzdHJhcC9zdGF0ZS5qcydcblxuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuY29uc3QgYXV0b01vZGVTdGF0ZU1vZHVsZSA9IGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpXG4gID8gKHJlcXVpcmUoJy4vdXRpbHMvcGVybWlzc2lvbnMvYXV0b01vZGVTdGF0ZS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vdXRpbHMvcGVybWlzc2lvbnMvYXV0b01vZGVTdGF0ZS5qcycpKVxuICA6IG51bGxcblxuLy8gVGVsZXBvcnRSZXBvTWlzbWF0Y2hEaWFsb2csIFRlbGVwb3J0UmVzdW1lV3JhcHBlciBkeW5hbWljYWxseSBpbXBvcnRlZCBhdCBjYWxsIHNpdGVzXG5pbXBvcnQgeyBtaWdyYXRlQXV0b1VwZGF0ZXNUb1NldHRpbmdzIH0gZnJvbSAnLi9taWdyYXRpb25zL21pZ3JhdGVBdXRvVXBkYXRlc1RvU2V0dGluZ3MuanMnXG5pbXBvcnQgeyBtaWdyYXRlQnlwYXNzUGVybWlzc2lvbnNBY2NlcHRlZFRvU2V0dGluZ3MgfSBmcm9tICcuL21pZ3JhdGlvbnMvbWlncmF0ZUJ5cGFzc1Blcm1pc3Npb25zQWNjZXB0ZWRUb1NldHRpbmdzLmpzJ1xuaW1wb3J0IHsgbWlncmF0ZUVuYWJsZUFsbFByb2plY3RNY3BTZXJ2ZXJzVG9TZXR0aW5ncyB9IGZyb20gJy4vbWlncmF0aW9ucy9taWdyYXRlRW5hYmxlQWxsUHJvamVjdE1jcFNlcnZlcnNUb1NldHRpbmdzLmpzJ1xuaW1wb3J0IHsgbWlncmF0ZUZlbm5lY1RvT3B1cyB9IGZyb20gJy4vbWlncmF0aW9ucy9taWdyYXRlRmVubmVjVG9PcHVzLmpzJ1xuaW1wb3J0IHsgbWlncmF0ZUxlZ2FjeU9wdXNUb0N1cnJlbnQgfSBmcm9tICcuL21pZ3JhdGlvbnMvbWlncmF0ZUxlZ2FjeU9wdXNUb0N1cnJlbnQuanMnXG5pbXBvcnQgeyBtaWdyYXRlT3B1c1RvT3B1czFtIH0gZnJvbSAnLi9taWdyYXRpb25zL21pZ3JhdGVPcHVzVG9PcHVzMW0uanMnXG5pbXBvcnQgeyBtaWdyYXRlUmVwbEJyaWRnZUVuYWJsZWRUb1JlbW90ZUNvbnRyb2xBdFN0YXJ0dXAgfSBmcm9tICcuL21pZ3JhdGlvbnMvbWlncmF0ZVJlcGxCcmlkZ2VFbmFibGVkVG9SZW1vdGVDb250cm9sQXRTdGFydHVwLmpzJ1xuaW1wb3J0IHsgbWlncmF0ZVNvbm5ldDFtVG9Tb25uZXQ0NSB9IGZyb20gJy4vbWlncmF0aW9ucy9taWdyYXRlU29ubmV0MW1Ub1Nvbm5ldDQ1LmpzJ1xuaW1wb3J0IHsgbWlncmF0ZVNvbm5ldDQ1VG9Tb25uZXQ0NiB9IGZyb20gJy4vbWlncmF0aW9ucy9taWdyYXRlU29ubmV0NDVUb1Nvbm5ldDQ2LmpzJ1xuaW1wb3J0IHsgcmVzZXRBdXRvTW9kZU9wdEluRm9yRGVmYXVsdE9mZmVyIH0gZnJvbSAnLi9taWdyYXRpb25zL3Jlc2V0QXV0b01vZGVPcHRJbkZvckRlZmF1bHRPZmZlci5qcydcbmltcG9ydCB7IHJlc2V0UHJvVG9PcHVzRGVmYXVsdCB9IGZyb20gJy4vbWlncmF0aW9ucy9yZXNldFByb1RvT3B1c0RlZmF1bHQuanMnXG5pbXBvcnQgeyBjcmVhdGVSZW1vdGVTZXNzaW9uQ29uZmlnIH0gZnJvbSAnLi9yZW1vdGUvUmVtb3RlU2Vzc2lvbk1hbmFnZXIuanMnXG4vKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbi8vIHRlbGVwb3J0V2l0aFByb2dyZXNzIGR5bmFtaWNhbGx5IGltcG9ydGVkIGF0IGNhbGwgc2l0ZVxuaW1wb3J0IHtcbiAgY3JlYXRlRGlyZWN0Q29ubmVjdFNlc3Npb24sXG4gIERpcmVjdENvbm5lY3RFcnJvcixcbn0gZnJvbSAnLi9zZXJ2ZXIvY3JlYXRlRGlyZWN0Q29ubmVjdFNlc3Npb24uanMnXG5pbXBvcnQgeyBpbml0aWFsaXplTHNwU2VydmVyTWFuYWdlciB9IGZyb20gJy4vc2VydmljZXMvbHNwL21hbmFnZXIuanMnXG5pbXBvcnQgeyBzaG91bGRFbmFibGVQcm9tcHRTdWdnZXN0aW9uIH0gZnJvbSAnLi9zZXJ2aWNlcy9Qcm9tcHRTdWdnZXN0aW9uL3Byb21wdFN1Z2dlc3Rpb24uanMnXG5pbXBvcnQge1xuICB0eXBlIEFwcFN0YXRlLFxuICBnZXREZWZhdWx0QXBwU3RhdGUsXG4gIElETEVfU1BFQ1VMQVRJT05fU1RBVEUsXG59IGZyb20gJy4vc3RhdGUvQXBwU3RhdGVTdG9yZS5qcydcbmltcG9ydCB7IG9uQ2hhbmdlQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlL29uQ2hhbmdlQXBwU3RhdGUuanMnXG5pbXBvcnQgeyBjcmVhdGVTdG9yZSB9IGZyb20gJy4vc3RhdGUvc3RvcmUuanMnXG5pbXBvcnQgeyBhc1Nlc3Npb25JZCB9IGZyb20gJy4vdHlwZXMvaWRzLmpzJ1xuaW1wb3J0IHsgZmlsdGVyQWxsb3dlZFNka0JldGFzIH0gZnJvbSAnLi91dGlscy9iZXRhcy5qcydcbmltcG9ydCB7IGlzSW5CdW5kbGVkTW9kZSwgaXNSdW5uaW5nV2l0aEJ1biB9IGZyb20gJy4vdXRpbHMvYnVuZGxlZE1vZGUuanMnXG5pbXBvcnQgeyBsb2dGb3JEaWFnbm9zdGljc05vUElJIH0gZnJvbSAnLi91dGlscy9kaWFnTG9ncy5qcydcbmltcG9ydCB7XG4gIGZpbHRlckV4aXN0aW5nUGF0aHMsXG4gIGdldEtub3duUGF0aHNGb3JSZXBvLFxufSBmcm9tICcuL3V0aWxzL2dpdGh1YlJlcG9QYXRoTWFwcGluZy5qcydcbmltcG9ydCB7XG4gIGNsZWFyUGx1Z2luQ2FjaGUsXG4gIGxvYWRBbGxQbHVnaW5zQ2FjaGVPbmx5LFxufSBmcm9tICcuL3V0aWxzL3BsdWdpbnMvcGx1Z2luTG9hZGVyLmpzJ1xuaW1wb3J0IHsgbWlncmF0ZUNoYW5nZWxvZ0Zyb21Db25maWcgfSBmcm9tICcuL3V0aWxzL3JlbGVhc2VOb3Rlcy5qcydcbmltcG9ydCB7IFNhbmRib3hNYW5hZ2VyIH0gZnJvbSAnLi91dGlscy9zYW5kYm94L3NhbmRib3gtYWRhcHRlci5qcydcbmltcG9ydCB7IGZldGNoU2Vzc2lvbiwgcHJlcGFyZUFwaVJlcXVlc3QgfSBmcm9tICcuL3V0aWxzL3RlbGVwb3J0L2FwaS5qcydcbmltcG9ydCB7XG4gIGNoZWNrT3V0VGVsZXBvcnRlZFNlc3Npb25CcmFuY2gsXG4gIHByb2Nlc3NNZXNzYWdlc0ZvclRlbGVwb3J0UmVzdW1lLFxuICB0ZWxlcG9ydFRvUmVtb3RlV2l0aEVycm9ySGFuZGxpbmcsXG4gIHZhbGlkYXRlR2l0U3RhdGUsXG4gIHZhbGlkYXRlU2Vzc2lvblJlcG9zaXRvcnksXG59IGZyb20gJy4vdXRpbHMvdGVsZXBvcnQuanMnXG5pbXBvcnQge1xuICBzaG91bGRFbmFibGVUaGlua2luZ0J5RGVmYXVsdCxcbiAgdHlwZSBUaGlua2luZ0NvbmZpZyxcbn0gZnJvbSAnLi91dGlscy90aGlua2luZy5qcydcbmltcG9ydCB7IGluaXRVc2VyLCByZXNldFVzZXJDYWNoZSB9IGZyb20gJy4vdXRpbHMvdXNlci5qcydcbmltcG9ydCB7XG4gIGdldFRtdXhJbnN0YWxsSW5zdHJ1Y3Rpb25zLFxuICBpc1RtdXhBdmFpbGFibGUsXG4gIHBhcnNlUFJSZWZlcmVuY2UsXG59IGZyb20gJy4vdXRpbHMvd29ya3RyZWUuanMnXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tdG9wLWxldmVsLXNpZGUtZWZmZWN0c1xucHJvZmlsZUNoZWNrcG9pbnQoJ21haW5fdHN4X2ltcG9ydHNfbG9hZGVkJylcblxuLyoqXG4gKiBMb2cgbWFuYWdlZCBzZXR0aW5ncyBrZXlzIHRvIFN0YXRzaWcgZm9yIGFuYWx5dGljcy5cbiAqIFRoaXMgaXMgY2FsbGVkIGFmdGVyIGluaXQoKSBjb21wbGV0ZXMgdG8gZW5zdXJlIHNldHRpbmdzIGFyZSBsb2FkZWRcbiAqIGFuZCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgYXJlIGFwcGxpZWQgYmVmb3JlIG1vZGVsIHJlc29sdXRpb24uXG4gKi9cbmZ1bmN0aW9uIGxvZ01hbmFnZWRTZXR0aW5ncygpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwb2xpY3lTZXR0aW5ncyA9IGdldFNldHRpbmdzRm9yU291cmNlKCdwb2xpY3lTZXR0aW5ncycpXG4gICAgaWYgKHBvbGljeVNldHRpbmdzKSB7XG4gICAgICBjb25zdCBhbGxLZXlzID0gZ2V0TWFuYWdlZFNldHRpbmdzS2V5c0ZvckxvZ2dpbmcocG9saWN5U2V0dGluZ3MpXG4gICAgICBsb2dFdmVudCgndGVuZ3VfbWFuYWdlZF9zZXR0aW5nc19sb2FkZWQnLCB7XG4gICAgICAgIGtleUNvdW50OiBhbGxLZXlzLmxlbmd0aCxcbiAgICAgICAga2V5czogYWxsS2V5cy5qb2luKFxuICAgICAgICAgICcsJyxcbiAgICAgICAgKSBhcyB1bmtub3duIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KVxuICAgIH1cbiAgfSBjYXRjaCB7XG4gICAgLy8gU2lsZW50bHkgaWdub3JlIGVycm9ycyAtIHRoaXMgaXMganVzdCBmb3IgYW5hbHl0aWNzXG4gIH1cbn1cblxuLy8gQ2hlY2sgaWYgcnVubmluZyBpbiBkZWJ1Zy9pbnNwZWN0aW9uIG1vZGVcbmZ1bmN0aW9uIGlzQmVpbmdEZWJ1Z2dlZCgpIHtcbiAgY29uc3QgaXNCdW4gPSBpc1J1bm5pbmdXaXRoQnVuKClcblxuICAvLyBDaGVjayBmb3IgaW5zcGVjdCBmbGFncyBpbiBwcm9jZXNzIGFyZ3VtZW50cyAoaW5jbHVkaW5nIGFsbCB2YXJpYW50cylcbiAgY29uc3QgaGFzSW5zcGVjdEFyZyA9IHByb2Nlc3MuZXhlY0FyZ3Yuc29tZShhcmcgPT4ge1xuICAgIGlmIChpc0J1bikge1xuICAgICAgLy8gTm90ZTogQnVuIGhhcyBhbiBpc3N1ZSB3aXRoIHNpbmdsZS1maWxlIGV4ZWN1dGFibGVzIHdoZXJlIGFwcGxpY2F0aW9uIGFyZ3VtZW50c1xuICAgICAgLy8gZnJvbSBwcm9jZXNzLmFyZ3YgbGVhayBpbnRvIHByb2Nlc3MuZXhlY0FyZ3YgKHNpbWlsYXIgdG8gaHR0cHM6Ly9naXRodWIuY29tL292ZW4tc2gvYnVuL2lzc3Vlcy8xMTY3MylcbiAgICAgIC8vIFRoaXMgYnJlYWtzIHVzZSBvZiAtLWRlYnVnIG1vZGUgaWYgd2Ugb21pdCB0aGlzIGJyYW5jaFxuICAgICAgLy8gV2UncmUgZmluZSB0byBza2lwIHRoYXQgY2hlY2ssIGJlY2F1c2UgQnVuIGRvZXNuJ3Qgc3VwcG9ydCBOb2RlLmpzIGxlZ2FjeSAtLWRlYnVnIG9yIC0tZGVidWctYnJrIGZsYWdzXG4gICAgICByZXR1cm4gLy0taW5zcGVjdCgtYnJrKT8vLnRlc3QoYXJnKVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBJbiBOb2RlLmpzLCBjaGVjayBmb3IgYm90aCAtLWluc3BlY3QgYW5kIGxlZ2FjeSAtLWRlYnVnIGZsYWdzXG4gICAgICByZXR1cm4gLy0taW5zcGVjdCgtYnJrKT98LS1kZWJ1ZygtYnJrKT8vLnRlc3QoYXJnKVxuICAgIH1cbiAgfSlcblxuICAvLyBDaGVjayBpZiBOT0RFX09QVElPTlMgY29udGFpbnMgaW5zcGVjdCBmbGFnc1xuICBjb25zdCBoYXNJbnNwZWN0RW52ID1cbiAgICBwcm9jZXNzLmVudi5OT0RFX09QVElPTlMgJiZcbiAgICAvLS1pbnNwZWN0KC1icmspP3wtLWRlYnVnKC1icmspPy8udGVzdChwcm9jZXNzLmVudi5OT0RFX09QVElPTlMpXG5cbiAgLy8gQ2hlY2sgaWYgaW5zcGVjdG9yIGlzIGF2YWlsYWJsZSBhbmQgYWN0aXZlIChpbmRpY2F0ZXMgZGVidWdnaW5nKVxuICB0cnkge1xuICAgIC8vIER5bmFtaWMgaW1wb3J0IHdvdWxkIGJlIGJldHRlciBidXQgaXMgYXN5bmMgLSB1c2UgZ2xvYmFsIG9iamVjdCBpbnN0ZWFkXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCBpbnNwZWN0b3IgPSAoZ2xvYmFsIGFzIGFueSkucmVxdWlyZSgnaW5zcGVjdG9yJylcbiAgICBjb25zdCBoYXNJbnNwZWN0b3JVcmwgPSAhIWluc3BlY3Rvci51cmwoKVxuICAgIHJldHVybiBoYXNJbnNwZWN0b3JVcmwgfHwgaGFzSW5zcGVjdEFyZyB8fCBoYXNJbnNwZWN0RW52XG4gIH0gY2F0Y2gge1xuICAgIC8vIElnbm9yZSBlcnJvciBhbmQgZmFsbCBiYWNrIHRvIGFyZ3VtZW50IGRldGVjdGlvblxuICAgIHJldHVybiBoYXNJbnNwZWN0QXJnIHx8IGhhc0luc3BlY3RFbnZcbiAgfVxufVxuXG4vLyBFeGl0IGlmIHdlIGRldGVjdCBub2RlIGRlYnVnZ2luZyBvciBpbnNwZWN0aW9uXG5pZiAoXCJleHRlcm5hbFwiICE9PSAnYW50JyAmJiBpc0JlaW5nRGVidWdnZWQoKSkge1xuICAvLyBVc2UgcHJvY2Vzcy5leGl0IGRpcmVjdGx5IGhlcmUgc2luY2Ugd2UncmUgaW4gdGhlIHRvcC1sZXZlbCBjb2RlIGJlZm9yZSBpbXBvcnRzXG4gIC8vIGFuZCBncmFjZWZ1bFNodXRkb3duIGlzIG5vdCB5ZXQgYXZhaWxhYmxlXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tdG9wLWxldmVsLXNpZGUtZWZmZWN0c1xuICBwcm9jZXNzLmV4aXQoMSlcbn1cblxuLyoqXG4gKiBQZXItc2Vzc2lvbiBza2lsbC9wbHVnaW4gdGVsZW1ldHJ5LiBDYWxsZWQgZnJvbSBib3RoIHRoZSBpbnRlcmFjdGl2ZSBwYXRoXG4gKiBhbmQgdGhlIGhlYWRsZXNzIC1wIHBhdGggKGJlZm9yZSBydW5IZWFkbGVzcykg4oCUIGJvdGggZ28gdGhyb3VnaFxuICogbWFpbi50c3ggYnV0IGJyYW5jaCBiZWZvcmUgdGhlIGludGVyYWN0aXZlIHN0YXJ0dXAgcGF0aCwgc28gaXQgbmVlZHMgdHdvXG4gKiBjYWxsIHNpdGVzIGhlcmUgcmF0aGVyIHRoYW4gb25lIGhlcmUgKyBvbmUgaW4gUXVlcnlFbmdpbmUuXG4gKi9cbmZ1bmN0aW9uIGxvZ1Nlc3Npb25UZWxlbWV0cnkoKTogdm9pZCB7XG4gIGNvbnN0IG1vZGVsID0gcGFyc2VVc2VyU3BlY2lmaWVkTW9kZWwoXG4gICAgZ2V0SW5pdGlhbE1haW5Mb29wTW9kZWwoKSA/PyBnZXREZWZhdWx0TWFpbkxvb3BNb2RlbCgpLFxuICApXG4gIHZvaWQgbG9nU2tpbGxzTG9hZGVkKGdldEN3ZCgpLCBnZXRDb250ZXh0V2luZG93Rm9yTW9kZWwobW9kZWwsIGdldFNka0JldGFzKCkpKVxuICB2b2lkIGxvYWRBbGxQbHVnaW5zQ2FjaGVPbmx5KClcbiAgICAudGhlbigoeyBlbmFibGVkLCBlcnJvcnMgfSkgPT4ge1xuICAgICAgY29uc3QgbWFuYWdlZE5hbWVzID0gZ2V0TWFuYWdlZFBsdWdpbk5hbWVzKClcbiAgICAgIGxvZ1BsdWdpbnNFbmFibGVkRm9yU2Vzc2lvbihlbmFibGVkLCBtYW5hZ2VkTmFtZXMsIGdldFBsdWdpblNlZWREaXJzKCkpXG4gICAgICBsb2dQbHVnaW5Mb2FkRXJyb3JzKGVycm9ycywgbWFuYWdlZE5hbWVzKVxuICAgIH0pXG4gICAgLmNhdGNoKGVyciA9PiBsb2dFcnJvcihlcnIpKVxufVxuXG5mdW5jdGlvbiBnZXRDZXJ0RW52VmFyVGVsZW1ldHJ5KCk6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+IHtcbiAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHt9XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VYVFJBX0NBX0NFUlRTKSB7XG4gICAgcmVzdWx0Lmhhc19ub2RlX2V4dHJhX2NhX2NlcnRzID0gdHJ1ZVxuICB9XG4gIGlmIChwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9DTElFTlRfQ0VSVCkge1xuICAgIHJlc3VsdC5oYXNfY2xpZW50X2NlcnQgPSB0cnVlXG4gIH1cbiAgaWYgKGhhc05vZGVPcHRpb24oJy0tdXNlLXN5c3RlbS1jYScpKSB7XG4gICAgcmVzdWx0Lmhhc191c2Vfc3lzdGVtX2NhID0gdHJ1ZVxuICB9XG4gIGlmIChoYXNOb2RlT3B0aW9uKCctLXVzZS1vcGVuc3NsLWNhJykpIHtcbiAgICByZXN1bHQuaGFzX3VzZV9vcGVuc3NsX2NhID0gdHJ1ZVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9nU3RhcnR1cFRlbGVtZXRyeSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKGlzQW5hbHl0aWNzRGlzYWJsZWQoKSkgcmV0dXJuXG4gIGNvbnN0IFtpc0dpdCwgd29ya3RyZWVDb3VudCwgZ2hBdXRoU3RhdHVzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICBnZXRJc0dpdCgpLFxuICAgIGdldFdvcmt0cmVlQ291bnQoKSxcbiAgICBnZXRHaEF1dGhTdGF0dXMoKSxcbiAgXSlcblxuICBsb2dFdmVudCgndGVuZ3Vfc3RhcnR1cF90ZWxlbWV0cnknLCB7XG4gICAgaXNfZ2l0OiBpc0dpdCxcbiAgICB3b3JrdHJlZV9jb3VudDogd29ya3RyZWVDb3VudCxcbiAgICBnaF9hdXRoX3N0YXR1czpcbiAgICAgIGdoQXV0aFN0YXR1cyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIHNhbmRib3hfZW5hYmxlZDogU2FuZGJveE1hbmFnZXIuaXNTYW5kYm94aW5nRW5hYmxlZCgpLFxuICAgIGFyZV91bnNhbmRib3hlZF9jb21tYW5kc19hbGxvd2VkOlxuICAgICAgU2FuZGJveE1hbmFnZXIuYXJlVW5zYW5kYm94ZWRDb21tYW5kc0FsbG93ZWQoKSxcbiAgICBpc19hdXRvX2Jhc2hfYWxsb3dlZF9pZl9zYW5kYm94X2VuYWJsZWQ6XG4gICAgICBTYW5kYm94TWFuYWdlci5pc0F1dG9BbGxvd0Jhc2hJZlNhbmRib3hlZEVuYWJsZWQoKSxcbiAgICBhdXRvX3VwZGF0ZXJfZGlzYWJsZWQ6IGlzQXV0b1VwZGF0ZXJEaXNhYmxlZCgpLFxuICAgIHByZWZlcnNfcmVkdWNlZF9tb3Rpb246IGdldEluaXRpYWxTZXR0aW5ncygpLnByZWZlcnNSZWR1Y2VkTW90aW9uID8/IGZhbHNlLFxuICAgIC4uLmdldENlcnRFbnZWYXJUZWxlbWV0cnkoKSxcbiAgfSlcbn1cblxuLy8gQFtNT0RFTCBMQVVOQ0hdOiBDb25zaWRlciBhbnkgbWlncmF0aW9ucyB5b3UgbWF5IG5lZWQgZm9yIG1vZGVsIHN0cmluZ3MuIFNlZSBtaWdyYXRlU29ubmV0MW1Ub1Nvbm5ldDQ1LnRzIGZvciBhbiBleGFtcGxlLlxuLy8gQnVtcCB0aGlzIHdoZW4gYWRkaW5nIGEgbmV3IHN5bmMgbWlncmF0aW9uIHNvIGV4aXN0aW5nIHVzZXJzIHJlLXJ1biB0aGUgc2V0LlxuY29uc3QgQ1VSUkVOVF9NSUdSQVRJT05fVkVSU0lPTiA9IDExXG5mdW5jdGlvbiBydW5NaWdyYXRpb25zKCk6IHZvaWQge1xuICBpZiAoZ2V0R2xvYmFsQ29uZmlnKCkubWlncmF0aW9uVmVyc2lvbiAhPT0gQ1VSUkVOVF9NSUdSQVRJT05fVkVSU0lPTikge1xuICAgIG1pZ3JhdGVBdXRvVXBkYXRlc1RvU2V0dGluZ3MoKVxuICAgIG1pZ3JhdGVCeXBhc3NQZXJtaXNzaW9uc0FjY2VwdGVkVG9TZXR0aW5ncygpXG4gICAgbWlncmF0ZUVuYWJsZUFsbFByb2plY3RNY3BTZXJ2ZXJzVG9TZXR0aW5ncygpXG4gICAgcmVzZXRQcm9Ub09wdXNEZWZhdWx0KClcbiAgICBtaWdyYXRlU29ubmV0MW1Ub1Nvbm5ldDQ1KClcbiAgICBtaWdyYXRlTGVnYWN5T3B1c1RvQ3VycmVudCgpXG4gICAgbWlncmF0ZVNvbm5ldDQ1VG9Tb25uZXQ0NigpXG4gICAgbWlncmF0ZU9wdXNUb09wdXMxbSgpXG4gICAgbWlncmF0ZVJlcGxCcmlkZ2VFbmFibGVkVG9SZW1vdGVDb250cm9sQXRTdGFydHVwKClcbiAgICBpZiAoZmVhdHVyZSgnVFJBTlNDUklQVF9DTEFTU0lGSUVSJykpIHtcbiAgICAgIHJlc2V0QXV0b01vZGVPcHRJbkZvckRlZmF1bHRPZmZlcigpXG4gICAgfVxuICAgIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnKSB7XG4gICAgICBtaWdyYXRlRmVubmVjVG9PcHVzKClcbiAgICB9XG4gICAgc2F2ZUdsb2JhbENvbmZpZyhwcmV2ID0+XG4gICAgICBwcmV2Lm1pZ3JhdGlvblZlcnNpb24gPT09IENVUlJFTlRfTUlHUkFUSU9OX1ZFUlNJT05cbiAgICAgICAgPyBwcmV2XG4gICAgICAgIDogeyAuLi5wcmV2LCBtaWdyYXRpb25WZXJzaW9uOiBDVVJSRU5UX01JR1JBVElPTl9WRVJTSU9OIH0sXG4gICAgKVxuICB9XG4gIC8vIEFzeW5jIG1pZ3JhdGlvbiAtIGZpcmUgYW5kIGZvcmdldCBzaW5jZSBpdCdzIG5vbi1ibG9ja2luZ1xuICBtaWdyYXRlQ2hhbmdlbG9nRnJvbUNvbmZpZygpLmNhdGNoKCgpID0+IHtcbiAgICAvLyBTaWxlbnRseSBpZ25vcmUgbWlncmF0aW9uIGVycm9ycyAtIHdpbGwgcmV0cnkgb24gbmV4dCBzdGFydHVwXG4gIH0pXG59XG5cbi8qKlxuICogUHJlZmV0Y2ggc3lzdGVtIGNvbnRleHQgKGluY2x1ZGluZyBnaXQgc3RhdHVzKSBvbmx5IHdoZW4gaXQncyBzYWZlIHRvIGRvIHNvLlxuICogR2l0IGNvbW1hbmRzIGNhbiBleGVjdXRlIGFyYml0cmFyeSBjb2RlIHZpYSBob29rcyBhbmQgY29uZmlnIChlLmcuLCBjb3JlLmZzbW9uaXRvcixcbiAqIGRpZmYuZXh0ZXJuYWwpLCBzbyB3ZSBtdXN0IG9ubHkgcnVuIHRoZW0gYWZ0ZXIgdHJ1c3QgaXMgZXN0YWJsaXNoZWQgb3IgaW5cbiAqIG5vbi1pbnRlcmFjdGl2ZSBtb2RlIHdoZXJlIHRydXN0IGlzIGltcGxpY2l0LlxuICovXG5mdW5jdGlvbiBwcmVmZXRjaFN5c3RlbUNvbnRleHRJZlNhZmUoKTogdm9pZCB7XG4gIGNvbnN0IGlzTm9uSW50ZXJhY3RpdmVTZXNzaW9uID0gZ2V0SXNOb25JbnRlcmFjdGl2ZVNlc3Npb24oKVxuXG4gIC8vIEluIG5vbi1pbnRlcmFjdGl2ZSBtb2RlICgtLXByaW50KSwgdHJ1c3QgZGlhbG9nIGlzIHNraXBwZWQgYW5kXG4gIC8vIGV4ZWN1dGlvbiBpcyBjb25zaWRlcmVkIHRydXN0ZWQgKGFzIGRvY3VtZW50ZWQgaW4gaGVscCB0ZXh0KVxuICBpZiAoaXNOb25JbnRlcmFjdGl2ZVNlc3Npb24pIHtcbiAgICBsb2dGb3JEaWFnbm9zdGljc05vUElJKCdpbmZvJywgJ3ByZWZldGNoX3N5c3RlbV9jb250ZXh0X25vbl9pbnRlcmFjdGl2ZScpXG4gICAgdm9pZCBnZXRTeXN0ZW1Db250ZXh0KClcbiAgICByZXR1cm5cbiAgfVxuXG4gIC8vIEluIGludGVyYWN0aXZlIG1vZGUsIG9ubHkgcHJlZmV0Y2ggaWYgdHJ1c3QgaGFzIGFscmVhZHkgYmVlbiBlc3RhYmxpc2hlZFxuICBjb25zdCBoYXNUcnVzdCA9IGNoZWNrSGFzVHJ1c3REaWFsb2dBY2NlcHRlZCgpXG4gIGlmIChoYXNUcnVzdCkge1xuICAgIGxvZ0ZvckRpYWdub3N0aWNzTm9QSUkoJ2luZm8nLCAncHJlZmV0Y2hfc3lzdGVtX2NvbnRleHRfaGFzX3RydXN0JylcbiAgICB2b2lkIGdldFN5c3RlbUNvbnRleHQoKVxuICB9IGVsc2Uge1xuICAgIGxvZ0ZvckRpYWdub3N0aWNzTm9QSUkoJ2luZm8nLCAncHJlZmV0Y2hfc3lzdGVtX2NvbnRleHRfc2tpcHBlZF9ub190cnVzdCcpXG4gIH1cbiAgLy8gT3RoZXJ3aXNlLCBkb24ndCBwcmVmZXRjaCAtIHdhaXQgZm9yIHRydXN0IHRvIGJlIGVzdGFibGlzaGVkIGZpcnN0XG59XG5cbi8qKlxuICogU3RhcnQgYmFja2dyb3VuZCBwcmVmZXRjaGVzIGFuZCBob3VzZWtlZXBpbmcgdGhhdCBhcmUgTk9UIG5lZWRlZCBiZWZvcmUgZmlyc3QgcmVuZGVyLlxuICogVGhlc2UgYXJlIGRlZmVycmVkIGZyb20gc2V0dXAoKSB0byByZWR1Y2UgZXZlbnQgbG9vcCBjb250ZW50aW9uIGFuZCBjaGlsZCBwcm9jZXNzXG4gKiBzcGF3bmluZyBkdXJpbmcgdGhlIGNyaXRpY2FsIHN0YXJ0dXAgcGF0aC5cbiAqIENhbGwgdGhpcyBhZnRlciB0aGUgUkVQTCBoYXMgYmVlbiByZW5kZXJlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0RGVmZXJyZWRQcmVmZXRjaGVzKCk6IHZvaWQge1xuICAvLyBUaGlzIGZ1bmN0aW9uIHJ1bnMgYWZ0ZXIgZmlyc3QgcmVuZGVyLCBzbyBpdCBkb2Vzbid0IGJsb2NrIHRoZSBpbml0aWFsIHBhaW50LlxuICAvLyBIb3dldmVyLCB0aGUgc3Bhd25lZCBwcm9jZXNzZXMgYW5kIGFzeW5jIHdvcmsgc3RpbGwgY29udGVuZCBmb3IgQ1BVIGFuZCBldmVudFxuICAvLyBsb29wIHRpbWUsIHdoaWNoIHNrZXdzIHN0YXJ0dXAgYmVuY2htYXJrcyAoQ1BVIHByb2ZpbGVzLCB0aW1lLXRvLWZpcnN0LXJlbmRlclxuICAvLyBtZWFzdXJlbWVudHMpLiBTa2lwIGFsbCBvZiBpdCB3aGVuIHdlJ3JlIG9ubHkgbWVhc3VyaW5nIHN0YXJ0dXAgcGVyZm9ybWFuY2UuXG4gIGlmIChcbiAgICBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9FWElUX0FGVEVSX0ZJUlNUX1JFTkRFUikgfHxcbiAgICAvLyAtLWJhcmU6IHNraXAgQUxMIHByZWZldGNoZXMuIFRoZXNlIGFyZSBjYWNoZS13YXJtcyBmb3IgdGhlIFJFUEwnc1xuICAgIC8vIGZpcnN0LXR1cm4gcmVzcG9uc2l2ZW5lc3MgKGluaXRVc2VyLCBnZXRVc2VyQ29udGV4dCwgdGlwcywgY291bnRGaWxlcyxcbiAgICAvLyBtb2RlbENhcGFiaWxpdGllcywgY2hhbmdlIGRldGVjdG9ycykuIFNjcmlwdGVkIC1wIGNhbGxzIGRvbid0IGhhdmUgYVxuICAgIC8vIFwidXNlciBpcyB0eXBpbmdcIiB3aW5kb3cgdG8gaGlkZSB0aGlzIHdvcmsgaW4g4oCUIGl0J3MgcHVyZSBvdmVyaGVhZCBvblxuICAgIC8vIHRoZSBjcml0aWNhbCBwYXRoLlxuICAgIGlzQmFyZU1vZGUoKVxuICApIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIC8vIFByb2Nlc3Mtc3Bhd25pbmcgcHJlZmV0Y2hlcyAoY29uc3VtZWQgYXQgZmlyc3QgQVBJIGNhbGwsIHVzZXIgaXMgc3RpbGwgdHlwaW5nKVxuICB2b2lkIGluaXRVc2VyKClcbiAgdm9pZCBnZXRVc2VyQ29udGV4dCgpXG4gIHByZWZldGNoU3lzdGVtQ29udGV4dElmU2FmZSgpXG4gIHZvaWQgZ2V0UmVsZXZhbnRUaXBzKClcbiAgaWYgKFxuICAgIGlzRW52VHJ1dGh5KHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX1VTRV9CRURST0NLKSAmJlxuICAgICFpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9TS0lQX0JFRFJPQ0tfQVVUSClcbiAgKSB7XG4gICAgdm9pZCBwcmVmZXRjaEF3c0NyZWRlbnRpYWxzQW5kQmVkUm9ja0luZm9JZlNhZmUoKVxuICB9XG4gIGlmIChcbiAgICBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9VU0VfVkVSVEVYKSAmJlxuICAgICFpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9TS0lQX1ZFUlRFWF9BVVRIKVxuICApIHtcbiAgICB2b2lkIHByZWZldGNoR2NwQ3JlZGVudGlhbHNJZlNhZmUoKVxuICB9XG4gIHZvaWQgY291bnRGaWxlc1JvdW5kZWRSZyhnZXRDd2QoKSwgQWJvcnRTaWduYWwudGltZW91dCgzMDAwKSwgW10pXG5cbiAgLy8gQW5hbHl0aWNzIGFuZCBmZWF0dXJlIGZsYWcgaW5pdGlhbGl6YXRpb25cbiAgdm9pZCBpbml0aWFsaXplQW5hbHl0aWNzR2F0ZXMoKVxuICB2b2lkIHByZWZldGNoT2ZmaWNpYWxNY3BVcmxzKClcblxuICB2b2lkIHJlZnJlc2hNb2RlbENhcGFiaWxpdGllcygpXG5cbiAgLy8gRmlsZSBjaGFuZ2UgZGV0ZWN0b3JzIGRlZmVycmVkIGZyb20gaW5pdCgpIHRvIHVuYmxvY2sgZmlyc3QgcmVuZGVyXG4gIHZvaWQgc2V0dGluZ3NDaGFuZ2VEZXRlY3Rvci5pbml0aWFsaXplKClcbiAgaWYgKCFpc0JhcmVNb2RlKCkpIHtcbiAgICB2b2lkIHNraWxsQ2hhbmdlRGV0ZWN0b3IuaW5pdGlhbGl6ZSgpXG4gIH1cblxuICAvLyBFdmVudCBsb29wIHN0YWxsIGRldGVjdG9yIOKAlCBsb2dzIHdoZW4gdGhlIG1haW4gdGhyZWFkIGlzIGJsb2NrZWQgPjUwMG1zXG4gIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnKSB7XG4gICAgdm9pZCBpbXBvcnQoJy4vdXRpbHMvZXZlbnRMb29wU3RhbGxEZXRlY3Rvci5qcycpLnRoZW4obSA9PlxuICAgICAgbS5zdGFydEV2ZW50TG9vcFN0YWxsRGV0ZWN0b3IoKSxcbiAgICApXG4gIH1cbn1cblxuZnVuY3Rpb24gbG9hZFNldHRpbmdzRnJvbUZsYWcoc2V0dGluZ3NGaWxlOiBzdHJpbmcpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB0cmltbWVkU2V0dGluZ3MgPSBzZXR0aW5nc0ZpbGUudHJpbSgpXG4gICAgY29uc3QgbG9va3NMaWtlSnNvbiA9XG4gICAgICB0cmltbWVkU2V0dGluZ3Muc3RhcnRzV2l0aCgneycpICYmIHRyaW1tZWRTZXR0aW5ncy5lbmRzV2l0aCgnfScpXG5cbiAgICBsZXQgc2V0dGluZ3NQYXRoOiBzdHJpbmdcblxuICAgIGlmIChsb29rc0xpa2VKc29uKSB7XG4gICAgICAvLyBJdCdzIGEgSlNPTiBzdHJpbmcgLSB2YWxpZGF0ZSBhbmQgY3JlYXRlIHRlbXAgZmlsZVxuICAgICAgY29uc3QgcGFyc2VkSnNvbiA9IHNhZmVQYXJzZUpTT04odHJpbW1lZFNldHRpbmdzKVxuICAgICAgaWYgKCFwYXJzZWRKc29uKSB7XG4gICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgIGNoYWxrLnJlZCgnRXJyb3I6IEludmFsaWQgSlNPTiBwcm92aWRlZCB0byAtLXNldHRpbmdzXFxuJyksXG4gICAgICAgIClcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBhIHRlbXBvcmFyeSBmaWxlIGFuZCB3cml0ZSB0aGUgSlNPTiB0byBpdC5cbiAgICAgIC8vIFVzZSBhIGNvbnRlbnQtaGFzaC1iYXNlZCBwYXRoIGluc3RlYWQgb2YgcmFuZG9tIFVVSUQgdG8gYXZvaWRcbiAgICAgIC8vIGJ1c3RpbmcgdGhlIEFudGhyb3BpYyBBUEkgcHJvbXB0IGNhY2hlLiBUaGUgc2V0dGluZ3MgcGF0aCBlbmRzIHVwXG4gICAgICAvLyBpbiB0aGUgQmFzaCB0b29sJ3Mgc2FuZGJveCBkZW55V2l0aGluQWxsb3cgbGlzdCwgd2hpY2ggaXMgcGFydCBvZlxuICAgICAgLy8gdGhlIHRvb2wgZGVzY3JpcHRpb24gc2VudCB0byB0aGUgQVBJLiBBIHJhbmRvbSBVVUlEIHBlciBzdWJwcm9jZXNzXG4gICAgICAvLyBjaGFuZ2VzIHRoZSB0b29sIGRlc2NyaXB0aW9uIG9uIGV2ZXJ5IHF1ZXJ5KCkgY2FsbCwgaW52YWxpZGF0aW5nXG4gICAgICAvLyB0aGUgY2FjaGUgcHJlZml4IGFuZCBjYXVzaW5nIGEgMTJ4IGlucHV0IHRva2VuIGNvc3QgcGVuYWx0eS5cbiAgICAgIC8vIFRoZSBjb250ZW50IGhhc2ggZW5zdXJlcyBpZGVudGljYWwgc2V0dGluZ3MgcHJvZHVjZSB0aGUgc2FtZSBwYXRoXG4gICAgICAvLyBhY3Jvc3MgcHJvY2VzcyBib3VuZGFyaWVzIChlYWNoIFNESyBxdWVyeSgpIHNwYXducyBhIG5ldyBwcm9jZXNzKS5cbiAgICAgIHNldHRpbmdzUGF0aCA9IGdlbmVyYXRlVGVtcEZpbGVQYXRoKCdjbGF1ZGUtc2V0dGluZ3MnLCAnLmpzb24nLCB7XG4gICAgICAgIGNvbnRlbnRIYXNoOiB0cmltbWVkU2V0dGluZ3MsXG4gICAgICB9KVxuICAgICAgd3JpdGVGaWxlU3luY19ERVBSRUNBVEVEKHNldHRpbmdzUGF0aCwgdHJpbW1lZFNldHRpbmdzLCAndXRmOCcpXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEl0J3MgYSBmaWxlIHBhdGggLSByZXNvbHZlIGFuZCB2YWxpZGF0ZSBieSBhdHRlbXB0aW5nIHRvIHJlYWRcbiAgICAgIGNvbnN0IHsgcmVzb2x2ZWRQYXRoOiByZXNvbHZlZFNldHRpbmdzUGF0aCB9ID0gc2FmZVJlc29sdmVQYXRoKFxuICAgICAgICBnZXRGc0ltcGxlbWVudGF0aW9uKCksXG4gICAgICAgIHNldHRpbmdzRmlsZSxcbiAgICAgIClcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlYWRGaWxlU3luYyhyZXNvbHZlZFNldHRpbmdzUGF0aCwgJ3V0ZjgnKVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoaXNFTk9FTlQoZSkpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICAgIGNoYWxrLnJlZChcbiAgICAgICAgICAgICAgYEVycm9yOiBTZXR0aW5ncyBmaWxlIG5vdCBmb3VuZDogJHtyZXNvbHZlZFNldHRpbmdzUGF0aH1cXG5gLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICApXG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgZVxuICAgICAgfVxuICAgICAgc2V0dGluZ3NQYXRoID0gcmVzb2x2ZWRTZXR0aW5nc1BhdGhcbiAgICB9XG5cbiAgICBzZXRGbGFnU2V0dGluZ3NQYXRoKHNldHRpbmdzUGF0aClcbiAgICByZXNldFNldHRpbmdzQ2FjaGUoKVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBsb2dFcnJvcihlcnJvcilcbiAgICB9XG4gICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICBjaGFsay5yZWQoYEVycm9yIHByb2Nlc3Npbmcgc2V0dGluZ3M6ICR7ZXJyb3JNZXNzYWdlKGVycm9yKX1cXG5gKSxcbiAgICApXG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cbn1cblxuZnVuY3Rpb24gbG9hZFNldHRpbmdTb3VyY2VzRnJvbUZsYWcoc2V0dGluZ1NvdXJjZXNBcmc6IHN0cmluZyk6IHZvaWQge1xuICB0cnkge1xuICAgIGNvbnN0IHNvdXJjZXMgPSBwYXJzZVNldHRpbmdTb3VyY2VzRmxhZyhzZXR0aW5nU291cmNlc0FyZylcbiAgICBzZXRBbGxvd2VkU2V0dGluZ1NvdXJjZXMoc291cmNlcylcbiAgICByZXNldFNldHRpbmdzQ2FjaGUoKVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICBsb2dFcnJvcihlcnJvcilcbiAgICB9XG4gICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICBjaGFsay5yZWQoYEVycm9yIHByb2Nlc3NpbmcgLS1zZXR0aW5nLXNvdXJjZXM6ICR7ZXJyb3JNZXNzYWdlKGVycm9yKX1cXG5gKSxcbiAgICApXG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cbn1cblxuLyoqXG4gKiBQYXJzZSBhbmQgbG9hZCBzZXR0aW5ncyBmbGFncyBlYXJseSwgYmVmb3JlIGluaXQoKVxuICogVGhpcyBlbnN1cmVzIHNldHRpbmdzIGFyZSBmaWx0ZXJlZCBmcm9tIHRoZSBzdGFydCBvZiBpbml0aWFsaXphdGlvblxuICovXG5mdW5jdGlvbiBlYWdlckxvYWRTZXR0aW5ncygpOiB2b2lkIHtcbiAgcHJvZmlsZUNoZWNrcG9pbnQoJ2VhZ2VyTG9hZFNldHRpbmdzX3N0YXJ0JylcbiAgLy8gUGFyc2UgLS1zZXR0aW5ncyBmbGFnIGVhcmx5IHRvIGVuc3VyZSBzZXR0aW5ncyBhcmUgbG9hZGVkIGJlZm9yZSBpbml0KClcbiAgY29uc3Qgc2V0dGluZ3NGaWxlID0gZWFnZXJQYXJzZUNsaUZsYWcoJy0tc2V0dGluZ3MnKVxuICBpZiAoc2V0dGluZ3NGaWxlKSB7XG4gICAgbG9hZFNldHRpbmdzRnJvbUZsYWcoc2V0dGluZ3NGaWxlKVxuICB9XG5cbiAgLy8gUGFyc2UgLS1zZXR0aW5nLXNvdXJjZXMgZmxhZyBlYXJseSB0byBjb250cm9sIHdoaWNoIHNvdXJjZXMgYXJlIGxvYWRlZFxuICBjb25zdCBzZXR0aW5nU291cmNlc0FyZyA9IGVhZ2VyUGFyc2VDbGlGbGFnKCctLXNldHRpbmctc291cmNlcycpXG4gIGlmIChzZXR0aW5nU291cmNlc0FyZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgbG9hZFNldHRpbmdTb3VyY2VzRnJvbUZsYWcoc2V0dGluZ1NvdXJjZXNBcmcpXG4gIH1cbiAgcHJvZmlsZUNoZWNrcG9pbnQoJ2VhZ2VyTG9hZFNldHRpbmdzX2VuZCcpXG59XG5cbmZ1bmN0aW9uIGluaXRpYWxpemVFbnRyeXBvaW50KGlzTm9uSW50ZXJhY3RpdmU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgLy8gU2tpcCBpZiBhbHJlYWR5IHNldCAoZS5nLiwgYnkgU0RLIG9yIG90aGVyIGVudHJ5cG9pbnRzKVxuICBpZiAocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfRU5UUllQT0lOVCkge1xuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3QgY2xpQXJncyA9IHByb2Nlc3MuYXJndi5zbGljZSgyKVxuXG4gIC8vIENoZWNrIGZvciBNQ1Agc2VydmUgY29tbWFuZCAoaGFuZGxlIGZsYWdzIGJlZm9yZSBtY3Agc2VydmUsIGUuZy4sIC0tZGVidWcgbWNwIHNlcnZlKVxuICBjb25zdCBtY3BJbmRleCA9IGNsaUFyZ3MuaW5kZXhPZignbWNwJylcbiAgaWYgKG1jcEluZGV4ICE9PSAtMSAmJiBjbGlBcmdzW21jcEluZGV4ICsgMV0gPT09ICdzZXJ2ZScpIHtcbiAgICBwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9FTlRSWVBPSU5UID0gJ21jcCdcbiAgICByZXR1cm5cbiAgfVxuXG4gIGlmIChpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9BQ1RJT04pKSB7XG4gICAgcHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfRU5UUllQT0lOVCA9ICdjbGF1ZGUtY29kZS1naXRodWItYWN0aW9uJ1xuICAgIHJldHVyblxuICB9XG5cbiAgLy8gTm90ZTogJ2xvY2FsLWFnZW50JyBlbnRyeXBvaW50IGlzIHNldCBieSB0aGUgbG9jYWwgYWdlbnQgbW9kZSBsYXVuY2hlclxuICAvLyB2aWEgQ0xBVURFX0NPREVfRU5UUllQT0lOVCBlbnYgdmFyIChoYW5kbGVkIGJ5IGVhcmx5IHJldHVybiBhYm92ZSlcblxuICAvLyBTZXQgYmFzZWQgb24gaW50ZXJhY3RpdmUgc3RhdHVzXG4gIHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0VOVFJZUE9JTlQgPSBpc05vbkludGVyYWN0aXZlID8gJ3Nkay1jbGknIDogJ2NsaSdcbn1cblxuLy8gU2V0IGJ5IGVhcmx5IGFyZ3YgcHJvY2Vzc2luZyB3aGVuIGBjbGF1ZGUgb3BlbiA8dXJsPmAgaXMgZGV0ZWN0ZWQgKGludGVyYWN0aXZlIG1vZGUgb25seSlcbnR5cGUgUGVuZGluZ0Nvbm5lY3QgPSB7XG4gIHVybDogc3RyaW5nIHwgdW5kZWZpbmVkXG4gIGF1dGhUb2tlbjogc3RyaW5nIHwgdW5kZWZpbmVkXG4gIGRhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zOiBib29sZWFuXG59XG5jb25zdCBfcGVuZGluZ0Nvbm5lY3Q6IFBlbmRpbmdDb25uZWN0IHwgdW5kZWZpbmVkID0gZmVhdHVyZSgnRElSRUNUX0NPTk5FQ1QnKVxuICA/IHsgdXJsOiB1bmRlZmluZWQsIGF1dGhUb2tlbjogdW5kZWZpbmVkLCBkYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uczogZmFsc2UgfVxuICA6IHVuZGVmaW5lZFxuXG4vLyBTZXQgYnkgZWFybHkgYXJndiBwcm9jZXNzaW5nIHdoZW4gYGNsYXVkZSBhc3Npc3RhbnQgW3Nlc3Npb25JZF1gIGlzIGRldGVjdGVkXG50eXBlIFBlbmRpbmdBc3Npc3RhbnRDaGF0ID0geyBzZXNzaW9uSWQ/OiBzdHJpbmc7IGRpc2NvdmVyOiBib29sZWFuIH1cbmNvbnN0IF9wZW5kaW5nQXNzaXN0YW50Q2hhdDogUGVuZGluZ0Fzc2lzdGFudENoYXQgfCB1bmRlZmluZWQgPSBmZWF0dXJlKFxuICAnS0FJUk9TJyxcbilcbiAgPyB7IHNlc3Npb25JZDogdW5kZWZpbmVkLCBkaXNjb3ZlcjogZmFsc2UgfVxuICA6IHVuZGVmaW5lZFxuXG4vLyBgY2xhdWRlIHNzaCA8aG9zdD4gW2Rpcl1gIOKAlCBwYXJzZWQgZnJvbSBhcmd2IGVhcmx5IChzYW1lIHBhdHRlcm4gYXNcbi8vIERJUkVDVF9DT05ORUNUIGFib3ZlKSBzbyB0aGUgbWFpbiBjb21tYW5kIHBhdGggY2FuIHBpY2sgaXQgdXAgYW5kIGhhbmRcbi8vIHRoZSBSRVBMIGFuIFNTSC1iYWNrZWQgc2Vzc2lvbiBpbnN0ZWFkIG9mIGEgbG9jYWwgb25lLlxudHlwZSBQZW5kaW5nU1NIID0ge1xuICBob3N0OiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgY3dkOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgcGVybWlzc2lvbk1vZGU6IHN0cmluZyB8IHVuZGVmaW5lZFxuICBkYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uczogYm9vbGVhblxuICAvKiogLS1sb2NhbDogc3Bhd24gdGhlIGNoaWxkIENMSSBkaXJlY3RseSwgc2tpcCBzc2gvcHJvYmUvZGVwbG95LiBlMmUgdGVzdCBtb2RlLiAqL1xuICBsb2NhbDogYm9vbGVhblxuICAvKiogRXh0cmEgQ0xJIGFyZ3MgdG8gZm9yd2FyZCB0byB0aGUgcmVtb3RlIENMSSBvbiBpbml0aWFsIHNwYXduICgtLXJlc3VtZSwgLWMpLiAqL1xuICBleHRyYUNsaUFyZ3M6IHN0cmluZ1tdXG59XG5jb25zdCBfcGVuZGluZ1NTSDogUGVuZGluZ1NTSCB8IHVuZGVmaW5lZCA9IGZlYXR1cmUoJ1NTSF9SRU1PVEUnKVxuICA/IHtcbiAgICAgIGhvc3Q6IHVuZGVmaW5lZCxcbiAgICAgIGN3ZDogdW5kZWZpbmVkLFxuICAgICAgcGVybWlzc2lvbk1vZGU6IHVuZGVmaW5lZCxcbiAgICAgIGRhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zOiBmYWxzZSxcbiAgICAgIGxvY2FsOiBmYWxzZSxcbiAgICAgIGV4dHJhQ2xpQXJnczogW10sXG4gICAgfVxuICA6IHVuZGVmaW5lZFxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbigpIHtcbiAgcHJvZmlsZUNoZWNrcG9pbnQoJ21haW5fZnVuY3Rpb25fc3RhcnQnKVxuXG4gIC8vIFNFQ1VSSVRZOiBQcmV2ZW50IFdpbmRvd3MgZnJvbSBleGVjdXRpbmcgY29tbWFuZHMgZnJvbSBjdXJyZW50IGRpcmVjdG9yeVxuICAvLyBUaGlzIG11c3QgYmUgc2V0IGJlZm9yZSBBTlkgY29tbWFuZCBleGVjdXRpb24gdG8gcHJldmVudCBQQVRIIGhpamFja2luZyBhdHRhY2tzXG4gIC8vIFNlZTogaHR0cHM6Ly9kb2NzLm1pY3Jvc29mdC5jb20vZW4tdXMvd2luZG93cy93aW4zMi9hcGkvcHJvY2Vzc2Vudi9uZi1wcm9jZXNzZW52LXNlYXJjaHBhdGh3XG4gIHByb2Nlc3MuZW52Lk5vRGVmYXVsdEN1cnJlbnREaXJlY3RvcnlJbkV4ZVBhdGggPSAnMSdcblxuICAvLyBJbml0aWFsaXplIHdhcm5pbmcgaGFuZGxlciBlYXJseSB0byBjYXRjaCB3YXJuaW5nc1xuICBpbml0aWFsaXplV2FybmluZ0hhbmRsZXIoKVxuXG4gIHByb2Nlc3Mub24oJ2V4aXQnLCAoKSA9PiB7XG4gICAgcmVzZXRDdXJzb3IoKVxuICB9KVxuICBwcm9jZXNzLm9uKCdTSUdJTlQnLCAoKSA9PiB7XG4gICAgLy8gSW4gcHJpbnQgbW9kZSwgcHJpbnQudHMgcmVnaXN0ZXJzIGl0cyBvd24gU0lHSU5UIGhhbmRsZXIgdGhhdCBhYm9ydHNcbiAgICAvLyB0aGUgaW4tZmxpZ2h0IHF1ZXJ5IGFuZCBjYWxscyBncmFjZWZ1bFNodXRkb3duOyBza2lwIGhlcmUgdG8gYXZvaWRcbiAgICAvLyBwcmVlbXB0aW5nIGl0IHdpdGggYSBzeW5jaHJvbm91cyBwcm9jZXNzLmV4aXQoKS5cbiAgICBpZiAocHJvY2Vzcy5hcmd2LmluY2x1ZGVzKCctcCcpIHx8IHByb2Nlc3MuYXJndi5pbmNsdWRlcygnLS1wcmludCcpKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgcHJvY2Vzcy5leGl0KDApXG4gIH0pXG4gIHByb2ZpbGVDaGVja3BvaW50KCdtYWluX3dhcm5pbmdfaGFuZGxlcl9pbml0aWFsaXplZCcpXG5cbiAgLy8gQ2hlY2sgZm9yIGNjOi8vIG9yIGNjK3VuaXg6Ly8gVVJMIGluIGFyZ3Yg4oCUIHJld3JpdGUgc28gdGhlIG1haW4gY29tbWFuZFxuICAvLyBoYW5kbGVzIGl0LCBnaXZpbmcgdGhlIGZ1bGwgaW50ZXJhY3RpdmUgVFVJIGluc3RlYWQgb2YgYSBzdHJpcHBlZC1kb3duIHN1YmNvbW1hbmQuXG4gIC8vIEZvciBoZWFkbGVzcyAoLXApLCB3ZSByZXdyaXRlIHRvIHRoZSBpbnRlcm5hbCBgb3BlbmAgc3ViY29tbWFuZC5cbiAgaWYgKGZlYXR1cmUoJ0RJUkVDVF9DT05ORUNUJykpIHtcbiAgICBjb25zdCByYXdDbGlBcmdzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpXG4gICAgY29uc3QgY2NJZHggPSByYXdDbGlBcmdzLmZpbmRJbmRleChcbiAgICAgIGEgPT4gYS5zdGFydHNXaXRoKCdjYzovLycpIHx8IGEuc3RhcnRzV2l0aCgnY2MrdW5peDovLycpLFxuICAgIClcbiAgICBpZiAoY2NJZHggIT09IC0xICYmIF9wZW5kaW5nQ29ubmVjdCkge1xuICAgICAgY29uc3QgY2NVcmwgPSByYXdDbGlBcmdzW2NjSWR4XSFcbiAgICAgIGNvbnN0IHsgcGFyc2VDb25uZWN0VXJsIH0gPSBhd2FpdCBpbXBvcnQoJy4vc2VydmVyL3BhcnNlQ29ubmVjdFVybC5qcycpXG4gICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUNvbm5lY3RVcmwoY2NVcmwpXG4gICAgICBfcGVuZGluZ0Nvbm5lY3QuZGFuZ2Vyb3VzbHlTa2lwUGVybWlzc2lvbnMgPSByYXdDbGlBcmdzLmluY2x1ZGVzKFxuICAgICAgICAnLS1kYW5nZXJvdXNseS1za2lwLXBlcm1pc3Npb25zJyxcbiAgICAgIClcblxuICAgICAgaWYgKHJhd0NsaUFyZ3MuaW5jbHVkZXMoJy1wJykgfHwgcmF3Q2xpQXJncy5pbmNsdWRlcygnLS1wcmludCcpKSB7XG4gICAgICAgIC8vIEhlYWRsZXNzOiByZXdyaXRlIHRvIGludGVybmFsIGBvcGVuYCBzdWJjb21tYW5kXG4gICAgICAgIGNvbnN0IHN0cmlwcGVkID0gcmF3Q2xpQXJncy5maWx0ZXIoKF8sIGkpID0+IGkgIT09IGNjSWR4KVxuICAgICAgICBjb25zdCBkc3BJZHggPSBzdHJpcHBlZC5pbmRleE9mKCctLWRhbmdlcm91c2x5LXNraXAtcGVybWlzc2lvbnMnKVxuICAgICAgICBpZiAoZHNwSWR4ICE9PSAtMSkge1xuICAgICAgICAgIHN0cmlwcGVkLnNwbGljZShkc3BJZHgsIDEpXG4gICAgICAgIH1cbiAgICAgICAgcHJvY2Vzcy5hcmd2ID0gW1xuICAgICAgICAgIHByb2Nlc3MuYXJndlswXSEsXG4gICAgICAgICAgcHJvY2Vzcy5hcmd2WzFdISxcbiAgICAgICAgICAnb3BlbicsXG4gICAgICAgICAgY2NVcmwsXG4gICAgICAgICAgLi4uc3RyaXBwZWQsXG4gICAgICAgIF1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEludGVyYWN0aXZlOiBzdHJpcCBjYzovLyBVUkwgYW5kIGZsYWdzLCBydW4gbWFpbiBjb21tYW5kXG4gICAgICAgIF9wZW5kaW5nQ29ubmVjdC51cmwgPSBwYXJzZWQuc2VydmVyVXJsXG4gICAgICAgIF9wZW5kaW5nQ29ubmVjdC5hdXRoVG9rZW4gPSBwYXJzZWQuYXV0aFRva2VuXG4gICAgICAgIGNvbnN0IHN0cmlwcGVkID0gcmF3Q2xpQXJncy5maWx0ZXIoKF8sIGkpID0+IGkgIT09IGNjSWR4KVxuICAgICAgICBjb25zdCBkc3BJZHggPSBzdHJpcHBlZC5pbmRleE9mKCctLWRhbmdlcm91c2x5LXNraXAtcGVybWlzc2lvbnMnKVxuICAgICAgICBpZiAoZHNwSWR4ICE9PSAtMSkge1xuICAgICAgICAgIHN0cmlwcGVkLnNwbGljZShkc3BJZHgsIDEpXG4gICAgICAgIH1cbiAgICAgICAgcHJvY2Vzcy5hcmd2ID0gW3Byb2Nlc3MuYXJndlswXSEsIHByb2Nlc3MuYXJndlsxXSEsIC4uLnN0cmlwcGVkXVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEhhbmRsZSBkZWVwIGxpbmsgVVJJcyBlYXJseSDigJQgdGhpcyBpcyBpbnZva2VkIGJ5IHRoZSBPUyBwcm90b2NvbCBoYW5kbGVyXG4gIC8vIGFuZCBzaG91bGQgYmFpbCBvdXQgYmVmb3JlIGZ1bGwgaW5pdCBzaW5jZSBpdCBvbmx5IG5lZWRzIHRvIHBhcnNlIHRoZSBVUklcbiAgLy8gYW5kIG9wZW4gYSB0ZXJtaW5hbC5cbiAgaWYgKGZlYXR1cmUoJ0xPREVTVE9ORScpKSB7XG4gICAgY29uc3QgaGFuZGxlVXJpSWR4ID0gcHJvY2Vzcy5hcmd2LmluZGV4T2YoJy0taGFuZGxlLXVyaScpXG4gICAgaWYgKGhhbmRsZVVyaUlkeCAhPT0gLTEgJiYgcHJvY2Vzcy5hcmd2W2hhbmRsZVVyaUlkeCArIDFdKSB7XG4gICAgICBjb25zdCB7IGVuYWJsZUNvbmZpZ3MgfSA9IGF3YWl0IGltcG9ydCgnLi91dGlscy9jb25maWcuanMnKVxuICAgICAgZW5hYmxlQ29uZmlncygpXG4gICAgICBjb25zdCB1cmkgPSBwcm9jZXNzLmFyZ3ZbaGFuZGxlVXJpSWR4ICsgMV0hXG4gICAgICBjb25zdCB7IGhhbmRsZURlZXBMaW5rVXJpIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICcuL3V0aWxzL2RlZXBMaW5rL3Byb3RvY29sSGFuZGxlci5qcydcbiAgICAgIClcbiAgICAgIGNvbnN0IGV4aXRDb2RlID0gYXdhaXQgaGFuZGxlRGVlcExpbmtVcmkodXJpKVxuICAgICAgcHJvY2Vzcy5leGl0KGV4aXRDb2RlKVxuICAgIH1cblxuICAgIC8vIG1hY09TIFVSTCBoYW5kbGVyOiB3aGVuIExhdW5jaFNlcnZpY2VzIGxhdW5jaGVzIG91ciAuYXBwIGJ1bmRsZSwgdGhlXG4gICAgLy8gVVJMIGFycml2ZXMgdmlhIEFwcGxlIEV2ZW50IChub3QgYXJndikuIExhdW5jaFNlcnZpY2VzIG92ZXJ3cml0ZXNcbiAgICAvLyBfX0NGQnVuZGxlSWRlbnRpZmllciB0byB0aGUgbGF1bmNoaW5nIGJ1bmRsZSdzIElELCB3aGljaCBpcyBhIHByZWNpc2VcbiAgICAvLyBwb3NpdGl2ZSBzaWduYWwg4oCUIGNoZWFwZXIgdGhhbiBpbXBvcnRpbmcgYW5kIGd1ZXNzaW5nIHdpdGggaGV1cmlzdGljcy5cbiAgICBpZiAoXG4gICAgICBwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJyAmJlxuICAgICAgcHJvY2Vzcy5lbnYuX19DRkJ1bmRsZUlkZW50aWZpZXIgPT09XG4gICAgICAgICdjb20uYW50aHJvcGljLmNsYXVkZS1jb2RlLXVybC1oYW5kbGVyJ1xuICAgICkge1xuICAgICAgY29uc3QgeyBlbmFibGVDb25maWdzIH0gPSBhd2FpdCBpbXBvcnQoJy4vdXRpbHMvY29uZmlnLmpzJylcbiAgICAgIGVuYWJsZUNvbmZpZ3MoKVxuICAgICAgY29uc3QgeyBoYW5kbGVVcmxTY2hlbWVMYXVuY2ggfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICAgJy4vdXRpbHMvZGVlcExpbmsvcHJvdG9jb2xIYW5kbGVyLmpzJ1xuICAgICAgKVxuICAgICAgY29uc3QgdXJsU2NoZW1lUmVzdWx0ID0gYXdhaXQgaGFuZGxlVXJsU2NoZW1lTGF1bmNoKClcbiAgICAgIHByb2Nlc3MuZXhpdCh1cmxTY2hlbWVSZXN1bHQgPz8gMSlcbiAgICB9XG4gIH1cblxuICAvLyBgY2xhdWRlIGFzc2lzdGFudCBbc2Vzc2lvbklkXWAg4oCUIHN0YXNoIGFuZCBzdHJpcCBzbyB0aGUgbWFpblxuICAvLyBjb21tYW5kIGhhbmRsZXMgaXQsIGdpdmluZyB0aGUgZnVsbCBpbnRlcmFjdGl2ZSBUVUkuIFBvc2l0aW9uLTAgb25seVxuICAvLyAobWF0Y2hpbmcgdGhlIHNzaCBwYXR0ZXJuIGJlbG93KSDigJQgaW5kZXhPZiB3b3VsZCBmYWxzZS1wb3NpdGl2ZSBvblxuICAvLyBgY2xhdWRlIC1wIFwiZXhwbGFpbiBhc3Npc3RhbnRcImAuIFJvb3QtZmxhZy1iZWZvcmUtc3ViY29tbWFuZFxuICAvLyAoZS5nLiBgLS1kZWJ1ZyBhc3Npc3RhbnRgKSBmYWxscyB0aHJvdWdoIHRvIHRoZSBzdHViLCB3aGljaFxuICAvLyBwcmludHMgdXNhZ2UuXG4gIGlmIChmZWF0dXJlKCdLQUlST1MnKSAmJiBfcGVuZGluZ0Fzc2lzdGFudENoYXQpIHtcbiAgICBjb25zdCByYXdBcmdzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpXG4gICAgaWYgKHJhd0FyZ3NbMF0gPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgICBjb25zdCBuZXh0QXJnID0gcmF3QXJnc1sxXVxuICAgICAgaWYgKG5leHRBcmcgJiYgIW5leHRBcmcuc3RhcnRzV2l0aCgnLScpKSB7XG4gICAgICAgIF9wZW5kaW5nQXNzaXN0YW50Q2hhdC5zZXNzaW9uSWQgPSBuZXh0QXJnXG4gICAgICAgIHJhd0FyZ3Muc3BsaWNlKDAsIDIpIC8vIGRyb3AgJ2Fzc2lzdGFudCcgYW5kIHNlc3Npb25JZFxuICAgICAgICBwcm9jZXNzLmFyZ3YgPSBbcHJvY2Vzcy5hcmd2WzBdISwgcHJvY2Vzcy5hcmd2WzFdISwgLi4ucmF3QXJnc11cbiAgICAgIH0gZWxzZSBpZiAoIW5leHRBcmcpIHtcbiAgICAgICAgX3BlbmRpbmdBc3Npc3RhbnRDaGF0LmRpc2NvdmVyID0gdHJ1ZVxuICAgICAgICByYXdBcmdzLnNwbGljZSgwLCAxKSAvLyBkcm9wICdhc3Npc3RhbnQnXG4gICAgICAgIHByb2Nlc3MuYXJndiA9IFtwcm9jZXNzLmFyZ3ZbMF0hLCBwcm9jZXNzLmFyZ3ZbMV0hLCAuLi5yYXdBcmdzXVxuICAgICAgfVxuICAgICAgLy8gZWxzZTogYGNsYXVkZSBhc3Npc3RhbnQgLS1oZWxwYCDihpIgZmFsbCB0aHJvdWdoIHRvIHN0dWJcbiAgICB9XG4gIH1cblxuICAvLyBgY2xhdWRlIHNzaCA8aG9zdD4gW2Rpcl1gIOKAlCBzdHJpcCBmcm9tIGFyZ3Ygc28gdGhlIG1haW4gY29tbWFuZCBoYW5kbGVyXG4gIC8vIHJ1bnMgKGZ1bGwgaW50ZXJhY3RpdmUgVFVJKSwgc3Rhc2ggdGhlIGhvc3QvZGlyIGZvciB0aGUgUkVQTCBicmFuY2ggYXRcbiAgLy8gfmxpbmUgMzcyMCB0byBwaWNrIHVwLiBIZWFkbGVzcyAoLXApIG1vZGUgbm90IHN1cHBvcnRlZCBpbiB2MTogU1NIXG4gIC8vIHNlc3Npb25zIG5lZWQgdGhlIGxvY2FsIFJFUEwgdG8gZHJpdmUgdGhlbSAoaW50ZXJydXB0LCBwZXJtaXNzaW9ucykuXG4gIGlmIChmZWF0dXJlKCdTU0hfUkVNT1RFJykgJiYgX3BlbmRpbmdTU0gpIHtcbiAgICBjb25zdCByYXdDbGlBcmdzID0gcHJvY2Vzcy5hcmd2LnNsaWNlKDIpXG4gICAgLy8gU1NILXNwZWNpZmljIGZsYWdzIGNhbiBhcHBlYXIgYmVmb3JlIHRoZSBob3N0IHBvc2l0aW9uYWwgKGUuZy5cbiAgICAvLyBgc3NoIC0tcGVybWlzc2lvbi1tb2RlIGF1dG8gaG9zdCAvdG1wYCDigJQgc3RhbmRhcmQgUE9TSVggZmxhZ3MtYmVmb3JlLVxuICAgIC8vIHBvc2l0aW9uYWxzKS4gUHVsbCB0aGVtIGFsbCBvdXQgQkVGT1JFIGNoZWNraW5nIHdoZXRoZXIgYSBob3N0IHdhc1xuICAgIC8vIGdpdmVuLCBzbyBgY2xhdWRlIHNzaCAtLXBlcm1pc3Npb24tbW9kZSBhdXRvIGhvc3RgIGFuZCBgY2xhdWRlIHNzaCBob3N0XG4gICAgLy8gLS1wZXJtaXNzaW9uLW1vZGUgYXV0b2AgYXJlIGVxdWl2YWxlbnQuIFRoZSBob3N0IGNoZWNrIGJlbG93IG9ubHkgbmVlZHNcbiAgICAvLyB0byBndWFyZCBhZ2FpbnN0IGAtaGAvYC0taGVscGAgKHdoaWNoIGNvbW1hbmRlciBzaG91bGQgaGFuZGxlKS5cbiAgICBpZiAocmF3Q2xpQXJnc1swXSA9PT0gJ3NzaCcpIHtcbiAgICAgIGNvbnN0IGxvY2FsSWR4ID0gcmF3Q2xpQXJncy5pbmRleE9mKCctLWxvY2FsJylcbiAgICAgIGlmIChsb2NhbElkeCAhPT0gLTEpIHtcbiAgICAgICAgX3BlbmRpbmdTU0gubG9jYWwgPSB0cnVlXG4gICAgICAgIHJhd0NsaUFyZ3Muc3BsaWNlKGxvY2FsSWR4LCAxKVxuICAgICAgfVxuICAgICAgY29uc3QgZHNwSWR4ID0gcmF3Q2xpQXJncy5pbmRleE9mKCctLWRhbmdlcm91c2x5LXNraXAtcGVybWlzc2lvbnMnKVxuICAgICAgaWYgKGRzcElkeCAhPT0gLTEpIHtcbiAgICAgICAgX3BlbmRpbmdTU0guZGFuZ2Vyb3VzbHlTa2lwUGVybWlzc2lvbnMgPSB0cnVlXG4gICAgICAgIHJhd0NsaUFyZ3Muc3BsaWNlKGRzcElkeCwgMSlcbiAgICAgIH1cbiAgICAgIGNvbnN0IHBtSWR4ID0gcmF3Q2xpQXJncy5pbmRleE9mKCctLXBlcm1pc3Npb24tbW9kZScpXG4gICAgICBpZiAoXG4gICAgICAgIHBtSWR4ICE9PSAtMSAmJlxuICAgICAgICByYXdDbGlBcmdzW3BtSWR4ICsgMV0gJiZcbiAgICAgICAgIXJhd0NsaUFyZ3NbcG1JZHggKyAxXSEuc3RhcnRzV2l0aCgnLScpXG4gICAgICApIHtcbiAgICAgICAgX3BlbmRpbmdTU0gucGVybWlzc2lvbk1vZGUgPSByYXdDbGlBcmdzW3BtSWR4ICsgMV1cbiAgICAgICAgcmF3Q2xpQXJncy5zcGxpY2UocG1JZHgsIDIpXG4gICAgICB9XG4gICAgICBjb25zdCBwbUVxSWR4ID0gcmF3Q2xpQXJncy5maW5kSW5kZXgoYSA9PlxuICAgICAgICBhLnN0YXJ0c1dpdGgoJy0tcGVybWlzc2lvbi1tb2RlPScpLFxuICAgICAgKVxuICAgICAgaWYgKHBtRXFJZHggIT09IC0xKSB7XG4gICAgICAgIF9wZW5kaW5nU1NILnBlcm1pc3Npb25Nb2RlID0gcmF3Q2xpQXJnc1twbUVxSWR4XSEuc3BsaXQoJz0nKVsxXVxuICAgICAgICByYXdDbGlBcmdzLnNwbGljZShwbUVxSWR4LCAxKVxuICAgICAgfVxuICAgICAgLy8gRm9yd2FyZCBzZXNzaW9uLXJlc3VtZSArIG1vZGVsIGZsYWdzIHRvIHRoZSByZW1vdGUgQ0xJJ3MgaW5pdGlhbCBzcGF3bi5cbiAgICAgIC8vIC0tY29udGludWUvLWMgYW5kIC0tcmVzdW1lIDx1dWlkPiBvcGVyYXRlIG9uIHRoZSBSRU1PVEUgc2Vzc2lvbiBoaXN0b3J5XG4gICAgICAvLyAod2hpY2ggcGVyc2lzdHMgdW5kZXIgdGhlIHJlbW90ZSdzIH4vLmNsYXVkZS9wcm9qZWN0cy88Y3dkPi8pLlxuICAgICAgLy8gLS1tb2RlbCBjb250cm9scyB3aGljaCBtb2RlbCB0aGUgcmVtb3RlIHVzZXMuXG4gICAgICBjb25zdCBleHRyYWN0RmxhZyA9IChcbiAgICAgICAgZmxhZzogc3RyaW5nLFxuICAgICAgICBvcHRzOiB7IGhhc1ZhbHVlPzogYm9vbGVhbjsgYXM/OiBzdHJpbmcgfSA9IHt9LFxuICAgICAgKSA9PiB7XG4gICAgICAgIGNvbnN0IGkgPSByYXdDbGlBcmdzLmluZGV4T2YoZmxhZylcbiAgICAgICAgaWYgKGkgIT09IC0xKSB7XG4gICAgICAgICAgX3BlbmRpbmdTU0guZXh0cmFDbGlBcmdzLnB1c2gob3B0cy5hcyA/PyBmbGFnKVxuICAgICAgICAgIGNvbnN0IHZhbCA9IHJhd0NsaUFyZ3NbaSArIDFdXG4gICAgICAgICAgaWYgKG9wdHMuaGFzVmFsdWUgJiYgdmFsICYmICF2YWwuc3RhcnRzV2l0aCgnLScpKSB7XG4gICAgICAgICAgICBfcGVuZGluZ1NTSC5leHRyYUNsaUFyZ3MucHVzaCh2YWwpXG4gICAgICAgICAgICByYXdDbGlBcmdzLnNwbGljZShpLCAyKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByYXdDbGlBcmdzLnNwbGljZShpLCAxKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBlcUkgPSByYXdDbGlBcmdzLmZpbmRJbmRleChhID0+IGEuc3RhcnRzV2l0aChgJHtmbGFnfT1gKSlcbiAgICAgICAgaWYgKGVxSSAhPT0gLTEpIHtcbiAgICAgICAgICBfcGVuZGluZ1NTSC5leHRyYUNsaUFyZ3MucHVzaChcbiAgICAgICAgICAgIG9wdHMuYXMgPz8gZmxhZyxcbiAgICAgICAgICAgIHJhd0NsaUFyZ3NbZXFJXSEuc2xpY2UoZmxhZy5sZW5ndGggKyAxKSxcbiAgICAgICAgICApXG4gICAgICAgICAgcmF3Q2xpQXJncy5zcGxpY2UoZXFJLCAxKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBleHRyYWN0RmxhZygnLWMnLCB7IGFzOiAnLS1jb250aW51ZScgfSlcbiAgICAgIGV4dHJhY3RGbGFnKCctLWNvbnRpbnVlJylcbiAgICAgIGV4dHJhY3RGbGFnKCctLXJlc3VtZScsIHsgaGFzVmFsdWU6IHRydWUgfSlcbiAgICAgIGV4dHJhY3RGbGFnKCctLW1vZGVsJywgeyBoYXNWYWx1ZTogdHJ1ZSB9KVxuICAgIH1cbiAgICAvLyBBZnRlciBwcmUtZXh0cmFjdGlvbiwgYW55IHJlbWFpbmluZyBkYXNoLWFyZyBhdCBbMV0gaXMgZWl0aGVyIC1oLy0taGVscFxuICAgIC8vIChjb21tYW5kZXIgaGFuZGxlcykgb3IgYW4gdW5rbm93bi10by1zc2ggZmxhZyAoZmFsbCB0aHJvdWdoIHRvIGNvbW1hbmRlclxuICAgIC8vIHNvIGl0IHN1cmZhY2VzIGEgcHJvcGVyIGVycm9yKS4gT25seSBhIG5vbi1kYXNoIGFyZyBpcyB0aGUgaG9zdC5cbiAgICBpZiAoXG4gICAgICByYXdDbGlBcmdzWzBdID09PSAnc3NoJyAmJlxuICAgICAgcmF3Q2xpQXJnc1sxXSAmJlxuICAgICAgIXJhd0NsaUFyZ3NbMV0uc3RhcnRzV2l0aCgnLScpXG4gICAgKSB7XG4gICAgICBfcGVuZGluZ1NTSC5ob3N0ID0gcmF3Q2xpQXJnc1sxXVxuICAgICAgLy8gT3B0aW9uYWwgcG9zaXRpb25hbCBjd2QuXG4gICAgICBsZXQgY29uc3VtZWQgPSAyXG4gICAgICBpZiAocmF3Q2xpQXJnc1syXSAmJiAhcmF3Q2xpQXJnc1syXS5zdGFydHNXaXRoKCctJykpIHtcbiAgICAgICAgX3BlbmRpbmdTU0guY3dkID0gcmF3Q2xpQXJnc1syXVxuICAgICAgICBjb25zdW1lZCA9IDNcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3QgPSByYXdDbGlBcmdzLnNsaWNlKGNvbnN1bWVkKVxuXG4gICAgICAvLyBIZWFkbGVzcyAoLXApIG1vZGUgaXMgbm90IHN1cHBvcnRlZCB3aXRoIFNTSCBpbiB2MSDigJQgcmVqZWN0IGVhcmx5XG4gICAgICAvLyBzbyB0aGUgZmxhZyBkb2Vzbid0IHNpbGVudGx5IGNhdXNlIGxvY2FsIGV4ZWN1dGlvbi5cbiAgICAgIGlmIChyZXN0LmluY2x1ZGVzKCctcCcpIHx8IHJlc3QuaW5jbHVkZXMoJy0tcHJpbnQnKSkge1xuICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICAnRXJyb3I6IGhlYWRsZXNzICgtcC8tLXByaW50KSBtb2RlIGlzIG5vdCBzdXBwb3J0ZWQgd2l0aCBjbGF1ZGUgc3NoXFxuJyxcbiAgICAgICAgKVxuICAgICAgICBncmFjZWZ1bFNodXRkb3duU3luYygxKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gUmV3cml0ZSBhcmd2IHNvIHRoZSBtYWluIGNvbW1hbmQgc2VlcyByZW1haW5pbmcgZmxhZ3MgYnV0IG5vdCBgc3NoYC5cbiAgICAgIHByb2Nlc3MuYXJndiA9IFtwcm9jZXNzLmFyZ3ZbMF0hLCBwcm9jZXNzLmFyZ3ZbMV0hLCAuLi5yZXN0XVxuICAgIH1cbiAgfVxuXG4gIC8vIENoZWNrIGZvciAtcC8tLXByaW50IGFuZCAtLWluaXQtb25seSBmbGFncyBlYXJseSB0byBzZXQgaXNJbnRlcmFjdGl2ZVNlc3Npb24gYmVmb3JlIGluaXQoKVxuICAvLyBUaGlzIGlzIG5lZWRlZCBiZWNhdXNlIHRlbGVtZXRyeSBpbml0aWFsaXphdGlvbiBjYWxscyBhdXRoIGZ1bmN0aW9ucyB0aGF0IG5lZWQgdGhpcyBmbGFnXG4gIGNvbnN0IGNsaUFyZ3MgPSBwcm9jZXNzLmFyZ3Yuc2xpY2UoMilcbiAgY29uc3QgaGFzUHJpbnRGbGFnID0gY2xpQXJncy5pbmNsdWRlcygnLXAnKSB8fCBjbGlBcmdzLmluY2x1ZGVzKCctLXByaW50JylcbiAgY29uc3QgaGFzSW5pdE9ubHlGbGFnID0gY2xpQXJncy5pbmNsdWRlcygnLS1pbml0LW9ubHknKVxuICBjb25zdCBoYXNTZGtVcmwgPSBjbGlBcmdzLnNvbWUoYXJnID0+IGFyZy5zdGFydHNXaXRoKCctLXNkay11cmwnKSlcbiAgY29uc3QgaXNOb25JbnRlcmFjdGl2ZSA9XG4gICAgaGFzUHJpbnRGbGFnIHx8IGhhc0luaXRPbmx5RmxhZyB8fCBoYXNTZGtVcmwgfHwgIXByb2Nlc3Muc3Rkb3V0LmlzVFRZXG5cbiAgLy8gU3RvcCBjYXB0dXJpbmcgZWFybHkgaW5wdXQgZm9yIG5vbi1pbnRlcmFjdGl2ZSBtb2Rlc1xuICBpZiAoaXNOb25JbnRlcmFjdGl2ZSkge1xuICAgIHN0b3BDYXB0dXJpbmdFYXJseUlucHV0KClcbiAgfVxuXG4gIC8vIFNldCBzaW1wbGlmaWVkIHRyYWNraW5nIGZpZWxkc1xuICBjb25zdCBpc0ludGVyYWN0aXZlID0gIWlzTm9uSW50ZXJhY3RpdmVcbiAgc2V0SXNJbnRlcmFjdGl2ZShpc0ludGVyYWN0aXZlKVxuXG4gIC8vIEluaXRpYWxpemUgZW50cnlwb2ludCBiYXNlZCBvbiBtb2RlIC0gbmVlZHMgdG8gYmUgc2V0IGJlZm9yZSBhbnkgZXZlbnQgaXMgbG9nZ2VkXG4gIGluaXRpYWxpemVFbnRyeXBvaW50KGlzTm9uSW50ZXJhY3RpdmUpXG5cbiAgLy8gRGV0ZXJtaW5lIGNsaWVudCB0eXBlXG4gIGNvbnN0IGNsaWVudFR5cGUgPSAoKCkgPT4ge1xuICAgIGlmIChpc0VudlRydXRoeShwcm9jZXNzLmVudi5HSVRIVUJfQUNUSU9OUykpIHJldHVybiAnZ2l0aHViLWFjdGlvbidcbiAgICBpZiAocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfRU5UUllQT0lOVCA9PT0gJ3Nkay10cycpIHJldHVybiAnc2RrLXR5cGVzY3JpcHQnXG4gICAgaWYgKHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0VOVFJZUE9JTlQgPT09ICdzZGstcHknKSByZXR1cm4gJ3Nkay1weXRob24nXG4gICAgaWYgKHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0VOVFJZUE9JTlQgPT09ICdzZGstY2xpJykgcmV0dXJuICdzZGstY2xpJ1xuICAgIGlmIChwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9FTlRSWVBPSU5UID09PSAnY2xhdWRlLXZzY29kZScpXG4gICAgICByZXR1cm4gJ2NsYXVkZS12c2NvZGUnXG4gICAgaWYgKHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0VOVFJZUE9JTlQgPT09ICdsb2NhbC1hZ2VudCcpXG4gICAgICByZXR1cm4gJ2xvY2FsLWFnZW50J1xuICAgIGlmIChwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9FTlRSWVBPSU5UID09PSAnY2xhdWRlLWRlc2t0b3AnKVxuICAgICAgcmV0dXJuICdjbGF1ZGUtZGVza3RvcCdcblxuICAgIC8vIENoZWNrIGlmIHNlc3Npb24taW5ncmVzcyB0b2tlbiBpcyBwcm92aWRlZCAoaW5kaWNhdGVzIHJlbW90ZSBzZXNzaW9uKVxuICAgIGNvbnN0IGhhc1Nlc3Npb25JbmdyZXNzVG9rZW4gPVxuICAgICAgcHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfU0VTU0lPTl9BQ0NFU1NfVE9LRU4gfHxcbiAgICAgIHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX1dFQlNPQ0tFVF9BVVRIX0ZJTEVfREVTQ1JJUFRPUlxuICAgIGlmIChcbiAgICAgIHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0VOVFJZUE9JTlQgPT09ICdyZW1vdGUnIHx8XG4gICAgICBoYXNTZXNzaW9uSW5ncmVzc1Rva2VuXG4gICAgKSB7XG4gICAgICByZXR1cm4gJ3JlbW90ZSdcbiAgICB9XG5cbiAgICByZXR1cm4gJ2NsaSdcbiAgfSkoKVxuICBzZXRDbGllbnRUeXBlKGNsaWVudFR5cGUpXG5cbiAgY29uc3QgcHJldmlld0Zvcm1hdCA9IHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX1FVRVNUSU9OX1BSRVZJRVdfRk9STUFUXG4gIGlmIChwcmV2aWV3Rm9ybWF0ID09PSAnbWFya2Rvd24nIHx8IHByZXZpZXdGb3JtYXQgPT09ICdodG1sJykge1xuICAgIHNldFF1ZXN0aW9uUHJldmlld0Zvcm1hdChwcmV2aWV3Rm9ybWF0KVxuICB9IGVsc2UgaWYgKFxuICAgICFjbGllbnRUeXBlLnN0YXJ0c1dpdGgoJ3Nkay0nKSAmJlxuICAgIC8vIERlc2t0b3AgYW5kIENDUiBwYXNzIHByZXZpZXdGb3JtYXQgdmlhIHRvb2xDb25maWc7IHdoZW4gdGhlIGZlYXR1cmUgaXNcbiAgICAvLyBnYXRlZCBvZmYgdGhleSBwYXNzIHVuZGVmaW5lZCDigJQgZG9uJ3Qgb3ZlcnJpZGUgdGhhdCB3aXRoIG1hcmtkb3duLlxuICAgIGNsaWVudFR5cGUgIT09ICdjbGF1ZGUtZGVza3RvcCcgJiZcbiAgICBjbGllbnRUeXBlICE9PSAnbG9jYWwtYWdlbnQnICYmXG4gICAgY2xpZW50VHlwZSAhPT0gJ3JlbW90ZSdcbiAgKSB7XG4gICAgc2V0UXVlc3Rpb25QcmV2aWV3Rm9ybWF0KCdtYXJrZG93bicpXG4gIH1cblxuICAvLyBUYWcgc2Vzc2lvbnMgY3JlYXRlZCB2aWEgYGNsYXVkZSByZW1vdGUtY29udHJvbGAgc28gdGhlIGJhY2tlbmQgY2FuIGlkZW50aWZ5IHRoZW1cbiAgaWYgKHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0VOVklST05NRU5UX0tJTkQgPT09ICdicmlkZ2UnKSB7XG4gICAgc2V0U2Vzc2lvblNvdXJjZSgncmVtb3RlLWNvbnRyb2wnKVxuICB9XG5cbiAgcHJvZmlsZUNoZWNrcG9pbnQoJ21haW5fY2xpZW50X3R5cGVfZGV0ZXJtaW5lZCcpXG5cbiAgLy8gUGFyc2UgYW5kIGxvYWQgc2V0dGluZ3MgZmxhZ3MgZWFybHksIGJlZm9yZSBpbml0KClcbiAgZWFnZXJMb2FkU2V0dGluZ3MoKVxuXG4gIHByb2ZpbGVDaGVja3BvaW50KCdtYWluX2JlZm9yZV9ydW4nKVxuXG4gIGF3YWl0IHJ1bigpXG4gIHByb2ZpbGVDaGVja3BvaW50KCdtYWluX2FmdGVyX3J1bicpXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldElucHV0UHJvbXB0KFxuICBwcm9tcHQ6IHN0cmluZyxcbiAgaW5wdXRGb3JtYXQ6ICd0ZXh0JyB8ICdzdHJlYW0tanNvbicsXG4pOiBQcm9taXNlPHN0cmluZyB8IEFzeW5jSXRlcmFibGU8c3RyaW5nPj4ge1xuICBpZiAoXG4gICAgIXByb2Nlc3Muc3RkaW4uaXNUVFkgJiZcbiAgICAvLyBJbnB1dCBoaWphY2tpbmcgYnJlYWtzIE1DUC5cbiAgICAhcHJvY2Vzcy5hcmd2LmluY2x1ZGVzKCdtY3AnKVxuICApIHtcbiAgICBpZiAoaW5wdXRGb3JtYXQgPT09ICdzdHJlYW0tanNvbicpIHtcbiAgICAgIHJldHVybiBwcm9jZXNzLnN0ZGluXG4gICAgfVxuICAgIHByb2Nlc3Muc3RkaW4uc2V0RW5jb2RpbmcoJ3V0ZjgnKVxuICAgIGxldCBkYXRhID0gJydcbiAgICBjb25zdCBvbkRhdGEgPSAoY2h1bms6IHN0cmluZykgPT4ge1xuICAgICAgZGF0YSArPSBjaHVua1xuICAgIH1cbiAgICBwcm9jZXNzLnN0ZGluLm9uKCdkYXRhJywgb25EYXRhKVxuICAgIC8vIElmIG5vIGRhdGEgYXJyaXZlcyBpbiAzcywgc3RvcCB3YWl0aW5nIGFuZCB3YXJuLiBTdGRpbiBpcyBsaWtlbHkgYW5cbiAgICAvLyBpbmhlcml0ZWQgcGlwZSBmcm9tIGEgcGFyZW50IHRoYXQgaXNuJ3Qgd3JpdGluZyAoc3VicHJvY2VzcyBzcGF3bmVkXG4gICAgLy8gd2l0aG91dCBleHBsaWNpdCBzdGRpbiBoYW5kbGluZykuIDNzIGNvdmVycyBzbG93IHByb2R1Y2VycyBsaWtlIGN1cmwsXG4gICAgLy8ganEgb24gbGFyZ2UgZmlsZXMsIHB5dGhvbiB3aXRoIGltcG9ydCBvdmVyaGVhZC4gVGhlIHdhcm5pbmcgbWFrZXNcbiAgICAvLyBzaWxlbnQgZGF0YSBsb3NzIHZpc2libGUgZm9yIHRoZSByYXJlIHByb2R1Y2VyIHRoYXQncyBzbG93ZXIgc3RpbGwuXG4gICAgY29uc3QgdGltZWRPdXQgPSBhd2FpdCBwZWVrRm9yU3RkaW5EYXRhKHByb2Nlc3Muc3RkaW4sIDMwMDApXG4gICAgcHJvY2Vzcy5zdGRpbi5vZmYoJ2RhdGEnLCBvbkRhdGEpXG4gICAgaWYgKHRpbWVkT3V0KSB7XG4gICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgJ1dhcm5pbmc6IG5vIHN0ZGluIGRhdGEgcmVjZWl2ZWQgaW4gM3MsIHByb2NlZWRpbmcgd2l0aG91dCBpdC4gJyArXG4gICAgICAgICAgJ0lmIHBpcGluZyBmcm9tIGEgc2xvdyBjb21tYW5kLCByZWRpcmVjdCBzdGRpbiBleHBsaWNpdGx5OiA8IC9kZXYvbnVsbCB0byBza2lwLCBvciB3YWl0IGxvbmdlci5cXG4nLFxuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gW3Byb21wdCwgZGF0YV0uZmlsdGVyKEJvb2xlYW4pLmpvaW4oJ1xcbicpXG4gIH1cbiAgcmV0dXJuIHByb21wdFxufVxuXG5hc3luYyBmdW5jdGlvbiBydW4oKTogUHJvbWlzZTxDb21tYW5kZXJDb21tYW5kPiB7XG4gIHByb2ZpbGVDaGVja3BvaW50KCdydW5fZnVuY3Rpb25fc3RhcnQnKVxuXG4gIC8vIENyZWF0ZSBoZWxwIGNvbmZpZyB0aGF0IHNvcnRzIG9wdGlvbnMgYnkgbG9uZyBvcHRpb24gbmFtZS5cbiAgLy8gQ29tbWFuZGVyIHN1cHBvcnRzIGNvbXBhcmVPcHRpb25zIGF0IHJ1bnRpbWUgYnV0IEBjb21tYW5kZXItanMvZXh0cmEtdHlwaW5nc1xuICAvLyBkb2Vzbid0IGluY2x1ZGUgaXQgaW4gdGhlIHR5cGUgZGVmaW5pdGlvbnMsIHNvIHdlIHVzZSBPYmplY3QuYXNzaWduIHRvIGFkZCBpdC5cbiAgZnVuY3Rpb24gY3JlYXRlU29ydGVkSGVscENvbmZpZygpOiB7XG4gICAgc29ydFN1YmNvbW1hbmRzOiB0cnVlXG4gICAgc29ydE9wdGlvbnM6IHRydWVcbiAgfSB7XG4gICAgY29uc3QgZ2V0T3B0aW9uU29ydEtleSA9IChvcHQ6IE9wdGlvbik6IHN0cmluZyA9PlxuICAgICAgb3B0Lmxvbmc/LnJlcGxhY2UoL14tLS8sICcnKSA/PyBvcHQuc2hvcnQ/LnJlcGxhY2UoL14tLywgJycpID8/ICcnXG4gICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oXG4gICAgICB7IHNvcnRTdWJjb21tYW5kczogdHJ1ZSwgc29ydE9wdGlvbnM6IHRydWUgfSBhcyBjb25zdCxcbiAgICAgIHtcbiAgICAgICAgY29tcGFyZU9wdGlvbnM6IChhOiBPcHRpb24sIGI6IE9wdGlvbikgPT5cbiAgICAgICAgICBnZXRPcHRpb25Tb3J0S2V5KGEpLmxvY2FsZUNvbXBhcmUoZ2V0T3B0aW9uU29ydEtleShiKSksXG4gICAgICB9LFxuICAgIClcbiAgfVxuICBjb25zdCBwcm9ncmFtID0gbmV3IENvbW1hbmRlckNvbW1hbmQoKVxuICAgIC5jb25maWd1cmVIZWxwKGNyZWF0ZVNvcnRlZEhlbHBDb25maWcoKSlcbiAgICAuZW5hYmxlUG9zaXRpb25hbE9wdGlvbnMoKVxuICBwcm9maWxlQ2hlY2twb2ludCgncnVuX2NvbW1hbmRlcl9pbml0aWFsaXplZCcpXG5cbiAgLy8gVXNlIHByZUFjdGlvbiBob29rIHRvIHJ1biBpbml0aWFsaXphdGlvbiBvbmx5IHdoZW4gZXhlY3V0aW5nIGEgY29tbWFuZCxcbiAgLy8gbm90IHdoZW4gZGlzcGxheWluZyBoZWxwLiBUaGlzIGF2b2lkcyB0aGUgbmVlZCBmb3IgZW52IHZhcmlhYmxlIHNpZ25hbGluZy5cbiAgcHJvZ3JhbS5ob29rKCdwcmVBY3Rpb24nLCBhc3luYyB0aGlzQ29tbWFuZCA9PiB7XG4gICAgcHJvZmlsZUNoZWNrcG9pbnQoJ3ByZUFjdGlvbl9zdGFydCcpXG4gICAgLy8gQXdhaXQgYXN5bmMgc3VicHJvY2VzcyBsb2FkcyBzdGFydGVkIGF0IG1vZHVsZSBldmFsdWF0aW9uIChsaW5lcyAxMi0yMCkuXG4gICAgLy8gTmVhcmx5IGZyZWUg4oCUIHN1YnByb2Nlc3NlcyBjb21wbGV0ZSBkdXJpbmcgdGhlIH4xMzVtcyBvZiBpbXBvcnRzIGFib3ZlLlxuICAgIC8vIE11c3QgcmVzb2x2ZSBiZWZvcmUgaW5pdCgpIHdoaWNoIHRyaWdnZXJzIHRoZSBmaXJzdCBzZXR0aW5ncyByZWFkXG4gICAgLy8gKGFwcGx5U2FmZUNvbmZpZ0Vudmlyb25tZW50VmFyaWFibGVzIOKGkiBnZXRTZXR0aW5nc0ZvclNvdXJjZSgncG9saWN5U2V0dGluZ3MnKVxuICAgIC8vIOKGkiBpc1JlbW90ZU1hbmFnZWRTZXR0aW5nc0VsaWdpYmxlIOKGkiBzeW5jIGtleWNoYWluIHJlYWRzIG90aGVyd2lzZSB+NjVtcykuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgZW5zdXJlTWRtU2V0dGluZ3NMb2FkZWQoKSxcbiAgICAgIGVuc3VyZUtleWNoYWluUHJlZmV0Y2hDb21wbGV0ZWQoKSxcbiAgICBdKVxuICAgIHByb2ZpbGVDaGVja3BvaW50KCdwcmVBY3Rpb25fYWZ0ZXJfbWRtJylcbiAgICBhd2FpdCBpbml0KClcbiAgICBwcm9maWxlQ2hlY2twb2ludCgncHJlQWN0aW9uX2FmdGVyX2luaXQnKVxuXG4gICAgLy8gcHJvY2Vzcy50aXRsZSBvbiBXaW5kb3dzIHNldHMgdGhlIGNvbnNvbGUgdGl0bGUgZGlyZWN0bHk7IG9uIFBPU0lYLFxuICAgIC8vIHRlcm1pbmFsIHNoZWxsIGludGVncmF0aW9uIG1heSBtaXJyb3IgdGhlIHByb2Nlc3MgbmFtZSB0byB0aGUgdGFiLlxuICAgIC8vIEFmdGVyIGluaXQoKSBzbyBzZXR0aW5ncy5qc29uIGVudiBjYW4gYWxzbyBnYXRlIHRoaXMgKGdoLTQ3NjUpLlxuICAgIGlmICghaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfRElTQUJMRV9URVJNSU5BTF9USVRMRSkpIHtcbiAgICAgIHByb2Nlc3MudGl0bGUgPSAnY2xhdWRlJ1xuICAgIH1cblxuICAgIC8vIEF0dGFjaCBsb2dnaW5nIHNpbmtzIHNvIHN1YmNvbW1hbmQgaGFuZGxlcnMgY2FuIHVzZSBsb2dFdmVudC9sb2dFcnJvci5cbiAgICAvLyBCZWZvcmUgUFIgIzExMTA2IGxvZ0V2ZW50IGRpc3BhdGNoZWQgZGlyZWN0bHk7IGFmdGVyLCBldmVudHMgcXVldWUgdW50aWxcbiAgICAvLyBhIHNpbmsgYXR0YWNoZXMuIHNldHVwKCkgYXR0YWNoZXMgc2lua3MgZm9yIHRoZSBkZWZhdWx0IGNvbW1hbmQsIGJ1dFxuICAgIC8vIHN1YmNvbW1hbmRzIChkb2N0b3IsIG1jcCwgcGx1Z2luLCBhdXRoKSBuZXZlciBjYWxsIHNldHVwKCkgYW5kIHdvdWxkXG4gICAgLy8gc2lsZW50bHkgZHJvcCBldmVudHMgb24gcHJvY2Vzcy5leGl0KCkuIEJvdGggaW5pdHMgYXJlIGlkZW1wb3RlbnQuXG4gICAgY29uc3QgeyBpbml0U2lua3MgfSA9IGF3YWl0IGltcG9ydCgnLi91dGlscy9zaW5rcy5qcycpXG4gICAgaW5pdFNpbmtzKClcbiAgICBwcm9maWxlQ2hlY2twb2ludCgncHJlQWN0aW9uX2FmdGVyX3NpbmtzJylcblxuICAgIC8vIGdoLTMzNTA4OiAtLXBsdWdpbi1kaXIgaXMgYSB0b3AtbGV2ZWwgcHJvZ3JhbSBvcHRpb24uIFRoZSBkZWZhdWx0XG4gICAgLy8gYWN0aW9uIHJlYWRzIGl0IGZyb20gaXRzIG93biBvcHRpb25zIGRlc3RydWN0dXJlLCBidXQgc3ViY29tbWFuZHNcbiAgICAvLyAocGx1Z2luIGxpc3QsIHBsdWdpbiBpbnN0YWxsLCBtY3AgKikgaGF2ZSB0aGVpciBvd24gYWN0aW9ucyBhbmRcbiAgICAvLyBuZXZlciBzZWUgaXQuIFdpcmUgaXQgdXAgaGVyZSBzbyBnZXRJbmxpbmVQbHVnaW5zKCkgd29ya3MgZXZlcnl3aGVyZS5cbiAgICAvLyB0aGlzQ29tbWFuZC5vcHRzKCkgaXMgdHlwZWQge30gaGVyZSBiZWNhdXNlIHRoaXMgaG9vayBpcyBhdHRhY2hlZFxuICAgIC8vIGJlZm9yZSAub3B0aW9uKCctLXBsdWdpbi1kaXInLCAuLi4pIGluIHRoZSBjaGFpbiDigJQgZXh0cmEtdHlwaW5nc1xuICAgIC8vIGJ1aWxkcyB0aGUgdHlwZSBhcyBvcHRpb25zIGFyZSBhZGRlZC4gTmFycm93IHdpdGggYSBydW50aW1lIGd1YXJkO1xuICAgIC8vIHRoZSBjb2xsZWN0IGFjY3VtdWxhdG9yICsgW10gZGVmYXVsdCBndWFyYW50ZWUgc3RyaW5nW10gaW4gcHJhY3RpY2UuXG4gICAgY29uc3QgcGx1Z2luRGlyID0gdGhpc0NvbW1hbmQuZ2V0T3B0aW9uVmFsdWUoJ3BsdWdpbkRpcicpXG4gICAgaWYgKFxuICAgICAgQXJyYXkuaXNBcnJheShwbHVnaW5EaXIpICYmXG4gICAgICBwbHVnaW5EaXIubGVuZ3RoID4gMCAmJlxuICAgICAgcGx1Z2luRGlyLmV2ZXJ5KHAgPT4gdHlwZW9mIHAgPT09ICdzdHJpbmcnKVxuICAgICkge1xuICAgICAgc2V0SW5saW5lUGx1Z2lucyhwbHVnaW5EaXIpXG4gICAgICBjbGVhclBsdWdpbkNhY2hlKCdwcmVBY3Rpb246IC0tcGx1Z2luLWRpciBpbmxpbmUgcGx1Z2lucycpXG4gICAgfVxuXG4gICAgcnVuTWlncmF0aW9ucygpXG4gICAgcHJvZmlsZUNoZWNrcG9pbnQoJ3ByZUFjdGlvbl9hZnRlcl9taWdyYXRpb25zJylcblxuICAgIC8vIExvYWQgcmVtb3RlIG1hbmFnZWQgc2V0dGluZ3MgZm9yIGVudGVycHJpc2UgY3VzdG9tZXJzIChub24tYmxvY2tpbmcpXG4gICAgLy8gRmFpbHMgb3BlbiAtIGlmIGZldGNoIGZhaWxzLCBjb250aW51ZXMgd2l0aG91dCByZW1vdGUgc2V0dGluZ3NcbiAgICAvLyBTZXR0aW5ncyBhcmUgYXBwbGllZCB2aWEgaG90LXJlbG9hZCB3aGVuIHRoZXkgYXJyaXZlXG4gICAgLy8gTXVzdCBoYXBwZW4gYWZ0ZXIgaW5pdCgpIHRvIGVuc3VyZSBjb25maWcgcmVhZGluZyBpcyBhbGxvd2VkXG4gICAgdm9pZCBsb2FkUmVtb3RlTWFuYWdlZFNldHRpbmdzKClcbiAgICB2b2lkIGxvYWRQb2xpY3lMaW1pdHMoKVxuXG4gICAgcHJvZmlsZUNoZWNrcG9pbnQoJ3ByZUFjdGlvbl9hZnRlcl9yZW1vdGVfc2V0dGluZ3MnKVxuXG4gICAgLy8gTG9hZCBzZXR0aW5ncyBzeW5jIChub24tYmxvY2tpbmcsIGZhaWwtb3BlbilcbiAgICAvLyBDTEk6IHVwbG9hZHMgbG9jYWwgc2V0dGluZ3MgdG8gcmVtb3RlIChDQ1IgZG93bmxvYWQgaXMgaGFuZGxlZCBieSBwcmludC50cylcbiAgICBpZiAoZmVhdHVyZSgnVVBMT0FEX1VTRVJfU0VUVElOR1MnKSkge1xuICAgICAgdm9pZCBpbXBvcnQoJy4vc2VydmljZXMvc2V0dGluZ3NTeW5jL2luZGV4LmpzJykudGhlbihtID0+XG4gICAgICAgIG0udXBsb2FkVXNlclNldHRpbmdzSW5CYWNrZ3JvdW5kKCksXG4gICAgICApXG4gICAgfVxuXG4gICAgcHJvZmlsZUNoZWNrcG9pbnQoJ3ByZUFjdGlvbl9hZnRlcl9zZXR0aW5nc19zeW5jJylcbiAgfSlcblxuICBwcm9ncmFtXG4gICAgLm5hbWUoJ2NsYXVkZScpXG4gICAgLmRlc2NyaXB0aW9uKFxuICAgICAgYENsYXVkZSBDb2RlIC0gc3RhcnRzIGFuIGludGVyYWN0aXZlIHNlc3Npb24gYnkgZGVmYXVsdCwgdXNlIC1wLy0tcHJpbnQgZm9yIG5vbi1pbnRlcmFjdGl2ZSBvdXRwdXRgLFxuICAgIClcbiAgICAuYXJndW1lbnQoJ1twcm9tcHRdJywgJ1lvdXIgcHJvbXB0JywgU3RyaW5nKVxuICAgIC8vIFN1YmNvbW1hbmRzIGluaGVyaXQgaGVscE9wdGlvbiB2aWEgY29tbWFuZGVyJ3MgY29weUluaGVyaXRlZFNldHRpbmdzIOKAlFxuICAgIC8vIHNldHRpbmcgaXQgb25jZSBoZXJlIGNvdmVycyBtY3AsIHBsdWdpbiwgYXV0aCwgYW5kIGFsbCBvdGhlciBzdWJjb21tYW5kcy5cbiAgICAuaGVscE9wdGlvbignLWgsIC0taGVscCcsICdEaXNwbGF5IGhlbHAgZm9yIGNvbW1hbmQnKVxuICAgIC5vcHRpb24oXG4gICAgICAnLWQsIC0tZGVidWcgW2ZpbHRlcl0nLFxuICAgICAgJ0VuYWJsZSBkZWJ1ZyBtb2RlIHdpdGggb3B0aW9uYWwgY2F0ZWdvcnkgZmlsdGVyaW5nIChlLmcuLCBcImFwaSxob29rc1wiIG9yIFwiITFwLCFmaWxlXCIpJyxcbiAgICAgIChfdmFsdWU6IHN0cmluZyB8IHRydWUpID0+IHtcbiAgICAgICAgLy8gSWYgdmFsdWUgaXMgcHJvdmlkZWQsIGl0IHdpbGwgYmUgdGhlIGZpbHRlciBzdHJpbmdcbiAgICAgICAgLy8gSWYgbm90IHByb3ZpZGVkIGJ1dCBmbGFnIGlzIHByZXNlbnQsIHZhbHVlIHdpbGwgYmUgdHJ1ZVxuICAgICAgICAvLyBUaGUgYWN0dWFsIGZpbHRlcmluZyBpcyBoYW5kbGVkIGluIGRlYnVnLnRzIGJ5IHBhcnNpbmcgcHJvY2Vzcy5hcmd2XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9LFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbignLWQyZSwgLS1kZWJ1Zy10by1zdGRlcnInLCAnRW5hYmxlIGRlYnVnIG1vZGUgKHRvIHN0ZGVyciknKVxuICAgICAgICAuYXJnUGFyc2VyKEJvb2xlYW4pXG4gICAgICAgIC5oaWRlSGVscCgpLFxuICAgIClcbiAgICAub3B0aW9uKFxuICAgICAgJy0tZGVidWctZmlsZSA8cGF0aD4nLFxuICAgICAgJ1dyaXRlIGRlYnVnIGxvZ3MgdG8gYSBzcGVjaWZpYyBmaWxlIHBhdGggKGltcGxpY2l0bHkgZW5hYmxlcyBkZWJ1ZyBtb2RlKScsXG4gICAgICAoKSA9PiB0cnVlLFxuICAgIClcbiAgICAub3B0aW9uKFxuICAgICAgJy0tdmVyYm9zZScsXG4gICAgICAnT3ZlcnJpZGUgdmVyYm9zZSBtb2RlIHNldHRpbmcgZnJvbSBjb25maWcnLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctcCwgLS1wcmludCcsXG4gICAgICAnUHJpbnQgcmVzcG9uc2UgYW5kIGV4aXQgKHVzZWZ1bCBmb3IgcGlwZXMpLiBOb3RlOiBUaGUgd29ya3NwYWNlIHRydXN0IGRpYWxvZyBpcyBza2lwcGVkIHdoZW4gQ2xhdWRlIGlzIHJ1biB3aXRoIHRoZSAtcCBtb2RlLiBPbmx5IHVzZSB0aGlzIGZsYWcgaW4gZGlyZWN0b3JpZXMgeW91IHRydXN0LicsXG4gICAgICAoKSA9PiB0cnVlLFxuICAgIClcbiAgICAub3B0aW9uKFxuICAgICAgJy0tYmFyZScsXG4gICAgICAnTWluaW1hbCBtb2RlOiBza2lwIGhvb2tzLCBMU1AsIHBsdWdpbiBzeW5jLCBhdHRyaWJ1dGlvbiwgYXV0by1tZW1vcnksIGJhY2tncm91bmQgcHJlZmV0Y2hlcywga2V5Y2hhaW4gcmVhZHMsIGFuZCBDTEFVREUubWQgYXV0by1kaXNjb3ZlcnkuIFNldHMgQ0xBVURFX0NPREVfU0lNUExFPTEuIEFudGhyb3BpYyBhdXRoIGlzIHN0cmljdGx5IEFOVEhST1BJQ19BUElfS0VZIG9yIGFwaUtleUhlbHBlciB2aWEgLS1zZXR0aW5ncyAoT0F1dGggYW5kIGtleWNoYWluIGFyZSBuZXZlciByZWFkKS4gM1AgcHJvdmlkZXJzIChCZWRyb2NrL1ZlcnRleC9Gb3VuZHJ5KSB1c2UgdGhlaXIgb3duIGNyZWRlbnRpYWxzLiBTa2lsbHMgc3RpbGwgcmVzb2x2ZSB2aWEgL3NraWxsLW5hbWUuIEV4cGxpY2l0bHkgcHJvdmlkZSBjb250ZXh0IHZpYTogLS1zeXN0ZW0tcHJvbXB0Wy1maWxlXSwgLS1hcHBlbmQtc3lzdGVtLXByb21wdFstZmlsZV0sIC0tYWRkLWRpciAoQ0xBVURFLm1kIGRpcnMpLCAtLW1jcC1jb25maWcsIC0tc2V0dGluZ3MsIC0tYWdlbnRzLCAtLXBsdWdpbi1kaXIuJyxcbiAgICAgICgpID0+IHRydWUsXG4gICAgKVxuICAgIC5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1pbml0JyxcbiAgICAgICAgJ1J1biBTZXR1cCBob29rcyB3aXRoIGluaXQgdHJpZ2dlciwgdGhlbiBjb250aW51ZScsXG4gICAgICApLmhpZGVIZWxwKCksXG4gICAgKVxuICAgIC5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1pbml0LW9ubHknLFxuICAgICAgICAnUnVuIFNldHVwIGFuZCBTZXNzaW9uU3RhcnQ6c3RhcnR1cCBob29rcywgdGhlbiBleGl0JyxcbiAgICAgICkuaGlkZUhlbHAoKSxcbiAgICApXG4gICAgLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLW1haW50ZW5hbmNlJyxcbiAgICAgICAgJ1J1biBTZXR1cCBob29rcyB3aXRoIG1haW50ZW5hbmNlIHRyaWdnZXIsIHRoZW4gY29udGludWUnLFxuICAgICAgKS5oaWRlSGVscCgpLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tb3V0cHV0LWZvcm1hdCA8Zm9ybWF0PicsXG4gICAgICAgICdPdXRwdXQgZm9ybWF0IChvbmx5IHdvcmtzIHdpdGggLS1wcmludCk6IFwidGV4dFwiIChkZWZhdWx0KSwgXCJqc29uXCIgKHNpbmdsZSByZXN1bHQpLCBvciBcInN0cmVhbS1qc29uXCIgKHJlYWx0aW1lIHN0cmVhbWluZyknLFxuICAgICAgKS5jaG9pY2VzKFsndGV4dCcsICdqc29uJywgJ3N0cmVhbS1qc29uJ10pLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tanNvbi1zY2hlbWEgPHNjaGVtYT4nLFxuICAgICAgICAnSlNPTiBTY2hlbWEgZm9yIHN0cnVjdHVyZWQgb3V0cHV0IHZhbGlkYXRpb24uICcgK1xuICAgICAgICAgICdFeGFtcGxlOiB7XCJ0eXBlXCI6XCJvYmplY3RcIixcInByb3BlcnRpZXNcIjp7XCJuYW1lXCI6e1widHlwZVwiOlwic3RyaW5nXCJ9fSxcInJlcXVpcmVkXCI6W1wibmFtZVwiXX0nLFxuICAgICAgKS5hcmdQYXJzZXIoU3RyaW5nKSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLWluY2x1ZGUtaG9vay1ldmVudHMnLFxuICAgICAgJ0luY2x1ZGUgYWxsIGhvb2sgbGlmZWN5Y2xlIGV2ZW50cyBpbiB0aGUgb3V0cHV0IHN0cmVhbSAob25seSB3b3JrcyB3aXRoIC0tb3V0cHV0LWZvcm1hdD1zdHJlYW0tanNvbiknLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLWluY2x1ZGUtcGFydGlhbC1tZXNzYWdlcycsXG4gICAgICAnSW5jbHVkZSBwYXJ0aWFsIG1lc3NhZ2UgY2h1bmtzIGFzIHRoZXkgYXJyaXZlIChvbmx5IHdvcmtzIHdpdGggLS1wcmludCBhbmQgLS1vdXRwdXQtZm9ybWF0PXN0cmVhbS1qc29uKScsXG4gICAgICAoKSA9PiB0cnVlLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0taW5wdXQtZm9ybWF0IDxmb3JtYXQ+JyxcbiAgICAgICAgJ0lucHV0IGZvcm1hdCAob25seSB3b3JrcyB3aXRoIC0tcHJpbnQpOiBcInRleHRcIiAoZGVmYXVsdCksIG9yIFwic3RyZWFtLWpzb25cIiAocmVhbHRpbWUgc3RyZWFtaW5nIGlucHV0KScsXG4gICAgICApLmNob2ljZXMoWyd0ZXh0JywgJ3N0cmVhbS1qc29uJ10pLFxuICAgIClcbiAgICAub3B0aW9uKFxuICAgICAgJy0tbWNwLWRlYnVnJyxcbiAgICAgICdbREVQUkVDQVRFRC4gVXNlIC0tZGVidWcgaW5zdGVhZF0gRW5hYmxlIE1DUCBkZWJ1ZyBtb2RlIChzaG93cyBNQ1Agc2VydmVyIGVycm9ycyknLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLWRhbmdlcm91c2x5LXNraXAtcGVybWlzc2lvbnMnLFxuICAgICAgJ0J5cGFzcyBhbGwgcGVybWlzc2lvbiBjaGVja3MuIFJlY29tbWVuZGVkIG9ubHkgZm9yIHNhbmRib3hlcyB3aXRoIG5vIGludGVybmV0IGFjY2Vzcy4nLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLWFsbG93LWRhbmdlcm91c2x5LXNraXAtcGVybWlzc2lvbnMnLFxuICAgICAgJ0VuYWJsZSBieXBhc3NpbmcgYWxsIHBlcm1pc3Npb24gY2hlY2tzIGFzIGFuIG9wdGlvbiwgd2l0aG91dCBpdCBiZWluZyBlbmFibGVkIGJ5IGRlZmF1bHQuIFJlY29tbWVuZGVkIG9ubHkgZm9yIHNhbmRib3hlcyB3aXRoIG5vIGludGVybmV0IGFjY2Vzcy4nLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLXRoaW5raW5nIDxtb2RlPicsXG4gICAgICAgICdUaGlua2luZyBtb2RlOiBlbmFibGVkIChlcXVpdmFsZW50IHRvIGFkYXB0aXZlKSwgZGlzYWJsZWQnLFxuICAgICAgKVxuICAgICAgICAuY2hvaWNlcyhbJ2VuYWJsZWQnLCAnYWRhcHRpdmUnLCAnZGlzYWJsZWQnXSlcbiAgICAgICAgLmhpZGVIZWxwKCksXG4gICAgKVxuICAgIC5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1tYXgtdGhpbmtpbmctdG9rZW5zIDx0b2tlbnM+JyxcbiAgICAgICAgJ1tERVBSRUNBVEVELiBVc2UgLS10aGlua2luZyBpbnN0ZWFkIGZvciBuZXdlciBtb2RlbHNdIE1heGltdW0gbnVtYmVyIG9mIHRoaW5raW5nIHRva2VucyAob25seSB3b3JrcyB3aXRoIC0tcHJpbnQpJyxcbiAgICAgIClcbiAgICAgICAgLmFyZ1BhcnNlcihOdW1iZXIpXG4gICAgICAgIC5oaWRlSGVscCgpLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tbWF4LXR1cm5zIDx0dXJucz4nLFxuICAgICAgICAnTWF4aW11bSBudW1iZXIgb2YgYWdlbnRpYyB0dXJucyBpbiBub24taW50ZXJhY3RpdmUgbW9kZS4gVGhpcyB3aWxsIGVhcmx5IGV4aXQgdGhlIGNvbnZlcnNhdGlvbiBhZnRlciB0aGUgc3BlY2lmaWVkIG51bWJlciBvZiB0dXJucy4gKG9ubHkgd29ya3Mgd2l0aCAtLXByaW50KScsXG4gICAgICApXG4gICAgICAgIC5hcmdQYXJzZXIoTnVtYmVyKVxuICAgICAgICAuaGlkZUhlbHAoKSxcbiAgICApXG4gICAgLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLW1heC1idWRnZXQtdXNkIDxhbW91bnQ+JyxcbiAgICAgICAgJ01heGltdW0gZG9sbGFyIGFtb3VudCB0byBzcGVuZCBvbiBBUEkgY2FsbHMgKG9ubHkgd29ya3Mgd2l0aCAtLXByaW50KScsXG4gICAgICApLmFyZ1BhcnNlcih2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGFtb3VudCA9IE51bWJlcih2YWx1ZSlcbiAgICAgICAgaWYgKGlzTmFOKGFtb3VudCkgfHwgYW1vdW50IDw9IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAnLS1tYXgtYnVkZ2V0LXVzZCBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyIGdyZWF0ZXIgdGhhbiAwJyxcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFtb3VudFxuICAgICAgfSksXG4gICAgKVxuICAgIC5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS10YXNrLWJ1ZGdldCA8dG9rZW5zPicsXG4gICAgICAgICdBUEktc2lkZSB0YXNrIGJ1ZGdldCBpbiB0b2tlbnMgKG91dHB1dF9jb25maWcudGFza19idWRnZXQpJyxcbiAgICAgIClcbiAgICAgICAgLmFyZ1BhcnNlcih2YWx1ZSA9PiB7XG4gICAgICAgICAgY29uc3QgdG9rZW5zID0gTnVtYmVyKHZhbHVlKVxuICAgICAgICAgIGlmIChpc05hTih0b2tlbnMpIHx8IHRva2VucyA8PSAwIHx8ICFOdW1iZXIuaXNJbnRlZ2VyKHRva2VucykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignLS10YXNrLWJ1ZGdldCBtdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlcicpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0b2tlbnNcbiAgICAgICAgfSlcbiAgICAgICAgLmhpZGVIZWxwKCksXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1yZXBsYXktdXNlci1tZXNzYWdlcycsXG4gICAgICAnUmUtZW1pdCB1c2VyIG1lc3NhZ2VzIGZyb20gc3RkaW4gYmFjayBvbiBzdGRvdXQgZm9yIGFja25vd2xlZGdtZW50IChvbmx5IHdvcmtzIHdpdGggLS1pbnB1dC1mb3JtYXQ9c3RyZWFtLWpzb24gYW5kIC0tb3V0cHV0LWZvcm1hdD1zdHJlYW0tanNvbiknLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLWVuYWJsZS1hdXRoLXN0YXR1cycsXG4gICAgICAgICdFbmFibGUgYXV0aCBzdGF0dXMgbWVzc2FnZXMgaW4gU0RLIG1vZGUnLFxuICAgICAgKVxuICAgICAgICAuZGVmYXVsdChmYWxzZSlcbiAgICAgICAgLmhpZGVIZWxwKCksXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1hbGxvd2VkVG9vbHMsIC0tYWxsb3dlZC10b29scyA8dG9vbHMuLi4+JyxcbiAgICAgICdDb21tYSBvciBzcGFjZS1zZXBhcmF0ZWQgbGlzdCBvZiB0b29sIG5hbWVzIHRvIGFsbG93IChlLmcuIFwiQmFzaChnaXQ6KikgRWRpdFwiKScsXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS10b29scyA8dG9vbHMuLi4+JyxcbiAgICAgICdTcGVjaWZ5IHRoZSBsaXN0IG9mIGF2YWlsYWJsZSB0b29scyBmcm9tIHRoZSBidWlsdC1pbiBzZXQuIFVzZSBcIlwiIHRvIGRpc2FibGUgYWxsIHRvb2xzLCBcImRlZmF1bHRcIiB0byB1c2UgYWxsIHRvb2xzLCBvciBzcGVjaWZ5IHRvb2wgbmFtZXMgKGUuZy4gXCJCYXNoLEVkaXQsUmVhZFwiKS4nLFxuICAgIClcbiAgICAub3B0aW9uKFxuICAgICAgJy0tZGlzYWxsb3dlZFRvb2xzLCAtLWRpc2FsbG93ZWQtdG9vbHMgPHRvb2xzLi4uPicsXG4gICAgICAnQ29tbWEgb3Igc3BhY2Utc2VwYXJhdGVkIGxpc3Qgb2YgdG9vbCBuYW1lcyB0byBkZW55IChlLmcuIFwiQmFzaChnaXQ6KikgRWRpdFwiKScsXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1tY3AtY29uZmlnIDxjb25maWdzLi4uPicsXG4gICAgICAnTG9hZCBNQ1Agc2VydmVycyBmcm9tIEpTT04gZmlsZXMgb3Igc3RyaW5ncyAoc3BhY2Utc2VwYXJhdGVkKScsXG4gICAgKVxuICAgIC5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1wZXJtaXNzaW9uLXByb21wdC10b29sIDx0b29sPicsXG4gICAgICAgICdNQ1AgdG9vbCB0byB1c2UgZm9yIHBlcm1pc3Npb24gcHJvbXB0cyAob25seSB3b3JrcyB3aXRoIC0tcHJpbnQpJyxcbiAgICAgIClcbiAgICAgICAgLmFyZ1BhcnNlcihTdHJpbmcpXG4gICAgICAgIC5oaWRlSGVscCgpLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tc3lzdGVtLXByb21wdCA8cHJvbXB0PicsXG4gICAgICAgICdTeXN0ZW0gcHJvbXB0IHRvIHVzZSBmb3IgdGhlIHNlc3Npb24nLFxuICAgICAgKS5hcmdQYXJzZXIoU3RyaW5nKSxcbiAgICApXG4gICAgLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLXN5c3RlbS1wcm9tcHQtZmlsZSA8ZmlsZT4nLFxuICAgICAgICAnUmVhZCBzeXN0ZW0gcHJvbXB0IGZyb20gYSBmaWxlJyxcbiAgICAgIClcbiAgICAgICAgLmFyZ1BhcnNlcihTdHJpbmcpXG4gICAgICAgIC5oaWRlSGVscCgpLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tYXBwZW5kLXN5c3RlbS1wcm9tcHQgPHByb21wdD4nLFxuICAgICAgICAnQXBwZW5kIGEgc3lzdGVtIHByb21wdCB0byB0aGUgZGVmYXVsdCBzeXN0ZW0gcHJvbXB0JyxcbiAgICAgICkuYXJnUGFyc2VyKFN0cmluZyksXG4gICAgKVxuICAgIC5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1hcHBlbmQtc3lzdGVtLXByb21wdC1maWxlIDxmaWxlPicsXG4gICAgICAgICdSZWFkIHN5c3RlbSBwcm9tcHQgZnJvbSBhIGZpbGUgYW5kIGFwcGVuZCB0byB0aGUgZGVmYXVsdCBzeXN0ZW0gcHJvbXB0JyxcbiAgICAgIClcbiAgICAgICAgLmFyZ1BhcnNlcihTdHJpbmcpXG4gICAgICAgIC5oaWRlSGVscCgpLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tcGVybWlzc2lvbi1tb2RlIDxtb2RlPicsXG4gICAgICAgICdQZXJtaXNzaW9uIG1vZGUgdG8gdXNlIGZvciB0aGUgc2Vzc2lvbicsXG4gICAgICApXG4gICAgICAgIC5hcmdQYXJzZXIoU3RyaW5nKVxuICAgICAgICAuY2hvaWNlcyhQRVJNSVNTSU9OX01PREVTKSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctYywgLS1jb250aW51ZScsXG4gICAgICAnQ29udGludWUgdGhlIG1vc3QgcmVjZW50IGNvbnZlcnNhdGlvbiBpbiB0aGUgY3VycmVudCBkaXJlY3RvcnknLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctciwgLS1yZXN1bWUgW3ZhbHVlXScsXG4gICAgICAnUmVzdW1lIGEgY29udmVyc2F0aW9uIGJ5IHNlc3Npb24gSUQsIG9yIG9wZW4gaW50ZXJhY3RpdmUgcGlja2VyIHdpdGggb3B0aW9uYWwgc2VhcmNoIHRlcm0nLFxuICAgICAgdmFsdWUgPT4gdmFsdWUgfHwgdHJ1ZSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLWZvcmstc2Vzc2lvbicsXG4gICAgICAnV2hlbiByZXN1bWluZywgY3JlYXRlIGEgbmV3IHNlc3Npb24gSUQgaW5zdGVhZCBvZiByZXVzaW5nIHRoZSBvcmlnaW5hbCAodXNlIHdpdGggLS1yZXN1bWUgb3IgLS1jb250aW51ZSknLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLXByZWZpbGwgPHRleHQ+JyxcbiAgICAgICAgJ1ByZS1maWxsIHRoZSBwcm9tcHQgaW5wdXQgd2l0aCB0ZXh0IHdpdGhvdXQgc3VibWl0dGluZyBpdCcsXG4gICAgICApLmhpZGVIZWxwKCksXG4gICAgKVxuICAgIC5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1kZWVwLWxpbmstb3JpZ2luJyxcbiAgICAgICAgJ1NpZ25hbCB0aGF0IHRoaXMgc2Vzc2lvbiB3YXMgbGF1bmNoZWQgZnJvbSBhIGRlZXAgbGluaycsXG4gICAgICApLmhpZGVIZWxwKCksXG4gICAgKVxuICAgIC5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1kZWVwLWxpbmstcmVwbyA8c2x1Zz4nLFxuICAgICAgICAnUmVwbyBzbHVnIHRoZSBkZWVwIGxpbmsgP3JlcG89IHBhcmFtZXRlciByZXNvbHZlZCB0byB0aGUgY3VycmVudCBjd2QnLFxuICAgICAgKS5oaWRlSGVscCgpLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tZGVlcC1saW5rLWxhc3QtZmV0Y2ggPG1zPicsXG4gICAgICAgICdGRVRDSF9IRUFEIG10aW1lIGluIGVwb2NoIG1zLCBwcmVjb21wdXRlZCBieSB0aGUgZGVlcCBsaW5rIHRyYW1wb2xpbmUnLFxuICAgICAgKVxuICAgICAgICAuYXJnUGFyc2VyKHYgPT4ge1xuICAgICAgICAgIGNvbnN0IG4gPSBOdW1iZXIodilcbiAgICAgICAgICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKG4pID8gbiA6IHVuZGVmaW5lZFxuICAgICAgICB9KVxuICAgICAgICAuaGlkZUhlbHAoKSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLWZyb20tcHIgW3ZhbHVlXScsXG4gICAgICAnUmVzdW1lIGEgc2Vzc2lvbiBsaW5rZWQgdG8gYSBQUiBieSBQUiBudW1iZXIvVVJMLCBvciBvcGVuIGludGVyYWN0aXZlIHBpY2tlciB3aXRoIG9wdGlvbmFsIHNlYXJjaCB0ZXJtJyxcbiAgICAgIHZhbHVlID0+IHZhbHVlIHx8IHRydWUsXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1uby1zZXNzaW9uLXBlcnNpc3RlbmNlJyxcbiAgICAgICdEaXNhYmxlIHNlc3Npb24gcGVyc2lzdGVuY2UgLSBzZXNzaW9ucyB3aWxsIG5vdCBiZSBzYXZlZCB0byBkaXNrIGFuZCBjYW5ub3QgYmUgcmVzdW1lZCAob25seSB3b3JrcyB3aXRoIC0tcHJpbnQpJyxcbiAgICApXG4gICAgLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLXJlc3VtZS1zZXNzaW9uLWF0IDxtZXNzYWdlIGlkPicsXG4gICAgICAgICdXaGVuIHJlc3VtaW5nLCBvbmx5IG1lc3NhZ2VzIHVwIHRvIGFuZCBpbmNsdWRpbmcgdGhlIGFzc2lzdGFudCBtZXNzYWdlIHdpdGggPG1lc3NhZ2UuaWQ+ICh1c2Ugd2l0aCAtLXJlc3VtZSBpbiBwcmludCBtb2RlKScsXG4gICAgICApXG4gICAgICAgIC5hcmdQYXJzZXIoU3RyaW5nKVxuICAgICAgICAuaGlkZUhlbHAoKSxcbiAgICApXG4gICAgLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLXJld2luZC1maWxlcyA8dXNlci1tZXNzYWdlLWlkPicsXG4gICAgICAgICdSZXN0b3JlIGZpbGVzIHRvIHN0YXRlIGF0IHRoZSBzcGVjaWZpZWQgdXNlciBtZXNzYWdlIGFuZCBleGl0IChyZXF1aXJlcyAtLXJlc3VtZSknLFxuICAgICAgKS5oaWRlSGVscCgpLFxuICAgIClcbiAgICAvLyBAW01PREVMIExBVU5DSF06IFVwZGF0ZSB0aGUgZXhhbXBsZSBtb2RlbCBJRCBpbiB0aGUgLS1tb2RlbCBoZWxwIHRleHQuXG4gICAgLm9wdGlvbihcbiAgICAgICctLW1vZGVsIDxtb2RlbD4nLFxuICAgICAgYE1vZGVsIGZvciB0aGUgY3VycmVudCBzZXNzaW9uLiBQcm92aWRlIGFuIGFsaWFzIGZvciB0aGUgbGF0ZXN0IG1vZGVsIChlLmcuICdzb25uZXQnIG9yICdvcHVzJykgb3IgYSBtb2RlbCdzIGZ1bGwgbmFtZSAoZS5nLiAnY2xhdWRlLXNvbm5ldC00LTYnKS5gLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tZWZmb3J0IDxsZXZlbD4nLFxuICAgICAgICBgRWZmb3J0IGxldmVsIGZvciB0aGUgY3VycmVudCBzZXNzaW9uIChsb3csIG1lZGl1bSwgaGlnaCwgbWF4KWAsXG4gICAgICApLmFyZ1BhcnNlcigocmF3VmFsdWU6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHJhd1ZhbHVlLnRvTG93ZXJDYXNlKClcbiAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsnbG93JywgJ21lZGl1bScsICdoaWdoJywgJ21heCddXG4gICAgICAgIGlmICghYWxsb3dlZC5pbmNsdWRlcyh2YWx1ZSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEFyZ3VtZW50RXJyb3IoXG4gICAgICAgICAgICBgSXQgbXVzdCBiZSBvbmUgb2Y6ICR7YWxsb3dlZC5qb2luKCcsICcpfWAsXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZVxuICAgICAgfSksXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1hZ2VudCA8YWdlbnQ+JyxcbiAgICAgIGBBZ2VudCBmb3IgdGhlIGN1cnJlbnQgc2Vzc2lvbi4gT3ZlcnJpZGVzIHRoZSAnYWdlbnQnIHNldHRpbmcuYCxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLWJldGFzIDxiZXRhcy4uLj4nLFxuICAgICAgJ0JldGEgaGVhZGVycyB0byBpbmNsdWRlIGluIEFQSSByZXF1ZXN0cyAoQVBJIGtleSB1c2VycyBvbmx5KScsXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1mYWxsYmFjay1tb2RlbCA8bW9kZWw+JyxcbiAgICAgICdFbmFibGUgYXV0b21hdGljIGZhbGxiYWNrIHRvIHNwZWNpZmllZCBtb2RlbCB3aGVuIGRlZmF1bHQgbW9kZWwgaXMgb3ZlcmxvYWRlZCAob25seSB3b3JrcyB3aXRoIC0tcHJpbnQpJyxcbiAgICApXG4gICAgLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLXdvcmtsb2FkIDx0YWc+JyxcbiAgICAgICAgJ1dvcmtsb2FkIHRhZyBmb3IgYmlsbGluZy1oZWFkZXIgYXR0cmlidXRpb24gKGNjX3dvcmtsb2FkKS4gUHJvY2Vzcy1zY29wZWQ7IHNldCBieSBTREsgZGFlbW9uIGNhbGxlcnMgdGhhdCBzcGF3biBzdWJwcm9jZXNzZXMgZm9yIGNyb24gd29yay4gKG9ubHkgd29ya3Mgd2l0aCAtLXByaW50KScsXG4gICAgICApLmhpZGVIZWxwKCksXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1zZXR0aW5ncyA8ZmlsZS1vci1qc29uPicsXG4gICAgICAnUGF0aCB0byBhIHNldHRpbmdzIEpTT04gZmlsZSBvciBhIEpTT04gc3RyaW5nIHRvIGxvYWQgYWRkaXRpb25hbCBzZXR0aW5ncyBmcm9tJyxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLWFkZC1kaXIgPGRpcmVjdG9yaWVzLi4uPicsXG4gICAgICAnQWRkaXRpb25hbCBkaXJlY3RvcmllcyB0byBhbGxvdyB0b29sIGFjY2VzcyB0bycsXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1pZGUnLFxuICAgICAgJ0F1dG9tYXRpY2FsbHkgY29ubmVjdCB0byBJREUgb24gc3RhcnR1cCBpZiBleGFjdGx5IG9uZSB2YWxpZCBJREUgaXMgYXZhaWxhYmxlJyxcbiAgICAgICgpID0+IHRydWUsXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1zdHJpY3QtbWNwLWNvbmZpZycsXG4gICAgICAnT25seSB1c2UgTUNQIHNlcnZlcnMgZnJvbSAtLW1jcC1jb25maWcsIGlnbm9yaW5nIGFsbCBvdGhlciBNQ1AgY29uZmlndXJhdGlvbnMnLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLXNlc3Npb24taWQgPHV1aWQ+JyxcbiAgICAgICdVc2UgYSBzcGVjaWZpYyBzZXNzaW9uIElEIGZvciB0aGUgY29udmVyc2F0aW9uIChtdXN0IGJlIGEgdmFsaWQgVVVJRCknLFxuICAgIClcbiAgICAub3B0aW9uKFxuICAgICAgJy1uLCAtLW5hbWUgPG5hbWU+JyxcbiAgICAgICdTZXQgYSBkaXNwbGF5IG5hbWUgZm9yIHRoaXMgc2Vzc2lvbiAoc2hvd24gaW4gL3Jlc3VtZSBhbmQgdGVybWluYWwgdGl0bGUpJyxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLWFnZW50cyA8anNvbj4nLFxuICAgICAgJ0pTT04gb2JqZWN0IGRlZmluaW5nIGN1c3RvbSBhZ2VudHMgKGUuZy4gXFwne1wicmV2aWV3ZXJcIjoge1wiZGVzY3JpcHRpb25cIjogXCJSZXZpZXdzIGNvZGVcIiwgXCJwcm9tcHRcIjogXCJZb3UgYXJlIGEgY29kZSByZXZpZXdlclwifX1cXCcpJyxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctLXNldHRpbmctc291cmNlcyA8c291cmNlcz4nLFxuICAgICAgJ0NvbW1hLXNlcGFyYXRlZCBsaXN0IG9mIHNldHRpbmcgc291cmNlcyB0byBsb2FkICh1c2VyLCBwcm9qZWN0LCBsb2NhbCkuJyxcbiAgICApXG4gICAgLy8gZ2gtMzM1MDg6IDxwYXRocy4uLj4gKHZhcmlhZGljKSBjb25zdW1lZCBldmVyeXRoaW5nIHVudGlsIHRoZSBuZXh0XG4gICAgLy8gLS1mbGFnLiBgY2xhdWRlIC0tcGx1Z2luLWRpciAvcGF0aCBtY3AgYWRkIC0tdHJhbnNwb3J0IGh0dHBgIHN3YWxsb3dlZFxuICAgIC8vIGBtY3BgIGFuZCBgYWRkYCBhcyBwYXRocywgdGhlbiBjaG9rZWQgb24gLS10cmFuc3BvcnQgYXMgYW4gdW5rbm93blxuICAgIC8vIHRvcC1sZXZlbCBvcHRpb24uIFNpbmdsZS12YWx1ZSArIGNvbGxlY3QgYWNjdW11bGF0b3IgbWVhbnMgZWFjaFxuICAgIC8vIC0tcGx1Z2luLWRpciB0YWtlcyBleGFjdGx5IG9uZSBhcmc7IHJlcGVhdCB0aGUgZmxhZyBmb3IgbXVsdGlwbGUgZGlycy5cbiAgICAub3B0aW9uKFxuICAgICAgJy0tcGx1Z2luLWRpciA8cGF0aD4nLFxuICAgICAgJ0xvYWQgcGx1Z2lucyBmcm9tIGEgZGlyZWN0b3J5IGZvciB0aGlzIHNlc3Npb24gb25seSAocmVwZWF0YWJsZTogLS1wbHVnaW4tZGlyIEEgLS1wbHVnaW4tZGlyIEIpJyxcbiAgICAgICh2YWw6IHN0cmluZywgcHJldjogc3RyaW5nW10pID0+IFsuLi5wcmV2LCB2YWxdLFxuICAgICAgW10gYXMgc3RyaW5nW10sXG4gICAgKVxuICAgIC5vcHRpb24oJy0tZGlzYWJsZS1zbGFzaC1jb21tYW5kcycsICdEaXNhYmxlIGFsbCBza2lsbHMnLCAoKSA9PiB0cnVlKVxuICAgIC5vcHRpb24oJy0tY2hyb21lJywgJ0VuYWJsZSBDbGF1ZGUgaW4gQ2hyb21lIGludGVncmF0aW9uJylcbiAgICAub3B0aW9uKCctLW5vLWNocm9tZScsICdEaXNhYmxlIENsYXVkZSBpbiBDaHJvbWUgaW50ZWdyYXRpb24nKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1maWxlIDxzcGVjcy4uLj4nLFxuICAgICAgJ0ZpbGUgcmVzb3VyY2VzIHRvIGRvd25sb2FkIGF0IHN0YXJ0dXAuIEZvcm1hdDogZmlsZV9pZDpyZWxhdGl2ZV9wYXRoIChlLmcuLCAtLWZpbGUgZmlsZV9hYmM6ZG9jLnR4dCBmaWxlX2RlZjppbWcucG5nKScsXG4gICAgKVxuICAgIC5hY3Rpb24oYXN5bmMgKHByb21wdCwgb3B0aW9ucykgPT4ge1xuICAgICAgcHJvZmlsZUNoZWNrcG9pbnQoJ2FjdGlvbl9oYW5kbGVyX3N0YXJ0JylcblxuICAgICAgLy8gLS1iYXJlID0gb25lLXN3aXRjaCBtaW5pbWFsIG1vZGUuIFNldHMgU0lNUExFIHNvIGFsbCB0aGUgZXhpc3RpbmdcbiAgICAgIC8vIGdhdGVzIGZpcmUgKENMQVVERS5tZCwgc2tpbGxzLCBob29rcyBpbnNpZGUgZXhlY3V0ZUhvb2tzLCBhZ2VudFxuICAgICAgLy8gZGlyLXdhbGspLiBNdXN0IGJlIHNldCBiZWZvcmUgc2V0dXAoKSAvIGFueSBvZiB0aGUgZ2F0ZWQgd29yayBydW5zLlxuICAgICAgaWYgKChvcHRpb25zIGFzIHsgYmFyZT86IGJvb2xlYW4gfSkuYmFyZSkge1xuICAgICAgICBwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9TSU1QTEUgPSAnMSdcbiAgICAgIH1cblxuICAgICAgLy8gSWdub3JlIFwiY29kZVwiIGFzIGEgcHJvbXB0IC0gdHJlYXQgaXQgdGhlIHNhbWUgYXMgbm8gcHJvbXB0XG4gICAgICBpZiAocHJvbXB0ID09PSAnY29kZScpIHtcbiAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2NvZGVfcHJvbXB0X2lnbm9yZWQnLCB7fSlcbiAgICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgY2hhbGsueWVsbG93KCdUaXA6IFlvdSBjYW4gbGF1bmNoIENsYXVkZSBDb2RlIHdpdGgganVzdCBgY2xhdWRlYCcpLFxuICAgICAgICApXG4gICAgICAgIHByb21wdCA9IHVuZGVmaW5lZFxuICAgICAgfVxuXG4gICAgICAvLyBMb2cgZXZlbnQgZm9yIGFueSBzaW5nbGUtd29yZCBwcm9tcHRcbiAgICAgIGlmIChcbiAgICAgICAgcHJvbXB0ICYmXG4gICAgICAgIHR5cGVvZiBwcm9tcHQgPT09ICdzdHJpbmcnICYmXG4gICAgICAgICEvXFxzLy50ZXN0KHByb21wdCkgJiZcbiAgICAgICAgcHJvbXB0Lmxlbmd0aCA+IDBcbiAgICAgICkge1xuICAgICAgICBsb2dFdmVudCgndGVuZ3Vfc2luZ2xlX3dvcmRfcHJvbXB0JywgeyBsZW5ndGg6IHByb21wdC5sZW5ndGggfSlcbiAgICAgIH1cblxuICAgICAgLy8gQXNzaXN0YW50IG1vZGU6IHdoZW4gLmNsYXVkZS9zZXR0aW5ncy5qc29uIGhhcyBhc3Npc3RhbnQ6IHRydWUgQU5EXG4gICAgICAvLyB0aGUgdGVuZ3Vfa2Fpcm9zIEdyb3d0aEJvb2sgZ2F0ZSBpcyBvbiwgZm9yY2UgYnJpZWYgb24uIFBlcm1pc3Npb25cbiAgICAgIC8vIG1vZGUgaXMgbGVmdCB0byB0aGUgdXNlciDigJQgc2V0dGluZ3MgZGVmYXVsdE1vZGUgb3IgLS1wZXJtaXNzaW9uLW1vZGVcbiAgICAgIC8vIGFwcGx5IGFzIG5vcm1hbC4gUkVQTC10eXBlZCBtZXNzYWdlcyBhbHJlYWR5IGRlZmF1bHQgdG8gJ25leHQnXG4gICAgICAvLyBwcmlvcml0eSAobWVzc2FnZVF1ZXVlTWFuYWdlci5lbnF1ZXVlKSBzbyB0aGV5IGRyYWluIG1pZC10dXJuIGJldHdlZW5cbiAgICAgIC8vIHRvb2wgY2FsbHMuIFNlbmRVc2VyTWVzc2FnZSAoQnJpZWZUb29sKSBpcyBlbmFibGVkIHZpYSB0aGUgYnJpZWYgZW52XG4gICAgICAvLyB2YXIuIFNsZWVwVG9vbCBzdGF5cyBkaXNhYmxlZCAoaXRzIGlzRW5hYmxlZCgpIGdhdGVzIG9uIHByb2FjdGl2ZSkuXG4gICAgICAvLyBrYWlyb3NFbmFibGVkIGlzIGNvbXB1dGVkIG9uY2UgaGVyZSBhbmQgcmV1c2VkIGF0IHRoZVxuICAgICAgLy8gZ2V0QXNzaXN0YW50U3lzdGVtUHJvbXB0QWRkZW5kdW0oKSBjYWxsIHNpdGUgZnVydGhlciBkb3duLlxuICAgICAgLy9cbiAgICAgIC8vIFRydXN0IGdhdGU6IC5jbGF1ZGUvc2V0dGluZ3MuanNvbiBpcyBhdHRhY2tlci1jb250cm9sbGFibGUgaW4gYW5cbiAgICAgIC8vIHVudHJ1c3RlZCBjbG9uZS4gV2UgcnVuIH4xMDAwIGxpbmVzIGJlZm9yZSBzaG93U2V0dXBTY3JlZW5zKCkgc2hvd3NcbiAgICAgIC8vIHRoZSB0cnVzdCBkaWFsb2csIGFuZCBieSB0aGVuIHdlJ3ZlIGFscmVhZHkgYXBwZW5kZWRcbiAgICAgIC8vIC5jbGF1ZGUvYWdlbnRzL2Fzc2lzdGFudC5tZCB0byB0aGUgc3lzdGVtIHByb21wdC4gUmVmdXNlIHRvIGFjdGl2YXRlXG4gICAgICAvLyB1bnRpbCB0aGUgZGlyZWN0b3J5IGhhcyBiZWVuIGV4cGxpY2l0bHkgdHJ1c3RlZC5cbiAgICAgIGxldCBrYWlyb3NFbmFibGVkID0gZmFsc2VcbiAgICAgIGxldCBhc3Npc3RhbnRUZWFtQ29udGV4dDpcbiAgICAgICAgfCBBd2FpdGVkPFxuICAgICAgICAgICAgUmV0dXJuVHlwZTxcbiAgICAgICAgICAgICAgTm9uTnVsbGFibGU8dHlwZW9mIGFzc2lzdGFudE1vZHVsZT5bJ2luaXRpYWxpemVBc3Npc3RhbnRUZWFtJ11cbiAgICAgICAgICAgID5cbiAgICAgICAgICA+XG4gICAgICAgIHwgdW5kZWZpbmVkXG4gICAgICBpZiAoXG4gICAgICAgIGZlYXR1cmUoJ0tBSVJPUycpICYmXG4gICAgICAgIChvcHRpb25zIGFzIHsgYXNzaXN0YW50PzogYm9vbGVhbiB9KS5hc3Npc3RhbnQgJiZcbiAgICAgICAgYXNzaXN0YW50TW9kdWxlXG4gICAgICApIHtcbiAgICAgICAgLy8gLS1hc3Npc3RhbnQgKEFnZW50IFNESyBkYWVtb24gbW9kZSk6IGZvcmNlIHRoZSBsYXRjaCBiZWZvcmVcbiAgICAgICAgLy8gaXNBc3Npc3RhbnRNb2RlKCkgcnVucyBiZWxvdy4gVGhlIGRhZW1vbiBoYXMgYWxyZWFkeSBjaGVja2VkXG4gICAgICAgIC8vIGVudGl0bGVtZW50IOKAlCBkb24ndCBtYWtlIHRoZSBjaGlsZCByZS1jaGVjayB0ZW5ndV9rYWlyb3MuXG4gICAgICAgIGFzc2lzdGFudE1vZHVsZS5tYXJrQXNzaXN0YW50Rm9yY2VkKClcbiAgICAgIH1cbiAgICAgIGlmIChcbiAgICAgICAgZmVhdHVyZSgnS0FJUk9TJykgJiZcbiAgICAgICAgYXNzaXN0YW50TW9kdWxlPy5pc0Fzc2lzdGFudE1vZGUoKSAmJlxuICAgICAgICAvLyBTcGF3bmVkIHRlYW1tYXRlcyBzaGFyZSB0aGUgbGVhZGVyJ3MgY3dkICsgc2V0dGluZ3MuanNvbiwgc29cbiAgICAgICAgLy8gaXNBc3Npc3RhbnRNb2RlKCkgaXMgdHJ1ZSBmb3IgdGhlbSB0b28uIC0tYWdlbnQtaWQgYmVpbmcgc2V0XG4gICAgICAgIC8vIG1lYW5zIHdlIEFSRSBhIHNwYXduZWQgdGVhbW1hdGUgKGV4dHJhY3RUZWFtbWF0ZU9wdGlvbnMgcnVuc1xuICAgICAgICAvLyB+MTcwIGxpbmVzIGxhdGVyIHNvIGNoZWNrIHRoZSByYXcgY29tbWFuZGVyIG9wdGlvbikg4oCUIGRvbid0XG4gICAgICAgIC8vIHJlLWluaXQgdGhlIHRlYW0gb3Igb3ZlcnJpZGUgdGVhbW1hdGVNb2RlL3Byb2FjdGl2ZS9icmllZi5cbiAgICAgICAgIShvcHRpb25zIGFzIHsgYWdlbnRJZD86IHVua25vd24gfSkuYWdlbnRJZCAmJlxuICAgICAgICBrYWlyb3NHYXRlXG4gICAgICApIHtcbiAgICAgICAgaWYgKCFjaGVja0hhc1RydXN0RGlhbG9nQWNjZXB0ZWQoKSkge1xuICAgICAgICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Db25zb2xlOjogaW50ZW50aW9uYWwgY29uc29sZSBvdXRwdXRcbiAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICBjaGFsay55ZWxsb3coXG4gICAgICAgICAgICAgICdBc3Npc3RhbnQgbW9kZSBkaXNhYmxlZDogZGlyZWN0b3J5IGlzIG5vdCB0cnVzdGVkLiBBY2NlcHQgdGhlIHRydXN0IGRpYWxvZyBhbmQgcmVzdGFydC4nLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICApXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQmxvY2tpbmcgZ2F0ZSBjaGVjayDigJQgcmV0dXJucyBjYWNoZWQgYHRydWVgIGluc3RhbnRseTsgaWYgZGlza1xuICAgICAgICAgIC8vIGNhY2hlIGlzIGZhbHNlL21pc3NpbmcsIGxhemlseSBpbml0cyBHcm93dGhCb29rIGFuZCBmZXRjaGVzIGZyZXNoXG4gICAgICAgICAgLy8gKG1heCB+NXMpLiAtLWFzc2lzdGFudCBza2lwcyB0aGUgZ2F0ZSBlbnRpcmVseSAoZGFlbW9uIGlzXG4gICAgICAgICAgLy8gcHJlLWVudGl0bGVkKS5cbiAgICAgICAgICBrYWlyb3NFbmFibGVkID1cbiAgICAgICAgICAgIGFzc2lzdGFudE1vZHVsZS5pc0Fzc2lzdGFudEZvcmNlZCgpIHx8XG4gICAgICAgICAgICAoYXdhaXQga2Fpcm9zR2F0ZS5pc0thaXJvc0VuYWJsZWQoKSlcbiAgICAgICAgICBpZiAoa2Fpcm9zRW5hYmxlZCkge1xuICAgICAgICAgICAgY29uc3Qgb3B0cyA9IG9wdGlvbnMgYXMgeyBicmllZj86IGJvb2xlYW4gfVxuICAgICAgICAgICAgb3B0cy5icmllZiA9IHRydWVcbiAgICAgICAgICAgIHNldEthaXJvc0FjdGl2ZSh0cnVlKVxuICAgICAgICAgICAgLy8gUHJlLXNlZWQgYW4gaW4tcHJvY2VzcyB0ZWFtIHNvIEFnZW50KG5hbWU6IFwiZm9vXCIpIHNwYXduc1xuICAgICAgICAgICAgLy8gdGVhbW1hdGVzIHdpdGhvdXQgVGVhbUNyZWF0ZS4gTXVzdCBydW4gQkVGT1JFIHNldHVwKCkgY2FwdHVyZXNcbiAgICAgICAgICAgIC8vIHRoZSB0ZWFtbWF0ZU1vZGUgc25hcHNob3QgKGluaXRpYWxpemVBc3Npc3RhbnRUZWFtIGNhbGxzXG4gICAgICAgICAgICAvLyBzZXRDbGlUZWFtbWF0ZU1vZGVPdmVycmlkZSBpbnRlcm5hbGx5KS5cbiAgICAgICAgICAgIGFzc2lzdGFudFRlYW1Db250ZXh0ID1cbiAgICAgICAgICAgICAgYXdhaXQgYXNzaXN0YW50TW9kdWxlLmluaXRpYWxpemVBc3Npc3RhbnRUZWFtKClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3Qge1xuICAgICAgICBkZWJ1ZyA9IGZhbHNlLFxuICAgICAgICBkZWJ1Z1RvU3RkZXJyID0gZmFsc2UsXG4gICAgICAgIGRhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zLFxuICAgICAgICBhbGxvd0Rhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zID0gZmFsc2UsXG4gICAgICAgIHRvb2xzOiBiYXNlVG9vbHMgPSBbXSxcbiAgICAgICAgYWxsb3dlZFRvb2xzID0gW10sXG4gICAgICAgIGRpc2FsbG93ZWRUb29scyA9IFtdLFxuICAgICAgICBtY3BDb25maWcgPSBbXSxcbiAgICAgICAgcGVybWlzc2lvbk1vZGU6IHBlcm1pc3Npb25Nb2RlQ2xpLFxuICAgICAgICBhZGREaXIgPSBbXSxcbiAgICAgICAgZmFsbGJhY2tNb2RlbCxcbiAgICAgICAgYmV0YXMgPSBbXSxcbiAgICAgICAgaWRlID0gZmFsc2UsXG4gICAgICAgIHNlc3Npb25JZCxcbiAgICAgICAgaW5jbHVkZUhvb2tFdmVudHMsXG4gICAgICAgIGluY2x1ZGVQYXJ0aWFsTWVzc2FnZXMsXG4gICAgICB9ID0gb3B0aW9uc1xuXG4gICAgICBpZiAob3B0aW9ucy5wcmVmaWxsKSB7XG4gICAgICAgIHNlZWRFYXJseUlucHV0KG9wdGlvbnMucHJlZmlsbClcbiAgICAgIH1cblxuICAgICAgLy8gUHJvbWlzZSBmb3IgZmlsZSBkb3dubG9hZHMgLSBzdGFydGVkIGVhcmx5LCBhd2FpdGVkIGJlZm9yZSBSRVBMIHJlbmRlcnNcbiAgICAgIGxldCBmaWxlRG93bmxvYWRQcm9taXNlOiBQcm9taXNlPERvd25sb2FkUmVzdWx0W10+IHwgdW5kZWZpbmVkXG5cbiAgICAgIGNvbnN0IGFnZW50c0pzb24gPSBvcHRpb25zLmFnZW50c1xuICAgICAgY29uc3QgYWdlbnRDbGkgPSBvcHRpb25zLmFnZW50XG4gICAgICBpZiAoZmVhdHVyZSgnQkdfU0VTU0lPTlMnKSAmJiBhZ2VudENsaSkge1xuICAgICAgICBwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9BR0VOVCA9IGFnZW50Q2xpXG4gICAgICB9XG5cbiAgICAgIC8vIE5PVEU6IExTUCBtYW5hZ2VyIGluaXRpYWxpemF0aW9uIGlzIGludGVudGlvbmFsbHkgZGVmZXJyZWQgdW50aWwgYWZ0ZXJcbiAgICAgIC8vIHRoZSB0cnVzdCBkaWFsb2cgaXMgYWNjZXB0ZWQuIFRoaXMgcHJldmVudHMgcGx1Z2luIExTUCBzZXJ2ZXJzIGZyb21cbiAgICAgIC8vIGV4ZWN1dGluZyBjb2RlIGluIHVudHJ1c3RlZCBkaXJlY3RvcmllcyBiZWZvcmUgdXNlciBjb25zZW50LlxuXG4gICAgICAvLyBFeHRyYWN0IHRoZXNlIHNlcGFyYXRlbHkgc28gdGhleSBjYW4gYmUgbW9kaWZpZWQgaWYgbmVlZGVkXG4gICAgICBsZXQgb3V0cHV0Rm9ybWF0ID0gb3B0aW9ucy5vdXRwdXRGb3JtYXRcbiAgICAgIGxldCBpbnB1dEZvcm1hdCA9IG9wdGlvbnMuaW5wdXRGb3JtYXRcbiAgICAgIGxldCB2ZXJib3NlID0gb3B0aW9ucy52ZXJib3NlID8/IGdldEdsb2JhbENvbmZpZygpLnZlcmJvc2VcbiAgICAgIGxldCBwcmludCA9IG9wdGlvbnMucHJpbnRcbiAgICAgIGNvbnN0IGluaXQgPSBvcHRpb25zLmluaXQgPz8gZmFsc2VcbiAgICAgIGNvbnN0IGluaXRPbmx5ID0gb3B0aW9ucy5pbml0T25seSA/PyBmYWxzZVxuICAgICAgY29uc3QgbWFpbnRlbmFuY2UgPSBvcHRpb25zLm1haW50ZW5hbmNlID8/IGZhbHNlXG5cbiAgICAgIC8vIEV4dHJhY3QgZGlzYWJsZSBzbGFzaCBjb21tYW5kcyBmbGFnXG4gICAgICBjb25zdCBkaXNhYmxlU2xhc2hDb21tYW5kcyA9IG9wdGlvbnMuZGlzYWJsZVNsYXNoQ29tbWFuZHMgfHwgZmFsc2VcblxuICAgICAgLy8gRXh0cmFjdCB0YXNrcyBtb2RlIG9wdGlvbnMgKGFudC1vbmx5KVxuICAgICAgY29uc3QgdGFza3NPcHRpb24gPVxuICAgICAgICBcImV4dGVybmFsXCIgPT09ICdhbnQnICYmXG4gICAgICAgIChvcHRpb25zIGFzIHsgdGFza3M/OiBib29sZWFuIHwgc3RyaW5nIH0pLnRhc2tzXG4gICAgICBjb25zdCB0YXNrTGlzdElkID0gdGFza3NPcHRpb25cbiAgICAgICAgPyB0eXBlb2YgdGFza3NPcHRpb24gPT09ICdzdHJpbmcnXG4gICAgICAgICAgPyB0YXNrc09wdGlvblxuICAgICAgICAgIDogREVGQVVMVF9UQVNLU19NT0RFX1RBU0tfTElTVF9JRFxuICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgaWYgKFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgdGFza0xpc3RJZCkge1xuICAgICAgICBwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9UQVNLX0xJU1RfSUQgPSB0YXNrTGlzdElkXG4gICAgICB9XG5cbiAgICAgIC8vIEV4dHJhY3Qgd29ya3RyZWUgb3B0aW9uXG4gICAgICAvLyB3b3JrdHJlZSBjYW4gYmUgdHJ1ZSAoZmxhZyB3aXRob3V0IHZhbHVlKSBvciBhIHN0cmluZyAoY3VzdG9tIG5hbWUgb3IgUFIgcmVmZXJlbmNlKVxuICAgICAgY29uc3Qgd29ya3RyZWVPcHRpb24gPSBpc1dvcmt0cmVlTW9kZUVuYWJsZWQoKVxuICAgICAgICA/IChvcHRpb25zIGFzIHsgd29ya3RyZWU/OiBib29sZWFuIHwgc3RyaW5nIH0pLndvcmt0cmVlXG4gICAgICAgIDogdW5kZWZpbmVkXG4gICAgICBsZXQgd29ya3RyZWVOYW1lID1cbiAgICAgICAgdHlwZW9mIHdvcmt0cmVlT3B0aW9uID09PSAnc3RyaW5nJyA/IHdvcmt0cmVlT3B0aW9uIDogdW5kZWZpbmVkXG4gICAgICBjb25zdCB3b3JrdHJlZUVuYWJsZWQgPSB3b3JrdHJlZU9wdGlvbiAhPT0gdW5kZWZpbmVkXG5cbiAgICAgIC8vIENoZWNrIGlmIHdvcmt0cmVlIG5hbWUgaXMgYSBQUiByZWZlcmVuY2UgKCNOIG9yIEdpdEh1YiBQUiBVUkwpXG4gICAgICBsZXQgd29ya3RyZWVQUk51bWJlcjogbnVtYmVyIHwgdW5kZWZpbmVkXG4gICAgICBpZiAod29ya3RyZWVOYW1lKSB7XG4gICAgICAgIGNvbnN0IHByTnVtID0gcGFyc2VQUlJlZmVyZW5jZSh3b3JrdHJlZU5hbWUpXG4gICAgICAgIGlmIChwck51bSAhPT0gbnVsbCkge1xuICAgICAgICAgIHdvcmt0cmVlUFJOdW1iZXIgPSBwck51bVxuICAgICAgICAgIHdvcmt0cmVlTmFtZSA9IHVuZGVmaW5lZCAvLyBzbHVnIHdpbGwgYmUgZ2VuZXJhdGVkIGluIHNldHVwKClcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBFeHRyYWN0IHRtdXggb3B0aW9uIChyZXF1aXJlcyAtLXdvcmt0cmVlKVxuICAgICAgY29uc3QgdG11eEVuYWJsZWQgPVxuICAgICAgICBpc1dvcmt0cmVlTW9kZUVuYWJsZWQoKSAmJiAob3B0aW9ucyBhcyB7IHRtdXg/OiBib29sZWFuIH0pLnRtdXggPT09IHRydWVcblxuICAgICAgLy8gVmFsaWRhdGUgdG11eCBvcHRpb25cbiAgICAgIGlmICh0bXV4RW5hYmxlZCkge1xuICAgICAgICBpZiAoIXdvcmt0cmVlRW5hYmxlZCkge1xuICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKGNoYWxrLnJlZCgnRXJyb3I6IC0tdG11eCByZXF1aXJlcyAtLXdvcmt0cmVlXFxuJykpXG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGdldFBsYXRmb3JtKCkgPT09ICd3aW5kb3dzJykge1xuICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgY2hhbGsucmVkKCdFcnJvcjogLS10bXV4IGlzIG5vdCBzdXBwb3J0ZWQgb24gV2luZG93c1xcbicpLFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuICAgICAgICBpZiAoIShhd2FpdCBpc1RtdXhBdmFpbGFibGUoKSkpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICAgIGNoYWxrLnJlZChcbiAgICAgICAgICAgICAgYEVycm9yOiB0bXV4IGlzIG5vdCBpbnN0YWxsZWQuXFxuJHtnZXRUbXV4SW5zdGFsbEluc3RydWN0aW9ucygpfVxcbmAsXG4gICAgICAgICAgICApLFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBFeHRyYWN0IHRlYW1tYXRlIG9wdGlvbnMgKGZvciB0bXV4LXNwYXduZWQgYWdlbnRzKVxuICAgICAgLy8gRGVjbGFyZWQgb3V0c2lkZSB0aGUgaWYgYmxvY2sgc28gaXQncyBhY2Nlc3NpYmxlIGxhdGVyIGZvciBzeXN0ZW0gcHJvbXB0IGFkZGVuZHVtXG4gICAgICBsZXQgc3RvcmVkVGVhbW1hdGVPcHRzOiBUZWFtbWF0ZU9wdGlvbnMgfCB1bmRlZmluZWRcbiAgICAgIGlmIChpc0FnZW50U3dhcm1zRW5hYmxlZCgpKSB7XG4gICAgICAgIC8vIEV4dHJhY3QgYWdlbnQgaWRlbnRpdHkgb3B0aW9ucyAoZm9yIHRtdXgtc3Bhd25lZCBhZ2VudHMpXG4gICAgICAgIC8vIFRoZXNlIHJlcGxhY2UgdGhlIENMQVVERV9DT0RFXyogZW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgICAgIGNvbnN0IHRlYW1tYXRlT3B0cyA9IGV4dHJhY3RUZWFtbWF0ZU9wdGlvbnMob3B0aW9ucylcbiAgICAgICAgc3RvcmVkVGVhbW1hdGVPcHRzID0gdGVhbW1hdGVPcHRzXG5cbiAgICAgICAgLy8gSWYgYW55IHRlYW1tYXRlIGlkZW50aXR5IG9wdGlvbiBpcyBwcm92aWRlZCwgYWxsIHRocmVlIHJlcXVpcmVkIG9uZXMgbXVzdCBiZSBwcmVzZW50XG4gICAgICAgIGNvbnN0IGhhc0FueVRlYW1tYXRlT3B0ID1cbiAgICAgICAgICB0ZWFtbWF0ZU9wdHMuYWdlbnRJZCB8fFxuICAgICAgICAgIHRlYW1tYXRlT3B0cy5hZ2VudE5hbWUgfHxcbiAgICAgICAgICB0ZWFtbWF0ZU9wdHMudGVhbU5hbWVcbiAgICAgICAgY29uc3QgaGFzQWxsUmVxdWlyZWRUZWFtbWF0ZU9wdHMgPVxuICAgICAgICAgIHRlYW1tYXRlT3B0cy5hZ2VudElkICYmXG4gICAgICAgICAgdGVhbW1hdGVPcHRzLmFnZW50TmFtZSAmJlxuICAgICAgICAgIHRlYW1tYXRlT3B0cy50ZWFtTmFtZVxuXG4gICAgICAgIGlmIChoYXNBbnlUZWFtbWF0ZU9wdCAmJiAhaGFzQWxsUmVxdWlyZWRUZWFtbWF0ZU9wdHMpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICAgIGNoYWxrLnJlZChcbiAgICAgICAgICAgICAgJ0Vycm9yOiAtLWFnZW50LWlkLCAtLWFnZW50LW5hbWUsIGFuZCAtLXRlYW0tbmFtZSBtdXN0IGFsbCBiZSBwcm92aWRlZCB0b2dldGhlclxcbicsXG4gICAgICAgICAgICApLFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHRlYW1tYXRlIGlkZW50aXR5IGlzIHByb3ZpZGVkIHZpYSBDTEksIHNldCB1cCBkeW5hbWljVGVhbUNvbnRleHRcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHRlYW1tYXRlT3B0cy5hZ2VudElkICYmXG4gICAgICAgICAgdGVhbW1hdGVPcHRzLmFnZW50TmFtZSAmJlxuICAgICAgICAgIHRlYW1tYXRlT3B0cy50ZWFtTmFtZVxuICAgICAgICApIHtcbiAgICAgICAgICBnZXRUZWFtbWF0ZVV0aWxzKCkuc2V0RHluYW1pY1RlYW1Db250ZXh0Py4oe1xuICAgICAgICAgICAgYWdlbnRJZDogdGVhbW1hdGVPcHRzLmFnZW50SWQsXG4gICAgICAgICAgICBhZ2VudE5hbWU6IHRlYW1tYXRlT3B0cy5hZ2VudE5hbWUsXG4gICAgICAgICAgICB0ZWFtTmFtZTogdGVhbW1hdGVPcHRzLnRlYW1OYW1lLFxuICAgICAgICAgICAgY29sb3I6IHRlYW1tYXRlT3B0cy5hZ2VudENvbG9yLFxuICAgICAgICAgICAgcGxhbk1vZGVSZXF1aXJlZDogdGVhbW1hdGVPcHRzLnBsYW5Nb2RlUmVxdWlyZWQgPz8gZmFsc2UsXG4gICAgICAgICAgICBwYXJlbnRTZXNzaW9uSWQ6IHRlYW1tYXRlT3B0cy5wYXJlbnRTZXNzaW9uSWQsXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB0ZWFtbWF0ZSBtb2RlIENMSSBvdmVycmlkZSBpZiBwcm92aWRlZFxuICAgICAgICAvLyBUaGlzIG11c3QgYmUgZG9uZSBiZWZvcmUgc2V0dXAoKSBjYXB0dXJlcyB0aGUgc25hcHNob3RcbiAgICAgICAgaWYgKHRlYW1tYXRlT3B0cy50ZWFtbWF0ZU1vZGUpIHtcbiAgICAgICAgICBnZXRUZWFtbWF0ZU1vZGVTbmFwc2hvdCgpLnNldENsaVRlYW1tYXRlTW9kZU92ZXJyaWRlPy4oXG4gICAgICAgICAgICB0ZWFtbWF0ZU9wdHMudGVhbW1hdGVNb2RlLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBFeHRyYWN0IHJlbW90ZSBzZGsgb3B0aW9uc1xuICAgICAgY29uc3Qgc2RrVXJsID0gKG9wdGlvbnMgYXMgeyBzZGtVcmw/OiBzdHJpbmcgfSkuc2RrVXJsID8/IHVuZGVmaW5lZFxuXG4gICAgICAvLyBBbGxvdyBlbnYgdmFyIHRvIGVuYWJsZSBwYXJ0aWFsIG1lc3NhZ2VzICh1c2VkIGJ5IHNhbmRib3ggZ2F0ZXdheSBmb3IgYmFrdSlcbiAgICAgIGNvbnN0IGVmZmVjdGl2ZUluY2x1ZGVQYXJ0aWFsTWVzc2FnZXMgPVxuICAgICAgICBpbmNsdWRlUGFydGlhbE1lc3NhZ2VzIHx8XG4gICAgICAgIGlzRW52VHJ1dGh5KHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0lOQ0xVREVfUEFSVElBTF9NRVNTQUdFUylcblxuICAgICAgLy8gRW5hYmxlIGFsbCBob29rIGV2ZW50IHR5cGVzIHdoZW4gZXhwbGljaXRseSByZXF1ZXN0ZWQgdmlhIFNESyBvcHRpb25cbiAgICAgIC8vIG9yIHdoZW4gcnVubmluZyBpbiBDTEFVREVfQ09ERV9SRU1PVEUgbW9kZSAoQ0NSIG5lZWRzIHRoZW0pLlxuICAgICAgLy8gV2l0aG91dCB0aGlzLCBvbmx5IFNlc3Npb25TdGFydCBhbmQgU2V0dXAgZXZlbnRzIGFyZSBlbWl0dGVkLlxuICAgICAgaWYgKGluY2x1ZGVIb29rRXZlbnRzIHx8IGlzRW52VHJ1dGh5KHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX1JFTU9URSkpIHtcbiAgICAgICAgc2V0QWxsSG9va0V2ZW50c0VuYWJsZWQodHJ1ZSlcbiAgICAgIH1cblxuICAgICAgLy8gQXV0by1zZXQgaW5wdXQvb3V0cHV0IGZvcm1hdHMsIHZlcmJvc2UgbW9kZSwgYW5kIHByaW50IG1vZGUgd2hlbiBTREsgVVJMIGlzIHByb3ZpZGVkXG4gICAgICBpZiAoc2RrVXJsKSB7XG4gICAgICAgIC8vIElmIFNESyBVUkwgaXMgcHJvdmlkZWQsIGF1dG9tYXRpY2FsbHkgdXNlIHN0cmVhbS1qc29uIGZvcm1hdHMgdW5sZXNzIGV4cGxpY2l0bHkgc2V0XG4gICAgICAgIGlmICghaW5wdXRGb3JtYXQpIHtcbiAgICAgICAgICBpbnB1dEZvcm1hdCA9ICdzdHJlYW0tanNvbidcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW91dHB1dEZvcm1hdCkge1xuICAgICAgICAgIG91dHB1dEZvcm1hdCA9ICdzdHJlYW0tanNvbidcbiAgICAgICAgfVxuICAgICAgICAvLyBBdXRvLWVuYWJsZSB2ZXJib3NlIG1vZGUgdW5sZXNzIGV4cGxpY2l0bHkgZGlzYWJsZWQgb3IgYWxyZWFkeSBzZXRcbiAgICAgICAgaWYgKG9wdGlvbnMudmVyYm9zZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmVyYm9zZSA9IHRydWVcbiAgICAgICAgfVxuICAgICAgICAvLyBBdXRvLWVuYWJsZSBwcmludCBtb2RlIHVubGVzcyBleHBsaWNpdGx5IGRpc2FibGVkXG4gICAgICAgIGlmICghb3B0aW9ucy5wcmludCkge1xuICAgICAgICAgIHByaW50ID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEV4dHJhY3QgdGVsZXBvcnQgb3B0aW9uXG4gICAgICBjb25zdCB0ZWxlcG9ydCA9XG4gICAgICAgIChvcHRpb25zIGFzIHsgdGVsZXBvcnQ/OiBzdHJpbmcgfCB0cnVlIH0pLnRlbGVwb3J0ID8/IG51bGxcblxuICAgICAgLy8gRXh0cmFjdCByZW1vdGUgb3B0aW9uIChjYW4gYmUgdHJ1ZSBpZiBubyBkZXNjcmlwdGlvbiBwcm92aWRlZCwgb3IgYSBzdHJpbmcpXG4gICAgICBjb25zdCByZW1vdGVPcHRpb24gPSAob3B0aW9ucyBhcyB7IHJlbW90ZT86IHN0cmluZyB8IHRydWUgfSkucmVtb3RlXG4gICAgICBjb25zdCByZW1vdGUgPSByZW1vdGVPcHRpb24gPT09IHRydWUgPyAnJyA6IChyZW1vdGVPcHRpb24gPz8gbnVsbClcblxuICAgICAgLy8gRXh0cmFjdCAtLXJlbW90ZS1jb250cm9sIC8gLS1yYyBmbGFnIChlbmFibGUgYnJpZGdlIGluIGludGVyYWN0aXZlIHNlc3Npb24pXG4gICAgICBjb25zdCByZW1vdGVDb250cm9sT3B0aW9uID1cbiAgICAgICAgKG9wdGlvbnMgYXMgeyByZW1vdGVDb250cm9sPzogc3RyaW5nIHwgdHJ1ZSB9KS5yZW1vdGVDb250cm9sID8/XG4gICAgICAgIChvcHRpb25zIGFzIHsgcmM/OiBzdHJpbmcgfCB0cnVlIH0pLnJjXG4gICAgICAvLyBBY3R1YWwgYnJpZGdlIGNoZWNrIGlzIGRlZmVycmVkIHRvIGFmdGVyIHNob3dTZXR1cFNjcmVlbnMoKSBzbyB0aGF0XG4gICAgICAvLyB0cnVzdCBpcyBlc3RhYmxpc2hlZCBhbmQgR3Jvd3RoQm9vayBoYXMgYXV0aCBoZWFkZXJzLlxuICAgICAgbGV0IHJlbW90ZUNvbnRyb2wgPSBmYWxzZVxuICAgICAgY29uc3QgcmVtb3RlQ29udHJvbE5hbWUgPVxuICAgICAgICB0eXBlb2YgcmVtb3RlQ29udHJvbE9wdGlvbiA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgcmVtb3RlQ29udHJvbE9wdGlvbi5sZW5ndGggPiAwXG4gICAgICAgICAgPyByZW1vdGVDb250cm9sT3B0aW9uXG4gICAgICAgICAgOiB1bmRlZmluZWRcblxuICAgICAgLy8gVmFsaWRhdGUgc2Vzc2lvbiBJRCBpZiBwcm92aWRlZFxuICAgICAgaWYgKHNlc3Npb25JZCkge1xuICAgICAgICAvLyBDaGVjayBmb3IgY29uZmxpY3RpbmcgZmxhZ3NcbiAgICAgICAgLy8gLS1zZXNzaW9uLWlkIGNhbiBiZSB1c2VkIHdpdGggLS1jb250aW51ZSBvciAtLXJlc3VtZSB3aGVuIC0tZm9yay1zZXNzaW9uIGlzIGFsc28gcHJvdmlkZWRcbiAgICAgICAgLy8gKHRvIHNwZWNpZnkgYSBjdXN0b20gSUQgZm9yIHRoZSBmb3JrZWQgc2Vzc2lvbilcbiAgICAgICAgaWYgKChvcHRpb25zLmNvbnRpbnVlIHx8IG9wdGlvbnMucmVzdW1lKSAmJiAhb3B0aW9ucy5mb3JrU2Vzc2lvbikge1xuICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgY2hhbGsucmVkKFxuICAgICAgICAgICAgICAnRXJyb3I6IC0tc2Vzc2lvbi1pZCBjYW4gb25seSBiZSB1c2VkIHdpdGggLS1jb250aW51ZSBvciAtLXJlc3VtZSBpZiAtLWZvcmstc2Vzc2lvbiBpcyBhbHNvIHNwZWNpZmllZC5cXG4nLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICApXG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaGVuIC0tc2RrLXVybCBpcyBwcm92aWRlZCAoYnJpZGdlL3JlbW90ZSBtb2RlKSwgdGhlIHNlc3Npb24gSUQgaXMgYVxuICAgICAgICAvLyBzZXJ2ZXItYXNzaWduZWQgdGFnZ2VkIElEIChlLmcuIFwic2Vzc2lvbl9sb2NhbF8wMS4uLlwiKSByYXRoZXIgdGhhbiBhXG4gICAgICAgIC8vIFVVSUQuIFNraXAgVVVJRCB2YWxpZGF0aW9uIGFuZCBsb2NhbCBleGlzdGVuY2UgY2hlY2tzIGluIHRoYXQgY2FzZS5cbiAgICAgICAgaWYgKCFzZGtVcmwpIHtcbiAgICAgICAgICBjb25zdCB2YWxpZGF0ZWRTZXNzaW9uSWQgPSB2YWxpZGF0ZVV1aWQoc2Vzc2lvbklkKVxuICAgICAgICAgIGlmICghdmFsaWRhdGVkU2Vzc2lvbklkKSB7XG4gICAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICAgICAgY2hhbGsucmVkKCdFcnJvcjogSW52YWxpZCBzZXNzaW9uIElELiBNdXN0IGJlIGEgdmFsaWQgVVVJRC5cXG4nKSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIENoZWNrIGlmIHNlc3Npb24gSUQgYWxyZWFkeSBleGlzdHNcbiAgICAgICAgICBpZiAoc2Vzc2lvbklkRXhpc3RzKHZhbGlkYXRlZFNlc3Npb25JZCkpIHtcbiAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgICBjaGFsay5yZWQoXG4gICAgICAgICAgICAgICAgYEVycm9yOiBTZXNzaW9uIElEICR7dmFsaWRhdGVkU2Vzc2lvbklkfSBpcyBhbHJlYWR5IGluIHVzZS5cXG5gLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIERvd25sb2FkIGZpbGUgcmVzb3VyY2VzIGlmIHNwZWNpZmllZCB2aWEgLS1maWxlIGZsYWdcbiAgICAgIGNvbnN0IGZpbGVTcGVjcyA9IChvcHRpb25zIGFzIHsgZmlsZT86IHN0cmluZ1tdIH0pLmZpbGVcbiAgICAgIGlmIChmaWxlU3BlY3MgJiYgZmlsZVNwZWNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gR2V0IHNlc3Npb24gaW5ncmVzcyB0b2tlbiAocHJvdmlkZWQgYnkgRW52TWFuYWdlciB2aWEgQ0xBVURFX0NPREVfU0VTU0lPTl9BQ0NFU1NfVE9LRU4pXG4gICAgICAgIGNvbnN0IHNlc3Npb25Ub2tlbiA9IGdldFNlc3Npb25JbmdyZXNzQXV0aFRva2VuKClcbiAgICAgICAgaWYgKCFzZXNzaW9uVG9rZW4pIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICAgIGNoYWxrLnJlZChcbiAgICAgICAgICAgICAgJ0Vycm9yOiBTZXNzaW9uIHRva2VuIHJlcXVpcmVkIGZvciBmaWxlIGRvd25sb2Fkcy4gQ0xBVURFX0NPREVfU0VTU0lPTl9BQ0NFU1NfVE9LRU4gbXVzdCBiZSBzZXQuXFxuJyxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKVxuICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBzZXNzaW9uIElEOiBwcmVmZXIgcmVtb3RlIHNlc3Npb24gSUQsIGZhbGwgYmFjayB0byBpbnRlcm5hbCBzZXNzaW9uIElEXG4gICAgICAgIGNvbnN0IGZpbGVTZXNzaW9uSWQgPVxuICAgICAgICAgIHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX1JFTU9URV9TRVNTSU9OX0lEIHx8IGdldFNlc3Npb25JZCgpXG5cbiAgICAgICAgY29uc3QgZmlsZXMgPSBwYXJzZUZpbGVTcGVjcyhmaWxlU3BlY3MpXG4gICAgICAgIGlmIChmaWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgLy8gVXNlIEFOVEhST1BJQ19CQVNFX1VSTCBpZiBzZXQgKGJ5IEVudk1hbmFnZXIpLCBvdGhlcndpc2UgdXNlIE9BdXRoIGNvbmZpZ1xuICAgICAgICAgIC8vIFRoaXMgZW5zdXJlcyBjb25zaXN0ZW5jeSB3aXRoIHNlc3Npb24gaW5ncmVzcyBBUEkgaW4gYWxsIGVudmlyb25tZW50c1xuICAgICAgICAgIGNvbnN0IGNvbmZpZzogRmlsZXNBcGlDb25maWcgPSB7XG4gICAgICAgICAgICBiYXNlVXJsOlxuICAgICAgICAgICAgICBwcm9jZXNzLmVudi5BTlRIUk9QSUNfQkFTRV9VUkwgfHwgZ2V0T2F1dGhDb25maWcoKS5CQVNFX0FQSV9VUkwsXG4gICAgICAgICAgICBvYXV0aFRva2VuOiBzZXNzaW9uVG9rZW4sXG4gICAgICAgICAgICBzZXNzaW9uSWQ6IGZpbGVTZXNzaW9uSWQsXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gU3RhcnQgZG93bmxvYWQgd2l0aG91dCBibG9ja2luZyBzdGFydHVwIC0gYXdhaXQgYmVmb3JlIFJFUEwgcmVuZGVyc1xuICAgICAgICAgIGZpbGVEb3dubG9hZFByb21pc2UgPSBkb3dubG9hZFNlc3Npb25GaWxlcyhmaWxlcywgY29uZmlnKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEdldCBpc05vbkludGVyYWN0aXZlU2Vzc2lvbiBmcm9tIHN0YXRlICh3YXMgc2V0IGJlZm9yZSBpbml0KCkpXG4gICAgICBjb25zdCBpc05vbkludGVyYWN0aXZlU2Vzc2lvbiA9IGdldElzTm9uSW50ZXJhY3RpdmVTZXNzaW9uKClcblxuICAgICAgLy8gVmFsaWRhdGUgdGhhdCBmYWxsYmFjayBtb2RlbCBpcyBkaWZmZXJlbnQgZnJvbSBtYWluIG1vZGVsXG4gICAgICBpZiAoZmFsbGJhY2tNb2RlbCAmJiBvcHRpb25zLm1vZGVsICYmIGZhbGxiYWNrTW9kZWwgPT09IG9wdGlvbnMubW9kZWwpIHtcbiAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgICAgY2hhbGsucmVkKFxuICAgICAgICAgICAgJ0Vycm9yOiBGYWxsYmFjayBtb2RlbCBjYW5ub3QgYmUgdGhlIHNhbWUgYXMgdGhlIG1haW4gbW9kZWwuIFBsZWFzZSBzcGVjaWZ5IGEgZGlmZmVyZW50IG1vZGVsIGZvciAtLWZhbGxiYWNrLW1vZGVsLlxcbicsXG4gICAgICAgICAgKSxcbiAgICAgICAgKVxuICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIHN5c3RlbSBwcm9tcHQgb3B0aW9uc1xuICAgICAgbGV0IHN5c3RlbVByb21wdCA9IG9wdGlvbnMuc3lzdGVtUHJvbXB0XG4gICAgICBpZiAob3B0aW9ucy5zeXN0ZW1Qcm9tcHRGaWxlKSB7XG4gICAgICAgIGlmIChvcHRpb25zLnN5c3RlbVByb21wdCkge1xuICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgY2hhbGsucmVkKFxuICAgICAgICAgICAgICAnRXJyb3I6IENhbm5vdCB1c2UgYm90aCAtLXN5c3RlbS1wcm9tcHQgYW5kIC0tc3lzdGVtLXByb21wdC1maWxlLiBQbGVhc2UgdXNlIG9ubHkgb25lLlxcbicsXG4gICAgICAgICAgICApLFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgZmlsZVBhdGggPSByZXNvbHZlKG9wdGlvbnMuc3lzdGVtUHJvbXB0RmlsZSlcbiAgICAgICAgICBzeXN0ZW1Qcm9tcHQgPSByZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGY4JylcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBjb2RlID0gZ2V0RXJybm9Db2RlKGVycm9yKVxuICAgICAgICAgIGlmIChjb2RlID09PSAnRU5PRU5UJykge1xuICAgICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgICAgICAgIGNoYWxrLnJlZChcbiAgICAgICAgICAgICAgICBgRXJyb3I6IFN5c3RlbSBwcm9tcHQgZmlsZSBub3QgZm91bmQ6ICR7cmVzb2x2ZShvcHRpb25zLnN5c3RlbVByb21wdEZpbGUpfVxcbmAsXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgICAgICBjaGFsay5yZWQoXG4gICAgICAgICAgICAgIGBFcnJvciByZWFkaW5nIHN5c3RlbSBwcm9tcHQgZmlsZTogJHtlcnJvck1lc3NhZ2UoZXJyb3IpfVxcbmAsXG4gICAgICAgICAgICApLFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBIYW5kbGUgYXBwZW5kIHN5c3RlbSBwcm9tcHQgb3B0aW9uc1xuICAgICAgbGV0IGFwcGVuZFN5c3RlbVByb21wdCA9IG9wdGlvbnMuYXBwZW5kU3lzdGVtUHJvbXB0XG4gICAgICBpZiAob3B0aW9ucy5hcHBlbmRTeXN0ZW1Qcm9tcHRGaWxlKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmFwcGVuZFN5c3RlbVByb21wdCkge1xuICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgY2hhbGsucmVkKFxuICAgICAgICAgICAgICAnRXJyb3I6IENhbm5vdCB1c2UgYm90aCAtLWFwcGVuZC1zeXN0ZW0tcHJvbXB0IGFuZCAtLWFwcGVuZC1zeXN0ZW0tcHJvbXB0LWZpbGUuIFBsZWFzZSB1c2Ugb25seSBvbmUuXFxuJyxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKVxuICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHJlc29sdmUob3B0aW9ucy5hcHBlbmRTeXN0ZW1Qcm9tcHRGaWxlKVxuICAgICAgICAgIGFwcGVuZFN5c3RlbVByb21wdCA9IHJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0ZjgnKVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnN0IGNvZGUgPSBnZXRFcnJub0NvZGUoZXJyb3IpXG4gICAgICAgICAgaWYgKGNvZGUgPT09ICdFTk9FTlQnKSB7XG4gICAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICAgICAgY2hhbGsucmVkKFxuICAgICAgICAgICAgICAgIGBFcnJvcjogQXBwZW5kIHN5c3RlbSBwcm9tcHQgZmlsZSBub3QgZm91bmQ6ICR7cmVzb2x2ZShvcHRpb25zLmFwcGVuZFN5c3RlbVByb21wdEZpbGUpfVxcbmAsXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgICAgICBjaGFsay5yZWQoXG4gICAgICAgICAgICAgIGBFcnJvciByZWFkaW5nIGFwcGVuZCBzeXN0ZW0gcHJvbXB0IGZpbGU6ICR7ZXJyb3JNZXNzYWdlKGVycm9yKX1cXG5gLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICApXG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQWRkIHRlYW1tYXRlLXNwZWNpZmljIHN5c3RlbSBwcm9tcHQgYWRkZW5kdW0gZm9yIHRtdXggdGVhbW1hdGVzXG4gICAgICBpZiAoXG4gICAgICAgIGlzQWdlbnRTd2FybXNFbmFibGVkKCkgJiZcbiAgICAgICAgc3RvcmVkVGVhbW1hdGVPcHRzPy5hZ2VudElkICYmXG4gICAgICAgIHN0b3JlZFRlYW1tYXRlT3B0cz8uYWdlbnROYW1lICYmXG4gICAgICAgIHN0b3JlZFRlYW1tYXRlT3B0cz8udGVhbU5hbWVcbiAgICAgICkge1xuICAgICAgICBjb25zdCBhZGRlbmR1bSA9XG4gICAgICAgICAgZ2V0VGVhbW1hdGVQcm9tcHRBZGRlbmR1bSgpLlRFQU1NQVRFX1NZU1RFTV9QUk9NUFRfQURERU5EVU1cbiAgICAgICAgYXBwZW5kU3lzdGVtUHJvbXB0ID0gYXBwZW5kU3lzdGVtUHJvbXB0XG4gICAgICAgICAgPyBgJHthcHBlbmRTeXN0ZW1Qcm9tcHR9XFxuXFxuJHthZGRlbmR1bX1gXG4gICAgICAgICAgOiBhZGRlbmR1bVxuICAgICAgfVxuXG4gICAgICBjb25zdCB7IG1vZGU6IHBlcm1pc3Npb25Nb2RlLCBub3RpZmljYXRpb246IHBlcm1pc3Npb25Nb2RlTm90aWZpY2F0aW9uIH0gPVxuICAgICAgICBpbml0aWFsUGVybWlzc2lvbk1vZGVGcm9tQ0xJKHtcbiAgICAgICAgICBwZXJtaXNzaW9uTW9kZUNsaSxcbiAgICAgICAgICBkYW5nZXJvdXNseVNraXBQZXJtaXNzaW9ucyxcbiAgICAgICAgfSlcblxuICAgICAgLy8gU3RvcmUgc2Vzc2lvbiBieXBhc3MgcGVybWlzc2lvbnMgbW9kZSBmb3IgdHJ1c3QgZGlhbG9nIGNoZWNrXG4gICAgICBzZXRTZXNzaW9uQnlwYXNzUGVybWlzc2lvbnNNb2RlKHBlcm1pc3Npb25Nb2RlID09PSAnYnlwYXNzUGVybWlzc2lvbnMnKVxuICAgICAgaWYgKGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpKSB7XG4gICAgICAgIC8vIGF1dG9Nb2RlRmxhZ0NsaSBpcyB0aGUgXCJkaWQgdGhlIHVzZXIgaW50ZW5kIGF1dG8gdGhpcyBzZXNzaW9uXCIgc2lnbmFsLlxuICAgICAgICAvLyBTZXQgd2hlbjogLS1lbmFibGUtYXV0by1tb2RlLCAtLXBlcm1pc3Npb24tbW9kZSBhdXRvLCByZXNvbHZlZCBtb2RlXG4gICAgICAgIC8vIGlzIGF1dG8sIE9SIHNldHRpbmdzIGRlZmF1bHRNb2RlIGlzIGF1dG8gYnV0IHRoZSBnYXRlIGRlbmllZCBpdFxuICAgICAgICAvLyAocGVybWlzc2lvbk1vZGUgcmVzb2x2ZWQgdG8gZGVmYXVsdCB3aXRoIG5vIGV4cGxpY2l0IENMSSBvdmVycmlkZSkuXG4gICAgICAgIC8vIFVzZWQgYnkgdmVyaWZ5QXV0b01vZGVHYXRlQWNjZXNzIHRvIGRlY2lkZSB3aGV0aGVyIHRvIG5vdGlmeSBvblxuICAgICAgICAvLyBhdXRvLXVuYXZhaWxhYmxlLCBhbmQgYnkgdGVuZ3VfYXV0b19tb2RlX2NvbmZpZyBvcHQtaW4gY2Fyb3VzZWwuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAob3B0aW9ucyBhcyB7IGVuYWJsZUF1dG9Nb2RlPzogYm9vbGVhbiB9KS5lbmFibGVBdXRvTW9kZSB8fFxuICAgICAgICAgIHBlcm1pc3Npb25Nb2RlQ2xpID09PSAnYXV0bycgfHxcbiAgICAgICAgICBwZXJtaXNzaW9uTW9kZSA9PT0gJ2F1dG8nIHx8XG4gICAgICAgICAgKCFwZXJtaXNzaW9uTW9kZUNsaSAmJiBpc0RlZmF1bHRQZXJtaXNzaW9uTW9kZUF1dG8oKSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgYXV0b01vZGVTdGF0ZU1vZHVsZT8uc2V0QXV0b01vZGVGbGFnQ2xpKHRydWUpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gUGFyc2UgdGhlIE1DUCBjb25maWcgZmlsZXMvc3RyaW5ncyBpZiBwcm92aWRlZFxuICAgICAgbGV0IGR5bmFtaWNNY3BDb25maWc6IFJlY29yZDxzdHJpbmcsIFNjb3BlZE1jcFNlcnZlckNvbmZpZz4gPSB7fVxuXG4gICAgICBpZiAobWNwQ29uZmlnICYmIG1jcENvbmZpZy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIFByb2Nlc3MgbWNwQ29uZmlnIGFycmF5XG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZENvbmZpZ3MgPSBtY3BDb25maWdcbiAgICAgICAgICAubWFwKGNvbmZpZyA9PiBjb25maWcudHJpbSgpKVxuICAgICAgICAgIC5maWx0ZXIoY29uZmlnID0+IGNvbmZpZy5sZW5ndGggPiAwKVxuXG4gICAgICAgIGxldCBhbGxDb25maWdzOiBSZWNvcmQ8c3RyaW5nLCBNY3BTZXJ2ZXJDb25maWc+ID0ge31cbiAgICAgICAgY29uc3QgYWxsRXJyb3JzOiBWYWxpZGF0aW9uRXJyb3JbXSA9IFtdXG5cbiAgICAgICAgZm9yIChjb25zdCBjb25maWdJdGVtIG9mIHByb2Nlc3NlZENvbmZpZ3MpIHtcbiAgICAgICAgICBsZXQgY29uZmlnczogUmVjb3JkPHN0cmluZywgTWNwU2VydmVyQ29uZmlnPiB8IG51bGwgPSBudWxsXG4gICAgICAgICAgbGV0IGVycm9yczogVmFsaWRhdGlvbkVycm9yW10gPSBbXVxuXG4gICAgICAgICAgLy8gRmlyc3QgdHJ5IHRvIHBhcnNlIGFzIEpTT04gc3RyaW5nXG4gICAgICAgICAgY29uc3QgcGFyc2VkSnNvbiA9IHNhZmVQYXJzZUpTT04oY29uZmlnSXRlbSlcbiAgICAgICAgICBpZiAocGFyc2VkSnNvbikge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gcGFyc2VNY3BDb25maWcoe1xuICAgICAgICAgICAgICBjb25maWdPYmplY3Q6IHBhcnNlZEpzb24sXG4gICAgICAgICAgICAgIGZpbGVQYXRoOiAnY29tbWFuZCBsaW5lJyxcbiAgICAgICAgICAgICAgZXhwYW5kVmFyczogdHJ1ZSxcbiAgICAgICAgICAgICAgc2NvcGU6ICdkeW5hbWljJyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBpZiAocmVzdWx0LmNvbmZpZykge1xuICAgICAgICAgICAgICBjb25maWdzID0gcmVzdWx0LmNvbmZpZy5tY3BTZXJ2ZXJzXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBlcnJvcnMgPSByZXN1bHQuZXJyb3JzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRyeSBhcyBmaWxlIHBhdGhcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ1BhdGggPSByZXNvbHZlKGNvbmZpZ0l0ZW0pXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBwYXJzZU1jcENvbmZpZ0Zyb21GaWxlUGF0aCh7XG4gICAgICAgICAgICAgIGZpbGVQYXRoOiBjb25maWdQYXRoLFxuICAgICAgICAgICAgICBleHBhbmRWYXJzOiB0cnVlLFxuICAgICAgICAgICAgICBzY29wZTogJ2R5bmFtaWMnLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGlmIChyZXN1bHQuY29uZmlnKSB7XG4gICAgICAgICAgICAgIGNvbmZpZ3MgPSByZXN1bHQuY29uZmlnLm1jcFNlcnZlcnNcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGVycm9ycyA9IHJlc3VsdC5lcnJvcnNcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGFsbEVycm9ycy5wdXNoKC4uLmVycm9ycylcbiAgICAgICAgICB9IGVsc2UgaWYgKGNvbmZpZ3MpIHtcbiAgICAgICAgICAgIC8vIE1lcmdlIGNvbmZpZ3MsIGxhdGVyIG9uZXMgb3ZlcnJpZGUgZWFybGllciBvbmVzXG4gICAgICAgICAgICBhbGxDb25maWdzID0geyAuLi5hbGxDb25maWdzLCAuLi5jb25maWdzIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWxsRXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCBmb3JtYXR0ZWRFcnJvcnMgPSBhbGxFcnJvcnNcbiAgICAgICAgICAgIC5tYXAoZXJyID0+IGAke2Vyci5wYXRoID8gZXJyLnBhdGggKyAnOiAnIDogJyd9JHtlcnIubWVzc2FnZX1gKVxuICAgICAgICAgICAgLmpvaW4oJ1xcbicpXG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgYC0tbWNwLWNvbmZpZyB2YWxpZGF0aW9uIGZhaWxlZCAoJHthbGxFcnJvcnMubGVuZ3RofSBlcnJvcnMpOiAke2Zvcm1hdHRlZEVycm9yc31gLFxuICAgICAgICAgICAgeyBsZXZlbDogJ2Vycm9yJyB9LFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICAgIGBFcnJvcjogSW52YWxpZCBNQ1AgY29uZmlndXJhdGlvbjpcXG4ke2Zvcm1hdHRlZEVycm9yc31cXG5gLFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhhbGxDb25maWdzKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgLy8gU0RLIGhvc3RzIChOZXN0L0Rlc2t0b3ApIG93biB0aGVpciBzZXJ2ZXIgbmFtaW5nIGFuZCBtYXkgcmV1c2VcbiAgICAgICAgICAvLyBidWlsdC1pbiBuYW1lcyDigJQgc2tpcCByZXNlcnZlZC1uYW1lIGNoZWNrcyBmb3IgdHlwZTonc2RrJy5cbiAgICAgICAgICBjb25zdCBub25TZGtDb25maWdOYW1lcyA9IE9iamVjdC5lbnRyaWVzKGFsbENvbmZpZ3MpXG4gICAgICAgICAgICAuZmlsdGVyKChbLCBjb25maWddKSA9PiBjb25maWcudHlwZSAhPT0gJ3NkaycpXG4gICAgICAgICAgICAubWFwKChbbmFtZV0pID0+IG5hbWUpXG5cbiAgICAgICAgICBsZXQgcmVzZXJ2ZWROYW1lRXJyb3I6IHN0cmluZyB8IG51bGwgPSBudWxsXG4gICAgICAgICAgaWYgKG5vblNka0NvbmZpZ05hbWVzLnNvbWUoaXNDbGF1ZGVJbkNocm9tZU1DUFNlcnZlcikpIHtcbiAgICAgICAgICAgIHJlc2VydmVkTmFtZUVycm9yID0gYEludmFsaWQgTUNQIGNvbmZpZ3VyYXRpb246IFwiJHtDTEFVREVfSU5fQ0hST01FX01DUF9TRVJWRVJfTkFNRX1cIiBpcyBhIHJlc2VydmVkIE1DUCBuYW1lLmBcbiAgICAgICAgICB9IGVsc2UgaWYgKGZlYXR1cmUoJ0NISUNBR09fTUNQJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgaXNDb21wdXRlclVzZU1DUFNlcnZlciwgQ09NUFVURVJfVVNFX01DUF9TRVJWRVJfTkFNRSB9ID1cbiAgICAgICAgICAgICAgYXdhaXQgaW1wb3J0KCdzcmMvdXRpbHMvY29tcHV0ZXJVc2UvY29tbW9uLmpzJylcbiAgICAgICAgICAgIGlmIChub25TZGtDb25maWdOYW1lcy5zb21lKGlzQ29tcHV0ZXJVc2VNQ1BTZXJ2ZXIpKSB7XG4gICAgICAgICAgICAgIHJlc2VydmVkTmFtZUVycm9yID0gYEludmFsaWQgTUNQIGNvbmZpZ3VyYXRpb246IFwiJHtDT01QVVRFUl9VU0VfTUNQX1NFUlZFUl9OQU1FfVwiIGlzIGEgcmVzZXJ2ZWQgTUNQIG5hbWUuYFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocmVzZXJ2ZWROYW1lRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIHN0ZGVycitleGl0KDEpIOKAlCBhIHRocm93IGhlcmUgYmVjb21lcyBhIHNpbGVudCB1bmhhbmRsZWRcbiAgICAgICAgICAgIC8vIHJlamVjdGlvbiBpbiBzdHJlYW0tanNvbiBtb2RlICh2b2lkIG1haW4oKSBpbiBjbGkudHN4KS5cbiAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKGBFcnJvcjogJHtyZXNlcnZlZE5hbWVFcnJvcn1cXG5gKVxuICAgICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQWRkIGR5bmFtaWMgc2NvcGUgdG8gYWxsIGNvbmZpZ3MuIHR5cGU6J3NkaycgZW50cmllcyBwYXNzIHRocm91Z2hcbiAgICAgICAgICAvLyB1bmNoYW5nZWQg4oCUIHRoZXkncmUgZXh0cmFjdGVkIGludG8gc2RrTWNwQ29uZmlncyBkb3duc3RyZWFtIGFuZFxuICAgICAgICAgIC8vIHBhc3NlZCB0byBwcmludC50cy4gVGhlIFB5dGhvbiBTREsgcmVsaWVzIG9uIHRoaXMgcGF0aCAoaXQgZG9lc24ndFxuICAgICAgICAgIC8vIHNlbmQgc2RrTWNwU2VydmVycyBpbiB0aGUgaW5pdGlhbGl6ZSBtZXNzYWdlKS4gRHJvcHBpbmcgdGhlbSBoZXJlXG4gICAgICAgICAgLy8gYnJva2UgQ293b3JrZXIgKGluYy01MTIyKS4gVGhlIHBvbGljeSBmaWx0ZXIgYmVsb3cgYWxyZWFkeSBleGVtcHRzXG4gICAgICAgICAgLy8gdHlwZTonc2RrJywgYW5kIHRoZSBlbnRyaWVzIGFyZSBpbmVydCB3aXRob3V0IGFuIFNESyB0cmFuc3BvcnQgb25cbiAgICAgICAgICAvLyBzdGRpbiwgc28gdGhlcmUncyBubyBieXBhc3MgcmlzayBmcm9tIGxldHRpbmcgdGhlbSB0aHJvdWdoLlxuICAgICAgICAgIGNvbnN0IHNjb3BlZENvbmZpZ3MgPSBtYXBWYWx1ZXMoYWxsQ29uZmlncywgY29uZmlnID0+ICh7XG4gICAgICAgICAgICAuLi5jb25maWcsXG4gICAgICAgICAgICBzY29wZTogJ2R5bmFtaWMnIGFzIGNvbnN0LFxuICAgICAgICAgIH0pKVxuXG4gICAgICAgICAgLy8gRW5mb3JjZSBtYW5hZ2VkIHBvbGljeSAoYWxsb3dlZE1jcFNlcnZlcnMgLyBkZW5pZWRNY3BTZXJ2ZXJzKSBvblxuICAgICAgICAgIC8vIC0tbWNwLWNvbmZpZyBzZXJ2ZXJzLiBXaXRob3V0IHRoaXMsIHRoZSBDTEkgZmxhZyBieXBhc3NlcyB0aGVcbiAgICAgICAgICAvLyBlbnRlcnByaXNlIGFsbG93bGlzdCB0aGF0IHVzZXIvcHJvamVjdC9sb2NhbCBjb25maWdzIGdvIHRocm91Z2ggaW5cbiAgICAgICAgICAvLyBnZXRDbGF1ZGVDb2RlTWNwQ29uZmlncyDigJQgY2FsbGVycyBzcHJlYWQgZHluYW1pY01jcENvbmZpZyBiYWNrIG9uXG4gICAgICAgICAgLy8gdG9wIG9mIGZpbHRlcmVkIHJlc3VsdHMuIEZpbHRlciBoZXJlIGF0IHRoZSBzb3VyY2Ugc28gYWxsXG4gICAgICAgICAgLy8gZG93bnN0cmVhbSBjb25zdW1lcnMgc2VlIHRoZSBwb2xpY3ktZmlsdGVyZWQgc2V0LlxuICAgICAgICAgIGNvbnN0IHsgYWxsb3dlZCwgYmxvY2tlZCB9ID0gZmlsdGVyTWNwU2VydmVyc0J5UG9saWN5KHNjb3BlZENvbmZpZ3MpXG4gICAgICAgICAgaWYgKGJsb2NrZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgICAgICAgIGBXYXJuaW5nOiBNQ1AgJHtwbHVyYWwoYmxvY2tlZC5sZW5ndGgsICdzZXJ2ZXInKX0gYmxvY2tlZCBieSBlbnRlcnByaXNlIHBvbGljeTogJHtibG9ja2VkLmpvaW4oJywgJyl9XFxuYCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgICAgZHluYW1pY01jcENvbmZpZyA9IHsgLi4uZHluYW1pY01jcENvbmZpZywgLi4uYWxsb3dlZCB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRXh0cmFjdCBDbGF1ZGUgaW4gQ2hyb21lIG9wdGlvbiBhbmQgZW5mb3JjZSBjbGF1ZGUuYWkgc3Vic2NyaWJlciBjaGVjayAodW5sZXNzIHVzZXIgaXMgYW50KVxuICAgICAgY29uc3QgY2hyb21lT3B0cyA9IG9wdGlvbnMgYXMgeyBjaHJvbWU/OiBib29sZWFuIH1cbiAgICAgIC8vIFN0b3JlIHRoZSBleHBsaWNpdCBDTEkgZmxhZyBzbyB0ZWFtbWF0ZXMgY2FuIGluaGVyaXQgaXRcbiAgICAgIHNldENocm9tZUZsYWdPdmVycmlkZShjaHJvbWVPcHRzLmNocm9tZSlcbiAgICAgIGNvbnN0IGVuYWJsZUNsYXVkZUluQ2hyb21lID1cbiAgICAgICAgc2hvdWxkRW5hYmxlQ2xhdWRlSW5DaHJvbWUoY2hyb21lT3B0cy5jaHJvbWUpICYmXG4gICAgICAgIChcImV4dGVybmFsXCIgPT09ICdhbnQnIHx8IGlzQ2xhdWRlQUlTdWJzY3JpYmVyKCkpXG4gICAgICBjb25zdCBhdXRvRW5hYmxlQ2xhdWRlSW5DaHJvbWUgPVxuICAgICAgICAhZW5hYmxlQ2xhdWRlSW5DaHJvbWUgJiYgc2hvdWxkQXV0b0VuYWJsZUNsYXVkZUluQ2hyb21lKClcblxuICAgICAgaWYgKGVuYWJsZUNsYXVkZUluQ2hyb21lKSB7XG4gICAgICAgIGNvbnN0IHBsYXRmb3JtID0gZ2V0UGxhdGZvcm0oKVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9jbGF1ZGVfaW5fY2hyb21lX3NldHVwJywge1xuICAgICAgICAgICAgcGxhdGZvcm06XG4gICAgICAgICAgICAgIHBsYXRmb3JtIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgfSlcblxuICAgICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIG1jcENvbmZpZzogY2hyb21lTWNwQ29uZmlnLFxuICAgICAgICAgICAgYWxsb3dlZFRvb2xzOiBjaHJvbWVNY3BUb29scyxcbiAgICAgICAgICAgIHN5c3RlbVByb21wdDogY2hyb21lU3lzdGVtUHJvbXB0LFxuICAgICAgICAgIH0gPSBzZXR1cENsYXVkZUluQ2hyb21lKClcbiAgICAgICAgICBkeW5hbWljTWNwQ29uZmlnID0geyAuLi5keW5hbWljTWNwQ29uZmlnLCAuLi5jaHJvbWVNY3BDb25maWcgfVxuICAgICAgICAgIGFsbG93ZWRUb29scy5wdXNoKC4uLmNocm9tZU1jcFRvb2xzKVxuICAgICAgICAgIGlmIChjaHJvbWVTeXN0ZW1Qcm9tcHQpIHtcbiAgICAgICAgICAgIGFwcGVuZFN5c3RlbVByb21wdCA9IGFwcGVuZFN5c3RlbVByb21wdFxuICAgICAgICAgICAgICA/IGAke2Nocm9tZVN5c3RlbVByb21wdH1cXG5cXG4ke2FwcGVuZFN5c3RlbVByb21wdH1gXG4gICAgICAgICAgICAgIDogY2hyb21lU3lzdGVtUHJvbXB0XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9jbGF1ZGVfaW5fY2hyb21lX3NldHVwX2ZhaWxlZCcsIHtcbiAgICAgICAgICAgIHBsYXRmb3JtOlxuICAgICAgICAgICAgICBwbGF0Zm9ybSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKGBbQ2xhdWRlIGluIENocm9tZV0gRXJyb3I6ICR7ZXJyb3J9YClcbiAgICAgICAgICBsb2dFcnJvcihlcnJvcilcbiAgICAgICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgRXJyb3I6IEZhaWxlZCB0byBydW4gd2l0aCBDbGF1ZGUgaW4gQ2hyb21lLmApXG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoYXV0b0VuYWJsZUNsYXVkZUluQ2hyb21lKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBtY3BDb25maWc6IGNocm9tZU1jcENvbmZpZyB9ID0gc2V0dXBDbGF1ZGVJbkNocm9tZSgpXG4gICAgICAgICAgZHluYW1pY01jcENvbmZpZyA9IHsgLi4uZHluYW1pY01jcENvbmZpZywgLi4uY2hyb21lTWNwQ29uZmlnIH1cblxuICAgICAgICAgIGNvbnN0IGhpbnQgPVxuICAgICAgICAgICAgZmVhdHVyZSgnV0VCX0JST1dTRVJfVE9PTCcpICYmXG4gICAgICAgICAgICB0eXBlb2YgQnVuICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICAgICAgJ1dlYlZpZXcnIGluIEJ1blxuICAgICAgICAgICAgICA/IENMQVVERV9JTl9DSFJPTUVfU0tJTExfSElOVF9XSVRIX1dFQkJST1dTRVJcbiAgICAgICAgICAgICAgOiBDTEFVREVfSU5fQ0hST01FX1NLSUxMX0hJTlRcbiAgICAgICAgICBhcHBlbmRTeXN0ZW1Qcm9tcHQgPSBhcHBlbmRTeXN0ZW1Qcm9tcHRcbiAgICAgICAgICAgID8gYCR7YXBwZW5kU3lzdGVtUHJvbXB0fVxcblxcbiR7aGludH1gXG4gICAgICAgICAgICA6IGhpbnRcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAvLyBTaWxlbnRseSBza2lwIGFueSBlcnJvcnMgZm9yIHRoZSBhdXRvLWVuYWJsZVxuICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhgW0NsYXVkZSBpbiBDaHJvbWVdIEVycm9yIChhdXRvLWVuYWJsZSk6ICR7ZXJyb3J9YClcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBFeHRyYWN0IHN0cmljdCBNQ1AgY29uZmlnIGZsYWdcbiAgICAgIGNvbnN0IHN0cmljdE1jcENvbmZpZyA9IG9wdGlvbnMuc3RyaWN0TWNwQ29uZmlnIHx8IGZhbHNlXG5cbiAgICAgIC8vIENoZWNrIGlmIGVudGVycHJpc2UgTUNQIGNvbmZpZ3VyYXRpb24gZXhpc3RzLiBXaGVuIGl0IGRvZXMsIG9ubHkgYWxsb3cgZHluYW1pYyBNQ1BcbiAgICAgIC8vIGNvbmZpZ3MgdGhhdCBjb250YWluIHNwZWNpYWwgc2VydmVyIHR5cGVzIChzZGspXG4gICAgICBpZiAoZG9lc0VudGVycHJpc2VNY3BDb25maWdFeGlzdCgpKSB7XG4gICAgICAgIGlmIChzdHJpY3RNY3BDb25maWcpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICAgIGNoYWxrLnJlZChcbiAgICAgICAgICAgICAgJ1lvdSBjYW5ub3QgdXNlIC0tc3RyaWN0LW1jcC1jb25maWcgd2hlbiBhbiBlbnRlcnByaXNlIE1DUCBjb25maWcgaXMgcHJlc2VudCcsXG4gICAgICAgICAgICApLFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZvciAtLW1jcC1jb25maWcsIGFsbG93IGlmIGFsbCBzZXJ2ZXJzIGFyZSBpbnRlcm5hbCB0eXBlcyAoc2RrKVxuICAgICAgICBpZiAoXG4gICAgICAgICAgZHluYW1pY01jcENvbmZpZyAmJlxuICAgICAgICAgICFhcmVNY3BDb25maWdzQWxsb3dlZFdpdGhFbnRlcnByaXNlTWNwQ29uZmlnKGR5bmFtaWNNY3BDb25maWcpXG4gICAgICAgICkge1xuICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgY2hhbGsucmVkKFxuICAgICAgICAgICAgICAnWW91IGNhbm5vdCBkeW5hbWljYWxseSBjb25maWd1cmUgTUNQIHNlcnZlcnMgd2hlbiBhbiBlbnRlcnByaXNlIE1DUCBjb25maWcgaXMgcHJlc2VudCcsXG4gICAgICAgICAgICApLFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBjaGljYWdvIE1DUDogZ3VhcmRlZCBDb21wdXRlciBVc2UgKGFwcCBhbGxvd2xpc3QgKyBmcm9udG1vc3QgZ2F0ZSArXG4gICAgICAvLyBTQ0NvbnRlbnRGaWx0ZXIgc2NyZWVuc2hvdHMpLiBBbnQtb25seSwgR3Jvd3RoQm9vay1nYXRlZCDigJQgZmFpbHVyZXNcbiAgICAgIC8vIGFyZSBzaWxlbnQgKHRoaXMgaXMgZG9nZm9vZGluZykuIFBsYXRmb3JtICsgaW50ZXJhY3RpdmUgY2hlY2tzIGlubGluZVxuICAgICAgLy8gc28gbm9uLW1hY09TIC8gcHJpbnQtbW9kZSBhbnRzIHNraXAgdGhlIGhlYXZ5IEBhbnQvY29tcHV0ZXItdXNlLW1jcFxuICAgICAgLy8gaW1wb3J0IGVudGlyZWx5LiBnYXRlcy5qcyBpcyBsaWdodCAodHlwZS1vbmx5IHBhY2thZ2UgaW1wb3J0KS5cbiAgICAgIC8vXG4gICAgICAvLyBQbGFjZWQgQUZURVIgdGhlIGVudGVycHJpc2UtTUNQLWNvbmZpZyBjaGVjazogdGhhdCBjaGVjayByZWplY3RzIGFueVxuICAgICAgLy8gZHluYW1pY01jcENvbmZpZyBlbnRyeSB3aXRoIGB0eXBlICE9PSAnc2RrJ2AsIGFuZCBvdXIgY29uZmlnIGlzXG4gICAgICAvLyBgdHlwZTogJ3N0ZGlvJ2AuIEFuIGVudGVycHJpc2UtY29uZmlnIGFudCB3aXRoIHRoZSBHQiBnYXRlIG9uIHdvdWxkXG4gICAgICAvLyBvdGhlcndpc2UgcHJvY2Vzcy5leGl0KDEpLiBDaHJvbWUgaGFzIHRoZSBzYW1lIGxhdGVudCBpc3N1ZSBidXQgaGFzXG4gICAgICAvLyBzaGlwcGVkIHdpdGhvdXQgaW5jaWRlbnQ7IGNoaWNhZ28gcGxhY2VzIGl0c2VsZiBjb3JyZWN0bHkuXG4gICAgICBpZiAoXG4gICAgICAgIGZlYXR1cmUoJ0NISUNBR09fTUNQJykgJiZcbiAgICAgICAgZ2V0UGxhdGZvcm0oKSA9PT0gJ21hY29zJyAmJlxuICAgICAgICAhZ2V0SXNOb25JbnRlcmFjdGl2ZVNlc3Npb24oKVxuICAgICAgKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgeyBnZXRDaGljYWdvRW5hYmxlZCB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgJ3NyYy91dGlscy9jb21wdXRlclVzZS9nYXRlcy5qcydcbiAgICAgICAgICApXG4gICAgICAgICAgaWYgKGdldENoaWNhZ29FbmFibGVkKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgc2V0dXBDb21wdXRlclVzZU1DUCB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgICAnc3JjL3V0aWxzL2NvbXB1dGVyVXNlL3NldHVwLmpzJ1xuICAgICAgICAgICAgKVxuICAgICAgICAgICAgY29uc3QgeyBtY3BDb25maWcsIGFsbG93ZWRUb29sczogY3VUb29scyB9ID0gc2V0dXBDb21wdXRlclVzZU1DUCgpXG4gICAgICAgICAgICBkeW5hbWljTWNwQ29uZmlnID0geyAuLi5keW5hbWljTWNwQ29uZmlnLCAuLi5tY3BDb25maWcgfVxuICAgICAgICAgICAgYWxsb3dlZFRvb2xzLnB1c2goLi4uY3VUb29scylcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgYFtDb21wdXRlciBVc2UgTUNQXSBTZXR1cCBmYWlsZWQ6ICR7ZXJyb3JNZXNzYWdlKGVycm9yKX1gLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBTdG9yZSBhZGRpdGlvbmFsIGRpcmVjdG9yaWVzIGZvciBDTEFVREUubWQgbG9hZGluZyAoY29udHJvbGxlZCBieSBlbnYgdmFyKVxuICAgICAgc2V0QWRkaXRpb25hbERpcmVjdG9yaWVzRm9yQ2xhdWRlTWQoYWRkRGlyKVxuXG4gICAgICAvLyBDaGFubmVsIHNlcnZlciBhbGxvd2xpc3QgZnJvbSAtLWNoYW5uZWxzIGZsYWcg4oCUIHNlcnZlcnMgd2hvc2VcbiAgICAgIC8vIGluYm91bmQgcHVzaCBub3RpZmljYXRpb25zIHNob3VsZCByZWdpc3RlciB0aGlzIHNlc3Npb24uIFRoZSBvcHRpb25cbiAgICAgIC8vIGlzIGFkZGVkIGluc2lkZSBhIGZlYXR1cmUoKSBibG9jayBzbyBUUyBkb2Vzbid0IGtub3cgYWJvdXQgaXRcbiAgICAgIC8vIG9uIHRoZSBvcHRpb25zIHR5cGUg4oCUIHNhbWUgcGF0dGVybiBhcyAtLWFzc2lzdGFudCBhdCBtYWluLnRzeDoxODI0LlxuICAgICAgLy8gZGV2Q2hhbm5lbHMgaXMgZGVmZXJyZWQ6IHNob3dTZXR1cFNjcmVlbnMgc2hvd3MgYSBjb25maXJtYXRpb24gZGlhbG9nXG4gICAgICAvLyBhbmQgb25seSBhcHBlbmRzIHRvIGFsbG93ZWRDaGFubmVscyBvbiBhY2NlcHQuXG4gICAgICBsZXQgZGV2Q2hhbm5lbHM6IENoYW5uZWxFbnRyeVtdIHwgdW5kZWZpbmVkXG4gICAgICBpZiAoZmVhdHVyZSgnS0FJUk9TJykgfHwgZmVhdHVyZSgnS0FJUk9TX0NIQU5ORUxTJykpIHtcbiAgICAgICAgLy8gUGFyc2UgcGx1Z2luOm5hbWVAbWFya2V0cGxhY2UgLyBzZXJ2ZXI6WSB0YWdzIGludG8gdHlwZWQgZW50cmllcy5cbiAgICAgICAgLy8gVGFnIGRlY2lkZXMgdHJ1c3QgbW9kZWwgZG93bnN0cmVhbTogcGx1Z2luLWtpbmQgaGl0cyBtYXJrZXRwbGFjZVxuICAgICAgICAvLyB2ZXJpZmljYXRpb24gKyBHcm93dGhCb29rIGFsbG93bGlzdCwgc2VydmVyLWtpbmQgYWx3YXlzIGZhaWxzXG4gICAgICAgIC8vIGFsbG93bGlzdCAoc2NoZW1hIGlzIHBsdWdpbi1vbmx5KSB1bmxlc3MgZGV2IGZsYWcgaXMgc2V0LlxuICAgICAgICAvLyBVbnRhZ2dlZCBvciBtYXJrZXRwbGFjZS1sZXNzIHBsdWdpbiBlbnRyaWVzIGFyZSBoYXJkIGVycm9ycyDigJRcbiAgICAgICAgLy8gc2lsZW50bHkgbm90LW1hdGNoaW5nIGluIHRoZSBnYXRlIHdvdWxkIGxvb2sgbGlrZSBjaGFubmVscyBhcmVcbiAgICAgICAgLy8gXCJvblwiIGJ1dCBub3RoaW5nIGV2ZXIgZmlyZXMuXG4gICAgICAgIGNvbnN0IHBhcnNlQ2hhbm5lbEVudHJpZXMgPSAoXG4gICAgICAgICAgcmF3OiBzdHJpbmdbXSxcbiAgICAgICAgICBmbGFnOiBzdHJpbmcsXG4gICAgICAgICk6IENoYW5uZWxFbnRyeVtdID0+IHtcbiAgICAgICAgICBjb25zdCBlbnRyaWVzOiBDaGFubmVsRW50cnlbXSA9IFtdXG4gICAgICAgICAgY29uc3QgYmFkOiBzdHJpbmdbXSA9IFtdXG4gICAgICAgICAgZm9yIChjb25zdCBjIG9mIHJhdykge1xuICAgICAgICAgICAgaWYgKGMuc3RhcnRzV2l0aCgncGx1Z2luOicpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3QgPSBjLnNsaWNlKDcpXG4gICAgICAgICAgICAgIGNvbnN0IGF0ID0gcmVzdC5pbmRleE9mKCdAJylcbiAgICAgICAgICAgICAgaWYgKGF0IDw9IDAgfHwgYXQgPT09IHJlc3QubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgIGJhZC5wdXNoKGMpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZW50cmllcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIGtpbmQ6ICdwbHVnaW4nLFxuICAgICAgICAgICAgICAgICAgbmFtZTogcmVzdC5zbGljZSgwLCBhdCksXG4gICAgICAgICAgICAgICAgICBtYXJrZXRwbGFjZTogcmVzdC5zbGljZShhdCArIDEpLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYy5zdGFydHNXaXRoKCdzZXJ2ZXI6JykgJiYgYy5sZW5ndGggPiA3KSB7XG4gICAgICAgICAgICAgIGVudHJpZXMucHVzaCh7IGtpbmQ6ICdzZXJ2ZXInLCBuYW1lOiBjLnNsaWNlKDcpIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBiYWQucHVzaChjKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoYmFkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgICBjaGFsay5yZWQoXG4gICAgICAgICAgICAgICAgYCR7ZmxhZ30gZW50cmllcyBtdXN0IGJlIHRhZ2dlZDogJHtiYWQuam9pbignLCAnKX1cXG5gICtcbiAgICAgICAgICAgICAgICAgIGAgIHBsdWdpbjo8bmFtZT5APG1hcmtldHBsYWNlPiAg4oCUIHBsdWdpbi1wcm92aWRlZCBjaGFubmVsIChhbGxvd2xpc3QgZW5mb3JjZWQpXFxuYCArXG4gICAgICAgICAgICAgICAgICBgICBzZXJ2ZXI6PG5hbWU+ICAgICAgICAgICAgICAgIOKAlCBtYW51YWxseSBjb25maWd1cmVkIE1DUCBzZXJ2ZXJcXG5gLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBlbnRyaWVzXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGFubmVsT3B0cyA9IG9wdGlvbnMgYXMge1xuICAgICAgICAgIGNoYW5uZWxzPzogc3RyaW5nW11cbiAgICAgICAgICBkYW5nZXJvdXNseUxvYWREZXZlbG9wbWVudENoYW5uZWxzPzogc3RyaW5nW11cbiAgICAgICAgfVxuICAgICAgICBjb25zdCByYXdDaGFubmVscyA9IGNoYW5uZWxPcHRzLmNoYW5uZWxzXG4gICAgICAgIGNvbnN0IHJhd0RldiA9IGNoYW5uZWxPcHRzLmRhbmdlcm91c2x5TG9hZERldmVsb3BtZW50Q2hhbm5lbHNcbiAgICAgICAgLy8gQWx3YXlzIHBhcnNlICsgc2V0LiBDaGFubmVsc05vdGljZSByZWFkcyBnZXRBbGxvd2VkQ2hhbm5lbHMoKSBhbmRcbiAgICAgICAgLy8gcmVuZGVycyB0aGUgYXBwcm9wcmlhdGUgYnJhbmNoIChkaXNhYmxlZC9ub0F1dGgvcG9saWN5QmxvY2tlZC9cbiAgICAgICAgLy8gbGlzdGVuaW5nKSBpbiB0aGUgc3RhcnR1cCBzY3JlZW4uIGdhdGVDaGFubmVsU2VydmVyKCkgZW5mb3JjZXMuXG4gICAgICAgIC8vIC0tY2hhbm5lbHMgd29ya3MgaW4gYm90aCBpbnRlcmFjdGl2ZSBhbmQgcHJpbnQvU0RLIG1vZGVzOyBkZXYtY2hhbm5lbHNcbiAgICAgICAgLy8gc3RheXMgaW50ZXJhY3RpdmUtb25seSAocmVxdWlyZXMgYSBjb25maXJtYXRpb24gZGlhbG9nKS5cbiAgICAgICAgbGV0IGNoYW5uZWxFbnRyaWVzOiBDaGFubmVsRW50cnlbXSA9IFtdXG4gICAgICAgIGlmIChyYXdDaGFubmVscyAmJiByYXdDaGFubmVscy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY2hhbm5lbEVudHJpZXMgPSBwYXJzZUNoYW5uZWxFbnRyaWVzKHJhd0NoYW5uZWxzLCAnLS1jaGFubmVscycpXG4gICAgICAgICAgc2V0QWxsb3dlZENoYW5uZWxzKGNoYW5uZWxFbnRyaWVzKVxuICAgICAgICB9XG4gICAgICAgIGlmICghaXNOb25JbnRlcmFjdGl2ZVNlc3Npb24pIHtcbiAgICAgICAgICBpZiAocmF3RGV2ICYmIHJhd0Rldi5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBkZXZDaGFubmVscyA9IHBhcnNlQ2hhbm5lbEVudHJpZXMoXG4gICAgICAgICAgICAgIHJhd0RldixcbiAgICAgICAgICAgICAgJy0tZGFuZ2Vyb3VzbHktbG9hZC1kZXZlbG9wbWVudC1jaGFubmVscycsXG4gICAgICAgICAgICApXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEZsYWctdXNhZ2UgdGVsZW1ldHJ5LiBQbHVnaW4gaWRlbnRpZmllcnMgYXJlIGxvZ2dlZCAoc2FtZSB0aWVyIGFzXG4gICAgICAgIC8vIHRlbmd1X3BsdWdpbl9pbnN0YWxsZWQg4oCUIHB1YmxpYy1yZWdpc3RyeS1zdHlsZSBuYW1lcyk7IHNlcnZlci1raW5kXG4gICAgICAgIC8vIG5hbWVzIGFyZSBub3QgKE1DUC1zZXJ2ZXItbmFtZSB0aWVyLCBvcHQtaW4tb25seSBlbHNld2hlcmUpLlxuICAgICAgICAvLyBQZXItc2VydmVyIGdhdGUgb3V0Y29tZXMgbGFuZCBpbiB0ZW5ndV9tY3BfY2hhbm5lbF9nYXRlIG9uY2VcbiAgICAgICAgLy8gc2VydmVycyBjb25uZWN0LiBEZXYgZW50cmllcyBnbyB0aHJvdWdoIGEgY29uZmlybWF0aW9uIGRpYWxvZyBhZnRlclxuICAgICAgICAvLyB0aGlzIOKAlCBkZXZfcGx1Z2lucyBjYXB0dXJlcyB3aGF0IHdhcyB0eXBlZCwgbm90IHdoYXQgd2FzIGFjY2VwdGVkLlxuICAgICAgICBpZiAoY2hhbm5lbEVudHJpZXMubGVuZ3RoID4gMCB8fCAoZGV2Q2hhbm5lbHM/Lmxlbmd0aCA/PyAwKSA+IDApIHtcbiAgICAgICAgICBjb25zdCBqb2luUGx1Z2luSWRzID0gKGVudHJpZXM6IENoYW5uZWxFbnRyeVtdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpZHMgPSBlbnRyaWVzLmZsYXRNYXAoZSA9PlxuICAgICAgICAgICAgICBlLmtpbmQgPT09ICdwbHVnaW4nID8gW2Ake2UubmFtZX1AJHtlLm1hcmtldHBsYWNlfWBdIDogW10sXG4gICAgICAgICAgICApXG4gICAgICAgICAgICByZXR1cm4gaWRzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgPyAoaWRzXG4gICAgICAgICAgICAgICAgICAuc29ydCgpXG4gICAgICAgICAgICAgICAgICAuam9pbihcbiAgICAgICAgICAgICAgICAgICAgJywnLFxuICAgICAgICAgICAgICAgICAgKSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTKVxuICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgIH1cbiAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfbWNwX2NoYW5uZWxfZmxhZ3MnLCB7XG4gICAgICAgICAgICBjaGFubmVsc19jb3VudDogY2hhbm5lbEVudHJpZXMubGVuZ3RoLFxuICAgICAgICAgICAgZGV2X2NvdW50OiBkZXZDaGFubmVscz8ubGVuZ3RoID8/IDAsXG4gICAgICAgICAgICBwbHVnaW5zOiBqb2luUGx1Z2luSWRzKGNoYW5uZWxFbnRyaWVzKSxcbiAgICAgICAgICAgIGRldl9wbHVnaW5zOiBqb2luUGx1Z2luSWRzKGRldkNoYW5uZWxzID8/IFtdKSxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFNESyBvcHQtaW4gZm9yIFNlbmRVc2VyTWVzc2FnZSB2aWEgLS10b29scy4gQWxsIHNlc3Npb25zIHJlcXVpcmVcbiAgICAgIC8vIGV4cGxpY2l0IG9wdC1pbjsgbGlzdGluZyBpdCBpbiAtLXRvb2xzIHNpZ25hbHMgaW50ZW50LiBSdW5zIEJFRk9SRVxuICAgICAgLy8gaW5pdGlhbGl6ZVRvb2xQZXJtaXNzaW9uQ29udGV4dCBzbyBnZXRUb29sc0ZvckRlZmF1bHRQcmVzZXQoKSBzZWVzXG4gICAgICAvLyB0aGUgdG9vbCBhcyBlbmFibGVkIHdoZW4gY29tcHV0aW5nIHRoZSBiYXNlLXRvb2xzIGRpc2FsbG93IGZpbHRlci5cbiAgICAgIC8vIENvbmRpdGlvbmFsIHJlcXVpcmUgYXZvaWRzIGxlYWtpbmcgdGhlIHRvb2wtbmFtZSBzdHJpbmcgaW50b1xuICAgICAgLy8gZXh0ZXJuYWwgYnVpbGRzLlxuICAgICAgaWYgKFxuICAgICAgICAoZmVhdHVyZSgnS0FJUk9TJykgfHwgZmVhdHVyZSgnS0FJUk9TX0JSSUVGJykpICYmXG4gICAgICAgIGJhc2VUb29scy5sZW5ndGggPiAwXG4gICAgICApIHtcbiAgICAgICAgLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICBjb25zdCB7IEJSSUVGX1RPT0xfTkFNRSwgTEVHQUNZX0JSSUVGX1RPT0xfTkFNRSB9ID1cbiAgICAgICAgICByZXF1aXJlKCcuL3Rvb2xzL0JyaWVmVG9vbC9wcm9tcHQuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuL3Rvb2xzL0JyaWVmVG9vbC9wcm9tcHQuanMnKVxuICAgICAgICBjb25zdCB7IGlzQnJpZWZFbnRpdGxlZCB9ID1cbiAgICAgICAgICByZXF1aXJlKCcuL3Rvb2xzL0JyaWVmVG9vbC9CcmllZlRvb2wuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuL3Rvb2xzL0JyaWVmVG9vbC9CcmllZlRvb2wuanMnKVxuICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgY29uc3QgcGFyc2VkID0gcGFyc2VUb29sTGlzdEZyb21DTEkoYmFzZVRvb2xzKVxuICAgICAgICBpZiAoXG4gICAgICAgICAgKHBhcnNlZC5pbmNsdWRlcyhCUklFRl9UT09MX05BTUUpIHx8XG4gICAgICAgICAgICBwYXJzZWQuaW5jbHVkZXMoTEVHQUNZX0JSSUVGX1RPT0xfTkFNRSkpICYmXG4gICAgICAgICAgaXNCcmllZkVudGl0bGVkKClcbiAgICAgICAgKSB7XG4gICAgICAgICAgc2V0VXNlck1zZ09wdEluKHRydWUpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVGhpcyBhd2FpdCByZXBsYWNlcyBibG9ja2luZyBleGlzdHNTeW5jL3N0YXRTeW5jIGNhbGxzIHRoYXQgd2VyZSBhbHJlYWR5IGluXG4gICAgICAvLyB0aGUgc3RhcnR1cCBwYXRoLiBXYWxsLWNsb2NrIHRpbWUgaXMgdW5jaGFuZ2VkOyB3ZSBqdXN0IHlpZWxkIHRvIHRoZSBldmVudFxuICAgICAgLy8gbG9vcCBkdXJpbmcgdGhlIGZzIEkvTyBpbnN0ZWFkIG9mIGJsb2NraW5nIGl0LiBTZWUgIzE5NjYxLlxuICAgICAgY29uc3QgaW5pdFJlc3VsdCA9IGF3YWl0IGluaXRpYWxpemVUb29sUGVybWlzc2lvbkNvbnRleHQoe1xuICAgICAgICBhbGxvd2VkVG9vbHNDbGk6IGFsbG93ZWRUb29scyxcbiAgICAgICAgZGlzYWxsb3dlZFRvb2xzQ2xpOiBkaXNhbGxvd2VkVG9vbHMsXG4gICAgICAgIGJhc2VUb29sc0NsaTogYmFzZVRvb2xzLFxuICAgICAgICBwZXJtaXNzaW9uTW9kZSxcbiAgICAgICAgYWxsb3dEYW5nZXJvdXNseVNraXBQZXJtaXNzaW9ucyxcbiAgICAgICAgYWRkRGlyczogYWRkRGlyLFxuICAgICAgfSlcbiAgICAgIGxldCB0b29sUGVybWlzc2lvbkNvbnRleHQgPSBpbml0UmVzdWx0LnRvb2xQZXJtaXNzaW9uQ29udGV4dFxuICAgICAgY29uc3QgeyB3YXJuaW5ncywgZGFuZ2Vyb3VzUGVybWlzc2lvbnMsIG92ZXJseUJyb2FkQmFzaFBlcm1pc3Npb25zIH0gPVxuICAgICAgICBpbml0UmVzdWx0XG5cbiAgICAgIC8vIEhhbmRsZSBvdmVybHkgYnJvYWQgc2hlbGwgYWxsb3cgcnVsZXMgZm9yIGFudCB1c2VycyAoQmFzaCgqKSwgUG93ZXJTaGVsbCgqKSlcbiAgICAgIGlmIChcbiAgICAgICAgXCJleHRlcm5hbFwiID09PSAnYW50JyAmJlxuICAgICAgICBvdmVybHlCcm9hZEJhc2hQZXJtaXNzaW9ucy5sZW5ndGggPiAwXG4gICAgICApIHtcbiAgICAgICAgZm9yIChjb25zdCBwZXJtaXNzaW9uIG9mIG92ZXJseUJyb2FkQmFzaFBlcm1pc3Npb25zKSB7XG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgYElnbm9yaW5nIG92ZXJseSBicm9hZCBzaGVsbCBwZXJtaXNzaW9uICR7cGVybWlzc2lvbi5ydWxlRGlzcGxheX0gZnJvbSAke3Blcm1pc3Npb24uc291cmNlRGlzcGxheX1gLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQgPSByZW1vdmVEYW5nZXJvdXNQZXJtaXNzaW9ucyhcbiAgICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgb3Zlcmx5QnJvYWRCYXNoUGVybWlzc2lvbnMsXG4gICAgICAgIClcbiAgICAgIH1cblxuICAgICAgaWYgKGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpICYmIGRhbmdlcm91c1Blcm1pc3Npb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0ID0gc3RyaXBEYW5nZXJvdXNQZXJtaXNzaW9uc0ZvckF1dG9Nb2RlKFxuICAgICAgICAgIHRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgICAgKVxuICAgICAgfVxuXG4gICAgICAvLyBQcmludCBhbnkgd2FybmluZ3MgZnJvbSBpbml0aWFsaXphdGlvblxuICAgICAgd2FybmluZ3MuZm9yRWFjaCh3YXJuaW5nID0+IHtcbiAgICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgICBjb25zb2xlLmVycm9yKHdhcm5pbmcpXG4gICAgICB9KVxuXG4gICAgICB2b2lkIGFzc2VydE1pblZlcnNpb24oKVxuXG4gICAgICAvLyBjbGF1ZGUuYWkgY29uZmlnIGZldGNoOiAtcCBtb2RlIG9ubHkgKGludGVyYWN0aXZlIHVzZXMgdXNlTWFuYWdlTUNQQ29ubmVjdGlvbnNcbiAgICAgIC8vIHR3by1waGFzZSBsb2FkaW5nKS4gS2lja2VkIG9mZiBoZXJlIHRvIG92ZXJsYXAgd2l0aCBzZXR1cCgpOyBhd2FpdGVkXG4gICAgICAvLyBiZWZvcmUgcnVuSGVhZGxlc3Mgc28gc2luZ2xlLXR1cm4gLXAgc2VlcyBjb25uZWN0b3JzLiBTa2lwcGVkIHVuZGVyXG4gICAgICAvLyBlbnRlcnByaXNlL3N0cmljdCBNQ1AgdG8gcHJlc2VydmUgcG9saWN5IGJvdW5kYXJpZXMuXG4gICAgICBjb25zdCBjbGF1ZGVhaUNvbmZpZ1Byb21pc2U6IFByb21pc2U8XG4gICAgICAgIFJlY29yZDxzdHJpbmcsIFNjb3BlZE1jcFNlcnZlckNvbmZpZz5cbiAgICAgID4gPVxuICAgICAgICBpc05vbkludGVyYWN0aXZlU2Vzc2lvbiAmJlxuICAgICAgICAhc3RyaWN0TWNwQ29uZmlnICYmXG4gICAgICAgICFkb2VzRW50ZXJwcmlzZU1jcENvbmZpZ0V4aXN0KCkgJiZcbiAgICAgICAgLy8gLS1iYXJlIC8gU0lNUExFOiBza2lwIGNsYXVkZS5haSBwcm94eSBzZXJ2ZXJzIChkYXRhZG9nLCBHbWFpbCxcbiAgICAgICAgLy8gU2xhY2ssIEJpZ1F1ZXJ5LCBQdWJNZWQg4oCUIDYtMTRzIGVhY2ggdG8gY29ubmVjdCkuIFNjcmlwdGVkIGNhbGxzXG4gICAgICAgIC8vIHRoYXQgbmVlZCBNQ1AgcGFzcyAtLW1jcC1jb25maWcgZXhwbGljaXRseS5cbiAgICAgICAgIWlzQmFyZU1vZGUoKVxuICAgICAgICAgID8gZmV0Y2hDbGF1ZGVBSU1jcENvbmZpZ3NJZkVsaWdpYmxlKCkudGhlbihjb25maWdzID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgeyBhbGxvd2VkLCBibG9ja2VkIH0gPSBmaWx0ZXJNY3BTZXJ2ZXJzQnlQb2xpY3koY29uZmlncylcbiAgICAgICAgICAgICAgaWYgKGJsb2NrZWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgICAgICAgYFdhcm5pbmc6IGNsYXVkZS5haSBNQ1AgJHtwbHVyYWwoYmxvY2tlZC5sZW5ndGgsICdzZXJ2ZXInKX0gYmxvY2tlZCBieSBlbnRlcnByaXNlIHBvbGljeTogJHtibG9ja2VkLmpvaW4oJywgJyl9XFxuYCxcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGFsbG93ZWRcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgOiBQcm9taXNlLnJlc29sdmUoe30pXG5cbiAgICAgIC8vIEtpY2sgb2ZmIE1DUCBjb25maWcgbG9hZGluZyBlYXJseSAoc2FmZSAtIGp1c3QgcmVhZHMgZmlsZXMsIG5vIGV4ZWN1dGlvbikuXG4gICAgICAvLyBCb3RoIGludGVyYWN0aXZlIGFuZCAtcCB1c2UgZ2V0Q2xhdWRlQ29kZU1jcENvbmZpZ3MgKGxvY2FsIGZpbGUgcmVhZHMgb25seSkuXG4gICAgICAvLyBUaGUgbG9jYWwgcHJvbWlzZSBpcyBhd2FpdGVkIGxhdGVyIChiZWZvcmUgcHJlZmV0Y2hBbGxNY3BSZXNvdXJjZXMpIHRvXG4gICAgICAvLyBvdmVybGFwIGNvbmZpZyBJL08gd2l0aCBzZXR1cCgpLCBjb21tYW5kcyBsb2FkaW5nLCBhbmQgdHJ1c3QgZGlhbG9nLlxuICAgICAgbG9nRm9yRGVidWdnaW5nKCdbU1RBUlRVUF0gTG9hZGluZyBNQ1AgY29uZmlncy4uLicpXG4gICAgICBjb25zdCBtY3BDb25maWdTdGFydCA9IERhdGUubm93KClcbiAgICAgIGxldCBtY3BDb25maWdSZXNvbHZlZE1zOiBudW1iZXIgfCB1bmRlZmluZWRcbiAgICAgIC8vIC0tYmFyZSBza2lwcyBhdXRvLWRpc2NvdmVyZWQgTUNQICgubWNwLmpzb24sIHVzZXIgc2V0dGluZ3MsIHBsdWdpbnMpIOKAlFxuICAgICAgLy8gb25seSBleHBsaWNpdCAtLW1jcC1jb25maWcgd29ya3MuIGR5bmFtaWNNY3BDb25maWcgaXMgc3ByZWFkIG9udG9cbiAgICAgIC8vIGFsbE1jcENvbmZpZ3MgZG93bnN0cmVhbSBzbyBpdCBzdXJ2aXZlcyB0aGlzIHNraXAuXG4gICAgICBjb25zdCBtY3BDb25maWdQcm9taXNlID0gKFxuICAgICAgICBzdHJpY3RNY3BDb25maWcgfHwgaXNCYXJlTW9kZSgpXG4gICAgICAgICAgPyBQcm9taXNlLnJlc29sdmUoe1xuICAgICAgICAgICAgICBzZXJ2ZXJzOiB7fSBhcyBSZWNvcmQ8c3RyaW5nLCBTY29wZWRNY3BTZXJ2ZXJDb25maWc+LFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICA6IGdldENsYXVkZUNvZGVNY3BDb25maWdzKGR5bmFtaWNNY3BDb25maWcpXG4gICAgICApLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgICAgbWNwQ29uZmlnUmVzb2x2ZWRNcyA9IERhdGUubm93KCkgLSBtY3BDb25maWdTdGFydFxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICB9KVxuXG4gICAgICAvLyBOT1RFOiBXZSBkbyBOT1QgY2FsbCBwcmVmZXRjaEFsbE1jcFJlc291cmNlcyBoZXJlIC0gdGhhdCdzIGRlZmVycmVkIHVudGlsIGFmdGVyIHRydXN0IGRpYWxvZ1xuXG4gICAgICBpZiAoXG4gICAgICAgIGlucHV0Rm9ybWF0ICYmXG4gICAgICAgIGlucHV0Rm9ybWF0ICE9PSAndGV4dCcgJiZcbiAgICAgICAgaW5wdXRGb3JtYXQgIT09ICdzdHJlYW0tanNvbidcbiAgICAgICkge1xuICAgICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yOiBJbnZhbGlkIGlucHV0IGZvcm1hdCBcIiR7aW5wdXRGb3JtYXR9XCIuYClcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICB9XG4gICAgICBpZiAoaW5wdXRGb3JtYXQgPT09ICdzdHJlYW0tanNvbicgJiYgb3V0cHV0Rm9ybWF0ICE9PSAnc3RyZWFtLWpzb24nKSB7XG4gICAgICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Db25zb2xlOjogaW50ZW50aW9uYWwgY29uc29sZSBvdXRwdXRcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBgRXJyb3I6IC0taW5wdXQtZm9ybWF0PXN0cmVhbS1qc29uIHJlcXVpcmVzIG91dHB1dC1mb3JtYXQ9c3RyZWFtLWpzb24uYCxcbiAgICAgICAgKVxuICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgIH1cblxuICAgICAgLy8gVmFsaWRhdGUgc2RrVXJsIGlzIG9ubHkgdXNlZCB3aXRoIGFwcHJvcHJpYXRlIGZvcm1hdHMgKGZvcm1hdHMgYXJlIGF1dG8tc2V0IGFib3ZlKVxuICAgICAgaWYgKHNka1VybCkge1xuICAgICAgICBpZiAoaW5wdXRGb3JtYXQgIT09ICdzdHJlYW0tanNvbicgfHwgb3V0cHV0Rm9ybWF0ICE9PSAnc3RyZWFtLWpzb24nKSB7XG4gICAgICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBgRXJyb3I6IC0tc2RrLXVybCByZXF1aXJlcyBib3RoIC0taW5wdXQtZm9ybWF0PXN0cmVhbS1qc29uIGFuZCAtLW91dHB1dC1mb3JtYXQ9c3RyZWFtLWpzb24uYCxcbiAgICAgICAgICApXG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gVmFsaWRhdGUgcmVwbGF5VXNlck1lc3NhZ2VzIGlzIG9ubHkgdXNlZCB3aXRoIHN0cmVhbS1qc29uIGZvcm1hdHNcbiAgICAgIGlmIChvcHRpb25zLnJlcGxheVVzZXJNZXNzYWdlcykge1xuICAgICAgICBpZiAoaW5wdXRGb3JtYXQgIT09ICdzdHJlYW0tanNvbicgfHwgb3V0cHV0Rm9ybWF0ICE9PSAnc3RyZWFtLWpzb24nKSB7XG4gICAgICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBgRXJyb3I6IC0tcmVwbGF5LXVzZXItbWVzc2FnZXMgcmVxdWlyZXMgYm90aCAtLWlucHV0LWZvcm1hdD1zdHJlYW0tanNvbiBhbmQgLS1vdXRwdXQtZm9ybWF0PXN0cmVhbS1qc29uLmAsXG4gICAgICAgICAgKVxuICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFZhbGlkYXRlIGluY2x1ZGVQYXJ0aWFsTWVzc2FnZXMgaXMgb25seSB1c2VkIHdpdGggcHJpbnQgbW9kZSBhbmQgc3RyZWFtLWpzb24gb3V0cHV0XG4gICAgICBpZiAoZWZmZWN0aXZlSW5jbHVkZVBhcnRpYWxNZXNzYWdlcykge1xuICAgICAgICBpZiAoIWlzTm9uSW50ZXJhY3RpdmVTZXNzaW9uIHx8IG91dHB1dEZvcm1hdCAhPT0gJ3N0cmVhbS1qc29uJykge1xuICAgICAgICAgIHdyaXRlVG9TdGRlcnIoXG4gICAgICAgICAgICBgRXJyb3I6IC0taW5jbHVkZS1wYXJ0aWFsLW1lc3NhZ2VzIHJlcXVpcmVzIC0tcHJpbnQgYW5kIC0tb3V0cHV0LWZvcm1hdD1zdHJlYW0tanNvbi5gLFxuICAgICAgICAgIClcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBWYWxpZGF0ZSAtLW5vLXNlc3Npb24tcGVyc2lzdGVuY2UgaXMgb25seSB1c2VkIHdpdGggcHJpbnQgbW9kZVxuICAgICAgaWYgKG9wdGlvbnMuc2Vzc2lvblBlcnNpc3RlbmNlID09PSBmYWxzZSAmJiAhaXNOb25JbnRlcmFjdGl2ZVNlc3Npb24pIHtcbiAgICAgICAgd3JpdGVUb1N0ZGVycihcbiAgICAgICAgICBgRXJyb3I6IC0tbm8tc2Vzc2lvbi1wZXJzaXN0ZW5jZSBjYW4gb25seSBiZSB1c2VkIHdpdGggLS1wcmludCBtb2RlLmAsXG4gICAgICAgIClcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVmZmVjdGl2ZVByb21wdCA9IHByb21wdCB8fCAnJ1xuICAgICAgbGV0IGlucHV0UHJvbXB0ID0gYXdhaXQgZ2V0SW5wdXRQcm9tcHQoXG4gICAgICAgIGVmZmVjdGl2ZVByb21wdCxcbiAgICAgICAgKGlucHV0Rm9ybWF0ID8/ICd0ZXh0JykgYXMgJ3RleHQnIHwgJ3N0cmVhbS1qc29uJyxcbiAgICAgIClcbiAgICAgIHByb2ZpbGVDaGVja3BvaW50KCdhY3Rpb25fYWZ0ZXJfaW5wdXRfcHJvbXB0JylcblxuICAgICAgLy8gQWN0aXZhdGUgcHJvYWN0aXZlIG1vZGUgQkVGT1JFIGdldFRvb2xzKCkgc28gU2xlZXBUb29sLmlzRW5hYmxlZCgpXG4gICAgICAvLyAod2hpY2ggcmV0dXJucyBpc1Byb2FjdGl2ZUFjdGl2ZSgpKSBwYXNzZXMgYW5kIFNsZWVwIGlzIGluY2x1ZGVkLlxuICAgICAgLy8gVGhlIGxhdGVyIFJFUEwtcGF0aCBtYXliZUFjdGl2YXRlUHJvYWN0aXZlKCkgY2FsbHMgYXJlIGlkZW1wb3RlbnQuXG4gICAgICBtYXliZUFjdGl2YXRlUHJvYWN0aXZlKG9wdGlvbnMpXG5cbiAgICAgIGxldCB0b29scyA9IGdldFRvb2xzKHRvb2xQZXJtaXNzaW9uQ29udGV4dClcblxuICAgICAgLy8gQXBwbHkgY29vcmRpbmF0b3IgbW9kZSB0b29sIGZpbHRlcmluZyBmb3IgaGVhZGxlc3MgcGF0aFxuICAgICAgLy8gKG1pcnJvcnMgdXNlTWVyZ2VkVG9vbHMudHMgZmlsdGVyaW5nIGZvciBSRVBML2ludGVyYWN0aXZlIHBhdGgpXG4gICAgICBpZiAoXG4gICAgICAgIGZlYXR1cmUoJ0NPT1JESU5BVE9SX01PREUnKSAmJlxuICAgICAgICBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9DT09SRElOQVRPUl9NT0RFKVxuICAgICAgKSB7XG4gICAgICAgIGNvbnN0IHsgYXBwbHlDb29yZGluYXRvclRvb2xGaWx0ZXIgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICAgICAnLi91dGlscy90b29sUG9vbC5qcydcbiAgICAgICAgKVxuICAgICAgICB0b29scyA9IGFwcGx5Q29vcmRpbmF0b3JUb29sRmlsdGVyKHRvb2xzKVxuICAgICAgfVxuXG4gICAgICBwcm9maWxlQ2hlY2twb2ludCgnYWN0aW9uX3Rvb2xzX2xvYWRlZCcpXG5cbiAgICAgIGxldCBqc29uU2NoZW1hOiBUb29sSW5wdXRKU09OU2NoZW1hIHwgdW5kZWZpbmVkXG4gICAgICBpZiAoXG4gICAgICAgIGlzU3ludGhldGljT3V0cHV0VG9vbEVuYWJsZWQoeyBpc05vbkludGVyYWN0aXZlU2Vzc2lvbiB9KSAmJlxuICAgICAgICBvcHRpb25zLmpzb25TY2hlbWFcbiAgICAgICkge1xuICAgICAgICBqc29uU2NoZW1hID0ganNvblBhcnNlKG9wdGlvbnMuanNvblNjaGVtYSkgYXMgVG9vbElucHV0SlNPTlNjaGVtYVxuICAgICAgfVxuXG4gICAgICBpZiAoanNvblNjaGVtYSkge1xuICAgICAgICBjb25zdCBzeW50aGV0aWNPdXRwdXRSZXN1bHQgPSBjcmVhdGVTeW50aGV0aWNPdXRwdXRUb29sKGpzb25TY2hlbWEpXG4gICAgICAgIGlmICgndG9vbCcgaW4gc3ludGhldGljT3V0cHV0UmVzdWx0KSB7XG4gICAgICAgICAgLy8gQWRkIFN5bnRoZXRpY091dHB1dFRvb2wgdG8gdGhlIHRvb2xzIGFycmF5IEFGVEVSIGdldFRvb2xzKCkgZmlsdGVyaW5nLlxuICAgICAgICAgIC8vIFRoaXMgdG9vbCBpcyBleGNsdWRlZCBmcm9tIG5vcm1hbCBmaWx0ZXJpbmcgKHNlZSB0b29scy50cykgYmVjYXVzZSBpdCdzXG4gICAgICAgICAgLy8gYW4gaW1wbGVtZW50YXRpb24gZGV0YWlsIGZvciBzdHJ1Y3R1cmVkIG91dHB1dCwgbm90IGEgdXNlci1jb250cm9sbGVkIHRvb2wuXG4gICAgICAgICAgdG9vbHMgPSBbLi4udG9vbHMsIHN5bnRoZXRpY091dHB1dFJlc3VsdC50b29sXVxuXG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3N0cnVjdHVyZWRfb3V0cHV0X2VuYWJsZWQnLCB7XG4gICAgICAgICAgICBzY2hlbWFfcHJvcGVydHlfY291bnQ6IE9iamVjdC5rZXlzKFxuICAgICAgICAgICAgICAoanNvblNjaGVtYS5wcm9wZXJ0aWVzIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KSB8fCB7fSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgLmxlbmd0aCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgaGFzX3JlcXVpcmVkX2ZpZWxkczogQm9vbGVhbihcbiAgICAgICAgICAgICAganNvblNjaGVtYS5yZXF1aXJlZCxcbiAgICAgICAgICAgICkgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zdHJ1Y3R1cmVkX291dHB1dF9mYWlsdXJlJywge1xuICAgICAgICAgICAgZXJyb3I6XG4gICAgICAgICAgICAgICdJbnZhbGlkIEpTT04gc2NoZW1hJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gSU1QT1JUQU5UOiBzZXR1cCgpIG11c3QgYmUgY2FsbGVkIGJlZm9yZSBhbnkgb3RoZXIgY29kZSB0aGF0IGRlcGVuZHMgb24gdGhlIGN3ZCBvciB3b3JrdHJlZSBzZXR1cFxuICAgICAgcHJvZmlsZUNoZWNrcG9pbnQoJ2FjdGlvbl9iZWZvcmVfc2V0dXAnKVxuICAgICAgbG9nRm9yRGVidWdnaW5nKCdbU1RBUlRVUF0gUnVubmluZyBzZXR1cCgpLi4uJylcbiAgICAgIGNvbnN0IHNldHVwU3RhcnQgPSBEYXRlLm5vdygpXG4gICAgICBjb25zdCB7IHNldHVwIH0gPSBhd2FpdCBpbXBvcnQoJy4vc2V0dXAuanMnKVxuICAgICAgY29uc3QgbWVzc2FnaW5nU29ja2V0UGF0aCA9IGZlYXR1cmUoJ1VEU19JTkJPWCcpXG4gICAgICAgID8gKG9wdGlvbnMgYXMgeyBtZXNzYWdpbmdTb2NrZXRQYXRoPzogc3RyaW5nIH0pLm1lc3NhZ2luZ1NvY2tldFBhdGhcbiAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgIC8vIFBhcmFsbGVsaXplIHNldHVwKCkgd2l0aCBjb21tYW5kcythZ2VudHMgbG9hZGluZy4gc2V0dXAoKSdzIH4yOG1zIGlzXG4gICAgICAvLyBtb3N0bHkgc3RhcnRVZHNNZXNzYWdpbmcgKHNvY2tldCBiaW5kLCB+MjBtcykg4oCUIG5vdCBkaXNrLWJvdW5kLCBzbyBpdFxuICAgICAgLy8gZG9lc24ndCBjb250ZW5kIHdpdGggZ2V0Q29tbWFuZHMnIGZpbGUgcmVhZHMuIEdhdGVkIG9uICF3b3JrdHJlZUVuYWJsZWRcbiAgICAgIC8vIHNpbmNlIC0td29ya3RyZWUgbWFrZXMgc2V0dXAoKSBwcm9jZXNzLmNoZGlyKCkgKHNldHVwLnRzOjIwMyksIGFuZFxuICAgICAgLy8gY29tbWFuZHMvYWdlbnRzIG5lZWQgdGhlIHBvc3QtY2hkaXIgY3dkLlxuICAgICAgY29uc3QgcHJlU2V0dXBDd2QgPSBnZXRDd2QoKVxuICAgICAgLy8gUmVnaXN0ZXIgYnVuZGxlZCBza2lsbHMvcGx1Z2lucyBiZWZvcmUga2lja2luZyBnZXRDb21tYW5kcygpIOKAlCB0aGV5J3JlXG4gICAgICAvLyBwdXJlIGluLW1lbW9yeSBhcnJheSBwdXNoZXMgKDwxbXMsIHplcm8gSS9PKSB0aGF0IGdldEJ1bmRsZWRTa2lsbHMoKVxuICAgICAgLy8gcmVhZHMgc3luY2hyb25vdXNseS4gUHJldmlvdXNseSByYW4gaW5zaWRlIHNldHVwKCkgYWZ0ZXIgfjIwbXMgb2ZcbiAgICAgIC8vIGF3YWl0IHBvaW50cywgc28gdGhlIHBhcmFsbGVsIGdldENvbW1hbmRzKCkgbWVtb2l6ZWQgYW4gZW1wdHkgbGlzdC5cbiAgICAgIGlmIChwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9FTlRSWVBPSU5UICE9PSAnbG9jYWwtYWdlbnQnKSB7XG4gICAgICAgIGluaXRCdWlsdGluUGx1Z2lucygpXG4gICAgICAgIGluaXRCdW5kbGVkU2tpbGxzKClcbiAgICAgIH1cbiAgICAgIGNvbnN0IHNldHVwUHJvbWlzZSA9IHNldHVwKFxuICAgICAgICBwcmVTZXR1cEN3ZCxcbiAgICAgICAgcGVybWlzc2lvbk1vZGUsXG4gICAgICAgIGFsbG93RGFuZ2Vyb3VzbHlTa2lwUGVybWlzc2lvbnMsXG4gICAgICAgIHdvcmt0cmVlRW5hYmxlZCxcbiAgICAgICAgd29ya3RyZWVOYW1lLFxuICAgICAgICB0bXV4RW5hYmxlZCxcbiAgICAgICAgc2Vzc2lvbklkID8gdmFsaWRhdGVVdWlkKHNlc3Npb25JZCkgOiB1bmRlZmluZWQsXG4gICAgICAgIHdvcmt0cmVlUFJOdW1iZXIsXG4gICAgICAgIG1lc3NhZ2luZ1NvY2tldFBhdGgsXG4gICAgICApXG4gICAgICBjb25zdCBjb21tYW5kc1Byb21pc2UgPSB3b3JrdHJlZUVuYWJsZWQgPyBudWxsIDogZ2V0Q29tbWFuZHMocHJlU2V0dXBDd2QpXG4gICAgICBjb25zdCBhZ2VudERlZnNQcm9taXNlID0gd29ya3RyZWVFbmFibGVkXG4gICAgICAgID8gbnVsbFxuICAgICAgICA6IGdldEFnZW50RGVmaW5pdGlvbnNXaXRoT3ZlcnJpZGVzKHByZVNldHVwQ3dkKVxuICAgICAgLy8gU3VwcHJlc3MgdHJhbnNpZW50IHVuaGFuZGxlZFJlamVjdGlvbiBpZiB0aGVzZSByZWplY3QgZHVyaW5nIHRoZVxuICAgICAgLy8gfjI4bXMgc2V0dXBQcm9taXNlIGF3YWl0IGJlZm9yZSBQcm9taXNlLmFsbCBqb2lucyB0aGVtIGJlbG93LlxuICAgICAgY29tbWFuZHNQcm9taXNlPy5jYXRjaCgoKSA9PiB7fSlcbiAgICAgIGFnZW50RGVmc1Byb21pc2U/LmNhdGNoKCgpID0+IHt9KVxuICAgICAgYXdhaXQgc2V0dXBQcm9taXNlXG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgIGBbU1RBUlRVUF0gc2V0dXAoKSBjb21wbGV0ZWQgaW4gJHtEYXRlLm5vdygpIC0gc2V0dXBTdGFydH1tc2AsXG4gICAgICApXG4gICAgICBwcm9maWxlQ2hlY2twb2ludCgnYWN0aW9uX2FmdGVyX3NldHVwJylcblxuICAgICAgLy8gUmVwbGF5IHVzZXIgbWVzc2FnZXMgaW50byBzdHJlYW0tanNvbiBvbmx5IHdoZW4gdGhlIHNvY2tldCB3YXNcbiAgICAgIC8vIGV4cGxpY2l0bHkgcmVxdWVzdGVkLiBUaGUgYXV0by1nZW5lcmF0ZWQgc29ja2V0IGlzIHBhc3NpdmUg4oCUIGl0XG4gICAgICAvLyBsZXRzIHRvb2xzIGluamVjdCBpZiB0aGV5IHdhbnQgdG8sIGJ1dCB0dXJuaW5nIGl0IG9uIGJ5IGRlZmF1bHRcbiAgICAgIC8vIHNob3VsZG4ndCByZXNoYXBlIHN0cmVhbS1qc29uIGZvciBTREsgY29uc3VtZXJzIHdobyBuZXZlciB0b3VjaCBpdC5cbiAgICAgIC8vIENhbGxlcnMgd2hvIGluamVjdCBhbmQgYWxzbyB3YW50IHRob3NlIGluamVjdGlvbnMgdmlzaWJsZSBpbiB0aGVcbiAgICAgIC8vIHN0cmVhbSBwYXNzIC0tbWVzc2FnaW5nLXNvY2tldC1wYXRoIGV4cGxpY2l0bHkgKG9yIC0tcmVwbGF5LXVzZXItbWVzc2FnZXMpLlxuICAgICAgbGV0IGVmZmVjdGl2ZVJlcGxheVVzZXJNZXNzYWdlcyA9ICEhb3B0aW9ucy5yZXBsYXlVc2VyTWVzc2FnZXNcbiAgICAgIGlmIChmZWF0dXJlKCdVRFNfSU5CT1gnKSkge1xuICAgICAgICBpZiAoIWVmZmVjdGl2ZVJlcGxheVVzZXJNZXNzYWdlcyAmJiBvdXRwdXRGb3JtYXQgPT09ICdzdHJlYW0tanNvbicpIHtcbiAgICAgICAgICBlZmZlY3RpdmVSZXBsYXlVc2VyTWVzc2FnZXMgPSAhIShcbiAgICAgICAgICAgIG9wdGlvbnMgYXMgeyBtZXNzYWdpbmdTb2NrZXRQYXRoPzogc3RyaW5nIH1cbiAgICAgICAgICApLm1lc3NhZ2luZ1NvY2tldFBhdGhcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZ2V0SXNOb25JbnRlcmFjdGl2ZVNlc3Npb24oKSkge1xuICAgICAgICAvLyBBcHBseSBmdWxsIG1lcmdlZCBzZXR0aW5ncyBlbnYgbm93IChpbmNsdWRpbmcgcHJvamVjdC1zY29wZWRcbiAgICAgICAgLy8gLmNsYXVkZS9zZXR0aW5ncy5qc29uIFBBVEgvR0lUX0RJUi9HSVRfV09SS19UUkVFKSBzbyBnaXRFeGUoKSBhbmRcbiAgICAgICAgLy8gdGhlIGdpdCBzcGF3biBiZWxvdyBzZWUgaXQuIFRydXN0IGlzIGltcGxpY2l0IGluIC1wIG1vZGU7IHRoZVxuICAgICAgICAvLyBkb2NzdHJpbmcgYXQgbWFuYWdlZEVudi50czo5Ni05NyBzYXlzIHRoaXMgYXBwbGllcyBcInBvdGVudGlhbGx5XG4gICAgICAgIC8vIGRhbmdlcm91cyBlbnZpcm9ubWVudCB2YXJpYWJsZXMgc3VjaCBhcyBMRF9QUkVMT0FELCBQQVRIXCIgZnJvbSBhbGxcbiAgICAgICAgLy8gc291cmNlcy4gVGhlIGxhdGVyIGNhbGwgaW4gdGhlIGlzTm9uSW50ZXJhY3RpdmVTZXNzaW9uIGJsb2NrIGJlbG93XG4gICAgICAgIC8vIGlzIGlkZW1wb3RlbnQgKE9iamVjdC5hc3NpZ24sIGNvbmZpZ3VyZUdsb2JhbEFnZW50cyBlamVjdHMgcHJpb3JcbiAgICAgICAgLy8gaW50ZXJjZXB0b3IpIGFuZCBwaWNrcyB1cCBhbnkgcGx1Z2luLWNvbnRyaWJ1dGVkIGVudiBhZnRlciBwbHVnaW5cbiAgICAgICAgLy8gaW5pdC4gUHJvamVjdCBzZXR0aW5ncyBhcmUgYWxyZWFkeSBsb2FkZWQgaGVyZTpcbiAgICAgICAgLy8gYXBwbHlTYWZlQ29uZmlnRW52aXJvbm1lbnRWYXJpYWJsZXMgaW4gaW5pdCgpIGNhbGxlZFxuICAgICAgICAvLyBnZXRTZXR0aW5nc19ERVBSRUNBVEVEIGF0IG1hbmFnZWRFbnYudHM6ODYgd2hpY2ggbWVyZ2VzIGFsbCBlbmFibGVkXG4gICAgICAgIC8vIHNvdXJjZXMgaW5jbHVkaW5nIHByb2plY3RTZXR0aW5ncy9sb2NhbFNldHRpbmdzLlxuICAgICAgICBhcHBseUNvbmZpZ0Vudmlyb25tZW50VmFyaWFibGVzKClcblxuICAgICAgICAvLyBTcGF3biBnaXQgc3RhdHVzL2xvZy9icmFuY2ggbm93IHNvIHRoZSBzdWJwcm9jZXNzIGV4ZWN1dGlvbiBvdmVybGFwc1xuICAgICAgICAvLyB3aXRoIHRoZSBnZXRDb21tYW5kcyBhd2FpdCBiZWxvdyBhbmQgc3RhcnREZWZlcnJlZFByZWZldGNoZXMuIEFmdGVyXG4gICAgICAgIC8vIHNldHVwKCkgc28gY3dkIGlzIGZpbmFsIChzZXR1cC50czoyNTQgbWF5IHByb2Nlc3MuY2hkaXIod29ya3RyZWVQYXRoKVxuICAgICAgICAvLyBmb3IgLS13b3JrdHJlZSkgYW5kIGFmdGVyIHRoZSBhcHBseUNvbmZpZ0Vudmlyb25tZW50VmFyaWFibGVzIGFib3ZlXG4gICAgICAgIC8vIHNvIFBBVEgvR0lUX0RJUi9HSVRfV09SS19UUkVFIGZyb20gYWxsIHNvdXJjZXMgKHRydXN0ZWQgKyBwcm9qZWN0KVxuICAgICAgICAvLyBhcmUgYXBwbGllZC4gZ2V0U3lzdGVtQ29udGV4dCBpcyBtZW1vaXplZDsgdGhlXG4gICAgICAgIC8vIHByZWZldGNoU3lzdGVtQ29udGV4dElmU2FmZSBjYWxsIGluIHN0YXJ0RGVmZXJyZWRQcmVmZXRjaGVzIGJlY29tZXNcbiAgICAgICAgLy8gYSBjYWNoZSBoaXQuIFRoZSBtaWNyb3Rhc2sgZnJvbSBhd2FpdCBnZXRJc0dpdCgpIGRyYWlucyBhdCB0aGVcbiAgICAgICAgLy8gZ2V0Q29tbWFuZHMgUHJvbWlzZS5hbGwgYXdhaXQgYmVsb3cuIFRydXN0IGlzIGltcGxpY2l0IGluIC1wIG1vZGVcbiAgICAgICAgLy8gKHNhbWUgZ2F0ZSBhcyBwcmVmZXRjaFN5c3RlbUNvbnRleHRJZlNhZmUpLlxuICAgICAgICB2b2lkIGdldFN5c3RlbUNvbnRleHQoKVxuICAgICAgICAvLyBLaWNrIGdldFVzZXJDb250ZXh0IG5vdyB0b28g4oCUIGl0cyBmaXJzdCBhd2FpdCAoZnMucmVhZEZpbGUgaW5cbiAgICAgICAgLy8gZ2V0TWVtb3J5RmlsZXMpIHlpZWxkcyBuYXR1cmFsbHksIHNvIHRoZSBDTEFVREUubWQgZGlyZWN0b3J5IHdhbGtcbiAgICAgICAgLy8gcnVucyBkdXJpbmcgdGhlIH4yODBtcyBvdmVybGFwIHdpbmRvdyBiZWZvcmUgdGhlIGNvbnRleHRcbiAgICAgICAgLy8gUHJvbWlzZS5hbGwgam9pbiBpbiBwcmludC50cy4gVGhlIHZvaWQgZ2V0VXNlckNvbnRleHQoKSBpblxuICAgICAgICAvLyBzdGFydERlZmVycmVkUHJlZmV0Y2hlcyBiZWNvbWVzIGEgbWVtb2l6ZSBjYWNoZS1oaXQuXG4gICAgICAgIHZvaWQgZ2V0VXNlckNvbnRleHQoKVxuICAgICAgICAvLyBLaWNrIGVuc3VyZU1vZGVsU3RyaW5nc0luaXRpYWxpemVkIG5vdyDigJQgZm9yIEJlZHJvY2sgdGhpcyB0cmlnZ2Vyc1xuICAgICAgICAvLyBhIDEwMC0yMDBtcyBwcm9maWxlIGZldGNoIHRoYXQgd2FzIGF3YWl0ZWQgc2VyaWFsbHkgYXRcbiAgICAgICAgLy8gcHJpbnQudHM6NzM5LiB1cGRhdGVCZWRyb2NrTW9kZWxTdHJpbmdzIGlzIHNlcXVlbnRpYWwoKS13cmFwcGVkIHNvXG4gICAgICAgIC8vIHRoZSBhd2FpdCBqb2lucyB0aGUgaW4tZmxpZ2h0IGZldGNoLiBOb24tQmVkcm9jayBpcyBhIHN5bmNcbiAgICAgICAgLy8gZWFybHktcmV0dXJuICh6ZXJvLWNvc3QpLlxuICAgICAgICB2b2lkIGVuc3VyZU1vZGVsU3RyaW5nc0luaXRpYWxpemVkKClcbiAgICAgIH1cblxuICAgICAgLy8gQXBwbHkgLS1uYW1lOiBjYWNoZS1vbmx5IHNvIG5vIG9ycGhhbiBmaWxlIGlzIGNyZWF0ZWQgYmVmb3JlIHRoZVxuICAgICAgLy8gc2Vzc2lvbiBJRCBpcyBmaW5hbGl6ZWQgYnkgLS1jb250aW51ZS8tLXJlc3VtZS4gbWF0ZXJpYWxpemVTZXNzaW9uRmlsZVxuICAgICAgLy8gcGVyc2lzdHMgaXQgb24gdGhlIGZpcnN0IHVzZXIgbWVzc2FnZTsgUkVQTCdzIHVzZVRlcm1pbmFsVGl0bGUgcmVhZHMgaXRcbiAgICAgIC8vIHZpYSBnZXRDdXJyZW50U2Vzc2lvblRpdGxlLlxuICAgICAgY29uc3Qgc2Vzc2lvbk5hbWVBcmcgPSBvcHRpb25zLm5hbWU/LnRyaW0oKVxuICAgICAgaWYgKHNlc3Npb25OYW1lQXJnKSB7XG4gICAgICAgIGNhY2hlU2Vzc2lvblRpdGxlKHNlc3Npb25OYW1lQXJnKVxuICAgICAgfVxuXG4gICAgICAvLyBBbnQgbW9kZWwgYWxpYXNlcyAoY2FweWJhcmEtZmFzdCBldGMuKSByZXNvbHZlIHZpYSB0aGVcbiAgICAgIC8vIHRlbmd1X2FudF9tb2RlbF9vdmVycmlkZSBHcm93dGhCb29rIGZsYWcuIF9DQUNIRURfTUFZX0JFX1NUQUxFIHJlYWRzXG4gICAgICAvLyBkaXNrIHN5bmNocm9ub3VzbHk7IGRpc2sgaXMgcG9wdWxhdGVkIGJ5IGEgZmlyZS1hbmQtZm9yZ2V0IHdyaXRlLiBPbiBhXG4gICAgICAvLyBjb2xkIGNhY2hlLCBwYXJzZVVzZXJTcGVjaWZpZWRNb2RlbCByZXR1cm5zIHRoZSB1bnJlc29sdmVkIGFsaWFzLCB0aGVcbiAgICAgIC8vIEFQSSA0MDRzLCBhbmQgLXAgZXhpdHMgYmVmb3JlIHRoZSBhc3luYyB3cml0ZSBsYW5kcyDigJQgY3Jhc2hsb29wIG9uXG4gICAgICAvLyBmcmVzaCBwb2RzLiBBd2FpdGluZyBpbml0IGhlcmUgcG9wdWxhdGVzIHRoZSBpbi1tZW1vcnkgcGF5bG9hZCBtYXAgdGhhdFxuICAgICAgLy8gX0NBQ0hFRF9NQVlfQkVfU1RBTEUgbm93IGNoZWNrcyBmaXJzdC4gR2F0ZWQgc28gdGhlIHdhcm0gcGF0aCBzdGF5c1xuICAgICAgLy8gbm9uLWJsb2NraW5nOlxuICAgICAgLy8gIC0gZXhwbGljaXQgbW9kZWwgdmlhIC0tbW9kZWwgb3IgQU5USFJPUElDX01PREVMIChib3RoIGZlZWQgYWxpYXMgcmVzb2x1dGlvbilcbiAgICAgIC8vICAtIG5vIGVudiBvdmVycmlkZSAod2hpY2ggc2hvcnQtY2lyY3VpdHMgX0NBQ0hFRF9NQVlfQkVfU1RBTEUgYmVmb3JlIGRpc2spXG4gICAgICAvLyAgLSBmbGFnIGFic2VudCBmcm9tIGRpc2sgKD09IG51bGwgYWxzbyBjYXRjaGVzIHByZS0jMjIyNzkgcG9pc29uZWQgbnVsbClcbiAgICAgIGNvbnN0IGV4cGxpY2l0TW9kZWwgPSBvcHRpb25zLm1vZGVsIHx8IHByb2Nlc3MuZW52LkFOVEhST1BJQ19NT0RFTFxuICAgICAgaWYgKFxuICAgICAgICBcImV4dGVybmFsXCIgPT09ICdhbnQnICYmXG4gICAgICAgIGV4cGxpY2l0TW9kZWwgJiZcbiAgICAgICAgZXhwbGljaXRNb2RlbCAhPT0gJ2RlZmF1bHQnICYmXG4gICAgICAgICFoYXNHcm93dGhCb29rRW52T3ZlcnJpZGUoJ3Rlbmd1X2FudF9tb2RlbF9vdmVycmlkZScpICYmXG4gICAgICAgIGdldEdsb2JhbENvbmZpZygpLmNhY2hlZEdyb3d0aEJvb2tGZWF0dXJlcz8uW1xuICAgICAgICAgICd0ZW5ndV9hbnRfbW9kZWxfb3ZlcnJpZGUnXG4gICAgICAgIF0gPT0gbnVsbFxuICAgICAgKSB7XG4gICAgICAgIGF3YWl0IGluaXRpYWxpemVHcm93dGhCb29rKClcbiAgICAgIH1cblxuICAgICAgLy8gU3BlY2lhbCBjYXNlIHRoZSBkZWZhdWx0IG1vZGVsIHdpdGggdGhlIG51bGwga2V5d29yZFxuICAgICAgLy8gTk9URTogTW9kZWwgcmVzb2x1dGlvbiBoYXBwZW5zIGFmdGVyIHNldHVwKCkgdG8gZW5zdXJlIHRydXN0IGlzIGVzdGFibGlzaGVkIGJlZm9yZSBBV1MgYXV0aFxuICAgICAgY29uc3QgdXNlclNwZWNpZmllZE1vZGVsID1cbiAgICAgICAgb3B0aW9ucy5tb2RlbCA9PT0gJ2RlZmF1bHQnID8gZ2V0RGVmYXVsdE1haW5Mb29wTW9kZWwoKSA6IG9wdGlvbnMubW9kZWxcbiAgICAgIGNvbnN0IHVzZXJTcGVjaWZpZWRGYWxsYmFja01vZGVsID1cbiAgICAgICAgZmFsbGJhY2tNb2RlbCA9PT0gJ2RlZmF1bHQnID8gZ2V0RGVmYXVsdE1haW5Mb29wTW9kZWwoKSA6IGZhbGxiYWNrTW9kZWxcblxuICAgICAgLy8gUmV1c2UgcHJlU2V0dXBDd2QgdW5sZXNzIHNldHVwKCkgY2hkaXInZCAod29ya3RyZWVFbmFibGVkKS4gU2F2ZXMgYVxuICAgICAgLy8gZ2V0Q3dkKCkgc3lzY2FsbCBpbiB0aGUgY29tbW9uIHBhdGguXG4gICAgICBjb25zdCBjdXJyZW50Q3dkID0gd29ya3RyZWVFbmFibGVkID8gZ2V0Q3dkKCkgOiBwcmVTZXR1cEN3ZFxuICAgICAgbG9nRm9yRGVidWdnaW5nKCdbU1RBUlRVUF0gTG9hZGluZyBjb21tYW5kcyBhbmQgYWdlbnRzLi4uJylcbiAgICAgIGNvbnN0IGNvbW1hbmRzU3RhcnQgPSBEYXRlLm5vdygpXG4gICAgICAvLyBKb2luIHRoZSBwcm9taXNlcyBraWNrZWQgYmVmb3JlIHNldHVwKCkgKG9yIHN0YXJ0IGZyZXNoIGlmXG4gICAgICAvLyB3b3JrdHJlZUVuYWJsZWQgZ2F0ZWQgdGhlIGVhcmx5IGtpY2spLiBCb3RoIG1lbW9pemVkIGJ5IGN3ZC5cbiAgICAgIGNvbnN0IFtjb21tYW5kcywgYWdlbnREZWZpbml0aW9uc1Jlc3VsdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIGNvbW1hbmRzUHJvbWlzZSA/PyBnZXRDb21tYW5kcyhjdXJyZW50Q3dkKSxcbiAgICAgICAgYWdlbnREZWZzUHJvbWlzZSA/PyBnZXRBZ2VudERlZmluaXRpb25zV2l0aE92ZXJyaWRlcyhjdXJyZW50Q3dkKSxcbiAgICAgIF0pXG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgIGBbU1RBUlRVUF0gQ29tbWFuZHMgYW5kIGFnZW50cyBsb2FkZWQgaW4gJHtEYXRlLm5vdygpIC0gY29tbWFuZHNTdGFydH1tc2AsXG4gICAgICApXG4gICAgICBwcm9maWxlQ2hlY2twb2ludCgnYWN0aW9uX2NvbW1hbmRzX2xvYWRlZCcpXG5cbiAgICAgIC8vIFBhcnNlIENMSSBhZ2VudHMgaWYgcHJvdmlkZWQgdmlhIC0tYWdlbnRzIGZsYWdcbiAgICAgIGxldCBjbGlBZ2VudHM6IHR5cGVvZiBhZ2VudERlZmluaXRpb25zUmVzdWx0LmFjdGl2ZUFnZW50cyA9IFtdXG4gICAgICBpZiAoYWdlbnRzSnNvbikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHBhcnNlZEFnZW50cyA9IHNhZmVQYXJzZUpTT04oYWdlbnRzSnNvbilcbiAgICAgICAgICBpZiAocGFyc2VkQWdlbnRzKSB7XG4gICAgICAgICAgICBjbGlBZ2VudHMgPSBwYXJzZUFnZW50c0Zyb21Kc29uKHBhcnNlZEFnZW50cywgJ2ZsYWdTZXR0aW5ncycpXG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGxvZ0Vycm9yKGVycm9yKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE1lcmdlIENMSSBhZ2VudHMgd2l0aCBleGlzdGluZyBvbmVzXG4gICAgICBjb25zdCBhbGxBZ2VudHMgPSBbLi4uYWdlbnREZWZpbml0aW9uc1Jlc3VsdC5hbGxBZ2VudHMsIC4uLmNsaUFnZW50c11cbiAgICAgIGNvbnN0IGFnZW50RGVmaW5pdGlvbnMgPSB7XG4gICAgICAgIC4uLmFnZW50RGVmaW5pdGlvbnNSZXN1bHQsXG4gICAgICAgIGFsbEFnZW50cyxcbiAgICAgICAgYWN0aXZlQWdlbnRzOiBnZXRBY3RpdmVBZ2VudHNGcm9tTGlzdChhbGxBZ2VudHMpLFxuICAgICAgfVxuXG4gICAgICAvLyBMb29rIHVwIG1haW4gdGhyZWFkIGFnZW50IGZyb20gQ0xJIGZsYWcgb3Igc2V0dGluZ3NcbiAgICAgIGNvbnN0IGFnZW50U2V0dGluZyA9IGFnZW50Q2xpID8/IGdldEluaXRpYWxTZXR0aW5ncygpLmFnZW50XG4gICAgICBsZXQgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbjpcbiAgICAgICAgfCAodHlwZW9mIGFnZW50RGVmaW5pdGlvbnMuYWN0aXZlQWdlbnRzKVtudW1iZXJdXG4gICAgICAgIHwgdW5kZWZpbmVkXG4gICAgICBpZiAoYWdlbnRTZXR0aW5nKSB7XG4gICAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24gPSBhZ2VudERlZmluaXRpb25zLmFjdGl2ZUFnZW50cy5maW5kKFxuICAgICAgICAgIGFnZW50ID0+IGFnZW50LmFnZW50VHlwZSA9PT0gYWdlbnRTZXR0aW5nLFxuICAgICAgICApXG4gICAgICAgIGlmICghbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbikge1xuICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgIGBXYXJuaW5nOiBhZ2VudCBcIiR7YWdlbnRTZXR0aW5nfVwiIG5vdCBmb3VuZC4gYCArXG4gICAgICAgICAgICAgIGBBdmFpbGFibGUgYWdlbnRzOiAke2FnZW50RGVmaW5pdGlvbnMuYWN0aXZlQWdlbnRzLm1hcChhID0+IGEuYWdlbnRUeXBlKS5qb2luKCcsICcpfS4gYCArXG4gICAgICAgICAgICAgIGBVc2luZyBkZWZhdWx0IGJlaGF2aW9yLmAsXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFN0b3JlIHRoZSBtYWluIHRocmVhZCBhZ2VudCB0eXBlIGluIGJvb3RzdHJhcCBzdGF0ZSBzbyBob29rcyBjYW4gYWNjZXNzIGl0XG4gICAgICBzZXRNYWluVGhyZWFkQWdlbnRUeXBlKG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24/LmFnZW50VHlwZSlcblxuICAgICAgLy8gTG9nIGFnZW50IGZsYWcgdXNhZ2Ug4oCUIG9ubHkgbG9nIGFnZW50IG5hbWUgZm9yIGJ1aWx0LWluIGFnZW50cyB0byBhdm9pZCBsZWFraW5nIGN1c3RvbSBhZ2VudCBuYW1lc1xuICAgICAgaWYgKG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24pIHtcbiAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2FnZW50X2ZsYWcnLCB7XG4gICAgICAgICAgYWdlbnRUeXBlOiBpc0J1aWx0SW5BZ2VudChtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uKVxuICAgICAgICAgICAgPyAobWFpblRocmVhZEFnZW50RGVmaW5pdGlvbi5hZ2VudFR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUylcbiAgICAgICAgICAgIDogKCdjdXN0b20nIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMpLFxuICAgICAgICAgIC4uLihhZ2VudENsaSAmJiB7XG4gICAgICAgICAgICBzb3VyY2U6XG4gICAgICAgICAgICAgICdjbGknIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIC8vIFBlcnNpc3QgYWdlbnQgc2V0dGluZyB0byBzZXNzaW9uIHRyYW5zY3JpcHQgZm9yIHJlc3VtZSB2aWV3IGRpc3BsYXkgYW5kIHJlc3RvcmF0aW9uXG4gICAgICBpZiAobWFpblRocmVhZEFnZW50RGVmaW5pdGlvbj8uYWdlbnRUeXBlKSB7XG4gICAgICAgIHNhdmVBZ2VudFNldHRpbmcobWFpblRocmVhZEFnZW50RGVmaW5pdGlvbi5hZ2VudFR5cGUpXG4gICAgICB9XG5cbiAgICAgIC8vIEFwcGx5IHRoZSBhZ2VudCdzIHN5c3RlbSBwcm9tcHQgZm9yIG5vbi1pbnRlcmFjdGl2ZSBzZXNzaW9uc1xuICAgICAgLy8gKGludGVyYWN0aXZlIG1vZGUgdXNlcyBidWlsZEVmZmVjdGl2ZVN5c3RlbVByb21wdCBpbnN0ZWFkKVxuICAgICAgaWYgKFxuICAgICAgICBpc05vbkludGVyYWN0aXZlU2Vzc2lvbiAmJlxuICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uICYmXG4gICAgICAgICFzeXN0ZW1Qcm9tcHQgJiZcbiAgICAgICAgIWlzQnVpbHRJbkFnZW50KG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24pXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgYWdlbnRTeXN0ZW1Qcm9tcHQgPSBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLmdldFN5c3RlbVByb21wdCgpXG4gICAgICAgIGlmIChhZ2VudFN5c3RlbVByb21wdCkge1xuICAgICAgICAgIHN5c3RlbVByb21wdCA9IGFnZW50U3lzdGVtUHJvbXB0XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gaW5pdGlhbFByb21wdCBnb2VzIGZpcnN0IHNvIGl0cyBzbGFzaCBjb21tYW5kIChpZiBhbnkpIGlzIHByb2Nlc3NlZDtcbiAgICAgIC8vIHVzZXItcHJvdmlkZWQgdGV4dCBiZWNvbWVzIHRyYWlsaW5nIGNvbnRleHQuXG4gICAgICAvLyBPbmx5IGNvbmNhdGVuYXRlIHdoZW4gaW5wdXRQcm9tcHQgaXMgYSBzdHJpbmcuIFdoZW4gaXQncyBhblxuICAgICAgLy8gQXN5bmNJdGVyYWJsZSAoU0RLIHN0cmVhbS1qc29uIG1vZGUpLCB0ZW1wbGF0ZSBpbnRlcnBvbGF0aW9uIHdvdWxkXG4gICAgICAvLyBjYWxsIC50b1N0cmluZygpIHByb2R1Y2luZyBcIltvYmplY3QgT2JqZWN0XVwiLiBUaGUgQXN5bmNJdGVyYWJsZSBjYXNlXG4gICAgICAvLyBpcyBoYW5kbGVkIGluIHByaW50LnRzIHZpYSBzdHJ1Y3R1cmVkSU8ucHJlcGVuZFVzZXJNZXNzYWdlKCkuXG4gICAgICBpZiAobWFpblRocmVhZEFnZW50RGVmaW5pdGlvbj8uaW5pdGlhbFByb21wdCkge1xuICAgICAgICBpZiAodHlwZW9mIGlucHV0UHJvbXB0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGlucHV0UHJvbXB0ID0gaW5wdXRQcm9tcHRcbiAgICAgICAgICAgID8gYCR7bWFpblRocmVhZEFnZW50RGVmaW5pdGlvbi5pbml0aWFsUHJvbXB0fVxcblxcbiR7aW5wdXRQcm9tcHR9YFxuICAgICAgICAgICAgOiBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLmluaXRpYWxQcm9tcHRcbiAgICAgICAgfSBlbHNlIGlmICghaW5wdXRQcm9tcHQpIHtcbiAgICAgICAgICBpbnB1dFByb21wdCA9IG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24uaW5pdGlhbFByb21wdFxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIENvbXB1dGUgZWZmZWN0aXZlIG1vZGVsIGVhcmx5IHNvIGhvb2tzIGNhbiBydW4gaW4gcGFyYWxsZWwgd2l0aCBNQ1BcbiAgICAgIC8vIElmIHVzZXIgZGlkbid0IHNwZWNpZnkgYSBtb2RlbCBidXQgYWdlbnQgaGFzIG9uZSwgdXNlIHRoZSBhZ2VudCdzIG1vZGVsXG4gICAgICBsZXQgZWZmZWN0aXZlTW9kZWwgPSB1c2VyU3BlY2lmaWVkTW9kZWxcbiAgICAgIGlmIChcbiAgICAgICAgIWVmZmVjdGl2ZU1vZGVsICYmXG4gICAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24/Lm1vZGVsICYmXG4gICAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24ubW9kZWwgIT09ICdpbmhlcml0J1xuICAgICAgKSB7XG4gICAgICAgIGVmZmVjdGl2ZU1vZGVsID0gcGFyc2VVc2VyU3BlY2lmaWVkTW9kZWwoXG4gICAgICAgICAgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbi5tb2RlbCxcbiAgICAgICAgKVxuICAgICAgfVxuXG4gICAgICBzZXRNYWluTG9vcE1vZGVsT3ZlcnJpZGUoZWZmZWN0aXZlTW9kZWwpXG5cbiAgICAgIC8vIENvbXB1dGUgcmVzb2x2ZWQgbW9kZWwgZm9yIGhvb2tzICh1c2UgdXNlci1zcGVjaWZpZWQgbW9kZWwgYXQgbGF1bmNoKVxuICAgICAgc2V0SW5pdGlhbE1haW5Mb29wTW9kZWwoZ2V0VXNlclNwZWNpZmllZE1vZGVsU2V0dGluZygpIHx8IG51bGwpXG4gICAgICBjb25zdCBpbml0aWFsTWFpbkxvb3BNb2RlbCA9IGdldEluaXRpYWxNYWluTG9vcE1vZGVsKClcbiAgICAgIGNvbnN0IHJlc29sdmVkSW5pdGlhbE1vZGVsID0gcGFyc2VVc2VyU3BlY2lmaWVkTW9kZWwoXG4gICAgICAgIGluaXRpYWxNYWluTG9vcE1vZGVsID8/IGdldERlZmF1bHRNYWluTG9vcE1vZGVsKCksXG4gICAgICApXG5cbiAgICAgIGxldCBhZHZpc29yTW9kZWw6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICAgaWYgKGlzQWR2aXNvckVuYWJsZWQoKSkge1xuICAgICAgICBjb25zdCBhZHZpc29yT3B0aW9uID0gY2FuVXNlckNvbmZpZ3VyZUFkdmlzb3IoKVxuICAgICAgICAgID8gKG9wdGlvbnMgYXMgeyBhZHZpc29yPzogc3RyaW5nIH0pLmFkdmlzb3JcbiAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICBpZiAoYWR2aXNvck9wdGlvbikge1xuICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhgW0Fkdmlzb3JUb29sXSAtLWFkdmlzb3IgJHthZHZpc29yT3B0aW9ufWApXG4gICAgICAgICAgaWYgKCFtb2RlbFN1cHBvcnRzQWR2aXNvcihyZXNvbHZlZEluaXRpYWxNb2RlbCkpIHtcbiAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgICBjaGFsay5yZWQoXG4gICAgICAgICAgICAgICAgYEVycm9yOiBUaGUgbW9kZWwgXCIke3Jlc29sdmVkSW5pdGlhbE1vZGVsfVwiIGRvZXMgbm90IHN1cHBvcnQgdGhlIGFkdmlzb3IgdG9vbC5cXG5gLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRBZHZpc29yTW9kZWwgPSBub3JtYWxpemVNb2RlbFN0cmluZ0ZvckFQSShcbiAgICAgICAgICAgIHBhcnNlVXNlclNwZWNpZmllZE1vZGVsKGFkdmlzb3JPcHRpb24pLFxuICAgICAgICAgIClcbiAgICAgICAgICBpZiAoIWlzVmFsaWRBZHZpc29yTW9kZWwobm9ybWFsaXplZEFkdmlzb3JNb2RlbCkpIHtcbiAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgICBjaGFsay5yZWQoXG4gICAgICAgICAgICAgICAgYEVycm9yOiBUaGUgbW9kZWwgXCIke2Fkdmlzb3JPcHRpb259XCIgY2Fubm90IGJlIHVzZWQgYXMgYW4gYWR2aXNvci5cXG5gLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGFkdmlzb3JNb2RlbCA9IGNhblVzZXJDb25maWd1cmVBZHZpc29yKClcbiAgICAgICAgICA/IChhZHZpc29yT3B0aW9uID8/IGdldEluaXRpYWxBZHZpc29yU2V0dGluZygpKVxuICAgICAgICAgIDogYWR2aXNvck9wdGlvblxuICAgICAgICBpZiAoYWR2aXNvck1vZGVsKSB7XG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKGBbQWR2aXNvclRvb2xdIEFkdmlzb3IgbW9kZWw6ICR7YWR2aXNvck1vZGVsfWApXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gRm9yIHRtdXggdGVhbW1hdGVzIHdpdGggLS1hZ2VudC10eXBlLCBhcHBlbmQgdGhlIGN1c3RvbSBhZ2VudCdzIHByb21wdFxuICAgICAgaWYgKFxuICAgICAgICBpc0FnZW50U3dhcm1zRW5hYmxlZCgpICYmXG4gICAgICAgIHN0b3JlZFRlYW1tYXRlT3B0cz8uYWdlbnRJZCAmJlxuICAgICAgICBzdG9yZWRUZWFtbWF0ZU9wdHM/LmFnZW50TmFtZSAmJlxuICAgICAgICBzdG9yZWRUZWFtbWF0ZU9wdHM/LnRlYW1OYW1lICYmXG4gICAgICAgIHN0b3JlZFRlYW1tYXRlT3B0cz8uYWdlbnRUeXBlXG4gICAgICApIHtcbiAgICAgICAgLy8gTG9vayB1cCB0aGUgY3VzdG9tIGFnZW50IGRlZmluaXRpb25cbiAgICAgICAgY29uc3QgY3VzdG9tQWdlbnQgPSBhZ2VudERlZmluaXRpb25zLmFjdGl2ZUFnZW50cy5maW5kKFxuICAgICAgICAgIGEgPT4gYS5hZ2VudFR5cGUgPT09IHN0b3JlZFRlYW1tYXRlT3B0cy5hZ2VudFR5cGUsXG4gICAgICAgIClcbiAgICAgICAgaWYgKGN1c3RvbUFnZW50KSB7XG4gICAgICAgICAgLy8gR2V0IHRoZSBwcm9tcHQgLSBuZWVkIHRvIGhhbmRsZSBib3RoIGJ1aWx0LWluIGFuZCBjdXN0b20gYWdlbnRzXG4gICAgICAgICAgbGV0IGN1c3RvbVByb21wdDogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgICAgaWYgKGN1c3RvbUFnZW50LnNvdXJjZSA9PT0gJ2J1aWx0LWluJykge1xuICAgICAgICAgICAgLy8gQnVpbHQtaW4gYWdlbnRzIGhhdmUgZ2V0U3lzdGVtUHJvbXB0IHRoYXQgdGFrZXMgdG9vbFVzZUNvbnRleHRcbiAgICAgICAgICAgIC8vIFdlIGNhbid0IGFjY2VzcyBmdWxsIHRvb2xVc2VDb250ZXh0IGhlcmUsIHNvIHNraXAgZm9yIG5vd1xuICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgICBgW3RlYW1tYXRlXSBCdWlsdC1pbiBhZ2VudCAke3N0b3JlZFRlYW1tYXRlT3B0cy5hZ2VudFR5cGV9IC0gc2tpcHBpbmcgY3VzdG9tIHByb21wdCAobm90IHN1cHBvcnRlZClgLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBDdXN0b20gYWdlbnRzIGhhdmUgZ2V0U3lzdGVtUHJvbXB0IHRoYXQgdGFrZXMgbm8gYXJnc1xuICAgICAgICAgICAgY3VzdG9tUHJvbXB0ID0gY3VzdG9tQWdlbnQuZ2V0U3lzdGVtUHJvbXB0KClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBMb2cgYWdlbnQgbWVtb3J5IGxvYWRlZCBldmVudCBmb3IgdG11eCB0ZWFtbWF0ZXNcbiAgICAgICAgICBpZiAoY3VzdG9tQWdlbnQubWVtb3J5KSB7XG4gICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfYWdlbnRfbWVtb3J5X2xvYWRlZCcsIHtcbiAgICAgICAgICAgICAgLi4uKFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYge1xuICAgICAgICAgICAgICAgIGFnZW50X3R5cGU6XG4gICAgICAgICAgICAgICAgICBjdXN0b21BZ2VudC5hZ2VudFR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIHNjb3BlOlxuICAgICAgICAgICAgICAgIGN1c3RvbUFnZW50Lm1lbW9yeSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICBzb3VyY2U6XG4gICAgICAgICAgICAgICAgJ3RlYW1tYXRlJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY3VzdG9tUHJvbXB0KSB7XG4gICAgICAgICAgICBjb25zdCBjdXN0b21JbnN0cnVjdGlvbnMgPSBgXFxuIyBDdXN0b20gQWdlbnQgSW5zdHJ1Y3Rpb25zXFxuJHtjdXN0b21Qcm9tcHR9YFxuICAgICAgICAgICAgYXBwZW5kU3lzdGVtUHJvbXB0ID0gYXBwZW5kU3lzdGVtUHJvbXB0XG4gICAgICAgICAgICAgID8gYCR7YXBwZW5kU3lzdGVtUHJvbXB0fVxcblxcbiR7Y3VzdG9tSW5zdHJ1Y3Rpb25zfWBcbiAgICAgICAgICAgICAgOiBjdXN0b21JbnN0cnVjdGlvbnNcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgYFt0ZWFtbWF0ZV0gQ3VzdG9tIGFnZW50ICR7c3RvcmVkVGVhbW1hdGVPcHRzLmFnZW50VHlwZX0gbm90IGZvdW5kIGluIGF2YWlsYWJsZSBhZ2VudHNgLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBtYXliZUFjdGl2YXRlQnJpZWYob3B0aW9ucylcbiAgICAgIC8vIGRlZmF1bHRWaWV3OiAnY2hhdCcgaXMgYSBwZXJzaXN0ZWQgb3B0LWluIOKAlCBjaGVjayBlbnRpdGxlbWVudCBhbmQgc2V0XG4gICAgICAvLyB1c2VyTXNnT3B0SW4gc28gdGhlIHRvb2wgKyBwcm9tcHQgc2VjdGlvbiBhY3RpdmF0ZS4gSW50ZXJhY3RpdmUtb25seTpcbiAgICAgIC8vIGRlZmF1bHRWaWV3IGlzIGEgZGlzcGxheSBwcmVmZXJlbmNlOyBTREsgc2Vzc2lvbnMgaGF2ZSBubyBkaXNwbGF5LCBhbmRcbiAgICAgIC8vIHRoZSBhc3Npc3RhbnQgaW5zdGFsbGVyIHdyaXRlcyBkZWZhdWx0VmlldzonY2hhdCcgdG8gc2V0dGluZ3MubG9jYWwuanNvblxuICAgICAgLy8gd2hpY2ggd291bGQgb3RoZXJ3aXNlIGxlYWsgaW50byAtLXByaW50IHNlc3Npb25zIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAgICAgIC8vIFJ1bnMgcmlnaHQgYWZ0ZXIgbWF5YmVBY3RpdmF0ZUJyaWVmKCkgc28gYWxsIHN0YXJ0dXAgb3B0LWluIHBhdGhzIGZpcmVcbiAgICAgIC8vIEJFRk9SRSBhbnkgaXNCcmllZkVuYWJsZWQoKSByZWFkIGJlbG93IChwcm9hY3RpdmUgcHJvbXB0J3NcbiAgICAgIC8vIGJyaWVmVmlzaWJpbGl0eSkuIEEgcGVyc2lzdGVkICdjaGF0JyBhZnRlciBhIEdCIGtpbGwtc3dpdGNoIGZhbGxzXG4gICAgICAvLyB0aHJvdWdoIChlbnRpdGxlbWVudCBmYWlscykuXG4gICAgICBpZiAoXG4gICAgICAgIChmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQlJJRUYnKSkgJiZcbiAgICAgICAgIWdldElzTm9uSW50ZXJhY3RpdmVTZXNzaW9uKCkgJiZcbiAgICAgICAgIWdldFVzZXJNc2dPcHRJbigpICYmXG4gICAgICAgIGdldEluaXRpYWxTZXR0aW5ncygpLmRlZmF1bHRWaWV3ID09PSAnY2hhdCdcbiAgICAgICkge1xuICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgICAgIGNvbnN0IHsgaXNCcmllZkVudGl0bGVkIH0gPVxuICAgICAgICAgIHJlcXVpcmUoJy4vdG9vbHMvQnJpZWZUb29sL0JyaWVmVG9vbC5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vdG9vbHMvQnJpZWZUb29sL0JyaWVmVG9vbC5qcycpXG4gICAgICAgIC8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICBpZiAoaXNCcmllZkVudGl0bGVkKCkpIHtcbiAgICAgICAgICBzZXRVc2VyTXNnT3B0SW4odHJ1ZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gQ29vcmRpbmF0b3IgbW9kZSBoYXMgaXRzIG93biBzeXN0ZW0gcHJvbXB0IGFuZCBmaWx0ZXJzIG91dCBTbGVlcCwgc29cbiAgICAgIC8vIHRoZSBnZW5lcmljIHByb2FjdGl2ZSBwcm9tcHQgd291bGQgdGVsbCBpdCB0byBjYWxsIGEgdG9vbCBpdCBjYW4ndFxuICAgICAgLy8gYWNjZXNzIGFuZCBjb25mbGljdCB3aXRoIGRlbGVnYXRpb24gaW5zdHJ1Y3Rpb25zLlxuICAgICAgaWYgKFxuICAgICAgICAoZmVhdHVyZSgnUFJPQUNUSVZFJykgfHwgZmVhdHVyZSgnS0FJUk9TJykpICYmXG4gICAgICAgICgob3B0aW9ucyBhcyB7IHByb2FjdGl2ZT86IGJvb2xlYW4gfSkucHJvYWN0aXZlIHx8XG4gICAgICAgICAgaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfUFJPQUNUSVZFKSkgJiZcbiAgICAgICAgIWNvb3JkaW5hdG9yTW9kZU1vZHVsZT8uaXNDb29yZGluYXRvck1vZGUoKVxuICAgICAgKSB7XG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgY29uc3QgYnJpZWZWaXNpYmlsaXR5ID1cbiAgICAgICAgICBmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQlJJRUYnKVxuICAgICAgICAgICAgPyAoXG4gICAgICAgICAgICAgICAgcmVxdWlyZSgnLi90b29scy9CcmllZlRvb2wvQnJpZWZUb29sLmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi90b29scy9CcmllZlRvb2wvQnJpZWZUb29sLmpzJylcbiAgICAgICAgICAgICAgKS5pc0JyaWVmRW5hYmxlZCgpXG4gICAgICAgICAgICAgID8gJ0NhbGwgU2VuZFVzZXJNZXNzYWdlIGF0IGNoZWNrcG9pbnRzIHRvIG1hcmsgd2hlcmUgdGhpbmdzIHN0YW5kLidcbiAgICAgICAgICAgICAgOiAnVGhlIHVzZXIgd2lsbCBzZWUgYW55IHRleHQgeW91IG91dHB1dC4nXG4gICAgICAgICAgICA6ICdUaGUgdXNlciB3aWxsIHNlZSBhbnkgdGV4dCB5b3Ugb3V0cHV0LidcbiAgICAgICAgLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgICAgIGNvbnN0IHByb2FjdGl2ZVByb21wdCA9IGBcXG4jIFByb2FjdGl2ZSBNb2RlXFxuXFxuWW91IGFyZSBpbiBwcm9hY3RpdmUgbW9kZS4gVGFrZSBpbml0aWF0aXZlIOKAlCBleHBsb3JlLCBhY3QsIGFuZCBtYWtlIHByb2dyZXNzIHdpdGhvdXQgd2FpdGluZyBmb3IgaW5zdHJ1Y3Rpb25zLlxcblxcblN0YXJ0IGJ5IGJyaWVmbHkgZ3JlZXRpbmcgdGhlIHVzZXIuXFxuXFxuWW91IHdpbGwgcmVjZWl2ZSBwZXJpb2RpYyA8dGljaz4gcHJvbXB0cy4gVGhlc2UgYXJlIGNoZWNrLWlucy4gRG8gd2hhdGV2ZXIgc2VlbXMgbW9zdCB1c2VmdWwsIG9yIGNhbGwgU2xlZXAgaWYgdGhlcmUncyBub3RoaW5nIHRvIGRvLiAke2JyaWVmVmlzaWJpbGl0eX1gXG4gICAgICAgIGFwcGVuZFN5c3RlbVByb21wdCA9IGFwcGVuZFN5c3RlbVByb21wdFxuICAgICAgICAgID8gYCR7YXBwZW5kU3lzdGVtUHJvbXB0fVxcblxcbiR7cHJvYWN0aXZlUHJvbXB0fWBcbiAgICAgICAgICA6IHByb2FjdGl2ZVByb21wdFxuICAgICAgfVxuXG4gICAgICBpZiAoZmVhdHVyZSgnS0FJUk9TJykgJiYga2Fpcm9zRW5hYmxlZCAmJiBhc3Npc3RhbnRNb2R1bGUpIHtcbiAgICAgICAgY29uc3QgYXNzaXN0YW50QWRkZW5kdW0gPVxuICAgICAgICAgIGFzc2lzdGFudE1vZHVsZS5nZXRBc3Npc3RhbnRTeXN0ZW1Qcm9tcHRBZGRlbmR1bSgpXG4gICAgICAgIGFwcGVuZFN5c3RlbVByb21wdCA9IGFwcGVuZFN5c3RlbVByb21wdFxuICAgICAgICAgID8gYCR7YXBwZW5kU3lzdGVtUHJvbXB0fVxcblxcbiR7YXNzaXN0YW50QWRkZW5kdW19YFxuICAgICAgICAgIDogYXNzaXN0YW50QWRkZW5kdW1cbiAgICAgIH1cblxuICAgICAgLy8gSW5rIHJvb3QgaXMgb25seSBuZWVkZWQgZm9yIGludGVyYWN0aXZlIHNlc3Npb25zIOKAlCBwYXRjaENvbnNvbGUgaW4gdGhlXG4gICAgICAvLyBJbmsgY29uc3RydWN0b3Igd291bGQgc3dhbGxvdyBjb25zb2xlIG91dHB1dCBpbiBoZWFkbGVzcyBtb2RlLlxuICAgICAgbGV0IHJvb3QhOiBSb290XG4gICAgICBsZXQgZ2V0RnBzTWV0cmljcyE6ICgpID0+IEZwc01ldHJpY3MgfCB1bmRlZmluZWRcbiAgICAgIGxldCBzdGF0cyE6IFN0YXRzU3RvcmVcblxuICAgICAgLy8gU2hvdyBzZXR1cCBzY3JlZW5zIGFmdGVyIGNvbW1hbmRzIGFyZSBsb2FkZWRcbiAgICAgIGlmICghaXNOb25JbnRlcmFjdGl2ZVNlc3Npb24pIHtcbiAgICAgICAgY29uc3QgY3R4ID0gZ2V0UmVuZGVyQ29udGV4dChmYWxzZSlcbiAgICAgICAgZ2V0RnBzTWV0cmljcyA9IGN0eC5nZXRGcHNNZXRyaWNzXG4gICAgICAgIHN0YXRzID0gY3R4LnN0YXRzXG4gICAgICAgIC8vIEluc3RhbGwgYXNjaWljYXN0IHJlY29yZGVyIGJlZm9yZSBJbmsgbW91bnRzIChhbnQtb25seSwgb3B0LWluIHZpYSBDTEFVREVfQ09ERV9URVJNSU5BTF9SRUNPUkRJTkc9MSlcbiAgICAgICAgaWYgKFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcpIHtcbiAgICAgICAgICBpbnN0YWxsQXNjaWljYXN0UmVjb3JkZXIoKVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBjcmVhdGVSb290IH0gPSBhd2FpdCBpbXBvcnQoJy4vaW5rLmpzJylcbiAgICAgICAgcm9vdCA9IGF3YWl0IGNyZWF0ZVJvb3QoY3R4LnJlbmRlck9wdGlvbnMpXG5cbiAgICAgICAgLy8gTG9nIHN0YXJ0dXAgdGltZSBub3csIGJlZm9yZSBhbnkgYmxvY2tpbmcgZGlhbG9nIHJlbmRlcnMuIExvZ2dpbmdcbiAgICAgICAgLy8gZnJvbSBSRVBMJ3MgZmlyc3QgcmVuZGVyICh0aGUgb2xkIGxvY2F0aW9uKSBpbmNsdWRlZCBob3dldmVyIGxvbmdcbiAgICAgICAgLy8gdGhlIHVzZXIgc2F0IG9uIHRydXN0L09BdXRoL29uYm9hcmRpbmcvcmVzdW1lLXBpY2tlciDigJQgcDk5IHdhcyB+NzBzXG4gICAgICAgIC8vIGRvbWluYXRlZCBieSBkaWFsb2ctd2FpdCB0aW1lLCBub3QgY29kZS1wYXRoIHN0YXJ0dXAuXG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90aW1lcicsIHtcbiAgICAgICAgICBldmVudDpcbiAgICAgICAgICAgICdzdGFydHVwJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIGR1cmF0aW9uTXM6IE1hdGgucm91bmQocHJvY2Vzcy51cHRpbWUoKSAqIDEwMDApLFxuICAgICAgICB9KVxuXG4gICAgICAgIGxvZ0ZvckRlYnVnZ2luZygnW1NUQVJUVVBdIFJ1bm5pbmcgc2hvd1NldHVwU2NyZWVucygpLi4uJylcbiAgICAgICAgY29uc3Qgc2V0dXBTY3JlZW5zU3RhcnQgPSBEYXRlLm5vdygpXG4gICAgICAgIGNvbnN0IG9uYm9hcmRpbmdTaG93biA9IGF3YWl0IHNob3dTZXR1cFNjcmVlbnMoXG4gICAgICAgICAgcm9vdCxcbiAgICAgICAgICBwZXJtaXNzaW9uTW9kZSxcbiAgICAgICAgICBhbGxvd0Rhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zLFxuICAgICAgICAgIGNvbW1hbmRzLFxuICAgICAgICAgIGVuYWJsZUNsYXVkZUluQ2hyb21lLFxuICAgICAgICAgIGRldkNoYW5uZWxzLFxuICAgICAgICApXG4gICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICBgW1NUQVJUVVBdIHNob3dTZXR1cFNjcmVlbnMoKSBjb21wbGV0ZWQgaW4gJHtEYXRlLm5vdygpIC0gc2V0dXBTY3JlZW5zU3RhcnR9bXNgLFxuICAgICAgICApXG5cbiAgICAgICAgLy8gTm93IHRoYXQgdHJ1c3QgaXMgZXN0YWJsaXNoZWQgYW5kIEdyb3d0aEJvb2sgaGFzIGF1dGggaGVhZGVycyxcbiAgICAgICAgLy8gcmVzb2x2ZSB0aGUgLS1yZW1vdGUtY29udHJvbCAvIC0tcmMgZW50aXRsZW1lbnQgZ2F0ZS5cbiAgICAgICAgaWYgKGZlYXR1cmUoJ0JSSURHRV9NT0RFJykgJiYgcmVtb3RlQ29udHJvbE9wdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgeyBnZXRCcmlkZ2VEaXNhYmxlZFJlYXNvbiB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgJy4vYnJpZGdlL2JyaWRnZUVuYWJsZWQuanMnXG4gICAgICAgICAgKVxuICAgICAgICAgIGNvbnN0IGRpc2FibGVkUmVhc29uID0gYXdhaXQgZ2V0QnJpZGdlRGlzYWJsZWRSZWFzb24oKVxuICAgICAgICAgIHJlbW90ZUNvbnRyb2wgPSBkaXNhYmxlZFJlYXNvbiA9PT0gbnVsbFxuICAgICAgICAgIGlmIChkaXNhYmxlZFJlYXNvbikge1xuICAgICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgICAgICAgIGNoYWxrLnllbGxvdyhgJHtkaXNhYmxlZFJlYXNvbn1cXG4tLXJjIGZsYWcgaWdub3JlZC5cXG5gKSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBmb3IgcGVuZGluZyBhZ2VudCBtZW1vcnkgc25hcHNob3QgdXBkYXRlcyAob25seSBmb3IgLS1hZ2VudCBtb2RlLCBhbnQtb25seSlcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGZlYXR1cmUoJ0FHRU5UX01FTU9SWV9TTkFQU0hPVCcpICYmXG4gICAgICAgICAgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbiAmJlxuICAgICAgICAgIGlzQ3VzdG9tQWdlbnQobWFpblRocmVhZEFnZW50RGVmaW5pdGlvbikgJiZcbiAgICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLm1lbW9yeSAmJlxuICAgICAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24ucGVuZGluZ1NuYXBzaG90VXBkYXRlXG4gICAgICAgICkge1xuICAgICAgICAgIGNvbnN0IGFnZW50RGVmID0gbWFpblRocmVhZEFnZW50RGVmaW5pdGlvblxuICAgICAgICAgIGNvbnN0IGNob2ljZSA9IGF3YWl0IGxhdW5jaFNuYXBzaG90VXBkYXRlRGlhbG9nKHJvb3QsIHtcbiAgICAgICAgICAgIGFnZW50VHlwZTogYWdlbnREZWYuYWdlbnRUeXBlLFxuICAgICAgICAgICAgc2NvcGU6IGFnZW50RGVmLm1lbW9yeSEsXG4gICAgICAgICAgICBzbmFwc2hvdFRpbWVzdGFtcDpcbiAgICAgICAgICAgICAgYWdlbnREZWYucGVuZGluZ1NuYXBzaG90VXBkYXRlIS5zbmFwc2hvdFRpbWVzdGFtcCxcbiAgICAgICAgICB9KVxuICAgICAgICAgIGlmIChjaG9pY2UgPT09ICdtZXJnZScpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgYnVpbGRNZXJnZVByb21wdCB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgICAnLi9jb21wb25lbnRzL2FnZW50cy9TbmFwc2hvdFVwZGF0ZURpYWxvZy5qcydcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIGNvbnN0IG1lcmdlUHJvbXB0ID0gYnVpbGRNZXJnZVByb21wdChcbiAgICAgICAgICAgICAgYWdlbnREZWYuYWdlbnRUeXBlLFxuICAgICAgICAgICAgICBhZ2VudERlZi5tZW1vcnkhLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgaW5wdXRQcm9tcHQgPSBpbnB1dFByb21wdFxuICAgICAgICAgICAgICA/IGAke21lcmdlUHJvbXB0fVxcblxcbiR7aW5wdXRQcm9tcHR9YFxuICAgICAgICAgICAgICA6IG1lcmdlUHJvbXB0XG4gICAgICAgICAgfVxuICAgICAgICAgIGFnZW50RGVmLnBlbmRpbmdTbmFwc2hvdFVwZGF0ZSA9IHVuZGVmaW5lZFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2tpcCBleGVjdXRpbmcgL2xvZ2luIGlmIHdlIGp1c3QgY29tcGxldGVkIG9uYm9hcmRpbmcgZm9yIGl0XG4gICAgICAgIGlmIChvbmJvYXJkaW5nU2hvd24gJiYgcHJvbXB0Py50cmltKCkudG9Mb3dlckNhc2UoKSA9PT0gJy9sb2dpbicpIHtcbiAgICAgICAgICBwcm9tcHQgPSAnJ1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9uYm9hcmRpbmdTaG93bikge1xuICAgICAgICAgIC8vIFJlZnJlc2ggYXV0aC1kZXBlbmRlbnQgc2VydmljZXMgbm93IHRoYXQgdGhlIHVzZXIgaGFzIGxvZ2dlZCBpbiBkdXJpbmcgb25ib2FyZGluZy5cbiAgICAgICAgICAvLyBLZWVwIGluIHN5bmMgd2l0aCB0aGUgcG9zdC1sb2dpbiBsb2dpYyBpbiBzcmMvY29tbWFuZHMvbG9naW4udHN4XG4gICAgICAgICAgdm9pZCByZWZyZXNoUmVtb3RlTWFuYWdlZFNldHRpbmdzKClcbiAgICAgICAgICB2b2lkIHJlZnJlc2hQb2xpY3lMaW1pdHMoKVxuICAgICAgICAgIC8vIENsZWFyIHVzZXIgZGF0YSBjYWNoZSBCRUZPUkUgR3Jvd3RoQm9vayByZWZyZXNoIHNvIGl0IHBpY2tzIHVwIGZyZXNoIGNyZWRlbnRpYWxzXG4gICAgICAgICAgcmVzZXRVc2VyQ2FjaGUoKVxuICAgICAgICAgIC8vIFJlZnJlc2ggR3Jvd3RoQm9vayBhZnRlciBsb2dpbiB0byBnZXQgdXBkYXRlZCBmZWF0dXJlIGZsYWdzIChlLmcuLCBmb3IgY2xhdWRlLmFpIE1DUHMpXG4gICAgICAgICAgcmVmcmVzaEdyb3d0aEJvb2tBZnRlckF1dGhDaGFuZ2UoKVxuICAgICAgICAgIC8vIENsZWFyIGFueSBzdGFsZSB0cnVzdGVkIGRldmljZSB0b2tlbiB0aGVuIGVucm9sbCBmb3IgUmVtb3RlIENvbnRyb2wuXG4gICAgICAgICAgLy8gQm90aCBzZWxmLWdhdGUgb24gdGVuZ3Vfc2Vzc2lvbnNfZWxldmF0ZWRfYXV0aF9lbmZvcmNlbWVudCBpbnRlcm5hbGx5XG4gICAgICAgICAgLy8g4oCUIGVucm9sbFRydXN0ZWREZXZpY2UoKSB2aWEgY2hlY2tHYXRlX0NBQ0hFRF9PUl9CTE9DS0lORyAoYXdhaXRzXG4gICAgICAgICAgLy8gdGhlIEdyb3d0aEJvb2sgcmVpbml0IGFib3ZlKSwgY2xlYXJUcnVzdGVkRGV2aWNlVG9rZW4oKSB2aWEgdGhlXG4gICAgICAgICAgLy8gc3luYyBjYWNoZWQgY2hlY2sgKGFjY2VwdGFibGUgc2luY2UgY2xlYXIgaXMgaWRlbXBvdGVudCkuXG4gICAgICAgICAgdm9pZCBpbXBvcnQoJy4vYnJpZGdlL3RydXN0ZWREZXZpY2UuanMnKS50aGVuKG0gPT4ge1xuICAgICAgICAgICAgbS5jbGVhclRydXN0ZWREZXZpY2VUb2tlbigpXG4gICAgICAgICAgICByZXR1cm4gbS5lbnJvbGxUcnVzdGVkRGV2aWNlKClcbiAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVmFsaWRhdGUgdGhhdCB0aGUgYWN0aXZlIHRva2VuJ3Mgb3JnIG1hdGNoZXMgZm9yY2VMb2dpbk9yZ1VVSUQgKGlmIHNldFxuICAgICAgICAvLyBpbiBtYW5hZ2VkIHNldHRpbmdzKS4gUnVucyBhZnRlciBvbmJvYXJkaW5nIHNvIG1hbmFnZWQgc2V0dGluZ3MgYW5kXG4gICAgICAgIC8vIGxvZ2luIHN0YXRlIGFyZSBmdWxseSBsb2FkZWQuXG4gICAgICAgIGNvbnN0IG9yZ1ZhbGlkYXRpb24gPSBhd2FpdCB2YWxpZGF0ZUZvcmNlTG9naW5PcmcoKVxuICAgICAgICBpZiAoIW9yZ1ZhbGlkYXRpb24udmFsaWQpIHtcbiAgICAgICAgICBhd2FpdCBleGl0V2l0aEVycm9yKHJvb3QsIG9yZ1ZhbGlkYXRpb24ubWVzc2FnZSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBJZiBncmFjZWZ1bFNodXRkb3duIHdhcyBpbml0aWF0ZWQgKGUuZy4sIHVzZXIgcmVqZWN0ZWQgdHJ1c3QgZGlhbG9nKSxcbiAgICAgIC8vIHByb2Nlc3MuZXhpdENvZGUgd2lsbCBiZSBzZXQuIFNraXAgYWxsIHN1YnNlcXVlbnQgb3BlcmF0aW9ucyB0aGF0IGNvdWxkXG4gICAgICAvLyB0cmlnZ2VyIGNvZGUgZXhlY3V0aW9uIGJlZm9yZSB0aGUgcHJvY2VzcyBleGl0cyAoZS5nLiB3ZSBkb24ndCB3YW50IGFwaUtleUhlbHBlclxuICAgICAgLy8gdG8gcnVuIGlmIHRydXN0IHdhcyBub3QgZXN0YWJsaXNoZWQpLlxuICAgICAgaWYgKHByb2Nlc3MuZXhpdENvZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICAgJ0dyYWNlZnVsIHNodXRkb3duIGluaXRpYXRlZCwgc2tpcHBpbmcgZnVydGhlciBpbml0aWFsaXphdGlvbicsXG4gICAgICAgIClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIEluaXRpYWxpemUgTFNQIG1hbmFnZXIgQUZURVIgdHJ1c3QgaXMgZXN0YWJsaXNoZWQgKG9yIGluIG5vbi1pbnRlcmFjdGl2ZSBtb2RlXG4gICAgICAvLyB3aGVyZSB0cnVzdCBpcyBpbXBsaWNpdCkuIFRoaXMgcHJldmVudHMgcGx1Z2luIExTUCBzZXJ2ZXJzIGZyb20gZXhlY3V0aW5nXG4gICAgICAvLyBjb2RlIGluIHVudHJ1c3RlZCBkaXJlY3RvcmllcyBiZWZvcmUgdXNlciBjb25zZW50LlxuICAgICAgLy8gTXVzdCBiZSBhZnRlciBpbmxpbmUgcGx1Z2lucyBhcmUgc2V0IChpZiBhbnkpIHNvIC0tcGx1Z2luLWRpciBMU1Agc2VydmVycyBhcmUgaW5jbHVkZWQuXG4gICAgICBpbml0aWFsaXplTHNwU2VydmVyTWFuYWdlcigpXG5cbiAgICAgIC8vIFNob3cgc2V0dGluZ3MgdmFsaWRhdGlvbiBlcnJvcnMgYWZ0ZXIgdHJ1c3QgaXMgZXN0YWJsaXNoZWRcbiAgICAgIC8vIE1DUCBjb25maWcgZXJyb3JzIGRvbid0IGJsb2NrIHNldHRpbmdzIGZyb20gbG9hZGluZywgc28gZXhjbHVkZSB0aGVtXG4gICAgICBpZiAoIWlzTm9uSW50ZXJhY3RpdmVTZXNzaW9uKSB7XG4gICAgICAgIGNvbnN0IHsgZXJyb3JzIH0gPSBnZXRTZXR0aW5nc1dpdGhFcnJvcnMoKVxuICAgICAgICBjb25zdCBub25NY3BFcnJvcnMgPSBlcnJvcnMuZmlsdGVyKGUgPT4gIWUubWNwRXJyb3JNZXRhZGF0YSlcbiAgICAgICAgaWYgKG5vbk1jcEVycm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgYXdhaXQgbGF1bmNoSW52YWxpZFNldHRpbmdzRGlhbG9nKHJvb3QsIHtcbiAgICAgICAgICAgIHNldHRpbmdzRXJyb3JzOiBub25NY3BFcnJvcnMsXG4gICAgICAgICAgICBvbkV4aXQ6ICgpID0+IGdyYWNlZnVsU2h1dGRvd25TeW5jKDEpLFxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgcXVvdGEgc3RhdHVzLCBmYXN0IG1vZGUsIHBhc3NlcyBlbGlnaWJpbGl0eSwgYW5kIGJvb3RzdHJhcCBkYXRhXG4gICAgICAvLyBhZnRlciB0cnVzdCBpcyBlc3RhYmxpc2hlZC4gVGhlc2UgbWFrZSBBUEkgY2FsbHMgd2hpY2ggY291bGQgdHJpZ2dlclxuICAgICAgLy8gYXBpS2V5SGVscGVyIGV4ZWN1dGlvbi5cbiAgICAgIC8vIC0tYmFyZSAvIFNJTVBMRTogc2tpcCDigJQgdGhlc2UgYXJlIGNhY2hlLXdhcm1zIGZvciB0aGUgUkVQTCdzXG4gICAgICAvLyBmaXJzdC10dXJuIHJlc3BvbnNpdmVuZXNzIChxdW90YSwgcGFzc2VzLCBmYXN0TW9kZSwgYm9vdHN0cmFwIGRhdGEpLiBGYXN0XG4gICAgICAvLyBtb2RlIGRvZXNuJ3QgYXBwbHkgdG8gdGhlIEFnZW50IFNESyBhbnl3YXkgKHNlZSBnZXRGYXN0TW9kZVVuYXZhaWxhYmxlUmVhc29uKS5cbiAgICAgIGNvbnN0IGJnUmVmcmVzaFRocm90dGxlTXMgPSBnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRShcbiAgICAgICAgJ3Rlbmd1X2NpY2FkYV9uYXBfbXMnLFxuICAgICAgICAwLFxuICAgICAgKVxuICAgICAgY29uc3QgbGFzdFByZWZldGNoZWQgPSBnZXRHbG9iYWxDb25maWcoKS5zdGFydHVwUHJlZmV0Y2hlZEF0ID8/IDBcbiAgICAgIGNvbnN0IHNraXBTdGFydHVwUHJlZmV0Y2hlcyA9XG4gICAgICAgIGlzQmFyZU1vZGUoKSB8fFxuICAgICAgICAoYmdSZWZyZXNoVGhyb3R0bGVNcyA+IDAgJiZcbiAgICAgICAgICBEYXRlLm5vdygpIC0gbGFzdFByZWZldGNoZWQgPCBiZ1JlZnJlc2hUaHJvdHRsZU1zKVxuXG4gICAgICBpZiAoIXNraXBTdGFydHVwUHJlZmV0Y2hlcykge1xuICAgICAgICBjb25zdCBsYXN0UHJlZmV0Y2hlZEluZm8gPVxuICAgICAgICAgIGxhc3RQcmVmZXRjaGVkID4gMFxuICAgICAgICAgICAgPyBgIGxhc3QgcmFuICR7TWF0aC5yb3VuZCgoRGF0ZS5ub3coKSAtIGxhc3RQcmVmZXRjaGVkKSAvIDEwMDApfXMgYWdvYFxuICAgICAgICAgICAgOiAnJ1xuICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICAgYFN0YXJ0aW5nIGJhY2tncm91bmQgc3RhcnR1cCBwcmVmZXRjaGVzJHtsYXN0UHJlZmV0Y2hlZEluZm99YCxcbiAgICAgICAgKVxuXG4gICAgICAgIGNoZWNrUXVvdGFTdGF0dXMoKS5jYXRjaChlcnJvciA9PiBsb2dFcnJvcihlcnJvcikpXG5cbiAgICAgICAgLy8gRmV0Y2ggYm9vdHN0cmFwIGRhdGEgZnJvbSB0aGUgc2VydmVyIGFuZCB1cGRhdGUgYWxsIGNhY2hlIHZhbHVlcy5cbiAgICAgICAgdm9pZCBmZXRjaEJvb3RzdHJhcERhdGEoKVxuXG4gICAgICAgIC8vIFRPRE86IENvbnNvbGlkYXRlIG90aGVyIHByZWZldGNoZXMgaW50byBhIHNpbmdsZSBib290c3RyYXAgcmVxdWVzdC5cbiAgICAgICAgdm9pZCBwcmVmZXRjaFBhc3Nlc0VsaWdpYmlsaXR5KClcbiAgICAgICAgaWYgKFxuICAgICAgICAgICFnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSgndGVuZ3VfbWlyYWN1bG9fdGhlX2JhcmQnLCBmYWxzZSlcbiAgICAgICAgKSB7XG4gICAgICAgICAgdm9pZCBwcmVmZXRjaEZhc3RNb2RlU3RhdHVzKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBLaWxsIHN3aXRjaCBza2lwcyB0aGUgbmV0d29yayBjYWxsLCBub3Qgb3JnLXBvbGljeSBlbmZvcmNlbWVudC5cbiAgICAgICAgICAvLyBSZXNvbHZlIGZyb20gY2FjaGUgc28gb3JnU3RhdHVzIGRvZXNuJ3Qgc3RheSAncGVuZGluZycgKHdoaWNoXG4gICAgICAgICAgLy8gZ2V0RmFzdE1vZGVVbmF2YWlsYWJsZVJlYXNvbiB0cmVhdHMgYXMgcGVybWlzc2l2ZSkuXG4gICAgICAgICAgcmVzb2x2ZUZhc3RNb2RlU3RhdHVzRnJvbUNhY2hlKClcbiAgICAgICAgfVxuICAgICAgICBpZiAoYmdSZWZyZXNoVGhyb3R0bGVNcyA+IDApIHtcbiAgICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAgICAgICAgIC4uLmN1cnJlbnQsXG4gICAgICAgICAgICBzdGFydHVwUHJlZmV0Y2hlZEF0OiBEYXRlLm5vdygpLFxuICAgICAgICAgIH0pKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICAgYFNraXBwaW5nIHN0YXJ0dXAgcHJlZmV0Y2hlcywgbGFzdCByYW4gJHtNYXRoLnJvdW5kKChEYXRlLm5vdygpIC0gbGFzdFByZWZldGNoZWQpIC8gMTAwMCl9cyBhZ29gLFxuICAgICAgICApXG4gICAgICAgIC8vIFJlc29sdmUgZmFzdCBtb2RlIG9yZyBzdGF0dXMgZnJvbSBjYWNoZSAobm8gbmV0d29yaylcbiAgICAgICAgcmVzb2x2ZUZhc3RNb2RlU3RhdHVzRnJvbUNhY2hlKClcbiAgICAgIH1cblxuICAgICAgaWYgKCFpc05vbkludGVyYWN0aXZlU2Vzc2lvbikge1xuICAgICAgICB2b2lkIHJlZnJlc2hFeGFtcGxlQ29tbWFuZHMoKSAvLyBQcmUtZmV0Y2ggZXhhbXBsZSBjb21tYW5kcyAocnVucyBnaXQgbG9nLCBubyBBUEkgY2FsbClcbiAgICAgIH1cblxuICAgICAgLy8gUmVzb2x2ZSBNQ1AgY29uZmlncyAoc3RhcnRlZCBlYXJseSwgb3ZlcmxhcHMgd2l0aCBzZXR1cC90cnVzdCBkaWFsb2cgd29yaylcbiAgICAgIGNvbnN0IHsgc2VydmVyczogZXhpc3RpbmdNY3BDb25maWdzIH0gPSBhd2FpdCBtY3BDb25maWdQcm9taXNlXG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgIGBbU1RBUlRVUF0gTUNQIGNvbmZpZ3MgcmVzb2x2ZWQgaW4gJHttY3BDb25maWdSZXNvbHZlZE1zfW1zIChhd2FpdGVkIGF0ICske0RhdGUubm93KCkgLSBtY3BDb25maWdTdGFydH1tcylgLFxuICAgICAgKVxuICAgICAgLy8gQ0xJIGZsYWcgKC0tbWNwLWNvbmZpZykgc2hvdWxkIG92ZXJyaWRlIGZpbGUtYmFzZWQgY29uZmlncywgbWF0Y2hpbmcgc2V0dGluZ3MgcHJlY2VkZW5jZVxuICAgICAgY29uc3QgYWxsTWNwQ29uZmlncyA9IHsgLi4uZXhpc3RpbmdNY3BDb25maWdzLCAuLi5keW5hbWljTWNwQ29uZmlnIH1cblxuICAgICAgLy8gU2VwYXJhdGUgU0RLIGNvbmZpZ3MgZnJvbSByZWd1bGFyIE1DUCBjb25maWdzXG4gICAgICBjb25zdCBzZGtNY3BDb25maWdzOiBSZWNvcmQ8c3RyaW5nLCBNY3BTZGtTZXJ2ZXJDb25maWc+ID0ge31cbiAgICAgIGNvbnN0IHJlZ3VsYXJNY3BDb25maWdzOiBSZWNvcmQ8c3RyaW5nLCBTY29wZWRNY3BTZXJ2ZXJDb25maWc+ID0ge31cblxuICAgICAgZm9yIChjb25zdCBbbmFtZSwgY29uZmlnXSBvZiBPYmplY3QuZW50cmllcyhhbGxNY3BDb25maWdzKSkge1xuICAgICAgICBjb25zdCB0eXBlZENvbmZpZyA9IGNvbmZpZyBhcyBTY29wZWRNY3BTZXJ2ZXJDb25maWcgfCBNY3BTZGtTZXJ2ZXJDb25maWdcbiAgICAgICAgaWYgKHR5cGVkQ29uZmlnLnR5cGUgPT09ICdzZGsnKSB7XG4gICAgICAgICAgc2RrTWNwQ29uZmlnc1tuYW1lXSA9IHR5cGVkQ29uZmlnIGFzIE1jcFNka1NlcnZlckNvbmZpZ1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlZ3VsYXJNY3BDb25maWdzW25hbWVdID0gdHlwZWRDb25maWcgYXMgU2NvcGVkTWNwU2VydmVyQ29uZmlnXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcHJvZmlsZUNoZWNrcG9pbnQoJ2FjdGlvbl9tY3BfY29uZmlnc19sb2FkZWQnKVxuXG4gICAgICAvLyBQcmVmZXRjaCBNQ1AgcmVzb3VyY2VzIGFmdGVyIHRydXN0IGRpYWxvZyAodGhpcyBpcyB3aGVyZSBleGVjdXRpb24gaGFwcGVucykuXG4gICAgICAvLyBJbnRlcmFjdGl2ZSBtb2RlIG9ubHk6IHByaW50IG1vZGUgZGVmZXJzIGNvbm5lY3RzIHVudGlsIGhlYWRsZXNzU3RvcmUgZXhpc3RzXG4gICAgICAvLyBhbmQgcHVzaGVzIHBlci1zZXJ2ZXIgKGJlbG93KSwgc28gVG9vbFNlYXJjaCdzIHBlbmRpbmctY2xpZW50IGhhbmRsaW5nIHdvcmtzXG4gICAgICAvLyBhbmQgb25lIHNsb3cgc2VydmVyIGRvZXNuJ3QgYmxvY2sgdGhlIGJhdGNoLlxuICAgICAgY29uc3QgbG9jYWxNY3BQcm9taXNlID0gaXNOb25JbnRlcmFjdGl2ZVNlc3Npb25cbiAgICAgICAgPyBQcm9taXNlLnJlc29sdmUoeyBjbGllbnRzOiBbXSwgdG9vbHM6IFtdLCBjb21tYW5kczogW10gfSlcbiAgICAgICAgOiBwcmVmZXRjaEFsbE1jcFJlc291cmNlcyhyZWd1bGFyTWNwQ29uZmlncylcbiAgICAgIGNvbnN0IGNsYXVkZWFpTWNwUHJvbWlzZSA9IGlzTm9uSW50ZXJhY3RpdmVTZXNzaW9uXG4gICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKHsgY2xpZW50czogW10sIHRvb2xzOiBbXSwgY29tbWFuZHM6IFtdIH0pXG4gICAgICAgIDogY2xhdWRlYWlDb25maWdQcm9taXNlLnRoZW4oY29uZmlncyA9PlxuICAgICAgICAgICAgT2JqZWN0LmtleXMoY29uZmlncykubGVuZ3RoID4gMFxuICAgICAgICAgICAgICA/IHByZWZldGNoQWxsTWNwUmVzb3VyY2VzKGNvbmZpZ3MpXG4gICAgICAgICAgICAgIDogeyBjbGllbnRzOiBbXSwgdG9vbHM6IFtdLCBjb21tYW5kczogW10gfSxcbiAgICAgICAgICApXG4gICAgICAvLyBNZXJnZSB3aXRoIGRlZHVwIGJ5IG5hbWU6IGVhY2ggcHJlZmV0Y2hBbGxNY3BSZXNvdXJjZXMgY2FsbCBpbmRlcGVuZGVudGx5XG4gICAgICAvLyBhZGRzIGhlbHBlciB0b29scyAoTGlzdE1jcFJlc291cmNlc1Rvb2wsIFJlYWRNY3BSZXNvdXJjZVRvb2wpIHZpYVxuICAgICAgLy8gbG9jYWwgZGVkdXAgZmxhZ3MsIHNvIG1lcmdpbmcgdHdvIGNhbGxzIGNhbiB5aWVsZCBkdXBsaWNhdGVzLiBwcmludC50c1xuICAgICAgLy8gYWxyZWFkeSB1bmlxQnkncyB0aGUgZmluYWwgdG9vbCBwb29sLCBidXQgZGVkdXAgaGVyZSBrZWVwcyBhcHBTdGF0ZSBjbGVhbi5cbiAgICAgIGNvbnN0IG1jcFByb21pc2UgPSBQcm9taXNlLmFsbChbXG4gICAgICAgIGxvY2FsTWNwUHJvbWlzZSxcbiAgICAgICAgY2xhdWRlYWlNY3BQcm9taXNlLFxuICAgICAgXSkudGhlbigoW2xvY2FsLCBjbGF1ZGVhaV0pID0+ICh7XG4gICAgICAgIGNsaWVudHM6IFsuLi5sb2NhbC5jbGllbnRzLCAuLi5jbGF1ZGVhaS5jbGllbnRzXSxcbiAgICAgICAgdG9vbHM6IHVuaXFCeShbLi4ubG9jYWwudG9vbHMsIC4uLmNsYXVkZWFpLnRvb2xzXSwgJ25hbWUnKSxcbiAgICAgICAgY29tbWFuZHM6IHVuaXFCeShbLi4ubG9jYWwuY29tbWFuZHMsIC4uLmNsYXVkZWFpLmNvbW1hbmRzXSwgJ25hbWUnKSxcbiAgICAgIH0pKVxuXG4gICAgICAvLyBTdGFydCBob29rcyBlYXJseSBzbyB0aGV5IHJ1biBpbiBwYXJhbGxlbCB3aXRoIE1DUCBjb25uZWN0aW9ucy5cbiAgICAgIC8vIFNraXAgZm9yIGluaXRPbmx5L2luaXQvbWFpbnRlbmFuY2UgKGhhbmRsZWQgc2VwYXJhdGVseSksIG5vbi1pbnRlcmFjdGl2ZVxuICAgICAgLy8gKGhhbmRsZWQgdmlhIHNldHVwVHJpZ2dlciksIGFuZCByZXN1bWUvY29udGludWUgKGNvbnZlcnNhdGlvblJlY292ZXJ5LnRzXG4gICAgICAvLyBmaXJlcyAncmVzdW1lJyBpbnN0ZWFkIOKAlCB3aXRob3V0IHRoaXMgZ3VhcmQsIGhvb2tzIGZpcmUgVFdJQ0Ugb24gL3Jlc3VtZVxuICAgICAgLy8gYW5kIHRoZSBzZWNvbmQgc3lzdGVtTWVzc2FnZSBjbG9iYmVycyB0aGUgZmlyc3QuIGdoLTMwODI1KVxuICAgICAgY29uc3QgaG9va3NQcm9taXNlID1cbiAgICAgICAgaW5pdE9ubHkgfHxcbiAgICAgICAgaW5pdCB8fFxuICAgICAgICBtYWludGVuYW5jZSB8fFxuICAgICAgICBpc05vbkludGVyYWN0aXZlU2Vzc2lvbiB8fFxuICAgICAgICBvcHRpb25zLmNvbnRpbnVlIHx8XG4gICAgICAgIG9wdGlvbnMucmVzdW1lXG4gICAgICAgICAgPyBudWxsXG4gICAgICAgICAgOiBwcm9jZXNzU2Vzc2lvblN0YXJ0SG9va3MoJ3N0YXJ0dXAnLCB7XG4gICAgICAgICAgICAgIGFnZW50VHlwZTogbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbj8uYWdlbnRUeXBlLFxuICAgICAgICAgICAgICBtb2RlbDogcmVzb2x2ZWRJbml0aWFsTW9kZWwsXG4gICAgICAgICAgICB9KVxuXG4gICAgICAvLyBNQ1AgbmV2ZXIgYmxvY2tzIFJFUEwgcmVuZGVyIE9SIHR1cm4gMSBUVEZULiB1c2VNYW5hZ2VNQ1BDb25uZWN0aW9uc1xuICAgICAgLy8gcG9wdWxhdGVzIGFwcFN0YXRlLm1jcCBhc3luYyBhcyBzZXJ2ZXJzIGNvbm5lY3QgKGNvbm5lY3RUb1NlcnZlciBpc1xuICAgICAgLy8gbWVtb2l6ZWQg4oCUIHRoZSBwcmVmZXRjaCBjYWxscyBhYm92ZSBhbmQgdGhlIGhvb2sgY29udmVyZ2Ugb24gdGhlIHNhbWVcbiAgICAgIC8vIGNvbm5lY3Rpb25zKS4gZ2V0VG9vbFVzZUNvbnRleHQgcmVhZHMgc3RvcmUuZ2V0U3RhdGUoKSBmcmVzaCB2aWFcbiAgICAgIC8vIGNvbXB1dGVUb29scygpLCBzbyB0dXJuIDEgc2VlcyB3aGF0ZXZlcidzIGNvbm5lY3RlZCBieSBxdWVyeSB0aW1lLlxuICAgICAgLy8gU2xvdyBzZXJ2ZXJzIHBvcHVsYXRlIGZvciB0dXJuIDIrLiBNYXRjaGVzIGludGVyYWN0aXZlLW5vLXByb21wdFxuICAgICAgLy8gYmVoYXZpb3IuIFByaW50IG1vZGU6IHBlci1zZXJ2ZXIgcHVzaCBpbnRvIGhlYWRsZXNzU3RvcmUgKGJlbG93KS5cbiAgICAgIGNvbnN0IGhvb2tNZXNzYWdlczogQXdhaXRlZDxOb25OdWxsYWJsZTx0eXBlb2YgaG9va3NQcm9taXNlPj4gPSBbXVxuICAgICAgLy8gU3VwcHJlc3MgdHJhbnNpZW50IHVuaGFuZGxlZFJlamVjdGlvbiDigJQgdGhlIHByZWZldGNoIHdhcm1zIHRoZVxuICAgICAgLy8gbWVtb2l6ZWQgY29ubmVjdFRvU2VydmVyIGNhY2hlIGJ1dCBub2JvZHkgYXdhaXRzIGl0IGluIGludGVyYWN0aXZlLlxuICAgICAgbWNwUHJvbWlzZS5jYXRjaCgoKSA9PiB7fSlcblxuICAgICAgY29uc3QgbWNwQ2xpZW50czogQXdhaXRlZDx0eXBlb2YgbWNwUHJvbWlzZT5bJ2NsaWVudHMnXSA9IFtdXG4gICAgICBjb25zdCBtY3BUb29sczogQXdhaXRlZDx0eXBlb2YgbWNwUHJvbWlzZT5bJ3Rvb2xzJ10gPSBbXVxuICAgICAgY29uc3QgbWNwQ29tbWFuZHM6IEF3YWl0ZWQ8dHlwZW9mIG1jcFByb21pc2U+Wydjb21tYW5kcyddID0gW11cblxuICAgICAgbGV0IHRoaW5raW5nRW5hYmxlZCA9IHNob3VsZEVuYWJsZVRoaW5raW5nQnlEZWZhdWx0KClcbiAgICAgIGxldCB0aGlua2luZ0NvbmZpZzogVGhpbmtpbmdDb25maWcgPVxuICAgICAgICB0aGlua2luZ0VuYWJsZWQgIT09IGZhbHNlID8geyB0eXBlOiAnYWRhcHRpdmUnIH0gOiB7IHR5cGU6ICdkaXNhYmxlZCcgfVxuXG4gICAgICBpZiAob3B0aW9ucy50aGlua2luZyA9PT0gJ2FkYXB0aXZlJyB8fCBvcHRpb25zLnRoaW5raW5nID09PSAnZW5hYmxlZCcpIHtcbiAgICAgICAgdGhpbmtpbmdFbmFibGVkID0gdHJ1ZVxuICAgICAgICB0aGlua2luZ0NvbmZpZyA9IHsgdHlwZTogJ2FkYXB0aXZlJyB9XG4gICAgICB9IGVsc2UgaWYgKG9wdGlvbnMudGhpbmtpbmcgPT09ICdkaXNhYmxlZCcpIHtcbiAgICAgICAgdGhpbmtpbmdFbmFibGVkID0gZmFsc2VcbiAgICAgICAgdGhpbmtpbmdDb25maWcgPSB7IHR5cGU6ICdkaXNhYmxlZCcgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbWF4VGhpbmtpbmdUb2tlbnMgPSBwcm9jZXNzLmVudi5NQVhfVEhJTktJTkdfVE9LRU5TXG4gICAgICAgICAgPyBwYXJzZUludChwcm9jZXNzLmVudi5NQVhfVEhJTktJTkdfVE9LRU5TLCAxMClcbiAgICAgICAgICA6IG9wdGlvbnMubWF4VGhpbmtpbmdUb2tlbnNcbiAgICAgICAgaWYgKG1heFRoaW5raW5nVG9rZW5zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAobWF4VGhpbmtpbmdUb2tlbnMgPiAwKSB7XG4gICAgICAgICAgICB0aGlua2luZ0VuYWJsZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlua2luZ0NvbmZpZyA9IHtcbiAgICAgICAgICAgICAgdHlwZTogJ2VuYWJsZWQnLFxuICAgICAgICAgICAgICBidWRnZXRUb2tlbnM6IG1heFRoaW5raW5nVG9rZW5zLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAobWF4VGhpbmtpbmdUb2tlbnMgPT09IDApIHtcbiAgICAgICAgICAgIHRoaW5raW5nRW5hYmxlZCA9IGZhbHNlXG4gICAgICAgICAgICB0aGlua2luZ0NvbmZpZyA9IHsgdHlwZTogJ2Rpc2FibGVkJyB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGxvZ0ZvckRpYWdub3N0aWNzTm9QSUkoJ2luZm8nLCAnc3RhcnRlZCcsIHtcbiAgICAgICAgdmVyc2lvbjogTUFDUk8uVkVSU0lPTixcbiAgICAgICAgaXNfbmF0aXZlX2JpbmFyeTogaXNJbkJ1bmRsZWRNb2RlKCksXG4gICAgICB9KVxuXG4gICAgICByZWdpc3RlckNsZWFudXAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBsb2dGb3JEaWFnbm9zdGljc05vUElJKCdpbmZvJywgJ2V4aXRlZCcpXG4gICAgICB9KVxuXG4gICAgICB2b2lkIGxvZ1Rlbmd1SW5pdCh7XG4gICAgICAgIGhhc0luaXRpYWxQcm9tcHQ6IEJvb2xlYW4ocHJvbXB0KSxcbiAgICAgICAgaGFzU3RkaW46IEJvb2xlYW4oaW5wdXRQcm9tcHQpLFxuICAgICAgICB2ZXJib3NlLFxuICAgICAgICBkZWJ1ZyxcbiAgICAgICAgZGVidWdUb1N0ZGVycixcbiAgICAgICAgcHJpbnQ6IHByaW50ID8/IGZhbHNlLFxuICAgICAgICBvdXRwdXRGb3JtYXQ6IG91dHB1dEZvcm1hdCA/PyAndGV4dCcsXG4gICAgICAgIGlucHV0Rm9ybWF0OiBpbnB1dEZvcm1hdCA/PyAndGV4dCcsXG4gICAgICAgIG51bUFsbG93ZWRUb29sczogYWxsb3dlZFRvb2xzLmxlbmd0aCxcbiAgICAgICAgbnVtRGlzYWxsb3dlZFRvb2xzOiBkaXNhbGxvd2VkVG9vbHMubGVuZ3RoLFxuICAgICAgICBtY3BDbGllbnRDb3VudDogT2JqZWN0LmtleXMoYWxsTWNwQ29uZmlncykubGVuZ3RoLFxuICAgICAgICB3b3JrdHJlZUVuYWJsZWQsXG4gICAgICAgIHNraXBXZWJGZXRjaFByZWZsaWdodDogZ2V0SW5pdGlhbFNldHRpbmdzKCkuc2tpcFdlYkZldGNoUHJlZmxpZ2h0LFxuICAgICAgICBnaXRodWJBY3Rpb25JbnB1dHM6IHByb2Nlc3MuZW52LkdJVEhVQl9BQ1RJT05fSU5QVVRTLFxuICAgICAgICBkYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uc1Bhc3NlZDogZGFuZ2Vyb3VzbHlTa2lwUGVybWlzc2lvbnMgPz8gZmFsc2UsXG4gICAgICAgIHBlcm1pc3Npb25Nb2RlLFxuICAgICAgICBtb2RlSXNCeXBhc3M6IHBlcm1pc3Npb25Nb2RlID09PSAnYnlwYXNzUGVybWlzc2lvbnMnLFxuICAgICAgICBhbGxvd0Rhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zUGFzc2VkOiBhbGxvd0Rhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zLFxuICAgICAgICBzeXN0ZW1Qcm9tcHRGbGFnOiBzeXN0ZW1Qcm9tcHRcbiAgICAgICAgICA/IG9wdGlvbnMuc3lzdGVtUHJvbXB0RmlsZVxuICAgICAgICAgICAgPyAnZmlsZSdcbiAgICAgICAgICAgIDogJ2ZsYWcnXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgIGFwcGVuZFN5c3RlbVByb21wdEZsYWc6IGFwcGVuZFN5c3RlbVByb21wdFxuICAgICAgICAgID8gb3B0aW9ucy5hcHBlbmRTeXN0ZW1Qcm9tcHRGaWxlXG4gICAgICAgICAgICA/ICdmaWxlJ1xuICAgICAgICAgICAgOiAnZmxhZydcbiAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgdGhpbmtpbmdDb25maWcsXG4gICAgICAgIGFzc2lzdGFudEFjdGl2YXRpb25QYXRoOlxuICAgICAgICAgIGZlYXR1cmUoJ0tBSVJPUycpICYmIGthaXJvc0VuYWJsZWRcbiAgICAgICAgICAgID8gYXNzaXN0YW50TW9kdWxlPy5nZXRBc3Npc3RhbnRBY3RpdmF0aW9uUGF0aCgpXG4gICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIH0pXG5cbiAgICAgIC8vIExvZyBjb250ZXh0IG1ldHJpY3Mgb25jZSBhdCBpbml0aWFsaXphdGlvblxuICAgICAgdm9pZCBsb2dDb250ZXh0TWV0cmljcyhyZWd1bGFyTWNwQ29uZmlncywgdG9vbFBlcm1pc3Npb25Db250ZXh0KVxuXG4gICAgICB2b2lkIGxvZ1Blcm1pc3Npb25Db250ZXh0Rm9yQW50cyhudWxsLCAnaW5pdGlhbGl6YXRpb24nKVxuXG4gICAgICBsb2dNYW5hZ2VkU2V0dGluZ3MoKVxuXG4gICAgICAvLyBSZWdpc3RlciBQSUQgZmlsZSBmb3IgY29uY3VycmVudC1zZXNzaW9uIGRldGVjdGlvbiAofi8uY2xhdWRlL3Nlc3Npb25zLylcbiAgICAgIC8vIGFuZCBmaXJlIG11bHRpLWNsYXVkaW5nIHRlbGVtZXRyeS4gTGl2ZXMgaGVyZSAobm90IGluaXQudHMpIHNvIG9ubHkgdGhlXG4gICAgICAvLyBSRVBMIHBhdGggcmVnaXN0ZXJzIOKAlCBub3Qgc3ViY29tbWFuZHMgbGlrZSBgY2xhdWRlIGRvY3RvcmAuIENoYWluZWQ6XG4gICAgICAvLyBjb3VudCBtdXN0IHJ1biBhZnRlciByZWdpc3RlcidzIHdyaXRlIGNvbXBsZXRlcyBvciBpdCBtaXNzZXMgb3VyIG93biBmaWxlLlxuICAgICAgdm9pZCByZWdpc3RlclNlc3Npb24oKS50aGVuKHJlZ2lzdGVyZWQgPT4ge1xuICAgICAgICBpZiAoIXJlZ2lzdGVyZWQpIHJldHVyblxuICAgICAgICBpZiAoc2Vzc2lvbk5hbWVBcmcpIHtcbiAgICAgICAgICB2b2lkIHVwZGF0ZVNlc3Npb25OYW1lKHNlc3Npb25OYW1lQXJnKVxuICAgICAgICB9XG4gICAgICAgIHZvaWQgY291bnRDb25jdXJyZW50U2Vzc2lvbnMoKS50aGVuKGNvdW50ID0+IHtcbiAgICAgICAgICBpZiAoY291bnQgPj0gMikge1xuICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2NvbmN1cnJlbnRfc2Vzc2lvbnMnLCB7IG51bV9zZXNzaW9uczogY291bnQgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9KVxuXG4gICAgICAvLyBJbml0aWFsaXplIHZlcnNpb25lZCBwbHVnaW5zIHN5c3RlbSAodHJpZ2dlcnMgVjHihpJWMiBtaWdyYXRpb24gaWZcbiAgICAgIC8vIG5lZWRlZCkuIFRoZW4gcnVuIG9ycGhhbiBHQywgVEhFTiB3YXJtIHRoZSBHcmVwL0dsb2IgZXhjbHVzaW9uIGNhY2hlLlxuICAgICAgLy8gU2VxdWVuY2luZyBtYXR0ZXJzOiB0aGUgd2FybXVwIHNjYW5zIGRpc2sgZm9yIC5vcnBoYW5lZF9hdCBtYXJrZXJzLFxuICAgICAgLy8gc28gaXQgbXVzdCBzZWUgdGhlIEdDJ3MgUGFzcyAxIChyZW1vdmUgbWFya2VycyBmcm9tIHJlaW5zdGFsbGVkXG4gICAgICAvLyB2ZXJzaW9ucykgYW5kIFBhc3MgMiAoc3RhbXAgdW5tYXJrZWQgb3JwaGFucykgYWxyZWFkeSBhcHBsaWVkLiBUaGVcbiAgICAgIC8vIHdhcm0gYWxzbyBsYW5kcyBiZWZvcmUgYXV0b3VwZGF0ZSAoZmlyZXMgb24gZmlyc3Qgc3VibWl0IGluIFJFUEwpXG4gICAgICAvLyBjYW4gb3JwaGFuIHRoaXMgc2Vzc2lvbidzIGFjdGl2ZSB2ZXJzaW9uIHVuZGVybmVhdGggdXMuXG4gICAgICAvLyAtLWJhcmUgLyBTSU1QTEU6IHNraXAgcGx1Z2luIHZlcnNpb24gc3luYyArIG9ycGhhbiBjbGVhbnVwLiBUaGVzZVxuICAgICAgLy8gYXJlIGluc3RhbGwvdXBncmFkZSBib29ra2VlcGluZyB0aGF0IHNjcmlwdGVkIGNhbGxzIGRvbid0IG5lZWQg4oCUXG4gICAgICAvLyB0aGUgbmV4dCBpbnRlcmFjdGl2ZSBzZXNzaW9uIHdpbGwgcmVjb25jaWxlLiBUaGUgYXdhaXQgaGVyZSB3YXNcbiAgICAgIC8vIGJsb2NraW5nIC1wIG9uIGEgbWFya2V0cGxhY2Ugcm91bmQtdHJpcC5cbiAgICAgIGlmIChpc0JhcmVNb2RlKCkpIHtcbiAgICAgICAgLy8gc2tpcCDigJQgbm8tb3BcbiAgICAgIH0gZWxzZSBpZiAoaXNOb25JbnRlcmFjdGl2ZVNlc3Npb24pIHtcbiAgICAgICAgLy8gSW4gaGVhZGxlc3MgbW9kZSwgYXdhaXQgdG8gZW5zdXJlIHBsdWdpbiBzeW5jIGNvbXBsZXRlcyBiZWZvcmUgQ0xJIGV4aXRzXG4gICAgICAgIGF3YWl0IGluaXRpYWxpemVWZXJzaW9uZWRQbHVnaW5zKClcbiAgICAgICAgcHJvZmlsZUNoZWNrcG9pbnQoJ2FjdGlvbl9hZnRlcl9wbHVnaW5zX2luaXQnKVxuICAgICAgICB2b2lkIGNsZWFudXBPcnBoYW5lZFBsdWdpblZlcnNpb25zSW5CYWNrZ3JvdW5kKCkudGhlbigoKSA9PlxuICAgICAgICAgIGdldEdsb2JFeGNsdXNpb25zRm9yUGx1Z2luQ2FjaGUoKSxcbiAgICAgICAgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSW4gaW50ZXJhY3RpdmUgbW9kZSwgZmlyZS1hbmQtZm9yZ2V0IOKAlCB0aGlzIGlzIHB1cmVseSBib29ra2VlcGluZ1xuICAgICAgICAvLyB0aGF0IGRvZXNuJ3QgYWZmZWN0IHJ1bnRpbWUgYmVoYXZpb3Igb2YgdGhlIGN1cnJlbnQgc2Vzc2lvblxuICAgICAgICB2b2lkIGluaXRpYWxpemVWZXJzaW9uZWRQbHVnaW5zKCkudGhlbihhc3luYyAoKSA9PiB7XG4gICAgICAgICAgcHJvZmlsZUNoZWNrcG9pbnQoJ2FjdGlvbl9hZnRlcl9wbHVnaW5zX2luaXQnKVxuICAgICAgICAgIGF3YWl0IGNsZWFudXBPcnBoYW5lZFBsdWdpblZlcnNpb25zSW5CYWNrZ3JvdW5kKClcbiAgICAgICAgICB2b2lkIGdldEdsb2JFeGNsdXNpb25zRm9yUGx1Z2luQ2FjaGUoKVxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICBjb25zdCBzZXR1cFRyaWdnZXIgPVxuICAgICAgICBpbml0T25seSB8fCBpbml0ID8gJ2luaXQnIDogbWFpbnRlbmFuY2UgPyAnbWFpbnRlbmFuY2UnIDogbnVsbFxuICAgICAgaWYgKGluaXRPbmx5KSB7XG4gICAgICAgIGFwcGx5Q29uZmlnRW52aXJvbm1lbnRWYXJpYWJsZXMoKVxuICAgICAgICBhd2FpdCBwcm9jZXNzU2V0dXBIb29rcygnaW5pdCcsIHsgZm9yY2VTeW5jRXhlY3V0aW9uOiB0cnVlIH0pXG4gICAgICAgIGF3YWl0IHByb2Nlc3NTZXNzaW9uU3RhcnRIb29rcygnc3RhcnR1cCcsIHsgZm9yY2VTeW5jRXhlY3V0aW9uOiB0cnVlIH0pXG4gICAgICAgIGdyYWNlZnVsU2h1dGRvd25TeW5jKDApXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyAtLXByaW50IG1vZGVcbiAgICAgIGlmIChpc05vbkludGVyYWN0aXZlU2Vzc2lvbikge1xuICAgICAgICBpZiAob3V0cHV0Rm9ybWF0ID09PSAnc3RyZWFtLWpzb24nIHx8IG91dHB1dEZvcm1hdCA9PT0gJ2pzb24nKSB7XG4gICAgICAgICAgc2V0SGFzRm9ybWF0dGVkT3V0cHV0KHRydWUpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcHBseSBmdWxsIGVudmlyb25tZW50IHZhcmlhYmxlcyBpbiBwcmludCBtb2RlIHNpbmNlIHRydXN0IGRpYWxvZyBpcyBieXBhc3NlZFxuICAgICAgICAvLyBUaGlzIGluY2x1ZGVzIHBvdGVudGlhbGx5IGRhbmdlcm91cyBlbnZpcm9ubWVudCB2YXJpYWJsZXMgZnJvbSB1bnRydXN0ZWQgc291cmNlc1xuICAgICAgICAvLyBidXQgcHJpbnQgbW9kZSBpcyBjb25zaWRlcmVkIHRydXN0ZWQgKGFzIGRvY3VtZW50ZWQgaW4gaGVscCB0ZXh0KVxuICAgICAgICBhcHBseUNvbmZpZ0Vudmlyb25tZW50VmFyaWFibGVzKClcblxuICAgICAgICAvLyBJbml0aWFsaXplIHRlbGVtZXRyeSBhZnRlciBlbnYgdmFycyBhcmUgYXBwbGllZCBzbyBPVEVMIGVuZHBvaW50IGVudiB2YXJzIGFuZFxuICAgICAgICAvLyBvdGVsSGVhZGVyc0hlbHBlciAod2hpY2ggcmVxdWlyZXMgdHJ1c3QgdG8gZXhlY3V0ZSkgYXJlIGF2YWlsYWJsZS5cbiAgICAgICAgaW5pdGlhbGl6ZVRlbGVtZXRyeUFmdGVyVHJ1c3QoKVxuXG4gICAgICAgIC8vIEtpY2sgU2Vzc2lvblN0YXJ0IGhvb2tzIG5vdyBzbyB0aGUgc3VicHJvY2VzcyBzcGF3biBvdmVybGFwcyB3aXRoXG4gICAgICAgIC8vIE1DUCBjb25uZWN0ICsgcGx1Z2luIGluaXQgKyBwcmludC50cyBpbXBvcnQgYmVsb3cuIGxvYWRJbml0aWFsTWVzc2FnZXNcbiAgICAgICAgLy8gam9pbnMgdGhpcyBhdCBwcmludC50czo0Mzk3LiBHdWFyZGVkIHNhbWUgYXMgbG9hZEluaXRpYWxNZXNzYWdlcyDigJRcbiAgICAgICAgLy8gY29udGludWUvcmVzdW1lL3RlbGVwb3J0IHBhdGhzIGRvbid0IGZpcmUgc3RhcnR1cCBob29rcyAob3IgZmlyZSB0aGVtXG4gICAgICAgIC8vIGNvbmRpdGlvbmFsbHkgaW5zaWRlIHRoZSByZXN1bWUgYnJhbmNoLCB3aGVyZSB0aGlzIHByb21pc2UgaXNcbiAgICAgICAgLy8gdW5kZWZpbmVkIGFuZCB0aGUgPz8gZmFsbGJhY2sgcnVucykuIEFsc28gc2tpcCB3aGVuIHNldHVwVHJpZ2dlciBpc1xuICAgICAgICAvLyBzZXQg4oCUIHRob3NlIHBhdGhzIHJ1biBzZXR1cCBob29rcyBmaXJzdCAocHJpbnQudHM6NTQ0KSwgYW5kIHNlc3Npb25cbiAgICAgICAgLy8gc3RhcnQgaG9va3MgbXVzdCB3YWl0IHVudGlsIHNldHVwIGNvbXBsZXRlcy5cbiAgICAgICAgY29uc3Qgc2Vzc2lvblN0YXJ0SG9va3NQcm9taXNlID1cbiAgICAgICAgICBvcHRpb25zLmNvbnRpbnVlIHx8IG9wdGlvbnMucmVzdW1lIHx8IHRlbGVwb3J0IHx8IHNldHVwVHJpZ2dlclxuICAgICAgICAgICAgPyB1bmRlZmluZWRcbiAgICAgICAgICAgIDogcHJvY2Vzc1Nlc3Npb25TdGFydEhvb2tzKCdzdGFydHVwJylcbiAgICAgICAgLy8gU3VwcHJlc3MgdHJhbnNpZW50IHVuaGFuZGxlZFJlamVjdGlvbiBpZiB0aGlzIHJlamVjdHMgYmVmb3JlXG4gICAgICAgIC8vIGxvYWRJbml0aWFsTWVzc2FnZXMgYXdhaXRzIGl0LiBEb3duc3RyZWFtIGF3YWl0IHN0aWxsIG9ic2VydmVzIHRoZVxuICAgICAgICAvLyByZWplY3Rpb24g4oCUIHRoaXMganVzdCBwcmV2ZW50cyB0aGUgc3B1cmlvdXMgZ2xvYmFsIGhhbmRsZXIgZmlyZS5cbiAgICAgICAgc2Vzc2lvblN0YXJ0SG9va3NQcm9taXNlPy5jYXRjaCgoKSA9PiB7fSlcblxuICAgICAgICBwcm9maWxlQ2hlY2twb2ludCgnYmVmb3JlX3ZhbGlkYXRlRm9yY2VMb2dpbk9yZycpXG4gICAgICAgIC8vIFZhbGlkYXRlIG9yZyByZXN0cmljdGlvbiBmb3Igbm9uLWludGVyYWN0aXZlIHNlc3Npb25zXG4gICAgICAgIGNvbnN0IG9yZ1ZhbGlkYXRpb24gPSBhd2FpdCB2YWxpZGF0ZUZvcmNlTG9naW5PcmcoKVxuICAgICAgICBpZiAoIW9yZ1ZhbGlkYXRpb24udmFsaWQpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShvcmdWYWxpZGF0aW9uLm1lc3NhZ2UgKyAnXFxuJylcbiAgICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEhlYWRsZXNzIG1vZGUgc3VwcG9ydHMgYWxsIHByb21wdCBjb21tYW5kcyBhbmQgc29tZSBsb2NhbCBjb21tYW5kc1xuICAgICAgICAvLyBJZiBkaXNhYmxlU2xhc2hDb21tYW5kcyBpcyB0cnVlLCByZXR1cm4gZW1wdHkgYXJyYXlcbiAgICAgICAgY29uc3QgY29tbWFuZHNIZWFkbGVzcyA9IGRpc2FibGVTbGFzaENvbW1hbmRzXG4gICAgICAgICAgPyBbXVxuICAgICAgICAgIDogY29tbWFuZHMuZmlsdGVyKFxuICAgICAgICAgICAgICBjb21tYW5kID0+XG4gICAgICAgICAgICAgICAgKGNvbW1hbmQudHlwZSA9PT0gJ3Byb21wdCcgJiYgIWNvbW1hbmQuZGlzYWJsZU5vbkludGVyYWN0aXZlKSB8fFxuICAgICAgICAgICAgICAgIChjb21tYW5kLnR5cGUgPT09ICdsb2NhbCcgJiYgY29tbWFuZC5zdXBwb3J0c05vbkludGVyYWN0aXZlKSxcbiAgICAgICAgICAgIClcblxuICAgICAgICBjb25zdCBkZWZhdWx0U3RhdGUgPSBnZXREZWZhdWx0QXBwU3RhdGUoKVxuICAgICAgICBjb25zdCBoZWFkbGVzc0luaXRpYWxTdGF0ZTogQXBwU3RhdGUgPSB7XG4gICAgICAgICAgLi4uZGVmYXVsdFN0YXRlLFxuICAgICAgICAgIG1jcDoge1xuICAgICAgICAgICAgLi4uZGVmYXVsdFN0YXRlLm1jcCxcbiAgICAgICAgICAgIGNsaWVudHM6IG1jcENsaWVudHMsXG4gICAgICAgICAgICBjb21tYW5kczogbWNwQ29tbWFuZHMsXG4gICAgICAgICAgICB0b29sczogbWNwVG9vbHMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgZWZmb3J0VmFsdWU6XG4gICAgICAgICAgICBwYXJzZUVmZm9ydFZhbHVlKG9wdGlvbnMuZWZmb3J0KSA/PyBnZXRJbml0aWFsRWZmb3J0U2V0dGluZygpLFxuICAgICAgICAgIC4uLihpc0Zhc3RNb2RlRW5hYmxlZCgpICYmIHtcbiAgICAgICAgICAgIGZhc3RNb2RlOiBnZXRJbml0aWFsRmFzdE1vZGVTZXR0aW5nKGVmZmVjdGl2ZU1vZGVsID8/IG51bGwpLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIC4uLihpc0Fkdmlzb3JFbmFibGVkKCkgJiYgYWR2aXNvck1vZGVsICYmIHsgYWR2aXNvck1vZGVsIH0pLFxuICAgICAgICAgIC8vIGthaXJvc0VuYWJsZWQgZ2F0ZXMgdGhlIGFzeW5jIGZpcmUtYW5kLWZvcmdldCBwYXRoIGluXG4gICAgICAgICAgLy8gZXhlY3V0ZUZvcmtlZFNsYXNoQ29tbWFuZCAocHJvY2Vzc1NsYXNoQ29tbWFuZC50c3g6MTMyKSBhbmRcbiAgICAgICAgICAvLyBBZ2VudFRvb2wncyBzaG91bGRSdW5Bc3luYy4gVGhlIFJFUEwgaW5pdGlhbFN0YXRlIHNldHMgdGhpcyBhdFxuICAgICAgICAgIC8vIH4zNDU5OyBoZWFkbGVzcyB3YXMgZGVmYXVsdGluZyB0byBmYWxzZSwgc28gdGhlIGRhZW1vbiBjaGlsZCdzXG4gICAgICAgICAgLy8gc2NoZWR1bGVkIHRhc2tzIGFuZCBBZ2VudC10b29sIGNhbGxzIHJhbiBzeW5jaHJvbm91c2x5IOKAlCBOXG4gICAgICAgICAgLy8gb3ZlcmR1ZSBjcm9uIHRhc2tzIG9uIHNwYXduID0gTiBzZXJpYWwgc3ViYWdlbnQgdHVybnMgYmxvY2tpbmdcbiAgICAgICAgICAvLyB1c2VyIGlucHV0LiBDb21wdXRlZCBhdCA6MTYyMCwgd2VsbCBiZWZvcmUgdGhpcyBicmFuY2guXG4gICAgICAgICAgLi4uKGZlYXR1cmUoJ0tBSVJPUycpID8geyBrYWlyb3NFbmFibGVkIH0gOiB7fSksXG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbml0IGFwcCBzdGF0ZVxuICAgICAgICBjb25zdCBoZWFkbGVzc1N0b3JlID0gY3JlYXRlU3RvcmUoXG4gICAgICAgICAgaGVhZGxlc3NJbml0aWFsU3RhdGUsXG4gICAgICAgICAgb25DaGFuZ2VBcHBTdGF0ZSxcbiAgICAgICAgKVxuXG4gICAgICAgIC8vIENoZWNrIGlmIGJ5cGFzc1Blcm1pc3Npb25zIHNob3VsZCBiZSBkaXNhYmxlZCBiYXNlZCBvbiBTdGF0c2lnIGdhdGVcbiAgICAgICAgLy8gVGhpcyBydW5zIGluIHBhcmFsbGVsIHRvIHRoZSBjb2RlIGJlbG93LCB0byBhdm9pZCBibG9ja2luZyB0aGUgbWFpbiBsb29wLlxuICAgICAgICBpZiAoXG4gICAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0Lm1vZGUgPT09ICdieXBhc3NQZXJtaXNzaW9ucycgfHxcbiAgICAgICAgICBhbGxvd0Rhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zXG4gICAgICAgICkge1xuICAgICAgICAgIHZvaWQgY2hlY2tBbmREaXNhYmxlQnlwYXNzUGVybWlzc2lvbnModG9vbFBlcm1pc3Npb25Db250ZXh0KVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXN5bmMgY2hlY2sgb2YgYXV0byBtb2RlIGdhdGUg4oCUIGNvcnJlY3RzIHN0YXRlIGFuZCBkaXNhYmxlcyBhdXRvIGlmIG5lZWRlZC5cbiAgICAgICAgLy8gR2F0ZWQgb24gVFJBTlNDUklQVF9DTEFTU0lGSUVSIChub3QgVVNFUl9UWVBFKSBzbyBHcm93dGhCb29rIGtpbGwgc3dpdGNoIHJ1bnMgZm9yIGV4dGVybmFsIGJ1aWxkcyB0b28uXG4gICAgICAgIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSkge1xuICAgICAgICAgIHZvaWQgdmVyaWZ5QXV0b01vZGVHYXRlQWNjZXNzKFxuICAgICAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgICAgICAgICAgaGVhZGxlc3NTdG9yZS5nZXRTdGF0ZSgpLmZhc3RNb2RlLFxuICAgICAgICAgICkudGhlbigoeyB1cGRhdGVDb250ZXh0IH0pID0+IHtcbiAgICAgICAgICAgIGhlYWRsZXNzU3RvcmUuc2V0U3RhdGUocHJldiA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG5leHRDdHggPSB1cGRhdGVDb250ZXh0KHByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0KVxuICAgICAgICAgICAgICBpZiAobmV4dEN0eCA9PT0gcHJldi50b29sUGVybWlzc2lvbkNvbnRleHQpIHJldHVybiBwcmV2XG4gICAgICAgICAgICAgIHJldHVybiB7IC4uLnByZXYsIHRvb2xQZXJtaXNzaW9uQ29udGV4dDogbmV4dEN0eCB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgZ2xvYmFsIHN0YXRlIGZvciBzZXNzaW9uIHBlcnNpc3RlbmNlXG4gICAgICAgIGlmIChvcHRpb25zLnNlc3Npb25QZXJzaXN0ZW5jZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBzZXRTZXNzaW9uUGVyc2lzdGVuY2VEaXNhYmxlZCh0cnVlKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RvcmUgU0RLIGJldGFzIGluIGdsb2JhbCBzdGF0ZSBmb3IgY29udGV4dCB3aW5kb3cgY2FsY3VsYXRpb25cbiAgICAgICAgLy8gT25seSBzdG9yZSBhbGxvd2VkIGJldGFzIChmaWx0ZXJzIGJ5IGFsbG93bGlzdCBhbmQgc3Vic2NyaWJlciBzdGF0dXMpXG4gICAgICAgIHNldFNka0JldGFzKGZpbHRlckFsbG93ZWRTZGtCZXRhcyhiZXRhcykpXG5cbiAgICAgICAgLy8gUHJpbnQtbW9kZSBNQ1A6IHBlci1zZXJ2ZXIgaW5jcmVtZW50YWwgcHVzaCBpbnRvIGhlYWRsZXNzU3RvcmUuXG4gICAgICAgIC8vIE1pcnJvcnMgdXNlTWFuYWdlTUNQQ29ubmVjdGlvbnMg4oCUIHB1c2ggcGVuZGluZyBmaXJzdCAoc28gVG9vbFNlYXJjaCdzXG4gICAgICAgIC8vIHBlbmRpbmctY2hlY2sgYXQgVG9vbFNlYXJjaFRvb2wudHM6MzM0IHNlZXMgdGhlbSksIHRoZW4gcmVwbGFjZSB3aXRoXG4gICAgICAgIC8vIGNvbm5lY3RlZC9mYWlsZWQgYXMgZWFjaCBzZXJ2ZXIgc2V0dGxlcy5cbiAgICAgICAgY29uc3QgY29ubmVjdE1jcEJhdGNoID0gKFxuICAgICAgICAgIGNvbmZpZ3M6IFJlY29yZDxzdHJpbmcsIFNjb3BlZE1jcFNlcnZlckNvbmZpZz4sXG4gICAgICAgICAgbGFiZWw6IHN0cmluZyxcbiAgICAgICAgKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGNvbmZpZ3MpLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgaGVhZGxlc3NTdG9yZS5zZXRTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgbWNwOiB7XG4gICAgICAgICAgICAgIC4uLnByZXYubWNwLFxuICAgICAgICAgICAgICBjbGllbnRzOiBbXG4gICAgICAgICAgICAgICAgLi4ucHJldi5tY3AuY2xpZW50cyxcbiAgICAgICAgICAgICAgICAuLi5PYmplY3QuZW50cmllcyhjb25maWdzKS5tYXAoKFtuYW1lLCBjb25maWddKSA9PiAoe1xuICAgICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdwZW5kaW5nJyBhcyBjb25zdCxcbiAgICAgICAgICAgICAgICAgIGNvbmZpZyxcbiAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pKVxuICAgICAgICAgIHJldHVybiBnZXRNY3BUb29sc0NvbW1hbmRzQW5kUmVzb3VyY2VzKFxuICAgICAgICAgICAgKHsgY2xpZW50LCB0b29scywgY29tbWFuZHMgfSkgPT4ge1xuICAgICAgICAgICAgICBoZWFkbGVzc1N0b3JlLnNldFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgIG1jcDoge1xuICAgICAgICAgICAgICAgICAgLi4ucHJldi5tY3AsXG4gICAgICAgICAgICAgICAgICBjbGllbnRzOiBwcmV2Lm1jcC5jbGllbnRzLnNvbWUoYyA9PiBjLm5hbWUgPT09IGNsaWVudC5uYW1lKVxuICAgICAgICAgICAgICAgICAgICA/IHByZXYubWNwLmNsaWVudHMubWFwKGMgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgIGMubmFtZSA9PT0gY2xpZW50Lm5hbWUgPyBjbGllbnQgOiBjLFxuICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgOiBbLi4ucHJldi5tY3AuY2xpZW50cywgY2xpZW50XSxcbiAgICAgICAgICAgICAgICAgIHRvb2xzOiB1bmlxQnkoWy4uLnByZXYubWNwLnRvb2xzLCAuLi50b29sc10sICduYW1lJyksXG4gICAgICAgICAgICAgICAgICBjb21tYW5kczogdW5pcUJ5KFsuLi5wcmV2Lm1jcC5jb21tYW5kcywgLi4uY29tbWFuZHNdLCAnbmFtZScpLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3MsXG4gICAgICAgICAgKS5jYXRjaChlcnIgPT5cbiAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhgW01DUF0gJHtsYWJlbH0gY29ubmVjdCBlcnJvcjogJHtlcnJ9YCksXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICAgIC8vIEF3YWl0IGFsbCBNQ1AgY29uZmlncyDigJQgcHJpbnQgbW9kZSBpcyBvZnRlbiBzaW5nbGUtdHVybiwgc29cbiAgICAgICAgLy8gXCJsYXRlLWNvbm5lY3Rpbmcgc2VydmVycyB2aXNpYmxlIG5leHQgdHVyblwiIGRvZXNuJ3QgaGVscC4gU0RLIGluaXRcbiAgICAgICAgLy8gbWVzc2FnZSBhbmQgdHVybi0xIHRvb2wgbGlzdCBib3RoIG5lZWQgY29uZmlndXJlZCBNQ1AgdG9vbHMgcHJlc2VudC5cbiAgICAgICAgLy8gWmVyby1zZXJ2ZXIgY2FzZSBpcyBmcmVlIHZpYSB0aGUgZWFybHkgcmV0dXJuIGluIGNvbm5lY3RNY3BCYXRjaC5cbiAgICAgICAgLy8gQ29ubmVjdG9ycyBwYXJhbGxlbGl6ZSBpbnNpZGUgZ2V0TWNwVG9vbHNDb21tYW5kc0FuZFJlc291cmNlc1xuICAgICAgICAvLyAocHJvY2Vzc0JhdGNoZWQgd2l0aCBQcm9taXNlLmFsbCkuIGNsYXVkZS5haSBpcyBhd2FpdGVkIHRvbyDigJQgaXRzXG4gICAgICAgIC8vIGZldGNoIHdhcyBraWNrZWQgb2ZmIGVhcmx5IChsaW5lIH4yNTU4KSBzbyBvbmx5IHJlc2lkdWFsIHRpbWUgYmxvY2tzXG4gICAgICAgIC8vIGhlcmUuIC0tYmFyZSBza2lwcyBjbGF1ZGUuYWkgZW50aXJlbHkgZm9yIHBlcmYtc2Vuc2l0aXZlIHNjcmlwdHMuXG4gICAgICAgIHByb2ZpbGVDaGVja3BvaW50KCdiZWZvcmVfY29ubmVjdE1jcCcpXG4gICAgICAgIGF3YWl0IGNvbm5lY3RNY3BCYXRjaChyZWd1bGFyTWNwQ29uZmlncywgJ3JlZ3VsYXInKVxuICAgICAgICBwcm9maWxlQ2hlY2twb2ludCgnYWZ0ZXJfY29ubmVjdE1jcCcpXG4gICAgICAgIC8vIERlZHVwOiBzdXBwcmVzcyBwbHVnaW4gTUNQIHNlcnZlcnMgdGhhdCBkdXBsaWNhdGUgYSBjbGF1ZGUuYWlcbiAgICAgICAgLy8gY29ubmVjdG9yIChjb25uZWN0b3Igd2lucyksIHRoZW4gY29ubmVjdCBjbGF1ZGUuYWkgc2VydmVycy5cbiAgICAgICAgLy8gQm91bmRlZCB3YWl0IOKAlCAjMjM3MjUgbWFkZSB0aGlzIGJsb2NraW5nIHNvIHNpbmdsZS10dXJuIC1wIHNlZXNcbiAgICAgICAgLy8gY29ubmVjdG9ycywgYnV0IHdpdGggNDArIHNsb3cgY29ubmVjdG9ycyB0ZW5ndV9zdGFydHVwX3BlcmYgcDk5XG4gICAgICAgIC8vIGNsaW1iZWQgdG8gNzZzLiBJZiBmZXRjaCtjb25uZWN0IGRvZXNuJ3QgZmluaXNoIGluIHRpbWUsIHByb2NlZWQ7XG4gICAgICAgIC8vIHRoZSBwcm9taXNlIGtlZXBzIHJ1bm5pbmcgYW5kIHVwZGF0ZXMgaGVhZGxlc3NTdG9yZSBpbiB0aGVcbiAgICAgICAgLy8gYmFja2dyb3VuZCBzbyB0dXJuIDIrIHN0aWxsIHNlZXMgY29ubmVjdG9ycy5cbiAgICAgICAgY29uc3QgQ0xBVURFX0FJX01DUF9USU1FT1VUX01TID0gNV8wMDBcbiAgICAgICAgY29uc3QgY2xhdWRlYWlDb25uZWN0ID0gY2xhdWRlYWlDb25maWdQcm9taXNlLnRoZW4oY2xhdWRlYWlDb25maWdzID0+IHtcbiAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoY2xhdWRlYWlDb25maWdzKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBjbGF1ZGVhaVNpZ3MgPSBuZXcgU2V0PHN0cmluZz4oKVxuICAgICAgICAgICAgZm9yIChjb25zdCBjb25maWcgb2YgT2JqZWN0LnZhbHVlcyhjbGF1ZGVhaUNvbmZpZ3MpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHNpZyA9IGdldE1jcFNlcnZlclNpZ25hdHVyZShjb25maWcpXG4gICAgICAgICAgICAgIGlmIChzaWcpIGNsYXVkZWFpU2lncy5hZGQoc2lnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3VwcHJlc3NlZCA9IG5ldyBTZXQ8c3RyaW5nPigpXG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtuYW1lLCBjb25maWddIG9mIE9iamVjdC5lbnRyaWVzKHJlZ3VsYXJNY3BDb25maWdzKSkge1xuICAgICAgICAgICAgICBpZiAoIW5hbWUuc3RhcnRzV2l0aCgncGx1Z2luOicpKSBjb250aW51ZVxuICAgICAgICAgICAgICBjb25zdCBzaWcgPSBnZXRNY3BTZXJ2ZXJTaWduYXR1cmUoY29uZmlnKVxuICAgICAgICAgICAgICBpZiAoc2lnICYmIGNsYXVkZWFpU2lncy5oYXMoc2lnKSkgc3VwcHJlc3NlZC5hZGQobmFtZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdXBwcmVzc2VkLnNpemUgPiAwKSB7XG4gICAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgICAgICBgW01DUF0gTGF6eSBkZWR1cDogc3VwcHJlc3NpbmcgJHtzdXBwcmVzc2VkLnNpemV9IHBsdWdpbiBzZXJ2ZXIocykgdGhhdCBkdXBsaWNhdGUgY2xhdWRlLmFpIGNvbm5lY3RvcnM6ICR7Wy4uLnN1cHByZXNzZWRdLmpvaW4oJywgJyl9YCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAvLyBEaXNjb25uZWN0IGJlZm9yZSBmaWx0ZXJpbmcgZnJvbSBzdGF0ZS4gT25seSBjb25uZWN0ZWRcbiAgICAgICAgICAgICAgLy8gc2VydmVycyBuZWVkIGNsZWFudXAg4oCUIGNsZWFyU2VydmVyQ2FjaGUgb24gYSBuZXZlci1jb25uZWN0ZWRcbiAgICAgICAgICAgICAgLy8gc2VydmVyIHRyaWdnZXJzIGEgcmVhbCBjb25uZWN0IGp1c3QgdG8ga2lsbCBpdCAobWVtb2l6ZVxuICAgICAgICAgICAgICAvLyBjYWNoZS1taXNzIHBhdGgsIHNlZSB1c2VNYW5hZ2VNQ1BDb25uZWN0aW9ucy50czo4NzApLlxuICAgICAgICAgICAgICBmb3IgKGNvbnN0IGMgb2YgaGVhZGxlc3NTdG9yZS5nZXRTdGF0ZSgpLm1jcC5jbGllbnRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzdXBwcmVzc2VkLmhhcyhjLm5hbWUpIHx8IGMudHlwZSAhPT0gJ2Nvbm5lY3RlZCcpIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgYy5jbGllbnQub25jbG9zZSA9IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgIHZvaWQgY2xlYXJTZXJ2ZXJDYWNoZShjLm5hbWUsIGMuY29uZmlnKS5jYXRjaCgoKSA9PiB7fSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBoZWFkbGVzc1N0b3JlLnNldFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgICAgIGxldCB7IGNsaWVudHMsIHRvb2xzLCBjb21tYW5kcywgcmVzb3VyY2VzIH0gPSBwcmV2Lm1jcFxuICAgICAgICAgICAgICAgIGNsaWVudHMgPSBjbGllbnRzLmZpbHRlcihjID0+ICFzdXBwcmVzc2VkLmhhcyhjLm5hbWUpKVxuICAgICAgICAgICAgICAgIHRvb2xzID0gdG9vbHMuZmlsdGVyKFxuICAgICAgICAgICAgICAgICAgdCA9PiAhdC5tY3BJbmZvIHx8ICFzdXBwcmVzc2VkLmhhcyh0Lm1jcEluZm8uc2VydmVyTmFtZSksXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBzdXBwcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgICBjb21tYW5kcyA9IGV4Y2x1ZGVDb21tYW5kc0J5U2VydmVyKGNvbW1hbmRzLCBuYW1lKVxuICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzID0gZXhjbHVkZVJlc291cmNlc0J5U2VydmVyKHJlc291cmNlcywgbmFtZSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICBtY3A6IHsgLi4ucHJldi5tY3AsIGNsaWVudHMsIHRvb2xzLCBjb21tYW5kcywgcmVzb3VyY2VzIH0sXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBTdXBwcmVzcyBjbGF1ZGUuYWkgY29ubmVjdG9ycyB0aGF0IGR1cGxpY2F0ZSBhbiBlbmFibGVkXG4gICAgICAgICAgLy8gbWFudWFsIHNlcnZlciAoVVJMLXNpZ25hdHVyZSBtYXRjaCkuIFBsdWdpbiBkZWR1cCBhYm92ZSBvbmx5XG4gICAgICAgICAgLy8gaGFuZGxlcyBgcGx1Z2luOipgIGtleXM7IHRoaXMgY2F0Y2hlcyBtYW51YWwgYC5tY3AuanNvbmAgZW50cmllcy5cbiAgICAgICAgICAvLyBwbHVnaW46KiBtdXN0IGJlIGV4Y2x1ZGVkIGhlcmUg4oCUIHN0ZXAgMSBhbHJlYWR5IHN1cHByZXNzZWRcbiAgICAgICAgICAvLyB0aG9zZSAoY2xhdWRlLmFpIHdpbnMpOyBsZWF2aW5nIHRoZW0gaW4gc3VwcHJlc3NlcyB0aGVcbiAgICAgICAgICAvLyBjb25uZWN0b3IgdG9vLCBhbmQgbmVpdGhlciBzdXJ2aXZlcyAoZ2gtMzk5NzQpLlxuICAgICAgICAgIGNvbnN0IG5vblBsdWdpbkNvbmZpZ3MgPSBwaWNrQnkoXG4gICAgICAgICAgICByZWd1bGFyTWNwQ29uZmlncyxcbiAgICAgICAgICAgIChfLCBuKSA9PiAhbi5zdGFydHNXaXRoKCdwbHVnaW46JyksXG4gICAgICAgICAgKVxuICAgICAgICAgIGNvbnN0IHsgc2VydmVyczogZGVkdXBlZENsYXVkZUFpIH0gPSBkZWR1cENsYXVkZUFpTWNwU2VydmVycyhcbiAgICAgICAgICAgIGNsYXVkZWFpQ29uZmlncyxcbiAgICAgICAgICAgIG5vblBsdWdpbkNvbmZpZ3MsXG4gICAgICAgICAgKVxuICAgICAgICAgIHJldHVybiBjb25uZWN0TWNwQmF0Y2goZGVkdXBlZENsYXVkZUFpLCAnY2xhdWRlYWknKVxuICAgICAgICB9KVxuICAgICAgICBsZXQgY2xhdWRlYWlUaW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCB1bmRlZmluZWRcbiAgICAgICAgY29uc3QgY2xhdWRlYWlUaW1lZE91dCA9IGF3YWl0IFByb21pc2UucmFjZShbXG4gICAgICAgICAgY2xhdWRlYWlDb25uZWN0LnRoZW4oKCkgPT4gZmFsc2UpLFxuICAgICAgICAgIG5ldyBQcm9taXNlPGJvb2xlYW4+KHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgY2xhdWRlYWlUaW1lciA9IHNldFRpbWVvdXQoXG4gICAgICAgICAgICAgIHIgPT4gcih0cnVlKSxcbiAgICAgICAgICAgICAgQ0xBVURFX0FJX01DUF9USU1FT1VUX01TLFxuICAgICAgICAgICAgICByZXNvbHZlLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH0pLFxuICAgICAgICBdKVxuICAgICAgICBpZiAoY2xhdWRlYWlUaW1lcikgY2xlYXJUaW1lb3V0KGNsYXVkZWFpVGltZXIpXG4gICAgICAgIGlmIChjbGF1ZGVhaVRpbWVkT3V0KSB7XG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgYFtNQ1BdIGNsYXVkZS5haSBjb25uZWN0b3JzIG5vdCByZWFkeSBhZnRlciAke0NMQVVERV9BSV9NQ1BfVElNRU9VVF9NU31tcyDigJQgcHJvY2VlZGluZzsgYmFja2dyb3VuZCBjb25uZWN0aW9uIGNvbnRpbnVlc2AsXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICAgIHByb2ZpbGVDaGVja3BvaW50KCdhZnRlcl9jb25uZWN0TWNwX2NsYXVkZWFpJylcblxuICAgICAgICAvLyBJbiBoZWFkbGVzcyBtb2RlLCBzdGFydCBkZWZlcnJlZCBwcmVmZXRjaGVzIGltbWVkaWF0ZWx5IChubyB1c2VyIHR5cGluZyBkZWxheSlcbiAgICAgICAgLy8gLS1iYXJlIC8gU0lNUExFOiBzdGFydERlZmVycmVkUHJlZmV0Y2hlcyBlYXJseS1yZXR1cm5zIGludGVybmFsbHkuXG4gICAgICAgIC8vIGJhY2tncm91bmRIb3VzZWtlZXBpbmcgKGluaXRFeHRyYWN0TWVtb3JpZXMsIHBydW5lU2hlbGxTbmFwc2hvdHMsXG4gICAgICAgIC8vIGNsZWFudXBPbGRNZXNzYWdlRmlsZXMpIGFuZCBzZGtIZWFwRHVtcE1vbml0b3IgYXJlIGFsbCBib29ra2VlcGluZ1xuICAgICAgICAvLyB0aGF0IHNjcmlwdGVkIGNhbGxzIGRvbid0IG5lZWQg4oCUIHRoZSBuZXh0IGludGVyYWN0aXZlIHNlc3Npb24gcmVjb25jaWxlcy5cbiAgICAgICAgaWYgKCFpc0JhcmVNb2RlKCkpIHtcbiAgICAgICAgICBzdGFydERlZmVycmVkUHJlZmV0Y2hlcygpXG4gICAgICAgICAgdm9pZCBpbXBvcnQoJy4vdXRpbHMvYmFja2dyb3VuZEhvdXNla2VlcGluZy5qcycpLnRoZW4obSA9PlxuICAgICAgICAgICAgbS5zdGFydEJhY2tncm91bmRIb3VzZWtlZXBpbmcoKSxcbiAgICAgICAgICApXG4gICAgICAgICAgaWYgKFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcpIHtcbiAgICAgICAgICAgIHZvaWQgaW1wb3J0KCcuL3V0aWxzL3Nka0hlYXBEdW1wTW9uaXRvci5qcycpLnRoZW4obSA9PlxuICAgICAgICAgICAgICBtLnN0YXJ0U2RrTWVtb3J5TW9uaXRvcigpLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxvZ1Nlc3Npb25UZWxlbWV0cnkoKVxuICAgICAgICBwcm9maWxlQ2hlY2twb2ludCgnYmVmb3JlX3ByaW50X2ltcG9ydCcpXG4gICAgICAgIGNvbnN0IHsgcnVuSGVhZGxlc3MgfSA9IGF3YWl0IGltcG9ydCgnc3JjL2NsaS9wcmludC5qcycpXG4gICAgICAgIHByb2ZpbGVDaGVja3BvaW50KCdhZnRlcl9wcmludF9pbXBvcnQnKVxuICAgICAgICB2b2lkIHJ1bkhlYWRsZXNzKFxuICAgICAgICAgIGlucHV0UHJvbXB0LFxuICAgICAgICAgICgpID0+IGhlYWRsZXNzU3RvcmUuZ2V0U3RhdGUoKSxcbiAgICAgICAgICBoZWFkbGVzc1N0b3JlLnNldFN0YXRlLFxuICAgICAgICAgIGNvbW1hbmRzSGVhZGxlc3MsXG4gICAgICAgICAgdG9vbHMsXG4gICAgICAgICAgc2RrTWNwQ29uZmlncyxcbiAgICAgICAgICBhZ2VudERlZmluaXRpb25zLmFjdGl2ZUFnZW50cyxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjb250aW51ZTogb3B0aW9ucy5jb250aW51ZSxcbiAgICAgICAgICAgIHJlc3VtZTogb3B0aW9ucy5yZXN1bWUsXG4gICAgICAgICAgICB2ZXJib3NlOiB2ZXJib3NlLFxuICAgICAgICAgICAgb3V0cHV0Rm9ybWF0OiBvdXRwdXRGb3JtYXQsXG4gICAgICAgICAgICBqc29uU2NoZW1hLFxuICAgICAgICAgICAgcGVybWlzc2lvblByb21wdFRvb2xOYW1lOiBvcHRpb25zLnBlcm1pc3Npb25Qcm9tcHRUb29sLFxuICAgICAgICAgICAgYWxsb3dlZFRvb2xzLFxuICAgICAgICAgICAgdGhpbmtpbmdDb25maWcsXG4gICAgICAgICAgICBtYXhUdXJuczogb3B0aW9ucy5tYXhUdXJucyxcbiAgICAgICAgICAgIG1heEJ1ZGdldFVzZDogb3B0aW9ucy5tYXhCdWRnZXRVc2QsXG4gICAgICAgICAgICB0YXNrQnVkZ2V0OiBvcHRpb25zLnRhc2tCdWRnZXRcbiAgICAgICAgICAgICAgPyB7IHRvdGFsOiBvcHRpb25zLnRhc2tCdWRnZXQgfVxuICAgICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHN5c3RlbVByb21wdCxcbiAgICAgICAgICAgIGFwcGVuZFN5c3RlbVByb21wdCxcbiAgICAgICAgICAgIHVzZXJTcGVjaWZpZWRNb2RlbDogZWZmZWN0aXZlTW9kZWwsXG4gICAgICAgICAgICBmYWxsYmFja01vZGVsOiB1c2VyU3BlY2lmaWVkRmFsbGJhY2tNb2RlbCxcbiAgICAgICAgICAgIHRlbGVwb3J0LFxuICAgICAgICAgICAgc2RrVXJsLFxuICAgICAgICAgICAgcmVwbGF5VXNlck1lc3NhZ2VzOiBlZmZlY3RpdmVSZXBsYXlVc2VyTWVzc2FnZXMsXG4gICAgICAgICAgICBpbmNsdWRlUGFydGlhbE1lc3NhZ2VzOiBlZmZlY3RpdmVJbmNsdWRlUGFydGlhbE1lc3NhZ2VzLFxuICAgICAgICAgICAgZm9ya1Nlc3Npb246IG9wdGlvbnMuZm9ya1Nlc3Npb24gfHwgZmFsc2UsXG4gICAgICAgICAgICByZXN1bWVTZXNzaW9uQXQ6IG9wdGlvbnMucmVzdW1lU2Vzc2lvbkF0IHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHJld2luZEZpbGVzOiBvcHRpb25zLnJld2luZEZpbGVzLFxuICAgICAgICAgICAgZW5hYmxlQXV0aFN0YXR1czogb3B0aW9ucy5lbmFibGVBdXRoU3RhdHVzLFxuICAgICAgICAgICAgYWdlbnQ6IGFnZW50Q2xpLFxuICAgICAgICAgICAgd29ya2xvYWQ6IG9wdGlvbnMud29ya2xvYWQsXG4gICAgICAgICAgICBzZXR1cFRyaWdnZXI6IHNldHVwVHJpZ2dlciA/PyB1bmRlZmluZWQsXG4gICAgICAgICAgICBzZXNzaW9uU3RhcnRIb29rc1Byb21pc2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gTG9nIG1vZGVsIGNvbmZpZyBhdCBzdGFydHVwXG4gICAgICBsb2dFdmVudCgndGVuZ3Vfc3RhcnR1cF9tYW51YWxfbW9kZWxfY29uZmlnJywge1xuICAgICAgICBjbGlfZmxhZzpcbiAgICAgICAgICBvcHRpb25zLm1vZGVsIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIGVudl92YXI6IHByb2Nlc3MuZW52XG4gICAgICAgICAgLkFOVEhST1BJQ19NT0RFTCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICBzZXR0aW5nc19maWxlOiAoZ2V0SW5pdGlhbFNldHRpbmdzKCkgfHwge30pXG4gICAgICAgICAgLm1vZGVsIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIHN1YnNjcmlwdGlvblR5cGU6XG4gICAgICAgICAgZ2V0U3Vic2NyaXB0aW9uVHlwZSgpIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIGFnZW50OlxuICAgICAgICAgIGFnZW50U2V0dGluZyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSlcblxuICAgICAgLy8gR2V0IGRlcHJlY2F0aW9uIHdhcm5pbmcgZm9yIHRoZSBpbml0aWFsIG1vZGVsIChyZXNvbHZlZEluaXRpYWxNb2RlbCBjb21wdXRlZCBlYXJsaWVyIGZvciBob29rcyBwYXJhbGxlbGl6YXRpb24pXG4gICAgICBjb25zdCBkZXByZWNhdGlvbldhcm5pbmcgPVxuICAgICAgICBnZXRNb2RlbERlcHJlY2F0aW9uV2FybmluZyhyZXNvbHZlZEluaXRpYWxNb2RlbClcblxuICAgICAgLy8gQnVpbGQgaW5pdGlhbCBub3RpZmljYXRpb24gcXVldWVcbiAgICAgIGNvbnN0IGluaXRpYWxOb3RpZmljYXRpb25zOiBBcnJheTx7XG4gICAgICAgIGtleTogc3RyaW5nXG4gICAgICAgIHRleHQ6IHN0cmluZ1xuICAgICAgICBjb2xvcj86ICd3YXJuaW5nJ1xuICAgICAgICBwcmlvcml0eTogJ2hpZ2gnXG4gICAgICB9PiA9IFtdXG4gICAgICBpZiAocGVybWlzc2lvbk1vZGVOb3RpZmljYXRpb24pIHtcbiAgICAgICAgaW5pdGlhbE5vdGlmaWNhdGlvbnMucHVzaCh7XG4gICAgICAgICAga2V5OiAncGVybWlzc2lvbi1tb2RlLW5vdGlmaWNhdGlvbicsXG4gICAgICAgICAgdGV4dDogcGVybWlzc2lvbk1vZGVOb3RpZmljYXRpb24sXG4gICAgICAgICAgcHJpb3JpdHk6ICdoaWdoJyxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIGlmIChkZXByZWNhdGlvbldhcm5pbmcpIHtcbiAgICAgICAgaW5pdGlhbE5vdGlmaWNhdGlvbnMucHVzaCh7XG4gICAgICAgICAga2V5OiAnbW9kZWwtZGVwcmVjYXRpb24td2FybmluZycsXG4gICAgICAgICAgdGV4dDogZGVwcmVjYXRpb25XYXJuaW5nLFxuICAgICAgICAgIGNvbG9yOiAnd2FybmluZycsXG4gICAgICAgICAgcHJpb3JpdHk6ICdoaWdoJyxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIGlmIChvdmVybHlCcm9hZEJhc2hQZXJtaXNzaW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGRpc3BsYXlMaXN0ID0gdW5pcShcbiAgICAgICAgICBvdmVybHlCcm9hZEJhc2hQZXJtaXNzaW9ucy5tYXAocCA9PiBwLnJ1bGVEaXNwbGF5KSxcbiAgICAgICAgKVxuICAgICAgICBjb25zdCBkaXNwbGF5cyA9IGRpc3BsYXlMaXN0LmpvaW4oJywgJylcbiAgICAgICAgY29uc3Qgc291cmNlcyA9IHVuaXEoXG4gICAgICAgICAgb3Zlcmx5QnJvYWRCYXNoUGVybWlzc2lvbnMubWFwKHAgPT4gcC5zb3VyY2VEaXNwbGF5KSxcbiAgICAgICAgKS5qb2luKCcsICcpXG4gICAgICAgIGNvbnN0IG4gPSBkaXNwbGF5TGlzdC5sZW5ndGhcbiAgICAgICAgaW5pdGlhbE5vdGlmaWNhdGlvbnMucHVzaCh7XG4gICAgICAgICAga2V5OiAnb3Zlcmx5LWJyb2FkLWJhc2gtbm90aWZpY2F0aW9uJyxcbiAgICAgICAgICB0ZXh0OiBgJHtkaXNwbGF5c30gYWxsb3cgJHtwbHVyYWwobiwgJ3J1bGUnKX0gZnJvbSAke3NvdXJjZXN9ICR7cGx1cmFsKG4sICd3YXMnLCAnd2VyZScpfSBpZ25vcmVkIFxcdTIwMTQgbm90IGF2YWlsYWJsZSBmb3IgQW50cywgcGxlYXNlIHVzZSBhdXRvLW1vZGUgaW5zdGVhZGAsXG4gICAgICAgICAgY29sb3I6ICd3YXJuaW5nJyxcbiAgICAgICAgICBwcmlvcml0eTogJ2hpZ2gnLFxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICBjb25zdCBlZmZlY3RpdmVUb29sUGVybWlzc2lvbkNvbnRleHQgPSB7XG4gICAgICAgIC4uLnRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgICAgbW9kZTpcbiAgICAgICAgICBpc0FnZW50U3dhcm1zRW5hYmxlZCgpICYmIGdldFRlYW1tYXRlVXRpbHMoKS5pc1BsYW5Nb2RlUmVxdWlyZWQoKVxuICAgICAgICAgICAgPyAoJ3BsYW4nIGFzIGNvbnN0KVxuICAgICAgICAgICAgOiB0b29sUGVybWlzc2lvbkNvbnRleHQubW9kZSxcbiAgICAgIH1cbiAgICAgIC8vIEFsbCBzdGFydHVwIG9wdC1pbiBwYXRocyAoLS10b29scywgLS1icmllZiwgZGVmYXVsdFZpZXcpIGhhdmUgZmlyZWRcbiAgICAgIC8vIGFib3ZlOyBpbml0aWFsSXNCcmllZk9ubHkganVzdCByZWFkcyB0aGUgcmVzdWx0aW5nIHN0YXRlLlxuICAgICAgY29uc3QgaW5pdGlhbElzQnJpZWZPbmx5ID1cbiAgICAgICAgZmVhdHVyZSgnS0FJUk9TJykgfHwgZmVhdHVyZSgnS0FJUk9TX0JSSUVGJykgPyBnZXRVc2VyTXNnT3B0SW4oKSA6IGZhbHNlXG4gICAgICBjb25zdCBmdWxsUmVtb3RlQ29udHJvbCA9XG4gICAgICAgIHJlbW90ZUNvbnRyb2wgfHwgZ2V0UmVtb3RlQ29udHJvbEF0U3RhcnR1cCgpIHx8IGthaXJvc0VuYWJsZWRcbiAgICAgIGxldCBjY3JNaXJyb3JFbmFibGVkID0gZmFsc2VcbiAgICAgIGlmIChmZWF0dXJlKCdDQ1JfTUlSUk9SJykgJiYgIWZ1bGxSZW1vdGVDb250cm9sKSB7XG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgY29uc3QgeyBpc0Njck1pcnJvckVuYWJsZWQgfSA9XG4gICAgICAgICAgcmVxdWlyZSgnLi9icmlkZ2UvYnJpZGdlRW5hYmxlZC5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vYnJpZGdlL2JyaWRnZUVuYWJsZWQuanMnKVxuICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgY2NyTWlycm9yRW5hYmxlZCA9IGlzQ2NyTWlycm9yRW5hYmxlZCgpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGluaXRpYWxTdGF0ZTogQXBwU3RhdGUgPSB7XG4gICAgICAgIHNldHRpbmdzOiBnZXRJbml0aWFsU2V0dGluZ3MoKSxcbiAgICAgICAgdGFza3M6IHt9LFxuICAgICAgICBhZ2VudE5hbWVSZWdpc3RyeTogbmV3IE1hcCgpLFxuICAgICAgICB2ZXJib3NlOiB2ZXJib3NlID8/IGdldEdsb2JhbENvbmZpZygpLnZlcmJvc2UgPz8gZmFsc2UsXG4gICAgICAgIG1haW5Mb29wTW9kZWw6IGluaXRpYWxNYWluTG9vcE1vZGVsLFxuICAgICAgICBtYWluTG9vcE1vZGVsRm9yU2Vzc2lvbjogbnVsbCxcbiAgICAgICAgaXNCcmllZk9ubHk6IGluaXRpYWxJc0JyaWVmT25seSxcbiAgICAgICAgZXhwYW5kZWRWaWV3OiBnZXRHbG9iYWxDb25maWcoKS5zaG93U3Bpbm5lclRyZWVcbiAgICAgICAgICA/ICd0ZWFtbWF0ZXMnXG4gICAgICAgICAgOiBnZXRHbG9iYWxDb25maWcoKS5zaG93RXhwYW5kZWRUb2Rvc1xuICAgICAgICAgICAgPyAndGFza3MnXG4gICAgICAgICAgICA6ICdub25lJyxcbiAgICAgICAgc2hvd1RlYW1tYXRlTWVzc2FnZVByZXZpZXc6IGlzQWdlbnRTd2FybXNFbmFibGVkKCkgPyBmYWxzZSA6IHVuZGVmaW5lZCxcbiAgICAgICAgc2VsZWN0ZWRJUEFnZW50SW5kZXg6IC0xLFxuICAgICAgICBjb29yZGluYXRvclRhc2tJbmRleDogLTEsXG4gICAgICAgIHZpZXdTZWxlY3Rpb25Nb2RlOiAnbm9uZScsXG4gICAgICAgIGZvb3RlclNlbGVjdGlvbjogbnVsbCxcbiAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiBlZmZlY3RpdmVUb29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgIGFnZW50OiBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uPy5hZ2VudFR5cGUsXG4gICAgICAgIGFnZW50RGVmaW5pdGlvbnMsXG4gICAgICAgIG1jcDoge1xuICAgICAgICAgIGNsaWVudHM6IFtdLFxuICAgICAgICAgIHRvb2xzOiBbXSxcbiAgICAgICAgICBjb21tYW5kczogW10sXG4gICAgICAgICAgcmVzb3VyY2VzOiB7fSxcbiAgICAgICAgICBwbHVnaW5SZWNvbm5lY3RLZXk6IDAsXG4gICAgICAgIH0sXG4gICAgICAgIHBsdWdpbnM6IHtcbiAgICAgICAgICBlbmFibGVkOiBbXSxcbiAgICAgICAgICBkaXNhYmxlZDogW10sXG4gICAgICAgICAgY29tbWFuZHM6IFtdLFxuICAgICAgICAgIGVycm9yczogW10sXG4gICAgICAgICAgaW5zdGFsbGF0aW9uU3RhdHVzOiB7XG4gICAgICAgICAgICBtYXJrZXRwbGFjZXM6IFtdLFxuICAgICAgICAgICAgcGx1Z2luczogW10sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBuZWVkc1JlZnJlc2g6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICBzdGF0dXNMaW5lVGV4dDogdW5kZWZpbmVkLFxuICAgICAgICBrYWlyb3NFbmFibGVkLFxuICAgICAgICByZW1vdGVTZXNzaW9uVXJsOiB1bmRlZmluZWQsXG4gICAgICAgIHJlbW90ZUNvbm5lY3Rpb25TdGF0dXM6ICdjb25uZWN0aW5nJyxcbiAgICAgICAgcmVtb3RlQmFja2dyb3VuZFRhc2tDb3VudDogMCxcbiAgICAgICAgcmVwbEJyaWRnZUVuYWJsZWQ6IGZ1bGxSZW1vdGVDb250cm9sIHx8IGNjck1pcnJvckVuYWJsZWQsXG4gICAgICAgIHJlcGxCcmlkZ2VFeHBsaWNpdDogcmVtb3RlQ29udHJvbCxcbiAgICAgICAgcmVwbEJyaWRnZU91dGJvdW5kT25seTogY2NyTWlycm9yRW5hYmxlZCxcbiAgICAgICAgcmVwbEJyaWRnZUNvbm5lY3RlZDogZmFsc2UsXG4gICAgICAgIHJlcGxCcmlkZ2VTZXNzaW9uQWN0aXZlOiBmYWxzZSxcbiAgICAgICAgcmVwbEJyaWRnZVJlY29ubmVjdGluZzogZmFsc2UsXG4gICAgICAgIHJlcGxCcmlkZ2VDb25uZWN0VXJsOiB1bmRlZmluZWQsXG4gICAgICAgIHJlcGxCcmlkZ2VTZXNzaW9uVXJsOiB1bmRlZmluZWQsXG4gICAgICAgIHJlcGxCcmlkZ2VFbnZpcm9ubWVudElkOiB1bmRlZmluZWQsXG4gICAgICAgIHJlcGxCcmlkZ2VTZXNzaW9uSWQ6IHVuZGVmaW5lZCxcbiAgICAgICAgcmVwbEJyaWRnZUVycm9yOiB1bmRlZmluZWQsXG4gICAgICAgIHJlcGxCcmlkZ2VJbml0aWFsTmFtZTogcmVtb3RlQ29udHJvbE5hbWUsXG4gICAgICAgIHNob3dSZW1vdGVDYWxsb3V0OiBmYWxzZSxcbiAgICAgICAgbm90aWZpY2F0aW9uczoge1xuICAgICAgICAgIGN1cnJlbnQ6IG51bGwsXG4gICAgICAgICAgcXVldWU6IGluaXRpYWxOb3RpZmljYXRpb25zLFxuICAgICAgICB9LFxuICAgICAgICBlbGljaXRhdGlvbjoge1xuICAgICAgICAgIHF1ZXVlOiBbXSxcbiAgICAgICAgfSxcbiAgICAgICAgdG9kb3M6IHt9LFxuICAgICAgICByZW1vdGVBZ2VudFRhc2tTdWdnZXN0aW9uczogW10sXG4gICAgICAgIGZpbGVIaXN0b3J5OiB7XG4gICAgICAgICAgc25hcHNob3RzOiBbXSxcbiAgICAgICAgICB0cmFja2VkRmlsZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgICBzbmFwc2hvdFNlcXVlbmNlOiAwLFxuICAgICAgICB9LFxuICAgICAgICBhdHRyaWJ1dGlvbjogY3JlYXRlRW1wdHlBdHRyaWJ1dGlvblN0YXRlKCksXG4gICAgICAgIHRoaW5raW5nRW5hYmxlZCxcbiAgICAgICAgcHJvbXB0U3VnZ2VzdGlvbkVuYWJsZWQ6IHNob3VsZEVuYWJsZVByb21wdFN1Z2dlc3Rpb24oKSxcbiAgICAgICAgc2Vzc2lvbkhvb2tzOiBuZXcgTWFwKCksXG4gICAgICAgIGluYm94OiB7XG4gICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICB9LFxuICAgICAgICBwcm9tcHRTdWdnZXN0aW9uOiB7XG4gICAgICAgICAgdGV4dDogbnVsbCxcbiAgICAgICAgICBwcm9tcHRJZDogbnVsbCxcbiAgICAgICAgICBzaG93bkF0OiAwLFxuICAgICAgICAgIGFjY2VwdGVkQXQ6IDAsXG4gICAgICAgICAgZ2VuZXJhdGlvblJlcXVlc3RJZDogbnVsbCxcbiAgICAgICAgfSxcbiAgICAgICAgc3BlY3VsYXRpb246IElETEVfU1BFQ1VMQVRJT05fU1RBVEUsXG4gICAgICAgIHNwZWN1bGF0aW9uU2Vzc2lvblRpbWVTYXZlZE1zOiAwLFxuICAgICAgICBza2lsbEltcHJvdmVtZW50OiB7XG4gICAgICAgICAgc3VnZ2VzdGlvbjogbnVsbCxcbiAgICAgICAgfSxcbiAgICAgICAgd29ya2VyU2FuZGJveFBlcm1pc3Npb25zOiB7XG4gICAgICAgICAgcXVldWU6IFtdLFxuICAgICAgICAgIHNlbGVjdGVkSW5kZXg6IDAsXG4gICAgICAgIH0sXG4gICAgICAgIHBlbmRpbmdXb3JrZXJSZXF1ZXN0OiBudWxsLFxuICAgICAgICBwZW5kaW5nU2FuZGJveFJlcXVlc3Q6IG51bGwsXG4gICAgICAgIGF1dGhWZXJzaW9uOiAwLFxuICAgICAgICBpbml0aWFsTWVzc2FnZTogaW5wdXRQcm9tcHRcbiAgICAgICAgICA/IHsgbWVzc2FnZTogY3JlYXRlVXNlck1lc3NhZ2UoeyBjb250ZW50OiBTdHJpbmcoaW5wdXRQcm9tcHQpIH0pIH1cbiAgICAgICAgICA6IG51bGwsXG4gICAgICAgIGVmZm9ydFZhbHVlOlxuICAgICAgICAgIHBhcnNlRWZmb3J0VmFsdWUob3B0aW9ucy5lZmZvcnQpID8/IGdldEluaXRpYWxFZmZvcnRTZXR0aW5nKCksXG4gICAgICAgIGFjdGl2ZU92ZXJsYXlzOiBuZXcgU2V0PHN0cmluZz4oKSxcbiAgICAgICAgZmFzdE1vZGU6IGdldEluaXRpYWxGYXN0TW9kZVNldHRpbmcocmVzb2x2ZWRJbml0aWFsTW9kZWwpLFxuICAgICAgICAuLi4oaXNBZHZpc29yRW5hYmxlZCgpICYmIGFkdmlzb3JNb2RlbCAmJiB7IGFkdmlzb3JNb2RlbCB9KSxcbiAgICAgICAgLy8gQ29tcHV0ZSB0ZWFtQ29udGV4dCBzeW5jaHJvbm91c2x5IHRvIGF2b2lkIHVzZUVmZmVjdCBzZXRTdGF0ZSBkdXJpbmcgcmVuZGVyLlxuICAgICAgICAvLyBLQUlST1M6IGFzc2lzdGFudFRlYW1Db250ZXh0IHRha2VzIHByZWNlZGVuY2Ug4oCUIHNldCBlYXJsaWVyIGluIHRoZVxuICAgICAgICAvLyBLQUlST1MgYmxvY2sgc28gQWdlbnQobmFtZTogXCJmb29cIikgY2FuIHNwYXduIGluLXByb2Nlc3MgdGVhbW1hdGVzXG4gICAgICAgIC8vIHdpdGhvdXQgVGVhbUNyZWF0ZS4gY29tcHV0ZUluaXRpYWxUZWFtQ29udGV4dCgpIGlzIGZvciB0bXV4LXNwYXduZWRcbiAgICAgICAgLy8gdGVhbW1hdGVzIHJlYWRpbmcgdGhlaXIgb3duIGlkZW50aXR5LCBub3QgdGhlIGFzc2lzdGFudC1tb2RlIGxlYWRlci5cbiAgICAgICAgdGVhbUNvbnRleHQ6IGZlYXR1cmUoJ0tBSVJPUycpXG4gICAgICAgICAgPyAoYXNzaXN0YW50VGVhbUNvbnRleHQgPz8gY29tcHV0ZUluaXRpYWxUZWFtQ29udGV4dD8uKCkpXG4gICAgICAgICAgOiBjb21wdXRlSW5pdGlhbFRlYW1Db250ZXh0Py4oKSxcbiAgICAgIH1cblxuICAgICAgLy8gQWRkIENMSSBpbml0aWFsIHByb21wdCB0byBoaXN0b3J5XG4gICAgICBpZiAoaW5wdXRQcm9tcHQpIHtcbiAgICAgICAgYWRkVG9IaXN0b3J5KFN0cmluZyhpbnB1dFByb21wdCkpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGluaXRpYWxUb29scyA9IG1jcFRvb2xzXG5cbiAgICAgIC8vIEluY3JlbWVudCBudW1TdGFydHVwcyBzeW5jaHJvbm91c2x5IOKAlCBmaXJzdC1yZW5kZXIgcmVhZGVycyBsaWtlXG4gICAgICAvLyBzaG91bGRTaG93RWZmb3J0Q2FsbG91dCAodmlhIHVzZVN0YXRlIGluaXRpYWxpemVyKSBuZWVkIHRoZSB1cGRhdGVkXG4gICAgICAvLyB2YWx1ZSBiZWZvcmUgc2V0SW1tZWRpYXRlIGZpcmVzLiBEZWZlciBvbmx5IHRlbGVtZXRyeS5cbiAgICAgIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiAoe1xuICAgICAgICAuLi5jdXJyZW50LFxuICAgICAgICBudW1TdGFydHVwczogKGN1cnJlbnQubnVtU3RhcnR1cHMgPz8gMCkgKyAxLFxuICAgICAgfSkpXG4gICAgICBzZXRJbW1lZGlhdGUoKCkgPT4ge1xuICAgICAgICB2b2lkIGxvZ1N0YXJ0dXBUZWxlbWV0cnkoKVxuICAgICAgICBsb2dTZXNzaW9uVGVsZW1ldHJ5KClcbiAgICAgIH0pXG5cbiAgICAgIC8vIFNldCB1cCBwZXItdHVybiBzZXNzaW9uIGVudmlyb25tZW50IGRhdGEgdXBsb2FkZXIgKGFudC1vbmx5IGJ1aWxkKS5cbiAgICAgIC8vIERlZmF1bHQtZW5hYmxlZCBmb3IgYWxsIGFudCB1c2VycyB3aGVuIHdvcmtpbmcgaW4gYW4gQW50aHJvcGljLW93bmVkXG4gICAgICAvLyByZXBvLiBDYXB0dXJlcyBnaXQvZmlsZXN5c3RlbSBzdGF0ZSAoTk9UIHRyYW5zY3JpcHRzKSBhdCBlYWNoIHR1cm4gc29cbiAgICAgIC8vIGVudmlyb25tZW50cyBjYW4gYmUgcmVjcmVhdGVkIGF0IGFueSB1c2VyIG1lc3NhZ2UgaW5kZXguIEdhdGluZzpcbiAgICAgIC8vICAgLSBCdWlsZC10aW1lOiB0aGlzIGltcG9ydCBpcyBzdHViYmVkIGluIGV4dGVybmFsIGJ1aWxkcy5cbiAgICAgIC8vICAgLSBSdW50aW1lOiB1cGxvYWRlciBjaGVja3MgZ2l0aHViLmNvbS9hbnRocm9waWNzLyogcmVtb3RlICsgZ2Nsb3VkIGF1dGguXG4gICAgICAvLyAgIC0gU2FmZXR5OiBDTEFVREVfQ09ERV9ESVNBQkxFX1NFU1NJT05fREFUQV9VUExPQUQ9MSBieXBhc3NlcyAodGVzdHMgc2V0IHRoaXMpLlxuICAgICAgLy8gSW1wb3J0IGlzIGR5bmFtaWMgKyBhc3luYyB0byBhdm9pZCBhZGRpbmcgc3RhcnR1cCBsYXRlbmN5LlxuICAgICAgY29uc3Qgc2Vzc2lvblVwbG9hZGVyUHJvbWlzZSA9XG4gICAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCdcbiAgICAgICAgICA/IGltcG9ydCgnLi91dGlscy9zZXNzaW9uRGF0YVVwbG9hZGVyLmpzJylcbiAgICAgICAgICA6IG51bGxcblxuICAgICAgLy8gRGVmZXIgc2Vzc2lvbiB1cGxvYWRlciByZXNvbHV0aW9uIHRvIHRoZSBvblR1cm5Db21wbGV0ZSBjYWxsYmFjayB0byBhdm9pZFxuICAgICAgLy8gYWRkaW5nIGEgbmV3IHRvcC1sZXZlbCBhd2FpdCBpbiBtYWluLnRzeCAocGVyZm9ybWFuY2UtY3JpdGljYWwgcGF0aCkuXG4gICAgICAvLyBUaGUgcGVyLXR1cm4gYXV0aCBsb2dpYyBpbiBzZXNzaW9uRGF0YVVwbG9hZGVyLnRzIGhhbmRsZXMgdW5hdXRoZW50aWNhdGVkXG4gICAgICAvLyBzdGF0ZSBncmFjZWZ1bGx5IChyZS1jaGVja3MgZWFjaCB0dXJuLCBzbyBhdXRoIHJlY292ZXJ5IG1pZC1zZXNzaW9uIHdvcmtzKS5cbiAgICAgIGNvbnN0IHVwbG9hZGVyUmVhZHkgPSBzZXNzaW9uVXBsb2FkZXJQcm9taXNlXG4gICAgICAgID8gc2Vzc2lvblVwbG9hZGVyUHJvbWlzZVxuICAgICAgICAgICAgLnRoZW4obW9kID0+IG1vZC5jcmVhdGVTZXNzaW9uVHVyblVwbG9hZGVyKCkpXG4gICAgICAgICAgICAuY2F0Y2goKCkgPT4gbnVsbClcbiAgICAgICAgOiBudWxsXG5cbiAgICAgIGNvbnN0IHNlc3Npb25Db25maWcgPSB7XG4gICAgICAgIGRlYnVnOiBkZWJ1ZyB8fCBkZWJ1Z1RvU3RkZXJyLFxuICAgICAgICBjb21tYW5kczogWy4uLmNvbW1hbmRzLCAuLi5tY3BDb21tYW5kc10sXG4gICAgICAgIGluaXRpYWxUb29scyxcbiAgICAgICAgbWNwQ2xpZW50cyxcbiAgICAgICAgYXV0b0Nvbm5lY3RJZGVGbGFnOiBpZGUsXG4gICAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gICAgICAgIGRpc2FibGVTbGFzaENvbW1hbmRzLFxuICAgICAgICBkeW5hbWljTWNwQ29uZmlnLFxuICAgICAgICBzdHJpY3RNY3BDb25maWcsXG4gICAgICAgIHN5c3RlbVByb21wdCxcbiAgICAgICAgYXBwZW5kU3lzdGVtUHJvbXB0LFxuICAgICAgICB0YXNrTGlzdElkLFxuICAgICAgICB0aGlua2luZ0NvbmZpZyxcbiAgICAgICAgLi4uKHVwbG9hZGVyUmVhZHkgJiYge1xuICAgICAgICAgIG9uVHVybkNvbXBsZXRlOiAobWVzc2FnZXM6IE1lc3NhZ2VUeXBlW10pID0+IHtcbiAgICAgICAgICAgIHZvaWQgdXBsb2FkZXJSZWFkeS50aGVuKHVwbG9hZGVyID0+IHVwbG9hZGVyPy4obWVzc2FnZXMpKVxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgfVxuXG4gICAgICAvLyBTaGFyZWQgY29udGV4dCBmb3IgcHJvY2Vzc1Jlc3VtZWRDb252ZXJzYXRpb24gY2FsbHNcbiAgICAgIGNvbnN0IHJlc3VtZUNvbnRleHQgPSB7XG4gICAgICAgIG1vZGVBcGk6IGNvb3JkaW5hdG9yTW9kZU1vZHVsZSxcbiAgICAgICAgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbixcbiAgICAgICAgYWdlbnREZWZpbml0aW9ucyxcbiAgICAgICAgY3VycmVudEN3ZCxcbiAgICAgICAgY2xpQWdlbnRzLFxuICAgICAgICBpbml0aWFsU3RhdGUsXG4gICAgICB9XG5cbiAgICAgIGlmIChvcHRpb25zLmNvbnRpbnVlKSB7XG4gICAgICAgIC8vIENvbnRpbnVlIHRoZSBtb3N0IHJlY2VudCBjb252ZXJzYXRpb24gZGlyZWN0bHlcbiAgICAgICAgbGV0IHJlc3VtZVN1Y2NlZWRlZCA9IGZhbHNlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzdW1lU3RhcnQgPSBwZXJmb3JtYW5jZS5ub3coKVxuXG4gICAgICAgICAgLy8gQ2xlYXIgc3RhbGUgY2FjaGVzIGJlZm9yZSByZXN1bWluZyB0byBlbnN1cmUgZnJlc2ggZmlsZS9za2lsbCBkaXNjb3ZlcnlcbiAgICAgICAgICBjb25zdCB7IGNsZWFyU2Vzc2lvbkNhY2hlcyB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgJy4vY29tbWFuZHMvY2xlYXIvY2FjaGVzLmpzJ1xuICAgICAgICAgIClcbiAgICAgICAgICBjbGVhclNlc3Npb25DYWNoZXMoKVxuXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbG9hZENvbnZlcnNhdGlvbkZvclJlc3VtZShcbiAgICAgICAgICAgIHVuZGVmaW5lZCAvKiBzZXNzaW9uSWQgKi8sXG4gICAgICAgICAgICB1bmRlZmluZWQgLyogc291cmNlRmlsZSAqLyxcbiAgICAgICAgICApXG4gICAgICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9jb250aW51ZScsIHtcbiAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGV4aXRXaXRoRXJyb3IoXG4gICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgICdObyBjb252ZXJzYXRpb24gZm91bmQgdG8gY29udGludWUnLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGxvYWRlZCA9IGF3YWl0IHByb2Nlc3NSZXN1bWVkQ29udmVyc2F0aW9uKFxuICAgICAgICAgICAgcmVzdWx0LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBmb3JrU2Vzc2lvbjogISFvcHRpb25zLmZvcmtTZXNzaW9uLFxuICAgICAgICAgICAgICBpbmNsdWRlQXR0cmlidXRpb246IHRydWUsXG4gICAgICAgICAgICAgIHRyYW5zY3JpcHRQYXRoOiByZXN1bHQuZnVsbFBhdGgsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzdW1lQ29udGV4dCxcbiAgICAgICAgICApXG5cbiAgICAgICAgICBpZiAobG9hZGVkLnJlc3RvcmVkQWdlbnREZWYpIHtcbiAgICAgICAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24gPSBsb2FkZWQucmVzdG9yZWRBZ2VudERlZlxuICAgICAgICAgIH1cblxuICAgICAgICAgIG1heWJlQWN0aXZhdGVQcm9hY3RpdmUob3B0aW9ucylcbiAgICAgICAgICBtYXliZUFjdGl2YXRlQnJpZWYob3B0aW9ucylcblxuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9jb250aW51ZScsIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICByZXN1bWVfZHVyYXRpb25fbXM6IE1hdGgucm91bmQocGVyZm9ybWFuY2Uubm93KCkgLSByZXN1bWVTdGFydCksXG4gICAgICAgICAgfSlcbiAgICAgICAgICByZXN1bWVTdWNjZWVkZWQgPSB0cnVlXG5cbiAgICAgICAgICBhd2FpdCBsYXVuY2hSZXBsKFxuICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgIHsgZ2V0RnBzTWV0cmljcywgc3RhdHMsIGluaXRpYWxTdGF0ZTogbG9hZGVkLmluaXRpYWxTdGF0ZSB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAuLi5zZXNzaW9uQ29uZmlnLFxuICAgICAgICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uOlxuICAgICAgICAgICAgICAgIGxvYWRlZC5yZXN0b3JlZEFnZW50RGVmID8/IG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gICAgICAgICAgICAgIGluaXRpYWxNZXNzYWdlczogbG9hZGVkLm1lc3NhZ2VzLFxuICAgICAgICAgICAgICBpbml0aWFsRmlsZUhpc3RvcnlTbmFwc2hvdHM6IGxvYWRlZC5maWxlSGlzdG9yeVNuYXBzaG90cyxcbiAgICAgICAgICAgICAgaW5pdGlhbENvbnRlbnRSZXBsYWNlbWVudHM6IGxvYWRlZC5jb250ZW50UmVwbGFjZW1lbnRzLFxuICAgICAgICAgICAgICBpbml0aWFsQWdlbnROYW1lOiBsb2FkZWQuYWdlbnROYW1lLFxuICAgICAgICAgICAgICBpbml0aWFsQWdlbnRDb2xvcjogbG9hZGVkLmFnZW50Q29sb3IsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVuZGVyQW5kUnVuLFxuICAgICAgICAgIClcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBpZiAoIXJlc3VtZVN1Y2NlZWRlZCkge1xuICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2NvbnRpbnVlJywge1xuICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICAgIGxvZ0Vycm9yKGVycm9yKVxuICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGZlYXR1cmUoJ0RJUkVDVF9DT05ORUNUJykgJiYgX3BlbmRpbmdDb25uZWN0Py51cmwpIHtcbiAgICAgICAgLy8gYGNsYXVkZSBjb25uZWN0IDx1cmw+YCDigJQgZnVsbCBpbnRlcmFjdGl2ZSBUVUkgY29ubmVjdGVkIHRvIGEgcmVtb3RlIHNlcnZlclxuICAgICAgICBsZXQgZGlyZWN0Q29ubmVjdENvbmZpZ1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBjcmVhdGVEaXJlY3RDb25uZWN0U2Vzc2lvbih7XG4gICAgICAgICAgICBzZXJ2ZXJVcmw6IF9wZW5kaW5nQ29ubmVjdC51cmwsXG4gICAgICAgICAgICBhdXRoVG9rZW46IF9wZW5kaW5nQ29ubmVjdC5hdXRoVG9rZW4sXG4gICAgICAgICAgICBjd2Q6IGdldE9yaWdpbmFsQ3dkKCksXG4gICAgICAgICAgICBkYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uczpcbiAgICAgICAgICAgICAgX3BlbmRpbmdDb25uZWN0LmRhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgaWYgKHNlc3Npb24ud29ya0Rpcikge1xuICAgICAgICAgICAgc2V0T3JpZ2luYWxDd2Qoc2Vzc2lvbi53b3JrRGlyKVxuICAgICAgICAgICAgc2V0Q3dkU3RhdGUoc2Vzc2lvbi53b3JrRGlyKVxuICAgICAgICAgIH1cbiAgICAgICAgICBzZXREaXJlY3RDb25uZWN0U2VydmVyVXJsKF9wZW5kaW5nQ29ubmVjdC51cmwpXG4gICAgICAgICAgZGlyZWN0Q29ubmVjdENvbmZpZyA9IHNlc3Npb24uY29uZmlnXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHJldHVybiBhd2FpdCBleGl0V2l0aEVycm9yKFxuICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgIGVyciBpbnN0YW5jZW9mIERpcmVjdENvbm5lY3RFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVyciksXG4gICAgICAgICAgICAoKSA9PiBncmFjZWZ1bFNodXRkb3duKDEpLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbm5lY3RJbmZvTWVzc2FnZSA9IGNyZWF0ZVN5c3RlbU1lc3NhZ2UoXG4gICAgICAgICAgYENvbm5lY3RlZCB0byBzZXJ2ZXIgYXQgJHtfcGVuZGluZ0Nvbm5lY3QudXJsfVxcblNlc3Npb246ICR7ZGlyZWN0Q29ubmVjdENvbmZpZy5zZXNzaW9uSWR9YCxcbiAgICAgICAgICAnaW5mbycsXG4gICAgICAgIClcblxuICAgICAgICBhd2FpdCBsYXVuY2hSZXBsKFxuICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgeyBnZXRGcHNNZXRyaWNzLCBzdGF0cywgaW5pdGlhbFN0YXRlIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgZGVidWc6IGRlYnVnIHx8IGRlYnVnVG9TdGRlcnIsXG4gICAgICAgICAgICBjb21tYW5kcyxcbiAgICAgICAgICAgIGluaXRpYWxUb29sczogW10sXG4gICAgICAgICAgICBpbml0aWFsTWVzc2FnZXM6IFtjb25uZWN0SW5mb01lc3NhZ2VdLFxuICAgICAgICAgICAgbWNwQ2xpZW50czogW10sXG4gICAgICAgICAgICBhdXRvQ29ubmVjdElkZUZsYWc6IGlkZSxcbiAgICAgICAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gICAgICAgICAgICBkaXNhYmxlU2xhc2hDb21tYW5kcyxcbiAgICAgICAgICAgIGRpcmVjdENvbm5lY3RDb25maWcsXG4gICAgICAgICAgICB0aGlua2luZ0NvbmZpZyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJlbmRlckFuZFJ1bixcbiAgICAgICAgKVxuICAgICAgICByZXR1cm5cbiAgICAgIH0gZWxzZSBpZiAoZmVhdHVyZSgnU1NIX1JFTU9URScpICYmIF9wZW5kaW5nU1NIPy5ob3N0KSB7XG4gICAgICAgIC8vIGBjbGF1ZGUgc3NoIDxob3N0PiBbZGlyXWAg4oCUIHByb2JlIHJlbW90ZSwgZGVwbG95IGJpbmFyeSBpZiBuZWVkZWQsXG4gICAgICAgIC8vIHNwYXduIHNzaCB3aXRoIHVuaXgtc29ja2V0IC1SIGZvcndhcmQgdG8gYSBsb2NhbCBhdXRoIHByb3h5LCBoYW5kXG4gICAgICAgIC8vIHRoZSBSRVBMIGFuIFNTSFNlc3Npb24uIFRvb2xzIHJ1biByZW1vdGVseSwgVUkgcmVuZGVycyBsb2NhbGx5LlxuICAgICAgICAvLyBgLS1sb2NhbGAgc2tpcHMgcHJvYmUvZGVwbG95L3NzaCBhbmQgc3Bhd25zIHRoZSBjdXJyZW50IGJpbmFyeVxuICAgICAgICAvLyBkaXJlY3RseSB3aXRoIHRoZSBzYW1lIGVudiDigJQgZTJlIHRlc3Qgb2YgdGhlIHByb3h5L2F1dGggcGx1bWJpbmcuXG4gICAgICAgIGNvbnN0IHsgY3JlYXRlU1NIU2Vzc2lvbiwgY3JlYXRlTG9jYWxTU0hTZXNzaW9uLCBTU0hTZXNzaW9uRXJyb3IgfSA9XG4gICAgICAgICAgYXdhaXQgaW1wb3J0KCcuL3NzaC9jcmVhdGVTU0hTZXNzaW9uLmpzJylcbiAgICAgICAgbGV0IHNzaFNlc3Npb25cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAoX3BlbmRpbmdTU0gubG9jYWwpIHtcbiAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKCdTdGFydGluZyBsb2NhbCBzc2gtcHJveHkgdGVzdCBzZXNzaW9uLi4uXFxuJylcbiAgICAgICAgICAgIHNzaFNlc3Npb24gPSBjcmVhdGVMb2NhbFNTSFNlc3Npb24oe1xuICAgICAgICAgICAgICBjd2Q6IF9wZW5kaW5nU1NILmN3ZCxcbiAgICAgICAgICAgICAgcGVybWlzc2lvbk1vZGU6IF9wZW5kaW5nU1NILnBlcm1pc3Npb25Nb2RlLFxuICAgICAgICAgICAgICBkYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uczpcbiAgICAgICAgICAgICAgICBfcGVuZGluZ1NTSC5kYW5nZXJvdXNseVNraXBQZXJtaXNzaW9ucyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKGBDb25uZWN0aW5nIHRvICR7X3BlbmRpbmdTU0guaG9zdH3igKZcXG5gKVxuICAgICAgICAgICAgLy8gSW4tcGxhY2UgcHJvZ3Jlc3M6IFxcciArIEVMMCAoZXJhc2UgdG8gZW5kIG9mIGxpbmUpLiBGaW5hbCBcXG4gb25cbiAgICAgICAgICAgIC8vIHN1Y2Nlc3Mgc28gdGhlIG5leHQgbWVzc2FnZSBsYW5kcyBvbiBhIGZyZXNoIGxpbmUuIE5vLW9wIHdoZW5cbiAgICAgICAgICAgIC8vIHN0ZGVyciBpc24ndCBhIFRUWSAocGlwZWQvcmVkaXJlY3RlZCkg4oCUIFxcciB3b3VsZCBqdXN0IGVtaXQgbm9pc2UuXG4gICAgICAgICAgICBjb25zdCBpc1RUWSA9IHByb2Nlc3Muc3RkZXJyLmlzVFRZXG4gICAgICAgICAgICBsZXQgaGFkUHJvZ3Jlc3MgPSBmYWxzZVxuICAgICAgICAgICAgc3NoU2Vzc2lvbiA9IGF3YWl0IGNyZWF0ZVNTSFNlc3Npb24oXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBob3N0OiBfcGVuZGluZ1NTSC5ob3N0LFxuICAgICAgICAgICAgICAgIGN3ZDogX3BlbmRpbmdTU0guY3dkLFxuICAgICAgICAgICAgICAgIGxvY2FsVmVyc2lvbjogTUFDUk8uVkVSU0lPTixcbiAgICAgICAgICAgICAgICBwZXJtaXNzaW9uTW9kZTogX3BlbmRpbmdTU0gucGVybWlzc2lvbk1vZGUsXG4gICAgICAgICAgICAgICAgZGFuZ2Vyb3VzbHlTa2lwUGVybWlzc2lvbnM6XG4gICAgICAgICAgICAgICAgICBfcGVuZGluZ1NTSC5kYW5nZXJvdXNseVNraXBQZXJtaXNzaW9ucyxcbiAgICAgICAgICAgICAgICBleHRyYUNsaUFyZ3M6IF9wZW5kaW5nU1NILmV4dHJhQ2xpQXJncyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgaXNUVFlcbiAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgb25Qcm9ncmVzczogbXNnID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBoYWRQcm9ncmVzcyA9IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShgXFxyICAke21zZ31cXHgxYltLYClcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICA6IHt9LFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgaWYgKGhhZFByb2dyZXNzKSBwcm9jZXNzLnN0ZGVyci53cml0ZSgnXFxuJylcbiAgICAgICAgICB9XG4gICAgICAgICAgc2V0T3JpZ2luYWxDd2Qoc3NoU2Vzc2lvbi5yZW1vdGVDd2QpXG4gICAgICAgICAgc2V0Q3dkU3RhdGUoc3NoU2Vzc2lvbi5yZW1vdGVDd2QpXG4gICAgICAgICAgc2V0RGlyZWN0Q29ubmVjdFNlcnZlclVybChcbiAgICAgICAgICAgIF9wZW5kaW5nU1NILmxvY2FsID8gJ2xvY2FsJyA6IF9wZW5kaW5nU1NILmhvc3QsXG4gICAgICAgICAgKVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICByZXR1cm4gYXdhaXQgZXhpdFdpdGhFcnJvcihcbiAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICBlcnIgaW5zdGFuY2VvZiBTU0hTZXNzaW9uRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpLFxuICAgICAgICAgICAgKCkgPT4gZ3JhY2VmdWxTaHV0ZG93bigxKSxcbiAgICAgICAgICApXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzc2hJbmZvTWVzc2FnZSA9IGNyZWF0ZVN5c3RlbU1lc3NhZ2UoXG4gICAgICAgICAgX3BlbmRpbmdTU0gubG9jYWxcbiAgICAgICAgICAgID8gYExvY2FsIHNzaC1wcm94eSB0ZXN0IHNlc3Npb25cXG5jd2Q6ICR7c3NoU2Vzc2lvbi5yZW1vdGVDd2R9XFxuQXV0aDogdW5peCBzb2NrZXQg4oaSIGxvY2FsIHByb3h5YFxuICAgICAgICAgICAgOiBgU1NIIHNlc3Npb24gdG8gJHtfcGVuZGluZ1NTSC5ob3N0fVxcblJlbW90ZSBjd2Q6ICR7c3NoU2Vzc2lvbi5yZW1vdGVDd2R9XFxuQXV0aDogdW5peCBzb2NrZXQgLVIg4oaSIGxvY2FsIHByb3h5YCxcbiAgICAgICAgICAnaW5mbycsXG4gICAgICAgIClcblxuICAgICAgICBhd2FpdCBsYXVuY2hSZXBsKFxuICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgeyBnZXRGcHNNZXRyaWNzLCBzdGF0cywgaW5pdGlhbFN0YXRlIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgZGVidWc6IGRlYnVnIHx8IGRlYnVnVG9TdGRlcnIsXG4gICAgICAgICAgICBjb21tYW5kcyxcbiAgICAgICAgICAgIGluaXRpYWxUb29sczogW10sXG4gICAgICAgICAgICBpbml0aWFsTWVzc2FnZXM6IFtzc2hJbmZvTWVzc2FnZV0sXG4gICAgICAgICAgICBtY3BDbGllbnRzOiBbXSxcbiAgICAgICAgICAgIGF1dG9Db25uZWN0SWRlRmxhZzogaWRlLFxuICAgICAgICAgICAgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbixcbiAgICAgICAgICAgIGRpc2FibGVTbGFzaENvbW1hbmRzLFxuICAgICAgICAgICAgc3NoU2Vzc2lvbixcbiAgICAgICAgICAgIHRoaW5raW5nQ29uZmlnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcmVuZGVyQW5kUnVuLFxuICAgICAgICApXG4gICAgICAgIHJldHVyblxuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgZmVhdHVyZSgnS0FJUk9TJykgJiZcbiAgICAgICAgX3BlbmRpbmdBc3Npc3RhbnRDaGF0ICYmXG4gICAgICAgIChfcGVuZGluZ0Fzc2lzdGFudENoYXQuc2Vzc2lvbklkIHx8IF9wZW5kaW5nQXNzaXN0YW50Q2hhdC5kaXNjb3ZlcilcbiAgICAgICkge1xuICAgICAgICAvLyBgY2xhdWRlIGFzc2lzdGFudCBbc2Vzc2lvbklkXWAg4oCUIFJFUEwgYXMgYSBwdXJlIHZpZXdlciBjbGllbnRcbiAgICAgICAgLy8gb2YgYSByZW1vdGUgYXNzaXN0YW50IHNlc3Npb24uIFRoZSBhZ2VudGljIGxvb3AgcnVucyByZW1vdGVseTsgdGhpc1xuICAgICAgICAvLyBwcm9jZXNzIHN0cmVhbXMgbGl2ZSBldmVudHMgYW5kIFBPU1RzIG1lc3NhZ2VzLiBIaXN0b3J5IGlzIGxhenktXG4gICAgICAgIC8vIGxvYWRlZCBieSB1c2VBc3Npc3RhbnRIaXN0b3J5IG9uIHNjcm9sbC11cCAobm8gYmxvY2tpbmcgZmV0Y2ggaGVyZSkuXG4gICAgICAgIGNvbnN0IHsgZGlzY292ZXJBc3Npc3RhbnRTZXNzaW9ucyB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICcuL2Fzc2lzdGFudC9zZXNzaW9uRGlzY292ZXJ5LmpzJ1xuICAgICAgICApXG5cbiAgICAgICAgbGV0IHRhcmdldFNlc3Npb25JZCA9IF9wZW5kaW5nQXNzaXN0YW50Q2hhdC5zZXNzaW9uSWRcblxuICAgICAgICAvLyBEaXNjb3ZlcnkgZmxvdyDigJQgbGlzdCBicmlkZ2UgZW52aXJvbm1lbnRzLCBmaWx0ZXIgc2Vzc2lvbnNcbiAgICAgICAgaWYgKCF0YXJnZXRTZXNzaW9uSWQpIHtcbiAgICAgICAgICBsZXQgc2Vzc2lvbnNcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgc2Vzc2lvbnMgPSBhd2FpdCBkaXNjb3ZlckFzc2lzdGFudFNlc3Npb25zKClcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZXhpdFdpdGhFcnJvcihcbiAgICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgICAgYEZhaWxlZCB0byBkaXNjb3ZlciBzZXNzaW9uczogJHtlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBlfWAsXG4gICAgICAgICAgICAgICgpID0+IGdyYWNlZnVsU2h1dGRvd24oMSksXG4gICAgICAgICAgICApXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzZXNzaW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGxldCBpbnN0YWxsZWREaXI6IHN0cmluZyB8IG51bGxcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGluc3RhbGxlZERpciA9IGF3YWl0IGxhdW5jaEFzc2lzdGFudEluc3RhbGxXaXphcmQocm9vdClcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGV4aXRXaXRoRXJyb3IoXG4gICAgICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgICAgICBgQXNzaXN0YW50IGluc3RhbGxhdGlvbiBmYWlsZWQ6ICR7ZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogZX1gLFxuICAgICAgICAgICAgICAgICgpID0+IGdyYWNlZnVsU2h1dGRvd24oMSksXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbnN0YWxsZWREaXIgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgYXdhaXQgZ3JhY2VmdWxTaHV0ZG93bigwKVxuICAgICAgICAgICAgICBwcm9jZXNzLmV4aXQoMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFRoZSBkYWVtb24gbmVlZHMgYSBmZXcgc2Vjb25kcyB0byBzcGluIHVwIGl0cyB3b3JrZXIgYW5kXG4gICAgICAgICAgICAvLyBlc3RhYmxpc2ggYSBicmlkZ2Ugc2Vzc2lvbiBiZWZvcmUgZGlzY292ZXJ5IHdpbGwgZmluZCBpdC5cbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBleGl0V2l0aE1lc3NhZ2UoXG4gICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgIGBBc3Npc3RhbnQgaW5zdGFsbGVkIGluICR7aW5zdGFsbGVkRGlyfS4gVGhlIGRhZW1vbiBpcyBzdGFydGluZyB1cCDigJQgcnVuIFxcYGNsYXVkZSBhc3Npc3RhbnRcXGAgYWdhaW4gaW4gYSBmZXcgc2Vjb25kcyB0byBjb25uZWN0LmAsXG4gICAgICAgICAgICAgIHsgZXhpdENvZGU6IDAsIGJlZm9yZUV4aXQ6ICgpID0+IGdyYWNlZnVsU2h1dGRvd24oMCkgfSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlc3Npb25zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgdGFyZ2V0U2Vzc2lvbklkID0gc2Vzc2lvbnNbMF0hLmlkXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHBpY2tlZCA9IGF3YWl0IGxhdW5jaEFzc2lzdGFudFNlc3Npb25DaG9vc2VyKHJvb3QsIHtcbiAgICAgICAgICAgICAgc2Vzc2lvbnMsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgaWYgKCFwaWNrZWQpIHtcbiAgICAgICAgICAgICAgYXdhaXQgZ3JhY2VmdWxTaHV0ZG93bigwKVxuICAgICAgICAgICAgICBwcm9jZXNzLmV4aXQoMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRhcmdldFNlc3Npb25JZCA9IHBpY2tlZFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEF1dGgg4oCUIGNhbGwgcHJlcGFyZUFwaVJlcXVlc3QoKSBvbmNlIGZvciBvcmdVVUlELCBidXQgdXNlIGFcbiAgICAgICAgLy8gZ2V0QWNjZXNzVG9rZW4gY2xvc3VyZSBmb3IgdGhlIHRva2VuIHNvIHJlY29ubmVjdHMgZ2V0IGZyZXNoIHRva2Vucy5cbiAgICAgICAgY29uc3QgeyBjaGVja0FuZFJlZnJlc2hPQXV0aFRva2VuSWZOZWVkZWQsIGdldENsYXVkZUFJT0F1dGhUb2tlbnMgfSA9XG4gICAgICAgICAgYXdhaXQgaW1wb3J0KCcuL3V0aWxzL2F1dGguanMnKVxuICAgICAgICBhd2FpdCBjaGVja0FuZFJlZnJlc2hPQXV0aFRva2VuSWZOZWVkZWQoKVxuICAgICAgICBsZXQgYXBpQ3JlZHNcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhcGlDcmVkcyA9IGF3YWl0IHByZXBhcmVBcGlSZXF1ZXN0KClcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHJldHVybiBhd2FpdCBleGl0V2l0aEVycm9yKFxuICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgIGBFcnJvcjogJHtlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiAnRmFpbGVkIHRvIGF1dGhlbnRpY2F0ZSd9YCxcbiAgICAgICAgICAgICgpID0+IGdyYWNlZnVsU2h1dGRvd24oMSksXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGdldEFjY2Vzc1Rva2VuID0gKCk6IHN0cmluZyA9PlxuICAgICAgICAgIGdldENsYXVkZUFJT0F1dGhUb2tlbnMoKT8uYWNjZXNzVG9rZW4gPz8gYXBpQ3JlZHMuYWNjZXNzVG9rZW5cblxuICAgICAgICAvLyBCcmllZiBtb2RlIGFjdGl2YXRpb246IHNldEthaXJvc0FjdGl2ZSh0cnVlKSBzYXRpc2ZpZXMgQk9USCBvcHQtaW5cbiAgICAgICAgLy8gYW5kIGVudGl0bGVtZW50IGZvciBpc0JyaWVmRW5hYmxlZCgpIChCcmllZlRvb2wudHM6MTI0LTEzMikuXG4gICAgICAgIHNldEthaXJvc0FjdGl2ZSh0cnVlKVxuICAgICAgICBzZXRVc2VyTXNnT3B0SW4odHJ1ZSlcbiAgICAgICAgc2V0SXNSZW1vdGVNb2RlKHRydWUpXG5cbiAgICAgICAgY29uc3QgcmVtb3RlU2Vzc2lvbkNvbmZpZyA9IGNyZWF0ZVJlbW90ZVNlc3Npb25Db25maWcoXG4gICAgICAgICAgdGFyZ2V0U2Vzc2lvbklkLFxuICAgICAgICAgIGdldEFjY2Vzc1Rva2VuLFxuICAgICAgICAgIGFwaUNyZWRzLm9yZ1VVSUQsXG4gICAgICAgICAgLyogaGFzSW5pdGlhbFByb21wdCAqLyBmYWxzZSxcbiAgICAgICAgICAvKiB2aWV3ZXJPbmx5ICovIHRydWUsXG4gICAgICAgIClcblxuICAgICAgICBjb25zdCBpbmZvTWVzc2FnZSA9IGNyZWF0ZVN5c3RlbU1lc3NhZ2UoXG4gICAgICAgICAgYEF0dGFjaGVkIHRvIGFzc2lzdGFudCBzZXNzaW9uICR7dGFyZ2V0U2Vzc2lvbklkLnNsaWNlKDAsIDgpfeKApmAsXG4gICAgICAgICAgJ2luZm8nLFxuICAgICAgICApXG5cbiAgICAgICAgY29uc3QgYXNzaXN0YW50SW5pdGlhbFN0YXRlOiBBcHBTdGF0ZSA9IHtcbiAgICAgICAgICAuLi5pbml0aWFsU3RhdGUsXG4gICAgICAgICAgaXNCcmllZk9ubHk6IHRydWUsXG4gICAgICAgICAga2Fpcm9zRW5hYmxlZDogZmFsc2UsXG4gICAgICAgICAgcmVwbEJyaWRnZUVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVtb3RlQ29tbWFuZHMgPSBmaWx0ZXJDb21tYW5kc0ZvclJlbW90ZU1vZGUoY29tbWFuZHMpXG4gICAgICAgIGF3YWl0IGxhdW5jaFJlcGwoXG4gICAgICAgICAgcm9vdCxcbiAgICAgICAgICB7IGdldEZwc01ldHJpY3MsIHN0YXRzLCBpbml0aWFsU3RhdGU6IGFzc2lzdGFudEluaXRpYWxTdGF0ZSB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGRlYnVnOiBkZWJ1ZyB8fCBkZWJ1Z1RvU3RkZXJyLFxuICAgICAgICAgICAgY29tbWFuZHM6IHJlbW90ZUNvbW1hbmRzLFxuICAgICAgICAgICAgaW5pdGlhbFRvb2xzOiBbXSxcbiAgICAgICAgICAgIGluaXRpYWxNZXNzYWdlczogW2luZm9NZXNzYWdlXSxcbiAgICAgICAgICAgIG1jcENsaWVudHM6IFtdLFxuICAgICAgICAgICAgYXV0b0Nvbm5lY3RJZGVGbGFnOiBpZGUsXG4gICAgICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLFxuICAgICAgICAgICAgZGlzYWJsZVNsYXNoQ29tbWFuZHMsXG4gICAgICAgICAgICByZW1vdGVTZXNzaW9uQ29uZmlnLFxuICAgICAgICAgICAgdGhpbmtpbmdDb25maWcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICByZW5kZXJBbmRSdW4sXG4gICAgICAgIClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBvcHRpb25zLnJlc3VtZSB8fFxuICAgICAgICBvcHRpb25zLmZyb21QciB8fFxuICAgICAgICB0ZWxlcG9ydCB8fFxuICAgICAgICByZW1vdGUgIT09IG51bGxcbiAgICAgICkge1xuICAgICAgICAvLyBIYW5kbGUgcmVzdW1lIGZsb3cgLSBmcm9tIGZpbGUgKGFudC1vbmx5KSwgc2Vzc2lvbiBJRCwgb3IgaW50ZXJhY3RpdmUgc2VsZWN0b3JcblxuICAgICAgICAvLyBDbGVhciBzdGFsZSBjYWNoZXMgYmVmb3JlIHJlc3VtaW5nIHRvIGVuc3VyZSBmcmVzaCBmaWxlL3NraWxsIGRpc2NvdmVyeVxuICAgICAgICBjb25zdCB7IGNsZWFyU2Vzc2lvbkNhY2hlcyB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICcuL2NvbW1hbmRzL2NsZWFyL2NhY2hlcy5qcydcbiAgICAgICAgKVxuICAgICAgICBjbGVhclNlc3Npb25DYWNoZXMoKVxuXG4gICAgICAgIGxldCBtZXNzYWdlczogTWVzc2FnZVR5cGVbXSB8IG51bGwgPSBudWxsXG4gICAgICAgIGxldCBwcm9jZXNzZWRSZXN1bWU6IFByb2Nlc3NlZFJlc3VtZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXG4gICAgICAgIGxldCBtYXliZVNlc3Npb25JZCA9IHZhbGlkYXRlVXVpZChvcHRpb25zLnJlc3VtZSlcbiAgICAgICAgbGV0IHNlYXJjaFRlcm06IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuICAgICAgICAvLyBTdG9yZSBmdWxsIExvZ09wdGlvbiB3aGVuIGZvdW5kIGJ5IGN1c3RvbSB0aXRsZSAoZm9yIGNyb3NzLXdvcmt0cmVlIHJlc3VtZSlcbiAgICAgICAgbGV0IG1hdGNoZWRMb2c6IExvZ09wdGlvbiB8IG51bGwgPSBudWxsXG4gICAgICAgIC8vIFBSIGZpbHRlciBmb3IgLS1mcm9tLXByIGZsYWdcbiAgICAgICAgbGV0IGZpbHRlckJ5UHI6IGJvb2xlYW4gfCBudW1iZXIgfCBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcblxuICAgICAgICAvLyBIYW5kbGUgLS1mcm9tLXByIGZsYWdcbiAgICAgICAgaWYgKG9wdGlvbnMuZnJvbVByKSB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMuZnJvbVByID09PSB0cnVlKSB7XG4gICAgICAgICAgICAvLyBTaG93IGFsbCBzZXNzaW9ucyB3aXRoIGxpbmtlZCBQUnNcbiAgICAgICAgICAgIGZpbHRlckJ5UHIgPSB0cnVlXG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucy5mcm9tUHIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAvLyBDb3VsZCBiZSBhIFBSIG51bWJlciBvciBVUkxcbiAgICAgICAgICAgIGZpbHRlckJ5UHIgPSBvcHRpb25zLmZyb21QclxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHJlc3VtZSB2YWx1ZSBpcyBub3QgYSBVVUlELCB0cnkgZXhhY3QgbWF0Y2ggYnkgY3VzdG9tIHRpdGxlIGZpcnN0XG4gICAgICAgIGlmIChcbiAgICAgICAgICBvcHRpb25zLnJlc3VtZSAmJlxuICAgICAgICAgIHR5cGVvZiBvcHRpb25zLnJlc3VtZSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICAhbWF5YmVTZXNzaW9uSWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3QgdHJpbW1lZFZhbHVlID0gb3B0aW9ucy5yZXN1bWUudHJpbSgpXG4gICAgICAgICAgaWYgKHRyaW1tZWRWYWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGF3YWl0IHNlYXJjaFNlc3Npb25zQnlDdXN0b21UaXRsZSh0cmltbWVkVmFsdWUsIHtcbiAgICAgICAgICAgICAgZXhhY3Q6IHRydWUsXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICBpZiAobWF0Y2hlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgLy8gRXhhY3QgbWF0Y2ggZm91bmQgLSBzdG9yZSBmdWxsIExvZ09wdGlvbiBmb3IgY3Jvc3Mtd29ya3RyZWUgcmVzdW1lXG4gICAgICAgICAgICAgIG1hdGNoZWRMb2cgPSBtYXRjaGVzWzBdIVxuICAgICAgICAgICAgICBtYXliZVNlc3Npb25JZCA9IGdldFNlc3Npb25JZEZyb21Mb2cobWF0Y2hlZExvZykgPz8gbnVsbFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gTm8gbWF0Y2ggb3IgbXVsdGlwbGUgbWF0Y2hlcyAtIHVzZSBhcyBzZWFyY2ggdGVybSBmb3IgcGlja2VyXG4gICAgICAgICAgICAgIHNlYXJjaFRlcm0gPSB0cmltbWVkVmFsdWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLXJlbW90ZSBhbmQgLS10ZWxlcG9ydCBib3RoIGNyZWF0ZS9yZXN1bWUgQ2xhdWRlIENvZGUgV2ViIChDQ1IpIHNlc3Npb25zLlxuICAgICAgICAvLyBSZW1vdGUgQ29udHJvbCAoLS1yYykgaXMgYSBzZXBhcmF0ZSBmZWF0dXJlIGdhdGVkIGluIGluaXRSZXBsQnJpZGdlLnRzLlxuICAgICAgICBpZiAocmVtb3RlICE9PSBudWxsIHx8IHRlbGVwb3J0KSB7XG4gICAgICAgICAgYXdhaXQgd2FpdEZvclBvbGljeUxpbWl0c1RvTG9hZCgpXG4gICAgICAgICAgaWYgKCFpc1BvbGljeUFsbG93ZWQoJ2FsbG93X3JlbW90ZV9zZXNzaW9ucycpKSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgZXhpdFdpdGhFcnJvcihcbiAgICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgICAgXCJFcnJvcjogUmVtb3RlIHNlc3Npb25zIGFyZSBkaXNhYmxlZCBieSB5b3VyIG9yZ2FuaXphdGlvbidzIHBvbGljeS5cIixcbiAgICAgICAgICAgICAgKCkgPT4gZ3JhY2VmdWxTaHV0ZG93bigxKSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVtb3RlICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIHJlbW90ZSBzZXNzaW9uIChvcHRpb25hbGx5IHdpdGggaW5pdGlhbCBwcm9tcHQpXG4gICAgICAgICAgY29uc3QgaGFzSW5pdGlhbFByb21wdCA9IHJlbW90ZS5sZW5ndGggPiAwXG5cbiAgICAgICAgICAvLyBDaGVjayBpZiBUVUkgbW9kZSBpcyBlbmFibGVkIC0gZGVzY3JpcHRpb24gaXMgb25seSBvcHRpb25hbCBpbiBUVUkgbW9kZVxuICAgICAgICAgIGNvbnN0IGlzUmVtb3RlVHVpRW5hYmxlZCA9IGdldEZlYXR1cmVWYWx1ZV9DQUNIRURfTUFZX0JFX1NUQUxFKFxuICAgICAgICAgICAgJ3Rlbmd1X3JlbW90ZV9iYWNrZW5kJyxcbiAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgIClcbiAgICAgICAgICBpZiAoIWlzUmVtb3RlVHVpRW5hYmxlZCAmJiAhaGFzSW5pdGlhbFByb21wdCkge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGV4aXRXaXRoRXJyb3IoXG4gICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgICdFcnJvcjogLS1yZW1vdGUgcmVxdWlyZXMgYSBkZXNjcmlwdGlvbi5cXG5Vc2FnZTogY2xhdWRlIC0tcmVtb3RlIFwieW91ciB0YXNrIGRlc2NyaXB0aW9uXCInLFxuICAgICAgICAgICAgICAoKSA9PiBncmFjZWZ1bFNodXRkb3duKDEpLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9yZW1vdGVfY3JlYXRlX3Nlc3Npb24nLCB7XG4gICAgICAgICAgICBoYXNfaW5pdGlhbF9wcm9tcHQ6IFN0cmluZyhcbiAgICAgICAgICAgICAgaGFzSW5pdGlhbFByb21wdCxcbiAgICAgICAgICAgICkgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgLy8gUGFzcyBjdXJyZW50IGJyYW5jaCBzbyBDQ1IgY2xvbmVzIHRoZSByZXBvIGF0IHRoZSByaWdodCByZXZpc2lvblxuICAgICAgICAgIGNvbnN0IGN1cnJlbnRCcmFuY2ggPSBhd2FpdCBnZXRCcmFuY2goKVxuICAgICAgICAgIGNvbnN0IGNyZWF0ZWRTZXNzaW9uID0gYXdhaXQgdGVsZXBvcnRUb1JlbW90ZVdpdGhFcnJvckhhbmRsaW5nKFxuICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgIGhhc0luaXRpYWxQcm9tcHQgPyByZW1vdGUgOiBudWxsLFxuICAgICAgICAgICAgbmV3IEFib3J0Q29udHJvbGxlcigpLnNpZ25hbCxcbiAgICAgICAgICAgIGN1cnJlbnRCcmFuY2ggfHwgdW5kZWZpbmVkLFxuICAgICAgICAgIClcbiAgICAgICAgICBpZiAoIWNyZWF0ZWRTZXNzaW9uKSB7XG4gICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfcmVtb3RlX2NyZWF0ZV9zZXNzaW9uX2Vycm9yJywge1xuICAgICAgICAgICAgICBlcnJvcjpcbiAgICAgICAgICAgICAgICAndW5hYmxlX3RvX2NyZWF0ZV9zZXNzaW9uJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBleGl0V2l0aEVycm9yKFxuICAgICAgICAgICAgICByb290LFxuICAgICAgICAgICAgICAnRXJyb3I6IFVuYWJsZSB0byBjcmVhdGUgcmVtb3RlIHNlc3Npb24nLFxuICAgICAgICAgICAgICAoKSA9PiBncmFjZWZ1bFNodXRkb3duKDEpLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfcmVtb3RlX2NyZWF0ZV9zZXNzaW9uX3N1Y2Nlc3MnLCB7XG4gICAgICAgICAgICBzZXNzaW9uX2lkOlxuICAgICAgICAgICAgICBjcmVhdGVkU2Vzc2lvbi5pZCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICAvLyBDaGVjayBpZiBuZXcgcmVtb3RlIFRVSSBtb2RlIGlzIGVuYWJsZWQgdmlhIGZlYXR1cmUgZ2F0ZVxuICAgICAgICAgIGlmICghaXNSZW1vdGVUdWlFbmFibGVkKSB7XG4gICAgICAgICAgICAvLyBPcmlnaW5hbCBiZWhhdmlvcjogcHJpbnQgc2Vzc2lvbiBpbmZvIGFuZCBleGl0XG4gICAgICAgICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShcbiAgICAgICAgICAgICAgYENyZWF0ZWQgcmVtb3RlIHNlc3Npb246ICR7Y3JlYXRlZFNlc3Npb24udGl0bGV9XFxuYCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKFxuICAgICAgICAgICAgICBgVmlldzogJHtnZXRSZW1vdGVTZXNzaW9uVXJsKGNyZWF0ZWRTZXNzaW9uLmlkKX0/bT0wXFxuYCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKFxuICAgICAgICAgICAgICBgUmVzdW1lIHdpdGg6IGNsYXVkZSAtLXRlbGVwb3J0ICR7Y3JlYXRlZFNlc3Npb24uaWR9XFxuYCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIGF3YWl0IGdyYWNlZnVsU2h1dGRvd24oMClcbiAgICAgICAgICAgIHByb2Nlc3MuZXhpdCgwKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5ldyBiZWhhdmlvcjogc3RhcnQgbG9jYWwgVFVJIHdpdGggQ0NSIGVuZ2luZVxuICAgICAgICAgIC8vIE1hcmsgdGhhdCB3ZSdyZSBpbiByZW1vdGUgbW9kZSBmb3IgY29tbWFuZCB2aXNpYmlsaXR5XG4gICAgICAgICAgc2V0SXNSZW1vdGVNb2RlKHRydWUpXG4gICAgICAgICAgc3dpdGNoU2Vzc2lvbihhc1Nlc3Npb25JZChjcmVhdGVkU2Vzc2lvbi5pZCkpXG5cbiAgICAgICAgICAvLyBHZXQgT0F1dGggY3JlZGVudGlhbHMgZm9yIHJlbW90ZSBzZXNzaW9uXG4gICAgICAgICAgbGV0IGFwaUNyZWRzOiB7IGFjY2Vzc1Rva2VuOiBzdHJpbmc7IG9yZ1VVSUQ6IHN0cmluZyB9XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGFwaUNyZWRzID0gYXdhaXQgcHJlcGFyZUFwaVJlcXVlc3QoKVxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFcnJvcih0b0Vycm9yKGVycm9yKSlcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBleGl0V2l0aEVycm9yKFxuICAgICAgICAgICAgICByb290LFxuICAgICAgICAgICAgICBgRXJyb3I6ICR7ZXJyb3JNZXNzYWdlKGVycm9yKSB8fCAnRmFpbGVkIHRvIGF1dGhlbnRpY2F0ZSd9YCxcbiAgICAgICAgICAgICAgKCkgPT4gZ3JhY2VmdWxTaHV0ZG93bigxKSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDcmVhdGUgcmVtb3RlIHNlc3Npb24gY29uZmlnIGZvciB0aGUgUkVQTFxuICAgICAgICAgIGNvbnN0IHsgZ2V0Q2xhdWRlQUlPQXV0aFRva2VuczogZ2V0VG9rZW5zRm9yUmVtb3RlIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICAgICAnLi91dGlscy9hdXRoLmpzJ1xuICAgICAgICAgIClcbiAgICAgICAgICBjb25zdCBnZXRBY2Nlc3NUb2tlbkZvclJlbW90ZSA9ICgpOiBzdHJpbmcgPT5cbiAgICAgICAgICAgIGdldFRva2Vuc0ZvclJlbW90ZSgpPy5hY2Nlc3NUb2tlbiA/PyBhcGlDcmVkcy5hY2Nlc3NUb2tlblxuICAgICAgICAgIGNvbnN0IHJlbW90ZVNlc3Npb25Db25maWcgPSBjcmVhdGVSZW1vdGVTZXNzaW9uQ29uZmlnKFxuICAgICAgICAgICAgY3JlYXRlZFNlc3Npb24uaWQsXG4gICAgICAgICAgICBnZXRBY2Nlc3NUb2tlbkZvclJlbW90ZSxcbiAgICAgICAgICAgIGFwaUNyZWRzLm9yZ1VVSUQsXG4gICAgICAgICAgICBoYXNJbml0aWFsUHJvbXB0LFxuICAgICAgICAgIClcblxuICAgICAgICAgIC8vIEFkZCByZW1vdGUgc2Vzc2lvbiBpbmZvIGFzIGluaXRpYWwgc3lzdGVtIG1lc3NhZ2VcbiAgICAgICAgICBjb25zdCByZW1vdGVTZXNzaW9uVXJsID0gYCR7Z2V0UmVtb3RlU2Vzc2lvblVybChjcmVhdGVkU2Vzc2lvbi5pZCl9P209MGBcbiAgICAgICAgICBjb25zdCByZW1vdGVJbmZvTWVzc2FnZSA9IGNyZWF0ZVN5c3RlbU1lc3NhZ2UoXG4gICAgICAgICAgICBgL3JlbW90ZS1jb250cm9sIGlzIGFjdGl2ZS4gQ29kZSBpbiBDTEkgb3IgYXQgJHtyZW1vdGVTZXNzaW9uVXJsfWAsXG4gICAgICAgICAgICAnaW5mbycsXG4gICAgICAgICAgKVxuXG4gICAgICAgICAgLy8gQ3JlYXRlIGluaXRpYWwgdXNlciBtZXNzYWdlIGZyb20gdGhlIHByb21wdCBpZiBwcm92aWRlZCAoQ0NSIGVjaG9lcyBpdCBiYWNrIGJ1dCB3ZSBpZ25vcmUgdGhhdClcbiAgICAgICAgICBjb25zdCBpbml0aWFsVXNlck1lc3NhZ2UgPSBoYXNJbml0aWFsUHJvbXB0XG4gICAgICAgICAgICA/IGNyZWF0ZVVzZXJNZXNzYWdlKHsgY29udGVudDogcmVtb3RlIH0pXG4gICAgICAgICAgICA6IG51bGxcblxuICAgICAgICAgIC8vIFNldCByZW1vdGUgc2Vzc2lvbiBVUkwgaW4gYXBwIHN0YXRlIGZvciBmb290ZXIgaW5kaWNhdG9yXG4gICAgICAgICAgY29uc3QgcmVtb3RlSW5pdGlhbFN0YXRlID0ge1xuICAgICAgICAgICAgLi4uaW5pdGlhbFN0YXRlLFxuICAgICAgICAgICAgcmVtb3RlU2Vzc2lvblVybCxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBQcmUtZmlsdGVyIGNvbW1hbmRzIHRvIG9ubHkgaW5jbHVkZSByZW1vdGUtc2FmZSBvbmVzLlxuICAgICAgICAgIC8vIENDUidzIGluaXQgcmVzcG9uc2UgbWF5IGZ1cnRoZXIgcmVmaW5lIHRoZSBsaXN0ICh2aWEgaGFuZGxlUmVtb3RlSW5pdCBpbiBSRVBMKS5cbiAgICAgICAgICBjb25zdCByZW1vdGVDb21tYW5kcyA9IGZpbHRlckNvbW1hbmRzRm9yUmVtb3RlTW9kZShjb21tYW5kcylcbiAgICAgICAgICBhd2FpdCBsYXVuY2hSZXBsKFxuICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgIHsgZ2V0RnBzTWV0cmljcywgc3RhdHMsIGluaXRpYWxTdGF0ZTogcmVtb3RlSW5pdGlhbFN0YXRlIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGRlYnVnOiBkZWJ1ZyB8fCBkZWJ1Z1RvU3RkZXJyLFxuICAgICAgICAgICAgICBjb21tYW5kczogcmVtb3RlQ29tbWFuZHMsXG4gICAgICAgICAgICAgIGluaXRpYWxUb29sczogW10sXG4gICAgICAgICAgICAgIGluaXRpYWxNZXNzYWdlczogaW5pdGlhbFVzZXJNZXNzYWdlXG4gICAgICAgICAgICAgICAgPyBbcmVtb3RlSW5mb01lc3NhZ2UsIGluaXRpYWxVc2VyTWVzc2FnZV1cbiAgICAgICAgICAgICAgICA6IFtyZW1vdGVJbmZvTWVzc2FnZV0sXG4gICAgICAgICAgICAgIG1jcENsaWVudHM6IFtdLFxuICAgICAgICAgICAgICBhdXRvQ29ubmVjdElkZUZsYWc6IGlkZSxcbiAgICAgICAgICAgICAgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbixcbiAgICAgICAgICAgICAgZGlzYWJsZVNsYXNoQ29tbWFuZHMsXG4gICAgICAgICAgICAgIHJlbW90ZVNlc3Npb25Db25maWcsXG4gICAgICAgICAgICAgIHRoaW5raW5nQ29uZmlnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlbmRlckFuZFJ1bixcbiAgICAgICAgICApXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH0gZWxzZSBpZiAodGVsZXBvcnQpIHtcbiAgICAgICAgICBpZiAodGVsZXBvcnQgPT09IHRydWUgfHwgdGVsZXBvcnQgPT09ICcnKSB7XG4gICAgICAgICAgICAvLyBJbnRlcmFjdGl2ZSBtb2RlOiBzaG93IHRhc2sgc2VsZWN0b3IgYW5kIGhhbmRsZSByZXN1bWVcbiAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90ZWxlcG9ydF9pbnRlcmFjdGl2ZV9tb2RlJywge30pXG4gICAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICAgICAgICdzZWxlY3RBbmRSZXN1bWVUZWxlcG9ydFRhc2s6IFN0YXJ0aW5nIHRlbGVwb3J0IGZsb3cuLi4nLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgY29uc3QgdGVsZXBvcnRSZXN1bHQgPSBhd2FpdCBsYXVuY2hUZWxlcG9ydFJlc3VtZVdyYXBwZXIocm9vdClcbiAgICAgICAgICAgIGlmICghdGVsZXBvcnRSZXN1bHQpIHtcbiAgICAgICAgICAgICAgLy8gVXNlciBjYW5jZWxsZWQgb3IgZXJyb3Igb2NjdXJyZWRcbiAgICAgICAgICAgICAgYXdhaXQgZ3JhY2VmdWxTaHV0ZG93bigwKVxuICAgICAgICAgICAgICBwcm9jZXNzLmV4aXQoMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHsgYnJhbmNoRXJyb3IgfSA9IGF3YWl0IGNoZWNrT3V0VGVsZXBvcnRlZFNlc3Npb25CcmFuY2goXG4gICAgICAgICAgICAgIHRlbGVwb3J0UmVzdWx0LmJyYW5jaCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIG1lc3NhZ2VzID0gcHJvY2Vzc01lc3NhZ2VzRm9yVGVsZXBvcnRSZXN1bWUoXG4gICAgICAgICAgICAgIHRlbGVwb3J0UmVzdWx0LmxvZyxcbiAgICAgICAgICAgICAgYnJhbmNoRXJyb3IsXG4gICAgICAgICAgICApXG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGVsZXBvcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfdGVsZXBvcnRfcmVzdW1lX3Nlc3Npb24nLCB7XG4gICAgICAgICAgICAgIG1vZGU6ICdkaXJlY3QnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgLy8gRmlyc3QsIGZldGNoIHNlc3Npb24gYW5kIHZhbGlkYXRlIHJlcG9zaXRvcnkgYmVmb3JlIGNoZWNraW5nIGdpdCBzdGF0ZVxuICAgICAgICAgICAgICBjb25zdCBzZXNzaW9uRGF0YSA9IGF3YWl0IGZldGNoU2Vzc2lvbih0ZWxlcG9ydClcbiAgICAgICAgICAgICAgY29uc3QgcmVwb1ZhbGlkYXRpb24gPVxuICAgICAgICAgICAgICAgIGF3YWl0IHZhbGlkYXRlU2Vzc2lvblJlcG9zaXRvcnkoc2Vzc2lvbkRhdGEpXG5cbiAgICAgICAgICAgICAgLy8gSGFuZGxlIHJlcG8gbWlzbWF0Y2ggb3Igbm90IGluIHJlcG8gY2FzZXNcbiAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIHJlcG9WYWxpZGF0aW9uLnN0YXR1cyA9PT0gJ21pc21hdGNoJyB8fFxuICAgICAgICAgICAgICAgIHJlcG9WYWxpZGF0aW9uLnN0YXR1cyA9PT0gJ25vdF9pbl9yZXBvJ1xuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZXNzaW9uUmVwbyA9IHJlcG9WYWxpZGF0aW9uLnNlc3Npb25SZXBvXG4gICAgICAgICAgICAgICAgaWYgKHNlc3Npb25SZXBvKSB7XG4gICAgICAgICAgICAgICAgICAvLyBDaGVjayBmb3Iga25vd24gcGF0aHNcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGtub3duUGF0aHMgPSBnZXRLbm93blBhdGhzRm9yUmVwbyhzZXNzaW9uUmVwbylcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nUGF0aHMgPSBhd2FpdCBmaWx0ZXJFeGlzdGluZ1BhdGhzKGtub3duUGF0aHMpXG5cbiAgICAgICAgICAgICAgICAgIGlmIChleGlzdGluZ1BhdGhzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU2hvdyBkaXJlY3Rvcnkgc3dpdGNoIGRpYWxvZ1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZWxlY3RlZFBhdGggPSBhd2FpdCBsYXVuY2hUZWxlcG9ydFJlcG9NaXNtYXRjaERpYWxvZyhcbiAgICAgICAgICAgICAgICAgICAgICByb290LFxuICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFJlcG86IHNlc3Npb25SZXBvLFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5pdGlhbFBhdGhzOiBleGlzdGluZ1BhdGhzLFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIClcblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZWN0ZWRQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gQ2hhbmdlIHRvIHRoZSBzZWxlY3RlZCBkaXJlY3RvcnlcbiAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzLmNoZGlyKHNlbGVjdGVkUGF0aClcbiAgICAgICAgICAgICAgICAgICAgICBzZXRDd2Qoc2VsZWN0ZWRQYXRoKVxuICAgICAgICAgICAgICAgICAgICAgIHNldE9yaWdpbmFsQ3dkKHNlbGVjdGVkUGF0aClcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyBVc2VyIGNhbmNlbGxlZFxuICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGdyYWNlZnVsU2h1dGRvd24oMClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTm8ga25vd24gcGF0aHMgLSBzaG93IG9yaWdpbmFsIGVycm9yXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBUZWxlcG9ydE9wZXJhdGlvbkVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgIGBZb3UgbXVzdCBydW4gY2xhdWRlIC0tdGVsZXBvcnQgJHt0ZWxlcG9ydH0gZnJvbSBhIGNoZWNrb3V0IG9mICR7c2Vzc2lvblJlcG99LmAsXG4gICAgICAgICAgICAgICAgICAgICAgY2hhbGsucmVkKFxuICAgICAgICAgICAgICAgICAgICAgICAgYFlvdSBtdXN0IHJ1biBjbGF1ZGUgLS10ZWxlcG9ydCAke3RlbGVwb3J0fSBmcm9tIGEgY2hlY2tvdXQgb2YgJHtjaGFsay5ib2xkKHNlc3Npb25SZXBvKX0uXFxuYCxcbiAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlcG9WYWxpZGF0aW9uLnN0YXR1cyA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBUZWxlcG9ydE9wZXJhdGlvbkVycm9yKFxuICAgICAgICAgICAgICAgICAgcmVwb1ZhbGlkYXRpb24uZXJyb3JNZXNzYWdlIHx8ICdGYWlsZWQgdG8gdmFsaWRhdGUgc2Vzc2lvbicsXG4gICAgICAgICAgICAgICAgICBjaGFsay5yZWQoXG4gICAgICAgICAgICAgICAgICAgIGBFcnJvcjogJHtyZXBvVmFsaWRhdGlvbi5lcnJvck1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byB2YWxpZGF0ZSBzZXNzaW9uJ31cXG5gLFxuICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBhd2FpdCB2YWxpZGF0ZUdpdFN0YXRlKClcblxuICAgICAgICAgICAgICAvLyBVc2UgcHJvZ3Jlc3MgVUkgZm9yIHRlbGVwb3J0XG4gICAgICAgICAgICAgIGNvbnN0IHsgdGVsZXBvcnRXaXRoUHJvZ3Jlc3MgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICAgICAgICAgICAnLi9jb21wb25lbnRzL1RlbGVwb3J0UHJvZ3Jlc3MuanMnXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGVsZXBvcnRXaXRoUHJvZ3Jlc3Mocm9vdCwgdGVsZXBvcnQpXG4gICAgICAgICAgICAgIC8vIFRyYWNrIHRlbGVwb3J0ZWQgc2Vzc2lvbiBmb3IgcmVsaWFiaWxpdHkgbG9nZ2luZ1xuICAgICAgICAgICAgICBzZXRUZWxlcG9ydGVkU2Vzc2lvbkluZm8oeyBzZXNzaW9uSWQ6IHRlbGVwb3J0IH0pXG4gICAgICAgICAgICAgIG1lc3NhZ2VzID0gcmVzdWx0Lm1lc3NhZ2VzXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBUZWxlcG9ydE9wZXJhdGlvbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoZXJyb3IuZm9ybWF0dGVkTWVzc2FnZSArICdcXG4nKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGVycm9yKVxuICAgICAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgICAgICAgY2hhbGsucmVkKGBFcnJvcjogJHtlcnJvck1lc3NhZ2UoZXJyb3IpfVxcbmApLFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBhd2FpdCBncmFjZWZ1bFNodXRkb3duKDEpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnKSB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgb3B0aW9ucy5yZXN1bWUgJiZcbiAgICAgICAgICAgIHR5cGVvZiBvcHRpb25zLnJlc3VtZSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICAgICFtYXliZVNlc3Npb25JZFxuICAgICAgICAgICkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGNjc2hhcmUgVVJMIChlLmcuIGh0dHBzOi8vZ28vY2NzaGFyZS9ib3Jpcy0yMDI2MDMxMS0yMTEwMzYpXG4gICAgICAgICAgICBjb25zdCB7IHBhcnNlQ2NzaGFyZUlkLCBsb2FkQ2NzaGFyZSB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgICAnLi91dGlscy9jY3NoYXJlUmVzdW1lLmpzJ1xuICAgICAgICAgICAgKVxuICAgICAgICAgICAgY29uc3QgY2NzaGFyZUlkID0gcGFyc2VDY3NoYXJlSWQob3B0aW9ucy5yZXN1bWUpXG4gICAgICAgICAgICBpZiAoY2NzaGFyZUlkKSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdW1lU3RhcnQgPSBwZXJmb3JtYW5jZS5ub3coKVxuICAgICAgICAgICAgICAgIGNvbnN0IGxvZ09wdGlvbiA9IGF3YWl0IGxvYWRDY3NoYXJlKGNjc2hhcmVJZClcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBsb2FkQ29udmVyc2F0aW9uRm9yUmVzdW1lKFxuICAgICAgICAgICAgICAgICAgbG9nT3B0aW9uLFxuICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICBwcm9jZXNzZWRSZXN1bWUgPSBhd2FpdCBwcm9jZXNzUmVzdW1lZENvbnZlcnNhdGlvbihcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgZm9ya1Nlc3Npb246IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgdHJhbnNjcmlwdFBhdGg6IHJlc3VsdC5mdWxsUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVzdW1lQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzZWRSZXN1bWUucmVzdG9yZWRBZ2VudERlZikge1xuICAgICAgICAgICAgICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uID0gcHJvY2Vzc2VkUmVzdW1lLnJlc3RvcmVkQWdlbnREZWZcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX3Jlc3VtZWQnLCB7XG4gICAgICAgICAgICAgICAgICAgIGVudHJ5cG9pbnQ6XG4gICAgICAgICAgICAgICAgICAgICAgJ2Njc2hhcmUnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHJlc3VtZV9kdXJhdGlvbl9tczogTWF0aC5yb3VuZChcbiAgICAgICAgICAgICAgICAgICAgICBwZXJmb3JtYW5jZS5ub3coKSAtIHJlc3VtZVN0YXJ0LFxuICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3Nlc3Npb25fcmVzdW1lZCcsIHtcbiAgICAgICAgICAgICAgICAgICAgZW50cnlwb2ludDpcbiAgICAgICAgICAgICAgICAgICAgICAnY2NzaGFyZScgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl9yZXN1bWVkJywge1xuICAgICAgICAgICAgICAgICAgZW50cnlwb2ludDpcbiAgICAgICAgICAgICAgICAgICAgJ2Njc2hhcmUnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIGxvZ0Vycm9yKGVycm9yKVxuICAgICAgICAgICAgICAgIGF3YWl0IGV4aXRXaXRoRXJyb3IoXG4gICAgICAgICAgICAgICAgICByb290LFxuICAgICAgICAgICAgICAgICAgYFVuYWJsZSB0byByZXN1bWUgZnJvbSBjY3NoYXJlOiAke2Vycm9yTWVzc2FnZShlcnJvcil9YCxcbiAgICAgICAgICAgICAgICAgICgpID0+IGdyYWNlZnVsU2h1dGRvd24oMSksXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSByZXNvbHZlKG9wdGlvbnMucmVzdW1lKVxuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VtZVN0YXJ0ID0gcGVyZm9ybWFuY2Uubm93KClcbiAgICAgICAgICAgICAgICBsZXQgbG9nT3B0aW9uXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gbG9hZCBhcyBhIHRyYW5zY3JpcHQgZmlsZTsgRU5PRU5UIGZhbGxzIHRocm91Z2ggdG8gc2Vzc2lvbi1JRCBoYW5kbGluZ1xuICAgICAgICAgICAgICAgICAgbG9nT3B0aW9uID0gYXdhaXQgbG9hZFRyYW5zY3JpcHRGcm9tRmlsZShyZXNvbHZlZFBhdGgpXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgIGlmICghaXNFTk9FTlQoZXJyb3IpKSB0aHJvdyBlcnJvclxuICAgICAgICAgICAgICAgICAgLy8gRU5PRU5UOiBub3QgYSBmaWxlIHBhdGgg4oCUIGZhbGwgdGhyb3VnaCB0byBzZXNzaW9uLUlEIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsb2dPcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxvYWRDb252ZXJzYXRpb25Gb3JSZXN1bWUoXG4gICAgICAgICAgICAgICAgICAgIGxvZ09wdGlvbixcbiAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkIC8qIHNvdXJjZUZpbGUgKi8sXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2Nlc3NlZFJlc3VtZSA9IGF3YWl0IHByb2Nlc3NSZXN1bWVkQ29udmVyc2F0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JrU2Vzc2lvbjogISFvcHRpb25zLmZvcmtTZXNzaW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNjcmlwdFBhdGg6IHJlc3VsdC5mdWxsUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgIHJlc3VtZUNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb2Nlc3NlZFJlc3VtZS5yZXN0b3JlZEFnZW50RGVmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbiA9XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzZWRSZXN1bWUucmVzdG9yZWRBZ2VudERlZlxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX3Jlc3VtZWQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgZW50cnlwb2ludDpcbiAgICAgICAgICAgICAgICAgICAgICAgICdmaWxlJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgcmVzdW1lX2R1cmF0aW9uX21zOiBNYXRoLnJvdW5kKFxuICAgICAgICAgICAgICAgICAgICAgICAgcGVyZm9ybWFuY2Uubm93KCkgLSByZXN1bWVTdGFydCxcbiAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3Nlc3Npb25fcmVzdW1lZCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICBlbnRyeXBvaW50OlxuICAgICAgICAgICAgICAgICAgICAgICAgJ2ZpbGUnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX3Jlc3VtZWQnLCB7XG4gICAgICAgICAgICAgICAgICBlbnRyeXBvaW50OlxuICAgICAgICAgICAgICAgICAgICAnZmlsZScgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgbG9nRXJyb3IoZXJyb3IpXG4gICAgICAgICAgICAgICAgYXdhaXQgZXhpdFdpdGhFcnJvcihcbiAgICAgICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgICAgICBgVW5hYmxlIHRvIGxvYWQgdHJhbnNjcmlwdCBmcm9tIGZpbGU6ICR7b3B0aW9ucy5yZXN1bWV9YCxcbiAgICAgICAgICAgICAgICAgICgpID0+IGdyYWNlZnVsU2h1dGRvd24oMSksXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbm90IGxvYWRlZCBhcyBhIGZpbGUsIHRyeSBhcyBzZXNzaW9uIElEXG4gICAgICAgIGlmIChtYXliZVNlc3Npb25JZCkge1xuICAgICAgICAgIC8vIFJlc3VtZSBzcGVjaWZpYyBzZXNzaW9uIGJ5IElEXG4gICAgICAgICAgY29uc3Qgc2Vzc2lvbklkID0gbWF5YmVTZXNzaW9uSWRcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdW1lU3RhcnQgPSBwZXJmb3JtYW5jZS5ub3coKVxuICAgICAgICAgICAgLy8gVXNlIG1hdGNoZWRMb2cgaWYgYXZhaWxhYmxlIChmb3IgY3Jvc3Mtd29ya3RyZWUgcmVzdW1lIGJ5IGN1c3RvbSB0aXRsZSlcbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSBmYWxsIGJhY2sgdG8gc2Vzc2lvbklkIHN0cmluZyAoZm9yIGRpcmVjdCBVVUlEIHJlc3VtZSlcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGxvYWRDb252ZXJzYXRpb25Gb3JSZXN1bWUoXG4gICAgICAgICAgICAgIG1hdGNoZWRMb2cgPz8gc2Vzc2lvbklkLFxuICAgICAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICApXG5cbiAgICAgICAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX3Jlc3VtZWQnLCB7XG4gICAgICAgICAgICAgICAgZW50cnlwb2ludDpcbiAgICAgICAgICAgICAgICAgICdjbGlfZmxhZycgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGV4aXRXaXRoRXJyb3IoXG4gICAgICAgICAgICAgICAgcm9vdCxcbiAgICAgICAgICAgICAgICBgTm8gY29udmVyc2F0aW9uIGZvdW5kIHdpdGggc2Vzc2lvbiBJRDogJHtzZXNzaW9uSWR9YCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IG1hdGNoZWRMb2c/LmZ1bGxQYXRoID8/IHJlc3VsdC5mdWxsUGF0aFxuICAgICAgICAgICAgcHJvY2Vzc2VkUmVzdW1lID0gYXdhaXQgcHJvY2Vzc1Jlc3VtZWRDb252ZXJzYXRpb24oXG4gICAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGZvcmtTZXNzaW9uOiAhIW9wdGlvbnMuZm9ya1Nlc3Npb24sXG4gICAgICAgICAgICAgICAgc2Vzc2lvbklkT3ZlcnJpZGU6IHNlc3Npb25JZCxcbiAgICAgICAgICAgICAgICB0cmFuc2NyaXB0UGF0aDogZnVsbFBhdGgsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHJlc3VtZUNvbnRleHQsXG4gICAgICAgICAgICApXG5cbiAgICAgICAgICAgIGlmIChwcm9jZXNzZWRSZXN1bWUucmVzdG9yZWRBZ2VudERlZikge1xuICAgICAgICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uID0gcHJvY2Vzc2VkUmVzdW1lLnJlc3RvcmVkQWdlbnREZWZcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX3Jlc3VtZWQnLCB7XG4gICAgICAgICAgICAgIGVudHJ5cG9pbnQ6XG4gICAgICAgICAgICAgICAgJ2NsaV9mbGFnJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICByZXN1bWVfZHVyYXRpb25fbXM6IE1hdGgucm91bmQocGVyZm9ybWFuY2Uubm93KCkgLSByZXN1bWVTdGFydCksXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl9yZXN1bWVkJywge1xuICAgICAgICAgICAgICBlbnRyeXBvaW50OlxuICAgICAgICAgICAgICAgICdjbGlfZmxhZycgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgbG9nRXJyb3IoZXJyb3IpXG4gICAgICAgICAgICBhd2FpdCBleGl0V2l0aEVycm9yKHJvb3QsIGBGYWlsZWQgdG8gcmVzdW1lIHNlc3Npb24gJHtzZXNzaW9uSWR9YClcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBd2FpdCBmaWxlIGRvd25sb2FkcyBiZWZvcmUgcmVuZGVyaW5nIFJFUEwgKGZpbGVzIG11c3QgYmUgYXZhaWxhYmxlKVxuICAgICAgICBpZiAoZmlsZURvd25sb2FkUHJvbWlzZSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgZmlsZURvd25sb2FkUHJvbWlzZVxuICAgICAgICAgICAgY29uc3QgZmFpbGVkQ291bnQgPSBjb3VudChyZXN1bHRzLCByID0+ICFyLnN1Y2Nlc3MpXG4gICAgICAgICAgICBpZiAoZmFpbGVkQ291bnQgPiAwKSB7XG4gICAgICAgICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICAgICAgIGNoYWxrLnllbGxvdyhcbiAgICAgICAgICAgICAgICAgIGBXYXJuaW5nOiAke2ZhaWxlZENvdW50fS8ke3Jlc3VsdHMubGVuZ3RofSBmaWxlKHMpIGZhaWxlZCB0byBkb3dubG9hZC5cXG5gLFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IGV4aXRXaXRoRXJyb3IoXG4gICAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICAgIGBFcnJvciBkb3dubG9hZGluZyBmaWxlczogJHtlcnJvck1lc3NhZ2UoZXJyb3IpfWAsXG4gICAgICAgICAgICApXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgd2UgaGF2ZSBhIHByb2Nlc3NlZCByZXN1bWUgb3IgdGVsZXBvcnQgbWVzc2FnZXMsIHJlbmRlciB0aGUgUkVQTFxuICAgICAgICBjb25zdCByZXN1bWVEYXRhID1cbiAgICAgICAgICBwcm9jZXNzZWRSZXN1bWUgPz9cbiAgICAgICAgICAoQXJyYXkuaXNBcnJheShtZXNzYWdlcylcbiAgICAgICAgICAgID8ge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2VzLFxuICAgICAgICAgICAgICAgIGZpbGVIaXN0b3J5U25hcHNob3RzOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgYWdlbnROYW1lOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgYWdlbnRDb2xvcjogdW5kZWZpbmVkIGFzIEFnZW50Q29sb3JOYW1lIHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIHJlc3RvcmVkQWdlbnREZWY6IG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gICAgICAgICAgICAgICAgaW5pdGlhbFN0YXRlLFxuICAgICAgICAgICAgICAgIGNvbnRlbnRSZXBsYWNlbWVudHM6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgOiB1bmRlZmluZWQpXG4gICAgICAgIGlmIChyZXN1bWVEYXRhKSB7XG4gICAgICAgICAgbWF5YmVBY3RpdmF0ZVByb2FjdGl2ZShvcHRpb25zKVxuICAgICAgICAgIG1heWJlQWN0aXZhdGVCcmllZihvcHRpb25zKVxuXG4gICAgICAgICAgYXdhaXQgbGF1bmNoUmVwbChcbiAgICAgICAgICAgIHJvb3QsXG4gICAgICAgICAgICB7IGdldEZwc01ldHJpY3MsIHN0YXRzLCBpbml0aWFsU3RhdGU6IHJlc3VtZURhdGEuaW5pdGlhbFN0YXRlIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIC4uLnNlc3Npb25Db25maWcsXG4gICAgICAgICAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb246XG4gICAgICAgICAgICAgICAgcmVzdW1lRGF0YS5yZXN0b3JlZEFnZW50RGVmID8/IG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gICAgICAgICAgICAgIGluaXRpYWxNZXNzYWdlczogcmVzdW1lRGF0YS5tZXNzYWdlcyxcbiAgICAgICAgICAgICAgaW5pdGlhbEZpbGVIaXN0b3J5U25hcHNob3RzOiByZXN1bWVEYXRhLmZpbGVIaXN0b3J5U25hcHNob3RzLFxuICAgICAgICAgICAgICBpbml0aWFsQ29udGVudFJlcGxhY2VtZW50czogcmVzdW1lRGF0YS5jb250ZW50UmVwbGFjZW1lbnRzLFxuICAgICAgICAgICAgICBpbml0aWFsQWdlbnROYW1lOiByZXN1bWVEYXRhLmFnZW50TmFtZSxcbiAgICAgICAgICAgICAgaW5pdGlhbEFnZW50Q29sb3I6IHJlc3VtZURhdGEuYWdlbnRDb2xvcixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZW5kZXJBbmRSdW4sXG4gICAgICAgICAgKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFNob3cgaW50ZXJhY3RpdmUgc2VsZWN0b3IgKGluY2x1ZGVzIHNhbWUtcmVwbyB3b3JrdHJlZXMpXG4gICAgICAgICAgLy8gTm90ZTogUmVzdW1lQ29udmVyc2F0aW9uIGxvYWRzIGxvZ3MgaW50ZXJuYWxseSB0byBlbnN1cmUgcHJvcGVyIEdDIGFmdGVyIHNlbGVjdGlvblxuICAgICAgICAgIGF3YWl0IGxhdW5jaFJlc3VtZUNob29zZXIoXG4gICAgICAgICAgICByb290LFxuICAgICAgICAgICAgeyBnZXRGcHNNZXRyaWNzLCBzdGF0cywgaW5pdGlhbFN0YXRlIH0sXG4gICAgICAgICAgICBnZXRXb3JrdHJlZVBhdGhzKGdldE9yaWdpbmFsQ3dkKCkpLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAuLi5zZXNzaW9uQ29uZmlnLFxuICAgICAgICAgICAgICBpbml0aWFsU2VhcmNoUXVlcnk6IHNlYXJjaFRlcm0sXG4gICAgICAgICAgICAgIGZvcmtTZXNzaW9uOiBvcHRpb25zLmZvcmtTZXNzaW9uLFxuICAgICAgICAgICAgICBmaWx0ZXJCeVByLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFBhc3MgdW5yZXNvbHZlZCBob29rcyBwcm9taXNlIHRvIFJFUEwgc28gaXQgY2FuIHJlbmRlciBpbW1lZGlhdGVseVxuICAgICAgICAvLyBpbnN0ZWFkIG9mIGJsb2NraW5nIH41MDBtcyB3YWl0aW5nIGZvciBTZXNzaW9uU3RhcnQgaG9va3MgdG8gZmluaXNoLlxuICAgICAgICAvLyBSRVBMIHdpbGwgaW5qZWN0IGhvb2sgbWVzc2FnZXMgd2hlbiB0aGV5IHJlc29sdmUgYW5kIGF3YWl0IHRoZW0gYmVmb3JlXG4gICAgICAgIC8vIHRoZSBmaXJzdCBBUEkgY2FsbCBzbyB0aGUgbW9kZWwgYWx3YXlzIHNlZXMgaG9vayBjb250ZXh0LlxuICAgICAgICBjb25zdCBwZW5kaW5nSG9va01lc3NhZ2VzID1cbiAgICAgICAgICBob29rc1Byb21pc2UgJiYgaG9va01lc3NhZ2VzLmxlbmd0aCA9PT0gMCA/IGhvb2tzUHJvbWlzZSA6IHVuZGVmaW5lZFxuXG4gICAgICAgIHByb2ZpbGVDaGVja3BvaW50KCdhY3Rpb25fYWZ0ZXJfaG9va3MnKVxuICAgICAgICBtYXliZUFjdGl2YXRlUHJvYWN0aXZlKG9wdGlvbnMpXG4gICAgICAgIG1heWJlQWN0aXZhdGVCcmllZihvcHRpb25zKVxuICAgICAgICAvLyBQZXJzaXN0IHRoZSBjdXJyZW50IG1vZGUgZm9yIGZyZXNoIHNlc3Npb25zIHNvIGZ1dHVyZSByZXN1bWVzIGtub3cgd2hhdCBtb2RlIHdhcyB1c2VkXG4gICAgICAgIGlmIChmZWF0dXJlKCdDT09SRElOQVRPUl9NT0RFJykpIHtcbiAgICAgICAgICBzYXZlTW9kZShcbiAgICAgICAgICAgIGNvb3JkaW5hdG9yTW9kZU1vZHVsZT8uaXNDb29yZGluYXRvck1vZGUoKVxuICAgICAgICAgICAgICA/ICdjb29yZGluYXRvcidcbiAgICAgICAgICAgICAgOiAnbm9ybWFsJyxcbiAgICAgICAgICApXG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBsYXVuY2hlZCB2aWEgYSBkZWVwIGxpbmssIHNob3cgYSBwcm92ZW5hbmNlIGJhbm5lciBzbyB0aGUgdXNlclxuICAgICAgICAvLyBrbm93cyB0aGUgc2Vzc2lvbiBvcmlnaW5hdGVkIGV4dGVybmFsbHkuIExpbnV4IHhkZy1vcGVuIGFuZFxuICAgICAgICAvLyBicm93c2VycyB3aXRoIFwiYWx3YXlzIGFsbG93XCIgc2V0IGRpc3BhdGNoIHRoZSBsaW5rIHdpdGggbm8gT1MtbGV2ZWxcbiAgICAgICAgLy8gY29uZmlybWF0aW9uLCBzbyB0aGlzIGlzIHRoZSBvbmx5IHNpZ25hbCB0aGUgdXNlciBnZXRzIHRoYXQgdGhlXG4gICAgICAgIC8vIHByb21wdCDigJQgYW5kIHRoZSB3b3JraW5nIGRpcmVjdG9yeSAvIENMQVVERS5tZCBpdCBpbXBsaWVzIOKAlCBjYW1lXG4gICAgICAgIC8vIGZyb20gYW4gZXh0ZXJuYWwgc291cmNlIHJhdGhlciB0aGFuIHNvbWV0aGluZyB0aGV5IHR5cGVkLlxuICAgICAgICBsZXQgZGVlcExpbmtCYW5uZXI6IFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZVN5c3RlbU1lc3NhZ2U+IHwgbnVsbCA9IG51bGxcbiAgICAgICAgaWYgKGZlYXR1cmUoJ0xPREVTVE9ORScpKSB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMuZGVlcExpbmtPcmlnaW4pIHtcbiAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9kZWVwX2xpbmtfb3BlbmVkJywge1xuICAgICAgICAgICAgICBoYXNfcHJlZmlsbDogQm9vbGVhbihvcHRpb25zLnByZWZpbGwpLFxuICAgICAgICAgICAgICBoYXNfcmVwbzogQm9vbGVhbihvcHRpb25zLmRlZXBMaW5rUmVwbyksXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgZGVlcExpbmtCYW5uZXIgPSBjcmVhdGVTeXN0ZW1NZXNzYWdlKFxuICAgICAgICAgICAgICBidWlsZERlZXBMaW5rQmFubmVyKHtcbiAgICAgICAgICAgICAgICBjd2Q6IGdldEN3ZCgpLFxuICAgICAgICAgICAgICAgIHByZWZpbGxMZW5ndGg6IG9wdGlvbnMucHJlZmlsbD8ubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHJlcG86IG9wdGlvbnMuZGVlcExpbmtSZXBvLFxuICAgICAgICAgICAgICAgIGxhc3RGZXRjaDpcbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVlcExpbmtMYXN0RmV0Y2ggIT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICA/IG5ldyBEYXRlKG9wdGlvbnMuZGVlcExpbmtMYXN0RmV0Y2gpXG4gICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgJ3dhcm5pbmcnLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5wcmVmaWxsKSB7XG4gICAgICAgICAgICBkZWVwTGlua0Jhbm5lciA9IGNyZWF0ZVN5c3RlbU1lc3NhZ2UoXG4gICAgICAgICAgICAgICdMYXVuY2hlZCB3aXRoIGEgcHJlLWZpbGxlZCBwcm9tcHQg4oCUIHJldmlldyBpdCBiZWZvcmUgcHJlc3NpbmcgRW50ZXIuJyxcbiAgICAgICAgICAgICAgJ3dhcm5pbmcnLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBpbml0aWFsTWVzc2FnZXMgPSBkZWVwTGlua0Jhbm5lclxuICAgICAgICAgID8gW2RlZXBMaW5rQmFubmVyLCAuLi5ob29rTWVzc2FnZXNdXG4gICAgICAgICAgOiBob29rTWVzc2FnZXMubGVuZ3RoID4gMFxuICAgICAgICAgICAgPyBob29rTWVzc2FnZXNcbiAgICAgICAgICAgIDogdW5kZWZpbmVkXG5cbiAgICAgICAgYXdhaXQgbGF1bmNoUmVwbChcbiAgICAgICAgICByb290LFxuICAgICAgICAgIHsgZ2V0RnBzTWV0cmljcywgc3RhdHMsIGluaXRpYWxTdGF0ZSB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC4uLnNlc3Npb25Db25maWcsXG4gICAgICAgICAgICBpbml0aWFsTWVzc2FnZXMsXG4gICAgICAgICAgICBwZW5kaW5nSG9va01lc3NhZ2VzLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcmVuZGVyQW5kUnVuLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfSlcbiAgICAudmVyc2lvbihcbiAgICAgIGAke01BQ1JPLlZFUlNJT059IChDbGF1ZGUgQ29kZSlgLFxuICAgICAgJy12LCAtLXZlcnNpb24nLFxuICAgICAgJ091dHB1dCB0aGUgdmVyc2lvbiBudW1iZXInLFxuICAgIClcblxuICAvLyBXb3JrdHJlZSBmbGFnc1xuICBwcm9ncmFtLm9wdGlvbihcbiAgICAnLXcsIC0td29ya3RyZWUgW25hbWVdJyxcbiAgICAnQ3JlYXRlIGEgbmV3IGdpdCB3b3JrdHJlZSBmb3IgdGhpcyBzZXNzaW9uIChvcHRpb25hbGx5IHNwZWNpZnkgYSBuYW1lKScsXG4gIClcbiAgcHJvZ3JhbS5vcHRpb24oXG4gICAgJy0tdG11eCcsXG4gICAgJ0NyZWF0ZSBhIHRtdXggc2Vzc2lvbiBmb3IgdGhlIHdvcmt0cmVlIChyZXF1aXJlcyAtLXdvcmt0cmVlKS4gVXNlcyBpVGVybTIgbmF0aXZlIHBhbmVzIHdoZW4gYXZhaWxhYmxlOyB1c2UgLS10bXV4PWNsYXNzaWMgZm9yIHRyYWRpdGlvbmFsIHRtdXguJyxcbiAgKVxuXG4gIGlmIChjYW5Vc2VyQ29uZmlndXJlQWR2aXNvcigpKSB7XG4gICAgcHJvZ3JhbS5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1hZHZpc29yIDxtb2RlbD4nLFxuICAgICAgICAnRW5hYmxlIHRoZSBzZXJ2ZXItc2lkZSBhZHZpc29yIHRvb2wgd2l0aCB0aGUgc3BlY2lmaWVkIG1vZGVsIChhbGlhcyBvciBmdWxsIElEKS4nLFxuICAgICAgKS5oaWRlSGVscCgpLFxuICAgIClcbiAgfVxuXG4gIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnKSB7XG4gICAgcHJvZ3JhbS5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1kZWxlZ2F0ZS1wZXJtaXNzaW9ucycsXG4gICAgICAgICdbQU5ULU9OTFldIEFsaWFzIGZvciAtLXBlcm1pc3Npb24tbW9kZSBhdXRvLicsXG4gICAgICApLmltcGxpZXMoeyBwZXJtaXNzaW9uTW9kZTogJ2F1dG8nIH0pLFxuICAgIClcbiAgICBwcm9ncmFtLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLWRhbmdlcm91c2x5LXNraXAtcGVybWlzc2lvbnMtd2l0aC1jbGFzc2lmaWVycycsXG4gICAgICAgICdbQU5ULU9OTFldIERlcHJlY2F0ZWQgYWxpYXMgZm9yIC0tcGVybWlzc2lvbi1tb2RlIGF1dG8uJyxcbiAgICAgIClcbiAgICAgICAgLmhpZGVIZWxwKClcbiAgICAgICAgLmltcGxpZXMoeyBwZXJtaXNzaW9uTW9kZTogJ2F1dG8nIH0pLFxuICAgIClcbiAgICBwcm9ncmFtLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLWFmaycsXG4gICAgICAgICdbQU5ULU9OTFldIERlcHJlY2F0ZWQgYWxpYXMgZm9yIC0tcGVybWlzc2lvbi1tb2RlIGF1dG8uJyxcbiAgICAgIClcbiAgICAgICAgLmhpZGVIZWxwKClcbiAgICAgICAgLmltcGxpZXMoeyBwZXJtaXNzaW9uTW9kZTogJ2F1dG8nIH0pLFxuICAgIClcbiAgICBwcm9ncmFtLmFkZE9wdGlvbihcbiAgICAgIG5ldyBPcHRpb24oXG4gICAgICAgICctLXRhc2tzIFtpZF0nLFxuICAgICAgICAnW0FOVC1PTkxZXSBUYXNrcyBtb2RlOiB3YXRjaCBmb3IgdGFza3MgYW5kIGF1dG8tcHJvY2VzcyB0aGVtLiBPcHRpb25hbCBpZCBpcyB1c2VkIGFzIGJvdGggdGhlIHRhc2sgbGlzdCBJRCBhbmQgYWdlbnQgSUQgKGRlZmF1bHRzIHRvIFwidGFza2xpc3RcIikuJyxcbiAgICAgIClcbiAgICAgICAgLmFyZ1BhcnNlcihTdHJpbmcpXG4gICAgICAgIC5oaWRlSGVscCgpLFxuICAgIClcbiAgICBwcm9ncmFtLm9wdGlvbihcbiAgICAgICctLWFnZW50LXRlYW1zJyxcbiAgICAgICdbQU5ULU9OTFldIEZvcmNlIENsYXVkZSB0byB1c2UgbXVsdGktYWdlbnQgbW9kZSBmb3Igc29sdmluZyBwcm9ibGVtcycsXG4gICAgICAoKSA9PiB0cnVlLFxuICAgIClcbiAgfVxuXG4gIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSkge1xuICAgIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbignLS1lbmFibGUtYXV0by1tb2RlJywgJ09wdCBpbiB0byBhdXRvIG1vZGUnKS5oaWRlSGVscCgpLFxuICAgIClcbiAgfVxuXG4gIGlmIChmZWF0dXJlKCdQUk9BQ1RJVkUnKSB8fCBmZWF0dXJlKCdLQUlST1MnKSkge1xuICAgIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbignLS1wcm9hY3RpdmUnLCAnU3RhcnQgaW4gcHJvYWN0aXZlIGF1dG9ub21vdXMgbW9kZScpLFxuICAgIClcbiAgfVxuXG4gIGlmIChmZWF0dXJlKCdVRFNfSU5CT1gnKSkge1xuICAgIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tbWVzc2FnaW5nLXNvY2tldC1wYXRoIDxwYXRoPicsXG4gICAgICAgICdVbml4IGRvbWFpbiBzb2NrZXQgcGF0aCBmb3IgdGhlIFVEUyBtZXNzYWdpbmcgc2VydmVyIChkZWZhdWx0cyB0byBhIHRtcCBwYXRoKScsXG4gICAgICApLFxuICAgIClcbiAgfVxuXG4gIGlmIChmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQlJJRUYnKSkge1xuICAgIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tYnJpZWYnLFxuICAgICAgICAnRW5hYmxlIFNlbmRVc2VyTWVzc2FnZSB0b29sIGZvciBhZ2VudC10by11c2VyIGNvbW11bmljYXRpb24nLFxuICAgICAgKSxcbiAgICApXG4gIH1cbiAgaWYgKGZlYXR1cmUoJ0tBSVJPUycpKSB7XG4gICAgcHJvZ3JhbS5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1hc3Npc3RhbnQnLFxuICAgICAgICAnRm9yY2UgYXNzaXN0YW50IG1vZGUgKEFnZW50IFNESyBkYWVtb24gdXNlKScsXG4gICAgICApLmhpZGVIZWxwKCksXG4gICAgKVxuICB9XG4gIGlmIChmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQ0hBTk5FTFMnKSkge1xuICAgIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tY2hhbm5lbHMgPHNlcnZlcnMuLi4+JyxcbiAgICAgICAgJ01DUCBzZXJ2ZXJzIHdob3NlIGNoYW5uZWwgbm90aWZpY2F0aW9ucyAoaW5ib3VuZCBwdXNoKSBzaG91bGQgcmVnaXN0ZXIgdGhpcyBzZXNzaW9uLiBTcGFjZS1zZXBhcmF0ZWQgc2VydmVyIG5hbWVzLicsXG4gICAgICApLmhpZGVIZWxwKCksXG4gICAgKVxuICAgIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgICAgbmV3IE9wdGlvbihcbiAgICAgICAgJy0tZGFuZ2Vyb3VzbHktbG9hZC1kZXZlbG9wbWVudC1jaGFubmVscyA8c2VydmVycy4uLj4nLFxuICAgICAgICAnTG9hZCBjaGFubmVsIHNlcnZlcnMgbm90IG9uIHRoZSBhcHByb3ZlZCBhbGxvd2xpc3QuIEZvciBsb2NhbCBjaGFubmVsIGRldmVsb3BtZW50IG9ubHkuIFNob3dzIGEgY29uZmlybWF0aW9uIGRpYWxvZyBhdCBzdGFydHVwLicsXG4gICAgICApLmhpZGVIZWxwKCksXG4gICAgKVxuICB9XG5cbiAgLy8gVGVhbW1hdGUgaWRlbnRpdHkgb3B0aW9ucyAoc2V0IGJ5IGxlYWRlciB3aGVuIHNwYXduaW5nIHRtdXggdGVhbW1hdGVzKVxuICAvLyBUaGVzZSByZXBsYWNlIHRoZSBDTEFVREVfQ09ERV8qIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICBwcm9ncmFtLmFkZE9wdGlvbihcbiAgICBuZXcgT3B0aW9uKCctLWFnZW50LWlkIDxpZD4nLCAnVGVhbW1hdGUgYWdlbnQgSUQnKS5oaWRlSGVscCgpLFxuICApXG4gIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgIG5ldyBPcHRpb24oJy0tYWdlbnQtbmFtZSA8bmFtZT4nLCAnVGVhbW1hdGUgZGlzcGxheSBuYW1lJykuaGlkZUhlbHAoKSxcbiAgKVxuICBwcm9ncmFtLmFkZE9wdGlvbihcbiAgICBuZXcgT3B0aW9uKFxuICAgICAgJy0tdGVhbS1uYW1lIDxuYW1lPicsXG4gICAgICAnVGVhbSBuYW1lIGZvciBzd2FybSBjb29yZGluYXRpb24nLFxuICAgICkuaGlkZUhlbHAoKSxcbiAgKVxuICBwcm9ncmFtLmFkZE9wdGlvbihcbiAgICBuZXcgT3B0aW9uKCctLWFnZW50LWNvbG9yIDxjb2xvcj4nLCAnVGVhbW1hdGUgVUkgY29sb3InKS5oaWRlSGVscCgpLFxuICApXG4gIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgIG5ldyBPcHRpb24oXG4gICAgICAnLS1wbGFuLW1vZGUtcmVxdWlyZWQnLFxuICAgICAgJ1JlcXVpcmUgcGxhbiBtb2RlIGJlZm9yZSBpbXBsZW1lbnRhdGlvbicsXG4gICAgKS5oaWRlSGVscCgpLFxuICApXG4gIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgIG5ldyBPcHRpb24oXG4gICAgICAnLS1wYXJlbnQtc2Vzc2lvbi1pZCA8aWQ+JyxcbiAgICAgICdQYXJlbnQgc2Vzc2lvbiBJRCBmb3IgYW5hbHl0aWNzIGNvcnJlbGF0aW9uJyxcbiAgICApLmhpZGVIZWxwKCksXG4gIClcbiAgcHJvZ3JhbS5hZGRPcHRpb24oXG4gICAgbmV3IE9wdGlvbihcbiAgICAgICctLXRlYW1tYXRlLW1vZGUgPG1vZGU+JyxcbiAgICAgICdIb3cgdG8gc3Bhd24gdGVhbW1hdGVzOiBcInRtdXhcIiwgXCJpbi1wcm9jZXNzXCIsIG9yIFwiYXV0b1wiJyxcbiAgICApXG4gICAgICAuY2hvaWNlcyhbJ2F1dG8nLCAndG11eCcsICdpbi1wcm9jZXNzJ10pXG4gICAgICAuaGlkZUhlbHAoKSxcbiAgKVxuICBwcm9ncmFtLmFkZE9wdGlvbihcbiAgICBuZXcgT3B0aW9uKFxuICAgICAgJy0tYWdlbnQtdHlwZSA8dHlwZT4nLFxuICAgICAgJ0N1c3RvbSBhZ2VudCB0eXBlIGZvciB0aGlzIHRlYW1tYXRlJyxcbiAgICApLmhpZGVIZWxwKCksXG4gIClcblxuICAvLyBFbmFibGUgU0RLIFVSTCBmb3IgYWxsIGJ1aWxkcyBidXQgaGlkZSBmcm9tIGhlbHBcbiAgcHJvZ3JhbS5hZGRPcHRpb24oXG4gICAgbmV3IE9wdGlvbihcbiAgICAgICctLXNkay11cmwgPHVybD4nLFxuICAgICAgJ1VzZSByZW1vdGUgV2ViU29ja2V0IGVuZHBvaW50IGZvciBTREsgSS9PIHN0cmVhbWluZyAob25seSB3aXRoIC1wIGFuZCBzdHJlYW0tanNvbiBmb3JtYXQpJyxcbiAgICApLmhpZGVIZWxwKCksXG4gIClcblxuICAvLyBFbmFibGUgdGVsZXBvcnQvcmVtb3RlIGZsYWdzIGZvciBhbGwgYnVpbGRzIGJ1dCBrZWVwIHRoZW0gdW5kb2N1bWVudGVkIHVudGlsIEdBXG4gIHByb2dyYW0uYWRkT3B0aW9uKFxuICAgIG5ldyBPcHRpb24oXG4gICAgICAnLS10ZWxlcG9ydCBbc2Vzc2lvbl0nLFxuICAgICAgJ1Jlc3VtZSBhIHRlbGVwb3J0IHNlc3Npb24sIG9wdGlvbmFsbHkgc3BlY2lmeSBzZXNzaW9uIElEJyxcbiAgICApLmhpZGVIZWxwKCksXG4gIClcbiAgcHJvZ3JhbS5hZGRPcHRpb24oXG4gICAgbmV3IE9wdGlvbihcbiAgICAgICctLXJlbW90ZSBbZGVzY3JpcHRpb25dJyxcbiAgICAgICdDcmVhdGUgYSByZW1vdGUgc2Vzc2lvbiB3aXRoIHRoZSBnaXZlbiBkZXNjcmlwdGlvbicsXG4gICAgKS5oaWRlSGVscCgpLFxuICApXG4gIGlmIChmZWF0dXJlKCdCUklER0VfTU9ERScpKSB7XG4gICAgcHJvZ3JhbS5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1yZW1vdGUtY29udHJvbCBbbmFtZV0nLFxuICAgICAgICAnU3RhcnQgYW4gaW50ZXJhY3RpdmUgc2Vzc2lvbiB3aXRoIFJlbW90ZSBDb250cm9sIGVuYWJsZWQgKG9wdGlvbmFsbHkgbmFtZWQpJyxcbiAgICAgIClcbiAgICAgICAgLmFyZ1BhcnNlcih2YWx1ZSA9PiB2YWx1ZSB8fCB0cnVlKVxuICAgICAgICAuaGlkZUhlbHAoKSxcbiAgICApXG4gICAgcHJvZ3JhbS5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKCctLXJjIFtuYW1lXScsICdBbGlhcyBmb3IgLS1yZW1vdGUtY29udHJvbCcpXG4gICAgICAgIC5hcmdQYXJzZXIodmFsdWUgPT4gdmFsdWUgfHwgdHJ1ZSlcbiAgICAgICAgLmhpZGVIZWxwKCksXG4gICAgKVxuICB9XG5cbiAgaWYgKGZlYXR1cmUoJ0hBUkRfRkFJTCcpKSB7XG4gICAgcHJvZ3JhbS5hZGRPcHRpb24oXG4gICAgICBuZXcgT3B0aW9uKFxuICAgICAgICAnLS1oYXJkLWZhaWwnLFxuICAgICAgICAnQ3Jhc2ggb24gbG9nRXJyb3IgY2FsbHMgaW5zdGVhZCBvZiBzaWxlbnRseSBsb2dnaW5nJyxcbiAgICAgICkuaGlkZUhlbHAoKSxcbiAgICApXG4gIH1cblxuICBwcm9maWxlQ2hlY2twb2ludCgncnVuX21haW5fb3B0aW9uc19idWlsdCcpXG5cbiAgLy8gLXAvLS1wcmludCBtb2RlOiBza2lwIHN1YmNvbW1hbmQgcmVnaXN0cmF0aW9uLiBUaGUgNTIgc3ViY29tbWFuZHNcbiAgLy8gKG1jcCwgYXV0aCwgcGx1Z2luLCBza2lsbCwgdGFzaywgY29uZmlnLCBkb2N0b3IsIHVwZGF0ZSwgZXRjLikgYXJlXG4gIC8vIG5ldmVyIGRpc3BhdGNoZWQgaW4gcHJpbnQgbW9kZSDigJQgY29tbWFuZGVyIHJvdXRlcyB0aGUgcHJvbXB0IHRvIHRoZVxuICAvLyBkZWZhdWx0IGFjdGlvbi4gVGhlIHN1YmNvbW1hbmQgcmVnaXN0cmF0aW9uIHBhdGggd2FzIG1lYXN1cmVkIGF0IH42NW1zXG4gIC8vIG9uIGJhc2VsaW5lIOKAlCBtb3N0bHkgdGhlIGlzQnJpZGdlRW5hYmxlZCgpIGNhbGwgKDI1bXMgc2V0dGluZ3MgWm9kIHBhcnNlXG4gIC8vICsgNDBtcyBzeW5jIGtleWNoYWluIHN1YnByb2Nlc3MpLCBib3RoIGhpZGRlbiBieSB0aGUgdHJ5L2NhdGNoIHRoYXRcbiAgLy8gYWx3YXlzIHJldHVybnMgZmFsc2UgYmVmb3JlIGVuYWJsZUNvbmZpZ3MoKS4gY2M6Ly8gVVJMcyBhcmUgcmV3cml0dGVuIHRvXG4gIC8vIGBvcGVuYCBhdCBtYWluKCkgbGluZSB+ODUxIEJFRk9SRSB0aGlzIHJ1bnMsIHNvIGFyZ3YgY2hlY2sgaXMgc2FmZSBoZXJlLlxuICBjb25zdCBpc1ByaW50TW9kZSA9XG4gICAgcHJvY2Vzcy5hcmd2LmluY2x1ZGVzKCctcCcpIHx8IHByb2Nlc3MuYXJndi5pbmNsdWRlcygnLS1wcmludCcpXG4gIGNvbnN0IGlzQ2NVcmwgPSBwcm9jZXNzLmFyZ3Yuc29tZShcbiAgICBhID0+IGEuc3RhcnRzV2l0aCgnY2M6Ly8nKSB8fCBhLnN0YXJ0c1dpdGgoJ2NjK3VuaXg6Ly8nKSxcbiAgKVxuICBpZiAoaXNQcmludE1vZGUgJiYgIWlzQ2NVcmwpIHtcbiAgICBwcm9maWxlQ2hlY2twb2ludCgncnVuX2JlZm9yZV9wYXJzZScpXG4gICAgYXdhaXQgcHJvZ3JhbS5wYXJzZUFzeW5jKHByb2Nlc3MuYXJndilcbiAgICBwcm9maWxlQ2hlY2twb2ludCgncnVuX2FmdGVyX3BhcnNlJylcbiAgICByZXR1cm4gcHJvZ3JhbVxuICB9XG5cbiAgLy8gY2xhdWRlIG1jcFxuXG4gIGNvbnN0IG1jcCA9IHByb2dyYW1cbiAgICAuY29tbWFuZCgnbWNwJylcbiAgICAuZGVzY3JpcHRpb24oJ0NvbmZpZ3VyZSBhbmQgbWFuYWdlIE1DUCBzZXJ2ZXJzJylcbiAgICAuY29uZmlndXJlSGVscChjcmVhdGVTb3J0ZWRIZWxwQ29uZmlnKCkpXG4gICAgLmVuYWJsZVBvc2l0aW9uYWxPcHRpb25zKClcblxuICBtY3BcbiAgICAuY29tbWFuZCgnc2VydmUnKVxuICAgIC5kZXNjcmlwdGlvbihgU3RhcnQgdGhlIENsYXVkZSBDb2RlIE1DUCBzZXJ2ZXJgKVxuICAgIC5vcHRpb24oJy1kLCAtLWRlYnVnJywgJ0VuYWJsZSBkZWJ1ZyBtb2RlJywgKCkgPT4gdHJ1ZSlcbiAgICAub3B0aW9uKFxuICAgICAgJy0tdmVyYm9zZScsXG4gICAgICAnT3ZlcnJpZGUgdmVyYm9zZSBtb2RlIHNldHRpbmcgZnJvbSBjb25maWcnLFxuICAgICAgKCkgPT4gdHJ1ZSxcbiAgICApXG4gICAgLmFjdGlvbihcbiAgICAgIGFzeW5jICh7IGRlYnVnLCB2ZXJib3NlIH06IHsgZGVidWc/OiBib29sZWFuOyB2ZXJib3NlPzogYm9vbGVhbiB9KSA9PiB7XG4gICAgICAgIGNvbnN0IHsgbWNwU2VydmVIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoJy4vY2xpL2hhbmRsZXJzL21jcC5qcycpXG4gICAgICAgIGF3YWl0IG1jcFNlcnZlSGFuZGxlcih7IGRlYnVnLCB2ZXJib3NlIH0pXG4gICAgICB9LFxuICAgIClcblxuICAvLyBSZWdpc3RlciB0aGUgbWNwIGFkZCBzdWJjb21tYW5kIChleHRyYWN0ZWQgZm9yIHRlc3RhYmlsaXR5KVxuICByZWdpc3Rlck1jcEFkZENvbW1hbmQobWNwKVxuXG4gIGlmIChpc1hhYUVuYWJsZWQoKSkge1xuICAgIHJlZ2lzdGVyTWNwWGFhSWRwQ29tbWFuZChtY3ApXG4gIH1cblxuICBtY3BcbiAgICAuY29tbWFuZCgncmVtb3ZlIDxuYW1lPicpXG4gICAgLmRlc2NyaXB0aW9uKCdSZW1vdmUgYW4gTUNQIHNlcnZlcicpXG4gICAgLm9wdGlvbihcbiAgICAgICctcywgLS1zY29wZSA8c2NvcGU+JyxcbiAgICAgICdDb25maWd1cmF0aW9uIHNjb3BlIChsb2NhbCwgdXNlciwgb3IgcHJvamVjdCkgLSBpZiBub3Qgc3BlY2lmaWVkLCByZW1vdmVzIGZyb20gd2hpY2hldmVyIHNjb3BlIGl0IGV4aXN0cyBpbicsXG4gICAgKVxuICAgIC5hY3Rpb24oYXN5bmMgKG5hbWU6IHN0cmluZywgb3B0aW9uczogeyBzY29wZT86IHN0cmluZyB9KSA9PiB7XG4gICAgICBjb25zdCB7IG1jcFJlbW92ZUhhbmRsZXIgfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvbWNwLmpzJylcbiAgICAgIGF3YWl0IG1jcFJlbW92ZUhhbmRsZXIobmFtZSwgb3B0aW9ucylcbiAgICB9KVxuXG4gIG1jcFxuICAgIC5jb21tYW5kKCdsaXN0JylcbiAgICAuZGVzY3JpcHRpb24oXG4gICAgICAnTGlzdCBjb25maWd1cmVkIE1DUCBzZXJ2ZXJzLiBOb3RlOiBUaGUgd29ya3NwYWNlIHRydXN0IGRpYWxvZyBpcyBza2lwcGVkIGFuZCBzdGRpbyBzZXJ2ZXJzIGZyb20gLm1jcC5qc29uIGFyZSBzcGF3bmVkIGZvciBoZWFsdGggY2hlY2tzLiBPbmx5IHVzZSB0aGlzIGNvbW1hbmQgaW4gZGlyZWN0b3JpZXMgeW91IHRydXN0LicsXG4gICAgKVxuICAgIC5hY3Rpb24oYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgeyBtY3BMaXN0SGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KCcuL2NsaS9oYW5kbGVycy9tY3AuanMnKVxuICAgICAgYXdhaXQgbWNwTGlzdEhhbmRsZXIoKVxuICAgIH0pXG5cbiAgbWNwXG4gICAgLmNvbW1hbmQoJ2dldCA8bmFtZT4nKVxuICAgIC5kZXNjcmlwdGlvbihcbiAgICAgICdHZXQgZGV0YWlscyBhYm91dCBhbiBNQ1Agc2VydmVyLiBOb3RlOiBUaGUgd29ya3NwYWNlIHRydXN0IGRpYWxvZyBpcyBza2lwcGVkIGFuZCBzdGRpbyBzZXJ2ZXJzIGZyb20gLm1jcC5qc29uIGFyZSBzcGF3bmVkIGZvciBoZWFsdGggY2hlY2tzLiBPbmx5IHVzZSB0aGlzIGNvbW1hbmQgaW4gZGlyZWN0b3JpZXMgeW91IHRydXN0LicsXG4gICAgKVxuICAgIC5hY3Rpb24oYXN5bmMgKG5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgeyBtY3BHZXRIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoJy4vY2xpL2hhbmRsZXJzL21jcC5qcycpXG4gICAgICBhd2FpdCBtY3BHZXRIYW5kbGVyKG5hbWUpXG4gICAgfSlcblxuICBtY3BcbiAgICAuY29tbWFuZCgnYWRkLWpzb24gPG5hbWU+IDxqc29uPicpXG4gICAgLmRlc2NyaXB0aW9uKCdBZGQgYW4gTUNQIHNlcnZlciAoc3RkaW8gb3IgU1NFKSB3aXRoIGEgSlNPTiBzdHJpbmcnKVxuICAgIC5vcHRpb24oXG4gICAgICAnLXMsIC0tc2NvcGUgPHNjb3BlPicsXG4gICAgICAnQ29uZmlndXJhdGlvbiBzY29wZSAobG9jYWwsIHVzZXIsIG9yIHByb2plY3QpJyxcbiAgICAgICdsb2NhbCcsXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1jbGllbnQtc2VjcmV0JyxcbiAgICAgICdQcm9tcHQgZm9yIE9BdXRoIGNsaWVudCBzZWNyZXQgKG9yIHNldCBNQ1BfQ0xJRU5UX1NFQ1JFVCBlbnYgdmFyKScsXG4gICAgKVxuICAgIC5hY3Rpb24oXG4gICAgICBhc3luYyAoXG4gICAgICAgIG5hbWU6IHN0cmluZyxcbiAgICAgICAganNvbjogc3RyaW5nLFxuICAgICAgICBvcHRpb25zOiB7IHNjb3BlPzogc3RyaW5nOyBjbGllbnRTZWNyZXQ/OiB0cnVlIH0sXG4gICAgICApID0+IHtcbiAgICAgICAgY29uc3QgeyBtY3BBZGRKc29uSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KCcuL2NsaS9oYW5kbGVycy9tY3AuanMnKVxuICAgICAgICBhd2FpdCBtY3BBZGRKc29uSGFuZGxlcihuYW1lLCBqc29uLCBvcHRpb25zKVxuICAgICAgfSxcbiAgICApXG5cbiAgbWNwXG4gICAgLmNvbW1hbmQoJ2FkZC1mcm9tLWNsYXVkZS1kZXNrdG9wJylcbiAgICAuZGVzY3JpcHRpb24oJ0ltcG9ydCBNQ1Agc2VydmVycyBmcm9tIENsYXVkZSBEZXNrdG9wIChNYWMgYW5kIFdTTCBvbmx5KScpXG4gICAgLm9wdGlvbihcbiAgICAgICctcywgLS1zY29wZSA8c2NvcGU+JyxcbiAgICAgICdDb25maWd1cmF0aW9uIHNjb3BlIChsb2NhbCwgdXNlciwgb3IgcHJvamVjdCknLFxuICAgICAgJ2xvY2FsJyxcbiAgICApXG4gICAgLmFjdGlvbihhc3luYyAob3B0aW9uczogeyBzY29wZT86IHN0cmluZyB9KSA9PiB7XG4gICAgICBjb25zdCB7IG1jcEFkZEZyb21EZXNrdG9wSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KCcuL2NsaS9oYW5kbGVycy9tY3AuanMnKVxuICAgICAgYXdhaXQgbWNwQWRkRnJvbURlc2t0b3BIYW5kbGVyKG9wdGlvbnMpXG4gICAgfSlcblxuICBtY3BcbiAgICAuY29tbWFuZCgncmVzZXQtcHJvamVjdC1jaG9pY2VzJylcbiAgICAuZGVzY3JpcHRpb24oXG4gICAgICAnUmVzZXQgYWxsIGFwcHJvdmVkIGFuZCByZWplY3RlZCBwcm9qZWN0LXNjb3BlZCAoLm1jcC5qc29uKSBzZXJ2ZXJzIHdpdGhpbiB0aGlzIHByb2plY3QnLFxuICAgIClcbiAgICAuYWN0aW9uKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHsgbWNwUmVzZXRDaG9pY2VzSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KCcuL2NsaS9oYW5kbGVycy9tY3AuanMnKVxuICAgICAgYXdhaXQgbWNwUmVzZXRDaG9pY2VzSGFuZGxlcigpXG4gICAgfSlcblxuICAvLyBjbGF1ZGUgc2VydmVyXG4gIGlmIChmZWF0dXJlKCdESVJFQ1RfQ09OTkVDVCcpKSB7XG4gICAgcHJvZ3JhbVxuICAgICAgLmNvbW1hbmQoJ3NlcnZlcicpXG4gICAgICAuZGVzY3JpcHRpb24oJ1N0YXJ0IGEgQ2xhdWRlIENvZGUgc2Vzc2lvbiBzZXJ2ZXInKVxuICAgICAgLm9wdGlvbignLS1wb3J0IDxudW1iZXI+JywgJ0hUVFAgcG9ydCcsICcwJylcbiAgICAgIC5vcHRpb24oJy0taG9zdCA8c3RyaW5nPicsICdCaW5kIGFkZHJlc3MnLCAnMC4wLjAuMCcpXG4gICAgICAub3B0aW9uKCctLWF1dGgtdG9rZW4gPHRva2VuPicsICdCZWFyZXIgdG9rZW4gZm9yIGF1dGgnKVxuICAgICAgLm9wdGlvbignLS11bml4IDxwYXRoPicsICdMaXN0ZW4gb24gYSB1bml4IGRvbWFpbiBzb2NrZXQnKVxuICAgICAgLm9wdGlvbihcbiAgICAgICAgJy0td29ya3NwYWNlIDxkaXI+JyxcbiAgICAgICAgJ0RlZmF1bHQgd29ya2luZyBkaXJlY3RvcnkgZm9yIHNlc3Npb25zIHRoYXQgZG8gbm90IHNwZWNpZnkgY3dkJyxcbiAgICAgIClcbiAgICAgIC5vcHRpb24oXG4gICAgICAgICctLWlkbGUtdGltZW91dCA8bXM+JyxcbiAgICAgICAgJ0lkbGUgdGltZW91dCBmb3IgZGV0YWNoZWQgc2Vzc2lvbnMgaW4gbXMgKDAgPSBuZXZlciBleHBpcmUpJyxcbiAgICAgICAgJzYwMDAwMCcsXG4gICAgICApXG4gICAgICAub3B0aW9uKFxuICAgICAgICAnLS1tYXgtc2Vzc2lvbnMgPG4+JyxcbiAgICAgICAgJ01heGltdW0gY29uY3VycmVudCBzZXNzaW9ucyAoMCA9IHVubGltaXRlZCknLFxuICAgICAgICAnMzInLFxuICAgICAgKVxuICAgICAgLmFjdGlvbihcbiAgICAgICAgYXN5bmMgKG9wdHM6IHtcbiAgICAgICAgICBwb3J0OiBzdHJpbmdcbiAgICAgICAgICBob3N0OiBzdHJpbmdcbiAgICAgICAgICBhdXRoVG9rZW4/OiBzdHJpbmdcbiAgICAgICAgICB1bml4Pzogc3RyaW5nXG4gICAgICAgICAgd29ya3NwYWNlPzogc3RyaW5nXG4gICAgICAgICAgaWRsZVRpbWVvdXQ6IHN0cmluZ1xuICAgICAgICAgIG1heFNlc3Npb25zOiBzdHJpbmdcbiAgICAgICAgfSkgPT4ge1xuICAgICAgICAgIGNvbnN0IHsgcmFuZG9tQnl0ZXMgfSA9IGF3YWl0IGltcG9ydCgnY3J5cHRvJylcbiAgICAgICAgICBjb25zdCB7IHN0YXJ0U2VydmVyIH0gPSBhd2FpdCBpbXBvcnQoJy4vc2VydmVyL3NlcnZlci5qcycpXG4gICAgICAgICAgY29uc3QgeyBTZXNzaW9uTWFuYWdlciB9ID0gYXdhaXQgaW1wb3J0KCcuL3NlcnZlci9zZXNzaW9uTWFuYWdlci5qcycpXG4gICAgICAgICAgY29uc3QgeyBEYW5nZXJvdXNCYWNrZW5kIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICAgICAnLi9zZXJ2ZXIvYmFja2VuZHMvZGFuZ2Vyb3VzQmFja2VuZC5qcydcbiAgICAgICAgICApXG4gICAgICAgICAgY29uc3QgeyBwcmludEJhbm5lciB9ID0gYXdhaXQgaW1wb3J0KCcuL3NlcnZlci9zZXJ2ZXJCYW5uZXIuanMnKVxuICAgICAgICAgIGNvbnN0IHsgY3JlYXRlU2VydmVyTG9nZ2VyIH0gPSBhd2FpdCBpbXBvcnQoJy4vc2VydmVyL3NlcnZlckxvZy5qcycpXG4gICAgICAgICAgY29uc3QgeyB3cml0ZVNlcnZlckxvY2ssIHJlbW92ZVNlcnZlckxvY2ssIHByb2JlUnVubmluZ1NlcnZlciB9ID1cbiAgICAgICAgICAgIGF3YWl0IGltcG9ydCgnLi9zZXJ2ZXIvbG9ja2ZpbGUuanMnKVxuXG4gICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcm9iZVJ1bm5pbmdTZXJ2ZXIoKVxuICAgICAgICAgIGlmIChleGlzdGluZykge1xuICAgICAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgICAgICAgIGBBIGNsYXVkZSBzZXJ2ZXIgaXMgYWxyZWFkeSBydW5uaW5nIChwaWQgJHtleGlzdGluZy5waWR9KSBhdCAke2V4aXN0aW5nLmh0dHBVcmx9XFxuYCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGF1dGhUb2tlbiA9XG4gICAgICAgICAgICBvcHRzLmF1dGhUb2tlbiA/P1xuICAgICAgICAgICAgYHNrLWFudC1jYy0ke3JhbmRvbUJ5dGVzKDE2KS50b1N0cmluZygnYmFzZTY0dXJsJyl9YFxuXG4gICAgICAgICAgY29uc3QgY29uZmlnID0ge1xuICAgICAgICAgICAgcG9ydDogcGFyc2VJbnQob3B0cy5wb3J0LCAxMCksXG4gICAgICAgICAgICBob3N0OiBvcHRzLmhvc3QsXG4gICAgICAgICAgICBhdXRoVG9rZW4sXG4gICAgICAgICAgICB1bml4OiBvcHRzLnVuaXgsXG4gICAgICAgICAgICB3b3Jrc3BhY2U6IG9wdHMud29ya3NwYWNlLFxuICAgICAgICAgICAgaWRsZVRpbWVvdXRNczogcGFyc2VJbnQob3B0cy5pZGxlVGltZW91dCwgMTApLFxuICAgICAgICAgICAgbWF4U2Vzc2lvbnM6IHBhcnNlSW50KG9wdHMubWF4U2Vzc2lvbnMsIDEwKSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBiYWNrZW5kID0gbmV3IERhbmdlcm91c0JhY2tlbmQoKVxuICAgICAgICAgIGNvbnN0IHNlc3Npb25NYW5hZ2VyID0gbmV3IFNlc3Npb25NYW5hZ2VyKGJhY2tlbmQsIHtcbiAgICAgICAgICAgIGlkbGVUaW1lb3V0TXM6IGNvbmZpZy5pZGxlVGltZW91dE1zLFxuICAgICAgICAgICAgbWF4U2Vzc2lvbnM6IGNvbmZpZy5tYXhTZXNzaW9ucyxcbiAgICAgICAgICB9KVxuICAgICAgICAgIGNvbnN0IGxvZ2dlciA9IGNyZWF0ZVNlcnZlckxvZ2dlcigpXG5cbiAgICAgICAgICBjb25zdCBzZXJ2ZXIgPSBzdGFydFNlcnZlcihjb25maWcsIHNlc3Npb25NYW5hZ2VyLCBsb2dnZXIpXG4gICAgICAgICAgY29uc3QgYWN0dWFsUG9ydCA9IHNlcnZlci5wb3J0ID8/IGNvbmZpZy5wb3J0XG4gICAgICAgICAgcHJpbnRCYW5uZXIoY29uZmlnLCBhdXRoVG9rZW4sIGFjdHVhbFBvcnQpXG5cbiAgICAgICAgICBhd2FpdCB3cml0ZVNlcnZlckxvY2soe1xuICAgICAgICAgICAgcGlkOiBwcm9jZXNzLnBpZCxcbiAgICAgICAgICAgIHBvcnQ6IGFjdHVhbFBvcnQsXG4gICAgICAgICAgICBob3N0OiBjb25maWcuaG9zdCxcbiAgICAgICAgICAgIGh0dHBVcmw6IGNvbmZpZy51bml4XG4gICAgICAgICAgICAgID8gYHVuaXg6JHtjb25maWcudW5peH1gXG4gICAgICAgICAgICAgIDogYGh0dHA6Ly8ke2NvbmZpZy5ob3N0fToke2FjdHVhbFBvcnR9YCxcbiAgICAgICAgICAgIHN0YXJ0ZWRBdDogRGF0ZS5ub3coKSxcbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgbGV0IHNodXR0aW5nRG93biA9IGZhbHNlXG4gICAgICAgICAgY29uc3Qgc2h1dGRvd24gPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoc2h1dHRpbmdEb3duKSByZXR1cm5cbiAgICAgICAgICAgIHNodXR0aW5nRG93biA9IHRydWVcbiAgICAgICAgICAgIC8vIFN0b3AgYWNjZXB0aW5nIG5ldyBjb25uZWN0aW9ucyBiZWZvcmUgdGVhcmluZyBkb3duIHNlc3Npb25zLlxuICAgICAgICAgICAgc2VydmVyLnN0b3AodHJ1ZSlcbiAgICAgICAgICAgIGF3YWl0IHNlc3Npb25NYW5hZ2VyLmRlc3Ryb3lBbGwoKVxuICAgICAgICAgICAgYXdhaXQgcmVtb3ZlU2VydmVyTG9jaygpXG4gICAgICAgICAgICBwcm9jZXNzLmV4aXQoMClcbiAgICAgICAgICB9XG4gICAgICAgICAgcHJvY2Vzcy5vbmNlKCdTSUdJTlQnLCAoKSA9PiB2b2lkIHNodXRkb3duKCkpXG4gICAgICAgICAgcHJvY2Vzcy5vbmNlKCdTSUdURVJNJywgKCkgPT4gdm9pZCBzaHV0ZG93bigpKVxuICAgICAgICB9LFxuICAgICAgKVxuICB9XG5cbiAgLy8gYGNsYXVkZSBzc2ggPGhvc3Q+IFtkaXJdYCDigJQgcmVnaXN0ZXJlZCBoZXJlIG9ubHkgc28gLS1oZWxwIHNob3dzIGl0LlxuICAvLyBUaGUgYWN0dWFsIGludGVyYWN0aXZlIGZsb3cgaXMgaGFuZGxlZCBieSBlYXJseSBhcmd2IHJld3JpdGluZyBpbiBtYWluKClcbiAgLy8gKHBhcmFsbGVscyB0aGUgRElSRUNUX0NPTk5FQ1QvY2M6Ly8gcGF0dGVybiBhYm92ZSkuIElmIGNvbW1hbmRlciByZWFjaGVzXG4gIC8vIHRoaXMgYWN0aW9uIGl0IG1lYW5zIHRoZSBhcmd2IHJld3JpdGUgZGlkbid0IGZpcmUgKGUuZy4gdXNlciByYW5cbiAgLy8gYGNsYXVkZSBzc2hgIHdpdGggbm8gaG9zdCkg4oCUIGp1c3QgcHJpbnQgdXNhZ2UuXG4gIGlmIChmZWF0dXJlKCdTU0hfUkVNT1RFJykpIHtcbiAgICBwcm9ncmFtXG4gICAgICAuY29tbWFuZCgnc3NoIDxob3N0PiBbZGlyXScpXG4gICAgICAuZGVzY3JpcHRpb24oXG4gICAgICAgICdSdW4gQ2xhdWRlIENvZGUgb24gYSByZW1vdGUgaG9zdCBvdmVyIFNTSC4gRGVwbG95cyB0aGUgYmluYXJ5IGFuZCAnICtcbiAgICAgICAgICAndHVubmVscyBBUEkgYXV0aCBiYWNrIHRocm91Z2ggeW91ciBsb2NhbCBtYWNoaW5lIOKAlCBubyByZW1vdGUgc2V0dXAgbmVlZGVkLicsXG4gICAgICApXG4gICAgICAub3B0aW9uKFxuICAgICAgICAnLS1wZXJtaXNzaW9uLW1vZGUgPG1vZGU+JyxcbiAgICAgICAgJ1Blcm1pc3Npb24gbW9kZSBmb3IgdGhlIHJlbW90ZSBzZXNzaW9uJyxcbiAgICAgIClcbiAgICAgIC5vcHRpb24oXG4gICAgICAgICctLWRhbmdlcm91c2x5LXNraXAtcGVybWlzc2lvbnMnLFxuICAgICAgICAnU2tpcCBhbGwgcGVybWlzc2lvbiBwcm9tcHRzIG9uIHRoZSByZW1vdGUgKGRhbmdlcm91cyknLFxuICAgICAgKVxuICAgICAgLm9wdGlvbihcbiAgICAgICAgJy0tbG9jYWwnLFxuICAgICAgICAnZTJlIHRlc3QgbW9kZSDigJQgc3Bhd24gdGhlIGNoaWxkIENMSSBsb2NhbGx5IChza2lwIHNzaC9kZXBsb3kpLiAnICtcbiAgICAgICAgICAnRXhlcmNpc2VzIHRoZSBhdXRoIHByb3h5IGFuZCB1bml4LXNvY2tldCBwbHVtYmluZyB3aXRob3V0IGEgcmVtb3RlIGhvc3QuJyxcbiAgICAgIClcbiAgICAgIC5hY3Rpb24oYXN5bmMgKCkgPT4ge1xuICAgICAgICAvLyBBcmd2IHJld3JpdGluZyBpbiBtYWluKCkgc2hvdWxkIGhhdmUgY29uc3VtZWQgYHNzaCA8aG9zdD5gIGJlZm9yZVxuICAgICAgICAvLyBjb21tYW5kZXIgcnVucy4gUmVhY2hpbmcgaGVyZSBtZWFucyBob3N0IHdhcyBtaXNzaW5nIG9yIHRoZVxuICAgICAgICAvLyByZXdyaXRlIHByZWRpY2F0ZSBkaWRuJ3QgbWF0Y2guXG4gICAgICAgIHByb2Nlc3Muc3RkZXJyLndyaXRlKFxuICAgICAgICAgICdVc2FnZTogY2xhdWRlIHNzaCA8dXNlckBob3N0IHwgc3NoLWNvbmZpZy1hbGlhcz4gW2Rpcl1cXG5cXG4nICtcbiAgICAgICAgICAgIFwiUnVucyBDbGF1ZGUgQ29kZSBvbiBhIHJlbW90ZSBMaW51eCBob3N0LiBZb3UgZG9uJ3QgbmVlZCB0byBpbnN0YWxsXFxuXCIgK1xuICAgICAgICAgICAgJ2FueXRoaW5nIG9uIHRoZSByZW1vdGUgb3IgcnVuIGBjbGF1ZGUgYXV0aCBsb2dpbmAgdGhlcmUg4oCUIHRoZSBiaW5hcnkgaXNcXG4nICtcbiAgICAgICAgICAgICdkZXBsb3llZCBvdmVyIFNTSCBhbmQgQVBJIGF1dGggdHVubmVscyBiYWNrIHRocm91Z2ggeW91ciBsb2NhbCBtYWNoaW5lLlxcbicsXG4gICAgICAgIClcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICB9KVxuICB9XG5cbiAgLy8gY2xhdWRlIGNvbm5lY3Qg4oCUIHN1YmNvbW1hbmQgb25seSBoYW5kbGVzIC1wIChoZWFkbGVzcykgbW9kZS5cbiAgLy8gSW50ZXJhY3RpdmUgbW9kZSAod2l0aG91dCAtcCkgaXMgaGFuZGxlZCBieSBlYXJseSBhcmd2IHJld3JpdGluZyBpbiBtYWluKClcbiAgLy8gd2hpY2ggcmVkaXJlY3RzIHRvIHRoZSBtYWluIGNvbW1hbmQgd2l0aCBmdWxsIFRVSSBzdXBwb3J0LlxuICBpZiAoZmVhdHVyZSgnRElSRUNUX0NPTk5FQ1QnKSkge1xuICAgIHByb2dyYW1cbiAgICAgIC5jb21tYW5kKCdvcGVuIDxjYy11cmw+JylcbiAgICAgIC5kZXNjcmlwdGlvbihcbiAgICAgICAgJ0Nvbm5lY3QgdG8gYSBDbGF1ZGUgQ29kZSBzZXJ2ZXIgKGludGVybmFsIOKAlCB1c2UgY2M6Ly8gVVJMcyknLFxuICAgICAgKVxuICAgICAgLm9wdGlvbignLXAsIC0tcHJpbnQgW3Byb21wdF0nLCAnUHJpbnQgbW9kZSAoaGVhZGxlc3MpJylcbiAgICAgIC5vcHRpb24oXG4gICAgICAgICctLW91dHB1dC1mb3JtYXQgPGZvcm1hdD4nLFxuICAgICAgICAnT3V0cHV0IGZvcm1hdDogdGV4dCwganNvbiwgc3RyZWFtLWpzb24nLFxuICAgICAgICAndGV4dCcsXG4gICAgICApXG4gICAgICAuYWN0aW9uKFxuICAgICAgICBhc3luYyAoXG4gICAgICAgICAgY2NVcmw6IHN0cmluZyxcbiAgICAgICAgICBvcHRzOiB7XG4gICAgICAgICAgICBwcmludD86IHN0cmluZyB8IGJvb2xlYW5cbiAgICAgICAgICAgIG91dHB1dEZvcm1hdDogc3RyaW5nXG4gICAgICAgICAgfSxcbiAgICAgICAgKSA9PiB7XG4gICAgICAgICAgY29uc3QgeyBwYXJzZUNvbm5lY3RVcmwgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICAgICAgICcuL3NlcnZlci9wYXJzZUNvbm5lY3RVcmwuanMnXG4gICAgICAgICAgKVxuICAgICAgICAgIGNvbnN0IHsgc2VydmVyVXJsLCBhdXRoVG9rZW4gfSA9IHBhcnNlQ29ubmVjdFVybChjY1VybClcblxuICAgICAgICAgIGxldCBjb25uZWN0Q29uZmlnXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNlc3Npb24gPSBhd2FpdCBjcmVhdGVEaXJlY3RDb25uZWN0U2Vzc2lvbih7XG4gICAgICAgICAgICAgIHNlcnZlclVybCxcbiAgICAgICAgICAgICAgYXV0aFRva2VuLFxuICAgICAgICAgICAgICBjd2Q6IGdldE9yaWdpbmFsQ3dkKCksXG4gICAgICAgICAgICAgIGRhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zOlxuICAgICAgICAgICAgICAgIF9wZW5kaW5nQ29ubmVjdD8uZGFuZ2Vyb3VzbHlTa2lwUGVybWlzc2lvbnMsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgaWYgKHNlc3Npb24ud29ya0Rpcikge1xuICAgICAgICAgICAgICBzZXRPcmlnaW5hbEN3ZChzZXNzaW9uLndvcmtEaXIpXG4gICAgICAgICAgICAgIHNldEN3ZFN0YXRlKHNlc3Npb24ud29ya0RpcilcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNldERpcmVjdENvbm5lY3RTZXJ2ZXJVcmwoc2VydmVyVXJsKVxuICAgICAgICAgICAgY29ubmVjdENvbmZpZyA9IHNlc3Npb24uY29uZmlnXG4gICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTogaW50ZW50aW9uYWwgZXJyb3Igb3V0cHV0XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBlcnIgaW5zdGFuY2VvZiBEaXJlY3RDb25uZWN0RXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgeyBydW5Db25uZWN0SGVhZGxlc3MgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICAgICAgICcuL3NlcnZlci9jb25uZWN0SGVhZGxlc3MuanMnXG4gICAgICAgICAgKVxuXG4gICAgICAgICAgY29uc3QgcHJvbXB0ID0gdHlwZW9mIG9wdHMucHJpbnQgPT09ICdzdHJpbmcnID8gb3B0cy5wcmludCA6ICcnXG4gICAgICAgICAgY29uc3QgaW50ZXJhY3RpdmUgPSBvcHRzLnByaW50ID09PSB0cnVlXG4gICAgICAgICAgYXdhaXQgcnVuQ29ubmVjdEhlYWRsZXNzKFxuICAgICAgICAgICAgY29ubmVjdENvbmZpZyxcbiAgICAgICAgICAgIHByb21wdCxcbiAgICAgICAgICAgIG9wdHMub3V0cHV0Rm9ybWF0LFxuICAgICAgICAgICAgaW50ZXJhY3RpdmUsXG4gICAgICAgICAgKVxuICAgICAgICB9LFxuICAgICAgKVxuICB9XG5cbiAgLy8gY2xhdWRlIGF1dGhcblxuICBjb25zdCBhdXRoID0gcHJvZ3JhbVxuICAgIC5jb21tYW5kKCdhdXRoJylcbiAgICAuZGVzY3JpcHRpb24oJ01hbmFnZSBhdXRoZW50aWNhdGlvbicpXG4gICAgLmNvbmZpZ3VyZUhlbHAoY3JlYXRlU29ydGVkSGVscENvbmZpZygpKVxuXG4gIGF1dGhcbiAgICAuY29tbWFuZCgnbG9naW4nKVxuICAgIC5kZXNjcmlwdGlvbignU2lnbiBpbiB0byB5b3VyIEFudGhyb3BpYyBhY2NvdW50JylcbiAgICAub3B0aW9uKCctLWVtYWlsIDxlbWFpbD4nLCAnUHJlLXBvcHVsYXRlIGVtYWlsIGFkZHJlc3Mgb24gdGhlIGxvZ2luIHBhZ2UnKVxuICAgIC5vcHRpb24oJy0tc3NvJywgJ0ZvcmNlIFNTTyBsb2dpbiBmbG93JylcbiAgICAub3B0aW9uKFxuICAgICAgJy0tY29uc29sZScsXG4gICAgICAnVXNlIEFudGhyb3BpYyBDb25zb2xlIChBUEkgdXNhZ2UgYmlsbGluZykgaW5zdGVhZCBvZiBDbGF1ZGUgc3Vic2NyaXB0aW9uJyxcbiAgICApXG4gICAgLm9wdGlvbignLS1jbGF1ZGVhaScsICdVc2UgQ2xhdWRlIHN1YnNjcmlwdGlvbiAoZGVmYXVsdCknKVxuICAgIC5hY3Rpb24oXG4gICAgICBhc3luYyAoe1xuICAgICAgICBlbWFpbCxcbiAgICAgICAgc3NvLFxuICAgICAgICBjb25zb2xlOiB1c2VDb25zb2xlLFxuICAgICAgICBjbGF1ZGVhaSxcbiAgICAgIH06IHtcbiAgICAgICAgZW1haWw/OiBzdHJpbmdcbiAgICAgICAgc3NvPzogYm9vbGVhblxuICAgICAgICBjb25zb2xlPzogYm9vbGVhblxuICAgICAgICBjbGF1ZGVhaT86IGJvb2xlYW5cbiAgICAgIH0pID0+IHtcbiAgICAgICAgY29uc3QgeyBhdXRoTG9naW4gfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvYXV0aC5qcycpXG4gICAgICAgIGF3YWl0IGF1dGhMb2dpbih7IGVtYWlsLCBzc28sIGNvbnNvbGU6IHVzZUNvbnNvbGUsIGNsYXVkZWFpIH0pXG4gICAgICB9LFxuICAgIClcblxuICBhdXRoXG4gICAgLmNvbW1hbmQoJ3N0YXR1cycpXG4gICAgLmRlc2NyaXB0aW9uKCdTaG93IGF1dGhlbnRpY2F0aW9uIHN0YXR1cycpXG4gICAgLm9wdGlvbignLS1qc29uJywgJ091dHB1dCBhcyBKU09OIChkZWZhdWx0KScpXG4gICAgLm9wdGlvbignLS10ZXh0JywgJ091dHB1dCBhcyBodW1hbi1yZWFkYWJsZSB0ZXh0JylcbiAgICAuYWN0aW9uKGFzeW5jIChvcHRzOiB7IGpzb24/OiBib29sZWFuOyB0ZXh0PzogYm9vbGVhbiB9KSA9PiB7XG4gICAgICBjb25zdCB7IGF1dGhTdGF0dXMgfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvYXV0aC5qcycpXG4gICAgICBhd2FpdCBhdXRoU3RhdHVzKG9wdHMpXG4gICAgfSlcblxuICBhdXRoXG4gICAgLmNvbW1hbmQoJ2xvZ291dCcpXG4gICAgLmRlc2NyaXB0aW9uKCdMb2cgb3V0IGZyb20geW91ciBBbnRocm9waWMgYWNjb3VudCcpXG4gICAgLmFjdGlvbihhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB7IGF1dGhMb2dvdXQgfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvYXV0aC5qcycpXG4gICAgICBhd2FpdCBhdXRoTG9nb3V0KClcbiAgICB9KVxuXG4gIC8qKlxuICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gaGFuZGxlIG1hcmtldHBsYWNlIGNvbW1hbmQgZXJyb3JzIGNvbnNpc3RlbnRseS5cbiAgICogTG9ncyB0aGUgZXJyb3IgYW5kIGV4aXRzIHRoZSBwcm9jZXNzIHdpdGggc3RhdHVzIDEuXG4gICAqIEBwYXJhbSBlcnJvciBUaGUgZXJyb3IgdGhhdCBvY2N1cnJlZFxuICAgKiBAcGFyYW0gYWN0aW9uIERlc2NyaXB0aW9uIG9mIHRoZSBhY3Rpb24gdGhhdCBmYWlsZWRcbiAgICovXG4gIC8vIEhpZGRlbiBmbGFnIG9uIGFsbCBwbHVnaW4vbWFya2V0cGxhY2Ugc3ViY29tbWFuZHMgdG8gdGFyZ2V0IGNvd29ya19wbHVnaW5zLlxuICBjb25zdCBjb3dvcmtPcHRpb24gPSAoKSA9PlxuICAgIG5ldyBPcHRpb24oJy0tY293b3JrJywgJ1VzZSBjb3dvcmtfcGx1Z2lucyBkaXJlY3RvcnknKS5oaWRlSGVscCgpXG5cbiAgLy8gUGx1Z2luIHZhbGlkYXRlIGNvbW1hbmRcbiAgY29uc3QgcGx1Z2luQ21kID0gcHJvZ3JhbVxuICAgIC5jb21tYW5kKCdwbHVnaW4nKVxuICAgIC5hbGlhcygncGx1Z2lucycpXG4gICAgLmRlc2NyaXB0aW9uKCdNYW5hZ2UgQ2xhdWRlIENvZGUgcGx1Z2lucycpXG4gICAgLmNvbmZpZ3VyZUhlbHAoY3JlYXRlU29ydGVkSGVscENvbmZpZygpKVxuXG4gIHBsdWdpbkNtZFxuICAgIC5jb21tYW5kKCd2YWxpZGF0ZSA8cGF0aD4nKVxuICAgIC5kZXNjcmlwdGlvbignVmFsaWRhdGUgYSBwbHVnaW4gb3IgbWFya2V0cGxhY2UgbWFuaWZlc3QnKVxuICAgIC5hZGRPcHRpb24oY293b3JrT3B0aW9uKCkpXG4gICAgLmFjdGlvbihhc3luYyAobWFuaWZlc3RQYXRoOiBzdHJpbmcsIG9wdGlvbnM6IHsgY293b3JrPzogYm9vbGVhbiB9KSA9PiB7XG4gICAgICBjb25zdCB7IHBsdWdpblZhbGlkYXRlSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAnLi9jbGkvaGFuZGxlcnMvcGx1Z2lucy5qcydcbiAgICAgIClcbiAgICAgIGF3YWl0IHBsdWdpblZhbGlkYXRlSGFuZGxlcihtYW5pZmVzdFBhdGgsIG9wdGlvbnMpXG4gICAgfSlcblxuICAvLyBQbHVnaW4gbGlzdCBjb21tYW5kXG4gIHBsdWdpbkNtZFxuICAgIC5jb21tYW5kKCdsaXN0JylcbiAgICAuZGVzY3JpcHRpb24oJ0xpc3QgaW5zdGFsbGVkIHBsdWdpbnMnKVxuICAgIC5vcHRpb24oJy0tanNvbicsICdPdXRwdXQgYXMgSlNPTicpXG4gICAgLm9wdGlvbihcbiAgICAgICctLWF2YWlsYWJsZScsXG4gICAgICAnSW5jbHVkZSBhdmFpbGFibGUgcGx1Z2lucyBmcm9tIG1hcmtldHBsYWNlcyAocmVxdWlyZXMgLS1qc29uKScsXG4gICAgKVxuICAgIC5hZGRPcHRpb24oY293b3JrT3B0aW9uKCkpXG4gICAgLmFjdGlvbihcbiAgICAgIGFzeW5jIChvcHRpb25zOiB7XG4gICAgICAgIGpzb24/OiBib29sZWFuXG4gICAgICAgIGF2YWlsYWJsZT86IGJvb2xlYW5cbiAgICAgICAgY293b3JrPzogYm9vbGVhblxuICAgICAgfSkgPT4ge1xuICAgICAgICBjb25zdCB7IHBsdWdpbkxpc3RIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoJy4vY2xpL2hhbmRsZXJzL3BsdWdpbnMuanMnKVxuICAgICAgICBhd2FpdCBwbHVnaW5MaXN0SGFuZGxlcihvcHRpb25zKVxuICAgICAgfSxcbiAgICApXG5cbiAgLy8gTWFya2V0cGxhY2Ugc3ViY29tbWFuZHNcbiAgY29uc3QgbWFya2V0cGxhY2VDbWQgPSBwbHVnaW5DbWRcbiAgICAuY29tbWFuZCgnbWFya2V0cGxhY2UnKVxuICAgIC5kZXNjcmlwdGlvbignTWFuYWdlIENsYXVkZSBDb2RlIG1hcmtldHBsYWNlcycpXG4gICAgLmNvbmZpZ3VyZUhlbHAoY3JlYXRlU29ydGVkSGVscENvbmZpZygpKVxuXG4gIG1hcmtldHBsYWNlQ21kXG4gICAgLmNvbW1hbmQoJ2FkZCA8c291cmNlPicpXG4gICAgLmRlc2NyaXB0aW9uKCdBZGQgYSBtYXJrZXRwbGFjZSBmcm9tIGEgVVJMLCBwYXRoLCBvciBHaXRIdWIgcmVwbycpXG4gICAgLmFkZE9wdGlvbihjb3dvcmtPcHRpb24oKSlcbiAgICAub3B0aW9uKFxuICAgICAgJy0tc3BhcnNlIDxwYXRocy4uLj4nLFxuICAgICAgJ0xpbWl0IGNoZWNrb3V0IHRvIHNwZWNpZmljIGRpcmVjdG9yaWVzIHZpYSBnaXQgc3BhcnNlLWNoZWNrb3V0IChmb3IgbW9ub3JlcG9zKS4gRXhhbXBsZTogLS1zcGFyc2UgLmNsYXVkZS1wbHVnaW4gcGx1Z2lucycsXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1zY29wZSA8c2NvcGU+JyxcbiAgICAgICdXaGVyZSB0byBkZWNsYXJlIHRoZSBtYXJrZXRwbGFjZTogdXNlciAoZGVmYXVsdCksIHByb2plY3QsIG9yIGxvY2FsJyxcbiAgICApXG4gICAgLmFjdGlvbihcbiAgICAgIGFzeW5jIChcbiAgICAgICAgc291cmNlOiBzdHJpbmcsXG4gICAgICAgIG9wdGlvbnM6IHsgY293b3JrPzogYm9vbGVhbjsgc3BhcnNlPzogc3RyaW5nW107IHNjb3BlPzogc3RyaW5nIH0sXG4gICAgICApID0+IHtcbiAgICAgICAgY29uc3QgeyBtYXJrZXRwbGFjZUFkZEhhbmRsZXIgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICAgICAnLi9jbGkvaGFuZGxlcnMvcGx1Z2lucy5qcydcbiAgICAgICAgKVxuICAgICAgICBhd2FpdCBtYXJrZXRwbGFjZUFkZEhhbmRsZXIoc291cmNlLCBvcHRpb25zKVxuICAgICAgfSxcbiAgICApXG5cbiAgbWFya2V0cGxhY2VDbWRcbiAgICAuY29tbWFuZCgnbGlzdCcpXG4gICAgLmRlc2NyaXB0aW9uKCdMaXN0IGFsbCBjb25maWd1cmVkIG1hcmtldHBsYWNlcycpXG4gICAgLm9wdGlvbignLS1qc29uJywgJ091dHB1dCBhcyBKU09OJylcbiAgICAuYWRkT3B0aW9uKGNvd29ya09wdGlvbigpKVxuICAgIC5hY3Rpb24oYXN5bmMgKG9wdGlvbnM6IHsganNvbj86IGJvb2xlYW47IGNvd29yaz86IGJvb2xlYW4gfSkgPT4ge1xuICAgICAgY29uc3QgeyBtYXJrZXRwbGFjZUxpc3RIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICcuL2NsaS9oYW5kbGVycy9wbHVnaW5zLmpzJ1xuICAgICAgKVxuICAgICAgYXdhaXQgbWFya2V0cGxhY2VMaXN0SGFuZGxlcihvcHRpb25zKVxuICAgIH0pXG5cbiAgbWFya2V0cGxhY2VDbWRcbiAgICAuY29tbWFuZCgncmVtb3ZlIDxuYW1lPicpXG4gICAgLmFsaWFzKCdybScpXG4gICAgLmRlc2NyaXB0aW9uKCdSZW1vdmUgYSBjb25maWd1cmVkIG1hcmtldHBsYWNlJylcbiAgICAuYWRkT3B0aW9uKGNvd29ya09wdGlvbigpKVxuICAgIC5hY3Rpb24oYXN5bmMgKG5hbWU6IHN0cmluZywgb3B0aW9uczogeyBjb3dvcms/OiBib29sZWFuIH0pID0+IHtcbiAgICAgIGNvbnN0IHsgbWFya2V0cGxhY2VSZW1vdmVIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICcuL2NsaS9oYW5kbGVycy9wbHVnaW5zLmpzJ1xuICAgICAgKVxuICAgICAgYXdhaXQgbWFya2V0cGxhY2VSZW1vdmVIYW5kbGVyKG5hbWUsIG9wdGlvbnMpXG4gICAgfSlcblxuICBtYXJrZXRwbGFjZUNtZFxuICAgIC5jb21tYW5kKCd1cGRhdGUgW25hbWVdJylcbiAgICAuZGVzY3JpcHRpb24oXG4gICAgICAnVXBkYXRlIG1hcmtldHBsYWNlKHMpIGZyb20gdGhlaXIgc291cmNlIC0gdXBkYXRlcyBhbGwgaWYgbm8gbmFtZSBzcGVjaWZpZWQnLFxuICAgIClcbiAgICAuYWRkT3B0aW9uKGNvd29ya09wdGlvbigpKVxuICAgIC5hY3Rpb24oYXN5bmMgKG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCwgb3B0aW9uczogeyBjb3dvcms/OiBib29sZWFuIH0pID0+IHtcbiAgICAgIGNvbnN0IHsgbWFya2V0cGxhY2VVcGRhdGVIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICcuL2NsaS9oYW5kbGVycy9wbHVnaW5zLmpzJ1xuICAgICAgKVxuICAgICAgYXdhaXQgbWFya2V0cGxhY2VVcGRhdGVIYW5kbGVyKG5hbWUsIG9wdGlvbnMpXG4gICAgfSlcblxuICAvLyBQbHVnaW4gaW5zdGFsbCBjb21tYW5kXG4gIHBsdWdpbkNtZFxuICAgIC5jb21tYW5kKCdpbnN0YWxsIDxwbHVnaW4+JylcbiAgICAuYWxpYXMoJ2knKVxuICAgIC5kZXNjcmlwdGlvbihcbiAgICAgICdJbnN0YWxsIGEgcGx1Z2luIGZyb20gYXZhaWxhYmxlIG1hcmtldHBsYWNlcyAodXNlIHBsdWdpbkBtYXJrZXRwbGFjZSBmb3Igc3BlY2lmaWMgbWFya2V0cGxhY2UpJyxcbiAgICApXG4gICAgLm9wdGlvbihcbiAgICAgICctcywgLS1zY29wZSA8c2NvcGU+JyxcbiAgICAgICdJbnN0YWxsYXRpb24gc2NvcGU6IHVzZXIsIHByb2plY3QsIG9yIGxvY2FsJyxcbiAgICAgICd1c2VyJyxcbiAgICApXG4gICAgLmFkZE9wdGlvbihjb3dvcmtPcHRpb24oKSlcbiAgICAuYWN0aW9uKFxuICAgICAgYXN5bmMgKHBsdWdpbjogc3RyaW5nLCBvcHRpb25zOiB7IHNjb3BlPzogc3RyaW5nOyBjb3dvcms/OiBib29sZWFuIH0pID0+IHtcbiAgICAgICAgY29uc3QgeyBwbHVnaW5JbnN0YWxsSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICcuL2NsaS9oYW5kbGVycy9wbHVnaW5zLmpzJ1xuICAgICAgICApXG4gICAgICAgIGF3YWl0IHBsdWdpbkluc3RhbGxIYW5kbGVyKHBsdWdpbiwgb3B0aW9ucylcbiAgICAgIH0sXG4gICAgKVxuXG4gIC8vIFBsdWdpbiB1bmluc3RhbGwgY29tbWFuZFxuICBwbHVnaW5DbWRcbiAgICAuY29tbWFuZCgndW5pbnN0YWxsIDxwbHVnaW4+JylcbiAgICAuYWxpYXMoJ3JlbW92ZScpXG4gICAgLmFsaWFzKCdybScpXG4gICAgLmRlc2NyaXB0aW9uKCdVbmluc3RhbGwgYW4gaW5zdGFsbGVkIHBsdWdpbicpXG4gICAgLm9wdGlvbihcbiAgICAgICctcywgLS1zY29wZSA8c2NvcGU+JyxcbiAgICAgICdVbmluc3RhbGwgZnJvbSBzY29wZTogdXNlciwgcHJvamVjdCwgb3IgbG9jYWwnLFxuICAgICAgJ3VzZXInLFxuICAgIClcbiAgICAub3B0aW9uKFxuICAgICAgJy0ta2VlcC1kYXRhJyxcbiAgICAgIFwiUHJlc2VydmUgdGhlIHBsdWdpbidzIHBlcnNpc3RlbnQgZGF0YSBkaXJlY3RvcnkgKH4vLmNsYXVkZS9wbHVnaW5zL2RhdGEve2lkfS8pXCIsXG4gICAgKVxuICAgIC5hZGRPcHRpb24oY293b3JrT3B0aW9uKCkpXG4gICAgLmFjdGlvbihcbiAgICAgIGFzeW5jIChcbiAgICAgICAgcGx1Z2luOiBzdHJpbmcsXG4gICAgICAgIG9wdGlvbnM6IHsgc2NvcGU/OiBzdHJpbmc7IGNvd29yaz86IGJvb2xlYW47IGtlZXBEYXRhPzogYm9vbGVhbiB9LFxuICAgICAgKSA9PiB7XG4gICAgICAgIGNvbnN0IHsgcGx1Z2luVW5pbnN0YWxsSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICcuL2NsaS9oYW5kbGVycy9wbHVnaW5zLmpzJ1xuICAgICAgICApXG4gICAgICAgIGF3YWl0IHBsdWdpblVuaW5zdGFsbEhhbmRsZXIocGx1Z2luLCBvcHRpb25zKVxuICAgICAgfSxcbiAgICApXG5cbiAgLy8gUGx1Z2luIGVuYWJsZSBjb21tYW5kXG4gIHBsdWdpbkNtZFxuICAgIC5jb21tYW5kKCdlbmFibGUgPHBsdWdpbj4nKVxuICAgIC5kZXNjcmlwdGlvbignRW5hYmxlIGEgZGlzYWJsZWQgcGx1Z2luJylcbiAgICAub3B0aW9uKFxuICAgICAgJy1zLCAtLXNjb3BlIDxzY29wZT4nLFxuICAgICAgYEluc3RhbGxhdGlvbiBzY29wZTogJHtWQUxJRF9JTlNUQUxMQUJMRV9TQ09QRVMuam9pbignLCAnKX0gKGRlZmF1bHQ6IGF1dG8tZGV0ZWN0KWAsXG4gICAgKVxuICAgIC5hZGRPcHRpb24oY293b3JrT3B0aW9uKCkpXG4gICAgLmFjdGlvbihcbiAgICAgIGFzeW5jIChwbHVnaW46IHN0cmluZywgb3B0aW9uczogeyBzY29wZT86IHN0cmluZzsgY293b3JrPzogYm9vbGVhbiB9KSA9PiB7XG4gICAgICAgIGNvbnN0IHsgcGx1Z2luRW5hYmxlSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICcuL2NsaS9oYW5kbGVycy9wbHVnaW5zLmpzJ1xuICAgICAgICApXG4gICAgICAgIGF3YWl0IHBsdWdpbkVuYWJsZUhhbmRsZXIocGx1Z2luLCBvcHRpb25zKVxuICAgICAgfSxcbiAgICApXG5cbiAgLy8gUGx1Z2luIGRpc2FibGUgY29tbWFuZFxuICBwbHVnaW5DbWRcbiAgICAuY29tbWFuZCgnZGlzYWJsZSBbcGx1Z2luXScpXG4gICAgLmRlc2NyaXB0aW9uKCdEaXNhYmxlIGFuIGVuYWJsZWQgcGx1Z2luJylcbiAgICAub3B0aW9uKCctYSwgLS1hbGwnLCAnRGlzYWJsZSBhbGwgZW5hYmxlZCBwbHVnaW5zJylcbiAgICAub3B0aW9uKFxuICAgICAgJy1zLCAtLXNjb3BlIDxzY29wZT4nLFxuICAgICAgYEluc3RhbGxhdGlvbiBzY29wZTogJHtWQUxJRF9JTlNUQUxMQUJMRV9TQ09QRVMuam9pbignLCAnKX0gKGRlZmF1bHQ6IGF1dG8tZGV0ZWN0KWAsXG4gICAgKVxuICAgIC5hZGRPcHRpb24oY293b3JrT3B0aW9uKCkpXG4gICAgLmFjdGlvbihcbiAgICAgIGFzeW5jIChcbiAgICAgICAgcGx1Z2luOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gICAgICAgIG9wdGlvbnM6IHsgc2NvcGU/OiBzdHJpbmc7IGNvd29yaz86IGJvb2xlYW47IGFsbD86IGJvb2xlYW4gfSxcbiAgICAgICkgPT4ge1xuICAgICAgICBjb25zdCB7IHBsdWdpbkRpc2FibGVIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICAgJy4vY2xpL2hhbmRsZXJzL3BsdWdpbnMuanMnXG4gICAgICAgIClcbiAgICAgICAgYXdhaXQgcGx1Z2luRGlzYWJsZUhhbmRsZXIocGx1Z2luLCBvcHRpb25zKVxuICAgICAgfSxcbiAgICApXG5cbiAgLy8gUGx1Z2luIHVwZGF0ZSBjb21tYW5kXG4gIHBsdWdpbkNtZFxuICAgIC5jb21tYW5kKCd1cGRhdGUgPHBsdWdpbj4nKVxuICAgIC5kZXNjcmlwdGlvbihcbiAgICAgICdVcGRhdGUgYSBwbHVnaW4gdG8gdGhlIGxhdGVzdCB2ZXJzaW9uIChyZXN0YXJ0IHJlcXVpcmVkIHRvIGFwcGx5KScsXG4gICAgKVxuICAgIC5vcHRpb24oXG4gICAgICAnLXMsIC0tc2NvcGUgPHNjb3BlPicsXG4gICAgICBgSW5zdGFsbGF0aW9uIHNjb3BlOiAke1ZBTElEX1VQREFURV9TQ09QRVMuam9pbignLCAnKX0gKGRlZmF1bHQ6IHVzZXIpYCxcbiAgICApXG4gICAgLmFkZE9wdGlvbihjb3dvcmtPcHRpb24oKSlcbiAgICAuYWN0aW9uKFxuICAgICAgYXN5bmMgKHBsdWdpbjogc3RyaW5nLCBvcHRpb25zOiB7IHNjb3BlPzogc3RyaW5nOyBjb3dvcms/OiBib29sZWFuIH0pID0+IHtcbiAgICAgICAgY29uc3QgeyBwbHVnaW5VcGRhdGVIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICAgJy4vY2xpL2hhbmRsZXJzL3BsdWdpbnMuanMnXG4gICAgICAgIClcbiAgICAgICAgYXdhaXQgcGx1Z2luVXBkYXRlSGFuZGxlcihwbHVnaW4sIG9wdGlvbnMpXG4gICAgICB9LFxuICAgIClcbiAgLy8gRU5EIEFOVC1PTkxZXG5cbiAgLy8gU2V0dXAgdG9rZW4gY29tbWFuZFxuICBwcm9ncmFtXG4gICAgLmNvbW1hbmQoJ3NldHVwLXRva2VuJylcbiAgICAuZGVzY3JpcHRpb24oXG4gICAgICAnU2V0IHVwIGEgbG9uZy1saXZlZCBhdXRoZW50aWNhdGlvbiB0b2tlbiAocmVxdWlyZXMgQ2xhdWRlIHN1YnNjcmlwdGlvbiknLFxuICAgIClcbiAgICAuYWN0aW9uKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IFt7IHNldHVwVG9rZW5IYW5kbGVyIH0sIHsgY3JlYXRlUm9vdCB9XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgaW1wb3J0KCcuL2NsaS9oYW5kbGVycy91dGlsLmpzJyksXG4gICAgICAgIGltcG9ydCgnLi9pbmsuanMnKSxcbiAgICAgIF0pXG4gICAgICBjb25zdCByb290ID0gYXdhaXQgY3JlYXRlUm9vdChnZXRCYXNlUmVuZGVyT3B0aW9ucyhmYWxzZSkpXG4gICAgICBhd2FpdCBzZXR1cFRva2VuSGFuZGxlcihyb290KVxuICAgIH0pXG5cbiAgLy8gQWdlbnRzIGNvbW1hbmQgLSBsaXN0IGNvbmZpZ3VyZWQgYWdlbnRzXG4gIHByb2dyYW1cbiAgICAuY29tbWFuZCgnYWdlbnRzJylcbiAgICAuZGVzY3JpcHRpb24oJ0xpc3QgY29uZmlndXJlZCBhZ2VudHMnKVxuICAgIC5vcHRpb24oXG4gICAgICAnLS1zZXR0aW5nLXNvdXJjZXMgPHNvdXJjZXM+JyxcbiAgICAgICdDb21tYS1zZXBhcmF0ZWQgbGlzdCBvZiBzZXR0aW5nIHNvdXJjZXMgdG8gbG9hZCAodXNlciwgcHJvamVjdCwgbG9jYWwpLicsXG4gICAgKVxuICAgIC5hY3Rpb24oYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgeyBhZ2VudHNIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoJy4vY2xpL2hhbmRsZXJzL2FnZW50cy5qcycpXG4gICAgICBhd2FpdCBhZ2VudHNIYW5kbGVyKClcbiAgICAgIHByb2Nlc3MuZXhpdCgwKVxuICAgIH0pXG5cbiAgaWYgKGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpKSB7XG4gICAgLy8gU2tpcCB3aGVuIHRlbmd1X2F1dG9fbW9kZV9jb25maWcuZW5hYmxlZCA9PT0gJ2Rpc2FibGVkJyAoY2lyY3VpdCBicmVha2VyKS5cbiAgICAvLyBSZWFkcyBmcm9tIGRpc2sgY2FjaGUg4oCUIEdyb3d0aEJvb2sgaXNuJ3QgaW5pdGlhbGl6ZWQgYXQgcmVnaXN0cmF0aW9uIHRpbWUuXG4gICAgaWYgKGdldEF1dG9Nb2RlRW5hYmxlZFN0YXRlSWZDYWNoZWQoKSAhPT0gJ2Rpc2FibGVkJykge1xuICAgICAgY29uc3QgYXV0b01vZGVDbWQgPSBwcm9ncmFtXG4gICAgICAgIC5jb21tYW5kKCdhdXRvLW1vZGUnKVxuICAgICAgICAuZGVzY3JpcHRpb24oJ0luc3BlY3QgYXV0byBtb2RlIGNsYXNzaWZpZXIgY29uZmlndXJhdGlvbicpXG5cbiAgICAgIGF1dG9Nb2RlQ21kXG4gICAgICAgIC5jb21tYW5kKCdkZWZhdWx0cycpXG4gICAgICAgIC5kZXNjcmlwdGlvbihcbiAgICAgICAgICAnUHJpbnQgdGhlIGRlZmF1bHQgYXV0byBtb2RlIGVudmlyb25tZW50LCBhbGxvdywgYW5kIGRlbnkgcnVsZXMgYXMgSlNPTicsXG4gICAgICAgIClcbiAgICAgICAgLmFjdGlvbihhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgeyBhdXRvTW9kZURlZmF1bHRzSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgJy4vY2xpL2hhbmRsZXJzL2F1dG9Nb2RlLmpzJ1xuICAgICAgICAgIClcbiAgICAgICAgICBhdXRvTW9kZURlZmF1bHRzSGFuZGxlcigpXG4gICAgICAgICAgcHJvY2Vzcy5leGl0KDApXG4gICAgICAgIH0pXG5cbiAgICAgIGF1dG9Nb2RlQ21kXG4gICAgICAgIC5jb21tYW5kKCdjb25maWcnKVxuICAgICAgICAuZGVzY3JpcHRpb24oXG4gICAgICAgICAgJ1ByaW50IHRoZSBlZmZlY3RpdmUgYXV0byBtb2RlIGNvbmZpZyBhcyBKU09OOiB5b3VyIHNldHRpbmdzIHdoZXJlIHNldCwgZGVmYXVsdHMgb3RoZXJ3aXNlJyxcbiAgICAgICAgKVxuICAgICAgICAuYWN0aW9uKGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCB7IGF1dG9Nb2RlQ29uZmlnSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgJy4vY2xpL2hhbmRsZXJzL2F1dG9Nb2RlLmpzJ1xuICAgICAgICAgIClcbiAgICAgICAgICBhdXRvTW9kZUNvbmZpZ0hhbmRsZXIoKVxuICAgICAgICAgIHByb2Nlc3MuZXhpdCgwKVxuICAgICAgICB9KVxuXG4gICAgICBhdXRvTW9kZUNtZFxuICAgICAgICAuY29tbWFuZCgnY3JpdGlxdWUnKVxuICAgICAgICAuZGVzY3JpcHRpb24oJ0dldCBBSSBmZWVkYmFjayBvbiB5b3VyIGN1c3RvbSBhdXRvIG1vZGUgcnVsZXMnKVxuICAgICAgICAub3B0aW9uKCctLW1vZGVsIDxtb2RlbD4nLCAnT3ZlcnJpZGUgd2hpY2ggbW9kZWwgaXMgdXNlZCcpXG4gICAgICAgIC5hY3Rpb24oYXN5bmMgb3B0aW9ucyA9PiB7XG4gICAgICAgICAgY29uc3QgeyBhdXRvTW9kZUNyaXRpcXVlSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICAgJy4vY2xpL2hhbmRsZXJzL2F1dG9Nb2RlLmpzJ1xuICAgICAgICAgIClcbiAgICAgICAgICBhd2FpdCBhdXRvTW9kZUNyaXRpcXVlSGFuZGxlcihvcHRpb25zKVxuICAgICAgICAgIHByb2Nlc3MuZXhpdCgpXG4gICAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgLy8gUmVtb3RlIENvbnRyb2wgY29tbWFuZCDigJQgY29ubmVjdCBsb2NhbCBlbnZpcm9ubWVudCB0byBjbGF1ZGUuYWkvY29kZS5cbiAgLy8gVGhlIGFjdHVhbCBjb21tYW5kIGlzIGludGVyY2VwdGVkIGJ5IHRoZSBmYXN0LXBhdGggaW4gY2xpLnRzeCBiZWZvcmVcbiAgLy8gQ29tbWFuZGVyLmpzIHJ1bnMsIHNvIHRoaXMgcmVnaXN0cmF0aW9uIGV4aXN0cyBvbmx5IGZvciBoZWxwIG91dHB1dC5cbiAgLy8gQWx3YXlzIGhpZGRlbjogaXNCcmlkZ2VFbmFibGVkKCkgYXQgdGhpcyBwb2ludCAoYmVmb3JlIGVuYWJsZUNvbmZpZ3MpXG4gIC8vIHdvdWxkIHRocm93IGluc2lkZSBpc0NsYXVkZUFJU3Vic2NyaWJlciDihpIgZ2V0R2xvYmFsQ29uZmlnIGFuZCByZXR1cm5cbiAgLy8gZmFsc2UgdmlhIHRoZSB0cnkvY2F0Y2gg4oCUIGJ1dCBub3QgYmVmb3JlIHBheWluZyB+NjVtcyBvZiBzaWRlIGVmZmVjdHNcbiAgLy8gKDI1bXMgc2V0dGluZ3MgWm9kIHBhcnNlICsgNDBtcyBzeW5jIGBzZWN1cml0eWAga2V5Y2hhaW4gc3VicHJvY2VzcykuXG4gIC8vIFRoZSBkeW5hbWljIHZpc2liaWxpdHkgbmV2ZXIgd29ya2VkOyB0aGUgY29tbWFuZCB3YXMgYWx3YXlzIGhpZGRlbi5cbiAgaWYgKGZlYXR1cmUoJ0JSSURHRV9NT0RFJykpIHtcbiAgICBwcm9ncmFtXG4gICAgICAuY29tbWFuZCgncmVtb3RlLWNvbnRyb2wnLCB7IGhpZGRlbjogdHJ1ZSB9KVxuICAgICAgLmFsaWFzKCdyYycpXG4gICAgICAuZGVzY3JpcHRpb24oXG4gICAgICAgICdDb25uZWN0IHlvdXIgbG9jYWwgZW52aXJvbm1lbnQgZm9yIHJlbW90ZS1jb250cm9sIHNlc3Npb25zIHZpYSBjbGF1ZGUuYWkvY29kZScsXG4gICAgICApXG4gICAgICAuYWN0aW9uKGFzeW5jICgpID0+IHtcbiAgICAgICAgLy8gVW5yZWFjaGFibGUg4oCUIGNsaS50c3ggZmFzdC1wYXRoIGhhbmRsZXMgdGhpcyBjb21tYW5kIGJlZm9yZSBtYWluLnRzeCBsb2Fkcy5cbiAgICAgICAgLy8gSWYgc29tZWhvdyByZWFjaGVkLCBkZWxlZ2F0ZSB0byBicmlkZ2VNYWluLlxuICAgICAgICBjb25zdCB7IGJyaWRnZU1haW4gfSA9IGF3YWl0IGltcG9ydCgnLi9icmlkZ2UvYnJpZGdlTWFpbi5qcycpXG4gICAgICAgIGF3YWl0IGJyaWRnZU1haW4ocHJvY2Vzcy5hcmd2LnNsaWNlKDMpKVxuICAgICAgfSlcbiAgfVxuXG4gIGlmIChmZWF0dXJlKCdLQUlST1MnKSkge1xuICAgIHByb2dyYW1cbiAgICAgIC5jb21tYW5kKCdhc3Npc3RhbnQgW3Nlc3Npb25JZF0nKVxuICAgICAgLmRlc2NyaXB0aW9uKFxuICAgICAgICAnQXR0YWNoIHRoZSBSRVBMIGFzIGEgY2xpZW50IHRvIGEgcnVubmluZyBicmlkZ2Ugc2Vzc2lvbi4gRGlzY292ZXJzIHNlc3Npb25zIHZpYSBBUEkgaWYgbm8gc2Vzc2lvbklkIGdpdmVuLicsXG4gICAgICApXG4gICAgICAuYWN0aW9uKCgpID0+IHtcbiAgICAgICAgLy8gQXJndiByZXdyaXRpbmcgYWJvdmUgc2hvdWxkIGhhdmUgY29uc3VtZWQgYGFzc2lzdGFudCBbaWRdYFxuICAgICAgICAvLyBiZWZvcmUgY29tbWFuZGVyIHJ1bnMuIFJlYWNoaW5nIGhlcmUgbWVhbnMgYSByb290IGZsYWcgY2FtZSBmaXJzdFxuICAgICAgICAvLyAoZS5nLiBgLS1kZWJ1ZyBhc3Npc3RhbnRgKSBhbmQgdGhlIHBvc2l0aW9uLTAgcHJlZGljYXRlXG4gICAgICAgIC8vIGRpZG4ndCBtYXRjaC4gUHJpbnQgdXNhZ2UgbGlrZSB0aGUgc3NoIHN0dWIgZG9lcy5cbiAgICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgICAgJ1VzYWdlOiBjbGF1ZGUgYXNzaXN0YW50IFtzZXNzaW9uSWRdXFxuXFxuJyArXG4gICAgICAgICAgICAnQXR0YWNoIHRoZSBSRVBMIGFzIGEgdmlld2VyIGNsaWVudCB0byBhIHJ1bm5pbmcgYnJpZGdlIHNlc3Npb24uXFxuJyArXG4gICAgICAgICAgICAnT21pdCBzZXNzaW9uSWQgdG8gZGlzY292ZXIgYW5kIHBpY2sgZnJvbSBhdmFpbGFibGUgc2Vzc2lvbnMuXFxuJyxcbiAgICAgICAgKVxuICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgIH0pXG4gIH1cblxuICAvLyBEb2N0b3IgY29tbWFuZCAtIGNoZWNrIGluc3RhbGxhdGlvbiBoZWFsdGhcbiAgcHJvZ3JhbVxuICAgIC5jb21tYW5kKCdkb2N0b3InKVxuICAgIC5kZXNjcmlwdGlvbihcbiAgICAgICdDaGVjayB0aGUgaGVhbHRoIG9mIHlvdXIgQ2xhdWRlIENvZGUgYXV0by11cGRhdGVyLiBOb3RlOiBUaGUgd29ya3NwYWNlIHRydXN0IGRpYWxvZyBpcyBza2lwcGVkIGFuZCBzdGRpbyBzZXJ2ZXJzIGZyb20gLm1jcC5qc29uIGFyZSBzcGF3bmVkIGZvciBoZWFsdGggY2hlY2tzLiBPbmx5IHVzZSB0aGlzIGNvbW1hbmQgaW4gZGlyZWN0b3JpZXMgeW91IHRydXN0LicsXG4gICAgKVxuICAgIC5hY3Rpb24oYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgW3sgZG9jdG9ySGFuZGxlciB9LCB7IGNyZWF0ZVJvb3QgfV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvdXRpbC5qcycpLFxuICAgICAgICBpbXBvcnQoJy4vaW5rLmpzJyksXG4gICAgICBdKVxuICAgICAgY29uc3Qgcm9vdCA9IGF3YWl0IGNyZWF0ZVJvb3QoZ2V0QmFzZVJlbmRlck9wdGlvbnMoZmFsc2UpKVxuICAgICAgYXdhaXQgZG9jdG9ySGFuZGxlcihyb290KVxuICAgIH0pXG5cbiAgLy8gY2xhdWRlIHVwZGF0ZVxuICAvL1xuICAvLyBGb3IgU2VtVmVyLWNvbXBsaWFudCB2ZXJzaW9uaW5nIHdpdGggYnVpbGQgbWV0YWRhdGEgKFguWC5YK1NIQSk6XG4gIC8vIC0gV2UgcGVyZm9ybSBleGFjdCBzdHJpbmcgY29tcGFyaXNvbiAoaW5jbHVkaW5nIFNIQSkgdG8gZGV0ZWN0IGFueSBjaGFuZ2VcbiAgLy8gLSBUaGlzIGVuc3VyZXMgdXNlcnMgYWx3YXlzIGdldCB0aGUgbGF0ZXN0IGJ1aWxkLCBldmVuIHdoZW4gb25seSB0aGUgU0hBIGNoYW5nZXNcbiAgLy8gLSBVSSBzaG93cyBib3RoIHZlcnNpb25zIGluY2x1ZGluZyBidWlsZCBtZXRhZGF0YSBmb3IgY2xhcml0eVxuICBwcm9ncmFtXG4gICAgLmNvbW1hbmQoJ3VwZGF0ZScpXG4gICAgLmFsaWFzKCd1cGdyYWRlJylcbiAgICAuZGVzY3JpcHRpb24oJ0NoZWNrIGZvciB1cGRhdGVzIGFuZCBpbnN0YWxsIGlmIGF2YWlsYWJsZScpXG4gICAgLmFjdGlvbihhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB7IHVwZGF0ZSB9ID0gYXdhaXQgaW1wb3J0KCdzcmMvY2xpL3VwZGF0ZS5qcycpXG4gICAgICBhd2FpdCB1cGRhdGUoKVxuICAgIH0pXG5cbiAgLy8gY2xhdWRlIHVwIOKAlCBydW4gdGhlIHByb2plY3QncyBDTEFVREUubWQgXCIjIGNsYXVkZSB1cFwiIHNldHVwIGluc3RydWN0aW9ucy5cbiAgaWYgKFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcpIHtcbiAgICBwcm9ncmFtXG4gICAgICAuY29tbWFuZCgndXAnKVxuICAgICAgLmRlc2NyaXB0aW9uKFxuICAgICAgICAnW0FOVC1PTkxZXSBJbml0aWFsaXplIG9yIHVwZ3JhZGUgdGhlIGxvY2FsIGRldiBlbnZpcm9ubWVudCB1c2luZyB0aGUgXCIjIGNsYXVkZSB1cFwiIHNlY3Rpb24gb2YgdGhlIG5lYXJlc3QgQ0xBVURFLm1kJyxcbiAgICAgIClcbiAgICAgIC5hY3Rpb24oYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCB7IHVwIH0gPSBhd2FpdCBpbXBvcnQoJ3NyYy9jbGkvdXAuanMnKVxuICAgICAgICBhd2FpdCB1cCgpXG4gICAgICB9KVxuICB9XG5cbiAgLy8gY2xhdWRlIHJvbGxiYWNrIChhbnQtb25seSlcbiAgLy8gUm9sbHMgYmFjayB0byBwcmV2aW91cyByZWxlYXNlc1xuICBpZiAoXCJleHRlcm5hbFwiID09PSAnYW50Jykge1xuICAgIHByb2dyYW1cbiAgICAgIC5jb21tYW5kKCdyb2xsYmFjayBbdGFyZ2V0XScpXG4gICAgICAuZGVzY3JpcHRpb24oXG4gICAgICAgICdbQU5ULU9OTFldIFJvbGwgYmFjayB0byBhIHByZXZpb3VzIHJlbGVhc2VcXG5cXG5FeGFtcGxlczpcXG4gIGNsYXVkZSByb2xsYmFjayAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEdvIDEgdmVyc2lvbiBiYWNrIGZyb20gY3VycmVudFxcbiAgY2xhdWRlIHJvbGxiYWNrIDMgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgR28gMyB2ZXJzaW9ucyBiYWNrIGZyb20gY3VycmVudFxcbiAgY2xhdWRlIHJvbGxiYWNrIDIuMC43My1kZXYuMjAyNTEyMTcudDE5MDY1OCAgICAgICAgUm9sbCBiYWNrIHRvIGEgc3BlY2lmaWMgdmVyc2lvbicsXG4gICAgICApXG4gICAgICAub3B0aW9uKCctbCwgLS1saXN0JywgJ0xpc3QgcmVjZW50IHB1Ymxpc2hlZCB2ZXJzaW9ucyB3aXRoIGFnZXMnKVxuICAgICAgLm9wdGlvbignLS1kcnktcnVuJywgJ1Nob3cgd2hhdCB3b3VsZCBiZSBpbnN0YWxsZWQgd2l0aG91dCBpbnN0YWxsaW5nJylcbiAgICAgIC5vcHRpb24oXG4gICAgICAgICctLXNhZmUnLFxuICAgICAgICAnUm9sbCBiYWNrIHRvIHRoZSBzZXJ2ZXItcGlubmVkIHNhZmUgdmVyc2lvbiAoc2V0IGJ5IG9uY2FsbCBkdXJpbmcgaW5jaWRlbnRzKScsXG4gICAgICApXG4gICAgICAuYWN0aW9uKFxuICAgICAgICBhc3luYyAoXG4gICAgICAgICAgdGFyZ2V0Pzogc3RyaW5nLFxuICAgICAgICAgIG9wdGlvbnM/OiB7IGxpc3Q/OiBib29sZWFuOyBkcnlSdW4/OiBib29sZWFuOyBzYWZlPzogYm9vbGVhbiB9LFxuICAgICAgICApID0+IHtcbiAgICAgICAgICBjb25zdCB7IHJvbGxiYWNrIH0gPSBhd2FpdCBpbXBvcnQoJ3NyYy9jbGkvcm9sbGJhY2suanMnKVxuICAgICAgICAgIGF3YWl0IHJvbGxiYWNrKHRhcmdldCwgb3B0aW9ucylcbiAgICAgICAgfSxcbiAgICAgIClcbiAgfVxuXG4gIC8vIGNsYXVkZSBpbnN0YWxsXG4gIHByb2dyYW1cbiAgICAuY29tbWFuZCgnaW5zdGFsbCBbdGFyZ2V0XScpXG4gICAgLmRlc2NyaXB0aW9uKFxuICAgICAgJ0luc3RhbGwgQ2xhdWRlIENvZGUgbmF0aXZlIGJ1aWxkLiBVc2UgW3RhcmdldF0gdG8gc3BlY2lmeSB2ZXJzaW9uIChzdGFibGUsIGxhdGVzdCwgb3Igc3BlY2lmaWMgdmVyc2lvbiknLFxuICAgIClcbiAgICAub3B0aW9uKCctLWZvcmNlJywgJ0ZvcmNlIGluc3RhbGxhdGlvbiBldmVuIGlmIGFscmVhZHkgaW5zdGFsbGVkJylcbiAgICAuYWN0aW9uKFxuICAgICAgYXN5bmMgKHRhcmdldDogc3RyaW5nIHwgdW5kZWZpbmVkLCBvcHRpb25zOiB7IGZvcmNlPzogYm9vbGVhbiB9KSA9PiB7XG4gICAgICAgIGNvbnN0IHsgaW5zdGFsbEhhbmRsZXIgfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvdXRpbC5qcycpXG4gICAgICAgIGF3YWl0IGluc3RhbGxIYW5kbGVyKHRhcmdldCwgb3B0aW9ucylcbiAgICAgIH0sXG4gICAgKVxuXG4gIC8vIGFudC1vbmx5IGNvbW1hbmRzXG4gIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnKSB7XG4gICAgY29uc3QgdmFsaWRhdGVMb2dJZCA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgICBjb25zdCBtYXliZVNlc3Npb25JZCA9IHZhbGlkYXRlVXVpZCh2YWx1ZSlcbiAgICAgIGlmIChtYXliZVNlc3Npb25JZCkgcmV0dXJuIG1heWJlU2Vzc2lvbklkXG4gICAgICByZXR1cm4gTnVtYmVyKHZhbHVlKVxuICAgIH1cbiAgICAvLyBjbGF1ZGUgbG9nXG4gICAgcHJvZ3JhbVxuICAgICAgLmNvbW1hbmQoJ2xvZycpXG4gICAgICAuZGVzY3JpcHRpb24oJ1tBTlQtT05MWV0gTWFuYWdlIGNvbnZlcnNhdGlvbiBsb2dzLicpXG4gICAgICAuYXJndW1lbnQoXG4gICAgICAgICdbbnVtYmVyfHNlc3Npb25JZF0nLFxuICAgICAgICAnQSBudW1iZXIgKDAsIDEsIDIsIGV0Yy4pIHRvIGRpc3BsYXkgYSBzcGVjaWZpYyBsb2csIG9yIHRoZSBzZXNzc2lvbiBJRCAodXVpZCkgb2YgYSBsb2cnLFxuICAgICAgICB2YWxpZGF0ZUxvZ0lkLFxuICAgICAgKVxuICAgICAgLmFjdGlvbihhc3luYyAobG9nSWQ6IHN0cmluZyB8IG51bWJlciB8IHVuZGVmaW5lZCkgPT4ge1xuICAgICAgICBjb25zdCB7IGxvZ0hhbmRsZXIgfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvYW50LmpzJylcbiAgICAgICAgYXdhaXQgbG9nSGFuZGxlcihsb2dJZClcbiAgICAgIH0pXG5cbiAgICAvLyBjbGF1ZGUgZXJyb3JcbiAgICBwcm9ncmFtXG4gICAgICAuY29tbWFuZCgnZXJyb3InKVxuICAgICAgLmRlc2NyaXB0aW9uKFxuICAgICAgICAnW0FOVC1PTkxZXSBWaWV3IGVycm9yIGxvZ3MuIE9wdGlvbmFsbHkgcHJvdmlkZSBhIG51bWJlciAoMCwgLTEsIC0yLCBldGMuKSB0byBkaXNwbGF5IGEgc3BlY2lmaWMgbG9nLicsXG4gICAgICApXG4gICAgICAuYXJndW1lbnQoXG4gICAgICAgICdbbnVtYmVyXScsXG4gICAgICAgICdBIG51bWJlciAoMCwgMSwgMiwgZXRjLikgdG8gZGlzcGxheSBhIHNwZWNpZmljIGxvZycsXG4gICAgICAgIHBhcnNlSW50LFxuICAgICAgKVxuICAgICAgLmFjdGlvbihhc3luYyAobnVtYmVyOiBudW1iZXIgfCB1bmRlZmluZWQpID0+IHtcbiAgICAgICAgY29uc3QgeyBlcnJvckhhbmRsZXIgfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvYW50LmpzJylcbiAgICAgICAgYXdhaXQgZXJyb3JIYW5kbGVyKG51bWJlcilcbiAgICAgIH0pXG5cbiAgICAvLyBjbGF1ZGUgZXhwb3J0XG4gICAgcHJvZ3JhbVxuICAgICAgLmNvbW1hbmQoJ2V4cG9ydCcpXG4gICAgICAuZGVzY3JpcHRpb24oJ1tBTlQtT05MWV0gRXhwb3J0IGEgY29udmVyc2F0aW9uIHRvIGEgdGV4dCBmaWxlLicpXG4gICAgICAudXNhZ2UoJzxzb3VyY2U+IDxvdXRwdXRGaWxlPicpXG4gICAgICAuYXJndW1lbnQoXG4gICAgICAgICc8c291cmNlPicsXG4gICAgICAgICdTZXNzaW9uIElELCBsb2cgaW5kZXggKDAsIDEsIDIuLi4pLCBvciBwYXRoIHRvIGEgLmpzb24vLmpzb25sIGxvZyBmaWxlJyxcbiAgICAgIClcbiAgICAgIC5hcmd1bWVudCgnPG91dHB1dEZpbGU+JywgJ091dHB1dCBmaWxlIHBhdGggZm9yIHRoZSBleHBvcnRlZCB0ZXh0JylcbiAgICAgIC5hZGRIZWxwVGV4dChcbiAgICAgICAgJ2FmdGVyJyxcbiAgICAgICAgYFxuRXhhbXBsZXM6XG4gICQgY2xhdWRlIGV4cG9ydCAwIGNvbnZlcnNhdGlvbi50eHQgICAgICAgICAgICAgICAgRXhwb3J0IGNvbnZlcnNhdGlvbiBhdCBsb2cgaW5kZXggMFxuICAkIGNsYXVkZSBleHBvcnQgPHV1aWQ+IGNvbnZlcnNhdGlvbi50eHQgICAgICAgICAgIEV4cG9ydCBjb252ZXJzYXRpb24gYnkgc2Vzc2lvbiBJRFxuICAkIGNsYXVkZSBleHBvcnQgaW5wdXQuanNvbiBvdXRwdXQudHh0ICAgICAgICAgICAgIFJlbmRlciBKU09OIGxvZyBmaWxlIHRvIHRleHRcbiAgJCBjbGF1ZGUgZXhwb3J0IDx1dWlkPi5qc29ubCBvdXRwdXQudHh0ICAgICAgICAgICBSZW5kZXIgSlNPTkwgc2Vzc2lvbiBmaWxlIHRvIHRleHRgLFxuICAgICAgKVxuICAgICAgLmFjdGlvbihhc3luYyAoc291cmNlOiBzdHJpbmcsIG91dHB1dEZpbGU6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCB7IGV4cG9ydEhhbmRsZXIgfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvYW50LmpzJylcbiAgICAgICAgYXdhaXQgZXhwb3J0SGFuZGxlcihzb3VyY2UsIG91dHB1dEZpbGUpXG4gICAgICB9KVxuXG4gICAgaWYgKFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcpIHtcbiAgICAgIGNvbnN0IHRhc2tDbWQgPSBwcm9ncmFtXG4gICAgICAgIC5jb21tYW5kKCd0YXNrJylcbiAgICAgICAgLmRlc2NyaXB0aW9uKCdbQU5ULU9OTFldIE1hbmFnZSB0YXNrIGxpc3QgdGFza3MnKVxuXG4gICAgICB0YXNrQ21kXG4gICAgICAgIC5jb21tYW5kKCdjcmVhdGUgPHN1YmplY3Q+JylcbiAgICAgICAgLmRlc2NyaXB0aW9uKCdDcmVhdGUgYSBuZXcgdGFzaycpXG4gICAgICAgIC5vcHRpb24oJy1kLCAtLWRlc2NyaXB0aW9uIDx0ZXh0PicsICdUYXNrIGRlc2NyaXB0aW9uJylcbiAgICAgICAgLm9wdGlvbignLWwsIC0tbGlzdCA8aWQ+JywgJ1Rhc2sgbGlzdCBJRCAoZGVmYXVsdHMgdG8gXCJ0YXNrbGlzdFwiKScpXG4gICAgICAgIC5hY3Rpb24oXG4gICAgICAgICAgYXN5bmMgKFxuICAgICAgICAgICAgc3ViamVjdDogc3RyaW5nLFxuICAgICAgICAgICAgb3B0czogeyBkZXNjcmlwdGlvbj86IHN0cmluZzsgbGlzdD86IHN0cmluZyB9LFxuICAgICAgICAgICkgPT4ge1xuICAgICAgICAgICAgY29uc3QgeyB0YXNrQ3JlYXRlSGFuZGxlciB9ID0gYXdhaXQgaW1wb3J0KCcuL2NsaS9oYW5kbGVycy9hbnQuanMnKVxuICAgICAgICAgICAgYXdhaXQgdGFza0NyZWF0ZUhhbmRsZXIoc3ViamVjdCwgb3B0cylcbiAgICAgICAgICB9LFxuICAgICAgICApXG5cbiAgICAgIHRhc2tDbWRcbiAgICAgICAgLmNvbW1hbmQoJ2xpc3QnKVxuICAgICAgICAuZGVzY3JpcHRpb24oJ0xpc3QgYWxsIHRhc2tzJylcbiAgICAgICAgLm9wdGlvbignLWwsIC0tbGlzdCA8aWQ+JywgJ1Rhc2sgbGlzdCBJRCAoZGVmYXVsdHMgdG8gXCJ0YXNrbGlzdFwiKScpXG4gICAgICAgIC5vcHRpb24oJy0tcGVuZGluZycsICdTaG93IG9ubHkgcGVuZGluZyB0YXNrcycpXG4gICAgICAgIC5vcHRpb24oJy0tanNvbicsICdPdXRwdXQgYXMgSlNPTicpXG4gICAgICAgIC5hY3Rpb24oXG4gICAgICAgICAgYXN5bmMgKG9wdHM6IHtcbiAgICAgICAgICAgIGxpc3Q/OiBzdHJpbmdcbiAgICAgICAgICAgIHBlbmRpbmc/OiBib29sZWFuXG4gICAgICAgICAgICBqc29uPzogYm9vbGVhblxuICAgICAgICAgIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHsgdGFza0xpc3RIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoJy4vY2xpL2hhbmRsZXJzL2FudC5qcycpXG4gICAgICAgICAgICBhd2FpdCB0YXNrTGlzdEhhbmRsZXIob3B0cylcbiAgICAgICAgICB9LFxuICAgICAgICApXG5cbiAgICAgIHRhc2tDbWRcbiAgICAgICAgLmNvbW1hbmQoJ2dldCA8aWQ+JylcbiAgICAgICAgLmRlc2NyaXB0aW9uKCdHZXQgZGV0YWlscyBvZiBhIHRhc2snKVxuICAgICAgICAub3B0aW9uKCctbCwgLS1saXN0IDxpZD4nLCAnVGFzayBsaXN0IElEIChkZWZhdWx0cyB0byBcInRhc2tsaXN0XCIpJylcbiAgICAgICAgLmFjdGlvbihhc3luYyAoaWQ6IHN0cmluZywgb3B0czogeyBsaXN0Pzogc3RyaW5nIH0pID0+IHtcbiAgICAgICAgICBjb25zdCB7IHRhc2tHZXRIYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoJy4vY2xpL2hhbmRsZXJzL2FudC5qcycpXG4gICAgICAgICAgYXdhaXQgdGFza0dldEhhbmRsZXIoaWQsIG9wdHMpXG4gICAgICAgIH0pXG5cbiAgICAgIHRhc2tDbWRcbiAgICAgICAgLmNvbW1hbmQoJ3VwZGF0ZSA8aWQ+JylcbiAgICAgICAgLmRlc2NyaXB0aW9uKCdVcGRhdGUgYSB0YXNrJylcbiAgICAgICAgLm9wdGlvbignLWwsIC0tbGlzdCA8aWQ+JywgJ1Rhc2sgbGlzdCBJRCAoZGVmYXVsdHMgdG8gXCJ0YXNrbGlzdFwiKScpXG4gICAgICAgIC5vcHRpb24oXG4gICAgICAgICAgJy1zLCAtLXN0YXR1cyA8c3RhdHVzPicsXG4gICAgICAgICAgYFNldCBzdGF0dXMgKCR7VEFTS19TVEFUVVNFUy5qb2luKCcsICcpfSlgLFxuICAgICAgICApXG4gICAgICAgIC5vcHRpb24oJy0tc3ViamVjdCA8dGV4dD4nLCAnVXBkYXRlIHN1YmplY3QnKVxuICAgICAgICAub3B0aW9uKCctZCwgLS1kZXNjcmlwdGlvbiA8dGV4dD4nLCAnVXBkYXRlIGRlc2NyaXB0aW9uJylcbiAgICAgICAgLm9wdGlvbignLS1vd25lciA8YWdlbnRJZD4nLCAnU2V0IG93bmVyJylcbiAgICAgICAgLm9wdGlvbignLS1jbGVhci1vd25lcicsICdDbGVhciBvd25lcicpXG4gICAgICAgIC5hY3Rpb24oXG4gICAgICAgICAgYXN5bmMgKFxuICAgICAgICAgICAgaWQ6IHN0cmluZyxcbiAgICAgICAgICAgIG9wdHM6IHtcbiAgICAgICAgICAgICAgbGlzdD86IHN0cmluZ1xuICAgICAgICAgICAgICBzdGF0dXM/OiBzdHJpbmdcbiAgICAgICAgICAgICAgc3ViamVjdD86IHN0cmluZ1xuICAgICAgICAgICAgICBkZXNjcmlwdGlvbj86IHN0cmluZ1xuICAgICAgICAgICAgICBvd25lcj86IHN0cmluZ1xuICAgICAgICAgICAgICBjbGVhck93bmVyPzogYm9vbGVhblxuICAgICAgICAgICAgfSxcbiAgICAgICAgICApID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHsgdGFza1VwZGF0ZUhhbmRsZXIgfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvYW50LmpzJylcbiAgICAgICAgICAgIGF3YWl0IHRhc2tVcGRhdGVIYW5kbGVyKGlkLCBvcHRzKVxuICAgICAgICAgIH0sXG4gICAgICAgIClcblxuICAgICAgdGFza0NtZFxuICAgICAgICAuY29tbWFuZCgnZGlyJylcbiAgICAgICAgLmRlc2NyaXB0aW9uKCdTaG93IHRoZSB0YXNrcyBkaXJlY3RvcnkgcGF0aCcpXG4gICAgICAgIC5vcHRpb24oJy1sLCAtLWxpc3QgPGlkPicsICdUYXNrIGxpc3QgSUQgKGRlZmF1bHRzIHRvIFwidGFza2xpc3RcIiknKVxuICAgICAgICAuYWN0aW9uKGFzeW5jIChvcHRzOiB7IGxpc3Q/OiBzdHJpbmcgfSkgPT4ge1xuICAgICAgICAgIGNvbnN0IHsgdGFza0RpckhhbmRsZXIgfSA9IGF3YWl0IGltcG9ydCgnLi9jbGkvaGFuZGxlcnMvYW50LmpzJylcbiAgICAgICAgICBhd2FpdCB0YXNrRGlySGFuZGxlcihvcHRzKVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIC8vIGNsYXVkZSBjb21wbGV0aW9uIDxzaGVsbD5cbiAgICBwcm9ncmFtXG4gICAgICAuY29tbWFuZCgnY29tcGxldGlvbiA8c2hlbGw+JywgeyBoaWRkZW46IHRydWUgfSlcbiAgICAgIC5kZXNjcmlwdGlvbignR2VuZXJhdGUgc2hlbGwgY29tcGxldGlvbiBzY3JpcHQgKGJhc2gsIHpzaCwgb3IgZmlzaCknKVxuICAgICAgLm9wdGlvbihcbiAgICAgICAgJy0tb3V0cHV0IDxmaWxlPicsXG4gICAgICAgICdXcml0ZSBjb21wbGV0aW9uIHNjcmlwdCBkaXJlY3RseSB0byBhIGZpbGUgaW5zdGVhZCBvZiBzdGRvdXQnLFxuICAgICAgKVxuICAgICAgLmFjdGlvbihhc3luYyAoc2hlbGw6IHN0cmluZywgb3B0czogeyBvdXRwdXQ/OiBzdHJpbmcgfSkgPT4ge1xuICAgICAgICBjb25zdCB7IGNvbXBsZXRpb25IYW5kbGVyIH0gPSBhd2FpdCBpbXBvcnQoJy4vY2xpL2hhbmRsZXJzL2FudC5qcycpXG4gICAgICAgIGF3YWl0IGNvbXBsZXRpb25IYW5kbGVyKHNoZWxsLCBvcHRzLCBwcm9ncmFtKVxuICAgICAgfSlcbiAgfVxuXG4gIHByb2ZpbGVDaGVja3BvaW50KCdydW5fYmVmb3JlX3BhcnNlJylcbiAgYXdhaXQgcHJvZ3JhbS5wYXJzZUFzeW5jKHByb2Nlc3MuYXJndilcbiAgcHJvZmlsZUNoZWNrcG9pbnQoJ3J1bl9hZnRlcl9wYXJzZScpXG5cbiAgLy8gUmVjb3JkIGZpbmFsIGNoZWNrcG9pbnQgZm9yIHRvdGFsX3RpbWUgY2FsY3VsYXRpb25cbiAgcHJvZmlsZUNoZWNrcG9pbnQoJ21haW5fYWZ0ZXJfcnVuJylcblxuICAvLyBMb2cgc3RhcnR1cCBwZXJmIHRvIFN0YXRzaWcgKHNhbXBsZWQpIGFuZCBvdXRwdXQgZGV0YWlsZWQgcmVwb3J0IGlmIGVuYWJsZWRcbiAgcHJvZmlsZVJlcG9ydCgpXG5cbiAgcmV0dXJuIHByb2dyYW1cbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9nVGVuZ3VJbml0KHtcbiAgaGFzSW5pdGlhbFByb21wdCxcbiAgaGFzU3RkaW4sXG4gIHZlcmJvc2UsXG4gIGRlYnVnLFxuICBkZWJ1Z1RvU3RkZXJyLFxuICBwcmludCxcbiAgb3V0cHV0Rm9ybWF0LFxuICBpbnB1dEZvcm1hdCxcbiAgbnVtQWxsb3dlZFRvb2xzLFxuICBudW1EaXNhbGxvd2VkVG9vbHMsXG4gIG1jcENsaWVudENvdW50LFxuICB3b3JrdHJlZUVuYWJsZWQsXG4gIHNraXBXZWJGZXRjaFByZWZsaWdodCxcbiAgZ2l0aHViQWN0aW9uSW5wdXRzLFxuICBkYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uc1Bhc3NlZCxcbiAgcGVybWlzc2lvbk1vZGUsXG4gIG1vZGVJc0J5cGFzcyxcbiAgYWxsb3dEYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uc1Bhc3NlZCxcbiAgc3lzdGVtUHJvbXB0RmxhZyxcbiAgYXBwZW5kU3lzdGVtUHJvbXB0RmxhZyxcbiAgdGhpbmtpbmdDb25maWcsXG4gIGFzc2lzdGFudEFjdGl2YXRpb25QYXRoLFxufToge1xuICBoYXNJbml0aWFsUHJvbXB0OiBib29sZWFuXG4gIGhhc1N0ZGluOiBib29sZWFuXG4gIHZlcmJvc2U6IGJvb2xlYW5cbiAgZGVidWc6IGJvb2xlYW5cbiAgZGVidWdUb1N0ZGVycjogYm9vbGVhblxuICBwcmludDogYm9vbGVhblxuICBvdXRwdXRGb3JtYXQ6IHN0cmluZ1xuICBpbnB1dEZvcm1hdDogc3RyaW5nXG4gIG51bUFsbG93ZWRUb29sczogbnVtYmVyXG4gIG51bURpc2FsbG93ZWRUb29sczogbnVtYmVyXG4gIG1jcENsaWVudENvdW50OiBudW1iZXJcbiAgd29ya3RyZWVFbmFibGVkOiBib29sZWFuXG4gIHNraXBXZWJGZXRjaFByZWZsaWdodDogYm9vbGVhbiB8IHVuZGVmaW5lZFxuICBnaXRodWJBY3Rpb25JbnB1dHM6IHN0cmluZyB8IHVuZGVmaW5lZFxuICBkYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uc1Bhc3NlZDogYm9vbGVhblxuICBwZXJtaXNzaW9uTW9kZTogc3RyaW5nXG4gIG1vZGVJc0J5cGFzczogYm9vbGVhblxuICBhbGxvd0Rhbmdlcm91c2x5U2tpcFBlcm1pc3Npb25zUGFzc2VkOiBib29sZWFuXG4gIHN5c3RlbVByb21wdEZsYWc6ICdmaWxlJyB8ICdmbGFnJyB8IHVuZGVmaW5lZFxuICBhcHBlbmRTeXN0ZW1Qcm9tcHRGbGFnOiAnZmlsZScgfCAnZmxhZycgfCB1bmRlZmluZWRcbiAgdGhpbmtpbmdDb25maWc6IFRoaW5raW5nQ29uZmlnXG4gIGFzc2lzdGFudEFjdGl2YXRpb25QYXRoOiBzdHJpbmcgfCB1bmRlZmluZWRcbn0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBsb2dFdmVudCgndGVuZ3VfaW5pdCcsIHtcbiAgICAgIGVudHJ5cG9pbnQ6XG4gICAgICAgICdjbGF1ZGUnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICBoYXNJbml0aWFsUHJvbXB0LFxuICAgICAgaGFzU3RkaW4sXG4gICAgICB2ZXJib3NlLFxuICAgICAgZGVidWcsXG4gICAgICBkZWJ1Z1RvU3RkZXJyLFxuICAgICAgcHJpbnQsXG4gICAgICBvdXRwdXRGb3JtYXQ6XG4gICAgICAgIG91dHB1dEZvcm1hdCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgaW5wdXRGb3JtYXQ6XG4gICAgICAgIGlucHV0Rm9ybWF0IGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICBudW1BbGxvd2VkVG9vbHMsXG4gICAgICBudW1EaXNhbGxvd2VkVG9vbHMsXG4gICAgICBtY3BDbGllbnRDb3VudCxcbiAgICAgIHdvcmt0cmVlOiB3b3JrdHJlZUVuYWJsZWQsXG4gICAgICBza2lwV2ViRmV0Y2hQcmVmbGlnaHQsXG4gICAgICAuLi4oZ2l0aHViQWN0aW9uSW5wdXRzICYmIHtcbiAgICAgICAgZ2l0aHViQWN0aW9uSW5wdXRzOlxuICAgICAgICAgIGdpdGh1YkFjdGlvbklucHV0cyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSksXG4gICAgICBkYW5nZXJvdXNseVNraXBQZXJtaXNzaW9uc1Bhc3NlZCxcbiAgICAgIHBlcm1pc3Npb25Nb2RlOlxuICAgICAgICBwZXJtaXNzaW9uTW9kZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgbW9kZUlzQnlwYXNzLFxuICAgICAgaW5Qcm90ZWN0ZWROYW1lc3BhY2U6IGlzSW5Qcm90ZWN0ZWROYW1lc3BhY2UoKSxcbiAgICAgIGFsbG93RGFuZ2Vyb3VzbHlTa2lwUGVybWlzc2lvbnNQYXNzZWQsXG4gICAgICB0aGlua2luZ1R5cGU6XG4gICAgICAgIHRoaW5raW5nQ29uZmlnLnR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIC4uLihzeXN0ZW1Qcm9tcHRGbGFnICYmIHtcbiAgICAgICAgc3lzdGVtUHJvbXB0RmxhZzpcbiAgICAgICAgICBzeXN0ZW1Qcm9tcHRGbGFnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KSxcbiAgICAgIC4uLihhcHBlbmRTeXN0ZW1Qcm9tcHRGbGFnICYmIHtcbiAgICAgICAgYXBwZW5kU3lzdGVtUHJvbXB0RmxhZzpcbiAgICAgICAgICBhcHBlbmRTeXN0ZW1Qcm9tcHRGbGFnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KSxcbiAgICAgIGlzX3NpbXBsZTogaXNCYXJlTW9kZSgpIHx8IHVuZGVmaW5lZCxcbiAgICAgIGlzX2Nvb3JkaW5hdG9yOlxuICAgICAgICBmZWF0dXJlKCdDT09SRElOQVRPUl9NT0RFJykgJiZcbiAgICAgICAgY29vcmRpbmF0b3JNb2RlTW9kdWxlPy5pc0Nvb3JkaW5hdG9yTW9kZSgpXG4gICAgICAgICAgPyB0cnVlXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAuLi4oYXNzaXN0YW50QWN0aXZhdGlvblBhdGggJiYge1xuICAgICAgICBhc3Npc3RhbnRBY3RpdmF0aW9uUGF0aDpcbiAgICAgICAgICBhc3Npc3RhbnRBY3RpdmF0aW9uUGF0aCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSksXG4gICAgICBhdXRvVXBkYXRlc0NoYW5uZWw6IChnZXRJbml0aWFsU2V0dGluZ3MoKS5hdXRvVXBkYXRlc0NoYW5uZWwgPz9cbiAgICAgICAgJ2xhdGVzdCcpIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAuLi4oXCJleHRlcm5hbFwiID09PSAnYW50J1xuICAgICAgICA/ICgoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjd2QgPSBnZXRDd2QoKVxuICAgICAgICAgICAgY29uc3QgZ2l0Um9vdCA9IGZpbmRHaXRSb290KGN3ZClcbiAgICAgICAgICAgIGNvbnN0IHJwID0gZ2l0Um9vdCA/IHJlbGF0aXZlKGdpdFJvb3QsIGN3ZCkgfHwgJy4nIDogdW5kZWZpbmVkXG4gICAgICAgICAgICByZXR1cm4gcnBcbiAgICAgICAgICAgICAgPyB7XG4gICAgICAgICAgICAgICAgICByZWxhdGl2ZVByb2plY3RQYXRoOlxuICAgICAgICAgICAgICAgICAgICBycCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgOiB7fVxuICAgICAgICAgIH0pKClcbiAgICAgICAgOiB7fSksXG4gICAgfSlcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dFcnJvcihlcnJvcilcbiAgfVxufVxuXG5mdW5jdGlvbiBtYXliZUFjdGl2YXRlUHJvYWN0aXZlKG9wdGlvbnM6IHVua25vd24pOiB2b2lkIHtcbiAgaWYgKFxuICAgIChmZWF0dXJlKCdQUk9BQ1RJVkUnKSB8fCBmZWF0dXJlKCdLQUlST1MnKSkgJiZcbiAgICAoKG9wdGlvbnMgYXMgeyBwcm9hY3RpdmU/OiBib29sZWFuIH0pLnByb2FjdGl2ZSB8fFxuICAgICAgaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfUFJPQUNUSVZFKSlcbiAgKSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHNcbiAgICBjb25zdCBwcm9hY3RpdmVNb2R1bGUgPSByZXF1aXJlKCcuL3Byb2FjdGl2ZS9pbmRleC5qcycpXG4gICAgaWYgKCFwcm9hY3RpdmVNb2R1bGUuaXNQcm9hY3RpdmVBY3RpdmUoKSkge1xuICAgICAgcHJvYWN0aXZlTW9kdWxlLmFjdGl2YXRlUHJvYWN0aXZlKCdjb21tYW5kJylcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbWF5YmVBY3RpdmF0ZUJyaWVmKG9wdGlvbnM6IHVua25vd24pOiB2b2lkIHtcbiAgaWYgKCEoZmVhdHVyZSgnS0FJUk9TJykgfHwgZmVhdHVyZSgnS0FJUk9TX0JSSUVGJykpKSByZXR1cm5cbiAgY29uc3QgYnJpZWZGbGFnID0gKG9wdGlvbnMgYXMgeyBicmllZj86IGJvb2xlYW4gfSkuYnJpZWZcbiAgY29uc3QgYnJpZWZFbnYgPSBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9CUklFRilcbiAgaWYgKCFicmllZkZsYWcgJiYgIWJyaWVmRW52KSByZXR1cm5cbiAgLy8gLS1icmllZiAvIENMQVVERV9DT0RFX0JSSUVGIGFyZSBleHBsaWNpdCBvcHQtaW5zOiBjaGVjayBlbnRpdGxlbWVudCxcbiAgLy8gdGhlbiBzZXQgdXNlck1zZ09wdEluIHRvIGFjdGl2YXRlIHRoZSB0b29sICsgcHJvbXB0IHNlY3Rpb24uIFRoZSBlbnZcbiAgLy8gdmFyIGFsc28gZ3JhbnRzIGVudGl0bGVtZW50IChpc0JyaWVmRW50aXRsZWQoKSByZWFkcyBpdCksIHNvIHNldHRpbmdcbiAgLy8gQ0xBVURFX0NPREVfQlJJRUY9MSBhbG9uZSBmb3JjZS1lbmFibGVzIGZvciBkZXYvdGVzdGluZyDigJQgbm8gR0IgZ2F0ZVxuICAvLyBuZWVkZWQuIGluaXRpYWxJc0JyaWVmT25seSByZWFkcyBnZXRVc2VyTXNnT3B0SW4oKSBkaXJlY3RseS5cbiAgLy8gQ29uZGl0aW9uYWwgcmVxdWlyZTogc3RhdGljIGltcG9ydCB3b3VsZCBsZWFrIHRoZSB0b29sIG5hbWUgc3RyaW5nXG4gIC8vIGludG8gZXh0ZXJuYWwgYnVpbGRzIHZpYSBCcmllZlRvb2wudHMg4oaSIHByb21wdC50cy5cbiAgLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICBjb25zdCB7IGlzQnJpZWZFbnRpdGxlZCB9ID1cbiAgICByZXF1aXJlKCcuL3Rvb2xzL0JyaWVmVG9vbC9CcmllZlRvb2wuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuL3Rvb2xzL0JyaWVmVG9vbC9CcmllZlRvb2wuanMnKVxuICAvKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgY29uc3QgZW50aXRsZWQgPSBpc0JyaWVmRW50aXRsZWQoKVxuICBpZiAoZW50aXRsZWQpIHtcbiAgICBzZXRVc2VyTXNnT3B0SW4odHJ1ZSlcbiAgfVxuICAvLyBGaXJlIHVuY29uZGl0aW9uYWxseSBvbmNlIGludGVudCBpcyBzZWVuOiBlbmFibGVkPWZhbHNlIGNhcHR1cmVzIHRoZVxuICAvLyBcInVzZXIgdHJpZWQgYnV0IHdhcyBnYXRlZFwiIGZhaWx1cmUgbW9kZSBpbiBEYXRhZG9nLlxuICBsb2dFdmVudCgndGVuZ3VfYnJpZWZfbW9kZV9lbmFibGVkJywge1xuICAgIGVuYWJsZWQ6IGVudGl0bGVkLFxuICAgIGdhdGVkOiAhZW50aXRsZWQsXG4gICAgc291cmNlOiAoYnJpZWZFbnZcbiAgICAgID8gJ2VudidcbiAgICAgIDogJ2ZsYWcnKSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICB9KVxufVxuXG5mdW5jdGlvbiByZXNldEN1cnNvcigpIHtcbiAgY29uc3QgdGVybWluYWwgPSBwcm9jZXNzLnN0ZGVyci5pc1RUWVxuICAgID8gcHJvY2Vzcy5zdGRlcnJcbiAgICA6IHByb2Nlc3Muc3Rkb3V0LmlzVFRZXG4gICAgICA/IHByb2Nlc3Muc3Rkb3V0XG4gICAgICA6IHVuZGVmaW5lZFxuICB0ZXJtaW5hbD8ud3JpdGUoU0hPV19DVVJTT1IpXG59XG5cbnR5cGUgVGVhbW1hdGVPcHRpb25zID0ge1xuICBhZ2VudElkPzogc3RyaW5nXG4gIGFnZW50TmFtZT86IHN0cmluZ1xuICB0ZWFtTmFtZT86IHN0cmluZ1xuICBhZ2VudENvbG9yPzogc3RyaW5nXG4gIHBsYW5Nb2RlUmVxdWlyZWQ/OiBib29sZWFuXG4gIHBhcmVudFNlc3Npb25JZD86IHN0cmluZ1xuICB0ZWFtbWF0ZU1vZGU/OiAnYXV0bycgfCAndG11eCcgfCAnaW4tcHJvY2VzcydcbiAgYWdlbnRUeXBlPzogc3RyaW5nXG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RUZWFtbWF0ZU9wdGlvbnMob3B0aW9uczogdW5rbm93bik6IFRlYW1tYXRlT3B0aW9ucyB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgb3B0aW9ucyA9PT0gbnVsbCkge1xuICAgIHJldHVybiB7fVxuICB9XG4gIGNvbnN0IG9wdHMgPSBvcHRpb25zIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4gIGNvbnN0IHRlYW1tYXRlTW9kZSA9IG9wdHMudGVhbW1hdGVNb2RlXG4gIHJldHVybiB7XG4gICAgYWdlbnRJZDogdHlwZW9mIG9wdHMuYWdlbnRJZCA9PT0gJ3N0cmluZycgPyBvcHRzLmFnZW50SWQgOiB1bmRlZmluZWQsXG4gICAgYWdlbnROYW1lOiB0eXBlb2Ygb3B0cy5hZ2VudE5hbWUgPT09ICdzdHJpbmcnID8gb3B0cy5hZ2VudE5hbWUgOiB1bmRlZmluZWQsXG4gICAgdGVhbU5hbWU6IHR5cGVvZiBvcHRzLnRlYW1OYW1lID09PSAnc3RyaW5nJyA/IG9wdHMudGVhbU5hbWUgOiB1bmRlZmluZWQsXG4gICAgYWdlbnRDb2xvcjpcbiAgICAgIHR5cGVvZiBvcHRzLmFnZW50Q29sb3IgPT09ICdzdHJpbmcnID8gb3B0cy5hZ2VudENvbG9yIDogdW5kZWZpbmVkLFxuICAgIHBsYW5Nb2RlUmVxdWlyZWQ6XG4gICAgICB0eXBlb2Ygb3B0cy5wbGFuTW9kZVJlcXVpcmVkID09PSAnYm9vbGVhbidcbiAgICAgICAgPyBvcHRzLnBsYW5Nb2RlUmVxdWlyZWRcbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgcGFyZW50U2Vzc2lvbklkOlxuICAgICAgdHlwZW9mIG9wdHMucGFyZW50U2Vzc2lvbklkID09PSAnc3RyaW5nJ1xuICAgICAgICA/IG9wdHMucGFyZW50U2Vzc2lvbklkXG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIHRlYW1tYXRlTW9kZTpcbiAgICAgIHRlYW1tYXRlTW9kZSA9PT0gJ2F1dG8nIHx8XG4gICAgICB0ZWFtbWF0ZU1vZGUgPT09ICd0bXV4JyB8fFxuICAgICAgdGVhbW1hdGVNb2RlID09PSAnaW4tcHJvY2VzcydcbiAgICAgICAgPyB0ZWFtbWF0ZU1vZGVcbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgYWdlbnRUeXBlOiB0eXBlb2Ygb3B0cy5hZ2VudFR5cGUgPT09ICdzdHJpbmcnID8gb3B0cy5hZ2VudFR5cGUgOiB1bmRlZmluZWQsXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLGlCQUFpQixFQUFFQyxhQUFhLFFBQVEsNEJBQTRCOztBQUU3RTtBQUNBRCxpQkFBaUIsQ0FBQyxnQkFBZ0IsQ0FBQztBQUVuQyxTQUFTRSxlQUFlLFFBQVEsaUNBQWlDOztBQUVqRTtBQUNBQSxlQUFlLENBQUMsQ0FBQztBQUVqQixTQUNFQywrQkFBK0IsRUFDL0JDLHFCQUFxQixRQUNoQiwyQ0FBMkM7O0FBRWxEO0FBQ0FBLHFCQUFxQixDQUFDLENBQUM7QUFFdkIsU0FBU0MsT0FBTyxRQUFRLFlBQVk7QUFDcEMsU0FDRUMsT0FB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