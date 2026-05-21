import { c as _c } from "react/compiler-runtime";
// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { feature } from 'bun:bundle';
// Dead code elimination: conditional import for COORDINATOR_MODE
/* eslint-disable @typescript-eslint/no-require-imports */
const coordinatorModule = feature('COORDINATOR_MODE') ? require('../../coordinator/coordinatorMode.js') as typeof import('../../coordinator/coordinatorMode.js') : undefined;
/* eslint-enable @typescript-eslint/no-require-imports */
import { Box, Text, Link } from '../../ink.js';
import * as React from 'react';
import figures from 'figures';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { VimMode, PromptInputMode } from '../../types/textInputTypes.js';
import type { ToolPermissionContext } from '../../Tool.js';
import { isVimModeEnabled } from './utils.js';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay.js';
import { isDefaultMode, permissionModeSymbol, permissionModeTitle, getModeColor } from '../../utils/permissions/PermissionMode.js';
import { BackgroundTaskStatus } from '../tasks/BackgroundTaskStatus.js';
import { isBackgroundTask } from '../../tasks/types.js';
import { isPanelAgentTask } from '../../tasks/LocalAgentTask/LocalAgentTask.js';
import { getVisibleAgentTasks } from '../CoordinatorAgentStatus.js';
import { count } from '../../utils/array.js';
import { shouldHideTasksFooter } from '../tasks/taskStatusUtils.js';
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js';
import { TeamStatus } from '../teams/TeamStatus.js';
import { isInProcessEnabled } from '../../utils/swarm/backends/registry.js';
import { useAppState, useAppStateStore } from 'src/state/AppState.js';
import { getIsRemoteMode } from '../../bootstrap/state.js';
import HistorySearchInput from './HistorySearchInput.js';
import { usePrStatus } from '../../hooks/usePrStatus.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import { Byline } from '../design-system/Byline.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { useTasksV2 } from '../../hooks/useTasksV2.js';
import { formatDuration } from '../../utils/format.js';
import { VoiceWarmupHint } from './VoiceIndicator.js';
import { useVoiceEnabled } from '../../hooks/useVoiceEnabled.js';
import { useVoiceState } from '../../context/voice.js';
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js';
import { isXtermJs } from '../../ink/terminal.js';
import { useHasSelection, useSelection } from '../../ink/hooks/use-selection.js';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js';
import { getPlatform } from '../../utils/platform.js';
import { PrBadge } from '../PrBadge.js';

// Dead code elimination: conditional import for proactive mode
/* eslint-disable @typescript-eslint/no-require-imports */
const proactiveModule = feature('PROACTIVE') || feature('KAIROS') ? require('../../proactive/index.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */
const NO_OP_SUBSCRIBE = (_cb: () => void) => () => {};
const NULL = () => null;
const MAX_VOICE_HINT_SHOWS = 3;
type Props = {
  exitMessage: {
    show: boolean;
    key?: string;
  };
  vimMode: VimMode | undefined;
  mode: PromptInputMode;
  toolPermissionContext: ToolPermissionContext;
  suppressHint: boolean;
  isLoading: boolean;
  showMemoryTypeSelector?: boolean;
  tasksSelected: boolean;
  teamsSelected: boolean;
  tmuxSelected: boolean;
  teammateFooterIndex?: number;
  isPasting?: boolean;
  isSearching: boolean;
  historyQuery: string;
  setHistoryQuery: (query: string) => void;
  historyFailedMatch: boolean;
  onOpenTasksDialog?: (taskId?: string) => void;
};
function ProactiveCountdown() {
  const $ = _c(7);
  const nextTickAt = useSyncExternalStore(proactiveModule?.subscribeToProactiveChanges ?? NO_OP_SUBSCRIBE, proactiveModule?.getNextTickAt ?? NULL, NULL);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  let t0;
  let t1;
  if ($[0] !== nextTickAt) {
    t0 = () => {
      if (nextTickAt === null) {
        setRemainingSeconds(null);
        return;
      }
      const update = function update() {
        const remaining = Math.max(0, Math.ceil((nextTickAt - Date.now()) / 1000));
        setRemainingSeconds(remaining);
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    };
    t1 = [nextTickAt];
    $[0] = nextTickAt;
    $[1] = t0;
    $[2] = t1;
  } else {
    t0 = $[1];
    t1 = $[2];
  }
  useEffect(t0, t1);
  if (remainingSeconds === null) {
    return null;
  }
  const t2 = remainingSeconds * 1000;
  let t3;
  if ($[3] !== t2) {
    t3 = formatDuration(t2, {
      mostSignificantOnly: true
    });
    $[3] = t2;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  let t4;
  if ($[5] !== t3) {
    t4 = <Text dimColor={true}>waiting{" "}{t3}</Text>;
    $[5] = t3;
    $[6] = t4;
  } else {
    t4 = $[6];
  }
  return t4;
}
export function PromptInputFooterLeftSide(t0) {
  const $ = _c(27);
  const {
    exitMessage,
    vimMode,
    mode,
    toolPermissionContext,
    suppressHint,
    isLoading,
    tasksSelected,
    teamsSelected,
    tmuxSelected,
    teammateFooterIndex,
    isPasting,
    isSearching,
    historyQuery,
    setHistoryQuery,
    historyFailedMatch,
    onOpenTasksDialog
  } = t0;
  if (exitMessage.show) {
    let t1;
    if ($[0] !== exitMessage.key) {
      t1 = <Text dimColor={true} key="exit-message">Press {exitMessage.key} again to exit</Text>;
      $[0] = exitMessage.key;
      $[1] = t1;
    } else {
      t1 = $[1];
    }
    return t1;
  }
  if (isPasting) {
    let t1;
    if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
      t1 = <Text dimColor={true} key="pasting-message">Pasting text…</Text>;
      $[2] = t1;
    } else {
      t1 = $[2];
    }
    return t1;
  }
  let t1;
  if ($[3] !== isSearching || $[4] !== vimMode) {
    t1 = isVimModeEnabled() && vimMode === "INSERT" && !isSearching;
    $[3] = isSearching;
    $[4] = vimMode;
    $[5] = t1;
  } else {
    t1 = $[5];
  }
  const showVim = t1;
  let t2;
  if ($[6] !== historyFailedMatch || $[7] !== historyQuery || $[8] !== isSearching || $[9] !== setHistoryQuery) {
    t2 = isSearching && <HistorySearchInput value={historyQuery} onChange={setHistoryQuery} historyFailedMatch={historyFailedMatch} />;
    $[6] = historyFailedMatch;
    $[7] = historyQuery;
    $[8] = isSearching;
    $[9] = setHistoryQuery;
    $[10] = t2;
  } else {
    t2 = $[10];
  }
  let t3;
  if ($[11] !== showVim) {
    t3 = showVim ? <Text dimColor={true} key="vim-insert">-- INSERT --</Text> : null;
    $[11] = showVim;
    $[12] = t3;
  } else {
    t3 = $[12];
  }
  const t4 = !suppressHint && !showVim;
  let t5;
  if ($[13] !== isLoading || $[14] !== mode || $[15] !== onOpenTasksDialog || $[16] !== t4 || $[17] !== tasksSelected || $[18] !== teammateFooterIndex || $[19] !== teamsSelected || $[20] !== tmuxSelected || $[21] !== toolPermissionContext) {
    t5 = <ModeIndicator mode={mode} toolPermissionContext={toolPermissionContext} showHint={t4} isLoading={isLoading} tasksSelected={tasksSelected} teamsSelected={teamsSelected} teammateFooterIndex={teammateFooterIndex} tmuxSelected={tmuxSelected} onOpenTasksDialog={onOpenTasksDialog} />;
    $[13] = isLoading;
    $[14] = mode;
    $[15] = onOpenTasksDialog;
    $[16] = t4;
    $[17] = tasksSelected;
    $[18] = teammateFooterIndex;
    $[19] = teamsSelected;
    $[20] = tmuxSelected;
    $[21] = toolPermissionContext;
    $[22] = t5;
  } else {
    t5 = $[22];
  }
  let t6;
  if ($[23] !== t2 || $[24] !== t3 || $[25] !== t5) {
    t6 = <Box justifyContent="flex-start" gap={1}>{t2}{t3}{t5}</Box>;
    $[23] = t2;
    $[24] = t3;
    $[25] = t5;
    $[26] = t6;
  } else {
    t6 = $[26];
  }
  return t6;
}
type ModeIndicatorProps = {
  mode: PromptInputMode;
  toolPermissionContext: ToolPermissionContext;
  showHint: boolean;
  isLoading: boolean;
  tasksSelected: boolean;
  teamsSelected: boolean;
  tmuxSelected: boolean;
  teammateFooterIndex?: number;
  onOpenTasksDialog?: (taskId?: string) => void;
};
function ModeIndicator({
  mode,
  toolPermissionContext,
  showHint,
  isLoading,
  tasksSelected,
  teamsSelected,
  tmuxSelected,
  teammateFooterIndex,
  onOpenTasksDialog
}: ModeIndicatorProps): React.ReactNode {
  const {
    columns
  } = useTerminalSize();
  const modeCycleShortcut = useShortcutDisplay('chat:cycleMode', 'Chat', 'shift+tab');
  const tasks = useAppState(s => s.tasks);
  const teamContext = useAppState(s_0 => s_0.teamContext);
  // Set once in initialState (main.tsx --remote mode) and never mutated — lazy
  // init captures the immutable value without a subscription.
  const store = useAppStateStore();
  const [remoteSessionUrl] = useState(() => store.getState().remoteSessionUrl);
  const viewSelectionMode = useAppState(s_1 => s_1.viewSelectionMode);
  const viewingAgentTaskId = useAppState(s_2 => s_2.viewingAgentTaskId);
  const expandedView = useAppState(s_3 => s_3.expandedView);
  const showSpinnerTree = expandedView === 'teammates';
  const prStatus = usePrStatus(isLoading, isPrStatusEnabled());
  const hasTmuxSession = useAppState(s_4 => "external" === 'ant' && s_4.tungstenActiveSession !== undefined);
  const nextTickAt = useSyncExternalStore(proactiveModule?.subscribeToProactiveChanges ?? NO_OP_SUBSCRIBE, proactiveModule?.getNextTickAt ?? NULL, NULL);
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const voiceEnabled = feature('VOICE_MODE') ? useVoiceEnabled() : false;
  const voiceState = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useVoiceState(s_5 => s_5.voiceState) : 'idle' as const;
  const voiceWarmingUp = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useVoiceState(s_6 => s_6.voiceWarmingUp) : false;
  const hasSelection = useHasSelection();
  const selGetState = useSelection().getState;
  const hasNextTick = nextTickAt !== null;
  const isCoordinator = feature('COORDINATOR_MODE') ? coordinatorModule?.isCoordinatorMode() === true : false;
  const runningTaskCount = useMemo(() => count(Object.values(tasks), t => isBackgroundTask(t) && !("external" === 'ant' && isPanelAgentTask(t))), [tasks]);
  const tasksV2 = useTasksV2();
  const hasTaskItems = tasksV2 !== undefined && tasksV2.length > 0;
  const escShortcut = useShortcutDisplay('chat:cancel', 'Chat', 'esc').toLowerCase();
  const todosShortcut = useShortcutDisplay('app:toggleTodos', 'Global', 'ctrl+t');
  const killAgentsShortcut = useShortcutDisplay('chat:killAgents', 'Chat', 'ctrl+x ctrl+k');
  const voiceKeyShortcut = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useShortcutDisplay('voice:pushToTalk', 'Chat', 'Space') : '';
  // Captured at mount so the hint doesn't flicker mid-session if another
  // CC instance increments the counter. Incremented once via useEffect the
  // first time voice is enabled in this session — approximates "hint was
  // shown" without tracking the exact render-time condition (which depends
  // on parts/hintParts computed after the early-return hooks boundary).
  const [voiceHintUnderCap] = feature('VOICE_MODE') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useState(() => (getGlobalConfig().voiceFooterHintSeenCount ?? 0) < MAX_VOICE_HINT_SHOWS) : [false];
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const voiceHintIncrementedRef = feature('VOICE_MODE') ? useRef(false) : null;
  useEffect(() => {
    if (feature('VOICE_MODE')) {
      if (!voiceEnabled || !voiceHintUnderCap) return;
      if (voiceHintIncrementedRef?.current) return;
      if (voiceHintIncrementedRef) voiceHintIncrementedRef.current = true;
      const newCount = (getGlobalConfig().voiceFooterHintSeenCount ?? 0) + 1;
      saveGlobalConfig(prev => {
        if ((prev.voiceFooterHintSeenCount ?? 0) >= newCount) return prev;
        return {
          ...prev,
          voiceFooterHintSeenCount: newCount
        };
      });
    }
  }, [voiceEnabled, voiceHintUnderCap]);
  const isKillAgentsConfirmShowing = useAppState(s_7 => s_7.notifications.current?.key === 'kill-agents-confirm');

  // Derive team info from teamContext (no filesystem I/O needed)
  // Match the same logic as TeamStatus to avoid trailing separator
  // In-process mode uses Shift+Down/Up navigation, not footer teams menu
  const hasTeams = isAgentSwarmsEnabled() && !isInProcessEnabled() && teamContext !== undefined && count(Object.values(teamContext.teammates), t_0 => t_0.name !== 'team-lead') > 0;
  if (mode === 'bash') {
    return <Text color="bashBorder">! for bash mode</Text>;
  }
  const currentMode = toolPermissionContext?.mode;
  const hasActiveMode = !isDefaultMode(currentMode);
  const viewedTask = viewingAgentTaskId ? tasks[viewingAgentTaskId] : undefined;
  const isViewingTeammate = viewSelectionMode === 'viewing-agent' && viewedTask?.type === 'in_process_teammate';
  const isViewingCompletedTeammate = isViewingTeammate && viewedTask != null && viewedTask.status !== 'running';
  const hasBackgroundTasks = runningTaskCount > 0 || isViewingTeammate;

  // Count primary items (permission mode or coordinator mode, background tasks, and teams)
  const primaryItemCount = (isCoordinator || hasActiveMode ? 1 : 0) + (hasBackgroundTasks ? 1 : 0) + (hasTeams ? 1 : 0);

  // PR indicator is short (~10 chars) — unlike the old diff indicator the
  // >=100 threshold was tuned for. Now that auto mode is effectively the
  // baseline, primaryItemCount is ≥1 for most sessions; keep the threshold
  // low enough to show PR status on standard 80-col terminals.
  const shouldShowPrStatus = isPrStatusEnabled() && prStatus.number !== null && prStatus.reviewState !== null && prStatus.url !== null && primaryItemCount < 2 && (primaryItemCount === 0 || columns >= 80);

  // Hide the shift+tab hint when there are 2 primary items
  const shouldShowModeHint = primaryItemCount < 2;

  // Check if we have in-process teammates (showing pills)
  // In spinner-tree mode, pills are disabled - teammates appear in the spinner tree instead
  const hasInProcessTeammates = !showSpinnerTree && hasBackgroundTasks && Object.values(tasks).some(t_1 => t_1.type === 'in_process_teammate');
  const hasTeammatePills = hasInProcessTeammates || !showSpinnerTree && isViewingTeammate;

  // In remote mode (`claude assistant`, --teleport) the agent runs elsewhere;
  // the local permission mode shown here doesn't reflect the agent's state.
  // Rendered before the tasks pill so a long pill label (e.g. ultraplan URL)
  // doesn't push the mode indicator off-screen.
  const modePart = currentMode && hasActiveMode && !getIsRemoteMode() ? <Text color={getModeColor(currentMode)} key="mode">
        {permissionModeSymbol(currentMode)}{' '}
        {permissionModeTitle(currentMode).toLowerCase()} on
        {shouldShowModeHint && <Text dimColor>
            {' '}
            <KeyboardShortcutHint shortcut={modeCycleShortcut} action="cycle" parens />
          </Text>}
      </Text> : null;

  // Build parts array - exclude BackgroundTaskStatus when we have teammate pills
  // (teammate pills get their own row)
  const parts = [
  // Remote session indicator
  ...(remoteSessionUrl ? [<Link url={remoteSessionUrl} key="remote">
            <Text color="ide">{figures.circleDouble} remote</Text>
          </Link>] : []),
  // BackgroundTaskStatus is NOT in parts — it renders as a Box sibling so
  // its click-target Box isn't nested inside the <Text wrap="truncate">
  // wrapper (reconciler throws on Box-in-Text).
  // Tmux pill (ant-only) — appears right after tasks in nav order
  ...("external" === 'ant' && hasTmuxSession ? [<TungstenPill key="tmux" selected={tmuxSelected} />] : []), ...(isAgentSwarmsEnabled() && hasTeams ? [<TeamStatus key="teams" teamsSelected={teamsSelected} showHint={showHint && !hasBackgroundTasks} />] : []), ...(shouldShowPrStatus ? [<PrBadge key="pr-status" number={prStatus.number!} url={prStatus.url!} reviewState={prStatus.reviewState!} />] : [])];

  // Check if any in-process teammates exist (for hint text cycling)
  const hasAnyInProcessTeammates = Object.values(tasks).some(t_2 => t_2.type === 'in_process_teammate' && t_2.status === 'running');
  const hasRunningAgentTasks = Object.values(tasks).some(t_3 => t_3.type === 'local_agent' && t_3.status === 'running');

  // Get hint parts separately for potential second-line rendering
  const hintParts = showHint ? getSpinnerHintParts(isLoading, escShortcut, todosShortcut, killAgentsShortcut, hasTaskItems, expandedView, hasAnyInProcessTeammates, hasRunningAgentTasks, isKillAgentsConfirmShowing) : [];
  if (isViewingCompletedTeammate) {
    parts.push(<Text dimColor key="esc-return">
        <KeyboardShortcutHint shortcut={escShortcut} action="return to team lead" />
      </Text>);
  } else if ((feature('PROACTIVE') || feature('KAIROS')) && hasNextTick) {
    parts.push(<ProactiveCountdown key="proactive" />);
  } else if (!hasTeammatePills && showHint) {
    parts.push(...hintParts);
  }

  // When we have teammate pills, always render them on their own line above other parts
  if (hasTeammatePills) {
    // Don't append spinner hints when viewing a completed teammate —
    // the "esc to return to team lead" hint already replaces "esc to interrupt"
    const otherParts = [...(modePart ? [modePart] : []), ...parts, ...(isViewingCompletedTeammate ? [] : hintParts)];
    return <Box flexDirection="column">
        <Box>
          <BackgroundTaskStatus tasksSelected={tasksSelected} isViewingTeammate={isViewingTeammate} teammateFooterIndex={teammateFooterIndex} isLeaderIdle={!isLoading} onOpenDialog={onOpenTasksDialog} />
        </Box>
        {otherParts.length > 0 && <Box>
            <Byline>{otherParts}</Byline>
          </Box>}
      </Box>;
  }

  // Add "↓ to manage tasks" hint when panel has visible rows
  const hasCoordinatorTasks = "external" === 'ant' && getVisibleAgentTasks(tasks).length > 0;

  // Tasks pill renders as a Box sibling (not a parts entry) so its
  // click-target Box isn't nested inside <Text wrap="truncate"> — the
  // reconciler throws on Box-in-Text. Computed here so the empty-checks
  // below still treat "pill present" as non-empty.
  const tasksPart = hasBackgroundTasks && !hasTeammatePills && !shouldHideTasksFooter(tasks, showSpinnerTree) ? <BackgroundTaskStatus tasksSelected={tasksSelected} isViewingTeammate={isViewingTeammate} teammateFooterIndex={teammateFooterIndex} isLeaderIdle={!isLoading} onOpenDialog={onOpenTasksDialog} /> : null;
  if (parts.length === 0 && !tasksPart && !modePart && showHint) {
    parts.push(<Text dimColor key="shortcuts-hint">
        ? for shortcuts
      </Text>);
  }

  // Only replace the idle voice hint when there's something to say — otherwise
  // fall through instead of showing an empty Byline. "esc to clear" was removed
  // (looked like "esc to interrupt" when idle; esc-clears-selection is standard
  // UX) leaving only ctrl+c (copyOnSelect off) and the xterm.js native-select hint.
  const copyOnSelect = getGlobalConfig().copyOnSelect ?? true;
  const selectionHintHasContent = hasSelection && (!copyOnSelect || isXtermJs());

  // Warmup hint takes priority — when the user is actively holding
  // the activation key, show feedback regardless of other hints.
  if (feature('VOICE_MODE') && voiceEnabled && voiceWarmingUp) {
    parts.push(<VoiceWarmupHint key="voice-warmup" />);
  } else if (isFullscreenEnvEnabled() && selectionHintHasContent) {
    // xterm.js (VS Code/Cursor/Windsurf) force-selection modifier is
    // platform-specific and gated on macOS (SelectionService.shouldForceSelection):
    //   macOS:     altKey && macOptionClickForcesSelection (VS Code default: false)
    //   non-macOS: shiftKey
    // On macOS, if we RECEIVED an alt+click (lastPressHadAlt), the VS Code
    // setting is off — xterm.js would have consumed the event otherwise.
    // Tell the user the exact setting to flip instead of repeating the
    // option+click hint they just tried.
    // Non-reactive getState() read is safe: lastPressHadAlt is immutable
    // while hasSelection is true (set pre-drag, cleared with selection).
    const isMac = getPlatform() === 'macos';
    const altClickFailed = isMac && (selGetState()?.lastPressHadAlt ?? false);
    parts.push(<Text dimColor key="selection-copy">
        <Byline>
          {!copyOnSelect && <KeyboardShortcutHint shortcut="ctrl+c" action="copy" />}
          {isXtermJs() && (altClickFailed ? <Text>set macOptionClickForcesSelection in VS Code settings</Text> : <KeyboardShortcutHint shortcut={isMac ? 'option+click' : 'shift+click'} action="native select" />)}
        </Byline>
      </Text>);
  } else if (feature('VOICE_MODE') && parts.length > 0 && showHint && voiceEnabled && voiceState === 'idle' && hintParts.length === 0 && voiceHintUnderCap) {
    parts.push(<Text dimColor key="voice-hint">
        hold {voiceKeyShortcut} to speak
      </Text>);
  }
  if ((tasksPart || hasCoordinatorTasks) && showHint && !hasTeams) {
    parts.push(<Text dimColor key="manage-tasks">
        {tasksSelected ? <KeyboardShortcutHint shortcut="Enter" action="view tasks" /> : <KeyboardShortcutHint shortcut="↓" action="manage" />}
      </Text>);
  }

  // In fullscreen the bottom section is flexShrink:0 — every row here
  // is a row stolen from the ScrollBox. This component must have a STABLE
  // height so the footer never grows/shrinks and shifts scroll content.
  // Returning null when parts is empty (e.g. StatusLine on → suppressHint
  // → showHint=false → no "? for shortcuts") would let a later-added
  // part (e.g. the selection copy/native-select hints) grow the column
  // from 0→1 row. Always render 1 row in fullscreen; return a space when
  // empty so Yoga reserves the row without painting anything visible.
  if (parts.length === 0 && !tasksPart && !modePart) {
    return isFullscreenEnvEnabled() ? <Text> </Text> : null;
  }

  // flexShrink=0 keeps mode + pill at natural width; the remaining parts
  // truncate at the tail as one string inside the Text wrapper.
  return <Box height={1} overflow="hidden">
      {modePart && <Box flexShrink={0}>
          {modePart}
          {(tasksPart || parts.length > 0) && <Text dimColor> · </Text>}
        </Box>}
      {tasksPart && <Box flexShrink={0}>
          {tasksPart}
          {parts.length > 0 && <Text dimColor> · </Text>}
        </Box>}
      {parts.length > 0 && <Text wrap="truncate">
          <Byline>{parts}</Byline>
        </Text>}
    </Box>;
}
function getSpinnerHintParts(isLoading: boolean, escShortcut: string, todosShortcut: string, killAgentsShortcut: string, hasTaskItems: boolean, expandedView: 'none' | 'tasks' | 'teammates', hasTeammates: boolean, hasRunningAgentTasks: boolean, isKillAgentsConfirmShowing: boolean): React.ReactElement[] {
  let toggleAction: string;
  if (hasTeammates) {
    // Cycling: none → tasks → teammates → none
    switch (expandedView) {
      case 'none':
        toggleAction = 'show tasks';
        break;
      case 'tasks':
        toggleAction = 'show teammates';
        break;
      case 'teammates':
        toggleAction = 'hide';
        break;
    }
  } else {
    toggleAction = expandedView === 'tasks' ? 'hide tasks' : 'show tasks';
  }

  // Show the toggle hint only when there are task items to display or
  // teammates to cycle to
  const showToggleHint = hasTaskItems || hasTeammates;
  return [...(isLoading ? [<Text dimColor key="esc">
            <KeyboardShortcutHint shortcut={escShortcut} action="interrupt" />
          </Text>] : []), ...(!isLoading && hasRunningAgentTasks && !isKillAgentsConfirmShowing ? [<Text dimColor key="kill-agents">
            <KeyboardShortcutHint shortcut={killAgentsShortcut} action="stop agents" />
          </Text>] : []), ...(showToggleHint ? [<Text dimColor key="toggle-tasks">
            <KeyboardShortcutHint shortcut={todosShortcut} action={toggleAction} />
          </Text>] : [])];
}
function isPrStatusEnabled(): boolean {
  return getGlobalConfig().prStatusFooterEnabled ?? true;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiY29vcmRpbmF0b3JNb2R1bGUiLCJyZXF1aXJlIiwidW5kZWZpbmVkIiwiQm94IiwiVGV4dCIsIkxpbmsiLCJSZWFjdCIsImZpZ3VyZXMiLCJ1c2VFZmZlY3QiLCJ1c2VNZW1vIiwidXNlUmVmIiwidXNlU3RhdGUiLCJ1c2VTeW5jRXh0ZXJuYWxTdG9yZSIsIlZpbU1vZGUiLCJQcm9tcHRJbnB1dE1vZGUiLCJUb29sUGVybWlzc2lvbkNvbnRleHQiLCJpc1ZpbU1vZGVFbmFibGVkIiwidXNlU2hvcnRjdXREaXNwbGF5IiwiaXNEZWZhdWx0TW9kZSIsInBlcm1pc3Npb25Nb2RlU3ltYm9sIiwicGVybWlzc2lvbk1vZGVUaXRsZSIsImdldE1vZGVDb2xvciIsIkJhY2tncm91bmRUYXNrU3RhdHVzIiwiaXNCYWNrZ3JvdW5kVGFzayIsImlzUGFuZWxBZ2VudFRhc2siLCJnZXRWaXNpYmxlQWdlbnRUYXNrcyIsImNvdW50Iiwic2hvdWxkSGlkZVRhc2tzRm9vdGVyIiwiaXNBZ2VudFN3YXJtc0VuYWJsZWQiLCJUZWFtU3RhdHVzIiwiaXNJblByb2Nlc3NFbmFibGVkIiwidXNlQXBwU3RhdGUiLCJ1c2VBcHBTdGF0ZVN0b3JlIiwiZ2V0SXNSZW1vdGVNb2RlIiwiSGlzdG9yeVNlYXJjaElucHV0IiwidXNlUHJTdGF0dXMiLCJLZXlib2FyZFNob3J0Y3V0SGludCIsIkJ5bGluZSIsInVzZVRlcm1pbmFsU2l6ZSIsInVzZVRhc2tzVjIiLCJmb3JtYXREdXJhdGlvbiIsIlZvaWNlV2FybXVwSGludCIsInVzZVZvaWNlRW5hYmxlZCIsInVzZVZvaWNlU3RhdGUiLCJpc0Z1bGxzY3JlZW5FbnZFbmFibGVkIiwiaXNYdGVybUpzIiwidXNlSGFzU2VsZWN0aW9uIiwidXNlU2VsZWN0aW9uIiwiZ2V0R2xvYmFsQ29uZmlnIiwic2F2ZUdsb2JhbENvbmZpZyIsImdldFBsYXRmb3JtIiwiUHJCYWRnZSIsInByb2FjdGl2ZU1vZHVsZSIsIk5PX09QX1NVQlNDUklCRSIsIl9jYiIsIk5VTEwiLCJNQVhfVk9JQ0VfSElOVF9TSE9XUyIsIlByb3BzIiwiZXhpdE1lc3NhZ2UiLCJzaG93Iiwia2V5IiwidmltTW9kZSIsIm1vZGUiLCJ0b29sUGVybWlzc2lvbkNvbnRleHQiLCJzdXBwcmVzc0hpbnQiLCJpc0xvYWRpbmciLCJzaG93TWVtb3J5VHlwZVNlbGVjdG9yIiwidGFza3NTZWxlY3RlZCIsInRlYW1zU2VsZWN0ZWQiLCJ0bXV4U2VsZWN0ZWQiLCJ0ZWFtbWF0ZUZvb3RlckluZGV4IiwiaXNQYXN0aW5nIiwiaXNTZWFyY2hpbmciLCJoaXN0b3J5UXVlcnkiLCJzZXRIaXN0b3J5UXVlcnkiLCJxdWVyeSIsImhpc3RvcnlGYWlsZWRNYXRjaCIsIm9uT3BlblRhc2tzRGlhbG9nIiwidGFza0lkIiwiUHJvYWN0aXZlQ291bnRkb3duIiwiJCIsIl9jIiwibmV4dFRpY2tBdCIsInN1YnNjcmliZVRvUHJvYWN0aXZlQ2hhbmdlcyIsImdldE5leHRUaWNrQXQiLCJyZW1haW5pbmdTZWNvbmRzIiwic2V0UmVtYWluaW5nU2Vjb25kcyIsInQwIiwidDEiLCJ1cGRhdGUiLCJyZW1haW5pbmciLCJNYXRoIiwibWF4IiwiY2VpbCIsIkRhdGUiLCJub3ciLCJpbnRlcnZhbCIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsInQyIiwidDMiLCJtb3N0U2lnbmlmaWNhbnRPbmx5IiwidDQiLCJQcm9tcHRJbnB1dEZvb3RlckxlZnRTaWRlIiwiU3ltYm9sIiwiZm9yIiwic2hvd1ZpbSIsInQ1IiwidDYiLCJNb2RlSW5kaWNhdG9yUHJvcHMiLCJzaG93SGludCIsIk1vZGVJbmRpY2F0b3IiLCJSZWFjdE5vZGUiLCJjb2x1bW5zIiwibW9kZUN5Y2xlU2hvcnRjdXQiLCJ0YXNrcyIsInMiLCJ0ZWFtQ29udGV4dCIsInN0b3JlIiwicmVtb3RlU2Vzc2lvblVybCIsImdldFN0YXRlIiwidmlld1NlbGVjdGlvbk1vZGUiLCJ2aWV3aW5nQWdlbnRUYXNrSWQiLCJleHBhbmRlZFZpZXciLCJzaG93U3Bpbm5lclRyZWUiLCJwclN0YXR1cyIsImlzUHJTdGF0dXNFbmFibGVkIiwiaGFzVG11eFNlc3Npb24iLCJ0dW5nc3RlbkFjdGl2ZVNlc3Npb24iLCJ2b2ljZUVuYWJsZWQiLCJ2b2ljZVN0YXRlIiwiY29uc3QiLCJ2b2ljZVdhcm1pbmdVcCIsImhhc1NlbGVjdGlvbiIsInNlbEdldFN0YXRlIiwiaGFzTmV4dFRpY2siLCJpc0Nvb3JkaW5hdG9yIiwiaXNDb29yZGluYXRvck1vZGUiLCJydW5uaW5nVGFza0NvdW50IiwiT2JqZWN0IiwidmFsdWVzIiwidCIsInRhc2tzVjIiLCJoYXNUYXNrSXRlbXMiLCJsZW5ndGgiLCJlc2NTaG9ydGN1dCIsInRvTG93ZXJDYXNlIiwidG9kb3NTaG9ydGN1dCIsImtpbGxBZ2VudHNTaG9ydGN1dCIsInZvaWNlS2V5U2hvcnRjdXQiLCJ2b2ljZUhpbnRVbmRlckNhcCIsInZvaWNlRm9vdGVySGludFNlZW5Db3VudCIsInZvaWNlSGludEluY3JlbWVudGVkUmVmIiwiY3VycmVudCIsIm5ld0NvdW50IiwicHJldiIsImlzS2lsbEFnZW50c0NvbmZpcm1TaG93aW5nIiwibm90aWZpY2F0aW9ucyIsImhhc1RlYW1zIiwidGVhbW1hdGVzIiwibmFtZSIsImN1cnJlbnRNb2RlIiwiaGFzQWN0aXZlTW9kZSIsInZpZXdlZFRhc2siLCJpc1ZpZXdpbmdUZWFtbWF0ZSIsInR5cGUiLCJpc1ZpZXdpbmdDb21wbGV0ZWRUZWFtbWF0ZSIsInN0YXR1cyIsImhhc0JhY2tncm91bmRUYXNrcyIsInByaW1hcnlJdGVtQ291bnQiLCJzaG91bGRTaG93UHJTdGF0dXMiLCJudW1iZXIiLCJyZXZpZXdTdGF0ZSIsInVybCIsInNob3VsZFNob3dNb2RlSGludCIsImhhc0luUHJvY2Vzc1RlYW1tYXRlcyIsInNvbWUiLCJoYXNUZWFtbWF0ZVBpbGxzIiwibW9kZVBhcnQiLCJwYXJ0cyIsImNpcmNsZURvdWJsZSIsImhhc0FueUluUHJvY2Vzc1RlYW1tYXRlcyIsImhhc1J1bm5pbmdBZ2VudFRhc2tzIiwiaGludFBhcnRzIiwiZ2V0U3Bpbm5lckhpbnRQYXJ0cyIsInB1c2giLCJvdGhlclBhcnRzIiwiaGFzQ29vcmRpbmF0b3JUYXNrcyIsInRhc2tzUGFydCIsImNvcHlPblNlbGVjdCIsInNlbGVjdGlvbkhpbnRIYXNDb250ZW50IiwiaXNNYWMiLCJhbHRDbGlja0ZhaWxlZCIsImxhc3RQcmVzc0hhZEFsdCIsImhhc1RlYW1tYXRlcyIsIlJlYWN0RWxlbWVudCIsInRvZ2dsZUFjdGlvbiIsInNob3dUb2dnbGVIaW50IiwicHJTdGF0dXNGb290ZXJFbmFibGVkIl0sInNvdXJjZXMiOlsiUHJvbXB0SW5wdXRGb290ZXJMZWZ0U2lkZS50c3giXSwic291cmNlc0NvbnRlbnQiOlsiLy8gYmlvbWUtaWdub3JlLWFsbCBhc3Npc3Qvc291cmNlL29yZ2FuaXplSW1wb3J0czogQU5ULU9OTFkgaW1wb3J0IG1hcmtlcnMgbXVzdCBub3QgYmUgcmVvcmRlcmVkXG5pbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbi8vIERlYWQgY29kZSBlbGltaW5hdGlvbjogY29uZGl0aW9uYWwgaW1wb3J0IGZvciBDT09SRElOQVRPUl9NT0RFXG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5jb25zdCBjb29yZGluYXRvck1vZHVsZSA9IGZlYXR1cmUoJ0NPT1JESU5BVE9SX01PREUnKVxuICA/IChyZXF1aXJlKCcuLi8uLi9jb29yZGluYXRvci9jb29yZGluYXRvck1vZGUuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuLi8uLi9jb29yZGluYXRvci9jb29yZGluYXRvck1vZGUuanMnKSlcbiAgOiB1bmRlZmluZWRcbi8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuaW1wb3J0IHsgQm94LCBUZXh0LCBMaW5rIH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgZmlndXJlcyBmcm9tICdmaWd1cmVzJ1xuaW1wb3J0IHtcbiAgdXNlRWZmZWN0LFxuICB1c2VNZW1vLFxuICB1c2VSZWYsXG4gIHVzZVN0YXRlLFxuICB1c2VTeW5jRXh0ZXJuYWxTdG9yZSxcbn0gZnJvbSAncmVhY3QnXG5pbXBvcnQgdHlwZSB7IFZpbU1vZGUsIFByb21wdElucHV0TW9kZSB9IGZyb20gJy4uLy4uL3R5cGVzL3RleHRJbnB1dFR5cGVzLmpzJ1xuaW1wb3J0IHR5cGUgeyBUb29sUGVybWlzc2lvbkNvbnRleHQgfSBmcm9tICcuLi8uLi9Ub29sLmpzJ1xuaW1wb3J0IHsgaXNWaW1Nb2RlRW5hYmxlZCB9IGZyb20gJy4vdXRpbHMuanMnXG5pbXBvcnQgeyB1c2VTaG9ydGN1dERpc3BsYXkgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy91c2VTaG9ydGN1dERpc3BsYXkuanMnXG5pbXBvcnQge1xuICBpc0RlZmF1bHRNb2RlLFxuICBwZXJtaXNzaW9uTW9kZVN5bWJvbCxcbiAgcGVybWlzc2lvbk1vZGVUaXRsZSxcbiAgZ2V0TW9kZUNvbG9yLFxufSBmcm9tICcuLi8uLi91dGlscy9wZXJtaXNzaW9ucy9QZXJtaXNzaW9uTW9kZS5qcydcbmltcG9ydCB7IEJhY2tncm91bmRUYXNrU3RhdHVzIH0gZnJvbSAnLi4vdGFza3MvQmFja2dyb3VuZFRhc2tTdGF0dXMuanMnXG5pbXBvcnQgeyBpc0JhY2tncm91bmRUYXNrIH0gZnJvbSAnLi4vLi4vdGFza3MvdHlwZXMuanMnXG5pbXBvcnQgeyBpc1BhbmVsQWdlbnRUYXNrIH0gZnJvbSAnLi4vLi4vdGFza3MvTG9jYWxBZ2VudFRhc2svTG9jYWxBZ2VudFRhc2suanMnXG5pbXBvcnQgeyBnZXRWaXNpYmxlQWdlbnRUYXNrcyB9IGZyb20gJy4uL0Nvb3JkaW5hdG9yQWdlbnRTdGF0dXMuanMnXG5pbXBvcnQgeyBjb3VudCB9IGZyb20gJy4uLy4uL3V0aWxzL2FycmF5LmpzJ1xuaW1wb3J0IHsgc2hvdWxkSGlkZVRhc2tzRm9vdGVyIH0gZnJvbSAnLi4vdGFza3MvdGFza1N0YXR1c1V0aWxzLmpzJ1xuaW1wb3J0IHsgaXNBZ2VudFN3YXJtc0VuYWJsZWQgfSBmcm9tICcuLi8uLi91dGlscy9hZ2VudFN3YXJtc0VuYWJsZWQuanMnXG5pbXBvcnQgeyBUZWFtU3RhdHVzIH0gZnJvbSAnLi4vdGVhbXMvVGVhbVN0YXR1cy5qcydcbmltcG9ydCB7IGlzSW5Qcm9jZXNzRW5hYmxlZCB9IGZyb20gJy4uLy4uL3V0aWxzL3N3YXJtL2JhY2tlbmRzL3JlZ2lzdHJ5LmpzJ1xuaW1wb3J0IHsgdXNlQXBwU3RhdGUsIHVzZUFwcFN0YXRlU3RvcmUgfSBmcm9tICdzcmMvc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgeyBnZXRJc1JlbW90ZU1vZGUgfSBmcm9tICcuLi8uLi9ib290c3RyYXAvc3RhdGUuanMnXG5pbXBvcnQgSGlzdG9yeVNlYXJjaElucHV0IGZyb20gJy4vSGlzdG9yeVNlYXJjaElucHV0LmpzJ1xuaW1wb3J0IHsgdXNlUHJTdGF0dXMgfSBmcm9tICcuLi8uLi9ob29rcy91c2VQclN0YXR1cy5qcydcbmltcG9ydCB7IEtleWJvYXJkU2hvcnRjdXRIaW50IH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9LZXlib2FyZFNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IEJ5bGluZSB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vQnlsaW5lLmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuaW1wb3J0IHsgdXNlVGFza3NWMiB9IGZyb20gJy4uLy4uL2hvb2tzL3VzZVRhc2tzVjIuanMnXG5pbXBvcnQgeyBmb3JtYXREdXJhdGlvbiB9IGZyb20gJy4uLy4uL3V0aWxzL2Zvcm1hdC5qcydcbmltcG9ydCB7IFZvaWNlV2FybXVwSGludCB9IGZyb20gJy4vVm9pY2VJbmRpY2F0b3IuanMnXG5pbXBvcnQgeyB1c2VWb2ljZUVuYWJsZWQgfSBmcm9tICcuLi8uLi9ob29rcy91c2VWb2ljZUVuYWJsZWQuanMnXG5pbXBvcnQgeyB1c2VWb2ljZVN0YXRlIH0gZnJvbSAnLi4vLi4vY29udGV4dC92b2ljZS5qcydcbmltcG9ydCB7IGlzRnVsbHNjcmVlbkVudkVuYWJsZWQgfSBmcm9tICcuLi8uLi91dGlscy9mdWxsc2NyZWVuLmpzJ1xuaW1wb3J0IHsgaXNYdGVybUpzIH0gZnJvbSAnLi4vLi4vaW5rL3Rlcm1pbmFsLmpzJ1xuaW1wb3J0IHsgdXNlSGFzU2VsZWN0aW9uLCB1c2VTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi9pbmsvaG9va3MvdXNlLXNlbGVjdGlvbi5qcydcbmltcG9ydCB7IGdldEdsb2JhbENvbmZpZywgc2F2ZUdsb2JhbENvbmZpZyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcydcbmltcG9ydCB7IGdldFBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGxhdGZvcm0uanMnXG5pbXBvcnQgeyBQckJhZGdlIH0gZnJvbSAnLi4vUHJCYWRnZS5qcydcblxuLy8gRGVhZCBjb2RlIGVsaW1pbmF0aW9uOiBjb25kaXRpb25hbCBpbXBvcnQgZm9yIHByb2FjdGl2ZSBtb2RlXG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5jb25zdCBwcm9hY3RpdmVNb2R1bGUgPVxuICBmZWF0dXJlKCdQUk9BQ1RJVkUnKSB8fCBmZWF0dXJlKCdLQUlST1MnKVxuICAgID8gcmVxdWlyZSgnLi4vLi4vcHJvYWN0aXZlL2luZGV4LmpzJylcbiAgICA6IG51bGxcbi8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuY29uc3QgTk9fT1BfU1VCU0NSSUJFID0gKF9jYjogKCkgPT4gdm9pZCkgPT4gKCkgPT4ge31cbmNvbnN0IE5VTEwgPSAoKSA9PiBudWxsXG5jb25zdCBNQVhfVk9JQ0VfSElOVF9TSE9XUyA9IDNcblxudHlwZSBQcm9wcyA9IHtcbiAgZXhpdE1lc3NhZ2U6IHtcbiAgICBzaG93OiBib29sZWFuXG4gICAga2V5Pzogc3RyaW5nXG4gIH1cbiAgdmltTW9kZTogVmltTW9kZSB8IHVuZGVmaW5lZFxuICBtb2RlOiBQcm9tcHRJbnB1dE1vZGVcbiAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiBUb29sUGVybWlzc2lvbkNvbnRleHRcbiAgc3VwcHJlc3NIaW50OiBib29sZWFuXG4gIGlzTG9hZGluZzogYm9vbGVhblxuICBzaG93TWVtb3J5VHlwZVNlbGVjdG9yPzogYm9vbGVhblxuICB0YXNrc1NlbGVjdGVkOiBib29sZWFuXG4gIHRlYW1zU2VsZWN0ZWQ6IGJvb2xlYW5cbiAgdG11eFNlbGVjdGVkOiBib29sZWFuXG4gIHRlYW1tYXRlRm9vdGVySW5kZXg/OiBudW1iZXJcbiAgaXNQYXN0aW5nPzogYm9vbGVhblxuICBpc1NlYXJjaGluZzogYm9vbGVhblxuICBoaXN0b3J5UXVlcnk6IHN0cmluZ1xuICBzZXRIaXN0b3J5UXVlcnk6IChxdWVyeTogc3RyaW5nKSA9PiB2b2lkXG4gIGhpc3RvcnlGYWlsZWRNYXRjaDogYm9vbGVhblxuICBvbk9wZW5UYXNrc0RpYWxvZz86ICh0YXNrSWQ/OiBzdHJpbmcpID0+IHZvaWRcbn1cblxuZnVuY3Rpb24gUHJvYWN0aXZlQ291bnRkb3duKCk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IG5leHRUaWNrQXQgPSB1c2VTeW5jRXh0ZXJuYWxTdG9yZShcbiAgICBwcm9hY3RpdmVNb2R1bGU/LnN1YnNjcmliZVRvUHJvYWN0aXZlQ2hhbmdlcyA/PyBOT19PUF9TVUJTQ1JJQkUsXG4gICAgcHJvYWN0aXZlTW9kdWxlPy5nZXROZXh0VGlja0F0ID8/IE5VTEwsXG4gICAgTlVMTCxcbiAgKVxuXG4gIGNvbnN0IFtyZW1haW5pbmdTZWNvbmRzLCBzZXRSZW1haW5pbmdTZWNvbmRzXSA9IHVzZVN0YXRlPG51bWJlciB8IG51bGw+KG51bGwpXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAobmV4dFRpY2tBdCA9PT0gbnVsbCkge1xuICAgICAgc2V0UmVtYWluaW5nU2Vjb25kcyhudWxsKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdXBkYXRlKCk6IHZvaWQge1xuICAgICAgY29uc3QgcmVtYWluaW5nID0gTWF0aC5tYXgoXG4gICAgICAgIDAsXG4gICAgICAgIE1hdGguY2VpbCgobmV4dFRpY2tBdCEgLSBEYXRlLm5vdygpKSAvIDEwMDApLFxuICAgICAgKVxuICAgICAgc2V0UmVtYWluaW5nU2Vjb25kcyhyZW1haW5pbmcpXG4gICAgfVxuXG4gICAgdXBkYXRlKClcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKHVwZGF0ZSwgMTAwMClcbiAgICByZXR1cm4gKCkgPT4gY2xlYXJJbnRlcnZhbChpbnRlcnZhbClcbiAgfSwgW25leHRUaWNrQXRdKVxuXG4gIGlmIChyZW1haW5pbmdTZWNvbmRzID09PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gIHJldHVybiAoXG4gICAgPFRleHQgZGltQ29sb3I+XG4gICAgICB3YWl0aW5neycgJ31cbiAgICAgIHtmb3JtYXREdXJhdGlvbihyZW1haW5pbmdTZWNvbmRzICogMTAwMCwgeyBtb3N0U2lnbmlmaWNhbnRPbmx5OiB0cnVlIH0pfVxuICAgIDwvVGV4dD5cbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gUHJvbXB0SW5wdXRGb290ZXJMZWZ0U2lkZSh7XG4gIGV4aXRNZXNzYWdlLFxuICB2aW1Nb2RlLFxuICBtb2RlLFxuICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gIHN1cHByZXNzSGludCxcbiAgaXNMb2FkaW5nLFxuICB0YXNrc1NlbGVjdGVkLFxuICB0ZWFtc1NlbGVjdGVkLFxuICB0bXV4U2VsZWN0ZWQsXG4gIHRlYW1tYXRlRm9vdGVySW5kZXgsXG4gIGlzUGFzdGluZyxcbiAgaXNTZWFyY2hpbmcsXG4gIGhpc3RvcnlRdWVyeSxcbiAgc2V0SGlzdG9yeVF1ZXJ5LFxuICBoaXN0b3J5RmFpbGVkTWF0Y2gsXG4gIG9uT3BlblRhc2tzRGlhbG9nLFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBpZiAoZXhpdE1lc3NhZ2Uuc2hvdykge1xuICAgIHJldHVybiAoXG4gICAgICA8VGV4dCBkaW1Db2xvciBrZXk9XCJleGl0LW1lc3NhZ2VcIj5cbiAgICAgICAgUHJlc3Mge2V4aXRNZXNzYWdlLmtleX0gYWdhaW4gdG8gZXhpdFxuICAgICAgPC9UZXh0PlxuICAgIClcbiAgfVxuICBpZiAoaXNQYXN0aW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxUZXh0IGRpbUNvbG9yIGtleT1cInBhc3RpbmctbWVzc2FnZVwiPlxuICAgICAgICBQYXN0aW5nIHRleHTigKZcbiAgICAgIDwvVGV4dD5cbiAgICApXG4gIH1cblxuICBjb25zdCBzaG93VmltID0gaXNWaW1Nb2RlRW5hYmxlZCgpICYmIHZpbU1vZGUgPT09ICdJTlNFUlQnICYmICFpc1NlYXJjaGluZ1xuXG4gIHJldHVybiAoXG4gICAgPEJveCBqdXN0aWZ5Q29udGVudD1cImZsZXgtc3RhcnRcIiBnYXA9ezF9PlxuICAgICAge2lzU2VhcmNoaW5nICYmIChcbiAgICAgICAgPEhpc3RvcnlTZWFyY2hJbnB1dFxuICAgICAgICAgIHZhbHVlPXtoaXN0b3J5UXVlcnl9XG4gICAgICAgICAgb25DaGFuZ2U9e3NldEhpc3RvcnlRdWVyeX1cbiAgICAgICAgICBoaXN0b3J5RmFpbGVkTWF0Y2g9e2hpc3RvcnlGYWlsZWRNYXRjaH1cbiAgICAgICAgLz5cbiAgICAgICl9XG4gICAgICB7c2hvd1ZpbSA/IChcbiAgICAgICAgPFRleHQgZGltQ29sb3Iga2V5PVwidmltLWluc2VydFwiPlxuICAgICAgICAgIC0tIElOU0VSVCAtLVxuICAgICAgICA8L1RleHQ+XG4gICAgICApIDogbnVsbH1cbiAgICAgIDxNb2RlSW5kaWNhdG9yXG4gICAgICAgIG1vZGU9e21vZGV9XG4gICAgICAgIHRvb2xQZXJtaXNzaW9uQ29udGV4dD17dG9vbFBlcm1pc3Npb25Db250ZXh0fVxuICAgICAgICBzaG93SGludD17IXN1cHByZXNzSGludCAmJiAhc2hvd1ZpbX1cbiAgICAgICAgaXNMb2FkaW5nPXtpc0xvYWRpbmd9XG4gICAgICAgIHRhc2tzU2VsZWN0ZWQ9e3Rhc2tzU2VsZWN0ZWR9XG4gICAgICAgIHRlYW1zU2VsZWN0ZWQ9e3RlYW1zU2VsZWN0ZWR9XG4gICAgICAgIHRlYW1tYXRlRm9vdGVySW5kZXg9e3RlYW1tYXRlRm9vdGVySW5kZXh9XG4gICAgICAgIHRtdXhTZWxlY3RlZD17dG11eFNlbGVjdGVkfVxuICAgICAgICBvbk9wZW5UYXNrc0RpYWxvZz17b25PcGVuVGFza3NEaWFsb2d9XG4gICAgICAvPlxuICAgIDwvQm94PlxuICApXG59XG5cbnR5cGUgTW9kZUluZGljYXRvclByb3BzID0ge1xuICBtb2RlOiBQcm9tcHRJbnB1dE1vZGVcbiAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiBUb29sUGVybWlzc2lvbkNvbnRleHRcbiAgc2hvd0hpbnQ6IGJvb2xlYW5cbiAgaXNMb2FkaW5nOiBib29sZWFuXG4gIHRhc2tzU2VsZWN0ZWQ6IGJvb2xlYW5cbiAgdGVhbXNTZWxlY3RlZDogYm9vbGVhblxuICB0bXV4U2VsZWN0ZWQ6IGJvb2xlYW5cbiAgdGVhbW1hdGVGb290ZXJJbmRleD86IG51bWJlclxuICBvbk9wZW5UYXNrc0RpYWxvZz86ICh0YXNrSWQ/OiBzdHJpbmcpID0+IHZvaWRcbn1cblxuZnVuY3Rpb24gTW9kZUluZGljYXRvcih7XG4gIG1vZGUsXG4gIHRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgc2hvd0hpbnQsXG4gIGlzTG9hZGluZyxcbiAgdGFza3NTZWxlY3RlZCxcbiAgdGVhbXNTZWxlY3RlZCxcbiAgdG11eFNlbGVjdGVkLFxuICB0ZWFtbWF0ZUZvb3RlckluZGV4LFxuICBvbk9wZW5UYXNrc0RpYWxvZyxcbn06IE1vZGVJbmRpY2F0b3JQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHsgY29sdW1ucyB9ID0gdXNlVGVybWluYWxTaXplKClcbiAgY29uc3QgbW9kZUN5Y2xlU2hvcnRjdXQgPSB1c2VTaG9ydGN1dERpc3BsYXkoXG4gICAgJ2NoYXQ6Y3ljbGVNb2RlJyxcbiAgICAnQ2hhdCcsXG4gICAgJ3NoaWZ0K3RhYicsXG4gIClcbiAgY29uc3QgdGFza3MgPSB1c2VBcHBTdGF0ZShzID0+IHMudGFza3MpXG4gIGNvbnN0IHRlYW1Db250ZXh0ID0gdXNlQXBwU3RhdGUocyA9PiBzLnRlYW1Db250ZXh0KVxuICAvLyBTZXQgb25jZSBpbiBpbml0aWFsU3RhdGUgKG1haW4udHN4IC0tcmVtb3RlIG1vZGUpIGFuZCBuZXZlciBtdXRhdGVkIOKAlCBsYXp5XG4gIC8vIGluaXQgY2FwdHVyZXMgdGhlIGltbXV0YWJsZSB2YWx1ZSB3aXRob3V0IGEgc3Vic2NyaXB0aW9uLlxuICBjb25zdCBzdG9yZSA9IHVzZUFwcFN0YXRlU3RvcmUoKVxuICBjb25zdCBbcmVtb3RlU2Vzc2lvblVybF0gPSB1c2VTdGF0ZSgoKSA9PiBzdG9yZS5nZXRTdGF0ZSgpLnJlbW90ZVNlc3Npb25VcmwpXG4gIGNvbnN0IHZpZXdTZWxlY3Rpb25Nb2RlID0gdXNlQXBwU3RhdGUocyA9PiBzLnZpZXdTZWxlY3Rpb25Nb2RlKVxuICBjb25zdCB2aWV3aW5nQWdlbnRUYXNrSWQgPSB1c2VBcHBTdGF0ZShzID0+IHMudmlld2luZ0FnZW50VGFza0lkKVxuICBjb25zdCBleHBhbmRlZFZpZXcgPSB1c2VBcHBTdGF0ZShzID0+IHMuZXhwYW5kZWRWaWV3KVxuICBjb25zdCBzaG93U3Bpbm5lclRyZWUgPSBleHBhbmRlZFZpZXcgPT09ICd0ZWFtbWF0ZXMnXG4gIGNvbnN0IHByU3RhdHVzID0gdXNlUHJTdGF0dXMoaXNMb2FkaW5nLCBpc1ByU3RhdHVzRW5hYmxlZCgpKVxuICBjb25zdCBoYXNUbXV4U2Vzc2lvbiA9IHVzZUFwcFN0YXRlKFxuICAgIHMgPT5cbiAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgcy50dW5nc3RlbkFjdGl2ZVNlc3Npb24gIT09IHVuZGVmaW5lZCxcbiAgKVxuXG4gIGNvbnN0IG5leHRUaWNrQXQgPSB1c2VTeW5jRXh0ZXJuYWxTdG9yZShcbiAgICBwcm9hY3RpdmVNb2R1bGU/LnN1YnNjcmliZVRvUHJvYWN0aXZlQ2hhbmdlcyA/PyBOT19PUF9TVUJTQ1JJQkUsXG4gICAgcHJvYWN0aXZlTW9kdWxlPy5nZXROZXh0VGlja0F0ID8/IE5VTEwsXG4gICAgTlVMTCxcbiAgKVxuICAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gIGNvbnN0IHZvaWNlRW5hYmxlZCA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKSA/IHVzZVZvaWNlRW5hYmxlZCgpIDogZmFsc2VcbiAgY29uc3Qgdm9pY2VTdGF0ZSA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKVxuICAgID8gLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgICAgdXNlVm9pY2VTdGF0ZShzID0+IHMudm9pY2VTdGF0ZSlcbiAgICA6ICgnaWRsZScgYXMgY29uc3QpXG4gIGNvbnN0IHZvaWNlV2FybWluZ1VwID0gZmVhdHVyZSgnVk9JQ0VfTU9ERScpXG4gICAgPyAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gICAgICB1c2VWb2ljZVN0YXRlKHMgPT4gcy52b2ljZVdhcm1pbmdVcClcbiAgICA6IGZhbHNlXG4gIGNvbnN0IGhhc1NlbGVjdGlvbiA9IHVzZUhhc1NlbGVjdGlvbigpXG4gIGNvbnN0IHNlbEdldFN0YXRlID0gdXNlU2VsZWN0aW9uKCkuZ2V0U3RhdGVcbiAgY29uc3QgaGFzTmV4dFRpY2sgPSBuZXh0VGlja0F0ICE9PSBudWxsXG4gIGNvbnN0IGlzQ29vcmRpbmF0b3IgPSBmZWF0dXJlKCdDT09SRElOQVRPUl9NT0RFJylcbiAgICA/IGNvb3JkaW5hdG9yTW9kdWxlPy5pc0Nvb3JkaW5hdG9yTW9kZSgpID09PSB0cnVlXG4gICAgOiBmYWxzZVxuICBjb25zdCBydW5uaW5nVGFza0NvdW50ID0gdXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgY291bnQoXG4gICAgICAgIE9iamVjdC52YWx1ZXModGFza3MpLFxuICAgICAgICB0ID0+XG4gICAgICAgICAgaXNCYWNrZ3JvdW5kVGFzayh0KSAmJlxuICAgICAgICAgICEoXCJleHRlcm5hbFwiID09PSAnYW50JyAmJiBpc1BhbmVsQWdlbnRUYXNrKHQpKSxcbiAgICAgICksXG4gICAgW3Rhc2tzXSxcbiAgKVxuICBjb25zdCB0YXNrc1YyID0gdXNlVGFza3NWMigpXG4gIGNvbnN0IGhhc1Rhc2tJdGVtcyA9IHRhc2tzVjIgIT09IHVuZGVmaW5lZCAmJiB0YXNrc1YyLmxlbmd0aCA+IDBcbiAgY29uc3QgZXNjU2hvcnRjdXQgPSB1c2VTaG9ydGN1dERpc3BsYXkoXG4gICAgJ2NoYXQ6Y2FuY2VsJyxcbiAgICAnQ2hhdCcsXG4gICAgJ2VzYycsXG4gICkudG9Mb3dlckNhc2UoKVxuICBjb25zdCB0b2Rvc1Nob3J0Y3V0ID0gdXNlU2hvcnRjdXREaXNwbGF5KFxuICAgICdhcHA6dG9nZ2xlVG9kb3MnLFxuICAgICdHbG9iYWwnLFxuICAgICdjdHJsK3QnLFxuICApXG4gIGNvbnN0IGtpbGxBZ2VudHNTaG9ydGN1dCA9IHVzZVNob3J0Y3V0RGlzcGxheShcbiAgICAnY2hhdDpraWxsQWdlbnRzJyxcbiAgICAnQ2hhdCcsXG4gICAgJ2N0cmwreCBjdHJsK2snLFxuICApXG4gIGNvbnN0IHZvaWNlS2V5U2hvcnRjdXQgPSBmZWF0dXJlKCdWT0lDRV9NT0RFJylcbiAgICA/IC8vIGJpb21lLWlnbm9yZSBsaW50L2NvcnJlY3RuZXNzL3VzZUhvb2tBdFRvcExldmVsOiBmZWF0dXJlKCkgaXMgYSBjb21waWxlLXRpbWUgY29uc3RhbnRcbiAgICAgIHVzZVNob3J0Y3V0RGlzcGxheSgndm9pY2U6cHVzaFRvVGFsaycsICdDaGF0JywgJ1NwYWNlJylcbiAgICA6ICcnXG4gIC8vIENhcHR1cmVkIGF0IG1vdW50IHNvIHRoZSBoaW50IGRvZXNuJ3QgZmxpY2tlciBtaWQtc2Vzc2lvbiBpZiBhbm90aGVyXG4gIC8vIENDIGluc3RhbmNlIGluY3JlbWVudHMgdGhlIGNvdW50ZXIuIEluY3JlbWVudGVkIG9uY2UgdmlhIHVzZUVmZmVjdCB0aGVcbiAgLy8gZmlyc3QgdGltZSB2b2ljZSBpcyBlbmFibGVkIGluIHRoaXMgc2Vzc2lvbiDigJQgYXBwcm94aW1hdGVzIFwiaGludCB3YXNcbiAgLy8gc2hvd25cIiB3aXRob3V0IHRyYWNraW5nIHRoZSBleGFjdCByZW5kZXItdGltZSBjb25kaXRpb24gKHdoaWNoIGRlcGVuZHNcbiAgLy8gb24gcGFydHMvaGludFBhcnRzIGNvbXB1dGVkIGFmdGVyIHRoZSBlYXJseS1yZXR1cm4gaG9va3MgYm91bmRhcnkpLlxuICBjb25zdCBbdm9pY2VIaW50VW5kZXJDYXBdID0gZmVhdHVyZSgnVk9JQ0VfTU9ERScpXG4gICAgPyAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gICAgICB1c2VTdGF0ZShcbiAgICAgICAgKCkgPT5cbiAgICAgICAgICAoZ2V0R2xvYmFsQ29uZmlnKCkudm9pY2VGb290ZXJIaW50U2VlbkNvdW50ID8/IDApIDxcbiAgICAgICAgICBNQVhfVk9JQ0VfSElOVF9TSE9XUyxcbiAgICAgIClcbiAgICA6IFtmYWxzZV1cbiAgLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICBjb25zdCB2b2ljZUhpbnRJbmNyZW1lbnRlZFJlZiA9IGZlYXR1cmUoJ1ZPSUNFX01PREUnKSA/IHVzZVJlZihmYWxzZSkgOiBudWxsXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGZlYXR1cmUoJ1ZPSUNFX01PREUnKSkge1xuICAgICAgaWYgKCF2b2ljZUVuYWJsZWQgfHwgIXZvaWNlSGludFVuZGVyQ2FwKSByZXR1cm5cbiAgICAgIGlmICh2b2ljZUhpbnRJbmNyZW1lbnRlZFJlZj8uY3VycmVudCkgcmV0dXJuXG4gICAgICBpZiAodm9pY2VIaW50SW5jcmVtZW50ZWRSZWYpIHZvaWNlSGludEluY3JlbWVudGVkUmVmLmN1cnJlbnQgPSB0cnVlXG4gICAgICBjb25zdCBuZXdDb3VudCA9IChnZXRHbG9iYWxDb25maWcoKS52b2ljZUZvb3RlckhpbnRTZWVuQ291bnQgPz8gMCkgKyAxXG4gICAgICBzYXZlR2xvYmFsQ29uZmlnKHByZXYgPT4ge1xuICAgICAgICBpZiAoKHByZXYudm9pY2VGb290ZXJIaW50U2VlbkNvdW50ID8/IDApID49IG5ld0NvdW50KSByZXR1cm4gcHJldlxuICAgICAgICByZXR1cm4geyAuLi5wcmV2LCB2b2ljZUZvb3RlckhpbnRTZWVuQ291bnQ6IG5ld0NvdW50IH1cbiAgICAgIH0pXG4gICAgfVxuICB9LCBbdm9pY2VFbmFibGVkLCB2b2ljZUhpbnRVbmRlckNhcF0pXG4gIGNvbnN0IGlzS2lsbEFnZW50c0NvbmZpcm1TaG93aW5nID0gdXNlQXBwU3RhdGUoXG4gICAgcyA9PiBzLm5vdGlmaWNhdGlvbnMuY3VycmVudD8ua2V5ID09PSAna2lsbC1hZ2VudHMtY29uZmlybScsXG4gIClcblxuICAvLyBEZXJpdmUgdGVhbSBpbmZvIGZyb20gdGVhbUNvbnRleHQgKG5vIGZpbGVzeXN0ZW0gSS9PIG5lZWRlZClcbiAgLy8gTWF0Y2ggdGhlIHNhbWUgbG9naWMgYXMgVGVhbVN0YXR1cyB0byBhdm9pZCB0cmFpbGluZyBzZXBhcmF0b3JcbiAgLy8gSW4tcHJvY2VzcyBtb2RlIHVzZXMgU2hpZnQrRG93bi9VcCBuYXZpZ2F0aW9uLCBub3QgZm9vdGVyIHRlYW1zIG1lbnVcbiAgY29uc3QgaGFzVGVhbXMgPVxuICAgIGlzQWdlbnRTd2FybXNFbmFibGVkKCkgJiZcbiAgICAhaXNJblByb2Nlc3NFbmFibGVkKCkgJiZcbiAgICB0ZWFtQ29udGV4dCAhPT0gdW5kZWZpbmVkICYmXG4gICAgY291bnQoT2JqZWN0LnZhbHVlcyh0ZWFtQ29udGV4dC50ZWFtbWF0ZXMpLCB0ID0+IHQubmFtZSAhPT0gJ3RlYW0tbGVhZCcpID4gMFxuXG4gIGlmIChtb2RlID09PSAnYmFzaCcpIHtcbiAgICByZXR1cm4gPFRleHQgY29sb3I9XCJiYXNoQm9yZGVyXCI+ISBmb3IgYmFzaCBtb2RlPC9UZXh0PlxuICB9XG5cbiAgY29uc3QgY3VycmVudE1vZGUgPSB0b29sUGVybWlzc2lvbkNvbnRleHQ/Lm1vZGVcbiAgY29uc3QgaGFzQWN0aXZlTW9kZSA9ICFpc0RlZmF1bHRNb2RlKGN1cnJlbnRNb2RlKVxuICBjb25zdCB2aWV3ZWRUYXNrID0gdmlld2luZ0FnZW50VGFza0lkID8gdGFza3Nbdmlld2luZ0FnZW50VGFza0lkXSA6IHVuZGVmaW5lZFxuICBjb25zdCBpc1ZpZXdpbmdUZWFtbWF0ZSA9XG4gICAgdmlld1NlbGVjdGlvbk1vZGUgPT09ICd2aWV3aW5nLWFnZW50JyAmJlxuICAgIHZpZXdlZFRhc2s/LnR5cGUgPT09ICdpbl9wcm9jZXNzX3RlYW1tYXRlJ1xuICBjb25zdCBpc1ZpZXdpbmdDb21wbGV0ZWRUZWFtbWF0ZSA9XG4gICAgaXNWaWV3aW5nVGVhbW1hdGUgJiYgdmlld2VkVGFzayAhPSBudWxsICYmIHZpZXdlZFRhc2suc3RhdHVzICE9PSAncnVubmluZydcbiAgY29uc3QgaGFzQmFja2dyb3VuZFRhc2tzID0gcnVubmluZ1Rhc2tDb3VudCA+IDAgfHwgaXNWaWV3aW5nVGVhbW1hdGVcblxuICAvLyBDb3VudCBwcmltYXJ5IGl0ZW1zIChwZXJtaXNzaW9uIG1vZGUgb3IgY29vcmRpbmF0b3IgbW9kZSwgYmFja2dyb3VuZCB0YXNrcywgYW5kIHRlYW1zKVxuICBjb25zdCBwcmltYXJ5SXRlbUNvdW50ID1cbiAgICAoaXNDb29yZGluYXRvciB8fCBoYXNBY3RpdmVNb2RlID8gMSA6IDApICtcbiAgICAoaGFzQmFja2dyb3VuZFRhc2tzID8gMSA6IDApICtcbiAgICAoaGFzVGVhbXMgPyAxIDogMClcblxuICAvLyBQUiBpbmRpY2F0b3IgaXMgc2hvcnQgKH4xMCBjaGFycykg4oCUIHVubGlrZSB0aGUgb2xkIGRpZmYgaW5kaWNhdG9yIHRoZVxuICAvLyA+PTEwMCB0aHJlc2hvbGQgd2FzIHR1bmVkIGZvci4gTm93IHRoYXQgYXV0byBtb2RlIGlzIGVmZmVjdGl2ZWx5IHRoZVxuICAvLyBiYXNlbGluZSwgcHJpbWFyeUl0ZW1Db3VudCBpcyDiiaUxIGZvciBtb3N0IHNlc3Npb25zOyBrZWVwIHRoZSB0aHJlc2hvbGRcbiAgLy8gbG93IGVub3VnaCB0byBzaG93IFBSIHN0YXR1cyBvbiBzdGFuZGFyZCA4MC1jb2wgdGVybWluYWxzLlxuICBjb25zdCBzaG91bGRTaG93UHJTdGF0dXMgPVxuICAgIGlzUHJTdGF0dXNFbmFibGVkKCkgJiZcbiAgICBwclN0YXR1cy5udW1iZXIgIT09IG51bGwgJiZcbiAgICBwclN0YXR1cy5yZXZpZXdTdGF0ZSAhPT0gbnVsbCAmJlxuICAgIHByU3RhdHVzLnVybCAhPT0gbnVsbCAmJlxuICAgIHByaW1hcnlJdGVtQ291bnQgPCAyICYmXG4gICAgKHByaW1hcnlJdGVtQ291bnQgPT09IDAgfHwgY29sdW1ucyA+PSA4MClcblxuICAvLyBIaWRlIHRoZSBzaGlmdCt0YWIgaGludCB3aGVuIHRoZXJlIGFyZSAyIHByaW1hcnkgaXRlbXNcbiAgY29uc3Qgc2hvdWxkU2hvd01vZGVIaW50ID0gcHJpbWFyeUl0ZW1Db3VudCA8IDJcblxuICAvLyBDaGVjayBpZiB3ZSBoYXZlIGluLXByb2Nlc3MgdGVhbW1hdGVzIChzaG93aW5nIHBpbGxzKVxuICAvLyBJbiBzcGlubmVyLXRyZWUgbW9kZSwgcGlsbHMgYXJlIGRpc2FibGVkIC0gdGVhbW1hdGVzIGFwcGVhciBpbiB0aGUgc3Bpbm5lciB0cmVlIGluc3RlYWRcbiAgY29uc3QgaGFzSW5Qcm9jZXNzVGVhbW1hdGVzID1cbiAgICAhc2hvd1NwaW5uZXJUcmVlICYmXG4gICAgaGFzQmFja2dyb3VuZFRhc2tzICYmXG4gICAgT2JqZWN0LnZhbHVlcyh0YXNrcykuc29tZSh0ID0+IHQudHlwZSA9PT0gJ2luX3Byb2Nlc3NfdGVhbW1hdGUnKVxuICBjb25zdCBoYXNUZWFtbWF0ZVBpbGxzID1cbiAgICBoYXNJblByb2Nlc3NUZWFtbWF0ZXMgfHwgKCFzaG93U3Bpbm5lclRyZWUgJiYgaXNWaWV3aW5nVGVhbW1hdGUpXG5cbiAgLy8gSW4gcmVtb3RlIG1vZGUgKGBjbGF1ZGUgYXNzaXN0YW50YCwgLS10ZWxlcG9ydCkgdGhlIGFnZW50IHJ1bnMgZWxzZXdoZXJlO1xuICAvLyB0aGUgbG9jYWwgcGVybWlzc2lvbiBtb2RlIHNob3duIGhlcmUgZG9lc24ndCByZWZsZWN0IHRoZSBhZ2VudCdzIHN0YXRlLlxuICAvLyBSZW5kZXJlZCBiZWZvcmUgdGhlIHRhc2tzIHBpbGwgc28gYSBsb25nIHBpbGwgbGFiZWwgKGUuZy4gdWx0cmFwbGFuIFVSTClcbiAgLy8gZG9lc24ndCBwdXNoIHRoZSBtb2RlIGluZGljYXRvciBvZmYtc2NyZWVuLlxuICBjb25zdCBtb2RlUGFydCA9XG4gICAgY3VycmVudE1vZGUgJiYgaGFzQWN0aXZlTW9kZSAmJiAhZ2V0SXNSZW1vdGVNb2RlKCkgPyAoXG4gICAgICA8VGV4dCBjb2xvcj17Z2V0TW9kZUNvbG9yKGN1cnJlbnRNb2RlKX0ga2V5PVwibW9kZVwiPlxuICAgICAgICB7cGVybWlzc2lvbk1vZGVTeW1ib2woY3VycmVudE1vZGUpfXsnICd9XG4gICAgICAgIHtwZXJtaXNzaW9uTW9kZVRpdGxlKGN1cnJlbnRNb2RlKS50b0xvd2VyQ2FzZSgpfSBvblxuICAgICAgICB7c2hvdWxkU2hvd01vZGVIaW50ICYmIChcbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIHsnICd9XG4gICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgc2hvcnRjdXQ9e21vZGVDeWNsZVNob3J0Y3V0fVxuICAgICAgICAgICAgICBhY3Rpb249XCJjeWNsZVwiXG4gICAgICAgICAgICAgIHBhcmVuc1xuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICl9XG4gICAgICA8L1RleHQ+XG4gICAgKSA6IG51bGxcblxuICAvLyBCdWlsZCBwYXJ0cyBhcnJheSAtIGV4Y2x1ZGUgQmFja2dyb3VuZFRhc2tTdGF0dXMgd2hlbiB3ZSBoYXZlIHRlYW1tYXRlIHBpbGxzXG4gIC8vICh0ZWFtbWF0ZSBwaWxscyBnZXQgdGhlaXIgb3duIHJvdylcbiAgY29uc3QgcGFydHMgPSBbXG4gICAgLy8gUmVtb3RlIHNlc3Npb24gaW5kaWNhdG9yXG4gICAgLi4uKHJlbW90ZVNlc3Npb25VcmxcbiAgICAgID8gW1xuICAgICAgICAgIDxMaW5rIHVybD17cmVtb3RlU2Vzc2lvblVybH0ga2V5PVwicmVtb3RlXCI+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cImlkZVwiPntmaWd1cmVzLmNpcmNsZURvdWJsZX0gcmVtb3RlPC9UZXh0PlxuICAgICAgICAgIDwvTGluaz4sXG4gICAgICAgIF1cbiAgICAgIDogW10pLFxuICAgIC8vIEJhY2tncm91bmRUYXNrU3RhdHVzIGlzIE5PVCBpbiBwYXJ0cyDigJQgaXQgcmVuZGVycyBhcyBhIEJveCBzaWJsaW5nIHNvXG4gICAgLy8gaXRzIGNsaWNrLXRhcmdldCBCb3ggaXNuJ3QgbmVzdGVkIGluc2lkZSB0aGUgPFRleHQgd3JhcD1cInRydW5jYXRlXCI+XG4gICAgLy8gd3JhcHBlciAocmVjb25jaWxlciB0aHJvd3Mgb24gQm94LWluLVRleHQpLlxuICAgIC8vIFRtdXggcGlsbCAoYW50LW9ubHkpIOKAlCBhcHBlYXJzIHJpZ2h0IGFmdGVyIHRhc2tzIGluIG5hdiBvcmRlclxuICAgIC4uLihcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIGhhc1RtdXhTZXNzaW9uXG4gICAgICA/IFs8VHVuZ3N0ZW5QaWxsIGtleT1cInRtdXhcIiBzZWxlY3RlZD17dG11eFNlbGVjdGVkfSAvPl1cbiAgICAgIDogW10pLFxuICAgIC4uLihpc0FnZW50U3dhcm1zRW5hYmxlZCgpICYmIGhhc1RlYW1zXG4gICAgICA/IFtcbiAgICAgICAgICA8VGVhbVN0YXR1c1xuICAgICAgICAgICAga2V5PVwidGVhbXNcIlxuICAgICAgICAgICAgdGVhbXNTZWxlY3RlZD17dGVhbXNTZWxlY3RlZH1cbiAgICAgICAgICAgIHNob3dIaW50PXtzaG93SGludCAmJiAhaGFzQmFja2dyb3VuZFRhc2tzfVxuICAgICAgICAgIC8+LFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgICAuLi4oc2hvdWxkU2hvd1ByU3RhdHVzXG4gICAgICA/IFtcbiAgICAgICAgICA8UHJCYWRnZVxuICAgICAgICAgICAga2V5PVwicHItc3RhdHVzXCJcbiAgICAgICAgICAgIG51bWJlcj17cHJTdGF0dXMubnVtYmVyIX1cbiAgICAgICAgICAgIHVybD17cHJTdGF0dXMudXJsIX1cbiAgICAgICAgICAgIHJldmlld1N0YXRlPXtwclN0YXR1cy5yZXZpZXdTdGF0ZSF9XG4gICAgICAgICAgLz4sXG4gICAgICAgIF1cbiAgICAgIDogW10pLFxuICBdXG5cbiAgLy8gQ2hlY2sgaWYgYW55IGluLXByb2Nlc3MgdGVhbW1hdGVzIGV4aXN0IChmb3IgaGludCB0ZXh0IGN5Y2xpbmcpXG4gIGNvbnN0IGhhc0FueUluUHJvY2Vzc1RlYW1tYXRlcyA9IE9iamVjdC52YWx1ZXModGFza3MpLnNvbWUoXG4gICAgdCA9PiB0LnR5cGUgPT09ICdpbl9wcm9jZXNzX3RlYW1tYXRlJyAmJiB0LnN0YXR1cyA9PT0gJ3J1bm5pbmcnLFxuICApXG4gIGNvbnN0IGhhc1J1bm5pbmdBZ2VudFRhc2tzID0gT2JqZWN0LnZhbHVlcyh0YXNrcykuc29tZShcbiAgICB0ID0+IHQudHlwZSA9PT0gJ2xvY2FsX2FnZW50JyAmJiB0LnN0YXR1cyA9PT0gJ3J1bm5pbmcnLFxuICApXG5cbiAgLy8gR2V0IGhpbnQgcGFydHMgc2VwYXJhdGVseSBmb3IgcG90ZW50aWFsIHNlY29uZC1saW5lIHJlbmRlcmluZ1xuICBjb25zdCBoaW50UGFydHMgPSBzaG93SGludFxuICAgID8gZ2V0U3Bpbm5lckhpbnRQYXJ0cyhcbiAgICAgICAgaXNMb2FkaW5nLFxuICAgICAgICBlc2NTaG9ydGN1dCxcbiAgICAgICAgdG9kb3NTaG9ydGN1dCxcbiAgICAgICAga2lsbEFnZW50c1Nob3J0Y3V0LFxuICAgICAgICBoYXNUYXNrSXRlbXMsXG4gICAgICAgIGV4cGFuZGVkVmlldyxcbiAgICAgICAgaGFzQW55SW5Qcm9jZXNzVGVhbW1hdGVzLFxuICAgICAgICBoYXNSdW5uaW5nQWdlbnRUYXNrcyxcbiAgICAgICAgaXNLaWxsQWdlbnRzQ29uZmlybVNob3dpbmcsXG4gICAgICApXG4gICAgOiBbXVxuXG4gIGlmIChpc1ZpZXdpbmdDb21wbGV0ZWRUZWFtbWF0ZSkge1xuICAgIHBhcnRzLnB1c2goXG4gICAgICA8VGV4dCBkaW1Db2xvciBrZXk9XCJlc2MtcmV0dXJuXCI+XG4gICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludFxuICAgICAgICAgIHNob3J0Y3V0PXtlc2NTaG9ydGN1dH1cbiAgICAgICAgICBhY3Rpb249XCJyZXR1cm4gdG8gdGVhbSBsZWFkXCJcbiAgICAgICAgLz5cbiAgICAgIDwvVGV4dD4sXG4gICAgKVxuICB9IGVsc2UgaWYgKChmZWF0dXJlKCdQUk9BQ1RJVkUnKSB8fCBmZWF0dXJlKCdLQUlST1MnKSkgJiYgaGFzTmV4dFRpY2spIHtcbiAgICBwYXJ0cy5wdXNoKDxQcm9hY3RpdmVDb3VudGRvd24ga2V5PVwicHJvYWN0aXZlXCIgLz4pXG4gIH0gZWxzZSBpZiAoIWhhc1RlYW1tYXRlUGlsbHMgJiYgc2hvd0hpbnQpIHtcbiAgICBwYXJ0cy5wdXNoKC4uLmhpbnRQYXJ0cylcbiAgfVxuXG4gIC8vIFdoZW4gd2UgaGF2ZSB0ZWFtbWF0ZSBwaWxscywgYWx3YXlzIHJlbmRlciB0aGVtIG9uIHRoZWlyIG93biBsaW5lIGFib3ZlIG90aGVyIHBhcnRzXG4gIGlmIChoYXNUZWFtbWF0ZVBpbGxzKSB7XG4gICAgLy8gRG9uJ3QgYXBwZW5kIHNwaW5uZXIgaGludHMgd2hlbiB2aWV3aW5nIGEgY29tcGxldGVkIHRlYW1tYXRlIOKAlFxuICAgIC8vIHRoZSBcImVzYyB0byByZXR1cm4gdG8gdGVhbSBsZWFkXCIgaGludCBhbHJlYWR5IHJlcGxhY2VzIFwiZXNjIHRvIGludGVycnVwdFwiXG4gICAgY29uc3Qgb3RoZXJQYXJ0cyA9IFtcbiAgICAgIC4uLihtb2RlUGFydCA/IFttb2RlUGFydF0gOiBbXSksXG4gICAgICAuLi5wYXJ0cyxcbiAgICAgIC4uLihpc1ZpZXdpbmdDb21wbGV0ZWRUZWFtbWF0ZSA/IFtdIDogaGludFBhcnRzKSxcbiAgICBdXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8Qm94PlxuICAgICAgICAgIDxCYWNrZ3JvdW5kVGFza1N0YXR1c1xuICAgICAgICAgICAgdGFza3NTZWxlY3RlZD17dGFza3NTZWxlY3RlZH1cbiAgICAgICAgICAgIGlzVmlld2luZ1RlYW1tYXRlPXtpc1ZpZXdpbmdUZWFtbWF0ZX1cbiAgICAgICAgICAgIHRlYW1tYXRlRm9vdGVySW5kZXg9e3RlYW1tYXRlRm9vdGVySW5kZXh9XG4gICAgICAgICAgICBpc0xlYWRlcklkbGU9eyFpc0xvYWRpbmd9XG4gICAgICAgICAgICBvbk9wZW5EaWFsb2c9e29uT3BlblRhc2tzRGlhbG9nfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvQm94PlxuICAgICAgICB7b3RoZXJQYXJ0cy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgPEJ5bGluZT57b3RoZXJQYXJ0c308L0J5bGluZT5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIEFkZCBcIuKGkyB0byBtYW5hZ2UgdGFza3NcIiBoaW50IHdoZW4gcGFuZWwgaGFzIHZpc2libGUgcm93c1xuICBjb25zdCBoYXNDb29yZGluYXRvclRhc2tzID1cbiAgICBcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIGdldFZpc2libGVBZ2VudFRhc2tzKHRhc2tzKS5sZW5ndGggPiAwXG5cbiAgLy8gVGFza3MgcGlsbCByZW5kZXJzIGFzIGEgQm94IHNpYmxpbmcgKG5vdCBhIHBhcnRzIGVudHJ5KSBzbyBpdHNcbiAgLy8gY2xpY2stdGFyZ2V0IEJveCBpc24ndCBuZXN0ZWQgaW5zaWRlIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiPiDigJQgdGhlXG4gIC8vIHJlY29uY2lsZXIgdGhyb3dzIG9uIEJveC1pbi1UZXh0LiBDb21wdXRlZCBoZXJlIHNvIHRoZSBlbXB0eS1jaGVja3NcbiAgLy8gYmVsb3cgc3RpbGwgdHJlYXQgXCJwaWxsIHByZXNlbnRcIiBhcyBub24tZW1wdHkuXG4gIGNvbnN0IHRhc2tzUGFydCA9XG4gICAgaGFzQmFja2dyb3VuZFRhc2tzICYmXG4gICAgIWhhc1RlYW1tYXRlUGlsbHMgJiZcbiAgICAhc2hvdWxkSGlkZVRhc2tzRm9vdGVyKHRhc2tzLCBzaG93U3Bpbm5lclRyZWUpID8gKFxuICAgICAgPEJhY2tncm91bmRUYXNrU3RhdHVzXG4gICAgICAgIHRhc2tzU2VsZWN0ZWQ9e3Rhc2tzU2VsZWN0ZWR9XG4gICAgICAgIGlzVmlld2luZ1RlYW1tYXRlPXtpc1ZpZXdpbmdUZWFtbWF0ZX1cbiAgICAgICAgdGVhbW1hdGVGb290ZXJJbmRleD17dGVhbW1hdGVGb290ZXJJbmRleH1cbiAgICAgICAgaXNMZWFkZXJJZGxlPXshaXNMb2FkaW5nfVxuICAgICAgICBvbk9wZW5EaWFsb2c9e29uT3BlblRhc2tzRGlhbG9nfVxuICAgICAgLz5cbiAgICApIDogbnVsbFxuXG4gIGlmIChwYXJ0cy5sZW5ndGggPT09IDAgJiYgIXRhc2tzUGFydCAmJiAhbW9kZVBhcnQgJiYgc2hvd0hpbnQpIHtcbiAgICBwYXJ0cy5wdXNoKFxuICAgICAgPFRleHQgZGltQ29sb3Iga2V5PVwic2hvcnRjdXRzLWhpbnRcIj5cbiAgICAgICAgPyBmb3Igc2hvcnRjdXRzXG4gICAgICA8L1RleHQ+LFxuICAgIClcbiAgfVxuXG4gIC8vIE9ubHkgcmVwbGFjZSB0aGUgaWRsZSB2b2ljZSBoaW50IHdoZW4gdGhlcmUncyBzb21ldGhpbmcgdG8gc2F5IOKAlCBvdGhlcndpc2VcbiAgLy8gZmFsbCB0aHJvdWdoIGluc3RlYWQgb2Ygc2hvd2luZyBhbiBlbXB0eSBCeWxpbmUuIFwiZXNjIHRvIGNsZWFyXCIgd2FzIHJlbW92ZWRcbiAgLy8gKGxvb2tlZCBsaWtlIFwiZXNjIHRvIGludGVycnVwdFwiIHdoZW4gaWRsZTsgZXNjLWNsZWFycy1zZWxlY3Rpb24gaXMgc3RhbmRhcmRcbiAgLy8gVVgpIGxlYXZpbmcgb25seSBjdHJsK2MgKGNvcHlPblNlbGVjdCBvZmYpIGFuZCB0aGUgeHRlcm0uanMgbmF0aXZlLXNlbGVjdCBoaW50LlxuICBjb25zdCBjb3B5T25TZWxlY3QgPSBnZXRHbG9iYWxDb25maWcoKS5jb3B5T25TZWxlY3QgPz8gdHJ1ZVxuICBjb25zdCBzZWxlY3Rpb25IaW50SGFzQ29udGVudCA9IGhhc1NlbGVjdGlvbiAmJiAoIWNvcHlPblNlbGVjdCB8fCBpc1h0ZXJtSnMoKSlcblxuICAvLyBXYXJtdXAgaGludCB0YWtlcyBwcmlvcml0eSDigJQgd2hlbiB0aGUgdXNlciBpcyBhY3RpdmVseSBob2xkaW5nXG4gIC8vIHRoZSBhY3RpdmF0aW9uIGtleSwgc2hvdyBmZWVkYmFjayByZWdhcmRsZXNzIG9mIG90aGVyIGhpbnRzLlxuICBpZiAoZmVhdHVyZSgnVk9JQ0VfTU9ERScpICYmIHZvaWNlRW5hYmxlZCAmJiB2b2ljZVdhcm1pbmdVcCkge1xuICAgIHBhcnRzLnB1c2goPFZvaWNlV2FybXVwSGludCBrZXk9XCJ2b2ljZS13YXJtdXBcIiAvPilcbiAgfSBlbHNlIGlmIChpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgJiYgc2VsZWN0aW9uSGludEhhc0NvbnRlbnQpIHtcbiAgICAvLyB4dGVybS5qcyAoVlMgQ29kZS9DdXJzb3IvV2luZHN1cmYpIGZvcmNlLXNlbGVjdGlvbiBtb2RpZmllciBpc1xuICAgIC8vIHBsYXRmb3JtLXNwZWNpZmljIGFuZCBnYXRlZCBvbiBtYWNPUyAoU2VsZWN0aW9uU2VydmljZS5zaG91bGRGb3JjZVNlbGVjdGlvbik6XG4gICAgLy8gICBtYWNPUzogICAgIGFsdEtleSAmJiBtYWNPcHRpb25DbGlja0ZvcmNlc1NlbGVjdGlvbiAoVlMgQ29kZSBkZWZhdWx0OiBmYWxzZSlcbiAgICAvLyAgIG5vbi1tYWNPUzogc2hpZnRLZXlcbiAgICAvLyBPbiBtYWNPUywgaWYgd2UgUkVDRUlWRUQgYW4gYWx0K2NsaWNrIChsYXN0UHJlc3NIYWRBbHQpLCB0aGUgVlMgQ29kZVxuICAgIC8vIHNldHRpbmcgaXMgb2ZmIOKAlCB4dGVybS5qcyB3b3VsZCBoYXZlIGNvbnN1bWVkIHRoZSBldmVudCBvdGhlcndpc2UuXG4gICAgLy8gVGVsbCB0aGUgdXNlciB0aGUgZXhhY3Qgc2V0dGluZyB0byBmbGlwIGluc3RlYWQgb2YgcmVwZWF0aW5nIHRoZVxuICAgIC8vIG9wdGlvbitjbGljayBoaW50IHRoZXkganVzdCB0cmllZC5cbiAgICAvLyBOb24tcmVhY3RpdmUgZ2V0U3RhdGUoKSByZWFkIGlzIHNhZmU6IGxhc3RQcmVzc0hhZEFsdCBpcyBpbW11dGFibGVcbiAgICAvLyB3aGlsZSBoYXNTZWxlY3Rpb24gaXMgdHJ1ZSAoc2V0IHByZS1kcmFnLCBjbGVhcmVkIHdpdGggc2VsZWN0aW9uKS5cbiAgICBjb25zdCBpc01hYyA9IGdldFBsYXRmb3JtKCkgPT09ICdtYWNvcydcbiAgICBjb25zdCBhbHRDbGlja0ZhaWxlZCA9IGlzTWFjICYmIChzZWxHZXRTdGF0ZSgpPy5sYXN0UHJlc3NIYWRBbHQgPz8gZmFsc2UpXG4gICAgcGFydHMucHVzaChcbiAgICAgIDxUZXh0IGRpbUNvbG9yIGtleT1cInNlbGVjdGlvbi1jb3B5XCI+XG4gICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgeyFjb3B5T25TZWxlY3QgJiYgKFxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiY3RybCtjXCIgYWN0aW9uPVwiY29weVwiIC8+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7aXNYdGVybUpzKCkgJiZcbiAgICAgICAgICAgIChhbHRDbGlja0ZhaWxlZCA/IChcbiAgICAgICAgICAgICAgPFRleHQ+c2V0IG1hY09wdGlvbkNsaWNrRm9yY2VzU2VsZWN0aW9uIGluIFZTIENvZGUgc2V0dGluZ3M8L1RleHQ+XG4gICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICBzaG9ydGN1dD17aXNNYWMgPyAnb3B0aW9uK2NsaWNrJyA6ICdzaGlmdCtjbGljayd9XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwibmF0aXZlIHNlbGVjdFwiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICApKX1cbiAgICAgICAgPC9CeWxpbmU+XG4gICAgICA8L1RleHQ+LFxuICAgIClcbiAgfSBlbHNlIGlmIChcbiAgICBmZWF0dXJlKCdWT0lDRV9NT0RFJykgJiZcbiAgICBwYXJ0cy5sZW5ndGggPiAwICYmXG4gICAgc2hvd0hpbnQgJiZcbiAgICB2b2ljZUVuYWJsZWQgJiZcbiAgICB2b2ljZVN0YXRlID09PSAnaWRsZScgJiZcbiAgICBoaW50UGFydHMubGVuZ3RoID09PSAwICYmXG4gICAgdm9pY2VIaW50VW5kZXJDYXBcbiAgKSB7XG4gICAgcGFydHMucHVzaChcbiAgICAgIDxUZXh0IGRpbUNvbG9yIGtleT1cInZvaWNlLWhpbnRcIj5cbiAgICAgICAgaG9sZCB7dm9pY2VLZXlTaG9ydGN1dH0gdG8gc3BlYWtcbiAgICAgIDwvVGV4dD4sXG4gICAgKVxuICB9XG5cbiAgaWYgKCh0YXNrc1BhcnQgfHwgaGFzQ29vcmRpbmF0b3JUYXNrcykgJiYgc2hvd0hpbnQgJiYgIWhhc1RlYW1zKSB7XG4gICAgcGFydHMucHVzaChcbiAgICAgIDxUZXh0IGRpbUNvbG9yIGtleT1cIm1hbmFnZS10YXNrc1wiPlxuICAgICAgICB7dGFza3NTZWxlY3RlZCA/IChcbiAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cInZpZXcgdGFza3NcIiAvPlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIuKGk1wiIGFjdGlvbj1cIm1hbmFnZVwiIC8+XG4gICAgICAgICl9XG4gICAgICA8L1RleHQ+LFxuICAgIClcbiAgfVxuXG4gIC8vIEluIGZ1bGxzY3JlZW4gdGhlIGJvdHRvbSBzZWN0aW9uIGlzIGZsZXhTaHJpbms6MCDigJQgZXZlcnkgcm93IGhlcmVcbiAgLy8gaXMgYSByb3cgc3RvbGVuIGZyb20gdGhlIFNjcm9sbEJveC4gVGhpcyBjb21wb25lbnQgbXVzdCBoYXZlIGEgU1RBQkxFXG4gIC8vIGhlaWdodCBzbyB0aGUgZm9vdGVyIG5ldmVyIGdyb3dzL3Nocmlua3MgYW5kIHNoaWZ0cyBzY3JvbGwgY29udGVudC5cbiAgLy8gUmV0dXJuaW5nIG51bGwgd2hlbiBwYXJ0cyBpcyBlbXB0eSAoZS5nLiBTdGF0dXNMaW5lIG9uIOKGkiBzdXBwcmVzc0hpbnRcbiAgLy8g4oaSIHNob3dIaW50PWZhbHNlIOKGkiBubyBcIj8gZm9yIHNob3J0Y3V0c1wiKSB3b3VsZCBsZXQgYSBsYXRlci1hZGRlZFxuICAvLyBwYXJ0IChlLmcuIHRoZSBzZWxlY3Rpb24gY29weS9uYXRpdmUtc2VsZWN0IGhpbnRzKSBncm93IHRoZSBjb2x1bW5cbiAgLy8gZnJvbSAw4oaSMSByb3cuIEFsd2F5cyByZW5kZXIgMSByb3cgaW4gZnVsbHNjcmVlbjsgcmV0dXJuIGEgc3BhY2Ugd2hlblxuICAvLyBlbXB0eSBzbyBZb2dhIHJlc2VydmVzIHRoZSByb3cgd2l0aG91dCBwYWludGluZyBhbnl0aGluZyB2aXNpYmxlLlxuICBpZiAocGFydHMubGVuZ3RoID09PSAwICYmICF0YXNrc1BhcnQgJiYgIW1vZGVQYXJ0KSB7XG4gICAgcmV0dXJuIGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSA/IDxUZXh0PiA8L1RleHQ+IDogbnVsbFxuICB9XG5cbiAgLy8gZmxleFNocmluaz0wIGtlZXBzIG1vZGUgKyBwaWxsIGF0IG5hdHVyYWwgd2lkdGg7IHRoZSByZW1haW5pbmcgcGFydHNcbiAgLy8gdHJ1bmNhdGUgYXQgdGhlIHRhaWwgYXMgb25lIHN0cmluZyBpbnNpZGUgdGhlIFRleHQgd3JhcHBlci5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGhlaWdodD17MX0gb3ZlcmZsb3c9XCJoaWRkZW5cIj5cbiAgICAgIHttb2RlUGFydCAmJiAoXG4gICAgICAgIDxCb3ggZmxleFNocmluaz17MH0+XG4gICAgICAgICAge21vZGVQYXJ0fVxuICAgICAgICAgIHsodGFza3NQYXJ0IHx8IHBhcnRzLmxlbmd0aCA+IDApICYmIDxUZXh0IGRpbUNvbG9yPiDCtyA8L1RleHQ+fVxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG4gICAgICB7dGFza3NQYXJ0ICYmIChcbiAgICAgICAgPEJveCBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgICB7dGFza3NQYXJ0fVxuICAgICAgICAgIHtwYXJ0cy5sZW5ndGggPiAwICYmIDxUZXh0IGRpbUNvbG9yPiDCtyA8L1RleHQ+fVxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG4gICAgICB7cGFydHMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDxUZXh0IHdyYXA9XCJ0cnVuY2F0ZVwiPlxuICAgICAgICAgIDxCeWxpbmU+e3BhcnRzfTwvQnlsaW5lPlxuICAgICAgICA8L1RleHQ+XG4gICAgICApfVxuICAgIDwvQm94PlxuICApXG59XG5cbmZ1bmN0aW9uIGdldFNwaW5uZXJIaW50UGFydHMoXG4gIGlzTG9hZGluZzogYm9vbGVhbixcbiAgZXNjU2hvcnRjdXQ6IHN0cmluZyxcbiAgdG9kb3NTaG9ydGN1dDogc3RyaW5nLFxuICBraWxsQWdlbnRzU2hvcnRjdXQ6IHN0cmluZyxcbiAgaGFzVGFza0l0ZW1zOiBib29sZWFuLFxuICBleHBhbmRlZFZpZXc6ICdub25lJyB8ICd0YXNrcycgfCAndGVhbW1hdGVzJyxcbiAgaGFzVGVhbW1hdGVzOiBib29sZWFuLFxuICBoYXNSdW5uaW5nQWdlbnRUYXNrczogYm9vbGVhbixcbiAgaXNLaWxsQWdlbnRzQ29uZmlybVNob3dpbmc6IGJvb2xlYW4sXG4pOiBSZWFjdC5SZWFjdEVsZW1lbnRbXSB7XG4gIGxldCB0b2dnbGVBY3Rpb246IHN0cmluZ1xuICBpZiAoaGFzVGVhbW1hdGVzKSB7XG4gICAgLy8gQ3ljbGluZzogbm9uZSDihpIgdGFza3Mg4oaSIHRlYW1tYXRlcyDihpIgbm9uZVxuICAgIHN3aXRjaCAoZXhwYW5kZWRWaWV3KSB7XG4gICAgICBjYXNlICdub25lJzpcbiAgICAgICAgdG9nZ2xlQWN0aW9uID0gJ3Nob3cgdGFza3MnXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICd0YXNrcyc6XG4gICAgICAgIHRvZ2dsZUFjdGlvbiA9ICdzaG93IHRlYW1tYXRlcydcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ3RlYW1tYXRlcyc6XG4gICAgICAgIHRvZ2dsZUFjdGlvbiA9ICdoaWRlJ1xuICAgICAgICBicmVha1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0b2dnbGVBY3Rpb24gPSBleHBhbmRlZFZpZXcgPT09ICd0YXNrcycgPyAnaGlkZSB0YXNrcycgOiAnc2hvdyB0YXNrcydcbiAgfVxuXG4gIC8vIFNob3cgdGhlIHRvZ2dsZSBoaW50IG9ubHkgd2hlbiB0aGVyZSBhcmUgdGFzayBpdGVtcyB0byBkaXNwbGF5IG9yXG4gIC8vIHRlYW1tYXRlcyB0byBjeWNsZSB0b1xuICBjb25zdCBzaG93VG9nZ2xlSGludCA9IGhhc1Rhc2tJdGVtcyB8fCBoYXNUZWFtbWF0ZXNcblxuICByZXR1cm4gW1xuICAgIC4uLihpc0xvYWRpbmdcbiAgICAgID8gW1xuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGtleT1cImVzY1wiPlxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PXtlc2NTaG9ydGN1dH0gYWN0aW9uPVwiaW50ZXJydXB0XCIgLz5cbiAgICAgICAgICA8L1RleHQ+LFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgICAuLi4oIWlzTG9hZGluZyAmJiBoYXNSdW5uaW5nQWdlbnRUYXNrcyAmJiAhaXNLaWxsQWdlbnRzQ29uZmlybVNob3dpbmdcbiAgICAgID8gW1xuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGtleT1cImtpbGwtYWdlbnRzXCI+XG4gICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgc2hvcnRjdXQ9e2tpbGxBZ2VudHNTaG9ydGN1dH1cbiAgICAgICAgICAgICAgYWN0aW9uPVwic3RvcCBhZ2VudHNcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1RleHQ+LFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgICAuLi4oc2hvd1RvZ2dsZUhpbnRcbiAgICAgID8gW1xuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGtleT1cInRvZ2dsZS10YXNrc1wiPlxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgIHNob3J0Y3V0PXt0b2Rvc1Nob3J0Y3V0fVxuICAgICAgICAgICAgICBhY3Rpb249e3RvZ2dsZUFjdGlvbn1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9UZXh0PixcbiAgICAgICAgXVxuICAgICAgOiBbXSksXG4gIF1cbn1cblxuZnVuY3Rpb24gaXNQclN0YXR1c0VuYWJsZWQoKTogYm9vbGVhbiB7XG4gIHJldHVybiBnZXRH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dEosS0FBSyxDQUFDNkwsWUFBWSxFQUFFLENBQUM7RUFDdEIsSUFBSUMsWUFBWSxFQUFFLE1BQU07RUFDeEIsSUFBSUYsWUFBWSxFQUFFO0lBQ2hCO0lBQ0EsUUFBUXZFLFlBQVk7TUFDbEIsS0FBSyxNQUFNO1FBQ1R5RSxZQUFZLEdBQUcsWUFBWTtRQUMzQjtNQUNGLEtBQUssT0FBTztRQUNWQSxZQUFZLEdBQUcsZ0JBQWdCO1FBQy9CO01BQ0YsS0FBSyxXQUFXO1FBQ2RBLFlBQVksR0FBRyxNQUFNO1FBQ3JCO0lBQ0o7RUFDRixDQUFDLE1BQU07SUFDTEEsWUFBWSxHQUFHekUsWUFBWSxLQUFLLE9BQU8sR0FBRyxZQUFZLEdBQUcsWUFBWTtFQUN2RTs7RUFFQTtFQUNBO0VBQ0EsTUFBTTBFLGNBQWMsR0FBR3RELFlBQVksSUFBSW1ELFlBQVk7RUFFbkQsT0FBTyxDQUNMLElBQUlqSSxTQUFTLEdBQ1QsQ0FDRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUs7QUFDbEMsWUFBWSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxDQUFDZ0YsV0FBVyxDQUFDLENBQUMsTUFBTSxDQUFDLFdBQVc7QUFDM0UsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUNSLEdBQ0QsRUFBRSxDQUFDLEVBQ1AsSUFBSSxDQUFDaEYsU0FBUyxJQUFJcUgsb0JBQW9CLElBQUksQ0FBQzFCLDBCQUEwQixHQUNqRSxDQUNFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsYUFBYTtBQUMxQyxZQUFZLENBQUMsb0JBQW9CLENBQ25CLFFBQVEsQ0FBQyxDQUFDUixrQkFBa0IsQ0FBQyxDQUM3QixNQUFNLENBQUMsYUFBYTtBQUVsQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQ1IsR0FDRCxFQUFFLENBQUMsRUFDUCxJQUFJaUQsY0FBYyxHQUNkLENBQ0UsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjO0FBQzNDLFlBQVksQ0FBQyxvQkFBb0IsQ0FDbkIsUUFBUSxDQUFDLENBQUNsRCxhQUFhLENBQUMsQ0FDeEIsTUFBTSxDQUFDLENBQUNpRCxZQUFZLENBQUM7QUFFbkMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUNSLEdBQ0QsRUFBRSxDQUFDLENBQ1I7QUFDSDtBQUVBLFNBQVN0RSxpQkFBaUJBLENBQUEsQ0FBRSxFQUFFLE9BQU8sQ0FBQztFQUNwQyxPQUFPOUUsZUFBZSxDQUFDLENBQUMsQ0FBQ3NKLHFCQUFxQixJQUFJLElBQUk7QUFDeEQiLCJpZ25vcmVMaXN0IjpbXX0=