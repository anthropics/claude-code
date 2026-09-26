import { c as _c } from "react/compiler-runtime";
// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { Box, Text, type TextProps } from '../../ink.js';
import { feature } from 'bun:bundle';
import * as React from 'react';
import { useState } from 'react';
import sample from 'lodash-es/sample.js';
import { BLACK_CIRCLE, REFERENCE_MARK, TEARDROP_ASTERISK } from '../../constants/figures.js';
import figures from 'figures';
import { basename } from 'path';
import { MessageResponse } from '../MessageResponse.js';
import { FilePathLink } from '../FilePathLink.js';
import { openPath } from '../../utils/browser.js';
/* eslint-disable @typescript-eslint/no-require-imports */
const teamMemSaved = feature('TEAMMEM') ? require('./teamMemSaved.js') as typeof import('./teamMemSaved.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */
import { TURN_COMPLETION_VERBS } from '../../constants/turnCompletionVerbs.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import type { SystemMessage, SystemStopHookSummaryMessage, SystemBridgeStatusMessage, SystemTurnDurationMessage, SystemThinkingMessage, SystemMemorySavedMessage } from '../../types/message.js';
import { SystemAPIErrorMessage } from './SystemAPIErrorMessage.js';
import { formatDuration, formatNumber, formatSecondsShort } from '../../utils/format.js';
import { getGlobalConfig } from '../../utils/config.js';
import Link from '../../ink/components/Link.js';
import ThemedText from '../design-system/ThemedText.js';
import { CtrlOToExpand } from '../CtrlOToExpand.js';
import { useAppStateStore } from '../../state/AppState.js';
import { isBackgroundTask, type TaskState } from '../../tasks/types.js';
import { getPillLabel } from '../../tasks/pillLabel.js';
import { useSelectedMessageBg } from '../messageActions.js';
type Props = {
  message: SystemMessage;
  addMargin: boolean;
  verbose: boolean;
  isTranscriptMode?: boolean;
};
export function SystemTextMessage(t0) {
  const $ = _c(51);
  const {
    message,
    addMargin,
    verbose,
    isTranscriptMode
  } = t0;
  const bg = useSelectedMessageBg();
  if (message.subtype === "turn_duration") {
    let t1;
    if ($[0] !== addMargin || $[1] !== message) {
      t1 = <TurnDurationMessage message={message} addMargin={addMargin} />;
      $[0] = addMargin;
      $[1] = message;
      $[2] = t1;
    } else {
      t1 = $[2];
    }
    return t1;
  }
  if (message.subtype === "memory_saved") {
    let t1;
    if ($[3] !== addMargin || $[4] !== message) {
      t1 = <MemorySavedMessage message={message} addMargin={addMargin} />;
      $[3] = addMargin;
      $[4] = message;
      $[5] = t1;
    } else {
      t1 = $[5];
    }
    return t1;
  }
  if (message.subtype === "away_summary") {
    const t1 = addMargin ? 1 : 0;
    let t2;
    if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
      t2 = <Box minWidth={2}><Text dimColor={true}>{REFERENCE_MARK}</Text></Box>;
      $[6] = t2;
    } else {
      t2 = $[6];
    }
    let t3;
    if ($[7] !== message.content) {
      t3 = <Text dimColor={true}>{message.content}</Text>;
      $[7] = message.content;
      $[8] = t3;
    } else {
      t3 = $[8];
    }
    let t4;
    if ($[9] !== bg || $[10] !== t1 || $[11] !== t3) {
      t4 = <Box flexDirection="row" marginTop={t1} backgroundColor={bg} width="100%">{t2}{t3}</Box>;
      $[9] = bg;
      $[10] = t1;
      $[11] = t3;
      $[12] = t4;
    } else {
      t4 = $[12];
    }
    return t4;
  }
  if (message.subtype === "agents_killed") {
    const t1 = addMargin ? 1 : 0;
    let t2;
    let t3;
    if ($[13] === Symbol.for("react.memo_cache_sentinel")) {
      t2 = <Box minWidth={2}><Text color="error">{BLACK_CIRCLE}</Text></Box>;
      t3 = <Text dimColor={true}>All background agents stopped</Text>;
      $[13] = t2;
      $[14] = t3;
    } else {
      t2 = $[13];
      t3 = $[14];
    }
    let t4;
    if ($[15] !== bg || $[16] !== t1) {
      t4 = <Box flexDirection="row" marginTop={t1} backgroundColor={bg} width="100%">{t2}{t3}</Box>;
      $[15] = bg;
      $[16] = t1;
      $[17] = t4;
    } else {
      t4 = $[17];
    }
    return t4;
  }
  if (message.subtype === "thinking") {
    return null;
  }
  if (message.subtype === "bridge_status") {
    let t1;
    if ($[18] !== addMargin || $[19] !== message) {
      t1 = <BridgeStatusMessage message={message} addMargin={addMargin} />;
      $[18] = addMargin;
      $[19] = message;
      $[20] = t1;
    } else {
      t1 = $[20];
    }
    return t1;
  }
  if (message.subtype === "scheduled_task_fire") {
    const t1 = addMargin ? 1 : 0;
    let t2;
    if ($[21] !== message.content) {
      t2 = <Text dimColor={true}>{TEARDROP_ASTERISK} {message.content}</Text>;
      $[21] = message.content;
      $[22] = t2;
    } else {
      t2 = $[22];
    }
    let t3;
    if ($[23] !== bg || $[24] !== t1 || $[25] !== t2) {
      t3 = <Box marginTop={t1} backgroundColor={bg} width="100%">{t2}</Box>;
      $[23] = bg;
      $[24] = t1;
      $[25] = t2;
      $[26] = t3;
    } else {
      t3 = $[26];
    }
    return t3;
  }
  if (message.subtype === "permission_retry") {
    const t1 = addMargin ? 1 : 0;
    let t2;
    let t3;
    if ($[27] === Symbol.for("react.memo_cache_sentinel")) {
      t2 = <Text dimColor={true}>{TEARDROP_ASTERISK} </Text>;
      t3 = <Text>Allowed </Text>;
      $[27] = t2;
      $[28] = t3;
    } else {
      t2 = $[27];
      t3 = $[28];
    }
    let t4;
    if ($[29] !== message.commands) {
      t4 = message.commands.join(", ");
      $[29] = message.commands;
      $[30] = t4;
    } else {
      t4 = $[30];
    }
    let t5;
    if ($[31] !== t4) {
      t5 = <Text bold={true}>{t4}</Text>;
      $[31] = t4;
      $[32] = t5;
    } else {
      t5 = $[32];
    }
    let t6;
    if ($[33] !== bg || $[34] !== t1 || $[35] !== t5) {
      t6 = <Box marginTop={t1} backgroundColor={bg} width="100%">{t2}{t3}{t5}</Box>;
      $[33] = bg;
      $[34] = t1;
      $[35] = t5;
      $[36] = t6;
    } else {
      t6 = $[36];
    }
    return t6;
  }
  const isStopHookSummary = message.subtype === "stop_hook_summary";
  if (!isStopHookSummary && !verbose && message.level === "info") {
    return null;
  }
  if (message.subtype === "api_error") {
    let t1;
    if ($[37] !== message || $[38] !== verbose) {
      t1 = <SystemAPIErrorMessage message={message} verbose={verbose} />;
      $[37] = message;
      $[38] = verbose;
      $[39] = t1;
    } else {
      t1 = $[39];
    }
    return t1;
  }
  if (message.subtype === "stop_hook_summary") {
    let t1;
    if ($[40] !== addMargin || $[41] !== isTranscriptMode || $[42] !== message || $[43] !== verbose) {
      t1 = <StopHookSummaryMessage message={message} addMargin={addMargin} verbose={verbose} isTranscriptMode={isTranscriptMode} />;
      $[40] = addMargin;
      $[41] = isTranscriptMode;
      $[42] = message;
      $[43] = verbose;
      $[44] = t1;
    } else {
      t1 = $[44];
    }
    return t1;
  }
  const content = message.content;
  if (typeof content !== "string") {
    return null;
  }
  const t1 = message.level !== "info";
  const t2 = message.level === "warning" ? "warning" : undefined;
  const t3 = message.level === "info";
  let t4;
  if ($[45] !== addMargin || $[46] !== content || $[47] !== t1 || $[48] !== t2 || $[49] !== t3) {
    t4 = <Box flexDirection="row" width="100%"><SystemTextMessageInner content={content} addMargin={addMargin} dot={t1} color={t2} dimColor={t3} /></Box>;
    $[45] = addMargin;
    $[46] = content;
    $[47] = t1;
    $[48] = t2;
    $[49] = t3;
    $[50] = t4;
  } else {
    t4 = $[50];
  }
  return t4;
}
function StopHookSummaryMessage(t0) {
  const $ = _c(47);
  const {
    message,
    addMargin,
    verbose,
    isTranscriptMode
  } = t0;
  const bg = useSelectedMessageBg();
  const {
    hookCount,
    hookInfos,
    hookErrors,
    preventedContinuation,
    stopReason
  } = message;
  const {
    columns
  } = useTerminalSize();
  let t1;
  if ($[0] !== hookInfos || $[1] !== message.totalDurationMs) {
    t1 = message.totalDurationMs ?? hookInfos.reduce(_temp, 0);
    $[0] = hookInfos;
    $[1] = message.totalDurationMs;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  const totalDurationMs = t1;
  if (hookErrors.length === 0 && !preventedContinuation && !message.hookLabel) {
    if (true || totalDurationMs < HOOK_TIMING_DISPLAY_THRESHOLD_MS) {
      return null;
    }
  }
  let t2;
  if ($[3] !== totalDurationMs) {
    t2 = false && totalDurationMs > 0 ? ` (${formatSecondsShort(totalDurationMs)})` : "";
    $[3] = totalDurationMs;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  const totalStr = t2;
  if (message.hookLabel) {
    const t3 = hookCount === 1 ? "hook" : "hooks";
    let t4;
    if ($[5] !== hookCount || $[6] !== message.hookLabel || $[7] !== t3 || $[8] !== totalStr) {
      t4 = <Text dimColor={true}>{"  \u23BF  "}Ran {hookCount} {message.hookLabel}{" "}{t3}{totalStr}</Text>;
      $[5] = hookCount;
      $[6] = message.hookLabel;
      $[7] = t3;
      $[8] = totalStr;
      $[9] = t4;
    } else {
      t4 = $[9];
    }
    let t5;
    if ($[10] !== hookInfos || $[11] !== isTranscriptMode) {
      t5 = isTranscriptMode && hookInfos.map(_temp2);
      $[10] = hookInfos;
      $[11] = isTranscriptMode;
      $[12] = t5;
    } else {
      t5 = $[12];
    }
    let t6;
    if ($[13] !== t4 || $[14] !== t5) {
      t6 = <Box flexDirection="column" width="100%">{t4}{t5}</Box>;
      $[13] = t4;
      $[14] = t5;
      $[15] = t6;
    } else {
      t6 = $[15];
    }
    return t6;
  }
  const t3 = addMargin ? 1 : 0;
  let t4;
  if ($[16] === Symbol.for("react.memo_cache_sentinel")) {
    t4 = <Box minWidth={2}><Text>{BLACK_CIRCLE}</Text></Box>;
    $[16] = t4;
  } else {
    t4 = $[16];
  }
  const t5 = columns - 10;
  let t6;
  if ($[17] !== hookCount) {
    t6 = <Text bold={true}>{hookCount}</Text>;
    $[17] = hookCount;
    $[18] = t6;
  } else {
    t6 = $[18];
  }
  const t7 = message.hookLabel ?? "stop";
  const t8 = hookCount === 1 ? "hook" : "hooks";
  let t9;
  if ($[19] !== hookInfos || $[20] !== verbose) {
    t9 = !verbose && hookInfos.length > 0 && <>{" "}<CtrlOToExpand /></>;
    $[19] = hookInfos;
    $[20] = verbose;
    $[21] = t9;
  } else {
    t9 = $[21];
  }
  let t10;
  if ($[22] !== t6 || $[23] !== t7 || $[24] !== t8 || $[25] !== t9 || $[26] !== totalStr) {
    t10 = <Text>Ran {t6} {t7}{" "}{t8}{totalStr}{t9}</Text>;
    $[22] = t6;
    $[23] = t7;
    $[24] = t8;
    $[25] = t9;
    $[26] = totalStr;
    $[27] = t10;
  } else {
    t10 = $[27];
  }
  let t11;
  if ($[28] !== hookInfos || $[29] !== verbose) {
    t11 = verbose && hookInfos.length > 0 && hookInfos.map(_temp3);
    $[28] = hookInfos;
    $[29] = verbose;
    $[30] = t11;
  } else {
    t11 = $[30];
  }
  let t12;
  if ($[31] !== preventedContinuation || $[32] !== stopReason) {
    t12 = preventedContinuation && stopReason && <Text><Text dimColor={true}>⎿  </Text>{stopReason}</Text>;
    $[31] = preventedContinuation;
    $[32] = stopReason;
    $[33] = t12;
  } else {
    t12 = $[33];
  }
  let t13;
  if ($[34] !== hookErrors || $[35] !== message.hookLabel) {
    t13 = hookErrors.length > 0 && hookErrors.map((err, idx_1) => <Text key={idx_1}><Text dimColor={true}>⎿  </Text>{message.hookLabel ?? "Stop"} hook error: {err}</Text>);
    $[34] = hookErrors;
    $[35] = message.hookLabel;
    $[36] = t13;
  } else {
    t13 = $[36];
  }
  let t14;
  if ($[37] !== t10 || $[38] !== t11 || $[39] !== t12 || $[40] !== t13 || $[41] !== t5) {
    t14 = <Box flexDirection="column" width={t5}>{t10}{t11}{t12}{t13}</Box>;
    $[37] = t10;
    $[38] = t11;
    $[39] = t12;
    $[40] = t13;
    $[41] = t5;
    $[42] = t14;
  } else {
    t14 = $[42];
  }
  let t15;
  if ($[43] !== bg || $[44] !== t14 || $[45] !== t3) {
    t15 = <Box flexDirection="row" marginTop={t3} backgroundColor={bg} width="100%">{t4}{t14}</Box>;
    $[43] = bg;
    $[44] = t14;
    $[45] = t3;
    $[46] = t15;
  } else {
    t15 = $[46];
  }
  return t15;
}
function _temp3(info_0, idx_0) {
  const durationStr_0 = false && info_0.durationMs !== undefined ? ` (${formatSecondsShort(info_0.durationMs)})` : "";
  return <Text key={`cmd-${idx_0}`} dimColor={true}>⎿  {info_0.command === "prompt" ? `prompt: ${info_0.promptText || ""}` : info_0.command}{durationStr_0}</Text>;
}
function _temp2(info, idx) {
  const durationStr = false && info.durationMs !== undefined ? ` (${formatSecondsShort(info.durationMs)})` : "";
  return <Text key={`cmd-${idx}`} dimColor={true}>{"     \u23BF "}{info.command === "prompt" ? `prompt: ${info.promptText || ""}` : info.command}{durationStr}</Text>;
}
function _temp(sum, h) {
  return sum + (h.durationMs ?? 0);
}
function SystemTextMessageInner(t0) {
  const $ = _c(18);
  const {
    content,
    addMargin,
    dot,
    color,
    dimColor
  } = t0;
  const {
    columns
  } = useTerminalSize();
  const bg = useSelectedMessageBg();
  const t1 = addMargin ? 1 : 0;
  let t2;
  if ($[0] !== color || $[1] !== dimColor || $[2] !== dot) {
    t2 = dot && <Box minWidth={2}><Text color={color} dimColor={dimColor}>{BLACK_CIRCLE}</Text></Box>;
    $[0] = color;
    $[1] = dimColor;
    $[2] = dot;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  const t3 = columns - 10;
  let t4;
  if ($[4] !== content) {
    t4 = content.trim();
    $[4] = content;
    $[5] = t4;
  } else {
    t4 = $[5];
  }
  let t5;
  if ($[6] !== color || $[7] !== dimColor || $[8] !== t4) {
    t5 = <Text color={color} dimColor={dimColor} wrap="wrap">{t4}</Text>;
    $[6] = color;
    $[7] = dimColor;
    $[8] = t4;
    $[9] = t5;
  } else {
    t5 = $[9];
  }
  let t6;
  if ($[10] !== t3 || $[11] !== t5) {
    t6 = <Box flexDirection="column" width={t3}>{t5}</Box>;
    $[10] = t3;
    $[11] = t5;
    $[12] = t6;
  } else {
    t6 = $[12];
  }
  let t7;
  if ($[13] !== bg || $[14] !== t1 || $[15] !== t2 || $[16] !== t6) {
    t7 = <Box flexDirection="row" marginTop={t1} backgroundColor={bg} width="100%">{t2}{t6}</Box>;
    $[13] = bg;
    $[14] = t1;
    $[15] = t2;
    $[16] = t6;
    $[17] = t7;
  } else {
    t7 = $[17];
  }
  return t7;
}
function TurnDurationMessage(t0) {
  const $ = _c(17);
  const {
    message,
    addMargin
  } = t0;
  const bg = useSelectedMessageBg();
  const [verb] = useState(_temp4);
  const store = useAppStateStore();
  let t1;
  if ($[0] !== store) {
    t1 = () => {
      const tasks = store.getState().tasks;
      const running = (Object.values(tasks ?? {}) as TaskState[]).filter(isBackgroundTask);
      return running.length > 0 ? getPillLabel(running) : null;
    };
    $[0] = store;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const [backgroundTaskSummary] = useState(t1);
  let t2;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = getGlobalConfig().showTurnDuration ?? true;
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  const showTurnDuration = t2;
  let t3;
  if ($[3] !== message.durationMs) {
    t3 = formatDuration(message.durationMs);
    $[3] = message.durationMs;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  const duration = t3;
  const hasBudget = message.budgetLimit !== undefined;
  let t4;
  bb0: {
    if (!hasBudget) {
      t4 = "";
      break bb0;
    }
    const tokens = message.budgetTokens;
    const limit = message.budgetLimit;
    let t5;
    if ($[5] !== limit || $[6] !== tokens) {
      t5 = tokens >= limit ? `${formatNumber(tokens)} used (${formatNumber(limit)} min ${figures.tick})` : `${formatNumber(tokens)} / ${formatNumber(limit)} (${Math.round(tokens / limit * 100)}%)`;
      $[5] = limit;
      $[6] = tokens;
      $[7] = t5;
    } else {
      t5 = $[7];
    }
    const usage = t5;
    const nudges = message.budgetNudges > 0 ? ` \u00B7 ${message.budgetNudges} ${message.budgetNudges === 1 ? "nudge" : "nudges"}` : "";
    t4 = `${showTurnDuration ? " \xB7 " : ""}${usage}${nudges}`;
  }
  const budgetSuffix = t4;
  if (!showTurnDuration && !hasBudget) {
    return null;
  }
  const t5 = addMargin ? 1 : 0;
  let t6;
  if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
    t6 = <Box minWidth={2}><Text dimColor={true}>{TEARDROP_ASTERISK}</Text></Box>;
    $[8] = t6;
  } else {
    t6 = $[8];
  }
  const t7 = showTurnDuration && `${verb} for ${duration}`;
  const t8 = backgroundTaskSummary && ` \u00B7 ${backgroundTaskSummary} still running`;
  let t9;
  if ($[9] !== budgetSuffix || $[10] !== t7 || $[11] !== t8) {
    t9 = <Text dimColor={true}>{t7}{budgetSuffix}{t8}</Text>;
    $[9] = budgetSuffix;
    $[10] = t7;
    $[11] = t8;
    $[12] = t9;
  } else {
    t9 = $[12];
  }
  let t10;
  if ($[13] !== bg || $[14] !== t5 || $[15] !== t9) {
    t10 = <Box flexDirection="row" marginTop={t5} backgroundColor={bg} width="100%">{t6}{t9}</Box>;
    $[13] = bg;
    $[14] = t5;
    $[15] = t9;
    $[16] = t10;
  } else {
    t10 = $[16];
  }
  return t10;
}
function _temp4() {
  return sample(TURN_COMPLETION_VERBS) ?? "Worked";
}
function MemorySavedMessage(t0) {
  const $ = _c(16);
  const {
    message,
    addMargin
  } = t0;
  const bg = useSelectedMessageBg();
  const {
    writtenPaths
  } = message;
  let t1;
  if ($[0] !== message) {
    t1 = feature("TEAMMEM") ? teamMemSaved.teamMemSavedPart(message) : null;
    $[0] = message;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const team = t1;
  const privateCount = writtenPaths.length - (team?.count ?? 0);
  const t2 = privateCount > 0 ? `${privateCount} ${privateCount === 1 ? "memory" : "memories"}` : null;
  const t3 = team?.segment;
  let t4;
  if ($[2] !== t2 || $[3] !== t3) {
    t4 = [t2, t3].filter(Boolean);
    $[2] = t2;
    $[3] = t3;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  const parts = t4;
  const t5 = addMargin ? 1 : 0;
  let t6;
  if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
    t6 = <Box minWidth={2}><Text dimColor={true}>{BLACK_CIRCLE}</Text></Box>;
    $[5] = t6;
  } else {
    t6 = $[5];
  }
  const t7 = message.verb ?? "Saved";
  const t8 = parts.join(" \xB7 ");
  let t9;
  if ($[6] !== t7 || $[7] !== t8) {
    t9 = <Box flexDirection="row">{t6}<Text>{t7} {t8}</Text></Box>;
    $[6] = t7;
    $[7] = t8;
    $[8] = t9;
  } else {
    t9 = $[8];
  }
  let t10;
  if ($[9] !== writtenPaths) {
    t10 = writtenPaths.map(_temp5);
    $[9] = writtenPaths;
    $[10] = t10;
  } else {
    t10 = $[10];
  }
  let t11;
  if ($[11] !== bg || $[12] !== t10 || $[13] !== t5 || $[14] !== t9) {
    t11 = <Box flexDirection="column" marginTop={t5} backgroundColor={bg}>{t9}{t10}</Box>;
    $[11] = bg;
    $[12] = t10;
    $[13] = t5;
    $[14] = t9;
    $[15] = t11;
  } else {
    t11 = $[15];
  }
  return t11;
}
function _temp5(p) {
  return <MemoryFileRow key={p} path={p} />;
}
function MemoryFileRow(t0) {
  const $ = _c(16);
  const {
    path
  } = t0;
  const [hover, setHover] = useState(false);
  let t1;
  if ($[0] !== path) {
    t1 = () => void openPath(path);
    $[0] = path;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  let t2;
  let t3;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = () => setHover(true);
    t3 = () => setHover(false);
    $[2] = t2;
    $[3] = t3;
  } else {
    t2 = $[2];
    t3 = $[3];
  }
  const t4 = !hover;
  let t5;
  if ($[4] !== path) {
    t5 = basename(path);
    $[4] = path;
    $[5] = t5;
  } else {
    t5 = $[5];
  }
  let t6;
  if ($[6] !== path || $[7] !== t5) {
    t6 = <FilePathLink filePath={path}>{t5}</FilePathLink>;
    $[6] = path;
    $[7] = t5;
    $[8] = t6;
  } else {
    t6 = $[8];
  }
  let t7;
  if ($[9] !== hover || $[10] !== t4 || $[11] !== t6) {
    t7 = <Text dimColor={t4} underline={hover}>{t6}</Text>;
    $[9] = hover;
    $[10] = t4;
    $[11] = t6;
    $[12] = t7;
  } else {
    t7 = $[12];
  }
  let t8;
  if ($[13] !== t1 || $[14] !== t7) {
    t8 = <MessageResponse><Box onClick={t1} onMouseEnter={t2} onMouseLeave={t3}>{t7}</Box></MessageResponse>;
    $[13] = t1;
    $[14] = t7;
    $[15] = t8;
  } else {
    t8 = $[15];
  }
  return t8;
}
function ThinkingMessage(t0) {
  const $ = _c(7);
  const {
    message,
    addMargin
  } = t0;
  const bg = useSelectedMessageBg();
  const t1 = addMargin ? 1 : 0;
  let t2;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Box minWidth={2}><Text dimColor={true}>{TEARDROP_ASTERISK}</Text></Box>;
    $[0] = t2;
  } else {
    t2 = $[0];
  }
  let t3;
  if ($[1] !== message.content) {
    t3 = <Text dimColor={true}>{message.content}</Text>;
    $[1] = message.content;
    $[2] = t3;
  } else {
    t3 = $[2];
  }
  let t4;
  if ($[3] !== bg || $[4] !== t1 || $[5] !== t3) {
    t4 = <Box flexDirection="row" marginTop={t1} backgroundColor={bg} width="100%">{t2}{t3}</Box>;
    $[3] = bg;
    $[4] = t1;
    $[5] = t3;
    $[6] = t4;
  } else {
    t4 = $[6];
  }
  return t4;
}
function BridgeStatusMessage(t0) {
  const $ = _c(13);
  const {
    message,
    addMargin
  } = t0;
  const bg = useSelectedMessageBg();
  const t1 = addMargin ? 1 : 0;
  let t2;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Box minWidth={2} />;
    $[0] = t2;
  } else {
    t2 = $[0];
  }
  let t3;
  if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = <Text><ThemedText color="suggestion">/remote-control</ThemedText> is active. Code in CLI or at</Text>;
    $[1] = t3;
  } else {
    t3 = $[1];
  }
  let t4;
  if ($[2] !== message.url) {
    t4 = <Link url={message.url}>{message.url}</Link>;
    $[2] = message.url;
    $[3] = t4;
  } else {
    t4 = $[3];
  }
  let t5;
  if ($[4] !== message.upgradeNudge) {
    t5 = message.upgradeNudge && <Text dimColor={true}>⎿ {message.upgradeNudge}</Text>;
    $[4] = message.upgradeNudge;
    $[5] = t5;
  } else {
    t5 = $[5];
  }
  let t6;
  if ($[6] !== t4 || $[7] !== t5) {
    t6 = <Box flexDirection="column">{t3}{t4}{t5}</Box>;
    $[6] = t4;
    $[7] = t5;
    $[8] = t6;
  } else {
    t6 = $[8];
  }
  let t7;
  if ($[9] !== bg || $[10] !== t1 || $[11] !== t6) {
    t7 = <Box flexDirection="row" marginTop={t1} backgroundColor={bg} width={999}>{t2}{t6}</Box>;
    $[9] = bg;
    $[10] = t1;
    $[11] = t6;
    $[12] = t7;
  } else {
    t7 = $[12];
  }
  return t7;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJCb3giLCJUZXh0IiwiVGV4dFByb3BzIiwiZmVhdHVyZSIsIlJlYWN0IiwidXNlU3RhdGUiLCJzYW1wbGUiLCJCTEFDS19DSVJDTEUiLCJSRUZFUkVOQ0VfTUFSSyIsIlRFQVJEUk9QX0FTVEVSSVNLIiwiZmlndXJlcyIsImJhc2VuYW1lIiwiTWVzc2FnZVJlc3BvbnNlIiwiRmlsZVBhdGhMaW5rIiwib3BlblBhdGgiLCJ0ZWFtTWVtU2F2ZWQiLCJyZXF1aXJlIiwiVFVSTl9DT01QTEVUSU9OX1ZFUkJTIiwidXNlVGVybWluYWxTaXplIiwiU3lzdGVtTWVzc2FnZSIsIlN5c3RlbVN0b3BIb29rU3VtbWFyeU1lc3NhZ2UiLCJTeXN0ZW1CcmlkZ2VTdGF0dXNNZXNzYWdlIiwiU3lzdGVtVHVybkR1cmF0aW9uTWVzc2FnZSIsIlN5c3RlbVRoaW5raW5nTWVzc2FnZSIsIlN5c3RlbU1lbW9yeVNhdmVkTWVzc2FnZSIsIlN5c3RlbUFQSUVycm9yTWVzc2FnZSIsImZvcm1hdER1cmF0aW9uIiwiZm9ybWF0TnVtYmVyIiwiZm9ybWF0U2Vjb25kc1Nob3J0IiwiZ2V0R2xvYmFsQ29uZmlnIiwiTGluayIsIlRoZW1lZFRleHQiLCJDdHJsT1RvRXhwYW5kIiwidXNlQXBwU3RhdGVTdG9yZSIsImlzQmFja2dyb3VuZFRhc2siLCJUYXNrU3RhdGUiLCJnZXRQaWxsTGFiZWwiLCJ1c2VTZWxlY3RlZE1lc3NhZ2VCZyIsIlByb3BzIiwibWVzc2FnZSIsImFkZE1hcmdpbiIsInZlcmJvc2UiLCJpc1RyYW5zY3JpcHRNb2RlIiwiU3lzdGVtVGV4dE1lc3NhZ2UiLCJ0MCIsIiQiLCJfYyIsImJnIiwic3VidHlwZSIsInQxIiwidDIiLCJTeW1ib2wiLCJmb3IiLCJ0MyIsImNvbnRlbnQiLCJ0NCIsImNvbW1hbmRzIiwiam9pbiIsInQ1IiwidDYiLCJpc1N0b3BIb29rU3VtbWFyeSIsImxldmVsIiwidW5kZWZpbmVkIiwiU3RvcEhvb2tTdW1tYXJ5TWVzc2FnZSIsImhvb2tDb3VudCIsImhvb2tJbmZvcyIsImhvb2tFcnJvcnMiLCJwcmV2ZW50ZWRDb250aW51YXRpb24iLCJzdG9wUmVhc29uIiwiY29sdW1ucyIsInRvdGFsRHVyYXRpb25NcyIsInJlZHVjZSIsIl90ZW1wIiwibGVuZ3RoIiwiaG9va0xhYmVsIiwiSE9PS19USU1JTkdfRElTUExBWV9USFJFU0hPTERfTVMiLCJ0b3RhbFN0ciIsIm1hcCIsIl90ZW1wMiIsInQ3IiwidDgiLCJ0OSIsInQxMCIsInQxMSIsIl90ZW1wMyIsInQxMiIsInQxMyIsImVyciIsImlkeF8xIiwiaWR4IiwidDE0IiwidDE1IiwiaW5mb18wIiwiaWR4XzAiLCJkdXJhdGlvblN0cl8wIiwiaW5mbyIsImR1cmF0aW9uTXMiLCJjb21tYW5kIiwicHJvbXB0VGV4dCIsImR1cmF0aW9uU3RyIiwic3VtIiwiaCIsIlN5c3RlbVRleHRNZXNzYWdlSW5uZXIiLCJkb3QiLCJjb2xvciIsImRpbUNvbG9yIiwidHJpbSIsIlR1cm5EdXJhdGlvbk1lc3NhZ2UiLCJ2ZXJiIiwiX3RlbXA0Iiwic3RvcmUiLCJ0YXNrcyIsImdldFN0YXRlIiwicnVubmluZyIsIk9iamVjdCIsInZhbHVlcyIsImZpbHRlciIsImJhY2tncm91bmRUYXNrU3VtbWFyeSIsInNob3dUdXJuRHVyYXRpb24iLCJkdXJhdGlvbiIsImhhc0J1ZGdldCIsImJ1ZGdldExpbWl0IiwiYmIwIiwidG9rZW5zIiwiYnVkZ2V0VG9rZW5zIiwibGltaXQiLCJ0aWNrIiwiTWF0aCIsInJvdW5kIiwidXNhZ2UiLCJudWRnZXMiLCJidWRnZXROdWRnZXMiLCJidWRnZXRTdWZmaXgiLCJNZW1vcnlTYXZlZE1lc3NhZ2UiLCJ3cml0dGVuUGF0aHMiLCJ0ZWFtTWVtU2F2ZWRQYXJ0IiwidGVhbSIsInByaXZhdGVDb3VudCIsImNvdW50Iiwic2VnbWVudCIsIkJvb2xlYW4iLCJwYXJ0cyIsIl90ZW1wNSIsInAiLCJNZW1vcnlGaWxlUm93IiwicGF0aCIsImhvdmVyIiwic2V0SG92ZXIiLCJUaGlua2luZ01lc3NhZ2UiLCJCcmlkZ2VTdGF0dXNNZXNzYWdlIiwidXJsIiwidXBncmFkZU51ZGdlIl0sInNvdXJjZXMiOlsiU3lzdGVtVGV4dE1lc3NhZ2UudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8vIGJpb21lLWlnbm9yZS1hbGwgYXNzaXN0L3NvdXJjZS9vcmdhbml6ZUltcG9ydHM6IEFOVC1PTkxZIGltcG9ydCBtYXJrZXJzIG11c3Qgbm90IGJlIHJlb3JkZXJlZFxuaW1wb3J0IHsgQm94LCBUZXh0LCB0eXBlIFRleHRQcm9wcyB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHNhbXBsZSBmcm9tICdsb2Rhc2gtZXMvc2FtcGxlLmpzJ1xuaW1wb3J0IHtcbiAgQkxBQ0tfQ0lSQ0xFLFxuICBSRUZFUkVOQ0VfTUFSSyxcbiAgVEVBUkRST1BfQVNURVJJU0ssXG59IGZyb20gJy4uLy4uL2NvbnN0YW50cy9maWd1cmVzLmpzJ1xuaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAncGF0aCdcbmltcG9ydCB7IE1lc3NhZ2VSZXNwb25zZSB9IGZyb20gJy4uL01lc3NhZ2VSZXNwb25zZS5qcydcbmltcG9ydCB7IEZpbGVQYXRoTGluayB9IGZyb20gJy4uL0ZpbGVQYXRoTGluay5qcydcbmltcG9ydCB7IG9wZW5QYXRoIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnJvd3Nlci5qcydcbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmNvbnN0IHRlYW1NZW1TYXZlZCA9IGZlYXR1cmUoJ1RFQU1NRU0nKVxuICA/IChyZXF1aXJlKCcuL3RlYW1NZW1TYXZlZC5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vdGVhbU1lbVNhdmVkLmpzJykpXG4gIDogbnVsbFxuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5pbXBvcnQgeyBUVVJOX0NPTVBMRVRJT05fVkVSQlMgfSBmcm9tICcuLi8uLi9jb25zdGFudHMvdHVybkNvbXBsZXRpb25WZXJicy5qcydcbmltcG9ydCB7IHVzZVRlcm1pbmFsU2l6ZSB9IGZyb20gJy4uLy4uL2hvb2tzL3VzZVRlcm1pbmFsU2l6ZS5qcydcbmltcG9ydCB0eXBlIHtcbiAgU3lzdGVtTWVzc2FnZSxcbiAgU3lzdGVtU3RvcEhvb2tTdW1tYXJ5TWVzc2FnZSxcbiAgU3lzdGVtQnJpZGdlU3RhdHVzTWVzc2FnZSxcbiAgU3lzdGVtVHVybkR1cmF0aW9uTWVzc2FnZSxcbiAgU3lzdGVtVGhpbmtpbmdNZXNzYWdlLFxuICBTeXN0ZW1NZW1vcnlTYXZlZE1lc3NhZ2UsXG59IGZyb20gJy4uLy4uL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgeyBTeXN0ZW1BUElFcnJvck1lc3NhZ2UgfSBmcm9tICcuL1N5c3RlbUFQSUVycm9yTWVzc2FnZS5qcydcbmltcG9ydCB7XG4gIGZvcm1hdER1cmF0aW9uLFxuICBmb3JtYXROdW1iZXIsXG4gIGZvcm1hdFNlY29uZHNTaG9ydCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvZm9ybWF0LmpzJ1xuaW1wb3J0IHsgZ2V0R2xvYmFsQ29uZmlnIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJ1xuaW1wb3J0IExpbmsgZnJvbSAnLi4vLi4vaW5rL2NvbXBvbmVudHMvTGluay5qcydcbmltcG9ydCBUaGVtZWRUZXh0IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vVGhlbWVkVGV4dC5qcydcbmltcG9ydCB7IEN0cmxPVG9FeHBhbmQgfSBmcm9tICcuLi9DdHJsT1RvRXhwYW5kLmpzJ1xuaW1wb3J0IHsgdXNlQXBwU3RhdGVTdG9yZSB9IGZyb20gJy4uLy4uL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHsgaXNCYWNrZ3JvdW5kVGFzaywgdHlwZSBUYXNrU3RhdGUgfSBmcm9tICcuLi8uLi90YXNrcy90eXBlcy5qcydcbmltcG9ydCB7IGdldFBpbGxMYWJlbCB9IGZyb20gJy4uLy4uL3Rhc2tzL3BpbGxMYWJlbC5qcydcbmltcG9ydCB7IHVzZVNlbGVjdGVkTWVzc2FnZUJnIH0gZnJvbSAnLi4vbWVzc2FnZUFjdGlvbnMuanMnXG5cbnR5cGUgUHJvcHMgPSB7XG4gIG1lc3NhZ2U6IFN5c3RlbU1lc3NhZ2VcbiAgYWRkTWFyZ2luOiBib29sZWFuXG4gIHZlcmJvc2U6IGJvb2xlYW5cbiAgaXNUcmFuc2NyaXB0TW9kZT86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFN5c3RlbVRleHRNZXNzYWdlKHtcbiAgbWVzc2FnZSxcbiAgYWRkTWFyZ2luLFxuICB2ZXJib3NlLFxuICBpc1RyYW5zY3JpcHRNb2RlLFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBiZyA9IHVzZVNlbGVjdGVkTWVzc2FnZUJnKClcbiAgLy8gVHVybiBkdXJhdGlvbiBtZXNzYWdlcyBhcmUgYWx3YXlzIHNob3duIGluIGdyZXlcbiAgaWYgKG1lc3NhZ2Uuc3VidHlwZSA9PT0gJ3R1cm5fZHVyYXRpb24nKSB7XG4gICAgcmV0dXJuIDxUdXJuRHVyYXRpb25NZXNzYWdlIG1lc3NhZ2U9e21lc3NhZ2V9IGFkZE1hcmdpbj17YWRkTWFyZ2lufSAvPlxuICB9XG5cbiAgaWYgKG1lc3NhZ2Uuc3VidHlwZSA9PT0gJ21lbW9yeV9zYXZlZCcpIHtcbiAgICByZXR1cm4gPE1lbW9yeVNhdmVkTWVzc2FnZSBtZXNzYWdlPXttZXNzYWdlfSBhZGRNYXJnaW49e2FkZE1hcmdpbn0gLz5cbiAgfVxuXG4gIGlmIChtZXNzYWdlLnN1YnR5cGUgPT09ICdhd2F5X3N1bW1hcnknKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3hcbiAgICAgICAgZmxleERpcmVjdGlvbj1cInJvd1wiXG4gICAgICAgIG1hcmdpblRvcD17YWRkTWFyZ2luID8gMSA6IDB9XG4gICAgICAgIGJhY2tncm91bmRDb2xvcj17Ymd9XG4gICAgICAgIHdpZHRoPVwiMTAwJVwiXG4gICAgICA+XG4gICAgICAgIDxCb3ggbWluV2lkdGg9ezJ9PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntSRUZFUkVOQ0VfTUFSS308L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj57bWVzc2FnZS5jb250ZW50fTwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIEFnZW50cyBraWxsZWQgY29uZmlybWF0aW9uXG4gIGlmIChtZXNzYWdlLnN1YnR5cGUgPT09ICdhZ2VudHNfa2lsbGVkJykge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94XG4gICAgICAgIGZsZXhEaXJlY3Rpb249XCJyb3dcIlxuICAgICAgICBtYXJnaW5Ub3A9e2FkZE1hcmdpbiA/IDEgOiAwfVxuICAgICAgICBiYWNrZ3JvdW5kQ29sb3I9e2JnfVxuICAgICAgICB3aWR0aD1cIjEwMCVcIlxuICAgICAgPlxuICAgICAgICA8Qm94IG1pbldpZHRoPXsyfT5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+e0JMQUNLX0NJUkNMRX08L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5BbGwgYmFja2dyb3VuZCBhZ2VudHMgc3RvcHBlZDwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIFRoaW5raW5nIG1lc3NhZ2VzIGFyZSBzdWJ0bGUsIGxpa2UgdHVybiBkdXJhdGlvbiAoYW50LW9ubHkpXG4gIGlmIChtZXNzYWdlLnN1YnR5cGUgPT09ICd0aGlua2luZycpIHtcbiAgICBpZiAoXCJleHRlcm5hbFwiID09PSAnYW50Jykge1xuICAgICAgcmV0dXJuIDxUaGlua2luZ01lc3NhZ2UgbWVzc2FnZT17bWVzc2FnZX0gYWRkTWFyZ2luPXthZGRNYXJnaW59IC8+XG4gICAgfVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuXG4gIGlmIChtZXNzYWdlLnN1YnR5cGUgPT09ICdicmlkZ2Vfc3RhdHVzJykge1xuICAgIHJldHVybiA8QnJpZGdlU3RhdHVzTWVzc2FnZSBtZXNzYWdlPXttZXNzYWdlfSBhZGRNYXJnaW49e2FkZE1hcmdpbn0gLz5cbiAgfVxuXG4gIGlmIChtZXNzYWdlLnN1YnR5cGUgPT09ICdzY2hlZHVsZWRfdGFza19maXJlJykge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IG1hcmdpblRvcD17YWRkTWFyZ2luID8gMSA6IDB9IGJhY2tncm91bmRDb2xvcj17Ymd9IHdpZHRoPVwiMTAwJVwiPlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICB7VEVBUkRST1BfQVNURVJJU0t9IHttZXNzYWdlLmNvbnRlbnR9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIGlmIChtZXNzYWdlLnN1YnR5cGUgPT09ICdwZXJtaXNzaW9uX3JldHJ5Jykge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IG1hcmdpblRvcD17YWRkTWFyZ2luID8gMSA6IDB9IGJhY2tncm91bmRDb2xvcj17Ymd9IHdpZHRoPVwiMTAwJVwiPlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj57VEVBUkRST1BfQVNURVJJU0t9IDwvVGV4dD5cbiAgICAgICAgPFRleHQ+QWxsb3dlZCA8L1RleHQ+XG4gICAgICAgIDxUZXh0IGJvbGQ+e21lc3NhZ2UuY29tbWFuZHMuam9pbignLCAnKX08L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICAvLyBTdG9wIGhvb2sgc3VtbWFyaWVzIHNob3VsZCBhbHdheXMgYmUgdmlzaWJsZVxuICBjb25zdCBpc1N0b3BIb29rU3VtbWFyeSA9IG1lc3NhZ2Uuc3VidHlwZSA9PT0gJ3N0b3BfaG9va19zdW1tYXJ5J1xuXG4gIGlmICghaXNTdG9wSG9va1N1bW1hcnkgJiYgIXZlcmJvc2UgJiYgbWVzc2FnZS5sZXZlbCA9PT0gJ2luZm8nKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGlmIChtZXNzYWdlLnN1YnR5cGUgPT09ICdhcGlfZXJyb3InKSB7XG4gICAgcmV0dXJuIDxTeXN0ZW1BUElFcnJvck1lc3NhZ2UgbWVzc2FnZT17bWVzc2FnZX0gdmVyYm9zZT17dmVyYm9zZX0gLz5cbiAgfVxuXG4gIGlmIChtZXNzYWdlLnN1YnR5cGUgPT09ICdzdG9wX2hvb2tfc3VtbWFyeScpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPFN0b3BIb29rU3VtbWFyeU1lc3NhZ2VcbiAgICAgICAgbWVzc2FnZT17bWVzc2FnZX1cbiAgICAgICAgYWRkTWFyZ2luPXthZGRNYXJnaW59XG4gICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2lzVHJhbnNjcmlwdE1vZGV9XG4gICAgICAvPlxuICAgIClcbiAgfVxuXG4gIGNvbnN0IGNvbnRlbnQgPSBtZXNzYWdlLmNvbnRlbnRcbiAgLy8gSW4gY2FzZSB0aGUgZXZlbnQgZG9lc24ndCBoYXZlIGEgY29udGVudFxuICAvLyB2YWxpZGF0aW9uLCBzbyBjb250ZW50IGNhbiBiZSB1bmRlZmluZWQgYXQgcnVudGltZSBkZXNwaXRlIHRoZSB0eXBlcy5cbiAgaWYgKHR5cGVvZiBjb250ZW50ICE9PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBudWxsXG4gIH1cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiB3aWR0aD1cIjEwMCVcIj5cbiAgICAgIDxTeXN0ZW1UZXh0TWVzc2FnZUlubmVyXG4gICAgICAgIGNvbnRlbnQ9e2NvbnRlbnR9XG4gICAgICAgIGFkZE1hcmdpbj17YWRkTWFyZ2lufVxuICAgICAgICBkb3Q9e21lc3NhZ2UubGV2ZWwgIT09ICdpbmZvJ31cbiAgICAgICAgY29sb3I9e21lc3NhZ2UubGV2ZWwgPT09ICd3YXJuaW5nJyA/ICd3YXJuaW5nJyA6IHVuZGVmaW5lZH1cbiAgICAgICAgZGltQ29sb3I9e21lc3NhZ2UubGV2ZWwgPT09ICdpbmZvJ31cbiAgICAgIC8+XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZnVuY3Rpb24gU3RvcEhvb2tTdW1tYXJ5TWVzc2FnZSh7XG4gIG1lc3NhZ2UsXG4gIGFkZE1hcmdpbixcbiAgdmVyYm9zZSxcbiAgaXNUcmFuc2NyaXB0TW9kZSxcbn06IHtcbiAgbWVzc2FnZTogU3lzdGVtU3RvcEhvb2tTdW1tYXJ5TWVzc2FnZVxuICBhZGRNYXJnaW46IGJvb2xlYW5cbiAgdmVyYm9zZTogYm9vbGVhblxuICBpc1RyYW5zY3JpcHRNb2RlPzogYm9vbGVhblxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IGJnID0gdXNlU2VsZWN0ZWRNZXNzYWdlQmcoKVxuICBjb25zdCB7XG4gICAgaG9va0NvdW50LFxuICAgIGhvb2tJbmZvcyxcbiAgICBob29rRXJyb3JzLFxuICAgIHByZXZlbnRlZENvbnRpbnVhdGlvbixcbiAgICBzdG9wUmVhc29uLFxuICB9ID0gbWVzc2FnZVxuICBjb25zdCB7IGNvbHVtbnMgfSA9IHVzZVRlcm1pbmFsU2l6ZSgpXG5cbiAgLy8gUHJlZmVyIHdhbGwtY2xvY2sgdGltZSB3aGVuIGF2YWlsYWJsZSAoaG9va3MgcnVuIGluIHBhcmFsbGVsKVxuICBjb25zdCB0b3RhbER1cmF0aW9uTXMgPVxuICAgIG1lc3NhZ2UudG90YWxEdXJhdGlvbk1zID8/XG4gICAgaG9va0luZm9zLnJlZHVjZSgoc3VtLCBoKSA9PiBzdW0gKyAoaC5kdXJhdGlvbk1zID8/IDApLCAwKVxuICBjb25zdCBpc0FudCA9IFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCdcblxuICAvLyBPbmx5IHNob3cgc3VtbWFyeSBpZiB0aGVyZSBhcmUgZXJyb3JzIG9yIGNvbnRpbnVhdGlvbiB3YXMgcHJldmVudGVkXG4gIC8vIEZvciBhbnRzOiBhbHNvIHNob3cgd2hlbiBob29rcyB0b29rID4gNTAwbXNcbiAgLy8gTm9uLXN0b3AgaG9va3MgKGUuZy4gUHJlVG9vbFVzZSkgYXJlIHByZS1maWx0ZXJlZCBieSB0aGUgY2FsbGVyXG4gIGlmIChob29rRXJyb3JzLmxlbmd0aCA9PT0gMCAmJiAhcHJldmVudGVkQ29udGludWF0aW9uICYmICFtZXNzYWdlLmhvb2tMYWJlbCkge1xuICAgIGlmICghaXNBbnQgfHwgdG90YWxEdXJhdGlvbk1zIDwgSE9PS19USU1JTkdfRElTUExBWV9USFJFU0hPTERfTVMpIHtcbiAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICB9XG5cbiAgY29uc3QgdG90YWxTdHIgPVxuICAgIGlzQW50ICYmIHRvdGFsRHVyYXRpb25NcyA+IDBcbiAgICAgID8gYCAoJHtmb3JtYXRTZWNvbmRzU2hvcnQodG90YWxEdXJhdGlvbk1zKX0pYFxuICAgICAgOiAnJ1xuICAvLyBOb24tc3RvcCBob29rcyAoZS5nLiBQcmVUb29sVXNlKSByZW5kZXIgYXMgYSBjaGlsZCBsaW5lIHdpdGhvdXQgYnVsbGV0XG4gIGlmIChtZXNzYWdlLmhvb2tMYWJlbCkge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD1cIjEwMCVcIj5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgeycgIOKOvyAgJ31SYW4ge2hvb2tDb3VudH0ge21lc3NhZ2UuaG9va0xhYmVsfXsnICd9XG4gICAgICAgICAge2hvb2tDb3VudCA9PT0gMSA/ICdob29rJyA6ICdob29rcyd9XG4gICAgICAgICAge3RvdGFsU3RyfVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIHtpc1RyYW5zY3JpcHRNb2RlICYmXG4gICAgICAgICAgaG9va0luZm9zLm1hcCgoaW5mbywgaWR4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkdXJhdGlvblN0ciA9XG4gICAgICAgICAgICAgIGlzQW50ICYmIGluZm8uZHVyYXRpb25NcyAhPT0gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgPyBgICgke2Zvcm1hdFNlY29uZHNTaG9ydChpbmZvLmR1cmF0aW9uTXMpfSlgXG4gICAgICAgICAgICAgICAgOiAnJ1xuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgPFRleHQga2V5PXtgY21kLSR7aWR4fWB9IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgIHsnICAgICDijr8gJ31cbiAgICAgICAgICAgICAgICB7aW5mby5jb21tYW5kID09PSAncHJvbXB0J1xuICAgICAgICAgICAgICAgICAgPyBgcHJvbXB0OiAke2luZm8ucHJvbXB0VGV4dCB8fCAnJ31gXG4gICAgICAgICAgICAgICAgICA6IGluZm8uY29tbWFuZH1cbiAgICAgICAgICAgICAgICB7ZHVyYXRpb25TdHJ9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIClcbiAgICAgICAgICB9KX1cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPEJveFxuICAgICAgZmxleERpcmVjdGlvbj1cInJvd1wiXG4gICAgICBtYXJnaW5Ub3A9e2FkZE1hcmdpbiA/IDEgOiAwfVxuICAgICAgYmFja2dyb3VuZENvbG9yPXtiZ31cbiAgICAgIHdpZHRoPVwiMTAwJVwiXG4gICAgPlxuICAgICAgPEJveCBtaW5XaWR0aD17Mn0+XG4gICAgICAgIDxUZXh0PntCTEFDS19DSVJDTEV9PC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD17Y29sdW1ucyAtIDEwfT5cbiAgICAgICAgPFRleHQ+XG4gICAgICAgICAgUmFuIDxUZXh0IGJvbGQ+e2hvb2tDb3VudH08L1RleHQ+IHttZXNzYWdlLmhvb2tMYWJlbCA/PyAnc3RvcCd9eycgJ31cbiAgICAgICAgICB7aG9va0NvdW50ID09PSAxID8gJ2hvb2snIDogJ2hvb2tzJ31cbiAgICAgICAgICB7dG90YWxTdHJ9XG4gICAgICAgICAgeyF2ZXJib3NlICYmIGhvb2tJbmZvcy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgIHsnICd9XG4gICAgICAgICAgICAgIDxDdHJsT1RvRXhwYW5kIC8+XG4gICAgICAgICAgICA8Lz5cbiAgICAgICAgICApfVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIHt2ZXJib3NlICYmXG4gICAgICAgICAgaG9va0luZm9zLmxlbmd0aCA+IDAgJiZcbiAgICAgICAgICBob29rSW5mb3MubWFwKChpbmZvLCBpZHgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGR1cmF0aW9uU3RyID1cbiAgICAgICAgICAgICAgaXNBbnQgJiYgaW5mby5kdXJhdGlvbk1zICE9PSB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICA/IGAgKCR7Zm9ybWF0U2Vjb25kc1Nob3J0KGluZm8uZHVyYXRpb25Ncyl9KWBcbiAgICAgICAgICAgICAgICA6ICcnXG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8VGV4dCBrZXk9e2BjbWQtJHtpZHh9YH0gZGltQ29sb3I+XG4gICAgICAgICAgICAgICAg4o6/ICZuYnNwO1xuICAgICAgICAgICAgICAgIHtpbmZvLmNvbW1hbmQgPT09ICdwcm9tcHQnXG4gICAgICAgICAgICAgICAgICA/IGBwcm9tcHQ6ICR7aW5mby5wcm9tcHRUZXh0IHx8ICcnfWBcbiAgICAgICAgICAgICAgICAgIDogaW5mby5jb21tYW5kfVxuICAgICAgICAgICAgICAgIHtkdXJhdGlvblN0cn1cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKVxuICAgICAgICAgIH0pfVxuICAgICAgICB7cHJldmVudGVkQ29udGludWF0aW9uICYmIHN0b3BSZWFzb24gJiYgKFxuICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+4o6/ICZuYnNwOzwvVGV4dD5cbiAgICAgICAgICAgIHtzdG9wUmVhc29ufVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgKX1cbiAgICAgICAge2hvb2tFcnJvcnMubGVuZ3RoID4gMCAmJlxuICAgICAgICAgIGhvb2tFcnJvcnMubWFwKChlcnIsIGlkeCkgPT4gKFxuICAgICAgICAgICAgPFRleHQga2V5PXtpZHh9PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj7ijr8gJm5ic3A7PC9UZXh0PlxuICAgICAgICAgICAgICB7bWVzc2FnZS5ob29rTGFiZWwgPz8gJ1N0b3AnfSBob29rIGVycm9yOiB7ZXJyfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICkpfVxuICAgICAgPC9Cb3g+XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZnVuY3Rpb24gU3lzdGVtVGV4dE1lc3NhZ2VJbm5lcih7XG4gIGNvbnRlbnQsXG4gIGFkZE1hcmdpbixcbiAgZG90LFxuICBjb2xvcixcbiAgZGltQ29sb3IsXG59OiB7XG4gIGNvbnRlbnQ6IHN0cmluZ1xuICBhZGRNYXJnaW46IGJvb2xlYW5cbiAgZG90OiBib29sZWFuXG4gIGNvbG9yPzogVGV4dFByb3BzWydjb2xvciddXG4gIGRpbUNvbG9yPzogYm9vbGVhblxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHsgY29sdW1ucyB9ID0gdXNlVGVybWluYWxTaXplKClcbiAgY29uc3QgYmcgPSB1c2VTZWxlY3RlZE1lc3NhZ2VCZygpXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBmbGV4RGlyZWN0aW9uPVwicm93XCJcbiAgICAgIG1hcmdpblRvcD17YWRkTWFyZ2luID8gMSA6IDB9XG4gICAgICBiYWNrZ3JvdW5kQ29sb3I9e2JnfVxuICAgICAgd2lkdGg9XCIxMDAlXCJcbiAgICA+XG4gICAgICB7ZG90ICYmIChcbiAgICAgICAgPEJveCBtaW5XaWR0aD17Mn0+XG4gICAgICAgICAgPFRleHQgY29sb3I9e2NvbG9yfSBkaW1Db2xvcj17ZGltQ29sb3J9PlxuICAgICAgICAgICAge0JMQUNLX0NJUkNMRX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHdpZHRoPXtjb2x1bW5zIC0gMTB9PlxuICAgICAgICA8VGV4dCBjb2xvcj17Y29sb3J9IGRpbUNvbG9yPXtkaW1Db2xvcn0gd3JhcD1cIndyYXBcIj5cbiAgICAgICAgICB7Y29udGVudC50cmltKCl9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIDwvQm94PlxuICApXG59XG5cbmZ1bmN0aW9uIFR1cm5EdXJhdGlvbk1lc3NhZ2Uoe1xuICBtZXNzYWdlLFxuICBhZGRNYXJnaW4sXG59OiB7XG4gIG1lc3NhZ2U6IFN5c3RlbVR1cm5EdXJhdGlvbk1lc3NhZ2VcbiAgYWRkTWFyZ2luOiBib29sZWFuXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgYmcgPSB1c2VTZWxlY3RlZE1lc3NhZ2VCZygpXG4gIGNvbnN0IFt2ZXJiXSA9IHVzZVN0YXRlKCgpID0+IHNhbXBsZShUVVJOX0NPTVBMRVRJT05fVkVSQlMpID8/ICdXb3JrZWQnKVxuICBjb25zdCBzdG9yZSA9IHVzZUFwcFN0YXRlU3RvcmUoKVxuICBjb25zdCBbYmFja2dyb3VuZFRhc2tTdW1tYXJ5XSA9IHVzZVN0YXRlKCgpID0+IHtcbiAgICBjb25zdCB0YXNrcyA9IHN0b3JlLmdldFN0YXRlKCkudGFza3NcbiAgICBjb25zdCBydW5uaW5nID0gKE9iamVjdC52YWx1ZXModGFza3MgPz8ge30pIGFzIFRhc2tTdGF0ZVtdKS5maWx0ZXIoXG4gICAgICBpc0JhY2tncm91bmRUYXNrLFxuICAgIClcbiAgICByZXR1cm4gcnVubmluZy5sZW5ndGggPiAwID8gZ2V0UGlsbExhYmVsKHJ1bm5pbmcpIDogbnVsbFxuICB9KVxuXG4gIGNvbnN0IHNob3dUdXJuRHVyYXRpb24gPSBnZXRHbG9iYWxDb25maWcoKS5zaG93VHVybkR1cmF0aW9uID8/IHRydWVcblxuICBjb25zdCBkdXJhdGlvbiA9IGZvcm1hdER1cmF0aW9uKG1lc3NhZ2UuZHVyYXRpb25NcylcbiAgY29uc3QgaGFzQnVkZ2V0ID0gbWVzc2FnZS5idWRnZXRMaW1pdCAhPT0gdW5kZWZpbmVkXG4gIGNvbnN0IGJ1ZGdldFN1ZmZpeCA9ICgoKSA9PiB7XG4gICAgaWYgKCFoYXNCdWRnZXQpIHJldHVybiAnJ1xuICAgIGNvbnN0IHRva2VucyA9IG1lc3NhZ2UuYnVkZ2V0VG9rZW5zIVxuICAgIGNvbnN0IGxpbWl0ID0gbWVzc2FnZS5idWRnZXRMaW1pdCFcbiAgICBjb25zdCB1c2FnZSA9XG4gICAgICB0b2tlbnMgPj0gbGltaXRcbiAgICAgICAgPyBgJHtmb3JtYXROdW1iZXIodG9rZW5zKX0gdXNlZCAoJHtmb3JtYXROdW1iZXIobGltaXQpfSBtaW4gJHtmaWd1cmVzLnRpY2t9KWBcbiAgICAgICAgOiBgJHtmb3JtYXROdW1iZXIodG9rZW5zKX0gLyAke2Zvcm1hdE51bWJlcihsaW1pdCl9ICgke01hdGgucm91bmQoKHRva2VucyAvIGxpbWl0KSAqIDEwMCl9JSlgXG4gICAgY29uc3QgbnVkZ2VzID1cbiAgICAgIG1lc3NhZ2UuYnVkZ2V0TnVkZ2VzISA+IDBcbiAgICAgICAgPyBgIFxcdTAwQjcgJHttZXNzYWdlLmJ1ZGdldE51ZGdlc30gJHttZXNzYWdlLmJ1ZGdldE51ZGdlcyA9PT0gMSA/ICdudWRnZScgOiAnbnVkZ2VzJ31gXG4gICAgICAgIDogJydcbiAgICByZXR1cm4gYCR7c2hvd1R1cm5EdXJhdGlvbiA/ICcgXFx1MDBCNyAnIDogJyd9JHt1c2FnZX0ke251ZGdlc31gXG4gIH0pKClcblxuICBpZiAoIXNob3dUdXJuRHVyYXRpb24gJiYgIWhhc0J1ZGdldCkge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxCb3hcbiAgICAgIGZsZXhEaXJlY3Rpb249XCJyb3dcIlxuICAgICAgbWFyZ2luVG9wPXthZGRNYXJnaW4gPyAxIDogMH1cbiAgICAgIGJhY2tncm91bmRDb2xvcj17Ymd9XG4gICAgICB3aWR0aD1cIjEwMCVcIlxuICAgID5cbiAgICAgIDxCb3ggbWluV2lkdGg9ezJ9PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj57VEVBUkRST1BfQVNURVJJU0t9PC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAge3Nob3dUdXJuRHVyYXRpb24gJiYgYCR7dmVyYn0gZm9yICR7ZHVyYXRpb259YH1cbiAgICAgICAge2J1ZGdldFN1ZmZpeH1cbiAgICAgICAge2JhY2tncm91bmRUYXNrU3VtbWFyeSAmJlxuICAgICAgICAgIGAgXFx1MDBCNyAke2JhY2tncm91bmRUYXNrU3VtbWFyeX0gc3RpbGwgcnVubmluZ2B9XG4gICAgICA8L1RleHQ+XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZnVuY3Rpb24gTWVtb3J5U2F2ZWRNZXNzYWdlKHtcbiAgbWVzc2FnZSxcbiAgYWRkTWFyZ2luLFxufToge1xuICBtZXNzYWdlOiBTeXN0ZW1NZW1vcnlTYXZlZE1lc3NhZ2VcbiAgYWRkTWFyZ2luOiBib29sZWFuXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgYmcgPSB1c2VTZWxlY3RlZE1lc3NhZ2VCZygpXG4gIGNvbnN0IHsgd3JpdHRlblBhdGhzIH0gPSBtZXNzYWdlXG4gIGNvbnN0IHRlYW0gPSBmZWF0dXJlKCdURUFNTUVNJylcbiAgICA/IHRlYW1NZW1TYXZlZCEudGVhbU1lbVNhdmVkUGFydChtZXNzYWdlKVxuICAgIDogbnVsbFxuICBjb25zdCBwcml2YXRlQ291bnQgPSB3cml0dGVuUGF0aHMubGVuZ3RoIC0gKHRlYW0/LmNvdW50ID8/IDApXG4gIGNvbnN0IHBhcnRzID0gW1xuICAgIHByaXZhdGVDb3VudCA+IDBcbiAgICAgID8gYCR7cHJpdmF0ZUNvdW50fSAke3ByaXZhdGVDb3VudCA9PT0gMSA/ICdtZW1vcnknIDogJ21lbW9yaWVzJ31gXG4gICAgICA6IG51bGwsXG4gICAgdGVhbT8uc2VnbWVudCxcbiAgXS5maWx0ZXIoQm9vbGVhbilcbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgIG1hcmdpblRvcD17YWRkTWFyZ2luID8gMSA6IDB9XG4gICAgICBiYWNrZ3JvdW5kQ29sb3I9e2JnfVxuICAgID5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cInJvd1wiPlxuICAgICAgICA8Qm94IG1pbldpZHRoPXsyfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57QkxBQ0tfQ0lSQ0xFfTwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIDxUZXh0PlxuICAgICAgICAgIHttZXNzYWdlLnZlcmIgPz8gJ1NhdmVkJ30ge3BhcnRzLmpvaW4oJyBcXHUwMEI3ICcpfVxuICAgICAgICA8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICAgIHt3cml0dGVuUGF0aHMubWFwKHAgPT4gKFxuICAgICAgICA8TWVtb3J5RmlsZVJvdyBrZXk9e3B9IHBhdGg9e3B9IC8+XG4gICAgICApKX1cbiAgICA8L0JveD5cbiAgKVxufVxuXG5mdW5jdGlvbiBNZW1vcnlGaWxlUm93KHsgcGF0aCB9OiB7IHBhdGg6IHN0cmluZyB9KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgW2hvdmVyLCBzZXRIb3Zlcl0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgcmV0dXJuIChcbiAgICA8TWVzc2FnZVJlc3BvbnNlPlxuICAgICAgPEJveFxuICAgICAgICBvbkNsaWNrPXsoKSA9PiB2b2lkIG9wZW5QYXRoKHBhdGgpfVxuICAgICAgICBvbk1vdXNlRW50ZXI9eygpID0+IHNldEhvdmVyKHRydWUpfVxuICAgICAgICBvbk1vdXNlTGVhdmU9eygpID0+IHNldEhvdmVyKGZhbHNlKX1cbiAgICAgID5cbiAgICAgICAgPFRleHQgZGltQ29sb3I9eyFob3Zlcn0gdW5kZXJsaW5lPXtob3Zlcn0+XG4gICAgICAgICAgPEZpbGVQYXRoTGluayBmaWxlUGF0aD17cGF0aH0+e2Jhc2VuYW1lKHBhdGgpfTwvRmlsZVBhdGhMaW5rPlxuICAgICAgICA8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgKVxufVxuXG5mdW5jdGlvbiBUaGlua2luZ01lc3NhZ2Uoe1xuICBtZXNzYWdlLFxuICBhZGRNYXJnaW4sXG59OiB7XG4gIG1lc3NhZ2U6IFN5c3RlbVRoaW5raW5nTWVzc2FnZVxuICBhZGRNYXJnaW46IGJvb2xlYW5cbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBiZyA9IHVzZVNlbGVjdGVkTWVzc2FnZUJnKClcbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBmbGV4RGlyZWN0aW9uPVwicm93XCJcbiAgICAgIG1hcmdpblRvcD17YWRkTWFyZ2luID8gMSA6IDB9XG4gICAgICBiYWNrZ3JvdW5kQ29sb3I9e2JnfVxuICAgICAgd2lkdGg9XCIxMDAlXCJcbiAgICA+XG4gICAgICA8Qm94IG1pbldpZHRoPXsyfT5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+e1RFQVJEUk9QX0FTVEVSSVNLfTwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgICAgPFRleHQgZGltQ29sb3I+e21lc3NhZ2UuY29udGVudH08L1RleHQ+XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZnVuY3Rpb24gQnJpZGdlU3RhdHVzTWVzc2FnZSh7XG4gIG1lc3NhZ2UsXG4gIGFkZE1hcmdpbixcbn06IHtcbiAgbWVzc2FnZTogU3lzdGVtQnJpZGdlU3RhdHVzTWVzc2FnZVxuICBhZGRNYXJnaW46IGJvb2xlYW5cbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBiZyA9IHVzZVNlbGVjdGVkTWVzc2FnZUJnKClcbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBmbGV4RGlyZWN0aW9uPVwicm93XCJcbiAgICAgIG1hcmdpblRvcD17YWRkTWFyZ2luID8gMSA6IDB9XG4gICAgICBiYWNrZ3JvdW5kQ29sb3I9e2JnfVxuICAgICAgd2lkdGg9ezk5OX1cbiAgICA+XG4gICAgICA8Qm94IG1pbldpZHRoPXsyfSAvPlxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxUZXh0PlxuICAgICAgICAgIDxUaGVtZWRUZXh0IGNvbG9yPVwic3VnZ2VzdGlvblwiPi9yZW1vdGUtY29udHJvbDwvVGhlbWVkVGV4dD4gaXMgYWN0aXZlLlxuICAgICAgICAgIENvZGUgaW4gQ0xJIG9yIGF0XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICAgPExpbmsgdXJsPXttZXNzYWdlLnVybH0+e21lc3NhZ2UudXJsfTwvTGluaz5cbiAgICAgICAge21lc3NhZ2UudXBncmFkZU51ZGdlICYmIDxUZXh0IGRpbUNvbG9yPuKOvyB7bWVzc2FnZS51cGdyYWRlTnVkZ2V9PC9UZXh0Pn1cbiAgICAgIDwvQm94PlxuICAgIDwvQm94PlxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBLFNBQVNBLEdBQUcsRUFBRUMsSUFBSSxFQUFFLEtBQUtDLFNBQVMsUUFBUSxjQUFjO0FBQ3hELFNBQVNDLE9BQU8sUUFBUSxZQUFZO0FBQ3BDLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsUUFBUSxRQUFRLE9BQU87QUFDaEMsT0FBT0MsTUFBTSxNQUFNLHFCQUFxQjtBQUN4QyxTQUNFQyxZQUFZLEVBQ1pDLGNBQWMsRUFDZEMsaUJBQWlCLFFBQ1osNEJBQTRCO0FBQ25DLE9BQU9DLE9BQU8sTUFBTSxTQUFTO0FBQzdCLFNBQVNDLFFBQVEsUUFBUSxNQUFNO0FBQy9CLFNBQVNDLGVBQWUsUUFBUSx1QkFBdUI7QUFDdkQsU0FBU0MsWUFBWSxRQUFRLG9CQUFvQjtBQUNqRCxTQUFTQyxRQUFRLFFBQVEsd0JBQXdCO0FBQ2pEO0FBQ0EsTUFBTUMsWUFBWSxHQUFHWixPQUFPLENBQUMsU0FBUyxDQUFDLEdBQ2xDYSxPQUFPLENBQUMsbUJBQW1CLENBQUMsSUFBSSxPQUFPLE9BQU8sbUJBQW1CLENBQUMsR0FDbkUsSUFBSTtBQUNSO0FBQ0EsU0FBU0MscUJBQXFCLFFBQVEsd0NBQXdDO0FBQzlFLFNBQVNDLGVBQWUsUUFBUSxnQ0FBZ0M7QUFDaEUsY0FDRUMsYUFBYSxFQUNiQyw0QkFBNEIsRUFDNUJDLHlCQUF5QixFQUN6QkMseUJBQXlC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