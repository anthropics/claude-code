import { c as _c } from "react/compiler-runtime";
// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { feature } from 'bun:bundle';
import { spawnSync } from 'child_process';
import { snapshotOutputTokensForTurn, getCurrentTurnTokenBudget, getTurnOutputTokens, getBudgetContinuationCount, getTotalInputTokens } from '../bootstrap/state.js';
import { parseTokenBudget } from '../utils/tokenBudget.js';
import { count } from '../utils/array.js';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import figures from 'figures';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- / n N Esc [ v are bare letters in transcript modal context, same class as g/G/j/k in ScrollKeybindingHandler
import { useInput } from '../ink.js';
import { useSearchInput } from '../hooks/useSearchInput.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useSearchHighlight } from '../ink/hooks/use-search-highlight.js';
import type { JumpHandle } from '../components/VirtualMessageList.js';
import { renderMessagesToPlainText } from '../utils/exportRenderer.js';
import { openFileInExternalEditor } from '../utils/editor.js';
import { writeFile } from 'fs/promises';
import { Box, Text, useStdin, useTheme, useTerminalFocus, useTerminalTitle, useTabStatus } from '../ink.js';
import type { TabStatusKind } from '../ink/hooks/use-tab-status.js';
import { CostThresholdDialog } from '../components/CostThresholdDialog.js';
import { IdleReturnDialog } from '../components/IdleReturnDialog.js';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState, useCallback, useDeferredValue, useLayoutEffect, type RefObject } from 'react';
import { useNotifications } from '../context/notifications.js';
import { sendNotification } from '../services/notifier.js';
import { startPreventSleep, stopPreventSleep } from '../services/preventSleep.js';
import { useTerminalNotification } from '../ink/useTerminalNotification.js';
import { hasCursorUpViewportYankBug } from '../ink/terminal.js';
import { createFileStateCacheWithSizeLimit, mergeFileStateCaches, READ_FILE_STATE_CACHE_SIZE } from '../utils/fileStateCache.js';
import { updateLastInteractionTime, getLastInteractionTime, getOriginalCwd, getProjectRoot, getSessionId, switchSession, setCostStateForRestore, getTurnHookDurationMs, getTurnHookCount, resetTurnHookDuration, getTurnToolDurationMs, getTurnToolCount, resetTurnToolDuration, getTurnClassifierDurationMs, getTurnClassifierCount, resetTurnClassifierDuration } from '../bootstrap/state.js';
import { asSessionId, asAgentId } from '../types/ids.js';
import { logForDebugging } from '../utils/debug.js';
import { QueryGuard } from '../utils/QueryGuard.js';
import { isEnvTruthy } from '../utils/envUtils.js';
import { formatTokens, truncateToWidth } from '../utils/format.js';
import { consumeEarlyInput } from '../utils/earlyInput.js';
import { setMemberActive } from '../utils/swarm/teamHelpers.js';
import { isSwarmWorker, generateSandboxRequestId, sendSandboxPermissionRequestViaMailbox, sendSandboxPermissionResponseViaMailbox } from '../utils/swarm/permissionSync.js';
import { registerSandboxPermissionCallback } from '../hooks/useSwarmPermissionPoller.js';
import { getTeamName, getAgentName } from '../utils/teammate.js';
import { WorkerPendingPermission } from '../components/permissions/WorkerPendingPermission.js';
import { injectUserMessageToTeammate, getAllInProcessTeammateTasks } from '../tasks/InProcessTeammateTask/InProcessTeammateTask.js';
import { isLocalAgentTask, queuePendingMessage, appendMessageToLocalAgent, type LocalAgentTaskState } from '../tasks/LocalAgentTask/LocalAgentTask.js';
import { registerLeaderToolUseConfirmQueue, unregisterLeaderToolUseConfirmQueue, registerLeaderSetToolPermissionContext, unregisterLeaderSetToolPermissionContext } from '../utils/swarm/leaderPermissionBridge.js';
import { endInteractionSpan } from '../utils/telemetry/sessionTracing.js';
import { useLogMessages } from '../hooks/useLogMessages.js';
import { useReplBridge } from '../hooks/useReplBridge.js';
import { type Command, type CommandResultDisplay, type ResumeEntrypoint, getCommandName, isCommandEnabled } from '../commands.js';
import type { PromptInputMode, QueuedCommand, VimMode } from '../types/textInputTypes.js';
import { MessageSelector, selectableUserMessagesFilter, messagesAfterAreOnlySynthetic } from '../components/MessageSelector.js';
import { useIdeLogging } from '../hooks/useIdeLogging.js';
import { PermissionRequest, type ToolUseConfirm } from '../components/permissions/PermissionRequest.js';
import { ElicitationDialog } from '../components/mcp/ElicitationDialog.js';
import { PromptDialog } from '../components/hooks/PromptDialog.js';
import type { PromptRequest, PromptResponse } from '../types/hooks.js';
import PromptInput from '../components/PromptInput/PromptInput.js';
import { PromptInputQueuedCommands } from '../components/PromptInput/PromptInputQueuedCommands.js';
import { useRemoteSession } from '../hooks/useRemoteSession.js';
import { useDirectConnect } from '../hooks/useDirectConnect.js';
import type { DirectConnectConfig } from '../server/directConnectManager.js';
import { useSSHSession } from '../hooks/useSSHSession.js';
import { useAssistantHistory } from '../hooks/useAssistantHistory.js';
import type { SSHSession } from '../ssh/createSSHSession.js';
import { SkillImprovementSurvey } from '../components/SkillImprovementSurvey.js';
import { useSkillImprovementSurvey } from '../hooks/useSkillImprovementSurvey.js';
import { useMoreRight } from '../moreright/useMoreRight.js';
import { SpinnerWithVerb, BriefIdleStatus, type SpinnerMode } from '../components/Spinner.js';
import { getSystemPrompt } from '../constants/prompts.js';
import { buildEffectiveSystemPrompt } from '../utils/systemPrompt.js';
import { getSystemContext, getUserContext } from '../context.js';
import { getMemoryFiles } from '../utils/claudemd.js';
import { startBackgroundHousekeeping } from '../utils/backgroundHousekeeping.js';
import { getTotalCost, saveCurrentSessionCosts, resetCostState, getStoredSessionCosts } from '../cost-tracker.js';
import { useCostSummary } from '../costHook.js';
import { useFpsMetrics } from '../context/fpsMetrics.js';
import { useAfterFirstRender } from '../hooks/useAfterFirstRender.js';
import { useDeferredHookMessages } from '../hooks/useDeferredHookMessages.js';
import { addToHistory, removeLastFromHistory, expandPastedTextRefs, parseReferences } from '../history.js';
import { prependModeCharacterToInput } from '../components/PromptInput/inputModes.js';
import { prependToShellHistoryCache } from '../utils/suggestions/shellHistoryCompletion.js';
import { useApiKeyVerification } from '../hooks/useApiKeyVerification.js';
import { GlobalKeybindingHandlers } from '../hooks/useGlobalKeybindings.js';
import { CommandKeybindingHandlers } from '../hooks/useCommandKeybindings.js';
import { KeybindingSetup } from '../keybindings/KeybindingProviderSetup.js';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay.js';
import { getShortcutDisplay } from '../keybindings/shortcutFormat.js';
import { CancelRequestHandler } from '../hooks/useCancelRequest.js';
import { useBackgroundTaskNavigation } from '../hooks/useBackgroundTaskNavigation.js';
import { useSwarmInitialization } from '../hooks/useSwarmInitialization.js';
import { useTeammateViewAutoExit } from '../hooks/useTeammateViewAutoExit.js';
import { errorMessage } from '../utils/errors.js';
import { isHumanTurn } from '../utils/messagePredicates.js';
import { logError } from '../utils/log.js';
// Dead code elimination: conditional imports
/* eslint-disable custom-rules/no-process-env-top-level, @typescript-eslint/no-require-imports */
const useVoiceIntegration: typeof import('../hooks/useVoiceIntegration.js').useVoiceIntegration = feature('VOICE_MODE') ? require('../hooks/useVoiceIntegration.js').useVoiceIntegration : () => ({
  stripTrailing: () => 0,
  handleKeyEvent: () => {},
  resetAnchor: () => {}
});
const VoiceKeybindingHandler: typeof import('../hooks/useVoiceIntegration.js').VoiceKeybindingHandler = feature('VOICE_MODE') ? require('../hooks/useVoiceIntegration.js').VoiceKeybindingHandler : () => null;
// Frustration detection is ant-only (dogfooding). Conditional require so external
// builds eliminate the module entirely (including its two O(n) useMemos that run
// on every messages change, plus the GrowthBook fetch).
const useFrustrationDetection: typeof import('../components/FeedbackSurvey/useFrustrationDetection.js').useFrustrationDetection = "external" === 'ant' ? require('../components/FeedbackSurvey/useFrustrationDetection.js').useFrustrationDetection : () => ({
  state: 'closed',
  handleTranscriptSelect: () => {}
});
// Ant-only org warning. Conditional require so the org UUID list is
// eliminated from external builds (one UUID is on excluded-strings).
const useAntOrgWarningNotification: typeof import('../hooks/notifs/useAntOrgWarningNotification.js').useAntOrgWarningNotification = "external" === 'ant' ? require('../hooks/notifs/useAntOrgWarningNotification.js').useAntOrgWarningNotification : () => {};
// Dead code elimination: conditional import for coordinator mode
const getCoordinatorUserContext: (mcpClients: ReadonlyArray<{
  name: string;
}>, scratchpadDir?: string) => {
  [k: string]: string;
} = feature('COORDINATOR_MODE') ? require('../coordinator/coordinatorMode.js').getCoordinatorUserContext : () => ({});
/* eslint-enable custom-rules/no-process-env-top-level, @typescript-eslint/no-require-imports */
import useCanUseTool from '../hooks/useCanUseTool.js';
import type { ToolPermissionContext, Tool } from '../Tool.js';
import { applyPermissionUpdate, applyPermissionUpdates, persistPermissionUpdate } from '../utils/permissions/PermissionUpdate.js';
import { buildPermissionUpdates } from '../components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.js';
import { stripDangerousPermissionsForAutoMode } from '../utils/permissions/permissionSetup.js';
import { getScratchpadDir, isScratchpadEnabled } from '../utils/permissions/filesystem.js';
import { WEB_FETCH_TOOL_NAME } from '../tools/WebFetchTool/prompt.js';
import { SLEEP_TOOL_NAME } from '../tools/SleepTool/prompt.js';
import { clearSpeculativeChecks } from '../tools/BashTool/bashPermissions.js';
import type { AutoUpdaterResult } from '../utils/autoUpdater.js';
import { getGlobalConfig, saveGlobalConfig, getGlobalConfigWriteCount } from '../utils/config.js';
import { hasConsoleBillingAccess } from '../utils/billing.js';
import { logEvent, type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from 'src/services/analytics/index.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from 'src/services/analytics/growthbook.js';
import { textForResubmit, handleMessageFromStream, type StreamingToolUse, type StreamingThinking, isCompactBoundaryMessage, getMessagesAfterCompactBoundary, getContentText, createUserMessage, createAssistantMessage, createTurnDurationMessage, createAgentsKilledMessage, createApiMetricsMessage, createSystemMessage, createCommandInputMessage, formatCommandInputTags } from '../utils/messages.js';
import { generateSessionTitle } from '../utils/sessionTitle.js';
import { BASH_INPUT_TAG, COMMAND_MESSAGE_TAG, COMMAND_NAME_TAG, LOCAL_COMMAND_STDOUT_TAG } from '../constants/xml.js';
import { escapeXml } from '../utils/xml.js';
import type { ThinkingConfig } from '../utils/thinking.js';
import { gracefulShutdownSync } from '../utils/gracefulShutdown.js';
import { handlePromptSubmit, type PromptInputHelpers } from '../utils/handlePromptSubmit.js';
import { useQueueProcessor } from '../hooks/useQueueProcessor.js';
import { useMailboxBridge } from '../hooks/useMailboxBridge.js';
import { queryCheckpoint, logQueryProfileReport } from '../utils/queryProfiler.js';
import type { Message as MessageType, UserMessage, ProgressMessage, HookResultMessage, PartialCompactDirection } from '../types/message.js';
import { query } from '../query.js';
import { mergeClients, useMergedClients } from '../hooks/useMergedClients.js';
import { getQuerySourceForREPL } from '../utils/promptCategory.js';
import { useMergedTools } from '../hooks/useMergedTools.js';
import { mergeAndFilterTools } from '../utils/toolPool.js';
import { useMergedCommands } from '../hooks/useMergedCommands.js';
import { useSkillsChange } from '../hooks/useSkillsChange.js';
import { useManagePlugins } from '../hooks/useManagePlugins.js';
import { Messages } from '../components/Messages.js';
import { TaskListV2 } from '../components/TaskListV2.js';
import { TeammateViewHeader } from '../components/TeammateViewHeader.js';
import { useTasksV2WithCollapseEffect } from '../hooks/useTasksV2.js';
import { maybeMarkProjectOnboardingComplete } from '../projectOnboardingState.js';
import type { MCPServerConnection } from '../services/mcp/types.js';
import type { ScopedMcpServerConfig } from '../services/mcp/types.js';
import { randomUUID, type UUID } from 'crypto';
import { processSessionStartHooks } from '../utils/sessionStart.js';
import { executeSessionEndHooks, getSessionEndHookTimeoutMs } from '../utils/hooks.js';
import { type IDESelection, useIdeSelection } from '../hooks/useIdeSelection.js';
import { getTools, assembleToolPool } from '../tools.js';
import type { AgentDefinition } from '../tools/AgentTool/loadAgentsDir.js';
import { resolveAgentTools } from '../tools/AgentTool/agentToolUtils.js';
import { resumeAgentBackground } from '../tools/AgentTool/resumeAgent.js';
import { useMainLoopModel } from '../hooks/useMainLoopModel.js';
import { useAppState, useSetAppState, useAppStateStore } from '../state/AppState.js';
import type { ContentBlockParam, ImageBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import type { ProcessUserInputContext } from '../utils/processUserInput/processUserInput.js';
import type { PastedContent } from '../utils/config.js';
import { copyPlanForFork, copyPlanForResume, getPlanSlug, setPlanSlug } from '../utils/plans.js';
import { clearSessionMetadata, resetSessionFilePointer, adoptResumedSessionFile, removeTranscriptMessage, restoreSessionMetadata, getCurrentSessionTitle, isEphemeralToolProgress, isLoggableMessage, saveWorktreeState, getAgentTranscript } from '../utils/sessionStorage.js';
import { deserializeMessages } from '../utils/conversationRecovery.js';
import { extractReadFilesFromMessages, extractBashToolsFromMessages } from '../utils/queryHelpers.js';
import { resetMicrocompactState } from '../services/compact/microCompact.js';
import { runPostCompactCleanup } from '../services/compact/postCompactCleanup.js';
import { provisionContentReplacementState, reconstructContentReplacementState, type ContentReplacementRecord } from '../utils/toolResultStorage.js';
import { partialCompactConversation } from '../services/compact/compact.js';
import type { LogOption } from '../types/logs.js';
import type { AgentColorName } from '../tools/AgentTool/agentColorManager.js';
import { fileHistoryMakeSnapshot, type FileHistoryState, fileHistoryRewind, type FileHistorySnapshot, copyFileHistoryForResume, fileHistoryEnabled, fileHistoryHasAnyChanges } from '../utils/fileHistory.js';
import { type AttributionState, incrementPromptCount } from '../utils/commitAttribution.js';
import { recordAttributionSnapshot } from '../utils/sessionStorage.js';
import { computeStandaloneAgentContext, restoreAgentFromSession, restoreSessionStateFromLog, restoreWorktreeForResume, exitRestoredWorktree } from '../utils/sessionRestore.js';
import { isBgSession, updateSessionName, updateSessionActivity } from '../utils/concurrentSessions.js';
import { isInProcessTeammateTask, type InProcessTeammateTaskState } from '../tasks/InProcessTeammateTask/types.js';
import { restoreRemoteAgentTasks } from '../tasks/RemoteAgentTask/RemoteAgentTask.js';
import { useInboxPoller } from '../hooks/useInboxPoller.js';
// Dead code elimination: conditional import for loop mode
/* eslint-disable @typescript-eslint/no-require-imports */
const proactiveModule = feature('PROACTIVE') || feature('KAIROS') ? require('../proactive/index.js') : null;
const PROACTIVE_NO_OP_SUBSCRIBE = (_cb: () => void) => () => {};
const PROACTIVE_FALSE = () => false;
const SUGGEST_BG_PR_NOOP = (_p: string, _n: string): boolean => false;
const useProactive = feature('PROACTIVE') || feature('KAIROS') ? require('../proactive/useProactive.js').useProactive : null;
const useScheduledTasks = feature('AGENT_TRIGGERS') ? require('../hooks/useScheduledTasks.js').useScheduledTasks : null;
/* eslint-enable @typescript-eslint/no-require-imports */
import { isAgentSwarmsEnabled } from '../utils/agentSwarmsEnabled.js';
import { useTaskListWatcher } from '../hooks/useTaskListWatcher.js';
import type { SandboxAskCallback, NetworkHostPattern } from '../utils/sandbox/sandbox-adapter.js';
import { type IDEExtensionInstallationStatus, closeOpenDiffs, getConnectedIdeClient, type IdeType } from '../utils/ide.js';
import { useIDEIntegration } from '../hooks/useIDEIntegration.js';
import exit from '../commands/exit/index.js';
import { ExitFlow } from '../components/ExitFlow.js';
import { getCurrentWorktreeSession } from '../utils/worktree.js';
import { popAllEditable, enqueue, type SetAppState, getCommandQueue, getCommandQueueLength, removeByFilter } from '../utils/messageQueueManager.js';
import { useCommandQueue } from '../hooks/useCommandQueue.js';
import { SessionBackgroundHint } from '../components/SessionBackgroundHint.js';
import { startBackgroundSession } from '../tasks/LocalMainSessionTask.js';
import { useSessionBackgrounding } from '../hooks/useSessionBackgrounding.js';
import { diagnosticTracker } from '../services/diagnosticTracking.js';
import { handleSpeculationAccept, type ActiveSpeculationState } from '../services/PromptSuggestion/speculation.js';
import { IdeOnboardingDialog } from '../components/IdeOnboardingDialog.js';
import { EffortCallout, shouldShowEffortCallout } from '../components/EffortCallout.js';
import type { EffortValue } from '../utils/effort.js';
import { RemoteCallout } from '../components/RemoteCallout.js';
/* eslint-disable custom-rules/no-process-env-top-level, @typescript-eslint/no-require-imports */
const AntModelSwitchCallout = "external" === 'ant' ? require('../components/AntModelSwitchCallout.js').AntModelSwitchCallout : null;
const shouldShowAntModelSwitch = "external" === 'ant' ? require('../components/AntModelSwitchCallout.js').shouldShowModelSwitchCallout : (): boolean => false;
const UndercoverAutoCallout = "external" === 'ant' ? require('../components/UndercoverAutoCallout.js').UndercoverAutoCallout : null;
/* eslint-enable custom-rules/no-process-env-top-level, @typescript-eslint/no-require-imports */
import { activityManager } from '../utils/activityManager.js';
import { createAbortController } from '../utils/abortController.js';
import { MCPConnectionManager } from 'src/services/mcp/MCPConnectionManager.js';
import { useFeedbackSurvey } from 'src/components/FeedbackSurvey/useFeedbackSurvey.js';
import { useMemorySurvey } from 'src/components/FeedbackSurvey/useMemorySurvey.js';
import { usePostCompactSurvey } from 'src/components/FeedbackSurvey/usePostCompactSurvey.js';
import { FeedbackSurvey } from 'src/components/FeedbackSurvey/FeedbackSurvey.js';
import { useInstallMessages } from 'src/hooks/notifs/useInstallMessages.js';
import { useAwaySummary } from 'src/hooks/useAwaySummary.js';
import { useChromeExtensionNotification } from 'src/hooks/useChromeExtensionNotification.js';
import { useOfficialMarketplaceNotification } from 'src/hooks/useOfficialMarketplaceNotification.js';
import { usePromptsFromClaudeInChrome } from 'src/hooks/usePromptsFromClaudeInChrome.js';
import { getTipToShowOnSpinner, recordShownTip } from 'src/services/tips/tipScheduler.js';
import type { Theme } from 'src/utils/theme.js';
import { checkAndDisableBypassPermissionsIfNeeded, checkAndDisableAutoModeIfNeeded, useKickOffCheckAndDisableBypassPermissionsIfNeeded, useKickOffCheckAndDisableAutoModeIfNeeded } from 'src/utils/permissions/bypassPermissionsKillswitch.js';
import { SandboxManager } from 'src/utils/sandbox/sandbox-adapter.js';
import { SANDBOX_NETWORK_ACCESS_TOOL_NAME } from 'src/cli/structuredIO.js';
import { useFileHistorySnapshotInit } from 'src/hooks/useFileHistorySnapshotInit.js';
import { SandboxPermissionRequest } from 'src/components/permissions/SandboxPermissionRequest.js';
import { SandboxViolationExpandedView } from 'src/components/SandboxViolationExpandedView.js';
import { useSettingsErrors } from 'src/hooks/notifs/useSettingsErrors.js';
import { useMcpConnectivityStatus } from 'src/hooks/notifs/useMcpConnectivityStatus.js';
import { useAutoModeUnavailableNotification } from 'src/hooks/notifs/useAutoModeUnavailableNotification.js';
import { AUTO_MODE_DESCRIPTION } from 'src/components/AutoModeOptInDialog.js';
import { useLspInitializationNotification } from 'src/hooks/notifs/useLspInitializationNotification.js';
import { useLspPluginRecommendation } from 'src/hooks/useLspPluginRecommendation.js';
import { LspRecommendationMenu } from 'src/components/LspRecommendation/LspRecommendationMenu.js';
import { useClaudeCodeHintRecommendation } from 'src/hooks/useClaudeCodeHintRecommendation.js';
import { PluginHintMenu } from 'src/components/ClaudeCodeHint/PluginHintMenu.js';
import { DesktopUpsellStartup, shouldShowDesktopUpsellStartup } from 'src/components/DesktopUpsell/DesktopUpsellStartup.js';
import { usePluginInstallationStatus } from 'src/hooks/notifs/usePluginInstallationStatus.js';
import { usePluginAutoupdateNotification } from 'src/hooks/notifs/usePluginAutoupdateNotification.js';
import { performStartupChecks } from 'src/utils/plugins/performStartupChecks.js';
import { UserTextMessage } from 'src/components/messages/UserTextMessage.js';
import { AwsAuthStatusBox } from '../components/AwsAuthStatusBox.js';
import { useRateLimitWarningNotification } from 'src/hooks/notifs/useRateLimitWarningNotification.js';
import { useDeprecationWarningNotification } from 'src/hooks/notifs/useDeprecationWarningNotification.js';
import { useNpmDeprecationNotification } from 'src/hooks/notifs/useNpmDeprecationNotification.js';
import { useIDEStatusIndicator } from 'src/hooks/notifs/useIDEStatusIndicator.js';
import { useModelMigrationNotifications } from 'src/hooks/notifs/useModelMigrationNotifications.js';
import { useCanSwitchToExistingSubscription } from 'src/hooks/notifs/useCanSwitchToExistingSubscription.js';
import { useTeammateLifecycleNotification } from 'src/hooks/notifs/useTeammateShutdownNotification.js';
import { useFastModeNotification } from 'src/hooks/notifs/useFastModeNotification.js';
import { AutoRunIssueNotification, shouldAutoRunIssue, getAutoRunIssueReasonText, getAutoRunCommand, type AutoRunIssueReason } from '../utils/autoRunIssue.js';
import type { HookProgress } from '../types/hooks.js';
import { TungstenLiveMonitor } from '../tools/TungstenTool/TungstenLiveMonitor.js';
/* eslint-disable @typescript-eslint/no-require-imports */
const WebBrowserPanelModule = feature('WEB_BROWSER_TOOL') ? require('../tools/WebBrowserTool/WebBrowserPanel.js') as typeof import('../tools/WebBrowserTool/WebBrowserPanel.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */
import { IssueFlagBanner } from '../components/PromptInput/IssueFlagBanner.js';
import { useIssueFlagBanner } from '../hooks/useIssueFlagBanner.js';
import { CompanionSprite, CompanionFloatingBubble, MIN_COLS_FOR_FULL_SPRITE } from '../buddy/CompanionSprite.js';
import { DevBar } from '../components/DevBar.js';
// Session manager removed - using AppState now
import type { RemoteSessionConfig } from '../remote/RemoteSessionManager.js';
import { REMOTE_SAFE_COMMANDS } from '../commands.js';
import type { RemoteMessageContent } from '../utils/teleport/api.js';
import { FullscreenLayout, useUnseenDivider, computeUnseenDivider } from '../components/FullscreenLayout.js';
import { isFullscreenEnvEnabled, maybeGetTmuxMouseHint, isMouseTrackingEnabled } from '../utils/fullscreen.js';
import { AlternateScreen } from '../ink/components/AlternateScreen.js';
import { ScrollKeybindingHandler } from '../components/ScrollKeybindingHandler.js';
import { useMessageActions, MessageActionsKeybindings, MessageActionsBar, type MessageActionsState, type MessageActionsNav, type MessageActionCaps } from '../components/messageActions.js';
import { setClipboard } from '../ink/termio/osc.js';
import type { ScrollBoxHandle } from '../ink/components/ScrollBox.js';
import { createAttachmentMessage, getQueuedCommandAttachments } from '../utils/attachments.js';

// Stable empty array for hooks that accept MCPServerConnection[] — avoids
// creating a new [] literal on every render in remote mode, which would
// cause useEffect dependency changes and infinite re-render loops.
const EMPTY_MCP_CLIENTS: MCPServerConnection[] = [];

// Stable stub for useAssistantHistory's non-KAIROS branch — avoids a new
// function identity each render, which would break composedOnScroll's memo.
const HISTORY_STUB = {
  maybeLoadOlder: (_: ScrollBoxHandle) => {}
};
// Window after a user-initiated scroll during which type-into-empty does NOT
// repin to bottom. Josh Rosen's workflow: Claude emits long output → scroll
// up to read the start → start typing → before this fix, snapped to bottom.
// https://anthropic.slack.com/archives/C07VBSHV7EV/p1773545449871739
const RECENT_SCROLL_REPIN_WINDOW_MS = 3000;

// Use LRU cache to prevent unbounded memory growth
// 100 files should be sufficient for most coding sessions while preventing
// memory issues when working across many files in large projects

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

/**
 * Small component to display transcript mode footer with dynamic keybinding.
 * Must be rendered inside KeybindingSetup to access keybinding context.
 */
function TranscriptModeFooter(t0) {
  const $ = _c(9);
  const {
    showAllInTranscript,
    virtualScroll,
    searchBadge,
    suppressShowAll: t1,
    status
  } = t0;
  const suppressShowAll = t1 === undefined ? false : t1;
  const toggleShortcut = useShortcutDisplay("app:toggleTranscript", "Global", "ctrl+o");
  const showAllShortcut = useShortcutDisplay("transcript:toggleShowAll", "Transcript", "ctrl+e");
  const t2 = searchBadge ? " \xB7 n/N to navigate" : virtualScroll ? ` · ${figures.arrowUp}${figures.arrowDown} scroll · home/end top/bottom` : suppressShowAll ? "" : ` · ${showAllShortcut} to ${showAllInTranscript ? "collapse" : "show all"}`;
  let t3;
  if ($[0] !== t2 || $[1] !== toggleShortcut) {
    t3 = <Text dimColor={true}>Showing detailed transcript · {toggleShortcut} to toggle{t2}</Text>;
    $[0] = t2;
    $[1] = toggleShortcut;
    $[2] = t3;
  } else {
    t3 = $[2];
  }
  let t4;
  if ($[3] !== searchBadge || $[4] !== status) {
    t4 = status ? <><Box flexGrow={1} /><Text>{status} </Text></> : searchBadge ? <><Box flexGrow={1} /><Text dimColor={true}>{searchBadge.current}/{searchBadge.count}{"  "}</Text></> : null;
    $[3] = searchBadge;
    $[4] = status;
    $[5] = t4;
  } else {
    t4 = $[5];
  }
  let t5;
  if ($[6] !== t3 || $[7] !== t4) {
    t5 = <Box noSelect={true} alignItems="center" alignSelf="center" borderTopDimColor={true} borderBottom={false} borderLeft={false} borderRight={false} borderStyle="single" marginTop={1} paddingLeft={2} width="100%">{t3}{t4}</Box>;
    $[6] = t3;
    $[7] = t4;
    $[8] = t5;
  } else {
    t5 = $[8];
  }
  return t5;
}

/** less-style / bar. 1-row, same border-top styling as TranscriptModeFooter
 *  so swapping them in the bottom slot doesn't shift ScrollBox height.
 *  useSearchInput handles readline editing; we report query changes and
 *  render the counter. Incremental — re-search + highlight per keystroke. */
function TranscriptSearchBar({
  jumpRef,
  count,
  current,
  onClose,
  onCancel,
  setHighlight,
  initialQuery
}: {
  jumpRef: RefObject<JumpHandle | null>;
  count: number;
  current: number;
  /** Enter — commit. Query persists for n/N. */
  onClose: (lastQuery: string) => void;
  /** Esc/ctrl+c/ctrl+g — undo to pre-/ state. */
  onCancel: () => void;
  setHighlight: (query: string) => void;
  // Seed with the previous query (less: / shows last pattern). Mount-fire
  // of the effect re-scans with the same query — idempotent (same matches,
  // nearest-ptr, same highlights). User can edit or clear.
  initialQuery: string;
}): React.ReactNode {
  const {
    query,
    cursorOffset
  } = useSearchInput({
    isActive: true,
    initialQuery,
    onExit: () => onClose(query),
    onCancel
  });
  // Index warm-up runs before the query effect so it measures the real
  // cost — otherwise setSearchQuery fills the cache first and warm
  // reports ~0ms while the user felt the actual lag.
  // First / in a transcript session pays the extractSearchText cost.
  // Subsequent / return 0 immediately (indexWarmed ref in VML).
  // Transcript is frozen at ctrl+o so the cache stays valid.
  // Initial 'building' so warmDone is false on mount — the [query] effect
  // waits for the warm effect's first resolve instead of racing it. With
  // null initial, warmDone would be true on mount → [query] fires →
  // setSearchQuery fills cache → warm reports ~0ms while the user felt
  // the real lag.
  const [indexStatus, setIndexStatus] = React.useState<'building' | {
    ms: number;
  } | null>('building');
  React.useEffect(() => {
    let alive = true;
    const warm = jumpRef.current?.warmSearchIndex;
    if (!warm) {
      setIndexStatus(null); // VML not mounted yet — rare, skip indicator
      return;
    }
    setIndexStatus('building');
    warm().then(ms => {
      if (!alive) return;
      // <20ms = imperceptible. No point showing "indexed in 3ms".
      if (ms < 20) {
        setIndexStatus(null);
      } else {
        setIndexStatus({
          ms
        });
        setTimeout(() => alive && setIndexStatus(null), 2000);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only: bar opens once per /
  // Gate the query effect on warm completion. setHighlight stays instant
  // (screen-space overlay, no indexing). setSearchQuery (the scan) waits.
  const warmDone = indexStatus !== 'building';
  useEffect(() => {
    if (!warmDone) return;
    jumpRef.current?.setSearchQuery(query);
    setHighlight(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, warmDone]);
  const off = cursorOffset;
  const cursorChar = off < query.length ? query[off] : ' ';
  return <Box borderTopDimColor borderBottom={false} borderLeft={false} borderRight={false} borderStyle="single" marginTop={1} paddingLeft={2} width="100%"
  // applySearchHighlight scans the whole screen buffer. The query
  // text rendered here IS on screen — /foo matches its own 'foo' in
  // the bar. With no content matches that's the ONLY visible match →
  // gets CURRENT → underlined. noSelect makes searchHighlight.ts:76
  // skip these cells (same exclusion as gutters). You can't text-
  // select the bar either; it's transient chrome, fine.
  noSelect>
      <Text>/</Text>
      <Text>{query.slice(0, off)}</Text>
      <Text inverse>{cursorChar}</Text>
      {off < query.length && <Text>{query.slice(off + 1)}</Text>}
      <Box flexGrow={1} />
      {indexStatus === 'building' ? <Text dimColor>indexing… </Text> : indexStatus ? <Text dimColor>indexed in {indexStatus.ms}ms </Text> : count === 0 && query ? <Text color="error">no matches </Text> : count > 0 ?
    // Engine-counted (indexOf on extractSearchText). May drift from
    // render-count for ghost/phantom messages — badge is a rough
    // location hint. scanElement gives exact per-message positions
    // but counting ALL would cost ~1-3ms × matched-messages.
    <Text dimColor>
          {current}/{count}
          {'  '}
        </Text> : null}
    </Box>;
}
const TITLE_ANIMATION_FRAMES = ['⠂', '⠐'];
const TITLE_STATIC_PREFIX = '✳';
const TITLE_ANIMATION_INTERVAL_MS = 960;

/**
 * Sets the terminal tab title, with an animated prefix glyph while a query
 * is running. Isolated from REPL so the 960ms animation tick re-renders only
 * this leaf component (which returns null — pure side-effect) instead of the
 * entire REPL tree. Before extraction, the tick was ~1 REPL render/sec for
 * the duration of every turn, dragging PromptInput and friends along.
 */
function AnimatedTerminalTitle(t0) {
  const $ = _c(6);
  const {
    isAnimating,
    title,
    disabled,
    noPrefix
  } = t0;
  const terminalFocused = useTerminalFocus();
  const [frame, setFrame] = useState(0);
  let t1;
  let t2;
  if ($[0] !== disabled || $[1] !== isAnimating || $[2] !== noPrefix || $[3] !== terminalFocused) {
    t1 = () => {
      if (disabled || noPrefix || !isAnimating || !terminalFocused) {
        return;
      }
      const interval = setInterval(_temp2, TITLE_ANIMATION_INTERVAL_MS, setFrame);
      return () => clearInterval(interval);
    };
    t2 = [disabled, noPrefix, isAnimating, terminalFocused];
    $[0] = disabled;
    $[1] = isAnimating;
    $[2] = noPrefix;
    $[3] = terminalFocused;
    $[4] = t1;
    $[5] = t2;
  } else {
    t1 = $[4];
    t2 = $[5];
  }
  useEffect(t1, t2);
  const prefix = isAnimating ? TITLE_ANIMATION_FRAMES[frame] ?? TITLE_STATIC_PREFIX : TITLE_STATIC_PREFIX;
  useTerminalTitle(disabled ? null : noPrefix ? title : `${prefix} ${title}`);
  return null;
}
function _temp2(setFrame_0) {
  return setFrame_0(_temp);
}
function _temp(f) {
  return (f + 1) % TITLE_ANIMATION_FRAMES.length;
}
export type Props = {
  commands: Command[];
  debug: boolean;
  initialTools: Tool[];
  // Initial messages to populate the REPL with
  initialMessages?: MessageType[];
  // Deferred hook messages promise — REPL renders immediately and injects
  // hook messages when they resolve. Awaited before the first API call.
  pendingHookMessages?: Promise<HookResultMessage[]>;
  initialFileHistorySnapshots?: FileHistorySnapshot[];
  // Content-replacement records from a resumed session's transcript — used to
  // reconstruct contentReplacementState so the same results are re-replaced
  initialContentReplacements?: ContentReplacementRecord[];
  // Initial agent context for session resume (name/color set via /rename or /color)
  initialAgentName?: string;
  initialAgentColor?: AgentColorName;
  mcpClients?: MCPServerConnection[];
  dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>;
  autoConnectIdeFlag?: boolean;
  strictMcpConfig?: boolean;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  // Optional callback invoked before query execution
  // Called after user message is added to conversation but before API call
  // Return false to prevent query execution
  onBeforeQuery?: (input: string, newMessages: MessageType[]) => Promise<boolean>;
  // Optional callback when a turn completes (model finishes responding)
  onTurnComplete?: (messages: MessageType[]) => void | Promise<void>;
  // When true, disables REPL input (hides prompt and prevents message selector)
  disabled?: boolean;
  // Optional agent definition to use for the main thread
  mainThreadAgentDefinition?: AgentDefinition;
  // When true, disables all slash commands
  disableSlashCommands?: boolean;
  // Task list id: when set, enables tasks mode that watches a task list and auto-processes tasks.
  taskListId?: string;
  // Remote session config for --remote mode (uses CCR as execution engine)
  remoteSessionConfig?: RemoteSessionConfig;
  // Direct connect config for `claude connect` mode (connects to a claude server)
  directConnectConfig?: DirectConnectConfig;
  // SSH session for `claude ssh` mode (local REPL, remote tools over ssh)
  sshSession?: SSHSession;
  // Thinking configuration to use when thinking is enabled
  thinkingConfig: ThinkingConfig;
};
export type Screen = 'prompt' | 'transcript';
export function REPL({
  commands: initialCommands,
  debug,
  initialTools,
  initialMessages,
  pendingHookMessages,
  initialFileHistorySnapshots,
  initialContentReplacements,
  initialAgentName,
  initialAgentColor,
  mcpClients: initialMcpClients,
  dynamicMcpConfig: initialDynamicMcpConfig,
  autoConnectIdeFlag,
  strictMcpConfig = false,
  systemPrompt: customSystemPrompt,
  appendSystemPrompt,
  onBeforeQuery,
  onTurnComplete,
  disabled = false,
  mainThreadAgentDefinition: initialMainThreadAgentDefinition,
  disableSlashCommands = false,
  taskListId,
  remoteSessionConfig,
  directConnectConfig,
  sshSession,
  thinkingConfig
}: Props): React.ReactNode {
  const isRemoteSession = !!remoteSessionConfig;

  // Env-var gates hoisted to mount-time — isEnvTruthy does toLowerCase+trim+
  // includes, and these were on the render path (hot during PageUp spam).
  const titleDisabled = useMemo(() => isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_TERMINAL_TITLE), []);
  const moreRightEnabled = useMemo(() => "external" === 'ant' && isEnvTruthy(process.env.CLAUDE_MORERIGHT), []);
  const disableVirtualScroll = useMemo(() => isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL), []);
  const disableMessageActions = feature('MESSAGE_ACTIONS') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useMemo(() => isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_MESSAGE_ACTIONS), []) : false;

  // Log REPL mount/unmount lifecycle
  useEffect(() => {
    logForDebugging(`[REPL:mount] REPL mounted, disabled=${disabled}`);
    return () => logForDebugging(`[REPL:unmount] REPL unmounting`);
  }, [disabled]);

  // Agent definition is state so /resume can update it mid-session
  const [mainThreadAgentDefinition, setMainThreadAgentDefinition] = useState(initialMainThreadAgentDefinition);
  const toolPermissionContext = useAppState(s => s.toolPermissionContext);
  const verbose = useAppState(s => s.verbose);
  const mcp = useAppState(s => s.mcp);
  const plugins = useAppState(s => s.plugins);
  const agentDefinitions = useAppState(s => s.agentDefinitions);
  const fileHistory = useAppState(s => s.fileHistory);
  const initialMessage = useAppState(s => s.initialMessage);
  const queuedCommands = useCommandQueue();
  // feature() is a build-time constant — dead code elimination removes the hook
  // call entirely in external builds, so this is safe despite looking conditional.
  // These fields contain excluded strings that must not appear in external builds.
  const spinnerTip = useAppState(s => s.spinnerTip);
  const showExpandedTodos = useAppState(s => s.expandedView) === 'tasks';
  const pendingWorkerRequest = useAppState(s => s.pendingWorkerRequest);
  const pendingSandboxRequest = useAppState(s => s.pendingSandboxRequest);
  const teamContext = useAppState(s => s.teamContext);
  const tasks = useAppState(s => s.tasks);
  const workerSandboxPermissions = useAppState(s => s.workerSandboxPermissions);
  const elicitation = useAppState(s => s.elicitation);
  const ultraplanPendingChoice = useAppState(s => s.ultraplanPendingChoice);
  const ultraplanLaunchPending = useAppState(s => s.ultraplanLaunchPending);
  const viewingAgentTaskId = useAppState(s => s.viewingAgentTaskId);
  const setAppState = useSetAppState();

  // Bootstrap: retained local_agent that hasn't loaded disk yet → read
  // sidechain JSONL and UUID-merge with whatever stream has appended so far.
  // Stream appends immediately on retain (no defer); bootstrap fills the
  // prefix. Disk-write-before-yield means live is always a suffix of disk.
  const viewedLocalAgent = viewingAgentTaskId ? tasks[viewingAgentTaskId] : undefined;
  const needsBootstrap = isLocalAgentTask(viewedLocalAgent) && viewedLocalAgent.retain && !viewedLocalAgent.diskLoaded;
  useEffect(() => {
    if (!viewingAgentTaskId || !needsBootstrap) return;
    const taskId = viewingAgentTaskId;
    void getAgentTranscript(asAgentId(taskId)).then(result => {
      setAppState(prev => {
        const t = prev.tasks[taskId];
        if (!isLocalAgentTask(t) || t.diskLoaded || !t.retain) return prev;
        const live = t.messages ?? [];
        const liveUuids = new Set(live.map(m => m.uuid));
        const diskOnly = result ? result.messages.filter(m => !liveUuids.has(m.uuid)) : [];
        return {
          ...prev,
          tasks: {
            ...prev.tasks,
            [taskId]: {
              ...t,
              messages: [...diskOnly, ...live],
              diskLoaded: true
            }
          }
        };
      });
    });
  }, [viewingAgentTaskId, needsBootstrap, setAppState]);
  const store = useAppStateStore();
  const terminal = useTerminalNotification();
  const mainLoopModel = useMainLoopModel();

  // Note: standaloneAgentContext is initialized in main.tsx (via initialState) or
  // ResumeConversation.tsx (via setAppState before rendering REPL) to avoid
  // useEffect-based state initialization on mount (per CLAUDE.md guidelines)

  // Local state for commands (hot-reloadable when skill files change)
  const [localCommands, setLocalCommands] = useState(initialCommands);

  // Watch for skill file changes and reload all commands
  useSkillsChange(isRemoteSession ? undefined : getProjectRoot(), setLocalCommands);

  // Track proactive mode for tools dependency - SleepTool filters by proactive state
  const proactiveActive = React.useSyncExternalStore(proactiveModule?.subscribeToProactiveChanges ?? PROACTIVE_NO_OP_SUBSCRIBE, proactiveModule?.isProactiveActive ?? PROACTIVE_FALSE);

  // BriefTool.isEnabled() reads getUserMsgOptIn() from bootstrap state, which
  // /brief flips mid-session alongside isBriefOnly. The memo below needs a
  // React-visible dep to re-run getTools() when that happens; isBriefOnly is
  // the AppState mirror that triggers the re-render. Without this, toggling
  // /brief mid-session leaves the stale tool list (no SendUserMessage) and
  // the model emits plain text the brief filter hides.
  const isBriefOnly = useAppState(s => s.isBriefOnly);
  const localTools = useMemo(() => getTools(toolPermissionContext), [toolPermissionContext, proactiveActive, isBriefOnly]);
  useKickOffCheckAndDisableBypassPermissionsIfNeeded();
  useKickOffCheckAndDisableAutoModeIfNeeded();
  const [dynamicMcpConfig, setDynamicMcpConfig] = useState<Record<string, ScopedMcpServerConfig> | undefined>(initialDynamicMcpConfig);
  const onChangeDynamicMcpConfig = useCallback((config: Record<string, ScopedMcpServerConfig>) => {
    setDynamicMcpConfig(config);
  }, [setDynamicMcpConfig]);
  const [screen, setScreen] = useState<Screen>('prompt');
  const [showAllInTranscript, setShowAllInTranscript] = useState(false);
  // [ forces the dump-to-scrollback path inside transcript mode. Separate
  // from CLAUDE_CODE_NO_FLICKER=0 (which is process-lifetime) — this is
  // ephemeral, reset on transcript exit. Diagnostic escape hatch so
  // terminal/tmux native cmd-F can search the full flat render.
  const [dumpMode, setDumpMode] = useState(false);
  // v-for-editor render progress. Inline in the footer — notifications
  // render inside PromptInput which isn't mounted in transcript.
  const [editorStatus, setEditorStatus] = useState('');
  // Incremented on transcript exit. Async v-render captures this at start;
  // each status write no-ops if stale (user left transcript mid-render —
  // the stable setState would otherwise stamp a ghost toast into the next
  // session). Also clears any pending 4s auto-clear.
  const editorGenRef = useRef(0);
  const editorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editorRenderingRef = useRef(false);
  const {
    addNotification,
    removeNotification
  } = useNotifications();

  // eslint-disable-next-line prefer-const
  let trySuggestBgPRIntercept = SUGGEST_BG_PR_NOOP;
  const mcpClients = useMergedClients(initialMcpClients, mcp.clients);

  // IDE integration
  const [ideSelection, setIDESelection] = useState<IDESelection | undefined>(undefined);
  const [ideToInstallExtension, setIDEToInstallExtension] = useState<IdeType | null>(null);
  const [ideInstallationStatus, setIDEInstallationStatus] = useState<IDEExtensionInstallationStatus | null>(null);
  const [showIdeOnboarding, setShowIdeOnboarding] = useState(false);
  // Dead code elimination: model switch callout state (ant-only)
  const [showModelSwitchCallout, setShowModelSwitchCallout] = useState(() => {
    if ("external" === 'ant') {
      return shouldShowAntModelSwitch();
    }
    return false;
  });
  const [showEffortCallout, setShowEffortCallout] = useState(() => shouldShowEffortCallout(mainLoopModel));
  const showRemoteCallout = useAppState(s => s.showRemoteCallout);
  const [showDesktopUpsellStartup, setShowDesktopUpsellStartup] = useState(() => shouldShowDesktopUpsellStartup());
  // notifications
  useModelMigrationNotifications();
  useCanSwitchToExistingSubscription();
  useIDEStatusIndicator({
    ideSelection,
    mcpClients,
    ideInstallationStatus
  });
  useMcpConnectivityStatus({
    mcpClients
  });
  useAutoModeUnavailableNotification();
  usePluginInstallationStatus();
  usePluginAutoupdateNotification();
  useSettingsErrors();
  useRateLimitWarningNotification(mainLoopModel);
  useFastModeNotification();
  useDeprecationWarningNotification(mainLoopModel);
  useNpmDeprecationNotification();
  useAntOrgWarningNotification();
  useInstallMessages();
  useChromeExtensionNotification();
  useOfficialMarketplaceNotification();
  useLspInitializationNotification();
  useTeammateLifecycleNotification();
  const {
    recommendation: lspRecommendation,
    handleResponse: handleLspResponse
  } = useLspPluginRecommendation();
  const {
    recommendation: hintRecommendation,
    handleResponse: handleHintResponse
  } = useClaudeCodeHintRecommendation();

  // Memoize the combined initial tools array to prevent reference changes
  const combinedInitialTools = useMemo(() => {
    return [...localTools, ...initialTools];
  }, [localTools, initialTools]);

  // Initialize plugin management
  useManagePlugins({
    enabled: !isRemoteSession
  });
  const tasksV2 = useTasksV2WithCollapseEffect();

  // Start background plugin installations

  // SECURITY: This code is guaranteed to run ONLY after the "trust this folder" dialog
  // has been confirmed by the user. The trust dialog is shown in cli.tsx (line ~387)
  // before the REPL component is rendered. The dialog blocks execution until the user
  // accepts, and only then is the REPL component mounted and this effect runs.
  // This ensures that plugin installations from repository and user settings only
  // happen after explicit user consent to trust the current working directory.
  useEffect(() => {
    if (isRemoteSession) return;
    void performStartupChecks(setAppState);
  }, [setAppState, isRemoteSession]);

  // Allow Claude in Chrome MCP to send prompts through MCP notifications
  // and sync permission mode changes to the Chrome extension
  usePromptsFromClaudeInChrome(isRemoteSession ? EMPTY_MCP_CLIENTS : mcpClients, toolPermissionContext.mode);

  // Initialize swarm features: teammate hooks and context
  // Handles both fresh spawns and resumed teammate sessions
  useSwarmInitialization(setAppState, initialMessages, {
    enabled: !isRemoteSession
  });
  const mergedTools = useMergedTools(combinedInitialTools, mcp.tools, toolPermissionContext);

  // Apply agent tool restrictions if mainThreadAgentDefinition is set
  const {
    tools,
    allowedAgentTypes
  } = useMemo(() => {
    if (!mainThreadAgentDefinition) {
      return {
        tools: mergedTools,
        allowedAgentTypes: undefined as string[] | undefined
      };
    }
    const resolved = resolveAgentTools(mainThreadAgentDefinition, mergedTools, false, true);
    return {
      tools: resolved.resolvedTools,
      allowedAgentTypes: resolved.allowedAgentTypes
    };
  }, [mainThreadAgentDefinition, mergedTools]);

  // Merge commands from local state, plugins, and MCP
  const commandsWithPlugins = useMergedCommands(localCommands, plugins.commands as Command[]);
  const mergedCommands = useMergedCommands(commandsWithPlugins, mcp.commands as Command[]);
  // Filter out all commands if disableSlashCommands is true
  const commands = useMemo(() => disableSlashCommands ? [] : mergedCommands, [disableSlashCommands, mergedCommands]);
  useIdeLogging(isRemoteSession ? EMPTY_MCP_CLIENTS : mcp.clients);
  useIdeSelection(isRemoteSession ? EMPTY_MCP_CLIENTS : mcp.clients, setIDESelection);
  const [streamMode, setStreamMode] = useState<SpinnerMode>('responding');
  // Ref mirror so onSubmit can read the latest value without adding
  // streamMode to its deps. streamMode flips between
  // requesting/responding/tool-use ~10x per turn during streaming; having it
  // in onSubmit's deps was recreating onSubmit on every flip, which
  // cascaded into PromptInput prop churn and downstream useCallback/useMemo
  // invalidation. The only consumers inside callbacks are debug logging and
  // telemetry (handlePromptSubmit.ts), so a stale-by-one-render value is
  // harmless — but ref mirrors sync on every render anyway so it's fresh.
  const streamModeRef = useRef(streamMode);
  streamModeRef.current = streamMode;
  const [streamingToolUses, setStreamingToolUses] = useState<StreamingToolUse[]>([]);
  const [streamingThinking, setStreamingThinking] = useState<StreamingThinking | null>(null);

  // Auto-hide streaming thinking after 30 seconds of being completed
  useEffect(() => {
    if (streamingThinking && !streamingThinking.isStreaming && streamingThinking.streamingEndedAt) {
      const elapsed = Date.now() - streamingThinking.streamingEndedAt;
      const remaining = 30000 - elapsed;
      if (remaining > 0) {
        const timer = setTimeout(setStreamingThinking, remaining, null);
        return () => clearTimeout(timer);
      } else {
        setStreamingThinking(null);
      }
    }
  }, [streamingThinking]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  // Ref that always points to the current abort controller, used by the
  // REPL bridge to abort the active query when a remote interrupt arrives.
  const abortControllerRef = useRef<AbortController | null>(null);
  abortControllerRef.current = abortController;

  // Ref for the bridge result callback — set after useReplBridge initializes,
  // read in the onQuery finally block to notify mobile clients that a turn ended.
  const sendBridgeResultRef = useRef<() => void>(() => {});

  // Ref for the synchronous restore callback — set after restoreMessageSync is
  // defined, read in the onQuery finally block for auto-restore on interrupt.
  const restoreMessageSyncRef = useRef<(m: UserMessage) => void>(() => {});

  // Ref to the fullscreen layout's scroll box for keyboard scrolling.
  // Null when fullscreen mode is disabled (ref never attached).
  const scrollRef = useRef<ScrollBoxHandle>(null);
  // Separate ref for the modal slot's inner ScrollBox — passed through
  // FullscreenLayout → ModalContext so Tabs can attach it to its own
  // ScrollBox for tall content (e.g. /status's MCP-server list). NOT
  // keyboard-driven — ScrollKeybindingHandler stays on the outer ref so
  // PgUp/PgDn/wheel always scroll the transcript behind the modal.
  // Plumbing kept for future modal-scroll wiring.
  const modalScrollRef = useRef<ScrollBoxHandle>(null);
  // Timestamp of the last user-initiated scroll (wheel, PgUp/PgDn, ctrl+u,
  // End/Home, G, drag-to-scroll). Stamped in composedOnScroll — the single
  // chokepoint ScrollKeybindingHandler calls for every user scroll action.
  // Programmatic scrolls (repinScroll's scrollToBottom, sticky auto-follow)
  // do NOT go through composedOnScroll, so they don't stamp this. Ref not
  // state: no re-render on every wheel tick.
  const lastUserScrollTsRef = useRef(0);

  // Synchronous state machine for the query lifecycle. Replaces the
  // error-prone dual-state pattern where isLoading (React state, async
  // batched) and isQueryRunning (ref, sync) could desync. See QueryGuard.ts.
  const queryGuard = React.useRef(new QueryGuard()).current;

  // Subscribe to the guard — true during dispatching or running.
  // This is the single source of truth for "is a local query in flight".
  const isQueryActive = React.useSyncExternalStore(queryGuard.subscribe, queryGuard.getSnapshot);

  // Separate loading flag for operations outside the local query guard:
  // remote sessions (useRemoteSession / useDirectConnect) and foregrounded
  // background tasks (useSessionBackgrounding). These don't route through
  // onQuery / queryGuard, so they need their own spinner-visibility state.
  // Initialize true if remote mode with initial prompt (CCR processing it).
  const [isExternalLoading, setIsExternalLoadingRaw] = React.useState(remoteSessionConfig?.hasInitialPrompt ?? false);

  // Derived: any loading source active. Read-only — no setter. Local query
  // loading is driven by queryGuard (reserve/tryStart/end/cancelReservation),
  // external loading by setIsExternalLoading.
  const isLoading = isQueryActive || isExternalLoading;

  // Elapsed time is computed by SpinnerWithVerb from these refs on each
  // animation frame, avoiding a useInterval that re-renders the entire REPL.
  const [userInputOnProcessing, setUserInputOnProcessingRaw] = React.useState<string | undefined>(undefined);
  // messagesRef.current.length at the moment userInputOnProcessing was set.
  // The placeholder hides once displayedMessages grows past this — i.e. the
  // real user message has landed in the visible transcript.
  const userInputBaselineRef = React.useRef(0);
  // True while the submitted prompt is being processed but its user message
  // hasn't reached setMessages yet. setMessages uses this to keep the
  // baseline in sync when unrelated async messages (bridge status, hook
  // results, scheduled tasks) land during that window.
  const userMessagePendingRef = React.useRef(false);

  // Wall-clock time tracking refs for accurate elapsed time calculation
  const loadingStartTimeRef = React.useRef<number>(0);
  const totalPausedMsRef = React.useRef(0);
  const pauseStartTimeRef = React.useRef<number | null>(null);
  const resetTimingRefs = React.useCallback(() => {
    loadingStartTimeRef.current = Date.now();
    totalPausedMsRef.current = 0;
    pauseStartTimeRef.current = null;
  }, []);

  // Reset timing refs inline when isQueryActive transitions false→true.
  // queryGuard.reserve() (in executeUserInput) fires BEFORE processUserInput's
  // first await, but the ref reset in onQuery's try block runs AFTER. During
  // that gap, React renders the spinner with loadingStartTimeRef=0, computing
  // elapsedTimeMs = Date.now() - 0 ≈ 56 years. This inline reset runs on the
  // first render where isQueryActive is observed true — the same render that
  // first shows the spinner — so the ref is correct by the time the spinner
  // reads it. See INC-4549.
  const wasQueryActiveRef = React.useRef(false);
  if (isQueryActive && !wasQueryActiveRef.current) {
    resetTimingRefs();
  }
  wasQueryActiveRef.current = isQueryActive;

  // Wrapper for setIsExternalLoading that resets timing refs on transition
  // to true — SpinnerWithVerb reads these for elapsed time, so they must be
  // reset for remote sessions / foregrounded tasks too (not just local
  // queries, which reset them in onQuery). Without this, a remote-only
  // session would show ~56 years elapsed (Date.now() - 0).
  const setIsExternalLoading = React.useCallback((value: boolean) => {
    setIsExternalLoadingRaw(value);
    if (value) resetTimingRefs();
  }, [resetTimingRefs]);

  // Start time of the first turn that had swarm teammates running
  // Used to compute total elapsed time (including teammate execution) for the deferred message
  const swarmStartTimeRef = React.useRef<number | null>(null);
  const swarmBudgetInfoRef = React.useRef<{
    tokens: number;
    limit: number;
    nudges: number;
  } | undefined>(undefined);

  // Ref to track current focusedInputDialog for use in callbacks
  // This avoids stale closures when checking dialog state in timer callbacks
  const focusedInputDialogRef = React.useRef<ReturnType<typeof getFocusedInputDialog>>(undefined);

  // How long after the last keystroke before deferred dialogs are shown
  const PROMPT_SUPPRESSION_MS = 1500;
  // True when user is actively typing — defers interrupt dialogs so keystrokes
  // don't accidentally dismiss or answer a permission prompt the user hasn't read yet.
  const [isPromptInputActive, setIsPromptInputActive] = React.useState(false);
  const [autoUpdaterResult, setAutoUpdaterResult] = useState<AutoUpdaterResult | null>(null);
  useEffect(() => {
    if (autoUpdaterResult?.notifications) {
      autoUpdaterResult.notifications.forEach(notification => {
        addNotification({
          key: 'auto-updater-notification',
          text: notification,
          priority: 'low'
        });
      });
    }
  }, [autoUpdaterResult, addNotification]);

  // tmux + fullscreen + `mouse off`: one-time hint that wheel won't scroll.
  // We no longer mutate tmux's session-scoped mouse option (it poisoned
  // sibling panes); tmux users already know this tradeoff from vim/less.
  useEffect(() => {
    if (isFullscreenEnvEnabled()) {
      void maybeGetTmuxMouseHint().then(hint => {
        if (hint) {
          addNotification({
            key: 'tmux-mouse-hint',
            text: hint,
            priority: 'low'
          });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showUndercoverCallout, setShowUndercoverCallout] = useState(false);
  useEffect(() => {
    if ("external" === 'ant') {
      void (async () => {
        // Wait for repo classification to settle (memoized, no-op if primed).
        const {
          isInternalModelRepo
        } = await import('../utils/commitAttribution.js');
        await isInternalModelRepo();
        const {
          shouldShowUndercoverAutoNotice
        } = await import('../utils/undercover.js');
        if (shouldShowUndercoverAutoNotice()) {
          setShowUndercoverCallout(true);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [toolJSX, setToolJSXInternal] = useState<{
    jsx: React.ReactNode | null;
    shouldHidePromptInput: boolean;
    shouldContinueAnimation?: true;
    showSpinner?: boolean;
    isLocalJSXCommand?: boolean;
    isImmediate?: boolean;
  } | null>(null);

  // Track local JSX commands separately so tools can't overwrite them.
  // This enables "immediate" commands (like /btw) to persist while Claude is processing.
  const localJSXCommandRef = useRef<{
    jsx: React.ReactNode | null;
    shouldHidePromptInput: boolean;
    shouldContinueAnimation?: true;
    showSpinner?: boolean;
    isLocalJSXCommand: true;
  } | null>(null);

  // Wrapper for setToolJSX that preserves local JSX commands (like /btw).
  // When a local JSX command is active, we ignore updates from tools
  // unless they explicitly set clearLocalJSX: true (from onDone callbacks).
  //
  // TO ADD A NEW IMMEDIATE COMMAND:
  // 1. Set `immediate: true` in the command definition
  // 2. Set `isLocalJSXCommand: true` when calling setToolJSX in the command's JSX
  // 3. In the onDone callback, use `setToolJSX({ jsx: null, shouldHidePromptInput: false, clearLocalJSX: true })`
  //    to explicitly clear the overlay when the user dismisses it
  const setToolJSX = useCallback((args: {
    jsx: React.ReactNode | null;
    shouldHidePromptInput: boolean;
    shouldContinueAnimation?: true;
    showSpinner?: boolean;
    isLocalJSXCommand?: boolean;
    clearLocalJSX?: boolean;
  } | null) => {
    // If setting a local JSX command, store it in the ref
    if (args?.isLocalJSXCommand) {
      const {
        clearLocalJSX: _,
        ...rest
      } = args;
      localJSXCommandRef.current = {
        ...rest,
        isLocalJSXCommand: true
      };
      setToolJSXInternal(rest);
      return;
    }

    // If there's an active local JSX command in the ref
    if (localJSXCommandRef.current) {
      // Allow clearing only if explicitly requested (from onDone callbacks)
      if (args?.clearLocalJSX) {
        localJSXCommandRef.current = null;
        setToolJSXInternal(null);
        return;
      }
      // Otherwise, keep the local JSX command visible - ignore tool updates
      return;
    }

    // No active local JSX command, allow any update
    if (args?.clearLocalJSX) {
      setToolJSXInternal(null);
      return;
    }
    setToolJSXInternal(args);
  }, []);
  const [toolUseConfirmQueue, setToolUseConfirmQueue] = useState<ToolUseConfirm[]>([]);
  // Sticky footer JSX registered by permission request components (currently
  // only ExitPlanModePermissionRequest). Renders in FullscreenLayout's `bottom`
  // slot so response options stay visible while the user scrolls a long plan.
  const [permissionStickyFooter, setPermissionStickyFooter] = useState<React.ReactNode | null>(null);
  const [sandboxPermissionRequestQueue, setSandboxPermissionRequestQueue] = useState<Array<{
    hostPattern: NetworkHostPattern;
    resolvePromise: (allowConnection: boolean) => void;
  }>>([]);
  const [promptQueue, setPromptQueue] = useState<Array<{
    request: PromptRequest;
    title: string;
    toolInputSummary?: string | null;
    resolve: (response: PromptResponse) => void;
    reject: (error: Error) => void;
  }>>([]);

  // Track bridge cleanup functions for sandbox permission requests so the
  // local dialog handler can cancel the remote prompt when the local user
  // responds first. Keyed by host to support concurrent same-host requests.
  const sandboxBridgeCleanupRef = useRef<Map<string, Array<() => void>>>(new Map());

  // -- Terminal title management
  // Session title (set via /rename or restored on resume) wins over
  // the agent name, which wins over the Haiku-extracted topic;
  // all fall back to the product name.
  const terminalTitleFromRename = useAppState(s => s.settings.terminalTitleFromRename) !== false;
  const sessionTitle = terminalTitleFromRename ? getCurrentSessionTitle(getSessionId()) : undefined;
  const [haikuTitle, setHaikuTitle] = useState<string>();
  // Gates the one-shot Haiku call that generates the tab title. Seeded true
  // on resume (initialMessages present) so we don't re-title a resumed
  // session from mid-conversation context.
  const haikuTitleAttemptedRef = useRef((initialMessages?.length ?? 0) > 0);
  const agentTitle = mainThreadAgentDefinition?.agentType;
  const terminalTitle = sessionTitle ?? agentTitle ?? haikuTitle ?? 'Claude Code';
  const isWaitingForApproval = toolUseConfirmQueue.length > 0 || promptQueue.length > 0 || pendingWorkerRequest || pendingSandboxRequest;
  // Local-jsx commands (like /plugin, /config) show user-facing dialogs that
  // wait for input. Require jsx != null — if the flag is stuck true but jsx
  // is null, treat as not-showing so TextInput focus and queue processor
  // aren't deadlocked by a phantom overlay.
  const isShowingLocalJSXCommand = toolJSX?.isLocalJSXCommand === true && toolJSX?.jsx != null;
  const titleIsAnimating = isLoading && !isWaitingForApproval && !isShowingLocalJSXCommand;
  // Title animation state lives in <AnimatedTerminalTitle> so the 960ms tick
  // doesn't re-render REPL. titleDisabled/terminalTitle are still computed
  // here because onQueryImpl reads them (background session description,
  // haiku title extraction gate).

  // Prevent macOS from sleeping while Claude is working
  useEffect(() => {
    if (isLoading && !isWaitingForApproval && !isShowingLocalJSXCommand) {
      startPreventSleep();
      return () => stopPreventSleep();
    }
  }, [isLoading, isWaitingForApproval, isShowingLocalJSXCommand]);
  const sessionStatus: TabStatusKind = isWaitingForApproval || isShowingLocalJSXCommand ? 'waiting' : isLoading ? 'busy' : 'idle';
  const waitingFor = sessionStatus !== 'waiting' ? undefined : toolUseConfirmQueue.length > 0 ? `approve ${toolUseConfirmQueue[0]!.tool.name}` : pendingWorkerRequest ? 'worker request' : pendingSandboxRequest ? 'sandbox request' : isShowingLocalJSXCommand ? 'dialog open' : 'input needed';

  // Push status to the PID file for `claude ps`. Fire-and-forget; ps falls
  // back to transcript-tail derivation when this is missing/stale.
  useEffect(() => {
    if (feature('BG_SESSIONS')) {
      void updateSessionActivity({
        status: sessionStatus,
        waitingFor
      });
    }
  }, [sessionStatus, waitingFor]);

  // 3P default: off — OSC 21337 is ant-only while the spec stabilizes.
  // Gated so we can roll back if the sidebar indicator conflicts with
  // the title spinner in terminals that render both. When the flag is
  // on, the user-facing config setting controls whether it's active.
  const tabStatusGateEnabled = getFeatureValue_CACHED_MAY_BE_STALE('tengu_terminal_sidebar', false);
  const showStatusInTerminalTab = tabStatusGateEnabled && (getGlobalConfig().showStatusInTerminalTab ?? false);
  useTabStatus(titleDisabled || !showStatusInTerminalTab ? null : sessionStatus);

  // Register the leader's setToolUseConfirmQueue for in-process teammates
  useEffect(() => {
    registerLeaderToolUseConfirmQueue(setToolUseConfirmQueue);
    return () => unregisterLeaderToolUseConfirmQueue();
  }, [setToolUseConfirmQueue]);
  const [messages, rawSetMessages] = useState<MessageType[]>(initialMessages ?? []);
  const messagesRef = useRef(messages);
  // Stores the willowMode variant that was shown (or false if no hint shown).
  // Captured at hint_shown time so hint_converted telemetry reports the same
  // variant — the GrowthBook value shouldn't change mid-session, but reading
  // it once guarantees consistency between the paired events.
  const idleHintShownRef = useRef<string | false>(false);
  // Wrap setMessages so messagesRef is always current the instant the
  // call returns — not when React later processes the batch.  Apply the
  // updater eagerly against the ref, then hand React the computed value
  // (not the function).  rawSetMessages batching becomes last-write-wins,
  // and the last write is correct because each call composes against the
  // already-updated ref.  This is the Zustand pattern: ref is source of
  // truth, React state is the render projection.  Without this, paths
  // that queue functional updaters then synchronously read the ref
  // (e.g. handleSpeculationAccept → onQuery) see stale data.
  const setMessages = useCallback((action: React.SetStateAction<MessageType[]>) => {
    const prev = messagesRef.current;
    const next = typeof action === 'function' ? action(messagesRef.current) : action;
    messagesRef.current = next;
    if (next.length < userInputBaselineRef.current) {
      // Shrank (compact/rewind/clear) — clamp so placeholderText's length
      // check can't go stale.
      userInputBaselineRef.current = 0;
    } else if (next.length > prev.length && userMessagePendingRef.current) {
      // Grew while the submitted user message hasn't landed yet. If the
      // added messages don't include it (bridge status, hook results,
      // scheduled tasks landing async during processUserInputBase), bump
      // baseline so the placeholder stays visible. Once the user message
      // lands, stop tracking — later additions (assistant stream) should
      // not re-show the placeholder.
      const delta = next.length - prev.length;
      const added = prev.length === 0 || next[0] === prev[0] ? next.slice(-delta) : next.slice(0, delta);
      if (added.some(isHumanTurn)) {
        userMessagePendingRef.current = false;
      } else {
        userInputBaselineRef.current = next.length;
      }
    }
    rawSetMessages(next);
  }, []);
  // Capture the baseline message count alongside the placeholder text so
  // the render can hide it once displayedMessages grows past the baseline.
  const setUserInputOnProcessing = useCallback((input: string | undefined) => {
    if (input !== undefined) {
      userInputBaselineRef.current = messagesRef.current.length;
      userMessagePendingRef.current = true;
    } else {
      userMessagePendingRef.current = false;
    }
    setUserInputOnProcessingRaw(input);
  }, []);
  // Fullscreen: track the unseen-divider position. dividerIndex changes
  // only ~twice/scroll-session (first scroll-away + repin). pillVisible
  // and stickyPrompt now live in FullscreenLayout — they subscribe to
  // ScrollBox directly so per-frame scroll never re-renders REPL.
  const {
    dividerIndex,
    dividerYRef,
    onScrollAway,
    onRepin,
    jumpToNew,
    shiftDivider
  } = useUnseenDivider(messages.length);
  if (feature('AWAY_SUMMARY')) {
    // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
    useAwaySummary(messages, setMessages, isLoading);
  }
  const [cursor, setCursor] = useState<MessageActionsState | null>(null);
  const cursorNavRef = useRef<MessageActionsNav | null>(null);
  // Memoized so Messages' React.memo holds.
  const unseenDivider = useMemo(() => computeUnseenDivider(messages, dividerIndex),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- length change covers appends; useUnseenDivider's count-drop guard clears dividerIndex on replace/rewind
  [dividerIndex, messages.length]);
  // Re-pin scroll to bottom and clear the unseen-messages baseline. Called
  // on any user-driven return-to-live action (submit, type-into-empty,
  // overlay appear/dismiss).
  const repinScroll = useCallback(() => {
    scrollRef.current?.scrollToBottom();
    onRepin();
    setCursor(null);
  }, [onRepin, setCursor]);
  // Backstop for the submit-handler repin at onSubmit. If a buffered stdin
  // event (wheel/drag) races between handler-fire and state-commit, the
  // handler's scrollToBottom can be undone. This effect fires on the render
  // where the user's message actually lands — tied to React's commit cycle,
  // so it can't race with stdin. Keyed on lastMsg identity (not messages.length)
  // so useAssistantHistory's prepends don't spuriously repin.
  const lastMsg = messages.at(-1);
  const lastMsgIsHuman = lastMsg != null && isHumanTurn(lastMsg);
  useEffect(() => {
    if (lastMsgIsHuman) {
      repinScroll();
    }
  }, [lastMsgIsHuman, lastMsg, repinScroll]);
  // Assistant-chat: lazy-load remote history on scroll-up. No-op unless
  // KAIROS build + config.viewerOnly. feature() is build-time constant so
  // the branch is dead-code-eliminated in non-KAIROS builds (same pattern
  // as useUnseenDivider above).
  const {
    maybeLoadOlder
  } = feature('KAIROS') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useAssistantHistory({
    config: remoteSessionConfig,
    setMessages,
    scrollRef,
    onPrepend: shiftDivider
  }) : HISTORY_STUB;
  // Compose useUnseenDivider's callbacks with the lazy-load trigger.
  const composedOnScroll = useCallback((sticky: boolean, handle: ScrollBoxHandle) => {
    lastUserScrollTsRef.current = Date.now();
    if (sticky) {
      onRepin();
    } else {
      onScrollAway(handle);
      if (feature('KAIROS')) maybeLoadOlder(handle);
      // Dismiss the companion bubble on scroll — it's absolute-positioned
      // at bottom-right and covers transcript content. Scrolling = user is
      // trying to read something under it.
      if (feature('BUDDY')) {
        setAppState(prev => prev.companionReaction === undefined ? prev : {
          ...prev,
          companionReaction: undefined
        });
      }
    }
  }, [onRepin, onScrollAway, maybeLoadOlder, setAppState]);
  // Deferred SessionStart hook messages — REPL renders immediately and
  // hook messages are injected when they resolve. awaitPendingHooks()
  // must be called before the first API call so the model sees hook context.
  const awaitPendingHooks = useDeferredHookMessages(pendingHookMessages, setMessages);

  // Deferred messages for the Messages component — renders at transition
  // priority so the reconciler yields every 5ms, keeping input responsive
  // while the expensive message processing pipeline runs.
  const deferredMessages = useDeferredValue(messages);
  const deferredBehind = messages.length - deferredMessages.length;
  if (deferredBehind > 0) {
    logForDebugging(`[useDeferredValue] Messages deferred by ${deferredBehind} (${deferredMessages.length}→${messages.length})`);
  }

  // Frozen state for transcript mode - stores lengths instead of cloning arrays for memory efficiency
  const [frozenTranscriptState, setFrozenTranscriptState] = useState<{
    messagesLength: number;
    streamingToolUsesLength: number;
  } | null>(null);
  // Initialize input with any early input that was captured before REPL was ready.
  // Using lazy initialization ensures cursor offset is set correctly in PromptInput.
  const [inputValue, setInputValueRaw] = useState(() => consumeEarlyInput());
  const inputValueRef = useRef(inputValue);
  inputValueRef.current = inputValue;
  const insertTextRef = useRef<{
    insert: (text: string) => void;
    setInputWithCursor: (value: string, cursor: number) => void;
    cursorOffset: number;
  } | null>(null);

  // Wrap setInputValue to co-locate suppression state updates.
  // Both setState calls happen in the same synchronous context so React
  // batches them into a single render, eliminating the extra render that
  // the previous useEffect → setState pattern caused.
  const setInputValue = useCallback((value: string) => {
    if (trySuggestBgPRIntercept(inputValueRef.current, value)) return;
    // In fullscreen mode, typing into an empty prompt re-pins scroll to
    // bottom. Only fires on empty→non-empty so scrolling up to reference
    // something while composing a message doesn't yank the view back on
    // every keystroke. Restores the pre-fullscreen muscle memory of
    // typing to snap back to the end of the conversation.
    // Skipped if the user scrolled within the last 3s — they're actively
    // reading, not lost. lastUserScrollTsRef starts at 0 so the first-
    // ever keypress (no scroll yet) always repins.
    if (inputValueRef.current === '' && value !== '' && Date.now() - lastUserScrollTsRef.current >= RECENT_SCROLL_REPIN_WINDOW_MS) {
      repinScroll();
    }
    // Sync ref immediately (like setMessages) so callers that read
    // inputValueRef before React commits — e.g. the auto-restore finally
    // block's `=== ''` guard — see the fresh value, not the stale render.
    inputValueRef.current = value;
    setInputValueRaw(value);
    setIsPromptInputActive(value.trim().length > 0);
  }, [setIsPromptInputActive, repinScroll, trySuggestBgPRIntercept]);

  // Schedule a timeout to stop suppressing dialogs after the user stops typing.
  // Only manages the timeout — the immediate activation is handled by setInputValue above.
  useEffect(() => {
    if (inputValue.trim().length === 0) return;
    const timer = setTimeout(setIsPromptInputActive, PROMPT_SUPPRESSION_MS, false);
    return () => clearTimeout(timer);
  }, [inputValue]);
  const [inputMode, setInputMode] = useState<PromptInputMode>('prompt');
  const [stashedPrompt, setStashedPrompt] = useState<{
    text: string;
    cursorOffset: number;
    pastedContents: Record<number, PastedContent>;
  } | undefined>();

  // Callback to filter commands based on CCR's available slash commands
  const handleRemoteInit = useCallback((remoteSlashCommands: string[]) => {
    const remoteCommandSet = new Set(remoteSlashCommands);
    // Keep commands that CCR lists OR that are in the local-safe set
    setLocalCommands(prev => prev.filter(cmd => remoteCommandSet.has(cmd.name) || REMOTE_SAFE_COMMANDS.has(cmd)));
  }, [setLocalCommands]);
  const [inProgressToolUseIDs, setInProgressToolUseIDs] = useState<Set<string>>(new Set());
  const hasInterruptibleToolInProgressRef = useRef(false);

  // Remote session hook - manages WebSocket connection and message handling for --remote mode
  const remoteSession = useRemoteSession({
    config: remoteSessionConfig,
    setMessages,
    setIsLoading: setIsExternalLoading,
    onInit: handleRemoteInit,
    setToolUseConfirmQueue,
    tools: combinedInitialTools,
    setStreamingToolUses,
    setStreamMode,
    setInProgressToolUseIDs
  });

  // Direct connect hook - manages WebSocket to a claude server for `claude connect` mode
  const directConnect = useDirectConnect({
    config: directConnectConfig,
    setMessages,
    setIsLoading: setIsExternalLoading,
    setToolUseConfirmQueue,
    tools: combinedInitialTools
  });

  // SSH session hook - manages ssh child process for `claude ssh` mode.
  // Same callback shape as useDirectConnect; only the transport under the
  // hood differs (ChildProcess stdin/stdout vs WebSocket).
  const sshRemote = useSSHSession({
    session: sshSession,
    setMessages,
    setIsLoading: setIsExternalLoading,
    setToolUseConfirmQueue,
    tools: combinedInitialTools
  });

  // Use whichever remote mode is active
  const activeRemote = sshRemote.isRemoteMode ? sshRemote : directConnect.isRemoteMode ? directConnect : remoteSession;
  const [pastedContents, setPastedContents] = useState<Record<number, PastedContent>>({});
  const [submitCount, setSubmitCount] = useState(0);
  // Ref instead of state to avoid triggering React re-renders on every
  // streaming text_delta. The spinner reads this via its animation timer.
  const responseLengthRef = useRef(0);
  // API performance metrics ref for ant-only spinner display (TTFT/OTPS).
  // Accumulates metrics from all API requests in a turn for P50 aggregation.
  const apiMetricsRef = useRef<Array<{
    ttftMs: number;
    firstTokenTime: number;
    lastTokenTime: number;
    responseLengthBaseline: number;
    // Tracks responseLengthRef at the time of the last content addition.
    // Updated by both streaming deltas and subagent message content.
    // lastTokenTime is also updated at the same time, so the OTPS
    // denominator correctly includes subagent processing time.
    endResponseLength: number;
  }>>([]);
  const setResponseLength = useCallback((f: (prev: number) => number) => {
    const prev = responseLengthRef.current;
    responseLengthRef.current = f(prev);
    // When content is added (not a compaction reset), update the latest
    // metrics entry so OTPS reflects all content generation activity.
    // Updating lastTokenTime here ensures the denominator includes both
    // streaming time AND subagent execution time, preventing inflation.
    if (responseLengthRef.current > prev) {
      const entries = apiMetricsRef.current;
      if (entries.length > 0) {
        const lastEntry = entries.at(-1)!;
        lastEntry.lastTokenTime = Date.now();
        lastEntry.endResponseLength = responseLengthRef.current;
      }
    }
  }, []);

  // Streaming text display: set state directly per delta (Ink's 16ms render
  // throttle batches rapid updates). Cleared on message arrival (messages.ts)
  // so displayedMessages switches from deferredMessages to messages atomically.
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const reducedMotion = useAppState(s => s.settings.prefersReducedMotion) ?? false;
  const showStreamingText = !reducedMotion && !hasCursorUpViewportYankBug();
  const onStreamingText = useCallback((f: (current: string | null) => string | null) => {
    if (!showStreamingText) return;
    setStreamingText(f);
  }, [showStreamingText]);

  // Hide the in-progress source line so text streams line-by-line, not
  // char-by-char. lastIndexOf returns -1 when no newline, giving '' → null.
  // Guard on showStreamingText so toggling reducedMotion mid-stream
  // immediately hides the streaming preview.
  const visibleStreamingText = streamingText && showStreamingText ? streamingText.substring(0, streamingText.lastIndexOf('\n') + 1) || null : null;
  const [lastQueryCompletionTime, setLastQueryCompletionTime] = useState(0);
  const [spinnerMessage, setSpinnerMessage] = useState<string | null>(null);
  const [spinnerColor, setSpinnerColor] = useState<keyof Theme | null>(null);
  const [spinnerShimmerColor, setSpinnerShimmerColor] = useState<keyof Theme | null>(null);
  const [isMessageSelectorVisible, setIsMessageSelectorVisible] = useState(false);
  const [messageSelectorPreselect, setMessageSelectorPreselect] = useState<UserMessage | undefined>(undefined);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [conversationId, setConversationId] = useState(randomUUID());

  // Idle-return dialog: shown when user submits after a long idle gap
  const [idleReturnPending, setIdleReturnPending] = useState<{
    input: string;
    idleMinutes: number;
  } | null>(null);
  const skipIdleCheckRef = useRef(false);
  const lastQueryCompletionTimeRef = useRef(lastQueryCompletionTime);
  lastQueryCompletionTimeRef.current = lastQueryCompletionTime;

  // Aggregate tool result budget: per-conversation decision tracking.
  // When the GrowthBook flag is on, query.ts enforces the budget; when
  // off (undefined), enforcement is skipped entirely. Stale entries after
  // /clear, rewind, or compact are harmless (tool_use_ids are UUIDs, stale
  // keys are never looked up). Memory is bounded by total replacement count
  // × ~2KB preview over the REPL lifetime — negligible.
  //
  // Lazy init via useState initializer — useRef(expr) evaluates expr on every
  // render (React ignores it after first, but the computation still runs).
  // For large resumed sessions, reconstruction does O(messages × blocks)
  // work; we only want that once.
  const [contentReplacementStateRef] = useState(() => ({
    current: provisionContentReplacementState(initialMessages, initialContentReplacements)
  }));
  const [haveShownCostDialog, setHaveShownCostDialog] = useState(getGlobalConfig().hasAcknowledgedCostThreshold);
  const [vimMode, setVimMode] = useState<VimMode>('INSERT');
  const [showBashesDialog, setShowBashesDialog] = useState<string | boolean>(false);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // showBashesDialog is REPL-level so it survives PromptInput unmounting.
  // When ultraplan approval fires while the pill dialog is open, PromptInput
  // unmounts (focusedInputDialog → 'ultraplan-choice') but this stays true;
  // after accepting, PromptInput remounts into an empty "No tasks" dialog
  // (the completed ultraplan task has been filtered out). Close it here.
  useEffect(() => {
    if (ultraplanPendingChoice && showBashesDialog) {
      setShowBashesDialog(false);
    }
  }, [ultraplanPendingChoice, showBashesDialog]);
  const isTerminalFocused = useTerminalFocus();
  const terminalFocusRef = useRef(isTerminalFocused);
  terminalFocusRef.current = isTerminalFocused;
  const [theme] = useTheme();

  // resetLoadingState runs twice per turn (onQueryImpl tail + onQuery finally).
  // Without this guard, both calls pick a tip → two recordShownTip → two
  // saveGlobalConfig writes back-to-back. Reset at submit in onSubmit.
  const tipPickedThisTurnRef = React.useRef(false);
  const pickNewSpinnerTip = useCallback(() => {
    if (tipPickedThisTurnRef.current) return;
    tipPickedThisTurnRef.current = true;
    const newMessages = messagesRef.current.slice(bashToolsProcessedIdx.current);
    for (const tool of extractBashToolsFromMessages(newMessages)) {
      bashTools.current.add(tool);
    }
    bashToolsProcessedIdx.current = messagesRef.current.length;
    void getTipToShowOnSpinner({
      theme,
      readFileState: readFileState.current,
      bashTools: bashTools.current
    }).then(async tip => {
      if (tip) {
        const content = await tip.content({
          theme
        });
        setAppState(prev => ({
          ...prev,
          spinnerTip: content
        }));
        recordShownTip(tip);
      } else {
        setAppState(prev => {
          if (prev.spinnerTip === undefined) return prev;
          return {
            ...prev,
            spinnerTip: undefined
          };
        });
      }
    });
  }, [setAppState, theme]);

  // Resets UI loading state. Does NOT call onTurnComplete - that should be
  // called explicitly only when a query turn actually completes.
  const resetLoadingState = useCallback(() => {
    // isLoading is now derived from queryGuard — no setter call needed.
    // queryGuard.end() (onQuery finally) or cancelReservation() (executeUserInput
    // finally) have already transitioned the guard to idle by the time this runs.
    // External loading (remote/backgrounding) is reset separately by those hooks.
    setIsExternalLoading(false);
    setUserInputOnProcessing(undefined);
    responseLengthRef.current = 0;
    apiMetricsRef.current = [];
    setStreamingText(null);
    setStreamingToolUses([]);
    setSpinnerMessage(null);
    setSpinnerColor(null);
    setSpinnerShimmerColor(null);
    pickNewSpinnerTip();
    endInteractionSpan();
    // Speculative bash classifier checks are only valid for the current
    // turn's commands — clear after each turn to avoid accumulating
    // Promise chains for unconsumed checks (denied/aborted paths).
    clearSpeculativeChecks();
  }, [pickNewSpinnerTip]);

  // Session backgrounding — hook is below, after getToolUseContext

  const hasRunningTeammates = useMemo(() => getAllInProcessTeammateTasks(tasks).some(t => t.status === 'running'), [tasks]);

  // Show deferred turn duration message once all swarm teammates finish
  useEffect(() => {
    if (!hasRunningTeammates && swarmStartTimeRef.current !== null) {
      const totalMs = Date.now() - swarmStartTimeRef.current;
      const deferredBudget = swarmBudgetInfoRef.current;
      swarmStartTimeRef.current = null;
      swarmBudgetInfoRef.current = undefined;
      setMessages(prev => [...prev, createTurnDurationMessage(totalMs, deferredBudget,
      // Count only what recordTranscript will persist — ephemeral
      // progress ticks and non-ant attachments are filtered by
      // isLoggableMessage and never reach disk. Using raw prev.length
      // would make checkResumeConsistency report false delta<0 for
      // every turn that ran a progress-emitting tool.
      count(prev, isLoggableMessage))]);
    }
  }, [hasRunningTeammates, setMessages]);

  // Show auto permissions warning when entering auto mode
  // (either via Shift+Tab toggle or on startup). Debounced to avoid
  // flashing when the user is cycling through modes quickly.
  // Only shown 3 times total across sessions.
  const safeYoloMessageShownRef = useRef(false);
  useEffect(() => {
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      if (toolPermissionContext.mode !== 'auto') {
        safeYoloMessageShownRef.current = false;
        return;
      }
      if (safeYoloMessageShownRef.current) return;
      const config = getGlobalConfig();
      const count = config.autoPermissionsNotificationCount ?? 0;
      if (count >= 3) return;
      const timer = setTimeout((ref, setMessages) => {
        ref.current = true;
        saveGlobalConfig(prev => {
          const prevCount = prev.autoPermissionsNotificationCount ?? 0;
          if (prevCount >= 3) return prev;
          return {
            ...prev,
            autoPermissionsNotificationCount: prevCount + 1
          };
        });
        setMessages(prev => [...prev, createSystemMessage(AUTO_MODE_DESCRIPTION, 'warning')]);
      }, 800, safeYoloMessageShownRef, setMessages);
      return () => clearTimeout(timer);
    }
  }, [toolPermissionContext.mode, setMessages]);

  // If worktree creation was slow and sparse-checkout isn't configured,
  // nudge the user toward settings.worktree.sparsePaths.
  const worktreeTipShownRef = useRef(false);
  useEffect(() => {
    if (worktreeTipShownRef.current) return;
    const wt = getCurrentWorktreeSession();
    if (!wt?.creationDurationMs || wt.usedSparsePaths) return;
    if (wt.creationDurationMs < 15_000) return;
    worktreeTipShownRef.current = true;
    const secs = Math.round(wt.creationDurationMs / 1000);
    setMessages(prev => [...prev, createSystemMessage(`Worktree creation took ${secs}s. For large repos, set \`worktree.sparsePaths\` in .claude/settings.json to check out only the directories you need — e.g. \`{"worktree": {"sparsePaths": ["src", "packages/foo"]}}\`.`, 'info')]);
  }, [setMessages]);

  // Hide spinner when the only in-progress tool is Sleep
  const onlySleepToolActive = useMemo(() => {
    const lastAssistant = messages.findLast(m => m.type === 'assistant');
    if (lastAssistant?.type !== 'assistant') return false;
    const inProgressToolUses = lastAssistant.message.content.filter(b => b.type === 'tool_use' && inProgressToolUseIDs.has(b.id));
    return inProgressToolUses.length > 0 && inProgressToolUses.every(b => b.type === 'tool_use' && b.name === SLEEP_TOOL_NAME);
  }, [messages, inProgressToolUseIDs]);
  const {
    onBeforeQuery: mrOnBeforeQuery,
    onTurnComplete: mrOnTurnComplete,
    render: mrRender
  } = useMoreRight({
    enabled: moreRightEnabled,
    setMessages,
    inputValue,
    setInputValue,
    setToolJSX
  });
  const showSpinner = (!toolJSX || toolJSX.showSpinner === true) && toolUseConfirmQueue.length === 0 && promptQueue.length === 0 && (
  // Show spinner during input processing, API call, while teammates are running,
  // or while pending task notifications are queued (prevents spinner bounce between consecutive notifications)
  isLoading || userInputOnProcessing || hasRunningTeammates ||
  // Keep spinner visible while task notifications are queued for processing.
  // Without this, the spinner briefly disappears between consecutive notifications
  // (e.g., multiple background agents completing in rapid succession) because
  // isLoading goes false momentarily between processing each one.
  getCommandQueueLength() > 0) &&
  // Hide spinner when waiting for leader to approve permission request
  !pendingWorkerRequest && !onlySleepToolActive && (
  // Hide spinner when streaming text is visible (the text IS the feedback),
  // but keep it when isBriefOnly suppresses the streaming text display
  !visibleStreamingText || isBriefOnly);

  // Check if any permission or ask question prompt is currently visible
  // This is used to prevent the survey from opening while prompts are active
  const hasActivePrompt = toolUseConfirmQueue.length > 0 || promptQueue.length > 0 || sandboxPermissionRequestQueue.length > 0 || elicitation.queue.length > 0 || workerSandboxPermissions.queue.length > 0;
  const feedbackSurveyOriginal = useFeedbackSurvey(messages, isLoading, submitCount, 'session', hasActivePrompt);
  const skillImprovementSurvey = useSkillImprovementSurvey(setMessages);
  const showIssueFlagBanner = useIssueFlagBanner(messages, submitCount);

  // Wrap feedback survey handler to trigger auto-run /issue
  const feedbackSurvey = useMemo(() => ({
    ...feedbackSurveyOriginal,
    handleSelect: (selected: 'dismissed' | 'bad' | 'fine' | 'good') => {
      // Reset the ref when a new survey response comes in
      didAutoRunIssueRef.current = false;
      const showedTranscriptPrompt = feedbackSurveyOriginal.handleSelect(selected);
      // Auto-run /issue for "bad" if transcript prompt wasn't shown
      if (selected === 'bad' && !showedTranscriptPrompt && shouldAutoRunIssue('feedback_survey_bad')) {
        setAutoRunIssueReason('feedback_survey_bad');
        didAutoRunIssueRef.current = true;
      }
    }
  }), [feedbackSurveyOriginal]);

  // Post-compact survey: shown after compaction if feature gate is enabled
  const postCompactSurvey = usePostCompactSurvey(messages, isLoading, hasActivePrompt, {
    enabled: !isRemoteSession
  });

  // Memory survey: shown when the assistant mentions memory and a memory file
  // was read this conversation
  const memorySurvey = useMemorySurvey(messages, isLoading, hasActivePrompt, {
    enabled: !isRemoteSession
  });

  // Frustration detection: show transcript sharing prompt after detecting frustrated messages
  const frustrationDetection = useFrustrationDetection(messages, isLoading, hasActivePrompt, feedbackSurvey.state !== 'closed' || postCompactSurvey.state !== 'closed' || memorySurvey.state !== 'closed');

  // Initialize IDE integration
  useIDEIntegration({
    autoConnectIdeFlag,
    ideToInstallExtension,
    setDynamicMcpConfig,
    setShowIdeOnboarding,
    setIDEInstallationState: setIDEInstallationStatus
  });
  useFileHistorySnapshotInit(initialFileHistorySnapshots, fileHistory, fileHistoryState => setAppState(prev => ({
    ...prev,
    fileHistory: fileHistoryState
  })));
  const resume = useCallback(async (sessionId: UUID, log: LogOption, entrypoint: ResumeEntrypoint) => {
    const resumeStart = performance.now();
    try {
      // Deserialize messages to properly clean up the conversation
      // This filters unresolved tool uses and adds a synthetic assistant message if needed
      const messages = deserializeMessages(log.messages);

      // Match coordinator/normal mode to the resumed session
      if (feature('COORDINATOR_MODE')) {
        /* eslint-disable @typescript-eslint/no-require-imports */
        const coordinatorModule = require('../coordinator/coordinatorMode.js') as typeof import('../coordinator/coordinatorMode.js');
        /* eslint-enable @typescript-eslint/no-require-imports */
        const warning = coordinatorModule.matchSessionMode(log.mode);
        if (warning) {
          // Re-derive agent definitions after mode switch so built-in agents
          // reflect the new coordinator/normal mode
          /* eslint-disable @typescript-eslint/no-require-imports */
          const {
            getAgentDefinitionsWithOverrides,
            getActiveAgentsFromList
          } = require('../tools/AgentTool/loadAgentsDir.js') as typeof import('../tools/AgentTool/loadAgentsDir.js');
          /* eslint-enable @typescript-eslint/no-require-imports */
          getAgentDefinitionsWithOverrides.cache.clear?.();
          const freshAgentDefs = await getAgentDefinitionsWithOverrides(getOriginalCwd());
          setAppState(prev => ({
            ...prev,
            agentDefinitions: {
              ...freshAgentDefs,
              allAgents: freshAgentDefs.allAgents,
              activeAgents: getActiveAgentsFromList(freshAgentDefs.allAgents)
            }
          }));
          messages.push(createSystemMessage(warning, 'warning'));
        }
      }

      // Fire SessionEnd hooks for the current session before starting the
      // resumed one, mirroring the /clear flow in conversation.ts.
      const sessionEndTimeoutMs = getSessionEndHookTimeoutMs();
      await executeSessionEndHooks('resume', {
        getAppState: () => store.getState(),
        setAppState,
        signal: AbortSignal.timeout(sessionEndTimeoutMs),
        timeoutMs: sessionEndTimeoutMs
      });

      // Process session start hooks for resume
      const hookMessages = await processSessionStartHooks('resume', {
        sessionId,
        agentType: mainThreadAgentDefinition?.agentType,
        model: mainLoopModel
      });

      // Append hook messages to the conversation
      messages.push(...hookMessages);
      // For forks, generate a new plan slug and copy the plan content so the
      // original and forked sessions don't clobber each other's plan files.
      // For regular resumes, reuse the original session's plan slug.
      if (entrypoint === 'fork') {
        void copyPlanForFork(log, asSessionId(sessionId));
      } else {
        void copyPlanForResume(log, asSessionId(sessionId));
      }

      // Restore file history and attribution state from the resumed conversation
      restoreSessionStateFromLog(log, setAppState);
      if (log.fileHistorySnapshots) {
        void copyFileHistoryForResume(log);
      }

      // Restore agent setting from the resumed conversation
      // Always reset to the new session's values (or clear if none),
      // matching the standaloneAgentContext pattern below
      const {
        agentDefinition: restoredAgent
      } = restoreAgentFromSession(log.agentSetting, initialMainThreadAgentDefinition, agentDefinitions);
      setMainThreadAgentDefinition(restoredAgent);
      setAppState(prev => ({
        ...prev,
        agent: restoredAgent?.agentType
      }));

      // Restore standalone agent context from the resumed conversation
      // Always reset to the new session's values (or clear if none)
      setAppState(prev => ({
        ...prev,
        standaloneAgentContext: computeStandaloneAgentContext(log.agentName, log.agentColor)
      }));
      void updateSessionName(log.agentName);

      // Restore read file state from the message history
      restoreReadFileState(messages, log.projectPath ?? getOriginalCwd());

      // Clear any active loading state (no queryId since we're not in a query)
      resetLoadingState();
      setAbortController(null);
      setConversationId(sessionId);

      // Get target session's costs BEFORE saving current session
      // (saveCurrentSessionCosts overwrites the config, so we need to read first)
      const targetSessionCosts = getStoredSessionCosts(sessionId);

      // Save current session's costs before switching to avoid losing accumulated costs
      saveCurrentSessionCosts();

      // Reset cost state for clean slate before restoring target session
      resetCostState();

      // Switch session (id + project dir atomically). fullPath may point to
      // a different project (cross-worktree, /branch); null derives from
      // current originalCwd.
      switchSession(asSessionId(sessionId), log.fullPath ? dirname(log.fullPath) : null);
      // Rename asciicast recording to match the resumed session ID
      const {
        renameRecordingForSession
      } = await import('../utils/asciicast.js');
      await renameRecordingForSession();
      await resetSessionFilePointer();

      // Clear then restore session metadata so it's re-appended on exit via
      // reAppendSessionMetadata. clearSessionMetadata must be called first:
      // restoreSessionMetadata only sets-if-truthy, so without the clear,
      // a session without an agent name would inherit the previous session's
      // cached name and write it to the wrong transcript on first message.
      clearSessionMetadata();
      restoreSessionMetadata(log);
      // Resumed sessions shouldn't re-title from mid-conversation context
      // (same reasoning as the useRef seed), and the previous session's
      // Haiku title shouldn't carry over.
      haikuTitleAttemptedRef.current = true;
      setHaikuTitle(undefined);

      // Exit any worktree a prior /resume entered, then cd into the one
      // this session was in. Without the exit, resuming from worktree B
      // to non-worktree C leaves cwd/currentWorktreeSession stale;
      // resuming B→C where C is also a worktree fails entirely
      // (getCurrentWorktreeSession guard blocks the switch).
      //
      // Skipped for /branch: forkLog doesn't carry worktreeSession, so
      // this would kick the user out of a worktree they're still working
      // in. Same fork skip as processResumedConversation for the adopt —
      // fork materializes its own file via recordTranscript on REPL mount.
      if (entrypoint !== 'fork') {
        exitRestoredWorktree();
        restoreWorktreeForResume(log.worktreeSession);
        adoptResumedSessionFile();
        void restoreRemoteAgentTasks({
          abortController: new AbortController(),
          getAppState: () => store.getState(),
          setAppState
        });
      } else {
        // Fork: same re-persist as /clear (conversation.ts). The clear
        // above wiped currentSessionWorktree, forkLog doesn't carry it,
        // and the process is still in the same worktree.
        const ws = getCurrentWorktreeSession();
        if (ws) saveWorktreeState(ws);
      }

      // Persist the current mode so future resumes know what mode this session was in
      if (feature('COORDINATOR_MODE')) {
        /* eslint-disable @typescript-eslint/no-require-imports */
        const {
          saveMode
        } = require('../utils/sessionStorage.js');
        const {
          isCoordinatorMode
        } = require('../coordinator/coordinatorMode.js') as typeof import('../coordinator/coordinatorMode.js');
        /* eslint-enable @typescript-eslint/no-require-imports */
        saveMode(isCoordinatorMode() ? 'coordinator' : 'normal');
      }

      // Restore target session's costs from the data we read earlier
      if (targetSessionCosts) {
        setCostStateForRestore(targetSessionCosts);
      }

      // Reconstruct replacement state for the resumed session. Runs after
      // setSessionId so any NEW replacements post-resume write to the
      // resumed session's tool-results dir. Gated on ref.current: the
      // initial mount already read the feature flag, so we don't re-read
      // it here (mid-session flag flips stay unobservable in both
      // directions).
      //
      // Skipped for in-session /branch: the existing ref is already correct
      // (branch preserves tool_use_ids), so there's no need to reconstruct.
      // createFork() does write content-replacement entries to the forked
      // JSONL with the fork's sessionId, so `claude -r {forkId}` also works.
      if (contentReplacementStateRef.current && entrypoint !== 'fork') {
        contentReplacementStateRef.current = reconstructContentReplacementState(messages, log.contentReplacements ?? []);
      }

      // Reset messages to the provided initial messages
      // Use a callback to ensure we're not dependent on stale state
      setMessages(() => messages);

      // Clear any active tool JSX
      setToolJSX(null);

      // Clear input to ensure no residual state
      setInputValue('');
      logEvent('tengu_session_resumed', {
        entrypoint: entrypoint as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        success: true,
        resume_duration_ms: Math.round(performance.now() - resumeStart)
      });
    } catch (error) {
      logEvent('tengu_session_resumed', {
        entrypoint: entrypoint as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        success: false
      });
      throw error;
    }
  }, [resetLoadingState, setAppState]);

  // Lazy init: useRef(createX()) would call createX on every render and
  // discard the result. LRUCache construction inside FileStateCache is
  // expensive (~170ms), so we use useState's lazy initializer to create
  // it exactly once, then feed that stable reference into useRef.
  const [initialReadFileState] = useState(() => createFileStateCacheWithSizeLimit(READ_FILE_STATE_CACHE_SIZE));
  const readFileState = useRef(initialReadFileState);
  const bashTools = useRef(new Set<string>());
  const bashToolsProcessedIdx = useRef(0);
  // Session-scoped skill discovery tracking (feeds was_discovered on
  // tengu_skill_tool_invocation). Must persist across getToolUseContext
  // rebuilds within a session: turn-0 discovery writes via processUserInput
  // before onQuery builds its own context, and discovery on turn N must
  // still attribute a SkillTool call on turn N+k. Cleared in clearConversation.
  const discoveredSkillNamesRef = useRef(new Set<string>());
  // Session-level dedup for nested_memory CLAUDE.md attachments.
  // readFileState is a 100-entry LRU; once it evicts a CLAUDE.md path,
  // the next discovery cycle re-injects it. Cleared in clearConversation.
  const loadedNestedMemoryPathsRef = useRef(new Set<string>());

  // Helper to restore read file state from messages (used for resume flows)
  // This allows Claude to edit files that were read in previous sessions
  const restoreReadFileState = useCallback((messages: MessageType[], cwd: string) => {
    const extracted = extractReadFilesFromMessages(messages, cwd, READ_FILE_STATE_CACHE_SIZE);
    readFileState.current = mergeFileStateCaches(readFileState.current, extracted);
    for (const tool of extractBashToolsFromMessages(messages)) {
      bashTools.current.add(tool);
    }
  }, []);

  // Extract read file state from initialMessages on mount
  // This handles CLI flag resume (--resume-session) and ResumeConversation screen
  // where messages are passed as props rather than through the resume callback
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      restoreReadFileState(initialMessages, getOriginalCwd());
      void restoreRemoteAgentTasks({
        abortController: new AbortController(),
        getAppState: () => store.getState(),
        setAppState
      });
    }
    // Only run on mount - initialMessages shouldn't change during component lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    status: apiKeyStatus,
    reverify
  } = useApiKeyVerification();

  // Auto-run /issue state
  const [autoRunIssueReason, setAutoRunIssueReason] = useState<AutoRunIssueReason | null>(null);
  // Ref to track if autoRunIssue was triggered this survey cycle,
  // so we can suppress the [1] follow-up prompt even after
  // autoRunIssueReason is cleared.
  const didAutoRunIssueRef = useRef(false);

  // State for exit feedback flow
  const [exitFlow, setExitFlow] = useState<React.ReactNode>(null);
  const [isExiting, setIsExiting] = useState(false);

  // Calculate if cost dialog should be shown
  const showingCostDialog = !isLoading && showCostDialog;

  // Determine which dialog should have focus (if any)
  // Permission and interactive dialogs can show even when toolJSX is set,
  // as long as shouldContinueAnimation is true. This prevents deadlocks when
  // agents set background hints while waiting for user interaction.
  function getFocusedInputDialog(): 'message-selector' | 'sandbox-permission' | 'tool-permission' | 'prompt' | 'worker-sandbox-permission' | 'elicitation' | 'cost' | 'idle-return' | 'init-onboarding' | 'ide-onboarding' | 'model-switch' | 'undercover-callout' | 'effort-callout' | 'remote-callout' | 'lsp-recommendation' | 'plugin-hint' | 'desktop-upsell' | 'ultraplan-choice' | 'ultraplan-launch' | undefined {
    // Exit states always take precedence
    if (isExiting || exitFlow) return undefined;

    // High priority dialogs (always show regardless of typing)
    if (isMessageSelectorVisible) return 'message-selector';

    // Suppress interrupt dialogs while user is actively typing
    if (isPromptInputActive) return undefined;
    if (sandboxPermissionRequestQueue[0]) return 'sandbox-permission';

    // Permission/interactive dialogs (show unless blocked by toolJSX)
    const allowDialogsWithAnimation = !toolJSX || toolJSX.shouldContinueAnimation;
    if (allowDialogsWithAnimation && toolUseConfirmQueue[0]) return 'tool-permission';
    if (allowDialogsWithAnimation && promptQueue[0]) return 'prompt';
    // Worker sandbox permission prompts (network access) from swarm workers
    if (allowDialogsWithAnimation && workerSandboxPermissions.queue[0]) return 'worker-sandbox-permission';
    if (allowDialogsWithAnimation && elicitation.queue[0]) return 'elicitation';
    if (allowDialogsWithAnimation && showingCostDialog) return 'cost';
    if (allowDialogsWithAnimation && idleReturnPending) return 'idle-return';
    if (feature('ULTRAPLAN') && allowDialogsWithAnimation && !isLoading && ultraplanPendingChoice) return 'ultraplan-choice';
    if (feature('ULTRAPLAN') && allowDialogsWithAnimation && !isLoading && ultraplanLaunchPending) return 'ultraplan-launch';

    // Onboarding dialogs (special conditions)
    if (allowDialogsWithAnimation && showIdeOnboarding) return 'ide-onboarding';

    // Model switch callout (ant-only, eliminated from external builds)
    if ("external" === 'ant' && allowDialogsWithAnimation && showModelSwitchCallout) return 'model-switch';

    // Undercover auto-enable explainer (ant-only, eliminated from external builds)
    if ("external" === 'ant' && allowDialogsWithAnimation && showUndercoverCallout) return 'undercover-callout';

    // Effort callout (shown once for Opus 4.6 users when effort is enabled)
    if (allowDialogsWithAnimation && showEffortCallout) return 'effort-callout';

    // Remote callout (shown once before first bridge enable)
    if (allowDialogsWithAnimation && showRemoteCallout) return 'remote-callout';

    // LSP plugin recommendation (lowest priority - non-blocking suggestion)
    if (allowDialogsWithAnimation && lspRecommendation) return 'lsp-recommendation';

    // Plugin hint from CLI/SDK stderr (same priority band as LSP rec)
    if (allowDialogsWithAnimation && hintRecommendation) return 'plugin-hint';

    // Desktop app upsell (max 3 launches, lowest priority)
    if (allowDialogsWithAnimation && showDesktopUpsellStartup) return 'desktop-upsell';
    return undefined;
  }
  const focusedInputDialog = getFocusedInputDialog();

  // True when permission prompts exist but are hidden because the user is typing
  const hasSuppressedDialogs = isPromptInputActive && (sandboxPermissionRequestQueue[0] || toolUseConfirmQueue[0] || promptQueue[0] || workerSandboxPermissions.queue[0] || elicitation.queue[0] || showingCostDialog);

  // Keep ref in sync so timer callbacks can read the current value
  focusedInputDialogRef.current = focusedInputDialog;

  // Immediately capture pause/resume when focusedInputDialog changes
  // This ensures accurate timing even under high system load, rather than
  // relying on the 100ms polling interval to detect state changes
  useEffect(() => {
    if (!isLoading) return;
    const isPaused = focusedInputDialog === 'tool-permission';
    const now = Date.now();
    if (isPaused && pauseStartTimeRef.current === null) {
      // Just entered pause state - record the exact moment
      pauseStartTimeRef.current = now;
    } else if (!isPaused && pauseStartTimeRef.current !== null) {
      // Just exited pause state - accumulate paused time immediately
      totalPausedMsRef.current += now - pauseStartTimeRef.current;
      pauseStartTimeRef.current = null;
    }
  }, [focusedInputDialog, isLoading]);

  // Re-pin scroll to bottom whenever the permission overlay appears or
  // dismisses. Overlay now renders below messages inside the same
  // ScrollBox (no remount), so we need an explicit scrollToBottom for:
  //  - appear: user may have been scrolled up (sticky broken) — the
  //    dialog is blocking and must be visible
  //  - dismiss: user may have scrolled up to read context during the
  //    overlay, and onScroll was suppressed so the pill state is stale
  // useLayoutEffect so the re-pin commits before the Ink frame renders —
  // no 1-frame flash of the wrong scroll position.
  const prevDialogRef = useRef(focusedInputDialog);
  useLayoutEffect(() => {
    const was = prevDialogRef.current === 'tool-permission';
    const now = focusedInputDialog === 'tool-permission';
    if (was !== now) repinScroll();
    prevDialogRef.current = focusedInputDialog;
  }, [focusedInputDialog, repinScroll]);
  function onCancel() {
    if (focusedInputDialog === 'elicitation') {
      // Elicitation dialog handles its own Escape, and closing it shouldn't affect any loading state.
      return;
    }
    logForDebugging(`[onCancel] focusedInputDialog=${focusedInputDialog} streamMode=${streamMode}`);

    // Pause proactive mode so the user gets control back.
    // It will resume when they submit their next input (see onSubmit).
    if (feature('PROACTIVE') || feature('KAIROS')) {
      proactiveModule?.pauseProactive();
    }
    queryGuard.forceEnd();
    skipIdleCheckRef.current = false;

    // Preserve partially-streamed text so the user can read what was
    // generated before pressing Esc. Pushed before resetLoadingState clears
    // streamingText, and before query.ts yields the async interrupt marker,
    // giving final order [user, partial-assistant, [Request interrupted by user]].
    if (streamingText?.trim()) {
      setMessages(prev => [...prev, createAssistantMessage({
        content: streamingText
      })]);
    }
    resetLoadingState();

    // Clear any active token budget so the backstop doesn't fire on
    // a stale budget if the query generator hasn't exited yet.
    if (feature('TOKEN_BUDGET')) {
      snapshotOutputTokensForTurn(null);
    }
    if (focusedInputDialog === 'tool-permission') {
      // Tool use confirm handles the abort signal itself
      toolUseConfirmQueue[0]?.onAbort();
      setToolUseConfirmQueue([]);
    } else if (focusedInputDialog === 'prompt') {
      // Reject all pending prompts and clear the queue
      for (const item of promptQueue) {
        item.reject(new Error('Prompt cancelled by user'));
      }
      setPromptQueue([]);
      abortController?.abort('user-cancel');
    } else if (activeRemote.isRemoteMode) {
      // Remote mode: send interrupt signal to CCR
      activeRemote.cancelRequest();
    } else {
      abortController?.abort('user-cancel');
    }

    // Clear the controller so subsequent Escape presses don't see a stale
    // aborted signal. Without this, canCancelRunningTask is false (signal
    // defined but .aborted === true), so isActive becomes false if no other
    // activating conditions hold — leaving the Escape keybinding inactive.
    setAbortController(null);

    // forceEnd() skips the finally path — fire directly (aborted=true).
    void mrOnTurnComplete(messagesRef.current, true);
  }

  // Function to handle queued command when canceling a permission request
  const handleQueuedCommandOnCancel = useCallback(() => {
    const result = popAllEditable(inputValue, 0);
    if (!result) return;
    setInputValue(result.text);
    setInputMode('prompt');

    // Restore images from queued commands to pastedContents
    if (result.images.length > 0) {
      setPastedContents(prev => {
        const newContents = {
          ...prev
        };
        for (const image of result.images) {
          newContents[image.id] = image;
        }
        return newContents;
      });
    }
  }, [setInputValue, setInputMode, inputValue, setPastedContents]);

  // CancelRequestHandler props - rendered inside KeybindingSetup
  const cancelRequestProps = {
    setToolUseConfirmQueue,
    onCancel,
    onAgentsKilled: () => setMessages(prev => [...prev, createAgentsKilledMessage()]),
    isMessageSelectorVisible: isMessageSelectorVisible || !!showBashesDialog,
    screen,
    abortSignal: abortController?.signal,
    popCommandFromQueue: handleQueuedCommandOnCancel,
    vimMode,
    isLocalJSXCommand: toolJSX?.isLocalJSXCommand,
    isSearchingHistory,
    isHelpOpen,
    inputMode,
    inputValue,
    streamMode
  };
  useEffect(() => {
    const totalCost = getTotalCost();
    if (totalCost >= 5 /* $5 */ && !showCostDialog && !haveShownCostDialog) {
      logEvent('tengu_cost_threshold_reached', {});
      // Mark as shown even if the dialog won't render (no console billing
      // access). Otherwise this effect re-fires on every message change for
      // the rest of the session — 200k+ spurious events observed.
      setHaveShownCostDialog(true);
      if (hasConsoleBillingAccess()) {
        setShowCostDialog(true);
      }
    }
  }, [messages, showCostDialog, haveShownCostDialog]);
  const sandboxAskCallback: SandboxAskCallback = useCallback(async (hostPattern: NetworkHostPattern) => {
    // If running as a swarm worker, forward the request to the leader via mailbox
    if (isAgentSwarmsEnabled() && isSwarmWorker()) {
      const requestId = generateSandboxRequestId();

      // Send the request to the leader via mailbox
      const sent = await sendSandboxPermissionRequestViaMailbox(hostPattern.host, requestId);
      return new Promise(resolveShouldAllowHost => {
        if (!sent) {
          // If we couldn't send via mailbox, fall back to local handling
          setSandboxPermissionRequestQueue(prev => [...prev, {
            hostPattern,
            resolvePromise: resolveShouldAllowHost
          }]);
          return;
        }

        // Register the callback for when the leader responds
        registerSandboxPermissionCallback({
          requestId,
          host: hostPattern.host,
          resolve: resolveShouldAllowHost
        });

        // Update AppState to show pending indicator
        setAppState(prev => ({
          ...prev,
          pendingSandboxRequest: {
            requestId,
            host: hostPattern.host
          }
        }));
      });
    }

    // Normal flow for non-workers: show local UI and optionally race
    // against the REPL bridge (Remote Control) if connected.
    return new Promise(resolveShouldAllowHost => {
      let resolved = false;
      function resolveOnce(allow: boolean): void {
        if (resolved) return;
        resolved = true;
        resolveShouldAllowHost(allow);
      }

      // Queue the local sandbox permission dialog
      setSandboxPermissionRequestQueue(prev => [...prev, {
        hostPattern,
        resolvePromise: resolveOnce
      }]);

      // When the REPL bridge is connected, also forward the sandbox
      // permission request as a can_use_tool control_request so the
      // remote user (e.g. on claude.ai) can approve it too.
      if (feature('BRIDGE_MODE')) {
        const bridgeCallbacks = store.getState().replBridgePermissionCallbacks;
        if (bridgeCallbacks) {
          const bridgeRequestId = randomUUID();
          bridgeCallbacks.sendRequest(bridgeRequestId, SANDBOX_NETWORK_ACCESS_TOOL_NAME, {
            host: hostPattern.host
          }, randomUUID(), `Allow network connection to ${hostPattern.host}?`);
          const unsubscribe = bridgeCallbacks.onResponse(bridgeRequestId, response => {
            unsubscribe();
            const allow = response.behavior === 'allow';
            // Resolve ALL pending requests for the same host, not just
            // this one — mirrors the local dialog handler pattern.
            setSandboxPermissionRequestQueue(queue => {
              queue.filter(item => item.hostPattern.host === hostPattern.host).forEach(item => item.resolvePromise(allow));
              return queue.filter(item => item.hostPattern.host !== hostPattern.host);
            });
            // Clean up all sibling bridge subscriptions for this host
            // (other concurrent same-host requests) before deleting.
            const siblingCleanups = sandboxBridgeCleanupRef.current.get(hostPattern.host);
            if (siblingCleanups) {
              for (const fn of siblingCleanups) {
                fn();
              }
              sandboxBridgeCleanupRef.current.delete(hostPattern.host);
            }
          });

          // Register cleanup so the local dialog handler can cancel
          // the remote prompt and unsubscribe when the local user
          // responds first.
          const cleanup = () => {
            unsubscribe();
            bridgeCallbacks.cancelRequest(bridgeRequestId);
          };
          const existing = sandboxBridgeCleanupRef.current.get(hostPattern.host) ?? [];
          existing.push(cleanup);
          sandboxBridgeCleanupRef.current.set(hostPattern.host, existing);
        }
      }
    });
  }, [setAppState, store]);

  // #34044: if user explicitly set sandbox.enabled=true but deps are missing,
  // isSandboxingEnabled() returns false silently. Surface the reason once at
  // mount so users know their security config isn't being enforced. Full
  // reason goes to debug log; notification points to /sandbox for details.
  // addNotification is stable (useCallback) so the effect fires once.
  useEffect(() => {
    const reason = SandboxManager.getSandboxUnavailableReason();
    if (!reason) return;
    if (SandboxManager.isSandboxRequired()) {
      process.stderr.write(`\nError: sandbox required but unavailable: ${reason}\n` + `  sandbox.failIfUnavailable is set — refusing to start without a working sandbox.\n\n`);
      gracefulShutdownSync(1, 'other');
      return;
    }
    logForDebugging(`sandbox disabled: ${reason}`, {
      level: 'warn'
    });
    addNotification({
      key: 'sandbox-unavailable',
      jsx: <>
          <Text color="warning">sandbox disabled</Text>
          <Text dimColor> · /sandbox</Text>
        </>,
      priority: 'medium'
    });
  }, [addNotification]);
  if (SandboxManager.isSandboxingEnabled()) {
    // If sandboxing is enabled (setting.sandbox is defined, initialise the manager)
    SandboxManager.initialize(sandboxAskCallback).catch(err => {
      // Initialization/validation failed - display error and exit
      process.stderr.write(`\n❌ Sandbox Error: ${errorMessage(err)}\n`);
      gracefulShutdownSync(1, 'other');
    });
  }
  const setToolPermissionContext = useCallback((context: ToolPermissionContext, options?: {
    preserveMode?: boolean;
  }) => {
    setAppState(prev => ({
      ...prev,
      toolPermissionContext: {
        ...context,
        // Preserve the coordinator's mode only when explicitly requested.
        // Workers' getAppState() returns a transformed context with mode
        // 'acceptEdits' that must not leak into the coordinator's actual
        // state via permission-rule updates — those call sites pass
        // { preserveMode: true }. User-initiated mode changes (e.g.,
        // selecting "allow all edits") must NOT be overridden.
        mode: options?.preserveMode ? prev.toolPermissionContext.mode : context.mode
      }
    }));

    // When permission context changes, recheck all queued items
    // This handles the case where approving item1 with "don't ask again"
    // should auto-approve other queued items that now match the updated rules
    setImmediate(setToolUseConfirmQueue => {
      // Use setToolUseConfirmQueue callback to get current queue state
      // instead of capturing it in the closure, to avoid stale closure issues
      setToolUseConfirmQueue(currentQueue => {
        currentQueue.forEach(item => {
          void item.recheckPermission();
        });
        return currentQueue;
      });
    }, setToolUseConfirmQueue);
  }, [setAppState, setToolUseConfirmQueue]);

  // Register the leader's setToolPermissionContext for in-process teammates
  useEffect(() => {
    registerLeaderSetToolPermissionContext(setToolPermissionContext);
    return () => unregisterLeaderSetToolPermissionContext();
  }, [setToolPermissionContext]);
  const canUseTool = useCanUseTool(setToolUseConfirmQueue, setToolPermissionContext);
  const requestPrompt = useCallback((title: string, toolInputSummary?: string | null) => (request: PromptRequest): Promise<PromptResponse> => new Promise<PromptResponse>((resolve, reject) => {
    setPromptQueue(prev => [...prev, {
      request,
      title,
      toolInputSummary,
      resolve,
      reject
    }]);
  }), []);
  const getToolUseContext = useCallback((messages: MessageType[], newMessages: MessageType[], abortController: AbortController, mainLoopModel: string): ProcessUserInputContext => {
    // Read mutable values fresh from the store rather than closure-capturing
    // useAppState() snapshots. Same values today (closure is refreshed by the
    // render between turns); decouples freshness from React's render cycle for
    // a future headless conversation loop. Same pattern refreshTools() uses.
    const s = store.getState();

    // Compute tools fresh from store.getState() rather than the closure-
    // captured `tools`. useManageMCPConnections populates appState.mcp
    // async as servers connect — the store may have newer MCP state than
    // the closure captured at render time. Also doubles as refreshTools()
    // for mid-query tool list updates.
    const computeTools = () => {
      const state = store.getState();
      const assembled = assembleToolPool(state.toolPermissionContext, state.mcp.tools);
      const merged = mergeAndFilterTools(combinedInitialTools, assembled, state.toolPermissionContext.mode);
      if (!mainThreadAgentDefinition) return merged;
      return resolveAgentTools(mainThreadAgentDefinition, merged, false, true).resolvedTools;
    };
    return {
      abortController,
      options: {
        commands,
        tools: computeTools(),
        debug,
        verbose: s.verbose,
        mainLoopModel,
        thinkingConfig: s.thinkingEnabled !== false ? thinkingConfig : {
          type: 'disabled'
        },
        // Merge fresh from store rather than closing over useMergedClients'
        // memoized output. initialMcpClients is a prop (session-constant).
        mcpClients: mergeClients(initialMcpClients, s.mcp.clients),
        mcpResources: s.mcp.resources,
        ideInstallationStatus: ideInstallationStatus,
        isNonInteractiveSession: false,
        dynamicMcpConfig,
        theme,
        agentDefinitions: allowedAgentTypes ? {
          ...s.agentDefinitions,
          allowedAgentTypes
        } : s.agentDefinitions,
        customSystemPrompt,
        appendSystemPrompt,
        refreshTools: computeTools
      },
      getAppState: () => store.getState(),
      setAppState,
      messages,
      setMessages,
      updateFileHistoryState(updater: (prev: FileHistoryState) => FileHistoryState) {
        // Perf: skip the setState when the updater returns the same reference
        // (e.g. fileHistoryTrackEdit returns `state` when the file is already
        // tracked). Otherwise every no-op call would notify all store listeners.
        setAppState(prev => {
          const updated = updater(prev.fileHistory);
          if (updated === prev.fileHistory) return prev;
          return {
            ...prev,
            fileHistory: updated
          };
        });
      },
      updateAttributionState(updater: (prev: AttributionState) => AttributionState) {
        setAppState(prev => {
          const updated = updater(prev.attribution);
          if (updated === prev.attribution) return prev;
          return {
            ...prev,
            attribution: updated
          };
        });
      },
      openMessageSelector: () => {
        if (!disabled) {
          setIsMessageSelectorVisible(true);
        }
      },
      onChangeAPIKey: reverify,
      readFileState: readFileState.current,
      setToolJSX,
      addNotification,
      appendSystemMessage: msg => setMessages(prev => [...prev, msg]),
      sendOSNotification: opts => {
        void sendNotification(opts, terminal);
      },
      onChangeDynamicMcpConfig,
      onInstallIDEExtension: setIDEToInstallExtension,
      nestedMemoryAttachmentTriggers: new Set<string>(),
      loadedNestedMemoryPaths: loadedNestedMemoryPathsRef.current,
      dynamicSkillDirTriggers: new Set<string>(),
      discoveredSkillNames: discoveredSkillNamesRef.current,
      setResponseLength,
      pushApiMetricsEntry: "external" === 'ant' ? (ttftMs: number) => {
        const now = Date.now();
        const baseline = responseLengthRef.current;
        apiMetricsRef.current.push({
          ttftMs,
          firstTokenTime: now,
          lastTokenTime: now,
          responseLengthBaseline: baseline,
          endResponseLength: baseline
        });
      } : undefined,
      setStreamMode,
      onCompactProgress: event => {
        switch (event.type) {
          case 'hooks_start':
            setSpinnerColor('claudeBlue_FOR_SYSTEM_SPINNER');
            setSpinnerShimmerColor('claudeBlueShimmer_FOR_SYSTEM_SPINNER');
            setSpinnerMessage(event.hookType === 'pre_compact' ? 'Running PreCompact hooks\u2026' : event.hookType === 'post_compact' ? 'Running PostCompact hooks\u2026' : 'Running SessionStart hooks\u2026');
            break;
          case 'compact_start':
            setSpinnerMessage('Compacting conversation');
            break;
          case 'compact_end':
            setSpinnerMessage(null);
            setSpinnerColor(null);
            setSpinnerShimmerColor(null);
            break;
        }
      },
      setInProgressToolUseIDs,
      setHasInterruptibleToolInProgress: (v: boolean) => {
        hasInterruptibleToolInProgressRef.current = v;
      },
      resume,
      setConversationId,
      requestPrompt: feature('HOOK_PROMPTS') ? requestPrompt : undefined,
      contentReplacementState: contentReplacementStateRef.current
    };
  }, [commands, combinedInitialTools, mainThreadAgentDefinition, debug, initialMcpClients, ideInstallationStatus, dynamicMcpConfig, theme, allowedAgentTypes, store, setAppState, reverify, addNotification, setMessages, onChangeDynamicMcpConfig, resume, requestPrompt, disabled, customSystemPrompt, appendSystemPrompt, setConversationId]);

  // Session backgrounding (Ctrl+B to background/foreground)
  const handleBackgroundQuery = useCallback(() => {
    // Stop the foreground query so the background one takes over
    abortController?.abort('background');
    // Aborting subagents may produce task-completed notifications.
    // Clear task notifications so the queue processor doesn't immediately
    // start a new foreground query; forward them to the background session.
    const removedNotifications = removeByFilter(cmd => cmd.mode === 'task-notification');
    void (async () => {
      const toolUseContext = getToolUseContext(messagesRef.current, [], new AbortController(), mainLoopModel);
      const [defaultSystemPrompt, userContext, systemContext] = await Promise.all([getSystemPrompt(toolUseContext.options.tools, mainLoopModel, Array.from(toolPermissionContext.additionalWorkingDirectories.keys()), toolUseContext.options.mcpClients), getUserContext(), getSystemContext()]);
      const systemPrompt = buildEffectiveSystemPrompt({
        mainThreadAgentDefinition,
        toolUseContext,
        customSystemPrompt,
        defaultSystemPrompt,
        appendSystemPrompt
      });
      toolUseContext.renderedSystemPrompt = systemPrompt;
      const notificationAttachments = await getQueuedCommandAttachments(removedNotifications).catch(() => []);
      const notificationMessages = notificationAttachments.map(createAttachmentMessage);

      // Deduplicate: if the query loop already yielded a notification into
      // messagesRef before we removed it from the queue, skip duplicates.
      // We use prompt text for dedup because source_uuid is not set on
      // task-notification QueuedCommands (enqueuePendingNotification callers
      // don't pass uuid), so it would always be undefined.
      const existingPrompts = new Set<string>();
      for (const m of messagesRef.current) {
        if (m.type === 'attachment' && m.attachment.type === 'queued_command' && m.attachment.commandMode === 'task-notification' && typeof m.attachment.prompt === 'string') {
          existingPrompts.add(m.attachment.prompt);
        }
      }
      const uniqueNotifications = notificationMessages.filter(m => m.attachment.type === 'queued_command' && (typeof m.attachment.prompt !== 'string' || !existingPrompts.has(m.attachment.prompt)));
      startBackgroundSession({
        messages: [...messagesRef.current, ...uniqueNotifications],
        queryParams: {
          systemPrompt,
          userContext,
          systemContext,
          canUseTool,
          toolUseContext,
          querySource: getQuerySourceForREPL()
        },
        description: terminalTitle,
        setAppState,
        agentDefinition: mainThreadAgentDefinition
      });
    })();
  }, [abortController, mainLoopModel, toolPermissionContext, mainThreadAgentDefinition, getToolUseContext, customSystemPrompt, appendSystemPrompt, canUseTool, setAppState]);
  const {
    handleBackgroundSession
  } = useSessionBackgrounding({
    setMessages,
    setIsLoading: setIsExternalLoading,
    resetLoadingState,
    setAbortController,
    onBackgroundQuery: handleBackgroundQuery
  });
  const onQueryEvent = useCallback((event: Parameters<typeof handleMessageFromStream>[0]) => {
    handleMessageFromStream(event, newMessage => {
      if (isCompactBoundaryMessage(newMessage)) {
        // Fullscreen: keep pre-compact messages for scrollback. query.ts
        // slices at the boundary for API calls, Messages.tsx skips the
        // boundary filter in fullscreen, and useLogMessages treats this
        // as an incremental append (first uuid unchanged). Cap at one
        // compact-interval of scrollback — normalizeMessages/applyGrouping
        // are O(n) per render, so drop everything before the previous
        // boundary to keep n bounded across multi-day sessions.
        if (isFullscreenEnvEnabled()) {
          setMessages(old => [...getMessagesAfterCompactBoundary(old, {
            includeSnipped: true
          }), newMessage]);
        } else {
          setMessages(() => [newMessage]);
        }
        // Bump conversationId so Messages.tsx row keys change and
        // stale memoized rows remount with post-compact content.
        setConversationId(randomUUID());
        // Compaction succeeded — clear the context-blocked flag so ticks resume
        if (feature('PROACTIVE') || feature('KAIROS')) {
          proactiveModule?.setContextBlocked(false);
        }
      } else if (newMessage.type === 'progress' && isEphemeralToolProgress(newMessage.data.type)) {
        // Replace the previous ephemeral progress tick for the same tool
        // call instead of appending. Sleep/Bash emit a tick per second and
        // only the last one is rendered; appending blows up the messages
        // array (13k+ observed) and the transcript (120MB of sleep_progress
        // lines). useLogMessages tracks length, so same-length replacement
        // also skips the transcript write.
        // agent_progress / hook_progress / skill_progress are NOT ephemeral
        // — each carries distinct state the UI needs (e.g. subagent tool
        // history). Replacing those leaves the AgentTool UI stuck at
        // "Initializing…" because it renders the full progress trail.
        setMessages(oldMessages => {
          const last = oldMessages.at(-1);
          if (last?.type === 'progress' && last.parentToolUseID === newMessage.parentToolUseID && last.data.type === newMessage.data.type) {
            const copy = oldMessages.slice();
            copy[copy.length - 1] = newMessage;
            return copy;
          }
          return [...oldMessages, newMessage];
        });
      } else {
        setMessages(oldMessages => [...oldMessages, newMessage]);
      }
      // Block ticks on API errors to prevent tick → error → tick
      // runaway loops (e.g., auth failure, rate limit, blocking limit).
      // Cleared on compact boundary (above) or successful response (below).
      if (feature('PROACTIVE') || feature('KAIROS')) {
        if (newMessage.type === 'assistant' && 'isApiErrorMessage' in newMessage && newMessage.isApiErrorMessage) {
          proactiveModule?.setContextBlocked(true);
        } else if (newMessage.type === 'assistant') {
          proactiveModule?.setContextBlocked(false);
        }
      }
    }, newContent => {
      // setResponseLength handles updating both responseLengthRef (for
      // spinner animation) and apiMetricsRef (endResponseLength/lastTokenTime
      // for OTPS). No separate metrics update needed here.
      setResponseLength(length => length + newContent.length);
    }, setStreamMode, setStreamingToolUses, tombstonedMessage => {
      setMessages(oldMessages => oldMessages.filter(m => m !== tombstonedMessage));
      void removeTranscriptMessage(tombstonedMessage.uuid);
    }, setStreamingThinking, metrics => {
      const now = Date.now();
      const baseline = responseLengthRef.current;
      apiMetricsRef.current.push({
        ...metrics,
        firstTokenTime: now,
        lastTokenTime: now,
        responseLengthBaseline: baseline,
        endResponseLength: baseline
      });
    }, onStreamingText);
  }, [setMessages, setResponseLength, setStreamMode, setStreamingToolUses, setStreamingThinking, onStreamingText]);
  const onQueryImpl = useCallback(async (messagesIncludingNewMessages: MessageType[], newMessages: MessageType[], abortController: AbortController, shouldQuery: boolean, additionalAllowedTools: string[], mainLoopModelParam: string, effort?: EffortValue) => {
    // Prepare IDE integration for new prompt. Read mcpClients fresh from
    // store — useManageMCPConnections may have populated it since the
    // render that captured this closure (same pattern as computeTools).
    if (shouldQuery) {
      const freshClients = mergeClients(initialMcpClients, store.getState().mcp.clients);
      void diagnosticTracker.handleQueryStart(freshClients);
      const ideClient = getConnectedIdeClient(freshClients);
      if (ideClient) {
        void closeOpenDiffs(ideClient);
      }
    }

    // Mark onboarding as complete when any user message is sent to Claude
    void maybeMarkProjectOnboardingComplete();

    // Extract a session title from the first real user message. One-shot
    // via ref (was tengu_birch_mist experiment: first-message-only to save
    // Haiku calls). The ref replaces the old `messages.length <= 1` check,
    // which was broken by SessionStart hook messages (prepended via
    // useDeferredHookMessages) and attachment messages (appended by
    // processTextPrompt) — both pushed length past 1 on turn one, so the
    // title silently fell through to the "Claude Code" default.
    if (!titleDisabled && !sessionTitle && !agentTitle && !haikuTitleAttemptedRef.current) {
      const firstUserMessage = newMessages.find(m => m.type === 'user' && !m.isMeta);
      const text = firstUserMessage?.type === 'user' ? getContentText(firstUserMessage.message.content) : null;
      // Skip synthetic breadcrumbs — slash-command output, prompt-skill
      // expansions (/commit → <command-message>), local-command headers
      // (/help → <command-name>), and bash-mode (!cmd → <bash-input>).
      // None of these are the user's topic; wait for real prose.
      if (text && !text.startsWith(`<${LOCAL_COMMAND_STDOUT_TAG}>`) && !text.startsWith(`<${COMMAND_MESSAGE_TAG}>`) && !text.startsWith(`<${COMMAND_NAME_TAG}>`) && !text.startsWith(`<${BASH_INPUT_TAG}>`)) {
        haikuTitleAttemptedRef.current = true;
        void generateSessionTitle(text, new AbortController().signal).then(title => {
          if (title) setHaikuTitle(title);else haikuTitleAttemptedRef.current = false;
        }, () => {
          haikuTitleAttemptedRef.current = false;
        });
      }
    }

    // Apply slash-command-scoped allowedTools (from skill frontmatter) to the
    // store once per turn. This also covers the reset: the next non-skill turn
    // passes [] and clears it. Must run before the !shouldQuery gate: forked
    // commands (executeForkedSlashCommand) return shouldQuery=false, and
    // createGetAppStateWithAllowedTools in forkedAgent.ts reads this field, so
    // stale skill tools would otherwise leak into forked agent permissions.
    // Previously this write was hidden inside getToolUseContext's getAppState
    // (~85 calls/turn); hoisting it here makes getAppState a pure read and stops
    // ephemeral contexts (permission dialog, BackgroundTasksDialog) from
    // accidentally clearing it mid-turn.
    store.setState(prev => {
      const cur = prev.toolPermissionContext.alwaysAllowRules.command;
      if (cur === additionalAllowedTools || cur?.length === additionalAllowedTools.length && cur.every((v, i) => v === additionalAllowedTools[i])) {
        return prev;
      }
      return {
        ...prev,
        toolPermissionContext: {
          ...prev.toolPermissionContext,
          alwaysAllowRules: {
            ...prev.toolPermissionContext.alwaysAllowRules,
            command: additionalAllowedTools
          }
        }
      };
    });

    // The last message is an assistant message if the user input was a bash command,
    // or if the user input was an invalid slash command.
    if (!shouldQuery) {
      // Manual /compact sets messages directly (shouldQuery=false) bypassing
      // handleMessageFromStream. Clear context-blocked if a compact boundary
      // is present so proactive ticks resume after compaction.
      if (newMessages.some(isCompactBoundaryMessage)) {
        // Bump conversationId so Messages.tsx row keys change and
        // stale memoized rows remount with post-compact content.
        setConversationId(randomUUID());
        if (feature('PROACTIVE') || feature('KAIROS')) {
          proactiveModule?.setContextBlocked(false);
        }
      }
      resetLoadingState();
      setAbortController(null);
      return;
    }
    const toolUseContext = getToolUseContext(messagesIncludingNewMessages, newMessages, abortController, mainLoopModelParam);
    // getToolUseContext reads tools/mcpClients fresh from store.getState()
    // (via computeTools/mergeClients). Use those rather than the closure-
    // captured `tools`/`mcpClients` — useManageMCPConnections may have
    // flushed new MCP state between the render that captured this closure
    // and now. Turn 1 via processInitialMessage is the main beneficiary.
    const {
      tools: freshTools,
      mcpClients: freshMcpClients
    } = toolUseContext.options;

    // Scope the skill's effort override to this turn's context only —
    // wrapping getAppState keeps the override out of the global store so
    // background agents and UI subscribers (Spinner, LogoV2) never see it.
    if (effort !== undefined) {
      const previousGetAppState = toolUseContext.getAppState;
      toolUseContext.getAppState = () => ({
        ...previousGetAppState(),
        effortValue: effort
      });
    }
    queryCheckpoint('query_context_loading_start');
    const [,, defaultSystemPrompt, baseUserContext, systemContext] = await Promise.all([
    // IMPORTANT: do this after setMessages() above, to avoid UI jank
    checkAndDisableBypassPermissionsIfNeeded(toolPermissionContext, setAppState),
    // Gated on TRANSCRIPT_CLASSIFIER so GrowthBook kill switch runs wherever auto mode is built in
    feature('TRANSCRIPT_CLASSIFIER') ? checkAndDisableAutoModeIfNeeded(toolPermissionContext, setAppState, store.getState().fastMode) : undefined, getSystemPrompt(freshTools, mainLoopModelParam, Array.from(toolPermissionContext.additionalWorkingDirectories.keys()), freshMcpClients), getUserContext(), getSystemContext()]);
    const userContext = {
      ...baseUserContext,
      ...getCoordinatorUserContext(freshMcpClients, isScratchpadEnabled() ? getScratchpadDir() : undefined),
      ...((feature('PROACTIVE') || feature('KAIROS')) && proactiveModule?.isProactiveActive() && !terminalFocusRef.current ? {
        terminalFocus: 'The terminal is unfocused \u2014 the user is not actively watching.'
      } : {})
    };
    queryCheckpoint('query_context_loading_end');
    const systemPrompt = buildEffectiveSystemPrompt({
      mainThreadAgentDefinition,
      toolUseContext,
      customSystemPrompt,
      defaultSystemPrompt,
      appendSystemPrompt
    });
    toolUseContext.renderedSystemPrompt = systemPrompt;
    queryCheckpoint('query_query_start');
    resetTurnHookDuration();
    resetTurnToolDuration();
    resetTurnClassifierDuration();
    for await (const event of query({
      messages: messagesIncludingNewMessages,
      systemPrompt,
      userContext,
      systemContext,
      canUseTool,
      toolUseContext,
      querySource: getQuerySourceForREPL()
    })) {
      onQueryEvent(event);
    }
    if (feature('BUDDY')) {
      void fireCompanionObserver(messagesRef.current, reaction => setAppState(prev => prev.companionReaction === reaction ? prev : {
        ...prev,
        companionReaction: reaction
      }));
    }
    queryCheckpoint('query_end');

    // Capture ant-only API metrics before resetLoadingState clears the ref.
    // For multi-request turns (tool use loops), compute P50 across all requests.
    if ("external" === 'ant' && apiMetricsRef.current.length > 0) {
      const entries = apiMetricsRef.current;
      const ttfts = entries.map(e => e.ttftMs);
      // Compute per-request OTPS using only active streaming time and
      // streaming-only content. endResponseLength tracks content added by
      // streaming deltas only, excluding subagent/compaction inflation.
      const otpsValues = entries.map(e => {
        const delta = Math.round((e.endResponseLength - e.responseLengthBaseline) / 4);
        const samplingMs = e.lastTokenTime - e.firstTokenTime;
        return samplingMs > 0 ? Math.round(delta / (samplingMs / 1000)) : 0;
      });
      const isMultiRequest = entries.length > 1;
      const hookMs = getTurnHookDurationMs();
      const hookCount = getTurnHookCount();
      const toolMs = getTurnToolDurationMs();
      const toolCount = getTurnToolCount();
      const classifierMs = getTurnClassifierDurationMs();
      const classifierCount = getTurnClassifierCount();
      const turnMs = Date.now() - loadingStartTimeRef.current;
      setMessages(prev => [...prev, createApiMetricsMessage({
        ttftMs: isMultiRequest ? median(ttfts) : ttfts[0]!,
        otps: isMultiRequest ? median(otpsValues) : otpsValues[0]!,
        isP50: isMultiRequest,
        hookDurationMs: hookMs > 0 ? hookMs : undefined,
        hookCount: hookCount > 0 ? hookCount : undefined,
        turnDurationMs: turnMs > 0 ? turnMs : undefined,
        toolDurationMs: toolMs > 0 ? toolMs : undefined,
        toolCount: toolCount > 0 ? toolCount : undefined,
        classifierDurationMs: classifierMs > 0 ? classifierMs : undefined,
        classifierCount: classifierCount > 0 ? classifierCount : undefined,
        configWriteCount: getGlobalConfigWriteCount()
      })]);
    }
    resetLoadingState();

    // Log query profiling report if enabled
    logQueryProfileReport();

    // Signal that a query turn has completed successfully
    await onTurnComplete?.(messagesRef.current);
  }, [initialMcpClients, resetLoadingState, getToolUseContext, toolPermissionContext, setAppState, customSystemPrompt, onTurnComplete, appendSystemPrompt, canUseTool, mainThreadAgentDefinition, onQueryEvent, sessionTitle, titleDisabled]);
  const onQuery = useCallback(async (newMessages: MessageType[], abortController: AbortController, shouldQuery: boolean, additionalAllowedTools: string[], mainLoopModelParam: string, onBeforeQueryCallback?: (input: string, newMessages: MessageType[]) => Promise<boolean>, input?: string, effort?: EffortValue): Promise<void> => {
    // If this is a teammate, mark them as active when starting a turn
    if (isAgentSwarmsEnabled()) {
      const teamName = getTeamName();
      const agentName = getAgentName();
      if (teamName && agentName) {
        // Fire and forget - turn starts immediately, write happens in background
        void setMemberActive(teamName, agentName, true);
      }
    }

    // Concurrent guard via state machine. tryStart() atomically checks
    // and transitions idle→running, returning the generation number.
    // Returns null if already running — no separate check-then-set.
    const thisGeneration = queryGuard.tryStart();
    if (thisGeneration === null) {
      logEvent('tengu_concurrent_onquery_detected', {});

      // Extract and enqueue user message text, skipping meta messages
      // (e.g. expanded skill content, tick prompts) that should not be
      // replayed as user-visible text.
      newMessages.filter((m): m is UserMessage => m.type === 'user' && !m.isMeta).map(_ => getContentText(_.message.content)).filter(_ => _ !== null).forEach((msg, i) => {
        enqueue({
          value: msg,
          mode: 'prompt'
        });
        if (i === 0) {
          logEvent('tengu_concurrent_onquery_enqueued', {});
        }
      });
      return;
    }
    try {
      // isLoading is derived from queryGuard — tryStart() above already
      // transitioned dispatching→running, so no setter call needed here.
      resetTimingRefs();
      setMessages(oldMessages => [...oldMessages, ...newMessages]);
      responseLengthRef.current = 0;
      if (feature('TOKEN_BUDGET')) {
        const parsedBudget = input ? parseTokenBudget(input) : null;
        snapshotOutputTokensForTurn(parsedBudget ?? getCurrentTurnTokenBudget());
      }
      apiMetricsRef.current = [];
      setStreamingToolUses([]);
      setStreamingText(null);

      // messagesRef is updated synchronously by the setMessages wrapper
      // above, so it already includes newMessages from the append at the
      // top of this try block.  No reconstruction needed, no waiting for
      // React's scheduler (previously cost 20-56ms per prompt; the 56ms
      // case was a GC pause caught during the await).
      const latestMessages = messagesRef.current;
      if (input) {
        await mrOnBeforeQuery(input, latestMessages, newMessages.length);
      }

      // Pass full conversation history to callback
      if (onBeforeQueryCallback && input) {
        const shouldProceed = await onBeforeQueryCallback(input, latestMessages);
        if (!shouldProceed) {
          return;
        }
      }
      await onQueryImpl(latestMessages, newMessages, abortController, shouldQuery, additionalAllowedTools, mainLoopModelParam, effort);
    } finally {
      // queryGuard.end() atomically checks generation and transitions
      // running→idle. Returns false if a newer query owns the guard
      // (cancel+resubmit race where the stale finally fires as a microtask).
      if (queryGuard.end(thisGeneration)) {
        setLastQueryCompletionTime(Date.now());
        skipIdleCheckRef.current = false;
        // Always reset loading state in finally - this ensures cleanup even
        // if onQueryImpl throws. onTurnComplete is called separately in
        // onQueryImpl only on successful completion.
        resetLoadingState();
        await mrOnTurnComplete(messagesRef.current, abortController.signal.aborted);

        // Notify bridge clients that the turn is complete so mobile apps
        // can stop the spark animation and show post-turn UI.
        sendBridgeResultRef.current();

        // Auto-hide tungsten panel content at turn end (ant-only), but keep
        // tungstenActiveSession set so the pill stays in the footer and the user
        // can reopen the panel. Background tmux tasks (e.g. /hunter) run for
        // minutes — wiping the session made the pill disappear entirely, forcing
        // the user to re-invoke Tmux just to peek. Skip on abort so the panel
        // stays open for inspection (matches the turn-duration guard below).
        if ("external" === 'ant' && !abortController.signal.aborted) {
          setAppState(prev => {
            if (prev.tungstenActiveSession === undefined) return prev;
            if (prev.tungstenPanelAutoHidden === true) return prev;
            return {
              ...prev,
              tungstenPanelAutoHidden: true
            };
          });
        }

        // Capture budget info before clearing (ant-only)
        let budgetInfo: {
          tokens: number;
          limit: number;
          nudges: number;
        } | undefined;
        if (feature('TOKEN_BUDGET')) {
          if (getCurrentTurnTokenBudget() !== null && getCurrentTurnTokenBudget()! > 0 && !abortController.signal.aborted) {
            budgetInfo = {
              tokens: getTurnOutputTokens(),
              limit: getCurrentTurnTokenBudget()!,
              nudges: getBudgetContinuationCount()
            };
          }
          snapshotOutputTokensForTurn(null);
        }

        // Add turn duration message for turns longer than 30s or with a budget
        // Skip if user aborted or if in loop mode (too noisy between ticks)
        // Defer if swarm teammates are still running (show when they finish)
        const turnDurationMs = Date.now() - loadingStartTimeRef.current - totalPausedMsRef.current;
        if ((turnDurationMs > 30000 || budgetInfo !== undefined) && !abortController.signal.aborted && !proactiveActive) {
          const hasRunningSwarmAgents = getAllInProcessTeammateTasks(store.getState().tasks).some(t => t.status === 'running');
          if (hasRunningSwarmAgents) {
            // Only record start time on the first deferred turn
            if (swarmStartTimeRef.current === null) {
              swarmStartTimeRef.current = loadingStartTimeRef.current;
            }
            // Always update budget — later turns may carry the actual budget
            if (budgetInfo) {
              swarmBudgetInfoRef.current = budgetInfo;
            }
          } else {
            setMessages(prev => [...prev, createTurnDurationMessage(turnDurationMs, budgetInfo, count(prev, isLoggableMessage))]);
          }
        }
        // Clear the controller so CancelRequestHandler's canCancelRunningTask
        // reads false at the idle prompt. Without this, the stale non-aborted
        // controller makes ctrl+c fire onCancel() (aborting nothing) instead of
        // propagating to the double-press exit flow.
        setAbortController(null);
      }

      // Auto-restore: if the user interrupted before any meaningful response
      // arrived, rewind the conversation and restore their prompt — same as
      // opening the message selector and picking the last message.
      // This runs OUTSIDE the queryGuard.end() check because onCancel calls
      // forceEnd(), which bumps the generation so end() returns false above.
      // Guards: reason === 'user-cancel' (onCancel/Esc; programmatic aborts
      // use 'background'/'interrupt' and must not rewind — note abort() with
      // no args sets reason to a DOMException, not undefined), !isActive (no
      // newer query started — cancel+resubmit race), empty input (don't
      // clobber text typed during loading), no queued commands (user queued
      // B while A was loading → they've moved on, don't restore A; also
      // avoids removeLastFromHistory removing B's entry instead of A's),
      // not viewing a teammate (messagesRef is the main conversation — the
      // old Up-arrow quick-restore had this guard, preserve it).
      if (abortController.signal.reason === 'user-cancel' && !queryGuard.isActive && inputValueRef.current === '' && getCommandQueueLength() === 0 && !store.getState().viewingAgentTaskId) {
        const msgs = messagesRef.current;
        const lastUserMsg = msgs.findLast(selectableUserMessagesFilter);
        if (lastUserMsg) {
          const idx = msgs.lastIndexOf(lastUserMsg);
          if (messagesAfterAreOnlySynthetic(msgs, idx)) {
            // The submit is being undone — undo its history entry too,
            // otherwise Up-arrow shows the restored text twice.
            removeLastFromHistory();
            restoreMessageSyncRef.current(lastUserMsg);
          }
        }
      }
    }
  }, [onQueryImpl, setAppState, resetLoadingState, queryGuard, mrOnBeforeQuery, mrOnTurnComplete]);

  // Handle initial message (from CLI args or plan mode exit with context clear)
  // This effect runs when isLoading becomes false and there's a pending message
  const initialMessageRef = useRef(false);
  useEffect(() => {
    const pending = initialMessage;
    if (!pending || isLoading || initialMessageRef.current) return;

    // Mark as processing to prevent re-entry
    initialMessageRef.current = true;
    async function processInitialMessage(initialMsg: NonNullable<typeof pending>) {
      // Clear context if requested (plan mode exit)
      if (initialMsg.clearContext) {
        // Preserve the plan slug before clearing context, so the new session
        // can access the same plan file after regenerateSessionId()
        const oldPlanSlug = initialMsg.message.planContent ? getPlanSlug() : undefined;
        const {
          clearConversation
        } = await import('../commands/clear/conversation.js');
        await clearConversation({
          setMessages,
          readFileState: readFileState.current,
          discoveredSkillNames: discoveredSkillNamesRef.current,
          loadedNestedMemoryPaths: loadedNestedMemoryPathsRef.current,
          getAppState: () => store.getState(),
          setAppState,
          setConversationId
        });
        haikuTitleAttemptedRef.current = false;
        setHaikuTitle(undefined);
        bashTools.current.clear();
        bashToolsProcessedIdx.current = 0;

        // Restore the plan slug for the new session so getPlan() finds the file
        if (oldPlanSlug) {
          setPlanSlug(getSessionId(), oldPlanSlug);
        }
      }

      // Atomically: clear initial message, set permission mode and rules, and store plan for verification
      const shouldStorePlanForVerification = initialMsg.message.planContent && "external" === 'ant' && isEnvTruthy(undefined);
      setAppState(prev => {
        // Build and apply permission updates (mode + allowedPrompts rules)
        let updatedToolPermissionContext = initialMsg.mode ? applyPermissionUpdates(prev.toolPermissionContext, buildPermissionUpdates(initialMsg.mode, initialMsg.allowedPrompts)) : prev.toolPermissionContext;
        // For auto, override the mode (buildPermissionUpdates maps
        // it to 'default' via toExternalPermissionMode) and strip dangerous rules
        if (feature('TRANSCRIPT_CLASSIFIER') && initialMsg.mode === 'auto') {
          updatedToolPermissionContext = stripDangerousPermissionsForAutoMode({
            ...updatedToolPermissionContext,
            mode: 'auto',
            prePlanMode: undefined
          });
        }
        return {
          ...prev,
          initialMessage: null,
          toolPermissionContext: updatedToolPermissionContext,
          ...(shouldStorePlanForVerification && {
            pendingPlanVerification: {
              plan: initialMsg.message.planContent!,
              verificationStarted: false,
              verificationCompleted: false
            }
          })
        };
      });

      // Create file history snapshot for code rewind
      if (fileHistoryEnabled()) {
        void fileHistoryMakeSnapshot((updater: (prev: FileHistoryState) => FileHistoryState) => {
          setAppState(prev => ({
            ...prev,
            fileHistory: updater(prev.fileHistory)
          }));
        }, initialMsg.message.uuid);
      }

      // Ensure SessionStart hook context is available before the first API
      // call. onSubmit calls this internally but the onQuery path below
      // bypasses onSubmit — hoist here so both paths see hook messages.
      await awaitPendingHooks();

      // Route all initial prompts through onSubmit to ensure UserPromptSubmit hooks fire
      // TODO: Simplify by always routing through onSubmit once it supports
      // ContentBlockParam arrays (images) as input
      const content = initialMsg.message.message.content;

      // Route all string content through onSubmit to ensure hooks fire
      // For complex content (images, etc.), fall back to direct onQuery
      // Plan messages bypass onSubmit to preserve planContent metadata for rendering
      if (typeof content === 'string' && !initialMsg.message.planContent) {
        // Route through onSubmit for proper processing including UserPromptSubmit hooks
        void onSubmit(content, {
          setCursorOffset: () => {},
          clearBuffer: () => {},
          resetHistory: () => {}
        });
      } else {
        // Plan messages or complex content (images, etc.) - send directly to model
        // Plan messages use onQuery to preserve planContent metadata for rendering
        // TODO: Once onSubmit supports ContentBlockParam arrays, remove this branch
        const newAbortController = createAbortController();
        setAbortController(newAbortController);
        void onQuery([initialMsg.message], newAbortController, true,
        // shouldQuery
        [],
        // additionalAllowedTools
        mainLoopModel);
      }

      // Reset ref after a delay to allow new initial messages
      setTimeout(ref => {
        ref.current = false;
      }, 100, initialMessageRef);
    }
    void processInitialMessage(pending);
  }, [initialMessage, isLoading, setMessages, setAppState, onQuery, mainLoopModel, tools]);
  const onSubmit = useCallback(async (input: string, helpers: PromptInputHelpers, speculationAccept?: {
    state: ActiveSpeculationState;
    speculationSessionTimeSavedMs: number;
    setAppState: SetAppState;
  }, options?: {
    fromKeybinding?: boolean;
  }) => {
    // Re-pin scroll to bottom on submit so the user always sees the new
    // exchange (matches OpenCode's auto-scroll behavior).
    repinScroll();

    // Resume loop mode if paused
    if (feature('PROACTIVE') || feature('KAIROS')) {
      proactiveModule?.resumeProactive();
    }

    // Handle immediate commands - these bypass the queue and execute right away
    // even while Claude is processing. Commands opt-in via `immediate: true`.
    // Commands triggered via keybindings are always treated as immediate.
    if (!speculationAccept && input.trim().startsWith('/')) {
      // Expand [Pasted text #N] refs so immediate commands (e.g. /btw) receive
      // the pasted content, not the placeholder. The non-immediate path gets
      // this expansion later in handlePromptSubmit.
      const trimmedInput = expandPastedTextRefs(input, pastedContents).trim();
      const spaceIndex = trimmedInput.indexOf(' ');
      const commandName = spaceIndex === -1 ? trimmedInput.slice(1) : trimmedInput.slice(1, spaceIndex);
      const commandArgs = spaceIndex === -1 ? '' : trimmedInput.slice(spaceIndex + 1).trim();

      // Find matching command - treat as immediate if:
      // 1. Command has `immediate: true`, OR
      // 2. Command was triggered via keybinding (fromKeybinding option)
      const matchingCommand = commands.find(cmd => isCommandEnabled(cmd) && (cmd.name === commandName || cmd.aliases?.includes(commandName) || getCommandName(cmd) === commandName));
      if (matchingCommand?.name === 'clear' && idleHintShownRef.current) {
        logEvent('tengu_idle_return_action', {
          action: 'hint_converted' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          variant: idleHintShownRef.current as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          idleMinutes: Math.round((Date.now() - lastQueryCompletionTimeRef.current) / 60_000),
          messageCount: messagesRef.current.length,
          totalInputTokens: getTotalInputTokens()
        });
        idleHintShownRef.current = false;
      }
      const shouldTreatAsImmediate = queryGuard.isActive && (matchingCommand?.immediate || options?.fromKeybinding);
      if (matchingCommand && shouldTreatAsImmediate && matchingCommand.type === 'local-jsx') {
        // Only clear input if the submitted text matches what's in the prompt.
        // When a command keybinding fires, input is "/<command>" but the actual
        // input value is the user's existing text - don't clear it in that case.
        if (input.trim() === inputValueRef.current.trim()) {
          setInputValue('');
          helpers.setCursorOffset(0);
          helpers.clearBuffer();
          setPastedContents({});
        }
        const pastedTextRefs = parseReferences(input).filter(r => pastedContents[r.id]?.type === 'text');
        const pastedTextCount = pastedTextRefs.length;
        const pastedTextBytes = pastedTextRefs.reduce((sum, r) => sum + (pastedContents[r.id]?.content.length ?? 0), 0);
        logEvent('tengu_paste_text', {
          pastedTextCount,
          pastedTextBytes
        });
        logEvent('tengu_immediate_command_executed', {
          commandName: matchingCommand.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          fromKeybinding: options?.fromKeybinding ?? false
        });

        // Execute the command directly
        const executeImmediateCommand = async (): Promise<void> => {
          let doneWasCalled = false;
          const onDone = (result?: string, doneOptions?: {
            display?: CommandResultDisplay;
            metaMessages?: string[];
          }): void => {
            doneWasCalled = true;
            setToolJSX({
              jsx: null,
              shouldHidePromptInput: false,
              clearLocalJSX: true
            });
            const newMessages: MessageType[] = [];
            if (result && doneOptions?.display !== 'skip') {
              addNotification({
                key: `immediate-${matchingCommand.name}`,
                text: result,
                priority: 'immediate'
              });
              // In fullscreen the command just showed as a centered modal
              // pane — the notification above is enough feedback. Adding
              // "❯ /config" + "⎿ dismissed" to the transcript is clutter
              // (those messages are type:system subtype:local_command —
              // user-visible but NOT sent to the model, so skipping them
              // doesn't change model context). Outside fullscreen the
              // transcript entry stays so scrollback shows what ran.
              if (!isFullscreenEnvEnabled()) {
                newMessages.push(createCommandInputMessage(formatCommandInputTags(getCommandName(matchingCommand), commandArgs)), createCommandInputMessage(`<${LOCAL_COMMAND_STDOUT_TAG}>${escapeXml(result)}</${LOCAL_COMMAND_STDOUT_TAG}>`));
              }
            }
            // Inject meta messages (model-visible, user-hidden) into the transcript
            if (doneOptions?.metaMessages?.length) {
              newMessages.push(...doneOptions.metaMessages.map(content => createUserMessage({
                content,
                isMeta: true
              })));
            }
            if (newMessages.length) {
              setMessages(prev => [...prev, ...newMessages]);
            }
            // Restore stashed prompt after local-jsx command completes.
            // The normal stash restoration path (below) is skipped because
            // local-jsx commands return early from onSubmit.
            if (stashedPrompt !== undefined) {
              setInputValue(stashedPrompt.text);
              helpers.setCursorOffset(stashedPrompt.cursorOffset);
              setPastedContents(stashedPrompt.pastedContents);
              setStashedPrompt(undefined);
            }
          };

          // Build context for the command (reuses existing getToolUseContext).
          // Read messages via ref to keep onSubmit stable across message
          // updates — matches the pattern at L2384/L2400/L2662 and avoids
          // pinning stale REPL render scopes in downstream closures.
          const context = getToolUseContext(messagesRef.current, [], createAbortController(), mainLoopModel);
          const mod = await matchingCommand.load();
          const jsx = await mod.call(onDone, context, commandArgs);

          // Skip if onDone already fired — prevents stuck isLocalJSXCommand
          // (see processSlashCommand.tsx local-jsx case for full mechanism).
          if (jsx && !doneWasCalled) {
            // shouldHidePromptInput: false keeps Notifications mounted
            // so the onDone result isn't lost
            setToolJSX({
              jsx,
              shouldHidePromptInput: false,
              isLocalJSXCommand: true
            });
          }
        };
        void executeImmediateCommand();
        return; // Always return early - don't add to history or queue
      }
    }

    // Remote mode: skip empty input early before any state mutations
    if (activeRemote.isRemoteMode && !input.trim()) {
      return;
    }

    // Idle-return: prompt returning users to start fresh when the
    // conversation is large and the cache is cold. tengu_willow_mode
    // controls treatment: "dialog" (blocking), "hint" (notification), "off".
    {
      const willowMode = getFeatureValue_CACHED_MAY_BE_STALE('tengu_willow_mode', 'off');
      const idleThresholdMin = Number(process.env.CLAUDE_CODE_IDLE_THRESHOLD_MINUTES ?? 75);
      const tokenThreshold = Number(process.env.CLAUDE_CODE_IDLE_TOKEN_THRESHOLD ?? 100_000);
      if (willowMode !== 'off' && !getGlobalConfig().idleReturnDismissed && !skipIdleCheckRef.current && !speculationAccept && !input.trim().startsWith('/') && lastQueryCompletionTimeRef.current > 0 && getTotalInputTokens() >= tokenThreshold) {
        const idleMs = Date.now() - lastQueryCompletionTimeRef.current;
        const idleMinutes = idleMs / 60_000;
        if (idleMinutes >= idleThresholdMin && willowMode === 'dialog') {
          setIdleReturnPending({
            input,
            idleMinutes
          });
          setInputValue('');
          helpers.setCursorOffset(0);
          helpers.clearBuffer();
          return;
        }
      }
    }

    // Add to history for direct user submissions.
    // Queued command processing (executeQueuedInput) doesn't call onSubmit,
    // so notifications and already-queued user input won't be added to history here.
    // Skip history for keybinding-triggered commands (user didn't type the command).
    if (!options?.fromKeybinding) {
      addToHistory({
        display: speculationAccept ? input : prependModeCharacterToInput(input, inputMode),
        pastedContents: speculationAccept ? {} : pastedContents
      });
      // Add the just-submitted command to the front of the ghost-text
      // cache so it's suggested immediately (not after the 60s TTL).
      if (inputMode === 'bash') {
        prependToShellHistoryCache(input.trim());
      }
    }

    // Restore stash if present, but NOT for slash commands or when loading.
    // - Slash commands (especially interactive ones like /model, /context) hide
    //   the prompt and show a picker UI. Restoring the stash during a command would
    //   place the text in a hidden input, and the user would lose it by typing the
    //   next command. Instead, preserve the stash so it survives across command runs.
    // - When loading, the submitted input will be queued and handlePromptSubmit
    //   will clear the input field (onInputChange('')), which would clobber the
    //   restored stash. Defer restoration to after handlePromptSubmit (below).
    //   Remote mode is exempt: it sends via WebSocket and returns early without
    //   calling handlePromptSubmit, so there's no clobbering risk — restore eagerly.
    // In both deferred cases, the stash is restored after await handlePromptSubmit.
    const isSlashCommand = !speculationAccept && input.trim().startsWith('/');
    // Submit runs "now" (not queued) when not already loading, or when
    // accepting speculation, or in remote mode (which sends via WS and
    // returns early without calling handlePromptSubmit).
    const submitsNow = !isLoading || speculationAccept || activeRemote.isRemoteMode;
    if (stashedPrompt !== undefined && !isSlashCommand && submitsNow) {
      setInputValue(stashedPrompt.text);
      helpers.setCursorOffset(stashedPrompt.cursorOffset);
      setPastedContents(stashedPrompt.pastedContents);
      setStashedPrompt(undefined);
    } else if (submitsNow) {
      if (!options?.fromKeybinding) {
        // Clear input when not loading or accepting speculation.
        // Preserve input for keybinding-triggered commands.
        setInputValue('');
        helpers.setCursorOffset(0);
      }
      setPastedContents({});
    }
    if (submitsNow) {
      setInputMode('prompt');
      setIDESelection(undefined);
      setSubmitCount(_ => _ + 1);
      helpers.clearBuffer();
      tipPickedThisTurnRef.current = false;

      // Show the placeholder in the same React batch as setInputValue('').
      // Skip for slash/bash (they have their own echo), speculation and remote
      // mode (both setMessages directly with no gap to bridge).
      if (!isSlashCommand && inputMode === 'prompt' && !speculationAccept && !activeRemote.isRemoteMode) {
        setUserInputOnProcessing(input);
        // showSpinner includes userInputOnProcessing, so the spinner appears
        // on this render. Reset timing refs now (before queryGuard.reserve()
        // would) so elapsed time doesn't read as Date.now() - 0. The
        // isQueryActive transition above does the same reset — idempotent.
        resetTimingRefs();
      }

      // Increment prompt count for attribution tracking and save snapshot
      // The snapshot persists promptCount so it survives compaction
      if (feature('COMMIT_ATTRIBUTION')) {
        setAppState(prev => ({
          ...prev,
          attribution: incrementPromptCount(prev.attribution, snapshot => {
            void recordAttributionSnapshot(snapshot).catch(error => {
              logForDebugging(`Attribution: Failed to save snapshot: ${error}`);
            });
          })
        }));
      }
    }

    // Handle speculation acceptance
    if (speculationAccept) {
      const {
        queryRequired
      } = await handleSpeculationAccept(speculationAccept.state, speculationAccept.speculationSessionTimeSavedMs, speculationAccept.setAppState, input, {
        setMessages,
        readFileState,
        cwd: getOriginalCwd()
      });
      if (queryRequired) {
        const newAbortController = createAbortController();
        setAbortController(newAbortController);
        void onQuery([], newAbortController, true, [], mainLoopModel);
      }
      return;
    }

    // Remote mode: send input via stream-json instead of local query.
    // Permission requests from the remote are bridged into toolUseConfirmQueue
    // and rendered using the standard PermissionRequest component.
    //
    // local-jsx slash commands (e.g. /agents, /config) render UI in THIS
    // process — they have no remote equivalent. Let those fall through to
    // handlePromptSubmit so they execute locally. Prompt commands and
    // plain text go to the remote.
    if (activeRemote.isRemoteMode && !(isSlashCommand && commands.find(c => {
      const name = input.trim().slice(1).split(/\s/)[0];
      return isCommandEnabled(c) && (c.name === name || c.aliases?.includes(name!) || getCommandName(c) === name);
    })?.type === 'local-jsx')) {
      // Build content blocks when there are pasted attachments (images)
      const pastedValues = Object.values(pastedContents);
      const imageContents = pastedValues.filter(c => c.type === 'image');
      const imagePasteIds = imageContents.length > 0 ? imageContents.map(c => c.id) : undefined;
      let messageContent: string | ContentBlockParam[] = input.trim();
      let remoteContent: RemoteMessageContent = input.trim();
      if (pastedValues.length > 0) {
        const contentBlocks: ContentBlockParam[] = [];
        const remoteBlocks: Array<{
          type: string;
          [key: string]: unknown;
        }> = [];
        const trimmedInput = input.trim();
        if (trimmedInput) {
          contentBlocks.push({
            type: 'text',
            text: trimmedInput
          });
          remoteBlocks.push({
            type: 'text',
            text: trimmedInput
          });
        }
        for (const pasted of pastedValues) {
          if (pasted.type === 'image') {
            const source = {
              type: 'base64' as const,
              media_type: (pasted.mediaType ?? 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: pasted.content
            };
            contentBlocks.push({
              type: 'image',
              source
            });
            remoteBlocks.push({
              type: 'image',
              source
            });
          } else {
            contentBlocks.push({
              type: 'text',
              text: pasted.content
            });
            remoteBlocks.push({
              type: 'text',
              text: pasted.content
            });
          }
        }
        messageContent = contentBlocks;
        remoteContent = remoteBlocks;
      }

      // Create and add user message to UI
      // Note: empty input already handled by early return above
      const userMessage = createUserMessage({
        content: messageContent,
        imagePasteIds
      });
      setMessages(prev => [...prev, userMessage]);

      // Send to remote session
      await activeRemote.sendMessage(remoteContent, {
        uuid: userMessage.uuid
      });
      return;
    }

    // Ensure SessionStart hook context is available before the first API call.
    await awaitPendingHooks();
    await handlePromptSubmit({
      input,
      helpers,
      queryGuard,
      isExternalLoading,
      mode: inputMode,
      commands,
      onInputChange: setInputValue,
      setPastedContents,
      setToolJSX,
      getToolUseContext,
      messages: messagesRef.current,
      mainLoopModel,
      pastedContents,
      ideSelection,
      setUserInputOnProcessing,
      setAbortController,
      abortController,
      onQuery,
      setAppState,
      querySource: getQuerySourceForREPL(),
      onBeforeQuery,
      canUseTool,
      addNotification,
      setMessages,
      // Read via ref so streamMode can be dropped from onSubmit deps —
      // handlePromptSubmit only uses it for debug log + telemetry event.
      streamMode: streamModeRef.current,
      hasInterruptibleToolInProgress: hasInterruptibleToolInProgressRef.current
    });

    // Restore stash that was deferred above. Two cases:
    // - Slash command: handlePromptSubmit awaited the full command execution
    //   (including interactive pickers). Restoring now places the stash back in
    //   the visible input.
    // - Loading (queued): handlePromptSubmit enqueued + cleared input, then
    //   returned quickly. Restoring now places the stash back after the clear.
    if ((isSlashCommand || isLoading) && stashedPrompt !== undefined) {
      setInputValue(stashedPrompt.text);
      helpers.setCursorOffset(stashedPrompt.cursorOffset);
      setPastedContents(stashedPrompt.pastedContents);
      setStashedPrompt(undefined);
    }
  }, [queryGuard,
  // isLoading is read at the !isLoading checks above for input-clearing
  // and submitCount gating. It's derived from isQueryActive || isExternalLoading,
  // so including it here ensures the closure captures the fresh value.
  isLoading, isExternalLoading, inputMode, commands, setInputValue, setInputMode, setPastedContents, setSubmitCount, setIDESelection, setToolJSX, getToolUseContext,
  // messages is read via messagesRef.current inside the callback to
  // keep onSubmit stable across message updates (see L2384/L2400/L2662).
  // Without this, each setMessages call (~30× per turn) recreates
  // onSubmit, pinning the REPL render scope (1776B) + that render's
  // messages array in downstream closures (PromptInput, handleAutoRunIssue).
  // Heap analysis showed ~9 REPL scopes and ~15 messages array versions
  // accumulating after #20174/#20175, all traced to this dep.
  mainLoopModel, pastedContents, ideSelection, setUserInputOnProcessing, setAbortController, addNotification, onQuery, stashedPrompt, setStashedPrompt, setAppState, onBeforeQuery, canUseTool, remoteSession, setMessages, awaitPendingHooks, repinScroll]);

  // Callback for when user submits input while viewing a teammate's transcript
  const onAgentSubmit = useCallback(async (input: string, task: InProcessTeammateTaskState | LocalAgentTaskState, helpers: PromptInputHelpers) => {
    if (isLocalAgentTask(task)) {
      appendMessageToLocalAgent(task.id, createUserMessage({
        content: input
      }), setAppState);
      if (task.status === 'running') {
        queuePendingMessage(task.id, input, setAppState);
      } else {
        void resumeAgentBackground({
          agentId: task.id,
          prompt: input,
          toolUseContext: getToolUseContext(messagesRef.current, [], new AbortController(), mainLoopModel),
          canUseTool
        }).catch(err => {
          logForDebugging(`resumeAgentBackground failed: ${errorMessage(err)}`);
          addNotification({
            key: `resume-agent-failed-${task.id}`,
            jsx: <Text color="error">
                  Failed to resume agent: {errorMessage(err)}
                </Text>,
            priority: 'low'
          });
        });
      }
    } else {
      injectUserMessageToTeammate(task.id, input, setAppState);
    }
    setInputValue('');
    helpers.setCursorOffset(0);
    helpers.clearBuffer();
  }, [setAppState, setInputValue, getToolUseContext, canUseTool, mainLoopModel, addNotification]);

  // Handlers for auto-run /issue or /good-claude (defined after onSubmit)
  const handleAutoRunIssue = useCallback(() => {
    const command = autoRunIssueReason ? getAutoRunCommand(autoRunIssueReason) : '/issue';
    setAutoRunIssueReason(null); // Clear the state
    onSubmit(command, {
      setCursorOffset: () => {},
      clearBuffer: () => {},
      resetHistory: () => {}
    }).catch(err => {
      logForDebugging(`Auto-run ${command} failed: ${errorMessage(err)}`);
    });
  }, [onSubmit, autoRunIssueReason]);
  const handleCancelAutoRunIssue = useCallback(() => {
    setAutoRunIssueReason(null);
  }, []);

  // Handler for when user presses 1 on survey thanks screen to share details
  const handleSurveyRequestFeedback = useCallback(() => {
    const command = "external" === 'ant' ? '/issue' : '/feedback';
    onSubmit(command, {
      setCursorOffset: () => {},
      clearBuffer: () => {},
      resetHistory: () => {}
    }).catch(err => {
      logForDebugging(`Survey feedback request failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, [onSubmit]);

  // onSubmit is unstable (deps include `messages` which changes every turn).
  // `handleOpenRateLimitOptions` is prop-drilled to every MessageRow, and each
  // MessageRow fiber pins the closure (and transitively the entire REPL render
  // scope, ~1.8KB) at mount time. Using a ref keeps this callback stable so
  // old REPL scopes can be GC'd — saves ~35MB over a 1000-turn session.
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const handleOpenRateLimitOptions = useCallback(() => {
    void onSubmitRef.current('/rate-limit-options', {
      setCursorOffset: () => {},
      clearBuffer: () => {},
      resetHistory: () => {}
    });
  }, []);
  const handleExit = useCallback(async () => {
    setIsExiting(true);
    // In bg sessions, always detach instead of kill — even when a worktree is
    // active. Without this guard, the worktree branch below short-circuits into
    // ExitFlow (which calls gracefulShutdown) before exit.tsx is ever loaded.
    if (feature('BG_SESSIONS') && isBgSession()) {
      spawnSync('tmux', ['detach-client'], {
        stdio: 'ignore'
      });
      setIsExiting(false);
      return;
    }
    const showWorktree = getCurrentWorktreeSession() !== null;
    if (showWorktree) {
      setExitFlow(<ExitFlow showWorktree onDone={() => {}} onCancel={() => {
        setExitFlow(null);
        setIsExiting(false);
      }} />);
      return;
    }
    const exitMod = await exit.load();
    const exitFlowResult = await exitMod.call(() => {});
    setExitFlow(exitFlowResult);
    // If call() returned without killing the process (bg session detach),
    // clear isExiting so the UI is usable on reattach. No-op on the normal
    // path — gracefulShutdown's process.exit() means we never get here.
    if (exitFlowResult === null) {
      setIsExiting(false);
    }
  }, []);
  const handleShowMessageSelector = useCallback(() => {
    setIsMessageSelectorVisible(prev => !prev);
  }, []);

  // Rewind conversation state to just before `message`: slice messages,
  // reset conversation ID, microcompact state, permission mode, prompt suggestion.
  // Does NOT touch the prompt input. Index is computed from messagesRef (always
  // fresh via the setMessages wrapper) so callers don't need to worry about
  // stale closures.
  const rewindConversationTo = useCallback((message: UserMessage) => {
    const prev = messagesRef.current;
    const messageIndex = prev.lastIndexOf(message);
    if (messageIndex === -1) return;
    logEvent('tengu_conversation_rewind', {
      preRewindMessageCount: prev.length,
      postRewindMessageCount: messageIndex,
      messagesRemoved: prev.length - messageIndex,
      rewindToMessageIndex: messageIndex
    });
    setMessages(prev.slice(0, messageIndex));
    // Careful, this has to happen after setMessages
    setConversationId(randomUUID());
    // Reset cached microcompact state so stale pinned cache edits
    // don't reference tool_use_ids from truncated messages
    resetMicrocompactState();
    if (feature('CONTEXT_COLLAPSE')) {
      // Rewind truncates the REPL array. Commits whose archived span
      // was past the rewind point can't be projected anymore
      // (projectView silently skips them) but the staged queue and ID
      // maps reference stale uuids. Simplest safe reset: drop
      // everything. The ctx-agent will re-stage on the next
      // threshold crossing.
      /* eslint-disable @typescript-eslint/no-require-imports */
      ;
      (require('../services/contextCollapse/index.js') as typeof import('../services/contextCollapse/index.js')).resetContextCollapse();
      /* eslint-enable @typescript-eslint/no-require-imports */
    }

    // Restore state from the message we're rewinding to
    setAppState(prev => ({
      ...prev,
      // Restore permission mode from the message
      toolPermissionContext: message.permissionMode && prev.toolPermissionContext.mode !== message.permissionMode ? {
        ...prev.toolPermissionContext,
        mode: message.permissionMode
      } : prev.toolPermissionContext,
      // Clear stale prompt suggestion from previous conversation state
      promptSuggestion: {
        text: null,
        promptId: null,
        shownAt: 0,
        acceptedAt: 0,
        generationRequestId: null
      }
    }));
  }, [setMessages, setAppState]);

  // Synchronous rewind + input population. Used directly by auto-restore on
  // interrupt (so React batches with the abort's setMessages → single render,
  // no flicker). MessageSelector wraps this in setImmediate via handleRestoreMessage.
  const restoreMessageSync = useCallback((message: UserMessage) => {
    rewindConversationTo(message);
    const r = textForResubmit(message);
    if (r) {
      setInputValue(r.text);
      setInputMode(r.mode);
    }

    // Restore pasted images
    if (Array.isArray(message.message.content) && message.message.content.some(block => block.type === 'image')) {
      const imageBlocks: Array<ImageBlockParam> = message.message.content.filter(block => block.type === 'image');
      if (imageBlocks.length > 0) {
        const newPastedContents: Record<number, PastedContent> = {};
        imageBlocks.forEach((block, index) => {
          if (block.source.type === 'base64') {
            const id = message.imagePasteIds?.[index] ?? index + 1;
            newPastedContents[id] = {
              id,
              type: 'image',
              content: block.source.data,
              mediaType: block.source.media_type
            };
          }
        });
        setPastedContents(newPastedContents);
      }
    }
  }, [rewindConversationTo, setInputValue]);
  restoreMessageSyncRef.current = restoreMessageSync;

  // MessageSelector path: defer via setImmediate so the "Interrupted" message
  // renders to static output before rewind — otherwise it remains vestigial
  // at the top of the screen.
  const handleRestoreMessage = useCallback(async (message: UserMessage) => {
    setImmediate((restore, message) => restore(message), restoreMessageSync, message);
  }, [restoreMessageSync]);

  // Not memoized — hook stores caps via ref, reads latest closure at dispatch.
  // 24-char prefix: deriveUUID preserves first 24, renderable uuid prefix-matches raw source.
  const findRawIndex = (uuid: string) => {
    const prefix = uuid.slice(0, 24);
    return messages.findIndex(m => m.uuid.slice(0, 24) === prefix);
  };
  const messageActionCaps: MessageActionCaps = {
    copy: text =>
    // setClipboard RETURNS OSC 52 — caller must stdout.write (tmux side-effects load-buffer, but that's tmux-only).
    void setClipboard(text).then(raw => {
      if (raw) process.stdout.write(raw);
      addNotification({
        // Same key as text-selection copy — repeated copies replace toast, don't queue.
        key: 'selection-copied',
        text: 'copied',
        color: 'success',
        priority: 'immediate',
        timeoutMs: 2000
      });
    }),
    edit: async msg => {
      // Same skip-confirm check as /rewind: lossless → direct, else confirm dialog.
      const rawIdx = findRawIndex(msg.uuid);
      const raw = rawIdx >= 0 ? messages[rawIdx] : undefined;
      if (!raw || !selectableUserMessagesFilter(raw)) return;
      const noFileChanges = !(await fileHistoryHasAnyChanges(fileHistory, raw.uuid));
      const onlySynthetic = messagesAfterAreOnlySynthetic(messages, rawIdx);
      if (noFileChanges && onlySynthetic) {
        // rewindConversationTo's setMessages races stream appends — cancel first (idempotent).
        onCancel();
        // handleRestoreMessage also restores pasted images.
        void handleRestoreMessage(raw);
      } else {
        // Dialog path: onPreRestore (= onCancel) fires when user CONFIRMS, not on nevermind.
        setMessageSelectorPreselect(raw);
        setIsMessageSelectorVisible(true);
      }
    }
  };
  const {
    enter: enterMessageActions,
    handlers: messageActionHandlers
  } = useMessageActions(cursor, setCursor, cursorNavRef, messageActionCaps);
  async function onInit() {
    // Always verify API key on startup, so we can show the user an error in the
    // bottom right corner of the screen if the API key is invalid.
    void reverify();

    // Populate readFileState with CLAUDE.md files at startup
    const memoryFiles = await getMemoryFiles();
    if (memoryFiles.length > 0) {
      const fileList = memoryFiles.map(f => `  [${f.type}] ${f.path} (${f.content.length} chars)${f.parent ? ` (included by ${f.parent})` : ''}`).join('\n');
      logForDebugging(`Loaded ${memoryFiles.length} CLAUDE.md/rules files:\n${fileList}`);
    } else {
      logForDebugging('No CLAUDE.md/rules files found');
    }
    for (const file of memoryFiles) {
      // When the injected content doesn't match disk (stripped HTML comments,
      // stripped frontmatter, MEMORY.md truncation), cache the RAW disk bytes
      // with isPartialView so Edit/Write require a real Read first while
      // getChangedFiles + nested_memory dedup still work.
      readFileState.current.set(file.path, {
        content: file.contentDiffersFromDisk ? file.rawContent ?? file.content : file.content,
        timestamp: Date.now(),
        offset: undefined,
        limit: undefined,
        isPartialView: file.contentDiffersFromDisk
      });
    }

    // Initial message handling is done via the initialMessage effect
  }

  // Register cost summary tracker
  useCostSummary(useFpsMetrics());

  // Record transcripts locally, for debugging and conversation recovery
  // Don't record conversation if we only have initial messages; optimizes
  // the case where user resumes a conversation then quites before doing
  // anything else
  useLogMessages(messages, messages.length === initialMessages?.length);

  // REPL Bridge: replicate user/assistant messages to the bridge session
  // for remote access via claude.ai. No-op in external builds or when not enabled.
  const {
    sendBridgeResult
  } = useReplBridge(messages, setMessages, abortControllerRef, commands, mainLoopModel);
  sendBridgeResultRef.current = sendBridgeResult;
  useAfterFirstRender();

  // Track prompt queue usage for analytics. Fire once per transition from
  // empty to non-empty, not on every length change -- otherwise a render loop
  // (concurrent onQuery thrashing, etc.) spams saveGlobalConfig, which hits
  // ELOCKED under concurrent sessions and falls back to unlocked writes.
  // That write storm is the primary trigger for ~/.claude.json corruption
  // (GH #3117).
  const hasCountedQueueUseRef = useRef(false);
  useEffect(() => {
    if (queuedCommands.length < 1) {
      hasCountedQueueUseRef.current = false;
      return;
    }
    if (hasCountedQueueUseRef.current) return;
    hasCountedQueueUseRef.current = true;
    saveGlobalConfig(current => ({
      ...current,
      promptQueueUseCount: (current.promptQueueUseCount ?? 0) + 1
    }));
  }, [queuedCommands.length]);

  // Process queued commands when query completes and queue has items

  const executeQueuedInput = useCallback(async (queuedCommands: QueuedCommand[]) => {
    await handlePromptSubmit({
      helpers: {
        setCursorOffset: () => {},
        clearBuffer: () => {},
        resetHistory: () => {}
      },
      queryGuard,
      commands,
      onInputChange: () => {},
      setPastedContents: () => {},
      setToolJSX,
      getToolUseContext,
      messages,
      mainLoopModel,
      ideSelection,
      setUserInputOnProcessing,
      setAbortController,
      onQuery,
      setAppState,
      querySource: getQuerySourceForREPL(),
      onBeforeQuery,
      canUseTool,
      addNotification,
      setMessages,
      queuedCommands
    });
  }, [queryGuard, commands, setToolJSX, getToolUseContext, messages, mainLoopModel, ideSelection, setUserInputOnProcessing, canUseTool, setAbortController, onQuery, addNotification, setAppState, onBeforeQuery]);
  useQueueProcessor({
    executeQueuedInput,
    hasActiveLocalJsxUI: isShowingLocalJSXCommand,
    queryGuard
  });

  // We'll use the global lastInteractionTime from state.ts

  // Update last interaction time when input changes.
  // Must be immediate because useEffect runs after the Ink render cycle flush.
  useEffect(() => {
    activityManager.recordUserActivity();
    updateLastInteractionTime(true);
  }, [inputValue, submitCount]);
  useEffect(() => {
    if (submitCount === 1) {
      startBackgroundHousekeeping();
    }
  }, [submitCount]);

  // Show notification when Claude is done responding and user is idle
  useEffect(() => {
    // Don't set up notification if Claude is busy
    if (isLoading) return;

    // Only enable notifications after the first new interaction in this session
    if (submitCount === 0) return;

    // No query has completed yet
    if (lastQueryCompletionTime === 0) return;

    // Set timeout to check idle state
    const timer = setTimeout((lastQueryCompletionTime, isLoading, toolJSX, focusedInputDialogRef, terminal) => {
      // Check if user has interacted since the response ended
      const lastUserInteraction = getLastInteractionTime();
      if (lastUserInteraction > lastQueryCompletionTime) {
        // User has interacted since Claude finished - they're not idle, don't notify
        return;
      }

      // User hasn't interacted since response ended, check other conditions
      const idleTimeSinceResponse = Date.now() - lastQueryCompletionTime;
      if (!isLoading && !toolJSX &&
      // Use ref to get current dialog state, avoiding stale closure
      focusedInputDialogRef.current === undefined && idleTimeSinceResponse >= getGlobalConfig().messageIdleNotifThresholdMs) {
        void sendNotification({
          message: 'Claude is waiting for your input',
          notificationType: 'idle_prompt'
        }, terminal);
      }
    }, getGlobalConfig().messageIdleNotifThresholdMs, lastQueryCompletionTime, isLoading, toolJSX, focusedInputDialogRef, terminal);
    return () => clearTimeout(timer);
  }, [isLoading, toolJSX, submitCount, lastQueryCompletionTime, terminal]);

  // Idle-return hint: show notification when idle threshold is exceeded.
  // Timer fires after the configured idle period; notification persists until
  // dismissed or the user submits.
  useEffect(() => {
    if (lastQueryCompletionTime === 0) return;
    if (isLoading) return;
    const willowMode: string = getFeatureValue_CACHED_MAY_BE_STALE('tengu_willow_mode', 'off');
    if (willowMode !== 'hint' && willowMode !== 'hint_v2') return;
    if (getGlobalConfig().idleReturnDismissed) return;
    const tokenThreshold = Number(process.env.CLAUDE_CODE_IDLE_TOKEN_THRESHOLD ?? 100_000);
    if (getTotalInputTokens() < tokenThreshold) return;
    const idleThresholdMs = Number(process.env.CLAUDE_CODE_IDLE_THRESHOLD_MINUTES ?? 75) * 60_000;
    const elapsed = Date.now() - lastQueryCompletionTime;
    const remaining = idleThresholdMs - elapsed;
    const timer = setTimeout((lqct, addNotif, msgsRef, mode, hintRef) => {
      if (msgsRef.current.length === 0) return;
      const totalTokens = getTotalInputTokens();
      const formattedTokens = formatTokens(totalTokens);
      const idleMinutes = (Date.now() - lqct) / 60_000;
      addNotif({
        key: 'idle-return-hint',
        jsx: mode === 'hint_v2' ? <>
                <Text dimColor>new task? </Text>
                <Text color="suggestion">/clear</Text>
                <Text dimColor> to save </Text>
                <Text color="suggestion">{formattedTokens} tokens</Text>
              </> : <Text color="warning">
                new task? /clear to save {formattedTokens} tokens
              </Text>,
        priority: 'medium',
        // Persist until submit — the hint fires at T+75min idle, user may
        // not return for hours. removeNotification in useEffect cleanup
        // handles dismissal. 0x7FFFFFFF = setTimeout max (~24.8 days).
        timeoutMs: 0x7fffffff
      });
      hintRef.current = mode;
      logEvent('tengu_idle_return_action', {
        action: 'hint_shown' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        variant: mode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        idleMinutes: Math.round(idleMinutes),
        messageCount: msgsRef.current.length,
        totalInputTokens: totalTokens
      });
    }, Math.max(0, remaining), lastQueryCompletionTime, addNotification, messagesRef, willowMode, idleHintShownRef);
    return () => {
      clearTimeout(timer);
      removeNotification('idle-return-hint');
      idleHintShownRef.current = false;
    };
  }, [lastQueryCompletionTime, isLoading, addNotification, removeNotification]);

  // Submits incoming prompts from teammate messages or tasks mode as new turns
  // Returns true if submission succeeded, false if a query is already running
  const handleIncomingPrompt = useCallback((content: string, options?: {
    isMeta?: boolean;
  }): boolean => {
    if (queryGuard.isActive) return false;

    // Defer to user-queued commands — user input always takes priority
    // over system messages (teammate messages, task list items, etc.)
    // Read from the module-level store at call time (not the render-time
    // snapshot) to avoid a stale closure — this callback's deps don't
    // include the queue.
    if (getCommandQueue().some(cmd => cmd.mode === 'prompt' || cmd.mode === 'bash')) {
      return false;
    }
    const newAbortController = createAbortController();
    setAbortController(newAbortController);

    // Create a user message with the formatted content (includes XML wrapper)
    const userMessage = createUserMessage({
      content,
      isMeta: options?.isMeta ? true : undefined
    });
    void onQuery([userMessage], newAbortController, true, [], mainLoopModel);
    return true;
  }, [onQuery, mainLoopModel, store]);

  // Voice input integration (VOICE_MODE builds only)
  const voice = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useVoiceIntegration({
    setInputValueRaw,
    inputValueRef,
    insertTextRef
  }) : {
    stripTrailing: () => 0,
    handleKeyEvent: () => {},
    resetAnchor: () => {},
    interimRange: null
  };
  useInboxPoller({
    enabled: isAgentSwarmsEnabled(),
    isLoading,
    focusedInputDialog,
    onSubmitMessage: handleIncomingPrompt
  });
  useMailboxBridge({
    isLoading,
    onSubmitMessage: handleIncomingPrompt
  });

  // Scheduled tasks from .claude/scheduled_tasks.json (CronCreate/Delete/List)
  if (feature('AGENT_TRIGGERS')) {
    // Assistant mode bypasses the isLoading gate (the proactive tick →
    // Sleep → tick loop would otherwise starve the scheduler).
    // kairosEnabled is set once in initialState (main.tsx) and never mutated — no
    // subscription needed. The tengu_kairos_cron runtime gate is checked inside
    // useScheduledTasks's effect (not here) since wrapping a hook call in a dynamic
    // condition would break rules-of-hooks.
    const assistantMode = store.getState().kairosEnabled;
    // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
    useScheduledTasks!({
      isLoading,
      assistantMode,
      setMessages
    });
  }

  // Note: Permission polling is now handled by useInboxPoller
  // - Workers receive permission responses via mailbox messages
  // - Leaders receive permission requests via mailbox messages

  if ("external" === 'ant') {
    // Tasks mode: watch for tasks and auto-process them
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // biome-ignore lint/correctness/useHookAtTopLevel: conditional for dead code elimination in external builds
    useTaskListWatcher({
      taskListId,
      isLoading,
      onSubmitTask: handleIncomingPrompt
    });

    // Loop mode: auto-tick when enabled (via /job command)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // biome-ignore lint/correctness/useHookAtTopLevel: conditional for dead code elimination in external builds
    useProactive?.({
      // Suppress ticks while an initial message is pending — the initial
      // message will be processed asynchronously and a premature tick would
      // race with it, causing concurrent-query enqueue of expanded skill text.
      isLoading: isLoading || initialMessage !== null,
      queuedCommandsLength: queuedCommands.length,
      hasActiveLocalJsxUI: isShowingLocalJSXCommand,
      isInPlanMode: toolPermissionContext.mode === 'plan',
      onSubmitTick: (prompt: string) => handleIncomingPrompt(prompt, {
        isMeta: true
      }),
      onQueueTick: (prompt: string) => enqueue({
        mode: 'prompt',
        value: prompt,
        isMeta: true
      })
    });
  }

  // Abort the current operation when a 'now' priority message arrives
  // (e.g. from a chat UI client via UDS).
  useEffect(() => {
    if (queuedCommands.some(cmd => cmd.priority === 'now')) {
      abortControllerRef.current?.abort('interrupt');
    }
  }, [queuedCommands]);

  // Initial load
  useEffect(() => {
    void onInit();

    // Cleanup on unmount
    return () => {
      void diagnosticTracker.shutdown();
    };
    // TODO: fix this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for suspend/resume events
  const {
    internal_eventEmitter
  } = useStdin();
  const [remountKey, setRemountKey] = useState(0);
  useEffect(() => {
    const handleSuspend = () => {
      // Print suspension instructions
      process.stdout.write(`\nClaude Code has been suspended. Run \`fg\` to bring Claude Code back.\nNote: ctrl + z now suspends Claude Code, ctrl + _ undoes input.\n`);
    };
    const handleResume = () => {
      // Force complete component tree replacement instead of terminal clear
      // Ink now handles line count reset internally on SIGCONT
      setRemountKey(prev => prev + 1);
    };
    internal_eventEmitter?.on('suspend', handleSuspend);
    internal_eventEmitter?.on('resume', handleResume);
    return () => {
      internal_eventEmitter?.off('suspend', handleSuspend);
      internal_eventEmitter?.off('resume', handleResume);
    };
  }, [internal_eventEmitter]);

  // Derive stop hook spinner suffix from messages state
  const stopHookSpinnerSuffix = useMemo(() => {
    if (!isLoading) return null;

    // Find stop hook progress messages
    const progressMsgs = messages.filter((m): m is ProgressMessage<HookProgress> => m.type === 'progress' && m.data.type === 'hook_progress' && (m.data.hookEvent === 'Stop' || m.data.hookEvent === 'SubagentStop'));
    if (progressMsgs.length === 0) return null;

    // Get the most recent stop hook execution
    const currentToolUseID = progressMsgs.at(-1)?.toolUseID;
    if (!currentToolUseID) return null;

    // Check if there's already a summary message for this execution (hooks completed)
    const hasSummaryForCurrentExecution = messages.some(m => m.type === 'system' && m.subtype === 'stop_hook_summary' && m.toolUseID === currentToolUseID);
    if (hasSummaryForCurrentExecution) return null;
    const currentHooks = progressMsgs.filter(p => p.toolUseID === currentToolUseID);
    const total = currentHooks.length;

    // Count completed hooks
    const completedCount = count(messages, m => {
      if (m.type !== 'attachment') return false;
      const attachment = m.attachment;
      return 'hookEvent' in attachment && (attachment.hookEvent === 'Stop' || attachment.hookEvent === 'SubagentStop') && 'toolUseID' in attachment && attachment.toolUseID === currentToolUseID;
    });

    // Check if any hook has a custom status message
    const customMessage = currentHooks.find(p => p.data.statusMessage)?.data.statusMessage;
    if (customMessage) {
      // Use custom message with progress counter if multiple hooks
      return total === 1 ? `${customMessage}…` : `${customMessage}… ${completedCount}/${total}`;
    }

    // Fall back to default behavior
    const hookType = currentHooks[0]?.data.hookEvent === 'SubagentStop' ? 'subagent stop' : 'stop';
    if ("external" === 'ant') {
      const cmd = currentHooks[completedCount]?.data.command;
      const label = cmd ? ` '${truncateToWidth(cmd, 40)}'` : '';
      return total === 1 ? `running ${hookType} hook${label}` : `running ${hookType} hook${label}\u2026 ${completedCount}/${total}`;
    }
    return total === 1 ? `running ${hookType} hook` : `running stop hooks… ${completedCount}/${total}`;
  }, [messages, isLoading]);

  // Callback to capture frozen state when entering transcript mode
  const handleEnterTranscript = useCallback(() => {
    setFrozenTranscriptState({
      messagesLength: messages.length,
      streamingToolUsesLength: streamingToolUses.length
    });
  }, [messages.length, streamingToolUses.length]);

  // Callback to clear frozen state when exiting transcript mode
  const handleExitTranscript = useCallback(() => {
    setFrozenTranscriptState(null);
  }, []);

  // Props for GlobalKeybindingHandlers component (rendered inside KeybindingSetup)
  const virtualScrollActive = isFullscreenEnvEnabled() && !disableVirtualScroll;

  // Transcript search state. Hooks must be unconditional so they live here
  // (not inside the `if (screen === 'transcript')` branch below); isActive
  // gates the useInput. Query persists across bar open/close so n/N keep
  // working after Enter dismisses the bar (less semantics).
  const jumpRef = useRef<JumpHandle | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCount, setSearchCount] = useState(0);
  const [searchCurrent, setSearchCurrent] = useState(0);
  const onSearchMatchesChange = useCallback((count: number, current: number) => {
    setSearchCount(count);
    setSearchCurrent(current);
  }, []);
  useInput((input, key, event) => {
    if (key.ctrl || key.meta) return;
    // No Esc handling here — less has no navigating mode. Search state
    // (highlights, n/N) is just state. Esc/q/ctrl+c → transcript:exit
    // (ungated). Highlights clear on exit via the screen-change effect.
    if (input === '/') {
      // Capture scrollTop NOW — typing is a preview, 0-matches snaps
      // back here. Synchronous ref write, fires before the bar's
      // mount-effect calls setSearchQuery.
      jumpRef.current?.setAnchor();
      setSearchOpen(true);
      event.stopImmediatePropagation();
      return;
    }
    // Held-key batching: tokenizer coalesces to 'nnn'. Same uniform-batch
    // pattern as modalPagerAction in ScrollKeybindingHandler.tsx. Each
    // repeat is a step (n isn't idempotent like g).
    const c = input[0];
    if ((c === 'n' || c === 'N') && input === c.repeat(input.length) && searchCount > 0) {
      const fn = c === 'n' ? jumpRef.current?.nextMatch : jumpRef.current?.prevMatch;
      if (fn) for (let i = 0; i < input.length; i++) fn();
      event.stopImmediatePropagation();
    }
  },
  // Search needs virtual scroll (jumpRef drives VirtualMessageList). [
  // kills it, so !dumpMode — after [ there's nothing to jump in.
  {
    isActive: screen === 'transcript' && virtualScrollActive && !searchOpen && !dumpMode
  });
  const {
    setQuery: setHighlight,
    scanElement,
    setPositions
  } = useSearchHighlight();

  // Resize → abort search. Positions are (msg, query, WIDTH)-keyed —
  // cached positions are stale after a width change (new layout, new
  // wrapping). Clearing searchQuery triggers VML's setSearchQuery('')
  // which clears positionsCache + setPositions(null). Bar closes.
  // User hits / again → fresh everything.
  const transcriptCols = useTerminalSize().columns;
  const prevColsRef = React.useRef(transcriptCols);
  React.useEffect(() => {
    if (prevColsRef.current !== transcriptCols) {
      prevColsRef.current = transcriptCols;
      if (searchQuery || searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchCount(0);
        setSearchCurrent(0);
        jumpRef.current?.disarmSearch();
        setHighlight('');
      }
    }
  }, [transcriptCols, searchQuery, searchOpen, setHighlight]);

  // Transcript escape hatches. Bare letters in modal context (no prompt
  // competing for input) — same class as g/G/j/k in ScrollKeybindingHandler.
  useInput((input, key, event) => {
    if (key.ctrl || key.meta) return;
    if (input === 'q') {
      // less: q quits the pager. ctrl+o toggles; q is the lineage exit.
      handleExitTranscript();
      event.stopImmediatePropagation();
      return;
    }
    if (input === '[' && !dumpMode) {
      // Force dump-to-scrollback. Also expand + uncap — no point dumping
      // a subset. Terminal/tmux cmd-F can now find anything. Guard here
      // (not in isActive) so v still works post-[ — dump-mode footer at
      // ~4898 wires editorStatus, confirming v is meant to stay live.
      setDumpMode(true);
      setShowAllInTranscript(true);
      event.stopImmediatePropagation();
    } else if (input === 'v') {
      // less-style: v opens the file in $VISUAL/$EDITOR. Render the full
      // transcript (same path /export uses), write to tmp, hand off.
      // openFileInExternalEditor handles alt-screen suspend/resume for
      // terminal editors; GUI editors spawn detached.
      event.stopImmediatePropagation();
      // Drop double-taps: the render is async and a second press before it
      // completes would run a second parallel render (double memory, two
      // tempfiles, two editor spawns). editorGenRef only guards
      // transcript-exit staleness, not same-session concurrency.
      if (editorRenderingRef.current) return;
      editorRenderingRef.current = true;
      // Capture generation + make a staleness-aware setter. Each write
      // checks gen (transcript exit bumps it → late writes from the
      // async render go silent).
      const gen = editorGenRef.current;
      const setStatus = (s: string): void => {
        if (gen !== editorGenRef.current) return;
        clearTimeout(editorTimerRef.current);
        setEditorStatus(s);
      };
      setStatus(`rendering ${deferredMessages.length} messages…`);
      void (async () => {
        try {
          // Width = terminal minus vim's line-number gutter (4 digits +
          // space + slack). Floor at 80. PassThrough has no .columns so
          // without this Ink defaults to 80. Trailing-space strip: right-
          // aligned timestamps still leave a flexbox spacer run at EOL.
          // eslint-disable-next-line custom-rules/prefer-use-terminal-size -- one-shot at keypress time, not a reactive render dep
          const w = Math.max(80, (process.stdout.columns ?? 80) - 6);
          const raw = await renderMessagesToPlainText(deferredMessages, tools, w);
          const text = raw.replace(/[ \t]+$/gm, '');
          const path = join(tmpdir(), `cc-transcript-${Date.now()}.txt`);
          await writeFile(path, text);
          const opened = openFileInExternalEditor(path);
          setStatus(opened ? `opening ${path}` : `wrote ${path} · no $VISUAL/$EDITOR set`);
        } catch (e) {
          setStatus(`render failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        editorRenderingRef.current = false;
        if (gen !== editorGenRef.current) return;
        editorTimerRef.current = setTimeout(s => s(''), 4000, setEditorStatus);
      })();
    }
  },
  // !searchOpen: typing 'v' or '[' in the search bar is search input, not
  // a command. No !dumpMode here — v should work after [ (the [ handler
  // guards itself inline).
  {
    isActive: screen === 'transcript' && virtualScrollActive && !searchOpen
  });

  // Fresh `less` per transcript entry. Prevents stale highlights matching
  // unrelated normal-mode text (overlay is alt-screen-global) and avoids
  // surprise n/N on re-entry. Same exit resets [ dump mode — each ctrl+o
  // entry is a fresh instance.
  const inTranscript = screen === 'transcript' && virtualScrollActive;
  useEffect(() => {
    if (!inTranscript) {
      setSearchQuery('');
      setSearchCount(0);
      setSearchCurrent(0);
      setSearchOpen(false);
      editorGenRef.current++;
      clearTimeout(editorTimerRef.current);
      setDumpMode(false);
      setEditorStatus('');
    }
  }, [inTranscript]);
  useEffect(() => {
    setHighlight(inTranscript ? searchQuery : '');
    // Clear the position-based CURRENT (yellow) overlay too. setHighlight
    // only clears the scan-based inverse. Without this, the yellow box
    // persists at its last screen coords after ctrl-c exits transcript.
    if (!inTranscript) setPositions(null);
  }, [inTranscript, searchQuery, setHighlight, setPositions]);
  const globalKeybindingProps = {
    screen,
    setScreen,
    showAllInTranscript,
    setShowAllInTranscript,
    messageCount: messages.length,
    onEnterTranscript: handleEnterTranscript,
    onExitTranscript: handleExitTranscript,
    virtualScrollActive,
    // Bar-open is a mode (owns keystrokes — j/k type, Esc cancels).
    // Navigating (query set, bar closed) is NOT — Esc exits transcript,
    // same as less q with highlights still visible. useSearchInput
    // doesn't stopPropagation, so without this gate transcript:exit
    // would fire on the same Esc that cancels the bar (child registers
    // first, fires first, bubbles).
    searchBarOpen: searchOpen
  };

  // Use frozen lengths to slice arrays, avoiding memory overhead of cloning
  const transcriptMessages = frozenTranscriptState ? deferredMessages.slice(0, frozenTranscriptState.messagesLength) : deferredMessages;
  const transcriptStreamingToolUses = frozenTranscriptState ? streamingToolUses.slice(0, frozenTranscriptState.streamingToolUsesLength) : streamingToolUses;

  // Handle shift+down for teammate navigation and background task management.
  // Guard onOpenBackgroundTasks when a local-jsx dialog (e.g. /mcp) is open —
  // otherwise Shift+Down stacks BackgroundTasksDialog on top and deadlocks input.
  useBackgroundTaskNavigation({
    onOpenBackgroundTasks: isShowingLocalJSXCommand ? undefined : () => setShowBashesDialog(true)
  });
  // Auto-exit viewing mode when teammate completes or errors
  useTeammateViewAutoExit();
  if (screen === 'transcript') {
    // Virtual scroll replaces the 30-message cap: everything is scrollable
    // and memory is bounded by the viewport. Without it, wrapping transcript
    // in a ScrollBox would mount all messages (~250 MB on long sessions —
    // the exact problem), so the kill switch and non-fullscreen paths must
    // fall through to the legacy render: no alt screen, dump to terminal
    // scrollback, 30-cap + Ctrl+E. Reusing scrollRef is safe — normal-mode
    // and transcript-mode are mutually exclusive (this early return), so
    // only one ScrollBox is ever mounted at a time.
    const transcriptScrollRef = isFullscreenEnvEnabled() && !disableVirtualScroll && !dumpMode ? scrollRef : undefined;
    const transcriptMessagesElement = <Messages messages={transcriptMessages} tools={tools} commands={commands} verbose={true} toolJSX={null} toolUseConfirmQueue={[]} inProgressToolUseIDs={inProgressToolUseIDs} isMessageSelectorVisible={false} conversationId={conversationId} screen={screen} agentDefinitions={agentDefinitions} streamingToolUses={transcriptStreamingToolUses} showAllInTranscript={showAllInTranscript} onOpenRateLimitOptions={handleOpenRateLimitOptions} isLoading={isLoading} hidePastThinking={true} streamingThinking={streamingThinking} scrollRef={transcriptScrollRef} jumpRef={jumpRef} onSearchMatchesChange={onSearchMatchesChange} scanElement={scanElement} setPositions={setPositions} disableRenderCap={dumpMode} />;
    const transcriptToolJSX = toolJSX && <Box flexDirection="column" width="100%">
        {toolJSX.jsx}
      </Box>;
    const transcriptReturn = <KeybindingSetup>
        <AnimatedTerminalTitle isAnimating={titleIsAnimating} title={terminalTitle} disabled={titleDisabled} noPrefix={showStatusInTerminalTab} />
        <GlobalKeybindingHandlers {...globalKeybindingProps} />
        {feature('VOICE_MODE') ? <VoiceKeybindingHandler voiceHandleKeyEvent={voice.handleKeyEvent} stripTrailing={voice.stripTrailing} resetAnchor={voice.resetAnchor} isActive={!toolJSX?.isLocalJSXCommand} /> : null}
        <CommandKeybindingHandlers onSubmit={onSubmit} isActive={!toolJSX?.isLocalJSXCommand} />
        {transcriptScrollRef ?
      // ScrollKeybindingHandler must mount before CancelRequestHandler so
      // ctrl+c-with-selection copies instead of cancelling the active task.
      // Its raw useInput handler only stops propagation when a selection
      // exists — without one, ctrl+c falls through to CancelRequestHandler.
      <ScrollKeybindingHandler scrollRef={scrollRef}
      // Yield wheel/ctrl+u/d to UltraplanChoiceDialog's own scroll
      // handler while the modal is showing.
      isActive={focusedInputDialog !== 'ultraplan-choice'}
      // g/G/j/k/ctrl+u/ctrl+d would eat keystrokes the search bar
      // wants. Off while searching.
      isModal={!searchOpen}
      // Manual scroll exits the search context — clear the yellow
      // current-match marker. Positions are (msg, rowOffset)-keyed;
      // j/k changes scrollTop so rowOffset is stale → wrong row
      // gets yellow. Next n/N re-establishes via step()→jump().
      onScroll={() => jumpRef.current?.disarmSearch()} /> : null}
        <CancelRequestHandler {...cancelRequestProps} />
        {transcriptScrollRef ? <FullscreenLayout scrollRef={scrollRef} scrollable={<>
                {transcriptMessagesElement}
                {transcriptToolJSX}
                <SandboxViolationExpandedView />
              </>} bottom={searchOpen ? <TranscriptSearchBar jumpRef={jumpRef}
      // Seed was tried (c01578c8) — broke /hello muscle
      // memory (cursor lands after 'foo', /hello → foohello).
      // Cancel-restore handles the 'don't lose prior search'
      // concern differently (onCancel re-applies searchQuery).
      initialQuery="" count={searchCount} current={searchCurrent} onClose={q => {
        // Enter — commit. 0-match guard: junk query shouldn't
        // persist (badge hidden, n/N dead anyway).
        setSearchQuery(searchCount > 0 ? q : '');
        setSearchOpen(false);
        // onCancel path: bar unmounts before its useEffect([query])
        // can fire with ''. Without this, searchCount stays stale
        // (n guard at :4956 passes) and VML's matches[] too
        // (nextMatch walks the old array). Phantom nav, no
        // highlight. onExit (Enter, q non-empty) still commits.
        if (!q) {
          setSearchCount(0);
          setSearchCurrent(0);
          jumpRef.current?.setSearchQuery('');
        }
      }} onCancel={() => {
        // Esc/ctrl+c/ctrl+g — undo. Bar's effect last fired
        // with whatever was typed. searchQuery (REPL state)
        // is unchanged since / (onClose = commit, didn't run).
        // Two VML calls: '' restores anchor (0-match else-
        // branch), then searchQuery re-scans from anchor's
        // nearest. Both synchronous — one React batch.
        // setHighlight explicit: REPL's sync-effect dep is
        // searchQuery (unchanged), wouldn't re-fire.
        setSearchOpen(false);
        jumpRef.current?.setSearchQuery('');
        jumpRef.current?.setSearchQuery(searchQuery);
        setHighlight(searchQuery);
      }} setHighlight={setHighlight} /> : <TranscriptModeFooter showAllInTranscript={showAllInTranscript} virtualScroll={true} status={editorStatus || undefined} searchBadge={searchQuery && searchCount > 0 ? {
        current: searchCurrent,
        count: searchCount
      } : undefined} />} /> : <>
            {transcriptMessagesElement}
            {transcriptToolJSX}
            <SandboxViolationExpandedView />
            <TranscriptModeFooter showAllInTranscript={showAllInTranscript} virtualScroll={false} suppressShowAll={dumpMode} status={editorStatus || undefined} />
          </>}
      </KeybindingSetup>;
    // The virtual-scroll branch (FullscreenLayout above) needs
    // <AlternateScreen>'s <Box height={rows}> constraint — without it,
    // ScrollBox's flexGrow has no ceiling, viewport = content height,
    // scrollTop pins at 0, and Ink's screen buffer sizes to the full
    // spacer (200×5k+ rows on long sessions). Same root type + props as
    // normal mode's wrap below so React reconciles and the alt buffer
    // stays entered across toggle. The 30-cap dump branch stays
    // unwrapped — it wants native terminal scrollback.
    if (transcriptScrollRef) {
      return <AlternateScreen mouseTracking={isMouseTrackingEnabled()}>
          {transcriptReturn}
        </AlternateScreen>;
    }
    return transcriptReturn;
  }

  // Get viewed agent task (inlined from selectors for explicit data flow).
  // viewedAgentTask: teammate OR local_agent — drives the boolean checks
  // below. viewedTeammateTask: teammate-only narrowed, for teammate-specific
  // field access (inProgressToolUseIDs).
  const viewedTask = viewingAgentTaskId ? tasks[viewingAgentTaskId] : undefined;
  const viewedTeammateTask = viewedTask && isInProcessTeammateTask(viewedTask) ? viewedTask : undefined;
  const viewedAgentTask = viewedTeammateTask ?? (viewedTask && isLocalAgentTask(viewedTask) ? viewedTask : undefined);

  // Bypass useDeferredValue when streaming text is showing so Messages renders
  // the final message in the same frame streaming text clears. Also bypass when
  // not loading — deferredMessages only matters during streaming (keeps input
  // responsive); after the turn ends, showing messages immediately prevents a
  // jitter gap where the spinner is gone but the answer hasn't appeared yet.
  // Only reducedMotion users keep the deferred path during loading.
  const usesSyncMessages = showStreamingText || !isLoading;
  // When viewing an agent, never fall through to leader — empty until
  // bootstrap/stream fills. Closes the see-leader-type-agent footgun.
  const displayedMessages = viewedAgentTask ? viewedAgentTask.messages ?? [] : usesSyncMessages ? messages : deferredMessages;
  // Show the placeholder until the real user message appears in
  // displayedMessages. userInputOnProcessing stays set for the whole turn
  // (cleared in resetLoadingState); this length check hides it once
  // displayedMessages grows past the baseline captured at submit time.
  // Covers both gaps: before setMessages is called (processUserInput), and
  // while deferredMessages lags behind messages. Suppressed when viewing an
  // agent — displayedMessages is a different array there, and onAgentSubmit
  // doesn't use the placeholder anyway.
  const placeholderText = userInputOnProcessing && !viewedAgentTask && displayedMessages.length <= userInputBaselineRef.current ? userInputOnProcessing : undefined;
  const toolPermissionOverlay = focusedInputDialog === 'tool-permission' ? <PermissionRequest key={toolUseConfirmQueue[0]?.toolUseID} onDone={() => setToolUseConfirmQueue(([_, ...tail]) => tail)} onReject={handleQueuedCommandOnCancel} toolUseConfirm={toolUseConfirmQueue[0]!} toolUseContext={getToolUseContext(messages, messages, abortController ?? createAbortController(), mainLoopModel)} verbose={verbose} workerBadge={toolUseConfirmQueue[0]?.workerBadge} setStickyFooter={isFullscreenEnvEnabled() ? setPermissionStickyFooter : undefined} /> : null;

  // Narrow terminals: companion collapses to a one-liner that REPL stacks
  // on its own row (above input in fullscreen, below in scrollback) instead
  // of row-beside. Wide terminals keep the row layout with sprite on the right.
  const companionNarrow = transcriptCols < MIN_COLS_FOR_FULL_SPRITE;
  // Hide the sprite when PromptInput early-returns BackgroundTasksDialog.
  // The sprite sits as a row sibling of PromptInput, so the dialog's Pane
  // divider draws at useTerminalSize() width but only gets terminalWidth -
  // spriteWidth — divider stops short and dialog text wraps early. Don't
  // check footerSelection: pill FOCUS (arrow-down to tasks pill) must keep
  // the sprite visible so arrow-right can navigate to it.
  const companionVisible = !toolJSX?.shouldHidePromptInput && !focusedInputDialog && !showBashesDialog;

  // In fullscreen, ALL local-jsx slash commands float in the modal slot —
  // FullscreenLayout wraps them in an absolute-positioned bottom-anchored
  // pane (▔ divider, ModalContext). Pane/Dialog inside detect the context
  // and skip their own top-level frame. Non-fullscreen keeps the inline
  // render paths below. Commands that used to route through bottom
  // (immediate: /model, /mcp, /btw, ...) and scrollable (non-immediate:
  // /config, /theme, /diff, ...) both go here now.
  const toolJsxCentered = isFullscreenEnvEnabled() && toolJSX?.isLocalJSXCommand === true;
  const centeredModal: React.ReactNode = toolJsxCentered ? toolJSX!.jsx : null;

  // <AlternateScreen> at the root: everything below is inside its
  // <Box height={rows}>. Handlers/contexts are zero-height so ScrollBox's
  // flexGrow in FullscreenLayout resolves against this Box. The transcript
  // early return above wraps its virtual-scroll branch the same way; only
  // the 30-cap dump branch stays unwrapped for native terminal scrollback.
  const mainReturn = <KeybindingSetup>
      <AnimatedTerminalTitle isAnimating={titleIsAnimating} title={terminalTitle} disabled={titleDisabled} noPrefix={showStatusInTerminalTab} />
      <GlobalKeybindingHandlers {...globalKeybindingProps} />
      {feature('VOICE_MODE') ? <VoiceKeybindingHandler voiceHandleKeyEvent={voice.handleKeyEvent} stripTrailing={voice.stripTrailing} resetAnchor={voice.resetAnchor} isActive={!toolJSX?.isLocalJSXCommand} /> : null}
      <CommandKeybindingHandlers onSubmit={onSubmit} isActive={!toolJSX?.isLocalJSXCommand} />
      {/* ScrollKeybindingHandler must mount before CancelRequestHandler so
          ctrl+c-with-selection copies instead of cancelling the active task.
          Its raw useInput handler only stops propagation when a selection
          exists — without one, ctrl+c falls through to CancelRequestHandler.
          PgUp/PgDn/wheel always scroll the transcript behind the modal —
          the modal's inner ScrollBox is not keyboard-driven. onScroll
          stays suppressed while a modal is showing so scroll doesn't
          stamp divider/pill state. */}
      <ScrollKeybindingHandler scrollRef={scrollRef} isActive={isFullscreenEnvEnabled() && (centeredModal != null || !focusedInputDialog || focusedInputDialog === 'tool-permission')} onScroll={centeredModal || toolPermissionOverlay || viewedAgentTask ? undefined : composedOnScroll} />
      {feature('MESSAGE_ACTIONS') && isFullscreenEnvEnabled() && !disableMessageActions ? <MessageActionsKeybindings handlers={messageActionHandlers} isActive={cursor !== null} /> : null}
      <CancelRequestHandler {...cancelRequestProps} />
      <MCPConnectionManager key={remountKey} dynamicMcpConfig={dynamicMcpConfig} isStrictMcpConfig={strictMcpConfig}>
        <FullscreenLayout scrollRef={scrollRef} overlay={toolPermissionOverlay} bottomFloat={feature('BUDDY') && companionVisible && !companionNarrow ? <CompanionFloatingBubble /> : undefined} modal={centeredModal} modalScrollRef={modalScrollRef} dividerYRef={dividerYRef} hidePill={!!viewedAgentTask} hideSticky={!!viewedTeammateTask} newMessageCount={unseenDivider?.count ?? 0} onPillClick={() => {
        setCursor(null);
        jumpToNew(scrollRef.current);
      }} scrollable={<>
              <TeammateViewHeader />
              <Messages messages={displayedMessages} tools={tools} commands={commands} verbose={verbose} toolJSX={toolJSX} toolUseConfirmQueue={toolUseConfirmQueue} inProgressToolUseIDs={viewedTeammateTask ? viewedTeammateTask.inProgressToolUseIDs ?? new Set() : inProgressToolUseIDs} isMessageSelectorVisible={isMessageSelectorVisible} conversationId={conversationId} screen={screen} streamingToolUses={streamingToolUses} showAllInTranscript={showAllInTranscript} agentDefinitions={agentDefinitions} onOpenRateLimitOptions={handleOpenRateLimitOptions} isLoading={isLoading} streamingText={isLoading && !viewedAgentTask ? visibleStreamingText : null} isBriefOnly={viewedAgentTask ? false : isBriefOnly} unseenDivider={viewedAgentTask ? undefined : unseenDivider} scrollRef={isFullscreenEnvEnabled() ? scrollRef : undefined} trackStickyPrompt={isFullscreenEnvEnabled() ? true : undefined} cursor={cursor} setCursor={setCursor} cursorNavRef={cursorNavRef} />
              <AwsAuthStatusBox />
              {/* Hide the processing placeholder while a modal is showing —
                  it would sit at the last visible transcript row right above
                  the ▔ divider, showing "❯ /config" as redundant clutter
                  (the modal IS the /config UI). Outside modals it stays so
                  the user sees their input echoed while Claude processes. */}
              {!disabled && placeholderText && !centeredModal && <UserTextMessage param={{
          text: placeholderText,
          type: 'text'
        }} addMargin={true} verbose={verbose} />}
              {toolJSX && !(toolJSX.isLocalJSXCommand && toolJSX.isImmediate) && !toolJsxCentered && <Box flexDirection="column" width="100%">
                    {toolJSX.jsx}
                  </Box>}
              {"external" === 'ant' && <TungstenLiveMonitor />}
              {feature('WEB_BROWSER_TOOL') ? WebBrowserPanelModule && <WebBrowserPanelModule.WebBrowserPanel /> : null}
              <Box flexGrow={1} />
              {showSpinner && <SpinnerWithVerb mode={streamMode} spinnerTip={spinnerTip} responseLengthRef={responseLengthRef} apiMetricsRef={apiMetricsRef} overrideMessage={spinnerMessage} spinnerSuffix={stopHookSpinnerSuffix} verbose={verbose} loadingStartTimeRef={loadingStartTimeRef} totalPausedMsRef={totalPausedMsRef} pauseStartTimeRef={pauseStartTimeRef} overrideColor={spinnerColor} overrideShimmerColor={spinnerShimmerColor} hasActiveTools={inProgressToolUseIDs.size > 0} leaderIsIdle={!isLoading} />}
              {!showSpinner && !isLoading && !userInputOnProcessing && !hasRunningTeammates && isBriefOnly && !viewedAgentTask && <BriefIdleStatus />}
              {isFullscreenEnvEnabled() && <PromptInputQueuedCommands />}
            </>} bottom={<Box flexDirection={feature('BUDDY') && companionNarrow ? 'column' : 'row'} width="100%" alignItems={feature('BUDDY') && companionNarrow ? undefined : 'flex-end'}>
              {feature('BUDDY') && companionNarrow && isFullscreenEnvEnabled() && companionVisible ? <CompanionSprite /> : null}
              <Box flexDirection="column" flexGrow={1}>
                {permissionStickyFooter}
                {/* Immediate local-jsx commands (/btw, /sandbox, /assistant,
                  /issue) render here, NOT inside scrollable. They stay mounted
                  while the main conversation streams behind them, so ScrollBox
                  relayouts on each new message would drag them around. bottom
                  is flexShrink={0} outside the ScrollBox — it never moves.
                  Non-immediate local-jsx (/diff, /status, /theme, ~40 others)
                  stays in scrollable: the main loop is paused so no jiggle,
                  and their tall content (DiffDetailView renders up to 400
                  lines with no internal scroll) needs the outer ScrollBox. */}
                {toolJSX?.isLocalJSXCommand && toolJSX.isImmediate && !toolJsxCentered && <Box flexDirection="column" width="100%">
                      {toolJSX.jsx}
                    </Box>}
                {!showSpinner && !toolJSX?.isLocalJSXCommand && showExpandedTodos && tasksV2 && tasksV2.length > 0 && <Box width="100%" flexDirection="column">
                      <TaskListV2 tasks={tasksV2} isStandalone={true} />
                    </Box>}
                {focusedInputDialog === 'sandbox-permission' && <SandboxPermissionRequest key={sandboxPermissionRequestQueue[0]!.hostPattern.host} hostPattern={sandboxPermissionRequestQueue[0]!.hostPattern} onUserResponse={(response: {
            allow: boolean;
            persistToSettings: boolean;
          }) => {
            const {
              allow,
              persistToSettings
            } = response;
            const currentRequest = sandboxPermissionRequestQueue[0];
            if (!currentRequest) return;
            const approvedHost = currentRequest.hostPattern.host;
            if (persistToSettings) {
              const update = {
                type: 'addRules' as const,
                rules: [{
                  toolName: WEB_FETCH_TOOL_NAME,
                  ruleContent: `domain:${approvedHost}`
                }],
                behavior: (allow ? 'allow' : 'deny') as 'allow' | 'deny',
                destination: 'localSettings' as const
              };
              setAppState(prev => ({
                ...prev,
                toolPermissionContext: applyPermissionUpdate(prev.toolPermissionContext, update)
              }));
              persistPermissionUpdate(update);

              // Immediately update sandbox in-memory config to prevent race conditions
              // where pending requests slip through before settings change is detected
              SandboxManager.refreshConfig();
            }

            // Resolve ALL pending requests for the same host (not just the first one)
            // This handles the case where multiple parallel requests came in for the same domain
            setSandboxPermissionRequestQueue(queue => {
              queue.filter(item => item.hostPattern.host === approvedHost).forEach(item => item.resolvePromise(allow));
              return queue.filter(item => item.hostPattern.host !== approvedHost);
            });

            // Clean up bridge subscriptions and cancel remote prompts
            // for this host since the local user already responded.
            const cleanups = sandboxBridgeCleanupRef.current.get(approvedHost);
            if (cleanups) {
              for (const fn of cleanups) {
                fn();
              }
              sandboxBridgeCleanupRef.current.delete(approvedHost);
            }
          }} />}
                {focusedInputDialog === 'prompt' && <PromptDialog key={promptQueue[0]!.request.prompt} title={promptQueue[0]!.title} toolInputSummary={promptQueue[0]!.toolInputSummary} request={promptQueue[0]!.request} onRespond={selectedKey => {
            const item = promptQueue[0];
            if (!item) return;
            item.resolve({
              prompt_response: item.request.prompt,
              selected: selectedKey
            });
            setPromptQueue(([, ...tail]) => tail);
          }} onAbort={() => {
            const item = promptQueue[0];
            if (!item) return;
            item.reject(new Error('Prompt cancelled by user'));
            setPromptQueue(([, ...tail]) => tail);
          }} />}
                {/* Show pending indicator on worker while waiting for leader approval */}
                {pendingWorkerRequest && <WorkerPendingPermission toolName={pendingWorkerRequest.toolName} description={pendingWorkerRequest.description} />}
                {/* Show pending indicator for sandbox permission on worker side */}
                {pendingSandboxRequest && <WorkerPendingPermission toolName="Network Access" description={`Waiting for leader to approve network access to ${pendingSandboxRequest.host}`} />}
                {/* Worker sandbox permission requests from swarm workers */}
                {focusedInputDialog === 'worker-sandbox-permission' && <SandboxPermissionRequest key={workerSandboxPermissions.queue[0]!.requestId} hostPattern={{
            host: workerSandboxPermissions.queue[0]!.host,
            port: undefined
          } as NetworkHostPattern} onUserResponse={(response: {
            allow: boolean;
            persistToSettings: boolean;
          }) => {
            const {
              allow,
              persistToSettings
            } = response;
            const currentRequest = workerSandboxPermissions.queue[0];
            if (!currentRequest) return;
            const approvedHost = currentRequest.host;

            // Send response via mailbox to the worker
            void sendSandboxPermissionResponseViaMailbox(currentRequest.workerName, currentRequest.requestId, approvedHost, allow, teamContext?.teamName);
            if (persistToSettings && allow) {
              const update = {
                type: 'addRules' as const,
                rules: [{
                  toolName: WEB_FETCH_TOOL_NAME,
                  ruleContent: `domain:${approvedHost}`
                }],
                behavior: 'allow' as const,
                destination: 'localSettings' as const
              };
              setAppState(prev => ({
                ...prev,
                toolPermissionContext: applyPermissionUpdate(prev.toolPermissionContext, update)
              }));
              persistPermissionUpdate(update);
              SandboxManager.refreshConfig();
            }

            // Remove from queue
            setAppState(prev => ({
              ...prev,
              workerSandboxPermissions: {
                ...prev.workerSandboxPermissions,
                queue: prev.workerSandboxPermissions.queue.slice(1)
              }
            }));
          }} />}
                {focusedInputDialog === 'elicitation' && <ElicitationDialog key={elicitation.queue[0]!.serverName + ':' + String(elicitation.queue[0]!.requestId)} event={elicitation.queue[0]!} onResponse={(action, content) => {
            const currentRequest = elicitation.queue[0];
            if (!currentRequest) return;
            // Call respond callback to resolve Promise
            currentRequest.respond({
              action,
              content
            });
            // For URL accept, keep in queue for phase 2
            const isUrlAccept = currentRequest.params.mode === 'url' && action === 'accept';
            if (!isUrlAccept) {
              setAppState(prev => ({
                ...prev,
                elicitation: {
                  queue: prev.elicitation.queue.slice(1)
                }
              }));
            }
          }} onWaitingDismiss={action => {
            const currentRequest = elicitation.queue[0];
            // Remove from queue
            setAppState(prev => ({
              ...prev,
              elicitation: {
                queue: prev.elicitation.queue.slice(1)
              }
            }));
            currentRequest?.onWaitingDismiss?.(action);
          }} />}
                {focusedInputDialog === 'cost' && <CostThresholdDialog onDone={() => {
            setShowCostDialog(false);
            setHaveShownCostDialog(true);
            saveGlobalConfig(current => ({
              ...current,
              hasAcknowledgedCostThreshold: true
            }));
            logEvent('tengu_cost_threshold_acknowledged', {});
          }} />}
                {focusedInputDialog === 'idle-return' && idleReturnPending && <IdleReturnDialog idleMinutes={idleReturnPending.idleMinutes} totalInputTokens={getTotalInputTokens()} onDone={async action => {
            const pending = idleReturnPending;
            setIdleReturnPending(null);
            logEvent('tengu_idle_return_action', {
              action: action as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              idleMinutes: Math.round(pending.idleMinutes),
              messageCount: messagesRef.current.length,
              totalInputTokens: getTotalInputTokens()
            });
            if (action === 'dismiss') {
              setInputValue(pending.input);
              return;
            }
            if (action === 'never') {
              saveGlobalConfig(current => {
                if (current.idleReturnDismissed) return current;
                return {
                  ...current,
                  idleReturnDismissed: true
                };
              });
            }
            if (action === 'clear') {
              const {
                clearConversation
              } = await import('../commands/clear/conversation.js');
              await clearConversation({
                setMessages,
                readFileState: readFileState.current,
                discoveredSkillNames: discoveredSkillNamesRef.current,
                loadedNestedMemoryPaths: loadedNestedMemoryPathsRef.current,
                getAppState: () => store.getState(),
                setAppState,
                setConversationId
              });
              haikuTitleAttemptedRef.current = false;
              setHaikuTitle(undefined);
              bashTools.current.clear();
              bashToolsProcessedIdx.current = 0;
            }
            skipIdleCheckRef.current = true;
            void onSubmitRef.current(pending.input, {
              setCursorOffset: () => {},
              clearBuffer: () => {},
              resetHistory: () => {}
            });
          }} />}
                {focusedInputDialog === 'ide-onboarding' && <IdeOnboardingDialog onDone={() => setShowIdeOnboarding(false)} installationStatus={ideInstallationStatus} />}
                {"external" === 'ant' && focusedInputDialog === 'model-switch' && AntModelSwitchCallout && <AntModelSwitchCallout onDone={(selection: string, modelAlias?: string) => {
            setShowModelSwitchCallout(false);
            if (selection === 'switch' && modelAlias) {
              setAppState(prev => ({
                ...prev,
                mainLoopModel: modelAlias,
                mainLoopModelForSession: null
              }));
            }
          }} />}
                {"external" === 'ant' && focusedInputDialog === 'undercover-callout' && UndercoverAutoCallout && <UndercoverAutoCallout onDone={() => setShowUndercoverCallout(false)} />}
                {focusedInputDialog === 'effort-callout' && <EffortCallout model={mainLoopModel} onDone={selection => {
            setShowEffortCallout(false);
            if (selection !== 'dismiss') {
              setAppState(prev => ({
                ...prev,
                effortValue: selection
              }));
            }
          }} />}
                {focusedInputDialog === 'remote-callout' && <RemoteCallout onDone={selection => {
            setAppState(prev => {
              if (!prev.showRemoteCallout) return prev;
              return {
                ...prev,
                showRemoteCallout: false,
                ...(selection === 'enable' && {
                  replBridgeEnabled: true,
                  replBridgeExplicit: true,
                  replBridgeOutboundOnly: false
                })
              };
            });
          }} />}

                {exitFlow}

                {focusedInputDialog === 'plugin-hint' && hintRecommendation && <PluginHintMenu pluginName={hintRecommendation.pluginName} pluginDescription={hintRecommendation.pluginDescription} marketplaceName={hintRecommendation.marketplaceName} sourceCommand={hintRecommendation.sourceCommand} onResponse={handleHintResponse} />}

                {focusedInputDialog === 'lsp-recommendation' && lspRecommendation && <LspRecommendationMenu pluginName={lspRecommendation.pluginName} pluginDescription={lspRecommendation.pluginDescription} fileExtension={lspRecommendation.fileExtension} onResponse={handleLspResponse} />}

                {focusedInputDialog === 'desktop-upsell' && <DesktopUpsellStartup onDone={() => setShowDesktopUpsellStartup(false)} />}

                {feature('ULTRAPLAN') ? focusedInputDialog === 'ultraplan-choice' && ultraplanPendingChoice && <UltraplanChoiceDialog plan={ultraplanPendingChoice.plan} sessionId={ultraplanPendingChoice.sessionId} taskId={ultraplanPendingChoice.taskId} setMessages={setMessages} readFileState={readFileState.current} getAppState={() => store.getState()} setConversationId={setConversationId} /> : null}

                {feature('ULTRAPLAN') ? focusedInputDialog === 'ultraplan-launch' && ultraplanLaunchPending && <UltraplanLaunchDialog onChoice={(choice, opts) => {
            const blurb = ultraplanLaunchPending.blurb;
            setAppState(prev => prev.ultraplanLaunchPending ? {
              ...prev,
              ultraplanLaunchPending: undefined
            } : prev);
            if (choice === 'cancel') return;
            // Command's onDone used display:'skip', so add the
            // echo here — gives immediate feedback before the
            // ~5s teleportToRemote resolves.
            setMessages(prev => [...prev, createCommandInputMessage(formatCommandInputTags('ultraplan', blurb))]);
            const appendStdout = (msg: string) => setMessages(prev => [...prev, createCommandInputMessage(`<${LOCAL_COMMAND_STDOUT_TAG}>${escapeXml(msg)}</${LOCAL_COMMAND_STDOUT_TAG}>`)]);
            // Defer the second message if a query is mid-turn
            // so it lands after the assistant reply, not
            // between the user's prompt and the reply.
            const appendWhenIdle = (msg: string) => {
              if (!queryGuard.isActive) {
                appendStdout(msg);
                return;
              }
              const unsub = queryGuard.subscribe(() => {
                if (queryGuard.isActive) return;
                unsub();
                // Skip if the user stopped ultraplan while we
                // were waiting — avoids a stale "Monitoring
                // <url>" message for a session that's gone.
                if (!store.getState().ultraplanSessionUrl) return;
                appendStdout(msg);
              });
            };
            void launchUltraplan({
              blurb,
              getAppState: () => store.getState(),
              setAppState,
              signal: createAbortController().signal,
              disconnectedBridge: opts?.disconnectedBridge,
              onSessionReady: appendWhenIdle
            }).then(appendStdout).catch(logError);
          }} /> : null}

                {mrRender()}

                {!toolJSX?.shouldHidePromptInput && !focusedInputDialog && !isExiting && !disabled && !cursor && <>
                      {autoRunIssueReason && <AutoRunIssueNotification onRun={handleAutoRunIssue} onCancel={handleCancelAutoRunIssue} reason={getAutoRunIssueReasonText(autoRunIssueReason)} />}
                      {postCompactSurvey.state !== 'closed' ? <FeedbackSurvey state={postCompactSurvey.state} lastResponse={postCompactSurvey.lastResponse} handleSelect={postCompactSurvey.handleSelect} inputValue={inputValue} setInputValue={setInputValue} onRequestFeedback={handleSurveyRequestFeedback} /> : memorySurvey.state !== 'closed' ? <FeedbackSurvey state={memorySurvey.state} lastResponse={memorySurvey.lastResponse} handleSelect={memorySurvey.handleSelect} handleTranscriptSelect={memorySurvey.handleTranscriptSelect} inputValue={inputValue} setInputValue={setInputValue} onRequestFeedback={handleSurveyRequestFeedback} message="How well did Claude use its memory? (optional)" /> : <FeedbackSurvey state={feedbackSurvey.state} lastResponse={feedbackSurvey.lastResponse} handleSelect={feedbackSurvey.handleSelect} handleTranscriptSelect={feedbackSurvey.handleTranscriptSelect} inputValue={inputValue} setInputValue={setInputValue} onRequestFeedback={didAutoRunIssueRef.current ? undefined : handleSurveyRequestFeedback} />}
                      {/* Frustration-triggered transcript sharing prompt */}
                      {frustrationDetection.state !== 'closed' && <FeedbackSurvey state={frustrationDetection.state} lastResponse={null} handleSelect={() => {}} handleTranscriptSelect={frustrationDetection.handleTranscriptSelect} inputValue={inputValue} setInputValue={setInputValue} />}
                      {/* Skill improvement survey - appears when improvements detected (ant-only) */}
                      {"external" === 'ant' && skillImprovementSurvey.suggestion && <SkillImprovementSurvey isOpen={skillImprovementSurvey.isOpen} skillName={skillImprovementSurvey.suggestion.skillName} updates={skillImprovementSurvey.suggestion.updates} handleSelect={skillImprovementSurvey.handleSelect} inputValue={inputValue} setInputValue={setInputValue} />}
                      {showIssueFlagBanner && <IssueFlagBanner />}
                      {}
                      <PromptInput debug={debug} ideSelection={ideSelection} hasSuppressedDialogs={!!hasSuppressedDialogs} isLocalJSXCommandActive={isShowingLocalJSXCommand} getToolUseContext={getToolUseContext} toolPermissionContext={toolPermissionContext} setToolPermissionContext={setToolPermissionContext} apiKeyStatus={apiKeyStatus} commands={commands} agents={agentDefinitions.activeAgents} isLoading={isLoading} onExit={handleExit} verbose={verbose} messages={messages} onAutoUpdaterResult={setAutoUpdaterResult} autoUpdaterResult={autoUpdaterResult} input={inputValue} onInputChange={setInputValue} mode={inputMode} onModeChange={setInputMode} stashedPrompt={stashedPrompt} setStashedPrompt={setStashedPrompt} submitCount={submitCount} onShowMessageSelector={handleShowMessageSelector} onMessageActionsEnter={
            // Works during isLoading — edit cancels first; uuid selection survives appends.
            feature('MESSAGE_ACTIONS') && isFullscreenEnvEnabled() && !disableMessageActions ? enterMessageActions : undefined} mcpClients={mcpClients} pastedContents={pastedContents} setPastedContents={setPastedContents} vimMode={vimMode} setVimMode={setVimMode} showBashesDialog={showBashesDialog} setShowBashesDialog={setShowBashesDialog} onSubmit={onSubmit} onAgentSubmit={onAgentSubmit} isSearchingHistory={isSearchingHistory} setIsSearchingHistory={setIsSearchingHistory} helpOpen={isHelpOpen} setHelpOpen={setIsHelpOpen} insertTextRef={feature('VOICE_MODE') ? insertTextRef : undefined} voiceInterimRange={voice.interimRange} />
                      <SessionBackgroundHint onBackgroundSession={handleBackgroundSession} isLoading={isLoading} />
                    </>}
                {cursor &&
          // inputValue is REPL state; typed text survives the round-trip.
          <MessageActionsBar cursor={cursor} />}
                {focusedInputDialog === 'message-selector' && <MessageSelector messages={messages} preselectedMessage={messageSelectorPreselect} onPreRestore={onCancel} onRestoreCode={async (message: UserMessage) => {
            await fileHistoryRewind((updater: (prev: FileHistoryState) => FileHistoryState) => {
              setAppState(prev => ({
                ...prev,
                fileHistory: updater(prev.fileHistory)
              }));
            }, message.uuid);
          }} onSummarize={async (message: UserMessage, feedback?: string, direction: PartialCompactDirection = 'from') => {
            // Project snipped messages so the compact model
            // doesn't summarize content that was intentionally removed.
            const compactMessages = getMessagesAfterCompactBoundary(messages);
            const messageIndex = compactMessages.indexOf(message);
            if (messageIndex === -1) {
              // Selected a snipped or pre-compact message that the
              // selector still shows (REPL keeps full history for
              // scrollback). Surface why nothing happened instead
              // of silently no-oping.
              setMessages(prev => [...prev, createSystemMessage('That message is no longer in the active context (snipped or pre-compact). Choose a more recent message.', 'warning')]);
              return;
            }
            const newAbortController = createAbortController();
            const context = getToolUseContext(compactMessages, [], newAbortController, mainLoopModel);
            const appState = context.getAppState();
            const defaultSysPrompt = await getSystemPrompt(context.options.tools, context.options.mainLoopModel, Array.from(appState.toolPermissionContext.additionalWorkingDirectories.keys()), context.options.mcpClients);
            const systemPrompt = buildEffectiveSystemPrompt({
              mainThreadAgentDefinition: undefined,
              toolUseContext: context,
              customSystemPrompt: context.options.customSystemPrompt,
              defaultSystemPrompt: defaultSysPrompt,
              appendSystemPrompt: context.options.appendSystemPrompt
            });
            const [userContext, systemContext] = await Promise.all([getUserContext(), getSystemContext()]);
            const result = await partialCompactConversation(compactMessages, messageIndex, context, {
              systemPrompt,
              userContext,
              systemContext,
              toolUseContext: context,
              forkContextMessages: compactMessages
            }, feedback, direction);
            const kept = result.messagesToKeep ?? [];
            const ordered = direction === 'up_to' ? [...result.summaryMessages, ...kept] : [...kept, ...result.summaryMessages];
            const postCompact = [result.boundaryMarker, ...ordered, ...result.attachments, ...result.hookResults];
            // Fullscreen 'from' keeps scrollback; 'up_to' must not
            // (old[0] unchanged + grown array means incremental
            // useLogMessages path, so boundary never persisted).
            // Find by uuid since old is raw REPL history and snipped
            // entries can shift the projected messageIndex.
            if (isFullscreenEnvEnabled() && direction === 'from') {
              setMessages(old => {
                const rawIdx = old.findIndex(m => m.uuid === message.uuid);
                return [...old.slice(0, rawIdx === -1 ? 0 : rawIdx), ...postCompact];
              });
            } else {
              setMessages(postCompact);
            }
            // Partial compact bypasses handleMessageFromStream — clear
            // the context-blocked flag so proactive ticks resume.
            if (feature('PROACTIVE') || feature('KAIROS')) {
              proactiveModule?.setContextBlocked(false);
            }
            setConversationId(randomUUID());
            runPostCompactCleanup(context.options.querySource);
            if (direction === 'from') {
              const r = textForResubmit(message);
              if (r) {
                setInputValue(r.text);
                setInputMode(r.mode);
              }
            }

            // Show notification with ctrl+o hint
            const historyShortcut = getShortcutDisplay('app:toggleTranscript', 'Global', 'ctrl+o');
            addNotification({
              key: 'summarize-ctrl-o-hint',
              text: `Conversation summarized (${historyShortcut} for history)`,
              priority: 'medium',
              timeoutMs: 8000
            });
          }} onRestoreMessage={handleRestoreMessage} onClose={() => {
            setIsMessageSelectorVisible(false);
            setMessageSelectorPreselect(undefined);
          }} />}
                {"external" === 'ant' && <DevBar />}
              </Box>
              {feature('BUDDY') && !(companionNarrow && isFullscreenEnvEnabled()) && companionVisible ? <CompanionSprite /> : null}
            </Box>} />
      </MCPConnectionManager>
    </KeybindingSetup>;
  if (isFullscreenEnvEnabled()) {
    return <AlternateScreen mouseTracking={isMouseTrackingEnabled()}>
        {mainReturn}
      </AlternateScreen>;
  }
  return mainReturn;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwic3Bhd25TeW5jIiwic25hcHNob3RPdXRwdXRUb2tlbnNGb3JUdXJuIiwiZ2V0Q3VycmVudFR1cm5Ub2tlbkJ1ZGdldCIsImdldFR1cm5PdXRwdXRUb2tlbnMiLCJnZXRCdWRnZXRDb250aW51YXRpb25Db3VudCIsImdldFRvdGFsSW5wdXRUb2tlbnMiLCJwYXJzZVRva2VuQnVkZ2V0IiwiY291bnQiLCJkaXJuYW1lIiwiam9pbiIsInRtcGRpciIsImZpZ3VyZXMiLCJ1c2VJbnB1dCIsInVzZVNlYXJjaElucHV0IiwidXNlVGVybWluYWxTaXplIiwidXNlU2VhcmNoSGlnaGxpZ2h0IiwiSnVtcEhhbmRsZSIsInJlbmRlck1lc3NhZ2VzVG9QbGFpblRleHQiLCJvcGVuRmlsZUluRXh0ZXJuYWxFZGl0b3IiLCJ3cml0ZUZpbGUiLCJCb3giLCJUZXh0IiwidXNlU3RkaW4iLCJ1c2VUaGVtZSIsInVzZVRlcm1pbmFsRm9jdXMiLCJ1c2VUZXJtaW5hbFRpdGxlIiwidXNlVGFiU3RhdHVzIiwiVGFiU3RhdHVzS2luZCIsIkNvc3RUaHJlc2hvbGREaWFsb2ciLCJJZGxlUmV0dXJuRGlhbG9nIiwiUmVhY3QiLCJ1c2VFZmZlY3QiLCJ1c2VNZW1vIiwidXNlUmVmIiwidXNlU3RhdGUiLCJ1c2VDYWxsYmFjayIsInVzZURlZmVycmVkVmFsdWUiLCJ1c2VMYXlvdXRFZmZlY3QiLCJSZWZPYmplY3QiLCJ1c2VOb3RpZmljYXRpb25zIiwic2VuZE5vdGlmaWNhdGlvbiIsInN0YXJ0UHJldmVudFNsZWVwIiwic3RvcFByZXZlbnRTbGVlcCIsInVzZVRlcm1pbmFsTm90aWZpY2F0aW9uIiwiaGFzQ3Vyc29yVXBWaWV3cG9ydFlhbmtCdWciLCJjcmVhdGVGaWxlU3RhdGVDYWNoZVdpdGhTaXplTGltaXQiLCJtZXJnZUZpbGVTdGF0ZUNhY2hlcyIsIlJFQURfRklMRV9TVEFURV9DQUNIRV9TSVpFIiwidXBkYXRlTGFzdEludGVyYWN0aW9uVGltZSIsImdldExhc3RJbnRlcmFjdGlvblRpbWUiLCJnZXRPcmlnaW5hbEN3ZCIsImdldFByb2plY3RSb290IiwiZ2V0U2Vzc2lvbklkIiwic3dpdGNoU2Vzc2lvbiIsInNldENvc3RTdGF0ZUZvclJlc3RvcmUiLCJnZXRUdXJuSG9va0R1cmF0aW9uTXMiLCJnZXRUdXJuSG9va0NvdW50IiwicmVzZXRUdXJuSG9va0R1cmF0aW9uIiwiZ2V0VHVyblRvb2xEdXJhdGlvbk1zIiwiZ2V0VHVyblRvb2xDb3VudCIsInJlc2V0VHVyblRvb2xEdXJhdGlvbiIsImdldFR1cm5DbGFzc2lmaWVyRHVyYXRpb25NcyIsImdldFR1cm5DbGFzc2lmaWVyQ291bnQiLCJyZXNldFR1cm5DbGFzc2lmaWVyRHVyYXRpb24iLCJhc1Nlc3Npb25JZCIsImFzQWdlbnRJZCIsImxvZ0ZvckRlYnVnZ2luZyIsIlF1ZXJ5R3VhcmQiLCJpc0VudlRydXRoeSIsImZvcm1hdFRva2VucyIsInRydW5jYXRlVG9XaWR0aCIsImNvbnN1bWVFYXJseUlucHV0Iiwic2V0TWVtYmVyQWN0aXZlIiwiaXNTd2FybVdvcmtlciIsImdlbmVyYXRlU2FuZGJveFJlcXVlc3RJZCIsInNlbmRTYW5kYm94UGVybWlzc2lvblJlcXVlc3RWaWFNYWlsYm94Iiwic2VuZFNhbmRib3hQZXJtaXNzaW9uUmVzcG9uc2VWaWFNYWlsYm94IiwicmVnaXN0ZXJTYW5kYm94UGVybWlzc2lvbkNhbGxiYWNrIiwiZ2V0VGVhbU5hbWUiLCJnZXRBZ2VudE5hbWUiLCJXb3JrZXJQZW5kaW5nUGVybWlzc2lvbiIsImluamVjdFVzZXJNZXNzYWdlVG9UZWFtbWF0ZSIsImdldEFsbEluUHJvY2Vzc1RlYW1tYXRlVGFza3MiLCJpc0xvY2FsQWdlbnRUYXNrIiwicXVldWVQZW5kaW5nTWVzc2FnZSIsImFwcGVuZE1lc3NhZ2VUb0xvY2FsQWdlbnQiLCJMb2NhbEFnZW50VGFza1N0YXRlIiwicmVnaXN0ZXJMZWFkZXJUb29sVXNlQ29uZmlybVF1ZXVlIiwidW5yZWdpc3RlckxlYWRlclRvb2xVc2VDb25maXJtUXVldWUiLCJyZWdpc3RlckxlYWRlclNldFRvb2xQZXJtaXNzaW9uQ29udGV4dCIsInVucmVnaXN0ZXJMZWFkZXJTZXRUb29sUGVybWlzc2lvbkNvbnRleHQiLCJlbmRJbnRlcmFjdGlvblNwYW4iLCJ1c2VMb2dNZXNzYWdlcyIsInVzZVJlcGxCcmlkZ2UiLCJDb21tYW5kIiwiQ29tbWFuZFJlc3VsdERpc3BsYXkiLCJSZXN1bWVFbnRyeXBvaW50IiwiZ2V0Q29tbWFuZE5hbWUiLCJpc0NvbW1hbmRFbmFibGVkIiwiUHJvbXB0SW5wdXRNb2RlIiwiUXVldWVkQ29tbWFuZCIsIlZpbU1vZGUiLCJNZXNzYWdlU2VsZWN0b3IiLCJzZWxlY3RhYmxlVXNlck1lc3NhZ2VzRmlsdGVyIiwibWVzc2FnZXNBZnRlckFyZU9ubHlTeW50aGV0aWMiLCJ1c2VJZGVMb2dnaW5nIiwiUGVybWlzc2lvblJlcXVlc3QiLCJUb29sVXNlQ29uZmlybSIsIkVsaWNpdGF0aW9uRGlhbG9nIiwiUHJvbXB0RGlhbG9nIiwiUHJvbXB0UmVxdWVzdCIsIlByb21wdFJlc3BvbnNlIiwiUHJvbXB0SW5wdXQiLCJQcm9tcHRJbnB1dFF1ZXVlZENvbW1hbmRzIiwidXNlUmVtb3RlU2Vzc2lvbiIsInVzZURpcmVjdENvbm5lY3QiLCJEaXJlY3RDb25uZWN0Q29uZmlnIiwidXNlU1NIU2Vzc2lvbiIsInVzZUFzc2lzdGFudEhpc3RvcnkiLCJTU0hTZXNzaW9uIiwiU2tpbGxJbXByb3ZlbWVudFN1cnZleSIsInVzZVNraWxsSW1wcm92ZW1lbnRTdXJ2ZXkiLCJ1c2VNb3JlUmlnaHQiLCJTcGlubmVyV2l0aFZlcmIiLCJCcmllZklkbGVTdGF0dXMiLCJTcGlubmVyTW9kZSIsImdldFN5c3RlbVByb21wdCIsImJ1aWxkRWZmZWN0aXZlU3lzdGVtUHJvbXB0IiwiZ2V0U3lzdGVtQ29udGV4dCIsImdldFVzZXJDb250ZXh0IiwiZ2V0TWVtb3J5RmlsZXMiLCJzdGFydEJhY2tncm91bmRIb3VzZWtlZXBpbmciLCJnZXRUb3RhbENvc3QiLCJzYXZlQ3VycmVudFNlc3Npb25Db3N0cyIsInJlc2V0Q29zdFN0YXRlIiwiZ2V0U3RvcmVkU2Vzc2lvbkNvc3RzIiwidXNlQ29zdFN1bW1hcnkiLCJ1c2VGcHNNZXRyaWNzIiwidXNlQWZ0ZXJGaXJzdFJlbmRlciIsInVzZURlZmVycmVkSG9va01lc3NhZ2VzIiwiYWRkVG9IaXN0b3J5IiwicmVtb3ZlTGFzdEZyb21IaXN0b3J5IiwiZXhwYW5kUGFzdGVkVGV4dFJlZnMiLCJwYXJzZVJlZmVyZW5jZXMiLCJwcmVwZW5kTW9kZUNoYXJhY3RlclRvSW5wdXQiLCJwcmVwZW5kVG9TaGVsbEhpc3RvcnlDYWNoZSIsInVzZUFwaUtleVZlcmlmaWNhdGlvbiIsIkdsb2JhbEtleWJpbmRpbmdIYW5kbGVycyIsIkNvbW1hbmRLZXliaW5kaW5nSGFuZGxlcnMiLCJLZXliaW5kaW5nU2V0dXAiLCJ1c2VTaG9ydGN1dERpc3BsYXkiLCJnZXRTaG9ydGN1dERpc3BsYXkiLCJDYW5jZWxSZXF1ZXN0SGFuZGxlciIsInVzZUJhY2tncm91bmRUYXNrTmF2aWdhdGlvbiIsInVzZVN3YXJtSW5pdGlhbGl6YXRpb24iLCJ1c2VUZWFtbWF0ZVZpZXdBdXRvRXhpdCIsImVycm9yTWVzc2FnZSIsImlzSHVtYW5UdXJuIiwibG9nRXJyb3IiLCJ1c2VWb2ljZUludGVncmF0aW9uIiwicmVxdWlyZSIsInN0cmlwVHJhaWxpbmciLCJoYW5kbGVLZXlFdmVudCIsInJlc2V0QW5jaG9yIiwiVm9pY2VLZXliaW5kaW5nSGFuZGxlciIsInVzZUZydXN0cmF0aW9uRGV0ZWN0aW9uIiwic3RhdGUiLCJoYW5kbGVUcmFuc2NyaXB0U2VsZWN0IiwidXNlQW50T3JnV2FybmluZ05vdGlmaWNhdGlvbiIsImdldENvb3JkaW5hdG9yVXNlckNvbnRleHQiLCJtY3BDbGllbnRzIiwiUmVhZG9ubHlBcnJheSIsIm5hbWUiLCJzY3JhdGNocGFkRGlyIiwiayIsInVzZUNhblVzZVRvb2wiLCJUb29sUGVybWlzc2lvbkNvbnRleHQiLCJUb29sIiwiYXBwbHlQZXJtaXNzaW9uVXBkYXRlIiwiYXBwbHlQZXJtaXNzaW9uVXBkYXRlcyIsInBlcnNpc3RQZXJtaXNzaW9uVXBkYXRlIiwiYnVpbGRQZXJtaXNzaW9uVXBkYXRlcyIsInN0cmlwRGFuZ2Vyb3VzUGVybWlzc2lvbnNGb3JBdXRvTW9kZSIsImdldFNjcmF0Y2hwYWREaXIiLCJpc1NjcmF0Y2hwYWRFbmFibGVkIiwiV0VCX0ZFVENIX1RPT0xfTkFNRSIsIlNMRUVQX1RPT0xfTkFNRSIsImNsZWFyU3BlY3VsYXRpdmVDaGVja3MiLCJBdXRvVXBkYXRlclJlc3VsdCIsImdldEdsb2JhbENvbmZpZyIsInNhdmVHbG9iYWxDb25maWciLCJnZXRHbG9iYWxDb25maWdXcml0ZUNvdW50IiwiaGFzQ29uc29sZUJpbGxpbmdBY2Nlc3MiLCJsb2dFdmVudCIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSIsInRleHRGb3JSZXN1Ym1pdCIsImhhbmRsZU1lc3NhZ2VGcm9tU3RyZWFtIiwiU3RyZWFtaW5nVG9vbFVzZSIsIlN0cmVhbWluZ1RoaW5raW5nIiwiaXNDb21wYWN0Qm91bmRhcnlNZXNzYWdlIiwiZ2V0TWVzc2FnZXNBZnRlckNvbXBhY3RCb3VuZGFyeSIsImdldENvbnRlbnRUZXh0IiwiY3JlYXRlVXNlck1lc3NhZ2UiLCJjcmVhdGVBc3Npc3RhbnRNZXNzYWdlIiwiY3JlYXRlVHVybkR1cmF0aW9uTWVzc2FnZSIsImNyZWF0ZUFnZW50c0tpbGxlZE1lc3NhZ2UiLCJjcmVhdGVBcGlNZXRyaWNzTWVzc2FnZSIsImNyZWF0ZVN5c3RlbU1lc3NhZ2UiLCJjcmVhdGVDb21tYW5kSW5wdXRNZXNzYWdlIiwiZm9ybWF0Q29tbWFuZElucHV0VGFncyIsImdlbmVyYXRlU2Vzc2lvblRpdGxlIiwiQkFTSF9JTlBVVF9UQUciLCJDT01NQU5EX01FU1NBR0VfVEFHIiwiQ09NTUFORF9OQU1FX1RBRyIsIkxPQ0FMX0NPTU1BTkRfU1RET1VUX1RBRyIsImVzY2FwZVhtbCIsIlRoaW5raW5nQ29uZmlnIiwiZ3JhY2VmdWxTaHV0ZG93blN5bmMiLCJoYW5kbGVQcm9tcHRTdWJtaXQiLCJQcm9tcHRJbnB1dEhlbHBlcnMiLCJ1c2VRdWV1ZVByb2Nlc3NvciIsInVzZU1haWxib3hCcmlkZ2UiLCJxdWVyeUNoZWNrcG9pbnQiLCJsb2dRdWVyeVByb2ZpbGVSZXBvcnQiLCJNZXNzYWdlIiwiTWVzc2FnZVR5cGUiLCJVc2VyTWVzc2FnZSIsIlByb2dyZXNzTWVzc2FnZSIsIkhvb2tSZXN1bHRNZXNzYWdlIiwiUGFydGlhbENvbXBhY3REaXJlY3Rpb24iLCJxdWVyeSIsIm1lcmdlQ2xpZW50cyIsInVzZU1lcmdlZENsaWVudHMiLCJnZXRRdWVyeVNvdXJjZUZvclJFUEwiLCJ1c2VNZXJnZWRUb29scyIsIm1lcmdlQW5kRmlsdGVyVG9vbHMiLCJ1c2VNZXJnZWRDb21tYW5kcyIsInVzZVNraWxsc0NoYW5nZSIsInVzZU1hbmFnZVBsdWdpbnMiLCJNZXNzYWdlcyIsIlRhc2tMaXN0VjIiLCJUZWFtbWF0ZVZpZXdIZWFkZXIiLCJ1c2VUYXNrc1YyV2l0aENvbGxhcHNlRWZmZWN0IiwibWF5YmVNYXJrUHJvamVjdE9uYm9hcmRpbmdDb21wbGV0ZSIsIk1DUFNlcnZlckNvbm5lY3Rpb24iLCJTY29wZWRNY3BTZXJ2ZXJDb25maWciLCJyYW5kb21VVUlEIiwiVVVJRCIsInByb2Nlc3NTZXNzaW9uU3RhcnRIb29rcyIsImV4ZWN1dGVTZXNzaW9uRW5kSG9va3MiLCJnZXRTZXNzaW9uRW5kSG9va1RpbWVvdXRNcyIsIklERVNlbGVjdGlvbiIsInVzZUlkZVNlbGVjdGlvbiIsImdldFRvb2xzIiwiYXNzZW1ibGVUb29sUG9vbCIsIkFnZW50RGVmaW5pdGlvbiIsInJlc29sdmVBZ2VudFRvb2xzIiwicmVzdW1lQWdlbnRCYWNrZ3JvdW5kIiwidXNlTWFpbkxvb3BNb2RlbCIsInVzZUFwcFN0YXRlIiwidXNlU2V0QXBwU3RhdGUiLCJ1c2VBcHBTdGF0ZVN0b3JlIiwiQ29udGVudEJsb2NrUGFyYW0iLCJJbWFnZUJsb2NrUGFyYW0iLCJQcm9jZXNzVXNlcklucHV0Q29udGV4dCIsIlBhc3RlZENvbnRlbnQiLCJjb3B5UGxhbkZvckZvcmsiLCJjb3B5UGxhbkZvclJlc3VtZSIsImdldFBsYW5TbHVnIiwic2V0UGxhblNsdWciLCJjbGVhclNlc3Npb25NZXRhZGF0YSIsInJlc2V0U2Vzc2lvbkZpbGVQb2ludGVyIiwiYWRvcHRSZXN1bWVkU2Vzc2lvbkZpbGUiLCJyZW1vdmVUcmFuc2NyaXB0TWVzc2FnZSIsInJlc3RvcmVTZXNzaW9uTWV0YWRhdGEiLCJnZXRDdXJyZW50U2Vzc2lvblRpdGxlIiwiaXNFcGhlbWVyYWxUb29sUHJvZ3Jlc3MiLCJpc0xvZ2dhYmxlTWVzc2FnZSIsInNhdmVXb3JrdHJlZVN0YXRlIiwiZ2V0QWdlbnRUcmFuc2NyaXB0IiwiZGVzZXJpYWxpemVNZXNzYWdlcyIsImV4dHJhY3RSZWFkRmlsZXNGcm9tTWVzc2FnZXMiLCJleHRyYWN0QmFzaFRvb2xzRnJvbU1lc3NhZ2VzIiwicmVzZXRNaWNyb2NvbXBhY3RTdGF0ZSIsInJ1blBvc3RDb21wYWN0Q2xlYW51cCIsInByb3Zpc2lvbkNvbnRlbnRSZXBsYWNlbWVudFN0YXRlIiwicmVjb25zdHJ1Y3RDb250ZW50UmVwbGFjZW1lbnRTdGF0ZSIsIkNvbnRlbnRSZXBsYWNlbWVudFJlY29yZCIsInBhcnRpYWxDb21wYWN0Q29udmVyc2F0aW9uIiwiTG9nT3B0aW9uIiwiQWdlbnRDb2xvck5hbWUiLCJmaWxlSGlzdG9yeU1ha2VTbmFwc2hvdCIsIkZpbGVIaXN0b3J5U3RhdGUiLCJmaWxlSGlzdG9yeVJld2luZCIsIkZpbGVIaXN0b3J5U25hcHNob3QiLCJjb3B5RmlsZUhpc3RvcnlGb3JSZXN1bWUiLCJmaWxlSGlzdG9yeUVuYWJsZWQiLCJmaWxlSGlzdG9yeUhhc0FueUNoYW5nZXMiLCJBdHRyaWJ1dGlvblN0YXRlIiwiaW5jcmVtZW50UHJvbXB0Q291bnQiLCJyZWNvcmRBdHRyaWJ1dGlvblNuYXBzaG90IiwiY29tcHV0ZVN0YW5kYWxvbmVBZ2VudENvbnRleHQiLCJyZXN0b3JlQWdlbnRGcm9tU2Vzc2lvbiIsInJlc3RvcmVTZXNzaW9uU3RhdGVGcm9tTG9nIiwicmVzdG9yZVdvcmt0cmVlRm9yUmVzdW1lIiwiZXhpdFJlc3RvcmVkV29ya3RyZWUiLCJpc0JnU2Vzc2lvbiIsInVwZGF0ZVNlc3Npb25OYW1lIiwidXBkYXRlU2Vzc2lvbkFjdGl2aXR5IiwiaXNJblByb2Nlc3NUZWFtbWF0ZVRhc2siLCJJblByb2Nlc3NUZWFtbWF0ZVRhc2tTdGF0ZSIsInJlc3RvcmVSZW1vdGVBZ2VudFRhc2tzIiwidXNlSW5ib3hQb2xsZXIiLCJwcm9hY3RpdmVNb2R1bGUiLCJQUk9BQ1RJVkVfTk9fT1BfU1VCU0NSSUJFIiwiX2NiIiwiUFJPQUNUSVZFX0ZBTFNFIiwiU1VHR0VTVF9CR19QUl9OT09QIiwiX3AiLCJfbiIsInVzZVByb2FjdGl2ZSIsInVzZVNjaGVkdWxlZFRhc2tzIiwiaXNBZ2VudFN3YXJtc0VuYWJsZWQiLCJ1c2VUYXNrTGlzdFdhdGNoZXIiLCJTYW5kYm94QXNrQ2FsbGJhY2siLCJOZXR3b3JrSG9zdFBhdHRlcm4iLCJJREVFeHRlbnNpb25JbnN0YWxsYXRpb25TdGF0dXMiLCJjbG9zZU9wZW5EaWZmcyIsImdldENvbm5lY3RlZElkZUNsaWVudCIsIklkZVR5cGUiLCJ1c2VJREVJbnRlZ3JhdGlvbiIsImV4aXQiLCJFeGl0RmxvdyIsImdldEN1cnJlbnRXb3JrdHJlZVNlc3Npb24iLCJwb3BBbGxFZGl0YWJsZSIsImVucXVldWUiLCJTZXRBcHBTdGF0ZSIsImdldENvbW1hbmRRdWV1ZSIsImdldENvbW1hbmRRdWV1ZUxlbmd0aCIsInJlbW92ZUJ5RmlsdGVyIiwidXNlQ29tbWFuZFF1ZXVlIiwiU2Vzc2lvbkJhY2tncm91bmRIaW50Iiwic3RhcnRCYWNrZ3JvdW5kU2Vzc2lvbiIsInVzZVNlc3Npb25CYWNrZ3JvdW5kaW5nIiwiZGlhZ25vc3RpY1RyYWNrZXIiLCJoYW5kbGVTcGVjdWxhdGlvbkFjY2VwdCIsIkFjdGl2ZVNwZWN1bGF0aW9uU3RhdGUiLCJJZGVPbmJvYXJkaW5nRGlhbG9nIiwiRWZmb3J0Q2FsbG91dCIsInNob3VsZFNob3dFZmZvcnRDYWxsb3V0IiwiRWZmb3J0VmFsdWUiLCJSZW1vdGVDYWxsb3V0IiwiQW50TW9kZWxTd2l0Y2hDYWxsb3V0Iiwic2hvdWxkU2hvd0FudE1vZGVsU3dpdGNoIiwic2hvdWxkU2hvd01vZGVsU3dpdGNoQ2FsbG91dCIsIlVuZGVyY292ZXJBdXRvQ2FsbG91dCIsImFjdGl2aXR5TWFuYWdlciIsImNyZWF0ZUFib3J0Q29udHJvbGxlciIsIk1DUENvbm5lY3Rpb25NYW5hZ2VyIiwidXNlRmVlZGJhY2tTdXJ2ZXkiLCJ1c2VNZW1vcnlTdXJ2ZXkiLCJ1c2VQb3N0Q29tcGFjdFN1cnZleSIsIkZlZWRiYWNrU3VydmV5IiwidXNlSW5zdGFsbE1lc3NhZ2VzIiwidXNlQXdheVN1bW1hcnkiLCJ1c2VDaHJvbWVFeHRlbnNpb25Ob3RpZmljYXRpb24iLCJ1c2VPZmZpY2lhbE1hcmtldHBsYWNlTm90aWZpY2F0aW9uIiwidXNlUHJvbXB0c0Zyb21DbGF1ZGVJbkNocm9tZSIsImdldFRpcFRvU2hvd09uU3Bpbm5lciIsInJlY29yZFNob3duVGlwIiwiVGhlbWUiLCJjaGVja0FuZERpc2FibGVCeXBhc3NQZXJtaXNzaW9uc0lmTmVlZGVkIiwiY2hlY2tBbmREaXNhYmxlQXV0b01vZGVJZk5lZWRlZCIsInVzZUtpY2tPZmZDaGVja0FuZERpc2FibGVCeXBhc3NQZXJtaXNzaW9uc0lmTmVlZGVkIiwidXNlS2lja09mZkNoZWNrQW5kRGlzYWJsZUF1dG9Nb2RlSWZOZWVkZWQiLCJTYW5kYm94TWFuYWdlciIsIlNBTkRCT1hfTkVUV09SS19BQ0NFU1NfVE9PTF9OQU1FIiwidXNlRmlsZUhpc3RvcnlTbmFwc2hvdEluaXQiLCJTYW5kYm94UGVybWlzc2lvblJlcXVlc3QiLCJTYW5kYm94VmlvbGF0aW9uRXhwYW5kZWRWaWV3IiwidXNlU2V0dGluZ3NFcnJvcnMiLCJ1c2VNY3BDb25uZWN0aXZpdHlTdGF0dXMiLCJ1c2VBdXRvTW9kZVVuYXZhaWxhYmxlTm90aWZpY2F0aW9uIiwiQVVUT19NT0RFX0RFU0NSSVBUSU9OIiwidXNlTHNwSW5pdGlhbGl6YXRpb25Ob3RpZmljYXRpb24iLCJ1c2VMc3BQbHVnaW5SZWNvbW1lbmRhdGlvbiIsIkxzcFJlY29tbWVuZGF0aW9uTWVudSIsInVzZUNsYXVkZUNvZGVIaW50UmVjb21tZW5kYXRpb24iLCJQbHVnaW5IaW50TWVudSIsIkRlc2t0b3BVcHNlbGxTdGFydHVwIiwic2hvdWxkU2hvd0Rlc2t0b3BVcHNlbGxTdGFydHVwIiwidXNlUGx1Z2luSW5zdGFsbGF0aW9uU3RhdHVzIiwidXNlUGx1Z2luQXV0b3VwZGF0ZU5vdGlmaWNhdGlvbiIsInBlcmZvcm1TdGFydHVwQ2hlY2tzIiwiVXNlclRleHRNZXNzYWdlIiwiQXdzQXV0aFN0YXR1c0JveCIsInVzZVJhdGVMaW1pdFdhcm5pbmdOb3RpZmljYXRpb24iLCJ1c2VEZXByZWNhdGlvbldhcm5pbmdOb3RpZmljYXRpb24iLCJ1c2VOcG1EZXByZWNhdGlvbk5vdGlmaWNhdGlvbiIsInVzZUlERVN0YXR1c0luZGljYXRvciIsInVzZU1vZGVsTWlncmF0aW9uTm90aWZpY2F0aW9ucyIsInVzZUNhblN3aXRjaFRvRXhpc3RpbmdTdWJzY3JpcHRpb24iLCJ1c2VUZWFtbWF0ZUxpZmVjeWNsZU5vdGlmaWNhdGlvbiIsInVzZUZhc3RNb2RlTm90aWZpY2F0aW9uIiwiQXV0b1J1bklzc3VlTm90aWZpY2F0aW9uIiwic2hvdWxkQXV0b1J1bklzc3VlIiwiZ2V0QXV0b1J1bklzc3VlUmVhc29uVGV4dCIsImdldEF1dG9SdW5Db21tYW5kIiwiQXV0b1J1bklzc3VlUmVhc29uIiwiSG9va1Byb2dyZXNzIiwiVHVuZ3N0ZW5MaXZlTW9uaXRvciIsIldlYkJyb3dzZXJQYW5lbE1vZHVsZSIsIklzc3VlRmxhZ0Jhbm5lciIsInVzZUlzc3VlRmxhZ0Jhbm5lciIsIkNvbXBhbmlvblNwcml0ZSIsIkNvbXBhbmlvbkZsb2F0aW5nQnViYmxlIiwiTUlOX0NPTFNfRk9SX0ZVTExfU1BSSVRFIiwiRGV2QmFyIiwiUmVtb3RlU2Vzc2lvbkNvbmZpZyIsIlJFTU9URV9TQUZFX0NPTU1BTkRTIiwiUmVtb3RlTWVzc2FnZUNvbnRlbnQiLCJGdWxsc2NyZWVuTGF5b3V0IiwidXNlVW5zZWVuRGl2aWRlciIsImNvbXB1dGVVbnNlZW5EaXZpZGVyIiwiaXNGdWxsc2NyZWVuRW52RW5hYmxlZCIsIm1heWJlR2V0VG11eE1vdXNlSGludCIsImlzTW91c2VUcmFja2luZ0VuYWJsZWQiLCJBbHRlcm5hdGVTY3JlZW4iLCJTY3JvbGxLZXliaW5kaW5nSGFuZGxlciIsInVzZU1lc3NhZ2VBY3Rpb25zIiwiTWVzc2FnZUFjdGlvbnNLZXliaW5kaW5ncyIsIk1lc3NhZ2VBY3Rpb25zQmFyIiwiTWVzc2FnZUFjdGlvbnNTdGF0ZSIsIk1lc3NhZ2VBY3Rpb25zTmF2IiwiTWVzc2FnZUFjdGlvbkNhcHMiLCJzZXRDbGlwYm9hcmQiLCJTY3JvbGxCb3hIYW5kbGUiLCJjcmVhdGVBdHRhY2htZW50TWVzc2FnZSIsImdldFF1ZXVlZENvbW1hbmRBdHRhY2htZW50cyIsIkVNUFRZX01DUF9DTElFTlRTIiwiSElTVE9SWV9TVFVCIiwibWF5YmVMb2FkT2xkZXIiLCJfIiwiUkVDRU5UX1NDUk9MTF9SRVBJTl9XSU5ET1dfTVMiLCJtZWRpYW4iLCJ2YWx1ZXMiLCJzb3J0ZWQiLCJzb3J0IiwiYSIsImIiLCJtaWQiLCJNYXRoIiwiZmxvb3IiLCJsZW5ndGgiLCJyb3VuZCIsIlRyYW5zY3JpcHRNb2RlRm9vdGVyIiwidDAiLCIkIiwiX2MiLCJzaG93QWxsSW5UcmFuc2NyaXB0IiwidmlydHVhbFNjcm9sbCIsInNlYXJjaEJhZGdlIiwic3VwcHJlc3NTaG93QWxsIiwidDEiLCJzdGF0dXMiLCJ1bmRlZmluZWQiLCJ0b2dnbGVTaG9ydGN1dCIsInNob3dBbGxTaG9ydGN1dCIsInQyIiwiYXJyb3dVcCIsImFycm93RG93biIsInQzIiwidDQiLCJjdXJyZW50IiwidDUiLCJUcmFuc2NyaXB0U2VhcmNoQmFyIiwianVtcFJlZiIsIm9uQ2xvc2UiLCJvbkNhbmNlbCIsInNldEhpZ2hsaWdodCIsImluaXRpYWxRdWVyeSIsImxhc3RRdWVyeSIsIlJlYWN0Tm9kZSIsImN1cnNvck9mZnNldCIsImlzQWN0aXZlIiwib25FeGl0IiwiaW5kZXhTdGF0dXMiLCJzZXRJbmRleFN0YXR1cyIsIm1zIiwiYWxpdmUiLCJ3YXJtIiwid2FybVNlYXJjaEluZGV4IiwidGhlbiIsInNldFRpbWVvdXQiLCJ3YXJtRG9uZSIsInNldFNlYXJjaFF1ZXJ5Iiwib2ZmIiwiY3Vyc29yQ2hhciIsInNsaWNlIiwiVElUTEVfQU5JTUFUSU9OX0ZSQU1FUyIsIlRJVExFX1NUQVRJQ19QUkVGSVgiLCJUSVRMRV9BTklNQVRJT05fSU5URVJWQUxfTVMiLCJBbmltYXRlZFRlcm1pbmFsVGl0bGUiLCJpc0FuaW1hdGluZyIsInRpdGxlIiwiZGlzYWJsZWQiLCJub1ByZWZpeCIsInRlcm1pbmFsRm9jdXNlZCIsImZyYW1lIiwic2V0RnJhbWUiLCJpbnRlcnZhbCIsInNldEludGVydmFsIiwiX3RlbXAyIiwiY2xlYXJJbnRlcnZhbCIsInByZWZpeCIsInNldEZyYW1lXzAiLCJfdGVtcCIsImYiLCJQcm9wcyIsImNvbW1hbmRzIiwiZGVidWciLCJpbml0aWFsVG9vbHMiLCJpbml0aWFsTWVzc2FnZXMiLCJwZW5kaW5nSG9va01lc3NhZ2VzIiwiUHJvbWlzZSIsImluaXRpYWxGaWxlSGlzdG9yeVNuYXBzaG90cyIsImluaXRpYWxDb250ZW50UmVwbGFjZW1lbnRzIiwiaW5pdGlhbEFnZW50TmFtZSIsImluaXRpYWxBZ2VudENvbG9yIiwiZHluYW1pY01jcENvbmZpZyIsIlJlY29yZCIsImF1dG9Db25uZWN0SWRlRmxhZyIsInN0cmljdE1jcENvbmZpZyIsInN5c3RlbVByb21wdCIsImFwcGVuZFN5c3RlbVByb21wdCIsIm9uQmVmb3JlUXVlcnkiLCJpbnB1dCIsIm5ld01lc3NhZ2VzIiwib25UdXJuQ29tcGxldGUiLCJtZXNzYWdlcyIsIm1haW5UaHJlYWRBZ2VudERlZmluaXRpb24iLCJkaXNhYmxlU2xhc2hDb21tYW5kcyIsInRhc2tMaXN0SWQiLCJyZW1vdGVTZXNzaW9uQ29uZmlnIiwiZGlyZWN0Q29ubmVjdENvbmZpZyIsInNzaFNlc3Npb24iLCJ0aGlua2luZ0NvbmZpZyIsIlNjcmVlbiIsIlJFUEwiLCJpbml0aWFsQ29tbWFuZHMiLCJpbml0aWFsTWNwQ2xpZW50cyIsImluaXRpYWxEeW5hbWljTWNwQ29uZmlnIiwiY3VzdG9tU3lzdGVtUHJvbXB0IiwiaW5pdGlhbE1haW5UaHJlYWRBZ2VudERlZmluaXRpb24iLCJpc1JlbW90ZVNlc3Npb24iLCJ0aXRsZURpc2FibGVkIiwicHJvY2VzcyIsImVudiIsIkNMQVVERV9DT0RFX0RJU0FCTEVfVEVSTUlOQUxfVElUTEUiLCJtb3JlUmlnaHRFbmFibGVkIiwiQ0xBVURFX01PUkVSSUdIVCIsImRpc2FibGVWaXJ0dWFsU2Nyb2xsIiwiQ0xBVURFX0NPREVfRElTQUJMRV9WSVJUVUFMX1NDUk9MTCIsImRpc2FibGVNZXNzYWdlQWN0aW9ucyIsIkNMQVVERV9DT0RFX0RJU0FCTEVfTUVTU0FHRV9BQ1RJT05TIiwic2V0TWFpblRocmVhZEFnZW50RGVmaW5pdGlvbiIsInRvb2xQZXJtaXNzaW9uQ29udGV4dCIsInMiLCJ2ZXJib3NlIiwibWNwIiwicGx1Z2lucyIsImFnZW50RGVmaW5pdGlvbnMiLCJmaWxlSGlzdG9yeSIsImluaXRpYWxNZXNzYWdlIiwicXVldWVkQ29tbWFuZHMiLCJzcGlubmVyVGlwIiwic2hvd0V4cGFuZGVkVG9kb3MiLCJleHBhbmRlZFZpZXciLCJwZW5kaW5nV29ya2VyUmVxdWVzdCIsInBlbmRpbmdTYW5kYm94UmVxdWVzdCIsInRlYW1Db250ZXh0IiwidGFza3MiLCJ3b3JrZXJTYW5kYm94UGVybWlzc2lvbnMiLCJlbGljaXRhdGlvbiIsInVsdHJhcGxhblBlbmRpbmdDaG9pY2UiLCJ1bHRyYXBsYW5MYXVuY2hQZW5kaW5nIiwidmlld2luZ0FnZW50VGFza0lkIiwic2V0QXBwU3RhdGUiLCJ2aWV3ZWRMb2NhbEFnZW50IiwibmVlZHNCb290c3RyYXAiLCJyZXRhaW4iLCJkaXNrTG9hZGVkIiwidGFza0lkIiwicmVzdWx0IiwicHJldiIsInQiLCJsaXZlIiwibGl2ZVV1aWRzIiwiU2V0IiwibWFwIiwibSIsInV1aWQiLCJkaXNrT25seSIsImZpbHRlciIsImhhcyIsInN0b3JlIiwidGVybWluYWwiLCJtYWluTG9vcE1vZGVsIiwibG9jYWxDb21tYW5kcyIsInNldExvY2FsQ29tbWFuZHMiLCJwcm9hY3RpdmVBY3RpdmUiLCJ1c2VTeW5jRXh0ZXJuYWxTdG9yZSIsInN1YnNjcmliZVRvUHJvYWN0aXZlQ2hhbmdlcyIsImlzUHJvYWN0aXZlQWN0aXZlIiwiaXNCcmllZk9ubHkiLCJsb2NhbFRvb2xzIiwic2V0RHluYW1pY01jcENvbmZpZyIsIm9uQ2hhbmdlRHluYW1pY01jcENvbmZpZyIsImNvbmZpZyIsInNjcmVlbiIsInNldFNjcmVlbiIsInNldFNob3dBbGxJblRyYW5zY3JpcHQiLCJkdW1wTW9kZSIsInNldER1bXBNb2RlIiwiZWRpdG9yU3RhdHVzIiwic2V0RWRpdG9yU3RhdHVzIiwiZWRpdG9yR2VuUmVmIiwiZWRpdG9yVGltZXJSZWYiLCJSZXR1cm5UeXBlIiwiZWRpdG9yUmVuZGVyaW5nUmVmIiwiYWRkTm90aWZpY2F0aW9uIiwicmVtb3ZlTm90aWZpY2F0aW9uIiwidHJ5U3VnZ2VzdEJnUFJJbnRlcmNlcHQiLCJjbGllbnRzIiwiaWRlU2VsZWN0aW9uIiwic2V0SURFU2VsZWN0aW9uIiwiaWRlVG9JbnN0YWxsRXh0ZW5zaW9uIiwic2V0SURFVG9JbnN0YWxsRXh0ZW5zaW9uIiwiaWRlSW5zdGFsbGF0aW9uU3RhdHVzIiwic2V0SURFSW5zdGFsbGF0aW9uU3RhdHVzIiwic2hvd0lkZU9uYm9hcmRpbmciLCJzZXRTaG93SWRlT25ib2FyZGluZyIsInNob3dNb2RlbFN3aXRjaENhbGxvdXQiLCJzZXRTaG93TW9kZWxTd2l0Y2hDYWxsb3V0Iiwic2hvd0VmZm9ydENhbGxvdXQiLCJzZXRTaG93RWZmb3J0Q2FsbG91dCIsInNob3dSZW1vdGVDYWxsb3V0Iiwic2hvd0Rlc2t0b3BVcHNlbGxTdGFydHVwIiwic2V0U2hvd0Rlc2t0b3BVcHNlbGxTdGFydHVwIiwicmVjb21tZW5kYXRpb24iLCJsc3BSZWNvbW1lbmRhdGlvbiIsImhhbmRsZVJlc3BvbnNlIiwiaGFuZGxlTHNwUmVzcG9uc2UiLCJoaW50UmVjb21tZW5kYXRpb24iLCJoYW5kbGVIaW50UmVzcG9uc2UiLCJjb21iaW5lZEluaXRpYWxUb29scyIsImVuYWJsZWQiLCJ0YXNrc1YyIiwibW9kZSIsIm1lcmdlZFRvb2xzIiwidG9vbHMiLCJhbGxvd2VkQWdlbnRUeXBlcyIsInJlc29sdmVkIiwicmVzb2x2ZWRUb29scyIsImNvbW1hbmRzV2l0aFBsdWdpbnMiLCJtZXJnZWRDb21tYW5kcyIsInN0cmVhbU1vZGUiLCJzZXRTdHJlYW1Nb2RlIiwic3RyZWFtTW9kZVJlZiIsInN0cmVhbWluZ1Rvb2xVc2VzIiwic2V0U3RyZWFtaW5nVG9vbFVzZXMiLCJzdHJlYW1pbmdUaGlua2luZyIsInNldFN0cmVhbWluZ1RoaW5raW5nIiwiaXNTdHJlYW1pbmciLCJzdHJlYW1pbmdFbmRlZEF0IiwiZWxhcHNlZCIsIkRhdGUiLCJub3ciLCJyZW1haW5pbmciLCJ0aW1lciIsImNsZWFyVGltZW91dCIsImFib3J0Q29udHJvbGxlciIsInNldEFib3J0Q29udHJvbGxlciIsIkFib3J0Q29udHJvbGxlciIsImFib3J0Q29udHJvbGxlclJlZiIsInNlbmRCcmlkZ2VSZXN1bHRSZWYiLCJyZXN0b3JlTWVzc2FnZVN5bmNSZWYiLCJzY3JvbGxSZWYiLCJtb2RhbFNjcm9sbFJlZiIsImxhc3RVc2VyU2Nyb2xsVHNSZWYiLCJxdWVyeUd1YXJkIiwiaXNRdWVyeUFjdGl2ZSIsInN1YnNjcmliZSIsImdldFNuYXBzaG90IiwiaXNFeHRlcm5hbExvYWRpbmciLCJzZXRJc0V4dGVybmFsTG9hZGluZ1JhdyIsImhhc0luaXRpYWxQcm9tcHQiLCJpc0xvYWRpbmciLCJ1c2VySW5wdXRPblByb2Nlc3NpbmciLCJzZXRVc2VySW5wdXRPblByb2Nlc3NpbmdSYXciLCJ1c2VySW5wdXRCYXNlbGluZVJlZiIsInVzZXJNZXNzYWdlUGVuZGluZ1JlZiIsImxvYWRpbmdTdGFydFRpbWVSZWYiLCJ0b3RhbFBhdXNlZE1zUmVmIiwicGF1c2VTdGFydFRpbWVSZWYiLCJyZXNldFRpbWluZ1JlZnMiLCJ3YXNRdWVyeUFjdGl2ZVJlZiIsInNldElzRXh0ZXJuYWxMb2FkaW5nIiwidmFsdWUiLCJzd2FybVN0YXJ0VGltZVJlZiIsInN3YXJtQnVkZ2V0SW5mb1JlZiIsInRva2VucyIsImxpbWl0IiwibnVkZ2VzIiwiZm9jdXNlZElucHV0RGlhbG9nUmVmIiwiZ2V0Rm9jdXNlZElucHV0RGlhbG9nIiwiUFJPTVBUX1NVUFBSRVNTSU9OX01TIiwiaXNQcm9tcHRJbnB1dEFjdGl2ZSIsInNldElzUHJvbXB0SW5wdXRBY3RpdmUiLCJhdXRvVXBkYXRlclJlc3VsdCIsInNldEF1dG9VcGRhdGVyUmVzdWx0Iiwibm90aWZpY2F0aW9ucyIsImZvckVhY2giLCJub3RpZmljYXRpb24iLCJrZXkiLCJ0ZXh0IiwicHJpb3JpdHkiLCJoaW50Iiwic2hvd1VuZGVyY292ZXJDYWxsb3V0Iiwic2V0U2hvd1VuZGVyY292ZXJDYWxsb3V0IiwiaXNJbnRlcm5hbE1vZGVsUmVwbyIsInNob3VsZFNob3dVbmRlcmNvdmVyQXV0b05vdGljZSIsInRvb2xKU1giLCJzZXRUb29sSlNYSW50ZXJuYWwiLCJqc3giLCJzaG91bGRIaWRlUHJvbXB0SW5wdXQiLCJzaG91bGRDb250aW51ZUFuaW1hdGlvbiIsInNob3dTcGlubmVyIiwiaXNMb2NhbEpTWENvbW1hbmQiLCJpc0ltbWVkaWF0ZSIsImxvY2FsSlNYQ29tbWFuZFJlZiIsInNldFRvb2xKU1giLCJhcmdzIiwiY2xlYXJMb2NhbEpTWCIsInJlc3QiLCJ0b29sVXNlQ29uZmlybVF1ZXVlIiwic2V0VG9vbFVzZUNvbmZpcm1RdWV1ZSIsInBlcm1pc3Npb25TdGlja3lGb290ZXIiLCJzZXRQZXJtaXNzaW9uU3RpY2t5Rm9vdGVyIiwic2FuZGJveFBlcm1pc3Npb25SZXF1ZXN0UXVldWUiLCJzZXRTYW5kYm94UGVybWlzc2lvblJlcXVlc3RRdWV1ZSIsIkFycmF5IiwiaG9zdFBhdHRlcm4iLCJyZXNvbHZlUHJvbWlzZSIsImFsbG93Q29ubmVjdGlvbiIsInByb21wdFF1ZXVlIiwic2V0UHJvbXB0UXVldWUiLCJyZXF1ZXN0IiwidG9vbElucHV0U3VtbWFyeSIsInJlc29sdmUiLCJyZXNwb25zZSIsInJlamVjdCIsImVycm9yIiwiRXJyb3IiLCJzYW5kYm94QnJpZGdlQ2xlYW51cFJlZiIsIk1hcCIsInRlcm1pbmFsVGl0bGVGcm9tUmVuYW1lIiwic2V0dGluZ3MiLCJzZXNzaW9uVGl0bGUiLCJoYWlrdVRpdGxlIiwic2V0SGFpa3VUaXRsZSIsImhhaWt1VGl0bGVBdHRlbXB0ZWRSZWYiLCJhZ2VudFRpdGxlIiwiYWdlbnRUeXBlIiwidGVybWluYWxUaXRsZSIsImlzV2FpdGluZ0ZvckFwcHJvdmFsIiwiaXNTaG93aW5nTG9jYWxKU1hDb21tYW5kIiwidGl0bGVJc0FuaW1hdGluZyIsInNlc3Npb25TdGF0dXMiLCJ3YWl0aW5nRm9yIiwidG9vbCIsInRhYlN0YXR1c0dhdGVFbmFibGVkIiwic2hvd1N0YXR1c0luVGVybWluYWxUYWIiLCJyYXdTZXRNZXNzYWdlcyIsIm1lc3NhZ2VzUmVmIiwiaWRsZUhpbnRTaG93blJlZiIsInNldE1lc3NhZ2VzIiwiYWN0aW9uIiwiU2V0U3RhdGVBY3Rpb24iLCJuZXh0IiwiZGVsdGEiLCJhZGRlZCIsInNvbWUiLCJzZXRVc2VySW5wdXRPblByb2Nlc3NpbmciLCJkaXZpZGVySW5kZXgiLCJkaXZpZGVyWVJlZiIsIm9uU2Nyb2xsQXdheSIsIm9uUmVwaW4iLCJqdW1wVG9OZXciLCJzaGlmdERpdmlkZXIiLCJjdXJzb3IiLCJzZXRDdXJzb3IiLCJjdXJzb3JOYXZSZWYiLCJ1bnNlZW5EaXZpZGVyIiwicmVwaW5TY3JvbGwiLCJzY3JvbGxUb0JvdHRvbSIsImxhc3RNc2ciLCJhdCIsImxhc3RNc2dJc0h1bWFuIiwib25QcmVwZW5kIiwiY29tcG9zZWRPblNjcm9sbCIsInN0aWNreSIsImhhbmRsZSIsImNvbXBhbmlvblJlYWN0aW9uIiwiYXdhaXRQZW5kaW5nSG9va3MiLCJkZWZlcnJlZE1lc3NhZ2VzIiwiZGVmZXJyZWRCZWhpbmQiLCJmcm96ZW5UcmFuc2NyaXB0U3RhdGUiLCJzZXRGcm96ZW5UcmFuc2NyaXB0U3RhdGUiLCJtZXNzYWdlc0xlbmd0aCIsInN0cmVhbWluZ1Rvb2xVc2VzTGVuZ3RoIiwiaW5wdXRWYWx1ZSIsInNldElucHV0VmFsdWVSYXciLCJpbnB1dFZhbHVlUmVmIiwiaW5zZXJ0VGV4dFJlZiIsImluc2VydCIsInNldElucHV0V2l0aEN1cnNvciIsInNldElucHV0VmFsdWUiLCJ0cmltIiwiaW5wdXRNb2RlIiwic2V0SW5wdXRNb2RlIiwic3Rhc2hlZFByb21wdCIsInNldFN0YXNoZWRQcm9tcHQiLCJwYXN0ZWRDb250ZW50cyIsImhhbmRsZVJlbW90ZUluaXQiLCJyZW1vdGVTbGFzaENvbW1hbmRzIiwicmVtb3RlQ29tbWFuZFNldCIsImNtZCIsImluUHJvZ3Jlc3NUb29sVXNlSURzIiwic2V0SW5Qcm9ncmVzc1Rvb2xVc2VJRHMiLCJoYXNJbnRlcnJ1cHRpYmxlVG9vbEluUHJvZ3Jlc3NSZWYiLCJyZW1vdGVTZXNzaW9uIiwic2V0SXNMb2FkaW5nIiwib25Jbml0IiwiZGlyZWN0Q29ubmVjdCIsInNzaFJlbW90ZSIsInNlc3Npb24iLCJhY3RpdmVSZW1vdGUiLCJpc1JlbW90ZU1vZGUiLCJzZXRQYXN0ZWRDb250ZW50cyIsInN1Ym1pdENvdW50Iiwic2V0U3VibWl0Q291bnQiLCJyZXNwb25zZUxlbmd0aFJlZiIsImFwaU1ldHJpY3NSZWYiLCJ0dGZ0TXMiLCJmaXJzdFRva2VuVGltZSIsImxhc3RUb2tlblRpbWUiLCJyZXNwb25zZUxlbmd0aEJhc2VsaW5lIiwiZW5kUmVzcG9uc2VMZW5ndGgiLCJzZXRSZXNwb25zZUxlbmd0aCIsImVudHJpZXMiLCJsYXN0RW50cnkiLCJzdHJlYW1pbmdUZXh0Iiwic2V0U3RyZWFtaW5nVGV4dCIsInJlZHVjZWRNb3Rpb24iLCJwcmVmZXJzUmVkdWNlZE1vdGlvbiIsInNob3dTdHJlYW1pbmdUZXh0Iiwib25TdHJlYW1pbmdUZXh0IiwidmlzaWJsZVN0cmVhbWluZ1RleHQiLCJzdWJzdHJpbmciLCJsYXN0SW5kZXhPZiIsImxhc3RRdWVyeUNvbXBsZXRpb25UaW1lIiwic2V0TGFzdFF1ZXJ5Q29tcGxldGlvblRpbWUiLCJzcGlubmVyTWVzc2FnZSIsInNldFNwaW5uZXJNZXNzYWdlIiwic3Bpbm5lckNvbG9yIiwic2V0U3Bpbm5lckNvbG9yIiwic3Bpbm5lclNoaW1tZXJDb2xvciIsInNldFNwaW5uZXJTaGltbWVyQ29sb3IiLCJpc01lc3NhZ2VTZWxlY3RvclZpc2libGUiLCJzZXRJc01lc3NhZ2VTZWxlY3RvclZpc2libGUiLCJtZXNzYWdlU2VsZWN0b3JQcmVzZWxlY3QiLCJzZXRNZXNzYWdlU2VsZWN0b3JQcmVzZWxlY3QiLCJzaG93Q29zdERpYWxvZyIsInNldFNob3dDb3N0RGlhbG9nIiwiY29udmVyc2F0aW9uSWQiLCJzZXRDb252ZXJzYXRpb25JZCIsImlkbGVSZXR1cm5QZW5kaW5nIiwic2V0SWRsZVJldHVyblBlbmRpbmciLCJpZGxlTWludXRlcyIsInNraXBJZGxlQ2hlY2tSZWYiLCJsYXN0UXVlcnlDb21wbGV0aW9uVGltZVJlZiIsImNvbnRlbnRSZXBsYWNlbWVudFN0YXRlUmVmIiwiaGF2ZVNob3duQ29zdERpYWxvZyIsInNldEhhdmVTaG93bkNvc3REaWFsb2ciLCJoYXNBY2tub3dsZWRnZWRDb3N0VGhyZXNob2xkIiwidmltTW9kZSIsInNldFZpbU1vZGUiLCJzaG93QmFzaGVzRGlhbG9nIiwic2V0U2hvd0Jhc2hlc0RpYWxvZyIsImlzU2VhcmNoaW5nSGlzdG9yeSIsInNldElzU2VhcmNoaW5nSGlzdG9yeSIsImlzSGVscE9wZW4iLCJzZXRJc0hlbHBPcGVuIiwiaXNUZXJtaW5hbEZvY3VzZWQiLCJ0ZXJtaW5hbEZvY3VzUmVmIiwidGhlbWUiLCJ0aXBQaWNrZWRUaGlzVHVyblJlZiIsInBpY2tOZXdTcGlubmVyVGlwIiwiYmFzaFRvb2xzUHJvY2Vzc2VkSWR4IiwiYmFzaFRvb2xzIiwiYWRkIiwicmVhZEZpbGVTdGF0ZSIsInRpcCIsImNvbnRlbnQiLCJyZXNldExvYWRpbmdTdGF0ZSIsImhhc1J1bm5pbmdUZWFtbWF0ZXMiLCJ0b3RhbE1zIiwiZGVmZXJyZWRCdWRnZXQiLCJzYWZlWW9sb01lc3NhZ2VTaG93blJlZiIsImF1dG9QZXJtaXNzaW9uc05vdGlmaWNhdGlvbkNvdW50IiwicmVmIiwicHJldkNvdW50Iiwid29ya3RyZWVUaXBTaG93blJlZiIsInd0IiwiY3JlYXRpb25EdXJhdGlvbk1zIiwidXNlZFNwYXJzZVBhdGhzIiwic2VjcyIsIm9ubHlTbGVlcFRvb2xBY3RpdmUiLCJsYXN0QXNzaXN0YW50IiwiZmluZExhc3QiLCJ0eXBlIiwiaW5Qcm9ncmVzc1Rvb2xVc2VzIiwibWVzc2FnZSIsImlkIiwiZXZlcnkiLCJtck9uQmVmb3JlUXVlcnkiLCJtck9uVHVybkNvbXBsZXRlIiwicmVuZGVyIiwibXJSZW5kZXIiLCJoYXNBY3RpdmVQcm9tcHQiLCJxdWV1ZSIsImZlZWRiYWNrU3VydmV5T3JpZ2luYWwiLCJza2lsbEltcHJvdmVtZW50U3VydmV5Iiwic2hvd0lzc3VlRmxhZ0Jhbm5lciIsImZlZWRiYWNrU3VydmV5IiwiaGFuZGxlU2VsZWN0Iiwic2VsZWN0ZWQiLCJkaWRBdXRvUnVuSXNzdWVSZWYiLCJzaG93ZWRUcmFuc2NyaXB0UHJvbXB0Iiwic2V0QXV0b1J1bklzc3VlUmVhc29uIiwicG9zdENvbXBhY3RTdXJ2ZXkiLCJtZW1vcnlTdXJ2ZXkiLCJmcnVzdHJhdGlvbkRldGVjdGlvbiIsInNldElERUluc3RhbGxhdGlvblN0YXRlIiwiZmlsZUhpc3RvcnlTdGF0ZSIsInJlc3VtZSIsInNlc3Npb25JZCIsImxvZyIsImVudHJ5cG9pbnQiLCJyZXN1bWVTdGFydCIsInBlcmZvcm1hbmNlIiwiY29vcmRpbmF0b3JNb2R1bGUiLCJ3YXJuaW5nIiwibWF0Y2hTZXNzaW9uTW9kZSIsImdldEFnZW50RGVmaW5pdGlvbnNXaXRoT3ZlcnJpZGVzIiwiZ2V0QWN0aXZlQWdlbnRzRnJvbUxpc3QiLCJjYWNoZSIsImNsZWFyIiwiZnJlc2hBZ2VudERlZnMiLCJhbGxBZ2VudHMiLCJhY3RpdmVBZ2VudHMiLCJwdXNoIiwic2Vzc2lvbkVuZFRpbWVvdXRNcyIsImdldEFwcFN0YXRlIiwiZ2V0U3RhdGUiLCJzaWduYWwiLCJBYm9ydFNpZ25hbCIsInRpbWVvdXQiLCJ0aW1lb3V0TXMiLCJob29rTWVzc2FnZXMiLCJtb2RlbCIsImZpbGVIaXN0b3J5U25hcHNob3RzIiwiYWdlbnREZWZpbml0aW9uIiwicmVzdG9yZWRBZ2VudCIsImFnZW50U2V0dGluZyIsImFnZW50Iiwic3RhbmRhbG9uZUFnZW50Q29udGV4dCIsImFnZW50TmFtZSIsImFnZW50Q29sb3IiLCJyZXN0b3JlUmVhZEZpbGVTdGF0ZSIsInByb2plY3RQYXRoIiwidGFyZ2V0U2Vzc2lvbkNvc3RzIiwiZnVsbFBhdGgiLCJyZW5hbWVSZWNvcmRpbmdGb3JTZXNzaW9uIiwid29ya3RyZWVTZXNzaW9uIiwid3MiLCJzYXZlTW9kZSIsImlzQ29vcmRpbmF0b3JNb2RlIiwiY29udGVudFJlcGxhY2VtZW50cyIsInN1Y2Nlc3MiLCJyZXN1bWVfZHVyYXRpb25fbXMiLCJpbml0aWFsUmVhZEZpbGVTdGF0ZSIsImRpc2NvdmVyZWRTa2lsbE5hbWVzUmVmIiwibG9hZGVkTmVzdGVkTWVtb3J5UGF0aHNSZWYiLCJjd2QiLCJleHRyYWN0ZWQiLCJhcGlLZXlTdGF0dXMiLCJyZXZlcmlmeSIsImF1dG9SdW5Jc3N1ZVJlYXNvbiIsImV4aXRGbG93Iiwic2V0RXhpdEZsb3ciLCJpc0V4aXRpbmciLCJzZXRJc0V4aXRpbmciLCJzaG93aW5nQ29zdERpYWxvZyIsImFsbG93RGlhbG9nc1dpdGhBbmltYXRpb24iLCJmb2N1c2VkSW5wdXREaWFsb2ciLCJoYXNTdXBwcmVzc2VkRGlhbG9ncyIsImlzUGF1c2VkIiwicHJldkRpYWxvZ1JlZiIsIndhcyIsInBhdXNlUHJvYWN0aXZlIiwiZm9yY2VFbmQiLCJvbkFib3J0IiwiaXRlbSIsImFib3J0IiwiY2FuY2VsUmVxdWVzdCIsImhhbmRsZVF1ZXVlZENvbW1hbmRPbkNhbmNlbCIsImltYWdlcyIsIm5ld0NvbnRlbnRzIiwiaW1hZ2UiLCJjYW5jZWxSZXF1ZXN0UHJvcHMiLCJvbkFnZW50c0tpbGxlZCIsImFib3J0U2lnbmFsIiwicG9wQ29tbWFuZEZyb21RdWV1ZSIsInRvdGFsQ29zdCIsInNhbmRib3hBc2tDYWxsYmFjayIsInJlcXVlc3RJZCIsInNlbnQiLCJob3N0IiwicmVzb2x2ZVNob3VsZEFsbG93SG9zdCIsInJlc29sdmVPbmNlIiwiYWxsb3ciLCJicmlkZ2VDYWxsYmFja3MiLCJyZXBsQnJpZGdlUGVybWlzc2lvbkNhbGxiYWNrcyIsImJyaWRnZVJlcXVlc3RJZCIsInNlbmRSZXF1ZXN0IiwidW5zdWJzY3JpYmUiLCJvblJlc3BvbnNlIiwiYmVoYXZpb3IiLCJzaWJsaW5nQ2xlYW51cHMiLCJnZXQiLCJmbiIsImRlbGV0ZSIsImNsZWFudXAiLCJleGlzdGluZyIsInNldCIsInJlYXNvbiIsImdldFNhbmRib3hVbmF2YWlsYWJsZVJlYXNvbiIsImlzU2FuZGJveFJlcXVpcmVkIiwic3RkZXJyIiwid3JpdGUiLCJsZXZlbCIsImlzU2FuZGJveGluZ0VuYWJsZWQiLCJpbml0aWFsaXplIiwiY2F0Y2giLCJlcnIiLCJzZXRUb29sUGVybWlzc2lvbkNvbnRleHQiLCJjb250ZXh0Iiwib3B0aW9ucyIsInByZXNlcnZlTW9kZSIsInNldEltbWVkaWF0ZSIsImN1cnJlbnRRdWV1ZSIsInJlY2hlY2tQZXJtaXNzaW9uIiwiY2FuVXNlVG9vbCIsInJlcXVlc3RQcm9tcHQiLCJnZXRUb29sVXNlQ29udGV4dCIsImNvbXB1dGVUb29scyIsImFzc2VtYmxlZCIsIm1lcmdlZCIsInRoaW5raW5nRW5hYmxlZCIsIm1jcFJlc291cmNlcyIsInJlc291cmNlcyIsImlzTm9uSW50ZXJhY3RpdmVTZXNzaW9uIiwicmVmcmVzaFRvb2xzIiwidXBkYXRlRmlsZUhpc3RvcnlTdGF0ZSIsInVwZGF0ZXIiLCJ1cGRhdGVkIiwidXBkYXRlQXR0cmlidXRpb25TdGF0ZSIsImF0dHJpYnV0aW9uIiwib3Blbk1lc3NhZ2VTZWxlY3RvciIsIm9uQ2hhbmdlQVBJS2V5IiwiYXBwZW5kU3lzdGVtTWVzc2FnZSIsIm1zZyIsInNlbmRPU05vdGlmaWNhdGlvbiIsIm9wdHMiLCJvbkluc3RhbGxJREVFeHRlbnNpb24iLCJuZXN0ZWRNZW1vcnlBdHRhY2htZW50VHJpZ2dlcnMiLCJsb2FkZWROZXN0ZWRNZW1vcnlQYXRocyIsImR5bmFtaWNTa2lsbERpclRyaWdnZXJzIiwiZGlzY292ZXJlZFNraWxsTmFtZXMiLCJwdXNoQXBpTWV0cmljc0VudHJ5IiwiYmFzZWxpbmUiLCJvbkNvbXBhY3RQcm9ncmVzcyIsImV2ZW50IiwiaG9va1R5cGUiLCJzZXRIYXNJbnRlcnJ1cHRpYmxlVG9vbEluUHJvZ3Jlc3MiLCJ2IiwiY29udGVudFJlcGxhY2VtZW50U3RhdGUiLCJoYW5kbGVCYWNrZ3JvdW5kUXVlcnkiLCJyZW1vdmVkTm90aWZpY2F0aW9ucyIsInRvb2xVc2VDb250ZXh0IiwiZGVmYXVsdFN5c3RlbVByb21wdCIsInVzZXJDb250ZXh0Iiwic3lzdGVtQ29udGV4dCIsImFsbCIsImZyb20iLCJhZGRpdGlvbmFsV29ya2luZ0RpcmVjdG9yaWVzIiwia2V5cyIsInJlbmRlcmVkU3lzdGVtUHJvbXB0Iiwibm90aWZpY2F0aW9uQXR0YWNobWVudHMiLCJub3RpZmljYXRpb25NZXNzYWdlcyIsImV4aXN0aW5nUHJvbXB0cyIsImF0dGFjaG1lbnQiLCJjb21tYW5kTW9kZSIsInByb21wdCIsInVuaXF1ZU5vdGlmaWNhdGlvbnMiLCJxdWVyeVBhcmFtcyIsInF1ZXJ5U291cmNlIiwiZGVzY3JpcHRpb24iLCJoYW5kbGVCYWNrZ3JvdW5kU2Vzc2lvbiIsIm9uQmFja2dyb3VuZFF1ZXJ5Iiwib25RdWVyeUV2ZW50IiwiUGFyYW1ldGVycyIsIm5ld01lc3NhZ2UiLCJvbGQiLCJpbmNsdWRlU25pcHBlZCIsInNldENvbnRleHRCbG9ja2VkIiwiZGF0YSIsIm9sZE1lc3NhZ2VzIiwibGFzdCIsInBhcmVudFRvb2xVc2VJRCIsImNvcHkiLCJpc0FwaUVycm9yTWVzc2FnZSIsIm5ld0NvbnRlbnQiLCJ0b21ic3RvbmVkTWVzc2FnZSIsIm1ldHJpY3MiLCJvblF1ZXJ5SW1wbCIsIm1lc3NhZ2VzSW5jbHVkaW5nTmV3TWVzc2FnZXMiLCJzaG91bGRRdWVyeSIsImFkZGl0aW9uYWxBbGxvd2VkVG9vbHMiLCJtYWluTG9vcE1vZGVsUGFyYW0iLCJlZmZvcnQiLCJmcmVzaENsaWVudHMiLCJoYW5kbGVRdWVyeVN0YXJ0IiwiaWRlQ2xpZW50IiwiZmlyc3RVc2VyTWVzc2FnZSIsImZpbmQiLCJpc01ldGEiLCJzdGFydHNXaXRoIiwic2V0U3RhdGUiLCJjdXIiLCJhbHdheXNBbGxvd1J1bGVzIiwiY29tbWFuZCIsImkiLCJmcmVzaFRvb2xzIiwiZnJlc2hNY3BDbGllbnRzIiwicHJldmlvdXNHZXRBcHBTdGF0ZSIsImVmZm9ydFZhbHVlIiwiYmFzZVVzZXJDb250ZXh0IiwiZmFzdE1vZGUiLCJ0ZXJtaW5hbEZvY3VzIiwiZmlyZUNvbXBhbmlvbk9ic2VydmVyIiwicmVhY3Rpb24iLCJ0dGZ0cyIsImUiLCJvdHBzVmFsdWVzIiwic2FtcGxpbmdNcyIsImlzTXVsdGlSZXF1ZXN0IiwiaG9va01zIiwiaG9va0NvdW50IiwidG9vbE1zIiwidG9vbENvdW50IiwiY2xhc3NpZmllck1zIiwiY2xhc3NpZmllckNvdW50IiwidHVybk1zIiwib3RwcyIsImlzUDUwIiwiaG9va0R1cmF0aW9uTXMiLCJ0dXJuRHVyYXRpb25NcyIsInRvb2xEdXJhdGlvbk1zIiwiY2xhc3NpZmllckR1cmF0aW9uTXMiLCJjb25maWdXcml0ZUNvdW50Iiwib25RdWVyeSIsIm9uQmVmb3JlUXVlcnlDYWxsYmFjayIsInRlYW1OYW1lIiwidGhpc0dlbmVyYXRpb24iLCJ0cnlTdGFydCIsInBhcnNlZEJ1ZGdldCIsImxhdGVzdE1lc3NhZ2VzIiwic2hvdWxkUHJvY2VlZCIsImVuZCIsImFib3J0ZWQiLCJ0dW5nc3RlbkFjdGl2ZVNlc3Npb24iLCJ0dW5nc3RlblBhbmVsQXV0b0hpZGRlbiIsImJ1ZGdldEluZm8iLCJoYXNSdW5uaW5nU3dhcm1BZ2VudHMiLCJtc2dzIiwibGFzdFVzZXJNc2ciLCJpZHgiLCJpbml0aWFsTWVzc2FnZVJlZiIsInBlbmRpbmciLCJwcm9jZXNzSW5pdGlhbE1lc3NhZ2UiLCJpbml0aWFsTXNnIiwiTm9uTnVsbGFibGUiLCJjbGVhckNvbnRleHQiLCJvbGRQbGFuU2x1ZyIsInBsYW5Db250ZW50IiwiY2xlYXJDb252ZXJzYXRpb24iLCJzaG91bGRTdG9yZVBsYW5Gb3JWZXJpZmljYXRpb24iLCJ1cGRhdGVkVG9vbFBlcm1pc3Npb25Db250ZXh0IiwiYWxsb3dlZFByb21wdHMiLCJwcmVQbGFuTW9kZSIsInBlbmRpbmdQbGFuVmVyaWZpY2F0aW9uIiwicGxhbiIsInZlcmlmaWNhdGlvblN0YXJ0ZWQiLCJ2ZXJpZmljYXRpb25Db21wbGV0ZWQiLCJvblN1Ym1pdCIsInNldEN1cnNvck9mZnNldCIsImNsZWFyQnVmZmVyIiwicmVzZXRIaXN0b3J5IiwibmV3QWJvcnRDb250cm9sbGVyIiwiaGVscGVycyIsInNwZWN1bGF0aW9uQWNjZXB0Iiwic3BlY3VsYXRpb25TZXNzaW9uVGltZVNhdmVkTXMiLCJmcm9tS2V5YmluZGluZyIsInJlc3VtZVByb2FjdGl2ZSIsInRyaW1tZWRJbnB1dCIsInNwYWNlSW5kZXgiLCJpbmRleE9mIiwiY29tbWFuZE5hbWUiLCJjb21tYW5kQXJncyIsIm1hdGNoaW5nQ29tbWFuZCIsImFsaWFzZXMiLCJpbmNsdWRlcyIsInZhcmlhbnQiLCJtZXNzYWdlQ291bnQiLCJ0b3RhbElucHV0VG9rZW5zIiwic2hvdWxkVHJlYXRBc0ltbWVkaWF0ZSIsImltbWVkaWF0ZSIsInBhc3RlZFRleHRSZWZzIiwiciIsInBhc3RlZFRleHRDb3VudCIsInBhc3RlZFRleHRCeXRlcyIsInJlZHVjZSIsInN1bSIsImV4ZWN1dGVJbW1lZGlhdGVDb21tYW5kIiwiZG9uZVdhc0NhbGxlZCIsIm9uRG9uZSIsImRvbmVPcHRpb25zIiwiZGlzcGxheSIsIm1ldGFNZXNzYWdlcyIsIm1vZCIsImxvYWQiLCJjYWxsIiwid2lsbG93TW9kZSIsImlkbGVUaHJlc2hvbGRNaW4iLCJOdW1iZXIiLCJDTEFVREVfQ09ERV9JRExFX1RIUkVTSE9MRF9NSU5VVEVTIiwidG9rZW5UaHJlc2hvbGQiLCJDTEFVREVfQ09ERV9JRExFX1RPS0VOX1RIUkVTSE9MRCIsImlkbGVSZXR1cm5EaXNtaXNzZWQiLCJpZGxlTXMiLCJpc1NsYXNoQ29tbWFuZCIsInN1Ym1pdHNOb3ciLCJzbmFwc2hvdCIsInF1ZXJ5UmVxdWlyZWQiLCJjIiwic3BsaXQiLCJwYXN0ZWRWYWx1ZXMiLCJPYmplY3QiLCJpbWFnZUNvbnRlbnRzIiwiaW1hZ2VQYXN0ZUlkcyIsIm1lc3NhZ2VDb250ZW50IiwicmVtb3RlQ29udGVudCIsImNvbnRlbnRCbG9ja3MiLCJyZW1vdGVCbG9ja3MiLCJwYXN0ZWQiLCJzb3VyY2UiLCJjb25zdCIsIm1lZGlhX3R5cGUiLCJtZWRpYVR5cGUiLCJ1c2VyTWVzc2FnZSIsInNlbmRNZXNzYWdlIiwib25JbnB1dENoYW5nZSIsImhhc0ludGVycnVwdGlibGVUb29sSW5Qcm9ncmVzcyIsIm9uQWdlbnRTdWJtaXQiLCJ0YXNrIiwiYWdlbnRJZCIsImhhbmRsZUF1dG9SdW5Jc3N1ZSIsImhhbmRsZUNhbmNlbEF1dG9SdW5Jc3N1ZSIsImhhbmRsZVN1cnZleVJlcXVlc3RGZWVkYmFjayIsIlN0cmluZyIsIm9uU3VibWl0UmVmIiwiaGFuZGxlT3BlblJhdGVMaW1pdE9wdGlvbnMiLCJoYW5kbGVFeGl0Iiwic3RkaW8iLCJzaG93V29ya3RyZWUiLCJleGl0TW9kIiwiZXhpdEZsb3dSZXN1bHQiLCJoYW5kbGVTaG93TWVzc2FnZVNlbGVjdG9yIiwicmV3aW5kQ29udmVyc2F0aW9uVG8iLCJtZXNzYWdlSW5kZXgiLCJwcmVSZXdpbmRNZXNzYWdlQ291bnQiLCJwb3N0UmV3aW5kTWVzc2FnZUNvdW50IiwibWVzc2FnZXNSZW1vdmVkIiwicmV3aW5kVG9NZXNzYWdlSW5kZXgiLCJyZXNldENvbnRleHRDb2xsYXBzZSIsInBlcm1pc3Npb25Nb2RlIiwicHJvbXB0U3VnZ2VzdGlvbiIsInByb21wdElkIiwic2hvd25BdCIsImFjY2VwdGVkQXQiLCJnZW5lcmF0aW9uUmVxdWVzdElkIiwicmVzdG9yZU1lc3NhZ2VTeW5jIiwiaXNBcnJheSIsImJsb2NrIiwiaW1hZ2VCbG9ja3MiLCJuZXdQYXN0ZWRDb250ZW50cyIsImluZGV4IiwiaGFuZGxlUmVzdG9yZU1lc3NhZ2UiLCJyZXN0b3JlIiwiZmluZFJhd0luZGV4IiwiZmluZEluZGV4IiwibWVzc2FnZUFjdGlvbkNhcHMiLCJyYXciLCJzdGRvdXQiLCJjb2xvciIsImVkaXQiLCJyYXdJZHgiLCJub0ZpbGVDaGFuZ2VzIiwib25seVN5bnRoZXRpYyIsImVudGVyIiwiZW50ZXJNZXNzYWdlQWN0aW9ucyIsImhhbmRsZXJzIiwibWVzc2FnZUFjdGlvbkhhbmRsZXJzIiwibWVtb3J5RmlsZXMiLCJmaWxlTGlzdCIsInBhdGgiLCJwYXJlbnQiLCJmaWxlIiwiY29udGVudERpZmZlcnNGcm9tRGlzayIsInJhd0NvbnRlbnQiLCJ0aW1lc3RhbXAiLCJvZmZzZXQiLCJpc1BhcnRpYWxWaWV3Iiwic2VuZEJyaWRnZVJlc3VsdCIsImhhc0NvdW50ZWRRdWV1ZVVzZVJlZiIsInByb21wdFF1ZXVlVXNlQ291bnQiLCJleGVjdXRlUXVldWVkSW5wdXQiLCJoYXNBY3RpdmVMb2NhbEpzeFVJIiwicmVjb3JkVXNlckFjdGl2aXR5IiwibGFzdFVzZXJJbnRlcmFjdGlvbiIsImlkbGVUaW1lU2luY2VSZXNwb25zZSIsIm1lc3NhZ2VJZGxlTm90aWZUaHJlc2hvbGRNcyIsIm5vdGlmaWNhdGlvblR5cGUiLCJpZGxlVGhyZXNob2xkTXMiLCJscWN0IiwiYWRkTm90aWYiLCJtc2dzUmVmIiwiaGludFJlZiIsInRvdGFsVG9rZW5zIiwiZm9ybWF0dGVkVG9rZW5zIiwibWF4IiwiaGFuZGxlSW5jb21pbmdQcm9tcHQiLCJ2b2ljZSIsImludGVyaW1SYW5nZSIsIm9uU3VibWl0TWVzc2FnZSIsImFzc2lzdGFudE1vZGUiLCJrYWlyb3NFbmFibGVkIiwib25TdWJtaXRUYXNrIiwicXVldWVkQ29tbWFuZHNMZW5ndGgiLCJpc0luUGxhbk1vZGUiLCJvblN1Ym1pdFRpY2siLCJvblF1ZXVlVGljayIsInNodXRkb3duIiwiaW50ZXJuYWxfZXZlbnRFbWl0dGVyIiwicmVtb3VudEtleSIsInNldFJlbW91bnRLZXkiLCJoYW5kbGVTdXNwZW5kIiwiaGFuZGxlUmVzdW1lIiwib24iLCJzdG9wSG9va1NwaW5uZXJTdWZmaXgiLCJwcm9ncmVzc01zZ3MiLCJob29rRXZlbnQiLCJjdXJyZW50VG9vbFVzZUlEIiwidG9vbFVzZUlEIiwiaGFzU3VtbWFyeUZvckN1cnJlbnRFeGVjdXRpb24iLCJzdWJ0eXBlIiwiY3VycmVudEhvb2tzIiwicCIsInRvdGFsIiwiY29tcGxldGVkQ291bnQiLCJjdXN0b21NZXNzYWdlIiwic3RhdHVzTWVzc2FnZSIsImxhYmVsIiwiaGFuZGxlRW50ZXJUcmFuc2NyaXB0IiwiaGFuZGxlRXhpdFRyYW5zY3JpcHQiLCJ2aXJ0dWFsU2Nyb2xsQWN0aXZlIiwic2VhcmNoT3BlbiIsInNldFNlYXJjaE9wZW4iLCJzZWFyY2hRdWVyeSIsInNlYXJjaENvdW50Iiwic2V0U2VhcmNoQ291bnQiLCJzZWFyY2hDdXJyZW50Iiwic2V0U2VhcmNoQ3VycmVudCIsIm9uU2VhcmNoTWF0Y2hlc0NoYW5nZSIsImN0cmwiLCJtZXRhIiwic2V0QW5jaG9yIiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwicmVwZWF0IiwibmV4dE1hdGNoIiwicHJldk1hdGNoIiwic2V0UXVlcnkiLCJzY2FuRWxlbWVudCIsInNldFBvc2l0aW9ucyIsInRyYW5zY3JpcHRDb2xzIiwiY29sdW1ucyIsInByZXZDb2xzUmVmIiwiZGlzYXJtU2VhcmNoIiwiZ2VuIiwic2V0U3RhdHVzIiwidyIsInJlcGxhY2UiLCJvcGVuZWQiLCJpblRyYW5zY3JpcHQiLCJnbG9iYWxLZXliaW5kaW5nUHJvcHMiLCJvbkVudGVyVHJhbnNjcmlwdCIsIm9uRXhpdFRyYW5zY3JpcHQiLCJzZWFyY2hCYXJPcGVuIiwidHJhbnNjcmlwdE1lc3NhZ2VzIiwidHJhbnNjcmlwdFN0cmVhbWluZ1Rvb2xVc2VzIiwib25PcGVuQmFja2dyb3VuZFRhc2tzIiwidHJhbnNjcmlwdFNjcm9sbFJlZiIsInRyYW5zY3JpcHRNZXNzYWdlc0VsZW1lbnQiLCJ0cmFuc2NyaXB0VG9vbEpTWCIsInRyYW5zY3JpcHRSZXR1cm4iLCJxIiwidmlld2VkVGFzayIsInZpZXdlZFRlYW1tYXRlVGFzayIsInZpZXdlZEFnZW50VGFzayIsInVzZXNTeW5jTWVzc2FnZXMiLCJkaXNwbGF5ZWRNZXNzYWdlcyIsInBsYWNlaG9sZGVyVGV4dCIsInRvb2xQZXJtaXNzaW9uT3ZlcmxheSIsInRhaWwiLCJ3b3JrZXJCYWRnZSIsImNvbXBhbmlvbk5hcnJvdyIsImNvbXBhbmlvblZpc2libGUiLCJ0b29sSnN4Q2VudGVyZWQiLCJjZW50ZXJlZE1vZGFsIiwibWFpblJldHVybiIsInNpemUiLCJwZXJzaXN0VG9TZXR0aW5ncyIsImN1cnJlbnRSZXF1ZXN0IiwiYXBwcm92ZWRIb3N0IiwidXBkYXRlIiwicnVsZXMiLCJ0b29sTmFtZSIsInJ1bGVDb250ZW50IiwiZGVzdGluYXRpb24iLCJyZWZyZXNoQ29uZmlnIiwiY2xlYW51cHMiLCJzZWxlY3RlZEtleSIsInByb21wdF9yZXNwb25zZSIsInBvcnQiLCJ3b3JrZXJOYW1lIiwic2VydmVyTmFtZSIsInJlc3BvbmQiLCJpc1VybEFjY2VwdCIsInBhcmFtcyIsIm9uV2FpdGluZ0Rpc21pc3MiLCJzZWxlY3Rpb24iLCJtb2RlbEFsaWFzIiwibWFpbkxvb3BNb2RlbEZvclNlc3Npb24iLCJyZXBsQnJpZGdlRW5hYmxlZCIsInJlcGxCcmlkZ2VFeHBsaWNpdCIsInJlcGxCcmlkZ2VPdXRib3VuZE9ubHkiLCJwbHVnaW5OYW1lIiwicGx1Z2luRGVzY3JpcHRpb24iLCJtYXJrZXRwbGFjZU5hbWUiLCJzb3VyY2VDb21tYW5kIiwiZmlsZUV4dGVuc2lvbiIsImNob2ljZSIsImJsdXJiIiwiYXBwZW5kU3Rkb3V0IiwiYXBwZW5kV2hlbklkbGUiLCJ1bnN1YiIsInVsdHJhcGxhblNlc3Npb25VcmwiLCJsYXVuY2hVbHRyYXBsYW4iLCJkaXNjb25uZWN0ZWRCcmlkZ2UiLCJvblNlc3Npb25SZWFkeSIsImxhc3RSZXNwb25zZSIsInN1Z2dlc3Rpb24iLCJpc09wZW4iLCJza2lsbE5hbWUiLCJ1cGRhdGVzIiwiZmVlZGJhY2siLCJkaXJlY3Rpb24iLCJjb21wYWN0TWVzc2FnZXMiLCJhcHBTdGF0ZSIsImRlZmF1bHRTeXNQcm9tcHQiLCJmb3JrQ29udGV4dE1lc3NhZ2VzIiwia2VwdCIsIm1lc3NhZ2VzVG9LZWVwIiwib3JkZXJlZCIsInN1bW1hcnlNZXNzYWdlcyIsInBvc3RDb21wYWN0IiwiYm91bmRhcnlNYXJrZXIiLCJhdHRhY2htZW50cyIsImhvb2tSZXN1bHRzIiwiaGlzdG9yeVNob3J0Y3V0Il0sInNvdXJjZXMiOlsiUkVQTC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiLy8gYmlvbWUtaWdub3JlLWFsbCBhc3Npc3Qvc291cmNlL29yZ2FuaXplSW1wb3J0czogQU5ULU9OTFkgaW1wb3J0IG1hcmtlcnMgbXVzdCBub3QgYmUgcmVvcmRlcmVkXG5pbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbmltcG9ydCB7IHNwYXduU3luYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnXG5pbXBvcnQge1xuICBzbmFwc2hvdE91dHB1dFRva2Vuc0ZvclR1cm4sXG4gIGdldEN1cnJlbnRUdXJuVG9rZW5CdWRnZXQsXG4gIGdldFR1cm5PdXRwdXRUb2tlbnMsXG4gIGdldEJ1ZGdldENvbnRpbnVhdGlvbkNvdW50LFxuICBnZXRUb3RhbElucHV0VG9rZW5zLFxufSBmcm9tICcuLi9ib290c3RyYXAvc3RhdGUuanMnXG5pbXBvcnQgeyBwYXJzZVRva2VuQnVkZ2V0IH0gZnJvbSAnLi4vdXRpbHMvdG9rZW5CdWRnZXQuanMnXG5pbXBvcnQgeyBjb3VudCB9IGZyb20gJy4uL3V0aWxzL2FycmF5LmpzJ1xuaW1wb3J0IHsgZGlybmFtZSwgam9pbiB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgeyB0bXBkaXIgfSBmcm9tICdvcydcbmltcG9ydCBmaWd1cmVzIGZyb20gJ2ZpZ3VyZXMnXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL3ByZWZlci11c2Uta2V5YmluZGluZ3MgLS0gLyBuIE4gRXNjIFsgdiBhcmUgYmFyZSBsZXR0ZXJzIGluIHRyYW5zY3JpcHQgbW9kYWwgY29udGV4dCwgc2FtZSBjbGFzcyBhcyBnL0cvai9rIGluIFNjcm9sbEtleWJpbmRpbmdIYW5kbGVyXG5pbXBvcnQgeyB1c2VJbnB1dCB9IGZyb20gJy4uL2luay5qcydcbmltcG9ydCB7IHVzZVNlYXJjaElucHV0IH0gZnJvbSAnLi4vaG9va3MvdXNlU2VhcmNoSW5wdXQuanMnXG5pbXBvcnQgeyB1c2VUZXJtaW5hbFNpemUgfSBmcm9tICcuLi9ob29rcy91c2VUZXJtaW5hbFNpemUuanMnXG5pbXBvcnQgeyB1c2VTZWFyY2hIaWdobGlnaHQgfSBmcm9tICcuLi9pbmsvaG9va3MvdXNlLXNlYXJjaC1oaWdobGlnaHQuanMnXG5pbXBvcnQgdHlwZSB7IEp1bXBIYW5kbGUgfSBmcm9tICcuLi9jb21wb25lbnRzL1ZpcnR1YWxNZXNzYWdlTGlzdC5qcydcbmltcG9ydCB7IHJlbmRlck1lc3NhZ2VzVG9QbGFpblRleHQgfSBmcm9tICcuLi91dGlscy9leHBvcnRSZW5kZXJlci5qcydcbmltcG9ydCB7IG9wZW5GaWxlSW5FeHRlcm5hbEVkaXRvciB9IGZyb20gJy4uL3V0aWxzL2VkaXRvci5qcydcbmltcG9ydCB7IHdyaXRlRmlsZSB9IGZyb20gJ2ZzL3Byb21pc2VzJ1xuaW1wb3J0IHtcbiAgQm94LFxuICBUZXh0LFxuICB1c2VTdGRpbixcbiAgdXNlVGhlbWUsXG4gIHVzZVRlcm1pbmFsRm9jdXMsXG4gIHVzZVRlcm1pbmFsVGl0bGUsXG4gIHVzZVRhYlN0YXR1cyxcbn0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHR5cGUgeyBUYWJTdGF0dXNLaW5kIH0gZnJvbSAnLi4vaW5rL2hvb2tzL3VzZS10YWItc3RhdHVzLmpzJ1xuaW1wb3J0IHsgQ29zdFRocmVzaG9sZERpYWxvZyB9IGZyb20gJy4uL2NvbXBvbmVudHMvQ29zdFRocmVzaG9sZERpYWxvZy5qcydcbmltcG9ydCB7IElkbGVSZXR1cm5EaWFsb2cgfSBmcm9tICcuLi9jb21wb25lbnRzL0lkbGVSZXR1cm5EaWFsb2cuanMnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7XG4gIHVzZUVmZmVjdCxcbiAgdXNlTWVtbyxcbiAgdXNlUmVmLFxuICB1c2VTdGF0ZSxcbiAgdXNlQ2FsbGJhY2ssXG4gIHVzZURlZmVycmVkVmFsdWUsXG4gIHVzZUxheW91dEVmZmVjdCxcbiAgdHlwZSBSZWZPYmplY3QsXG59IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlTm90aWZpY2F0aW9ucyB9IGZyb20gJy4uL2NvbnRleHQvbm90aWZpY2F0aW9ucy5qcydcbmltcG9ydCB7IHNlbmROb3RpZmljYXRpb24gfSBmcm9tICcuLi9zZXJ2aWNlcy9ub3RpZmllci5qcydcbmltcG9ydCB7XG4gIHN0YXJ0UHJldmVudFNsZWVwLFxuICBzdG9wUHJldmVudFNsZWVwLFxufSBmcm9tICcuLi9zZXJ2aWNlcy9wcmV2ZW50U2xlZXAuanMnXG5pbXBvcnQgeyB1c2VUZXJtaW5hbE5vdGlmaWNhdGlvbiB9IGZyb20gJy4uL2luay91c2VUZXJtaW5hbE5vdGlmaWNhdGlvbi5qcydcbmltcG9ydCB7IGhhc0N1cnNvclVwVmlld3BvcnRZYW5rQnVnIH0gZnJvbSAnLi4vaW5rL3Rlcm1pbmFsLmpzJ1xuaW1wb3J0IHtcbiAgY3JlYXRlRmlsZVN0YXRlQ2FjaGVXaXRoU2l6ZUxpbWl0LFxuICBtZXJnZUZpbGVTdGF0ZUNhY2hlcyxcbiAgUkVBRF9GSUxFX1NUQVRFX0NBQ0hFX1NJWkUsXG59IGZyb20gJy4uL3V0aWxzL2ZpbGVTdGF0ZUNhY2hlLmpzJ1xuaW1wb3J0IHtcbiAgdXBkYXRlTGFzdEludGVyYWN0aW9uVGltZSxcbiAgZ2V0TGFzdEludGVyYWN0aW9uVGltZSxcbiAgZ2V0T3JpZ2luYWxDd2QsXG4gIGdldFByb2plY3RSb290LFxuICBnZXRTZXNzaW9uSWQsXG4gIHN3aXRjaFNlc3Npb24sXG4gIHNldENvc3RTdGF0ZUZvclJlc3RvcmUsXG4gIGdldFR1cm5Ib29rRHVyYXRpb25NcyxcbiAgZ2V0VHVybkhvb2tDb3VudCxcbiAgcmVzZXRUdXJuSG9va0R1cmF0aW9uLFxuICBnZXRUdXJuVG9vbER1cmF0aW9uTXMsXG4gIGdldFR1cm5Ub29sQ291bnQsXG4gIHJlc2V0VHVyblRvb2xEdXJhdGlvbixcbiAgZ2V0VHVybkNsYXNzaWZpZXJEdXJhdGlvbk1zLFxuICBnZXRUdXJuQ2xhc3NpZmllckNvdW50LFxuICByZXNldFR1cm5DbGFzc2lmaWVyRHVyYXRpb24sXG59IGZyb20gJy4uL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB7IGFzU2Vzc2lvbklkLCBhc0FnZW50SWQgfSBmcm9tICcuLi90eXBlcy9pZHMuanMnXG5pbXBvcnQgeyBsb2dGb3JEZWJ1Z2dpbmcgfSBmcm9tICcuLi91dGlscy9kZWJ1Zy5qcydcbmltcG9ydCB7IFF1ZXJ5R3VhcmQgfSBmcm9tICcuLi91dGlscy9RdWVyeUd1YXJkLmpzJ1xuaW1wb3J0IHsgaXNFbnZUcnV0aHkgfSBmcm9tICcuLi91dGlscy9lbnZVdGlscy5qcydcbmltcG9ydCB7IGZvcm1hdFRva2VucywgdHJ1bmNhdGVUb1dpZHRoIH0gZnJvbSAnLi4vdXRpbHMvZm9ybWF0LmpzJ1xuaW1wb3J0IHsgY29uc3VtZUVhcmx5SW5wdXQgfSBmcm9tICcuLi91dGlscy9lYXJseUlucHV0LmpzJ1xuXG5pbXBvcnQgeyBzZXRNZW1iZXJBY3RpdmUgfSBmcm9tICcuLi91dGlscy9zd2FybS90ZWFtSGVscGVycy5qcydcbmltcG9ydCB7XG4gIGlzU3dhcm1Xb3JrZXIsXG4gIGdlbmVyYXRlU2FuZGJveFJlcXVlc3RJZCxcbiAgc2VuZFNhbmRib3hQZXJtaXNzaW9uUmVxdWVzdFZpYU1haWxib3gsXG4gIHNlbmRTYW5kYm94UGVybWlzc2lvblJlc3BvbnNlVmlhTWFpbGJveCxcbn0gZnJvbSAnLi4vdXRpbHMvc3dhcm0vcGVybWlzc2lvblN5bmMuanMnXG5pbXBvcnQgeyByZWdpc3RlclNhbmRib3hQZXJtaXNzaW9uQ2FsbGJhY2sgfSBmcm9tICcuLi9ob29rcy91c2VTd2FybVBlcm1pc3Npb25Qb2xsZXIuanMnXG5pbXBvcnQgeyBnZXRUZWFtTmFtZSwgZ2V0QWdlbnROYW1lIH0gZnJvbSAnLi4vdXRpbHMvdGVhbW1hdGUuanMnXG5pbXBvcnQgeyBXb3JrZXJQZW5kaW5nUGVybWlzc2lvbiB9IGZyb20gJy4uL2NvbXBvbmVudHMvcGVybWlzc2lvbnMvV29ya2VyUGVuZGluZ1Blcm1pc3Npb24uanMnXG5pbXBvcnQge1xuICBpbmplY3RVc2VyTWVzc2FnZVRvVGVhbW1hdGUsXG4gIGdldEFsbEluUHJvY2Vzc1RlYW1tYXRlVGFza3MsXG59IGZyb20gJy4uL3Rhc2tzL0luUHJvY2Vzc1RlYW1tYXRlVGFzay9JblByb2Nlc3NUZWFtbWF0ZVRhc2suanMnXG5pbXBvcnQge1xuICBpc0xvY2FsQWdlbnRUYXNrLFxuICBxdWV1ZVBlbmRpbmdNZXNzYWdlLFxuICBhcHBlbmRNZXNzYWdlVG9Mb2NhbEFnZW50LFxuICB0eXBlIExvY2FsQWdlbnRUYXNrU3RhdGUsXG59IGZyb20gJy4uL3Rhc2tzL0xvY2FsQWdlbnRUYXNrL0xvY2FsQWdlbnRUYXNrLmpzJ1xuaW1wb3J0IHtcbiAgcmVnaXN0ZXJMZWFkZXJUb29sVXNlQ29uZmlybVF1ZXVlLFxuICB1bnJlZ2lzdGVyTGVhZGVyVG9vbFVzZUNvbmZpcm1RdWV1ZSxcbiAgcmVnaXN0ZXJMZWFkZXJTZXRUb29sUGVybWlzc2lvbkNvbnRleHQsXG4gIHVucmVnaXN0ZXJMZWFkZXJTZXRUb29sUGVybWlzc2lvbkNvbnRleHQsXG59IGZyb20gJy4uL3V0aWxzL3N3YXJtL2xlYWRlclBlcm1pc3Npb25CcmlkZ2UuanMnXG5pbXBvcnQgeyBlbmRJbnRlcmFjdGlvblNwYW4gfSBmcm9tICcuLi91dGlscy90ZWxlbWV0cnkvc2Vzc2lvblRyYWNpbmcuanMnXG5pbXBvcnQgeyB1c2VMb2dNZXNzYWdlcyB9IGZyb20gJy4uL2hvb2tzL3VzZUxvZ01lc3NhZ2VzLmpzJ1xuaW1wb3J0IHsgdXNlUmVwbEJyaWRnZSB9IGZyb20gJy4uL2hvb2tzL3VzZVJlcGxCcmlkZ2UuanMnXG5pbXBvcnQge1xuICB0eXBlIENvbW1hbmQsXG4gIHR5cGUgQ29tbWFuZFJlc3VsdERpc3BsYXksXG4gIHR5cGUgUmVzdW1lRW50cnlwb2ludCxcbiAgZ2V0Q29tbWFuZE5hbWUsXG4gIGlzQ29tbWFuZEVuYWJsZWQsXG59IGZyb20gJy4uL2NvbW1hbmRzLmpzJ1xuaW1wb3J0IHR5cGUge1xuICBQcm9tcHRJbnB1dE1vZGUsXG4gIFF1ZXVlZENvbW1hbmQsXG4gIFZpbU1vZGUsXG59IGZyb20gJy4uL3R5cGVzL3RleHRJbnB1dFR5cGVzLmpzJ1xuaW1wb3J0IHtcbiAgTWVzc2FnZVNlbGVjdG9yLFxuICBzZWxlY3RhYmxlVXNlck1lc3NhZ2VzRmlsdGVyLFxuICBtZXNzYWdlc0FmdGVyQXJlT25seVN5bnRoZXRpYyxcbn0gZnJvbSAnLi4vY29tcG9uZW50cy9NZXNzYWdlU2VsZWN0b3IuanMnXG5pbXBvcnQgeyB1c2VJZGVMb2dnaW5nIH0gZnJvbSAnLi4vaG9va3MvdXNlSWRlTG9nZ2luZy5qcydcbmltcG9ydCB7XG4gIFBlcm1pc3Npb25SZXF1ZXN0LFxuICB0eXBlIFRvb2xVc2VDb25maXJtLFxufSBmcm9tICcuLi9jb21wb25lbnRzL3Blcm1pc3Npb25zL1Blcm1pc3Npb25SZXF1ZXN0LmpzJ1xuaW1wb3J0IHsgRWxpY2l0YXRpb25EaWFsb2cgfSBmcm9tICcuLi9jb21wb25lbnRzL21jcC9FbGljaXRhdGlvbkRpYWxvZy5qcydcbmltcG9ydCB7IFByb21wdERpYWxvZyB9IGZyb20gJy4uL2NvbXBvbmVudHMvaG9va3MvUHJvbXB0RGlhbG9nLmpzJ1xuaW1wb3J0IHR5cGUgeyBQcm9tcHRSZXF1ZXN0LCBQcm9tcHRSZXNwb25zZSB9IGZyb20gJy4uL3R5cGVzL2hvb2tzLmpzJ1xuaW1wb3J0IFByb21wdElucHV0IGZyb20gJy4uL2NvbXBvbmVudHMvUHJvbXB0SW5wdXQvUHJvbXB0SW5wdXQuanMnXG5pbXBvcnQgeyBQcm9tcHRJbnB1dFF1ZXVlZENvbW1hbmRzIH0gZnJvbSAnLi4vY29tcG9uZW50cy9Qcm9tcHRJbnB1dC9Qcm9tcHRJbnB1dFF1ZXVlZENvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgdXNlUmVtb3RlU2Vzc2lvbiB9IGZyb20gJy4uL2hvb2tzL3VzZVJlbW90ZVNlc3Npb24uanMnXG5pbXBvcnQgeyB1c2VEaXJlY3RDb25uZWN0IH0gZnJvbSAnLi4vaG9va3MvdXNlRGlyZWN0Q29ubmVjdC5qcydcbmltcG9ydCB0eXBlIHsgRGlyZWN0Q29ubmVjdENvbmZpZyB9IGZyb20gJy4uL3NlcnZlci9kaXJlY3RDb25uZWN0TWFuYWdlci5qcydcbmltcG9ydCB7IHVzZVNTSFNlc3Npb24gfSBmcm9tICcuLi9ob29rcy91c2VTU0hTZXNzaW9uLmpzJ1xuaW1wb3J0IHsgdXNlQXNzaXN0YW50SGlzdG9yeSB9IGZyb20gJy4uL2hvb2tzL3VzZUFzc2lzdGFudEhpc3RvcnkuanMnXG5pbXBvcnQgdHlwZSB7IFNTSFNlc3Npb24gfSBmcm9tICcuLi9zc2gvY3JlYXRlU1NIU2Vzc2lvbi5qcydcbmltcG9ydCB7IFNraWxsSW1wcm92ZW1lbnRTdXJ2ZXkgfSBmcm9tICcuLi9jb21wb25lbnRzL1NraWxsSW1wcm92ZW1lbnRTdXJ2ZXkuanMnXG5pbXBvcnQgeyB1c2VTa2lsbEltcHJvdmVtZW50U3VydmV5IH0gZnJvbSAnLi4vaG9va3MvdXNlU2tpbGxJbXByb3ZlbWVudFN1cnZleS5qcydcbmltcG9ydCB7IHVzZU1vcmVSaWdodCB9IGZyb20gJy4uL21vcmVyaWdodC91c2VNb3JlUmlnaHQuanMnXG5pbXBvcnQge1xuICBTcGlubmVyV2l0aFZlcmIsXG4gIEJyaWVmSWRsZVN0YXR1cyxcbiAgdHlwZSBTcGlubmVyTW9kZSxcbn0gZnJvbSAnLi4vY29tcG9uZW50cy9TcGlubmVyLmpzJ1xuaW1wb3J0IHsgZ2V0U3lzdGVtUHJvbXB0IH0gZnJvbSAnLi4vY29uc3RhbnRzL3Byb21wdHMuanMnXG5pbXBvcnQgeyBidWlsZEVmZmVjdGl2ZVN5c3RlbVByb21wdCB9IGZyb20gJy4uL3V0aWxzL3N5c3RlbVByb21wdC5qcydcbmltcG9ydCB7IGdldFN5c3RlbUNvbnRleHQsIGdldFVzZXJDb250ZXh0IH0gZnJvbSAnLi4vY29udGV4dC5qcydcbmltcG9ydCB7IGdldE1lbW9yeUZpbGVzIH0gZnJvbSAnLi4vdXRpbHMvY2xhdWRlbWQuanMnXG5pbXBvcnQgeyBzdGFydEJhY2tncm91bmRIb3VzZWtlZXBpbmcgfSBmcm9tICcuLi91dGlscy9iYWNrZ3JvdW5kSG91c2VrZWVwaW5nLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0VG90YWxDb3N0LFxuICBzYXZlQ3VycmVudFNlc3Npb25Db3N0cyxcbiAgcmVzZXRDb3N0U3RhdGUsXG4gIGdldFN0b3JlZFNlc3Npb25Db3N0cyxcbn0gZnJvbSAnLi4vY29zdC10cmFja2VyLmpzJ1xuaW1wb3J0IHsgdXNlQ29zdFN1bW1hcnkgfSBmcm9tICcuLi9jb3N0SG9vay5qcydcbmltcG9ydCB7IHVzZUZwc01ldHJpY3MgfSBmcm9tICcuLi9jb250ZXh0L2Zwc01ldHJpY3MuanMnXG5pbXBvcnQgeyB1c2VBZnRlckZpcnN0UmVuZGVyIH0gZnJvbSAnLi4vaG9va3MvdXNlQWZ0ZXJGaXJzdFJlbmRlci5qcydcbmltcG9ydCB7IHVzZURlZmVycmVkSG9va01lc3NhZ2VzIH0gZnJvbSAnLi4vaG9va3MvdXNlRGVmZXJyZWRIb29rTWVzc2FnZXMuanMnXG5pbXBvcnQge1xuICBhZGRUb0hpc3RvcnksXG4gIHJlbW92ZUxhc3RGcm9tSGlzdG9yeSxcbiAgZXhwYW5kUGFzdGVkVGV4dFJlZnMsXG4gIHBhcnNlUmVmZXJlbmNlcyxcbn0gZnJvbSAnLi4vaGlzdG9yeS5qcydcbmltcG9ydCB7IHByZXBlbmRNb2RlQ2hhcmFjdGVyVG9JbnB1dCB9IGZyb20gJy4uL2NvbXBvbmVudHMvUHJvbXB0SW5wdXQvaW5wdXRNb2Rlcy5qcydcbmltcG9ydCB7IHByZXBlbmRUb1NoZWxsSGlzdG9yeUNhY2hlIH0gZnJvbSAnLi4vdXRpbHMvc3VnZ2VzdGlvbnMvc2hlbGxIaXN0b3J5Q29tcGxldGlvbi5qcydcbmltcG9ydCB7IHVzZUFwaUtleVZlcmlmaWNhdGlvbiB9IGZyb20gJy4uL2hvb2tzL3VzZUFwaUtleVZlcmlmaWNhdGlvbi5qcydcbmltcG9ydCB7IEdsb2JhbEtleWJpbmRpbmdIYW5kbGVycyB9IGZyb20gJy4uL2hvb2tzL3VzZUdsb2JhbEtleWJpbmRpbmdzLmpzJ1xuaW1wb3J0IHsgQ29tbWFuZEtleWJpbmRpbmdIYW5kbGVycyB9IGZyb20gJy4uL2hvb2tzL3VzZUNvbW1hbmRLZXliaW5kaW5ncy5qcydcbmltcG9ydCB7IEtleWJpbmRpbmdTZXR1cCB9IGZyb20gJy4uL2tleWJpbmRpbmdzL0tleWJpbmRpbmdQcm92aWRlclNldHVwLmpzJ1xuaW1wb3J0IHsgdXNlU2hvcnRjdXREaXNwbGF5IH0gZnJvbSAnLi4va2V5YmluZGluZ3MvdXNlU2hvcnRjdXREaXNwbGF5LmpzJ1xuaW1wb3J0IHsgZ2V0U2hvcnRjdXREaXNwbGF5IH0gZnJvbSAnLi4va2V5YmluZGluZ3Mvc2hvcnRjdXRGb3JtYXQuanMnXG5pbXBvcnQgeyBDYW5jZWxSZXF1ZXN0SGFuZGxlciB9IGZyb20gJy4uL2hvb2tzL3VzZUNhbmNlbFJlcXVlc3QuanMnXG5pbXBvcnQgeyB1c2VCYWNrZ3JvdW5kVGFza05hdmlnYXRpb24gfSBmcm9tICcuLi9ob29rcy91c2VCYWNrZ3JvdW5kVGFza05hdmlnYXRpb24uanMnXG5pbXBvcnQgeyB1c2VTd2FybUluaXRpYWxpemF0aW9uIH0gZnJvbSAnLi4vaG9va3MvdXNlU3dhcm1Jbml0aWFsaXphdGlvbi5qcydcbmltcG9ydCB7IHVzZVRlYW1tYXRlVmlld0F1dG9FeGl0IH0gZnJvbSAnLi4vaG9va3MvdXNlVGVhbW1hdGVWaWV3QXV0b0V4aXQuanMnXG5pbXBvcnQgeyBlcnJvck1lc3NhZ2UgfSBmcm9tICcuLi91dGlscy9lcnJvcnMuanMnXG5pbXBvcnQgeyBpc0h1bWFuVHVybiB9IGZyb20gJy4uL3V0aWxzL21lc3NhZ2VQcmVkaWNhdGVzLmpzJ1xuaW1wb3J0IHsgbG9nRXJyb3IgfSBmcm9tICcuLi91dGlscy9sb2cuanMnXG4vLyBEZWFkIGNvZGUgZWxpbWluYXRpb246IGNvbmRpdGlvbmFsIGltcG9ydHNcbi8qIGVzbGludC1kaXNhYmxlIGN1c3RvbS1ydWxlcy9uby1wcm9jZXNzLWVudi10b3AtbGV2ZWwsIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmNvbnN0IHVzZVZvaWNlSW50ZWdyYXRpb246IHR5cGVvZiBpbXBvcnQoJy4uL2hvb2tzL3VzZVZvaWNlSW50ZWdyYXRpb24uanMnKS51c2VWb2ljZUludGVncmF0aW9uID1cbiAgZmVhdHVyZSgnVk9JQ0VfTU9ERScpXG4gICAgPyByZXF1aXJlKCcuLi9ob29rcy91c2VWb2ljZUludGVncmF0aW9uLmpzJykudXNlVm9pY2VJbnRlZ3JhdGlvblxuICAgIDogKCkgPT4gKHtcbiAgICAgICAgc3RyaXBUcmFpbGluZzogKCkgPT4gMCxcbiAgICAgICAgaGFuZGxlS2V5RXZlbnQ6ICgpID0+IHt9LFxuICAgICAgICByZXNldEFuY2hvcjogKCkgPT4ge30sXG4gICAgICB9KVxuY29uc3QgVm9pY2VLZXliaW5kaW5nSGFuZGxlcjogdHlwZW9mIGltcG9ydCgnLi4vaG9va3MvdXNlVm9pY2VJbnRlZ3JhdGlvbi5qcycpLlZvaWNlS2V5YmluZGluZ0hhbmRsZXIgPVxuICBmZWF0dXJlKCdWT0lDRV9NT0RFJylcbiAgICA/IHJlcXVpcmUoJy4uL2hvb2tzL3VzZVZvaWNlSW50ZWdyYXRpb24uanMnKS5Wb2ljZUtleWJpbmRpbmdIYW5kbGVyXG4gICAgOiAoKSA9PiBudWxsXG4vLyBGcnVzdHJhdGlvbiBkZXRlY3Rpb24gaXMgYW50LW9ubHkgKGRvZ2Zvb2RpbmcpLiBDb25kaXRpb25hbCByZXF1aXJlIHNvIGV4dGVybmFsXG4vLyBidWlsZHMgZWxpbWluYXRlIHRoZSBtb2R1bGUgZW50aXJlbHkgKGluY2x1ZGluZyBpdHMgdHdvIE8obikgdXNlTWVtb3MgdGhhdCBydW5cbi8vIG9uIGV2ZXJ5IG1lc3NhZ2VzIGNoYW5nZSwgcGx1cyB0aGUgR3Jvd3RoQm9vayBmZXRjaCkuXG5jb25zdCB1c2VGcnVzdHJhdGlvbkRldGVjdGlvbjogdHlwZW9mIGltcG9ydCgnLi4vY29tcG9uZW50cy9GZWVkYmFja1N1cnZleS91c2VGcnVzdHJhdGlvbkRldGVjdGlvbi5qcycpLnVzZUZydXN0cmF0aW9uRGV0ZWN0aW9uID1cbiAgXCJleHRlcm5hbFwiID09PSAnYW50J1xuICAgID8gcmVxdWlyZSgnLi4vY29tcG9uZW50cy9GZWVkYmFja1N1cnZleS91c2VGcnVzdHJhdGlvbkRldGVjdGlvbi5qcycpXG4gICAgICAgIC51c2VGcnVzdHJhdGlvbkRldGVjdGlvblxuICAgIDogKCkgPT4gKHsgc3RhdGU6ICdjbG9zZWQnLCBoYW5kbGVUcmFuc2NyaXB0U2VsZWN0OiAoKSA9PiB7fSB9KVxuLy8gQW50LW9ubHkgb3JnIHdhcm5pbmcuIENvbmRpdGlvbmFsIHJlcXVpcmUgc28gdGhlIG9yZyBVVUlEIGxpc3QgaXNcbi8vIGVsaW1pbmF0ZWQgZnJvbSBleHRlcm5hbCBidWlsZHMgKG9uZSBVVUlEIGlzIG9uIGV4Y2x1ZGVkLXN0cmluZ3MpLlxuY29uc3QgdXNlQW50T3JnV2FybmluZ05vdGlmaWNhdGlvbjogdHlwZW9mIGltcG9ydCgnLi4vaG9va3Mvbm90aWZzL3VzZUFudE9yZ1dhcm5pbmdOb3RpZmljYXRpb24uanMnKS51c2VBbnRPcmdXYXJuaW5nTm90aWZpY2F0aW9uID1cbiAgXCJleHRlcm5hbFwiID09PSAnYW50J1xuICAgID8gcmVxdWlyZSgnLi4vaG9va3Mvbm90aWZzL3VzZUFudE9yZ1dhcm5pbmdOb3RpZmljYXRpb24uanMnKVxuICAgICAgICAudXNlQW50T3JnV2FybmluZ05vdGlmaWNhdGlvblxuICAgIDogKCkgPT4ge31cbi8vIERlYWQgY29kZSBlbGltaW5hdGlvbjogY29uZGl0aW9uYWwgaW1wb3J0IGZvciBjb29yZGluYXRvciBtb2RlXG5jb25zdCBnZXRDb29yZGluYXRvclVzZXJDb250ZXh0OiAoXG4gIG1jcENsaWVudHM6IFJlYWRvbmx5QXJyYXk8eyBuYW1lOiBzdHJpbmcgfT4sXG4gIHNjcmF0Y2hwYWREaXI/OiBzdHJpbmcsXG4pID0+IHsgW2s6IHN0cmluZ106IHN0cmluZyB9ID0gZmVhdHVyZSgnQ09PUkRJTkFUT1JfTU9ERScpXG4gID8gcmVxdWlyZSgnLi4vY29vcmRpbmF0b3IvY29vcmRpbmF0b3JNb2RlLmpzJykuZ2V0Q29vcmRpbmF0b3JVc2VyQ29udGV4dFxuICA6ICgpID0+ICh7fSlcbi8qIGVzbGludC1lbmFibGUgY3VzdG9tLXJ1bGVzL25vLXByb2Nlc3MtZW52LXRvcC1sZXZlbCwgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuaW1wb3J0IHVzZUNhblVzZVRvb2wgZnJvbSAnLi4vaG9va3MvdXNlQ2FuVXNlVG9vbC5qcydcbmltcG9ydCB0eXBlIHsgVG9vbFBlcm1pc3Npb25Db250ZXh0LCBUb29sIH0gZnJvbSAnLi4vVG9vbC5qcydcbmltcG9ydCB7XG4gIGFwcGx5UGVybWlzc2lvblVwZGF0ZSxcbiAgYXBwbHlQZXJtaXNzaW9uVXBkYXRlcyxcbiAgcGVyc2lzdFBlcm1pc3Npb25VcGRhdGUsXG59IGZyb20gJy4uL3V0aWxzL3Blcm1pc3Npb25zL1Blcm1pc3Npb25VcGRhdGUuanMnXG5pbXBvcnQgeyBidWlsZFBlcm1pc3Npb25VcGRhdGVzIH0gZnJvbSAnLi4vY29tcG9uZW50cy9wZXJtaXNzaW9ucy9FeGl0UGxhbk1vZGVQZXJtaXNzaW9uUmVxdWVzdC9FeGl0UGxhbk1vZGVQZXJtaXNzaW9uUmVxdWVzdC5qcydcbmltcG9ydCB7IHN0cmlwRGFuZ2Vyb3VzUGVybWlzc2lvbnNGb3JBdXRvTW9kZSB9IGZyb20gJy4uL3V0aWxzL3Blcm1pc3Npb25zL3Blcm1pc3Npb25TZXR1cC5qcydcbmltcG9ydCB7XG4gIGdldFNjcmF0Y2hwYWREaXIsXG4gIGlzU2NyYXRjaHBhZEVuYWJsZWQsXG59IGZyb20gJy4uL3V0aWxzL3Blcm1pc3Npb25zL2ZpbGVzeXN0ZW0uanMnXG5pbXBvcnQgeyBXRUJfRkVUQ0hfVE9PTF9OQU1FIH0gZnJvbSAnLi4vdG9vbHMvV2ViRmV0Y2hUb29sL3Byb21wdC5qcydcbmltcG9ydCB7IFNMRUVQX1RPT0xfTkFNRSB9IGZyb20gJy4uL3Rvb2xzL1NsZWVwVG9vbC9wcm9tcHQuanMnXG5pbXBvcnQgeyBjbGVhclNwZWN1bGF0aXZlQ2hlY2tzIH0gZnJvbSAnLi4vdG9vbHMvQmFzaFRvb2wvYmFzaFBlcm1pc3Npb25zLmpzJ1xuaW1wb3J0IHR5cGUgeyBBdXRvVXBkYXRlclJlc3VsdCB9IGZyb20gJy4uL3V0aWxzL2F1dG9VcGRhdGVyLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0R2xvYmFsQ29uZmlnLFxuICBzYXZlR2xvYmFsQ29uZmlnLFxuICBnZXRHbG9iYWxDb25maWdXcml0ZUNvdW50LFxufSBmcm9tICcuLi91dGlscy9jb25maWcuanMnXG5pbXBvcnQgeyBoYXNDb25zb2xlQmlsbGluZ0FjY2VzcyB9IGZyb20gJy4uL3V0aWxzL2JpbGxpbmcuanMnXG5pbXBvcnQge1xuICBsb2dFdmVudCxcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxufSBmcm9tICdzcmMvc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJ1xuaW1wb3J0IHsgZ2V0RmVhdHVyZVZhbHVlX0NBQ0hFRF9NQVlfQkVfU1RBTEUgfSBmcm9tICdzcmMvc2VydmljZXMvYW5hbHl0aWNzL2dyb3d0aGJvb2suanMnXG5pbXBvcnQge1xuICB0ZXh0Rm9yUmVzdWJtaXQsXG4gIGhhbmRsZU1lc3NhZ2VGcm9tU3RyZWFtLFxuICB0eXBlIFN0cmVhbWluZ1Rvb2xVc2UsXG4gIHR5cGUgU3RyZWFtaW5nVGhpbmtpbmcsXG4gIGlzQ29tcGFjdEJvdW5kYXJ5TWVzc2FnZSxcbiAgZ2V0TWVzc2FnZXNBZnRlckNvbXBhY3RCb3VuZGFyeSxcbiAgZ2V0Q29udGVudFRleHQsXG4gIGNyZWF0ZVVzZXJNZXNzYWdlLFxuICBjcmVhdGVBc3Npc3RhbnRNZXNzYWdlLFxuICBjcmVhdGVUdXJuRHVyYXRpb25NZXNzYWdlLFxuICBjcmVhdGVBZ2VudHNLaWxsZWRNZXNzYWdlLFxuICBjcmVhdGVBcGlNZXRyaWNzTWVzc2FnZSxcbiAgY3JlYXRlU3lzdGVtTWVzc2FnZSxcbiAgY3JlYXRlQ29tbWFuZElucHV0TWVzc2FnZSxcbiAgZm9ybWF0Q29tbWFuZElucHV0VGFncyxcbn0gZnJvbSAnLi4vdXRpbHMvbWVzc2FnZXMuanMnXG5pbXBvcnQgeyBnZW5lcmF0ZVNlc3Npb25UaXRsZSB9IGZyb20gJy4uL3V0aWxzL3Nlc3Npb25UaXRsZS5qcydcbmltcG9ydCB7XG4gIEJBU0hfSU5QVVRfVEFHLFxuICBDT01NQU5EX01FU1NBR0VfVEFHLFxuICBDT01NQU5EX05BTUVfVEFHLFxuICBMT0NBTF9DT01NQU5EX1NURE9VVF9UQUcsXG59IGZyb20gJy4uL2NvbnN0YW50cy94bWwuanMnXG5pbXBvcnQgeyBlc2NhcGVYbWwgfSBmcm9tICcuLi91dGlscy94bWwuanMnXG5pbXBvcnQgdHlwZSB7IFRoaW5raW5nQ29uZmlnIH0gZnJvbSAnLi4vdXRpbHMvdGhpbmtpbmcuanMnXG5pbXBvcnQgeyBncmFjZWZ1bFNodXRkb3duU3luYyB9IGZyb20gJy4uL3V0aWxzL2dyYWNlZnVsU2h1dGRvd24uanMnXG5pbXBvcnQge1xuICBoYW5kbGVQcm9tcHRTdWJtaXQsXG4gIHR5cGUgUHJvbXB0SW5wdXRIZWxwZXJzLFxufSBmcm9tICcuLi91dGlscy9oYW5kbGVQcm9tcHRTdWJtaXQuanMnXG5pbXBvcnQgeyB1c2VRdWV1ZVByb2Nlc3NvciB9IGZyb20gJy4uL2hvb2tzL3VzZVF1ZXVlUHJvY2Vzc29yLmpzJ1xuaW1wb3J0IHsgdXNlTWFpbGJveEJyaWRnZSB9IGZyb20gJy4uL2hvb2tzL3VzZU1haWxib3hCcmlkZ2UuanMnXG5pbXBvcnQge1xuICBxdWVyeUNoZWNrcG9pbnQsXG4gIGxvZ1F1ZXJ5UHJvZmlsZVJlcG9ydCxcbn0gZnJvbSAnLi4vdXRpbHMvcXVlcnlQcm9maWxlci5qcydcbmltcG9ydCB0eXBlIHtcbiAgTWVzc2FnZSBhcyBNZXNzYWdlVHlwZSxcbiAgVXNlck1lc3NhZ2UsXG4gIFByb2dyZXNzTWVzc2FnZSxcbiAgSG9va1Jlc3VsdE1lc3NhZ2UsXG4gIFBhcnRpYWxDb21wYWN0RGlyZWN0aW9uLFxufSBmcm9tICcuLi90eXBlcy9tZXNzYWdlLmpzJ1xuaW1wb3J0IHsgcXVlcnkgfSBmcm9tICcuLi9xdWVyeS5qcydcbmltcG9ydCB7IG1lcmdlQ2xpZW50cywgdXNlTWVyZ2VkQ2xpZW50cyB9IGZyb20gJy4uL2hvb2tzL3VzZU1lcmdlZENsaWVudHMuanMnXG5pbXBvcnQgeyBnZXRRdWVyeVNvdXJjZUZvclJFUEwgfSBmcm9tICcuLi91dGlscy9wcm9tcHRDYXRlZ29yeS5qcydcbmltcG9ydCB7IHVzZU1lcmdlZFRvb2xzIH0gZnJvbSAnLi4vaG9va3MvdXNlTWVyZ2VkVG9vbHMuanMnXG5pbXBvcnQgeyBtZXJnZUFuZEZpbHRlclRvb2xzIH0gZnJvbSAnLi4vdXRpbHMvdG9vbFBvb2wuanMnXG5pbXBvcnQgeyB1c2VNZXJnZWRDb21tYW5kcyB9IGZyb20gJy4uL2hvb2tzL3VzZU1lcmdlZENvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgdXNlU2tpbGxzQ2hhbmdlIH0gZnJvbSAnLi4vaG9va3MvdXNlU2tpbGxzQ2hhbmdlLmpzJ1xuaW1wb3J0IHsgdXNlTWFuYWdlUGx1Z2lucyB9IGZyb20gJy4uL2hvb2tzL3VzZU1hbmFnZVBsdWdpbnMuanMnXG5pbXBvcnQgeyBNZXNzYWdlcyB9IGZyb20gJy4uL2NvbXBvbmVudHMvTWVzc2FnZXMuanMnXG5pbXBvcnQgeyBUYXNrTGlzdFYyIH0gZnJvbSAnLi4vY29tcG9uZW50cy9UYXNrTGlzdFYyLmpzJ1xuaW1wb3J0IHsgVGVhbW1hdGVWaWV3SGVhZGVyIH0gZnJvbSAnLi4vY29tcG9uZW50cy9UZWFtbWF0ZVZpZXdIZWFkZXIuanMnXG5pbXBvcnQgeyB1c2VUYXNrc1YyV2l0aENvbGxhcHNlRWZmZWN0IH0gZnJvbSAnLi4vaG9va3MvdXNlVGFza3NWMi5qcydcbmltcG9ydCB7IG1heWJlTWFya1Byb2plY3RPbmJvYXJkaW5nQ29tcGxldGUgfSBmcm9tICcuLi9wcm9qZWN0T25ib2FyZGluZ1N0YXRlLmpzJ1xuaW1wb3J0IHR5cGUgeyBNQ1BTZXJ2ZXJDb25uZWN0aW9uIH0gZnJvbSAnLi4vc2VydmljZXMvbWNwL3R5cGVzLmpzJ1xuaW1wb3J0IHR5cGUgeyBTY29wZWRNY3BTZXJ2ZXJDb25maWcgfSBmcm9tICcuLi9zZXJ2aWNlcy9tY3AvdHlwZXMuanMnXG5pbXBvcnQgeyByYW5kb21VVUlELCB0eXBlIFVVSUQgfSBmcm9tICdjcnlwdG8nXG5pbXBvcnQgeyBwcm9jZXNzU2Vzc2lvblN0YXJ0SG9va3MgfSBmcm9tICcuLi91dGlscy9zZXNzaW9uU3RhcnQuanMnXG5pbXBvcnQge1xuICBleGVjdXRlU2Vzc2lvbkVuZEhvb2tzLFxuICBnZXRTZXNzaW9uRW5kSG9va1RpbWVvdXRNcyxcbn0gZnJvbSAnLi4vdXRpbHMvaG9va3MuanMnXG5pbXBvcnQgeyB0eXBlIElERVNlbGVjdGlvbiwgdXNlSWRlU2VsZWN0aW9uIH0gZnJvbSAnLi4vaG9va3MvdXNlSWRlU2VsZWN0aW9uLmpzJ1xuaW1wb3J0IHsgZ2V0VG9vbHMsIGFzc2VtYmxlVG9vbFBvb2wgfSBmcm9tICcuLi90b29scy5qcydcbmltcG9ydCB0eXBlIHsgQWdlbnREZWZpbml0aW9uIH0gZnJvbSAnLi4vdG9vbHMvQWdlbnRUb29sL2xvYWRBZ2VudHNEaXIuanMnXG5pbXBvcnQgeyByZXNvbHZlQWdlbnRUb29scyB9IGZyb20gJy4uL3Rvb2xzL0FnZW50VG9vbC9hZ2VudFRvb2xVdGlscy5qcydcbmltcG9ydCB7IHJlc3VtZUFnZW50QmFja2dyb3VuZCB9IGZyb20gJy4uL3Rvb2xzL0FnZW50VG9vbC9yZXN1bWVBZ2VudC5qcydcbmltcG9ydCB7IHVzZU1haW5Mb29wTW9kZWwgfSBmcm9tICcuLi9ob29rcy91c2VNYWluTG9vcE1vZGVsLmpzJ1xuaW1wb3J0IHtcbiAgdXNlQXBwU3RhdGUsXG4gIHVzZVNldEFwcFN0YXRlLFxuICB1c2VBcHBTdGF0ZVN0b3JlLFxufSBmcm9tICcuLi9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB0eXBlIHtcbiAgQ29udGVudEJsb2NrUGFyYW0sXG4gIEltYWdlQmxvY2tQYXJhbSxcbn0gZnJvbSAnQGFudGhyb3BpYy1haS9zZGsvcmVzb3VyY2VzL21lc3NhZ2VzLm1qcydcbmltcG9ydCB0eXBlIHsgUHJvY2Vzc1VzZXJJbnB1dENvbnRleHQgfSBmcm9tICcuLi91dGlscy9wcm9jZXNzVXNlcklucHV0L3Byb2Nlc3NVc2VySW5wdXQuanMnXG5pbXBvcnQgdHlwZSB7IFBhc3RlZENvbnRlbnQgfSBmcm9tICcuLi91dGlscy9jb25maWcuanMnXG5pbXBvcnQge1xuICBjb3B5UGxhbkZvckZvcmssXG4gIGNvcHlQbGFuRm9yUmVzdW1lLFxuICBnZXRQbGFuU2x1ZyxcbiAgc2V0UGxhblNsdWcsXG59IGZyb20gJy4uL3V0aWxzL3BsYW5zLmpzJ1xuaW1wb3J0IHtcbiAgY2xlYXJTZXNzaW9uTWV0YWRhdGEsXG4gIHJlc2V0U2Vzc2lvbkZpbGVQb2ludGVyLFxuICBhZG9wdFJlc3VtZWRTZXNzaW9uRmlsZSxcbiAgcmVtb3ZlVHJhbnNjcmlwdE1lc3NhZ2UsXG4gIHJlc3RvcmVTZXNzaW9uTWV0YWRhdGEsXG4gIGdldEN1cnJlbnRTZXNzaW9uVGl0bGUsXG4gIGlzRXBoZW1lcmFsVG9vbFByb2dyZXNzLFxuICBpc0xvZ2dhYmxlTWVzc2FnZSxcbiAgc2F2ZVdvcmt0cmVlU3RhdGUsXG4gIGdldEFnZW50VHJhbnNjcmlwdCxcbn0gZnJvbSAnLi4vdXRpbHMvc2Vzc2lvblN0b3JhZ2UuanMnXG5pbXBvcnQgeyBkZXNlcmlhbGl6ZU1lc3NhZ2VzIH0gZnJvbSAnLi4vdXRpbHMvY29udmVyc2F0aW9uUmVjb3ZlcnkuanMnXG5pbXBvcnQge1xuICBleHRyYWN0UmVhZEZpbGVzRnJvbU1lc3NhZ2VzLFxuICBleHRyYWN0QmFzaFRvb2xzRnJvbU1lc3NhZ2VzLFxufSBmcm9tICcuLi91dGlscy9xdWVyeUhlbHBlcnMuanMnXG5pbXBvcnQgeyByZXNldE1pY3JvY29tcGFjdFN0YXRlIH0gZnJvbSAnLi4vc2VydmljZXMvY29tcGFjdC9taWNyb0NvbXBhY3QuanMnXG5pbXBvcnQgeyBydW5Qb3N0Q29tcGFjdENsZWFudXAgfSBmcm9tICcuLi9zZXJ2aWNlcy9jb21wYWN0L3Bvc3RDb21wYWN0Q2xlYW51cC5qcydcbmltcG9ydCB7XG4gIHByb3Zpc2lvbkNvbnRlbnRSZXBsYWNlbWVudFN0YXRlLFxuICByZWNvbnN0cnVjdENvbnRlbnRSZXBsYWNlbWVudFN0YXRlLFxuICB0eXBlIENvbnRlbnRSZXBsYWNlbWVudFJlY29yZCxcbn0gZnJvbSAnLi4vdXRpbHMvdG9vbFJlc3VsdFN0b3JhZ2UuanMnXG5pbXBvcnQgeyBwYXJ0aWFsQ29tcGFjdENvbnZlcnNhdGlvbiB9IGZyb20gJy4uL3NlcnZpY2VzL2NvbXBhY3QvY29tcGFjdC5qcydcbmltcG9ydCB0eXBlIHsgTG9nT3B0aW9uIH0gZnJvbSAnLi4vdHlwZXMvbG9ncy5qcydcbmltcG9ydCB0eXBlIHsgQWdlbnRDb2xvck5hbWUgfSBmcm9tICcuLi90b29scy9BZ2VudFRvb2wvYWdlbnRDb2xvck1hbmFnZXIuanMnXG5pbXBvcnQge1xuICBmaWxlSGlzdG9yeU1ha2VTbmFwc2hvdCxcbiAgdHlwZSBGaWxlSGlzdG9yeVN0YXRlLFxuICBmaWxlSGlzdG9yeVJld2luZCxcbiAgdHlwZSBGaWxlSGlzdG9yeVNuYXBzaG90LFxuICBjb3B5RmlsZUhpc3RvcnlGb3JSZXN1bWUsXG4gIGZpbGVIaXN0b3J5RW5hYmxlZCxcbiAgZmlsZUhpc3RvcnlIYXNBbnlDaGFuZ2VzLFxufSBmcm9tICcuLi91dGlscy9maWxlSGlzdG9yeS5qcydcbmltcG9ydCB7XG4gIHR5cGUgQXR0cmlidXRpb25TdGF0ZSxcbiAgaW5jcmVtZW50UHJvbXB0Q291bnQsXG59IGZyb20gJy4uL3V0aWxzL2NvbW1pdEF0dHJpYnV0aW9uLmpzJ1xuaW1wb3J0IHsgcmVjb3JkQXR0cmlidXRpb25TbmFwc2hvdCB9IGZyb20gJy4uL3V0aWxzL3Nlc3Npb25TdG9yYWdlLmpzJ1xuaW1wb3J0IHtcbiAgY29tcHV0ZVN0YW5kYWxvbmVBZ2VudENvbnRleHQsXG4gIHJlc3RvcmVBZ2VudEZyb21TZXNzaW9uLFxuICByZXN0b3JlU2Vzc2lvblN0YXRlRnJvbUxvZyxcbiAgcmVzdG9yZVdvcmt0cmVlRm9yUmVzdW1lLFxuICBleGl0UmVzdG9yZWRXb3JrdHJlZSxcbn0gZnJvbSAnLi4vdXRpbHMvc2Vzc2lvblJlc3RvcmUuanMnXG5pbXBvcnQge1xuICBpc0JnU2Vzc2lvbixcbiAgdXBkYXRlU2Vzc2lvbk5hbWUsXG4gIHVwZGF0ZVNlc3Npb25BY3Rpdml0eSxcbn0gZnJvbSAnLi4vdXRpbHMvY29uY3VycmVudFNlc3Npb25zLmpzJ1xuaW1wb3J0IHtcbiAgaXNJblByb2Nlc3NUZWFtbWF0ZVRhc2ssXG4gIHR5cGUgSW5Qcm9jZXNzVGVhbW1hdGVUYXNrU3RhdGUsXG59IGZyb20gJy4uL3Rhc2tzL0luUHJvY2Vzc1RlYW1tYXRlVGFzay90eXBlcy5qcydcbmltcG9ydCB7IHJlc3RvcmVSZW1vdGVBZ2VudFRhc2tzIH0gZnJvbSAnLi4vdGFza3MvUmVtb3RlQWdlbnRUYXNrL1JlbW90ZUFnZW50VGFzay5qcydcbmltcG9ydCB7IHVzZUluYm94UG9sbGVyIH0gZnJvbSAnLi4vaG9va3MvdXNlSW5ib3hQb2xsZXIuanMnXG4vLyBEZWFkIGNvZGUgZWxpbWluYXRpb246IGNvbmRpdGlvbmFsIGltcG9ydCBmb3IgbG9vcCBtb2RlXG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5jb25zdCBwcm9hY3RpdmVNb2R1bGUgPVxuICBmZWF0dXJlKCdQUk9BQ1RJVkUnKSB8fCBmZWF0dXJlKCdLQUlST1MnKVxuICAgID8gcmVxdWlyZSgnLi4vcHJvYWN0aXZlL2luZGV4LmpzJylcbiAgICA6IG51bGxcbmNvbnN0IFBST0FDVElWRV9OT19PUF9TVUJTQ1JJQkUgPSAoX2NiOiAoKSA9PiB2b2lkKSA9PiAoKSA9PiB7fVxuY29uc3QgUFJPQUNUSVZFX0ZBTFNFID0gKCkgPT4gZmFsc2VcbmNvbnN0IFNVR0dFU1RfQkdfUFJfTk9PUCA9IChfcDogc3RyaW5nLCBfbjogc3RyaW5nKTogYm9vbGVhbiA9PiBmYWxzZVxuY29uc3QgdXNlUHJvYWN0aXZlID1cbiAgZmVhdHVyZSgnUFJPQUNUSVZFJykgfHwgZmVhdHVyZSgnS0FJUk9TJylcbiAgICA/IHJlcXVpcmUoJy4uL3Byb2FjdGl2ZS91c2VQcm9hY3RpdmUuanMnKS51c2VQcm9hY3RpdmVcbiAgICA6IG51bGxcbmNvbnN0IHVzZVNjaGVkdWxlZFRhc2tzID0gZmVhdHVyZSgnQUdFTlRfVFJJR0dFUlMnKVxuICA/IHJlcXVpcmUoJy4uL2hvb2tzL3VzZVNjaGVkdWxlZFRhc2tzLmpzJykudXNlU2NoZWR1bGVkVGFza3NcbiAgOiBudWxsXG4vKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmltcG9ydCB7IGlzQWdlbnRTd2FybXNFbmFibGVkIH0gZnJvbSAnLi4vdXRpbHMvYWdlbnRTd2FybXNFbmFibGVkLmpzJ1xuaW1wb3J0IHsgdXNlVGFza0xpc3RXYXRjaGVyIH0gZnJvbSAnLi4vaG9va3MvdXNlVGFza0xpc3RXYXRjaGVyLmpzJ1xuaW1wb3J0IHR5cGUge1xuICBTYW5kYm94QXNrQ2FsbGJhY2ssXG4gIE5ldHdvcmtIb3N0UGF0dGVybixcbn0gZnJvbSAnLi4vdXRpbHMvc2FuZGJveC9zYW5kYm94LWFkYXB0ZXIuanMnXG5cbmltcG9ydCB7XG4gIHR5cGUgSURFRXh0ZW5zaW9uSW5zdGFsbGF0aW9uU3RhdHVzLFxuICBjbG9zZU9wZW5EaWZmcyxcbiAgZ2V0Q29ubmVjdGVkSWRlQ2xpZW50LFxuICB0eXBlIElkZVR5cGUsXG59IGZyb20gJy4uL3V0aWxzL2lkZS5qcydcbmltcG9ydCB7IHVzZUlERUludGVncmF0aW9uIH0gZnJvbSAnLi4vaG9va3MvdXNlSURFSW50ZWdyYXRpb24uanMnXG5pbXBvcnQgZXhpdCBmcm9tICcuLi9jb21tYW5kcy9leGl0L2luZGV4LmpzJ1xuaW1wb3J0IHsgRXhpdEZsb3cgfSBmcm9tICcuLi9jb21wb25lbnRzL0V4aXRGbG93LmpzJ1xuaW1wb3J0IHsgZ2V0Q3VycmVudFdvcmt0cmVlU2Vzc2lvbiB9IGZyb20gJy4uL3V0aWxzL3dvcmt0cmVlLmpzJ1xuaW1wb3J0IHtcbiAgcG9wQWxsRWRpdGFibGUsXG4gIGVucXVldWUsXG4gIHR5cGUgU2V0QXBwU3RhdGUsXG4gIGdldENvbW1hbmRRdWV1ZSxcbiAgZ2V0Q29tbWFuZFF1ZXVlTGVuZ3RoLFxuICByZW1vdmVCeUZpbHRlcixcbn0gZnJvbSAnLi4vdXRpbHMvbWVzc2FnZVF1ZXVlTWFuYWdlci5qcydcbmltcG9ydCB7IHVzZUNvbW1hbmRRdWV1ZSB9IGZyb20gJy4uL2hvb2tzL3VzZUNvbW1hbmRRdWV1ZS5qcydcbmltcG9ydCB7IFNlc3Npb25CYWNrZ3JvdW5kSGludCB9IGZyb20gJy4uL2NvbXBvbmVudHMvU2Vzc2lvbkJhY2tncm91bmRIaW50LmpzJ1xuaW1wb3J0IHsgc3RhcnRCYWNrZ3JvdW5kU2Vzc2lvbiB9IGZyb20gJy4uL3Rhc2tzL0xvY2FsTWFpblNlc3Npb25UYXNrLmpzJ1xuaW1wb3J0IHsgdXNlU2Vzc2lvbkJhY2tncm91bmRpbmcgfSBmcm9tICcuLi9ob29rcy91c2VTZXNzaW9uQmFja2dyb3VuZGluZy5qcydcbmltcG9ydCB7IGRpYWdub3N0aWNUcmFja2VyIH0gZnJvbSAnLi4vc2VydmljZXMvZGlhZ25vc3RpY1RyYWNraW5nLmpzJ1xuaW1wb3J0IHtcbiAgaGFuZGxlU3BlY3VsYXRpb25BY2NlcHQsXG4gIHR5cGUgQWN0aXZlU3BlY3VsYXRpb25TdGF0ZSxcbn0gZnJvbSAnLi4vc2VydmljZXMvUHJvbXB0U3VnZ2VzdGlvbi9zcGVjdWxhdGlvbi5qcydcbmltcG9ydCB7IElkZU9uYm9hcmRpbmdEaWFsb2cgfSBmcm9tICcuLi9jb21wb25lbnRzL0lkZU9uYm9hcmRpbmdEaWFsb2cuanMnXG5pbXBvcnQge1xuICBFZmZvcnRDYWxsb3V0LFxuICBzaG91bGRTaG93RWZmb3J0Q2FsbG91dCxcbn0gZnJvbSAnLi4vY29tcG9uZW50cy9FZmZvcnRDYWxsb3V0LmpzJ1xuaW1wb3J0IHR5cGUgeyBFZmZvcnRWYWx1ZSB9IGZyb20gJy4uL3V0aWxzL2VmZm9ydC5qcydcbmltcG9ydCB7IFJlbW90ZUNhbGxvdXQgfSBmcm9tICcuLi9jb21wb25lbnRzL1JlbW90ZUNhbGxvdXQuanMnXG4vKiBlc2xpbnQtZGlzYWJsZSBjdXN0b20tcnVsZXMvbm8tcHJvY2Vzcy1lbnYtdG9wLWxldmVsLCBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5jb25zdCBBbnRNb2RlbFN3aXRjaENhbGxvdXQgPVxuICBcImV4dGVybmFsXCIgPT09ICdhbnQnXG4gICAgPyByZXF1aXJlKCcuLi9jb21wb25lbnRzL0FudE1vZGVsU3dpdGNoQ2FsbG91dC5qcycpLkFudE1vZGVsU3dpdGNoQ2FsbG91dFxuICAgIDogbnVsbFxuY29uc3Qgc2hvdWxkU2hvd0FudE1vZGVsU3dpdGNoID1cbiAgXCJleHRlcm5hbFwiID09PSAnYW50J1xuICAgID8gcmVxdWlyZSgnLi4vY29tcG9uZW50cy9BbnRNb2RlbFN3aXRjaENhbGxvdXQuanMnKVxuICAgICAgICAuc2hvdWxkU2hvd01vZGVsU3dpdGNoQ2FsbG91dFxuICAgIDogKCk6IGJvb2xlYW4gPT4gZmFsc2VcbmNvbnN0IFVuZGVyY292ZXJBdXRvQ2FsbG91dCA9XG4gIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCdcbiAgICA/IHJlcXVpcmUoJy4uL2NvbXBvbmVudHMvVW5kZXJjb3ZlckF1dG9DYWxsb3V0LmpzJykuVW5kZXJjb3ZlckF1dG9DYWxsb3V0XG4gICAgOiBudWxsXG4vKiBlc2xpbnQtZW5hYmxlIGN1c3RvbS1ydWxlcy9uby1wcm9jZXNzLWVudi10b3AtbGV2ZWwsIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmltcG9ydCB7IGFjdGl2aXR5TWFuYWdlciB9IGZyb20gJy4uL3V0aWxzL2FjdGl2aXR5TWFuYWdlci5qcydcbmltcG9ydCB7IGNyZWF0ZUFib3J0Q29udHJvbGxlciB9IGZyb20gJy4uL3V0aWxzL2Fib3J0Q29udHJvbGxlci5qcydcbmltcG9ydCB7IE1DUENvbm5lY3Rpb25NYW5hZ2VyIH0gZnJvbSAnc3JjL3NlcnZpY2VzL21jcC9NQ1BDb25uZWN0aW9uTWFuYWdlci5qcydcbmltcG9ydCB7IHVzZUZlZWRiYWNrU3VydmV5IH0gZnJvbSAnc3JjL2NvbXBvbmVudHMvRmVlZGJhY2tTdXJ2ZXkvdXNlRmVlZGJhY2tTdXJ2ZXkuanMnXG5pbXBvcnQgeyB1c2VNZW1vcnlTdXJ2ZXkgfSBmcm9tICdzcmMvY29tcG9uZW50cy9GZWVkYmFja1N1cnZleS91c2VNZW1vcnlTdXJ2ZXkuanMnXG5pbXBvcnQgeyB1c2VQb3N0Q29tcGFjdFN1cnZleSB9IGZyb20gJ3NyYy9jb21wb25lbnRzL0ZlZWRiYWNrU3VydmV5L3VzZVBvc3RDb21wYWN0U3VydmV5LmpzJ1xuaW1wb3J0IHsgRmVlZGJhY2tTdXJ2ZXkgfSBmcm9tICdzcmMvY29tcG9uZW50cy9GZWVkYmFja1N1cnZleS9GZWVkYmFja1N1cnZleS5qcydcbmltcG9ydCB7IHVzZUluc3RhbGxNZXNzYWdlcyB9IGZyb20gJ3NyYy9ob29rcy9ub3RpZnMvdXNlSW5zdGFsbE1lc3NhZ2VzLmpzJ1xuaW1wb3J0IHsgdXNlQXdheVN1bW1hcnkgfSBmcm9tICdzcmMvaG9va3MvdXNlQXdheVN1bW1hcnkuanMnXG5pbXBvcnQgeyB1c2VDaHJvbWVFeHRlbnNpb25Ob3RpZmljYXRpb24gfSBmcm9tICdzcmMvaG9va3MvdXNlQ2hyb21lRXh0ZW5zaW9uTm90aWZpY2F0aW9uLmpzJ1xuaW1wb3J0IHsgdXNlT2ZmaWNpYWxNYXJrZXRwbGFjZU5vdGlmaWNhdGlvbiB9IGZyb20gJ3NyYy9ob29rcy91c2VPZmZpY2lhbE1hcmtldHBsYWNlTm90aWZpY2F0aW9uLmpzJ1xuaW1wb3J0IHsgdXNlUHJvbXB0c0Zyb21DbGF1ZGVJbkNocm9tZSB9IGZyb20gJ3NyYy9ob29rcy91c2VQcm9tcHRzRnJvbUNsYXVkZUluQ2hyb21lLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0VGlwVG9TaG93T25TcGlubmVyLFxuICByZWNvcmRTaG93blRpcCxcbn0gZnJvbSAnc3JjL3NlcnZpY2VzL3RpcHMvdGlwU2NoZWR1bGVyLmpzJ1xuaW1wb3J0IHR5cGUgeyBUaGVtZSB9IGZyb20gJ3NyYy91dGlscy90aGVtZS5qcydcbmltcG9ydCB7XG4gIGNoZWNrQW5kRGlzYWJsZUJ5cGFzc1Blcm1pc3Npb25zSWZOZWVkZWQsXG4gIGNoZWNrQW5kRGlzYWJsZUF1dG9Nb2RlSWZOZWVkZWQsXG4gIHVzZUtpY2tPZmZDaGVja0FuZERpc2FibGVCeXBhc3NQZXJtaXNzaW9uc0lmTmVlZGVkLFxuICB1c2VLaWNrT2ZmQ2hlY2tBbmREaXNhYmxlQXV0b01vZGVJZk5lZWRlZCxcbn0gZnJvbSAnc3JjL3V0aWxzL3Blcm1pc3Npb25zL2J5cGFzc1Blcm1pc3Npb25zS2lsbHN3aXRjaC5qcydcbmltcG9ydCB7IFNhbmRib3hNYW5hZ2VyIH0gZnJvbSAnc3JjL3V0aWxzL3NhbmRib3gvc2FuZGJveC1hZGFwdGVyLmpzJ1xuaW1wb3J0IHsgU0FOREJPWF9ORVRXT1JLX0FDQ0VTU19UT09MX05BTUUgfSBmcm9tICdzcmMvY2xpL3N0cnVjdHVyZWRJTy5qcydcbmltcG9ydCB7IHVzZUZpbGVIaXN0b3J5U25hcHNob3RJbml0IH0gZnJvbSAnc3JjL2hvb2tzL3VzZUZpbGVIaXN0b3J5U25hcHNob3RJbml0LmpzJ1xuaW1wb3J0IHsgU2FuZGJveFBlcm1pc3Npb25SZXF1ZXN0IH0gZnJvbSAnc3JjL2NvbXBvbmVudHMvcGVybWlzc2lvbnMvU2FuZGJveFBlcm1pc3Npb25SZXF1ZXN0LmpzJ1xuaW1wb3J0IHsgU2FuZGJveFZpb2xhdGlvbkV4cGFuZGVkVmlldyB9IGZyb20gJ3NyYy9jb21wb25lbnRzL1NhbmRib3hWaW9sYXRpb25FeHBhbmRlZFZpZXcuanMnXG5pbXBvcnQgeyB1c2VTZXR0aW5nc0Vycm9ycyB9IGZyb20gJ3NyYy9ob29rcy9ub3RpZnMvdXNlU2V0dGluZ3NFcnJvcnMuanMnXG5pbXBvcnQgeyB1c2VNY3BDb25uZWN0aXZpdHlTdGF0dXMgfSBmcm9tICdzcmMvaG9va3Mvbm90aWZzL3VzZU1jcENvbm5lY3Rpdml0eVN0YXR1cy5qcydcbmltcG9ydCB7IHVzZUF1dG9Nb2RlVW5hdmFpbGFibGVOb3RpZmljYXRpb24gfSBmcm9tICdzcmMvaG9va3Mvbm90aWZzL3VzZUF1dG9Nb2RlVW5hdmFpbGFibGVOb3RpZmljYXRpb24uanMnXG5pbXBvcnQgeyBBVVRPX01PREVfREVTQ1JJUFRJT04gfSBmcm9tICdzcmMvY29tcG9uZW50cy9BdXRvTW9kZU9wdEluRGlhbG9nLmpzJ1xuaW1wb3J0IHsgdXNlTHNwSW5pdGlhbGl6YXRpb25Ob3RpZmljYXRpb24gfSBmcm9tICdzcmMvaG9va3Mvbm90aWZzL3VzZUxzcEluaXRpYWxpemF0aW9uTm90aWZpY2F0aW9uLmpzJ1xuaW1wb3J0IHsgdXNlTHNwUGx1Z2luUmVjb21tZW5kYXRpb24gfSBmcm9tICdzcmMvaG9va3MvdXNlTHNwUGx1Z2luUmVjb21tZW5kYXRpb24uanMnXG5pbXBvcnQgeyBMc3BSZWNvbW1lbmRhdGlvbk1lbnUgfSBmcm9tICdzcmMvY29tcG9uZW50cy9Mc3BSZWNvbW1lbmRhdGlvbi9Mc3BSZWNvbW1lbmRhdGlvbk1lbnUuanMnXG5pbXBvcnQgeyB1c2VDbGF1ZGVDb2RlSGludFJlY29tbWVuZGF0aW9uIH0gZnJvbSAnc3JjL2hvb2tzL3VzZUNsYXVkZUNvZGVIaW50UmVjb21tZW5kYXRpb24uanMnXG5pbXBvcnQgeyBQbHVnaW5IaW50TWVudSB9IGZyb20gJ3NyYy9jb21wb25lbnRzL0NsYXVkZUNvZGVIaW50L1BsdWdpbkhpbnRNZW51LmpzJ1xuaW1wb3J0IHtcbiAgRGVza3RvcFVwc2VsbFN0YXJ0dXAsXG4gIHNob3VsZFNob3dEZXNrdG9wVXBzZWxsU3RhcnR1cCxcbn0gZnJvbSAnc3JjL2NvbXBvbmVudHMvRGVza3RvcFVwc2VsbC9EZXNrdG9wVXBzZWxsU3RhcnR1cC5qcydcbmltcG9ydCB7IHVzZVBsdWdpbkluc3RhbGxhdGlvblN0YXR1cyB9IGZyb20gJ3NyYy9ob29rcy9ub3RpZnMvdXNlUGx1Z2luSW5zdGFsbGF0aW9uU3RhdHVzLmpzJ1xuaW1wb3J0IHsgdXNlUGx1Z2luQXV0b3VwZGF0ZU5vdGlmaWNhdGlvbiB9IGZyb20gJ3NyYy9ob29rcy9ub3RpZnMvdXNlUGx1Z2luQXV0b3VwZGF0ZU5vdGlmaWNhdGlvbi5qcydcbmltcG9ydCB7IHBlcmZvcm1TdGFydHVwQ2hlY2tzIH0gZnJvbSAnc3JjL3V0aWxzL3BsdWdpbnMvcGVyZm9ybVN0YXJ0dXBDaGVja3MuanMnXG5pbXBvcnQgeyBVc2VyVGV4dE1lc3NhZ2UgfSBmcm9tICdzcmMvY29tcG9uZW50cy9tZXNzYWdlcy9Vc2VyVGV4dE1lc3NhZ2UuanMnXG5pbXBvcnQgeyBBd3NBdXRoU3RhdHVzQm94IH0gZnJvbSAnLi4vY29tcG9uZW50cy9Bd3NBdXRoU3RhdHVzQm94LmpzJ1xuaW1wb3J0IHsgdXNlUmF0ZUxpbWl0V2FybmluZ05vdGlmaWNhdGlvbiB9IGZyb20gJ3NyYy9ob29rcy9ub3RpZnMvdXNlUmF0ZUxpbWl0V2FybmluZ05vdGlmaWNhdGlvbi5qcydcbmltcG9ydCB7IHVzZURlcHJlY2F0aW9uV2FybmluZ05vdGlmaWNhdGlvbiB9IGZyb20gJ3NyYy9ob29rcy9ub3RpZnMvdXNlRGVwcmVjYXRpb25XYXJuaW5nTm90aWZpY2F0aW9uLmpzJ1xuaW1wb3J0IHsgdXNlTnBtRGVwcmVjYXRpb25Ob3RpZmljYXRpb24gfSBmcm9tICdzcmMvaG9va3Mvbm90aWZzL3VzZU5wbURlcHJlY2F0aW9uTm90aWZpY2F0aW9uLmpzJ1xuaW1wb3J0IHsgdXNlSURFU3RhdHVzSW5kaWNhdG9yIH0gZnJvbSAnc3JjL2hvb2tzL25vdGlmcy91c2VJREVTdGF0dXNJbmRpY2F0b3IuanMnXG5pbXBvcnQgeyB1c2VNb2RlbE1pZ3JhdGlvbk5vdGlmaWNhdGlvbnMgfSBmcm9tICdzcmMvaG9va3Mvbm90aWZzL3VzZU1vZGVsTWlncmF0aW9uTm90aWZpY2F0aW9ucy5qcydcbmltcG9ydCB7IHVzZUNhblN3aXRjaFRvRXhpc3RpbmdTdWJzY3JpcHRpb24gfSBmcm9tICdzcmMvaG9va3Mvbm90aWZzL3VzZUNhblN3aXRjaFRvRXhpc3RpbmdTdWJzY3JpcHRpb24uanMnXG5pbXBvcnQgeyB1c2VUZWFtbWF0ZUxpZmVjeWNsZU5vdGlmaWNhdGlvbiB9IGZyb20gJ3NyYy9ob29rcy9ub3RpZnMvdXNlVGVhbW1hdGVTaHV0ZG93bk5vdGlmaWNhdGlvbi5qcydcbmltcG9ydCB7IHVzZUZhc3RNb2RlTm90aWZpY2F0aW9uIH0gZnJvbSAnc3JjL2hvb2tzL25vdGlmcy91c2VGYXN0TW9kZU5vdGlmaWNhdGlvbi5qcydcbmltcG9ydCB7XG4gIEF1dG9SdW5Jc3N1ZU5vdGlmaWNhdGlvbixcbiAgc2hvdWxkQXV0b1J1bklzc3VlLFxuICBnZXRBdXRvUnVuSXNzdWVSZWFzb25UZXh0LFxuICBnZXRBdXRvUnVuQ29tbWFuZCxcbiAgdHlwZSBBdXRvUnVuSXNzdWVSZWFzb24sXG59IGZyb20gJy4uL3V0aWxzL2F1dG9SdW5Jc3N1ZS5qcydcbmltcG9ydCB0eXBlIHsgSG9va1Byb2dyZXNzIH0gZnJvbSAnLi4vdHlwZXMvaG9va3MuanMnXG5pbXBvcnQgeyBUdW5nc3RlbkxpdmVNb25pdG9yIH0gZnJvbSAnLi4vdG9vbHMvVHVuZ3N0ZW5Ub29sL1R1bmdzdGVuTGl2ZU1vbml0b3IuanMnXG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5jb25zdCBXZWJCcm93c2VyUGFuZWxNb2R1bGUgPSBmZWF0dXJlKCdXRUJfQlJPV1NFUl9UT09MJylcbiAgPyAocmVxdWlyZSgnLi4vdG9vbHMvV2ViQnJvd3NlclRvb2wvV2ViQnJvd3NlclBhbmVsLmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi4vdG9vbHMvV2ViQnJvd3NlclRvb2wvV2ViQnJvd3NlclBhbmVsLmpzJykpXG4gIDogbnVsbFxuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5pbXBvcnQgeyBJc3N1ZUZsYWdCYW5uZXIgfSBmcm9tICcuLi9jb21wb25lbnRzL1Byb21wdElucHV0L0lzc3VlRmxhZ0Jhbm5lci5qcydcbmltcG9ydCB7IHVzZUlzc3VlRmxhZ0Jhbm5lciB9IGZyb20gJy4uL2hvb2tzL3VzZUlzc3VlRmxhZ0Jhbm5lci5qcydcbmltcG9ydCB7XG4gIENvbXBhbmlvblNwcml0ZSxcbiAgQ29tcGFuaW9uRmxvYXRpbmdCdWJibGUsXG4gIE1JTl9DT0xTX0ZPUl9GVUxMX1NQUklURSxcbn0gZnJvbSAnLi4vYnVkZHkvQ29tcGFuaW9uU3ByaXRlLmpzJ1xuaW1wb3J0IHsgRGV2QmFyIH0gZnJvbSAnLi4vY29tcG9uZW50cy9EZXZCYXIuanMnXG4vLyBTZXNzaW9uIG1hbmFnZXIgcmVtb3ZlZCAtIHVzaW5nIEFwcFN0YXRlIG5vd1xuaW1wb3J0IHR5cGUgeyBSZW1vdGVTZXNzaW9uQ29uZmlnIH0gZnJvbSAnLi4vcmVtb3RlL1JlbW90ZVNlc3Npb25NYW5hZ2VyLmpzJ1xuaW1wb3J0IHsgUkVNT1RFX1NBRkVfQ09NTUFORFMgfSBmcm9tICcuLi9jb21tYW5kcy5qcydcbmltcG9ydCB0eXBlIHsgUmVtb3RlTWVzc2FnZUNvbnRlbnQgfSBmcm9tICcuLi91dGlscy90ZWxlcG9ydC9hcGkuanMnXG5pbXBvcnQge1xuICBGdWxsc2NyZWVuTGF5b3V0LFxuICB1c2VVbnNlZW5EaXZpZGVyLFxuICBjb21wdXRlVW5zZWVuRGl2aWRlcixcbn0gZnJvbSAnLi4vY29tcG9uZW50cy9GdWxsc2NyZWVuTGF5b3V0LmpzJ1xuaW1wb3J0IHtcbiAgaXNGdWxsc2NyZWVuRW52RW5hYmxlZCxcbiAgbWF5YmVHZXRUbXV4TW91c2VIaW50LFxuICBpc01vdXNlVHJhY2tpbmdFbmFibGVkLFxufSBmcm9tICcuLi91dGlscy9mdWxsc2NyZWVuLmpzJ1xuaW1wb3J0IHsgQWx0ZXJuYXRlU2NyZWVuIH0gZnJvbSAnLi4vaW5rL2NvbXBvbmVudHMvQWx0ZXJuYXRlU2NyZWVuLmpzJ1xuaW1wb3J0IHsgU2Nyb2xsS2V5YmluZGluZ0hhbmRsZXIgfSBmcm9tICcuLi9jb21wb25lbnRzL1Njcm9sbEtleWJpbmRpbmdIYW5kbGVyLmpzJ1xuaW1wb3J0IHtcbiAgdXNlTWVzc2FnZUFjdGlvbnMsXG4gIE1lc3NhZ2VBY3Rpb25zS2V5YmluZGluZ3MsXG4gIE1lc3NhZ2VBY3Rpb25zQmFyLFxuICB0eXBlIE1lc3NhZ2VBY3Rpb25zU3RhdGUsXG4gIHR5cGUgTWVzc2FnZUFjdGlvbnNOYXYsXG4gIHR5cGUgTWVzc2FnZUFjdGlvbkNhcHMsXG59IGZyb20gJy4uL2NvbXBvbmVudHMvbWVzc2FnZUFjdGlvbnMuanMnXG5pbXBvcnQgeyBzZXRDbGlwYm9hcmQgfSBmcm9tICcuLi9pbmsvdGVybWlvL29zYy5qcydcbmltcG9ydCB0eXBlIHsgU2Nyb2xsQm94SGFuZGxlIH0gZnJvbSAnLi4vaW5rL2NvbXBvbmVudHMvU2Nyb2xsQm94LmpzJ1xuaW1wb3J0IHtcbiAgY3JlYXRlQXR0YWNobWVudE1lc3NhZ2UsXG4gIGdldFF1ZXVlZENvbW1hbmRBdHRhY2htZW50cyxcbn0gZnJvbSAnLi4vdXRpbHMvYXR0YWNobWVudHMuanMnXG5cbi8vIFN0YWJsZSBlbXB0eSBhcnJheSBmb3IgaG9va3MgdGhhdCBhY2NlcHQgTUNQU2VydmVyQ29ubmVjdGlvbltdIOKAlCBhdm9pZHNcbi8vIGNyZWF0aW5nIGEgbmV3IFtdIGxpdGVyYWwgb24gZXZlcnkgcmVuZGVyIGluIHJlbW90ZSBtb2RlLCB3aGljaCB3b3VsZFxuLy8gY2F1c2UgdXNlRWZmZWN0IGRlcGVuZGVuY3kgY2hhbmdlcyBhbmQgaW5maW5pdGUgcmUtcmVuZGVyIGxvb3BzLlxuY29uc3QgRU1QVFlfTUNQX0NMSUVOVFM6IE1DUFNlcnZlckNvbm5lY3Rpb25bXSA9IFtdXG5cbi8vIFN0YWJsZSBzdHViIGZvciB1c2VBc3Npc3RhbnRIaXN0b3J5J3Mgbm9uLUtBSVJPUyBicmFuY2gg4oCUIGF2b2lkcyBhIG5ld1xuLy8gZnVuY3Rpb24gaWRlbnRpdHkgZWFjaCByZW5kZXIsIHdoaWNoIHdvdWxkIGJyZWFrIGNvbXBvc2VkT25TY3JvbGwncyBtZW1vLlxuY29uc3QgSElTVE9SWV9TVFVCID0geyBtYXliZUxvYWRPbGRlcjogKF86IFNjcm9sbEJveEhhbmRsZSkgPT4ge30gfVxuLy8gV2luZG93IGFmdGVyIGEgdXNlci1pbml0aWF0ZWQgc2Nyb2xsIGR1cmluZyB3aGljaCB0eXBlLWludG8tZW1wdHkgZG9lcyBOT1Rcbi8vIHJlcGluIHRvIGJvdHRvbS4gSm9zaCBSb3NlbidzIHdvcmtmbG93OiBDbGF1ZGUgZW1pdHMgbG9uZyBvdXRwdXQg4oaSIHNjcm9sbFxuLy8gdXAgdG8gcmVhZCB0aGUgc3RhcnQg4oaSIHN0YXJ0IHR5cGluZyDihpIgYmVmb3JlIHRoaXMgZml4LCBzbmFwcGVkIHRvIGJvdHRvbS5cbi8vIGh0dHBzOi8vYW50aHJvcGljLnNsYWNrLmNvbS9hcmNoaXZlcy9DMDdWQlNIVjdFVi9wMTc3MzU0NTQ0OTg3MTczOVxuY29uc3QgUkVDRU5UX1NDUk9MTF9SRVBJTl9XSU5ET1dfTVMgPSAzMDAwXG5cbi8vIFVzZSBMUlUgY2FjaGUgdG8gcHJldmVudCB1bmJvdW5kZWQgbWVtb3J5IGdyb3d0aFxuLy8gMTAwIGZpbGVzIHNob3VsZCBiZSBzdWZmaWNpZW50IGZvciBtb3N0IGNvZGluZyBzZXNzaW9ucyB3aGlsZSBwcmV2ZW50aW5nXG4vLyBtZW1vcnkgaXNzdWVzIHdoZW4gd29ya2luZyBhY3Jvc3MgbWFueSBmaWxlcyBpbiBsYXJnZSBwcm9qZWN0c1xuXG5mdW5jdGlvbiBtZWRpYW4odmFsdWVzOiBudW1iZXJbXSk6IG51bWJlciB7XG4gIGNvbnN0IHNvcnRlZCA9IFsuLi52YWx1ZXNdLnNvcnQoKGEsIGIpID0+IGEgLSBiKVxuICBjb25zdCBtaWQgPSBNYXRoLmZsb29yKHNvcnRlZC5sZW5ndGggLyAyKVxuICByZXR1cm4gc29ydGVkLmxlbmd0aCAlIDIgPT09IDBcbiAgICA/IE1hdGgucm91bmQoKHNvcnRlZFttaWQgLSAxXSEgKyBzb3J0ZWRbbWlkXSEpIC8gMilcbiAgICA6IHNvcnRlZFttaWRdIVxufVxuXG4vKipcbiAqIFNtYWxsIGNvbXBvbmVudCB0byBkaXNwbGF5IHRyYW5zY3JpcHQgbW9kZSBmb290ZXIgd2l0aCBkeW5hbWljIGtleWJpbmRpbmcuXG4gKiBNdXN0IGJlIHJlbmRlcmVkIGluc2lkZSBLZXliaW5kaW5nU2V0dXAgdG8gYWNjZXNzIGtleWJpbmRpbmcgY29udGV4dC5cbiAqL1xuZnVuY3Rpb24gVHJhbnNjcmlwdE1vZGVGb290ZXIoe1xuICBzaG93QWxsSW5UcmFuc2NyaXB0LFxuICB2aXJ0dWFsU2Nyb2xsLFxuICBzZWFyY2hCYWRnZSxcbiAgc3VwcHJlc3NTaG93QWxsID0gZmFsc2UsXG4gIHN0YXR1cyxcbn06IHtcbiAgc2hvd0FsbEluVHJhbnNjcmlwdDogYm9vbGVhblxuICB2aXJ0dWFsU2Nyb2xsOiBib29sZWFuXG4gIC8qKiBNaW5pbWFwIHdoaWxlIG5hdmlnYXRpbmcgYSBjbG9zZWQtYmFyIHNlYXJjaC4gU2hvd3Mgbi9OIGhpbnRzICtcbiAgICogIHJpZ2h0LWFsaWduZWQgY291bnQgaW5zdGVhZCBvZiBzY3JvbGwgaGludHMuICovXG4gIHNlYXJjaEJhZGdlPzogeyBjdXJyZW50OiBudW1iZXI7IGNvdW50OiBudW1iZXIgfVxuICAvKiogSGlkZSB0aGUgY3RybCtlIGhpbnQuIFRoZSBbIGR1bXAgcGF0aCBzaGFyZXMgdGhpcyBmb290ZXIgd2l0aFxuICAgKiAgZW52LW9wdGVkIGR1bXAgKENMQVVERV9DT0RFX05PX0ZMSUNLRVI9MCAvIERJU0FCTEVfVklSVFVBTF9TQ1JPTEw9MSksXG4gICAqICBidXQgY3RybCtlIG9ubHkgd29ya3MgaW4gdGhlIGVudiBjYXNlIOKAlCB1c2VHbG9iYWxLZXliaW5kaW5ncy50c3hcbiAgICogIGdhdGVzIG9uICF2aXJ0dWFsU2Nyb2xsQWN0aXZlIHdoaWNoIGlzIGVudi1kZXJpdmVkLCBkb2Vzbid0IGtub3dcbiAgICogIFsgaGFwcGVuZWQuICovXG4gIHN1cHByZXNzU2hvd0FsbD86IGJvb2xlYW5cbiAgLyoqIFRyYW5zaWVudCBzdGF0dXMgKHYtZm9yLWVkaXRvciBwcm9ncmVzcykuIE5vdGlmaWNhdGlvbnMgcmVuZGVyIGluc2lkZVxuICAgKiAgUHJvbXB0SW5wdXQgd2hpY2ggaXNuJ3QgbW91bnRlZCBpbiB0cmFuc2NyaXB0IOKAlCBhZGROb3RpZmljYXRpb24gcXVldWVzXG4gICAqICBidXQgbm90aGluZyBkcmF3cyBpdC4gKi9cbiAgc3RhdHVzPzogc3RyaW5nXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgdG9nZ2xlU2hvcnRjdXQgPSB1c2VTaG9ydGN1dERpc3BsYXkoXG4gICAgJ2FwcDp0b2dnbGVUcmFuc2NyaXB0JyxcbiAgICAnR2xvYmFsJyxcbiAgICAnY3RybCtvJyxcbiAgKVxuICBjb25zdCBzaG93QWxsU2hvcnRjdXQgPSB1c2VTaG9ydGN1dERpc3BsYXkoXG4gICAgJ3RyYW5zY3JpcHQ6dG9nZ2xlU2hvd0FsbCcsXG4gICAgJ1RyYW5zY3JpcHQnLFxuICAgICdjdHJsK2UnLFxuICApXG4gIHJldHVybiAoXG4gICAgPEJveFxuICAgICAgbm9TZWxlY3RcbiAgICAgIGFsaWduSXRlbXM9XCJjZW50ZXJcIlxuICAgICAgYWxpZ25TZWxmPVwiY2VudGVyXCJcbiAgICAgIGJvcmRlclRvcERpbUNvbG9yXG4gICAgICBib3JkZXJCb3R0b209e2ZhbHNlfVxuICAgICAgYm9yZGVyTGVmdD17ZmFsc2V9XG4gICAgICBib3JkZXJSaWdodD17ZmFsc2V9XG4gICAgICBib3JkZXJTdHlsZT1cInNpbmdsZVwiXG4gICAgICBtYXJnaW5Ub3A9ezF9XG4gICAgICBwYWRkaW5nTGVmdD17Mn1cbiAgICAgIHdpZHRoPVwiMTAwJVwiXG4gICAgPlxuICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgIFNob3dpbmcgZGV0YWlsZWQgdHJhbnNjcmlwdCDCtyB7dG9nZ2xlU2hvcnRjdXR9IHRvIHRvZ2dsZVxuICAgICAgICB7c2VhcmNoQmFkZ2VcbiAgICAgICAgICA/ICcgwrcgbi9OIHRvIG5hdmlnYXRlJ1xuICAgICAgICAgIDogdmlydHVhbFNjcm9sbFxuICAgICAgICAgICAgPyBgIMK3ICR7ZmlndXJlcy5hcnJvd1VwfSR7ZmlndXJlcy5hcnJvd0Rvd259IHNjcm9sbCDCtyBob21lL2VuZCB0b3AvYm90dG9tYFxuICAgICAgICAgICAgOiBzdXBwcmVzc1Nob3dBbGxcbiAgICAgICAgICAgICAgPyAnJ1xuICAgICAgICAgICAgICA6IGAgwrcgJHtzaG93QWxsU2hvcnRjdXR9IHRvICR7c2hvd0FsbEluVHJhbnNjcmlwdCA/ICdjb2xsYXBzZScgOiAnc2hvdyBhbGwnfWB9XG4gICAgICA8L1RleHQ+XG4gICAgICB7c3RhdHVzID8gKFxuICAgICAgICAvLyB2LWZvci1lZGl0b3IgcmVuZGVyIHByb2dyZXNzIOKAlCB0cmFuc2llbnQsIHByZWVtcHRzIHRoZSBzZWFyY2hcbiAgICAgICAgLy8gYmFkZ2Ugc2luY2UgdGhlIHVzZXIganVzdCBwcmVzc2VkIHYgYW5kIHdhbnRzIHRvIHNlZSB3aGF0J3NcbiAgICAgICAgLy8gaGFwcGVuaW5nLiBDbGVhcnMgYWZ0ZXIgNHMuXG4gICAgICAgIDw+XG4gICAgICAgICAgPEJveCBmbGV4R3Jvdz17MX0gLz5cbiAgICAgICAgICA8VGV4dD57c3RhdHVzfSA8L1RleHQ+XG4gICAgICAgIDwvPlxuICAgICAgKSA6IHNlYXJjaEJhZGdlID8gKFxuICAgICAgICAvLyBFbmdpbmUtY291bnRlZCDigJQgY2xvc2UgZW5vdWdoIGZvciBhIHJvdWdoIGxvY2F0aW9uIGhpbnQuIE1heVxuICAgICAgICAvLyBkcmlmdCBmcm9tIHJlbmRlci1jb3VudCBmb3IgZ2hvc3QvcGhhbnRvbSBtZXNzYWdlcy5cbiAgICAgICAgPD5cbiAgICAgICAgICA8Qm94IGZsZXhHcm93PXsxfSAvPlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAge3NlYXJjaEJhZGdlLmN1cnJlbnR9L3tzZWFyY2hCYWRnZS5jb3VudH1cbiAgICAgICAgICAgIHsnICAnfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApIDogbnVsbH1cbiAgICA8L0JveD5cbiAgKVxufVxuXG4vKiogbGVzcy1zdHlsZSAvIGJhci4gMS1yb3csIHNhbWUgYm9yZGVyLXRvcCBzdHlsaW5nIGFzIFRyYW5zY3JpcHRNb2RlRm9vdGVyXG4gKiAgc28gc3dhcHBpbmcgdGhlbSBpbiB0aGUgYm90dG9tIHNsb3QgZG9lc24ndCBzaGlmdCBTY3JvbGxCb3ggaGVpZ2h0LlxuICogIHVzZVNlYXJjaElucHV0IGhhbmRsZXMgcmVhZGxpbmUgZWRpdGluZzsgd2UgcmVwb3J0IHF1ZXJ5IGNoYW5nZXMgYW5kXG4gKiAgcmVuZGVyIHRoZSBjb3VudGVyLiBJbmNyZW1lbnRhbCDigJQgcmUtc2VhcmNoICsgaGlnaGxpZ2h0IHBlciBrZXlzdHJva2UuICovXG5mdW5jdGlvbiBUcmFuc2NyaXB0U2VhcmNoQmFyKHtcbiAganVtcFJlZixcbiAgY291bnQsXG4gIGN1cnJlbnQsXG4gIG9uQ2xvc2UsXG4gIG9uQ2FuY2VsLFxuICBzZXRIaWdobGlnaHQsXG4gIGluaXRpYWxRdWVyeSxcbn06IHtcbiAganVtcFJlZjogUmVmT2JqZWN0PEp1bXBIYW5kbGUgfCBudWxsPlxuICBjb3VudDogbnVtYmVyXG4gIGN1cnJlbnQ6IG51bWJlclxuICAvKiogRW50ZXIg4oCUIGNvbW1pdC4gUXVlcnkgcGVyc2lzdHMgZm9yIG4vTi4gKi9cbiAgb25DbG9zZTogKGxhc3RRdWVyeTogc3RyaW5nKSA9PiB2b2lkXG4gIC8qKiBFc2MvY3RybCtjL2N0cmwrZyDigJQgdW5kbyB0byBwcmUtLyBzdGF0ZS4gKi9cbiAgb25DYW5jZWw6ICgpID0+IHZvaWRcbiAgc2V0SGlnaGxpZ2h0OiAocXVlcnk6IHN0cmluZykgPT4gdm9pZFxuICAvLyBTZWVkIHdpdGggdGhlIHByZXZpb3VzIHF1ZXJ5IChsZXNzOiAvIHNob3dzIGxhc3QgcGF0dGVybikuIE1vdW50LWZpcmVcbiAgLy8gb2YgdGhlIGVmZmVjdCByZS1zY2FucyB3aXRoIHRoZSBzYW1lIHF1ZXJ5IOKAlCBpZGVtcG90ZW50IChzYW1lIG1hdGNoZXMsXG4gIC8vIG5lYXJlc3QtcHRyLCBzYW1lIGhpZ2hsaWdodHMpLiBVc2VyIGNhbiBlZGl0IG9yIGNsZWFyLlxuICBpbml0aWFsUXVlcnk6IHN0cmluZ1xufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHsgcXVlcnksIGN1cnNvck9mZnNldCB9ID0gdXNlU2VhcmNoSW5wdXQoe1xuICAgIGlzQWN0aXZlOiB0cnVlLFxuICAgIGluaXRpYWxRdWVyeSxcbiAgICBvbkV4aXQ6ICgpID0+IG9uQ2xvc2UocXVlcnkpLFxuICAgIG9uQ2FuY2VsLFxuICB9KVxuICAvLyBJbmRleCB3YXJtLXVwIHJ1bnMgYmVmb3JlIHRoZSBxdWVyeSBlZmZlY3Qgc28gaXQgbWVhc3VyZXMgdGhlIHJlYWxcbiAgLy8gY29zdCDigJQgb3RoZXJ3aXNlIHNldFNlYXJjaFF1ZXJ5IGZpbGxzIHRoZSBjYWNoZSBmaXJzdCBhbmQgd2FybVxuICAvLyByZXBvcnRzIH4wbXMgd2hpbGUgdGhlIHVzZXIgZmVsdCB0aGUgYWN0dWFsIGxhZy5cbiAgLy8gRmlyc3QgLyBpbiBhIHRyYW5zY3JpcHQgc2Vzc2lvbiBwYXlzIHRoZSBleHRyYWN0U2VhcmNoVGV4dCBjb3N0LlxuICAvLyBTdWJzZXF1ZW50IC8gcmV0dXJuIDAgaW1tZWRpYXRlbHkgKGluZGV4V2FybWVkIHJlZiBpbiBWTUwpLlxuICAvLyBUcmFuc2NyaXB0IGlzIGZyb3plbiBhdCBjdHJsK28gc28gdGhlIGNhY2hlIHN0YXlzIHZhbGlkLlxuICAvLyBJbml0aWFsICdidWlsZGluZycgc28gd2FybURvbmUgaXMgZmFsc2Ugb24gbW91bnQg4oCUIHRoZSBbcXVlcnldIGVmZmVjdFxuICAvLyB3YWl0cyBmb3IgdGhlIHdhcm0gZWZmZWN0J3MgZmlyc3QgcmVzb2x2ZSBpbnN0ZWFkIG9mIHJhY2luZyBpdC4gV2l0aFxuICAvLyBudWxsIGluaXRpYWwsIHdhcm1Eb25lIHdvdWxkIGJlIHRydWUgb24gbW91bnQg4oaSIFtxdWVyeV0gZmlyZXMg4oaSXG4gIC8vIHNldFNlYXJjaFF1ZXJ5IGZpbGxzIGNhY2hlIOKGkiB3YXJtIHJlcG9ydHMgfjBtcyB3aGlsZSB0aGUgdXNlciBmZWx0XG4gIC8vIHRoZSByZWFsIGxhZy5cbiAgY29uc3QgW2luZGV4U3RhdHVzLCBzZXRJbmRleFN0YXR1c10gPSBSZWFjdC51c2VTdGF0ZTxcbiAgICAnYnVpbGRpbmcnIHwgeyBtczogbnVtYmVyIH0gfCBudWxsXG4gID4oJ2J1aWxkaW5nJylcbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICBsZXQgYWxpdmUgPSB0cnVlXG4gICAgY29uc3Qgd2FybSA9IGp1bXBSZWYuY3VycmVudD8ud2FybVNlYXJjaEluZGV4XG4gICAgaWYgKCF3YXJtKSB7XG4gICAgICBzZXRJbmRleFN0YXR1cyhudWxsKSAvLyBWTUwgbm90IG1vdW50ZWQgeWV0IOKAlCByYXJlLCBza2lwIGluZGljYXRvclxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHNldEluZGV4U3RhdHVzKCdidWlsZGluZycpXG4gICAgd2FybSgpLnRoZW4obXMgPT4ge1xuICAgICAgaWYgKCFhbGl2ZSkgcmV0dXJuXG4gICAgICAvLyA8MjBtcyA9IGltcGVyY2VwdGlibGUuIE5vIHBvaW50IHNob3dpbmcgXCJpbmRleGVkIGluIDNtc1wiLlxuICAgICAgaWYgKG1zIDwgMjApIHtcbiAgICAgICAgc2V0SW5kZXhTdGF0dXMobnVsbClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldEluZGV4U3RhdHVzKHsgbXMgfSlcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiBhbGl2ZSAmJiBzZXRJbmRleFN0YXR1cyhudWxsKSwgMjAwMClcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBhbGl2ZSA9IGZhbHNlXG4gICAgfVxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHNcbiAgfSwgW10pIC8vIG1vdW50LW9ubHk6IGJhciBvcGVucyBvbmNlIHBlciAvXG4gIC8vIEdhdGUgdGhlIHF1ZXJ5IGVmZmVjdCBvbiB3YXJtIGNvbXBsZXRpb24uIHNldEhpZ2hsaWdodCBzdGF5cyBpbnN0YW50XG4gIC8vIChzY3JlZW4tc3BhY2Ugb3ZlcmxheSwgbm8gaW5kZXhpbmcpLiBzZXRTZWFyY2hRdWVyeSAodGhlIHNjYW4pIHdhaXRzLlxuICBjb25zdCB3YXJtRG9uZSA9IGluZGV4U3RhdHVzICE9PSAnYnVpbGRpbmcnXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCF3YXJtRG9uZSkgcmV0dXJuXG4gICAganVtcFJlZi5jdXJyZW50Py5zZXRTZWFyY2hRdWVyeShxdWVyeSlcbiAgICBzZXRIaWdobGlnaHQocXVlcnkpXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHJlYWN0LWhvb2tzL2V4aGF1c3RpdmUtZGVwc1xuICB9LCBbcXVlcnksIHdhcm1Eb25lXSlcbiAgY29uc3Qgb2ZmID0gY3Vyc29yT2Zmc2V0XG4gIGNvbnN0IGN1cnNvckNoYXIgPSBvZmYgPCBxdWVyeS5sZW5ndGggPyBxdWVyeVtvZmZdIDogJyAnXG4gIHJldHVybiAoXG4gICAgPEJveFxuICAgICAgYm9yZGVyVG9wRGltQ29sb3JcbiAgICAgIGJvcmRlckJvdHRvbT17ZmFsc2V9XG4gICAgICBib3JkZXJMZWZ0PXtmYWxzZX1cbiAgICAgIGJvcmRlclJpZ2h0PXtmYWxzZX1cbiAgICAgIGJvcmRlclN0eWxlPVwic2luZ2xlXCJcbiAgICAgIG1hcmdpblRvcD17MX1cbiAgICAgIHBhZGRpbmdMZWZ0PXsyfVxuICAgICAgd2lkdGg9XCIxMDAlXCJcbiAgICAgIC8vIGFwcGx5U2VhcmNoSGlnaGxpZ2h0IHNjYW5zIHRoZSB3aG9sZSBzY3JlZW4gYnVmZmVyLiBUaGUgcXVlcnlcbiAgICAgIC8vIHRleHQgcmVuZGVyZWQgaGVyZSBJUyBvbiBzY3JlZW4g4oCUIC9mb28gbWF0Y2hlcyBpdHMgb3duICdmb28nIGluXG4gICAgICAvLyB0aGUgYmFyLiBXaXRoIG5vIGNvbnRlbnQgbWF0Y2hlcyB0aGF0J3MgdGhlIE9OTFkgdmlzaWJsZSBtYXRjaCDihpJcbiAgICAgIC8vIGdldHMgQ1VSUkVOVCDihpIgdW5kZXJsaW5lZC4gbm9TZWxlY3QgbWFrZXMgc2VhcmNoSGlnaGxpZ2h0LnRzOjc2XG4gICAgICAvLyBza2lwIHRoZXNlIGNlbGxzIChzYW1lIGV4Y2x1c2lvbiBhcyBndXR0ZXJzKS4gWW91IGNhbid0IHRleHQtXG4gICAgICAvLyBzZWxlY3QgdGhlIGJhciBlaXRoZXI7IGl0J3MgdHJhbnNpZW50IGNocm9tZSwgZmluZS5cbiAgICAgIG5vU2VsZWN0XG4gICAgPlxuICAgICAgPFRleHQ+LzwvVGV4dD5cbiAgICAgIDxUZXh0PntxdWVyeS5zbGljZSgwLCBvZmYpfTwvVGV4dD5cbiAgICAgIDxUZXh0IGludmVyc2U+e2N1cnNvckNoYXJ9PC9UZXh0PlxuICAgICAge29mZiA8IHF1ZXJ5Lmxlbmd0aCAmJiA8VGV4dD57cXVlcnkuc2xpY2Uob2ZmICsgMSl9PC9UZXh0Pn1cbiAgICAgIDxCb3ggZmxleEdyb3c9ezF9IC8+XG4gICAgICB7aW5kZXhTdGF0dXMgPT09ICdidWlsZGluZycgPyAoXG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPmluZGV4aW5n4oCmIDwvVGV4dD5cbiAgICAgICkgOiBpbmRleFN0YXR1cyA/IChcbiAgICAgICAgPFRleHQgZGltQ29sb3I+aW5kZXhlZCBpbiB7aW5kZXhTdGF0dXMubXN9bXMgPC9UZXh0PlxuICAgICAgKSA6IGNvdW50ID09PSAwICYmIHF1ZXJ5ID8gKFxuICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+bm8gbWF0Y2hlcyA8L1RleHQ+XG4gICAgICApIDogY291bnQgPiAwID8gKFxuICAgICAgICAvLyBFbmdpbmUtY291bnRlZCAoaW5kZXhPZiBvbiBleHRyYWN0U2VhcmNoVGV4dCkuIE1heSBkcmlmdCBmcm9tXG4gICAgICAgIC8vIHJlbmRlci1jb3VudCBmb3IgZ2hvc3QvcGhhbnRvbSBtZXNzYWdlcyDigJQgYmFkZ2UgaXMgYSByb3VnaFxuICAgICAgICAvLyBsb2NhdGlvbiBoaW50LiBzY2FuRWxlbWVudCBnaXZlcyBleGFjdCBwZXItbWVzc2FnZSBwb3NpdGlvbnNcbiAgICAgICAgLy8gYnV0IGNvdW50aW5nIEFMTCB3b3VsZCBjb3N0IH4xLTNtcyDDlyBtYXRjaGVkLW1lc3NhZ2VzLlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICB7Y3VycmVudH0ve2NvdW50fVxuICAgICAgICAgIHsnICAnfVxuICAgICAgICA8L1RleHQ+XG4gICAgICApIDogbnVsbH1cbiAgICA8L0JveD5cbiAgKVxufVxuXG5jb25zdCBUSVRMRV9BTklNQVRJT05fRlJBTUVTID0gWyfioIInLCAn4qCQJ11cbmNvbnN0IFRJVExFX1NUQVRJQ19QUkVGSVggPSAn4pyzJ1xuY29uc3QgVElUTEVfQU5JTUFUSU9OX0lOVEVSVkFMX01TID0gOTYwXG5cbi8qKlxuICogU2V0cyB0aGUgdGVybWluYWwgdGFiIHRpdGxlLCB3aXRoIGFuIGFuaW1hdGVkIHByZWZpeCBnbHlwaCB3aGlsZSBhIHF1ZXJ5XG4gKiBpcyBydW5uaW5nLiBJc29sYXRlZCBmcm9tIFJFUEwgc28gdGhlIDk2MG1zIGFuaW1hdGlvbiB0aWNrIHJlLXJlbmRlcnMgb25seVxuICogdGhpcyBsZWFmIGNvbXBvbmVudCAod2hpY2ggcmV0dXJucyBudWxsIOKAlCBwdXJlIHNpZGUtZWZmZWN0KSBpbnN0ZWFkIG9mIHRoZVxuICogZW50aXJlIFJFUEwgdHJlZS4gQmVmb3JlIGV4dHJhY3Rpb24sIHRoZSB0aWNrIHdhcyB+MSBSRVBMIHJlbmRlci9zZWMgZm9yXG4gKiB0aGUgZHVyYXRpb24gb2YgZXZlcnkgdHVybiwgZHJhZ2dpbmcgUHJvbXB0SW5wdXQgYW5kIGZyaWVuZHMgYWxvbmcuXG4gKi9cbmZ1bmN0aW9uIEFuaW1hdGVkVGVybWluYWxUaXRsZSh7XG4gIGlzQW5pbWF0aW5nLFxuICB0aXRsZSxcbiAgZGlzYWJsZWQsXG4gIG5vUHJlZml4LFxufToge1xuICBpc0FuaW1hdGluZzogYm9vbGVhblxuICB0aXRsZTogc3RyaW5nXG4gIGRpc2FibGVkOiBib29sZWFuXG4gIG5vUHJlZml4OiBib29sZWFuXG59KTogbnVsbCB7XG4gIGNvbnN0IHRlcm1pbmFsRm9jdXNlZCA9IHVzZVRlcm1pbmFsRm9jdXMoKVxuICBjb25zdCBbZnJhbWUsIHNldEZyYW1lXSA9IHVzZVN0YXRlKDApXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGRpc2FibGVkIHx8IG5vUHJlZml4IHx8ICFpc0FuaW1hdGluZyB8fCAhdGVybWluYWxGb2N1c2VkKSByZXR1cm5cbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKFxuICAgICAgc2V0RnJhbWUgPT4gc2V0RnJhbWUoZiA9PiAoZiArIDEpICUgVElUTEVfQU5JTUFUSU9OX0ZSQU1FUy5sZW5ndGgpLFxuICAgICAgVElUTEVfQU5JTUFUSU9OX0lOVEVSVkFMX01TLFxuICAgICAgc2V0RnJhbWUsXG4gICAgKVxuICAgIHJldHVybiAoKSA9PiBjbGVhckludGVydmFsKGludGVydmFsKVxuICB9LCBbZGlzYWJsZWQsIG5vUHJlZml4LCBpc0FuaW1hdGluZywgdGVybWluYWxGb2N1c2VkXSlcbiAgY29uc3QgcHJlZml4ID0gaXNBbmltYXRpbmdcbiAgICA/IChUSVRMRV9BTklNQVRJT05fRlJBTUVTW2ZyYW1lXSA/PyBUSVRMRV9TVEFUSUNfUFJFRklYKVxuICAgIDogVElUTEVfU1RBVElDX1BSRUZJWFxuICB1c2VUZXJtaW5hbFRpdGxlKGRpc2FibGVkID8gbnVsbCA6IG5vUHJlZml4ID8gdGl0bGUgOiBgJHtwcmVmaXh9ICR7dGl0bGV9YClcbiAgcmV0dXJuIG51bGxcbn1cblxuZXhwb3J0IHR5cGUgUHJvcHMgPSB7XG4gIGNvbW1hbmRzOiBDb21tYW5kW11cbiAgZGVidWc6IGJvb2xlYW5cbiAgaW5pdGlhbFRvb2xzOiBUb29sW11cbiAgLy8gSW5pdGlhbCBtZXNzYWdlcyB0byBwb3B1bGF0ZSB0aGUgUkVQTCB3aXRoXG4gIGluaXRpYWxNZXNzYWdlcz86IE1lc3NhZ2VUeXBlW11cbiAgLy8gRGVmZXJyZWQgaG9vayBtZXNzYWdlcyBwcm9taXNlIOKAlCBSRVBMIHJlbmRlcnMgaW1tZWRpYXRlbHkgYW5kIGluamVjdHNcbiAgLy8gaG9vayBtZXNzYWdlcyB3aGVuIHRoZXkgcmVzb2x2ZS4gQXdhaXRlZCBiZWZvcmUgdGhlIGZpcnN0IEFQSSBjYWxsLlxuICBwZW5kaW5nSG9va01lc3NhZ2VzPzogUHJvbWlzZTxIb29rUmVzdWx0TWVzc2FnZVtdPlxuICBpbml0aWFsRmlsZUhpc3RvcnlTbmFwc2hvdHM/OiBGaWxlSGlzdG9yeVNuYXBzaG90W11cbiAgLy8gQ29udGVudC1yZXBsYWNlbWVudCByZWNvcmRzIGZyb20gYSByZXN1bWVkIHNlc3Npb24ncyB0cmFuc2NyaXB0IOKAlCB1c2VkIHRvXG4gIC8vIHJlY29uc3RydWN0IGNvbnRlbnRSZXBsYWNlbWVudFN0YXRlIHNvIHRoZSBzYW1lIHJlc3VsdHMgYXJlIHJlLXJlcGxhY2VkXG4gIGluaXRpYWxDb250ZW50UmVwbGFjZW1lbnRzPzogQ29udGVudFJlcGxhY2VtZW50UmVjb3JkW11cbiAgLy8gSW5pdGlhbCBhZ2VudCBjb250ZXh0IGZvciBzZXNzaW9uIHJlc3VtZSAobmFtZS9jb2xvciBzZXQgdmlhIC9yZW5hbWUgb3IgL2NvbG9yKVxuICBpbml0aWFsQWdlbnROYW1lPzogc3RyaW5nXG4gIGluaXRpYWxBZ2VudENvbG9yPzogQWdlbnRDb2xvck5hbWVcbiAgbWNwQ2xpZW50cz86IE1DUFNlcnZlckNvbm5lY3Rpb25bXVxuICBkeW5hbWljTWNwQ29uZmlnPzogUmVjb3JkPHN0cmluZywgU2NvcGVkTWNwU2VydmVyQ29uZmlnPlxuICBhdXRvQ29ubmVjdElkZUZsYWc/OiBib29sZWFuXG4gIHN0cmljdE1jcENvbmZpZz86IGJvb2xlYW5cbiAgc3lzdGVtUHJvbXB0Pzogc3RyaW5nXG4gIGFwcGVuZFN5c3RlbVByb21wdD86IHN0cmluZ1xuICAvLyBPcHRpb25hbCBjYWxsYmFjayBpbnZva2VkIGJlZm9yZSBxdWVyeSBleGVjdXRpb25cbiAgLy8gQ2FsbGVkIGFmdGVyIHVzZXIgbWVzc2FnZSBpcyBhZGRlZCB0byBjb252ZXJzYXRpb24gYnV0IGJlZm9yZSBBUEkgY2FsbFxuICAvLyBSZXR1cm4gZmFsc2UgdG8gcHJldmVudCBxdWVyeSBleGVjdXRpb25cbiAgb25CZWZvcmVRdWVyeT86IChcbiAgICBpbnB1dDogc3RyaW5nLFxuICAgIG5ld01lc3NhZ2VzOiBNZXNzYWdlVHlwZVtdLFxuICApID0+IFByb21pc2U8Ym9vbGVhbj5cbiAgLy8gT3B0aW9uYWwgY2FsbGJhY2sgd2hlbiBhIHR1cm4gY29tcGxldGVzIChtb2RlbCBmaW5pc2hlcyByZXNwb25kaW5nKVxuICBvblR1cm5Db21wbGV0ZT86IChtZXNzYWdlczogTWVzc2FnZVR5cGVbXSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD5cbiAgLy8gV2hlbiB0cnVlLCBkaXNhYmxlcyBSRVBMIGlucHV0IChoaWRlcyBwcm9tcHQgYW5kIHByZXZlbnRzIG1lc3NhZ2Ugc2VsZWN0b3IpXG4gIGRpc2FibGVkPzogYm9vbGVhblxuICAvLyBPcHRpb25hbCBhZ2VudCBkZWZpbml0aW9uIHRvIHVzZSBmb3IgdGhlIG1haW4gdGhyZWFkXG4gIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24/OiBBZ2VudERlZmluaXRpb25cbiAgLy8gV2hlbiB0cnVlLCBkaXNhYmxlcyBhbGwgc2xhc2ggY29tbWFuZHNcbiAgZGlzYWJsZVNsYXNoQ29tbWFuZHM/OiBib29sZWFuXG4gIC8vIFRhc2sgbGlzdCBpZDogd2hlbiBzZXQsIGVuYWJsZXMgdGFza3MgbW9kZSB0aGF0IHdhdGNoZXMgYSB0YXNrIGxpc3QgYW5kIGF1dG8tcHJvY2Vzc2VzIHRhc2tzLlxuICB0YXNrTGlzdElkPzogc3RyaW5nXG4gIC8vIFJlbW90ZSBzZXNzaW9uIGNvbmZpZyBmb3IgLS1yZW1vdGUgbW9kZSAodXNlcyBDQ1IgYXMgZXhlY3V0aW9uIGVuZ2luZSlcbiAgcmVtb3RlU2Vzc2lvbkNvbmZpZz86IFJlbW90ZVNlc3Npb25Db25maWdcbiAgLy8gRGlyZWN0IGNvbm5lY3QgY29uZmlnIGZvciBgY2xhdWRlIGNvbm5lY3RgIG1vZGUgKGNvbm5lY3RzIHRvIGEgY2xhdWRlIHNlcnZlcilcbiAgZGlyZWN0Q29ubmVjdENvbmZpZz86IERpcmVjdENvbm5lY3RDb25maWdcbiAgLy8gU1NIIHNlc3Npb24gZm9yIGBjbGF1ZGUgc3NoYCBtb2RlIChsb2NhbCBSRVBMLCByZW1vdGUgdG9vbHMgb3ZlciBzc2gpXG4gIHNzaFNlc3Npb24/OiBTU0hTZXNzaW9uXG4gIC8vIFRoaW5raW5nIGNvbmZpZ3VyYXRpb24gdG8gdXNlIHdoZW4gdGhpbmtpbmcgaXMgZW5hYmxlZFxuICB0aGlua2luZ0NvbmZpZzogVGhpbmtpbmdDb25maWdcbn1cblxuZXhwb3J0IHR5cGUgU2NyZWVuID0gJ3Byb21wdCcgfCAndHJhbnNjcmlwdCdcblxuZXhwb3J0IGZ1bmN0aW9uIFJFUEwoe1xuICBjb21tYW5kczogaW5pdGlhbENvbW1hbmRzLFxuICBkZWJ1ZyxcbiAgaW5pdGlhbFRvb2xzLFxuICBpbml0aWFsTWVzc2FnZXMsXG4gIHBlbmRpbmdIb29rTWVzc2FnZXMsXG4gIGluaXRpYWxGaWxlSGlzdG9yeVNuYXBzaG90cyxcbiAgaW5pdGlhbENvbnRlbnRSZXBsYWNlbWVudHMsXG4gIGluaXRpYWxBZ2VudE5hbWUsXG4gIGluaXRpYWxBZ2VudENvbG9yLFxuICBtY3BDbGllbnRzOiBpbml0aWFsTWNwQ2xpZW50cyxcbiAgZHluYW1pY01jcENvbmZpZzogaW5pdGlhbER5bmFtaWNNY3BDb25maWcsXG4gIGF1dG9Db25uZWN0SWRlRmxhZyxcbiAgc3RyaWN0TWNwQ29uZmlnID0gZmFsc2UsXG4gIHN5c3RlbVByb21wdDogY3VzdG9tU3lzdGVtUHJvbXB0LFxuICBhcHBlbmRTeXN0ZW1Qcm9tcHQsXG4gIG9uQmVmb3JlUXVlcnksXG4gIG9uVHVybkNvbXBsZXRlLFxuICBkaXNhYmxlZCA9IGZhbHNlLFxuICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uOiBpbml0aWFsTWFpblRocmVhZEFnZW50RGVmaW5pdGlvbixcbiAgZGlzYWJsZVNsYXNoQ29tbWFuZHMgPSBmYWxzZSxcbiAgdGFza0xpc3RJZCxcbiAgcmVtb3RlU2Vzc2lvbkNvbmZpZyxcbiAgZGlyZWN0Q29ubmVjdENvbmZpZyxcbiAgc3NoU2Vzc2lvbixcbiAgdGhpbmtpbmdDb25maWcsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IGlzUmVtb3RlU2Vzc2lvbiA9ICEhcmVtb3RlU2Vzc2lvbkNvbmZpZ1xuXG4gIC8vIEVudi12YXIgZ2F0ZXMgaG9pc3RlZCB0byBtb3VudC10aW1lIOKAlCBpc0VudlRydXRoeSBkb2VzIHRvTG93ZXJDYXNlK3RyaW0rXG4gIC8vIGluY2x1ZGVzLCBhbmQgdGhlc2Ugd2VyZSBvbiB0aGUgcmVuZGVyIHBhdGggKGhvdCBkdXJpbmcgUGFnZVVwIHNwYW0pLlxuICBjb25zdCB0aXRsZURpc2FibGVkID0gdXNlTWVtbyhcbiAgICAoKSA9PiBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9ESVNBQkxFX1RFUk1JTkFMX1RJVExFKSxcbiAgICBbXSxcbiAgKVxuICBjb25zdCBtb3JlUmlnaHRFbmFibGVkID0gdXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgXCJleHRlcm5hbFwiID09PSAnYW50JyAmJlxuICAgICAgaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0xBVURFX01PUkVSSUdIVCksXG4gICAgW10sXG4gIClcbiAgY29uc3QgZGlzYWJsZVZpcnR1YWxTY3JvbGwgPSB1c2VNZW1vKFxuICAgICgpID0+IGlzRW52VHJ1dGh5KHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0RJU0FCTEVfVklSVFVBTF9TQ1JPTEwpLFxuICAgIFtdLFxuICApXG4gIGNvbnN0IGRpc2FibGVNZXNzYWdlQWN0aW9ucyA9IGZlYXR1cmUoJ01FU1NBR0VfQUNUSU9OUycpXG4gICAgPyAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gICAgICB1c2VNZW1vKFxuICAgICAgICAoKSA9PiBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9ESVNBQkxFX01FU1NBR0VfQUNUSU9OUyksXG4gICAgICAgIFtdLFxuICAgICAgKVxuICAgIDogZmFsc2VcblxuICAvLyBMb2cgUkVQTCBtb3VudC91bm1vdW50IGxpZmVjeWNsZVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGxvZ0ZvckRlYnVnZ2luZyhgW1JFUEw6bW91bnRdIFJFUEwgbW91bnRlZCwgZGlzYWJsZWQ9JHtkaXNhYmxlZH1gKVxuICAgIHJldHVybiAoKSA9PiBsb2dGb3JEZWJ1Z2dpbmcoYFtSRVBMOnVubW91bnRdIFJFUEwgdW5tb3VudGluZ2ApXG4gIH0sIFtkaXNhYmxlZF0pXG5cbiAgLy8gQWdlbnQgZGVmaW5pdGlvbiBpcyBzdGF0ZSBzbyAvcmVzdW1lIGNhbiB1cGRhdGUgaXQgbWlkLXNlc3Npb25cbiAgY29uc3QgW21haW5UaHJlYWRBZ2VudERlZmluaXRpb24sIHNldE1haW5UaHJlYWRBZ2VudERlZmluaXRpb25dID0gdXNlU3RhdGUoXG4gICAgaW5pdGlhbE1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gIClcblxuICBjb25zdCB0b29sUGVybWlzc2lvbkNvbnRleHQgPSB1c2VBcHBTdGF0ZShzID0+IHMudG9vbFBlcm1pc3Npb25Db250ZXh0KVxuICBjb25zdCB2ZXJib3NlID0gdXNlQXBwU3RhdGUocyA9PiBzLnZlcmJvc2UpXG4gIGNvbnN0IG1jcCA9IHVzZUFwcFN0YXRlKHMgPT4gcy5tY3ApXG4gIGNvbnN0IHBsdWdpbnMgPSB1c2VBcHBTdGF0ZShzID0+IHMucGx1Z2lucylcbiAgY29uc3QgYWdlbnREZWZpbml0aW9ucyA9IHVzZUFwcFN0YXRlKHMgPT4gcy5hZ2VudERlZmluaXRpb25zKVxuICBjb25zdCBmaWxlSGlzdG9yeSA9IHVzZUFwcFN0YXRlKHMgPT4gcy5maWxlSGlzdG9yeSlcbiAgY29uc3QgaW5pdGlhbE1lc3NhZ2UgPSB1c2VBcHBTdGF0ZShzID0+IHMuaW5pdGlhbE1lc3NhZ2UpXG4gIGNvbnN0IHF1ZXVlZENvbW1hbmRzID0gdXNlQ29tbWFuZFF1ZXVlKClcbiAgLy8gZmVhdHVyZSgpIGlzIGEgYnVpbGQtdGltZSBjb25zdGFudCDigJQgZGVhZCBjb2RlIGVsaW1pbmF0aW9uIHJlbW92ZXMgdGhlIGhvb2tcbiAgLy8gY2FsbCBlbnRpcmVseSBpbiBleHRlcm5hbCBidWlsZHMsIHNvIHRoaXMgaXMgc2FmZSBkZXNwaXRlIGxvb2tpbmcgY29uZGl0aW9uYWwuXG4gIC8vIFRoZXNlIGZpZWxkcyBjb250YWluIGV4Y2x1ZGVkIHN0cmluZ3MgdGhhdCBtdXN0IG5vdCBhcHBlYXIgaW4gZXh0ZXJuYWwgYnVpbGRzLlxuICBjb25zdCBzcGlubmVyVGlwID0gdXNlQXBwU3RhdGUocyA9PiBzLnNwaW5uZXJUaXApXG4gIGNvbnN0IHNob3dFeHBhbmRlZFRvZG9zID0gdXNlQXBwU3RhdGUocyA9PiBzLmV4cGFuZGVkVmlldykgPT09ICd0YXNrcydcbiAgY29uc3QgcGVuZGluZ1dvcmtlclJlcXVlc3QgPSB1c2VBcHBTdGF0ZShzID0+IHMucGVuZGluZ1dvcmtlclJlcXVlc3QpXG4gIGNvbnN0IHBlbmRpbmdTYW5kYm94UmVxdWVzdCA9IHVzZUFwcFN0YXRlKHMgPT4gcy5wZW5kaW5nU2FuZGJveFJlcXVlc3QpXG4gIGNvbnN0IHRlYW1Db250ZXh0ID0gdXNlQXBwU3RhdGUocyA9PiBzLnRlYW1Db250ZXh0KVxuICBjb25zdCB0YXNrcyA9IHVzZUFwcFN0YXRlKHMgPT4gcy50YXNrcylcbiAgY29uc3Qgd29ya2VyU2FuZGJveFBlcm1pc3Npb25zID0gdXNlQXBwU3RhdGUocyA9PiBzLndvcmtlclNhbmRib3hQZXJtaXNzaW9ucylcbiAgY29uc3QgZWxpY2l0YXRpb24gPSB1c2VBcHBTdGF0ZShzID0+IHMuZWxpY2l0YXRpb24pXG4gIGNvbnN0IHVsdHJhcGxhblBlbmRpbmdDaG9pY2UgPSB1c2VBcHBTdGF0ZShzID0+IHMudWx0cmFwbGFuUGVuZGluZ0Nob2ljZSlcbiAgY29uc3QgdWx0cmFwbGFuTGF1bmNoUGVuZGluZyA9IHVzZUFwcFN0YXRlKHMgPT4gcy51bHRyYXBsYW5MYXVuY2hQZW5kaW5nKVxuICBjb25zdCB2aWV3aW5nQWdlbnRUYXNrSWQgPSB1c2VBcHBTdGF0ZShzID0+IHMudmlld2luZ0FnZW50VGFza0lkKVxuICBjb25zdCBzZXRBcHBTdGF0ZSA9IHVzZVNldEFwcFN0YXRlKClcblxuICAvLyBCb290c3RyYXA6IHJldGFpbmVkIGxvY2FsX2FnZW50IHRoYXQgaGFzbid0IGxvYWRlZCBkaXNrIHlldCDihpIgcmVhZFxuICAvLyBzaWRlY2hhaW4gSlNPTkwgYW5kIFVVSUQtbWVyZ2Ugd2l0aCB3aGF0ZXZlciBzdHJlYW0gaGFzIGFwcGVuZGVkIHNvIGZhci5cbiAgLy8gU3RyZWFtIGFwcGVuZHMgaW1tZWRpYXRlbHkgb24gcmV0YWluIChubyBkZWZlcik7IGJvb3RzdHJhcCBmaWxscyB0aGVcbiAgLy8gcHJlZml4LiBEaXNrLXdyaXRlLWJlZm9yZS15aWVsZCBtZWFucyBsaXZlIGlzIGFsd2F5cyBhIHN1ZmZpeCBvZiBkaXNrLlxuICBjb25zdCB2aWV3ZWRMb2NhbEFnZW50ID0gdmlld2luZ0FnZW50VGFza0lkXG4gICAgPyB0YXNrc1t2aWV3aW5nQWdlbnRUYXNrSWRdXG4gICAgOiB1bmRlZmluZWRcbiAgY29uc3QgbmVlZHNCb290c3RyYXAgPVxuICAgIGlzTG9jYWxBZ2VudFRhc2sodmlld2VkTG9jYWxBZ2VudCkgJiZcbiAgICB2aWV3ZWRMb2NhbEFnZW50LnJldGFpbiAmJlxuICAgICF2aWV3ZWRMb2NhbEFnZW50LmRpc2tMb2FkZWRcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIXZpZXdpbmdBZ2VudFRhc2tJZCB8fCAhbmVlZHNCb290c3RyYXApIHJldHVyblxuICAgIGNvbnN0IHRhc2tJZCA9IHZpZXdpbmdBZ2VudFRhc2tJZFxuICAgIHZvaWQgZ2V0QWdlbnRUcmFuc2NyaXB0KGFzQWdlbnRJZCh0YXNrSWQpKS50aGVuKHJlc3VsdCA9PiB7XG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgY29uc3QgdCA9IHByZXYudGFza3NbdGFza0lkXVxuICAgICAgICBpZiAoIWlzTG9jYWxBZ2VudFRhc2sodCkgfHwgdC5kaXNrTG9hZGVkIHx8ICF0LnJldGFpbikgcmV0dXJuIHByZXZcbiAgICAgICAgY29uc3QgbGl2ZSA9IHQubWVzc2FnZXMgPz8gW11cbiAgICAgICAgY29uc3QgbGl2ZVV1aWRzID0gbmV3IFNldChsaXZlLm1hcChtID0+IG0udXVpZCkpXG4gICAgICAgIGNvbnN0IGRpc2tPbmx5ID0gcmVzdWx0XG4gICAgICAgICAgPyByZXN1bHQubWVzc2FnZXMuZmlsdGVyKG0gPT4gIWxpdmVVdWlkcy5oYXMobS51dWlkKSlcbiAgICAgICAgICA6IFtdXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICB0YXNrczoge1xuICAgICAgICAgICAgLi4ucHJldi50YXNrcyxcbiAgICAgICAgICAgIFt0YXNrSWRdOiB7XG4gICAgICAgICAgICAgIC4uLnQsXG4gICAgICAgICAgICAgIG1lc3NhZ2VzOiBbLi4uZGlza09ubHksIC4uLmxpdmVdLFxuICAgICAgICAgICAgICBkaXNrTG9hZGVkOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0pXG4gIH0sIFt2aWV3aW5nQWdlbnRUYXNrSWQsIG5lZWRzQm9vdHN0cmFwLCBzZXRBcHBTdGF0ZV0pXG5cbiAgY29uc3Qgc3RvcmUgPSB1c2VBcHBTdGF0ZVN0b3JlKClcbiAgY29uc3QgdGVybWluYWwgPSB1c2VUZXJtaW5hbE5vdGlmaWNhdGlvbigpXG4gIGNvbnN0IG1haW5Mb29wTW9kZWwgPSB1c2VNYWluTG9vcE1vZGVsKClcblxuICAvLyBOb3RlOiBzdGFuZGFsb25lQWdlbnRDb250ZXh0IGlzIGluaXRpYWxpemVkIGluIG1haW4udHN4ICh2aWEgaW5pdGlhbFN0YXRlKSBvclxuICAvLyBSZXN1bWVDb252ZXJzYXRpb24udHN4ICh2aWEgc2V0QXBwU3RhdGUgYmVmb3JlIHJlbmRlcmluZyBSRVBMKSB0byBhdm9pZFxuICAvLyB1c2VFZmZlY3QtYmFzZWQgc3RhdGUgaW5pdGlhbGl6YXRpb24gb24gbW91bnQgKHBlciBDTEFVREUubWQgZ3VpZGVsaW5lcylcblxuICAvLyBMb2NhbCBzdGF0ZSBmb3IgY29tbWFuZHMgKGhvdC1yZWxvYWRhYmxlIHdoZW4gc2tpbGwgZmlsZXMgY2hhbmdlKVxuICBjb25zdCBbbG9jYWxDb21tYW5kcywgc2V0TG9jYWxDb21tYW5kc10gPSB1c2VTdGF0ZShpbml0aWFsQ29tbWFuZHMpXG5cbiAgLy8gV2F0Y2ggZm9yIHNraWxsIGZpbGUgY2hhbmdlcyBhbmQgcmVsb2FkIGFsbCBjb21tYW5kc1xuICB1c2VTa2lsbHNDaGFuZ2UoXG4gICAgaXNSZW1vdGVTZXNzaW9uID8gdW5kZWZpbmVkIDogZ2V0UHJvamVjdFJvb3QoKSxcbiAgICBzZXRMb2NhbENvbW1hbmRzLFxuICApXG5cbiAgLy8gVHJhY2sgcHJvYWN0aXZlIG1vZGUgZm9yIHRvb2xzIGRlcGVuZGVuY3kgLSBTbGVlcFRvb2wgZmlsdGVycyBieSBwcm9hY3RpdmUgc3RhdGVcbiAgY29uc3QgcHJvYWN0aXZlQWN0aXZlID0gUmVhY3QudXNlU3luY0V4dGVybmFsU3RvcmUoXG4gICAgcHJvYWN0aXZlTW9kdWxlPy5zdWJzY3JpYmVUb1Byb2FjdGl2ZUNoYW5nZXMgPz8gUFJPQUNUSVZFX05PX09QX1NVQlNDUklCRSxcbiAgICBwcm9hY3RpdmVNb2R1bGU/LmlzUHJvYWN0aXZlQWN0aXZlID8/IFBST0FDVElWRV9GQUxTRSxcbiAgKVxuXG4gIC8vIEJyaWVmVG9vbC5pc0VuYWJsZWQoKSByZWFkcyBnZXRVc2VyTXNnT3B0SW4oKSBmcm9tIGJvb3RzdHJhcCBzdGF0ZSwgd2hpY2hcbiAgLy8gL2JyaWVmIGZsaXBzIG1pZC1zZXNzaW9uIGFsb25nc2lkZSBpc0JyaWVmT25seS4gVGhlIG1lbW8gYmVsb3cgbmVlZHMgYVxuICAvLyBSZWFjdC12aXNpYmxlIGRlcCB0byByZS1ydW4gZ2V0VG9vbHMoKSB3aGVuIHRoYXQgaGFwcGVuczsgaXNCcmllZk9ubHkgaXNcbiAgLy8gdGhlIEFwcFN0YXRlIG1pcnJvciB0aGF0IHRyaWdnZXJzIHRoZSByZS1yZW5kZXIuIFdpdGhvdXQgdGhpcywgdG9nZ2xpbmdcbiAgLy8gL2JyaWVmIG1pZC1zZXNzaW9uIGxlYXZlcyB0aGUgc3RhbGUgdG9vbCBsaXN0IChubyBTZW5kVXNlck1lc3NhZ2UpIGFuZFxuICAvLyB0aGUgbW9kZWwgZW1pdHMgcGxhaW4gdGV4dCB0aGUgYnJpZWYgZmlsdGVyIGhpZGVzLlxuICBjb25zdCBpc0JyaWVmT25seSA9IHVzZUFwcFN0YXRlKHMgPT4gcy5pc0JyaWVmT25seSlcblxuICBjb25zdCBsb2NhbFRvb2xzID0gdXNlTWVtbyhcbiAgICAoKSA9PiBnZXRUb29scyh0b29sUGVybWlzc2lvbkNvbnRleHQpLFxuICAgIFt0b29sUGVybWlzc2lvbkNvbnRleHQsIHByb2FjdGl2ZUFjdGl2ZSwgaXNCcmllZk9ubHldLFxuICApXG5cbiAgdXNlS2lja09mZkNoZWNrQW5kRGlzYWJsZUJ5cGFzc1Blcm1pc3Npb25zSWZOZWVkZWQoKVxuICB1c2VLaWNrT2ZmQ2hlY2tBbmREaXNhYmxlQXV0b01vZGVJZk5lZWRlZCgpXG5cbiAgY29uc3QgW2R5bmFtaWNNY3BDb25maWcsIHNldER5bmFtaWNNY3BDb25maWddID0gdXNlU3RhdGU8XG4gICAgUmVjb3JkPHN0cmluZywgU2NvcGVkTWNwU2VydmVyQ29uZmlnPiB8IHVuZGVmaW5lZFxuICA+KGluaXRpYWxEeW5hbWljTWNwQ29uZmlnKVxuXG4gIGNvbnN0IG9uQ2hhbmdlRHluYW1pY01jcENvbmZpZyA9IHVzZUNhbGxiYWNrKFxuICAgIChjb25maWc6IFJlY29yZDxzdHJpbmcsIFNjb3BlZE1jcFNlcnZlckNvbmZpZz4pID0+IHtcbiAgICAgIHNldER5bmFtaWNNY3BDb25maWcoY29uZmlnKVxuICAgIH0sXG4gICAgW3NldER5bmFtaWNNY3BDb25maWddLFxuICApXG5cbiAgY29uc3QgW3NjcmVlbiwgc2V0U2NyZWVuXSA9IHVzZVN0YXRlPFNjcmVlbj4oJ3Byb21wdCcpXG4gIGNvbnN0IFtzaG93QWxsSW5UcmFuc2NyaXB0LCBzZXRTaG93QWxsSW5UcmFuc2NyaXB0XSA9IHVzZVN0YXRlKGZhbHNlKVxuICAvLyBbIGZvcmNlcyB0aGUgZHVtcC10by1zY3JvbGxiYWNrIHBhdGggaW5zaWRlIHRyYW5zY3JpcHQgbW9kZS4gU2VwYXJhdGVcbiAgLy8gZnJvbSBDTEFVREVfQ09ERV9OT19GTElDS0VSPTAgKHdoaWNoIGlzIHByb2Nlc3MtbGlmZXRpbWUpIOKAlCB0aGlzIGlzXG4gIC8vIGVwaGVtZXJhbCwgcmVzZXQgb24gdHJhbnNjcmlwdCBleGl0LiBEaWFnbm9zdGljIGVzY2FwZSBoYXRjaCBzb1xuICAvLyB0ZXJtaW5hbC90bXV4IG5hdGl2ZSBjbWQtRiBjYW4gc2VhcmNoIHRoZSBmdWxsIGZsYXQgcmVuZGVyLlxuICBjb25zdCBbZHVtcE1vZGUsIHNldER1bXBNb2RlXSA9IHVzZVN0YXRlKGZhbHNlKVxuICAvLyB2LWZvci1lZGl0b3IgcmVuZGVyIHByb2dyZXNzLiBJbmxpbmUgaW4gdGhlIGZvb3RlciDigJQgbm90aWZpY2F0aW9uc1xuICAvLyByZW5kZXIgaW5zaWRlIFByb21wdElucHV0IHdoaWNoIGlzbid0IG1vdW50ZWQgaW4gdHJhbnNjcmlwdC5cbiAgY29uc3QgW2VkaXRvclN0YXR1cywgc2V0RWRpdG9yU3RhdHVzXSA9IHVzZVN0YXRlKCcnKVxuICAvLyBJbmNyZW1lbnRlZCBvbiB0cmFuc2NyaXB0IGV4aXQuIEFzeW5jIHYtcmVuZGVyIGNhcHR1cmVzIHRoaXMgYXQgc3RhcnQ7XG4gIC8vIGVhY2ggc3RhdHVzIHdyaXRlIG5vLW9wcyBpZiBzdGFsZSAodXNlciBsZWZ0IHRyYW5zY3JpcHQgbWlkLXJlbmRlciDigJRcbiAgLy8gdGhlIHN0YWJsZSBzZXRTdGF0ZSB3b3VsZCBvdGhlcndpc2Ugc3RhbXAgYSBnaG9zdCB0b2FzdCBpbnRvIHRoZSBuZXh0XG4gIC8vIHNlc3Npb24pLiBBbHNvIGNsZWFycyBhbnkgcGVuZGluZyA0cyBhdXRvLWNsZWFyLlxuICBjb25zdCBlZGl0b3JHZW5SZWYgPSB1c2VSZWYoMClcbiAgY29uc3QgZWRpdG9yVGltZXJSZWYgPSB1c2VSZWY8UmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCB1bmRlZmluZWQ+KFxuICAgIHVuZGVmaW5lZCxcbiAgKVxuICBjb25zdCBlZGl0b3JSZW5kZXJpbmdSZWYgPSB1c2VSZWYoZmFsc2UpXG4gIGNvbnN0IHsgYWRkTm90aWZpY2F0aW9uLCByZW1vdmVOb3RpZmljYXRpb24gfSA9IHVzZU5vdGlmaWNhdGlvbnMoKVxuXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBwcmVmZXItY29uc3RcbiAgbGV0IHRyeVN1Z2dlc3RCZ1BSSW50ZXJjZXB0ID0gU1VHR0VTVF9CR19QUl9OT09QXG5cbiAgY29uc3QgbWNwQ2xpZW50cyA9IHVzZU1lcmdlZENsaWVudHMoaW5pdGlhbE1jcENsaWVudHMsIG1jcC5jbGllbnRzKVxuXG4gIC8vIElERSBpbnRlZ3JhdGlvblxuICBjb25zdCBbaWRlU2VsZWN0aW9uLCBzZXRJREVTZWxlY3Rpb25dID0gdXNlU3RhdGU8SURFU2VsZWN0aW9uIHwgdW5kZWZpbmVkPihcbiAgICB1bmRlZmluZWQsXG4gIClcbiAgY29uc3QgW2lkZVRvSW5zdGFsbEV4dGVuc2lvbiwgc2V0SURFVG9JbnN0YWxsRXh0ZW5zaW9uXSA9XG4gICAgdXNlU3RhdGU8SWRlVHlwZSB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtpZGVJbnN0YWxsYXRpb25TdGF0dXMsIHNldElERUluc3RhbGxhdGlvblN0YXR1c10gPVxuICAgIHVzZVN0YXRlPElERUV4dGVuc2lvbkluc3RhbGxhdGlvblN0YXR1cyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtzaG93SWRlT25ib2FyZGluZywgc2V0U2hvd0lkZU9uYm9hcmRpbmddID0gdXNlU3RhdGUoZmFsc2UpXG4gIC8vIERlYWQgY29kZSBlbGltaW5hdGlvbjogbW9kZWwgc3dpdGNoIGNhbGxvdXQgc3RhdGUgKGFudC1vbmx5KVxuICBjb25zdCBbc2hvd01vZGVsU3dpdGNoQ2FsbG91dCwgc2V0U2hvd01vZGVsU3dpdGNoQ2FsbG91dF0gPSB1c2VTdGF0ZSgoKSA9PiB7XG4gICAgaWYgKFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcpIHtcbiAgICAgIHJldHVybiBzaG91bGRTaG93QW50TW9kZWxTd2l0Y2goKVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfSlcbiAgY29uc3QgW3Nob3dFZmZvcnRDYWxsb3V0LCBzZXRTaG93RWZmb3J0Q2FsbG91dF0gPSB1c2VTdGF0ZSgoKSA9PlxuICAgIHNob3VsZFNob3dFZmZvcnRDYWxsb3V0KG1haW5Mb29wTW9kZWwpLFxuICApXG4gIGNvbnN0IHNob3dSZW1vdGVDYWxsb3V0ID0gdXNlQXBwU3RhdGUocyA9PiBzLnNob3dSZW1vdGVDYWxsb3V0KVxuICBjb25zdCBbc2hvd0Rlc2t0b3BVcHNlbGxTdGFydHVwLCBzZXRTaG93RGVza3RvcFVwc2VsbFN0YXJ0dXBdID0gdXNlU3RhdGUoKCkgPT5cbiAgICBzaG91bGRTaG93RGVza3RvcFVwc2VsbFN0YXJ0dXAoKSxcbiAgKVxuICAvLyBub3RpZmljYXRpb25zXG4gIHVzZU1vZGVsTWlncmF0aW9uTm90aWZpY2F0aW9ucygpXG4gIHVzZUNhblN3aXRjaFRvRXhpc3RpbmdTdWJzY3JpcHRpb24oKVxuICB1c2VJREVTdGF0dXNJbmRpY2F0b3IoeyBpZGVTZWxlY3Rpb24sIG1jcENsaWVudHMsIGlkZUluc3RhbGxhdGlvblN0YXR1cyB9KVxuICB1c2VNY3BDb25uZWN0aXZpdHlTdGF0dXMoeyBtY3BDbGllbnRzIH0pXG4gIHVzZUF1dG9Nb2RlVW5hdmFpbGFibGVOb3RpZmljYXRpb24oKVxuICB1c2VQbHVnaW5JbnN0YWxsYXRpb25TdGF0dXMoKVxuICB1c2VQbHVnaW5BdXRvdXBkYXRlTm90aWZpY2F0aW9uKClcbiAgdXNlU2V0dGluZ3NFcnJvcnMoKVxuICB1c2VSYXRlTGltaXRXYXJuaW5nTm90aWZpY2F0aW9uKG1haW5Mb29wTW9kZWwpXG4gIHVzZUZhc3RNb2RlTm90aWZpY2F0aW9uKClcbiAgdXNlRGVwcmVjYXRpb25XYXJuaW5nTm90aWZpY2F0aW9uKG1haW5Mb29wTW9kZWwpXG4gIHVzZU5wbURlcHJlY2F0aW9uTm90aWZpY2F0aW9uKClcbiAgdXNlQW50T3JnV2FybmluZ05vdGlmaWNhdGlvbigpXG4gIHVzZUluc3RhbGxNZXNzYWdlcygpXG4gIHVzZUNocm9tZUV4dGVuc2lvbk5vdGlmaWNhdGlvbigpXG4gIHVzZU9mZmljaWFsTWFya2V0cGxhY2VOb3RpZmljYXRpb24oKVxuICB1c2VMc3BJbml0aWFsaXphdGlvbk5vdGlmaWNhdGlvbigpXG4gIHVzZVRlYW1tYXRlTGlmZWN5Y2xlTm90aWZpY2F0aW9uKClcbiAgY29uc3Qge1xuICAgIHJlY29tbWVuZGF0aW9uOiBsc3BSZWNvbW1lbmRhdGlvbixcbiAgICBoYW5kbGVSZXNwb25zZTogaGFuZGxlTHNwUmVzcG9uc2UsXG4gIH0gPSB1c2VMc3BQbHVnaW5SZWNvbW1lbmRhdGlvbigpXG4gIGNvbnN0IHtcbiAgICByZWNvbW1lbmRhdGlvbjogaGludFJlY29tbWVuZGF0aW9uLFxuICAgIGhhbmRsZVJlc3BvbnNlOiBoYW5kbGVIaW50UmVzcG9uc2UsXG4gIH0gPSB1c2VDbGF1ZGVDb2RlSGludFJlY29tbWVuZGF0aW9uKClcblxuICAvLyBNZW1vaXplIHRoZSBjb21iaW5lZCBpbml0aWFsIHRvb2xzIGFycmF5IHRvIHByZXZlbnQgcmVmZXJlbmNlIGNoYW5nZXNcbiAgY29uc3QgY29tYmluZWRJbml0aWFsVG9vbHMgPSB1c2VNZW1vKCgpID0+IHtcbiAgICByZXR1cm4gWy4uLmxvY2FsVG9vbHMsIC4uLmluaXRpYWxUb29sc11cbiAgfSwgW2xvY2FsVG9vbHMsIGluaXRpYWxUb29sc10pXG5cbiAgLy8gSW5pdGlhbGl6ZSBwbHVnaW4gbWFuYWdlbWVudFxuICB1c2VNYW5hZ2VQbHVnaW5zKHsgZW5hYmxlZDogIWlzUmVtb3RlU2Vzc2lvbiB9KVxuXG4gIGNvbnN0IHRhc2tzVjIgPSB1c2VUYXNrc1YyV2l0aENvbGxhcHNlRWZmZWN0KClcblxuICAvLyBTdGFydCBiYWNrZ3JvdW5kIHBsdWdpbiBpbnN0YWxsYXRpb25zXG5cbiAgLy8gU0VDVVJJVFk6IFRoaXMgY29kZSBpcyBndWFyYW50ZWVkIHRvIHJ1biBPTkxZIGFmdGVyIHRoZSBcInRydXN0IHRoaXMgZm9sZGVyXCIgZGlhbG9nXG4gIC8vIGhhcyBiZWVuIGNvbmZpcm1lZCBieSB0aGUgdXNlci4gVGhlIHRydXN0IGRpYWxvZyBpcyBzaG93biBpbiBjbGkudHN4IChsaW5lIH4zODcpXG4gIC8vIGJlZm9yZSB0aGUgUkVQTCBjb21wb25lbnQgaXMgcmVuZGVyZWQuIFRoZSBkaWFsb2cgYmxvY2tzIGV4ZWN1dGlvbiB1bnRpbCB0aGUgdXNlclxuICAvLyBhY2NlcHRzLCBhbmQgb25seSB0aGVuIGlzIHRoZSBSRVBMIGNvbXBvbmVudCBtb3VudGVkIGFuZCB0aGlzIGVmZmVjdCBydW5zLlxuICAvLyBUaGlzIGVuc3VyZXMgdGhhdCBwbHVnaW4gaW5zdGFsbGF0aW9ucyBmcm9tIHJlcG9zaXRvcnkgYW5kIHVzZXIgc2V0dGluZ3Mgb25seVxuICAvLyBoYXBwZW4gYWZ0ZXIgZXhwbGljaXQgdXNlciBjb25zZW50IHRvIHRydXN0IHRoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5LlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChpc1JlbW90ZVNlc3Npb24pIHJldHVyblxuICAgIHZvaWQgcGVyZm9ybVN0YXJ0dXBDaGVja3Moc2V0QXBwU3RhdGUpXG4gIH0sIFtzZXRBcHBTdGF0ZSwgaXNSZW1vdGVTZXNzaW9uXSlcblxuICAvLyBBbGxvdyBDbGF1ZGUgaW4gQ2hyb21lIE1DUCB0byBzZW5kIHByb21wdHMgdGhyb3VnaCBNQ1Agbm90aWZpY2F0aW9uc1xuICAvLyBhbmQgc3luYyBwZXJtaXNzaW9uIG1vZGUgY2hhbmdlcyB0byB0aGUgQ2hyb21lIGV4dGVuc2lvblxuICB1c2VQcm9tcHRzRnJvbUNsYXVkZUluQ2hyb21lKFxuICAgIGlzUmVtb3RlU2Vzc2lvbiA/IEVNUFRZX01DUF9DTElFTlRTIDogbWNwQ2xpZW50cyxcbiAgICB0b29sUGVybWlzc2lvbkNvbnRleHQubW9kZSxcbiAgKVxuXG4gIC8vIEluaXRpYWxpemUgc3dhcm0gZmVhdHVyZXM6IHRlYW1tYXRlIGhvb2tzIGFuZCBjb250ZXh0XG4gIC8vIEhhbmRsZXMgYm90aCBmcmVzaCBzcGF3bnMgYW5kIHJlc3VtZWQgdGVhbW1hdGUgc2Vzc2lvbnNcbiAgdXNlU3dhcm1Jbml0aWFsaXphdGlvbihzZXRBcHBTdGF0ZSwgaW5pdGlhbE1lc3NhZ2VzLCB7XG4gICAgZW5hYmxlZDogIWlzUmVtb3RlU2Vzc2lvbixcbiAgfSlcblxuICBjb25zdCBtZXJnZWRUb29scyA9IHVzZU1lcmdlZFRvb2xzKFxuICAgIGNvbWJpbmVkSW5pdGlhbFRvb2xzLFxuICAgIG1jcC50b29scyxcbiAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gIClcblxuICAvLyBBcHBseSBhZ2VudCB0b29sIHJlc3RyaWN0aW9ucyBpZiBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uIGlzIHNldFxuICBjb25zdCB7IHRvb2xzLCBhbGxvd2VkQWdlbnRUeXBlcyB9ID0gdXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCFtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b29sczogbWVyZ2VkVG9vbHMsXG4gICAgICAgIGFsbG93ZWRBZ2VudFR5cGVzOiB1bmRlZmluZWQgYXMgc3RyaW5nW10gfCB1bmRlZmluZWQsXG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHJlc29sdmVkID0gcmVzb2x2ZUFnZW50VG9vbHMoXG4gICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLFxuICAgICAgbWVyZ2VkVG9vbHMsXG4gICAgICBmYWxzZSxcbiAgICAgIHRydWUsXG4gICAgKVxuICAgIHJldHVybiB7XG4gICAgICB0b29sczogcmVzb2x2ZWQucmVzb2x2ZWRUb29scyxcbiAgICAgIGFsbG93ZWRBZ2VudFR5cGVzOiByZXNvbHZlZC5hbGxvd2VkQWdlbnRUeXBlcyxcbiAgICB9XG4gIH0sIFttYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLCBtZXJnZWRUb29sc10pXG5cbiAgLy8gTWVyZ2UgY29tbWFuZHMgZnJvbSBsb2NhbCBzdGF0ZSwgcGx1Z2lucywgYW5kIE1DUFxuICBjb25zdCBjb21tYW5kc1dpdGhQbHVnaW5zID0gdXNlTWVyZ2VkQ29tbWFuZHMoXG4gICAgbG9jYWxDb21tYW5kcyxcbiAgICBwbHVnaW5zLmNvbW1hbmRzIGFzIENvbW1hbmRbXSxcbiAgKVxuICBjb25zdCBtZXJnZWRDb21tYW5kcyA9IHVzZU1lcmdlZENvbW1hbmRzKFxuICAgIGNvbW1hbmRzV2l0aFBsdWdpbnMsXG4gICAgbWNwLmNvbW1hbmRzIGFzIENvbW1hbmRbXSxcbiAgKVxuICAvLyBGaWx0ZXIgb3V0IGFsbCBjb21tYW5kcyBpZiBkaXNhYmxlU2xhc2hDb21tYW5kcyBpcyB0cnVlXG4gIGNvbnN0IGNvbW1hbmRzID0gdXNlTWVtbyhcbiAgICAoKSA9PiAoZGlzYWJsZVNsYXNoQ29tbWFuZHMgPyBbXSA6IG1lcmdlZENvbW1hbmRzKSxcbiAgICBbZGlzYWJsZVNsYXNoQ29tbWFuZHMsIG1lcmdlZENvbW1hbmRzXSxcbiAgKVxuXG4gIHVzZUlkZUxvZ2dpbmcoaXNSZW1vdGVTZXNzaW9uID8gRU1QVFlfTUNQX0NMSUVOVFMgOiBtY3AuY2xpZW50cylcbiAgdXNlSWRlU2VsZWN0aW9uKFxuICAgIGlzUmVtb3RlU2Vzc2lvbiA/IEVNUFRZX01DUF9DTElFTlRTIDogbWNwLmNsaWVudHMsXG4gICAgc2V0SURFU2VsZWN0aW9uLFxuICApXG5cbiAgY29uc3QgW3N0cmVhbU1vZGUsIHNldFN0cmVhbU1vZGVdID0gdXNlU3RhdGU8U3Bpbm5lck1vZGU+KCdyZXNwb25kaW5nJylcbiAgLy8gUmVmIG1pcnJvciBzbyBvblN1Ym1pdCBjYW4gcmVhZCB0aGUgbGF0ZXN0IHZhbHVlIHdpdGhvdXQgYWRkaW5nXG4gIC8vIHN0cmVhbU1vZGUgdG8gaXRzIGRlcHMuIHN0cmVhbU1vZGUgZmxpcHMgYmV0d2VlblxuICAvLyByZXF1ZXN0aW5nL3Jlc3BvbmRpbmcvdG9vbC11c2UgfjEweCBwZXIgdHVybiBkdXJpbmcgc3RyZWFtaW5nOyBoYXZpbmcgaXRcbiAgLy8gaW4gb25TdWJtaXQncyBkZXBzIHdhcyByZWNyZWF0aW5nIG9uU3VibWl0IG9uIGV2ZXJ5IGZsaXAsIHdoaWNoXG4gIC8vIGNhc2NhZGVkIGludG8gUHJvbXB0SW5wdXQgcHJvcCBjaHVybiBhbmQgZG93bnN0cmVhbSB1c2VDYWxsYmFjay91c2VNZW1vXG4gIC8vIGludmFsaWRhdGlvbi4gVGhlIG9ubHkgY29uc3VtZXJzIGluc2lkZSBjYWxsYmFja3MgYXJlIGRlYnVnIGxvZ2dpbmcgYW5kXG4gIC8vIHRlbGVtZXRyeSAoaGFuZGxlUHJvbXB0U3VibWl0LnRzKSwgc28gYSBzdGFsZS1ieS1vbmUtcmVuZGVyIHZhbHVlIGlzXG4gIC8vIGhhcm1sZXNzIOKAlCBidXQgcmVmIG1pcnJvcnMgc3luYyBvbiBldmVyeSByZW5kZXIgYW55d2F5IHNvIGl0J3MgZnJlc2guXG4gIGNvbnN0IHN0cmVhbU1vZGVSZWYgPSB1c2VSZWYoc3RyZWFtTW9kZSlcbiAgc3RyZWFtTW9kZVJlZi5jdXJyZW50ID0gc3RyZWFtTW9kZVxuICBjb25zdCBbc3RyZWFtaW5nVG9vbFVzZXMsIHNldFN0cmVhbWluZ1Rvb2xVc2VzXSA9IHVzZVN0YXRlPFxuICAgIFN0cmVhbWluZ1Rvb2xVc2VbXVxuICA+KFtdKVxuICBjb25zdCBbc3RyZWFtaW5nVGhpbmtpbmcsIHNldFN0cmVhbWluZ1RoaW5raW5nXSA9XG4gICAgdXNlU3RhdGU8U3RyZWFtaW5nVGhpbmtpbmcgfCBudWxsPihudWxsKVxuXG4gIC8vIEF1dG8taGlkZSBzdHJlYW1pbmcgdGhpbmtpbmcgYWZ0ZXIgMzAgc2Vjb25kcyBvZiBiZWluZyBjb21wbGV0ZWRcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoXG4gICAgICBzdHJlYW1pbmdUaGlua2luZyAmJlxuICAgICAgIXN0cmVhbWluZ1RoaW5raW5nLmlzU3RyZWFtaW5nICYmXG4gICAgICBzdHJlYW1pbmdUaGlua2luZy5zdHJlYW1pbmdFbmRlZEF0XG4gICAgKSB7XG4gICAgICBjb25zdCBlbGFwc2VkID0gRGF0ZS5ub3coKSAtIHN0cmVhbWluZ1RoaW5raW5nLnN0cmVhbWluZ0VuZGVkQXRcbiAgICAgIGNvbnN0IHJlbWFpbmluZyA9IDMwMDAwIC0gZWxhcHNlZFxuICAgICAgaWYgKHJlbWFpbmluZyA+IDApIHtcbiAgICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KHNldFN0cmVhbWluZ1RoaW5raW5nLCByZW1haW5pbmcsIG51bGwpXG4gICAgICAgIHJldHVybiAoKSA9PiBjbGVhclRpbWVvdXQodGltZXIpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRTdHJlYW1pbmdUaGlua2luZyhudWxsKVxuICAgICAgfVxuICAgIH1cbiAgfSwgW3N0cmVhbWluZ1RoaW5raW5nXSlcblxuICBjb25zdCBbYWJvcnRDb250cm9sbGVyLCBzZXRBYm9ydENvbnRyb2xsZXJdID1cbiAgICB1c2VTdGF0ZTxBYm9ydENvbnRyb2xsZXIgfCBudWxsPihudWxsKVxuICAvLyBSZWYgdGhhdCBhbHdheXMgcG9pbnRzIHRvIHRoZSBjdXJyZW50IGFib3J0IGNvbnRyb2xsZXIsIHVzZWQgYnkgdGhlXG4gIC8vIFJFUEwgYnJpZGdlIHRvIGFib3J0IHRoZSBhY3RpdmUgcXVlcnkgd2hlbiBhIHJlbW90ZSBpbnRlcnJ1cHQgYXJyaXZlcy5cbiAgY29uc3QgYWJvcnRDb250cm9sbGVyUmVmID0gdXNlUmVmPEFib3J0Q29udHJvbGxlciB8IG51bGw+KG51bGwpXG4gIGFib3J0Q29udHJvbGxlclJlZi5jdXJyZW50ID0gYWJvcnRDb250cm9sbGVyXG5cbiAgLy8gUmVmIGZvciB0aGUgYnJpZGdlIHJlc3VsdCBjYWxsYmFjayDigJQgc2V0IGFmdGVyIHVzZVJlcGxCcmlkZ2UgaW5pdGlhbGl6ZXMsXG4gIC8vIHJlYWQgaW4gdGhlIG9uUXVlcnkgZmluYWxseSBibG9jayB0byBub3RpZnkgbW9iaWxlIGNsaWVudHMgdGhhdCBhIHR1cm4gZW5kZWQuXG4gIGNvbnN0IHNlbmRCcmlkZ2VSZXN1bHRSZWYgPSB1c2VSZWY8KCkgPT4gdm9pZD4oKCkgPT4ge30pXG5cbiAgLy8gUmVmIGZvciB0aGUgc3luY2hyb25vdXMgcmVzdG9yZSBjYWxsYmFjayDigJQgc2V0IGFmdGVyIHJlc3RvcmVNZXNzYWdlU3luYyBpc1xuICAvLyBkZWZpbmVkLCByZWFkIGluIHRoZSBvblF1ZXJ5IGZpbmFsbHkgYmxvY2sgZm9yIGF1dG8tcmVzdG9yZSBvbiBpbnRlcnJ1cHQuXG4gIGNvbnN0IHJlc3RvcmVNZXNzYWdlU3luY1JlZiA9IHVzZVJlZjwobTogVXNlck1lc3NhZ2UpID0+IHZvaWQ+KCgpID0+IHt9KVxuXG4gIC8vIFJlZiB0byB0aGUgZnVsbHNjcmVlbiBsYXlvdXQncyBzY3JvbGwgYm94IGZvciBrZXlib2FyZCBzY3JvbGxpbmcuXG4gIC8vIE51bGwgd2hlbiBmdWxsc2NyZWVuIG1vZGUgaXMgZGlzYWJsZWQgKHJlZiBuZXZlciBhdHRhY2hlZCkuXG4gIGNvbnN0IHNjcm9sbFJlZiA9IHVzZVJlZjxTY3JvbGxCb3hIYW5kbGU+KG51bGwpXG4gIC8vIFNlcGFyYXRlIHJlZiBmb3IgdGhlIG1vZGFsIHNsb3QncyBpbm5lciBTY3JvbGxCb3gg4oCUIHBhc3NlZCB0aHJvdWdoXG4gIC8vIEZ1bGxzY3JlZW5MYXlvdXQg4oaSIE1vZGFsQ29udGV4dCBzbyBUYWJzIGNhbiBhdHRhY2ggaXQgdG8gaXRzIG93blxuICAvLyBTY3JvbGxCb3ggZm9yIHRhbGwgY29udGVudCAoZS5nLiAvc3RhdHVzJ3MgTUNQLXNlcnZlciBsaXN0KS4gTk9UXG4gIC8vIGtleWJvYXJkLWRyaXZlbiDigJQgU2Nyb2xsS2V5YmluZGluZ0hhbmRsZXIgc3RheXMgb24gdGhlIG91dGVyIHJlZiBzb1xuICAvLyBQZ1VwL1BnRG4vd2hlZWwgYWx3YXlzIHNjcm9sbCB0aGUgdHJhbnNjcmlwdCBiZWhpbmQgdGhlIG1vZGFsLlxuICAvLyBQbHVtYmluZyBrZXB0IGZvciBmdXR1cmUgbW9kYWwtc2Nyb2xsIHdpcmluZy5cbiAgY29uc3QgbW9kYWxTY3JvbGxSZWYgPSB1c2VSZWY8U2Nyb2xsQm94SGFuZGxlPihudWxsKVxuICAvLyBUaW1lc3RhbXAgb2YgdGhlIGxhc3QgdXNlci1pbml0aWF0ZWQgc2Nyb2xsICh3aGVlbCwgUGdVcC9QZ0RuLCBjdHJsK3UsXG4gIC8vIEVuZC9Ib21lLCBHLCBkcmFnLXRvLXNjcm9sbCkuIFN0YW1wZWQgaW4gY29tcG9zZWRPblNjcm9sbCDigJQgdGhlIHNpbmdsZVxuICAvLyBjaG9rZXBvaW50IFNjcm9sbEtleWJpbmRpbmdIYW5kbGVyIGNhbGxzIGZvciBldmVyeSB1c2VyIHNjcm9sbCBhY3Rpb24uXG4gIC8vIFByb2dyYW1tYXRpYyBzY3JvbGxzIChyZXBpblNjcm9sbCdzIHNjcm9sbFRvQm90dG9tLCBzdGlja3kgYXV0by1mb2xsb3cpXG4gIC8vIGRvIE5PVCBnbyB0aHJvdWdoIGNvbXBvc2VkT25TY3JvbGwsIHNvIHRoZXkgZG9uJ3Qgc3RhbXAgdGhpcy4gUmVmIG5vdFxuICAvLyBzdGF0ZTogbm8gcmUtcmVuZGVyIG9uIGV2ZXJ5IHdoZWVsIHRpY2suXG4gIGNvbnN0IGxhc3RVc2VyU2Nyb2xsVHNSZWYgPSB1c2VSZWYoMClcblxuICAvLyBTeW5jaHJvbm91cyBzdGF0ZSBtYWNoaW5lIGZvciB0aGUgcXVlcnkgbGlmZWN5Y2xlLiBSZXBsYWNlcyB0aGVcbiAgLy8gZXJyb3ItcHJvbmUgZHVhbC1zdGF0ZSBwYXR0ZXJuIHdoZXJlIGlzTG9hZGluZyAoUmVhY3Qgc3RhdGUsIGFzeW5jXG4gIC8vIGJhdGNoZWQpIGFuZCBpc1F1ZXJ5UnVubmluZyAocmVmLCBzeW5jKSBjb3VsZCBkZXN5bmMuIFNlZSBRdWVyeUd1YXJkLnRzLlxuICBjb25zdCBxdWVyeUd1YXJkID0gUmVhY3QudXNlUmVmKG5ldyBRdWVyeUd1YXJkKCkpLmN1cnJlbnRcblxuICAvLyBTdWJzY3JpYmUgdG8gdGhlIGd1YXJkIOKAlCB0cnVlIGR1cmluZyBkaXNwYXRjaGluZyBvciBydW5uaW5nLlxuICAvLyBUaGlzIGlzIHRoZSBzaW5nbGUgc291cmNlIG9mIHRydXRoIGZvciBcImlzIGEgbG9jYWwgcXVlcnkgaW4gZmxpZ2h0XCIuXG4gIGNvbnN0IGlzUXVlcnlBY3RpdmUgPSBSZWFjdC51c2VTeW5jRXh0ZXJuYWxTdG9yZShcbiAgICBxdWVyeUd1YXJkLnN1YnNjcmliZSxcbiAgICBxdWVyeUd1YXJkLmdldFNuYXBzaG90LFxuICApXG5cbiAgLy8gU2VwYXJhdGUgbG9hZGluZyBmbGFnIGZvciBvcGVyYXRpb25zIG91dHNpZGUgdGhlIGxvY2FsIHF1ZXJ5IGd1YXJkOlxuICAvLyByZW1vdGUgc2Vzc2lvbnMgKHVzZVJlbW90ZVNlc3Npb24gLyB1c2VEaXJlY3RDb25uZWN0KSBhbmQgZm9yZWdyb3VuZGVkXG4gIC8vIGJhY2tncm91bmQgdGFza3MgKHVzZVNlc3Npb25CYWNrZ3JvdW5kaW5nKS4gVGhlc2UgZG9uJ3Qgcm91dGUgdGhyb3VnaFxuICAvLyBvblF1ZXJ5IC8gcXVlcnlHdWFyZCwgc28gdGhleSBuZWVkIHRoZWlyIG93biBzcGlubmVyLXZpc2liaWxpdHkgc3RhdGUuXG4gIC8vIEluaXRpYWxpemUgdHJ1ZSBpZiByZW1vdGUgbW9kZSB3aXRoIGluaXRpYWwgcHJvbXB0IChDQ1IgcHJvY2Vzc2luZyBpdCkuXG4gIGNvbnN0IFtpc0V4dGVybmFsTG9hZGluZywgc2V0SXNFeHRlcm5hbExvYWRpbmdSYXddID0gUmVhY3QudXNlU3RhdGUoXG4gICAgcmVtb3RlU2Vzc2lvbkNvbmZpZz8uaGFzSW5pdGlhbFByb21wdCA/PyBmYWxzZSxcbiAgKVxuXG4gIC8vIERlcml2ZWQ6IGFueSBsb2FkaW5nIHNvdXJjZSBhY3RpdmUuIFJlYWQtb25seSDigJQgbm8gc2V0dGVyLiBMb2NhbCBxdWVyeVxuICAvLyBsb2FkaW5nIGlzIGRyaXZlbiBieSBxdWVyeUd1YXJkIChyZXNlcnZlL3RyeVN0YXJ0L2VuZC9jYW5jZWxSZXNlcnZhdGlvbiksXG4gIC8vIGV4dGVybmFsIGxvYWRpbmcgYnkgc2V0SXNFeHRlcm5hbExvYWRpbmcuXG4gIGNvbnN0IGlzTG9hZGluZyA9IGlzUXVlcnlBY3RpdmUgfHwgaXNFeHRlcm5hbExvYWRpbmdcblxuICAvLyBFbGFwc2VkIHRpbWUgaXMgY29tcHV0ZWQgYnkgU3Bpbm5lcldpdGhWZXJiIGZyb20gdGhlc2UgcmVmcyBvbiBlYWNoXG4gIC8vIGFuaW1hdGlvbiBmcmFtZSwgYXZvaWRpbmcgYSB1c2VJbnRlcnZhbCB0aGF0IHJlLXJlbmRlcnMgdGhlIGVudGlyZSBSRVBMLlxuICBjb25zdCBbdXNlcklucHV0T25Qcm9jZXNzaW5nLCBzZXRVc2VySW5wdXRPblByb2Nlc3NpbmdSYXddID0gUmVhY3QudXNlU3RhdGU8XG4gICAgc3RyaW5nIHwgdW5kZWZpbmVkXG4gID4odW5kZWZpbmVkKVxuICAvLyBtZXNzYWdlc1JlZi5jdXJyZW50Lmxlbmd0aCBhdCB0aGUgbW9tZW50IHVzZXJJbnB1dE9uUHJvY2Vzc2luZyB3YXMgc2V0LlxuICAvLyBUaGUgcGxhY2Vob2xkZXIgaGlkZXMgb25jZSBkaXNwbGF5ZWRNZXNzYWdlcyBncm93cyBwYXN0IHRoaXMg4oCUIGkuZS4gdGhlXG4gIC8vIHJlYWwgdXNlciBtZXNzYWdlIGhhcyBsYW5kZWQgaW4gdGhlIHZpc2libGUgdHJhbnNjcmlwdC5cbiAgY29uc3QgdXNlcklucHV0QmFzZWxpbmVSZWYgPSBSZWFjdC51c2VSZWYoMClcbiAgLy8gVHJ1ZSB3aGlsZSB0aGUgc3VibWl0dGVkIHByb21wdCBpcyBiZWluZyBwcm9jZXNzZWQgYnV0IGl0cyB1c2VyIG1lc3NhZ2VcbiAgLy8gaGFzbid0IHJlYWNoZWQgc2V0TWVzc2FnZXMgeWV0LiBzZXRNZXNzYWdlcyB1c2VzIHRoaXMgdG8ga2VlcCB0aGVcbiAgLy8gYmFzZWxpbmUgaW4gc3luYyB3aGVuIHVucmVsYXRlZCBhc3luYyBtZXNzYWdlcyAoYnJpZGdlIHN0YXR1cywgaG9va1xuICAvLyByZXN1bHRzLCBzY2hlZHVsZWQgdGFza3MpIGxhbmQgZHVyaW5nIHRoYXQgd2luZG93LlxuICBjb25zdCB1c2VyTWVzc2FnZVBlbmRpbmdSZWYgPSBSZWFjdC51c2VSZWYoZmFsc2UpXG5cbiAgLy8gV2FsbC1jbG9jayB0aW1lIHRyYWNraW5nIHJlZnMgZm9yIGFjY3VyYXRlIGVsYXBzZWQgdGltZSBjYWxjdWxhdGlvblxuICBjb25zdCBsb2FkaW5nU3RhcnRUaW1lUmVmID0gUmVhY3QudXNlUmVmPG51bWJlcj4oMClcbiAgY29uc3QgdG90YWxQYXVzZWRNc1JlZiA9IFJlYWN0LnVzZVJlZigwKVxuICBjb25zdCBwYXVzZVN0YXJ0VGltZVJlZiA9IFJlYWN0LnVzZVJlZjxudW1iZXIgfCBudWxsPihudWxsKVxuICBjb25zdCByZXNldFRpbWluZ1JlZnMgPSBSZWFjdC51c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgbG9hZGluZ1N0YXJ0VGltZVJlZi5jdXJyZW50ID0gRGF0ZS5ub3coKVxuICAgIHRvdGFsUGF1c2VkTXNSZWYuY3VycmVudCA9IDBcbiAgICBwYXVzZVN0YXJ0VGltZVJlZi5jdXJyZW50ID0gbnVsbFxuICB9LCBbXSlcblxuICAvLyBSZXNldCB0aW1pbmcgcmVmcyBpbmxpbmUgd2hlbiBpc1F1ZXJ5QWN0aXZlIHRyYW5zaXRpb25zIGZhbHNl4oaSdHJ1ZS5cbiAgLy8gcXVlcnlHdWFyZC5yZXNlcnZlKCkgKGluIGV4ZWN1dGVVc2VySW5wdXQpIGZpcmVzIEJFRk9SRSBwcm9jZXNzVXNlcklucHV0J3NcbiAgLy8gZmlyc3QgYXdhaXQsIGJ1dCB0aGUgcmVmIHJlc2V0IGluIG9uUXVlcnkncyB0cnkgYmxvY2sgcnVucyBBRlRFUi4gRHVyaW5nXG4gIC8vIHRoYXQgZ2FwLCBSZWFjdCByZW5kZXJzIHRoZSBzcGlubmVyIHdpdGggbG9hZGluZ1N0YXJ0VGltZVJlZj0wLCBjb21wdXRpbmdcbiAgLy8gZWxhcHNlZFRpbWVNcyA9IERhdGUubm93KCkgLSAwIOKJiCA1NiB5ZWFycy4gVGhpcyBpbmxpbmUgcmVzZXQgcnVucyBvbiB0aGVcbiAgLy8gZmlyc3QgcmVuZGVyIHdoZXJlIGlzUXVlcnlBY3RpdmUgaXMgb2JzZXJ2ZWQgdHJ1ZSDigJQgdGhlIHNhbWUgcmVuZGVyIHRoYXRcbiAgLy8gZmlyc3Qgc2hvd3MgdGhlIHNwaW5uZXIg4oCUIHNvIHRoZSByZWYgaXMgY29ycmVjdCBieSB0aGUgdGltZSB0aGUgc3Bpbm5lclxuICAvLyByZWFkcyBpdC4gU2VlIElOQy00NTQ5LlxuICBjb25zdCB3YXNRdWVyeUFjdGl2ZVJlZiA9IFJlYWN0LnVzZVJlZihmYWxzZSlcbiAgaWYgKGlzUXVlcnlBY3RpdmUgJiYgIXdhc1F1ZXJ5QWN0aXZlUmVmLmN1cnJlbnQpIHtcbiAgICByZXNldFRpbWluZ1JlZnMoKVxuICB9XG4gIHdhc1F1ZXJ5QWN0aXZlUmVmLmN1cnJlbnQgPSBpc1F1ZXJ5QWN0aXZlXG5cbiAgLy8gV3JhcHBlciBmb3Igc2V0SXNFeHRlcm5hbExvYWRpbmcgdGhhdCByZXNldHMgdGltaW5nIHJlZnMgb24gdHJhbnNpdGlvblxuICAvLyB0byB0cnVlIOKAlCBTcGlubmVyV2l0aFZlcmIgcmVhZHMgdGhlc2UgZm9yIGVsYXBzZWQgdGltZSwgc28gdGhleSBtdXN0IGJlXG4gIC8vIHJlc2V0IGZvciByZW1vdGUgc2Vzc2lvbnMgLyBmb3JlZ3JvdW5kZWQgdGFza3MgdG9vIChub3QganVzdCBsb2NhbFxuICAvLyBxdWVyaWVzLCB3aGljaCByZXNldCB0aGVtIGluIG9uUXVlcnkpLiBXaXRob3V0IHRoaXMsIGEgcmVtb3RlLW9ubHlcbiAgLy8gc2Vzc2lvbiB3b3VsZCBzaG93IH41NiB5ZWFycyBlbGFwc2VkIChEYXRlLm5vdygpIC0gMCkuXG4gIGNvbnN0IHNldElzRXh0ZXJuYWxMb2FkaW5nID0gUmVhY3QudXNlQ2FsbGJhY2soXG4gICAgKHZhbHVlOiBib29sZWFuKSA9PiB7XG4gICAgICBzZXRJc0V4dGVybmFsTG9hZGluZ1Jhdyh2YWx1ZSlcbiAgICAgIGlmICh2YWx1ZSkgcmVzZXRUaW1pbmdSZWZzKClcbiAgICB9LFxuICAgIFtyZXNldFRpbWluZ1JlZnNdLFxuICApXG5cbiAgLy8gU3RhcnQgdGltZSBvZiB0aGUgZmlyc3QgdHVybiB0aGF0IGhhZCBzd2FybSB0ZWFtbWF0ZXMgcnVubmluZ1xuICAvLyBVc2VkIHRvIGNvbXB1dGUgdG90YWwgZWxhcHNlZCB0aW1lIChpbmNsdWRpbmcgdGVhbW1hdGUgZXhlY3V0aW9uKSBmb3IgdGhlIGRlZmVycmVkIG1lc3NhZ2VcbiAgY29uc3Qgc3dhcm1TdGFydFRpbWVSZWYgPSBSZWFjdC51c2VSZWY8bnVtYmVyIHwgbnVsbD4obnVsbClcbiAgY29uc3Qgc3dhcm1CdWRnZXRJbmZvUmVmID0gUmVhY3QudXNlUmVmPFxuICAgIHsgdG9rZW5zOiBudW1iZXI7IGxpbWl0OiBudW1iZXI7IG51ZGdlczogbnVtYmVyIH0gfCB1bmRlZmluZWRcbiAgPih1bmRlZmluZWQpXG5cbiAgLy8gUmVmIHRvIHRyYWNrIGN1cnJlbnQgZm9jdXNlZElucHV0RGlhbG9nIGZvciB1c2UgaW4gY2FsbGJhY2tzXG4gIC8vIFRoaXMgYXZvaWRzIHN0YWxlIGNsb3N1cmVzIHdoZW4gY2hlY2tpbmcgZGlhbG9nIHN0YXRlIGluIHRpbWVyIGNhbGxiYWNrc1xuICBjb25zdCBmb2N1c2VkSW5wdXREaWFsb2dSZWYgPVxuICAgIFJlYWN0LnVzZVJlZjxSZXR1cm5UeXBlPHR5cGVvZiBnZXRGb2N1c2VkSW5wdXREaWFsb2c+Pih1bmRlZmluZWQpXG5cbiAgLy8gSG93IGxvbmcgYWZ0ZXIgdGhlIGxhc3Qga2V5c3Ryb2tlIGJlZm9yZSBkZWZlcnJlZCBkaWFsb2dzIGFyZSBzaG93blxuICBjb25zdCBQUk9NUFRfU1VQUFJFU1NJT05fTVMgPSAxNTAwXG4gIC8vIFRydWUgd2hlbiB1c2VyIGlzIGFjdGl2ZWx5IHR5cGluZyDigJQgZGVmZXJzIGludGVycnVwdCBkaWFsb2dzIHNvIGtleXN0cm9rZXNcbiAgLy8gZG9uJ3QgYWNjaWRlbnRhbGx5IGRpc21pc3Mgb3IgYW5zd2VyIGEgcGVybWlzc2lvbiBwcm9tcHQgdGhlIHVzZXIgaGFzbid0IHJlYWQgeWV0LlxuICBjb25zdCBbaXNQcm9tcHRJbnB1dEFjdGl2ZSwgc2V0SXNQcm9tcHRJbnB1dEFjdGl2ZV0gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSlcblxuICBjb25zdCBbYXV0b1VwZGF0ZXJSZXN1bHQsIHNldEF1dG9VcGRhdGVyUmVzdWx0XSA9XG4gICAgdXNlU3RhdGU8QXV0b1VwZGF0ZXJSZXN1bHQgfCBudWxsPihudWxsKVxuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGF1dG9VcGRhdGVyUmVzdWx0Py5ub3RpZmljYXRpb25zKSB7XG4gICAgICBhdXRvVXBkYXRlclJlc3VsdC5ub3RpZmljYXRpb25zLmZvckVhY2gobm90aWZpY2F0aW9uID0+IHtcbiAgICAgICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgICAgICBrZXk6ICdhdXRvLXVwZGF0ZXItbm90aWZpY2F0aW9uJyxcbiAgICAgICAgICB0ZXh0OiBub3RpZmljYXRpb24sXG4gICAgICAgICAgcHJpb3JpdHk6ICdsb3cnLFxuICAgICAgICB9KVxuICAgICAgfSlcbiAgICB9XG4gIH0sIFthdXRvVXBkYXRlclJlc3VsdCwgYWRkTm90aWZpY2F0aW9uXSlcblxuICAvLyB0bXV4ICsgZnVsbHNjcmVlbiArIGBtb3VzZSBvZmZgOiBvbmUtdGltZSBoaW50IHRoYXQgd2hlZWwgd29uJ3Qgc2Nyb2xsLlxuICAvLyBXZSBubyBsb25nZXIgbXV0YXRlIHRtdXgncyBzZXNzaW9uLXNjb3BlZCBtb3VzZSBvcHRpb24gKGl0IHBvaXNvbmVkXG4gIC8vIHNpYmxpbmcgcGFuZXMpOyB0bXV4IHVzZXJzIGFscmVhZHkga25vdyB0aGlzIHRyYWRlb2ZmIGZyb20gdmltL2xlc3MuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSkge1xuICAgICAgdm9pZCBtYXliZUdldFRtdXhNb3VzZUhpbnQoKS50aGVuKGhpbnQgPT4ge1xuICAgICAgICBpZiAoaGludCkge1xuICAgICAgICAgIGFkZE5vdGlmaWNhdGlvbih7XG4gICAgICAgICAgICBrZXk6ICd0bXV4LW1vdXNlLWhpbnQnLFxuICAgICAgICAgICAgdGV4dDogaGludCxcbiAgICAgICAgICAgIHByaW9yaXR5OiAnbG93JyxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcmVhY3QtaG9va3MvZXhoYXVzdGl2ZS1kZXBzXG4gIH0sIFtdKVxuXG4gIGNvbnN0IFtzaG93VW5kZXJjb3ZlckNhbGxvdXQsIHNldFNob3dVbmRlcmNvdmVyQ2FsbG91dF0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoXCJleHRlcm5hbFwiID09PSAnYW50Jykge1xuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAvLyBXYWl0IGZvciByZXBvIGNsYXNzaWZpY2F0aW9uIHRvIHNldHRsZSAobWVtb2l6ZWQsIG5vLW9wIGlmIHByaW1lZCkuXG4gICAgICAgIGNvbnN0IHsgaXNJbnRlcm5hbE1vZGVsUmVwbyB9ID0gYXdhaXQgaW1wb3J0KFxuICAgICAgICAgICcuLi91dGlscy9jb21taXRBdHRyaWJ1dGlvbi5qcydcbiAgICAgICAgKVxuICAgICAgICBhd2FpdCBpc0ludGVybmFsTW9kZWxSZXBvKClcbiAgICAgICAgY29uc3QgeyBzaG91bGRTaG93VW5kZXJjb3ZlckF1dG9Ob3RpY2UgfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICAgICAnLi4vdXRpbHMvdW5kZXJjb3Zlci5qcydcbiAgICAgICAgKVxuICAgICAgICBpZiAoc2hvdWxkU2hvd1VuZGVyY292ZXJBdXRvTm90aWNlKCkpIHtcbiAgICAgICAgICBzZXRTaG93VW5kZXJjb3ZlckNhbGxvdXQodHJ1ZSlcbiAgICAgICAgfVxuICAgICAgfSkoKVxuICAgIH1cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcmVhY3QtaG9va3MvZXhoYXVzdGl2ZS1kZXBzXG4gIH0sIFtdKVxuXG4gIGNvbnN0IFt0b29sSlNYLCBzZXRUb29sSlNYSW50ZXJuYWxdID0gdXNlU3RhdGU8e1xuICAgIGpzeDogUmVhY3QuUmVhY3ROb2RlIHwgbnVsbFxuICAgIHNob3VsZEhpZGVQcm9tcHRJbnB1dDogYm9vbGVhblxuICAgIHNob3VsZENvbnRpbnVlQW5pbWF0aW9uPzogdHJ1ZVxuICAgIHNob3dTcGlubmVyPzogYm9vbGVhblxuICAgIGlzTG9jYWxKU1hDb21tYW5kPzogYm9vbGVhblxuICAgIGlzSW1tZWRpYXRlPzogYm9vbGVhblxuICB9IHwgbnVsbD4obnVsbClcblxuICAvLyBUcmFjayBsb2NhbCBKU1ggY29tbWFuZHMgc2VwYXJhdGVseSBzbyB0b29scyBjYW4ndCBvdmVyd3JpdGUgdGhlbS5cbiAgLy8gVGhpcyBlbmFibGVzIFwiaW1tZWRpYXRlXCIgY29tbWFuZHMgKGxpa2UgL2J0dykgdG8gcGVyc2lzdCB3aGlsZSBDbGF1ZGUgaXMgcHJvY2Vzc2luZy5cbiAgY29uc3QgbG9jYWxKU1hDb21tYW5kUmVmID0gdXNlUmVmPHtcbiAgICBqc3g6IFJlYWN0LlJlYWN0Tm9kZSB8IG51bGxcbiAgICBzaG91bGRIaWRlUHJvbXB0SW5wdXQ6IGJvb2xlYW5cbiAgICBzaG91bGRDb250aW51ZUFuaW1hdGlvbj86IHRydWVcbiAgICBzaG93U3Bpbm5lcj86IGJvb2xlYW5cbiAgICBpc0xvY2FsSlNYQ29tbWFuZDogdHJ1ZVxuICB9IHwgbnVsbD4obnVsbClcblxuICAvLyBXcmFwcGVyIGZvciBzZXRUb29sSlNYIHRoYXQgcHJlc2VydmVzIGxvY2FsIEpTWCBjb21tYW5kcyAobGlrZSAvYnR3KS5cbiAgLy8gV2hlbiBhIGxvY2FsIEpTWCBjb21tYW5kIGlzIGFjdGl2ZSwgd2UgaWdub3JlIHVwZGF0ZXMgZnJvbSB0b29sc1xuICAvLyB1bmxlc3MgdGhleSBleHBsaWNpdGx5IHNldCBjbGVhckxvY2FsSlNYOiB0cnVlIChmcm9tIG9uRG9uZSBjYWxsYmFja3MpLlxuICAvL1xuICAvLyBUTyBBREQgQSBORVcgSU1NRURJQVRFIENPTU1BTkQ6XG4gIC8vIDEuIFNldCBgaW1tZWRpYXRlOiB0cnVlYCBpbiB0aGUgY29tbWFuZCBkZWZpbml0aW9uXG4gIC8vIDIuIFNldCBgaXNMb2NhbEpTWENvbW1hbmQ6IHRydWVgIHdoZW4gY2FsbGluZyBzZXRUb29sSlNYIGluIHRoZSBjb21tYW5kJ3MgSlNYXG4gIC8vIDMuIEluIHRoZSBvbkRvbmUgY2FsbGJhY2ssIHVzZSBgc2V0VG9vbEpTWCh7IGpzeDogbnVsbCwgc2hvdWxkSGlkZVByb21wdElucHV0OiBmYWxzZSwgY2xlYXJMb2NhbEpTWDogdHJ1ZSB9KWBcbiAgLy8gICAgdG8gZXhwbGljaXRseSBjbGVhciB0aGUgb3ZlcmxheSB3aGVuIHRoZSB1c2VyIGRpc21pc3NlcyBpdFxuICBjb25zdCBzZXRUb29sSlNYID0gdXNlQ2FsbGJhY2soXG4gICAgKFxuICAgICAgYXJnczoge1xuICAgICAgICBqc3g6IFJlYWN0LlJlYWN0Tm9kZSB8IG51bGxcbiAgICAgICAgc2hvdWxkSGlkZVByb21wdElucHV0OiBib29sZWFuXG4gICAgICAgIHNob3VsZENvbnRpbnVlQW5pbWF0aW9uPzogdHJ1ZVxuICAgICAgICBzaG93U3Bpbm5lcj86IGJvb2xlYW5cbiAgICAgICAgaXNMb2NhbEpTWENvbW1hbmQ/OiBib29sZWFuXG4gICAgICAgIGNsZWFyTG9jYWxKU1g/OiBib29sZWFuXG4gICAgICB9IHwgbnVsbCxcbiAgICApID0+IHtcbiAgICAgIC8vIElmIHNldHRpbmcgYSBsb2NhbCBKU1ggY29tbWFuZCwgc3RvcmUgaXQgaW4gdGhlIHJlZlxuICAgICAgaWYgKGFyZ3M/LmlzTG9jYWxKU1hDb21tYW5kKSB7XG4gICAgICAgIGNvbnN0IHsgY2xlYXJMb2NhbEpTWDogXywgLi4ucmVzdCB9ID0gYXJnc1xuICAgICAgICBsb2NhbEpTWENvbW1hbmRSZWYuY3VycmVudCA9IHsgLi4ucmVzdCwgaXNMb2NhbEpTWENvbW1hbmQ6IHRydWUgfVxuICAgICAgICBzZXRUb29sSlNYSW50ZXJuYWwocmVzdClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIElmIHRoZXJlJ3MgYW4gYWN0aXZlIGxvY2FsIEpTWCBjb21tYW5kIGluIHRoZSByZWZcbiAgICAgIGlmIChsb2NhbEpTWENvbW1hbmRSZWYuY3VycmVudCkge1xuICAgICAgICAvLyBBbGxvdyBjbGVhcmluZyBvbmx5IGlmIGV4cGxpY2l0bHkgcmVxdWVzdGVkIChmcm9tIG9uRG9uZSBjYWxsYmFja3MpXG4gICAgICAgIGlmIChhcmdzPy5jbGVhckxvY2FsSlNYKSB7XG4gICAgICAgICAgbG9jYWxKU1hDb21tYW5kUmVmLmN1cnJlbnQgPSBudWxsXG4gICAgICAgICAgc2V0VG9vbEpTWEludGVybmFsKG51bGwpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgLy8gT3RoZXJ3aXNlLCBrZWVwIHRoZSBsb2NhbCBKU1ggY29tbWFuZCB2aXNpYmxlIC0gaWdub3JlIHRvb2wgdXBkYXRlc1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gTm8gYWN0aXZlIGxvY2FsIEpTWCBjb21tYW5kLCBhbGxvdyBhbnkgdXBkYXRlXG4gICAgICBpZiAoYXJncz8uY2xlYXJMb2NhbEpTWCkge1xuICAgICAgICBzZXRUb29sSlNYSW50ZXJuYWwobnVsbClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBzZXRUb29sSlNYSW50ZXJuYWwoYXJncylcbiAgICB9LFxuICAgIFtdLFxuICApXG4gIGNvbnN0IFt0b29sVXNlQ29uZmlybVF1ZXVlLCBzZXRUb29sVXNlQ29uZmlybVF1ZXVlXSA9IHVzZVN0YXRlPFxuICAgIFRvb2xVc2VDb25maXJtW11cbiAgPihbXSlcbiAgLy8gU3RpY2t5IGZvb3RlciBKU1ggcmVnaXN0ZXJlZCBieSBwZXJtaXNzaW9uIHJlcXVlc3QgY29tcG9uZW50cyAoY3VycmVudGx5XG4gIC8vIG9ubHkgRXhpdFBsYW5Nb2RlUGVybWlzc2lvblJlcXVlc3QpLiBSZW5kZXJzIGluIEZ1bGxzY3JlZW5MYXlvdXQncyBgYm90dG9tYFxuICAvLyBzbG90IHNvIHJlc3BvbnNlIG9wdGlvbnMgc3RheSB2aXNpYmxlIHdoaWxlIHRoZSB1c2VyIHNjcm9sbHMgYSBsb25nIHBsYW4uXG4gIGNvbnN0IFtwZXJtaXNzaW9uU3RpY2t5Rm9vdGVyLCBzZXRQZXJtaXNzaW9uU3RpY2t5Rm9vdGVyXSA9XG4gICAgdXNlU3RhdGU8UmVhY3QuUmVhY3ROb2RlIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW3NhbmRib3hQZXJtaXNzaW9uUmVxdWVzdFF1ZXVlLCBzZXRTYW5kYm94UGVybWlzc2lvblJlcXVlc3RRdWV1ZV0gPVxuICAgIHVzZVN0YXRlPFxuICAgICAgQXJyYXk8e1xuICAgICAgICBob3N0UGF0dGVybjogTmV0d29ya0hvc3RQYXR0ZXJuXG4gICAgICAgIHJlc29sdmVQcm9taXNlOiAoYWxsb3dDb25uZWN0aW9uOiBib29sZWFuKSA9PiB2b2lkXG4gICAgICB9PlxuICAgID4oW10pXG4gIGNvbnN0IFtwcm9tcHRRdWV1ZSwgc2V0UHJvbXB0UXVldWVdID0gdXNlU3RhdGU8XG4gICAgQXJyYXk8e1xuICAgICAgcmVxdWVzdDogUHJvbXB0UmVxdWVzdFxuICAgICAgdGl0bGU6IHN0cmluZ1xuICAgICAgdG9vbElucHV0U3VtbWFyeT86IHN0cmluZyB8IG51bGxcbiAgICAgIHJlc29sdmU6IChyZXNwb25zZTogUHJvbXB0UmVzcG9uc2UpID0+IHZvaWRcbiAgICAgIHJlamVjdDogKGVycm9yOiBFcnJvcikgPT4gdm9pZFxuICAgIH0+XG4gID4oW10pXG5cbiAgLy8gVHJhY2sgYnJpZGdlIGNsZWFudXAgZnVuY3Rpb25zIGZvciBzYW5kYm94IHBlcm1pc3Npb24gcmVxdWVzdHMgc28gdGhlXG4gIC8vIGxvY2FsIGRpYWxvZyBoYW5kbGVyIGNhbiBjYW5jZWwgdGhlIHJlbW90ZSBwcm9tcHQgd2hlbiB0aGUgbG9jYWwgdXNlclxuICAvLyByZXNwb25kcyBmaXJzdC4gS2V5ZWQgYnkgaG9zdCB0byBzdXBwb3J0IGNvbmN1cnJlbnQgc2FtZS1ob3N0IHJlcXVlc3RzLlxuICBjb25zdCBzYW5kYm94QnJpZGdlQ2xlYW51cFJlZiA9IHVzZVJlZjxNYXA8c3RyaW5nLCBBcnJheTwoKSA9PiB2b2lkPj4+KFxuICAgIG5ldyBNYXAoKSxcbiAgKVxuXG4gIC8vIC0tIFRlcm1pbmFsIHRpdGxlIG1hbmFnZW1lbnRcbiAgLy8gU2Vzc2lvbiB0aXRsZSAoc2V0IHZpYSAvcmVuYW1lIG9yIHJlc3RvcmVkIG9uIHJlc3VtZSkgd2lucyBvdmVyXG4gIC8vIHRoZSBhZ2VudCBuYW1lLCB3aGljaCB3aW5zIG92ZXIgdGhlIEhhaWt1LWV4dHJhY3RlZCB0b3BpYztcbiAgLy8gYWxsIGZhbGwgYmFjayB0byB0aGUgcHJvZHVjdCBuYW1lLlxuICBjb25zdCB0ZXJtaW5hbFRpdGxlRnJvbVJlbmFtZSA9XG4gICAgdXNlQXBwU3RhdGUocyA9PiBzLnNldHRpbmdzLnRlcm1pbmFsVGl0bGVGcm9tUmVuYW1lKSAhPT0gZmFsc2VcbiAgY29uc3Qgc2Vzc2lvblRpdGxlID0gdGVybWluYWxUaXRsZUZyb21SZW5hbWVcbiAgICA/IGdldEN1cnJlbnRTZXNzaW9uVGl0bGUoZ2V0U2Vzc2lvbklkKCkpXG4gICAgOiB1bmRlZmluZWRcbiAgY29uc3QgW2hhaWt1VGl0bGUsIHNldEhhaWt1VGl0bGVdID0gdXNlU3RhdGU8c3RyaW5nPigpXG4gIC8vIEdhdGVzIHRoZSBvbmUtc2hvdCBIYWlrdSBjYWxsIHRoYXQgZ2VuZXJhdGVzIHRoZSB0YWIgdGl0bGUuIFNlZWRlZCB0cnVlXG4gIC8vIG9uIHJlc3VtZSAoaW5pdGlhbE1lc3NhZ2VzIHByZXNlbnQpIHNvIHdlIGRvbid0IHJlLXRpdGxlIGEgcmVzdW1lZFxuICAvLyBzZXNzaW9uIGZyb20gbWlkLWNvbnZlcnNhdGlvbiBjb250ZXh0LlxuICBjb25zdCBoYWlrdVRpdGxlQXR0ZW1wdGVkUmVmID0gdXNlUmVmKChpbml0aWFsTWVzc2FnZXM/Lmxlbmd0aCA/PyAwKSA+IDApXG4gIGNvbnN0IGFnZW50VGl0bGUgPSBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uPy5hZ2VudFR5cGVcbiAgY29uc3QgdGVybWluYWxUaXRsZSA9XG4gICAgc2Vzc2lvblRpdGxlID8/IGFnZW50VGl0bGUgPz8gaGFpa3VUaXRsZSA/PyAnQ2xhdWRlIENvZGUnXG4gIGNvbnN0IGlzV2FpdGluZ0ZvckFwcHJvdmFsID1cbiAgICB0b29sVXNlQ29uZmlybVF1ZXVlLmxlbmd0aCA+IDAgfHxcbiAgICBwcm9tcHRRdWV1ZS5sZW5ndGggPiAwIHx8XG4gICAgcGVuZGluZ1dvcmtlclJlcXVlc3QgfHxcbiAgICBwZW5kaW5nU2FuZGJveFJlcXVlc3RcbiAgLy8gTG9jYWwtanN4IGNvbW1hbmRzIChsaWtlIC9wbHVnaW4sIC9jb25maWcpIHNob3cgdXNlci1mYWNpbmcgZGlhbG9ncyB0aGF0XG4gIC8vIHdhaXQgZm9yIGlucHV0LiBSZXF1aXJlIGpzeCAhPSBudWxsIOKAlCBpZiB0aGUgZmxhZyBpcyBzdHVjayB0cnVlIGJ1dCBqc3hcbiAgLy8gaXMgbnVsbCwgdHJlYXQgYXMgbm90LXNob3dpbmcgc28gVGV4dElucHV0IGZvY3VzIGFuZCBxdWV1ZSBwcm9jZXNzb3JcbiAgLy8gYXJlbid0IGRlYWRsb2NrZWQgYnkgYSBwaGFudG9tIG92ZXJsYXkuXG4gIGNvbnN0IGlzU2hvd2luZ0xvY2FsSlNYQ29tbWFuZCA9XG4gICAgdG9vbEpTWD8uaXNMb2NhbEpTWENvbW1hbmQgPT09IHRydWUgJiYgdG9vbEpTWD8uanN4ICE9IG51bGxcbiAgY29uc3QgdGl0bGVJc0FuaW1hdGluZyA9XG4gICAgaXNMb2FkaW5nICYmICFpc1dhaXRpbmdGb3JBcHByb3ZhbCAmJiAhaXNTaG93aW5nTG9jYWxKU1hDb21tYW5kXG4gIC8vIFRpdGxlIGFuaW1hdGlvbiBzdGF0ZSBsaXZlcyBpbiA8QW5pbWF0ZWRUZXJtaW5hbFRpdGxlPiBzbyB0aGUgOTYwbXMgdGlja1xuICAvLyBkb2Vzbid0IHJlLXJlbmRlciBSRVBMLiB0aXRsZURpc2FibGVkL3Rlcm1pbmFsVGl0bGUgYXJlIHN0aWxsIGNvbXB1dGVkXG4gIC8vIGhlcmUgYmVjYXVzZSBvblF1ZXJ5SW1wbCByZWFkcyB0aGVtIChiYWNrZ3JvdW5kIHNlc3Npb24gZGVzY3JpcHRpb24sXG4gIC8vIGhhaWt1IHRpdGxlIGV4dHJhY3Rpb24gZ2F0ZSkuXG5cbiAgLy8gUHJldmVudCBtYWNPUyBmcm9tIHNsZWVwaW5nIHdoaWxlIENsYXVkZSBpcyB3b3JraW5nXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGlzTG9hZGluZyAmJiAhaXNXYWl0aW5nRm9yQXBwcm92YWwgJiYgIWlzU2hvd2luZ0xvY2FsSlNYQ29tbWFuZCkge1xuICAgICAgc3RhcnRQcmV2ZW50U2xlZXAoKVxuICAgICAgcmV0dXJuICgpID0+IHN0b3BQcmV2ZW50U2xlZXAoKVxuICAgIH1cbiAgfSwgW2lzTG9hZGluZywgaXNXYWl0aW5nRm9yQXBwcm92YWwsIGlzU2hvd2luZ0xvY2FsSlNYQ29tbWFuZF0pXG5cbiAgY29uc3Qgc2Vzc2lvblN0YXR1czogVGFiU3RhdHVzS2luZCA9XG4gICAgaXNXYWl0aW5nRm9yQXBwcm92YWwgfHwgaXNTaG93aW5nTG9jYWxKU1hDb21tYW5kXG4gICAgICA/ICd3YWl0aW5nJ1xuICAgICAgOiBpc0xvYWRpbmdcbiAgICAgICAgPyAnYnVzeSdcbiAgICAgICAgOiAnaWRsZSdcblxuICBjb25zdCB3YWl0aW5nRm9yID1cbiAgICBzZXNzaW9uU3RhdHVzICE9PSAnd2FpdGluZydcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6IHRvb2xVc2VDb25maXJtUXVldWUubGVuZ3RoID4gMFxuICAgICAgICA/IGBhcHByb3ZlICR7dG9vbFVzZUNvbmZpcm1RdWV1ZVswXSEudG9vbC5uYW1lfWBcbiAgICAgICAgOiBwZW5kaW5nV29ya2VyUmVxdWVzdFxuICAgICAgICAgID8gJ3dvcmtlciByZXF1ZXN0J1xuICAgICAgICAgIDogcGVuZGluZ1NhbmRib3hSZXF1ZXN0XG4gICAgICAgICAgICA/ICdzYW5kYm94IHJlcXVlc3QnXG4gICAgICAgICAgICA6IGlzU2hvd2luZ0xvY2FsSlNYQ29tbWFuZFxuICAgICAgICAgICAgICA/ICdkaWFsb2cgb3BlbidcbiAgICAgICAgICAgICAgOiAnaW5wdXQgbmVlZGVkJ1xuXG4gIC8vIFB1c2ggc3RhdHVzIHRvIHRoZSBQSUQgZmlsZSBmb3IgYGNsYXVkZSBwc2AuIEZpcmUtYW5kLWZvcmdldDsgcHMgZmFsbHNcbiAgLy8gYmFjayB0byB0cmFuc2NyaXB0LXRhaWwgZGVyaXZhdGlvbiB3aGVuIHRoaXMgaXMgbWlzc2luZy9zdGFsZS5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoZmVhdHVyZSgnQkdfU0VTU0lPTlMnKSkge1xuICAgICAgdm9pZCB1cGRhdGVTZXNzaW9uQWN0aXZpdHkoeyBzdGF0dXM6IHNlc3Npb25TdGF0dXMsIHdhaXRpbmdGb3IgfSlcbiAgICB9XG4gIH0sIFtzZXNzaW9uU3RhdHVzLCB3YWl0aW5nRm9yXSlcblxuICAvLyAzUCBkZWZhdWx0OiBvZmYg4oCUIE9TQyAyMTMzNyBpcyBhbnQtb25seSB3aGlsZSB0aGUgc3BlYyBzdGFiaWxpemVzLlxuICAvLyBHYXRlZCBzbyB3ZSBjYW4gcm9sbCBiYWNrIGlmIHRoZSBzaWRlYmFyIGluZGljYXRvciBjb25mbGljdHMgd2l0aFxuICAvLyB0aGUgdGl0bGUgc3Bpbm5lciBpbiB0ZXJtaW5hbHMgdGhhdCByZW5kZXIgYm90aC4gV2hlbiB0aGUgZmxhZyBpc1xuICAvLyBvbiwgdGhlIHVzZXItZmFjaW5nIGNvbmZpZyBzZXR0aW5nIGNvbnRyb2xzIHdoZXRoZXIgaXQncyBhY3RpdmUuXG4gIGNvbnN0IHRhYlN0YXR1c0dhdGVFbmFibGVkID0gZ2V0RmVhdHVyZVZhbHVlX0NBQ0hFRF9NQVlfQkVfU1RBTEUoXG4gICAgJ3Rlbmd1X3Rlcm1pbmFsX3NpZGViYXInLFxuICAgIGZhbHNlLFxuICApXG4gIGNvbnN0IHNob3dTdGF0dXNJblRlcm1pbmFsVGFiID1cbiAgICB0YWJTdGF0dXNHYXRlRW5hYmxlZCAmJiAoZ2V0R2xvYmFsQ29uZmlnKCkuc2hvd1N0YXR1c0luVGVybWluYWxUYWIgPz8gZmFsc2UpXG4gIHVzZVRhYlN0YXR1cyh0aXRsZURpc2FibGVkIHx8ICFzaG93U3RhdHVzSW5UZXJtaW5hbFRhYiA/IG51bGwgOiBzZXNzaW9uU3RhdHVzKVxuXG4gIC8vIFJlZ2lzdGVyIHRoZSBsZWFkZXIncyBzZXRUb29sVXNlQ29uZmlybVF1ZXVlIGZvciBpbi1wcm9jZXNzIHRlYW1tYXRlc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHJlZ2lzdGVyTGVhZGVyVG9vbFVzZUNvbmZpcm1RdWV1ZShzZXRUb29sVXNlQ29uZmlybVF1ZXVlKVxuICAgIHJldHVybiAoKSA9PiB1bnJlZ2lzdGVyTGVhZGVyVG9vbFVzZUNvbmZpcm1RdWV1ZSgpXG4gIH0sIFtzZXRUb29sVXNlQ29uZmlybVF1ZXVlXSlcblxuICBjb25zdCBbbWVzc2FnZXMsIHJhd1NldE1lc3NhZ2VzXSA9IHVzZVN0YXRlPE1lc3NhZ2VUeXBlW10+KFxuICAgIGluaXRpYWxNZXNzYWdlcyA/PyBbXSxcbiAgKVxuICBjb25zdCBtZXNzYWdlc1JlZiA9IHVzZVJlZihtZXNzYWdlcylcbiAgLy8gU3RvcmVzIHRoZSB3aWxsb3dNb2RlIHZhcmlhbnQgdGhhdCB3YXMgc2hvd24gKG9yIGZhbHNlIGlmIG5vIGhpbnQgc2hvd24pLlxuICAvLyBDYXB0dXJlZCBhdCBoaW50X3Nob3duIHRpbWUgc28gaGludF9jb252ZXJ0ZWQgdGVsZW1ldHJ5IHJlcG9ydHMgdGhlIHNhbWVcbiAgLy8gdmFyaWFudCDigJQgdGhlIEdyb3d0aEJvb2sgdmFsdWUgc2hvdWxkbid0IGNoYW5nZSBtaWQtc2Vzc2lvbiwgYnV0IHJlYWRpbmdcbiAgLy8gaXQgb25jZSBndWFyYW50ZWVzIGNvbnNpc3RlbmN5IGJldHdlZW4gdGhlIHBhaXJlZCBldmVudHMuXG4gIGNvbnN0IGlkbGVIaW50U2hvd25SZWYgPSB1c2VSZWY8c3RyaW5nIHwgZmFsc2U+KGZhbHNlKVxuICAvLyBXcmFwIHNldE1lc3NhZ2VzIHNvIG1lc3NhZ2VzUmVmIGlzIGFsd2F5cyBjdXJyZW50IHRoZSBpbnN0YW50IHRoZVxuICAvLyBjYWxsIHJldHVybnMg4oCUIG5vdCB3aGVuIFJlYWN0IGxhdGVyIHByb2Nlc3NlcyB0aGUgYmF0Y2guICBBcHBseSB0aGVcbiAgLy8gdXBkYXRlciBlYWdlcmx5IGFnYWluc3QgdGhlIHJlZiwgdGhlbiBoYW5kIFJlYWN0IHRoZSBjb21wdXRlZCB2YWx1ZVxuICAvLyAobm90IHRoZSBmdW5jdGlvbikuICByYXdTZXRNZXNzYWdlcyBiYXRjaGluZyBiZWNvbWVzIGxhc3Qtd3JpdGUtd2lucyxcbiAgLy8gYW5kIHRoZSBsYXN0IHdyaXRlIGlzIGNvcnJlY3QgYmVjYXVzZSBlYWNoIGNhbGwgY29tcG9zZXMgYWdhaW5zdCB0aGVcbiAgLy8gYWxyZWFkeS11cGRhdGVkIHJlZi4gIFRoaXMgaXMgdGhlIFp1c3RhbmQgcGF0dGVybjogcmVmIGlzIHNvdXJjZSBvZlxuICAvLyB0cnV0aCwgUmVhY3Qgc3RhdGUgaXMgdGhlIHJlbmRlciBwcm9qZWN0aW9uLiAgV2l0aG91dCB0aGlzLCBwYXRoc1xuICAvLyB0aGF0IHF1ZXVlIGZ1bmN0aW9uYWwgdXBkYXRlcnMgdGhlbiBzeW5jaHJvbm91c2x5IHJlYWQgdGhlIHJlZlxuICAvLyAoZS5nLiBoYW5kbGVTcGVjdWxhdGlvbkFjY2VwdCDihpIgb25RdWVyeSkgc2VlIHN0YWxlIGRhdGEuXG4gIGNvbnN0IHNldE1lc3NhZ2VzID0gdXNlQ2FsbGJhY2soXG4gICAgKGFjdGlvbjogUmVhY3QuU2V0U3RhdGVBY3Rpb248TWVzc2FnZVR5cGVbXT4pID0+IHtcbiAgICAgIGNvbnN0IHByZXYgPSBtZXNzYWdlc1JlZi5jdXJyZW50XG4gICAgICBjb25zdCBuZXh0ID1cbiAgICAgICAgdHlwZW9mIGFjdGlvbiA9PT0gJ2Z1bmN0aW9uJyA/IGFjdGlvbihtZXNzYWdlc1JlZi5jdXJyZW50KSA6IGFjdGlvblxuICAgICAgbWVzc2FnZXNSZWYuY3VycmVudCA9IG5leHRcbiAgICAgIGlmIChuZXh0Lmxlbmd0aCA8IHVzZXJJbnB1dEJhc2VsaW5lUmVmLmN1cnJlbnQpIHtcbiAgICAgICAgLy8gU2hyYW5rIChjb21wYWN0L3Jld2luZC9jbGVhcikg4oCUIGNsYW1wIHNvIHBsYWNlaG9sZGVyVGV4dCdzIGxlbmd0aFxuICAgICAgICAvLyBjaGVjayBjYW4ndCBnbyBzdGFsZS5cbiAgICAgICAgdXNlcklucHV0QmFzZWxpbmVSZWYuY3VycmVudCA9IDBcbiAgICAgIH0gZWxzZSBpZiAobmV4dC5sZW5ndGggPiBwcmV2Lmxlbmd0aCAmJiB1c2VyTWVzc2FnZVBlbmRpbmdSZWYuY3VycmVudCkge1xuICAgICAgICAvLyBHcmV3IHdoaWxlIHRoZSBzdWJtaXR0ZWQgdXNlciBtZXNzYWdlIGhhc24ndCBsYW5kZWQgeWV0LiBJZiB0aGVcbiAgICAgICAgLy8gYWRkZWQgbWVzc2FnZXMgZG9uJ3QgaW5jbHVkZSBpdCAoYnJpZGdlIHN0YXR1cywgaG9vayByZXN1bHRzLFxuICAgICAgICAvLyBzY2hlZHVsZWQgdGFza3MgbGFuZGluZyBhc3luYyBkdXJpbmcgcHJvY2Vzc1VzZXJJbnB1dEJhc2UpLCBidW1wXG4gICAgICAgIC8vIGJhc2VsaW5lIHNvIHRoZSBwbGFjZWhvbGRlciBzdGF5cyB2aXNpYmxlLiBPbmNlIHRoZSB1c2VyIG1lc3NhZ2VcbiAgICAgICAgLy8gbGFuZHMsIHN0b3AgdHJhY2tpbmcg4oCUIGxhdGVyIGFkZGl0aW9ucyAoYXNzaXN0YW50IHN0cmVhbSkgc2hvdWxkXG4gICAgICAgIC8vIG5vdCByZS1zaG93IHRoZSBwbGFjZWhvbGRlci5cbiAgICAgICAgY29uc3QgZGVsdGEgPSBuZXh0Lmxlbmd0aCAtIHByZXYubGVuZ3RoXG4gICAgICAgIGNvbnN0IGFkZGVkID1cbiAgICAgICAgICBwcmV2Lmxlbmd0aCA9PT0gMCB8fCBuZXh0WzBdID09PSBwcmV2WzBdXG4gICAgICAgICAgICA/IG5leHQuc2xpY2UoLWRlbHRhKVxuICAgICAgICAgICAgOiBuZXh0LnNsaWNlKDAsIGRlbHRhKVxuICAgICAgICBpZiAoYWRkZWQuc29tZShpc0h1bWFuVHVybikpIHtcbiAgICAgICAgICB1c2VyTWVzc2FnZVBlbmRpbmdSZWYuY3VycmVudCA9IGZhbHNlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdXNlcklucHV0QmFzZWxpbmVSZWYuY3VycmVudCA9IG5leHQubGVuZ3RoXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJhd1NldE1lc3NhZ2VzKG5leHQpXG4gICAgfSxcbiAgICBbXSxcbiAgKVxuICAvLyBDYXB0dXJlIHRoZSBiYXNlbGluZSBtZXNzYWdlIGNvdW50IGFsb25nc2lkZSB0aGUgcGxhY2Vob2xkZXIgdGV4dCBzb1xuICAvLyB0aGUgcmVuZGVyIGNhbiBoaWRlIGl0IG9uY2UgZGlzcGxheWVkTWVzc2FnZXMgZ3Jvd3MgcGFzdCB0aGUgYmFzZWxpbmUuXG4gIGNvbnN0IHNldFVzZXJJbnB1dE9uUHJvY2Vzc2luZyA9IHVzZUNhbGxiYWNrKChpbnB1dDogc3RyaW5nIHwgdW5kZWZpbmVkKSA9PiB7XG4gICAgaWYgKGlucHV0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHVzZXJJbnB1dEJhc2VsaW5lUmVmLmN1cnJlbnQgPSBtZXNzYWdlc1JlZi5jdXJyZW50Lmxlbmd0aFxuICAgICAgdXNlck1lc3NhZ2VQZW5kaW5nUmVmLmN1cnJlbnQgPSB0cnVlXG4gICAgfSBlbHNlIHtcbiAgICAgIHVzZXJNZXNzYWdlUGVuZGluZ1JlZi5jdXJyZW50ID0gZmFsc2VcbiAgICB9XG4gICAgc2V0VXNlcklucHV0T25Qcm9jZXNzaW5nUmF3KGlucHV0KVxuICB9LCBbXSlcbiAgLy8gRnVsbHNjcmVlbjogdHJhY2sgdGhlIHVuc2Vlbi1kaXZpZGVyIHBvc2l0aW9uLiBkaXZpZGVySW5kZXggY2hhbmdlc1xuICAvLyBvbmx5IH50d2ljZS9zY3JvbGwtc2Vzc2lvbiAoZmlyc3Qgc2Nyb2xsLWF3YXkgKyByZXBpbikuIHBpbGxWaXNpYmxlXG4gIC8vIGFuZCBzdGlja3lQcm9tcHQgbm93IGxpdmUgaW4gRnVsbHNjcmVlbkxheW91dCDigJQgdGhleSBzdWJzY3JpYmUgdG9cbiAgLy8gU2Nyb2xsQm94IGRpcmVjdGx5IHNvIHBlci1mcmFtZSBzY3JvbGwgbmV2ZXIgcmUtcmVuZGVycyBSRVBMLlxuICBjb25zdCB7XG4gICAgZGl2aWRlckluZGV4LFxuICAgIGRpdmlkZXJZUmVmLFxuICAgIG9uU2Nyb2xsQXdheSxcbiAgICBvblJlcGluLFxuICAgIGp1bXBUb05ldyxcbiAgICBzaGlmdERpdmlkZXIsXG4gIH0gPSB1c2VVbnNlZW5EaXZpZGVyKG1lc3NhZ2VzLmxlbmd0aClcbiAgaWYgKGZlYXR1cmUoJ0FXQVlfU1VNTUFSWScpKSB7XG4gICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgIHVzZUF3YXlTdW1tYXJ5KG1lc3NhZ2VzLCBzZXRNZXNzYWdlcywgaXNMb2FkaW5nKVxuICB9XG4gIGNvbnN0IFtjdXJzb3IsIHNldEN1cnNvcl0gPSB1c2VTdGF0ZTxNZXNzYWdlQWN0aW9uc1N0YXRlIHwgbnVsbD4obnVsbClcbiAgY29uc3QgY3Vyc29yTmF2UmVmID0gdXNlUmVmPE1lc3NhZ2VBY3Rpb25zTmF2IHwgbnVsbD4obnVsbClcbiAgLy8gTWVtb2l6ZWQgc28gTWVzc2FnZXMnIFJlYWN0Lm1lbW8gaG9sZHMuXG4gIGNvbnN0IHVuc2VlbkRpdmlkZXIgPSB1c2VNZW1vKFxuICAgICgpID0+IGNvbXB1dGVVbnNlZW5EaXZpZGVyKG1lc3NhZ2VzLCBkaXZpZGVySW5kZXgpLFxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHMgLS0gbGVuZ3RoIGNoYW5nZSBjb3ZlcnMgYXBwZW5kczsgdXNlVW5zZWVuRGl2aWRlcidzIGNvdW50LWRyb3AgZ3VhcmQgY2xlYXJzIGRpdmlkZXJJbmRleCBvbiByZXBsYWNlL3Jld2luZFxuICAgIFtkaXZpZGVySW5kZXgsIG1lc3NhZ2VzLmxlbmd0aF0sXG4gIClcbiAgLy8gUmUtcGluIHNjcm9sbCB0byBib3R0b20gYW5kIGNsZWFyIHRoZSB1bnNlZW4tbWVzc2FnZXMgYmFzZWxpbmUuIENhbGxlZFxuICAvLyBvbiBhbnkgdXNlci1kcml2ZW4gcmV0dXJuLXRvLWxpdmUgYWN0aW9uIChzdWJtaXQsIHR5cGUtaW50by1lbXB0eSxcbiAgLy8gb3ZlcmxheSBhcHBlYXIvZGlzbWlzcykuXG4gIGNvbnN0IHJlcGluU2Nyb2xsID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNjcm9sbFJlZi5jdXJyZW50Py5zY3JvbGxUb0JvdHRvbSgpXG4gICAgb25SZXBpbigpXG4gICAgc2V0Q3Vyc29yKG51bGwpXG4gIH0sIFtvblJlcGluLCBzZXRDdXJzb3JdKVxuICAvLyBCYWNrc3RvcCBmb3IgdGhlIHN1Ym1pdC1oYW5kbGVyIHJlcGluIGF0IG9uU3VibWl0LiBJZiBhIGJ1ZmZlcmVkIHN0ZGluXG4gIC8vIGV2ZW50ICh3aGVlbC9kcmFnKSByYWNlcyBiZXR3ZWVuIGhhbmRsZXItZmlyZSBhbmQgc3RhdGUtY29tbWl0LCB0aGVcbiAgLy8gaGFuZGxlcidzIHNjcm9sbFRvQm90dG9tIGNhbiBiZSB1bmRvbmUuIFRoaXMgZWZmZWN0IGZpcmVzIG9uIHRoZSByZW5kZXJcbiAgLy8gd2hlcmUgdGhlIHVzZXIncyBtZXNzYWdlIGFjdHVhbGx5IGxhbmRzIOKAlCB0aWVkIHRvIFJlYWN0J3MgY29tbWl0IGN5Y2xlLFxuICAvLyBzbyBpdCBjYW4ndCByYWNlIHdpdGggc3RkaW4uIEtleWVkIG9uIGxhc3RNc2cgaWRlbnRpdHkgKG5vdCBtZXNzYWdlcy5sZW5ndGgpXG4gIC8vIHNvIHVzZUFzc2lzdGFudEhpc3RvcnkncyBwcmVwZW5kcyBkb24ndCBzcHVyaW91c2x5IHJlcGluLlxuICBjb25zdCBsYXN0TXNnID0gbWVzc2FnZXMuYXQoLTEpXG4gIGNvbnN0IGxhc3RNc2dJc0h1bWFuID0gbGFzdE1zZyAhPSBudWxsICYmIGlzSHVtYW5UdXJuKGxhc3RNc2cpXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGxhc3RNc2dJc0h1bWFuKSB7XG4gICAgICByZXBpblNjcm9sbCgpXG4gICAgfVxuICB9LCBbbGFzdE1zZ0lzSHVtYW4sIGxhc3RNc2csIHJlcGluU2Nyb2xsXSlcbiAgLy8gQXNzaXN0YW50LWNoYXQ6IGxhenktbG9hZCByZW1vdGUgaGlzdG9yeSBvbiBzY3JvbGwtdXAuIE5vLW9wIHVubGVzc1xuICAvLyBLQUlST1MgYnVpbGQgKyBjb25maWcudmlld2VyT25seS4gZmVhdHVyZSgpIGlzIGJ1aWxkLXRpbWUgY29uc3RhbnQgc29cbiAgLy8gdGhlIGJyYW5jaCBpcyBkZWFkLWNvZGUtZWxpbWluYXRlZCBpbiBub24tS0FJUk9TIGJ1aWxkcyAoc2FtZSBwYXR0ZXJuXG4gIC8vIGFzIHVzZVVuc2VlbkRpdmlkZXIgYWJvdmUpLlxuICBjb25zdCB7IG1heWJlTG9hZE9sZGVyIH0gPSBmZWF0dXJlKCdLQUlST1MnKVxuICAgID8gLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgICAgdXNlQXNzaXN0YW50SGlzdG9yeSh7XG4gICAgICAgIGNvbmZpZzogcmVtb3RlU2Vzc2lvbkNvbmZpZyxcbiAgICAgICAgc2V0TWVzc2FnZXMsXG4gICAgICAgIHNjcm9sbFJlZixcbiAgICAgICAgb25QcmVwZW5kOiBzaGlmdERpdmlkZXIsXG4gICAgICB9KVxuICAgIDogSElTVE9SWV9TVFVCXG4gIC8vIENvbXBvc2UgdXNlVW5zZWVuRGl2aWRlcidzIGNhbGxiYWNrcyB3aXRoIHRoZSBsYXp5LWxvYWQgdHJpZ2dlci5cbiAgY29uc3QgY29tcG9zZWRPblNjcm9sbCA9IHVzZUNhbGxiYWNrKFxuICAgIChzdGlja3k6IGJvb2xlYW4sIGhhbmRsZTogU2Nyb2xsQm94SGFuZGxlKSA9PiB7XG4gICAgICBsYXN0VXNlclNjcm9sbFRzUmVmLmN1cnJlbnQgPSBEYXRlLm5vdygpXG4gICAgICBpZiAoc3RpY2t5KSB7XG4gICAgICAgIG9uUmVwaW4oKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb25TY3JvbGxBd2F5KGhhbmRsZSlcbiAgICAgICAgaWYgKGZlYXR1cmUoJ0tBSVJPUycpKSBtYXliZUxvYWRPbGRlcihoYW5kbGUpXG4gICAgICAgIC8vIERpc21pc3MgdGhlIGNvbXBhbmlvbiBidWJibGUgb24gc2Nyb2xsIOKAlCBpdCdzIGFic29sdXRlLXBvc2l0aW9uZWRcbiAgICAgICAgLy8gYXQgYm90dG9tLXJpZ2h0IGFuZCBjb3ZlcnMgdHJhbnNjcmlwdCBjb250ZW50LiBTY3JvbGxpbmcgPSB1c2VyIGlzXG4gICAgICAgIC8vIHRyeWluZyB0byByZWFkIHNvbWV0aGluZyB1bmRlciBpdC5cbiAgICAgICAgaWYgKGZlYXR1cmUoJ0JVRERZJykpIHtcbiAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+XG4gICAgICAgICAgICBwcmV2LmNvbXBhbmlvblJlYWN0aW9uID09PSB1bmRlZmluZWRcbiAgICAgICAgICAgICAgPyBwcmV2XG4gICAgICAgICAgICAgIDogeyAuLi5wcmV2LCBjb21wYW5pb25SZWFjdGlvbjogdW5kZWZpbmVkIH0sXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBbb25SZXBpbiwgb25TY3JvbGxBd2F5LCBtYXliZUxvYWRPbGRlciwgc2V0QXBwU3RhdGVdLFxuICApXG4gIC8vIERlZmVycmVkIFNlc3Npb25TdGFydCBob29rIG1lc3NhZ2VzIOKAlCBSRVBMIHJlbmRlcnMgaW1tZWRpYXRlbHkgYW5kXG4gIC8vIGhvb2sgbWVzc2FnZXMgYXJlIGluamVjdGVkIHdoZW4gdGhleSByZXNvbHZlLiBhd2FpdFBlbmRpbmdIb29rcygpXG4gIC8vIG11c3QgYmUgY2FsbGVkIGJlZm9yZSB0aGUgZmlyc3QgQVBJIGNhbGwgc28gdGhlIG1vZGVsIHNlZXMgaG9vayBjb250ZXh0LlxuICBjb25zdCBhd2FpdFBlbmRpbmdIb29rcyA9IHVzZURlZmVycmVkSG9va01lc3NhZ2VzKFxuICAgIHBlbmRpbmdIb29rTWVzc2FnZXMsXG4gICAgc2V0TWVzc2FnZXMsXG4gIClcblxuICAvLyBEZWZlcnJlZCBtZXNzYWdlcyBmb3IgdGhlIE1lc3NhZ2VzIGNvbXBvbmVudCDigJQgcmVuZGVycyBhdCB0cmFuc2l0aW9uXG4gIC8vIHByaW9yaXR5IHNvIHRoZSByZWNvbmNpbGVyIHlpZWxkcyBldmVyeSA1bXMsIGtlZXBpbmcgaW5wdXQgcmVzcG9uc2l2ZVxuICAvLyB3aGlsZSB0aGUgZXhwZW5zaXZlIG1lc3NhZ2UgcHJvY2Vzc2luZyBwaXBlbGluZSBydW5zLlxuICBjb25zdCBkZWZlcnJlZE1lc3NhZ2VzID0gdXNlRGVmZXJyZWRWYWx1ZShtZXNzYWdlcylcbiAgY29uc3QgZGVmZXJyZWRCZWhpbmQgPSBtZXNzYWdlcy5sZW5ndGggLSBkZWZlcnJlZE1lc3NhZ2VzLmxlbmd0aFxuICBpZiAoZGVmZXJyZWRCZWhpbmQgPiAwKSB7XG4gICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgYFt1c2VEZWZlcnJlZFZhbHVlXSBNZXNzYWdlcyBkZWZlcnJlZCBieSAke2RlZmVycmVkQmVoaW5kfSAoJHtkZWZlcnJlZE1lc3NhZ2VzLmxlbmd0aH3ihpIke21lc3NhZ2VzLmxlbmd0aH0pYCxcbiAgICApXG4gIH1cblxuICAvLyBGcm96ZW4gc3RhdGUgZm9yIHRyYW5zY3JpcHQgbW9kZSAtIHN0b3JlcyBsZW5ndGhzIGluc3RlYWQgb2YgY2xvbmluZyBhcnJheXMgZm9yIG1lbW9yeSBlZmZpY2llbmN5XG4gIGNvbnN0IFtmcm96ZW5UcmFuc2NyaXB0U3RhdGUsIHNldEZyb3plblRyYW5zY3JpcHRTdGF0ZV0gPSB1c2VTdGF0ZTx7XG4gICAgbWVzc2FnZXNMZW5ndGg6IG51bWJlclxuICAgIHN0cmVhbWluZ1Rvb2xVc2VzTGVuZ3RoOiBudW1iZXJcbiAgfSB8IG51bGw+KG51bGwpXG4gIC8vIEluaXRpYWxpemUgaW5wdXQgd2l0aCBhbnkgZWFybHkgaW5wdXQgdGhhdCB3YXMgY2FwdHVyZWQgYmVmb3JlIFJFUEwgd2FzIHJlYWR5LlxuICAvLyBVc2luZyBsYXp5IGluaXRpYWxpemF0aW9uIGVuc3VyZXMgY3Vyc29yIG9mZnNldCBpcyBzZXQgY29ycmVjdGx5IGluIFByb21wdElucHV0LlxuICBjb25zdCBbaW5wdXRWYWx1ZSwgc2V0SW5wdXRWYWx1ZVJhd10gPSB1c2VTdGF0ZSgoKSA9PiBjb25zdW1lRWFybHlJbnB1dCgpKVxuICBjb25zdCBpbnB1dFZhbHVlUmVmID0gdXNlUmVmKGlucHV0VmFsdWUpXG4gIGlucHV0VmFsdWVSZWYuY3VycmVudCA9IGlucHV0VmFsdWVcbiAgY29uc3QgaW5zZXJ0VGV4dFJlZiA9IHVzZVJlZjx7XG4gICAgaW5zZXJ0OiAodGV4dDogc3RyaW5nKSA9PiB2b2lkXG4gICAgc2V0SW5wdXRXaXRoQ3Vyc29yOiAodmFsdWU6IHN0cmluZywgY3Vyc29yOiBudW1iZXIpID0+IHZvaWRcbiAgICBjdXJzb3JPZmZzZXQ6IG51bWJlclxuICB9IHwgbnVsbD4obnVsbClcblxuICAvLyBXcmFwIHNldElucHV0VmFsdWUgdG8gY28tbG9jYXRlIHN1cHByZXNzaW9uIHN0YXRlIHVwZGF0ZXMuXG4gIC8vIEJvdGggc2V0U3RhdGUgY2FsbHMgaGFwcGVuIGluIHRoZSBzYW1lIHN5bmNocm9ub3VzIGNvbnRleHQgc28gUmVhY3RcbiAgLy8gYmF0Y2hlcyB0aGVtIGludG8gYSBzaW5nbGUgcmVuZGVyLCBlbGltaW5hdGluZyB0aGUgZXh0cmEgcmVuZGVyIHRoYXRcbiAgLy8gdGhlIHByZXZpb3VzIHVzZUVmZmVjdCDihpIgc2V0U3RhdGUgcGF0dGVybiBjYXVzZWQuXG4gIGNvbnN0IHNldElucHV0VmFsdWUgPSB1c2VDYWxsYmFjayhcbiAgICAodmFsdWU6IHN0cmluZykgPT4ge1xuICAgICAgaWYgKHRyeVN1Z2dlc3RCZ1BSSW50ZXJjZXB0KGlucHV0VmFsdWVSZWYuY3VycmVudCwgdmFsdWUpKSByZXR1cm5cbiAgICAgIC8vIEluIGZ1bGxzY3JlZW4gbW9kZSwgdHlwaW5nIGludG8gYW4gZW1wdHkgcHJvbXB0IHJlLXBpbnMgc2Nyb2xsIHRvXG4gICAgICAvLyBib3R0b20uIE9ubHkgZmlyZXMgb24gZW1wdHnihpJub24tZW1wdHkgc28gc2Nyb2xsaW5nIHVwIHRvIHJlZmVyZW5jZVxuICAgICAgLy8gc29tZXRoaW5nIHdoaWxlIGNvbXBvc2luZyBhIG1lc3NhZ2UgZG9lc24ndCB5YW5rIHRoZSB2aWV3IGJhY2sgb25cbiAgICAgIC8vIGV2ZXJ5IGtleXN0cm9rZS4gUmVzdG9yZXMgdGhlIHByZS1mdWxsc2NyZWVuIG11c2NsZSBtZW1vcnkgb2ZcbiAgICAgIC8vIHR5cGluZyB0byBzbmFwIGJhY2sgdG8gdGhlIGVuZCBvZiB0aGUgY29udmVyc2F0aW9uLlxuICAgICAgLy8gU2tpcHBlZCBpZiB0aGUgdXNlciBzY3JvbGxlZCB3aXRoaW4gdGhlIGxhc3QgM3Mg4oCUIHRoZXkncmUgYWN0aXZlbHlcbiAgICAgIC8vIHJlYWRpbmcsIG5vdCBsb3N0LiBsYXN0VXNlclNjcm9sbFRzUmVmIHN0YXJ0cyBhdCAwIHNvIHRoZSBmaXJzdC1cbiAgICAgIC8vIGV2ZXIga2V5cHJlc3MgKG5vIHNjcm9sbCB5ZXQpIGFsd2F5cyByZXBpbnMuXG4gICAgICBpZiAoXG4gICAgICAgIGlucHV0VmFsdWVSZWYuY3VycmVudCA9PT0gJycgJiZcbiAgICAgICAgdmFsdWUgIT09ICcnICYmXG4gICAgICAgIERhdGUubm93KCkgLSBsYXN0VXNlclNjcm9sbFRzUmVmLmN1cnJlbnQgPj1cbiAgICAgICAgICBSRUNFTlRfU0NST0xMX1JFUElOX1dJTkRPV19NU1xuICAgICAgKSB7XG4gICAgICAgIHJlcGluU2Nyb2xsKClcbiAgICAgIH1cbiAgICAgIC8vIFN5bmMgcmVmIGltbWVkaWF0ZWx5IChsaWtlIHNldE1lc3NhZ2VzKSBzbyBjYWxsZXJzIHRoYXQgcmVhZFxuICAgICAgLy8gaW5wdXRWYWx1ZVJlZiBiZWZvcmUgUmVhY3QgY29tbWl0cyDigJQgZS5nLiB0aGUgYXV0by1yZXN0b3JlIGZpbmFsbHlcbiAgICAgIC8vIGJsb2NrJ3MgYD09PSAnJ2AgZ3VhcmQg4oCUIHNlZSB0aGUgZnJlc2ggdmFsdWUsIG5vdCB0aGUgc3RhbGUgcmVuZGVyLlxuICAgICAgaW5wdXRWYWx1ZVJlZi5jdXJyZW50ID0gdmFsdWVcbiAgICAgIHNldElucHV0VmFsdWVSYXcodmFsdWUpXG4gICAgICBzZXRJc1Byb21wdElucHV0QWN0aXZlKHZhbHVlLnRyaW0oKS5sZW5ndGggPiAwKVxuICAgIH0sXG4gICAgW3NldElzUHJvbXB0SW5wdXRBY3RpdmUsIHJlcGluU2Nyb2xsLCB0cnlTdWdnZXN0QmdQUkludGVyY2VwdF0sXG4gIClcblxuICAvLyBTY2hlZHVsZSBhIHRpbWVvdXQgdG8gc3RvcCBzdXBwcmVzc2luZyBkaWFsb2dzIGFmdGVyIHRoZSB1c2VyIHN0b3BzIHR5cGluZy5cbiAgLy8gT25seSBtYW5hZ2VzIHRoZSB0aW1lb3V0IOKAlCB0aGUgaW1tZWRpYXRlIGFjdGl2YXRpb24gaXMgaGFuZGxlZCBieSBzZXRJbnB1dFZhbHVlIGFib3ZlLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChpbnB1dFZhbHVlLnRyaW0oKS5sZW5ndGggPT09IDApIHJldHVyblxuICAgIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dChcbiAgICAgIHNldElzUHJvbXB0SW5wdXRBY3RpdmUsXG4gICAgICBQUk9NUFRfU1VQUFJFU1NJT05fTVMsXG4gICAgICBmYWxzZSxcbiAgICApXG4gICAgcmV0dXJuICgpID0+IGNsZWFyVGltZW91dCh0aW1lcilcbiAgfSwgW2lucHV0VmFsdWVdKVxuXG4gIGNvbnN0IFtpbnB1dE1vZGUsIHNldElucHV0TW9kZV0gPSB1c2VTdGF0ZTxQcm9tcHRJbnB1dE1vZGU+KCdwcm9tcHQnKVxuICBjb25zdCBbc3Rhc2hlZFByb21wdCwgc2V0U3Rhc2hlZFByb21wdF0gPSB1c2VTdGF0ZTxcbiAgICB8IHtcbiAgICAgICAgdGV4dDogc3RyaW5nXG4gICAgICAgIGN1cnNvck9mZnNldDogbnVtYmVyXG4gICAgICAgIHBhc3RlZENvbnRlbnRzOiBSZWNvcmQ8bnVtYmVyLCBQYXN0ZWRDb250ZW50PlxuICAgICAgfVxuICAgIHwgdW5kZWZpbmVkXG4gID4oKVxuXG4gIC8vIENhbGxiYWNrIHRvIGZpbHRlciBjb21tYW5kcyBiYXNlZCBvbiBDQ1IncyBhdmFpbGFibGUgc2xhc2ggY29tbWFuZHNcbiAgY29uc3QgaGFuZGxlUmVtb3RlSW5pdCA9IHVzZUNhbGxiYWNrKFxuICAgIChyZW1vdGVTbGFzaENvbW1hbmRzOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgY29uc3QgcmVtb3RlQ29tbWFuZFNldCA9IG5ldyBTZXQocmVtb3RlU2xhc2hDb21tYW5kcylcbiAgICAgIC8vIEtlZXAgY29tbWFuZHMgdGhhdCBDQ1IgbGlzdHMgT1IgdGhhdCBhcmUgaW4gdGhlIGxvY2FsLXNhZmUgc2V0XG4gICAgICBzZXRMb2NhbENvbW1hbmRzKHByZXYgPT5cbiAgICAgICAgcHJldi5maWx0ZXIoXG4gICAgICAgICAgY21kID0+XG4gICAgICAgICAgICByZW1vdGVDb21tYW5kU2V0LmhhcyhjbWQubmFtZSkgfHwgUkVNT1RFX1NBRkVfQ09NTUFORFMuaGFzKGNtZCksXG4gICAgICAgICksXG4gICAgICApXG4gICAgfSxcbiAgICBbc2V0TG9jYWxDb21tYW5kc10sXG4gIClcblxuICBjb25zdCBbaW5Qcm9ncmVzc1Rvb2xVc2VJRHMsIHNldEluUHJvZ3Jlc3NUb29sVXNlSURzXSA9IHVzZVN0YXRlPFNldDxzdHJpbmc+PihcbiAgICBuZXcgU2V0KCksXG4gIClcbiAgY29uc3QgaGFzSW50ZXJydXB0aWJsZVRvb2xJblByb2dyZXNzUmVmID0gdXNlUmVmKGZhbHNlKVxuXG4gIC8vIFJlbW90ZSBzZXNzaW9uIGhvb2sgLSBtYW5hZ2VzIFdlYlNvY2tldCBjb25uZWN0aW9uIGFuZCBtZXNzYWdlIGhhbmRsaW5nIGZvciAtLXJlbW90ZSBtb2RlXG4gIGNvbnN0IHJlbW90ZVNlc3Npb24gPSB1c2VSZW1vdGVTZXNzaW9uKHtcbiAgICBjb25maWc6IHJlbW90ZVNlc3Npb25Db25maWcsXG4gICAgc2V0TWVzc2FnZXMsXG4gICAgc2V0SXNMb2FkaW5nOiBzZXRJc0V4dGVybmFsTG9hZGluZyxcbiAgICBvbkluaXQ6IGhhbmRsZVJlbW90ZUluaXQsXG4gICAgc2V0VG9vbFVzZUNvbmZpcm1RdWV1ZSxcbiAgICB0b29sczogY29tYmluZWRJbml0aWFsVG9vbHMsXG4gICAgc2V0U3RyZWFtaW5nVG9vbFVzZXMsXG4gICAgc2V0U3RyZWFtTW9kZSxcbiAgICBzZXRJblByb2dyZXNzVG9vbFVzZUlEcyxcbiAgfSlcblxuICAvLyBEaXJlY3QgY29ubmVjdCBob29rIC0gbWFuYWdlcyBXZWJTb2NrZXQgdG8gYSBjbGF1ZGUgc2VydmVyIGZvciBgY2xhdWRlIGNvbm5lY3RgIG1vZGVcbiAgY29uc3QgZGlyZWN0Q29ubmVjdCA9IHVzZURpcmVjdENvbm5lY3Qoe1xuICAgIGNvbmZpZzogZGlyZWN0Q29ubmVjdENvbmZpZyxcbiAgICBzZXRNZXNzYWdlcyxcbiAgICBzZXRJc0xvYWRpbmc6IHNldElzRXh0ZXJuYWxMb2FkaW5nLFxuICAgIHNldFRvb2xVc2VDb25maXJtUXVldWUsXG4gICAgdG9vbHM6IGNvbWJpbmVkSW5pdGlhbFRvb2xzLFxuICB9KVxuXG4gIC8vIFNTSCBzZXNzaW9uIGhvb2sgLSBtYW5hZ2VzIHNzaCBjaGlsZCBwcm9jZXNzIGZvciBgY2xhdWRlIHNzaGAgbW9kZS5cbiAgLy8gU2FtZSBjYWxsYmFjayBzaGFwZSBhcyB1c2VEaXJlY3RDb25uZWN0OyBvbmx5IHRoZSB0cmFuc3BvcnQgdW5kZXIgdGhlXG4gIC8vIGhvb2QgZGlmZmVycyAoQ2hpbGRQcm9jZXNzIHN0ZGluL3N0ZG91dCB2cyBXZWJTb2NrZXQpLlxuICBjb25zdCBzc2hSZW1vdGUgPSB1c2VTU0hTZXNzaW9uKHtcbiAgICBzZXNzaW9uOiBzc2hTZXNzaW9uLFxuICAgIHNldE1lc3NhZ2VzLFxuICAgIHNldElzTG9hZGluZzogc2V0SXNFeHRlcm5hbExvYWRpbmcsXG4gICAgc2V0VG9vbFVzZUNvbmZpcm1RdWV1ZSxcbiAgICB0b29sczogY29tYmluZWRJbml0aWFsVG9vbHMsXG4gIH0pXG5cbiAgLy8gVXNlIHdoaWNoZXZlciByZW1vdGUgbW9kZSBpcyBhY3RpdmVcbiAgY29uc3QgYWN0aXZlUmVtb3RlID0gc3NoUmVtb3RlLmlzUmVtb3RlTW9kZVxuICAgID8gc3NoUmVtb3RlXG4gICAgOiBkaXJlY3RDb25uZWN0LmlzUmVtb3RlTW9kZVxuICAgICAgPyBkaXJlY3RDb25uZWN0XG4gICAgICA6IHJlbW90ZVNlc3Npb25cblxuICBjb25zdCBbcGFzdGVkQ29udGVudHMsIHNldFBhc3RlZENvbnRlbnRzXSA9IHVzZVN0YXRlPFxuICAgIFJlY29yZDxudW1iZXIsIFBhc3RlZENvbnRlbnQ+XG4gID4oe30pXG4gIGNvbnN0IFtzdWJtaXRDb3VudCwgc2V0U3VibWl0Q291bnRdID0gdXNlU3RhdGUoMClcbiAgLy8gUmVmIGluc3RlYWQgb2Ygc3RhdGUgdG8gYXZvaWQgdHJpZ2dlcmluZyBSZWFjdCByZS1yZW5kZXJzIG9uIGV2ZXJ5XG4gIC8vIHN0cmVhbWluZyB0ZXh0X2RlbHRhLiBUaGUgc3Bpbm5lciByZWFkcyB0aGlzIHZpYSBpdHMgYW5pbWF0aW9uIHRpbWVyLlxuICBjb25zdCByZXNwb25zZUxlbmd0aFJlZiA9IHVzZVJlZigwKVxuICAvLyBBUEkgcGVyZm9ybWFuY2UgbWV0cmljcyByZWYgZm9yIGFudC1vbmx5IHNwaW5uZXIgZGlzcGxheSAoVFRGVC9PVFBTKS5cbiAgLy8gQWNjdW11bGF0ZXMgbWV0cmljcyBmcm9tIGFsbCBBUEkgcmVxdWVzdHMgaW4gYSB0dXJuIGZvciBQNTAgYWdncmVnYXRpb24uXG4gIGNvbnN0IGFwaU1ldHJpY3NSZWYgPSB1c2VSZWY8XG4gICAgQXJyYXk8e1xuICAgICAgdHRmdE1zOiBudW1iZXJcbiAgICAgIGZpcnN0VG9rZW5UaW1lOiBudW1iZXJcbiAgICAgIGxhc3RUb2tlblRpbWU6IG51bWJlclxuICAgICAgcmVzcG9uc2VMZW5ndGhCYXNlbGluZTogbnVtYmVyXG4gICAgICAvLyBUcmFja3MgcmVzcG9uc2VMZW5ndGhSZWYgYXQgdGhlIHRpbWUgb2YgdGhlIGxhc3QgY29udGVudCBhZGRpdGlvbi5cbiAgICAgIC8vIFVwZGF0ZWQgYnkgYm90aCBzdHJlYW1pbmcgZGVsdGFzIGFuZCBzdWJhZ2VudCBtZXNzYWdlIGNvbnRlbnQuXG4gICAgICAvLyBsYXN0VG9rZW5UaW1lIGlzIGFsc28gdXBkYXRlZCBhdCB0aGUgc2FtZSB0aW1lLCBzbyB0aGUgT1RQU1xuICAgICAgLy8gZGVub21pbmF0b3IgY29ycmVjdGx5IGluY2x1ZGVzIHN1YmFnZW50IHByb2Nlc3NpbmcgdGltZS5cbiAgICAgIGVuZFJlc3BvbnNlTGVuZ3RoOiBudW1iZXJcbiAgICB9PlxuICA+KFtdKVxuICBjb25zdCBzZXRSZXNwb25zZUxlbmd0aCA9IHVzZUNhbGxiYWNrKChmOiAocHJldjogbnVtYmVyKSA9PiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBwcmV2ID0gcmVzcG9uc2VMZW5ndGhSZWYuY3VycmVudFxuICAgIHJlc3BvbnNlTGVuZ3RoUmVmLmN1cnJlbnQgPSBmKHByZXYpXG4gICAgLy8gV2hlbiBjb250ZW50IGlzIGFkZGVkIChub3QgYSBjb21wYWN0aW9uIHJlc2V0KSwgdXBkYXRlIHRoZSBsYXRlc3RcbiAgICAvLyBtZXRyaWNzIGVudHJ5IHNvIE9UUFMgcmVmbGVjdHMgYWxsIGNvbnRlbnQgZ2VuZXJhdGlvbiBhY3Rpdml0eS5cbiAgICAvLyBVcGRhdGluZyBsYXN0VG9rZW5UaW1lIGhlcmUgZW5zdXJlcyB0aGUgZGVub21pbmF0b3IgaW5jbHVkZXMgYm90aFxuICAgIC8vIHN0cmVhbWluZyB0aW1lIEFORCBzdWJhZ2VudCBleGVjdXRpb24gdGltZSwgcHJldmVudGluZyBpbmZsYXRpb24uXG4gICAgaWYgKHJlc3BvbnNlTGVuZ3RoUmVmLmN1cnJlbnQgPiBwcmV2KSB7XG4gICAgICBjb25zdCBlbnRyaWVzID0gYXBpTWV0cmljc1JlZi5jdXJyZW50XG4gICAgICBpZiAoZW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGxhc3RFbnRyeSA9IGVudHJpZXMuYXQoLTEpIVxuICAgICAgICBsYXN0RW50cnkubGFzdFRva2VuVGltZSA9IERhdGUubm93KClcbiAgICAgICAgbGFzdEVudHJ5LmVuZFJlc3BvbnNlTGVuZ3RoID0gcmVzcG9uc2VMZW5ndGhSZWYuY3VycmVudFxuICAgICAgfVxuICAgIH1cbiAgfSwgW10pXG5cbiAgLy8gU3RyZWFtaW5nIHRleHQgZGlzcGxheTogc2V0IHN0YXRlIGRpcmVjdGx5IHBlciBkZWx0YSAoSW5rJ3MgMTZtcyByZW5kZXJcbiAgLy8gdGhyb3R0bGUgYmF0Y2hlcyByYXBpZCB1cGRhdGVzKS4gQ2xlYXJlZCBvbiBtZXNzYWdlIGFycml2YWwgKG1lc3NhZ2VzLnRzKVxuICAvLyBzbyBkaXNwbGF5ZWRNZXNzYWdlcyBzd2l0Y2hlcyBmcm9tIGRlZmVycmVkTWVzc2FnZXMgdG8gbWVzc2FnZXMgYXRvbWljYWxseS5cbiAgY29uc3QgW3N0cmVhbWluZ1RleHQsIHNldFN0cmVhbWluZ1RleHRdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgY29uc3QgcmVkdWNlZE1vdGlvbiA9XG4gICAgdXNlQXBwU3RhdGUocyA9PiBzLnNldHRpbmdzLnByZWZlcnNSZWR1Y2VkTW90aW9uKSA/PyBmYWxzZVxuICBjb25zdCBzaG93U3RyZWFtaW5nVGV4dCA9ICFyZWR1Y2VkTW90aW9uICYmICFoYXNDdXJzb3JVcFZpZXdwb3J0WWFua0J1ZygpXG4gIGNvbnN0IG9uU3RyZWFtaW5nVGV4dCA9IHVzZUNhbGxiYWNrKFxuICAgIChmOiAoY3VycmVudDogc3RyaW5nIHwgbnVsbCkgPT4gc3RyaW5nIHwgbnVsbCkgPT4ge1xuICAgICAgaWYgKCFzaG93U3RyZWFtaW5nVGV4dCkgcmV0dXJuXG4gICAgICBzZXRTdHJlYW1pbmdUZXh0KGYpXG4gICAgfSxcbiAgICBbc2hvd1N0cmVhbWluZ1RleHRdLFxuICApXG5cbiAgLy8gSGlkZSB0aGUgaW4tcHJvZ3Jlc3Mgc291cmNlIGxpbmUgc28gdGV4dCBzdHJlYW1zIGxpbmUtYnktbGluZSwgbm90XG4gIC8vIGNoYXItYnktY2hhci4gbGFzdEluZGV4T2YgcmV0dXJucyAtMSB3aGVuIG5vIG5ld2xpbmUsIGdpdmluZyAnJyDihpIgbnVsbC5cbiAgLy8gR3VhcmQgb24gc2hvd1N0cmVhbWluZ1RleHQgc28gdG9nZ2xpbmcgcmVkdWNlZE1vdGlvbiBtaWQtc3RyZWFtXG4gIC8vIGltbWVkaWF0ZWx5IGhpZGVzIHRoZSBzdHJlYW1pbmcgcHJldmlldy5cbiAgY29uc3QgdmlzaWJsZVN0cmVhbWluZ1RleHQgPVxuICAgIHN0cmVhbWluZ1RleHQgJiYgc2hvd1N0cmVhbWluZ1RleHRcbiAgICAgID8gc3RyZWFtaW5nVGV4dC5zdWJzdHJpbmcoMCwgc3RyZWFtaW5nVGV4dC5sYXN0SW5kZXhPZignXFxuJykgKyAxKSB8fCBudWxsXG4gICAgICA6IG51bGxcblxuICBjb25zdCBbbGFzdFF1ZXJ5Q29tcGxldGlvblRpbWUsIHNldExhc3RRdWVyeUNvbXBsZXRpb25UaW1lXSA9IHVzZVN0YXRlKDApXG4gIGNvbnN0IFtzcGlubmVyTWVzc2FnZSwgc2V0U3Bpbm5lck1lc3NhZ2VdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW3NwaW5uZXJDb2xvciwgc2V0U3Bpbm5lckNvbG9yXSA9IHVzZVN0YXRlPGtleW9mIFRoZW1lIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW3NwaW5uZXJTaGltbWVyQ29sb3IsIHNldFNwaW5uZXJTaGltbWVyQ29sb3JdID0gdXNlU3RhdGU8XG4gICAga2V5b2YgVGhlbWUgfCBudWxsXG4gID4obnVsbClcbiAgY29uc3QgW2lzTWVzc2FnZVNlbGVjdG9yVmlzaWJsZSwgc2V0SXNNZXNzYWdlU2VsZWN0b3JWaXNpYmxlXSA9XG4gICAgdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFttZXNzYWdlU2VsZWN0b3JQcmVzZWxlY3QsIHNldE1lc3NhZ2VTZWxlY3RvclByZXNlbGVjdF0gPSB1c2VTdGF0ZTxcbiAgICBVc2VyTWVzc2FnZSB8IHVuZGVmaW5lZFxuICA+KHVuZGVmaW5lZClcbiAgY29uc3QgW3Nob3dDb3N0RGlhbG9nLCBzZXRTaG93Q29zdERpYWxvZ10gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2NvbnZlcnNhdGlvbklkLCBzZXRDb252ZXJzYXRpb25JZF0gPSB1c2VTdGF0ZShyYW5kb21VVUlEKCkpXG5cbiAgLy8gSWRsZS1yZXR1cm4gZGlhbG9nOiBzaG93biB3aGVuIHVzZXIgc3VibWl0cyBhZnRlciBhIGxvbmcgaWRsZSBnYXBcbiAgY29uc3QgW2lkbGVSZXR1cm5QZW5kaW5nLCBzZXRJZGxlUmV0dXJuUGVuZGluZ10gPSB1c2VTdGF0ZTx7XG4gICAgaW5wdXQ6IHN0cmluZ1xuICAgIGlkbGVNaW51dGVzOiBudW1iZXJcbiAgfSB8IG51bGw+KG51bGwpXG4gIGNvbnN0IHNraXBJZGxlQ2hlY2tSZWYgPSB1c2VSZWYoZmFsc2UpXG4gIGNvbnN0IGxhc3RRdWVyeUNvbXBsZXRpb25UaW1lUmVmID0gdXNlUmVmKGxhc3RRdWVyeUNvbXBsZXRpb25UaW1lKVxuICBsYXN0UXVlcnlDb21wbGV0aW9uVGltZVJlZi5jdXJyZW50ID0gbGFzdFF1ZXJ5Q29tcGxldGlvblRpbWVcblxuICAvLyBBZ2dyZWdhdGUgdG9vbCByZXN1bHQgYnVkZ2V0OiBwZXItY29udmVyc2F0aW9uIGRlY2lzaW9uIHRyYWNraW5nLlxuICAvLyBXaGVuIHRoZSBHcm93dGhCb29rIGZsYWcgaXMgb24sIHF1ZXJ5LnRzIGVuZm9yY2VzIHRoZSBidWRnZXQ7IHdoZW5cbiAgLy8gb2ZmICh1bmRlZmluZWQpLCBlbmZvcmNlbWVudCBpcyBza2lwcGVkIGVudGlyZWx5LiBTdGFsZSBlbnRyaWVzIGFmdGVyXG4gIC8vIC9jbGVhciwgcmV3aW5kLCBvciBjb21wYWN0IGFyZSBoYXJtbGVzcyAodG9vbF91c2VfaWRzIGFyZSBVVUlEcywgc3RhbGVcbiAgLy8ga2V5cyBhcmUgbmV2ZXIgbG9va2VkIHVwKS4gTWVtb3J5IGlzIGJvdW5kZWQgYnkgdG90YWwgcmVwbGFjZW1lbnQgY291bnRcbiAgLy8gw5cgfjJLQiBwcmV2aWV3IG92ZXIgdGhlIFJFUEwgbGlmZXRpbWUg4oCUIG5lZ2xpZ2libGUuXG4gIC8vXG4gIC8vIExhenkgaW5pdCB2aWEgdXNlU3RhdGUgaW5pdGlhbGl6ZXIg4oCUIHVzZVJlZihleHByKSBldmFsdWF0ZXMgZXhwciBvbiBldmVyeVxuICAvLyByZW5kZXIgKFJlYWN0IGlnbm9yZXMgaXQgYWZ0ZXIgZmlyc3QsIGJ1dCB0aGUgY29tcHV0YXRpb24gc3RpbGwgcnVucykuXG4gIC8vIEZvciBsYXJnZSByZXN1bWVkIHNlc3Npb25zLCByZWNvbnN0cnVjdGlvbiBkb2VzIE8obWVzc2FnZXMgw5cgYmxvY2tzKVxuICAvLyB3b3JrOyB3ZSBvbmx5IHdhbnQgdGhhdCBvbmNlLlxuICBjb25zdCBbY29udGVudFJlcGxhY2VtZW50U3RhdGVSZWZdID0gdXNlU3RhdGUoKCkgPT4gKHtcbiAgICBjdXJyZW50OiBwcm92aXNpb25Db250ZW50UmVwbGFjZW1lbnRTdGF0ZShcbiAgICAgIGluaXRpYWxNZXNzYWdlcyxcbiAgICAgIGluaXRpYWxDb250ZW50UmVwbGFjZW1lbnRzLFxuICAgICksXG4gIH0pKVxuXG4gIGNvbnN0IFtoYXZlU2hvd25Db3N0RGlhbG9nLCBzZXRIYXZlU2hvd25Db3N0RGlhbG9nXSA9IHVzZVN0YXRlKFxuICAgIGdldEdsb2JhbENvbmZpZygpLmhhc0Fja25vd2xlZGdlZENvc3RUaHJlc2hvbGQsXG4gIClcbiAgY29uc3QgW3ZpbU1vZGUsIHNldFZpbU1vZGVdID0gdXNlU3RhdGU8VmltTW9kZT4oJ0lOU0VSVCcpXG4gIGNvbnN0IFtzaG93QmFzaGVzRGlhbG9nLCBzZXRTaG93QmFzaGVzRGlhbG9nXSA9IHVzZVN0YXRlPHN0cmluZyB8IGJvb2xlYW4+KFxuICAgIGZhbHNlLFxuICApXG4gIGNvbnN0IFtpc1NlYXJjaGluZ0hpc3RvcnksIHNldElzU2VhcmNoaW5nSGlzdG9yeV0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2lzSGVscE9wZW4sIHNldElzSGVscE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpXG5cbiAgLy8gc2hvd0Jhc2hlc0RpYWxvZyBpcyBSRVBMLWxldmVsIHNvIGl0IHN1cnZpdmVzIFByb21wdElucHV0IHVubW91bnRpbmcuXG4gIC8vIFdoZW4gdWx0cmFwbGFuIGFwcHJvdmFsIGZpcmVzIHdoaWxlIHRoZSBwaWxsIGRpYWxvZyBpcyBvcGVuLCBQcm9tcHRJbnB1dFxuICAvLyB1bm1vdW50cyAoZm9jdXNlZElucHV0RGlhbG9nIOKGkiAndWx0cmFwbGFuLWNob2ljZScpIGJ1dCB0aGlzIHN0YXlzIHRydWU7XG4gIC8vIGFmdGVyIGFjY2VwdGluZywgUHJvbXB0SW5wdXQgcmVtb3VudHMgaW50byBhbiBlbXB0eSBcIk5vIHRhc2tzXCIgZGlhbG9nXG4gIC8vICh0aGUgY29tcGxldGVkIHVsdHJhcGxhbiB0YXNrIGhhcyBiZWVuIGZpbHRlcmVkIG91dCkuIENsb3NlIGl0IGhlcmUuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHVsdHJhcGxhblBlbmRpbmdDaG9pY2UgJiYgc2hvd0Jhc2hlc0RpYWxvZykge1xuICAgICAgc2V0U2hvd0Jhc2hlc0RpYWxvZyhmYWxzZSlcbiAgICB9XG4gIH0sIFt1bHRyYXBsYW5QZW5kaW5nQ2hvaWNlLCBzaG93QmFzaGVzRGlhbG9nXSlcblxuICBjb25zdCBpc1Rlcm1pbmFsRm9jdXNlZCA9IHVzZVRlcm1pbmFsRm9jdXMoKVxuICBjb25zdCB0ZXJtaW5hbEZvY3VzUmVmID0gdXNlUmVmKGlzVGVybWluYWxGb2N1c2VkKVxuICB0ZXJtaW5hbEZvY3VzUmVmLmN1cnJlbnQgPSBpc1Rlcm1pbmFsRm9jdXNlZFxuXG4gIGNvbnN0IFt0aGVtZV0gPSB1c2VUaGVtZSgpXG5cbiAgLy8gcmVzZXRMb2FkaW5nU3RhdGUgcnVucyB0d2ljZSBwZXIgdHVybiAob25RdWVyeUltcGwgdGFpbCArIG9uUXVlcnkgZmluYWxseSkuXG4gIC8vIFdpdGhvdXQgdGhpcyBndWFyZCwgYm90aCBjYWxscyBwaWNrIGEgdGlwIOKGkiB0d28gcmVjb3JkU2hvd25UaXAg4oaSIHR3b1xuICAvLyBzYXZlR2xvYmFsQ29uZmlnIHdyaXRlcyBiYWNrLXRvLWJhY2suIFJlc2V0IGF0IHN1Ym1pdCBpbiBvblN1Ym1pdC5cbiAgY29uc3QgdGlwUGlja2VkVGhpc1R1cm5SZWYgPSBSZWFjdC51c2VSZWYoZmFsc2UpXG4gIGNvbnN0IHBpY2tOZXdTcGlubmVyVGlwID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmICh0aXBQaWNrZWRUaGlzVHVyblJlZi5jdXJyZW50KSByZXR1cm5cbiAgICB0aXBQaWNrZWRUaGlzVHVyblJlZi5jdXJyZW50ID0gdHJ1ZVxuICAgIGNvbnN0IG5ld01lc3NhZ2VzID0gbWVzc2FnZXNSZWYuY3VycmVudC5zbGljZShiYXNoVG9vbHNQcm9jZXNzZWRJZHguY3VycmVudClcbiAgICBmb3IgKGNvbnN0IHRvb2wgb2YgZXh0cmFjdEJhc2hUb29sc0Zyb21NZXNzYWdlcyhuZXdNZXNzYWdlcykpIHtcbiAgICAgIGJhc2hUb29scy5jdXJyZW50LmFkZCh0b29sKVxuICAgIH1cbiAgICBiYXNoVG9vbHNQcm9jZXNzZWRJZHguY3VycmVudCA9IG1lc3NhZ2VzUmVmLmN1cnJlbnQubGVuZ3RoXG4gICAgdm9pZCBnZXRUaXBUb1Nob3dPblNwaW5uZXIoe1xuICAgICAgdGhlbWUsXG4gICAgICByZWFkRmlsZVN0YXRlOiByZWFkRmlsZVN0YXRlLmN1cnJlbnQsXG4gICAgICBiYXNoVG9vbHM6IGJhc2hUb29scy5jdXJyZW50LFxuICAgIH0pLnRoZW4oYXN5bmMgdGlwID0+IHtcbiAgICAgIGlmICh0aXApIHtcbiAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRpcC5jb250ZW50KHsgdGhlbWUgfSlcbiAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgc3Bpbm5lclRpcDogY29udGVudCxcbiAgICAgICAgfSkpXG4gICAgICAgIHJlY29yZFNob3duVGlwKHRpcClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgIGlmIChwcmV2LnNwaW5uZXJUaXAgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHByZXZcbiAgICAgICAgICByZXR1cm4geyAuLi5wcmV2LCBzcGlubmVyVGlwOiB1bmRlZmluZWQgfVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pXG4gIH0sIFtzZXRBcHBTdGF0ZSwgdGhlbWVdKVxuXG4gIC8vIFJlc2V0cyBVSSBsb2FkaW5nIHN0YXRlLiBEb2VzIE5PVCBjYWxsIG9uVHVybkNvbXBsZXRlIC0gdGhhdCBzaG91bGQgYmVcbiAgLy8gY2FsbGVkIGV4cGxpY2l0bHkgb25seSB3aGVuIGEgcXVlcnkgdHVybiBhY3R1YWxseSBjb21wbGV0ZXMuXG4gIGNvbnN0IHJlc2V0TG9hZGluZ1N0YXRlID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIC8vIGlzTG9hZGluZyBpcyBub3cgZGVyaXZlZCBmcm9tIHF1ZXJ5R3VhcmQg4oCUIG5vIHNldHRlciBjYWxsIG5lZWRlZC5cbiAgICAvLyBxdWVyeUd1YXJkLmVuZCgpIChvblF1ZXJ5IGZpbmFsbHkpIG9yIGNhbmNlbFJlc2VydmF0aW9uKCkgKGV4ZWN1dGVVc2VySW5wdXRcbiAgICAvLyBmaW5hbGx5KSBoYXZlIGFscmVhZHkgdHJhbnNpdGlvbmVkIHRoZSBndWFyZCB0byBpZGxlIGJ5IHRoZSB0aW1lIHRoaXMgcnVucy5cbiAgICAvLyBFeHRlcm5hbCBsb2FkaW5nIChyZW1vdGUvYmFja2dyb3VuZGluZykgaXMgcmVzZXQgc2VwYXJhdGVseSBieSB0aG9zZSBob29rcy5cbiAgICBzZXRJc0V4dGVybmFsTG9hZGluZyhmYWxzZSlcbiAgICBzZXRVc2VySW5wdXRPblByb2Nlc3NpbmcodW5kZWZpbmVkKVxuICAgIHJlc3BvbnNlTGVuZ3RoUmVmLmN1cnJlbnQgPSAwXG4gICAgYXBpTWV0cmljc1JlZi5jdXJyZW50ID0gW11cbiAgICBzZXRTdHJlYW1pbmdUZXh0KG51bGwpXG4gICAgc2V0U3RyZWFtaW5nVG9vbFVzZXMoW10pXG4gICAgc2V0U3Bpbm5lck1lc3NhZ2UobnVsbClcbiAgICBzZXRTcGlubmVyQ29sb3IobnVsbClcbiAgICBzZXRTcGlubmVyU2hpbW1lckNvbG9yKG51bGwpXG4gICAgcGlja05ld1NwaW5uZXJUaXAoKVxuICAgIGVuZEludGVyYWN0aW9uU3BhbigpXG4gICAgLy8gU3BlY3VsYXRpdmUgYmFzaCBjbGFzc2lmaWVyIGNoZWNrcyBhcmUgb25seSB2YWxpZCBmb3IgdGhlIGN1cnJlbnRcbiAgICAvLyB0dXJuJ3MgY29tbWFuZHMg4oCUIGNsZWFyIGFmdGVyIGVhY2ggdHVybiB0byBhdm9pZCBhY2N1bXVsYXRpbmdcbiAgICAvLyBQcm9taXNlIGNoYWlucyBmb3IgdW5jb25zdW1lZCBjaGVja3MgKGRlbmllZC9hYm9ydGVkIHBhdGhzKS5cbiAgICBjbGVhclNwZWN1bGF0aXZlQ2hlY2tzKClcbiAgfSwgW3BpY2tOZXdTcGlubmVyVGlwXSlcblxuICAvLyBTZXNzaW9uIGJhY2tncm91bmRpbmcg4oCUIGhvb2sgaXMgYmVsb3csIGFmdGVyIGdldFRvb2xVc2VDb250ZXh0XG5cbiAgY29uc3QgaGFzUnVubmluZ1RlYW1tYXRlcyA9IHVzZU1lbW8oXG4gICAgKCkgPT4gZ2V0QWxsSW5Qcm9jZXNzVGVhbW1hdGVUYXNrcyh0YXNrcykuc29tZSh0ID0+IHQuc3RhdHVzID09PSAncnVubmluZycpLFxuICAgIFt0YXNrc10sXG4gIClcblxuICAvLyBTaG93IGRlZmVycmVkIHR1cm4gZHVyYXRpb24gbWVzc2FnZSBvbmNlIGFsbCBzd2FybSB0ZWFtbWF0ZXMgZmluaXNoXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFoYXNSdW5uaW5nVGVhbW1hdGVzICYmIHN3YXJtU3RhcnRUaW1lUmVmLmN1cnJlbnQgIT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHRvdGFsTXMgPSBEYXRlLm5vdygpIC0gc3dhcm1TdGFydFRpbWVSZWYuY3VycmVudFxuICAgICAgY29uc3QgZGVmZXJyZWRCdWRnZXQgPSBzd2FybUJ1ZGdldEluZm9SZWYuY3VycmVudFxuICAgICAgc3dhcm1TdGFydFRpbWVSZWYuY3VycmVudCA9IG51bGxcbiAgICAgIHN3YXJtQnVkZ2V0SW5mb1JlZi5jdXJyZW50ID0gdW5kZWZpbmVkXG4gICAgICBzZXRNZXNzYWdlcyhwcmV2ID0+IFtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgY3JlYXRlVHVybkR1cmF0aW9uTWVzc2FnZShcbiAgICAgICAgICB0b3RhbE1zLFxuICAgICAgICAgIGRlZmVycmVkQnVkZ2V0LFxuICAgICAgICAgIC8vIENvdW50IG9ubHkgd2hhdCByZWNvcmRUcmFuc2NyaXB0IHdpbGwgcGVyc2lzdCDigJQgZXBoZW1lcmFsXG4gICAgICAgICAgLy8gcHJvZ3Jlc3MgdGlja3MgYW5kIG5vbi1hbnQgYXR0YWNobWVudHMgYXJlIGZpbHRlcmVkIGJ5XG4gICAgICAgICAgLy8gaXNMb2dnYWJsZU1lc3NhZ2UgYW5kIG5ldmVyIHJlYWNoIGRpc2suIFVzaW5nIHJhdyBwcmV2Lmxlbmd0aFxuICAgICAgICAgIC8vIHdvdWxkIG1ha2UgY2hlY2tSZXN1bWVDb25zaXN0ZW5jeSByZXBvcnQgZmFsc2UgZGVsdGE8MCBmb3JcbiAgICAgICAgICAvLyBldmVyeSB0dXJuIHRoYXQgcmFuIGEgcHJvZ3Jlc3MtZW1pdHRpbmcgdG9vbC5cbiAgICAgICAgICBjb3VudChwcmV2LCBpc0xvZ2dhYmxlTWVzc2FnZSksXG4gICAgICAgICksXG4gICAgICBdKVxuICAgIH1cbiAgfSwgW2hhc1J1bm5pbmdUZWFtbWF0ZXMsIHNldE1lc3NhZ2VzXSlcblxuICAvLyBTaG93IGF1dG8gcGVybWlzc2lvbnMgd2FybmluZyB3aGVuIGVudGVyaW5nIGF1dG8gbW9kZVxuICAvLyAoZWl0aGVyIHZpYSBTaGlmdCtUYWIgdG9nZ2xlIG9yIG9uIHN0YXJ0dXApLiBEZWJvdW5jZWQgdG8gYXZvaWRcbiAgLy8gZmxhc2hpbmcgd2hlbiB0aGUgdXNlciBpcyBjeWNsaW5nIHRocm91Z2ggbW9kZXMgcXVpY2tseS5cbiAgLy8gT25seSBzaG93biAzIHRpbWVzIHRvdGFsIGFjcm9zcyBzZXNzaW9ucy5cbiAgY29uc3Qgc2FmZVlvbG9NZXNzYWdlU2hvd25SZWYgPSB1c2VSZWYoZmFsc2UpXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpKSB7XG4gICAgICBpZiAodG9vbFBlcm1pc3Npb25Db250ZXh0Lm1vZGUgIT09ICdhdXRvJykge1xuICAgICAgICBzYWZlWW9sb01lc3NhZ2VTaG93blJlZi5jdXJyZW50ID0gZmFsc2VcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBpZiAoc2FmZVlvbG9NZXNzYWdlU2hvd25SZWYuY3VycmVudCkgcmV0dXJuXG4gICAgICBjb25zdCBjb25maWcgPSBnZXRHbG9iYWxDb25maWcoKVxuICAgICAgY29uc3QgY291bnQgPSBjb25maWcuYXV0b1Blcm1pc3Npb25zTm90aWZpY2F0aW9uQ291bnQgPz8gMFxuICAgICAgaWYgKGNvdW50ID49IDMpIHJldHVyblxuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgICAocmVmLCBzZXRNZXNzYWdlcykgPT4ge1xuICAgICAgICAgIHJlZi5jdXJyZW50ID0gdHJ1ZVxuICAgICAgICAgIHNhdmVHbG9iYWxDb25maWcocHJldiA9PiB7XG4gICAgICAgICAgICBjb25zdCBwcmV2Q291bnQgPSBwcmV2LmF1dG9QZXJtaXNzaW9uc05vdGlmaWNhdGlvbkNvdW50ID8/IDBcbiAgICAgICAgICAgIGlmIChwcmV2Q291bnQgPj0gMykgcmV0dXJuIHByZXZcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgIGF1dG9QZXJtaXNzaW9uc05vdGlmaWNhdGlvbkNvdW50OiBwcmV2Q291bnQgKyAxLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgICAgc2V0TWVzc2FnZXMocHJldiA9PiBbXG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgY3JlYXRlU3lzdGVtTWVzc2FnZShBVVRPX01PREVfREVTQ1JJUFRJT04sICd3YXJuaW5nJyksXG4gICAgICAgICAgXSlcbiAgICAgICAgfSxcbiAgICAgICAgODAwLFxuICAgICAgICBzYWZlWW9sb01lc3NhZ2VTaG93blJlZixcbiAgICAgICAgc2V0TWVzc2FnZXMsXG4gICAgICApXG4gICAgICByZXR1cm4gKCkgPT4gY2xlYXJUaW1lb3V0KHRpbWVyKVxuICAgIH1cbiAgfSwgW3Rvb2xQZXJtaXNzaW9uQ29udGV4dC5tb2RlLCBzZXRNZXNzYWdlc10pXG5cbiAgLy8gSWYgd29ya3RyZWUgY3JlYXRpb24gd2FzIHNsb3cgYW5kIHNwYXJzZS1jaGVja291dCBpc24ndCBjb25maWd1cmVkLFxuICAvLyBudWRnZSB0aGUgdXNlciB0b3dhcmQgc2V0dGluZ3Mud29ya3RyZWUuc3BhcnNlUGF0aHMuXG4gIGNvbnN0IHdvcmt0cmVlVGlwU2hvd25SZWYgPSB1c2VSZWYoZmFsc2UpXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHdvcmt0cmVlVGlwU2hvd25SZWYuY3VycmVudCkgcmV0dXJuXG4gICAgY29uc3Qgd3QgPSBnZXRDdXJyZW50V29ya3RyZWVTZXNzaW9uKClcbiAgICBpZiAoIXd0Py5jcmVhdGlvbkR1cmF0aW9uTXMgfHwgd3QudXNlZFNwYXJzZVBhdGhzKSByZXR1cm5cbiAgICBpZiAod3QuY3JlYXRpb25EdXJhdGlvbk1zIDwgMTVfMDAwKSByZXR1cm5cbiAgICB3b3JrdHJlZVRpcFNob3duUmVmLmN1cnJlbnQgPSB0cnVlXG4gICAgY29uc3Qgc2VjcyA9IE1hdGgucm91bmQod3QuY3JlYXRpb25EdXJhdGlvbk1zIC8gMTAwMClcbiAgICBzZXRNZXNzYWdlcyhwcmV2ID0+IFtcbiAgICAgIC4uLnByZXYsXG4gICAgICBjcmVhdGVTeXN0ZW1NZXNzYWdlKFxuICAgICAgICBgV29ya3RyZWUgY3JlYXRpb24gdG9vayAke3NlY3N9cy4gRm9yIGxhcmdlIHJlcG9zLCBzZXQgXFxgd29ya3RyZWUuc3BhcnNlUGF0aHNcXGAgaW4gLmNsYXVkZS9zZXR0aW5ncy5qc29uIHRvIGNoZWNrIG91dCBvbmx5IHRoZSBkaXJlY3RvcmllcyB5b3UgbmVlZCDigJQgZS5nLiBcXGB7XCJ3b3JrdHJlZVwiOiB7XCJzcGFyc2VQYXRoc1wiOiBbXCJzcmNcIiwgXCJwYWNrYWdlcy9mb29cIl19fVxcYC5gLFxuICAgICAgICAnaW5mbycsXG4gICAgICApLFxuICAgIF0pXG4gIH0sIFtzZXRNZXNzYWdlc10pXG5cbiAgLy8gSGlkZSBzcGlubmVyIHdoZW4gdGhlIG9ubHkgaW4tcHJvZ3Jlc3MgdG9vbCBpcyBTbGVlcFxuICBjb25zdCBvbmx5U2xlZXBUb29sQWN0aXZlID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgbGFzdEFzc2lzdGFudCA9IG1lc3NhZ2VzLmZpbmRMYXN0KG0gPT4gbS50eXBlID09PSAnYXNzaXN0YW50JylcbiAgICBpZiAobGFzdEFzc2lzdGFudD8udHlwZSAhPT0gJ2Fzc2lzdGFudCcpIHJldHVybiBmYWxzZVxuICAgIGNvbnN0IGluUHJvZ3Jlc3NUb29sVXNlcyA9IGxhc3RBc3Npc3RhbnQubWVzc2FnZS5jb250ZW50LmZpbHRlcihcbiAgICAgIGIgPT4gYi50eXBlID09PSAndG9vbF91c2UnICYmIGluUHJvZ3Jlc3NUb29sVXNlSURzLmhhcyhiLmlkKSxcbiAgICApXG4gICAgcmV0dXJuIChcbiAgICAgIGluUHJvZ3Jlc3NUb29sVXNlcy5sZW5ndGggPiAwICYmXG4gICAgICBpblByb2dyZXNzVG9vbFVzZXMuZXZlcnkoXG4gICAgICAgIGIgPT4gYi50eXBlID09PSAndG9vbF91c2UnICYmIGIubmFtZSA9PT0gU0xFRVBfVE9PTF9OQU1FLFxuICAgICAgKVxuICAgIClcbiAgfSwgW21lc3NhZ2VzLCBpblByb2dyZXNzVG9vbFVzZUlEc10pXG5cbiAgY29uc3Qge1xuICAgIG9uQmVmb3JlUXVlcnk6IG1yT25CZWZvcmVRdWVyeSxcbiAgICBvblR1cm5Db21wbGV0ZTogbXJPblR1cm5Db21wbGV0ZSxcbiAgICByZW5kZXI6IG1yUmVuZGVyLFxuICB9ID0gdXNlTW9yZVJpZ2h0KHtcbiAgICBlbmFibGVkOiBtb3JlUmlnaHRFbmFibGVkLFxuICAgIHNldE1lc3NhZ2VzLFxuICAgIGlucHV0VmFsdWUsXG4gICAgc2V0SW5wdXRWYWx1ZSxcbiAgICBzZXRUb29sSlNYLFxuICB9KVxuXG4gIGNvbnN0IHNob3dTcGlubmVyID1cbiAgICAoIXRvb2xKU1ggfHwgdG9vbEpTWC5zaG93U3Bpbm5lciA9PT0gdHJ1ZSkgJiZcbiAgICB0b29sVXNlQ29uZmlybVF1ZXVlLmxlbmd0aCA9PT0gMCAmJlxuICAgIHByb21wdFF1ZXVlLmxlbmd0aCA9PT0gMCAmJlxuICAgIC8vIFNob3cgc3Bpbm5lciBkdXJpbmcgaW5wdXQgcHJvY2Vzc2luZywgQVBJIGNhbGwsIHdoaWxlIHRlYW1tYXRlcyBhcmUgcnVubmluZyxcbiAgICAvLyBvciB3aGlsZSBwZW5kaW5nIHRhc2sgbm90aWZpY2F0aW9ucyBhcmUgcXVldWVkIChwcmV2ZW50cyBzcGlubmVyIGJvdW5jZSBiZXR3ZWVuIGNvbnNlY3V0aXZlIG5vdGlmaWNhdGlvbnMpXG4gICAgKGlzTG9hZGluZyB8fFxuICAgICAgdXNlcklucHV0T25Qcm9jZXNzaW5nIHx8XG4gICAgICBoYXNSdW5uaW5nVGVhbW1hdGVzIHx8XG4gICAgICAvLyBLZWVwIHNwaW5uZXIgdmlzaWJsZSB3aGlsZSB0YXNrIG5vdGlmaWNhdGlvbnMgYXJlIHF1ZXVlZCBmb3IgcHJvY2Vzc2luZy5cbiAgICAgIC8vIFdpdGhvdXQgdGhpcywgdGhlIHNwaW5uZXIgYnJpZWZseSBkaXNhcHBlYXJzIGJldHdlZW4gY29uc2VjdXRpdmUgbm90aWZpY2F0aW9uc1xuICAgICAgLy8gKGUuZy4sIG11bHRpcGxlIGJhY2tncm91bmQgYWdlbnRzIGNvbXBsZXRpbmcgaW4gcmFwaWQgc3VjY2Vzc2lvbikgYmVjYXVzZVxuICAgICAgLy8gaXNMb2FkaW5nIGdvZXMgZmFsc2UgbW9tZW50YXJpbHkgYmV0d2VlbiBwcm9jZXNzaW5nIGVhY2ggb25lLlxuICAgICAgZ2V0Q29tbWFuZFF1ZXVlTGVuZ3RoKCkgPiAwKSAmJlxuICAgIC8vIEhpZGUgc3Bpbm5lciB3aGVuIHdhaXRpbmcgZm9yIGxlYWRlciB0byBhcHByb3ZlIHBlcm1pc3Npb24gcmVxdWVzdFxuICAgICFwZW5kaW5nV29ya2VyUmVxdWVzdCAmJlxuICAgICFvbmx5U2xlZXBUb29sQWN0aXZlICYmXG4gICAgLy8gSGlkZSBzcGlubmVyIHdoZW4gc3RyZWFtaW5nIHRleHQgaXMgdmlzaWJsZSAodGhlIHRleHQgSVMgdGhlIGZlZWRiYWNrKSxcbiAgICAvLyBidXQga2VlcCBpdCB3aGVuIGlzQnJpZWZPbmx5IHN1cHByZXNzZXMgdGhlIHN0cmVhbWluZyB0ZXh0IGRpc3BsYXlcbiAgICAoIXZpc2libGVTdHJlYW1pbmdUZXh0IHx8IGlzQnJpZWZPbmx5KVxuXG4gIC8vIENoZWNrIGlmIGFueSBwZXJtaXNzaW9uIG9yIGFzayBxdWVzdGlvbiBwcm9tcHQgaXMgY3VycmVudGx5IHZpc2libGVcbiAgLy8gVGhpcyBpcyB1c2VkIHRvIHByZXZlbnQgdGhlIHN1cnZleSBmcm9tIG9wZW5pbmcgd2hpbGUgcHJvbXB0cyBhcmUgYWN0aXZlXG4gIGNvbnN0IGhhc0FjdGl2ZVByb21wdCA9XG4gICAgdG9vbFVzZUNvbmZpcm1RdWV1ZS5sZW5ndGggPiAwIHx8XG4gICAgcHJvbXB0UXVldWUubGVuZ3RoID4gMCB8fFxuICAgIHNhbmRib3hQZXJtaXNzaW9uUmVxdWVzdFF1ZXVlLmxlbmd0aCA+IDAgfHxcbiAgICBlbGljaXRhdGlvbi5xdWV1ZS5sZW5ndGggPiAwIHx8XG4gICAgd29ya2VyU2FuZGJveFBlcm1pc3Npb25zLnF1ZXVlLmxlbmd0aCA+IDBcblxuICBjb25zdCBmZWVkYmFja1N1cnZleU9yaWdpbmFsID0gdXNlRmVlZGJhY2tTdXJ2ZXkoXG4gICAgbWVzc2FnZXMsXG4gICAgaXNMb2FkaW5nLFxuICAgIHN1Ym1pdENvdW50LFxuICAgICdzZXNzaW9uJyxcbiAgICBoYXNBY3RpdmVQcm9tcHQsXG4gIClcblxuICBjb25zdCBza2lsbEltcHJvdmVtZW50U3VydmV5ID0gdXNlU2tpbGxJbXByb3ZlbWVudFN1cnZleShzZXRNZXNzYWdlcylcblxuICBjb25zdCBzaG93SXNzdWVGbGFnQmFubmVyID0gdXNlSXNzdWVGbGFnQmFubmVyKG1lc3NhZ2VzLCBzdWJtaXRDb3VudClcblxuICAvLyBXcmFwIGZlZWRiYWNrIHN1cnZleSBoYW5kbGVyIHRvIHRyaWdnZXIgYXV0by1ydW4gL2lzc3VlXG4gIGNvbnN0IGZlZWRiYWNrU3VydmV5ID0gdXNlTWVtbyhcbiAgICAoKSA9PiAoe1xuICAgICAgLi4uZmVlZGJhY2tTdXJ2ZXlPcmlnaW5hbCxcbiAgICAgIGhhbmRsZVNlbGVjdDogKHNlbGVjdGVkOiAnZGlzbWlzc2VkJyB8ICdiYWQnIHwgJ2ZpbmUnIHwgJ2dvb2QnKSA9PiB7XG4gICAgICAgIC8vIFJlc2V0IHRoZSByZWYgd2hlbiBhIG5ldyBzdXJ2ZXkgcmVzcG9uc2UgY29tZXMgaW5cbiAgICAgICAgZGlkQXV0b1J1bklzc3VlUmVmLmN1cnJlbnQgPSBmYWxzZVxuICAgICAgICBjb25zdCBzaG93ZWRUcmFuc2NyaXB0UHJvbXB0ID1cbiAgICAgICAgICBmZWVkYmFja1N1cnZleU9yaWdpbmFsLmhhbmRsZVNlbGVjdChzZWxlY3RlZClcbiAgICAgICAgLy8gQXV0by1ydW4gL2lzc3VlIGZvciBcImJhZFwiIGlmIHRyYW5zY3JpcHQgcHJvbXB0IHdhc24ndCBzaG93blxuICAgICAgICBpZiAoXG4gICAgICAgICAgc2VsZWN0ZWQgPT09ICdiYWQnICYmXG4gICAgICAgICAgIXNob3dlZFRyYW5zY3JpcHRQcm9tcHQgJiZcbiAgICAgICAgICBzaG91bGRBdXRvUnVuSXNzdWUoJ2ZlZWRiYWNrX3N1cnZleV9iYWQnKVxuICAgICAgICApIHtcbiAgICAgICAgICBzZXRBdXRvUnVuSXNzdWVSZWFzb24oJ2ZlZWRiYWNrX3N1cnZleV9iYWQnKVxuICAgICAgICAgIGRpZEF1dG9SdW5Jc3N1ZVJlZi5jdXJyZW50ID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0pLFxuICAgIFtmZWVkYmFja1N1cnZleU9yaWdpbmFsXSxcbiAgKVxuXG4gIC8vIFBvc3QtY29tcGFjdCBzdXJ2ZXk6IHNob3duIGFmdGVyIGNvbXBhY3Rpb24gaWYgZmVhdHVyZSBnYXRlIGlzIGVuYWJsZWRcbiAgY29uc3QgcG9zdENvbXBhY3RTdXJ2ZXkgPSB1c2VQb3N0Q29tcGFjdFN1cnZleShcbiAgICBtZXNzYWdlcyxcbiAgICBpc0xvYWRpbmcsXG4gICAgaGFzQWN0aXZlUHJvbXB0LFxuICAgIHsgZW5hYmxlZDogIWlzUmVtb3RlU2Vzc2lvbiB9LFxuICApXG5cbiAgLy8gTWVtb3J5IHN1cnZleTogc2hvd24gd2hlbiB0aGUgYXNzaXN0YW50IG1lbnRpb25zIG1lbW9yeSBhbmQgYSBtZW1vcnkgZmlsZVxuICAvLyB3YXMgcmVhZCB0aGlzIGNvbnZlcnNhdGlvblxuICBjb25zdCBtZW1vcnlTdXJ2ZXkgPSB1c2VNZW1vcnlTdXJ2ZXkobWVzc2FnZXMsIGlzTG9hZGluZywgaGFzQWN0aXZlUHJvbXB0LCB7XG4gICAgZW5hYmxlZDogIWlzUmVtb3RlU2Vzc2lvbixcbiAgfSlcblxuICAvLyBGcnVzdHJhdGlvbiBkZXRlY3Rpb246IHNob3cgdHJhbnNjcmlwdCBzaGFyaW5nIHByb21wdCBhZnRlciBkZXRlY3RpbmcgZnJ1c3RyYXRlZCBtZXNzYWdlc1xuICBjb25zdCBmcnVzdHJhdGlvbkRldGVjdGlvbiA9IHVzZUZydXN0cmF0aW9uRGV0ZWN0aW9uKFxuICAgIG1lc3NhZ2VzLFxuICAgIGlzTG9hZGluZyxcbiAgICBoYXNBY3RpdmVQcm9tcHQsXG4gICAgZmVlZGJhY2tTdXJ2ZXkuc3RhdGUgIT09ICdjbG9zZWQnIHx8XG4gICAgICBwb3N0Q29tcGFjdFN1cnZleS5zdGF0ZSAhPT0gJ2Nsb3NlZCcgfHxcbiAgICAgIG1lbW9yeVN1cnZleS5zdGF0ZSAhPT0gJ2Nsb3NlZCcsXG4gIClcblxuICAvLyBJbml0aWFsaXplIElERSBpbnRlZ3JhdGlvblxuICB1c2VJREVJbnRlZ3JhdGlvbih7XG4gICAgYXV0b0Nvbm5lY3RJZGVGbGFnLFxuICAgIGlkZVRvSW5zdGFsbEV4dGVuc2lvbixcbiAgICBzZXREeW5hbWljTWNwQ29uZmlnLFxuICAgIHNldFNob3dJZGVPbmJvYXJkaW5nLFxuICAgIHNldElERUluc3RhbGxhdGlvblN0YXRlOiBzZXRJREVJbnN0YWxsYXRpb25TdGF0dXMsXG4gIH0pXG5cbiAgdXNlRmlsZUhpc3RvcnlTbmFwc2hvdEluaXQoXG4gICAgaW5pdGlhbEZpbGVIaXN0b3J5U25hcHNob3RzLFxuICAgIGZpbGVIaXN0b3J5LFxuICAgIGZpbGVIaXN0b3J5U3RhdGUgPT5cbiAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgZmlsZUhpc3Rvcnk6IGZpbGVIaXN0b3J5U3RhdGUsXG4gICAgICB9KSksXG4gIClcblxuICBjb25zdCByZXN1bWUgPSB1c2VDYWxsYmFjayhcbiAgICBhc3luYyAoc2Vzc2lvbklkOiBVVUlELCBsb2c6IExvZ09wdGlvbiwgZW50cnlwb2ludDogUmVzdW1lRW50cnlwb2ludCkgPT4ge1xuICAgICAgY29uc3QgcmVzdW1lU3RhcnQgPSBwZXJmb3JtYW5jZS5ub3coKVxuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gRGVzZXJpYWxpemUgbWVzc2FnZXMgdG8gcHJvcGVybHkgY2xlYW4gdXAgdGhlIGNvbnZlcnNhdGlvblxuICAgICAgICAvLyBUaGlzIGZpbHRlcnMgdW5yZXNvbHZlZCB0b29sIHVzZXMgYW5kIGFkZHMgYSBzeW50aGV0aWMgYXNzaXN0YW50IG1lc3NhZ2UgaWYgbmVlZGVkXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VzID0gZGVzZXJpYWxpemVNZXNzYWdlcyhsb2cubWVzc2FnZXMpXG5cbiAgICAgICAgLy8gTWF0Y2ggY29vcmRpbmF0b3Ivbm9ybWFsIG1vZGUgdG8gdGhlIHJlc3VtZWQgc2Vzc2lvblxuICAgICAgICBpZiAoZmVhdHVyZSgnQ09PUkRJTkFUT1JfTU9ERScpKSB7XG4gICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICAgIGNvbnN0IGNvb3JkaW5hdG9yTW9kdWxlID1cbiAgICAgICAgICAgIHJlcXVpcmUoJy4uL2Nvb3JkaW5hdG9yL2Nvb3JkaW5hdG9yTW9kZS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4uL2Nvb3JkaW5hdG9yL2Nvb3JkaW5hdG9yTW9kZS5qcycpXG4gICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgICAgICAgY29uc3Qgd2FybmluZyA9IGNvb3JkaW5hdG9yTW9kdWxlLm1hdGNoU2Vzc2lvbk1vZGUobG9nLm1vZGUpXG4gICAgICAgICAgaWYgKHdhcm5pbmcpIHtcbiAgICAgICAgICAgIC8vIFJlLWRlcml2ZSBhZ2VudCBkZWZpbml0aW9ucyBhZnRlciBtb2RlIHN3aXRjaCBzbyBidWlsdC1pbiBhZ2VudHNcbiAgICAgICAgICAgIC8vIHJlZmxlY3QgdGhlIG5ldyBjb29yZGluYXRvci9ub3JtYWwgbW9kZVxuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgICBnZXRBZ2VudERlZmluaXRpb25zV2l0aE92ZXJyaWRlcyxcbiAgICAgICAgICAgICAgZ2V0QWN0aXZlQWdlbnRzRnJvbUxpc3QsXG4gICAgICAgICAgICB9ID1cbiAgICAgICAgICAgICAgcmVxdWlyZSgnLi4vdG9vbHMvQWdlbnRUb29sL2xvYWRBZ2VudHNEaXIuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuLi90b29scy9BZ2VudFRvb2wvbG9hZEFnZW50c0Rpci5qcycpXG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgICAgIGdldEFnZW50RGVmaW5pdGlvbnNXaXRoT3ZlcnJpZGVzLmNhY2hlLmNsZWFyPy4oKVxuICAgICAgICAgICAgY29uc3QgZnJlc2hBZ2VudERlZnMgPSBhd2FpdCBnZXRBZ2VudERlZmluaXRpb25zV2l0aE92ZXJyaWRlcyhcbiAgICAgICAgICAgICAgZ2V0T3JpZ2luYWxDd2QoKSxcbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICBhZ2VudERlZmluaXRpb25zOiB7XG4gICAgICAgICAgICAgICAgLi4uZnJlc2hBZ2VudERlZnMsXG4gICAgICAgICAgICAgICAgYWxsQWdlbnRzOiBmcmVzaEFnZW50RGVmcy5hbGxBZ2VudHMsXG4gICAgICAgICAgICAgICAgYWN0aXZlQWdlbnRzOiBnZXRBY3RpdmVBZ2VudHNGcm9tTGlzdChmcmVzaEFnZW50RGVmcy5hbGxBZ2VudHMpLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICBtZXNzYWdlcy5wdXNoKGNyZWF0ZVN5c3RlbU1lc3NhZ2Uod2FybmluZywgJ3dhcm5pbmcnKSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaXJlIFNlc3Npb25FbmQgaG9va3MgZm9yIHRoZSBjdXJyZW50IHNlc3Npb24gYmVmb3JlIHN0YXJ0aW5nIHRoZVxuICAgICAgICAvLyByZXN1bWVkIG9uZSwgbWlycm9yaW5nIHRoZSAvY2xlYXIgZmxvdyBpbiBjb252ZXJzYXRpb24udHMuXG4gICAgICAgIGNvbnN0IHNlc3Npb25FbmRUaW1lb3V0TXMgPSBnZXRTZXNzaW9uRW5kSG9va1RpbWVvdXRNcygpXG4gICAgICAgIGF3YWl0IGV4ZWN1dGVTZXNzaW9uRW5kSG9va3MoJ3Jlc3VtZScsIHtcbiAgICAgICAgICBnZXRBcHBTdGF0ZTogKCkgPT4gc3RvcmUuZ2V0U3RhdGUoKSxcbiAgICAgICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgICAgICBzaWduYWw6IEFib3J0U2lnbmFsLnRpbWVvdXQoc2Vzc2lvbkVuZFRpbWVvdXRNcyksXG4gICAgICAgICAgdGltZW91dE1zOiBzZXNzaW9uRW5kVGltZW91dE1zLFxuICAgICAgICB9KVxuXG4gICAgICAgIC8vIFByb2Nlc3Mgc2Vzc2lvbiBzdGFydCBob29rcyBmb3IgcmVzdW1lXG4gICAgICAgIGNvbnN0IGhvb2tNZXNzYWdlcyA9IGF3YWl0IHByb2Nlc3NTZXNzaW9uU3RhcnRIb29rcygncmVzdW1lJywge1xuICAgICAgICAgIHNlc3Npb25JZCxcbiAgICAgICAgICBhZ2VudFR5cGU6IG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24/LmFnZW50VHlwZSxcbiAgICAgICAgICBtb2RlbDogbWFpbkxvb3BNb2RlbCxcbiAgICAgICAgfSlcblxuICAgICAgICAvLyBBcHBlbmQgaG9vayBtZXNzYWdlcyB0byB0aGUgY29udmVyc2F0aW9uXG4gICAgICAgIG1lc3NhZ2VzLnB1c2goLi4uaG9va01lc3NhZ2VzKVxuICAgICAgICAvLyBGb3IgZm9ya3MsIGdlbmVyYXRlIGEgbmV3IHBsYW4gc2x1ZyBhbmQgY29weSB0aGUgcGxhbiBjb250ZW50IHNvIHRoZVxuICAgICAgICAvLyBvcmlnaW5hbCBhbmQgZm9ya2VkIHNlc3Npb25zIGRvbid0IGNsb2JiZXIgZWFjaCBvdGhlcidzIHBsYW4gZmlsZXMuXG4gICAgICAgIC8vIEZvciByZWd1bGFyIHJlc3VtZXMsIHJldXNlIHRoZSBvcmlnaW5hbCBzZXNzaW9uJ3MgcGxhbiBzbHVnLlxuICAgICAgICBpZiAoZW50cnlwb2ludCA9PT0gJ2ZvcmsnKSB7XG4gICAgICAgICAgdm9pZCBjb3B5UGxhbkZvckZvcmsobG9nLCBhc1Nlc3Npb25JZChzZXNzaW9uSWQpKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZvaWQgY29weVBsYW5Gb3JSZXN1bWUobG9nLCBhc1Nlc3Npb25JZChzZXNzaW9uSWQpKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzdG9yZSBmaWxlIGhpc3RvcnkgYW5kIGF0dHJpYnV0aW9uIHN0YXRlIGZyb20gdGhlIHJlc3VtZWQgY29udmVyc2F0aW9uXG4gICAgICAgIHJlc3RvcmVTZXNzaW9uU3RhdGVGcm9tTG9nKGxvZywgc2V0QXBwU3RhdGUpXG4gICAgICAgIGlmIChsb2cuZmlsZUhpc3RvcnlTbmFwc2hvdHMpIHtcbiAgICAgICAgICB2b2lkIGNvcHlGaWxlSGlzdG9yeUZvclJlc3VtZShsb2cpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXN0b3JlIGFnZW50IHNldHRpbmcgZnJvbSB0aGUgcmVzdW1lZCBjb252ZXJzYXRpb25cbiAgICAgICAgLy8gQWx3YXlzIHJlc2V0IHRvIHRoZSBuZXcgc2Vzc2lvbidzIHZhbHVlcyAob3IgY2xlYXIgaWYgbm9uZSksXG4gICAgICAgIC8vIG1hdGNoaW5nIHRoZSBzdGFuZGFsb25lQWdlbnRDb250ZXh0IHBhdHRlcm4gYmVsb3dcbiAgICAgICAgY29uc3QgeyBhZ2VudERlZmluaXRpb246IHJlc3RvcmVkQWdlbnQgfSA9IHJlc3RvcmVBZ2VudEZyb21TZXNzaW9uKFxuICAgICAgICAgIGxvZy5hZ2VudFNldHRpbmcsXG4gICAgICAgICAgaW5pdGlhbE1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gICAgICAgICAgYWdlbnREZWZpbml0aW9ucyxcbiAgICAgICAgKVxuICAgICAgICBzZXRNYWluVGhyZWFkQWdlbnREZWZpbml0aW9uKHJlc3RvcmVkQWdlbnQpXG4gICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHsgLi4ucHJldiwgYWdlbnQ6IHJlc3RvcmVkQWdlbnQ/LmFnZW50VHlwZSB9KSlcblxuICAgICAgICAvLyBSZXN0b3JlIHN0YW5kYWxvbmUgYWdlbnQgY29udGV4dCBmcm9tIHRoZSByZXN1bWVkIGNvbnZlcnNhdGlvblxuICAgICAgICAvLyBBbHdheXMgcmVzZXQgdG8gdGhlIG5ldyBzZXNzaW9uJ3MgdmFsdWVzIChvciBjbGVhciBpZiBub25lKVxuICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICBzdGFuZGFsb25lQWdlbnRDb250ZXh0OiBjb21wdXRlU3RhbmRhbG9uZUFnZW50Q29udGV4dChcbiAgICAgICAgICAgIGxvZy5hZ2VudE5hbWUsXG4gICAgICAgICAgICBsb2cuYWdlbnRDb2xvcixcbiAgICAgICAgICApLFxuICAgICAgICB9KSlcbiAgICAgICAgdm9pZCB1cGRhdGVTZXNzaW9uTmFtZShsb2cuYWdlbnROYW1lKVxuXG4gICAgICAgIC8vIFJlc3RvcmUgcmVhZCBmaWxlIHN0YXRlIGZyb20gdGhlIG1lc3NhZ2UgaGlzdG9yeVxuICAgICAgICByZXN0b3JlUmVhZEZpbGVTdGF0ZShtZXNzYWdlcywgbG9nLnByb2plY3RQYXRoID8/IGdldE9yaWdpbmFsQ3dkKCkpXG5cbiAgICAgICAgLy8gQ2xlYXIgYW55IGFjdGl2ZSBsb2FkaW5nIHN0YXRlIChubyBxdWVyeUlkIHNpbmNlIHdlJ3JlIG5vdCBpbiBhIHF1ZXJ5KVxuICAgICAgICByZXNldExvYWRpbmdTdGF0ZSgpXG4gICAgICAgIHNldEFib3J0Q29udHJvbGxlcihudWxsKVxuXG4gICAgICAgIHNldENvbnZlcnNhdGlvbklkKHNlc3Npb25JZClcblxuICAgICAgICAvLyBHZXQgdGFyZ2V0IHNlc3Npb24ncyBjb3N0cyBCRUZPUkUgc2F2aW5nIGN1cnJlbnQgc2Vzc2lvblxuICAgICAgICAvLyAoc2F2ZUN1cnJlbnRTZXNzaW9uQ29zdHMgb3ZlcndyaXRlcyB0aGUgY29uZmlnLCBzbyB3ZSBuZWVkIHRvIHJlYWQgZmlyc3QpXG4gICAgICAgIGNvbnN0IHRhcmdldFNlc3Npb25Db3N0cyA9IGdldFN0b3JlZFNlc3Npb25Db3N0cyhzZXNzaW9uSWQpXG5cbiAgICAgICAgLy8gU2F2ZSBjdXJyZW50IHNlc3Npb24ncyBjb3N0cyBiZWZvcmUgc3dpdGNoaW5nIHRvIGF2b2lkIGxvc2luZyBhY2N1bXVsYXRlZCBjb3N0c1xuICAgICAgICBzYXZlQ3VycmVudFNlc3Npb25Db3N0cygpXG5cbiAgICAgICAgLy8gUmVzZXQgY29zdCBzdGF0ZSBmb3IgY2xlYW4gc2xhdGUgYmVmb3JlIHJlc3RvcmluZyB0YXJnZXQgc2Vzc2lvblxuICAgICAgICByZXNldENvc3RTdGF0ZSgpXG5cbiAgICAgICAgLy8gU3dpdGNoIHNlc3Npb24gKGlkICsgcHJvamVjdCBkaXIgYXRvbWljYWxseSkuIGZ1bGxQYXRoIG1heSBwb2ludCB0b1xuICAgICAgICAvLyBhIGRpZmZlcmVudCBwcm9qZWN0IChjcm9zcy13b3JrdHJlZSwgL2JyYW5jaCk7IG51bGwgZGVyaXZlcyBmcm9tXG4gICAgICAgIC8vIGN1cnJlbnQgb3JpZ2luYWxDd2QuXG4gICAgICAgIHN3aXRjaFNlc3Npb24oXG4gICAgICAgICAgYXNTZXNzaW9uSWQoc2Vzc2lvbklkKSxcbiAgICAgICAgICBsb2cuZnVsbFBhdGggPyBkaXJuYW1lKGxvZy5mdWxsUGF0aCkgOiBudWxsLFxuICAgICAgICApXG4gICAgICAgIC8vIFJlbmFtZSBhc2NpaWNhc3QgcmVjb3JkaW5nIHRvIG1hdGNoIHRoZSByZXN1bWVkIHNlc3Npb24gSURcbiAgICAgICAgY29uc3QgeyByZW5hbWVSZWNvcmRpbmdGb3JTZXNzaW9uIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICAgJy4uL3V0aWxzL2FzY2lpY2FzdC5qcydcbiAgICAgICAgKVxuICAgICAgICBhd2FpdCByZW5hbWVSZWNvcmRpbmdGb3JTZXNzaW9uKClcbiAgICAgICAgYXdhaXQgcmVzZXRTZXNzaW9uRmlsZVBvaW50ZXIoKVxuXG4gICAgICAgIC8vIENsZWFyIHRoZW4gcmVzdG9yZSBzZXNzaW9uIG1ldGFkYXRhIHNvIGl0J3MgcmUtYXBwZW5kZWQgb24gZXhpdCB2aWFcbiAgICAgICAgLy8gcmVBcHBlbmRTZXNzaW9uTWV0YWRhdGEuIGNsZWFyU2Vzc2lvbk1ldGFkYXRhIG11c3QgYmUgY2FsbGVkIGZpcnN0OlxuICAgICAgICAvLyByZXN0b3JlU2Vzc2lvbk1ldGFkYXRhIG9ubHkgc2V0cy1pZi10cnV0aHksIHNvIHdpdGhvdXQgdGhlIGNsZWFyLFxuICAgICAgICAvLyBhIHNlc3Npb24gd2l0aG91dCBhbiBhZ2VudCBuYW1lIHdvdWxkIGluaGVyaXQgdGhlIHByZXZpb3VzIHNlc3Npb24nc1xuICAgICAgICAvLyBjYWNoZWQgbmFtZSBhbmQgd3JpdGUgaXQgdG8gdGhlIHdyb25nIHRyYW5zY3JpcHQgb24gZmlyc3QgbWVzc2FnZS5cbiAgICAgICAgY2xlYXJTZXNzaW9uTWV0YWRhdGEoKVxuICAgICAgICByZXN0b3JlU2Vzc2lvbk1ldGFkYXRhKGxvZylcbiAgICAgICAgLy8gUmVzdW1lZCBzZXNzaW9ucyBzaG91bGRuJ3QgcmUtdGl0bGUgZnJvbSBtaWQtY29udmVyc2F0aW9uIGNvbnRleHRcbiAgICAgICAgLy8gKHNhbWUgcmVhc29uaW5nIGFzIHRoZSB1c2VSZWYgc2VlZCksIGFuZCB0aGUgcHJldmlvdXMgc2Vzc2lvbidzXG4gICAgICAgIC8vIEhhaWt1IHRpdGxlIHNob3VsZG4ndCBjYXJyeSBvdmVyLlxuICAgICAgICBoYWlrdVRpdGxlQXR0ZW1wdGVkUmVmLmN1cnJlbnQgPSB0cnVlXG4gICAgICAgIHNldEhhaWt1VGl0bGUodW5kZWZpbmVkKVxuXG4gICAgICAgIC8vIEV4aXQgYW55IHdvcmt0cmVlIGEgcHJpb3IgL3Jlc3VtZSBlbnRlcmVkLCB0aGVuIGNkIGludG8gdGhlIG9uZVxuICAgICAgICAvLyB0aGlzIHNlc3Npb24gd2FzIGluLiBXaXRob3V0IHRoZSBleGl0LCByZXN1bWluZyBmcm9tIHdvcmt0cmVlIEJcbiAgICAgICAgLy8gdG8gbm9uLXdvcmt0cmVlIEMgbGVhdmVzIGN3ZC9jdXJyZW50V29ya3RyZWVTZXNzaW9uIHN0YWxlO1xuICAgICAgICAvLyByZXN1bWluZyBC4oaSQyB3aGVyZSBDIGlzIGFsc28gYSB3b3JrdHJlZSBmYWlscyBlbnRpcmVseVxuICAgICAgICAvLyAoZ2V0Q3VycmVudFdvcmt0cmVlU2Vzc2lvbiBndWFyZCBibG9ja3MgdGhlIHN3aXRjaCkuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFNraXBwZWQgZm9yIC9icmFuY2g6IGZvcmtMb2cgZG9lc24ndCBjYXJyeSB3b3JrdHJlZVNlc3Npb24sIHNvXG4gICAgICAgIC8vIHRoaXMgd291bGQga2ljayB0aGUgdXNlciBvdXQgb2YgYSB3b3JrdHJlZSB0aGV5J3JlIHN0aWxsIHdvcmtpbmdcbiAgICAgICAgLy8gaW4uIFNhbWUgZm9yayBza2lwIGFzIHByb2Nlc3NSZXN1bWVkQ29udmVyc2F0aW9uIGZvciB0aGUgYWRvcHQg4oCUXG4gICAgICAgIC8vIGZvcmsgbWF0ZXJpYWxpemVzIGl0cyBvd24gZmlsZSB2aWEgcmVjb3JkVHJhbnNjcmlwdCBvbiBSRVBMIG1vdW50LlxuICAgICAgICBpZiAoZW50cnlwb2ludCAhPT0gJ2ZvcmsnKSB7XG4gICAgICAgICAgZXhpdFJlc3RvcmVkV29ya3RyZWUoKVxuICAgICAgICAgIHJlc3RvcmVXb3JrdHJlZUZvclJlc3VtZShsb2cud29ya3RyZWVTZXNzaW9uKVxuICAgICAgICAgIGFkb3B0UmVzdW1lZFNlc3Npb25GaWxlKClcbiAgICAgICAgICB2b2lkIHJlc3RvcmVSZW1vdGVBZ2VudFRhc2tzKHtcbiAgICAgICAgICAgIGFib3J0Q29udHJvbGxlcjogbmV3IEFib3J0Q29udHJvbGxlcigpLFxuICAgICAgICAgICAgZ2V0QXBwU3RhdGU6ICgpID0+IHN0b3JlLmdldFN0YXRlKCksXG4gICAgICAgICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZvcms6IHNhbWUgcmUtcGVyc2lzdCBhcyAvY2xlYXIgKGNvbnZlcnNhdGlvbi50cykuIFRoZSBjbGVhclxuICAgICAgICAgIC8vIGFib3ZlIHdpcGVkIGN1cnJlbnRTZXNzaW9uV29ya3RyZWUsIGZvcmtMb2cgZG9lc24ndCBjYXJyeSBpdCxcbiAgICAgICAgICAvLyBhbmQgdGhlIHByb2Nlc3MgaXMgc3RpbGwgaW4gdGhlIHNhbWUgd29ya3RyZWUuXG4gICAgICAgICAgY29uc3Qgd3MgPSBnZXRDdXJyZW50V29ya3RyZWVTZXNzaW9uKClcbiAgICAgICAgICBpZiAod3MpIHNhdmVXb3JrdHJlZVN0YXRlKHdzKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUGVyc2lzdCB0aGUgY3VycmVudCBtb2RlIHNvIGZ1dHVyZSByZXN1bWVzIGtub3cgd2hhdCBtb2RlIHRoaXMgc2Vzc2lvbiB3YXMgaW5cbiAgICAgICAgaWYgKGZlYXR1cmUoJ0NPT1JESU5BVE9SX01PREUnKSkge1xuICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgICBjb25zdCB7IHNhdmVNb2RlIH0gPSByZXF1aXJlKCcuLi91dGlscy9zZXNzaW9uU3RvcmFnZS5qcycpXG4gICAgICAgICAgY29uc3QgeyBpc0Nvb3JkaW5hdG9yTW9kZSB9ID1cbiAgICAgICAgICAgIHJlcXVpcmUoJy4uL2Nvb3JkaW5hdG9yL2Nvb3JkaW5hdG9yTW9kZS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4uL2Nvb3JkaW5hdG9yL2Nvb3JkaW5hdG9yTW9kZS5qcycpXG4gICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgICAgICAgc2F2ZU1vZGUoaXNDb29yZGluYXRvck1vZGUoKSA/ICdjb29yZGluYXRvcicgOiAnbm9ybWFsJylcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc3RvcmUgdGFyZ2V0IHNlc3Npb24ncyBjb3N0cyBmcm9tIHRoZSBkYXRhIHdlIHJlYWQgZWFybGllclxuICAgICAgICBpZiAodGFyZ2V0U2Vzc2lvbkNvc3RzKSB7XG4gICAgICAgICAgc2V0Q29zdFN0YXRlRm9yUmVzdG9yZSh0YXJnZXRTZXNzaW9uQ29zdHMpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNvbnN0cnVjdCByZXBsYWNlbWVudCBzdGF0ZSBmb3IgdGhlIHJlc3VtZWQgc2Vzc2lvbi4gUnVucyBhZnRlclxuICAgICAgICAvLyBzZXRTZXNzaW9uSWQgc28gYW55IE5FVyByZXBsYWNlbWVudHMgcG9zdC1yZXN1bWUgd3JpdGUgdG8gdGhlXG4gICAgICAgIC8vIHJlc3VtZWQgc2Vzc2lvbidzIHRvb2wtcmVzdWx0cyBkaXIuIEdhdGVkIG9uIHJlZi5jdXJyZW50OiB0aGVcbiAgICAgICAgLy8gaW5pdGlhbCBtb3VudCBhbHJlYWR5IHJlYWQgdGhlIGZlYXR1cmUgZmxhZywgc28gd2UgZG9uJ3QgcmUtcmVhZFxuICAgICAgICAvLyBpdCBoZXJlIChtaWQtc2Vzc2lvbiBmbGFnIGZsaXBzIHN0YXkgdW5vYnNlcnZhYmxlIGluIGJvdGhcbiAgICAgICAgLy8gZGlyZWN0aW9ucykuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFNraXBwZWQgZm9yIGluLXNlc3Npb24gL2JyYW5jaDogdGhlIGV4aXN0aW5nIHJlZiBpcyBhbHJlYWR5IGNvcnJlY3RcbiAgICAgICAgLy8gKGJyYW5jaCBwcmVzZXJ2ZXMgdG9vbF91c2VfaWRzKSwgc28gdGhlcmUncyBubyBuZWVkIHRvIHJlY29uc3RydWN0LlxuICAgICAgICAvLyBjcmVhdGVGb3JrKCkgZG9lcyB3cml0ZSBjb250ZW50LXJlcGxhY2VtZW50IGVudHJpZXMgdG8gdGhlIGZvcmtlZFxuICAgICAgICAvLyBKU09OTCB3aXRoIHRoZSBmb3JrJ3Mgc2Vzc2lvbklkLCBzbyBgY2xhdWRlIC1yIHtmb3JrSWR9YCBhbHNvIHdvcmtzLlxuICAgICAgICBpZiAoY29udGVudFJlcGxhY2VtZW50U3RhdGVSZWYuY3VycmVudCAmJiBlbnRyeXBvaW50ICE9PSAnZm9yaycpIHtcbiAgICAgICAgICBjb250ZW50UmVwbGFjZW1lbnRTdGF0ZVJlZi5jdXJyZW50ID1cbiAgICAgICAgICAgIHJlY29uc3RydWN0Q29udGVudFJlcGxhY2VtZW50U3RhdGUoXG4gICAgICAgICAgICAgIG1lc3NhZ2VzLFxuICAgICAgICAgICAgICBsb2cuY29udGVudFJlcGxhY2VtZW50cyA/PyBbXSxcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc2V0IG1lc3NhZ2VzIHRvIHRoZSBwcm92aWRlZCBpbml0aWFsIG1lc3NhZ2VzXG4gICAgICAgIC8vIFVzZSBhIGNhbGxiYWNrIHRvIGVuc3VyZSB3ZSdyZSBub3QgZGVwZW5kZW50IG9uIHN0YWxlIHN0YXRlXG4gICAgICAgIHNldE1lc3NhZ2VzKCgpID0+IG1lc3NhZ2VzKVxuXG4gICAgICAgIC8vIENsZWFyIGFueSBhY3RpdmUgdG9vbCBKU1hcbiAgICAgICAgc2V0VG9vbEpTWChudWxsKVxuXG4gICAgICAgIC8vIENsZWFyIGlucHV0IHRvIGVuc3VyZSBubyByZXNpZHVhbCBzdGF0ZVxuICAgICAgICBzZXRJbnB1dFZhbHVlKCcnKVxuXG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX3Jlc3VtZWQnLCB7XG4gICAgICAgICAgZW50cnlwb2ludDpcbiAgICAgICAgICAgIGVudHJ5cG9pbnQgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgIHJlc3VtZV9kdXJhdGlvbl9tczogTWF0aC5yb3VuZChwZXJmb3JtYW5jZS5ub3coKSAtIHJlc3VtZVN0YXJ0KSxcbiAgICAgICAgfSlcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zZXNzaW9uX3Jlc3VtZWQnLCB7XG4gICAgICAgICAgZW50cnlwb2ludDpcbiAgICAgICAgICAgIGVudHJ5cG9pbnQgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgfSlcbiAgICAgICAgdGhyb3cgZXJyb3JcbiAgICAgIH1cbiAgICB9LFxuICAgIFtyZXNldExvYWRpbmdTdGF0ZSwgc2V0QXBwU3RhdGVdLFxuICApXG5cbiAgLy8gTGF6eSBpbml0OiB1c2VSZWYoY3JlYXRlWCgpKSB3b3VsZCBjYWxsIGNyZWF0ZVggb24gZXZlcnkgcmVuZGVyIGFuZFxuICAvLyBkaXNjYXJkIHRoZSByZXN1bHQuIExSVUNhY2hlIGNvbnN0cnVjdGlvbiBpbnNpZGUgRmlsZVN0YXRlQ2FjaGUgaXNcbiAgLy8gZXhwZW5zaXZlICh+MTcwbXMpLCBzbyB3ZSB1c2UgdXNlU3RhdGUncyBsYXp5IGluaXRpYWxpemVyIHRvIGNyZWF0ZVxuICAvLyBpdCBleGFjdGx5IG9uY2UsIHRoZW4gZmVlZCB0aGF0IHN0YWJsZSByZWZlcmVuY2UgaW50byB1c2VSZWYuXG4gIGNvbnN0IFtpbml0aWFsUmVhZEZpbGVTdGF0ZV0gPSB1c2VTdGF0ZSgoKSA9PlxuICAgIGNyZWF0ZUZpbGVTdGF0ZUNhY2hlV2l0aFNpemVMaW1pdChSRUFEX0ZJTEVfU1RBVEVfQ0FDSEVfU0laRSksXG4gIClcbiAgY29uc3QgcmVhZEZpbGVTdGF0ZSA9IHVzZVJlZihpbml0aWFsUmVhZEZpbGVTdGF0ZSlcbiAgY29uc3QgYmFzaFRvb2xzID0gdXNlUmVmKG5ldyBTZXQ8c3RyaW5nPigpKVxuICBjb25zdCBiYXNoVG9vbHNQcm9jZXNzZWRJZHggPSB1c2VSZWYoMClcbiAgLy8gU2Vzc2lvbi1zY29wZWQgc2tpbGwgZGlzY292ZXJ5IHRyYWNraW5nIChmZWVkcyB3YXNfZGlzY292ZXJlZCBvblxuICAvLyB0ZW5ndV9za2lsbF90b29sX2ludm9jYXRpb24pLiBNdXN0IHBlcnNpc3QgYWNyb3NzIGdldFRvb2xVc2VDb250ZXh0XG4gIC8vIHJlYnVpbGRzIHdpdGhpbiBhIHNlc3Npb246IHR1cm4tMCBkaXNjb3Zlcnkgd3JpdGVzIHZpYSBwcm9jZXNzVXNlcklucHV0XG4gIC8vIGJlZm9yZSBvblF1ZXJ5IGJ1aWxkcyBpdHMgb3duIGNvbnRleHQsIGFuZCBkaXNjb3Zlcnkgb24gdHVybiBOIG11c3RcbiAgLy8gc3RpbGwgYXR0cmlidXRlIGEgU2tpbGxUb29sIGNhbGwgb24gdHVybiBOK2suIENsZWFyZWQgaW4gY2xlYXJDb252ZXJzYXRpb24uXG4gIGNvbnN0IGRpc2NvdmVyZWRTa2lsbE5hbWVzUmVmID0gdXNlUmVmKG5ldyBTZXQ8c3RyaW5nPigpKVxuICAvLyBTZXNzaW9uLWxldmVsIGRlZHVwIGZvciBuZXN0ZWRfbWVtb3J5IENMQVVERS5tZCBhdHRhY2htZW50cy5cbiAgLy8gcmVhZEZpbGVTdGF0ZSBpcyBhIDEwMC1lbnRyeSBMUlU7IG9uY2UgaXQgZXZpY3RzIGEgQ0xBVURFLm1kIHBhdGgsXG4gIC8vIHRoZSBuZXh0IGRpc2NvdmVyeSBjeWNsZSByZS1pbmplY3RzIGl0LiBDbGVhcmVkIGluIGNsZWFyQ29udmVyc2F0aW9uLlxuICBjb25zdCBsb2FkZWROZXN0ZWRNZW1vcnlQYXRoc1JlZiA9IHVzZVJlZihuZXcgU2V0PHN0cmluZz4oKSlcblxuICAvLyBIZWxwZXIgdG8gcmVzdG9yZSByZWFkIGZpbGUgc3RhdGUgZnJvbSBtZXNzYWdlcyAodXNlZCBmb3IgcmVzdW1lIGZsb3dzKVxuICAvLyBUaGlzIGFsbG93cyBDbGF1ZGUgdG8gZWRpdCBmaWxlcyB0aGF0IHdlcmUgcmVhZCBpbiBwcmV2aW91cyBzZXNzaW9uc1xuICBjb25zdCByZXN0b3JlUmVhZEZpbGVTdGF0ZSA9IHVzZUNhbGxiYWNrKFxuICAgIChtZXNzYWdlczogTWVzc2FnZVR5cGVbXSwgY3dkOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IGV4dHJhY3RlZCA9IGV4dHJhY3RSZWFkRmlsZXNGcm9tTWVzc2FnZXMoXG4gICAgICAgIG1lc3NhZ2VzLFxuICAgICAgICBjd2QsXG4gICAgICAgIFJFQURfRklMRV9TVEFURV9DQUNIRV9TSVpFLFxuICAgICAgKVxuICAgICAgcmVhZEZpbGVTdGF0ZS5jdXJyZW50ID0gbWVyZ2VGaWxlU3RhdGVDYWNoZXMoXG4gICAgICAgIHJlYWRGaWxlU3RhdGUuY3VycmVudCxcbiAgICAgICAgZXh0cmFjdGVkLFxuICAgICAgKVxuICAgICAgZm9yIChjb25zdCB0b29sIG9mIGV4dHJhY3RCYXNoVG9vbHNGcm9tTWVzc2FnZXMobWVzc2FnZXMpKSB7XG4gICAgICAgIGJhc2hUb29scy5jdXJyZW50LmFkZCh0b29sKVxuICAgICAgfVxuICAgIH0sXG4gICAgW10sXG4gIClcblxuICAvLyBFeHRyYWN0IHJlYWQgZmlsZSBzdGF0ZSBmcm9tIGluaXRpYWxNZXNzYWdlcyBvbiBtb3VudFxuICAvLyBUaGlzIGhhbmRsZXMgQ0xJIGZsYWcgcmVzdW1lICgtLXJlc3VtZS1zZXNzaW9uKSBhbmQgUmVzdW1lQ29udmVyc2F0aW9uIHNjcmVlblxuICAvLyB3aGVyZSBtZXNzYWdlcyBhcmUgcGFzc2VkIGFzIHByb3BzIHJhdGhlciB0aGFuIHRocm91Z2ggdGhlIHJlc3VtZSBjYWxsYmFja1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChpbml0aWFsTWVzc2FnZXMgJiYgaW5pdGlhbE1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJlc3RvcmVSZWFkRmlsZVN0YXRlKGluaXRpYWxNZXNzYWdlcywgZ2V0T3JpZ2luYWxDd2QoKSlcbiAgICAgIHZvaWQgcmVzdG9yZVJlbW90ZUFnZW50VGFza3Moe1xuICAgICAgICBhYm9ydENvbnRyb2xsZXI6IG5ldyBBYm9ydENvbnRyb2xsZXIoKSxcbiAgICAgICAgZ2V0QXBwU3RhdGU6ICgpID0+IHN0b3JlLmdldFN0YXRlKCksXG4gICAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgfSlcbiAgICB9XG4gICAgLy8gT25seSBydW4gb24gbW91bnQgLSBpbml0aWFsTWVzc2FnZXMgc2hvdWxkbid0IGNoYW5nZSBkdXJpbmcgY29tcG9uZW50IGxpZmV0aW1lXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHJlYWN0LWhvb2tzL2V4aGF1c3RpdmUtZGVwc1xuICB9LCBbXSlcblxuICBjb25zdCB7IHN0YXR1czogYXBpS2V5U3RhdHVzLCByZXZlcmlmeSB9ID0gdXNlQXBpS2V5VmVyaWZpY2F0aW9uKClcblxuICAvLyBBdXRvLXJ1biAvaXNzdWUgc3RhdGVcbiAgY29uc3QgW2F1dG9SdW5Jc3N1ZVJlYXNvbiwgc2V0QXV0b1J1bklzc3VlUmVhc29uXSA9XG4gICAgdXNlU3RhdGU8QXV0b1J1bklzc3VlUmVhc29uIHwgbnVsbD4obnVsbClcbiAgLy8gUmVmIHRvIHRyYWNrIGlmIGF1dG9SdW5Jc3N1ZSB3YXMgdHJpZ2dlcmVkIHRoaXMgc3VydmV5IGN5Y2xlLFxuICAvLyBzbyB3ZSBjYW4gc3VwcHJlc3MgdGhlIFsxXSBmb2xsb3ctdXAgcHJvbXB0IGV2ZW4gYWZ0ZXJcbiAgLy8gYXV0b1J1bklzc3VlUmVhc29uIGlzIGNsZWFyZWQuXG4gIGNvbnN0IGRpZEF1dG9SdW5Jc3N1ZVJlZiA9IHVzZVJlZihmYWxzZSlcblxuICAvLyBTdGF0ZSBmb3IgZXhpdCBmZWVkYmFjayBmbG93XG4gIGNvbnN0IFtleGl0Rmxvdywgc2V0RXhpdEZsb3ddID0gdXNlU3RhdGU8UmVhY3QuUmVhY3ROb2RlPihudWxsKVxuICBjb25zdCBbaXNFeGl0aW5nLCBzZXRJc0V4aXRpbmddID0gdXNlU3RhdGUoZmFsc2UpXG5cbiAgLy8gQ2FsY3VsYXRlIGlmIGNvc3QgZGlhbG9nIHNob3VsZCBiZSBzaG93blxuICBjb25zdCBzaG93aW5nQ29zdERpYWxvZyA9ICFpc0xvYWRpbmcgJiYgc2hvd0Nvc3REaWFsb2dcblxuICAvLyBEZXRlcm1pbmUgd2hpY2ggZGlhbG9nIHNob3VsZCBoYXZlIGZvY3VzIChpZiBhbnkpXG4gIC8vIFBlcm1pc3Npb24gYW5kIGludGVyYWN0aXZlIGRpYWxvZ3MgY2FuIHNob3cgZXZlbiB3aGVuIHRvb2xKU1ggaXMgc2V0LFxuICAvLyBhcyBsb25nIGFzIHNob3VsZENvbnRpbnVlQW5pbWF0aW9uIGlzIHRydWUuIFRoaXMgcHJldmVudHMgZGVhZGxvY2tzIHdoZW5cbiAgLy8gYWdlbnRzIHNldCBiYWNrZ3JvdW5kIGhpbnRzIHdoaWxlIHdhaXRpbmcgZm9yIHVzZXIgaW50ZXJhY3Rpb24uXG4gIGZ1bmN0aW9uIGdldEZvY3VzZWRJbnB1dERpYWxvZygpOlxuICAgIHwgJ21lc3NhZ2Utc2VsZWN0b3InXG4gICAgfCAnc2FuZGJveC1wZXJtaXNzaW9uJ1xuICAgIHwgJ3Rvb2wtcGVybWlzc2lvbidcbiAgICB8ICdwcm9tcHQnXG4gICAgfCAnd29ya2VyLXNhbmRib3gtcGVybWlzc2lvbidcbiAgICB8ICdlbGljaXRhdGlvbidcbiAgICB8ICdjb3N0J1xuICAgIHwgJ2lkbGUtcmV0dXJuJ1xuICAgIHwgJ2luaXQtb25ib2FyZGluZydcbiAgICB8ICdpZGUtb25ib2FyZGluZydcbiAgICB8ICdtb2RlbC1zd2l0Y2gnXG4gICAgfCAndW5kZXJjb3Zlci1jYWxsb3V0J1xuICAgIHwgJ2VmZm9ydC1jYWxsb3V0J1xuICAgIHwgJ3JlbW90ZS1jYWxsb3V0J1xuICAgIHwgJ2xzcC1yZWNvbW1lbmRhdGlvbidcbiAgICB8ICdwbHVnaW4taGludCdcbiAgICB8ICdkZXNrdG9wLXVwc2VsbCdcbiAgICB8ICd1bHRyYXBsYW4tY2hvaWNlJ1xuICAgIHwgJ3VsdHJhcGxhbi1sYXVuY2gnXG4gICAgfCB1bmRlZmluZWQge1xuICAgIC8vIEV4aXQgc3RhdGVzIGFsd2F5cyB0YWtlIHByZWNlZGVuY2VcbiAgICBpZiAoaXNFeGl0aW5nIHx8IGV4aXRGbG93KSByZXR1cm4gdW5kZWZpbmVkXG5cbiAgICAvLyBIaWdoIHByaW9yaXR5IGRpYWxvZ3MgKGFsd2F5cyBzaG93IHJlZ2FyZGxlc3Mgb2YgdHlwaW5nKVxuICAgIGlmIChpc01lc3NhZ2VTZWxlY3RvclZpc2libGUpIHJldHVybiAnbWVzc2FnZS1zZWxlY3RvcidcblxuICAgIC8vIFN1cHByZXNzIGludGVycnVwdCBkaWFsb2dzIHdoaWxlIHVzZXIgaXMgYWN0aXZlbHkgdHlwaW5nXG4gICAgaWYgKGlzUHJvbXB0SW5wdXRBY3RpdmUpIHJldHVybiB1bmRlZmluZWRcblxuICAgIGlmIChzYW5kYm94UGVybWlzc2lvblJlcXVlc3RRdWV1ZVswXSkgcmV0dXJuICdzYW5kYm94LXBlcm1pc3Npb24nXG5cbiAgICAvLyBQZXJtaXNzaW9uL2ludGVyYWN0aXZlIGRpYWxvZ3MgKHNob3cgdW5sZXNzIGJsb2NrZWQgYnkgdG9vbEpTWClcbiAgICBjb25zdCBhbGxvd0RpYWxvZ3NXaXRoQW5pbWF0aW9uID1cbiAgICAgICF0b29sSlNYIHx8IHRvb2xKU1guc2hvdWxkQ29udGludWVBbmltYXRpb25cblxuICAgIGlmIChhbGxvd0RpYWxvZ3NXaXRoQW5pbWF0aW9uICYmIHRvb2xVc2VDb25maXJtUXVldWVbMF0pXG4gICAgICByZXR1cm4gJ3Rvb2wtcGVybWlzc2lvbidcbiAgICBpZiAoYWxsb3dEaWFsb2dzV2l0aEFuaW1hdGlvbiAmJiBwcm9tcHRRdWV1ZVswXSkgcmV0dXJuICdwcm9tcHQnXG4gICAgLy8gV29ya2VyIHNhbmRib3ggcGVybWlzc2lvbiBwcm9tcHRzIChuZXR3b3JrIGFjY2VzcykgZnJvbSBzd2FybSB3b3JrZXJzXG4gICAgaWYgKGFsbG93RGlhbG9nc1dpdGhBbmltYXRpb24gJiYgd29ya2VyU2FuZGJveFBlcm1pc3Npb25zLnF1ZXVlWzBdKVxuICAgICAgcmV0dXJuICd3b3JrZXItc2FuZGJveC1wZXJtaXNzaW9uJ1xuICAgIGlmIChhbGxvd0RpYWxvZ3NXaXRoQW5pbWF0aW9uICYmIGVsaWNpdGF0aW9uLnF1ZXVlWzBdKSByZXR1cm4gJ2VsaWNpdGF0aW9uJ1xuICAgIGlmIChhbGxvd0RpYWxvZ3NXaXRoQW5pbWF0aW9uICYmIHNob3dpbmdDb3N0RGlhbG9nKSByZXR1cm4gJ2Nvc3QnXG4gICAgaWYgKGFsbG93RGlhbG9nc1dpdGhBbmltYXRpb24gJiYgaWRsZVJldHVyblBlbmRpbmcpIHJldHVybiAnaWRsZS1yZXR1cm4nXG5cbiAgICBpZiAoXG4gICAgICBmZWF0dXJlKCdVTFRSQVBMQU4nKSAmJlxuICAgICAgYWxsb3dEaWFsb2dzV2l0aEFuaW1hdGlvbiAmJlxuICAgICAgIWlzTG9hZGluZyAmJlxuICAgICAgdWx0cmFwbGFuUGVuZGluZ0Nob2ljZVxuICAgIClcbiAgICAgIHJldHVybiAndWx0cmFwbGFuLWNob2ljZSdcblxuICAgIGlmIChcbiAgICAgIGZlYXR1cmUoJ1VMVFJBUExBTicpICYmXG4gICAgICBhbGxvd0RpYWxvZ3NXaXRoQW5pbWF0aW9uICYmXG4gICAgICAhaXNMb2FkaW5nICYmXG4gICAgICB1bHRyYXBsYW5MYXVuY2hQZW5kaW5nXG4gICAgKVxuICAgICAgcmV0dXJuICd1bHRyYXBsYW4tbGF1bmNoJ1xuXG4gICAgLy8gT25ib2FyZGluZyBkaWFsb2dzIChzcGVjaWFsIGNvbmRpdGlvbnMpXG4gICAgaWYgKGFsbG93RGlhbG9nc1dpdGhBbmltYXRpb24gJiYgc2hvd0lkZU9uYm9hcmRpbmcpIHJldHVybiAnaWRlLW9uYm9hcmRpbmcnXG5cbiAgICAvLyBNb2RlbCBzd2l0Y2ggY2FsbG91dCAoYW50LW9ubHksIGVsaW1pbmF0ZWQgZnJvbSBleHRlcm5hbCBidWlsZHMpXG4gICAgaWYgKFxuICAgICAgXCJleHRlcm5hbFwiID09PSAnYW50JyAmJlxuICAgICAgYWxsb3dEaWFsb2dzV2l0aEFuaW1hdGlvbiAmJlxuICAgICAgc2hvd01vZGVsU3dpdGNoQ2FsbG91dFxuICAgIClcbiAgICAgIHJldHVybiAnbW9kZWwtc3dpdGNoJ1xuXG4gICAgLy8gVW5kZXJjb3ZlciBhdXRvLWVuYWJsZSBleHBsYWluZXIgKGFudC1vbmx5LCBlbGltaW5hdGVkIGZyb20gZXh0ZXJuYWwgYnVpbGRzKVxuICAgIGlmIChcbiAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiZcbiAgICAgIGFsbG93RGlhbG9nc1dpdGhBbmltYXRpb24gJiZcbiAgICAgIHNob3dVbmRlcmNvdmVyQ2FsbG91dFxuICAgIClcbiAgICAgIHJldHVybiAndW5kZXJjb3Zlci1jYWxsb3V0J1xuXG4gICAgLy8gRWZmb3J0IGNhbGxvdXQgKHNob3duIG9uY2UgZm9yIE9wdXMgNC42IHVzZXJzIHdoZW4gZWZmb3J0IGlzIGVuYWJsZWQpXG4gICAgaWYgKGFsbG93RGlhbG9nc1dpdGhBbmltYXRpb24gJiYgc2hvd0VmZm9ydENhbGxvdXQpIHJldHVybiAnZWZmb3J0LWNhbGxvdXQnXG5cbiAgICAvLyBSZW1vdGUgY2FsbG91dCAoc2hvd24gb25jZSBiZWZvcmUgZmlyc3QgYnJpZGdlIGVuYWJsZSlcbiAgICBpZiAoYWxsb3dEaWFsb2dzV2l0aEFuaW1hdGlvbiAmJiBzaG93UmVtb3RlQ2FsbG91dCkgcmV0dXJuICdyZW1vdGUtY2FsbG91dCdcblxuICAgIC8vIExTUCBwbHVnaW4gcmVjb21tZW5kYXRpb24gKGxvd2VzdCBwcmlvcml0eSAtIG5vbi1ibG9ja2luZyBzdWdnZXN0aW9uKVxuICAgIGlmIChhbGxvd0RpYWxvZ3NXaXRoQW5pbWF0aW9uICYmIGxzcFJlY29tbWVuZGF0aW9uKVxuICAgICAgcmV0dXJuICdsc3AtcmVjb21tZW5kYXRpb24nXG5cbiAgICAvLyBQbHVnaW4gaGludCBmcm9tIENMSS9TREsgc3RkZXJyIChzYW1lIHByaW9yaXR5IGJhbmQgYXMgTFNQIHJlYylcbiAgICBpZiAoYWxsb3dEaWFsb2dzV2l0aEFuaW1hdGlvbiAmJiBoaW50UmVjb21tZW5kYXRpb24pIHJldHVybiAncGx1Z2luLWhpbnQnXG5cbiAgICAvLyBEZXNrdG9wIGFwcCB1cHNlbGwgKG1heCAzIGxhdW5jaGVzLCBsb3dlc3QgcHJpb3JpdHkpXG4gICAgaWYgKGFsbG93RGlhbG9nc1dpdGhBbmltYXRpb24gJiYgc2hvd0Rlc2t0b3BVcHNlbGxTdGFydHVwKVxuICAgICAgcmV0dXJuICdkZXNrdG9wLXVwc2VsbCdcblxuICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxuXG4gIGNvbnN0IGZvY3VzZWRJbnB1dERpYWxvZyA9IGdldEZvY3VzZWRJbnB1dERpYWxvZygpXG5cbiAgLy8gVHJ1ZSB3aGVuIHBlcm1pc3Npb24gcHJvbXB0cyBleGlzdCBidXQgYXJlIGhpZGRlbiBiZWNhdXNlIHRoZSB1c2VyIGlzIHR5cGluZ1xuICBjb25zdCBoYXNTdXBwcmVzc2VkRGlhbG9ncyA9XG4gICAgaXNQcm9tcHRJbnB1dEFjdGl2ZSAmJlxuICAgIChzYW5kYm94UGVybWlzc2lvblJlcXVlc3RRdWV1ZVswXSB8fFxuICAgICAgdG9vbFVzZUNvbmZpcm1RdWV1ZVswXSB8fFxuICAgICAgcHJvbXB0UXVldWVbMF0gfHxcbiAgICAgIHdvcmtlclNhbmRib3hQZXJtaXNzaW9ucy5xdWV1ZVswXSB8fFxuICAgICAgZWxpY2l0YXRpb24ucXVldWVbMF0gfHxcbiAgICAgIHNob3dpbmdDb3N0RGlhbG9nKVxuXG4gIC8vIEtlZXAgcmVmIGluIHN5bmMgc28gdGltZXIgY2FsbGJhY2tzIGNhbiByZWFkIHRoZSBjdXJyZW50IHZhbHVlXG4gIGZvY3VzZWRJbnB1dERpYWxvZ1JlZi5jdXJyZW50ID0gZm9jdXNlZElucHV0RGlhbG9nXG5cbiAgLy8gSW1tZWRpYXRlbHkgY2FwdHVyZSBwYXVzZS9yZXN1bWUgd2hlbiBmb2N1c2VkSW5wdXREaWFsb2cgY2hhbmdlc1xuICAvLyBUaGlzIGVuc3VyZXMgYWNjdXJhdGUgdGltaW5nIGV2ZW4gdW5kZXIgaGlnaCBzeXN0ZW0gbG9hZCwgcmF0aGVyIHRoYW5cbiAgLy8gcmVseWluZyBvbiB0aGUgMTAwbXMgcG9sbGluZyBpbnRlcnZhbCB0byBkZXRlY3Qgc3RhdGUgY2hhbmdlc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghaXNMb2FkaW5nKSByZXR1cm5cblxuICAgIGNvbnN0IGlzUGF1c2VkID0gZm9jdXNlZElucHV0RGlhbG9nID09PSAndG9vbC1wZXJtaXNzaW9uJ1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KClcblxuICAgIGlmIChpc1BhdXNlZCAmJiBwYXVzZVN0YXJ0VGltZVJlZi5jdXJyZW50ID09PSBudWxsKSB7XG4gICAgICAvLyBKdXN0IGVudGVyZWQgcGF1c2Ugc3RhdGUgLSByZWNvcmQgdGhlIGV4YWN0IG1vbWVudFxuICAgICAgcGF1c2VTdGFydFRpbWVSZWYuY3VycmVudCA9IG5vd1xuICAgIH0gZWxzZSBpZiAoIWlzUGF1c2VkICYmIHBhdXNlU3RhcnRUaW1lUmVmLmN1cnJlbnQgIT09IG51bGwpIHtcbiAgICAgIC8vIEp1c3QgZXhpdGVkIHBhdXNlIHN0YXRlIC0gYWNjdW11bGF0ZSBwYXVzZWQgdGltZSBpbW1lZGlhdGVseVxuICAgICAgdG90YWxQYXVzZWRNc1JlZi5jdXJyZW50ICs9IG5vdyAtIHBhdXNlU3RhcnRUaW1lUmVmLmN1cnJlbnRcbiAgICAgIHBhdXNlU3RhcnRUaW1lUmVmLmN1cnJlbnQgPSBudWxsXG4gICAgfVxuICB9LCBbZm9jdXNlZElucHV0RGlhbG9nLCBpc0xvYWRpbmddKVxuXG4gIC8vIFJlLXBpbiBzY3JvbGwgdG8gYm90dG9tIHdoZW5ldmVyIHRoZSBwZXJtaXNzaW9uIG92ZXJsYXkgYXBwZWFycyBvclxuICAvLyBkaXNtaXNzZXMuIE92ZXJsYXkgbm93IHJlbmRlcnMgYmVsb3cgbWVzc2FnZXMgaW5zaWRlIHRoZSBzYW1lXG4gIC8vIFNjcm9sbEJveCAobm8gcmVtb3VudCksIHNvIHdlIG5lZWQgYW4gZXhwbGljaXQgc2Nyb2xsVG9Cb3R0b20gZm9yOlxuICAvLyAgLSBhcHBlYXI6IHVzZXIgbWF5IGhhdmUgYmVlbiBzY3JvbGxlZCB1cCAoc3RpY2t5IGJyb2tlbikg4oCUIHRoZVxuICAvLyAgICBkaWFsb2cgaXMgYmxvY2tpbmcgYW5kIG11c3QgYmUgdmlzaWJsZVxuICAvLyAgLSBkaXNtaXNzOiB1c2VyIG1heSBoYXZlIHNjcm9sbGVkIHVwIHRvIHJlYWQgY29udGV4dCBkdXJpbmcgdGhlXG4gIC8vICAgIG92ZXJsYXksIGFuZCBvblNjcm9sbCB3YXMgc3VwcHJlc3NlZCBzbyB0aGUgcGlsbCBzdGF0ZSBpcyBzdGFsZVxuICAvLyB1c2VMYXlvdXRFZmZlY3Qgc28gdGhlIHJlLXBpbiBjb21taXRzIGJlZm9yZSB0aGUgSW5rIGZyYW1lIHJlbmRlcnMg4oCUXG4gIC8vIG5vIDEtZnJhbWUgZmxhc2ggb2YgdGhlIHdyb25nIHNjcm9sbCBwb3NpdGlvbi5cbiAgY29uc3QgcHJldkRpYWxvZ1JlZiA9IHVzZVJlZihmb2N1c2VkSW5wdXREaWFsb2cpXG4gIHVzZUxheW91dEVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3Qgd2FzID0gcHJldkRpYWxvZ1JlZi5jdXJyZW50ID09PSAndG9vbC1wZXJtaXNzaW9uJ1xuICAgIGNvbnN0IG5vdyA9IGZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ3Rvb2wtcGVybWlzc2lvbidcbiAgICBpZiAod2FzICE9PSBub3cpIHJlcGluU2Nyb2xsKClcbiAgICBwcmV2RGlhbG9nUmVmLmN1cnJlbnQgPSBmb2N1c2VkSW5wdXREaWFsb2dcbiAgfSwgW2ZvY3VzZWRJbnB1dERpYWxvZywgcmVwaW5TY3JvbGxdKVxuXG4gIGZ1bmN0aW9uIG9uQ2FuY2VsKCkge1xuICAgIGlmIChmb2N1c2VkSW5wdXREaWFsb2cgPT09ICdlbGljaXRhdGlvbicpIHtcbiAgICAgIC8vIEVsaWNpdGF0aW9uIGRpYWxvZyBoYW5kbGVzIGl0cyBvd24gRXNjYXBlLCBhbmQgY2xvc2luZyBpdCBzaG91bGRuJ3QgYWZmZWN0IGFueSBsb2FkaW5nIHN0YXRlLlxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgYFtvbkNhbmNlbF0gZm9jdXNlZElucHV0RGlhbG9nPSR7Zm9jdXNlZElucHV0RGlhbG9nfSBzdHJlYW1Nb2RlPSR7c3RyZWFtTW9kZX1gLFxuICAgIClcblxuICAgIC8vIFBhdXNlIHByb2FjdGl2ZSBtb2RlIHNvIHRoZSB1c2VyIGdldHMgY29udHJvbCBiYWNrLlxuICAgIC8vIEl0IHdpbGwgcmVzdW1lIHdoZW4gdGhleSBzdWJtaXQgdGhlaXIgbmV4dCBpbnB1dCAoc2VlIG9uU3VibWl0KS5cbiAgICBpZiAoZmVhdHVyZSgnUFJPQUNUSVZFJykgfHwgZmVhdHVyZSgnS0FJUk9TJykpIHtcbiAgICAgIHByb2FjdGl2ZU1vZHVsZT8ucGF1c2VQcm9hY3RpdmUoKVxuICAgIH1cblxuICAgIHF1ZXJ5R3VhcmQuZm9yY2VFbmQoKVxuICAgIHNraXBJZGxlQ2hlY2tSZWYuY3VycmVudCA9IGZhbHNlXG5cbiAgICAvLyBQcmVzZXJ2ZSBwYXJ0aWFsbHktc3RyZWFtZWQgdGV4dCBzbyB0aGUgdXNlciBjYW4gcmVhZCB3aGF0IHdhc1xuICAgIC8vIGdlbmVyYXRlZCBiZWZvcmUgcHJlc3NpbmcgRXNjLiBQdXNoZWQgYmVmb3JlIHJlc2V0TG9hZGluZ1N0YXRlIGNsZWFyc1xuICAgIC8vIHN0cmVhbWluZ1RleHQsIGFuZCBiZWZvcmUgcXVlcnkudHMgeWllbGRzIHRoZSBhc3luYyBpbnRlcnJ1cHQgbWFya2VyLFxuICAgIC8vIGdpdmluZyBmaW5hbCBvcmRlciBbdXNlciwgcGFydGlhbC1hc3Npc3RhbnQsIFtSZXF1ZXN0IGludGVycnVwdGVkIGJ5IHVzZXJdXS5cbiAgICBpZiAoc3RyZWFtaW5nVGV4dD8udHJpbSgpKSB7XG4gICAgICBzZXRNZXNzYWdlcyhwcmV2ID0+IFtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgY3JlYXRlQXNzaXN0YW50TWVzc2FnZSh7IGNvbnRlbnQ6IHN0cmVhbWluZ1RleHQgfSksXG4gICAgICBdKVxuICAgIH1cblxuICAgIHJlc2V0TG9hZGluZ1N0YXRlKClcblxuICAgIC8vIENsZWFyIGFueSBhY3RpdmUgdG9rZW4gYnVkZ2V0IHNvIHRoZSBiYWNrc3RvcCBkb2Vzbid0IGZpcmUgb25cbiAgICAvLyBhIHN0YWxlIGJ1ZGdldCBpZiB0aGUgcXVlcnkgZ2VuZXJhdG9yIGhhc24ndCBleGl0ZWQgeWV0LlxuICAgIGlmIChmZWF0dXJlKCdUT0tFTl9CVURHRVQnKSkge1xuICAgICAgc25hcHNob3RPdXRwdXRUb2tlbnNGb3JUdXJuKG51bGwpXG4gICAgfVxuXG4gICAgaWYgKGZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ3Rvb2wtcGVybWlzc2lvbicpIHtcbiAgICAgIC8vIFRvb2wgdXNlIGNvbmZpcm0gaGFuZGxlcyB0aGUgYWJvcnQgc2lnbmFsIGl0c2VsZlxuICAgICAgdG9vbFVzZUNvbmZpcm1RdWV1ZVswXT8ub25BYm9ydCgpXG4gICAgICBzZXRUb29sVXNlQ29uZmlybVF1ZXVlKFtdKVxuICAgIH0gZWxzZSBpZiAoZm9jdXNlZElucHV0RGlhbG9nID09PSAncHJvbXB0Jykge1xuICAgICAgLy8gUmVqZWN0IGFsbCBwZW5kaW5nIHByb21wdHMgYW5kIGNsZWFyIHRoZSBxdWV1ZVxuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHByb21wdFF1ZXVlKSB7XG4gICAgICAgIGl0ZW0ucmVqZWN0KG5ldyBFcnJvcignUHJvbXB0IGNhbmNlbGxlZCBieSB1c2VyJykpXG4gICAgICB9XG4gICAgICBzZXRQcm9tcHRRdWV1ZShbXSlcbiAgICAgIGFib3J0Q29udHJvbGxlcj8uYWJvcnQoJ3VzZXItY2FuY2VsJylcbiAgICB9IGVsc2UgaWYgKGFjdGl2ZVJlbW90ZS5pc1JlbW90ZU1vZGUpIHtcbiAgICAgIC8vIFJlbW90ZSBtb2RlOiBzZW5kIGludGVycnVwdCBzaWduYWwgdG8gQ0NSXG4gICAgICBhY3RpdmVSZW1vdGUuY2FuY2VsUmVxdWVzdCgpXG4gICAgfSBlbHNlIHtcbiAgICAgIGFib3J0Q29udHJvbGxlcj8uYWJvcnQoJ3VzZXItY2FuY2VsJylcbiAgICB9XG5cbiAgICAvLyBDbGVhciB0aGUgY29udHJvbGxlciBzbyBzdWJzZXF1ZW50IEVzY2FwZSBwcmVzc2VzIGRvbid0IHNlZSBhIHN0YWxlXG4gICAgLy8gYWJvcnRlZCBzaWduYWwuIFdpdGhvdXQgdGhpcywgY2FuQ2FuY2VsUnVubmluZ1Rhc2sgaXMgZmFsc2UgKHNpZ25hbFxuICAgIC8vIGRlZmluZWQgYnV0IC5hYm9ydGVkID09PSB0cnVlKSwgc28gaXNBY3RpdmUgYmVjb21lcyBmYWxzZSBpZiBubyBvdGhlclxuICAgIC8vIGFjdGl2YXRpbmcgY29uZGl0aW9ucyBob2xkIOKAlCBsZWF2aW5nIHRoZSBFc2NhcGUga2V5YmluZGluZyBpbmFjdGl2ZS5cbiAgICBzZXRBYm9ydENvbnRyb2xsZXIobnVsbClcblxuICAgIC8vIGZvcmNlRW5kKCkgc2tpcHMgdGhlIGZpbmFsbHkgcGF0aCDigJQgZmlyZSBkaXJlY3RseSAoYWJvcnRlZD10cnVlKS5cbiAgICB2b2lkIG1yT25UdXJuQ29tcGxldGUobWVzc2FnZXNSZWYuY3VycmVudCwgdHJ1ZSlcbiAgfVxuXG4gIC8vIEZ1bmN0aW9uIHRvIGhhbmRsZSBxdWV1ZWQgY29tbWFuZCB3aGVuIGNhbmNlbGluZyBhIHBlcm1pc3Npb24gcmVxdWVzdFxuICBjb25zdCBoYW5kbGVRdWV1ZWRDb21tYW5kT25DYW5jZWwgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gcG9wQWxsRWRpdGFibGUoaW5wdXRWYWx1ZSwgMClcbiAgICBpZiAoIXJlc3VsdCkgcmV0dXJuXG4gICAgc2V0SW5wdXRWYWx1ZShyZXN1bHQudGV4dClcbiAgICBzZXRJbnB1dE1vZGUoJ3Byb21wdCcpXG5cbiAgICAvLyBSZXN0b3JlIGltYWdlcyBmcm9tIHF1ZXVlZCBjb21tYW5kcyB0byBwYXN0ZWRDb250ZW50c1xuICAgIGlmIChyZXN1bHQuaW1hZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHNldFBhc3RlZENvbnRlbnRzKHByZXYgPT4ge1xuICAgICAgICBjb25zdCBuZXdDb250ZW50cyA9IHsgLi4ucHJldiB9XG4gICAgICAgIGZvciAoY29uc3QgaW1hZ2Ugb2YgcmVzdWx0LmltYWdlcykge1xuICAgICAgICAgIG5ld0NvbnRlbnRzW2ltYWdlLmlkXSA9IGltYWdlXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld0NvbnRlbnRzXG4gICAgICB9KVxuICAgIH1cbiAgfSwgW3NldElucHV0VmFsdWUsIHNldElucHV0TW9kZSwgaW5wdXRWYWx1ZSwgc2V0UGFzdGVkQ29udGVudHNdKVxuXG4gIC8vIENhbmNlbFJlcXVlc3RIYW5kbGVyIHByb3BzIC0gcmVuZGVyZWQgaW5zaWRlIEtleWJpbmRpbmdTZXR1cFxuICBjb25zdCBjYW5jZWxSZXF1ZXN0UHJvcHMgPSB7XG4gICAgc2V0VG9vbFVzZUNvbmZpcm1RdWV1ZSxcbiAgICBvbkNhbmNlbCxcbiAgICBvbkFnZW50c0tpbGxlZDogKCkgPT5cbiAgICAgIHNldE1lc3NhZ2VzKHByZXYgPT4gWy4uLnByZXYsIGNyZWF0ZUFnZW50c0tpbGxlZE1lc3NhZ2UoKV0pLFxuICAgIGlzTWVzc2FnZVNlbGVjdG9yVmlzaWJsZTogaXNNZXNzYWdlU2VsZWN0b3JWaXNpYmxlIHx8ICEhc2hvd0Jhc2hlc0RpYWxvZyxcbiAgICBzY3JlZW4sXG4gICAgYWJvcnRTaWduYWw6IGFib3J0Q29udHJvbGxlcj8uc2lnbmFsLFxuICAgIHBvcENvbW1hbmRGcm9tUXVldWU6IGhhbmRsZVF1ZXVlZENvbW1hbmRPbkNhbmNlbCxcbiAgICB2aW1Nb2RlLFxuICAgIGlzTG9jYWxKU1hDb21tYW5kOiB0b29sSlNYPy5pc0xvY2FsSlNYQ29tbWFuZCxcbiAgICBpc1NlYXJjaGluZ0hpc3RvcnksXG4gICAgaXNIZWxwT3BlbixcbiAgICBpbnB1dE1vZGUsXG4gICAgaW5wdXRWYWx1ZSxcbiAgICBzdHJlYW1Nb2RlLFxuICB9XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCB0b3RhbENvc3QgPSBnZXRUb3RhbENvc3QoKVxuICAgIGlmICh0b3RhbENvc3QgPj0gNSAvKiAkNSAqLyAmJiAhc2hvd0Nvc3REaWFsb2cgJiYgIWhhdmVTaG93bkNvc3REaWFsb2cpIHtcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9jb3N0X3RocmVzaG9sZF9yZWFjaGVkJywge30pXG4gICAgICAvLyBNYXJrIGFzIHNob3duIGV2ZW4gaWYgdGhlIGRpYWxvZyB3b24ndCByZW5kZXIgKG5vIGNvbnNvbGUgYmlsbGluZ1xuICAgICAgLy8gYWNjZXNzKS4gT3RoZXJ3aXNlIHRoaXMgZWZmZWN0IHJlLWZpcmVzIG9uIGV2ZXJ5IG1lc3NhZ2UgY2hhbmdlIGZvclxuICAgICAgLy8gdGhlIHJlc3Qgb2YgdGhlIHNlc3Npb24g4oCUIDIwMGsrIHNwdXJpb3VzIGV2ZW50cyBvYnNlcnZlZC5cbiAgICAgIHNldEhhdmVTaG93bkNvc3REaWFsb2codHJ1ZSlcbiAgICAgIGlmIChoYXNDb25zb2xlQmlsbGluZ0FjY2VzcygpKSB7XG4gICAgICAgIHNldFNob3dDb3N0RGlhbG9nKHRydWUpXG4gICAgICB9XG4gICAgfVxuICB9LCBbbWVzc2FnZXMsIHNob3dDb3N0RGlhbG9nLCBoYXZlU2hvd25Db3N0RGlhbG9nXSlcblxuICBjb25zdCBzYW5kYm94QXNrQ2FsbGJhY2s6IFNhbmRib3hBc2tDYWxsYmFjayA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChob3N0UGF0dGVybjogTmV0d29ya0hvc3RQYXR0ZXJuKSA9PiB7XG4gICAgICAvLyBJZiBydW5uaW5nIGFzIGEgc3dhcm0gd29ya2VyLCBmb3J3YXJkIHRoZSByZXF1ZXN0IHRvIHRoZSBsZWFkZXIgdmlhIG1haWxib3hcbiAgICAgIGlmIChpc0FnZW50U3dhcm1zRW5hYmxlZCgpICYmIGlzU3dhcm1Xb3JrZXIoKSkge1xuICAgICAgICBjb25zdCByZXF1ZXN0SWQgPSBnZW5lcmF0ZVNhbmRib3hSZXF1ZXN0SWQoKVxuXG4gICAgICAgIC8vIFNlbmQgdGhlIHJlcXVlc3QgdG8gdGhlIGxlYWRlciB2aWEgbWFpbGJveFxuICAgICAgICBjb25zdCBzZW50ID0gYXdhaXQgc2VuZFNhbmRib3hQZXJtaXNzaW9uUmVxdWVzdFZpYU1haWxib3goXG4gICAgICAgICAgaG9zdFBhdHRlcm4uaG9zdCxcbiAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgIClcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZVNob3VsZEFsbG93SG9zdCA9PiB7XG4gICAgICAgICAgaWYgKCFzZW50KSB7XG4gICAgICAgICAgICAvLyBJZiB3ZSBjb3VsZG4ndCBzZW5kIHZpYSBtYWlsYm94LCBmYWxsIGJhY2sgdG8gbG9jYWwgaGFuZGxpbmdcbiAgICAgICAgICAgIHNldFNhbmRib3hQZXJtaXNzaW9uUmVxdWVzdFF1ZXVlKHByZXYgPT4gW1xuICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaG9zdFBhdHRlcm4sXG4gICAgICAgICAgICAgICAgcmVzb2x2ZVByb21pc2U6IHJlc29sdmVTaG91bGRBbGxvd0hvc3QsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gUmVnaXN0ZXIgdGhlIGNhbGxiYWNrIGZvciB3aGVuIHRoZSBsZWFkZXIgcmVzcG9uZHNcbiAgICAgICAgICByZWdpc3RlclNhbmRib3hQZXJtaXNzaW9uQ2FsbGJhY2soe1xuICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgaG9zdDogaG9zdFBhdHRlcm4uaG9zdCxcbiAgICAgICAgICAgIHJlc29sdmU6IHJlc29sdmVTaG91bGRBbGxvd0hvc3QsXG4gICAgICAgICAgfSlcblxuICAgICAgICAgIC8vIFVwZGF0ZSBBcHBTdGF0ZSB0byBzaG93IHBlbmRpbmcgaW5kaWNhdG9yXG4gICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgIHBlbmRpbmdTYW5kYm94UmVxdWVzdDoge1xuICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgIGhvc3Q6IGhvc3RQYXR0ZXJuLmhvc3QsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pKVxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICAvLyBOb3JtYWwgZmxvdyBmb3Igbm9uLXdvcmtlcnM6IHNob3cgbG9jYWwgVUkgYW5kIG9wdGlvbmFsbHkgcmFjZVxuICAgICAgLy8gYWdhaW5zdCB0aGUgUkVQTCBicmlkZ2UgKFJlbW90ZSBDb250cm9sKSBpZiBjb25uZWN0ZWQuXG4gICAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZVNob3VsZEFsbG93SG9zdCA9PiB7XG4gICAgICAgIGxldCByZXNvbHZlZCA9IGZhbHNlXG4gICAgICAgIGZ1bmN0aW9uIHJlc29sdmVPbmNlKGFsbG93OiBib29sZWFuKTogdm9pZCB7XG4gICAgICAgICAgaWYgKHJlc29sdmVkKSByZXR1cm5cbiAgICAgICAgICByZXNvbHZlZCA9IHRydWVcbiAgICAgICAgICByZXNvbHZlU2hvdWxkQWxsb3dIb3N0KGFsbG93KVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUXVldWUgdGhlIGxvY2FsIHNhbmRib3ggcGVybWlzc2lvbiBkaWFsb2dcbiAgICAgICAgc2V0U2FuZGJveFBlcm1pc3Npb25SZXF1ZXN0UXVldWUocHJldiA9PiBbXG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICB7XG4gICAgICAgICAgICBob3N0UGF0dGVybixcbiAgICAgICAgICAgIHJlc29sdmVQcm9taXNlOiByZXNvbHZlT25jZSxcbiAgICAgICAgICB9LFxuICAgICAgICBdKVxuXG4gICAgICAgIC8vIFdoZW4gdGhlIFJFUEwgYnJpZGdlIGlzIGNvbm5lY3RlZCwgYWxzbyBmb3J3YXJkIHRoZSBzYW5kYm94XG4gICAgICAgIC8vIHBlcm1pc3Npb24gcmVxdWVzdCBhcyBhIGNhbl91c2VfdG9vbCBjb250cm9sX3JlcXVlc3Qgc28gdGhlXG4gICAgICAgIC8vIHJlbW90ZSB1c2VyIChlLmcuIG9uIGNsYXVkZS5haSkgY2FuIGFwcHJvdmUgaXQgdG9vLlxuICAgICAgICBpZiAoZmVhdHVyZSgnQlJJREdFX01PREUnKSkge1xuICAgICAgICAgIGNvbnN0IGJyaWRnZUNhbGxiYWNrcyA9IHN0b3JlLmdldFN0YXRlKCkucmVwbEJyaWRnZVBlcm1pc3Npb25DYWxsYmFja3NcbiAgICAgICAgICBpZiAoYnJpZGdlQ2FsbGJhY2tzKSB7XG4gICAgICAgICAgICBjb25zdCBicmlkZ2VSZXF1ZXN0SWQgPSByYW5kb21VVUlEKClcbiAgICAgICAgICAgIGJyaWRnZUNhbGxiYWNrcy5zZW5kUmVxdWVzdChcbiAgICAgICAgICAgICAgYnJpZGdlUmVxdWVzdElkLFxuICAgICAgICAgICAgICBTQU5EQk9YX05FVFdPUktfQUNDRVNTX1RPT0xfTkFNRSxcbiAgICAgICAgICAgICAgeyBob3N0OiBob3N0UGF0dGVybi5ob3N0IH0sXG4gICAgICAgICAgICAgIHJhbmRvbVVVSUQoKSxcbiAgICAgICAgICAgICAgYEFsbG93IG5ldHdvcmsgY29ubmVjdGlvbiB0byAke2hvc3RQYXR0ZXJuLmhvc3R9P2AsXG4gICAgICAgICAgICApXG5cbiAgICAgICAgICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gYnJpZGdlQ2FsbGJhY2tzLm9uUmVzcG9uc2UoXG4gICAgICAgICAgICAgIGJyaWRnZVJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgcmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgIHVuc3Vic2NyaWJlKClcbiAgICAgICAgICAgICAgICBjb25zdCBhbGxvdyA9IHJlc3BvbnNlLmJlaGF2aW9yID09PSAnYWxsb3cnXG4gICAgICAgICAgICAgICAgLy8gUmVzb2x2ZSBBTEwgcGVuZGluZyByZXF1ZXN0cyBmb3IgdGhlIHNhbWUgaG9zdCwgbm90IGp1c3RcbiAgICAgICAgICAgICAgICAvLyB0aGlzIG9uZSDigJQgbWlycm9ycyB0aGUgbG9jYWwgZGlhbG9nIGhhbmRsZXIgcGF0dGVybi5cbiAgICAgICAgICAgICAgICBzZXRTYW5kYm94UGVybWlzc2lvblJlcXVlc3RRdWV1ZShxdWV1ZSA9PiB7XG4gICAgICAgICAgICAgICAgICBxdWV1ZVxuICAgICAgICAgICAgICAgICAgICAuZmlsdGVyKGl0ZW0gPT4gaXRlbS5ob3N0UGF0dGVybi5ob3N0ID09PSBob3N0UGF0dGVybi5ob3N0KVxuICAgICAgICAgICAgICAgICAgICAuZm9yRWFjaChpdGVtID0+IGl0ZW0ucmVzb2x2ZVByb21pc2UoYWxsb3cpKVxuICAgICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXVlLmZpbHRlcihcbiAgICAgICAgICAgICAgICAgICAgaXRlbSA9PiBpdGVtLmhvc3RQYXR0ZXJuLmhvc3QgIT09IGhvc3RQYXR0ZXJuLmhvc3QsXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAvLyBDbGVhbiB1cCBhbGwgc2libGluZyBicmlkZ2Ugc3Vic2NyaXB0aW9ucyBmb3IgdGhpcyBob3N0XG4gICAgICAgICAgICAgICAgLy8gKG90aGVyIGNvbmN1cnJlbnQgc2FtZS1ob3N0IHJlcXVlc3RzKSBiZWZvcmUgZGVsZXRpbmcuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2libGluZ0NsZWFudXBzID0gc2FuZGJveEJyaWRnZUNsZWFudXBSZWYuY3VycmVudC5nZXQoXG4gICAgICAgICAgICAgICAgICBob3N0UGF0dGVybi5ob3N0LFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICBpZiAoc2libGluZ0NsZWFudXBzKSB7XG4gICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZuIG9mIHNpYmxpbmdDbGVhbnVwcykge1xuICAgICAgICAgICAgICAgICAgICBmbigpXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBzYW5kYm94QnJpZGdlQ2xlYW51cFJlZi5jdXJyZW50LmRlbGV0ZShob3N0UGF0dGVybi5ob3N0KVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgLy8gUmVnaXN0ZXIgY2xlYW51cCBzbyB0aGUgbG9jYWwgZGlhbG9nIGhhbmRsZXIgY2FuIGNhbmNlbFxuICAgICAgICAgICAgLy8gdGhlIHJlbW90ZSBwcm9tcHQgYW5kIHVuc3Vic2NyaWJlIHdoZW4gdGhlIGxvY2FsIHVzZXJcbiAgICAgICAgICAgIC8vIHJlc3BvbmRzIGZpcnN0LlxuICAgICAgICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgdW5zdWJzY3JpYmUoKVxuICAgICAgICAgICAgICBicmlkZ2VDYWxsYmFja3MuY2FuY2VsUmVxdWVzdChicmlkZ2VSZXF1ZXN0SWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBleGlzdGluZyA9XG4gICAgICAgICAgICAgIHNhbmRib3hCcmlkZ2VDbGVhbnVwUmVmLmN1cnJlbnQuZ2V0KGhvc3RQYXR0ZXJuLmhvc3QpID8/IFtdXG4gICAgICAgICAgICBleGlzdGluZy5wdXNoKGNsZWFudXApXG4gICAgICAgICAgICBzYW5kYm94QnJpZGdlQ2xlYW51cFJlZi5jdXJyZW50LnNldChob3N0UGF0dGVybi5ob3N0LCBleGlzdGluZylcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSxcbiAgICBbc2V0QXBwU3RhdGUsIHN0b3JlXSxcbiAgKVxuXG4gIC8vICMzNDA0NDogaWYgdXNlciBleHBsaWNpdGx5IHNldCBzYW5kYm94LmVuYWJsZWQ9dHJ1ZSBidXQgZGVwcyBhcmUgbWlzc2luZyxcbiAgLy8gaXNTYW5kYm94aW5nRW5hYmxlZCgpIHJldHVybnMgZmFsc2Ugc2lsZW50bHkuIFN1cmZhY2UgdGhlIHJlYXNvbiBvbmNlIGF0XG4gIC8vIG1vdW50IHNvIHVzZXJzIGtub3cgdGhlaXIgc2VjdXJpdHkgY29uZmlnIGlzbid0IGJlaW5nIGVuZm9yY2VkLiBGdWxsXG4gIC8vIHJlYXNvbiBnb2VzIHRvIGRlYnVnIGxvZzsgbm90aWZpY2F0aW9uIHBvaW50cyB0byAvc2FuZGJveCBmb3IgZGV0YWlscy5cbiAgLy8gYWRkTm90aWZpY2F0aW9uIGlzIHN0YWJsZSAodXNlQ2FsbGJhY2spIHNvIHRoZSBlZmZlY3QgZmlyZXMgb25jZS5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCByZWFzb24gPSBTYW5kYm94TWFuYWdlci5nZXRTYW5kYm94VW5hdmFpbGFibGVSZWFzb24oKVxuICAgIGlmICghcmVhc29uKSByZXR1cm5cbiAgICBpZiAoU2FuZGJveE1hbmFnZXIuaXNTYW5kYm94UmVxdWlyZWQoKSkge1xuICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoXG4gICAgICAgIGBcXG5FcnJvcjogc2FuZGJveCByZXF1aXJlZCBidXQgdW5hdmFpbGFibGU6ICR7cmVhc29ufVxcbmAgK1xuICAgICAgICAgIGAgIHNhbmRib3guZmFpbElmVW5hdmFpbGFibGUgaXMgc2V0IOKAlCByZWZ1c2luZyB0byBzdGFydCB3aXRob3V0IGEgd29ya2luZyBzYW5kYm94LlxcblxcbmAsXG4gICAgICApXG4gICAgICBncmFjZWZ1bFNodXRkb3duU3luYygxLCAnb3RoZXInKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGxvZ0ZvckRlYnVnZ2luZyhgc2FuZGJveCBkaXNhYmxlZDogJHtyZWFzb259YCwgeyBsZXZlbDogJ3dhcm4nIH0pXG4gICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgIGtleTogJ3NhbmRib3gtdW5hdmFpbGFibGUnLFxuICAgICAganN4OiAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJ3YXJuaW5nXCI+c2FuZGJveCBkaXNhYmxlZDwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4gwrcgL3NhbmRib3g8L1RleHQ+XG4gICAgICAgIDwvPlxuICAgICAgKSxcbiAgICAgIHByaW9yaXR5OiAnbWVkaXVtJyxcbiAgICB9KVxuICB9LCBbYWRkTm90aWZpY2F0aW9uXSlcblxuICBpZiAoU2FuZGJveE1hbmFnZXIuaXNTYW5kYm94aW5nRW5hYmxlZCgpKSB7XG4gICAgLy8gSWYgc2FuZGJveGluZyBpcyBlbmFibGVkIChzZXR0aW5nLnNhbmRib3ggaXMgZGVmaW5lZCwgaW5pdGlhbGlzZSB0aGUgbWFuYWdlcilcbiAgICBTYW5kYm94TWFuYWdlci5pbml0aWFsaXplKHNhbmRib3hBc2tDYWxsYmFjaykuY2F0Y2goZXJyID0+IHtcbiAgICAgIC8vIEluaXRpYWxpemF0aW9uL3ZhbGlkYXRpb24gZmFpbGVkIC0gZGlzcGxheSBlcnJvciBhbmQgZXhpdFxuICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoYFxcbuKdjCBTYW5kYm94IEVycm9yOiAke2Vycm9yTWVzc2FnZShlcnIpfVxcbmApXG4gICAgICBncmFjZWZ1bFNodXRkb3duU3luYygxLCAnb3RoZXInKVxuICAgIH0pXG4gIH1cblxuICBjb25zdCBzZXRUb29sUGVybWlzc2lvbkNvbnRleHQgPSB1c2VDYWxsYmFjayhcbiAgICAoY29udGV4dDogVG9vbFBlcm1pc3Npb25Db250ZXh0LCBvcHRpb25zPzogeyBwcmVzZXJ2ZU1vZGU/OiBib29sZWFuIH0pID0+IHtcbiAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiB7XG4gICAgICAgICAgLi4uY29udGV4dCxcbiAgICAgICAgICAvLyBQcmVzZXJ2ZSB0aGUgY29vcmRpbmF0b3IncyBtb2RlIG9ubHkgd2hlbiBleHBsaWNpdGx5IHJlcXVlc3RlZC5cbiAgICAgICAgICAvLyBXb3JrZXJzJyBnZXRBcHBTdGF0ZSgpIHJldHVybnMgYSB0cmFuc2Zvcm1lZCBjb250ZXh0IHdpdGggbW9kZVxuICAgICAgICAgIC8vICdhY2NlcHRFZGl0cycgdGhhdCBtdXN0IG5vdCBsZWFrIGludG8gdGhlIGNvb3JkaW5hdG9yJ3MgYWN0dWFsXG4gICAgICAgICAgLy8gc3RhdGUgdmlhIHBlcm1pc3Npb24tcnVsZSB1cGRhdGVzIOKAlCB0aG9zZSBjYWxsIHNpdGVzIHBhc3NcbiAgICAgICAgICAvLyB7IHByZXNlcnZlTW9kZTogdHJ1ZSB9LiBVc2VyLWluaXRpYXRlZCBtb2RlIGNoYW5nZXMgKGUuZy4sXG4gICAgICAgICAgLy8gc2VsZWN0aW5nIFwiYWxsb3cgYWxsIGVkaXRzXCIpIG11c3QgTk9UIGJlIG92ZXJyaWRkZW4uXG4gICAgICAgICAgbW9kZTogb3B0aW9ucz8ucHJlc2VydmVNb2RlXG4gICAgICAgICAgICA/IHByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0Lm1vZGVcbiAgICAgICAgICAgIDogY29udGV4dC5tb2RlLFxuICAgICAgICB9LFxuICAgICAgfSkpXG5cbiAgICAgIC8vIFdoZW4gcGVybWlzc2lvbiBjb250ZXh0IGNoYW5nZXMsIHJlY2hlY2sgYWxsIHF1ZXVlZCBpdGVtc1xuICAgICAgLy8gVGhpcyBoYW5kbGVzIHRoZSBjYXNlIHdoZXJlIGFwcHJvdmluZyBpdGVtMSB3aXRoIFwiZG9uJ3QgYXNrIGFnYWluXCJcbiAgICAgIC8vIHNob3VsZCBhdXRvLWFwcHJvdmUgb3RoZXIgcXVldWVkIGl0ZW1zIHRoYXQgbm93IG1hdGNoIHRoZSB1cGRhdGVkIHJ1bGVzXG4gICAgICBzZXRJbW1lZGlhdGUoc2V0VG9vbFVzZUNvbmZpcm1RdWV1ZSA9PiB7XG4gICAgICAgIC8vIFVzZSBzZXRUb29sVXNlQ29uZmlybVF1ZXVlIGNhbGxiYWNrIHRvIGdldCBjdXJyZW50IHF1ZXVlIHN0YXRlXG4gICAgICAgIC8vIGluc3RlYWQgb2YgY2FwdHVyaW5nIGl0IGluIHRoZSBjbG9zdXJlLCB0byBhdm9pZCBzdGFsZSBjbG9zdXJlIGlzc3Vlc1xuICAgICAgICBzZXRUb29sVXNlQ29uZmlybVF1ZXVlKGN1cnJlbnRRdWV1ZSA9PiB7XG4gICAgICAgICAgY3VycmVudFF1ZXVlLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICAgICAgICB2b2lkIGl0ZW0ucmVjaGVja1Blcm1pc3Npb24oKVxuICAgICAgICAgIH0pXG4gICAgICAgICAgcmV0dXJuIGN1cnJlbnRRdWV1ZVxuICAgICAgICB9KVxuICAgICAgfSwgc2V0VG9vbFVzZUNvbmZpcm1RdWV1ZSlcbiAgICB9LFxuICAgIFtzZXRBcHBTdGF0ZSwgc2V0VG9vbFVzZUNvbmZpcm1RdWV1ZV0sXG4gIClcblxuICAvLyBSZWdpc3RlciB0aGUgbGVhZGVyJ3Mgc2V0VG9vbFBlcm1pc3Npb25Db250ZXh0IGZvciBpbi1wcm9jZXNzIHRlYW1tYXRlc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHJlZ2lzdGVyTGVhZGVyU2V0VG9vbFBlcm1pc3Npb25Db250ZXh0KHNldFRvb2xQZXJtaXNzaW9uQ29udGV4dClcbiAgICByZXR1cm4gKCkgPT4gdW5yZWdpc3RlckxlYWRlclNldFRvb2xQZXJtaXNzaW9uQ29udGV4dCgpXG4gIH0sIFtzZXRUb29sUGVybWlzc2lvbkNvbnRleHRdKVxuXG4gIGNvbnN0IGNhblVzZVRvb2wgPSB1c2VDYW5Vc2VUb29sKFxuICAgIHNldFRvb2xVc2VDb25maXJtUXVldWUsXG4gICAgc2V0VG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICApXG5cbiAgY29uc3QgcmVxdWVzdFByb21wdCA9IHVzZUNhbGxiYWNrKFxuICAgICh0aXRsZTogc3RyaW5nLCB0b29sSW5wdXRTdW1tYXJ5Pzogc3RyaW5nIHwgbnVsbCkgPT5cbiAgICAgIChyZXF1ZXN0OiBQcm9tcHRSZXF1ZXN0KTogUHJvbWlzZTxQcm9tcHRSZXNwb25zZT4gPT5cbiAgICAgICAgbmV3IFByb21pc2U8UHJvbXB0UmVzcG9uc2U+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBzZXRQcm9tcHRRdWV1ZShwcmV2ID0+IFtcbiAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICB7IHJlcXVlc3QsIHRpdGxlLCB0b29sSW5wdXRTdW1tYXJ5LCByZXNvbHZlLCByZWplY3QgfSxcbiAgICAgICAgICBdKVxuICAgICAgICB9KSxcbiAgICBbXSxcbiAgKVxuXG4gIGNvbnN0IGdldFRvb2xVc2VDb250ZXh0ID0gdXNlQ2FsbGJhY2soXG4gICAgKFxuICAgICAgbWVzc2FnZXM6IE1lc3NhZ2VUeXBlW10sXG4gICAgICBuZXdNZXNzYWdlczogTWVzc2FnZVR5cGVbXSxcbiAgICAgIGFib3J0Q29udHJvbGxlcjogQWJvcnRDb250cm9sbGVyLFxuICAgICAgbWFpbkxvb3BNb2RlbDogc3RyaW5nLFxuICAgICk6IFByb2Nlc3NVc2VySW5wdXRDb250ZXh0ID0+IHtcbiAgICAgIC8vIFJlYWQgbXV0YWJsZSB2YWx1ZXMgZnJlc2ggZnJvbSB0aGUgc3RvcmUgcmF0aGVyIHRoYW4gY2xvc3VyZS1jYXB0dXJpbmdcbiAgICAgIC8vIHVzZUFwcFN0YXRlKCkgc25hcHNob3RzLiBTYW1lIHZhbHVlcyB0b2RheSAoY2xvc3VyZSBpcyByZWZyZXNoZWQgYnkgdGhlXG4gICAgICAvLyByZW5kZXIgYmV0d2VlbiB0dXJucyk7IGRlY291cGxlcyBmcmVzaG5lc3MgZnJvbSBSZWFjdCdzIHJlbmRlciBjeWNsZSBmb3JcbiAgICAgIC8vIGEgZnV0dXJlIGhlYWRsZXNzIGNvbnZlcnNhdGlvbiBsb29wLiBTYW1lIHBhdHRlcm4gcmVmcmVzaFRvb2xzKCkgdXNlcy5cbiAgICAgIGNvbnN0IHMgPSBzdG9yZS5nZXRTdGF0ZSgpXG5cbiAgICAgIC8vIENvbXB1dGUgdG9vbHMgZnJlc2ggZnJvbSBzdG9yZS5nZXRTdGF0ZSgpIHJhdGhlciB0aGFuIHRoZSBjbG9zdXJlLVxuICAgICAgLy8gY2FwdHVyZWQgYHRvb2xzYC4gdXNlTWFuYWdlTUNQQ29ubmVjdGlvbnMgcG9wdWxhdGVzIGFwcFN0YXRlLm1jcFxuICAgICAgLy8gYXN5bmMgYXMgc2VydmVycyBjb25uZWN0IOKAlCB0aGUgc3RvcmUgbWF5IGhhdmUgbmV3ZXIgTUNQIHN0YXRlIHRoYW5cbiAgICAgIC8vIHRoZSBjbG9zdXJlIGNhcHR1cmVkIGF0IHJlbmRlciB0aW1lLiBBbHNvIGRvdWJsZXMgYXMgcmVmcmVzaFRvb2xzKClcbiAgICAgIC8vIGZvciBtaWQtcXVlcnkgdG9vbCBsaXN0IHVwZGF0ZXMuXG4gICAgICBjb25zdCBjb21wdXRlVG9vbHMgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3RvcmUuZ2V0U3RhdGUoKVxuICAgICAgICBjb25zdCBhc3NlbWJsZWQgPSBhc3NlbWJsZVRvb2xQb29sKFxuICAgICAgICAgIHN0YXRlLnRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgICAgICBzdGF0ZS5tY3AudG9vbHMsXG4gICAgICAgIClcbiAgICAgICAgY29uc3QgbWVyZ2VkID0gbWVyZ2VBbmRGaWx0ZXJUb29scyhcbiAgICAgICAgICBjb21iaW5lZEluaXRpYWxUb29scyxcbiAgICAgICAgICBhc3NlbWJsZWQsXG4gICAgICAgICAgc3RhdGUudG9vbFBlcm1pc3Npb25Db250ZXh0Lm1vZGUsXG4gICAgICAgIClcbiAgICAgICAgaWYgKCFtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uKSByZXR1cm4gbWVyZ2VkXG4gICAgICAgIHJldHVybiByZXNvbHZlQWdlbnRUb29scyhtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLCBtZXJnZWQsIGZhbHNlLCB0cnVlKVxuICAgICAgICAgIC5yZXNvbHZlZFRvb2xzXG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFib3J0Q29udHJvbGxlcixcbiAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgIGNvbW1hbmRzLFxuICAgICAgICAgIHRvb2xzOiBjb21wdXRlVG9vbHMoKSxcbiAgICAgICAgICBkZWJ1ZyxcbiAgICAgICAgICB2ZXJib3NlOiBzLnZlcmJvc2UsXG4gICAgICAgICAgbWFpbkxvb3BNb2RlbCxcbiAgICAgICAgICB0aGlua2luZ0NvbmZpZzpcbiAgICAgICAgICAgIHMudGhpbmtpbmdFbmFibGVkICE9PSBmYWxzZSA/IHRoaW5raW5nQ29uZmlnIDogeyB0eXBlOiAnZGlzYWJsZWQnIH0sXG4gICAgICAgICAgLy8gTWVyZ2UgZnJlc2ggZnJvbSBzdG9yZSByYXRoZXIgdGhhbiBjbG9zaW5nIG92ZXIgdXNlTWVyZ2VkQ2xpZW50cydcbiAgICAgICAgICAvLyBtZW1vaXplZCBvdXRwdXQuIGluaXRpYWxNY3BDbGllbnRzIGlzIGEgcHJvcCAoc2Vzc2lvbi1jb25zdGFudCkuXG4gICAgICAgICAgbWNwQ2xpZW50czogbWVyZ2VDbGllbnRzKGluaXRpYWxNY3BDbGllbnRzLCBzLm1jcC5jbGllbnRzKSxcbiAgICAgICAgICBtY3BSZXNvdXJjZXM6IHMubWNwLnJlc291cmNlcyxcbiAgICAgICAgICBpZGVJbnN0YWxsYXRpb25TdGF0dXM6IGlkZUluc3RhbGxhdGlvblN0YXR1cyxcbiAgICAgICAgICBpc05vbkludGVyYWN0aXZlU2Vzc2lvbjogZmFsc2UsXG4gICAgICAgICAgZHluYW1pY01jcENvbmZpZyxcbiAgICAgICAgICB0aGVtZSxcbiAgICAgICAgICBhZ2VudERlZmluaXRpb25zOiBhbGxvd2VkQWdlbnRUeXBlc1xuICAgICAgICAgICAgPyB7IC4uLnMuYWdlbnREZWZpbml0aW9ucywgYWxsb3dlZEFnZW50VHlwZXMgfVxuICAgICAgICAgICAgOiBzLmFnZW50RGVmaW5pdGlvbnMsXG4gICAgICAgICAgY3VzdG9tU3lzdGVtUHJvbXB0LFxuICAgICAgICAgIGFwcGVuZFN5c3RlbVByb21wdCxcbiAgICAgICAgICByZWZyZXNoVG9vbHM6IGNvbXB1dGVUb29scyxcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0QXBwU3RhdGU6ICgpID0+IHN0b3JlLmdldFN0YXRlKCksXG4gICAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgICBtZXNzYWdlcyxcbiAgICAgICAgc2V0TWVzc2FnZXMsXG4gICAgICAgIHVwZGF0ZUZpbGVIaXN0b3J5U3RhdGUoXG4gICAgICAgICAgdXBkYXRlcjogKHByZXY6IEZpbGVIaXN0b3J5U3RhdGUpID0+IEZpbGVIaXN0b3J5U3RhdGUsXG4gICAgICAgICkge1xuICAgICAgICAgIC8vIFBlcmY6IHNraXAgdGhlIHNldFN0YXRlIHdoZW4gdGhlIHVwZGF0ZXIgcmV0dXJucyB0aGUgc2FtZSByZWZlcmVuY2VcbiAgICAgICAgICAvLyAoZS5nLiBmaWxlSGlzdG9yeVRyYWNrRWRpdCByZXR1cm5zIGBzdGF0ZWAgd2hlbiB0aGUgZmlsZSBpcyBhbHJlYWR5XG4gICAgICAgICAgLy8gdHJhY2tlZCkuIE90aGVyd2lzZSBldmVyeSBuby1vcCBjYWxsIHdvdWxkIG5vdGlmeSBhbGwgc3RvcmUgbGlzdGVuZXJzLlxuICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgY29uc3QgdXBkYXRlZCA9IHVwZGF0ZXIocHJldi5maWxlSGlzdG9yeSlcbiAgICAgICAgICAgIGlmICh1cGRhdGVkID09PSBwcmV2LmZpbGVIaXN0b3J5KSByZXR1cm4gcHJldlxuICAgICAgICAgICAgcmV0dXJuIHsgLi4ucHJldiwgZmlsZUhpc3Rvcnk6IHVwZGF0ZWQgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH0sXG4gICAgICAgIHVwZGF0ZUF0dHJpYnV0aW9uU3RhdGUoXG4gICAgICAgICAgdXBkYXRlcjogKHByZXY6IEF0dHJpYnV0aW9uU3RhdGUpID0+IEF0dHJpYnV0aW9uU3RhdGUsXG4gICAgICAgICkge1xuICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgY29uc3QgdXBkYXRlZCA9IHVwZGF0ZXIocHJldi5hdHRyaWJ1dGlvbilcbiAgICAgICAgICAgIGlmICh1cGRhdGVkID09PSBwcmV2LmF0dHJpYnV0aW9uKSByZXR1cm4gcHJldlxuICAgICAgICAgICAgcmV0dXJuIHsgLi4ucHJldiwgYXR0cmlidXRpb246IHVwZGF0ZWQgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH0sXG4gICAgICAgIG9wZW5NZXNzYWdlU2VsZWN0b3I6ICgpID0+IHtcbiAgICAgICAgICBpZiAoIWRpc2FibGVkKSB7XG4gICAgICAgICAgICBzZXRJc01lc3NhZ2VTZWxlY3RvclZpc2libGUodHJ1ZSlcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIG9uQ2hhbmdlQVBJS2V5OiByZXZlcmlmeSxcbiAgICAgICAgcmVhZEZpbGVTdGF0ZTogcmVhZEZpbGVTdGF0ZS5jdXJyZW50LFxuICAgICAgICBzZXRUb29sSlNYLFxuICAgICAgICBhZGROb3RpZmljYXRpb24sXG4gICAgICAgIGFwcGVuZFN5c3RlbU1lc3NhZ2U6IG1zZyA9PiBzZXRNZXNzYWdlcyhwcmV2ID0+IFsuLi5wcmV2LCBtc2ddKSxcbiAgICAgICAgc2VuZE9TTm90aWZpY2F0aW9uOiBvcHRzID0+IHtcbiAgICAgICAgICB2b2lkIHNlbmROb3RpZmljYXRpb24ob3B0cywgdGVybWluYWwpXG4gICAgICAgIH0sXG4gICAgICAgIG9uQ2hhbmdlRHluYW1pY01jcENvbmZpZyxcbiAgICAgICAgb25JbnN0YWxsSURFRXh0ZW5zaW9uOiBzZXRJREVUb0luc3RhbGxFeHRlbnNpb24sXG4gICAgICAgIG5lc3RlZE1lbW9yeUF0dGFjaG1lbnRUcmlnZ2VyczogbmV3IFNldDxzdHJpbmc+KCksXG4gICAgICAgIGxvYWRlZE5lc3RlZE1lbW9yeVBhdGhzOiBsb2FkZWROZXN0ZWRNZW1vcnlQYXRoc1JlZi5jdXJyZW50LFxuICAgICAgICBkeW5hbWljU2tpbGxEaXJUcmlnZ2VyczogbmV3IFNldDxzdHJpbmc+KCksXG4gICAgICAgIGRpc2NvdmVyZWRTa2lsbE5hbWVzOiBkaXNjb3ZlcmVkU2tpbGxOYW1lc1JlZi5jdXJyZW50LFxuICAgICAgICBzZXRSZXNwb25zZUxlbmd0aCxcbiAgICAgICAgcHVzaEFwaU1ldHJpY3NFbnRyeTpcbiAgICAgICAgICBcImV4dGVybmFsXCIgPT09ICdhbnQnXG4gICAgICAgICAgICA/ICh0dGZ0TXM6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KClcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlbGluZSA9IHJlc3BvbnNlTGVuZ3RoUmVmLmN1cnJlbnRcbiAgICAgICAgICAgICAgICBhcGlNZXRyaWNzUmVmLmN1cnJlbnQucHVzaCh7XG4gICAgICAgICAgICAgICAgICB0dGZ0TXMsXG4gICAgICAgICAgICAgICAgICBmaXJzdFRva2VuVGltZTogbm93LFxuICAgICAgICAgICAgICAgICAgbGFzdFRva2VuVGltZTogbm93LFxuICAgICAgICAgICAgICAgICAgcmVzcG9uc2VMZW5ndGhCYXNlbGluZTogYmFzZWxpbmUsXG4gICAgICAgICAgICAgICAgICBlbmRSZXNwb25zZUxlbmd0aDogYmFzZWxpbmUsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgIHNldFN0cmVhbU1vZGUsXG4gICAgICAgIG9uQ29tcGFjdFByb2dyZXNzOiBldmVudCA9PiB7XG4gICAgICAgICAgc3dpdGNoIChldmVudC50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdob29rc19zdGFydCc6XG4gICAgICAgICAgICAgIHNldFNwaW5uZXJDb2xvcignY2xhdWRlQmx1ZV9GT1JfU1lTVEVNX1NQSU5ORVInKVxuICAgICAgICAgICAgICBzZXRTcGlubmVyU2hpbW1lckNvbG9yKCdjbGF1ZGVCbHVlU2hpbW1lcl9GT1JfU1lTVEVNX1NQSU5ORVInKVxuICAgICAgICAgICAgICBzZXRTcGlubmVyTWVzc2FnZShcbiAgICAgICAgICAgICAgICBldmVudC5ob29rVHlwZSA9PT0gJ3ByZV9jb21wYWN0J1xuICAgICAgICAgICAgICAgICAgPyAnUnVubmluZyBQcmVDb21wYWN0IGhvb2tzXFx1MjAyNidcbiAgICAgICAgICAgICAgICAgIDogZXZlbnQuaG9va1R5cGUgPT09ICdwb3N0X2NvbXBhY3QnXG4gICAgICAgICAgICAgICAgICAgID8gJ1J1bm5pbmcgUG9zdENvbXBhY3QgaG9va3NcXHUyMDI2J1xuICAgICAgICAgICAgICAgICAgICA6ICdSdW5uaW5nIFNlc3Npb25TdGFydCBob29rc1xcdTIwMjYnLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICBjYXNlICdjb21wYWN0X3N0YXJ0JzpcbiAgICAgICAgICAgICAgc2V0U3Bpbm5lck1lc3NhZ2UoJ0NvbXBhY3RpbmcgY29udmVyc2F0aW9uJylcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgIGNhc2UgJ2NvbXBhY3RfZW5kJzpcbiAgICAgICAgICAgICAgc2V0U3Bpbm5lck1lc3NhZ2UobnVsbClcbiAgICAgICAgICAgICAgc2V0U3Bpbm5lckNvbG9yKG51bGwpXG4gICAgICAgICAgICAgIHNldFNwaW5uZXJTaGltbWVyQ29sb3IobnVsbClcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHNldEluUHJvZ3Jlc3NUb29sVXNlSURzLFxuICAgICAgICBzZXRIYXNJbnRlcnJ1cHRpYmxlVG9vbEluUHJvZ3Jlc3M6ICh2OiBib29sZWFuKSA9PiB7XG4gICAgICAgICAgaGFzSW50ZXJydXB0aWJsZVRvb2xJblByb2dyZXNzUmVmLmN1cnJlbnQgPSB2XG4gICAgICAgIH0sXG4gICAgICAgIHJlc3VtZSxcbiAgICAgICAgc2V0Q29udmVyc2F0aW9uSWQsXG4gICAgICAgIHJlcXVlc3RQcm9tcHQ6IGZlYXR1cmUoJ0hPT0tfUFJPTVBUUycpID8gcmVxdWVzdFByb21wdCA6IHVuZGVmaW5lZCxcbiAgICAgICAgY29udGVudFJlcGxhY2VtZW50U3RhdGU6IGNvbnRlbnRSZXBsYWNlbWVudFN0YXRlUmVmLmN1cnJlbnQsXG4gICAgICB9XG4gICAgfSxcbiAgICBbXG4gICAgICBjb21tYW5kcyxcbiAgICAgIGNvbWJpbmVkSW5pdGlhbFRvb2xzLFxuICAgICAgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbixcbiAgICAgIGRlYnVnLFxuICAgICAgaW5pdGlhbE1jcENsaWVudHMsXG4gICAgICBpZGVJbnN0YWxsYXRpb25TdGF0dXMsXG4gICAgICBkeW5hbWljTWNwQ29uZmlnLFxuICAgICAgdGhlbWUsXG4gICAgICBhbGxvd2VkQWdlbnRUeXBlcyxcbiAgICAgIHN0b3JlLFxuICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICByZXZlcmlmeSxcbiAgICAgIGFkZE5vdGlmaWNhdGlvbixcbiAgICAgIHNldE1lc3NhZ2VzLFxuICAgICAgb25DaGFuZ2VEeW5hbWljTWNwQ29uZmlnLFxuICAgICAgcmVzdW1lLFxuICAgICAgcmVxdWVzdFByb21wdCxcbiAgICAgIGRpc2FibGVkLFxuICAgICAgY3VzdG9tU3lzdGVtUHJvbXB0LFxuICAgICAgYXBwZW5kU3lzdGVtUHJvbXB0LFxuICAgICAgc2V0Q29udmVyc2F0aW9uSWQsXG4gICAgXSxcbiAgKVxuXG4gIC8vIFNlc3Npb24gYmFja2dyb3VuZGluZyAoQ3RybCtCIHRvIGJhY2tncm91bmQvZm9yZWdyb3VuZClcbiAgY29uc3QgaGFuZGxlQmFja2dyb3VuZFF1ZXJ5ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIC8vIFN0b3AgdGhlIGZvcmVncm91bmQgcXVlcnkgc28gdGhlIGJhY2tncm91bmQgb25lIHRha2VzIG92ZXJcbiAgICBhYm9ydENvbnRyb2xsZXI/LmFib3J0KCdiYWNrZ3JvdW5kJylcbiAgICAvLyBBYm9ydGluZyBzdWJhZ2VudHMgbWF5IHByb2R1Y2UgdGFzay1jb21wbGV0ZWQgbm90aWZpY2F0aW9ucy5cbiAgICAvLyBDbGVhciB0YXNrIG5vdGlmaWNhdGlvbnMgc28gdGhlIHF1ZXVlIHByb2Nlc3NvciBkb2Vzbid0IGltbWVkaWF0ZWx5XG4gICAgLy8gc3RhcnQgYSBuZXcgZm9yZWdyb3VuZCBxdWVyeTsgZm9yd2FyZCB0aGVtIHRvIHRoZSBiYWNrZ3JvdW5kIHNlc3Npb24uXG4gICAgY29uc3QgcmVtb3ZlZE5vdGlmaWNhdGlvbnMgPSByZW1vdmVCeUZpbHRlcihcbiAgICAgIGNtZCA9PiBjbWQubW9kZSA9PT0gJ3Rhc2stbm90aWZpY2F0aW9uJyxcbiAgICApXG5cbiAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCB0b29sVXNlQ29udGV4dCA9IGdldFRvb2xVc2VDb250ZXh0KFxuICAgICAgICBtZXNzYWdlc1JlZi5jdXJyZW50LFxuICAgICAgICBbXSxcbiAgICAgICAgbmV3IEFib3J0Q29udHJvbGxlcigpLFxuICAgICAgICBtYWluTG9vcE1vZGVsLFxuICAgICAgKVxuXG4gICAgICBjb25zdCBbZGVmYXVsdFN5c3RlbVByb21wdCwgdXNlckNvbnRleHQsIHN5c3RlbUNvbnRleHRdID1cbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICAgIGdldFN5c3RlbVByb21wdChcbiAgICAgICAgICAgIHRvb2xVc2VDb250ZXh0Lm9wdGlvbnMudG9vbHMsXG4gICAgICAgICAgICBtYWluTG9vcE1vZGVsLFxuICAgICAgICAgICAgQXJyYXkuZnJvbShcbiAgICAgICAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0LmFkZGl0aW9uYWxXb3JraW5nRGlyZWN0b3JpZXMua2V5cygpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHRvb2xVc2VDb250ZXh0Lm9wdGlvbnMubWNwQ2xpZW50cyxcbiAgICAgICAgICApLFxuICAgICAgICAgIGdldFVzZXJDb250ZXh0KCksXG4gICAgICAgICAgZ2V0U3lzdGVtQ29udGV4dCgpLFxuICAgICAgICBdKVxuXG4gICAgICBjb25zdCBzeXN0ZW1Qcm9tcHQgPSBidWlsZEVmZmVjdGl2ZVN5c3RlbVByb21wdCh7XG4gICAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gICAgICAgIHRvb2xVc2VDb250ZXh0LFxuICAgICAgICBjdXN0b21TeXN0ZW1Qcm9tcHQsXG4gICAgICAgIGRlZmF1bHRTeXN0ZW1Qcm9tcHQsXG4gICAgICAgIGFwcGVuZFN5c3RlbVByb21wdCxcbiAgICAgIH0pXG4gICAgICB0b29sVXNlQ29udGV4dC5yZW5kZXJlZFN5c3RlbVByb21wdCA9IHN5c3RlbVByb21wdFxuXG4gICAgICBjb25zdCBub3RpZmljYXRpb25BdHRhY2htZW50cyA9IGF3YWl0IGdldFF1ZXVlZENvbW1hbmRBdHRhY2htZW50cyhcbiAgICAgICAgcmVtb3ZlZE5vdGlmaWNhdGlvbnMsXG4gICAgICApLmNhdGNoKCgpID0+IFtdKVxuICAgICAgY29uc3Qgbm90aWZpY2F0aW9uTWVzc2FnZXMgPSBub3RpZmljYXRpb25BdHRhY2htZW50cy5tYXAoXG4gICAgICAgIGNyZWF0ZUF0dGFjaG1lbnRNZXNzYWdlLFxuICAgICAgKVxuXG4gICAgICAvLyBEZWR1cGxpY2F0ZTogaWYgdGhlIHF1ZXJ5IGxvb3AgYWxyZWFkeSB5aWVsZGVkIGEgbm90aWZpY2F0aW9uIGludG9cbiAgICAgIC8vIG1lc3NhZ2VzUmVmIGJlZm9yZSB3ZSByZW1vdmVkIGl0IGZyb20gdGhlIHF1ZXVlLCBza2lwIGR1cGxpY2F0ZXMuXG4gICAgICAvLyBXZSB1c2UgcHJvbXB0IHRleHQgZm9yIGRlZHVwIGJlY2F1c2Ugc291cmNlX3V1aWQgaXMgbm90IHNldCBvblxuICAgICAgLy8gdGFzay1ub3RpZmljYXRpb24gUXVldWVkQ29tbWFuZHMgKGVucXVldWVQZW5kaW5nTm90aWZpY2F0aW9uIGNhbGxlcnNcbiAgICAgIC8vIGRvbid0IHBhc3MgdXVpZCksIHNvIGl0IHdvdWxkIGFsd2F5cyBiZSB1bmRlZmluZWQuXG4gICAgICBjb25zdCBleGlzdGluZ1Byb21wdHMgPSBuZXcgU2V0PHN0cmluZz4oKVxuICAgICAgZm9yIChjb25zdCBtIG9mIG1lc3NhZ2VzUmVmLmN1cnJlbnQpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIG0udHlwZSA9PT0gJ2F0dGFjaG1lbnQnICYmXG4gICAgICAgICAgbS5hdHRhY2htZW50LnR5cGUgPT09ICdxdWV1ZWRfY29tbWFuZCcgJiZcbiAgICAgICAgICBtLmF0dGFjaG1lbnQuY29tbWFuZE1vZGUgPT09ICd0YXNrLW5vdGlmaWNhdGlvbicgJiZcbiAgICAgICAgICB0eXBlb2YgbS5hdHRhY2htZW50LnByb21wdCA9PT0gJ3N0cmluZydcbiAgICAgICAgKSB7XG4gICAgICAgICAgZXhpc3RpbmdQcm9tcHRzLmFkZChtLmF0dGFjaG1lbnQucHJvbXB0KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCB1bmlxdWVOb3RpZmljYXRpb25zID0gbm90aWZpY2F0aW9uTWVzc2FnZXMuZmlsdGVyKFxuICAgICAgICBtID0+XG4gICAgICAgICAgbS5hdHRhY2htZW50LnR5cGUgPT09ICdxdWV1ZWRfY29tbWFuZCcgJiZcbiAgICAgICAgICAodHlwZW9mIG0uYXR0YWNobWVudC5wcm9tcHQgIT09ICdzdHJpbmcnIHx8XG4gICAgICAgICAgICAhZXhpc3RpbmdQcm9tcHRzLmhhcyhtLmF0dGFjaG1lbnQucHJvbXB0KSksXG4gICAgICApXG5cbiAgICAgIHN0YXJ0QmFja2dyb3VuZFNlc3Npb24oe1xuICAgICAgICBtZXNzYWdlczogWy4uLm1lc3NhZ2VzUmVmLmN1cnJlbnQsIC4uLnVuaXF1ZU5vdGlmaWNhdGlvbnNdLFxuICAgICAgICBxdWVyeVBhcmFtczoge1xuICAgICAgICAgIHN5c3RlbVByb21wdCxcbiAgICAgICAgICB1c2VyQ29udGV4dCxcbiAgICAgICAgICBzeXN0ZW1Db250ZXh0LFxuICAgICAgICAgIGNhblVzZVRvb2wsXG4gICAgICAgICAgdG9vbFVzZUNvbnRleHQsXG4gICAgICAgICAgcXVlcnlTb3VyY2U6IGdldFF1ZXJ5U291cmNlRm9yUkVQTCgpLFxuICAgICAgICB9LFxuICAgICAgICBkZXNjcmlwdGlvbjogdGVybWluYWxUaXRsZSxcbiAgICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICAgIGFnZW50RGVmaW5pdGlvbjogbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbixcbiAgICAgIH0pXG4gICAgfSkoKVxuICB9LCBbXG4gICAgYWJvcnRDb250cm9sbGVyLFxuICAgIG1haW5Mb29wTW9kZWwsXG4gICAgdG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gICAgZ2V0VG9vbFVzZUNvbnRleHQsXG4gICAgY3VzdG9tU3lzdGVtUHJvbXB0LFxuICAgIGFwcGVuZFN5c3RlbVByb21wdCxcbiAgICBjYW5Vc2VUb29sLFxuICAgIHNldEFwcFN0YXRlLFxuICBdKVxuXG4gIGNvbnN0IHsgaGFuZGxlQmFja2dyb3VuZFNlc3Npb24gfSA9IHVzZVNlc3Npb25CYWNrZ3JvdW5kaW5nKHtcbiAgICBzZXRNZXNzYWdlcyxcbiAgICBzZXRJc0xvYWRpbmc6IHNldElzRXh0ZXJuYWxMb2FkaW5nLFxuICAgIHJlc2V0TG9hZGluZ1N0YXRlLFxuICAgIHNldEFib3J0Q29udHJvbGxlcixcbiAgICBvbkJhY2tncm91bmRRdWVyeTogaGFuZGxlQmFja2dyb3VuZFF1ZXJ5LFxuICB9KVxuXG4gIGNvbnN0IG9uUXVlcnlFdmVudCA9IHVzZUNhbGxiYWNrKFxuICAgIChldmVudDogUGFyYW1ldGVyczx0eXBlb2YgaGFuZGxlTWVzc2FnZUZyb21TdHJlYW0+WzBdKSA9PiB7XG4gICAgICBoYW5kbGVNZXNzYWdlRnJvbVN0cmVhbShcbiAgICAgICAgZXZlbnQsXG4gICAgICAgIG5ld01lc3NhZ2UgPT4ge1xuICAgICAgICAgIGlmIChpc0NvbXBhY3RCb3VuZGFyeU1lc3NhZ2UobmV3TWVzc2FnZSkpIHtcbiAgICAgICAgICAgIC8vIEZ1bGxzY3JlZW46IGtlZXAgcHJlLWNvbXBhY3QgbWVzc2FnZXMgZm9yIHNjcm9sbGJhY2suIHF1ZXJ5LnRzXG4gICAgICAgICAgICAvLyBzbGljZXMgYXQgdGhlIGJvdW5kYXJ5IGZvciBBUEkgY2FsbHMsIE1lc3NhZ2VzLnRzeCBza2lwcyB0aGVcbiAgICAgICAgICAgIC8vIGJvdW5kYXJ5IGZpbHRlciBpbiBmdWxsc2NyZWVuLCBhbmQgdXNlTG9nTWVzc2FnZXMgdHJlYXRzIHRoaXNcbiAgICAgICAgICAgIC8vIGFzIGFuIGluY3JlbWVudGFsIGFwcGVuZCAoZmlyc3QgdXVpZCB1bmNoYW5nZWQpLiBDYXAgYXQgb25lXG4gICAgICAgICAgICAvLyBjb21wYWN0LWludGVydmFsIG9mIHNjcm9sbGJhY2sg4oCUIG5vcm1hbGl6ZU1lc3NhZ2VzL2FwcGx5R3JvdXBpbmdcbiAgICAgICAgICAgIC8vIGFyZSBPKG4pIHBlciByZW5kZXIsIHNvIGRyb3AgZXZlcnl0aGluZyBiZWZvcmUgdGhlIHByZXZpb3VzXG4gICAgICAgICAgICAvLyBib3VuZGFyeSB0byBrZWVwIG4gYm91bmRlZCBhY3Jvc3MgbXVsdGktZGF5IHNlc3Npb25zLlxuICAgICAgICAgICAgaWYgKGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSkge1xuICAgICAgICAgICAgICBzZXRNZXNzYWdlcyhvbGQgPT4gW1xuICAgICAgICAgICAgICAgIC4uLmdldE1lc3NhZ2VzQWZ0ZXJDb21wYWN0Qm91bmRhcnkob2xkLCB7XG4gICAgICAgICAgICAgICAgICBpbmNsdWRlU25pcHBlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBuZXdNZXNzYWdlLFxuICAgICAgICAgICAgICBdKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc2V0TWVzc2FnZXMoKCkgPT4gW25ld01lc3NhZ2VdKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQnVtcCBjb252ZXJzYXRpb25JZCBzbyBNZXNzYWdlcy50c3ggcm93IGtleXMgY2hhbmdlIGFuZFxuICAgICAgICAgICAgLy8gc3RhbGUgbWVtb2l6ZWQgcm93cyByZW1vdW50IHdpdGggcG9zdC1jb21wYWN0IGNvbnRlbnQuXG4gICAgICAgICAgICBzZXRDb252ZXJzYXRpb25JZChyYW5kb21VVUlEKCkpXG4gICAgICAgICAgICAvLyBDb21wYWN0aW9uIHN1Y2NlZWRlZCDigJQgY2xlYXIgdGhlIGNvbnRleHQtYmxvY2tlZCBmbGFnIHNvIHRpY2tzIHJlc3VtZVxuICAgICAgICAgICAgaWYgKGZlYXR1cmUoJ1BST0FDVElWRScpIHx8IGZlYXR1cmUoJ0tBSVJPUycpKSB7XG4gICAgICAgICAgICAgIHByb2FjdGl2ZU1vZHVsZT8uc2V0Q29udGV4dEJsb2NrZWQoZmFsc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgIG5ld01lc3NhZ2UudHlwZSA9PT0gJ3Byb2dyZXNzJyAmJlxuICAgICAgICAgICAgaXNFcGhlbWVyYWxUb29sUHJvZ3Jlc3MobmV3TWVzc2FnZS5kYXRhLnR5cGUpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBSZXBsYWNlIHRoZSBwcmV2aW91cyBlcGhlbWVyYWwgcHJvZ3Jlc3MgdGljayBmb3IgdGhlIHNhbWUgdG9vbFxuICAgICAgICAgICAgLy8gY2FsbCBpbnN0ZWFkIG9mIGFwcGVuZGluZy4gU2xlZXAvQmFzaCBlbWl0IGEgdGljayBwZXIgc2Vjb25kIGFuZFxuICAgICAgICAgICAgLy8gb25seSB0aGUgbGFzdCBvbmUgaXMgcmVuZGVyZWQ7IGFwcGVuZGluZyBibG93cyB1cCB0aGUgbWVzc2FnZXNcbiAgICAgICAgICAgIC8vIGFycmF5ICgxM2srIG9ic2VydmVkKSBhbmQgdGhlIHRyYW5zY3JpcHQgKDEyME1CIG9mIHNsZWVwX3Byb2dyZXNzXG4gICAgICAgICAgICAvLyBsaW5lcykuIHVzZUxvZ01lc3NhZ2VzIHRyYWNrcyBsZW5ndGgsIHNvIHNhbWUtbGVuZ3RoIHJlcGxhY2VtZW50XG4gICAgICAgICAgICAvLyBhbHNvIHNraXBzIHRoZSB0cmFuc2NyaXB0IHdyaXRlLlxuICAgICAgICAgICAgLy8gYWdlbnRfcHJvZ3Jlc3MgLyBob29rX3Byb2dyZXNzIC8gc2tpbGxfcHJvZ3Jlc3MgYXJlIE5PVCBlcGhlbWVyYWxcbiAgICAgICAgICAgIC8vIOKAlCBlYWNoIGNhcnJpZXMgZGlzdGluY3Qgc3RhdGUgdGhlIFVJIG5lZWRzIChlLmcuIHN1YmFnZW50IHRvb2xcbiAgICAgICAgICAgIC8vIGhpc3RvcnkpLiBSZXBsYWNpbmcgdGhvc2UgbGVhdmVzIHRoZSBBZ2VudFRvb2wgVUkgc3R1Y2sgYXRcbiAgICAgICAgICAgIC8vIFwiSW5pdGlhbGl6aW5n4oCmXCIgYmVjYXVzZSBpdCByZW5kZXJzIHRoZSBmdWxsIHByb2dyZXNzIHRyYWlsLlxuICAgICAgICAgICAgc2V0TWVzc2FnZXMob2xkTWVzc2FnZXMgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBsYXN0ID0gb2xkTWVzc2FnZXMuYXQoLTEpXG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICBsYXN0Py50eXBlID09PSAncHJvZ3Jlc3MnICYmXG4gICAgICAgICAgICAgICAgbGFzdC5wYXJlbnRUb29sVXNlSUQgPT09IG5ld01lc3NhZ2UucGFyZW50VG9vbFVzZUlEICYmXG4gICAgICAgICAgICAgICAgbGFzdC5kYXRhLnR5cGUgPT09IG5ld01lc3NhZ2UuZGF0YS50eXBlXG4gICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvcHkgPSBvbGRNZXNzYWdlcy5zbGljZSgpXG4gICAgICAgICAgICAgICAgY29weVtjb3B5Lmxlbmd0aCAtIDFdID0gbmV3TWVzc2FnZVxuICAgICAgICAgICAgICAgIHJldHVybiBjb3B5XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIFsuLi5vbGRNZXNzYWdlcywgbmV3TWVzc2FnZV1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNldE1lc3NhZ2VzKG9sZE1lc3NhZ2VzID0+IFsuLi5vbGRNZXNzYWdlcywgbmV3TWVzc2FnZV0pXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIEJsb2NrIHRpY2tzIG9uIEFQSSBlcnJvcnMgdG8gcHJldmVudCB0aWNrIOKGkiBlcnJvciDihpIgdGlja1xuICAgICAgICAgIC8vIHJ1bmF3YXkgbG9vcHMgKGUuZy4sIGF1dGggZmFpbHVyZSwgcmF0ZSBsaW1pdCwgYmxvY2tpbmcgbGltaXQpLlxuICAgICAgICAgIC8vIENsZWFyZWQgb24gY29tcGFjdCBib3VuZGFyeSAoYWJvdmUpIG9yIHN1Y2Nlc3NmdWwgcmVzcG9uc2UgKGJlbG93KS5cbiAgICAgICAgICBpZiAoZmVhdHVyZSgnUFJPQUNUSVZFJykgfHwgZmVhdHVyZSgnS0FJUk9TJykpIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgbmV3TWVzc2FnZS50eXBlID09PSAnYXNzaXN0YW50JyAmJlxuICAgICAgICAgICAgICAnaXNBcGlFcnJvck1lc3NhZ2UnIGluIG5ld01lc3NhZ2UgJiZcbiAgICAgICAgICAgICAgbmV3TWVzc2FnZS5pc0FwaUVycm9yTWVzc2FnZVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIHByb2FjdGl2ZU1vZHVsZT8uc2V0Q29udGV4dEJsb2NrZWQodHJ1ZSlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobmV3TWVzc2FnZS50eXBlID09PSAnYXNzaXN0YW50Jykge1xuICAgICAgICAgICAgICBwcm9hY3RpdmVNb2R1bGU/LnNldENvbnRleHRCbG9ja2VkKGZhbHNlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgbmV3Q29udGVudCA9PiB7XG4gICAgICAgICAgLy8gc2V0UmVzcG9uc2VMZW5ndGggaGFuZGxlcyB1cGRhdGluZyBib3RoIHJlc3BvbnNlTGVuZ3RoUmVmIChmb3JcbiAgICAgICAgICAvLyBzcGlubmVyIGFuaW1hdGlvbikgYW5kIGFwaU1ldHJpY3NSZWYgKGVuZFJlc3BvbnNlTGVuZ3RoL2xhc3RUb2tlblRpbWVcbiAgICAgICAgICAvLyBmb3IgT1RQUykuIE5vIHNlcGFyYXRlIG1ldHJpY3MgdXBkYXRlIG5lZWRlZCBoZXJlLlxuICAgICAgICAgIHNldFJlc3BvbnNlTGVuZ3RoKGxlbmd0aCA9PiBsZW5ndGggKyBuZXdDb250ZW50Lmxlbmd0aClcbiAgICAgICAgfSxcbiAgICAgICAgc2V0U3RyZWFtTW9kZSxcbiAgICAgICAgc2V0U3RyZWFtaW5nVG9vbFVzZXMsXG4gICAgICAgIHRvbWJzdG9uZWRNZXNzYWdlID0+IHtcbiAgICAgICAgICBzZXRNZXNzYWdlcyhvbGRNZXNzYWdlcyA9PlxuICAgICAgICAgICAgb2xkTWVzc2FnZXMuZmlsdGVyKG0gPT4gbSAhPT0gdG9tYnN0b25lZE1lc3NhZ2UpLFxuICAgICAgICAgIClcbiAgICAgICAgICB2b2lkIHJlbW92ZVRyYW5zY3JpcHRNZXNzYWdlKHRvbWJzdG9uZWRNZXNzYWdlLnV1aWQpXG4gICAgICAgIH0sXG4gICAgICAgIHNldFN0cmVhbWluZ1RoaW5raW5nLFxuICAgICAgICBtZXRyaWNzID0+IHtcbiAgICAgICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpXG4gICAgICAgICAgY29uc3QgYmFzZWxpbmUgPSByZXNwb25zZUxlbmd0aFJlZi5jdXJyZW50XG4gICAgICAgICAgYXBpTWV0cmljc1JlZi5jdXJyZW50LnB1c2goe1xuICAgICAgICAgICAgLi4ubWV0cmljcyxcbiAgICAgICAgICAgIGZpcnN0VG9rZW5UaW1lOiBub3csXG4gICAgICAgICAgICBsYXN0VG9rZW5UaW1lOiBub3csXG4gICAgICAgICAgICByZXNwb25zZUxlbmd0aEJhc2VsaW5lOiBiYXNlbGluZSxcbiAgICAgICAgICAgIGVuZFJlc3BvbnNlTGVuZ3RoOiBiYXNlbGluZSxcbiAgICAgICAgICB9KVxuICAgICAgICB9LFxuICAgICAgICBvblN0cmVhbWluZ1RleHQsXG4gICAgICApXG4gICAgfSxcbiAgICBbXG4gICAgICBzZXRNZXNzYWdlcyxcbiAgICAgIHNldFJlc3BvbnNlTGVuZ3RoLFxuICAgICAgc2V0U3RyZWFtTW9kZSxcbiAgICAgIHNldFN0cmVhbWluZ1Rvb2xVc2VzLFxuICAgICAgc2V0U3RyZWFtaW5nVGhpbmtpbmcsXG4gICAgICBvblN0cmVhbWluZ1RleHQsXG4gICAgXSxcbiAgKVxuXG4gIGNvbnN0IG9uUXVlcnlJbXBsID0gdXNlQ2FsbGJhY2soXG4gICAgYXN5bmMgKFxuICAgICAgbWVzc2FnZXNJbmNsdWRpbmdOZXdNZXNzYWdlczogTWVzc2FnZVR5cGVbXSxcbiAgICAgIG5ld01lc3NhZ2VzOiBNZXNzYWdlVHlwZVtdLFxuICAgICAgYWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIsXG4gICAgICBzaG91bGRRdWVyeTogYm9vbGVhbixcbiAgICAgIGFkZGl0aW9uYWxBbGxvd2VkVG9vbHM6IHN0cmluZ1tdLFxuICAgICAgbWFpbkxvb3BNb2RlbFBhcmFtOiBzdHJpbmcsXG4gICAgICBlZmZvcnQ/OiBFZmZvcnRWYWx1ZSxcbiAgICApID0+IHtcbiAgICAgIC8vIFByZXBhcmUgSURFIGludGVncmF0aW9uIGZvciBuZXcgcHJvbXB0LiBSZWFkIG1jcENsaWVudHMgZnJlc2ggZnJvbVxuICAgICAgLy8gc3RvcmUg4oCUIHVzZU1hbmFnZU1DUENvbm5lY3Rpb25zIG1heSBoYXZlIHBvcHVsYXRlZCBpdCBzaW5jZSB0aGVcbiAgICAgIC8vIHJlbmRlciB0aGF0IGNhcHR1cmVkIHRoaXMgY2xvc3VyZSAoc2FtZSBwYXR0ZXJuIGFzIGNvbXB1dGVUb29scykuXG4gICAgICBpZiAoc2hvdWxkUXVlcnkpIHtcbiAgICAgICAgY29uc3QgZnJlc2hDbGllbnRzID0gbWVyZ2VDbGllbnRzKFxuICAgICAgICAgIGluaXRpYWxNY3BDbGllbnRzLFxuICAgICAgICAgIHN0b3JlLmdldFN0YXRlKCkubWNwLmNsaWVudHMsXG4gICAgICAgIClcbiAgICAgICAgdm9pZCBkaWFnbm9zdGljVHJhY2tlci5oYW5kbGVRdWVyeVN0YXJ0KGZyZXNoQ2xpZW50cylcbiAgICAgICAgY29uc3QgaWRlQ2xpZW50ID0gZ2V0Q29ubmVjdGVkSWRlQ2xpZW50KGZyZXNoQ2xpZW50cylcbiAgICAgICAgaWYgKGlkZUNsaWVudCkge1xuICAgICAgICAgIHZvaWQgY2xvc2VPcGVuRGlmZnMoaWRlQ2xpZW50KVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE1hcmsgb25ib2FyZGluZyBhcyBjb21wbGV0ZSB3aGVuIGFueSB1c2VyIG1lc3NhZ2UgaXMgc2VudCB0byBDbGF1ZGVcbiAgICAgIHZvaWQgbWF5YmVNYXJrUHJvamVjdE9uYm9hcmRpbmdDb21wbGV0ZSgpXG5cbiAgICAgIC8vIEV4dHJhY3QgYSBzZXNzaW9uIHRpdGxlIGZyb20gdGhlIGZpcnN0IHJlYWwgdXNlciBtZXNzYWdlLiBPbmUtc2hvdFxuICAgICAgLy8gdmlhIHJlZiAod2FzIHRlbmd1X2JpcmNoX21pc3QgZXhwZXJpbWVudDogZmlyc3QtbWVzc2FnZS1vbmx5IHRvIHNhdmVcbiAgICAgIC8vIEhhaWt1IGNhbGxzKS4gVGhlIHJlZiByZXBsYWNlcyB0aGUgb2xkIGBtZXNzYWdlcy5sZW5ndGggPD0gMWAgY2hlY2ssXG4gICAgICAvLyB3aGljaCB3YXMgYnJva2VuIGJ5IFNlc3Npb25TdGFydCBob29rIG1lc3NhZ2VzIChwcmVwZW5kZWQgdmlhXG4gICAgICAvLyB1c2VEZWZlcnJlZEhvb2tNZXNzYWdlcykgYW5kIGF0dGFjaG1lbnQgbWVzc2FnZXMgKGFwcGVuZGVkIGJ5XG4gICAgICAvLyBwcm9jZXNzVGV4dFByb21wdCkg4oCUIGJvdGggcHVzaGVkIGxlbmd0aCBwYXN0IDEgb24gdHVybiBvbmUsIHNvIHRoZVxuICAgICAgLy8gdGl0bGUgc2lsZW50bHkgZmVsbCB0aHJvdWdoIHRvIHRoZSBcIkNsYXVkZSBDb2RlXCIgZGVmYXVsdC5cbiAgICAgIGlmIChcbiAgICAgICAgIXRpdGxlRGlzYWJsZWQgJiZcbiAgICAgICAgIXNlc3Npb25UaXRsZSAmJlxuICAgICAgICAhYWdlbnRUaXRsZSAmJlxuICAgICAgICAhaGFpa3VUaXRsZUF0dGVtcHRlZFJlZi5jdXJyZW50XG4gICAgICApIHtcbiAgICAgICAgY29uc3QgZmlyc3RVc2VyTWVzc2FnZSA9IG5ld01lc3NhZ2VzLmZpbmQoXG4gICAgICAgICAgbSA9PiBtLnR5cGUgPT09ICd1c2VyJyAmJiAhbS5pc01ldGEsXG4gICAgICAgIClcbiAgICAgICAgY29uc3QgdGV4dCA9XG4gICAgICAgICAgZmlyc3RVc2VyTWVzc2FnZT8udHlwZSA9PT0gJ3VzZXInXG4gICAgICAgICAgICA/IGdldENvbnRlbnRUZXh0KGZpcnN0VXNlck1lc3NhZ2UubWVzc2FnZS5jb250ZW50KVxuICAgICAgICAgICAgOiBudWxsXG4gICAgICAgIC8vIFNraXAgc3ludGhldGljIGJyZWFkY3J1bWJzIOKAlCBzbGFzaC1jb21tYW5kIG91dHB1dCwgcHJvbXB0LXNraWxsXG4gICAgICAgIC8vIGV4cGFuc2lvbnMgKC9jb21taXQg4oaSIDxjb21tYW5kLW1lc3NhZ2U+KSwgbG9jYWwtY29tbWFuZCBoZWFkZXJzXG4gICAgICAgIC8vICgvaGVscCDihpIgPGNvbW1hbmQtbmFtZT4pLCBhbmQgYmFzaC1tb2RlICghY21kIOKGkiA8YmFzaC1pbnB1dD4pLlxuICAgICAgICAvLyBOb25lIG9mIHRoZXNlIGFyZSB0aGUgdXNlcidzIHRvcGljOyB3YWl0IGZvciByZWFsIHByb3NlLlxuICAgICAgICBpZiAoXG4gICAgICAgICAgdGV4dCAmJlxuICAgICAgICAgICF0ZXh0LnN0YXJ0c1dpdGgoYDwke0xPQ0FMX0NPTU1BTkRfU1RET1VUX1RBR30+YCkgJiZcbiAgICAgICAgICAhdGV4dC5zdGFydHNXaXRoKGA8JHtDT01NQU5EX01FU1NBR0VfVEFHfT5gKSAmJlxuICAgICAgICAgICF0ZXh0LnN0YXJ0c1dpdGgoYDwke0NPTU1BTkRfTkFNRV9UQUd9PmApICYmXG4gICAgICAgICAgIXRleHQuc3RhcnRzV2l0aChgPCR7QkFTSF9JTlBVVF9UQUd9PmApXG4gICAgICAgICkge1xuICAgICAgICAgIGhhaWt1VGl0bGVBdHRlbXB0ZWRSZWYuY3VycmVudCA9IHRydWVcbiAgICAgICAgICB2b2lkIGdlbmVyYXRlU2Vzc2lvblRpdGxlKHRleHQsIG5ldyBBYm9ydENvbnRyb2xsZXIoKS5zaWduYWwpLnRoZW4oXG4gICAgICAgICAgICB0aXRsZSA9PiB7XG4gICAgICAgICAgICAgIGlmICh0aXRsZSkgc2V0SGFpa3VUaXRsZSh0aXRsZSlcbiAgICAgICAgICAgICAgZWxzZSBoYWlrdVRpdGxlQXR0ZW1wdGVkUmVmLmN1cnJlbnQgPSBmYWxzZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgICAgaGFpa3VUaXRsZUF0dGVtcHRlZFJlZi5jdXJyZW50ID0gZmFsc2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFwcGx5IHNsYXNoLWNvbW1hbmQtc2NvcGVkIGFsbG93ZWRUb29scyAoZnJvbSBza2lsbCBmcm9udG1hdHRlcikgdG8gdGhlXG4gICAgICAvLyBzdG9yZSBvbmNlIHBlciB0dXJuLiBUaGlzIGFsc28gY292ZXJzIHRoZSByZXNldDogdGhlIG5leHQgbm9uLXNraWxsIHR1cm5cbiAgICAgIC8vIHBhc3NlcyBbXSBhbmQgY2xlYXJzIGl0LiBNdXN0IHJ1biBiZWZvcmUgdGhlICFzaG91bGRRdWVyeSBnYXRlOiBmb3JrZWRcbiAgICAgIC8vIGNvbW1hbmRzIChleGVjdXRlRm9ya2VkU2xhc2hDb21tYW5kKSByZXR1cm4gc2hvdWxkUXVlcnk9ZmFsc2UsIGFuZFxuICAgICAgLy8gY3JlYXRlR2V0QXBwU3RhdGVXaXRoQWxsb3dlZFRvb2xzIGluIGZvcmtlZEFnZW50LnRzIHJlYWRzIHRoaXMgZmllbGQsIHNvXG4gICAgICAvLyBzdGFsZSBza2lsbCB0b29scyB3b3VsZCBvdGhlcndpc2UgbGVhayBpbnRvIGZvcmtlZCBhZ2VudCBwZXJtaXNzaW9ucy5cbiAgICAgIC8vIFByZXZpb3VzbHkgdGhpcyB3cml0ZSB3YXMgaGlkZGVuIGluc2lkZSBnZXRUb29sVXNlQ29udGV4dCdzIGdldEFwcFN0YXRlXG4gICAgICAvLyAofjg1IGNhbGxzL3R1cm4pOyBob2lzdGluZyBpdCBoZXJlIG1ha2VzIGdldEFwcFN0YXRlIGEgcHVyZSByZWFkIGFuZCBzdG9wc1xuICAgICAgLy8gZXBoZW1lcmFsIGNvbnRleHRzIChwZXJtaXNzaW9uIGRpYWxvZywgQmFja2dyb3VuZFRhc2tzRGlhbG9nKSBmcm9tXG4gICAgICAvLyBhY2NpZGVudGFsbHkgY2xlYXJpbmcgaXQgbWlkLXR1cm4uXG4gICAgICBzdG9yZS5zZXRTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgY29uc3QgY3VyID0gcHJldi50b29sUGVybWlzc2lvbkNvbnRleHQuYWx3YXlzQWxsb3dSdWxlcy5jb21tYW5kXG4gICAgICAgIGlmIChcbiAgICAgICAgICBjdXIgPT09IGFkZGl0aW9uYWxBbGxvd2VkVG9vbHMgfHxcbiAgICAgICAgICAoY3VyPy5sZW5ndGggPT09IGFkZGl0aW9uYWxBbGxvd2VkVG9vbHMubGVuZ3RoICYmXG4gICAgICAgICAgICBjdXIuZXZlcnkoKHYsIGkpID0+IHYgPT09IGFkZGl0aW9uYWxBbGxvd2VkVG9vbHNbaV0pKVxuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm4gcHJldlxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQ6IHtcbiAgICAgICAgICAgIC4uLnByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgICAgICAgICAgYWx3YXlzQWxsb3dSdWxlczoge1xuICAgICAgICAgICAgICAuLi5wcmV2LnRvb2xQZXJtaXNzaW9uQ29udGV4dC5hbHdheXNBbGxvd1J1bGVzLFxuICAgICAgICAgICAgICBjb21tYW5kOiBhZGRpdGlvbmFsQWxsb3dlZFRvb2xzLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICAvLyBUaGUgbGFzdCBtZXNzYWdlIGlzIGFuIGFzc2lzdGFudCBtZXNzYWdlIGlmIHRoZSB1c2VyIGlucHV0IHdhcyBhIGJhc2ggY29tbWFuZCxcbiAgICAgIC8vIG9yIGlmIHRoZSB1c2VyIGlucHV0IHdhcyBhbiBpbnZhbGlkIHNsYXNoIGNvbW1hbmQuXG4gICAgICBpZiAoIXNob3VsZFF1ZXJ5KSB7XG4gICAgICAgIC8vIE1hbnVhbCAvY29tcGFjdCBzZXRzIG1lc3NhZ2VzIGRpcmVjdGx5IChzaG91bGRRdWVyeT1mYWxzZSkgYnlwYXNzaW5nXG4gICAgICAgIC8vIGhhbmRsZU1lc3NhZ2VGcm9tU3RyZWFtLiBDbGVhciBjb250ZXh0LWJsb2NrZWQgaWYgYSBjb21wYWN0IGJvdW5kYXJ5XG4gICAgICAgIC8vIGlzIHByZXNlbnQgc28gcHJvYWN0aXZlIHRpY2tzIHJlc3VtZSBhZnRlciBjb21wYWN0aW9uLlxuICAgICAgICBpZiAobmV3TWVzc2FnZXMuc29tZShpc0NvbXBhY3RCb3VuZGFyeU1lc3NhZ2UpKSB7XG4gICAgICAgICAgLy8gQnVtcCBjb252ZXJzYXRpb25JZCBzbyBNZXNzYWdlcy50c3ggcm93IGtleXMgY2hhbmdlIGFuZFxuICAgICAgICAgIC8vIHN0YWxlIG1lbW9pemVkIHJvd3MgcmVtb3VudCB3aXRoIHBvc3QtY29tcGFjdCBjb250ZW50LlxuICAgICAgICAgIHNldENvbnZlcnNhdGlvbklkKHJhbmRvbVVVSUQoKSlcbiAgICAgICAgICBpZiAoZmVhdHVyZSgnUFJPQUNUSVZFJykgfHwgZmVhdHVyZSgnS0FJUk9TJykpIHtcbiAgICAgICAgICAgIHByb2FjdGl2ZU1vZHVsZT8uc2V0Q29udGV4dEJsb2NrZWQoZmFsc2UpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc2V0TG9hZGluZ1N0YXRlKClcbiAgICAgICAgc2V0QWJvcnRDb250cm9sbGVyKG51bGwpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBjb25zdCB0b29sVXNlQ29udGV4dCA9IGdldFRvb2xVc2VDb250ZXh0KFxuICAgICAgICBtZXNzYWdlc0luY2x1ZGluZ05ld01lc3NhZ2VzLFxuICAgICAgICBuZXdNZXNzYWdlcyxcbiAgICAgICAgYWJvcnRDb250cm9sbGVyLFxuICAgICAgICBtYWluTG9vcE1vZGVsUGFyYW0sXG4gICAgICApXG4gICAgICAvLyBnZXRUb29sVXNlQ29udGV4dCByZWFkcyB0b29scy9tY3BDbGllbnRzIGZyZXNoIGZyb20gc3RvcmUuZ2V0U3RhdGUoKVxuICAgICAgLy8gKHZpYSBjb21wdXRlVG9vbHMvbWVyZ2VDbGllbnRzKS4gVXNlIHRob3NlIHJhdGhlciB0aGFuIHRoZSBjbG9zdXJlLVxuICAgICAgLy8gY2FwdHVyZWQgYHRvb2xzYC9gbWNwQ2xpZW50c2Ag4oCUIHVzZU1hbmFnZU1DUENvbm5lY3Rpb25zIG1heSBoYXZlXG4gICAgICAvLyBmbHVzaGVkIG5ldyBNQ1Agc3RhdGUgYmV0d2VlbiB0aGUgcmVuZGVyIHRoYXQgY2FwdHVyZWQgdGhpcyBjbG9zdXJlXG4gICAgICAvLyBhbmQgbm93LiBUdXJuIDEgdmlhIHByb2Nlc3NJbml0aWFsTWVzc2FnZSBpcyB0aGUgbWFpbiBiZW5lZmljaWFyeS5cbiAgICAgIGNvbnN0IHsgdG9vbHM6IGZyZXNoVG9vbHMsIG1jcENsaWVudHM6IGZyZXNoTWNwQ2xpZW50cyB9ID1cbiAgICAgICAgdG9vbFVzZUNvbnRleHQub3B0aW9uc1xuXG4gICAgICAvLyBTY29wZSB0aGUgc2tpbGwncyBlZmZvcnQgb3ZlcnJpZGUgdG8gdGhpcyB0dXJuJ3MgY29udGV4dCBvbmx5IOKAlFxuICAgICAgLy8gd3JhcHBpbmcgZ2V0QXBwU3RhdGUga2VlcHMgdGhlIG92ZXJyaWRlIG91dCBvZiB0aGUgZ2xvYmFsIHN0b3JlIHNvXG4gICAgICAvLyBiYWNrZ3JvdW5kIGFnZW50cyBhbmQgVUkgc3Vic2NyaWJlcnMgKFNwaW5uZXIsIExvZ29WMikgbmV2ZXIgc2VlIGl0LlxuICAgICAgaWYgKGVmZm9ydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IHByZXZpb3VzR2V0QXBwU3RhdGUgPSB0b29sVXNlQ29udGV4dC5nZXRBcHBTdGF0ZVxuICAgICAgICB0b29sVXNlQ29udGV4dC5nZXRBcHBTdGF0ZSA9ICgpID0+ICh7XG4gICAgICAgICAgLi4ucHJldmlvdXNHZXRBcHBTdGF0ZSgpLFxuICAgICAgICAgIGVmZm9ydFZhbHVlOiBlZmZvcnQsXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIHF1ZXJ5Q2hlY2twb2ludCgncXVlcnlfY29udGV4dF9sb2FkaW5nX3N0YXJ0JylcbiAgICAgIGNvbnN0IFssICwgZGVmYXVsdFN5c3RlbVByb21wdCwgYmFzZVVzZXJDb250ZXh0LCBzeXN0ZW1Db250ZXh0XSA9XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICAvLyBJTVBPUlRBTlQ6IGRvIHRoaXMgYWZ0ZXIgc2V0TWVzc2FnZXMoKSBhYm92ZSwgdG8gYXZvaWQgVUkgamFua1xuICAgICAgICAgIGNoZWNrQW5kRGlzYWJsZUJ5cGFzc1Blcm1pc3Npb25zSWZOZWVkZWQoXG4gICAgICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgICAgICApLFxuICAgICAgICAgIC8vIEdhdGVkIG9uIFRSQU5TQ1JJUFRfQ0xBU1NJRklFUiBzbyBHcm93dGhCb29rIGtpbGwgc3dpdGNoIHJ1bnMgd2hlcmV2ZXIgYXV0byBtb2RlIGlzIGJ1aWx0IGluXG4gICAgICAgICAgZmVhdHVyZSgnVFJBTlNDUklQVF9DTEFTU0lGSUVSJylcbiAgICAgICAgICAgID8gY2hlY2tBbmREaXNhYmxlQXV0b01vZGVJZk5lZWRlZChcbiAgICAgICAgICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICAgICAgICAgICAgc3RvcmUuZ2V0U3RhdGUoKS5mYXN0TW9kZSxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgZ2V0U3lzdGVtUHJvbXB0KFxuICAgICAgICAgICAgZnJlc2hUb29scyxcbiAgICAgICAgICAgIG1haW5Mb29wTW9kZWxQYXJhbSxcbiAgICAgICAgICAgIEFycmF5LmZyb20oXG4gICAgICAgICAgICAgIHRvb2xQZXJtaXNzaW9uQ29udGV4dC5hZGRpdGlvbmFsV29ya2luZ0RpcmVjdG9yaWVzLmtleXMoKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBmcmVzaE1jcENsaWVudHMsXG4gICAgICAgICAgKSxcbiAgICAgICAgICBnZXRVc2VyQ29udGV4dCgpLFxuICAgICAgICAgIGdldFN5c3RlbUNvbnRleHQoKSxcbiAgICAgICAgXSlcbiAgICAgIGNvbnN0IHVzZXJDb250ZXh0ID0ge1xuICAgICAgICAuLi5iYXNlVXNlckNvbnRleHQsXG4gICAgICAgIC4uLmdldENvb3JkaW5hdG9yVXNlckNvbnRleHQoXG4gICAgICAgICAgZnJlc2hNY3BDbGllbnRzLFxuICAgICAgICAgIGlzU2NyYXRjaHBhZEVuYWJsZWQoKSA/IGdldFNjcmF0Y2hwYWREaXIoKSA6IHVuZGVmaW5lZCxcbiAgICAgICAgKSxcbiAgICAgICAgLi4uKChmZWF0dXJlKCdQUk9BQ1RJVkUnKSB8fCBmZWF0dXJlKCdLQUlST1MnKSkgJiZcbiAgICAgICAgcHJvYWN0aXZlTW9kdWxlPy5pc1Byb2FjdGl2ZUFjdGl2ZSgpICYmXG4gICAgICAgICF0ZXJtaW5hbEZvY3VzUmVmLmN1cnJlbnRcbiAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgdGVybWluYWxGb2N1czpcbiAgICAgICAgICAgICAgICAnVGhlIHRlcm1pbmFsIGlzIHVuZm9jdXNlZCBcXHUyMDE0IHRoZSB1c2VyIGlzIG5vdCBhY3RpdmVseSB3YXRjaGluZy4nLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIDoge30pLFxuICAgICAgfVxuICAgICAgcXVlcnlDaGVja3BvaW50KCdxdWVyeV9jb250ZXh0X2xvYWRpbmdfZW5kJylcblxuICAgICAgY29uc3Qgc3lzdGVtUHJvbXB0ID0gYnVpbGRFZmZlY3RpdmVTeXN0ZW1Qcm9tcHQoe1xuICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLFxuICAgICAgICB0b29sVXNlQ29udGV4dCxcbiAgICAgICAgY3VzdG9tU3lzdGVtUHJvbXB0LFxuICAgICAgICBkZWZhdWx0U3lzdGVtUHJvbXB0LFxuICAgICAgICBhcHBlbmRTeXN0ZW1Qcm9tcHQsXG4gICAgICB9KVxuICAgICAgdG9vbFVzZUNvbnRleHQucmVuZGVyZWRTeXN0ZW1Qcm9tcHQgPSBzeXN0ZW1Qcm9tcHRcblxuICAgICAgcXVlcnlDaGVja3BvaW50KCdxdWVyeV9xdWVyeV9zdGFydCcpXG4gICAgICByZXNldFR1cm5Ib29rRHVyYXRpb24oKVxuICAgICAgcmVzZXRUdXJuVG9vbER1cmF0aW9uKClcbiAgICAgIHJlc2V0VHVybkNsYXNzaWZpZXJEdXJhdGlvbigpXG5cbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZXZlbnQgb2YgcXVlcnkoe1xuICAgICAgICBtZXNzYWdlczogbWVzc2FnZXNJbmNsdWRpbmdOZXdNZXNzYWdlcyxcbiAgICAgICAgc3lzdGVtUHJvbXB0LFxuICAgICAgICB1c2VyQ29udGV4dCxcbiAgICAgICAgc3lzdGVtQ29udGV4dCxcbiAgICAgICAgY2FuVXNlVG9vbCxcbiAgICAgICAgdG9vbFVzZUNvbnRleHQsXG4gICAgICAgIHF1ZXJ5U291cmNlOiBnZXRRdWVyeVNvdXJjZUZvclJFUEwoKSxcbiAgICAgIH0pKSB7XG4gICAgICAgIG9uUXVlcnlFdmVudChldmVudClcbiAgICAgIH1cblxuXG4gICAgICBpZiAoZmVhdHVyZSgnQlVERFknKSkge1xuICAgICAgICB2b2lkIGZpcmVDb21wYW5pb25PYnNlcnZlcihtZXNzYWdlc1JlZi5jdXJyZW50LCByZWFjdGlvbiA9PlxuICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT5cbiAgICAgICAgICAgIHByZXYuY29tcGFuaW9uUmVhY3Rpb24gPT09IHJlYWN0aW9uXG4gICAgICAgICAgICAgID8gcHJldlxuICAgICAgICAgICAgICA6IHsgLi4ucHJldiwgY29tcGFuaW9uUmVhY3Rpb246IHJlYWN0aW9uIH0sXG4gICAgICAgICAgKSxcbiAgICAgICAgKVxuICAgICAgfVxuXG4gICAgICBxdWVyeUNoZWNrcG9pbnQoJ3F1ZXJ5X2VuZCcpXG5cbiAgICAgIC8vIENhcHR1cmUgYW50LW9ubHkgQVBJIG1ldHJpY3MgYmVmb3JlIHJlc2V0TG9hZGluZ1N0YXRlIGNsZWFycyB0aGUgcmVmLlxuICAgICAgLy8gRm9yIG11bHRpLXJlcXVlc3QgdHVybnMgKHRvb2wgdXNlIGxvb3BzKSwgY29tcHV0ZSBQNTAgYWNyb3NzIGFsbCByZXF1ZXN0cy5cbiAgICAgIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIGFwaU1ldHJpY3NSZWYuY3VycmVudC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGVudHJpZXMgPSBhcGlNZXRyaWNzUmVmLmN1cnJlbnRcblxuICAgICAgICBjb25zdCB0dGZ0cyA9IGVudHJpZXMubWFwKGUgPT4gZS50dGZ0TXMpXG4gICAgICAgIC8vIENvbXB1dGUgcGVyLXJlcXVlc3QgT1RQUyB1c2luZyBvbmx5IGFjdGl2ZSBzdHJlYW1pbmcgdGltZSBhbmRcbiAgICAgICAgLy8gc3RyZWFtaW5nLW9ubHkgY29udGVudC4gZW5kUmVzcG9uc2VMZW5ndGggdHJhY2tzIGNvbnRlbnQgYWRkZWQgYnlcbiAgICAgICAgLy8gc3RyZWFtaW5nIGRlbHRhcyBvbmx5LCBleGNsdWRpbmcgc3ViYWdlbnQvY29tcGFjdGlvbiBpbmZsYXRpb24uXG4gICAgICAgIGNvbnN0IG90cHNWYWx1ZXMgPSBlbnRyaWVzLm1hcChlID0+IHtcbiAgICAgICAgICBjb25zdCBkZWx0YSA9IE1hdGgucm91bmQoXG4gICAgICAgICAgICAoZS5lbmRSZXNwb25zZUxlbmd0aCAtIGUucmVzcG9uc2VMZW5ndGhCYXNlbGluZSkgLyA0LFxuICAgICAgICAgIClcbiAgICAgICAgICBjb25zdCBzYW1wbGluZ01zID0gZS5sYXN0VG9rZW5UaW1lIC0gZS5maXJzdFRva2VuVGltZVxuICAgICAgICAgIHJldHVybiBzYW1wbGluZ01zID4gMCA/IE1hdGgucm91bmQoZGVsdGEgLyAoc2FtcGxpbmdNcyAvIDEwMDApKSA6IDBcbiAgICAgICAgfSlcblxuICAgICAgICBjb25zdCBpc011bHRpUmVxdWVzdCA9IGVudHJpZXMubGVuZ3RoID4gMVxuICAgICAgICBjb25zdCBob29rTXMgPSBnZXRUdXJuSG9va0R1cmF0aW9uTXMoKVxuICAgICAgICBjb25zdCBob29rQ291bnQgPSBnZXRUdXJuSG9va0NvdW50KClcbiAgICAgICAgY29uc3QgdG9vbE1zID0gZ2V0VHVyblRvb2xEdXJhdGlvbk1zKClcbiAgICAgICAgY29uc3QgdG9vbENvdW50ID0gZ2V0VHVyblRvb2xDb3VudCgpXG4gICAgICAgIGNvbnN0IGNsYXNzaWZpZXJNcyA9IGdldFR1cm5DbGFzc2lmaWVyRHVyYXRpb25NcygpXG4gICAgICAgIGNvbnN0IGNsYXNzaWZpZXJDb3VudCA9IGdldFR1cm5DbGFzc2lmaWVyQ291bnQoKVxuICAgICAgICBjb25zdCB0dXJuTXMgPSBEYXRlLm5vdygpIC0gbG9hZGluZ1N0YXJ0VGltZVJlZi5jdXJyZW50XG4gICAgICAgIHNldE1lc3NhZ2VzKHByZXYgPT4gW1xuICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgY3JlYXRlQXBpTWV0cmljc01lc3NhZ2Uoe1xuICAgICAgICAgICAgdHRmdE1zOiBpc011bHRpUmVxdWVzdCA/IG1lZGlhbih0dGZ0cykgOiB0dGZ0c1swXSEsXG4gICAgICAgICAgICBvdHBzOiBpc011bHRpUmVxdWVzdCA/IG1lZGlhbihvdHBzVmFsdWVzKSA6IG90cHNWYWx1ZXNbMF0hLFxuICAgICAgICAgICAgaXNQNTA6IGlzTXVsdGlSZXF1ZXN0LFxuICAgICAgICAgICAgaG9va0R1cmF0aW9uTXM6IGhvb2tNcyA+IDAgPyBob29rTXMgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICBob29rQ291bnQ6IGhvb2tDb3VudCA+IDAgPyBob29rQ291bnQgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICB0dXJuRHVyYXRpb25NczogdHVybk1zID4gMCA/IHR1cm5NcyA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHRvb2xEdXJhdGlvbk1zOiB0b29sTXMgPiAwID8gdG9vbE1zIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgdG9vbENvdW50OiB0b29sQ291bnQgPiAwID8gdG9vbENvdW50IDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgY2xhc3NpZmllckR1cmF0aW9uTXM6IGNsYXNzaWZpZXJNcyA+IDAgPyBjbGFzc2lmaWVyTXMgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICBjbGFzc2lmaWVyQ291bnQ6IGNsYXNzaWZpZXJDb3VudCA+IDAgPyBjbGFzc2lmaWVyQ291bnQgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICBjb25maWdXcml0ZUNvdW50OiBnZXRHbG9iYWxDb25maWdXcml0ZUNvdW50KCksXG4gICAgICAgICAgfSksXG4gICAgICAgIF0pXG4gICAgICB9XG5cbiAgICAgIHJlc2V0TG9hZGluZ1N0YXRlKClcblxuICAgICAgLy8gTG9nIHF1ZXJ5IHByb2ZpbGluZyByZXBvcnQgaWYgZW5hYmxlZFxuICAgICAgbG9nUXVlcnlQcm9maWxlUmVwb3J0KClcblxuICAgICAgLy8gU2lnbmFsIHRoYXQgYSBxdWVyeSB0dXJuIGhhcyBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5XG4gICAgICBhd2FpdCBvblR1cm5Db21wbGV0ZT8uKG1lc3NhZ2VzUmVmLmN1cnJlbnQpXG4gICAgfSxcbiAgICBbXG4gICAgICBpbml0aWFsTWNwQ2xpZW50cyxcbiAgICAgIHJlc2V0TG9hZGluZ1N0YXRlLFxuICAgICAgZ2V0VG9vbFVzZUNvbnRleHQsXG4gICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgIGN1c3RvbVN5c3RlbVByb21wdCxcbiAgICAgIG9uVHVybkNvbXBsZXRlLFxuICAgICAgYXBwZW5kU3lzdGVtUHJvbXB0LFxuICAgICAgY2FuVXNlVG9vbCxcbiAgICAgIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gICAgICBvblF1ZXJ5RXZlbnQsXG4gICAgICBzZXNzaW9uVGl0bGUsXG4gICAgICB0aXRsZURpc2FibGVkLFxuICAgIF0sXG4gIClcblxuICBjb25zdCBvblF1ZXJ5ID0gdXNlQ2FsbGJhY2soXG4gICAgYXN5bmMgKFxuICAgICAgbmV3TWVzc2FnZXM6IE1lc3NhZ2VUeXBlW10sXG4gICAgICBhYm9ydENvbnRyb2xsZXI6IEFib3J0Q29udHJvbGxlcixcbiAgICAgIHNob3VsZFF1ZXJ5OiBib29sZWFuLFxuICAgICAgYWRkaXRpb25hbEFsbG93ZWRUb29sczogc3RyaW5nW10sXG4gICAgICBtYWluTG9vcE1vZGVsUGFyYW06IHN0cmluZyxcbiAgICAgIG9uQmVmb3JlUXVlcnlDYWxsYmFjaz86IChcbiAgICAgICAgaW5wdXQ6IHN0cmluZyxcbiAgICAgICAgbmV3TWVzc2FnZXM6IE1lc3NhZ2VUeXBlW10sXG4gICAgICApID0+IFByb21pc2U8Ym9vbGVhbj4sXG4gICAgICBpbnB1dD86IHN0cmluZyxcbiAgICAgIGVmZm9ydD86IEVmZm9ydFZhbHVlLFxuICAgICk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgLy8gSWYgdGhpcyBpcyBhIHRlYW1tYXRlLCBtYXJrIHRoZW0gYXMgYWN0aXZlIHdoZW4gc3RhcnRpbmcgYSB0dXJuXG4gICAgICBpZiAoaXNBZ2VudFN3YXJtc0VuYWJsZWQoKSkge1xuICAgICAgICBjb25zdCB0ZWFtTmFtZSA9IGdldFRlYW1OYW1lKClcbiAgICAgICAgY29uc3QgYWdlbnROYW1lID0gZ2V0QWdlbnROYW1lKClcbiAgICAgICAgaWYgKHRlYW1OYW1lICYmIGFnZW50TmFtZSkge1xuICAgICAgICAgIC8vIEZpcmUgYW5kIGZvcmdldCAtIHR1cm4gc3RhcnRzIGltbWVkaWF0ZWx5LCB3cml0ZSBoYXBwZW5zIGluIGJhY2tncm91bmRcbiAgICAgICAgICB2b2lkIHNldE1lbWJlckFjdGl2ZSh0ZWFtTmFtZSwgYWdlbnROYW1lLCB0cnVlKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIENvbmN1cnJlbnQgZ3VhcmQgdmlhIHN0YXRlIG1hY2hpbmUuIHRyeVN0YXJ0KCkgYXRvbWljYWxseSBjaGVja3NcbiAgICAgIC8vIGFuZCB0cmFuc2l0aW9ucyBpZGxl4oaScnVubmluZywgcmV0dXJuaW5nIHRoZSBnZW5lcmF0aW9uIG51bWJlci5cbiAgICAgIC8vIFJldHVybnMgbnVsbCBpZiBhbHJlYWR5IHJ1bm5pbmcg4oCUIG5vIHNlcGFyYXRlIGNoZWNrLXRoZW4tc2V0LlxuICAgICAgY29uc3QgdGhpc0dlbmVyYXRpb24gPSBxdWVyeUd1YXJkLnRyeVN0YXJ0KClcbiAgICAgIGlmICh0aGlzR2VuZXJhdGlvbiA9PT0gbnVsbCkge1xuICAgICAgICBsb2dFdmVudCgndGVuZ3VfY29uY3VycmVudF9vbnF1ZXJ5X2RldGVjdGVkJywge30pXG5cbiAgICAgICAgLy8gRXh0cmFjdCBhbmQgZW5xdWV1ZSB1c2VyIG1lc3NhZ2UgdGV4dCwgc2tpcHBpbmcgbWV0YSBtZXNzYWdlc1xuICAgICAgICAvLyAoZS5nLiBleHBhbmRlZCBza2lsbCBjb250ZW50LCB0aWNrIHByb21wdHMpIHRoYXQgc2hvdWxkIG5vdCBiZVxuICAgICAgICAvLyByZXBsYXllZCBhcyB1c2VyLXZpc2libGUgdGV4dC5cbiAgICAgICAgbmV3TWVzc2FnZXNcbiAgICAgICAgICAuZmlsdGVyKChtKTogbSBpcyBVc2VyTWVzc2FnZSA9PiBtLnR5cGUgPT09ICd1c2VyJyAmJiAhbS5pc01ldGEpXG4gICAgICAgICAgLm1hcChfID0+IGdldENvbnRlbnRUZXh0KF8ubWVzc2FnZS5jb250ZW50KSlcbiAgICAgICAgICAuZmlsdGVyKF8gPT4gXyAhPT0gbnVsbClcbiAgICAgICAgICAuZm9yRWFjaCgobXNnLCBpKSA9PiB7XG4gICAgICAgICAgICBlbnF1ZXVlKHsgdmFsdWU6IG1zZywgbW9kZTogJ3Byb21wdCcgfSlcbiAgICAgICAgICAgIGlmIChpID09PSAwKSB7XG4gICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9jb25jdXJyZW50X29ucXVlcnlfZW5xdWV1ZWQnLCB7fSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gaXNMb2FkaW5nIGlzIGRlcml2ZWQgZnJvbSBxdWVyeUd1YXJkIOKAlCB0cnlTdGFydCgpIGFib3ZlIGFscmVhZHlcbiAgICAgICAgLy8gdHJhbnNpdGlvbmVkIGRpc3BhdGNoaW5n4oaScnVubmluZywgc28gbm8gc2V0dGVyIGNhbGwgbmVlZGVkIGhlcmUuXG4gICAgICAgIHJlc2V0VGltaW5nUmVmcygpXG4gICAgICAgIHNldE1lc3NhZ2VzKG9sZE1lc3NhZ2VzID0+IFsuLi5vbGRNZXNzYWdlcywgLi4ubmV3TWVzc2FnZXNdKVxuICAgICAgICByZXNwb25zZUxlbmd0aFJlZi5jdXJyZW50ID0gMFxuICAgICAgICBpZiAoZmVhdHVyZSgnVE9LRU5fQlVER0VUJykpIHtcbiAgICAgICAgICBjb25zdCBwYXJzZWRCdWRnZXQgPSBpbnB1dCA/IHBhcnNlVG9rZW5CdWRnZXQoaW5wdXQpIDogbnVsbFxuICAgICAgICAgIHNuYXBzaG90T3V0cHV0VG9rZW5zRm9yVHVybihcbiAgICAgICAgICAgIHBhcnNlZEJ1ZGdldCA/PyBnZXRDdXJyZW50VHVyblRva2VuQnVkZ2V0KCksXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICAgIGFwaU1ldHJpY3NSZWYuY3VycmVudCA9IFtdXG4gICAgICAgIHNldFN0cmVhbWluZ1Rvb2xVc2VzKFtdKVxuICAgICAgICBzZXRTdHJlYW1pbmdUZXh0KG51bGwpXG5cbiAgICAgICAgLy8gbWVzc2FnZXNSZWYgaXMgdXBkYXRlZCBzeW5jaHJvbm91c2x5IGJ5IHRoZSBzZXRNZXNzYWdlcyB3cmFwcGVyXG4gICAgICAgIC8vIGFib3ZlLCBzbyBpdCBhbHJlYWR5IGluY2x1ZGVzIG5ld01lc3NhZ2VzIGZyb20gdGhlIGFwcGVuZCBhdCB0aGVcbiAgICAgICAgLy8gdG9wIG9mIHRoaXMgdHJ5IGJsb2NrLiAgTm8gcmVjb25zdHJ1Y3Rpb24gbmVlZGVkLCBubyB3YWl0aW5nIGZvclxuICAgICAgICAvLyBSZWFjdCdzIHNjaGVkdWxlciAocHJldmlvdXNseSBjb3N0IDIwLTU2bXMgcGVyIHByb21wdDsgdGhlIDU2bXNcbiAgICAgICAgLy8gY2FzZSB3YXMgYSBHQyBwYXVzZSBjYXVnaHQgZHVyaW5nIHRoZSBhd2FpdCkuXG4gICAgICAgIGNvbnN0IGxhdGVzdE1lc3NhZ2VzID0gbWVzc2FnZXNSZWYuY3VycmVudFxuXG4gICAgICAgIGlmIChpbnB1dCkge1xuICAgICAgICAgIGF3YWl0IG1yT25CZWZvcmVRdWVyeShpbnB1dCwgbGF0ZXN0TWVzc2FnZXMsIG5ld01lc3NhZ2VzLmxlbmd0aClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFBhc3MgZnVsbCBjb252ZXJzYXRpb24gaGlzdG9yeSB0byBjYWxsYmFja1xuICAgICAgICBpZiAob25CZWZvcmVRdWVyeUNhbGxiYWNrICYmIGlucHV0KSB7XG4gICAgICAgICAgY29uc3Qgc2hvdWxkUHJvY2VlZCA9IGF3YWl0IG9uQmVmb3JlUXVlcnlDYWxsYmFjayhcbiAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgbGF0ZXN0TWVzc2FnZXMsXG4gICAgICAgICAgKVxuICAgICAgICAgIGlmICghc2hvdWxkUHJvY2VlZCkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgb25RdWVyeUltcGwoXG4gICAgICAgICAgbGF0ZXN0TWVzc2FnZXMsXG4gICAgICAgICAgbmV3TWVzc2FnZXMsXG4gICAgICAgICAgYWJvcnRDb250cm9sbGVyLFxuICAgICAgICAgIHNob3VsZFF1ZXJ5LFxuICAgICAgICAgIGFkZGl0aW9uYWxBbGxvd2VkVG9vbHMsXG4gICAgICAgICAgbWFpbkxvb3BNb2RlbFBhcmFtLFxuICAgICAgICAgIGVmZm9ydCxcbiAgICAgICAgKVxuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgLy8gcXVlcnlHdWFyZC5lbmQoKSBhdG9taWNhbGx5IGNoZWNrcyBnZW5lcmF0aW9uIGFuZCB0cmFuc2l0aW9uc1xuICAgICAgICAvLyBydW5uaW5n4oaSaWRsZS4gUmV0dXJucyBmYWxzZSBpZiBhIG5ld2VyIHF1ZXJ5IG93bnMgdGhlIGd1YXJkXG4gICAgICAgIC8vIChjYW5jZWwrcmVzdWJtaXQgcmFjZSB3aGVyZSB0aGUgc3RhbGUgZmluYWxseSBmaXJlcyBhcyBhIG1pY3JvdGFzaykuXG4gICAgICAgIGlmIChxdWVyeUd1YXJkLmVuZCh0aGlzR2VuZXJhdGlvbikpIHtcbiAgICAgICAgICBzZXRMYXN0UXVlcnlDb21wbGV0aW9uVGltZShEYXRlLm5vdygpKVxuICAgICAgICAgIHNraXBJZGxlQ2hlY2tSZWYuY3VycmVudCA9IGZhbHNlXG4gICAgICAgICAgLy8gQWx3YXlzIHJlc2V0IGxvYWRpbmcgc3RhdGUgaW4gZmluYWxseSAtIHRoaXMgZW5zdXJlcyBjbGVhbnVwIGV2ZW5cbiAgICAgICAgICAvLyBpZiBvblF1ZXJ5SW1wbCB0aHJvd3MuIG9uVHVybkNvbXBsZXRlIGlzIGNhbGxlZCBzZXBhcmF0ZWx5IGluXG4gICAgICAgICAgLy8gb25RdWVyeUltcGwgb25seSBvbiBzdWNjZXNzZnVsIGNvbXBsZXRpb24uXG4gICAgICAgICAgcmVzZXRMb2FkaW5nU3RhdGUoKVxuXG4gICAgICAgICAgYXdhaXQgbXJPblR1cm5Db21wbGV0ZShcbiAgICAgICAgICAgIG1lc3NhZ2VzUmVmLmN1cnJlbnQsXG4gICAgICAgICAgICBhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQsXG4gICAgICAgICAgKVxuXG4gICAgICAgICAgLy8gTm90aWZ5IGJyaWRnZSBjbGllbnRzIHRoYXQgdGhlIHR1cm4gaXMgY29tcGxldGUgc28gbW9iaWxlIGFwcHNcbiAgICAgICAgICAvLyBjYW4gc3RvcCB0aGUgc3BhcmsgYW5pbWF0aW9uIGFuZCBzaG93IHBvc3QtdHVybiBVSS5cbiAgICAgICAgICBzZW5kQnJpZGdlUmVzdWx0UmVmLmN1cnJlbnQoKVxuXG4gICAgICAgICAgLy8gQXV0by1oaWRlIHR1bmdzdGVuIHBhbmVsIGNvbnRlbnQgYXQgdHVybiBlbmQgKGFudC1vbmx5KSwgYnV0IGtlZXBcbiAgICAgICAgICAvLyB0dW5nc3RlbkFjdGl2ZVNlc3Npb24gc2V0IHNvIHRoZSBwaWxsIHN0YXlzIGluIHRoZSBmb290ZXIgYW5kIHRoZSB1c2VyXG4gICAgICAgICAgLy8gY2FuIHJlb3BlbiB0aGUgcGFuZWwuIEJhY2tncm91bmQgdG11eCB0YXNrcyAoZS5nLiAvaHVudGVyKSBydW4gZm9yXG4gICAgICAgICAgLy8gbWludXRlcyDigJQgd2lwaW5nIHRoZSBzZXNzaW9uIG1hZGUgdGhlIHBpbGwgZGlzYXBwZWFyIGVudGlyZWx5LCBmb3JjaW5nXG4gICAgICAgICAgLy8gdGhlIHVzZXIgdG8gcmUtaW52b2tlIFRtdXgganVzdCB0byBwZWVrLiBTa2lwIG9uIGFib3J0IHNvIHRoZSBwYW5lbFxuICAgICAgICAgIC8vIHN0YXlzIG9wZW4gZm9yIGluc3BlY3Rpb24gKG1hdGNoZXMgdGhlIHR1cm4tZHVyYXRpb24gZ3VhcmQgYmVsb3cpLlxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiZcbiAgICAgICAgICAgICFhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWRcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgICAgICBpZiAocHJldi50dW5nc3RlbkFjdGl2ZVNlc3Npb24gPT09IHVuZGVmaW5lZCkgcmV0dXJuIHByZXZcbiAgICAgICAgICAgICAgaWYgKHByZXYudHVuZ3N0ZW5QYW5lbEF1dG9IaWRkZW4gPT09IHRydWUpIHJldHVybiBwcmV2XG4gICAgICAgICAgICAgIHJldHVybiB7IC4uLnByZXYsIHR1bmdzdGVuUGFuZWxBdXRvSGlkZGVuOiB0cnVlIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ2FwdHVyZSBidWRnZXQgaW5mbyBiZWZvcmUgY2xlYXJpbmcgKGFudC1vbmx5KVxuICAgICAgICAgIGxldCBidWRnZXRJbmZvOlxuICAgICAgICAgICAgfCB7IHRva2VuczogbnVtYmVyOyBsaW1pdDogbnVtYmVyOyBudWRnZXM6IG51bWJlciB9XG4gICAgICAgICAgICB8IHVuZGVmaW5lZFxuICAgICAgICAgIGlmIChmZWF0dXJlKCdUT0tFTl9CVURHRVQnKSkge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBnZXRDdXJyZW50VHVyblRva2VuQnVkZ2V0KCkgIT09IG51bGwgJiZcbiAgICAgICAgICAgICAgZ2V0Q3VycmVudFR1cm5Ub2tlbkJ1ZGdldCgpISA+IDAgJiZcbiAgICAgICAgICAgICAgIWFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZFxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIGJ1ZGdldEluZm8gPSB7XG4gICAgICAgICAgICAgICAgdG9rZW5zOiBnZXRUdXJuT3V0cHV0VG9rZW5zKCksXG4gICAgICAgICAgICAgICAgbGltaXQ6IGdldEN1cnJlbnRUdXJuVG9rZW5CdWRnZXQoKSEsXG4gICAgICAgICAgICAgICAgbnVkZ2VzOiBnZXRCdWRnZXRDb250aW51YXRpb25Db3VudCgpLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzbmFwc2hvdE91dHB1dFRva2Vuc0ZvclR1cm4obnVsbClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBBZGQgdHVybiBkdXJhdGlvbiBtZXNzYWdlIGZvciB0dXJucyBsb25nZXIgdGhhbiAzMHMgb3Igd2l0aCBhIGJ1ZGdldFxuICAgICAgICAgIC8vIFNraXAgaWYgdXNlciBhYm9ydGVkIG9yIGlmIGluIGxvb3AgbW9kZSAodG9vIG5vaXN5IGJldHdlZW4gdGlja3MpXG4gICAgICAgICAgLy8gRGVmZXIgaWYgc3dhcm0gdGVhbW1hdGVzIGFyZSBzdGlsbCBydW5uaW5nIChzaG93IHdoZW4gdGhleSBmaW5pc2gpXG4gICAgICAgICAgY29uc3QgdHVybkR1cmF0aW9uTXMgPVxuICAgICAgICAgICAgRGF0ZS5ub3coKSAtIGxvYWRpbmdTdGFydFRpbWVSZWYuY3VycmVudCAtIHRvdGFsUGF1c2VkTXNSZWYuY3VycmVudFxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICh0dXJuRHVyYXRpb25NcyA+IDMwMDAwIHx8IGJ1ZGdldEluZm8gIT09IHVuZGVmaW5lZCkgJiZcbiAgICAgICAgICAgICFhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQgJiZcbiAgICAgICAgICAgICFwcm9hY3RpdmVBY3RpdmVcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnN0IGhhc1J1bm5pbmdTd2FybUFnZW50cyA9IGdldEFsbEluUHJvY2Vzc1RlYW1tYXRlVGFza3MoXG4gICAgICAgICAgICAgIHN0b3JlLmdldFN0YXRlKCkudGFza3MsXG4gICAgICAgICAgICApLnNvbWUodCA9PiB0LnN0YXR1cyA9PT0gJ3J1bm5pbmcnKVxuICAgICAgICAgICAgaWYgKGhhc1J1bm5pbmdTd2FybUFnZW50cykge1xuICAgICAgICAgICAgICAvLyBPbmx5IHJlY29yZCBzdGFydCB0aW1lIG9uIHRoZSBmaXJzdCBkZWZlcnJlZCB0dXJuXG4gICAgICAgICAgICAgIGlmIChzd2FybVN0YXJ0VGltZVJlZi5jdXJyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgc3dhcm1TdGFydFRpbWVSZWYuY3VycmVudCA9IGxvYWRpbmdTdGFydFRpbWVSZWYuY3VycmVudFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIEFsd2F5cyB1cGRhdGUgYnVkZ2V0IOKAlCBsYXRlciB0dXJucyBtYXkgY2FycnkgdGhlIGFjdHVhbCBidWRnZXRcbiAgICAgICAgICAgICAgaWYgKGJ1ZGdldEluZm8pIHtcbiAgICAgICAgICAgICAgICBzd2FybUJ1ZGdldEluZm9SZWYuY3VycmVudCA9IGJ1ZGdldEluZm9cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc2V0TWVzc2FnZXMocHJldiA9PiBbXG4gICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICBjcmVhdGVUdXJuRHVyYXRpb25NZXNzYWdlKFxuICAgICAgICAgICAgICAgICAgdHVybkR1cmF0aW9uTXMsXG4gICAgICAgICAgICAgICAgICBidWRnZXRJbmZvLFxuICAgICAgICAgICAgICAgICAgY291bnQocHJldiwgaXNMb2dnYWJsZU1lc3NhZ2UpLFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIENsZWFyIHRoZSBjb250cm9sbGVyIHNvIENhbmNlbFJlcXVlc3RIYW5kbGVyJ3MgY2FuQ2FuY2VsUnVubmluZ1Rhc2tcbiAgICAgICAgICAvLyByZWFkcyBmYWxzZSBhdCB0aGUgaWRsZSBwcm9tcHQuIFdpdGhvdXQgdGhpcywgdGhlIHN0YWxlIG5vbi1hYm9ydGVkXG4gICAgICAgICAgLy8gY29udHJvbGxlciBtYWtlcyBjdHJsK2MgZmlyZSBvbkNhbmNlbCgpIChhYm9ydGluZyBub3RoaW5nKSBpbnN0ZWFkIG9mXG4gICAgICAgICAgLy8gcHJvcGFnYXRpbmcgdG8gdGhlIGRvdWJsZS1wcmVzcyBleGl0IGZsb3cuXG4gICAgICAgICAgc2V0QWJvcnRDb250cm9sbGVyKG51bGwpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBBdXRvLXJlc3RvcmU6IGlmIHRoZSB1c2VyIGludGVycnVwdGVkIGJlZm9yZSBhbnkgbWVhbmluZ2Z1bCByZXNwb25zZVxuICAgICAgICAvLyBhcnJpdmVkLCByZXdpbmQgdGhlIGNvbnZlcnNhdGlvbiBhbmQgcmVzdG9yZSB0aGVpciBwcm9tcHQg4oCUIHNhbWUgYXNcbiAgICAgICAgLy8gb3BlbmluZyB0aGUgbWVzc2FnZSBzZWxlY3RvciBhbmQgcGlja2luZyB0aGUgbGFzdCBtZXNzYWdlLlxuICAgICAgICAvLyBUaGlzIHJ1bnMgT1VUU0lERSB0aGUgcXVlcnlHdWFyZC5lbmQoKSBjaGVjayBiZWNhdXNlIG9uQ2FuY2VsIGNhbGxzXG4gICAgICAgIC8vIGZvcmNlRW5kKCksIHdoaWNoIGJ1bXBzIHRoZSBnZW5lcmF0aW9uIHNvIGVuZCgpIHJldHVybnMgZmFsc2UgYWJvdmUuXG4gICAgICAgIC8vIEd1YXJkczogcmVhc29uID09PSAndXNlci1jYW5jZWwnIChvbkNhbmNlbC9Fc2M7IHByb2dyYW1tYXRpYyBhYm9ydHNcbiAgICAgICAgLy8gdXNlICdiYWNrZ3JvdW5kJy8naW50ZXJydXB0JyBhbmQgbXVzdCBub3QgcmV3aW5kIOKAlCBub3RlIGFib3J0KCkgd2l0aFxuICAgICAgICAvLyBubyBhcmdzIHNldHMgcmVhc29uIHRvIGEgRE9NRXhjZXB0aW9uLCBub3QgdW5kZWZpbmVkKSwgIWlzQWN0aXZlIChub1xuICAgICAgICAvLyBuZXdlciBxdWVyeSBzdGFydGVkIOKAlCBjYW5jZWwrcmVzdWJtaXQgcmFjZSksIGVtcHR5IGlucHV0IChkb24ndFxuICAgICAgICAvLyBjbG9iYmVyIHRleHQgdHlwZWQgZHVyaW5nIGxvYWRpbmcpLCBubyBxdWV1ZWQgY29tbWFuZHMgKHVzZXIgcXVldWVkXG4gICAgICAgIC8vIEIgd2hpbGUgQSB3YXMgbG9hZGluZyDihpIgdGhleSd2ZSBtb3ZlZCBvbiwgZG9uJ3QgcmVzdG9yZSBBOyBhbHNvXG4gICAgICAgIC8vIGF2b2lkcyByZW1vdmVMYXN0RnJvbUhpc3RvcnkgcmVtb3ZpbmcgQidzIGVudHJ5IGluc3RlYWQgb2YgQSdzKSxcbiAgICAgICAgLy8gbm90IHZpZXdpbmcgYSB0ZWFtbWF0ZSAobWVzc2FnZXNSZWYgaXMgdGhlIG1haW4gY29udmVyc2F0aW9uIOKAlCB0aGVcbiAgICAgICAgLy8gb2xkIFVwLWFycm93IHF1aWNrLXJlc3RvcmUgaGFkIHRoaXMgZ3VhcmQsIHByZXNlcnZlIGl0KS5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIGFib3J0Q29udHJvbGxlci5zaWduYWwucmVhc29uID09PSAndXNlci1jYW5jZWwnICYmXG4gICAgICAgICAgIXF1ZXJ5R3VhcmQuaXNBY3RpdmUgJiZcbiAgICAgICAgICBpbnB1dFZhbHVlUmVmLmN1cnJlbnQgPT09ICcnICYmXG4gICAgICAgICAgZ2V0Q29tbWFuZFF1ZXVlTGVuZ3RoKCkgPT09IDAgJiZcbiAgICAgICAgICAhc3RvcmUuZ2V0U3RhdGUoKS52aWV3aW5nQWdlbnRUYXNrSWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3QgbXNncyA9IG1lc3NhZ2VzUmVmLmN1cnJlbnRcbiAgICAgICAgICBjb25zdCBsYXN0VXNlck1zZyA9IG1zZ3MuZmluZExhc3Qoc2VsZWN0YWJsZVVzZXJNZXNzYWdlc0ZpbHRlcilcbiAgICAgICAgICBpZiAobGFzdFVzZXJNc2cpIHtcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IG1zZ3MubGFzdEluZGV4T2YobGFzdFVzZXJNc2cpXG4gICAgICAgICAgICBpZiAobWVzc2FnZXNBZnRlckFyZU9ubHlTeW50aGV0aWMobXNncywgaWR4KSkge1xuICAgICAgICAgICAgICAvLyBUaGUgc3VibWl0IGlzIGJlaW5nIHVuZG9uZSDigJQgdW5kbyBpdHMgaGlzdG9yeSBlbnRyeSB0b28sXG4gICAgICAgICAgICAgIC8vIG90aGVyd2lzZSBVcC1hcnJvdyBzaG93cyB0aGUgcmVzdG9yZWQgdGV4dCB0d2ljZS5cbiAgICAgICAgICAgICAgcmVtb3ZlTGFzdEZyb21IaXN0b3J5KClcbiAgICAgICAgICAgICAgcmVzdG9yZU1lc3NhZ2VTeW5jUmVmLmN1cnJlbnQobGFzdFVzZXJNc2cpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBbXG4gICAgICBvblF1ZXJ5SW1wbCxcbiAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgcmVzZXRMb2FkaW5nU3RhdGUsXG4gICAgICBxdWVyeUd1YXJkLFxuICAgICAgbXJPbkJlZm9yZVF1ZXJ5LFxuICAgICAgbXJPblR1cm5Db21wbGV0ZSxcbiAgICBdLFxuICApXG5cbiAgLy8gSGFuZGxlIGluaXRpYWwgbWVzc2FnZSAoZnJvbSBDTEkgYXJncyBvciBwbGFuIG1vZGUgZXhpdCB3aXRoIGNvbnRleHQgY2xlYXIpXG4gIC8vIFRoaXMgZWZmZWN0IHJ1bnMgd2hlbiBpc0xvYWRpbmcgYmVjb21lcyBmYWxzZSBhbmQgdGhlcmUncyBhIHBlbmRpbmcgbWVzc2FnZVxuICBjb25zdCBpbml0aWFsTWVzc2FnZVJlZiA9IHVzZVJlZihmYWxzZSlcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBwZW5kaW5nID0gaW5pdGlhbE1lc3NhZ2VcbiAgICBpZiAoIXBlbmRpbmcgfHwgaXNMb2FkaW5nIHx8IGluaXRpYWxNZXNzYWdlUmVmLmN1cnJlbnQpIHJldHVyblxuXG4gICAgLy8gTWFyayBhcyBwcm9jZXNzaW5nIHRvIHByZXZlbnQgcmUtZW50cnlcbiAgICBpbml0aWFsTWVzc2FnZVJlZi5jdXJyZW50ID0gdHJ1ZVxuXG4gICAgYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0luaXRpYWxNZXNzYWdlKFxuICAgICAgaW5pdGlhbE1zZzogTm9uTnVsbGFibGU8dHlwZW9mIHBlbmRpbmc+LFxuICAgICkge1xuICAgICAgLy8gQ2xlYXIgY29udGV4dCBpZiByZXF1ZXN0ZWQgKHBsYW4gbW9kZSBleGl0KVxuICAgICAgaWYgKGluaXRpYWxNc2cuY2xlYXJDb250ZXh0KSB7XG4gICAgICAgIC8vIFByZXNlcnZlIHRoZSBwbGFuIHNsdWcgYmVmb3JlIGNsZWFyaW5nIGNvbnRleHQsIHNvIHRoZSBuZXcgc2Vzc2lvblxuICAgICAgICAvLyBjYW4gYWNjZXNzIHRoZSBzYW1lIHBsYW4gZmlsZSBhZnRlciByZWdlbmVyYXRlU2Vzc2lvbklkKClcbiAgICAgICAgY29uc3Qgb2xkUGxhblNsdWcgPSBpbml0aWFsTXNnLm1lc3NhZ2UucGxhbkNvbnRlbnRcbiAgICAgICAgICA/IGdldFBsYW5TbHVnKClcbiAgICAgICAgICA6IHVuZGVmaW5lZFxuXG4gICAgICAgIGNvbnN0IHsgY2xlYXJDb252ZXJzYXRpb24gfSA9IGF3YWl0IGltcG9ydChcbiAgICAgICAgICAnLi4vY29tbWFuZHMvY2xlYXIvY29udmVyc2F0aW9uLmpzJ1xuICAgICAgICApXG4gICAgICAgIGF3YWl0IGNsZWFyQ29udmVyc2F0aW9uKHtcbiAgICAgICAgICBzZXRNZXNzYWdlcyxcbiAgICAgICAgICByZWFkRmlsZVN0YXRlOiByZWFkRmlsZVN0YXRlLmN1cnJlbnQsXG4gICAgICAgICAgZGlzY292ZXJlZFNraWxsTmFtZXM6IGRpc2NvdmVyZWRTa2lsbE5hbWVzUmVmLmN1cnJlbnQsXG4gICAgICAgICAgbG9hZGVkTmVzdGVkTWVtb3J5UGF0aHM6IGxvYWRlZE5lc3RlZE1lbW9yeVBhdGhzUmVmLmN1cnJlbnQsXG4gICAgICAgICAgZ2V0QXBwU3RhdGU6ICgpID0+IHN0b3JlLmdldFN0YXRlKCksXG4gICAgICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICAgICAgc2V0Q29udmVyc2F0aW9uSWQsXG4gICAgICAgIH0pXG4gICAgICAgIGhhaWt1VGl0bGVBdHRlbXB0ZWRSZWYuY3VycmVudCA9IGZhbHNlXG4gICAgICAgIHNldEhhaWt1VGl0bGUodW5kZWZpbmVkKVxuICAgICAgICBiYXNoVG9vbHMuY3VycmVudC5jbGVhcigpXG4gICAgICAgIGJhc2hUb29sc1Byb2Nlc3NlZElkeC5jdXJyZW50ID0gMFxuXG4gICAgICAgIC8vIFJlc3RvcmUgdGhlIHBsYW4gc2x1ZyBmb3IgdGhlIG5ldyBzZXNzaW9uIHNvIGdldFBsYW4oKSBmaW5kcyB0aGUgZmlsZVxuICAgICAgICBpZiAob2xkUGxhblNsdWcpIHtcbiAgICAgICAgICBzZXRQbGFuU2x1ZyhnZXRTZXNzaW9uSWQoKSwgb2xkUGxhblNsdWcpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQXRvbWljYWxseTogY2xlYXIgaW5pdGlhbCBtZXNzYWdlLCBzZXQgcGVybWlzc2lvbiBtb2RlIGFuZCBydWxlcywgYW5kIHN0b3JlIHBsYW4gZm9yIHZlcmlmaWNhdGlvblxuICAgICAgY29uc3Qgc2hvdWxkU3RvcmVQbGFuRm9yVmVyaWZpY2F0aW9uID1cbiAgICAgICAgaW5pdGlhbE1zZy5tZXNzYWdlLnBsYW5Db250ZW50ICYmXG4gICAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiZcbiAgICAgICAgaXNFbnZUcnV0aHkodW5kZWZpbmVkKVxuXG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgLy8gQnVpbGQgYW5kIGFwcGx5IHBlcm1pc3Npb24gdXBkYXRlcyAobW9kZSArIGFsbG93ZWRQcm9tcHRzIHJ1bGVzKVxuICAgICAgICBsZXQgdXBkYXRlZFRvb2xQZXJtaXNzaW9uQ29udGV4dCA9IGluaXRpYWxNc2cubW9kZVxuICAgICAgICAgID8gYXBwbHlQZXJtaXNzaW9uVXBkYXRlcyhcbiAgICAgICAgICAgICAgcHJldi50b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgICAgIGJ1aWxkUGVybWlzc2lvblVwZGF0ZXMoXG4gICAgICAgICAgICAgICAgaW5pdGlhbE1zZy5tb2RlLFxuICAgICAgICAgICAgICAgIGluaXRpYWxNc2cuYWxsb3dlZFByb21wdHMsXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICApXG4gICAgICAgICAgOiBwcmV2LnRvb2xQZXJtaXNzaW9uQ29udGV4dFxuICAgICAgICAvLyBGb3IgYXV0bywgb3ZlcnJpZGUgdGhlIG1vZGUgKGJ1aWxkUGVybWlzc2lvblVwZGF0ZXMgbWFwc1xuICAgICAgICAvLyBpdCB0byAnZGVmYXVsdCcgdmlhIHRvRXh0ZXJuYWxQZXJtaXNzaW9uTW9kZSkgYW5kIHN0cmlwIGRhbmdlcm91cyBydWxlc1xuICAgICAgICBpZiAoZmVhdHVyZSgnVFJBTlNDUklQVF9DTEFTU0lGSUVSJykgJiYgaW5pdGlhbE1zZy5tb2RlID09PSAnYXV0bycpIHtcbiAgICAgICAgICB1cGRhdGVkVG9vbFBlcm1pc3Npb25Db250ZXh0ID0gc3RyaXBEYW5nZXJvdXNQZXJtaXNzaW9uc0ZvckF1dG9Nb2RlKHtcbiAgICAgICAgICAgIC4uLnVwZGF0ZWRUb29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgICBtb2RlOiAnYXV0bycsXG4gICAgICAgICAgICBwcmVQbGFuTW9kZTogdW5kZWZpbmVkLFxuICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgaW5pdGlhbE1lc3NhZ2U6IG51bGwsXG4gICAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiB1cGRhdGVkVG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgICAgICAgIC4uLihzaG91bGRTdG9yZVBsYW5Gb3JWZXJpZmljYXRpb24gJiYge1xuICAgICAgICAgICAgcGVuZGluZ1BsYW5WZXJpZmljYXRpb246IHtcbiAgICAgICAgICAgICAgcGxhbjogaW5pdGlhbE1zZy5tZXNzYWdlLnBsYW5Db250ZW50ISxcbiAgICAgICAgICAgICAgdmVyaWZpY2F0aW9uU3RhcnRlZDogZmFsc2UsXG4gICAgICAgICAgICAgIHZlcmlmaWNhdGlvbkNvbXBsZXRlZDogZmFsc2UsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pLFxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICAvLyBDcmVhdGUgZmlsZSBoaXN0b3J5IHNuYXBzaG90IGZvciBjb2RlIHJld2luZFxuICAgICAgaWYgKGZpbGVIaXN0b3J5RW5hYmxlZCgpKSB7XG4gICAgICAgIHZvaWQgZmlsZUhpc3RvcnlNYWtlU25hcHNob3QoXG4gICAgICAgICAgKHVwZGF0ZXI6IChwcmV2OiBGaWxlSGlzdG9yeVN0YXRlKSA9PiBGaWxlSGlzdG9yeVN0YXRlKSA9PiB7XG4gICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgIGZpbGVIaXN0b3J5OiB1cGRhdGVyKHByZXYuZmlsZUhpc3RvcnkpLFxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbml0aWFsTXNnLm1lc3NhZ2UudXVpZCxcbiAgICAgICAgKVxuICAgICAgfVxuXG4gICAgICAvLyBFbnN1cmUgU2Vzc2lvblN0YXJ0IGhvb2sgY29udGV4dCBpcyBhdmFpbGFibGUgYmVmb3JlIHRoZSBmaXJzdCBBUElcbiAgICAgIC8vIGNhbGwuIG9uU3VibWl0IGNhbGxzIHRoaXMgaW50ZXJuYWxseSBidXQgdGhlIG9uUXVlcnkgcGF0aCBiZWxvd1xuICAgICAgLy8gYnlwYXNzZXMgb25TdWJtaXQg4oCUIGhvaXN0IGhlcmUgc28gYm90aCBwYXRocyBzZWUgaG9vayBtZXNzYWdlcy5cbiAgICAgIGF3YWl0IGF3YWl0UGVuZGluZ0hvb2tzKClcblxuICAgICAgLy8gUm91dGUgYWxsIGluaXRpYWwgcHJvbXB0cyB0aHJvdWdoIG9uU3VibWl0IHRvIGVuc3VyZSBVc2VyUHJvbXB0U3VibWl0IGhvb2tzIGZpcmVcbiAgICAgIC8vIFRPRE86IFNpbXBsaWZ5IGJ5IGFsd2F5cyByb3V0aW5nIHRocm91Z2ggb25TdWJtaXQgb25jZSBpdCBzdXBwb3J0c1xuICAgICAgLy8gQ29udGVudEJsb2NrUGFyYW0gYXJyYXlzIChpbWFnZXMpIGFzIGlucHV0XG4gICAgICBjb25zdCBjb250ZW50ID0gaW5pdGlhbE1zZy5tZXNzYWdlLm1lc3NhZ2UuY29udGVudFxuXG4gICAgICAvLyBSb3V0ZSBhbGwgc3RyaW5nIGNvbnRlbnQgdGhyb3VnaCBvblN1Ym1pdCB0byBlbnN1cmUgaG9va3MgZmlyZVxuICAgICAgLy8gRm9yIGNvbXBsZXggY29udGVudCAoaW1hZ2VzLCBldGMuKSwgZmFsbCBiYWNrIHRvIGRpcmVjdCBvblF1ZXJ5XG4gICAgICAvLyBQbGFuIG1lc3NhZ2VzIGJ5cGFzcyBvblN1Ym1pdCB0byBwcmVzZXJ2ZSBwbGFuQ29udGVudCBtZXRhZGF0YSBmb3IgcmVuZGVyaW5nXG4gICAgICBpZiAodHlwZW9mIGNvbnRlbnQgPT09ICdzdHJpbmcnICYmICFpbml0aWFsTXNnLm1lc3NhZ2UucGxhbkNvbnRlbnQpIHtcbiAgICAgICAgLy8gUm91dGUgdGhyb3VnaCBvblN1Ym1pdCBmb3IgcHJvcGVyIHByb2Nlc3NpbmcgaW5jbHVkaW5nIFVzZXJQcm9tcHRTdWJtaXQgaG9va3NcbiAgICAgICAgdm9pZCBvblN1Ym1pdChjb250ZW50LCB7XG4gICAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0OiAoKSA9PiB7fSxcbiAgICAgICAgICBjbGVhckJ1ZmZlcjogKCkgPT4ge30sXG4gICAgICAgICAgcmVzZXRIaXN0b3J5OiAoKSA9PiB7fSxcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFBsYW4gbWVzc2FnZXMgb3IgY29tcGxleCBjb250ZW50IChpbWFnZXMsIGV0Yy4pIC0gc2VuZCBkaXJlY3RseSB0byBtb2RlbFxuICAgICAgICAvLyBQbGFuIG1lc3NhZ2VzIHVzZSBvblF1ZXJ5IHRvIHByZXNlcnZlIHBsYW5Db250ZW50IG1ldGFkYXRhIGZvciByZW5kZXJpbmdcbiAgICAgICAgLy8gVE9ETzogT25jZSBvblN1Ym1pdCBzdXBwb3J0cyBDb250ZW50QmxvY2tQYXJhbSBhcnJheXMsIHJlbW92ZSB0aGlzIGJyYW5jaFxuICAgICAgICBjb25zdCBuZXdBYm9ydENvbnRyb2xsZXIgPSBjcmVhdGVBYm9ydENvbnRyb2xsZXIoKVxuICAgICAgICBzZXRBYm9ydENvbnRyb2xsZXIobmV3QWJvcnRDb250cm9sbGVyKVxuXG4gICAgICAgIHZvaWQgb25RdWVyeShcbiAgICAgICAgICBbaW5pdGlhbE1zZy5tZXNzYWdlXSxcbiAgICAgICAgICBuZXdBYm9ydENvbnRyb2xsZXIsXG4gICAgICAgICAgdHJ1ZSwgLy8gc2hvdWxkUXVlcnlcbiAgICAgICAgICBbXSwgLy8gYWRkaXRpb25hbEFsbG93ZWRUb29sc1xuICAgICAgICAgIG1haW5Mb29wTW9kZWwsXG4gICAgICAgIClcbiAgICAgIH1cblxuICAgICAgLy8gUmVzZXQgcmVmIGFmdGVyIGEgZGVsYXkgdG8gYWxsb3cgbmV3IGluaXRpYWwgbWVzc2FnZXNcbiAgICAgIHNldFRpbWVvdXQoXG4gICAgICAgIHJlZiA9PiB7XG4gICAgICAgICAgcmVmLmN1cnJlbnQgPSBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICAxMDAsXG4gICAgICAgIGluaXRpYWxNZXNzYWdlUmVmLFxuICAgICAgKVxuICAgIH1cblxuICAgIHZvaWQgcHJvY2Vzc0luaXRpYWxNZXNzYWdlKHBlbmRpbmcpXG4gIH0sIFtcbiAgICBpbml0aWFsTWVzc2FnZSxcbiAgICBpc0xvYWRpbmcsXG4gICAgc2V0TWVzc2FnZXMsXG4gICAgc2V0QXBwU3RhdGUsXG4gICAgb25RdWVyeSxcbiAgICBtYWluTG9vcE1vZGVsLFxuICAgIHRvb2xzLFxuICBdKVxuXG4gIGNvbnN0IG9uU3VibWl0ID0gdXNlQ2FsbGJhY2soXG4gICAgYXN5bmMgKFxuICAgICAgaW5wdXQ6IHN0cmluZyxcbiAgICAgIGhlbHBlcnM6IFByb21wdElucHV0SGVscGVycyxcbiAgICAgIHNwZWN1bGF0aW9uQWNjZXB0Pzoge1xuICAgICAgICBzdGF0ZTogQWN0aXZlU3BlY3VsYXRpb25TdGF0ZVxuICAgICAgICBzcGVjdWxhdGlvblNlc3Npb25UaW1lU2F2ZWRNczogbnVtYmVyXG4gICAgICAgIHNldEFwcFN0YXRlOiBTZXRBcHBTdGF0ZVxuICAgICAgfSxcbiAgICAgIG9wdGlvbnM/OiB7IGZyb21LZXliaW5kaW5nPzogYm9vbGVhbiB9LFxuICAgICkgPT4ge1xuICAgICAgLy8gUmUtcGluIHNjcm9sbCB0byBib3R0b20gb24gc3VibWl0IHNvIHRoZSB1c2VyIGFsd2F5cyBzZWVzIHRoZSBuZXdcbiAgICAgIC8vIGV4Y2hhbmdlIChtYXRjaGVzIE9wZW5Db2RlJ3MgYXV0by1zY3JvbGwgYmVoYXZpb3IpLlxuICAgICAgcmVwaW5TY3JvbGwoKVxuXG4gICAgICAvLyBSZXN1bWUgbG9vcCBtb2RlIGlmIHBhdXNlZFxuICAgICAgaWYgKGZlYXR1cmUoJ1BST0FDVElWRScpIHx8IGZlYXR1cmUoJ0tBSVJPUycpKSB7XG4gICAgICAgIHByb2FjdGl2ZU1vZHVsZT8ucmVzdW1lUHJvYWN0aXZlKClcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIGltbWVkaWF0ZSBjb21tYW5kcyAtIHRoZXNlIGJ5cGFzcyB0aGUgcXVldWUgYW5kIGV4ZWN1dGUgcmlnaHQgYXdheVxuICAgICAgLy8gZXZlbiB3aGlsZSBDbGF1ZGUgaXMgcHJvY2Vzc2luZy4gQ29tbWFuZHMgb3B0LWluIHZpYSBgaW1tZWRpYXRlOiB0cnVlYC5cbiAgICAgIC8vIENvbW1hbmRzIHRyaWdnZXJlZCB2aWEga2V5YmluZGluZ3MgYXJlIGFsd2F5cyB0cmVhdGVkIGFzIGltbWVkaWF0ZS5cbiAgICAgIGlmICghc3BlY3VsYXRpb25BY2NlcHQgJiYgaW5wdXQudHJpbSgpLnN0YXJ0c1dpdGgoJy8nKSkge1xuICAgICAgICAvLyBFeHBhbmQgW1Bhc3RlZCB0ZXh0ICNOXSByZWZzIHNvIGltbWVkaWF0ZSBjb21tYW5kcyAoZS5nLiAvYnR3KSByZWNlaXZlXG4gICAgICAgIC8vIHRoZSBwYXN0ZWQgY29udGVudCwgbm90IHRoZSBwbGFjZWhvbGRlci4gVGhlIG5vbi1pbW1lZGlhdGUgcGF0aCBnZXRzXG4gICAgICAgIC8vIHRoaXMgZXhwYW5zaW9uIGxhdGVyIGluIGhhbmRsZVByb21wdFN1Ym1pdC5cbiAgICAgICAgY29uc3QgdHJpbW1lZElucHV0ID0gZXhwYW5kUGFzdGVkVGV4dFJlZnMoaW5wdXQsIHBhc3RlZENvbnRlbnRzKS50cmltKClcbiAgICAgICAgY29uc3Qgc3BhY2VJbmRleCA9IHRyaW1tZWRJbnB1dC5pbmRleE9mKCcgJylcbiAgICAgICAgY29uc3QgY29tbWFuZE5hbWUgPVxuICAgICAgICAgIHNwYWNlSW5kZXggPT09IC0xXG4gICAgICAgICAgICA/IHRyaW1tZWRJbnB1dC5zbGljZSgxKVxuICAgICAgICAgICAgOiB0cmltbWVkSW5wdXQuc2xpY2UoMSwgc3BhY2VJbmRleClcbiAgICAgICAgY29uc3QgY29tbWFuZEFyZ3MgPVxuICAgICAgICAgIHNwYWNlSW5kZXggPT09IC0xID8gJycgOiB0cmltbWVkSW5wdXQuc2xpY2Uoc3BhY2VJbmRleCArIDEpLnRyaW0oKVxuXG4gICAgICAgIC8vIEZpbmQgbWF0Y2hpbmcgY29tbWFuZCAtIHRyZWF0IGFzIGltbWVkaWF0ZSBpZjpcbiAgICAgICAgLy8gMS4gQ29tbWFuZCBoYXMgYGltbWVkaWF0ZTogdHJ1ZWAsIE9SXG4gICAgICAgIC8vIDIuIENvbW1hbmQgd2FzIHRyaWdnZXJlZCB2aWEga2V5YmluZGluZyAoZnJvbUtleWJpbmRpbmcgb3B0aW9uKVxuICAgICAgICBjb25zdCBtYXRjaGluZ0NvbW1hbmQgPSBjb21tYW5kcy5maW5kKFxuICAgICAgICAgIGNtZCA9PlxuICAgICAgICAgICAgaXNDb21tYW5kRW5hYmxlZChjbWQpICYmXG4gICAgICAgICAgICAoY21kLm5hbWUgPT09IGNvbW1hbmROYW1lIHx8XG4gICAgICAgICAgICAgIGNtZC5hbGlhc2VzPy5pbmNsdWRlcyhjb21tYW5kTmFtZSkgfHxcbiAgICAgICAgICAgICAgZ2V0Q29tbWFuZE5hbWUoY21kKSA9PT0gY29tbWFuZE5hbWUpLFxuICAgICAgICApXG4gICAgICAgIGlmIChtYXRjaGluZ0NvbW1hbmQ/Lm5hbWUgPT09ICdjbGVhcicgJiYgaWRsZUhpbnRTaG93blJlZi5jdXJyZW50KSB7XG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2lkbGVfcmV0dXJuX2FjdGlvbicsIHtcbiAgICAgICAgICAgIGFjdGlvbjpcbiAgICAgICAgICAgICAgJ2hpbnRfY29udmVydGVkJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgdmFyaWFudDpcbiAgICAgICAgICAgICAgaWRsZUhpbnRTaG93blJlZi5jdXJyZW50IGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICBpZGxlTWludXRlczogTWF0aC5yb3VuZChcbiAgICAgICAgICAgICAgKERhdGUubm93KCkgLSBsYXN0UXVlcnlDb21wbGV0aW9uVGltZVJlZi5jdXJyZW50KSAvIDYwXzAwMCxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBtZXNzYWdlQ291bnQ6IG1lc3NhZ2VzUmVmLmN1cnJlbnQubGVuZ3RoLFxuICAgICAgICAgICAgdG90YWxJbnB1dFRva2VuczogZ2V0VG90YWxJbnB1dFRva2VucygpLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgaWRsZUhpbnRTaG93blJlZi5jdXJyZW50ID0gZmFsc2VcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNob3VsZFRyZWF0QXNJbW1lZGlhdGUgPVxuICAgICAgICAgIHF1ZXJ5R3VhcmQuaXNBY3RpdmUgJiZcbiAgICAgICAgICAobWF0Y2hpbmdDb21tYW5kPy5pbW1lZGlhdGUgfHwgb3B0aW9ucz8uZnJvbUtleWJpbmRpbmcpXG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIG1hdGNoaW5nQ29tbWFuZCAmJlxuICAgICAgICAgIHNob3VsZFRyZWF0QXNJbW1lZGlhdGUgJiZcbiAgICAgICAgICBtYXRjaGluZ0NvbW1hbmQudHlwZSA9PT0gJ2xvY2FsLWpzeCdcbiAgICAgICAgKSB7XG4gICAgICAgICAgLy8gT25seSBjbGVhciBpbnB1dCBpZiB0aGUgc3VibWl0dGVkIHRleHQgbWF0Y2hlcyB3aGF0J3MgaW4gdGhlIHByb21wdC5cbiAgICAgICAgICAvLyBXaGVuIGEgY29tbWFuZCBrZXliaW5kaW5nIGZpcmVzLCBpbnB1dCBpcyBcIi88Y29tbWFuZD5cIiBidXQgdGhlIGFjdHVhbFxuICAgICAgICAgIC8vIGlucHV0IHZhbHVlIGlzIHRoZSB1c2VyJ3MgZXhpc3RpbmcgdGV4dCAtIGRvbid0IGNsZWFyIGl0IGluIHRoYXQgY2FzZS5cbiAgICAgICAgICBpZiAoaW5wdXQudHJpbSgpID09PSBpbnB1dFZhbHVlUmVmLmN1cnJlbnQudHJpbSgpKSB7XG4gICAgICAgICAgICBzZXRJbnB1dFZhbHVlKCcnKVxuICAgICAgICAgICAgaGVscGVycy5zZXRDdXJzb3JPZmZzZXQoMClcbiAgICAgICAgICAgIGhlbHBlcnMuY2xlYXJCdWZmZXIoKVxuICAgICAgICAgICAgc2V0UGFzdGVkQ29udGVudHMoe30pXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcGFzdGVkVGV4dFJlZnMgPSBwYXJzZVJlZmVyZW5jZXMoaW5wdXQpLmZpbHRlcihcbiAgICAgICAgICAgIHIgPT4gcGFzdGVkQ29udGVudHNbci5pZF0/LnR5cGUgPT09ICd0ZXh0JyxcbiAgICAgICAgICApXG4gICAgICAgICAgY29uc3QgcGFzdGVkVGV4dENvdW50ID0gcGFzdGVkVGV4dFJlZnMubGVuZ3RoXG4gICAgICAgICAgY29uc3QgcGFzdGVkVGV4dEJ5dGVzID0gcGFzdGVkVGV4dFJlZnMucmVkdWNlKFxuICAgICAgICAgICAgKHN1bSwgcikgPT4gc3VtICsgKHBhc3RlZENvbnRlbnRzW3IuaWRdPy5jb250ZW50Lmxlbmd0aCA/PyAwKSxcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgKVxuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9wYXN0ZV90ZXh0JywgeyBwYXN0ZWRUZXh0Q291bnQsIHBhc3RlZFRleHRCeXRlcyB9KVxuICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9pbW1lZGlhdGVfY29tbWFuZF9leGVjdXRlZCcsIHtcbiAgICAgICAgICAgIGNvbW1hbmROYW1lOlxuICAgICAgICAgICAgICBtYXRjaGluZ0NvbW1hbmQubmFtZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgZnJvbUtleWJpbmRpbmc6IG9wdGlvbnM/LmZyb21LZXliaW5kaW5nID8/IGZhbHNlLFxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICAvLyBFeGVjdXRlIHRoZSBjb21tYW5kIGRpcmVjdGx5XG4gICAgICAgICAgY29uc3QgZXhlY3V0ZUltbWVkaWF0ZUNvbW1hbmQgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICBsZXQgZG9uZVdhc0NhbGxlZCA9IGZhbHNlXG4gICAgICAgICAgICBjb25zdCBvbkRvbmUgPSAoXG4gICAgICAgICAgICAgIHJlc3VsdD86IHN0cmluZyxcbiAgICAgICAgICAgICAgZG9uZU9wdGlvbnM/OiB7XG4gICAgICAgICAgICAgICAgZGlzcGxheT86IENvbW1hbmRSZXN1bHREaXNwbGF5XG4gICAgICAgICAgICAgICAgbWV0YU1lc3NhZ2VzPzogc3RyaW5nW11cbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICk6IHZvaWQgPT4ge1xuICAgICAgICAgICAgICBkb25lV2FzQ2FsbGVkID0gdHJ1ZVxuICAgICAgICAgICAgICBzZXRUb29sSlNYKHtcbiAgICAgICAgICAgICAgICBqc3g6IG51bGwsXG4gICAgICAgICAgICAgICAgc2hvdWxkSGlkZVByb21wdElucHV0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjbGVhckxvY2FsSlNYOiB0cnVlLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICBjb25zdCBuZXdNZXNzYWdlczogTWVzc2FnZVR5cGVbXSA9IFtdXG4gICAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgZG9uZU9wdGlvbnM/LmRpc3BsYXkgIT09ICdza2lwJykge1xuICAgICAgICAgICAgICAgIGFkZE5vdGlmaWNhdGlvbih7XG4gICAgICAgICAgICAgICAgICBrZXk6IGBpbW1lZGlhdGUtJHttYXRjaGluZ0NvbW1hbmQubmFtZX1gLFxuICAgICAgICAgICAgICAgICAgdGV4dDogcmVzdWx0LFxuICAgICAgICAgICAgICAgICAgcHJpb3JpdHk6ICdpbW1lZGlhdGUnLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLy8gSW4gZnVsbHNjcmVlbiB0aGUgY29tbWFuZCBqdXN0IHNob3dlZCBhcyBhIGNlbnRlcmVkIG1vZGFsXG4gICAgICAgICAgICAgICAgLy8gcGFuZSDigJQgdGhlIG5vdGlmaWNhdGlvbiBhYm92ZSBpcyBlbm91Z2ggZmVlZGJhY2suIEFkZGluZ1xuICAgICAgICAgICAgICAgIC8vIFwi4p2vIC9jb25maWdcIiArIFwi4o6/IGRpc21pc3NlZFwiIHRvIHRoZSB0cmFuc2NyaXB0IGlzIGNsdXR0ZXJcbiAgICAgICAgICAgICAgICAvLyAodGhvc2UgbWVzc2FnZXMgYXJlIHR5cGU6c3lzdGVtIHN1YnR5cGU6bG9jYWxfY29tbWFuZCDigJRcbiAgICAgICAgICAgICAgICAvLyB1c2VyLXZpc2libGUgYnV0IE5PVCBzZW50IHRvIHRoZSBtb2RlbCwgc28gc2tpcHBpbmcgdGhlbVxuICAgICAgICAgICAgICAgIC8vIGRvZXNuJ3QgY2hhbmdlIG1vZGVsIGNvbnRleHQpLiBPdXRzaWRlIGZ1bGxzY3JlZW4gdGhlXG4gICAgICAgICAgICAgICAgLy8gdHJhbnNjcmlwdCBlbnRyeSBzdGF5cyBzbyBzY3JvbGxiYWNrIHNob3dzIHdoYXQgcmFuLlxuICAgICAgICAgICAgICAgIGlmICghaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpKSB7XG4gICAgICAgICAgICAgICAgICBuZXdNZXNzYWdlcy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVDb21tYW5kSW5wdXRNZXNzYWdlKFxuICAgICAgICAgICAgICAgICAgICAgIGZvcm1hdENvbW1hbmRJbnB1dFRhZ3MoXG4gICAgICAgICAgICAgICAgICAgICAgICBnZXRDb21tYW5kTmFtZShtYXRjaGluZ0NvbW1hbmQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWFuZEFyZ3MsXG4gICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlQ29tbWFuZElucHV0TWVzc2FnZShcbiAgICAgICAgICAgICAgICAgICAgICBgPCR7TE9DQUxfQ09NTUFORF9TVERPVVRfVEFHfT4ke2VzY2FwZVhtbChyZXN1bHQpfTwvJHtMT0NBTF9DT01NQU5EX1NURE9VVF9UQUd9PmAsXG4gICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIEluamVjdCBtZXRhIG1lc3NhZ2VzIChtb2RlbC12aXNpYmxlLCB1c2VyLWhpZGRlbikgaW50byB0aGUgdHJhbnNjcmlwdFxuICAgICAgICAgICAgICBpZiAoZG9uZU9wdGlvbnM/Lm1ldGFNZXNzYWdlcz8ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgbmV3TWVzc2FnZXMucHVzaChcbiAgICAgICAgICAgICAgICAgIC4uLmRvbmVPcHRpb25zLm1ldGFNZXNzYWdlcy5tYXAoY29udGVudCA9PlxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVVc2VyTWVzc2FnZSh7IGNvbnRlbnQsIGlzTWV0YTogdHJ1ZSB9KSxcbiAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChuZXdNZXNzYWdlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzZXRNZXNzYWdlcyhwcmV2ID0+IFsuLi5wcmV2LCAuLi5uZXdNZXNzYWdlc10pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gUmVzdG9yZSBzdGFzaGVkIHByb21wdCBhZnRlciBsb2NhbC1qc3ggY29tbWFuZCBjb21wbGV0ZXMuXG4gICAgICAgICAgICAgIC8vIFRoZSBub3JtYWwgc3Rhc2ggcmVzdG9yYXRpb24gcGF0aCAoYmVsb3cpIGlzIHNraXBwZWQgYmVjYXVzZVxuICAgICAgICAgICAgICAvLyBsb2NhbC1qc3ggY29tbWFuZHMgcmV0dXJuIGVhcmx5IGZyb20gb25TdWJtaXQuXG4gICAgICAgICAgICAgIGlmIChzdGFzaGVkUHJvbXB0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBzZXRJbnB1dFZhbHVlKHN0YXNoZWRQcm9tcHQudGV4dClcbiAgICAgICAgICAgICAgICBoZWxwZXJzLnNldEN1cnNvck9mZnNldChzdGFzaGVkUHJvbXB0LmN1cnNvck9mZnNldClcbiAgICAgICAgICAgICAgICBzZXRQYXN0ZWRDb250ZW50cyhzdGFzaGVkUHJvbXB0LnBhc3RlZENvbnRlbnRzKVxuICAgICAgICAgICAgICAgIHNldFN0YXNoZWRQcm9tcHQodW5kZWZpbmVkKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEJ1aWxkIGNvbnRleHQgZm9yIHRoZSBjb21tYW5kIChyZXVzZXMgZXhpc3RpbmcgZ2V0VG9vbFVzZUNvbnRleHQpLlxuICAgICAgICAgICAgLy8gUmVhZCBtZXNzYWdlcyB2aWEgcmVmIHRvIGtlZXAgb25TdWJtaXQgc3RhYmxlIGFjcm9zcyBtZXNzYWdlXG4gICAgICAgICAgICAvLyB1cGRhdGVzIOKAlCBtYXRjaGVzIHRoZSBwYXR0ZXJuIGF0IEwyMzg0L0wyNDAwL0wyNjYyIGFuZCBhdm9pZHNcbiAgICAgICAgICAgIC8vIHBpbm5pbmcgc3RhbGUgUkVQTCByZW5kZXIgc2NvcGVzIGluIGRvd25zdHJlYW0gY2xvc3VyZXMuXG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gZ2V0VG9vbFVzZUNvbnRleHQoXG4gICAgICAgICAgICAgIG1lc3NhZ2VzUmVmLmN1cnJlbnQsXG4gICAgICAgICAgICAgIFtdLFxuICAgICAgICAgICAgICBjcmVhdGVBYm9ydENvbnRyb2xsZXIoKSxcbiAgICAgICAgICAgICAgbWFpbkxvb3BNb2RlbCxcbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgY29uc3QgbW9kID0gYXdhaXQgbWF0Y2hpbmdDb21tYW5kLmxvYWQoKVxuICAgICAgICAgICAgY29uc3QganN4ID0gYXdhaXQgbW9kLmNhbGwob25Eb25lLCBjb250ZXh0LCBjb21tYW5kQXJncylcblxuICAgICAgICAgICAgLy8gU2tpcCBpZiBvbkRvbmUgYWxyZWFkeSBmaXJlZCDigJQgcHJldmVudHMgc3R1Y2sgaXNMb2NhbEpTWENvbW1hbmRcbiAgICAgICAgICAgIC8vIChzZWUgcHJvY2Vzc1NsYXNoQ29tbWFuZC50c3ggbG9jYWwtanN4IGNhc2UgZm9yIGZ1bGwgbWVjaGFuaXNtKS5cbiAgICAgICAgICAgIGlmIChqc3ggJiYgIWRvbmVXYXNDYWxsZWQpIHtcbiAgICAgICAgICAgICAgLy8gc2hvdWxkSGlkZVByb21wdElucHV0OiBmYWxzZSBrZWVwcyBOb3RpZmljYXRpb25zIG1vdW50ZWRcbiAgICAgICAgICAgICAgLy8gc28gdGhlIG9uRG9uZSByZXN1bHQgaXNuJ3QgbG9zdFxuICAgICAgICAgICAgICBzZXRUb29sSlNYKHtcbiAgICAgICAgICAgICAgICBqc3gsXG4gICAgICAgICAgICAgICAgc2hvdWxkSGlkZVByb21wdElucHV0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBpc0xvY2FsSlNYQ29tbWFuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdm9pZCBleGVjdXRlSW1tZWRpYXRlQ29tbWFuZCgpXG4gICAgICAgICAgcmV0dXJuIC8vIEFsd2F5cyByZXR1cm4gZWFybHkgLSBkb24ndCBhZGQgdG8gaGlzdG9yeSBvciBxdWV1ZVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbW90ZSBtb2RlOiBza2lwIGVtcHR5IGlucHV0IGVhcmx5IGJlZm9yZSBhbnkgc3RhdGUgbXV0YXRpb25zXG4gICAgICBpZiAoYWN0aXZlUmVtb3RlLmlzUmVtb3RlTW9kZSAmJiAhaW5wdXQudHJpbSgpKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBJZGxlLXJldHVybjogcHJvbXB0IHJldHVybmluZyB1c2VycyB0byBzdGFydCBmcmVzaCB3aGVuIHRoZVxuICAgICAgLy8gY29udmVyc2F0aW9uIGlzIGxhcmdlIGFuZCB0aGUgY2FjaGUgaXMgY29sZC4gdGVuZ3Vfd2lsbG93X21vZGVcbiAgICAgIC8vIGNvbnRyb2xzIHRyZWF0bWVudDogXCJkaWFsb2dcIiAoYmxvY2tpbmcpLCBcImhpbnRcIiAobm90aWZpY2F0aW9uKSwgXCJvZmZcIi5cbiAgICAgIHtcbiAgICAgICAgY29uc3Qgd2lsbG93TW9kZSA9IGdldEZlYXR1cmVWYWx1ZV9DQUNIRURfTUFZX0JFX1NUQUxFKFxuICAgICAgICAgICd0ZW5ndV93aWxsb3dfbW9kZScsXG4gICAgICAgICAgJ29mZicsXG4gICAgICAgIClcbiAgICAgICAgY29uc3QgaWRsZVRocmVzaG9sZE1pbiA9IE51bWJlcihcbiAgICAgICAgICBwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9JRExFX1RIUkVTSE9MRF9NSU5VVEVTID8/IDc1LFxuICAgICAgICApXG4gICAgICAgIGNvbnN0IHRva2VuVGhyZXNob2xkID0gTnVtYmVyKFxuICAgICAgICAgIHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0lETEVfVE9LRU5fVEhSRVNIT0xEID8/IDEwMF8wMDAsXG4gICAgICAgIClcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHdpbGxvd01vZGUgIT09ICdvZmYnICYmXG4gICAgICAgICAgIWdldEdsb2JhbENvbmZpZygpLmlkbGVSZXR1cm5EaXNtaXNzZWQgJiZcbiAgICAgICAgICAhc2tpcElkbGVDaGVja1JlZi5jdXJyZW50ICYmXG4gICAgICAgICAgIXNwZWN1bGF0aW9uQWNjZXB0ICYmXG4gICAgICAgICAgIWlucHV0LnRyaW0oKS5zdGFydHNXaXRoKCcvJykgJiZcbiAgICAgICAgICBsYXN0UXVlcnlDb21wbGV0aW9uVGltZVJlZi5jdXJyZW50ID4gMCAmJlxuICAgICAgICAgIGdldFRvdGFsSW5wdXRUb2tlbnMoKSA+PSB0b2tlblRocmVzaG9sZFxuICAgICAgICApIHtcbiAgICAgICAgICBjb25zdCBpZGxlTXMgPSBEYXRlLm5vdygpIC0gbGFzdFF1ZXJ5Q29tcGxldGlvblRpbWVSZWYuY3VycmVudFxuICAgICAgICAgIGNvbnN0IGlkbGVNaW51dGVzID0gaWRsZU1zIC8gNjBfMDAwXG4gICAgICAgICAgaWYgKGlkbGVNaW51dGVzID49IGlkbGVUaHJlc2hvbGRNaW4gJiYgd2lsbG93TW9kZSA9PT0gJ2RpYWxvZycpIHtcbiAgICAgICAgICAgIHNldElkbGVSZXR1cm5QZW5kaW5nKHsgaW5wdXQsIGlkbGVNaW51dGVzIH0pXG4gICAgICAgICAgICBzZXRJbnB1dFZhbHVlKCcnKVxuICAgICAgICAgICAgaGVscGVycy5zZXRDdXJzb3JPZmZzZXQoMClcbiAgICAgICAgICAgIGhlbHBlcnMuY2xlYXJCdWZmZXIoKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCB0byBoaXN0b3J5IGZvciBkaXJlY3QgdXNlciBzdWJtaXNzaW9ucy5cbiAgICAgIC8vIFF1ZXVlZCBjb21tYW5kIHByb2Nlc3NpbmcgKGV4ZWN1dGVRdWV1ZWRJbnB1dCkgZG9lc24ndCBjYWxsIG9uU3VibWl0LFxuICAgICAgLy8gc28gbm90aWZpY2F0aW9ucyBhbmQgYWxyZWFkeS1xdWV1ZWQgdXNlciBpbnB1dCB3b24ndCBiZSBhZGRlZCB0byBoaXN0b3J5IGhlcmUuXG4gICAgICAvLyBTa2lwIGhpc3RvcnkgZm9yIGtleWJpbmRpbmctdHJpZ2dlcmVkIGNvbW1hbmRzICh1c2VyIGRpZG4ndCB0eXBlIHRoZSBjb21tYW5kKS5cbiAgICAgIGlmICghb3B0aW9ucz8uZnJvbUtleWJpbmRpbmcpIHtcbiAgICAgICAgYWRkVG9IaXN0b3J5KHtcbiAgICAgICAgICBkaXNwbGF5OiBzcGVjdWxhdGlvbkFjY2VwdFxuICAgICAgICAgICAgPyBpbnB1dFxuICAgICAgICAgICAgOiBwcmVwZW5kTW9kZUNoYXJhY3RlclRvSW5wdXQoaW5wdXQsIGlucHV0TW9kZSksXG4gICAgICAgICAgcGFzdGVkQ29udGVudHM6IHNwZWN1bGF0aW9uQWNjZXB0ID8ge30gOiBwYXN0ZWRDb250ZW50cyxcbiAgICAgICAgfSlcbiAgICAgICAgLy8gQWRkIHRoZSBqdXN0LXN1Ym1pdHRlZCBjb21tYW5kIHRvIHRoZSBmcm9udCBvZiB0aGUgZ2hvc3QtdGV4dFxuICAgICAgICAvLyBjYWNoZSBzbyBpdCdzIHN1Z2dlc3RlZCBpbW1lZGlhdGVseSAobm90IGFmdGVyIHRoZSA2MHMgVFRMKS5cbiAgICAgICAgaWYgKGlucHV0TW9kZSA9PT0gJ2Jhc2gnKSB7XG4gICAgICAgICAgcHJlcGVuZFRvU2hlbGxIaXN0b3J5Q2FjaGUoaW5wdXQudHJpbSgpKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc3RvcmUgc3Rhc2ggaWYgcHJlc2VudCwgYnV0IE5PVCBmb3Igc2xhc2ggY29tbWFuZHMgb3Igd2hlbiBsb2FkaW5nLlxuICAgICAgLy8gLSBTbGFzaCBjb21tYW5kcyAoZXNwZWNpYWxseSBpbnRlcmFjdGl2ZSBvbmVzIGxpa2UgL21vZGVsLCAvY29udGV4dCkgaGlkZVxuICAgICAgLy8gICB0aGUgcHJvbXB0IGFuZCBzaG93IGEgcGlja2VyIFVJLiBSZXN0b3JpbmcgdGhlIHN0YXNoIGR1cmluZyBhIGNvbW1hbmQgd291bGRcbiAgICAgIC8vICAgcGxhY2UgdGhlIHRleHQgaW4gYSBoaWRkZW4gaW5wdXQsIGFuZCB0aGUgdXNlciB3b3VsZCBsb3NlIGl0IGJ5IHR5cGluZyB0aGVcbiAgICAgIC8vICAgbmV4dCBjb21tYW5kLiBJbnN0ZWFkLCBwcmVzZXJ2ZSB0aGUgc3Rhc2ggc28gaXQgc3Vydml2ZXMgYWNyb3NzIGNvbW1hbmQgcnVucy5cbiAgICAgIC8vIC0gV2hlbiBsb2FkaW5nLCB0aGUgc3VibWl0dGVkIGlucHV0IHdpbGwgYmUgcXVldWVkIGFuZCBoYW5kbGVQcm9tcHRTdWJtaXRcbiAgICAgIC8vICAgd2lsbCBjbGVhciB0aGUgaW5wdXQgZmllbGQgKG9uSW5wdXRDaGFuZ2UoJycpKSwgd2hpY2ggd291bGQgY2xvYmJlciB0aGVcbiAgICAgIC8vICAgcmVzdG9yZWQgc3Rhc2guIERlZmVyIHJlc3RvcmF0aW9uIHRvIGFmdGVyIGhhbmRsZVByb21wdFN1Ym1pdCAoYmVsb3cpLlxuICAgICAgLy8gICBSZW1vdGUgbW9kZSBpcyBleGVtcHQ6IGl0IHNlbmRzIHZpYSBXZWJTb2NrZXQgYW5kIHJldHVybnMgZWFybHkgd2l0aG91dFxuICAgICAgLy8gICBjYWxsaW5nIGhhbmRsZVByb21wdFN1Ym1pdCwgc28gdGhlcmUncyBubyBjbG9iYmVyaW5nIHJpc2sg4oCUIHJlc3RvcmUgZWFnZXJseS5cbiAgICAgIC8vIEluIGJvdGggZGVmZXJyZWQgY2FzZXMsIHRoZSBzdGFzaCBpcyByZXN0b3JlZCBhZnRlciBhd2FpdCBoYW5kbGVQcm9tcHRTdWJtaXQuXG4gICAgICBjb25zdCBpc1NsYXNoQ29tbWFuZCA9ICFzcGVjdWxhdGlvbkFjY2VwdCAmJiBpbnB1dC50cmltKCkuc3RhcnRzV2l0aCgnLycpXG4gICAgICAvLyBTdWJtaXQgcnVucyBcIm5vd1wiIChub3QgcXVldWVkKSB3aGVuIG5vdCBhbHJlYWR5IGxvYWRpbmcsIG9yIHdoZW5cbiAgICAgIC8vIGFjY2VwdGluZyBzcGVjdWxhdGlvbiwgb3IgaW4gcmVtb3RlIG1vZGUgKHdoaWNoIHNlbmRzIHZpYSBXUyBhbmRcbiAgICAgIC8vIHJldHVybnMgZWFybHkgd2l0aG91dCBjYWxsaW5nIGhhbmRsZVByb21wdFN1Ym1pdCkuXG4gICAgICBjb25zdCBzdWJtaXRzTm93ID1cbiAgICAgICAgIWlzTG9hZGluZyB8fCBzcGVjdWxhdGlvbkFjY2VwdCB8fCBhY3RpdmVSZW1vdGUuaXNSZW1vdGVNb2RlXG4gICAgICBpZiAoc3Rhc2hlZFByb21wdCAhPT0gdW5kZWZpbmVkICYmICFpc1NsYXNoQ29tbWFuZCAmJiBzdWJtaXRzTm93KSB7XG4gICAgICAgIHNldElucHV0VmFsdWUoc3Rhc2hlZFByb21wdC50ZXh0KVxuICAgICAgICBoZWxwZXJzLnNldEN1cnNvck9mZnNldChzdGFzaGVkUHJvbXB0LmN1cnNvck9mZnNldClcbiAgICAgICAgc2V0UGFzdGVkQ29udGVudHMoc3Rhc2hlZFByb21wdC5wYXN0ZWRDb250ZW50cylcbiAgICAgICAgc2V0U3Rhc2hlZFByb21wdCh1bmRlZmluZWQpXG4gICAgICB9IGVsc2UgaWYgKHN1Ym1pdHNOb3cpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zPy5mcm9tS2V5YmluZGluZykge1xuICAgICAgICAgIC8vIENsZWFyIGlucHV0IHdoZW4gbm90IGxvYWRpbmcgb3IgYWNjZXB0aW5nIHNwZWN1bGF0aW9uLlxuICAgICAgICAgIC8vIFByZXNlcnZlIGlucHV0IGZvciBrZXliaW5kaW5nLXRyaWdnZXJlZCBjb21tYW5kcy5cbiAgICAgICAgICBzZXRJbnB1dFZhbHVlKCcnKVxuICAgICAgICAgIGhlbHBlcnMuc2V0Q3Vyc29yT2Zmc2V0KDApXG4gICAgICAgIH1cbiAgICAgICAgc2V0UGFzdGVkQ29udGVudHMoe30pXG4gICAgICB9XG5cbiAgICAgIGlmIChzdWJtaXRzTm93KSB7XG4gICAgICAgIHNldElucHV0TW9kZSgncHJvbXB0JylcbiAgICAgICAgc2V0SURFU2VsZWN0aW9uKHVuZGVmaW5lZClcbiAgICAgICAgc2V0U3VibWl0Q291bnQoXyA9PiBfICsgMSlcbiAgICAgICAgaGVscGVycy5jbGVhckJ1ZmZlcigpXG4gICAgICAgIHRpcFBpY2tlZFRoaXNUdXJuUmVmLmN1cnJlbnQgPSBmYWxzZVxuXG4gICAgICAgIC8vIFNob3cgdGhlIHBsYWNlaG9sZGVyIGluIHRoZSBzYW1lIFJlYWN0IGJhdGNoIGFzIHNldElucHV0VmFsdWUoJycpLlxuICAgICAgICAvLyBTa2lwIGZvciBzbGFzaC9iYXNoICh0aGV5IGhhdmUgdGhlaXIgb3duIGVjaG8pLCBzcGVjdWxhdGlvbiBhbmQgcmVtb3RlXG4gICAgICAgIC8vIG1vZGUgKGJvdGggc2V0TWVzc2FnZXMgZGlyZWN0bHkgd2l0aCBubyBnYXAgdG8gYnJpZGdlKS5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICFpc1NsYXNoQ29tbWFuZCAmJlxuICAgICAgICAgIGlucHV0TW9kZSA9PT0gJ3Byb21wdCcgJiZcbiAgICAgICAgICAhc3BlY3VsYXRpb25BY2NlcHQgJiZcbiAgICAgICAgICAhYWN0aXZlUmVtb3RlLmlzUmVtb3RlTW9kZVxuICAgICAgICApIHtcbiAgICAgICAgICBzZXRVc2VySW5wdXRPblByb2Nlc3NpbmcoaW5wdXQpXG4gICAgICAgICAgLy8gc2hvd1NwaW5uZXIgaW5jbHVkZXMgdXNlcklucHV0T25Qcm9jZXNzaW5nLCBzbyB0aGUgc3Bpbm5lciBhcHBlYXJzXG4gICAgICAgICAgLy8gb24gdGhpcyByZW5kZXIuIFJlc2V0IHRpbWluZyByZWZzIG5vdyAoYmVmb3JlIHF1ZXJ5R3VhcmQucmVzZXJ2ZSgpXG4gICAgICAgICAgLy8gd291bGQpIHNvIGVsYXBzZWQgdGltZSBkb2Vzbid0IHJlYWQgYXMgRGF0ZS5ub3coKSAtIDAuIFRoZVxuICAgICAgICAgIC8vIGlzUXVlcnlBY3RpdmUgdHJhbnNpdGlvbiBhYm92ZSBkb2VzIHRoZSBzYW1lIHJlc2V0IOKAlCBpZGVtcG90ZW50LlxuICAgICAgICAgIHJlc2V0VGltaW5nUmVmcygpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbmNyZW1lbnQgcHJvbXB0IGNvdW50IGZvciBhdHRyaWJ1dGlvbiB0cmFja2luZyBhbmQgc2F2ZSBzbmFwc2hvdFxuICAgICAgICAvLyBUaGUgc25hcHNob3QgcGVyc2lzdHMgcHJvbXB0Q291bnQgc28gaXQgc3Vydml2ZXMgY29tcGFjdGlvblxuICAgICAgICBpZiAoZmVhdHVyZSgnQ09NTUlUX0FUVFJJQlVUSU9OJykpIHtcbiAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgYXR0cmlidXRpb246IGluY3JlbWVudFByb21wdENvdW50KHByZXYuYXR0cmlidXRpb24sIHNuYXBzaG90ID0+IHtcbiAgICAgICAgICAgICAgdm9pZCByZWNvcmRBdHRyaWJ1dGlvblNuYXBzaG90KHNuYXBzaG90KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgICAgICAgYEF0dHJpYnV0aW9uOiBGYWlsZWQgdG8gc2F2ZSBzbmFwc2hvdDogJHtlcnJvcn1gLFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0pKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEhhbmRsZSBzcGVjdWxhdGlvbiBhY2NlcHRhbmNlXG4gICAgICBpZiAoc3BlY3VsYXRpb25BY2NlcHQpIHtcbiAgICAgICAgY29uc3QgeyBxdWVyeVJlcXVpcmVkIH0gPSBhd2FpdCBoYW5kbGVTcGVjdWxhdGlvbkFjY2VwdChcbiAgICAgICAgICBzcGVjdWxhdGlvbkFjY2VwdC5zdGF0ZSxcbiAgICAgICAgICBzcGVjdWxhdGlvbkFjY2VwdC5zcGVjdWxhdGlvblNlc3Npb25UaW1lU2F2ZWRNcyxcbiAgICAgICAgICBzcGVjdWxhdGlvbkFjY2VwdC5zZXRBcHBTdGF0ZSxcbiAgICAgICAgICBpbnB1dCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzZXRNZXNzYWdlcyxcbiAgICAgICAgICAgIHJlYWRGaWxlU3RhdGUsXG4gICAgICAgICAgICBjd2Q6IGdldE9yaWdpbmFsQ3dkKCksXG4gICAgICAgICAgfSxcbiAgICAgICAgKVxuICAgICAgICBpZiAocXVlcnlSZXF1aXJlZCkge1xuICAgICAgICAgIGNvbnN0IG5ld0Fib3J0Q29udHJvbGxlciA9IGNyZWF0ZUFib3J0Q29udHJvbGxlcigpXG4gICAgICAgICAgc2V0QWJvcnRDb250cm9sbGVyKG5ld0Fib3J0Q29udHJvbGxlcilcbiAgICAgICAgICB2b2lkIG9uUXVlcnkoW10sIG5ld0Fib3J0Q29udHJvbGxlciwgdHJ1ZSwgW10sIG1haW5Mb29wTW9kZWwpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIFJlbW90ZSBtb2RlOiBzZW5kIGlucHV0IHZpYSBzdHJlYW0tanNvbiBpbnN0ZWFkIG9mIGxvY2FsIHF1ZXJ5LlxuICAgICAgLy8gUGVybWlzc2lvbiByZXF1ZXN0cyBmcm9tIHRoZSByZW1vdGUgYXJlIGJyaWRnZWQgaW50byB0b29sVXNlQ29uZmlybVF1ZXVlXG4gICAgICAvLyBhbmQgcmVuZGVyZWQgdXNpbmcgdGhlIHN0YW5kYXJkIFBlcm1pc3Npb25SZXF1ZXN0IGNvbXBvbmVudC5cbiAgICAgIC8vXG4gICAgICAvLyBsb2NhbC1qc3ggc2xhc2ggY29tbWFuZHMgKGUuZy4gL2FnZW50cywgL2NvbmZpZykgcmVuZGVyIFVJIGluIFRISVNcbiAgICAgIC8vIHByb2Nlc3Mg4oCUIHRoZXkgaGF2ZSBubyByZW1vdGUgZXF1aXZhbGVudC4gTGV0IHRob3NlIGZhbGwgdGhyb3VnaCB0b1xuICAgICAgLy8gaGFuZGxlUHJvbXB0U3VibWl0IHNvIHRoZXkgZXhlY3V0ZSBsb2NhbGx5LiBQcm9tcHQgY29tbWFuZHMgYW5kXG4gICAgICAvLyBwbGFpbiB0ZXh0IGdvIHRvIHRoZSByZW1vdGUuXG4gICAgICBpZiAoXG4gICAgICAgIGFjdGl2ZVJlbW90ZS5pc1JlbW90ZU1vZGUgJiZcbiAgICAgICAgIShcbiAgICAgICAgICBpc1NsYXNoQ29tbWFuZCAmJlxuICAgICAgICAgIGNvbW1hbmRzLmZpbmQoYyA9PiB7XG4gICAgICAgICAgICBjb25zdCBuYW1lID0gaW5wdXQudHJpbSgpLnNsaWNlKDEpLnNwbGl0KC9cXHMvKVswXVxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgaXNDb21tYW5kRW5hYmxlZChjKSAmJlxuICAgICAgICAgICAgICAoYy5uYW1lID09PSBuYW1lIHx8XG4gICAgICAgICAgICAgICAgYy5hbGlhc2VzPy5pbmNsdWRlcyhuYW1lISkgfHxcbiAgICAgICAgICAgICAgICBnZXRDb21tYW5kTmFtZShjKSA9PT0gbmFtZSlcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9KT8udHlwZSA9PT0gJ2xvY2FsLWpzeCdcbiAgICAgICAgKVxuICAgICAgKSB7XG4gICAgICAgIC8vIEJ1aWxkIGNvbnRlbnQgYmxvY2tzIHdoZW4gdGhlcmUgYXJlIHBhc3RlZCBhdHRhY2htZW50cyAoaW1hZ2VzKVxuICAgICAgICBjb25zdCBwYXN0ZWRWYWx1ZXMgPSBPYmplY3QudmFsdWVzKHBhc3RlZENvbnRlbnRzKVxuICAgICAgICBjb25zdCBpbWFnZUNvbnRlbnRzID0gcGFzdGVkVmFsdWVzLmZpbHRlcihjID0+IGMudHlwZSA9PT0gJ2ltYWdlJylcbiAgICAgICAgY29uc3QgaW1hZ2VQYXN0ZUlkcyA9XG4gICAgICAgICAgaW1hZ2VDb250ZW50cy5sZW5ndGggPiAwID8gaW1hZ2VDb250ZW50cy5tYXAoYyA9PiBjLmlkKSA6IHVuZGVmaW5lZFxuXG4gICAgICAgIGxldCBtZXNzYWdlQ29udGVudDogc3RyaW5nIHwgQ29udGVudEJsb2NrUGFyYW1bXSA9IGlucHV0LnRyaW0oKVxuICAgICAgICBsZXQgcmVtb3RlQ29udGVudDogUmVtb3RlTWVzc2FnZUNvbnRlbnQgPSBpbnB1dC50cmltKClcbiAgICAgICAgaWYgKHBhc3RlZFZhbHVlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc3QgY29udGVudEJsb2NrczogQ29udGVudEJsb2NrUGFyYW1bXSA9IFtdXG4gICAgICAgICAgY29uc3QgcmVtb3RlQmxvY2tzOiBBcnJheTx7IHR5cGU6IHN0cmluZzsgW2tleTogc3RyaW5nXTogdW5rbm93biB9PiA9XG4gICAgICAgICAgICBbXVxuXG4gICAgICAgICAgY29uc3QgdHJpbW1lZElucHV0ID0gaW5wdXQudHJpbSgpXG4gICAgICAgICAgaWYgKHRyaW1tZWRJbnB1dCkge1xuICAgICAgICAgICAgY29udGVudEJsb2Nrcy5wdXNoKHsgdHlwZTogJ3RleHQnLCB0ZXh0OiB0cmltbWVkSW5wdXQgfSlcbiAgICAgICAgICAgIHJlbW90ZUJsb2Nrcy5wdXNoKHsgdHlwZTogJ3RleHQnLCB0ZXh0OiB0cmltbWVkSW5wdXQgfSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmb3IgKGNvbnN0IHBhc3RlZCBvZiBwYXN0ZWRWYWx1ZXMpIHtcbiAgICAgICAgICAgIGlmIChwYXN0ZWQudHlwZSA9PT0gJ2ltYWdlJykge1xuICAgICAgICAgICAgICBjb25zdCBzb3VyY2UgPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jhc2U2NCcgYXMgY29uc3QsXG4gICAgICAgICAgICAgICAgbWVkaWFfdHlwZTogKHBhc3RlZC5tZWRpYVR5cGUgPz8gJ2ltYWdlL3BuZycpIGFzXG4gICAgICAgICAgICAgICAgICB8ICdpbWFnZS9qcGVnJ1xuICAgICAgICAgICAgICAgICAgfCAnaW1hZ2UvcG5nJ1xuICAgICAgICAgICAgICAgICAgfCAnaW1hZ2UvZ2lmJ1xuICAgICAgICAgICAgICAgICAgfCAnaW1hZ2Uvd2VicCcsXG4gICAgICAgICAgICAgICAgZGF0YTogcGFzdGVkLmNvbnRlbnQsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY29udGVudEJsb2Nrcy5wdXNoKHsgdHlwZTogJ2ltYWdlJywgc291cmNlIH0pXG4gICAgICAgICAgICAgIHJlbW90ZUJsb2Nrcy5wdXNoKHsgdHlwZTogJ2ltYWdlJywgc291cmNlIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBjb250ZW50QmxvY2tzLnB1c2goeyB0eXBlOiAndGV4dCcsIHRleHQ6IHBhc3RlZC5jb250ZW50IH0pXG4gICAgICAgICAgICAgIHJlbW90ZUJsb2Nrcy5wdXNoKHsgdHlwZTogJ3RleHQnLCB0ZXh0OiBwYXN0ZWQuY29udGVudCB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIG1lc3NhZ2VDb250ZW50ID0gY29udGVudEJsb2Nrc1xuICAgICAgICAgIHJlbW90ZUNvbnRlbnQgPSByZW1vdGVCbG9ja3NcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENyZWF0ZSBhbmQgYWRkIHVzZXIgbWVzc2FnZSB0byBVSVxuICAgICAgICAvLyBOb3RlOiBlbXB0eSBpbnB1dCBhbHJlYWR5IGhhbmRsZWQgYnkgZWFybHkgcmV0dXJuIGFib3ZlXG4gICAgICAgIGNvbnN0IHVzZXJNZXNzYWdlID0gY3JlYXRlVXNlck1lc3NhZ2Uoe1xuICAgICAgICAgIGNvbnRlbnQ6IG1lc3NhZ2VDb250ZW50LFxuICAgICAgICAgIGltYWdlUGFzdGVJZHMsXG4gICAgICAgIH0pXG4gICAgICAgIHNldE1lc3NhZ2VzKHByZXYgPT4gWy4uLnByZXYsIHVzZXJNZXNzYWdlXSlcblxuICAgICAgICAvLyBTZW5kIHRvIHJlbW90ZSBzZXNzaW9uXG4gICAgICAgIGF3YWl0IGFjdGl2ZVJlbW90ZS5zZW5kTWVzc2FnZShyZW1vdGVDb250ZW50LCB7XG4gICAgICAgICAgdXVpZDogdXNlck1lc3NhZ2UudXVpZCxcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIEVuc3VyZSBTZXNzaW9uU3RhcnQgaG9vayBjb250ZXh0IGlzIGF2YWlsYWJsZSBiZWZvcmUgdGhlIGZpcnN0IEFQSSBjYWxsLlxuICAgICAgYXdhaXQgYXdhaXRQZW5kaW5nSG9va3MoKVxuXG4gICAgICBhd2FpdCBoYW5kbGVQcm9tcHRTdWJtaXQoe1xuICAgICAgICBpbnB1dCxcbiAgICAgICAgaGVscGVycyxcbiAgICAgICAgcXVlcnlHdWFyZCxcbiAgICAgICAgaXNFeHRlcm5hbExvYWRpbmcsXG4gICAgICAgIG1vZGU6IGlucHV0TW9kZSxcbiAgICAgICAgY29tbWFuZHMsXG4gICAgICAgIG9uSW5wdXRDaGFuZ2U6IHNldElucHV0VmFsdWUsXG4gICAgICAgIHNldFBhc3RlZENvbnRlbnRzLFxuICAgICAgICBzZXRUb29sSlNYLFxuICAgICAgICBnZXRUb29sVXNlQ29udGV4dCxcbiAgICAgICAgbWVzc2FnZXM6IG1lc3NhZ2VzUmVmLmN1cnJlbnQsXG4gICAgICAgIG1haW5Mb29wTW9kZWwsXG4gICAgICAgIHBhc3RlZENvbnRlbnRzLFxuICAgICAgICBpZGVTZWxlY3Rpb24sXG4gICAgICAgIHNldFVzZXJJbnB1dE9uUHJvY2Vzc2luZyxcbiAgICAgICAgc2V0QWJvcnRDb250cm9sbGVyLFxuICAgICAgICBhYm9ydENvbnRyb2xsZXIsXG4gICAgICAgIG9uUXVlcnksXG4gICAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgICBxdWVyeVNvdXJjZTogZ2V0UXVlcnlTb3VyY2VGb3JSRVBMKCksXG4gICAgICAgIG9uQmVmb3JlUXVlcnksXG4gICAgICAgIGNhblVzZVRvb2wsXG4gICAgICAgIGFkZE5vdGlmaWNhdGlvbixcbiAgICAgICAgc2V0TWVzc2FnZXMsXG4gICAgICAgIC8vIFJlYWQgdmlhIHJlZiBzbyBzdHJlYW1Nb2RlIGNhbiBiZSBkcm9wcGVkIGZyb20gb25TdWJtaXQgZGVwcyDigJRcbiAgICAgICAgLy8gaGFuZGxlUHJvbXB0U3VibWl0IG9ubHkgdXNlcyBpdCBmb3IgZGVidWcgbG9nICsgdGVsZW1ldHJ5IGV2ZW50LlxuICAgICAgICBzdHJlYW1Nb2RlOiBzdHJlYW1Nb2RlUmVmLmN1cnJlbnQsXG4gICAgICAgIGhhc0ludGVycnVwdGlibGVUb29sSW5Qcm9ncmVzczpcbiAgICAgICAgICBoYXNJbnRlcnJ1cHRpYmxlVG9vbEluUHJvZ3Jlc3NSZWYuY3VycmVudCxcbiAgICAgIH0pXG5cbiAgICAgIC8vIFJlc3RvcmUgc3Rhc2ggdGhhdCB3YXMgZGVmZXJyZWQgYWJvdmUuIFR3byBjYXNlczpcbiAgICAgIC8vIC0gU2xhc2ggY29tbWFuZDogaGFuZGxlUHJvbXB0U3VibWl0IGF3YWl0ZWQgdGhlIGZ1bGwgY29tbWFuZCBleGVjdXRpb25cbiAgICAgIC8vICAgKGluY2x1ZGluZyBpbnRlcmFjdGl2ZSBwaWNrZXJzKS4gUmVzdG9yaW5nIG5vdyBwbGFjZXMgdGhlIHN0YXNoIGJhY2sgaW5cbiAgICAgIC8vICAgdGhlIHZpc2libGUgaW5wdXQuXG4gICAgICAvLyAtIExvYWRpbmcgKHF1ZXVlZCk6IGhhbmRsZVByb21wdFN1Ym1pdCBlbnF1ZXVlZCArIGNsZWFyZWQgaW5wdXQsIHRoZW5cbiAgICAgIC8vICAgcmV0dXJuZWQgcXVpY2tseS4gUmVzdG9yaW5nIG5vdyBwbGFjZXMgdGhlIHN0YXNoIGJhY2sgYWZ0ZXIgdGhlIGNsZWFyLlxuICAgICAgaWYgKChpc1NsYXNoQ29tbWFuZCB8fCBpc0xvYWRpbmcpICYmIHN0YXNoZWRQcm9tcHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzZXRJbnB1dFZhbHVlKHN0YXNoZWRQcm9tcHQudGV4dClcbiAgICAgICAgaGVscGVycy5zZXRDdXJzb3JPZmZzZXQoc3Rhc2hlZFByb21wdC5jdXJzb3JPZmZzZXQpXG4gICAgICAgIHNldFBhc3RlZENvbnRlbnRzKHN0YXNoZWRQcm9tcHQucGFzdGVkQ29udGVudHMpXG4gICAgICAgIHNldFN0YXNoZWRQcm9tcHQodW5kZWZpbmVkKVxuICAgICAgfVxuICAgIH0sXG4gICAgW1xuICAgICAgcXVlcnlHdWFyZCxcbiAgICAgIC8vIGlzTG9hZGluZyBpcyByZWFkIGF0IHRoZSAhaXNMb2FkaW5nIGNoZWNrcyBhYm92ZSBmb3IgaW5wdXQtY2xlYXJpbmdcbiAgICAgIC8vIGFuZCBzdWJtaXRDb3VudCBnYXRpbmcuIEl0J3MgZGVyaXZlZCBmcm9tIGlzUXVlcnlBY3RpdmUgfHwgaXNFeHRlcm5hbExvYWRpbmcsXG4gICAgICAvLyBzbyBpbmNsdWRpbmcgaXQgaGVyZSBlbnN1cmVzIHRoZSBjbG9zdXJlIGNhcHR1cmVzIHRoZSBmcmVzaCB2YWx1ZS5cbiAgICAgIGlzTG9hZGluZyxcbiAgICAgIGlzRXh0ZXJuYWxMb2FkaW5nLFxuICAgICAgaW5wdXRNb2RlLFxuICAgICAgY29tbWFuZHMsXG4gICAgICBzZXRJbnB1dFZhbHVlLFxuICAgICAgc2V0SW5wdXRNb2RlLFxuICAgICAgc2V0UGFzdGVkQ29udGVudHMsXG4gICAgICBzZXRTdWJtaXRDb3VudCxcbiAgICAgIHNldElERVNlbGVjdGlvbixcbiAgICAgIHNldFRvb2xKU1gsXG4gICAgICBnZXRUb29sVXNlQ29udGV4dCxcbiAgICAgIC8vIG1lc3NhZ2VzIGlzIHJlYWQgdmlhIG1lc3NhZ2VzUmVmLmN1cnJlbnQgaW5zaWRlIHRoZSBjYWxsYmFjayB0b1xuICAgICAgLy8ga2VlcCBvblN1Ym1pdCBzdGFibGUgYWNyb3NzIG1lc3NhZ2UgdXBkYXRlcyAoc2VlIEwyMzg0L0wyNDAwL0wyNjYyKS5cbiAgICAgIC8vIFdpdGhvdXQgdGhpcywgZWFjaCBzZXRNZXNzYWdlcyBjYWxsICh+MzDDlyBwZXIgdHVybikgcmVjcmVhdGVzXG4gICAgICAvLyBvblN1Ym1pdCwgcGlubmluZyB0aGUgUkVQTCByZW5kZXIgc2NvcGUgKDE3NzZCKSArIHRoYXQgcmVuZGVyJ3NcbiAgICAgIC8vIG1lc3NhZ2VzIGFycmF5IGluIGRvd25zdHJlYW0gY2xvc3VyZXMgKFByb21wdElucHV0LCBoYW5kbGVBdXRvUnVuSXNzdWUpLlxuICAgICAgLy8gSGVhcCBhbmFseXNpcyBzaG93ZWQgfjkgUkVQTCBzY29wZXMgYW5kIH4xNSBtZXNzYWdlcyBhcnJheSB2ZXJzaW9uc1xuICAgICAgLy8gYWNjdW11bGF0aW5nIGFmdGVyICMyMDE3NC8jMjAxNzUsIGFsbCB0cmFjZWQgdG8gdGhpcyBkZXAuXG4gICAgICBtYWluTG9vcE1vZGVsLFxuICAgICAgcGFzdGVkQ29udGVudHMsXG4gICAgICBpZGVTZWxlY3Rpb24sXG4gICAgICBzZXRVc2VySW5wdXRPblByb2Nlc3NpbmcsXG4gICAgICBzZXRBYm9ydENvbnRyb2xsZXIsXG4gICAgICBhZGROb3RpZmljYXRpb24sXG4gICAgICBvblF1ZXJ5LFxuICAgICAgc3Rhc2hlZFByb21wdCxcbiAgICAgIHNldFN0YXNoZWRQcm9tcHQsXG4gICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgIG9uQmVmb3JlUXVlcnksXG4gICAgICBjYW5Vc2VUb29sLFxuICAgICAgcmVtb3RlU2Vzc2lvbixcbiAgICAgIHNldE1lc3NhZ2VzLFxuICAgICAgYXdhaXRQZW5kaW5nSG9va3MsXG4gICAgICByZXBpblNjcm9sbCxcbiAgICBdLFxuICApXG5cbiAgLy8gQ2FsbGJhY2sgZm9yIHdoZW4gdXNlciBzdWJtaXRzIGlucHV0IHdoaWxlIHZpZXdpbmcgYSB0ZWFtbWF0ZSdzIHRyYW5zY3JpcHRcbiAgY29uc3Qgb25BZ2VudFN1Ym1pdCA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChcbiAgICAgIGlucHV0OiBzdHJpbmcsXG4gICAgICB0YXNrOiBJblByb2Nlc3NUZWFtbWF0ZVRhc2tTdGF0ZSB8IExvY2FsQWdlbnRUYXNrU3RhdGUsXG4gICAgICBoZWxwZXJzOiBQcm9tcHRJbnB1dEhlbHBlcnMsXG4gICAgKSA9PiB7XG4gICAgICBpZiAoaXNMb2NhbEFnZW50VGFzayh0YXNrKSkge1xuICAgICAgICBhcHBlbmRNZXNzYWdlVG9Mb2NhbEFnZW50KFxuICAgICAgICAgIHRhc2suaWQsXG4gICAgICAgICAgY3JlYXRlVXNlck1lc3NhZ2UoeyBjb250ZW50OiBpbnB1dCB9KSxcbiAgICAgICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgICAgKVxuICAgICAgICBpZiAodGFzay5zdGF0dXMgPT09ICdydW5uaW5nJykge1xuICAgICAgICAgIHF1ZXVlUGVuZGluZ01lc3NhZ2UodGFzay5pZCwgaW5wdXQsIHNldEFwcFN0YXRlKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZvaWQgcmVzdW1lQWdlbnRCYWNrZ3JvdW5kKHtcbiAgICAgICAgICAgIGFnZW50SWQ6IHRhc2suaWQsXG4gICAgICAgICAgICBwcm9tcHQ6IGlucHV0LFxuICAgICAgICAgICAgdG9vbFVzZUNvbnRleHQ6IGdldFRvb2xVc2VDb250ZXh0KFxuICAgICAgICAgICAgICBtZXNzYWdlc1JlZi5jdXJyZW50LFxuICAgICAgICAgICAgICBbXSxcbiAgICAgICAgICAgICAgbmV3IEFib3J0Q29udHJvbGxlcigpLFxuICAgICAgICAgICAgICBtYWluTG9vcE1vZGVsLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGNhblVzZVRvb2wsXG4gICAgICAgICAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgICAgYHJlc3VtZUFnZW50QmFja2dyb3VuZCBmYWlsZWQ6ICR7ZXJyb3JNZXNzYWdlKGVycil9YCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIGFkZE5vdGlmaWNhdGlvbih7XG4gICAgICAgICAgICAgIGtleTogYHJlc3VtZS1hZ2VudC1mYWlsZWQtJHt0YXNrLmlkfWAsXG4gICAgICAgICAgICAgIGpzeDogKFxuICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj5cbiAgICAgICAgICAgICAgICAgIEZhaWxlZCB0byByZXN1bWUgYWdlbnQ6IHtlcnJvck1lc3NhZ2UoZXJyKX1cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgIHByaW9yaXR5OiAnbG93JyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5qZWN0VXNlck1lc3NhZ2VUb1RlYW1tYXRlKHRhc2suaWQsIGlucHV0LCBzZXRBcHBTdGF0ZSlcbiAgICAgIH1cbiAgICAgIHNldElucHV0VmFsdWUoJycpXG4gICAgICBoZWxwZXJzLnNldEN1cnNvck9mZnNldCgwKVxuICAgICAgaGVscGVycy5jbGVhckJ1ZmZlcigpXG4gICAgfSxcbiAgICBbXG4gICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgIHNldElucHV0VmFsdWUsXG4gICAgICBnZXRUb29sVXNlQ29udGV4dCxcbiAgICAgIGNhblVzZVRvb2wsXG4gICAgICBtYWluTG9vcE1vZGVsLFxuICAgICAgYWRkTm90aWZpY2F0aW9uLFxuICAgIF0sXG4gIClcblxuICAvLyBIYW5kbGVycyBmb3IgYXV0by1ydW4gL2lzc3VlIG9yIC9nb29kLWNsYXVkZSAoZGVmaW5lZCBhZnRlciBvblN1Ym1pdClcbiAgY29uc3QgaGFuZGxlQXV0b1J1bklzc3VlID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGNvbnN0IGNvbW1hbmQgPSBhdXRvUnVuSXNzdWVSZWFzb25cbiAgICAgID8gZ2V0QXV0b1J1bkNvbW1hbmQoYXV0b1J1bklzc3VlUmVhc29uKVxuICAgICAgOiAnL2lzc3VlJ1xuICAgIHNldEF1dG9SdW5Jc3N1ZVJlYXNvbihudWxsKSAvLyBDbGVhciB0aGUgc3RhdGVcbiAgICBvblN1Ym1pdChjb21tYW5kLCB7XG4gICAgICBzZXRDdXJzb3JPZmZzZXQ6ICgpID0+IHt9LFxuICAgICAgY2xlYXJCdWZmZXI6ICgpID0+IHt9LFxuICAgICAgcmVzZXRIaXN0b3J5OiAoKSA9PiB7fSxcbiAgICB9KS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRm9yRGVidWdnaW5nKGBBdXRvLXJ1biAke2NvbW1hbmR9IGZhaWxlZDogJHtlcnJvck1lc3NhZ2UoZXJyKX1gKVxuICAgIH0pXG4gIH0sIFtvblN1Ym1pdCwgYXV0b1J1bklzc3VlUmVhc29uXSlcblxuICBjb25zdCBoYW5kbGVDYW5jZWxBdXRvUnVuSXNzdWUgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgc2V0QXV0b1J1bklzc3VlUmVhc29uKG51bGwpXG4gIH0sIFtdKVxuXG4gIC8vIEhhbmRsZXIgZm9yIHdoZW4gdXNlciBwcmVzc2VzIDEgb24gc3VydmV5IHRoYW5rcyBzY3JlZW4gdG8gc2hhcmUgZGV0YWlsc1xuICBjb25zdCBoYW5kbGVTdXJ2ZXlSZXF1ZXN0RmVlZGJhY2sgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgY29uc3QgY29tbWFuZCA9IFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgPyAnL2lzc3VlJyA6ICcvZmVlZGJhY2snXG4gICAgb25TdWJtaXQoY29tbWFuZCwge1xuICAgICAgc2V0Q3Vyc29yT2Zmc2V0OiAoKSA9PiB7fSxcbiAgICAgIGNsZWFyQnVmZmVyOiAoKSA9PiB7fSxcbiAgICAgIHJlc2V0SGlzdG9yeTogKCkgPT4ge30sXG4gICAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgYFN1cnZleSBmZWVkYmFjayByZXF1ZXN0IGZhaWxlZDogJHtlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycil9YCxcbiAgICAgIClcbiAgICB9KVxuICB9LCBbb25TdWJtaXRdKVxuXG4gIC8vIG9uU3VibWl0IGlzIHVuc3RhYmxlIChkZXBzIGluY2x1ZGUgYG1lc3NhZ2VzYCB3aGljaCBjaGFuZ2VzIGV2ZXJ5IHR1cm4pLlxuICAvLyBgaGFuZGxlT3BlblJhdGVMaW1pdE9wdGlvbnNgIGlzIHByb3AtZHJpbGxlZCB0byBldmVyeSBNZXNzYWdlUm93LCBhbmQgZWFjaFxuICAvLyBNZXNzYWdlUm93IGZpYmVyIHBpbnMgdGhlIGNsb3N1cmUgKGFuZCB0cmFuc2l0aXZlbHkgdGhlIGVudGlyZSBSRVBMIHJlbmRlclxuICAvLyBzY29wZSwgfjEuOEtCKSBhdCBtb3VudCB0aW1lLiBVc2luZyBhIHJlZiBrZWVwcyB0aGlzIGNhbGxiYWNrIHN0YWJsZSBzb1xuICAvLyBvbGQgUkVQTCBzY29wZXMgY2FuIGJlIEdDJ2Qg4oCUIHNhdmVzIH4zNU1CIG92ZXIgYSAxMDAwLXR1cm4gc2Vzc2lvbi5cbiAgY29uc3Qgb25TdWJtaXRSZWYgPSB1c2VSZWYob25TdWJtaXQpXG4gIG9uU3VibWl0UmVmLmN1cnJlbnQgPSBvblN1Ym1pdFxuICBjb25zdCBoYW5kbGVPcGVuUmF0ZUxpbWl0T3B0aW9ucyA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICB2b2lkIG9uU3VibWl0UmVmLmN1cnJlbnQoJy9yYXRlLWxpbWl0LW9wdGlvbnMnLCB7XG4gICAgICBzZXRDdXJzb3JPZmZzZXQ6ICgpID0+IHt9LFxuICAgICAgY2xlYXJCdWZmZXI6ICgpID0+IHt9LFxuICAgICAgcmVzZXRIaXN0b3J5OiAoKSA9PiB7fSxcbiAgICB9KVxuICB9LCBbXSlcblxuICBjb25zdCBoYW5kbGVFeGl0ID0gdXNlQ2FsbGJhY2soYXN5bmMgKCkgPT4ge1xuICAgIHNldElzRXhpdGluZyh0cnVlKVxuICAgIC8vIEluIGJnIHNlc3Npb25zLCBhbHdheXMgZGV0YWNoIGluc3RlYWQgb2Yga2lsbCDigJQgZXZlbiB3aGVuIGEgd29ya3RyZWUgaXNcbiAgICAvLyBhY3RpdmUuIFdpdGhvdXQgdGhpcyBndWFyZCwgdGhlIHdvcmt0cmVlIGJyYW5jaCBiZWxvdyBzaG9ydC1jaXJjdWl0cyBpbnRvXG4gICAgLy8gRXhpdEZsb3cgKHdoaWNoIGNhbGxzIGdyYWNlZnVsU2h1dGRvd24pIGJlZm9yZSBleGl0LnRzeCBpcyBldmVyIGxvYWRlZC5cbiAgICBpZiAoZmVhdHVyZSgnQkdfU0VTU0lPTlMnKSAmJiBpc0JnU2Vzc2lvbigpKSB7XG4gICAgICBzcGF3blN5bmMoJ3RtdXgnLCBbJ2RldGFjaC1jbGllbnQnXSwgeyBzdGRpbzogJ2lnbm9yZScgfSlcbiAgICAgIHNldElzRXhpdGluZyhmYWxzZSlcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBjb25zdCBzaG93V29ya3RyZWUgPSBnZXRDdXJyZW50V29ya3RyZWVTZXNzaW9uKCkgIT09IG51bGxcbiAgICBpZiAoc2hvd1dvcmt0cmVlKSB7XG4gICAgICBzZXRFeGl0RmxvdyhcbiAgICAgICAgPEV4aXRGbG93XG4gICAgICAgICAgc2hvd1dvcmt0cmVlXG4gICAgICAgICAgb25Eb25lPXsoKSA9PiB7fX1cbiAgICAgICAgICBvbkNhbmNlbD17KCkgPT4ge1xuICAgICAgICAgICAgc2V0RXhpdEZsb3cobnVsbClcbiAgICAgICAgICAgIHNldElzRXhpdGluZyhmYWxzZSlcbiAgICAgICAgICB9fVxuICAgICAgICAvPixcbiAgICAgIClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBjb25zdCBleGl0TW9kID0gYXdhaXQgZXhpdC5sb2FkKClcbiAgICBjb25zdCBleGl0Rmxvd1Jlc3VsdCA9IGF3YWl0IGV4aXRNb2QuY2FsbCgoKSA9PiB7fSlcbiAgICBzZXRFeGl0RmxvdyhleGl0Rmxvd1Jlc3VsdClcbiAgICAvLyBJZiBjYWxsKCkgcmV0dXJuZWQgd2l0aG91dCBraWxsaW5nIHRoZSBwcm9jZXNzIChiZyBzZXNzaW9uIGRldGFjaCksXG4gICAgLy8gY2xlYXIgaXNFeGl0aW5nIHNvIHRoZSBVSSBpcyB1c2FibGUgb24gcmVhdHRhY2guIE5vLW9wIG9uIHRoZSBub3JtYWxcbiAgICAvLyBwYXRoIOKAlCBncmFjZWZ1bFNodXRkb3duJ3MgcHJvY2Vzcy5leGl0KCkgbWVhbnMgd2UgbmV2ZXIgZ2V0IGhlcmUuXG4gICAgaWYgKGV4aXRGbG93UmVzdWx0ID09PSBudWxsKSB7XG4gICAgICBzZXRJc0V4aXRpbmcoZmFsc2UpXG4gICAgfVxuICB9LCBbXSlcblxuICBjb25zdCBoYW5kbGVTaG93TWVzc2FnZVNlbGVjdG9yID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldElzTWVzc2FnZVNlbGVjdG9yVmlzaWJsZShwcmV2ID0+ICFwcmV2KVxuICB9LCBbXSlcblxuICAvLyBSZXdpbmQgY29udmVyc2F0aW9uIHN0YXRlIHRvIGp1c3QgYmVmb3JlIGBtZXNzYWdlYDogc2xpY2UgbWVzc2FnZXMsXG4gIC8vIHJlc2V0IGNvbnZlcnNhdGlvbiBJRCwgbWljcm9jb21wYWN0IHN0YXRlLCBwZXJtaXNzaW9uIG1vZGUsIHByb21wdCBzdWdnZXN0aW9uLlxuICAvLyBEb2VzIE5PVCB0b3VjaCB0aGUgcHJvbXB0IGlucHV0LiBJbmRleCBpcyBjb21wdXRlZCBmcm9tIG1lc3NhZ2VzUmVmIChhbHdheXNcbiAgLy8gZnJlc2ggdmlhIHRoZSBzZXRNZXNzYWdlcyB3cmFwcGVyKSBzbyBjYWxsZXJzIGRvbid0IG5lZWQgdG8gd29ycnkgYWJvdXRcbiAgLy8gc3RhbGUgY2xvc3VyZXMuXG4gIGNvbnN0IHJld2luZENvbnZlcnNhdGlvblRvID0gdXNlQ2FsbGJhY2soXG4gICAgKG1lc3NhZ2U6IFVzZXJNZXNzYWdlKSA9PiB7XG4gICAgICBjb25zdCBwcmV2ID0gbWVzc2FnZXNSZWYuY3VycmVudFxuICAgICAgY29uc3QgbWVzc2FnZUluZGV4ID0gcHJldi5sYXN0SW5kZXhPZihtZXNzYWdlKVxuICAgICAgaWYgKG1lc3NhZ2VJbmRleCA9PT0gLTEpIHJldHVyblxuXG4gICAgICBsb2dFdmVudCgndGVuZ3VfY29udmVyc2F0aW9uX3Jld2luZCcsIHtcbiAgICAgICAgcHJlUmV3aW5kTWVzc2FnZUNvdW50OiBwcmV2Lmxlbmd0aCxcbiAgICAgICAgcG9zdFJld2luZE1lc3NhZ2VDb3VudDogbWVzc2FnZUluZGV4LFxuICAgICAgICBtZXNzYWdlc1JlbW92ZWQ6IHByZXYubGVuZ3RoIC0gbWVzc2FnZUluZGV4LFxuICAgICAgICByZXdpbmRUb01lc3NhZ2VJbmRleDogbWVzc2FnZUluZGV4LFxuICAgICAgfSlcbiAgICAgIHNldE1lc3NhZ2VzKHByZXYuc2xpY2UoMCwgbWVzc2FnZUluZGV4KSlcbiAgICAgIC8vIENhcmVmdWwsIHRoaXMgaGFzIHRvIGhhcHBlbiBhZnRlciBzZXRNZXNzYWdlc1xuICAgICAgc2V0Q29udmVyc2F0aW9uSWQocmFuZG9tVVVJRCgpKVxuICAgICAgLy8gUmVzZXQgY2FjaGVkIG1pY3JvY29tcGFjdCBzdGF0ZSBzbyBzdGFsZSBwaW5uZWQgY2FjaGUgZWRpdHNcbiAgICAgIC8vIGRvbid0IHJlZmVyZW5jZSB0b29sX3VzZV9pZHMgZnJvbSB0cnVuY2F0ZWQgbWVzc2FnZXNcbiAgICAgIHJlc2V0TWljcm9jb21wYWN0U3RhdGUoKVxuICAgICAgaWYgKGZlYXR1cmUoJ0NPTlRFWFRfQ09MTEFQU0UnKSkge1xuICAgICAgICAvLyBSZXdpbmQgdHJ1bmNhdGVzIHRoZSBSRVBMIGFycmF5LiBDb21taXRzIHdob3NlIGFyY2hpdmVkIHNwYW5cbiAgICAgICAgLy8gd2FzIHBhc3QgdGhlIHJld2luZCBwb2ludCBjYW4ndCBiZSBwcm9qZWN0ZWQgYW55bW9yZVxuICAgICAgICAvLyAocHJvamVjdFZpZXcgc2lsZW50bHkgc2tpcHMgdGhlbSkgYnV0IHRoZSBzdGFnZWQgcXVldWUgYW5kIElEXG4gICAgICAgIC8vIG1hcHMgcmVmZXJlbmNlIHN0YWxlIHV1aWRzLiBTaW1wbGVzdCBzYWZlIHJlc2V0OiBkcm9wXG4gICAgICAgIC8vIGV2ZXJ5dGhpbmcuIFRoZSBjdHgtYWdlbnQgd2lsbCByZS1zdGFnZSBvbiB0aGUgbmV4dFxuICAgICAgICAvLyB0aHJlc2hvbGQgY3Jvc3NpbmcuXG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgOyhcbiAgICAgICAgICByZXF1aXJlKCcuLi9zZXJ2aWNlcy9jb250ZXh0Q29sbGFwc2UvaW5kZXguanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuLi9zZXJ2aWNlcy9jb250ZXh0Q29sbGFwc2UvaW5kZXguanMnKVxuICAgICAgICApLnJlc2V0Q29udGV4dENvbGxhcHNlKClcbiAgICAgICAgLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgICB9XG5cbiAgICAgIC8vIFJlc3RvcmUgc3RhdGUgZnJvbSB0aGUgbWVzc2FnZSB3ZSdyZSByZXdpbmRpbmcgdG9cbiAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgLy8gUmVzdG9yZSBwZXJtaXNzaW9uIG1vZGUgZnJvbSB0aGUgbWVzc2FnZVxuICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQ6XG4gICAgICAgICAgbWVzc2FnZS5wZXJtaXNzaW9uTW9kZSAmJlxuICAgICAgICAgIHByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0Lm1vZGUgIT09IG1lc3NhZ2UucGVybWlzc2lvbk1vZGVcbiAgICAgICAgICAgID8ge1xuICAgICAgICAgICAgICAgIC4uLnByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgICAgICAgICAgICAgIG1vZGU6IG1lc3NhZ2UucGVybWlzc2lvbk1vZGUsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIDogcHJldi50b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgIC8vIENsZWFyIHN0YWxlIHByb21wdCBzdWdnZXN0aW9uIGZyb20gcHJldmlvdXMgY29udmVyc2F0aW9uIHN0YXRlXG4gICAgICAgIHByb21wdFN1Z2dlc3Rpb246IHtcbiAgICAgICAgICB0ZXh0OiBudWxsLFxuICAgICAgICAgIHByb21wdElkOiBudWxsLFxuICAgICAgICAgIHNob3duQXQ6IDAsXG4gICAgICAgICAgYWNjZXB0ZWRBdDogMCxcbiAgICAgICAgICBnZW5lcmF0aW9uUmVxdWVzdElkOiBudWxsLFxuICAgICAgICB9LFxuICAgICAgfSkpXG4gICAgfSxcbiAgICBbc2V0TWVzc2FnZXMsIHNldEFwcFN0YXRlXSxcbiAgKVxuXG4gIC8vIFN5bmNocm9ub3VzIHJld2luZCArIGlucHV0IHBvcHVsYXRpb24uIFVzZWQgZGlyZWN0bHkgYnkgYXV0by1yZXN0b3JlIG9uXG4gIC8vIGludGVycnVwdCAoc28gUmVhY3QgYmF0Y2hlcyB3aXRoIHRoZSBhYm9ydCdzIHNldE1lc3NhZ2VzIOKGkiBzaW5nbGUgcmVuZGVyLFxuICAvLyBubyBmbGlja2VyKS4gTWVzc2FnZVNlbGVjdG9yIHdyYXBzIHRoaXMgaW4gc2V0SW1tZWRpYXRlIHZpYSBoYW5kbGVSZXN0b3JlTWVzc2FnZS5cbiAgY29uc3QgcmVzdG9yZU1lc3NhZ2VTeW5jID0gdXNlQ2FsbGJhY2soXG4gICAgKG1lc3NhZ2U6IFVzZXJNZXNzYWdlKSA9PiB7XG4gICAgICByZXdpbmRDb252ZXJzYXRpb25UbyhtZXNzYWdlKVxuXG4gICAgICBjb25zdCByID0gdGV4dEZvclJlc3VibWl0KG1lc3NhZ2UpXG4gICAgICBpZiAocikge1xuICAgICAgICBzZXRJbnB1dFZhbHVlKHIudGV4dClcbiAgICAgICAgc2V0SW5wdXRNb2RlKHIubW9kZSlcbiAgICAgIH1cblxuICAgICAgLy8gUmVzdG9yZSBwYXN0ZWQgaW1hZ2VzXG4gICAgICBpZiAoXG4gICAgICAgIEFycmF5LmlzQXJyYXkobWVzc2FnZS5tZXNzYWdlLmNvbnRlbnQpICYmXG4gICAgICAgIG1lc3NhZ2UubWVzc2FnZS5jb250ZW50LnNvbWUoYmxvY2sgPT4gYmxvY2sudHlwZSA9PT0gJ2ltYWdlJylcbiAgICAgICkge1xuICAgICAgICBjb25zdCBpbWFnZUJsb2NrczogQXJyYXk8SW1hZ2VCbG9ja1BhcmFtPiA9XG4gICAgICAgICAgbWVzc2FnZS5tZXNzYWdlLmNvbnRlbnQuZmlsdGVyKGJsb2NrID0+IGJsb2NrLnR5cGUgPT09ICdpbWFnZScpXG4gICAgICAgIGlmIChpbWFnZUJsb2Nrcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29uc3QgbmV3UGFzdGVkQ29udGVudHM6IFJlY29yZDxudW1iZXIsIFBhc3RlZENvbnRlbnQ+ID0ge31cbiAgICAgICAgICBpbWFnZUJsb2Nrcy5mb3JFYWNoKChibG9jaywgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIGlmIChibG9jay5zb3VyY2UudHlwZSA9PT0gJ2Jhc2U2NCcpIHtcbiAgICAgICAgICAgICAgY29uc3QgaWQgPSBtZXNzYWdlLmltYWdlUGFzdGVJZHM/LltpbmRleF0gPz8gaW5kZXggKyAxXG4gICAgICAgICAgICAgIG5ld1Bhc3RlZENvbnRlbnRzW2lkXSA9IHtcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UnLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGJsb2NrLnNvdXJjZS5kYXRhLFxuICAgICAgICAgICAgICAgIG1lZGlhVHlwZTogYmxvY2suc291cmNlLm1lZGlhX3R5cGUsXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICAgIHNldFBhc3RlZENvbnRlbnRzKG5ld1Bhc3RlZENvbnRlbnRzKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcbiAgICBbcmV3aW5kQ29udmVyc2F0aW9uVG8sIHNldElucHV0VmFsdWVdLFxuICApXG4gIHJlc3RvcmVNZXNzYWdlU3luY1JlZi5jdXJyZW50ID0gcmVzdG9yZU1lc3NhZ2VTeW5jXG5cbiAgLy8gTWVzc2FnZVNlbGVjdG9yIHBhdGg6IGRlZmVyIHZpYSBzZXRJbW1lZGlhdGUgc28gdGhlIFwiSW50ZXJydXB0ZWRcIiBtZXNzYWdlXG4gIC8vIHJlbmRlcnMgdG8gc3RhdGljIG91dHB1dCBiZWZvcmUgcmV3aW5kIOKAlCBvdGhlcndpc2UgaXQgcmVtYWlucyB2ZXN0aWdpYWxcbiAgLy8gYXQgdGhlIHRvcCBvZiB0aGUgc2NyZWVuLlxuICBjb25zdCBoYW5kbGVSZXN0b3JlTWVzc2FnZSA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChtZXNzYWdlOiBVc2VyTWVzc2FnZSkgPT4ge1xuICAgICAgc2V0SW1tZWRpYXRlKFxuICAgICAgICAocmVzdG9yZSwgbWVzc2FnZSkgPT4gcmVzdG9yZShtZXNzYWdlKSxcbiAgICAgICAgcmVzdG9yZU1lc3NhZ2VTeW5jLFxuICAgICAgICBtZXNzYWdlLFxuICAgICAgKVxuICAgIH0sXG4gICAgW3Jlc3RvcmVNZXNzYWdlU3luY10sXG4gIClcblxuICAvLyBOb3QgbWVtb2l6ZWQg4oCUIGhvb2sgc3RvcmVzIGNhcHMgdmlhIHJlZiwgcmVhZHMgbGF0ZXN0IGNsb3N1cmUgYXQgZGlzcGF0Y2guXG4gIC8vIDI0LWNoYXIgcHJlZml4OiBkZXJpdmVVVUlEIHByZXNlcnZlcyBmaXJzdCAyNCwgcmVuZGVyYWJsZSB1dWlkIHByZWZpeC1tYXRjaGVzIHJhdyBzb3VyY2UuXG4gIGNvbnN0IGZpbmRSYXdJbmRleCA9ICh1dWlkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwcmVmaXggPSB1dWlkLnNsaWNlKDAsIDI0KVxuICAgIHJldHVybiBtZXNzYWdlcy5maW5kSW5kZXgobSA9PiBtLnV1aWQuc2xpY2UoMCwgMjQpID09PSBwcmVmaXgpXG4gIH1cbiAgY29uc3QgbWVzc2FnZUFjdGlvbkNhcHM6IE1lc3NhZ2VBY3Rpb25DYXBzID0ge1xuICAgIGNvcHk6IHRleHQgPT5cbiAgICAgIC8vIHNldENsaXBib2FyZCBSRVRVUk5TIE9TQyA1MiDigJQgY2FsbGVyIG11c3Qgc3Rkb3V0LndyaXRlICh0bXV4IHNpZGUtZWZmZWN0cyBsb2FkLWJ1ZmZlciwgYnV0IHRoYXQncyB0bXV4LW9ubHkpLlxuICAgICAgdm9pZCBzZXRDbGlwYm9hcmQodGV4dCkudGhlbihyYXcgPT4ge1xuICAgICAgICBpZiAocmF3KSBwcm9jZXNzLnN0ZG91dC53cml0ZShyYXcpXG4gICAgICAgIGFkZE5vdGlmaWNhdGlvbih7XG4gICAgICAgICAgLy8gU2FtZSBrZXkgYXMgdGV4dC1zZWxlY3Rpb24gY29weSDigJQgcmVwZWF0ZWQgY29waWVzIHJlcGxhY2UgdG9hc3QsIGRvbid0IHF1ZXVlLlxuICAgICAgICAgIGtleTogJ3NlbGVjdGlvbi1jb3BpZWQnLFxuICAgICAgICAgIHRleHQ6ICdjb3BpZWQnLFxuICAgICAgICAgIGNvbG9yOiAnc3VjY2VzcycsXG4gICAgICAgICAgcHJpb3JpdHk6ICdpbW1lZGlhdGUnLFxuICAgICAgICAgIHRpbWVvdXRNczogMjAwMCxcbiAgICAgICAgfSlcbiAgICAgIH0pLFxuICAgIGVkaXQ6IGFzeW5jIG1zZyA9PiB7XG4gICAgICAvLyBTYW1lIHNraXAtY29uZmlybSBjaGVjayBhcyAvcmV3aW5kOiBsb3NzbGVzcyDihpIgZGlyZWN0LCBlbHNlIGNvbmZpcm0gZGlhbG9nLlxuICAgICAgY29uc3QgcmF3SWR4ID0gZmluZFJhd0luZGV4KG1zZy51dWlkKVxuICAgICAgY29uc3QgcmF3ID0gcmF3SWR4ID49IDAgPyBtZXNzYWdlc1tyYXdJZHhdIDogdW5kZWZpbmVkXG4gICAgICBpZiAoIXJhdyB8fCAhc2VsZWN0YWJsZVVzZXJNZXNzYWdlc0ZpbHRlcihyYXcpKSByZXR1cm5cbiAgICAgIGNvbnN0IG5vRmlsZUNoYW5nZXMgPSAhKGF3YWl0IGZpbGVIaXN0b3J5SGFzQW55Q2hhbmdlcyhcbiAgICAgICAgZmlsZUhpc3RvcnksXG4gICAgICAgIHJhdy51dWlkLFxuICAgICAgKSlcbiAgICAgIGNvbnN0IG9ubHlTeW50aGV0aWMgPSBtZXNzYWdlc0FmdGVyQXJlT25seVN5bnRoZXRpYyhtZXNzYWdlcywgcmF3SWR4KVxuICAgICAgaWYgKG5vRmlsZUNoYW5nZXMgJiYgb25seVN5bnRoZXRpYykge1xuICAgICAgICAvLyByZXdpbmRDb252ZXJzYXRpb25UbydzIHNldE1lc3NhZ2VzIHJhY2VzIHN0cmVhbSBhcHBlbmRzIOKAlCBjYW5jZWwgZmlyc3QgKGlkZW1wb3RlbnQpLlxuICAgICAgICBvbkNhbmNlbCgpXG4gICAgICAgIC8vIGhhbmRsZVJlc3RvcmVNZXNzYWdlIGFsc28gcmVzdG9yZXMgcGFzdGVkIGltYWdlcy5cbiAgICAgICAgdm9pZCBoYW5kbGVSZXN0b3JlTWVzc2FnZShyYXcpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBEaWFsb2cgcGF0aDogb25QcmVSZXN0b3JlICg9IG9uQ2FuY2VsKSBmaXJlcyB3aGVuIHVzZXIgQ09ORklSTVMsIG5vdCBvbiBuZXZlcm1pbmQuXG4gICAgICAgIHNldE1lc3NhZ2VTZWxlY3RvclByZXNlbGVjdChyYXcpXG4gICAgICAgIHNldElzTWVzc2FnZVNlbGVjdG9yVmlzaWJsZSh0cnVlKVxuICAgICAgfVxuICAgIH0sXG4gIH1cbiAgY29uc3QgeyBlbnRlcjogZW50ZXJNZXNzYWdlQWN0aW9ucywgaGFuZGxlcnM6IG1lc3NhZ2VBY3Rpb25IYW5kbGVycyB9ID1cbiAgICB1c2VNZXNzYWdlQWN0aW9ucyhjdXJzb3IsIHNldEN1cnNvciwgY3Vyc29yTmF2UmVmLCBtZXNzYWdlQWN0aW9uQ2FwcylcblxuICBhc3luYyBmdW5jdGlvbiBvbkluaXQoKSB7XG4gICAgLy8gQWx3YXlzIHZlcmlmeSBBUEkga2V5IG9uIHN0YXJ0dXAsIHNvIHdlIGNhbiBzaG93IHRoZSB1c2VyIGFuIGVycm9yIGluIHRoZVxuICAgIC8vIGJvdHRvbSByaWdodCBjb3JuZXIgb2YgdGhlIHNjcmVlbiBpZiB0aGUgQVBJIGtleSBpcyBpbnZhbGlkLlxuICAgIHZvaWQgcmV2ZXJpZnkoKVxuXG4gICAgLy8gUG9wdWxhdGUgcmVhZEZpbGVTdGF0ZSB3aXRoIENMQVVERS5tZCBmaWxlcyBhdCBzdGFydHVwXG4gICAgY29uc3QgbWVtb3J5RmlsZXMgPSBhd2FpdCBnZXRNZW1vcnlGaWxlcygpXG4gICAgaWYgKG1lbW9yeUZpbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGZpbGVMaXN0ID0gbWVtb3J5RmlsZXNcbiAgICAgICAgLm1hcChcbiAgICAgICAgICBmID0+XG4gICAgICAgICAgICBgICBbJHtmLnR5cGV9XSAke2YucGF0aH0gKCR7Zi5jb250ZW50Lmxlbmd0aH0gY2hhcnMpJHtmLnBhcmVudCA/IGAgKGluY2x1ZGVkIGJ5ICR7Zi5wYXJlbnR9KWAgOiAnJ31gLFxuICAgICAgICApXG4gICAgICAgIC5qb2luKCdcXG4nKVxuICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICBgTG9hZGVkICR7bWVtb3J5RmlsZXMubGVuZ3RofSBDTEFVREUubWQvcnVsZXMgZmlsZXM6XFxuJHtmaWxlTGlzdH1gLFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoJ05vIENMQVVERS5tZC9ydWxlcyBmaWxlcyBmb3VuZCcpXG4gICAgfVxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBtZW1vcnlGaWxlcykge1xuICAgICAgLy8gV2hlbiB0aGUgaW5qZWN0ZWQgY29udGVudCBkb2Vzbid0IG1hdGNoIGRpc2sgKHN0cmlwcGVkIEhUTUwgY29tbWVudHMsXG4gICAgICAvLyBzdHJpcHBlZCBmcm9udG1hdHRlciwgTUVNT1JZLm1kIHRydW5jYXRpb24pLCBjYWNoZSB0aGUgUkFXIGRpc2sgYnl0ZXNcbiAgICAgIC8vIHdpdGggaXNQYXJ0aWFsVmlldyBzbyBFZGl0L1dyaXRlIHJlcXVpcmUgYSByZWFsIFJlYWQgZmlyc3Qgd2hpbGVcbiAgICAgIC8vIGdldENoYW5nZWRGaWxlcyArIG5lc3RlZF9tZW1vcnkgZGVkdXAgc3RpbGwgd29yay5cbiAgICAgIHJlYWRGaWxlU3RhdGUuY3VycmVudC5zZXQoZmlsZS5wYXRoLCB7XG4gICAgICAgIGNvbnRlbnQ6IGZpbGUuY29udGVudERpZmZlcnNGcm9tRGlza1xuICAgICAgICAgID8gKGZpbGUucmF3Q29udGVudCA/PyBmaWxlLmNvbnRlbnQpXG4gICAgICAgICAgOiBmaWxlLmNvbnRlbnQsXG4gICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICAgICAgb2Zmc2V0OiB1bmRlZmluZWQsXG4gICAgICAgIGxpbWl0OiB1bmRlZmluZWQsXG4gICAgICAgIGlzUGFydGlhbFZpZXc6IGZpbGUuY29udGVudERpZmZlcnNGcm9tRGlzayxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gSW5pdGlhbCBtZXNzYWdlIGhhbmRsaW5nIGlzIGRvbmUgdmlhIHRoZSBpbml0aWFsTWVzc2FnZSBlZmZlY3RcbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIGNvc3Qgc3VtbWFyeSB0cmFja2VyXG4gIHVzZUNvc3RTdW1tYXJ5KHVzZUZwc01ldHJpY3MoKSlcblxuICAvLyBSZWNvcmQgdHJhbnNjcmlwdHMgbG9jYWxseSwgZm9yIGRlYnVnZ2luZyBhbmQgY29udmVyc2F0aW9uIHJlY292ZXJ5XG4gIC8vIERvbid0IHJlY29yZCBjb252ZXJzYXRpb24gaWYgd2Ugb25seSBoYXZlIGluaXRpYWwgbWVzc2FnZXM7IG9wdGltaXplc1xuICAvLyB0aGUgY2FzZSB3aGVyZSB1c2VyIHJlc3VtZXMgYSBjb252ZXJzYXRpb24gdGhlbiBxdWl0ZXMgYmVmb3JlIGRvaW5nXG4gIC8vIGFueXRoaW5nIGVsc2VcbiAgdXNlTG9nTWVzc2FnZXMobWVzc2FnZXMsIG1lc3NhZ2VzLmxlbmd0aCA9PT0gaW5pdGlhbE1lc3NhZ2VzPy5sZW5ndGgpXG5cbiAgLy8gUkVQTCBCcmlkZ2U6IHJlcGxpY2F0ZSB1c2VyL2Fzc2lzdGFudCBtZXNzYWdlcyB0byB0aGUgYnJpZGdlIHNlc3Npb25cbiAgLy8gZm9yIHJlbW90ZSBhY2Nlc3MgdmlhIGNsYXVkZS5haS4gTm8tb3AgaW4gZXh0ZXJuYWwgYnVpbGRzIG9yIHdoZW4gbm90IGVuYWJsZWQuXG4gIGNvbnN0IHsgc2VuZEJyaWRnZVJlc3VsdCB9ID0gdXNlUmVwbEJyaWRnZShcbiAgICBtZXNzYWdlcyxcbiAgICBzZXRNZXNzYWdlcyxcbiAgICBhYm9ydENvbnRyb2xsZXJSZWYsXG4gICAgY29tbWFuZHMsXG4gICAgbWFpbkxvb3BNb2RlbCxcbiAgKVxuICBzZW5kQnJpZGdlUmVzdWx0UmVmLmN1cnJlbnQgPSBzZW5kQnJpZGdlUmVzdWx0XG5cbiAgdXNlQWZ0ZXJGaXJzdFJlbmRlcigpXG5cbiAgLy8gVHJhY2sgcHJvbXB0IHF1ZXVlIHVzYWdlIGZvciBhbmFseXRpY3MuIEZpcmUgb25jZSBwZXIgdHJhbnNpdGlvbiBmcm9tXG4gIC8vIGVtcHR5IHRvIG5vbi1lbXB0eSwgbm90IG9uIGV2ZXJ5IGxlbmd0aCBjaGFuZ2UgLS0gb3RoZXJ3aXNlIGEgcmVuZGVyIGxvb3BcbiAgLy8gKGNvbmN1cnJlbnQgb25RdWVyeSB0aHJhc2hpbmcsIGV0Yy4pIHNwYW1zIHNhdmVHbG9iYWxDb25maWcsIHdoaWNoIGhpdHNcbiAgLy8gRUxPQ0tFRCB1bmRlciBjb25jdXJyZW50IHNlc3Npb25zIGFuZCBmYWxscyBiYWNrIHRvIHVubG9ja2VkIHdyaXRlcy5cbiAgLy8gVGhhdCB3cml0ZSBzdG9ybSBpcyB0aGUgcHJpbWFyeSB0cmlnZ2VyIGZvciB+Ly5jbGF1ZGUuanNvbiBjb3JydXB0aW9uXG4gIC8vIChHSCAjMzExNykuXG4gIGNvbnN0IGhhc0NvdW50ZWRRdWV1ZVVzZVJlZiA9IHVzZVJlZihmYWxzZSlcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAocXVldWVkQ29tbWFuZHMubGVuZ3RoIDwgMSkge1xuICAgICAgaGFzQ291bnRlZFF1ZXVlVXNlUmVmLmN1cnJlbnQgPSBmYWxzZVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmIChoYXNDb3VudGVkUXVldWVVc2VSZWYuY3VycmVudCkgcmV0dXJuXG4gICAgaGFzQ291bnRlZFF1ZXVlVXNlUmVmLmN1cnJlbnQgPSB0cnVlXG4gICAgc2F2ZUdsb2JhbENvbmZpZyhjdXJyZW50ID0+ICh7XG4gICAgICAuLi5jdXJyZW50LFxuICAgICAgcHJvbXB0UXVldWVVc2VDb3VudDogKGN1cnJlbnQucHJvbXB0UXVldWVVc2VDb3VudCA/PyAwKSArIDEsXG4gICAgfSkpXG4gIH0sIFtxdWV1ZWRDb21tYW5kcy5sZW5ndGhdKVxuXG4gIC8vIFByb2Nlc3MgcXVldWVkIGNvbW1hbmRzIHdoZW4gcXVlcnkgY29tcGxldGVzIGFuZCBxdWV1ZSBoYXMgaXRlbXNcblxuICBjb25zdCBleGVjdXRlUXVldWVkSW5wdXQgPSB1c2VDYWxsYmFjayhcbiAgICBhc3luYyAocXVldWVkQ29tbWFuZHM6IFF1ZXVlZENvbW1hbmRbXSkgPT4ge1xuICAgICAgYXdhaXQgaGFuZGxlUHJvbXB0U3VibWl0KHtcbiAgICAgICAgaGVscGVyczoge1xuICAgICAgICAgIHNldEN1cnNvck9mZnNldDogKCkgPT4ge30sXG4gICAgICAgICAgY2xlYXJCdWZmZXI6ICgpID0+IHt9LFxuICAgICAgICAgIHJlc2V0SGlzdG9yeTogKCkgPT4ge30sXG4gICAgICAgIH0sXG4gICAgICAgIHF1ZXJ5R3VhcmQsXG4gICAgICAgIGNvbW1hbmRzLFxuICAgICAgICBvbklucHV0Q2hhbmdlOiAoKSA9PiB7fSxcbiAgICAgICAgc2V0UGFzdGVkQ29udGVudHM6ICgpID0+IHt9LFxuICAgICAgICBzZXRUb29sSlNYLFxuICAgICAgICBnZXRUb29sVXNlQ29udGV4dCxcbiAgICAgICAgbWVzc2FnZXMsXG4gICAgICAgIG1haW5Mb29wTW9kZWwsXG4gICAgICAgIGlkZVNlbGVjdGlvbixcbiAgICAgICAgc2V0VXNlcklucHV0T25Qcm9jZXNzaW5nLFxuICAgICAgICBzZXRBYm9ydENvbnRyb2xsZXIsXG4gICAgICAgIG9uUXVlcnksXG4gICAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgICBxdWVyeVNvdXJjZTogZ2V0UXVlcnlTb3VyY2VGb3JSRVBMKCksXG4gICAgICAgIG9uQmVmb3JlUXVlcnksXG4gICAgICAgIGNhblVzZVRvb2wsXG4gICAgICAgIGFkZE5vdGlmaWNhdGlvbixcbiAgICAgICAgc2V0TWVzc2FnZXMsXG4gICAgICAgIHF1ZXVlZENvbW1hbmRzLFxuICAgICAgfSlcbiAgICB9LFxuICAgIFtcbiAgICAgIHF1ZXJ5R3VhcmQsXG4gICAgICBjb21tYW5kcyxcbiAgICAgIHNldFRvb2xKU1gsXG4gICAgICBnZXRUb29sVXNlQ29udGV4dCxcbiAgICAgIG1lc3NhZ2VzLFxuICAgICAgbWFpbkxvb3BNb2RlbCxcbiAgICAgIGlkZVNlbGVjdGlvbixcbiAgICAgIHNldFVzZXJJbnB1dE9uUHJvY2Vzc2luZyxcbiAgICAgIGNhblVzZVRvb2wsXG4gICAgICBzZXRBYm9ydENvbnRyb2xsZXIsXG4gICAgICBvblF1ZXJ5LFxuICAgICAgYWRkTm90aWZpY2F0aW9uLFxuICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICBvbkJlZm9yZVF1ZXJ5LFxuICAgIF0sXG4gIClcblxuICB1c2VRdWV1ZVByb2Nlc3Nvcih7XG4gICAgZXhlY3V0ZVF1ZXVlZElucHV0LFxuICAgIGhhc0FjdGl2ZUxvY2FsSnN4VUk6IGlzU2hvd2luZ0xvY2FsSlNYQ29tbWFuZCxcbiAgICBxdWVyeUd1YXJkLFxuICB9KVxuXG4gIC8vIFdlJ2xsIHVzZSB0aGUgZ2xvYmFsIGxhc3RJbnRlcmFjdGlvblRpbWUgZnJvbSBzdGF0ZS50c1xuXG4gIC8vIFVwZGF0ZSBsYXN0IGludGVyYWN0aW9uIHRpbWUgd2hlbiBpbnB1dCBjaGFuZ2VzLlxuICAvLyBNdXN0IGJlIGltbWVkaWF0ZSBiZWNhdXNlIHVzZUVmZmVjdCBydW5zIGFmdGVyIHRoZSBJbmsgcmVuZGVyIGN5Y2xlIGZsdXNoLlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGFjdGl2aXR5TWFuYWdlci5yZWNvcmRVc2VyQWN0aXZpdHkoKVxuICAgIHVwZGF0ZUxhc3RJbnRlcmFjdGlvblRpbWUodHJ1ZSlcbiAgfSwgW2lucHV0VmFsdWUsIHN1Ym1pdENvdW50XSlcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChzdWJtaXRDb3VudCA9PT0gMSkge1xuICAgICAgc3RhcnRCYWNrZ3JvdW5kSG91c2VrZWVwaW5nKClcbiAgICB9XG4gIH0sIFtzdWJtaXRDb3VudF0pXG5cbiAgLy8gU2hvdyBub3RpZmljYXRpb24gd2hlbiBDbGF1ZGUgaXMgZG9uZSByZXNwb25kaW5nIGFuZCB1c2VyIGlzIGlkbGVcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAvLyBEb24ndCBzZXQgdXAgbm90aWZpY2F0aW9uIGlmIENsYXVkZSBpcyBidXN5XG4gICAgaWYgKGlzTG9hZGluZykgcmV0dXJuXG5cbiAgICAvLyBPbmx5IGVuYWJsZSBub3RpZmljYXRpb25zIGFmdGVyIHRoZSBmaXJzdCBuZXcgaW50ZXJhY3Rpb24gaW4gdGhpcyBzZXNzaW9uXG4gICAgaWYgKHN1Ym1pdENvdW50ID09PSAwKSByZXR1cm5cblxuICAgIC8vIE5vIHF1ZXJ5IGhhcyBjb21wbGV0ZWQgeWV0XG4gICAgaWYgKGxhc3RRdWVyeUNvbXBsZXRpb25UaW1lID09PSAwKSByZXR1cm5cblxuICAgIC8vIFNldCB0aW1lb3V0IHRvIGNoZWNrIGlkbGUgc3RhdGVcbiAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoXG4gICAgICAoXG4gICAgICAgIGxhc3RRdWVyeUNvbXBsZXRpb25UaW1lLFxuICAgICAgICBpc0xvYWRpbmcsXG4gICAgICAgIHRvb2xKU1gsXG4gICAgICAgIGZvY3VzZWRJbnB1dERpYWxvZ1JlZixcbiAgICAgICAgdGVybWluYWwsXG4gICAgICApID0+IHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgdXNlciBoYXMgaW50ZXJhY3RlZCBzaW5jZSB0aGUgcmVzcG9uc2UgZW5kZWRcbiAgICAgICAgY29uc3QgbGFzdFVzZXJJbnRlcmFjdGlvbiA9IGdldExhc3RJbnRlcmFjdGlvblRpbWUoKVxuXG4gICAgICAgIGlmIChsYXN0VXNlckludGVyYWN0aW9uID4gbGFzdFF1ZXJ5Q29tcGxldGlvblRpbWUpIHtcbiAgICAgICAgICAvLyBVc2VyIGhhcyBpbnRlcmFjdGVkIHNpbmNlIENsYXVkZSBmaW5pc2hlZCAtIHRoZXkncmUgbm90IGlkbGUsIGRvbid0IG5vdGlmeVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlciBoYXNuJ3QgaW50ZXJhY3RlZCBzaW5jZSByZXNwb25zZSBlbmRlZCwgY2hlY2sgb3RoZXIgY29uZGl0aW9uc1xuICAgICAgICBjb25zdCBpZGxlVGltZVNpbmNlUmVzcG9uc2UgPSBEYXRlLm5vdygpIC0gbGFzdFF1ZXJ5Q29tcGxldGlvblRpbWVcbiAgICAgICAgaWYgKFxuICAgICAgICAgICFpc0xvYWRpbmcgJiZcbiAgICAgICAgICAhdG9vbEpTWCAmJlxuICAgICAgICAgIC8vIFVzZSByZWYgdG8gZ2V0IGN1cnJlbnQgZGlhbG9nIHN0YXRlLCBhdm9pZGluZyBzdGFsZSBjbG9zdXJlXG4gICAgICAgICAgZm9jdXNlZElucHV0RGlhbG9nUmVmLmN1cnJlbnQgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgIGlkbGVUaW1lU2luY2VSZXNwb25zZSA+PSBnZXRHbG9iYWxDb25maWcoKS5tZXNzYWdlSWRsZU5vdGlmVGhyZXNob2xkTXNcbiAgICAgICAgKSB7XG4gICAgICAgICAgdm9pZCBzZW5kTm90aWZpY2F0aW9uKFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBtZXNzYWdlOiAnQ2xhdWRlIGlzIHdhaXRpbmcgZm9yIHlvdXIgaW5wdXQnLFxuICAgICAgICAgICAgICBub3RpZmljYXRpb25UeXBlOiAnaWRsZV9wcm9tcHQnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRlcm1pbmFsLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGdldEdsb2JhbENvbmZpZygpLm1lc3NhZ2VJZGxlTm90aWZUaHJlc2hvbGRNcyxcbiAgICAgIGxhc3RRdWVyeUNvbXBsZXRpb25UaW1lLFxuICAgICAgaXNMb2FkaW5nLFxuICAgICAgdG9vbEpTWCxcbiAgICAgIGZvY3VzZWRJbnB1dERpYWxvZ1JlZixcbiAgICAgIHRlcm1pbmFsLFxuICAgIClcblxuICAgIHJldHVybiAoKSA9PiBjbGVhclRpbWVvdXQodGltZXIpXG4gIH0sIFtpc0xvYWRpbmcsIHRvb2xKU1gsIHN1Ym1pdENvdW50LCBsYXN0UXVlcnlDb21wbGV0aW9uVGltZSwgdGVybWluYWxdKVxuXG4gIC8vIElkbGUtcmV0dXJuIGhpbnQ6IHNob3cgbm90aWZpY2F0aW9uIHdoZW4gaWRsZSB0aHJlc2hvbGQgaXMgZXhjZWVkZWQuXG4gIC8vIFRpbWVyIGZpcmVzIGFmdGVyIHRoZSBjb25maWd1cmVkIGlkbGUgcGVyaW9kOyBub3RpZmljYXRpb24gcGVyc2lzdHMgdW50aWxcbiAgLy8gZGlzbWlzc2VkIG9yIHRoZSB1c2VyIHN1Ym1pdHMuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGxhc3RRdWVyeUNvbXBsZXRpb25UaW1lID09PSAwKSByZXR1cm5cbiAgICBpZiAoaXNMb2FkaW5nKSByZXR1cm5cbiAgICBjb25zdCB3aWxsb3dNb2RlOiBzdHJpbmcgPSBnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRShcbiAgICAgICd0ZW5ndV93aWxsb3dfbW9kZScsXG4gICAgICAnb2ZmJyxcbiAgICApXG4gICAgaWYgKHdpbGxvd01vZGUgIT09ICdoaW50JyAmJiB3aWxsb3dNb2RlICE9PSAnaGludF92MicpIHJldHVyblxuICAgIGlmIChnZXRHbG9iYWxDb25maWcoKS5pZGxlUmV0dXJuRGlzbWlzc2VkKSByZXR1cm5cblxuICAgIGNvbnN0IHRva2VuVGhyZXNob2xkID0gTnVtYmVyKFxuICAgICAgcHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfSURMRV9UT0tFTl9USFJFU0hPTEQgPz8gMTAwXzAwMCxcbiAgICApXG4gICAgaWYgKGdldFRvdGFsSW5wdXRUb2tlbnMoKSA8IHRva2VuVGhyZXNob2xkKSByZXR1cm5cblxuICAgIGNvbnN0IGlkbGVUaHJlc2hvbGRNcyA9XG4gICAgICBOdW1iZXIocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfSURMRV9USFJFU0hPTERfTUlOVVRFUyA/PyA3NSkgKiA2MF8wMDBcbiAgICBjb25zdCBlbGFwc2VkID0gRGF0ZS5ub3coKSAtIGxhc3RRdWVyeUNvbXBsZXRpb25UaW1lXG4gICAgY29uc3QgcmVtYWluaW5nID0gaWRsZVRocmVzaG9sZE1zIC0gZWxhcHNlZFxuXG4gICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KFxuICAgICAgKGxxY3QsIGFkZE5vdGlmLCBtc2dzUmVmLCBtb2RlLCBoaW50UmVmKSA9PiB7XG4gICAgICAgIGlmIChtc2dzUmVmLmN1cnJlbnQubGVuZ3RoID09PSAwKSByZXR1cm5cbiAgICAgICAgY29uc3QgdG90YWxUb2tlbnMgPSBnZXRUb3RhbElucHV0VG9rZW5zKClcbiAgICAgICAgY29uc3QgZm9ybWF0dGVkVG9rZW5zID0gZm9ybWF0VG9rZW5zKHRvdGFsVG9rZW5zKVxuICAgICAgICBjb25zdCBpZGxlTWludXRlcyA9IChEYXRlLm5vdygpIC0gbHFjdCkgLyA2MF8wMDBcbiAgICAgICAgYWRkTm90aWYoe1xuICAgICAgICAgIGtleTogJ2lkbGUtcmV0dXJuLWhpbnQnLFxuICAgICAgICAgIGpzeDpcbiAgICAgICAgICAgIG1vZGUgPT09ICdoaW50X3YyJyA/IChcbiAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5uZXcgdGFzaz8gPC9UZXh0PlxuICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VnZ2VzdGlvblwiPi9jbGVhcjwvVGV4dD5cbiAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4gdG8gc2F2ZSA8L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+e2Zvcm1hdHRlZFRva2Vuc30gdG9rZW5zPC9UZXh0PlxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgICAgICAgIG5ldyB0YXNrPyAvY2xlYXIgdG8gc2F2ZSB7Zm9ybWF0dGVkVG9rZW5zfSB0b2tlbnNcbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKSxcbiAgICAgICAgICBwcmlvcml0eTogJ21lZGl1bScsXG4gICAgICAgICAgLy8gUGVyc2lzdCB1bnRpbCBzdWJtaXQg4oCUIHRoZSBoaW50IGZpcmVzIGF0IFQrNzVtaW4gaWRsZSwgdXNlciBtYXlcbiAgICAgICAgICAvLyBub3QgcmV0dXJuIGZvciBob3Vycy4gcmVtb3ZlTm90aWZpY2F0aW9uIGluIHVzZUVmZmVjdCBjbGVhbnVwXG4gICAgICAgICAgLy8gaGFuZGxlcyBkaXNtaXNzYWwuIDB4N0ZGRkZGRkYgPSBzZXRUaW1lb3V0IG1heCAofjI0LjggZGF5cykuXG4gICAgICAgICAgdGltZW91dE1zOiAweDdmZmZmZmZmLFxuICAgICAgICB9KVxuICAgICAgICBoaW50UmVmLmN1cnJlbnQgPSBtb2RlXG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9pZGxlX3JldHVybl9hY3Rpb24nLCB7XG4gICAgICAgICAgYWN0aW9uOlxuICAgICAgICAgICAgJ2hpbnRfc2hvd24nIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgdmFyaWFudDpcbiAgICAgICAgICAgIG1vZGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICBpZGxlTWludXRlczogTWF0aC5yb3VuZChpZGxlTWludXRlcyksXG4gICAgICAgICAgbWVzc2FnZUNvdW50OiBtc2dzUmVmLmN1cnJlbnQubGVuZ3RoLFxuICAgICAgICAgIHRvdGFsSW5wdXRUb2tlbnM6IHRvdGFsVG9rZW5zLFxuICAgICAgICB9KVxuICAgICAgfSxcbiAgICAgIE1hdGgubWF4KDAsIHJlbWFpbmluZyksXG4gICAgICBsYXN0UXVlcnlDb21wbGV0aW9uVGltZSxcbiAgICAgIGFkZE5vdGlmaWNhdGlvbixcbiAgICAgIG1lc3NhZ2VzUmVmLFxuICAgICAgd2lsbG93TW9kZSxcbiAgICAgIGlkbGVIaW50U2hvd25SZWYsXG4gICAgKVxuXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcilcbiAgICAgIHJlbW92ZU5vdGlmaWNhdGlvbignaWRsZS1yZXR1cm4taGludCcpXG4gICAgICBpZGxlSGludFNob3duUmVmLmN1cnJlbnQgPSBmYWxzZVxuICAgIH1cbiAgfSwgW2xhc3RRdWVyeUNvbXBsZXRpb25UaW1lLCBpc0xvYWRpbmcsIGFkZE5vdGlmaWNhdGlvbiwgcmVtb3ZlTm90aWZpY2F0aW9uXSlcblxuICAvLyBTdWJtaXRzIGluY29taW5nIHByb21wdHMgZnJvbSB0ZWFtbWF0ZSBtZXNzYWdlcyBvciB0YXNrcyBtb2RlIGFzIG5ldyB0dXJuc1xuICAvLyBSZXR1cm5zIHRydWUgaWYgc3VibWlzc2lvbiBzdWNjZWVkZWQsIGZhbHNlIGlmIGEgcXVlcnkgaXMgYWxyZWFkeSBydW5uaW5nXG4gIGNvbnN0IGhhbmRsZUluY29taW5nUHJvbXB0ID0gdXNlQ2FsbGJhY2soXG4gICAgKGNvbnRlbnQ6IHN0cmluZywgb3B0aW9ucz86IHsgaXNNZXRhPzogYm9vbGVhbiB9KTogYm9vbGVhbiA9PiB7XG4gICAgICBpZiAocXVlcnlHdWFyZC5pc0FjdGl2ZSkgcmV0dXJuIGZhbHNlXG5cbiAgICAgIC8vIERlZmVyIHRvIHVzZXItcXVldWVkIGNvbW1hbmRzIOKAlCB1c2VyIGlucHV0IGFsd2F5cyB0YWtlcyBwcmlvcml0eVxuICAgICAgLy8gb3ZlciBzeXN0ZW0gbWVzc2FnZXMgKHRlYW1tYXRlIG1lc3NhZ2VzLCB0YXNrIGxpc3QgaXRlbXMsIGV0Yy4pXG4gICAgICAvLyBSZWFkIGZyb20gdGhlIG1vZHVsZS1sZXZlbCBzdG9yZSBhdCBjYWxsIHRpbWUgKG5vdCB0aGUgcmVuZGVyLXRpbWVcbiAgICAgIC8vIHNuYXBzaG90KSB0byBhdm9pZCBhIHN0YWxlIGNsb3N1cmUg4oCUIHRoaXMgY2FsbGJhY2sncyBkZXBzIGRvbid0XG4gICAgICAvLyBpbmNsdWRlIHRoZSBxdWV1ZS5cbiAgICAgIGlmIChcbiAgICAgICAgZ2V0Q29tbWFuZFF1ZXVlKCkuc29tZShcbiAgICAgICAgICBjbWQgPT4gY21kLm1vZGUgPT09ICdwcm9tcHQnIHx8IGNtZC5tb2RlID09PSAnYmFzaCcsXG4gICAgICAgIClcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cblxuICAgICAgY29uc3QgbmV3QWJvcnRDb250cm9sbGVyID0gY3JlYXRlQWJvcnRDb250cm9sbGVyKClcbiAgICAgIHNldEFib3J0Q29udHJvbGxlcihuZXdBYm9ydENvbnRyb2xsZXIpXG5cbiAgICAgIC8vIENyZWF0ZSBhIHVzZXIgbWVzc2FnZSB3aXRoIHRoZSBmb3JtYXR0ZWQgY29udGVudCAoaW5jbHVkZXMgWE1MIHdyYXBwZXIpXG4gICAgICBjb25zdCB1c2VyTWVzc2FnZSA9IGNyZWF0ZVVzZXJNZXNzYWdlKHtcbiAgICAgICAgY29udGVudCxcbiAgICAgICAgaXNNZXRhOiBvcHRpb25zPy5pc01ldGEgPyB0cnVlIDogdW5kZWZpbmVkLFxuICAgICAgfSlcblxuICAgICAgdm9pZCBvblF1ZXJ5KFt1c2VyTWVzc2FnZV0sIG5ld0Fib3J0Q29udHJvbGxlciwgdHJ1ZSwgW10sIG1haW5Mb29wTW9kZWwpXG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH0sXG4gICAgW29uUXVlcnksIG1haW5Mb29wTW9kZWwsIHN0b3JlXSxcbiAgKVxuXG4gIC8vIFZvaWNlIGlucHV0IGludGVncmF0aW9uIChWT0lDRV9NT0RFIGJ1aWxkcyBvbmx5KVxuICBjb25zdCB2b2ljZSA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKVxuICAgID8gLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgICAgdXNlVm9pY2VJbnRlZ3JhdGlvbih7IHNldElucHV0VmFsdWVSYXcsIGlucHV0VmFsdWVSZWYsIGluc2VydFRleHRSZWYgfSlcbiAgICA6IHtcbiAgICAgICAgc3RyaXBUcmFpbGluZzogKCkgPT4gMCxcbiAgICAgICAgaGFuZGxlS2V5RXZlbnQ6ICgpID0+IHt9LFxuICAgICAgICByZXNldEFuY2hvcjogKCkgPT4ge30sXG4gICAgICAgIGludGVyaW1SYW5nZTogbnVsbCxcbiAgICAgIH1cblxuICB1c2VJbmJveFBvbGxlcih7XG4gICAgZW5hYmxlZDogaXNBZ2VudFN3YXJtc0VuYWJsZWQoKSxcbiAgICBpc0xvYWRpbmcsXG4gICAgZm9jdXNlZElucHV0RGlhbG9nLFxuICAgIG9uU3VibWl0TWVzc2FnZTogaGFuZGxlSW5jb21pbmdQcm9tcHQsXG4gIH0pXG5cbiAgdXNlTWFpbGJveEJyaWRnZSh7IGlzTG9hZGluZywgb25TdWJtaXRNZXNzYWdlOiBoYW5kbGVJbmNvbWluZ1Byb21wdCB9KVxuXG4gIC8vIFNjaGVkdWxlZCB0YXNrcyBmcm9tIC5jbGF1ZGUvc2NoZWR1bGVkX3Rhc2tzLmpzb24gKENyb25DcmVhdGUvRGVsZXRlL0xpc3QpXG4gIGlmIChmZWF0dXJlKCdBR0VOVF9UUklHR0VSUycpKSB7XG4gICAgLy8gQXNzaXN0YW50IG1vZGUgYnlwYXNzZXMgdGhlIGlzTG9hZGluZyBnYXRlICh0aGUgcHJvYWN0aXZlIHRpY2sg4oaSXG4gICAgLy8gU2xlZXAg4oaSIHRpY2sgbG9vcCB3b3VsZCBvdGhlcndpc2Ugc3RhcnZlIHRoZSBzY2hlZHVsZXIpLlxuICAgIC8vIGthaXJvc0VuYWJsZWQgaXMgc2V0IG9uY2UgaW4gaW5pdGlhbFN0YXRlIChtYWluLnRzeCkgYW5kIG5ldmVyIG11dGF0ZWQg4oCUIG5vXG4gICAgLy8gc3Vic2NyaXB0aW9uIG5lZWRlZC4gVGhlIHRlbmd1X2thaXJvc19jcm9uIHJ1bnRpbWUgZ2F0ZSBpcyBjaGVja2VkIGluc2lkZVxuICAgIC8vIHVzZVNjaGVkdWxlZFRhc2tzJ3MgZWZmZWN0IChub3QgaGVyZSkgc2luY2Ugd3JhcHBpbmcgYSBob29rIGNhbGwgaW4gYSBkeW5hbWljXG4gICAgLy8gY29uZGl0aW9uIHdvdWxkIGJyZWFrIHJ1bGVzLW9mLWhvb2tzLlxuICAgIGNvbnN0IGFzc2lzdGFudE1vZGUgPSBzdG9yZS5nZXRTdGF0ZSgpLmthaXJvc0VuYWJsZWRcbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gICAgdXNlU2NoZWR1bGVkVGFza3MhKHsgaXNMb2FkaW5nLCBhc3Npc3RhbnRNb2RlLCBzZXRNZXNzYWdlcyB9KVxuICB9XG5cbiAgLy8gTm90ZTogUGVybWlzc2lvbiBwb2xsaW5nIGlzIG5vdyBoYW5kbGVkIGJ5IHVzZUluYm94UG9sbGVyXG4gIC8vIC0gV29ya2VycyByZWNlaXZlIHBlcm1pc3Npb24gcmVzcG9uc2VzIHZpYSBtYWlsYm94IG1lc3NhZ2VzXG4gIC8vIC0gTGVhZGVycyByZWNlaXZlIHBlcm1pc3Npb24gcmVxdWVzdHMgdmlhIG1haWxib3ggbWVzc2FnZXNcblxuICBpZiAoXCJleHRlcm5hbFwiID09PSAnYW50Jykge1xuICAgIC8vIFRhc2tzIG1vZGU6IHdhdGNoIGZvciB0YXNrcyBhbmQgYXV0by1wcm9jZXNzIHRoZW1cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcmVhY3QtaG9va3MvcnVsZXMtb2YtaG9va3NcbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogY29uZGl0aW9uYWwgZm9yIGRlYWQgY29kZSBlbGltaW5hdGlvbiBpbiBleHRlcm5hbCBidWlsZHNcbiAgICB1c2VUYXNrTGlzdFdhdGNoZXIoe1xuICAgICAgdGFza0xpc3RJZCxcbiAgICAgIGlzTG9hZGluZyxcbiAgICAgIG9uU3VibWl0VGFzazogaGFuZGxlSW5jb21pbmdQcm9tcHQsXG4gICAgfSlcblxuICAgIC8vIExvb3AgbW9kZTogYXV0by10aWNrIHdoZW4gZW5hYmxlZCAodmlhIC9qb2IgY29tbWFuZClcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcmVhY3QtaG9va3MvcnVsZXMtb2YtaG9va3NcbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogY29uZGl0aW9uYWwgZm9yIGRlYWQgY29kZSBlbGltaW5hdGlvbiBpbiBleHRlcm5hbCBidWlsZHNcbiAgICB1c2VQcm9hY3RpdmU/Lih7XG4gICAgICAvLyBTdXBwcmVzcyB0aWNrcyB3aGlsZSBhbiBpbml0aWFsIG1lc3NhZ2UgaXMgcGVuZGluZyDigJQgdGhlIGluaXRpYWxcbiAgICAgIC8vIG1lc3NhZ2Ugd2lsbCBiZSBwcm9jZXNzZWQgYXN5bmNocm9ub3VzbHkgYW5kIGEgcHJlbWF0dXJlIHRpY2sgd291bGRcbiAgICAgIC8vIHJhY2Ugd2l0aCBpdCwgY2F1c2luZyBjb25jdXJyZW50LXF1ZXJ5IGVucXVldWUgb2YgZXhwYW5kZWQgc2tpbGwgdGV4dC5cbiAgICAgIGlzTG9hZGluZzogaXNMb2FkaW5nIHx8IGluaXRpYWxNZXNzYWdlICE9PSBudWxsLFxuICAgICAgcXVldWVkQ29tbWFuZHNMZW5ndGg6IHF1ZXVlZENvbW1hbmRzLmxlbmd0aCxcbiAgICAgIGhhc0FjdGl2ZUxvY2FsSnN4VUk6IGlzU2hvd2luZ0xvY2FsSlNYQ29tbWFuZCxcbiAgICAgIGlzSW5QbGFuTW9kZTogdG9vbFBlcm1pc3Npb25Db250ZXh0Lm1vZGUgPT09ICdwbGFuJyxcbiAgICAgIG9uU3VibWl0VGljazogKHByb21wdDogc3RyaW5nKSA9PlxuICAgICAgICBoYW5kbGVJbmNvbWluZ1Byb21wdChwcm9tcHQsIHsgaXNNZXRhOiB0cnVlIH0pLFxuICAgICAgb25RdWV1ZVRpY2s6IChwcm9tcHQ6IHN0cmluZykgPT5cbiAgICAgICAgZW5xdWV1ZSh7IG1vZGU6ICdwcm9tcHQnLCB2YWx1ZTogcHJvbXB0LCBpc01ldGE6IHRydWUgfSksXG4gICAgfSlcbiAgfVxuXG4gIC8vIEFib3J0IHRoZSBjdXJyZW50IG9wZXJhdGlvbiB3aGVuIGEgJ25vdycgcHJpb3JpdHkgbWVzc2FnZSBhcnJpdmVzXG4gIC8vIChlLmcuIGZyb20gYSBjaGF0IFVJIGNsaWVudCB2aWEgVURTKS5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAocXVldWVkQ29tbWFuZHMuc29tZShjbWQgPT4gY21kLnByaW9yaXR5ID09PSAnbm93JykpIHtcbiAgICAgIGFib3J0Q29udHJvbGxlclJlZi5jdXJyZW50Py5hYm9ydCgnaW50ZXJydXB0JylcbiAgICB9XG4gIH0sIFtxdWV1ZWRDb21tYW5kc10pXG5cbiAgLy8gSW5pdGlhbCBsb2FkXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgdm9pZCBvbkluaXQoKVxuXG4gICAgLy8gQ2xlYW51cCBvbiB1bm1vdW50XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHZvaWQgZGlhZ25vc3RpY1RyYWNrZXIuc2h1dGRvd24oKVxuICAgIH1cbiAgICAvLyBUT0RPOiBmaXggdGhpc1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHNcbiAgfSwgW10pXG5cbiAgLy8gTGlzdGVuIGZvciBzdXNwZW5kL3Jlc3VtZSBldmVudHNcbiAgY29uc3QgeyBpbnRlcm5hbF9ldmVudEVtaXR0ZXIgfSA9IHVzZVN0ZGluKClcbiAgY29uc3QgW3JlbW91bnRLZXksIHNldFJlbW91bnRLZXldID0gdXNlU3RhdGUoMClcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBoYW5kbGVTdXNwZW5kID0gKCkgPT4ge1xuICAgICAgLy8gUHJpbnQgc3VzcGVuc2lvbiBpbnN0cnVjdGlvbnNcbiAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKFxuICAgICAgICBgXFxuQ2xhdWRlIENvZGUgaGFzIGJlZW4gc3VzcGVuZGVkLiBSdW4gXFxgZmdcXGAgdG8gYnJpbmcgQ2xhdWRlIENvZGUgYmFjay5cXG5Ob3RlOiBjdHJsICsgeiBub3cgc3VzcGVuZHMgQ2xhdWRlIENvZGUsIGN0cmwgKyBfIHVuZG9lcyBpbnB1dC5cXG5gLFxuICAgICAgKVxuICAgIH1cblxuICAgIGNvbnN0IGhhbmRsZVJlc3VtZSA9ICgpID0+IHtcbiAgICAgIC8vIEZvcmNlIGNvbXBsZXRlIGNvbXBvbmVudCB0cmVlIHJlcGxhY2VtZW50IGluc3RlYWQgb2YgdGVybWluYWwgY2xlYXJcbiAgICAgIC8vIEluayBub3cgaGFuZGxlcyBsaW5lIGNvdW50IHJlc2V0IGludGVybmFsbHkgb24gU0lHQ09OVFxuICAgICAgc2V0UmVtb3VudEtleShwcmV2ID0+IHByZXYgKyAxKVxuICAgIH1cblxuICAgIGludGVybmFsX2V2ZW50RW1pdHRlcj8ub24oJ3N1c3BlbmQnLCBoYW5kbGVTdXNwZW5kKVxuICAgIGludGVybmFsX2V2ZW50RW1pdHRlcj8ub24oJ3Jlc3VtZScsIGhhbmRsZVJlc3VtZSlcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgaW50ZXJuYWxfZXZlbnRFbWl0dGVyPy5vZmYoJ3N1c3BlbmQnLCBoYW5kbGVTdXNwZW5kKVxuICAgICAgaW50ZXJuYWxfZXZlbnRFbWl0dGVyPy5vZmYoJ3Jlc3VtZScsIGhhbmRsZVJlc3VtZSlcbiAgICB9XG4gIH0sIFtpbnRlcm5hbF9ldmVudEVtaXR0ZXJdKVxuXG4gIC8vIERlcml2ZSBzdG9wIGhvb2sgc3Bpbm5lciBzdWZmaXggZnJvbSBtZXNzYWdlcyBzdGF0ZVxuICBjb25zdCBzdG9wSG9va1NwaW5uZXJTdWZmaXggPSB1c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoIWlzTG9hZGluZykgcmV0dXJuIG51bGxcblxuICAgIC8vIEZpbmQgc3RvcCBob29rIHByb2dyZXNzIG1lc3NhZ2VzXG4gICAgY29uc3QgcHJvZ3Jlc3NNc2dzID0gbWVzc2FnZXMuZmlsdGVyKFxuICAgICAgKG0pOiBtIGlzIFByb2dyZXNzTWVzc2FnZTxIb29rUHJvZ3Jlc3M+ID0+XG4gICAgICAgIG0udHlwZSA9PT0gJ3Byb2dyZXNzJyAmJlxuICAgICAgICBtLmRhdGEudHlwZSA9PT0gJ2hvb2tfcHJvZ3Jlc3MnICYmXG4gICAgICAgIChtLmRhdGEuaG9va0V2ZW50ID09PSAnU3RvcCcgfHwgbS5kYXRhLmhvb2tFdmVudCA9PT0gJ1N1YmFnZW50U3RvcCcpLFxuICAgIClcbiAgICBpZiAocHJvZ3Jlc3NNc2dzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGxcblxuICAgIC8vIEdldCB0aGUgbW9zdCByZWNlbnQgc3RvcCBob29rIGV4ZWN1dGlvblxuICAgIGNvbnN0IGN1cnJlbnRUb29sVXNlSUQgPSBwcm9ncmVzc01zZ3MuYXQoLTEpPy50b29sVXNlSURcbiAgICBpZiAoIWN1cnJlbnRUb29sVXNlSUQpIHJldHVybiBudWxsXG5cbiAgICAvLyBDaGVjayBpZiB0aGVyZSdzIGFscmVhZHkgYSBzdW1tYXJ5IG1lc3NhZ2UgZm9yIHRoaXMgZXhlY3V0aW9uIChob29rcyBjb21wbGV0ZWQpXG4gICAgY29uc3QgaGFzU3VtbWFyeUZvckN1cnJlbnRFeGVjdXRpb24gPSBtZXNzYWdlcy5zb21lKFxuICAgICAgbSA9PlxuICAgICAgICBtLnR5cGUgPT09ICdzeXN0ZW0nICYmXG4gICAgICAgIG0uc3VidHlwZSA9PT0gJ3N0b3BfaG9va19zdW1tYXJ5JyAmJlxuICAgICAgICBtLnRvb2xVc2VJRCA9PT0gY3VycmVudFRvb2xVc2VJRCxcbiAgICApXG4gICAgaWYgKGhhc1N1bW1hcnlGb3JDdXJyZW50RXhlY3V0aW9uKSByZXR1cm4gbnVsbFxuXG4gICAgY29uc3QgY3VycmVudEhvb2tzID0gcHJvZ3Jlc3NNc2dzLmZpbHRlcihcbiAgICAgIHAgPT4gcC50b29sVXNlSUQgPT09IGN1cnJlbnRUb29sVXNlSUQsXG4gICAgKVxuICAgIGNvbnN0IHRvdGFsID0gY3VycmVudEhvb2tzLmxlbmd0aFxuXG4gICAgLy8gQ291bnQgY29tcGxldGVkIGhvb2tzXG4gICAgY29uc3QgY29tcGxldGVkQ291bnQgPSBjb3VudChtZXNzYWdlcywgbSA9PiB7XG4gICAgICBpZiAobS50eXBlICE9PSAnYXR0YWNobWVudCcpIHJldHVybiBmYWxzZVxuICAgICAgY29uc3QgYXR0YWNobWVudCA9IG0uYXR0YWNobWVudFxuICAgICAgcmV0dXJuIChcbiAgICAgICAgJ2hvb2tFdmVudCcgaW4gYXR0YWNobWVudCAmJlxuICAgICAgICAoYXR0YWNobWVudC5ob29rRXZlbnQgPT09ICdTdG9wJyB8fFxuICAgICAgICAgIGF0dGFjaG1lbnQuaG9va0V2ZW50ID09PSAnU3ViYWdlbnRTdG9wJykgJiZcbiAgICAgICAgJ3Rvb2xVc2VJRCcgaW4gYXR0YWNobWVudCAmJlxuICAgICAgICBhdHRhY2htZW50LnRvb2xVc2VJRCA9PT0gY3VycmVudFRvb2xVc2VJRFxuICAgICAgKVxuICAgIH0pXG5cbiAgICAvLyBDaGVjayBpZiBhbnkgaG9vayBoYXMgYSBjdXN0b20gc3RhdHVzIG1lc3NhZ2VcbiAgICBjb25zdCBjdXN0b21NZXNzYWdlID0gY3VycmVudEhvb2tzLmZpbmQocCA9PiBwLmRhdGEuc3RhdHVzTWVzc2FnZSk/LmRhdGFcbiAgICAgIC5zdGF0dXNNZXNzYWdlXG5cbiAgICBpZiAoY3VzdG9tTWVzc2FnZSkge1xuICAgICAgLy8gVXNlIGN1c3RvbSBtZXNzYWdlIHdpdGggcHJvZ3Jlc3MgY291bnRlciBpZiBtdWx0aXBsZSBob29rc1xuICAgICAgcmV0dXJuIHRvdGFsID09PSAxXG4gICAgICAgID8gYCR7Y3VzdG9tTWVzc2FnZX3igKZgXG4gICAgICAgIDogYCR7Y3VzdG9tTWVzc2FnZX3igKYgJHtjb21wbGV0ZWRDb3VudH0vJHt0b3RhbH1gXG4gICAgfVxuXG4gICAgLy8gRmFsbCBiYWNrIHRvIGRlZmF1bHQgYmVoYXZpb3JcbiAgICBjb25zdCBob29rVHlwZSA9XG4gICAgICBjdXJyZW50SG9va3NbMF0/LmRhdGEuaG9va0V2ZW50ID09PSAnU3ViYWdlbnRTdG9wJ1xuICAgICAgICA/ICdzdWJhZ2VudCBzdG9wJ1xuICAgICAgICA6ICdzdG9wJ1xuXG4gICAgaWYgKFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcpIHtcbiAgICAgIGNvbnN0IGNtZCA9IGN1cnJlbnRIb29rc1tjb21wbGV0ZWRDb3VudF0/LmRhdGEuY29tbWFuZFxuICAgICAgY29uc3QgbGFiZWwgPSBjbWQgPyBgICcke3RydW5jYXRlVG9XaWR0aChjbWQsIDQwKX0nYCA6ICcnXG4gICAgICByZXR1cm4gdG90YWwgPT09IDFcbiAgICAgICAgPyBgcnVubmluZyAke2hvb2tUeXBlfSBob29rJHtsYWJlbH1gXG4gICAgICAgIDogYHJ1bm5pbmcgJHtob29rVHlwZX0gaG9vayR7bGFiZWx9XFx1MjAyNiAke2NvbXBsZXRlZENvdW50fS8ke3RvdGFsfWBcbiAgICB9XG5cbiAgICByZXR1cm4gdG90YWwgPT09IDFcbiAgICAgID8gYHJ1bm5pbmcgJHtob29rVHlwZX0gaG9va2BcbiAgICAgIDogYHJ1bm5pbmcgc3RvcCBob29rc+KApiAke2NvbXBsZXRlZENvdW50fS8ke3RvdGFsfWBcbiAgfSwgW21lc3NhZ2VzLCBpc0xvYWRpbmddKVxuXG4gIC8vIENhbGxiYWNrIHRvIGNhcHR1cmUgZnJvemVuIHN0YXRlIHdoZW4gZW50ZXJpbmcgdHJhbnNjcmlwdCBtb2RlXG4gIGNvbnN0IGhhbmRsZUVudGVyVHJhbnNjcmlwdCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRGcm96ZW5UcmFuc2NyaXB0U3RhdGUoe1xuICAgICAgbWVzc2FnZXNMZW5ndGg6IG1lc3NhZ2VzLmxlbmd0aCxcbiAgICAgIHN0cmVhbWluZ1Rvb2xVc2VzTGVuZ3RoOiBzdHJlYW1pbmdUb29sVXNlcy5sZW5ndGgsXG4gICAgfSlcbiAgfSwgW21lc3NhZ2VzLmxlbmd0aCwgc3RyZWFtaW5nVG9vbFVzZXMubGVuZ3RoXSlcblxuICAvLyBDYWxsYmFjayB0byBjbGVhciBmcm96ZW4gc3RhdGUgd2hlbiBleGl0aW5nIHRyYW5zY3JpcHQgbW9kZVxuICBjb25zdCBoYW5kbGVFeGl0VHJhbnNjcmlwdCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRGcm96ZW5UcmFuc2NyaXB0U3RhdGUobnVsbClcbiAgfSwgW10pXG5cbiAgLy8gUHJvcHMgZm9yIEdsb2JhbEtleWJpbmRpbmdIYW5kbGVycyBjb21wb25lbnQgKHJlbmRlcmVkIGluc2lkZSBLZXliaW5kaW5nU2V0dXApXG4gIGNvbnN0IHZpcnR1YWxTY3JvbGxBY3RpdmUgPSBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgJiYgIWRpc2FibGVWaXJ0dWFsU2Nyb2xsXG5cbiAgLy8gVHJhbnNjcmlwdCBzZWFyY2ggc3RhdGUuIEhvb2tzIG11c3QgYmUgdW5jb25kaXRpb25hbCBzbyB0aGV5IGxpdmUgaGVyZVxuICAvLyAobm90IGluc2lkZSB0aGUgYGlmIChzY3JlZW4gPT09ICd0cmFuc2NyaXB0JylgIGJyYW5jaCBiZWxvdyk7IGlzQWN0aXZlXG4gIC8vIGdhdGVzIHRoZSB1c2VJbnB1dC4gUXVlcnkgcGVyc2lzdHMgYWNyb3NzIGJhciBvcGVuL2Nsb3NlIHNvIG4vTiBrZWVwXG4gIC8vIHdvcmtpbmcgYWZ0ZXIgRW50ZXIgZGlzbWlzc2VzIHRoZSBiYXIgKGxlc3Mgc2VtYW50aWNzKS5cbiAgY29uc3QganVtcFJlZiA9IHVzZVJlZjxKdW1wSGFuZGxlIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW3NlYXJjaE9wZW4sIHNldFNlYXJjaE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtzZWFyY2hRdWVyeSwgc2V0U2VhcmNoUXVlcnldID0gdXNlU3RhdGUoJycpXG4gIGNvbnN0IFtzZWFyY2hDb3VudCwgc2V0U2VhcmNoQ291bnRdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgW3NlYXJjaEN1cnJlbnQsIHNldFNlYXJjaEN1cnJlbnRdID0gdXNlU3RhdGUoMClcbiAgY29uc3Qgb25TZWFyY2hNYXRjaGVzQ2hhbmdlID0gdXNlQ2FsbGJhY2soXG4gICAgKGNvdW50OiBudW1iZXIsIGN1cnJlbnQ6IG51bWJlcikgPT4ge1xuICAgICAgc2V0U2VhcmNoQ291bnQoY291bnQpXG4gICAgICBzZXRTZWFyY2hDdXJyZW50KGN1cnJlbnQpXG4gICAgfSxcbiAgICBbXSxcbiAgKVxuXG4gIHVzZUlucHV0KFxuICAgIChpbnB1dCwga2V5LCBldmVudCkgPT4ge1xuICAgICAgaWYgKGtleS5jdHJsIHx8IGtleS5tZXRhKSByZXR1cm5cbiAgICAgIC8vIE5vIEVzYyBoYW5kbGluZyBoZXJlIOKAlCBsZXNzIGhhcyBubyBuYXZpZ2F0aW5nIG1vZGUuIFNlYXJjaCBzdGF0ZVxuICAgICAgLy8gKGhpZ2hsaWdodHMsIG4vTikgaXMganVzdCBzdGF0ZS4gRXNjL3EvY3RybCtjIOKGkiB0cmFuc2NyaXB0OmV4aXRcbiAgICAgIC8vICh1bmdhdGVkKS4gSGlnaGxpZ2h0cyBjbGVhciBvbiBleGl0IHZpYSB0aGUgc2NyZWVuLWNoYW5nZSBlZmZlY3QuXG4gICAgICBpZiAoaW5wdXQgPT09ICcvJykge1xuICAgICAgICAvLyBDYXB0dXJlIHNjcm9sbFRvcCBOT1cg4oCUIHR5cGluZyBpcyBhIHByZXZpZXcsIDAtbWF0Y2hlcyBzbmFwc1xuICAgICAgICAvLyBiYWNrIGhlcmUuIFN5bmNocm9ub3VzIHJlZiB3cml0ZSwgZmlyZXMgYmVmb3JlIHRoZSBiYXInc1xuICAgICAgICAvLyBtb3VudC1lZmZlY3QgY2FsbHMgc2V0U2VhcmNoUXVlcnkuXG4gICAgICAgIGp1bXBSZWYuY3VycmVudD8uc2V0QW5jaG9yKClcbiAgICAgICAgc2V0U2VhcmNoT3Blbih0cnVlKVxuICAgICAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIC8vIEhlbGQta2V5IGJhdGNoaW5nOiB0b2tlbml6ZXIgY29hbGVzY2VzIHRvICdubm4nLiBTYW1lIHVuaWZvcm0tYmF0Y2hcbiAgICAgIC8vIHBhdHRlcm4gYXMgbW9kYWxQYWdlckFjdGlvbiBpbiBTY3JvbGxLZXliaW5kaW5nSGFuZGxlci50c3guIEVhY2hcbiAgICAgIC8vIHJlcGVhdCBpcyBhIHN0ZXAgKG4gaXNuJ3QgaWRlbXBvdGVudCBsaWtlIGcpLlxuICAgICAgY29uc3QgYyA9IGlucHV0WzBdXG4gICAgICBpZiAoXG4gICAgICAgIChjID09PSAnbicgfHwgYyA9PT0gJ04nKSAmJlxuICAgICAgICBpbnB1dCA9PT0gYy5yZXBlYXQoaW5wdXQubGVuZ3RoKSAmJlxuICAgICAgICBzZWFyY2hDb3VudCA+IDBcbiAgICAgICkge1xuICAgICAgICBjb25zdCBmbiA9XG4gICAgICAgICAgYyA9PT0gJ24nID8ganVtcFJlZi5jdXJyZW50Py5uZXh0TWF0Y2ggOiBqdW1wUmVmLmN1cnJlbnQ/LnByZXZNYXRjaFxuICAgICAgICBpZiAoZm4pIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIGZuKClcbiAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcbiAgICAgIH1cbiAgICB9LFxuICAgIC8vIFNlYXJjaCBuZWVkcyB2aXJ0dWFsIHNjcm9sbCAoanVtcFJlZiBkcml2ZXMgVmlydHVhbE1lc3NhZ2VMaXN0KS4gW1xuICAgIC8vIGtpbGxzIGl0LCBzbyAhZHVtcE1vZGUg4oCUIGFmdGVyIFsgdGhlcmUncyBub3RoaW5nIHRvIGp1bXAgaW4uXG4gICAge1xuICAgICAgaXNBY3RpdmU6XG4gICAgICAgIHNjcmVlbiA9PT0gJ3RyYW5zY3JpcHQnICYmXG4gICAgICAgIHZpcnR1YWxTY3JvbGxBY3RpdmUgJiZcbiAgICAgICAgIXNlYXJjaE9wZW4gJiZcbiAgICAgICAgIWR1bXBNb2RlLFxuICAgIH0sXG4gIClcbiAgY29uc3Qge1xuICAgIHNldFF1ZXJ5OiBzZXRIaWdobGlnaHQsXG4gICAgc2NhbkVsZW1lbnQsXG4gICAgc2V0UG9zaXRpb25zLFxuICB9ID0gdXNlU2VhcmNoSGlnaGxpZ2h0KClcblxuICAvLyBSZXNpemUg4oaSIGFib3J0IHNlYXJjaC4gUG9zaXRpb25zIGFyZSAobXNnLCBxdWVyeSwgV0lEVEgpLWtleWVkIOKAlFxuICAvLyBjYWNoZWQgcG9zaXRpb25zIGFyZSBzdGFsZSBhZnRlciBhIHdpZHRoIGNoYW5nZSAobmV3IGxheW91dCwgbmV3XG4gIC8vIHdyYXBwaW5nKS4gQ2xlYXJpbmcgc2VhcmNoUXVlcnkgdHJpZ2dlcnMgVk1MJ3Mgc2V0U2VhcmNoUXVlcnkoJycpXG4gIC8vIHdoaWNoIGNsZWFycyBwb3NpdGlvbnNDYWNoZSArIHNldFBvc2l0aW9ucyhudWxsKS4gQmFyIGNsb3Nlcy5cbiAgLy8gVXNlciBoaXRzIC8gYWdhaW4g4oaSIGZyZXNoIGV2ZXJ5dGhpbmcuXG4gIGNvbnN0IHRyYW5zY3JpcHRDb2xzID0gdXNlVGVybWluYWxTaXplKCkuY29sdW1uc1xuICBjb25zdCBwcmV2Q29sc1JlZiA9IFJlYWN0LnVzZVJlZih0cmFuc2NyaXB0Q29scylcbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAocHJldkNvbHNSZWYuY3VycmVudCAhPT0gdHJhbnNjcmlwdENvbHMpIHtcbiAgICAgIHByZXZDb2xzUmVmLmN1cnJlbnQgPSB0cmFuc2NyaXB0Q29sc1xuICAgICAgaWYgKHNlYXJjaFF1ZXJ5IHx8IHNlYXJjaE9wZW4pIHtcbiAgICAgICAgc2V0U2VhcmNoT3BlbihmYWxzZSlcbiAgICAgICAgc2V0U2VhcmNoUXVlcnkoJycpXG4gICAgICAgIHNldFNlYXJjaENvdW50KDApXG4gICAgICAgIHNldFNlYXJjaEN1cnJlbnQoMClcbiAgICAgICAganVtcFJlZi5jdXJyZW50Py5kaXNhcm1TZWFyY2goKVxuICAgICAgICBzZXRIaWdobGlnaHQoJycpXG4gICAgICB9XG4gICAgfVxuICB9LCBbdHJhbnNjcmlwdENvbHMsIHNlYXJjaFF1ZXJ5LCBzZWFyY2hPcGVuLCBzZXRIaWdobGlnaHRdKVxuXG4gIC8vIFRyYW5zY3JpcHQgZXNjYXBlIGhhdGNoZXMuIEJhcmUgbGV0dGVycyBpbiBtb2RhbCBjb250ZXh0IChubyBwcm9tcHRcbiAgLy8gY29tcGV0aW5nIGZvciBpbnB1dCkg4oCUIHNhbWUgY2xhc3MgYXMgZy9HL2ovayBpbiBTY3JvbGxLZXliaW5kaW5nSGFuZGxlci5cbiAgdXNlSW5wdXQoXG4gICAgKGlucHV0LCBrZXksIGV2ZW50KSA9PiB7XG4gICAgICBpZiAoa2V5LmN0cmwgfHwga2V5Lm1ldGEpIHJldHVyblxuICAgICAgaWYgKGlucHV0ID09PSAncScpIHtcbiAgICAgICAgLy8gbGVzczogcSBxdWl0cyB0aGUgcGFnZXIuIGN0cmwrbyB0b2dnbGVzOyBxIGlzIHRoZSBsaW5lYWdlIGV4aXQuXG4gICAgICAgIGhhbmRsZUV4aXRUcmFuc2NyaXB0KClcbiAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBpZiAoaW5wdXQgPT09ICdbJyAmJiAhZHVtcE1vZGUpIHtcbiAgICAgICAgLy8gRm9yY2UgZHVtcC10by1zY3JvbGxiYWNrLiBBbHNvIGV4cGFuZCArIHVuY2FwIOKAlCBubyBwb2ludCBkdW1waW5nXG4gICAgICAgIC8vIGEgc3Vic2V0LiBUZXJtaW5hbC90bXV4IGNtZC1GIGNhbiBub3cgZmluZCBhbnl0aGluZy4gR3VhcmQgaGVyZVxuICAgICAgICAvLyAobm90IGluIGlzQWN0aXZlKSBzbyB2IHN0aWxsIHdvcmtzIHBvc3QtWyDigJQgZHVtcC1tb2RlIGZvb3RlciBhdFxuICAgICAgICAvLyB+NDg5OCB3aXJlcyBlZGl0b3JTdGF0dXMsIGNvbmZpcm1pbmcgdiBpcyBtZWFudCB0byBzdGF5IGxpdmUuXG4gICAgICAgIHNldER1bXBNb2RlKHRydWUpXG4gICAgICAgIHNldFNob3dBbGxJblRyYW5zY3JpcHQodHJ1ZSlcbiAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcbiAgICAgIH0gZWxzZSBpZiAoaW5wdXQgPT09ICd2Jykge1xuICAgICAgICAvLyBsZXNzLXN0eWxlOiB2IG9wZW5zIHRoZSBmaWxlIGluICRWSVNVQUwvJEVESVRPUi4gUmVuZGVyIHRoZSBmdWxsXG4gICAgICAgIC8vIHRyYW5zY3JpcHQgKHNhbWUgcGF0aCAvZXhwb3J0IHVzZXMpLCB3cml0ZSB0byB0bXAsIGhhbmQgb2ZmLlxuICAgICAgICAvLyBvcGVuRmlsZUluRXh0ZXJuYWxFZGl0b3IgaGFuZGxlcyBhbHQtc2NyZWVuIHN1c3BlbmQvcmVzdW1lIGZvclxuICAgICAgICAvLyB0ZXJtaW5hbCBlZGl0b3JzOyBHVUkgZWRpdG9ycyBzcGF3biBkZXRhY2hlZC5cbiAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcbiAgICAgICAgLy8gRHJvcCBkb3VibGUtdGFwczogdGhlIHJlbmRlciBpcyBhc3luYyBhbmQgYSBzZWNvbmQgcHJlc3MgYmVmb3JlIGl0XG4gICAgICAgIC8vIGNvbXBsZXRlcyB3b3VsZCBydW4gYSBzZWNvbmQgcGFyYWxsZWwgcmVuZGVyIChkb3VibGUgbWVtb3J5LCB0d29cbiAgICAgICAgLy8gdGVtcGZpbGVzLCB0d28gZWRpdG9yIHNwYXducykuIGVkaXRvckdlblJlZiBvbmx5IGd1YXJkc1xuICAgICAgICAvLyB0cmFuc2NyaXB0LWV4aXQgc3RhbGVuZXNzLCBub3Qgc2FtZS1zZXNzaW9uIGNvbmN1cnJlbmN5LlxuICAgICAgICBpZiAoZWRpdG9yUmVuZGVyaW5nUmVmLmN1cnJlbnQpIHJldHVyblxuICAgICAgICBlZGl0b3JSZW5kZXJpbmdSZWYuY3VycmVudCA9IHRydWVcbiAgICAgICAgLy8gQ2FwdHVyZSBnZW5lcmF0aW9uICsgbWFrZSBhIHN0YWxlbmVzcy1hd2FyZSBzZXR0ZXIuIEVhY2ggd3JpdGVcbiAgICAgICAgLy8gY2hlY2tzIGdlbiAodHJhbnNjcmlwdCBleGl0IGJ1bXBzIGl0IOKGkiBsYXRlIHdyaXRlcyBmcm9tIHRoZVxuICAgICAgICAvLyBhc3luYyByZW5kZXIgZ28gc2lsZW50KS5cbiAgICAgICAgY29uc3QgZ2VuID0gZWRpdG9yR2VuUmVmLmN1cnJlbnRcbiAgICAgICAgY29uc3Qgc2V0U3RhdHVzID0gKHM6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgICAgIGlmIChnZW4gIT09IGVkaXRvckdlblJlZi5jdXJyZW50KSByZXR1cm5cbiAgICAgICAgICBjbGVhclRpbWVvdXQoZWRpdG9yVGltZXJSZWYuY3VycmVudClcbiAgICAgICAgICBzZXRFZGl0b3JTdGF0dXMocylcbiAgICAgICAgfVxuICAgICAgICBzZXRTdGF0dXMoYHJlbmRlcmluZyAke2RlZmVycmVkTWVzc2FnZXMubGVuZ3RofSBtZXNzYWdlc+KApmApXG4gICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2lkdGggPSB0ZXJtaW5hbCBtaW51cyB2aW0ncyBsaW5lLW51bWJlciBndXR0ZXIgKDQgZGlnaXRzICtcbiAgICAgICAgICAgIC8vIHNwYWNlICsgc2xhY2spLiBGbG9vciBhdCA4MC4gUGFzc1Rocm91Z2ggaGFzIG5vIC5jb2x1bW5zIHNvXG4gICAgICAgICAgICAvLyB3aXRob3V0IHRoaXMgSW5rIGRlZmF1bHRzIHRvIDgwLiBUcmFpbGluZy1zcGFjZSBzdHJpcDogcmlnaHQtXG4gICAgICAgICAgICAvLyBhbGlnbmVkIHRpbWVzdGFtcHMgc3RpbGwgbGVhdmUgYSBmbGV4Ym94IHNwYWNlciBydW4gYXQgRU9MLlxuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9wcmVmZXItdXNlLXRlcm1pbmFsLXNpemUgLS0gb25lLXNob3QgYXQga2V5cHJlc3MgdGltZSwgbm90IGEgcmVhY3RpdmUgcmVuZGVyIGRlcFxuICAgICAgICAgICAgY29uc3QgdyA9IE1hdGgubWF4KDgwLCAocHJvY2Vzcy5zdGRvdXQuY29sdW1ucyA/PyA4MCkgLSA2KVxuICAgICAgICAgICAgY29uc3QgcmF3ID0gYXdhaXQgcmVuZGVyTWVzc2FnZXNUb1BsYWluVGV4dChcbiAgICAgICAgICAgICAgZGVmZXJyZWRNZXNzYWdlcyxcbiAgICAgICAgICAgICAgdG9vbHMsXG4gICAgICAgICAgICAgIHcsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBjb25zdCB0ZXh0ID0gcmF3LnJlcGxhY2UoL1sgXFx0XSskL2dtLCAnJylcbiAgICAgICAgICAgIGNvbnN0IHBhdGggPSBqb2luKHRtcGRpcigpLCBgY2MtdHJhbnNjcmlwdC0ke0RhdGUubm93KCl9LnR4dGApXG4gICAgICAgICAgICBhd2FpdCB3cml0ZUZpbGUocGF0aCwgdGV4dClcbiAgICAgICAgICAgIGNvbnN0IG9wZW5lZCA9IG9wZW5GaWxlSW5FeHRlcm5hbEVkaXRvcihwYXRoKVxuICAgICAgICAgICAgc2V0U3RhdHVzKFxuICAgICAgICAgICAgICBvcGVuZWRcbiAgICAgICAgICAgICAgICA/IGBvcGVuaW5nICR7cGF0aH1gXG4gICAgICAgICAgICAgICAgOiBgd3JvdGUgJHtwYXRofSDCtyBubyAkVklTVUFMLyRFRElUT1Igc2V0YCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBzZXRTdGF0dXMoXG4gICAgICAgICAgICAgIGByZW5kZXIgZmFpbGVkOiAke2UgaW5zdGFuY2VvZiBFcnJvciA/IGUubWVzc2FnZSA6IFN0cmluZyhlKX1gLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgICBlZGl0b3JSZW5kZXJpbmdSZWYuY3VycmVudCA9IGZhbHNlXG4gICAgICAgICAgaWYgKGdlbiAhPT0gZWRpdG9yR2VuUmVmLmN1cnJlbnQpIHJldHVyblxuICAgICAgICAgIGVkaXRvclRpbWVyUmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KHMgPT4gcygnJyksIDQwMDAsIHNldEVkaXRvclN0YXR1cylcbiAgICAgICAgfSkoKVxuICAgICAgfVxuICAgIH0sXG4gICAgLy8gIXNlYXJjaE9wZW46IHR5cGluZyAndicgb3IgJ1snIGluIHRoZSBzZWFyY2ggYmFyIGlzIHNlYXJjaCBpbnB1dCwgbm90XG4gICAgLy8gYSBjb21tYW5kLiBObyAhZHVtcE1vZGUgaGVyZSDigJQgdiBzaG91bGQgd29yayBhZnRlciBbICh0aGUgWyBoYW5kbGVyXG4gICAgLy8gZ3VhcmRzIGl0c2VsZiBpbmxpbmUpLlxuICAgIHsgaXNBY3RpdmU6IHNjcmVlbiA9PT0gJ3RyYW5zY3JpcHQnICYmIHZpcnR1YWxTY3JvbGxBY3RpdmUgJiYgIXNlYXJjaE9wZW4gfSxcbiAgKVxuXG4gIC8vIEZyZXNoIGBsZXNzYCBwZXIgdHJhbnNjcmlwdCBlbnRyeS4gUHJldmVudHMgc3RhbGUgaGlnaGxpZ2h0cyBtYXRjaGluZ1xuICAvLyB1bnJlbGF0ZWQgbm9ybWFsLW1vZGUgdGV4dCAob3ZlcmxheSBpcyBhbHQtc2NyZWVuLWdsb2JhbCkgYW5kIGF2b2lkc1xuICAvLyBzdXJwcmlzZSBuL04gb24gcmUtZW50cnkuIFNhbWUgZXhpdCByZXNldHMgWyBkdW1wIG1vZGUg4oCUIGVhY2ggY3RybCtvXG4gIC8vIGVudHJ5IGlzIGEgZnJlc2ggaW5zdGFuY2UuXG4gIGNvbnN0IGluVHJhbnNjcmlwdCA9IHNjcmVlbiA9PT0gJ3RyYW5zY3JpcHQnICYmIHZpcnR1YWxTY3JvbGxBY3RpdmVcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWluVHJhbnNjcmlwdCkge1xuICAgICAgc2V0U2VhcmNoUXVlcnkoJycpXG4gICAgICBzZXRTZWFyY2hDb3VudCgwKVxuICAgICAgc2V0U2VhcmNoQ3VycmVudCgwKVxuICAgICAgc2V0U2VhcmNoT3BlbihmYWxzZSlcbiAgICAgIGVkaXRvckdlblJlZi5jdXJyZW50KytcbiAgICAgIGNsZWFyVGltZW91dChlZGl0b3JUaW1lclJlZi5jdXJyZW50KVxuICAgICAgc2V0RHVtcE1vZGUoZmFsc2UpXG4gICAgICBzZXRFZGl0b3JTdGF0dXMoJycpXG4gICAgfVxuICB9LCBbaW5UcmFuc2NyaXB0XSlcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBzZXRIaWdobGlnaHQoaW5UcmFuc2NyaXB0ID8gc2VhcmNoUXVlcnkgOiAnJylcbiAgICAvLyBDbGVhciB0aGUgcG9zaXRpb24tYmFzZWQgQ1VSUkVOVCAoeWVsbG93KSBvdmVybGF5IHRvby4gc2V0SGlnaGxpZ2h0XG4gICAgLy8gb25seSBjbGVhcnMgdGhlIHNjYW4tYmFzZWQgaW52ZXJzZS4gV2l0aG91dCB0aGlzLCB0aGUgeWVsbG93IGJveFxuICAgIC8vIHBlcnNpc3RzIGF0IGl0cyBsYXN0IHNjcmVlbiBjb29yZHMgYWZ0ZXIgY3RybC1jIGV4aXRzIHRyYW5zY3JpcHQuXG4gICAgaWYgKCFpblRyYW5zY3JpcHQpIHNldFBvc2l0aW9ucyhudWxsKVxuICB9LCBbaW5UcmFuc2NyaXB0LCBzZWFyY2hRdWVyeSwgc2V0SGlnaGxpZ2h0LCBzZXRQb3NpdGlvbnNdKVxuXG4gIGNvbnN0IGdsb2JhbEtleWJpbmRpbmdQcm9wcyA9IHtcbiAgICBzY3JlZW4sXG4gICAgc2V0U2NyZWVuLFxuICAgIHNob3dBbGxJblRyYW5zY3JpcHQsXG4gICAgc2V0U2hvd0FsbEluVHJhbnNjcmlwdCxcbiAgICBtZXNzYWdlQ291bnQ6IG1lc3NhZ2VzLmxlbmd0aCxcbiAgICBvbkVudGVyVHJhbnNjcmlwdDogaGFuZGxlRW50ZXJUcmFuc2NyaXB0LFxuICAgIG9uRXhpdFRyYW5zY3JpcHQ6IGhhbmRsZUV4aXRUcmFuc2NyaXB0LFxuICAgIHZpcnR1YWxTY3JvbGxBY3RpdmUsXG4gICAgLy8gQmFyLW9wZW4gaXMgYSBtb2RlIChvd25zIGtleXN0cm9rZXMg4oCUIGovayB0eXBlLCBFc2MgY2FuY2VscykuXG4gICAgLy8gTmF2aWdhdGluZyAocXVlcnkgc2V0LCBiYXIgY2xvc2VkKSBpcyBOT1Qg4oCUIEVzYyBleGl0cyB0cmFuc2NyaXB0LFxuICAgIC8vIHNhbWUgYXMgbGVzcyBxIHdpdGggaGlnaGxpZ2h0cyBzdGlsbCB2aXNpYmxlLiB1c2VTZWFyY2hJbnB1dFxuICAgIC8vIGRvZXNuJ3Qgc3RvcFByb3BhZ2F0aW9uLCBzbyB3aXRob3V0IHRoaXMgZ2F0ZSB0cmFuc2NyaXB0OmV4aXRcbiAgICAvLyB3b3VsZCBmaXJlIG9uIHRoZSBzYW1lIEVzYyB0aGF0IGNhbmNlbHMgdGhlIGJhciAoY2hpbGQgcmVnaXN0ZXJzXG4gICAgLy8gZmlyc3QsIGZpcmVzIGZpcnN0LCBidWJibGVzKS5cbiAgICBzZWFyY2hCYXJPcGVuOiBzZWFyY2hPcGVuLFxuICB9XG5cbiAgLy8gVXNlIGZyb3plbiBsZW5ndGhzIHRvIHNsaWNlIGFycmF5cywgYXZvaWRpbmcgbWVtb3J5IG92ZXJoZWFkIG9mIGNsb25pbmdcbiAgY29uc3QgdHJhbnNjcmlwdE1lc3NhZ2VzID0gZnJvemVuVHJhbnNjcmlwdFN0YXRlXG4gICAgPyBkZWZlcnJlZE1lc3NhZ2VzLnNsaWNlKDAsIGZyb3plblRyYW5zY3JpcHRTdGF0ZS5tZXNzYWdlc0xlbmd0aClcbiAgICA6IGRlZmVycmVkTWVzc2FnZXNcbiAgY29uc3QgdHJhbnNjcmlwdFN0cmVhbWluZ1Rvb2xVc2VzID0gZnJvemVuVHJhbnNjcmlwdFN0YXRlXG4gICAgPyBzdHJlYW1pbmdUb29sVXNlcy5zbGljZSgwLCBmcm96ZW5UcmFuc2NyaXB0U3RhdGUuc3RyZWFtaW5nVG9vbFVzZXNMZW5ndGgpXG4gICAgOiBzdHJlYW1pbmdUb29sVXNlc1xuXG4gIC8vIEhhbmRsZSBzaGlmdCtkb3duIGZvciB0ZWFtbWF0ZSBuYXZpZ2F0aW9uIGFuZCBiYWNrZ3JvdW5kIHRhc2sgbWFuYWdlbWVudC5cbiAgLy8gR3VhcmQgb25PcGVuQmFja2dyb3VuZFRhc2tzIHdoZW4gYSBsb2NhbC1qc3ggZGlhbG9nIChlLmcuIC9tY3ApIGlzIG9wZW4g4oCUXG4gIC8vIG90aGVyd2lzZSBTaGlmdCtEb3duIHN0YWNrcyBCYWNrZ3JvdW5kVGFza3NEaWFsb2cgb24gdG9wIGFuZCBkZWFkbG9ja3MgaW5wdXQuXG4gIHVzZUJhY2tncm91bmRUYXNrTmF2aWdhdGlvbih7XG4gICAgb25PcGVuQmFja2dyb3VuZFRhc2tzOiBpc1Nob3dpbmdMb2NhbEpTWENvbW1hbmRcbiAgICAgID8gdW5kZWZpbmVkXG4gICAgICA6ICgpID0+IHNldFNob3dCYXNoZXNEaWFsb2codHJ1ZSksXG4gIH0pXG4gIC8vIEF1dG8tZXhpdCB2aWV3aW5nIG1vZGUgd2hlbiB0ZWFtbWF0ZSBjb21wbGV0ZXMgb3IgZXJyb3JzXG4gIHVzZVRlYW1tYXRlVmlld0F1dG9FeGl0KClcblxuICBpZiAoc2NyZWVuID09PSAndHJhbnNjcmlwdCcpIHtcbiAgICAvLyBWaXJ0dWFsIHNjcm9sbCByZXBsYWNlcyB0aGUgMzAtbWVzc2FnZSBjYXA6IGV2ZXJ5dGhpbmcgaXMgc2Nyb2xsYWJsZVxuICAgIC8vIGFuZCBtZW1vcnkgaXMgYm91bmRlZCBieSB0aGUgdmlld3BvcnQuIFdpdGhvdXQgaXQsIHdyYXBwaW5nIHRyYW5zY3JpcHRcbiAgICAvLyBpbiBhIFNjcm9sbEJveCB3b3VsZCBtb3VudCBhbGwgbWVzc2FnZXMgKH4yNTAgTUIgb24gbG9uZyBzZXNzaW9ucyDigJRcbiAgICAvLyB0aGUgZXhhY3QgcHJvYmxlbSksIHNvIHRoZSBraWxsIHN3aXRjaCBhbmQgbm9uLWZ1bGxzY3JlZW4gcGF0aHMgbXVzdFxuICAgIC8vIGZhbGwgdGhyb3VnaCB0byB0aGUgbGVnYWN5IHJlbmRlcjogbm8gYWx0IHNjcmVlbiwgZHVtcCB0byB0ZXJtaW5hbFxuICAgIC8vIHNjcm9sbGJhY2ssIDMwLWNhcCArIEN0cmwrRS4gUmV1c2luZyBzY3JvbGxSZWYgaXMgc2FmZSDigJQgbm9ybWFsLW1vZGVcbiAgICAvLyBhbmQgdHJhbnNjcmlwdC1tb2RlIGFyZSBtdXR1YWxseSBleGNsdXNpdmUgKHRoaXMgZWFybHkgcmV0dXJuKSwgc29cbiAgICAvLyBvbmx5IG9uZSBTY3JvbGxCb3ggaXMgZXZlciBtb3VudGVkIGF0IGEgdGltZS5cbiAgICBjb25zdCB0cmFuc2NyaXB0U2Nyb2xsUmVmID1cbiAgICAgIGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSAmJiAhZGlzYWJsZVZpcnR1YWxTY3JvbGwgJiYgIWR1bXBNb2RlXG4gICAgICAgID8gc2Nyb2xsUmVmXG4gICAgICAgIDogdW5kZWZpbmVkXG4gICAgY29uc3QgdHJhbnNjcmlwdE1lc3NhZ2VzRWxlbWVudCA9IChcbiAgICAgIDxNZXNzYWdlc1xuICAgICAgICBtZXNzYWdlcz17dHJhbnNjcmlwdE1lc3NhZ2VzfVxuICAgICAgICB0b29scz17dG9vbHN9XG4gICAgICAgIGNvbW1hbmRzPXtjb21tYW5kc31cbiAgICAgICAgdmVyYm9zZT17dHJ1ZX1cbiAgICAgICAgdG9vbEpTWD17bnVsbH1cbiAgICAgICAgdG9vbFVzZUNvbmZpcm1RdWV1ZT17W119XG4gICAgICAgIGluUHJvZ3Jlc3NUb29sVXNlSURzPXtpblByb2dyZXNzVG9vbFVzZUlEc31cbiAgICAgICAgaXNNZXNzYWdlU2VsZWN0b3JWaXNpYmxlPXtmYWxzZX1cbiAgICAgICAgY29udmVyc2F0aW9uSWQ9e2NvbnZlcnNhdGlvbklkfVxuICAgICAgICBzY3JlZW49e3NjcmVlbn1cbiAgICAgICAgYWdlbnREZWZpbml0aW9ucz17YWdlbnREZWZpbml0aW9uc31cbiAgICAgICAgc3RyZWFtaW5nVG9vbFVzZXM9e3RyYW5zY3JpcHRTdHJlYW1pbmdUb29sVXNlc31cbiAgICAgICAgc2hvd0FsbEluVHJhbnNjcmlwdD17c2hvd0FsbEluVHJhbnNjcmlwdH1cbiAgICAgICAgb25PcGVuUmF0ZUxpbWl0T3B0aW9ucz17aGFuZGxlT3BlblJhdGVMaW1pdE9wdGlvbnN9XG4gICAgICAgIGlzTG9hZGluZz17aXNMb2FkaW5nfVxuICAgICAgICBoaWRlUGFzdFRoaW5raW5nPXt0cnVlfVxuICAgICAgICBzdHJlYW1pbmdUaGlua2luZz17c3RyZWFtaW5nVGhpbmtpbmd9XG4gICAgICAgIHNjcm9sbFJlZj17dHJhbnNjcmlwdFNjcm9sbFJlZn1cbiAgICAgICAganVtcFJlZj17anVtcFJlZn1cbiAgICAgICAgb25TZWFyY2hNYXRjaGVzQ2hhbmdlPXtvblNlYXJjaE1hdGNoZXNDaGFuZ2V9XG4gICAgICAgIHNjYW5FbGVtZW50PXtzY2FuRWxlbWVudH1cbiAgICAgICAgc2V0UG9zaXRpb25zPXtzZXRQb3NpdGlvbnN9XG4gICAgICAgIGRpc2FibGVSZW5kZXJDYXA9e2R1bXBNb2RlfVxuICAgICAgLz5cbiAgICApXG4gICAgY29uc3QgdHJhbnNjcmlwdFRvb2xKU1ggPSB0b29sSlNYICYmIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPVwiMTAwJVwiPlxuICAgICAgICB7dG9vbEpTWC5qc3h9XG4gICAgICA8L0JveD5cbiAgICApXG4gICAgY29uc3QgdHJhbnNjcmlwdFJldHVybiA9IChcbiAgICAgIDxLZXliaW5kaW5nU2V0dXA+XG4gICAgICAgIDxBbmltYXRlZFRlcm1pbmFsVGl0bGVcbiAgICAgICAgICBpc0FuaW1hdGluZz17dGl0bGVJc0FuaW1hdGluZ31cbiAgICAgICAgICB0aXRsZT17dGVybWluYWxUaXRsZX1cbiAgICAgICAgICBkaXNhYmxlZD17dGl0bGVEaXNhYmxlZH1cbiAgICAgICAgICBub1ByZWZpeD17c2hvd1N0YXR1c0luVGVybWluYWxUYWJ9XG4gICAgICAgIC8+XG4gICAgICAgIDxHbG9iYWxLZXliaW5kaW5nSGFuZGxlcnMgey4uLmdsb2JhbEtleWJpbmRpbmdQcm9wc30gLz5cbiAgICAgICAge2ZlYXR1cmUoJ1ZPSUNFX01PREUnKSA/IChcbiAgICAgICAgICA8Vm9pY2VLZXliaW5kaW5nSGFuZGxlclxuICAgICAgICAgICAgdm9pY2VIYW5kbGVLZXlFdmVudD17dm9pY2UuaGFuZGxlS2V5RXZlbnR9XG4gICAgICAgICAgICBzdHJpcFRyYWlsaW5nPXt2b2ljZS5zdHJpcFRyYWlsaW5nfVxuICAgICAgICAgICAgcmVzZXRBbmNob3I9e3ZvaWNlLnJlc2V0QW5jaG9yfVxuICAgICAgICAgICAgaXNBY3RpdmU9eyF0b29sSlNYPy5pc0xvY2FsSlNYQ29tbWFuZH1cbiAgICAgICAgICAvPlxuICAgICAgICApIDogbnVsbH1cbiAgICAgICAgPENvbW1hbmRLZXliaW5kaW5nSGFuZGxlcnNcbiAgICAgICAgICBvblN1Ym1pdD17b25TdWJtaXR9XG4gICAgICAgICAgaXNBY3RpdmU9eyF0b29sSlNYPy5pc0xvY2FsSlNYQ29tbWFuZH1cbiAgICAgICAgLz5cbiAgICAgICAge3RyYW5zY3JpcHRTY3JvbGxSZWYgPyAoXG4gICAgICAgICAgLy8gU2Nyb2xsS2V5YmluZGluZ0hhbmRsZXIgbXVzdCBtb3VudCBiZWZvcmUgQ2FuY2VsUmVxdWVzdEhhbmRsZXIgc29cbiAgICAgICAgICAvLyBjdHJsK2Mtd2l0aC1zZWxlY3Rpb24gY29waWVzIGluc3RlYWQgb2YgY2FuY2VsbGluZyB0aGUgYWN0aXZlIHRhc2suXG4gICAgICAgICAgLy8gSXRzIHJhdyB1c2VJbnB1dCBoYW5kbGVyIG9ubHkgc3RvcHMgcHJvcGFnYXRpb24gd2hlbiBhIHNlbGVjdGlvblxuICAgICAgICAgIC8vIGV4aXN0cyDigJQgd2l0aG91dCBvbmUsIGN0cmwrYyBmYWxscyB0aHJvdWdoIHRvIENhbmNlbFJlcXVlc3RIYW5kbGVyLlxuICAgICAgICAgIDxTY3JvbGxLZXliaW5kaW5nSGFuZGxlclxuICAgICAgICAgICAgc2Nyb2xsUmVmPXtzY3JvbGxSZWZ9XG4gICAgICAgICAgICAvLyBZaWVsZCB3aGVlbC9jdHJsK3UvZCB0byBVbHRyYXBsYW5DaG9pY2VEaWFsb2cncyBvd24gc2Nyb2xsXG4gICAgICAgICAgICAvLyBoYW5kbGVyIHdoaWxlIHRoZSBtb2RhbCBpcyBzaG93aW5nLlxuICAgICAgICAgICAgaXNBY3RpdmU9e2ZvY3VzZWRJbnB1dERpYWxvZyAhPT0gJ3VsdHJhcGxhbi1jaG9pY2UnfVxuICAgICAgICAgICAgLy8gZy9HL2ovay9jdHJsK3UvY3RybCtkIHdvdWxkIGVhdCBrZXlzdHJva2VzIHRoZSBzZWFyY2ggYmFyXG4gICAgICAgICAgICAvLyB3YW50cy4gT2ZmIHdoaWxlIHNlYXJjaGluZy5cbiAgICAgICAgICAgIGlzTW9kYWw9eyFzZWFyY2hPcGVufVxuICAgICAgICAgICAgLy8gTWFudWFsIHNjcm9sbCBleGl0cyB0aGUgc2VhcmNoIGNvbnRleHQg4oCUIGNsZWFyIHRoZSB5ZWxsb3dcbiAgICAgICAgICAgIC8vIGN1cnJlbnQtbWF0Y2ggbWFya2VyLiBQb3NpdGlvbnMgYXJlIChtc2csIHJvd09mZnNldCkta2V5ZWQ7XG4gICAgICAgICAgICAvLyBqL2sgY2hhbmdlcyBzY3JvbGxUb3Agc28gcm93T2Zmc2V0IGlzIHN0YWxlIOKGkiB3cm9uZyByb3dcbiAgICAgICAgICAgIC8vIGdldHMgeWVsbG93LiBOZXh0IG4vTiByZS1lc3RhYmxpc2hlcyB2aWEgc3RlcCgp4oaSanVtcCgpLlxuICAgICAgICAgICAgb25TY3JvbGw9eygpID0+IGp1bXBSZWYuY3VycmVudD8uZGlzYXJtU2VhcmNoKCl9XG4gICAgICAgICAgLz5cbiAgICAgICAgKSA6IG51bGx9XG4gICAgICAgIDxDYW5jZWxSZXF1ZXN0SGFuZGxlciB7Li4uY2FuY2VsUmVxdWVzdFByb3BzfSAvPlxuICAgICAgICB7dHJhbnNjcmlwdFNjcm9sbFJlZiA/IChcbiAgICAgICAgICA8RnVsbHNjcmVlbkxheW91dFxuICAgICAgICAgICAgc2Nyb2xsUmVmPXtzY3JvbGxSZWZ9XG4gICAgICAgICAgICBzY3JvbGxhYmxlPXtcbiAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICB7dHJhbnNjcmlwdE1lc3NhZ2VzRWxlbWVudH1cbiAgICAgICAgICAgICAgICB7dHJhbnNjcmlwdFRvb2xKU1h9XG4gICAgICAgICAgICAgICAgPFNhbmRib3hWaW9sYXRpb25FeHBhbmRlZFZpZXcgLz5cbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBib3R0b209e1xuICAgICAgICAgICAgICBzZWFyY2hPcGVuID8gKFxuICAgICAgICAgICAgICAgIDxUcmFuc2NyaXB0U2VhcmNoQmFyXG4gICAgICAgICAgICAgICAgICBqdW1wUmVmPXtqdW1wUmVmfVxuICAgICAgICAgICAgICAgICAgLy8gU2VlZCB3YXMgdHJpZWQgKGMwMTU3OGM4KSDigJQgYnJva2UgL2hlbGxvIG11c2NsZVxuICAgICAgICAgICAgICAgICAgLy8gbWVtb3J5IChjdXJzb3IgbGFuZHMgYWZ0ZXIgJ2ZvbycsIC9oZWxsbyDihpIgZm9vaGVsbG8pLlxuICAgICAgICAgICAgICAgICAgLy8gQ2FuY2VsLXJlc3RvcmUgaGFuZGxlcyB0aGUgJ2Rvbid0IGxvc2UgcHJpb3Igc2VhcmNoJ1xuICAgICAgICAgICAgICAgICAgLy8gY29uY2VybiBkaWZmZXJlbnRseSAob25DYW5jZWwgcmUtYXBwbGllcyBzZWFyY2hRdWVyeSkuXG4gICAgICAgICAgICAgICAgICBpbml0aWFsUXVlcnk9XCJcIlxuICAgICAgICAgICAgICAgICAgY291bnQ9e3NlYXJjaENvdW50fVxuICAgICAgICAgICAgICAgICAgY3VycmVudD17c2VhcmNoQ3VycmVudH1cbiAgICAgICAgICAgICAgICAgIG9uQ2xvc2U9e3EgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBFbnRlciDigJQgY29tbWl0LiAwLW1hdGNoIGd1YXJkOiBqdW5rIHF1ZXJ5IHNob3VsZG4ndFxuICAgICAgICAgICAgICAgICAgICAvLyBwZXJzaXN0IChiYWRnZSBoaWRkZW4sIG4vTiBkZWFkIGFueXdheSkuXG4gICAgICAgICAgICAgICAgICAgIHNldFNlYXJjaFF1ZXJ5KHNlYXJjaENvdW50ID4gMCA/IHEgOiAnJylcbiAgICAgICAgICAgICAgICAgICAgc2V0U2VhcmNoT3BlbihmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgLy8gb25DYW5jZWwgcGF0aDogYmFyIHVubW91bnRzIGJlZm9yZSBpdHMgdXNlRWZmZWN0KFtxdWVyeV0pXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbiBmaXJlIHdpdGggJycuIFdpdGhvdXQgdGhpcywgc2VhcmNoQ291bnQgc3RheXMgc3RhbGVcbiAgICAgICAgICAgICAgICAgICAgLy8gKG4gZ3VhcmQgYXQgOjQ5NTYgcGFzc2VzKSBhbmQgVk1MJ3MgbWF0Y2hlc1tdIHRvb1xuICAgICAgICAgICAgICAgICAgICAvLyAobmV4dE1hdGNoIHdhbGtzIHRoZSBvbGQgYXJyYXkpLiBQaGFudG9tIG5hdiwgbm9cbiAgICAgICAgICAgICAgICAgICAgLy8gaGlnaGxpZ2h0LiBvbkV4aXQgKEVudGVyLCBxIG5vbi1lbXB0eSkgc3RpbGwgY29tbWl0cy5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgc2V0U2VhcmNoQ291bnQoMClcbiAgICAgICAgICAgICAgICAgICAgICBzZXRTZWFyY2hDdXJyZW50KDApXG4gICAgICAgICAgICAgICAgICAgICAganVtcFJlZi5jdXJyZW50Py5zZXRTZWFyY2hRdWVyeSgnJylcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgIG9uQ2FuY2VsPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEVzYy9jdHJsK2MvY3RybCtnIOKAlCB1bmRvLiBCYXIncyBlZmZlY3QgbGFzdCBmaXJlZFxuICAgICAgICAgICAgICAgICAgICAvLyB3aXRoIHdoYXRldmVyIHdhcyB0eXBlZC4gc2VhcmNoUXVlcnkgKFJFUEwgc3RhdGUpXG4gICAgICAgICAgICAgICAgICAgIC8vIGlzIHVuY2hhbmdlZCBzaW5jZSAvIChvbkNsb3NlID0gY29tbWl0LCBkaWRuJ3QgcnVuKS5cbiAgICAgICAgICAgICAgICAgICAgLy8gVHdvIFZNTCBjYWxsczogJycgcmVzdG9yZXMgYW5jaG9yICgwLW1hdGNoIGVsc2UtXG4gICAgICAgICAgICAgICAgICAgIC8vIGJyYW5jaCksIHRoZW4gc2VhcmNoUXVlcnkgcmUtc2NhbnMgZnJvbSBhbmNob3Inc1xuICAgICAgICAgICAgICAgICAgICAvLyBuZWFyZXN0LiBCb3RoIHN5bmNocm9ub3VzIOKAlCBvbmUgUmVhY3QgYmF0Y2guXG4gICAgICAgICAgICAgICAgICAgIC8vIHNldEhpZ2hsaWdodCBleHBsaWNpdDogUkVQTCdzIHN5bmMtZWZmZWN0IGRlcCBpc1xuICAgICAgICAgICAgICAgICAgICAvLyBzZWFyY2hRdWVyeSAodW5jaGFuZ2VkKSwgd291bGRuJ3QgcmUtZmlyZS5cbiAgICAgICAgICAgICAgICAgICAgc2V0U2VhcmNoT3BlbihmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAganVtcFJlZi5jdXJyZW50Py5zZXRTZWFyY2hRdWVyeSgnJylcbiAgICAgICAgICAgICAgICAgICAganVtcFJlZi5jdXJyZW50Py5zZXRTZWFyY2hRdWVyeShzZWFyY2hRdWVyeSlcbiAgICAgICAgICAgICAgICAgICAgc2V0SGlnaGxpZ2h0KHNlYXJjaFF1ZXJ5KVxuICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgIHNldEhpZ2hsaWdodD17c2V0SGlnaGxpZ2h0fVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgPFRyYW5zY3JpcHRNb2RlRm9vdGVyXG4gICAgICAgICAgICAgICAgICBzaG93QWxsSW5UcmFuc2NyaXB0PXtzaG93QWxsSW5UcmFuc2NyaXB0fVxuICAgICAgICAgICAgICAgICAgdmlydHVhbFNjcm9sbD17dHJ1ZX1cbiAgICAgICAgICAgICAgICAgIHN0YXR1cz17ZWRpdG9yU3RhdHVzIHx8IHVuZGVmaW5lZH1cbiAgICAgICAgICAgICAgICAgIHNlYXJjaEJhZGdlPXtcbiAgICAgICAgICAgICAgICAgICAgc2VhcmNoUXVlcnkgJiYgc2VhcmNoQ291bnQgPiAwXG4gICAgICAgICAgICAgICAgICAgICAgPyB7IGN1cnJlbnQ6IHNlYXJjaEN1cnJlbnQsIGNvdW50OiBzZWFyY2hDb3VudCB9XG4gICAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgLz5cbiAgICAgICAgKSA6IChcbiAgICAgICAgICA8PlxuICAgICAgICAgICAge3RyYW5zY3JpcHRNZXNzYWdlc0VsZW1lbnR9XG4gICAgICAgICAgICB7dHJhbnNjcmlwdFRvb2xKU1h9XG4gICAgICAgICAgICA8U2FuZGJveFZpb2xhdGlvbkV4cGFuZGVkVmlldyAvPlxuICAgICAgICAgICAgPFRyYW5zY3JpcHRNb2RlRm9vdGVyXG4gICAgICAgICAgICAgIHNob3dBbGxJblRyYW5zY3JpcHQ9e3Nob3dBbGxJblRyYW5zY3JpcHR9XG4gICAgICAgICAgICAgIHZpcnR1YWxTY3JvbGw9e2ZhbHNlfVxuICAgICAgICAgICAgICBzdXBwcmVzc1Nob3dBbGw9e2R1bXBNb2RlfVxuICAgICAgICAgICAgICBzdGF0dXM9e2VkaXRvclN0YXR1cyB8fCB1bmRlZmluZWR9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvPlxuICAgICAgICApfVxuICAgICAgPC9LZXliaW5kaW5nU2V0dXA+XG4gICAgKVxuICAgIC8vIFRoZSB2aXJ0dWFsLXNjcm9sbCBicmFuY2ggKEZ1bGxzY3JlZW5MYXlvdXQgYWJvdmUpIG5lZWRzXG4gICAgLy8gPEFsdGVybmF0ZVNjcmVlbj4ncyA8Qm94IGhlaWdodD17cm93c30+IGNvbnN0cmFpbnQg4oCUIHdpdGhvdXQgaXQsXG4gICAgLy8gU2Nyb2xsQm94J3MgZmxleEdyb3cgaGFzIG5vIGNlaWxpbmcsIHZpZXdwb3J0ID0gY29udGVudCBoZWlnaHQsXG4gICAgLy8gc2Nyb2xsVG9wIHBpbnMgYXQgMCwgYW5kIEluaydzIHNjcmVlbiBidWZmZXIgc2l6ZXMgdG8gdGhlIGZ1bGxcbiAgICAvLyBzcGFjZXIgKDIwMMOXNWsrIHJvd3Mgb24gbG9uZyBzZXNzaW9ucykuIFNhbWUgcm9vdCB0eXBlICsgcHJvcHMgYXNcbiAgICAvLyBub3JtYWwgbW9kZSdzIHdyYXAgYmVsb3cgc28gUmVhY3QgcmVjb25jaWxlcyBhbmQgdGhlIGFsdCBidWZmZXJcbiAgICAvLyBzdGF5cyBlbnRlcmVkIGFjcm9zcyB0b2dnbGUuIFRoZSAzMC1jYXAgZHVtcCBicmFuY2ggc3RheXNcbiAgICAvLyB1bndyYXBwZWQg4oCUIGl0IHdhbnRzIG5hdGl2ZSB0ZXJtaW5hbCBzY3JvbGxiYWNrLlxuICAgIGlmICh0cmFuc2NyaXB0U2Nyb2xsUmVmKSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8QWx0ZXJuYXRlU2NyZWVuIG1vdXNlVHJhY2tpbmc9e2lzTW91c2VUcmFja2luZ0VuYWJsZWQoKX0+XG4gICAgICAgICAge3RyYW5zY3JpcHRSZXR1cm59XG4gICAgICAgIDwvQWx0ZXJuYXRlU2NyZWVuPlxuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gdHJhbnNjcmlwdFJldHVyblxuICB9XG5cbiAgLy8gR2V0IHZpZXdlZCBhZ2VudCB0YXNrIChpbmxpbmVkIGZyb20gc2VsZWN0b3JzIGZvciBleHBsaWNpdCBkYXRhIGZsb3cpLlxuICAvLyB2aWV3ZWRBZ2VudFRhc2s6IHRlYW1tYXRlIE9SIGxvY2FsX2FnZW50IOKAlCBkcml2ZXMgdGhlIGJvb2xlYW4gY2hlY2tzXG4gIC8vIGJlbG93LiB2aWV3ZWRUZWFtbWF0ZVRhc2s6IHRlYW1tYXRlLW9ubHkgbmFycm93ZWQsIGZvciB0ZWFtbWF0ZS1zcGVjaWZpY1xuICAvLyBmaWVsZCBhY2Nlc3MgKGluUHJvZ3Jlc3NUb29sVXNlSURzKS5cbiAgY29uc3Qgdmlld2VkVGFzayA9IHZpZXdpbmdBZ2VudFRhc2tJZCA/IHRhc2tzW3ZpZXdpbmdBZ2VudFRhc2tJZF0gOiB1bmRlZmluZWRcbiAgY29uc3Qgdmlld2VkVGVhbW1hdGVUYXNrID1cbiAgICB2aWV3ZWRUYXNrICYmIGlzSW5Qcm9jZXNzVGVhbW1hdGVUYXNrKHZpZXdlZFRhc2spID8gdmlld2VkVGFzayA6IHVuZGVmaW5lZFxuICBjb25zdCB2aWV3ZWRBZ2VudFRhc2sgPVxuICAgIHZpZXdlZFRlYW1tYXRlVGFzayA/P1xuICAgICh2aWV3ZWRUYXNrICYmIGlzTG9jYWxBZ2VudFRhc2sodmlld2VkVGFzaykgPyB2aWV3ZWRUYXNrIDogdW5kZWZpbmVkKVxuXG4gIC8vIEJ5cGFzcyB1c2VEZWZlcnJlZFZhbHVlIHdoZW4gc3RyZWFtaW5nIHRleHQgaXMgc2hvd2luZyBzbyBNZXNzYWdlcyByZW5kZXJzXG4gIC8vIHRoZSBmaW5hbCBtZXNzYWdlIGluIHRoZSBzYW1lIGZyYW1lIHN0cmVhbWluZyB0ZXh0IGNsZWFycy4gQWxzbyBieXBhc3Mgd2hlblxuICAvLyBub3QgbG9hZGluZyDigJQgZGVmZXJyZWRNZXNzYWdlcyBvbmx5IG1hdHRlcnMgZHVyaW5nIHN0cmVhbWluZyAoa2VlcHMgaW5wdXRcbiAgLy8gcmVzcG9uc2l2ZSk7IGFmdGVyIHRoZSB0dXJuIGVuZHMsIHNob3dpbmcgbWVzc2FnZXMgaW1tZWRpYXRlbHkgcHJldmVudHMgYVxuICAvLyBqaXR0ZXIgZ2FwIHdoZXJlIHRoZSBzcGlubmVyIGlzIGdvbmUgYnV0IHRoZSBhbnN3ZXIgaGFzbid0IGFwcGVhcmVkIHlldC5cbiAgLy8gT25seSByZWR1Y2VkTW90aW9uIHVzZXJzIGtlZXAgdGhlIGRlZmVycmVkIHBhdGggZHVyaW5nIGxvYWRpbmcuXG4gIGNvbnN0IHVzZXNTeW5jTWVzc2FnZXMgPSBzaG93U3RyZWFtaW5nVGV4dCB8fCAhaXNMb2FkaW5nXG4gIC8vIFdoZW4gdmlld2luZyBhbiBhZ2VudCwgbmV2ZXIgZmFsbCB0aHJvdWdoIHRvIGxlYWRlciDigJQgZW1wdHkgdW50aWxcbiAgLy8gYm9vdHN0cmFwL3N0cmVhbSBmaWxscy4gQ2xvc2VzIHRoZSBzZWUtbGVhZGVyLXR5cGUtYWdlbnQgZm9vdGd1bi5cbiAgY29uc3QgZGlzcGxheWVkTWVzc2FnZXMgPSB2aWV3ZWRBZ2VudFRhc2tcbiAgICA/ICh2aWV3ZWRBZ2VudFRhc2subWVzc2FnZXMgPz8gW10pXG4gICAgOiB1c2VzU3luY01lc3NhZ2VzXG4gICAgICA/IG1lc3NhZ2VzXG4gICAgICA6IGRlZmVycmVkTWVzc2FnZXNcbiAgLy8gU2hvdyB0aGUgcGxhY2Vob2xkZXIgdW50aWwgdGhlIHJlYWwgdXNlciBtZXNzYWdlIGFwcGVhcnMgaW5cbiAgLy8gZGlzcGxheWVkTWVzc2FnZXMuIHVzZXJJbnB1dE9uUHJvY2Vzc2luZyBzdGF5cyBzZXQgZm9yIHRoZSB3aG9sZSB0dXJuXG4gIC8vIChjbGVhcmVkIGluIHJlc2V0TG9hZGluZ1N0YXRlKTsgdGhpcyBsZW5ndGggY2hlY2sgaGlkZXMgaXQgb25jZVxuICAvLyBkaXNwbGF5ZWRNZXNzYWdlcyBncm93cyBwYXN0IHRoZSBiYXNlbGluZSBjYXB0dXJlZCBhdCBzdWJtaXQgdGltZS5cbiAgLy8gQ292ZXJzIGJvdGggZ2FwczogYmVmb3JlIHNldE1lc3NhZ2VzIGlzIGNhbGxlZCAocHJvY2Vzc1VzZXJJbnB1dCksIGFuZFxuICAvLyB3aGlsZSBkZWZlcnJlZE1lc3NhZ2VzIGxhZ3MgYmVoaW5kIG1lc3NhZ2VzLiBTdXBwcmVzc2VkIHdoZW4gdmlld2luZyBhblxuICAvLyBhZ2VudCDigJQgZGlzcGxheWVkTWVzc2FnZXMgaXMgYSBkaWZmZXJlbnQgYXJyYXkgdGhlcmUsIGFuZCBvbkFnZW50U3VibWl0XG4gIC8vIGRvZXNuJ3QgdXNlIHRoZSBwbGFjZWhvbGRlciBhbnl3YXkuXG4gIGNvbnN0IHBsYWNlaG9sZGVyVGV4dCA9XG4gICAgdXNlcklucHV0T25Qcm9jZXNzaW5nICYmXG4gICAgIXZpZXdlZEFnZW50VGFzayAmJlxuICAgIGRpc3BsYXllZE1lc3NhZ2VzLmxlbmd0aCA8PSB1c2VySW5wdXRCYXNlbGluZVJlZi5jdXJyZW50XG4gICAgICA/IHVzZXJJbnB1dE9uUHJvY2Vzc2luZ1xuICAgICAgOiB1bmRlZmluZWRcblxuICBjb25zdCB0b29sUGVybWlzc2lvbk92ZXJsYXkgPVxuICAgIGZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ3Rvb2wtcGVybWlzc2lvbicgPyAoXG4gICAgICA8UGVybWlzc2lvblJlcXVlc3RcbiAgICAgICAga2V5PXt0b29sVXNlQ29uZmlybVF1ZXVlWzBdPy50b29sVXNlSUR9XG4gICAgICAgIG9uRG9uZT17KCkgPT4gc2V0VG9vbFVzZUNvbmZpcm1RdWV1ZSgoW18sIC4uLnRhaWxdKSA9PiB0YWlsKX1cbiAgICAgICAgb25SZWplY3Q9e2hhbmRsZVF1ZXVlZENvbW1hbmRPbkNhbmNlbH1cbiAgICAgICAgdG9vbFVzZUNvbmZpcm09e3Rvb2xVc2VDb25maXJtUXVldWVbMF0hfVxuICAgICAgICB0b29sVXNlQ29udGV4dD17Z2V0VG9vbFVzZUNvbnRleHQoXG4gICAgICAgICAgbWVzc2FnZXMsXG4gICAgICAgICAgbWVzc2FnZXMsXG4gICAgICAgICAgYWJvcnRDb250cm9sbGVyID8/IGNyZWF0ZUFib3J0Q29udHJvbGxlcigpLFxuICAgICAgICAgIG1haW5Mb29wTW9kZWwsXG4gICAgICAgICl9XG4gICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgIHdvcmtlckJhZGdlPXt0b29sVXNlQ29uZmlybVF1ZXVlWzBdPy53b3JrZXJCYWRnZX1cbiAgICAgICAgc2V0U3RpY2t5Rm9vdGVyPXtcbiAgICAgICAgICBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgPyBzZXRQZXJtaXNzaW9uU3RpY2t5Rm9vdGVyIDogdW5kZWZpbmVkXG4gICAgICAgIH1cbiAgICAgIC8+XG4gICAgKSA6IG51bGxcblxuICAvLyBOYXJyb3cgdGVybWluYWxzOiBjb21wYW5pb24gY29sbGFwc2VzIHRvIGEgb25lLWxpbmVyIHRoYXQgUkVQTCBzdGFja3NcbiAgLy8gb24gaXRzIG93biByb3cgKGFib3ZlIGlucHV0IGluIGZ1bGxzY3JlZW4sIGJlbG93IGluIHNjcm9sbGJhY2spIGluc3RlYWRcbiAgLy8gb2Ygcm93LWJlc2lkZS4gV2lkZSB0ZXJtaW5hbHMga2VlcCB0aGUgcm93IGxheW91dCB3aXRoIHNwcml0ZSBvbiB0aGUgcmlnaHQuXG4gIGNvbnN0IGNvbXBhbmlvbk5hcnJvdyA9IHRyYW5zY3JpcHRDb2xzIDwgTUlOX0NPTFNfRk9SX0ZVTExfU1BSSVRFXG4gIC8vIEhpZGUgdGhlIHNwcml0ZSB3aGVuIFByb21wdElucHV0IGVhcmx5LXJldHVybnMgQmFja2dyb3VuZFRhc2tzRGlhbG9nLlxuICAvLyBUaGUgc3ByaXRlIHNpdHMgYXMgYSByb3cgc2libGluZyBvZiBQcm9tcHRJbnB1dCwgc28gdGhlIGRpYWxvZydzIFBhbmVcbiAgLy8gZGl2aWRlciBkcmF3cyBhdCB1c2VUZXJtaW5hbFNpemUoKSB3aWR0aCBidXQgb25seSBnZXRzIHRlcm1pbmFsV2lkdGggLVxuICAvLyBzcHJpdGVXaWR0aCDigJQgZGl2aWRlciBzdG9wcyBzaG9ydCBhbmQgZGlhbG9nIHRleHQgd3JhcHMgZWFybHkuIERvbid0XG4gIC8vIGNoZWNrIGZvb3RlclNlbGVjdGlvbjogcGlsbCBGT0NVUyAoYXJyb3ctZG93biB0byB0YXNrcyBwaWxsKSBtdXN0IGtlZXBcbiAgLy8gdGhlIHNwcml0ZSB2aXNpYmxlIHNvIGFycm93LXJpZ2h0IGNhbiBuYXZpZ2F0ZSB0byBpdC5cbiAgY29uc3QgY29tcGFuaW9uVmlzaWJsZSA9XG4gICAgIXRvb2xKU1g/LnNob3VsZEhpZGVQcm9tcHRJbnB1dCAmJiAhZm9jdXNlZElucHV0RGlhbG9nICYmICFzaG93QmFzaGVzRGlhbG9nXG5cbiAgLy8gSW4gZnVsbHNjcmVlbiwgQUxMIGxvY2FsLWpzeCBzbGFzaCBjb21tYW5kcyBmbG9hdCBpbiB0aGUgbW9kYWwgc2xvdCDigJRcbiAgLy8gRnVsbHNjcmVlbkxheW91dCB3cmFwcyB0aGVtIGluIGFuIGFic29sdXRlLXBvc2l0aW9uZWQgYm90dG9tLWFuY2hvcmVkXG4gIC8vIHBhbmUgKOKWlCBkaXZpZGVyLCBNb2RhbENvbnRleHQpLiBQYW5lL0RpYWxvZyBpbnNpZGUgZGV0ZWN0IHRoZSBjb250ZXh0XG4gIC8vIGFuZCBza2lwIHRoZWlyIG93biB0b3AtbGV2ZWwgZnJhbWUuIE5vbi1mdWxsc2NyZWVuIGtlZXBzIHRoZSBpbmxpbmVcbiAgLy8gcmVuZGVyIHBhdGhzIGJlbG93LiBDb21tYW5kcyB0aGF0IHVzZWQgdG8gcm91dGUgdGhyb3VnaCBib3R0b21cbiAgLy8gKGltbWVkaWF0ZTogL21vZGVsLCAvbWNwLCAvYnR3LCAuLi4pIGFuZCBzY3JvbGxhYmxlIChub24taW1tZWRpYXRlOlxuICAvLyAvY29uZmlnLCAvdGhlbWUsIC9kaWZmLCAuLi4pIGJvdGggZ28gaGVyZSBub3cuXG4gIGNvbnN0IHRvb2xKc3hDZW50ZXJlZCA9XG4gICAgaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpICYmIHRvb2xKU1g/LmlzTG9jYWxKU1hDb21tYW5kID09PSB0cnVlXG4gIGNvbnN0IGNlbnRlcmVkTW9kYWw6IFJlYWN0LlJlYWN0Tm9kZSA9IHRvb2xKc3hDZW50ZXJlZCA/IHRvb2xKU1ghLmpzeCA6IG51bGxcblxuICAvLyA8QWx0ZXJuYXRlU2NyZWVuPiBhdCB0aGUgcm9vdDogZXZlcnl0aGluZyBiZWxvdyBpcyBpbnNpZGUgaXRzXG4gIC8vIDxCb3ggaGVpZ2h0PXtyb3dzfT4uIEhhbmRsZXJzL2NvbnRleHRzIGFyZSB6ZXJvLWhlaWdodCBzbyBTY3JvbGxCb3gnc1xuICAvLyBmbGV4R3JvdyBpbiBGdWxsc2NyZWVuTGF5b3V0IHJlc29sdmVzIGFnYWluc3QgdGhpcyBCb3guIFRoZSB0cmFuc2NyaXB0XG4gIC8vIGVhcmx5IHJldHVybiBhYm92ZSB3cmFwcyBpdHMgdmlydHVhbC1zY3JvbGwgYnJhbmNoIHRoZSBzYW1lIHdheTsgb25seVxuICAvLyB0aGUgMzAtY2FwIGR1bXAgYnJhbmNoIHN0YXlzIHVud3JhcHBlZCBmb3IgbmF0aXZlIHRlcm1pbmFsIHNjcm9sbGJhY2suXG4gIGNvbnN0IG1haW5SZXR1cm4gPSAoXG4gICAgPEtleWJpbmRpbmdTZXR1cD5cbiAgICAgIDxBbmltYXRlZFRlcm1pbmFsVGl0bGVcbiAgICAgICAgaXNBbmltYXRpbmc9e3RpdGxlSXNBbmltYXRpbmd9XG4gICAgICAgIHRpdGxlPXt0ZXJtaW5hbFRpdGxlfVxuICAgICAgICBkaXNhYmxlZD17dGl0bGVEaXNhYmxlZH1cbiAgICAgICAgbm9QcmVmaXg9e3Nob3dTdGF0dXNJblRlcm1pbmFsVGFifVxuICAgICAgLz5cbiAgICAgIDxHbG9iYWxLZXliaW5kaW5nSGFuZGxlcnMgey4uLmdsb2JhbEtleWJpbmRpbmdQcm9wc30gLz5cbiAgICAgIHtmZWF0dXJlKCdWT0lDRV9NT0RFJykgPyAoXG4gICAgICAgIDxWb2ljZUtleWJpbmRpbmdIYW5kbGVyXG4gICAgICAgICAgdm9pY2VIYW5kbGVLZXlFdmVudD17dm9pY2UuaGFuZGxlS2V5RXZlbnR9XG4gICAgICAgICAgc3RyaXBUcmFpbGluZz17dm9pY2Uuc3RyaXBUcmFpbGluZ31cbiAgICAgICAgICByZXNldEFuY2hvcj17dm9pY2UucmVzZXRBbmNob3J9XG4gICAgICAgICAgaXNBY3RpdmU9eyF0b29sSlNYPy5pc0xvY2FsSlNYQ29tbWFuZH1cbiAgICAgICAgLz5cbiAgICAgICkgOiBudWxsfVxuICAgICAgPENvbW1hbmRLZXliaW5kaW5nSGFuZGxlcnNcbiAgICAgICAgb25TdWJtaXQ9e29uU3VibWl0fVxuICAgICAgICBpc0FjdGl2ZT17IXRvb2xKU1g/LmlzTG9jYWxKU1hDb21tYW5kfVxuICAgICAgLz5cbiAgICAgIHsvKiBTY3JvbGxLZXliaW5kaW5nSGFuZGxlciBtdXN0IG1vdW50IGJlZm9yZSBDYW5jZWxSZXF1ZXN0SGFuZGxlciBzb1xuICAgICAgICAgIGN0cmwrYy13aXRoLXNlbGVjdGlvbiBjb3BpZXMgaW5zdGVhZCBvZiBjYW5jZWxsaW5nIHRoZSBhY3RpdmUgdGFzay5cbiAgICAgICAgICBJdHMgcmF3IHVzZUlucHV0IGhhbmRsZXIgb25seSBzdG9wcyBwcm9wYWdhdGlvbiB3aGVuIGEgc2VsZWN0aW9uXG4gICAgICAgICAgZXhpc3RzIOKAlCB3aXRob3V0IG9uZSwgY3RybCtjIGZhbGxzIHRocm91Z2ggdG8gQ2FuY2VsUmVxdWVzdEhhbmRsZXIuXG4gICAgICAgICAgUGdVcC9QZ0RuL3doZWVsIGFsd2F5cyBzY3JvbGwgdGhlIHRyYW5zY3JpcHQgYmVoaW5kIHRoZSBtb2RhbCDigJRcbiAgICAgICAgICB0aGUgbW9kYWwncyBpbm5lciBTY3JvbGxCb3ggaXMgbm90IGtleWJvYXJkLWRyaXZlbi4gb25TY3JvbGxcbiAgICAgICAgICBzdGF5cyBzdXBwcmVzc2VkIHdoaWxlIGEgbW9kYWwgaXMgc2hvd2luZyBzbyBzY3JvbGwgZG9lc24ndFxuICAgICAgICAgIHN0YW1wIGRpdmlkZXIvcGlsbCBzdGF0ZS4gKi99XG4gICAgICA8U2Nyb2xsS2V5YmluZGluZ0hhbmRsZXJcbiAgICAgICAgc2Nyb2xsUmVmPXtzY3JvbGxSZWZ9XG4gICAgICAgIGlzQWN0aXZlPXtcbiAgICAgICAgICBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgJiZcbiAgICAgICAgICAoY2VudGVyZWRNb2RhbCAhPSBudWxsIHx8XG4gICAgICAgICAgICAhZm9jdXNlZElucHV0RGlhbG9nIHx8XG4gICAgICAgICAgICBmb2N1c2VkSW5wdXREaWFsb2cgPT09ICd0b29sLXBlcm1pc3Npb24nKVxuICAgICAgICB9XG4gICAgICAgIG9uU2Nyb2xsPXtcbiAgICAgICAgICBjZW50ZXJlZE1vZGFsIHx8IHRvb2xQZXJtaXNzaW9uT3ZlcmxheSB8fCB2aWV3ZWRBZ2VudFRhc2tcbiAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICA6IGNvbXBvc2VkT25TY3JvbGxcbiAgICAgICAgfVxuICAgICAgLz5cbiAgICAgIHtmZWF0dXJlKCdNRVNTQUdFX0FDVElPTlMnKSAmJlxuICAgICAgaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpICYmXG4gICAgICAhZGlzYWJsZU1lc3NhZ2VBY3Rpb25zID8gKFxuICAgICAgICA8TWVzc2FnZUFjdGlvbnNLZXliaW5kaW5nc1xuICAgICAgICAgIGhhbmRsZXJzPXttZXNzYWdlQWN0aW9uSGFuZGxlcnN9XG4gICAgICAgICAgaXNBY3RpdmU9e2N1cnNvciAhPT0gbnVsbH1cbiAgICAgICAgLz5cbiAgICAgICkgOiBudWxsfVxuICAgICAgPENhbmNlbFJlcXVlc3RIYW5kbGVyIHsuLi5jYW5jZWxSZXF1ZXN0UHJvcHN9IC8+XG4gICAgICA8TUNQQ29ubmVjdGlvbk1hbmFnZXJcbiAgICAgICAga2V5PXtyZW1vdW50S2V5fVxuICAgICAgICBkeW5hbWljTWNwQ29uZmlnPXtkeW5hbWljTWNwQ29uZmlnfVxuICAgICAgICBpc1N0cmljdE1jcENvbmZpZz17c3RyaWN0TWNwQ29uZmlnfVxuICAgICAgPlxuICAgICAgICA8RnVsbHNjcmVlbkxheW91dFxuICAgICAgICAgIHNjcm9sbFJlZj17c2Nyb2xsUmVmfVxuICAgICAgICAgIG92ZXJsYXk9e3Rvb2xQZXJtaXNzaW9uT3ZlcmxheX1cbiAgICAgICAgICBib3R0b21GbG9hdD17XG4gICAgICAgICAgICBmZWF0dXJlKCdCVUREWScpICYmIGNvbXBhbmlvblZpc2libGUgJiYgIWNvbXBhbmlvbk5hcnJvdyA/IChcbiAgICAgICAgICAgICAgPENvbXBhbmlvbkZsb2F0aW5nQnViYmxlIC8+XG4gICAgICAgICAgICApIDogdW5kZWZpbmVkXG4gICAgICAgICAgfVxuICAgICAgICAgIG1vZGFsPXtjZW50ZXJlZE1vZGFsfVxuICAgICAgICAgIG1vZGFsU2Nyb2xsUmVmPXttb2RhbFNjcm9sbFJlZn1cbiAgICAgICAgICBkaXZpZGVyWVJlZj17ZGl2aWRlcllSZWZ9XG4gICAgICAgICAgaGlkZVBpbGw9eyEhdmlld2VkQWdlbnRUYXNrfVxuICAgICAgICAgIGhpZGVTdGlja3k9eyEhdmlld2VkVGVhbW1hdGVUYXNrfVxuICAgICAgICAgIG5ld01lc3NhZ2VDb3VudD17dW5zZWVuRGl2aWRlcj8uY291bnQgPz8gMH1cbiAgICAgICAgICBvblBpbGxDbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgc2V0Q3Vyc29yKG51bGwpXG4gICAgICAgICAgICBqdW1wVG9OZXcoc2Nyb2xsUmVmLmN1cnJlbnQpXG4gICAgICAgICAgfX1cbiAgICAgICAgICBzY3JvbGxhYmxlPXtcbiAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgIDxUZWFtbWF0ZVZpZXdIZWFkZXIgLz5cbiAgICAgICAgICAgICAgPE1lc3NhZ2VzXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM9e2Rpc3BsYXllZE1lc3NhZ2VzfVxuICAgICAgICAgICAgICAgIHRvb2xzPXt0b29sc31cbiAgICAgICAgICAgICAgICBjb21tYW5kcz17Y29tbWFuZHN9XG4gICAgICAgICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICAgICAgICB0b29sSlNYPXt0b29sSlNYfVxuICAgICAgICAgICAgICAgIHRvb2xVc2VDb25maXJtUXVldWU9e3Rvb2xVc2VDb25maXJtUXVldWV9XG4gICAgICAgICAgICAgICAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM9e1xuICAgICAgICAgICAgICAgICAgdmlld2VkVGVhbW1hdGVUYXNrXG4gICAgICAgICAgICAgICAgICAgID8gKHZpZXdlZFRlYW1tYXRlVGFzay5pblByb2dyZXNzVG9vbFVzZUlEcyA/PyBuZXcgU2V0KCkpXG4gICAgICAgICAgICAgICAgICAgIDogaW5Qcm9ncmVzc1Rvb2xVc2VJRHNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaXNNZXNzYWdlU2VsZWN0b3JWaXNpYmxlPXtpc01lc3NhZ2VTZWxlY3RvclZpc2libGV9XG4gICAgICAgICAgICAgICAgY29udmVyc2F0aW9uSWQ9e2NvbnZlcnNhdGlvbklkfVxuICAgICAgICAgICAgICAgIHNjcmVlbj17c2NyZWVufVxuICAgICAgICAgICAgICAgIHN0cmVhbWluZ1Rvb2xVc2VzPXtzdHJlYW1pbmdUb29sVXNlc31cbiAgICAgICAgICAgICAgICBzaG93QWxsSW5UcmFuc2NyaXB0PXtzaG93QWxsSW5UcmFuc2NyaXB0fVxuICAgICAgICAgICAgICAgIGFnZW50RGVmaW5pdGlvbnM9e2FnZW50RGVmaW5pdGlvbnN9XG4gICAgICAgICAgICAgICAgb25PcGVuUmF0ZUxpbWl0T3B0aW9ucz17aGFuZGxlT3BlblJhdGVMaW1pdE9wdGlvbnN9XG4gICAgICAgICAgICAgICAgaXNMb2FkaW5nPXtpc0xvYWRpbmd9XG4gICAgICAgICAgICAgICAgc3RyZWFtaW5nVGV4dD17XG4gICAgICAgICAgICAgICAgICBpc0xvYWRpbmcgJiYgIXZpZXdlZEFnZW50VGFzayA/IHZpc2libGVTdHJlYW1pbmdUZXh0IDogbnVsbFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpc0JyaWVmT25seT17dmlld2VkQWdlbnRUYXNrID8gZmFsc2UgOiBpc0JyaWVmT25seX1cbiAgICAgICAgICAgICAgICB1bnNlZW5EaXZpZGVyPXt2aWV3ZWRBZ2VudFRhc2sgPyB1bmRlZmluZWQgOiB1bnNlZW5EaXZpZGVyfVxuICAgICAgICAgICAgICAgIHNjcm9sbFJlZj17aXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpID8gc2Nyb2xsUmVmIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICAgIHRyYWNrU3RpY2t5UHJvbXB0PXtpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgPyB0cnVlIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICAgIGN1cnNvcj17Y3Vyc29yfVxuICAgICAgICAgICAgICAgIHNldEN1cnNvcj17c2V0Q3Vyc29yfVxuICAgICAgICAgICAgICAgIGN1cnNvck5hdlJlZj17Y3Vyc29yTmF2UmVmfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8QXdzQXV0aFN0YXR1c0JveCAvPlxuICAgICAgICAgICAgICB7LyogSGlkZSB0aGUgcHJvY2Vzc2luZyBwbGFjZWhvbGRlciB3aGlsZSBhIG1vZGFsIGlzIHNob3dpbmcg4oCUXG4gICAgICAgICAgICAgICAgICBpdCB3b3VsZCBzaXQgYXQgdGhlIGxhc3QgdmlzaWJsZSB0cmFuc2NyaXB0IHJvdyByaWdodCBhYm92ZVxuICAgICAgICAgICAgICAgICAgdGhlIOKWlCBkaXZpZGVyLCBzaG93aW5nIFwi4p2vIC9jb25maWdcIiBhcyByZWR1bmRhbnQgY2x1dHRlclxuICAgICAgICAgICAgICAgICAgKHRoZSBtb2RhbCBJUyB0aGUgL2NvbmZpZyBVSSkuIE91dHNpZGUgbW9kYWxzIGl0IHN0YXlzIHNvXG4gICAgICAgICAgICAgICAgICB0aGUgdXNlciBzZWVzIHRoZWlyIGlucHV0IGVjaG9lZCB3aGlsZSBDbGF1ZGUgcHJvY2Vzc2VzLiAqL31cbiAgICAgICAgICAgICAgeyFkaXNhYmxlZCAmJiBwbGFjZWhvbGRlclRleHQgJiYgIWNlbnRlcmVkTW9kYWwgJiYgKFxuICAgICAgICAgICAgICAgIDxVc2VyVGV4dE1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgIHBhcmFtPXt7IHRleHQ6IHBsYWNlaG9sZGVyVGV4dCwgdHlwZTogJ3RleHQnIH19XG4gICAgICAgICAgICAgICAgICBhZGRNYXJnaW49e3RydWV9XG4gICAgICAgICAgICAgICAgICB2ZXJib3NlPXt2ZXJib3NlfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIHt0b29sSlNYICYmXG4gICAgICAgICAgICAgICAgISh0b29sSlNYLmlzTG9jYWxKU1hDb21tYW5kICYmIHRvb2xKU1guaXNJbW1lZGlhdGUpICYmXG4gICAgICAgICAgICAgICAgIXRvb2xKc3hDZW50ZXJlZCAmJiAoXG4gICAgICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD1cIjEwMCVcIj5cbiAgICAgICAgICAgICAgICAgICAge3Rvb2xKU1guanN4fVxuICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAge1wiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgPFR1bmdzdGVuTGl2ZU1vbml0b3IgLz59XG4gICAgICAgICAgICAgIHtmZWF0dXJlKCdXRUJfQlJPV1NFUl9UT09MJylcbiAgICAgICAgICAgICAgICA/IFdlYkJyb3dzZXJQYW5lbE1vZHVsZSAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxXZWJCcm93c2VyUGFuZWxNb2R1bGUuV2ViQnJvd3NlclBhbmVsIC8+XG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgOiBudWxsfVxuICAgICAgICAgICAgICA8Qm94IGZsZXhHcm93PXsxfSAvPlxuICAgICAgICAgICAgICB7c2hvd1NwaW5uZXIgJiYgKFxuICAgICAgICAgICAgICAgIDxTcGlubmVyV2l0aFZlcmJcbiAgICAgICAgICAgICAgICAgIG1vZGU9e3N0cmVhbU1vZGV9XG4gICAgICAgICAgICAgICAgICBzcGlubmVyVGlwPXtzcGlubmVyVGlwfVxuICAgICAgICAgICAgICAgICAgcmVzcG9uc2VMZW5ndGhSZWY9e3Jlc3BvbnNlTGVuZ3RoUmVmfVxuICAgICAgICAgICAgICAgICAgYXBpTWV0cmljc1JlZj17YXBpTWV0cmljc1JlZn1cbiAgICAgICAgICAgICAgICAgIG92ZXJyaWRlTWVzc2FnZT17c3Bpbm5lck1lc3NhZ2V9XG4gICAgICAgICAgICAgICAgICBzcGlubmVyU3VmZml4PXtzdG9wSG9va1NwaW5uZXJTdWZmaXh9XG4gICAgICAgICAgICAgICAgICB2ZXJib3NlPXt2ZXJib3NlfVxuICAgICAgICAgICAgICAgICAgbG9hZGluZ1N0YXJ0VGltZVJlZj17bG9hZGluZ1N0YXJ0VGltZVJlZn1cbiAgICAgICAgICAgICAgICAgIHRvdGFsUGF1c2VkTXNSZWY9e3RvdGFsUGF1c2VkTXNSZWZ9XG4gICAgICAgICAgICAgICAgICBwYXVzZVN0YXJ0VGltZVJlZj17cGF1c2VTdGFydFRpbWVSZWZ9XG4gICAgICAgICAgICAgICAgICBvdmVycmlkZUNvbG9yPXtzcGlubmVyQ29sb3J9XG4gICAgICAgICAgICAgICAgICBvdmVycmlkZVNoaW1tZXJDb2xvcj17c3Bpbm5lclNoaW1tZXJDb2xvcn1cbiAgICAgICAgICAgICAgICAgIGhhc0FjdGl2ZVRvb2xzPXtpblByb2dyZXNzVG9vbFVzZUlEcy5zaXplID4gMH1cbiAgICAgICAgICAgICAgICAgIGxlYWRlcklzSWRsZT17IWlzTG9hZGluZ31cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICB7IXNob3dTcGlubmVyICYmXG4gICAgICAgICAgICAgICAgIWlzTG9hZGluZyAmJlxuICAgICAgICAgICAgICAgICF1c2VySW5wdXRPblByb2Nlc3NpbmcgJiZcbiAgICAgICAgICAgICAgICAhaGFzUnVubmluZ1RlYW1tYXRlcyAmJlxuICAgICAgICAgICAgICAgIGlzQnJpZWZPbmx5ICYmXG4gICAgICAgICAgICAgICAgIXZpZXdlZEFnZW50VGFzayAmJiA8QnJpZWZJZGxlU3RhdHVzIC8+fVxuICAgICAgICAgICAgICB7aXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpICYmIDxQcm9tcHRJbnB1dFF1ZXVlZENvbW1hbmRzIC8+fVxuICAgICAgICAgICAgPC8+XG4gICAgICAgICAgfVxuICAgICAgICAgIGJvdHRvbT17XG4gICAgICAgICAgICA8Qm94XG4gICAgICAgICAgICAgIGZsZXhEaXJlY3Rpb249e1xuICAgICAgICAgICAgICAgIGZlYXR1cmUoJ0JVRERZJykgJiYgY29tcGFuaW9uTmFycm93ID8gJ2NvbHVtbicgOiAncm93J1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHdpZHRoPVwiMTAwJVwiXG4gICAgICAgICAgICAgIGFsaWduSXRlbXM9e1xuICAgICAgICAgICAgICAgIGZlYXR1cmUoJ0JVRERZJykgJiYgY29tcGFuaW9uTmFycm93ID8gdW5kZWZpbmVkIDogJ2ZsZXgtZW5kJ1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtmZWF0dXJlKCdCVUREWScpICYmXG4gICAgICAgICAgICAgIGNvbXBhbmlvbk5hcnJvdyAmJlxuICAgICAgICAgICAgICBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgJiZcbiAgICAgICAgICAgICAgY29tcGFuaW9uVmlzaWJsZSA/IChcbiAgICAgICAgICAgICAgICA8Q29tcGFuaW9uU3ByaXRlIC8+XG4gICAgICAgICAgICAgICkgOiBudWxsfVxuICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBmbGV4R3Jvdz17MX0+XG4gICAgICAgICAgICAgICAge3Blcm1pc3Npb25TdGlja3lGb290ZXJ9XG4gICAgICAgICAgICAgICAgey8qIEltbWVkaWF0ZSBsb2NhbC1qc3ggY29tbWFuZHMgKC9idHcsIC9zYW5kYm94LCAvYXNzaXN0YW50LFxuICAgICAgICAgICAgICAgICAgL2lzc3VlKSByZW5kZXIgaGVyZSwgTk9UIGluc2lkZSBzY3JvbGxhYmxlLiBUaGV5IHN0YXkgbW91bnRlZFxuICAgICAgICAgICAgICAgICAgd2hpbGUgdGhlIG1haW4gY29udmVyc2F0aW9uIHN0cmVhbXMgYmVoaW5kIHRoZW0sIHNvIFNjcm9sbEJveFxuICAgICAgICAgICAgICAgICAgcmVsYXlvdXRzIG9uIGVhY2ggbmV3IG1lc3NhZ2Ugd291bGQgZHJhZyB0aGVtIGFyb3VuZC4gYm90dG9tXG4gICAgICAgICAgICAgICAgICBpcyBmbGV4U2hyaW5rPXswfSBvdXRzaWRlIHRoZSBTY3JvbGxCb3gg4oCUIGl0IG5ldmVyIG1vdmVzLlxuICAgICAgICAgICAgICAgICAgTm9uLWltbWVkaWF0ZSBsb2NhbC1qc3ggKC9kaWZmLCAvc3RhdHVzLCAvdGhlbWUsIH40MCBvdGhlcnMpXG4gICAgICAgICAgICAgICAgICBzdGF5cyBpbiBzY3JvbGxhYmxlOiB0aGUgbWFpbiBsb29wIGlzIHBhdXNlZCBzbyBubyBqaWdnbGUsXG4gICAgICAgICAgICAgICAgICBhbmQgdGhlaXIgdGFsbCBjb250ZW50IChEaWZmRGV0YWlsVmlldyByZW5kZXJzIHVwIHRvIDQwMFxuICAgICAgICAgICAgICAgICAgbGluZXMgd2l0aCBubyBpbnRlcm5hbCBzY3JvbGwpIG5lZWRzIHRoZSBvdXRlciBTY3JvbGxCb3guICovfVxuICAgICAgICAgICAgICAgIHt0b29sSlNYPy5pc0xvY2FsSlNYQ29tbWFuZCAmJlxuICAgICAgICAgICAgICAgICAgdG9vbEpTWC5pc0ltbWVkaWF0ZSAmJlxuICAgICAgICAgICAgICAgICAgIXRvb2xKc3hDZW50ZXJlZCAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPVwiMTAwJVwiPlxuICAgICAgICAgICAgICAgICAgICAgIHt0b29sSlNYLmpzeH1cbiAgICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHshc2hvd1NwaW5uZXIgJiZcbiAgICAgICAgICAgICAgICAgICF0b29sSlNYPy5pc0xvY2FsSlNYQ29tbWFuZCAmJlxuICAgICAgICAgICAgICAgICAgc2hvd0V4cGFuZGVkVG9kb3MgJiZcbiAgICAgICAgICAgICAgICAgIHRhc2tzVjIgJiZcbiAgICAgICAgICAgICAgICAgIHRhc2tzVjIubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxCb3ggd2lkdGg9XCIxMDAlXCIgZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxUYXNrTGlzdFYyIHRhc2tzPXt0YXNrc1YyfSBpc1N0YW5kYWxvbmU9e3RydWV9IC8+XG4gICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICB7Zm9jdXNlZElucHV0RGlhbG9nID09PSAnc2FuZGJveC1wZXJtaXNzaW9uJyAmJiAoXG4gICAgICAgICAgICAgICAgICA8U2FuZGJveFBlcm1pc3Npb25SZXF1ZXN0XG4gICAgICAgICAgICAgICAgICAgIGtleT17c2FuZGJveFBlcm1pc3Npb25SZXF1ZXN0UXVldWVbMF0hLmhvc3RQYXR0ZXJuLmhvc3R9XG4gICAgICAgICAgICAgICAgICAgIGhvc3RQYXR0ZXJuPXtzYW5kYm94UGVybWlzc2lvblJlcXVlc3RRdWV1ZVswXSEuaG9zdFBhdHRlcm59XG4gICAgICAgICAgICAgICAgICAgIG9uVXNlclJlc3BvbnNlPXsocmVzcG9uc2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICBhbGxvdzogYm9vbGVhblxuICAgICAgICAgICAgICAgICAgICAgIHBlcnNpc3RUb1NldHRpbmdzOiBib29sZWFuXG4gICAgICAgICAgICAgICAgICAgIH0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGFsbG93LCBwZXJzaXN0VG9TZXR0aW5ncyB9ID0gcmVzcG9uc2VcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50UmVxdWVzdCA9IHNhbmRib3hQZXJtaXNzaW9uUmVxdWVzdFF1ZXVlWzBdXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKCFjdXJyZW50UmVxdWVzdCkgcmV0dXJuXG5cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhcHByb3ZlZEhvc3QgPSBjdXJyZW50UmVxdWVzdC5ob3N0UGF0dGVybi5ob3N0XG5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAocGVyc2lzdFRvU2V0dGluZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FkZFJ1bGVzJyBhcyBjb25zdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcnVsZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b29sTmFtZTogV0VCX0ZFVENIX1RPT0xfTkFNRSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGVDb250ZW50OiBgZG9tYWluOiR7YXBwcm92ZWRIb3N0fWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYmVoYXZpb3I6IChhbGxvdyA/ICdhbGxvdycgOiAnZGVueScpIGFzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAnYWxsb3cnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfCAnZGVueScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uOiAnbG9jYWxTZXR0aW5ncycgYXMgY29uc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiBhcHBseVBlcm1pc3Npb25VcGRhdGUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldi50b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSkpXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHBlcnNpc3RQZXJtaXNzaW9uVXBkYXRlKHVwZGF0ZSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSW1tZWRpYXRlbHkgdXBkYXRlIHNhbmRib3ggaW4tbWVtb3J5IGNvbmZpZyB0byBwcmV2ZW50IHJhY2UgY29uZGl0aW9uc1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2hlcmUgcGVuZGluZyByZXF1ZXN0cyBzbGlwIHRocm91Z2ggYmVmb3JlIHNldHRpbmdzIGNoYW5nZSBpcyBkZXRlY3RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgU2FuZGJveE1hbmFnZXIucmVmcmVzaENvbmZpZygpXG4gICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgLy8gUmVzb2x2ZSBBTEwgcGVuZGluZyByZXF1ZXN0cyBmb3IgdGhlIHNhbWUgaG9zdCAobm90IGp1c3QgdGhlIGZpcnN0IG9uZSlcbiAgICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGhhbmRsZXMgdGhlIGNhc2Ugd2hlcmUgbXVsdGlwbGUgcGFyYWxsZWwgcmVxdWVzdHMgY2FtZSBpbiBmb3IgdGhlIHNhbWUgZG9tYWluXG4gICAgICAgICAgICAgICAgICAgICAgc2V0U2FuZGJveFBlcm1pc3Npb25SZXF1ZXN0UXVldWUocXVldWUgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcXVldWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtID0+IGl0ZW0uaG9zdFBhdHRlcm4uaG9zdCA9PT0gYXBwcm92ZWRIb3N0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC5mb3JFYWNoKGl0ZW0gPT4gaXRlbS5yZXNvbHZlUHJvbWlzZShhbGxvdykpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcXVldWUuZmlsdGVyKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtID0+IGl0ZW0uaG9zdFBhdHRlcm4uaG9zdCAhPT0gYXBwcm92ZWRIb3N0LFxuICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgICAvLyBDbGVhbiB1cCBicmlkZ2Ugc3Vic2NyaXB0aW9ucyBhbmQgY2FuY2VsIHJlbW90ZSBwcm9tcHRzXG4gICAgICAgICAgICAgICAgICAgICAgLy8gZm9yIHRoaXMgaG9zdCBzaW5jZSB0aGUgbG9jYWwgdXNlciBhbHJlYWR5IHJlc3BvbmRlZC5cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbGVhbnVwcyA9XG4gICAgICAgICAgICAgICAgICAgICAgICBzYW5kYm94QnJpZGdlQ2xlYW51cFJlZi5jdXJyZW50LmdldChhcHByb3ZlZEhvc3QpXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGNsZWFudXBzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGZuIG9mIGNsZWFudXBzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZuKClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHNhbmRib3hCcmlkZ2VDbGVhbnVwUmVmLmN1cnJlbnQuZGVsZXRlKGFwcHJvdmVkSG9zdClcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAge2ZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ3Byb21wdCcgJiYgKFxuICAgICAgICAgICAgICAgICAgPFByb21wdERpYWxvZ1xuICAgICAgICAgICAgICAgICAgICBrZXk9e3Byb21wdFF1ZXVlWzBdIS5yZXF1ZXN0LnByb21wdH1cbiAgICAgICAgICAgICAgICAgICAgdGl0bGU9e3Byb21wdFF1ZXVlWzBdIS50aXRsZX1cbiAgICAgICAgICAgICAgICAgICAgdG9vbElucHV0U3VtbWFyeT17cHJvbXB0UXVldWVbMF0hLnRvb2xJbnB1dFN1bW1hcnl9XG4gICAgICAgICAgICAgICAgICAgIHJlcXVlc3Q9e3Byb21wdFF1ZXVlWzBdIS5yZXF1ZXN0fVxuICAgICAgICAgICAgICAgICAgICBvblJlc3BvbmQ9e3NlbGVjdGVkS2V5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpdGVtID0gcHJvbXB0UXVldWVbMF1cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoIWl0ZW0pIHJldHVyblxuICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ucmVzb2x2ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9tcHRfcmVzcG9uc2U6IGl0ZW0ucmVxdWVzdC5wcm9tcHQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RlZDogc2VsZWN0ZWRLZXksXG4gICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICBzZXRQcm9tcHRRdWV1ZSgoWywgLi4udGFpbF0pID0+IHRhaWwpXG4gICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgIG9uQWJvcnQ9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpdGVtID0gcHJvbXB0UXVldWVbMF1cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoIWl0ZW0pIHJldHVyblxuICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ucmVqZWN0KG5ldyBFcnJvcignUHJvbXB0IGNhbmNlbGxlZCBieSB1c2VyJykpXG4gICAgICAgICAgICAgICAgICAgICAgc2V0UHJvbXB0UXVldWUoKFssIC4uLnRhaWxdKSA9PiB0YWlsKVxuICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHsvKiBTaG93IHBlbmRpbmcgaW5kaWNhdG9yIG9uIHdvcmtlciB3aGlsZSB3YWl0aW5nIGZvciBsZWFkZXIgYXBwcm92YWwgKi99XG4gICAgICAgICAgICAgICAge3BlbmRpbmdXb3JrZXJSZXF1ZXN0ICYmIChcbiAgICAgICAgICAgICAgICAgIDxXb3JrZXJQZW5kaW5nUGVybWlzc2lvblxuICAgICAgICAgICAgICAgICAgICB0b29sTmFtZT17cGVuZGluZ1dvcmtlclJlcXVlc3QudG9vbE5hbWV9XG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPXtwZW5kaW5nV29ya2VyUmVxdWVzdC5kZXNjcmlwdGlvbn1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICB7LyogU2hvdyBwZW5kaW5nIGluZGljYXRvciBmb3Igc2FuZGJveCBwZXJtaXNzaW9uIG9uIHdvcmtlciBzaWRlICovfVxuICAgICAgICAgICAgICAgIHtwZW5kaW5nU2FuZGJveFJlcXVlc3QgJiYgKFxuICAgICAgICAgICAgICAgICAgPFdvcmtlclBlbmRpbmdQZXJtaXNzaW9uXG4gICAgICAgICAgICAgICAgICAgIHRvb2xOYW1lPVwiTmV0d29yayBBY2Nlc3NcIlxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj17YFdhaXRpbmcgZm9yIGxlYWRlciB0byBhcHByb3ZlIG5ldHdvcmsgYWNjZXNzIHRvICR7cGVuZGluZ1NhbmRib3hSZXF1ZXN0Lmhvc3R9YH1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICB7LyogV29ya2VyIHNhbmRib3ggcGVybWlzc2lvbiByZXF1ZXN0cyBmcm9tIHN3YXJtIHdvcmtlcnMgKi99XG4gICAgICAgICAgICAgICAge2ZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ3dvcmtlci1zYW5kYm94LXBlcm1pc3Npb24nICYmIChcbiAgICAgICAgICAgICAgICAgIDxTYW5kYm94UGVybWlzc2lvblJlcXVlc3RcbiAgICAgICAgICAgICAgICAgICAga2V5PXt3b3JrZXJTYW5kYm94UGVybWlzc2lvbnMucXVldWVbMF0hLnJlcXVlc3RJZH1cbiAgICAgICAgICAgICAgICAgICAgaG9zdFBhdHRlcm49e1xuICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhvc3Q6IHdvcmtlclNhbmRib3hQZXJtaXNzaW9ucy5xdWV1ZVswXSEuaG9zdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvcnQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICB9IGFzIE5ldHdvcmtIb3N0UGF0dGVyblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG9uVXNlclJlc3BvbnNlPXsocmVzcG9uc2U6IHtcbiAgICAgICAgICAgICAgICAgICAgICBhbGxvdzogYm9vbGVhblxuICAgICAgICAgICAgICAgICAgICAgIHBlcnNpc3RUb1NldHRpbmdzOiBib29sZWFuXG4gICAgICAgICAgICAgICAgICAgIH0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGFsbG93LCBwZXJzaXN0VG9TZXR0aW5ncyB9ID0gcmVzcG9uc2VcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50UmVxdWVzdCA9IHdvcmtlclNhbmRib3hQZXJtaXNzaW9ucy5xdWV1ZVswXVxuICAgICAgICAgICAgICAgICAgICAgIGlmICghY3VycmVudFJlcXVlc3QpIHJldHVyblxuXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXBwcm92ZWRIb3N0ID0gY3VycmVudFJlcXVlc3QuaG9zdFxuXG4gICAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCByZXNwb25zZSB2aWEgbWFpbGJveCB0byB0aGUgd29ya2VyXG4gICAgICAgICAgICAgICAgICAgICAgdm9pZCBzZW5kU2FuZGJveFBlcm1pc3Npb25SZXNwb25zZVZpYU1haWxib3goXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50UmVxdWVzdC53b3JrZXJOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudFJlcXVlc3QucmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwcm92ZWRIb3N0LFxuICAgICAgICAgICAgICAgICAgICAgICAgYWxsb3csXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZWFtQ29udGV4dD8udGVhbU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHBlcnNpc3RUb1NldHRpbmdzICYmIGFsbG93KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRSdWxlcycgYXMgY29uc3QsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJ1bGVzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9vbE5hbWU6IFdFQl9GRVRDSF9UT09MX05BTUUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBydWxlQ29udGVudDogYGRvbWFpbjoke2FwcHJvdmVkSG9zdH1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGJlaGF2aW9yOiAnYWxsb3cnIGFzIGNvbnN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbjogJ2xvY2FsU2V0dGluZ3MnIGFzIGNvbnN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xQZXJtaXNzaW9uQ29udGV4dDogYXBwbHlQZXJtaXNzaW9uVXBkYXRlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBwZXJzaXN0UGVybWlzc2lvblVwZGF0ZSh1cGRhdGUpXG4gICAgICAgICAgICAgICAgICAgICAgICBTYW5kYm94TWFuYWdlci5yZWZyZXNoQ29uZmlnKClcbiAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZnJvbSBxdWV1ZVxuICAgICAgICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JrZXJTYW5kYm94UGVybWlzc2lvbnM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ucHJldi53b3JrZXJTYW5kYm94UGVybWlzc2lvbnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXVlOiBwcmV2LndvcmtlclNhbmRib3hQZXJtaXNzaW9ucy5xdWV1ZS5zbGljZSgxKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAge2ZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ2VsaWNpdGF0aW9uJyAmJiAoXG4gICAgICAgICAgICAgICAgICA8RWxpY2l0YXRpb25EaWFsb2dcbiAgICAgICAgICAgICAgICAgICAga2V5PXtcbiAgICAgICAgICAgICAgICAgICAgICBlbGljaXRhdGlvbi5xdWV1ZVswXSEuc2VydmVyTmFtZSArXG4gICAgICAgICAgICAgICAgICAgICAgJzonICtcbiAgICAgICAgICAgICAgICAgICAgICBTdHJpbmcoZWxpY2l0YXRpb24ucXVldWVbMF0hLnJlcXVlc3RJZClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBldmVudD17ZWxpY2l0YXRpb24ucXVldWVbMF0hfVxuICAgICAgICAgICAgICAgICAgICBvblJlc3BvbnNlPXsoYWN0aW9uLCBjb250ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFJlcXVlc3QgPSBlbGljaXRhdGlvbi5xdWV1ZVswXVxuICAgICAgICAgICAgICAgICAgICAgIGlmICghY3VycmVudFJlcXVlc3QpIHJldHVyblxuICAgICAgICAgICAgICAgICAgICAgIC8vIENhbGwgcmVzcG9uZCBjYWxsYmFjayB0byByZXNvbHZlIFByb21pc2VcbiAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50UmVxdWVzdC5yZXNwb25kKHsgYWN0aW9uLCBjb250ZW50IH0pXG4gICAgICAgICAgICAgICAgICAgICAgLy8gRm9yIFVSTCBhY2NlcHQsIGtlZXAgaW4gcXVldWUgZm9yIHBoYXNlIDJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1VybEFjY2VwdCA9XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50UmVxdWVzdC5wYXJhbXMubW9kZSA9PT0gJ3VybCcgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbiA9PT0gJ2FjY2VwdCdcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzVXJsQWNjZXB0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGVsaWNpdGF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcXVldWU6IHByZXYuZWxpY2l0YXRpb24ucXVldWUuc2xpY2UoMSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgIG9uV2FpdGluZ0Rpc21pc3M9e2FjdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFJlcXVlc3QgPSBlbGljaXRhdGlvbi5xdWV1ZVswXVxuICAgICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBmcm9tIHF1ZXVlXG4gICAgICAgICAgICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsaWNpdGF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXVlOiBwcmV2LmVsaWNpdGF0aW9uLnF1ZXVlLnNsaWNlKDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50UmVxdWVzdD8ub25XYWl0aW5nRGlzbWlzcz8uKGFjdGlvbilcbiAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICB7Zm9jdXNlZElucHV0RGlhbG9nID09PSAnY29zdCcgJiYgKFxuICAgICAgICAgICAgICAgICAgPENvc3RUaHJlc2hvbGREaWFsb2dcbiAgICAgICAgICAgICAgICAgICAgb25Eb25lPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd0Nvc3REaWFsb2coZmFsc2UpXG4gICAgICAgICAgICAgICAgICAgICAgc2V0SGF2ZVNob3duQ29zdERpYWxvZyh0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc0Fja25vd2xlZGdlZENvc3RUaHJlc2hvbGQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2Nvc3RfdGhyZXNob2xkX2Fja25vd2xlZGdlZCcsIHt9KVxuICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHtmb2N1c2VkSW5wdXREaWFsb2cgPT09ICdpZGxlLXJldHVybicgJiYgaWRsZVJldHVyblBlbmRpbmcgJiYgKFxuICAgICAgICAgICAgICAgICAgPElkbGVSZXR1cm5EaWFsb2dcbiAgICAgICAgICAgICAgICAgICAgaWRsZU1pbnV0ZXM9e2lkbGVSZXR1cm5QZW5kaW5nLmlkbGVNaW51dGVzfVxuICAgICAgICAgICAgICAgICAgICB0b3RhbElucHV0VG9rZW5zPXtnZXRUb3RhbElucHV0VG9rZW5zKCl9XG4gICAgICAgICAgICAgICAgICAgIG9uRG9uZT17YXN5bmMgYWN0aW9uID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwZW5kaW5nID0gaWRsZVJldHVyblBlbmRpbmdcbiAgICAgICAgICAgICAgICAgICAgICBzZXRJZGxlUmV0dXJuUGVuZGluZyhudWxsKVxuICAgICAgICAgICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9pZGxlX3JldHVybl9hY3Rpb24nLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbiBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWRsZU1pbnV0ZXM6IE1hdGgucm91bmQocGVuZGluZy5pZGxlTWludXRlcyksXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlQ291bnQ6IG1lc3NhZ2VzUmVmLmN1cnJlbnQubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgdG90YWxJbnB1dFRva2VuczogZ2V0VG90YWxJbnB1dFRva2VucygpLFxuICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ2Rpc21pc3MnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRJbnB1dFZhbHVlKHBlbmRpbmcuaW5wdXQpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ25ldmVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2F2ZUdsb2JhbENvbmZpZyhjdXJyZW50ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQuaWRsZVJldHVybkRpc21pc3NlZCkgcmV0dXJuIGN1cnJlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgLi4uY3VycmVudCwgaWRsZVJldHVybkRpc21pc3NlZDogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoYWN0aW9uID09PSAnY2xlYXInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGNsZWFyQ29udmVyc2F0aW9uIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICcuLi9jb21tYW5kcy9jbGVhci9jb252ZXJzYXRpb24uanMnXG4gICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBjbGVhckNvbnZlcnNhdGlvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldE1lc3NhZ2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICByZWFkRmlsZVN0YXRlOiByZWFkRmlsZVN0YXRlLmN1cnJlbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2NvdmVyZWRTa2lsbE5hbWVzOiBkaXNjb3ZlcmVkU2tpbGxOYW1lc1JlZi5jdXJyZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICBsb2FkZWROZXN0ZWRNZW1vcnlQYXRoczpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2FkZWROZXN0ZWRNZW1vcnlQYXRoc1JlZi5jdXJyZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICBnZXRBcHBTdGF0ZTogKCkgPT4gc3RvcmUuZ2V0U3RhdGUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldENvbnZlcnNhdGlvbklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhaWt1VGl0bGVBdHRlbXB0ZWRSZWYuY3VycmVudCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRIYWlrdVRpdGxlKHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhc2hUb29scy5jdXJyZW50LmNsZWFyKClcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhc2hUb29sc1Byb2Nlc3NlZElkeC5jdXJyZW50ID0gMFxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBza2lwSWRsZUNoZWNrUmVmLmN1cnJlbnQgPSB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgdm9pZCBvblN1Ym1pdFJlZi5jdXJyZW50KHBlbmRpbmcuaW5wdXQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldEN1cnNvck9mZnNldDogKCkgPT4ge30sXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhckJ1ZmZlcjogKCkgPT4ge30sXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNldEhpc3Rvcnk6ICgpID0+IHt9LFxuICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAge2ZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ2lkZS1vbmJvYXJkaW5nJyAmJiAoXG4gICAgICAgICAgICAgICAgICA8SWRlT25ib2FyZGluZ0RpYWxvZ1xuICAgICAgICAgICAgICAgICAgICBvbkRvbmU9eygpID0+IHNldFNob3dJZGVPbmJvYXJkaW5nKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgaW5zdGFsbGF0aW9uU3RhdHVzPXtpZGVJbnN0YWxsYXRpb25TdGF0dXN9XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAge1wiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiZcbiAgICAgICAgICAgICAgICAgIGZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ21vZGVsLXN3aXRjaCcgJiZcbiAgICAgICAgICAgICAgICAgIEFudE1vZGVsU3dpdGNoQ2FsbG91dCAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxBbnRNb2RlbFN3aXRjaENhbGxvdXRcbiAgICAgICAgICAgICAgICAgICAgICBvbkRvbmU9eyhzZWxlY3Rpb246IHN0cmluZywgbW9kZWxBbGlhcz86IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2hvd01vZGVsU3dpdGNoQ2FsbG91dChmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxlY3Rpb24gPT09ICdzd2l0Y2gnICYmIG1vZGVsQWxpYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWFpbkxvb3BNb2RlbDogbW9kZWxBbGlhcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYWluTG9vcE1vZGVsRm9yU2Vzc2lvbjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAge1wiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiZcbiAgICAgICAgICAgICAgICAgIGZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ3VuZGVyY292ZXItY2FsbG91dCcgJiZcbiAgICAgICAgICAgICAgICAgIFVuZGVyY292ZXJBdXRvQ2FsbG91dCAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxVbmRlcmNvdmVyQXV0b0NhbGxvdXRcbiAgICAgICAgICAgICAgICAgICAgICBvbkRvbmU9eygpID0+IHNldFNob3dVbmRlcmNvdmVyQ2FsbG91dChmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHtmb2N1c2VkSW5wdXREaWFsb2cgPT09ICdlZmZvcnQtY2FsbG91dCcgJiYgKFxuICAgICAgICAgICAgICAgICAgPEVmZm9ydENhbGxvdXRcbiAgICAgICAgICAgICAgICAgICAgbW9kZWw9e21haW5Mb29wTW9kZWx9XG4gICAgICAgICAgICAgICAgICAgIG9uRG9uZT17c2VsZWN0aW9uID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBzZXRTaG93RWZmb3J0Q2FsbG91dChmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZWN0aW9uICE9PSAnZGlzbWlzcycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZWZmb3J0VmFsdWU6IHNlbGVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICB7Zm9jdXNlZElucHV0RGlhbG9nID09PSAncmVtb3RlLWNhbGxvdXQnICYmIChcbiAgICAgICAgICAgICAgICAgIDxSZW1vdGVDYWxsb3V0XG4gICAgICAgICAgICAgICAgICAgIG9uRG9uZT17c2VsZWN0aW9uID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcHJldi5zaG93UmVtb3RlQ2FsbG91dCkgcmV0dXJuIHByZXZcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dSZW1vdGVDYWxsb3V0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLi4uKHNlbGVjdGlvbiA9PT0gJ2VuYWJsZScgJiYge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxCcmlkZ2VFeHBsaWNpdDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBsQnJpZGdlT3V0Ym91bmRPbmx5OiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgIHtleGl0Rmxvd31cblxuICAgICAgICAgICAgICAgIHtmb2N1c2VkSW5wdXREaWFsb2cgPT09ICdwbHVnaW4taGludCcgJiYgaGludFJlY29tbWVuZGF0aW9uICYmIChcbiAgICAgICAgICAgICAgICAgIDxQbHVnaW5IaW50TWVudVxuICAgICAgICAgICAgICAgICAgICBwbHVnaW5OYW1lPXtoaW50UmVjb21tZW5kYXRpb24ucGx1Z2luTmFtZX1cbiAgICAgICAgICAgICAgICAgICAgcGx1Z2luRGVzY3JpcHRpb249e2hpbnRSZWNvbW1lbmRhdGlvbi5wbHVnaW5EZXNjcmlwdGlvbn1cbiAgICAgICAgICAgICAgICAgICAgbWFya2V0cGxhY2VOYW1lPXtoaW50UmVjb21tZW5kYXRpb24ubWFya2V0cGxhY2VOYW1lfVxuICAgICAgICAgICAgICAgICAgICBzb3VyY2VDb21tYW5kPXtoaW50UmVjb21tZW5kYXRpb24uc291cmNlQ29tbWFuZH1cbiAgICAgICAgICAgICAgICAgICAgb25SZXNwb25zZT17aGFuZGxlSGludFJlc3BvbnNlfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAge2ZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ2xzcC1yZWNvbW1lbmRhdGlvbicgJiZcbiAgICAgICAgICAgICAgICAgIGxzcFJlY29tbWVuZGF0aW9uICYmIChcbiAgICAgICAgICAgICAgICAgICAgPExzcFJlY29tbWVuZGF0aW9uTWVudVxuICAgICAgICAgICAgICAgICAgICAgIHBsdWdpbk5hbWU9e2xzcFJlY29tbWVuZGF0aW9uLnBsdWdpbk5hbWV9XG4gICAgICAgICAgICAgICAgICAgICAgcGx1Z2luRGVzY3JpcHRpb249e2xzcFJlY29tbWVuZGF0aW9uLnBsdWdpbkRlc2NyaXB0aW9ufVxuICAgICAgICAgICAgICAgICAgICAgIGZpbGVFeHRlbnNpb249e2xzcFJlY29tbWVuZGF0aW9uLmZpbGVFeHRlbnNpb259XG4gICAgICAgICAgICAgICAgICAgICAgb25SZXNwb25zZT17aGFuZGxlTHNwUmVzcG9uc2V9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAge2ZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ2Rlc2t0b3AtdXBzZWxsJyAmJiAoXG4gICAgICAgICAgICAgICAgICA8RGVza3RvcFVwc2VsbFN0YXJ0dXBcbiAgICAgICAgICAgICAgICAgICAgb25Eb25lPXsoKSA9PiBzZXRTaG93RGVza3RvcFVwc2VsbFN0YXJ0dXAoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAge2ZlYXR1cmUoJ1VMVFJBUExBTicpXG4gICAgICAgICAgICAgICAgICA/IGZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ3VsdHJhcGxhbi1jaG9pY2UnICYmXG4gICAgICAgICAgICAgICAgICAgIHVsdHJhcGxhblBlbmRpbmdDaG9pY2UgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDxVbHRyYXBsYW5DaG9pY2VEaWFsb2dcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYW49e3VsdHJhcGxhblBlbmRpbmdDaG9pY2UucGxhbn1cbiAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb25JZD17dWx0cmFwbGFuUGVuZGluZ0Nob2ljZS5zZXNzaW9uSWR9XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXNrSWQ9e3VsdHJhcGxhblBlbmRpbmdDaG9pY2UudGFza0lkfVxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0TWVzc2FnZXM9e3NldE1lc3NhZ2VzfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVhZEZpbGVTdGF0ZT17cmVhZEZpbGVTdGF0ZS5jdXJyZW50fVxuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0QXBwU3RhdGU9eygpID0+IHN0b3JlLmdldFN0YXRlKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRDb252ZXJzYXRpb25JZD17c2V0Q29udmVyc2F0aW9uSWR9XG4gICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgOiBudWxsfVxuXG4gICAgICAgICAgICAgICAge2ZlYXR1cmUoJ1VMVFJBUExBTicpXG4gICAgICAgICAgICAgICAgICA/IGZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ3VsdHJhcGxhbi1sYXVuY2gnICYmXG4gICAgICAgICAgICAgICAgICAgIHVsdHJhcGxhbkxhdW5jaFBlbmRpbmcgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDxVbHRyYXBsYW5MYXVuY2hEaWFsb2dcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hvaWNlPXsoY2hvaWNlLCBvcHRzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJsdXJiID0gdWx0cmFwbGFuTGF1bmNoUGVuZGluZy5ibHVyYlxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldi51bHRyYXBsYW5MYXVuY2hQZW5kaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IHsgLi4ucHJldiwgdWx0cmFwbGFuTGF1bmNoUGVuZGluZzogdW5kZWZpbmVkIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogcHJldixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hvaWNlID09PSAnY2FuY2VsJykgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENvbW1hbmQncyBvbkRvbmUgdXNlZCBkaXNwbGF5Oidza2lwJywgc28gYWRkIHRoZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlY2hvIGhlcmUg4oCUIGdpdmVzIGltbWVkaWF0ZSBmZWVkYmFjayBiZWZvcmUgdGhlXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIH41cyB0ZWxlcG9ydFRvUmVtb3RlIHJlc29sdmVzLlxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRNZXNzYWdlcyhwcmV2ID0+IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZUNvbW1hbmRJbnB1dE1lc3NhZ2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3JtYXRDb21tYW5kSW5wdXRUYWdzKCd1bHRyYXBsYW4nLCBibHVyYiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXBwZW5kU3Rkb3V0ID0gKG1zZzogc3RyaW5nKSA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldE1lc3NhZ2VzKHByZXYgPT4gW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZUNvbW1hbmRJbnB1dE1lc3NhZ2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGA8JHtMT0NBTF9DT01NQU5EX1NURE9VVF9UQUd9PiR7ZXNjYXBlWG1sKG1zZyl9PC8ke0xPQ0FMX0NPTU1BTkRfU1RET1VUX1RBR30+YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGVmZXIgdGhlIHNlY29uZCBtZXNzYWdlIGlmIGEgcXVlcnkgaXMgbWlkLXR1cm5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc28gaXQgbGFuZHMgYWZ0ZXIgdGhlIGFzc2lzdGFudCByZXBseSwgbm90XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJldHdlZW4gdGhlIHVzZXIncyBwcm9tcHQgYW5kIHRoZSByZXBseS5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXBwZW5kV2hlbklkbGUgPSAobXNnOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXF1ZXJ5R3VhcmQuaXNBY3RpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcGVuZFN0ZG91dChtc2cpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdW5zdWIgPSBxdWVyeUd1YXJkLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocXVlcnlHdWFyZC5pc0FjdGl2ZSkgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bnN1YigpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTa2lwIGlmIHRoZSB1c2VyIHN0b3BwZWQgdWx0cmFwbGFuIHdoaWxlIHdlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3ZXJlIHdhaXRpbmcg4oCUIGF2b2lkcyBhIHN0YWxlIFwiTW9uaXRvcmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gPHVybD5cIiBtZXNzYWdlIGZvciBhIHNlc3Npb24gdGhhdCdzIGdvbmUuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXN0b3JlLmdldFN0YXRlKCkudWx0cmFwbGFuU2Vzc2lvblVybCkgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHBlbmRTdGRvdXQobXNnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgdm9pZCBsYXVuY2hVbHRyYXBsYW4oe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJsdXJiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdldEFwcFN0YXRlOiAoKSA9PiBzdG9yZS5nZXRTdGF0ZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpZ25hbDogY3JlYXRlQWJvcnRDb250cm9sbGVyKCkuc2lnbmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2Nvbm5lY3RlZEJyaWRnZTogb3B0cz8uZGlzY29ubmVjdGVkQnJpZGdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uU2Vzc2lvblJlYWR5OiBhcHBlbmRXaGVuSWRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAudGhlbihhcHBlbmRTdGRvdXQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGxvZ0Vycm9yKVxuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICA6IG51bGx9XG5cbiAgICAgICAgICAgICAgICB7bXJSZW5kZXIoKX1cblxuICAgICAgICAgICAgICAgIHshdG9vbEpTWD8uc2hvdWxkSGlkZVByb21wdElucHV0ICYmXG4gICAgICAgICAgICAgICAgICAhZm9jdXNlZElucHV0RGlhbG9nICYmXG4gICAgICAgICAgICAgICAgICAhaXNFeGl0aW5nICYmXG4gICAgICAgICAgICAgICAgICAhZGlzYWJsZWQgJiZcbiAgICAgICAgICAgICAgICAgICFjdXJzb3IgJiYgKFxuICAgICAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgICAgIHthdXRvUnVuSXNzdWVSZWFzb24gJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgPEF1dG9SdW5Jc3N1ZU5vdGlmaWNhdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblJ1bj17aGFuZGxlQXV0b1J1bklzc3VlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNhbmNlbD17aGFuZGxlQ2FuY2VsQXV0b1J1bklzc3VlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICByZWFzb249e2dldEF1dG9SdW5Jc3N1ZVJlYXNvblRleHQoYXV0b1J1bklzc3VlUmVhc29uKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICB7cG9zdENvbXBhY3RTdXJ2ZXkuc3RhdGUgIT09ICdjbG9zZWQnID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgPEZlZWRiYWNrU3VydmV5XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlPXtwb3N0Q29tcGFjdFN1cnZleS5zdGF0ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdFJlc3BvbnNlPXtwb3N0Q29tcGFjdFN1cnZleS5sYXN0UmVzcG9uc2V9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZVNlbGVjdD17cG9zdENvbXBhY3RTdXJ2ZXkuaGFuZGxlU2VsZWN0fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFZhbHVlPXtpbnB1dFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRJbnB1dFZhbHVlPXtzZXRJbnB1dFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblJlcXVlc3RGZWVkYmFjaz17aGFuZGxlU3VydmV5UmVxdWVzdEZlZWRiYWNrfVxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICApIDogbWVtb3J5U3VydmV5LnN0YXRlICE9PSAnY2xvc2VkJyA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxGZWVkYmFja1N1cnZleVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0ZT17bWVtb3J5U3VydmV5LnN0YXRlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0UmVzcG9uc2U9e21lbW9yeVN1cnZleS5sYXN0UmVzcG9uc2V9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZVNlbGVjdD17bWVtb3J5U3VydmV5LmhhbmRsZVNlbGVjdH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlVHJhbnNjcmlwdFNlbGVjdD17XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb3J5U3VydmV5LmhhbmRsZVRyYW5zY3JpcHRTZWxlY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFZhbHVlPXtpbnB1dFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRJbnB1dFZhbHVlPXtzZXRJbnB1dFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblJlcXVlc3RGZWVkYmFjaz17aGFuZGxlU3VydmV5UmVxdWVzdEZlZWRiYWNrfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlPVwiSG93IHdlbGwgZGlkIENsYXVkZSB1c2UgaXRzIG1lbW9yeT8gKG9wdGlvbmFsKVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8RmVlZGJhY2tTdXJ2ZXlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGU9e2ZlZWRiYWNrU3VydmV5LnN0YXRlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0UmVzcG9uc2U9e2ZlZWRiYWNrU3VydmV5Lmxhc3RSZXNwb25zZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlU2VsZWN0PXtmZWVkYmFja1N1cnZleS5oYW5kbGVTZWxlY3R9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZVRyYW5zY3JpcHRTZWxlY3Q9e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZlZWRiYWNrU3VydmV5LmhhbmRsZVRyYW5zY3JpcHRTZWxlY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFZhbHVlPXtpbnB1dFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRJbnB1dFZhbHVlPXtzZXRJbnB1dFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBvblJlcXVlc3RGZWVkYmFjaz17XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlkQXV0b1J1bklzc3VlUmVmLmN1cnJlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IGhhbmRsZVN1cnZleVJlcXVlc3RGZWVkYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgey8qIEZydXN0cmF0aW9uLXRyaWdnZXJlZCB0cmFuc2NyaXB0IHNoYXJpbmcgcHJvbXB0ICovfVxuICAgICAgICAgICAgICAgICAgICAgIHtmcnVzdHJhdGlvbkRldGVjdGlvbi5zdGF0ZSAhPT0gJ2Nsb3NlZCcgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgPEZlZWRiYWNrU3VydmV5XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlPXtmcnVzdHJhdGlvbkRldGVjdGlvbi5zdGF0ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdFJlc3BvbnNlPXtudWxsfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVTZWxlY3Q9eygpID0+IHt9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVUcmFuc2NyaXB0U2VsZWN0PXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcnVzdHJhdGlvbkRldGVjdGlvbi5oYW5kbGVUcmFuc2NyaXB0U2VsZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRWYWx1ZT17aW5wdXRWYWx1ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0SW5wdXRWYWx1ZT17c2V0SW5wdXRWYWx1ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICB7LyogU2tpbGwgaW1wcm92ZW1lbnQgc3VydmV5IC0gYXBwZWFycyB3aGVuIGltcHJvdmVtZW50cyBkZXRlY3RlZCAoYW50LW9ubHkpICovfVxuICAgICAgICAgICAgICAgICAgICAgIHtcImV4dGVybmFsXCIgPT09ICdhbnQnICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBza2lsbEltcHJvdmVtZW50U3VydmV5LnN1Z2dlc3Rpb24gJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8U2tpbGxJbXByb3ZlbWVudFN1cnZleVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzT3Blbj17c2tpbGxJbXByb3ZlbWVudFN1cnZleS5pc09wZW59XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2tpbGxOYW1lPXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNraWxsSW1wcm92ZW1lbnRTdXJ2ZXkuc3VnZ2VzdGlvbi5za2lsbE5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlcz17c2tpbGxJbXByb3ZlbWVudFN1cnZleS5zdWdnZXN0aW9uLnVwZGF0ZXN9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlU2VsZWN0PXtza2lsbEltcHJvdmVtZW50U3VydmV5LmhhbmRsZVNlbGVjdH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFZhbHVlPXtpbnB1dFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldElucHV0VmFsdWU9e3NldElucHV0VmFsdWV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIHtzaG93SXNzdWVGbGFnQmFubmVyICYmIDxJc3N1ZUZsYWdCYW5uZXIgLz59XG4gICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICA8UHJvbXB0SW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlYnVnPXtkZWJ1Z31cbiAgICAgICAgICAgICAgICAgICAgICAgIGlkZVNlbGVjdGlvbj17aWRlU2VsZWN0aW9ufVxuICAgICAgICAgICAgICAgICAgICAgICAgaGFzU3VwcHJlc3NlZERpYWxvZ3M9eyEhaGFzU3VwcHJlc3NlZERpYWxvZ3N9XG4gICAgICAgICAgICAgICAgICAgICAgICBpc0xvY2FsSlNYQ29tbWFuZEFjdGl2ZT17aXNTaG93aW5nTG9jYWxKU1hDb21tYW5kfVxuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0VG9vbFVzZUNvbnRleHQ9e2dldFRvb2xVc2VDb250ZXh0fVxuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0PXt0b29sUGVybWlzc2lvbkNvbnRleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRUb29sUGVybWlzc2lvbkNvbnRleHQ9e3NldFRvb2xQZXJtaXNzaW9uQ29udGV4dH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGFwaUtleVN0YXR1cz17YXBpS2V5U3RhdHVzfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWFuZHM9e2NvbW1hbmRzfVxuICAgICAgICAgICAgICAgICAgICAgICAgYWdlbnRzPXthZ2VudERlZmluaXRpb25zLmFjdGl2ZUFnZW50c31cbiAgICAgICAgICAgICAgICAgICAgICAgIGlzTG9hZGluZz17aXNMb2FkaW5nfVxuICAgICAgICAgICAgICAgICAgICAgICAgb25FeGl0PXtoYW5kbGVFeGl0fVxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzPXttZXNzYWdlc31cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQXV0b1VwZGF0ZXJSZXN1bHQ9e3NldEF1dG9VcGRhdGVyUmVzdWx0fVxuICAgICAgICAgICAgICAgICAgICAgICAgYXV0b1VwZGF0ZXJSZXN1bHQ9e2F1dG9VcGRhdGVyUmVzdWx0fVxuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQ9e2lucHV0VmFsdWV9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbklucHV0Q2hhbmdlPXtzZXRJbnB1dFZhbHVlfVxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZT17aW5wdXRNb2RlfVxuICAgICAgICAgICAgICAgICAgICAgICAgb25Nb2RlQ2hhbmdlPXtzZXRJbnB1dE1vZGV9XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFzaGVkUHJvbXB0PXtzdGFzaGVkUHJvbXB0fVxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0U3Rhc2hlZFByb21wdD17c2V0U3Rhc2hlZFByb21wdH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Ym1pdENvdW50PXtzdWJtaXRDb3VudH1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uU2hvd01lc3NhZ2VTZWxlY3Rvcj17aGFuZGxlU2hvd01lc3NhZ2VTZWxlY3Rvcn1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uTWVzc2FnZUFjdGlvbnNFbnRlcj17XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdvcmtzIGR1cmluZyBpc0xvYWRpbmcg4oCUIGVkaXQgY2FuY2VscyBmaXJzdDsgdXVpZCBzZWxlY3Rpb24gc3Vydml2ZXMgYXBwZW5kcy5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmVhdHVyZSgnTUVTU0FHRV9BQ1RJT05TJykgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICFkaXNhYmxlTWVzc2FnZUFjdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGVudGVyTWVzc2FnZUFjdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbWNwQ2xpZW50cz17bWNwQ2xpZW50c31cbiAgICAgICAgICAgICAgICAgICAgICAgIHBhc3RlZENvbnRlbnRzPXtwYXN0ZWRDb250ZW50c31cbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFBhc3RlZENvbnRlbnRzPXtzZXRQYXN0ZWRDb250ZW50c31cbiAgICAgICAgICAgICAgICAgICAgICAgIHZpbU1vZGU9e3ZpbU1vZGV9XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRWaW1Nb2RlPXtzZXRWaW1Nb2RlfVxuICAgICAgICAgICAgICAgICAgICAgICAgc2hvd0Jhc2hlc0RpYWxvZz17c2hvd0Jhc2hlc0RpYWxvZ31cbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dCYXNoZXNEaWFsb2c9e3NldFNob3dCYXNoZXNEaWFsb2d9XG4gICAgICAgICAgICAgICAgICAgICAgICBvblN1Ym1pdD17b25TdWJtaXR9XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkFnZW50U3VibWl0PXtvbkFnZW50U3VibWl0fVxuICAgICAgICAgICAgICAgICAgICAgICAgaXNTZWFyY2hpbmdIaXN0b3J5PXtpc1NlYXJjaGluZ0hpc3Rvcnl9XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRJc1NlYXJjaGluZ0hpc3Rvcnk9e3NldElzU2VhcmNoaW5nSGlzdG9yeX1cbiAgICAgICAgICAgICAgICAgICAgICAgIGhlbHBPcGVuPXtpc0hlbHBPcGVufVxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0SGVscE9wZW49e3NldElzSGVscE9wZW59XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnNlcnRUZXh0UmVmPXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmVhdHVyZSgnVk9JQ0VfTU9ERScpID8gaW5zZXJ0VGV4dFJlZiA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdm9pY2VJbnRlcmltUmFuZ2U9e3ZvaWNlLmludGVyaW1SYW5nZX1cbiAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxTZXNzaW9uQmFja2dyb3VuZEhpbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQmFja2dyb3VuZFNlc3Npb249e2hhbmRsZUJhY2tncm91bmRTZXNzaW9ufVxuICAgICAgICAgICAgICAgICAgICAgICAgaXNMb2FkaW5nPXtpc0xvYWRpbmd9XG4gICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHtjdXJzb3IgJiYgKFxuICAgICAgICAgICAgICAgICAgLy8gaW5wdXRWYWx1ZSBpcyBSRVBMIHN0YXRlOyB0eXBlZCB0ZXh0IHN1cnZpdmVzIHRoZSByb3VuZC10cmlwLlxuICAgICAgICAgICAgICAgICAgPE1lc3NhZ2VBY3Rpb25zQmFyIGN1cnNvcj17Y3Vyc29yfSAvPlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAge2ZvY3VzZWRJbnB1dERpYWxvZyA9PT0gJ21lc3NhZ2Utc2VsZWN0b3InICYmIChcbiAgICAgICAgICAgICAgICAgIDxNZXNzYWdlU2VsZWN0b3JcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZXM9e21lc3NhZ2VzfVxuICAgICAgICAgICAgICAgICAgICBwcmVzZWxlY3RlZE1lc3NhZ2U9e21lc3NhZ2VTZWxlY3RvclByZXNlbGVjdH1cbiAgICAgICAgICAgICAgICAgICAgb25QcmVSZXN0b3JlPXtvbkNhbmNlbH1cbiAgICAgICAgICAgICAgICAgICAgb25SZXN0b3JlQ29kZT17YXN5bmMgKG1lc3NhZ2U6IFVzZXJNZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgYXdhaXQgZmlsZUhpc3RvcnlSZXdpbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZXI6IChwcmV2OiBGaWxlSGlzdG9yeVN0YXRlKSA9PiBGaWxlSGlzdG9yeVN0YXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVIaXN0b3J5OiB1cGRhdGVyKHByZXYuZmlsZUhpc3RvcnkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlLnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICBvblN1bW1hcml6ZT17YXN5bmMgKFxuICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFVzZXJNZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgIGZlZWRiYWNrPzogc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogUGFydGlhbENvbXBhY3REaXJlY3Rpb24gPSAnZnJvbScsXG4gICAgICAgICAgICAgICAgICAgICkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIFByb2plY3Qgc25pcHBlZCBtZXNzYWdlcyBzbyB0aGUgY29tcGFjdCBtb2RlbFxuICAgICAgICAgICAgICAgICAgICAgIC8vIGRvZXNuJ3Qgc3VtbWFyaXplIGNvbnRlbnQgdGhhdCB3YXMgaW50ZW50aW9uYWxseSByZW1vdmVkLlxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBhY3RNZXNzYWdlcyA9XG4gICAgICAgICAgICAgICAgICAgICAgICBnZXRNZXNzYWdlc0FmdGVyQ29tcGFjdEJvdW5kYXJ5KG1lc3NhZ2VzKVxuXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZUluZGV4ID0gY29tcGFjdE1lc3NhZ2VzLmluZGV4T2YobWVzc2FnZSlcbiAgICAgICAgICAgICAgICAgICAgICBpZiAobWVzc2FnZUluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2VsZWN0ZWQgYSBzbmlwcGVkIG9yIHByZS1jb21wYWN0IG1lc3NhZ2UgdGhhdCB0aGVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlbGVjdG9yIHN0aWxsIHNob3dzIChSRVBMIGtlZXBzIGZ1bGwgaGlzdG9yeSBmb3JcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNjcm9sbGJhY2spLiBTdXJmYWNlIHdoeSBub3RoaW5nIGhhcHBlbmVkIGluc3RlYWRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9mIHNpbGVudGx5IG5vLW9waW5nLlxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0TWVzc2FnZXMocHJldiA9PiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZVN5c3RlbU1lc3NhZ2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1RoYXQgbWVzc2FnZSBpcyBubyBsb25nZXIgaW4gdGhlIGFjdGl2ZSBjb250ZXh0IChzbmlwcGVkIG9yIHByZS1jb21wYWN0KS4gQ2hvb3NlIGEgbW9yZSByZWNlbnQgbWVzc2FnZS4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICd3YXJuaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIF0pXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdBYm9ydENvbnRyb2xsZXIgPSBjcmVhdGVBYm9ydENvbnRyb2xsZXIoKVxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBnZXRUb29sVXNlQ29udGV4dChcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBhY3RNZXNzYWdlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3QWJvcnRDb250cm9sbGVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWFpbkxvb3BNb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhcHBTdGF0ZSA9IGNvbnRleHQuZ2V0QXBwU3RhdGUoKVxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRTeXNQcm9tcHQgPSBhd2FpdCBnZXRTeXN0ZW1Qcm9tcHQoXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lm9wdGlvbnMudG9vbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lm9wdGlvbnMubWFpbkxvb3BNb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIEFycmF5LmZyb20oXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFwcFN0YXRlLnRvb2xQZXJtaXNzaW9uQ29udGV4dC5hZGRpdGlvbmFsV29ya2luZ0RpcmVjdG9yaWVzLmtleXMoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0Lm9wdGlvbnMubWNwQ2xpZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3lzdGVtUHJvbXB0ID0gYnVpbGRFZmZlY3RpdmVTeXN0ZW1Qcm9tcHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbjogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbFVzZUNvbnRleHQ6IGNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXN0b21TeXN0ZW1Qcm9tcHQ6IGNvbnRleHQub3B0aW9ucy5jdXN0b21TeXN0ZW1Qcm9tcHQsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0U3lzdGVtUHJvbXB0OiBkZWZhdWx0U3lzUHJvbXB0LFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwZW5kU3lzdGVtUHJvbXB0OiBjb250ZXh0Lm9wdGlvbnMuYXBwZW5kU3lzdGVtUHJvbXB0LFxuICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgW3VzZXJDb250ZXh0LCBzeXN0ZW1Db250ZXh0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdldFVzZXJDb250ZXh0KCksXG4gICAgICAgICAgICAgICAgICAgICAgICBnZXRTeXN0ZW1Db250ZXh0KCksXG4gICAgICAgICAgICAgICAgICAgICAgXSlcblxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHBhcnRpYWxDb21wYWN0Q29udmVyc2F0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcGFjdE1lc3NhZ2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZUluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3lzdGVtUHJvbXB0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VyQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3lzdGVtQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdG9vbFVzZUNvbnRleHQ6IGNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZvcmtDb250ZXh0TWVzc2FnZXM6IGNvbXBhY3RNZXNzYWdlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBmZWVkYmFjayxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXB0ID0gcmVzdWx0Lm1lc3NhZ2VzVG9LZWVwID8/IFtdXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3JkZXJlZCA9XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXJlY3Rpb24gPT09ICd1cF90bydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPyBbLi4ucmVzdWx0LnN1bW1hcnlNZXNzYWdlcywgLi4ua2VwdF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiBbLi4ua2VwdCwgLi4ucmVzdWx0LnN1bW1hcnlNZXNzYWdlc11cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3N0Q29tcGFjdCA9IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5ib3VuZGFyeU1hcmtlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLm9yZGVyZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5yZXN1bHQuYXR0YWNobWVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi5yZXN1bHQuaG9va1Jlc3VsdHMsXG4gICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgIC8vIEZ1bGxzY3JlZW4gJ2Zyb20nIGtlZXBzIHNjcm9sbGJhY2s7ICd1cF90bycgbXVzdCBub3RcbiAgICAgICAgICAgICAgICAgICAgICAvLyAob2xkWzBdIHVuY2hhbmdlZCArIGdyb3duIGFycmF5IG1lYW5zIGluY3JlbWVudGFsXG4gICAgICAgICAgICAgICAgICAgICAgLy8gdXNlTG9nTWVzc2FnZXMgcGF0aCwgc28gYm91bmRhcnkgbmV2ZXIgcGVyc2lzdGVkKS5cbiAgICAgICAgICAgICAgICAgICAgICAvLyBGaW5kIGJ5IHV1aWQgc2luY2Ugb2xkIGlzIHJhdyBSRVBMIGhpc3RvcnkgYW5kIHNuaXBwZWRcbiAgICAgICAgICAgICAgICAgICAgICAvLyBlbnRyaWVzIGNhbiBzaGlmdCB0aGUgcHJvamVjdGVkIG1lc3NhZ2VJbmRleC5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpICYmIGRpcmVjdGlvbiA9PT0gJ2Zyb20nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRNZXNzYWdlcyhvbGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByYXdJZHggPSBvbGQuZmluZEluZGV4KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG0gPT4gbS51dWlkID09PSBtZXNzYWdlLnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuLi5vbGQuc2xpY2UoMCwgcmF3SWR4ID09PSAtMSA/IDAgOiByYXdJZHgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnBvc3RDb21wYWN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRNZXNzYWdlcyhwb3N0Q29tcGFjdClcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgLy8gUGFydGlhbCBjb21wYWN0IGJ5cGFzc2VzIGhhbmRsZU1lc3NhZ2VGcm9tU3RyZWFtIOKAlCBjbGVhclxuICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBjb250ZXh0LWJsb2NrZWQgZmxhZyBzbyBwcm9hY3RpdmUgdGlja3MgcmVzdW1lLlxuICAgICAgICAgICAgICAgICAgICAgIGlmIChmZWF0dXJlKCdQUk9BQ1RJVkUnKSB8fCBmZWF0dXJlKCdLQUlST1MnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvYWN0aXZlTW9kdWxlPy5zZXRDb250ZXh0QmxvY2tlZChmYWxzZSlcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgc2V0Q29udmVyc2F0aW9uSWQocmFuZG9tVVVJRCgpKVxuICAgICAgICAgICAgICAgICAgICAgIHJ1blBvc3RDb21wYWN0Q2xlYW51cChjb250ZXh0Lm9wdGlvbnMucXVlcnlTb3VyY2UpXG5cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoZGlyZWN0aW9uID09PSAnZnJvbScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHIgPSB0ZXh0Rm9yUmVzdWJtaXQobWVzc2FnZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldElucHV0VmFsdWUoci50ZXh0KVxuICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRJbnB1dE1vZGUoci5tb2RlKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgIC8vIFNob3cgbm90aWZpY2F0aW9uIHdpdGggY3RybCtvIGhpbnRcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoaXN0b3J5U2hvcnRjdXQgPSBnZXRTaG9ydGN1dERpc3BsYXkoXG4gICAgICAgICAgICAgICAgICAgICAgICAnYXBwOnRvZ2dsZVRyYW5zY3JpcHQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0dsb2JhbCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAnY3RybCtvJyxcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleTogJ3N1bW1hcml6ZS1jdHJsLW8taGludCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiBgQ29udmVyc2F0aW9uIHN1bW1hcml6ZWQgKCR7aGlzdG9yeVNob3J0Y3V0fSBmb3IgaGlzdG9yeSlgLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHk6ICdtZWRpdW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dE1zOiA4MDAwLFxuICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgIG9uUmVzdG9yZU1lc3NhZ2U9e2hhbmRsZVJlc3RvcmVNZXNzYWdlfVxuICAgICAgICAgICAgICAgICAgICBvbkNsb3NlPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgc2V0SXNNZXNzYWdlU2VsZWN0b3JWaXNpYmxlKGZhbHNlKVxuICAgICAgICAgICAgICAgICAgICAgIHNldE1lc3NhZ2VTZWxlY3RvclByZXNlbGVjdCh1bmRlZmluZWQpXG4gICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAge1wiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgPERldkJhciAvPn1cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgIHtmZWF0dXJlKCdCVUREWScpICYmXG4gICAgICAgICAgICAgICEoY29tcGFuaW9uTmFycm93ICYmIGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSkgJiZcbiAgICAgICAgICAgICAgY29tcGFuaW9uVmlzaWJsZSA/IChcbiAgICAgICAgICAgICAgICA8Q29tcGFuaW9uU3ByaXRlIC8+XG4gICAgICAgICAgICAgICkgOiBudWxsfVxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgfVxuICAgICAgICAvPlxuICAgICAgPC9NQ1BDb25uZWN0aW9uTWFuYWdlcj5cbiAgICA8L0tleWJpbmRpbmdTZXR1cD5cbiAgKVxuICBpZiAoaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxBbHRlcm5hdGVTY3JlZW4gbW91c2VUcmFja2luZz17aXNNb3VzZVRyYWNraW5nRW5hYmxlZCgpfT5cbiAgICAgICAge21haW5SZXR1cm59XG4gICAgICA8L0FsdGVybmF0ZVNjcmVlbj5cbiAgICApXG4gIH1cbiAgcmV0dXJuIG1haW5SZXR1cm5cbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0EsU0FBU0EsT0FBTyxRQUFRLFlBQVk7QUFDcEMsU0FBU0MsU0FBUyxRQUFRLGVBQWU7QUFDekMsU0FDRUMsMkJBQTJCLEVBQzNCQyx5QkFBeUIsRUFDekJDLG1CQUFtQixFQUNuQkMsMEJBQTBCLEVBQzFCQyxtQkFBbUIsUUFDZCx1QkFBdUI7QUFDOUIsU0FBU0MsZ0JBQWdCLFFBQVEseUJBQXlCO0FBQzFELFNBQVNDLEtBQUssUUFBUSxtQkFBbUI7QUFDekMs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