import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import React, { useCallback, useMemo, useState } from 'react';
import { mcpInfoFromString } from 'src/services/mcp/mcpStringUtils.js';
import { isMcpTool } from 'src/services/mcp/utils.js';
import type { Tool, Tools } from 'src/Tool.js';
import { filterToolsForAgent } from 'src/tools/AgentTool/agentToolUtils.js';
import { AGENT_TOOL_NAME } from 'src/tools/AgentTool/constants.js';
import { BashTool } from 'src/tools/BashTool/BashTool.js';
import { ExitPlanModeV2Tool } from 'src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.js';
import { FileEditTool } from 'src/tools/FileEditTool/FileEditTool.js';
import { FileReadTool } from 'src/tools/FileReadTool/FileReadTool.js';
import { FileWriteTool } from 'src/tools/FileWriteTool/FileWriteTool.js';
import { GlobTool } from 'src/tools/GlobTool/GlobTool.js';
import { GrepTool } from 'src/tools/GrepTool/GrepTool.js';
import { ListMcpResourcesTool } from 'src/tools/ListMcpResourcesTool/ListMcpResourcesTool.js';
import { NotebookEditTool } from 'src/tools/NotebookEditTool/NotebookEditTool.js';
import { ReadMcpResourceTool } from 'src/tools/ReadMcpResourceTool/ReadMcpResourceTool.js';
import { TaskOutputTool } from 'src/tools/TaskOutputTool/TaskOutputTool.js';
import { TaskStopTool } from 'src/tools/TaskStopTool/TaskStopTool.js';
import { TodoWriteTool } from 'src/tools/TodoWriteTool/TodoWriteTool.js';
import { TungstenTool } from 'src/tools/TungstenTool/TungstenTool.js';
import { WebFetchTool } from 'src/tools/WebFetchTool/WebFetchTool.js';
import { WebSearchTool } from 'src/tools/WebSearchTool/WebSearchTool.js';
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js';
import { Box, Text } from '../../ink.js';
import { useKeybinding } from '../../keybindings/useKeybinding.js';
import { count } from '../../utils/array.js';
import { plural } from '../../utils/stringUtils.js';
import { Divider } from '../design-system/Divider.js';
type Props = {
  tools: Tools;
  initialTools: string[] | undefined;
  onComplete: (selectedTools: string[] | undefined) => void;
  onCancel?: () => void;
};
type ToolBucket = {
  name: string;
  toolNames: Set<string>;
  isMcp?: boolean;
};
type ToolBuckets = {
  READ_ONLY: ToolBucket;
  EDIT: ToolBucket;
  EXECUTION: ToolBucket;
  MCP: ToolBucket;
  OTHER: ToolBucket;
};
function getToolBuckets(): ToolBuckets {
  return {
    READ_ONLY: {
      name: 'Read-only tools',
      toolNames: new Set([GlobTool.name, GrepTool.name, ExitPlanModeV2Tool.name, FileReadTool.name, WebFetchTool.name, TodoWriteTool.name, WebSearchTool.name, TaskStopTool.name, TaskOutputTool.name, ListMcpResourcesTool.name, ReadMcpResourceTool.name])
    },
    EDIT: {
      name: 'Edit tools',
      toolNames: new Set([FileEditTool.name, FileWriteTool.name, NotebookEditTool.name])
    },
    EXECUTION: {
      name: 'Execution tools',
      toolNames: new Set([BashTool.name, "external" === 'ant' ? TungstenTool.name : undefined].filter(n => n !== undefined))
    },
    MCP: {
      name: 'MCP tools',
      toolNames: new Set(),
      // Dynamic - no static list
      isMcp: true
    },
    OTHER: {
      name: 'Other tools',
      toolNames: new Set() // Dynamic - catch-all for uncategorized tools
    }
  };
}

// Helper to get MCP server buckets dynamically
function getMcpServerBuckets(tools: Tools): Array<{
  serverName: string;
  tools: Tools;
}> {
  const serverMap = new Map<string, Tool[]>();
  tools.forEach(tool => {
    if (isMcpTool(tool)) {
      const mcpInfo = mcpInfoFromString(tool.name);
      if (mcpInfo?.serverName) {
        const existing = serverMap.get(mcpInfo.serverName) || [];
        existing.push(tool);
        serverMap.set(mcpInfo.serverName, existing);
      }
    }
  });
  return Array.from(serverMap.entries()).map(([serverName, tools]) => ({
    serverName,
    tools
  })).sort((a, b) => a.serverName.localeCompare(b.serverName));
}
export function ToolSelector(t0) {
  const $ = _c(69);
  const {
    tools,
    initialTools,
    onComplete,
    onCancel
  } = t0;
  let t1;
  if ($[0] !== tools) {
    t1 = filterToolsForAgent({
      tools,
      isBuiltIn: false,
      isAsync: false
    });
    $[0] = tools;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const customAgentTools = t1;
  let t2;
  if ($[2] !== customAgentTools || $[3] !== initialTools) {
    t2 = !initialTools || initialTools.includes("*") ? customAgentTools.map(_temp) : initialTools;
    $[2] = customAgentTools;
    $[3] = initialTools;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  const expandedInitialTools = t2;
  const [selectedTools, setSelectedTools] = useState(expandedInitialTools);
  const [focusIndex, setFocusIndex] = useState(0);
  const [showIndividualTools, setShowIndividualTools] = useState(false);
  let t3;
  if ($[5] !== customAgentTools) {
    t3 = new Set(customAgentTools.map(_temp2));
    $[5] = customAgentTools;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  const toolNames = t3;
  let t4;
  if ($[7] !== selectedTools || $[8] !== toolNames) {
    let t5;
    if ($[10] !== toolNames) {
      t5 = name => toolNames.has(name);
      $[10] = toolNames;
      $[11] = t5;
    } else {
      t5 = $[11];
    }
    t4 = selectedTools.filter(t5);
    $[7] = selectedTools;
    $[8] = toolNames;
    $[9] = t4;
  } else {
    t4 = $[9];
  }
  const validSelectedTools = t4;
  let t5;
  if ($[12] !== validSelectedTools) {
    t5 = new Set(validSelectedTools);
    $[12] = validSelectedTools;
    $[13] = t5;
  } else {
    t5 = $[13];
  }
  const selectedSet = t5;
  const isAllSelected = validSelectedTools.length === customAgentTools.length && customAgentTools.length > 0;
  let t6;
  if ($[14] === Symbol.for("react.memo_cache_sentinel")) {
    t6 = toolName => {
      if (!toolName) {
        return;
      }
      setSelectedTools(current => current.includes(toolName) ? current.filter(t_1 => t_1 !== toolName) : [...current, toolName]);
    };
    $[14] = t6;
  } else {
    t6 = $[14];
  }
  const handleToggleTool = t6;
  let t7;
  if ($[15] === Symbol.for("react.memo_cache_sentinel")) {
    t7 = (toolNames_0, select) => {
      setSelectedTools(current_0 => {
        if (select) {
          const toolsToAdd = toolNames_0.filter(t_2 => !current_0.includes(t_2));
          return [...current_0, ...toolsToAdd];
        } else {
          return current_0.filter(t_3 => !toolNames_0.includes(t_3));
        }
      });
    };
    $[15] = t7;
  } else {
    t7 = $[15];
  }
  const handleToggleTools = t7;
  let t8;
  if ($[16] !== customAgentTools || $[17] !== onComplete || $[18] !== validSelectedTools) {
    t8 = () => {
      const allToolNames = customAgentTools.map(_temp3);
      const areAllToolsSelected = validSelectedTools.length === allToolNames.length && allToolNames.every(name_0 => validSelectedTools.includes(name_0));
      const finalTools = areAllToolsSelected ? undefined : validSelectedTools;
      onComplete(finalTools);
    };
    $[16] = customAgentTools;
    $[17] = onComplete;
    $[18] = validSelectedTools;
    $[19] = t8;
  } else {
    t8 = $[19];
  }
  const handleConfirm = t8;
  let buckets;
  if ($[20] !== customAgentTools) {
    const toolBuckets = getToolBuckets();
    buckets = {
      readOnly: [] as Tool[],
      edit: [] as Tool[],
      execution: [] as Tool[],
      mcp: [] as Tool[],
      other: [] as Tool[]
    };
    customAgentTools.forEach(tool => {
      if (isMcpTool(tool)) {
        buckets.mcp.push(tool);
      } else {
        if (toolBuckets.READ_ONLY.toolNames.has(tool.name)) {
          buckets.readOnly.push(tool);
        } else {
          if (toolBuckets.EDIT.toolNames.has(tool.name)) {
            buckets.edit.push(tool);
          } else {
            if (toolBuckets.EXECUTION.toolNames.has(tool.name)) {
              buckets.execution.push(tool);
            } else {
              if (tool.name !== AGENT_TOOL_NAME) {
                buckets.other.push(tool);
              }
            }
          }
        }
      }
    });
    $[20] = customAgentTools;
    $[21] = buckets;
  } else {
    buckets = $[21];
  }
  const toolsByBucket = buckets;
  let t9;
  if ($[22] !== selectedSet) {
    t9 = bucketTools => {
      const selected = count(bucketTools, t_5 => selectedSet.has(t_5.name));
      const needsSelection = selected < bucketTools.length;
      return () => {
        const toolNames_1 = bucketTools.map(_temp4);
        handleToggleTools(toolNames_1, needsSelection);
      };
    };
    $[22] = selectedSet;
    $[23] = t9;
  } else {
    t9 = $[23];
  }
  const createBucketToggleAction = t9;
  let navigableItems;
  if ($[24] !== createBucketToggleAction || $[25] !== customAgentTools || $[26] !== focusIndex || $[27] !== handleConfirm || $[28] !== isAllSelected || $[29] !== selectedSet || $[30] !== showIndividualTools || $[31] !== toolsByBucket.edit || $[32] !== toolsByBucket.execution || $[33] !== toolsByBucket.mcp || $[34] !== toolsByBucket.other || $[35] !== toolsByBucket.readOnly) {
    navigableItems = [];
    navigableItems.push({
      id: "continue",
      label: "Continue",
      action: handleConfirm,
      isContinue: true
    });
    let t10;
    if ($[37] !== customAgentTools || $[38] !== isAllSelected) {
      t10 = () => {
        const allToolNames_0 = customAgentTools.map(_temp5);
        handleToggleTools(allToolNames_0, !isAllSelected);
      };
      $[37] = customAgentTools;
      $[38] = isAllSelected;
      $[39] = t10;
    } else {
      t10 = $[39];
    }
    navigableItems.push({
      id: "bucket-all",
      label: `${isAllSelected ? figures.checkboxOn : figures.checkboxOff} All tools`,
      action: t10
    });
    const toolBuckets_0 = getToolBuckets();
    const bucketConfigs = [{
      id: "bucket-readonly",
      name: toolBuckets_0.READ_ONLY.name,
      tools: toolsByBucket.readOnly
    }, {
      id: "bucket-edit",
      name: toolBuckets_0.EDIT.name,
      tools: toolsByBucket.edit
    }, {
      id: "bucket-execution",
      name: toolBuckets_0.EXECUTION.name,
      tools: toolsByBucket.execution
    }, {
      id: "bucket-mcp",
      name: toolBuckets_0.MCP.name,
      tools: toolsByBucket.mcp
    }, {
      id: "bucket-other",
      name: toolBuckets_0.OTHER.name,
      tools: toolsByBucket.other
    }];
    bucketConfigs.forEach(t11 => {
      const {
        id,
        name: name_1,
        tools: bucketTools_0
      } = t11;
      if (bucketTools_0.length === 0) {
        return;
      }
      const selected_0 = count(bucketTools_0, t_8 => selectedSet.has(t_8.name));
      const isFullySelected = selected_0 === bucketTools_0.length;
      navigableItems.push({
        id,
        label: `${isFullySelected ? figures.checkboxOn : figures.checkboxOff} ${name_1}`,
        action: createBucketToggleAction(bucketTools_0)
      });
    });
    const toggleButtonIndex = navigableItems.length;
    let t12;
    if ($[40] !== focusIndex || $[41] !== showIndividualTools || $[42] !== toggleButtonIndex) {
      t12 = () => {
        setShowIndividualTools(!showIndividualTools);
        if (showIndividualTools && focusIndex > toggleButtonIndex) {
          setFocusIndex(toggleButtonIndex);
        }
      };
      $[40] = focusIndex;
      $[41] = showIndividualTools;
      $[42] = toggleButtonIndex;
      $[43] = t12;
    } else {
      t12 = $[43];
    }
    navigableItems.push({
      id: "toggle-individual",
      label: showIndividualTools ? "Hide advanced options" : "Show advanced options",
      action: t12,
      isToggle: true
    });
    const mcpServerBuckets = getMcpServerBuckets(customAgentTools);
    if (showIndividualTools) {
      if (mcpServerBuckets.length > 0) {
        navigableItems.push({
          id: "mcp-servers-header",
          label: "MCP Servers:",
          action: _temp6,
          isHeader: true
        });
        mcpServerBuckets.forEach(t13 => {
          const {
            serverName,
            tools: serverTools
          } = t13;
          const selected_1 = count(serverTools, t_9 => selectedSet.has(t_9.name));
          const isFullySelected_0 = selected_1 === serverTools.length;
          navigableItems.push({
            id: `mcp-server-${serverName}`,
            label: `${isFullySelected_0 ? figures.checkboxOn : figures.checkboxOff} ${serverName} (${serverTools.length} ${plural(serverTools.length, "tool")})`,
            action: () => {
              const toolNames_2 = serverTools.map(_temp7);
              handleToggleTools(toolNames_2, !isFullySelected_0);
            }
          });
        });
        navigableItems.push({
          id: "tools-header",
          label: "Individual Tools:",
          action: _temp8,
          isHeader: true
        });
      }
      customAgentTools.forEach(tool_0 => {
        let displayName = tool_0.name;
        if (tool_0.name.startsWith("mcp__")) {
          const mcpInfo = mcpInfoFromString(tool_0.name);
          displayName = mcpInfo ? `${mcpInfo.toolName} (${mcpInfo.serverName})` : tool_0.name;
        }
        navigableItems.push({
          id: `tool-${tool_0.name}`,
          label: `${selectedSet.has(tool_0.name) ? figures.checkboxOn : figures.checkboxOff} ${displayName}`,
          action: () => handleToggleTool(tool_0.name)
        });
      });
    }
    $[24] = createBucketToggleAction;
    $[25] = customAgentTools;
    $[26] = focusIndex;
    $[27] = handleConfirm;
    $[28] = isAllSelected;
    $[29] = selectedSet;
    $[30] = showIndividualTools;
    $[31] = toolsByBucket.edit;
    $[32] = toolsByBucket.execution;
    $[33] = toolsByBucket.mcp;
    $[34] = toolsByBucket.other;
    $[35] = toolsByBucket.readOnly;
    $[36] = navigableItems;
  } else {
    navigableItems = $[36];
  }
  let t10;
  if ($[44] !== initialTools || $[45] !== onCancel || $[46] !== onComplete) {
    t10 = () => {
      if (onCancel) {
        onCancel();
      } else {
        onComplete(initialTools);
      }
    };
    $[44] = initialTools;
    $[45] = onCancel;
    $[46] = onComplete;
    $[47] = t10;
  } else {
    t10 = $[47];
  }
  const handleCancel = t10;
  let t11;
  if ($[48] === Symbol.for("react.memo_cache_sentinel")) {
    t11 = {
      context: "Confirmation"
    };
    $[48] = t11;
  } else {
    t11 = $[48];
  }
  useKeybinding("confirm:no", handleCancel, t11);
  let t12;
  if ($[49] !== focusIndex || $[50] !== navigableItems) {
    t12 = e => {
      if (e.key === "return") {
        e.preventDefault();
        const item = navigableItems[focusIndex];
        if (item && !item.isHeader) {
          item.action();
        }
      } else {
        if (e.key === "up") {
          e.preventDefault();
          let newIndex = focusIndex - 1;
          while (newIndex > 0 && navigableItems[newIndex]?.isHeader) {
            newIndex--;
          }
          setFocusIndex(Math.max(0, newIndex));
        } else {
          if (e.key === "down") {
            e.preventDefault();
            let newIndex_0 = focusIndex + 1;
            while (newIndex_0 < navigableItems.length - 1 && navigableItems[newIndex_0]?.isHeader) {
              newIndex_0++;
            }
            setFocusIndex(Math.min(navigableItems.length - 1, newIndex_0));
          }
        }
      }
    };
    $[49] = focusIndex;
    $[50] = navigableItems;
    $[51] = t12;
  } else {
    t12 = $[51];
  }
  const handleKeyDown = t12;
  const t13 = focusIndex === 0 ? "suggestion" : undefined;
  const t14 = focusIndex === 0;
  const t15 = focusIndex === 0 ? `${figures.pointer} ` : "  ";
  let t16;
  if ($[52] !== t13 || $[53] !== t14 || $[54] !== t15) {
    t16 = <Text color={t13} bold={t14}>{t15}[ Continue ]</Text>;
    $[52] = t13;
    $[53] = t14;
    $[54] = t15;
    $[55] = t16;
  } else {
    t16 = $[55];
  }
  let t17;
  if ($[56] === Symbol.for("react.memo_cache_sentinel")) {
    t17 = <Divider width={40} />;
    $[56] = t17;
  } else {
    t17 = $[56];
  }
  let t18;
  if ($[57] !== navigableItems) {
    t18 = navigableItems.slice(1);
    $[57] = navigableItems;
    $[58] = t18;
  } else {
    t18 = $[58];
  }
  let t19;
  if ($[59] !== focusIndex || $[60] !== t18) {
    t19 = t18.map((item_0, index) => {
      const isCurrentlyFocused = index + 1 === focusIndex;
      const isToggleButton = item_0.isToggle;
      const isHeader = item_0.isHeader;
      return <React.Fragment key={item_0.id}>{isToggleButton && <Divider width={40} />}{isHeader && index > 0 && <Box marginTop={1} />}<Text color={isHeader ? undefined : isCurrentlyFocused ? "suggestion" : undefined} dimColor={isHeader} bold={isToggleButton && isCurrentlyFocused}>{isHeader ? "" : isCurrentlyFocused ? `${figures.pointer} ` : "  "}{isToggleButton ? `[ ${item_0.label} ]` : item_0.label}</Text></React.Fragment>;
    });
    $[59] = focusIndex;
    $[60] = t18;
    $[61] = t19;
  } else {
    t19 = $[61];
  }
  const t20 = isAllSelected ? "All tools selected" : `${selectedSet.size} of ${customAgentTools.length} tools selected`;
  let t21;
  if ($[62] !== t20) {
    t21 = <Box marginTop={1} flexDirection="column"><Text dimColor={true}>{t20}</Text></Box>;
    $[62] = t20;
    $[63] = t21;
  } else {
    t21 = $[63];
  }
  let t22;
  if ($[64] !== handleKeyDown || $[65] !== t16 || $[66] !== t19 || $[67] !== t21) {
    t22 = <Box flexDirection="column" marginTop={1} tabIndex={0} autoFocus={true} onKeyDown={handleKeyDown}>{t16}{t17}{t19}{t21}</Box>;
    $[64] = handleKeyDown;
    $[65] = t16;
    $[66] = t19;
    $[67] = t21;
    $[68] = t22;
  } else {
    t22 = $[68];
  }
  return t22;
}
function _temp8() {}
function _temp7(t_10) {
  return t_10.name;
}
function _temp6() {}
function _temp5(t_7) {
  return t_7.name;
}
function _temp4(t_6) {
  return t_6.name;
}
function _temp3(t_4) {
  return t_4.name;
}
function _temp2(t_0) {
  return t_0.name;
}
function _temp(t) {
  return t.name;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZU1lbW8iLCJ1c2VTdGF0ZSIsIm1jcEluZm9Gcm9tU3RyaW5nIiwiaXNNY3BUb29sIiwiVG9vbCIsIlRvb2xzIiwiZmlsdGVyVG9vbHNGb3JBZ2VudCIsIkFHRU5UX1RPT0xfTkFNRSIsIkJhc2hUb29sIiwiRXhpdFBsYW5Nb2RlVjJUb29sIiwiRmlsZUVkaXRUb29sIiwiRmlsZVJlYWRUb29sIiwiRmlsZVdyaXRlVG9vbCIsIkdsb2JUb29sIiwiR3JlcFRvb2wiLCJMaXN0TWNwUmVzb3VyY2VzVG9vbCIsIk5vdGVib29rRWRpdFRvb2wiLCJSZWFkTWNwUmVzb3VyY2VUb29sIiwiVGFza091dHB1dFRvb2wiLCJUYXNrU3RvcFRvb2wiLCJUb2RvV3JpdGVUb29sIiwiVHVuZ3N0ZW5Ub29sIiwiV2ViRmV0Y2hUb29sIiwiV2ViU2VhcmNoVG9vbCIsIktleWJvYXJkRXZlbnQiLCJCb3giLCJUZXh0IiwidXNlS2V5YmluZGluZyIsImNvdW50IiwicGx1cmFsIiwiRGl2aWRlciIsIlByb3BzIiwidG9vbHMiLCJpbml0aWFsVG9vbHMiLCJvbkNvbXBsZXRlIiwic2VsZWN0ZWRUb29scyIsIm9uQ2FuY2VsIiwiVG9vbEJ1Y2tldCIsIm5hbWUiLCJ0b29sTmFtZXMiLCJTZXQiLCJpc01jcCIsIlRvb2xCdWNrZXRzIiwiUkVBRF9PTkxZIiwiRURJVCIsIkVYRUNVVElPTiIsIk1DUCIsIk9USEVSIiwiZ2V0VG9vbEJ1Y2tldHMiLCJ1bmRlZmluZWQiLCJmaWx0ZXIiLCJuIiwiZ2V0TWNwU2VydmVyQnVja2V0cyIsIkFycmF5Iiwic2VydmVyTmFtZSIsInNlcnZlck1hcCIsIk1hcCIsImZvckVhY2giLCJ0b29sIiwibWNwSW5mbyIsImV4aXN0aW5nIiwiZ2V0IiwicHVzaCIsInNldCIsImZyb20iLCJlbnRyaWVzIiwibWFwIiwic29ydCIsImEiLCJiIiwibG9jYWxlQ29tcGFyZSIsIlRvb2xTZWxlY3RvciIsInQwIiwiJCIsIl9jIiwidDEiLCJpc0J1aWx0SW4iLCJpc0FzeW5jIiwiY3VzdG9tQWdlbnRUb29scyIsInQyIiwiaW5jbHVkZXMiLCJfdGVtcCIsImV4cGFuZGVkSW5pdGlhbFRvb2xzIiwic2V0U2VsZWN0ZWRUb29scyIsImZvY3VzSW5kZXgiLCJzZXRGb2N1c0luZGV4Iiwic2hvd0luZGl2aWR1YWxUb29scyIsInNldFNob3dJbmRpdmlkdWFsVG9vbHMiLCJ0MyIsIl90ZW1wMiIsInQ0IiwidDUiLCJoYXMiLCJ2YWxpZFNlbGVjdGVkVG9vbHMiLCJzZWxlY3RlZFNldCIsImlzQWxsU2VsZWN0ZWQiLCJsZW5ndGgiLCJ0NiIsIlN5bWJvbCIsImZvciIsInRvb2xOYW1lIiwiY3VycmVudCIsInRfMSIsInQiLCJoYW5kbGVUb2dnbGVUb29sIiwidDciLCJ0b29sTmFtZXNfMCIsInNlbGVjdCIsImN1cnJlbnRfMCIsInRvb2xzVG9BZGQiLCJ0XzIiLCJ0XzMiLCJoYW5kbGVUb2dnbGVUb29scyIsInQ4IiwiYWxsVG9vbE5hbWVzIiwiX3RlbXAzIiwiYXJlQWxsVG9vbHNTZWxlY3RlZCIsImV2ZXJ5IiwibmFtZV8wIiwiZmluYWxUb29scyIsImhhbmRsZUNvbmZpcm0iLCJidWNrZXRzIiwidG9vbEJ1Y2tldHMiLCJyZWFkT25seSIsImVkaXQiLCJleGVjdXRpb24iLCJtY3AiLCJvdGhlciIsInRvb2xzQnlCdWNrZXQiLCJ0OSIsImJ1Y2tldFRvb2xzIiwic2VsZWN0ZWQiLCJ0XzUiLCJuZWVkc1NlbGVjdGlvbiIsInRvb2xOYW1lc18xIiwiX3RlbXA0IiwiY3JlYXRlQnVja2V0VG9nZ2xlQWN0aW9uIiwibmF2aWdhYmxlSXRlbXMiLCJpZCIsImxhYmVsIiwiYWN0aW9uIiwiaXNDb250aW51ZSIsInQxMCIsImFsbFRvb2xOYW1lc18wIiwiX3RlbXA1IiwiY2hlY2tib3hPbiIsImNoZWNrYm94T2ZmIiwidG9vbEJ1Y2tldHNfMCIsImJ1Y2tldENvbmZpZ3MiLCJ0MTEiLCJuYW1lXzEiLCJidWNrZXRUb29sc18wIiwic2VsZWN0ZWRfMCIsInRfOCIsImlzRnVsbHlTZWxlY3RlZCIsInRvZ2dsZUJ1dHRvbkluZGV4IiwidDEyIiwiaXNUb2dnbGUiLCJtY3BTZXJ2ZXJCdWNrZXRzIiwiX3RlbXA2IiwiaXNIZWFkZXIiLCJ0MTMiLCJzZXJ2ZXJUb29scyIsInNlbGVjdGVkXzEiLCJ0XzkiLCJpc0Z1bGx5U2VsZWN0ZWRfMCIsInRvb2xOYW1lc18yIiwiX3RlbXA3IiwiX3RlbXA4IiwidG9vbF8wIiwiZGlzcGxheU5hbWUiLCJzdGFydHNXaXRoIiwiaGFuZGxlQ2FuY2VsIiwiY29udGV4dCIsImUiLCJrZXkiLCJwcmV2ZW50RGVmYXVsdCIsIml0ZW0iLCJuZXdJbmRleCIsIk1hdGgiLCJtYXgiLCJuZXdJbmRleF8wIiwibWluIiwiaGFuZGxlS2V5RG93biIsInQxNCIsInQxNSIsInBvaW50ZXIiLCJ0MTYiLCJ0MTciLCJ0MTgiLCJzbGljZSIsInQxOSIsIml0ZW1fMCIsImluZGV4IiwiaXNDdXJyZW50bHlGb2N1c2VkIiwiaXNUb2dnbGVCdXR0b24iLCJ0MjAiLCJzaXplIiwidDIxIiwidDIyIiwidF8xMCIsInRfNyIsInRfNiIsInRfNCIsInRfMCJdLCJzb3VyY2VzIjpbIlRvb2xTZWxlY3Rvci50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCBSZWFjdCwgeyB1c2VDYWxsYmFjaywgdXNlTWVtbywgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IG1jcEluZm9Gcm9tU3RyaW5nIH0gZnJvbSAnc3JjL3NlcnZpY2VzL21jcC9tY3BTdHJpbmdVdGlscy5qcydcbmltcG9ydCB7IGlzTWNwVG9vbCB9IGZyb20gJ3NyYy9zZXJ2aWNlcy9tY3AvdXRpbHMuanMnXG5pbXBvcnQgdHlwZSB7IFRvb2wsIFRvb2xzIH0gZnJvbSAnc3JjL1Rvb2wuanMnXG5pbXBvcnQgeyBmaWx0ZXJUb29sc0ZvckFnZW50IH0gZnJvbSAnc3JjL3Rvb2xzL0FnZW50VG9vbC9hZ2VudFRvb2xVdGlscy5qcydcbmltcG9ydCB7IEFHRU5UX1RPT0xfTkFNRSB9IGZyb20gJ3NyYy90b29scy9BZ2VudFRvb2wvY29uc3RhbnRzLmpzJ1xuaW1wb3J0IHsgQmFzaFRvb2wgfSBmcm9tICdzcmMvdG9vbHMvQmFzaFRvb2wvQmFzaFRvb2wuanMnXG5pbXBvcnQgeyBFeGl0UGxhbk1vZGVWMlRvb2wgfSBmcm9tICdzcmMvdG9vbHMvRXhpdFBsYW5Nb2RlVG9vbC9FeGl0UGxhbk1vZGVWMlRvb2wuanMnXG5pbXBvcnQgeyBGaWxlRWRpdFRvb2wgfSBmcm9tICdzcmMvdG9vbHMvRmlsZUVkaXRUb29sL0ZpbGVFZGl0VG9vbC5qcydcbmltcG9ydCB7IEZpbGVSZWFkVG9vbCB9IGZyb20gJ3NyYy90b29scy9GaWxlUmVhZFRvb2wvRmlsZVJlYWRUb29sLmpzJ1xuaW1wb3J0IHsgRmlsZVdyaXRlVG9vbCB9IGZyb20gJ3NyYy90b29scy9GaWxlV3JpdGVUb29sL0ZpbGVXcml0ZVRvb2wuanMnXG5pbXBvcnQgeyBHbG9iVG9vbCB9IGZyb20gJ3NyYy90b29scy9HbG9iVG9vbC9HbG9iVG9vbC5qcydcbmltcG9ydCB7IEdyZXBUb29sIH0gZnJvbSAnc3JjL3Rvb2xzL0dyZXBUb29sL0dyZXBUb29sLmpzJ1xuaW1wb3J0IHsgTGlzdE1jcFJlc291cmNlc1Rvb2wgfSBmcm9tICdzcmMvdG9vbHMvTGlzdE1jcFJlc291cmNlc1Rvb2wvTGlzdE1jcFJlc291cmNlc1Rvb2wuanMnXG5pbXBvcnQgeyBOb3RlYm9va0VkaXRUb29sIH0gZnJvbSAnc3JjL3Rvb2xzL05vdGVib29rRWRpdFRvb2wvTm90ZWJvb2tFZGl0VG9vbC5qcydcbmltcG9ydCB7IFJlYWRNY3BSZXNvdXJjZVRvb2wgfSBmcm9tICdzcmMvdG9vbHMvUmVhZE1jcFJlc291cmNlVG9vbC9SZWFkTWNwUmVzb3VyY2VUb29sLmpzJ1xuaW1wb3J0IHsgVGFza091dHB1dFRvb2wgfSBmcm9tICdzcmMvdG9vbHMvVGFza091dHB1dFRvb2wvVGFza091dHB1dFRvb2wuanMnXG5pbXBvcnQgeyBUYXNrU3RvcFRvb2wgfSBmcm9tICdzcmMvdG9vbHMvVGFza1N0b3BUb29sL1Rhc2tTdG9wVG9vbC5qcydcbmltcG9ydCB7IFRvZG9Xcml0ZVRvb2wgfSBmcm9tICdzcmMvdG9vbHMvVG9kb1dyaXRlVG9vbC9Ub2RvV3JpdGVUb29sLmpzJ1xuaW1wb3J0IHsgVHVuZ3N0ZW5Ub29sIH0gZnJvbSAnc3JjL3Rvb2xzL1R1bmdzdGVuVG9vbC9UdW5nc3RlblRvb2wuanMnXG5pbXBvcnQgeyBXZWJGZXRjaFRvb2wgfSBmcm9tICdzcmMvdG9vbHMvV2ViRmV0Y2hUb29sL1dlYkZldGNoVG9vbC5qcydcbmltcG9ydCB7IFdlYlNlYXJjaFRvb2wgfSBmcm9tICdzcmMvdG9vbHMvV2ViU2VhcmNoVG9vbC9XZWJTZWFyY2hUb29sLmpzJ1xuaW1wb3J0IHR5cGUgeyBLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vaW5rL2V2ZW50cy9rZXlib2FyZC1ldmVudC5qcydcbmltcG9ydCB7IEJveCwgVGV4dCB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7IHVzZUtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHsgY291bnQgfSBmcm9tICcuLi8uLi91dGlscy9hcnJheS5qcydcbmltcG9ydCB7IHBsdXJhbCB9IGZyb20gJy4uLy4uL3V0aWxzL3N0cmluZ1V0aWxzLmpzJ1xuaW1wb3J0IHsgRGl2aWRlciB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vRGl2aWRlci5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgdG9vbHM6IFRvb2xzXG4gIGluaXRpYWxUb29sczogc3RyaW5nW10gfCB1bmRlZmluZWRcbiAgb25Db21wbGV0ZTogKHNlbGVjdGVkVG9vbHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkKSA9PiB2b2lkXG4gIG9uQ2FuY2VsPzogKCkgPT4gdm9pZFxufVxuXG50eXBlIFRvb2xCdWNrZXQgPSB7XG4gIG5hbWU6IHN0cmluZ1xuICB0b29sTmFtZXM6IFNldDxzdHJpbmc+XG4gIGlzTWNwPzogYm9vbGVhblxufVxuXG50eXBlIFRvb2xCdWNrZXRzID0ge1xuICBSRUFEX09OTFk6IFRvb2xCdWNrZXRcbiAgRURJVDogVG9vbEJ1Y2tldFxuICBFWEVDVVRJT046IFRvb2xCdWNrZXRcbiAgTUNQOiBUb29sQnVja2V0XG4gIE9USEVSOiBUb29sQnVja2V0XG59XG5cbmZ1bmN0aW9uIGdldFRvb2xCdWNrZXRzKCk6IFRvb2xCdWNrZXRzIHtcbiAgcmV0dXJuIHtcbiAgICBSRUFEX09OTFk6IHtcbiAgICAgIG5hbWU6ICdSZWFkLW9ubHkgdG9vbHMnLFxuICAgICAgdG9vbE5hbWVzOiBuZXcgU2V0KFtcbiAgICAgICAgR2xvYlRvb2wubmFtZSxcbiAgICAgICAgR3JlcFRvb2wubmFtZSxcbiAgICAgICAgRXhpdFBsYW5Nb2RlVjJUb29sLm5hbWUsXG4gICAgICAgIEZpbGVSZWFkVG9vbC5uYW1lLFxuICAgICAgICBXZWJGZXRjaFRvb2wubmFtZSxcbiAgICAgICAgVG9kb1dyaXRlVG9vbC5uYW1lLFxuICAgICAgICBXZWJTZWFyY2hUb29sLm5hbWUsXG4gICAgICAgIFRhc2tTdG9wVG9vbC5uYW1lLFxuICAgICAgICBUYXNrT3V0cHV0VG9vbC5uYW1lLFxuICAgICAgICBMaXN0TWNwUmVzb3VyY2VzVG9vbC5uYW1lLFxuICAgICAgICBSZWFkTWNwUmVzb3VyY2VUb29sLm5hbWUsXG4gICAgICBdKSxcbiAgICB9LFxuICAgIEVESVQ6IHtcbiAgICAgIG5hbWU6ICdFZGl0IHRvb2xzJyxcbiAgICAgIHRvb2xOYW1lczogbmV3IFNldChbXG4gICAgICAgIEZpbGVFZGl0VG9vbC5uYW1lLFxuICAgICAgICBGaWxlV3JpdGVUb29sLm5hbWUsXG4gICAgICAgIE5vdGVib29rRWRpdFRvb2wubmFtZSxcbiAgICAgIF0pLFxuICAgIH0sXG4gICAgRVhFQ1VUSU9OOiB7XG4gICAgICBuYW1lOiAnRXhlY3V0aW9uIHRvb2xzJyxcbiAgICAgIHRvb2xOYW1lczogbmV3IFNldChcbiAgICAgICAgW1xuICAgICAgICAgIEJhc2hUb29sLm5hbWUsXG4gICAgICAgICAgXCJleHRlcm5hbFwiID09PSAnYW50JyA/IFR1bmdzdGVuVG9vbC5uYW1lIDogdW5kZWZpbmVkLFxuICAgICAgICBdLmZpbHRlcihuID0+IG4gIT09IHVuZGVmaW5lZCksXG4gICAgICApLFxuICAgIH0sXG4gICAgTUNQOiB7XG4gICAgICBuYW1lOiAnTUNQIHRvb2xzJyxcbiAgICAgIHRvb2xOYW1lczogbmV3IFNldCgpLCAvLyBEeW5hbWljIC0gbm8gc3RhdGljIGxpc3RcbiAgICAgIGlzTWNwOiB0cnVlLFxuICAgIH0sXG4gICAgT1RIRVI6IHtcbiAgICAgIG5hbWU6ICdPdGhlciB0b29scycsXG4gICAgICB0b29sTmFtZXM6IG5ldyBTZXQoKSwgLy8gRHluYW1pYyAtIGNhdGNoLWFsbCBmb3IgdW5jYXRlZ29yaXplZCB0b29sc1xuICAgIH0sXG4gIH1cbn1cblxuLy8gSGVscGVyIHRvIGdldCBNQ1Agc2VydmVyIGJ1Y2tldHMgZHluYW1pY2FsbHlcbmZ1bmN0aW9uIGdldE1jcFNlcnZlckJ1Y2tldHModG9vbHM6IFRvb2xzKTogQXJyYXk8e1xuICBzZXJ2ZXJOYW1lOiBzdHJpbmdcbiAgdG9vbHM6IFRvb2xzXG59PiB7XG4gIGNvbnN0IHNlcnZlck1hcCA9IG5ldyBNYXA8c3RyaW5nLCBUb29sW10+KClcblxuICB0b29scy5mb3JFYWNoKHRvb2wgPT4ge1xuICAgIGlmIChpc01jcFRvb2wodG9vbCkpIHtcbiAgICAgIGNvbnN0IG1jcEluZm8gPSBtY3BJbmZvRnJvbVN0cmluZyh0b29sLm5hbWUpXG4gICAgICBpZiAobWNwSW5mbz8uc2VydmVyTmFtZSkge1xuICAgICAgICBjb25zdCBleGlzdGluZyA9IHNlcnZlck1hcC5nZXQobWNwSW5mby5zZXJ2ZXJOYW1lKSB8fCBbXVxuICAgICAgICBleGlzdGluZy5wdXNoKHRvb2wpXG4gICAgICAgIHNlcnZlck1hcC5zZXQobWNwSW5mby5zZXJ2ZXJOYW1lLCBleGlzdGluZylcbiAgICAgIH1cbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIEFycmF5LmZyb20oc2VydmVyTWFwLmVudHJpZXMoKSlcbiAgICAubWFwKChbc2VydmVyTmFtZSwgdG9vbHNdKSA9PiAoeyBzZXJ2ZXJOYW1lLCB0b29scyB9KSlcbiAgICAuc29ydCgoYSwgYikgPT4gYS5zZXJ2ZXJOYW1lLmxvY2FsZUNvbXBhcmUoYi5zZXJ2ZXJOYW1lKSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFRvb2xTZWxlY3Rvcih7XG4gIHRvb2xzLFxuICBpbml0aWFsVG9vbHMsXG4gIG9uQ29tcGxldGUsXG4gIG9uQ2FuY2VsLFxufTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICAvLyBGaWx0ZXIgdG9vbHMgZm9yIGN1c3RvbSBhZ2VudHNcbiAgY29uc3QgY3VzdG9tQWdlbnRUb29scyA9IHVzZU1lbW8oXG4gICAgKCkgPT4gZmlsdGVyVG9vbHNGb3JBZ2VudCh7IHRvb2xzLCBpc0J1aWx0SW46IGZhbHNlLCBpc0FzeW5jOiBmYWxzZSB9KSxcbiAgICBbdG9vbHNdLFxuICApXG5cbiAgLy8gRXhwYW5kIHdpbGRjYXJkIG9yIHVuZGVmaW5lZCB0byBleHBsaWNpdCB0b29sIGxpc3QgZm9yIGludGVybmFsIHN0YXRlXG4gIGNvbnN0IGV4cGFuZGVkSW5pdGlhbFRvb2xzID1cbiAgICAhaW5pdGlhbFRvb2xzIHx8IGluaXRpYWxUb29scy5pbmNsdWRlcygnKicpXG4gICAgICA/IGN1c3RvbUFnZW50VG9vbHMubWFwKHQgPT4gdC5uYW1lKVxuICAgICAgOiBpbml0aWFsVG9vbHNcblxuICBjb25zdCBbc2VsZWN0ZWRUb29scywgc2V0U2VsZWN0ZWRUb29sc10gPVxuICAgIHVzZVN0YXRlPHN0cmluZ1tdPihleHBhbmRlZEluaXRpYWxUb29scylcbiAgY29uc3QgW2ZvY3VzSW5kZXgsIHNldEZvY3VzSW5kZXhdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgW3Nob3dJbmRpdmlkdWFsVG9vbHMsIHNldFNob3dJbmRpdmlkdWFsVG9vbHNdID0gdXNlU3RhdGUoZmFsc2UpXG5cbiAgLy8gRmlsdGVyIHNlbGVjdGVkVG9vbHMgdG8gb25seSBpbmNsdWRlIHRvb2xzIHRoYXQgY3VycmVudGx5IGV4aXN0XG4gIC8vIFRoaXMgaGFuZGxlcyBNQ1AgdG9vbHMgdGhhdCBkaXNjb25uZWN0IHdoaWxlIHNlbGVjdGVkXG4gIGNvbnN0IHZhbGlkU2VsZWN0ZWRUb29scyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHRvb2xOYW1lcyA9IG5ldyBTZXQoY3VzdG9tQWdlbnRUb29scy5tYXAodCA9PiB0Lm5hbWUpKVxuICAgIHJldHVybiBzZWxlY3RlZFRvb2xzLmZpbHRlcihuYW1lID0+IHRvb2xOYW1lcy5oYXMobmFtZSkpXG4gIH0sIFtzZWxlY3RlZFRvb2xzLCBjdXN0b21BZ2VudFRvb2xzXSlcblxuICBjb25zdCBzZWxlY3RlZFNldCA9IG5ldyBTZXQodmFsaWRTZWxlY3RlZFRvb2xzKVxuICBjb25zdCBpc0FsbFNlbGVjdGVkID1cbiAgICB2YWxpZFNlbGVjdGVkVG9vbHMubGVuZ3RoID09PSBjdXN0b21BZ2VudFRvb2xzLmxlbmd0aCAmJlxuICAgIGN1c3RvbUFnZW50VG9vbHMubGVuZ3RoID4gMFxuXG4gIGNvbnN0IGhhbmRsZVRvZ2dsZVRvb2wgPSAodG9vbE5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmICghdG9vbE5hbWUpIHJldHVyblxuXG4gICAgc2V0U2VsZWN0ZWRUb29scyhjdXJyZW50ID0+XG4gICAgICBjdXJyZW50LmluY2x1ZGVzKHRvb2xOYW1lKVxuICAgICAgICA/IGN1cnJlbnQuZmlsdGVyKHQgPT4gdCAhPT0gdG9vbE5hbWUpXG4gICAgICAgIDogWy4uLmN1cnJlbnQsIHRvb2xOYW1lXSxcbiAgICApXG4gIH1cblxuICBjb25zdCBoYW5kbGVUb2dnbGVUb29scyA9ICh0b29sTmFtZXM6IHN0cmluZ1tdLCBzZWxlY3Q6IGJvb2xlYW4pID0+IHtcbiAgICBzZXRTZWxlY3RlZFRvb2xzKGN1cnJlbnQgPT4ge1xuICAgICAgaWYgKHNlbGVjdCkge1xuICAgICAgICBjb25zdCB0b29sc1RvQWRkID0gdG9vbE5hbWVzLmZpbHRlcih0ID0+ICFjdXJyZW50LmluY2x1ZGVzKHQpKVxuICAgICAgICByZXR1cm4gWy4uLmN1cnJlbnQsIC4uLnRvb2xzVG9BZGRdXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gY3VycmVudC5maWx0ZXIodCA9PiAhdG9vbE5hbWVzLmluY2x1ZGVzKHQpKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICBjb25zdCBoYW5kbGVDb25maXJtID0gKCkgPT4ge1xuICAgIC8vIENvbnZlcnQgdG8gdW5kZWZpbmVkIGlmIGFsbCB0b29scyBhcmUgc2VsZWN0ZWQgKGZvciBjbGVhbmVyIGZpbGUgZm9ybWF0KVxuICAgIGNvbnN0IGFsbFRvb2xOYW1lcyA9IGN1c3RvbUFnZW50VG9vbHMubWFwKHQgPT4gdC5uYW1lKVxuICAgIGNvbnN0IGFyZUFsbFRvb2xzU2VsZWN0ZWQgPVxuICAgICAgdmFsaWRTZWxlY3RlZFRvb2xzLmxlbmd0aCA9PT0gYWxsVG9vbE5hbWVzLmxlbmd0aCAmJlxuICAgICAgYWxsVG9vbE5hbWVzLmV2ZXJ5KG5hbWUgPT4gdmFsaWRTZWxlY3RlZFRvb2xzLmluY2x1ZGVzKG5hbWUpKVxuICAgIGNvbnN0IGZpbmFsVG9vbHMgPSBhcmVBbGxUb29sc1NlbGVjdGVkID8gdW5kZWZpbmVkIDogdmFsaWRTZWxlY3RlZFRvb2xzXG5cbiAgICBvbkNvbXBsZXRlKGZpbmFsVG9vbHMpXG4gIH1cblxuICAvLyBHcm91cCB0b29scyBieSBidWNrZXRcbiAgY29uc3QgdG9vbHNCeUJ1Y2tldCA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHRvb2xCdWNrZXRzID0gZ2V0VG9vbEJ1Y2tldHMoKVxuICAgIGNvbnN0IGJ1Y2tldHMgPSB7XG4gICAgICByZWFkT25seTogW10gYXMgVG9vbFtdLFxuICAgICAgZWRpdDogW10gYXMgVG9vbFtdLFxuICAgICAgZXhlY3V0aW9uOiBbXSBhcyBUb29sW10sXG4gICAgICBtY3A6IFtdIGFzIFRvb2xbXSxcbiAgICAgIG90aGVyOiBbXSBhcyBUb29sW10sXG4gICAgfVxuXG4gICAgY3VzdG9tQWdlbnRUb29scy5mb3JFYWNoKHRvb2wgPT4ge1xuICAgICAgLy8gQ2hlY2sgaWYgaXQncyBhbiBNQ1AgdG9vbCBmaXJzdFxuICAgICAgaWYgKGlzTWNwVG9vbCh0b29sKSkge1xuICAgICAgICBidWNrZXRzLm1jcC5wdXNoKHRvb2wpXG4gICAgICB9IGVsc2UgaWYgKHRvb2xCdWNrZXRzLlJFQURfT05MWS50b29sTmFtZXMuaGFzKHRvb2wubmFtZSkpIHtcbiAgICAgICAgYnVja2V0cy5yZWFkT25seS5wdXNoKHRvb2wpXG4gICAgICB9IGVsc2UgaWYgKHRvb2xCdWNrZXRzLkVESVQudG9vbE5hbWVzLmhhcyh0b29sLm5hbWUpKSB7XG4gICAgICAgIGJ1Y2tldHMuZWRpdC5wdXNoKHRvb2wpXG4gICAgICB9IGVsc2UgaWYgKHRvb2xCdWNrZXRzLkVYRUNVVElPTi50b29sTmFtZXMuaGFzKHRvb2wubmFtZSkpIHtcbiAgICAgICAgYnVja2V0cy5leGVjdXRpb24ucHVzaCh0b29sKVxuICAgICAgfSBlbHNlIGlmICh0b29sLm5hbWUgIT09IEFHRU5UX1RPT0xfTkFNRSkge1xuICAgICAgICAvLyBDYXRjaC1hbGwgZm9yIHVuY2F0ZWdvcml6ZWQgdG9vbHMgKGV4Y2VwdCBUYXNrKVxuICAgICAgICBidWNrZXRzLm90aGVyLnB1c2godG9vbClcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIGJ1Y2tldHNcbiAgfSwgW2N1c3RvbUFnZW50VG9vbHNdKVxuXG4gIGNvbnN0IGNyZWF0ZUJ1Y2tldFRvZ2dsZUFjdGlvbiA9IChidWNrZXRUb29sczogVG9vbFtdKSA9PiB7XG4gICAgY29uc3Qgc2VsZWN0ZWQgPSBjb3VudChidWNrZXRUb29scywgdCA9PiBzZWxlY3RlZFNldC5oYXModC5uYW1lKSlcbiAgICBjb25zdCBuZWVkc1NlbGVjdGlvbiA9IHNlbGVjdGVkIDwgYnVja2V0VG9vbHMubGVuZ3RoXG5cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY29uc3QgdG9vbE5hbWVzID0gYnVja2V0VG9vbHMubWFwKHQgPT4gdC5uYW1lKVxuICAgICAgaGFuZGxlVG9nZ2xlVG9vbHModG9vbE5hbWVzLCBuZWVkc1NlbGVjdGlvbilcbiAgICB9XG4gIH1cblxuICAvLyBCdWlsZCBuYXZpZ2FibGUgaXRlbXMgKG5vIHNlcGFyYXRvcnMpXG4gIGNvbnN0IG5hdmlnYWJsZUl0ZW1zOiBBcnJheTx7XG4gICAgaWQ6IHN0cmluZ1xuICAgIGxhYmVsOiBzdHJpbmdcbiAgICBhY3Rpb246ICgpID0+IHZvaWRcbiAgICBpc0NvbnRpbnVlPzogYm9vbGVhblxuICAgIGlzVG9nZ2xlPzogYm9vbGVhblxuICAgIGlzSGVhZGVyPzogYm9vbGVhblxuICB9PiA9IFtdXG5cbiAgLy8gQ29udGludWUgYnV0dG9uXG4gIG5hdmlnYWJsZUl0ZW1zLnB1c2goe1xuICAgIGlkOiAnY29udGludWUnLFxuICAgIGxhYmVsOiAnQ29udGludWUnLFxuICAgIGFjdGlvbjogaGFuZGxlQ29uZmlybSxcbiAgICBpc0NvbnRpbnVlOiB0cnVlLFxuICB9KVxuXG4gIC8vIEFsbCB0b29sc1xuICBuYXZpZ2FibGVJdGVtcy5wdXNoKHtcbiAgICBpZDogJ2J1Y2tldC1hbGwnLFxuICAgIGxhYmVsOiBgJHtpc0FsbFNlbGVjdGVkID8gZmlndXJlcy5jaGVja2JveE9uIDogZmlndXJlcy5jaGVja2JveE9mZn0gQWxsIHRvb2xzYCxcbiAgICBhY3Rpb246ICgpID0+IHtcbiAgICAgIGNvbnN0IGFsbFRvb2xOYW1lcyA9IGN1c3RvbUFnZW50VG9vbHMubWFwKHQgPT4gdC5uYW1lKVxuICAgICAgaGFuZGxlVG9nZ2xlVG9vbHMoYWxsVG9vbE5hbWVzLCAhaXNBbGxTZWxlY3RlZClcbiAgICB9LFxuICB9KVxuXG4gIC8vIENyZWF0ZSBidWNrZXQgbWVudSBpdGVtc1xuICBjb25zdCB0b29sQnVja2V0cyA9IGdldFRvb2xCdWNrZXRzKClcbiAgY29uc3QgYnVja2V0Q29uZmlncyA9IFtcbiAgICB7XG4gICAgICBpZDogJ2J1Y2tldC1yZWFkb25seScsXG4gICAgICBuYW1lOiB0b29sQnVja2V0cy5SRUFEX09OTFkubmFtZSxcbiAgICAgIHRvb2xzOiB0b29sc0J5QnVja2V0LnJlYWRPbmx5LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdidWNrZXQtZWRpdCcsXG4gICAgICBuYW1lOiB0b29sQnVja2V0cy5FRElULm5hbWUsXG4gICAgICB0b29sczogdG9vbHNCeUJ1Y2tldC5lZGl0LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdidWNrZXQtZXhlY3V0aW9uJyxcbiAgICAgIG5hbWU6IHRvb2xCdWNrZXRzLkVYRUNVVElPTi5uYW1lLFxuICAgICAgdG9vbHM6IHRvb2xzQnlCdWNrZXQuZXhlY3V0aW9uLFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdidWNrZXQtbWNwJyxcbiAgICAgIG5hbWU6IHRvb2xCdWNrZXRzLk1DUC5uYW1lLFxuICAgICAgdG9vbHM6IHRvb2xzQnlCdWNrZXQubWNwLFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdidWNrZXQtb3RoZXInLFxuICAgICAgbmFtZTogdG9vbEJ1Y2tldHMuT1RIRVIubmFtZSxcbiAgICAgIHRvb2xzOiB0b29sc0J5QnVja2V0Lm90aGVyLFxuICAgIH0sXG4gIF1cblxuICBidWNrZXRDb25maWdzLmZvckVhY2goKHsgaWQsIG5hbWUsIHRvb2xzOiBidWNrZXRUb29scyB9KSA9PiB7XG4gICAgaWYgKGJ1Y2tldFRvb2xzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgICBjb25zdCBzZWxlY3RlZCA9IGNvdW50KGJ1Y2tldFRvb2xzLCB0ID0+IHNlbGVjdGVkU2V0Lmhhcyh0Lm5hbWUpKVxuICAgIGNvbnN0IGlzRnVsbHlTZWxlY3RlZCA9IHNlbGVjdGVkID09PSBidWNrZXRUb29scy5sZW5ndGhcblxuICAgIG5hdmlnYWJsZUl0ZW1zLnB1c2goe1xuICAgICAgaWQsXG4gICAgICBsYWJlbDogYCR7aXNGdWxseVNlbGVjdGVkID8gZmlndXJlcy5jaGVja2JveE9uIDogZmlndXJlcy5jaGVja2JveE9mZn0gJHtuYW1lfWAsXG4gICAgICBhY3Rpb246IGNyZWF0ZUJ1Y2tldFRvZ2dsZUFjdGlvbihidWNrZXRUb29scyksXG4gICAgfSlcbiAgfSlcblxuICAvLyBUb2dnbGUgYnV0dG9uIGZvciBpbmRpdmlkdWFsIHRvb2xzXG4gIGNvbnN0IHRvZ2dsZUJ1dHRvbkluZGV4ID0gbmF2aWdhYmxlSXRlbXMubGVuZ3RoXG4gIG5hdmlnYWJsZUl0ZW1zLnB1c2goe1xuICAgIGlkOiAndG9nZ2xlLWluZGl2aWR1YWwnLFxuICAgIGxhYmVsOiBzaG93SW5kaXZpZHVhbFRvb2xzXG4gICAgICA/ICdIaWRlIGFkdmFuY2VkIG9wdGlvbnMnXG4gICAgICA6ICdTaG93IGFkdmFuY2VkIG9wdGlvbnMnLFxuICAgIGFjdGlvbjogKCkgPT4ge1xuICAgICAgc2V0U2hvd0luZGl2aWR1YWxUb29scyghc2hvd0luZGl2aWR1YWxUb29scylcbiAgICAgIC8vIElmIGhpZGluZyB0b29scyBhbmQgZm9jdXMgaXMgb24gYW4gaW5kaXZpZHVhbCB0b29sLCBtb3ZlIGZvY3VzIHRvIHRvZ2dsZSBidXR0b25cbiAgICAgIGlmIChzaG93SW5kaXZpZHVhbFRvb2xzICYmIGZvY3VzSW5kZXggPiB0b2dnbGVCdXR0b25JbmRleCkge1xuICAgICAgICBzZXRGb2N1c0luZGV4KHRvZ2dsZUJ1dHRvbkluZGV4KVxuICAgICAgfVxuICAgIH0sXG4gICAgaXNUb2dnbGU6IHRydWUsXG4gIH0pXG5cbiAgLy8gTWVtb2l6ZSBNQ1Agc2VydmVyIGJ1Y2tldHMgKG11c3QgYmUgb3V0c2lkZSBjb25kaXRpb25hbCBmb3IgaG9va3MgcnVsZXMpXG4gIGNvbnN0IG1jcFNlcnZlckJ1Y2tldHMgPSB1c2VNZW1vKFxuICAgICgpID0+IGdldE1jcFNlcnZlckJ1Y2tldHMoY3VzdG9tQWdlbnRUb29scyksXG4gICAgW2N1c3RvbUFnZW50VG9vbHNdLFxuICApXG5cbiAgLy8gSW5kaXZpZHVhbCB0b29scyAob25seSBpZiBleHBhbmRlZClcbiAgaWYgKHNob3dJbmRpdmlkdWFsVG9vbHMpIHtcbiAgICAvLyBBZGQgTUNQIHNlcnZlciBidWNrZXRzIGlmIGFueSBleGlzdFxuICAgIGlmIChtY3BTZXJ2ZXJCdWNrZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgIG5hdmlnYWJsZUl0ZW1zLnB1c2goe1xuICAgICAgICBpZDogJ21jcC1zZXJ2ZXJzLWhlYWRlcicsXG4gICAgICAgIGxhYmVsOiAnTUNQIFNlcnZlcnM6JyxcbiAgICAgICAgYWN0aW9uOiAoKSA9PiB7fSwgLy8gTm8gYWN0aW9uIC0ganVzdCBhIGhlYWRlclxuICAgICAgICBpc0hlYWRlcjogdHJ1ZSxcbiAgICAgIH0pXG5cbiAgICAgIG1jcFNlcnZlckJ1Y2tldHMuZm9yRWFjaCgoeyBzZXJ2ZXJOYW1lLCB0b29sczogc2VydmVyVG9vbHMgfSkgPT4ge1xuICAgICAgICBjb25zdCBzZWxlY3RlZCA9IGNvdW50KHNlcnZlclRvb2xzLCB0ID0+IHNlbGVjdGVkU2V0Lmhhcyh0Lm5hbWUpKVxuICAgICAgICBjb25zdCBpc0Z1bGx5U2VsZWN0ZWQgPSBzZWxlY3RlZCA9PT0gc2VydmVyVG9vbHMubGVuZ3RoXG5cbiAgICAgICAgbmF2aWdhYmxlSXRlbXMucHVzaCh7XG4gICAgICAgICAgaWQ6IGBtY3Atc2VydmVyLSR7c2VydmVyTmFtZX1gLFxuICAgICAgICAgIGxhYmVsOiBgJHtpc0Z1bGx5U2VsZWN0ZWQgPyBmaWd1cmVzLmNoZWNrYm94T24gOiBmaWd1cmVzLmNoZWNrYm94T2ZmfSAke3NlcnZlck5hbWV9ICgke3NlcnZlclRvb2xzLmxlbmd0aH0gJHtwbHVyYWwoc2VydmVyVG9vbHMubGVuZ3RoLCAndG9vbCcpfSlgLFxuICAgICAgICAgIGFjdGlvbjogKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdG9vbE5hbWVzID0gc2VydmVyVG9vbHMubWFwKHQgPT4gdC5uYW1lKVxuICAgICAgICAgICAgaGFuZGxlVG9nZ2xlVG9vbHModG9vbE5hbWVzLCAhaXNGdWxseVNlbGVjdGVkKVxuICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICB9KVxuXG4gICAgICAvLyBBZGQgc2VwYXJhdG9yIGhlYWRlciBiZWZvcmUgaW5kaXZpZHVhbCB0b29sc1xuICAgICAgbmF2aWdhYmxlSXRlbXMucHVzaCh7XG4gICAgICAgIGlkOiAndG9vbHMtaGVhZGVyJyxcbiAgICAgICAgbGFiZWw6ICdJbmRpdmlkdWFsIFRvb2xzOicsXG4gICAgICAgIGFjdGlvbjogKCkgPT4ge30sXG4gICAgICAgIGlzSGVhZGVyOiB0cnVlLFxuICAgICAgfSlcbiAgICB9XG5cbiAgICAvLyBBZGQgaW5kaXZpZHVhbCB0b29sc1xuICAgIGN1c3RvbUFnZW50VG9vbHMuZm9yRWFjaCh0b29sID0+IHtcbiAgICAgIGxldCBkaXNwbGF5TmFtZSA9IHRvb2wubmFtZVxuICAgICAgaWYgKHRvb2wubmFtZS5zdGFydHNXaXRoKCdtY3BfXycpKSB7XG4gICAgICAgIGNvbnN0IG1jcEluZm8gPSBtY3BJbmZvRnJvbVN0cmluZyh0b29sLm5hbWUpXG4gICAgICAgIGRpc3BsYXlOYW1lID0gbWNwSW5mb1xuICAgICAgICAgID8gYCR7bWNwSW5mby50b29sTmFtZX0gKCR7bWNwSW5mby5zZXJ2ZXJOYW1lfSlgXG4gICAgICAgICAgOiB0b29sLm5hbWVcbiAgICAgIH1cblxuICAgICAgbmF2aWdhYmxlSXRlbXMucHVzaCh7XG4gICAgICAgIGlkOiBgdG9vbC0ke3Rvb2wubmFtZX1gLFxuICAgICAgICBsYWJlbDogYCR7c2VsZWN0ZWRTZXQuaGFzKHRvb2wubmFtZSkgPyBmaWd1cmVzLmNoZWNrYm94T24gOiBmaWd1cmVzLmNoZWNrYm94T2ZmfSAke2Rpc3BsYXlOYW1lfWAsXG4gICAgICAgIGFjdGlvbjogKCkgPT4gaGFuZGxlVG9nZ2xlVG9vbCh0b29sLm5hbWUpLFxuICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgY29uc3QgaGFuZGxlQ2FuY2VsID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmIChvbkNhbmNlbCkge1xuICAgICAgb25DYW5jZWwoKVxuICAgIH0gZWxzZSB7XG4gICAgICBvbkNvbXBsZXRlKGluaXRpYWxUb29scylcbiAgICB9XG4gIH0sIFtvbkNhbmNlbCwgb25Db21wbGV0ZSwgaW5pdGlhbFRvb2xzXSlcblxuICB1c2VLZXliaW5kaW5nKCdjb25maXJtOm5vJywgaGFuZGxlQ2FuY2VsLCB7IGNvbnRleHQ6ICdDb25maXJtYXRpb24nIH0pXG5cbiAgY29uc3QgaGFuZGxlS2V5RG93biA9IChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgaWYgKGUua2V5ID09PSAncmV0dXJuJykge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBjb25zdCBpdGVtID0gbmF2aWdhYmxlSXRlbXNbZm9jdXNJbmRleF1cbiAgICAgIGlmIChpdGVtICYmICFpdGVtLmlzSGVhZGVyKSB7XG4gICAgICAgIGl0ZW0uYWN0aW9uKClcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGUua2V5ID09PSAndXAnKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGxldCBuZXdJbmRleCA9IGZvY3VzSW5kZXggLSAxXG4gICAgICAvLyBTa2lwIGhlYWRlcnMgd2hlbiBuYXZpZ2F0aW5nIHVwXG4gICAgICB3aGlsZSAobmV3SW5kZXggPiAwICYmIG5hdmlnYWJsZUl0ZW1zW25ld0luZGV4XT8uaXNIZWFkZXIpIHtcbiAgICAgICAgbmV3SW5kZXgtLVxuICAgICAgfVxuICAgICAgc2V0Rm9jdXNJbmRleChNYXRoLm1heCgwLCBuZXdJbmRleCkpXG4gICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ2Rvd24nKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGxldCBuZXdJbmRleCA9IGZvY3VzSW5kZXggKyAxXG4gICAgICAvLyBTa2lwIGhlYWRlcnMgd2hlbiBuYXZpZ2F0aW5nIGRvd25cbiAgICAgIHdoaWxlIChcbiAgICAgICAgbmV3SW5kZXggPCBuYXZpZ2FibGVJdGVtcy5sZW5ndGggLSAxICYmXG4gICAgICAgIG5hdmlnYWJsZUl0ZW1zW25ld0luZGV4XT8uaXNIZWFkZXJcbiAgICAgICkge1xuICAgICAgICBuZXdJbmRleCsrXG4gICAgICB9XG4gICAgICBzZXRGb2N1c0luZGV4KE1hdGgubWluKG5hdmlnYWJsZUl0ZW1zLmxlbmd0aCAtIDEsIG5ld0luZGV4KSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxCb3hcbiAgICAgIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIlxuICAgICAgbWFyZ2luVG9wPXsxfVxuICAgICAgdGFiSW5kZXg9ezB9XG4gICAgICBhdXRvRm9jdXNcbiAgICAgIG9uS2V5RG93bj17aGFuZGxlS2V5RG93bn1cbiAgICA+XG4gICAgICB7LyogUmVuZGVyIENvbnRpbnVlIGJ1dHRvbiAqL31cbiAgICAgIDxUZXh0XG4gICAgICAgIGNvbG9yPXtmb2N1c0luZGV4ID09PSAwID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfVxuICAgICAgICBib2xkPXtmb2N1c0luZGV4ID09PSAwfVxuICAgICAgPlxuICAgICAgICB7Zm9jdXNJbmRleCA9PT0gMCA/IGAke2ZpZ3VyZXMucG9pbnRlcn0gYCA6ICcgICd9WyBDb250aW51ZSBdXG4gICAgICA8L1RleHQ+XG5cbiAgICAgIHsvKiBTZXBhcmF0b3IgKi99XG4gICAgICA8RGl2aWRlciB3aWR0aD17NDB9IC8+XG5cbiAgICAgIHsvKiBSZW5kZXIgYWxsIG5hdmlnYWJsZSBpdGVtcyBleGNlcHQgQ29udGludWUgKHdoaWNoIGlzIGF0IGluZGV4IDApICovfVxuICAgICAge25hdmlnYWJsZUl0ZW1zLnNsaWNlKDEpLm1hcCgoaXRlbSwgaW5kZXgpID0+IHtcbiAgICAgICAgY29uc3QgaXNDdXJyZW50bHlGb2N1c2VkID0gaW5kZXggKyAxID09PSBmb2N1c0luZGV4XG4gICAgICAgIGNvbnN0IGlzVG9nZ2xlQnV0dG9uID0gaXRlbS5pc1RvZ2dsZVxuICAgICAgICBjb25zdCBpc0hlYWRlciA9IGl0ZW0uaXNIZWFkZXJcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxSZWFjdC5GcmFnbWVudCBrZXk9e2l0ZW0uaWR9PlxuICAgICAgICAgICAgey8qIEFkZCBzZXBhcmF0b3IgYmVmb3JlIHRvZ2dsZSBidXR0b24gKi99XG4gICAgICAgICAgICB7aXNUb2dnbGVCdXR0b24gJiYgPERpdmlkZXIgd2lkdGg9ezQwfSAvPn1cblxuICAgICAgICAgICAgey8qIEFkZCBtYXJnaW4gYmVmb3JlIGhlYWRlcnMgKi99XG4gICAgICAgICAgICB7aXNIZWFkZXIgJiYgaW5kZXggPiAwICYmIDxCb3ggbWFyZ2luVG9wPXsxfSAvPn1cblxuICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgY29sb3I9e1xuICAgICAgICAgICAgICAgIGlzSGVhZGVyXG4gICAgICAgICAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgOiBpc0N1cnJlbnRseUZvY3VzZWRcbiAgICAgICAgICAgICAgICAgICAgPyAnc3VnZ2VzdGlvbidcbiAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkaW1Db2xvcj17aXNIZWFkZXJ9XG4gICAgICAgICAgICAgIGJvbGQ9e2lzVG9nZ2xlQnV0dG9uICYmIGlzQ3VycmVudGx5Rm9jdXNlZH1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge2lzSGVhZGVyXG4gICAgICAgICAgICAgICAgPyAnJ1xuICAgICAgICAgICAgICAgIDogaXNDdXJyZW50bHlGb2N1c2VkXG4gICAgICAgICAgICAgICAgICA/IGAke2ZpZ3VyZXMucG9pbnRlcn0gYFxuICAgICAgICAgICAgICAgICAgOiAnICAnfVxuICAgICAgICAgICAgICB7aXNUb2dnbGVCdXR0b24gPyBgWyAke2l0ZW0ubGFiZWx9IF1gIDogaXRlbS5sYWJlbH1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L1JlYWN0LkZyYWdtZW50PlxuICAgICAgICApXG4gICAgICB9KX1cblxuICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAge2lzQWxsU2VsZWN0ZWRcbiAgICAgICAgICAgID8gJ0FsbCB0b29scyBzZWxlY3RlZCdcbiAgICAgICAgICAgIDogYCR7c2VsZWN0ZWRTZXQuc2l6ZX0gb2YgJHtjdXN0b21BZ2VudFRvb2xzLmxlbmd0aH0gdG9vbHMgc2VsZWN0ZWRgfVxuICAgICAgICA8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICA8L0JveD5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBT0EsT0FBTyxNQUFNLFNBQVM7QUFDN0IsT0FBT0MsS0FBSyxJQUFJQyxXQUFXLEVBQUVDLE9BQU8sRUFBRUMsUUFBUSxRQUFRLE9BQU87QUFDN0QsU0FBU0MsaUJBQWlCLFFBQVEsb0NBQW9DO0FBQ3RFLFNBQVNDLFNBQVMsUUFBUSwyQkFBMkI7QUFDckQsY0FBY0MsSUFBSSxFQUFFQyxLQUFLLFFBQVEsYUFBYTtBQUM5QyxTQUFTQyxtQkFBbUIsUUFBUSx1Q0FBdUM7QUFDM0UsU0FBU0MsZUFBZSxRQUFRLGtDQUFrQztBQUNsRSxTQUFTQyxRQUFRLFFBQVEsZ0NBQWdDO0FBQ3pELFNBQVNDLGtCQUFrQixRQUFRLGtEQUFrRDtBQUNyRixTQUFTQyxZQUFZLFFBQVEsd0NBQXdDO0FBQ3JFLFNBQVNDLFlBQVksUUFBUSx3Q0FBd0M7QUFDckUsU0FBU0MsYUFBYSxRQUFRLDBDQUEwQztBQUN4RSxTQUFTQyxRQUFRLFFBQVEsZ0NBQWdDO0FBQ3pELFNBQVNDLFFBQVEsUUFBUSxnQ0FBZ0M7QUFDekQsU0FBU0Msb0JBQW9CLFFBQVEsd0RBQXdEO0FBQzdG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