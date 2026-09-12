import { c as _c } from "react/compiler-runtime";
// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { Box, Text } from '../ink.js';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { computeGlimmerIndex, computeShimmerSegments, SHIMMER_INTERVAL_MS } from '../bridge/bridgeStatusUtil.js';
import { feature } from 'bun:bundle';
import { getKairosActive, getUserMsgOptIn } from '../bootstrap/state.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js';
import { isEnvTruthy } from '../utils/envUtils.js';
import { count } from '../utils/array.js';
import sample from 'lodash-es/sample.js';
import { formatDuration, formatNumber, formatSecondsShort } from '../utils/format.js';
import type { Theme } from 'src/utils/theme.js';
import { activityManager } from '../utils/activityManager.js';
import { getSpinnerVerbs } from '../constants/spinnerVerbs.js';
import { MessageResponse } from './MessageResponse.js';
import { TaskListV2 } from './TaskListV2.js';
import { useTasksV2 } from '../hooks/useTasksV2.js';
import type { Task } from '../utils/tasks.js';
import { useAppState } from '../state/AppState.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { stringWidth } from '../ink/stringWidth.js';
import { getDefaultCharacters, type SpinnerMode } from './Spinner/index.js';
import { SpinnerAnimationRow } from './Spinner/SpinnerAnimationRow.js';
import { useSettings } from '../hooks/useSettings.js';
import { isInProcessTeammateTask } from '../tasks/InProcessTeammateTask/types.js';
import { isBackgroundTask } from '../tasks/types.js';
import { getAllInProcessTeammateTasks } from '../tasks/InProcessTeammateTask/InProcessTeammateTask.js';
import { getEffortSuffix } from '../utils/effort.js';
import { getMainLoopModel } from '../utils/model/model.js';
import { getViewedTeammateTask } from '../state/selectors.js';
import { TEARDROP_ASTERISK } from '../constants/figures.js';
import figures from 'figures';
import { getCurrentTurnTokenBudget, getTurnOutputTokens } from '../bootstrap/state.js';
import { TeammateSpinnerTree } from './Spinner/TeammateSpinnerTree.js';
import { useAnimationFrame } from '../ink.js';
import { getGlobalConfig } from '../utils/config.js';
export type { SpinnerMode } from './Spinner/index.js';
const DEFAULT_CHARACTERS = getDefaultCharacters();
const SPINNER_FRAMES = [...DEFAULT_CHARACTERS, ...[...DEFAULT_CHARACTERS].reverse()];
type Props = {
  mode: SpinnerMode;
  loadingStartTimeRef: React.RefObject<number>;
  totalPausedMsRef: React.RefObject<number>;
  pauseStartTimeRef: React.RefObject<number | null>;
  spinnerTip?: string;
  responseLengthRef: React.RefObject<number>;
  overrideColor?: keyof Theme | null;
  overrideShimmerColor?: keyof Theme | null;
  overrideMessage?: string | null;
  spinnerSuffix?: string | null;
  verbose: boolean;
  hasActiveTools?: boolean;
  /** Leader's turn has completed (no active query). Used to suppress stall-red spinner when only teammates are running. */
  leaderIsIdle?: boolean;
};

// Thin wrapper: branches on isBriefOnly so the two variants have independent
// hook call chains. Without this split, toggling /brief mid-render would
// violate Rules of Hooks (the inner variant calls ~10 more hooks).
export function SpinnerWithVerb(props: Props): React.ReactNode {
  const isBriefOnly = useAppState(s => s.isBriefOnly);
  // REPL overrides isBriefOnly→false when viewing a teammate transcript
  // (see isBriefOnly={viewedTeammateTask ? false : isBriefOnly}). That
  // prop isn't threaded here, so replicate the gate from the store —
  // teammate view needs the real spinner (which shows teammate status).
  const viewingAgentTaskId = useAppState(s_0 => s_0.viewingAgentTaskId);
  // Hoisted to mount-time — this component re-renders at animation framerate.
  const briefEnvEnabled = feature('KAIROS') || feature('KAIROS_BRIEF') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useMemo(() => isEnvTruthy(process.env.CLAUDE_CODE_BRIEF), []) : false;

  // Runtime gate mirrors isBriefEnabled() but inlined — importing from
  // BriefTool.ts would leak tool-name strings into external builds. Single
  // spinner instance → hooks stay unconditional (two subs, negligible).
  if ((feature('KAIROS') || feature('KAIROS_BRIEF')) && (getKairosActive() || getUserMsgOptIn() && (briefEnvEnabled || getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_brief', false))) && isBriefOnly && !viewingAgentTaskId) {
    return <BriefSpinner mode={props.mode} overrideMessage={props.overrideMessage} />;
  }
  return <SpinnerWithVerbInner {...props} />;
}
function SpinnerWithVerbInner({
  mode,
  loadingStartTimeRef,
  totalPausedMsRef,
  pauseStartTimeRef,
  spinnerTip,
  responseLengthRef,
  overrideColor,
  overrideShimmerColor,
  overrideMessage,
  spinnerSuffix,
  verbose,
  hasActiveTools = false,
  leaderIsIdle = false
}: Props): React.ReactNode {
  const settings = useSettings();
  const reducedMotion = settings.prefersReducedMotion ?? false;

  // NOTE: useAnimationFrame(50) lives in SpinnerAnimationRow, not here.
  // This component only re-renders when props or app state change —
  // it is no longer on the 50ms clock. All `time`-derived values
  // (frame, glimmer, stalled intensity, token counter, thinking shimmer,
  // elapsed-time timer) are computed inside the child.

  const tasks = useAppState(s => s.tasks);
  const viewingAgentTaskId = useAppState(s_0 => s_0.viewingAgentTaskId);
  const expandedView = useAppState(s_1 => s_1.expandedView);
  const showExpandedTodos = expandedView === 'tasks';
  const showSpinnerTree = expandedView === 'teammates';
  const selectedIPAgentIndex = useAppState(s_2 => s_2.selectedIPAgentIndex);
  const viewSelectionMode = useAppState(s_3 => s_3.viewSelectionMode);
  // Get foregrounded teammate (if viewing a teammate's transcript)
  const foregroundedTeammate = viewingAgentTaskId ? getViewedTeammateTask({
    viewingAgentTaskId,
    tasks
  }) : undefined;
  const {
    columns
  } = useTerminalSize();
  const tasksV2 = useTasksV2();

  // Track thinking status: 'thinking' | number (duration in ms) | null
  // Shows each state for minimum 2s to avoid UI jank
  const [thinkingStatus, setThinkingStatus] = useState<'thinking' | number | null>(null);
  const thinkingStartRef = useRef<number | null>(null);
  useEffect(() => {
    let showDurationTimer: ReturnType<typeof setTimeout> | null = null;
    let clearStatusTimer: ReturnType<typeof setTimeout> | null = null;
    if (mode === 'thinking') {
      // Started thinking
      if (thinkingStartRef.current === null) {
        thinkingStartRef.current = Date.now();
        setThinkingStatus('thinking');
      }
    } else if (thinkingStartRef.current !== null) {
      // Stopped thinking - calculate duration and ensure 2s minimum display
      const duration = Date.now() - thinkingStartRef.current;
      const elapsed = Date.now() - thinkingStartRef.current;
      const remainingThinkingTime = Math.max(0, 2000 - elapsed);
      thinkingStartRef.current = null;

      // Show "thinking..." for remaining time if < 2s elapsed, then show duration
      const showDuration = (): void => {
        setThinkingStatus(duration);
        // Clear after 2s
        clearStatusTimer = setTimeout(setThinkingStatus, 2000, null);
      };
      if (remainingThinkingTime > 0) {
        showDurationTimer = setTimeout(showDuration, remainingThinkingTime);
      } else {
        showDuration();
      }
    }
    return () => {
      if (showDurationTimer) clearTimeout(showDurationTimer);
      if (clearStatusTimer) clearTimeout(clearStatusTimer);
    };
  }, [mode]);

  // Find the current in-progress task and next pending task
  const currentTodo = tasksV2?.find(task => task.status !== 'pending' && task.status !== 'completed');
  const nextTask = findNextPendingTask(tasksV2);

  // Use useState with initializer to pick a random verb once on mount
  const [randomVerb] = useState(() => sample(getSpinnerVerbs()));

  // Leader's own verb (always the leader's, regardless of who is foregrounded)
  const leaderVerb = overrideMessage ?? currentTodo?.activeForm ?? currentTodo?.subject ?? randomVerb;
  const effectiveVerb = foregroundedTeammate && !foregroundedTeammate.isIdle ? foregroundedTeammate.spinnerVerb ?? randomVerb : leaderVerb;
  const message = effectiveVerb + '…';

  // Track CLI activity when spinner is active
  useEffect(() => {
    const operationId = 'spinner-' + mode;
    activityManager.startCLIActivity(operationId);
    return () => {
      activityManager.endCLIActivity(operationId);
    };
  }, [mode]);
  const effortValue = useAppState(s_4 => s_4.effortValue);
  const effortSuffix = getEffortSuffix(getMainLoopModel(), effortValue);

  // Check if any running in-process teammates exist (needed for both modes)
  const runningTeammates = getAllInProcessTeammateTasks(tasks).filter(t => t.status === 'running');
  const hasRunningTeammates = runningTeammates.length > 0;
  const allIdle = hasRunningTeammates && runningTeammates.every(t_0 => t_0.isIdle);

  // Gather aggregate token stats from all running swarm teammates
  // In spinner-tree mode, skip aggregation (teammates have their own lines in the tree)
  let teammateTokens = 0;
  if (!showSpinnerTree) {
    for (const task_0 of Object.values(tasks)) {
      if (isInProcessTeammateTask(task_0) && task_0.status === 'running') {
        if (task_0.progress?.tokenCount) {
          teammateTokens += task_0.progress.tokenCount;
        }
      }
    }
  }

  // Stale read of the refs for showBtwTip below — we're off the 50ms clock
  // so this only updates when props/app state change, which is sufficient for
  // a coarse 30s threshold.
  const elapsedSnapshot = pauseStartTimeRef.current !== null ? pauseStartTimeRef.current - loadingStartTimeRef.current - totalPausedMsRef.current : Date.now() - loadingStartTimeRef.current - totalPausedMsRef.current;

  // Leader token count for TeammateSpinnerTree — read raw (non-animated) from
  // the ref. The tree is only shown when teammates are running; teammate
  // progress updates to s.tasks trigger re-renders that keep this fresh.
  const leaderTokenCount = Math.round(responseLengthRef.current / 4);
  const defaultColor: keyof Theme = 'claude';
  const defaultShimmerColor = 'claudeShimmer';
  const messageColor = overrideColor ?? defaultColor;
  const shimmerColor = overrideShimmerColor ?? defaultShimmerColor;

  // Compute TTFT string here (off the 50ms animation clock) and pass to
  // SpinnerAnimationRow so it folds into the `(thought for Ns · ...)` status
  // line instead of taking a separate row. apiMetricsRef is a ref so this
  // doesn't trigger re-renders; we pick up updates on the parent's ~25x/turn
  // re-render cadence, same as the old ApiMetricsLine did.
  let ttftText: string | null = null;
  if ("external" === 'ant' && apiMetricsRef?.current && apiMetricsRef.current.length > 0) {
    ttftText = computeTtftText(apiMetricsRef.current);
  }

  // When leader is idle but teammates are running (and we're viewing the leader),
  // show a static dim idle display instead of the animated spinner — otherwise
  // useStalledAnimation detects no new tokens after 3s and turns the spinner red.
  if (leaderIsIdle && hasRunningTeammates && !foregroundedTeammate) {
    return <Box flexDirection="column" width="100%" alignItems="flex-start">
        <Box flexDirection="row" flexWrap="wrap" marginTop={1} width="100%">
          <Text dimColor>
            {TEARDROP_ASTERISK} Idle
            {!allIdle && ' · teammates running'}
          </Text>
        </Box>
        {showSpinnerTree && <TeammateSpinnerTree selectedIndex={selectedIPAgentIndex} isInSelectionMode={viewSelectionMode === 'selecting-agent'} allIdle={allIdle} leaderTokenCount={leaderTokenCount} leaderIdleText="Idle" />}
      </Box>;
  }

  // When viewing an idle teammate, show static idle display instead of animated spinner
  if (foregroundedTeammate?.isIdle) {
    const idleText = allIdle ? `${TEARDROP_ASTERISK} Worked for ${formatDuration(Date.now() - foregroundedTeammate.startTime)}` : `${TEARDROP_ASTERISK} Idle`;
    return <Box flexDirection="column" width="100%" alignItems="flex-start">
        <Box flexDirection="row" flexWrap="wrap" marginTop={1} width="100%">
          <Text dimColor>{idleText}</Text>
        </Box>
        {showSpinnerTree && hasRunningTeammates && <TeammateSpinnerTree selectedIndex={selectedIPAgentIndex} isInSelectionMode={viewSelectionMode === 'selecting-agent'} allIdle={allIdle} leaderVerb={leaderIsIdle ? undefined : leaderVerb} leaderIdleText={leaderIsIdle ? 'Idle' : undefined} leaderTokenCount={leaderTokenCount} />}
      </Box>;
  }

  // Time-based tip overrides: coarse thresholds so a stale ref read (we're
  // off the 50ms clock) is fine. Other triggers (mode change, setMessages)
  // cause re-renders that refresh this in practice.
  let contextTipsActive = false;
  const tipsEnabled = settings.spinnerTipsEnabled !== false;
  const showClearTip = tipsEnabled && elapsedSnapshot > 1_800_000;
  const showBtwTip = tipsEnabled && elapsedSnapshot > 30_000 && !getGlobalConfig().btwUseCount;
  const effectiveTip = contextTipsActive ? undefined : showClearTip && !nextTask ? 'Use /clear to start fresh when switching topics and free up context' : showBtwTip && !nextTask ? "Use /btw to ask a quick side question without interrupting Claude's current work" : spinnerTip;

  // Budget text (ant-only) — shown above the tip line
  let budgetText: string | null = null;
  if (feature('TOKEN_BUDGET')) {
    const budget = getCurrentTurnTokenBudget();
    if (budget !== null && budget > 0) {
      const tokens = getTurnOutputTokens();
      if (tokens >= budget) {
        budgetText = `Target: ${formatNumber(tokens)} used (${formatNumber(budget)} min ${figures.tick})`;
      } else {
        const pct = Math.round(tokens / budget * 100);
        const remaining = budget - tokens;
        const rate = elapsedSnapshot > 5000 && tokens >= 2000 ? tokens / elapsedSnapshot : 0;
        const eta = rate > 0 ? ` \u00B7 ~${formatDuration(remaining / rate, {
          mostSignificantOnly: true
        })}` : '';
        budgetText = `Target: ${formatNumber(tokens)} / ${formatNumber(budget)} (${pct}%)${eta}`;
      }
    }
  }
  return <Box flexDirection="column" width="100%" alignItems="flex-start">
      <SpinnerAnimationRow mode={mode} reducedMotion={reducedMotion} hasActiveTools={hasActiveTools} responseLengthRef={responseLengthRef} message={message} messageColor={messageColor} shimmerColor={shimmerColor} overrideColor={overrideColor} loadingStartTimeRef={loadingStartTimeRef} totalPausedMsRef={totalPausedMsRef} pauseStartTimeRef={pauseStartTimeRef} spinnerSuffix={spinnerSuffix} verbose={verbose} columns={columns} hasRunningTeammates={hasRunningTeammates} teammateTokens={teammateTokens} foregroundedTeammate={foregroundedTeammate} leaderIsIdle={leaderIsIdle} thinkingStatus={thinkingStatus} effortSuffix={effortSuffix} />
      {showSpinnerTree && hasRunningTeammates ? <TeammateSpinnerTree selectedIndex={selectedIPAgentIndex} isInSelectionMode={viewSelectionMode === 'selecting-agent'} allIdle={allIdle} leaderVerb={leaderIsIdle ? undefined : leaderVerb} leaderIdleText={leaderIsIdle ? 'Idle' : undefined} leaderTokenCount={leaderTokenCount} /> : showExpandedTodos && tasksV2 && tasksV2.length > 0 ? <Box width="100%" flexDirection="column">
          <MessageResponse>
            <TaskListV2 tasks={tasksV2} />
          </MessageResponse>
        </Box> : nextTask || effectiveTip || budgetText ?
    // IMPORTANT: we need this width="100%" to avoid an Ink bug where the
    // tip gets duplicated over and over while the spinner is running if
    // the terminal is very small. TODO: fix this in Ink.
    <Box width="100%" flexDirection="column">
          {budgetText && <MessageResponse>
              <Text dimColor>{budgetText}</Text>
            </MessageResponse>}
          {(nextTask || effectiveTip) && <MessageResponse>
              <Text dimColor>
                {nextTask ? `Next: ${nextTask.subject}` : `Tip: ${effectiveTip}`}
              </Text>
            </MessageResponse>}
        </Box> : null}
    </Box>;
}

// Brief/assistant mode spinner: single status line. PromptInput drops its
// own marginTop when isBriefOnly is active, so this component owns the
// 2-row footprint between messages and input. Footprint is [blank, content]
// — one blank row above (breathing room under the messages list), spinner
// flush against the input bar. PromptInput's absolute-positioned
// Notifications overlay compensates with marginTop=-2 in brief mode
// (PromptInput.tsx:~2928) so it floats into the blank row above the
// spinner, not over the spinner content. Paired with BriefIdleStatus which
// keeps the same footprint when idle.
type BriefSpinnerProps = {
  mode: SpinnerMode;
  overrideMessage?: string | null;
};
function BriefSpinner(t0) {
  const $ = _c(31);
  const {
    mode,
    overrideMessage
  } = t0;
  const settings = useSettings();
  const reducedMotion = settings.prefersReducedMotion ?? false;
  const [randomVerb] = useState(_temp4);
  const verb = overrideMessage ?? randomVerb;
  const connStatus = useAppState(_temp5);
  let t1;
  let t2;
  if ($[0] !== mode) {
    t1 = () => {
      const operationId = "spinner-" + mode;
      activityManager.startCLIActivity(operationId);
      return () => {
        activityManager.endCLIActivity(operationId);
      };
    };
    t2 = [mode];
    $[0] = mode;
    $[1] = t1;
    $[2] = t2;
  } else {
    t1 = $[1];
    t2 = $[2];
  }
  useEffect(t1, t2);
  const [, time] = useAnimationFrame(reducedMotion ? null : 120);
  const runningCount = useAppState(_temp6);
  const showConnWarning = connStatus === "reconnecting" || connStatus === "disconnected";
  const connText = connStatus === "reconnecting" ? "Reconnecting" : "Disconnected";
  const dotFrame = Math.floor(time / 300) % 3;
  let t3;
  if ($[3] !== dotFrame || $[4] !== reducedMotion) {
    t3 = reducedMotion ? "\u2026  " : ".".repeat(dotFrame + 1).padEnd(3);
    $[3] = dotFrame;
    $[4] = reducedMotion;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  const dots = t3;
  let t4;
  if ($[6] !== verb) {
    t4 = stringWidth(verb);
    $[6] = verb;
    $[7] = t4;
  } else {
    t4 = $[7];
  }
  const verbWidth = t4;
  let t5;
  if ($[8] !== reducedMotion || $[9] !== showConnWarning || $[10] !== time || $[11] !== verb || $[12] !== verbWidth) {
    const glimmerIndex = reducedMotion || showConnWarning ? -100 : computeGlimmerIndex(Math.floor(time / SHIMMER_INTERVAL_MS), verbWidth);
    t5 = computeShimmerSegments(verb, glimmerIndex);
    $[8] = reducedMotion;
    $[9] = showConnWarning;
    $[10] = time;
    $[11] = verb;
    $[12] = verbWidth;
    $[13] = t5;
  } else {
    t5 = $[13];
  }
  const {
    before,
    shimmer,
    after
  } = t5;
  const {
    columns
  } = useTerminalSize();
  const rightText = runningCount > 0 ? `${runningCount} in background` : "";
  let t6;
  if ($[14] !== connText || $[15] !== showConnWarning || $[16] !== verbWidth) {
    t6 = showConnWarning ? stringWidth(connText) : verbWidth;
    $[14] = connText;
    $[15] = showConnWarning;
    $[16] = verbWidth;
    $[17] = t6;
  } else {
    t6 = $[17];
  }
  const leftWidth = t6 + 3;
  const pad = Math.max(1, columns - 2 - leftWidth - stringWidth(rightText));
  let t7;
  if ($[18] !== after || $[19] !== before || $[20] !== connText || $[21] !== dots || $[22] !== shimmer || $[23] !== showConnWarning) {
    t7 = showConnWarning ? <Text color="error">{connText + dots}</Text> : <>{before ? <Text dimColor={true}>{before}</Text> : null}{shimmer ? <Text>{shimmer}</Text> : null}{after ? <Text dimColor={true}>{after}</Text> : null}<Text dimColor={true}>{dots}</Text></>;
    $[18] = after;
    $[19] = before;
    $[20] = connText;
    $[21] = dots;
    $[22] = shimmer;
    $[23] = showConnWarning;
    $[24] = t7;
  } else {
    t7 = $[24];
  }
  let t8;
  if ($[25] !== pad || $[26] !== rightText) {
    t8 = rightText ? <><Text>{" ".repeat(pad)}</Text><Text color="subtle">{rightText}</Text></> : null;
    $[25] = pad;
    $[26] = rightText;
    $[27] = t8;
  } else {
    t8 = $[27];
  }
  let t9;
  if ($[28] !== t7 || $[29] !== t8) {
    t9 = <Box flexDirection="row" width="100%" marginTop={1} paddingLeft={2}>{t7}{t8}</Box>;
    $[28] = t7;
    $[29] = t8;
    $[30] = t9;
  } else {
    t9 = $[30];
  }
  return t9;
}

// Idle placeholder for brief mode. Same 2-row [blank, content] footprint
// as BriefSpinner so the input bar never jumps when toggling between
// working/idle/disconnected. See BriefSpinner's comment for the
// Notifications overlay coupling.
function _temp6(s_0) {
  return count(Object.values(s_0.tasks), isBackgroundTask) + s_0.remoteBackgroundTaskCount;
}
function _temp5(s) {
  return s.remoteConnectionStatus;
}
function _temp4() {
  return sample(getSpinnerVerbs()) ?? "Working";
}
export function BriefIdleStatus() {
  const $ = _c(9);
  const connStatus = useAppState(_temp7);
  const runningCount = useAppState(_temp8);
  const {
    columns
  } = useTerminalSize();
  const showConnWarning = connStatus === "reconnecting" || connStatus === "disconnected";
  const connText = connStatus === "reconnecting" ? "Reconnecting\u2026" : "Disconnected";
  const leftText = showConnWarning ? connText : "";
  const rightText = runningCount > 0 ? `${runningCount} in background` : "";
  if (!leftText && !rightText) {
    let t0;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
      t0 = <Box height={2} />;
      $[0] = t0;
    } else {
      t0 = $[0];
    }
    return t0;
  }
  const pad = Math.max(1, columns - 2 - stringWidth(leftText) - stringWidth(rightText));
  let t0;
  if ($[1] !== leftText) {
    t0 = leftText ? <Text color="error">{leftText}</Text> : null;
    $[1] = leftText;
    $[2] = t0;
  } else {
    t0 = $[2];
  }
  let t1;
  if ($[3] !== pad || $[4] !== rightText) {
    t1 = rightText ? <><Text>{" ".repeat(pad)}</Text><Text color="subtle">{rightText}</Text></> : null;
    $[3] = pad;
    $[4] = rightText;
    $[5] = t1;
  } else {
    t1 = $[5];
  }
  let t2;
  if ($[6] !== t0 || $[7] !== t1) {
    t2 = <Box marginTop={1} paddingLeft={2}><Text>{t0}{t1}</Text></Box>;
    $[6] = t0;
    $[7] = t1;
    $[8] = t2;
  } else {
    t2 = $[8];
  }
  return t2;
}
function _temp8(s_0) {
  return count(Object.values(s_0.tasks), isBackgroundTask) + s_0.remoteBackgroundTaskCount;
}
function _temp7(s) {
  return s.remoteConnectionStatus;
}
export function Spinner() {
  const $ = _c(8);
  const settings = useSettings();
  const reducedMotion = settings.prefersReducedMotion ?? false;
  const [ref, time] = useAnimationFrame(reducedMotion ? null : 120);
  if (reducedMotion) {
    let t0;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
      t0 = <Text color="text">●</Text>;
      $[0] = t0;
    } else {
      t0 = $[0];
    }
    let t1;
    if ($[1] !== ref) {
      t1 = <Box ref={ref} flexWrap="wrap" height={1} width={2}>{t0}</Box>;
      $[1] = ref;
      $[2] = t1;
    } else {
      t1 = $[2];
    }
    return t1;
  }
  const frame = Math.floor(time / 120) % SPINNER_FRAMES.length;
  const t0 = SPINNER_FRAMES[frame];
  let t1;
  if ($[3] !== t0) {
    t1 = <Text color="text">{t0}</Text>;
    $[3] = t0;
    $[4] = t1;
  } else {
    t1 = $[4];
  }
  let t2;
  if ($[5] !== ref || $[6] !== t1) {
    t2 = <Box ref={ref} flexWrap="wrap" height={1} width={2}>{t1}</Box>;
    $[5] = ref;
    $[6] = t1;
    $[7] = t2;
  } else {
    t2 = $[7];
  }
  return t2;
}
function findNextPendingTask(tasks: Task[] | undefined): Task | undefined {
  if (!tasks) {
    return undefined;
  }
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  if (pendingTasks.length === 0) {
    return undefined;
  }
  const unresolvedIds = new Set(tasks.filter(t => t.status !== 'completed').map(t => t.id));
  return pendingTasks.find(t => !t.blockedBy.some(id => unresolvedIds.has(id))) ?? pendingTasks[0];
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJCb3giLCJUZXh0IiwiUmVhY3QiLCJ1c2VFZmZlY3QiLCJ1c2VNZW1vIiwidXNlUmVmIiwidXNlU3RhdGUiLCJjb21wdXRlR2xpbW1lckluZGV4IiwiY29tcHV0ZVNoaW1tZXJTZWdtZW50cyIsIlNISU1NRVJfSU5URVJWQUxfTVMiLCJmZWF0dXJlIiwiZ2V0S2Fpcm9zQWN0aXZlIiwiZ2V0VXNlck1zZ09wdEluIiwiZ2V0RmVhdHVyZVZhbHVlX0NBQ0hFRF9NQVlfQkVfU1RBTEUiLCJpc0VudlRydXRoeSIsImNvdW50Iiwic2FtcGxlIiwiZm9ybWF0RHVyYXRpb24iLCJmb3JtYXROdW1iZXIiLCJmb3JtYXRTZWNvbmRzU2hvcnQiLCJUaGVtZSIsImFjdGl2aXR5TWFuYWdlciIsImdldFNwaW5uZXJWZXJicyIsIk1lc3NhZ2VSZXNwb25zZSIsIlRhc2tMaXN0VjIiLCJ1c2VUYXNrc1YyIiwiVGFzayIsInVzZUFwcFN0YXRlIiwidXNlVGVybWluYWxTaXplIiwic3RyaW5nV2lkdGgiLCJnZXREZWZhdWx0Q2hhcmFjdGVycyIsIlNwaW5uZXJNb2RlIiwiU3Bpbm5lckFuaW1hdGlvblJvdyIsInVzZVNldHRpbmdzIiwiaXNJblByb2Nlc3NUZWFtbWF0ZVRhc2siLCJpc0JhY2tncm91bmRUYXNrIiwiZ2V0QWxsSW5Qcm9jZXNzVGVhbW1hdGVUYXNrcyIsImdldEVmZm9ydFN1ZmZpeCIsImdldE1haW5Mb29wTW9kZWwiLCJnZXRWaWV3ZWRUZWFtbWF0ZVRhc2siLCJURUFSRFJPUF9BU1RFUklTSyIsImZpZ3VyZXMiLCJnZXRDdXJyZW50VHVyblRva2VuQnVkZ2V0IiwiZ2V0VHVybk91dHB1dFRva2VucyIsIlRlYW1tYXRlU3Bpbm5lclRyZWUiLCJ1c2VBbmltYXRpb25GcmFtZSIsImdldEdsb2JhbENvbmZpZyIsIkRFRkFVTFRfQ0hBUkFDVEVSUyIsIlNQSU5ORVJfRlJBTUVTIiwicmV2ZXJzZSIsIlByb3BzIiwibW9kZSIsImxvYWRpbmdTdGFydFRpbWVSZWYiLCJSZWZPYmplY3QiLCJ0b3RhbFBhdXNlZE1zUmVmIiwicGF1c2VTdGFydFRpbWVSZWYiLCJzcGlubmVyVGlwIiwicmVzcG9uc2VMZW5ndGhSZWYiLCJvdmVycmlkZUNvbG9yIiwib3ZlcnJpZGVTaGltbWVyQ29sb3IiLCJvdmVycmlkZU1lc3NhZ2UiLCJzcGlubmVyU3VmZml4IiwidmVyYm9zZSIsImhhc0FjdGl2ZVRvb2xzIiwibGVhZGVySXNJZGxlIiwiU3Bpbm5lcldpdGhWZXJiIiwicHJvcHMiLCJSZWFjdE5vZGUiLCJpc0JyaWVmT25seSIsInMiLCJ2aWV3aW5nQWdlbnRUYXNrSWQiLCJicmllZkVudkVuYWJsZWQiLCJwcm9jZXNzIiwiZW52IiwiQ0xBVURFX0NPREVfQlJJRUYiLCJTcGlubmVyV2l0aFZlcmJJbm5lciIsInNldHRpbmdzIiwicmVkdWNlZE1vdGlvbiIsInByZWZlcnNSZWR1Y2VkTW90aW9uIiwidGFza3MiLCJleHBhbmRlZFZpZXciLCJzaG93RXhwYW5kZWRUb2RvcyIsInNob3dTcGlubmVyVHJlZSIsInNlbGVjdGVkSVBBZ2VudEluZGV4Iiwidmlld1NlbGVjdGlvbk1vZGUiLCJmb3JlZ3JvdW5kZWRUZWFtbWF0ZSIsInVuZGVmaW5lZCIsImNvbHVtbnMiLCJ0YXNrc1YyIiwidGhpbmtpbmdTdGF0dXMiLCJzZXRUaGlua2luZ1N0YXR1cyIsInRoaW5raW5nU3RhcnRSZWYiLCJzaG93RHVyYXRpb25UaW1lciIsIlJldHVyblR5cGUiLCJzZXRUaW1lb3V0IiwiY2xlYXJTdGF0dXNUaW1lciIsImN1cnJlbnQiLCJEYXRlIiwibm93IiwiZHVyYXRpb24iLCJlbGFwc2VkIiwicmVtYWluaW5nVGhpbmtpbmdUaW1lIiwiTWF0aCIsIm1heCIsInNob3dEdXJhdGlvbiIsImNsZWFyVGltZW91dCIsImN1cnJlbnRUb2RvIiwiZmluZCIsInRhc2siLCJzdGF0dXMiLCJuZXh0VGFzayIsImZpbmROZXh0UGVuZGluZ1Rhc2siLCJyYW5kb21WZXJiIiwibGVhZGVyVmVyYiIsImFjdGl2ZUZvcm0iLCJzdWJqZWN0IiwiZWZmZWN0aXZlVmVyYiIsImlzSWRsZSIsInNwaW5uZXJWZXJiIiwibWVzc2FnZSIsIm9wZXJhdGlvbklkIiwic3RhcnRDTElBY3Rpdml0eSIsImVuZENMSUFjdGl2aXR5IiwiZWZmb3J0VmFsdWUiLCJlZmZvcnRTdWZmaXgiLCJydW5uaW5nVGVhbW1hdGVzIiwiZmlsdGVyIiwidCIsImhhc1J1bm5pbmdUZWFtbWF0ZXMiLCJsZW5ndGgiLCJhbGxJZGxlIiwiZXZlcnkiLCJ0ZWFtbWF0ZVRva2VucyIsIk9iamVjdCIsInZhbHVlcyIsInByb2dyZXNzIiwidG9rZW5Db3VudCIsImVsYXBzZWRTbmFwc2hvdCIsImxlYWRlclRva2VuQ291bnQiLCJyb3VuZCIsImRlZmF1bHRDb2xvciIsImRlZmF1bHRTaGltbWVyQ29sb3IiLCJtZXNzYWdlQ29sb3IiLCJzaGltbWVyQ29sb3IiLCJ0dGZ0VGV4dCIsImFwaU1ldHJpY3NSZWYiLCJjb21wdXRlVHRmdFRleHQiLCJpZGxlVGV4dCIsInN0YXJ0VGltZSIsImNvbnRleHRUaXBzQWN0aXZlIiwidGlwc0VuYWJsZWQiLCJzcGlubmVyVGlwc0VuYWJsZWQiLCJzaG93Q2xlYXJUaXAiLCJzaG93QnR3VGlwIiwiYnR3VXNlQ291bnQiLCJlZmZlY3RpdmVUaXAiLCJidWRnZXRUZXh0IiwiYnVkZ2V0IiwidG9rZW5zIiwidGljayIsInBjdCIsInJlbWFpbmluZyIsInJhdGUiLCJldGEiLCJtb3N0U2lnbmlmaWNhbnRPbmx5IiwiQnJpZWZTcGlubmVyUHJvcHMiLCJCcmllZlNwaW5uZXIiLCJ0MCIsIiQiLCJfYyIsIl90ZW1wNCIsInZlcmIiLCJjb25uU3RhdHVzIiwiX3RlbXA1IiwidDEiLCJ0MiIsInRpbWUiLCJydW5uaW5nQ291bnQiLCJfdGVtcDYiLCJzaG93Q29ubldhcm5pbmciLCJjb25uVGV4dCIsImRvdEZyYW1lIiwiZmxvb3IiLCJ0MyIsInJlcGVhdCIsInBhZEVuZCIsImRvdHMiLCJ0NCIsInZlcmJXaWR0aCIsInQ1IiwiZ2xpbW1lckluZGV4IiwiYmVmb3JlIiwic2hpbW1lciIsImFmdGVyIiwicmlnaHRUZXh0IiwidDYiLCJsZWZ0V2lkdGgiLCJwYWQiLCJ0NyIsInQ4IiwidDkiLCJzXzAiLCJyZW1vdGVCYWNrZ3JvdW5kVGFza0NvdW50IiwicmVtb3RlQ29ubmVjdGlvblN0YXR1cyIsIkJyaWVmSWRsZVN0YXR1cyIsIl90ZW1wNyIsIl90ZW1wOCIsImxlZnRUZXh0IiwiU3ltYm9sIiwiZm9yIiwiU3Bpbm5lciIsInJlZiIsImZyYW1lIiwicGVuZGluZ1Rhc2tzIiwidW5yZXNvbHZlZElkcyIsIlNldCIsIm1hcCIsImlkIiwiYmxvY2tlZEJ5Iiwic29tZSIsImhhcyJdLCJzb3VyY2VzIjpbIlNwaW5uZXIudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8vIGJpb21lLWlnbm9yZS1hbGwgYXNzaXN0L3NvdXJjZS9vcmdhbml6ZUltcG9ydHM6IEFOVC1PTkxZIGltcG9ydCBtYXJrZXJzIG11c3Qgbm90IGJlIHJlb3JkZXJlZFxuaW1wb3J0IHsgQm94LCBUZXh0IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZU1lbW8sIHVzZVJlZiwgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7XG4gIGNvbXB1dGVHbGltbWVySW5kZXgsXG4gIGNvbXB1dGVTaGltbWVyU2VnbWVudHMsXG4gIFNISU1NRVJfSU5URVJWQUxfTVMsXG59IGZyb20gJy4uL2JyaWRnZS9icmlkZ2VTdGF0dXNVdGlsLmpzJ1xuaW1wb3J0IHsgZmVhdHVyZSB9IGZyb20gJ2J1bjpidW5kbGUnXG5pbXBvcnQgeyBnZXRLYWlyb3NBY3RpdmUsIGdldFVzZXJNc2dPcHRJbiB9IGZyb20gJy4uL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB7IGdldEZlYXR1cmVWYWx1ZV9DQUNIRURfTUFZX0JFX1NUQUxFIH0gZnJvbSAnLi4vc2VydmljZXMvYW5hbHl0aWNzL2dyb3d0aGJvb2suanMnXG5pbXBvcnQgeyBpc0VudlRydXRoeSB9IGZyb20gJy4uL3V0aWxzL2VudlV0aWxzLmpzJ1xuaW1wb3J0IHsgY291bnQgfSBmcm9tICcuLi91dGlscy9hcnJheS5qcydcbmltcG9ydCBzYW1wbGUgZnJvbSAnbG9kYXNoLWVzL3NhbXBsZS5qcydcbmltcG9ydCB7XG4gIGZvcm1hdER1cmF0aW9uLFxuICBmb3JtYXROdW1iZXIsXG4gIGZvcm1hdFNlY29uZHNTaG9ydCxcbn0gZnJvbSAnLi4vdXRpbHMvZm9ybWF0LmpzJ1xuaW1wb3J0IHR5cGUgeyBUaGVtZSB9IGZyb20gJ3NyYy91dGlscy90aGVtZS5qcydcbmltcG9ydCB7IGFjdGl2aXR5TWFuYWdlciB9IGZyb20gJy4uL3V0aWxzL2FjdGl2aXR5TWFuYWdlci5qcydcbmltcG9ydCB7IGdldFNwaW5uZXJWZXJicyB9IGZyb20gJy4uL2NvbnN0YW50cy9zcGlubmVyVmVyYnMuanMnXG5pbXBvcnQgeyBNZXNzYWdlUmVzcG9uc2UgfSBmcm9tICcuL01lc3NhZ2VSZXNwb25zZS5qcydcbmltcG9ydCB7IFRhc2tMaXN0VjIgfSBmcm9tICcuL1Rhc2tMaXN0VjIuanMnXG5pbXBvcnQgeyB1c2VUYXNrc1YyIH0gZnJvbSAnLi4vaG9va3MvdXNlVGFza3NWMi5qcydcbmltcG9ydCB0eXBlIHsgVGFzayB9IGZyb20gJy4uL3V0aWxzL3Rhc2tzLmpzJ1xuaW1wb3J0IHsgdXNlQXBwU3RhdGUgfSBmcm9tICcuLi9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB7IHVzZVRlcm1pbmFsU2l6ZSB9IGZyb20gJy4uL2hvb2tzL3VzZVRlcm1pbmFsU2l6ZS5qcydcbmltcG9ydCB7IHN0cmluZ1dpZHRoIH0gZnJvbSAnLi4vaW5rL3N0cmluZ1dpZHRoLmpzJ1xuaW1wb3J0IHsgZ2V0RGVmYXVsdENoYXJhY3RlcnMsIHR5cGUgU3Bpbm5lck1vZGUgfSBmcm9tICcuL1NwaW5uZXIvaW5kZXguanMnXG5pbXBvcnQgeyBTcGlubmVyQW5pbWF0aW9uUm93IH0gZnJvbSAnLi9TcGlubmVyL1NwaW5uZXJBbmltYXRpb25Sb3cuanMnXG5pbXBvcnQgeyB1c2VTZXR0aW5ncyB9IGZyb20gJy4uL2hvb2tzL3VzZVNldHRpbmdzLmpzJ1xuaW1wb3J0IHsgaXNJblByb2Nlc3NUZWFtbWF0ZVRhc2sgfSBmcm9tICcuLi90YXNrcy9JblByb2Nlc3NUZWFtbWF0ZVRhc2svdHlwZXMuanMnXG5pbXBvcnQgeyBpc0JhY2tncm91bmRUYXNrIH0gZnJvbSAnLi4vdGFza3MvdHlwZXMuanMnXG5pbXBvcnQgeyBnZXRBbGxJblByb2Nlc3NUZWFtbWF0ZVRhc2tzIH0gZnJvbSAnLi4vdGFza3MvSW5Qcm9jZXNzVGVhbW1hdGVUYXNrL0luUHJvY2Vzc1RlYW1tYXRlVGFzay5qcydcbmltcG9ydCB7IGdldEVmZm9ydFN1ZmZpeCB9IGZyb20gJy4uL3V0aWxzL2VmZm9ydC5qcydcbmltcG9ydCB7IGdldE1haW5Mb29wTW9kZWwgfSBmcm9tICcuLi91dGlscy9tb2RlbC9tb2RlbC5qcydcbmltcG9ydCB7IGdldFZpZXdlZFRlYW1tYXRlVGFzayB9IGZyb20gJy4uL3N0YXRlL3NlbGVjdG9ycy5qcydcbmltcG9ydCB7IFRFQVJEUk9QX0FTVEVSSVNLIH0gZnJvbSAnLi4vY29uc3RhbnRzL2ZpZ3VyZXMuanMnXG5pbXBvcnQgZmlndXJlcyBmcm9tICdmaWd1cmVzJ1xuaW1wb3J0IHtcbiAgZ2V0Q3VycmVudFR1cm5Ub2tlbkJ1ZGdldCxcbiAgZ2V0VHVybk91dHB1dFRva2Vucyxcbn0gZnJvbSAnLi4vYm9vdHN0cmFwL3N0YXRlLmpzJ1xuXG5pbXBvcnQgeyBUZWFtbWF0ZVNwaW5uZXJUcmVlIH0gZnJvbSAnLi9TcGlubmVyL1RlYW1tYXRlU3Bpbm5lclRyZWUuanMnXG5pbXBvcnQgeyB1c2VBbmltYXRpb25GcmFtZSB9IGZyb20gJy4uL2luay5qcydcbmltcG9ydCB7IGdldEdsb2JhbENvbmZpZyB9IGZyb20gJy4uL3V0aWxzL2NvbmZpZy5qcydcbmV4cG9ydCB0eXBlIHsgU3Bpbm5lck1vZGUgfSBmcm9tICcuL1NwaW5uZXIvaW5kZXguanMnXG5cbmNvbnN0IERFRkFVTFRfQ0hBUkFDVEVSUyA9IGdldERlZmF1bHRDaGFyYWN0ZXJzKClcblxuY29uc3QgU1BJTk5FUl9GUkFNRVMgPSBbXG4gIC4uLkRFRkFVTFRfQ0hBUkFDVEVSUyxcbiAgLi4uWy4uLkRFRkFVTFRfQ0hBUkFDVEVSU10ucmV2ZXJzZSgpLFxuXVxuXG5cbnR5cGUgUHJvcHMgPSB7XG4gIG1vZGU6IFNwaW5uZXJNb2RlXG4gIGxvYWRpbmdTdGFydFRpbWVSZWY6IFJlYWN0LlJlZk9iamVjdDxudW1iZXI+XG4gIHRvdGFsUGF1c2VkTXNSZWY6IFJlYWN0LlJlZk9iamVjdDxudW1iZXI+XG4gIHBhdXNlU3RhcnRUaW1lUmVmOiBSZWFjdC5SZWZPYmplY3Q8bnVtYmVyIHwgbnVsbD5cbiAgc3Bpbm5lclRpcD86IHN0cmluZ1xuICByZXNwb25zZUxlbmd0aFJlZjogUmVhY3QuUmVmT2JqZWN0PG51bWJlcj5cbiAgb3ZlcnJpZGVDb2xvcj86IGtleW9mIFRoZW1lIHwgbnVsbFxuICBvdmVycmlkZVNoaW1tZXJDb2xvcj86IGtleW9mIFRoZW1lIHwgbnVsbFxuICBvdmVycmlkZU1lc3NhZ2U/OiBzdHJpbmcgfCBudWxsXG4gIHNwaW5uZXJTdWZmaXg/OiBzdHJpbmcgfCBudWxsXG4gIHZlcmJvc2U6IGJvb2xlYW5cbiAgaGFzQWN0aXZlVG9vbHM/OiBib29sZWFuXG4gIC8qKiBMZWFkZXIncyB0dXJuIGhhcyBjb21wbGV0ZWQgKG5vIGFjdGl2ZSBxdWVyeSkuIFVzZWQgdG8gc3VwcHJlc3Mgc3RhbGwtcmVkIHNwaW5uZXIgd2hlbiBvbmx5IHRlYW1tYXRlcyBhcmUgcnVubmluZy4gKi9cbiAgbGVhZGVySXNJZGxlPzogYm9vbGVhblxufVxuXG4vLyBUaGluIHdyYXBwZXI6IGJyYW5jaGVzIG9uIGlzQnJpZWZPbmx5IHNvIHRoZSB0d28gdmFyaWFudHMgaGF2ZSBpbmRlcGVuZGVudFxuLy8gaG9vayBjYWxsIGNoYWlucy4gV2l0aG91dCB0aGlzIHNwbGl0LCB0b2dnbGluZyAvYnJpZWYgbWlkLXJlbmRlciB3b3VsZFxuLy8gdmlvbGF0ZSBSdWxlcyBvZiBIb29rcyAodGhlIGlubmVyIHZhcmlhbnQgY2FsbHMgfjEwIG1vcmUgaG9va3MpLlxuZXhwb3J0IGZ1bmN0aW9uIFNwaW5uZXJXaXRoVmVyYihwcm9wczogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBpc0JyaWVmT25seSA9IHVzZUFwcFN0YXRlKHMgPT4gcy5pc0JyaWVmT25seSlcbiAgLy8gUkVQTCBvdmVycmlkZXMgaXNCcmllZk9ubHnihpJmYWxzZSB3aGVuIHZpZXdpbmcgYSB0ZWFtbWF0ZSB0cmFuc2NyaXB0XG4gIC8vIChzZWUgaXNCcmllZk9ubHk9e3ZpZXdlZFRlYW1tYXRlVGFzayA/IGZhbHNlIDogaXNCcmllZk9ubHl9KS4gVGhhdFxuICAvLyBwcm9wIGlzbid0IHRocmVhZGVkIGhlcmUsIHNvIHJlcGxpY2F0ZSB0aGUgZ2F0ZSBmcm9tIHRoZSBzdG9yZSDigJRcbiAgLy8gdGVhbW1hdGUgdmlldyBuZWVkcyB0aGUgcmVhbCBzcGlubmVyICh3aGljaCBzaG93cyB0ZWFtbWF0ZSBzdGF0dXMpLlxuICBjb25zdCB2aWV3aW5nQWdlbnRUYXNrSWQgPSB1c2VBcHBTdGF0ZShzID0+IHMudmlld2luZ0FnZW50VGFza0lkKVxuICAvLyBIb2lzdGVkIHRvIG1vdW50LXRpbWUg4oCUIHRoaXMgY29tcG9uZW50IHJlLXJlbmRlcnMgYXQgYW5pbWF0aW9uIGZyYW1lcmF0ZS5cbiAgY29uc3QgYnJpZWZFbnZFbmFibGVkID1cbiAgICBmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfQlJJRUYnKVxuICAgICAgPyAvLyBiaW9tZS1pZ25vcmUgbGludC9jb3JyZWN0bmVzcy91c2VIb29rQXRUb3BMZXZlbDogZmVhdHVyZSgpIGlzIGEgY29tcGlsZS10aW1lIGNvbnN0YW50XG4gICAgICAgIHVzZU1lbW8oKCkgPT4gaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfQlJJRUYpLCBbXSlcbiAgICAgIDogZmFsc2VcblxuICAvLyBSdW50aW1lIGdhdGUgbWlycm9ycyBpc0JyaWVmRW5hYmxlZCgpIGJ1dCBpbmxpbmVkIOKAlCBpbXBvcnRpbmcgZnJvbVxuICAvLyBCcmllZlRvb2wudHMgd291bGQgbGVhayB0b29sLW5hbWUgc3RyaW5ncyBpbnRvIGV4dGVybmFsIGJ1aWxkcy4gU2luZ2xlXG4gIC8vIHNwaW5uZXIgaW5zdGFuY2Ug4oaSIGhvb2tzIHN0YXkgdW5jb25kaXRpb25hbCAodHdvIHN1YnMsIG5lZ2xpZ2libGUpLlxuICBpZiAoXG4gICAgKGZlYXR1cmUoJ0tBSVJPUycpIHx8IGZlYXR1cmUoJ0tBSVJPU19CUklFRicpKSAmJlxuICAgIChnZXRLYWlyb3NBY3RpdmUoKSB8fFxuICAgICAgKGdldFVzZXJNc2dPcHRJbigpICYmXG4gICAgICAgIChicmllZkVudkVuYWJsZWQgfHxcbiAgICAgICAgICBnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSgndGVuZ3Vfa2Fpcm9zX2JyaWVmJywgZmFsc2UpKSkpICYmXG4gICAgaXNCcmllZk9ubHkgJiZcbiAgICAhdmlld2luZ0FnZW50VGFza0lkXG4gICkge1xuICAgIHJldHVybiAoXG4gICAgICA8QnJpZWZTcGlubmVyIG1vZGU9e3Byb3BzLm1vZGV9IG92ZXJyaWRlTWVzc2FnZT17cHJvcHMub3ZlcnJpZGVNZXNzYWdlfSAvPlxuICAgIClcbiAgfVxuXG4gIHJldHVybiA8U3Bpbm5lcldpdGhWZXJiSW5uZXIgey4uLnByb3BzfSAvPlxufVxuXG5mdW5jdGlvbiBTcGlubmVyV2l0aFZlcmJJbm5lcih7XG4gIG1vZGUsXG4gIGxvYWRpbmdTdGFydFRpbWVSZWYsXG4gIHRvdGFsUGF1c2VkTXNSZWYsXG4gIHBhdXNlU3RhcnRUaW1lUmVmLFxuICBzcGlubmVyVGlwLFxuICByZXNwb25zZUxlbmd0aFJlZixcbiAgb3ZlcnJpZGVDb2xvcixcbiAgb3ZlcnJpZGVTaGltbWVyQ29sb3IsXG4gIG92ZXJyaWRlTWVzc2FnZSxcbiAgc3Bpbm5lclN1ZmZpeCxcbiAgdmVyYm9zZSxcbiAgaGFzQWN0aXZlVG9vbHMgPSBmYWxzZSxcbiAgbGVhZGVySXNJZGxlID0gZmFsc2UsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHNldHRpbmdzID0gdXNlU2V0dGluZ3MoKVxuICBjb25zdCByZWR1Y2VkTW90aW9uID0gc2V0dGluZ3MucHJlZmVyc1JlZHVjZWRNb3Rpb24gPz8gZmFsc2VcblxuICAvLyBOT1RFOiB1c2VBbmltYXRpb25GcmFtZSg1MCkgbGl2ZXMgaW4gU3Bpbm5lckFuaW1hdGlvblJvdywgbm90IGhlcmUuXG4gIC8vIFRoaXMgY29tcG9uZW50IG9ubHkgcmUtcmVuZGVycyB3aGVuIHByb3BzIG9yIGFwcCBzdGF0ZSBjaGFuZ2Ug4oCUXG4gIC8vIGl0IGlzIG5vIGxvbmdlciBvbiB0aGUgNTBtcyBjbG9jay4gQWxsIGB0aW1lYC1kZXJpdmVkIHZhbHVlc1xuICAvLyAoZnJhbWUsIGdsaW1tZXIsIHN0YWxsZWQgaW50ZW5zaXR5LCB0b2tlbiBjb3VudGVyLCB0aGlua2luZyBzaGltbWVyLFxuICAvLyBlbGFwc2VkLXRpbWUgdGltZXIpIGFyZSBjb21wdXRlZCBpbnNpZGUgdGhlIGNoaWxkLlxuXG4gIGNvbnN0IHRhc2tzID0gdXNlQXBwU3RhdGUocyA9PiBzLnRhc2tzKVxuICBjb25zdCB2aWV3aW5nQWdlbnRUYXNrSWQgPSB1c2VBcHBTdGF0ZShzID0+IHMudmlld2luZ0FnZW50VGFza0lkKVxuICBjb25zdCBleHBhbmRlZFZpZXcgPSB1c2VBcHBTdGF0ZShzID0+IHMuZXhwYW5kZWRWaWV3KVxuICBjb25zdCBzaG93RXhwYW5kZWRUb2RvcyA9IGV4cGFuZGVkVmlldyA9PT0gJ3Rhc2tzJ1xuICBjb25zdCBzaG93U3Bpbm5lclRyZWUgPSBleHBhbmRlZFZpZXcgPT09ICd0ZWFtbWF0ZXMnXG4gIGNvbnN0IHNlbGVjdGVkSVBBZ2VudEluZGV4ID0gdXNlQXBwU3RhdGUocyA9PiBzLnNlbGVjdGVkSVBBZ2VudEluZGV4KVxuICBjb25zdCB2aWV3U2VsZWN0aW9uTW9kZSA9IHVzZUFwcFN0YXRlKHMgPT4gcy52aWV3U2VsZWN0aW9uTW9kZSlcbiAgLy8gR2V0IGZvcmVncm91bmRlZCB0ZWFtbWF0ZSAoaWYgdmlld2luZyBhIHRlYW1tYXRlJ3MgdHJhbnNjcmlwdClcbiAgY29uc3QgZm9yZWdyb3VuZGVkVGVhbW1hdGUgPSB2aWV3aW5nQWdlbnRUYXNrSWRcbiAgICA/IGdldFZpZXdlZFRlYW1tYXRlVGFzayh7IHZpZXdpbmdBZ2VudFRhc2tJZCwgdGFza3MgfSlcbiAgICA6IHVuZGVmaW5lZFxuICBjb25zdCB7IGNvbHVtbnMgfSA9IHVzZVRlcm1pbmFsU2l6ZSgpXG4gIGNvbnN0IHRhc2tzVjIgPSB1c2VUYXNrc1YyKClcblxuICAvLyBUcmFjayB0aGlua2luZyBzdGF0dXM6ICd0aGlua2luZycgfCBudW1iZXIgKGR1cmF0aW9uIGluIG1zKSB8IG51bGxcbiAgLy8gU2hvd3MgZWFjaCBzdGF0ZSBmb3IgbWluaW11bSAycyB0byBhdm9pZCBVSSBqYW5rXG4gIGNvbnN0IFt0aGlua2luZ1N0YXR1cywgc2V0VGhpbmtpbmdTdGF0dXNdID0gdXNlU3RhdGU8XG4gICAgJ3RoaW5raW5nJyB8IG51bWJlciB8IG51bGxcbiAgPihudWxsKVxuICBjb25zdCB0aGlua2luZ1N0YXJ0UmVmID0gdXNlUmVmPG51bWJlciB8IG51bGw+KG51bGwpXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBsZXQgc2hvd0R1cmF0aW9uVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgbnVsbCA9IG51bGxcbiAgICBsZXQgY2xlYXJTdGF0dXNUaW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsID0gbnVsbFxuXG4gICAgaWYgKG1vZGUgPT09ICd0aGlua2luZycpIHtcbiAgICAgIC8vIFN0YXJ0ZWQgdGhpbmtpbmdcbiAgICAgIGlmICh0aGlua2luZ1N0YXJ0UmVmLmN1cnJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgdGhpbmtpbmdTdGFydFJlZi5jdXJyZW50ID0gRGF0ZS5ub3coKVxuICAgICAgICBzZXRUaGlua2luZ1N0YXR1cygndGhpbmtpbmcnKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodGhpbmtpbmdTdGFydFJlZi5jdXJyZW50ICE9PSBudWxsKSB7XG4gICAgICAvLyBTdG9wcGVkIHRoaW5raW5nIC0gY2FsY3VsYXRlIGR1cmF0aW9uIGFuZCBlbnN1cmUgMnMgbWluaW11bSBkaXNwbGF5XG4gICAgICBjb25zdCBkdXJhdGlvbiA9IERhdGUubm93KCkgLSB0aGlua2luZ1N0YXJ0UmVmLmN1cnJlbnRcbiAgICAgIGNvbnN0IGVsYXBzZWQgPSBEYXRlLm5vdygpIC0gdGhpbmtpbmdTdGFydFJlZi5jdXJyZW50XG4gICAgICBjb25zdCByZW1haW5pbmdUaGlua2luZ1RpbWUgPSBNYXRoLm1heCgwLCAyMDAwIC0gZWxhcHNlZClcblxuICAgICAgdGhpbmtpbmdTdGFydFJlZi5jdXJyZW50ID0gbnVsbFxuXG4gICAgICAvLyBTaG93IFwidGhpbmtpbmcuLi5cIiBmb3IgcmVtYWluaW5nIHRpbWUgaWYgPCAycyBlbGFwc2VkLCB0aGVuIHNob3cgZHVyYXRpb25cbiAgICAgIGNvbnN0IHNob3dEdXJhdGlvbiA9ICgpOiB2b2lkID0+IHtcbiAgICAgICAgc2V0VGhpbmtpbmdTdGF0dXMoZHVyYXRpb24pXG4gICAgICAgIC8vIENsZWFyIGFmdGVyIDJzXG4gICAgICAgIGNsZWFyU3RhdHVzVGltZXIgPSBzZXRUaW1lb3V0KHNldFRoaW5raW5nU3RhdHVzLCAyMDAwLCBudWxsKVxuICAgICAgfVxuXG4gICAgICBpZiAocmVtYWluaW5nVGhpbmtpbmdUaW1lID4gMCkge1xuICAgICAgICBzaG93RHVyYXRpb25UaW1lciA9IHNldFRpbWVvdXQoc2hvd0R1cmF0aW9uLCByZW1haW5pbmdUaGlua2luZ1RpbWUpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzaG93RHVyYXRpb24oKVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBpZiAoc2hvd0R1cmF0aW9uVGltZXIpIGNsZWFyVGltZW91dChzaG93RHVyYXRpb25UaW1lcilcbiAgICAgIGlmIChjbGVhclN0YXR1c1RpbWVyKSBjbGVhclRpbWVvdXQoY2xlYXJTdGF0dXNUaW1lcilcbiAgICB9XG4gIH0sIFttb2RlXSlcblxuICAvLyBGaW5kIHRoZSBjdXJyZW50IGluLXByb2dyZXNzIHRhc2sgYW5kIG5leHQgcGVuZGluZyB0YXNrXG4gIGNvbnN0IGN1cnJlbnRUb2RvID0gdGFza3NWMj8uZmluZChcbiAgICB0YXNrID0+IHRhc2suc3RhdHVzICE9PSAncGVuZGluZycgJiYgdGFzay5zdGF0dXMgIT09ICdjb21wbGV0ZWQnLFxuICApXG4gIGNvbnN0IG5leHRUYXNrID0gZmluZE5leHRQZW5kaW5nVGFzayh0YXNrc1YyKVxuXG4gIC8vIFVzZSB1c2VTdGF0ZSB3aXRoIGluaXRpYWxpemVyIHRvIHBpY2sgYSByYW5kb20gdmVyYiBvbmNlIG9uIG1vdW50XG4gIGNvbnN0IFtyYW5kb21WZXJiXSA9IHVzZVN0YXRlKCgpID0+IHNhbXBsZShnZXRTcGlubmVyVmVyYnMoKSkpXG5cbiAgLy8gTGVhZGVyJ3Mgb3duIHZlcmIgKGFsd2F5cyB0aGUgbGVhZGVyJ3MsIHJlZ2FyZGxlc3Mgb2Ygd2hvIGlzIGZvcmVncm91bmRlZClcbiAgY29uc3QgbGVhZGVyVmVyYiA9XG4gICAgb3ZlcnJpZGVNZXNzYWdlID8/XG4gICAgY3VycmVudFRvZG8/LmFjdGl2ZUZvcm0gPz9cbiAgICBjdXJyZW50VG9kbz8uc3ViamVjdCA/P1xuICAgIHJhbmRvbVZlcmJcblxuICBjb25zdCBlZmZlY3RpdmVWZXJiID1cbiAgICBmb3JlZ3JvdW5kZWRUZWFtbWF0ZSAmJiAhZm9yZWdyb3VuZGVkVGVhbW1hdGUuaXNJZGxlXG4gICAgICA/IChmb3JlZ3JvdW5kZWRUZWFtbWF0ZS5zcGlubmVyVmVyYiA/PyByYW5kb21WZXJiKVxuICAgICAgOiBsZWFkZXJWZXJiXG4gIGNvbnN0IG1lc3NhZ2UgPSBlZmZlY3RpdmVWZXJiICsgJ+KApidcblxuICAvLyBUcmFjayBDTEkgYWN0aXZpdHkgd2hlbiBzcGlubmVyIGlzIGFjdGl2ZVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IG9wZXJhdGlvbklkID0gJ3NwaW5uZXItJyArIG1vZGVcbiAgICBhY3Rpdml0eU1hbmFnZXIuc3RhcnRDTElBY3Rpdml0eShvcGVyYXRpb25JZClcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgYWN0aXZpdHlNYW5hZ2VyLmVuZENMSUFjdGl2aXR5KG9wZXJhdGlvbklkKVxuICAgIH1cbiAgfSwgW21vZGVdKVxuXG4gIGNvbnN0IGVmZm9ydFZhbHVlID0gdXNlQXBwU3RhdGUocyA9PiBzLmVmZm9ydFZhbHVlKVxuICBjb25zdCBlZmZvcnRTdWZmaXggPSBnZXRFZmZvcnRTdWZmaXgoZ2V0TWFpbkxvb3BNb2RlbCgpLCBlZmZvcnRWYWx1ZSlcblxuICAvLyBDaGVjayBpZiBhbnkgcnVubmluZyBpbi1wcm9jZXNzIHRlYW1tYXRlcyBleGlzdCAobmVlZGVkIGZvciBib3RoIG1vZGVzKVxuICBjb25zdCBydW5uaW5nVGVhbW1hdGVzID0gZ2V0QWxsSW5Qcm9jZXNzVGVhbW1hdGVUYXNrcyh0YXNrcykuZmlsdGVyKFxuICAgIHQgPT4gdC5zdGF0dXMgPT09ICdydW5uaW5nJyxcbiAgKVxuICBjb25zdCBoYXNSdW5uaW5nVGVhbW1hdGVzID0gcnVubmluZ1RlYW1tYXRlcy5sZW5ndGggPiAwXG4gIGNvbnN0IGFsbElkbGUgPSBoYXNSdW5uaW5nVGVhbW1hdGVzICYmIHJ1bm5pbmdUZWFtbWF0ZXMuZXZlcnkodCA9PiB0LmlzSWRsZSlcblxuICAvLyBHYXRoZXIgYWdncmVnYXRlIHRva2VuIHN0YXRzIGZyb20gYWxsIHJ1bm5pbmcgc3dhcm0gdGVhbW1hdGVzXG4gIC8vIEluIHNwaW5uZXItdHJlZSBtb2RlLCBza2lwIGFnZ3JlZ2F0aW9uICh0ZWFtbWF0ZXMgaGF2ZSB0aGVpciBvd24gbGluZXMgaW4gdGhlIHRyZWUpXG4gIGxldCB0ZWFtbWF0ZVRva2VucyA9IDBcbiAgaWYgKCFzaG93U3Bpbm5lclRyZWUpIHtcbiAgICBmb3IgKGNvbnN0IHRhc2sgb2YgT2JqZWN0LnZhbHVlcyh0YXNrcykpIHtcbiAgICAgIGlmIChpc0luUHJvY2Vzc1RlYW1tYXRlVGFzayh0YXNrKSAmJiB0YXNrLnN0YXR1cyA9PT0gJ3J1bm5pbmcnKSB7XG4gICAgICAgIGlmICh0YXNrLnByb2dyZXNzPy50b2tlbkNvdW50KSB7XG4gICAgICAgICAgdGVhbW1hdGVUb2tlbnMgKz0gdGFzay5wcm9ncmVzcy50b2tlbkNvdW50XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBTdGFsZSByZWFkIG9mIHRoZSByZWZzIGZvciBzaG93QnR3VGlwIGJlbG93IOKAlCB3ZSdyZSBvZmYgdGhlIDUwbXMgY2xvY2tcbiAgLy8gc28gdGhpcyBvbmx5IHVwZGF0ZXMgd2hlbiBwcm9wcy9hcHAgc3RhdGUgY2hhbmdlLCB3aGljaCBpcyBzdWZmaWNpZW50IGZvclxuICAvLyBhIGNvYXJzZSAzMHMgdGhyZXNob2xkLlxuICBjb25zdCBlbGFwc2VkU25hcHNob3QgPVxuICAgIHBhdXNlU3RhcnRUaW1lUmVmLmN1cnJlbnQgIT09IG51bGxcbiAgICAgID8gcGF1c2VTdGFydFRpbWVSZWYuY3VycmVudCAtXG4gICAgICAgIGxvYWRpbmdTdGFydFRpbWVSZWYuY3VycmVudCAtXG4gICAgICAgIHRvdGFsUGF1c2VkTXNSZWYuY3VycmVudFxuICAgICAgOiBEYXRlLm5vdygpIC0gbG9hZGluZ1N0YXJ0VGltZVJlZi5jdXJyZW50IC0gdG90YWxQYXVzZWRNc1JlZi5jdXJyZW50XG5cbiAgLy8gTGVhZGVyIHRva2VuIGNvdW50IGZvciBUZWFtbWF0ZVNwaW5uZXJUcmVlIOKAlCByZWFkIHJhdyAobm9uLWFuaW1hdGVkKSBmcm9tXG4gIC8vIHRoZSByZWYuIFRoZSB0cmVlIGlzIG9ubHkgc2hvd24gd2hlbiB0ZWFtbWF0ZXMgYXJlIHJ1bm5pbmc7IHRlYW1tYXRlXG4gIC8vIHByb2dyZXNzIHVwZGF0ZXMgdG8gcy50YXNrcyB0cmlnZ2VyIHJlLXJlbmRlcnMgdGhhdCBrZWVwIHRoaXMgZnJlc2guXG4gIGNvbnN0IGxlYWRlclRva2VuQ291bnQgPSBNYXRoLnJvdW5kKHJlc3BvbnNlTGVuZ3RoUmVmLmN1cnJlbnQgLyA0KVxuXG4gIGNvbnN0IGRlZmF1bHRDb2xvcjoga2V5b2YgVGhlbWUgPSAnY2xhdWRlJ1xuICBjb25zdCBkZWZhdWx0U2hpbW1lckNvbG9yID0gJ2NsYXVkZVNoaW1tZXInXG4gIGNvbnN0IG1lc3NhZ2VDb2xvciA9IG92ZXJyaWRlQ29sb3IgPz8gZGVmYXVsdENvbG9yXG4gIGNvbnN0IHNoaW1tZXJDb2xvciA9IG92ZXJyaWRlU2hpbW1lckNvbG9yID8/IGRlZmF1bHRTaGltbWVyQ29sb3JcblxuICAvLyBDb21wdXRlIFRURlQgc3RyaW5nIGhlcmUgKG9mZiB0aGUgNTBtcyBhbmltYXRpb24gY2xvY2spIGFuZCBwYXNzIHRvXG4gIC8vIFNwaW5uZXJBbmltYXRpb25Sb3cgc28gaXQgZm9sZHMgaW50byB0aGUgYCh0aG91Z2h0IGZvciBOcyDCtyAuLi4pYCBzdGF0dXNcbiAgLy8gbGluZSBpbnN0ZWFkIG9mIHRha2luZyBhIHNlcGFyYXRlIHJvdy4gYXBpTWV0cmljc1JlZiBpcyBhIHJlZiBzbyB0aGlzXG4gIC8vIGRvZXNuJ3QgdHJpZ2dlciByZS1yZW5kZXJzOyB3ZSBwaWNrIHVwIHVwZGF0ZXMgb24gdGhlIHBhcmVudCdzIH4yNXgvdHVyblxuICAvLyByZS1yZW5kZXIgY2FkZW5jZSwgc2FtZSBhcyB0aGUgb2xkIEFwaU1ldHJpY3NMaW5lIGRpZC5cbiAgbGV0IHR0ZnRUZXh0OiBzdHJpbmcgfCBudWxsID0gbnVsbFxuICBpZiAoXG4gICAgXCJleHRlcm5hbFwiID09PSAnYW50JyAmJlxuICAgIGFwaU1ldHJpY3NSZWY/LmN1cnJlbnQgJiZcbiAgICBhcGlNZXRyaWNzUmVmLmN1cnJlbnQubGVuZ3RoID4gMFxuICApIHtcbiAgICB0dGZ0VGV4dCA9IGNvbXB1dGVUdGZ0VGV4dChhcGlNZXRyaWNzUmVmLmN1cnJlbnQpXG4gIH1cblxuICAvLyBXaGVuIGxlYWRlciBpcyBpZGxlIGJ1dCB0ZWFtbWF0ZXMgYXJlIHJ1bm5pbmcgKGFuZCB3ZSdyZSB2aWV3aW5nIHRoZSBsZWFkZXIpLFxuICAvLyBzaG93IGEgc3RhdGljIGRpbSBpZGxlIGRpc3BsYXkgaW5zdGVhZCBvZiB0aGUgYW5pbWF0ZWQgc3Bpbm5lciDigJQgb3RoZXJ3aXNlXG4gIC8vIHVzZVN0YWxsZWRBbmltYXRpb24gZGV0ZWN0cyBubyBuZXcgdG9rZW5zIGFmdGVyIDNzIGFuZCB0dXJucyB0aGUgc3Bpbm5lciByZWQuXG4gIGlmIChsZWFkZXJJc0lkbGUgJiYgaGFzUnVubmluZ1RlYW1tYXRlcyAmJiAhZm9yZWdyb3VuZGVkVGVhbW1hdGUpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgd2lkdGg9XCIxMDAlXCIgYWxpZ25JdGVtcz1cImZsZXgtc3RhcnRcIj5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZmxleFdyYXA9XCJ3cmFwXCIgbWFyZ2luVG9wPXsxfSB3aWR0aD1cIjEwMCVcIj5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIHtURUFSRFJPUF9BU1RFUklTS30gSWRsZVxuICAgICAgICAgICAgeyFhbGxJZGxlICYmICcgwrcgdGVhbW1hdGVzIHJ1bm5pbmcnfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIHtzaG93U3Bpbm5lclRyZWUgJiYgKFxuICAgICAgICAgIDxUZWFtbWF0ZVNwaW5uZXJUcmVlXG4gICAgICAgICAgICBzZWxlY3RlZEluZGV4PXtzZWxlY3RlZElQQWdlbnRJbmRleH1cbiAgICAgICAgICAgIGlzSW5TZWxlY3Rpb25Nb2RlPXt2aWV3U2VsZWN0aW9uTW9kZSA9PT0gJ3NlbGVjdGluZy1hZ2VudCd9XG4gICAgICAgICAgICBhbGxJZGxlPXthbGxJZGxlfVxuICAgICAgICAgICAgbGVhZGVyVG9rZW5Db3VudD17bGVhZGVyVG9rZW5Db3VudH1cbiAgICAgICAgICAgIGxlYWRlcklkbGVUZXh0PVwiSWRsZVwiXG4gICAgICAgICAgLz5cbiAgICAgICAgKX1cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIFdoZW4gdmlld2luZyBhbiBpZGxlIHRlYW1tYXRlLCBzaG93IHN0YXRpYyBpZGxlIGRpc3BsYXkgaW5zdGVhZCBvZiBhbmltYXRlZCBzcGlubmVyXG4gIGlmIChmb3JlZ3JvdW5kZWRUZWFtbWF0ZT8uaXNJZGxlKSB7XG4gICAgY29uc3QgaWRsZVRleHQgPSBhbGxJZGxlXG4gICAgICA/IGAke1RFQVJEUk9QX0FTVEVSSVNLfSBXb3JrZWQgZm9yICR7Zm9ybWF0RHVyYXRpb24oRGF0ZS5ub3coKSAtIGZvcmVncm91bmRlZFRlYW1tYXRlLnN0YXJ0VGltZSl9YFxuICAgICAgOiBgJHtURUFSRFJPUF9BU1RFUklTS30gSWRsZWBcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgd2lkdGg9XCIxMDAlXCIgYWxpZ25JdGVtcz1cImZsZXgtc3RhcnRcIj5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZmxleFdyYXA9XCJ3cmFwXCIgbWFyZ2luVG9wPXsxfSB3aWR0aD1cIjEwMCVcIj5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57aWRsZVRleHR9PC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICAge3Nob3dTcGlubmVyVHJlZSAmJiBoYXNSdW5uaW5nVGVhbW1hdGVzICYmIChcbiAgICAgICAgICA8VGVhbW1hdGVTcGlubmVyVHJlZVxuICAgICAgICAgICAgc2VsZWN0ZWRJbmRleD17c2VsZWN0ZWRJUEFnZW50SW5kZXh9XG4gICAgICAgICAgICBpc0luU2VsZWN0aW9uTW9kZT17dmlld1NlbGVjdGlvbk1vZGUgPT09ICdzZWxlY3RpbmctYWdlbnQnfVxuICAgICAgICAgICAgYWxsSWRsZT17YWxsSWRsZX1cbiAgICAgICAgICAgIGxlYWRlclZlcmI9e2xlYWRlcklzSWRsZSA/IHVuZGVmaW5lZCA6IGxlYWRlclZlcmJ9XG4gICAgICAgICAgICBsZWFkZXJJZGxlVGV4dD17bGVhZGVySXNJZGxlID8gJ0lkbGUnIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgbGVhZGVyVG9rZW5Db3VudD17bGVhZGVyVG9rZW5Db3VudH1cbiAgICAgICAgICAvPlxuICAgICAgICApfVxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgLy8gVGltZS1iYXNlZCB0aXAgb3ZlcnJpZGVzOiBjb2Fyc2UgdGhyZXNob2xkcyBzbyBhIHN0YWxlIHJlZiByZWFkICh3ZSdyZVxuICAvLyBvZmYgdGhlIDUwbXMgY2xvY2spIGlzIGZpbmUuIE90aGVyIHRyaWdnZXJzIChtb2RlIGNoYW5nZSwgc2V0TWVzc2FnZXMpXG4gIC8vIGNhdXNlIHJlLXJlbmRlcnMgdGhhdCByZWZyZXNoIHRoaXMgaW4gcHJhY3RpY2UuXG4gIGxldCBjb250ZXh0VGlwc0FjdGl2ZSA9IGZhbHNlXG4gIGNvbnN0IHRpcHNFbmFibGVkID0gc2V0dGluZ3Muc3Bpbm5lclRpcHNFbmFibGVkICE9PSBmYWxzZVxuICBjb25zdCBzaG93Q2xlYXJUaXAgPSB0aXBzRW5hYmxlZCAmJiBlbGFwc2VkU25hcHNob3QgPiAxXzgwMF8wMDBcbiAgY29uc3Qgc2hvd0J0d1RpcCA9XG4gICAgdGlwc0VuYWJsZWQgJiYgZWxhcHNlZFNuYXBzaG90ID4gMzBfMDAwICYmICFnZXRHbG9iYWxDb25maWcoKS5idHdVc2VDb3VudFxuXG4gIGNvbnN0IGVmZmVjdGl2ZVRpcCA9IGNvbnRleHRUaXBzQWN0aXZlXG4gICAgPyB1bmRlZmluZWRcbiAgICA6IHNob3dDbGVhclRpcCAmJiAhbmV4dFRhc2tcbiAgICAgID8gJ1VzZSAvY2xlYXIgdG8gc3RhcnQgZnJlc2ggd2hlbiBzd2l0Y2hpbmcgdG9waWNzIGFuZCBmcmVlIHVwIGNvbnRleHQnXG4gICAgICA6IHNob3dCdHdUaXAgJiYgIW5leHRUYXNrXG4gICAgICAgID8gXCJVc2UgL2J0dyB0byBhc2sgYSBxdWljayBzaWRlIHF1ZXN0aW9uIHdpdGhvdXQgaW50ZXJydXB0aW5nIENsYXVkZSdzIGN1cnJlbnQgd29ya1wiXG4gICAgICAgIDogc3Bpbm5lclRpcFxuXG4gIC8vIEJ1ZGdldCB0ZXh0IChhbnQtb25seSkg4oCUIHNob3duIGFib3ZlIHRoZSB0aXAgbGluZVxuICBsZXQgYnVkZ2V0VGV4dDogc3RyaW5nIHwgbnVsbCA9IG51bGxcbiAgaWYgKGZlYXR1cmUoJ1RPS0VOX0JVREdFVCcpKSB7XG4gICAgY29uc3QgYnVkZ2V0ID0gZ2V0Q3VycmVudFR1cm5Ub2tlbkJ1ZGdldCgpXG4gICAgaWYgKGJ1ZGdldCAhPT0gbnVsbCAmJiBidWRnZXQgPiAwKSB7XG4gICAgICBjb25zdCB0b2tlbnMgPSBnZXRUdXJuT3V0cHV0VG9rZW5zKClcbiAgICAgIGlmICh0b2tlbnMgPj0gYnVkZ2V0KSB7XG4gICAgICAgIGJ1ZGdldFRleHQgPSBgVGFyZ2V0OiAke2Zvcm1hdE51bWJlcih0b2tlbnMpfSB1c2VkICgke2Zvcm1hdE51bWJlcihidWRnZXQpfSBtaW4gJHtmaWd1cmVzLnRpY2t9KWBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHBjdCA9IE1hdGgucm91bmQoKHRva2VucyAvIGJ1ZGdldCkgKiAxMDApXG4gICAgICAgIGNvbnN0IHJlbWFpbmluZyA9IGJ1ZGdldCAtIHRva2Vuc1xuICAgICAgICBjb25zdCByYXRlID1cbiAgICAgICAgICBlbGFwc2VkU25hcHNob3QgPiA1MDAwICYmIHRva2VucyA+PSAyMDAwXG4gICAgICAgICAgICA/IHRva2VucyAvIGVsYXBzZWRTbmFwc2hvdFxuICAgICAgICAgICAgOiAwXG4gICAgICAgIGNvbnN0IGV0YSA9XG4gICAgICAgICAgcmF0ZSA+IDBcbiAgICAgICAgICAgID8gYCBcXHUwMEI3IH4ke2Zvcm1hdER1cmF0aW9uKHJlbWFpbmluZyAvIHJhdGUsIHsgbW9zdFNpZ25pZmljYW50T25seTogdHJ1ZSB9KX1gXG4gICAgICAgICAgICA6ICcnXG4gICAgICAgIGJ1ZGdldFRleHQgPSBgVGFyZ2V0OiAke2Zvcm1hdE51bWJlcih0b2tlbnMpfSAvICR7Zm9ybWF0TnVtYmVyKGJ1ZGdldCl9ICgke3BjdH0lKSR7ZXRhfWBcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPVwiMTAwJVwiIGFsaWduSXRlbXM9XCJmbGV4LXN0YXJ0XCI+XG4gICAgICA8U3Bpbm5lckFuaW1hdGlvblJvd1xuICAgICAgICBtb2RlPXttb2RlfVxuICAgICAgICByZWR1Y2VkTW90aW9uPXtyZWR1Y2VkTW90aW9ufVxuICAgICAgICBoYXNBY3RpdmVUb29scz17aGFzQWN0aXZlVG9vbHN9XG4gICAgICAgIHJlc3BvbnNlTGVuZ3RoUmVmPXtyZXNwb25zZUxlbmd0aFJlZn1cbiAgICAgICAgbWVzc2FnZT17bWVzc2FnZX1cbiAgICAgICAgbWVzc2FnZUNvbG9yPXttZXNzYWdlQ29sb3J9XG4gICAgICAgIHNoaW1tZXJDb2xvcj17c2hpbW1lckNvbG9yfVxuICAgICAgICBvdmVycmlkZUNvbG9yPXtvdmVycmlkZUNvbG9yfVxuICAgICAgICBsb2FkaW5nU3RhcnRUaW1lUmVmPXtsb2FkaW5nU3RhcnRUaW1lUmVmfVxuICAgICAgICB0b3RhbFBhdXNlZE1zUmVmPXt0b3RhbFBhdXNlZE1zUmVmfVxuICAgICAgICBwYXVzZVN0YXJ0VGltZVJlZj17cGF1c2VTdGFydFRpbWVSZWZ9XG4gICAgICAgIHNwaW5uZXJTdWZmaXg9e3NwaW5uZXJTdWZmaXh9XG4gICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgIGNvbHVtbnM9e2NvbHVtbnN9XG4gICAgICAgIGhhc1J1bm5pbmdUZWFtbWF0ZXM9e2hhc1J1bm5pbmdUZWFtbWF0ZXN9XG4gICAgICAgIHRlYW1tYXRlVG9rZW5zPXt0ZWFtbWF0ZVRva2Vuc31cbiAgICAgICAgZm9yZWdyb3VuZGVkVGVhbW1hdGU9e2ZvcmVncm91bmRlZFRlYW1tYXRlfVxuICAgICAgICBsZWFkZXJJc0lkbGU9e2xlYWRlcklzSWRsZX1cbiAgICAgICAgdGhpbmtpbmdTdGF0dXM9e3RoaW5raW5nU3RhdHVzfVxuICAgICAgICBlZmZvcnRTdWZmaXg9e2VmZm9ydFN1ZmZpeH1cbiAgICAgIC8+XG4gICAgICB7c2hvd1NwaW5uZXJUcmVlICYmIGhhc1J1bm5pbmdUZWFtbWF0ZXMgPyAoXG4gICAgICAgIDxUZWFtbWF0ZVNwaW5uZXJUcmVlXG4gICAgICAgICAgc2VsZWN0ZWRJbmRleD17c2VsZWN0ZWRJUEFnZW50SW5kZXh9XG4gICAgICAgICAgaXNJblNlbGVjdGlvbk1vZGU9e3ZpZXdTZWxlY3Rpb25Nb2RlID09PSAnc2VsZWN0aW5nLWFnZW50J31cbiAgICAgICAgICBhbGxJZGxlPXthbGxJZGxlfVxuICAgICAgICAgIGxlYWRlclZlcmI9e2xlYWRlcklzSWRsZSA/IHVuZGVmaW5lZCA6IGxlYWRlclZlcmJ9XG4gICAgICAgICAgbGVhZGVySWRsZVRleHQ9e2xlYWRlcklzSWRsZSA/ICdJZGxlJyA6IHVuZGVmaW5lZH1cbiAgICAgICAgICBsZWFkZXJUb2tlbkNvdW50PXtsZWFkZXJUb2tlbkNvdW50fVxuICAgICAgICAvPlxuICAgICAgKSA6IHNob3dFeHBhbmRlZFRvZG9zICYmIHRhc2tzVjIgJiYgdGFza3NWMi5sZW5ndGggPiAwID8gKFxuICAgICAgICA8Qm94IHdpZHRoPVwiMTAwJVwiIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8TWVzc2FnZVJlc3BvbnNlPlxuICAgICAgICAgICAgPFRhc2tMaXN0VjIgdGFza3M9e3Rhc2tzVjJ9IC8+XG4gICAgICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgIDwvQm94PlxuICAgICAgKSA6IG5leHRUYXNrIHx8IGVmZmVjdGl2ZVRpcCB8fCBidWRnZXRUZXh0ID8gKFxuICAgICAgICAvLyBJTVBPUlRBTlQ6IHdlIG5lZWQgdGhpcyB3aWR0aD1cIjEwMCVcIiB0byBhdm9pZCBhbiBJbmsgYnVnIHdoZXJlIHRoZVxuICAgICAgICAvLyB0aXAgZ2V0cyBkdXBsaWNhdGVkIG92ZXIgYW5kIG92ZXIgd2hpbGUgdGhlIHNwaW5uZXIgaXMgcnVubmluZyBpZlxuICAgICAgICAvLyB0aGUgdGVybWluYWwgaXMgdmVyeSBzbWFsbC4gVE9ETzogZml4IHRoaXMgaW4gSW5rLlxuICAgICAgICA8Qm94IHdpZHRoPVwiMTAwJVwiIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICB7YnVkZ2V0VGV4dCAmJiAoXG4gICAgICAgICAgICA8TWVzc2FnZVJlc3BvbnNlPlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57YnVkZ2V0VGV4dH08L1RleHQ+XG4gICAgICAgICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICAgICAgICApfVxuICAgICAgICAgIHsobmV4dFRhc2sgfHwgZWZmZWN0aXZlVGlwKSAmJiAoXG4gICAgICAgICAgICA8TWVzc2FnZVJlc3BvbnNlPlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICB7bmV4dFRhc2tcbiAgICAgICAgICAgICAgICAgID8gYE5leHQ6ICR7bmV4dFRhc2suc3ViamVjdH1gXG4gICAgICAgICAgICAgICAgICA6IGBUaXA6ICR7ZWZmZWN0aXZlVGlwfWB9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvQm94PlxuICAgICAgKSA6IG51bGx9XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuLy8gQnJpZWYvYXNzaXN0YW50IG1vZGUgc3Bpbm5lcjogc2luZ2xlIHN0YXR1cyBsaW5lLiBQcm9tcHRJbnB1dCBkcm9wcyBpdHNcbi8vIG93biBtYXJnaW5Ub3Agd2hlbiBpc0JyaWVmT25seSBpcyBhY3RpdmUsIHNvIHRoaXMgY29tcG9uZW50IG93bnMgdGhlXG4vLyAyLXJvdyBmb290cHJpbnQgYmV0d2VlbiBtZXNzYWdlcyBhbmQgaW5wdXQuIEZvb3RwcmludCBpcyBbYmxhbmssIGNvbnRlbnRdXG4vLyDigJQgb25lIGJsYW5rIHJvdyBhYm92ZSAoYnJlYXRoaW5nIHJvb20gdW5kZXIgdGhlIG1lc3NhZ2VzIGxpc3QpLCBzcGlubmVyXG4vLyBmbHVzaCBhZ2FpbnN0IHRoZSBpbnB1dCBiYXIuIFByb21wdElucHV0J3MgYWJzb2x1dGUtcG9zaXRpb25lZFxuLy8gTm90aWZpY2F0aW9ucyBvdmVybGF5IGNvbXBlbnNhdGVzIHdpdGggbWFyZ2luVG9wPS0yIGluIGJyaWVmIG1vZGVcbi8vIChQcm9tcHRJbnB1dC50c3g6fjI5MjgpIHNvIGl0IGZsb2F0cyBpbnRvIHRoZSBibGFuayByb3cgYWJvdmUgdGhlXG4vLyBzcGlubmVyLCBub3Qgb3ZlciB0aGUgc3Bpbm5lciBjb250ZW50LiBQYWlyZWQgd2l0aCBCcmllZklkbGVTdGF0dXMgd2hpY2hcbi8vIGtlZXBzIHRoZSBzYW1lIGZvb3RwcmludCB3aGVuIGlkbGUuXG50eXBlIEJyaWVmU3Bpbm5lclByb3BzID0ge1xuICBtb2RlOiBTcGlubmVyTW9kZVxuICBvdmVycmlkZU1lc3NhZ2U/OiBzdHJpbmcgfCBudWxsXG59XG5cbmZ1bmN0aW9uIEJyaWVmU3Bpbm5lcih7XG4gIG1vZGUsXG4gIG92ZXJyaWRlTWVzc2FnZSxcbn06IEJyaWVmU3Bpbm5lclByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3Qgc2V0dGluZ3MgPSB1c2VTZXR0aW5ncygpXG4gIGNvbnN0IHJlZHVjZWRNb3Rpb24gPSBzZXR0aW5ncy5wcmVmZXJzUmVkdWNlZE1vdGlvbiA/PyBmYWxzZVxuICBjb25zdCBbcmFuZG9tVmVyYl0gPSB1c2VTdGF0ZSgoKSA9PiBzYW1wbGUoZ2V0U3Bpbm5lclZlcmJzKCkpID8/ICdXb3JraW5nJylcbiAgY29uc3QgdmVyYiA9IG92ZXJyaWRlTWVzc2FnZSA/PyByYW5kb21WZXJiXG4gIGNvbnN0IGNvbm5TdGF0dXMgPSB1c2VBcHBTdGF0ZShzID0+IHMucmVtb3RlQ29ubmVjdGlvblN0YXR1cylcblxuICAvLyBUcmFjayBDTEkgYWN0aXZpdHkgc28gT1MvSURFIFwiYnVzeVwiIGluZGljYXRvcnMgZmlyZSBpbiBicmllZiBtb2RlIHRvb1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IG9wZXJhdGlvbklkID0gJ3NwaW5uZXItJyArIG1vZGVcbiAgICBhY3Rpdml0eU1hbmFnZXIuc3RhcnRDTElBY3Rpdml0eShvcGVyYXRpb25JZClcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgYWN0aXZpdHlNYW5hZ2VyLmVuZENMSUFjdGl2aXR5KG9wZXJhdGlvbklkKVxuICAgIH1cbiAgfSwgW21vZGVdKVxuXG4gIC8vIERyaXZlIGJvdGggZG90IGN5Y2xlIGFuZCBzaGltbWVyIGZyb20gdGhlIHNoYXJlZCBjbG9jay4gVGhlIHZpZXdwb3J0XG4gIC8vIHJlZiBpcyB1bnVzZWQg4oCUIHRoZSBzcGlubmVyIHVubW91bnRzIG9uIHR1cm4gZW5kIHNvIHZpZXdwb3J0LWJhc2VkXG4gIC8vIHBhdXNpbmcgaXNuJ3QgbmVlZGVkLlxuICBjb25zdCBbLCB0aW1lXSA9IHVzZUFuaW1hdGlvbkZyYW1lKHJlZHVjZWRNb3Rpb24gPyBudWxsIDogMTIwKVxuXG4gIC8vIExvY2FsIHRhc2tzICsgcmVtb3RlIHRhc2tzIGFyZSBtdXR1YWxseSBleGNsdXNpdmUgKHZpZXdlciBtb2RlIGhhcyBhblxuICAvLyBlbXB0eSBsb2NhbCBBcHBTdGF0ZS50YXNrczsgbG9jYWwgbW9kZSBoYXMgcmVtb3RlQmFja2dyb3VuZFRhc2tDb3VudD0wKS5cbiAgLy8gU3VtbWluZyBhdm9pZHMgYSBtb2RlIGJyYW5jaC5cbiAgY29uc3QgcnVubmluZ0NvdW50ID0gdXNlQXBwU3RhdGUoXG4gICAgcyA9PlxuICAgICAgY291bnQoT2JqZWN0LnZhbHVlcyhzLnRhc2tzKSwgaXNCYWNrZ3JvdW5kVGFzaykgK1xuICAgICAgcy5yZW1vdGVCYWNrZ3JvdW5kVGFza0NvdW50LFxuICApXG5cbiAgLy8gQ29ubmVjdGlvbiB0cm91YmxlIG92ZXJyaWRlcyB0aGUgdmVyYiDigJQgYGNsYXVkZSBhc3Npc3RhbnRgIGlzIGEgcHVyZSB2aWV3ZXIsXG4gIC8vIG5vdGhpbmcgdXNlZnVsIGlzIGhhcHBlbmluZyB3aGlsZSB0aGUgV1MgaXMgZG93bi5cbiAgY29uc3Qgc2hvd0Nvbm5XYXJuaW5nID1cbiAgICBjb25uU3RhdHVzID09PSAncmVjb25uZWN0aW5nJyB8fCBjb25uU3RhdHVzID09PSAnZGlzY29ubmVjdGVkJ1xuICBjb25zdCBjb25uVGV4dCA9XG4gICAgY29ublN0YXR1cyA9PT0gJ3JlY29ubmVjdGluZycgPyAnUmVjb25uZWN0aW5nJyA6ICdEaXNjb25uZWN0ZWQnXG5cbiAgLy8gRG90cyBwYWRkZWQgdG8gYSBmaXhlZCAzIGNvbHVtbnMgc28gdGhlIHJpZ2h0LWFsaWduZWQgY291bnQgZG9lc24ndFxuICAvLyBqaXR0ZXIgYXMgdGhlIGN5Y2xlIGFkdmFuY2VzLlxuICBjb25zdCBkb3RGcmFtZSA9IE1hdGguZmxvb3IodGltZSAvIDMwMCkgJSAzXG4gIGNvbnN0IGRvdHMgPSByZWR1Y2VkTW90aW9uID8gJ+KApiAgJyA6ICcuJy5yZXBlYXQoZG90RnJhbWUgKyAxKS5wYWRFbmQoMylcblxuICAvLyBTaGltbWVyOiByZXZlcnNlLXN3ZWVwIGhpZ2hsaWdodCBhY3Jvc3MgdGhlIHZlcmIuIFNraXAgZm9yIGNvbm5lY3Rpb25cbiAgLy8gd2FybmluZ3MgKHNoaW1tZXIgcmVhZHMgYXMgXCJ3b3JraW5nXCI7IFJlY29ubmVjdGluZy9EaXNjb25uZWN0ZWQgaXMgbm90KS5cbiAgY29uc3QgdmVyYldpZHRoID0gdXNlTWVtbygoKSA9PiBzdHJpbmdXaWR0aCh2ZXJiKSwgW3ZlcmJdKVxuICBjb25zdCBnbGltbWVySW5kZXggPVxuICAgIHJlZHVjZWRNb3Rpb24gfHwgc2hvd0Nvbm5XYXJuaW5nXG4gICAgICA/IC0xMDBcbiAgICAgIDogY29tcHV0ZUdsaW1tZXJJbmRleChNYXRoLmZsb29yKHRpbWUgLyBTSElNTUVSX0lOVEVSVkFMX01TKSwgdmVyYldpZHRoKVxuICBjb25zdCB7IGJlZm9yZSwgc2hpbW1lciwgYWZ0ZXIgfSA9IGNvbXB1dGVTaGltbWVyU2VnbWVudHModmVyYiwgZ2xpbW1lckluZGV4KVxuXG4gIGNvbnN0IHsgY29sdW1ucyB9ID0gdXNlVGVybWluYWxTaXplKClcbiAgY29uc3QgcmlnaHRUZXh0ID0gcnVubmluZ0NvdW50ID4gMCA/IGAke3J1bm5pbmdDb3VudH0gaW4gYmFja2dyb3VuZGAgOiAnJ1xuICAvLyBNYW51YWwgcmlnaHQtYWxpZ24gdmlhIHNwYWNlIHBhZGRpbmcg4oCUIGZsZXhHcm93IHNwYWNlcnMgaW5zaWRlXG4gIC8vIEZ1bGxzY3JlZW5MYXlvdXQncyBgbWFpbmAgc2xvdCBkb24ndCByZXNvbHZlIGEgd2lkdGggYW5kIGNhdXNlZCB0aGVcbiAgLy8gZGlmZiBlbmdpbmUgdG8gbWlzcyBkb3QtZnJhbWUgdXBkYXRlcy5cbiAgY29uc3QgbGVmdFdpZHRoID0gKHNob3dDb25uV2FybmluZyA/IHN0cmluZ1dpZHRoKGNvbm5UZXh0KSA6IHZlcmJXaWR0aCkgKyAzXG4gIGNvbnN0IHBhZCA9IE1hdGgubWF4KDEsIGNvbHVtbnMgLSAyIC0gbGVmdFdpZHRoIC0gc3RyaW5nV2lkdGgocmlnaHRUZXh0KSlcblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cInJvd1wiIHdpZHRoPVwiMTAwJVwiIG1hcmdpblRvcD17MX0gcGFkZGluZ0xlZnQ9ezJ9PlxuICAgICAge3Nob3dDb25uV2FybmluZyA/IChcbiAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPntjb25uVGV4dCArIGRvdHN9PC9UZXh0PlxuICAgICAgKSA6IChcbiAgICAgICAgPD5cbiAgICAgICAgICB7YmVmb3JlID8gPFRleHQgZGltQ29sb3I+e2JlZm9yZX08L1RleHQ+IDogbnVsbH1cbiAgICAgICAgICB7c2hpbW1lciA/IDxUZXh0PntzaGltbWVyfTwvVGV4dD4gOiBudWxsfVxuICAgICAgICAgIHthZnRlciA/IDxUZXh0IGRpbUNvbG9yPnthZnRlcn08L1RleHQ+IDogbnVsbH1cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57ZG90c308L1RleHQ+XG4gICAgICAgIDwvPlxuICAgICAgKX1cbiAgICAgIHtyaWdodFRleHQgPyAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPFRleHQ+eycgJy5yZXBlYXQocGFkKX08L1RleHQ+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJzdWJ0bGVcIj57cmlnaHRUZXh0fTwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApIDogbnVsbH1cbiAgICA8L0JveD5cbiAgKVxufVxuXG4vLyBJZGxlIHBsYWNlaG9sZGVyIGZvciBicmllZiBtb2RlLiBTYW1lIDItcm93IFtibGFuaywgY29udGVudF0gZm9vdHByaW50XG4vLyBhcyBCcmllZlNwaW5uZXIgc28gdGhlIGlucHV0IGJhciBuZXZlciBqdW1wcyB3aGVuIHRvZ2dsaW5nIGJldHdlZW5cbi8vIHdvcmtpbmcvaWRsZS9kaXNjb25uZWN0ZWQuIFNlZSBCcmllZlNwaW5uZXIncyBjb21tZW50IGZvciB0aGVcbi8vIE5vdGlmaWNhdGlvbnMgb3ZlcmxheSBjb3VwbGluZy5cbmV4cG9ydCBmdW5jdGlvbiBCcmllZklkbGVTdGF0dXMoKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgY29ublN0YXR1cyA9IHVzZUFwcFN0YXRlKHMgPT4gcy5yZW1vdGVDb25uZWN0aW9uU3RhdHVzKVxuICBjb25zdCBydW5uaW5nQ291bnQgPSB1c2VBcHBTdGF0ZShcbiAgICBzID0+XG4gICAgICBjb3VudChPYmplY3QudmFsdWVzKHMudGFza3MpLCBpc0JhY2tncm91bmRUYXNrKSArXG4gICAgICBzLnJlbW90ZUJhY2tncm91bmRUYXNrQ291bnQsXG4gIClcbiAgY29uc3QgeyBjb2x1bW5zIH0gPSB1c2VUZXJtaW5hbFNpemUoKVxuXG4gIGNvbnN0IHNob3dDb25uV2FybmluZyA9XG4gICAgY29ublN0YXR1cyA9PT0gJ3JlY29ubmVjdGluZycgfHwgY29ublN0YXR1cyA9PT0gJ2Rpc2Nvbm5lY3RlZCdcbiAgY29uc3QgY29ublRleHQgPVxuICAgIGNvbm5TdGF0dXMgPT09ICdyZWNvbm5lY3RpbmcnID8gJ1JlY29ubmVjdGluZ+KApicgOiAnRGlzY29ubmVjdGVkJ1xuICBjb25zdCBsZWZ0VGV4dCA9IHNob3dDb25uV2FybmluZyA/IGNvbm5UZXh0IDogJydcbiAgY29uc3QgcmlnaHRUZXh0ID0gcnVubmluZ0NvdW50ID4gMCA/IGAke3J1bm5pbmdDb3VudH0gaW4gYmFja2dyb3VuZGAgOiAnJ1xuXG4gIGlmICghbGVmdFRleHQgJiYgIXJpZ2h0VGV4dCkgcmV0dXJuIDxCb3ggaGVpZ2h0PXsyfSAvPlxuXG4gIGNvbnN0IHBhZCA9IE1hdGgubWF4KFxuICAgIDEsXG4gICAgY29sdW1ucyAtIDIgLSBzdHJpbmdXaWR0aChsZWZ0VGV4dCkgLSBzdHJpbmdXaWR0aChyaWdodFRleHQpLFxuICApXG4gIHJldHVybiAoXG4gICAgPEJveCBtYXJnaW5Ub3A9ezF9IHBhZGRpbmdMZWZ0PXsyfT5cbiAgICAgIDxUZXh0PlxuICAgICAgICB7bGVmdFRleHQgPyA8VGV4dCBjb2xvcj1cImVycm9yXCI+e2xlZnRUZXh0fTwvVGV4dD4gOiBudWxsfVxuICAgICAgICB7cmlnaHRUZXh0ID8gKFxuICAgICAgICAgIDw+XG4gICAgICAgICAgICA8VGV4dD57JyAnLnJlcGVhdChwYWQpfTwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwic3VidGxlXCI+e3JpZ2h0VGV4dH08L1RleHQ+XG4gICAgICAgICAgPC8+XG4gICAgICAgICkgOiBudWxsfVxuICAgICAgPC9UZXh0PlxuICAgIDwvQm94PlxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTcGlubmVyKCk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHNldHRpbmdzID0gdXNlU2V0dGluZ3MoKVxuICBjb25zdCByZWR1Y2VkTW90aW9uID0gc2V0dGluZ3MucHJlZmVyc1JlZHVjZWRNb3Rpb24gPz8gZmFsc2VcbiAgY29uc3QgW3JlZiwgdGltZV0gPSB1c2VBbmltYXRpb25GcmFtZShyZWR1Y2VkTW90aW9uID8gbnVsbCA6IDEyMClcblxuICAvLyBSZWR1Y2VkIG1vdGlvbjogc3RhdGljIGRvdCBpbnN0ZWFkIG9mIGFuaW1hdGVkIHNwaW5uZXJcbiAgaWYgKHJlZHVjZWRNb3Rpb24pIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCByZWY9e3JlZn0gZmxleFdyYXA9XCJ3cmFwXCIgaGVpZ2h0PXsxfSB3aWR0aD17Mn0+XG4gICAgICAgIDxUZXh0IGNvbG9yPVwidGV4dFwiPuKXjzwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIERlcml2ZSBmcmFtZSBmcm9tIHN5bmNlZCB0aW1lIC0gYWxsIHNwaW5uZXJzIGFuaW1hdGUgdG9nZXRoZXJcbiAgY29uc3QgZnJhbWUgPSBNYXRoLmZsb29yKHRpbWUgLyAxMjApICUgU1BJTk5FUl9GUkFNRVMubGVuZ3RoXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IHJlZj17cmVmfSBmbGV4V3JhcD1cIndyYXBcIiBoZWlnaHQ9ezF9IHdpZHRoPXsyfT5cbiAgICAgIDxUZXh0IGNvbG9yPVwidGV4dFwiPntTUElOTkVSX0ZSQU1FU1tmcmFtZV19PC9UZXh0PlxuICAgIDwvQm94PlxuICApXG59XG5cblxuZnVuY3Rpb24gZmluZE5leHRQZW5kaW5nVGFzayh0YXNrczogVGFza1tdIHwgdW5kZWZpbmVkKTogVGFzayB8IHVuZGVmaW5lZCB7XG4gIGlmICghdGFza3MpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkXG4gIH1cbiAgY29uc3QgcGVuZGluZ1Rhc2tzID0gdGFza3MuZmlsdGVyKHQgPT4gdC5zdGF0dXMgPT09ICdwZW5kaW5nJylcbiAgaWYgKHBlbmRpbmdUYXNrcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkXG4gIH1cbiAgY29uc3QgdW5yZXNvbHZlZElkcyA9IG5ldyBTZXQoXG4gICAgdGFza3MuZmlsdGVyKHQgPT4gdC5zdGF0dXMgIT09ICdjb21wbGV0ZWQnKS5tYXAodCA9PiB0LmlkKSxcbiAgKVxuICByZXR1cm4gKFxuICAgIHBlbmRpbmdUYXNrcy5maW5kKHQgPT4gIXQuYmxvY2tlZEJ5LnNvbWUoaWQgPT4gdW5yZXNvbHZlZElkcy5oYXMoaWQpKSkgPz9cbiAgICBwZW5kaW5nVGFza3NbMF1cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQSxTQUFTQSxHQUFHLEVBQUVDLElBQUksUUFBUSxXQUFXO0FBQ3JDLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsU0FBUyxFQUFFQyxPQUFPLEVBQUVDLE1BQU0sRUFBRUMsUUFBUSxRQUFRLE9BQU87QUFDNUQsU0FDRUMsbUJBQW1CLEVBQ25CQyxzQkFBc0IsRUFDdEJDLG1CQUFtQixRQUNkLCtCQUErQjtBQUN0QyxTQUFTQyxPQUFPLFFBQVEsWUFBWTtBQUNwQyxTQUFTQyxlQUFlLEVBQUVDLGVBQWUsUUFBUSx1QkFBdUI7QUFDeEUsU0FBU0MsbUNBQW1DLFFBQVEscUNBQXFDO0FBQ3pGLFNBQVNDLFdBQVcsUUFBUSxzQkFBc0I7QUFDbEQsU0FBU0MsS0FBSyxRQUFRLG1CQUFtQjtBQUN6QyxPQUFPQyxNQUFNLE1BQU0scUJBQXFCO0FBQ3hDLFNBQ0VDLGNBQWMsRUFDZEMsWUFBWSxFQUNaQyxrQkFBa0IsUUFDYixvQkFBb0I7QUFDM0IsY0FBY0MsS0FBSyxRQUFRLG9CQUFvQjtBQUMvQyxTQUFTQyxlQUFlLFFBQVEsNkJBQTZCO0FBQzdELFNBQVNDLGVBQWUsUUFBUSw4QkFBOEI7QUFDOUQsU0FBU0MsZUFBZSxRQUFRLHNCQUFzQjtBQUN0RCxTQUFTQyxVQUFVLFFBQVEsaUJB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