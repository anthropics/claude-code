import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import * as React from 'react';
import { Box, Text } from '../ink.js';
import type { ContextData } from '../utils/analyzeContext.js';
import { generateContextSuggestions } from '../utils/contextSuggestions.js';
import { getDisplayPath } from '../utils/file.js';
import { formatTokens } from '../utils/format.js';
import { getSourceDisplayName, type SettingSource } from '../utils/settings/constants.js';
import { plural } from '../utils/stringUtils.js';
import { ContextSuggestions } from './ContextSuggestions.js';
const RESERVED_CATEGORY_NAME = 'Autocompact buffer';

/**
 * One-liner for the legend header showing what context-collapse has done.
 * Returns null when nothing's summarized/staged so we don't add visual
 * noise in the common case. This is the one place a user can see that
 * their context was rewritten — the <collapsed> placeholders are isMeta
 * and don't appear in the conversation view.
 */
function CollapseStatus() {
  const $ = _c(2);
  if (feature("CONTEXT_COLLAPSE")) {
    let t0;
    let t1;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
      t1 = Symbol.for("react.early_return_sentinel");
      bb0: {
        const {
          getStats,
          isContextCollapseEnabled
        } = require("../services/contextCollapse/index.js") as typeof import('../services/contextCollapse/index.js');
        if (!isContextCollapseEnabled()) {
          t1 = null;
          break bb0;
        }
        const s = getStats();
        const {
          health: h
        } = s;
        const parts = [];
        if (s.collapsedSpans > 0) {
          parts.push(`${s.collapsedSpans} ${plural(s.collapsedSpans, "span")} summarized (${s.collapsedMessages} msgs)`);
        }
        if (s.stagedSpans > 0) {
          parts.push(`${s.stagedSpans} staged`);
        }
        const summary = parts.length > 0 ? parts.join(", ") : h.totalSpawns > 0 ? `${h.totalSpawns} ${plural(h.totalSpawns, "spawn")}, nothing staged yet` : "waiting for first trigger";
        let line2 = null;
        if (h.totalErrors > 0) {
          line2 = <Text color="warning">Collapse errors: {h.totalErrors}/{h.totalSpawns} spawns failed{h.lastError ? ` (last: ${h.lastError.slice(0, 60)})` : ""}</Text>;
        } else {
          if (h.emptySpawnWarningEmitted) {
            line2 = <Text color="warning">Collapse idle: {h.totalEmptySpawns} consecutive empty runs</Text>;
          }
        }
        t0 = <><Text dimColor={true}>Context strategy: collapse ({summary})</Text>{line2}</>;
      }
      $[0] = t0;
      $[1] = t1;
    } else {
      t0 = $[0];
      t1 = $[1];
    }
    if (t1 !== Symbol.for("react.early_return_sentinel")) {
      return t1;
    }
    return t0;
  }
  return null;
}

// Order for displaying source groups: Project > User > Managed > Plugin > Built-in
const SOURCE_DISPLAY_ORDER = ['Project', 'User', 'Managed', 'Plugin', 'Built-in'];

/** Group items by source type for display, sorted by tokens descending within each group */
function groupBySource<T extends {
  source: SettingSource | 'plugin' | 'built-in';
  tokens: number;
}>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getSourceDisplayName(item.source);
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  }
  // Sort each group by tokens descending
  for (const [key, group] of groups.entries()) {
    groups.set(key, group.sort((a, b) => b.tokens - a.tokens));
  }
  // Return groups in consistent order
  const orderedGroups = new Map<string, T[]>();
  for (const source of SOURCE_DISPLAY_ORDER) {
    const group = groups.get(source);
    if (group) {
      orderedGroups.set(source, group);
    }
  }
  return orderedGroups;
}
interface Props {
  data: ContextData;
}
export function ContextVisualization(t0) {
  const $ = _c(87);
  const {
    data
  } = t0;
  const {
    categories,
    totalTokens,
    rawMaxTokens,
    percentage,
    gridRows,
    model,
    memoryFiles,
    mcpTools,
    deferredBuiltinTools: t1,
    systemTools,
    systemPromptSections,
    agents,
    skills,
    messageBreakdown
  } = data;
  let T0;
  let T1;
  let t2;
  let t3;
  let t4;
  let t5;
  let t6;
  let t7;
  let t8;
  let t9;
  if ($[0] !== categories || $[1] !== gridRows || $[2] !== mcpTools || $[3] !== model || $[4] !== percentage || $[5] !== rawMaxTokens || $[6] !== systemTools || $[7] !== t1 || $[8] !== totalTokens) {
    const deferredBuiltinTools = t1 === undefined ? [] : t1;
    const visibleCategories = categories.filter(_temp);
    let t10;
    if ($[19] !== categories) {
      t10 = categories.some(_temp2);
      $[19] = categories;
      $[20] = t10;
    } else {
      t10 = $[20];
    }
    const hasDeferredMcpTools = t10;
    const hasDeferredBuiltinTools = deferredBuiltinTools.length > 0;
    const autocompactCategory = categories.find(_temp3);
    T1 = Box;
    t6 = "column";
    t7 = 1;
    if ($[21] === Symbol.for("react.memo_cache_sentinel")) {
      t8 = <Text bold={true}>Context Usage</Text>;
      $[21] = t8;
    } else {
      t8 = $[21];
    }
    let t11;
    if ($[22] !== gridRows) {
      t11 = gridRows.map(_temp5);
      $[22] = gridRows;
      $[23] = t11;
    } else {
      t11 = $[23];
    }
    let t12;
    if ($[24] !== t11) {
      t12 = <Box flexDirection="column" flexShrink={0}>{t11}</Box>;
      $[24] = t11;
      $[25] = t12;
    } else {
      t12 = $[25];
    }
    let t13;
    if ($[26] !== totalTokens) {
      t13 = formatTokens(totalTokens);
      $[26] = totalTokens;
      $[27] = t13;
    } else {
      t13 = $[27];
    }
    let t14;
    if ($[28] !== rawMaxTokens) {
      t14 = formatTokens(rawMaxTokens);
      $[28] = rawMaxTokens;
      $[29] = t14;
    } else {
      t14 = $[29];
    }
    let t15;
    if ($[30] !== model || $[31] !== percentage || $[32] !== t13 || $[33] !== t14) {
      t15 = <Text dimColor={true}>{model} · {t13}/{t14}{" "}tokens ({percentage}%)</Text>;
      $[30] = model;
      $[31] = percentage;
      $[32] = t13;
      $[33] = t14;
      $[34] = t15;
    } else {
      t15 = $[34];
    }
    let t16;
    let t17;
    let t18;
    if ($[35] === Symbol.for("react.memo_cache_sentinel")) {
      t16 = <CollapseStatus />;
      t17 = <Text> </Text>;
      t18 = <Text dimColor={true} italic={true}>Estimated usage by category</Text>;
      $[35] = t16;
      $[36] = t17;
      $[37] = t18;
    } else {
      t16 = $[35];
      t17 = $[36];
      t18 = $[37];
    }
    let t19;
    if ($[38] !== rawMaxTokens) {
      t19 = (cat_2, index) => {
        const tokenDisplay = formatTokens(cat_2.tokens);
        const percentDisplay = cat_2.isDeferred ? "N/A" : `${(cat_2.tokens / rawMaxTokens * 100).toFixed(1)}%`;
        const isReserved = cat_2.name === RESERVED_CATEGORY_NAME;
        const displayName = cat_2.name;
        const symbol = cat_2.isDeferred ? " " : isReserved ? "\u26DD" : "\u26C1";
        return <Box key={index}><Text color={cat_2.color}>{symbol}</Text><Text> {displayName}: </Text><Text dimColor={true}>{tokenDisplay} tokens ({percentDisplay})</Text></Box>;
      };
      $[38] = rawMaxTokens;
      $[39] = t19;
    } else {
      t19 = $[39];
    }
    const t20 = visibleCategories.map(t19);
    let t21;
    if ($[40] !== categories || $[41] !== rawMaxTokens) {
      t21 = (categories.find(_temp6)?.tokens ?? 0) > 0 && <Box><Text dimColor={true}>⛶</Text><Text> Free space: </Text><Text dimColor={true}>{formatTokens(categories.find(_temp7)?.tokens || 0)}{" "}({((categories.find(_temp8)?.tokens || 0) / rawMaxTokens * 100).toFixed(1)}%)</Text></Box>;
      $[40] = categories;
      $[41] = rawMaxTokens;
      $[42] = t21;
    } else {
      t21 = $[42];
    }
    const t22 = autocompactCategory && autocompactCategory.tokens > 0 && <Box><Text color={autocompactCategory.color}>⛝</Text><Text dimColor={true}> {autocompactCategory.name}: </Text><Text dimColor={true}>{formatTokens(autocompactCategory.tokens)} tokens ({(autocompactCategory.tokens / rawMaxTokens * 100).toFixed(1)}%)</Text></Box>;
    let t23;
    if ($[43] !== t15 || $[44] !== t20 || $[45] !== t21 || $[46] !== t22) {
      t23 = <Box flexDirection="column" gap={0} flexShrink={0}>{t15}{t16}{t17}{t18}{t20}{t21}{t22}</Box>;
      $[43] = t15;
      $[44] = t20;
      $[45] = t21;
      $[46] = t22;
      $[47] = t23;
    } else {
      t23 = $[47];
    }
    if ($[48] !== t12 || $[49] !== t23) {
      t9 = <Box flexDirection="row" gap={2}>{t12}{t23}</Box>;
      $[48] = t12;
      $[49] = t23;
      $[50] = t9;
    } else {
      t9 = $[50];
    }
    T0 = Box;
    t2 = "column";
    t3 = -1;
    if ($[51] !== hasDeferredMcpTools || $[52] !== mcpTools) {
      t4 = mcpTools.length > 0 && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>MCP tools</Text><Text dimColor={true}>{" "}· /mcp{hasDeferredMcpTools ? " (loaded on-demand)" : ""}</Text></Box>{mcpTools.some(_temp9) && <Box flexDirection="column" marginTop={1}><Text dimColor={true}>Loaded</Text>{mcpTools.filter(_temp0).map(_temp1)}</Box>}{hasDeferredMcpTools && mcpTools.some(_temp10) && <Box flexDirection="column" marginTop={1}><Text dimColor={true}>Available</Text>{mcpTools.filter(_temp11).map(_temp12)}</Box>}{!hasDeferredMcpTools && mcpTools.map(_temp13)}</Box>;
      $[51] = hasDeferredMcpTools;
      $[52] = mcpTools;
      $[53] = t4;
    } else {
      t4 = $[53];
    }
    t5 = (systemTools && systemTools.length > 0 || hasDeferredBuiltinTools) && false && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>[ANT-ONLY] System tools</Text>{hasDeferredBuiltinTools && <Text dimColor={true}> (some loaded on-demand)</Text>}</Box><Box flexDirection="column" marginTop={1}><Text dimColor={true}>Loaded</Text>{systemTools?.map(_temp14)}{deferredBuiltinTools.filter(_temp15).map(_temp16)}</Box>{hasDeferredBuiltinTools && deferredBuiltinTools.some(_temp17) && <Box flexDirection="column" marginTop={1}><Text dimColor={true}>Available</Text>{deferredBuiltinTools.filter(_temp18).map(_temp19)}</Box>}</Box>;
    $[0] = categories;
    $[1] = gridRows;
    $[2] = mcpTools;
    $[3] = model;
    $[4] = percentage;
    $[5] = rawMaxTokens;
    $[6] = systemTools;
    $[7] = t1;
    $[8] = totalTokens;
    $[9] = T0;
    $[10] = T1;
    $[11] = t2;
    $[12] = t3;
    $[13] = t4;
    $[14] = t5;
    $[15] = t6;
    $[16] = t7;
    $[17] = t8;
    $[18] = t9;
  } else {
    T0 = $[9];
    T1 = $[10];
    t2 = $[11];
    t3 = $[12];
    t4 = $[13];
    t5 = $[14];
    t6 = $[15];
    t7 = $[16];
    t8 = $[17];
    t9 = $[18];
  }
  let t10;
  if ($[54] !== systemPromptSections) {
    t10 = systemPromptSections && systemPromptSections.length > 0 && false && <Box flexDirection="column" marginTop={1}><Text bold={true}>[ANT-ONLY] System prompt sections</Text>{systemPromptSections.map(_temp20)}</Box>;
    $[54] = systemPromptSections;
    $[55] = t10;
  } else {
    t10 = $[55];
  }
  let t11;
  if ($[56] !== agents) {
    t11 = agents.length > 0 && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>Custom agents</Text><Text dimColor={true}> · /agents</Text></Box>{Array.from(groupBySource(agents).entries()).map(_temp22)}</Box>;
    $[56] = agents;
    $[57] = t11;
  } else {
    t11 = $[57];
  }
  let t12;
  if ($[58] !== memoryFiles) {
    t12 = memoryFiles.length > 0 && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>Memory files</Text><Text dimColor={true}> · /memory</Text></Box>{memoryFiles.map(_temp23)}</Box>;
    $[58] = memoryFiles;
    $[59] = t12;
  } else {
    t12 = $[59];
  }
  let t13;
  if ($[60] !== skills) {
    t13 = skills && skills.tokens > 0 && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>Skills</Text><Text dimColor={true}> · /skills</Text></Box>{Array.from(groupBySource(skills.skillFrontmatter).entries()).map(_temp25)}</Box>;
    $[60] = skills;
    $[61] = t13;
  } else {
    t13 = $[61];
  }
  let t14;
  if ($[62] !== messageBreakdown) {
    t14 = messageBreakdown && false && <Box flexDirection="column" marginTop={1}><Text bold={true}>[ANT-ONLY] Message breakdown</Text><Box flexDirection="column" marginLeft={1}><Box><Text>Tool calls: </Text><Text dimColor={true}>{formatTokens(messageBreakdown.toolCallTokens)} tokens</Text></Box><Box><Text>Tool results: </Text><Text dimColor={true}>{formatTokens(messageBreakdown.toolResultTokens)} tokens</Text></Box><Box><Text>Attachments: </Text><Text dimColor={true}>{formatTokens(messageBreakdown.attachmentTokens)} tokens</Text></Box><Box><Text>Assistant messages (non-tool): </Text><Text dimColor={true}>{formatTokens(messageBreakdown.assistantMessageTokens)} tokens</Text></Box><Box><Text>User messages (non-tool-result): </Text><Text dimColor={true}>{formatTokens(messageBreakdown.userMessageTokens)} tokens</Text></Box></Box>{messageBreakdown.toolCallsByType.length > 0 && <Box flexDirection="column" marginTop={1}><Text bold={true}>[ANT-ONLY] Top tools</Text>{messageBreakdown.toolCallsByType.slice(0, 5).map(_temp26)}</Box>}{messageBreakdown.attachmentsByType.length > 0 && <Box flexDirection="column" marginTop={1}><Text bold={true}>[ANT-ONLY] Top attachments</Text>{messageBreakdown.attachmentsByType.slice(0, 5).map(_temp27)}</Box>}</Box>;
    $[62] = messageBreakdown;
    $[63] = t14;
  } else {
    t14 = $[63];
  }
  let t15;
  if ($[64] !== T0 || $[65] !== t10 || $[66] !== t11 || $[67] !== t12 || $[68] !== t13 || $[69] !== t14 || $[70] !== t2 || $[71] !== t3 || $[72] !== t4 || $[73] !== t5) {
    t15 = <T0 flexDirection={t2} marginLeft={t3}>{t4}{t5}{t10}{t11}{t12}{t13}{t14}</T0>;
    $[64] = T0;
    $[65] = t10;
    $[66] = t11;
    $[67] = t12;
    $[68] = t13;
    $[69] = t14;
    $[70] = t2;
    $[71] = t3;
    $[72] = t4;
    $[73] = t5;
    $[74] = t15;
  } else {
    t15 = $[74];
  }
  let t16;
  if ($[75] !== data) {
    t16 = generateContextSuggestions(data);
    $[75] = data;
    $[76] = t16;
  } else {
    t16 = $[76];
  }
  let t17;
  if ($[77] !== t16) {
    t17 = <ContextSuggestions suggestions={t16} />;
    $[77] = t16;
    $[78] = t17;
  } else {
    t17 = $[78];
  }
  let t18;
  if ($[79] !== T1 || $[80] !== t15 || $[81] !== t17 || $[82] !== t6 || $[83] !== t7 || $[84] !== t8 || $[85] !== t9) {
    t18 = <T1 flexDirection={t6} paddingLeft={t7}>{t8}{t9}{t15}{t17}</T1>;
    $[79] = T1;
    $[80] = t15;
    $[81] = t17;
    $[82] = t6;
    $[83] = t7;
    $[84] = t8;
    $[85] = t9;
    $[86] = t18;
  } else {
    t18 = $[86];
  }
  return t18;
}
function _temp27(attachment, i_10) {
  return <Box key={i_10} marginLeft={1}><Text>└ {attachment.name}: </Text><Text dimColor={true}>{formatTokens(attachment.tokens)} tokens</Text></Box>;
}
function _temp26(tool_5, i_9) {
  return <Box key={i_9} marginLeft={1}><Text>└ {tool_5.name}: </Text><Text dimColor={true}>calls {formatTokens(tool_5.callTokens)}, results{" "}{formatTokens(tool_5.resultTokens)}</Text></Box>;
}
function _temp25(t0) {
  const [sourceDisplay_0, sourceSkills] = t0;
  return <Box key={sourceDisplay_0} flexDirection="column" marginTop={1}><Text dimColor={true}>{sourceDisplay_0}</Text>{sourceSkills.map(_temp24)}</Box>;
}
function _temp24(skill, i_8) {
  return <Box key={i_8}><Text>└ {skill.name}: </Text><Text dimColor={true}>{formatTokens(skill.tokens)} tokens</Text></Box>;
}
function _temp23(file, i_7) {
  return <Box key={i_7}><Text>└ {getDisplayPath(file.path)}: </Text><Text dimColor={true}>{formatTokens(file.tokens)} tokens</Text></Box>;
}
function _temp22(t0) {
  const [sourceDisplay, sourceAgents] = t0;
  return <Box key={sourceDisplay} flexDirection="column" marginTop={1}><Text dimColor={true}>{sourceDisplay}</Text>{sourceAgents.map(_temp21)}</Box>;
}
function _temp21(agent, i_6) {
  return <Box key={i_6}><Text>└ {agent.agentType}: </Text><Text dimColor={true}>{formatTokens(agent.tokens)} tokens</Text></Box>;
}
function _temp20(section, i_5) {
  return <Box key={i_5}><Text>└ {section.name}: </Text><Text dimColor={true}>{formatTokens(section.tokens)} tokens</Text></Box>;
}
function _temp19(tool_4, i_4) {
  return <Box key={i_4}><Text dimColor={true}>└ {tool_4.name}</Text></Box>;
}
function _temp18(t_4) {
  return !t_4.isLoaded;
}
function _temp17(t_5) {
  return !t_5.isLoaded;
}
function _temp16(tool_3, i_3) {
  return <Box key={`def-${i_3}`}><Text>└ {tool_3.name}: </Text><Text dimColor={true}>{formatTokens(tool_3.tokens)} tokens</Text></Box>;
}
function _temp15(t_3) {
  return t_3.isLoaded;
}
function _temp14(tool_2, i_2) {
  return <Box key={`sys-${i_2}`}><Text>└ {tool_2.name}: </Text><Text dimColor={true}>{formatTokens(tool_2.tokens)} tokens</Text></Box>;
}
function _temp13(tool_1, i_1) {
  return <Box key={i_1}><Text>└ {tool_1.name}: </Text><Text dimColor={true}>{formatTokens(tool_1.tokens)} tokens</Text></Box>;
}
function _temp12(tool_0, i_0) {
  return <Box key={i_0}><Text dimColor={true}>└ {tool_0.name}</Text></Box>;
}
function _temp11(t_1) {
  return !t_1.isLoaded;
}
function _temp10(t_2) {
  return !t_2.isLoaded;
}
function _temp1(tool, i) {
  return <Box key={i}><Text>└ {tool.name}: </Text><Text dimColor={true}>{formatTokens(tool.tokens)} tokens</Text></Box>;
}
function _temp0(t) {
  return t.isLoaded;
}
function _temp9(t_0) {
  return t_0.isLoaded;
}
function _temp8(c_0) {
  return c_0.name === "Free space";
}
function _temp7(c) {
  return c.name === "Free space";
}
function _temp6(c_1) {
  return c_1.name === "Free space";
}
function _temp5(row, rowIndex) {
  return <Box key={rowIndex} flexDirection="row" marginLeft={-1}>{row.map(_temp4)}</Box>;
}
function _temp4(square, colIndex) {
  if (square.categoryName === "Free space") {
    return <Text key={colIndex} dimColor={true}>{"\u26F6 "}</Text>;
  }
  if (square.categoryName === RESERVED_CATEGORY_NAME) {
    return <Text key={colIndex} color={square.color}>{"\u26DD "}</Text>;
  }
  return <Text key={colIndex} color={square.color}>{square.squareFullness >= 0.7 ? "\u26C1 " : "\u26C0 "}</Text>;
}
function _temp3(cat_1) {
  return cat_1.name === RESERVED_CATEGORY_NAME;
}
function _temp2(cat_0) {
  return cat_0.isDeferred && cat_0.name.includes("MCP");
}
function _temp(cat) {
  return cat.tokens > 0 && cat.name !== "Free space" && cat.name !== RESERVED_CATEGORY_NAME && !cat.isDeferred;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiUmVhY3QiLCJCb3giLCJUZXh0IiwiQ29udGV4dERhdGEiLCJnZW5lcmF0ZUNvbnRleHRTdWdnZXN0aW9ucyIsImdldERpc3BsYXlQYXRoIiwiZm9ybWF0VG9rZW5zIiwiZ2V0U291cmNlRGlzcGxheU5hbWUiLCJTZXR0aW5nU291cmNlIiwicGx1cmFsIiwiQ29udGV4dFN1Z2dlc3Rpb25zIiwiUkVTRVJWRURfQ0FURUdPUllfTkFNRSIsIkNvbGxhcHNlU3RhdHVzIiwiJCIsIl9jIiwidDAiLCJ0MSIsIlN5bWJvbCIsImZvciIsImJiMCIsImdldFN0YXRzIiwiaXNDb250ZXh0Q29sbGFwc2VFbmFibGVkIiwicmVxdWlyZSIsInMiLCJoZWFsdGgiLCJoIiwicGFydHMiLCJjb2xsYXBzZWRTcGFucyIsInB1c2giLCJjb2xsYXBzZWRNZXNzYWdlcyIsInN0YWdlZFNwYW5zIiwic3VtbWFyeSIsImxlbmd0aCIsImpvaW4iLCJ0b3RhbFNwYXducyIsImxpbmUyIiwidG90YWxFcnJvcnMiLCJsYXN0RXJyb3IiLCJzbGljZSIsImVtcHR5U3Bhd25XYXJuaW5nRW1pdHRlZCIsInRvdGFsRW1wdHlTcGF3bnMiLCJTT1VSQ0VfRElTUExBWV9PUkRFUiIsImdyb3VwQnlTb3VyY2UiLCJzb3VyY2UiLCJ0b2tlbnMiLCJpdGVtcyIsIlQiLCJNYXAiLCJncm91cHMiLCJpdGVtIiwia2V5IiwiZXhpc3RpbmciLCJnZXQiLCJzZXQiLCJncm91cCIsImVudHJpZXMiLCJzb3J0IiwiYSIsImIiLCJvcmRlcmVkR3JvdXBzIiwiUHJvcHMiLCJkYXRhIiwiQ29udGV4dFZpc3VhbGl6YXRpb24iLCJjYXRlZ29yaWVzIiwidG90YWxUb2tlbnMiLCJyYXdNYXhUb2tlbnMiLCJwZXJjZW50YWdlIiwiZ3JpZFJvd3MiLCJtb2RlbCIsIm1lbW9yeUZpbGVzIiwibWNwVG9vbHMiLCJkZWZlcnJlZEJ1aWx0aW5Ub29scyIsInN5c3RlbVRvb2xzIiwic3lzdGVtUHJvbXB0U2VjdGlvbnMiLCJhZ2VudHMiLCJza2lsbHMiLCJtZXNzYWdlQnJlYWtkb3duIiwiVDAiLCJUMSIsInQyIiwidDMiLCJ0NCIsInQ1IiwidDYiLCJ0NyIsInQ4IiwidDkiLCJ1bmRlZmluZWQiLCJ2aXNpYmxlQ2F0ZWdvcmllcyIsImZpbHRlciIsIl90ZW1wIiwidDEwIiwic29tZSIsIl90ZW1wMiIsImhhc0RlZmVycmVkTWNwVG9vbHMiLCJoYXNEZWZlcnJlZEJ1aWx0aW5Ub29scyIsImF1dG9jb21wYWN0Q2F0ZWdvcnkiLCJmaW5kIiwiX3RlbXAzIiwidDExIiwibWFwIiwiX3RlbXA1IiwidDEyIiwidDEzIiwidDE0IiwidDE1IiwidDE2IiwidDE3IiwidDE4IiwidDE5IiwiY2F0XzIiLCJpbmRleCIsInRva2VuRGlzcGxheSIsImNhdCIsInBlcmNlbnREaXNwbGF5IiwiaXNEZWZlcnJlZCIsInRvRml4ZWQiLCJpc1Jlc2VydmVkIiwibmFtZSIsImRpc3BsYXlOYW1lIiwic3ltYm9sIiwiY29sb3IiLCJ0MjAiLCJ0MjEiLCJfdGVtcDYiLCJfdGVtcDciLCJfdGVtcDgiLCJ0MjIiLCJ0MjMiLCJfdGVtcDkiLCJfdGVtcDAiLCJfdGVtcDEiLCJfdGVtcDEwIiwiX3RlbXAxMSIsIl90ZW1wMTIiLCJfdGVtcDEzIiwiX3RlbXAxNCIsIl90ZW1wMTUiLCJfdGVtcDE2IiwiX3RlbXAxNyIsIl90ZW1wMTgiLCJfdGVtcDE5IiwiX3RlbXAyMCIsIkFycmF5IiwiZnJvbSIsIl90ZW1wMjIiLCJfdGVtcDIzIiwic2tpbGxGcm9udG1hdHRlciIsIl90ZW1wMjUiLCJ0b29sQ2FsbFRva2VucyIsInRvb2xSZXN1bHRUb2tlbnMiLCJhdHRhY2htZW50VG9rZW5zIiwiYXNzaXN0YW50TWVzc2FnZVRva2VucyIsInVzZXJNZXNzYWdlVG9rZW5zIiwidG9vbENhbGxzQnlUeXBlIiwiX3RlbXAyNiIsImF0dGFjaG1lbnRzQnlUeXBlIiwiX3RlbXAyNyIsImF0dGFjaG1lbnQiLCJpXzEwIiwiaSIsInRvb2xfNSIsImlfOSIsInRvb2wiLCJjYWxsVG9rZW5zIiwicmVzdWx0VG9rZW5zIiwic291cmNlRGlzcGxheV8wIiwic291cmNlU2tpbGxzIiwic291cmNlRGlzcGxheSIsIl90ZW1wMjQiLCJza2lsbCIsImlfOCIsImZpbGUiLCJpXzciLCJwYXRoIiwic291cmNlQWdlbnRzIiwiX3RlbXAyMSIsImFnZW50IiwiaV82IiwiYWdlbnRUeXBlIiwic2VjdGlvbiIsImlfNSIsInRvb2xfNCIsImlfNCIsInRfNCIsInQiLCJpc0xvYWRlZCIsInRfNSIsInRvb2xfMyIsImlfMyIsInRfMyIsInRvb2xfMiIsImlfMiIsInRvb2xfMSIsImlfMSIsInRvb2xfMCIsImlfMCIsInRfMSIsInRfMiIsInRfMCIsImNfMCIsImMiLCJjXzEiLCJyb3ciLCJyb3dJbmRleCIsIl90ZW1wNCIsInNxdWFyZSIsImNvbEluZGV4IiwiY2F0ZWdvcnlOYW1lIiwic3F1YXJlRnVsbG5lc3MiLCJjYXRfMSIsImNhdF8wIiwiaW5jbHVkZXMiXSwic291cmNlcyI6WyJDb250ZXh0VmlzdWFsaXphdGlvbi50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZmVhdHVyZSB9IGZyb20gJ2J1bjpidW5kbGUnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IEJveCwgVGV4dCB9IGZyb20gJy4uL2luay5qcydcbmltcG9ydCB0eXBlIHsgQ29udGV4dERhdGEgfSBmcm9tICcuLi91dGlscy9hbmFseXplQ29udGV4dC5qcydcbmltcG9ydCB7IGdlbmVyYXRlQ29udGV4dFN1Z2dlc3Rpb25zIH0gZnJvbSAnLi4vdXRpbHMvY29udGV4dFN1Z2dlc3Rpb25zLmpzJ1xuaW1wb3J0IHsgZ2V0RGlzcGxheVBhdGggfSBmcm9tICcuLi91dGlscy9maWxlLmpzJ1xuaW1wb3J0IHsgZm9ybWF0VG9rZW5zIH0gZnJvbSAnLi4vdXRpbHMvZm9ybWF0LmpzJ1xuaW1wb3J0IHtcbiAgZ2V0U291cmNlRGlzcGxheU5hbWUsXG4gIHR5cGUgU2V0dGluZ1NvdXJjZSxcbn0gZnJvbSAnLi4vdXRpbHMvc2V0dGluZ3MvY29uc3RhbnRzLmpzJ1xuaW1wb3J0IHsgcGx1cmFsIH0gZnJvbSAnLi4vdXRpbHMvc3RyaW5nVXRpbHMuanMnXG5pbXBvcnQgeyBDb250ZXh0U3VnZ2VzdGlvbnMgfSBmcm9tICcuL0NvbnRleHRTdWdnZXN0aW9ucy5qcydcblxuY29uc3QgUkVTRVJWRURfQ0FURUdPUllfTkFNRSA9ICdBdXRvY29tcGFjdCBidWZmZXInXG5cbi8qKlxuICogT25lLWxpbmVyIGZvciB0aGUgbGVnZW5kIGhlYWRlciBzaG93aW5nIHdoYXQgY29udGV4dC1jb2xsYXBzZSBoYXMgZG9uZS5cbiAqIFJldHVybnMgbnVsbCB3aGVuIG5vdGhpbmcncyBzdW1tYXJpemVkL3N0YWdlZCBzbyB3ZSBkb24ndCBhZGQgdmlzdWFsXG4gKiBub2lzZSBpbiB0aGUgY29tbW9uIGNhc2UuIFRoaXMgaXMgdGhlIG9uZSBwbGFjZSBhIHVzZXIgY2FuIHNlZSB0aGF0XG4gKiB0aGVpciBjb250ZXh0IHdhcyByZXdyaXR0ZW4g4oCUIHRoZSA8Y29sbGFwc2VkPiBwbGFjZWhvbGRlcnMgYXJlIGlzTWV0YVxuICogYW5kIGRvbid0IGFwcGVhciBpbiB0aGUgY29udmVyc2F0aW9uIHZpZXcuXG4gKi9cbmZ1bmN0aW9uIENvbGxhcHNlU3RhdHVzKCk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGlmIChmZWF0dXJlKCdDT05URVhUX0NPTExBUFNFJykpIHtcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgY29uc3QgeyBnZXRTdGF0cywgaXNDb250ZXh0Q29sbGFwc2VFbmFibGVkIH0gPVxuICAgICAgcmVxdWlyZSgnLi4vc2VydmljZXMvY29udGV4dENvbGxhcHNlL2luZGV4LmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi4vc2VydmljZXMvY29udGV4dENvbGxhcHNlL2luZGV4LmpzJylcbiAgICAvKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICBpZiAoIWlzQ29udGV4dENvbGxhcHNlRW5hYmxlZCgpKSByZXR1cm4gbnVsbFxuXG4gICAgY29uc3QgcyA9IGdldFN0YXRzKClcbiAgICBjb25zdCB7IGhlYWx0aDogaCB9ID0gc1xuXG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW11cbiAgICBpZiAocy5jb2xsYXBzZWRTcGFucyA+IDApIHtcbiAgICAgIHBhcnRzLnB1c2goXG4gICAgICAgIGAke3MuY29sbGFwc2VkU3BhbnN9ICR7cGx1cmFsKHMuY29sbGFwc2VkU3BhbnMsICdzcGFuJyl9IHN1bW1hcml6ZWQgKCR7cy5jb2xsYXBzZWRNZXNzYWdlc30gbXNncylgLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAocy5zdGFnZWRTcGFucyA+IDApIHBhcnRzLnB1c2goYCR7cy5zdGFnZWRTcGFuc30gc3RhZ2VkYClcbiAgICBjb25zdCBzdW1tYXJ5ID1cbiAgICAgIHBhcnRzLmxlbmd0aCA+IDBcbiAgICAgICAgPyBwYXJ0cy5qb2luKCcsICcpXG4gICAgICAgIDogaC50b3RhbFNwYXducyA+IDBcbiAgICAgICAgICA/IGAke2gudG90YWxTcGF3bnN9ICR7cGx1cmFsKGgudG90YWxTcGF3bnMsICdzcGF3bicpfSwgbm90aGluZyBzdGFnZWQgeWV0YFxuICAgICAgICAgIDogJ3dhaXRpbmcgZm9yIGZpcnN0IHRyaWdnZXInXG5cbiAgICBsZXQgbGluZTI6IFJlYWN0LlJlYWN0Tm9kZSA9IG51bGxcbiAgICBpZiAoaC50b3RhbEVycm9ycyA+IDApIHtcbiAgICAgIGxpbmUyID0gKFxuICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5cbiAgICAgICAgICBDb2xsYXBzZSBlcnJvcnM6IHtoLnRvdGFsRXJyb3JzfS97aC50b3RhbFNwYXduc30gc3Bhd25zIGZhaWxlZFxuICAgICAgICAgIHtoLmxhc3RFcnJvciA/IGAgKGxhc3Q6ICR7aC5sYXN0RXJyb3Iuc2xpY2UoMCwgNjApfSlgIDogJyd9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGguZW1wdHlTcGF3bldhcm5pbmdFbWl0dGVkKSB7XG4gICAgICBsaW5lMiA9IChcbiAgICAgICAgPFRleHQgY29sb3I9XCJ3YXJuaW5nXCI+XG4gICAgICAgICAgQ29sbGFwc2UgaWRsZToge2gudG90YWxFbXB0eVNwYXduc30gY29uc2VjdXRpdmUgZW1wdHkgcnVuc1xuICAgICAgICA8L1RleHQ+XG4gICAgICApXG4gICAgfVxuXG4gICAgcmV0dXJuIChcbiAgICAgIDw+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPkNvbnRleHQgc3RyYXRlZ3k6IGNvbGxhcHNlICh7c3VtbWFyeX0pPC9UZXh0PlxuICAgICAgICB7bGluZTJ9XG4gICAgICA8Lz5cbiAgICApXG4gIH1cbiAgcmV0dXJuIG51bGxcbn1cblxuLy8gT3JkZXIgZm9yIGRpc3BsYXlpbmcgc291cmNlIGdyb3VwczogUHJvamVjdCA+IFVzZXIgPiBNYW5hZ2VkID4gUGx1Z2luID4gQnVpbHQtaW5cbmNvbnN0IFNPVVJDRV9ESVNQTEFZX09SREVSID0gW1xuICAnUHJvamVjdCcsXG4gICdVc2VyJyxcbiAgJ01hbmFnZWQnLFxuICAnUGx1Z2luJyxcbiAgJ0J1aWx0LWluJyxcbl1cblxuLyoqIEdyb3VwIGl0ZW1zIGJ5IHNvdXJjZSB0eXBlIGZvciBkaXNwbGF5LCBzb3J0ZWQgYnkgdG9rZW5zIGRlc2NlbmRpbmcgd2l0aGluIGVhY2ggZ3JvdXAgKi9cbmZ1bmN0aW9uIGdyb3VwQnlTb3VyY2U8XG4gIFQgZXh0ZW5kcyB7IHNvdXJjZTogU2V0dGluZ1NvdXJjZSB8ICdwbHVnaW4nIHwgJ2J1aWx0LWluJzsgdG9rZW5zOiBudW1iZXIgfSxcbj4oaXRlbXM6IFRbXSk6IE1hcDxzdHJpbmcsIFRbXT4ge1xuICBjb25zdCBncm91cHMgPSBuZXcgTWFwPHN0cmluZywgVFtdPigpXG4gIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgIGNvbnN0IGtleSA9IGdldFNvdXJjZURpc3BsYXlOYW1lKGl0ZW0uc291cmNlKVxuICAgIGNvbnN0IGV4aXN0aW5nID0gZ3JvdXBzLmdldChrZXkpIHx8IFtdXG4gICAgZXhpc3RpbmcucHVzaChpdGVtKVxuICAgIGdyb3Vwcy5zZXQoa2V5LCBleGlzdGluZylcbiAgfVxuICAvLyBTb3J0IGVhY2ggZ3JvdXAgYnkgdG9rZW5zIGRlc2NlbmRpbmdcbiAgZm9yIChjb25zdCBba2V5LCBncm91cF0gb2YgZ3JvdXBzLmVudHJpZXMoKSkge1xuICAgIGdyb3Vwcy5zZXQoXG4gICAgICBrZXksXG4gICAgICBncm91cC5zb3J0KChhLCBiKSA9PiBiLnRva2VucyAtIGEudG9rZW5zKSxcbiAgICApXG4gIH1cbiAgLy8gUmV0dXJuIGdyb3VwcyBpbiBjb25zaXN0ZW50IG9yZGVyXG4gIGNvbnN0IG9yZGVyZWRHcm91cHMgPSBuZXcgTWFwPHN0cmluZywgVFtdPigpXG4gIGZvciAoY29uc3Qgc291cmNlIG9mIFNPVVJDRV9ESVNQTEFZX09SREVSKSB7XG4gICAgY29uc3QgZ3JvdXAgPSBncm91cHMuZ2V0KHNvdXJjZSlcbiAgICBpZiAoZ3JvdXApIHtcbiAgICAgIG9yZGVyZWRHcm91cHMuc2V0KHNvdXJjZSwgZ3JvdXApXG4gICAgfVxuICB9XG4gIHJldHVybiBvcmRlcmVkR3JvdXBzXG59XG5cbmludGVyZmFjZSBQcm9wcyB7XG4gIGRhdGE6IENvbnRleHREYXRhXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBDb250ZXh0VmlzdWFsaXphdGlvbih7IGRhdGEgfTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCB7XG4gICAgY2F0ZWdvcmllcyxcbiAgICB0b3RhbFRva2VucyxcbiAgICByYXdNYXhUb2tlbnMsXG4gICAgcGVyY2VudGFnZSxcbiAgICBncmlkUm93cyxcbiAgICBtb2RlbCxcbiAgICBtZW1vcnlGaWxlcyxcbiAgICBtY3BUb29scyxcbiAgICBkZWZlcnJlZEJ1aWx0aW5Ub29scyA9IFtdLFxuICAgIHN5c3RlbVRvb2xzLFxuICAgIHN5c3RlbVByb21wdFNlY3Rpb25zLFxuICAgIGFnZW50cyxcbiAgICBza2lsbHMsXG4gICAgbWVzc2FnZUJyZWFrZG93bixcbiAgfSA9IGRhdGFcblxuICAvLyBGaWx0ZXIgb3V0IGNhdGVnb3JpZXMgd2l0aCAwIHRva2VucyBmb3IgdGhlIGxlZ2VuZCwgYW5kIGV4Y2x1ZGUgRnJlZSBzcGFjZSwgQXV0b2NvbXBhY3QgYnVmZmVyLCBhbmQgZGVmZXJyZWRcbiAgY29uc3QgdmlzaWJsZUNhdGVnb3JpZXMgPSBjYXRlZ29yaWVzLmZpbHRlcihcbiAgICBjYXQgPT5cbiAgICAgIGNhdC50b2tlbnMgPiAwICYmXG4gICAgICBjYXQubmFtZSAhPT0gJ0ZyZWUgc3BhY2UnICYmXG4gICAgICBjYXQubmFtZSAhPT0gUkVTRVJWRURfQ0FURUdPUllfTkFNRSAmJlxuICAgICAgIWNhdC5pc0RlZmVycmVkLFxuICApXG4gIC8vIENoZWNrIGlmIE1DUCB0b29scyBhcmUgZGVmZXJyZWQgKGxvYWRlZCBvbi1kZW1hbmQgdmlhIHRvb2wgc2VhcmNoKVxuICBjb25zdCBoYXNEZWZlcnJlZE1jcFRvb2xzID0gY2F0ZWdvcmllcy5zb21lKFxuICAgIGNhdCA9PiBjYXQuaXNEZWZlcnJlZCAmJiBjYXQubmFtZS5pbmNsdWRlcygnTUNQJyksXG4gIClcbiAgLy8gQ2hlY2sgaWYgYnVpbHRpbiB0b29scyBhcmUgZGVmZXJyZWRcbiAgY29uc3QgaGFzRGVmZXJyZWRCdWlsdGluVG9vbHMgPSBkZWZlcnJlZEJ1aWx0aW5Ub29scy5sZW5ndGggPiAwXG4gIGNvbnN0IGF1dG9jb21wYWN0Q2F0ZWdvcnkgPSBjYXRlZ29yaWVzLmZpbmQoXG4gICAgY2F0ID0+IGNhdC5uYW1lID09PSBSRVNFUlZFRF9DQVRFR09SWV9OQU1FLFxuICApXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBwYWRkaW5nTGVmdD17MX0+XG4gICAgICA8VGV4dCBib2xkPkNvbnRleHQgVXNhZ2U8L1RleHQ+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezJ9PlxuICAgICAgICB7LyogRml4ZWQgc2l6ZSBncmlkICovfVxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgICB7Z3JpZFJvd3MubWFwKChyb3csIHJvd0luZGV4KSA9PiAoXG4gICAgICAgICAgICA8Qm94IGtleT17cm93SW5kZXh9IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBtYXJnaW5MZWZ0PXstMX0+XG4gICAgICAgICAgICAgIHtyb3cubWFwKChzcXVhcmUsIGNvbEluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHNxdWFyZS5jYXRlZ29yeU5hbWUgPT09ICdGcmVlIHNwYWNlJykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQga2V5PXtjb2xJbmRleH0gZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgICAgeyfim7YgJ31cbiAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3F1YXJlLmNhdGVnb3J5TmFtZSA9PT0gUkVTRVJWRURfQ0FURUdPUllfTkFNRSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQga2V5PXtjb2xJbmRleH0gY29sb3I9e3NxdWFyZS5jb2xvcn0+XG4gICAgICAgICAgICAgICAgICAgICAgeyfim50gJ31cbiAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgPFRleHQga2V5PXtjb2xJbmRleH0gY29sb3I9e3NxdWFyZS5jb2xvcn0+XG4gICAgICAgICAgICAgICAgICAgIHtzcXVhcmUuc3F1YXJlRnVsbG5lc3MgPj0gMC43ID8gJ+KbgSAnIDogJ+KbgCAnfVxuICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApKX1cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgey8qIExlZ2VuZCB0byB0aGUgcmlnaHQgKi99XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MH0gZmxleFNocmluaz17MH0+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICB7bW9kZWx9IMK3IHtmb3JtYXRUb2tlbnModG90YWxUb2tlbnMpfS97Zm9ybWF0VG9rZW5zKHJhd01heFRva2Vucyl9eycgJ31cbiAgICAgICAgICAgIHRva2VucyAoe3BlcmNlbnRhZ2V9JSlcbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPENvbGxhcHNlU3RhdHVzIC8+XG4gICAgICAgICAgPFRleHQ+IDwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICBFc3RpbWF0ZWQgdXNhZ2UgYnkgY2F0ZWdvcnlcbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAge3Zpc2libGVDYXRlZ29yaWVzLm1hcCgoY2F0LCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdG9rZW5EaXNwbGF5ID0gZm9ybWF0VG9rZW5zKGNhdC50b2tlbnMpXG4gICAgICAgICAgICAvLyBTaG93IFwiTi9BXCIgZm9yIGRlZmVycmVkIGNhdGVnb3JpZXMgc2luY2UgdGhleSBkb24ndCBjb3VudCB0b3dhcmQgY29udGV4dFxuICAgICAgICAgICAgY29uc3QgcGVyY2VudERpc3BsYXkgPSBjYXQuaXNEZWZlcnJlZFxuICAgICAgICAgICAgICA/ICdOL0EnXG4gICAgICAgICAgICAgIDogYCR7KChjYXQudG9rZW5zIC8gcmF3TWF4VG9rZW5zKSAqIDEwMCkudG9GaXhlZCgxKX0lYFxuICAgICAgICAgICAgY29uc3QgaXNSZXNlcnZlZCA9IGNhdC5uYW1lID09PSBSRVNFUlZFRF9DQVRFR09SWV9OQU1FXG4gICAgICAgICAgICBjb25zdCBkaXNwbGF5TmFtZSA9IGNhdC5uYW1lXG4gICAgICAgICAgICAvLyBEZWZlcnJlZCBjYXRlZ29yaWVzIGRvbid0IGFwcGVhciBpbiBncmlkLCBzbyBzaG93IGJsYW5rIGluc3RlYWQgb2Ygc3ltYm9sXG4gICAgICAgICAgICBjb25zdCBzeW1ib2wgPSBjYXQuaXNEZWZlcnJlZCA/ICcgJyA6IGlzUmVzZXJ2ZWQgPyAn4pudJyA6ICfim4EnXG5cbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxCb3gga2V5PXtpbmRleH0+XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9e2NhdC5jb2xvcn0+e3N5bWJvbH08L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQ+IHtkaXNwbGF5TmFtZX06IDwvVGV4dD5cbiAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgIHt0b2tlbkRpc3BsYXl9IHRva2VucyAoe3BlcmNlbnREaXNwbGF5fSlcbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKVxuICAgICAgICAgIH0pfVxuICAgICAgICAgIHsoY2F0ZWdvcmllcy5maW5kKGMgPT4gYy5uYW1lID09PSAnRnJlZSBzcGFjZScpPy50b2tlbnMgPz8gMCkgPiAwICYmIChcbiAgICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPuKbtjwvVGV4dD5cbiAgICAgICAgICAgICAgPFRleHQ+IEZyZWUgc3BhY2U6IDwvVGV4dD5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAge2Zvcm1hdFRva2VucyhcbiAgICAgICAgICAgICAgICAgIGNhdGVnb3JpZXMuZmluZChjID0+IGMubmFtZSA9PT0gJ0ZyZWUgc3BhY2UnKT8udG9rZW5zIHx8IDAsXG4gICAgICAgICAgICAgICAgKX17JyAnfVxuICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICB7KFxuICAgICAgICAgICAgICAgICAgKChjYXRlZ29yaWVzLmZpbmQoYyA9PiBjLm5hbWUgPT09ICdGcmVlIHNwYWNlJyk/LnRva2VucyB8fFxuICAgICAgICAgICAgICAgICAgICAwKSAvXG4gICAgICAgICAgICAgICAgICAgIHJhd01heFRva2VucykgKlxuICAgICAgICAgICAgICAgICAgMTAwXG4gICAgICAgICAgICAgICAgKS50b0ZpeGVkKDEpfVxuICAgICAgICAgICAgICAgICUpXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICl9XG4gICAgICAgICAge2F1dG9jb21wYWN0Q2F0ZWdvcnkgJiYgYXV0b2NvbXBhY3RDYXRlZ29yeS50b2tlbnMgPiAwICYmIChcbiAgICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPXthdXRvY29tcGFjdENhdGVnb3J5LmNvbG9yfT7im508L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiB7YXV0b2NvbXBhY3RDYXRlZ29yeS5uYW1lfTogPC9UZXh0PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICB7Zm9ybWF0VG9rZW5zKGF1dG9jb21wYWN0Q2F0ZWdvcnkudG9rZW5zKX0gdG9rZW5zIChcbiAgICAgICAgICAgICAgICB7KChhdXRvY29tcGFjdENhdGVnb3J5LnRva2VucyAvIHJhd01heFRva2VucykgKiAxMDApLnRvRml4ZWQoMSl9XG4gICAgICAgICAgICAgICAgJSlcbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cblxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luTGVmdD17LTF9PlxuICAgICAgICB7bWNwVG9vbHMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICAgIDxUZXh0IGJvbGQ+TUNQIHRvb2xzPC9UZXh0PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICB7JyAnfVxuICAgICAgICAgICAgICAgIMK3IC9tY3B7aGFzRGVmZXJyZWRNY3BUb29scyA/ICcgKGxvYWRlZCBvbi1kZW1hbmQpJyA6ICcnfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgIHsvKiBTaG93IGxvYWRlZCB0b29scyBmaXJzdCAqL31cbiAgICAgICAgICAgIHttY3BUb29scy5zb21lKHQgPT4gdC5pc0xvYWRlZCkgJiYgKFxuICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPkxvYWRlZDwvVGV4dD5cbiAgICAgICAgICAgICAgICB7bWNwVG9vbHNcbiAgICAgICAgICAgICAgICAgIC5maWx0ZXIodCA9PiB0LmlzTG9hZGVkKVxuICAgICAgICAgICAgICAgICAgLm1hcCgodG9vbCwgaSkgPT4gKFxuICAgICAgICAgICAgICAgICAgICA8Qm94IGtleT17aX0+XG4gICAgICAgICAgICAgICAgICAgICAgPFRleHQ+4pSUIHt0b29sLm5hbWV9OiA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2Zvcm1hdFRva2Vucyh0b29sLnRva2Vucyl9IHRva2VuczwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICApfVxuICAgICAgICAgICAgey8qIFNob3cgYXZhaWxhYmxlIChkZWZlcnJlZCkgdG9vbHMgKi99XG4gICAgICAgICAgICB7aGFzRGVmZXJyZWRNY3BUb29scyAmJiBtY3BUb29scy5zb21lKHQgPT4gIXQuaXNMb2FkZWQpICYmIChcbiAgICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5BdmFpbGFibGU8L1RleHQ+XG4gICAgICAgICAgICAgICAge21jcFRvb2xzXG4gICAgICAgICAgICAgICAgICAuZmlsdGVyKHQgPT4gIXQuaXNMb2FkZWQpXG4gICAgICAgICAgICAgICAgICAubWFwKCh0b29sLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgIDxCb3gga2V5PXtpfT5cbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj7ilJQge3Rvb2wubmFtZX08L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIHsvKiBTaG93IGFsbCB0b29scyBub3JtYWxseSB3aGVuIG5vdCBkZWZlcnJlZCAqL31cbiAgICAgICAgICAgIHshaGFzRGVmZXJyZWRNY3BUb29scyAmJlxuICAgICAgICAgICAgICBtY3BUb29scy5tYXAoKHRvb2wsIGkpID0+IChcbiAgICAgICAgICAgICAgICA8Qm94IGtleT17aX0+XG4gICAgICAgICAgICAgICAgICA8VGV4dD7ilJQge3Rvb2wubmFtZX06IDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntmb3JtYXRUb2tlbnModG9vbC50b2tlbnMpfSB0b2tlbnM8L1RleHQ+XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuXG4gICAgICAgIHsvKiBTaG93IGJ1aWx0aW4gdG9vbHM6IGFsd2F5cy1sb2FkZWQgKyBkZWZlcnJlZCAoYW50LW9ubHkpICovfVxuICAgICAgICB7KChzeXN0ZW1Ub29scyAmJiBzeXN0ZW1Ub29scy5sZW5ndGggPiAwKSB8fCBoYXNEZWZlcnJlZEJ1aWx0aW5Ub29scykgJiZcbiAgICAgICAgICBcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIChcbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICAgICAgPFRleHQgYm9sZD5bQU5ULU9OTFldIFN5c3RlbSB0b29sczwvVGV4dD5cbiAgICAgICAgICAgICAgICB7aGFzRGVmZXJyZWRCdWlsdGluVG9vbHMgJiYgKFxuICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+IChzb21lIGxvYWRlZCBvbi1kZW1hbmQpPC9UZXh0PlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICB7LyogQWx3YXlzLWxvYWRlZCArIGRlZmVycmVkLWJ1dC1sb2FkZWQgdG9vbHMgKi99XG4gICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+TG9hZGVkPC9UZXh0PlxuICAgICAgICAgICAgICAgIHtzeXN0ZW1Ub29scz8ubWFwKCh0b29sLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICA8Qm94IGtleT17YHN5cy0ke2l9YH0+XG4gICAgICAgICAgICAgICAgICAgIDxUZXh0PuKUlCB7dG9vbC5uYW1lfTogPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57Zm9ybWF0VG9rZW5zKHRvb2wudG9rZW5zKX0gdG9rZW5zPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAge2RlZmVycmVkQnVpbHRpblRvb2xzXG4gICAgICAgICAgICAgICAgICAuZmlsdGVyKHQgPT4gdC5pc0xvYWRlZClcbiAgICAgICAgICAgICAgICAgIC5tYXAoKHRvb2wsIGkpID0+IChcbiAgICAgICAgICAgICAgICAgICAgPEJveCBrZXk9e2BkZWYtJHtpfWB9PlxuICAgICAgICAgICAgICAgICAgICAgIDxUZXh0PuKUlCB7dG9vbC5uYW1lfTogPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntmb3JtYXRUb2tlbnModG9vbC50b2tlbnMpfSB0b2tlbnM8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICB7LyogRGVmZXJyZWQgKG5vdCB5ZXQgbG9hZGVkKSB0b29scyAqL31cbiAgICAgICAgICAgICAge2hhc0RlZmVycmVkQnVpbHRpblRvb2xzICYmXG4gICAgICAgICAgICAgICAgZGVmZXJyZWRCdWlsdGluVG9vbHMuc29tZSh0ID0+ICF0LmlzTG9hZGVkKSAmJiAoXG4gICAgICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5BdmFpbGFibGU8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIHtkZWZlcnJlZEJ1aWx0aW5Ub29sc1xuICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIodCA9PiAhdC5pc0xvYWRlZClcbiAgICAgICAgICAgICAgICAgICAgICAubWFwKCh0b29sLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8Qm94IGtleT17aX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPuKUlCB7dG9vbC5uYW1lfTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICl9XG5cbiAgICAgICAge3N5c3RlbVByb21wdFNlY3Rpb25zICYmXG4gICAgICAgICAgc3lzdGVtUHJvbXB0U2VjdGlvbnMubGVuZ3RoID4gMCAmJlxuICAgICAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgKFxuICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgICAgPFRleHQgYm9sZD5bQU5ULU9OTFldIFN5c3RlbSBwcm9tcHQgc2VjdGlvbnM8L1RleHQ+XG4gICAgICAgICAgICAgIHtzeXN0ZW1Qcm9tcHRTZWN0aW9ucy5tYXAoKHNlY3Rpb24sIGkpID0+IChcbiAgICAgICAgICAgICAgICA8Qm94IGtleT17aX0+XG4gICAgICAgICAgICAgICAgICA8VGV4dD7ilJQge3NlY3Rpb24ubmFtZX06IDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntmb3JtYXRUb2tlbnMoc2VjdGlvbi50b2tlbnMpfSB0b2tlbnM8L1RleHQ+XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cblxuICAgICAgICB7YWdlbnRzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgICA8VGV4dCBib2xkPkN1c3RvbSBhZ2VudHM8L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiDCtyAvYWdlbnRzPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICB7QXJyYXkuZnJvbShncm91cEJ5U291cmNlKGFnZW50cykuZW50cmllcygpKS5tYXAoXG4gICAgICAgICAgICAgIChbc291cmNlRGlzcGxheSwgc291cmNlQWdlbnRzXSkgPT4gKFxuICAgICAgICAgICAgICAgIDxCb3gga2V5PXtzb3VyY2VEaXNwbGF5fSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntzb3VyY2VEaXNwbGF5fTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgIHtzb3VyY2VBZ2VudHMubWFwKChhZ2VudCwgaSkgPT4gKFxuICAgICAgICAgICAgICAgICAgICA8Qm94IGtleT17aX0+XG4gICAgICAgICAgICAgICAgICAgICAgPFRleHQ+4pSUIHthZ2VudC5hZ2VudFR5cGV9OiA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2Zvcm1hdFRva2VucyhhZ2VudC50b2tlbnMpfSB0b2tlbnM8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuXG4gICAgICAgIHttZW1vcnlGaWxlcy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHQgYm9sZD5NZW1vcnkgZmlsZXM8L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiDCtyAvbWVtb3J5PC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICB7bWVtb3J5RmlsZXMubWFwKChmaWxlLCBpKSA9PiAoXG4gICAgICAgICAgICAgIDxCb3gga2V5PXtpfT5cbiAgICAgICAgICAgICAgICA8VGV4dD7ilJQge2dldERpc3BsYXlQYXRoKGZpbGUucGF0aCl9OiA8L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2Zvcm1hdFRva2VucyhmaWxlLnRva2Vucyl9IHRva2VuczwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICApKX1cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cblxuICAgICAgICB7c2tpbGxzICYmIHNraWxscy50b2tlbnMgPiAwICYmIChcbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHQgYm9sZD5Ta2lsbHM8L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiDCtyAvc2tpbGxzPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICB7QXJyYXkuZnJvbShncm91cEJ5U291cmNlKHNraWxscy5za2lsbEZyb250bWF0dGVyKS5lbnRyaWVzKCkpLm1hcChcbiAgICAgICAgICAgICAgKFtzb3VyY2VEaXNwbGF5LCBzb3VyY2VTa2lsbHNdKSA9PiAoXG4gICAgICAgICAgICAgICAgPEJveCBrZXk9e3NvdXJjZURpc3BsYXl9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e3NvdXJjZURpc3BsYXl9PC9UZXh0PlxuICAgICAgICAgICAgICAgICAge3NvdXJjZVNraWxscy5tYXAoKHNraWxsLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgIDxCb3gga2V5PXtpfT5cbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dD7ilJQge3NraWxsLm5hbWV9OiA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2Zvcm1hdFRva2Vucyhza2lsbC50b2tlbnMpfSB0b2tlbnM8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuXG4gICAgICAgIHttZXNzYWdlQnJlYWtkb3duICYmIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgKFxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBib2xkPltBTlQtT05MWV0gTWVzc2FnZSBicmVha2Rvd248L1RleHQ+XG5cbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpbkxlZnQ9ezF9PlxuICAgICAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgICAgIDxUZXh0PlRvb2wgY2FsbHM6IDwvVGV4dD5cbiAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgIHtmb3JtYXRUb2tlbnMobWVzc2FnZUJyZWFrZG93bi50b29sQ2FsbFRva2Vucyl9IHRva2Vuc1xuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgICA8VGV4dD5Ub29sIHJlc3VsdHM6IDwvVGV4dD5cbiAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgIHtmb3JtYXRUb2tlbnMobWVzc2FnZUJyZWFrZG93bi50b29sUmVzdWx0VG9rZW5zKX0gdG9rZW5zXG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICA8L0JveD5cblxuICAgICAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgICAgIDxUZXh0PkF0dGFjaG1lbnRzOiA8L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICB7Zm9ybWF0VG9rZW5zKG1lc3NhZ2VCcmVha2Rvd24uYXR0YWNobWVudFRva2Vucyl9IHRva2Vuc1xuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgICA8VGV4dD5Bc3Npc3RhbnQgbWVzc2FnZXMgKG5vbi10b29sKTogPC9UZXh0PlxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAge2Zvcm1hdFRva2VucyhtZXNzYWdlQnJlYWtkb3duLmFzc2lzdGFudE1lc3NhZ2VUb2tlbnMpfSB0b2tlbnNcbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDwvQm94PlxuXG4gICAgICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICAgICAgPFRleHQ+VXNlciBtZXNzYWdlcyAobm9uLXRvb2wtcmVzdWx0KTogPC9UZXh0PlxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAge2Zvcm1hdFRva2VucyhtZXNzYWdlQnJlYWtkb3duLnVzZXJNZXNzYWdlVG9rZW5zKX0gdG9rZW5zXG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgIDwvQm94PlxuXG4gICAgICAgICAgICB7bWVzc2FnZUJyZWFrZG93bi50b29sQ2FsbHNCeVR5cGUubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICAgICAgPFRleHQgYm9sZD5bQU5ULU9OTFldIFRvcCB0b29sczwvVGV4dD5cbiAgICAgICAgICAgICAgICB7bWVzc2FnZUJyZWFrZG93bi50b29sQ2FsbHNCeVR5cGUuc2xpY2UoMCwgNSkubWFwKCh0b29sLCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICA8Qm94IGtleT17aX0gbWFyZ2luTGVmdD17MX0+XG4gICAgICAgICAgICAgICAgICAgIDxUZXh0PuKUlCB7dG9vbC5uYW1lfTogPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAgICBjYWxscyB7Zm9ybWF0VG9rZW5zKHRvb2wuY2FsbFRva2Vucyl9LCByZXN1bHRzeycgJ31cbiAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0VG9rZW5zKHRvb2wucmVzdWx0VG9rZW5zKX1cbiAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAge21lc3NhZ2VCcmVha2Rvd24uYXR0YWNobWVudHNCeVR5cGUubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICAgICAgPFRleHQgYm9sZD5bQU5ULU9OTFldIFRvcCBhdHRhY2htZW50czwvVGV4dD5cbiAgICAgICAgICAgICAgICB7bWVzc2FnZUJyZWFrZG93bi5hdHRhY2htZW50c0J5VHlwZVxuICAgICAgICAgICAgICAgICAgLnNsaWNlKDAsIDUpXG4gICAgICAgICAgICAgICAgICAubWFwKChhdHRhY2htZW50LCBpKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgIDxCb3gga2V5PXtpfSBtYXJnaW5MZWZ0PXsxfT5cbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dD7ilJQge2F0dGFjaG1lbnQubmFtZX06IDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtmb3JtYXRUb2tlbnMoYXR0YWNobWVudC50b2tlbnMpfSB0b2tlbnNcbiAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgIDwvQm94PlxuICAgICAgPENvbnRleHRTdWdnZXN0aW9ucyBzdWdnZXN0aW9ucz17Z2VuZXJhdGVDb250ZXh0U3VnZ2VzdGlvbnMoZGF0YSl9IC8+XG4gICAgPC9Cb3g+XG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLFNBQVNBLE9BQU8sUUFBUSxZQUFZO0FBQ3BDLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsR0FBRyxFQUFFQyxJQUFJLFFBQVEsV0FBVztBQUNyQyxjQUFjQyxXQUFXLFFBQVEsNEJBQTRCO0FBQzdELFNBQVNDLDBCQUEwQixRQUFRLGdDQUFnQztBQUMzRSxTQUFTQyxjQUFjLFFBQVEsa0JBQWtCO0FBQ2pELFNBQVNDLFlBQVksUUFBUSxvQkFBb0I7QUFDakQsU0FDRUMsb0JBQW9CLEVBQ3BCLEtBQUtDLGFBQWEsUUFDYixnQ0FBZ0M7QUFDdkMsU0FBU0MsTUFBTSxRQUFRLHlCQUF5QjtBQUNoRCxTQUFTQyxrQkFBa0IsUUFBUSx5QkFBeUI7QUFFNUQsTUFBTUMsc0JBQXNCLEdBQUcsb0JBQW9COztBQUVuRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNB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