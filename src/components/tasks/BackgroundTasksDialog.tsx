import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import figures from 'figures';
import React, { type ReactNode, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { isCoordinatorMode } from 'src/coordinator/coordinatorMode.js';
import { useTerminalSize } from 'src/hooks/useTerminalSize.js';
import { useAppState, useSetAppState } from 'src/state/AppState.js';
import { enterTeammateView, exitTeammateView } from 'src/state/teammateViewHelpers.js';
import type { ToolUseContext } from 'src/Tool.js';
import { DreamTask, type DreamTaskState } from 'src/tasks/DreamTask/DreamTask.js';
import { InProcessTeammateTask } from 'src/tasks/InProcessTeammateTask/InProcessTeammateTask.js';
import type { InProcessTeammateTaskState } from 'src/tasks/InProcessTeammateTask/types.js';
import type { LocalAgentTaskState } from 'src/tasks/LocalAgentTask/LocalAgentTask.js';
import { LocalAgentTask } from 'src/tasks/LocalAgentTask/LocalAgentTask.js';
import type { LocalShellTaskState } from 'src/tasks/LocalShellTask/guards.js';
import { LocalShellTask } from 'src/tasks/LocalShellTask/LocalShellTask.js';
// Type import is erased at build time — safe even though module is ant-gated.
import type { LocalWorkflowTaskState } from 'src/tasks/LocalWorkflowTask/LocalWorkflowTask.js';
import type { MonitorMcpTaskState } from 'src/tasks/MonitorMcpTask/MonitorMcpTask.js';
import { RemoteAgentTask, type RemoteAgentTaskState } from 'src/tasks/RemoteAgentTask/RemoteAgentTask.js';
import { type BackgroundTaskState, isBackgroundTask, type TaskState } from 'src/tasks/types.js';
import type { DeepImmutable } from 'src/types/utils.js';
import { intersperse } from 'src/utils/array.js';
import { TEAM_LEAD_NAME } from 'src/utils/swarm/constants.js';
import { stopUltraplan } from '../../commands/ultraplan.js';
import type { CommandResultDisplay } from '../../commands.js';
import { useRegisterOverlay } from '../../context/overlayContext.js';
import type { ExitState } from '../../hooks/useExitOnCtrlCDWithKeybindings.js';
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js';
import { Box, Text } from '../../ink.js';
import { useKeybindings } from '../../keybindings/useKeybinding.js';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay.js';
import { count } from '../../utils/array.js';
import { Byline } from '../design-system/Byline.js';
import { Dialog } from '../design-system/Dialog.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import { AsyncAgentDetailDialog } from './AsyncAgentDetailDialog.js';
import { BackgroundTask as BackgroundTaskComponent } from './BackgroundTask.js';
import { DreamDetailDialog } from './DreamDetailDialog.js';
import { InProcessTeammateDetailDialog } from './InProcessTeammateDetailDialog.js';
import { RemoteSessionDetailDialog } from './RemoteSessionDetailDialog.js';
import { ShellDetailDialog } from './ShellDetailDialog.js';
type ViewState = {
  mode: 'list';
} | {
  mode: 'detail';
  itemId: string;
};
type Props = {
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
  toolUseContext: ToolUseContext;
  initialDetailTaskId?: string;
};
type ListItem = {
  id: string;
  type: 'local_bash';
  label: string;
  status: string;
  task: DeepImmutable<LocalShellTaskState>;
} | {
  id: string;
  type: 'remote_agent';
  label: string;
  status: string;
  task: DeepImmutable<RemoteAgentTaskState>;
} | {
  id: string;
  type: 'local_agent';
  label: string;
  status: string;
  task: DeepImmutable<LocalAgentTaskState>;
} | {
  id: string;
  type: 'in_process_teammate';
  label: string;
  status: string;
  task: DeepImmutable<InProcessTeammateTaskState>;
} | {
  id: string;
  type: 'local_workflow';
  label: string;
  status: string;
  task: DeepImmutable<LocalWorkflowTaskState>;
} | {
  id: string;
  type: 'monitor_mcp';
  label: string;
  status: string;
  task: DeepImmutable<MonitorMcpTaskState>;
} | {
  id: string;
  type: 'dream';
  label: string;
  status: string;
  task: DeepImmutable<DreamTaskState>;
} | {
  id: string;
  type: 'leader';
  label: string;
  status: 'running';
};

// WORKFLOW_SCRIPTS is ant-only (build_flags.yaml). Static imports would leak
// ~1.3K lines into external builds. Gate with feature() + require so the
// bundler can dead-code-eliminate the branch.
/* eslint-disable @typescript-eslint/no-require-imports */
const WorkflowDetailDialog = feature('WORKFLOW_SCRIPTS') ? (require('./WorkflowDetailDialog.js') as typeof import('./WorkflowDetailDialog.js')).WorkflowDetailDialog : null;
const workflowTaskModule = feature('WORKFLOW_SCRIPTS') ? require('src/tasks/LocalWorkflowTask/LocalWorkflowTask.js') as typeof import('src/tasks/LocalWorkflowTask/LocalWorkflowTask.js') : null;
const killWorkflowTask = workflowTaskModule?.killWorkflowTask ?? null;
const skipWorkflowAgent = workflowTaskModule?.skipWorkflowAgent ?? null;
const retryWorkflowAgent = workflowTaskModule?.retryWorkflowAgent ?? null;
// Relative path, not `src/...` path-mapping — Bun's DCE can statically
// resolve + eliminate `./` requires, but path-mapped strings stay opaque
// and survive as dead literals in the bundle. Matches tasks.ts pattern.
const monitorMcpModule = feature('MONITOR_TOOL') ? require('../../tasks/MonitorMcpTask/MonitorMcpTask.js') as typeof import('../../tasks/MonitorMcpTask/MonitorMcpTask.js') : null;
const killMonitorMcp = monitorMcpModule?.killMonitorMcp ?? null;
const MonitorMcpDetailDialog = feature('MONITOR_TOOL') ? (require('./MonitorMcpDetailDialog.js') as typeof import('./MonitorMcpDetailDialog.js')).MonitorMcpDetailDialog : null;
/* eslint-enable @typescript-eslint/no-require-imports */

// Helper to get filtered background tasks (excludes foregrounded local_agent)
function getSelectableBackgroundTasks(tasks: Record<string, TaskState> | undefined, foregroundedTaskId: string | undefined): TaskState[] {
  const backgroundTasks = Object.values(tasks ?? {}).filter(isBackgroundTask);
  return backgroundTasks.filter(task => !(task.type === 'local_agent' && task.id === foregroundedTaskId));
}
export function BackgroundTasksDialog({
  onDone,
  toolUseContext,
  initialDetailTaskId
}: Props): React.ReactNode {
  const tasks = useAppState(s => s.tasks);
  const foregroundedTaskId = useAppState(s_0 => s_0.foregroundedTaskId);
  const showSpinnerTree = useAppState(s_1 => s_1.expandedView) === 'teammates';
  const setAppState = useSetAppState();
  const killAgentsShortcut = useShortcutDisplay('chat:killAgents', 'Chat', 'ctrl+x ctrl+k');
  const typedTasks = tasks as Record<string, TaskState> | undefined;

  // Track if we skipped list view on mount (for back button behavior)
  const skippedListOnMount = useRef(false);

  // Compute initial view state - skip list if caller provided a specific task,
  // or if there's exactly one task
  const [viewState, setViewState] = useState<ViewState>(() => {
    if (initialDetailTaskId) {
      skippedListOnMount.current = true;
      return {
        mode: 'detail',
        itemId: initialDetailTaskId
      };
    }
    const allItems = getSelectableBackgroundTasks(typedTasks, foregroundedTaskId);
    if (allItems.length === 1) {
      skippedListOnMount.current = true;
      return {
        mode: 'detail',
        itemId: allItems[0]!.id
      };
    }
    return {
      mode: 'list'
    };
  });
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Register as modal overlay so parent Chat keybindings (up/down for history)
  // are deactivated while this dialog is open
  useRegisterOverlay('background-tasks-dialog');

  // Memoize the sorted and categorized items together to ensure stable references
  const {
    bashTasks,
    remoteSessions,
    agentTasks,
    teammateTasks,
    workflowTasks,
    mcpMonitors,
    dreamTasks: dreamTasks_0,
    allSelectableItems
  } = useMemo(() => {
    // Filter to only show running/pending background tasks, matching the status bar count
    const backgroundTasks = Object.values(typedTasks ?? {}).filter(isBackgroundTask);
    const allItems_0 = backgroundTasks.map(toListItem);
    const sorted = allItems_0.sort((a, b) => {
      const aStatus = a.status;
      const bStatus = b.status;
      if (aStatus === 'running' && bStatus !== 'running') return -1;
      if (aStatus !== 'running' && bStatus === 'running') return 1;
      const aTime = 'task' in a ? a.task.startTime : 0;
      const bTime = 'task' in b ? b.task.startTime : 0;
      return bTime - aTime;
    });
    const bash = sorted.filter(item => item.type === 'local_bash');
    const remote = sorted.filter(item_0 => item_0.type === 'remote_agent');
    // Exclude foregrounded task - it's being viewed in the main UI, not a background task
    const agent = sorted.filter(item_1 => item_1.type === 'local_agent' && item_1.id !== foregroundedTaskId);
    const workflows = sorted.filter(item_2 => item_2.type === 'local_workflow');
    const monitorMcp = sorted.filter(item_3 => item_3.type === 'monitor_mcp');
    const dreamTasks = sorted.filter(item_4 => item_4.type === 'dream');
    // In spinner-tree mode, exclude teammates from the dialog (they appear in the tree)
    const teammates = showSpinnerTree ? [] : sorted.filter(item_5 => item_5.type === 'in_process_teammate');
    // Add leader entry when there are teammates, so users can foreground back to leader
    const leaderItem: ListItem[] = teammates.length > 0 ? [{
      id: '__leader__',
      type: 'leader',
      label: `@${TEAM_LEAD_NAME}`,
      status: 'running'
    }] : [];
    return {
      bashTasks: bash,
      remoteSessions: remote,
      agentTasks: agent,
      workflowTasks: workflows,
      mcpMonitors: monitorMcp,
      dreamTasks,
      teammateTasks: [...leaderItem, ...teammates],
      // Order MUST match JSX render order (teammates \u2192 bash \u2192 monitorMcp \u2192
      // remote \u2192 agent \u2192 workflows \u2192 dream) so \u2193/\u2191 navigation moves the cursor
      // visually downward.
      allSelectableItems: [...leaderItem, ...teammates, ...bash, ...monitorMcp, ...remote, ...agent, ...workflows, ...dreamTasks]
    };
  }, [typedTasks, foregroundedTaskId, showSpinnerTree]);
  const currentSelection = allSelectableItems[selectedIndex] ?? null;

  // Use configurable keybindings for standard navigation and confirm/cancel.
  // confirm:no is handled by Dialog's onCancel prop.
  useKeybindings({
    'confirm:previous': () => setSelectedIndex(prev => Math.max(0, prev - 1)),
    'confirm:next': () => setSelectedIndex(prev_0 => Math.min(allSelectableItems.length - 1, prev_0 + 1)),
    'confirm:yes': () => {
      const current = allSelectableItems[selectedIndex];
      if (current) {
        if (current.type === 'leader') {
          exitTeammateView(setAppState);
          onDone('Viewing leader', {
            display: 'system'
          });
        } else {
          setViewState({
            mode: 'detail',
            itemId: current.id
          });
        }
      }
    }
  }, {
    context: 'Confirmation',
    isActive: viewState.mode === 'list'
  });

  // Component-specific shortcuts (x=stop, f=foreground, right=zoom) shown in UI.
  // These are task-type and status dependent, not standard dialog keybindings.
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only handle input when in list mode
    if (viewState.mode !== 'list') return;
    if (e.key === 'left') {
      e.preventDefault();
      onDone('Background tasks dialog dismissed', {
        display: 'system'
      });
      return;
    }

    // Compute current selection at the time of the key press
    const currentSelection_0 = allSelectableItems[selectedIndex];
    if (!currentSelection_0) return; // everything below requires a selection

    if (e.key === 'x') {
      e.preventDefault();
      if (currentSelection_0.type === 'local_bash' && currentSelection_0.status === 'running') {
        void killShellTask(currentSelection_0.id);
      } else if (currentSelection_0.type === 'local_agent' && currentSelection_0.status === 'running') {
        void killAgentTask(currentSelection_0.id);
      } else if (currentSelection_0.type === 'in_process_teammate' && currentSelection_0.status === 'running') {
        void killTeammateTask(currentSelection_0.id);
      } else if (currentSelection_0.type === 'local_workflow' && currentSelection_0.status === 'running' && killWorkflowTask) {
        killWorkflowTask(currentSelection_0.id, setAppState);
      } else if (currentSelection_0.type === 'monitor_mcp' && currentSelection_0.status === 'running' && killMonitorMcp) {
        killMonitorMcp(currentSelection_0.id, setAppState);
      } else if (currentSelection_0.type === 'dream' && currentSelection_0.status === 'running') {
        void killDreamTask(currentSelection_0.id);
      } else if (currentSelection_0.type === 'remote_agent' && currentSelection_0.status === 'running') {
        if (currentSelection_0.task.isUltraplan) {
          void stopUltraplan(currentSelection_0.id, currentSelection_0.task.sessionId, setAppState);
        } else {
          void killRemoteAgentTask(currentSelection_0.id);
        }
      }
    }
    if (e.key === 'f') {
      if (currentSelection_0.type === 'in_process_teammate' && currentSelection_0.status === 'running') {
        e.preventDefault();
        enterTeammateView(currentSelection_0.id, setAppState);
        onDone('Viewing teammate', {
          display: 'system'
        });
      } else if (currentSelection_0.type === 'leader') {
        e.preventDefault();
        exitTeammateView(setAppState);
        onDone('Viewing leader', {
          display: 'system'
        });
      }
    }
  };
  async function killShellTask(taskId: string): Promise<void> {
    await LocalShellTask.kill(taskId, setAppState);
  }
  async function killAgentTask(taskId_0: string): Promise<void> {
    await LocalAgentTask.kill(taskId_0, setAppState);
  }
  async function killTeammateTask(taskId_1: string): Promise<void> {
    await InProcessTeammateTask.kill(taskId_1, setAppState);
  }
  async function killDreamTask(taskId_2: string): Promise<void> {
    await DreamTask.kill(taskId_2, setAppState);
  }
  async function killRemoteAgentTask(taskId_3: string): Promise<void> {
    await RemoteAgentTask.kill(taskId_3, setAppState);
  }

  // Wrap onDone in useEffectEvent to get a stable reference that always calls
  // the current onDone callback without causing the effect to re-fire.
  const onDoneEvent = useEffectEvent(onDone);
  useEffect(() => {
    if (viewState.mode !== 'list') {
      const task = (typedTasks ?? {})[viewState.itemId];
      // Workflow tasks get a grace: their detail view stays open through
      // completion so the user sees the final state before eviction.
      if (!task || task.type !== 'local_workflow' && !isBackgroundTask(task)) {
        // Task was removed or is no longer a background task (e.g. killed).
        // If we skipped the list on mount, close the dialog entirely.
        if (skippedListOnMount.current) {
          onDoneEvent('Background tasks dialog dismissed', {
            display: 'system'
          });
        } else {
          setViewState({
            mode: 'list'
          });
        }
      }
    }
    const totalItems = allSelectableItems.length;
    if (selectedIndex >= totalItems && totalItems > 0) {
      setSelectedIndex(totalItems - 1);
    }
  }, [viewState, typedTasks, selectedIndex, allSelectableItems, onDoneEvent]);

  // Helper to go back to list view (or close dialog if we skipped list on
  // mount AND there's still only ≤1 item). Checking current count prevents
  // the stale-state trap: if you opened with 1 task (auto-skipped to detail),
  // then a second task started, 'back' should show the list — not close.
  const goBackToList = () => {
    if (skippedListOnMount.current && allSelectableItems.length <= 1) {
      onDone('Background tasks dialog dismissed', {
        display: 'system'
      });
    } else {
      skippedListOnMount.current = false;
      setViewState({
        mode: 'list'
      });
    }
  };

  // If an item is selected, show the appropriate view
  if (viewState.mode !== 'list' && typedTasks) {
    const task_0 = typedTasks[viewState.itemId];
    if (!task_0) {
      return null;
    }

    // Detail mode - show appropriate detail dialog
    switch (task_0.type) {
      case 'local_bash':
        return <ShellDetailDialog shell={task_0} onDone={onDone} onKillShell={() => void killShellTask(task_0.id)} onBack={goBackToList} key={`shell-${task_0.id}`} />;
      case 'local_agent':
        return <AsyncAgentDetailDialog agent={task_0} onDone={onDone} onKillAgent={() => void killAgentTask(task_0.id)} onBack={goBackToList} key={`agent-${task_0.id}`} />;
      case 'remote_agent':
        return <RemoteSessionDetailDialog session={task_0} onDone={onDone} toolUseContext={toolUseContext} onBack={goBackToList} onKill={task_0.status !== 'running' ? undefined : task_0.isUltraplan ? () => void stopUltraplan(task_0.id, task_0.sessionId, setAppState) : () => void killRemoteAgentTask(task_0.id)} key={`session-${task_0.id}`} />;
      case 'in_process_teammate':
        return <InProcessTeammateDetailDialog teammate={task_0} onDone={onDone} onKill={task_0.status === 'running' ? () => void killTeammateTask(task_0.id) : undefined} onBack={goBackToList} onForeground={task_0.status === 'running' ? () => {
          enterTeammateView(task_0.id, setAppState);
          onDone('Viewing teammate', {
            display: 'system'
          });
        } : undefined} key={`teammate-${task_0.id}`} />;
      case 'local_workflow':
        if (!WorkflowDetailDialog) return null;
        return <WorkflowDetailDialog workflow={task_0} onDone={onDone} onKill={task_0.status === 'running' && killWorkflowTask ? () => killWorkflowTask(task_0.id, setAppState) : undefined} onSkipAgent={task_0.status === 'running' && skipWorkflowAgent ? agentId => skipWorkflowAgent(task_0.id, agentId, setAppState) : undefined} onRetryAgent={task_0.status === 'running' && retryWorkflowAgent ? agentId_0 => retryWorkflowAgent(task_0.id, agentId_0, setAppState) : undefined} onBack={goBackToList} key={`workflow-${task_0.id}`} />;
      case 'monitor_mcp':
        if (!MonitorMcpDetailDialog) return null;
        return <MonitorMcpDetailDialog task={task_0} onKill={task_0.status === 'running' && killMonitorMcp ? () => killMonitorMcp(task_0.id, setAppState) : undefined} onBack={goBackToList} key={`monitor-mcp-${task_0.id}`} />;
      case 'dream':
        return <DreamDetailDialog task={task_0} onDone={() => onDone('Background tasks dialog dismissed', {
          display: 'system'
        })} onBack={goBackToList} onKill={task_0.status === 'running' ? () => void killDreamTask(task_0.id) : undefined} key={`dream-${task_0.id}`} />;
    }
  }
  const runningBashCount = count(bashTasks, _ => _.status === 'running');
  const runningAgentCount = count(remoteSessions, __0 => __0.status === 'running' || __0.status === 'pending') + count(agentTasks, __1 => __1.status === 'running');
  const runningTeammateCount = count(teammateTasks, __2 => __2.status === 'running');
  const subtitle = intersperse([...(runningTeammateCount > 0 ? [<Text key="teammates">
              {runningTeammateCount}{' '}
              {runningTeammateCount !== 1 ? 'agents' : 'agent'}
            </Text>] : []), ...(runningBashCount > 0 ? [<Text key="shells">
              {runningBashCount}{' '}
              {runningBashCount !== 1 ? 'active shells' : 'active shell'}
            </Text>] : []), ...(runningAgentCount > 0 ? [<Text key="agents">
              {runningAgentCount}{' '}
              {runningAgentCount !== 1 ? 'active agents' : 'active agent'}
            </Text>] : [])], index => <Text key={`separator-${index}`}> · </Text>);
  const actions = [<KeyboardShortcutHint key="upDown" shortcut="↑/↓" action="select" />, <KeyboardShortcutHint key="enter" shortcut="Enter" action="view" />, ...(currentSelection?.type === 'in_process_teammate' && currentSelection.status === 'running' ? [<KeyboardShortcutHint key="foreground" shortcut="f" action="foreground" />] : []), ...((currentSelection?.type === 'local_bash' || currentSelection?.type === 'local_agent' || currentSelection?.type === 'in_process_teammate' || currentSelection?.type === 'local_workflow' || currentSelection?.type === 'monitor_mcp' || currentSelection?.type === 'dream' || currentSelection?.type === 'remote_agent') && currentSelection.status === 'running' ? [<KeyboardShortcutHint key="kill" shortcut="x" action="stop" />] : []), ...(agentTasks.some(t => t.status === 'running') ? [<KeyboardShortcutHint key="kill-all" shortcut={killAgentsShortcut} action="stop all agents" />] : []), <KeyboardShortcutHint key="esc" shortcut="←/Esc" action="close" />];
  const handleCancel = () => onDone('Background tasks dialog dismissed', {
    display: 'system'
  });
  function renderInputGuide(exitState: ExitState): React.ReactNode {
    if (exitState.pending) {
      return <Text>Press {exitState.keyName} again to exit</Text>;
    }
    return <Byline>{actions}</Byline>;
  }
  return <Box flexDirection="column" tabIndex={0} autoFocus onKeyDown={handleKeyDown}>
      <Dialog title="Background tasks" subtitle={<>{subtitle}</>} onCancel={handleCancel} color="background" inputGuide={renderInputGuide}>
        {allSelectableItems.length === 0 ? <Text dimColor>No tasks currently running</Text> : <Box flexDirection="column">
            {teammateTasks.length > 0 && <Box flexDirection="column">
                {(bashTasks.length > 0 || remoteSessions.length > 0 || agentTasks.length > 0) && <Text dimColor>
                    <Text bold>{'  '}Agents</Text> (
                    {count(teammateTasks, i => i.type !== 'leader')})
                  </Text>}
                <Box flexDirection="column">
                  <TeammateTaskGroups teammateTasks={teammateTasks} currentSelectionId={currentSelection?.id} />
                </Box>
              </Box>}

            {bashTasks.length > 0 && <Box flexDirection="column" marginTop={teammateTasks.length > 0 ? 1 : 0}>
                {(teammateTasks.length > 0 || remoteSessions.length > 0 || agentTasks.length > 0) && <Text dimColor>
                    <Text bold>{'  '}Shells</Text> ({bashTasks.length})
                  </Text>}
                <Box flexDirection="column">
                  {bashTasks.map(item_6 => <Item key={item_6.id} item={item_6} isSelected={item_6.id === currentSelection?.id} />)}
                </Box>
              </Box>}

            {mcpMonitors.length > 0 && <Box flexDirection="column" marginTop={teammateTasks.length > 0 || bashTasks.length > 0 ? 1 : 0}>
                <Text dimColor>
                  <Text bold>{'  '}Monitors</Text> ({mcpMonitors.length})
                </Text>
                <Box flexDirection="column">
                  {mcpMonitors.map(item_7 => <Item key={item_7.id} item={item_7} isSelected={item_7.id === currentSelection?.id} />)}
                </Box>
              </Box>}

            {remoteSessions.length > 0 && <Box flexDirection="column" marginTop={teammateTasks.length > 0 || bashTasks.length > 0 || mcpMonitors.length > 0 ? 1 : 0}>
                <Text dimColor>
                  <Text bold>{'  '}Remote agents</Text> ({remoteSessions.length}
                  )
                </Text>
                <Box flexDirection="column">
                  {remoteSessions.map(item_8 => <Item key={item_8.id} item={item_8} isSelected={item_8.id === currentSelection?.id} />)}
                </Box>
              </Box>}

            {agentTasks.length > 0 && <Box flexDirection="column" marginTop={teammateTasks.length > 0 || bashTasks.length > 0 || mcpMonitors.length > 0 || remoteSessions.length > 0 ? 1 : 0}>
                <Text dimColor>
                  <Text bold>{'  '}Local agents</Text> ({agentTasks.length})
                </Text>
                <Box flexDirection="column">
                  {agentTasks.map(item_9 => <Item key={item_9.id} item={item_9} isSelected={item_9.id === currentSelection?.id} />)}
                </Box>
              </Box>}

            {workflowTasks.length > 0 && <Box flexDirection="column" marginTop={teammateTasks.length > 0 || bashTasks.length > 0 || mcpMonitors.length > 0 || remoteSessions.length > 0 || agentTasks.length > 0 ? 1 : 0}>
                <Text dimColor>
                  <Text bold>{'  '}Workflows</Text> ({workflowTasks.length})
                </Text>
                <Box flexDirection="column">
                  {workflowTasks.map(item_10 => <Item key={item_10.id} item={item_10} isSelected={item_10.id === currentSelection?.id} />)}
                </Box>
              </Box>}

            {dreamTasks_0.length > 0 && <Box flexDirection="column" marginTop={teammateTasks.length > 0 || bashTasks.length > 0 || mcpMonitors.length > 0 || remoteSessions.length > 0 || agentTasks.length > 0 || workflowTasks.length > 0 ? 1 : 0}>
                <Box flexDirection="column">
                  {dreamTasks_0.map(item_11 => <Item key={item_11.id} item={item_11} isSelected={item_11.id === currentSelection?.id} />)}
                </Box>
              </Box>}
          </Box>}
      </Dialog>
    </Box>;
}
function toListItem(task: BackgroundTaskState): ListItem {
  switch (task.type) {
    case 'local_bash':
      return {
        id: task.id,
        type: 'local_bash',
        label: task.kind === 'monitor' ? task.description : task.command,
        status: task.status,
        task
      };
    case 'remote_agent':
      return {
        id: task.id,
        type: 'remote_agent',
        label: task.title,
        status: task.status,
        task
      };
    case 'local_agent':
      return {
        id: task.id,
        type: 'local_agent',
        label: task.description,
        status: task.status,
        task
      };
    case 'in_process_teammate':
      return {
        id: task.id,
        type: 'in_process_teammate',
        label: `@${task.identity.agentName}`,
        status: task.status,
        task
      };
    case 'local_workflow':
      return {
        id: task.id,
        type: 'local_workflow',
        label: task.summary ?? task.description,
        status: task.status,
        task
      };
    case 'monitor_mcp':
      return {
        id: task.id,
        type: 'monitor_mcp',
        label: task.description,
        status: task.status,
        task
      };
    case 'dream':
      return {
        id: task.id,
        type: 'dream',
        label: task.description,
        status: task.status,
        task
      };
  }
}
function Item(t0) {
  const $ = _c(14);
  const {
    item,
    isSelected
  } = t0;
  const {
    columns
  } = useTerminalSize();
  const maxActivityWidth = Math.max(30, columns - 26);
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = isCoordinatorMode();
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  const useGreyPointer = t1;
  const t2 = useGreyPointer && isSelected;
  const t3 = isSelected ? figures.pointer + " " : "  ";
  let t4;
  if ($[1] !== t2 || $[2] !== t3) {
    t4 = <Text dimColor={t2}>{t3}</Text>;
    $[1] = t2;
    $[2] = t3;
    $[3] = t4;
  } else {
    t4 = $[3];
  }
  const t5 = isSelected && !useGreyPointer ? "suggestion" : undefined;
  let t6;
  if ($[4] !== item.task || $[5] !== item.type || $[6] !== maxActivityWidth) {
    t6 = item.type === "leader" ? <Text>@{TEAM_LEAD_NAME}</Text> : <BackgroundTaskComponent task={item.task} maxActivityWidth={maxActivityWidth} />;
    $[4] = item.task;
    $[5] = item.type;
    $[6] = maxActivityWidth;
    $[7] = t6;
  } else {
    t6 = $[7];
  }
  let t7;
  if ($[8] !== t5 || $[9] !== t6) {
    t7 = <Text color={t5}>{t6}</Text>;
    $[8] = t5;
    $[9] = t6;
    $[10] = t7;
  } else {
    t7 = $[10];
  }
  let t8;
  if ($[11] !== t4 || $[12] !== t7) {
    t8 = <Box flexDirection="row">{t4}{t7}</Box>;
    $[11] = t4;
    $[12] = t7;
    $[13] = t8;
  } else {
    t8 = $[13];
  }
  return t8;
}
function TeammateTaskGroups(t0) {
  const $ = _c(3);
  const {
    teammateTasks,
    currentSelectionId
  } = t0;
  let t1;
  if ($[0] !== currentSelectionId || $[1] !== teammateTasks) {
    const leaderItems = teammateTasks.filter(_temp);
    const teammateItems = teammateTasks.filter(_temp2);
    const teams = new Map();
    for (const item of teammateItems) {
      const teamName = item.task.identity.teamName;
      const group = teams.get(teamName);
      if (group) {
        group.push(item);
      } else {
        teams.set(teamName, [item]);
      }
    }
    const teamEntries = [...teams.entries()];
    t1 = <>{teamEntries.map(t2 => {
        const [teamName_0, items] = t2;
        const memberCount = items.length + leaderItems.length;
        return <Box key={teamName_0} flexDirection="column"><Text dimColor={true}>{"  "}Team: {teamName_0} ({memberCount})</Text>{leaderItems.map(item_0 => <Item key={`${item_0.id}-${teamName_0}`} item={item_0} isSelected={item_0.id === currentSelectionId} />)}{items.map(item_1 => <Item key={item_1.id} item={item_1} isSelected={item_1.id === currentSelectionId} />)}</Box>;
      })}</>;
    $[0] = currentSelectionId;
    $[1] = teammateTasks;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  return t1;
}
function _temp2(i_0) {
  return i_0.type === "in_process_teammate";
}
function _temp(i) {
  return i.type === "leader";
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiZmlndXJlcyIsIlJlYWN0IiwiUmVhY3ROb2RlIiwidXNlRWZmZWN0IiwidXNlRWZmZWN0RXZlbnQiLCJ1c2VNZW1vIiwidXNlUmVmIiwidXNlU3RhdGUiLCJpc0Nvb3JkaW5hdG9yTW9kZSIsInVzZVRlcm1pbmFsU2l6ZSIsInVzZUFwcFN0YXRlIiwidXNlU2V0QXBwU3RhdGUiLCJlbnRlclRlYW1tYXRlVmlldyIsImV4aXRUZWFtbWF0ZVZpZXciLCJUb29sVXNlQ29udGV4dCIsIkRyZWFtVGFzayIsIkRyZWFtVGFza1N0YXRlIiwiSW5Qcm9jZXNzVGVhbW1hdGVUYXNrIiwiSW5Qcm9jZXNzVGVhbW1hdGVUYXNrU3RhdGUiLCJMb2NhbEFnZW50VGFza1N0YXRlIiwiTG9jYWxBZ2VudFRhc2siLCJMb2NhbFNoZWxsVGFza1N0YXRlIiwiTG9jYWxTaGVsbFRhc2siLCJMb2NhbFdvcmtmbG93VGFza1N0YXRlIiwiTW9uaXRvck1jcFRhc2tTdGF0ZSIsIlJlbW90ZUFnZW50VGFzayIsIlJlbW90ZUFnZW50VGFza1N0YXRlIiwiQmFja2dyb3VuZFRhc2tTdGF0ZSIsImlzQmFja2dyb3VuZFRhc2siLCJUYXNrU3RhdGUiLCJEZWVwSW1tdXRhYmxlIiwiaW50ZXJzcGVyc2UiLCJURUFNX0xFQURfTkFNRSIsInN0b3BVbHRyYXBsYW4iLCJDb21tYW5kUmVzdWx0RGlzcGxheSIsInVzZVJlZ2lzdGVyT3ZlcmxheSIsIkV4aXRTdGF0ZSIsIktleWJvYXJkRXZlbnQiLCJCb3giLCJUZXh0IiwidXNlS2V5YmluZGluZ3MiLCJ1c2VTaG9ydGN1dERpc3BsYXkiLCJjb3VudCIsIkJ5bGluZSIsIkRpYWxvZyIsIktleWJvYXJkU2hvcnRjdXRIaW50IiwiQXN5bmNBZ2VudERldGFpbERpYWxvZyIsIkJhY2tncm91bmRUYXNrIiwiQmFja2dyb3VuZFRhc2tDb21wb25lbnQiLCJEcmVhbURldGFpbERpYWxvZyIsIkluUHJvY2Vzc1RlYW1tYXRlRGV0YWlsRGlhbG9nIiwiUmVtb3RlU2Vzc2lvbkRldGFpbERpYWxvZyIsIlNoZWxsRGV0YWlsRGlhbG9nIiwiVmlld1N0YXRlIiwibW9kZSIsIml0ZW1JZCIsIlByb3BzIiwib25Eb25lIiwicmVzdWx0Iiwib3B0aW9ucyIsImRpc3BsYXkiLCJ0b29sVXNlQ29udGV4dCIsImluaXRpYWxEZXRhaWxUYXNrSWQiLCJMaXN0SXRlbSIsImlkIiwidHlwZSIsImxhYmVsIiwic3RhdHVzIiwidGFzayIsIldvcmtmbG93RGV0YWlsRGlhbG9nIiwicmVxdWlyZSIsIndvcmtmbG93VGFza01vZHVsZSIsImtpbGxXb3JrZmxvd1Rhc2siLCJza2lwV29ya2Zsb3dBZ2VudCIsInJldHJ5V29ya2Zsb3dBZ2VudCIsIm1vbml0b3JNY3BNb2R1bGUiLCJraWxsTW9uaXRvck1jcCIsIk1vbml0b3JNY3BEZXRhaWxEaWFsb2ciLCJnZXRTZWxlY3RhYmxlQmFja2dyb3VuZFRhc2tzIiwidGFza3MiLCJSZWNvcmQiLCJmb3JlZ3JvdW5kZWRUYXNrSWQiLCJiYWNrZ3JvdW5kVGFza3MiLCJPYmplY3QiLCJ2YWx1ZXMiLCJmaWx0ZXIiLCJCYWNrZ3JvdW5kVGFza3NEaWFsb2ciLCJzIiwic2hvd1NwaW5uZXJUcmVlIiwiZXhwYW5kZWRWaWV3Iiwic2V0QXBwU3RhdGUiLCJraWxsQWdlbnRzU2hvcnRjdXQiLCJ0eXBlZFRhc2tzIiwic2tpcHBlZExpc3RPbk1vdW50Iiwidmlld1N0YXRlIiwic2V0Vmlld1N0YXRlIiwiY3VycmVudCIsImFsbEl0ZW1zIiwibGVuZ3RoIiwic2VsZWN0ZWRJbmRleCIsInNldFNlbGVjdGVkSW5kZXgiLCJiYXNoVGFza3MiLCJyZW1vdGVTZXNzaW9ucyIsImFnZW50VGFza3MiLCJ0ZWFtbWF0ZVRhc2tzIiwid29ya2Zsb3dUYXNrcyIsIm1jcE1vbml0b3JzIiwiZHJlYW1UYXNrcyIsImFsbFNlbGVjdGFibGVJdGVtcyIsIm1hcCIsInRvTGlzdEl0ZW0iLCJzb3J0ZWQiLCJzb3J0IiwiYSIsImIiLCJhU3RhdHVzIiwiYlN0YXR1cyIsImFUaW1lIiwic3RhcnRUaW1lIiwiYlRpbWUiLCJiYXNoIiwiaXRlbSIsInJlbW90ZSIsImFnZW50Iiwid29ya2Zsb3dzIiwibW9uaXRvck1jcCIsInRlYW1tYXRlcyIsImxlYWRlckl0ZW0iLCJjdXJyZW50U2VsZWN0aW9uIiwiY29uZmlybTpwcmV2aW91cyIsInByZXYiLCJNYXRoIiwibWF4IiwiY29uZmlybTpuZXh0IiwibWluIiwiY29uZmlybTp5ZXMiLCJjb250ZXh0IiwiaXNBY3RpdmUiLCJoYW5kbGVLZXlEb3duIiwiZSIsImtleSIsInByZXZlbnREZWZhdWx0Iiwia2lsbFNoZWxsVGFzayIsImtpbGxBZ2VudFRhc2siLCJraWxsVGVhbW1hdGVUYXNrIiwia2lsbERyZWFtVGFzayIsImlzVWx0cmFwbGFuIiwic2Vzc2lvbklkIiwia2lsbFJlbW90ZUFnZW50VGFzayIsInRhc2tJZCIsIlByb21pc2UiLCJraWxsIiwib25Eb25lRXZlbnQiLCJ0b3RhbEl0ZW1zIiwiZ29CYWNrVG9MaXN0IiwidW5kZWZpbmVkIiwiYWdlbnRJZCIsInJ1bm5pbmdCYXNoQ291bnQiLCJfIiwicnVubmluZ0FnZW50Q291bnQiLCJydW5uaW5nVGVhbW1hdGVDb3VudCIsInN1YnRpdGxlIiwiaW5kZXgiLCJhY3Rpb25zIiwic29tZSIsInQiLCJoYW5kbGVDYW5jZWwiLCJyZW5kZXJJbnB1dEd1aWRlIiwiZXhpdFN0YXRlIiwicGVuZGluZyIsImtleU5hbWUiLCJpIiwia2luZCIsImRlc2NyaXB0aW9uIiwiY29tbWFuZCIsInRpdGxlIiwiaWRlbnRpdHkiLCJhZ2VudE5hbWUiLCJzdW1tYXJ5IiwiSXRlbSIsInQwIiwiJCIsIl9jIiwiaXNTZWxlY3RlZCIsImNvbHVtbnMiLCJtYXhBY3Rpdml0eVdpZHRoIiwidDEiLCJTeW1ib2wiLCJmb3IiLCJ1c2VHcmV5UG9pbnRlciIsInQyIiwidDMiLCJwb2ludGVyIiwidDQiLCJ0NSIsInQ2IiwidDciLCJ0OCIsIlRlYW1tYXRlVGFza0dyb3VwcyIsImN1cnJlbnRTZWxlY3Rpb25JZCIsImxlYWRlckl0ZW1zIiwiX3RlbXAiLCJ0ZWFtbWF0ZUl0ZW1zIiwiX3RlbXAyIiwidGVhbXMiLCJNYXAiLCJ0ZWFtTmFtZSIsImdyb3VwIiwiZ2V0IiwicHVzaCIsInNldCIsInRlYW1FbnRyaWVzIiwiZW50cmllcyIsInRlYW1OYW1lXzAiLCJpdGVtcyIsIm1lbWJlckNvdW50IiwiaXRlbV8wIiwiaXRlbV8xIiwiaV8wIl0sInNvdXJjZXMiOlsiQmFja2dyb3VuZFRhc2tzRGlhbG9nLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbmltcG9ydCBmaWd1cmVzIGZyb20gJ2ZpZ3VyZXMnXG5pbXBvcnQgUmVhY3QsIHtcbiAgdHlwZSBSZWFjdE5vZGUsXG4gIHVzZUVmZmVjdCxcbiAgdXNlRWZmZWN0RXZlbnQsXG4gIHVzZU1lbW8sXG4gIHVzZVJlZixcbiAgdXNlU3RhdGUsXG59IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgaXNDb29yZGluYXRvck1vZGUgfSBmcm9tICdzcmMvY29vcmRpbmF0b3IvY29vcmRpbmF0b3JNb2RlLmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnc3JjL2hvb2tzL3VzZVRlcm1pbmFsU2l6ZS5qcydcbmltcG9ydCB7IHVzZUFwcFN0YXRlLCB1c2VTZXRBcHBTdGF0ZSB9IGZyb20gJ3NyYy9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB7XG4gIGVudGVyVGVhbW1hdGVWaWV3LFxuICBleGl0VGVhbW1hdGVWaWV3LFxufSBmcm9tICdzcmMvc3RhdGUvdGVhbW1hdGVWaWV3SGVscGVycy5qcydcbmltcG9ydCB0eXBlIHsgVG9vbFVzZUNvbnRleHQgfSBmcm9tICdzcmMvVG9vbC5qcydcbmltcG9ydCB7XG4gIERyZWFtVGFzayxcbiAgdHlwZSBEcmVhbVRhc2tTdGF0ZSxcbn0gZnJvbSAnc3JjL3Rhc2tzL0RyZWFtVGFzay9EcmVhbVRhc2suanMnXG5pbXBvcnQgeyBJblByb2Nlc3NUZWFtbWF0ZVRhc2sgfSBmcm9tICdzcmMvdGFza3MvSW5Qcm9jZXNzVGVhbW1hdGVUYXNrL0luUHJvY2Vzc1RlYW1tYXRlVGFzay5qcydcbmltcG9ydCB0eXBlIHsgSW5Qcm9jZXNzVGVhbW1hdGVUYXNrU3RhdGUgfSBmcm9tICdzcmMvdGFza3MvSW5Qcm9jZXNzVGVhbW1hdGVUYXNrL3R5cGVzLmpzJ1xuaW1wb3J0IHR5cGUgeyBMb2NhbEFnZW50VGFza1N0YXRlIH0gZnJvbSAnc3JjL3Rhc2tzL0xvY2FsQWdlbnRUYXNrL0xvY2FsQWdlbnRUYXNrLmpzJ1xuaW1wb3J0IHsgTG9jYWxBZ2VudFRhc2sgfSBmcm9tICdzcmMvdGFza3MvTG9jYWxBZ2VudFRhc2svTG9jYWxBZ2VudFRhc2suanMnXG5pbXBvcnQgdHlwZSB7IExvY2FsU2hlbGxUYXNrU3RhdGUgfSBmcm9tICdzcmMvdGFza3MvTG9jYWxTaGVsbFRhc2svZ3VhcmRzLmpzJ1xuaW1wb3J0IHsgTG9jYWxTaGVsbFRhc2sgfSBmcm9tICdzcmMvdGFza3MvTG9jYWxTaGVsbFRhc2svTG9jYWxTaGVsbFRhc2suanMnXG4vLyBUeXBlIGltcG9ydCBpcyBlcmFzZWQgYXQgYnVpbGQgdGltZSDigJQgc2FmZSBldmVuIHRob3VnaCBtb2R1bGUgaXMgYW50LWdhdGVkLlxuaW1wb3J0IHR5cGUgeyBMb2NhbFdvcmtmbG93VGFza1N0YXRlIH0gZnJvbSAnc3JjL3Rhc2tzL0xvY2FsV29ya2Zsb3dUYXNrL0xvY2FsV29ya2Zsb3dUYXNrLmpzJ1xuaW1wb3J0IHR5cGUgeyBNb25pdG9yTWNwVGFza1N0YXRlIH0gZnJvbSAnc3JjL3Rhc2tzL01vbml0b3JNY3BUYXNrL01vbml0b3JNY3BUYXNrLmpzJ1xuaW1wb3J0IHtcbiAgUmVtb3RlQWdlbnRUYXNrLFxuICB0eXBlIFJlbW90ZUFnZW50VGFza1N0YXRlLFxufSBmcm9tICdzcmMvdGFza3MvUmVtb3RlQWdlbnRUYXNrL1JlbW90ZUFnZW50VGFzay5qcydcbmltcG9ydCB7XG4gIHR5cGUgQmFja2dyb3VuZFRhc2tTdGF0ZSxcbiAgaXNCYWNrZ3JvdW5kVGFzayxcbiAgdHlwZSBUYXNrU3RhdGUsXG59IGZyb20gJ3NyYy90YXNrcy90eXBlcy5qcydcbmltcG9ydCB0eXBlIHsgRGVlcEltbXV0YWJsZSB9IGZyb20gJ3NyYy90eXBlcy91dGlscy5qcydcbmltcG9ydCB7IGludGVyc3BlcnNlIH0gZnJvbSAnc3JjL3V0aWxzL2FycmF5LmpzJ1xuaW1wb3J0IHsgVEVBTV9MRUFEX05BTUUgfSBmcm9tICdzcmMvdXRpbHMvc3dhcm0vY29uc3RhbnRzLmpzJ1xuaW1wb3J0IHsgc3RvcFVsdHJhcGxhbiB9IGZyb20gJy4uLy4uL2NvbW1hbmRzL3VsdHJhcGxhbi5qcydcbmltcG9ydCB0eXBlIHsgQ29tbWFuZFJlc3VsdERpc3BsYXkgfSBmcm9tICcuLi8uLi9jb21tYW5kcy5qcydcbmltcG9ydCB7IHVzZVJlZ2lzdGVyT3ZlcmxheSB9IGZyb20gJy4uLy4uL2NvbnRleHQvb3ZlcmxheUNvbnRleHQuanMnXG5pbXBvcnQgdHlwZSB7IEV4aXRTdGF0ZSB9IGZyb20gJy4uLy4uL2hvb2tzL3VzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncy5qcydcbmltcG9ydCB0eXBlIHsgS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uL2luay9ldmVudHMva2V5Ym9hcmQtZXZlbnQuanMnXG5pbXBvcnQgeyBCb3gsIFRleHQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5pbXBvcnQgeyB1c2VLZXliaW5kaW5ncyB9IGZyb20gJy4uLy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgeyB1c2VTaG9ydGN1dERpc3BsYXkgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy91c2VTaG9ydGN1dERpc3BsYXkuanMnXG5pbXBvcnQgeyBjb3VudCB9IGZyb20gJy4uLy4uL3V0aWxzL2FycmF5LmpzJ1xuaW1wb3J0IHsgQnlsaW5lIH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9CeWxpbmUuanMnXG5pbXBvcnQgeyBEaWFsb2cgfSBmcm9tICcuLi9kZXNpZ24tc3lzdGVtL0RpYWxvZy5qcydcbmltcG9ydCB7IEtleWJvYXJkU2hvcnRjdXRIaW50IH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9LZXlib2FyZFNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IEFzeW5jQWdlbnREZXRhaWxEaWFsb2cgfSBmcm9tICcuL0FzeW5jQWdlbnREZXRhaWxEaWFsb2cuanMnXG5pbXBvcnQgeyBCYWNrZ3JvdW5kVGFzayBhcyBCYWNrZ3JvdW5kVGFza0NvbXBvbmVudCB9IGZyb20gJy4vQmFja2dyb3VuZFRhc2suanMnXG5pbXBvcnQgeyBEcmVhbURldGFpbERpYWxvZyB9IGZyb20gJy4vRHJlYW1EZXRhaWxEaWFsb2cuanMnXG5pbXBvcnQgeyBJblByb2Nlc3NUZWFtbWF0ZURldGFpbERpYWxvZyB9IGZyb20gJy4vSW5Qcm9jZXNzVGVhbW1hdGVEZXRhaWxEaWFsb2cuanMnXG5pbXBvcnQgeyBSZW1vdGVTZXNzaW9uRGV0YWlsRGlhbG9nIH0gZnJvbSAnLi9SZW1vdGVTZXNzaW9uRGV0YWlsRGlhbG9nLmpzJ1xuaW1wb3J0IHsgU2hlbGxEZXRhaWxEaWFsb2cgfSBmcm9tICcuL1NoZWxsRGV0YWlsRGlhbG9nLmpzJ1xuXG50eXBlIFZpZXdTdGF0ZSA9IHsgbW9kZTogJ2xpc3QnIH0gfCB7IG1vZGU6ICdkZXRhaWwnOyBpdGVtSWQ6IHN0cmluZyB9XG5cbnR5cGUgUHJvcHMgPSB7XG4gIG9uRG9uZTogKFxuICAgIHJlc3VsdD86IHN0cmluZyxcbiAgICBvcHRpb25zPzogeyBkaXNwbGF5PzogQ29tbWFuZFJlc3VsdERpc3BsYXkgfSxcbiAgKSA9PiB2b2lkXG4gIHRvb2xVc2VDb250ZXh0OiBUb29sVXNlQ29udGV4dFxuICBpbml0aWFsRGV0YWlsVGFza0lkPzogc3RyaW5nXG59XG5cbnR5cGUgTGlzdEl0ZW0gPVxuICB8IHtcbiAgICAgIGlkOiBzdHJpbmdcbiAgICAgIHR5cGU6ICdsb2NhbF9iYXNoJ1xuICAgICAgbGFiZWw6IHN0cmluZ1xuICAgICAgc3RhdHVzOiBzdHJpbmdcbiAgICAgIHRhc2s6IERlZXBJbW11dGFibGU8TG9jYWxTaGVsbFRhc2tTdGF0ZT5cbiAgICB9XG4gIHwge1xuICAgICAgaWQ6IHN0cmluZ1xuICAgICAgdHlwZTogJ3JlbW90ZV9hZ2VudCdcbiAgICAgIGxhYmVsOiBzdHJpbmdcbiAgICAgIHN0YXR1czogc3RyaW5nXG4gICAgICB0YXNrOiBEZWVwSW1tdXRhYmxlPFJlbW90ZUFnZW50VGFza1N0YXRlPlxuICAgIH1cbiAgfCB7XG4gICAgICBpZDogc3RyaW5nXG4gICAgICB0eXBlOiAnbG9jYWxfYWdlbnQnXG4gICAgICBsYWJlbDogc3RyaW5nXG4gICAgICBzdGF0dXM6IHN0cmluZ1xuICAgICAgdGFzazogRGVlcEltbXV0YWJsZTxMb2NhbEFnZW50VGFza1N0YXRlPlxuICAgIH1cbiAgfCB7XG4gICAgICBpZDogc3RyaW5nXG4gICAgICB0eXBlOiAnaW5fcHJvY2Vzc190ZWFtbWF0ZSdcbiAgICAgIGxhYmVsOiBzdHJpbmdcbiAgICAgIHN0YXR1czogc3RyaW5nXG4gICAgICB0YXNrOiBEZWVwSW1tdXRhYmxlPEluUHJvY2Vzc1RlYW1tYXRlVGFza1N0YXRlPlxuICAgIH1cbiAgfCB7XG4gICAgICBpZDogc3RyaW5nXG4gICAgICB0eXBlOiAnbG9jYWxfd29ya2Zsb3cnXG4gICAgICBsYWJlbDogc3RyaW5nXG4gICAgICBzdGF0dXM6IHN0cmluZ1xuICAgICAgdGFzazogRGVlcEltbXV0YWJsZTxMb2NhbFdvcmtmbG93VGFza1N0YXRlPlxuICAgIH1cbiAgfCB7XG4gICAgICBpZDogc3RyaW5nXG4gICAgICB0eXBlOiAnbW9uaXRvcl9tY3AnXG4gICAgICBsYWJlbDogc3RyaW5nXG4gICAgICBzdGF0dXM6IHN0cmluZ1xuICAgICAgdGFzazogRGVlcEltbXV0YWJsZTxNb25pdG9yTWNwVGFza1N0YXRlPlxuICAgIH1cbiAgfCB7XG4gICAgICBpZDogc3RyaW5nXG4gICAgICB0eXBlOiAnZHJlYW0nXG4gICAgICBsYWJlbDogc3RyaW5nXG4gICAgICBzdGF0dXM6IHN0cmluZ1xuICAgICAgdGFzazogRGVlcEltbXV0YWJsZTxEcmVhbVRhc2tTdGF0ZT5cbiAgICB9XG4gIHwge1xuICAgICAgaWQ6IHN0cmluZ1xuICAgICAgdHlwZTogJ2xlYWRlcidcbiAgICAgIGxhYmVsOiBzdHJpbmdcbiAgICAgIHN0YXR1czogJ3J1bm5pbmcnXG4gICAgfVxuXG4vLyBXT1JLRkxPV19TQ1JJUFRTIGlzIGFudC1vbmx5IChidWlsZF9mbGFncy55YW1sKS4gU3RhdGljIGltcG9ydHMgd291bGQgbGVha1xuLy8gfjEuM0sgbGluZXMgaW50byBleHRlcm5hbCBidWlsZHMuIEdhdGUgd2l0aCBmZWF0dXJlKCkgKyByZXF1aXJlIHNvIHRoZVxuLy8gYnVuZGxlciBjYW4gZGVhZC1jb2RlLWVsaW1pbmF0ZSB0aGUgYnJhbmNoLlxuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuY29uc3QgV29ya2Zsb3dEZXRhaWxEaWFsb2cgPSBmZWF0dXJlKCdXT1JLRkxPV19TQ1JJUFRTJylcbiAgPyAoXG4gICAgICByZXF1aXJlKCcuL1dvcmtmbG93RGV0YWlsRGlhbG9nLmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi9Xb3JrZmxvd0RldGFpbERpYWxvZy5qcycpXG4gICAgKS5Xb3JrZmxvd0RldGFpbERpYWxvZ1xuICA6IG51bGxcbmNvbnN0IHdvcmtmbG93VGFza01vZHVsZSA9IGZlYXR1cmUoJ1dPUktGTE9XX1NDUklQVFMnKVxuICA/IChyZXF1aXJlKCdzcmMvdGFza3MvTG9jYWxXb3JrZmxvd1Rhc2svTG9jYWxXb3JrZmxvd1Rhc2suanMnKSBhcyB0eXBlb2YgaW1wb3J0KCdzcmMvdGFza3MvTG9jYWxXb3JrZmxvd1Rhc2svTG9jYWxXb3JrZmxvd1Rhc2suanMnKSlcbiAgOiBudWxsXG5jb25zdCBraWxsV29ya2Zsb3dUYXNrID0gd29ya2Zsb3dUYXNrTW9kdWxlPy5raWxsV29ya2Zsb3dUYXNrID8/IG51bGxcbmNvbnN0IHNraXBXb3JrZmxvd0FnZW50ID0gd29ya2Zsb3dUYXNrTW9kdWxlPy5za2lwV29ya2Zsb3dBZ2VudCA/PyBudWxsXG5jb25zdCByZXRyeVdvcmtmbG93QWdlbnQgPSB3b3JrZmxvd1Rhc2tNb2R1bGU/LnJldHJ5V29ya2Zsb3dBZ2VudCA/PyBudWxsXG4vLyBSZWxhdGl2ZSBwYXRoLCBub3QgYHNyYy8uLi5gIHBhdGgtbWFwcGluZyDigJQgQnVuJ3MgRENFIGNhbiBzdGF0aWNhbGx5XG4vLyByZXNvbHZlICsgZWxpbWluYXRlIGAuL2AgcmVxdWlyZXMsIGJ1dCBwYXRoLW1hcHBlZCBzdHJpbmdzIHN0YXkgb3BhcXVlXG4vLyBhbmQgc3Vydml2ZSBhcyBkZWFkIGxpdGVyYWxzIGluIHRoZSBidW5kbGUuIE1hdGNoZXMgdGFza3MudHMgcGF0dGVybi5cbmNvbnN0IG1vbml0b3JNY3BNb2R1bGUgPSBmZWF0dXJlKCdNT05JVE9SX1RPT0wnKVxuICA/IChyZXF1aXJlKCcuLi8uLi90YXNrcy9Nb25pdG9yTWNwVGFzay9Nb25pdG9yTWNwVGFzay5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4uLy4uL3Rhc2tzL01vbml0b3JNY3BUYXNrL01vbml0b3JNY3BUYXNrLmpzJykpXG4gIDogbnVsbFxuY29uc3Qga2lsbE1vbml0b3JNY3AgPSBtb25pdG9yTWNwTW9kdWxlPy5raWxsTW9uaXRvck1jcCA/PyBudWxsXG5jb25zdCBNb25pdG9yTWNwRGV0YWlsRGlhbG9nID0gZmVhdHVyZSgnTU9OSVRPUl9UT09MJylcbiAgPyAoXG4gICAgICByZXF1aXJlKCcuL01vbml0b3JNY3BEZXRhaWxEaWFsb2cuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuL01vbml0b3JNY3BEZXRhaWxEaWFsb2cuanMnKVxuICAgICkuTW9uaXRvck1jcERldGFpbERpYWxvZ1xuICA6IG51bGxcbi8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuXG4vLyBIZWxwZXIgdG8gZ2V0IGZpbHRlcmVkIGJhY2tncm91bmQgdGFza3MgKGV4Y2x1ZGVzIGZvcmVncm91bmRlZCBsb2NhbF9hZ2VudClcbmZ1bmN0aW9uIGdldFNlbGVjdGFibGVCYWNrZ3JvdW5kVGFza3MoXG4gIHRhc2tzOiBSZWNvcmQ8c3RyaW5nLCBUYXNrU3RhdGU+IHwgdW5kZWZpbmVkLFxuICBmb3JlZ3JvdW5kZWRUYXNrSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCxcbik6IFRhc2tTdGF0ZVtdIHtcbiAgY29uc3QgYmFja2dyb3VuZFRhc2tzID0gT2JqZWN0LnZhbHVlcyh0YXNrcyA/PyB7fSkuZmlsdGVyKGlzQmFja2dyb3VuZFRhc2spXG4gIHJldHVybiBiYWNrZ3JvdW5kVGFza3MuZmlsdGVyKFxuICAgIHRhc2sgPT4gISh0YXNrLnR5cGUgPT09ICdsb2NhbF9hZ2VudCcgJiYgdGFzay5pZCA9PT0gZm9yZWdyb3VuZGVkVGFza0lkKSxcbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gQmFja2dyb3VuZFRhc2tzRGlhbG9nKHtcbiAgb25Eb25lLFxuICB0b29sVXNlQ29udGV4dCxcbiAgaW5pdGlhbERldGFpbFRhc2tJZCxcbn06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgdGFza3MgPSB1c2VBcHBTdGF0ZShzID0+IHMudGFza3MpXG4gIGNvbnN0IGZvcmVncm91bmRlZFRhc2tJZCA9IHVzZUFwcFN0YXRlKHMgPT4gcy5mb3JlZ3JvdW5kZWRUYXNrSWQpXG4gIGNvbnN0IHNob3dTcGlubmVyVHJlZSA9IHVzZUFwcFN0YXRlKHMgPT4gcy5leHBhbmRlZFZpZXcpID09PSAndGVhbW1hdGVzJ1xuICBjb25zdCBzZXRBcHBTdGF0ZSA9IHVzZVNldEFwcFN0YXRlKClcbiAgY29uc3Qga2lsbEFnZW50c1Nob3J0Y3V0ID0gdXNlU2hvcnRjdXREaXNwbGF5KFxuICAgICdjaGF0OmtpbGxBZ2VudHMnLFxuICAgICdDaGF0JyxcbiAgICAnY3RybCt4IGN0cmwraycsXG4gIClcbiAgY29uc3QgdHlwZWRUYXNrcyA9IHRhc2tzIGFzIFJlY29yZDxzdHJpbmcsIFRhc2tTdGF0ZT4gfCB1bmRlZmluZWRcblxuICAvLyBUcmFjayBpZiB3ZSBza2lwcGVkIGxpc3QgdmlldyBvbiBtb3VudCAoZm9yIGJhY2sgYnV0dG9uIGJlaGF2aW9yKVxuICBjb25zdCBza2lwcGVkTGlzdE9uTW91bnQgPSB1c2VSZWYoZmFsc2UpXG5cbiAgLy8gQ29tcHV0ZSBpbml0aWFsIHZpZXcgc3RhdGUgLSBza2lwIGxpc3QgaWYgY2FsbGVyIHByb3ZpZGVkIGEgc3BlY2lmaWMgdGFzayxcbiAgLy8gb3IgaWYgdGhlcmUncyBleGFjdGx5IG9uZSB0YXNrXG4gIGNvbnN0IFt2aWV3U3RhdGUsIHNldFZpZXdTdGF0ZV0gPSB1c2VTdGF0ZTxWaWV3U3RhdGU+KCgpID0+IHtcbiAgICBpZiAoaW5pdGlhbERldGFpbFRhc2tJZCkge1xuICAgICAgc2tpcHBlZExpc3RPbk1vdW50LmN1cnJlbnQgPSB0cnVlXG4gICAgICByZXR1cm4geyBtb2RlOiAnZGV0YWlsJywgaXRlbUlkOiBpbml0aWFsRGV0YWlsVGFza0lkIH1cbiAgICB9XG4gICAgY29uc3QgYWxsSXRlbXMgPSBnZXRTZWxlY3RhYmxlQmFja2dyb3VuZFRhc2tzKFxuICAgICAgdHlwZWRUYXNrcyxcbiAgICAgIGZvcmVncm91bmRlZFRhc2tJZCxcbiAgICApXG4gICAgaWYgKGFsbEl0ZW1zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgc2tpcHBlZExpc3RPbk1vdW50LmN1cnJlbnQgPSB0cnVlXG4gICAgICByZXR1cm4geyBtb2RlOiAnZGV0YWlsJywgaXRlbUlkOiBhbGxJdGVtc1swXSEuaWQgfVxuICAgIH1cbiAgICByZXR1cm4geyBtb2RlOiAnbGlzdCcgfVxuICB9KVxuICBjb25zdCBbc2VsZWN0ZWRJbmRleCwgc2V0U2VsZWN0ZWRJbmRleF0gPSB1c2VTdGF0ZTxudW1iZXI+KDApXG5cbiAgLy8gUmVnaXN0ZXIgYXMgbW9kYWwgb3ZlcmxheSBzbyBwYXJlbnQgQ2hhdCBrZXliaW5kaW5ncyAodXAvZG93biBmb3IgaGlzdG9yeSlcbiAgLy8gYXJlIGRlYWN0aXZhdGVkIHdoaWxlIHRoaXMgZGlhbG9nIGlzIG9wZW5cbiAgdXNlUmVnaXN0ZXJPdmVybGF5KCdiYWNrZ3JvdW5kLXRhc2tzLWRpYWxvZycpXG5cbiAgLy8gTWVtb2l6ZSB0aGUgc29ydGVkIGFuZCBjYXRlZ29yaXplZCBpdGVtcyB0b2dldGhlciB0byBlbnN1cmUgc3RhYmxlIHJlZmVyZW5jZXNcbiAgY29uc3Qge1xuICAgIGJhc2hUYXNrcyxcbiAgICByZW1vdGVTZXNzaW9ucyxcbiAgICBhZ2VudFRhc2tzLFxuICAgIHRlYW1tYXRlVGFza3MsXG4gICAgd29ya2Zsb3dUYXNrcyxcbiAgICBtY3BNb25pdG9ycyxcbiAgICBkcmVhbVRhc2tzLFxuICAgIGFsbFNlbGVjdGFibGVJdGVtcyxcbiAgfSA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIC8vIEZpbHRlciB0byBvbmx5IHNob3cgcnVubmluZy9wZW5kaW5nIGJhY2tncm91bmQgdGFza3MsIG1hdGNoaW5nIHRoZSBzdGF0dXMgYmFyIGNvdW50XG4gICAgY29uc3QgYmFja2dyb3VuZFRhc2tzID0gT2JqZWN0LnZhbHVlcyh0eXBlZFRhc2tzID8/IHt9KS5maWx0ZXIoXG4gICAgICBpc0JhY2tncm91bmRUYXNrLFxuICAgIClcbiAgICBjb25zdCBhbGxJdGVtcyA9IGJhY2tncm91bmRUYXNrcy5tYXAodG9MaXN0SXRlbSlcbiAgICBjb25zdCBzb3J0ZWQgPSBhbGxJdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICBjb25zdCBhU3RhdHVzID0gYS5zdGF0dXNcbiAgICAgIGNvbnN0IGJTdGF0dXMgPSBiLnN0YXR1c1xuICAgICAgaWYgKGFTdGF0dXMgPT09ICdydW5uaW5nJyAmJiBiU3RhdHVzICE9PSAncnVubmluZycpIHJldHVybiAtMVxuICAgICAgaWYgKGFTdGF0dXMgIT09ICdydW5uaW5nJyAmJiBiU3RhdHVzID09PSAncnVubmluZycpIHJldHVybiAxXG4gICAgICBjb25zdCBhVGltZSA9ICd0YXNrJyBpbiBhID8gYS50YXNrLnN0YXJ0VGltZSA6IDBcbiAgICAgIGNvbnN0IGJUaW1lID0gJ3Rhc2snIGluIGIgPyBiLnRhc2suc3RhcnRUaW1lIDogMFxuICAgICAgcmV0dXJuIGJUaW1lIC0gYVRpbWVcbiAgICB9KVxuICAgIGNvbnN0IGJhc2ggPSBzb3J0ZWQuZmlsdGVyKGl0ZW0gPT4gaXRlbS50eXBlID09PSAnbG9jYWxfYmFzaCcpXG4gICAgY29uc3QgcmVtb3RlID0gc29ydGVkLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ3JlbW90ZV9hZ2VudCcpXG4gICAgLy8gRXhjbHVkZSBmb3JlZ3JvdW5kZWQgdGFzayAtIGl0J3MgYmVpbmcgdmlld2VkIGluIHRoZSBtYWluIFVJLCBub3QgYSBiYWNrZ3JvdW5kIHRhc2tcbiAgICBjb25zdCBhZ2VudCA9IHNvcnRlZC5maWx0ZXIoXG4gICAgICBpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2xvY2FsX2FnZW50JyAmJiBpdGVtLmlkICE9PSBmb3JlZ3JvdW5kZWRUYXNrSWQsXG4gICAgKVxuICAgIGNvbnN0IHdvcmtmbG93cyA9IHNvcnRlZC5maWx0ZXIoaXRlbSA9PiBpdGVtLnR5cGUgPT09ICdsb2NhbF93b3JrZmxvdycpXG4gICAgY29uc3QgbW9uaXRvck1jcCA9IHNvcnRlZC5maWx0ZXIoaXRlbSA9PiBpdGVtLnR5cGUgPT09ICdtb25pdG9yX21jcCcpXG4gICAgY29uc3QgZHJlYW1UYXNrcyA9IHNvcnRlZC5maWx0ZXIoaXRlbSA9PiBpdGVtLnR5cGUgPT09ICdkcmVhbScpXG4gICAgLy8gSW4gc3Bpbm5lci10cmVlIG1vZGUsIGV4Y2x1ZGUgdGVhbW1hdGVzIGZyb20gdGhlIGRpYWxvZyAodGhleSBhcHBlYXIgaW4gdGhlIHRyZWUpXG4gICAgY29uc3QgdGVhbW1hdGVzID0gc2hvd1NwaW5uZXJUcmVlXG4gICAgICA/IFtdXG4gICAgICA6IHNvcnRlZC5maWx0ZXIoaXRlbSA9PiBpdGVtLnR5cGUgPT09ICdpbl9wcm9jZXNzX3RlYW1tYXRlJylcbiAgICAvLyBBZGQgbGVhZGVyIGVudHJ5IHdoZW4gdGhlcmUgYXJlIHRlYW1tYXRlcywgc28gdXNlcnMgY2FuIGZvcmVncm91bmQgYmFjayB0byBsZWFkZXJcbiAgICBjb25zdCBsZWFkZXJJdGVtOiBMaXN0SXRlbVtdID1cbiAgICAgIHRlYW1tYXRlcy5sZW5ndGggPiAwXG4gICAgICAgID8gW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBpZDogJ19fbGVhZGVyX18nLFxuICAgICAgICAgICAgICB0eXBlOiAnbGVhZGVyJyxcbiAgICAgICAgICAgICAgbGFiZWw6IGBAJHtURUFNX0xFQURfTkFNRX1gLFxuICAgICAgICAgICAgICBzdGF0dXM6ICdydW5uaW5nJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXVxuICAgICAgICA6IFtdXG4gICAgcmV0dXJuIHtcbiAgICAgIGJhc2hUYXNrczogYmFzaCxcbiAgICAgIHJlbW90ZVNlc3Npb25zOiByZW1vdGUsXG4gICAgICBhZ2VudFRhc2tzOiBhZ2VudCxcbiAgICAgIHdvcmtmbG93VGFza3M6IHdvcmtmbG93cyxcbiAgICAgIG1jcE1vbml0b3JzOiBtb25pdG9yTWNwLFxuICAgICAgZHJlYW1UYXNrcyxcbiAgICAgIHRlYW1tYXRlVGFza3M6IFsuLi5sZWFkZXJJdGVtLCAuLi50ZWFtbWF0ZXNdLFxuICAgICAgLy8gT3JkZXIgTVVTVCBtYXRjaCBKU1ggcmVuZGVyIG9yZGVyICh0ZWFtbWF0ZXMgXFx1MjE5MiBiYXNoIFxcdTIxOTIgbW9uaXRvck1jcCBcXHUyMTkyXG4gICAgICAvLyByZW1vdGUgXFx1MjE5MiBhZ2VudCBcXHUyMTkyIHdvcmtmbG93cyBcXHUyMTkyIGRyZWFtKSBzbyBcXHUyMTkzL1xcdTIxOTEgbmF2aWdhdGlvbiBtb3ZlcyB0aGUgY3Vyc29yXG4gICAgICAvLyB2aXN1YWxseSBkb3dud2FyZC5cbiAgICAgIGFsbFNlbGVjdGFibGVJdGVtczogW1xuICAgICAgICAuLi5sZWFkZXJJdGVtLFxuICAgICAgICAuLi50ZWFtbWF0ZXMsXG4gICAgICAgIC4uLmJhc2gsXG4gICAgICAgIC4uLm1vbml0b3JNY3AsXG4gICAgICAgIC4uLnJlbW90ZSxcbiAgICAgICAgLi4uYWdlbnQsXG4gICAgICAgIC4uLndvcmtmbG93cyxcbiAgICAgICAgLi4uZHJlYW1UYXNrcyxcbiAgICAgIF0sXG4gICAgfVxuICB9LCBbdHlwZWRUYXNrcywgZm9yZWdyb3VuZGVkVGFza0lkLCBzaG93U3Bpbm5lclRyZWVdKVxuXG4gIGNvbnN0IGN1cnJlbnRTZWxlY3Rpb24gPSBhbGxTZWxlY3RhYmxlSXRlbXNbc2VsZWN0ZWRJbmRleF0gPz8gbnVsbFxuXG4gIC8vIFVzZSBjb25maWd1cmFibGUga2V5YmluZGluZ3MgZm9yIHN0YW5kYXJkIG5hdmlnYXRpb24gYW5kIGNvbmZpcm0vY2FuY2VsLlxuICAvLyBjb25maXJtOm5vIGlzIGhhbmRsZWQgYnkgRGlhbG9nJ3Mgb25DYW5jZWwgcHJvcC5cbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ2NvbmZpcm06cHJldmlvdXMnOiAoKSA9PiBzZXRTZWxlY3RlZEluZGV4KHByZXYgPT4gTWF0aC5tYXgoMCwgcHJldiAtIDEpKSxcbiAgICAgICdjb25maXJtOm5leHQnOiAoKSA9PlxuICAgICAgICBzZXRTZWxlY3RlZEluZGV4KHByZXYgPT5cbiAgICAgICAgICBNYXRoLm1pbihhbGxTZWxlY3RhYmxlSXRlbXMubGVuZ3RoIC0gMSwgcHJldiArIDEpLFxuICAgICAgICApLFxuICAgICAgJ2NvbmZpcm06eWVzJzogKCkgPT4ge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gYWxsU2VsZWN0YWJsZUl0ZW1zW3NlbGVjdGVkSW5kZXhdXG4gICAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgICAgaWYgKGN1cnJlbnQudHlwZSA9PT0gJ2xlYWRlcicpIHtcbiAgICAgICAgICAgIGV4aXRUZWFtbWF0ZVZpZXcoc2V0QXBwU3RhdGUpXG4gICAgICAgICAgICBvbkRvbmUoJ1ZpZXdpbmcgbGVhZGVyJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRWaWV3U3RhdGUoeyBtb2RlOiAnZGV0YWlsJywgaXRlbUlkOiBjdXJyZW50LmlkIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0sXG4gICAgeyBjb250ZXh0OiAnQ29uZmlybWF0aW9uJywgaXNBY3RpdmU6IHZpZXdTdGF0ZS5tb2RlID09PSAnbGlzdCcgfSxcbiAgKVxuXG4gIC8vIENvbXBvbmVudC1zcGVjaWZpYyBzaG9ydGN1dHMgKHg9c3RvcCwgZj1mb3JlZ3JvdW5kLCByaWdodD16b29tKSBzaG93biBpbiBVSS5cbiAgLy8gVGhlc2UgYXJlIHRhc2stdHlwZSBhbmQgc3RhdHVzIGRlcGVuZGVudCwgbm90IHN0YW5kYXJkIGRpYWxvZyBrZXliaW5kaW5ncy5cbiAgY29uc3QgaGFuZGxlS2V5RG93biA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgLy8gT25seSBoYW5kbGUgaW5wdXQgd2hlbiBpbiBsaXN0IG1vZGVcbiAgICBpZiAodmlld1N0YXRlLm1vZGUgIT09ICdsaXN0JykgcmV0dXJuXG5cbiAgICBpZiAoZS5rZXkgPT09ICdsZWZ0Jykge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBvbkRvbmUoJ0JhY2tncm91bmQgdGFza3MgZGlhbG9nIGRpc21pc3NlZCcsIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIC8vIENvbXB1dGUgY3VycmVudCBzZWxlY3Rpb24gYXQgdGhlIHRpbWUgb2YgdGhlIGtleSBwcmVzc1xuICAgIGNvbnN0IGN1cnJlbnRTZWxlY3Rpb24gPSBhbGxTZWxlY3RhYmxlSXRlbXNbc2VsZWN0ZWRJbmRleF1cbiAgICBpZiAoIWN1cnJlbnRTZWxlY3Rpb24pIHJldHVybiAvLyBldmVyeXRoaW5nIGJlbG93IHJlcXVpcmVzIGEgc2VsZWN0aW9uXG5cbiAgICBpZiAoZS5rZXkgPT09ICd4Jykge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBpZiAoXG4gICAgICAgIGN1cnJlbnRTZWxlY3Rpb24udHlwZSA9PT0gJ2xvY2FsX2Jhc2gnICYmXG4gICAgICAgIGN1cnJlbnRTZWxlY3Rpb24uc3RhdHVzID09PSAncnVubmluZydcbiAgICAgICkge1xuICAgICAgICB2b2lkIGtpbGxTaGVsbFRhc2soY3VycmVudFNlbGVjdGlvbi5pZClcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGN1cnJlbnRTZWxlY3Rpb24udHlwZSA9PT0gJ2xvY2FsX2FnZW50JyAmJlxuICAgICAgICBjdXJyZW50U2VsZWN0aW9uLnN0YXR1cyA9PT0gJ3J1bm5pbmcnXG4gICAgICApIHtcbiAgICAgICAgdm9pZCBraWxsQWdlbnRUYXNrKGN1cnJlbnRTZWxlY3Rpb24uaWQpXG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBjdXJyZW50U2VsZWN0aW9uLnR5cGUgPT09ICdpbl9wcm9jZXNzX3RlYW1tYXRlJyAmJlxuICAgICAgICBjdXJyZW50U2VsZWN0aW9uLnN0YXR1cyA9PT0gJ3J1bm5pbmcnXG4gICAgICApIHtcbiAgICAgICAgdm9pZCBraWxsVGVhbW1hdGVUYXNrKGN1cnJlbnRTZWxlY3Rpb24uaWQpXG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBjdXJyZW50U2VsZWN0aW9uLnR5cGUgPT09ICdsb2NhbF93b3JrZmxvdycgJiZcbiAgICAgICAgY3VycmVudFNlbGVjdGlvbi5zdGF0dXMgPT09ICdydW5uaW5nJyAmJlxuICAgICAgICBraWxsV29ya2Zsb3dUYXNrXG4gICAgICApIHtcbiAgICAgICAga2lsbFdvcmtmbG93VGFzayhjdXJyZW50U2VsZWN0aW9uLmlkLCBzZXRBcHBTdGF0ZSlcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIGN1cnJlbnRTZWxlY3Rpb24udHlwZSA9PT0gJ21vbml0b3JfbWNwJyAmJlxuICAgICAgICBjdXJyZW50U2VsZWN0aW9uLnN0YXR1cyA9PT0gJ3J1bm5pbmcnICYmXG4gICAgICAgIGtpbGxNb25pdG9yTWNwXG4gICAgICApIHtcbiAgICAgICAga2lsbE1vbml0b3JNY3AoY3VycmVudFNlbGVjdGlvbi5pZCwgc2V0QXBwU3RhdGUpXG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICBjdXJyZW50U2VsZWN0aW9uLnR5cGUgPT09ICdkcmVhbScgJiZcbiAgICAgICAgY3VycmVudFNlbGVjdGlvbi5zdGF0dXMgPT09ICdydW5uaW5nJ1xuICAgICAgKSB7XG4gICAgICAgIHZvaWQga2lsbERyZWFtVGFzayhjdXJyZW50U2VsZWN0aW9uLmlkKVxuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgY3VycmVudFNlbGVjdGlvbi50eXBlID09PSAncmVtb3RlX2FnZW50JyAmJlxuICAgICAgICBjdXJyZW50U2VsZWN0aW9uLnN0YXR1cyA9PT0gJ3J1bm5pbmcnXG4gICAgICApIHtcbiAgICAgICAgaWYgKGN1cnJlbnRTZWxlY3Rpb24udGFzay5pc1VsdHJhcGxhbikge1xuICAgICAgICAgIHZvaWQgc3RvcFVsdHJhcGxhbihcbiAgICAgICAgICAgIGN1cnJlbnRTZWxlY3Rpb24uaWQsXG4gICAgICAgICAgICBjdXJyZW50U2VsZWN0aW9uLnRhc2suc2Vzc2lvbklkLFxuICAgICAgICAgICAgc2V0QXBwU3RhdGUsXG4gICAgICAgICAgKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZvaWQga2lsbFJlbW90ZUFnZW50VGFzayhjdXJyZW50U2VsZWN0aW9uLmlkKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGUua2V5ID09PSAnZicpIHtcbiAgICAgIGlmIChcbiAgICAgICAgY3VycmVudFNlbGVjdGlvbi50eXBlID09PSAnaW5fcHJvY2Vzc190ZWFtbWF0ZScgJiZcbiAgICAgICAgY3VycmVudFNlbGVjdGlvbi5zdGF0dXMgPT09ICdydW5uaW5nJ1xuICAgICAgKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICBlbnRlclRlYW1tYXRlVmlldyhjdXJyZW50U2VsZWN0aW9uLmlkLCBzZXRBcHBTdGF0ZSlcbiAgICAgICAgb25Eb25lKCdWaWV3aW5nIHRlYW1tYXRlJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICAgICAgfSBlbHNlIGlmIChjdXJyZW50U2VsZWN0aW9uLnR5cGUgPT09ICdsZWFkZXInKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICBleGl0VGVhbW1hdGVWaWV3KHNldEFwcFN0YXRlKVxuICAgICAgICBvbkRvbmUoJ1ZpZXdpbmcgbGVhZGVyJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGtpbGxTaGVsbFRhc2sodGFza0lkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBMb2NhbFNoZWxsVGFzay5raWxsKHRhc2tJZCwgc2V0QXBwU3RhdGUpXG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBraWxsQWdlbnRUYXNrKHRhc2tJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgTG9jYWxBZ2VudFRhc2sua2lsbCh0YXNrSWQsIHNldEFwcFN0YXRlKVxuICB9XG5cbiAgYXN5bmMgZnVuY3Rpb24ga2lsbFRlYW1tYXRlVGFzayh0YXNrSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IEluUHJvY2Vzc1RlYW1tYXRlVGFzay5raWxsKHRhc2tJZCwgc2V0QXBwU3RhdGUpXG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBraWxsRHJlYW1UYXNrKHRhc2tJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgRHJlYW1UYXNrLmtpbGwodGFza0lkLCBzZXRBcHBTdGF0ZSlcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGtpbGxSZW1vdGVBZ2VudFRhc2sodGFza0lkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBSZW1vdGVBZ2VudFRhc2sua2lsbCh0YXNrSWQsIHNldEFwcFN0YXRlKVxuICB9XG5cbiAgLy8gV3JhcCBvbkRvbmUgaW4gdXNlRWZmZWN0RXZlbnQgdG8gZ2V0IGEgc3RhYmxlIHJlZmVyZW5jZSB0aGF0IGFsd2F5cyBjYWxsc1xuICAvLyB0aGUgY3VycmVudCBvbkRvbmUgY2FsbGJhY2sgd2l0aG91dCBjYXVzaW5nIHRoZSBlZmZlY3QgdG8gcmUtZmlyZS5cbiAgY29uc3Qgb25Eb25lRXZlbnQgPSB1c2VFZmZlY3RFdmVudChvbkRvbmUpXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAodmlld1N0YXRlLm1vZGUgIT09ICdsaXN0Jykge1xuICAgICAgY29uc3QgdGFzayA9ICh0eXBlZFRhc2tzID8/IHt9KVt2aWV3U3RhdGUuaXRlbUlkXVxuICAgICAgLy8gV29ya2Zsb3cgdGFza3MgZ2V0IGEgZ3JhY2U6IHRoZWlyIGRldGFpbCB2aWV3IHN0YXlzIG9wZW4gdGhyb3VnaFxuICAgICAgLy8gY29tcGxldGlvbiBzbyB0aGUgdXNlciBzZWVzIHRoZSBmaW5hbCBzdGF0ZSBiZWZvcmUgZXZpY3Rpb24uXG4gICAgICBpZiAoXG4gICAgICAgICF0YXNrIHx8XG4gICAgICAgICh0YXNrLnR5cGUgIT09ICdsb2NhbF93b3JrZmxvdycgJiYgIWlzQmFja2dyb3VuZFRhc2sodGFzaykpXG4gICAgICApIHtcbiAgICAgICAgLy8gVGFzayB3YXMgcmVtb3ZlZCBvciBpcyBubyBsb25nZXIgYSBiYWNrZ3JvdW5kIHRhc2sgKGUuZy4ga2lsbGVkKS5cbiAgICAgICAgLy8gSWYgd2Ugc2tpcHBlZCB0aGUgbGlzdCBvbiBtb3VudCwgY2xvc2UgdGhlIGRpYWxvZyBlbnRpcmVseS5cbiAgICAgICAgaWYgKHNraXBwZWRMaXN0T25Nb3VudC5jdXJyZW50KSB7XG4gICAgICAgICAgb25Eb25lRXZlbnQoJ0JhY2tncm91bmQgdGFza3MgZGlhbG9nIGRpc21pc3NlZCcsIHtcbiAgICAgICAgICAgIGRpc3BsYXk6ICdzeXN0ZW0nLFxuICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2V0Vmlld1N0YXRlKHsgbW9kZTogJ2xpc3QnIH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0b3RhbEl0ZW1zID0gYWxsU2VsZWN0YWJsZUl0ZW1zLmxlbmd0aFxuICAgIGlmIChzZWxlY3RlZEluZGV4ID49IHRvdGFsSXRlbXMgJiYgdG90YWxJdGVtcyA+IDApIHtcbiAgICAgIHNldFNlbGVjdGVkSW5kZXgodG90YWxJdGVtcyAtIDEpXG4gICAgfVxuICB9LCBbdmlld1N0YXRlLCB0eXBlZFRhc2tzLCBzZWxlY3RlZEluZGV4LCBhbGxTZWxlY3RhYmxlSXRlbXMsIG9uRG9uZUV2ZW50XSlcblxuICAvLyBIZWxwZXIgdG8gZ28gYmFjayB0byBsaXN0IHZpZXcgKG9yIGNsb3NlIGRpYWxvZyBpZiB3ZSBza2lwcGVkIGxpc3Qgb25cbiAgLy8gbW91bnQgQU5EIHRoZXJlJ3Mgc3RpbGwgb25seSDiiaQxIGl0ZW0pLiBDaGVja2luZyBjdXJyZW50IGNvdW50IHByZXZlbnRzXG4gIC8vIHRoZSBzdGFsZS1zdGF0ZSB0cmFwOiBpZiB5b3Ugb3BlbmVkIHdpdGggMSB0YXNrIChhdXRvLXNraXBwZWQgdG8gZGV0YWlsKSxcbiAgLy8gdGhlbiBhIHNlY29uZCB0YXNrIHN0YXJ0ZWQsICdiYWNrJyBzaG91bGQgc2hvdyB0aGUgbGlzdCDigJQgbm90IGNsb3NlLlxuICBjb25zdCBnb0JhY2tUb0xpc3QgPSAoKSA9PiB7XG4gICAgaWYgKHNraXBwZWRMaXN0T25Nb3VudC5jdXJyZW50ICYmIGFsbFNlbGVjdGFibGVJdGVtcy5sZW5ndGggPD0gMSkge1xuICAgICAgb25Eb25lKCdCYWNrZ3JvdW5kIHRhc2tzIGRpYWxvZyBkaXNtaXNzZWQnLCB7IGRpc3BsYXk6ICdzeXN0ZW0nIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHNraXBwZWRMaXN0T25Nb3VudC5jdXJyZW50ID0gZmFsc2VcbiAgICAgIHNldFZpZXdTdGF0ZSh7IG1vZGU6ICdsaXN0JyB9KVxuICAgIH1cbiAgfVxuXG4gIC8vIElmIGFuIGl0ZW0gaXMgc2VsZWN0ZWQsIHNob3cgdGhlIGFwcHJvcHJpYXRlIHZpZXdcbiAgaWYgKHZpZXdTdGF0ZS5tb2RlICE9PSAnbGlzdCcgJiYgdHlwZWRUYXNrcykge1xuICAgIGNvbnN0IHRhc2sgPSB0eXBlZFRhc2tzW3ZpZXdTdGF0ZS5pdGVtSWRdXG4gICAgaWYgKCF0YXNrKSB7XG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIC8vIERldGFpbCBtb2RlIC0gc2hvdyBhcHByb3ByaWF0ZSBkZXRhaWwgZGlhbG9nXG4gICAgc3dpdGNoICh0YXNrLnR5cGUpIHtcbiAgICAgIGNhc2UgJ2xvY2FsX2Jhc2gnOlxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxTaGVsbERldGFpbERpYWxvZ1xuICAgICAgICAgICAgc2hlbGw9e3Rhc2t9XG4gICAgICAgICAgICBvbkRvbmU9e29uRG9uZX1cbiAgICAgICAgICAgIG9uS2lsbFNoZWxsPXsoKSA9PiB2b2lkIGtpbGxTaGVsbFRhc2sodGFzay5pZCl9XG4gICAgICAgICAgICBvbkJhY2s9e2dvQmFja1RvTGlzdH1cbiAgICAgICAgICAgIGtleT17YHNoZWxsLSR7dGFzay5pZH1gfVxuICAgICAgICAgIC8+XG4gICAgICAgIClcbiAgICAgIGNhc2UgJ2xvY2FsX2FnZW50JzpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8QXN5bmNBZ2VudERldGFpbERpYWxvZ1xuICAgICAgICAgICAgYWdlbnQ9e3Rhc2t9XG4gICAgICAgICAgICBvbkRvbmU9e29uRG9uZX1cbiAgICAgICAgICAgIG9uS2lsbEFnZW50PXsoKSA9PiB2b2lkIGtpbGxBZ2VudFRhc2sodGFzay5pZCl9XG4gICAgICAgICAgICBvbkJhY2s9e2dvQmFja1RvTGlzdH1cbiAgICAgICAgICAgIGtleT17YGFnZW50LSR7dGFzay5pZH1gfVxuICAgICAgICAgIC8+XG4gICAgICAgIClcbiAgICAgIGNhc2UgJ3JlbW90ZV9hZ2VudCc6XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPFJlbW90ZVNlc3Npb25EZXRhaWxEaWFsb2dcbiAgICAgICAgICAgIHNlc3Npb249e3Rhc2t9XG4gICAgICAgICAgICBvbkRvbmU9e29uRG9uZX1cbiAgICAgICAgICAgIHRvb2xVc2VDb250ZXh0PXt0b29sVXNlQ29udGV4dH1cbiAgICAgICAgICAgIG9uQmFjaz17Z29CYWNrVG9MaXN0fVxuICAgICAgICAgICAgb25LaWxsPXtcbiAgICAgICAgICAgICAgdGFzay5zdGF0dXMgIT09ICdydW5uaW5nJ1xuICAgICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgOiB0YXNrLmlzVWx0cmFwbGFuXG4gICAgICAgICAgICAgICAgICA/ICgpID0+XG4gICAgICAgICAgICAgICAgICAgICAgdm9pZCBzdG9wVWx0cmFwbGFuKHRhc2suaWQsIHRhc2suc2Vzc2lvbklkLCBzZXRBcHBTdGF0ZSlcbiAgICAgICAgICAgICAgICAgIDogKCkgPT4gdm9pZCBraWxsUmVtb3RlQWdlbnRUYXNrKHRhc2suaWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBrZXk9e2BzZXNzaW9uLSR7dGFzay5pZH1gfVxuICAgICAgICAgIC8+XG4gICAgICAgIClcbiAgICAgIGNhc2UgJ2luX3Byb2Nlc3NfdGVhbW1hdGUnOlxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxJblByb2Nlc3NUZWFtbWF0ZURldGFpbERpYWxvZ1xuICAgICAgICAgICAgdGVhbW1hdGU9e3Rhc2t9XG4gICAgICAgICAgICBvbkRvbmU9e29uRG9uZX1cbiAgICAgICAgICAgIG9uS2lsbD17XG4gICAgICAgICAgICAgIHRhc2suc3RhdHVzID09PSAncnVubmluZydcbiAgICAgICAgICAgICAgICA/ICgpID0+IHZvaWQga2lsbFRlYW1tYXRlVGFzayh0YXNrLmlkKVxuICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvbkJhY2s9e2dvQmFja1RvTGlzdH1cbiAgICAgICAgICAgIG9uRm9yZWdyb3VuZD17XG4gICAgICAgICAgICAgIHRhc2suc3RhdHVzID09PSAncnVubmluZydcbiAgICAgICAgICAgICAgICA/ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZW50ZXJUZWFtbWF0ZVZpZXcodGFzay5pZCwgc2V0QXBwU3RhdGUpXG4gICAgICAgICAgICAgICAgICAgIG9uRG9uZSgnVmlld2luZyB0ZWFtbWF0ZScsIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAga2V5PXtgdGVhbW1hdGUtJHt0YXNrLmlkfWB9XG4gICAgICAgICAgLz5cbiAgICAgICAgKVxuICAgICAgY2FzZSAnbG9jYWxfd29ya2Zsb3cnOlxuICAgICAgICBpZiAoIVdvcmtmbG93RGV0YWlsRGlhbG9nKSByZXR1cm4gbnVsbFxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxXb3JrZmxvd0RldGFpbERpYWxvZ1xuICAgICAgICAgICAgd29ya2Zsb3c9e3Rhc2t9XG4gICAgICAgICAgICBvbkRvbmU9e29uRG9uZX1cbiAgICAgICAgICAgIG9uS2lsbD17XG4gICAgICAgICAgICAgIHRhc2suc3RhdHVzID09PSAncnVubmluZycgJiYga2lsbFdvcmtmbG93VGFza1xuICAgICAgICAgICAgICAgID8gKCkgPT4ga2lsbFdvcmtmbG93VGFzayh0YXNrLmlkLCBzZXRBcHBTdGF0ZSlcbiAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgb25Ta2lwQWdlbnQ9e1xuICAgICAgICAgICAgICB0YXNrLnN0YXR1cyA9PT0gJ3J1bm5pbmcnICYmIHNraXBXb3JrZmxvd0FnZW50XG4gICAgICAgICAgICAgICAgPyBhZ2VudElkID0+IHNraXBXb3JrZmxvd0FnZW50KHRhc2suaWQsIGFnZW50SWQsIHNldEFwcFN0YXRlKVxuICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvblJldHJ5QWdlbnQ9e1xuICAgICAgICAgICAgICB0YXNrLnN0YXR1cyA9PT0gJ3J1bm5pbmcnICYmIHJldHJ5V29ya2Zsb3dBZ2VudFxuICAgICAgICAgICAgICAgID8gYWdlbnRJZCA9PiByZXRyeVdvcmtmbG93QWdlbnQodGFzay5pZCwgYWdlbnRJZCwgc2V0QXBwU3RhdGUpXG4gICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9uQmFjaz17Z29CYWNrVG9MaXN0fVxuICAgICAgICAgICAga2V5PXtgd29ya2Zsb3ctJHt0YXNrLmlkfWB9XG4gICAgICAgICAgLz5cbiAgICAgICAgKVxuICAgICAgY2FzZSAnbW9uaXRvcl9tY3AnOlxuICAgICAgICBpZiAoIU1vbml0b3JNY3BEZXRhaWxEaWFsb2cpIHJldHVybiBudWxsXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPE1vbml0b3JNY3BEZXRhaWxEaWFsb2dcbiAgICAgICAgICAgIHRhc2s9e3Rhc2t9XG4gICAgICAgICAgICBvbktpbGw9e1xuICAgICAgICAgICAgICB0YXNrLnN0YXR1cyA9PT0gJ3J1bm5pbmcnICYmIGtpbGxNb25pdG9yTWNwXG4gICAgICAgICAgICAgICAgPyAoKSA9PiBraWxsTW9uaXRvck1jcCh0YXNrLmlkLCBzZXRBcHBTdGF0ZSlcbiAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgb25CYWNrPXtnb0JhY2tUb0xpc3R9XG4gICAgICAgICAgICBrZXk9e2Btb25pdG9yLW1jcC0ke3Rhc2suaWR9YH1cbiAgICAgICAgICAvPlxuICAgICAgICApXG4gICAgICBjYXNlICdkcmVhbSc6XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPERyZWFtRGV0YWlsRGlhbG9nXG4gICAgICAgICAgICB0YXNrPXt0YXNrfVxuICAgICAgICAgICAgb25Eb25lPXsoKSA9PlxuICAgICAgICAgICAgICBvbkRvbmUoJ0JhY2tncm91bmQgdGFza3MgZGlhbG9nIGRpc21pc3NlZCcsIHtcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiAnc3lzdGVtJyxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9uQmFjaz17Z29CYWNrVG9MaXN0fVxuICAgICAgICAgICAgb25LaWxsPXtcbiAgICAgICAgICAgICAgdGFzay5zdGF0dXMgPT09ICdydW5uaW5nJ1xuICAgICAgICAgICAgICAgID8gKCkgPT4gdm9pZCBraWxsRHJlYW1UYXNrKHRhc2suaWQpXG4gICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGtleT17YGRyZWFtLSR7dGFzay5pZH1gfVxuICAgICAgICAgIC8+XG4gICAgICAgIClcbiAgICB9XG4gIH1cblxuICBjb25zdCBydW5uaW5nQmFzaENvdW50ID0gY291bnQoYmFzaFRhc2tzLCBfID0+IF8uc3RhdHVzID09PSAncnVubmluZycpXG4gIGNvbnN0IHJ1bm5pbmdBZ2VudENvdW50ID1cbiAgICBjb3VudChcbiAgICAgIHJlbW90ZVNlc3Npb25zLFxuICAgICAgXyA9PiBfLnN0YXR1cyA9PT0gJ3J1bm5pbmcnIHx8IF8uc3RhdHVzID09PSAncGVuZGluZycsXG4gICAgKSArIGNvdW50KGFnZW50VGFza3MsIF8gPT4gXy5zdGF0dXMgPT09ICdydW5uaW5nJylcbiAgY29uc3QgcnVubmluZ1RlYW1tYXRlQ291bnQgPSBjb3VudCh0ZWFtbWF0ZVRhc2tzLCBfID0+IF8uc3RhdHVzID09PSAncnVubmluZycpXG4gIGNvbnN0IHN1YnRpdGxlID0gaW50ZXJzcGVyc2UoXG4gICAgW1xuICAgICAgLi4uKHJ1bm5pbmdUZWFtbWF0ZUNvdW50ID4gMFxuICAgICAgICA/IFtcbiAgICAgICAgICAgIDxUZXh0IGtleT1cInRlYW1tYXRlc1wiPlxuICAgICAgICAgICAgICB7cnVubmluZ1RlYW1tYXRlQ291bnR9eycgJ31cbiAgICAgICAgICAgICAge3J1bm5pbmdUZWFtbWF0ZUNvdW50ICE9PSAxID8gJ2FnZW50cycgOiAnYWdlbnQnfVxuICAgICAgICAgICAgPC9UZXh0PixcbiAgICAgICAgICBdXG4gICAgICAgIDogW10pLFxuICAgICAgLi4uKHJ1bm5pbmdCYXNoQ291bnQgPiAwXG4gICAgICAgID8gW1xuICAgICAgICAgICAgPFRleHQga2V5PVwic2hlbGxzXCI+XG4gICAgICAgICAgICAgIHtydW5uaW5nQmFzaENvdW50fXsnICd9XG4gICAgICAgICAgICAgIHtydW5uaW5nQmFzaENvdW50ICE9PSAxID8gJ2FjdGl2ZSBzaGVsbHMnIDogJ2FjdGl2ZSBzaGVsbCd9XG4gICAgICAgICAgICA8L1RleHQ+LFxuICAgICAgICAgIF1cbiAgICAgICAgOiBbXSksXG4gICAgICAuLi4ocnVubmluZ0FnZW50Q291bnQgPiAwXG4gICAgICAgID8gW1xuICAgICAgICAgICAgPFRleHQga2V5PVwiYWdlbnRzXCI+XG4gICAgICAgICAgICAgIHtydW5uaW5nQWdlbnRDb3VudH17JyAnfVxuICAgICAgICAgICAgICB7cnVubmluZ0FnZW50Q291bnQgIT09IDEgPyAnYWN0aXZlIGFnZW50cycgOiAnYWN0aXZlIGFnZW50J31cbiAgICAgICAgICAgIDwvVGV4dD4sXG4gICAgICAgICAgXVxuICAgICAgICA6IFtdKSxcbiAgICBdLFxuICAgIGluZGV4ID0+IDxUZXh0IGtleT17YHNlcGFyYXRvci0ke2luZGV4fWB9PiDCtyA8L1RleHQ+LFxuICApXG5cbiAgY29uc3QgYWN0aW9ucyA9IFtcbiAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQga2V5PVwidXBEb3duXCIgc2hvcnRjdXQ9XCLihpEv4oaTXCIgYWN0aW9uPVwic2VsZWN0XCIgLz4sXG4gICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IGtleT1cImVudGVyXCIgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cInZpZXdcIiAvPixcbiAgICAuLi4oY3VycmVudFNlbGVjdGlvbj8udHlwZSA9PT0gJ2luX3Byb2Nlc3NfdGVhbW1hdGUnICYmXG4gICAgY3VycmVudFNlbGVjdGlvbi5zdGF0dXMgPT09ICdydW5uaW5nJ1xuICAgICAgPyBbXG4gICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50XG4gICAgICAgICAgICBrZXk9XCJmb3JlZ3JvdW5kXCJcbiAgICAgICAgICAgIHNob3J0Y3V0PVwiZlwiXG4gICAgICAgICAgICBhY3Rpb249XCJmb3JlZ3JvdW5kXCJcbiAgICAgICAgICAvPixcbiAgICAgICAgXVxuICAgICAgOiBbXSksXG4gICAgLi4uKChjdXJyZW50U2VsZWN0aW9uPy50eXBlID09PSAnbG9jYWxfYmFzaCcgfHxcbiAgICAgIGN1cnJlbnRTZWxlY3Rpb24/LnR5cGUgPT09ICdsb2NhbF9hZ2VudCcgfHxcbiAgICAgIGN1cnJlbnRTZWxlY3Rpb24/LnR5cGUgPT09ICdpbl9wcm9jZXNzX3RlYW1tYXRlJyB8fFxuICAgICAgY3VycmVudFNlbGVjdGlvbj8udHlwZSA9PT0gJ2xvY2FsX3dvcmtmbG93JyB8fFxuICAgICAgY3VycmVudFNlbGVjdGlvbj8udHlwZSA9PT0gJ21vbml0b3JfbWNwJyB8fFxuICAgICAgY3VycmVudFNlbGVjdGlvbj8udHlwZSA9PT0gJ2RyZWFtJyB8fFxuICAgICAgY3VycmVudFNlbGVjdGlvbj8udHlwZSA9PT0gJ3JlbW90ZV9hZ2VudCcpICYmXG4gICAgY3VycmVudFNlbGVjdGlvbi5zdGF0dXMgPT09ICdydW5uaW5nJ1xuICAgICAgPyBbPEtleWJvYXJkU2hvcnRjdXRIaW50IGtleT1cImtpbGxcIiBzaG9ydGN1dD1cInhcIiBhY3Rpb249XCJzdG9wXCIgLz5dXG4gICAgICA6IFtdKSxcbiAgICAuLi4oYWdlbnRUYXNrcy5zb21lKHQgPT4gdC5zdGF0dXMgPT09ICdydW5uaW5nJylcbiAgICAgID8gW1xuICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludFxuICAgICAgICAgICAga2V5PVwia2lsbC1hbGxcIlxuICAgICAgICAgICAgc2hvcnRjdXQ9e2tpbGxBZ2VudHNTaG9ydGN1dH1cbiAgICAgICAgICAgIGFjdGlvbj1cInN0b3AgYWxsIGFnZW50c1wiXG4gICAgICAgICAgLz4sXG4gICAgICAgIF1cbiAgICAgIDogW10pLFxuICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBrZXk9XCJlc2NcIiBzaG9ydGN1dD1cIuKGkC9Fc2NcIiBhY3Rpb249XCJjbG9zZVwiIC8+LFxuICBdXG5cbiAgY29uc3QgaGFuZGxlQ2FuY2VsID0gKCkgPT5cbiAgICBvbkRvbmUoJ0JhY2tncm91bmQgdGFza3MgZGlhbG9nIGRpc21pc3NlZCcsIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcblxuICBmdW5jdGlvbiByZW5kZXJJbnB1dEd1aWRlKGV4aXRTdGF0ZTogRXhpdFN0YXRlKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgICBpZiAoZXhpdFN0YXRlLnBlbmRpbmcpIHtcbiAgICAgIHJldHVybiA8VGV4dD5QcmVzcyB7ZXhpdFN0YXRlLmtleU5hbWV9IGFnYWluIHRvIGV4aXQ8L1RleHQ+XG4gICAgfVxuICAgIHJldHVybiA8QnlsaW5lPnthY3Rpb25zfTwvQnlsaW5lPlxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgIHRhYkluZGV4PXswfVxuICAgICAgYXV0b0ZvY3VzXG4gICAgICBvbktleURvd249e2hhbmRsZUtleURvd259XG4gICAgPlxuICAgICAgPERpYWxvZ1xuICAgICAgICB0aXRsZT1cIkJhY2tncm91bmQgdGFza3NcIlxuICAgICAgICBzdWJ0aXRsZT17PD57c3VidGl0bGV9PC8+fVxuICAgICAgICBvbkNhbmNlbD17aGFuZGxlQ2FuY2VsfVxuICAgICAgICBjb2xvcj1cImJhY2tncm91bmRcIlxuICAgICAgICBpbnB1dEd1aWRlPXtyZW5kZXJJbnB1dEd1aWRlfVxuICAgICAgPlxuICAgICAgICB7YWxsU2VsZWN0YWJsZUl0ZW1zLmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5ObyB0YXNrcyBjdXJyZW50bHkgcnVubmluZzwvVGV4dD5cbiAgICAgICAgKSA6IChcbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIHt0ZWFtbWF0ZVRhc2tzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgICAgICB7KGJhc2hUYXNrcy5sZW5ndGggPiAwIHx8XG4gICAgICAgICAgICAgICAgICByZW1vdGVTZXNzaW9ucy5sZW5ndGggPiAwIHx8XG4gICAgICAgICAgICAgICAgICBhZ2VudFRhc2tzLmxlbmd0aCA+IDApICYmIChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAgICA8VGV4dCBib2xkPnsnICAnfUFnZW50czwvVGV4dD4gKFxuICAgICAgICAgICAgICAgICAgICB7Y291bnQodGVhbW1hdGVUYXNrcywgaSA9PiBpLnR5cGUgIT09ICdsZWFkZXInKX0pXG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgICAgICAgIDxUZWFtbWF0ZVRhc2tHcm91cHNcbiAgICAgICAgICAgICAgICAgICAgdGVhbW1hdGVUYXNrcz17dGVhbW1hdGVUYXNrc31cbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFNlbGVjdGlvbklkPXtjdXJyZW50U2VsZWN0aW9uPy5pZH1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAge2Jhc2hUYXNrcy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICAgICAgPEJveFxuICAgICAgICAgICAgICAgIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIlxuICAgICAgICAgICAgICAgIG1hcmdpblRvcD17dGVhbW1hdGVUYXNrcy5sZW5ndGggPiAwID8gMSA6IDB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7KHRlYW1tYXRlVGFza3MubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgICAgICAgcmVtb3RlU2Vzc2lvbnMubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgICAgICAgYWdlbnRUYXNrcy5sZW5ndGggPiAwKSAmJiAoXG4gICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAgPFRleHQgYm9sZD57JyAgJ31TaGVsbHM8L1RleHQ+ICh7YmFzaFRhc2tzLmxlbmd0aH0pXG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgICAgICAgIHtiYXNoVGFza3MubWFwKGl0ZW0gPT4gKFxuICAgICAgICAgICAgICAgICAgICA8SXRlbVxuICAgICAgICAgICAgICAgICAgICAgIGtleT17aXRlbS5pZH1cbiAgICAgICAgICAgICAgICAgICAgICBpdGVtPXtpdGVtfVxuICAgICAgICAgICAgICAgICAgICAgIGlzU2VsZWN0ZWQ9e2l0ZW0uaWQgPT09IGN1cnJlbnRTZWxlY3Rpb24/LmlkfVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAge21jcE1vbml0b3JzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICA8Qm94XG4gICAgICAgICAgICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICAgICAgICAgICAgbWFyZ2luVG9wPXtcbiAgICAgICAgICAgICAgICAgIHRlYW1tYXRlVGFza3MubGVuZ3RoID4gMCB8fCBiYXNoVGFza3MubGVuZ3RoID4gMCA/IDEgOiAwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICA8VGV4dCBib2xkPnsnICAnfU1vbml0b3JzPC9UZXh0PiAoe21jcE1vbml0b3JzLmxlbmd0aH0pXG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgICAgICAge21jcE1vbml0b3JzLm1hcChpdGVtID0+IChcbiAgICAgICAgICAgICAgICAgICAgPEl0ZW1cbiAgICAgICAgICAgICAgICAgICAgICBrZXk9e2l0ZW0uaWR9XG4gICAgICAgICAgICAgICAgICAgICAgaXRlbT17aXRlbX1cbiAgICAgICAgICAgICAgICAgICAgICBpc1NlbGVjdGVkPXtpdGVtLmlkID09PSBjdXJyZW50U2VsZWN0aW9uPy5pZH1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICl9XG5cbiAgICAgICAgICAgIHtyZW1vdGVTZXNzaW9ucy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICAgICAgPEJveFxuICAgICAgICAgICAgICAgIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIlxuICAgICAgICAgICAgICAgIG1hcmdpblRvcD17XG4gICAgICAgICAgICAgICAgICB0ZWFtbWF0ZVRhc2tzLmxlbmd0aCA+IDAgfHxcbiAgICAgICAgICAgICAgICAgIGJhc2hUYXNrcy5sZW5ndGggPiAwIHx8XG4gICAgICAgICAgICAgICAgICBtY3BNb25pdG9ycy5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgID8gMVxuICAgICAgICAgICAgICAgICAgICA6IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgIDxUZXh0IGJvbGQ+eycgICd9UmVtb3RlIGFnZW50czwvVGV4dD4gKHtyZW1vdGVTZXNzaW9ucy5sZW5ndGh9XG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgICAgICAge3JlbW90ZVNlc3Npb25zLm1hcChpdGVtID0+IChcbiAgICAgICAgICAgICAgICAgICAgPEl0ZW1cbiAgICAgICAgICAgICAgICAgICAgICBrZXk9e2l0ZW0uaWR9XG4gICAgICAgICAgICAgICAgICAgICAgaXRlbT17aXRlbX1cbiAgICAgICAgICAgICAgICAgICAgICBpc1NlbGVjdGVkPXtpdGVtLmlkID09PSBjdXJyZW50U2VsZWN0aW9uPy5pZH1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICl9XG5cbiAgICAgICAgICAgIHthZ2VudFRhc2tzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICA8Qm94XG4gICAgICAgICAgICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICAgICAgICAgICAgbWFyZ2luVG9wPXtcbiAgICAgICAgICAgICAgICAgIHRlYW1tYXRlVGFza3MubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgICAgICAgYmFzaFRhc2tzLmxlbmd0aCA+IDAgfHxcbiAgICAgICAgICAgICAgICAgIG1jcE1vbml0b3JzLmxlbmd0aCA+IDAgfHxcbiAgICAgICAgICAgICAgICAgIHJlbW90ZVNlc3Npb25zLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICAgICAgPyAxXG4gICAgICAgICAgICAgICAgICAgIDogMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAgPFRleHQgYm9sZD57JyAgJ31Mb2NhbCBhZ2VudHM8L1RleHQ+ICh7YWdlbnRUYXNrcy5sZW5ndGh9KVxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgICAgICAgIHthZ2VudFRhc2tzLm1hcChpdGVtID0+IChcbiAgICAgICAgICAgICAgICAgICAgPEl0ZW1cbiAgICAgICAgICAgICAgICAgICAgICBrZXk9e2l0ZW0uaWR9XG4gICAgICAgICAgICAgICAgICAgICAgaXRlbT17aXRlbX1cbiAgICAgICAgICAgICAgICAgICAgICBpc1NlbGVjdGVkPXtpdGVtLmlkID09PSBjdXJyZW50U2VsZWN0aW9uPy5pZH1cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICl9XG5cbiAgICAgICAgICAgIHt3b3JrZmxvd1Rhc2tzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICA8Qm94XG4gICAgICAgICAgICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICAgICAgICAgICAgbWFyZ2luVG9wPXtcbiAgICAgICAgICAgICAgICAgIHRlYW1tYXRlVGFza3MubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgICAgICAgYmFzaFRhc2tzLmxlbmd0aCA+IDAgfHxcbiAgICAgICAgICAgICAgICAgIG1jcE1vbml0b3JzLmxlbmd0aCA+IDAgfHxcbiAgICAgICAgICAgICAgICAgIHJlbW90ZVNlc3Npb25zLmxlbmd0aCA+IDAgfHxcbiAgICAgICAgICAgICAgICAgIGFnZW50VGFza3MubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgICAgICA/IDFcbiAgICAgICAgICAgICAgICAgICAgOiAwXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICA8VGV4dCBib2xkPnsnICAnfVdvcmtmbG93czwvVGV4dD4gKHt3b3JrZmxvd1Rhc2tzLmxlbmd0aH0pXG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgICAgICAge3dvcmtmbG93VGFza3MubWFwKGl0ZW0gPT4gKFxuICAgICAgICAgICAgICAgICAgICA8SXRlbVxuICAgICAgICAgICAgICAgICAgICAgIGtleT17aXRlbS5pZH1cbiAgICAgICAgICAgICAgICAgICAgICBpdGVtPXtpdGVtfVxuICAgICAgICAgICAgICAgICAgICAgIGlzU2VsZWN0ZWQ9e2l0ZW0uaWQgPT09IGN1cnJlbnRTZWxlY3Rpb24/LmlkfVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAge2RyZWFtVGFza3MubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICAgIDxCb3hcbiAgICAgICAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICAgICAgICBtYXJnaW5Ub3A9e1xuICAgICAgICAgICAgICAgICAgdGVhbW1hdGVUYXNrcy5sZW5ndGggPiAwIHx8XG4gICAgICAgICAgICAgICAgICBiYXNoVGFza3MubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgICAgICAgbWNwTW9uaXRvcnMubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgICAgICAgcmVtb3RlU2Vzc2lvbnMubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgICAgICAgYWdlbnRUYXNrcy5sZW5ndGggPiAwIHx8XG4gICAgICAgICAgICAgICAgICB3b3JrZmxvd1Rhc2tzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICAgICAgPyAxXG4gICAgICAgICAgICAgICAgICAgIDogMFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgICAgICAge2RyZWFtVGFza3MubWFwKGl0ZW0gPT4gKFxuICAgICAgICAgICAgICAgICAgICA8SXRlbVxuICAgICAgICAgICAgICAgICAgICAgIGtleT17aXRlbS5pZH1cbiAgICAgICAgICAgICAgICAgICAgICBpdGVtPXtpdGVtfVxuICAgICAgICAgICAgICAgICAgICAgIGlzU2VsZWN0ZWQ9e2l0ZW0uaWQgPT09IGN1cnJlbnRTZWxlY3Rpb24/LmlkfVxuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgIDwvRGlhbG9nPlxuICAgIDwvQm94PlxuICApXG59XG5cbmZ1bmN0aW9uIHRvTGlzdEl0ZW0odGFzazogQmFja2dyb3VuZFRhc2tTdGF0ZSk6IExpc3RJdGVtIHtcbiAgc3dpdGNoICh0YXNrLnR5cGUpIHtcbiAgICBjYXNlICdsb2NhbF9iYXNoJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlkOiB0YXNrLmlkLFxuICAgICAgICB0eXBlOiAnbG9jYWxfYmFzaCcsXG4gICAgICAgIGxhYmVsOiB0YXNrLmtpbmQgPT09ICdtb25pdG9yJyA/IHRhc2suZGVzY3JpcHRpb24gOiB0YXNrLmNvbW1hbmQsXG4gICAgICAgIHN0YXR1czogdGFzay5zdGF0dXMsXG4gICAgICAgIHRhc2ssXG4gICAgICB9XG4gICAgY2FzZSAncmVtb3RlX2FnZW50JzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlkOiB0YXNrLmlkLFxuICAgICAgICB0eXBlOiAncmVtb3RlX2FnZW50JyxcbiAgICAgICAgbGFiZWw6IHRhc2sudGl0bGUsXG4gICAgICAgIHN0YXR1czogdGFzay5zdGF0dXMsXG4gICAgICAgIHRhc2ssXG4gICAgICB9XG4gICAgY2FzZSAnbG9jYWxfYWdlbnQnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IHRhc2suaWQsXG4gICAgICAgIHR5cGU6ICdsb2NhbF9hZ2VudCcsXG4gICAgICAgIGxhYmVsOiB0YXNrLmRlc2NyaXB0aW9uLFxuICAgICAgICBzdGF0dXM6IHRhc2suc3RhdHVzLFxuICAgICAgICB0YXNrLFxuICAgICAgfVxuICAgIGNhc2UgJ2luX3Byb2Nlc3NfdGVhbW1hdGUnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IHRhc2suaWQsXG4gICAgICAgIHR5cGU6ICdpbl9wcm9jZXNzX3RlYW1tYXRlJyxcbiAgICAgICAgbGFiZWw6IGBAJHt0YXNrLmlkZW50aXR5LmFnZW50TmFtZX1gLFxuICAgICAgICBzdGF0dXM6IHRhc2suc3RhdHVzLFxuICAgICAgICB0YXNrLFxuICAgICAgfVxuICAgIGNhc2UgJ2xvY2FsX3dvcmtmbG93JzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlkOiB0YXNrLmlkLFxuICAgICAgICB0eXBlOiAnbG9jYWxfd29ya2Zsb3cnLFxuICAgICAgICBsYWJlbDogdGFzay5zdW1tYXJ5ID8/IHRhc2suZGVzY3JpcHRpb24sXG4gICAgICAgIHN0YXR1czogdGFzay5zdGF0dXMsXG4gICAgICAgIHRhc2ssXG4gICAgICB9XG4gICAgY2FzZSAnbW9uaXRvcl9tY3AnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IHRhc2suaWQsXG4gICAgICAgIHR5cGU6ICdtb25pdG9yX21jcCcsXG4gICAgICAgIGxhYmVsOiB0YXNrLmRlc2NyaXB0aW9uLFxuICAgICAgICBzdGF0dXM6IHRhc2suc3RhdHVzLFxuICAgICAgICB0YXNrLFxuICAgICAgfVxuICAgIGNhc2UgJ2RyZWFtJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGlkOiB0YXNrLmlkLFxuICAgICAgICB0eXBlOiAnZHJlYW0nLFxuICAgICAgICBsYWJlbDogdGFzay5kZXNjcmlwdGlvbixcbiAgICAgICAgc3RhdHVzOiB0YXNrLnN0YXR1cyxcbiAgICAgICAgdGFzayxcbiAgICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBJdGVtKHtcbiAgaXRlbSxcbiAgaXNTZWxlY3RlZCxcbn06IHtcbiAgaXRlbTogTGlzdEl0ZW1cbiAgaXNTZWxlY3RlZDogYm9vbGVhblxufSk6IFJlYWN0Tm9kZSB7XG4gIGNvbnN0IHsgY29sdW1ucyB9ID0gdXNlVGVybWluYWxTaXplKClcbiAgLy8gRGlhbG9nIGJvcmRlciAoMikgKyBwYWRkaW5nICgyKSArIHBvaW50ZXIgcHJlZml4ICgyKSArIG5hbWUvc3RhdHVzIG92ZXJoZWFkICh+MjApXG4gIGNvbnN0IG1heEFjdGl2aXR5V2lkdGggPSBNYXRoLm1heCgzMCwgY29sdW1ucyAtIDI2KVxuICAvLyBJbiBjb29yZGluYXRvciBtb2RlLCB1c2UgZ3JleSBwb2ludGVyIGluc3RlYWQgb2YgYmx1ZVxuICBjb25zdCB1c2VHcmV5UG9pbnRlciA9IGlzQ29vcmRpbmF0b3JNb2RlKClcblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cInJvd1wiPlxuICAgICAgPFRleHQgZGltQ29sb3I9e3VzZUdyZXlQb2ludGVyICYmIGlzU2VsZWN0ZWR9PlxuICAgICAgICB7aXNTZWxlY3RlZCA/IGZpZ3VyZXMucG9pbnRlciArICcgJyA6ICcgICd9XG4gICAgICA8L1RleHQ+XG4gICAgICA8VGV4dCBjb2xvcj17aXNTZWxlY3RlZCAmJiAhdXNlR3JleVBvaW50ZXIgPyAnc3VnZ2VzdGlvbicgOiB1bmRlZmluZWR9PlxuICAgICAgICB7aXRlbS50eXBlID09PSAnbGVhZGVyJyA/IChcbiAgICAgICAgICA8VGV4dD5Ae1RFQU1fTEVBRF9OQU1FfTwvVGV4dD5cbiAgICAgICAgKSA6IChcbiAgICAgICAgICA8QmFja2dyb3VuZFRhc2tDb21wb25lbnRcbiAgICAgICAgICAgIHRhc2s9e2l0ZW0udGFza31cbiAgICAgICAgICAgIG1heEFjdGl2aXR5V2lkdGg9e21heEFjdGl2aXR5V2lkdGh9XG4gICAgICAgICAgLz5cbiAgICAgICAgKX1cbiAgICAgIDwvVGV4dD5cbiAgICA8L0JveD5cbiAgKVxufVxuXG5mdW5jdGlvbiBUZWFtbWF0ZVRhc2tHcm91cHMoe1xuICB0ZWFtbWF0ZVRhc2tzLFxuICBjdXJyZW50U2VsZWN0aW9uSWQsXG59OiB7XG4gIHRlYW1tYXRlVGFza3M6IExpc3RJdGVtW11cbiAgY3VycmVudFNlbGVjdGlvbklkOiBzdHJpbmcgfCB1bmRlZmluZWRcbn0pOiBSZWFjdE5vZGUge1xuICAvLyBTZXBhcmF0ZSBsZWFkZXIgZnJvbSB0ZWFtbWF0ZXMsIGdyb3VwIHRlYW1tYXRlcyBieSB0ZWFtXG4gIGNvbnN0IGxlYWRlckl0ZW1zID0gdGVhbW1hdGVUYXNrcy5maWx0ZXIoaSA9PiBpLnR5cGUgPT09ICdsZWFkZXInKVxuICBjb25zdCB0ZWFtbWF0ZUl0ZW1zID0gdGVhbW1hdGVUYXNrcy5maWx0ZXIoXG4gICAgaSA9PiBpLnR5cGUgPT09ICdpbl9wcm9jZXNzX3RlYW1tYXRlJyxcbiAgKVxuICBjb25zdCB0ZWFtcyA9IG5ldyBNYXA8c3RyaW5nLCB0eXBlb2YgdGVhbW1hdGVJdGVtcz4oKVxuICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGVhbW1hdGVJdGVtcykge1xuICAgIGNvbnN0IHRlYW1OYW1lID0gaXRlbS50YXNrLmlkZW50aXR5LnRlYW1OYW1lXG4gICAgY29uc3QgZ3JvdXAgPSB0ZWFtcy5nZXQodGVhbU5hbWUpXG4gICAgaWYgKGdyb3VwKSB7XG4gICAgICBncm91cC5wdXNoKGl0ZW0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHRlYW1zLnNldCh0ZWFtTmFtZSwgW2l0ZW1dKVxuICAgIH1cbiAgfVxuICBjb25zdCB0ZWFtRW50cmllcyA9IFsuLi50ZWFtcy5lbnRyaWVzKCldXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIHt0ZWFtRW50cmllcy5tYXAoKFt0ZWFtTmFtZSwgaXRlbXNdKSA9PiB7XG4gICAgICAgIGNvbnN0IG1lbWJlckNvdW50ID0gaXRlbXMubGVuZ3RoICsgbGVhZGVySXRlbXMubGVuZ3RoXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPEJveCBrZXk9e3RlYW1OYW1lfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgeycgICd9VGVhbToge3RlYW1OYW1lfSAoe21lbWJlckNvdW50fSlcbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIHsvKiBSZW5kZXIgbGVhZGVyIGZpcnN0IHdpdGhpbiBlYWNoIHRlYW0gKi99XG4gICAgICAgICAgICB7bGVhZGVySXRlbXMubWFwKGl0ZW0gPT4gKFxuICAgICAgICAgICAgICA8SXRlbVxuICAgICAgICAgICAgICAgIGtleT17YCR7aXRlbS5pZH0tJHt0ZWFtTmFtZX1gfVxuICAgICAgICAgICAgICAgIGl0ZW09e2l0ZW19XG4gICAgICAgICAgICAgICAgaXNTZWxlY3RlZD17aXRlbS5pZCA9PT0gY3VycmVudFNlbGVjdGlvbklkfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICB7aXRlbXMubWFwKGl0ZW0gPT4gKFxuICAgICAgICAgICAgICA8SXRlbVxuICAgICAgICAgICAgICAgIGtleT17aXRlbS5pZH1cbiAgICAgICAgICAgICAgICBpdGVtPXtpdGVtfVxuICAgICAgICAgICAgICAgIGlzU2VsZWN0ZWQ9e2l0ZW0uaWQgPT09IGN1cnJlbnRTZWxlY3Rpb25JZH1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApXG4gICAgICB9KX1cbiAgICA8Lz5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsU0FBU0EsT0FBTyxRQUFRLFlBQVk7QUFDcEMsT0FBT0MsT0FBTyxNQUFNLFNBQVM7QUFDN0IsT0FBT0MsS0FBSyxJQUNWLEtBQUtDLFNBQVMsRUFDZEMsU0FBUyxFQUNUQyxjQUFjLEVBQ2RDLE9BQU8sRUFDUEMsTUFBTSxFQUNOQyxRQUFRLFFBQ0gsT0FBTztBQUNkLFNBQVNDLGlCQUFpQixRQUFRLG9DQUFvQztBQUN0RSxTQUFTQyxlQUFlLFFBQVEsOEJBQThCO0FBQzlELFNBQVNDLFdBQVcsRUFBRUMsY0FBYyxRQUFRLHVCQUF1QjtBQUNuRSxTQUNFQyxpQkFBaUIsRUFDakJDLGdCQUFnQixRQUNYLGtDQUFrQztBQUN6QyxjQUFjQyxjQUFjLFFBQVEsYUFBYTtBQUNqRCxTQUNFQyxTQUFTLEVBQ1QsS0FBS0MsY0FBYyxRQUNkLGtDQUFrQztBQUN6QyxTQUFTQyxxQkFBcUIsUUFBUSwwREFBMEQ7QUFDaEcsY0FBY0MsMEJBQTBCLFFBQVEsMENBQTBDO0FBQzFGLGNBQWNDLG1CQUFtQixRQUFRLDRDQUE0QztBQUNyRixTQUFTQyxjQUFjLFFBQVEsNENBQTRDO0FBQzNFLGNBQWNDLG1CQUFtQixRQUFRLG9DQUFvQztBQUM3RSxTQUFTQyxjQUFjLFFBQVEsNENBQTRDO0FBQzNFO0FBQ0EsY0FBY0Msc0JBQXNC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