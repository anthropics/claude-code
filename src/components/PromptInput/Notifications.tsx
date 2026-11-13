import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import * as React from 'react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { type Notification, useNotifications } from 'src/context/notifications.js';
import { logEvent } from 'src/services/analytics/index.js';
import { useAppState } from 'src/state/AppState.js';
import { useVoiceState } from '../../context/voice.js';
import type { VerificationStatus } from '../../hooks/useApiKeyVerification.js';
import { useIdeConnectionStatus } from '../../hooks/useIdeConnectionStatus.js';
import type { IDESelection } from '../../hooks/useIdeSelection.js';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { useVoiceEnabled } from '../../hooks/useVoiceEnabled.js';
import { Box, Text } from '../../ink.js';
import { useClaudeAiLimits } from '../../services/claudeAiLimitsHook.js';
import { calculateTokenWarningState } from '../../services/compact/autoCompact.js';
import type { MCPServerConnection } from '../../services/mcp/types.js';
import type { Message } from '../../types/message.js';
import { getApiKeyHelperElapsedMs, getConfiguredApiKeyHelper, getSubscriptionType } from '../../utils/auth.js';
import type { AutoUpdaterResult } from '../../utils/autoUpdater.js';
import { getExternalEditor } from '../../utils/editor.js';
import { isEnvTruthy } from '../../utils/envUtils.js';
import { formatDuration } from '../../utils/format.js';
import { setEnvHookNotifier } from '../../utils/hooks/fileChangedWatcher.js';
import { toIDEDisplayName } from '../../utils/ide.js';
import { getMessagesAfterCompactBoundary } from '../../utils/messages.js';
import { tokenCountFromLastAPIResponse } from '../../utils/tokens.js';
import { AutoUpdaterWrapper } from '../AutoUpdaterWrapper.js';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js';
import { IdeStatusIndicator } from '../IdeStatusIndicator.js';
import { MemoryUsageIndicator } from '../MemoryUsageIndicator.js';
import { SentryErrorBoundary } from '../SentryErrorBoundary.js';
import { TokenWarning } from '../TokenWarning.js';
import { SandboxPromptFooterHint } from './SandboxPromptFooterHint.js';

/* eslint-disable @typescript-eslint/no-require-imports */
const VoiceIndicator: typeof import('./VoiceIndicator.js').VoiceIndicator = feature('VOICE_MODE') ? require('./VoiceIndicator.js').VoiceIndicator : () => null;
/* eslint-enable @typescript-eslint/no-require-imports */

export const FOOTER_TEMPORARY_STATUS_TIMEOUT = 5000;
type Props = {
  apiKeyStatus: VerificationStatus;
  autoUpdaterResult: AutoUpdaterResult | null;
  isAutoUpdating: boolean;
  debug: boolean;
  verbose: boolean;
  messages: Message[];
  onAutoUpdaterResult: (result: AutoUpdaterResult) => void;
  onChangeIsUpdating: (isUpdating: boolean) => void;
  ideSelection: IDESelection | undefined;
  mcpClients?: MCPServerConnection[];
  isInputWrapped?: boolean;
  isNarrow?: boolean;
};
export function Notifications(t0) {
  const $ = _c(34);
  const {
    apiKeyStatus,
    autoUpdaterResult,
    debug,
    isAutoUpdating,
    verbose,
    messages,
    onAutoUpdaterResult,
    onChangeIsUpdating,
    ideSelection,
    mcpClients,
    isInputWrapped: t1,
    isNarrow: t2
  } = t0;
  const isInputWrapped = t1 === undefined ? false : t1;
  const isNarrow = t2 === undefined ? false : t2;
  let t3;
  if ($[0] !== messages) {
    const messagesForTokenCount = getMessagesAfterCompactBoundary(messages);
    t3 = tokenCountFromLastAPIResponse(messagesForTokenCount);
    $[0] = messages;
    $[1] = t3;
  } else {
    t3 = $[1];
  }
  const tokenUsage = t3;
  const mainLoopModel = useMainLoopModel();
  let t4;
  if ($[2] !== mainLoopModel || $[3] !== tokenUsage) {
    t4 = calculateTokenWarningState(tokenUsage, mainLoopModel);
    $[2] = mainLoopModel;
    $[3] = tokenUsage;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  const isShowingCompactMessage = t4.isAboveWarningThreshold;
  const {
    status: ideStatus
  } = useIdeConnectionStatus(mcpClients);
  const notifications = useAppState(_temp);
  const {
    addNotification,
    removeNotification
  } = useNotifications();
  const claudeAiLimits = useClaudeAiLimits();
  let t5;
  let t6;
  if ($[5] !== addNotification) {
    t5 = () => {
      setEnvHookNotifier((text, isError) => {
        addNotification({
          key: "env-hook",
          text,
          color: isError ? "error" : undefined,
          priority: isError ? "medium" : "low",
          timeoutMs: isError ? 8000 : 5000
        });
      });
      return _temp2;
    };
    t6 = [addNotification];
    $[5] = addNotification;
    $[6] = t5;
    $[7] = t6;
  } else {
    t5 = $[6];
    t6 = $[7];
  }
  useEffect(t5, t6);
  const shouldShowIdeSelection = ideStatus === "connected" && (ideSelection?.filePath || ideSelection?.text && ideSelection.lineCount > 0);
  const shouldShowAutoUpdater = !shouldShowIdeSelection || isAutoUpdating || autoUpdaterResult?.status !== "success";
  const isInOverageMode = claudeAiLimits.isUsingOverage;
  let t7;
  if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
    t7 = getSubscriptionType();
    $[8] = t7;
  } else {
    t7 = $[8];
  }
  const subscriptionType = t7;
  const isTeamOrEnterprise = subscriptionType === "team" || subscriptionType === "enterprise";
  let t8;
  if ($[9] === Symbol.for("react.memo_cache_sentinel")) {
    t8 = getExternalEditor();
    $[9] = t8;
  } else {
    t8 = $[9];
  }
  const editor = t8;
  const shouldShowExternalEditorHint = isInputWrapped && !isShowingCompactMessage && apiKeyStatus !== "invalid" && apiKeyStatus !== "missing" && editor !== undefined;
  let t10;
  let t9;
  if ($[10] !== addNotification || $[11] !== removeNotification || $[12] !== shouldShowExternalEditorHint) {
    t9 = () => {
      if (shouldShowExternalEditorHint && editor) {
        logEvent("tengu_external_editor_hint_shown", {});
        addNotification({
          key: "external-editor-hint",
          jsx: <Text dimColor={true}><ConfigurableShortcutHint action="chat:externalEditor" context="Chat" fallback="ctrl+g" description={`edit in ${toIDEDisplayName(editor)}`} /></Text>,
          priority: "immediate",
          timeoutMs: 5000
        });
      } else {
        removeNotification("external-editor-hint");
      }
    };
    t10 = [shouldShowExternalEditorHint, editor, addNotification, removeNotification];
    $[10] = addNotification;
    $[11] = removeNotification;
    $[12] = shouldShowExternalEditorHint;
    $[13] = t10;
    $[14] = t9;
  } else {
    t10 = $[13];
    t9 = $[14];
  }
  useEffect(t9, t10);
  const t11 = isNarrow ? "flex-start" : "flex-end";
  const t12 = isInOverageMode ?? false;
  let t13;
  if ($[15] !== apiKeyStatus || $[16] !== autoUpdaterResult || $[17] !== debug || $[18] !== ideSelection || $[19] !== isAutoUpdating || $[20] !== isShowingCompactMessage || $[21] !== mainLoopModel || $[22] !== mcpClients || $[23] !== notifications || $[24] !== onAutoUpdaterResult || $[25] !== onChangeIsUpdating || $[26] !== shouldShowAutoUpdater || $[27] !== t12 || $[28] !== tokenUsage || $[29] !== verbose) {
    t13 = <NotificationContent ideSelection={ideSelection} mcpClients={mcpClients} notifications={notifications} isInOverageMode={t12} isTeamOrEnterprise={isTeamOrEnterprise} apiKeyStatus={apiKeyStatus} debug={debug} verbose={verbose} tokenUsage={tokenUsage} mainLoopModel={mainLoopModel} shouldShowAutoUpdater={shouldShowAutoUpdater} autoUpdaterResult={autoUpdaterResult} isAutoUpdating={isAutoUpdating} isShowingCompactMessage={isShowingCompactMessage} onAutoUpdaterResult={onAutoUpdaterResult} onChangeIsUpdating={onChangeIsUpdating} />;
    $[15] = apiKeyStatus;
    $[16] = autoUpdaterResult;
    $[17] = debug;
    $[18] = ideSelection;
    $[19] = isAutoUpdating;
    $[20] = isShowingCompactMessage;
    $[21] = mainLoopModel;
    $[22] = mcpClients;
    $[23] = notifications;
    $[24] = onAutoUpdaterResult;
    $[25] = onChangeIsUpdating;
    $[26] = shouldShowAutoUpdater;
    $[27] = t12;
    $[28] = tokenUsage;
    $[29] = verbose;
    $[30] = t13;
  } else {
    t13 = $[30];
  }
  let t14;
  if ($[31] !== t11 || $[32] !== t13) {
    t14 = <SentryErrorBoundary><Box flexDirection="column" alignItems={t11} flexShrink={0} overflowX="hidden">{t13}</Box></SentryErrorBoundary>;
    $[31] = t11;
    $[32] = t13;
    $[33] = t14;
  } else {
    t14 = $[33];
  }
  return t14;
}
function _temp2() {
  return setEnvHookNotifier(null);
}
function _temp(s) {
  return s.notifications;
}
function NotificationContent({
  ideSelection,
  mcpClients,
  notifications,
  isInOverageMode,
  isTeamOrEnterprise,
  apiKeyStatus,
  debug,
  verbose,
  tokenUsage,
  mainLoopModel,
  shouldShowAutoUpdater,
  autoUpdaterResult,
  isAutoUpdating,
  isShowingCompactMessage,
  onAutoUpdaterResult,
  onChangeIsUpdating
}: {
  ideSelection: IDESelection | undefined;
  mcpClients?: MCPServerConnection[];
  notifications: {
    current: Notification | null;
    queue: Notification[];
  };
  isInOverageMode: boolean;
  isTeamOrEnterprise: boolean;
  apiKeyStatus: VerificationStatus;
  debug: boolean;
  verbose: boolean;
  tokenUsage: number;
  mainLoopModel: string;
  shouldShowAutoUpdater: boolean;
  autoUpdaterResult: AutoUpdaterResult | null;
  isAutoUpdating: boolean;
  isShowingCompactMessage: boolean;
  onAutoUpdaterResult: (result: AutoUpdaterResult) => void;
  onChangeIsUpdating: (isUpdating: boolean) => void;
}): ReactNode {
  // Poll apiKeyHelper inflight state to show slow-helper notice.
  // Gated on configuration — most users never set apiKeyHelper, so the
  // effect is a no-op for them (no interval allocated).
  const [apiKeyHelperSlow, setApiKeyHelperSlow] = useState<string | null>(null);
  useEffect(() => {
    if (!getConfiguredApiKeyHelper()) return;
    const interval = setInterval((setSlow: React.Dispatch<React.SetStateAction<string | null>>) => {
      const ms = getApiKeyHelperElapsedMs();
      const next = ms >= 10_000 ? formatDuration(ms) : null;
      setSlow(prev => next === prev ? prev : next);
    }, 1000, setApiKeyHelperSlow);
    return () => clearInterval(interval);
  }, []);

  // Voice state (VOICE_MODE builds only, runtime-gated by GrowthBook)
  const voiceState = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useVoiceState(s => s.voiceState) : 'idle' as const;
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const voiceEnabled = feature('VOICE_MODE') ? useVoiceEnabled() : false;
  const voiceError = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useVoiceState(s_0 => s_0.voiceError) : null;
  const isBriefOnly = feature('KAIROS') || feature('KAIROS_BRIEF') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useAppState(s_1 => s_1.isBriefOnly) : false;

  // When voice is actively recording or processing, replace all
  // notifications with just the voice indicator.
  if (feature('VOICE_MODE') && voiceEnabled && (voiceState === 'recording' || voiceState === 'processing')) {
    return <VoiceIndicator voiceState={voiceState} />;
  }
  return <>
      <IdeStatusIndicator ideSelection={ideSelection} mcpClients={mcpClients} />
      {notifications.current && ('jsx' in notifications.current ? <Text wrap="truncate" key={notifications.current.key}>
            {notifications.current.jsx}
          </Text> : <Text color={notifications.current.color} dimColor={!notifications.current.color} wrap="truncate">
            {notifications.current.text}
          </Text>)}
      {isInOverageMode && !isTeamOrEnterprise && <Box>
          <Text dimColor wrap="truncate">
            Now using extra usage
          </Text>
        </Box>}
      {apiKeyHelperSlow && <Box>
          <Text color="warning" wrap="truncate">
            apiKeyHelper is taking a while{' '}
          </Text>
          <Text dimColor wrap="truncate">
            ({apiKeyHelperSlow})
          </Text>
        </Box>}
      {(apiKeyStatus === 'invalid' || apiKeyStatus === 'missing') && <Box>
          <Text color="error" wrap="truncate">
            {isEnvTruthy(process.env.CLAUDE_CODE_REMOTE) ? 'Authentication error · Try again' : 'Not logged in · Run /login'}
          </Text>
        </Box>}
      {debug && <Box>
          <Text color="warning" wrap="truncate">
            Debug mode
          </Text>
        </Box>}
      {apiKeyStatus !== 'invalid' && apiKeyStatus !== 'missing' && verbose && <Box>
          <Text dimColor wrap="truncate">
            {tokenUsage} tokens
          </Text>
        </Box>}
      {!isBriefOnly && <TokenWarning tokenUsage={tokenUsage} model={mainLoopModel} />}
      {shouldShowAutoUpdater && <AutoUpdaterWrapper verbose={verbose} onAutoUpdaterResult={onAutoUpdaterResult} autoUpdaterResult={autoUpdaterResult} isUpdating={isAutoUpdating} onChangeIsUpdating={onChangeIsUpdating} showSuccessMessage={!isShowingCompactMessage} />}
      {feature('VOICE_MODE') ? voiceEnabled && voiceError && <Box>
              <Text color="error" wrap="truncate">
                {voiceError}
              </Text>
            </Box> : null}
      <MemoryUsageIndicator />
      <SandboxPromptFooterHint />
    </>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiUmVhY3QiLCJSZWFjdE5vZGUiLCJ1c2VFZmZlY3QiLCJ1c2VNZW1vIiwidXNlU3RhdGUiLCJOb3RpZmljYXRpb24iLCJ1c2VOb3RpZmljYXRpb25zIiwibG9nRXZlbnQiLCJ1c2VBcHBTdGF0ZSIsInVzZVZvaWNlU3RhdGUiLCJWZXJpZmljYXRpb25TdGF0dXMiLCJ1c2VJZGVDb25uZWN0aW9uU3RhdHVzIiwiSURFU2VsZWN0aW9uIiwidXNlTWFpbkxvb3BNb2RlbCIsInVzZVZvaWNlRW5hYmxlZCIsIkJveCIsIlRleHQiLCJ1c2VDbGF1ZGVBaUxpbWl0cyIsImNhbGN1bGF0ZVRva2VuV2FybmluZ1N0YXRlIiwiTUNQU2VydmVyQ29ubmVjdGlvbiIsIk1lc3NhZ2UiLCJnZXRBcGlLZXlIZWxwZXJFbGFwc2VkTXMiLCJnZXRDb25maWd1cmVkQXBpS2V5SGVscGVyIiwiZ2V0U3Vic2NyaXB0aW9uVHlwZSIsIkF1dG9VcGRhdGVyUmVzdWx0IiwiZ2V0RXh0ZXJuYWxFZGl0b3IiLCJpc0VudlRydXRoeSIsImZvcm1hdER1cmF0aW9uIiwic2V0RW52SG9va05vdGlmaWVyIiwidG9JREVEaXNwbGF5TmFtZSIsImdldE1lc3NhZ2VzQWZ0ZXJDb21wYWN0Qm91bmRhcnkiLCJ0b2tlbkNvdW50RnJvbUxhc3RBUElSZXNwb25zZSIsIkF1dG9VcGRhdGVyV3JhcHBlciIsIkNvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCIsIklkZVN0YXR1c0luZGljYXRvciIsIk1lbW9yeVVzYWdlSW5kaWNhdG9yIiwiU2VudHJ5RXJyb3JCb3VuZGFyeSIsIlRva2VuV2FybmluZyIsIlNhbmRib3hQcm9tcHRGb290ZXJIaW50IiwiVm9pY2VJbmRpY2F0b3IiLCJyZXF1aXJlIiwiRk9PVEVSX1RFTVBPUkFSWV9TVEFUVVNfVElNRU9VVCIsIlByb3BzIiwiYXBpS2V5U3RhdHVzIiwiYXV0b1VwZGF0ZXJSZXN1bHQiLCJpc0F1dG9VcGRhdGluZyIsImRlYnVnIiwidmVyYm9zZSIsIm1lc3NhZ2VzIiwib25BdXRvVXBkYXRlclJlc3VsdCIsInJlc3VsdCIsIm9uQ2hhbmdlSXNVcGRhdGluZyIsImlzVXBkYXRpbmciLCJpZGVTZWxlY3Rpb24iLCJtY3BDbGllbnRzIiwiaXNJbnB1dFdyYXBwZWQiLCJpc05hcnJvdyIsIk5vdGlmaWNhdGlvbnMiLCJ0MCIsIiQiLCJfYyIsInQxIiwidDIiLCJ1bmRlZmluZWQiLCJ0MyIsIm1lc3NhZ2VzRm9yVG9rZW5Db3VudCIsInRva2VuVXNhZ2UiLCJtYWluTG9vcE1vZGVsIiwidDQiLCJpc1Nob3dpbmdDb21wYWN0TWVzc2FnZSIsImlzQWJvdmVXYXJuaW5nVGhyZXNob2xkIiwic3RhdHVzIiwiaWRlU3RhdHVzIiwibm90aWZpY2F0aW9ucyIsIl90ZW1wIiwiYWRkTm90aWZpY2F0aW9uIiwicmVtb3ZlTm90aWZpY2F0aW9uIiwiY2xhdWRlQWlMaW1pdHMiLCJ0NSIsInQ2IiwidGV4dCIsImlzRXJyb3IiLCJrZXkiLCJjb2xvciIsInByaW9yaXR5IiwidGltZW91dE1zIiwiX3RlbXAyIiwic2hvdWxkU2hvd0lkZVNlbGVjdGlvbiIsImZpbGVQYXRoIiwibGluZUNvdW50Iiwic2hvdWxkU2hvd0F1dG9VcGRhdGVyIiwiaXNJbk92ZXJhZ2VNb2RlIiwiaXNVc2luZ092ZXJhZ2UiLCJ0NyIsIlN5bWJvbCIsImZvciIsInN1YnNjcmlwdGlvblR5cGUiLCJpc1RlYW1PckVudGVycHJpc2UiLCJ0OCIsImVkaXRvciIsInNob3VsZFNob3dFeHRlcm5hbEVkaXRvckhpbnQiLCJ0MTAiLCJ0OSIsImpzeCIsInQxMSIsInQxMiIsInQxMyIsInQxNCIsInMiLCJOb3RpZmljYXRpb25Db250ZW50IiwiY3VycmVudCIsInF1ZXVlIiwiYXBpS2V5SGVscGVyU2xvdyIsInNldEFwaUtleUhlbHBlclNsb3ciLCJpbnRlcnZhbCIsInNldEludGVydmFsIiwic2V0U2xvdyIsIkRpc3BhdGNoIiwiU2V0U3RhdGVBY3Rpb24iLCJtcyIsIm5leHQiLCJwcmV2IiwiY2xlYXJJbnRlcnZhbCIsInZvaWNlU3RhdGUiLCJjb25zdCIsInZvaWNlRW5hYmxlZCIsInZvaWNlRXJyb3IiLCJpc0JyaWVmT25seSIsInByb2Nlc3MiLCJlbnYiLCJDTEFVREVfQ09ERV9SRU1PVEUiXSwic291cmNlcyI6WyJOb3RpZmljYXRpb25zLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdHlwZSBSZWFjdE5vZGUsIHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7XG4gIHR5cGUgTm90aWZpY2F0aW9uLFxuICB1c2VOb3RpZmljYXRpb25zLFxufSBmcm9tICdzcmMvY29udGV4dC9ub3RpZmljYXRpb25zLmpzJ1xuaW1wb3J0IHsgbG9nRXZlbnQgfSBmcm9tICdzcmMvc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJ1xuaW1wb3J0IHsgdXNlQXBwU3RhdGUgfSBmcm9tICdzcmMvc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgeyB1c2VWb2ljZVN0YXRlIH0gZnJvbSAnLi4vLi4vY29udGV4dC92b2ljZS5qcydcbmltcG9ydCB0eXBlIHsgVmVyaWZpY2F0aW9uU3RhdHVzIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlQXBpS2V5VmVyaWZpY2F0aW9uLmpzJ1xuaW1wb3J0IHsgdXNlSWRlQ29ubmVjdGlvblN0YXR1cyB9IGZyb20gJy4uLy4uL2hvb2tzL3VzZUlkZUNvbm5lY3Rpb25TdGF0dXMuanMnXG5pbXBvcnQgdHlwZSB7IElERVNlbGVjdGlvbiB9IGZyb20gJy4uLy4uL2hvb2tzL3VzZUlkZVNlbGVjdGlvbi5qcydcbmltcG9ydCB7IHVzZU1haW5Mb29wTW9kZWwgfSBmcm9tICcuLi8uLi9ob29rcy91c2VNYWluTG9vcE1vZGVsLmpzJ1xuaW1wb3J0IHsgdXNlVm9pY2VFbmFibGVkIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlVm9pY2VFbmFibGVkLmpzJ1xuaW1wb3J0IHsgQm94LCBUZXh0IH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlQ2xhdWRlQWlMaW1pdHMgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9jbGF1ZGVBaUxpbWl0c0hvb2suanMnXG5pbXBvcnQgeyBjYWxjdWxhdGVUb2tlbldhcm5pbmdTdGF0ZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2NvbXBhY3QvYXV0b0NvbXBhY3QuanMnXG5pbXBvcnQgdHlwZSB7IE1DUFNlcnZlckNvbm5lY3Rpb24gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tY3AvdHlwZXMuanMnXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UgfSBmcm9tICcuLi8uLi90eXBlcy9tZXNzYWdlLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0QXBpS2V5SGVscGVyRWxhcHNlZE1zLFxuICBnZXRDb25maWd1cmVkQXBpS2V5SGVscGVyLFxuICBnZXRTdWJzY3JpcHRpb25UeXBlLFxufSBmcm9tICcuLi8uLi91dGlscy9hdXRoLmpzJ1xuaW1wb3J0IHR5cGUgeyBBdXRvVXBkYXRlclJlc3VsdCB9IGZyb20gJy4uLy4uL3V0aWxzL2F1dG9VcGRhdGVyLmpzJ1xuaW1wb3J0IHsgZ2V0RXh0ZXJuYWxFZGl0b3IgfSBmcm9tICcuLi8uLi91dGlscy9lZGl0b3IuanMnXG5pbXBvcnQgeyBpc0VudlRydXRoeSB9IGZyb20gJy4uLy4uL3V0aWxzL2VudlV0aWxzLmpzJ1xuaW1wb3J0IHsgZm9ybWF0RHVyYXRpb24gfSBmcm9tICcuLi8uLi91dGlscy9mb3JtYXQuanMnXG5pbXBvcnQgeyBzZXRFbnZIb29rTm90aWZpZXIgfSBmcm9tICcuLi8uLi91dGlscy9ob29rcy9maWxlQ2hhbmdlZFdhdGNoZXIuanMnXG5pbXBvcnQgeyB0b0lERURpc3BsYXlOYW1lIH0gZnJvbSAnLi4vLi4vdXRpbHMvaWRlLmpzJ1xuaW1wb3J0IHsgZ2V0TWVzc2FnZXNBZnRlckNvbXBhY3RCb3VuZGFyeSB9IGZyb20gJy4uLy4uL3V0aWxzL21lc3NhZ2VzLmpzJ1xuaW1wb3J0IHsgdG9rZW5Db3VudEZyb21MYXN0QVBJUmVzcG9uc2UgfSBmcm9tICcuLi8uLi91dGlscy90b2tlbnMuanMnXG5pbXBvcnQgeyBBdXRvVXBkYXRlcldyYXBwZXIgfSBmcm9tICcuLi9BdXRvVXBkYXRlcldyYXBwZXIuanMnXG5pbXBvcnQgeyBDb25maWd1cmFibGVTaG9ydGN1dEhpbnQgfSBmcm9tICcuLi9Db25maWd1cmFibGVTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQgeyBJZGVTdGF0dXNJbmRpY2F0b3IgfSBmcm9tICcuLi9JZGVTdGF0dXNJbmRpY2F0b3IuanMnXG5pbXBvcnQgeyBNZW1vcnlVc2FnZUluZGljYXRvciB9IGZyb20gJy4uL01lbW9yeVVzYWdlSW5kaWNhdG9yLmpzJ1xuaW1wb3J0IHsgU2VudHJ5RXJyb3JCb3VuZGFyeSB9IGZyb20gJy4uL1NlbnRyeUVycm9yQm91bmRhcnkuanMnXG5pbXBvcnQgeyBUb2tlbldhcm5pbmcgfSBmcm9tICcuLi9Ub2tlbldhcm5pbmcuanMnXG5pbXBvcnQgeyBTYW5kYm94UHJvbXB0Rm9vdGVySGludCB9IGZyb20gJy4vU2FuZGJveFByb21wdEZvb3RlckhpbnQuanMnXG5cbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmNvbnN0IFZvaWNlSW5kaWNhdG9yOiB0eXBlb2YgaW1wb3J0KCcuL1ZvaWNlSW5kaWNhdG9yLmpzJykuVm9pY2VJbmRpY2F0b3IgPVxuICBmZWF0dXJlKCdWT0lDRV9NT0RFJylcbiAgICA/IHJlcXVpcmUoJy4vVm9pY2VJbmRpY2F0b3IuanMnKS5Wb2ljZUluZGljYXRvclxuICAgIDogKCkgPT4gbnVsbFxuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5cbmV4cG9ydCBjb25zdCBGT09URVJfVEVNUE9SQVJZX1NUQVRVU19USU1FT1VUID0gNTAwMFxuXG50eXBlIFByb3BzID0ge1xuICBhcGlLZXlTdGF0dXM6IFZlcmlmaWNhdGlvblN0YXR1c1xuICBhdXRvVXBkYXRlclJlc3VsdDogQXV0b1VwZGF0ZXJSZXN1bHQgfCBudWxsXG4gIGlzQXV0b1VwZGF0aW5nOiBib29sZWFuXG4gIGRlYnVnOiBib29sZWFuXG4gIHZlcmJvc2U6IGJvb2xlYW5cbiAgbWVzc2FnZXM6IE1lc3NhZ2VbXVxuICBvbkF1dG9VcGRhdGVyUmVzdWx0OiAocmVzdWx0OiBBdXRvVXBkYXRlclJlc3VsdCkgPT4gdm9pZFxuICBvbkNoYW5nZUlzVXBkYXRpbmc6IChpc1VwZGF0aW5nOiBib29sZWFuKSA9PiB2b2lkXG4gIGlkZVNlbGVjdGlvbjogSURFU2VsZWN0aW9uIHwgdW5kZWZpbmVkXG4gIG1jcENsaWVudHM/OiBNQ1BTZXJ2ZXJDb25uZWN0aW9uW11cbiAgaXNJbnB1dFdyYXBwZWQ/OiBib29sZWFuXG4gIGlzTmFycm93PzogYm9vbGVhblxufVxuXG5leHBvcnQgZnVuY3Rpb24gTm90aWZpY2F0aW9ucyh7XG4gIGFwaUtleVN0YXR1cyxcbiAgYXV0b1VwZGF0ZXJSZXN1bHQsXG4gIGRlYnVnLFxuICBpc0F1dG9VcGRhdGluZyxcbiAgdmVyYm9zZSxcbiAgbWVzc2FnZXMsXG4gIG9uQXV0b1VwZGF0ZXJSZXN1bHQsXG4gIG9uQ2hhbmdlSXNVcGRhdGluZyxcbiAgaWRlU2VsZWN0aW9uLFxuICBtY3BDbGllbnRzLFxuICBpc0lucHV0V3JhcHBlZCA9IGZhbHNlLFxuICBpc05hcnJvdyA9IGZhbHNlLFxufTogUHJvcHMpOiBSZWFjdE5vZGUge1xuICBjb25zdCB0b2tlblVzYWdlID0gdXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgbWVzc2FnZXNGb3JUb2tlbkNvdW50ID0gZ2V0TWVzc2FnZXNBZnRlckNvbXBhY3RCb3VuZGFyeShtZXNzYWdlcylcbiAgICByZXR1cm4gdG9rZW5Db3VudEZyb21MYXN0QVBJUmVzcG9uc2UobWVzc2FnZXNGb3JUb2tlbkNvdW50KVxuICB9LCBbbWVzc2FnZXNdKVxuXG4gIC8vIEFwcFN0YXRlLXNvdXJjZWQgbW9kZWwg4oCUIHNhbWUgc291cmNlIGFzIEFQSSByZXF1ZXN0cy4gZ2V0TWFpbkxvb3BNb2RlbCgpXG4gIC8vIHJlLXJlYWRzIHNldHRpbmdzLmpzb24gb24gZXZlcnkgY2FsbCwgc28gYW5vdGhlciBzZXNzaW9uJ3MgL21vZGVsIHdyaXRlXG4gIC8vIHdvdWxkIGxlYWsgaW50byB0aGlzIHNlc3Npb24ncyBkaXNwbGF5IChhbnRocm9waWNzL2NsYXVkZS1jb2RlIzM3NTk2KS5cbiAgY29uc3QgbWFpbkxvb3BNb2RlbCA9IHVzZU1haW5Mb29wTW9kZWwoKVxuICBjb25zdCBpc1Nob3dpbmdDb21wYWN0TWVzc2FnZSA9IGNhbGN1bGF0ZVRva2VuV2FybmluZ1N0YXRlKFxuICAgIHRva2VuVXNhZ2UsXG4gICAgbWFpbkxvb3BNb2RlbCxcbiAgKS5pc0Fib3ZlV2FybmluZ1RocmVzaG9sZFxuICBjb25zdCB7IHN0YXR1czogaWRlU3RhdHVzIH0gPSB1c2VJZGVDb25uZWN0aW9uU3RhdHVzKG1jcENsaWVudHMpXG4gIGNvbnN0IG5vdGlmaWNhdGlvbnMgPSB1c2VBcHBTdGF0ZShzID0+IHMubm90aWZpY2F0aW9ucylcbiAgY29uc3QgeyBhZGROb3RpZmljYXRpb24sIHJlbW92ZU5vdGlmaWNhdGlvbiB9ID0gdXNlTm90aWZpY2F0aW9ucygpXG4gIGNvbnN0IGNsYXVkZUFpTGltaXRzID0gdXNlQ2xhdWRlQWlMaW1pdHMoKVxuXG4gIC8vIFJlZ2lzdGVyIGVudiBob29rIG5vdGlmaWVyIGZvciBDd2RDaGFuZ2VkL0ZpbGVDaGFuZ2VkIGZlZWRiYWNrXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgc2V0RW52SG9va05vdGlmaWVyKCh0ZXh0LCBpc0Vycm9yKSA9PiB7XG4gICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICBrZXk6ICdlbnYtaG9vaycsXG4gICAgICAgIHRleHQsXG4gICAgICAgIGNvbG9yOiBpc0Vycm9yID8gJ2Vycm9yJyA6IHVuZGVmaW5lZCxcbiAgICAgICAgcHJpb3JpdHk6IGlzRXJyb3IgPyAnbWVkaXVtJyA6ICdsb3cnLFxuICAgICAgICB0aW1lb3V0TXM6IGlzRXJyb3IgPyA4MDAwIDogNTAwMCxcbiAgICAgIH0pXG4gICAgfSlcbiAgICByZXR1cm4gKCkgPT4gc2V0RW52SG9va05vdGlmaWVyKG51bGwpXG4gIH0sIFthZGROb3RpZmljYXRpb25dKVxuXG4gIC8vIENoZWNrIGlmIHdlIHNob3VsZCBzaG93IHRoZSBJREUgc2VsZWN0aW9uIGluZGljYXRvclxuICBjb25zdCBzaG91bGRTaG93SWRlU2VsZWN0aW9uID1cbiAgICBpZGVTdGF0dXMgPT09ICdjb25uZWN0ZWQnICYmXG4gICAgKGlkZVNlbGVjdGlvbj8uZmlsZVBhdGggfHxcbiAgICAgIChpZGVTZWxlY3Rpb24/LnRleHQgJiYgaWRlU2VsZWN0aW9uLmxpbmVDb3VudCA+IDApKVxuXG4gIC8vIEhpZGUgdXBkYXRlIGluc3RhbGxlZCBtZXNzYWdlIHdoZW4gc2hvd2luZyBJREUgc2VsZWN0aW9uXG4gIGNvbnN0IHNob3VsZFNob3dBdXRvVXBkYXRlciA9XG4gICAgIXNob3VsZFNob3dJZGVTZWxlY3Rpb24gfHxcbiAgICBpc0F1dG9VcGRhdGluZyB8fFxuICAgIGF1dG9VcGRhdGVyUmVzdWx0Py5zdGF0dXMgIT09ICdzdWNjZXNzJ1xuXG4gIC8vIENoZWNrIGlmIHdlJ3JlIGluIG92ZXJhZ2UgbW9kZSBmb3IgVUkgaW5kaWNhdG9yc1xuICBjb25zdCBpc0luT3ZlcmFnZU1vZGUgPSBjbGF1ZGVBaUxpbWl0cy5pc1VzaW5nT3ZlcmFnZVxuICBjb25zdCBzdWJzY3JpcHRpb25UeXBlID0gZ2V0U3Vic2NyaXB0aW9uVHlwZSgpXG4gIGNvbnN0IGlzVGVhbU9yRW50ZXJwcmlzZSA9XG4gICAgc3Vic2NyaXB0aW9uVHlwZSA9PT0gJ3RlYW0nIHx8IHN1YnNjcmlwdGlvblR5cGUgPT09ICdlbnRlcnByaXNlJ1xuXG4gIC8vIENoZWNrIGlmIHRoZSBleHRlcm5hbCBlZGl0b3IgaGludCBzaG91bGQgYmUgc2hvd25cbiAgY29uc3QgZWRpdG9yID0gZ2V0RXh0ZXJuYWxFZGl0b3IoKVxuICBjb25zdCBzaG91bGRTaG93RXh0ZXJuYWxFZGl0b3JIaW50ID1cbiAgICBpc0lucHV0V3JhcHBlZCAmJlxuICAgICFpc1Nob3dpbmdDb21wYWN0TWVzc2FnZSAmJlxuICAgIGFwaUtleVN0YXR1cyAhPT0gJ2ludmFsaWQnICYmXG4gICAgYXBpS2V5U3RhdHVzICE9PSAnbWlzc2luZycgJiZcbiAgICBlZGl0b3IgIT09IHVuZGVmaW5lZFxuXG4gIC8vIFNob3cgZXh0ZXJuYWwgZWRpdG9yIGhpbnQgYXMgbm90aWZpY2F0aW9uIHdoZW4gaW5wdXQgaXMgd3JhcHBlZFxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChzaG91bGRTaG93RXh0ZXJuYWxFZGl0b3JIaW50ICYmIGVkaXRvcikge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2V4dGVybmFsX2VkaXRvcl9oaW50X3Nob3duJywge30pXG4gICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICBrZXk6ICdleHRlcm5hbC1lZGl0b3ItaGludCcsXG4gICAgICAgIGpzeDogKFxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICBhY3Rpb249XCJjaGF0OmV4dGVybmFsRWRpdG9yXCJcbiAgICAgICAgICAgICAgY29udGV4dD1cIkNoYXRcIlxuICAgICAgICAgICAgICBmYWxsYmFjaz1cImN0cmwrZ1wiXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uPXtgZWRpdCBpbiAke3RvSURFRGlzcGxheU5hbWUoZWRpdG9yKX1gfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICksXG4gICAgICAgIHByaW9yaXR5OiAnaW1tZWRpYXRlJyxcbiAgICAgICAgdGltZW91dE1zOiA1MDAwLFxuICAgICAgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgcmVtb3ZlTm90aWZpY2F0aW9uKCdleHRlcm5hbC1lZGl0b3ItaGludCcpXG4gICAgfVxuICB9LCBbXG4gICAgc2hvdWxkU2hvd0V4dGVybmFsRWRpdG9ySGludCxcbiAgICBlZGl0b3IsXG4gICAgYWRkTm90aWZpY2F0aW9uLFxuICAgIHJlbW92ZU5vdGlmaWNhdGlvbixcbiAgXSlcblxuICByZXR1cm4gKFxuICAgIDxTZW50cnlFcnJvckJvdW5kYXJ5PlxuICAgICAgPEJveFxuICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgYWxpZ25JdGVtcz17aXNOYXJyb3cgPyAnZmxleC1zdGFydCcgOiAnZmxleC1lbmQnfVxuICAgICAgICBmbGV4U2hyaW5rPXswfVxuICAgICAgICBvdmVyZmxvd1g9XCJoaWRkZW5cIlxuICAgICAgPlxuICAgICAgICA8Tm90aWZpY2F0aW9uQ29udGVudFxuICAgICAgICAgIGlkZVNlbGVjdGlvbj17aWRlU2VsZWN0aW9ufVxuICAgICAgICAgIG1jcENsaWVudHM9e21jcENsaWVudHN9XG4gICAgICAgICAgbm90aWZpY2F0aW9ucz17bm90aWZpY2F0aW9uc31cbiAgICAgICAgICBpc0luT3ZlcmFnZU1vZGU9e2lzSW5PdmVyYWdlTW9kZSA/PyBmYWxzZX1cbiAgICAgICAgICBpc1RlYW1PckVudGVycHJpc2U9e2lzVGVhbU9yRW50ZXJwcmlzZX1cbiAgICAgICAgICBhcGlLZXlTdGF0dXM9e2FwaUtleVN0YXR1c31cbiAgICAgICAgICBkZWJ1Zz17ZGVidWd9XG4gICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICB0b2tlblVzYWdlPXt0b2tlblVzYWdlfVxuICAgICAgICAgIG1haW5Mb29wTW9kZWw9e21haW5Mb29wTW9kZWx9XG4gICAgICAgICAgc2hvdWxkU2hvd0F1dG9VcGRhdGVyPXtzaG91bGRTaG93QXV0b1VwZGF0ZXJ9XG4gICAgICAgICAgYXV0b1VwZGF0ZXJSZXN1bHQ9e2F1dG9VcGRhdGVyUmVzdWx0fVxuICAgICAgICAgIGlzQXV0b1VwZGF0aW5nPXtpc0F1dG9VcGRhdGluZ31cbiAgICAgICAgICBpc1Nob3dpbmdDb21wYWN0TWVzc2FnZT17aXNTaG93aW5nQ29tcGFjdE1lc3NhZ2V9XG4gICAgICAgICAgb25BdXRvVXBkYXRlclJlc3VsdD17b25BdXRvVXBkYXRlclJlc3VsdH1cbiAgICAgICAgICBvbkNoYW5nZUlzVXBkYXRpbmc9e29uQ2hhbmdlSXNVcGRhdGluZ31cbiAgICAgICAgLz5cbiAgICAgIDwvQm94PlxuICAgIDwvU2VudHJ5RXJyb3JCb3VuZGFyeT5cbiAgKVxufVxuXG5mdW5jdGlvbiBOb3RpZmljYXRpb25Db250ZW50KHtcbiAgaWRlU2VsZWN0aW9uLFxuICBtY3BDbGllbnRzLFxuICBub3RpZmljYXRpb25zLFxuICBpc0luT3ZlcmFnZU1vZGUsXG4gIGlzVGVhbU9yRW50ZXJwcmlzZSxcbiAgYXBpS2V5U3RhdHVzLFxuICBkZWJ1ZyxcbiAgdmVyYm9zZSxcbiAgdG9rZW5Vc2FnZSxcbiAgbWFpbkxvb3BNb2RlbCxcbiAgc2hvdWxkU2hvd0F1dG9VcGRhdGVyLFxuICBhdXRvVXBkYXRlclJlc3VsdCxcbiAgaXNBdXRvVXBkYXRpbmcsXG4gIGlzU2hvd2luZ0NvbXBhY3RNZXNzYWdlLFxuICBvbkF1dG9VcGRhdGVyUmVzdWx0LFxuICBvbkNoYW5nZUlzVXBkYXRpbmcsXG59OiB7XG4gIGlkZVNlbGVjdGlvbjogSURFU2VsZWN0aW9uIHwgdW5kZWZpbmVkXG4gIG1jcENsaWVudHM/OiBNQ1BTZXJ2ZXJDb25uZWN0aW9uW11cbiAgbm90aWZpY2F0aW9uczoge1xuICAgIGN1cnJlbnQ6IE5vdGlmaWNhdGlvbiB8IG51bGxcbiAgICBxdWV1ZTogTm90aWZpY2F0aW9uW11cbiAgfVxuICBpc0luT3ZlcmFnZU1vZGU6IGJvb2xlYW5cbiAgaXNUZWFtT3JFbnRlcnByaXNlOiBib29sZWFuXG4gIGFwaUtleVN0YXR1czogVmVyaWZpY2F0aW9uU3RhdHVzXG4gIGRlYnVnOiBib29sZWFuXG4gIHZlcmJvc2U6IGJvb2xlYW5cbiAgdG9rZW5Vc2FnZTogbnVtYmVyXG4gIG1haW5Mb29wTW9kZWw6IHN0cmluZ1xuICBzaG91bGRTaG93QXV0b1VwZGF0ZXI6IGJvb2xlYW5cbiAgYXV0b1VwZGF0ZXJSZXN1bHQ6IEF1dG9VcGRhdGVyUmVzdWx0IHwgbnVsbFxuICBpc0F1dG9VcGRhdGluZzogYm9vbGVhblxuICBpc1Nob3dpbmdDb21wYWN0TWVzc2FnZTogYm9vbGVhblxuICBvbkF1dG9VcGRhdGVyUmVzdWx0OiAocmVzdWx0OiBBdXRvVXBkYXRlclJlc3VsdCkgPT4gdm9pZFxuICBvbkNoYW5nZUlzVXBkYXRpbmc6IChpc1VwZGF0aW5nOiBib29sZWFuKSA9PiB2b2lkXG59KTogUmVhY3ROb2RlIHtcbiAgLy8gUG9sbCBhcGlLZXlIZWxwZXIgaW5mbGlnaHQgc3RhdGUgdG8gc2hvdyBzbG93LWhlbHBlciBub3RpY2UuXG4gIC8vIEdhdGVkIG9uIGNvbmZpZ3VyYXRpb24g4oCUIG1vc3QgdXNlcnMgbmV2ZXIgc2V0IGFwaUtleUhlbHBlciwgc28gdGhlXG4gIC8vIGVmZmVjdCBpcyBhIG5vLW9wIGZvciB0aGVtIChubyBpbnRlcnZhbCBhbGxvY2F0ZWQpLlxuICBjb25zdCBbYXBpS2V5SGVscGVyU2xvdywgc2V0QXBpS2V5SGVscGVyU2xvd10gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghZ2V0Q29uZmlndXJlZEFwaUtleUhlbHBlcigpKSByZXR1cm5cbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKFxuICAgICAgKHNldFNsb3c6IFJlYWN0LkRpc3BhdGNoPFJlYWN0LlNldFN0YXRlQWN0aW9uPHN0cmluZyB8IG51bGw+PikgPT4ge1xuICAgICAgICBjb25zdCBtcyA9IGdldEFwaUtleUhlbHBlckVsYXBzZWRNcygpXG4gICAgICAgIGNvbnN0IG5leHQgPSBtcyA+PSAxMF8wMDAgPyBmb3JtYXREdXJhdGlvbihtcykgOiBudWxsXG4gICAgICAgIHNldFNsb3cocHJldiA9PiAobmV4dCA9PT0gcHJldiA/IHByZXYgOiBuZXh0KSlcbiAgICAgIH0sXG4gICAgICAxMDAwLFxuICAgICAgc2V0QXBpS2V5SGVscGVyU2xvdyxcbiAgICApXG4gICAgcmV0dXJuICgpID0+IGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpXG4gIH0sIFtdKVxuXG4gIC8vIFZvaWNlIHN0YXRlIChWT0lDRV9NT0RFIGJ1aWxkcyBvbmx5LCBydW50aW1lLWdhdGVkIGJ5IEdyb3d0aEJvb2spXG4gIGNvbnN0IHZvaWNlU3RhdGUgPSBmZWF0dXJlKCdWT0lDRV9NT0RFJylcbiAgICA/IC8vIGJpb21lLWlnbm9yZSBsaW50L2NvcnJlY3RuZXNzL3VzZUhvb2tBdFRvcExldmVsOiBmZWF0dXJlKCkgaXMgYSBjb21waWxlLXRpbWUgY29uc3RhbnRcbiAgICAgIHVzZVZvaWNlU3RhdGUocyA9PiBzLnZvaWNlU3RhdGUpXG4gICAgOiAoJ2lkbGUnIGFzIGNvbnN0KVxuICAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gIGNvbnN0IHZvaWNlRW5hYmxlZCA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKSA/IHVzZVZvaWNlRW5hYmxlZCgpIDogZmFsc2VcbiAgY29uc3Qgdm9pY2VFcnJvciA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKVxuICAgID8gLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgICAgdXNlVm9pY2VTdGF0ZShzID0+IHMudm9pY2VFcnJvcilcbiAgICA6IG51bGxcbiAgY29uc3QgaXNCcmllZk9ubHkgPVxuICAgIGZlYXR1cmUoJ0tBSVJPUycpIHx8IGZlYXR1cmUoJ0tBSVJPU19CUklFRicpXG4gICAgICA/IC8vIGJpb21lLWlnbm9yZSBsaW50L2NvcnJlY3RuZXNzL3VzZUhvb2tBdFRvcExldmVsOiBmZWF0dXJlKCkgaXMgYSBjb21waWxlLXRpbWUgY29uc3RhbnRcbiAgICAgICAgdXNlQXBwU3RhdGUocyA9PiBzLmlzQnJpZWZPbmx5KVxuICAgICAgOiBmYWxzZVxuXG4gIC8vIFdoZW4gdm9pY2UgaXMgYWN0aXZlbHkgcmVjb3JkaW5nIG9yIHByb2Nlc3NpbmcsIHJlcGxhY2UgYWxsXG4gIC8vIG5vdGlmaWNhdGlvbnMgd2l0aCBqdXN0IHRoZSB2b2ljZSBpbmRpY2F0b3IuXG4gIGlmIChcbiAgICBmZWF0dXJlKCdWT0lDRV9NT0RFJykgJiZcbiAgICB2b2ljZUVuYWJsZWQgJiZcbiAgICAodm9pY2VTdGF0ZSA9PT0gJ3JlY29yZGluZycgfHwgdm9pY2VTdGF0ZSA9PT0gJ3Byb2Nlc3NpbmcnKVxuICApIHtcbiAgICByZXR1cm4gPFZvaWNlSW5kaWNhdG9yIHZvaWNlU3RhdGU9e3ZvaWNlU3RhdGV9IC8+XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICA8SWRlU3RhdHVzSW5kaWNhdG9yIGlkZVNlbGVjdGlvbj17aWRlU2VsZWN0aW9ufSBtY3BDbGllbnRzPXttY3BDbGllbnRzfSAvPlxuICAgICAge25vdGlmaWNhdGlvbnMuY3VycmVudCAmJlxuICAgICAgICAoJ2pzeCcgaW4gbm90aWZpY2F0aW9ucy5jdXJyZW50ID8gKFxuICAgICAgICAgIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiIGtleT17bm90aWZpY2F0aW9ucy5jdXJyZW50LmtleX0+XG4gICAgICAgICAgICB7bm90aWZpY2F0aW9ucy5jdXJyZW50LmpzeH1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgPFRleHRcbiAgICAgICAgICAgIGNvbG9yPXtub3RpZmljYXRpb25zLmN1cnJlbnQuY29sb3J9XG4gICAgICAgICAgICBkaW1Db2xvcj17IW5vdGlmaWNhdGlvbnMuY3VycmVudC5jb2xvcn1cbiAgICAgICAgICAgIHdyYXA9XCJ0cnVuY2F0ZVwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAge25vdGlmaWNhdGlvbnMuY3VycmVudC50ZXh0fVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgKSl9XG4gICAgICB7aXNJbk92ZXJhZ2VNb2RlICYmICFpc1RlYW1PckVudGVycHJpc2UgJiYgKFxuICAgICAgICA8Qm94PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAgTm93IHVzaW5nIGV4dHJhIHVzYWdlXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG4gICAgICB7YXBpS2V5SGVscGVyU2xvdyAmJiAoXG4gICAgICAgIDxCb3g+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJ3YXJuaW5nXCIgd3JhcD1cInRydW5jYXRlXCI+XG4gICAgICAgICAgICBhcGlLZXlIZWxwZXIgaXMgdGFraW5nIGEgd2hpbGV7JyAnfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvciB3cmFwPVwidHJ1bmNhdGVcIj5cbiAgICAgICAgICAgICh7YXBpS2V5SGVscGVyU2xvd30pXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG4gICAgICB7KGFwaUtleVN0YXR1cyA9PT0gJ2ludmFsaWQnIHx8IGFwaUtleVN0YXR1cyA9PT0gJ21pc3NpbmcnKSAmJiAoXG4gICAgICAgIDxCb3g+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiIHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgICAge2lzRW52VHJ1dGh5KHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX1JFTU9URSlcbiAgICAgICAgICAgICAgPyAnQXV0aGVudGljYXRpb24gZXJyb3IgwrcgVHJ5IGFnYWluJ1xuICAgICAgICAgICAgICA6ICdOb3QgbG9nZ2VkIGluIMK3IFJ1biAvbG9naW4nfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuICAgICAge2RlYnVnICYmIChcbiAgICAgICAgPEJveD5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIiB3cmFwPVwidHJ1bmNhdGVcIj5cbiAgICAgICAgICAgIERlYnVnIG1vZGVcbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIHthcGlLZXlTdGF0dXMgIT09ICdpbnZhbGlkJyAmJiBhcGlLZXlTdGF0dXMgIT09ICdtaXNzaW5nJyAmJiB2ZXJib3NlICYmIChcbiAgICAgICAgPEJveD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvciB3cmFwPVwidHJ1bmNhdGVcIj5cbiAgICAgICAgICAgIHt0b2tlblVzYWdlfSB0b2tlbnNcbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIHshaXNCcmllZk9ubHkgJiYgKFxuICAgICAgICA8VG9rZW5XYXJuaW5nIHRva2VuVXNhZ2U9e3Rva2VuVXNhZ2V9IG1vZGVsPXttYWluTG9vcE1vZGVsfSAvPlxuICAgICAgKX1cbiAgICAgIHtzaG91bGRTaG93QXV0b1VwZGF0ZXIgJiYgKFxuICAgICAgICA8QXV0b1VwZGF0ZXJXcmFwcGVyXG4gICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICBvbkF1dG9VcGRhdGVyUmVzdWx0PXtvbkF1dG9VcGRhdGVyUmVzdWx0fVxuICAgICAgICAgIGF1dG9VcGRhdGVyUmVzdWx0PXthdXRvVXBkYXRlclJlc3VsdH1cbiAgICAgICAgICBpc1VwZGF0aW5nPXtpc0F1dG9VcGRhdGluZ31cbiAgICAgICAgICBvbkNoYW5nZUlzVXBkYXRpbmc9e29uQ2hhbmdlSXNVcGRhdGluZ31cbiAgICAgICAgICBzaG93U3VjY2Vzc01lc3NhZ2U9eyFpc1Nob3dpbmdDb21wYWN0TWVzc2FnZX1cbiAgICAgICAgLz5cbiAgICAgICl9XG4gICAgICB7ZmVhdHVyZSgnVk9JQ0VfTU9ERScpXG4gICAgICAgID8gdm9pY2VFbmFibGVkICYmXG4gICAgICAgICAgdm9pY2VFcnJvciAmJiAoXG4gICAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCIgd3JhcD1cInRydW5jYXRlXCI+XG4gICAgICAgICAgICAgICAge3ZvaWNlRXJyb3J9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIClcbiAgICAgICAgOiBudWxsfVxuICAgICAgPE1lbW9yeVVzYWdlSW5kaWNhdG9yIC8+XG4gICAgICA8U2FuZGJveFByb21wdEZvb3RlckhpbnQgLz5cbiAgICA8Lz5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsU0FBU0EsT0FBTyxRQUFRLFlBQVk7QUFDcEMsT0FBTyxLQUFLQyxLQUFLLE1BQU0sT0FBTztBQUM5QixTQUFTLEtBQUtDLFNBQVMsRUFBRUMsU0FBUyxFQUFFQyxPQUFPLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ3BFLFNBQ0UsS0FBS0MsWUFBWSxFQUNqQkMsZ0JBQWdCLFFBQ1gsOEJBQThCO0FBQ3JDLFNBQVNDLFFBQVEsUUFBUSxpQ0FBaUM7QUFDMUQsU0FBU0MsV0FBVyxRQUFRLHVCQUF1QjtBQUNuRCxTQUFTQyxhQUFhLFFBQVEsd0JBQXdCO0FBQ3RELGNBQWNDLGtCQUFrQixRQUFRLHNDQUFzQztBQUM5RSxTQUFTQyxzQkFBc0IsUUFBUSx1Q0FBdUM7QUFDOUUsY0FBY0MsWUFBWSxRQUFRLGdDQUFnQztBQUNsRSxTQUFTQyxnQkFBZ0IsUUFBUSxpQ0FBaUM7QUFDbEUsU0FBU0MsZUFBZSxRQUFRLGdDQUFnQztBQUNoRSxTQUFTQyxHQUFHLEVBQUVDLElBQUksUUFBUSxjQUFjO0FBQ3hDLFNBQVNDLGlCQUFpQixRQUFRLHNDQUFzQztBQUN4RSxTQUFTQywwQkFBMEIsUUFBUSx1Q0FBdUM7QUFDbEYsY0FBY0MsbUJBQW1CLFFBQVEsNkJBQTZCO0FBQ3RF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