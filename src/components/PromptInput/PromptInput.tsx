import { feature } from 'bun:bundle';
import chalk from 'chalk';
import * as path from 'path';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNotifications } from 'src/context/notifications.js';
import { useCommandQueue } from 'src/hooks/useCommandQueue.js';
import { type IDEAtMentioned, useIdeAtMentioned } from 'src/hooks/useIdeAtMentioned.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { type AppState, useAppState, useAppStateStore, useSetAppState } from 'src/state/AppState.js';
import type { FooterItem } from 'src/state/AppStateStore.js';
import { getCwd } from 'src/utils/cwd.js';
import { isQueuedCommandEditable, popAllEditable } from 'src/utils/messageQueueManager.js';
import stripAnsi from 'strip-ansi';
import { companionReservedColumns } from '../../buddy/CompanionSprite.js';
import { findBuddyTriggerPositions, useBuddyNotification } from '../../buddy/useBuddyNotification.js';
import { FastModePicker } from '../../commands/fast/fast.js';
import { isUltrareviewEnabled } from '../../commands/review/ultrareviewEnabled.js';
import { getNativeCSIuTerminalDisplayName } from '../../commands/terminalSetup/terminalSetup.js';
import { type Command, hasCommand } from '../../commands.js';
import { useIsModalOverlayActive } from '../../context/overlayContext.js';
import { useSetPromptOverlayDialog } from '../../context/promptOverlayContext.js';
import { formatImageRef, formatPastedTextRef, getPastedTextRefNumLines, parseReferences } from '../../history.js';
import type { VerificationStatus } from '../../hooks/useApiKeyVerification.js';
import { type HistoryMode, useArrowKeyHistory } from '../../hooks/useArrowKeyHistory.js';
import { useDoublePress } from '../../hooks/useDoublePress.js';
import { useHistorySearch } from '../../hooks/useHistorySearch.js';
import type { IDESelection } from '../../hooks/useIdeSelection.js';
import { useInputBuffer } from '../../hooks/useInputBuffer.js';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { usePromptSuggestion } from '../../hooks/usePromptSuggestion.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { useTypeahead } from '../../hooks/useTypeahead.js';
import type { BorderTextOptions } from '../../ink/render-border.js';
import { stringWidth } from '../../ink/stringWidth.js';
import { Box, type ClickEvent, type Key, Text, useInput } from '../../ink.js';
import { useOptionalKeybindingContext } from '../../keybindings/KeybindingContext.js';
import { getShortcutDisplay } from '../../keybindings/shortcutFormat.js';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding.js';
import type { MCPServerConnection } from '../../services/mcp/types.js';
import { abortPromptSuggestion, logSuggestionSuppressed } from '../../services/PromptSuggestion/promptSuggestion.js';
import { type ActiveSpeculationState, abortSpeculation } from '../../services/PromptSuggestion/speculation.js';
import { getActiveAgentForInput, getViewedTeammateTask } from '../../state/selectors.js';
import { enterTeammateView, exitTeammateView, stopOrDismissAgent } from '../../state/teammateViewHelpers.js';
import type { ToolPermissionContext } from '../../Tool.js';
import { getRunningTeammatesSorted } from '../../tasks/InProcessTeammateTask/InProcessTeammateTask.js';
import type { InProcessTeammateTaskState } from '../../tasks/InProcessTeammateTask/types.js';
import { isPanelAgentTask, type LocalAgentTaskState } from '../../tasks/LocalAgentTask/LocalAgentTask.js';
import { isBackgroundTask } from '../../tasks/types.js';
import { AGENT_COLOR_TO_THEME_COLOR, AGENT_COLORS, type AgentColorName } from '../../tools/AgentTool/agentColorManager.js';
import type { AgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js';
import type { Message } from '../../types/message.js';
import type { PermissionMode } from '../../types/permissions.js';
import type { BaseTextInputProps, PromptInputMode, VimMode } from '../../types/textInputTypes.js';
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js';
import { count } from '../../utils/array.js';
import type { AutoUpdaterResult } from '../../utils/autoUpdater.js';
import { Cursor } from '../../utils/Cursor.js';
import { getGlobalConfig, type PastedContent, saveGlobalConfig } from '../../utils/config.js';
import { logForDebugging } from '../../utils/debug.js';
import { parseDirectMemberMessage, sendDirectMemberMessage } from '../../utils/directMemberMessage.js';
import type { EffortLevel } from '../../utils/effort.js';
import { env } from '../../utils/env.js';
import { errorMessage } from '../../utils/errors.js';
import { isBilledAsExtraUsage } from '../../utils/extraUsage.js';
import { getFastModeUnavailableReason, isFastModeAvailable, isFastModeCooldown, isFastModeEnabled, isFastModeSupportedByModel } from '../../utils/fastMode.js';
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js';
import type { PromptInputHelpers } from '../../utils/handlePromptSubmit.js';
import { getImageFromClipboard, PASTE_THRESHOLD } from '../../utils/imagePaste.js';
import type { ImageDimensions } from '../../utils/imageResizer.js';
import { cacheImagePath, storeImage } from '../../utils/imageStore.js';
import { isMacosOptionChar, MACOS_OPTION_SPECIAL_CHARS } from '../../utils/keyboardShortcuts.js';
import { logError } from '../../utils/log.js';
import { isOpus1mMergeEnabled, modelDisplayString } from '../../utils/model/model.js';
import { setAutoModeActive } from '../../utils/permissions/autoModeState.js';
import { cyclePermissionMode, getNextPermissionMode } from '../../utils/permissions/getNextPermissionMode.js';
import { transitionPermissionMode } from '../../utils/permissions/permissionSetup.js';
import { getPlatform } from '../../utils/platform.js';
import type { ProcessUserInputContext } from '../../utils/processUserInput/processUserInput.js';
import { editPromptInEditor } from '../../utils/promptEditor.js';
import { hasAutoModeOptIn } from '../../utils/settings/settings.js';
import { findBtwTriggerPositions } from '../../utils/sideQuestion.js';
import { findSlashCommandPositions } from '../../utils/suggestions/commandSuggestions.js';
import { findSlackChannelPositions, getKnownChannelsVersion, hasSlackMcpServer, subscribeKnownChannels } from '../../utils/suggestions/slackChannelSuggestions.js';
import { isInProcessEnabled } from '../../utils/swarm/backends/registry.js';
import { syncTeammateMode } from '../../utils/swarm/teamHelpers.js';
import type { TeamSummary } from '../../utils/teamDiscovery.js';
import { getTeammateColor } from '../../utils/teammate.js';
import { isInProcessTeammate } from '../../utils/teammateContext.js';
import { writeToMailbox } from '../../utils/teammateMailbox.js';
import type { TextHighlight } from '../../utils/textHighlighting.js';
import type { Theme } from '../../utils/theme.js';
import { findThinkingTriggerPositions, getRainbowColor, isUltrathinkEnabled } from '../../utils/thinking.js';
import { findTokenBudgetPositions } from '../../utils/tokenBudget.js';
import { findUltraplanTriggerPositions, findUltrareviewTriggerPositions } from '../../utils/ultraplan/keyword.js';
import { AutoModeOptInDialog } from '../AutoModeOptInDialog.js';
import { BridgeDialog } from '../BridgeDialog.js';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js';
import { getVisibleAgentTasks, useCoordinatorTaskCount } from '../CoordinatorAgentStatus.js';
import { getEffortNotificationText } from '../EffortIndicator.js';
import { getFastIconString } from '../FastIcon.js';
import { GlobalSearchDialog } from '../GlobalSearchDialog.js';
import { HistorySearchDialog } from '../HistorySearchDialog.js';
import { ModelPicker } from '../ModelPicker.js';
import { QuickOpenDialog } from '../QuickOpenDialog.js';
import TextInput from '../TextInput.js';
import { ThinkingToggle } from '../ThinkingToggle.js';
import { BackgroundTasksDialog } from '../tasks/BackgroundTasksDialog.js';
import { shouldHideTasksFooter } from '../tasks/taskStatusUtils.js';
import { TeamsDialog } from '../teams/TeamsDialog.js';
import VimTextInput from '../VimTextInput.js';
import { getModeFromInput, getValueFromInput } from './inputModes.js';
import { FOOTER_TEMPORARY_STATUS_TIMEOUT, Notifications } from './Notifications.js';
import PromptInputFooter from './PromptInputFooter.js';
import type { SuggestionItem } from './PromptInputFooterSuggestions.js';
import { PromptInputModeIndicator } from './PromptInputModeIndicator.js';
import { PromptInputQueuedCommands } from './PromptInputQueuedCommands.js';
import { PromptInputStashNotice } from './PromptInputStashNotice.js';
import { useMaybeTruncateInput } from './useMaybeTruncateInput.js';
import { usePromptInputPlaceholder } from './usePromptInputPlaceholder.js';
import { useShowFastIconHint } from './useShowFastIconHint.js';
import { useSwarmBanner } from './useSwarmBanner.js';
import { isNonSpacePrintable, isVimModeEnabled } from './utils.js';
type Props = {
  debug: boolean;
  ideSelection: IDESelection | undefined;
  toolPermissionContext: ToolPermissionContext;
  setToolPermissionContext: (ctx: ToolPermissionContext) => void;
  apiKeyStatus: VerificationStatus;
  commands: Command[];
  agents: AgentDefinition[];
  isLoading: boolean;
  verbose: boolean;
  messages: Message[];
  onAutoUpdaterResult: (result: AutoUpdaterResult) => void;
  autoUpdaterResult: AutoUpdaterResult | null;
  input: string;
  onInputChange: (value: string) => void;
  mode: PromptInputMode;
  onModeChange: (mode: PromptInputMode) => void;
  stashedPrompt: {
    text: string;
    cursorOffset: number;
    pastedContents: Record<number, PastedContent>;
  } | undefined;
  setStashedPrompt: (value: {
    text: string;
    cursorOffset: number;
    pastedContents: Record<number, PastedContent>;
  } | undefined) => void;
  submitCount: number;
  onShowMessageSelector: () => void;
  /** Fullscreen message actions: shift+↑ enters cursor. */
  onMessageActionsEnter?: () => void;
  mcpClients: MCPServerConnection[];
  pastedContents: Record<number, PastedContent>;
  setPastedContents: React.Dispatch<React.SetStateAction<Record<number, PastedContent>>>;
  vimMode: VimMode;
  setVimMode: (mode: VimMode) => void;
  showBashesDialog: string | boolean;
  setShowBashesDialog: (show: string | boolean) => void;
  onExit: () => void;
  getToolUseContext: (messages: Message[], newMessages: Message[], abortController: AbortController, mainLoopModel: string) => ProcessUserInputContext;
  onSubmit: (input: string, helpers: PromptInputHelpers, speculationAccept?: {
    state: ActiveSpeculationState;
    speculationSessionTimeSavedMs: number;
    setAppState: (f: (prev: AppState) => AppState) => void;
  }, options?: {
    fromKeybinding?: boolean;
  }) => Promise<void>;
  onAgentSubmit?: (input: string, task: InProcessTeammateTaskState | LocalAgentTaskState, helpers: PromptInputHelpers) => Promise<void>;
  isSearchingHistory: boolean;
  setIsSearchingHistory: (isSearching: boolean) => void;
  onDismissSideQuestion?: () => void;
  isSideQuestionVisible?: boolean;
  helpOpen: boolean;
  setHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hasSuppressedDialogs?: boolean;
  isLocalJSXCommandActive?: boolean;
  insertTextRef?: React.MutableRefObject<{
    insert: (text: string) => void;
    setInputWithCursor: (value: string, cursor: number) => void;
    cursorOffset: number;
  } | null>;
  voiceInterimRange?: {
    start: number;
    end: number;
  } | null;
};

// Bottom slot has maxHeight="50%"; reserve lines for footer, border, status.
const PROMPT_FOOTER_LINES = 5;
const MIN_INPUT_VIEWPORT_LINES = 3;
function PromptInput({
  debug,
  ideSelection,
  toolPermissionContext,
  setToolPermissionContext,
  apiKeyStatus,
  commands,
  agents,
  isLoading,
  verbose,
  messages,
  onAutoUpdaterResult,
  autoUpdaterResult,
  input,
  onInputChange,
  mode,
  onModeChange,
  stashedPrompt,
  setStashedPrompt,
  submitCount,
  onShowMessageSelector,
  onMessageActionsEnter,
  mcpClients,
  pastedContents,
  setPastedContents,
  vimMode,
  setVimMode,
  showBashesDialog,
  setShowBashesDialog,
  onExit,
  getToolUseContext,
  onSubmit: onSubmitProp,
  onAgentSubmit,
  isSearchingHistory,
  setIsSearchingHistory,
  onDismissSideQuestion,
  isSideQuestionVisible,
  helpOpen,
  setHelpOpen,
  hasSuppressedDialogs,
  isLocalJSXCommandActive = false,
  insertTextRef,
  voiceInterimRange
}: Props): React.ReactNode {
  const mainLoopModel = useMainLoopModel();
  // A local-jsx command (e.g., /mcp while agent is running) renders a full-
  // screen dialog on top of PromptInput via the immediate-command path with
  // shouldHidePromptInput: false. Those dialogs don't register in the overlay
  // system, so treat them as a modal overlay here to stop navigation keys from
  // leaking into TextInput/footer handlers and stacking a second dialog.
  const isModalOverlayActive = useIsModalOverlayActive() || isLocalJSXCommandActive;
  const [isAutoUpdating, setIsAutoUpdating] = useState(false);
  const [exitMessage, setExitMessage] = useState<{
    show: boolean;
    key?: string;
  }>({
    show: false
  });
  const [cursorOffset, setCursorOffset] = useState<number>(input.length);
  // Track the last input value set via internal handlers so we can detect
  // external input changes (e.g. speech-to-text injection) and move cursor to end.
  const lastInternalInputRef = React.useRef(input);
  if (input !== lastInternalInputRef.current) {
    // Input changed externally (not through any internal handler) — move cursor to end
    setCursorOffset(input.length);
    lastInternalInputRef.current = input;
  }
  // Wrap onInputChange to track internal changes before they trigger re-render
  const trackAndSetInput = React.useCallback((value: string) => {
    lastInternalInputRef.current = value;
    onInputChange(value);
  }, [onInputChange]);
  // Expose an insertText function so callers (e.g. STT) can splice text at the
  // current cursor position instead of replacing the entire input.
  if (insertTextRef) {
    insertTextRef.current = {
      cursorOffset,
      insert: (text: string) => {
        const needsSpace = cursorOffset === input.length && input.length > 0 && !/\s$/.test(input);
        const insertText = needsSpace ? ' ' + text : text;
        const newValue = input.slice(0, cursorOffset) + insertText + input.slice(cursorOffset);
        lastInternalInputRef.current = newValue;
        onInputChange(newValue);
        setCursorOffset(cursorOffset + insertText.length);
      },
      setInputWithCursor: (value: string, cursor: number) => {
        lastInternalInputRef.current = value;
        onInputChange(value);
        setCursorOffset(cursor);
      }
    };
  }
  const store = useAppStateStore();
  const setAppState = useSetAppState();
  const tasks = useAppState(s => s.tasks);
  const replBridgeConnected = useAppState(s => s.replBridgeConnected);
  const replBridgeExplicit = useAppState(s => s.replBridgeExplicit);
  const replBridgeReconnecting = useAppState(s => s.replBridgeReconnecting);
  // Must match BridgeStatusIndicator's render condition (PromptInputFooter.tsx) —
  // the pill returns null for implicit-and-not-reconnecting, so nav must too,
  // otherwise bridge becomes an invisible selection stop.
  const bridgeFooterVisible = replBridgeConnected && (replBridgeExplicit || replBridgeReconnecting);
  // Tmux pill (ant-only) — visible when there's an active tungsten session
  const hasTungstenSession = useAppState(s => "external" === 'ant' && s.tungstenActiveSession !== undefined);
  const tmuxFooterVisible = "external" === 'ant' && hasTungstenSession;
  // WebBrowser pill — visible when a browser is open
  const bagelFooterVisible = useAppState(s => false);
  const teamContext = useAppState(s => s.teamContext);
  const queuedCommands = useCommandQueue();
  const promptSuggestionState = useAppState(s => s.promptSuggestion);
  const speculation = useAppState(s => s.speculation);
  const speculationSessionTimeSavedMs = useAppState(s => s.speculationSessionTimeSavedMs);
  const viewingAgentTaskId = useAppState(s => s.viewingAgentTaskId);
  const viewSelectionMode = useAppState(s => s.viewSelectionMode);
  const showSpinnerTree = useAppState(s => s.expandedView) === 'teammates';
  const {
    companion: _companion,
    companionMuted
  } = feature('BUDDY') ? getGlobalConfig() : {
    companion: undefined,
    companionMuted: undefined
  };
  const companionFooterVisible = !!_companion && !companionMuted;
  // Brief mode: BriefSpinner/BriefIdleStatus own the 2-row footprint above
  // the input. Dropping marginTop here lets the spinner sit flush against
  // the input bar. viewingAgentTaskId mirrors the gate on both (Spinner.tsx,
  // REPL.tsx) — teammate view falls back to SpinnerWithVerbInner which has
  // its own marginTop, so the gap stays even without ours.
  const briefOwnsGap = feature('KAIROS') || feature('KAIROS_BRIEF') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useAppState(s => s.isBriefOnly) && !viewingAgentTaskId : false;
  const mainLoopModel_ = useAppState(s => s.mainLoopModel);
  const mainLoopModelForSession = useAppState(s => s.mainLoopModelForSession);
  const thinkingEnabled = useAppState(s => s.thinkingEnabled);
  const isFastMode = useAppState(s => isFastModeEnabled() ? s.fastMode : false);
  const effortValue = useAppState(s => s.effortValue);
  const viewedTeammate = getViewedTeammateTask(store.getState());
  const viewingAgentName = viewedTeammate?.identity.agentName;
  // identity.color is typed as `string | undefined` (not AgentColorName) because
  // teammate identity comes from file-based config. Validate before casting to
  // ensure we only use valid color names (falls back to cyan if invalid).
  const viewingAgentColor = viewedTeammate?.identity.color && AGENT_COLORS.includes(viewedTeammate.identity.color as AgentColorName) ? viewedTeammate.identity.color as AgentColorName : undefined;
  // In-process teammates sorted alphabetically for footer team selector
  const inProcessTeammates = useMemo(() => getRunningTeammatesSorted(tasks), [tasks]);

  // Team mode: all background tasks are in-process teammates
  const isTeammateMode = inProcessTeammates.length > 0 || viewedTeammate !== undefined;

  // When viewing a teammate, show their permission mode in the footer instead of the leader's
  const effectiveToolPermissionContext = useMemo((): ToolPermissionContext => {
    if (viewedTeammate) {
      return {
        ...toolPermissionContext,
        mode: viewedTeammate.permissionMode
      };
    }
    return toolPermissionContext;
  }, [viewedTeammate, toolPermissionContext]);
  const {
    historyQuery,
    setHistoryQuery,
    historyMatch,
    historyFailedMatch
  } = useHistorySearch(entry => {
    setPastedContents(entry.pastedContents);
    void onSubmit(entry.display);
  }, input, trackAndSetInput, setCursorOffset, cursorOffset, onModeChange, mode, isSearchingHistory, setIsSearchingHistory, setPastedContents, pastedContents);
  // Counter for paste IDs (shared between images and text).
  // Compute initial value once from existing messages (for --continue/--resume).
  // useRef(fn()) evaluates fn() on every render and discards the result after
  // mount — getInitialPasteId walks all messages + regex-scans text blocks,
  // so guard with a lazy-init pattern to run it exactly once.
  const nextPasteIdRef = useRef(-1);
  if (nextPasteIdRef.current === -1) {
    nextPasteIdRef.current = getInitialPasteId(messages);
  }
  // Armed by onImagePaste; if the very next keystroke is a non-space
  // printable, inputFilter prepends a space before it. Any other input
  // (arrow, escape, backspace, paste, space) disarms without inserting.
  const pendingSpaceAfterPillRef = useRef(false);
  const [showTeamsDialog, setShowTeamsDialog] = useState(false);
  const [showBridgeDialog, setShowBridgeDialog] = useState(false);
  const [teammateFooterIndex, setTeammateFooterIndex] = useState(0);
  // -1 sentinel: tasks pill is selected but no specific agent row is selected yet.
  // First ↓ selects the pill, second ↓ moves to row 0. Prevents double-select
  // of pill + row when both bg tasks (pill) and forked agents (rows) are visible.
  const coordinatorTaskIndex = useAppState(s => s.coordinatorTaskIndex);
  const setCoordinatorTaskIndex = useCallback((v: number | ((prev: number) => number)) => setAppState(prev => {
    const next = typeof v === 'function' ? v(prev.coordinatorTaskIndex) : v;
    if (next === prev.coordinatorTaskIndex) return prev;
    return {
      ...prev,
      coordinatorTaskIndex: next
    };
  }), [setAppState]);
  const coordinatorTaskCount = useCoordinatorTaskCount();
  // The pill (BackgroundTaskStatus) only renders when non-local_agent bg tasks
  // exist. When only local_agent tasks are running (coordinator/fork mode), the
  // pill is absent, so the -1 sentinel would leave nothing visually selected.
  // In that case, skip -1 and treat 0 as the minimum selectable index.
  const hasBgTaskPill = useMemo(() => Object.values(tasks).some(t => isBackgroundTask(t) && !("external" === 'ant' && isPanelAgentTask(t))), [tasks]);
  const minCoordinatorIndex = hasBgTaskPill ? -1 : 0;
  // Clamp index when tasks complete and the list shrinks beneath the cursor
  useEffect(() => {
    if (coordinatorTaskIndex >= coordinatorTaskCount) {
      setCoordinatorTaskIndex(Math.max(minCoordinatorIndex, coordinatorTaskCount - 1));
    } else if (coordinatorTaskIndex < minCoordinatorIndex) {
      setCoordinatorTaskIndex(minCoordinatorIndex);
    }
  }, [coordinatorTaskCount, coordinatorTaskIndex, minCoordinatorIndex]);
  const [isPasting, setIsPasting] = useState(false);
  const [isExternalEditorActive, setIsExternalEditorActive] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const [showFastModePicker, setShowFastModePicker] = useState(false);
  const [showThinkingToggle, setShowThinkingToggle] = useState(false);
  const [showAutoModeOptIn, setShowAutoModeOptIn] = useState(false);
  const [previousModeBeforeAuto, setPreviousModeBeforeAuto] = useState<PermissionMode | null>(null);
  const autoModeOptInTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if cursor is on the first line of input
  const isCursorOnFirstLine = useMemo(() => {
    const firstNewlineIndex = input.indexOf('\n');
    if (firstNewlineIndex === -1) {
      return true; // No newlines, cursor is always on first line
    }
    return cursorOffset <= firstNewlineIndex;
  }, [input, cursorOffset]);
  const isCursorOnLastLine = useMemo(() => {
    const lastNewlineIndex = input.lastIndexOf('\n');
    if (lastNewlineIndex === -1) {
      return true; // No newlines, cursor is always on last line
    }
    return cursorOffset > lastNewlineIndex;
  }, [input, cursorOffset]);

  // Derive team info from teamContext (no filesystem I/O needed)
  // A session can only lead one team at a time
  const cachedTeams: TeamSummary[] = useMemo(() => {
    if (!isAgentSwarmsEnabled()) return [];
    // In-process mode uses Shift+Down/Up navigation instead of footer menu
    if (isInProcessEnabled()) return [];
    if (!teamContext) {
      return [];
    }
    const teammateCount = count(Object.values(teamContext.teammates), t => t.name !== 'team-lead');
    return [{
      name: teamContext.teamName,
      memberCount: teammateCount,
      runningCount: 0,
      idleCount: 0
    }];
  }, [teamContext]);

  // ─── Footer pill navigation ─────────────────────────────────────────────
  // Which pills render below the input box. Order here IS the nav order
  // (down/right = forward, up/left = back). Selection lives in AppState so
  // pills rendered outside PromptInput (CompanionSprite) can read focus.
  const runningTaskCount = useMemo(() => count(Object.values(tasks), t => t.status === 'running'), [tasks]);
  // Panel shows retained-completed agents too (getVisibleAgentTasks), so the
  // pill must stay navigable whenever the panel has rows — not just when
  // something is running.
  const tasksFooterVisible = (runningTaskCount > 0 || "external" === 'ant' && coordinatorTaskCount > 0) && !shouldHideTasksFooter(tasks, showSpinnerTree);
  const teamsFooterVisible = cachedTeams.length > 0;
  const footerItems = useMemo(() => [tasksFooterVisible && 'tasks', tmuxFooterVisible && 'tmux', bagelFooterVisible && 'bagel', teamsFooterVisible && 'teams', bridgeFooterVisible && 'bridge', companionFooterVisible && 'companion'].filter(Boolean) as FooterItem[], [tasksFooterVisible, tmuxFooterVisible, bagelFooterVisible, teamsFooterVisible, bridgeFooterVisible, companionFooterVisible]);

  // Effective selection: null if the selected pill stopped rendering (bridge
  // disconnected, task finished). The derivation makes the UI correct
  // immediately; the useEffect below clears the raw state so it doesn't
  // resurrect when the same pill reappears (new task starts → focus stolen).
  const rawFooterSelection = useAppState(s => s.footerSelection);
  const footerItemSelected = rawFooterSelection && footerItems.includes(rawFooterSelection) ? rawFooterSelection : null;
  useEffect(() => {
    if (rawFooterSelection && !footerItemSelected) {
      setAppState(prev => prev.footerSelection === null ? prev : {
        ...prev,
        footerSelection: null
      });
    }
  }, [rawFooterSelection, footerItemSelected, setAppState]);
  const tasksSelected = footerItemSelected === 'tasks';
  const tmuxSelected = footerItemSelected === 'tmux';
  const bagelSelected = footerItemSelected === 'bagel';
  const teamsSelected = footerItemSelected === 'teams';
  const bridgeSelected = footerItemSelected === 'bridge';
  function selectFooterItem(item: FooterItem | null): void {
    setAppState(prev => prev.footerSelection === item ? prev : {
      ...prev,
      footerSelection: item
    });
    if (item === 'tasks') {
      setTeammateFooterIndex(0);
      setCoordinatorTaskIndex(minCoordinatorIndex);
    }
  }

  // delta: +1 = down/right, -1 = up/left. Returns true if nav happened
  // (including deselecting at the start), false if at a boundary.
  function navigateFooter(delta: 1 | -1, exitAtStart = false): boolean {
    const idx = footerItemSelected ? footerItems.indexOf(footerItemSelected) : -1;
    const next = footerItems[idx + delta];
    if (next) {
      selectFooterItem(next);
      return true;
    }
    if (delta < 0 && exitAtStart) {
      selectFooterItem(null);
      return true;
    }
    return false;
  }

  // Prompt suggestion hook - reads suggestions generated by forked agent in query loop
  const {
    suggestion: promptSuggestion,
    markAccepted,
    logOutcomeAtSubmission,
    markShown
  } = usePromptSuggestion({
    inputValue: input,
    isAssistantResponding: isLoading
  });
  const displayedValue = useMemo(() => isSearchingHistory && historyMatch ? getValueFromInput(typeof historyMatch === 'string' ? historyMatch : historyMatch.display) : input, [isSearchingHistory, historyMatch, input]);
  const thinkTriggers = useMemo(() => findThinkingTriggerPositions(displayedValue), [displayedValue]);
  const ultraplanSessionUrl = useAppState(s => s.ultraplanSessionUrl);
  const ultraplanLaunching = useAppState(s => s.ultraplanLaunching);
  const ultraplanTriggers = useMemo(() => feature('ULTRAPLAN') && !ultraplanSessionUrl && !ultraplanLaunching ? findUltraplanTriggerPositions(displayedValue) : [], [displayedValue, ultraplanSessionUrl, ultraplanLaunching]);
  const ultrareviewTriggers = useMemo(() => isUltrareviewEnabled() ? findUltrareviewTriggerPositions(displayedValue) : [], [displayedValue]);
  const btwTriggers = useMemo(() => findBtwTriggerPositions(displayedValue), [displayedValue]);
  const buddyTriggers = useMemo(() => findBuddyTriggerPositions(displayedValue), [displayedValue]);
  const slashCommandTriggers = useMemo(() => {
    const positions = findSlashCommandPositions(displayedValue);
    // Only highlight valid commands
    return positions.filter(pos => {
      const commandName = displayedValue.slice(pos.start + 1, pos.end); // +1 to skip "/"
      return hasCommand(commandName, commands);
    });
  }, [displayedValue, commands]);
  const tokenBudgetTriggers = useMemo(() => feature('TOKEN_BUDGET') ? findTokenBudgetPositions(displayedValue) : [], [displayedValue]);
  const knownChannelsVersion = useSyncExternalStore(subscribeKnownChannels, getKnownChannelsVersion);
  const slackChannelTriggers = useMemo(() => hasSlackMcpServer(store.getState().mcp.clients) ? findSlackChannelPositions(displayedValue) : [],
  // eslint-disable-next-line react-hooks/exhaustive-deps -- store is a stable ref
  [displayedValue, knownChannelsVersion]);

  // Find @name mentions and highlight with team member's color
  const memberMentionHighlights = useMemo((): Array<{
    start: number;
    end: number;
    themeColor: keyof Theme;
  }> => {
    if (!isAgentSwarmsEnabled()) return [];
    if (!teamContext?.teammates) return [];
    const highlights: Array<{
      start: number;
      end: number;
      themeColor: keyof Theme;
    }> = [];
    const members = teamContext.teammates;
    if (!members) return highlights;

    // Find all @name patterns in the input
    const regex = /(^|\s)@([\w-]+)/g;
    const memberValues = Object.values(members);
    let match;
    while ((match = regex.exec(displayedValue)) !== null) {
      const leadingSpace = match[1] ?? '';
      const nameStart = match.index + leadingSpace.length;
      const fullMatch = match[0].trimStart();
      const name = match[2];

      // Check if this name matches a team member
      const member = memberValues.find(t => t.name === name);
      if (member?.color) {
        const themeColor = AGENT_COLOR_TO_THEME_COLOR[member.color as AgentColorName];
        if (themeColor) {
          highlights.push({
            start: nameStart,
            end: nameStart + fullMatch.length,
            themeColor
          });
        }
      }
    }
    return highlights;
  }, [displayedValue, teamContext]);
  const imageRefPositions = useMemo(() => parseReferences(displayedValue).filter(r => r.match.startsWith('[Image')).map(r => ({
    start: r.index,
    end: r.index + r.match.length
  })), [displayedValue]);

  // chip.start is the "selected" state: the inverted chip IS the cursor.
  // chip.end stays a normal position so you can park the cursor right after
  // `]` like any other character.
  const cursorAtImageChip = imageRefPositions.some(r => r.start === cursorOffset);

  // up/down movement or a fullscreen click can land the cursor strictly
  // inside a chip; snap to the nearer boundary so it's never editable
  // char-by-char.
  useEffect(() => {
    const inside = imageRefPositions.find(r => cursorOffset > r.start && cursorOffset < r.end);
    if (inside) {
      const mid = (inside.start + inside.end) / 2;
      setCursorOffset(cursorOffset < mid ? inside.start : inside.end);
    }
  }, [cursorOffset, imageRefPositions, setCursorOffset]);
  const combinedHighlights = useMemo((): TextHighlight[] => {
    const highlights: TextHighlight[] = [];

    // Invert the [Image #N] chip when the cursor is at chip.start (the
    // "selected" state) so backspace-to-delete is visually obvious.
    for (const ref of imageRefPositions) {
      if (cursorOffset === ref.start) {
        highlights.push({
          start: ref.start,
          end: ref.end,
          color: undefined,
          inverse: true,
          priority: 8
        });
      }
    }
    if (isSearchingHistory && historyMatch && !historyFailedMatch) {
      highlights.push({
        start: cursorOffset,
        end: cursorOffset + historyQuery.length,
        color: 'warning',
        priority: 20
      });
    }

    // Add "btw" highlighting (solid yellow)
    for (const trigger of btwTriggers) {
      highlights.push({
        start: trigger.start,
        end: trigger.end,
        color: 'warning',
        priority: 15
      });
    }

    // Add /command highlighting (blue)
    for (const trigger of slashCommandTriggers) {
      highlights.push({
        start: trigger.start,
        end: trigger.end,
        color: 'suggestion',
        priority: 5
      });
    }

    // Add token budget highlighting (blue)
    for (const trigger of tokenBudgetTriggers) {
      highlights.push({
        start: trigger.start,
        end: trigger.end,
        color: 'suggestion',
        priority: 5
      });
    }
    for (const trigger of slackChannelTriggers) {
      highlights.push({
        start: trigger.start,
        end: trigger.end,
        color: 'suggestion',
        priority: 5
      });
    }

    // Add @name highlighting with team member's color
    for (const mention of memberMentionHighlights) {
      highlights.push({
        start: mention.start,
        end: mention.end,
        color: mention.themeColor,
        priority: 5
      });
    }

    // Dim interim voice dictation text
    if (voiceInterimRange) {
      highlights.push({
        start: voiceInterimRange.start,
        end: voiceInterimRange.end,
        color: undefined,
        dimColor: true,
        priority: 1
      });
    }

    // Rainbow highlighting for ultrathink keyword (per-character cycling colors)
    if (isUltrathinkEnabled()) {
      for (const trigger of thinkTriggers) {
        for (let i = trigger.start; i < trigger.end; i++) {
          highlights.push({
            start: i,
            end: i + 1,
            color: getRainbowColor(i - trigger.start),
            shimmerColor: getRainbowColor(i - trigger.start, true),
            priority: 10
          });
        }
      }
    }

    // Same rainbow treatment for the ultraplan keyword
    if (feature('ULTRAPLAN')) {
      for (const trigger of ultraplanTriggers) {
        for (let i = trigger.start; i < trigger.end; i++) {
          highlights.push({
            start: i,
            end: i + 1,
            color: getRainbowColor(i - trigger.start),
            shimmerColor: getRainbowColor(i - trigger.start, true),
            priority: 10
          });
        }
      }
    }

    // Same rainbow treatment for the ultrareview keyword
    for (const trigger of ultrareviewTriggers) {
      for (let i = trigger.start; i < trigger.end; i++) {
        highlights.push({
          start: i,
          end: i + 1,
          color: getRainbowColor(i - trigger.start),
          shimmerColor: getRainbowColor(i - trigger.start, true),
          priority: 10
        });
      }
    }

    // Rainbow for /buddy
    for (const trigger of buddyTriggers) {
      for (let i = trigger.start; i < trigger.end; i++) {
        highlights.push({
          start: i,
          end: i + 1,
          color: getRainbowColor(i - trigger.start),
          shimmerColor: getRainbowColor(i - trigger.start, true),
          priority: 10
        });
      }
    }
    return highlights;
  }, [isSearchingHistory, historyQuery, historyMatch, historyFailedMatch, cursorOffset, btwTriggers, imageRefPositions, memberMentionHighlights, slashCommandTriggers, tokenBudgetTriggers, slackChannelTriggers, displayedValue, voiceInterimRange, thinkTriggers, ultraplanTriggers, ultrareviewTriggers, buddyTriggers]);
  const {
    addNotification,
    removeNotification
  } = useNotifications();

  // Show ultrathink notification
  useEffect(() => {
    if (thinkTriggers.length && isUltrathinkEnabled()) {
      addNotification({
        key: 'ultrathink-active',
        text: 'Effort set to high for this turn',
        priority: 'immediate',
        timeoutMs: 5000
      });
    } else {
      removeNotification('ultrathink-active');
    }
  }, [addNotification, removeNotification, thinkTriggers.length]);
  useEffect(() => {
    if (feature('ULTRAPLAN') && ultraplanTriggers.length) {
      addNotification({
        key: 'ultraplan-active',
        text: 'This prompt will launch an ultraplan session in Claude Code on the web',
        priority: 'immediate',
        timeoutMs: 5000
      });
    } else {
      removeNotification('ultraplan-active');
    }
  }, [addNotification, removeNotification, ultraplanTriggers.length]);
  useEffect(() => {
    if (isUltrareviewEnabled() && ultrareviewTriggers.length) {
      addNotification({
        key: 'ultrareview-active',
        text: 'Run /ultrareview after Claude finishes to review these changes in the cloud',
        priority: 'immediate',
        timeoutMs: 5000
      });
    }
  }, [addNotification, ultrareviewTriggers.length]);

  // Track input length for stash hint
  const prevInputLengthRef = useRef(input.length);
  const peakInputLengthRef = useRef(input.length);

  // Dismiss stash hint when user makes any input change
  const dismissStashHint = useCallback(() => {
    removeNotification('stash-hint');
  }, [removeNotification]);

  // Show stash hint when user gradually clears substantial input
  useEffect(() => {
    const prevLength = prevInputLengthRef.current;
    const peakLength = peakInputLengthRef.current;
    const currentLength = input.length;
    prevInputLengthRef.current = currentLength;

    // Update peak when input grows
    if (currentLength > peakLength) {
      peakInputLengthRef.current = currentLength;
      return;
    }

    // Reset state when input is empty
    if (currentLength === 0) {
      peakInputLengthRef.current = 0;
      return;
    }

    // Detect gradual clear: peak was high, current is low, but this wasn't a single big jump
    // (rapid clears like esc-esc go from 20+ to 0 in one step)
    const clearedSubstantialInput = peakLength >= 20 && currentLength <= 5;
    const wasRapidClear = prevLength >= 20 && currentLength <= 5;
    if (clearedSubstantialInput && !wasRapidClear) {
      const config = getGlobalConfig();
      if (!config.hasUsedStash) {
        addNotification({
          key: 'stash-hint',
          jsx: <Text dimColor>
              Tip:{' '}
              <ConfigurableShortcutHint action="chat:stash" context="Chat" fallback="ctrl+s" description="stash" />
            </Text>,
          priority: 'immediate',
          timeoutMs: FOOTER_TEMPORARY_STATUS_TIMEOUT
        });
      }
      peakInputLengthRef.current = currentLength;
    }
  }, [input.length, addNotification]);

  // Initialize input buffer for undo functionality
  const {
    pushToBuffer,
    undo,
    canUndo,
    clearBuffer
  } = useInputBuffer({
    maxBufferSize: 50,
    debounceMs: 1000
  });
  useMaybeTruncateInput({
    input,
    pastedContents,
    onInputChange: trackAndSetInput,
    setCursorOffset,
    setPastedContents
  });
  const defaultPlaceholder = usePromptInputPlaceholder({
    input,
    submitCount,
    viewingAgentName
  });
  const onChange = useCallback((value: string) => {
    if (value === '?') {
      logEvent('tengu_help_toggled', {});
      setHelpOpen(v => !v);
      return;
    }
    setHelpOpen(false);

    // Dismiss stash hint when user makes any input change
    dismissStashHint();

    // Cancel any pending prompt suggestion and speculation when user types
    abortPromptSuggestion();
    abortSpeculation(setAppState);

    // Check if this is a single character insertion at the start
    const isSingleCharInsertion = value.length === input.length + 1;
    const insertedAtStart = cursorOffset === 0;
    const mode = getModeFromInput(value);
    if (insertedAtStart && mode !== 'prompt') {
      if (isSingleCharInsertion) {
        onModeChange(mode);
        return;
      }
      // Multi-char insertion into empty input (e.g. tab-accepting "! gcloud auth login")
      if (input.length === 0) {
        onModeChange(mode);
        const valueWithoutMode = getValueFromInput(value).replaceAll('\t', '    ');
        pushToBuffer(input, cursorOffset, pastedContents);
        trackAndSetInput(valueWithoutMode);
        setCursorOffset(valueWithoutMode.length);
        return;
      }
    }
    const processedValue = value.replaceAll('\t', '    ');

    // Push current state to buffer before making changes
    if (input !== processedValue) {
      pushToBuffer(input, cursorOffset, pastedContents);
    }

    // Deselect footer items when user types
    setAppState(prev => prev.footerSelection === null ? prev : {
      ...prev,
      footerSelection: null
    });
    trackAndSetInput(processedValue);
  }, [trackAndSetInput, onModeChange, input, cursorOffset, pushToBuffer, pastedContents, dismissStashHint, setAppState]);
  const {
    resetHistory,
    onHistoryUp,
    onHistoryDown,
    dismissSearchHint,
    historyIndex
  } = useArrowKeyHistory((value: string, historyMode: HistoryMode, pastedContents: Record<number, PastedContent>) => {
    onChange(value);
    onModeChange(historyMode);
    setPastedContents(pastedContents);
  }, input, pastedContents, setCursorOffset, mode);

  // Dismiss search hint when user starts searching
  useEffect(() => {
    if (isSearchingHistory) {
      dismissSearchHint();
    }
  }, [isSearchingHistory, dismissSearchHint]);

  // Only use history navigation when there are 0 or 1 slash command suggestions.
  // Footer nav is NOT here — when a pill is selected, TextInput focus=false so
  // these never fire. The Footer keybinding context handles ↑/↓ instead.
  function handleHistoryUp() {
    if (suggestions.length > 1) {
      return;
    }

    // Only navigate history when cursor is on the first line.
    // In multiline inputs, up arrow should move the cursor (handled by TextInput)
    // and only trigger history when at the top of the input.
    if (!isCursorOnFirstLine) {
      return;
    }

    // If there's an editable queued command, move it to the input for editing when UP is pressed
    const hasEditableCommand = queuedCommands.some(isQueuedCommandEditable);
    if (hasEditableCommand) {
      void popAllCommandsFromQueue();
      return;
    }
    onHistoryUp();
  }
  function handleHistoryDown() {
    if (suggestions.length > 1) {
      return;
    }

    // Only navigate history/footer when cursor is on the last line.
    // In multiline inputs, down arrow should move the cursor (handled by TextInput)
    // and only trigger navigation when at the bottom of the input.
    if (!isCursorOnLastLine) {
      return;
    }

    // At bottom of history → enter footer at first visible pill
    if (onHistoryDown() && footerItems.length > 0) {
      const first = footerItems[0]!;
      selectFooterItem(first);
      if (first === 'tasks' && !getGlobalConfig().hasSeenTasksHint) {
        saveGlobalConfig(c => c.hasSeenTasksHint ? c : {
          ...c,
          hasSeenTasksHint: true
        });
      }
    }
  }

  // Create a suggestions state directly - we'll sync it with useTypeahead later
  const [suggestionsState, setSuggestionsStateRaw] = useState<{
    suggestions: SuggestionItem[];
    selectedSuggestion: number;
    commandArgumentHint?: string;
  }>({
    suggestions: [],
    selectedSuggestion: -1,
    commandArgumentHint: undefined
  });

  // Setter for suggestions state
  const setSuggestionsState = useCallback((updater: typeof suggestionsState | ((prev: typeof suggestionsState) => typeof suggestionsState)) => {
    setSuggestionsStateRaw(prev => typeof updater === 'function' ? updater(prev) : updater);
  }, []);
  const onSubmit = useCallback(async (inputParam: string, isSubmittingSlashCommand = false) => {
    inputParam = inputParam.trimEnd();

    // Don't submit if a footer indicator is being opened. Read fresh from
    // store — footer:openSelected calls selectFooterItem(null) then onSubmit
    // in the same tick, and the closure value hasn't updated yet. Apply the
    // same "still visible?" derivation as footerItemSelected so a stale
    // selection (pill disappeared) doesn't swallow Enter.
    const state = store.getState();
    if (state.footerSelection && footerItems.includes(state.footerSelection)) {
      return;
    }

    // Enter in selection modes confirms selection (useBackgroundTaskNavigation).
    // BaseTextInput's useInput registers before that hook (child effects fire first),
    // so without this guard Enter would double-fire and auto-submit the suggestion.
    if (state.viewSelectionMode === 'selecting-agent') {
      return;
    }

    // Check for images early - we need this for suggestion logic below
    const hasImages = Object.values(pastedContents).some(c => c.type === 'image');

    // If input is empty OR matches the suggestion, submit it
    // But if there are images attached, don't auto-accept the suggestion -
    // the user wants to submit just the image(s).
    // Only in leader view — promptSuggestion is leader-context, not teammate.
    const suggestionText = promptSuggestionState.text;
    const inputMatchesSuggestion = inputParam.trim() === '' || inputParam === suggestionText;
    if (inputMatchesSuggestion && suggestionText && !hasImages && !state.viewingAgentTaskId) {
      // If speculation is active, inject messages immediately as they stream
      if (speculation.status === 'active') {
        markAccepted();
        // skipReset: resetSuggestion would abort the speculation before we accept it
        logOutcomeAtSubmission(suggestionText, {
          skipReset: true
        });
        void onSubmitProp(suggestionText, {
          setCursorOffset,
          clearBuffer,
          resetHistory
        }, {
          state: speculation,
          speculationSessionTimeSavedMs: speculationSessionTimeSavedMs,
          setAppState
        });
        return; // Skip normal query - speculation handled it
      }

      // Regular suggestion acceptance (requires shownAt > 0)
      if (promptSuggestionState.shownAt > 0) {
        markAccepted();
        inputParam = suggestionText;
      }
    }

    // Handle @name direct message
    if (isAgentSwarmsEnabled()) {
      const directMessage = parseDirectMemberMessage(inputParam);
      if (directMessage) {
        const result = await sendDirectMemberMessage(directMessage.recipientName, directMessage.message, teamContext, writeToMailbox);
        if (result.success) {
          addNotification({
            key: 'direct-message-sent',
            text: `Sent to @${result.recipientName}`,
            priority: 'immediate',
            timeoutMs: 3000
          });
          trackAndSetInput('');
          setCursorOffset(0);
          clearBuffer();
          resetHistory();
          return;
        } else if (result.error === 'no_team_context') {
          // No team context - fall through to normal prompt submission
        } else {
          // Unknown recipient - fall through to normal prompt submission
          // This allows e.g. "@utils explain this code" to be sent as a prompt
        }
      }
    }

    // Allow submission if there are images attached, even without text
    if (inputParam.trim() === '' && !hasImages) {
      return;
    }

    // PromptInput UX: Check if suggestions dropdown is showing
    // For directory suggestions, allow submission (Tab is used for completion)
    const hasDirectorySuggestions = suggestionsState.suggestions.length > 0 && suggestionsState.suggestions.every(s => s.description === 'directory');
    if (suggestionsState.suggestions.length > 0 && !isSubmittingSlashCommand && !hasDirectorySuggestions) {
      logForDebugging(`[onSubmit] early return: suggestions showing (count=${suggestionsState.suggestions.length})`);
      return; // Don't submit, user needs to clear suggestions first
    }

    // Log suggestion outcome if one exists
    if (promptSuggestionState.text && promptSuggestionState.shownAt > 0) {
      logOutcomeAtSubmission(inputParam);
    }

    // Clear stash hint notification on submit
    removeNotification('stash-hint');

    // Route input to viewed agent (in-process teammate or named local_agent).
    const activeAgent = getActiveAgentForInput(store.getState());
    if (activeAgent.type !== 'leader' && onAgentSubmit) {
      logEvent('tengu_transcript_input_to_teammate', {});
      await onAgentSubmit(inputParam, activeAgent.task, {
        setCursorOffset,
        clearBuffer,
        resetHistory
      });
      return;
    }

    // Normal leader submission
    await onSubmitProp(inputParam, {
      setCursorOffset,
      clearBuffer,
      resetHistory
    });
  }, [promptSuggestionState, speculation, speculationSessionTimeSavedMs, teamContext, store, footerItems, suggestionsState.suggestions, onSubmitProp, onAgentSubmit, clearBuffer, resetHistory, logOutcomeAtSubmission, setAppState, markAccepted, pastedContents, removeNotification]);
  const {
    suggestions,
    selectedSuggestion,
    commandArgumentHint,
    inlineGhostText,
    maxColumnWidth
  } = useTypeahead({
    commands,
    onInputChange: trackAndSetInput,
    onSubmit,
    setCursorOffset,
    input,
    cursorOffset,
    mode,
    agents,
    setSuggestionsState,
    suggestionsState,
    suppressSuggestions: isSearchingHistory || historyIndex > 0,
    markAccepted,
    onModeChange
  });

  // Track if prompt suggestion should be shown (computed later with terminal width).
  // Hidden in teammate view — suggestion is leader-context only.
  const showPromptSuggestion = mode === 'prompt' && suggestions.length === 0 && promptSuggestion && !viewingAgentTaskId;
  if (showPromptSuggestion) {
    markShown();
  }

  // If suggestion was generated but can't be shown due to timing, log suppression.
  // Exclude teammate view: markShown() is gated above, so shownAt stays 0 there —
  // but that's not a timing failure, the suggestion is valid when returning to leader.
  if (promptSuggestionState.text && !promptSuggestion && promptSuggestionState.shownAt === 0 && !viewingAgentTaskId) {
    logSuggestionSuppressed('timing', promptSuggestionState.text);
    setAppState(prev => ({
      ...prev,
      promptSuggestion: {
        text: null,
        promptId: null,
        shownAt: 0,
        acceptedAt: 0,
        generationRequestId: null
      }
    }));
  }
  function onImagePaste(image: string, mediaType?: string, filename?: string, dimensions?: ImageDimensions, sourcePath?: string) {
    logEvent('tengu_paste_image', {});
    onModeChange('prompt');
    const pasteId = nextPasteIdRef.current++;
    const newContent: PastedContent = {
      id: pasteId,
      type: 'image',
      content: image,
      mediaType: mediaType || 'image/png',
      // default to PNG if not provided
      filename: filename || 'Pasted image',
      dimensions,
      sourcePath
    };

    // Cache path immediately (fast) so links work on render
    cacheImagePath(newContent);

    // Store image to disk in background
    void storeImage(newContent);

    // Update UI
    setPastedContents(prev => ({
      ...prev,
      [pasteId]: newContent
    }));
    // Multi-image paste calls onImagePaste in a loop. If the ref is already
    // armed, the previous pill's lazy space fires now (before this pill)
    // rather than being lost.
    const prefix = pendingSpaceAfterPillRef.current ? ' ' : '';
    insertTextAtCursor(prefix + formatImageRef(pasteId));
    pendingSpaceAfterPillRef.current = true;
  }

  // Prune images whose [Image #N] placeholder is no longer in the input text.
  // Covers pill backspace, Ctrl+U, char-by-char deletion — any edit that drops
  // the ref. onImagePaste batches setPastedContents + insertTextAtCursor in the
  // same event, so this effect sees the placeholder already present.
  useEffect(() => {
    const referencedIds = new Set(parseReferences(input).map(r => r.id));
    setPastedContents(prev => {
      const orphaned = Object.values(prev).filter(c => c.type === 'image' && !referencedIds.has(c.id));
      if (orphaned.length === 0) return prev;
      const next = {
        ...prev
      };
      for (const img of orphaned) delete next[img.id];
      return next;
    });
  }, [input, setPastedContents]);
  function onTextPaste(rawText: string) {
    pendingSpaceAfterPillRef.current = false;
    // Clean up pasted text - strip ANSI escape codes and normalize line endings and tabs
    let text = stripAnsi(rawText).replace(/\r/g, '\n').replaceAll('\t', '    ');

    // Match typed/auto-suggest: `!cmd` pasted into empty input enters bash mode.
    if (input.length === 0) {
      const pastedMode = getModeFromInput(text);
      if (pastedMode !== 'prompt') {
        onModeChange(pastedMode);
        text = getValueFromInput(text);
      }
    }
    const numLines = getPastedTextRefNumLines(text);
    // Limit the number of lines to show in the input
    // If the overall layout is too high then Ink will repaint
    // the entire terminal.
    // The actual required height is dependent on the content, this
    // is just an estimate.
    const maxLines = Math.min(rows - 10, 2);

    // Use special handling for long pasted text (>PASTE_THRESHOLD chars)
    // or if it exceeds the number of lines we want to show
    if (text.length > PASTE_THRESHOLD || numLines > maxLines) {
      const pasteId = nextPasteIdRef.current++;
      const newContent: PastedContent = {
        id: pasteId,
        type: 'text',
        content: text
      };
      setPastedContents(prev => ({
        ...prev,
        [pasteId]: newContent
      }));
      insertTextAtCursor(formatPastedTextRef(pasteId, numLines));
    } else {
      // For shorter pastes, just insert the text normally
      insertTextAtCursor(text);
    }
  }
  const lazySpaceInputFilter = useCallback((input: string, key: Key): string => {
    if (!pendingSpaceAfterPillRef.current) return input;
    pendingSpaceAfterPillRef.current = false;
    if (isNonSpacePrintable(input, key)) return ' ' + input;
    return input;
  }, []);
  function insertTextAtCursor(text: string) {
    // Push current state to buffer before inserting
    pushToBuffer(input, cursorOffset, pastedContents);
    const newInput = input.slice(0, cursorOffset) + text + input.slice(cursorOffset);
    trackAndSetInput(newInput);
    setCursorOffset(cursorOffset + text.length);
  }
  const doublePressEscFromEmpty = useDoublePress(() => {}, () => onShowMessageSelector());

  // Function to get the queued command for editing. Returns true if commands were popped.
  const popAllCommandsFromQueue = useCallback((): boolean => {
    const result = popAllEditable(input, cursorOffset);
    if (!result) {
      return false;
    }
    trackAndSetInput(result.text);
    onModeChange('prompt'); // Always prompt mode for queued commands
    setCursorOffset(result.cursorOffset);

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
    return true;
  }, [trackAndSetInput, onModeChange, input, cursorOffset, setPastedContents]);

  // Insert the at-mentioned reference (the file and, optionally, a line range) when
  // we receive an at-mentioned notification the IDE.
  const onIdeAtMentioned = function (atMentioned: IDEAtMentioned) {
    logEvent('tengu_ext_at_mentioned', {});
    let atMentionedText: string;
    const relativePath = path.relative(getCwd(), atMentioned.filePath);
    if (atMentioned.lineStart && atMentioned.lineEnd) {
      atMentionedText = atMentioned.lineStart === atMentioned.lineEnd ? `@${relativePath}#L${atMentioned.lineStart} ` : `@${relativePath}#L${atMentioned.lineStart}-${atMentioned.lineEnd} `;
    } else {
      atMentionedText = `@${relativePath} `;
    }
    const cursorChar = input[cursorOffset - 1] ?? ' ';
    if (!/\s/.test(cursorChar)) {
      atMentionedText = ` ${atMentionedText}`;
    }
    insertTextAtCursor(atMentionedText);
  };
  useIdeAtMentioned(mcpClients, onIdeAtMentioned);

  // Handler for chat:undo - undo last edit
  const handleUndo = useCallback(() => {
    if (canUndo) {
      const previousState = undo();
      if (previousState) {
        trackAndSetInput(previousState.text);
        setCursorOffset(previousState.cursorOffset);
        setPastedContents(previousState.pastedContents);
      }
    }
  }, [canUndo, undo, trackAndSetInput, setPastedContents]);

  // Handler for chat:newline - insert a newline at the cursor position
  const handleNewline = useCallback(() => {
    pushToBuffer(input, cursorOffset, pastedContents);
    const newInput = input.slice(0, cursorOffset) + '\n' + input.slice(cursorOffset);
    trackAndSetInput(newInput);
    setCursorOffset(cursorOffset + 1);
  }, [input, cursorOffset, trackAndSetInput, setCursorOffset, pushToBuffer, pastedContents]);

  // Handler for chat:externalEditor - edit in $EDITOR
  const handleExternalEditor = useCallback(async () => {
    logEvent('tengu_external_editor_used', {});
    setIsExternalEditorActive(true);
    try {
      // Pass pastedContents to expand collapsed text references
      const result = await editPromptInEditor(input, pastedContents);
      if (result.error) {
        addNotification({
          key: 'external-editor-error',
          text: result.error,
          color: 'warning',
          priority: 'high'
        });
      }
      if (result.content !== null && result.content !== input) {
        // Push current state to buffer before making changes
        pushToBuffer(input, cursorOffset, pastedContents);
        trackAndSetInput(result.content);
        setCursorOffset(result.content.length);
      }
    } catch (err) {
      if (err instanceof Error) {
        logError(err);
      }
      addNotification({
        key: 'external-editor-error',
        text: `External editor failed: ${errorMessage(err)}`,
        color: 'warning',
        priority: 'high'
      });
    } finally {
      setIsExternalEditorActive(false);
    }
  }, [input, cursorOffset, pastedContents, pushToBuffer, trackAndSetInput, addNotification]);

  // Handler for chat:stash - stash/unstash prompt
  const handleStash = useCallback(() => {
    if (input.trim() === '' && stashedPrompt !== undefined) {
      // Pop stash when input is empty
      trackAndSetInput(stashedPrompt.text);
      setCursorOffset(stashedPrompt.cursorOffset);
      setPastedContents(stashedPrompt.pastedContents);
      setStashedPrompt(undefined);
    } else if (input.trim() !== '') {
      // Push to stash (save text, cursor position, and pasted contents)
      setStashedPrompt({
        text: input,
        cursorOffset,
        pastedContents
      });
      trackAndSetInput('');
      setCursorOffset(0);
      setPastedContents({});
      // Track usage for /discover and stop showing hint
      saveGlobalConfig(c => {
        if (c.hasUsedStash) return c;
        return {
          ...c,
          hasUsedStash: true
        };
      });
    }
  }, [input, cursorOffset, stashedPrompt, trackAndSetInput, setStashedPrompt, pastedContents, setPastedContents]);

  // Handler for chat:modelPicker - toggle model picker
  const handleModelPicker = useCallback(() => {
    setShowModelPicker(prev => !prev);
    if (helpOpen) {
      setHelpOpen(false);
    }
  }, [helpOpen]);

  // Handler for chat:fastMode - toggle fast mode picker
  const handleFastModePicker = useCallback(() => {
    setShowFastModePicker(prev => !prev);
    if (helpOpen) {
      setHelpOpen(false);
    }
  }, [helpOpen]);

  // Handler for chat:thinkingToggle - toggle thinking mode
  const handleThinkingToggle = useCallback(() => {
    setShowThinkingToggle(prev => !prev);
    if (helpOpen) {
      setHelpOpen(false);
    }
  }, [helpOpen]);

  // Handler for chat:cycleMode - cycle through permission modes
  const handleCycleMode = useCallback(() => {
    // When viewing a teammate, cycle their mode instead of the leader's
    if (isAgentSwarmsEnabled() && viewedTeammate && viewingAgentTaskId) {
      const teammateContext: ToolPermissionContext = {
        ...toolPermissionContext,
        mode: viewedTeammate.permissionMode
      };
      // Pass undefined for teamContext (unused but kept for API compatibility)
      const nextMode = getNextPermissionMode(teammateContext, undefined);
      logEvent('tengu_mode_cycle', {
        to: nextMode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      const teammateTaskId = viewingAgentTaskId;
      setAppState(prev => {
        const task = prev.tasks[teammateTaskId];
        if (!task || task.type !== 'in_process_teammate') {
          return prev;
        }
        if (task.permissionMode === nextMode) {
          return prev;
        }
        return {
          ...prev,
          tasks: {
            ...prev.tasks,
            [teammateTaskId]: {
              ...task,
              permissionMode: nextMode
            }
          }
        };
      });
      if (helpOpen) {
        setHelpOpen(false);
      }
      return;
    }

    // Compute the next mode without triggering side effects first
    logForDebugging(`[auto-mode] handleCycleMode: currentMode=${toolPermissionContext.mode} isAutoModeAvailable=${toolPermissionContext.isAutoModeAvailable} showAutoModeOptIn=${showAutoModeOptIn} timeoutPending=${!!autoModeOptInTimeoutRef.current}`);
    const nextMode = getNextPermissionMode(toolPermissionContext, teamContext);

    // Check if user is entering auto mode for the first time. Gated on the
    // persistent settings flag (hasAutoModeOptIn) rather than the broader
    // hasAutoModeOptInAnySource so that --enable-auto-mode users still see
    // the warning dialog once — the CLI flag should grant carousel access,
    // not bypass the safety text.
    let isEnteringAutoModeFirstTime = false;
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      isEnteringAutoModeFirstTime = nextMode === 'auto' && toolPermissionContext.mode !== 'auto' && !hasAutoModeOptIn() && !viewingAgentTaskId; // Only show for primary agent, not subagents
    }
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      if (isEnteringAutoModeFirstTime) {
        // Store previous mode so we can revert if user declines
        setPreviousModeBeforeAuto(toolPermissionContext.mode);

        // Only update the UI mode label — do NOT call transitionPermissionMode
        // or cyclePermissionMode yet; we haven't confirmed with the user.
        setAppState(prev => ({
          ...prev,
          toolPermissionContext: {
            ...prev.toolPermissionContext,
            mode: 'auto'
          }
        }));
        setToolPermissionContext({
          ...toolPermissionContext,
          mode: 'auto'
        });

        // Show opt-in dialog after 400ms debounce
        if (autoModeOptInTimeoutRef.current) {
          clearTimeout(autoModeOptInTimeoutRef.current);
        }
        autoModeOptInTimeoutRef.current = setTimeout((setShowAutoModeOptIn, autoModeOptInTimeoutRef) => {
          setShowAutoModeOptIn(true);
          autoModeOptInTimeoutRef.current = null;
        }, 400, setShowAutoModeOptIn, autoModeOptInTimeoutRef);
        if (helpOpen) {
          setHelpOpen(false);
        }
        return;
      }
    }

    // Dismiss auto mode opt-in dialog if showing or pending (user is cycling away).
    // Do NOT revert to previousModeBeforeAuto here — shift+tab means "advance the
    // carousel", not "decline". Reverting causes a ping-pong loop: auto reverts to
    // the prior mode, whose next mode is auto again, forever.
    // The dialog's own decline button (handleAutoModeOptInDecline) handles revert.
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      if (showAutoModeOptIn || autoModeOptInTimeoutRef.current) {
        if (showAutoModeOptIn) {
          logEvent('tengu_auto_mode_opt_in_dialog_decline', {});
        }
        setShowAutoModeOptIn(false);
        if (autoModeOptInTimeoutRef.current) {
          clearTimeout(autoModeOptInTimeoutRef.current);
          autoModeOptInTimeoutRef.current = null;
        }
        setPreviousModeBeforeAuto(null);
        // Fall through — mode is 'auto', cyclePermissionMode below goes to 'default'.
      }
    }

    // Now that we know this is NOT the first-time auto mode path,
    // call cyclePermissionMode to apply side effects (e.g. strip
    // dangerous permissions, activate classifier)
    const {
      context: preparedContext
    } = cyclePermissionMode(toolPermissionContext, teamContext);
    logEvent('tengu_mode_cycle', {
      to: nextMode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });

    // Track when user enters plan mode
    if (nextMode === 'plan') {
      saveGlobalConfig(current => ({
        ...current,
        lastPlanModeUse: Date.now()
      }));
    }

    // Set the mode via setAppState directly because setToolPermissionContext
    // intentionally preserves the existing mode (to prevent coordinator mode
    // corruption from workers). Then call setToolPermissionContext to trigger
    // recheck of queued permission prompts.
    setAppState(prev => ({
      ...prev,
      toolPermissionContext: {
        ...preparedContext,
        mode: nextMode
      }
    }));
    setToolPermissionContext({
      ...preparedContext,
      mode: nextMode
    });

    // If this is a teammate, update config.json so team lead sees the change
    syncTeammateMode(nextMode, teamContext?.teamName);

    // Close help tips if they're open when mode is cycled
    if (helpOpen) {
      setHelpOpen(false);
    }
  }, [toolPermissionContext, teamContext, viewingAgentTaskId, viewedTeammate, setAppState, setToolPermissionContext, helpOpen, showAutoModeOptIn]);

  // Handler for auto mode opt-in dialog acceptance
  const handleAutoModeOptInAccept = useCallback(() => {
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      setShowAutoModeOptIn(false);
      setPreviousModeBeforeAuto(null);

      // Now that the user accepted, apply the full transition: activate the
      // auto mode backend (classifier, beta headers) and strip dangerous
      // permissions (e.g. Bash(*) always-allow rules).
      const strippedContext = transitionPermissionMode(previousModeBeforeAuto ?? toolPermissionContext.mode, 'auto', toolPermissionContext);
      setAppState(prev => ({
        ...prev,
        toolPermissionContext: {
          ...strippedContext,
          mode: 'auto'
        }
      }));
      setToolPermissionContext({
        ...strippedContext,
        mode: 'auto'
      });

      // Close help tips if they're open when auto mode is enabled
      if (helpOpen) {
        setHelpOpen(false);
      }
    }
  }, [helpOpen, setHelpOpen, previousModeBeforeAuto, toolPermissionContext, setAppState, setToolPermissionContext]);

  // Handler for auto mode opt-in dialog decline
  const handleAutoModeOptInDecline = useCallback(() => {
    if (feature('TRANSCRIPT_CLASSIFIER')) {
      logForDebugging(`[auto-mode] handleAutoModeOptInDecline: reverting to ${previousModeBeforeAuto}, setting isAutoModeAvailable=false`);
      setShowAutoModeOptIn(false);
      if (autoModeOptInTimeoutRef.current) {
        clearTimeout(autoModeOptInTimeoutRef.current);
        autoModeOptInTimeoutRef.current = null;
      }

      // Revert to previous mode and remove auto from the carousel
      // for the rest of this session
      if (previousModeBeforeAuto) {
        setAutoModeActive(false);
        setAppState(prev => ({
          ...prev,
          toolPermissionContext: {
            ...prev.toolPermissionContext,
            mode: previousModeBeforeAuto,
            isAutoModeAvailable: false
          }
        }));
        setToolPermissionContext({
          ...toolPermissionContext,
          mode: previousModeBeforeAuto,
          isAutoModeAvailable: false
        });
        setPreviousModeBeforeAuto(null);
      }
    }
  }, [previousModeBeforeAuto, toolPermissionContext, setAppState, setToolPermissionContext]);

  // Handler for chat:imagePaste - paste image from clipboard
  const handleImagePaste = useCallback(() => {
    void getImageFromClipboard().then(imageData => {
      if (imageData) {
        onImagePaste(imageData.base64, imageData.mediaType);
      } else {
        const shortcutDisplay = getShortcutDisplay('chat:imagePaste', 'Chat', 'ctrl+v');
        const message = env.isSSH() ? "No image found in clipboard. You're SSH'd; try scp?" : `No image found in clipboard. Use ${shortcutDisplay} to paste images.`;
        addNotification({
          key: 'no-image-in-clipboard',
          text: message,
          priority: 'immediate',
          timeoutMs: 1000
        });
      }
    });
  }, [addNotification, onImagePaste]);

  // Register chat:submit handler directly in the handler registry (not via
  // useKeybindings) so that only the ChordInterceptor can invoke it for chord
  // completions (e.g., "ctrl+e s"). The default Enter binding for submit is
  // handled by TextInput directly (via onSubmit prop) and useTypeahead (for
  // autocomplete acceptance). Using useKeybindings would cause
  // stopImmediatePropagation on Enter, blocking autocomplete from seeing the key.
  const keybindingContext = useOptionalKeybindingContext();
  useEffect(() => {
    if (!keybindingContext || isModalOverlayActive) return;
    return keybindingContext.registerHandler({
      action: 'chat:submit',
      context: 'Chat',
      handler: () => {
        void onSubmit(input);
      }
    });
  }, [keybindingContext, isModalOverlayActive, onSubmit, input]);

  // Chat context keybindings for editing shortcuts
  // Note: history:previous/history:next are NOT handled here. They are passed as
  // onHistoryUp/onHistoryDown props to TextInput, so that useTextInput's
  // upOrHistoryUp/downOrHistoryDown can try cursor movement first and only
  // fall through to history when the cursor can't move further.
  const chatHandlers = useMemo(() => ({
    'chat:undo': handleUndo,
    'chat:newline': handleNewline,
    'chat:externalEditor': handleExternalEditor,
    'chat:stash': handleStash,
    'chat:modelPicker': handleModelPicker,
    'chat:thinkingToggle': handleThinkingToggle,
    'chat:cycleMode': handleCycleMode,
    'chat:imagePaste': handleImagePaste
  }), [handleUndo, handleNewline, handleExternalEditor, handleStash, handleModelPicker, handleThinkingToggle, handleCycleMode, handleImagePaste]);
  useKeybindings(chatHandlers, {
    context: 'Chat',
    isActive: !isModalOverlayActive
  });

  // Shift+↑ enters message-actions cursor. Separate isActive so ctrl+r search
  // doesn't leave stale isSearchingHistory on cursor-exit remount.
  useKeybinding('chat:messageActions', () => onMessageActionsEnter?.(), {
    context: 'Chat',
    isActive: !isModalOverlayActive && !isSearchingHistory
  });

  // Fast mode keybinding is only active when fast mode is enabled and available
  useKeybinding('chat:fastMode', handleFastModePicker, {
    context: 'Chat',
    isActive: !isModalOverlayActive && isFastModeEnabled() && isFastModeAvailable()
  });

  // Handle help:dismiss keybinding (ESC closes help menu)
  // This is registered separately from Chat context so it has priority over
  // CancelRequestHandler when help menu is open
  useKeybinding('help:dismiss', () => {
    setHelpOpen(false);
  }, {
    context: 'Help',
    isActive: helpOpen
  });

  // Quick Open / Global Search. Hook calls are unconditional (Rules of Hooks);
  // the handler body is feature()-gated so the setState calls and component
  // references get tree-shaken in external builds.
  const quickSearchActive = feature('QUICK_SEARCH') ? !isModalOverlayActive : false;
  useKeybinding('app:quickOpen', () => {
    if (feature('QUICK_SEARCH')) {
      setShowQuickOpen(true);
      setHelpOpen(false);
    }
  }, {
    context: 'Global',
    isActive: quickSearchActive
  });
  useKeybinding('app:globalSearch', () => {
    if (feature('QUICK_SEARCH')) {
      setShowGlobalSearch(true);
      setHelpOpen(false);
    }
  }, {
    context: 'Global',
    isActive: quickSearchActive
  });
  useKeybinding('history:search', () => {
    if (feature('HISTORY_PICKER')) {
      setShowHistoryPicker(true);
      setHelpOpen(false);
    }
  }, {
    context: 'Global',
    isActive: feature('HISTORY_PICKER') ? !isModalOverlayActive : false
  });

  // Handle Ctrl+C to abort speculation when idle (not loading)
  // CancelRequestHandler only handles Ctrl+C during active tasks
  useKeybinding('app:interrupt', () => {
    abortSpeculation(setAppState);
  }, {
    context: 'Global',
    isActive: !isLoading && speculation.status === 'active'
  });

  // Footer indicator navigation keybindings. ↑/↓ live here (not in
  // handleHistoryUp/Down) because TextInput focus=false when a pill is
  // selected — its useInput is inactive, so this is the only path.
  useKeybindings({
    'footer:up': () => {
      // ↑ scrolls within the coordinator task list before leaving the pill
      if (tasksSelected && "external" === 'ant' && coordinatorTaskCount > 0 && coordinatorTaskIndex > minCoordinatorIndex) {
        setCoordinatorTaskIndex(prev => prev - 1);
        return;
      }
      navigateFooter(-1, true);
    },
    'footer:down': () => {
      // ↓ scrolls within the coordinator task list, never leaves the pill
      if (tasksSelected && "external" === 'ant' && coordinatorTaskCount > 0) {
        if (coordinatorTaskIndex < coordinatorTaskCount - 1) {
          setCoordinatorTaskIndex(prev => prev + 1);
        }
        return;
      }
      if (tasksSelected && !isTeammateMode) {
        setShowBashesDialog(true);
        selectFooterItem(null);
        return;
      }
      navigateFooter(1);
    },
    'footer:next': () => {
      // Teammate mode: ←/→ cycles within the team member list
      if (tasksSelected && isTeammateMode) {
        const totalAgents = 1 + inProcessTeammates.length;
        setTeammateFooterIndex(prev => (prev + 1) % totalAgents);
        return;
      }
      navigateFooter(1);
    },
    'footer:previous': () => {
      if (tasksSelected && isTeammateMode) {
        const totalAgents = 1 + inProcessTeammates.length;
        setTeammateFooterIndex(prev => (prev - 1 + totalAgents) % totalAgents);
        return;
      }
      navigateFooter(-1);
    },
    'footer:openSelected': () => {
      if (viewSelectionMode === 'selecting-agent') {
        return;
      }
      switch (footerItemSelected) {
        case 'companion':
          if (feature('BUDDY')) {
            selectFooterItem(null);
            void onSubmit('/buddy');
          }
          break;
        case 'tasks':
          if (isTeammateMode) {
            // Enter switches to the selected agent's view
            if (teammateFooterIndex === 0) {
              exitTeammateView(setAppState);
            } else {
              const teammate = inProcessTeammates[teammateFooterIndex - 1];
              if (teammate) enterTeammateView(teammate.id, setAppState);
            }
          } else if (coordinatorTaskIndex === 0 && coordinatorTaskCount > 0) {
            exitTeammateView(setAppState);
          } else {
            const selectedTaskId = getVisibleAgentTasks(tasks)[coordinatorTaskIndex - 1]?.id;
            if (selectedTaskId) {
              enterTeammateView(selectedTaskId, setAppState);
            } else {
              setShowBashesDialog(true);
              selectFooterItem(null);
            }
          }
          break;
        case 'tmux':
          if ("external" === 'ant') {
            setAppState(prev => prev.tungstenPanelAutoHidden ? {
              ...prev,
              tungstenPanelAutoHidden: false
            } : {
              ...prev,
              tungstenPanelVisible: !(prev.tungstenPanelVisible ?? true)
            });
          }
          break;
        case 'bagel':
          break;
        case 'teams':
          setShowTeamsDialog(true);
          selectFooterItem(null);
          break;
        case 'bridge':
          setShowBridgeDialog(true);
          selectFooterItem(null);
          break;
      }
    },
    'footer:clearSelection': () => {
      selectFooterItem(null);
    },
    'footer:close': () => {
      if (tasksSelected && coordinatorTaskIndex >= 1) {
        const task = getVisibleAgentTasks(tasks)[coordinatorTaskIndex - 1];
        if (!task) return false;
        // When the selected row IS the viewed agent, 'x' types into the
        // steering input. Any other row — dismiss it.
        if (viewSelectionMode === 'viewing-agent' && task.id === viewingAgentTaskId) {
          onChange(input.slice(0, cursorOffset) + 'x' + input.slice(cursorOffset));
          setCursorOffset(cursorOffset + 1);
          return;
        }
        stopOrDismissAgent(task.id, setAppState);
        if (task.status !== 'running') {
          setCoordinatorTaskIndex(i => Math.max(minCoordinatorIndex, i - 1));
        }
        return;
      }
      // Not handled — let 'x' fall through to type-to-exit
      return false;
    }
  }, {
    context: 'Footer',
    isActive: !!footerItemSelected && !isModalOverlayActive
  });
  useInput((char, key) => {
    // Skip all input handling when a full-screen dialog is open. These dialogs
    // render via early return, but hooks run unconditionally — so without this
    // guard, Escape inside a dialog leaks to the double-press message-selector.
    if (showTeamsDialog || showQuickOpen || showGlobalSearch || showHistoryPicker) {
      return;
    }

    // Detect failed Alt shortcuts on macOS (Option key produces special characters)
    if (getPlatform() === 'macos' && isMacosOptionChar(char)) {
      const shortcut = MACOS_OPTION_SPECIAL_CHARS[char];
      const terminalName = getNativeCSIuTerminalDisplayName();
      const jsx = terminalName ? <Text dimColor>
          To enable {shortcut}, set <Text bold>Option as Meta</Text> in{' '}
          {terminalName} preferences (⌘,)
        </Text> : <Text dimColor>To enable {shortcut}, run /terminal-setup</Text>;
      addNotification({
        key: 'option-meta-hint',
        jsx,
        priority: 'immediate',
        timeoutMs: 5000
      });
      // Don't return - let the character be typed so user sees the issue
    }

    // Footer navigation is handled via useKeybindings above (Footer context)

    // NOTE: ctrl+_, ctrl+g, ctrl+s are handled via Chat context keybindings above

    // Type-to-exit footer: printable chars while a pill is selected refocus
    // the input and type the char. Nav keys are captured by useKeybindings
    // above, so anything reaching here is genuinely not a footer action.
    // onChange clears footerSelection, so no explicit deselect.
    if (footerItemSelected && char && !key.ctrl && !key.meta && !key.escape && !key.return) {
      onChange(input.slice(0, cursorOffset) + char + input.slice(cursorOffset));
      setCursorOffset(cursorOffset + char.length);
      return;
    }

    // Exit special modes when backspace/escape/delete/ctrl+u is pressed at cursor position 0
    if (cursorOffset === 0 && (key.escape || key.backspace || key.delete || key.ctrl && char === 'u')) {
      onModeChange('prompt');
      setHelpOpen(false);
    }

    // Exit help mode when backspace is pressed and input is empty
    if (helpOpen && input === '' && (key.backspace || key.delete)) {
      setHelpOpen(false);
    }

    // esc is a little overloaded:
    // - when we're loading a response, it's used to cancel the request
    // - otherwise, it's used to show the message selector
    // - when double pressed, it's used to clear the input
    // - when input is empty, pop from command queue

    // Handle ESC key press
    if (key.escape) {
      // Abort active speculation
      if (speculation.status === 'active') {
        abortSpeculation(setAppState);
        return;
      }

      // Dismiss side question response if visible
      if (isSideQuestionVisible && onDismissSideQuestion) {
        onDismissSideQuestion();
        return;
      }

      // Close help menu if open
      if (helpOpen) {
        setHelpOpen(false);
        return;
      }

      // Footer selection clearing is now handled via Footer context keybindings
      // (footer:clearSelection action bound to escape)
      // If a footer item is selected, let the Footer keybinding handle it
      if (footerItemSelected) {
        return;
      }

      // If there's an editable queued command, move it to the input for editing when ESC is pressed
      const hasEditableCommand = queuedCommands.some(isQueuedCommandEditable);
      if (hasEditableCommand) {
        void popAllCommandsFromQueue();
        return;
      }
      if (messages.length > 0 && !input && !isLoading) {
        doublePressEscFromEmpty();
      }
    }
    if (key.return && helpOpen) {
      setHelpOpen(false);
    }
  });
  const swarmBanner = useSwarmBanner();
  const fastModeCooldown = isFastModeEnabled() ? isFastModeCooldown() : false;
  const showFastIcon = isFastModeEnabled() ? isFastMode && (isFastModeAvailable() || fastModeCooldown) : false;
  const showFastIconHint = useShowFastIconHint(showFastIcon ?? false);

  // Show effort notification on startup and when effort changes.
  // Suppressed in brief/assistant mode — the value reflects the local
  // client's effort, not the connected agent's.
  const effortNotificationText = briefOwnsGap ? undefined : getEffortNotificationText(effortValue, mainLoopModel);
  useEffect(() => {
    if (!effortNotificationText) {
      removeNotification('effort-level');
      return;
    }
    addNotification({
      key: 'effort-level',
      text: effortNotificationText,
      priority: 'high',
      timeoutMs: 12_000
    });
  }, [effortNotificationText, addNotification, removeNotification]);
  useBuddyNotification();
  const companionSpeaking = feature('BUDDY') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useAppState(s => s.companionReaction !== undefined) : false;
  const {
    columns,
    rows
  } = useTerminalSize();
  const textInputColumns = columns - 3 - companionReservedColumns(columns, companionSpeaking);

  // POC: click-to-position-cursor. Mouse tracking is only enabled inside
  // <AlternateScreen>, so this is dormant in the normal main-screen REPL.
  // localCol/localRow are relative to the onClick Box's top-left; the Box
  // tightly wraps the text input so they map directly to (column, line)
  // in the Cursor wrap model. MeasuredText.getOffsetFromPosition handles
  // wide chars, wrapped lines, and clamps past-end clicks to line end.
  const maxVisibleLines = isFullscreenEnvEnabled() ? Math.max(MIN_INPUT_VIEWPORT_LINES, Math.floor(rows / 2) - PROMPT_FOOTER_LINES) : undefined;
  const handleInputClick = useCallback((e: ClickEvent) => {
    // During history search the displayed text is historyMatch, not
    // input, and showCursor is false anyway — skip rather than
    // compute an offset against the wrong string.
    if (!input || isSearchingHistory) return;
    const c = Cursor.fromText(input, textInputColumns, cursorOffset);
    const viewportStart = c.getViewportStartLine(maxVisibleLines);
    const offset = c.measuredText.getOffsetFromPosition({
      line: e.localRow + viewportStart,
      column: e.localCol
    });
    setCursorOffset(offset);
  }, [input, textInputColumns, isSearchingHistory, cursorOffset, maxVisibleLines]);
  const handleOpenTasksDialog = useCallback((taskId?: string) => setShowBashesDialog(taskId ?? true), [setShowBashesDialog]);
  const placeholder = showPromptSuggestion && promptSuggestion ? promptSuggestion : defaultPlaceholder;

  // Calculate if input has multiple lines
  const isInputWrapped = useMemo(() => input.includes('\n'), [input]);

  // Memoized callbacks for model picker to prevent re-renders when unrelated
  // state (like notifications) changes. This prevents the inline model picker
  // from visually "jumping" when notifications arrive.
  const handleModelSelect = useCallback((model: string | null, _effort: EffortLevel | undefined) => {
    let wasFastModeDisabled = false;
    setAppState(prev => {
      wasFastModeDisabled = isFastModeEnabled() && !isFastModeSupportedByModel(model) && !!prev.fastMode;
      return {
        ...prev,
        mainLoopModel: model,
        mainLoopModelForSession: null,
        // Turn off fast mode if switching to a model that doesn't support it
        ...(wasFastModeDisabled && {
          fastMode: false
        })
      };
    });
    setShowModelPicker(false);
    const effectiveFastMode = (isFastMode ?? false) && !wasFastModeDisabled;
    let message = `Model set to ${modelDisplayString(model)}`;
    if (isBilledAsExtraUsage(model, effectiveFastMode, isOpus1mMergeEnabled())) {
      message += ' · Billed as extra usage';
    }
    if (wasFastModeDisabled) {
      message += ' · Fast mode OFF';
    }
    addNotification({
      key: 'model-switched',
      jsx: <Text>{message}</Text>,
      priority: 'immediate',
      timeoutMs: 3000
    });
    logEvent('tengu_model_picker_hotkey', {
      model: model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
  }, [setAppState, addNotification, isFastMode]);
  const handleModelCancel = useCallback(() => {
    setShowModelPicker(false);
  }, []);

  // Memoize the model picker element to prevent unnecessary re-renders
  // when AppState changes for unrelated reasons (e.g., notifications arriving)
  const modelPickerElement = useMemo(() => {
    if (!showModelPicker) return null;
    return <Box flexDirection="column" marginTop={1}>
        <ModelPicker initial={mainLoopModel_} sessionModel={mainLoopModelForSession} onSelect={handleModelSelect} onCancel={handleModelCancel} isStandaloneCommand showFastModeNotice={isFastModeEnabled() && isFastMode && isFastModeSupportedByModel(mainLoopModel_) && isFastModeAvailable()} />
      </Box>;
  }, [showModelPicker, mainLoopModel_, mainLoopModelForSession, handleModelSelect, handleModelCancel]);
  const handleFastModeSelect = useCallback((result?: string) => {
    setShowFastModePicker(false);
    if (result) {
      addNotification({
        key: 'fast-mode-toggled',
        jsx: <Text>{result}</Text>,
        priority: 'immediate',
        timeoutMs: 3000
      });
    }
  }, [addNotification]);

  // Memoize the fast mode picker element
  const fastModePickerElement = useMemo(() => {
    if (!showFastModePicker) return null;
    return <Box flexDirection="column" marginTop={1}>
        <FastModePicker onDone={handleFastModeSelect} unavailableReason={getFastModeUnavailableReason()} />
      </Box>;
  }, [showFastModePicker, handleFastModeSelect]);

  // Memoized callbacks for thinking toggle
  const handleThinkingSelect = useCallback((enabled: boolean) => {
    setAppState(prev => ({
      ...prev,
      thinkingEnabled: enabled
    }));
    setShowThinkingToggle(false);
    logEvent('tengu_thinking_toggled_hotkey', {
      enabled
    });
    addNotification({
      key: 'thinking-toggled-hotkey',
      jsx: <Text color={enabled ? 'suggestion' : undefined} dimColor={!enabled}>
            Thinking {enabled ? 'on' : 'off'}
          </Text>,
      priority: 'immediate',
      timeoutMs: 3000
    });
  }, [setAppState, addNotification]);
  const handleThinkingCancel = useCallback(() => {
    setShowThinkingToggle(false);
  }, []);

  // Memoize the thinking toggle element
  const thinkingToggleElement = useMemo(() => {
    if (!showThinkingToggle) return null;
    return <Box flexDirection="column" marginTop={1}>
        <ThinkingToggle currentValue={thinkingEnabled ?? true} onSelect={handleThinkingSelect} onCancel={handleThinkingCancel} isMidConversation={messages.some(m => m.type === 'assistant')} />
      </Box>;
  }, [showThinkingToggle, thinkingEnabled, handleThinkingSelect, handleThinkingCancel, messages.length]);

  // Portal dialog to DialogOverlay in fullscreen so it escapes the bottom
  // slot's overflowY:hidden clip (same pattern as SuggestionsOverlay).
  // Must be called before early returns below to satisfy rules-of-hooks.
  // Memoized so the portal useEffect doesn't churn on every PromptInput render.
  const autoModeOptInDialog = useMemo(() => feature('TRANSCRIPT_CLASSIFIER') && showAutoModeOptIn ? <AutoModeOptInDialog onAccept={handleAutoModeOptInAccept} onDecline={handleAutoModeOptInDecline} /> : null, [showAutoModeOptIn, handleAutoModeOptInAccept, handleAutoModeOptInDecline]);
  useSetPromptOverlayDialog(isFullscreenEnvEnabled() ? autoModeOptInDialog : null);
  if (showBashesDialog) {
    return <BackgroundTasksDialog onDone={() => setShowBashesDialog(false)} toolUseContext={getToolUseContext(messages, [], new AbortController(), mainLoopModel)} initialDetailTaskId={typeof showBashesDialog === 'string' ? showBashesDialog : undefined} />;
  }
  if (isAgentSwarmsEnabled() && showTeamsDialog) {
    return <TeamsDialog initialTeams={cachedTeams} onDone={() => {
      setShowTeamsDialog(false);
    }} />;
  }
  if (feature('QUICK_SEARCH')) {
    const insertWithSpacing = (text: string) => {
      const cursorChar = input[cursorOffset - 1] ?? ' ';
      insertTextAtCursor(/\s/.test(cursorChar) ? text : ` ${text}`);
    };
    if (showQuickOpen) {
      return <QuickOpenDialog onDone={() => setShowQuickOpen(false)} onInsert={insertWithSpacing} />;
    }
    if (showGlobalSearch) {
      return <GlobalSearchDialog onDone={() => setShowGlobalSearch(false)} onInsert={insertWithSpacing} />;
    }
  }
  if (feature('HISTORY_PICKER') && showHistoryPicker) {
    return <HistorySearchDialog initialQuery={input} onSelect={entry => {
      const entryMode = getModeFromInput(entry.display);
      const value = getValueFromInput(entry.display);
      onModeChange(entryMode);
      trackAndSetInput(value);
      setPastedContents(entry.pastedContents);
      setCursorOffset(value.length);
      setShowHistoryPicker(false);
    }} onCancel={() => setShowHistoryPicker(false)} />;
  }

  // Show loop mode menu when requested (ant-only, eliminated from external builds)
  if (modelPickerElement) {
    return modelPickerElement;
  }
  if (fastModePickerElement) {
    return fastModePickerElement;
  }
  if (thinkingToggleElement) {
    return thinkingToggleElement;
  }
  if (showBridgeDialog) {
    return <BridgeDialog onDone={() => {
      setShowBridgeDialog(false);
      selectFooterItem(null);
    }} />;
  }
  const baseProps: BaseTextInputProps = {
    multiline: true,
    onSubmit,
    onChange,
    value: historyMatch ? getValueFromInput(typeof historyMatch === 'string' ? historyMatch : historyMatch.display) : input,
    // History navigation is handled via TextInput props (onHistoryUp/onHistoryDown),
    // NOT via useKeybindings. This allows useTextInput's upOrHistoryUp/downOrHistoryDown
    // to try cursor movement first and only fall through to history navigation when the
    // cursor can't move further (important for wrapped text and multi-line input).
    onHistoryUp: handleHistoryUp,
    onHistoryDown: handleHistoryDown,
    onHistoryReset: resetHistory,
    placeholder,
    onExit,
    onExitMessage: (show, key) => setExitMessage({
      show,
      key
    }),
    onImagePaste,
    columns: textInputColumns,
    maxVisibleLines,
    disableCursorMovementForUpDownKeys: suggestions.length > 0 || !!footerItemSelected,
    disableEscapeDoublePress: suggestions.length > 0,
    cursorOffset,
    onChangeCursorOffset: setCursorOffset,
    onPaste: onTextPaste,
    onIsPastingChange: setIsPasting,
    focus: !isSearchingHistory && !isModalOverlayActive && !footerItemSelected,
    showCursor: !footerItemSelected && !isSearchingHistory && !cursorAtImageChip,
    argumentHint: commandArgumentHint,
    onUndo: canUndo ? () => {
      const previousState = undo();
      if (previousState) {
        trackAndSetInput(previousState.text);
        setCursorOffset(previousState.cursorOffset);
        setPastedContents(previousState.pastedContents);
      }
    } : undefined,
    highlights: combinedHighlights,
    inlineGhostText,
    inputFilter: lazySpaceInputFilter
  };
  const getBorderColor = (): keyof Theme => {
    const modeColors: Record<string, keyof Theme> = {
      bash: 'bashBorder'
    };

    // Mode colors take priority, then teammate color, then default
    if (modeColors[mode]) {
      return modeColors[mode];
    }

    // In-process teammates run headless - don't apply teammate colors to leader UI
    if (isInProcessTeammate()) {
      return 'promptBorder';
    }

    // Check for teammate color from environment
    const teammateColorName = getTeammateColor();
    if (teammateColorName && AGENT_COLORS.includes(teammateColorName as AgentColorName)) {
      return AGENT_COLOR_TO_THEME_COLOR[teammateColorName as AgentColorName];
    }
    return 'promptBorder';
  };
  if (isExternalEditorActive) {
    return <Box flexDirection="row" alignItems="center" justifyContent="center" borderColor={getBorderColor()} borderStyle="round" borderLeft={false} borderRight={false} borderBottom width="100%">
        <Text dimColor italic>
          Save and close editor to continue...
        </Text>
      </Box>;
  }
  const textInputElement = isVimModeEnabled() ? <VimTextInput {...baseProps} initialMode={vimMode} onModeChange={setVimMode} /> : <TextInput {...baseProps} />;
  return <Box flexDirection="column" marginTop={briefOwnsGap ? 0 : 1}>
      {!isFullscreenEnvEnabled() && <PromptInputQueuedCommands />}
      {hasSuppressedDialogs && <Box marginTop={1} marginLeft={2}>
          <Text dimColor>Waiting for permission…</Text>
        </Box>}
      <PromptInputStashNotice hasStash={stashedPrompt !== undefined} />
      {swarmBanner ? <>
          <Text color={swarmBanner.bgColor}>
            {swarmBanner.text ? <>
                {'─'.repeat(Math.max(0, columns - stringWidth(swarmBanner.text) - 4))}
                <Text backgroundColor={swarmBanner.bgColor} color="inverseText">
                  {' '}
                  {swarmBanner.text}{' '}
                </Text>
                {'──'}
              </> : '─'.repeat(columns)}
          </Text>
          <Box flexDirection="row" width="100%">
            <PromptInputModeIndicator mode={mode} isLoading={isLoading} viewingAgentName={viewingAgentName} viewingAgentColor={viewingAgentColor} />
            <Box flexGrow={1} flexShrink={1} onClick={handleInputClick}>
              {textInputElement}
            </Box>
          </Box>
          <Text color={swarmBanner.bgColor}>{'─'.repeat(columns)}</Text>
        </> : <Box flexDirection="row" alignItems="flex-start" justifyContent="flex-start" borderColor={getBorderColor()} borderStyle="round" borderLeft={false} borderRight={false} borderBottom width="100%" borderText={buildBorderText(showFastIcon ?? false, showFastIconHint, fastModeCooldown)}>
          <PromptInputModeIndicator mode={mode} isLoading={isLoading} viewingAgentName={viewingAgentName} viewingAgentColor={viewingAgentColor} />
          <Box flexGrow={1} flexShrink={1} onClick={handleInputClick}>
            {textInputElement}
          </Box>
        </Box>}
      <PromptInputFooter apiKeyStatus={apiKeyStatus} debug={debug} exitMessage={exitMessage} vimMode={isVimModeEnabled() ? vimMode : undefined} mode={mode} autoUpdaterResult={autoUpdaterResult} isAutoUpdating={isAutoUpdating} verbose={verbose} onAutoUpdaterResult={onAutoUpdaterResult} onChangeIsUpdating={setIsAutoUpdating} suggestions={suggestions} selectedSuggestion={selectedSuggestion} maxColumnWidth={maxColumnWidth} toolPermissionContext={effectiveToolPermissionContext} helpOpen={helpOpen} suppressHint={input.length > 0} isLoading={isLoading} tasksSelected={tasksSelected} teamsSelected={teamsSelected} bridgeSelected={bridgeSelected} tmuxSelected={tmuxSelected} teammateFooterIndex={teammateFooterIndex} ideSelection={ideSelection} mcpClients={mcpClients} isPasting={isPasting} isInputWrapped={isInputWrapped} messages={messages} isSearching={isSearchingHistory} historyQuery={historyQuery} setHistoryQuery={setHistoryQuery} historyFailedMatch={historyFailedMatch} onOpenTasksDialog={isFullscreenEnvEnabled() ? handleOpenTasksDialog : undefined} />
      {isFullscreenEnvEnabled() ? null : autoModeOptInDialog}
      {isFullscreenEnvEnabled() ?
    // position=absolute takes zero layout height so the spinner
    // doesn't shift when a notification appears/disappears. Yoga
    // anchors absolute children at the parent's content-box origin;
    // marginTop=-1 pulls it into the marginTop=1 gap row above the
    // prompt border. In brief mode there is no such gap (briefOwnsGap
    // strips our marginTop) and BriefSpinner sits flush against the
    // border — marginTop=-2 skips over the spinner content into
    // BriefSpinner's own marginTop=1 blank row. height=1 +
    // overflow=hidden clips multi-line notifications to a single row.
    // flex-end anchors the bottom line so the visible row is always
    // the most recent. Suppressed while the slash overlay or
    // auto-mode opt-in dialog is up by height=0 (NOT unmount) — this
    // Box renders later in tree order so it would paint over their
    // bottom row. Keeping Notifications mounted prevents AutoUpdater's
    // initial-check effect from re-firing on every slash-completion
    // toggle (PR#22413).
    <Box position="absolute" marginTop={briefOwnsGap ? -2 : -1} height={suggestions.length === 0 && !showAutoModeOptIn ? 1 : 0} width="100%" paddingLeft={2} paddingRight={1} flexDirection="column" justifyContent="flex-end" overflow="hidden">
          <Notifications apiKeyStatus={apiKeyStatus} autoUpdaterResult={autoUpdaterResult} debug={debug} isAutoUpdating={isAutoUpdating} verbose={verbose} messages={messages} onAutoUpdaterResult={onAutoUpdaterResult} onChangeIsUpdating={setIsAutoUpdating} ideSelection={ideSelection} mcpClients={mcpClients} isInputWrapped={isInputWrapped} />
        </Box> : null}
    </Box>;
}

/**
 * Compute the initial paste ID by finding the max ID used in existing messages.
 * This handles --continue/--resume scenarios where we need to avoid ID collisions.
 */
function getInitialPasteId(messages: Message[]): number {
  let maxId = 0;
  for (const message of messages) {
    if (message.type === 'user') {
      // Check image paste IDs
      if (message.imagePasteIds) {
        for (const id of message.imagePasteIds) {
          if (id > maxId) maxId = id;
        }
      }
      // Check text paste references in message content
      if (Array.isArray(message.message.content)) {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            const refs = parseReferences(block.text);
            for (const ref of refs) {
              if (ref.id > maxId) maxId = ref.id;
            }
          }
        }
      }
    }
  }
  return maxId + 1;
}
function buildBorderText(showFastIcon: boolean, showFastIconHint: boolean, fastModeCooldown: boolean): BorderTextOptions | undefined {
  if (!showFastIcon) return undefined;
  const fastSeg = showFastIconHint ? `${getFastIconString(true, fastModeCooldown)} ${chalk.dim('/fast')}` : getFastIconString(true, fastModeCooldown);
  return {
    content: ` ${fastSeg} `,
    position: 'top',
    align: 'end',
    offset: 0
  };
}
export default React.memo(PromptInput);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiY2hhbGsiLCJwYXRoIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsInVzZVN5bmNFeHRlcm5hbFN0b3JlIiwidXNlTm90aWZpY2F0aW9ucyIsInVzZUNvbW1hbmRRdWV1ZSIsIklERUF0TWVudGlvbmVkIiwidXNlSWRlQXRNZW50aW9uZWQiLCJBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTIiwibG9nRXZlbnQiLCJBcHBTdGF0ZSIsInVzZUFwcFN0YXRlIiwidXNlQXBwU3RhdGVTdG9yZSIsInVzZVNldEFwcFN0YXRlIiwiRm9vdGVySXRlbSIsImdldEN3ZCIsImlzUXVldWVkQ29tbWFuZEVkaXRhYmxlIiwicG9wQWxsRWRpdGFibGUiLCJzdHJpcEFuc2kiLCJjb21wYW5pb25SZXNlcnZlZENvbHVtbnMiLCJmaW5kQnVkZHlUcmlnZ2VyUG9zaXRpb25zIiwidXNlQnVkZHlOb3RpZmljYXRpb24iLCJGYXN0TW9kZVBpY2tlciIsImlzVWx0cmFyZXZpZXdFbmFibGVkIiwiZ2V0TmF0aXZlQ1NJdVRlcm1pbmFsRGlzcGxheU5hbWUiLCJDb21tYW5kIiwiaGFzQ29tbWFuZCIsInVzZUlzTW9kYWxPdmVybGF5QWN0aXZlIiwidXNlU2V0UHJvbXB0T3ZlcmxheURpYWxvZyIsImZvcm1hdEltYWdlUmVmIiwiZm9ybWF0UGFzdGVkVGV4dFJlZiIsImdldFBhc3RlZFRleHRSZWZOdW1MaW5lcyIsInBhcnNlUmVmZXJlbmNlcyIsIlZlcmlmaWNhdGlvblN0YXR1cyIsIkhpc3RvcnlNb2RlIiwidXNlQXJyb3dLZXlIaXN0b3J5IiwidXNlRG91YmxlUHJlc3MiLCJ1c2VIaXN0b3J5U2VhcmNoIiwiSURFU2VsZWN0aW9uIiwidXNlSW5wdXRCdWZmZXIiLCJ1c2VNYWluTG9vcE1vZGVsIiwidXNlUHJvbXB0U3VnZ2VzdGlvbiIsInVzZVRlcm1pbmFsU2l6ZSIsInVzZVR5cGVhaGVhZCIsIkJvcmRlclRleHRPcHRpb25zIiwic3RyaW5nV2lkdGgiLCJCb3giLCJDbGlja0V2ZW50IiwiS2V5IiwiVGV4dCIsInVzZUlucHV0IiwidXNlT3B0aW9uYWxLZXliaW5kaW5nQ29udGV4dCIsImdldFNob3J0Y3V0RGlzcGxheSIsInVzZUtleWJpbmRpbmciLCJ1c2VLZXliaW5kaW5ncyIsIk1DUFNlcnZlckNvbm5lY3Rpb24iLCJhYm9ydFByb21wdFN1Z2dlc3Rpb24iLCJsb2dTdWdnZXN0aW9uU3VwcHJlc3NlZCIsIkFjdGl2ZVNwZWN1bGF0aW9uU3RhdGUiLCJhYm9ydFNwZWN1bGF0aW9uIiwiZ2V0QWN0aXZlQWdlbnRGb3JJbnB1dCIsImdldFZpZXdlZFRlYW1tYXRlVGFzayIsImVudGVyVGVhbW1hdGVWaWV3IiwiZXhpdFRlYW1tYXRlVmlldyIsInN0b3BPckRpc21pc3NBZ2VudCIsIlRvb2xQZXJtaXNzaW9uQ29udGV4dCIsImdldFJ1bm5pbmdUZWFtbWF0ZXNTb3J0ZWQiLCJJblByb2Nlc3NUZWFtbWF0ZVRhc2tTdGF0ZSIsImlzUGFuZWxBZ2VudFRhc2siLCJMb2NhbEFnZW50VGFza1N0YXRlIiwiaXNCYWNrZ3JvdW5kVGFzayIsIkFHRU5UX0NPTE9SX1RPX1RIRU1FX0NPTE9SIiwiQUdFTlRfQ09MT1JTIiwiQWdlbnRDb2xvck5hbWUiLCJBZ2VudERlZmluaXRpb24iLCJNZXNzYWdlIiwiUGVybWlzc2lvbk1vZGUiLCJCYXNlVGV4dElucHV0UHJvcHMiLCJQcm9tcHRJbnB1dE1vZGUiLCJWaW1Nb2RlIiwiaXNBZ2VudFN3YXJtc0VuYWJsZWQiLCJjb3VudCIsIkF1dG9VcGRhdGVyUmVzdWx0IiwiQ3Vyc29yIiwiZ2V0R2xvYmFsQ29uZmlnIiwiUGFzdGVkQ29udGVudCIsInNhdmVHbG9iYWxDb25maWciLCJsb2dGb3JEZWJ1Z2dpbmciLCJwYXJzZURpcmVjdE1lbWJlck1lc3NhZ2UiLCJzZW5kRGlyZWN0TWVtYmVyTWVzc2FnZSIsIkVmZm9ydExldmVsIiwiZW52IiwiZXJyb3JNZXNzYWdlIiwiaXNCaWxsZWRBc0V4dHJhVXNhZ2UiLCJnZXRGYXN0TW9kZVVuYXZhaWxhYmxlUmVhc29uIiwiaXNGYXN0TW9kZUF2YWlsYWJsZSIsImlzRmFzdE1vZGVDb29sZG93biIsImlzRmFzdE1vZGVFbmFibGVkIiwiaXNGYXN0TW9kZVN1cHBvcnRlZEJ5TW9kZWwiLCJpc0Z1bGxzY3JlZW5FbnZFbmFibGVkIiwiUHJvbXB0SW5wdXRIZWxwZXJzIiwiZ2V0SW1hZ2VGcm9tQ2xpcGJvYXJkIiwiUEFTVEVfVEhSRVNIT0xEIiwiSW1hZ2VEaW1lbnNpb25zIiwiY2FjaGVJbWFnZVBhdGgiLCJzdG9yZUltYWdlIiwiaXNNYWNvc09wdGlvbkNoYXIiLCJNQUNPU19PUFRJT05fU1BFQ0lBTF9DSEFSUyIsImxvZ0Vycm9yIiwiaXNPcHVzMW1NZXJnZUVuYWJsZWQiLCJtb2RlbERpc3BsYXlTdHJpbmciLCJzZXRBdXRvTW9kZUFjdGl2ZSIsImN5Y2xlUGVybWlzc2lvbk1vZGUiLCJnZXROZXh0UGVybWlzc2lvbk1vZGUiLCJ0cmFuc2l0aW9uUGVybWlzc2lvbk1vZGUiLCJnZXRQbGF0Zm9ybSIsIlByb2Nlc3NVc2VySW5wdXRDb250ZXh0IiwiZWRpdFByb21wdEluRWRpdG9yIiwiaGFzQXV0b01vZGVPcHRJbiIsImZpbmRCdHdUcmlnZ2VyUG9zaXRpb25zIiwiZmluZFNsYXNoQ29tbWFuZFBvc2l0aW9ucyIsImZpbmRTbGFja0NoYW5uZWxQb3NpdGlvbnMiLCJnZXRLbm93bkNoYW5uZWxzVmVyc2lvbiIsImhhc1NsYWNrTWNwU2VydmVyIiwic3Vic2NyaWJlS25vd25DaGFubmVscyIsImlzSW5Qcm9jZXNzRW5hYmxlZCIsInN5bmNUZWFtbWF0ZU1vZGUiLCJUZWFtU3VtbWFyeSIsImdldFRlYW1tYXRlQ29sb3IiLCJpc0luUHJvY2Vzc1RlYW1tYXRlIiwid3JpdGVUb01haWxib3giLCJUZXh0SGlnaGxpZ2h0IiwiVGhlbWUiLCJmaW5kVGhpbmtpbmdUcmlnZ2VyUG9zaXRpb25zIiwiZ2V0UmFpbmJvd0NvbG9yIiwiaXNVbHRyYXRoaW5rRW5hYmxlZCIsImZpbmRUb2tlbkJ1ZGdldFBvc2l0aW9ucyIsImZpbmRVbHRyYXBsYW5UcmlnZ2VyUG9zaXRpb25zIiwiZmluZFVsdHJhcmV2aWV3VHJpZ2dlclBvc2l0aW9ucyIsIkF1dG9Nb2RlT3B0SW5EaWFsb2ciLCJCcmlkZ2VEaWFsb2ciLCJDb25maWd1cmFibGVTaG9ydGN1dEhpbnQiLCJnZXRWaXNpYmxlQWdlbnRUYXNrcyIsInVzZUNvb3JkaW5hdG9yVGFza0NvdW50IiwiZ2V0RWZmb3J0Tm90aWZpY2F0aW9uVGV4dCIsImdldEZhc3RJY29uU3RyaW5nIiwiR2xvYmFsU2VhcmNoRGlhbG9nIiwiSGlzdG9yeVNlYXJjaERpYWxvZyIsIk1vZGVsUGlja2VyIiwiUXVpY2tPcGVuRGlhbG9nIiwiVGV4dElucHV0IiwiVGhpbmtpbmdUb2dnbGUiLCJCYWNrZ3JvdW5kVGFza3NEaWFsb2ciLCJzaG91bGRIaWRlVGFza3NGb290ZXIiLCJUZWFtc0RpYWxvZyIsIlZpbVRleHRJbnB1dCIsImdldE1vZGVGcm9tSW5wdXQiLCJnZXRWYWx1ZUZyb21JbnB1dCIsIkZPT1RFUl9URU1QT1JBUllfU1RBVFVTX1RJTUVPVVQiLCJOb3RpZmljYXRpb25zIiwiUHJvbXB0SW5wdXRGb290ZXIiLCJTdWdnZXN0aW9uSXRlbSIsIlByb21wdElucHV0TW9kZUluZGljYXRvciIsIlByb21wdElucHV0UXVldWVkQ29tbWFuZHMiLCJQcm9tcHRJbnB1dFN0YXNoTm90aWNlIiwidXNlTWF5YmVUcnVuY2F0ZUlucHV0IiwidXNlUHJvbXB0SW5wdXRQbGFjZWhvbGRlciIsInVzZVNob3dGYXN0SWNvbkhpbnQiLCJ1c2VTd2FybUJhbm5lciIsImlzTm9uU3BhY2VQcmludGFibGUiLCJpc1ZpbU1vZGVFbmFibGVkIiwiUHJvcHMiLCJkZWJ1ZyIsImlkZVNlbGVjdGlvbiIsInRvb2xQZXJtaXNzaW9uQ29udGV4dCIsInNldFRvb2xQZXJtaXNzaW9uQ29udGV4dCIsImN0eCIsImFwaUtleVN0YXR1cyIsImNvbW1hbmRzIiwiYWdlbnRzIiwiaXNMb2FkaW5nIiwidmVyYm9zZSIsIm1lc3NhZ2VzIiwib25BdXRvVXBkYXRlclJlc3VsdCIsInJlc3VsdCIsImF1dG9VcGRhdGVyUmVzdWx0IiwiaW5wdXQiLCJvbklucHV0Q2hhbmdlIiwidmFsdWUiLCJtb2RlIiwib25Nb2RlQ2hhbmdlIiwic3Rhc2hlZFByb21wdCIsInRleHQiLCJjdXJzb3JPZmZzZXQiLCJwYXN0ZWRDb250ZW50cyIsIlJlY29yZCIsInNldFN0YXNoZWRQcm9tcHQiLCJzdWJtaXRDb3VudCIsIm9uU2hvd01lc3NhZ2VTZWxlY3RvciIsIm9uTWVzc2FnZUFjdGlvbnNFbnRlciIsIm1jcENsaWVudHMiLCJzZXRQYXN0ZWRDb250ZW50cyIsIkRpc3BhdGNoIiwiU2V0U3RhdGVBY3Rpb24iLCJ2aW1Nb2RlIiwic2V0VmltTW9kZSIsInNob3dCYXNoZXNEaWFsb2ciLCJzZXRTaG93QmFzaGVzRGlhbG9nIiwic2hvdyIsIm9uRXhpdCIsImdldFRvb2xVc2VDb250ZXh0IiwibmV3TWVzc2FnZXMiLCJhYm9ydENvbnRyb2xsZXIiLCJBYm9ydENvbnRyb2xsZXIiLCJtYWluTG9vcE1vZGVsIiwib25TdWJtaXQiLCJoZWxwZXJzIiwic3BlY3VsYXRpb25BY2NlcHQiLCJzdGF0ZSIsInNwZWN1bGF0aW9uU2Vzc2lvblRpbWVTYXZlZE1zIiwic2V0QXBwU3RhdGUiLCJmIiwicHJldiIsIm9wdGlvbnMiLCJmcm9tS2V5YmluZGluZyIsIlByb21pc2UiLCJvbkFnZW50U3VibWl0IiwidGFzayIsImlzU2VhcmNoaW5nSGlzdG9yeSIsInNldElzU2VhcmNoaW5nSGlzdG9yeSIsImlzU2VhcmNoaW5nIiwib25EaXNtaXNzU2lkZVF1ZXN0aW9uIiwiaXNTaWRlUXVlc3Rpb25WaXNpYmxlIiwiaGVscE9wZW4iLCJzZXRIZWxwT3BlbiIsImhhc1N1cHByZXNzZWREaWFsb2dzIiwiaXNMb2NhbEpTWENvbW1hbmRBY3RpdmUiLCJpbnNlcnRUZXh0UmVmIiwiTXV0YWJsZVJlZk9iamVjdCIsImluc2VydCIsInNldElucHV0V2l0aEN1cnNvciIsImN1cnNvciIsInZvaWNlSW50ZXJpbVJhbmdlIiwic3RhcnQiLCJlbmQiLCJQUk9NUFRfRk9PVEVSX0xJTkVTIiwiTUlOX0lOUFVUX1ZJRVdQT1JUX0xJTkVTIiwiUHJvbXB0SW5wdXQiLCJvblN1Ym1pdFByb3AiLCJSZWFjdE5vZGUiLCJpc01vZGFsT3ZlcmxheUFjdGl2ZSIsImlzQXV0b1VwZGF0aW5nIiwic2V0SXNBdXRvVXBkYXRpbmciLCJleGl0TWVzc2FnZSIsInNldEV4aXRNZXNzYWdlIiwia2V5Iiwic2V0Q3Vyc29yT2Zmc2V0IiwibGVuZ3RoIiwibGFzdEludGVybmFsSW5wdXRSZWYiLCJjdXJyZW50IiwidHJhY2tBbmRTZXRJbnB1dCIsIm5lZWRzU3BhY2UiLCJ0ZXN0IiwiaW5zZXJ0VGV4dCIsIm5ld1ZhbHVlIiwic2xpY2UiLCJzdG9yZSIsInRhc2tzIiwicyIsInJlcGxCcmlkZ2VDb25uZWN0ZWQiLCJyZXBsQnJpZGdlRXhwbGljaXQiLCJyZXBsQnJpZGdlUmVjb25uZWN0aW5nIiwiYnJpZGdlRm9vdGVyVmlzaWJsZSIsImhhc1R1bmdzdGVuU2Vzc2lvbiIsInR1bmdzdGVuQWN0aXZlU2Vzc2lvbiIsInVuZGVmaW5lZCIsInRtdXhGb290ZXJWaXNpYmxlIiwiYmFnZWxGb290ZXJWaXNpYmxlIiwidGVhbUNvbnRleHQiLCJxdWV1ZWRDb21tYW5kcyIsInByb21wdFN1Z2dlc3Rpb25TdGF0ZSIsInByb21wdFN1Z2dlc3Rpb24iLCJzcGVjdWxhdGlvbiIsInZpZXdpbmdBZ2VudFRhc2tJZCIsInZpZXdTZWxlY3Rpb25Nb2RlIiwic2hvd1NwaW5uZXJUcmVlIiwiZXhwYW5kZWRWaWV3IiwiY29tcGFuaW9uIiwiX2NvbXBhbmlvbiIsImNvbXBhbmlvbk11dGVkIiwiY29tcGFuaW9uRm9vdGVyVmlzaWJsZSIsImJyaWVmT3duc0dhcCIsImlzQnJpZWZPbmx5IiwibWFpbkxvb3BNb2RlbF8iLCJtYWluTG9vcE1vZGVsRm9yU2Vzc2lvbiIsInRoaW5raW5nRW5hYmxlZCIsImlzRmFzdE1vZGUiLCJmYXN0TW9kZSIsImVmZm9ydFZhbHVlIiwidmlld2VkVGVhbW1hdGUiLCJnZXRTdGF0ZSIsInZpZXdpbmdBZ2VudE5hbWUiLCJpZGVudGl0eSIsImFnZW50TmFtZSIsInZpZXdpbmdBZ2VudENvbG9yIiwiY29sb3IiLCJpbmNsdWRlcyIsImluUHJvY2Vzc1RlYW1tYXRlcyIsImlzVGVhbW1hdGVNb2RlIiwiZWZmZWN0aXZlVG9vbFBlcm1pc3Npb25Db250ZXh0IiwicGVybWlzc2lvbk1vZGUiLCJoaXN0b3J5UXVlcnkiLCJzZXRIaXN0b3J5UXVlcnkiLCJoaXN0b3J5TWF0Y2giLCJoaXN0b3J5RmFpbGVkTWF0Y2giLCJlbnRyeSIsImRpc3BsYXkiLCJuZXh0UGFzdGVJZFJlZiIsImdldEluaXRpYWxQYXN0ZUlkIiwicGVuZGluZ1NwYWNlQWZ0ZXJQaWxsUmVmIiwic2hvd1RlYW1zRGlhbG9nIiwic2V0U2hvd1RlYW1zRGlhbG9nIiwic2hvd0JyaWRnZURpYWxvZyIsInNldFNob3dCcmlkZ2VEaWFsb2ciLCJ0ZWFtbWF0ZUZvb3RlckluZGV4Iiwic2V0VGVhbW1hdGVGb290ZXJJbmRleCIsImNvb3JkaW5hdG9yVGFza0luZGV4Iiwic2V0Q29vcmRpbmF0b3JUYXNrSW5kZXgiLCJ2IiwibmV4dCIsImNvb3JkaW5hdG9yVGFza0NvdW50IiwiaGFzQmdUYXNrUGlsbCIsIk9iamVjdCIsInZhbHVlcyIsInNvbWUiLCJ0IiwibWluQ29vcmRpbmF0b3JJbmRleCIsIk1hdGgiLCJtYXgiLCJpc1Bhc3RpbmciLCJzZXRJc1Bhc3RpbmciLCJpc0V4dGVybmFsRWRpdG9yQWN0aXZlIiwic2V0SXNFeHRlcm5hbEVkaXRvckFjdGl2ZSIsInNob3dNb2RlbFBpY2tlciIsInNldFNob3dNb2RlbFBpY2tlciIsInNob3dRdWlja09wZW4iLCJzZXRTaG93UXVpY2tPcGVuIiwic2hvd0dsb2JhbFNlYXJjaCIsInNldFNob3dHbG9iYWxTZWFyY2giLCJzaG93SGlzdG9yeVBpY2tlciIsInNldFNob3dIaXN0b3J5UGlja2VyIiwic2hvd0Zhc3RNb2RlUGlja2VyIiwic2V0U2hvd0Zhc3RNb2RlUGlja2VyIiwic2hvd1RoaW5raW5nVG9nZ2xlIiwic2V0U2hvd1RoaW5raW5nVG9nZ2xlIiwic2hvd0F1dG9Nb2RlT3B0SW4iLCJzZXRTaG93QXV0b01vZGVPcHRJbiIsInByZXZpb3VzTW9kZUJlZm9yZUF1dG8iLCJzZXRQcmV2aW91c01vZGVCZWZvcmVBdXRvIiwiYXV0b01vZGVPcHRJblRpbWVvdXRSZWYiLCJOb2RlSlMiLCJUaW1lb3V0IiwiaXNDdXJzb3JPbkZpcnN0TGluZSIsImZpcnN0TmV3bGluZUluZGV4IiwiaW5kZXhPZiIsImlzQ3Vyc29yT25MYXN0TGluZSIsImxhc3ROZXdsaW5lSW5kZXgiLCJsYXN0SW5kZXhPZiIsImNhY2hlZFRlYW1zIiwidGVhbW1hdGVDb3VudCIsInRlYW1tYXRlcyIsIm5hbWUiLCJ0ZWFtTmFtZSIsIm1lbWJlckNvdW50IiwicnVubmluZ0NvdW50IiwiaWRsZUNvdW50IiwicnVubmluZ1Rhc2tDb3VudCIsInN0YXR1cyIsInRhc2tzRm9vdGVyVmlzaWJsZSIsInRlYW1zRm9vdGVyVmlzaWJsZSIsImZvb3Rlckl0ZW1zIiwiZmlsdGVyIiwiQm9vbGVhbiIsInJhd0Zvb3RlclNlbGVjdGlvbiIsImZvb3RlclNlbGVjdGlvbiIsImZvb3Rlckl0ZW1TZWxlY3RlZCIsInRhc2tzU2VsZWN0ZWQiLCJ0bXV4U2VsZWN0ZWQiLCJiYWdlbFNlbGVjdGVkIiwidGVhbXNTZWxlY3RlZCIsImJyaWRnZVNlbGVjdGVkIiwic2VsZWN0Rm9vdGVySXRlbSIsIml0ZW0iLCJuYXZpZ2F0ZUZvb3RlciIsImRlbHRhIiwiZXhpdEF0U3RhcnQiLCJpZHgiLCJzdWdnZXN0aW9uIiwibWFya0FjY2VwdGVkIiwibG9nT3V0Y29tZUF0U3VibWlzc2lvbiIsIm1hcmtTaG93biIsImlucHV0VmFsdWUiLCJpc0Fzc2lzdGFudFJlc3BvbmRpbmciLCJkaXNwbGF5ZWRWYWx1ZSIsInRoaW5rVHJpZ2dlcnMiLCJ1bHRyYXBsYW5TZXNzaW9uVXJsIiwidWx0cmFwbGFuTGF1bmNoaW5nIiwidWx0cmFwbGFuVHJpZ2dlcnMiLCJ1bHRyYXJldmlld1RyaWdnZXJzIiwiYnR3VHJpZ2dlcnMiLCJidWRkeVRyaWdnZXJzIiwic2xhc2hDb21tYW5kVHJpZ2dlcnMiLCJwb3NpdGlvbnMiLCJwb3MiLCJjb21tYW5kTmFtZSIsInRva2VuQnVkZ2V0VHJpZ2dlcnMiLCJrbm93bkNoYW5uZWxzVmVyc2lvbiIsInNsYWNrQ2hhbm5lbFRyaWdnZXJzIiwibWNwIiwiY2xpZW50cyIsIm1lbWJlck1lbnRpb25IaWdobGlnaHRzIiwiQXJyYXkiLCJ0aGVtZUNvbG9yIiwiaGlnaGxpZ2h0cyIsIm1lbWJlcnMiLCJyZWdleCIsIm1lbWJlclZhbHVlcyIsIm1hdGNoIiwiZXhlYyIsImxlYWRpbmdTcGFjZSIsIm5hbWVTdGFydCIsImluZGV4IiwiZnVsbE1hdGNoIiwidHJpbVN0YXJ0IiwibWVtYmVyIiwiZmluZCIsInB1c2giLCJpbWFnZVJlZlBvc2l0aW9ucyIsInIiLCJzdGFydHNXaXRoIiwibWFwIiwiY3Vyc29yQXRJbWFnZUNoaXAiLCJpbnNpZGUiLCJtaWQiLCJjb21iaW5lZEhpZ2hsaWdodHMiLCJyZWYiLCJpbnZlcnNlIiwicHJpb3JpdHkiLCJ0cmlnZ2VyIiwibWVudGlvbiIsImRpbUNvbG9yIiwiaSIsInNoaW1tZXJDb2xvciIsImFkZE5vdGlmaWNhdGlvbiIsInJlbW92ZU5vdGlmaWNhdGlvbiIsInRpbWVvdXRNcyIsInByZXZJbnB1dExlbmd0aFJlZiIsInBlYWtJbnB1dExlbmd0aFJlZiIsImRpc21pc3NTdGFzaEhpbnQiLCJwcmV2TGVuZ3RoIiwicGVha0xlbmd0aCIsImN1cnJlbnRMZW5ndGgiLCJjbGVhcmVkU3Vic3RhbnRpYWxJbnB1dCIsIndhc1JhcGlkQ2xlYXIiLCJjb25maWciLCJoYXNVc2VkU3Rhc2giLCJqc3giLCJwdXNoVG9CdWZmZXIiLCJ1bmRvIiwiY2FuVW5kbyIsImNsZWFyQnVmZmVyIiwibWF4QnVmZmVyU2l6ZSIsImRlYm91bmNlTXMiLCJkZWZhdWx0UGxhY2Vob2xkZXIiLCJvbkNoYW5nZSIsImlzU2luZ2xlQ2hhckluc2VydGlvbiIsImluc2VydGVkQXRTdGFydCIsInZhbHVlV2l0aG91dE1vZGUiLCJyZXBsYWNlQWxsIiwicHJvY2Vzc2VkVmFsdWUiLCJyZXNldEhpc3RvcnkiLCJvbkhpc3RvcnlVcCIsIm9uSGlzdG9yeURvd24iLCJkaXNtaXNzU2VhcmNoSGludCIsImhpc3RvcnlJbmRleCIsImhpc3RvcnlNb2RlIiwiaGFuZGxlSGlzdG9yeVVwIiwic3VnZ2VzdGlvbnMiLCJoYXNFZGl0YWJsZUNvbW1hbmQiLCJwb3BBbGxDb21tYW5kc0Zyb21RdWV1ZSIsImhhbmRsZUhpc3RvcnlEb3duIiwiZmlyc3QiLCJoYXNTZWVuVGFza3NIaW50IiwiYyIsInN1Z2dlc3Rpb25zU3RhdGUiLCJzZXRTdWdnZXN0aW9uc1N0YXRlUmF3Iiwic2VsZWN0ZWRTdWdnZXN0aW9uIiwiY29tbWFuZEFyZ3VtZW50SGludCIsInNldFN1Z2dlc3Rpb25zU3RhdGUiLCJ1cGRhdGVyIiwiaW5wdXRQYXJhbSIsImlzU3VibWl0dGluZ1NsYXNoQ29tbWFuZCIsInRyaW1FbmQiLCJoYXNJbWFnZXMiLCJ0eXBlIiwic3VnZ2VzdGlvblRleHQiLCJpbnB1dE1hdGNoZXNTdWdnZXN0aW9uIiwidHJpbSIsInNraXBSZXNldCIsInNob3duQXQiLCJkaXJlY3RNZXNzYWdlIiwicmVjaXBpZW50TmFtZSIsIm1lc3NhZ2UiLCJzdWNjZXNzIiwiZXJyb3IiLCJoYXNEaXJlY3RvcnlTdWdnZXN0aW9ucyIsImV2ZXJ5IiwiZGVzY3JpcHRpb24iLCJhY3RpdmVBZ2VudCIsImlubGluZUdob3N0VGV4dCIsIm1heENvbHVtbldpZHRoIiwic3VwcHJlc3NTdWdnZXN0aW9ucyIsInNob3dQcm9tcHRTdWdnZXN0aW9uIiwicHJvbXB0SWQiLCJhY2NlcHRlZEF0IiwiZ2VuZXJhdGlvblJlcXVlc3RJZCIsIm9uSW1hZ2VQYXN0ZSIsImltYWdlIiwibWVkaWFUeXBlIiwiZmlsZW5hbWUiLCJkaW1lbnNpb25zIiwic291cmNlUGF0aCIsInBhc3RlSWQiLCJuZXdDb250ZW50IiwiaWQiLCJjb250ZW50IiwicHJlZml4IiwiaW5zZXJ0VGV4dEF0Q3Vyc29yIiwicmVmZXJlbmNlZElkcyIsIlNldCIsIm9ycGhhbmVkIiwiaGFzIiwiaW1nIiwib25UZXh0UGFzdGUiLCJyYXdUZXh0IiwicmVwbGFjZSIsInBhc3RlZE1vZGUiLCJudW1MaW5lcyIsIm1heExpbmVzIiwibWluIiwicm93cyIsImxhenlTcGFjZUlucHV0RmlsdGVyIiwibmV3SW5wdXQiLCJkb3VibGVQcmVzc0VzY0Zyb21FbXB0eSIsImltYWdlcyIsIm5ld0NvbnRlbnRzIiwib25JZGVBdE1lbnRpb25lZCIsImF0TWVudGlvbmVkIiwiYXRNZW50aW9uZWRUZXh0IiwicmVsYXRpdmVQYXRoIiwicmVsYXRpdmUiLCJmaWxlUGF0aCIsImxpbmVTdGFydCIsImxpbmVFbmQiLCJjdXJzb3JDaGFyIiwiaGFuZGxlVW5kbyIsInByZXZpb3VzU3RhdGUiLCJoYW5kbGVOZXdsaW5lIiwiaGFuZGxlRXh0ZXJuYWxFZGl0b3IiLCJlcnIiLCJFcnJvciIsImhhbmRsZVN0YXNoIiwiaGFuZGxlTW9kZWxQaWNrZXIiLCJoYW5kbGVGYXN0TW9kZVBpY2tlciIsImhhbmRsZVRoaW5raW5nVG9nZ2xlIiwiaGFuZGxlQ3ljbGVNb2RlIiwidGVhbW1hdGVDb250ZXh0IiwibmV4dE1vZGUiLCJ0byIsInRlYW1tYXRlVGFza0lkIiwiaXNBdXRvTW9kZUF2YWlsYWJsZSIsImlzRW50ZXJpbmdBdXRvTW9kZUZpcnN0VGltZSIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJjb250ZXh0IiwicHJlcGFyZWRDb250ZXh0IiwibGFzdFBsYW5Nb2RlVXNlIiwiRGF0ZSIsIm5vdyIsImhhbmRsZUF1dG9Nb2RlT3B0SW5BY2NlcHQiLCJzdHJpcHBlZENvbnRleHQiLCJoYW5kbGVBdXRvTW9kZU9wdEluRGVjbGluZSIsImhhbmRsZUltYWdlUGFzdGUiLCJ0aGVuIiwiaW1hZ2VEYXRhIiwiYmFzZTY0Iiwic2hvcnRjdXREaXNwbGF5IiwiaXNTU0giLCJrZXliaW5kaW5nQ29udGV4dCIsInJlZ2lzdGVySGFuZGxlciIsImFjdGlvbiIsImhhbmRsZXIiLCJjaGF0SGFuZGxlcnMiLCJpc0FjdGl2ZSIsInF1aWNrU2VhcmNoQWN0aXZlIiwiZm9vdGVyOnVwIiwiZm9vdGVyOmRvd24iLCJmb290ZXI6bmV4dCIsInRvdGFsQWdlbnRzIiwiZm9vdGVyOnByZXZpb3VzIiwiZm9vdGVyOm9wZW5TZWxlY3RlZCIsInRlYW1tYXRlIiwic2VsZWN0ZWRUYXNrSWQiLCJ0dW5nc3RlblBhbmVsQXV0b0hpZGRlbiIsInR1bmdzdGVuUGFuZWxWaXNpYmxlIiwiZm9vdGVyOmNsZWFyU2VsZWN0aW9uIiwiZm9vdGVyOmNsb3NlIiwiY2hhciIsInNob3J0Y3V0IiwidGVybWluYWxOYW1lIiwiY3RybCIsIm1ldGEiLCJlc2NhcGUiLCJyZXR1cm4iLCJiYWNrc3BhY2UiLCJkZWxldGUiLCJzd2FybUJhbm5lciIsImZhc3RNb2RlQ29vbGRvd24iLCJzaG93RmFzdEljb24iLCJzaG93RmFzdEljb25IaW50IiwiZWZmb3J0Tm90aWZpY2F0aW9uVGV4dCIsImNvbXBhbmlvblNwZWFraW5nIiwiY29tcGFuaW9uUmVhY3Rpb24iLCJjb2x1bW5zIiwidGV4dElucHV0Q29sdW1ucyIsIm1heFZpc2libGVMaW5lcyIsImZsb29yIiwiaGFuZGxlSW5wdXRDbGljayIsImUiLCJmcm9tVGV4dCIsInZpZXdwb3J0U3RhcnQiLCJnZXRWaWV3cG9ydFN0YXJ0TGluZSIsIm9mZnNldCIsIm1lYXN1cmVkVGV4dCIsImdldE9mZnNldEZyb21Qb3NpdGlvbiIsImxpbmUiLCJsb2NhbFJvdyIsImNvbHVtbiIsImxvY2FsQ29sIiwiaGFuZGxlT3BlblRhc2tzRGlhbG9nIiwidGFza0lkIiwicGxhY2Vob2xkZXIiLCJpc0lucHV0V3JhcHBlZCIsImhhbmRsZU1vZGVsU2VsZWN0IiwibW9kZWwiLCJfZWZmb3J0Iiwid2FzRmFzdE1vZGVEaXNhYmxlZCIsImVmZmVjdGl2ZUZhc3RNb2RlIiwiaGFuZGxlTW9kZWxDYW5jZWwiLCJtb2RlbFBpY2tlckVsZW1lbnQiLCJoYW5kbGVGYXN0TW9kZVNlbGVjdCIsImZhc3RNb2RlUGlja2VyRWxlbWVudCIsImhhbmRsZVRoaW5raW5nU2VsZWN0IiwiZW5hYmxlZCIsImhhbmRsZVRoaW5raW5nQ2FuY2VsIiwidGhpbmtpbmdUb2dnbGVFbGVtZW50IiwibSIsImF1dG9Nb2RlT3B0SW5EaWFsb2ciLCJpbnNlcnRXaXRoU3BhY2luZyIsImVudHJ5TW9kZSIsImJhc2VQcm9wcyIsIm11bHRpbGluZSIsIm9uSGlzdG9yeVJlc2V0Iiwib25FeGl0TWVzc2FnZSIsImRpc2FibGVDdXJzb3JNb3ZlbWVudEZvclVwRG93bktleXMiLCJkaXNhYmxlRXNjYXBlRG91YmxlUHJlc3MiLCJvbkNoYW5nZUN1cnNvck9mZnNldCIsIm9uUGFzdGUiLCJvbklzUGFzdGluZ0NoYW5nZSIsImZvY3VzIiwic2hvd0N1cnNvciIsImFyZ3VtZW50SGludCIsIm9uVW5kbyIsImlucHV0RmlsdGVyIiwiZ2V0Qm9yZGVyQ29sb3IiLCJtb2RlQ29sb3JzIiwiYmFzaCIsInRlYW1tYXRlQ29sb3JOYW1lIiwidGV4dElucHV0RWxlbWVudCIsImJnQ29sb3IiLCJyZXBlYXQiLCJidWlsZEJvcmRlclRleHQiLCJtYXhJZCIsImltYWdlUGFzdGVJZHMiLCJpc0FycmF5IiwiYmxvY2siLCJyZWZzIiwiZmFzdFNlZyIsImRpbSIsInBvc2l0aW9uIiwiYWxpZ24iLCJtZW1vIl0sInNvdXJjZXMiOlsiUHJvbXB0SW5wdXQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQge1xuICB1c2VDYWxsYmFjayxcbiAgdXNlRWZmZWN0LFxuICB1c2VNZW1vLFxuICB1c2VSZWYsXG4gIHVzZVN0YXRlLFxuICB1c2VTeW5jRXh0ZXJuYWxTdG9yZSxcbn0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VOb3RpZmljYXRpb25zIH0gZnJvbSAnc3JjL2NvbnRleHQvbm90aWZpY2F0aW9ucy5qcydcbmltcG9ydCB7IHVzZUNvbW1hbmRRdWV1ZSB9IGZyb20gJ3NyYy9ob29rcy91c2VDb21tYW5kUXVldWUuanMnXG5pbXBvcnQge1xuICB0eXBlIElERUF0TWVudGlvbmVkLFxuICB1c2VJZGVBdE1lbnRpb25lZCxcbn0gZnJvbSAnc3JjL2hvb2tzL3VzZUlkZUF0TWVudGlvbmVkLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnc3JjL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB7XG4gIHR5cGUgQXBwU3RhdGUsXG4gIHVzZUFwcFN0YXRlLFxuICB1c2VBcHBTdGF0ZVN0b3JlLFxuICB1c2VTZXRBcHBTdGF0ZSxcbn0gZnJvbSAnc3JjL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHR5cGUgeyBGb290ZXJJdGVtIH0gZnJvbSAnc3JjL3N0YXRlL0FwcFN0YXRlU3RvcmUuanMnXG5pbXBvcnQgeyBnZXRDd2QgfSBmcm9tICdzcmMvdXRpbHMvY3dkLmpzJ1xuaW1wb3J0IHtcbiAgaXNRdWV1ZWRDb21tYW5kRWRpdGFibGUsXG4gIHBvcEFsbEVkaXRhYmxlLFxufSBmcm9tICdzcmMvdXRpbHMvbWVzc2FnZVF1ZXVlTWFuYWdlci5qcydcbmltcG9ydCBzdHJpcEFuc2kgZnJvbSAnc3RyaXAtYW5zaSdcbmltcG9ydCB7IGNvbXBhbmlvblJlc2VydmVkQ29sdW1ucyB9IGZyb20gJy4uLy4uL2J1ZGR5L0NvbXBhbmlvblNwcml0ZS5qcydcbmltcG9ydCB7XG4gIGZpbmRCdWRkeVRyaWdnZXJQb3NpdGlvbnMsXG4gIHVzZUJ1ZGR5Tm90aWZpY2F0aW9uLFxufSBmcm9tICcuLi8uLi9idWRkeS91c2VCdWRkeU5vdGlmaWNhdGlvbi5qcydcbmltcG9ydCB7IEZhc3RNb2RlUGlja2VyIH0gZnJvbSAnLi4vLi4vY29tbWFuZHMvZmFzdC9mYXN0LmpzJ1xuaW1wb3J0IHsgaXNVbHRyYXJldmlld0VuYWJsZWQgfSBmcm9tICcuLi8uLi9jb21tYW5kcy9yZXZpZXcvdWx0cmFyZXZpZXdFbmFibGVkLmpzJ1xuaW1wb3J0IHsgZ2V0TmF0aXZlQ1NJdVRlcm1pbmFsRGlzcGxheU5hbWUgfSBmcm9tICcuLi8uLi9jb21tYW5kcy90ZXJtaW5hbFNldHVwL3Rlcm1pbmFsU2V0dXAuanMnXG5pbXBvcnQgeyB0eXBlIENvbW1hbmQsIGhhc0NvbW1hbmQgfSBmcm9tICcuLi8uLi9jb21tYW5kcy5qcydcbmltcG9ydCB7IHVzZUlzTW9kYWxPdmVybGF5QWN0aXZlIH0gZnJvbSAnLi4vLi4vY29udGV4dC9vdmVybGF5Q29udGV4dC5qcydcbmltcG9ydCB7IHVzZVNldFByb21wdE92ZXJsYXlEaWFsb2cgfSBmcm9tICcuLi8uLi9jb250ZXh0L3Byb21wdE92ZXJsYXlDb250ZXh0LmpzJ1xuaW1wb3J0IHtcbiAgZm9ybWF0SW1hZ2VSZWYsXG4gIGZvcm1hdFBhc3RlZFRleHRSZWYsXG4gIGdldFBhc3RlZFRleHRSZWZOdW1MaW5lcyxcbiAgcGFyc2VSZWZlcmVuY2VzLFxufSBmcm9tICcuLi8uLi9oaXN0b3J5LmpzJ1xuaW1wb3J0IHR5cGUgeyBWZXJpZmljYXRpb25TdGF0dXMgfSBmcm9tICcuLi8uLi9ob29rcy91c2VBcGlLZXlWZXJpZmljYXRpb24uanMnXG5pbXBvcnQge1xuICB0eXBlIEhpc3RvcnlNb2RlLFxuICB1c2VBcnJvd0tleUhpc3RvcnksXG59IGZyb20gJy4uLy4uL2hvb2tzL3VzZUFycm93S2V5SGlzdG9yeS5qcydcbmltcG9ydCB7IHVzZURvdWJsZVByZXNzIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlRG91YmxlUHJlc3MuanMnXG5pbXBvcnQgeyB1c2VIaXN0b3J5U2VhcmNoIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlSGlzdG9yeVNlYXJjaC5qcydcbmltcG9ydCB0eXBlIHsgSURFU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlSWRlU2VsZWN0aW9uLmpzJ1xuaW1wb3J0IHsgdXNlSW5wdXRCdWZmZXIgfSBmcm9tICcuLi8uLi9ob29rcy91c2VJbnB1dEJ1ZmZlci5qcydcbmltcG9ydCB7IHVzZU1haW5Mb29wTW9kZWwgfSBmcm9tICcuLi8uLi9ob29rcy91c2VNYWluTG9vcE1vZGVsLmpzJ1xuaW1wb3J0IHsgdXNlUHJvbXB0U3VnZ2VzdGlvbiB9IGZyb20gJy4uLy4uL2hvb2tzL3VzZVByb21wdFN1Z2dlc3Rpb24uanMnXG5pbXBvcnQgeyB1c2VUZXJtaW5hbFNpemUgfSBmcm9tICcuLi8uLi9ob29rcy91c2VUZXJtaW5hbFNpemUuanMnXG5pbXBvcnQgeyB1c2VUeXBlYWhlYWQgfSBmcm9tICcuLi8uLi9ob29rcy91c2VUeXBlYWhlYWQuanMnXG5pbXBvcnQgdHlwZSB7IEJvcmRlclRleHRPcHRpb25zIH0gZnJvbSAnLi4vLi4vaW5rL3JlbmRlci1ib3JkZXIuanMnXG5pbXBvcnQgeyBzdHJpbmdXaWR0aCB9IGZyb20gJy4uLy4uL2luay9zdHJpbmdXaWR0aC5qcydcbmltcG9ydCB7IEJveCwgdHlwZSBDbGlja0V2ZW50LCB0eXBlIEtleSwgVGV4dCwgdXNlSW5wdXQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5pbXBvcnQgeyB1c2VPcHRpb25hbEtleWJpbmRpbmdDb250ZXh0IH0gZnJvbSAnLi4vLi4va2V5YmluZGluZ3MvS2V5YmluZGluZ0NvbnRleHQuanMnXG5pbXBvcnQgeyBnZXRTaG9ydGN1dERpc3BsYXkgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy9zaG9ydGN1dEZvcm1hdC5qcydcbmltcG9ydCB7XG4gIHVzZUtleWJpbmRpbmcsXG4gIHVzZUtleWJpbmRpbmdzLFxufSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHR5cGUgeyBNQ1BTZXJ2ZXJDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWNwL3R5cGVzLmpzJ1xuaW1wb3J0IHtcbiAgYWJvcnRQcm9tcHRTdWdnZXN0aW9uLFxuICBsb2dTdWdnZXN0aW9uU3VwcHJlc3NlZCxcbn0gZnJvbSAnLi4vLi4vc2VydmljZXMvUHJvbXB0U3VnZ2VzdGlvbi9wcm9tcHRTdWdnZXN0aW9uLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBY3RpdmVTcGVjdWxhdGlvblN0YXRlLFxuICBhYm9ydFNwZWN1bGF0aW9uLFxufSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9Qcm9tcHRTdWdnZXN0aW9uL3NwZWN1bGF0aW9uLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0QWN0aXZlQWdlbnRGb3JJbnB1dCxcbiAgZ2V0Vmlld2VkVGVhbW1hdGVUYXNrLFxufSBmcm9tICcuLi8uLi9zdGF0ZS9zZWxlY3RvcnMuanMnXG5pbXBvcnQge1xuICBlbnRlclRlYW1tYXRlVmlldyxcbiAgZXhpdFRlYW1tYXRlVmlldyxcbiAgc3RvcE9yRGlzbWlzc0FnZW50LFxufSBmcm9tICcuLi8uLi9zdGF0ZS90ZWFtbWF0ZVZpZXdIZWxwZXJzLmpzJ1xuaW1wb3J0IHR5cGUgeyBUb29sUGVybWlzc2lvbkNvbnRleHQgfSBmcm9tICcuLi8uLi9Ub29sLmpzJ1xuaW1wb3J0IHsgZ2V0UnVubmluZ1RlYW1tYXRlc1NvcnRlZCB9IGZyb20gJy4uLy4uL3Rhc2tzL0luUHJvY2Vzc1RlYW1tYXRlVGFzay9JblByb2Nlc3NUZWFtbWF0ZVRhc2suanMnXG5pbXBvcnQgdHlwZSB7IEluUHJvY2Vzc1RlYW1tYXRlVGFza1N0YXRlIH0gZnJvbSAnLi4vLi4vdGFza3MvSW5Qcm9jZXNzVGVhbW1hdGVUYXNrL3R5cGVzLmpzJ1xuaW1wb3J0IHtcbiAgaXNQYW5lbEFnZW50VGFzayxcbiAgdHlwZSBMb2NhbEFnZW50VGFza1N0YXRlLFxufSBmcm9tICcuLi8uLi90YXNrcy9Mb2NhbEFnZW50VGFzay9Mb2NhbEFnZW50VGFzay5qcydcbmltcG9ydCB7IGlzQmFja2dyb3VuZFRhc2sgfSBmcm9tICcuLi8uLi90YXNrcy90eXBlcy5qcydcbmltcG9ydCB7XG4gIEFHRU5UX0NPTE9SX1RPX1RIRU1FX0NPTE9SLFxuICBBR0VOVF9DT0xPUlMsXG4gIHR5cGUgQWdlbnRDb2xvck5hbWUsXG59IGZyb20gJy4uLy4uL3Rvb2xzL0FnZW50VG9vbC9hZ2VudENvbG9yTWFuYWdlci5qcydcbmltcG9ydCB0eXBlIHsgQWdlbnREZWZpbml0aW9uIH0gZnJvbSAnLi4vLi4vdG9vbHMvQWdlbnRUb29sL2xvYWRBZ2VudHNEaXIuanMnXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UgfSBmcm9tICcuLi8uLi90eXBlcy9tZXNzYWdlLmpzJ1xuaW1wb3J0IHR5cGUgeyBQZXJtaXNzaW9uTW9kZSB9IGZyb20gJy4uLy4uL3R5cGVzL3Blcm1pc3Npb25zLmpzJ1xuaW1wb3J0IHR5cGUge1xuICBCYXNlVGV4dElucHV0UHJvcHMsXG4gIFByb21wdElucHV0TW9kZSxcbiAgVmltTW9kZSxcbn0gZnJvbSAnLi4vLi4vdHlwZXMvdGV4dElucHV0VHlwZXMuanMnXG5pbXBvcnQgeyBpc0FnZW50U3dhcm1zRW5hYmxlZCB9IGZyb20gJy4uLy4uL3V0aWxzL2FnZW50U3dhcm1zRW5hYmxlZC5qcydcbmltcG9ydCB7IGNvdW50IH0gZnJvbSAnLi4vLi4vdXRpbHMvYXJyYXkuanMnXG5pbXBvcnQgdHlwZSB7IEF1dG9VcGRhdGVyUmVzdWx0IH0gZnJvbSAnLi4vLi4vdXRpbHMvYXV0b1VwZGF0ZXIuanMnXG5pbXBvcnQgeyBDdXJzb3IgfSBmcm9tICcuLi8uLi91dGlscy9DdXJzb3IuanMnXG5pbXBvcnQge1xuICBnZXRHbG9iYWxDb25maWcsXG4gIHR5cGUgUGFzdGVkQ29udGVudCxcbiAgc2F2ZUdsb2JhbENvbmZpZyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJ1xuaW1wb3J0IHsgbG9nRm9yRGVidWdnaW5nIH0gZnJvbSAnLi4vLi4vdXRpbHMvZGVidWcuanMnXG5pbXBvcnQge1xuICBwYXJzZURpcmVjdE1lbWJlck1lc3NhZ2UsXG4gIHNlbmREaXJlY3RNZW1iZXJNZXNzYWdlLFxufSBmcm9tICcuLi8uLi91dGlscy9kaXJlY3RNZW1iZXJNZXNzYWdlLmpzJ1xuaW1wb3J0IHR5cGUgeyBFZmZvcnRMZXZlbCB9IGZyb20gJy4uLy4uL3V0aWxzL2VmZm9ydC5qcydcbmltcG9ydCB7IGVudiB9IGZyb20gJy4uLy4uL3V0aWxzL2Vudi5qcydcbmltcG9ydCB7IGVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9ycy5qcydcbmltcG9ydCB7IGlzQmlsbGVkQXNFeHRyYVVzYWdlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXh0cmFVc2FnZS5qcydcbmltcG9ydCB7XG4gIGdldEZhc3RNb2RlVW5hdmFpbGFibGVSZWFzb24sXG4gIGlzRmFzdE1vZGVBdmFpbGFibGUsXG4gIGlzRmFzdE1vZGVDb29sZG93bixcbiAgaXNGYXN0TW9kZUVuYWJsZWQsXG4gIGlzRmFzdE1vZGVTdXBwb3J0ZWRCeU1vZGVsLFxufSBmcm9tICcuLi8uLi91dGlscy9mYXN0TW9kZS5qcydcbmltcG9ydCB7IGlzRnVsbHNjcmVlbkVudkVuYWJsZWQgfSBmcm9tICcuLi8uLi91dGlscy9mdWxsc2NyZWVuLmpzJ1xuaW1wb3J0IHR5cGUgeyBQcm9tcHRJbnB1dEhlbHBlcnMgfSBmcm9tICcuLi8uLi91dGlscy9oYW5kbGVQcm9tcHRTdWJtaXQuanMnXG5pbXBvcnQge1xuICBnZXRJbWFnZUZyb21DbGlwYm9hcmQsXG4gIFBBU1RFX1RIUkVTSE9MRCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvaW1hZ2VQYXN0ZS5qcydcbmltcG9ydCB0eXBlIHsgSW1hZ2VEaW1lbnNpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvaW1hZ2VSZXNpemVyLmpzJ1xuaW1wb3J0IHsgY2FjaGVJbWFnZVBhdGgsIHN0b3JlSW1hZ2UgfSBmcm9tICcuLi8uLi91dGlscy9pbWFnZVN0b3JlLmpzJ1xuaW1wb3J0IHtcbiAgaXNNYWNvc09wdGlvbkNoYXIsXG4gIE1BQ09TX09QVElPTl9TUEVDSUFMX0NIQVJTLFxufSBmcm9tICcuLi8uLi91dGlscy9rZXlib2FyZFNob3J0Y3V0cy5qcydcbmltcG9ydCB7IGxvZ0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHtcbiAgaXNPcHVzMW1NZXJnZUVuYWJsZWQsXG4gIG1vZGVsRGlzcGxheVN0cmluZyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvbW9kZWwvbW9kZWwuanMnXG5pbXBvcnQgeyBzZXRBdXRvTW9kZUFjdGl2ZSB9IGZyb20gJy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL2F1dG9Nb2RlU3RhdGUuanMnXG5pbXBvcnQge1xuICBjeWNsZVBlcm1pc3Npb25Nb2RlLFxuICBnZXROZXh0UGVybWlzc2lvbk1vZGUsXG59IGZyb20gJy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL2dldE5leHRQZXJtaXNzaW9uTW9kZS5qcydcbmltcG9ydCB7IHRyYW5zaXRpb25QZXJtaXNzaW9uTW9kZSB9IGZyb20gJy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL3Blcm1pc3Npb25TZXR1cC5qcydcbmltcG9ydCB7IGdldFBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGxhdGZvcm0uanMnXG5pbXBvcnQgdHlwZSB7IFByb2Nlc3NVc2VySW5wdXRDb250ZXh0IH0gZnJvbSAnLi4vLi4vdXRpbHMvcHJvY2Vzc1VzZXJJbnB1dC9wcm9jZXNzVXNlcklucHV0LmpzJ1xuaW1wb3J0IHsgZWRpdFByb21wdEluRWRpdG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHJvbXB0RWRpdG9yLmpzJ1xuaW1wb3J0IHsgaGFzQXV0b01vZGVPcHRJbiB9IGZyb20gJy4uLy4uL3V0aWxzL3NldHRpbmdzL3NldHRpbmdzLmpzJ1xuaW1wb3J0IHsgZmluZEJ0d1RyaWdnZXJQb3NpdGlvbnMgfSBmcm9tICcuLi8uLi91dGlscy9zaWRlUXVlc3Rpb24uanMnXG5pbXBvcnQgeyBmaW5kU2xhc2hDb21tYW5kUG9zaXRpb25zIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VnZ2VzdGlvbnMvY29tbWFuZFN1Z2dlc3Rpb25zLmpzJ1xuaW1wb3J0IHtcbiAgZmluZFNsYWNrQ2hhbm5lbFBvc2l0aW9ucyxcbiAgZ2V0S25vd25DaGFubmVsc1ZlcnNpb24sXG4gIGhhc1NsYWNrTWNwU2VydmVyLFxuICBzdWJzY3JpYmVLbm93bkNoYW5uZWxzLFxufSBmcm9tICcuLi8uLi91dGlscy9zdWdnZXN0aW9ucy9zbGFja0NoYW5uZWxTdWdnZXN0aW9ucy5qcydcbmltcG9ydCB7IGlzSW5Qcm9jZXNzRW5hYmxlZCB9IGZyb20gJy4uLy4uL3V0aWxzL3N3YXJtL2JhY2tlbmRzL3JlZ2lzdHJ5LmpzJ1xuaW1wb3J0IHsgc3luY1RlYW1tYXRlTW9kZSB9IGZyb20gJy4uLy4uL3V0aWxzL3N3YXJtL3RlYW1IZWxwZXJzLmpzJ1xuaW1wb3J0IHR5cGUgeyBUZWFtU3VtbWFyeSB9IGZyb20gJy4uLy4uL3V0aWxzL3RlYW1EaXNjb3ZlcnkuanMnXG5pbXBvcnQgeyBnZXRUZWFtbWF0ZUNvbG9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvdGVhbW1hdGUuanMnXG5pbXBvcnQgeyBpc0luUHJvY2Vzc1RlYW1tYXRlIH0gZnJvbSAnLi4vLi4vdXRpbHMvdGVhbW1hdGVDb250ZXh0LmpzJ1xuaW1wb3J0IHsgd3JpdGVUb01haWxib3ggfSBmcm9tICcuLi8uLi91dGlscy90ZWFtbWF0ZU1haWxib3guanMnXG5pbXBvcnQgdHlwZSB7IFRleHRIaWdobGlnaHQgfSBmcm9tICcuLi8uLi91dGlscy90ZXh0SGlnaGxpZ2h0aW5nLmpzJ1xuaW1wb3J0IHR5cGUgeyBUaGVtZSB9IGZyb20gJy4uLy4uL3V0aWxzL3RoZW1lLmpzJ1xuaW1wb3J0IHtcbiAgZmluZFRoaW5raW5nVHJpZ2dlclBvc2l0aW9ucyxcbiAgZ2V0UmFpbmJvd0NvbG9yLFxuICBpc1VsdHJhdGhpbmtFbmFibGVkLFxufSBmcm9tICcuLi8uLi91dGlscy90aGlua2luZy5qcydcbmltcG9ydCB7IGZpbmRUb2tlbkJ1ZGdldFBvc2l0aW9ucyB9IGZyb20gJy4uLy4uL3V0aWxzL3Rva2VuQnVkZ2V0LmpzJ1xuaW1wb3J0IHtcbiAgZmluZFVsdHJhcGxhblRyaWdnZXJQb3NpdGlvbnMsXG4gIGZpbmRVbHRyYXJldmlld1RyaWdnZXJQb3NpdGlvbnMsXG59IGZyb20gJy4uLy4uL3V0aWxzL3VsdHJhcGxhbi9rZXl3b3JkLmpzJ1xuaW1wb3J0IHsgQXV0b01vZGVPcHRJbkRpYWxvZyB9IGZyb20gJy4uL0F1dG9Nb2RlT3B0SW5EaWFsb2cuanMnXG5pbXBvcnQgeyBCcmlkZ2VEaWFsb2cgfSBmcm9tICcuLi9CcmlkZ2VEaWFsb2cuanMnXG5pbXBvcnQgeyBDb25maWd1cmFibGVTaG9ydGN1dEhpbnQgfSBmcm9tICcuLi9Db25maWd1cmFibGVTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQge1xuICBnZXRWaXNpYmxlQWdlbnRUYXNrcyxcbiAgdXNlQ29vcmRpbmF0b3JUYXNrQ291bnQsXG59IGZyb20gJy4uL0Nvb3JkaW5hdG9yQWdlbnRTdGF0dXMuanMnXG5pbXBvcnQgeyBnZXRFZmZvcnROb3RpZmljYXRpb25UZXh0IH0gZnJvbSAnLi4vRWZmb3J0SW5kaWNhdG9yLmpzJ1xuaW1wb3J0IHsgZ2V0RmFzdEljb25TdHJpbmcgfSBmcm9tICcuLi9GYXN0SWNvbi5qcydcbmltcG9ydCB7IEdsb2JhbFNlYXJjaERpYWxvZyB9IGZyb20gJy4uL0dsb2JhbFNlYXJjaERpYWxvZy5qcydcbmltcG9ydCB7IEhpc3RvcnlTZWFyY2hEaWFsb2cgfSBmcm9tICcuLi9IaXN0b3J5U2VhcmNoRGlhbG9nLmpzJ1xuaW1wb3J0IHsgTW9kZWxQaWNrZXIgfSBmcm9tICcuLi9Nb2RlbFBpY2tlci5qcydcbmltcG9ydCB7IFF1aWNrT3BlbkRpYWxvZyB9IGZyb20gJy4uL1F1aWNrT3BlbkRpYWxvZy5qcydcbmltcG9ydCBUZXh0SW5wdXQgZnJvbSAnLi4vVGV4dElucHV0LmpzJ1xuaW1wb3J0IHsgVGhpbmtpbmdUb2dnbGUgfSBmcm9tICcuLi9UaGlua2luZ1RvZ2dsZS5qcydcbmltcG9ydCB7IEJhY2tncm91bmRUYXNrc0RpYWxvZyB9IGZyb20gJy4uL3Rhc2tzL0JhY2tncm91bmRUYXNrc0RpYWxvZy5qcydcbmltcG9ydCB7IHNob3VsZEhpZGVUYXNrc0Zvb3RlciB9IGZyb20gJy4uL3Rhc2tzL3Rhc2tTdGF0dXNVdGlscy5qcydcbmltcG9ydCB7IFRlYW1zRGlhbG9nIH0gZnJvbSAnLi4vdGVhbXMvVGVhbXNEaWFsb2cuanMnXG5pbXBvcnQgVmltVGV4dElucHV0IGZyb20gJy4uL1ZpbVRleHRJbnB1dC5qcydcbmltcG9ydCB7IGdldE1vZGVGcm9tSW5wdXQsIGdldFZhbHVlRnJvbUlucHV0IH0gZnJvbSAnLi9pbnB1dE1vZGVzLmpzJ1xuaW1wb3J0IHtcbiAgRk9PVEVSX1RFTVBPUkFSWV9TVEFUVVNfVElNRU9VVCxcbiAgTm90aWZpY2F0aW9ucyxcbn0gZnJvbSAnLi9Ob3RpZmljYXRpb25zLmpzJ1xuaW1wb3J0IFByb21wdElucHV0Rm9vdGVyIGZyb20gJy4vUHJvbXB0SW5wdXRGb290ZXIuanMnXG5pbXBvcnQgdHlwZSB7IFN1Z2dlc3Rpb25JdGVtIH0gZnJvbSAnLi9Qcm9tcHRJbnB1dEZvb3RlclN1Z2dlc3Rpb25zLmpzJ1xuaW1wb3J0IHsgUHJvbXB0SW5wdXRNb2RlSW5kaWNhdG9yIH0gZnJvbSAnLi9Qcm9tcHRJbnB1dE1vZGVJbmRpY2F0b3IuanMnXG5pbXBvcnQgeyBQcm9tcHRJbnB1dFF1ZXVlZENvbW1hbmRzIH0gZnJvbSAnLi9Qcm9tcHRJbnB1dFF1ZXVlZENvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgUHJvbXB0SW5wdXRTdGFzaE5vdGljZSB9IGZyb20gJy4vUHJvbXB0SW5wdXRTdGFzaE5vdGljZS5qcydcbmltcG9ydCB7IHVzZU1heWJlVHJ1bmNhdGVJbnB1dCB9IGZyb20gJy4vdXNlTWF5YmVUcnVuY2F0ZUlucHV0LmpzJ1xuaW1wb3J0IHsgdXNlUHJvbXB0SW5wdXRQbGFjZWhvbGRlciB9IGZyb20gJy4vdXNlUHJvbXB0SW5wdXRQbGFjZWhvbGRlci5qcydcbmltcG9ydCB7IHVzZVNob3dGYXN0SWNvbkhpbnQgfSBmcm9tICcuL3VzZVNob3dGYXN0SWNvbkhpbnQuanMnXG5pbXBvcnQgeyB1c2VTd2FybUJhbm5lciB9IGZyb20gJy4vdXNlU3dhcm1CYW5uZXIuanMnXG5pbXBvcnQgeyBpc05vblNwYWNlUHJpbnRhYmxlLCBpc1ZpbU1vZGVFbmFibGVkIH0gZnJvbSAnLi91dGlscy5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgZGVidWc6IGJvb2xlYW5cbiAgaWRlU2VsZWN0aW9uOiBJREVTZWxlY3Rpb24gfCB1bmRlZmluZWRcbiAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiBUb29sUGVybWlzc2lvbkNvbnRleHRcbiAgc2V0VG9vbFBlcm1pc3Npb25Db250ZXh0OiAoY3R4OiBUb29sUGVybWlzc2lvbkNvbnRleHQpID0+IHZvaWRcbiAgYXBpS2V5U3RhdHVzOiBWZXJpZmljYXRpb25TdGF0dXNcbiAgY29tbWFuZHM6IENvbW1hbmRbXVxuICBhZ2VudHM6IEFnZW50RGVmaW5pdGlvbltdXG4gIGlzTG9hZGluZzogYm9vbGVhblxuICB2ZXJib3NlOiBib29sZWFuXG4gIG1lc3NhZ2VzOiBNZXNzYWdlW11cbiAgb25BdXRvVXBkYXRlclJlc3VsdDogKHJlc3VsdDogQXV0b1VwZGF0ZXJSZXN1bHQpID0+IHZvaWRcbiAgYXV0b1VwZGF0ZXJSZXN1bHQ6IEF1dG9VcGRhdGVyUmVzdWx0IHwgbnVsbFxuICBpbnB1dDogc3RyaW5nXG4gIG9uSW5wdXRDaGFuZ2U6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkXG4gIG1vZGU6IFByb21wdElucHV0TW9kZVxuICBvbk1vZGVDaGFuZ2U6IChtb2RlOiBQcm9tcHRJbnB1dE1vZGUpID0+IHZvaWRcbiAgc3Rhc2hlZFByb21wdDpcbiAgICB8IHtcbiAgICAgICAgdGV4dDogc3RyaW5nXG4gICAgICAgIGN1cnNvck9mZnNldDogbnVtYmVyXG4gICAgICAgIHBhc3RlZENvbnRlbnRzOiBSZWNvcmQ8bnVtYmVyLCBQYXN0ZWRDb250ZW50PlxuICAgICAgfVxuICAgIHwgdW5kZWZpbmVkXG4gIHNldFN0YXNoZWRQcm9tcHQ6IChcbiAgICB2YWx1ZTpcbiAgICAgIHwge1xuICAgICAgICAgIHRleHQ6IHN0cmluZ1xuICAgICAgICAgIGN1cnNvck9mZnNldDogbnVtYmVyXG4gICAgICAgICAgcGFzdGVkQ29udGVudHM6IFJlY29yZDxudW1iZXIsIFBhc3RlZENvbnRlbnQ+XG4gICAgICAgIH1cbiAgICAgIHwgdW5kZWZpbmVkLFxuICApID0+IHZvaWRcbiAgc3VibWl0Q291bnQ6IG51bWJlclxuICBvblNob3dNZXNzYWdlU2VsZWN0b3I6ICgpID0+IHZvaWRcbiAgLyoqIEZ1bGxzY3JlZW4gbWVzc2FnZSBhY3Rpb25zOiBzaGlmdCvihpEgZW50ZXJzIGN1cnNvci4gKi9cbiAgb25NZXNzYWdlQWN0aW9uc0VudGVyPzogKCkgPT4gdm9pZFxuICBtY3BDbGllbnRzOiBNQ1BTZXJ2ZXJDb25uZWN0aW9uW11cbiAgcGFzdGVkQ29udGVudHM6IFJlY29yZDxudW1iZXIsIFBhc3RlZENvbnRlbnQ+XG4gIHNldFBhc3RlZENvbnRlbnRzOiBSZWFjdC5EaXNwYXRjaDxcbiAgICBSZWFjdC5TZXRTdGF0ZUFjdGlvbjxSZWNvcmQ8bnVtYmVyLCBQYXN0ZWRDb250ZW50Pj5cbiAgPlxuICB2aW1Nb2RlOiBWaW1Nb2RlXG4gIHNldFZpbU1vZGU6IChtb2RlOiBWaW1Nb2RlKSA9PiB2b2lkXG4gIHNob3dCYXNoZXNEaWFsb2c6IHN0cmluZyB8IGJvb2xlYW5cbiAgc2V0U2hvd0Jhc2hlc0RpYWxvZzogKHNob3c6IHN0cmluZyB8IGJvb2xlYW4pID0+IHZvaWRcbiAgb25FeGl0OiAoKSA9PiB2b2lkXG4gIGdldFRvb2xVc2VDb250ZXh0OiAoXG4gICAgbWVzc2FnZXM6IE1lc3NhZ2VbXSxcbiAgICBuZXdNZXNzYWdlczogTWVzc2FnZVtdLFxuICAgIGFib3J0Q29udHJvbGxlcjogQWJvcnRDb250cm9sbGVyLFxuICAgIG1haW5Mb29wTW9kZWw6IHN0cmluZyxcbiAgKSA9PiBQcm9jZXNzVXNlcklucHV0Q29udGV4dFxuICBvblN1Ym1pdDogKFxuICAgIGlucHV0OiBzdHJpbmcsXG4gICAgaGVscGVyczogUHJvbXB0SW5wdXRIZWxwZXJzLFxuICAgIHNwZWN1bGF0aW9uQWNjZXB0Pzoge1xuICAgICAgc3RhdGU6IEFjdGl2ZVNwZWN1bGF0aW9uU3RhdGVcbiAgICAgIHNwZWN1bGF0aW9uU2Vzc2lvblRpbWVTYXZlZE1zOiBudW1iZXJcbiAgICAgIHNldEFwcFN0YXRlOiAoZjogKHByZXY6IEFwcFN0YXRlKSA9PiBBcHBTdGF0ZSkgPT4gdm9pZFxuICAgIH0sXG4gICAgb3B0aW9ucz86IHsgZnJvbUtleWJpbmRpbmc/OiBib29sZWFuIH0sXG4gICkgPT4gUHJvbWlzZTx2b2lkPlxuICBvbkFnZW50U3VibWl0PzogKFxuICAgIGlucHV0OiBzdHJpbmcsXG4gICAgdGFzazogSW5Qcm9jZXNzVGVhbW1hdGVUYXNrU3RhdGUgfCBMb2NhbEFnZW50VGFza1N0YXRlLFxuICAgIGhlbHBlcnM6IFByb21wdElucHV0SGVscGVycyxcbiAgKSA9PiBQcm9taXNlPHZvaWQ+XG4gIGlzU2VhcmNoaW5nSGlzdG9yeTogYm9vbGVhblxuICBzZXRJc1NlYXJjaGluZ0hpc3Rvcnk6IChpc1NlYXJjaGluZzogYm9vbGVhbikgPT4gdm9pZFxuICBvbkRpc21pc3NTaWRlUXVlc3Rpb24/OiAoKSA9PiB2b2lkXG4gIGlzU2lkZVF1ZXN0aW9uVmlzaWJsZT86IGJvb2xlYW5cbiAgaGVscE9wZW46IGJvb2xlYW5cbiAgc2V0SGVscE9wZW46IFJlYWN0LkRpc3BhdGNoPFJlYWN0LlNldFN0YXRlQWN0aW9uPGJvb2xlYW4+PlxuICBoYXNTdXBwcmVzc2VkRGlhbG9ncz86IGJvb2xlYW5cbiAgaXNMb2NhbEpTWENvbW1hbmRBY3RpdmU/OiBib29sZWFuXG4gIGluc2VydFRleHRSZWY/OiBSZWFjdC5NdXRhYmxlUmVmT2JqZWN0PHtcbiAgICBpbnNlcnQ6ICh0ZXh0OiBzdHJpbmcpID0+IHZvaWRcbiAgICBzZXRJbnB1dFdpdGhDdXJzb3I6ICh2YWx1ZTogc3RyaW5nLCBjdXJzb3I6IG51bWJlcikgPT4gdm9pZFxuICAgIGN1cnNvck9mZnNldDogbnVtYmVyXG4gIH0gfCBudWxsPlxuICB2b2ljZUludGVyaW1SYW5nZT86IHsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXIgfSB8IG51bGxcbn1cblxuLy8gQm90dG9tIHNsb3QgaGFzIG1heEhlaWdodD1cIjUwJVwiOyByZXNlcnZlIGxpbmVzIGZvciBmb290ZXIsIGJvcmRlciwgc3RhdHVzLlxuY29uc3QgUFJPTVBUX0ZPT1RFUl9MSU5FUyA9IDVcbmNvbnN0IE1JTl9JTlBVVF9WSUVXUE9SVF9MSU5FUyA9IDNcblxuZnVuY3Rpb24gUHJvbXB0SW5wdXQoe1xuICBkZWJ1ZyxcbiAgaWRlU2VsZWN0aW9uLFxuICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gIHNldFRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgYXBpS2V5U3RhdHVzLFxuICBjb21tYW5kcyxcbiAgYWdlbnRzLFxuICBpc0xvYWRpbmcsXG4gIHZlcmJvc2UsXG4gIG1lc3NhZ2VzLFxuICBvbkF1dG9VcGRhdGVyUmVzdWx0LFxuICBhdXRvVXBkYXRlclJlc3VsdCxcbiAgaW5wdXQsXG4gIG9uSW5wdXRDaGFuZ2UsXG4gIG1vZGUsXG4gIG9uTW9kZUNoYW5nZSxcbiAgc3Rhc2hlZFByb21wdCxcbiAgc2V0U3Rhc2hlZFByb21wdCxcbiAgc3VibWl0Q291bnQsXG4gIG9uU2hvd01lc3NhZ2VTZWxlY3RvcixcbiAgb25NZXNzYWdlQWN0aW9uc0VudGVyLFxuICBtY3BDbGllbnRzLFxuICBwYXN0ZWRDb250ZW50cyxcbiAgc2V0UGFzdGVkQ29udGVudHMsXG4gIHZpbU1vZGUsXG4gIHNldFZpbU1vZGUsXG4gIHNob3dCYXNoZXNEaWFsb2csXG4gIHNldFNob3dCYXNoZXNEaWFsb2csXG4gIG9uRXhpdCxcbiAgZ2V0VG9vbFVzZUNvbnRleHQsXG4gIG9uU3VibWl0OiBvblN1Ym1pdFByb3AsXG4gIG9uQWdlbnRTdWJtaXQsXG4gIGlzU2VhcmNoaW5nSGlzdG9yeSxcbiAgc2V0SXNTZWFyY2hpbmdIaXN0b3J5LFxuICBvbkRpc21pc3NTaWRlUXVlc3Rpb24sXG4gIGlzU2lkZVF1ZXN0aW9uVmlzaWJsZSxcbiAgaGVscE9wZW4sXG4gIHNldEhlbHBPcGVuLFxuICBoYXNTdXBwcmVzc2VkRGlhbG9ncyxcbiAgaXNMb2NhbEpTWENvbW1hbmRBY3RpdmUgPSBmYWxzZSxcbiAgaW5zZXJ0VGV4dFJlZixcbiAgdm9pY2VJbnRlcmltUmFuZ2UsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IG1haW5Mb29wTW9kZWwgPSB1c2VNYWluTG9vcE1vZGVsKClcbiAgLy8gQSBsb2NhbC1qc3ggY29tbWFuZCAoZS5nLiwgL21jcCB3aGlsZSBhZ2VudCBpcyBydW5uaW5nKSByZW5kZXJzIGEgZnVsbC1cbiAgLy8gc2NyZWVuIGRpYWxvZyBvbiB0b3Agb2YgUHJvbXB0SW5wdXQgdmlhIHRoZSBpbW1lZGlhdGUtY29tbWFuZCBwYXRoIHdpdGhcbiAgLy8gc2hvdWxkSGlkZVByb21wdElucHV0OiBmYWxzZS4gVGhvc2UgZGlhbG9ncyBkb24ndCByZWdpc3RlciBpbiB0aGUgb3ZlcmxheVxuICAvLyBzeXN0ZW0sIHNvIHRyZWF0IHRoZW0gYXMgYSBtb2RhbCBvdmVybGF5IGhlcmUgdG8gc3RvcCBuYXZpZ2F0aW9uIGtleXMgZnJvbVxuICAvLyBsZWFraW5nIGludG8gVGV4dElucHV0L2Zvb3RlciBoYW5kbGVycyBhbmQgc3RhY2tpbmcgYSBzZWNvbmQgZGlhbG9nLlxuICBjb25zdCBpc01vZGFsT3ZlcmxheUFjdGl2ZSA9XG4gICAgdXNlSXNNb2RhbE92ZXJsYXlBY3RpdmUoKSB8fCBpc0xvY2FsSlNYQ29tbWFuZEFjdGl2ZVxuICBjb25zdCBbaXNBdXRvVXBkYXRpbmcsIHNldElzQXV0b1VwZGF0aW5nXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbZXhpdE1lc3NhZ2UsIHNldEV4aXRNZXNzYWdlXSA9IHVzZVN0YXRlPHtcbiAgICBzaG93OiBib29sZWFuXG4gICAga2V5Pzogc3RyaW5nXG4gIH0+KHsgc2hvdzogZmFsc2UgfSlcbiAgY29uc3QgW2N1cnNvck9mZnNldCwgc2V0Q3Vyc29yT2Zmc2V0XSA9IHVzZVN0YXRlPG51bWJlcj4oaW5wdXQubGVuZ3RoKVxuICAvLyBUcmFjayB0aGUgbGFzdCBpbnB1dCB2YWx1ZSBzZXQgdmlhIGludGVybmFsIGhhbmRsZXJzIHNvIHdlIGNhbiBkZXRlY3RcbiAgLy8gZXh0ZXJuYWwgaW5wdXQgY2hhbmdlcyAoZS5nLiBzcGVlY2gtdG8tdGV4dCBpbmplY3Rpb24pIGFuZCBtb3ZlIGN1cnNvciB0byBlbmQuXG4gIGNvbnN0IGxhc3RJbnRlcm5hbElucHV0UmVmID0gUmVhY3QudXNlUmVmKGlucHV0KVxuICBpZiAoaW5wdXQgIT09IGxhc3RJbnRlcm5hbElucHV0UmVmLmN1cnJlbnQpIHtcbiAgICAvLyBJbnB1dCBjaGFuZ2VkIGV4dGVybmFsbHkgKG5vdCB0aHJvdWdoIGFueSBpbnRlcm5hbCBoYW5kbGVyKSDigJQgbW92ZSBjdXJzb3IgdG8gZW5kXG4gICAgc2V0Q3Vyc29yT2Zmc2V0KGlucHV0Lmxlbmd0aClcbiAgICBsYXN0SW50ZXJuYWxJbnB1dFJlZi5jdXJyZW50ID0gaW5wdXRcbiAgfVxuICAvLyBXcmFwIG9uSW5wdXRDaGFuZ2UgdG8gdHJhY2sgaW50ZXJuYWwgY2hhbmdlcyBiZWZvcmUgdGhleSB0cmlnZ2VyIHJlLXJlbmRlclxuICBjb25zdCB0cmFja0FuZFNldElucHV0ID0gUmVhY3QudXNlQ2FsbGJhY2soXG4gICAgKHZhbHVlOiBzdHJpbmcpID0+IHtcbiAgICAgIGxhc3RJbnRlcm5hbElucHV0UmVmLmN1cnJlbnQgPSB2YWx1ZVxuICAgICAgb25JbnB1dENoYW5nZSh2YWx1ZSlcbiAgICB9LFxuICAgIFtvbklucHV0Q2hhbmdlXSxcbiAgKVxuICAvLyBFeHBvc2UgYW4gaW5zZXJ0VGV4dCBmdW5jdGlvbiBzbyBjYWxsZXJzIChlLmcuIFNUVCkgY2FuIHNwbGljZSB0ZXh0IGF0IHRoZVxuICAvLyBjdXJyZW50IGN1cnNvciBwb3NpdGlvbiBpbnN0ZWFkIG9mIHJlcGxhY2luZyB0aGUgZW50aXJlIGlucHV0LlxuICBpZiAoaW5zZXJ0VGV4dFJlZikge1xuICAgIGluc2VydFRleHRSZWYuY3VycmVudCA9IHtcbiAgICAgIGN1cnNvck9mZnNldCxcbiAgICAgIGluc2VydDogKHRleHQ6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCBuZWVkc1NwYWNlID1cbiAgICAgICAgICBjdXJzb3JPZmZzZXQgPT09IGlucHV0Lmxlbmd0aCAmJlxuICAgICAgICAgIGlucHV0Lmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICAhL1xccyQvLnRlc3QoaW5wdXQpXG4gICAgICAgIGNvbnN0IGluc2VydFRleHQgPSBuZWVkc1NwYWNlID8gJyAnICsgdGV4dCA6IHRleHRcbiAgICAgICAgY29uc3QgbmV3VmFsdWUgPVxuICAgICAgICAgIGlucHV0LnNsaWNlKDAsIGN1cnNvck9mZnNldCkgKyBpbnNlcnRUZXh0ICsgaW5wdXQuc2xpY2UoY3Vyc29yT2Zmc2V0KVxuICAgICAgICBsYXN0SW50ZXJuYWxJbnB1dFJlZi5jdXJyZW50ID0gbmV3VmFsdWVcbiAgICAgICAgb25JbnB1dENoYW5nZShuZXdWYWx1ZSlcbiAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0KGN1cnNvck9mZnNldCArIGluc2VydFRleHQubGVuZ3RoKVxuICAgICAgfSxcbiAgICAgIHNldElucHV0V2l0aEN1cnNvcjogKHZhbHVlOiBzdHJpbmcsIGN1cnNvcjogbnVtYmVyKSA9PiB7XG4gICAgICAgIGxhc3RJbnRlcm5hbElucHV0UmVmLmN1cnJlbnQgPSB2YWx1ZVxuICAgICAgICBvbklucHV0Q2hhbmdlKHZhbHVlKVxuICAgICAgICBzZXRDdXJzb3JPZmZzZXQoY3Vyc29yKVxuICAgICAgfSxcbiAgICB9XG4gIH1cbiAgY29uc3Qgc3RvcmUgPSB1c2VBcHBTdGF0ZVN0b3JlKClcbiAgY29uc3Qgc2V0QXBwU3RhdGUgPSB1c2VTZXRBcHBTdGF0ZSgpXG4gIGNvbnN0IHRhc2tzID0gdXNlQXBwU3RhdGUocyA9PiBzLnRhc2tzKVxuICBjb25zdCByZXBsQnJpZGdlQ29ubmVjdGVkID0gdXNlQXBwU3RhdGUocyA9PiBzLnJlcGxCcmlkZ2VDb25uZWN0ZWQpXG4gIGNvbnN0IHJlcGxCcmlkZ2VFeHBsaWNpdCA9IHVzZUFwcFN0YXRlKHMgPT4gcy5yZXBsQnJpZGdlRXhwbGljaXQpXG4gIGNvbnN0IHJlcGxCcmlkZ2VSZWNvbm5lY3RpbmcgPSB1c2VBcHBTdGF0ZShzID0+IHMucmVwbEJyaWRnZVJlY29ubmVjdGluZylcbiAgLy8gTXVzdCBtYXRjaCBCcmlkZ2VTdGF0dXNJbmRpY2F0b3IncyByZW5kZXIgY29uZGl0aW9uIChQcm9tcHRJbnB1dEZvb3Rlci50c3gpIOKAlFxuICAvLyB0aGUgcGlsbCByZXR1cm5zIG51bGwgZm9yIGltcGxpY2l0LWFuZC1ub3QtcmVjb25uZWN0aW5nLCBzbyBuYXYgbXVzdCB0b28sXG4gIC8vIG90aGVyd2lzZSBicmlkZ2UgYmVjb21lcyBhbiBpbnZpc2libGUgc2VsZWN0aW9uIHN0b3AuXG4gIGNvbnN0IGJyaWRnZUZvb3RlclZpc2libGUgPVxuICAgIHJlcGxCcmlkZ2VDb25uZWN0ZWQgJiYgKHJlcGxCcmlkZ2VFeHBsaWNpdCB8fCByZXBsQnJpZGdlUmVjb25uZWN0aW5nKVxuICAvLyBUbXV4IHBpbGwgKGFudC1vbmx5KSDigJQgdmlzaWJsZSB3aGVuIHRoZXJlJ3MgYW4gYWN0aXZlIHR1bmdzdGVuIHNlc3Npb25cbiAgY29uc3QgaGFzVHVuZ3N0ZW5TZXNzaW9uID0gdXNlQXBwU3RhdGUoXG4gICAgcyA9PlxuICAgICAgXCJleHRlcm5hbFwiID09PSAnYW50JyAmJiBzLnR1bmdzdGVuQWN0aXZlU2Vzc2lvbiAhPT0gdW5kZWZpbmVkLFxuICApXG4gIGNvbnN0IHRtdXhGb290ZXJWaXNpYmxlID1cbiAgICBcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIGhhc1R1bmdzdGVuU2Vzc2lvblxuICAvLyBXZWJCcm93c2VyIHBpbGwg4oCUIHZpc2libGUgd2hlbiBhIGJyb3dzZXIgaXMgb3BlblxuICBjb25zdCBiYWdlbEZvb3RlclZpc2libGUgPSB1c2VBcHBTdGF0ZShzID0+XG4gICAgICAgIGZhbHNlLFxuICApXG4gIGNvbnN0IHRlYW1Db250ZXh0ID0gdXNlQXBwU3RhdGUocyA9PiBzLnRlYW1Db250ZXh0KVxuICBjb25zdCBxdWV1ZWRDb21tYW5kcyA9IHVzZUNvbW1hbmRRdWV1ZSgpXG4gIGNvbnN0IHByb21wdFN1Z2dlc3Rpb25TdGF0ZSA9IHVzZUFwcFN0YXRlKHMgPT4gcy5wcm9tcHRTdWdnZXN0aW9uKVxuICBjb25zdCBzcGVjdWxhdGlvbiA9IHVzZUFwcFN0YXRlKHMgPT4gcy5zcGVjdWxhdGlvbilcbiAgY29uc3Qgc3BlY3VsYXRpb25TZXNzaW9uVGltZVNhdmVkTXMgPSB1c2VBcHBTdGF0ZShcbiAgICBzID0+IHMuc3BlY3VsYXRpb25TZXNzaW9uVGltZVNhdmVkTXMsXG4gIClcbiAgY29uc3Qgdmlld2luZ0FnZW50VGFza0lkID0gdXNlQXBwU3RhdGUocyA9PiBzLnZpZXdpbmdBZ2VudFRhc2tJZClcbiAgY29uc3Qgdmlld1NlbGVjdGlvbk1vZGUgPSB1c2VBcHBTdGF0ZShzID0+IHMudmlld1NlbGVjdGlvbk1vZGUpXG4gIGNvbnN0IHNob3dTcGlubmVyVHJlZSA9IHVzZUFwcFN0YXRlKHMgPT4gcy5leHBhbmRlZFZpZXcpID09PSAndGVhbW1hdGVzJ1xuICBjb25zdCB7IGNvbXBhbmlvbjogX2NvbXBhbmlvbiwgY29tcGFuaW9uTXV0ZWQgfSA9IGZlYXR1cmUoJ0JVRERZJylcbiAgICA/IGdldEdsb2JhbENvbmZpZygpXG4gICAgOiB7IGNvbXBhbmlvbjogdW5kZWZpbmVkLCBjb21wYW5pb25NdXRlZDogdW5kZWZpbmVkIH1cbiAgY29uc3QgY29tcGFuaW9uRm9vdGVyVmlzaWJsZSA9ICEhX2NvbXBhbmlvbiAmJiAhY29tcGFuaW9uTXV0ZWRcbiAgLy8gQnJpZWYgbW9kZTogQnJpZWZTcGlubmVyL0JyaWVmSWRsZVN0YXR1cyBvd24gdGhlIDItcm93IGZvb3RwcmludCBhYm92ZVxuICAvLyB0aGUgaW5wdXQuIERyb3BwaW5nIG1hcmdpblRvcCBoZXJlIGxldHMgdGhlIHNwaW5uZXIgc2l0IGZsdXNoIGFnYWluc3RcbiAgLy8gdGhlIGlucHV0IGJhci4gdmlld2luZ0FnZW50VGFza0lkIG1pcnJvcnMgdGhlIGdhdGUgb24gYm90aCAoU3Bpbm5lci50c3gsXG4gIC8vIFJFUEwudHN4KSDigJQgdGVhbW1hdGUgdmlldyBmYWxscyBiYWNrIHRvIFNwaW5uZXJXaXRoVmVyYklubmVyIHdoaWNoIGhhc1xuICAvLyBpdHMgb3duIG1hcmdpblRvcCwgc28gdGhlIGdhcCBzdGF5cyBldmVuIHdpdGhvdXQgb3Vycy5cbiAgY29uc3QgYnJpZWZPd25zR2FwID1cbiAgICBmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQlJJRUYnKVxuICAgICAgPyAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gICAgICAgIHVzZUFwcFN0YXRlKHMgPT4gcy5pc0JyaWVmT25seSkgJiYgIXZpZXdpbmdBZ2VudFRhc2tJZFxuICAgICAgOiBmYWxzZVxuICBjb25zdCBtYWluTG9vcE1vZGVsXyA9IHVzZUFwcFN0YXRlKHMgPT4gcy5tYWluTG9vcE1vZGVsKVxuICBjb25zdCBtYWluTG9vcE1vZGVsRm9yU2Vzc2lvbiA9IHVzZUFwcFN0YXRlKHMgPT4gcy5tYWluTG9vcE1vZGVsRm9yU2Vzc2lvbilcbiAgY29uc3QgdGhpbmtpbmdFbmFibGVkID0gdXNlQXBwU3RhdGUocyA9PiBzLnRoaW5raW5nRW5hYmxlZClcbiAgY29uc3QgaXNGYXN0TW9kZSA9IHVzZUFwcFN0YXRlKHMgPT5cbiAgICBpc0Zhc3RNb2RlRW5hYmxlZCgpID8gcy5mYXN0TW9kZSA6IGZhbHNlLFxuICApXG4gIGNvbnN0IGVmZm9ydFZhbHVlID0gdXNlQXBwU3RhdGUocyA9PiBzLmVmZm9ydFZhbHVlKVxuICBjb25zdCB2aWV3ZWRUZWFtbWF0ZSA9IGdldFZpZXdlZFRlYW1tYXRlVGFzayhzdG9yZS5nZXRTdGF0ZSgpKVxuICBjb25zdCB2aWV3aW5nQWdlbnROYW1lID0gdmlld2VkVGVhbW1hdGU/LmlkZW50aXR5LmFnZW50TmFtZVxuICAvLyBpZGVudGl0eS5jb2xvciBpcyB0eXBlZCBhcyBgc3RyaW5nIHwgdW5kZWZpbmVkYCAobm90IEFnZW50Q29sb3JOYW1lKSBiZWNhdXNlXG4gIC8vIHRlYW1tYXRlIGlkZW50aXR5IGNvbWVzIGZyb20gZmlsZS1iYXNlZCBjb25maWcuIFZhbGlkYXRlIGJlZm9yZSBjYXN0aW5nIHRvXG4gIC8vIGVuc3VyZSB3ZSBvbmx5IHVzZSB2YWxpZCBjb2xvciBuYW1lcyAoZmFsbHMgYmFjayB0byBjeWFuIGlmIGludmFsaWQpLlxuICBjb25zdCB2aWV3aW5nQWdlbnRDb2xvciA9XG4gICAgdmlld2VkVGVhbW1hdGU/LmlkZW50aXR5LmNvbG9yICYmXG4gICAgQUdFTlRfQ09MT1JTLmluY2x1ZGVzKHZpZXdlZFRlYW1tYXRlLmlkZW50aXR5LmNvbG9yIGFzIEFnZW50Q29sb3JOYW1lKVxuICAgICAgPyAodmlld2VkVGVhbW1hdGUuaWRlbnRpdHkuY29sb3IgYXMgQWdlbnRDb2xvck5hbWUpXG4gICAgICA6IHVuZGVmaW5lZFxuICAvLyBJbi1wcm9jZXNzIHRlYW1tYXRlcyBzb3J0ZWQgYWxwaGFiZXRpY2FsbHkgZm9yIGZvb3RlciB0ZWFtIHNlbGVjdG9yXG4gIGNvbnN0IGluUHJvY2Vzc1RlYW1tYXRlcyA9IHVzZU1lbW8oXG4gICAgKCkgPT4gZ2V0UnVubmluZ1RlYW1tYXRlc1NvcnRlZCh0YXNrcyksXG4gICAgW3Rhc2tzXSxcbiAgKVxuXG4gIC8vIFRlYW0gbW9kZTogYWxsIGJhY2tncm91bmQgdGFza3MgYXJlIGluLXByb2Nlc3MgdGVhbW1hdGVzXG4gIGNvbnN0IGlzVGVhbW1hdGVNb2RlID1cbiAgICBpblByb2Nlc3NUZWFtbWF0ZXMubGVuZ3RoID4gMCB8fCB2aWV3ZWRUZWFtbWF0ZSAhPT0gdW5kZWZpbmVkXG5cbiAgLy8gV2hlbiB2aWV3aW5nIGEgdGVhbW1hdGUsIHNob3cgdGhlaXIgcGVybWlzc2lvbiBtb2RlIGluIHRoZSBmb290ZXIgaW5zdGVhZCBvZiB0aGUgbGVhZGVyJ3NcbiAgY29uc3QgZWZmZWN0aXZlVG9vbFBlcm1pc3Npb25Db250ZXh0ID0gdXNlTWVtbygoKTogVG9vbFBlcm1pc3Npb25Db250ZXh0ID0+IHtcbiAgICBpZiAodmlld2VkVGVhbW1hdGUpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIC4uLnRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgICAgbW9kZTogdmlld2VkVGVhbW1hdGUucGVybWlzc2lvbk1vZGUsXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0b29sUGVybWlzc2lvbkNvbnRleHRcbiAgfSwgW3ZpZXdlZFRlYW1tYXRlLCB0b29sUGVybWlzc2lvbkNvbnRleHRdKVxuICBjb25zdCB7IGhpc3RvcnlRdWVyeSwgc2V0SGlzdG9yeVF1ZXJ5LCBoaXN0b3J5TWF0Y2gsIGhpc3RvcnlGYWlsZWRNYXRjaCB9ID1cbiAgICB1c2VIaXN0b3J5U2VhcmNoKFxuICAgICAgZW50cnkgPT4ge1xuICAgICAgICBzZXRQYXN0ZWRDb250ZW50cyhlbnRyeS5wYXN0ZWRDb250ZW50cylcbiAgICAgICAgdm9pZCBvblN1Ym1pdChlbnRyeS5kaXNwbGF5KVxuICAgICAgfSxcbiAgICAgIGlucHV0LFxuICAgICAgdHJhY2tBbmRTZXRJbnB1dCxcbiAgICAgIHNldEN1cnNvck9mZnNldCxcbiAgICAgIGN1cnNvck9mZnNldCxcbiAgICAgIG9uTW9kZUNoYW5nZSxcbiAgICAgIG1vZGUsXG4gICAgICBpc1NlYXJjaGluZ0hpc3RvcnksXG4gICAgICBzZXRJc1NlYXJjaGluZ0hpc3RvcnksXG4gICAgICBzZXRQYXN0ZWRDb250ZW50cyxcbiAgICAgIHBhc3RlZENvbnRlbnRzLFxuICAgIClcbiAgLy8gQ291bnRlciBmb3IgcGFzdGUgSURzIChzaGFyZWQgYmV0d2VlbiBpbWFnZXMgYW5kIHRleHQpLlxuICAvLyBDb21wdXRlIGluaXRpYWwgdmFsdWUgb25jZSBmcm9tIGV4aXN0aW5nIG1lc3NhZ2VzIChmb3IgLS1jb250aW51ZS8tLXJlc3VtZSkuXG4gIC8vIHVzZVJlZihmbigpKSBldmFsdWF0ZXMgZm4oKSBvbiBldmVyeSByZW5kZXIgYW5kIGRpc2NhcmRzIHRoZSByZXN1bHQgYWZ0ZXJcbiAgLy8gbW91bnQg4oCUIGdldEluaXRpYWxQYXN0ZUlkIHdhbGtzIGFsbCBtZXNzYWdlcyArIHJlZ2V4LXNjYW5zIHRleHQgYmxvY2tzLFxuICAvLyBzbyBndWFyZCB3aXRoIGEgbGF6eS1pbml0IHBhdHRlcm4gdG8gcnVuIGl0IGV4YWN0bHkgb25jZS5cbiAgY29uc3QgbmV4dFBhc3RlSWRSZWYgPSB1c2VSZWYoLTEpXG4gIGlmIChuZXh0UGFzdGVJZFJlZi5jdXJyZW50ID09PSAtMSkge1xuICAgIG5leHRQYXN0ZUlkUmVmLmN1cnJlbnQgPSBnZXRJbml0aWFsUGFzdGVJZChtZXNzYWdlcylcbiAgfVxuICAvLyBBcm1lZCBieSBvbkltYWdlUGFzdGU7IGlmIHRoZSB2ZXJ5IG5leHQga2V5c3Ryb2tlIGlzIGEgbm9uLXNwYWNlXG4gIC8vIHByaW50YWJsZSwgaW5wdXRGaWx0ZXIgcHJlcGVuZHMgYSBzcGFjZSBiZWZvcmUgaXQuIEFueSBvdGhlciBpbnB1dFxuICAvLyAoYXJyb3csIGVzY2FwZSwgYmFja3NwYWNlLCBwYXN0ZSwgc3BhY2UpIGRpc2FybXMgd2l0aG91dCBpbnNlcnRpbmcuXG4gIGNvbnN0IHBlbmRpbmdTcGFjZUFmdGVyUGlsbFJlZiA9IHVzZVJlZihmYWxzZSlcblxuICBjb25zdCBbc2hvd1RlYW1zRGlhbG9nLCBzZXRTaG93VGVhbXNEaWFsb2ddID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtzaG93QnJpZGdlRGlhbG9nLCBzZXRTaG93QnJpZGdlRGlhbG9nXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbdGVhbW1hdGVGb290ZXJJbmRleCwgc2V0VGVhbW1hdGVGb290ZXJJbmRleF0gPSB1c2VTdGF0ZSgwKVxuICAvLyAtMSBzZW50aW5lbDogdGFza3MgcGlsbCBpcyBzZWxlY3RlZCBidXQgbm8gc3BlY2lmaWMgYWdlbnQgcm93IGlzIHNlbGVjdGVkIHlldC5cbiAgLy8gRmlyc3Qg4oaTIHNlbGVjdHMgdGhlIHBpbGwsIHNlY29uZCDihpMgbW92ZXMgdG8gcm93IDAuIFByZXZlbnRzIGRvdWJsZS1zZWxlY3RcbiAgLy8gb2YgcGlsbCArIHJvdyB3aGVuIGJvdGggYmcgdGFza3MgKHBpbGwpIGFuZCBmb3JrZWQgYWdlbnRzIChyb3dzKSBhcmUgdmlzaWJsZS5cbiAgY29uc3QgY29vcmRpbmF0b3JUYXNrSW5kZXggPSB1c2VBcHBTdGF0ZShzID0+IHMuY29vcmRpbmF0b3JUYXNrSW5kZXgpXG4gIGNvbnN0IHNldENvb3JkaW5hdG9yVGFza0luZGV4ID0gdXNlQ2FsbGJhY2soXG4gICAgKHY6IG51bWJlciB8ICgocHJldjogbnVtYmVyKSA9PiBudW1iZXIpKSA9PlxuICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICAgIGNvbnN0IG5leHQgPSB0eXBlb2YgdiA9PT0gJ2Z1bmN0aW9uJyA/IHYocHJldi5jb29yZGluYXRvclRhc2tJbmRleCkgOiB2XG4gICAgICAgIGlmIChuZXh0ID09PSBwcmV2LmNvb3JkaW5hdG9yVGFza0luZGV4KSByZXR1cm4gcHJldlxuICAgICAgICByZXR1cm4geyAuLi5wcmV2LCBjb29yZGluYXRvclRhc2tJbmRleDogbmV4dCB9XG4gICAgICB9KSxcbiAgICBbc2V0QXBwU3RhdGVdLFxuICApXG4gIGNvbnN0IGNvb3JkaW5hdG9yVGFza0NvdW50ID0gdXNlQ29vcmRpbmF0b3JUYXNrQ291bnQoKVxuICAvLyBUaGUgcGlsbCAoQmFja2dyb3VuZFRhc2tTdGF0dXMpIG9ubHkgcmVuZGVycyB3aGVuIG5vbi1sb2NhbF9hZ2VudCBiZyB0YXNrc1xuICAvLyBleGlzdC4gV2hlbiBvbmx5IGxvY2FsX2FnZW50IHRhc2tzIGFyZSBydW5uaW5nIChjb29yZGluYXRvci9mb3JrIG1vZGUpLCB0aGVcbiAgLy8gcGlsbCBpcyBhYnNlbnQsIHNvIHRoZSAtMSBzZW50aW5lbCB3b3VsZCBsZWF2ZSBub3RoaW5nIHZpc3VhbGx5IHNlbGVjdGVkLlxuICAvLyBJbiB0aGF0IGNhc2UsIHNraXAgLTEgYW5kIHRyZWF0IDAgYXMgdGhlIG1pbmltdW0gc2VsZWN0YWJsZSBpbmRleC5cbiAgY29uc3QgaGFzQmdUYXNrUGlsbCA9IHVzZU1lbW8oXG4gICAgKCkgPT5cbiAgICAgIE9iamVjdC52YWx1ZXModGFza3MpLnNvbWUoXG4gICAgICAgIHQgPT5cbiAgICAgICAgICBpc0JhY2tncm91bmRUYXNrKHQpICYmXG4gICAgICAgICAgIShcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIGlzUGFuZWxBZ2VudFRhc2sodCkpLFxuICAgICAgKSxcbiAgICBbdGFza3NdLFxuICApXG4gIGNvbnN0IG1pbkNvb3JkaW5hdG9ySW5kZXggPSBoYXNCZ1Rhc2tQaWxsID8gLTEgOiAwXG4gIC8vIENsYW1wIGluZGV4IHdoZW4gdGFza3MgY29tcGxldGUgYW5kIHRoZSBsaXN0IHNocmlua3MgYmVuZWF0aCB0aGUgY3Vyc29yXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGNvb3JkaW5hdG9yVGFza0luZGV4ID49IGNvb3JkaW5hdG9yVGFza0NvdW50KSB7XG4gICAgICBzZXRDb29yZGluYXRvclRhc2tJbmRleChcbiAgICAgICAgTWF0aC5tYXgobWluQ29vcmRpbmF0b3JJbmRleCwgY29vcmRpbmF0b3JUYXNrQ291bnQgLSAxKSxcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvb3JkaW5hdG9yVGFza0luZGV4IDwgbWluQ29vcmRpbmF0b3JJbmRleCkge1xuICAgICAgc2V0Q29vcmRpbmF0b3JUYXNrSW5kZXgobWluQ29vcmRpbmF0b3JJbmRleClcbiAgICB9XG4gIH0sIFtjb29yZGluYXRvclRhc2tDb3VudCwgY29vcmRpbmF0b3JUYXNrSW5kZXgsIG1pbkNvb3JkaW5hdG9ySW5kZXhdKVxuICBjb25zdCBbaXNQYXN0aW5nLCBzZXRJc1Bhc3RpbmddID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtpc0V4dGVybmFsRWRpdG9yQWN0aXZlLCBzZXRJc0V4dGVybmFsRWRpdG9yQWN0aXZlXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbc2hvd01vZGVsUGlja2VyLCBzZXRTaG93TW9kZWxQaWNrZXJdID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtzaG93UXVpY2tPcGVuLCBzZXRTaG93UXVpY2tPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbc2hvd0dsb2JhbFNlYXJjaCwgc2V0U2hvd0dsb2JhbFNlYXJjaF0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW3Nob3dIaXN0b3J5UGlja2VyLCBzZXRTaG93SGlzdG9yeVBpY2tlcl0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW3Nob3dGYXN0TW9kZVBpY2tlciwgc2V0U2hvd0Zhc3RNb2RlUGlja2VyXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbc2hvd1RoaW5raW5nVG9nZ2xlLCBzZXRTaG93VGhpbmtpbmdUb2dnbGVdID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtzaG93QXV0b01vZGVPcHRJbiwgc2V0U2hvd0F1dG9Nb2RlT3B0SW5dID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtwcmV2aW91c01vZGVCZWZvcmVBdXRvLCBzZXRQcmV2aW91c01vZGVCZWZvcmVBdXRvXSA9XG4gICAgdXNlU3RhdGU8UGVybWlzc2lvbk1vZGUgfCBudWxsPihudWxsKVxuICBjb25zdCBhdXRvTW9kZU9wdEluVGltZW91dFJlZiA9IHVzZVJlZjxOb2RlSlMuVGltZW91dCB8IG51bGw+KG51bGwpXG5cbiAgLy8gQ2hlY2sgaWYgY3Vyc29yIGlzIG9uIHRoZSBmaXJzdCBsaW5lIG9mIGlucHV0XG4gIGNvbnN0IGlzQ3Vyc29yT25GaXJzdExpbmUgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBmaXJzdE5ld2xpbmVJbmRleCA9IGlucHV0LmluZGV4T2YoJ1xcbicpXG4gICAgaWYgKGZpcnN0TmV3bGluZUluZGV4ID09PSAtMSkge1xuICAgICAgcmV0dXJuIHRydWUgLy8gTm8gbmV3bGluZXMsIGN1cnNvciBpcyBhbHdheXMgb24gZmlyc3QgbGluZVxuICAgIH1cbiAgICByZXR1cm4gY3Vyc29yT2Zmc2V0IDw9IGZpcnN0TmV3bGluZUluZGV4XG4gIH0sIFtpbnB1dCwgY3Vyc29yT2Zmc2V0XSlcblxuICBjb25zdCBpc0N1cnNvck9uTGFzdExpbmUgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBjb25zdCBsYXN0TmV3bGluZUluZGV4ID0gaW5wdXQubGFzdEluZGV4T2YoJ1xcbicpXG4gICAgaWYgKGxhc3ROZXdsaW5lSW5kZXggPT09IC0xKSB7XG4gICAgICByZXR1cm4gdHJ1ZSAvLyBObyBuZXdsaW5lcywgY3Vyc29yIGlzIGFsd2F5cyBvbiBsYXN0IGxpbmVcbiAgICB9XG4gICAgcmV0dXJuIGN1cnNvck9mZnNldCA+IGxhc3ROZXdsaW5lSW5kZXhcbiAgfSwgW2lucHV0LCBjdXJzb3JPZmZzZXRdKVxuXG4gIC8vIERlcml2ZSB0ZWFtIGluZm8gZnJvbSB0ZWFtQ29udGV4dCAobm8gZmlsZXN5c3RlbSBJL08gbmVlZGVkKVxuICAvLyBBIHNlc3Npb24gY2FuIG9ubHkgbGVhZCBvbmUgdGVhbSBhdCBhIHRpbWVcbiAgY29uc3QgY2FjaGVkVGVhbXM6IFRlYW1TdW1tYXJ5W10gPSB1c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoIWlzQWdlbnRTd2FybXNFbmFibGVkKCkpIHJldHVybiBbXVxuICAgIC8vIEluLXByb2Nlc3MgbW9kZSB1c2VzIFNoaWZ0K0Rvd24vVXAgbmF2aWdhdGlvbiBpbnN0ZWFkIG9mIGZvb3RlciBtZW51XG4gICAgaWYgKGlzSW5Qcm9jZXNzRW5hYmxlZCgpKSByZXR1cm4gW11cbiAgICBpZiAoIXRlYW1Db250ZXh0KSB7XG4gICAgICByZXR1cm4gW11cbiAgICB9XG4gICAgY29uc3QgdGVhbW1hdGVDb3VudCA9IGNvdW50KFxuICAgICAgT2JqZWN0LnZhbHVlcyh0ZWFtQ29udGV4dC50ZWFtbWF0ZXMpLFxuICAgICAgdCA9PiB0Lm5hbWUgIT09ICd0ZWFtLWxlYWQnLFxuICAgIClcbiAgICByZXR1cm4gW1xuICAgICAge1xuICAgICAgICBuYW1lOiB0ZWFtQ29udGV4dC50ZWFtTmFtZSxcbiAgICAgICAgbWVtYmVyQ291bnQ6IHRlYW1tYXRlQ291bnQsXG4gICAgICAgIHJ1bm5pbmdDb3VudDogMCxcbiAgICAgICAgaWRsZUNvdW50OiAwLFxuICAgICAgfSxcbiAgICBdXG4gIH0sIFt0ZWFtQ29udGV4dF0pXG5cbiAgLy8g4pSA4pSA4pSAIEZvb3RlciBwaWxsIG5hdmlnYXRpb24g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gIC8vIFdoaWNoIHBpbGxzIHJlbmRlciBiZWxvdyB0aGUgaW5wdXQgYm94LiBPcmRlciBoZXJlIElTIHRoZSBuYXYgb3JkZXJcbiAgLy8gKGRvd24vcmlnaHQgPSBmb3J3YXJkLCB1cC9sZWZ0ID0gYmFjaykuIFNlbGVjdGlvbiBsaXZlcyBpbiBBcHBTdGF0ZSBzb1xuICAvLyBwaWxscyByZW5kZXJlZCBvdXRzaWRlIFByb21wdElucHV0IChDb21wYW5pb25TcHJpdGUpIGNhbiByZWFkIGZvY3VzLlxuICBjb25zdCBydW5uaW5nVGFza0NvdW50ID0gdXNlTWVtbyhcbiAgICAoKSA9PiBjb3VudChPYmplY3QudmFsdWVzKHRhc2tzKSwgdCA9PiB0LnN0YXR1cyA9PT0gJ3J1bm5pbmcnKSxcbiAgICBbdGFza3NdLFxuICApXG4gIC8vIFBhbmVsIHNob3dzIHJldGFpbmVkLWNvbXBsZXRlZCBhZ2VudHMgdG9vIChnZXRWaXNpYmxlQWdlbnRUYXNrcyksIHNvIHRoZVxuICAvLyBwaWxsIG11c3Qgc3RheSBuYXZpZ2FibGUgd2hlbmV2ZXIgdGhlIHBhbmVsIGhhcyByb3dzIOKAlCBub3QganVzdCB3aGVuXG4gIC8vIHNvbWV0aGluZyBpcyBydW5uaW5nLlxuICBjb25zdCB0YXNrc0Zvb3RlclZpc2libGUgPVxuICAgIChydW5uaW5nVGFza0NvdW50ID4gMCB8fFxuICAgICAgKFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgY29vcmRpbmF0b3JUYXNrQ291bnQgPiAwKSkgJiZcbiAgICAhc2hvdWxkSGlkZVRhc2tzRm9vdGVyKHRhc2tzLCBzaG93U3Bpbm5lclRyZWUpXG4gIGNvbnN0IHRlYW1zRm9vdGVyVmlzaWJsZSA9IGNhY2hlZFRlYW1zLmxlbmd0aCA+IDBcblxuICBjb25zdCBmb290ZXJJdGVtcyA9IHVzZU1lbW8oXG4gICAgKCkgPT5cbiAgICAgIFtcbiAgICAgICAgdGFza3NGb290ZXJWaXNpYmxlICYmICd0YXNrcycsXG4gICAgICAgIHRtdXhGb290ZXJWaXNpYmxlICYmICd0bXV4JyxcbiAgICAgICAgYmFnZWxGb290ZXJWaXNpYmxlICYmICdiYWdlbCcsXG4gICAgICAgIHRlYW1zRm9vdGVyVmlzaWJsZSAmJiAndGVhbXMnLFxuICAgICAgICBicmlkZ2VGb290ZXJWaXNpYmxlICYmICdicmlkZ2UnLFxuICAgICAgICBjb21wYW5pb25Gb290ZXJWaXNpYmxlICYmICdjb21wYW5pb24nLFxuICAgICAgXS5maWx0ZXIoQm9vbGVhbikgYXMgRm9vdGVySXRlbVtdLFxuICAgIFtcbiAgICAgIHRhc2tzRm9vdGVyVmlzaWJsZSxcbiAgICAgIHRtdXhGb290ZXJWaXNpYmxlLFxuICAgICAgYmFnZWxGb290ZXJWaXNpYmxlLFxuICAgICAgdGVhbXNGb290ZXJWaXNpYmxlLFxuICAgICAgYnJpZGdlRm9vdGVyVmlzaWJsZSxcbiAgICAgIGNvbXBhbmlvbkZvb3RlclZpc2libGUsXG4gICAgXSxcbiAgKVxuXG4gIC8vIEVmZmVjdGl2ZSBzZWxlY3Rpb246IG51bGwgaWYgdGhlIHNlbGVjdGVkIHBpbGwgc3RvcHBlZCByZW5kZXJpbmcgKGJyaWRnZVxuICAvLyBkaXNjb25uZWN0ZWQsIHRhc2sgZmluaXNoZWQpLiBUaGUgZGVyaXZhdGlvbiBtYWtlcyB0aGUgVUkgY29ycmVjdFxuICAvLyBpbW1lZGlhdGVseTsgdGhlIHVzZUVmZmVjdCBiZWxvdyBjbGVhcnMgdGhlIHJhdyBzdGF0ZSBzbyBpdCBkb2Vzbid0XG4gIC8vIHJlc3VycmVjdCB3aGVuIHRoZSBzYW1lIHBpbGwgcmVhcHBlYXJzIChuZXcgdGFzayBzdGFydHMg4oaSIGZvY3VzIHN0b2xlbikuXG4gIGNvbnN0IHJhd0Zvb3RlclNlbGVjdGlvbiA9IHVzZUFwcFN0YXRlKHMgPT4gcy5mb290ZXJTZWxlY3Rpb24pXG4gIGNvbnN0IGZvb3Rlckl0ZW1TZWxlY3RlZCA9XG4gICAgcmF3Rm9vdGVyU2VsZWN0aW9uICYmIGZvb3Rlckl0ZW1zLmluY2x1ZGVzKHJhd0Zvb3RlclNlbGVjdGlvbilcbiAgICAgID8gcmF3Rm9vdGVyU2VsZWN0aW9uXG4gICAgICA6IG51bGxcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmIChyYXdGb290ZXJTZWxlY3Rpb24gJiYgIWZvb3Rlckl0ZW1TZWxlY3RlZCkge1xuICAgICAgc2V0QXBwU3RhdGUocHJldiA9PlxuICAgICAgICBwcmV2LmZvb3RlclNlbGVjdGlvbiA9PT0gbnVsbFxuICAgICAgICAgID8gcHJldlxuICAgICAgICAgIDogeyAuLi5wcmV2LCBmb290ZXJTZWxlY3Rpb246IG51bGwgfSxcbiAgICAgIClcbiAgICB9XG4gIH0sIFtyYXdGb290ZXJTZWxlY3Rpb24sIGZvb3Rlckl0ZW1TZWxlY3RlZCwgc2V0QXBwU3RhdGVdKVxuXG4gIGNvbnN0IHRhc2tzU2VsZWN0ZWQgPSBmb290ZXJJdGVtU2VsZWN0ZWQgPT09ICd0YXNrcydcbiAgY29uc3QgdG11eFNlbGVjdGVkID0gZm9vdGVySXRlbVNlbGVjdGVkID09PSAndG11eCdcbiAgY29uc3QgYmFnZWxTZWxlY3RlZCA9IGZvb3Rlckl0ZW1TZWxlY3RlZCA9PT0gJ2JhZ2VsJ1xuICBjb25zdCB0ZWFtc1NlbGVjdGVkID0gZm9vdGVySXRlbVNlbGVjdGVkID09PSAndGVhbXMnXG4gIGNvbnN0IGJyaWRnZVNlbGVjdGVkID0gZm9vdGVySXRlbVNlbGVjdGVkID09PSAnYnJpZGdlJ1xuXG4gIGZ1bmN0aW9uIHNlbGVjdEZvb3Rlckl0ZW0oaXRlbTogRm9vdGVySXRlbSB8IG51bGwpOiB2b2lkIHtcbiAgICBzZXRBcHBTdGF0ZShwcmV2ID0+XG4gICAgICBwcmV2LmZvb3RlclNlbGVjdGlvbiA9PT0gaXRlbSA/IHByZXYgOiB7IC4uLnByZXYsIGZvb3RlclNlbGVjdGlvbjogaXRlbSB9LFxuICAgIClcbiAgICBpZiAoaXRlbSA9PT0gJ3Rhc2tzJykge1xuICAgICAgc2V0VGVhbW1hdGVGb290ZXJJbmRleCgwKVxuICAgICAgc2V0Q29vcmRpbmF0b3JUYXNrSW5kZXgobWluQ29vcmRpbmF0b3JJbmRleClcbiAgICB9XG4gIH1cblxuICAvLyBkZWx0YTogKzEgPSBkb3duL3JpZ2h0LCAtMSA9IHVwL2xlZnQuIFJldHVybnMgdHJ1ZSBpZiBuYXYgaGFwcGVuZWRcbiAgLy8gKGluY2x1ZGluZyBkZXNlbGVjdGluZyBhdCB0aGUgc3RhcnQpLCBmYWxzZSBpZiBhdCBhIGJvdW5kYXJ5LlxuICBmdW5jdGlvbiBuYXZpZ2F0ZUZvb3RlcihkZWx0YTogMSB8IC0xLCBleGl0QXRTdGFydCA9IGZhbHNlKTogYm9vbGVhbiB7XG4gICAgY29uc3QgaWR4ID0gZm9vdGVySXRlbVNlbGVjdGVkXG4gICAgICA/IGZvb3Rlckl0ZW1zLmluZGV4T2YoZm9vdGVySXRlbVNlbGVjdGVkKVxuICAgICAgOiAtMVxuICAgIGNvbnN0IG5leHQgPSBmb290ZXJJdGVtc1tpZHggKyBkZWx0YV1cbiAgICBpZiAobmV4dCkge1xuICAgICAgc2VsZWN0Rm9vdGVySXRlbShuZXh0KVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgaWYgKGRlbHRhIDwgMCAmJiBleGl0QXRTdGFydCkge1xuICAgICAgc2VsZWN0Rm9vdGVySXRlbShudWxsKVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICAvLyBQcm9tcHQgc3VnZ2VzdGlvbiBob29rIC0gcmVhZHMgc3VnZ2VzdGlvbnMgZ2VuZXJhdGVkIGJ5IGZvcmtlZCBhZ2VudCBpbiBxdWVyeSBsb29wXG4gIGNvbnN0IHtcbiAgICBzdWdnZXN0aW9uOiBwcm9tcHRTdWdnZXN0aW9uLFxuICAgIG1hcmtBY2NlcHRlZCxcbiAgICBsb2dPdXRjb21lQXRTdWJtaXNzaW9uLFxuICAgIG1hcmtTaG93bixcbiAgfSA9IHVzZVByb21wdFN1Z2dlc3Rpb24oe1xuICAgIGlucHV0VmFsdWU6IGlucHV0LFxuICAgIGlzQXNzaXN0YW50UmVzcG9uZGluZzogaXNMb2FkaW5nLFxuICB9KVxuXG4gIGNvbnN0IGRpc3BsYXllZFZhbHVlID0gdXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgaXNTZWFyY2hpbmdIaXN0b3J5ICYmIGhpc3RvcnlNYXRjaFxuICAgICAgICA/IGdldFZhbHVlRnJvbUlucHV0KFxuICAgICAgICAgICAgdHlwZW9mIGhpc3RvcnlNYXRjaCA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgICAgPyBoaXN0b3J5TWF0Y2hcbiAgICAgICAgICAgICAgOiBoaXN0b3J5TWF0Y2guZGlzcGxheSxcbiAgICAgICAgICApXG4gICAgICAgIDogaW5wdXQsXG4gICAgW2lzU2VhcmNoaW5nSGlzdG9yeSwgaGlzdG9yeU1hdGNoLCBpbnB1dF0sXG4gIClcblxuICBjb25zdCB0aGlua1RyaWdnZXJzID0gdXNlTWVtbyhcbiAgICAoKSA9PiBmaW5kVGhpbmtpbmdUcmlnZ2VyUG9zaXRpb25zKGRpc3BsYXllZFZhbHVlKSxcbiAgICBbZGlzcGxheWVkVmFsdWVdLFxuICApXG5cbiAgY29uc3QgdWx0cmFwbGFuU2Vzc2lvblVybCA9IHVzZUFwcFN0YXRlKHMgPT4gcy51bHRyYXBsYW5TZXNzaW9uVXJsKVxuICBjb25zdCB1bHRyYXBsYW5MYXVuY2hpbmcgPSB1c2VBcHBTdGF0ZShzID0+IHMudWx0cmFwbGFuTGF1bmNoaW5nKVxuICBjb25zdCB1bHRyYXBsYW5UcmlnZ2VycyA9IHVzZU1lbW8oXG4gICAgKCkgPT5cbiAgICAgIGZlYXR1cmUoJ1VMVFJBUExBTicpICYmICF1bHRyYXBsYW5TZXNzaW9uVXJsICYmICF1bHRyYXBsYW5MYXVuY2hpbmdcbiAgICAgICAgPyBmaW5kVWx0cmFwbGFuVHJpZ2dlclBvc2l0aW9ucyhkaXNwbGF5ZWRWYWx1ZSlcbiAgICAgICAgOiBbXSxcbiAgICBbZGlzcGxheWVkVmFsdWUsIHVsdHJhcGxhblNlc3Npb25VcmwsIHVsdHJhcGxhbkxhdW5jaGluZ10sXG4gIClcblxuICBjb25zdCB1bHRyYXJldmlld1RyaWdnZXJzID0gdXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgaXNVbHRyYXJldmlld0VuYWJsZWQoKVxuICAgICAgICA/IGZpbmRVbHRyYXJldmlld1RyaWdnZXJQb3NpdGlvbnMoZGlzcGxheWVkVmFsdWUpXG4gICAgICAgIDogW10sXG4gICAgW2Rpc3BsYXllZFZhbHVlXSxcbiAgKVxuXG4gIGNvbnN0IGJ0d1RyaWdnZXJzID0gdXNlTWVtbyhcbiAgICAoKSA9PiBmaW5kQnR3VHJpZ2dlclBvc2l0aW9ucyhkaXNwbGF5ZWRWYWx1ZSksXG4gICAgW2Rpc3BsYXllZFZhbHVlXSxcbiAgKVxuXG4gIGNvbnN0IGJ1ZGR5VHJpZ2dlcnMgPSB1c2VNZW1vKFxuICAgICgpID0+IGZpbmRCdWRkeVRyaWdnZXJQb3NpdGlvbnMoZGlzcGxheWVkVmFsdWUpLFxuICAgIFtkaXNwbGF5ZWRWYWx1ZV0sXG4gIClcblxuICBjb25zdCBzbGFzaENvbW1hbmRUcmlnZ2VycyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHBvc2l0aW9ucyA9IGZpbmRTbGFzaENvbW1hbmRQb3NpdGlvbnMoZGlzcGxheWVkVmFsdWUpXG4gICAgLy8gT25seSBoaWdobGlnaHQgdmFsaWQgY29tbWFuZHNcbiAgICByZXR1cm4gcG9zaXRpb25zLmZpbHRlcihwb3MgPT4ge1xuICAgICAgY29uc3QgY29tbWFuZE5hbWUgPSBkaXNwbGF5ZWRWYWx1ZS5zbGljZShwb3Muc3RhcnQgKyAxLCBwb3MuZW5kKSAvLyArMSB0byBza2lwIFwiL1wiXG4gICAgICByZXR1cm4gaGFzQ29tbWFuZChjb21tYW5kTmFtZSwgY29tbWFuZHMpXG4gICAgfSlcbiAgfSwgW2Rpc3BsYXllZFZhbHVlLCBjb21tYW5kc10pXG5cbiAgY29uc3QgdG9rZW5CdWRnZXRUcmlnZ2VycyA9IHVzZU1lbW8oXG4gICAgKCkgPT5cbiAgICAgIGZlYXR1cmUoJ1RPS0VOX0JVREdFVCcpID8gZmluZFRva2VuQnVkZ2V0UG9zaXRpb25zKGRpc3BsYXllZFZhbHVlKSA6IFtdLFxuICAgIFtkaXNwbGF5ZWRWYWx1ZV0sXG4gIClcblxuICBjb25zdCBrbm93bkNoYW5uZWxzVmVyc2lvbiA9IHVzZVN5bmNFeHRlcm5hbFN0b3JlKFxuICAgIHN1YnNjcmliZUtub3duQ2hhbm5lbHMsXG4gICAgZ2V0S25vd25DaGFubmVsc1ZlcnNpb24sXG4gIClcbiAgY29uc3Qgc2xhY2tDaGFubmVsVHJpZ2dlcnMgPSB1c2VNZW1vKFxuICAgICgpID0+XG4gICAgICBoYXNTbGFja01jcFNlcnZlcihzdG9yZS5nZXRTdGF0ZSgpLm1jcC5jbGllbnRzKVxuICAgICAgICA/IGZpbmRTbGFja0NoYW5uZWxQb3NpdGlvbnMoZGlzcGxheWVkVmFsdWUpXG4gICAgICAgIDogW10sXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHJlYWN0LWhvb2tzL2V4aGF1c3RpdmUtZGVwcyAtLSBzdG9yZSBpcyBhIHN0YWJsZSByZWZcbiAgICBbZGlzcGxheWVkVmFsdWUsIGtub3duQ2hhbm5lbHNWZXJzaW9uXSxcbiAgKVxuXG4gIC8vIEZpbmQgQG5hbWUgbWVudGlvbnMgYW5kIGhpZ2hsaWdodCB3aXRoIHRlYW0gbWVtYmVyJ3MgY29sb3JcbiAgY29uc3QgbWVtYmVyTWVudGlvbkhpZ2hsaWdodHMgPSB1c2VNZW1vKCgpOiBBcnJheTx7XG4gICAgc3RhcnQ6IG51bWJlclxuICAgIGVuZDogbnVtYmVyXG4gICAgdGhlbWVDb2xvcjoga2V5b2YgVGhlbWVcbiAgfT4gPT4ge1xuICAgIGlmICghaXNBZ2VudFN3YXJtc0VuYWJsZWQoKSkgcmV0dXJuIFtdXG4gICAgaWYgKCF0ZWFtQ29udGV4dD8udGVhbW1hdGVzKSByZXR1cm4gW11cblxuICAgIGNvbnN0IGhpZ2hsaWdodHM6IEFycmF5PHtcbiAgICAgIHN0YXJ0OiBudW1iZXJcbiAgICAgIGVuZDogbnVtYmVyXG4gICAgICB0aGVtZUNvbG9yOiBrZXlvZiBUaGVtZVxuICAgIH0+ID0gW11cbiAgICBjb25zdCBtZW1iZXJzID0gdGVhbUNvbnRleHQudGVhbW1hdGVzXG4gICAgaWYgKCFtZW1iZXJzKSByZXR1cm4gaGlnaGxpZ2h0c1xuXG4gICAgLy8gRmluZCBhbGwgQG5hbWUgcGF0dGVybnMgaW4gdGhlIGlucHV0XG4gICAgY29uc3QgcmVnZXggPSAvKF58XFxzKUAoW1xcdy1dKykvZ1xuICAgIGNvbnN0IG1lbWJlclZhbHVlcyA9IE9iamVjdC52YWx1ZXMobWVtYmVycylcbiAgICBsZXQgbWF0Y2hcbiAgICB3aGlsZSAoKG1hdGNoID0gcmVnZXguZXhlYyhkaXNwbGF5ZWRWYWx1ZSkpICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBsZWFkaW5nU3BhY2UgPSBtYXRjaFsxXSA/PyAnJ1xuICAgICAgY29uc3QgbmFtZVN0YXJ0ID0gbWF0Y2guaW5kZXggKyBsZWFkaW5nU3BhY2UubGVuZ3RoXG4gICAgICBjb25zdCBmdWxsTWF0Y2ggPSBtYXRjaFswXS50cmltU3RhcnQoKVxuICAgICAgY29uc3QgbmFtZSA9IG1hdGNoWzJdXG5cbiAgICAgIC8vIENoZWNrIGlmIHRoaXMgbmFtZSBtYXRjaGVzIGEgdGVhbSBtZW1iZXJcbiAgICAgIGNvbnN0IG1lbWJlciA9IG1lbWJlclZhbHVlcy5maW5kKHQgPT4gdC5uYW1lID09PSBuYW1lKVxuICAgICAgaWYgKG1lbWJlcj8uY29sb3IpIHtcbiAgICAgICAgY29uc3QgdGhlbWVDb2xvciA9XG4gICAgICAgICAgQUdFTlRfQ09MT1JfVE9fVEhFTUVfQ09MT1JbbWVtYmVyLmNvbG9yIGFzIEFnZW50Q29sb3JOYW1lXVxuICAgICAgICBpZiAodGhlbWVDb2xvcikge1xuICAgICAgICAgIGhpZ2hsaWdodHMucHVzaCh7XG4gICAgICAgICAgICBzdGFydDogbmFtZVN0YXJ0LFxuICAgICAgICAgICAgZW5kOiBuYW1lU3RhcnQgKyBmdWxsTWF0Y2gubGVuZ3RoLFxuICAgICAgICAgICAgdGhlbWVDb2xvcixcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBoaWdobGlnaHRzXG4gIH0sIFtkaXNwbGF5ZWRWYWx1ZSwgdGVhbUNvbnRleHRdKVxuXG4gIGNvbnN0IGltYWdlUmVmUG9zaXRpb25zID0gdXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgcGFyc2VSZWZlcmVuY2VzKGRpc3BsYXllZFZhbHVlKVxuICAgICAgICAuZmlsdGVyKHIgPT4gci5tYXRjaC5zdGFydHNXaXRoKCdbSW1hZ2UnKSlcbiAgICAgICAgLm1hcChyID0+ICh7IHN0YXJ0OiByLmluZGV4LCBlbmQ6IHIuaW5kZXggKyByLm1hdGNoLmxlbmd0aCB9KSksXG4gICAgW2Rpc3BsYXllZFZhbHVlXSxcbiAgKVxuXG4gIC8vIGNoaXAuc3RhcnQgaXMgdGhlIFwic2VsZWN0ZWRcIiBzdGF0ZTogdGhlIGludmVydGVkIGNoaXAgSVMgdGhlIGN1cnNvci5cbiAgLy8gY2hpcC5lbmQgc3RheXMgYSBub3JtYWwgcG9zaXRpb24gc28geW91IGNhbiBwYXJrIHRoZSBjdXJzb3IgcmlnaHQgYWZ0ZXJcbiAgLy8gYF1gIGxpa2UgYW55IG90aGVyIGNoYXJhY3Rlci5cbiAgY29uc3QgY3Vyc29yQXRJbWFnZUNoaXAgPSBpbWFnZVJlZlBvc2l0aW9ucy5zb21lKFxuICAgIHIgPT4gci5zdGFydCA9PT0gY3Vyc29yT2Zmc2V0LFxuICApXG5cbiAgLy8gdXAvZG93biBtb3ZlbWVudCBvciBhIGZ1bGxzY3JlZW4gY2xpY2sgY2FuIGxhbmQgdGhlIGN1cnNvciBzdHJpY3RseVxuICAvLyBpbnNpZGUgYSBjaGlwOyBzbmFwIHRvIHRoZSBuZWFyZXIgYm91bmRhcnkgc28gaXQncyBuZXZlciBlZGl0YWJsZVxuICAvLyBjaGFyLWJ5LWNoYXIuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaW5zaWRlID0gaW1hZ2VSZWZQb3NpdGlvbnMuZmluZChcbiAgICAgIHIgPT4gY3Vyc29yT2Zmc2V0ID4gci5zdGFydCAmJiBjdXJzb3JPZmZzZXQgPCByLmVuZCxcbiAgICApXG4gICAgaWYgKGluc2lkZSkge1xuICAgICAgY29uc3QgbWlkID0gKGluc2lkZS5zdGFydCArIGluc2lkZS5lbmQpIC8gMlxuICAgICAgc2V0Q3Vyc29yT2Zmc2V0KGN1cnNvck9mZnNldCA8IG1pZCA/IGluc2lkZS5zdGFydCA6IGluc2lkZS5lbmQpXG4gICAgfVxuICB9LCBbY3Vyc29yT2Zmc2V0LCBpbWFnZVJlZlBvc2l0aW9ucywgc2V0Q3Vyc29yT2Zmc2V0XSlcblxuICBjb25zdCBjb21iaW5lZEhpZ2hsaWdodHMgPSB1c2VNZW1vKCgpOiBUZXh0SGlnaGxpZ2h0W10gPT4ge1xuICAgIGNvbnN0IGhpZ2hsaWdodHM6IFRleHRIaWdobGlnaHRbXSA9IFtdXG5cbiAgICAvLyBJbnZlcnQgdGhlIFtJbWFnZSAjTl0gY2hpcCB3aGVuIHRoZSBjdXJzb3IgaXMgYXQgY2hpcC5zdGFydCAodGhlXG4gICAgLy8gXCJzZWxlY3RlZFwiIHN0YXRlKSBzbyBiYWNrc3BhY2UtdG8tZGVsZXRlIGlzIHZpc3VhbGx5IG9idmlvdXMuXG4gICAgZm9yIChjb25zdCByZWYgb2YgaW1hZ2VSZWZQb3NpdGlvbnMpIHtcbiAgICAgIGlmIChjdXJzb3JPZmZzZXQgPT09IHJlZi5zdGFydCkge1xuICAgICAgICBoaWdobGlnaHRzLnB1c2goe1xuICAgICAgICAgIHN0YXJ0OiByZWYuc3RhcnQsXG4gICAgICAgICAgZW5kOiByZWYuZW5kLFxuICAgICAgICAgIGNvbG9yOiB1bmRlZmluZWQsXG4gICAgICAgICAgaW52ZXJzZTogdHJ1ZSxcbiAgICAgICAgICBwcmlvcml0eTogOCxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaXNTZWFyY2hpbmdIaXN0b3J5ICYmIGhpc3RvcnlNYXRjaCAmJiAhaGlzdG9yeUZhaWxlZE1hdGNoKSB7XG4gICAgICBoaWdobGlnaHRzLnB1c2goe1xuICAgICAgICBzdGFydDogY3Vyc29yT2Zmc2V0LFxuICAgICAgICBlbmQ6IGN1cnNvck9mZnNldCArIGhpc3RvcnlRdWVyeS5sZW5ndGgsXG4gICAgICAgIGNvbG9yOiAnd2FybmluZycsXG4gICAgICAgIHByaW9yaXR5OiAyMCxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gQWRkIFwiYnR3XCIgaGlnaGxpZ2h0aW5nIChzb2xpZCB5ZWxsb3cpXG4gICAgZm9yIChjb25zdCB0cmlnZ2VyIG9mIGJ0d1RyaWdnZXJzKSB7XG4gICAgICBoaWdobGlnaHRzLnB1c2goe1xuICAgICAgICBzdGFydDogdHJpZ2dlci5zdGFydCxcbiAgICAgICAgZW5kOiB0cmlnZ2VyLmVuZCxcbiAgICAgICAgY29sb3I6ICd3YXJuaW5nJyxcbiAgICAgICAgcHJpb3JpdHk6IDE1LFxuICAgICAgfSlcbiAgICB9XG5cbiAgICAvLyBBZGQgL2NvbW1hbmQgaGlnaGxpZ2h0aW5nIChibHVlKVxuICAgIGZvciAoY29uc3QgdHJpZ2dlciBvZiBzbGFzaENvbW1hbmRUcmlnZ2Vycykge1xuICAgICAgaGlnaGxpZ2h0cy5wdXNoKHtcbiAgICAgICAgc3RhcnQ6IHRyaWdnZXIuc3RhcnQsXG4gICAgICAgIGVuZDogdHJpZ2dlci5lbmQsXG4gICAgICAgIGNvbG9yOiAnc3VnZ2VzdGlvbicsXG4gICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgfSlcbiAgICB9XG5cbiAgICAvLyBBZGQgdG9rZW4gYnVkZ2V0IGhpZ2hsaWdodGluZyAoYmx1ZSlcbiAgICBmb3IgKGNvbnN0IHRyaWdnZXIgb2YgdG9rZW5CdWRnZXRUcmlnZ2Vycykge1xuICAgICAgaGlnaGxpZ2h0cy5wdXNoKHtcbiAgICAgICAgc3RhcnQ6IHRyaWdnZXIuc3RhcnQsXG4gICAgICAgIGVuZDogdHJpZ2dlci5lbmQsXG4gICAgICAgIGNvbG9yOiAnc3VnZ2VzdGlvbicsXG4gICAgICAgIHByaW9yaXR5OiA1LFxuICAgICAgfSlcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHRyaWdnZXIgb2Ygc2xhY2tDaGFubmVsVHJpZ2dlcnMpIHtcbiAgICAgIGhpZ2hsaWdodHMucHVzaCh7XG4gICAgICAgIHN0YXJ0OiB0cmlnZ2VyLnN0YXJ0LFxuICAgICAgICBlbmQ6IHRyaWdnZXIuZW5kLFxuICAgICAgICBjb2xvcjogJ3N1Z2dlc3Rpb24nLFxuICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gQWRkIEBuYW1lIGhpZ2hsaWdodGluZyB3aXRoIHRlYW0gbWVtYmVyJ3MgY29sb3JcbiAgICBmb3IgKGNvbnN0IG1lbnRpb24gb2YgbWVtYmVyTWVudGlvbkhpZ2hsaWdodHMpIHtcbiAgICAgIGhpZ2hsaWdodHMucHVzaCh7XG4gICAgICAgIHN0YXJ0OiBtZW50aW9uLnN0YXJ0LFxuICAgICAgICBlbmQ6IG1lbnRpb24uZW5kLFxuICAgICAgICBjb2xvcjogbWVudGlvbi50aGVtZUNvbG9yLFxuICAgICAgICBwcmlvcml0eTogNSxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gRGltIGludGVyaW0gdm9pY2UgZGljdGF0aW9uIHRleHRcbiAgICBpZiAodm9pY2VJbnRlcmltUmFuZ2UpIHtcbiAgICAgIGhpZ2hsaWdodHMucHVzaCh7XG4gICAgICAgIHN0YXJ0OiB2b2ljZUludGVyaW1SYW5nZS5zdGFydCxcbiAgICAgICAgZW5kOiB2b2ljZUludGVyaW1SYW5nZS5lbmQsXG4gICAgICAgIGNvbG9yOiB1bmRlZmluZWQsXG4gICAgICAgIGRpbUNvbG9yOiB0cnVlLFxuICAgICAgICBwcmlvcml0eTogMSxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gUmFpbmJvdyBoaWdobGlnaHRpbmcgZm9yIHVsdHJhdGhpbmsga2V5d29yZCAocGVyLWNoYXJhY3RlciBjeWNsaW5nIGNvbG9ycylcbiAgICBpZiAoaXNVbHRyYXRoaW5rRW5hYmxlZCgpKSB7XG4gICAgICBmb3IgKGNvbnN0IHRyaWdnZXIgb2YgdGhpbmtUcmlnZ2Vycykge1xuICAgICAgICBmb3IgKGxldCBpID0gdHJpZ2dlci5zdGFydDsgaSA8IHRyaWdnZXIuZW5kOyBpKyspIHtcbiAgICAgICAgICBoaWdobGlnaHRzLnB1c2goe1xuICAgICAgICAgICAgc3RhcnQ6IGksXG4gICAgICAgICAgICBlbmQ6IGkgKyAxLFxuICAgICAgICAgICAgY29sb3I6IGdldFJhaW5ib3dDb2xvcihpIC0gdHJpZ2dlci5zdGFydCksXG4gICAgICAgICAgICBzaGltbWVyQ29sb3I6IGdldFJhaW5ib3dDb2xvcihpIC0gdHJpZ2dlci5zdGFydCwgdHJ1ZSksXG4gICAgICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNhbWUgcmFpbmJvdyB0cmVhdG1lbnQgZm9yIHRoZSB1bHRyYXBsYW4ga2V5d29yZFxuICAgIGlmIChmZWF0dXJlKCdVTFRSQVBMQU4nKSkge1xuICAgICAgZm9yIChjb25zdCB0cmlnZ2VyIG9mIHVsdHJhcGxhblRyaWdnZXJzKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSB0cmlnZ2VyLnN0YXJ0OyBpIDwgdHJpZ2dlci5lbmQ7IGkrKykge1xuICAgICAgICAgIGhpZ2hsaWdodHMucHVzaCh7XG4gICAgICAgICAgICBzdGFydDogaSxcbiAgICAgICAgICAgIGVuZDogaSArIDEsXG4gICAgICAgICAgICBjb2xvcjogZ2V0UmFpbmJvd0NvbG9yKGkgLSB0cmlnZ2VyLnN0YXJ0KSxcbiAgICAgICAgICAgIHNoaW1tZXJDb2xvcjogZ2V0UmFpbmJvd0NvbG9yKGkgLSB0cmlnZ2VyLnN0YXJ0LCB0cnVlKSxcbiAgICAgICAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU2FtZSByYWluYm93IHRyZWF0bWVudCBmb3IgdGhlIHVsdHJhcmV2aWV3IGtleXdvcmRcbiAgICBmb3IgKGNvbnN0IHRyaWdnZXIgb2YgdWx0cmFyZXZpZXdUcmlnZ2Vycykge1xuICAgICAgZm9yIChsZXQgaSA9IHRyaWdnZXIuc3RhcnQ7IGkgPCB0cmlnZ2VyLmVuZDsgaSsrKSB7XG4gICAgICAgIGhpZ2hsaWdodHMucHVzaCh7XG4gICAgICAgICAgc3RhcnQ6IGksXG4gICAgICAgICAgZW5kOiBpICsgMSxcbiAgICAgICAgICBjb2xvcjogZ2V0UmFpbmJvd0NvbG9yKGkgLSB0cmlnZ2VyLnN0YXJ0KSxcbiAgICAgICAgICBzaGltbWVyQ29sb3I6IGdldFJhaW5ib3dDb2xvcihpIC0gdHJpZ2dlci5zdGFydCwgdHJ1ZSksXG4gICAgICAgICAgcHJpb3JpdHk6IDEwLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJhaW5ib3cgZm9yIC9idWRkeVxuICAgIGZvciAoY29uc3QgdHJpZ2dlciBvZiBidWRkeVRyaWdnZXJzKSB7XG4gICAgICBmb3IgKGxldCBpID0gdHJpZ2dlci5zdGFydDsgaSA8IHRyaWdnZXIuZW5kOyBpKyspIHtcbiAgICAgICAgaGlnaGxpZ2h0cy5wdXNoKHtcbiAgICAgICAgICBzdGFydDogaSxcbiAgICAgICAgICBlbmQ6IGkgKyAxLFxuICAgICAgICAgIGNvbG9yOiBnZXRSYWluYm93Q29sb3IoaSAtIHRyaWdnZXIuc3RhcnQpLFxuICAgICAgICAgIHNoaW1tZXJDb2xvcjogZ2V0UmFpbmJvd0NvbG9yKGkgLSB0cmlnZ2VyLnN0YXJ0LCB0cnVlKSxcbiAgICAgICAgICBwcmlvcml0eTogMTAsXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGhpZ2hsaWdodHNcbiAgfSwgW1xuICAgIGlzU2VhcmNoaW5nSGlzdG9yeSxcbiAgICBoaXN0b3J5UXVlcnksXG4gICAgaGlzdG9yeU1hdGNoLFxuICAgIGhpc3RvcnlGYWlsZWRNYXRjaCxcbiAgICBjdXJzb3JPZmZzZXQsXG4gICAgYnR3VHJpZ2dlcnMsXG4gICAgaW1hZ2VSZWZQb3NpdGlvbnMsXG4gICAgbWVtYmVyTWVudGlvbkhpZ2hsaWdodHMsXG4gICAgc2xhc2hDb21tYW5kVHJpZ2dlcnMsXG4gICAgdG9rZW5CdWRnZXRUcmlnZ2VycyxcbiAgICBzbGFja0NoYW5uZWxUcmlnZ2VycyxcbiAgICBkaXNwbGF5ZWRWYWx1ZSxcbiAgICB2b2ljZUludGVyaW1SYW5nZSxcbiAgICB0aGlua1RyaWdnZXJzLFxuICAgIHVsdHJhcGxhblRyaWdnZXJzLFxuICAgIHVsdHJhcmV2aWV3VHJpZ2dlcnMsXG4gICAgYnVkZHlUcmlnZ2VycyxcbiAgXSlcblxuICBjb25zdCB7IGFkZE5vdGlmaWNhdGlvbiwgcmVtb3ZlTm90aWZpY2F0aW9uIH0gPSB1c2VOb3RpZmljYXRpb25zKClcblxuICAvLyBTaG93IHVsdHJhdGhpbmsgbm90aWZpY2F0aW9uXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHRoaW5rVHJpZ2dlcnMubGVuZ3RoICYmIGlzVWx0cmF0aGlua0VuYWJsZWQoKSkge1xuICAgICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgICAga2V5OiAndWx0cmF0aGluay1hY3RpdmUnLFxuICAgICAgICB0ZXh0OiAnRWZmb3J0IHNldCB0byBoaWdoIGZvciB0aGlzIHR1cm4nLFxuICAgICAgICBwcmlvcml0eTogJ2ltbWVkaWF0ZScsXG4gICAgICAgIHRpbWVvdXRNczogNTAwMCxcbiAgICAgIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHJlbW92ZU5vdGlmaWNhdGlvbigndWx0cmF0aGluay1hY3RpdmUnKVxuICAgIH1cbiAgfSwgW2FkZE5vdGlmaWNhdGlvbiwgcmVtb3ZlTm90aWZpY2F0aW9uLCB0aGlua1RyaWdnZXJzLmxlbmd0aF0pXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoZmVhdHVyZSgnVUxUUkFQTEFOJykgJiYgdWx0cmFwbGFuVHJpZ2dlcnMubGVuZ3RoKSB7XG4gICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICBrZXk6ICd1bHRyYXBsYW4tYWN0aXZlJyxcbiAgICAgICAgdGV4dDogJ1RoaXMgcHJvbXB0IHdpbGwgbGF1bmNoIGFuIHVsdHJhcGxhbiBzZXNzaW9uIGluIENsYXVkZSBDb2RlIG9uIHRoZSB3ZWInLFxuICAgICAgICBwcmlvcml0eTogJ2ltbWVkaWF0ZScsXG4gICAgICAgIHRpbWVvdXRNczogNTAwMCxcbiAgICAgIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHJlbW92ZU5vdGlmaWNhdGlvbigndWx0cmFwbGFuLWFjdGl2ZScpXG4gICAgfVxuICB9LCBbYWRkTm90aWZpY2F0aW9uLCByZW1vdmVOb3RpZmljYXRpb24sIHVsdHJhcGxhblRyaWdnZXJzLmxlbmd0aF0pXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaXNVbHRyYXJldmlld0VuYWJsZWQoKSAmJiB1bHRyYXJldmlld1RyaWdnZXJzLmxlbmd0aCkge1xuICAgICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgICAga2V5OiAndWx0cmFyZXZpZXctYWN0aXZlJyxcbiAgICAgICAgdGV4dDogJ1J1biAvdWx0cmFyZXZpZXcgYWZ0ZXIgQ2xhdWRlIGZpbmlzaGVzIHRvIHJldmlldyB0aGVzZSBjaGFuZ2VzIGluIHRoZSBjbG91ZCcsXG4gICAgICAgIHByaW9yaXR5OiAnaW1tZWRpYXRlJyxcbiAgICAgICAgdGltZW91dE1zOiA1MDAwLFxuICAgICAgfSlcbiAgICB9XG4gIH0sIFthZGROb3RpZmljYXRpb24sIHVsdHJhcmV2aWV3VHJpZ2dlcnMubGVuZ3RoXSlcblxuICAvLyBUcmFjayBpbnB1dCBsZW5ndGggZm9yIHN0YXNoIGhpbnRcbiAgY29uc3QgcHJldklucHV0TGVuZ3RoUmVmID0gdXNlUmVmKGlucHV0Lmxlbmd0aClcbiAgY29uc3QgcGVha0lucHV0TGVuZ3RoUmVmID0gdXNlUmVmKGlucHV0Lmxlbmd0aClcblxuICAvLyBEaXNtaXNzIHN0YXNoIGhpbnQgd2hlbiB1c2VyIG1ha2VzIGFueSBpbnB1dCBjaGFuZ2VcbiAgY29uc3QgZGlzbWlzc1N0YXNoSGludCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICByZW1vdmVOb3RpZmljYXRpb24oJ3N0YXNoLWhpbnQnKVxuICB9LCBbcmVtb3ZlTm90aWZpY2F0aW9uXSlcblxuICAvLyBTaG93IHN0YXNoIGhpbnQgd2hlbiB1c2VyIGdyYWR1YWxseSBjbGVhcnMgc3Vic3RhbnRpYWwgaW5wdXRcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBjb25zdCBwcmV2TGVuZ3RoID0gcHJldklucHV0TGVuZ3RoUmVmLmN1cnJlbnRcbiAgICBjb25zdCBwZWFrTGVuZ3RoID0gcGVha0lucHV0TGVuZ3RoUmVmLmN1cnJlbnRcbiAgICBjb25zdCBjdXJyZW50TGVuZ3RoID0gaW5wdXQubGVuZ3RoXG4gICAgcHJldklucHV0TGVuZ3RoUmVmLmN1cnJlbnQgPSBjdXJyZW50TGVuZ3RoXG5cbiAgICAvLyBVcGRhdGUgcGVhayB3aGVuIGlucHV0IGdyb3dzXG4gICAgaWYgKGN1cnJlbnRMZW5ndGggPiBwZWFrTGVuZ3RoKSB7XG4gICAgICBwZWFrSW5wdXRMZW5ndGhSZWYuY3VycmVudCA9IGN1cnJlbnRMZW5ndGhcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIFJlc2V0IHN0YXRlIHdoZW4gaW5wdXQgaXMgZW1wdHlcbiAgICBpZiAoY3VycmVudExlbmd0aCA9PT0gMCkge1xuICAgICAgcGVha0lucHV0TGVuZ3RoUmVmLmN1cnJlbnQgPSAwXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBEZXRlY3QgZ3JhZHVhbCBjbGVhcjogcGVhayB3YXMgaGlnaCwgY3VycmVudCBpcyBsb3csIGJ1dCB0aGlzIHdhc24ndCBhIHNpbmdsZSBiaWcganVtcFxuICAgIC8vIChyYXBpZCBjbGVhcnMgbGlrZSBlc2MtZXNjIGdvIGZyb20gMjArIHRvIDAgaW4gb25lIHN0ZXApXG4gICAgY29uc3QgY2xlYXJlZFN1YnN0YW50aWFsSW5wdXQgPSBwZWFrTGVuZ3RoID49IDIwICYmIGN1cnJlbnRMZW5ndGggPD0gNVxuICAgIGNvbnN0IHdhc1JhcGlkQ2xlYXIgPSBwcmV2TGVuZ3RoID49IDIwICYmIGN1cnJlbnRMZW5ndGggPD0gNVxuXG4gICAgaWYgKGNsZWFyZWRTdWJzdGFudGlhbElucHV0ICYmICF3YXNSYXBpZENsZWFyKSB7XG4gICAgICBjb25zdCBjb25maWcgPSBnZXRHbG9iYWxDb25maWcoKVxuICAgICAgaWYgKCFjb25maWcuaGFzVXNlZFN0YXNoKSB7XG4gICAgICAgIGFkZE5vdGlmaWNhdGlvbih7XG4gICAgICAgICAga2V5OiAnc3Rhc2gtaGludCcsXG4gICAgICAgICAganN4OiAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgVGlwOnsnICd9XG4gICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICBhY3Rpb249XCJjaGF0OnN0YXNoXCJcbiAgICAgICAgICAgICAgICBjb250ZXh0PVwiQ2hhdFwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJjdHJsK3NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwic3Rhc2hcIlxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICksXG4gICAgICAgICAgcHJpb3JpdHk6ICdpbW1lZGlhdGUnLFxuICAgICAgICAgIHRpbWVvdXRNczogRk9PVEVSX1RFTVBPUkFSWV9TVEFUVVNfVElNRU9VVCxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIHBlYWtJbnB1dExlbmd0aFJlZi5jdXJyZW50ID0gY3VycmVudExlbmd0aFxuICAgIH1cbiAgfSwgW2lucHV0Lmxlbmd0aCwgYWRkTm90aWZpY2F0aW9uXSlcblxuICAvLyBJbml0aWFsaXplIGlucHV0IGJ1ZmZlciBmb3IgdW5kbyBmdW5jdGlvbmFsaXR5XG4gIGNvbnN0IHsgcHVzaFRvQnVmZmVyLCB1bmRvLCBjYW5VbmRvLCBjbGVhckJ1ZmZlciB9ID0gdXNlSW5wdXRCdWZmZXIoe1xuICAgIG1heEJ1ZmZlclNpemU6IDUwLFxuICAgIGRlYm91bmNlTXM6IDEwMDAsXG4gIH0pXG5cbiAgdXNlTWF5YmVUcnVuY2F0ZUlucHV0KHtcbiAgICBpbnB1dCxcbiAgICBwYXN0ZWRDb250ZW50cyxcbiAgICBvbklucHV0Q2hhbmdlOiB0cmFja0FuZFNldElucHV0LFxuICAgIHNldEN1cnNvck9mZnNldCxcbiAgICBzZXRQYXN0ZWRDb250ZW50cyxcbiAgfSlcblxuICBjb25zdCBkZWZhdWx0UGxhY2Vob2xkZXIgPSB1c2VQcm9tcHRJbnB1dFBsYWNlaG9sZGVyKHtcbiAgICBpbnB1dCxcbiAgICBzdWJtaXRDb3VudCxcbiAgICB2aWV3aW5nQWdlbnROYW1lLFxuICB9KVxuXG4gIGNvbnN0IG9uQ2hhbmdlID0gdXNlQ2FsbGJhY2soXG4gICAgKHZhbHVlOiBzdHJpbmcpID0+IHtcbiAgICAgIGlmICh2YWx1ZSA9PT0gJz8nKSB7XG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9oZWxwX3RvZ2dsZWQnLCB7fSlcbiAgICAgICAgc2V0SGVscE9wZW4odiA9PiAhdilcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBzZXRIZWxwT3BlbihmYWxzZSlcblxuICAgICAgLy8gRGlzbWlzcyBzdGFzaCBoaW50IHdoZW4gdXNlciBtYWtlcyBhbnkgaW5wdXQgY2hhbmdlXG4gICAgICBkaXNtaXNzU3Rhc2hIaW50KClcblxuICAgICAgLy8gQ2FuY2VsIGFueSBwZW5kaW5nIHByb21wdCBzdWdnZXN0aW9uIGFuZCBzcGVjdWxhdGlvbiB3aGVuIHVzZXIgdHlwZXNcbiAgICAgIGFib3J0UHJvbXB0U3VnZ2VzdGlvbigpXG4gICAgICBhYm9ydFNwZWN1bGF0aW9uKHNldEFwcFN0YXRlKVxuXG4gICAgICAvLyBDaGVjayBpZiB0aGlzIGlzIGEgc2luZ2xlIGNoYXJhY3RlciBpbnNlcnRpb24gYXQgdGhlIHN0YXJ0XG4gICAgICBjb25zdCBpc1NpbmdsZUNoYXJJbnNlcnRpb24gPSB2YWx1ZS5sZW5ndGggPT09IGlucHV0Lmxlbmd0aCArIDFcbiAgICAgIGNvbnN0IGluc2VydGVkQXRTdGFydCA9IGN1cnNvck9mZnNldCA9PT0gMFxuICAgICAgY29uc3QgbW9kZSA9IGdldE1vZGVGcm9tSW5wdXQodmFsdWUpXG5cbiAgICAgIGlmIChpbnNlcnRlZEF0U3RhcnQgJiYgbW9kZSAhPT0gJ3Byb21wdCcpIHtcbiAgICAgICAgaWYgKGlzU2luZ2xlQ2hhckluc2VydGlvbikge1xuICAgICAgICAgIG9uTW9kZUNoYW5nZShtb2RlKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIC8vIE11bHRpLWNoYXIgaW5zZXJ0aW9uIGludG8gZW1wdHkgaW5wdXQgKGUuZy4gdGFiLWFjY2VwdGluZyBcIiEgZ2Nsb3VkIGF1dGggbG9naW5cIilcbiAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIG9uTW9kZUNoYW5nZShtb2RlKVxuICAgICAgICAgIGNvbnN0IHZhbHVlV2l0aG91dE1vZGUgPSBnZXRWYWx1ZUZyb21JbnB1dCh2YWx1ZSkucmVwbGFjZUFsbChcbiAgICAgICAgICAgICdcXHQnLFxuICAgICAgICAgICAgJyAgICAnLFxuICAgICAgICAgIClcbiAgICAgICAgICBwdXNoVG9CdWZmZXIoaW5wdXQsIGN1cnNvck9mZnNldCwgcGFzdGVkQ29udGVudHMpXG4gICAgICAgICAgdHJhY2tBbmRTZXRJbnB1dCh2YWx1ZVdpdGhvdXRNb2RlKVxuICAgICAgICAgIHNldEN1cnNvck9mZnNldCh2YWx1ZVdpdGhvdXRNb2RlLmxlbmd0aClcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBwcm9jZXNzZWRWYWx1ZSA9IHZhbHVlLnJlcGxhY2VBbGwoJ1xcdCcsICcgICAgJylcblxuICAgICAgLy8gUHVzaCBjdXJyZW50IHN0YXRlIHRvIGJ1ZmZlciBiZWZvcmUgbWFraW5nIGNoYW5nZXNcbiAgICAgIGlmIChpbnB1dCAhPT0gcHJvY2Vzc2VkVmFsdWUpIHtcbiAgICAgICAgcHVzaFRvQnVmZmVyKGlucHV0LCBjdXJzb3JPZmZzZXQsIHBhc3RlZENvbnRlbnRzKVxuICAgICAgfVxuXG4gICAgICAvLyBEZXNlbGVjdCBmb290ZXIgaXRlbXMgd2hlbiB1c2VyIHR5cGVzXG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+XG4gICAgICAgIHByZXYuZm9vdGVyU2VsZWN0aW9uID09PSBudWxsXG4gICAgICAgICAgPyBwcmV2XG4gICAgICAgICAgOiB7IC4uLnByZXYsIGZvb3RlclNlbGVjdGlvbjogbnVsbCB9LFxuICAgICAgKVxuXG4gICAgICB0cmFja0FuZFNldElucHV0KHByb2Nlc3NlZFZhbHVlKVxuICAgIH0sXG4gICAgW1xuICAgICAgdHJhY2tBbmRTZXRJbnB1dCxcbiAgICAgIG9uTW9kZUNoYW5nZSxcbiAgICAgIGlucHV0LFxuICAgICAgY3Vyc29yT2Zmc2V0LFxuICAgICAgcHVzaFRvQnVmZmVyLFxuICAgICAgcGFzdGVkQ29udGVudHMsXG4gICAgICBkaXNtaXNzU3Rhc2hIaW50LFxuICAgICAgc2V0QXBwU3RhdGUsXG4gICAgXSxcbiAgKVxuXG4gIGNvbnN0IHtcbiAgICByZXNldEhpc3RvcnksXG4gICAgb25IaXN0b3J5VXAsXG4gICAgb25IaXN0b3J5RG93bixcbiAgICBkaXNtaXNzU2VhcmNoSGludCxcbiAgICBoaXN0b3J5SW5kZXgsXG4gIH0gPSB1c2VBcnJvd0tleUhpc3RvcnkoXG4gICAgKFxuICAgICAgdmFsdWU6IHN0cmluZyxcbiAgICAgIGhpc3RvcnlNb2RlOiBIaXN0b3J5TW9kZSxcbiAgICAgIHBhc3RlZENvbnRlbnRzOiBSZWNvcmQ8bnVtYmVyLCBQYXN0ZWRDb250ZW50PixcbiAgICApID0+IHtcbiAgICAgIG9uQ2hhbmdlKHZhbHVlKVxuICAgICAgb25Nb2RlQ2hhbmdlKGhpc3RvcnlNb2RlKVxuICAgICAgc2V0UGFzdGVkQ29udGVudHMocGFzdGVkQ29udGVudHMpXG4gICAgfSxcbiAgICBpbnB1dCxcbiAgICBwYXN0ZWRDb250ZW50cyxcbiAgICBzZXRDdXJzb3JPZmZzZXQsXG4gICAgbW9kZSxcbiAgKVxuXG4gIC8vIERpc21pc3Mgc2VhcmNoIGhpbnQgd2hlbiB1c2VyIHN0YXJ0cyBzZWFyY2hpbmdcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaXNTZWFyY2hpbmdIaXN0b3J5KSB7XG4gICAgICBkaXNtaXNzU2VhcmNoSGludCgpXG4gICAgfVxuICB9LCBbaXNTZWFyY2hpbmdIaXN0b3J5LCBkaXNtaXNzU2VhcmNoSGludF0pXG5cbiAgLy8gT25seSB1c2UgaGlzdG9yeSBuYXZpZ2F0aW9uIHdoZW4gdGhlcmUgYXJlIDAgb3IgMSBzbGFzaCBjb21tYW5kIHN1Z2dlc3Rpb25zLlxuICAvLyBGb290ZXIgbmF2IGlzIE5PVCBoZXJlIOKAlCB3aGVuIGEgcGlsbCBpcyBzZWxlY3RlZCwgVGV4dElucHV0IGZvY3VzPWZhbHNlIHNvXG4gIC8vIHRoZXNlIG5ldmVyIGZpcmUuIFRoZSBGb290ZXIga2V5YmluZGluZyBjb250ZXh0IGhhbmRsZXMg4oaRL+KGkyBpbnN0ZWFkLlxuICBmdW5jdGlvbiBoYW5kbGVIaXN0b3J5VXAoKSB7XG4gICAgaWYgKHN1Z2dlc3Rpb25zLmxlbmd0aCA+IDEpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIE9ubHkgbmF2aWdhdGUgaGlzdG9yeSB3aGVuIGN1cnNvciBpcyBvbiB0aGUgZmlyc3QgbGluZS5cbiAgICAvLyBJbiBtdWx0aWxpbmUgaW5wdXRzLCB1cCBhcnJvdyBzaG91bGQgbW92ZSB0aGUgY3Vyc29yIChoYW5kbGVkIGJ5IFRleHRJbnB1dClcbiAgICAvLyBhbmQgb25seSB0cmlnZ2VyIGhpc3Rvcnkgd2hlbiBhdCB0aGUgdG9wIG9mIHRoZSBpbnB1dC5cbiAgICBpZiAoIWlzQ3Vyc29yT25GaXJzdExpbmUpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIElmIHRoZXJlJ3MgYW4gZWRpdGFibGUgcXVldWVkIGNvbW1hbmQsIG1vdmUgaXQgdG8gdGhlIGlucHV0IGZvciBlZGl0aW5nIHdoZW4gVVAgaXMgcHJlc3NlZFxuICAgIGNvbnN0IGhhc0VkaXRhYmxlQ29tbWFuZCA9IHF1ZXVlZENvbW1hbmRzLnNvbWUoaXNRdWV1ZWRDb21tYW5kRWRpdGFibGUpXG4gICAgaWYgKGhhc0VkaXRhYmxlQ29tbWFuZCkge1xuICAgICAgdm9pZCBwb3BBbGxDb21tYW5kc0Zyb21RdWV1ZSgpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBvbkhpc3RvcnlVcCgpXG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVIaXN0b3J5RG93bigpIHtcbiAgICBpZiAoc3VnZ2VzdGlvbnMubGVuZ3RoID4gMSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gT25seSBuYXZpZ2F0ZSBoaXN0b3J5L2Zvb3RlciB3aGVuIGN1cnNvciBpcyBvbiB0aGUgbGFzdCBsaW5lLlxuICAgIC8vIEluIG11bHRpbGluZSBpbnB1dHMsIGRvd24gYXJyb3cgc2hvdWxkIG1vdmUgdGhlIGN1cnNvciAoaGFuZGxlZCBieSBUZXh0SW5wdXQpXG4gICAgLy8gYW5kIG9ubHkgdHJpZ2dlciBuYXZpZ2F0aW9uIHdoZW4gYXQgdGhlIGJvdHRvbSBvZiB0aGUgaW5wdXQuXG4gICAgaWYgKCFpc0N1cnNvck9uTGFzdExpbmUpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIEF0IGJvdHRvbSBvZiBoaXN0b3J5IOKGkiBlbnRlciBmb290ZXIgYXQgZmlyc3QgdmlzaWJsZSBwaWxsXG4gICAgaWYgKG9uSGlzdG9yeURvd24oKSAmJiBmb290ZXJJdGVtcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBmaXJzdCA9IGZvb3Rlckl0ZW1zWzBdIVxuICAgICAgc2VsZWN0Rm9vdGVySXRlbShmaXJzdClcbiAgICAgIGlmIChmaXJzdCA9PT0gJ3Rhc2tzJyAmJiAhZ2V0R2xvYmFsQ29uZmlnKCkuaGFzU2VlblRhc2tzSGludCkge1xuICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGMgPT5cbiAgICAgICAgICBjLmhhc1NlZW5UYXNrc0hpbnQgPyBjIDogeyAuLi5jLCBoYXNTZWVuVGFza3NIaW50OiB0cnVlIH0sXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBDcmVhdGUgYSBzdWdnZXN0aW9ucyBzdGF0ZSBkaXJlY3RseSAtIHdlJ2xsIHN5bmMgaXQgd2l0aCB1c2VUeXBlYWhlYWQgbGF0ZXJcbiAgY29uc3QgW3N1Z2dlc3Rpb25zU3RhdGUsIHNldFN1Z2dlc3Rpb25zU3RhdGVSYXddID0gdXNlU3RhdGU8e1xuICAgIHN1Z2dlc3Rpb25zOiBTdWdnZXN0aW9uSXRlbVtdXG4gICAgc2VsZWN0ZWRTdWdnZXN0aW9uOiBudW1iZXJcbiAgICBjb21tYW5kQXJndW1lbnRIaW50Pzogc3RyaW5nXG4gIH0+KHtcbiAgICBzdWdnZXN0aW9uczogW10sXG4gICAgc2VsZWN0ZWRTdWdnZXN0aW9uOiAtMSxcbiAgICBjb21tYW5kQXJndW1lbnRIaW50OiB1bmRlZmluZWQsXG4gIH0pXG5cbiAgLy8gU2V0dGVyIGZvciBzdWdnZXN0aW9ucyBzdGF0ZVxuICBjb25zdCBzZXRTdWdnZXN0aW9uc1N0YXRlID0gdXNlQ2FsbGJhY2soXG4gICAgKFxuICAgICAgdXBkYXRlcjpcbiAgICAgICAgfCB0eXBlb2Ygc3VnZ2VzdGlvbnNTdGF0ZVxuICAgICAgICB8ICgocHJldjogdHlwZW9mIHN1Z2dlc3Rpb25zU3RhdGUpID0+IHR5cGVvZiBzdWdnZXN0aW9uc1N0YXRlKSxcbiAgICApID0+IHtcbiAgICAgIHNldFN1Z2dlc3Rpb25zU3RhdGVSYXcocHJldiA9PlxuICAgICAgICB0eXBlb2YgdXBkYXRlciA9PT0gJ2Z1bmN0aW9uJyA/IHVwZGF0ZXIocHJldikgOiB1cGRhdGVyLFxuICAgICAgKVxuICAgIH0sXG4gICAgW10sXG4gIClcblxuICBjb25zdCBvblN1Ym1pdCA9IHVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChpbnB1dFBhcmFtOiBzdHJpbmcsIGlzU3VibWl0dGluZ1NsYXNoQ29tbWFuZCA9IGZhbHNlKSA9PiB7XG4gICAgICBpbnB1dFBhcmFtID0gaW5wdXRQYXJhbS50cmltRW5kKClcblxuICAgICAgLy8gRG9uJ3Qgc3VibWl0IGlmIGEgZm9vdGVyIGluZGljYXRvciBpcyBiZWluZyBvcGVuZWQuIFJlYWQgZnJlc2ggZnJvbVxuICAgICAgLy8gc3RvcmUg4oCUIGZvb3RlcjpvcGVuU2VsZWN0ZWQgY2FsbHMgc2VsZWN0Rm9vdGVySXRlbShudWxsKSB0aGVuIG9uU3VibWl0XG4gICAgICAvLyBpbiB0aGUgc2FtZSB0aWNrLCBhbmQgdGhlIGNsb3N1cmUgdmFsdWUgaGFzbid0IHVwZGF0ZWQgeWV0LiBBcHBseSB0aGVcbiAgICAgIC8vIHNhbWUgXCJzdGlsbCB2aXNpYmxlP1wiIGRlcml2YXRpb24gYXMgZm9vdGVySXRlbVNlbGVjdGVkIHNvIGEgc3RhbGVcbiAgICAgIC8vIHNlbGVjdGlvbiAocGlsbCBkaXNhcHBlYXJlZCkgZG9lc24ndCBzd2FsbG93IEVudGVyLlxuICAgICAgY29uc3Qgc3RhdGUgPSBzdG9yZS5nZXRTdGF0ZSgpXG4gICAgICBpZiAoXG4gICAgICAgIHN0YXRlLmZvb3RlclNlbGVjdGlvbiAmJlxuICAgICAgICBmb290ZXJJdGVtcy5pbmNsdWRlcyhzdGF0ZS5mb290ZXJTZWxlY3Rpb24pXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIEVudGVyIGluIHNlbGVjdGlvbiBtb2RlcyBjb25maXJtcyBzZWxlY3Rpb24gKHVzZUJhY2tncm91bmRUYXNrTmF2aWdhdGlvbikuXG4gICAgICAvLyBCYXNlVGV4dElucHV0J3MgdXNlSW5wdXQgcmVnaXN0ZXJzIGJlZm9yZSB0aGF0IGhvb2sgKGNoaWxkIGVmZmVjdHMgZmlyZSBmaXJzdCksXG4gICAgICAvLyBzbyB3aXRob3V0IHRoaXMgZ3VhcmQgRW50ZXIgd291bGQgZG91YmxlLWZpcmUgYW5kIGF1dG8tc3VibWl0IHRoZSBzdWdnZXN0aW9uLlxuICAgICAgaWYgKHN0YXRlLnZpZXdTZWxlY3Rpb25Nb2RlID09PSAnc2VsZWN0aW5nLWFnZW50Jykge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgZm9yIGltYWdlcyBlYXJseSAtIHdlIG5lZWQgdGhpcyBmb3Igc3VnZ2VzdGlvbiBsb2dpYyBiZWxvd1xuICAgICAgY29uc3QgaGFzSW1hZ2VzID0gT2JqZWN0LnZhbHVlcyhwYXN0ZWRDb250ZW50cykuc29tZShcbiAgICAgICAgYyA9PiBjLnR5cGUgPT09ICdpbWFnZScsXG4gICAgICApXG5cbiAgICAgIC8vIElmIGlucHV0IGlzIGVtcHR5IE9SIG1hdGNoZXMgdGhlIHN1Z2dlc3Rpb24sIHN1Ym1pdCBpdFxuICAgICAgLy8gQnV0IGlmIHRoZXJlIGFyZSBpbWFnZXMgYXR0YWNoZWQsIGRvbid0IGF1dG8tYWNjZXB0IHRoZSBzdWdnZXN0aW9uIC1cbiAgICAgIC8vIHRoZSB1c2VyIHdhbnRzIHRvIHN1Ym1pdCBqdXN0IHRoZSBpbWFnZShzKS5cbiAgICAgIC8vIE9ubHkgaW4gbGVhZGVyIHZpZXcg4oCUIHByb21wdFN1Z2dlc3Rpb24gaXMgbGVhZGVyLWNvbnRleHQsIG5vdCB0ZWFtbWF0ZS5cbiAgICAgIGNvbnN0IHN1Z2dlc3Rpb25UZXh0ID0gcHJvbXB0U3VnZ2VzdGlvblN0YXRlLnRleHRcbiAgICAgIGNvbnN0IGlucHV0TWF0Y2hlc1N1Z2dlc3Rpb24gPVxuICAgICAgICBpbnB1dFBhcmFtLnRyaW0oKSA9PT0gJycgfHwgaW5wdXRQYXJhbSA9PT0gc3VnZ2VzdGlvblRleHRcbiAgICAgIGlmIChcbiAgICAgICAgaW5wdXRNYXRjaGVzU3VnZ2VzdGlvbiAmJlxuICAgICAgICBzdWdnZXN0aW9uVGV4dCAmJlxuICAgICAgICAhaGFzSW1hZ2VzICYmXG4gICAgICAgICFzdGF0ZS52aWV3aW5nQWdlbnRUYXNrSWRcbiAgICAgICkge1xuICAgICAgICAvLyBJZiBzcGVjdWxhdGlvbiBpcyBhY3RpdmUsIGluamVjdCBtZXNzYWdlcyBpbW1lZGlhdGVseSBhcyB0aGV5IHN0cmVhbVxuICAgICAgICBpZiAoc3BlY3VsYXRpb24uc3RhdHVzID09PSAnYWN0aXZlJykge1xuICAgICAgICAgIG1hcmtBY2NlcHRlZCgpXG4gICAgICAgICAgLy8gc2tpcFJlc2V0OiByZXNldFN1Z2dlc3Rpb24gd291bGQgYWJvcnQgdGhlIHNwZWN1bGF0aW9uIGJlZm9yZSB3ZSBhY2NlcHQgaXRcbiAgICAgICAgICBsb2dPdXRjb21lQXRTdWJtaXNzaW9uKHN1Z2dlc3Rpb25UZXh0LCB7IHNraXBSZXNldDogdHJ1ZSB9KVxuXG4gICAgICAgICAgdm9pZCBvblN1Ym1pdFByb3AoXG4gICAgICAgICAgICBzdWdnZXN0aW9uVGV4dCxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0LFxuICAgICAgICAgICAgICBjbGVhckJ1ZmZlcixcbiAgICAgICAgICAgICAgcmVzZXRIaXN0b3J5LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RhdGU6IHNwZWN1bGF0aW9uLFxuICAgICAgICAgICAgICBzcGVjdWxhdGlvblNlc3Npb25UaW1lU2F2ZWRNczogc3BlY3VsYXRpb25TZXNzaW9uVGltZVNhdmVkTXMsXG4gICAgICAgICAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICApXG4gICAgICAgICAgcmV0dXJuIC8vIFNraXAgbm9ybWFsIHF1ZXJ5IC0gc3BlY3VsYXRpb24gaGFuZGxlZCBpdFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVndWxhciBzdWdnZXN0aW9uIGFjY2VwdGFuY2UgKHJlcXVpcmVzIHNob3duQXQgPiAwKVxuICAgICAgICBpZiAocHJvbXB0U3VnZ2VzdGlvblN0YXRlLnNob3duQXQgPiAwKSB7XG4gICAgICAgICAgbWFya0FjY2VwdGVkKClcbiAgICAgICAgICBpbnB1dFBhcmFtID0gc3VnZ2VzdGlvblRleHRcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBIYW5kbGUgQG5hbWUgZGlyZWN0IG1lc3NhZ2VcbiAgICAgIGlmIChpc0FnZW50U3dhcm1zRW5hYmxlZCgpKSB7XG4gICAgICAgIGNvbnN0IGRpcmVjdE1lc3NhZ2UgPSBwYXJzZURpcmVjdE1lbWJlck1lc3NhZ2UoaW5wdXRQYXJhbSlcbiAgICAgICAgaWYgKGRpcmVjdE1lc3NhZ2UpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzZW5kRGlyZWN0TWVtYmVyTWVzc2FnZShcbiAgICAgICAgICAgIGRpcmVjdE1lc3NhZ2UucmVjaXBpZW50TmFtZSxcbiAgICAgICAgICAgIGRpcmVjdE1lc3NhZ2UubWVzc2FnZSxcbiAgICAgICAgICAgIHRlYW1Db250ZXh0LFxuICAgICAgICAgICAgd3JpdGVUb01haWxib3gsXG4gICAgICAgICAgKVxuXG4gICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICAgICAgICBrZXk6ICdkaXJlY3QtbWVzc2FnZS1zZW50JyxcbiAgICAgICAgICAgICAgdGV4dDogYFNlbnQgdG8gQCR7cmVzdWx0LnJlY2lwaWVudE5hbWV9YCxcbiAgICAgICAgICAgICAgcHJpb3JpdHk6ICdpbW1lZGlhdGUnLFxuICAgICAgICAgICAgICB0aW1lb3V0TXM6IDMwMDAsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgdHJhY2tBbmRTZXRJbnB1dCgnJylcbiAgICAgICAgICAgIHNldEN1cnNvck9mZnNldCgwKVxuICAgICAgICAgICAgY2xlYXJCdWZmZXIoKVxuICAgICAgICAgICAgcmVzZXRIaXN0b3J5KClcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH0gZWxzZSBpZiAocmVzdWx0LmVycm9yID09PSAnbm9fdGVhbV9jb250ZXh0Jykge1xuICAgICAgICAgICAgLy8gTm8gdGVhbSBjb250ZXh0IC0gZmFsbCB0aHJvdWdoIHRvIG5vcm1hbCBwcm9tcHQgc3VibWlzc2lvblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBVbmtub3duIHJlY2lwaWVudCAtIGZhbGwgdGhyb3VnaCB0byBub3JtYWwgcHJvbXB0IHN1Ym1pc3Npb25cbiAgICAgICAgICAgIC8vIFRoaXMgYWxsb3dzIGUuZy4gXCJAdXRpbHMgZXhwbGFpbiB0aGlzIGNvZGVcIiB0byBiZSBzZW50IGFzIGEgcHJvbXB0XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFsbG93IHN1Ym1pc3Npb24gaWYgdGhlcmUgYXJlIGltYWdlcyBhdHRhY2hlZCwgZXZlbiB3aXRob3V0IHRleHRcbiAgICAgIGlmIChpbnB1dFBhcmFtLnRyaW0oKSA9PT0gJycgJiYgIWhhc0ltYWdlcykge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gUHJvbXB0SW5wdXQgVVg6IENoZWNrIGlmIHN1Z2dlc3Rpb25zIGRyb3Bkb3duIGlzIHNob3dpbmdcbiAgICAgIC8vIEZvciBkaXJlY3Rvcnkgc3VnZ2VzdGlvbnMsIGFsbG93IHN1Ym1pc3Npb24gKFRhYiBpcyB1c2VkIGZvciBjb21wbGV0aW9uKVxuICAgICAgY29uc3QgaGFzRGlyZWN0b3J5U3VnZ2VzdGlvbnMgPVxuICAgICAgICBzdWdnZXN0aW9uc1N0YXRlLnN1Z2dlc3Rpb25zLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgc3VnZ2VzdGlvbnNTdGF0ZS5zdWdnZXN0aW9ucy5ldmVyeShzID0+IHMuZGVzY3JpcHRpb24gPT09ICdkaXJlY3RvcnknKVxuXG4gICAgICBpZiAoXG4gICAgICAgIHN1Z2dlc3Rpb25zU3RhdGUuc3VnZ2VzdGlvbnMubGVuZ3RoID4gMCAmJlxuICAgICAgICAhaXNTdWJtaXR0aW5nU2xhc2hDb21tYW5kICYmXG4gICAgICAgICFoYXNEaXJlY3RvcnlTdWdnZXN0aW9uc1xuICAgICAgKSB7XG4gICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICBgW29uU3VibWl0XSBlYXJseSByZXR1cm46IHN1Z2dlc3Rpb25zIHNob3dpbmcgKGNvdW50PSR7c3VnZ2VzdGlvbnNTdGF0ZS5zdWdnZXN0aW9ucy5sZW5ndGh9KWAsXG4gICAgICAgIClcbiAgICAgICAgcmV0dXJuIC8vIERvbid0IHN1Ym1pdCwgdXNlciBuZWVkcyB0byBjbGVhciBzdWdnZXN0aW9ucyBmaXJzdFxuICAgICAgfVxuXG4gICAgICAvLyBMb2cgc3VnZ2VzdGlvbiBvdXRjb21lIGlmIG9uZSBleGlzdHNcbiAgICAgIGlmIChwcm9tcHRTdWdnZXN0aW9uU3RhdGUudGV4dCAmJiBwcm9tcHRTdWdnZXN0aW9uU3RhdGUuc2hvd25BdCA+IDApIHtcbiAgICAgICAgbG9nT3V0Y29tZUF0U3VibWlzc2lvbihpbnB1dFBhcmFtKVxuICAgICAgfVxuXG4gICAgICAvLyBDbGVhciBzdGFzaCBoaW50IG5vdGlmaWNhdGlvbiBvbiBzdWJtaXRcbiAgICAgIHJlbW92ZU5vdGlmaWNhdGlvbignc3Rhc2gtaGludCcpXG5cbiAgICAgIC8vIFJvdXRlIGlucHV0IHRvIHZpZXdlZCBhZ2VudCAoaW4tcHJvY2VzcyB0ZWFtbWF0ZSBvciBuYW1lZCBsb2NhbF9hZ2VudCkuXG4gICAgICBjb25zdCBhY3RpdmVBZ2VudCA9IGdldEFjdGl2ZUFnZW50Rm9ySW5wdXQoc3RvcmUuZ2V0U3RhdGUoKSlcbiAgICAgIGlmIChhY3RpdmVBZ2VudC50eXBlICE9PSAnbGVhZGVyJyAmJiBvbkFnZW50U3VibWl0KSB7XG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90cmFuc2NyaXB0X2lucHV0X3RvX3RlYW1tYXRlJywge30pXG4gICAgICAgIGF3YWl0IG9uQWdlbnRTdWJtaXQoaW5wdXRQYXJhbSwgYWN0aXZlQWdlbnQudGFzaywge1xuICAgICAgICAgIHNldEN1cnNvck9mZnNldCxcbiAgICAgICAgICBjbGVhckJ1ZmZlcixcbiAgICAgICAgICByZXNldEhpc3RvcnksXG4gICAgICAgIH0pXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBOb3JtYWwgbGVhZGVyIHN1Ym1pc3Npb25cbiAgICAgIGF3YWl0IG9uU3VibWl0UHJvcChpbnB1dFBhcmFtLCB7XG4gICAgICAgIHNldEN1cnNvck9mZnNldCxcbiAgICAgICAgY2xlYXJCdWZmZXIsXG4gICAgICAgIHJlc2V0SGlzdG9yeSxcbiAgICAgIH0pXG4gICAgfSxcbiAgICBbXG4gICAgICBwcm9tcHRTdWdnZXN0aW9uU3RhdGUsXG4gICAgICBzcGVjdWxhdGlvbixcbiAgICAgIHNwZWN1bGF0aW9uU2Vzc2lvblRpbWVTYXZlZE1zLFxuICAgICAgdGVhbUNvbnRleHQsXG4gICAgICBzdG9yZSxcbiAgICAgIGZvb3Rlckl0ZW1zLFxuICAgICAgc3VnZ2VzdGlvbnNTdGF0ZS5zdWdnZXN0aW9ucyxcbiAgICAgIG9uU3VibWl0UHJvcCxcbiAgICAgIG9uQWdlbnRTdWJtaXQsXG4gICAgICBjbGVhckJ1ZmZlcixcbiAgICAgIHJlc2V0SGlzdG9yeSxcbiAgICAgIGxvZ091dGNvbWVBdFN1Ym1pc3Npb24sXG4gICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgIG1hcmtBY2NlcHRlZCxcbiAgICAgIHBhc3RlZENvbnRlbnRzLFxuICAgICAgcmVtb3ZlTm90aWZpY2F0aW9uLFxuICAgIF0sXG4gIClcblxuICBjb25zdCB7XG4gICAgc3VnZ2VzdGlvbnMsXG4gICAgc2VsZWN0ZWRTdWdnZXN0aW9uLFxuICAgIGNvbW1hbmRBcmd1bWVudEhpbnQsXG4gICAgaW5saW5lR2hvc3RUZXh0LFxuICAgIG1heENvbHVtbldpZHRoLFxuICB9ID0gdXNlVHlwZWFoZWFkKHtcbiAgICBjb21tYW5kcyxcbiAgICBvbklucHV0Q2hhbmdlOiB0cmFja0FuZFNldElucHV0LFxuICAgIG9uU3VibWl0LFxuICAgIHNldEN1cnNvck9mZnNldCxcbiAgICBpbnB1dCxcbiAgICBjdXJzb3JPZmZzZXQsXG4gICAgbW9kZSxcbiAgICBhZ2VudHMsXG4gICAgc2V0U3VnZ2VzdGlvbnNTdGF0ZSxcbiAgICBzdWdnZXN0aW9uc1N0YXRlLFxuICAgIHN1cHByZXNzU3VnZ2VzdGlvbnM6IGlzU2VhcmNoaW5nSGlzdG9yeSB8fCBoaXN0b3J5SW5kZXggPiAwLFxuICAgIG1hcmtBY2NlcHRlZCxcbiAgICBvbk1vZGVDaGFuZ2UsXG4gIH0pXG5cbiAgLy8gVHJhY2sgaWYgcHJvbXB0IHN1Z2dlc3Rpb24gc2hvdWxkIGJlIHNob3duIChjb21wdXRlZCBsYXRlciB3aXRoIHRlcm1pbmFsIHdpZHRoKS5cbiAgLy8gSGlkZGVuIGluIHRlYW1tYXRlIHZpZXcg4oCUIHN1Z2dlc3Rpb24gaXMgbGVhZGVyLWNvbnRleHQgb25seS5cbiAgY29uc3Qgc2hvd1Byb21wdFN1Z2dlc3Rpb24gPVxuICAgIG1vZGUgPT09ICdwcm9tcHQnICYmXG4gICAgc3VnZ2VzdGlvbnMubGVuZ3RoID09PSAwICYmXG4gICAgcHJvbXB0U3VnZ2VzdGlvbiAmJlxuICAgICF2aWV3aW5nQWdlbnRUYXNrSWRcbiAgaWYgKHNob3dQcm9tcHRTdWdnZXN0aW9uKSB7XG4gICAgbWFya1Nob3duKClcbiAgfVxuXG4gIC8vIElmIHN1Z2dlc3Rpb24gd2FzIGdlbmVyYXRlZCBidXQgY2FuJ3QgYmUgc2hvd24gZHVlIHRvIHRpbWluZywgbG9nIHN1cHByZXNzaW9uLlxuICAvLyBFeGNsdWRlIHRlYW1tYXRlIHZpZXc6IG1hcmtTaG93bigpIGlzIGdhdGVkIGFib3ZlLCBzbyBzaG93bkF0IHN0YXlzIDAgdGhlcmUg4oCUXG4gIC8vIGJ1dCB0aGF0J3Mgbm90IGEgdGltaW5nIGZhaWx1cmUsIHRoZSBzdWdnZXN0aW9uIGlzIHZhbGlkIHdoZW4gcmV0dXJuaW5nIHRvIGxlYWRlci5cbiAgaWYgKFxuICAgIHByb21wdFN1Z2dlc3Rpb25TdGF0ZS50ZXh0ICYmXG4gICAgIXByb21wdFN1Z2dlc3Rpb24gJiZcbiAgICBwcm9tcHRTdWdnZXN0aW9uU3RhdGUuc2hvd25BdCA9PT0gMCAmJlxuICAgICF2aWV3aW5nQWdlbnRUYXNrSWRcbiAgKSB7XG4gICAgbG9nU3VnZ2VzdGlvblN1cHByZXNzZWQoJ3RpbWluZycsIHByb21wdFN1Z2dlc3Rpb25TdGF0ZS50ZXh0KVxuICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgIC4uLnByZXYsXG4gICAgICBwcm9tcHRTdWdnZXN0aW9uOiB7XG4gICAgICAgIHRleHQ6IG51bGwsXG4gICAgICAgIHByb21wdElkOiBudWxsLFxuICAgICAgICBzaG93bkF0OiAwLFxuICAgICAgICBhY2NlcHRlZEF0OiAwLFxuICAgICAgICBnZW5lcmF0aW9uUmVxdWVzdElkOiBudWxsLFxuICAgICAgfSxcbiAgICB9KSlcbiAgfVxuXG4gIGZ1bmN0aW9uIG9uSW1hZ2VQYXN0ZShcbiAgICBpbWFnZTogc3RyaW5nLFxuICAgIG1lZGlhVHlwZT86IHN0cmluZyxcbiAgICBmaWxlbmFtZT86IHN0cmluZyxcbiAgICBkaW1lbnNpb25zPzogSW1hZ2VEaW1lbnNpb25zLFxuICAgIHNvdXJjZVBhdGg/OiBzdHJpbmcsXG4gICkge1xuICAgIGxvZ0V2ZW50KCd0ZW5ndV9wYXN0ZV9pbWFnZScsIHt9KVxuICAgIG9uTW9kZUNoYW5nZSgncHJvbXB0JylcblxuICAgIGNvbnN0IHBhc3RlSWQgPSBuZXh0UGFzdGVJZFJlZi5jdXJyZW50KytcblxuICAgIGNvbnN0IG5ld0NvbnRlbnQ6IFBhc3RlZENvbnRlbnQgPSB7XG4gICAgICBpZDogcGFzdGVJZCxcbiAgICAgIHR5cGU6ICdpbWFnZScsXG4gICAgICBjb250ZW50OiBpbWFnZSxcbiAgICAgIG1lZGlhVHlwZTogbWVkaWFUeXBlIHx8ICdpbWFnZS9wbmcnLCAvLyBkZWZhdWx0IHRvIFBORyBpZiBub3QgcHJvdmlkZWRcbiAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZSB8fCAnUGFzdGVkIGltYWdlJyxcbiAgICAgIGRpbWVuc2lvbnMsXG4gICAgICBzb3VyY2VQYXRoLFxuICAgIH1cblxuICAgIC8vIENhY2hlIHBhdGggaW1tZWRpYXRlbHkgKGZhc3QpIHNvIGxpbmtzIHdvcmsgb24gcmVuZGVyXG4gICAgY2FjaGVJbWFnZVBhdGgobmV3Q29udGVudClcblxuICAgIC8vIFN0b3JlIGltYWdlIHRvIGRpc2sgaW4gYmFja2dyb3VuZFxuICAgIHZvaWQgc3RvcmVJbWFnZShuZXdDb250ZW50KVxuXG4gICAgLy8gVXBkYXRlIFVJXG4gICAgc2V0UGFzdGVkQ29udGVudHMocHJldiA9PiAoeyAuLi5wcmV2LCBbcGFzdGVJZF06IG5ld0NvbnRlbnQgfSkpXG4gICAgLy8gTXVsdGktaW1hZ2UgcGFzdGUgY2FsbHMgb25JbWFnZVBhc3RlIGluIGEgbG9vcC4gSWYgdGhlIHJlZiBpcyBhbHJlYWR5XG4gICAgLy8gYXJtZWQsIHRoZSBwcmV2aW91cyBwaWxsJ3MgbGF6eSBzcGFjZSBmaXJlcyBub3cgKGJlZm9yZSB0aGlzIHBpbGwpXG4gICAgLy8gcmF0aGVyIHRoYW4gYmVpbmcgbG9zdC5cbiAgICBjb25zdCBwcmVmaXggPSBwZW5kaW5nU3BhY2VBZnRlclBpbGxSZWYuY3VycmVudCA/ICcgJyA6ICcnXG4gICAgaW5zZXJ0VGV4dEF0Q3Vyc29yKHByZWZpeCArIGZvcm1hdEltYWdlUmVmKHBhc3RlSWQpKVxuICAgIHBlbmRpbmdTcGFjZUFmdGVyUGlsbFJlZi5jdXJyZW50ID0gdHJ1ZVxuICB9XG5cbiAgLy8gUHJ1bmUgaW1hZ2VzIHdob3NlIFtJbWFnZSAjTl0gcGxhY2Vob2xkZXIgaXMgbm8gbG9uZ2VyIGluIHRoZSBpbnB1dCB0ZXh0LlxuICAvLyBDb3ZlcnMgcGlsbCBiYWNrc3BhY2UsIEN0cmwrVSwgY2hhci1ieS1jaGFyIGRlbGV0aW9uIOKAlCBhbnkgZWRpdCB0aGF0IGRyb3BzXG4gIC8vIHRoZSByZWYuIG9uSW1hZ2VQYXN0ZSBiYXRjaGVzIHNldFBhc3RlZENvbnRlbnRzICsgaW5zZXJ0VGV4dEF0Q3Vyc29yIGluIHRoZVxuICAvLyBzYW1lIGV2ZW50LCBzbyB0aGlzIGVmZmVjdCBzZWVzIHRoZSBwbGFjZWhvbGRlciBhbHJlYWR5IHByZXNlbnQuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgcmVmZXJlbmNlZElkcyA9IG5ldyBTZXQocGFyc2VSZWZlcmVuY2VzKGlucHV0KS5tYXAociA9PiByLmlkKSlcbiAgICBzZXRQYXN0ZWRDb250ZW50cyhwcmV2ID0+IHtcbiAgICAgIGNvbnN0IG9ycGhhbmVkID0gT2JqZWN0LnZhbHVlcyhwcmV2KS5maWx0ZXIoXG4gICAgICAgIGMgPT4gYy50eXBlID09PSAnaW1hZ2UnICYmICFyZWZlcmVuY2VkSWRzLmhhcyhjLmlkKSxcbiAgICAgIClcbiAgICAgIGlmIChvcnBoYW5lZC5sZW5ndGggPT09IDApIHJldHVybiBwcmV2XG4gICAgICBjb25zdCBuZXh0ID0geyAuLi5wcmV2IH1cbiAgICAgIGZvciAoY29uc3QgaW1nIG9mIG9ycGhhbmVkKSBkZWxldGUgbmV4dFtpbWcuaWRdXG4gICAgICByZXR1cm4gbmV4dFxuICAgIH0pXG4gIH0sIFtpbnB1dCwgc2V0UGFzdGVkQ29udGVudHNdKVxuXG4gIGZ1bmN0aW9uIG9uVGV4dFBhc3RlKHJhd1RleHQ6IHN0cmluZykge1xuICAgIHBlbmRpbmdTcGFjZUFmdGVyUGlsbFJlZi5jdXJyZW50ID0gZmFsc2VcbiAgICAvLyBDbGVhbiB1cCBwYXN0ZWQgdGV4dCAtIHN0cmlwIEFOU0kgZXNjYXBlIGNvZGVzIGFuZCBub3JtYWxpemUgbGluZSBlbmRpbmdzIGFuZCB0YWJzXG4gICAgbGV0IHRleHQgPSBzdHJpcEFuc2kocmF3VGV4dCkucmVwbGFjZSgvXFxyL2csICdcXG4nKS5yZXBsYWNlQWxsKCdcXHQnLCAnICAgICcpXG5cbiAgICAvLyBNYXRjaCB0eXBlZC9hdXRvLXN1Z2dlc3Q6IGAhY21kYCBwYXN0ZWQgaW50byBlbXB0eSBpbnB1dCBlbnRlcnMgYmFzaCBtb2RlLlxuICAgIGlmIChpbnB1dC5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IHBhc3RlZE1vZGUgPSBnZXRNb2RlRnJvbUlucHV0KHRleHQpXG4gICAgICBpZiAocGFzdGVkTW9kZSAhPT0gJ3Byb21wdCcpIHtcbiAgICAgICAgb25Nb2RlQ2hhbmdlKHBhc3RlZE1vZGUpXG4gICAgICAgIHRleHQgPSBnZXRWYWx1ZUZyb21JbnB1dCh0ZXh0KVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG51bUxpbmVzID0gZ2V0UGFzdGVkVGV4dFJlZk51bUxpbmVzKHRleHQpXG4gICAgLy8gTGltaXQgdGhlIG51bWJlciBvZiBsaW5lcyB0byBzaG93IGluIHRoZSBpbnB1dFxuICAgIC8vIElmIHRoZSBvdmVyYWxsIGxheW91dCBpcyB0b28gaGlnaCB0aGVuIEluayB3aWxsIHJlcGFpbnRcbiAgICAvLyB0aGUgZW50aXJlIHRlcm1pbmFsLlxuICAgIC8vIFRoZSBhY3R1YWwgcmVxdWlyZWQgaGVpZ2h0IGlzIGRlcGVuZGVudCBvbiB0aGUgY29udGVudCwgdGhpc1xuICAgIC8vIGlzIGp1c3QgYW4gZXN0aW1hdGUuXG4gICAgY29uc3QgbWF4TGluZXMgPSBNYXRoLm1pbihyb3dzIC0gMTAsIDIpXG5cbiAgICAvLyBVc2Ugc3BlY2lhbCBoYW5kbGluZyBmb3IgbG9uZyBwYXN0ZWQgdGV4dCAoPlBBU1RFX1RIUkVTSE9MRCBjaGFycylcbiAgICAvLyBvciBpZiBpdCBleGNlZWRzIHRoZSBudW1iZXIgb2YgbGluZXMgd2Ugd2FudCB0byBzaG93XG4gICAgaWYgKHRleHQubGVuZ3RoID4gUEFTVEVfVEhSRVNIT0xEIHx8IG51bUxpbmVzID4gbWF4TGluZXMpIHtcbiAgICAgIGNvbnN0IHBhc3RlSWQgPSBuZXh0UGFzdGVJZFJlZi5jdXJyZW50KytcblxuICAgICAgY29uc3QgbmV3Q29udGVudDogUGFzdGVkQ29udGVudCA9IHtcbiAgICAgICAgaWQ6IHBhc3RlSWQsXG4gICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgY29udGVudDogdGV4dCxcbiAgICAgIH1cblxuICAgICAgc2V0UGFzdGVkQ29udGVudHMocHJldiA9PiAoeyAuLi5wcmV2LCBbcGFzdGVJZF06IG5ld0NvbnRlbnQgfSkpXG5cbiAgICAgIGluc2VydFRleHRBdEN1cnNvcihmb3JtYXRQYXN0ZWRUZXh0UmVmKHBhc3RlSWQsIG51bUxpbmVzKSlcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRm9yIHNob3J0ZXIgcGFzdGVzLCBqdXN0IGluc2VydCB0aGUgdGV4dCBub3JtYWxseVxuICAgICAgaW5zZXJ0VGV4dEF0Q3Vyc29yKHRleHQpXG4gICAgfVxuICB9XG5cbiAgY29uc3QgbGF6eVNwYWNlSW5wdXRGaWx0ZXIgPSB1c2VDYWxsYmFjayhcbiAgICAoaW5wdXQ6IHN0cmluZywga2V5OiBLZXkpOiBzdHJpbmcgPT4ge1xuICAgICAgaWYgKCFwZW5kaW5nU3BhY2VBZnRlclBpbGxSZWYuY3VycmVudCkgcmV0dXJuIGlucHV0XG4gICAgICBwZW5kaW5nU3BhY2VBZnRlclBpbGxSZWYuY3VycmVudCA9IGZhbHNlXG4gICAgICBpZiAoaXNOb25TcGFjZVByaW50YWJsZShpbnB1dCwga2V5KSkgcmV0dXJuICcgJyArIGlucHV0XG4gICAgICByZXR1cm4gaW5wdXRcbiAgICB9LFxuICAgIFtdLFxuICApXG5cbiAgZnVuY3Rpb24gaW5zZXJ0VGV4dEF0Q3Vyc29yKHRleHQ6IHN0cmluZykge1xuICAgIC8vIFB1c2ggY3VycmVudCBzdGF0ZSB0byBidWZmZXIgYmVmb3JlIGluc2VydGluZ1xuICAgIHB1c2hUb0J1ZmZlcihpbnB1dCwgY3Vyc29yT2Zmc2V0LCBwYXN0ZWRDb250ZW50cylcblxuICAgIGNvbnN0IG5ld0lucHV0ID1cbiAgICAgIGlucHV0LnNsaWNlKDAsIGN1cnNvck9mZnNldCkgKyB0ZXh0ICsgaW5wdXQuc2xpY2UoY3Vyc29yT2Zmc2V0KVxuICAgIHRyYWNrQW5kU2V0SW5wdXQobmV3SW5wdXQpXG4gICAgc2V0Q3Vyc29yT2Zmc2V0KGN1cnNvck9mZnNldCArIHRleHQubGVuZ3RoKVxuICB9XG5cbiAgY29uc3QgZG91YmxlUHJlc3NFc2NGcm9tRW1wdHkgPSB1c2VEb3VibGVQcmVzcyhcbiAgICAoKSA9PiB7fSxcbiAgICAoKSA9PiBvblNob3dNZXNzYWdlU2VsZWN0b3IoKSxcbiAgKVxuXG4gIC8vIEZ1bmN0aW9uIHRvIGdldCB0aGUgcXVldWVkIGNvbW1hbmQgZm9yIGVkaXRpbmcuIFJldHVybnMgdHJ1ZSBpZiBjb21tYW5kcyB3ZXJlIHBvcHBlZC5cbiAgY29uc3QgcG9wQWxsQ29tbWFuZHNGcm9tUXVldWUgPSB1c2VDYWxsYmFjaygoKTogYm9vbGVhbiA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gcG9wQWxsRWRpdGFibGUoaW5wdXQsIGN1cnNvck9mZnNldClcbiAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgdHJhY2tBbmRTZXRJbnB1dChyZXN1bHQudGV4dClcbiAgICBvbk1vZGVDaGFuZ2UoJ3Byb21wdCcpIC8vIEFsd2F5cyBwcm9tcHQgbW9kZSBmb3IgcXVldWVkIGNvbW1hbmRzXG4gICAgc2V0Q3Vyc29yT2Zmc2V0KHJlc3VsdC5jdXJzb3JPZmZzZXQpXG5cbiAgICAvLyBSZXN0b3JlIGltYWdlcyBmcm9tIHF1ZXVlZCBjb21tYW5kcyB0byBwYXN0ZWRDb250ZW50c1xuICAgIGlmIChyZXN1bHQuaW1hZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHNldFBhc3RlZENvbnRlbnRzKHByZXYgPT4ge1xuICAgICAgICBjb25zdCBuZXdDb250ZW50cyA9IHsgLi4ucHJldiB9XG4gICAgICAgIGZvciAoY29uc3QgaW1hZ2Ugb2YgcmVzdWx0LmltYWdlcykge1xuICAgICAgICAgIG5ld0NvbnRlbnRzW2ltYWdlLmlkXSA9IGltYWdlXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld0NvbnRlbnRzXG4gICAgICB9KVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlXG4gIH0sIFt0cmFja0FuZFNldElucHV0LCBvbk1vZGVDaGFuZ2UsIGlucHV0LCBjdXJzb3JPZmZzZXQsIHNldFBhc3RlZENvbnRlbnRzXSlcblxuICAvLyBJbnNlcnQgdGhlIGF0LW1lbnRpb25lZCByZWZlcmVuY2UgKHRoZSBmaWxlIGFuZCwgb3B0aW9uYWxseSwgYSBsaW5lIHJhbmdlKSB3aGVuXG4gIC8vIHdlIHJlY2VpdmUgYW4gYXQtbWVudGlvbmVkIG5vdGlmaWNhdGlvbiB0aGUgSURFLlxuICBjb25zdCBvbklkZUF0TWVudGlvbmVkID0gZnVuY3Rpb24gKGF0TWVudGlvbmVkOiBJREVBdE1lbnRpb25lZCkge1xuICAgIGxvZ0V2ZW50KCd0ZW5ndV9leHRfYXRfbWVudGlvbmVkJywge30pXG4gICAgbGV0IGF0TWVudGlvbmVkVGV4dDogc3RyaW5nXG4gICAgY29uc3QgcmVsYXRpdmVQYXRoID0gcGF0aC5yZWxhdGl2ZShnZXRDd2QoKSwgYXRNZW50aW9uZWQuZmlsZVBhdGgpXG4gICAgaWYgKGF0TWVudGlvbmVkLmxpbmVTdGFydCAmJiBhdE1lbnRpb25lZC5saW5lRW5kKSB7XG4gICAgICBhdE1lbnRpb25lZFRleHQgPVxuICAgICAgICBhdE1lbnRpb25lZC5saW5lU3RhcnQgPT09IGF0TWVudGlvbmVkLmxpbmVFbmRcbiAgICAgICAgICA/IGBAJHtyZWxhdGl2ZVBhdGh9I0wke2F0TWVudGlvbmVkLmxpbmVTdGFydH0gYFxuICAgICAgICAgIDogYEAke3JlbGF0aXZlUGF0aH0jTCR7YXRNZW50aW9uZWQubGluZVN0YXJ0fS0ke2F0TWVudGlvbmVkLmxpbmVFbmR9IGBcbiAgICB9IGVsc2Uge1xuICAgICAgYXRNZW50aW9uZWRUZXh0ID0gYEAke3JlbGF0aXZlUGF0aH0gYFxuICAgIH1cbiAgICBjb25zdCBjdXJzb3JDaGFyID0gaW5wdXRbY3Vyc29yT2Zmc2V0IC0gMV0gPz8gJyAnXG4gICAgaWYgKCEvXFxzLy50ZXN0KGN1cnNvckNoYXIpKSB7XG4gICAgICBhdE1lbnRpb25lZFRleHQgPSBgICR7YXRNZW50aW9uZWRUZXh0fWBcbiAgICB9XG4gICAgaW5zZXJ0VGV4dEF0Q3Vyc29yKGF0TWVudGlvbmVkVGV4dClcbiAgfVxuICB1c2VJZGVBdE1lbnRpb25lZChtY3BDbGllbnRzLCBvbklkZUF0TWVudGlvbmVkKVxuXG4gIC8vIEhhbmRsZXIgZm9yIGNoYXQ6dW5kbyAtIHVuZG8gbGFzdCBlZGl0XG4gIGNvbnN0IGhhbmRsZVVuZG8gPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgaWYgKGNhblVuZG8pIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzU3RhdGUgPSB1bmRvKClcbiAgICAgIGlmIChwcmV2aW91c1N0YXRlKSB7XG4gICAgICAgIHRyYWNrQW5kU2V0SW5wdXQocHJldmlvdXNTdGF0ZS50ZXh0KVxuICAgICAgICBzZXRDdXJzb3JPZmZzZXQocHJldmlvdXNTdGF0ZS5jdXJzb3JPZmZzZXQpXG4gICAgICAgIHNldFBhc3RlZENvbnRlbnRzKHByZXZpb3VzU3RhdGUucGFzdGVkQ29udGVudHMpXG4gICAgICB9XG4gICAgfVxuICB9LCBbY2FuVW5kbywgdW5kbywgdHJhY2tBbmRTZXRJbnB1dCwgc2V0UGFzdGVkQ29udGVudHNdKVxuXG4gIC8vIEhhbmRsZXIgZm9yIGNoYXQ6bmV3bGluZSAtIGluc2VydCBhIG5ld2xpbmUgYXQgdGhlIGN1cnNvciBwb3NpdGlvblxuICBjb25zdCBoYW5kbGVOZXdsaW5lID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHB1c2hUb0J1ZmZlcihpbnB1dCwgY3Vyc29yT2Zmc2V0LCBwYXN0ZWRDb250ZW50cylcbiAgICBjb25zdCBuZXdJbnB1dCA9XG4gICAgICBpbnB1dC5zbGljZSgwLCBjdXJzb3JPZmZzZXQpICsgJ1xcbicgKyBpbnB1dC5zbGljZShjdXJzb3JPZmZzZXQpXG4gICAgdHJhY2tBbmRTZXRJbnB1dChuZXdJbnB1dClcbiAgICBzZXRDdXJzb3JPZmZzZXQoY3Vyc29yT2Zmc2V0ICsgMSlcbiAgfSwgW1xuICAgIGlucHV0LFxuICAgIGN1cnNvck9mZnNldCxcbiAgICB0cmFja0FuZFNldElucHV0LFxuICAgIHNldEN1cnNvck9mZnNldCxcbiAgICBwdXNoVG9CdWZmZXIsXG4gICAgcGFzdGVkQ29udGVudHMsXG4gIF0pXG5cbiAgLy8gSGFuZGxlciBmb3IgY2hhdDpleHRlcm5hbEVkaXRvciAtIGVkaXQgaW4gJEVESVRPUlxuICBjb25zdCBoYW5kbGVFeHRlcm5hbEVkaXRvciA9IHVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBsb2dFdmVudCgndGVuZ3VfZXh0ZXJuYWxfZWRpdG9yX3VzZWQnLCB7fSlcbiAgICBzZXRJc0V4dGVybmFsRWRpdG9yQWN0aXZlKHRydWUpXG5cbiAgICB0cnkge1xuICAgICAgLy8gUGFzcyBwYXN0ZWRDb250ZW50cyB0byBleHBhbmQgY29sbGFwc2VkIHRleHQgcmVmZXJlbmNlc1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZWRpdFByb21wdEluRWRpdG9yKGlucHV0LCBwYXN0ZWRDb250ZW50cylcblxuICAgICAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICAgIGtleTogJ2V4dGVybmFsLWVkaXRvci1lcnJvcicsXG4gICAgICAgICAgdGV4dDogcmVzdWx0LmVycm9yLFxuICAgICAgICAgIGNvbG9yOiAnd2FybmluZycsXG4gICAgICAgICAgcHJpb3JpdHk6ICdoaWdoJyxcbiAgICAgICAgfSlcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3VsdC5jb250ZW50ICE9PSBudWxsICYmIHJlc3VsdC5jb250ZW50ICE9PSBpbnB1dCkge1xuICAgICAgICAvLyBQdXNoIGN1cnJlbnQgc3RhdGUgdG8gYnVmZmVyIGJlZm9yZSBtYWtpbmcgY2hhbmdlc1xuICAgICAgICBwdXNoVG9CdWZmZXIoaW5wdXQsIGN1cnNvck9mZnNldCwgcGFzdGVkQ29udGVudHMpXG5cbiAgICAgICAgdHJhY2tBbmRTZXRJbnB1dChyZXN1bHQuY29udGVudClcbiAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0KHJlc3VsdC5jb250ZW50Lmxlbmd0aClcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICBsb2dFcnJvcihlcnIpXG4gICAgICB9XG4gICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICBrZXk6ICdleHRlcm5hbC1lZGl0b3ItZXJyb3InLFxuICAgICAgICB0ZXh0OiBgRXh0ZXJuYWwgZWRpdG9yIGZhaWxlZDogJHtlcnJvck1lc3NhZ2UoZXJyKX1gLFxuICAgICAgICBjb2xvcjogJ3dhcm5pbmcnLFxuICAgICAgICBwcmlvcml0eTogJ2hpZ2gnLFxuICAgICAgfSlcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNFeHRlcm5hbEVkaXRvckFjdGl2ZShmYWxzZSlcbiAgICB9XG4gIH0sIFtcbiAgICBpbnB1dCxcbiAgICBjdXJzb3JPZmZzZXQsXG4gICAgcGFzdGVkQ29udGVudHMsXG4gICAgcHVzaFRvQnVmZmVyLFxuICAgIHRyYWNrQW5kU2V0SW5wdXQsXG4gICAgYWRkTm90aWZpY2F0aW9uLFxuICBdKVxuXG4gIC8vIEhhbmRsZXIgZm9yIGNoYXQ6c3Rhc2ggLSBzdGFzaC91bnN0YXNoIHByb21wdFxuICBjb25zdCBoYW5kbGVTdGFzaCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBpZiAoaW5wdXQudHJpbSgpID09PSAnJyAmJiBzdGFzaGVkUHJvbXB0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFBvcCBzdGFzaCB3aGVuIGlucHV0IGlzIGVtcHR5XG4gICAgICB0cmFja0FuZFNldElucHV0KHN0YXNoZWRQcm9tcHQudGV4dClcbiAgICAgIHNldEN1cnNvck9mZnNldChzdGFzaGVkUHJvbXB0LmN1cnNvck9mZnNldClcbiAgICAgIHNldFBhc3RlZENvbnRlbnRzKHN0YXNoZWRQcm9tcHQucGFzdGVkQ29udGVudHMpXG4gICAgICBzZXRTdGFzaGVkUHJvbXB0KHVuZGVmaW5lZClcbiAgICB9IGVsc2UgaWYgKGlucHV0LnRyaW0oKSAhPT0gJycpIHtcbiAgICAgIC8vIFB1c2ggdG8gc3Rhc2ggKHNhdmUgdGV4dCwgY3Vyc29yIHBvc2l0aW9uLCBhbmQgcGFzdGVkIGNvbnRlbnRzKVxuICAgICAgc2V0U3Rhc2hlZFByb21wdCh7IHRleHQ6IGlucHV0LCBjdXJzb3JPZmZzZXQsIHBhc3RlZENvbnRlbnRzIH0pXG4gICAgICB0cmFja0FuZFNldElucHV0KCcnKVxuICAgICAgc2V0Q3Vyc29yT2Zmc2V0KDApXG4gICAgICBzZXRQYXN0ZWRDb250ZW50cyh7fSlcbiAgICAgIC8vIFRyYWNrIHVzYWdlIGZvciAvZGlzY292ZXIgYW5kIHN0b3Agc2hvd2luZyBoaW50XG4gICAgICBzYXZlR2xvYmFsQ29uZmlnKGMgPT4ge1xuICAgICAgICBpZiAoYy5oYXNVc2VkU3Rhc2gpIHJldHVybiBjXG4gICAgICAgIHJldHVybiB7IC4uLmMsIGhhc1VzZWRTdGFzaDogdHJ1ZSB9XG4gICAgICB9KVxuICAgIH1cbiAgfSwgW1xuICAgIGlucHV0LFxuICAgIGN1cnNvck9mZnNldCxcbiAgICBzdGFzaGVkUHJvbXB0LFxuICAgIHRyYWNrQW5kU2V0SW5wdXQsXG4gICAgc2V0U3Rhc2hlZFByb21wdCxcbiAgICBwYXN0ZWRDb250ZW50cyxcbiAgICBzZXRQYXN0ZWRDb250ZW50cyxcbiAgXSlcblxuICAvLyBIYW5kbGVyIGZvciBjaGF0Om1vZGVsUGlja2VyIC0gdG9nZ2xlIG1vZGVsIHBpY2tlclxuICBjb25zdCBoYW5kbGVNb2RlbFBpY2tlciA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRTaG93TW9kZWxQaWNrZXIocHJldiA9PiAhcHJldilcbiAgICBpZiAoaGVscE9wZW4pIHtcbiAgICAgIHNldEhlbHBPcGVuKGZhbHNlKVxuICAgIH1cbiAgfSwgW2hlbHBPcGVuXSlcblxuICAvLyBIYW5kbGVyIGZvciBjaGF0OmZhc3RNb2RlIC0gdG9nZ2xlIGZhc3QgbW9kZSBwaWNrZXJcbiAgY29uc3QgaGFuZGxlRmFzdE1vZGVQaWNrZXIgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgc2V0U2hvd0Zhc3RNb2RlUGlja2VyKHByZXYgPT4gIXByZXYpXG4gICAgaWYgKGhlbHBPcGVuKSB7XG4gICAgICBzZXRIZWxwT3BlbihmYWxzZSlcbiAgICB9XG4gIH0sIFtoZWxwT3Blbl0pXG5cbiAgLy8gSGFuZGxlciBmb3IgY2hhdDp0aGlua2luZ1RvZ2dsZSAtIHRvZ2dsZSB0aGlua2luZyBtb2RlXG4gIGNvbnN0IGhhbmRsZVRoaW5raW5nVG9nZ2xlID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldFNob3dUaGlua2luZ1RvZ2dsZShwcmV2ID0+ICFwcmV2KVxuICAgIGlmIChoZWxwT3Blbikge1xuICAgICAgc2V0SGVscE9wZW4oZmFsc2UpXG4gICAgfVxuICB9LCBbaGVscE9wZW5dKVxuXG4gIC8vIEhhbmRsZXIgZm9yIGNoYXQ6Y3ljbGVNb2RlIC0gY3ljbGUgdGhyb3VnaCBwZXJtaXNzaW9uIG1vZGVzXG4gIGNvbnN0IGhhbmRsZUN5Y2xlTW9kZSA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICAvLyBXaGVuIHZpZXdpbmcgYSB0ZWFtbWF0ZSwgY3ljbGUgdGhlaXIgbW9kZSBpbnN0ZWFkIG9mIHRoZSBsZWFkZXInc1xuICAgIGlmIChpc0FnZW50U3dhcm1zRW5hYmxlZCgpICYmIHZpZXdlZFRlYW1tYXRlICYmIHZpZXdpbmdBZ2VudFRhc2tJZCkge1xuICAgICAgY29uc3QgdGVhbW1hdGVDb250ZXh0OiBUb29sUGVybWlzc2lvbkNvbnRleHQgPSB7XG4gICAgICAgIC4uLnRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgICAgbW9kZTogdmlld2VkVGVhbW1hdGUucGVybWlzc2lvbk1vZGUsXG4gICAgICB9XG4gICAgICAvLyBQYXNzIHVuZGVmaW5lZCBmb3IgdGVhbUNvbnRleHQgKHVudXNlZCBidXQga2VwdCBmb3IgQVBJIGNvbXBhdGliaWxpdHkpXG4gICAgICBjb25zdCBuZXh0TW9kZSA9IGdldE5leHRQZXJtaXNzaW9uTW9kZSh0ZWFtbWF0ZUNvbnRleHQsIHVuZGVmaW5lZClcblxuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X21vZGVfY3ljbGUnLCB7XG4gICAgICAgIHRvOiBuZXh0TW9kZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSlcblxuICAgICAgY29uc3QgdGVhbW1hdGVUYXNrSWQgPSB2aWV3aW5nQWdlbnRUYXNrSWRcbiAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICBjb25zdCB0YXNrID0gcHJldi50YXNrc1t0ZWFtbWF0ZVRhc2tJZF1cbiAgICAgICAgaWYgKCF0YXNrIHx8IHRhc2sudHlwZSAhPT0gJ2luX3Byb2Nlc3NfdGVhbW1hdGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHByZXZcbiAgICAgICAgfVxuICAgICAgICBpZiAodGFzay5wZXJtaXNzaW9uTW9kZSA9PT0gbmV4dE1vZGUpIHtcbiAgICAgICAgICByZXR1cm4gcHJldlxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICB0YXNrczoge1xuICAgICAgICAgICAgLi4ucHJldi50YXNrcyxcbiAgICAgICAgICAgIFt0ZWFtbWF0ZVRhc2tJZF06IHtcbiAgICAgICAgICAgICAgLi4udGFzayxcbiAgICAgICAgICAgICAgcGVybWlzc2lvbk1vZGU6IG5leHRNb2RlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBpZiAoaGVscE9wZW4pIHtcbiAgICAgICAgc2V0SGVscE9wZW4oZmFsc2UpXG4gICAgICB9XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBDb21wdXRlIHRoZSBuZXh0IG1vZGUgd2l0aG91dCB0cmlnZ2VyaW5nIHNpZGUgZWZmZWN0cyBmaXJzdFxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBbYXV0by1tb2RlXSBoYW5kbGVDeWNsZU1vZGU6IGN1cnJlbnRNb2RlPSR7dG9vbFBlcm1pc3Npb25Db250ZXh0Lm1vZGV9IGlzQXV0b01vZGVBdmFpbGFibGU9JHt0b29sUGVybWlzc2lvbkNvbnRleHQuaXNBdXRvTW9kZUF2YWlsYWJsZX0gc2hvd0F1dG9Nb2RlT3B0SW49JHtzaG93QXV0b01vZGVPcHRJbn0gdGltZW91dFBlbmRpbmc9JHshIWF1dG9Nb2RlT3B0SW5UaW1lb3V0UmVmLmN1cnJlbnR9YCxcbiAgICApXG4gICAgY29uc3QgbmV4dE1vZGUgPSBnZXROZXh0UGVybWlzc2lvbk1vZGUodG9vbFBlcm1pc3Npb25Db250ZXh0LCB0ZWFtQ29udGV4dClcblxuICAgIC8vIENoZWNrIGlmIHVzZXIgaXMgZW50ZXJpbmcgYXV0byBtb2RlIGZvciB0aGUgZmlyc3QgdGltZS4gR2F0ZWQgb24gdGhlXG4gICAgLy8gcGVyc2lzdGVudCBzZXR0aW5ncyBmbGFnIChoYXNBdXRvTW9kZU9wdEluKSByYXRoZXIgdGhhbiB0aGUgYnJvYWRlclxuICAgIC8vIGhhc0F1dG9Nb2RlT3B0SW5BbnlTb3VyY2Ugc28gdGhhdCAtLWVuYWJsZS1hdXRvLW1vZGUgdXNlcnMgc3RpbGwgc2VlXG4gICAgLy8gdGhlIHdhcm5pbmcgZGlhbG9nIG9uY2Ug4oCUIHRoZSBDTEkgZmxhZyBzaG91bGQgZ3JhbnQgY2Fyb3VzZWwgYWNjZXNzLFxuICAgIC8vIG5vdCBieXBhc3MgdGhlIHNhZmV0eSB0ZXh0LlxuICAgIGxldCBpc0VudGVyaW5nQXV0b01vZGVGaXJzdFRpbWUgPSBmYWxzZVxuICAgIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSkge1xuICAgICAgaXNFbnRlcmluZ0F1dG9Nb2RlRmlyc3RUaW1lID1cbiAgICAgICAgbmV4dE1vZGUgPT09ICdhdXRvJyAmJlxuICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQubW9kZSAhPT0gJ2F1dG8nICYmXG4gICAgICAgICFoYXNBdXRvTW9kZU9wdEluKCkgJiZcbiAgICAgICAgIXZpZXdpbmdBZ2VudFRhc2tJZCAvLyBPbmx5IHNob3cgZm9yIHByaW1hcnkgYWdlbnQsIG5vdCBzdWJhZ2VudHNcbiAgICB9XG5cbiAgICBpZiAoZmVhdHVyZSgnVFJBTlNDUklQVF9DTEFTU0lGSUVSJykpIHtcbiAgICAgIGlmIChpc0VudGVyaW5nQXV0b01vZGVGaXJzdFRpbWUpIHtcbiAgICAgICAgLy8gU3RvcmUgcHJldmlvdXMgbW9kZSBzbyB3ZSBjYW4gcmV2ZXJ0IGlmIHVzZXIgZGVjbGluZXNcbiAgICAgICAgc2V0UHJldmlvdXNNb2RlQmVmb3JlQXV0byh0b29sUGVybWlzc2lvbkNvbnRleHQubW9kZSlcblxuICAgICAgICAvLyBPbmx5IHVwZGF0ZSB0aGUgVUkgbW9kZSBsYWJlbCDigJQgZG8gTk9UIGNhbGwgdHJhbnNpdGlvblBlcm1pc3Npb25Nb2RlXG4gICAgICAgIC8vIG9yIGN5Y2xlUGVybWlzc2lvbk1vZGUgeWV0OyB3ZSBoYXZlbid0IGNvbmZpcm1lZCB3aXRoIHRoZSB1c2VyLlxuICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQ6IHtcbiAgICAgICAgICAgIC4uLnByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgICAgICAgICAgbW9kZTogJ2F1dG8nLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pKVxuICAgICAgICBzZXRUb29sUGVybWlzc2lvbkNvbnRleHQoe1xuICAgICAgICAgIC4uLnRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgICAgICBtb2RlOiAnYXV0bycsXG4gICAgICAgIH0pXG5cbiAgICAgICAgLy8gU2hvdyBvcHQtaW4gZGlhbG9nIGFmdGVyIDQwMG1zIGRlYm91bmNlXG4gICAgICAgIGlmIChhdXRvTW9kZU9wdEluVGltZW91dFJlZi5jdXJyZW50KSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KGF1dG9Nb2RlT3B0SW5UaW1lb3V0UmVmLmN1cnJlbnQpXG4gICAgICAgIH1cbiAgICAgICAgYXV0b01vZGVPcHRJblRpbWVvdXRSZWYuY3VycmVudCA9IHNldFRpbWVvdXQoXG4gICAgICAgICAgKHNldFNob3dBdXRvTW9kZU9wdEluLCBhdXRvTW9kZU9wdEluVGltZW91dFJlZikgPT4ge1xuICAgICAgICAgICAgc2V0U2hvd0F1dG9Nb2RlT3B0SW4odHJ1ZSlcbiAgICAgICAgICAgIGF1dG9Nb2RlT3B0SW5UaW1lb3V0UmVmLmN1cnJlbnQgPSBudWxsXG4gICAgICAgICAgfSxcbiAgICAgICAgICA0MDAsXG4gICAgICAgICAgc2V0U2hvd0F1dG9Nb2RlT3B0SW4sXG4gICAgICAgICAgYXV0b01vZGVPcHRJblRpbWVvdXRSZWYsXG4gICAgICAgIClcblxuICAgICAgICBpZiAoaGVscE9wZW4pIHtcbiAgICAgICAgICBzZXRIZWxwT3BlbihmYWxzZSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBEaXNtaXNzIGF1dG8gbW9kZSBvcHQtaW4gZGlhbG9nIGlmIHNob3dpbmcgb3IgcGVuZGluZyAodXNlciBpcyBjeWNsaW5nIGF3YXkpLlxuICAgIC8vIERvIE5PVCByZXZlcnQgdG8gcHJldmlvdXNNb2RlQmVmb3JlQXV0byBoZXJlIOKAlCBzaGlmdCt0YWIgbWVhbnMgXCJhZHZhbmNlIHRoZVxuICAgIC8vIGNhcm91c2VsXCIsIG5vdCBcImRlY2xpbmVcIi4gUmV2ZXJ0aW5nIGNhdXNlcyBhIHBpbmctcG9uZyBsb29wOiBhdXRvIHJldmVydHMgdG9cbiAgICAvLyB0aGUgcHJpb3IgbW9kZSwgd2hvc2UgbmV4dCBtb2RlIGlzIGF1dG8gYWdhaW4sIGZvcmV2ZXIuXG4gICAgLy8gVGhlIGRpYWxvZydzIG93biBkZWNsaW5lIGJ1dHRvbiAoaGFuZGxlQXV0b01vZGVPcHRJbkRlY2xpbmUpIGhhbmRsZXMgcmV2ZXJ0LlxuICAgIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSkge1xuICAgICAgaWYgKHNob3dBdXRvTW9kZU9wdEluIHx8IGF1dG9Nb2RlT3B0SW5UaW1lb3V0UmVmLmN1cnJlbnQpIHtcbiAgICAgICAgaWYgKHNob3dBdXRvTW9kZU9wdEluKSB7XG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2F1dG9fbW9kZV9vcHRfaW5fZGlhbG9nX2RlY2xpbmUnLCB7fSlcbiAgICAgICAgfVxuICAgICAgICBzZXRTaG93QXV0b01vZGVPcHRJbihmYWxzZSlcbiAgICAgICAgaWYgKGF1dG9Nb2RlT3B0SW5UaW1lb3V0UmVmLmN1cnJlbnQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQoYXV0b01vZGVPcHRJblRpbWVvdXRSZWYuY3VycmVudClcbiAgICAgICAgICBhdXRvTW9kZU9wdEluVGltZW91dFJlZi5jdXJyZW50ID0gbnVsbFxuICAgICAgICB9XG4gICAgICAgIHNldFByZXZpb3VzTW9kZUJlZm9yZUF1dG8obnVsbClcbiAgICAgICAgLy8gRmFsbCB0aHJvdWdoIOKAlCBtb2RlIGlzICdhdXRvJywgY3ljbGVQZXJtaXNzaW9uTW9kZSBiZWxvdyBnb2VzIHRvICdkZWZhdWx0Jy5cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOb3cgdGhhdCB3ZSBrbm93IHRoaXMgaXMgTk9UIHRoZSBmaXJzdC10aW1lIGF1dG8gbW9kZSBwYXRoLFxuICAgIC8vIGNhbGwgY3ljbGVQZXJtaXNzaW9uTW9kZSB0byBhcHBseSBzaWRlIGVmZmVjdHMgKGUuZy4gc3RyaXBcbiAgICAvLyBkYW5nZXJvdXMgcGVybWlzc2lvbnMsIGFjdGl2YXRlIGNsYXNzaWZpZXIpXG4gICAgY29uc3QgeyBjb250ZXh0OiBwcmVwYXJlZENvbnRleHQgfSA9IGN5Y2xlUGVybWlzc2lvbk1vZGUoXG4gICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICB0ZWFtQ29udGV4dCxcbiAgICApXG5cbiAgICBsb2dFdmVudCgndGVuZ3VfbW9kZV9jeWNsZScsIHtcbiAgICAgIHRvOiBuZXh0TW9kZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG5cbiAgICAvLyBUcmFjayB3aGVuIHVzZXIgZW50ZXJzIHBsYW4gbW9kZVxuICAgIGlmIChuZXh0TW9kZSA9PT0gJ3BsYW4nKSB7XG4gICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgbGFzdFBsYW5Nb2RlVXNlOiBEYXRlLm5vdygpLFxuICAgICAgfSkpXG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSBtb2RlIHZpYSBzZXRBcHBTdGF0ZSBkaXJlY3RseSBiZWNhdXNlIHNldFRvb2xQZXJtaXNzaW9uQ29udGV4dFxuICAgIC8vIGludGVudGlvbmFsbHkgcHJlc2VydmVzIHRoZSBleGlzdGluZyBtb2RlICh0byBwcmV2ZW50IGNvb3JkaW5hdG9yIG1vZGVcbiAgICAvLyBjb3JydXB0aW9uIGZyb20gd29ya2VycykuIFRoZW4gY2FsbCBzZXRUb29sUGVybWlzc2lvbkNvbnRleHQgdG8gdHJpZ2dlclxuICAgIC8vIHJlY2hlY2sgb2YgcXVldWVkIHBlcm1pc3Npb24gcHJvbXB0cy5cbiAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAuLi5wcmV2LFxuICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiB7XG4gICAgICAgIC4uLnByZXBhcmVkQ29udGV4dCxcbiAgICAgICAgbW9kZTogbmV4dE1vZGUsXG4gICAgICB9LFxuICAgIH0pKVxuICAgIHNldFRvb2xQZXJtaXNzaW9uQ29udGV4dCh7XG4gICAgICAuLi5wcmVwYXJlZENvbnRleHQsXG4gICAgICBtb2RlOiBuZXh0TW9kZSxcbiAgICB9KVxuXG4gICAgLy8gSWYgdGhpcyBpcyBhIHRlYW1tYXRlLCB1cGRhdGUgY29uZmlnLmpzb24gc28gdGVhbSBsZWFkIHNlZXMgdGhlIGNoYW5nZVxuICAgIHN5bmNUZWFtbWF0ZU1vZGUobmV4dE1vZGUsIHRlYW1Db250ZXh0Py50ZWFtTmFtZSlcblxuICAgIC8vIENsb3NlIGhlbHAgdGlwcyBpZiB0aGV5J3JlIG9wZW4gd2hlbiBtb2RlIGlzIGN5Y2xlZFxuICAgIGlmIChoZWxwT3Blbikge1xuICAgICAgc2V0SGVscE9wZW4oZmFsc2UpXG4gICAgfVxuICB9LCBbXG4gICAgdG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgIHRlYW1Db250ZXh0LFxuICAgIHZpZXdpbmdBZ2VudFRhc2tJZCxcbiAgICB2aWV3ZWRUZWFtbWF0ZSxcbiAgICBzZXRBcHBTdGF0ZSxcbiAgICBzZXRUb29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgaGVscE9wZW4sXG4gICAgc2hvd0F1dG9Nb2RlT3B0SW4sXG4gIF0pXG5cbiAgLy8gSGFuZGxlciBmb3IgYXV0byBtb2RlIG9wdC1pbiBkaWFsb2cgYWNjZXB0YW5jZVxuICBjb25zdCBoYW5kbGVBdXRvTW9kZU9wdEluQWNjZXB0ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSkge1xuICAgICAgc2V0U2hvd0F1dG9Nb2RlT3B0SW4oZmFsc2UpXG4gICAgICBzZXRQcmV2aW91c01vZGVCZWZvcmVBdXRvKG51bGwpXG5cbiAgICAgIC8vIE5vdyB0aGF0IHRoZSB1c2VyIGFjY2VwdGVkLCBhcHBseSB0aGUgZnVsbCB0cmFuc2l0aW9uOiBhY3RpdmF0ZSB0aGVcbiAgICAgIC8vIGF1dG8gbW9kZSBiYWNrZW5kIChjbGFzc2lmaWVyLCBiZXRhIGhlYWRlcnMpIGFuZCBzdHJpcCBkYW5nZXJvdXNcbiAgICAgIC8vIHBlcm1pc3Npb25zIChlLmcuIEJhc2goKikgYWx3YXlzLWFsbG93IHJ1bGVzKS5cbiAgICAgIGNvbnN0IHN0cmlwcGVkQ29udGV4dCA9IHRyYW5zaXRpb25QZXJtaXNzaW9uTW9kZShcbiAgICAgICAgcHJldmlvdXNNb2RlQmVmb3JlQXV0byA/PyB0b29sUGVybWlzc2lvbkNvbnRleHQubW9kZSxcbiAgICAgICAgJ2F1dG8nLFxuICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICApXG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgIC4uLnByZXYsXG4gICAgICAgIHRvb2xQZXJtaXNzaW9uQ29udGV4dDoge1xuICAgICAgICAgIC4uLnN0cmlwcGVkQ29udGV4dCxcbiAgICAgICAgICBtb2RlOiAnYXV0bycsXG4gICAgICAgIH0sXG4gICAgICB9KSlcbiAgICAgIHNldFRvb2xQZXJtaXNzaW9uQ29udGV4dCh7XG4gICAgICAgIC4uLnN0cmlwcGVkQ29udGV4dCxcbiAgICAgICAgbW9kZTogJ2F1dG8nLFxuICAgICAgfSlcblxuICAgICAgLy8gQ2xvc2UgaGVscCB0aXBzIGlmIHRoZXkncmUgb3BlbiB3aGVuIGF1dG8gbW9kZSBpcyBlbmFibGVkXG4gICAgICBpZiAoaGVscE9wZW4pIHtcbiAgICAgICAgc2V0SGVscE9wZW4oZmFsc2UpXG4gICAgICB9XG4gICAgfVxuICB9LCBbXG4gICAgaGVscE9wZW4sXG4gICAgc2V0SGVscE9wZW4sXG4gICAgcHJldmlvdXNNb2RlQmVmb3JlQXV0byxcbiAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgc2V0QXBwU3RhdGUsXG4gICAgc2V0VG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICBdKVxuXG4gIC8vIEhhbmRsZXIgZm9yIGF1dG8gbW9kZSBvcHQtaW4gZGlhbG9nIGRlY2xpbmVcbiAgY29uc3QgaGFuZGxlQXV0b01vZGVPcHRJbkRlY2xpbmUgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgaWYgKGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpKSB7XG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgIGBbYXV0by1tb2RlXSBoYW5kbGVBdXRvTW9kZU9wdEluRGVjbGluZTogcmV2ZXJ0aW5nIHRvICR7cHJldmlvdXNNb2RlQmVmb3JlQXV0b30sIHNldHRpbmcgaXNBdXRvTW9kZUF2YWlsYWJsZT1mYWxzZWAsXG4gICAgICApXG4gICAgICBzZXRTaG93QXV0b01vZGVPcHRJbihmYWxzZSlcbiAgICAgIGlmIChhdXRvTW9kZU9wdEluVGltZW91dFJlZi5jdXJyZW50KSB7XG4gICAgICAgIGNsZWFyVGltZW91dChhdXRvTW9kZU9wdEluVGltZW91dFJlZi5jdXJyZW50KVxuICAgICAgICBhdXRvTW9kZU9wdEluVGltZW91dFJlZi5jdXJyZW50ID0gbnVsbFxuICAgICAgfVxuXG4gICAgICAvLyBSZXZlcnQgdG8gcHJldmlvdXMgbW9kZSBhbmQgcmVtb3ZlIGF1dG8gZnJvbSB0aGUgY2Fyb3VzZWxcbiAgICAgIC8vIGZvciB0aGUgcmVzdCBvZiB0aGlzIHNlc3Npb25cbiAgICAgIGlmIChwcmV2aW91c01vZGVCZWZvcmVBdXRvKSB7XG4gICAgICAgIHNldEF1dG9Nb2RlQWN0aXZlKGZhbHNlKVxuICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQ6IHtcbiAgICAgICAgICAgIC4uLnByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgICAgICAgICAgbW9kZTogcHJldmlvdXNNb2RlQmVmb3JlQXV0byxcbiAgICAgICAgICAgIGlzQXV0b01vZGVBdmFpbGFibGU6IGZhbHNlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pKVxuICAgICAgICBzZXRUb29sUGVybWlzc2lvbkNvbnRleHQoe1xuICAgICAgICAgIC4uLnRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgICAgICBtb2RlOiBwcmV2aW91c01vZGVCZWZvcmVBdXRvLFxuICAgICAgICAgIGlzQXV0b01vZGVBdmFpbGFibGU6IGZhbHNlLFxuICAgICAgICB9KVxuICAgICAgICBzZXRQcmV2aW91c01vZGVCZWZvcmVBdXRvKG51bGwpXG4gICAgICB9XG4gICAgfVxuICB9LCBbXG4gICAgcHJldmlvdXNNb2RlQmVmb3JlQXV0byxcbiAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgc2V0QXBwU3RhdGUsXG4gICAgc2V0VG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICBdKVxuXG4gIC8vIEhhbmRsZXIgZm9yIGNoYXQ6aW1hZ2VQYXN0ZSAtIHBhc3RlIGltYWdlIGZyb20gY2xpcGJvYXJkXG4gIGNvbnN0IGhhbmRsZUltYWdlUGFzdGUgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgdm9pZCBnZXRJbWFnZUZyb21DbGlwYm9hcmQoKS50aGVuKGltYWdlRGF0YSA9PiB7XG4gICAgICBpZiAoaW1hZ2VEYXRhKSB7XG4gICAgICAgIG9uSW1hZ2VQYXN0ZShpbWFnZURhdGEuYmFzZTY0LCBpbWFnZURhdGEubWVkaWFUeXBlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgc2hvcnRjdXREaXNwbGF5ID0gZ2V0U2hvcnRjdXREaXNwbGF5KFxuICAgICAgICAgICdjaGF0OmltYWdlUGFzdGUnLFxuICAgICAgICAgICdDaGF0JyxcbiAgICAgICAgICAnY3RybCt2JyxcbiAgICAgICAgKVxuICAgICAgICBjb25zdCBtZXNzYWdlID0gZW52LmlzU1NIKClcbiAgICAgICAgICA/IFwiTm8gaW1hZ2UgZm91bmQgaW4gY2xpcGJvYXJkLiBZb3UncmUgU1NIJ2Q7IHRyeSBzY3A/XCJcbiAgICAgICAgICA6IGBObyBpbWFnZSBmb3VuZCBpbiBjbGlwYm9hcmQuIFVzZSAke3Nob3J0Y3V0RGlzcGxheX0gdG8gcGFzdGUgaW1hZ2VzLmBcbiAgICAgICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgICAgICBrZXk6ICduby1pbWFnZS1pbi1jbGlwYm9hcmQnLFxuICAgICAgICAgIHRleHQ6IG1lc3NhZ2UsXG4gICAgICAgICAgcHJpb3JpdHk6ICdpbW1lZGlhdGUnLFxuICAgICAgICAgIHRpbWVvdXRNczogMTAwMCxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KVxuICB9LCBbYWRkTm90aWZpY2F0aW9uLCBvbkltYWdlUGFzdGVdKVxuXG4gIC8vIFJlZ2lzdGVyIGNoYXQ6c3VibWl0IGhhbmRsZXIgZGlyZWN0bHkgaW4gdGhlIGhhbmRsZXIgcmVnaXN0cnkgKG5vdCB2aWFcbiAgLy8gdXNlS2V5YmluZGluZ3MpIHNvIHRoYXQgb25seSB0aGUgQ2hvcmRJbnRlcmNlcHRvciBjYW4gaW52b2tlIGl0IGZvciBjaG9yZFxuICAvLyBjb21wbGV0aW9ucyAoZS5nLiwgXCJjdHJsK2Ugc1wiKS4gVGhlIGRlZmF1bHQgRW50ZXIgYmluZGluZyBmb3Igc3VibWl0IGlzXG4gIC8vIGhhbmRsZWQgYnkgVGV4dElucHV0IGRpcmVjdGx5ICh2aWEgb25TdWJtaXQgcHJvcCkgYW5kIHVzZVR5cGVhaGVhZCAoZm9yXG4gIC8vIGF1dG9jb21wbGV0ZSBhY2NlcHRhbmNlKS4gVXNpbmcgdXNlS2V5YmluZGluZ3Mgd291bGQgY2F1c2VcbiAgLy8gc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIG9uIEVudGVyLCBibG9ja2luZyBhdXRvY29tcGxldGUgZnJvbSBzZWVpbmcgdGhlIGtleS5cbiAgY29uc3Qga2V5YmluZGluZ0NvbnRleHQgPSB1c2VPcHRpb25hbEtleWJpbmRpbmdDb250ZXh0KClcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWtleWJpbmRpbmdDb250ZXh0IHx8IGlzTW9kYWxPdmVybGF5QWN0aXZlKSByZXR1cm5cbiAgICByZXR1cm4ga2V5YmluZGluZ0NvbnRleHQucmVnaXN0ZXJIYW5kbGVyKHtcbiAgICAgIGFjdGlvbjogJ2NoYXQ6c3VibWl0JyxcbiAgICAgIGNvbnRleHQ6ICdDaGF0JyxcbiAgICAgIGhhbmRsZXI6ICgpID0+IHtcbiAgICAgICAgdm9pZCBvblN1Ym1pdChpbnB1dClcbiAgICAgIH0sXG4gICAgfSlcbiAgfSwgW2tleWJpbmRpbmdDb250ZXh0LCBpc01vZGFsT3ZlcmxheUFjdGl2ZSwgb25TdWJtaXQsIGlucHV0XSlcblxuICAvLyBDaGF0IGNvbnRleHQga2V5YmluZGluZ3MgZm9yIGVkaXRpbmcgc2hvcnRjdXRzXG4gIC8vIE5vdGU6IGhpc3Rvcnk6cHJldmlvdXMvaGlzdG9yeTpuZXh0IGFyZSBOT1QgaGFuZGxlZCBoZXJlLiBUaGV5IGFyZSBwYXNzZWQgYXNcbiAgLy8gb25IaXN0b3J5VXAvb25IaXN0b3J5RG93biBwcm9wcyB0byBUZXh0SW5wdXQsIHNvIHRoYXQgdXNlVGV4dElucHV0J3NcbiAgLy8gdXBPckhpc3RvcnlVcC9kb3duT3JIaXN0b3J5RG93biBjYW4gdHJ5IGN1cnNvciBtb3ZlbWVudCBmaXJzdCBhbmQgb25seVxuICAvLyBmYWxsIHRocm91Z2ggdG8gaGlzdG9yeSB3aGVuIHRoZSBjdXJzb3IgY2FuJ3QgbW92ZSBmdXJ0aGVyLlxuICBjb25zdCBjaGF0SGFuZGxlcnMgPSB1c2VNZW1vKFxuICAgICgpID0+ICh7XG4gICAgICAnY2hhdDp1bmRvJzogaGFuZGxlVW5kbyxcbiAgICAgICdjaGF0Om5ld2xpbmUnOiBoYW5kbGVOZXdsaW5lLFxuICAgICAgJ2NoYXQ6ZXh0ZXJuYWxFZGl0b3InOiBoYW5kbGVFeHRlcm5hbEVkaXRvcixcbiAgICAgICdjaGF0OnN0YXNoJzogaGFuZGxlU3Rhc2gsXG4gICAgICAnY2hhdDptb2RlbFBpY2tlcic6IGhhbmRsZU1vZGVsUGlja2VyLFxuICAgICAgJ2NoYXQ6dGhpbmtpbmdUb2dnbGUnOiBoYW5kbGVUaGlua2luZ1RvZ2dsZSxcbiAgICAgICdjaGF0OmN5Y2xlTW9kZSc6IGhhbmRsZUN5Y2xlTW9kZSxcbiAgICAgICdjaGF0OmltYWdlUGFzdGUnOiBoYW5kbGVJbWFnZVBhc3RlLFxuICAgIH0pLFxuICAgIFtcbiAgICAgIGhhbmRsZVVuZG8sXG4gICAgICBoYW5kbGVOZXdsaW5lLFxuICAgICAgaGFuZGxlRXh0ZXJuYWxFZGl0b3IsXG4gICAgICBoYW5kbGVTdGFzaCxcbiAgICAgIGhhbmRsZU1vZGVsUGlja2VyLFxuICAgICAgaGFuZGxlVGhpbmtpbmdUb2dnbGUsXG4gICAgICBoYW5kbGVDeWNsZU1vZGUsXG4gICAgICBoYW5kbGVJbWFnZVBhc3RlLFxuICAgIF0sXG4gIClcblxuICB1c2VLZXliaW5kaW5ncyhjaGF0SGFuZGxlcnMsIHtcbiAgICBjb250ZXh0OiAnQ2hhdCcsXG4gICAgaXNBY3RpdmU6ICFpc01vZGFsT3ZlcmxheUFjdGl2ZSxcbiAgfSlcblxuICAvLyBTaGlmdCvihpEgZW50ZXJzIG1lc3NhZ2UtYWN0aW9ucyBjdXJzb3IuIFNlcGFyYXRlIGlzQWN0aXZlIHNvIGN0cmwrciBzZWFyY2hcbiAgLy8gZG9lc24ndCBsZWF2ZSBzdGFsZSBpc1NlYXJjaGluZ0hpc3Rvcnkgb24gY3Vyc29yLWV4aXQgcmVtb3VudC5cbiAgdXNlS2V5YmluZGluZygnY2hhdDptZXNzYWdlQWN0aW9ucycsICgpID0+IG9uTWVzc2FnZUFjdGlvbnNFbnRlcj8uKCksIHtcbiAgICBjb250ZXh0OiAnQ2hhdCcsXG4gICAgaXNBY3RpdmU6ICFpc01vZGFsT3ZlcmxheUFjdGl2ZSAmJiAhaXNTZWFyY2hpbmdIaXN0b3J5LFxuICB9KVxuXG4gIC8vIEZhc3QgbW9kZSBrZXliaW5kaW5nIGlzIG9ubHkgYWN0aXZlIHdoZW4gZmFzdCBtb2RlIGlzIGVuYWJsZWQgYW5kIGF2YWlsYWJsZVxuICB1c2VLZXliaW5kaW5nKCdjaGF0OmZhc3RNb2RlJywgaGFuZGxlRmFzdE1vZGVQaWNrZXIsIHtcbiAgICBjb250ZXh0OiAnQ2hhdCcsXG4gICAgaXNBY3RpdmU6XG4gICAgICAhaXNNb2RhbE92ZXJsYXlBY3RpdmUgJiYgaXNGYXN0TW9kZUVuYWJsZWQoKSAmJiBpc0Zhc3RNb2RlQXZhaWxhYmxlKCksXG4gIH0pXG5cbiAgLy8gSGFuZGxlIGhlbHA6ZGlzbWlzcyBrZXliaW5kaW5nIChFU0MgY2xvc2VzIGhlbHAgbWVudSlcbiAgLy8gVGhpcyBpcyByZWdpc3RlcmVkIHNlcGFyYXRlbHkgZnJvbSBDaGF0IGNvbnRleHQgc28gaXQgaGFzIHByaW9yaXR5IG92ZXJcbiAgLy8gQ2FuY2VsUmVxdWVzdEhhbmRsZXIgd2hlbiBoZWxwIG1lbnUgaXMgb3BlblxuICB1c2VLZXliaW5kaW5nKFxuICAgICdoZWxwOmRpc21pc3MnLFxuICAgICgpID0+IHtcbiAgICAgIHNldEhlbHBPcGVuKGZhbHNlKVxuICAgIH0sXG4gICAgeyBjb250ZXh0OiAnSGVscCcsIGlzQWN0aXZlOiBoZWxwT3BlbiB9LFxuICApXG5cbiAgLy8gUXVpY2sgT3BlbiAvIEdsb2JhbCBTZWFyY2guIEhvb2sgY2FsbHMgYXJlIHVuY29uZGl0aW9uYWwgKFJ1bGVzIG9mIEhvb2tzKTtcbiAgLy8gdGhlIGhhbmRsZXIgYm9keSBpcyBmZWF0dXJlKCktZ2F0ZWQgc28gdGhlIHNldFN0YXRlIGNhbGxzIGFuZCBjb21wb25lbnRcbiAgLy8gcmVmZXJlbmNlcyBnZXQgdHJlZS1zaGFrZW4gaW4gZXh0ZXJuYWwgYnVpbGRzLlxuICBjb25zdCBxdWlja1NlYXJjaEFjdGl2ZSA9IGZlYXR1cmUoJ1FVSUNLX1NFQVJDSCcpXG4gICAgPyAhaXNNb2RhbE92ZXJsYXlBY3RpdmVcbiAgICA6IGZhbHNlXG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2FwcDpxdWlja09wZW4nLFxuICAgICgpID0+IHtcbiAgICAgIGlmIChmZWF0dXJlKCdRVUlDS19TRUFSQ0gnKSkge1xuICAgICAgICBzZXRTaG93UXVpY2tPcGVuKHRydWUpXG4gICAgICAgIHNldEhlbHBPcGVuKGZhbHNlKVxuICAgICAgfVxuICAgIH0sXG4gICAgeyBjb250ZXh0OiAnR2xvYmFsJywgaXNBY3RpdmU6IHF1aWNrU2VhcmNoQWN0aXZlIH0sXG4gIClcbiAgdXNlS2V5YmluZGluZyhcbiAgICAnYXBwOmdsb2JhbFNlYXJjaCcsXG4gICAgKCkgPT4ge1xuICAgICAgaWYgKGZlYXR1cmUoJ1FVSUNLX1NFQVJDSCcpKSB7XG4gICAgICAgIHNldFNob3dHbG9iYWxTZWFyY2godHJ1ZSlcbiAgICAgICAgc2V0SGVscE9wZW4oZmFsc2UpXG4gICAgICB9XG4gICAgfSxcbiAgICB7IGNvbnRleHQ6ICdHbG9iYWwnLCBpc0FjdGl2ZTogcXVpY2tTZWFyY2hBY3RpdmUgfSxcbiAgKVxuXG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2hpc3Rvcnk6c2VhcmNoJyxcbiAgICAoKSA9PiB7XG4gICAgICBpZiAoZmVhdHVyZSgnSElTVE9SWV9QSUNLRVInKSkge1xuICAgICAgICBzZXRTaG93SGlzdG9yeVBpY2tlcih0cnVlKVxuICAgICAgICBzZXRIZWxwT3BlbihmYWxzZSlcbiAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGNvbnRleHQ6ICdHbG9iYWwnLFxuICAgICAgaXNBY3RpdmU6IGZlYXR1cmUoJ0hJU1RPUllfUElDS0VSJykgPyAhaXNNb2RhbE92ZXJsYXlBY3RpdmUgOiBmYWxzZSxcbiAgICB9LFxuICApXG5cbiAgLy8gSGFuZGxlIEN0cmwrQyB0byBhYm9ydCBzcGVjdWxhdGlvbiB3aGVuIGlkbGUgKG5vdCBsb2FkaW5nKVxuICAvLyBDYW5jZWxSZXF1ZXN0SGFuZGxlciBvbmx5IGhhbmRsZXMgQ3RybCtDIGR1cmluZyBhY3RpdmUgdGFza3NcbiAgdXNlS2V5YmluZGluZyhcbiAgICAnYXBwOmludGVycnVwdCcsXG4gICAgKCkgPT4ge1xuICAgICAgYWJvcnRTcGVjdWxhdGlvbihzZXRBcHBTdGF0ZSlcbiAgICB9LFxuICAgIHtcbiAgICAgIGNvbnRleHQ6ICdHbG9iYWwnLFxuICAgICAgaXNBY3RpdmU6ICFpc0xvYWRpbmcgJiYgc3BlY3VsYXRpb24uc3RhdHVzID09PSAnYWN0aXZlJyxcbiAgICB9LFxuICApXG5cbiAgLy8gRm9vdGVyIGluZGljYXRvciBuYXZpZ2F0aW9uIGtleWJpbmRpbmdzLiDihpEv4oaTIGxpdmUgaGVyZSAobm90IGluXG4gIC8vIGhhbmRsZUhpc3RvcnlVcC9Eb3duKSBiZWNhdXNlIFRleHRJbnB1dCBmb2N1cz1mYWxzZSB3aGVuIGEgcGlsbCBpc1xuICAvLyBzZWxlY3RlZCDigJQgaXRzIHVzZUlucHV0IGlzIGluYWN0aXZlLCBzbyB0aGlzIGlzIHRoZSBvbmx5IHBhdGguXG4gIHVzZUtleWJpbmRpbmdzKFxuICAgIHtcbiAgICAgICdmb290ZXI6dXAnOiAoKSA9PiB7XG4gICAgICAgIC8vIOKGkSBzY3JvbGxzIHdpdGhpbiB0aGUgY29vcmRpbmF0b3IgdGFzayBsaXN0IGJlZm9yZSBsZWF2aW5nIHRoZSBwaWxsXG4gICAgICAgIGlmIChcbiAgICAgICAgICB0YXNrc1NlbGVjdGVkICYmXG4gICAgICAgICAgXCJleHRlcm5hbFwiID09PSAnYW50JyAmJlxuICAgICAgICAgIGNvb3JkaW5hdG9yVGFza0NvdW50ID4gMCAmJlxuICAgICAgICAgIGNvb3JkaW5hdG9yVGFza0luZGV4ID4gbWluQ29vcmRpbmF0b3JJbmRleFxuICAgICAgICApIHtcbiAgICAgICAgICBzZXRDb29yZGluYXRvclRhc2tJbmRleChwcmV2ID0+IHByZXYgLSAxKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIG5hdmlnYXRlRm9vdGVyKC0xLCB0cnVlKVxuICAgICAgfSxcbiAgICAgICdmb290ZXI6ZG93bic6ICgpID0+IHtcbiAgICAgICAgLy8g4oaTIHNjcm9sbHMgd2l0aGluIHRoZSBjb29yZGluYXRvciB0YXNrIGxpc3QsIG5ldmVyIGxlYXZlcyB0aGUgcGlsbFxuICAgICAgICBpZiAoXG4gICAgICAgICAgdGFza3NTZWxlY3RlZCAmJlxuICAgICAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiZcbiAgICAgICAgICBjb29yZGluYXRvclRhc2tDb3VudCA+IDBcbiAgICAgICAgKSB7XG4gICAgICAgICAgaWYgKGNvb3JkaW5hdG9yVGFza0luZGV4IDwgY29vcmRpbmF0b3JUYXNrQ291bnQgLSAxKSB7XG4gICAgICAgICAgICBzZXRDb29yZGluYXRvclRhc2tJbmRleChwcmV2ID0+IHByZXYgKyAxKVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBpZiAodGFza3NTZWxlY3RlZCAmJiAhaXNUZWFtbWF0ZU1vZGUpIHtcbiAgICAgICAgICBzZXRTaG93QmFzaGVzRGlhbG9nKHRydWUpXG4gICAgICAgICAgc2VsZWN0Rm9vdGVySXRlbShudWxsKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIG5hdmlnYXRlRm9vdGVyKDEpXG4gICAgICB9LFxuICAgICAgJ2Zvb3RlcjpuZXh0JzogKCkgPT4ge1xuICAgICAgICAvLyBUZWFtbWF0ZSBtb2RlOiDihpAv4oaSIGN5Y2xlcyB3aXRoaW4gdGhlIHRlYW0gbWVtYmVyIGxpc3RcbiAgICAgICAgaWYgKHRhc2tzU2VsZWN0ZWQgJiYgaXNUZWFtbWF0ZU1vZGUpIHtcbiAgICAgICAgICBjb25zdCB0b3RhbEFnZW50cyA9IDEgKyBpblByb2Nlc3NUZWFtbWF0ZXMubGVuZ3RoXG4gICAgICAgICAgc2V0VGVhbW1hdGVGb290ZXJJbmRleChwcmV2ID0+IChwcmV2ICsgMSkgJSB0b3RhbEFnZW50cylcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBuYXZpZ2F0ZUZvb3RlcigxKVxuICAgICAgfSxcbiAgICAgICdmb290ZXI6cHJldmlvdXMnOiAoKSA9PiB7XG4gICAgICAgIGlmICh0YXNrc1NlbGVjdGVkICYmIGlzVGVhbW1hdGVNb2RlKSB7XG4gICAgICAgICAgY29uc3QgdG90YWxBZ2VudHMgPSAxICsgaW5Qcm9jZXNzVGVhbW1hdGVzLmxlbmd0aFxuICAgICAgICAgIHNldFRlYW1tYXRlRm9vdGVySW5kZXgocHJldiA9PiAocHJldiAtIDEgKyB0b3RhbEFnZW50cykgJSB0b3RhbEFnZW50cylcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBuYXZpZ2F0ZUZvb3RlcigtMSlcbiAgICAgIH0sXG4gICAgICAnZm9vdGVyOm9wZW5TZWxlY3RlZCc6ICgpID0+IHtcbiAgICAgICAgaWYgKHZpZXdTZWxlY3Rpb25Nb2RlID09PSAnc2VsZWN0aW5nLWFnZW50Jykge1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIHN3aXRjaCAoZm9vdGVySXRlbVNlbGVjdGVkKSB7XG4gICAgICAgICAgY2FzZSAnY29tcGFuaW9uJzpcbiAgICAgICAgICAgIGlmIChmZWF0dXJlKCdCVUREWScpKSB7XG4gICAgICAgICAgICAgIHNlbGVjdEZvb3Rlckl0ZW0obnVsbClcbiAgICAgICAgICAgICAgdm9pZCBvblN1Ym1pdCgnL2J1ZGR5JylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgY2FzZSAndGFza3MnOlxuICAgICAgICAgICAgaWYgKGlzVGVhbW1hdGVNb2RlKSB7XG4gICAgICAgICAgICAgIC8vIEVudGVyIHN3aXRjaGVzIHRvIHRoZSBzZWxlY3RlZCBhZ2VudCdzIHZpZXdcbiAgICAgICAgICAgICAgaWYgKHRlYW1tYXRlRm9vdGVySW5kZXggPT09IDApIHtcbiAgICAgICAgICAgICAgICBleGl0VGVhbW1hdGVWaWV3KHNldEFwcFN0YXRlKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRlYW1tYXRlID0gaW5Qcm9jZXNzVGVhbW1hdGVzW3RlYW1tYXRlRm9vdGVySW5kZXggLSAxXVxuICAgICAgICAgICAgICAgIGlmICh0ZWFtbWF0ZSkgZW50ZXJUZWFtbWF0ZVZpZXcodGVhbW1hdGUuaWQsIHNldEFwcFN0YXRlKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvb3JkaW5hdG9yVGFza0luZGV4ID09PSAwICYmIGNvb3JkaW5hdG9yVGFza0NvdW50ID4gMCkge1xuICAgICAgICAgICAgICBleGl0VGVhbW1hdGVWaWV3KHNldEFwcFN0YXRlKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRUYXNrSWQgPVxuICAgICAgICAgICAgICAgIGdldFZpc2libGVBZ2VudFRhc2tzKHRhc2tzKVtjb29yZGluYXRvclRhc2tJbmRleCAtIDFdPy5pZFxuICAgICAgICAgICAgICBpZiAoc2VsZWN0ZWRUYXNrSWQpIHtcbiAgICAgICAgICAgICAgICBlbnRlclRlYW1tYXRlVmlldyhzZWxlY3RlZFRhc2tJZCwgc2V0QXBwU3RhdGUpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0U2hvd0Jhc2hlc0RpYWxvZyh0cnVlKVxuICAgICAgICAgICAgICAgIHNlbGVjdEZvb3Rlckl0ZW0obnVsbClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBjYXNlICd0bXV4JzpcbiAgICAgICAgICAgIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnKSB7XG4gICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT5cbiAgICAgICAgICAgICAgICBwcmV2LnR1bmdzdGVuUGFuZWxBdXRvSGlkZGVuXG4gICAgICAgICAgICAgICAgICA/IHsgLi4ucHJldiwgdHVuZ3N0ZW5QYW5lbEF1dG9IaWRkZW46IGZhbHNlIH1cbiAgICAgICAgICAgICAgICAgIDoge1xuICAgICAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICAgICAgdHVuZ3N0ZW5QYW5lbFZpc2libGU6ICEoXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2LnR1bmdzdGVuUGFuZWxWaXNpYmxlID8/IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ2JhZ2VsJzpcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgY2FzZSAndGVhbXMnOlxuICAgICAgICAgICAgc2V0U2hvd1RlYW1zRGlhbG9nKHRydWUpXG4gICAgICAgICAgICBzZWxlY3RGb290ZXJJdGVtKG51bGwpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ2JyaWRnZSc6XG4gICAgICAgICAgICBzZXRTaG93QnJpZGdlRGlhbG9nKHRydWUpXG4gICAgICAgICAgICBzZWxlY3RGb290ZXJJdGVtKG51bGwpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgJ2Zvb3RlcjpjbGVhclNlbGVjdGlvbic6ICgpID0+IHtcbiAgICAgICAgc2VsZWN0Rm9vdGVySXRlbShudWxsKVxuICAgICAgfSxcbiAgICAgICdmb290ZXI6Y2xvc2UnOiAoKSA9PiB7XG4gICAgICAgIGlmICh0YXNrc1NlbGVjdGVkICYmIGNvb3JkaW5hdG9yVGFza0luZGV4ID49IDEpIHtcbiAgICAgICAgICBjb25zdCB0YXNrID0gZ2V0VmlzaWJsZUFnZW50VGFza3ModGFza3MpW2Nvb3JkaW5hdG9yVGFza0luZGV4IC0gMV1cbiAgICAgICAgICBpZiAoIXRhc2spIHJldHVybiBmYWxzZVxuICAgICAgICAgIC8vIFdoZW4gdGhlIHNlbGVjdGVkIHJvdyBJUyB0aGUgdmlld2VkIGFnZW50LCAneCcgdHlwZXMgaW50byB0aGVcbiAgICAgICAgICAvLyBzdGVlcmluZyBpbnB1dC4gQW55IG90aGVyIHJvdyDigJQgZGlzbWlzcyBpdC5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICB2aWV3U2VsZWN0aW9uTW9kZSA9PT0gJ3ZpZXdpbmctYWdlbnQnICYmXG4gICAgICAgICAgICB0YXNrLmlkID09PSB2aWV3aW5nQWdlbnRUYXNrSWRcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIG9uQ2hhbmdlKFxuICAgICAgICAgICAgICBpbnB1dC5zbGljZSgwLCBjdXJzb3JPZmZzZXQpICsgJ3gnICsgaW5wdXQuc2xpY2UoY3Vyc29yT2Zmc2V0KSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIHNldEN1cnNvck9mZnNldChjdXJzb3JPZmZzZXQgKyAxKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuICAgICAgICAgIHN0b3BPckRpc21pc3NBZ2VudCh0YXNrLmlkLCBzZXRBcHBTdGF0ZSlcbiAgICAgICAgICBpZiAodGFzay5zdGF0dXMgIT09ICdydW5uaW5nJykge1xuICAgICAgICAgICAgc2V0Q29vcmRpbmF0b3JUYXNrSW5kZXgoaSA9PiBNYXRoLm1heChtaW5Db29yZGluYXRvckluZGV4LCBpIC0gMSkpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIC8vIE5vdCBoYW5kbGVkIOKAlCBsZXQgJ3gnIGZhbGwgdGhyb3VnaCB0byB0eXBlLXRvLWV4aXRcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0Zvb3RlcicsXG4gICAgICBpc0FjdGl2ZTogISFmb290ZXJJdGVtU2VsZWN0ZWQgJiYgIWlzTW9kYWxPdmVybGF5QWN0aXZlLFxuICAgIH0sXG4gIClcblxuICB1c2VJbnB1dCgoY2hhciwga2V5KSA9PiB7XG4gICAgLy8gU2tpcCBhbGwgaW5wdXQgaGFuZGxpbmcgd2hlbiBhIGZ1bGwtc2NyZWVuIGRpYWxvZyBpcyBvcGVuLiBUaGVzZSBkaWFsb2dzXG4gICAgLy8gcmVuZGVyIHZpYSBlYXJseSByZXR1cm4sIGJ1dCBob29rcyBydW4gdW5jb25kaXRpb25hbGx5IOKAlCBzbyB3aXRob3V0IHRoaXNcbiAgICAvLyBndWFyZCwgRXNjYXBlIGluc2lkZSBhIGRpYWxvZyBsZWFrcyB0byB0aGUgZG91YmxlLXByZXNzIG1lc3NhZ2Utc2VsZWN0b3IuXG4gICAgaWYgKFxuICAgICAgc2hvd1RlYW1zRGlhbG9nIHx8XG4gICAgICBzaG93UXVpY2tPcGVuIHx8XG4gICAgICBzaG93R2xvYmFsU2VhcmNoIHx8XG4gICAgICBzaG93SGlzdG9yeVBpY2tlclxuICAgICkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gRGV0ZWN0IGZhaWxlZCBBbHQgc2hvcnRjdXRzIG9uIG1hY09TIChPcHRpb24ga2V5IHByb2R1Y2VzIHNwZWNpYWwgY2hhcmFjdGVycylcbiAgICBpZiAoZ2V0UGxhdGZvcm0oKSA9PT0gJ21hY29zJyAmJiBpc01hY29zT3B0aW9uQ2hhcihjaGFyKSkge1xuICAgICAgY29uc3Qgc2hvcnRjdXQgPSBNQUNPU19PUFRJT05fU1BFQ0lBTF9DSEFSU1tjaGFyXVxuICAgICAgY29uc3QgdGVybWluYWxOYW1lID0gZ2V0TmF0aXZlQ1NJdVRlcm1pbmFsRGlzcGxheU5hbWUoKVxuICAgICAgY29uc3QganN4ID0gdGVybWluYWxOYW1lID8gKFxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICBUbyBlbmFibGUge3Nob3J0Y3V0fSwgc2V0IDxUZXh0IGJvbGQ+T3B0aW9uIGFzIE1ldGE8L1RleHQ+IGlueycgJ31cbiAgICAgICAgICB7dGVybWluYWxOYW1lfSBwcmVmZXJlbmNlcyAo4oyYLClcbiAgICAgICAgPC9UZXh0PlxuICAgICAgKSA6IChcbiAgICAgICAgPFRleHQgZGltQ29sb3I+VG8gZW5hYmxlIHtzaG9ydGN1dH0sIHJ1biAvdGVybWluYWwtc2V0dXA8L1RleHQ+XG4gICAgICApXG4gICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICBrZXk6ICdvcHRpb24tbWV0YS1oaW50JyxcbiAgICAgICAganN4LFxuICAgICAgICBwcmlvcml0eTogJ2ltbWVkaWF0ZScsXG4gICAgICAgIHRpbWVvdXRNczogNTAwMCxcbiAgICAgIH0pXG4gICAgICAvLyBEb24ndCByZXR1cm4gLSBsZXQgdGhlIGNoYXJhY3RlciBiZSB0eXBlZCBzbyB1c2VyIHNlZXMgdGhlIGlzc3VlXG4gICAgfVxuXG4gICAgLy8gRm9vdGVyIG5hdmlnYXRpb24gaXMgaGFuZGxlZCB2aWEgdXNlS2V5YmluZGluZ3MgYWJvdmUgKEZvb3RlciBjb250ZXh0KVxuXG4gICAgLy8gTk9URTogY3RybCtfLCBjdHJsK2csIGN0cmwrcyBhcmUgaGFuZGxlZCB2aWEgQ2hhdCBjb250ZXh0IGtleWJpbmRpbmdzIGFib3ZlXG5cbiAgICAvLyBUeXBlLXRvLWV4aXQgZm9vdGVyOiBwcmludGFibGUgY2hhcnMgd2hpbGUgYSBwaWxsIGlzIHNlbGVjdGVkIHJlZm9jdXNcbiAgICAvLyB0aGUgaW5wdXQgYW5kIHR5cGUgdGhlIGNoYXIuIE5hdiBrZXlzIGFyZSBjYXB0dXJlZCBieSB1c2VLZXliaW5kaW5nc1xuICAgIC8vIGFib3ZlLCBzbyBhbnl0aGluZyByZWFjaGluZyBoZXJlIGlzIGdlbnVpbmVseSBub3QgYSBmb290ZXIgYWN0aW9uLlxuICAgIC8vIG9uQ2hhbmdlIGNsZWFycyBmb290ZXJTZWxlY3Rpb24sIHNvIG5vIGV4cGxpY2l0IGRlc2VsZWN0LlxuICAgIGlmIChcbiAgICAgIGZvb3Rlckl0ZW1TZWxlY3RlZCAmJlxuICAgICAgY2hhciAmJlxuICAgICAgIWtleS5jdHJsICYmXG4gICAgICAha2V5Lm1ldGEgJiZcbiAgICAgICFrZXkuZXNjYXBlICYmXG4gICAgICAha2V5LnJldHVyblxuICAgICkge1xuICAgICAgb25DaGFuZ2UoaW5wdXQuc2xpY2UoMCwgY3Vyc29yT2Zmc2V0KSArIGNoYXIgKyBpbnB1dC5zbGljZShjdXJzb3JPZmZzZXQpKVxuICAgICAgc2V0Q3Vyc29yT2Zmc2V0KGN1cnNvck9mZnNldCArIGNoYXIubGVuZ3RoKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gRXhpdCBzcGVjaWFsIG1vZGVzIHdoZW4gYmFja3NwYWNlL2VzY2FwZS9kZWxldGUvY3RybCt1IGlzIHByZXNzZWQgYXQgY3Vyc29yIHBvc2l0aW9uIDBcbiAgICBpZiAoXG4gICAgICBjdXJzb3JPZmZzZXQgPT09IDAgJiZcbiAgICAgIChrZXkuZXNjYXBlIHx8IGtleS5iYWNrc3BhY2UgfHwga2V5LmRlbGV0ZSB8fCAoa2V5LmN0cmwgJiYgY2hhciA9PT0gJ3UnKSlcbiAgICApIHtcbiAgICAgIG9uTW9kZUNoYW5nZSgncHJvbXB0JylcbiAgICAgIHNldEhlbHBPcGVuKGZhbHNlKVxuICAgIH1cblxuICAgIC8vIEV4aXQgaGVscCBtb2RlIHdoZW4gYmFja3NwYWNlIGlzIHByZXNzZWQgYW5kIGlucHV0IGlzIGVtcHR5XG4gICAgaWYgKGhlbHBPcGVuICYmIGlucHV0ID09PSAnJyAmJiAoa2V5LmJhY2tzcGFjZSB8fCBrZXkuZGVsZXRlKSkge1xuICAgICAgc2V0SGVscE9wZW4oZmFsc2UpXG4gICAgfVxuXG4gICAgLy8gZXNjIGlzIGEgbGl0dGxlIG92ZXJsb2FkZWQ6XG4gICAgLy8gLSB3aGVuIHdlJ3JlIGxvYWRpbmcgYSByZXNwb25zZSwgaXQncyB1c2VkIHRvIGNhbmNlbCB0aGUgcmVxdWVzdFxuICAgIC8vIC0gb3RoZXJ3aXNlLCBpdCdzIHVzZWQgdG8gc2hvdyB0aGUgbWVzc2FnZSBzZWxlY3RvclxuICAgIC8vIC0gd2hlbiBkb3VibGUgcHJlc3NlZCwgaXQncyB1c2VkIHRvIGNsZWFyIHRoZSBpbnB1dFxuICAgIC8vIC0gd2hlbiBpbnB1dCBpcyBlbXB0eSwgcG9wIGZyb20gY29tbWFuZCBxdWV1ZVxuXG4gICAgLy8gSGFuZGxlIEVTQyBrZXkgcHJlc3NcbiAgICBpZiAoa2V5LmVzY2FwZSkge1xuICAgICAgLy8gQWJvcnQgYWN0aXZlIHNwZWN1bGF0aW9uXG4gICAgICBpZiAoc3BlY3VsYXRpb24uc3RhdHVzID09PSAnYWN0aXZlJykge1xuICAgICAgICBhYm9ydFNwZWN1bGF0aW9uKHNldEFwcFN0YXRlKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gRGlzbWlzcyBzaWRlIHF1ZXN0aW9uIHJlc3BvbnNlIGlmIHZpc2libGVcbiAgICAgIGlmIChpc1NpZGVRdWVzdGlvblZpc2libGUgJiYgb25EaXNtaXNzU2lkZVF1ZXN0aW9uKSB7XG4gICAgICAgIG9uRGlzbWlzc1NpZGVRdWVzdGlvbigpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBDbG9zZSBoZWxwIG1lbnUgaWYgb3BlblxuICAgICAgaWYgKGhlbHBPcGVuKSB7XG4gICAgICAgIHNldEhlbHBPcGVuKGZhbHNlKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gRm9vdGVyIHNlbGVjdGlvbiBjbGVhcmluZyBpcyBub3cgaGFuZGxlZCB2aWEgRm9vdGVyIGNvbnRleHQga2V5YmluZGluZ3NcbiAgICAgIC8vIChmb290ZXI6Y2xlYXJTZWxlY3Rpb24gYWN0aW9uIGJvdW5kIHRvIGVzY2FwZSlcbiAgICAgIC8vIElmIGEgZm9vdGVyIGl0ZW0gaXMgc2VsZWN0ZWQsIGxldCB0aGUgRm9vdGVyIGtleWJpbmRpbmcgaGFuZGxlIGl0XG4gICAgICBpZiAoZm9vdGVySXRlbVNlbGVjdGVkKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGVyZSdzIGFuIGVkaXRhYmxlIHF1ZXVlZCBjb21tYW5kLCBtb3ZlIGl0IHRvIHRoZSBpbnB1dCBmb3IgZWRpdGluZyB3aGVuIEVTQyBpcyBwcmVzc2VkXG4gICAgICBjb25zdCBoYXNFZGl0YWJsZUNvbW1hbmQgPSBxdWV1ZWRDb21tYW5kcy5zb21lKGlzUXVldWVkQ29tbWFuZEVkaXRhYmxlKVxuICAgICAgaWYgKGhhc0VkaXRhYmxlQ29tbWFuZCkge1xuICAgICAgICB2b2lkIHBvcEFsbENvbW1hbmRzRnJvbVF1ZXVlKClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGggPiAwICYmICFpbnB1dCAmJiAhaXNMb2FkaW5nKSB7XG4gICAgICAgIGRvdWJsZVByZXNzRXNjRnJvbUVtcHR5KClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoa2V5LnJldHVybiAmJiBoZWxwT3Blbikge1xuICAgICAgc2V0SGVscE9wZW4oZmFsc2UpXG4gICAgfVxuICB9KVxuXG4gIGNvbnN0IHN3YXJtQmFubmVyID0gdXNlU3dhcm1CYW5uZXIoKVxuXG4gIGNvbnN0IGZhc3RNb2RlQ29vbGRvd24gPSBpc0Zhc3RNb2RlRW5hYmxlZCgpID8gaXNGYXN0TW9kZUNvb2xkb3duKCkgOiBmYWxzZVxuICBjb25zdCBzaG93RmFzdEljb24gPSBpc0Zhc3RNb2RlRW5hYmxlZCgpXG4gICAgPyBpc0Zhc3RNb2RlICYmIChpc0Zhc3RNb2RlQXZhaWxhYmxlKCkgfHwgZmFzdE1vZGVDb29sZG93bilcbiAgICA6IGZhbHNlXG5cbiAgY29uc3Qgc2hvd0Zhc3RJY29uSGludCA9IHVzZVNob3dGYXN0SWNvbkhpbnQoc2hvd0Zhc3RJY29uID8/IGZhbHNlKVxuXG4gIC8vIFNob3cgZWZmb3J0IG5vdGlmaWNhdGlvbiBvbiBzdGFydHVwIGFuZCB3aGVuIGVmZm9ydCBjaGFuZ2VzLlxuICAvLyBTdXBwcmVzc2VkIGluIGJyaWVmL2Fzc2lzdGFudCBtb2RlIOKAlCB0aGUgdmFsdWUgcmVmbGVjdHMgdGhlIGxvY2FsXG4gIC8vIGNsaWVudCdzIGVmZm9ydCwgbm90IHRoZSBjb25uZWN0ZWQgYWdlbnQncy5cbiAgY29uc3QgZWZmb3J0Tm90aWZpY2F0aW9uVGV4dCA9IGJyaWVmT3duc0dhcFxuICAgID8gdW5kZWZpbmVkXG4gICAgOiBnZXRFZmZvcnROb3RpZmljYXRpb25UZXh0KGVmZm9ydFZhbHVlLCBtYWluTG9vcE1vZGVsKVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghZWZmb3J0Tm90aWZpY2F0aW9uVGV4dCkge1xuICAgICAgcmVtb3ZlTm90aWZpY2F0aW9uKCdlZmZvcnQtbGV2ZWwnKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGFkZE5vdGlmaWNhdGlvbih7XG4gICAgICBrZXk6ICdlZmZvcnQtbGV2ZWwnLFxuICAgICAgdGV4dDogZWZmb3J0Tm90aWZpY2F0aW9uVGV4dCxcbiAgICAgIHByaW9yaXR5OiAnaGlnaCcsXG4gICAgICB0aW1lb3V0TXM6IDEyXzAwMCxcbiAgICB9KVxuICB9LCBbZWZmb3J0Tm90aWZpY2F0aW9uVGV4dCwgYWRkTm90aWZpY2F0aW9uLCByZW1vdmVOb3RpZmljYXRpb25dKVxuXG4gIHVzZUJ1ZGR5Tm90aWZpY2F0aW9uKClcblxuICBjb25zdCBjb21wYW5pb25TcGVha2luZyA9IGZlYXR1cmUoJ0JVRERZJylcbiAgICA/IC8vIGJpb21lLWlnbm9yZSBsaW50L2NvcnJlY3RuZXNzL3VzZUhvb2tBdFRvcExldmVsOiBmZWF0dXJlKCkgaXMgYSBjb21waWxlLXRpbWUgY29uc3RhbnRcbiAgICAgIHVzZUFwcFN0YXRlKHMgPT4gcy5jb21wYW5pb25SZWFjdGlvbiAhPT0gdW5kZWZpbmVkKVxuICAgIDogZmFsc2VcbiAgY29uc3QgeyBjb2x1bW5zLCByb3dzIH0gPSB1c2VUZXJtaW5hbFNpemUoKVxuICBjb25zdCB0ZXh0SW5wdXRDb2x1bW5zID1cbiAgICBjb2x1bW5zIC0gMyAtIGNvbXBhbmlvblJlc2VydmVkQ29sdW1ucyhjb2x1bW5zLCBjb21wYW5pb25TcGVha2luZylcblxuICAvLyBQT0M6IGNsaWNrLXRvLXBvc2l0aW9uLWN1cnNvci4gTW91c2UgdHJhY2tpbmcgaXMgb25seSBlbmFibGVkIGluc2lkZVxuICAvLyA8QWx0ZXJuYXRlU2NyZWVuPiwgc28gdGhpcyBpcyBkb3JtYW50IGluIHRoZSBub3JtYWwgbWFpbi1zY3JlZW4gUkVQTC5cbiAgLy8gbG9jYWxDb2wvbG9jYWxSb3cgYXJlIHJlbGF0aXZlIHRvIHRoZSBvbkNsaWNrIEJveCdzIHRvcC1sZWZ0OyB0aGUgQm94XG4gIC8vIHRpZ2h0bHkgd3JhcHMgdGhlIHRleHQgaW5wdXQgc28gdGhleSBtYXAgZGlyZWN0bHkgdG8gKGNvbHVtbiwgbGluZSlcbiAgLy8gaW4gdGhlIEN1cnNvciB3cmFwIG1vZGVsLiBNZWFzdXJlZFRleHQuZ2V0T2Zmc2V0RnJvbVBvc2l0aW9uIGhhbmRsZXNcbiAgLy8gd2lkZSBjaGFycywgd3JhcHBlZCBsaW5lcywgYW5kIGNsYW1wcyBwYXN0LWVuZCBjbGlja3MgdG8gbGluZSBlbmQuXG4gIGNvbnN0IG1heFZpc2libGVMaW5lcyA9IGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKVxuICAgID8gTWF0aC5tYXgoXG4gICAgICAgIE1JTl9JTlBVVF9WSUVXUE9SVF9MSU5FUyxcbiAgICAgICAgTWF0aC5mbG9vcihyb3dzIC8gMikgLSBQUk9NUFRfRk9PVEVSX0xJTkVTLFxuICAgICAgKVxuICAgIDogdW5kZWZpbmVkXG5cbiAgY29uc3QgaGFuZGxlSW5wdXRDbGljayA9IHVzZUNhbGxiYWNrKFxuICAgIChlOiBDbGlja0V2ZW50KSA9PiB7XG4gICAgICAvLyBEdXJpbmcgaGlzdG9yeSBzZWFyY2ggdGhlIGRpc3BsYXllZCB0ZXh0IGlzIGhpc3RvcnlNYXRjaCwgbm90XG4gICAgICAvLyBpbnB1dCwgYW5kIHNob3dDdXJzb3IgaXMgZmFsc2UgYW55d2F5IOKAlCBza2lwIHJhdGhlciB0aGFuXG4gICAgICAvLyBjb21wdXRlIGFuIG9mZnNldCBhZ2FpbnN0IHRoZSB3cm9uZyBzdHJpbmcuXG4gICAgICBpZiAoIWlucHV0IHx8IGlzU2VhcmNoaW5nSGlzdG9yeSkgcmV0dXJuXG4gICAgICBjb25zdCBjID0gQ3Vyc29yLmZyb21UZXh0KGlucHV0LCB0ZXh0SW5wdXRDb2x1bW5zLCBjdXJzb3JPZmZzZXQpXG4gICAgICBjb25zdCB2aWV3cG9ydFN0YXJ0ID0gYy5nZXRWaWV3cG9ydFN0YXJ0TGluZShtYXhWaXNpYmxlTGluZXMpXG4gICAgICBjb25zdCBvZmZzZXQgPSBjLm1lYXN1cmVkVGV4dC5nZXRPZmZzZXRGcm9tUG9zaXRpb24oe1xuICAgICAgICBsaW5lOiBlLmxvY2FsUm93ICsgdmlld3BvcnRTdGFydCxcbiAgICAgICAgY29sdW1uOiBlLmxvY2FsQ29sLFxuICAgICAgfSlcbiAgICAgIHNldEN1cnNvck9mZnNldChvZmZzZXQpXG4gICAgfSxcbiAgICBbXG4gICAgICBpbnB1dCxcbiAgICAgIHRleHRJbnB1dENvbHVtbnMsXG4gICAgICBpc1NlYXJjaGluZ0hpc3RvcnksXG4gICAgICBjdXJzb3JPZmZzZXQsXG4gICAgICBtYXhWaXNpYmxlTGluZXMsXG4gICAgXSxcbiAgKVxuXG4gIGNvbnN0IGhhbmRsZU9wZW5UYXNrc0RpYWxvZyA9IHVzZUNhbGxiYWNrKFxuICAgICh0YXNrSWQ/OiBzdHJpbmcpID0+IHNldFNob3dCYXNoZXNEaWFsb2codGFza0lkID8/IHRydWUpLFxuICAgIFtzZXRTaG93QmFzaGVzRGlhbG9nXSxcbiAgKVxuXG4gIGNvbnN0IHBsYWNlaG9sZGVyID1cbiAgICBzaG93UHJvbXB0U3VnZ2VzdGlvbiAmJiBwcm9tcHRTdWdnZXN0aW9uXG4gICAgICA/IHByb21wdFN1Z2dlc3Rpb25cbiAgICAgIDogZGVmYXVsdFBsYWNlaG9sZGVyXG5cbiAgLy8gQ2FsY3VsYXRlIGlmIGlucHV0IGhhcyBtdWx0aXBsZSBsaW5lc1xuICBjb25zdCBpc0lucHV0V3JhcHBlZCA9IHVzZU1lbW8oKCkgPT4gaW5wdXQuaW5jbHVkZXMoJ1xcbicpLCBbaW5wdXRdKVxuXG4gIC8vIE1lbW9pemVkIGNhbGxiYWNrcyBmb3IgbW9kZWwgcGlja2VyIHRvIHByZXZlbnQgcmUtcmVuZGVycyB3aGVuIHVucmVsYXRlZFxuICAvLyBzdGF0ZSAobGlrZSBub3RpZmljYXRpb25zKSBjaGFuZ2VzLiBUaGlzIHByZXZlbnRzIHRoZSBpbmxpbmUgbW9kZWwgcGlja2VyXG4gIC8vIGZyb20gdmlzdWFsbHkgXCJqdW1waW5nXCIgd2hlbiBub3RpZmljYXRpb25zIGFycml2ZS5cbiAgY29uc3QgaGFuZGxlTW9kZWxTZWxlY3QgPSB1c2VDYWxsYmFjayhcbiAgICAobW9kZWw6IHN0cmluZyB8IG51bGwsIF9lZmZvcnQ6IEVmZm9ydExldmVsIHwgdW5kZWZpbmVkKSA9PiB7XG4gICAgICBsZXQgd2FzRmFzdE1vZGVEaXNhYmxlZCA9IGZhbHNlXG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgd2FzRmFzdE1vZGVEaXNhYmxlZCA9XG4gICAgICAgICAgaXNGYXN0TW9kZUVuYWJsZWQoKSAmJlxuICAgICAgICAgICFpc0Zhc3RNb2RlU3VwcG9ydGVkQnlNb2RlbChtb2RlbCkgJiZcbiAgICAgICAgICAhIXByZXYuZmFzdE1vZGVcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIG1haW5Mb29wTW9kZWw6IG1vZGVsLFxuICAgICAgICAgIG1haW5Mb29wTW9kZWxGb3JTZXNzaW9uOiBudWxsLFxuICAgICAgICAgIC8vIFR1cm4gb2ZmIGZhc3QgbW9kZSBpZiBzd2l0Y2hpbmcgdG8gYSBtb2RlbCB0aGF0IGRvZXNuJ3Qgc3VwcG9ydCBpdFxuICAgICAgICAgIC4uLih3YXNGYXN0TW9kZURpc2FibGVkICYmIHsgZmFzdE1vZGU6IGZhbHNlIH0pLFxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgc2V0U2hvd01vZGVsUGlja2VyKGZhbHNlKVxuICAgICAgY29uc3QgZWZmZWN0aXZlRmFzdE1vZGUgPSAoaXNGYXN0TW9kZSA/PyBmYWxzZSkgJiYgIXdhc0Zhc3RNb2RlRGlzYWJsZWRcbiAgICAgIGxldCBtZXNzYWdlID0gYE1vZGVsIHNldCB0byAke21vZGVsRGlzcGxheVN0cmluZyhtb2RlbCl9YFxuICAgICAgaWYgKFxuICAgICAgICBpc0JpbGxlZEFzRXh0cmFVc2FnZShtb2RlbCwgZWZmZWN0aXZlRmFzdE1vZGUsIGlzT3B1czFtTWVyZ2VFbmFibGVkKCkpXG4gICAgICApIHtcbiAgICAgICAgbWVzc2FnZSArPSAnIMK3IEJpbGxlZCBhcyBleHRyYSB1c2FnZSdcbiAgICAgIH1cbiAgICAgIGlmICh3YXNGYXN0TW9kZURpc2FibGVkKSB7XG4gICAgICAgIG1lc3NhZ2UgKz0gJyDCtyBGYXN0IG1vZGUgT0ZGJ1xuICAgICAgfVxuICAgICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgICAga2V5OiAnbW9kZWwtc3dpdGNoZWQnLFxuICAgICAgICBqc3g6IDxUZXh0PnttZXNzYWdlfTwvVGV4dD4sXG4gICAgICAgIHByaW9yaXR5OiAnaW1tZWRpYXRlJyxcbiAgICAgICAgdGltZW91dE1zOiAzMDAwLFxuICAgICAgfSlcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9tb2RlbF9waWNrZXJfaG90a2V5Jywge1xuICAgICAgICBtb2RlbDpcbiAgICAgICAgICBtb2RlbCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSlcbiAgICB9LFxuICAgIFtzZXRBcHBTdGF0ZSwgYWRkTm90aWZpY2F0aW9uLCBpc0Zhc3RNb2RlXSxcbiAgKVxuXG4gIGNvbnN0IGhhbmRsZU1vZGVsQ2FuY2VsID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldFNob3dNb2RlbFBpY2tlcihmYWxzZSlcbiAgfSwgW10pXG5cbiAgLy8gTWVtb2l6ZSB0aGUgbW9kZWwgcGlja2VyIGVsZW1lbnQgdG8gcHJldmVudCB1bm5lY2Vzc2FyeSByZS1yZW5kZXJzXG4gIC8vIHdoZW4gQXBwU3RhdGUgY2hhbmdlcyBmb3IgdW5yZWxhdGVkIHJlYXNvbnMgKGUuZy4sIG5vdGlmaWNhdGlvbnMgYXJyaXZpbmcpXG4gIGNvbnN0IG1vZGVsUGlja2VyRWxlbWVudCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGlmICghc2hvd01vZGVsUGlja2VyKSByZXR1cm4gbnVsbFxuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICA8TW9kZWxQaWNrZXJcbiAgICAgICAgICBpbml0aWFsPXttYWluTG9vcE1vZGVsX31cbiAgICAgICAgICBzZXNzaW9uTW9kZWw9e21haW5Mb29wTW9kZWxGb3JTZXNzaW9ufVxuICAgICAgICAgIG9uU2VsZWN0PXtoYW5kbGVNb2RlbFNlbGVjdH1cbiAgICAgICAgICBvbkNhbmNlbD17aGFuZGxlTW9kZWxDYW5jZWx9XG4gICAgICAgICAgaXNTdGFuZGFsb25lQ29tbWFuZFxuICAgICAgICAgIHNob3dGYXN0TW9kZU5vdGljZT17XG4gICAgICAgICAgICBpc0Zhc3RNb2RlRW5hYmxlZCgpICYmXG4gICAgICAgICAgICBpc0Zhc3RNb2RlICYmXG4gICAgICAgICAgICBpc0Zhc3RNb2RlU3VwcG9ydGVkQnlNb2RlbChtYWluTG9vcE1vZGVsXykgJiZcbiAgICAgICAgICAgIGlzRmFzdE1vZGVBdmFpbGFibGUoKVxuICAgICAgICAgIH1cbiAgICAgICAgLz5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfSwgW1xuICAgIHNob3dNb2RlbFBpY2tlcixcbiAgICBtYWluTG9vcE1vZGVsXyxcbiAgICBtYWluTG9vcE1vZGVsRm9yU2Vzc2lvbixcbiAgICBoYW5kbGVNb2RlbFNlbGVjdCxcbiAgICBoYW5kbGVNb2RlbENhbmNlbCxcbiAgXSlcblxuICBjb25zdCBoYW5kbGVGYXN0TW9kZVNlbGVjdCA9IHVzZUNhbGxiYWNrKFxuICAgIChyZXN1bHQ/OiBzdHJpbmcpID0+IHtcbiAgICAgIHNldFNob3dGYXN0TW9kZVBpY2tlcihmYWxzZSlcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgYWRkTm90aWZpY2F0aW9uKHtcbiAgICAgICAgICBrZXk6ICdmYXN0LW1vZGUtdG9nZ2xlZCcsXG4gICAgICAgICAganN4OiA8VGV4dD57cmVzdWx0fTwvVGV4dD4sXG4gICAgICAgICAgcHJpb3JpdHk6ICdpbW1lZGlhdGUnLFxuICAgICAgICAgIHRpbWVvdXRNczogMzAwMCxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9LFxuICAgIFthZGROb3RpZmljYXRpb25dLFxuICApXG5cbiAgLy8gTWVtb2l6ZSB0aGUgZmFzdCBtb2RlIHBpY2tlciBlbGVtZW50XG4gIGNvbnN0IGZhc3RNb2RlUGlja2VyRWxlbWVudCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGlmICghc2hvd0Zhc3RNb2RlUGlja2VyKSByZXR1cm4gbnVsbFxuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICA8RmFzdE1vZGVQaWNrZXJcbiAgICAgICAgICBvbkRvbmU9e2hhbmRsZUZhc3RNb2RlU2VsZWN0fVxuICAgICAgICAgIHVuYXZhaWxhYmxlUmVhc29uPXtnZXRGYXN0TW9kZVVuYXZhaWxhYmxlUmVhc29uKCl9XG4gICAgICAgIC8+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH0sIFtzaG93RmFzdE1vZGVQaWNrZXIsIGhhbmRsZUZhc3RNb2RlU2VsZWN0XSlcblxuICAvLyBNZW1vaXplZCBjYWxsYmFja3MgZm9yIHRoaW5raW5nIHRvZ2dsZVxuICBjb25zdCBoYW5kbGVUaGlua2luZ1NlbGVjdCA9IHVzZUNhbGxiYWNrKFxuICAgIChlbmFibGVkOiBib29sZWFuKSA9PiB7XG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgIC4uLnByZXYsXG4gICAgICAgIHRoaW5raW5nRW5hYmxlZDogZW5hYmxlZCxcbiAgICAgIH0pKVxuICAgICAgc2V0U2hvd1RoaW5raW5nVG9nZ2xlKGZhbHNlKVxuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3RoaW5raW5nX3RvZ2dsZWRfaG90a2V5JywgeyBlbmFibGVkIH0pXG4gICAgICBhZGROb3RpZmljYXRpb24oe1xuICAgICAgICBrZXk6ICd0aGlua2luZy10b2dnbGVkLWhvdGtleScsXG4gICAgICAgIGpzeDogKFxuICAgICAgICAgIDxUZXh0IGNvbG9yPXtlbmFibGVkID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfSBkaW1Db2xvcj17IWVuYWJsZWR9PlxuICAgICAgICAgICAgVGhpbmtpbmcge2VuYWJsZWQgPyAnb24nIDogJ29mZid9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICApLFxuICAgICAgICBwcmlvcml0eTogJ2ltbWVkaWF0ZScsXG4gICAgICAgIHRpbWVvdXRNczogMzAwMCxcbiAgICAgIH0pXG4gICAgfSxcbiAgICBbc2V0QXBwU3RhdGUsIGFkZE5vdGlmaWNhdGlvbl0sXG4gIClcblxuICBjb25zdCBoYW5kbGVUaGlua2luZ0NhbmNlbCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRTaG93VGhpbmtpbmdUb2dnbGUoZmFsc2UpXG4gIH0sIFtdKVxuXG4gIC8vIE1lbW9pemUgdGhlIHRoaW5raW5nIHRvZ2dsZSBlbGVtZW50XG4gIGNvbnN0IHRoaW5raW5nVG9nZ2xlRWxlbWVudCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGlmICghc2hvd1RoaW5raW5nVG9nZ2xlKSByZXR1cm4gbnVsbFxuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICA8VGhpbmtpbmdUb2dnbGVcbiAgICAgICAgICBjdXJyZW50VmFsdWU9e3RoaW5raW5nRW5hYmxlZCA/PyB0cnVlfVxuICAgICAgICAgIG9uU2VsZWN0PXtoYW5kbGVUaGlua2luZ1NlbGVjdH1cbiAgICAgICAgICBvbkNhbmNlbD17aGFuZGxlVGhpbmtpbmdDYW5jZWx9XG4gICAgICAgICAgaXNNaWRDb252ZXJzYXRpb249e21lc3NhZ2VzLnNvbWUobSA9PiBtLnR5cGUgPT09ICdhc3Npc3RhbnQnKX1cbiAgICAgICAgLz5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfSwgW1xuICAgIHNob3dUaGlua2luZ1RvZ2dsZSxcbiAgICB0aGlua2luZ0VuYWJsZWQsXG4gICAgaGFuZGxlVGhpbmtpbmdTZWxlY3QsXG4gICAgaGFuZGxlVGhpbmtpbmdDYW5jZWwsXG4gICAgbWVzc2FnZXMubGVuZ3RoLFxuICBdKVxuXG4gIC8vIFBvcnRhbCBkaWFsb2cgdG8gRGlhbG9nT3ZlcmxheSBpbiBmdWxsc2NyZWVuIHNvIGl0IGVzY2FwZXMgdGhlIGJvdHRvbVxuICAvLyBzbG90J3Mgb3ZlcmZsb3dZOmhpZGRlbiBjbGlwIChzYW1lIHBhdHRlcm4gYXMgU3VnZ2VzdGlvbnNPdmVybGF5KS5cbiAgLy8gTXVzdCBiZSBjYWxsZWQgYmVmb3JlIGVhcmx5IHJldHVybnMgYmVsb3cgdG8gc2F0aXNmeSBydWxlcy1vZi1ob29rcy5cbiAgLy8gTWVtb2l6ZWQgc28gdGhlIHBvcnRhbCB1c2VFZmZlY3QgZG9lc24ndCBjaHVybiBvbiBldmVyeSBQcm9tcHRJbnB1dCByZW5kZXIuXG4gIGNvbnN0IGF1dG9Nb2RlT3B0SW5EaWFsb2cgPSB1c2VNZW1vKFxuICAgICgpID0+XG4gICAgICBmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSAmJiBzaG93QXV0b01vZGVPcHRJbiA/IChcbiAgICAgICAgPEF1dG9Nb2RlT3B0SW5EaWFsb2dcbiAgICAgICAgICBvbkFjY2VwdD17aGFuZGxlQXV0b01vZGVPcHRJbkFjY2VwdH1cbiAgICAgICAgICBvbkRlY2xpbmU9e2hhbmRsZUF1dG9Nb2RlT3B0SW5EZWNsaW5lfVxuICAgICAgICAvPlxuICAgICAgKSA6IG51bGwsXG4gICAgW3Nob3dBdXRvTW9kZU9wdEluLCBoYW5kbGVBdXRvTW9kZU9wdEluQWNjZXB0LCBoYW5kbGVBdXRvTW9kZU9wdEluRGVjbGluZV0sXG4gIClcbiAgdXNlU2V0UHJvbXB0T3ZlcmxheURpYWxvZyhcbiAgICBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgPyBhdXRvTW9kZU9wdEluRGlhbG9nIDogbnVsbCxcbiAgKVxuXG4gIGlmIChzaG93QmFzaGVzRGlhbG9nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxCYWNrZ3JvdW5kVGFza3NEaWFsb2dcbiAgICAgICAgb25Eb25lPXsoKSA9PiBzZXRTaG93QmFzaGVzRGlhbG9nKGZhbHNlKX1cbiAgICAgICAgdG9vbFVzZUNvbnRleHQ9e2dldFRvb2xVc2VDb250ZXh0KFxuICAgICAgICAgIG1lc3NhZ2VzLFxuICAgICAgICAgIFtdLFxuICAgICAgICAgIG5ldyBBYm9ydENvbnRyb2xsZXIoKSxcbiAgICAgICAgICBtYWluTG9vcE1vZGVsLFxuICAgICAgICApfVxuICAgICAgICBpbml0aWFsRGV0YWlsVGFza0lkPXtcbiAgICAgICAgICB0eXBlb2Ygc2hvd0Jhc2hlc0RpYWxvZyA9PT0gJ3N0cmluZycgPyBzaG93QmFzaGVzRGlhbG9nIDogdW5kZWZpbmVkXG4gICAgICAgIH1cbiAgICAgIC8+XG4gICAgKVxuICB9XG5cbiAgaWYgKGlzQWdlbnRTd2FybXNFbmFibGVkKCkgJiYgc2hvd1RlYW1zRGlhbG9nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxUZWFtc0RpYWxvZ1xuICAgICAgICBpbml0aWFsVGVhbXM9e2NhY2hlZFRlYW1zfVxuICAgICAgICBvbkRvbmU9eygpID0+IHtcbiAgICAgICAgICBzZXRTaG93VGVhbXNEaWFsb2coZmFsc2UpXG4gICAgICAgIH19XG4gICAgICAvPlxuICAgIClcbiAgfVxuXG4gIGlmIChmZWF0dXJlKCdRVUlDS19TRUFSQ0gnKSkge1xuICAgIGNvbnN0IGluc2VydFdpdGhTcGFjaW5nID0gKHRleHQ6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgY3Vyc29yQ2hhciA9IGlucHV0W2N1cnNvck9mZnNldCAtIDFdID8/ICcgJ1xuICAgICAgaW5zZXJ0VGV4dEF0Q3Vyc29yKC9cXHMvLnRlc3QoY3Vyc29yQ2hhcikgPyB0ZXh0IDogYCAke3RleHR9YClcbiAgICB9XG4gICAgaWYgKHNob3dRdWlja09wZW4pIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxRdWlja09wZW5EaWFsb2dcbiAgICAgICAgICBvbkRvbmU9eygpID0+IHNldFNob3dRdWlja09wZW4oZmFsc2UpfVxuICAgICAgICAgIG9uSW5zZXJ0PXtpbnNlcnRXaXRoU3BhY2luZ31cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICB9XG4gICAgaWYgKHNob3dHbG9iYWxTZWFyY2gpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxHbG9iYWxTZWFyY2hEaWFsb2dcbiAgICAgICAgICBvbkRvbmU9eygpID0+IHNldFNob3dHbG9iYWxTZWFyY2goZmFsc2UpfVxuICAgICAgICAgIG9uSW5zZXJ0PXtpbnNlcnRXaXRoU3BhY2luZ31cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICB9XG4gIH1cblxuICBpZiAoZmVhdHVyZSgnSElTVE9SWV9QSUNLRVInKSAmJiBzaG93SGlzdG9yeVBpY2tlcikge1xuICAgIHJldHVybiAoXG4gICAgICA8SGlzdG9yeVNlYXJjaERpYWxvZ1xuICAgICAgICBpbml0aWFsUXVlcnk9e2lucHV0fVxuICAgICAgICBvblNlbGVjdD17ZW50cnkgPT4ge1xuICAgICAgICAgIGNvbnN0IGVudHJ5TW9kZSA9IGdldE1vZGVGcm9tSW5wdXQoZW50cnkuZGlzcGxheSlcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGdldFZhbHVlRnJvbUlucHV0KGVudHJ5LmRpc3BsYXkpXG4gICAgICAgICAgb25Nb2RlQ2hhbmdlKGVudHJ5TW9kZSlcbiAgICAgICAgICB0cmFja0FuZFNldElucHV0KHZhbHVlKVxuICAgICAgICAgIHNldFBhc3RlZENvbnRlbnRzKGVudHJ5LnBhc3RlZENvbnRlbnRzKVxuICAgICAgICAgIHNldEN1cnNvck9mZnNldCh2YWx1ZS5sZW5ndGgpXG4gICAgICAgICAgc2V0U2hvd0hpc3RvcnlQaWNrZXIoZmFsc2UpXG4gICAgICAgIH19XG4gICAgICAgIG9uQ2FuY2VsPXsoKSA9PiBzZXRTaG93SGlzdG9yeVBpY2tlcihmYWxzZSl9XG4gICAgICAvPlxuICAgIClcbiAgfVxuXG4gIC8vIFNob3cgbG9vcCBtb2RlIG1lbnUgd2hlbiByZXF1ZXN0ZWQgKGFudC1vbmx5LCBlbGltaW5hdGVkIGZyb20gZXh0ZXJuYWwgYnVpbGRzKVxuICBpZiAobW9kZWxQaWNrZXJFbGVtZW50KSB7XG4gICAgcmV0dXJuIG1vZGVsUGlja2VyRWxlbWVudFxuICB9XG5cbiAgaWYgKGZhc3RNb2RlUGlja2VyRWxlbWVudCkge1xuICAgIHJldHVybiBmYXN0TW9kZVBpY2tlckVsZW1lbnRcbiAgfVxuXG4gIGlmICh0aGlua2luZ1RvZ2dsZUVsZW1lbnQpIHtcbiAgICByZXR1cm4gdGhpbmtpbmdUb2dnbGVFbGVtZW50XG4gIH1cblxuICBpZiAoc2hvd0JyaWRnZURpYWxvZykge1xuICAgIHJldHVybiAoXG4gICAgICA8QnJpZGdlRGlhbG9nXG4gICAgICAgIG9uRG9uZT17KCkgPT4ge1xuICAgICAgICAgIHNldFNob3dCcmlkZ2VEaWFsb2coZmFsc2UpXG4gICAgICAgICAgc2VsZWN0Rm9vdGVySXRlbShudWxsKVxuICAgICAgICB9fVxuICAgICAgLz5cbiAgICApXG4gIH1cblxuICBjb25zdCBiYXNlUHJvcHM6IEJhc2VUZXh0SW5wdXRQcm9wcyA9IHtcbiAgICBtdWx0aWxpbmU6IHRydWUsXG4gICAgb25TdWJtaXQsXG4gICAgb25DaGFuZ2UsXG4gICAgdmFsdWU6IGhpc3RvcnlNYXRjaFxuICAgICAgPyBnZXRWYWx1ZUZyb21JbnB1dChcbiAgICAgICAgICB0eXBlb2YgaGlzdG9yeU1hdGNoID09PSAnc3RyaW5nJ1xuICAgICAgICAgICAgPyBoaXN0b3J5TWF0Y2hcbiAgICAgICAgICAgIDogaGlzdG9yeU1hdGNoLmRpc3BsYXksXG4gICAgICAgIClcbiAgICAgIDogaW5wdXQsXG4gICAgLy8gSGlzdG9yeSBuYXZpZ2F0aW9uIGlzIGhhbmRsZWQgdmlhIFRleHRJbnB1dCBwcm9wcyAob25IaXN0b3J5VXAvb25IaXN0b3J5RG93biksXG4gICAgLy8gTk9UIHZpYSB1c2VLZXliaW5kaW5ncy4gVGhpcyBhbGxvd3MgdXNlVGV4dElucHV0J3MgdXBPckhpc3RvcnlVcC9kb3duT3JIaXN0b3J5RG93blxuICAgIC8vIHRvIHRyeSBjdXJzb3IgbW92ZW1lbnQgZmlyc3QgYW5kIG9ubHkgZmFsbCB0aHJvdWdoIHRvIGhpc3RvcnkgbmF2aWdhdGlvbiB3aGVuIHRoZVxuICAgIC8vIGN1cnNvciBjYW4ndCBtb3ZlIGZ1cnRoZXIgKGltcG9ydGFudCBmb3Igd3JhcHBlZCB0ZXh0IGFuZCBtdWx0aS1saW5lIGlucHV0KS5cbiAgICBvbkhpc3RvcnlVcDogaGFuZGxlSGlzdG9yeVVwLFxuICAgIG9uSGlzdG9yeURvd246IGhhbmRsZUhpc3RvcnlEb3duLFxuICAgIG9uSGlzdG9yeVJlc2V0OiByZXNldEhpc3RvcnksXG4gICAgcGxhY2Vob2xkZXIsXG4gICAgb25FeGl0LFxuICAgIG9uRXhpdE1lc3NhZ2U6IChzaG93LCBrZXkpID0+IHNldEV4aXRNZXNzYWdlKHsgc2hvdywga2V5IH0pLFxuICAgIG9uSW1hZ2VQYXN0ZSxcbiAgICBjb2x1bW5zOiB0ZXh0SW5wdXRDb2x1bW5zLFxuICAgIG1heFZpc2libGVMaW5lcyxcbiAgICBkaXNhYmxlQ3Vyc29yTW92ZW1lbnRGb3JVcERvd25LZXlzOlxuICAgICAgc3VnZ2VzdGlvbnMubGVuZ3RoID4gMCB8fCAhIWZvb3Rlckl0ZW1TZWxlY3RlZCxcbiAgICBkaXNhYmxlRXNjYXBlRG91YmxlUHJlc3M6IHN1Z2dlc3Rpb25zLmxlbmd0aCA+IDAsXG4gICAgY3Vyc29yT2Zmc2V0LFxuICAgIG9uQ2hhbmdlQ3Vyc29yT2Zmc2V0OiBzZXRDdXJzb3JPZmZzZXQsXG4gICAgb25QYXN0ZTogb25UZXh0UGFzdGUsXG4gICAgb25Jc1Bhc3RpbmdDaGFuZ2U6IHNldElzUGFzdGluZyxcbiAgICBmb2N1czogIWlzU2VhcmNoaW5nSGlzdG9yeSAmJiAhaXNNb2RhbE92ZXJsYXlBY3RpdmUgJiYgIWZvb3Rlckl0ZW1TZWxlY3RlZCxcbiAgICBzaG93Q3Vyc29yOlxuICAgICAgIWZvb3Rlckl0ZW1TZWxlY3RlZCAmJiAhaXNTZWFyY2hpbmdIaXN0b3J5ICYmICFjdXJzb3JBdEltYWdlQ2hpcCxcbiAgICBhcmd1bWVudEhpbnQ6IGNvbW1hbmRBcmd1bWVudEhpbnQsXG4gICAgb25VbmRvOiBjYW5VbmRvXG4gICAgICA/ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBwcmV2aW91c1N0YXRlID0gdW5kbygpXG4gICAgICAgICAgaWYgKHByZXZpb3VzU3RhdGUpIHtcbiAgICAgICAgICAgIHRyYWNrQW5kU2V0SW5wdXQocHJldmlvdXNTdGF0ZS50ZXh0KVxuICAgICAgICAgICAgc2V0Q3Vyc29yT2Zmc2V0KHByZXZpb3VzU3RhdGUuY3Vyc29yT2Zmc2V0KVxuICAgICAgICAgICAgc2V0UGFzdGVkQ29udGVudHMocHJldmlvdXNTdGF0ZS5wYXN0ZWRDb250ZW50cylcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIDogdW5kZWZpbmVkLFxuICAgIGhpZ2hsaWdodHM6IGNvbWJpbmVkSGlnaGxpZ2h0cyxcbiAgICBpbmxpbmVHaG9zdFRleHQsXG4gICAgaW5wdXRGaWx0ZXI6IGxhenlTcGFjZUlucHV0RmlsdGVyLFxuICB9XG5cbiAgY29uc3QgZ2V0Qm9yZGVyQ29sb3IgPSAoKToga2V5b2YgVGhlbWUgPT4ge1xuICAgIGNvbnN0IG1vZGVDb2xvcnM6IFJlY29yZDxzdHJpbmcsIGtleW9mIFRoZW1lPiA9IHtcbiAgICAgIGJhc2g6ICdiYXNoQm9yZGVyJyxcbiAgICB9XG5cbiAgICAvLyBNb2RlIGNvbG9ycyB0YWtlIHByaW9yaXR5LCB0aGVuIHRlYW1tYXRlIGNvbG9yLCB0aGVuIGRlZmF1bHRcbiAgICBpZiAobW9kZUNvbG9yc1ttb2RlXSkge1xuICAgICAgcmV0dXJuIG1vZGVDb2xvcnNbbW9kZV1cbiAgICB9XG5cbiAgICAvLyBJbi1wcm9jZXNzIHRlYW1tYXRlcyBydW4gaGVhZGxlc3MgLSBkb24ndCBhcHBseSB0ZWFtbWF0ZSBjb2xvcnMgdG8gbGVhZGVyIFVJXG4gICAgaWYgKGlzSW5Qcm9jZXNzVGVhbW1hdGUoKSkge1xuICAgICAgcmV0dXJuICdwcm9tcHRCb3JkZXInXG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZm9yIHRlYW1tYXRlIGNvbG9yIGZyb20gZW52aXJvbm1lbnRcbiAgICBjb25zdCB0ZWFtbWF0ZUNvbG9yTmFtZSA9IGdldFRlYW1tYXRlQ29sb3IoKVxuICAgIGlmIChcbiAgICAgIHRlYW1tYXRlQ29sb3JOYW1lICYmXG4gICAgICBBR0VOVF9DT0xPUlMuaW5jbHVkZXModGVhbW1hdGVDb2xvck5hbWUgYXMgQWdlbnRDb2xvck5hbWUpXG4gICAgKSB7XG4gICAgICByZXR1cm4gQUdFTlRfQ09MT1JfVE9fVEhFTUVfQ09MT1JbdGVhbW1hdGVDb2xvck5hbWUgYXMgQWdlbnRDb2xvck5hbWVdXG4gICAgfVxuXG4gICAgcmV0dXJuICdwcm9tcHRCb3JkZXInXG4gIH1cblxuICBpZiAoaXNFeHRlcm5hbEVkaXRvckFjdGl2ZSkge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94XG4gICAgICAgIGZsZXhEaXJlY3Rpb249XCJyb3dcIlxuICAgICAgICBhbGlnbkl0ZW1zPVwiY2VudGVyXCJcbiAgICAgICAganVzdGlmeUNvbnRlbnQ9XCJjZW50ZXJcIlxuICAgICAgICBib3JkZXJDb2xvcj17Z2V0Qm9yZGVyQ29sb3IoKX1cbiAgICAgICAgYm9yZGVyU3R5bGU9XCJyb3VuZFwiXG4gICAgICAgIGJvcmRlckxlZnQ9e2ZhbHNlfVxuICAgICAgICBib3JkZXJSaWdodD17ZmFsc2V9XG4gICAgICAgIGJvcmRlckJvdHRvbVxuICAgICAgICB3aWR0aD1cIjEwMCVcIlxuICAgICAgPlxuICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgU2F2ZSBhbmQgY2xvc2UgZWRpdG9yIHRvIGNvbnRpbnVlLi4uXG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIGNvbnN0IHRleHRJbnB1dEVsZW1lbnQgPSBpc1ZpbU1vZGVFbmFibGVkKCkgPyAoXG4gICAgPFZpbVRleHRJbnB1dFxuICAgICAgey4uLmJhc2VQcm9wc31cbiAgICAgIGluaXRpYWxNb2RlPXt2aW1Nb2RlfVxuICAgICAgb25Nb2RlQ2hhbmdlPXtzZXRWaW1Nb2RlfVxuICAgIC8+XG4gICkgOiAoXG4gICAgPFRleHRJbnB1dCB7Li4uYmFzZVByb3BzfSAvPlxuICApXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9e2JyaWVmT3duc0dhcCA/IDAgOiAxfT5cbiAgICAgIHshaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpICYmIDxQcm9tcHRJbnB1dFF1ZXVlZENvbW1hbmRzIC8+fVxuICAgICAge2hhc1N1cHByZXNzZWREaWFsb2dzICYmIChcbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9IG1hcmdpbkxlZnQ9ezJ9PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPldhaXRpbmcgZm9yIHBlcm1pc3Npb27igKY8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIDxQcm9tcHRJbnB1dFN0YXNoTm90aWNlIGhhc1N0YXNoPXtzdGFzaGVkUHJvbXB0ICE9PSB1bmRlZmluZWR9IC8+XG4gICAgICB7c3dhcm1CYW5uZXIgPyAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPFRleHQgY29sb3I9e3N3YXJtQmFubmVyLmJnQ29sb3J9PlxuICAgICAgICAgICAge3N3YXJtQmFubmVyLnRleHQgPyAoXG4gICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgeyfilIAnLnJlcGVhdChcbiAgICAgICAgICAgICAgICAgIE1hdGgubWF4KDAsIGNvbHVtbnMgLSBzdHJpbmdXaWR0aChzd2FybUJhbm5lci50ZXh0KSAtIDQpLFxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPFRleHQgYmFja2dyb3VuZENvbG9yPXtzd2FybUJhbm5lci5iZ0NvbG9yfSBjb2xvcj1cImludmVyc2VUZXh0XCI+XG4gICAgICAgICAgICAgICAgICB7JyAnfVxuICAgICAgICAgICAgICAgICAge3N3YXJtQmFubmVyLnRleHR9eycgJ31cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgeyfilIDilIAnfVxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICfilIAnLnJlcGVhdChjb2x1bW5zKVxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgd2lkdGg9XCIxMDAlXCI+XG4gICAgICAgICAgICA8UHJvbXB0SW5wdXRNb2RlSW5kaWNhdG9yXG4gICAgICAgICAgICAgIG1vZGU9e21vZGV9XG4gICAgICAgICAgICAgIGlzTG9hZGluZz17aXNMb2FkaW5nfVxuICAgICAgICAgICAgICB2aWV3aW5nQWdlbnROYW1lPXt2aWV3aW5nQWdlbnROYW1lfVxuICAgICAgICAgICAgICB2aWV3aW5nQWdlbnRDb2xvcj17dmlld2luZ0FnZW50Q29sb3J9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAgPEJveCBmbGV4R3Jvdz17MX0gZmxleFNocmluaz17MX0gb25DbGljaz17aGFuZGxlSW5wdXRDbGlja30+XG4gICAgICAgICAgICAgIHt0ZXh0SW5wdXRFbGVtZW50fVxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPFRleHQgY29sb3I9e3N3YXJtQmFubmVyLmJnQ29sb3J9Pnsn4pSAJy5yZXBlYXQoY29sdW1ucyl9PC9UZXh0PlxuICAgICAgICA8Lz5cbiAgICAgICkgOiAoXG4gICAgICAgIDxCb3hcbiAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwicm93XCJcbiAgICAgICAgICBhbGlnbkl0ZW1zPVwiZmxleC1zdGFydFwiXG4gICAgICAgICAganVzdGlmeUNvbnRlbnQ9XCJmbGV4LXN0YXJ0XCJcbiAgICAgICAgICBib3JkZXJDb2xvcj17Z2V0Qm9yZGVyQ29sb3IoKX1cbiAgICAgICAgICBib3JkZXJTdHlsZT1cInJvdW5kXCJcbiAgICAgICAgICBib3JkZXJMZWZ0PXtmYWxzZX1cbiAgICAgICAgICBib3JkZXJSaWdodD17ZmFsc2V9XG4gICAgICAgICAgYm9yZGVyQm90dG9tXG4gICAgICAgICAgd2lkdGg9XCIxMDAlXCJcbiAgICAgICAgICBib3JkZXJUZXh0PXtidWlsZEJvcmRlclRleHQoXG4gICAgICAgICAgICBzaG93RmFzdEljb24gPz8gZmFsc2UsXG4gICAgICAgICAgICBzaG93RmFzdEljb25IaW50LFxuICAgICAgICAgICAgZmFzdE1vZGVDb29sZG93bixcbiAgICAgICAgICApfVxuICAgICAgICA+XG4gICAgICAgICAgPFByb21wdElucHV0TW9kZUluZGljYXRvclxuICAgICAgICAgICAgbW9kZT17bW9kZX1cbiAgICAgICAgICAgIGlzTG9hZGluZz17aXNMb2FkaW5nfVxuICAgICAgICAgICAgdmlld2luZ0FnZW50TmFtZT17dmlld2luZ0FnZW50TmFtZX1cbiAgICAgICAgICAgIHZpZXdpbmdBZ2VudENvbG9yPXt2aWV3aW5nQWdlbnRDb2xvcn1cbiAgICAgICAgICAvPlxuICAgICAgICAgIDxCb3ggZmxleEdyb3c9ezF9IGZsZXhTaHJpbms9ezF9IG9uQ2xpY2s9e2hhbmRsZUlucHV0Q2xpY2t9PlxuICAgICAgICAgICAge3RleHRJbnB1dEVsZW1lbnR9XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIDxQcm9tcHRJbnB1dEZvb3RlclxuICAgICAgICBhcGlLZXlTdGF0dXM9e2FwaUtleVN0YXR1c31cbiAgICAgICAgZGVidWc9e2RlYnVnfVxuICAgICAgICBleGl0TWVzc2FnZT17ZXhpdE1lc3NhZ2V9XG4gICAgICAgIHZpbU1vZGU9e2lzVmltTW9kZUVuYWJsZWQoKSA/IHZpbU1vZGUgOiB1bmRlZmluZWR9XG4gICAgICAgIG1vZGU9e21vZGV9XG4gICAgICAgIGF1dG9VcGRhdGVyUmVzdWx0PXthdXRvVXBkYXRlclJlc3VsdH1cbiAgICAgICAgaXNBdXRvVXBkYXRpbmc9e2lzQXV0b1VwZGF0aW5nfVxuICAgICAgICB2ZXJib3NlPXt2ZXJib3NlfVxuICAgICAgICBvbkF1dG9VcGRhdGVyUmVzdWx0PXtvbkF1dG9VcGRhdGVyUmVzdWx0fVxuICAgICAgICBvbkNoYW5nZUlzVXBkYXRpbmc9e3NldElzQXV0b1VwZGF0aW5nfVxuICAgICAgICBzdWdnZXN0aW9ucz17c3VnZ2VzdGlvbnN9XG4gICAgICAgIHNlbGVjdGVkU3VnZ2VzdGlvbj17c2VsZWN0ZWRTdWdnZXN0aW9ufVxuICAgICAgICBtYXhDb2x1bW5XaWR0aD17bWF4Q29sdW1uV2lkdGh9XG4gICAgICAgIHRvb2xQZXJtaXNzaW9uQ29udGV4dD17ZWZmZWN0aXZlVG9vbFBlcm1pc3Npb25Db250ZXh0fVxuICAgICAgICBoZWxwT3Blbj17aGVscE9wZW59XG4gICAgICAgIHN1cHByZXNzSGludD17aW5wdXQubGVuZ3RoID4gMH1cbiAgICAgICAgaXNMb2FkaW5nPXtpc0xvYWRpbmd9XG4gICAgICAgIHRhc2tzU2VsZWN0ZWQ9e3Rhc2tzU2VsZWN0ZWR9XG4gICAgICAgIHRlYW1zU2VsZWN0ZWQ9e3RlYW1zU2VsZWN0ZWR9XG4gICAgICAgIGJyaWRnZVNlbGVjdGVkPXticmlkZ2VTZWxlY3RlZH1cbiAgICAgICAgdG11eFNlbGVjdGVkPXt0bXV4U2VsZWN0ZWR9XG4gICAgICAgIHRlYW1tYXRlRm9vdGVySW5kZXg9e3RlYW1tYXRlRm9vdGVySW5kZXh9XG4gICAgICAgIGlkZVNlbGVjdGlvbj17aWRlU2VsZWN0aW9ufVxuICAgICAgICBtY3BDbGllbnRzPXttY3BDbGllbnRzfVxuICAgICAgICBpc1Bhc3Rpbmc9e2lzUGFzdGluZ31cbiAgICAgICAgaXNJbnB1dFdyYXBwZWQ9e2lzSW5wdXRXcmFwcGVkfVxuICAgICAgICBtZXNzYWdlcz17bWVzc2FnZXN9XG4gICAgICAgIGlzU2VhcmNoaW5nPXtpc1NlYXJjaGluZ0hpc3Rvcnl9XG4gICAgICAgIGhpc3RvcnlRdWVyeT17aGlzdG9yeVF1ZXJ5fVxuICAgICAgICBzZXRIaXN0b3J5UXVlcnk9e3NldEhpc3RvcnlRdWVyeX1cbiAgICAgICAgaGlzdG9yeUZhaWxlZE1hdGNoPXtoaXN0b3J5RmFpbGVkTWF0Y2h9XG4gICAgICAgIG9uT3BlblRhc2tzRGlhbG9nPXtcbiAgICAgICAgICBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgPyBoYW5kbGVPcGVuVGFza3NEaWFsb2cgOiB1bmRlZmluZWRcbiAgICAgICAgfVxuICAgICAgLz5cbiAgICAgIHtpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgPyBudWxsIDogYXV0b01vZGVPcHRJbkRpYWxvZ31cbiAgICAgIHtpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgPyAoXG4gICAgICAgIC8vIHBvc2l0aW9uPWFic29sdXRlIHRha2VzIHplcm8gbGF5b3V0IGhlaWdodCBzbyB0aGUgc3Bpbm5lclxuICAgICAgICAvLyBkb2Vzbid0IHNoaWZ0IHdoZW4gYSBub3RpZmljYXRpb24gYXBwZWFycy9kaXNhcHBlYXJzLiBZb2dhXG4gICAgICAgIC8vIGFuY2hvcnMgYWJzb2x1dGUgY2hpbGRyZW4gYXQgdGhlIHBhcmVudCdzIGNvbnRlbnQtYm94IG9yaWdpbjtcbiAgICAgICAgLy8gbWFyZ2luVG9wPS0xIHB1bGxzIGl0IGludG8gdGhlIG1hcmdpblRvcD0xIGdhcCByb3cgYWJvdmUgdGhlXG4gICAgICAgIC8vIHByb21wdCBib3JkZXIuIEluIGJyaWVmIG1vZGUgdGhlcmUgaXMgbm8gc3VjaCBnYXAgKGJyaWVmT3duc0dhcFxuICAgICAgICAvLyBzdHJpcHMgb3VyIG1hcmdpblRvcCkgYW5kIEJyaWVmU3Bpbm5lciBzaXRzIGZsdXNoIGFnYWluc3QgdGhlXG4gICAgICAgIC8vIGJvcmRlciDigJQgbWFyZ2luVG9wPS0yIHNraXBzIG92ZXIgdGhlIHNwaW5uZXIgY29udGVudCBpbnRvXG4gICAgICAgIC8vIEJyaWVmU3Bpbm5lcidzIG93biBtYXJnaW5Ub3A9MSBibGFuayByb3cuIGhlaWdodD0xICtcbiAgICAgICAgLy8gb3ZlcmZsb3c9aGlkZGVuIGNsaXBzIG11bHRpLWxpbmUgbm90aWZpY2F0aW9ucyB0byBhIHNpbmdsZSByb3cuXG4gICAgICAgIC8vIGZsZXgtZW5kIGFuY2hvcnMgdGhlIGJvdHRvbSBsaW5lIHNvIHRoZSB2aXNpYmxlIHJvdyBpcyBhbHdheXNcbiAgICAgICAgLy8gdGhlIG1vc3QgcmVjZW50LiBTdXBwcmVzc2VkIHdoaWxlIHRoZSBzbGFzaCBvdmVybGF5IG9yXG4gICAgICAgIC8vIGF1dG8tbW9kZSBvcHQtaW4gZGlhbG9nIGlzIHVwIGJ5IGhlaWdodD0wIChOT1QgdW5tb3VudCkg4oCUIHRoaXNcbiAgICAgICAgLy8gQm94IHJlbmRlcnMgbGF0ZXIgaW4gdHJlZSBvcmRlciBzbyBpdCB3b3VsZCBwYWludCBvdmVyIHRoZWlyXG4gICAgICAgIC8vIGJvdHRvbSByb3cuIEtlZXBpbmcgTm90aWZpY2F0aW9ucyBtb3VudGVkIHByZXZlbnRzIEF1dG9VcGRhdGVyJ3NcbiAgICAgICAgLy8gaW5pdGlhbC1jaGVjayBlZmZlY3QgZnJvbSByZS1maXJpbmcgb24gZXZlcnkgc2xhc2gtY29tcGxldGlvblxuICAgICAgICAvLyB0b2dnbGUgKFBSIzIyNDEzKS5cbiAgICAgICAgPEJveFxuICAgICAgICAgIHBvc2l0aW9uPVwiYWJzb2x1dGVcIlxuICAgICAgICAgIG1hcmdpblRvcD17YnJpZWZPd25zR2FwID8gLTIgOiAtMX1cbiAgICAgICAgICBoZWlnaHQ9e3N1Z2dlc3Rpb25zLmxlbmd0aCA9PT0gMCAmJiAhc2hvd0F1dG9Nb2RlT3B0SW4gPyAxIDogMH1cbiAgICAgICAgICB3aWR0aD1cIjEwMCVcIlxuICAgICAgICAgIHBhZGRpbmdMZWZ0PXsyfVxuICAgICAgICAgIHBhZGRpbmdSaWdodD17MX1cbiAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudD1cImZsZXgtZW5kXCJcbiAgICAgICAgICBvdmVyZmxvdz1cImhpZGRlblwiXG4gICAgICAgID5cbiAgICAgICAgICA8Tm90aWZpY2F0aW9uc1xuICAgICAgICAgICAgYXBpS2V5U3RhdHVzPXthcGlLZXlTdGF0dXN9XG4gICAgICAgICAgICBhdXRvVXBkYXRlclJlc3VsdD17YXV0b1VwZGF0ZXJSZXN1bHR9XG4gICAgICAgICAgICBkZWJ1Zz17ZGVidWd9XG4gICAgICAgICAgICBpc0F1dG9VcGRhdGluZz17aXNBdXRvVXBkYXRpbmd9XG4gICAgICAgICAgICB2ZXJib3NlPXt2ZXJib3NlfVxuICAgICAgICAgICAgbWVzc2FnZXM9e21lc3NhZ2VzfVxuICAgICAgICAgICAgb25BdXRvVXBkYXRlclJlc3VsdD17b25BdXRvVXBkYXRlclJlc3VsdH1cbiAgICAgICAgICAgIG9uQ2hhbmdlSXNVcGRhdGluZz17c2V0SXNBdXRvVXBkYXRpbmd9XG4gICAgICAgICAgICBpZGVTZWxlY3Rpb249e2lkZVNlbGVjdGlvbn1cbiAgICAgICAgICAgIG1jcENsaWVudHM9e21jcENsaWVudHN9XG4gICAgICAgICAgICBpc0lucHV0V3JhcHBlZD17aXNJbnB1dFdyYXBwZWR9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApIDogbnVsbH1cbiAgICA8L0JveD5cbiAgKVxufVxuXG4vKipcbiAqIENvbXB1dGUgdGhlIGluaXRpYWwgcGFzdGUgSUQgYnkgZmluZGluZyB0aGUgbWF4IElEIHVzZWQgaW4gZXhpc3RpbmcgbWVzc2FnZXMuXG4gKiBUaGlzIGhhbmRsZXMgLS1jb250aW51ZS8tLXJlc3VtZSBzY2VuYXJpb3Mgd2hlcmUgd2UgbmVlZCB0byBhdm9pZCBJRCBjb2xsaXNpb25zLlxuICovXG5mdW5jdGlvbiBnZXRJbml0aWFsUGFzdGVJZChtZXNzYWdlczogTWVzc2FnZVtdKTogbnVtYmVyIHtcbiAgbGV0IG1heElkID0gMFxuICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgbWVzc2FnZXMpIHtcbiAgICBpZiAobWVzc2FnZS50eXBlID09PSAndXNlcicpIHtcbiAgICAgIC8vIENoZWNrIGltYWdlIHBhc3RlIElEc1xuICAgICAgaWYgKG1lc3NhZ2UuaW1hZ2VQYXN0ZUlkcykge1xuICAgICAgICBmb3IgKGNvbnN0IGlkIG9mIG1lc3NhZ2UuaW1hZ2VQYXN0ZUlkcykge1xuICAgICAgICAgIGlmIChpZCA+IG1heElkKSBtYXhJZCA9IGlkXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIENoZWNrIHRleHQgcGFzdGUgcmVmZXJlbmNlcyBpbiBtZXNzYWdlIGNvbnRlbnRcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2UubWVzc2FnZS5jb250ZW50KSkge1xuICAgICAgICBmb3IgKGNvbnN0IGJsb2NrIG9mIG1lc3NhZ2UubWVzc2FnZS5jb250ZW50KSB7XG4gICAgICAgICAgaWYgKGJsb2NrLnR5cGUgPT09ICd0ZXh0Jykge1xuICAgICAgICAgICAgY29uc3QgcmVmcyA9IHBhcnNlUmVmZXJlbmNlcyhibG9jay50ZXh0KVxuICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgcmVmcykge1xuICAgICAgICAgICAgICBpZiAocmVmLmlkID4gbWF4SWQpIG1heElkID0gcmVmLmlkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBtYXhJZCArIDFcbn1cblxuZnVuY3Rpb24gYnVpbGRCb3JkZXJUZXh0KFxuICBzaG93RmFzdEljb246IGJvb2xlYW4sXG4gIHNob3dGYXN0SWNvbkhpbnQ6IGJvb2xlYW4sXG4gIGZhc3RNb2RlQ29vbGRvd246IGJvb2xlYW4sXG4pOiBCb3JkZXJUZXh0T3B0aW9ucyB8IHVuZGVmaW5lZCB7XG4gIGlmICghc2hvd0Zhc3RJY29uKSByZXR1cm4gdW5kZWZpbmVkXG4gIGNvbnN0IGZhc3RTZWcgPSBzaG93RmFzdEljb25IaW50XG4gICAgPyBgJHtnZXRGYXN0SWNvblN0cmluZyh0cnVlLCBmYXN0TW9kZUNvb2xkb3duKX0gJHtjaGFsay5kaW0oJy9mYXN0Jyl9YFxuICAgIDogZ2V0RmFzdEljb25TdHJpbmcodHJ1ZSwgZmFzdE1vZGVDb29sZG93bilcbiAgcmV0dXJuIHtcbiAgICBjb250ZW50OiBgICR7ZmFzdFNlZ30gYCxcbiAgICBwb3NpdGlvbjogJ3RvcCcsXG4gICAgYWxpZ246ICdlbmQnLFxuICAgIG9mZnNldDogMCxcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBSZWFjdC5tZW1vKFByb21wdElucHV0KVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxTQUFTQSxPQUFPLFFBQVEsWUFBWTtBQUNwQyxPQUFPQyxLQUFLLE1BQU0sT0FBTztBQUN6QixPQUFPLEtBQUtDLElBQUksTUFBTSxNQUFNO0FBQzVCLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FDRUMsV0FBVyxFQUNYQyxTQUFTLEVBQ1RDLE9BQU8sRUFDUEMsTUFBTSxFQUNOQyxRQUFRLEVBQ1JDLG9CQUFvQixRQUNmLE9BQU87QUFDZCxTQUFTQyxnQkFBZ0IsUUFBUSw4QkFBOEI7QUFDL0QsU0FBU0MsZUFBZSxRQUFRLDhCQUE4QjtBQUM5RCxTQUNFLEtBQUtDLGNBQWMsRUFDbkJDLGlCQUFpQixRQUNaLGdDQUFnQztBQUN2QyxTQUNFLEtBQUtDLDBEQUEwRCxFQUMvREMsUUFBUSxRQUNILGlDQUFpQztBQUN4QyxTQUNFLEtBQUtDLFFBQVEsRUFDYkMsV0FBVyxFQUNYQyxnQkFBZ0IsRUFDaEJDLGNBQWMsUUFDVCx1QkFBdUI7QUFDOUIsY0FBY0MsVUFBVSxRQUFRLDRCQUE0QjtBQUM1RCxTQUFTQyxNQUFNLFFBQVEsa0JBQWtCO0FBQ3pDLFNBQ0VDLHVCQUF1QixFQUN2QkMsY0FBYyxRQUNULGtDQUFrQztBQUN6QyxPQUFPQyxTQUFTLE1BQU0sWUFBWTtBQUNsQyxTQUFTQyx3QkFBd0IsUUFBUSxnQ0FBZ0M7QUFDekUsU0FDRUMseUJBQXlCLEVBQ3pCQyxvQkFBb0IsUUFDZixxQ0FBcUM7QUFDNUMsU0FBU0MsY0FBYyxRQUFRLDZCQUE2QjtBQUM1RCxTQUFTQyxvQkFBb0IsUUFBUSw2Q0FBNkM7QUFDbEYsU0FBU0MsZ0NBQWdDLFFBQVEsK0NBQStDO0FBQ2hHLFNBQVMsS0FBS0MsT0FBTyxFQUFFQyxVQUFVLFFBQVEsbUJBQW1CO0FBQzVELFNBQVNDLHVCQUF1QixRQUFRLGlDQUFpQztBQUN6RSxTQUFTQyx5QkFBeUIs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