import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import React, { useMemo, useState } from 'react';
import type { SDKMessage } from 'src/entrypoints/agentSdkTypes.js';
import type { ToolUseContext } from 'src/Tool.js';
import type { DeepImmutable } from 'src/types/utils.js';
import type { CommandResultDisplay } from '../../commands.js';
import { DIAMOND_FILLED, DIAMOND_OPEN } from '../../constants/figures.js';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js';
import { Box, Link, Text } from '../../ink.js';
import type { RemoteAgentTaskState } from '../../tasks/RemoteAgentTask/RemoteAgentTask.js';
import { getRemoteTaskSessionUrl } from '../../tasks/RemoteAgentTask/RemoteAgentTask.js';
import { AGENT_TOOL_NAME, LEGACY_AGENT_TOOL_NAME } from '../../tools/AgentTool/constants.js';
import { ASK_USER_QUESTION_TOOL_NAME } from '../../tools/AskUserQuestionTool/prompt.js';
import { EXIT_PLAN_MODE_V2_TOOL_NAME } from '../../tools/ExitPlanModeTool/constants.js';
import { openBrowser } from '../../utils/browser.js';
import { errorMessage } from '../../utils/errors.js';
import { formatDuration, truncateToWidth } from '../../utils/format.js';
import { toInternalMessages } from '../../utils/messages/mappers.js';
import { EMPTY_LOOKUPS, normalizeMessages } from '../../utils/messages.js';
import { plural } from '../../utils/stringUtils.js';
import { teleportResumeCodeSession } from '../../utils/teleport.js';
import { Select } from '../CustomSelect/select.js';
import { Byline } from '../design-system/Byline.js';
import { Dialog } from '../design-system/Dialog.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import { Message } from '../Message.js';
import { formatReviewStageCounts, RemoteSessionProgress } from './RemoteSessionProgress.js';
type Props = {
  session: DeepImmutable<RemoteAgentTaskState>;
  toolUseContext: ToolUseContext;
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
  onBack?: () => void;
  onKill?: () => void;
};

// Compact one-line summary: tool name + first meaningful string arg.
// Lighter than tool.renderToolUseMessage (no registry lookup / schema parse).
// Collapses whitespace so multi-line inputs (e.g. Bash command text)
// render on one line.
export function formatToolUseSummary(name: string, input: unknown): string {
  // plan_ready phase is only reached via ExitPlanMode tool
  if (name === EXIT_PLAN_MODE_V2_TOOL_NAME) {
    return 'Review the plan in Claude Code on the web';
  }
  if (!input || typeof input !== 'object') return name;
  // AskUserQuestion: show the question text as a CTA, not the tool name.
  // Input shape is {questions: [{question, header, options}]}.
  if (name === ASK_USER_QUESTION_TOOL_NAME && 'questions' in input) {
    const qs = input.questions;
    if (Array.isArray(qs) && qs[0] && typeof qs[0] === 'object') {
      // Prefer question (full text) over header (max-12-char tag). header
      // is a required schema field so checking it first would make the
      // question fallback dead code.
      const q = 'question' in qs[0] && typeof qs[0].question === 'string' && qs[0].question ? qs[0].question : 'header' in qs[0] && typeof qs[0].header === 'string' ? qs[0].header : null;
      if (q) {
        const oneLine = q.replace(/\s+/g, ' ').trim();
        return `Answer in browser: ${truncateToWidth(oneLine, 50)}`;
      }
    }
  }
  for (const v of Object.values(input)) {
    if (typeof v === 'string' && v.trim()) {
      const oneLine = v.replace(/\s+/g, ' ').trim();
      return `${name} ${truncateToWidth(oneLine, 60)}`;
    }
  }
  return name;
}
const PHASE_LABEL = {
  needs_input: 'input required',
  plan_ready: 'ready'
} as const;
const AGENT_VERB = {
  needs_input: 'waiting',
  plan_ready: 'done'
} as const;
function UltraplanSessionDetail(t0) {
  const $ = _c(70);
  const {
    session,
    onDone,
    onBack,
    onKill
  } = t0;
  const running = session.status === "running" || session.status === "pending";
  const phase = session.ultraplanPhase;
  const statusText = running ? phase ? PHASE_LABEL[phase] : "running" : session.status;
  const elapsedTime = useElapsedTime(session.startTime, running, 1000, 0, session.endTime);
  let spawns = 0;
  let calls = 0;
  let lastBlock = null;
  for (const msg of session.log) {
    if (msg.type !== "assistant") {
      continue;
    }
    for (const block of msg.message.content) {
      if (block.type !== "tool_use") {
        continue;
      }
      calls++;
      lastBlock = block;
      if (block.name === AGENT_TOOL_NAME || block.name === LEGACY_AGENT_TOOL_NAME) {
        spawns++;
      }
    }
  }
  const t1 = 1 + spawns;
  let t2;
  if ($[0] !== lastBlock) {
    t2 = lastBlock ? formatToolUseSummary(lastBlock.name, lastBlock.input) : null;
    $[0] = lastBlock;
    $[1] = t2;
  } else {
    t2 = $[1];
  }
  let t3;
  if ($[2] !== calls || $[3] !== t1 || $[4] !== t2) {
    t3 = {
      agentsWorking: t1,
      toolCalls: calls,
      lastToolCall: t2
    };
    $[2] = calls;
    $[3] = t1;
    $[4] = t2;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  const {
    agentsWorking,
    toolCalls,
    lastToolCall
  } = t3;
  let t4;
  if ($[6] !== session.sessionId) {
    t4 = getRemoteTaskSessionUrl(session.sessionId);
    $[6] = session.sessionId;
    $[7] = t4;
  } else {
    t4 = $[7];
  }
  const sessionUrl = t4;
  let t5;
  if ($[8] !== onBack || $[9] !== onDone) {
    t5 = onBack ?? (() => onDone("Remote session details dismissed", {
      display: "system"
    }));
    $[8] = onBack;
    $[9] = onDone;
    $[10] = t5;
  } else {
    t5 = $[10];
  }
  const goBackOrClose = t5;
  const [confirmingStop, setConfirmingStop] = useState(false);
  if (confirmingStop) {
    let t6;
    if ($[11] === Symbol.for("react.memo_cache_sentinel")) {
      t6 = () => setConfirmingStop(false);
      $[11] = t6;
    } else {
      t6 = $[11];
    }
    let t7;
    if ($[12] === Symbol.for("react.memo_cache_sentinel")) {
      t7 = <Text dimColor={true}>This will terminate the Claude Code on the web session.</Text>;
      $[12] = t7;
    } else {
      t7 = $[12];
    }
    let t8;
    if ($[13] === Symbol.for("react.memo_cache_sentinel")) {
      t8 = {
        label: "Terminate session",
        value: "stop" as const
      };
      $[13] = t8;
    } else {
      t8 = $[13];
    }
    let t9;
    if ($[14] === Symbol.for("react.memo_cache_sentinel")) {
      t9 = [t8, {
        label: "Back",
        value: "back" as const
      }];
      $[14] = t9;
    } else {
      t9 = $[14];
    }
    let t10;
    if ($[15] !== goBackOrClose || $[16] !== onKill) {
      t10 = <Dialog title="Stop ultraplan?" onCancel={t6} color="background"><Box flexDirection="column" gap={1}>{t7}<Select options={t9} onChange={v => {
            if (v === "stop") {
              onKill?.();
              goBackOrClose();
            } else {
              setConfirmingStop(false);
            }
          }} /></Box></Dialog>;
      $[15] = goBackOrClose;
      $[16] = onKill;
      $[17] = t10;
    } else {
      t10 = $[17];
    }
    return t10;
  }
  const t6 = phase === "plan_ready" ? DIAMOND_FILLED : DIAMOND_OPEN;
  let t7;
  if ($[18] !== t6) {
    t7 = <Text color="background">{t6}{" "}</Text>;
    $[18] = t6;
    $[19] = t7;
  } else {
    t7 = $[19];
  }
  let t8;
  if ($[20] === Symbol.for("react.memo_cache_sentinel")) {
    t8 = <Text bold={true}>ultraplan</Text>;
    $[20] = t8;
  } else {
    t8 = $[20];
  }
  let t9;
  if ($[21] !== elapsedTime || $[22] !== statusText) {
    t9 = <Text dimColor={true}>{" \xB7 "}{elapsedTime}{" \xB7 "}{statusText}</Text>;
    $[21] = elapsedTime;
    $[22] = statusText;
    $[23] = t9;
  } else {
    t9 = $[23];
  }
  let t10;
  if ($[24] !== t7 || $[25] !== t9) {
    t10 = <Text>{t7}{t8}{t9}</Text>;
    $[24] = t7;
    $[25] = t9;
    $[26] = t10;
  } else {
    t10 = $[26];
  }
  let t11;
  if ($[27] !== phase) {
    t11 = phase === "plan_ready" && <Text color="success">{figures.tick} </Text>;
    $[27] = phase;
    $[28] = t11;
  } else {
    t11 = $[28];
  }
  let t12;
  if ($[29] !== agentsWorking) {
    t12 = plural(agentsWorking, "agent");
    $[29] = agentsWorking;
    $[30] = t12;
  } else {
    t12 = $[30];
  }
  const t13 = phase ? AGENT_VERB[phase] : "working";
  let t14;
  if ($[31] !== toolCalls) {
    t14 = plural(toolCalls, "call");
    $[31] = toolCalls;
    $[32] = t14;
  } else {
    t14 = $[32];
  }
  let t15;
  if ($[33] !== agentsWorking || $[34] !== t11 || $[35] !== t12 || $[36] !== t13 || $[37] !== t14 || $[38] !== toolCalls) {
    t15 = <Text>{t11}{agentsWorking} {t12}{" "}{t13} · {toolCalls} tool{" "}{t14}</Text>;
    $[33] = agentsWorking;
    $[34] = t11;
    $[35] = t12;
    $[36] = t13;
    $[37] = t14;
    $[38] = toolCalls;
    $[39] = t15;
  } else {
    t15 = $[39];
  }
  let t16;
  if ($[40] !== lastToolCall) {
    t16 = lastToolCall && <Text dimColor={true}>{lastToolCall}</Text>;
    $[40] = lastToolCall;
    $[41] = t16;
  } else {
    t16 = $[41];
  }
  let t17;
  if ($[42] !== sessionUrl) {
    t17 = <Text dimColor={true}>{sessionUrl}</Text>;
    $[42] = sessionUrl;
    $[43] = t17;
  } else {
    t17 = $[43];
  }
  let t18;
  if ($[44] !== sessionUrl || $[45] !== t17) {
    t18 = <Link url={sessionUrl}>{t17}</Link>;
    $[44] = sessionUrl;
    $[45] = t17;
    $[46] = t18;
  } else {
    t18 = $[46];
  }
  let t19;
  if ($[47] === Symbol.for("react.memo_cache_sentinel")) {
    t19 = {
      label: "Review in Claude Code on the web",
      value: "open" as const
    };
    $[47] = t19;
  } else {
    t19 = $[47];
  }
  let t20;
  if ($[48] !== onKill || $[49] !== running) {
    t20 = onKill && running ? [{
      label: "Stop ultraplan",
      value: "stop" as const
    }] : [];
    $[48] = onKill;
    $[49] = running;
    $[50] = t20;
  } else {
    t20 = $[50];
  }
  let t21;
  if ($[51] === Symbol.for("react.memo_cache_sentinel")) {
    t21 = {
      label: "Back",
      value: "back" as const
    };
    $[51] = t21;
  } else {
    t21 = $[51];
  }
  let t22;
  if ($[52] !== t20) {
    t22 = [t19, ...t20, t21];
    $[52] = t20;
    $[53] = t22;
  } else {
    t22 = $[53];
  }
  let t23;
  if ($[54] !== goBackOrClose || $[55] !== onDone || $[56] !== sessionUrl) {
    t23 = v_0 => {
      switch (v_0) {
        case "open":
          {
            openBrowser(sessionUrl);
            onDone();
            return;
          }
        case "stop":
          {
            setConfirmingStop(true);
            return;
          }
        case "back":
          {
            goBackOrClose();
            return;
          }
      }
    };
    $[54] = goBackOrClose;
    $[55] = onDone;
    $[56] = sessionUrl;
    $[57] = t23;
  } else {
    t23 = $[57];
  }
  let t24;
  if ($[58] !== t22 || $[59] !== t23) {
    t24 = <Select options={t22} onChange={t23} />;
    $[58] = t22;
    $[59] = t23;
    $[60] = t24;
  } else {
    t24 = $[60];
  }
  let t25;
  if ($[61] !== t15 || $[62] !== t16 || $[63] !== t18 || $[64] !== t24) {
    t25 = <Box flexDirection="column" gap={1}>{t15}{t16}{t18}{t24}</Box>;
    $[61] = t15;
    $[62] = t16;
    $[63] = t18;
    $[64] = t24;
    $[65] = t25;
  } else {
    t25 = $[65];
  }
  let t26;
  if ($[66] !== goBackOrClose || $[67] !== t10 || $[68] !== t25) {
    t26 = <Dialog title={t10} onCancel={goBackOrClose} color="background">{t25}</Dialog>;
    $[66] = goBackOrClose;
    $[67] = t10;
    $[68] = t25;
    $[69] = t26;
  } else {
    t26 = $[69];
  }
  return t26;
}
const STAGES = ['finding', 'verifying', 'synthesizing'] as const;
const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  finding: 'Find',
  verifying: 'Verify',
  synthesizing: 'Dedupe'
};

// Setup → Find → Verify → Dedupe pipeline. Current stage in cloud teal,
// rest dim. When completed, all stages dim with a trailing green ✓. The
// "Setup" label shows before the orchestrator writes its first progress
// snapshot (container boot + repo clone), so the 0-found display doesn't
// look like a hung finder.
function StagePipeline(t0) {
  const $ = _c(15);
  const {
    stage,
    completed,
    hasProgress
  } = t0;
  let t1;
  if ($[0] !== stage) {
    t1 = stage ? STAGES.indexOf(stage) : -1;
    $[0] = stage;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const currentIdx = t1;
  const inSetup = !completed && !hasProgress;
  let t2;
  if ($[2] !== inSetup) {
    t2 = inSetup ? <Text color="background">Setup</Text> : <Text dimColor={true}>Setup</Text>;
    $[2] = inSetup;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  let t3;
  if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = <Text dimColor={true}> → </Text>;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  let t4;
  if ($[5] !== completed || $[6] !== currentIdx || $[7] !== inSetup) {
    t4 = STAGES.map((s, i) => {
      const isCurrent = !completed && !inSetup && i === currentIdx;
      return <React.Fragment key={s}>{i > 0 && <Text dimColor={true}> → </Text>}{isCurrent ? <Text color="background">{STAGE_LABELS[s]}</Text> : <Text dimColor={true}>{STAGE_LABELS[s]}</Text>}</React.Fragment>;
    });
    $[5] = completed;
    $[6] = currentIdx;
    $[7] = inSetup;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  let t5;
  if ($[9] !== completed) {
    t5 = completed && <Text color="success"> ✓</Text>;
    $[9] = completed;
    $[10] = t5;
  } else {
    t5 = $[10];
  }
  let t6;
  if ($[11] !== t2 || $[12] !== t4 || $[13] !== t5) {
    t6 = <Text>{t2}{t3}{t4}{t5}</Text>;
    $[11] = t2;
    $[12] = t4;
    $[13] = t5;
    $[14] = t6;
  } else {
    t6 = $[14];
  }
  return t6;
}

// Stage-appropriate counts line. Running-state formatting delegates to
// formatReviewStageCounts (shared with the pill) so the two views can't
// drift; completed state is dialog-specific (findings summary).
function reviewCountsLine(session: DeepImmutable<RemoteAgentTaskState>): string {
  const p = session.reviewProgress;
  // No progress data — the orchestrator never wrote a snapshot. Don't
  // claim "0 findings" when completed; we just don't know.
  if (!p) return session.status === 'completed' ? 'done' : 'setting up';
  const verified = p.bugsVerified;
  const refuted = p.bugsRefuted ?? 0;
  if (session.status === 'completed') {
    const parts = [`${verified} ${plural(verified, 'finding')}`];
    if (refuted > 0) parts.push(`${refuted} refuted`);
    return parts.join(' · ');
  }
  return formatReviewStageCounts(p.stage, p.bugsFound, verified, refuted);
}
type MenuAction = 'open' | 'stop' | 'back' | 'dismiss';
function ReviewSessionDetail(t0) {
  const $ = _c(56);
  const {
    session,
    onDone,
    onBack,
    onKill
  } = t0;
  const completed = session.status === "completed";
  const running = session.status === "running" || session.status === "pending";
  const [confirmingStop, setConfirmingStop] = useState(false);
  const elapsedTime = useElapsedTime(session.startTime, running, 1000, 0, session.endTime);
  let t1;
  if ($[0] !== onDone) {
    t1 = () => onDone("Remote session details dismissed", {
      display: "system"
    });
    $[0] = onDone;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const handleClose = t1;
  const goBackOrClose = onBack ?? handleClose;
  let t2;
  if ($[2] !== session.sessionId) {
    t2 = getRemoteTaskSessionUrl(session.sessionId);
    $[2] = session.sessionId;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  const sessionUrl = t2;
  const statusLabel = completed ? "ready" : running ? "running" : session.status;
  if (confirmingStop) {
    let t3;
    if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
      t3 = () => setConfirmingStop(false);
      $[4] = t3;
    } else {
      t3 = $[4];
    }
    let t4;
    if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
      t4 = <Text dimColor={true}>This archives the remote session and stops local tracking. The review will not complete and any findings so far are discarded.</Text>;
      $[5] = t4;
    } else {
      t4 = $[5];
    }
    let t5;
    if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
      t5 = {
        label: "Stop ultrareview",
        value: "stop" as const
      };
      $[6] = t5;
    } else {
      t5 = $[6];
    }
    let t6;
    if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
      t6 = [t5, {
        label: "Back",
        value: "back" as const
      }];
      $[7] = t6;
    } else {
      t6 = $[7];
    }
    let t7;
    if ($[8] !== goBackOrClose || $[9] !== onKill) {
      t7 = <Dialog title="Stop ultrareview?" onCancel={t3} color="background"><Box flexDirection="column" gap={1}>{t4}<Select options={t6} onChange={v => {
            if (v === "stop") {
              onKill?.();
              goBackOrClose();
            } else {
              setConfirmingStop(false);
            }
          }} /></Box></Dialog>;
      $[8] = goBackOrClose;
      $[9] = onKill;
      $[10] = t7;
    } else {
      t7 = $[10];
    }
    return t7;
  }
  let t3;
  if ($[11] !== completed || $[12] !== onKill || $[13] !== running) {
    t3 = completed ? [{
      label: "Open in Claude Code on the web",
      value: "open"
    }, {
      label: "Dismiss",
      value: "dismiss"
    }] : [{
      label: "Open in Claude Code on the web",
      value: "open"
    }, ...(onKill && running ? [{
      label: "Stop ultrareview",
      value: "stop" as const
    }] : []), {
      label: "Back",
      value: "back"
    }];
    $[11] = completed;
    $[12] = onKill;
    $[13] = running;
    $[14] = t3;
  } else {
    t3 = $[14];
  }
  const options = t3;
  let t4;
  if ($[15] !== goBackOrClose || $[16] !== handleClose || $[17] !== onDone || $[18] !== sessionUrl) {
    t4 = action => {
      bb45: switch (action) {
        case "open":
          {
            openBrowser(sessionUrl);
            onDone();
            break bb45;
          }
        case "stop":
          {
            setConfirmingStop(true);
            break bb45;
          }
        case "back":
          {
            goBackOrClose();
            break bb45;
          }
        case "dismiss":
          {
            handleClose();
          }
      }
    };
    $[15] = goBackOrClose;
    $[16] = handleClose;
    $[17] = onDone;
    $[18] = sessionUrl;
    $[19] = t4;
  } else {
    t4 = $[19];
  }
  const handleSelect = t4;
  const t5 = completed ? DIAMOND_FILLED : DIAMOND_OPEN;
  let t6;
  if ($[20] !== t5) {
    t6 = <Text color="background">{t5}{" "}</Text>;
    $[20] = t5;
    $[21] = t6;
  } else {
    t6 = $[21];
  }
  let t7;
  if ($[22] === Symbol.for("react.memo_cache_sentinel")) {
    t7 = <Text bold={true}>ultrareview</Text>;
    $[22] = t7;
  } else {
    t7 = $[22];
  }
  let t8;
  if ($[23] !== elapsedTime || $[24] !== statusLabel) {
    t8 = <Text dimColor={true}>{" \xB7 "}{elapsedTime}{" \xB7 "}{statusLabel}</Text>;
    $[23] = elapsedTime;
    $[24] = statusLabel;
    $[25] = t8;
  } else {
    t8 = $[25];
  }
  let t9;
  if ($[26] !== t6 || $[27] !== t8) {
    t9 = <Text>{t6}{t7}{t8}</Text>;
    $[26] = t6;
    $[27] = t8;
    $[28] = t9;
  } else {
    t9 = $[28];
  }
  const t10 = session.reviewProgress?.stage;
  const t11 = !!session.reviewProgress;
  let t12;
  if ($[29] !== completed || $[30] !== t10 || $[31] !== t11) {
    t12 = <StagePipeline stage={t10} completed={completed} hasProgress={t11} />;
    $[29] = completed;
    $[30] = t10;
    $[31] = t11;
    $[32] = t12;
  } else {
    t12 = $[32];
  }
  let t13;
  if ($[33] !== session) {
    t13 = reviewCountsLine(session);
    $[33] = session;
    $[34] = t13;
  } else {
    t13 = $[34];
  }
  let t14;
  if ($[35] !== t13) {
    t14 = <Text>{t13}</Text>;
    $[35] = t13;
    $[36] = t14;
  } else {
    t14 = $[36];
  }
  let t15;
  if ($[37] !== sessionUrl) {
    t15 = <Text dimColor={true}>{sessionUrl}</Text>;
    $[37] = sessionUrl;
    $[38] = t15;
  } else {
    t15 = $[38];
  }
  let t16;
  if ($[39] !== sessionUrl || $[40] !== t15) {
    t16 = <Link url={sessionUrl}>{t15}</Link>;
    $[39] = sessionUrl;
    $[40] = t15;
    $[41] = t16;
  } else {
    t16 = $[41];
  }
  let t17;
  if ($[42] !== t14 || $[43] !== t16) {
    t17 = <Box flexDirection="column">{t14}{t16}</Box>;
    $[42] = t14;
    $[43] = t16;
    $[44] = t17;
  } else {
    t17 = $[44];
  }
  let t18;
  if ($[45] !== handleSelect || $[46] !== options) {
    t18 = <Select options={options} onChange={handleSelect} />;
    $[45] = handleSelect;
    $[46] = options;
    $[47] = t18;
  } else {
    t18 = $[47];
  }
  let t19;
  if ($[48] !== t12 || $[49] !== t17 || $[50] !== t18) {
    t19 = <Box flexDirection="column" gap={1}>{t12}{t17}{t18}</Box>;
    $[48] = t12;
    $[49] = t17;
    $[50] = t18;
    $[51] = t19;
  } else {
    t19 = $[51];
  }
  let t20;
  if ($[52] !== goBackOrClose || $[53] !== t19 || $[54] !== t9) {
    t20 = <Dialog title={t9} onCancel={goBackOrClose} color="background" inputGuide={_temp}>{t19}</Dialog>;
    $[52] = goBackOrClose;
    $[53] = t19;
    $[54] = t9;
    $[55] = t20;
  } else {
    t20 = $[55];
  }
  return t20;
}
function _temp(exitState) {
  return exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline><KeyboardShortcutHint shortcut="Enter" action="select" /><KeyboardShortcutHint shortcut="Esc" action="go back" /></Byline>;
}
export function RemoteSessionDetailDialog({
  session,
  toolUseContext,
  onDone,
  onBack,
  onKill
}: Props): React.ReactNode {
  const [isTeleporting, setIsTeleporting] = useState(false);
  const [teleportError, setTeleportError] = useState<string | null>(null);

  // Get last few messages from remote session for display.
  // Scan all messages (not just the last 3 raw entries) because the tail of
  // the log is often thinking-only blocks that normalise to 'progress' type.
  // Placed before the early returns so hook call order is stable (Rules of Hooks).
  // Ultraplan/review sessions never read this — skip the normalize work for them.
  const lastMessages = useMemo(() => {
    if (session.isUltraplan || session.isRemoteReview) return [];
    return normalizeMessages(toInternalMessages(session.log as SDKMessage[])).filter(_ => _.type !== 'progress').slice(-3);
  }, [session]);
  if (session.isUltraplan) {
    return <UltraplanSessionDetail session={session} onDone={onDone} onBack={onBack} onKill={onKill} />;
  }

  // Review sessions get the stage-pipeline view; everything else keeps the
  // generic label/value + recent-messages dialog below.
  if (session.isRemoteReview) {
    return <ReviewSessionDetail session={session} onDone={onDone} onBack={onBack} onKill={onKill} />;
  }
  const handleClose = () => onDone('Remote session details dismissed', {
    display: 'system'
  });

  // Component-specific shortcuts shown in UI hints (t=teleport, space=dismiss,
  // left=back). These are state-dependent actions, not standard dialog keybindings.
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      onDone('Remote session details dismissed', {
        display: 'system'
      });
    } else if (e.key === 'left' && onBack) {
      e.preventDefault();
      onBack();
    } else if (e.key === 't' && !isTeleporting) {
      e.preventDefault();
      void handleTeleport();
    } else if (e.key === 'return') {
      e.preventDefault();
      handleClose();
    }
  };

  // Handle teleporting to remote session
  async function handleTeleport(): Promise<void> {
    setIsTeleporting(true);
    setTeleportError(null);
    try {
      await teleportResumeCodeSession(session.sessionId);
    } catch (err) {
      setTeleportError(errorMessage(err));
    } finally {
      setIsTeleporting(false);
    }
  }

  // Truncate title if too long (for display purposes)
  const displayTitle = truncateToWidth(session.title, 50);

  // Map TaskStatus to display status (handle 'pending')
  const displayStatus = session.status === 'pending' ? 'starting' : session.status;
  return <Box flexDirection="column" tabIndex={0} autoFocus onKeyDown={handleKeyDown}>
      <Dialog title="Remote session details" onCancel={handleClose} color="background" inputGuide={exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline>
              {onBack && <KeyboardShortcutHint shortcut="←" action="go back" />}
              <KeyboardShortcutHint shortcut="Esc/Enter/Space" action="close" />
              {!isTeleporting && <KeyboardShortcutHint shortcut="t" action="teleport" />}
            </Byline>}>
        <Box flexDirection="column">
          <Text>
            <Text bold>Status</Text>:{' '}
            {displayStatus === 'running' || displayStatus === 'starting' ? <Text color="background">{displayStatus}</Text> : displayStatus === 'completed' ? <Text color="success">{displayStatus}</Text> : <Text color="error">{displayStatus}</Text>}
          </Text>
          <Text>
            <Text bold>Runtime</Text>:{' '}
            {formatDuration((session.endTime ?? Date.now()) - session.startTime)}
          </Text>
          <Text wrap="truncate-end">
            <Text bold>Title</Text>: {displayTitle}
          </Text>
          <Text>
            <Text bold>Progress</Text>:{' '}
            <RemoteSessionProgress session={session} />
          </Text>
          <Text>
            <Text bold>Session URL</Text>:{' '}
            <Link url={getRemoteTaskSessionUrl(session.sessionId)}>
              <Text dimColor>{getRemoteTaskSessionUrl(session.sessionId)}</Text>
            </Link>
          </Text>
        </Box>

        {/* Remote session messages section */}
        {session.log.length > 0 && <Box flexDirection="column" marginTop={1}>
            <Text>
              <Text bold>Recent messages</Text>:
            </Text>
            <Box flexDirection="column" height={10} overflowY="hidden">
              {lastMessages.map((msg, i) => <Message key={i} message={msg} lookups={EMPTY_LOOKUPS} addMargin={i > 0} tools={toolUseContext.options.tools} commands={toolUseContext.options.commands} verbose={toolUseContext.options.verbose} inProgressToolUseIDs={new Set()} progressMessagesForMessage={[]} shouldAnimate={false} shouldShowDot={false} style="condensed" isTranscriptMode={false} isStatic={true} />)}
            </Box>
            <Box marginTop={1}>
              <Text dimColor italic>
                Showing last {lastMessages.length} of {session.log.length}{' '}
                messages
              </Text>
            </Box>
          </Box>}

        {/* Teleport error message */}
        {teleportError && <Box marginTop={1}>
            <Text color="error">Teleport failed: {teleportError}</Text>
          </Box>}

        {/* Teleporting status */}
        {isTeleporting && <Text color="background">Teleporting to session…</Text>}
      </Dialog>
    </Box>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VNZW1vIiwidXNlU3RhdGUiLCJTREtNZXNzYWdlIiwiVG9vbFVzZUNvbnRleHQiLCJEZWVwSW1tdXRhYmxlIiwiQ29tbWFuZFJlc3VsdERpc3BsYXkiLCJESUFNT05EX0ZJTExFRCIsIkRJQU1PTkRfT1BFTiIsInVzZUVsYXBzZWRUaW1lIiwiS2V5Ym9hcmRFdmVudCIsIkJveCIsIkxpbmsiLCJUZXh0IiwiUmVtb3RlQWdlbnRUYXNrU3RhdGUiLCJnZXRSZW1vdGVUYXNrU2Vzc2lvblVybCIsIkFHRU5UX1RPT0xfTkFNRSIsIkxFR0FDWV9BR0VOVF9UT09MX05BTUUiLCJBU0tfVVNFUl9RVUVTVElPTl9UT09MX05BTUUiLCJFWElUX1BMQU5fTU9ERV9WMl9UT09MX05BTUUiLCJvcGVuQnJvd3NlciIsImVycm9yTWVzc2FnZSIsImZvcm1hdER1cmF0aW9uIiwidHJ1bmNhdGVUb1dpZHRoIiwidG9JbnRlcm5hbE1lc3NhZ2VzIiwiRU1QVFlfTE9PS1VQUyIsIm5vcm1hbGl6ZU1lc3NhZ2VzIiwicGx1cmFsIiwidGVsZXBvcnRSZXN1bWVDb2RlU2Vzc2lvbiIsIlNlbGVjdCIsIkJ5bGluZSIsIkRpYWxvZyIsIktleWJvYXJkU2hvcnRjdXRIaW50IiwiTWVzc2FnZSIsImZvcm1hdFJldmlld1N0YWdlQ291bnRzIiwiUmVtb3RlU2Vzc2lvblByb2dyZXNzIiwiUHJvcHMiLCJzZXNzaW9uIiwidG9vbFVzZUNvbnRleHQiLCJvbkRvbmUiLCJyZXN1bHQiLCJvcHRpb25zIiwiZGlzcGxheSIsIm9uQmFjayIsIm9uS2lsbCIsImZvcm1hdFRvb2xVc2VTdW1tYXJ5IiwibmFtZSIsImlucHV0IiwicXMiLCJxdWVzdGlvbnMiLCJBcnJheSIsImlzQXJyYXkiLCJxIiwicXVlc3Rpb24iLCJoZWFkZXIiLCJvbmVMaW5lIiwicmVwbGFjZSIsInRyaW0iLCJ2IiwiT2JqZWN0IiwidmFsdWVzIiwiUEhBU0VfTEFCRUwiLCJuZWVkc19pbnB1dCIsInBsYW5fcmVhZHkiLCJjb25zdCIsIkFHRU5UX1ZFUkIiLCJVbHRyYXBsYW5TZXNzaW9uRGV0YWlsIiwidDAiLCIkIiwiX2MiLCJydW5uaW5nIiwic3RhdHVzIiwicGhhc2UiLCJ1bHRyYXBsYW5QaGFzZSIsInN0YXR1c1RleHQiLCJlbGFwc2VkVGltZSIsInN0YXJ0VGltZSIsImVuZFRpbWUiLCJzcGF3bnMiLCJjYWxscyIsImxhc3RCbG9jayIsIm1zZyIsImxvZyIsInR5cGUiLCJibG9jayIsIm1lc3NhZ2UiLCJjb250ZW50IiwidDEiLCJ0MiIsInQzIiwiYWdlbnRzV29ya2luZyIsInRvb2xDYWxscyIsImxhc3RUb29sQ2FsbCIsInQ0Iiwic2Vzc2lvbklkIiwic2Vzc2lvblVybCIsInQ1IiwiZ29CYWNrT3JDbG9zZSIsImNvbmZpcm1pbmdTdG9wIiwic2V0Q29uZmlybWluZ1N0b3AiLCJ0NiIsIlN5bWJvbCIsImZvciIsInQ3IiwidDgiLCJsYWJlbCIsInZhbHVlIiwidDkiLCJ0MTAiLCJ0MTEiLCJ0aWNrIiwidDEyIiwidDEzIiwidDE0IiwidDE1IiwidDE2IiwidDE3IiwidDE4IiwidDE5IiwidDIwIiwidDIxIiwidDIyIiwidDIzIiwidl8wIiwidDI0IiwidDI1IiwidDI2IiwiU1RBR0VTIiwiU1RBR0VfTEFCRUxTIiwiUmVjb3JkIiwiZmluZGluZyIsInZlcmlmeWluZyIsInN5bnRoZXNpemluZyIsIlN0YWdlUGlwZWxpbmUiLCJzdGFnZSIsImNvbXBsZXRlZCIsImhhc1Byb2dyZXNzIiwiaW5kZXhPZiIsImN1cnJlbnRJZHgiLCJpblNldHVwIiwibWFwIiwicyIsImkiLCJpc0N1cnJlbnQiLCJyZXZpZXdDb3VudHNMaW5lIiwicCIsInJldmlld1Byb2dyZXNzIiwidmVyaWZpZWQiLCJidWdzVmVyaWZpZWQiLCJyZWZ1dGVkIiwiYnVnc1JlZnV0ZWQiLCJwYXJ0cyIsInB1c2giLCJqb2luIiwiYnVnc0ZvdW5kIiwiTWVudUFjdGlvbiIsIlJldmlld1Nlc3Npb25EZXRhaWwiLCJoYW5kbGVDbG9zZSIsInN0YXR1c0xhYmVsIiwiYWN0aW9uIiwiYmI0NSIsImhhbmRsZVNlbGVjdCIsIl90ZW1wIiwiZXhpdFN0YXRlIiwicGVuZGluZyIsImtleU5hbWUiLCJSZW1vdGVTZXNzaW9uRGV0YWlsRGlhbG9nIiwiUmVhY3ROb2RlIiwiaXNUZWxlcG9ydGluZyIsInNldElzVGVsZXBvcnRpbmciLCJ0ZWxlcG9ydEVycm9yIiwic2V0VGVsZXBvcnRFcnJvciIsImxhc3RNZXNzYWdlcyIsImlzVWx0cmFwbGFuIiwiaXNSZW1vdGVSZXZpZXciLCJmaWx0ZXIiLCJfIiwic2xpY2UiLCJoYW5kbGVLZXlEb3duIiwiZSIsImtleSIsInByZXZlbnREZWZhdWx0IiwiaGFuZGxlVGVsZXBvcnQiLCJQcm9taXNlIiwiZXJyIiwiZGlzcGxheVRpdGxlIiwidGl0bGUiLCJkaXNwbGF5U3RhdHVzIiwiRGF0ZSIsIm5vdyIsImxlbmd0aCIsInRvb2xzIiwiY29tbWFuZHMiLCJ2ZXJib3NlIiwiU2V0Il0sInNvdXJjZXMiOlsiUmVtb3RlU2Vzc2lvbkRldGFpbERpYWxvZy50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCBSZWFjdCwgeyB1c2VNZW1vLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHR5cGUgeyBTREtNZXNzYWdlIH0gZnJvbSAnc3JjL2VudHJ5cG9pbnRzL2FnZW50U2RrVHlwZXMuanMnXG5pbXBvcnQgdHlwZSB7IFRvb2xVc2VDb250ZXh0IH0gZnJvbSAnc3JjL1Rvb2wuanMnXG5pbXBvcnQgdHlwZSB7IERlZXBJbW11dGFibGUgfSBmcm9tICdzcmMvdHlwZXMvdXRpbHMuanMnXG5pbXBvcnQgdHlwZSB7IENvbW1hbmRSZXN1bHREaXNwbGF5IH0gZnJvbSAnLi4vLi4vY29tbWFuZHMuanMnXG5pbXBvcnQgeyBESUFNT05EX0ZJTExFRCwgRElBTU9ORF9PUEVOIH0gZnJvbSAnLi4vLi4vY29uc3RhbnRzL2ZpZ3VyZXMuanMnXG5pbXBvcnQgeyB1c2VFbGFwc2VkVGltZSB9IGZyb20gJy4uLy4uL2hvb2tzL3VzZUVsYXBzZWRUaW1lLmpzJ1xuaW1wb3J0IHR5cGUgeyBLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vaW5rL2V2ZW50cy9rZXlib2FyZC1ldmVudC5qcydcbmltcG9ydCB7IEJveCwgTGluaywgVGV4dCB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB0eXBlIHsgUmVtb3RlQWdlbnRUYXNrU3RhdGUgfSBmcm9tICcuLi8uLi90YXNrcy9SZW1vdGVBZ2VudFRhc2svUmVtb3RlQWdlbnRUYXNrLmpzJ1xuaW1wb3J0IHsgZ2V0UmVtb3RlVGFza1Nlc3Npb25VcmwgfSBmcm9tICcuLi8uLi90YXNrcy9SZW1vdGVBZ2VudFRhc2svUmVtb3RlQWdlbnRUYXNrLmpzJ1xuaW1wb3J0IHtcbiAgQUdFTlRfVE9PTF9OQU1FLFxuICBMRUdBQ1lfQUdFTlRfVE9PTF9OQU1FLFxufSBmcm9tICcuLi8uLi90b29scy9BZ2VudFRvb2wvY29uc3RhbnRzLmpzJ1xuaW1wb3J0IHsgQVNLX1VTRVJfUVVFU1RJT05fVE9PTF9OQU1FIH0gZnJvbSAnLi4vLi4vdG9vbHMvQXNrVXNlclF1ZXN0aW9uVG9vbC9wcm9tcHQuanMnXG5pbXBvcnQgeyBFWElUX1BMQU5fTU9ERV9WMl9UT09MX05BTUUgfSBmcm9tICcuLi8uLi90b29scy9FeGl0UGxhbk1vZGVUb29sL2NvbnN0YW50cy5qcydcbmltcG9ydCB7IG9wZW5Ccm93c2VyIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnJvd3Nlci5qcydcbmltcG9ydCB7IGVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9ycy5qcydcbmltcG9ydCB7IGZvcm1hdER1cmF0aW9uLCB0cnVuY2F0ZVRvV2lkdGggfSBmcm9tICcuLi8uLi91dGlscy9mb3JtYXQuanMnXG5pbXBvcnQgeyB0b0ludGVybmFsTWVzc2FnZXMgfSBmcm9tICcuLi8uLi91dGlscy9tZXNzYWdlcy9tYXBwZXJzLmpzJ1xuaW1wb3J0IHsgRU1QVFlfTE9PS1VQUywgbm9ybWFsaXplTWVzc2FnZXMgfSBmcm9tICcuLi8uLi91dGlscy9tZXNzYWdlcy5qcydcbmltcG9ydCB7IHBsdXJhbCB9IGZyb20gJy4uLy4uL3V0aWxzL3N0cmluZ1V0aWxzLmpzJ1xuaW1wb3J0IHsgdGVsZXBvcnRSZXN1bWVDb2RlU2Vzc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3RlbGVwb3J0LmpzJ1xuaW1wb3J0IHsgU2VsZWN0IH0gZnJvbSAnLi4vQ3VzdG9tU2VsZWN0L3NlbGVjdC5qcydcbmltcG9ydCB7IEJ5bGluZSB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vQnlsaW5lLmpzJ1xuaW1wb3J0IHsgRGlhbG9nIH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9EaWFsb2cuanMnXG5pbXBvcnQgeyBLZXlib2FyZFNob3J0Y3V0SGludCB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vS2V5Ym9hcmRTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQgeyBNZXNzYWdlIH0gZnJvbSAnLi4vTWVzc2FnZS5qcydcbmltcG9ydCB7XG4gIGZvcm1hdFJldmlld1N0YWdlQ291bnRzLFxuICBSZW1vdGVTZXNzaW9uUHJvZ3Jlc3MsXG59IGZyb20gJy4vUmVtb3RlU2Vzc2lvblByb2dyZXNzLmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICBzZXNzaW9uOiBEZWVwSW1tdXRhYmxlPFJlbW90ZUFnZW50VGFza1N0YXRlPlxuICB0b29sVXNlQ29udGV4dDogVG9vbFVzZUNvbnRleHRcbiAgb25Eb25lOiAoXG4gICAgcmVzdWx0Pzogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiB7IGRpc3BsYXk/OiBDb21tYW5kUmVzdWx0RGlzcGxheSB9LFxuICApID0+IHZvaWRcbiAgb25CYWNrPzogKCkgPT4gdm9pZFxuICBvbktpbGw/OiAoKSA9PiB2b2lkXG59XG5cbi8vIENvbXBhY3Qgb25lLWxpbmUgc3VtbWFyeTogdG9vbCBuYW1lICsgZmlyc3QgbWVhbmluZ2Z1bCBzdHJpbmcgYXJnLlxuLy8gTGlnaHRlciB0aGFuIHRvb2wucmVuZGVyVG9vbFVzZU1lc3NhZ2UgKG5vIHJlZ2lzdHJ5IGxvb2t1cCAvIHNjaGVtYSBwYXJzZSkuXG4vLyBDb2xsYXBzZXMgd2hpdGVzcGFjZSBzbyBtdWx0aS1saW5lIGlucHV0cyAoZS5nLiBCYXNoIGNvbW1hbmQgdGV4dClcbi8vIHJlbmRlciBvbiBvbmUgbGluZS5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRUb29sVXNlU3VtbWFyeShuYW1lOiBzdHJpbmcsIGlucHV0OiB1bmtub3duKTogc3RyaW5nIHtcbiAgLy8gcGxhbl9yZWFkeSBwaGFzZSBpcyBvbmx5IHJlYWNoZWQgdmlhIEV4aXRQbGFuTW9kZSB0b29sXG4gIGlmIChuYW1lID09PSBFWElUX1BMQU5fTU9ERV9WMl9UT09MX05BTUUpIHtcbiAgICByZXR1cm4gJ1JldmlldyB0aGUgcGxhbiBpbiBDbGF1ZGUgQ29kZSBvbiB0aGUgd2ViJ1xuICB9XG4gIGlmICghaW5wdXQgfHwgdHlwZW9mIGlucHV0ICE9PSAnb2JqZWN0JykgcmV0dXJuIG5hbWVcbiAgLy8gQXNrVXNlclF1ZXN0aW9uOiBzaG93IHRoZSBxdWVzdGlvbiB0ZXh0IGFzIGEgQ1RBLCBub3QgdGhlIHRvb2wgbmFtZS5cbiAgLy8gSW5wdXQgc2hhcGUgaXMge3F1ZXN0aW9uczogW3txdWVzdGlvbiwgaGVhZGVyLCBvcHRpb25zfV19LlxuICBpZiAobmFtZSA9PT0gQVNLX1VTRVJfUVVFU1RJT05fVE9PTF9OQU1FICYmICdxdWVzdGlvbnMnIGluIGlucHV0KSB7XG4gICAgY29uc3QgcXMgPSBpbnB1dC5xdWVzdGlvbnNcbiAgICBpZiAoQXJyYXkuaXNBcnJheShxcykgJiYgcXNbMF0gJiYgdHlwZW9mIHFzWzBdID09PSAnb2JqZWN0Jykge1xuICAgICAgLy8gUHJlZmVyIHF1ZXN0aW9uIChmdWxsIHRleHQpIG92ZXIgaGVhZGVyIChtYXgtMTItY2hhciB0YWcpLiBoZWFkZXJcbiAgICAgIC8vIGlzIGEgcmVxdWlyZWQgc2NoZW1hIGZpZWxkIHNvIGNoZWNraW5nIGl0IGZpcnN0IHdvdWxkIG1ha2UgdGhlXG4gICAgICAvLyBxdWVzdGlvbiBmYWxsYmFjayBkZWFkIGNvZGUuXG4gICAgICBjb25zdCBxID1cbiAgICAgICAgJ3F1ZXN0aW9uJyBpbiBxc1swXSAmJlxuICAgICAgICB0eXBlb2YgcXNbMF0ucXVlc3Rpb24gPT09ICdzdHJpbmcnICYmXG4gICAgICAgIHFzWzBdLnF1ZXN0aW9uXG4gICAgICAgICAgPyBxc1swXS5xdWVzdGlvblxuICAgICAgICAgIDogJ2hlYWRlcicgaW4gcXNbMF0gJiYgdHlwZW9mIHFzWzBdLmhlYWRlciA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgID8gcXNbMF0uaGVhZGVyXG4gICAgICAgICAgICA6IG51bGxcbiAgICAgIGlmIChxKSB7XG4gICAgICAgIGNvbnN0IG9uZUxpbmUgPSBxLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKClcbiAgICAgICAgcmV0dXJuIGBBbnN3ZXIgaW4gYnJvd3NlcjogJHt0cnVuY2F0ZVRvV2lkdGgob25lTGluZSwgNTApfWBcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCB2IG9mIE9iamVjdC52YWx1ZXMoaW5wdXQpKSB7XG4gICAgaWYgKHR5cGVvZiB2ID09PSAnc3RyaW5nJyAmJiB2LnRyaW0oKSkge1xuICAgICAgY29uc3Qgb25lTGluZSA9IHYucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKVxuICAgICAgcmV0dXJuIGAke25hbWV9ICR7dHJ1bmNhdGVUb1dpZHRoKG9uZUxpbmUsIDYwKX1gXG4gICAgfVxuICB9XG4gIHJldHVybiBuYW1lXG59XG5cbmNvbnN0IFBIQVNFX0xBQkVMID0ge1xuICBuZWVkc19pbnB1dDogJ2lucHV0IHJlcXVpcmVkJyxcbiAgcGxhbl9yZWFkeTogJ3JlYWR5Jyxcbn0gYXMgY29uc3RcblxuY29uc3QgQUdFTlRfVkVSQiA9IHtcbiAgbmVlZHNfaW5wdXQ6ICd3YWl0aW5nJyxcbiAgcGxhbl9yZWFkeTogJ2RvbmUnLFxufSBhcyBjb25zdFxuXG5mdW5jdGlvbiBVbHRyYXBsYW5TZXNzaW9uRGV0YWlsKHtcbiAgc2Vzc2lvbixcbiAgb25Eb25lLFxuICBvbkJhY2ssXG4gIG9uS2lsbCxcbn06IE9taXQ8UHJvcHMsICd0b29sVXNlQ29udGV4dCc+KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgcnVubmluZyA9IHNlc3Npb24uc3RhdHVzID09PSAncnVubmluZycgfHwgc2Vzc2lvbi5zdGF0dXMgPT09ICdwZW5kaW5nJ1xuICBjb25zdCBwaGFzZSA9IHNlc3Npb24udWx0cmFwbGFuUGhhc2VcbiAgY29uc3Qgc3RhdHVzVGV4dCA9IHJ1bm5pbmdcbiAgICA/IHBoYXNlXG4gICAgICA/IFBIQVNFX0xBQkVMW3BoYXNlXVxuICAgICAgOiAncnVubmluZydcbiAgICA6IHNlc3Npb24uc3RhdHVzXG4gIGNvbnN0IGVsYXBzZWRUaW1lID0gdXNlRWxhcHNlZFRpbWUoXG4gICAgc2Vzc2lvbi5zdGFydFRpbWUsXG4gICAgcnVubmluZyxcbiAgICAxMDAwLFxuICAgIDAsXG4gICAgc2Vzc2lvbi5lbmRUaW1lLFxuICApXG5cbiAgLy8gQ291bnRzIGFyZSBldmVudHVhbGx5IGNvcnJlY3QgKGxhZyDiiaQgcG9sbCBpbnRlcnZhbCkuIGFnZW50c1dvcmtpbmcgc3RhcnRzXG4gIC8vIGF0IDEgKHRoZSBtYWluIHNlc3Npb24gYWdlbnQpIGFuZCBpbmNyZW1lbnRzIHBlciBzdWJhZ2VudCBzcGF3bi4gdG9vbENhbGxzXG4gIC8vIGlzIG1haW4tc2Vzc2lvbiBvbmx5IOKAlCBzdWJhZ2VudCBjYWxscyBtYXkgbm90IHN1cmZhY2UgaW4gdGhpcyBzdHJlYW0uXG4gIGNvbnN0IHsgYWdlbnRzV29ya2luZywgdG9vbENhbGxzLCBsYXN0VG9vbENhbGwgfSA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGxldCBzcGF3bnMgPSAwXG4gICAgbGV0IGNhbGxzID0gMFxuICAgIGxldCBsYXN0QmxvY2s6IHsgbmFtZTogc3RyaW5nOyBpbnB1dDogdW5rbm93biB9IHwgbnVsbCA9IG51bGxcbiAgICBmb3IgKGNvbnN0IG1zZyBvZiBzZXNzaW9uLmxvZykge1xuICAgICAgaWYgKG1zZy50eXBlICE9PSAnYXNzaXN0YW50JykgY29udGludWVcbiAgICAgIGZvciAoY29uc3QgYmxvY2sgb2YgbXNnLm1lc3NhZ2UuY29udGVudCkge1xuICAgICAgICBpZiAoYmxvY2sudHlwZSAhPT0gJ3Rvb2xfdXNlJykgY29udGludWVcbiAgICAgICAgY2FsbHMrK1xuICAgICAgICBsYXN0QmxvY2sgPSBibG9ja1xuICAgICAgICBpZiAoXG4gICAgICAgICAgYmxvY2submFtZSA9PT0gQUdFTlRfVE9PTF9OQU1FIHx8XG4gICAgICAgICAgYmxvY2submFtZSA9PT0gTEVHQUNZX0FHRU5UX1RPT0xfTkFNRVxuICAgICAgICApIHtcbiAgICAgICAgICBzcGF3bnMrK1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBhZ2VudHNXb3JraW5nOiAxICsgc3Bhd25zLFxuICAgICAgdG9vbENhbGxzOiBjYWxscyxcbiAgICAgIGxhc3RUb29sQ2FsbDogbGFzdEJsb2NrXG4gICAgICAgID8gZm9ybWF0VG9vbFVzZVN1bW1hcnkobGFzdEJsb2NrLm5hbWUsIGxhc3RCbG9jay5pbnB1dClcbiAgICAgICAgOiBudWxsLFxuICAgIH1cbiAgfSwgW3Nlc3Npb24ubG9nXSlcblxuICBjb25zdCBzZXNzaW9uVXJsID0gZ2V0UmVtb3RlVGFza1Nlc3Npb25Vcmwoc2Vzc2lvbi5zZXNzaW9uSWQpXG4gIGNvbnN0IGdvQmFja09yQ2xvc2UgPVxuICAgIG9uQmFjayA/P1xuICAgICgoKSA9PiBvbkRvbmUoJ1JlbW90ZSBzZXNzaW9uIGRldGFpbHMgZGlzbWlzc2VkJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KSlcbiAgY29uc3QgW2NvbmZpcm1pbmdTdG9wLCBzZXRDb25maXJtaW5nU3RvcF0gPSB1c2VTdGF0ZShmYWxzZSlcblxuICBpZiAoY29uZmlybWluZ1N0b3ApIHtcbiAgICByZXR1cm4gKFxuICAgICAgPERpYWxvZ1xuICAgICAgICB0aXRsZT1cIlN0b3AgdWx0cmFwbGFuP1wiXG4gICAgICAgIG9uQ2FuY2VsPXsoKSA9PiBzZXRDb25maXJtaW5nU3RvcChmYWxzZSl9XG4gICAgICAgIGNvbG9yPVwiYmFja2dyb3VuZFwiXG4gICAgICA+XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MX0+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICBUaGlzIHdpbGwgdGVybWluYXRlIHRoZSBDbGF1ZGUgQ29kZSBvbiB0aGUgd2ViIHNlc3Npb24uXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDxTZWxlY3RcbiAgICAgICAgICAgIG9wdGlvbnM9e1tcbiAgICAgICAgICAgICAgeyBsYWJlbDogJ1Rlcm1pbmF0ZSBzZXNzaW9uJywgdmFsdWU6ICdzdG9wJyBhcyBjb25zdCB9LFxuICAgICAgICAgICAgICB7IGxhYmVsOiAnQmFjaycsIHZhbHVlOiAnYmFjaycgYXMgY29uc3QgfSxcbiAgICAgICAgICAgIF19XG4gICAgICAgICAgICBvbkNoYW5nZT17diA9PiB7XG4gICAgICAgICAgICAgIGlmICh2ID09PSAnc3RvcCcpIHtcbiAgICAgICAgICAgICAgICBvbktpbGw/LigpXG4gICAgICAgICAgICAgICAgZ29CYWNrT3JDbG9zZSgpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0Q29uZmlybWluZ1N0b3AoZmFsc2UpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH19XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0RpYWxvZz5cbiAgICApXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxEaWFsb2dcbiAgICAgIHRpdGxlPXtcbiAgICAgICAgPFRleHQ+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJiYWNrZ3JvdW5kXCI+XG4gICAgICAgICAgICB7cGhhc2UgPT09ICdwbGFuX3JlYWR5JyA/IERJQU1PTkRfRklMTEVEIDogRElBTU9ORF9PUEVOfXsnICd9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGJvbGQ+dWx0cmFwbGFuPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgeycgwrcgJ31cbiAgICAgICAgICAgIHtlbGFwc2VkVGltZX1cbiAgICAgICAgICAgIHsnIMK3ICd9XG4gICAgICAgICAgICB7c3RhdHVzVGV4dH1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIH1cbiAgICAgIG9uQ2FuY2VsPXtnb0JhY2tPckNsb3NlfVxuICAgICAgY29sb3I9XCJiYWNrZ3JvdW5kXCJcbiAgICA+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICB7cGhhc2UgPT09ICdwbGFuX3JlYWR5JyAmJiAoXG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1Y2Nlc3NcIj57ZmlndXJlcy50aWNrfSA8L1RleHQ+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7YWdlbnRzV29ya2luZ30ge3BsdXJhbChhZ2VudHNXb3JraW5nLCAnYWdlbnQnKX17JyAnfVxuICAgICAgICAgIHtwaGFzZSA/IEFHRU5UX1ZFUkJbcGhhc2VdIDogJ3dvcmtpbmcnfSDCtyB7dG9vbENhbGxzfSB0b29seycgJ31cbiAgICAgICAgICB7cGx1cmFsKHRvb2xDYWxscywgJ2NhbGwnKX1cbiAgICAgICAgPC9UZXh0PlxuICAgICAgICB7bGFzdFRvb2xDYWxsICYmIDxUZXh0IGRpbUNvbG9yPntsYXN0VG9vbENhbGx9PC9UZXh0Pn1cbiAgICAgICAgPExpbmsgdXJsPXtzZXNzaW9uVXJsfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57c2Vzc2lvblVybH08L1RleHQ+XG4gICAgICAgIDwvTGluaz5cbiAgICAgICAgPFNlbGVjdFxuICAgICAgICAgIG9wdGlvbnM9e1tcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbGFiZWw6ICdSZXZpZXcgaW4gQ2xhdWRlIENvZGUgb24gdGhlIHdlYicsXG4gICAgICAgICAgICAgIHZhbHVlOiAnb3BlbicgYXMgY29uc3QsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLi4uKG9uS2lsbCAmJiBydW5uaW5nXG4gICAgICAgICAgICAgID8gW3sgbGFiZWw6ICdTdG9wIHVsdHJhcGxhbicsIHZhbHVlOiAnc3RvcCcgYXMgY29uc3QgfV1cbiAgICAgICAgICAgICAgOiBbXSksXG4gICAgICAgICAgICB7IGxhYmVsOiAnQmFjaycsIHZhbHVlOiAnYmFjaycgYXMgY29uc3QgfSxcbiAgICAgICAgICBdfVxuICAgICAgICAgIG9uQ2hhbmdlPXt2ID0+IHtcbiAgICAgICAgICAgIHN3aXRjaCAodikge1xuICAgICAgICAgICAgICBjYXNlICdvcGVuJzpcbiAgICAgICAgICAgICAgICB2b2lkIG9wZW5Ccm93c2VyKHNlc3Npb25VcmwpXG4gICAgICAgICAgICAgICAgLy8gQ2xvc2UgdGhlIGRpYWxvZyBzbyB0aGUgdXNlciBsYW5kcyBiYWNrIGF0IHRoZSBwcm9tcHQgd2l0aFxuICAgICAgICAgICAgICAgIC8vIGFueSBoYWxmLXdyaXR0ZW4gaW5wdXQgaW50YWN0IChpbnB1dFZhbHVlIHBlcnNpc3RzIGFjcm9zc1xuICAgICAgICAgICAgICAgIC8vIHRoZSBzaG93QmFzaGVzRGlhbG9nIHRvZ2dsZSkuXG4gICAgICAgICAgICAgICAgb25Eb25lKClcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgY2FzZSAnc3RvcCc6XG4gICAgICAgICAgICAgICAgc2V0Q29uZmlybWluZ1N0b3AodHJ1ZSlcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgY2FzZSAnYmFjayc6XG4gICAgICAgICAgICAgICAgZ29CYWNrT3JDbG9zZSgpXG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfX1cbiAgICAgICAgLz5cbiAgICAgIDwvQm94PlxuICAgIDwvRGlhbG9nPlxuICApXG59XG5cbmNvbnN0IFNUQUdFUyA9IFsnZmluZGluZycsICd2ZXJpZnlpbmcnLCAnc3ludGhlc2l6aW5nJ10gYXMgY29uc3RcbmNvbnN0IFNUQUdFX0xBQkVMUzogUmVjb3JkPCh0eXBlb2YgU1RBR0VTKVtudW1iZXJdLCBzdHJpbmc+ID0ge1xuICBmaW5kaW5nOiAnRmluZCcsXG4gIHZlcmlmeWluZzogJ1ZlcmlmeScsXG4gIHN5bnRoZXNpemluZzogJ0RlZHVwZScsXG59XG5cbi8vIFNldHVwIOKGkiBGaW5kIOKGkiBWZXJpZnkg4oaSIERlZHVwZSBwaXBlbGluZS4gQ3VycmVudCBzdGFnZSBpbiBjbG91ZCB0ZWFsLFxuLy8gcmVzdCBkaW0uIFdoZW4gY29tcGxldGVkLCBhbGwgc3RhZ2VzIGRpbSB3aXRoIGEgdHJhaWxpbmcgZ3JlZW4g4pyTLiBUaGVcbi8vIFwiU2V0dXBcIiBsYWJlbCBzaG93cyBiZWZvcmUgdGhlIG9yY2hlc3RyYXRvciB3cml0ZXMgaXRzIGZpcnN0IHByb2dyZXNzXG4vLyBzbmFwc2hvdCAoY29udGFpbmVyIGJvb3QgKyByZXBvIGNsb25lKSwgc28gdGhlIDAtZm91bmQgZGlzcGxheSBkb2Vzbid0XG4vLyBsb29rIGxpa2UgYSBodW5nIGZpbmRlci5cbmZ1bmN0aW9uIFN0YWdlUGlwZWxpbmUoe1xuICBzdGFnZSxcbiAgY29tcGxldGVkLFxuICBoYXNQcm9ncmVzcyxcbn06IHtcbiAgc3RhZ2U6ICdmaW5kaW5nJyB8ICd2ZXJpZnlpbmcnIHwgJ3N5bnRoZXNpemluZycgfCB1bmRlZmluZWRcbiAgY29tcGxldGVkOiBib29sZWFuXG4gIGhhc1Byb2dyZXNzOiBib29sZWFuXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgY3VycmVudElkeCA9IHN0YWdlID8gU1RBR0VTLmluZGV4T2Yoc3RhZ2UpIDogLTFcbiAgY29uc3QgaW5TZXR1cCA9ICFjb21wbGV0ZWQgJiYgIWhhc1Byb2dyZXNzXG4gIHJldHVybiAoXG4gICAgPFRleHQ+XG4gICAgICB7aW5TZXR1cCA/IChcbiAgICAgICAgPFRleHQgY29sb3I9XCJiYWNrZ3JvdW5kXCI+U2V0dXA8L1RleHQ+XG4gICAgICApIDogKFxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5TZXR1cDwvVGV4dD5cbiAgICAgICl9XG4gICAgICA8VGV4dCBkaW1Db2xvcj4g4oaSIDwvVGV4dD5cbiAgICAgIHtTVEFHRVMubWFwKChzLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IGlzQ3VycmVudCA9ICFjb21wbGV0ZWQgJiYgIWluU2V0dXAgJiYgaSA9PT0gY3VycmVudElkeFxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxSZWFjdC5GcmFnbWVudCBrZXk9e3N9PlxuICAgICAgICAgICAge2kgPiAwICYmIDxUZXh0IGRpbUNvbG9yPiDihpIgPC9UZXh0Pn1cbiAgICAgICAgICAgIHtpc0N1cnJlbnQgPyAoXG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiYmFja2dyb3VuZFwiPntTVEFHRV9MQUJFTFNbc119PC9UZXh0PlxuICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e1NUQUdFX0xBQkVMU1tzXX08L1RleHQ+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvUmVhY3QuRnJhZ21lbnQ+XG4gICAgICAgIClcbiAgICAgIH0pfVxuICAgICAge2NvbXBsZXRlZCAmJiA8VGV4dCBjb2xvcj1cInN1Y2Nlc3NcIj4g4pyTPC9UZXh0Pn1cbiAgICA8L1RleHQ+XG4gIClcbn1cblxuLy8gU3RhZ2UtYXBwcm9wcmlhdGUgY291bnRzIGxpbmUuIFJ1bm5pbmctc3RhdGUgZm9ybWF0dGluZyBkZWxlZ2F0ZXMgdG9cbi8vIGZvcm1hdFJldmlld1N0YWdlQ291bnRzIChzaGFyZWQgd2l0aCB0aGUgcGlsbCkgc28gdGhlIHR3byB2aWV3cyBjYW4ndFxuLy8gZHJpZnQ7IGNvbXBsZXRlZCBzdGF0ZSBpcyBkaWFsb2ctc3BlY2lmaWMgKGZpbmRpbmdzIHN1bW1hcnkpLlxuZnVuY3Rpb24gcmV2aWV3Q291bnRzTGluZShcbiAgc2Vzc2lvbjogRGVlcEltbXV0YWJsZTxSZW1vdGVBZ2VudFRhc2tTdGF0ZT4sXG4pOiBzdHJpbmcge1xuICBjb25zdCBwID0gc2Vzc2lvbi5yZXZpZXdQcm9ncmVzc1xuICAvLyBObyBwcm9ncmVzcyBkYXRhIOKAlCB0aGUgb3JjaGVzdHJhdG9yIG5ldmVyIHdyb3RlIGEgc25hcHNob3QuIERvbid0XG4gIC8vIGNsYWltIFwiMCBmaW5kaW5nc1wiIHdoZW4gY29tcGxldGVkOyB3ZSBqdXN0IGRvbid0IGtub3cuXG4gIGlmICghcCkgcmV0dXJuIHNlc3Npb24uc3RhdHVzID09PSAnY29tcGxldGVkJyA/ICdkb25lJyA6ICdzZXR0aW5nIHVwJ1xuICBjb25zdCB2ZXJpZmllZCA9IHAuYnVnc1ZlcmlmaWVkXG4gIGNvbnN0IHJlZnV0ZWQgPSBwLmJ1Z3NSZWZ1dGVkID8/IDBcbiAgaWYgKHNlc3Npb24uc3RhdHVzID09PSAnY29tcGxldGVkJykge1xuICAgIGNvbnN0IHBhcnRzID0gW2Ake3ZlcmlmaWVkfSAke3BsdXJhbCh2ZXJpZmllZCwgJ2ZpbmRpbmcnKX1gXVxuICAgIGlmIChyZWZ1dGVkID4gMCkgcGFydHMucHVzaChgJHtyZWZ1dGVkfSByZWZ1dGVkYClcbiAgICByZXR1cm4gcGFydHMuam9pbignIMK3ICcpXG4gIH1cbiAgcmV0dXJuIGZvcm1hdFJldmlld1N0YWdlQ291bnRzKHAuc3RhZ2UsIHAuYnVnc0ZvdW5kLCB2ZXJpZmllZCwgcmVmdXRlZClcbn1cblxudHlwZSBNZW51QWN0aW9uID0gJ29wZW4nIHwgJ3N0b3AnIHwgJ2JhY2snIHwgJ2Rpc21pc3MnXG5cbmZ1bmN0aW9uIFJldmlld1Nlc3Npb25EZXRhaWwoe1xuICBzZXNzaW9uLFxuICBvbkRvbmUsXG4gIG9uQmFjayxcbiAgb25LaWxsLFxufTogT21pdDxQcm9wcywgJ3Rvb2xVc2VDb250ZXh0Jz4pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBjb21wbGV0ZWQgPSBzZXNzaW9uLnN0YXR1cyA9PT0gJ2NvbXBsZXRlZCdcbiAgY29uc3QgcnVubmluZyA9IHNlc3Npb24uc3RhdHVzID09PSAncnVubmluZycgfHwgc2Vzc2lvbi5zdGF0dXMgPT09ICdwZW5kaW5nJ1xuICBjb25zdCBbY29uZmlybWluZ1N0b3AsIHNldENvbmZpcm1pbmdTdG9wXSA9IHVzZVN0YXRlKGZhbHNlKVxuXG4gIC8vIHVzZUVsYXBzZWRUaW1lIGRyaXZlcyB0aGUgMUh6IHRpY2sgc28gdGhlIHRpbWVyIGFkdmFuY2VzIHdoaWxlIHRoZVxuICAvLyBkaWFsb2cgaXMgb3BlbiDigJQgdGhlIHByZXZpb3VzIGlubGluZSBlbGFwc2VkLXRpbWUgY2FsY3VsYXRpb24gb25seVxuICAvLyByZS1yZW5kZXJlZCBvbiBzZXNzaW9uIHN0YXRlIGNoYW5nZXMgKHBvbGwgaW50ZXJ2YWwpLCB3aGljaCBsb29rZWRcbiAgLy8gbGlrZSB0aGUgY2xvY2sgd2FzIHN0dWNrLlxuICBjb25zdCBlbGFwc2VkVGltZSA9IHVzZUVsYXBzZWRUaW1lKFxuICAgIHNlc3Npb24uc3RhcnRUaW1lLFxuICAgIHJ1bm5pbmcsXG4gICAgMTAwMCxcbiAgICAwLFxuICAgIHNlc3Npb24uZW5kVGltZSxcbiAgKVxuXG4gIGNvbnN0IGhhbmRsZUNsb3NlID0gKCkgPT5cbiAgICBvbkRvbmUoJ1JlbW90ZSBzZXNzaW9uIGRldGFpbHMgZGlzbWlzc2VkJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICBjb25zdCBnb0JhY2tPckNsb3NlID0gb25CYWNrID8/IGhhbmRsZUNsb3NlXG5cbiAgY29uc3Qgc2Vzc2lvblVybCA9IGdldFJlbW90ZVRhc2tTZXNzaW9uVXJsKHNlc3Npb24uc2Vzc2lvbklkKVxuICBjb25zdCBzdGF0dXNMYWJlbCA9IGNvbXBsZXRlZCA/ICdyZWFkeScgOiBydW5uaW5nID8gJ3J1bm5pbmcnIDogc2Vzc2lvbi5zdGF0dXNcblxuICBpZiAoY29uZmlybWluZ1N0b3ApIHtcbiAgICByZXR1cm4gKFxuICAgICAgPERpYWxvZ1xuICAgICAgICB0aXRsZT1cIlN0b3AgdWx0cmFyZXZpZXc/XCJcbiAgICAgICAgb25DYW5jZWw9eygpID0+IHNldENvbmZpcm1pbmdTdG9wKGZhbHNlKX1cbiAgICAgICAgY29sb3I9XCJiYWNrZ3JvdW5kXCJcbiAgICAgID5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXsxfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIFRoaXMgYXJjaGl2ZXMgdGhlIHJlbW90ZSBzZXNzaW9uIGFuZCBzdG9wcyBsb2NhbCB0cmFja2luZy4gVGhlXG4gICAgICAgICAgICByZXZpZXcgd2lsbCBub3QgY29tcGxldGUgYW5kIGFueSBmaW5kaW5ncyBzbyBmYXIgYXJlIGRpc2NhcmRlZC5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFNlbGVjdFxuICAgICAgICAgICAgb3B0aW9ucz17W1xuICAgICAgICAgICAgICB7IGxhYmVsOiAnU3RvcCB1bHRyYXJldmlldycsIHZhbHVlOiAnc3RvcCcgYXMgY29uc3QgfSxcbiAgICAgICAgICAgICAgeyBsYWJlbDogJ0JhY2snLCB2YWx1ZTogJ2JhY2snIGFzIGNvbnN0IH0sXG4gICAgICAgICAgICBdfVxuICAgICAgICAgICAgb25DaGFuZ2U9e3YgPT4ge1xuICAgICAgICAgICAgICBpZiAodiA9PT0gJ3N0b3AnKSB7XG4gICAgICAgICAgICAgICAgb25LaWxsPy4oKVxuICAgICAgICAgICAgICAgIGdvQmFja09yQ2xvc2UoKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNldENvbmZpcm1pbmdTdG9wKGZhbHNlKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9fVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9EaWFsb2c+XG4gICAgKVxuICB9XG5cbiAgY29uc3Qgb3B0aW9uczogeyBsYWJlbDogc3RyaW5nOyB2YWx1ZTogTWVudUFjdGlvbiB9W10gPSBjb21wbGV0ZWRcbiAgICA/IFtcbiAgICAgICAgeyBsYWJlbDogJ09wZW4gaW4gQ2xhdWRlIENvZGUgb24gdGhlIHdlYicsIHZhbHVlOiAnb3BlbicgfSxcbiAgICAgICAgeyBsYWJlbDogJ0Rpc21pc3MnLCB2YWx1ZTogJ2Rpc21pc3MnIH0sXG4gICAgICBdXG4gICAgOiBbXG4gICAgICAgIHsgbGFiZWw6ICdPcGVuIGluIENsYXVkZSBDb2RlIG9uIHRoZSB3ZWInLCB2YWx1ZTogJ29wZW4nIH0sXG4gICAgICAgIC4uLihvbktpbGwgJiYgcnVubmluZ1xuICAgICAgICAgID8gW3sgbGFiZWw6ICdTdG9wIHVsdHJhcmV2aWV3JywgdmFsdWU6ICdzdG9wJyBhcyBjb25zdCB9XVxuICAgICAgICAgIDogW10pLFxuICAgICAgICB7IGxhYmVsOiAnQmFjaycsIHZhbHVlOiAnYmFjaycgfSxcbiAgICAgIF1cblxuICBjb25zdCBoYW5kbGVTZWxlY3QgPSAoYWN0aW9uOiBNZW51QWN0aW9uKSA9PiB7XG4gICAgc3dpdGNoIChhY3Rpb24pIHtcbiAgICAgIGNhc2UgJ29wZW4nOlxuICAgICAgICB2b2lkIG9wZW5Ccm93c2VyKHNlc3Npb25VcmwpXG4gICAgICAgIG9uRG9uZSgpXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdzdG9wJzpcbiAgICAgICAgc2V0Q29uZmlybWluZ1N0b3AodHJ1ZSlcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2JhY2snOlxuICAgICAgICBnb0JhY2tPckNsb3NlKClcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2Rpc21pc3MnOlxuICAgICAgICBoYW5kbGVDbG9zZSgpXG4gICAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8RGlhbG9nXG4gICAgICB0aXRsZT17XG4gICAgICAgIDxUZXh0PlxuICAgICAgICAgIDxUZXh0IGNvbG9yPVwiYmFja2dyb3VuZFwiPlxuICAgICAgICAgICAge2NvbXBsZXRlZCA/IERJQU1PTkRfRklMTEVEIDogRElBTU9ORF9PUEVOfXsnICd9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGJvbGQ+dWx0cmFyZXZpZXc8L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICB7JyDCtyAnfVxuICAgICAgICAgICAge2VsYXBzZWRUaW1lfVxuICAgICAgICAgICAgeycgwrcgJ31cbiAgICAgICAgICAgIHtzdGF0dXNMYWJlbH1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIH1cbiAgICAgIG9uQ2FuY2VsPXtnb0JhY2tPckNsb3NlfVxuICAgICAgY29sb3I9XCJiYWNrZ3JvdW5kXCJcbiAgICAgIGlucHV0R3VpZGU9e2V4aXRTdGF0ZSA9PlxuICAgICAgICBleGl0U3RhdGUucGVuZGluZyA/IChcbiAgICAgICAgICA8VGV4dD5QcmVzcyB7ZXhpdFN0YXRlLmtleU5hbWV9IGFnYWluIHRvIGV4aXQ8L1RleHQ+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVudGVyXCIgYWN0aW9uPVwic2VsZWN0XCIgLz5cbiAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVzY1wiIGFjdGlvbj1cImdvIGJhY2tcIiAvPlxuICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICApXG4gICAgICB9XG4gICAgPlxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXsxfT5cbiAgICAgICAgPFN0YWdlUGlwZWxpbmVcbiAgICAgICAgICBzdGFnZT17c2Vzc2lvbi5yZXZpZXdQcm9ncmVzcz8uc3RhZ2V9XG4gICAgICAgICAgY29tcGxldGVkPXtjb21wbGV0ZWR9XG4gICAgICAgICAgaGFzUHJvZ3Jlc3M9eyEhc2Vzc2lvbi5yZXZpZXdQcm9ncmVzc31cbiAgICAgICAgLz5cblxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dD57cmV2aWV3Q291bnRzTGluZShzZXNzaW9uKX08L1RleHQ+XG4gICAgICAgICAgPExpbmsgdXJsPXtzZXNzaW9uVXJsfT5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntzZXNzaW9uVXJsfTwvVGV4dD5cbiAgICAgICAgICA8L0xpbms+XG4gICAgICAgIDwvQm94PlxuXG4gICAgICAgIDxTZWxlY3Qgb3B0aW9ucz17b3B0aW9uc30gb25DaGFuZ2U9e2hhbmRsZVNlbGVjdH0gLz5cbiAgICAgIDwvQm94PlxuICAgIDwvRGlhbG9nPlxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBSZW1vdGVTZXNzaW9uRGV0YWlsRGlhbG9nKHtcbiAgc2Vzc2lvbixcbiAgdG9vbFVzZUNvbnRleHQsXG4gIG9uRG9uZSxcbiAgb25CYWNrLFxuICBvbktpbGwsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFtpc1RlbGVwb3J0aW5nLCBzZXRJc1RlbGVwb3J0aW5nXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbdGVsZXBvcnRFcnJvciwgc2V0VGVsZXBvcnRFcnJvcl0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuXG4gIC8vIEdldCBsYXN0IGZldyBtZXNzYWdlcyBmcm9tIHJlbW90ZSBzZXNzaW9uIGZvciBkaXNwbGF5LlxuICAvLyBTY2FuIGFsbCBtZXNzYWdlcyAobm90IGp1c3QgdGhlIGxhc3QgMyByYXcgZW50cmllcykgYmVjYXVzZSB0aGUgdGFpbCBvZlxuICAvLyB0aGUgbG9nIGlzIG9mdGVuIHRoaW5raW5nLW9ubHkgYmxvY2tzIHRoYXQgbm9ybWFsaXNlIHRvICdwcm9ncmVzcycgdHlwZS5cbiAgLy8gUGxhY2VkIGJlZm9yZSB0aGUgZWFybHkgcmV0dXJucyBzbyBob29rIGNhbGwgb3JkZXIgaXMgc3RhYmxlIChSdWxlcyBvZiBIb29rcykuXG4gIC8vIFVsdHJhcGxhbi9yZXZpZXcgc2Vzc2lvbnMgbmV2ZXIgcmVhZCB0aGlzIOKAlCBza2lwIHRoZSBub3JtYWxpemUgd29yayBmb3IgdGhlbS5cbiAgY29uc3QgbGFzdE1lc3NhZ2VzID0gdXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKHNlc3Npb24uaXNVbHRyYXBsYW4gfHwgc2Vzc2lvbi5pc1JlbW90ZVJldmlldykgcmV0dXJuIFtdXG4gICAgcmV0dXJuIG5vcm1hbGl6ZU1lc3NhZ2VzKHRvSW50ZXJuYWxNZXNzYWdlcyhzZXNzaW9uLmxvZyBhcyBTREtNZXNzYWdlW10pKVxuICAgICAgLmZpbHRlcihfID0+IF8udHlwZSAhPT0gJ3Byb2dyZXNzJylcbiAgICAgIC5zbGljZSgtMylcbiAgfSwgW3Nlc3Npb25dKVxuXG4gIGlmIChzZXNzaW9uLmlzVWx0cmFwbGFuKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxVbHRyYXBsYW5TZXNzaW9uRGV0YWlsXG4gICAgICAgIHNlc3Npb249e3Nlc3Npb259XG4gICAgICAgIG9uRG9uZT17b25Eb25lfVxuICAgICAgICBvbkJhY2s9e29uQmFja31cbiAgICAgICAgb25LaWxsPXtvbktpbGx9XG4gICAgICAvPlxuICAgIClcbiAgfVxuXG4gIC8vIFJldmlldyBzZXNzaW9ucyBnZXQgdGhlIHN0YWdlLXBpcGVsaW5lIHZpZXc7IGV2ZXJ5dGhpbmcgZWxzZSBrZWVwcyB0aGVcbiAgLy8gZ2VuZXJpYyBsYWJlbC92YWx1ZSArIHJlY2VudC1tZXNzYWdlcyBkaWFsb2cgYmVsb3cuXG4gIGlmIChzZXNzaW9uLmlzUmVtb3RlUmV2aWV3KSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxSZXZpZXdTZXNzaW9uRGV0YWlsXG4gICAgICAgIHNlc3Npb249e3Nlc3Npb259XG4gICAgICAgIG9uRG9uZT17b25Eb25lfVxuICAgICAgICBvbkJhY2s9e29uQmFja31cbiAgICAgICAgb25LaWxsPXtvbktpbGx9XG4gICAgICAvPlxuICAgIClcbiAgfVxuXG4gIGNvbnN0IGhhbmRsZUNsb3NlID0gKCkgPT5cbiAgICBvbkRvbmUoJ1JlbW90ZSBzZXNzaW9uIGRldGFpbHMgZGlzbWlzc2VkJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuXG4gIC8vIENvbXBvbmVudC1zcGVjaWZpYyBzaG9ydGN1dHMgc2hvd24gaW4gVUkgaGludHMgKHQ9dGVsZXBvcnQsIHNwYWNlPWRpc21pc3MsXG4gIC8vIGxlZnQ9YmFjaykuIFRoZXNlIGFyZSBzdGF0ZS1kZXBlbmRlbnQgYWN0aW9ucywgbm90IHN0YW5kYXJkIGRpYWxvZyBrZXliaW5kaW5ncy5cbiAgY29uc3QgaGFuZGxlS2V5RG93biA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgaWYgKGUua2V5ID09PSAnICcpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgb25Eb25lKCdSZW1vdGUgc2Vzc2lvbiBkZXRhaWxzIGRpc21pc3NlZCcsIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcbiAgICB9IGVsc2UgaWYgKGUua2V5ID09PSAnbGVmdCcgJiYgb25CYWNrKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIG9uQmFjaygpXG4gICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ3QnICYmICFpc1RlbGVwb3J0aW5nKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIHZvaWQgaGFuZGxlVGVsZXBvcnQoKVxuICAgIH0gZWxzZSBpZiAoZS5rZXkgPT09ICdyZXR1cm4nKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGhhbmRsZUNsb3NlKClcbiAgICB9XG4gIH1cblxuICAvLyBIYW5kbGUgdGVsZXBvcnRpbmcgdG8gcmVtb3RlIHNlc3Npb25cbiAgYXN5bmMgZnVuY3Rpb24gaGFuZGxlVGVsZXBvcnQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgc2V0SXNUZWxlcG9ydGluZyh0cnVlKVxuICAgIHNldFRlbGVwb3J0RXJyb3IobnVsbClcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0ZWxlcG9ydFJlc3VtZUNvZGVTZXNzaW9uKHNlc3Npb24uc2Vzc2lvbklkKVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgc2V0VGVsZXBvcnRFcnJvcihlcnJvck1lc3NhZ2UoZXJyKSlcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNUZWxlcG9ydGluZyhmYWxzZSlcbiAgICB9XG4gIH1cblxuICAvLyBUcnVuY2F0ZSB0aXRsZSBpZiB0b28gbG9uZyAoZm9yIGRpc3BsYXkgcHVycG9zZXMpXG4gIGNvbnN0IGRpc3BsYXlUaXRsZSA9IHRydW5jYXRlVG9XaWR0aChzZXNzaW9uLnRpdGxlLCA1MClcblxuICAvLyBNYXAgVGFza1N0YXR1cyB0byBkaXNwbGF5IHN0YXR1cyAoaGFuZGxlICdwZW5kaW5nJylcbiAgY29uc3QgZGlzcGxheVN0YXR1cyA9XG4gICAgc2Vzc2lvbi5zdGF0dXMgPT09ICdwZW5kaW5nJyA/ICdzdGFydGluZycgOiBzZXNzaW9uLnN0YXR1c1xuXG4gIHJldHVybiAoXG4gICAgPEJveFxuICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICB0YWJJbmRleD17MH1cbiAgICAgIGF1dG9Gb2N1c1xuICAgICAgb25LZXlEb3duPXtoYW5kbGVLZXlEb3dufVxuICAgID5cbiAgICAgIDxEaWFsb2dcbiAgICAgICAgdGl0bGU9XCJSZW1vdGUgc2Vzc2lvbiBkZXRhaWxzXCJcbiAgICAgICAgb25DYW5jZWw9e2hhbmRsZUNsb3NlfVxuICAgICAgICBjb2xvcj1cImJhY2tncm91bmRcIlxuICAgICAgICBpbnB1dEd1aWRlPXtleGl0U3RhdGUgPT5cbiAgICAgICAgICBleGl0U3RhdGUucGVuZGluZyA/IChcbiAgICAgICAgICAgIDxUZXh0PlByZXNzIHtleGl0U3RhdGUua2V5TmFtZX0gYWdhaW4gdG8gZXhpdDwvVGV4dD5cbiAgICAgICAgICApIDogKFxuICAgICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgICAge29uQmFjayAmJiA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCLihpBcIiBhY3Rpb249XCJnbyBiYWNrXCIgLz59XG4gICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVzYy9FbnRlci9TcGFjZVwiIGFjdGlvbj1cImNsb3NlXCIgLz5cbiAgICAgICAgICAgICAgeyFpc1RlbGVwb3J0aW5nICYmIChcbiAgICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJ0XCIgYWN0aW9uPVwidGVsZXBvcnRcIiAvPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5TdGF0dXM8L1RleHQ+OnsnICd9XG4gICAgICAgICAgICB7ZGlzcGxheVN0YXR1cyA9PT0gJ3J1bm5pbmcnIHx8IGRpc3BsYXlTdGF0dXMgPT09ICdzdGFydGluZycgPyAoXG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiYmFja2dyb3VuZFwiPntkaXNwbGF5U3RhdHVzfTwvVGV4dD5cbiAgICAgICAgICAgICkgOiBkaXNwbGF5U3RhdHVzID09PSAnY29tcGxldGVkJyA/IChcbiAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWNjZXNzXCI+e2Rpc3BsYXlTdGF0dXN9PC9UZXh0PlxuICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPntkaXNwbGF5U3RhdHVzfTwvVGV4dD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5SdW50aW1lPC9UZXh0Pjp7JyAnfVxuICAgICAgICAgICAge2Zvcm1hdER1cmF0aW9uKFxuICAgICAgICAgICAgICAoc2Vzc2lvbi5lbmRUaW1lID8/IERhdGUubm93KCkpIC0gc2Vzc2lvbi5zdGFydFRpbWUsXG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8VGV4dCB3cmFwPVwidHJ1bmNhdGUtZW5kXCI+XG4gICAgICAgICAgICA8VGV4dCBib2xkPlRpdGxlPC9UZXh0Pjoge2Rpc3BsYXlUaXRsZX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICA8VGV4dCBib2xkPlByb2dyZXNzPC9UZXh0Pjp7JyAnfVxuICAgICAgICAgICAgPFJlbW90ZVNlc3Npb25Qcm9ncmVzcyBzZXNzaW9uPXtzZXNzaW9ufSAvPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgIDxUZXh0IGJvbGQ+U2Vzc2lvbiBVUkw8L1RleHQ+OnsnICd9XG4gICAgICAgICAgICA8TGluayB1cmw9e2dldFJlbW90ZVRhc2tTZXNzaW9uVXJsKHNlc3Npb24uc2Vzc2lvbklkKX0+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntnZXRSZW1vdGVUYXNrU2Vzc2lvblVybChzZXNzaW9uLnNlc3Npb25JZCl9PC9UZXh0PlxuICAgICAgICAgICAgPC9MaW5rPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgey8qIFJlbW90ZSBzZXNzaW9uIG1lc3NhZ2VzIHNlY3Rpb24gKi99XG4gICAgICAgIHtzZXNzaW9uLmxvZy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGJvbGQ+UmVjZW50IG1lc3NhZ2VzPC9UZXh0PjpcbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGhlaWdodD17MTB9IG92ZXJmbG93WT1cImhpZGRlblwiPlxuICAgICAgICAgICAgICB7bGFzdE1lc3NhZ2VzLm1hcCgobXNnLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgPE1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgIGtleT17aX1cbiAgICAgICAgICAgICAgICAgIG1lc3NhZ2U9e21zZ31cbiAgICAgICAgICAgICAgICAgIGxvb2t1cHM9e0VNUFRZX0xPT0tVUFN9XG4gICAgICAgICAgICAgICAgICBhZGRNYXJnaW49e2kgPiAwfVxuICAgICAgICAgICAgICAgICAgdG9vbHM9e3Rvb2xVc2VDb250ZXh0Lm9wdGlvbnMudG9vbHN9XG4gICAgICAgICAgICAgICAgICBjb21tYW5kcz17dG9vbFVzZUNvbnRleHQub3B0aW9ucy5jb21tYW5kc31cbiAgICAgICAgICAgICAgICAgIHZlcmJvc2U9e3Rvb2xVc2VDb250ZXh0Lm9wdGlvbnMudmVyYm9zZX1cbiAgICAgICAgICAgICAgICAgIGluUHJvZ3Jlc3NUb29sVXNlSURzPXtuZXcgU2V0KCl9XG4gICAgICAgICAgICAgICAgICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZT17W119XG4gICAgICAgICAgICAgICAgICBzaG91bGRBbmltYXRlPXtmYWxzZX1cbiAgICAgICAgICAgICAgICAgIHNob3VsZFNob3dEb3Q9e2ZhbHNlfVxuICAgICAgICAgICAgICAgICAgc3R5bGU9XCJjb25kZW5zZWRcIlxuICAgICAgICAgICAgICAgICAgaXNUcmFuc2NyaXB0TW9kZT17ZmFsc2V9XG4gICAgICAgICAgICAgICAgICBpc1N0YXRpYz17dHJ1ZX1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICAgICAgU2hvd2luZyBsYXN0IHtsYXN0TWVzc2FnZXMubGVuZ3RofSBvZiB7c2Vzc2lvbi5sb2cubGVuZ3RofXsnICd9XG4gICAgICAgICAgICAgICAgbWVzc2FnZXNcbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIFRlbGVwb3J0IGVycm9yIG1lc3NhZ2UgKi99XG4gICAgICAgIHt0ZWxlcG9ydEVycm9yICYmIChcbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+VGVsZXBvcnQgZmFpbGVkOiB7dGVsZXBvcnRFcnJvcn08L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIFRlbGVwb3J0aW5nIHN0YXR1cyAqL31cbiAgICAgICAge2lzVGVsZXBvcnRpbmcgJiYgKFxuICAgICAgICAgIDxUZXh0IGNvbG9yPVwiYmFja2dyb3VuZFwiPlRlbGVwb3J0aW5nIHRvIHNlc3Npb27igKY8L1RleHQ+XG4gICAgICAgICl9XG4gICAgICA8L0RpYWxvZz5cbiAgICA8L0JveD5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBT0EsT0FBTyxNQUFNLFNBQVM7QUFDN0IsT0FBT0MsS0FBSyxJQUFJQyxPQUFPLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ2hELGNBQWNDLFVBQVUsUUFBUSxrQ0FBa0M7QUFDbEUsY0FBY0MsY0FBYyxRQUFRLGFBQWE7QUFDakQsY0FBY0MsYUFBYSxRQUFRLG9CQUFvQjtBQUN2RCxjQUFjQyxvQkFBb0IsUUFBUSxtQkFBbUI7QUFDN0QsU0FBU0MsY0FBYyxFQUFFQyxZQUFZLFFBQVEsNEJBQTRCO0FBQ3pFLFNBQVNDLGNBQWMsUUFBUSwrQkFBK0I7QUFDOUQsY0FBY0MsYUFBYSxRQUFRLG9DQUFvQztBQUN2RSxT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