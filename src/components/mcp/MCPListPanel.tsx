import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import React, { useCallback, useState } from 'react';
import type { CommandResultDisplay } from '../../commands.js';
import { Box, color, Link, Text, useTheme } from '../../ink.js';
import { useKeybindings } from '../../keybindings/useKeybinding.js';
import type { ConfigScope } from '../../services/mcp/types.js';
import { describeMcpConfigFilePath } from '../../services/mcp/utils.js';
import { isDebugMode } from '../../utils/debug.js';
import { plural } from '../../utils/stringUtils.js';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js';
import { Byline } from '../design-system/Byline.js';
import { Dialog } from '../design-system/Dialog.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import { McpParsingWarnings } from './McpParsingWarnings.js';
import type { AgentMcpServerInfo, ServerInfo } from './types.js';
type Props = {
  servers: ServerInfo[];
  agentServers?: AgentMcpServerInfo[];
  onSelectServer: (server: ServerInfo) => void;
  onSelectAgentServer?: (agentServer: AgentMcpServerInfo) => void;
  onComplete: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
  defaultTab?: string;
};
type SelectableItem = {
  type: 'server';
  server: ServerInfo;
} | {
  type: 'agent-server';
  agentServer: AgentMcpServerInfo;
};

// Define scope order for display (constant, outside component)
// 'dynamic' (built-in) is rendered separately at the end
const SCOPE_ORDER: ConfigScope[] = ['project', 'local', 'user', 'enterprise'];

// Get scope heading parts (label is bold, path is grey)
function getScopeHeading(scope: ConfigScope): {
  label: string;
  path?: string;
} {
  switch (scope) {
    case 'project':
      return {
        label: 'Project MCPs',
        path: describeMcpConfigFilePath(scope)
      };
    case 'user':
      return {
        label: 'User MCPs',
        path: describeMcpConfigFilePath(scope)
      };
    case 'local':
      return {
        label: 'Local MCPs',
        path: describeMcpConfigFilePath(scope)
      };
    case 'enterprise':
      return {
        label: 'Enterprise MCPs'
      };
    case 'dynamic':
      return {
        label: 'Built-in MCPs',
        path: 'always available'
      };
    default:
      return {
        label: scope
      };
  }
}

// Group servers by scope
function groupServersByScope(serverList: ServerInfo[]): Map<ConfigScope, ServerInfo[]> {
  const groups = new Map<ConfigScope, ServerInfo[]>();
  for (const server of serverList) {
    const scope = server.scope;
    if (!groups.has(scope)) {
      groups.set(scope, []);
    }
    groups.get(scope)!.push(server);
  }
  // Sort servers within each group alphabetically
  for (const [, groupServers] of groups) {
    groupServers.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}
export function MCPListPanel(t0) {
  const $ = _c(78);
  const {
    servers,
    agentServers: t1,
    onSelectServer,
    onSelectAgentServer,
    onComplete
  } = t0;
  let t2;
  if ($[0] !== t1) {
    t2 = t1 === undefined ? [] : t1;
    $[0] = t1;
    $[1] = t2;
  } else {
    t2 = $[1];
  }
  const agentServers = t2;
  const [theme] = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  let t3;
  if ($[2] !== servers) {
    const regularServers = servers.filter(_temp);
    t3 = groupServersByScope(regularServers);
    $[2] = servers;
    $[3] = t3;
  } else {
    t3 = $[3];
  }
  const serversByScope = t3;
  let t4;
  if ($[4] !== servers) {
    t4 = servers.filter(_temp2).sort(_temp3);
    $[4] = servers;
    $[5] = t4;
  } else {
    t4 = $[5];
  }
  const claudeAiServers = t4;
  let t5;
  if ($[6] !== serversByScope) {
    t5 = (serversByScope.get("dynamic") ?? []).sort(_temp4);
    $[6] = serversByScope;
    $[7] = t5;
  } else {
    t5 = $[7];
  }
  const dynamicServers = t5;
  let t6;
  if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
    t6 = getScopeHeading("dynamic");
    $[8] = t6;
  } else {
    t6 = $[8];
  }
  const dynamicHeading = t6;
  let items;
  if ($[9] !== agentServers || $[10] !== claudeAiServers || $[11] !== dynamicServers || $[12] !== serversByScope) {
    items = [];
    for (const scope of SCOPE_ORDER) {
      const scopeServers = serversByScope.get(scope) ?? [];
      for (const server of scopeServers) {
        items.push({
          type: "server",
          server
        });
      }
    }
    for (const server_0 of claudeAiServers) {
      items.push({
        type: "server",
        server: server_0
      });
    }
    for (const agentServer of agentServers) {
      items.push({
        type: "agent-server",
        agentServer
      });
    }
    for (const server_1 of dynamicServers) {
      items.push({
        type: "server",
        server: server_1
      });
    }
    $[9] = agentServers;
    $[10] = claudeAiServers;
    $[11] = dynamicServers;
    $[12] = serversByScope;
    $[13] = items;
  } else {
    items = $[13];
  }
  const selectableItems = items;
  let t7;
  if ($[14] !== onComplete) {
    t7 = () => {
      onComplete("MCP dialog dismissed", {
        display: "system"
      });
    };
    $[14] = onComplete;
    $[15] = t7;
  } else {
    t7 = $[15];
  }
  const handleCancel = t7;
  let t8;
  if ($[16] !== onSelectAgentServer || $[17] !== onSelectServer || $[18] !== selectableItems || $[19] !== selectedIndex) {
    t8 = () => {
      const item = selectableItems[selectedIndex];
      if (!item) {
        return;
      }
      if (item.type === "server") {
        onSelectServer(item.server);
      } else {
        if (item.type === "agent-server" && onSelectAgentServer) {
          onSelectAgentServer(item.agentServer);
        }
      }
    };
    $[16] = onSelectAgentServer;
    $[17] = onSelectServer;
    $[18] = selectableItems;
    $[19] = selectedIndex;
    $[20] = t8;
  } else {
    t8 = $[20];
  }
  const handleSelect = t8;
  let t10;
  let t9;
  if ($[21] !== selectableItems) {
    t9 = () => setSelectedIndex(prev => prev === 0 ? selectableItems.length - 1 : prev - 1);
    t10 = () => setSelectedIndex(prev_0 => prev_0 === selectableItems.length - 1 ? 0 : prev_0 + 1);
    $[21] = selectableItems;
    $[22] = t10;
    $[23] = t9;
  } else {
    t10 = $[22];
    t9 = $[23];
  }
  let t11;
  if ($[24] !== handleCancel || $[25] !== handleSelect || $[26] !== t10 || $[27] !== t9) {
    t11 = {
      "confirm:previous": t9,
      "confirm:next": t10,
      "confirm:yes": handleSelect,
      "confirm:no": handleCancel
    };
    $[24] = handleCancel;
    $[25] = handleSelect;
    $[26] = t10;
    $[27] = t9;
    $[28] = t11;
  } else {
    t11 = $[28];
  }
  let t12;
  if ($[29] === Symbol.for("react.memo_cache_sentinel")) {
    t12 = {
      context: "Confirmation"
    };
    $[29] = t12;
  } else {
    t12 = $[29];
  }
  useKeybindings(t11, t12);
  let t13;
  if ($[30] !== selectableItems) {
    t13 = server_2 => selectableItems.findIndex(item_0 => item_0.type === "server" && item_0.server === server_2);
    $[30] = selectableItems;
    $[31] = t13;
  } else {
    t13 = $[31];
  }
  const getServerIndex = t13;
  let t14;
  if ($[32] !== selectableItems) {
    t14 = agentServer_0 => selectableItems.findIndex(item_1 => item_1.type === "agent-server" && item_1.agentServer === agentServer_0);
    $[32] = selectableItems;
    $[33] = t14;
  } else {
    t14 = $[33];
  }
  const getAgentServerIndex = t14;
  let t15;
  if ($[34] === Symbol.for("react.memo_cache_sentinel")) {
    t15 = isDebugMode();
    $[34] = t15;
  } else {
    t15 = $[34];
  }
  const debugMode = t15;
  let t16;
  if ($[35] !== servers) {
    t16 = servers.some(_temp5);
    $[35] = servers;
    $[36] = t16;
  } else {
    t16 = $[36];
  }
  const hasFailedClients = t16;
  if (servers.length === 0 && agentServers.length === 0) {
    return null;
  }
  let t17;
  if ($[37] !== getServerIndex || $[38] !== selectedIndex || $[39] !== theme) {
    t17 = server_3 => {
      const index = getServerIndex(server_3);
      const isSelected = selectedIndex === index;
      let statusIcon;
      let statusText;
      if (server_3.client.type === "disabled") {
        statusIcon = color("inactive", theme)(figures.radioOff);
        statusText = "disabled";
      } else {
        if (server_3.client.type === "connected") {
          statusIcon = color("success", theme)(figures.tick);
          statusText = "connected";
        } else {
          if (server_3.client.type === "pending") {
            statusIcon = color("inactive", theme)(figures.radioOff);
            const {
              reconnectAttempt,
              maxReconnectAttempts
            } = server_3.client;
            if (reconnectAttempt && maxReconnectAttempts) {
              statusText = `reconnecting (${reconnectAttempt}/${maxReconnectAttempts})…`;
            } else {
              statusText = "connecting\u2026";
            }
          } else {
            if (server_3.client.type === "needs-auth") {
              statusIcon = color("warning", theme)(figures.triangleUpOutline);
              statusText = "needs authentication";
            } else {
              statusIcon = color("error", theme)(figures.cross);
              statusText = "failed";
            }
          }
        }
      }
      return <Box key={`${server_3.name}-${index}`}><Text color={isSelected ? "suggestion" : undefined}>{isSelected ? `${figures.pointer} ` : "  "}</Text><Text color={isSelected ? "suggestion" : undefined}>{server_3.name}</Text><Text dimColor={!isSelected}> · {statusIcon} </Text><Text dimColor={!isSelected}>{statusText}</Text></Box>;
    };
    $[37] = getServerIndex;
    $[38] = selectedIndex;
    $[39] = theme;
    $[40] = t17;
  } else {
    t17 = $[40];
  }
  const renderServerItem = t17;
  let t18;
  if ($[41] !== getAgentServerIndex || $[42] !== selectedIndex || $[43] !== theme) {
    t18 = agentServer_1 => {
      const index_0 = getAgentServerIndex(agentServer_1);
      const isSelected_0 = selectedIndex === index_0;
      const statusIcon_0 = agentServer_1.needsAuth ? color("warning", theme)(figures.triangleUpOutline) : color("inactive", theme)(figures.radioOff);
      const statusText_0 = agentServer_1.needsAuth ? "may need auth" : "agent-only";
      return <Box key={`agent-${agentServer_1.name}-${index_0}`}><Text color={isSelected_0 ? "suggestion" : undefined}>{isSelected_0 ? `${figures.pointer} ` : "  "}</Text><Text color={isSelected_0 ? "suggestion" : undefined}>{agentServer_1.name}</Text><Text dimColor={!isSelected_0}> · {statusIcon_0} </Text><Text dimColor={!isSelected_0}>{statusText_0}</Text></Box>;
    };
    $[41] = getAgentServerIndex;
    $[42] = selectedIndex;
    $[43] = theme;
    $[44] = t18;
  } else {
    t18 = $[44];
  }
  const renderAgentServerItem = t18;
  const totalServers = servers.length + agentServers.length;
  let t19;
  if ($[45] === Symbol.for("react.memo_cache_sentinel")) {
    t19 = <McpParsingWarnings />;
    $[45] = t19;
  } else {
    t19 = $[45];
  }
  let t20;
  if ($[46] !== totalServers) {
    t20 = plural(totalServers, "server");
    $[46] = totalServers;
    $[47] = t20;
  } else {
    t20 = $[47];
  }
  const t21 = `${totalServers} ${t20}`;
  let t22;
  if ($[48] !== renderServerItem || $[49] !== serversByScope) {
    t22 = SCOPE_ORDER.map(scope_0 => {
      const scopeServers_0 = serversByScope.get(scope_0);
      if (!scopeServers_0 || scopeServers_0.length === 0) {
        return null;
      }
      const heading = getScopeHeading(scope_0);
      return <Box key={scope_0} flexDirection="column" marginBottom={1}><Box paddingLeft={2}><Text bold={true}>{heading.label}</Text>{heading.path && <Text dimColor={true}> ({heading.path})</Text>}</Box>{scopeServers_0.map(server_4 => renderServerItem(server_4))}</Box>;
    });
    $[48] = renderServerItem;
    $[49] = serversByScope;
    $[50] = t22;
  } else {
    t22 = $[50];
  }
  let t23;
  if ($[51] !== claudeAiServers || $[52] !== renderServerItem) {
    t23 = claudeAiServers.length > 0 && <Box flexDirection="column" marginBottom={1}><Box paddingLeft={2}><Text bold={true}>claude.ai</Text></Box>{claudeAiServers.map(server_5 => renderServerItem(server_5))}</Box>;
    $[51] = claudeAiServers;
    $[52] = renderServerItem;
    $[53] = t23;
  } else {
    t23 = $[53];
  }
  let t24;
  if ($[54] !== agentServers || $[55] !== renderAgentServerItem) {
    t24 = agentServers.length > 0 && <Box flexDirection="column" marginBottom={1}><Box paddingLeft={2}><Text bold={true}>Agent MCPs</Text></Box>{[...new Set(agentServers.flatMap(_temp6))].map(agentName => <Box key={agentName} flexDirection="column" marginTop={1}><Box paddingLeft={2}><Text dimColor={true}>@{agentName}</Text></Box>{agentServers.filter(s_3 => s_3.sourceAgents.includes(agentName)).map(agentServer_2 => renderAgentServerItem(agentServer_2))}</Box>)}</Box>;
    $[54] = agentServers;
    $[55] = renderAgentServerItem;
    $[56] = t24;
  } else {
    t24 = $[56];
  }
  let t25;
  if ($[57] !== dynamicServers || $[58] !== renderServerItem) {
    t25 = dynamicServers.length > 0 && <Box flexDirection="column" marginBottom={1}><Box paddingLeft={2}><Text bold={true}>{dynamicHeading.label}</Text>{dynamicHeading.path && <Text dimColor={true}> ({dynamicHeading.path})</Text>}</Box>{dynamicServers.map(server_6 => renderServerItem(server_6))}</Box>;
    $[57] = dynamicServers;
    $[58] = renderServerItem;
    $[59] = t25;
  } else {
    t25 = $[59];
  }
  let t26;
  if ($[60] !== hasFailedClients) {
    t26 = hasFailedClients && <Text dimColor={true}>{debugMode ? "\u203B Error logs shown inline with --debug" : "\u203B Run claude --debug to see error logs"}</Text>;
    $[60] = hasFailedClients;
    $[61] = t26;
  } else {
    t26 = $[61];
  }
  let t27;
  if ($[62] === Symbol.for("react.memo_cache_sentinel")) {
    t27 = <Text dimColor={true}><Link url="https://code.claude.com/docs/en/mcp">https://code.claude.com/docs/en/mcp</Link>{" "}for help</Text>;
    $[62] = t27;
  } else {
    t27 = $[62];
  }
  let t28;
  if ($[63] !== t26) {
    t28 = <Box flexDirection="column">{t26}{t27}</Box>;
    $[63] = t26;
    $[64] = t28;
  } else {
    t28 = $[64];
  }
  let t29;
  if ($[65] !== t22 || $[66] !== t23 || $[67] !== t24 || $[68] !== t25 || $[69] !== t28) {
    t29 = <Box flexDirection="column">{t22}{t23}{t24}{t25}{t28}</Box>;
    $[65] = t22;
    $[66] = t23;
    $[67] = t24;
    $[68] = t25;
    $[69] = t28;
    $[70] = t29;
  } else {
    t29 = $[70];
  }
  let t30;
  if ($[71] !== handleCancel || $[72] !== t21 || $[73] !== t29) {
    t30 = <Dialog title="Manage MCP servers" subtitle={t21} onCancel={handleCancel} hideInputGuide={true}>{t29}</Dialog>;
    $[71] = handleCancel;
    $[72] = t21;
    $[73] = t29;
    $[74] = t30;
  } else {
    t30 = $[74];
  }
  let t31;
  if ($[75] === Symbol.for("react.memo_cache_sentinel")) {
    t31 = <Box paddingX={1}><Text dimColor={true} italic={true}><Byline><KeyboardShortcutHint shortcut={"\u2191\u2193"} action="navigate" /><KeyboardShortcutHint shortcut="Enter" action="confirm" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text></Box>;
    $[75] = t31;
  } else {
    t31 = $[75];
  }
  let t32;
  if ($[76] !== t30) {
    t32 = <Box flexDirection="column">{t19}{t30}{t31}</Box>;
    $[76] = t30;
    $[77] = t32;
  } else {
    t32 = $[77];
  }
  return t32;
}
function _temp6(s_2) {
  return s_2.sourceAgents;
}
function _temp5(s_1) {
  return s_1.client.type === "failed";
}
function _temp4(a_0, b_0) {
  return a_0.name.localeCompare(b_0.name);
}
function _temp3(a, b) {
  return a.name.localeCompare(b.name);
}
function _temp2(s_0) {
  return s_0.client.config.type === "claudeai-proxy";
}
function _temp(s) {
  return s.client.config.type !== "claudeai-proxy";
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZVN0YXRlIiwiQ29tbWFuZFJlc3VsdERpc3BsYXkiLCJCb3giLCJjb2xvciIsIkxpbmsiLCJUZXh0IiwidXNlVGhlbWUiLCJ1c2VLZXliaW5kaW5ncyIsIkNvbmZpZ1Njb3BlIiwiZGVzY3JpYmVNY3BDb25maWdGaWxlUGF0aCIsImlzRGVidWdNb2RlIiwicGx1cmFsIiwiQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IiwiQnlsaW5lIiwiRGlhbG9nIiwiS2V5Ym9hcmRTaG9ydGN1dEhpbnQiLCJNY3BQYXJzaW5nV2FybmluZ3MiLCJBZ2VudE1jcFNlcnZlckluZm8iLCJTZXJ2ZXJJbmZvIiwiUHJvcHMiLCJzZXJ2ZXJzIiwiYWdlbnRTZXJ2ZXJzIiwib25TZWxlY3RTZXJ2ZXIiLCJzZXJ2ZXIiLCJvblNlbGVjdEFnZW50U2VydmVyIiwiYWdlbnRTZXJ2ZXIiLCJvbkNvbXBsZXRlIiwicmVzdWx0Iiwib3B0aW9ucyIsImRpc3BsYXkiLCJkZWZhdWx0VGFiIiwiU2VsZWN0YWJsZUl0ZW0iLCJ0eXBlIiwiU0NPUEVfT1JERVIiLCJnZXRTY29wZUhlYWRpbmciLCJzY29wZSIsImxhYmVsIiwicGF0aCIsImdyb3VwU2VydmVyc0J5U2NvcGUiLCJzZXJ2ZXJMaXN0IiwiTWFwIiwiZ3JvdXBzIiwiaGFzIiwic2V0IiwiZ2V0IiwicHVzaCIsImdyb3VwU2VydmVycyIsInNvcnQiLCJhIiwiYiIsIm5hbWUiLCJsb2NhbGVDb21wYXJlIiwiTUNQTGlzdFBhbmVsIiwidDAiLCIkIiwiX2MiLCJ0MSIsInQyIiwidW5kZWZpbmVkIiwidGhlbWUiLCJzZWxlY3RlZEluZGV4Iiwic2V0U2VsZWN0ZWRJbmRleCIsInQzIiwicmVndWxhclNlcnZlcnMiLCJmaWx0ZXIiLCJfdGVtcCIsInNlcnZlcnNCeVNjb3BlIiwidDQiLCJfdGVtcDIiLCJfdGVtcDMiLCJjbGF1ZGVBaVNlcnZlcnMiLCJ0NSIsIl90ZW1wNCIsImR5bmFtaWNTZXJ2ZXJzIiwidDYiLCJTeW1ib2wiLCJmb3IiLCJkeW5hbWljSGVhZGluZyIsIml0ZW1zIiwic2NvcGVTZXJ2ZXJzIiwic2VydmVyXzAiLCJzZXJ2ZXJfMSIsInNlbGVjdGFibGVJdGVtcyIsInQ3IiwiaGFuZGxlQ2FuY2VsIiwidDgiLCJpdGVtIiwiaGFuZGxlU2VsZWN0IiwidDEwIiwidDkiLCJwcmV2IiwibGVuZ3RoIiwicHJldl8wIiwidDExIiwidDEyIiwiY29udGV4dCIsInQxMyIsInNlcnZlcl8yIiwiZmluZEluZGV4IiwiaXRlbV8wIiwiZ2V0U2VydmVySW5kZXgiLCJ0MTQiLCJhZ2VudFNlcnZlcl8wIiwiaXRlbV8xIiwiZ2V0QWdlbnRTZXJ2ZXJJbmRleCIsInQxNSIsImRlYnVnTW9kZSIsInQxNiIsInNvbWUiLCJfdGVtcDUiLCJoYXNGYWlsZWRDbGllbnRzIiwidDE3Iiwic2VydmVyXzMiLCJpbmRleCIsImlzU2VsZWN0ZWQiLCJzdGF0dXNJY29uIiwic3RhdHVzVGV4dCIsImNsaWVudCIsInJhZGlvT2ZmIiwidGljayIsInJlY29ubmVjdEF0dGVtcHQiLCJtYXhSZWNvbm5lY3RBdHRlbXB0cyIsInRyaWFuZ2xlVXBPdXRsaW5lIiwiY3Jvc3MiLCJwb2ludGVyIiwicmVuZGVyU2VydmVySXRlbSIsInQxOCIsImFnZW50U2VydmVyXzEiLCJpbmRleF8wIiwiaXNTZWxlY3RlZF8wIiwic3RhdHVzSWNvbl8wIiwibmVlZHNBdXRoIiwic3RhdHVzVGV4dF8wIiwicmVuZGVyQWdlbnRTZXJ2ZXJJdGVtIiwidG90YWxTZXJ2ZXJzIiwidDE5IiwidDIwIiwidDIxIiwidDIyIiwibWFwIiwic2NvcGVfMCIsInNjb3BlU2VydmVyc18wIiwiaGVhZGluZyIsInNlcnZlcl80IiwidDIzIiwic2VydmVyXzUiLCJ0MjQiLCJTZXQiLCJmbGF0TWFwIiwiX3RlbXA2IiwiYWdlbnROYW1lIiwic18zIiwicyIsInNvdXJjZUFnZW50cyIsImluY2x1ZGVzIiwiYWdlbnRTZXJ2ZXJfMiIsInQyNSIsInNlcnZlcl82IiwidDI2IiwidDI3IiwidDI4IiwidDI5IiwidDMwIiwidDMxIiwidDMyIiwic18yIiwic18xIiwiYV8wIiwiYl8wIiwic18wIiwiY29uZmlnIl0sInNvdXJjZXMiOlsiTUNQTGlzdFBhbmVsLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZmlndXJlcyBmcm9tICdmaWd1cmVzJ1xuaW1wb3J0IFJlYWN0LCB7IHVzZUNhbGxiYWNrLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHR5cGUgeyBDb21tYW5kUmVzdWx0RGlzcGxheSB9IGZyb20gJy4uLy4uL2NvbW1hbmRzLmpzJ1xuaW1wb3J0IHsgQm94LCBjb2xvciwgTGluaywgVGV4dCwgdXNlVGhlbWUgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5pbXBvcnQgeyB1c2VLZXliaW5kaW5ncyB9IGZyb20gJy4uLy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgdHlwZSB7IENvbmZpZ1Njb3BlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWNwL3R5cGVzLmpzJ1xuaW1wb3J0IHsgZGVzY3JpYmVNY3BDb25maWdGaWxlUGF0aCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21jcC91dGlscy5qcydcbmltcG9ydCB7IGlzRGVidWdNb2RlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZGVidWcuanMnXG5pbXBvcnQgeyBwbHVyYWwgfSBmcm9tICcuLi8uLi91dGlscy9zdHJpbmdVdGlscy5qcydcbmltcG9ydCB7IENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCB9IGZyb20gJy4uL0NvbmZpZ3VyYWJsZVNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IEJ5bGluZSB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vQnlsaW5lLmpzJ1xuaW1wb3J0IHsgRGlhbG9nIH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9EaWFsb2cuanMnXG5pbXBvcnQgeyBLZXlib2FyZFNob3J0Y3V0SGludCB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vS2V5Ym9hcmRTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQgeyBNY3BQYXJzaW5nV2FybmluZ3MgfSBmcm9tICcuL01jcFBhcnNpbmdXYXJuaW5ncy5qcydcbmltcG9ydCB0eXBlIHsgQWdlbnRNY3BTZXJ2ZXJJbmZvLCBTZXJ2ZXJJbmZvIH0gZnJvbSAnLi90eXBlcy5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgc2VydmVyczogU2VydmVySW5mb1tdXG4gIGFnZW50U2VydmVycz86IEFnZW50TWNwU2VydmVySW5mb1tdXG4gIG9uU2VsZWN0U2VydmVyOiAoc2VydmVyOiBTZXJ2ZXJJbmZvKSA9PiB2b2lkXG4gIG9uU2VsZWN0QWdlbnRTZXJ2ZXI/OiAoYWdlbnRTZXJ2ZXI6IEFnZW50TWNwU2VydmVySW5mbykgPT4gdm9pZFxuICBvbkNvbXBsZXRlOiAoXG4gICAgcmVzdWx0Pzogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiB7IGRpc3BsYXk/OiBDb21tYW5kUmVzdWx0RGlzcGxheSB9LFxuICApID0+IHZvaWRcbiAgZGVmYXVsdFRhYj86IHN0cmluZ1xufVxuXG50eXBlIFNlbGVjdGFibGVJdGVtID1cbiAgfCB7IHR5cGU6ICdzZXJ2ZXInOyBzZXJ2ZXI6IFNlcnZlckluZm8gfVxuICB8IHsgdHlwZTogJ2FnZW50LXNlcnZlcic7IGFnZW50U2VydmVyOiBBZ2VudE1jcFNlcnZlckluZm8gfVxuXG4vLyBEZWZpbmUgc2NvcGUgb3JkZXIgZm9yIGRpc3BsYXkgKGNvbnN0YW50LCBvdXRzaWRlIGNvbXBvbmVudClcbi8vICdkeW5hbWljJyAoYnVpbHQtaW4pIGlzIHJlbmRlcmVkIHNlcGFyYXRlbHkgYXQgdGhlIGVuZFxuY29uc3QgU0NPUEVfT1JERVI6IENvbmZpZ1Njb3BlW10gPSBbJ3Byb2plY3QnLCAnbG9jYWwnLCAndXNlcicsICdlbnRlcnByaXNlJ11cblxuLy8gR2V0IHNjb3BlIGhlYWRpbmcgcGFydHMgKGxhYmVsIGlzIGJvbGQsIHBhdGggaXMgZ3JleSlcbmZ1bmN0aW9uIGdldFNjb3BlSGVhZGluZyhzY29wZTogQ29uZmlnU2NvcGUpOiB7IGxhYmVsOiBzdHJpbmc7IHBhdGg/OiBzdHJpbmcgfSB7XG4gIHN3aXRjaCAoc2NvcGUpIHtcbiAgICBjYXNlICdwcm9qZWN0JzpcbiAgICAgIHJldHVybiB7IGxhYmVsOiAnUHJvamVjdCBNQ1BzJywgcGF0aDogZGVzY3JpYmVNY3BDb25maWdGaWxlUGF0aChzY29wZSkgfVxuICAgIGNhc2UgJ3VzZXInOlxuICAgICAgcmV0dXJuIHsgbGFiZWw6ICdVc2VyIE1DUHMnLCBwYXRoOiBkZXNjcmliZU1jcENvbmZpZ0ZpbGVQYXRoKHNjb3BlKSB9XG4gICAgY2FzZSAnbG9jYWwnOlxuICAgICAgcmV0dXJuIHsgbGFiZWw6ICdMb2NhbCBNQ1BzJywgcGF0aDogZGVzY3JpYmVNY3BDb25maWdGaWxlUGF0aChzY29wZSkgfVxuICAgIGNhc2UgJ2VudGVycHJpc2UnOlxuICAgICAgcmV0dXJuIHsgbGFiZWw6ICdFbnRlcnByaXNlIE1DUHMnIH1cbiAgICBjYXNlICdkeW5hbWljJzpcbiAgICAgIHJldHVybiB7IGxhYmVsOiAnQnVpbHQtaW4gTUNQcycsIHBhdGg6ICdhbHdheXMgYXZhaWxhYmxlJyB9XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7IGxhYmVsOiBzY29wZSB9XG4gIH1cbn1cblxuLy8gR3JvdXAgc2VydmVycyBieSBzY29wZVxuZnVuY3Rpb24gZ3JvdXBTZXJ2ZXJzQnlTY29wZShcbiAgc2VydmVyTGlzdDogU2VydmVySW5mb1tdLFxuKTogTWFwPENvbmZpZ1Njb3BlLCBTZXJ2ZXJJbmZvW10+IHtcbiAgY29uc3QgZ3JvdXBzID0gbmV3IE1hcDxDb25maWdTY29wZSwgU2VydmVySW5mb1tdPigpXG4gIGZvciAoY29uc3Qgc2VydmVyIG9mIHNlcnZlckxpc3QpIHtcbiAgICBjb25zdCBzY29wZSA9IHNlcnZlci5zY29wZVxuICAgIGlmICghZ3JvdXBzLmhhcyhzY29wZSkpIHtcbiAgICAgIGdyb3Vwcy5zZXQoc2NvcGUsIFtdKVxuICAgIH1cbiAgICBncm91cHMuZ2V0KHNjb3BlKSEucHVzaChzZXJ2ZXIpXG4gIH1cbiAgLy8gU29ydCBzZXJ2ZXJzIHdpdGhpbiBlYWNoIGdyb3VwIGFscGhhYmV0aWNhbGx5XG4gIGZvciAoY29uc3QgWywgZ3JvdXBTZXJ2ZXJzXSBvZiBncm91cHMpIHtcbiAgICBncm91cFNlcnZlcnMuc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSlcbiAgfVxuICByZXR1cm4gZ3JvdXBzXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBNQ1BMaXN0UGFuZWwoe1xuICBzZXJ2ZXJzLFxuICBhZ2VudFNlcnZlcnMgPSBbXSxcbiAgb25TZWxlY3RTZXJ2ZXIsXG4gIG9uU2VsZWN0QWdlbnRTZXJ2ZXIsXG4gIG9uQ29tcGxldGUsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFt0aGVtZV0gPSB1c2VUaGVtZSgpXG4gIGNvbnN0IFtzZWxlY3RlZEluZGV4LCBzZXRTZWxlY3RlZEluZGV4XSA9IHVzZVN0YXRlKDApXG5cbiAgLy8gTm9uLWNsYXVkZWFpIHNlcnZlcnMgZ3JvdXBlZCBieSBzY29wZVxuICBjb25zdCBzZXJ2ZXJzQnlTY29wZSA9IFJlYWN0LnVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IHJlZ3VsYXJTZXJ2ZXJzID0gc2VydmVycy5maWx0ZXIoXG4gICAgICBzID0+IHMuY2xpZW50LmNvbmZpZy50eXBlICE9PSAnY2xhdWRlYWktcHJveHknLFxuICAgIClcbiAgICByZXR1cm4gZ3JvdXBTZXJ2ZXJzQnlTY29wZShyZWd1bGFyU2VydmVycylcbiAgfSwgW3NlcnZlcnNdKVxuXG4gIGNvbnN0IGNsYXVkZUFpU2VydmVycyA9IFJlYWN0LnVzZU1lbW8oXG4gICAgKCkgPT5cbiAgICAgIHNlcnZlcnNcbiAgICAgICAgLmZpbHRlcihzID0+IHMuY2xpZW50LmNvbmZpZy50eXBlID09PSAnY2xhdWRlYWktcHJveHknKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSksXG4gICAgW3NlcnZlcnNdLFxuICApXG5cbiAgLy8gQnVpbHQtaW4gKGR5bmFtaWMpIHNlcnZlcnMgLSByZW5kZXJlZCBsYXN0XG4gIGNvbnN0IGR5bmFtaWNTZXJ2ZXJzID0gUmVhY3QudXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgKHNlcnZlcnNCeVNjb3BlLmdldCgnZHluYW1pYycpID8/IFtdKS5zb3J0KChhLCBiKSA9PlxuICAgICAgICBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpLFxuICAgICAgKSxcbiAgICBbc2VydmVyc0J5U2NvcGVdLFxuICApXG5cbiAgLy8gUHJlLWNvbXB1dGUgZHluYW1pYyBoZWFkaW5nIGZvciByZW5kZXJcbiAgY29uc3QgZHluYW1pY0hlYWRpbmcgPSBnZXRTY29wZUhlYWRpbmcoJ2R5bmFtaWMnKVxuXG4gIC8vIEJ1aWxkIGZsYXQgbGlzdCBvZiBzZWxlY3RhYmxlIGl0ZW1zIGluIGRpc3BsYXkgb3JkZXJcbiAgY29uc3Qgc2VsZWN0YWJsZUl0ZW1zID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgaXRlbXM6IFNlbGVjdGFibGVJdGVtW10gPSBbXVxuICAgIGZvciAoY29uc3Qgc2NvcGUgb2YgU0NPUEVfT1JERVIpIHtcbiAgICAgIGNvbnN0IHNjb3BlU2VydmVycyA9IHNlcnZlcnNCeVNjb3BlLmdldChzY29wZSkgPz8gW11cbiAgICAgIGZvciAoY29uc3Qgc2VydmVyIG9mIHNjb3BlU2VydmVycykge1xuICAgICAgICBpdGVtcy5wdXNoKHsgdHlwZTogJ3NlcnZlcicsIHNlcnZlciB9KVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IHNlcnZlciBvZiBjbGF1ZGVBaVNlcnZlcnMpIHtcbiAgICAgIGl0ZW1zLnB1c2goeyB0eXBlOiAnc2VydmVyJywgc2VydmVyIH0pXG4gICAgfVxuICAgIGZvciAoY29uc3QgYWdlbnRTZXJ2ZXIgb2YgYWdlbnRTZXJ2ZXJzKSB7XG4gICAgICBpdGVtcy5wdXNoKHsgdHlwZTogJ2FnZW50LXNlcnZlcicsIGFnZW50U2VydmVyIH0pXG4gICAgfVxuICAgIC8vIER5bmFtaWMgKGJ1aWx0LWluKSBzZXJ2ZXJzIGNvbWUgbGFzdFxuICAgIGZvciAoY29uc3Qgc2VydmVyIG9mIGR5bmFtaWNTZXJ2ZXJzKSB7XG4gICAgICBpdGVtcy5wdXNoKHsgdHlwZTogJ3NlcnZlcicsIHNlcnZlciB9KVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXNcbiAgfSwgW3NlcnZlcnNCeVNjb3BlLCBjbGF1ZGVBaVNlcnZlcnMsIGFnZW50U2VydmVycywgZHluYW1pY1NlcnZlcnNdKVxuXG4gIGNvbnN0IGhhbmRsZUNhbmNlbCA9IHVzZUNhbGxiYWNrKCgpOiB2b2lkID0+IHtcbiAgICBvbkNvbXBsZXRlKCdNQ1AgZGlhbG9nIGRpc21pc3NlZCcsIHtcbiAgICAgIGRpc3BsYXk6ICdzeXN0ZW0nLFxuICAgIH0pXG4gIH0sIFtvbkNvbXBsZXRlXSlcblxuICBjb25zdCBoYW5kbGVTZWxlY3QgPSB1c2VDYWxsYmFjaygoKTogdm9pZCA9PiB7XG4gICAgY29uc3QgaXRlbSA9IHNlbGVjdGFibGVJdGVtc1tzZWxlY3RlZEluZGV4XVxuICAgIGlmICghaXRlbSkgcmV0dXJuXG4gICAgaWYgKGl0ZW0udHlwZSA9PT0gJ3NlcnZlcicpIHtcbiAgICAgIG9uU2VsZWN0U2VydmVyKGl0ZW0uc2VydmVyKVxuICAgIH0gZWxzZSBpZiAoaXRlbS50eXBlID09PSAnYWdlbnQtc2VydmVyJyAmJiBvblNlbGVjdEFnZW50U2VydmVyKSB7XG4gICAgICBvblNlbGVjdEFnZW50U2VydmVyKGl0ZW0uYWdlbnRTZXJ2ZXIpXG4gICAgfVxuICB9LCBbc2VsZWN0YWJsZUl0ZW1zLCBzZWxlY3RlZEluZGV4LCBvblNlbGVjdFNlcnZlciwgb25TZWxlY3RBZ2VudFNlcnZlcl0pXG5cbiAgLy8gVXNlIGNvbmZpZ3VyYWJsZSBrZXliaW5kaW5ncyBmb3IgbmF2aWdhdGlvbiBhbmQgc2VsZWN0aW9uXG4gIHVzZUtleWJpbmRpbmdzKFxuICAgIHtcbiAgICAgICdjb25maXJtOnByZXZpb3VzJzogKCkgPT5cbiAgICAgICAgc2V0U2VsZWN0ZWRJbmRleChwcmV2ID0+XG4gICAgICAgICAgcHJldiA9PT0gMCA/IHNlbGVjdGFibGVJdGVtcy5sZW5ndGggLSAxIDogcHJldiAtIDEsXG4gICAgICAgICksXG4gICAgICAnY29uZmlybTpuZXh0JzogKCkgPT5cbiAgICAgICAgc2V0U2VsZWN0ZWRJbmRleChwcmV2ID0+XG4gICAgICAgICAgcHJldiA9PT0gc2VsZWN0YWJsZUl0ZW1zLmxlbmd0aCAtIDEgPyAwIDogcHJldiArIDEsXG4gICAgICAgICksXG4gICAgICAnY29uZmlybTp5ZXMnOiBoYW5kbGVTZWxlY3QsXG4gICAgICAnY29uZmlybTpubyc6IGhhbmRsZUNhbmNlbCxcbiAgICB9LFxuICAgIHsgY29udGV4dDogJ0NvbmZpcm1hdGlvbicgfSxcbiAgKVxuXG4gIC8vIEJ1aWxkIGluZGV4IGxvb2t1cCBmb3IgZWFjaCBzZXJ2ZXJcbiAgY29uc3QgZ2V0U2VydmVySW5kZXggPSAoc2VydmVyOiBTZXJ2ZXJJbmZvKTogbnVtYmVyID0+IHtcbiAgICByZXR1cm4gc2VsZWN0YWJsZUl0ZW1zLmZpbmRJbmRleChcbiAgICAgIGl0ZW0gPT4gaXRlbS50eXBlID09PSAnc2VydmVyJyAmJiBpdGVtLnNlcnZlciA9PT0gc2VydmVyLFxuICAgIClcbiAgfVxuXG4gIGNvbnN0IGdldEFnZW50U2VydmVySW5kZXggPSAoYWdlbnRTZXJ2ZXI6IEFnZW50TWNwU2VydmVySW5mbyk6IG51bWJlciA9PiB7XG4gICAgcmV0dXJuIHNlbGVjdGFibGVJdGVtcy5maW5kSW5kZXgoXG4gICAgICBpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2FnZW50LXNlcnZlcicgJiYgaXRlbS5hZ2VudFNlcnZlciA9PT0gYWdlbnRTZXJ2ZXIsXG4gICAgKVxuICB9XG5cbiAgY29uc3QgZGVidWdNb2RlID0gaXNEZWJ1Z01vZGUoKVxuICBjb25zdCBoYXNGYWlsZWRDbGllbnRzID0gc2VydmVycy5zb21lKHMgPT4gcy5jbGllbnQudHlwZSA9PT0gJ2ZhaWxlZCcpXG5cbiAgaWYgKHNlcnZlcnMubGVuZ3RoID09PSAwICYmIGFnZW50U2VydmVycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgY29uc3QgcmVuZGVyU2VydmVySXRlbSA9IChzZXJ2ZXI6IFNlcnZlckluZm8pOiBSZWFjdC5SZWFjdE5vZGUgPT4ge1xuICAgIGNvbnN0IGluZGV4ID0gZ2V0U2VydmVySW5kZXgoc2VydmVyKVxuICAgIGNvbnN0IGlzU2VsZWN0ZWQgPSBzZWxlY3RlZEluZGV4ID09PSBpbmRleFxuICAgIGxldCBzdGF0dXNJY29uID0gJydcbiAgICBsZXQgc3RhdHVzVGV4dCA9ICcnXG5cbiAgICBpZiAoc2VydmVyLmNsaWVudC50eXBlID09PSAnZGlzYWJsZWQnKSB7XG4gICAgICBzdGF0dXNJY29uID0gY29sb3IoJ2luYWN0aXZlJywgdGhlbWUpKGZpZ3VyZXMucmFkaW9PZmYpXG4gICAgICBzdGF0dXNUZXh0ID0gJ2Rpc2FibGVkJ1xuICAgIH0gZWxzZSBpZiAoc2VydmVyLmNsaWVudC50eXBlID09PSAnY29ubmVjdGVkJykge1xuICAgICAgc3RhdHVzSWNvbiA9IGNvbG9yKCdzdWNjZXNzJywgdGhlbWUpKGZpZ3VyZXMudGljaylcbiAgICAgIHN0YXR1c1RleHQgPSAnY29ubmVjdGVkJ1xuICAgIH0gZWxzZSBpZiAoc2VydmVyLmNsaWVudC50eXBlID09PSAncGVuZGluZycpIHtcbiAgICAgIHN0YXR1c0ljb24gPSBjb2xvcignaW5hY3RpdmUnLCB0aGVtZSkoZmlndXJlcy5yYWRpb09mZilcbiAgICAgIGNvbnN0IHsgcmVjb25uZWN0QXR0ZW1wdCwgbWF4UmVjb25uZWN0QXR0ZW1wdHMgfSA9IHNlcnZlci5jbGllbnRcbiAgICAgIGlmIChyZWNvbm5lY3RBdHRlbXB0ICYmIG1heFJlY29ubmVjdEF0dGVtcHRzKSB7XG4gICAgICAgIHN0YXR1c1RleHQgPSBgcmVjb25uZWN0aW5nICgke3JlY29ubmVjdEF0dGVtcHR9LyR7bWF4UmVjb25uZWN0QXR0ZW1wdHN9KeKApmBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXR1c1RleHQgPSAnY29ubmVjdGluZ+KApidcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHNlcnZlci5jbGllbnQudHlwZSA9PT0gJ25lZWRzLWF1dGgnKSB7XG4gICAgICBzdGF0dXNJY29uID0gY29sb3IoJ3dhcm5pbmcnLCB0aGVtZSkoZmlndXJlcy50cmlhbmdsZVVwT3V0bGluZSlcbiAgICAgIHN0YXR1c1RleHQgPSAnbmVlZHMgYXV0aGVudGljYXRpb24nXG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXR1c0ljb24gPSBjb2xvcignZXJyb3InLCB0aGVtZSkoZmlndXJlcy5jcm9zcylcbiAgICAgIHN0YXR1c1RleHQgPSAnZmFpbGVkJ1xuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGtleT17YCR7c2VydmVyLm5hbWV9LSR7aW5kZXh9YH0+XG4gICAgICAgIDxUZXh0IGNvbG9yPXtpc1NlbGVjdGVkID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfT5cbiAgICAgICAgICB7aXNTZWxlY3RlZCA/IGAke2ZpZ3VyZXMucG9pbnRlcn0gYCA6ICcgICd9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICAgPFRleHQgY29sb3I9e2lzU2VsZWN0ZWQgPyAnc3VnZ2VzdGlvbicgOiB1bmRlZmluZWR9PntzZXJ2ZXIubmFtZX08L1RleHQ+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPXshaXNTZWxlY3RlZH0+IMK3IHtzdGF0dXNJY29ufSA8L1RleHQ+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPXshaXNTZWxlY3RlZH0+e3N0YXR1c1RleHR9PC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgY29uc3QgcmVuZGVyQWdlbnRTZXJ2ZXJJdGVtID0gKFxuICAgIGFnZW50U2VydmVyOiBBZ2VudE1jcFNlcnZlckluZm8sXG4gICk6IFJlYWN0LlJlYWN0Tm9kZSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSBnZXRBZ2VudFNlcnZlckluZGV4KGFnZW50U2VydmVyKVxuICAgIGNvbnN0IGlzU2VsZWN0ZWQgPSBzZWxlY3RlZEluZGV4ID09PSBpbmRleFxuICAgIGNvbnN0IHN0YXR1c0ljb24gPSBhZ2VudFNlcnZlci5uZWVkc0F1dGhcbiAgICAgID8gY29sb3IoJ3dhcm5pbmcnLCB0aGVtZSkoZmlndXJlcy50cmlhbmdsZVVwT3V0bGluZSlcbiAgICAgIDogY29sb3IoJ2luYWN0aXZlJywgdGhlbWUpKGZpZ3VyZXMucmFkaW9PZmYpXG4gICAgY29uc3Qgc3RhdHVzVGV4dCA9IGFnZW50U2VydmVyLm5lZWRzQXV0aCA/ICdtYXkgbmVlZCBhdXRoJyA6ICdhZ2VudC1vbmx5J1xuXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3gga2V5PXtgYWdlbnQtJHthZ2VudFNlcnZlci5uYW1lfS0ke2luZGV4fWB9PlxuICAgICAgICA8VGV4dCBjb2xvcj17aXNTZWxlY3RlZCA/ICdzdWdnZXN0aW9uJyA6IHVuZGVmaW5lZH0+XG4gICAgICAgICAge2lzU2VsZWN0ZWQgPyBgJHtmaWd1cmVzLnBvaW50ZXJ9IGAgOiAnICAnfVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIDxUZXh0IGNvbG9yPXtpc1NlbGVjdGVkID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfT5cbiAgICAgICAgICB7YWdlbnRTZXJ2ZXIubmFtZX1cbiAgICAgICAgPC9UZXh0PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj17IWlzU2VsZWN0ZWR9PiDCtyB7c3RhdHVzSWNvbn0gPC9UZXh0PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj17IWlzU2VsZWN0ZWR9PntzdGF0dXNUZXh0fTwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIGNvbnN0IHRvdGFsU2VydmVycyA9IHNlcnZlcnMubGVuZ3RoICsgYWdlbnRTZXJ2ZXJzLmxlbmd0aFxuXG4gIHJldHVybiAoXG4gICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICA8TWNwUGFyc2luZ1dhcm5pbmdzIC8+XG5cbiAgICAgIDxEaWFsb2dcbiAgICAgICAgdGl0bGU9XCJNYW5hZ2UgTUNQIHNlcnZlcnNcIlxuICAgICAgICBzdWJ0aXRsZT17YCR7dG90YWxTZXJ2ZXJzfSAke3BsdXJhbCh0b3RhbFNlcnZlcnMsICdzZXJ2ZXInKX1gfVxuICAgICAgICBvbkNhbmNlbD17aGFuZGxlQ2FuY2VsfVxuICAgICAgICBoaWRlSW5wdXRHdWlkZVxuICAgICAgPlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICB7LyogUmVndWxhciBzZXJ2ZXJzIGdyb3VwZWQgYnkgc2NvcGUgKi99XG4gICAgICAgICAge1NDT1BFX09SREVSLm1hcChzY29wZSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzY29wZVNlcnZlcnMgPSBzZXJ2ZXJzQnlTY29wZS5nZXQoc2NvcGUpXG4gICAgICAgICAgICBpZiAoIXNjb3BlU2VydmVycyB8fCBzY29wZVNlcnZlcnMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbFxuICAgICAgICAgICAgY29uc3QgaGVhZGluZyA9IGdldFNjb3BlSGVhZGluZyhzY29wZSlcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxCb3gga2V5PXtzY29wZX0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgICAgICAgPEJveCBwYWRkaW5nTGVmdD17Mn0+XG4gICAgICAgICAgICAgICAgICA8VGV4dCBib2xkPntoZWFkaW5nLmxhYmVsfTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgIHtoZWFkaW5nLnBhdGggJiYgPFRleHQgZGltQ29sb3I+ICh7aGVhZGluZy5wYXRofSk8L1RleHQ+fVxuICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgIHtzY29wZVNlcnZlcnMubWFwKHNlcnZlciA9PiByZW5kZXJTZXJ2ZXJJdGVtKHNlcnZlcikpfVxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgIClcbiAgICAgICAgICB9KX1cblxuICAgICAgICAgIHsvKiBDbGF1ZGUuYWkgc2VydmVycyBzZWN0aW9uICovfVxuICAgICAgICAgIHtjbGF1ZGVBaVNlcnZlcnMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfT5cbiAgICAgICAgICAgICAgICA8VGV4dCBib2xkPmNsYXVkZS5haTwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgIHtjbGF1ZGVBaVNlcnZlcnMubWFwKHNlcnZlciA9PiByZW5kZXJTZXJ2ZXJJdGVtKHNlcnZlcikpfVxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHsvKiBBZ2VudCBzZXJ2ZXJzIHNlY3Rpb24gLSBncm91cGVkIGJ5IHNvdXJjZSBhZ2VudCAqL31cbiAgICAgICAgICB7YWdlbnRTZXJ2ZXJzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICAgICAgPEJveCBwYWRkaW5nTGVmdD17Mn0+XG4gICAgICAgICAgICAgICAgPFRleHQgYm9sZD5BZ2VudCBNQ1BzPC9UZXh0PlxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgey8qIEdyb3VwIHNlcnZlcnMgYnkgc291cmNlIGFnZW50ICovfVxuICAgICAgICAgICAgICB7Wy4uLm5ldyBTZXQoYWdlbnRTZXJ2ZXJzLmZsYXRNYXAocyA9PiBzLnNvdXJjZUFnZW50cykpXS5tYXAoXG4gICAgICAgICAgICAgICAgYWdlbnROYW1lID0+IChcbiAgICAgICAgICAgICAgICAgIDxCb3gga2V5PXthZ2VudE5hbWV9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfT5cbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5Ae2FnZW50TmFtZX08L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgICB7YWdlbnRTZXJ2ZXJzXG4gICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihzID0+IHMuc291cmNlQWdlbnRzLmluY2x1ZGVzKGFnZW50TmFtZSkpXG4gICAgICAgICAgICAgICAgICAgICAgLm1hcChhZ2VudFNlcnZlciA9PiByZW5kZXJBZ2VudFNlcnZlckl0ZW0oYWdlbnRTZXJ2ZXIpKX1cbiAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApfVxuXG4gICAgICAgICAgey8qIEJ1aWx0LWluIChkeW5hbWljKSBzZXJ2ZXJzIHNlY3Rpb24gLSBhbHdheXMgbGFzdCAqL31cbiAgICAgICAgICB7ZHluYW1pY1NlcnZlcnMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfT5cbiAgICAgICAgICAgICAgICA8VGV4dCBib2xkPntkeW5hbWljSGVhZGluZy5sYWJlbH08L1RleHQ+XG4gICAgICAgICAgICAgICAge2R5bmFtaWNIZWFkaW5nLnBhdGggJiYgKFxuICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+ICh7ZHluYW1pY0hlYWRpbmcucGF0aH0pPC9UZXh0PlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICB7ZHluYW1pY1NlcnZlcnMubWFwKHNlcnZlciA9PiByZW5kZXJTZXJ2ZXJJdGVtKHNlcnZlcikpfVxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHsvKiBGb290ZXIgaW5mbyAqL31cbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIHtoYXNGYWlsZWRDbGllbnRzICYmIChcbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAge2RlYnVnTW9kZVxuICAgICAgICAgICAgICAgICAgPyAn4oC7IEVycm9yIGxvZ3Mgc2hvd24gaW5saW5lIHdpdGggLS1kZWJ1ZydcbiAgICAgICAgICAgICAgICAgIDogJ+KAuyBSdW4gY2xhdWRlIC0tZGVidWcgdG8gc2VlIGVycm9yIGxvZ3MnfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICApfVxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIDxMaW5rIHVybD1cImh0dHBzOi8vY29kZS5jbGF1ZGUuY29tL2RvY3MvZW4vbWNwXCI+XG4gICAgICAgICAgICAgICAgaHR0cHM6Ly9jb2RlLmNsYXVkZS5jb20vZG9jcy9lbi9tY3BcbiAgICAgICAgICAgICAgPC9MaW5rPnsnICd9XG4gICAgICAgICAgICAgIGZvciBoZWxwXG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9EaWFsb2c+XG5cbiAgICAgIHsvKiBDdXN0b20gZm9vdGVyIHdpdGggbmF2aWdhdGlvbiBoaW50ICovfVxuICAgICAgPEJveCBwYWRkaW5nWD17MX0+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwi4oaR4oaTXCIgYWN0aW9uPVwibmF2aWdhdGVcIiAvPlxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiRW50ZXJcIiBhY3Rpb249XCJjb25maXJtXCIgLz5cbiAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICBmYWxsYmFjaz1cIkVzY1wiXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2FuY2VsXCJcbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIDwvQm94PlxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPQSxPQUFPLE1BQU0sU0FBUztBQUM3QixPQUFPQyxLQUFLLElBQUlDLFdBQVcsRUFBRUMsUUFBUSxRQUFRLE9BQU87QUFDcEQsY0FBY0Msb0JBQW9CLFFBQVEsbUJBQW1CO0FBQzdELFNBQVNDLEdBQUcsRUFBRUMsS0FBSyxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsUUFBUSxRQUFRLGNBQWM7QUFDL0QsU0FBU0MsY0FBYyxRQUFRLG9DQUFvQztBQUNuRSxjQUFjQyxXQUFXLFFBQVEsNkJBQTZCO0FBQzlELFNBQVNDLHlCQUF5QixRQUFRLDZCQUE2QjtBQUN2RSxTQUFTQyxXQUFXLFFBQVEsc0JBQXNCO0FBQ2xELFNBQVNDLE1BQU0sUUFBUSw0QkFBNEI7QUFDbkQsU0FBU0Msd0JBQXdCLFFBQVEsZ0NBQWdDO0FBQ3pFLFNBQVNDLE1BQU0sUUFBUSw0QkFBNEI7QUFDbkQsU0FBU0MsTUFBTSxRQUFRLDRCQUE0QjtBQUNuRCxTQUFTQyxvQkFBb0IsUUFBUSwwQ0FBMEM7QUFDL0UsU0FBU0Msa0JBQWtCLFFBQVEseUJBQXlCO0FBQzVELGNBQWNDLGtCQUFrQixFQUFF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SixlQUFHLENBQUMsQ0FBUSxNQUFVLENBQVYsVUFBVSxHQUNyRCxDQUFDLG9CQUFvQixDQUFVLFFBQU8sQ0FBUCxPQUFPLENBQVEsTUFBUyxDQUFULFNBQVMsR0FDdkQsQ0FBQyx3QkFBd0IsQ0FDaEIsTUFBWSxDQUFaLFlBQVksQ0FDWCxPQUFjLENBQWQsY0FBYyxDQUNiLFFBQUssQ0FBTCxLQUFLLENBQ0YsV0FBUSxDQUFSLFFBQVEsR0FFeEIsRUFUQyxNQUFNLENBVVQsRUFYQyxJQUFJLENBWVAsRUFiQyxHQUFHLENBYUU7SUFBQTdHLENBQUEsT0FBQTZHLEdBQUE7RUFBQTtJQUFBQSxHQUFBLEdBQUE3RyxDQUFBO0VBQUE7RUFBQSxJQUFBOEcsR0FBQTtFQUFBLElBQUE5RyxDQUFBLFNBQUE0RyxHQUFBO0lBeEdSRSxHQUFBLElBQUMsR0FBRyxDQUFlLGFBQVEsQ0FBUixRQUFRLENBQ3pCLENBQUE3QixHQUFxQixDQUVyQixDQUFBMkIsR0FxRlEsQ0FHUixDQUFBQyxHQWFLLENBQ1AsRUF6R0MsR0FBRyxDQXlHRTtJQUFBN0csQ0FBQSxPQUFBNEcsR0FBQTtJQUFBNUcsQ0FBQSxPQUFBOEcsR0FBQTtFQUFBO0lBQUFBLEdBQUEsR0FBQTlHLENBQUE7RUFBQTtFQUFBLE9BekdOOEcsR0F5R007QUFBQTtBQTdSSCxTQUFBZixPQUFBZ0IsR0FBQTtFQUFBLE9BK044Q2IsR0FBQyxDQUFBQyxZQUFhO0FBQUE7QUEvTjVELFNBQUE1QyxPQUFBeUQsR0FBQTtFQUFBLE9BMkdzQ2QsR0FBQyxDQUFBbkMsTUFBTyxDQUFBckYsSUFBSyxLQUFLLFFBQVE7QUFBQTtBQTNHaEUsU0FBQXdDLE9BQUErRixHQUFBLEVBQUFDLEdBQUE7RUFBQSxPQThCQ3hILEdBQUMsQ0FBQUUsSUFBSyxDQUFBQyxhQUFjLENBQUNGLEdBQUMsQ0FBQUMsSUFBSyxDQUFDO0FBQUE7QUE5QjdCLFNBQUFtQixPQUFBckIsQ0FBQSxFQUFBQyxDQUFBO0VBQUEsT0FzQmlCRCxDQUFDLENBQUFFLElBQUssQ0FBQUMsYUFBYyxDQUFDRixDQUFDLENBQUFDLElBQUssQ0FBQztBQUFBO0FBdEI3QyxTQUFBa0IsT0FBQXFHLEdBQUE7RUFBQSxPQXFCY2pCLEdBQUMsQ0FBQW5DLE1BQU8sQ0FBQXFELE1BQU8sQ0FBQTFJLElBQUssS0FBSyxnQkFBZ0I7QUFBQTtBQXJCdkQsU0FBQWlDLE1BQUF1RixDQUFBO0VBQUEsT0FhSUEsQ0FBQyxDQUFBbkMsTUFBTyxDQUFBcUQsTUFBTyxDQUFBMUksSUFBSyxLQUFLLGdCQUFnQjtBQUFBIiwiaWdub3JlTGlzdCI6W119