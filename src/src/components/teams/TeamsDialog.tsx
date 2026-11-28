import { c as _c } from "react/compiler-runtime";
import { randomUUID } from 'crypto';
import figures from 'figures';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInterval } from 'usehooks-ts';
import { useRegisterOverlay } from '../../context/overlayContext.js';
import { stringWidth } from '../../ink/stringWidth.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- raw j/k/arrow dialog navigation
import { Box, Text, useInput } from '../../ink.js';
import { useKeybindings } from '../../keybindings/useKeybinding.js';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay.js';
import { type AppState, useAppState, useSetAppState } from '../../state/AppState.js';
import { getEmptyToolPermissionContext } from '../../Tool.js';
import { AGENT_COLOR_TO_THEME_COLOR } from '../../tools/AgentTool/agentColorManager.js';
import { logForDebugging } from '../../utils/debug.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import { truncateToWidth } from '../../utils/format.js';
import { getNextPermissionMode } from '../../utils/permissions/getNextPermissionMode.js';
import { getModeColor, type PermissionMode, permissionModeFromString, permissionModeSymbol } from '../../utils/permissions/PermissionMode.js';
import { jsonStringify } from '../../utils/slowOperations.js';
import { IT2_COMMAND, isInsideTmuxSync } from '../../utils/swarm/backends/detection.js';
import { ensureBackendsRegistered, getBackendByType, getCachedBackend } from '../../utils/swarm/backends/registry.js';
import type { PaneBackendType } from '../../utils/swarm/backends/types.js';
import { getSwarmSocketName, TMUX_COMMAND } from '../../utils/swarm/constants.js';
import { addHiddenPaneId, removeHiddenPaneId, removeMemberFromTeam, setMemberMode, setMultipleMemberModes } from '../../utils/swarm/teamHelpers.js';
import { listTasks, type Task, unassignTeammateTasks } from '../../utils/tasks.js';
import { getTeammateStatuses, type TeammateStatus, type TeamSummary } from '../../utils/teamDiscovery.js';
import { createModeSetRequestMessage, sendShutdownRequestToMailbox, writeToMailbox } from '../../utils/teammateMailbox.js';
import { Dialog } from '../design-system/Dialog.js';
import ThemedText from '../design-system/ThemedText.js';
type Props = {
  initialTeams?: TeamSummary[];
  onDone: () => void;
};
type DialogLevel = {
  type: 'teammateList';
  teamName: string;
} | {
  type: 'teammateDetail';
  teamName: string;
  memberName: string;
};

/**
 * Dialog for viewing teammates in the current team
 */
export function TeamsDialog({
  initialTeams,
  onDone
}: Props): React.ReactNode {
  // Register as overlay so CancelRequestHandler doesn't intercept escape
  useRegisterOverlay('teams-dialog');

  // initialTeams is derived from teamContext in PromptInput (no filesystem I/O)
  const setAppState = useSetAppState();

  // Initialize dialogLevel with first team name if available
  const firstTeamName = initialTeams?.[0]?.name ?? '';
  const [dialogLevel, setDialogLevel] = useState<DialogLevel>({
    type: 'teammateList',
    teamName: firstTeamName
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // initialTeams is now always provided from PromptInput (derived from teamContext)
  // No filesystem I/O needed here

  const teammateStatuses = useMemo(() => {
    return getTeammateStatuses(dialogLevel.teamName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  }, [dialogLevel.teamName, refreshKey]);

  // Periodically refresh to pick up mode changes from teammates
  useInterval(() => {
    setRefreshKey(k => k + 1);
  }, 1000);
  const currentTeammate = useMemo(() => {
    if (dialogLevel.type !== 'teammateDetail') return null;
    return teammateStatuses.find(t => t.name === dialogLevel.memberName) ?? null;
  }, [dialogLevel, teammateStatuses]);

  // Get isBypassPermissionsModeAvailable from AppState
  const isBypassAvailable = useAppState(s => s.toolPermissionContext.isBypassPermissionsModeAvailable);
  const goBackToList = (): void => {
    setDialogLevel({
      type: 'teammateList',
      teamName: dialogLevel.teamName
    });
    setSelectedIndex(0);
  };

  // Handler for confirm:cycleMode - cycle teammate permission modes
  const handleCycleMode = useCallback(() => {
    if (dialogLevel.type === 'teammateDetail' && currentTeammate) {
      // Detail view: cycle just this teammate
      cycleTeammateMode(currentTeammate, dialogLevel.teamName, isBypassAvailable);
      setRefreshKey(k => k + 1);
    } else if (dialogLevel.type === 'teammateList' && teammateStatuses.length > 0) {
      // List view: cycle all teammates in tandem
      cycleAllTeammateModes(teammateStatuses, dialogLevel.teamName, isBypassAvailable);
      setRefreshKey(k => k + 1);
    }
  }, [dialogLevel, currentTeammate, teammateStatuses, isBypassAvailable]);

  // Use keybindings for mode cycling
  useKeybindings({
    'confirm:cycleMode': handleCycleMode
  }, {
    context: 'Confirmation'
  });
  useInput((input, key) => {
    // Handle left arrow to go back
    if (key.leftArrow) {
      if (dialogLevel.type === 'teammateDetail') {
        goBackToList();
      }
      return;
    }

    // Handle up/down navigation
    if (key.upArrow || key.downArrow) {
      const maxIndex = getMaxIndex();
      if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else {
        setSelectedIndex(prev => Math.min(maxIndex, prev + 1));
      }
      return;
    }

    // Handle Enter to drill down or view output
    if (key.return) {
      if (dialogLevel.type === 'teammateList' && teammateStatuses[selectedIndex]) {
        setDialogLevel({
          type: 'teammateDetail',
          teamName: dialogLevel.teamName,
          memberName: teammateStatuses[selectedIndex].name
        });
      } else if (dialogLevel.type === 'teammateDetail' && currentTeammate) {
        // View output - switch to tmux pane
        void viewTeammateOutput(currentTeammate.tmuxPaneId, currentTeammate.backendType);
        onDone();
      }
      return;
    }

    // Handle 'k' to kill teammate
    if (input === 'k') {
      if (dialogLevel.type === 'teammateList' && teammateStatuses[selectedIndex]) {
        void killTeammate(teammateStatuses[selectedIndex].tmuxPaneId, teammateStatuses[selectedIndex].backendType, dialogLevel.teamName, teammateStatuses[selectedIndex].agentId, teammateStatuses[selectedIndex].name, setAppState).then(() => {
          setRefreshKey(k => k + 1);
          // Adjust selection if needed
          setSelectedIndex(prev => Math.max(0, Math.min(prev, teammateStatuses.length - 2)));
        });
      } else if (dialogLevel.type === 'teammateDetail' && currentTeammate) {
        void killTeammate(currentTeammate.tmuxPaneId, currentTeammate.backendType, dialogLevel.teamName, currentTeammate.agentId, currentTeammate.name, setAppState);
        goBackToList();
      }
      return;
    }

    // Handle 's' for shutdown of selected teammate
    if (input === 's') {
      if (dialogLevel.type === 'teammateList' && teammateStatuses[selectedIndex]) {
        const teammate = teammateStatuses[selectedIndex];
        void sendShutdownRequestToMailbox(teammate.name, dialogLevel.teamName, 'Graceful shutdown requested by team lead');
      } else if (dialogLevel.type === 'teammateDetail' && currentTeammate) {
        void sendShutdownRequestToMailbox(currentTeammate.name, dialogLevel.teamName, 'Graceful shutdown requested by team lead');
        goBackToList();
      }
      return;
    }

    // Handle 'h' to hide/show individual teammate (only for backends that support it)
    if (input === 'h') {
      const backend = getCachedBackend();
      const teammate = dialogLevel.type === 'teammateList' ? teammateStatuses[selectedIndex] : dialogLevel.type === 'teammateDetail' ? currentTeammate : null;
      if (teammate && backend?.supportsHideShow) {
        void toggleTeammateVisibility(teammate, dialogLevel.teamName).then(() => {
          // Force refresh of teammate statuses
          setRefreshKey(k => k + 1);
        });
        if (dialogLevel.type === 'teammateDetail') {
          goBackToList();
        }
      }
      return;
    }

    // Handle 'H' to hide/show all teammates (only for backends that support it)
    if (input === 'H' && dialogLevel.type === 'teammateList') {
      const backend = getCachedBackend();
      if (backend?.supportsHideShow && teammateStatuses.length > 0) {
        // If any are visible, hide all. Otherwise, show all.
        const anyVisible = teammateStatuses.some(t => !t.isHidden);
        void Promise.all(teammateStatuses.map(t => anyVisible ? hideTeammate(t, dialogLevel.teamName) : showTeammate(t, dialogLevel.teamName))).then(() => {
          // Force refresh of teammate statuses
          setRefreshKey(k => k + 1);
        });
      }
      return;
    }

    // Handle 'p' to prune (kill) all idle teammates
    if (input === 'p' && dialogLevel.type === 'teammateList') {
      const idleTeammates = teammateStatuses.filter(t => t.status === 'idle');
      if (idleTeammates.length > 0) {
        void Promise.all(idleTeammates.map(t => killTeammate(t.tmuxPaneId, t.backendType, dialogLevel.teamName, t.agentId, t.name, setAppState))).then(() => {
          setRefreshKey(k => k + 1);
          setSelectedIndex(prev => Math.max(0, Math.min(prev, teammateStatuses.length - idleTeammates.length - 1)));
        });
      }
      return;
    }

    // Note: Mode cycling (shift+tab) is handled via useKeybindings with confirm:cycleMode action
  });
  function getMaxIndex(): number {
    if (dialogLevel.type === 'teammateList') {
      return Math.max(0, teammateStatuses.length - 1);
    }
    return 0;
  }

  // Render based on dialog level
  if (dialogLevel.type === 'teammateList') {
    return <TeamDetailView teamName={dialogLevel.teamName} teammates={teammateStatuses} selectedIndex={selectedIndex} onCancel={onDone} />;
  }
  if (dialogLevel.type === 'teammateDetail' && currentTeammate) {
    return <TeammateDetailView teammate={currentTeammate} teamName={dialogLevel.teamName} onCancel={goBackToList} />;
  }
  return null;
}
type TeamDetailViewProps = {
  teamName: string;
  teammates: TeammateStatus[];
  selectedIndex: number;
  onCancel: () => void;
};
function TeamDetailView(t0) {
  const $ = _c(13);
  const {
    teamName,
    teammates,
    selectedIndex,
    onCancel
  } = t0;
  const subtitle = `${teammates.length} ${teammates.length === 1 ? "teammate" : "teammates"}`;
  const supportsHideShow = getCachedBackend()?.supportsHideShow ?? false;
  const cycleModeShortcut = useShortcutDisplay("confirm:cycleMode", "Confirmation", "shift+tab");
  const t1 = `Team ${teamName}`;
  let t2;
  if ($[0] !== selectedIndex || $[1] !== teammates) {
    t2 = teammates.length === 0 ? <Text dimColor={true}>No teammates</Text> : <Box flexDirection="column">{teammates.map((teammate, index) => <TeammateListItem key={teammate.agentId} teammate={teammate} isSelected={index === selectedIndex} />)}</Box>;
    $[0] = selectedIndex;
    $[1] = teammates;
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  let t3;
  if ($[3] !== onCancel || $[4] !== subtitle || $[5] !== t1 || $[6] !== t2) {
    t3 = <Dialog title={t1} subtitle={subtitle} onCancel={onCancel} color="background" hideInputGuide={true}>{t2}</Dialog>;
    $[3] = onCancel;
    $[4] = subtitle;
    $[5] = t1;
    $[6] = t2;
    $[7] = t3;
  } else {
    t3 = $[7];
  }
  let t4;
  if ($[8] !== cycleModeShortcut) {
    t4 = <Box marginLeft={1}><Text dimColor={true}>{figures.arrowUp}/{figures.arrowDown} select · Enter view · k kill · s shutdown · p prune idle{supportsHideShow && " \xB7 h hide/show \xB7 H hide/show all"}{" \xB7 "}{cycleModeShortcut} sync cycle modes for all · Esc close</Text></Box>;
    $[8] = cycleModeShortcut;
    $[9] = t4;
  } else {
    t4 = $[9];
  }
  let t5;
  if ($[10] !== t3 || $[11] !== t4) {
    t5 = <>{t3}{t4}</>;
    $[10] = t3;
    $[11] = t4;
    $[12] = t5;
  } else {
    t5 = $[12];
  }
  return t5;
}
type TeammateListItemProps = {
  teammate: TeammateStatus;
  isSelected: boolean;
};
function TeammateListItem(t0) {
  const $ = _c(21);
  const {
    teammate,
    isSelected
  } = t0;
  const isIdle = teammate.status === "idle";
  const shouldDim = isIdle && !isSelected;
  let modeSymbol;
  let t1;
  if ($[0] !== teammate.mode) {
    const mode = teammate.mode ? permissionModeFromString(teammate.mode) : "default";
    modeSymbol = permissionModeSymbol(mode);
    t1 = getModeColor(mode);
    $[0] = teammate.mode;
    $[1] = modeSymbol;
    $[2] = t1;
  } else {
    modeSymbol = $[1];
    t1 = $[2];
  }
  const modeColor = t1;
  const t2 = isSelected ? "suggestion" : undefined;
  const t3 = isSelected ? figures.pointer + " " : "  ";
  let t4;
  if ($[3] !== teammate.isHidden) {
    t4 = teammate.isHidden && <Text dimColor={true}>[hidden] </Text>;
    $[3] = teammate.isHidden;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  let t5;
  if ($[5] !== isIdle) {
    t5 = isIdle && <Text dimColor={true}>[idle] </Text>;
    $[5] = isIdle;
    $[6] = t5;
  } else {
    t5 = $[6];
  }
  let t6;
  if ($[7] !== modeColor || $[8] !== modeSymbol) {
    t6 = modeSymbol && <Text color={modeColor}>{modeSymbol} </Text>;
    $[7] = modeColor;
    $[8] = modeSymbol;
    $[9] = t6;
  } else {
    t6 = $[9];
  }
  let t7;
  if ($[10] !== teammate.model) {
    t7 = teammate.model && <Text dimColor={true}> ({teammate.model})</Text>;
    $[10] = teammate.model;
    $[11] = t7;
  } else {
    t7 = $[11];
  }
  let t8;
  if ($[12] !== shouldDim || $[13] !== t2 || $[14] !== t3 || $[15] !== t4 || $[16] !== t5 || $[17] !== t6 || $[18] !== t7 || $[19] !== teammate.name) {
    t8 = <Text color={t2} dimColor={shouldDim}>{t3}{t4}{t5}{t6}@{teammate.name}{t7}</Text>;
    $[12] = shouldDim;
    $[13] = t2;
    $[14] = t3;
    $[15] = t4;
    $[16] = t5;
    $[17] = t6;
    $[18] = t7;
    $[19] = teammate.name;
    $[20] = t8;
  } else {
    t8 = $[20];
  }
  return t8;
}
type TeammateDetailViewProps = {
  teammate: TeammateStatus;
  teamName: string;
  onCancel: () => void;
};
function TeammateDetailView(t0) {
  const $ = _c(39);
  const {
    teammate,
    teamName,
    onCancel
  } = t0;
  const [promptExpanded, setPromptExpanded] = useState(false);
  const cycleModeShortcut = useShortcutDisplay("confirm:cycleMode", "Confirmation", "shift+tab");
  const themeColor = teammate.color ? AGENT_COLOR_TO_THEME_COLOR[teammate.color as keyof typeof AGENT_COLOR_TO_THEME_COLOR] : undefined;
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = [];
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  const [teammateTasks, setTeammateTasks] = useState(t1);
  let t2;
  let t3;
  if ($[1] !== teamName || $[2] !== teammate.agentId || $[3] !== teammate.name) {
    t2 = () => {
      let cancelled = false;
      listTasks(teamName).then(allTasks => {
        if (cancelled) {
          return;
        }
        setTeammateTasks(allTasks.filter(task => task.owner === teammate.agentId || task.owner === teammate.name));
      });
      return () => {
        cancelled = true;
      };
    };
    t3 = [teamName, teammate.agentId, teammate.name];
    $[1] = teamName;
    $[2] = teammate.agentId;
    $[3] = teammate.name;
    $[4] = t2;
    $[5] = t3;
  } else {
    t2 = $[4];
    t3 = $[5];
  }
  useEffect(t2, t3);
  let t4;
  if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
    t4 = input => {
      if (input === "p") {
        setPromptExpanded(_temp);
      }
    };
    $[6] = t4;
  } else {
    t4 = $[6];
  }
  useInput(t4);
  const workingPath = teammate.worktreePath || teammate.cwd;
  let subtitleParts;
  if ($[7] !== teammate.model || $[8] !== teammate.worktreePath || $[9] !== workingPath) {
    subtitleParts = [];
    if (teammate.model) {
      subtitleParts.push(teammate.model);
    }
    if (workingPath) {
      subtitleParts.push(teammate.worktreePath ? `worktree: ${workingPath}` : workingPath);
    }
    $[7] = teammate.model;
    $[8] = teammate.worktreePath;
    $[9] = workingPath;
    $[10] = subtitleParts;
  } else {
    subtitleParts = $[10];
  }
  const subtitle = subtitleParts.join(" \xB7 ") || undefined;
  let modeSymbol;
  let t5;
  if ($[11] !== teammate.mode) {
    const mode = teammate.mode ? permissionModeFromString(teammate.mode) : "default";
    modeSymbol = permissionModeSymbol(mode);
    t5 = getModeColor(mode);
    $[11] = teammate.mode;
    $[12] = modeSymbol;
    $[13] = t5;
  } else {
    modeSymbol = $[12];
    t5 = $[13];
  }
  const modeColor = t5;
  let t6;
  if ($[14] !== modeColor || $[15] !== modeSymbol) {
    t6 = modeSymbol && <Text color={modeColor}>{modeSymbol} </Text>;
    $[14] = modeColor;
    $[15] = modeSymbol;
    $[16] = t6;
  } else {
    t6 = $[16];
  }
  let t7;
  if ($[17] !== teammate.name || $[18] !== themeColor) {
    t7 = themeColor ? <ThemedText color={themeColor}>{`@${teammate.name}`}</ThemedText> : `@${teammate.name}`;
    $[17] = teammate.name;
    $[18] = themeColor;
    $[19] = t7;
  } else {
    t7 = $[19];
  }
  let t8;
  if ($[20] !== t6 || $[21] !== t7) {
    t8 = <>{t6}{t7}</>;
    $[20] = t6;
    $[21] = t7;
    $[22] = t8;
  } else {
    t8 = $[22];
  }
  const title = t8;
  let t9;
  if ($[23] !== teammateTasks) {
    t9 = teammateTasks.length > 0 && <Box flexDirection="column"><Text bold={true}>Tasks</Text>{teammateTasks.map(_temp2)}</Box>;
    $[23] = teammateTasks;
    $[24] = t9;
  } else {
    t9 = $[24];
  }
  let t10;
  if ($[25] !== promptExpanded || $[26] !== teammate.prompt) {
    t10 = teammate.prompt && <Box flexDirection="column"><Text bold={true}>Prompt</Text><Text>{promptExpanded ? teammate.prompt : truncateToWidth(teammate.prompt, 80)}{stringWidth(teammate.prompt) > 80 && !promptExpanded && <Text dimColor={true}> (p to expand)</Text>}</Text></Box>;
    $[25] = promptExpanded;
    $[26] = teammate.prompt;
    $[27] = t10;
  } else {
    t10 = $[27];
  }
  let t11;
  if ($[28] !== onCancel || $[29] !== subtitle || $[30] !== t10 || $[31] !== t9 || $[32] !== title) {
    t11 = <Dialog title={title} subtitle={subtitle} onCancel={onCancel} color="background" hideInputGuide={true}>{t9}{t10}</Dialog>;
    $[28] = onCancel;
    $[29] = subtitle;
    $[30] = t10;
    $[31] = t9;
    $[32] = title;
    $[33] = t11;
  } else {
    t11 = $[33];
  }
  let t12;
  if ($[34] !== cycleModeShortcut) {
    t12 = <Box marginLeft={1}><Text dimColor={true}>{figures.arrowLeft} back · Esc close · k kill · s shutdown{getCachedBackend()?.supportsHideShow && " \xB7 h hide/show"}{" \xB7 "}{cycleModeShortcut} cycle mode</Text></Box>;
    $[34] = cycleModeShortcut;
    $[35] = t12;
  } else {
    t12 = $[35];
  }
  let t13;
  if ($[36] !== t11 || $[37] !== t12) {
    t13 = <>{t11}{t12}</>;
    $[36] = t11;
    $[37] = t12;
    $[38] = t13;
  } else {
    t13 = $[38];
  }
  return t13;
}
function _temp2(task_0) {
  return <Text key={task_0.id} color={task_0.status === "completed" ? "success" : undefined}>{task_0.status === "completed" ? figures.tick : "\u25FC"}{" "}{task_0.subject}</Text>;
}
function _temp(prev) {
  return !prev;
}
async function killTeammate(paneId: string, backendType: PaneBackendType | undefined, teamName: string, teammateId: string, teammateName: string, setAppState: (f: (prev: AppState) => AppState) => void): Promise<void> {
  // Kill the pane using the backend that created it (handles -s / -L flags correctly).
  // Wrapped in try/catch so cleanup (removeMemberFromTeam, unassignTeammateTasks,
  // setAppState) always runs — matches useInboxPoller.ts error isolation.
  if (backendType) {
    try {
      // Use ensureBackendsRegistered (not detectAndGetBackend) — this process may
      // be a teammate that never ran detection, but we only need class imports
      // here, not subprocess probes that could throw in a different environment.
      await ensureBackendsRegistered();
      await getBackendByType(backendType).killPane(paneId, !isInsideTmuxSync());
    } catch (error) {
      logForDebugging(`[TeamsDialog] Failed to kill pane ${paneId}: ${error}`);
    }
  } else {
    // backendType undefined: old team files predating this field, or in-process.
    // Old tmux-file case is a migration gap — the pane is orphaned. In-process
    // teammates have no pane to kill, so this is correct for them.
    logForDebugging(`[TeamsDialog] Skipping pane kill for ${paneId}: no backendType recorded`);
  }
  // Remove from team config file
  removeMemberFromTeam(teamName, paneId);

  // Unassign tasks and build notification message
  const {
    notificationMessage
  } = await unassignTeammateTasks(teamName, teammateId, teammateName, 'terminated');

  // Update AppState to keep status line in sync and notify the lead
  setAppState(prev => {
    if (!prev.teamContext?.teammates) return prev;
    if (!(teammateId in prev.teamContext.teammates)) return prev;
    const {
      [teammateId]: _,
      ...remainingTeammates
    } = prev.teamContext.teammates;
    return {
      ...prev,
      teamContext: {
        ...prev.teamContext,
        teammates: remainingTeammates
      },
      inbox: {
        messages: [...prev.inbox.messages, {
          id: randomUUID(),
          from: 'system',
          text: jsonStringify({
            type: 'teammate_terminated',
            message: notificationMessage
          }),
          timestamp: new Date().toISOString(),
          status: 'pending' as const
        }]
      }
    };
  });
  logForDebugging(`[TeamsDialog] Removed ${teammateId} from teamContext`);
}
async function viewTeammateOutput(paneId: string, backendType: PaneBackendType | undefined): Promise<void> {
  if (backendType === 'iterm2') {
    // -s is required to target a specific session (ITermBackend.ts:216-217)
    await execFileNoThrow(IT2_COMMAND, ['session', 'focus', '-s', paneId]);
  } else {
    // External-tmux teammates live on the swarm socket — without -L, this
    // targets the default server and silently no-ops. Mirrors runTmuxInSwarm
    // in TmuxBackend.ts:85-89.
    const args = isInsideTmuxSync() ? ['select-pane', '-t', paneId] : ['-L', getSwarmSocketName(), 'select-pane', '-t', paneId];
    await execFileNoThrow(TMUX_COMMAND, args);
  }
}

/**
 * Toggle visibility of a teammate pane (hide if visible, show if hidden)
 */
async function toggleTeammateVisibility(teammate: TeammateStatus, teamName: string): Promise<void> {
  if (teammate.isHidden) {
    await showTeammate(teammate, teamName);
  } else {
    await hideTeammate(teammate, teamName);
  }
}

/**
 * Hide a teammate pane using the backend abstraction.
 * Only available for ant users (gated for dead code elimination in external builds)
 */
async function hideTeammate(teammate: TeammateStatus, teamName: string): Promise<void> {}

/**
 * Show a previously hidden teammate pane using the backend abstraction.
 * Only available for ant users (gated for dead code elimination in external builds)
 */
async function showTeammate(teammate: TeammateStatus, teamName: string): Promise<void> {}

/**
 * Send a mode change message to a single teammate
 * Also updates config.json directly so the UI reflects the change immediately
 */
function sendModeChangeToTeammate(teammateName: string, teamName: string, targetMode: PermissionMode): void {
  // Update config.json directly so UI shows the change immediately
  setMemberMode(teamName, teammateName, targetMode);

  // Also send message so teammate updates their local permission context
  const message = createModeSetRequestMessage({
    mode: targetMode,
    from: 'team-lead'
  });
  void writeToMailbox(teammateName, {
    from: 'team-lead',
    text: jsonStringify(message),
    timestamp: new Date().toISOString()
  }, teamName);
  logForDebugging(`[TeamsDialog] Sent mode change to ${teammateName}: ${targetMode}`);
}

/**
 * Cycle a single teammate's mode
 */
function cycleTeammateMode(teammate: TeammateStatus, teamName: string, isBypassAvailable: boolean): void {
  const currentMode = teammate.mode ? permissionModeFromString(teammate.mode) : 'default';
  const context = {
    ...getEmptyToolPermissionContext(),
    mode: currentMode,
    isBypassPermissionsModeAvailable: isBypassAvailable
  };
  const nextMode = getNextPermissionMode(context);
  sendModeChangeToTeammate(teammate.name, teamName, nextMode);
}

/**
 * Cycle all teammates' modes in tandem
 * If modes differ, reset all to default first
 * If same, cycle all to next mode
 * Uses batch update to avoid race conditions
 */
function cycleAllTeammateModes(teammates: TeammateStatus[], teamName: string, isBypassAvailable: boolean): void {
  if (teammates.length === 0) return;
  const modes = teammates.map(t => t.mode ? permissionModeFromString(t.mode) : 'default');
  const allSame = modes.every(m => m === modes[0]);

  // Determine target mode for all teammates
  const targetMode = !allSame ? 'default' : getNextPermissionMode({
    ...getEmptyToolPermissionContext(),
    mode: modes[0] ?? 'default',
    isBypassPermissionsModeAvailable: isBypassAvailable
  });

  // Batch update config.json in a single atomic operation
  const modeUpdates = teammates.map(t => ({
    memberName: t.name,
    mode: targetMode
  }));
  setMultipleMemberModes(teamName, modeUpdates);

  // Send mailbox messages to each teammate
  for (const teammate of teammates) {
    const message = createModeSetRequestMessage({
      mode: targetMode,
      from: 'team-lead'
    });
    void writeToMailbox(teammate.name, {
      from: 'team-lead',
      text: jsonStringify(message),
      timestamp: new Date().toISOString()
    }, teamName);
  }
  logForDebugging(`[TeamsDialog] Sent mode change to all ${teammates.length} teammates: ${targetMode}`);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJyYW5kb21VVUlEIiwiZmlndXJlcyIsIlJlYWN0IiwidXNlQ2FsbGJhY2siLCJ1c2VFZmZlY3QiLCJ1c2VNZW1vIiwidXNlU3RhdGUiLCJ1c2VJbnRlcnZhbCIsInVzZVJlZ2lzdGVyT3ZlcmxheSIsInN0cmluZ1dpZHRoIiwiQm94IiwiVGV4dCIsInVzZUlucHV0IiwidXNlS2V5YmluZGluZ3MiLCJ1c2VTaG9ydGN1dERpc3BsYXkiLCJBcHBTdGF0ZSIsInVzZUFwcFN0YXRlIiwidXNlU2V0QXBwU3RhdGUiLCJnZXRFbXB0eVRvb2xQZXJtaXNzaW9uQ29udGV4dCIsIkFHRU5UX0NPTE9SX1RPX1RIRU1FX0NPTE9SIiwibG9nRm9yRGVidWdnaW5nIiwiZXhlY0ZpbGVOb1Rocm93IiwidHJ1bmNhdGVUb1dpZHRoIiwiZ2V0TmV4dFBlcm1pc3Npb25Nb2RlIiwiZ2V0TW9kZUNvbG9yIiwiUGVybWlzc2lvbk1vZGUiLCJwZXJtaXNzaW9uTW9kZUZyb21TdHJpbmciLCJwZXJtaXNzaW9uTW9kZVN5bWJvbCIsImpzb25TdHJpbmdpZnkiLCJJVDJfQ09NTUFORCIsImlzSW5zaWRlVG11eFN5bmMiLCJlbnN1cmVCYWNrZW5kc1JlZ2lzdGVyZWQiLCJnZXRCYWNrZW5kQnlUeXBlIiwiZ2V0Q2FjaGVkQmFja2VuZCIsIlBhbmVCYWNrZW5kVHlwZSIsImdldFN3YXJtU29ja2V0TmFtZSIsIlRNVVhfQ09NTUFORCIsImFkZEhpZGRlblBhbmVJZCIsInJlbW92ZUhpZGRlblBhbmVJZCIsInJlbW92ZU1lbWJlckZyb21UZWFtIiwic2V0TWVtYmVyTW9kZSIsInNldE11bHRpcGxlTWVtYmVyTW9kZXMiLCJsaXN0VGFza3MiLCJUYXNrIiwidW5hc3NpZ25UZWFtbWF0ZVRhc2tzIiwiZ2V0VGVhbW1hdGVTdGF0dXNlcyIsIlRlYW1tYXRlU3RhdHVzIiwiVGVhbVN1bW1hcnkiLCJjcmVhdGVNb2RlU2V0UmVxdWVzdE1lc3NhZ2UiLCJzZW5kU2h1dGRvd25SZXF1ZXN0VG9NYWlsYm94Iiwid3JpdGVUb01haWxib3giLCJEaWFsb2ciLCJUaGVtZWRUZXh0IiwiUHJvcHMiLCJpbml0aWFsVGVhbXMiLCJvbkRvbmUiLCJEaWFsb2dMZXZlbCIsInR5cGUiLCJ0ZWFtTmFtZSIsIm1lbWJlck5hbWUiLCJUZWFtc0RpYWxvZyIsIlJlYWN0Tm9kZSIsInNldEFwcFN0YXRlIiwiZmlyc3RUZWFtTmFtZSIsIm5hbWUiLCJkaWFsb2dMZXZlbCIsInNldERpYWxvZ0xldmVsIiwic2VsZWN0ZWRJbmRleCIsInNldFNlbGVjdGVkSW5kZXgiLCJyZWZyZXNoS2V5Iiwic2V0UmVmcmVzaEtleSIsInRlYW1tYXRlU3RhdHVzZXMiLCJrIiwiY3VycmVudFRlYW1tYXRlIiwiZmluZCIsInQiLCJpc0J5cGFzc0F2YWlsYWJsZSIsInMiLCJ0b29sUGVybWlzc2lvbkNvbnRleHQiLCJpc0J5cGFzc1Blcm1pc3Npb25zTW9kZUF2YWlsYWJsZSIsImdvQmFja1RvTGlzdCIsImhhbmRsZUN5Y2xlTW9kZSIsImN5Y2xlVGVhbW1hdGVNb2RlIiwibGVuZ3RoIiwiY3ljbGVBbGxUZWFtbWF0ZU1vZGVzIiwiY29udGV4dCIsImlucHV0Iiwia2V5IiwibGVmdEFycm93IiwidXBBcnJvdyIsImRvd25BcnJvdyIsIm1heEluZGV4IiwiZ2V0TWF4SW5kZXgiLCJwcmV2IiwiTWF0aCIsIm1heCIsIm1pbiIsInJldHVybiIsInZpZXdUZWFtbWF0ZU91dHB1dCIsInRtdXhQYW5lSWQiLCJiYWNrZW5kVHlwZSIsImtpbGxUZWFtbWF0ZSIsImFnZW50SWQiLCJ0aGVuIiwidGVhbW1hdGUiLCJiYWNrZW5kIiwic3VwcG9ydHNIaWRlU2hvdyIsInRvZ2dsZVRlYW1tYXRlVmlzaWJpbGl0eSIsImFueVZpc2libGUiLCJzb21lIiwiaXNIaWRkZW4iLCJQcm9taXNlIiwiYWxsIiwibWFwIiwiaGlkZVRlYW1tYXRlIiwic2hvd1RlYW1tYXRlIiwiaWRsZVRlYW1tYXRlcyIsImZpbHRlciIsInN0YXR1cyIsIlRlYW1EZXRhaWxWaWV3UHJvcHMiLCJ0ZWFtbWF0ZXMiLCJvbkNhbmNlbCIsIlRlYW1EZXRhaWxWaWV3IiwidDAiLCIkIiwiX2MiLCJzdWJ0aXRsZSIsImN5Y2xlTW9kZVNob3J0Y3V0IiwidDEiLCJ0MiIsImluZGV4IiwidDMiLCJ0NCIsImFycm93VXAiLCJhcnJvd0Rvd24iLCJ0NSIsIlRlYW1tYXRlTGlzdEl0ZW1Qcm9wcyIsImlzU2VsZWN0ZWQiLCJUZWFtbWF0ZUxpc3RJdGVtIiwiaXNJZGxlIiwic2hvdWxkRGltIiwibW9kZVN5bWJvbCIsIm1vZGUiLCJtb2RlQ29sb3IiLCJ1bmRlZmluZWQiLCJwb2ludGVyIiwidDYiLCJ0NyIsIm1vZGVsIiwidDgiLCJUZWFtbWF0ZURldGFpbFZpZXdQcm9wcyIsIlRlYW1tYXRlRGV0YWlsVmlldyIsInByb21wdEV4cGFuZGVkIiwic2V0UHJvbXB0RXhwYW5kZWQiLCJ0aGVtZUNvbG9yIiwiY29sb3IiLCJTeW1ib2wiLCJmb3IiLCJ0ZWFtbWF0ZVRhc2tzIiwic2V0VGVhbW1hdGVUYXNrcyIsImNhbmNlbGxlZCIsImFsbFRhc2tzIiwidGFzayIsIm93bmVyIiwiX3RlbXAiLCJ3b3JraW5nUGF0aCIsIndvcmt0cmVlUGF0aCIsImN3ZCIsInN1YnRpdGxlUGFydHMiLCJwdXNoIiwiam9pbiIsInRpdGxlIiwidDkiLCJfdGVtcDIiLCJ0MTAiLCJwcm9tcHQiLCJ0MTEiLCJ0MTIiLCJhcnJvd0xlZnQiLCJ0MTMiLCJ0YXNrXzAiLCJpZCIsInRpY2siLCJzdWJqZWN0IiwicGFuZUlkIiwidGVhbW1hdGVJZCIsInRlYW1tYXRlTmFtZSIsImYiLCJraWxsUGFuZSIsImVycm9yIiwibm90aWZpY2F0aW9uTWVzc2FnZSIsInRlYW1Db250ZXh0IiwiXyIsInJlbWFpbmluZ1RlYW1tYXRlcyIsImluYm94IiwibWVzc2FnZXMiLCJmcm9tIiwidGV4dCIsIm1lc3NhZ2UiLCJ0aW1lc3RhbXAiLCJEYXRlIiwidG9JU09TdHJpbmciLCJjb25zdCIsImFyZ3MiLCJzZW5kTW9kZUNoYW5nZVRvVGVhbW1hdGUiLCJ0YXJnZXRNb2RlIiwiY3VycmVudE1vZGUiLCJuZXh0TW9kZSIsIm1vZGVzIiwiYWxsU2FtZSIsImV2ZXJ5IiwibSIsIm1vZGVVcGRhdGVzIl0sInNvdXJjZXMiOlsiVGVhbXNEaWFsb2cudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJhbmRvbVVVSUQgfSBmcm9tICdjcnlwdG8nXG5pbXBvcnQgZmlndXJlcyBmcm9tICdmaWd1cmVzJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VNZW1vLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlSW50ZXJ2YWwgfSBmcm9tICd1c2Vob29rcy10cydcbmltcG9ydCB7IHVzZVJlZ2lzdGVyT3ZlcmxheSB9IGZyb20gJy4uLy4uL2NvbnRleHQvb3ZlcmxheUNvbnRleHQuanMnXG5pbXBvcnQgeyBzdHJpbmdXaWR0aCB9IGZyb20gJy4uLy4uL2luay9zdHJpbmdXaWR0aC5qcydcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvcHJlZmVyLXVzZS1rZXliaW5kaW5ncyAtLSByYXcgai9rL2Fycm93IGRpYWxvZyBuYXZpZ2F0aW9uXG5pbXBvcnQgeyBCb3gsIFRleHQsIHVzZUlucHV0IH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlS2V5YmluZGluZ3MgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHsgdXNlU2hvcnRjdXREaXNwbGF5IH0gZnJvbSAnLi4vLi4va2V5YmluZGluZ3MvdXNlU2hvcnRjdXREaXNwbGF5LmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBcHBTdGF0ZSxcbiAgdXNlQXBwU3RhdGUsXG4gIHVzZVNldEFwcFN0YXRlLFxufSBmcm9tICcuLi8uLi9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB7IGdldEVtcHR5VG9vbFBlcm1pc3Npb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vVG9vbC5qcydcbmltcG9ydCB7IEFHRU5UX0NPTE9SX1RPX1RIRU1FX0NPTE9SIH0gZnJvbSAnLi4vLi4vdG9vbHMvQWdlbnRUb29sL2FnZW50Q29sb3JNYW5hZ2VyLmpzJ1xuaW1wb3J0IHsgbG9nRm9yRGVidWdnaW5nIH0gZnJvbSAnLi4vLi4vdXRpbHMvZGVidWcuanMnXG5pbXBvcnQgeyBleGVjRmlsZU5vVGhyb3cgfSBmcm9tICcuLi8uLi91dGlscy9leGVjRmlsZU5vVGhyb3cuanMnXG5pbXBvcnQgeyB0cnVuY2F0ZVRvV2lkdGggfSBmcm9tICcuLi8uLi91dGlscy9mb3JtYXQuanMnXG5pbXBvcnQgeyBnZXROZXh0UGVybWlzc2lvbk1vZGUgfSBmcm9tICcuLi8uLi91dGlscy9wZXJtaXNzaW9ucy9nZXROZXh0UGVybWlzc2lvbk1vZGUuanMnXG5pbXBvcnQge1xuICBnZXRNb2RlQ29sb3IsXG4gIHR5cGUgUGVybWlzc2lvbk1vZGUsXG4gIHBlcm1pc3Npb25Nb2RlRnJvbVN0cmluZyxcbiAgcGVybWlzc2lvbk1vZGVTeW1ib2wsXG59IGZyb20gJy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL1Blcm1pc3Npb25Nb2RlLmpzJ1xuaW1wb3J0IHsganNvblN0cmluZ2lmeSB9IGZyb20gJy4uLy4uL3V0aWxzL3Nsb3dPcGVyYXRpb25zLmpzJ1xuaW1wb3J0IHtcbiAgSVQyX0NPTU1BTkQsXG4gIGlzSW5zaWRlVG11eFN5bmMsXG59IGZyb20gJy4uLy4uL3V0aWxzL3N3YXJtL2JhY2tlbmRzL2RldGVjdGlvbi5qcydcbmltcG9ydCB7XG4gIGVuc3VyZUJhY2tlbmRzUmVnaXN0ZXJlZCxcbiAgZ2V0QmFja2VuZEJ5VHlwZSxcbiAgZ2V0Q2FjaGVkQmFja2VuZCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvc3dhcm0vYmFja2VuZHMvcmVnaXN0cnkuanMnXG5pbXBvcnQgdHlwZSB7IFBhbmVCYWNrZW5kVHlwZSB9IGZyb20gJy4uLy4uL3V0aWxzL3N3YXJtL2JhY2tlbmRzL3R5cGVzLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0U3dhcm1Tb2NrZXROYW1lLFxuICBUTVVYX0NPTU1BTkQsXG59IGZyb20gJy4uLy4uL3V0aWxzL3N3YXJtL2NvbnN0YW50cy5qcydcbmltcG9ydCB7XG4gIGFkZEhpZGRlblBhbmVJZCxcbiAgcmVtb3ZlSGlkZGVuUGFuZUlkLFxuICByZW1vdmVNZW1iZXJGcm9tVGVhbSxcbiAgc2V0TWVtYmVyTW9kZSxcbiAgc2V0TXVsdGlwbGVNZW1iZXJNb2Rlcyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvc3dhcm0vdGVhbUhlbHBlcnMuanMnXG5pbXBvcnQge1xuICBsaXN0VGFza3MsXG4gIHR5cGUgVGFzayxcbiAgdW5hc3NpZ25UZWFtbWF0ZVRhc2tzLFxufSBmcm9tICcuLi8uLi91dGlscy90YXNrcy5qcydcbmltcG9ydCB7XG4gIGdldFRlYW1tYXRlU3RhdHVzZXMsXG4gIHR5cGUgVGVhbW1hdGVTdGF0dXMsXG4gIHR5cGUgVGVhbVN1bW1hcnksXG59IGZyb20gJy4uLy4uL3V0aWxzL3RlYW1EaXNjb3ZlcnkuanMnXG5pbXBvcnQge1xuICBjcmVhdGVNb2RlU2V0UmVxdWVzdE1lc3NhZ2UsXG4gIHNlbmRTaHV0ZG93blJlcXVlc3RUb01haWxib3gsXG4gIHdyaXRlVG9NYWlsYm94LFxufSBmcm9tICcuLi8uLi91dGlscy90ZWFtbWF0ZU1haWxib3guanMnXG5pbXBvcnQgeyBEaWFsb2cgfSBmcm9tICcuLi9kZXNpZ24tc3lzdGVtL0RpYWxvZy5qcydcbmltcG9ydCBUaGVtZWRUZXh0IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vVGhlbWVkVGV4dC5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgaW5pdGlhbFRlYW1zPzogVGVhbVN1bW1hcnlbXVxuICBvbkRvbmU6ICgpID0+IHZvaWRcbn1cblxudHlwZSBEaWFsb2dMZXZlbCA9XG4gIHwgeyB0eXBlOiAndGVhbW1hdGVMaXN0JzsgdGVhbU5hbWU6IHN0cmluZyB9XG4gIHwgeyB0eXBlOiAndGVhbW1hdGVEZXRhaWwnOyB0ZWFtTmFtZTogc3RyaW5nOyBtZW1iZXJOYW1lOiBzdHJpbmcgfVxuXG4vKipcbiAqIERpYWxvZyBmb3Igdmlld2luZyB0ZWFtbWF0ZXMgaW4gdGhlIGN1cnJlbnQgdGVhbVxuICovXG5leHBvcnQgZnVuY3Rpb24gVGVhbXNEaWFsb2coeyBpbml0aWFsVGVhbXMsIG9uRG9uZSB9OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIC8vIFJlZ2lzdGVyIGFzIG92ZXJsYXkgc28gQ2FuY2VsUmVxdWVzdEhhbmRsZXIgZG9lc24ndCBpbnRlcmNlcHQgZXNjYXBlXG4gIHVzZVJlZ2lzdGVyT3ZlcmxheSgndGVhbXMtZGlhbG9nJylcblxuICAvLyBpbml0aWFsVGVhbXMgaXMgZGVyaXZlZCBmcm9tIHRlYW1Db250ZXh0IGluIFByb21wdElucHV0IChubyBmaWxlc3lzdGVtIEkvTylcbiAgY29uc3Qgc2V0QXBwU3RhdGUgPSB1c2VTZXRBcHBTdGF0ZSgpXG5cbiAgLy8gSW5pdGlhbGl6ZSBkaWFsb2dMZXZlbCB3aXRoIGZpcnN0IHRlYW0gbmFtZSBpZiBhdmFpbGFibGVcbiAgY29uc3QgZmlyc3RUZWFtTmFtZSA9IGluaXRpYWxUZWFtcz8uWzBdPy5uYW1lID8/ICcnXG4gIGNvbnN0IFtkaWFsb2dMZXZlbCwgc2V0RGlhbG9nTGV2ZWxdID0gdXNlU3RhdGU8RGlhbG9nTGV2ZWw+KHtcbiAgICB0eXBlOiAndGVhbW1hdGVMaXN0JyxcbiAgICB0ZWFtTmFtZTogZmlyc3RUZWFtTmFtZSxcbiAgfSlcbiAgY29uc3QgW3NlbGVjdGVkSW5kZXgsIHNldFNlbGVjdGVkSW5kZXhdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgW3JlZnJlc2hLZXksIHNldFJlZnJlc2hLZXldID0gdXNlU3RhdGUoMClcblxuICAvLyBpbml0aWFsVGVhbXMgaXMgbm93IGFsd2F5cyBwcm92aWRlZCBmcm9tIFByb21wdElucHV0IChkZXJpdmVkIGZyb20gdGVhbUNvbnRleHQpXG4gIC8vIE5vIGZpbGVzeXN0ZW0gSS9PIG5lZWRlZCBoZXJlXG5cbiAgY29uc3QgdGVhbW1hdGVTdGF0dXNlcyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIHJldHVybiBnZXRUZWFtbWF0ZVN0YXR1c2VzKGRpYWxvZ0xldmVsLnRlYW1OYW1lKVxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSByZWFjdC1ob29rcy9leGhhdXN0aXZlLWRlcHNcbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VFeGhhdXN0aXZlRGVwZW5kZW5jaWVzOiBpbnRlbnRpb25hbFxuICB9LCBbZGlhbG9nTGV2ZWwudGVhbU5hbWUsIHJlZnJlc2hLZXldKVxuXG4gIC8vIFBlcmlvZGljYWxseSByZWZyZXNoIHRvIHBpY2sgdXAgbW9kZSBjaGFuZ2VzIGZyb20gdGVhbW1hdGVzXG4gIHVzZUludGVydmFsKCgpID0+IHtcbiAgICBzZXRSZWZyZXNoS2V5KGsgPT4gayArIDEpXG4gIH0sIDEwMDApXG5cbiAgY29uc3QgY3VycmVudFRlYW1tYXRlID0gdXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKGRpYWxvZ0xldmVsLnR5cGUgIT09ICd0ZWFtbWF0ZURldGFpbCcpIHJldHVybiBudWxsXG4gICAgcmV0dXJuIHRlYW1tYXRlU3RhdHVzZXMuZmluZCh0ID0+IHQubmFtZSA9PT0gZGlhbG9nTGV2ZWwubWVtYmVyTmFtZSkgPz8gbnVsbFxuICB9LCBbZGlhbG9nTGV2ZWwsIHRlYW1tYXRlU3RhdHVzZXNdKVxuXG4gIC8vIEdldCBpc0J5cGFzc1Blcm1pc3Npb25zTW9kZUF2YWlsYWJsZSBmcm9tIEFwcFN0YXRlXG4gIGNvbnN0IGlzQnlwYXNzQXZhaWxhYmxlID0gdXNlQXBwU3RhdGUoXG4gICAgcyA9PiBzLnRvb2xQZXJtaXNzaW9uQ29udGV4dC5pc0J5cGFzc1Blcm1pc3Npb25zTW9kZUF2YWlsYWJsZSxcbiAgKVxuXG4gIGNvbnN0IGdvQmFja1RvTGlzdCA9ICgpOiB2b2lkID0+IHtcbiAgICBzZXREaWFsb2dMZXZlbCh7IHR5cGU6ICd0ZWFtbWF0ZUxpc3QnLCB0ZWFtTmFtZTogZGlhbG9nTGV2ZWwudGVhbU5hbWUgfSlcbiAgICBzZXRTZWxlY3RlZEluZGV4KDApXG4gIH1cblxuICAvLyBIYW5kbGVyIGZvciBjb25maXJtOmN5Y2xlTW9kZSAtIGN5Y2xlIHRlYW1tYXRlIHBlcm1pc3Npb24gbW9kZXNcbiAgY29uc3QgaGFuZGxlQ3ljbGVNb2RlID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmIChkaWFsb2dMZXZlbC50eXBlID09PSAndGVhbW1hdGVEZXRhaWwnICYmIGN1cnJlbnRUZWFtbWF0ZSkge1xuICAgICAgLy8gRGV0YWlsIHZpZXc6IGN5Y2xlIGp1c3QgdGhpcyB0ZWFtbWF0ZVxuICAgICAgY3ljbGVUZWFtbWF0ZU1vZGUoXG4gICAgICAgIGN1cnJlbnRUZWFtbWF0ZSxcbiAgICAgICAgZGlhbG9nTGV2ZWwudGVhbU5hbWUsXG4gICAgICAgIGlzQnlwYXNzQXZhaWxhYmxlLFxuICAgICAgKVxuICAgICAgc2V0UmVmcmVzaEtleShrID0+IGsgKyAxKVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICBkaWFsb2dMZXZlbC50eXBlID09PSAndGVhbW1hdGVMaXN0JyAmJlxuICAgICAgdGVhbW1hdGVTdGF0dXNlcy5sZW5ndGggPiAwXG4gICAgKSB7XG4gICAgICAvLyBMaXN0IHZpZXc6IGN5Y2xlIGFsbCB0ZWFtbWF0ZXMgaW4gdGFuZGVtXG4gICAgICBjeWNsZUFsbFRlYW1tYXRlTW9kZXMoXG4gICAgICAgIHRlYW1tYXRlU3RhdHVzZXMsXG4gICAgICAgIGRpYWxvZ0xldmVsLnRlYW1OYW1lLFxuICAgICAgICBpc0J5cGFzc0F2YWlsYWJsZSxcbiAgICAgIClcbiAgICAgIHNldFJlZnJlc2hLZXkoayA9PiBrICsgMSlcbiAgICB9XG4gIH0sIFtkaWFsb2dMZXZlbCwgY3VycmVudFRlYW1tYXRlLCB0ZWFtbWF0ZVN0YXR1c2VzLCBpc0J5cGFzc0F2YWlsYWJsZV0pXG5cbiAgLy8gVXNlIGtleWJpbmRpbmdzIGZvciBtb2RlIGN5Y2xpbmdcbiAgdXNlS2V5YmluZGluZ3MoXG4gICAgeyAnY29uZmlybTpjeWNsZU1vZGUnOiBoYW5kbGVDeWNsZU1vZGUgfSxcbiAgICB7IGNvbnRleHQ6ICdDb25maXJtYXRpb24nIH0sXG4gIClcblxuICB1c2VJbnB1dCgoaW5wdXQsIGtleSkgPT4ge1xuICAgIC8vIEhhbmRsZSBsZWZ0IGFycm93IHRvIGdvIGJhY2tcbiAgICBpZiAoa2V5LmxlZnRBcnJvdykge1xuICAgICAgaWYgKGRpYWxvZ0xldmVsLnR5cGUgPT09ICd0ZWFtbWF0ZURldGFpbCcpIHtcbiAgICAgICAgZ29CYWNrVG9MaXN0KClcbiAgICAgIH1cbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIEhhbmRsZSB1cC9kb3duIG5hdmlnYXRpb25cbiAgICBpZiAoa2V5LnVwQXJyb3cgfHwga2V5LmRvd25BcnJvdykge1xuICAgICAgY29uc3QgbWF4SW5kZXggPSBnZXRNYXhJbmRleCgpXG4gICAgICBpZiAoa2V5LnVwQXJyb3cpIHtcbiAgICAgICAgc2V0U2VsZWN0ZWRJbmRleChwcmV2ID0+IE1hdGgubWF4KDAsIHByZXYgLSAxKSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFNlbGVjdGVkSW5kZXgocHJldiA9PiBNYXRoLm1pbihtYXhJbmRleCwgcHJldiArIDEpKVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIEVudGVyIHRvIGRyaWxsIGRvd24gb3IgdmlldyBvdXRwdXRcbiAgICBpZiAoa2V5LnJldHVybikge1xuICAgICAgaWYgKFxuICAgICAgICBkaWFsb2dMZXZlbC50eXBlID09PSAndGVhbW1hdGVMaXN0JyAmJlxuICAgICAgICB0ZWFtbWF0ZVN0YXR1c2VzW3NlbGVjdGVkSW5kZXhdXG4gICAgICApIHtcbiAgICAgICAgc2V0RGlhbG9nTGV2ZWwoe1xuICAgICAgICAgIHR5cGU6ICd0ZWFtbWF0ZURldGFpbCcsXG4gICAgICAgICAgdGVhbU5hbWU6IGRpYWxvZ0xldmVsLnRlYW1OYW1lLFxuICAgICAgICAgIG1lbWJlck5hbWU6IHRlYW1tYXRlU3RhdHVzZXNbc2VsZWN0ZWRJbmRleF0ubmFtZSxcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSBpZiAoZGlhbG9nTGV2ZWwudHlwZSA9PT0gJ3RlYW1tYXRlRGV0YWlsJyAmJiBjdXJyZW50VGVhbW1hdGUpIHtcbiAgICAgICAgLy8gVmlldyBvdXRwdXQgLSBzd2l0Y2ggdG8gdG11eCBwYW5lXG4gICAgICAgIHZvaWQgdmlld1RlYW1tYXRlT3V0cHV0KFxuICAgICAgICAgIGN1cnJlbnRUZWFtbWF0ZS50bXV4UGFuZUlkLFxuICAgICAgICAgIGN1cnJlbnRUZWFtbWF0ZS5iYWNrZW5kVHlwZSxcbiAgICAgICAgKVxuICAgICAgICBvbkRvbmUoKVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gSGFuZGxlICdrJyB0byBraWxsIHRlYW1tYXRlXG4gICAgaWYgKGlucHV0ID09PSAnaycpIHtcbiAgICAgIGlmIChcbiAgICAgICAgZGlhbG9nTGV2ZWwudHlwZSA9PT0gJ3RlYW1tYXRlTGlzdCcgJiZcbiAgICAgICAgdGVhbW1hdGVTdGF0dXNlc1tzZWxlY3RlZEluZGV4XVxuICAgICAgKSB7XG4gICAgICAgIHZvaWQga2lsbFRlYW1tYXRlKFxuICAgICAgICAgIHRlYW1tYXRlU3RhdHVzZXNbc2VsZWN0ZWRJbmRleF0udG11eFBhbmVJZCxcbiAgICAgICAgICB0ZWFtbWF0ZVN0YXR1c2VzW3NlbGVjdGVkSW5kZXhdLmJhY2tlbmRUeXBlLFxuICAgICAgICAgIGRpYWxvZ0xldmVsLnRlYW1OYW1lLFxuICAgICAgICAgIHRlYW1tYXRlU3RhdHVzZXNbc2VsZWN0ZWRJbmRleF0uYWdlbnRJZCxcbiAgICAgICAgICB0ZWFtbWF0ZVN0YXR1c2VzW3NlbGVjdGVkSW5kZXhdLm5hbWUsXG4gICAgICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICAgICkudGhlbigoKSA9PiB7XG4gICAgICAgICAgc2V0UmVmcmVzaEtleShrID0+IGsgKyAxKVxuICAgICAgICAgIC8vIEFkanVzdCBzZWxlY3Rpb24gaWYgbmVlZGVkXG4gICAgICAgICAgc2V0U2VsZWN0ZWRJbmRleChwcmV2ID0+XG4gICAgICAgICAgICBNYXRoLm1heCgwLCBNYXRoLm1pbihwcmV2LCB0ZWFtbWF0ZVN0YXR1c2VzLmxlbmd0aCAtIDIpKSxcbiAgICAgICAgICApXG4gICAgICAgIH0pXG4gICAgICB9IGVsc2UgaWYgKGRpYWxvZ0xldmVsLnR5cGUgPT09ICd0ZWFtbWF0ZURldGFpbCcgJiYgY3VycmVudFRlYW1tYXRlKSB7XG4gICAgICAgIHZvaWQga2lsbFRlYW1tYXRlKFxuICAgICAgICAgIGN1cnJlbnRUZWFtbWF0ZS50bXV4UGFuZUlkLFxuICAgICAgICAgIGN1cnJlbnRUZWFtbWF0ZS5iYWNrZW5kVHlwZSxcbiAgICAgICAgICBkaWFsb2dMZXZlbC50ZWFtTmFtZSxcbiAgICAgICAgICBjdXJyZW50VGVhbW1hdGUuYWdlbnRJZCxcbiAgICAgICAgICBjdXJyZW50VGVhbW1hdGUubmFtZSxcbiAgICAgICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgICAgKVxuICAgICAgICBnb0JhY2tUb0xpc3QoKVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gSGFuZGxlICdzJyBmb3Igc2h1dGRvd24gb2Ygc2VsZWN0ZWQgdGVhbW1hdGVcbiAgICBpZiAoaW5wdXQgPT09ICdzJykge1xuICAgICAgaWYgKFxuICAgICAgICBkaWFsb2dMZXZlbC50eXBlID09PSAndGVhbW1hdGVMaXN0JyAmJlxuICAgICAgICB0ZWFtbWF0ZVN0YXR1c2VzW3NlbGVjdGVkSW5kZXhdXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgdGVhbW1hdGUgPSB0ZWFtbWF0ZVN0YXR1c2VzW3NlbGVjdGVkSW5kZXhdXG4gICAgICAgIHZvaWQgc2VuZFNodXRkb3duUmVxdWVzdFRvTWFpbGJveChcbiAgICAgICAgICB0ZWFtbWF0ZS5uYW1lLFxuICAgICAgICAgIGRpYWxvZ0xldmVsLnRlYW1OYW1lLFxuICAgICAgICAgICdHcmFjZWZ1bCBzaHV0ZG93biByZXF1ZXN0ZWQgYnkgdGVhbSBsZWFkJyxcbiAgICAgICAgKVxuICAgICAgfSBlbHNlIGlmIChkaWFsb2dMZXZlbC50eXBlID09PSAndGVhbW1hdGVEZXRhaWwnICYmIGN1cnJlbnRUZWFtbWF0ZSkge1xuICAgICAgICB2b2lkIHNlbmRTaHV0ZG93blJlcXVlc3RUb01haWxib3goXG4gICAgICAgICAgY3VycmVudFRlYW1tYXRlLm5hbWUsXG4gICAgICAgICAgZGlhbG9nTGV2ZWwudGVhbU5hbWUsXG4gICAgICAgICAgJ0dyYWNlZnVsIHNodXRkb3duIHJlcXVlc3RlZCBieSB0ZWFtIGxlYWQnLFxuICAgICAgICApXG4gICAgICAgIGdvQmFja1RvTGlzdCgpXG4gICAgICB9XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgJ2gnIHRvIGhpZGUvc2hvdyBpbmRpdmlkdWFsIHRlYW1tYXRlIChvbmx5IGZvciBiYWNrZW5kcyB0aGF0IHN1cHBvcnQgaXQpXG4gICAgaWYgKGlucHV0ID09PSAnaCcpIHtcbiAgICAgIGNvbnN0IGJhY2tlbmQgPSBnZXRDYWNoZWRCYWNrZW5kKClcbiAgICAgIGNvbnN0IHRlYW1tYXRlID1cbiAgICAgICAgZGlhbG9nTGV2ZWwudHlwZSA9PT0gJ3RlYW1tYXRlTGlzdCdcbiAgICAgICAgICA/IHRlYW1tYXRlU3RhdHVzZXNbc2VsZWN0ZWRJbmRleF1cbiAgICAgICAgICA6IGRpYWxvZ0xldmVsLnR5cGUgPT09ICd0ZWFtbWF0ZURldGFpbCdcbiAgICAgICAgICAgID8gY3VycmVudFRlYW1tYXRlXG4gICAgICAgICAgICA6IG51bGxcblxuICAgICAgaWYgKHRlYW1tYXRlICYmIGJhY2tlbmQ/LnN1cHBvcnRzSGlkZVNob3cpIHtcbiAgICAgICAgdm9pZCB0b2dnbGVUZWFtbWF0ZVZpc2liaWxpdHkodGVhbW1hdGUsIGRpYWxvZ0xldmVsLnRlYW1OYW1lKS50aGVuKFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIC8vIEZvcmNlIHJlZnJlc2ggb2YgdGVhbW1hdGUgc3RhdHVzZXNcbiAgICAgICAgICAgIHNldFJlZnJlc2hLZXkoayA9PiBrICsgMSlcbiAgICAgICAgICB9LFxuICAgICAgICApXG4gICAgICAgIGlmIChkaWFsb2dMZXZlbC50eXBlID09PSAndGVhbW1hdGVEZXRhaWwnKSB7XG4gICAgICAgICAgZ29CYWNrVG9MaXN0KClcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gSGFuZGxlICdIJyB0byBoaWRlL3Nob3cgYWxsIHRlYW1tYXRlcyAob25seSBmb3IgYmFja2VuZHMgdGhhdCBzdXBwb3J0IGl0KVxuICAgIGlmIChpbnB1dCA9PT0gJ0gnICYmIGRpYWxvZ0xldmVsLnR5cGUgPT09ICd0ZWFtbWF0ZUxpc3QnKSB7XG4gICAgICBjb25zdCBiYWNrZW5kID0gZ2V0Q2FjaGVkQmFja2VuZCgpXG4gICAgICBpZiAoYmFja2VuZD8uc3VwcG9ydHNIaWRlU2hvdyAmJiB0ZWFtbWF0ZVN0YXR1c2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gSWYgYW55IGFyZSB2aXNpYmxlLCBoaWRlIGFsbC4gT3RoZXJ3aXNlLCBzaG93IGFsbC5cbiAgICAgICAgY29uc3QgYW55VmlzaWJsZSA9IHRlYW1tYXRlU3RhdHVzZXMuc29tZSh0ID0+ICF0LmlzSGlkZGVuKVxuICAgICAgICB2b2lkIFByb21pc2UuYWxsKFxuICAgICAgICAgIHRlYW1tYXRlU3RhdHVzZXMubWFwKHQgPT5cbiAgICAgICAgICAgIGFueVZpc2libGVcbiAgICAgICAgICAgICAgPyBoaWRlVGVhbW1hdGUodCwgZGlhbG9nTGV2ZWwudGVhbU5hbWUpXG4gICAgICAgICAgICAgIDogc2hvd1RlYW1tYXRlKHQsIGRpYWxvZ0xldmVsLnRlYW1OYW1lKSxcbiAgICAgICAgICApLFxuICAgICAgICApLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIC8vIEZvcmNlIHJlZnJlc2ggb2YgdGVhbW1hdGUgc3RhdHVzZXNcbiAgICAgICAgICBzZXRSZWZyZXNoS2V5KGsgPT4gayArIDEpXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgJ3AnIHRvIHBydW5lIChraWxsKSBhbGwgaWRsZSB0ZWFtbWF0ZXNcbiAgICBpZiAoaW5wdXQgPT09ICdwJyAmJiBkaWFsb2dMZXZlbC50eXBlID09PSAndGVhbW1hdGVMaXN0Jykge1xuICAgICAgY29uc3QgaWRsZVRlYW1tYXRlcyA9IHRlYW1tYXRlU3RhdHVzZXMuZmlsdGVyKHQgPT4gdC5zdGF0dXMgPT09ICdpZGxlJylcbiAgICAgIGlmIChpZGxlVGVhbW1hdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdm9pZCBQcm9taXNlLmFsbChcbiAgICAgICAgICBpZGxlVGVhbW1hdGVzLm1hcCh0ID0+XG4gICAgICAgICAgICBraWxsVGVhbW1hdGUoXG4gICAgICAgICAgICAgIHQudG11eFBhbmVJZCxcbiAgICAgICAgICAgICAgdC5iYWNrZW5kVHlwZSxcbiAgICAgICAgICAgICAgZGlhbG9nTGV2ZWwudGVhbU5hbWUsXG4gICAgICAgICAgICAgIHQuYWdlbnRJZCxcbiAgICAgICAgICAgICAgdC5uYW1lLFxuICAgICAgICAgICAgICBzZXRBcHBTdGF0ZSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKSxcbiAgICAgICAgKS50aGVuKCgpID0+IHtcbiAgICAgICAgICBzZXRSZWZyZXNoS2V5KGsgPT4gayArIDEpXG4gICAgICAgICAgc2V0U2VsZWN0ZWRJbmRleChwcmV2ID0+XG4gICAgICAgICAgICBNYXRoLm1heChcbiAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgTWF0aC5taW4oXG4gICAgICAgICAgICAgICAgcHJldixcbiAgICAgICAgICAgICAgICB0ZWFtbWF0ZVN0YXR1c2VzLmxlbmd0aCAtIGlkbGVUZWFtbWF0ZXMubGVuZ3RoIC0gMSxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKVxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gTm90ZTogTW9kZSBjeWNsaW5nIChzaGlmdCt0YWIpIGlzIGhhbmRsZWQgdmlhIHVzZUtleWJpbmRpbmdzIHdpdGggY29uZmlybTpjeWNsZU1vZGUgYWN0aW9uXG4gIH0pXG5cbiAgZnVuY3Rpb24gZ2V0TWF4SW5kZXgoKTogbnVtYmVyIHtcbiAgICBpZiAoZGlhbG9nTGV2ZWwudHlwZSA9PT0gJ3RlYW1tYXRlTGlzdCcpIHtcbiAgICAgIHJldHVybiBNYXRoLm1heCgwLCB0ZWFtbWF0ZVN0YXR1c2VzLmxlbmd0aCAtIDEpXG4gICAgfVxuICAgIHJldHVybiAwXG4gIH1cblxuICAvLyBSZW5kZXIgYmFzZWQgb24gZGlhbG9nIGxldmVsXG4gIGlmIChkaWFsb2dMZXZlbC50eXBlID09PSAndGVhbW1hdGVMaXN0Jykge1xuICAgIHJldHVybiAoXG4gICAgICA8VGVhbURldGFpbFZpZXdcbiAgICAgICAgdGVhbU5hbWU9e2RpYWxvZ0xldmVsLnRlYW1OYW1lfVxuICAgICAgICB0ZWFtbWF0ZXM9e3RlYW1tYXRlU3RhdHVzZXN9XG4gICAgICAgIHNlbGVjdGVkSW5kZXg9e3NlbGVjdGVkSW5kZXh9XG4gICAgICAgIG9uQ2FuY2VsPXtvbkRvbmV9XG4gICAgICAvPlxuICAgIClcbiAgfVxuXG4gIGlmIChkaWFsb2dMZXZlbC50eXBlID09PSAndGVhbW1hdGVEZXRhaWwnICYmIGN1cnJlbnRUZWFtbWF0ZSkge1xuICAgIHJldHVybiAoXG4gICAgICA8VGVhbW1hdGVEZXRhaWxWaWV3XG4gICAgICAgIHRlYW1tYXRlPXtjdXJyZW50VGVhbW1hdGV9XG4gICAgICAgIHRlYW1OYW1lPXtkaWFsb2dMZXZlbC50ZWFtTmFtZX1cbiAgICAgICAgb25DYW5jZWw9e2dvQmFja1RvTGlzdH1cbiAgICAgIC8+XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIG51bGxcbn1cblxudHlwZSBUZWFtRGV0YWlsVmlld1Byb3BzID0ge1xuICB0ZWFtTmFtZTogc3RyaW5nXG4gIHRlYW1tYXRlczogVGVhbW1hdGVTdGF0dXNbXVxuICBzZWxlY3RlZEluZGV4OiBudW1iZXJcbiAgb25DYW5jZWw6ICgpID0+IHZvaWRcbn1cblxuZnVuY3Rpb24gVGVhbURldGFpbFZpZXcoe1xuICB0ZWFtTmFtZSxcbiAgdGVhbW1hdGVzLFxuICBzZWxlY3RlZEluZGV4LFxuICBvbkNhbmNlbCxcbn06IFRlYW1EZXRhaWxWaWV3UHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBzdWJ0aXRsZSA9IGAke3RlYW1tYXRlcy5sZW5ndGh9ICR7dGVhbW1hdGVzLmxlbmd0aCA9PT0gMSA/ICd0ZWFtbWF0ZScgOiAndGVhbW1hdGVzJ31gXG4gIC8vIENoZWNrIGlmIHRoZSBiYWNrZW5kIHN1cHBvcnRzIGhpZGUvc2hvd1xuICBjb25zdCBzdXBwb3J0c0hpZGVTaG93ID0gZ2V0Q2FjaGVkQmFja2VuZCgpPy5zdXBwb3J0c0hpZGVTaG93ID8/IGZhbHNlXG4gIC8vIEdldCB0aGUgZGlzcGxheSB0ZXh0IGZvciB0aGUgY3ljbGUgbW9kZSBzaG9ydGN1dFxuICBjb25zdCBjeWNsZU1vZGVTaG9ydGN1dCA9IHVzZVNob3J0Y3V0RGlzcGxheShcbiAgICAnY29uZmlybTpjeWNsZU1vZGUnLFxuICAgICdDb25maXJtYXRpb24nLFxuICAgICdzaGlmdCt0YWInLFxuICApXG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgPERpYWxvZ1xuICAgICAgICB0aXRsZT17YFRlYW0gJHt0ZWFtTmFtZX1gfVxuICAgICAgICBzdWJ0aXRsZT17c3VidGl0bGV9XG4gICAgICAgIG9uQ2FuY2VsPXtvbkNhbmNlbH1cbiAgICAgICAgY29sb3I9XCJiYWNrZ3JvdW5kXCJcbiAgICAgICAgaGlkZUlucHV0R3VpZGVcbiAgICAgID5cbiAgICAgICAge3RlYW1tYXRlcy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+Tm8gdGVhbW1hdGVzPC9UZXh0PlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAge3RlYW1tYXRlcy5tYXAoKHRlYW1tYXRlLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgICA8VGVhbW1hdGVMaXN0SXRlbVxuICAgICAgICAgICAgICAgIGtleT17dGVhbW1hdGUuYWdlbnRJZH1cbiAgICAgICAgICAgICAgICB0ZWFtbWF0ZT17dGVhbW1hdGV9XG4gICAgICAgICAgICAgICAgaXNTZWxlY3RlZD17aW5kZXggPT09IHNlbGVjdGVkSW5kZXh9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICApKX1cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgIDwvRGlhbG9nPlxuICAgICAgPEJveCBtYXJnaW5MZWZ0PXsxfT5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAge2ZpZ3VyZXMuYXJyb3dVcH0ve2ZpZ3VyZXMuYXJyb3dEb3dufSBzZWxlY3QgwrcgRW50ZXIgdmlldyDCtyBrIGtpbGwgwrcgc1xuICAgICAgICAgIHNodXRkb3duIMK3IHAgcHJ1bmUgaWRsZVxuICAgICAgICAgIHtzdXBwb3J0c0hpZGVTaG93ICYmICcgwrcgaCBoaWRlL3Nob3cgwrcgSCBoaWRlL3Nob3cgYWxsJ31cbiAgICAgICAgICB7JyDCtyAnfVxuICAgICAgICAgIHtjeWNsZU1vZGVTaG9ydGN1dH0gc3luYyBjeWNsZSBtb2RlcyBmb3IgYWxsIMK3IEVzYyBjbG9zZVxuICAgICAgICA8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICA8Lz5cbiAgKVxufVxuXG50eXBlIFRlYW1tYXRlTGlzdEl0ZW1Qcm9wcyA9IHtcbiAgdGVhbW1hdGU6IFRlYW1tYXRlU3RhdHVzXG4gIGlzU2VsZWN0ZWQ6IGJvb2xlYW5cbn1cblxuZnVuY3Rpb24gVGVhbW1hdGVMaXN0SXRlbSh7XG4gIHRlYW1tYXRlLFxuICBpc1NlbGVjdGVkLFxufTogVGVhbW1hdGVMaXN0SXRlbVByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgaXNJZGxlID0gdGVhbW1hdGUuc3RhdHVzID09PSAnaWRsZSdcbiAgLy8gT25seSBkaW0gaWYgaWRsZSBBTkQgbm90IHNlbGVjdGVkIC0gc2VsZWN0aW9uIGhpZ2hsaWdodGluZyB0YWtlcyBwcmVjZWRlbmNlXG4gIGNvbnN0IHNob3VsZERpbSA9IGlzSWRsZSAmJiAhaXNTZWxlY3RlZFxuXG4gIC8vIEdldCBtb2RlIGRpc3BsYXlcbiAgY29uc3QgbW9kZSA9IHRlYW1tYXRlLm1vZGVcbiAgICA/IHBlcm1pc3Npb25Nb2RlRnJvbVN0cmluZyh0ZWFtbWF0ZS5tb2RlKVxuICAgIDogJ2RlZmF1bHQnXG4gIGNvbnN0IG1vZGVTeW1ib2wgPSBwZXJtaXNzaW9uTW9kZVN5bWJvbChtb2RlKVxuICBjb25zdCBtb2RlQ29sb3IgPSBnZXRNb2RlQ29sb3IobW9kZSlcblxuICByZXR1cm4gKFxuICAgIDxUZXh0IGNvbG9yPXtpc1NlbGVjdGVkID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfSBkaW1Db2xvcj17c2hvdWxkRGltfT5cbiAgICAgIHtpc1NlbGVjdGVkID8gZmlndXJlcy5wb2ludGVyICsgJyAnIDogJyAgJ31cbiAgICAgIHt0ZWFtbWF0ZS5pc0hpZGRlbiAmJiA8VGV4dCBkaW1Db2xvcj5baGlkZGVuXSA8L1RleHQ+fVxuICAgICAge2lzSWRsZSAmJiA8VGV4dCBkaW1Db2xvcj5baWRsZV0gPC9UZXh0Pn1cbiAgICAgIHttb2RlU3ltYm9sICYmIDxUZXh0IGNvbG9yPXttb2RlQ29sb3J9Pnttb2RlU3ltYm9sfSA8L1RleHQ+fUBcbiAgICAgIHt0ZWFtbWF0ZS5uYW1lfVxuICAgICAge3RlYW1tYXRlLm1vZGVsICYmIDxUZXh0IGRpbUNvbG9yPiAoe3RlYW1tYXRlLm1vZGVsfSk8L1RleHQ+fVxuICAgIDwvVGV4dD5cbiAgKVxufVxuXG50eXBlIFRlYW1tYXRlRGV0YWlsVmlld1Byb3BzID0ge1xuICB0ZWFtbWF0ZTogVGVhbW1hdGVTdGF0dXNcbiAgdGVhbU5hbWU6IHN0cmluZ1xuICBvbkNhbmNlbDogKCkgPT4gdm9pZFxufVxuXG5mdW5jdGlvbiBUZWFtbWF0ZURldGFpbFZpZXcoe1xuICB0ZWFtbWF0ZSxcbiAgdGVhbU5hbWUsXG4gIG9uQ2FuY2VsLFxufTogVGVhbW1hdGVEZXRhaWxWaWV3UHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbcHJvbXB0RXhwYW5kZWQsIHNldFByb21wdEV4cGFuZGVkXSA9IHVzZVN0YXRlKGZhbHNlKVxuICAvLyBHZXQgdGhlIGRpc3BsYXkgdGV4dCBmb3IgdGhlIGN5Y2xlIG1vZGUgc2hvcnRjdXRcbiAgY29uc3QgY3ljbGVNb2RlU2hvcnRjdXQgPSB1c2VTaG9ydGN1dERpc3BsYXkoXG4gICAgJ2NvbmZpcm06Y3ljbGVNb2RlJyxcbiAgICAnQ29uZmlybWF0aW9uJyxcbiAgICAnc2hpZnQrdGFiJyxcbiAgKVxuICBjb25zdCB0aGVtZUNvbG9yID0gdGVhbW1hdGUuY29sb3JcbiAgICA/IEFHRU5UX0NPTE9SX1RPX1RIRU1FX0NPTE9SW1xuICAgICAgICB0ZWFtbWF0ZS5jb2xvciBhcyBrZXlvZiB0eXBlb2YgQUdFTlRfQ09MT1JfVE9fVEhFTUVfQ09MT1JcbiAgICAgIF1cbiAgICA6IHVuZGVmaW5lZFxuXG4gIC8vIEdldCB0YXNrcyBhc3NpZ25lZCB0byB0aGlzIHRlYW1tYXRlXG4gIGNvbnN0IFt0ZWFtbWF0ZVRhc2tzLCBzZXRUZWFtbWF0ZVRhc2tzXSA9IHVzZVN0YXRlPFRhc2tbXT4oW10pXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlXG4gICAgdm9pZCBsaXN0VGFza3ModGVhbU5hbWUpLnRoZW4oYWxsVGFza3MgPT4ge1xuICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuXG4gICAgICAvLyBGaWx0ZXIgdGFza3Mgb3duZWQgYnkgdGhpcyB0ZWFtbWF0ZSAoYnkgYWdlbnRJZCBvciBuYW1lKVxuICAgICAgc2V0VGVhbW1hdGVUYXNrcyhcbiAgICAgICAgYWxsVGFza3MuZmlsdGVyKFxuICAgICAgICAgIHRhc2sgPT5cbiAgICAgICAgICAgIHRhc2sub3duZXIgPT09IHRlYW1tYXRlLmFnZW50SWQgfHwgdGFzay5vd25lciA9PT0gdGVhbW1hdGUubmFtZSxcbiAgICAgICAgKSxcbiAgICAgIClcbiAgICB9KVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjYW5jZWxsZWQgPSB0cnVlXG4gICAgfVxuICB9LCBbdGVhbU5hbWUsIHRlYW1tYXRlLmFnZW50SWQsIHRlYW1tYXRlLm5hbWVdKVxuXG4gIHVzZUlucHV0KGlucHV0ID0+IHtcbiAgICAvLyBIYW5kbGUgJ3AnIHRvIGV4cGFuZC9jb2xsYXBzZSBwcm9tcHRcbiAgICBpZiAoaW5wdXQgPT09ICdwJykge1xuICAgICAgc2V0UHJvbXB0RXhwYW5kZWQocHJldiA9PiAhcHJldilcbiAgICB9XG4gIH0pXG5cbiAgLy8gRGV0ZXJtaW5lIHdvcmtpbmcgZGlyZWN0b3J5IGRpc3BsYXlcbiAgY29uc3Qgd29ya2luZ1BhdGggPSB0ZWFtbWF0ZS53b3JrdHJlZVBhdGggfHwgdGVhbW1hdGUuY3dkXG5cbiAgLy8gQnVpbGQgc3VidGl0bGUgd2l0aCBtZXRhZGF0YVxuICBjb25zdCBzdWJ0aXRsZVBhcnRzOiBzdHJpbmdbXSA9IFtdXG4gIGlmICh0ZWFtbWF0ZS5tb2RlbCkgc3VidGl0bGVQYXJ0cy5wdXNoKHRlYW1tYXRlLm1vZGVsKVxuICBpZiAod29ya2luZ1BhdGgpIHtcbiAgICBzdWJ0aXRsZVBhcnRzLnB1c2goXG4gICAgICB0ZWFtbWF0ZS53b3JrdHJlZVBhdGggPyBgd29ya3RyZWU6ICR7d29ya2luZ1BhdGh9YCA6IHdvcmtpbmdQYXRoLFxuICAgIClcbiAgfVxuICBjb25zdCBzdWJ0aXRsZSA9IHN1YnRpdGxlUGFydHMuam9pbignIMK3ICcpIHx8IHVuZGVmaW5lZFxuXG4gIC8vIEdldCBtb2RlIGRpc3BsYXkgZm9yIHRpdGxlXG4gIGNvbnN0IG1vZGUgPSB0ZWFtbWF0ZS5tb2RlXG4gICAgPyBwZXJtaXNzaW9uTW9kZUZyb21TdHJpbmcodGVhbW1hdGUubW9kZSlcbiAgICA6ICdkZWZhdWx0J1xuICBjb25zdCBtb2RlU3ltYm9sID0gcGVybWlzc2lvbk1vZGVTeW1ib2wobW9kZSlcbiAgY29uc3QgbW9kZUNvbG9yID0gZ2V0TW9kZUNvbG9yKG1vZGUpXG5cbiAgLy8gQnVpbGQgdGl0bGUgd2l0aCBtb2RlIHN5bWJvbCBhbmQgY29sb3JlZCBuYW1lIGlmIGFwcGxpY2FibGVcbiAgY29uc3QgdGl0bGUgPSAoXG4gICAgPD5cbiAgICAgIHttb2RlU3ltYm9sICYmIDxUZXh0IGNvbG9yPXttb2RlQ29sb3J9Pnttb2RlU3ltYm9sfSA8L1RleHQ+fVxuICAgICAge3RoZW1lQ29sb3IgPyAoXG4gICAgICAgIDxUaGVtZWRUZXh0IGNvbG9yPXt0aGVtZUNvbG9yfT57YEAke3RlYW1tYXRlLm5hbWV9YH08L1RoZW1lZFRleHQ+XG4gICAgICApIDogKFxuICAgICAgICBgQCR7dGVhbW1hdGUubmFtZX1gXG4gICAgICApfVxuICAgIDwvPlxuICApXG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgPERpYWxvZ1xuICAgICAgICB0aXRsZT17dGl0bGV9XG4gICAgICAgIHN1YnRpdGxlPXtzdWJ0aXRsZX1cbiAgICAgICAgb25DYW5jZWw9e29uQ2FuY2VsfVxuICAgICAgICBjb2xvcj1cImJhY2tncm91bmRcIlxuICAgICAgICBoaWRlSW5wdXRHdWlkZVxuICAgICAgPlxuICAgICAgICB7LyogVGFza3Mgc2VjdGlvbiAqL31cbiAgICAgICAge3RlYW1tYXRlVGFza3MubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICA8VGV4dCBib2xkPlRhc2tzPC9UZXh0PlxuICAgICAgICAgICAge3RlYW1tYXRlVGFza3MubWFwKHRhc2sgPT4gKFxuICAgICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICAgIGtleT17dGFzay5pZH1cbiAgICAgICAgICAgICAgICBjb2xvcj17dGFzay5zdGF0dXMgPT09ICdjb21wbGV0ZWQnID8gJ3N1Y2Nlc3MnIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge3Rhc2suc3RhdHVzID09PSAnY29tcGxldGVkJyA/IGZpZ3VyZXMudGljayA6ICfil7wnfXsnICd9XG4gICAgICAgICAgICAgICAge3Rhc2suc3ViamVjdH1cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKSl9XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIFByb21wdCBzZWN0aW9uICovfVxuICAgICAgICB7dGVhbW1hdGUucHJvbXB0ICYmIChcbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIDxUZXh0IGJvbGQ+UHJvbXB0PC9UZXh0PlxuICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgIHtwcm9tcHRFeHBhbmRlZFxuICAgICAgICAgICAgICAgID8gdGVhbW1hdGUucHJvbXB0XG4gICAgICAgICAgICAgICAgOiB0cnVuY2F0ZVRvV2lkdGgodGVhbW1hdGUucHJvbXB0LCA4MCl9XG4gICAgICAgICAgICAgIHtzdHJpbmdXaWR0aCh0ZWFtbWF0ZS5wcm9tcHQpID4gODAgJiYgIXByb21wdEV4cGFuZGVkICYmIChcbiAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4gKHAgdG8gZXhwYW5kKTwvVGV4dD5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgIDwvRGlhbG9nPlxuICAgICAgPEJveCBtYXJnaW5MZWZ0PXsxfT5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAge2ZpZ3VyZXMuYXJyb3dMZWZ0fSBiYWNrIMK3IEVzYyBjbG9zZSDCtyBrIGtpbGwgwrcgcyBzaHV0ZG93blxuICAgICAgICAgIHtnZXRDYWNoZWRCYWNrZW5kKCk/LnN1cHBvcnRzSGlkZVNob3cgJiYgJyDCtyBoIGhpZGUvc2hvdyd9XG4gICAgICAgICAgeycgwrcgJ31cbiAgICAgICAgICB7Y3ljbGVNb2RlU2hvcnRjdXR9IGN5Y2xlIG1vZGVcbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgPC8+XG4gIClcbn1cblxuYXN5bmMgZnVuY3Rpb24ga2lsbFRlYW1tYXRlKFxuICBwYW5lSWQ6IHN0cmluZyxcbiAgYmFja2VuZFR5cGU6IFBhbmVCYWNrZW5kVHlwZSB8IHVuZGVmaW5lZCxcbiAgdGVhbU5hbWU6IHN0cmluZyxcbiAgdGVhbW1hdGVJZDogc3RyaW5nLFxuICB0ZWFtbWF0ZU5hbWU6IHN0cmluZyxcbiAgc2V0QXBwU3RhdGU6IChmOiAocHJldjogQXBwU3RhdGUpID0+IEFwcFN0YXRlKSA9PiB2b2lkLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIC8vIEtpbGwgdGhlIHBhbmUgdXNpbmcgdGhlIGJhY2tlbmQgdGhhdCBjcmVhdGVkIGl0IChoYW5kbGVzIC1zIC8gLUwgZmxhZ3MgY29ycmVjdGx5KS5cbiAgLy8gV3JhcHBlZCBpbiB0cnkvY2F0Y2ggc28gY2xlYW51cCAocmVtb3ZlTWVtYmVyRnJvbVRlYW0sIHVuYXNzaWduVGVhbW1hdGVUYXNrcyxcbiAgLy8gc2V0QXBwU3RhdGUpIGFsd2F5cyBydW5zIOKAlCBtYXRjaGVzIHVzZUluYm94UG9sbGVyLnRzIGVycm9yIGlzb2xhdGlvbi5cbiAgaWYgKGJhY2tlbmRUeXBlKSB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIFVzZSBlbnN1cmVCYWNrZW5kc1JlZ2lzdGVyZWQgKG5vdCBkZXRlY3RBbmRHZXRCYWNrZW5kKSDigJQgdGhpcyBwcm9jZXNzIG1heVxuICAgICAgLy8gYmUgYSB0ZWFtbWF0ZSB0aGF0IG5ldmVyIHJhbiBkZXRlY3Rpb24sIGJ1dCB3ZSBvbmx5IG5lZWQgY2xhc3MgaW1wb3J0c1xuICAgICAgLy8gaGVyZSwgbm90IHN1YnByb2Nlc3MgcHJvYmVzIHRoYXQgY291bGQgdGhyb3cgaW4gYSBkaWZmZXJlbnQgZW52aXJvbm1lbnQuXG4gICAgICBhd2FpdCBlbnN1cmVCYWNrZW5kc1JlZ2lzdGVyZWQoKVxuICAgICAgYXdhaXQgZ2V0QmFja2VuZEJ5VHlwZShiYWNrZW5kVHlwZSkua2lsbFBhbmUocGFuZUlkLCAhaXNJbnNpZGVUbXV4U3luYygpKVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dGb3JEZWJ1Z2dpbmcoYFtUZWFtc0RpYWxvZ10gRmFpbGVkIHRvIGtpbGwgcGFuZSAke3BhbmVJZH06ICR7ZXJyb3J9YClcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gYmFja2VuZFR5cGUgdW5kZWZpbmVkOiBvbGQgdGVhbSBmaWxlcyBwcmVkYXRpbmcgdGhpcyBmaWVsZCwgb3IgaW4tcHJvY2Vzcy5cbiAgICAvLyBPbGQgdG11eC1maWxlIGNhc2UgaXMgYSBtaWdyYXRpb24gZ2FwIOKAlCB0aGUgcGFuZSBpcyBvcnBoYW5lZC4gSW4tcHJvY2Vzc1xuICAgIC8vIHRlYW1tYXRlcyBoYXZlIG5vIHBhbmUgdG8ga2lsbCwgc28gdGhpcyBpcyBjb3JyZWN0IGZvciB0aGVtLlxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBbVGVhbXNEaWFsb2ddIFNraXBwaW5nIHBhbmUga2lsbCBmb3IgJHtwYW5lSWR9OiBubyBiYWNrZW5kVHlwZSByZWNvcmRlZGAsXG4gICAgKVxuICB9XG4gIC8vIFJlbW92ZSBmcm9tIHRlYW0gY29uZmlnIGZpbGVcbiAgcmVtb3ZlTWVtYmVyRnJvbVRlYW0odGVhbU5hbWUsIHBhbmVJZClcblxuICAvLyBVbmFzc2lnbiB0YXNrcyBhbmQgYnVpbGQgbm90aWZpY2F0aW9uIG1lc3NhZ2VcbiAgY29uc3QgeyBub3RpZmljYXRpb25NZXNzYWdlIH0gPSBhd2FpdCB1bmFzc2lnblRlYW1tYXRlVGFza3MoXG4gICAgdGVhbU5hbWUsXG4gICAgdGVhbW1hdGVJZCxcbiAgICB0ZWFtbWF0ZU5hbWUsXG4gICAgJ3Rlcm1pbmF0ZWQnLFxuICApXG5cbiAgLy8gVXBkYXRlIEFwcFN0YXRlIHRvIGtlZXAgc3RhdHVzIGxpbmUgaW4gc3luYyBhbmQgbm90aWZ5IHRoZSBsZWFkXG4gIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgIGlmICghcHJldi50ZWFtQ29udGV4dD8udGVhbW1hdGVzKSByZXR1cm4gcHJldlxuICAgIGlmICghKHRlYW1tYXRlSWQgaW4gcHJldi50ZWFtQ29udGV4dC50ZWFtbWF0ZXMpKSByZXR1cm4gcHJldlxuICAgIGNvbnN0IHsgW3RlYW1tYXRlSWRdOiBfLCAuLi5yZW1haW5pbmdUZWFtbWF0ZXMgfSA9XG4gICAgICBwcmV2LnRlYW1Db250ZXh0LnRlYW1tYXRlc1xuICAgIHJldHVybiB7XG4gICAgICAuLi5wcmV2LFxuICAgICAgdGVhbUNvbnRleHQ6IHtcbiAgICAgICAgLi4ucHJldi50ZWFtQ29udGV4dCxcbiAgICAgICAgdGVhbW1hdGVzOiByZW1haW5pbmdUZWFtbWF0ZXMsXG4gICAgICB9LFxuICAgICAgaW5ib3g6IHtcbiAgICAgICAgbWVzc2FnZXM6IFtcbiAgICAgICAgICAuLi5wcmV2LmluYm94Lm1lc3NhZ2VzLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiByYW5kb21VVUlEKCksXG4gICAgICAgICAgICBmcm9tOiAnc3lzdGVtJyxcbiAgICAgICAgICAgIHRleHQ6IGpzb25TdHJpbmdpZnkoe1xuICAgICAgICAgICAgICB0eXBlOiAndGVhbW1hdGVfdGVybWluYXRlZCcsXG4gICAgICAgICAgICAgIG1lc3NhZ2U6IG5vdGlmaWNhdGlvbk1lc3NhZ2UsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgc3RhdHVzOiAncGVuZGluZycgYXMgY29uc3QsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfVxuICB9KVxuICBsb2dGb3JEZWJ1Z2dpbmcoYFtUZWFtc0RpYWxvZ10gUmVtb3ZlZCAke3RlYW1tYXRlSWR9IGZyb20gdGVhbUNvbnRleHRgKVxufVxuXG5hc3luYyBmdW5jdGlvbiB2aWV3VGVhbW1hdGVPdXRwdXQoXG4gIHBhbmVJZDogc3RyaW5nLFxuICBiYWNrZW5kVHlwZTogUGFuZUJhY2tlbmRUeXBlIHwgdW5kZWZpbmVkLFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChiYWNrZW5kVHlwZSA9PT0gJ2l0ZXJtMicpIHtcbiAgICAvLyAtcyBpcyByZXF1aXJlZCB0byB0YXJnZXQgYSBzcGVjaWZpYyBzZXNzaW9uIChJVGVybUJhY2tlbmQudHM6MjE2LTIxNylcbiAgICBhd2FpdCBleGVjRmlsZU5vVGhyb3coSVQyX0NPTU1BTkQsIFsnc2Vzc2lvbicsICdmb2N1cycsICctcycsIHBhbmVJZF0pXG4gIH0gZWxzZSB7XG4gICAgLy8gRXh0ZXJuYWwtdG11eCB0ZWFtbWF0ZXMgbGl2ZSBvbiB0aGUgc3dhcm0gc29ja2V0IOKAlCB3aXRob3V0IC1MLCB0aGlzXG4gICAgLy8gdGFyZ2V0cyB0aGUgZGVmYXVsdCBzZXJ2ZXIgYW5kIHNpbGVudGx5IG5vLW9wcy4gTWlycm9ycyBydW5UbXV4SW5Td2FybVxuICAgIC8vIGluIFRtdXhCYWNrZW5kLnRzOjg1LTg5LlxuICAgIGNvbnN0IGFyZ3MgPSBpc0luc2lkZVRtdXhTeW5jKClcbiAgICAgID8gWydzZWxlY3QtcGFuZScsICctdCcsIHBhbmVJZF1cbiAgICAgIDogWyctTCcsIGdldFN3YXJtU29ja2V0TmFtZSgpLCAnc2VsZWN0LXBhbmUnLCAnLXQnLCBwYW5lSWRdXG4gICAgYXdhaXQgZXhlY0ZpbGVOb1Rocm93KFRNVVhfQ09NTUFORCwgYXJncylcbiAgfVxufVxuXG4vKipcbiAqIFRvZ2dsZSB2aXNpYmlsaXR5IG9mIGEgdGVhbW1hdGUgcGFuZSAoaGlkZSBpZiB2aXNpYmxlLCBzaG93IGlmIGhpZGRlbilcbiAqL1xuYXN5bmMgZnVuY3Rpb24gdG9nZ2xlVGVhbW1hdGVWaXNpYmlsaXR5KFxuICB0ZWFtbWF0ZTogVGVhbW1hdGVTdGF0dXMsXG4gIHRlYW1OYW1lOiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKHRlYW1tYXRlLmlzSGlkZGVuKSB7XG4gICAgYXdhaXQgc2hvd1RlYW1tYXRlKHRlYW1tYXRlLCB0ZWFtTmFtZSlcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBoaWRlVGVhbW1hdGUodGVhbW1hdGUsIHRlYW1OYW1lKVxuICB9XG59XG5cbi8qKlxuICogSGlkZSBhIHRlYW1tYXRlIHBhbmUgdXNpbmcgdGhlIGJhY2tlbmQgYWJzdHJhY3Rpb24uXG4gKiBPbmx5IGF2YWlsYWJsZSBmb3IgYW50IHVzZXJzIChnYXRlZCBmb3IgZGVhZCBjb2RlIGVsaW1pbmF0aW9uIGluIGV4dGVybmFsIGJ1aWxkcylcbiAqL1xuYXN5bmMgZnVuY3Rpb24gaGlkZVRlYW1tYXRlKFxuICB0ZWFtbWF0ZTogVGVhbW1hdGVTdGF0dXMsXG4gIHRlYW1OYW1lOiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbn1cblxuLyoqXG4gKiBTaG93IGEgcHJldmlvdXNseSBoaWRkZW4gdGVhbW1hdGUgcGFuZSB1c2luZyB0aGUgYmFja2VuZCBhYnN0cmFjdGlvbi5cbiAqIE9ubHkgYXZhaWxhYmxlIGZvciBhbnQgdXNlcnMgKGdhdGVkIGZvciBkZWFkIGNvZGUgZWxpbWluYXRpb24gaW4gZXh0ZXJuYWwgYnVpbGRzKVxuICovXG5hc3luYyBmdW5jdGlvbiBzaG93VGVhbW1hdGUoXG4gIHRlYW1tYXRlOiBUZWFtbWF0ZVN0YXR1cyxcbiAgdGVhbU5hbWU6IHN0cmluZyxcbik6IFByb21pc2U8dm9pZD4ge1xufVxuXG4vKipcbiAqIFNlbmQgYSBtb2RlIGNoYW5nZSBtZXNzYWdlIHRvIGEgc2luZ2xlIHRlYW1tYXRlXG4gKiBBbHNvIHVwZGF0ZXMgY29uZmlnLmpzb24gZGlyZWN0bHkgc28gdGhlIFVJIHJlZmxlY3RzIHRoZSBjaGFuZ2UgaW1tZWRpYXRlbHlcbiAqL1xuZnVuY3Rpb24gc2VuZE1vZGVDaGFuZ2VUb1RlYW1tYXRlKFxuICB0ZWFtbWF0ZU5hbWU6IHN0cmluZyxcbiAgdGVhbU5hbWU6IHN0cmluZyxcbiAgdGFyZ2V0TW9kZTogUGVybWlzc2lvbk1vZGUsXG4pOiB2b2lkIHtcbiAgLy8gVXBkYXRlIGNvbmZpZy5qc29uIGRpcmVjdGx5IHNvIFVJIHNob3dzIHRoZSBjaGFuZ2UgaW1tZWRpYXRlbHlcbiAgc2V0TWVtYmVyTW9kZSh0ZWFtTmFtZSwgdGVhbW1hdGVOYW1lLCB0YXJnZXRNb2RlKVxuXG4gIC8vIEFsc28gc2VuZCBtZXNzYWdlIHNvIHRlYW1tYXRlIHVwZGF0ZXMgdGhlaXIgbG9jYWwgcGVybWlzc2lvbiBjb250ZXh0XG4gIGNvbnN0IG1lc3NhZ2UgPSBjcmVhdGVNb2RlU2V0UmVxdWVzdE1lc3NhZ2Uoe1xuICAgIG1vZGU6IHRhcmdldE1vZGUsXG4gICAgZnJvbTogJ3RlYW0tbGVhZCcsXG4gIH0pXG4gIHZvaWQgd3JpdGVUb01haWxib3goXG4gICAgdGVhbW1hdGVOYW1lLFxuICAgIHtcbiAgICAgIGZyb206ICd0ZWFtLWxlYWQnLFxuICAgICAgdGV4dDoganNvblN0cmluZ2lmeShtZXNzYWdlKSxcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIH0sXG4gICAgdGVhbU5hbWUsXG4gIClcbiAgbG9nRm9yRGVidWdnaW5nKFxuICAgIGBbVGVhbXNEaWFsb2ddIFNlbnQgbW9kZSBjaGFuZ2UgdG8gJHt0ZWFtbWF0ZU5hbWV9OiAke3RhcmdldE1vZGV9YCxcbiAgKVxufVxuXG4vKipcbiAqIEN5Y2xlIGEgc2luZ2xlIHRlYW1tYXRlJ3MgbW9kZVxuICovXG5mdW5jdGlvbiBjeWNsZVRlYW1tYXRlTW9kZShcbiAgdGVhbW1hdGU6IFRlYW1tYXRlU3RhdHVzLFxuICB0ZWFtTmFtZTogc3RyaW5nLFxuICBpc0J5cGFzc0F2YWlsYWJsZTogYm9vbGVhbixcbik6IHZvaWQge1xuICBjb25zdCBjdXJyZW50TW9kZSA9IHRlYW1tYXRlLm1vZGVcbiAgICA/IHBlcm1pc3Npb25Nb2RlRnJvbVN0cmluZyh0ZWFtbWF0ZS5tb2RlKVxuICAgIDogJ2RlZmF1bHQnXG4gIGNvbnN0IGNvbnRleHQgPSB7XG4gICAgLi4uZ2V0RW1wdHlUb29sUGVybWlzc2lvbkNvbnRleHQoKSxcbiAgICBtb2RlOiBjdXJyZW50TW9kZSxcbiAgICBpc0J5cGFzc1Blcm1pc3Npb25zTW9kZUF2YWlsYWJsZTogaXNCeXBhc3NBdmFpbGFibGUsXG4gIH1cbiAgY29uc3QgbmV4dE1vZGUgPSBnZXROZXh0UGVybWlzc2lvbk1vZGUoY29udGV4dClcbiAgc2VuZE1vZGVDaGFuZ2VUb1RlYW1tYXRlKHRlYW1tYXRlLm5hbWUsIHRlYW1OYW1lLCBuZXh0TW9kZSlcbn1cblxuLyoqXG4gKiBDeWNsZSBhbGwgdGVhbW1hdGVzJyBtb2RlcyBpbiB0YW5kZW1cbiAqIElmIG1vZGVzIGRpZmZlciwgcmVzZXQgYWxsIHRvIGRlZmF1bHQgZmlyc3RcbiAqIElmIHNhbWUsIGN5Y2xlIGFsbCB0byBuZXh0IG1vZGVcbiAqIFVzZXMgYmF0Y2ggdXBkYXRlIHRvIGF2b2lkIHJhY2UgY29uZGl0aW9uc1xuICovXG5mdW5jdGlvbiBjeWNsZUFsbFRlYW1tYXRlTW9kZXMoXG4gIHRlYW1tYXRlczogVGVhbW1hdGVTdGF0dXNbXSxcbiAgdGVhbU5hbWU6IHN0cmluZyxcbiAgaXNCeXBhc3NBdmFpbGFibGU6IGJvb2xlYW4sXG4pOiB2b2lkIHtcbiAgaWYgKHRlYW1tYXRlcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGNvbnN0IG1vZGVzID0gdGVhbW1hdGVzLm1hcCh0ID0+XG4gICAgdC5tb2RlID8gcGVybWlzc2lvbk1vZGVGcm9tU3RyaW5nKHQubW9kZSkgOiAnZGVmYXVsdCcsXG4gIClcbiAgY29uc3QgYWxsU2FtZSA9IG1vZGVzLmV2ZXJ5KG0gPT4gbSA9PT0gbW9kZXNbMF0pXG5cbiAgLy8gRGV0ZXJtaW5lIHRhcmdldCBtb2RlIGZvciBhbGwgdGVhbW1hdGVzXG4gIGNvbnN0IHRhcmdldE1vZGUgPSAhYWxsU2FtZVxuICAgID8gJ2RlZmF1bHQnXG4gICAgOiBnZXROZXh0UGVybWlzc2lvbk1vZGUoe1xuICAgICAgICAuLi5nZXRFbXB0eVRvb2xQZXJtaXNzaW9uQ29udGV4dCgpLFxuICAgICAgICBtb2RlOiBtb2Rlc1swXSA/PyAnZGVmYXVsdCcsXG4gICAgICAgIGlzQnlwYXNzUGVybWlzc2lvbnNNb2RlQXZhaWxhYmxlOiBpc0J5cGFzc0F2YWlsYWJsZSxcbiAgICAgIH0pXG5cbiAgLy8gQmF0Y2ggdXBkYXRlIGNvbmZpZy5qc29uIGluIGEgc2luZ2xlIGF0b21pYyBvcGVyYXRpb25cbiAgY29uc3QgbW9kZVVwZGF0ZXMgPSB0ZWFtbWF0ZXMubWFwKHQgPT4gKHtcbiAgICBtZW1iZXJOYW1lOiB0Lm5hbWUsXG4gICAgbW9kZTogdGFyZ2V0TW9kZSxcbiAgfSkpXG4gIHNldE11bHRpcGxlTWVtYmVyTW9kZXModGVhbU5hbWUsIG1vZGVVcGRhdGVzKVxuXG4gIC8vIFNlbmQgbWFpbGJveCBtZXNzYWdlcyB0byBlYWNoIHRlYW1tYXRlXG4gIGZvciAoY29uc3QgdGVhbW1hdGUgb2YgdGVhbW1hdGVzKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGNyZWF0ZU1vZGVTZXRSZXF1ZXN0TWVzc2FnZSh7XG4gICAgICBtb2RlOiB0YXJnZXRNb2RlLFxuICAgICAgZnJvbTogJ3RlYW0tbGVhZCcsXG4gICAgfSlcbiAgICB2b2lkIHdyaXRlVG9NYWlsYm94KFxuICAgICAgdGVhbW1hdGUubmFtZSxcbiAgICAgIHtcbiAgICAgICAgZnJvbTogJ3RlYW0tbGVhZCcsXG4gICAgICAgIHRleHQ6IGpzb25TdHJpbmdpZnkobWVzc2FnZSksXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgfSxcbiAgICAgIHRlYW1OYW1lLFxuICAgIClcbiAgfVxuICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgYFtUZWFtc0RpYWxvZ10gU2VudCBtb2RlIGNoYW5nZSB0byBhbGwgJHt0ZWFtbWF0ZXMubGVuZ3RofSB0ZWFtbWF0ZXM6ICR7dGFyZ2V0TW9kZX1gLFxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxTQUFTQSxVQUFVLFFBQVEsUUFBUTtBQUNuQyxPQUFPQyxPQUFPLE1BQU0sU0FBUztBQUM3QixPQUFPLEtBQUtDLEtBQUssTUFBTSxPQUFPO0FBQzlCLFNBQVNDLFdBQVcsRUFBRUMsU0FBUyxFQUFFQyxPQUFPLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ2pFLFNBQVNDLFdBQVcsUUFBUSxhQUFhO0FBQ3pDLFNBQVNDLGtCQUFrQixRQUFRLGlDQUFpQztBQUNwRSxTQUFTQyxXQUFXLFFBQVEsMEJBQTBCO0FBQ3REO0FBQ0EsU0FBU0MsR0FBRyxFQUFFQyxJQUFJLEVBQUVDLFFBQVEsUUFBUSxjQUFjO0FBQ2xELFNBQVNDLGNBQWMsUUFBUSxvQ0FBb0M7QUFDbkUsU0FBU0Msa0JBQWtCLFFBQVEseUNBQXlDO0FBQzVFLFNBQ0UsS0FBS0MsUUFBUSxFQUNiQyxXQUFXLEVBQ1hDLGNBQWMsUUFDVCx5QkFBeUI7QUFDaEMsU0FBU0MsNkJBQTZCLFFBQVEsZUFBZTtBQUM3RCxTQUFTQywwQkFBMEIsUUFBUSw0Q0FBNEM7QUFDdkYsU0FBU0MsZUFBZSxRQUFRLHNCQUFzQjtBQUN0RCxTQUFTQyxlQUFlLFFBQVEsZ0NBQWdDO0FBQ2hFLFNBQVNDLGVBQWUsUUFBUSx1QkFBdUI7QUFDdkQsU0FBU0MscUJBQXFCLFFBQVEsa0RBQWtEO0FBQ3hGLFNBQ0VDLFlBQVksRUFDWixLQUFLQyxjQUFjLEVBQ25CQyx3QkFBd0IsRUFDeEJDLG9CQUFvQixRQUNmLDJDQUEyQztBQUNsRCxTQUFTQyxhQUFhLFFBQVEsK0JBQStCO0FBQzdELFNBQ0VDLFdBQVcsRUFDWEMsZ0JBQWdCLFFBQ1gseUNBQXlDO0FBQ2hELFNBQ0VDLHdCQUF3QixFQUN4QkMsZ0JBQWdCLEVBQ2hCQyxnQkFBZ0IsUUFDWCx3Q0FBd0M7QUFDL0MsY0FBY0MsZUFBZSxRQUFRLHFDQUFxQztBQUMxRSxTQUNFQyxrQkFBa0IsRUFDbEJDLFlBQVksUUFDUCxnQ0FBZ0M7QUFDdkMsU0FDRUMsZUFBZSxFQUNmQyxrQkFBa0IsRUFDbEJDLG9CQUFvQixFQUNwQkMsYUFBYSxFQUNiQyxzQkFBc0IsUUFDakIsa0NBQWtDO0FBQ3pDLFNBQ0VDLFNBQVMsRUFDVCxLQUFLQyxJQUFJLEVBQ1RDLHFCQUFxQixRQUNoQixzQkFBc0I7QUFDN0IsU0FDRUMsbUJBQW1CLEVBQ25CLEtBQUtDLGNBQWMsRUFDbkIsS0FBS0MsV0FBVyxRQUNYLDhCQUE4QjtBQUNyQyxTQUNFQywyQkFBMkIsRUFDM0JDLDRCQUE0QixFQUM1QkMsY0FBYyxRQUNULGdDQUFnQztBQUN2QyxTQUFTQyxNQUFNLFFBQVEsNEJBQTRCO0FBQ25ELE9BQU9DLFVBQVUsTUFBTSxnQ0FBZ0M7QUFFdkQsS0FBS0MsS0FBSyxHQUFHO0VBQ1hDLFlBQVksQ0FBQyxFQUFFUCxXQUFXLEVBQUU7RUFDNUJRLE1BQU0sRUFBRSxHQUFHLEdBQUcsSUFBSTtBQUNwQixDQUFDO0FBRUQsS0FBS0MsV0FBVyxHQUNaO0VBQUVDLElBQUksRUFBRSxjQUFjO0VBQUVDLFFBQVEsRUFBRSxNQUFNO0FBQUMsQ0FBQyxHQUMxQztFQUFFRCxJQUFJLEVBQUUsZ0JBQWdCO0VBQUVDLFFBQVEsRUFBRSxNQUFNO0VBQUVDLFVBQVUsRUFBRSxNQUFNO0FBQUMsQ0FBQzs7QUFFcEU7QUFDQTtBQUNBO0FBQ0EsT0FBTyxTQUFTQyxXQUFXQSxDQUFDO0VBQUVOLFlBQVk7RUFBRUM7QUFBYyxDQUFOLEVBQUVGLEtBQUssQ0FBQyxFQUFFbkQsS0FBSyxDQUFDMkQsU0FBUyxDQUFDO0VBQzVFO0VBQ0FyRCxrQkFBa0IsQ0FBQyxjQUFjLENBQUM7O0VBRWxDO0VBQ0EsTUFBTXNELFdBQVcsR0FBRzdDLGNBQWMsQ0FBQyxDQUFDOztFQUVwQztFQUNBLE1BQU04QyxhQUFhLEdBQUdULFlBQVksR0FBRyxDQUFDLENBQUMsRUFBRVUsSUFBSSxJQUFJLEVBQUU7RUFDbkQsTUFBTSxDQUFDQyxXQUFXLEVBQUVDLGNBQWMsQ0FBQyxHQUFHNUQsUUFBUSxDQUFDa0QsV0FBVyxDQUFDLENBQUM7SUFDMURDLElBQUksRUFBRSxjQUFjO0lBQ3BCQyxRQUFRLEVBQUVLO0VBQ1osQ0FBQyxDQUFDO0VBQ0YsTUFBTSxDQUFDSSxhQUFhLEVBQUVDLGdCQUFnQixDQUFDLEdBQUc5RCxRQUFRLENBQUMsQ0FBQyxDQUFDO0VBQ3JELE1BQU0sQ0FBQytELFVBQVUsRUFBRUMsYUFBYSxDQUFDLEdBQUdoRSxRQUFRLENBQUMsQ0FBQyxDQUFDOztFQUUvQztFQUNBOztFQUVBLE1BQU1pRSxnQkFBZ0IsR0FBR2xFLE9BQU8sQ0FBQyxNQUFNO0lBQ3JDLE9BQU93QyxtQkFBbUIsQ0FBQ29CLFdBQVcsQ0FBQ1AsUUFBUSxDQUFDO0lBQ2hEO0lBQ0E7RUFDRixDQUFDLEVBQUUsQ0FBQ08sV0FBVyxDQUFDUCxRQUFRLEVBQUVXLFVBQVUsQ0FBQyxDQUFDOztFQUV0QztFQUNBOUQsV0FBVyxDQUFDLE1BQU07SUFDaEIrRCxhQUFhLENBQUNFLENBQUMsSUFBSUEsQ0FBQyxHQUFHLENBQUMsQ0FBQztFQUMzQixDQUFDLEVBQUUsSUFBSSxDQUFDO0VBRVIsTUFBTUMsZUFBZSxHQUFHcEUsT0FBTyxDQUFDLE1BQU07SUFDcEMsSUFBSTRELFdBQVcsQ0FBQ1IsSUFBSSxLQUFLLGdCQUFnQixFQUFFLE9BQU8sSUFBSTtJQUN0RCxPQUFPYyxnQkFBZ0IsQ0FBQ0csSUFBSSxDQUFDQyxDQUFDLElBQUlBLENBQUMsQ0FBQ1gsSUFBSSxLQUFLQyxXQUFXLENBQUNOLFVBQVUsQ0FBQyxJQUFJLElBQUk7RUFDOUUsQ0FBQyxFQUFFLENBQUNNLFdBQVcsRUFBRU0sZ0JBQWdCLENBQUMsQ0FBQzs7RUFFbkM7RUFDQSxNQUFNSyxpQkFBaUIsR0FBRzVELFdBQVcsQ0FDbkM2RCxDQUFDLElBQUlBLENBQUMsQ0FBQ0MscUJBQXFCLENBQUNDLGdDQUMvQixDQUFDO0VBRUQsTUFBTUMsWUFBWSxHQUFHQSxDQUFBLENBQUUsRUFBRSxJQUFJLElBQUk7SUFDL0JkLGNBQWMsQ0FBQztNQUFFVCxJQUFJLEVBQUUsY0FBYztNQUFFQyxRQUFRLEVBQUVPLFdBQVcsQ0FBQ1A7SUFBUyxDQUFDLENBQUM7SUFDeEVVLGdCQUFnQixDQUFDLENBQUMsQ0FBQztFQUNyQixDQUFDOztFQUVEO0VBQ0EsTUFBTWEsZUFBZSxHQUFHOUUsV0FBVyxDQUFDLE1BQU07SUFDeEMsSUFBSThELFdBQVcsQ0FBQ1IsSUFBSSxLQUFLLGdCQUFnQixJQUFJZ0IsZUFBZSxFQUFFO01BQzVEO01BQ0FTLGlCQUFpQixDQUNmVCxlQUFlLEVBQ2ZSLFdBQVcsQ0FBQ1AsUUFBUSxFQUNwQmtCLGlCQUNGLENBQUM7TUFDRE4sYUFBYSxDQUFDRSxDQUFDLElBQUlBLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDM0IsQ0FBQyxNQUFNLElBQ0xQLFdBQVcsQ0FBQ1IsSUFBSSxLQUFLLGNBQWMsSUFDbkNjLGdCQUFnQixDQUFDWSxNQUFNLEdBQUcsQ0FBQyxFQUMzQjtNQUNBO01BQ0FDLHFCQUFxQixDQUNuQmIsZ0JBQWdCLEVBQ2hCTixXQUFXLENBQUNQLFFBQVEsRUFDcEJrQixpQkFDRixDQUFDO01BQ0ROLGFBQWEsQ0FBQ0UsQ0FBQyxJQUFJQSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNCO0VBQ0YsQ0FBQyxFQUFFLENBQUNQLFdBQVcsRUFBRVEsZUFBZSxFQUFFRixnQkFBZ0IsRUFBRUssaUJBQWlCLENBQUMsQ0FBQzs7RUFFdkU7RUFDQS9ELGNBQWMsQ0FDWjtJQUFFLG1CQUFtQixFQUFFb0U7RUFBZ0IsQ0FBQyxFQUN4QztJQUFFSSxPQUFPLEVBQUU7RUFBZSxDQUM1QixDQUFDO0VBRUR6RSxRQUFRLENBQUMsQ0FBQzBFLEtBQUssRUFBRUMsR0FBRyxLQUFLO0lBQ3ZCO0lBQ0EsSUFBSUEsR0FBRyxDQUFDQyxTQUFTLEVBQUU7TUFDakIsSUFBSXZCLFdBQVcsQ0FBQ1IsSUFBSSxLQUFLLGdCQUFnQixFQUFFO1FBQ3pDdUIsWUFBWSxDQUFDLENBQUM7TUFDaEI7TUFDQTtJQUNGOztJQUVBO0lBQ0EsSUFBSU8sR0FBRyxDQUFDRSxPQUFPLElBQUlGLEdBQUcsQ0FBQ0csU0FBUyxFQUFFO01BQ2hDLE1BQU1DLFFBQVEsR0FBR0MsV0FBVyxDQUFDLENBQUM7TUFDOUIsSUFBSUwsR0FBRyxDQUFDRSxPQUFPLEVBQUU7UUFDZnJCLGdCQUFnQixDQUFDeUIsSUFBSSxJQUFJQyxJQUFJLENBQUNDLEdBQUcsQ0FBQyxDQUFDLEVBQUVGLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztNQUNqRCxDQUFDLE1BQU07UUFDTHpCLGdCQUFnQixDQUFDeUIsSUFBSSxJQUFJQyxJQUFJLENBQUNFLEdBQUcsQ0FBQ0wsUUFBUSxFQUFFRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7TUFDeEQ7TUFDQTtJQUNGOztJQUVBO0lBQ0EsSUFBSU4sR0FBRyxDQUFDVSxNQUFNLEVBQUU7TUFDZCxJQUNFaEMsV0FBVyxDQUFDUixJQUFJLEtBQUssY0FBYyxJQUNuQ2MsZ0JBQWdCLENBQUNKLGFBQWEsQ0FBQyxFQUMvQjtRQUNBRCxjQUFjLENBQUM7VUFDYlQsSUFBSSxFQUFFLGdCQUFnQjtVQUN0QkMsUUFBUSxFQUFFTyxXQUFXLENBQUNQLFFBQVE7VUFDOUJDLFVBQVUsRUFBRVksZ0JBQWdCLENBQUNKLGFBQWEsQ0FBQyxDQUFDSDtRQUM5QyxDQUFDLENBQUM7TUFDSixDQUFDLE1BQU0sSUFBSUMsV0FBVyxDQUFDUixJQUFJLEtBQUssZ0JBQWdCLElBQUlnQixlQUFlLEVBQUU7UUFDbkU7UUFDQSxLQUFLeUIsa0JBQWtCLENBQ3JCekIsZUFBZSxDQUFDMEIsVUFBVSxFQUMxQjFCLGVBQWUsQ0FBQzJCLFdBQ2xCLENBQUM7UUFDRDdDLE1BQU0sQ0FBQyxDQUFDO01BQ1Y7TUFDQTtJQUNGOztJQUVBO0lBQ0EsSUFBSStCLEtBQUssS0FBSyxHQUFHLEVBQUU7TUFDakIsSUFDRXJCLFdBQVcsQ0FBQ1IsSUFBSSxLQUFLLGNBQWMsSUFDbkNjLGdCQUFnQixDQUFDSixhQUFhLENBQUMsRUFDL0I7UUFDQSxLQUFLa0MsWUFBWSxDQUNmOUIsZ0JBQWdCLENBQUNKLGFBQWEsQ0FBQyxDQUFDZ0MsVUFBVSxFQUMxQzVCLGdCQUFnQixDQUFDSixhQUFhLENBQUMsQ0FBQ2lDLFdBQVcsRUFDM0NuQyxXQUFXLENBQUNQLFFBQVEsRUFDcEJhLGdCQUFnQixDQUFDSixhQUFhLENBQUMsQ0FBQ21DLE9BQU8sRUFDdkMvQixnQkFBZ0IsQ0FBQ0osYUFBYSxDQUFDLENBQUNILElBQUksRUFDcENGLFdBQ0YsQ0FBQyxDQUFDeUMsSUFBSSxDQUFDLE1BQU07VUFDWGpDLGFBQWEsQ0FBQ0UsQ0FBQyxJQUFJQSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1VBQ3pCO1VBQ0FKLGdCQUFnQixDQUFDeUIsSUFBSSxJQUNuQkMsSUFBSSxDQUFDQyxHQUFHLENBQUMsQ0FBQyxFQUFFRCxJQUFJLENBQUNFLEdBQUcsQ0FBQ0gsSUFBSSxFQUFFdEIsZ0JBQWdCLENBQUNZLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FDekQsQ0FBQztRQUNILENBQUMsQ0FBQztNQUNKLENBQUMsTUFBTSxJQUFJbEIsV0FBVyxDQUFDUixJQUFJLEtBQUssZ0JBQWdCLElBQUlnQixlQUFlLEVBQUU7UUFDbkUsS0FBSzRCLFlBQVksQ0FDZjVCLGVBQWUsQ0FBQzBCLFVBQVUsRUFDMUIxQixlQUFlLENBQUMyQixXQUFXLEVBQzNCbkMsV0FBVyxDQUFDUCxRQUFRLEVBQ3BCZSxlQUFlLENBQUM2QixPQUFPLEVBQ3ZCN0IsZUFBZSxDQUFDVCxJQUFJLEVBQ3BCRixXQUNGLENBQUM7UUFDRGtCLFlBQVksQ0FBQyxDQUFDO01BQ2hCO01BQ0E7SUFDRjs7SUFFQTtJQUNBLElBQUlNLEtBQUssS0FBSyxHQUFHLEVBQUU7TUFDakIsSUFDRXJCLFdBQVcsQ0FBQ1IsSUFBSSxLQUFLLGNBQWMsSUFDbkNjLGdCQUFnQixDQUFDSixhQUFhLENBQUMsRUFDL0I7UUFDQSxNQUFNcUMsUUFBUSxHQUFHakMsZ0JBQWdCLENBQUNKLGFBQWEsQ0FBQztRQUNoRCxLQUFLbEIsNEJBQTRCLENBQy9CdUQsUUFBUSxDQUFDeEMsSUFBSSxFQUNiQyxXQUFXLENBQUNQLFFBQVEsRUFDcEIsMENBQ0YsQ0FBQztNQUNILENBQUMsTUFBTSxJQUFJTyxXQUFXLENBQUNSLElBQUksS0FBSyxnQkFBZ0IsSUFBSWdCLGVBQWUsRUFBRTtRQUNuRSxLQUFLeEIsNEJBQTRCLENBQy9Cd0IsZUFBZSxDQUFDVCxJQUFJLEVBQ3BCQyxXQUFXLENBQUNQLFFBQVEsRUFDcEIsMENBQ0YsQ0FBQztRQUNEc0IsWUFBWSxDQUFDLENBQUM7TUFDaEI7TUFDQTtJQUNGOztJQUVBO0lBQ0EsSUFBSU0sS0FBSyxLQUFLLEdBQUcsRUFBRTtNQUNqQixNQUFNbUIsT0FBTyxHQUFHeEUsZ0JBQWdCLENBQUMsQ0FBQztNQUNsQyxNQUFNdUUsUUFBUSxHQUNadkMsV0FBVyxDQUFDUixJQUFJLEtBQUssY0FBYyxHQUMvQmMsZ0JBQWdCLENBQUNKLGFBQWEsQ0FBQyxHQUMvQkYsV0FBVyxDQUFDUixJQUFJLEtBQUssZ0JBQWdCLEdBQ25DZ0IsZUFBZSxHQUNmLElBQUk7TUFFWixJQUFJK0IsUUFBUSxJQUFJQyxPQUFPLEVBQUVDLGdCQUFnQixFQUFFO1FBQ3pDLEtBQUtDLHdCQUF3QixDQUFDSCxRQUFRLEVBQUV2QyxXQUFXLENBQUNQLFFBQVEsQ0FBQyxDQUFDNkMsSUFBSSxDQUNoRSxNQUFNO1VBQ0o7VUFDQWpDLGFBQWEsQ0FBQ0UsQ0FBQyxJQUFJQSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLENBQ0YsQ0FBQztRQUNELElBQUlQLFdBQVcsQ0FBQ1IsSUFBSSxLQUFLLGdCQUFnQixFQUFFO1VBQ3pDdUIsWUFBWSxDQUFDLENBQUM7UUFDaEI7TUFDRjtNQUNBO0lBQ0Y7O0lBRUE7SUFDQSxJQUFJTSxLQUFLLEtBQUssR0FBRyxJQUFJckIsV0FBVyxDQUFDUixJQUFJLEtBQUssY0FBYyxFQUFFO01BQ3hELE1BQU1nRCxPQUFPLEdBQUd4RSxnQkFBZ0IsQ0FBQyxDQUFDO01BQ2xDLElBQUl3RSxPQUFPLEVBQUVDLGdCQUFnQixJQUFJbkMsZ0JBQWdCLENBQUNZLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDNUQ7UUFDQSxNQUFNeUIsVUFBVSxHQUFHckMsZ0JBQWdCLENBQUNzQyxJQUFJLENBQUNsQyxDQUFDLElBQUksQ0FBQ0EsQ0FBQyxDQUFDbUMsUUFBUSxDQUFDO1FBQzFELEtBQUtDLE9BQU8sQ0FBQ0MsR0FBRyxDQUNkekMsZ0JBQWdCLENBQUMwQyxHQUFHLENBQUN0QyxDQUFDLElBQ3BCaUMsVUFBVSxHQUNOTSxZQUFZLENBQUN2QyxDQUFDLEVBQUVWLFdBQVcsQ0FBQ1AsUUFBUSxDQUFDLEdBQ3JDeUQsWUFBWSxDQUFDeEMsQ0FBQyxFQUFFVixXQUFXLENBQUNQLFFBQVEsQ0FDMUMsQ0FDRixDQUFDLENBQUM2QyxJQUFJLENBQUMsTUFBTTtVQUNYO1VBQ0FqQyxhQUFhLENBQUNFLENBQUMsSUFBSUEsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMzQixDQUFDLENBQUM7TUFDSjtNQUNBO0lBQ0Y7O0lBRUE7SUFDQSxJQUFJYyxLQUFLLEtBQUssR0FBRyxJQUFJckIsV0FBVyxDQUFDUixJQUFJLEtBQUssY0FBYyxFQUFFO01BQ3hELE1BQU0yRCxhQUFhLEdBQUc3QyxnQkFBZ0IsQ0FBQzhDLE1BQU0sQ0FBQzFDLENBQUMsSUFBSUEsQ0FBQyxDQUFDMkMsTUFBTSxLQUFLLE1BQU0sQ0FBQztNQUN2RSxJQUFJRixhQUFhLENBQUNqQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQzVCLEtBQUs0QixPQUFPLENBQUNDLEdBQUcsQ0FDZEksYUFBYSxDQUFDSCxHQUFHLENBQUN0QyxDQUFDLElBQ2pCMEIsWUFBWSxDQUNWMUIsQ0FBQyxDQUFDd0IsVUFBVSxFQUNaeEIsQ0FBQyxDQUFDeUIsV0FBVyxFQUNibkMsV0FBVyxDQUFDUCxRQUFRLEVBQ3BCaUIsQ0FBQyxDQUFDMkIsT0FBTyxFQUNUM0IsQ0FBQyxDQUFDWCxJQUFJLEVBQ05GLFdBQ0YsQ0FDRixDQUNGLENBQUMsQ0FBQ3lDLElBQUksQ0FBQyxNQUFNO1VBQ1hqQyxhQUFhLENBQUNFLENBQUMsSUFBSUEsQ0FBQyxHQUFHLENBQUMsQ0FBQztVQUN6QkosZ0JBQWdCLENBQUN5QixJQUFJLElBQ25CQyxJQUFJLENBQUNDLEdBQUcsQ0FDTixDQUFDLEVBQ0RELElBQUksQ0FBQ0UsR0FBRyxDQUNOSCxJQUFJLEVBQ0p0QixnQkFBZ0IsQ0FBQ1ksTUFBTSxHQUFHaUMsYUFBYSxDQUFDakMsTUFBTSxHQUFHLENBQ25ELENBQ0YsQ0FDRixDQUFDO1FBQ0gsQ0FBQyxDQUFDO01BQ0o7TUFDQTtJQUNGOztJQUVBO0VBQ0YsQ0FBQyxDQUFDO0VBRUYsU0FBU1MsV0FBV0EsQ0FBQSxDQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzdCLElBQUkzQixXQUFXLENBQUNSLElBQUksS0FBSyxjQUFjLEVBQUU7TUFDdkMsT0FBT3FDLElBQUksQ0FBQ0MsR0FBRyxDQUFDLENBQUMsRUFBRXhCLGdCQUFnQixDQUFDWSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ2pEO0lBQ0EsT0FBTyxDQUFDO0VBQ1Y7O0VBRUE7RUFDQSxJQUFJbEIsV0FBVyxDQUFDUixJQUFJLEtBQUssY0FBYyxFQUFFO0lBQ3ZDLE9BQ0UsQ0FBQyxjQUFjLENBQ2IsUUFBUSxDQUFDLENBQUNRLFdBQVcsQ0FBQ1AsUUFBUSxDQUFDLENBQy9CLFNBQVMsQ0FBQyxDQUFDYSxnQkFBZ0IsQ0FBQyxDQUM1QixhQUFhLENBQUMsQ0FBQ0osYUFBYSxDQUFDLENBQzdCLFFBQVEsQ0FBQyxDQUFDWixNQUFNLENBQUMsR0FDakI7RUFFTjtFQUVBLElBQUlVLFdBQVcsQ0FBQ1IsSUFBSSxLQUFLLGdCQUFnQixJQUFJZ0IsZUFBZSxFQUFFO0lBQzVELE9BQ0UsQ0FBQyxrQkFBa0IsQ0FDakIsUUFBUSxDQUFDLENBQUNBLGVBQWUsQ0FBQyxDQUMxQixRQUFRLENBQUMsQ0FBQ1IsV0FBVyxDQUFDUCxRQUFRLENBQUMsQ0FDL0IsUUFBUSxDQUFDLENBQUNzQixZQUFZLENBQUMsR0FDdkI7RUFFTjtFQUVBLE9BQU8sSUFBSTtBQUNiO0FBRUEsS0FBS3VDLG1CQUFtQixHQUFHO0VBQ3pCN0QsUUFBUSxFQUFFLE1BQU07RUFDaEI4RCxTQUFTLEVBQUUxRSxjQUFjLEVBQUU7RUFDM0JxQixhQUFhLEVBQUUsTUFBTTtFQUNyQnNELFFBQVEsRUFBRSxHQUFHLEdBQUcsSUFBSTtBQUN0QixDQUFDO0FBRUQsU0FBQUMsZUFBQUMsRUFBQTtFQUFBLE1BQUFDLENBQUEsR0FBQUMsRUFBQTtFQUF3QjtJQUFBbkUsUUFBQTtJQUFBOEQsU0FBQTtJQUFBckQsYUFBQTtJQUFBc0Q7RUFBQSxJQUFBRSxFQUtGO0VBQ3BCLE1BQUFHLFFBQUEsR0FBaUIsR0FBR04sU0FBUyxDQUFBckMsTUFBTyxJQUFJcUMsU0FBUyxDQUFBckMsTUFBTyxLQUFLLENBQTRCLEdBQWpELFVBQWlELEdBQWpELFdBQWlELEVBQUU7RUFFM0YsTUFBQXVCLGdCQUFBLEdBQXlCekUsZ0JBQWdCLENBQW1CLENBQUMsRUFBQXlFLGdCQUFTLElBQTdDLEtBQTZDO0VBRXRFLE1BQUFxQixpQkFBQSxHQUEwQmpILGtCQUFrQixDQUMxQyxtQkFBbUIsRUFDbkIsY0FBYyxFQUNkLFdBQ0YsQ0FBQztFQUtZLE1BQUFrSCxFQUFBLFdBQVF0RSxRQUFRLEVBQUU7RUFBQSxJQUFBdUUsRUFBQTtFQUFBLElBQUFMLENBQUEsUUFBQXpELGFBQUEsSUFBQXlELENBQUEsUUFBQUosU0FBQTtJQU14QlMsRUFBQSxHQUFBVCxTQUFTLENBQUFyQyxNQUFPLEtBQUssQ0FZckIsR0FYQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQVIsS0FBTyxDQUFDLENBQUMsWUFBWSxFQUExQixJQUFJLENBV04sR0FUQyxDQUFDLEdBQUcsQ0FBZSxhQUFRLENBQVIsUUFBUSxDQUN4QixDQUFBcUMsU0FBUyxDQUFBUCxHQUFJLENBQUMsQ0FBQVQsUUFBQSxFQUFBMEIsS0FBQSxLQUNiLENBQUMsZ0JBQWdCLENBQ1YsR0FBZ0IsQ0FBaEIsQ0FBQTFCLFFBQVEsQ0FBQUYsT0FBTyxDQUFDLENBQ1hFLFFBQVEsQ0FBUkEsU0FBTyxDQUFDLENBQ04sVUFBdUIsQ0FBdkIsQ0FBQTBCLEtBQUssS0FBSy9ELGFBQVksQ0FBQyxHQUV0QyxFQUNILEVBUkMsR0FBRyxDQVNMO0lBQUF5RCxDQUFBLE1BQUF6RCxhQUFBO0lBQUF5RCxDQUFBLE1BQUFKLFNBQUE7SUFBQUksQ0FBQSxNQUFBSyxFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBTCxDQUFBO0VBQUE7RUFBQSxJQUFBTyxFQUFBO0VBQUEsSUFBQVAsQ0FBQSxRQUFBSCxRQUFBLElBQUFHLENBQUEsUUFBQUUsUUFBQSxJQUFBRixDQUFBLFFBQUFJLEVBQUEsSUFBQUosQ0FBQSxRQUFBSyxFQUFBO0lBbkJIRSxFQUFBLElBQUMsTUFBTSxDQUNFLEtBQWtCLENBQWxCLENBQUFILEVBQWlCLENBQUMsQ0FDZkYsUUFBUSxDQUFSQSxTQUFPLENBQUMsQ0FDUkwsUUFBUSxDQUFSQSxTQUFPLENBQUMsQ0FDWixLQUFZLENBQVosWUFBWSxDQUNsQixjQUFjLENBQWQsS0FBYSxDQUFDLENBRWIsQ0FBQVEsRUFZRCxDQUNGLEVBcEJDLE1BQU0sQ0FvQkU7SUFBQUwsQ0FBQSxNQUFBSCxRQUFBO0lBQUFHLENBQUEsTUFBQUUsUUFBQTtJQUFBRixDQUFBLE1BQUFJLEVBQUE7SUFBQUosQ0FBQSxNQUFBSyxFQUFBO0lBQUFMLENBQUEsTUFBQU8sRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQVAsQ0FBQTtFQUFBO0VBQUEsSUFBQVEsRUFBQTtFQUFBLElBQUFSLENBQUEsUUFBQUcsaUJBQUE7SUFDVEssRUFBQSxJQUFDLEdBQUcsQ0FBYSxVQUFDLENBQUQsR0FBQyxDQUNoQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQVIsS0FBTyxDQUFDLENBQ1gsQ0FBQW5JLE9BQU8sQ0FBQW9JLE9BQU8sQ0FBRSxDQUFFLENBQUFwSSxPQUFPLENBQUFxSSxTQUFTLENBQUUseURBRXBDLENBQUE1QixnQkFBc0QsSUFBdEQsd0NBQXFELENBQ3JELFNBQUksQ0FDSnFCLGtCQUFnQixDQUFFLHFDQUNyQixFQU5DLElBQUksQ0FPUCxFQVJDLEdBQUcsQ0FRRTtJQUFBSCxDQUFBLE1BQUFHLGlCQUFBO0lBQUFILENBQUEsTUFBQVEsRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQVIsQ0FBQTtFQUFBO0VBQUEsSUFBQVcsRUFBQTtFQUFBLElBQUFYLENBQUEsU0FBQU8sRUFBQSxJQUFBUCxDQUFBLFNBQUFRLEVBQUE7SUE5QlJHLEVBQUEsS0FDRSxDQUFBSixFQW9CUSxDQUNSLENBQUFDLEVBUUssQ0FBQyxHQUNMO0lBQUFSLENBQUEsT0FBQU8sRUFBQTtJQUFBUCxDQUFBLE9BQUFRLEVBQUE7SUFBQVIsQ0FBQSxPQUFBVyxFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBWCxDQUFBO0VBQUE7RUFBQSxPQS9CSFcsRUErQkc7QUFBQTtBQUlQLEtBQUtDLHFCQUFxQixHQUFHO0VBQzNCaEMsUUFBUSxFQUFFMUQsY0FBYztFQUN4QjJGLFVBQVUsRUFBRSxPQUFPO0FBQ3JCLENBQUM7QUFFRCxTQUFBQyxpQkFBQWYsRUFBQTtFQUFBLE1BQUFDLENBQUEsR0FBQUMsRUFBQTtFQUEwQjtJQUFBckIsUUFBQTtJQUFBaUM7RUFBQSxJQUFBZCxFQUdGO0VBQ3RCLE1BQUFnQixNQUFBLEdBQWVuQyxRQUFRLENBQUFjLE1BQU8sS0FBSyxNQUFNO0VBRXpDLE1BQUFzQixTQUFBLEdBQWtCRCxNQUFxQixJQUFyQixDQUFXRixVQUFVO0VBQUEsSUFBQUksVUFBQTtFQUFBLElBQUFiLEVBQUE7RUFBQSxJQUFBSixDQUFBLFFBQUFwQixRQUFBLENBQUFzQyxJQUFBO0lBR3ZDLE1BQUFBLElBQUEsR0FBYXRDLFFBQVEsQ0FBQXNDLElBRVIsR0FEVHBILHdCQUF3QixDQUFDOEUsUUFBUSxDQUFBc0MsSUFDekIsQ0FBQyxHQUZBLFNBRUE7SUFDYkQsVUFBQSxHQUFtQmxILG9CQUFvQixDQUFDbUgsSUFBSSxDQUFDO0lBQzNCZCxFQUFBLEdBQUF4RyxZQUFZLENBQUNzSCxJQUFJLENBQUM7SUFBQWxCLENBQUEsTUFBQXBCLFFBQUEsQ0FBQXNDLElBQUE7SUFBQWxCLENBQUEsTUFBQWlCLFVBQUE7SUFBQWpCLENBQUEsTUFBQUksRUFBQTtFQUFBO0lBQUFhLFVBQUEsR0FBQWpCLENBQUE7SUFBQUksRUFBQSxHQUFBSixDQUFBO0VBQUE7RUFBcEMsTUFBQW1CLFNBQUEsR0FBa0JmLEVBQWtCO0VBR3JCLE1BQUFDLEVBQUEsR0FBQVEsVUFBVSxHQUFWLFlBQXFDLEdBQXJDTyxTQUFxQztFQUMvQyxNQUFBYixFQUFBLEdBQUFNLFVBQVUsR0FBR3hJLE9BQU8sQ0FBQWdKLE9BQVEsR0FBRyxHQUFVLEdBQXpDLElBQXlDO0VBQUEsSUFBQWIsRUFBQTtFQUFBLElBQUFSLENBQUEsUUFBQXBCLFFBQUEsQ0FBQU0sUUFBQTtJQUN6Q3NCLEVBQUEsR0FBQTVCLFFBQVEsQ0FBQU0sUUFBNEMsSUFBL0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFSLEtBQU8sQ0FBQyxDQUFDLFNBQVMsRUFBdkIsSUFBSSxDQUEwQjtJQUFBYyxDQUFBLE1BQUFwQixRQUFBLENBQUFNLFFBQUE7SUFBQWMsQ0FBQSxNQUFBUSxFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBUixDQUFBO0VBQUE7RUFBQSxJQUFBVyxFQUFBO0VBQUEsSUFBQVgsQ0FBQSxRQUFBZSxNQUFBO0lBQ3BESixFQUFBLEdBQUFJLE1BQXVDLElBQTdCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBUixLQUFPLENBQUMsQ0FBQyxPQUFPLEVBQXJCLElBQUksQ0FBd0I7SUFBQWYsQ0FBQSxNQUFBZSxNQUFBO0lBQUFmLENBQUEsTUFBQVcsRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQVgsQ0FBQTtFQUFBO0VBQUEsSUFBQXNCLEVBQUE7RUFBQSxJQUFBdEIsQ0FBQSxRQUFBbUIsU0FBQSxJQUFBbkIsQ0FBQSxRQUFBaUIsVUFBQTtJQUN2Q0ssRUFBQSxHQUFBTCxVQUEwRCxJQUE1QyxDQUFDLElBQUksQ0FBUUUsS0FBUyxDQUFUQSxVQUFRLENBQUMsQ0FBR0YsV0FBUyxDQUFFLENBQUMsRUFBcEMsSUFBSSxDQUF1QztJQUFBakIsQ0FBQSxNQUFBbUIsU0FBQTtJQUFBbkIsQ0FBQSxNQUFBaUIsVUFBQTtJQUFBakIsQ0FBQSxNQUFBc0IsRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQXRCLENBQUE7RUFBQTtFQUFBLElBQUF1QixFQUFBO0VBQUEsSUFBQXZCLENBQUEsU0FBQXBCLFFBQUEsQ0FBQTRDLEtBQUE7SUFFMURELEVBQUEsR0FBQTNDLFFBQVEsQ0FBQTRDLEtBQW1ELElBQXpDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBUixLQUFPLENBQUMsQ0FBQyxFQUFHLENBQUE1QyxRQUFRLENBQUE0QyxLQUFLLENBQUUsQ0FBQyxFQUFqQyxJQUFJLENBQW9DO0lBQUF4QixDQUFBLE9BQUFwQixRQUFBLENBQUE0QyxLQUFBO0lBQUF4QixDQUFBLE9BQUF1QixFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBdkIsQ0FBQTtFQUFBO0VBQUEsSUFBQXlCLEVBQUE7RUFBQSxJQUFBekIsQ0FBQSxTQUFBZ0IsU0FBQSxJQUFBaEIsQ0FBQSxTQUFBSyxFQUFBLElBQUFMLENBQUEsU0FBQU8sRUFBQSxJQUFBUCxDQUFBLFNBQUFRLEVBQUEsSUFBQVIsQ0FBQSxTQUFBVyxFQUFBLElBQUFYLENBQUEsU0FBQXNCLEVBQUEsSUFBQXRCLENBQUEsU0FBQXVCLEVBQUEsSUFBQXZCLENBQUEsU0FBQXBCLFFBQUEsQ0FBQXhDLElBQUE7SUFOOURxRixFQUFBLElBQUMsSUFBSSxDQUFRLEtBQXFDLENBQXJDLENBQUFwQixFQUFvQyxDQUFDLENBQVlXLFFBQVMsQ0FBVEEsVUFBUSxDQUFDLENBQ3BFLENBQUFULEVBQXdDLENBQ3hDLENBQUFDLEVBQW1ELENBQ25ELENBQUFHLEVBQXNDLENBQ3RDLENBQUFXLEVBQXlELENBQUUsQ0FDM0QsQ0FBQTFDLFFBQVEsQ0FBQXhDLElBQUksQ0FDWixDQUFBbUYsRUFBMEQsQ0FDN0QsRUFQQyxJQUFJLENBT0U7SUFBQXZCLENBQUEsT0FBQWdCLFNBQUE7SUFBQWhCLENBQUEsT0FBQUssRUFBQTtJQUFBTCxDQUFBLE9BQUFPLEVBQUE7SUFBQVAsQ0FBQSxPQUFBUSxFQUFBO0lBQUFSLENBQUEsT0FBQVcsRUFBQTtJQUFBWCxDQUFBLE9BQUFzQixFQUFBO0lBQUF0QixDQUFBLE9BQUF1QixFQUFBO0lBQUF2QixDQUFBLE9BQUFwQixRQUFBLENBQUF4QyxJQUFBO0lBQUE0RCxDQUFBLE9BQUF5QixFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBekIsQ0FBQTtFQUFBO0VBQUEsT0FQUHlCLEVBT087QUFBQTtBQUlYLEtBQUtDLHVCQUF1QixHQUFHO0VBQzdCOUMsUUFBUSxFQUFFMUQsY0FBYztFQUN4QlksUUFBUSxFQUFFLE1BQU07RUFDaEIrRCxRQUFRLEVBQUUsR0FBRyxHQUFHLElBQUk7QUFDdEIsQ0FBQztBQUVELFNBQUE4QixtQkFBQTVCLEVBQUE7RUFBQSxNQUFBQyxDQUFBLEdBQUFDLEVBQUE7RUFBNEI7SUFBQXJCLFFBQUE7SUFBQTlDLFFBQUE7SUFBQStEO0VBQUEsSUFBQUUsRUFJRjtFQUN4QixPQUFBNkIsY0FBQSxFQUFBQyxpQkFBQSxJQUE0Q25KLFFBQVEsQ0FBQyxLQUFLLENBQUM7RUFFM0QsTUFBQXlILGlCQUFBLEdBQTBCakgsa0JBQWtCLENBQzFDLG1CQUFtQixFQUNuQixjQUFjLEVBQ2QsV0FDRixDQUFDO0VBQ0QsTUFBQTRJLFVBQUEsR0FBbUJsRCxRQUFRLENBQUFtRCxLQUlkLEdBSFR4SSwwQkFBMEIsQ0FDeEJxRixRQUFRLENBQUFtRCxLQUFNLElBQUksTUFBTSxPQUFPeEksMEJBQTBCLENBRWxELEdBSk02SCxTQUlOO0VBQUEsSUFBQWhCLEVBQUE7RUFBQSxJQUFBSixDQUFBLFFBQUFnQyxNQUFBLENBQUFDLEdBQUE7SUFHOEM3QixFQUFBLEtBQUU7SUFBQUosQ0FBQSxNQUFBSSxFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBSixDQUFBO0VBQUE7RUFBN0QsT0FBQWtDLGFBQUEsRUFBQUMsZ0JBQUEsSUFBMEN6SixRQUFRLENBQVMwSCxFQUFFLENBQUM7RUFBQSxJQUFBQyxFQUFBO0VBQUEsSUFBQUUsRUFBQTtFQUFBLElBQUFQLENBQUEsUUFBQWxFLFFBQUEsSUFBQWtFLENBQUEsUUFBQXBCLFFBQUEsQ0FBQUYsT0FBQSxJQUFBc0IsQ0FBQSxRQUFBcEIsUUFBQSxDQUFBeEMsSUFBQTtJQUNwRGlFLEVBQUEsR0FBQUEsQ0FBQTtNQUNSLElBQUErQixTQUFBLEdBQWdCLEtBQUs7TUFDaEJ0SCxTQUFTLENBQUNnQixRQUFRLENBQUMsQ0FBQTZDLElBQUssQ0FBQzBELFFBQUE7UUFDNUIsSUFBSUQsU0FBUztVQUFBO1FBQUE7UUFFYkQsZ0JBQWdCLENBQ2RFLFFBQVEsQ0FBQTVDLE1BQU8sQ0FDYjZDLElBQUEsSUFDRUEsSUFBSSxDQUFBQyxLQUFNLEtBQUszRCxRQUFRLENBQUFGLE9BQXdDLElBQTVCNEQsSUFBSSxDQUFBQyxLQUFNLEtBQUszRCxRQUFRLENBQUF4QyxJQUM5RCxDQUNGLENBQUM7TUFBQSxDQUNGLENBQUM7TUFBQSxPQUNLO1FBQ0xnRyxTQUFBLENBQUFBLENBQUEsQ0FBWUEsSUFBSTtNQUFQLENBQ1Y7SUFBQSxDQUNGO0lBQUU3QixFQUFBLElBQUN6RSxRQUFRLEVBQUU4QyxRQUFRLENBQUFGLE9BQVEsRUFBRUUsUUFBUSxDQUFBeEMsSUFBSyxDQUFDO0lBQUE0RCxDQUFBLE1BQUFsRSxRQUFBO0lBQUFrRSxDQUFBLE1BQUFwQixRQUFBLENBQUFGLE9BQUE7SUFBQXNCLENBQUEsTUFBQXBCLFFBQUEsQ0FBQXhDLElBQUE7SUFBQTRELENBQUEsTUFBQUssRUFBQTtJQUFBTCxDQUFBLE1BQUFPLEVBQUE7RUFBQTtJQUFBRixFQUFBLEdBQUFMLENBQUE7SUFBQU8sRUFBQSxHQUFBUCxDQUFBO0VBQUE7RUFmOUN4SCxTQUFTLENBQUM2SCxFQWVULEVBQUVFLEVBQTJDLENBQUM7RUFBQSxJQUFBQyxFQUFBO0VBQUEsSUFBQVIsQ0FBQSxRQUFBZ0MsTUFBQSxDQUFBQyxHQUFBO0lBRXRDekIsRUFBQSxHQUFBOUMsS0FBQTtNQUVQLElBQUlBLEtBQUssS0FBSyxHQUFHO1FBQ2ZtRSxpQkFBaUIsQ0FBQ1csS0FBYSxDQUFDO01BQUE7SUFDakMsQ0FDRjtJQUFBeEMsQ0FBQSxNQUFBUSxFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBUixDQUFBO0VBQUE7RUFMRGhILFFBQVEsQ0FBQ3dILEVBS1IsQ0FBQztFQUdGLE1BQUFpQyxXQUFBLEdBQW9CN0QsUUFBUSxDQUFBOEQsWUFBNkIsSUFBWjlELFFBQVEsQ0FBQStELEdBQUk7RUFBQSxJQUFBQyxhQUFBO0VBQUEsSUFBQTVDLENBQUEsUUFBQXBCLFFBQUEsQ0FBQTRDLEtBQUEsSUFBQXhCLENBQUEsUUFBQXBCLFFBQUEsQ0FBQThELFlBQUEsSUFBQTFDLENBQUEsUUFBQXlDLFdBQUE7SUFHekRHLGFBQUEsR0FBZ0MsRUFBRTtJQUNsQyxJQUFJaEUsUUFBUSxDQUFBNEMsS0FBTTtNQUFFb0IsYUFBYSxDQUFBQyxJQUFLLENBQUNqRSxRQUFRLENBQUE0QyxLQUFNLENBQUM7SUFBQTtJQUN0RCxJQUFJaUIsV0FBVztNQUNiRyxhQUFhLENBQUFDLElBQUssQ0FDaEJqRSxRQUFRLENBQUE4RCxZQUF3RCxHQUFoRSxhQUFxQ0QsV0FBVyxFQUFnQixHQUFoRUEsV0FDRixDQUFDO0lBQUE7SUFDRnpDLENBQUEsTUFBQXBCLFFBQUEsQ0FBQTRDLEtBQUE7SUFBQXhCLENBQUEsTUFBQXBCLFFBQUEsQ0FBQThELFlBQUE7SUFBQTFDLENBQUEsTUFBQXlDLFdBQUE7SUFBQXpDLENBQUEsT0FBQTRDLGFBQUE7RUFBQTtJQUFBQSxhQUFBLEdBQUE1QyxDQUFBO0VBQUE7RUFDRCxNQUFBRSxRQUFBLEdBQWlCMEMsYUFBYSxDQUFBRSxJQUFLLENBQUMsUUFBa0IsQ0FBQyxJQUF0QzFCLFNBQXNDO0VBQUEsSUFBQUgsVUFBQTtFQUFBLElBQUFOLEVBQUE7RUFBQSxJQUFBWCxDQUFBLFNBQUFwQixRQUFBLENBQUFzQyxJQUFBO0lBR3ZELE1BQUFBLElBQUEsR0FBYXRDLFFBQVEsQ0FBQXNDLElBRVIsR0FEVHBILHdCQUF3QixDQUFDOEUsUUFBUSxDQUFBc0MsSUFDekIsQ0FBQyxHQUZBLFNBRUE7SUFDYkQsVUFBQSxHQUFtQmxILG9CQUFvQixDQUFDbUgsSUFBSSxDQUFDO0lBQzNCUCxFQUFBLEdBQUEvRyxZQUFZLENBQUNzSCxJQUFJLENBQUM7SUFBQWxCLENBQUEsT0FBQXBCLFFBQUEsQ0FBQXNDLElBQUE7SUFBQWxCLENBQUEsT0FBQWlCLFVBQUE7SUFBQWpCLENBQUEsT0FBQVcsRUFBQTtFQUFBO0lBQUFNLFVBQUEsR0FBQWpCLENBQUE7SUFBQVcsRUFBQSxHQUFBWCxDQUFBO0VBQUE7RUFBcEMsTUFBQW1CLFNBQUEsR0FBa0JSLEVBQWtCO0VBQUEsSUFBQVcsRUFBQTtFQUFBLElBQUF0QixDQUFBLFNBQUFtQixTQUFBLElBQUFuQixDQUFBLFNBQUFpQixVQUFBO0lBSy9CSyxFQUFBLEdBQUFMLFVBQTBELElBQTVDLENBQUMsSUFBSSxDQUFRRSxLQUFTLENBQVRBLFVBQVEsQ0FBQyxDQUFHRixXQUFTLENBQUUsQ0FBQyxFQUFwQyxJQUFJLENBQXVDO0lBQUFqQixDQUFBLE9BQUFtQixTQUFBO0lBQUFuQixDQUFBLE9BQUFpQixVQUFBO0lBQUFqQixDQUFBLE9BQUFzQixFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBdEIsQ0FBQTtFQUFBO0VBQUEsSUFBQXVCLEVBQUE7RUFBQSxJQUFBdkIsQ0FBQSxTQUFBcEIsUUFBQSxDQUFBeEMsSUFBQSxJQUFBNEQsQ0FBQSxTQUFBOEIsVUFBQTtJQUMxRFAsRUFBQSxHQUFBTyxVQUFVLEdBQ1QsQ0FBQyxVQUFVLENBQVFBLEtBQVUsQ0FBVkEsV0FBUyxDQUFDLENBQUcsS0FBSWxELFFBQVEsQ0FBQXhDLElBQUssRUFBQyxDQUFFLEVBQW5ELFVBQVUsQ0FHWixHQUpBLElBR0t3QyxRQUFRLENBQUF4QyxJQUFLLEVBQ2xCO0lBQUE0RCxDQUFBLE9BQUFwQixRQUFBLENBQUF4QyxJQUFBO0lBQUE0RCxDQUFBLE9BQUE4QixVQUFBO0lBQUE5QixDQUFBLE9BQUF1QixFQUFBO0VBQUE7SUFBQUEsRUFBQSxHQUFBdkIsQ0FBQTtFQUFBO0VBQUEsSUFBQXlCLEVBQUE7RUFBQSxJQUFBekIsQ0FBQSxTQUFBc0IsRUFBQSxJQUFBdEIsQ0FBQSxTQUFBdUIsRUFBQTtJQU5IRSxFQUFBLEtBQ0csQ0FBQUgsRUFBeUQsQ0FDekQsQ0FBQUMsRUFJRCxDQUFDLEdBQ0E7SUFBQXZCLENBQUEsT0FBQXNCLEVBQUE7SUFBQXRCLENBQUEsT0FBQXVCLEVBQUE7SUFBQXZCLENBQUEsT0FBQXlCLEVBQUE7RUFBQTtJQUFBQSxFQUFBLEdBQUF6QixDQUFBO0VBQUE7RUFSTCxNQUFBK0MsS0FBQSxHQUNFdEIsRUFPRztFQUNKLElBQUF1QixFQUFBO0VBQUEsSUFBQWhELENBQUEsU0FBQWtDLGFBQUE7SUFZTWMsRUFBQSxHQUFBZCxhQUFhLENBQUEzRSxNQUFPLEdBQUcsQ0FhdkIsSUFaQyxDQUFDLEdBQUcsQ0FBZSxhQUFRLENBQVIsUUFBUSxDQUN6QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUosS0FBRyxDQUFDLENBQUMsS0FBSyxFQUFmLElBQUksQ0FDSixDQUFBMkUsYUFBYSxDQUFBN0MsR0FBSSxDQUFDNEQsTUFRbEIsRUFDSCxFQVhDLEdBQUcsQ0FZTDtJQUFBakQsQ0FBQSxPQUFBa0MsYUFBQTtJQUFBbEMsQ0FBQSxPQUFBZ0QsRUFBQTtFQUFBO0lBQUFBLEVBQUEsR0FBQWhELENBQUE7RUFBQTtFQUFBLElBQUFrRCxHQUFBO0VBQUEsSUFBQWxELENBQUEsU0FBQTRCLGNBQUEsSUFBQTVCLENBQUEsU0FBQXBCLFFBQUEsQ0FBQXVFLE1BQUE7SUFHQUQsR0FBQSxHQUFBdEUsUUFBUSxDQUFBdUUsTUFZUixJQVhDLENBQUMsR0FBRyxDQUFlLGFBQVEsQ0FBUixRQUFRLENBQ3pCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBSixLQUFHLENBQUMsQ0FBQyxNQUFNLEVBQWhCLElBQUksQ0FDTCxDQUFDLElBQUksQ0FDRixDQUFBdkIsY0FBYyxHQUNYaEQsUUFBUSxDQUFBdUUsTUFDNEIsR0FBcEN6SixlQUFlLENBQUNrRixRQUFRLENBQUF1RSxNQUFPLEVBQUUsRUFBRSxFQUN0QyxDQUFBdEssV0FBVyxDQUFDK0YsUUFBUSxDQUFBdUUsTUFBTyxDQUFDLEdBQUcsRUFBcUIsSUFBcEQsQ0FBc0N2QixjQUV0QyxJQURDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBUixLQUFPLENBQUMsQ0FBQyxjQUFjLEVBQTVCLElBQUksQ0FDUCxDQUNGLEVBUEMsSUFBSSxDQVFQLEVBVkMsR0FBRyxDQVdMO0lBQUE1QixDQUFBLE9BQUE0QixjQUFBO0lBQUE1QixDQUFBLE9BQUFwQixRQUFBLENBQUF1RSxNQUFBO0lBQUFuRCxDQUFBLE9BQUFrRCxHQUFBO0VBQUE7SUFBQUEsR0FBQSxHQUFBbEQsQ0FBQTtFQUFBO0VBQUEsSUFBQW9ELEdBQUE7RUFBQSxJQUFBcEQsQ0FBQSxTQUFBSCxRQUFBLElBQUFHLENBQUEsU0FBQUUsUUFBQSxJQUFBRixDQUFBLFNBQUFrRCxHQUFBLElBQUFsRCxDQUFBLFNBQUFnRCxFQUFBLElBQUFoRCxDQUFBLFNBQUErQyxLQUFBO0lBcENISyxHQUFBLElBQUMsTUFBTSxDQUNFTCxLQUFLLENBQUxBLE1BQUksQ0FBQyxDQUNGN0MsUUFBUSxDQUFSQSxTQUFPLENBQUMsQ0FDUkwsUUFBUSxDQUFSQSxTQUFPLENBQUMsQ0FDWixLQUFZLENBQVosWUFBWSxDQUNsQixjQUFjLENBQWQsS0FBYSxDQUFDLENBR2IsQ0FBQW1ELEVBYUQsQ0FHQyxDQUFBRSxHQVlELENBQ0YsRUFyQ0MsTUFBTSxDQXFDRTtJQUFBbEQsQ0FBQSxPQUFBSCxRQUFBO0lBQUFHLENBQUEsT0FBQUUsUUFBQTtJQUFBRixDQUFBLE9BQUFrRCxHQUFBO0lBQUFsRCxDQUFBLE9BQUFnRCxFQUFBO0lBQUFoRCxDQUFBLE9BQUErQyxLQUFBO0lBQUEvQyxDQUFBLE9BQUFvRCxHQUFBO0VBQUE7SUFBQUEsR0FBQSxHQUFBcEQsQ0FBQTtFQUFBO0VBQUEsSUFBQXFELEdBQUE7RUFBQSxJQUFBckQsQ0FBQSxTQUFBRyxpQkFBQTtJQUNUa0QsR0FBQSxJQUFDLEdBQUcsQ0FBYSxVQUFDLENBQUQsR0FBQyxDQUNoQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQVIsS0FBTyxDQUFDLENBQ1gsQ0FBQWhMLE9BQU8sQ0FBQWlMLFNBQVMsQ0FBRSx1Q0FDbEIsQ0FBQWpKLGdCQUFnQixDQUFtQixDQUFDLEVBQUF5RSxnQkFBb0IsSUFBeEQsbUJBQXVELENBQ3ZELFNBQUksQ0FDSnFCLGtCQUFnQixDQUFFLFdBQ3JCLEVBTEMsSUFBSSxDQU1QLEVBUEMsR0FBRyxDQU9FO0lBQUFILENBQUEsT0FBQUcsaUJBQUE7SUFBQUgsQ0FBQSxPQUFBcUQsR0FBQTtFQUFBO0lBQUFBLEdBQUEsR0FBQXJELENBQUE7RUFBQTtFQUFBLElBQUF1RCxHQUFBO0VBQUEsSUFBQXZELENBQUEsU0FBQW9ELEdBQUEsSUFBQXBELENBQUEsU0FBQXFELEdBQUE7SUE5Q1JFLEdBQUEsS0FDRSxDQUFBSCxHQXFDUSxDQUNSLENBQUFDLEdBT0ssQ0FBQyxHQUNMO0lBQUFyRCxDQUFBLE9BQUFvRCxHQUFBO0lBQUFwRCxDQUFBLE9BQUFxRCxHQUFBO0lBQUFyRCxDQUFBLE9BQUF1RCxHQUFBO0VBQUE7SUFBQUEsR0FBQSxHQUFBdkQsQ0FBQTtFQUFBO0VBQUEsT0EvQ0h1RCxHQStDRztBQUFBO0FBNUhQLFNBQUFOLE9BQUFPLE1BQUE7RUFBQSxPQTBGYyxDQUFDLElBQUksQ0FDRSxHQUFPLENBQVAsQ0FBQWxCLE1BQUksQ0FBQW1CLEVBQUUsQ0FBQyxDQUNMLEtBQW1ELENBQW5ELENBQUFuQixNQUFJLENBQUE1QyxNQUFPLEtBQUssV0FBbUMsR0FBbkQsU0FBbUQsR0FBbkQwQixTQUFrRCxDQUFDLENBRXpELENBQUFrQixNQUFJLENBQUE1QyxNQUFPLEtBQUssV0FBZ0MsR0FBbEJySCxPQUFPLENBQUFxTCxJQUFXLEdBQWhELFFBQStDLENBQUcsSUFBRSxDQUNwRCxDQUFBcEIsTUFBSSxDQUFBcUIsT0FBTyxDQUNkLEVBTkMsSUFBSSxDQU1FO0FBQUE7QUFoR3JCLFNBQUFuQixNQUFBdkUsSUFBQTtFQUFBLE9Bd0NnQyxDQUFDQSxJQUFJO0FBQUE7QUF3RnJDLGVBQWVRLFlBQVlBLENBQ3pCbUYsTUFBTSxFQUFFLE1BQU0sRUFDZHBGLFdBQVcsRUFBRWxFLGVBQWUsR0FBRyxTQUFTLEVBQ3hDd0IsUUFBUSxFQUFFLE1BQU0sRUFDaEIrSCxVQUFVLEVBQUUsTUFBTSxFQUNsQkMsWUFBWSxFQUFFLE1BQU0sRUFDcEI1SCxXQUFXLEVBQUUsQ0FBQzZILENBQUMsRUFBRSxDQUFDOUYsSUFBSSxFQUFFOUUsUUFBUSxFQUFFLEdBQUdBLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FDdkQsRUFBRWdHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUNmO0VBQ0E7RUFDQTtFQUNBLElBQUlYLFdBQVcsRUFBRTtJQUNmLElBQUk7TUFDRjtNQUNBO01BQ0E7TUFDQSxNQUFNckUsd0JBQXdCLENBQUMsQ0FBQztNQUNoQyxNQUFNQyxnQkFBZ0IsQ0FBQ29FLFdBQVcsQ0FBQyxDQUFDd0YsUUFBUSxDQUFDSixNQUFNLEVBQUUsQ0FBQzFKLGdCQUFnQixDQUFDLENBQUMsQ0FBQztJQUMzRSxDQUFDLENBQUMsT0FBTytKLEtBQUssRUFBRTtNQUNkekssZUFBZSxDQUFDLHFDQUFxQ29LLE1BQU0sS0FBS0ssS0FBSyxFQUFFLENBQUM7SUFDMUU7RUFDRixDQUFDLE1BQU07SUFDTDtJQUNBO0lBQ0E7SUFDQXpLLGVBQWUsQ0FDYix3Q0FBd0NvSyxNQUFNLDJCQUNoRCxDQUFDO0VBQ0g7RUFDQTtFQUNBakosb0JBQW9CLENBQUNtQixRQUFRLEVBQUU4SCxNQUFNLENBQUM7O0VBRXRDO0VBQ0EsTUFBTTtJQUFFTTtFQUFvQixDQUFDLEdBQUcsTUFBTWxKLHFCQUFxQixDQUN6RGMsUUFBUSxFQUNSK0gsVUFBVSxFQUNWQyxZQUFZLEVBQ1osWUFDRixDQUFDOztFQUVEO0VBQ0E1SCxXQUFXLENBQUMrQixJQUFJLElBQUk7SUFDbEIsSUFBSSxDQUFDQSxJQUFJLENBQUNrRyxXQUFXLEVBQUV2RSxTQUFTLEVBQUUsT0FBTzNCLElBQUk7SUFDN0MsSUFBSSxFQUFFNEYsVUFBVSxJQUFJNUYsSUFBSSxDQUFDa0csV0FBVyxDQUFDdkUsU0FBUyxDQUFDLEVBQUUsT0FBTzNCLElBQUk7SUFDNUQsTUFBTTtNQUFFLENBQUM0RixVQUFVLEdBQUdPLENBQUM7TUFBRSxHQUFHQztJQUFtQixDQUFDLEdBQzlDcEcsSUFBSSxDQUFDa0csV0FBVyxDQUFDdkUsU0FBUztJQUM1QixPQUFPO01BQ0wsR0FBRzNCLElBQUk7TUFDUGtHLFdBQVcsRUFBRTtRQUNYLEdBQUdsRyxJQUFJLENBQUNrRyxXQUFXO1FBQ25CdkUsU0FBUyxFQUFFeUU7TUFDYixDQUFDO01BQ0RDLEtBQUssRUFBRTtRQUNMQyxRQUFRLEVBQUUsQ0FDUixHQUFHdEcsSUFBSSxDQUFDcUcsS0FBSyxDQUFDQyxRQUFRLEVBQ3RCO1VBQ0VkLEVBQUUsRUFBRXJMLFVBQVUsQ0FBQyxDQUFDO1VBQ2hCb00sSUFBSSxFQUFFLFFBQVE7VUFDZEMsSUFBSSxFQUFFekssYUFBYSxDQUFDO1lBQ2xCNkIsSUFBSSxFQUFFLHFCQUFxQjtZQUMzQjZJLE9BQU8sRUFBRVI7VUFDWCxDQUFDLENBQUM7VUFDRlMsU0FBUyxFQUFFLElBQUlDLElBQUksQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQyxDQUFDO1VBQ25DbkYsTUFBTSxFQUFFLFNBQVMsSUFBSW9GO1FBQ3ZCLENBQUM7TUFFTDtJQUNGLENBQUM7RUFDSCxDQUFDLENBQUM7RUFDRnRMLGVBQWUsQ0FBQyx5QkFBeUJxSyxVQUFVLG1CQUFtQixDQUFDO0FBQ3pFO0FBRUEsZUFBZXZGLGtCQUFrQkEsQ0FDL0JzRixNQUFNLEVBQUUsTUFBTSxFQUNkcEYsV0FBVyxFQUFFbEUsZUFBZSxHQUFHLFNBQVMsQ0FDekMsRUFBRTZFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUNmLElBQUlYLFdBQVcsS0FBSyxRQUFRLEVBQUU7SUFDNUI7SUFDQSxNQUFNL0UsZUFBZSxDQUFDUSxXQUFXLEVBQUUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRTJKLE1BQU0sQ0FBQyxDQUFDO0VBQ3hFLENBQUMsTUFBTTtJQUNMO0lBQ0E7SUFDQTtJQUNBLE1BQU1tQixJQUFJLEdBQUc3SyxnQkFBZ0IsQ0FBQyxDQUFDLEdBQzNCLENBQUMsYUFBYSxFQUFFLElBQUksRUFBRTBKLE1BQU0sQ0FBQyxHQUM3QixDQUFDLElBQUksRUFBRXJKLGtCQUFrQixDQUFDLENBQUMsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFcUosTUFBTSxDQUFDO0lBQzdELE1BQU1uSyxlQUFlLENBQUNlLFlBQVksRUFBRXVLLElBQUksQ0FBQztFQUMzQztBQUNGOztBQUVBO0FBQ0E7QUFDQTtBQUNBLGVBQWVoRyx3QkFBd0JBLENBQ3JDSCxRQUFRLEVBQUUxRCxjQUFjLEVBQ3hCWSxRQUFRLEVBQUUsTUFBTSxDQUNqQixFQUFFcUQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ2YsSUFBSVAsUUFBUSxDQUFDTSxRQUFRLEVBQUU7SUFDckIsTUFBTUssWUFBWSxDQUFDWCxRQUFRLEVBQUU5QyxRQUFRLENBQUM7RUFDeEMsQ0FBQyxNQUFNO0lBQ0wsTUFBTXdELFlBQVksQ0FBQ1YsUUFBUSxFQUFFOUMsUUFBUSxDQUFDO0VBQ3hDO0FBQ0Y7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxlQUFld0QsWUFBWUEsQ0FDekJWLFFBQVEsRUFBRTFELGNBQWMsRUFDeEJZLFFBQVEsRUFBRSxNQUFNLENBQ2pCLEVBQUVxRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FDakI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxlQUFlSSxZQUFZQSxDQUN6QlgsUUFBUSxFQUFFMUQsY0FBYyxFQUN4QlksUUFBUSxFQUFFLE1BQU0sQ0FDakIsRUFBRXFELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUNqQjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM2Rix3QkFBd0JBLENBQy9CbEIsWUFBWSxFQUFFLE1BQU0sRUFDcEJoSSxRQUFRLEVBQUUsTUFBTSxFQUNoQm1KLFVBQVUsRUFBRXBMLGNBQWMsQ0FDM0IsRUFBRSxJQUFJLENBQUM7RUFDTjtFQUNBZSxhQUFhLENBQUNrQixRQUFRLEVBQUVnSSxZQUFZLEVBQUVtQixVQUFVLENBQUM7O0VBRWpEO0VBQ0EsTUFBTVAsT0FBTyxHQUFHdEosMkJBQTJCLENBQUM7SUFDMUM4RixJQUFJLEVBQUUrRCxVQUFVO0lBQ2hCVCxJQUFJLEVBQUU7RUFDUixDQUFDLENBQUM7RUFDRixLQUFLbEosY0FBYyxDQUNqQndJLFlBQVksRUFDWjtJQUNFVSxJQUFJLEVBQUUsV0FBVztJQUNqQkMsSUFBSSxFQUFFekssYUFBYSxDQUFDMEssT0FBTyxDQUFDO0lBQzVCQyxTQUFTLEVBQUUsSUFBSUMsSUFBSSxDQUFDLENBQUMsQ0FBQ0MsV0FBVyxDQUFDO0VBQ3BDLENBQUMsRUFDRC9JLFFBQ0YsQ0FBQztFQUNEdEMsZUFBZSxDQUNiLHFDQUFxQ3NLLFlBQVksS0FBS21CLFVBQVUsRUFDbEUsQ0FBQztBQUNIOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFNBQVMzSCxpQkFBaUJBLENBQ3hCc0IsUUFBUSxFQUFFMUQsY0FBYyxFQUN4QlksUUFBUSxFQUFFLE1BQU0sRUFDaEJrQixpQkFBaUIsRUFBRSxPQUFPLENBQzNCLEVBQUUsSUFBSSxDQUFDO0VBQ04sTUFBTWtJLFdBQVcsR0FBR3RHLFFBQVEsQ0FBQ3NDLElBQUksR0FDN0JwSCx3QkFBd0IsQ0FBQzhFLFFBQVEsQ0FBQ3NDLElBQUksQ0FBQyxHQUN2QyxTQUFTO0VBQ2IsTUFBTXpELE9BQU8sR0FBRztJQUNkLEdBQUduRSw2QkFBNkIsQ0FBQyxDQUFDO0lBQ2xDNEgsSUFBSSxFQUFFZ0UsV0FBVztJQUNqQi9ILGdDQUFnQyxFQUFFSDtFQUNwQyxDQUFDO0VBQ0QsTUFBTW1JLFFBQVEsR0FBR3hMLHFCQUFxQixDQUFDOEQsT0FBTyxDQUFDO0VBQy9DdUgsd0JBQXdCLENBQUNwRyxRQUFRLENBQUN4QyxJQUFJLEVBQUVOLFFBQVEsRUFBRXFKLFFBQVEsQ0FBQztBQUM3RDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTM0gscUJBQXFCQSxDQUM1Qm9DLFNBQVMsRUFBRTFFLGNBQWMsRUFBRSxFQUMzQlksUUFBUSxFQUFFLE1BQU0sRUFDaEJrQixpQkFBaUIsRUFBRSxPQUFPLENBQzNCLEVBQUUsSUFBSSxDQUFDO0VBQ04sSUFBSTRDLFNBQVMsQ0FBQ3JDLE1BQU0sS0FBSyxDQUFDLEVBQUU7RUFFNUIsTUFBTTZILEtBQUssR0FBR3hGLFNBQVMsQ0FBQ1AsR0FBRyxDQUFDdEMsQ0FBQyxJQUMzQkEsQ0FBQyxDQUFDbUUsSUFBSSxHQUFHcEgsd0JBQXdCLENBQUNpRCxDQUFDLENBQUNtRSxJQUFJLENBQUMsR0FBRyxTQUM5QyxDQUFDO0VBQ0QsTUFBTW1FLE9BQU8sR0FBR0QsS0FBSyxDQUFDRSxLQUFLLENBQUNDLENBQUMsSUFBSUEsQ0FBQyxLQUFLSCxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7O0VBRWhEO0VBQ0EsTUFBTUgsVUFBVSxHQUFHLENBQUNJLE9BQU8sR0FDdkIsU0FBUyxHQUNUMUwscUJBQXFCLENBQUM7SUFDcEIsR0FBR0wsNkJBQTZCLENBQUMsQ0FBQztJQUNsQzRILElBQUksRUFBRWtFLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxTQUFTO0lBQzNCakksZ0NBQWdDLEVBQUVIO0VBQ3BDLENBQUMsQ0FBQzs7RUFFTjtFQUNBLE1BQU13SSxXQUFXLEdBQUc1RixTQUFTLENBQUNQLEdBQUcsQ0FBQ3RDLENBQUMsS0FBSztJQUN0Q2hCLFVBQVUsRUFBRWdCLENBQUMsQ0FBQ1gsSUFBSTtJQUNsQjhFLElBQUksRUFBRStEO0VBQ1IsQ0FBQyxDQUFDLENBQUM7RUFDSHBLLHNCQUFzQixDQUFDaUIsUUFBUSxFQUFFMEosV0FBVyxDQUFDOztFQUU3QztFQUNBLEtBQUssTUFBTTVHLFFBQVEsSUFBSWdCLFNBQVMsRUFBRTtJQUNoQyxNQUFNOEUsT0FBTyxHQUFHdEosMkJBQTJCLENBQUM7TUFDMUM4RixJQUFJLEVBQUUrRCxVQUFVO01BQ2hCVCxJQUFJLEVBQUU7SUFDUixDQUFDLENBQUM7SUFDRixLQUFLbEosY0FBYyxDQUNqQnNELFFBQVEsQ0FBQ3hDLElBQUksRUFDYjtNQUNFb0ksSUFBSSxFQUFFLFdBQVc7TUFDakJDLElBQUksRUFBRXpLLGFBQWEsQ0FBQzBLLE9BQU8sQ0FBQztNQUM1QkMsU0FBUyxFQUFFLElBQUlDLElBQUksQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQztJQUNwQyxDQUFDLEVBQ0QvSSxRQUNGLENBQUM7RUFDSDtFQUNBdEMsZUFBZSxDQUNiLHlDQUF5Q29HLFNBQVMsQ0FBQ3JDLE1BQU0sZUFBZTBILFVBQVUsRUFDcEYsQ0FBQztBQUNIIiwiaWdub3JlTGlzdCI6W119