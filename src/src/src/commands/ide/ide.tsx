import { c as _c } from "react/compiler-runtime";
import chalk from 'chalk';
import * as path from 'path';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { logEvent } from 'src/services/analytics/index.js';
import type { CommandResultDisplay, LocalJSXCommandContext } from '../../commands.js';
import { Select } from '../../components/CustomSelect/index.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { IdeAutoConnectDialog, IdeDisableAutoConnectDialog, shouldShowAutoConnectDialog, shouldShowDisableAutoConnectDialog } from '../../components/IdeAutoConnectDialog.js';
import { Box, Text } from '../../ink.js';
import { clearServerCache } from '../../services/mcp/client.js';
import type { ScopedMcpServerConfig } from '../../services/mcp/types.js';
import { useAppState, useSetAppState } from '../../state/AppState.js';
import { getCwd } from '../../utils/cwd.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import { type DetectedIDEInfo, detectIDEs, detectRunningIDEs, type IdeType, isJetBrainsIde, isSupportedJetBrainsTerminal, isSupportedTerminal, toIDEDisplayName } from '../../utils/ide.js';
import { getCurrentWorktreeSession } from '../../utils/worktree.js';
type IDEScreenProps = {
  availableIDEs: DetectedIDEInfo[];
  unavailableIDEs: DetectedIDEInfo[];
  selectedIDE?: DetectedIDEInfo | null;
  onClose: () => void;
  onSelect: (ide?: DetectedIDEInfo) => void;
};
function IDEScreen(t0) {
  const $ = _c(39);
  const {
    availableIDEs,
    unavailableIDEs,
    selectedIDE,
    onClose,
    onSelect
  } = t0;
  let t1;
  if ($[0] !== selectedIDE?.port) {
    t1 = selectedIDE?.port?.toString() ?? "None";
    $[0] = selectedIDE?.port;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const [selectedValue, setSelectedValue] = useState(t1);
  const [showAutoConnectDialog, setShowAutoConnectDialog] = useState(false);
  const [showDisableAutoConnectDialog, setShowDisableAutoConnectDialog] = useState(false);
  let t2;
  if ($[2] !== availableIDEs || $[3] !== onSelect) {
    t2 = value => {
      if (value !== "None" && shouldShowAutoConnectDialog()) {
        setShowAutoConnectDialog(true);
      } else {
        if (value === "None" && shouldShowDisableAutoConnectDialog()) {
          setShowDisableAutoConnectDialog(true);
        } else {
          onSelect(availableIDEs.find(ide => ide.port === parseInt(value)));
        }
      }
    };
    $[2] = availableIDEs;
    $[3] = onSelect;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  const handleSelectIDE = t2;
  let t3;
  if ($[5] !== availableIDEs) {
    t3 = availableIDEs.reduce(_temp, {});
    $[5] = availableIDEs;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  const ideCounts = t3;
  let t4;
  if ($[7] !== availableIDEs || $[8] !== ideCounts) {
    let t5;
    if ($[10] !== ideCounts) {
      t5 = ide_1 => {
        const hasMultipleInstances = (ideCounts[ide_1.name] || 0) > 1;
        const showWorkspace = hasMultipleInstances && ide_1.workspaceFolders.length > 0;
        return {
          label: ide_1.name,
          value: ide_1.port.toString(),
          description: showWorkspace ? formatWorkspaceFolders(ide_1.workspaceFolders) : undefined
        };
      };
      $[10] = ideCounts;
      $[11] = t5;
    } else {
      t5 = $[11];
    }
    t4 = availableIDEs.map(t5).concat([{
      label: "None",
      value: "None",
      description: undefined
    }]);
    $[7] = availableIDEs;
    $[8] = ideCounts;
    $[9] = t4;
  } else {
    t4 = $[9];
  }
  const options = t4;
  if (showAutoConnectDialog) {
    let t5;
    if ($[12] !== handleSelectIDE || $[13] !== selectedValue) {
      t5 = <IdeAutoConnectDialog onComplete={() => handleSelectIDE(selectedValue)} />;
      $[12] = handleSelectIDE;
      $[13] = selectedValue;
      $[14] = t5;
    } else {
      t5 = $[14];
    }
    return t5;
  }
  if (showDisableAutoConnectDialog) {
    let t5;
    if ($[15] !== onSelect) {
      t5 = <IdeDisableAutoConnectDialog onComplete={() => {
        onSelect(undefined);
      }} />;
      $[15] = onSelect;
      $[16] = t5;
    } else {
      t5 = $[16];
    }
    return t5;
  }
  let t5;
  if ($[17] !== availableIDEs.length) {
    t5 = availableIDEs.length === 0 && <Text dimColor={true}>{isSupportedJetBrainsTerminal() ? "No available IDEs detected. Please install the plugin and restart your IDE:\nhttps://docs.claude.com/s/claude-code-jetbrains" : "No available IDEs detected. Make sure your IDE has the Claude Code extension or plugin installed and is running."}</Text>;
    $[17] = availableIDEs.length;
    $[18] = t5;
  } else {
    t5 = $[18];
  }
  let t6;
  if ($[19] !== availableIDEs.length || $[20] !== handleSelectIDE || $[21] !== options || $[22] !== selectedValue) {
    t6 = availableIDEs.length !== 0 && <Select defaultValue={selectedValue} defaultFocusValue={selectedValue} options={options} onChange={value_0 => {
      setSelectedValue(value_0);
      handleSelectIDE(value_0);
    }} />;
    $[19] = availableIDEs.length;
    $[20] = handleSelectIDE;
    $[21] = options;
    $[22] = selectedValue;
    $[23] = t6;
  } else {
    t6 = $[23];
  }
  let t7;
  if ($[24] !== availableIDEs) {
    t7 = availableIDEs.length !== 0 && availableIDEs.some(_temp2) && <Box marginTop={1}><Text color="warning">Note: Only one Claude Code instance can be connected to VS Code at a time.</Text></Box>;
    $[24] = availableIDEs;
    $[25] = t7;
  } else {
    t7 = $[25];
  }
  let t8;
  if ($[26] !== availableIDEs.length) {
    t8 = availableIDEs.length !== 0 && !isSupportedTerminal() && <Box marginTop={1}><Text dimColor={true}>Tip: You can enable auto-connect to IDE in /config or with the --ide flag</Text></Box>;
    $[26] = availableIDEs.length;
    $[27] = t8;
  } else {
    t8 = $[27];
  }
  let t9;
  if ($[28] !== unavailableIDEs) {
    t9 = unavailableIDEs.length > 0 && <Box marginTop={1} flexDirection="column"><Text dimColor={true}>Found {unavailableIDEs.length} other running IDE(s). However, their workspace/project directories do not match the current cwd.</Text><Box marginTop={1} flexDirection="column">{unavailableIDEs.map(_temp3)}</Box></Box>;
    $[28] = unavailableIDEs;
    $[29] = t9;
  } else {
    t9 = $[29];
  }
  let t10;
  if ($[30] !== t5 || $[31] !== t6 || $[32] !== t7 || $[33] !== t8 || $[34] !== t9) {
    t10 = <Box flexDirection="column">{t5}{t6}{t7}{t8}{t9}</Box>;
    $[30] = t5;
    $[31] = t6;
    $[32] = t7;
    $[33] = t8;
    $[34] = t9;
    $[35] = t10;
  } else {
    t10 = $[35];
  }
  let t11;
  if ($[36] !== onClose || $[37] !== t10) {
    t11 = <Dialog title="Select IDE" subtitle="Connect to an IDE for integrated development features." onCancel={onClose} color="ide">{t10}</Dialog>;
    $[36] = onClose;
    $[37] = t10;
    $[38] = t11;
  } else {
    t11 = $[38];
  }
  return t11;
}
function _temp3(ide_3, index) {
  return <Box key={index} paddingLeft={3}><Text dimColor={true}>• {ide_3.name}: {formatWorkspaceFolders(ide_3.workspaceFolders)}</Text></Box>;
}
function _temp2(ide_2) {
  return ide_2.name === "VS Code" || ide_2.name === "Visual Studio Code";
}
function _temp(acc, ide_0) {
  acc[ide_0.name] = (acc[ide_0.name] || 0) + 1;
  return acc;
}
async function findCurrentIDE(availableIDEs: DetectedIDEInfo[], dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>): Promise<DetectedIDEInfo | null> {
  const currentConfig = dynamicMcpConfig?.ide;
  if (!currentConfig || currentConfig.type !== 'sse-ide' && currentConfig.type !== 'ws-ide') {
    return null;
  }
  for (const ide of availableIDEs) {
    if (ide.url === currentConfig.url) {
      return ide;
    }
  }
  return null;
}
type IDEOpenSelectionProps = {
  availableIDEs: DetectedIDEInfo[];
  onSelectIDE: (ide?: DetectedIDEInfo) => void;
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
function IDEOpenSelection(t0) {
  const $ = _c(18);
  const {
    availableIDEs,
    onSelectIDE,
    onDone
  } = t0;
  let t1;
  if ($[0] !== availableIDEs[0]?.port) {
    t1 = availableIDEs[0]?.port?.toString() ?? "";
    $[0] = availableIDEs[0]?.port;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const [selectedValue, setSelectedValue] = useState(t1);
  let t2;
  if ($[2] !== availableIDEs || $[3] !== onSelectIDE) {
    t2 = value => {
      const selectedIDE = availableIDEs.find(ide => ide.port === parseInt(value));
      onSelectIDE(selectedIDE);
    };
    $[2] = availableIDEs;
    $[3] = onSelectIDE;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  const handleSelectIDE = t2;
  let t3;
  if ($[5] !== availableIDEs) {
    t3 = availableIDEs.map(_temp4);
    $[5] = availableIDEs;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  const options = t3;
  let t4;
  if ($[7] !== onDone) {
    t4 = function handleCancel() {
      onDone("IDE selection cancelled", {
        display: "system"
      });
    };
    $[7] = onDone;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  const handleCancel = t4;
  let t5;
  if ($[9] !== handleSelectIDE) {
    t5 = value_0 => {
      setSelectedValue(value_0);
      handleSelectIDE(value_0);
    };
    $[9] = handleSelectIDE;
    $[10] = t5;
  } else {
    t5 = $[10];
  }
  let t6;
  if ($[11] !== options || $[12] !== selectedValue || $[13] !== t5) {
    t6 = <Select defaultValue={selectedValue} defaultFocusValue={selectedValue} options={options} onChange={t5} />;
    $[11] = options;
    $[12] = selectedValue;
    $[13] = t5;
    $[14] = t6;
  } else {
    t6 = $[14];
  }
  let t7;
  if ($[15] !== handleCancel || $[16] !== t6) {
    t7 = <Dialog title="Select an IDE to open the project" onCancel={handleCancel} color="ide">{t6}</Dialog>;
    $[15] = handleCancel;
    $[16] = t6;
    $[17] = t7;
  } else {
    t7 = $[17];
  }
  return t7;
}
function _temp4(ide_0) {
  return {
    label: ide_0.name,
    value: ide_0.port.toString()
  };
}
function RunningIDESelector(t0) {
  const $ = _c(15);
  const {
    runningIDEs,
    onSelectIDE,
    onDone
  } = t0;
  const [selectedValue, setSelectedValue] = useState(runningIDEs[0] ?? "");
  let t1;
  if ($[0] !== onSelectIDE) {
    t1 = value => {
      onSelectIDE(value as IdeType);
    };
    $[0] = onSelectIDE;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const handleSelectIDE = t1;
  let t2;
  if ($[2] !== runningIDEs) {
    t2 = runningIDEs.map(_temp5);
    $[2] = runningIDEs;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  const options = t2;
  let t3;
  if ($[4] !== onDone) {
    t3 = function handleCancel() {
      onDone("IDE selection cancelled", {
        display: "system"
      });
    };
    $[4] = onDone;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  const handleCancel = t3;
  let t4;
  if ($[6] !== handleSelectIDE) {
    t4 = value_0 => {
      setSelectedValue(value_0);
      handleSelectIDE(value_0);
    };
    $[6] = handleSelectIDE;
    $[7] = t4;
  } else {
    t4 = $[7];
  }
  let t5;
  if ($[8] !== options || $[9] !== selectedValue || $[10] !== t4) {
    t5 = <Select defaultFocusValue={selectedValue} options={options} onChange={t4} />;
    $[8] = options;
    $[9] = selectedValue;
    $[10] = t4;
    $[11] = t5;
  } else {
    t5 = $[11];
  }
  let t6;
  if ($[12] !== handleCancel || $[13] !== t5) {
    t6 = <Dialog title="Select IDE to install extension" onCancel={handleCancel} color="ide">{t5}</Dialog>;
    $[12] = handleCancel;
    $[13] = t5;
    $[14] = t6;
  } else {
    t6 = $[14];
  }
  return t6;
}
function _temp5(ide) {
  return {
    label: toIDEDisplayName(ide),
    value: ide
  };
}
function InstallOnMount(t0) {
  const $ = _c(4);
  const {
    ide,
    onInstall
  } = t0;
  let t1;
  let t2;
  if ($[0] !== ide || $[1] !== onInstall) {
    t1 = () => {
      onInstall(ide);
    };
    t2 = [ide, onInstall];
    $[0] = ide;
    $[1] = onInstall;
    $[2] = t1;
    $[3] = t2;
  } else {
    t1 = $[2];
    t2 = $[3];
  }
  useEffect(t1, t2);
  return null;
}
export async function call(onDone: (result?: string, options?: {
  display?: CommandResultDisplay;
}) => void, context: LocalJSXCommandContext, args: string): Promise<React.ReactNode | null> {
  logEvent('tengu_ext_ide_command', {});
  const {
    options: {
      dynamicMcpConfig
    },
    onChangeDynamicMcpConfig
  } = context;

  // Handle 'open' argument
  if (args?.trim() === 'open') {
    const worktreeSession = getCurrentWorktreeSession();
    const targetPath = worktreeSession ? worktreeSession.worktreePath : getCwd();

    // Detect available IDEs
    const detectedIDEs = await detectIDEs(true);
    const availableIDEs = detectedIDEs.filter(ide => ide.isValid);
    if (availableIDEs.length === 0) {
      onDone('No IDEs with Claude Code extension detected.');
      return null;
    }

    // Return IDE selection component
    return <IDEOpenSelection availableIDEs={availableIDEs} onSelectIDE={async (selectedIDE?: DetectedIDEInfo) => {
      if (!selectedIDE) {
        onDone('No IDE selected.');
        return;
      }

      // Try to open the project in the selected IDE
      if (selectedIDE.name.toLowerCase().includes('vscode') || selectedIDE.name.toLowerCase().includes('cursor') || selectedIDE.name.toLowerCase().includes('windsurf')) {
        // VS Code-based IDEs
        const {
          code
        } = await execFileNoThrow('code', [targetPath]);
        if (code === 0) {
          onDone(`Opened ${worktreeSession ? 'worktree' : 'project'} in ${chalk.bold(selectedIDE.name)}`);
        } else {
          onDone(`Failed to open in ${selectedIDE.name}. Try opening manually: ${targetPath}`);
        }
      } else if (isSupportedJetBrainsTerminal()) {
        // JetBrains IDEs - they usually open via their CLI tools
        onDone(`Please open the ${worktreeSession ? 'worktree' : 'project'} manually in ${chalk.bold(selectedIDE.name)}: ${targetPath}`);
      } else {
        onDone(`Please open the ${worktreeSession ? 'worktree' : 'project'} manually in ${chalk.bold(selectedIDE.name)}: ${targetPath}`);
      }
    }} onDone={() => {
      onDone('Exited without opening IDE', {
        display: 'system'
      });
    }} />;
  }
  const detectedIDEs = await detectIDEs(true);

  // If no IDEs with extensions detected, check for running IDEs and offer to install
  if (detectedIDEs.length === 0 && context.onInstallIDEExtension && !isSupportedTerminal()) {
    const runningIDEs = await detectRunningIDEs();
    const onInstall = (ide: IdeType) => {
      if (context.onInstallIDEExtension) {
        context.onInstallIDEExtension(ide);
        // The completion message will be shown after installation
        if (isJetBrainsIde(ide)) {
          onDone(`Installed plugin to ${chalk.bold(toIDEDisplayName(ide))}\n` + `Please ${chalk.bold('restart your IDE')} completely for it to take effect`);
        } else {
          onDone(`Installed extension to ${chalk.bold(toIDEDisplayName(ide))}`);
        }
      }
    };
    if (runningIDEs.length > 1) {
      // Show selector when multiple IDEs are running
      return <RunningIDESelector runningIDEs={runningIDEs} onSelectIDE={onInstall} onDone={() => {
        onDone('No IDE selected.', {
          display: 'system'
        });
      }} />;
    } else if (runningIDEs.length === 1) {
      return <InstallOnMount ide={runningIDEs[0]!} onInstall={onInstall} />;
    }
  }
  const availableIDEs = detectedIDEs.filter(ide => ide.isValid);
  const unavailableIDEs = detectedIDEs.filter(ide => !ide.isValid);
  const currentIDE = await findCurrentIDE(availableIDEs, dynamicMcpConfig);
  return <IDECommandFlow availableIDEs={availableIDEs} unavailableIDEs={unavailableIDEs} currentIDE={currentIDE} dynamicMcpConfig={dynamicMcpConfig} onChangeDynamicMcpConfig={onChangeDynamicMcpConfig} onDone={onDone} />;
}

// Connection timeout slightly longer than the 30s MCP connection timeout
const IDE_CONNECTION_TIMEOUT_MS = 35000;
type IDECommandFlowProps = {
  availableIDEs: DetectedIDEInfo[];
  unavailableIDEs: DetectedIDEInfo[];
  currentIDE: DetectedIDEInfo | null;
  dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>;
  onChangeDynamicMcpConfig?: (config: Record<string, ScopedMcpServerConfig>) => void;
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
function IDECommandFlow({
  availableIDEs,
  unavailableIDEs,
  currentIDE,
  dynamicMcpConfig,
  onChangeDynamicMcpConfig,
  onDone
}: IDECommandFlowProps): React.ReactNode {
  const [connectingIDE, setConnectingIDE] = useState<DetectedIDEInfo | null>(null);
  const ideClient = useAppState(s => s.mcp.clients.find(c => c.name === 'ide'));
  const setAppState = useSetAppState();
  const isFirstCheckRef = useRef(true);

  // Watch for connection result
  useEffect(() => {
    if (!connectingIDE) return;
    // Skip the first check — it reflects stale state from before the
    // config change was dispatched
    if (isFirstCheckRef.current) {
      isFirstCheckRef.current = false;
      return;
    }
    if (!ideClient || ideClient.type === 'pending') return;
    if (ideClient.type === 'connected') {
      onDone(`Connected to ${connectingIDE.name}.`);
    } else if (ideClient.type === 'failed') {
      onDone(`Failed to connect to ${connectingIDE.name}.`);
    }
  }, [ideClient, connectingIDE, onDone]);

  // Timeout fallback
  useEffect(() => {
    if (!connectingIDE) return;
    const timer = setTimeout(onDone, IDE_CONNECTION_TIMEOUT_MS, `Connection to ${connectingIDE.name} timed out.`);
    return () => clearTimeout(timer);
  }, [connectingIDE, onDone]);
  const handleSelectIDE = useCallback((selectedIDE?: DetectedIDEInfo) => {
    if (!onChangeDynamicMcpConfig) {
      onDone('Error connecting to IDE.');
      return;
    }
    const newConfig = {
      ...(dynamicMcpConfig || {})
    };
    if (currentIDE) {
      delete newConfig.ide;
    }
    if (!selectedIDE) {
      // Close the MCP transport and remove the client from state
      if (ideClient && ideClient.type === 'connected' && currentIDE) {
        // Null out onclose to prevent auto-reconnection
        ideClient.client.onclose = () => {};
        void clearServerCache('ide', ideClient.config);
        setAppState(prev => ({
          ...prev,
          mcp: {
            ...prev.mcp,
            clients: prev.mcp.clients.filter(c_0 => c_0.name !== 'ide'),
            tools: prev.mcp.tools.filter(t => !t.name?.startsWith('mcp__ide__')),
            commands: prev.mcp.commands.filter(c_1 => !c_1.name?.startsWith('mcp__ide__'))
          }
        }));
      }
      onChangeDynamicMcpConfig(newConfig);
      onDone(currentIDE ? `Disconnected from ${currentIDE.name}.` : 'No IDE selected.');
      return;
    }
    const url = selectedIDE.url;
    newConfig.ide = {
      type: url.startsWith('ws:') ? 'ws-ide' : 'sse-ide',
      url: url,
      ideName: selectedIDE.name,
      authToken: selectedIDE.authToken,
      ideRunningInWindows: selectedIDE.ideRunningInWindows,
      scope: 'dynamic' as const
    } as ScopedMcpServerConfig;
    isFirstCheckRef.current = true;
    setConnectingIDE(selectedIDE);
    onChangeDynamicMcpConfig(newConfig);
  }, [dynamicMcpConfig, currentIDE, ideClient, setAppState, onChangeDynamicMcpConfig, onDone]);
  if (connectingIDE) {
    return <Text dimColor>Connecting to {connectingIDE.name}…</Text>;
  }
  return <IDEScreen availableIDEs={availableIDEs} unavailableIDEs={unavailableIDEs} selectedIDE={currentIDE} onClose={() => onDone('IDE selection cancelled', {
    display: 'system'
  })} onSelect={handleSelectIDE} />;
}

/**
 * Formats workspace folders for display, stripping cwd and showing tail end of paths
 * @param folders Array of folder paths
 * @param maxLength Maximum total length of the formatted string
 * @returns Formatted string with folder paths
 */
export function formatWorkspaceFolders(folders: string[], maxLength: number = 100): string {
  if (folders.length === 0) return '';
  const cwd = getCwd();

  // Only show first 2 workspaces
  const foldersToShow = folders.slice(0, 2);
  const hasMore = folders.length > 2;

  // Account for ", …" if there are more folders
  const ellipsisOverhead = hasMore ? 3 : 0; // ", …"

  // Account for commas and spaces between paths (", " = 2 chars per separator)
  const separatorOverhead = (foldersToShow.length - 1) * 2;
  const availableLength = maxLength - separatorOverhead - ellipsisOverhead;
  const maxLengthPerPath = Math.floor(availableLength / foldersToShow.length);
  const cwdNFC = cwd.normalize('NFC');
  const formattedFolders = foldersToShow.map(folder => {
    // Strip cwd from the beginning if present
    // Normalize both to NFC for consistent comparison (macOS uses NFD paths)
    const folderNFC = folder.normalize('NFC');
    if (folderNFC.startsWith(cwdNFC + path.sep)) {
      folder = folderNFC.slice(cwdNFC.length + 1);
    }
    if (folder.length <= maxLengthPerPath) {
      return folder;
    }
    return '…' + folder.slice(-(maxLengthPerPath - 1));
  });
  let result = formattedFolders.join(', ');
  if (hasMore) {
    result += ', …';
  }
  return result;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJjaGFsayIsInBhdGgiLCJSZWFjdCIsInVzZUNhbGxiYWNrIiwidXNlRWZmZWN0IiwidXNlUmVmIiwidXNlU3RhdGUiLCJsb2dFdmVudCIsIkNvbW1hbmRSZXN1bHREaXNwbGF5IiwiTG9jYWxKU1hDb21tYW5kQ29udGV4dCIsIlNlbGVjdCIsIkRpYWxvZyIsIklkZUF1dG9Db25uZWN0RGlhbG9nIiwiSWRlRGlzYWJsZUF1dG9Db25uZWN0RGlhbG9nIiwic2hvdWxkU2hvd0F1dG9Db25uZWN0RGlhbG9nIiwic2hvdWxkU2hvd0Rpc2FibGVBdXRvQ29ubmVjdERpYWxvZyIsIkJveCIsIlRleHQiLCJjbGVhclNlcnZlckNhY2hlIiwiU2NvcGVkTWNwU2VydmVyQ29uZmlnIiwidXNlQXBwU3RhdGUiLCJ1c2VTZXRBcHBTdGF0ZSIsImdldEN3ZCIsImV4ZWNGaWxlTm9UaHJvdyIsIkRldGVjdGVkSURFSW5mbyIsImRldGVjdElERXMiLCJkZXRlY3RSdW5uaW5nSURFcyIsIklkZVR5cGUiLCJpc0pldEJyYWluc0lkZSIsImlzU3VwcG9ydGVkSmV0QnJhaW5zVGVybWluYWwiLCJpc1N1cHBvcnRlZFRlcm1pbmFsIiwidG9JREVEaXNwbGF5TmFtZSIsImdldEN1cnJlbnRXb3JrdHJlZVNlc3Npb24iLCJJREVTY3JlZW5Qcm9wcyIsImF2YWlsYWJsZUlERXMiLCJ1bmF2YWlsYWJsZUlERXMiLCJzZWxlY3RlZElERSIsIm9uQ2xvc2UiLCJvblNlbGVjdCIsImlkZSIsIklERVNjcmVlbiIsInQwIiwiJCIsIl9jIiwidDEiLCJwb3J0IiwidG9TdHJpbmciLCJzZWxlY3RlZFZhbHVlIiwic2V0U2VsZWN0ZWRWYWx1ZSIsInNob3dBdXRvQ29ubmVjdERpYWxvZyIsInNldFNob3dBdXRvQ29ubmVjdERpYWxvZyIsInNob3dEaXNhYmxlQXV0b0Nvbm5lY3REaWFsb2ciLCJzZXRTaG93RGlzYWJsZUF1dG9Db25uZWN0RGlhbG9nIiwidDIiLCJ2YWx1ZSIsImZpbmQiLCJwYXJzZUludCIsImhhbmRsZVNlbGVjdElERSIsInQzIiwicmVkdWNlIiwiX3RlbXAiLCJpZGVDb3VudHMiLCJ0NCIsInQ1IiwiaWRlXzEiLCJoYXNNdWx0aXBsZUluc3RhbmNlcyIsIm5hbWUiLCJzaG93V29ya3NwYWNlIiwid29ya3NwYWNlRm9sZGVycyIsImxlbmd0aCIsImxhYmVsIiwiZGVzY3JpcHRpb24iLCJmb3JtYXRXb3Jrc3BhY2VGb2xkZXJzIiwidW5kZWZpbmVkIiwibWFwIiwiY29uY2F0Iiwib3B0aW9ucyIsInQ2IiwidmFsdWVfMCIsInQ3Iiwic29tZSIsIl90ZW1wMiIsInQ4IiwidDkiLCJfdGVtcDMiLCJ0MTAiLCJ0MTEiLCJpZGVfMyIsImluZGV4IiwiaWRlXzIiLCJhY2MiLCJpZGVfMCIsImZpbmRDdXJyZW50SURFIiwiZHluYW1pY01jcENvbmZpZyIsIlJlY29yZCIsIlByb21pc2UiLCJjdXJyZW50Q29uZmlnIiwidHlwZSIsInVybCIsIklERU9wZW5TZWxlY3Rpb25Qcm9wcyIsIm9uU2VsZWN0SURFIiwib25Eb25lIiwicmVzdWx0IiwiZGlzcGxheSIsIklERU9wZW5TZWxlY3Rpb24iLCJfdGVtcDQiLCJoYW5kbGVDYW5jZWwiLCJSdW5uaW5nSURFU2VsZWN0b3IiLCJydW5uaW5nSURFcyIsIl90ZW1wNSIsIkluc3RhbGxPbk1vdW50Iiwib25JbnN0YWxsIiwiY2FsbCIsImNvbnRleHQiLCJhcmdzIiwiUmVhY3ROb2RlIiwib25DaGFuZ2VEeW5hbWljTWNwQ29uZmlnIiwidHJpbSIsIndvcmt0cmVlU2Vzc2lvbiIsInRhcmdldFBhdGgiLCJ3b3JrdHJlZVBhdGgiLCJkZXRlY3RlZElERXMiLCJmaWx0ZXIiLCJpc1ZhbGlkIiwidG9Mb3dlckNhc2UiLCJpbmNsdWRlcyIsImNvZGUiLCJib2xkIiwib25JbnN0YWxsSURFRXh0ZW5zaW9uIiwiY3VycmVudElERSIsIklERV9DT05ORUNUSU9OX1RJTUVPVVRfTVMiLCJJREVDb21tYW5kRmxvd1Byb3BzIiwiY29uZmlnIiwiSURFQ29tbWFuZEZsb3ciLCJjb25uZWN0aW5nSURFIiwic2V0Q29ubmVjdGluZ0lERSIsImlkZUNsaWVudCIsInMiLCJtY3AiLCJjbGllbnRzIiwiYyIsInNldEFwcFN0YXRlIiwiaXNGaXJzdENoZWNrUmVmIiwiY3VycmVudCIsInRpbWVyIiwic2V0VGltZW91dCIsImNsZWFyVGltZW91dCIsIm5ld0NvbmZpZyIsImNsaWVudCIsIm9uY2xvc2UiLCJwcmV2IiwidG9vbHMiLCJ0Iiwic3RhcnRzV2l0aCIsImNvbW1hbmRzIiwiaWRlTmFtZSIsImF1dGhUb2tlbiIsImlkZVJ1bm5pbmdJbldpbmRvd3MiLCJzY29wZSIsImNvbnN0IiwiZm9sZGVycyIsIm1heExlbmd0aCIsImN3ZCIsImZvbGRlcnNUb1Nob3ciLCJzbGljZSIsImhhc01vcmUiLCJlbGxpcHNpc092ZXJoZWFkIiwic2VwYXJhdG9yT3ZlcmhlYWQiLCJhdmFpbGFibGVMZW5ndGgiLCJtYXhMZW5ndGhQZXJQYXRoIiwiTWF0aCIsImZsb29yIiwiY3dkTkZDIiwibm9ybWFsaXplIiwiZm9ybWF0dGVkRm9sZGVycyIsImZvbGRlciIsImZvbGRlck5GQyIsInNlcCIsImpvaW4iXSwic291cmNlcyI6WyJpZGUudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBjaGFsayBmcm9tICdjaGFsaydcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCBSZWFjdCwgeyB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VSZWYsIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyBsb2dFdmVudCB9IGZyb20gJ3NyYy9zZXJ2aWNlcy9hbmFseXRpY3MvaW5kZXguanMnXG5pbXBvcnQgdHlwZSB7XG4gIENvbW1hbmRSZXN1bHREaXNwbGF5LFxuICBMb2NhbEpTWENvbW1hbmRDb250ZXh0LFxufSBmcm9tICcuLi8uLi9jb21tYW5kcy5qcydcbmltcG9ydCB7IFNlbGVjdCB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvQ3VzdG9tU2VsZWN0L2luZGV4LmpzJ1xuaW1wb3J0IHsgRGlhbG9nIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9kZXNpZ24tc3lzdGVtL0RpYWxvZy5qcydcbmltcG9ydCB7XG4gIElkZUF1dG9Db25uZWN0RGlhbG9nLFxuICBJZGVEaXNhYmxlQXV0b0Nvbm5lY3REaWFsb2csXG4gIHNob3VsZFNob3dBdXRvQ29ubmVjdERpYWxvZyxcbiAgc2hvdWxkU2hvd0Rpc2FibGVBdXRvQ29ubmVjdERpYWxvZyxcbn0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9JZGVBdXRvQ29ubmVjdERpYWxvZy5qcydcbmltcG9ydCB7IEJveCwgVGV4dCB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7IGNsZWFyU2VydmVyQ2FjaGUgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tY3AvY2xpZW50LmpzJ1xuaW1wb3J0IHR5cGUgeyBTY29wZWRNY3BTZXJ2ZXJDb25maWcgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tY3AvdHlwZXMuanMnXG5pbXBvcnQgeyB1c2VBcHBTdGF0ZSwgdXNlU2V0QXBwU3RhdGUgfSBmcm9tICcuLi8uLi9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB7IGdldEN3ZCB9IGZyb20gJy4uLy4uL3V0aWxzL2N3ZC5qcydcbmltcG9ydCB7IGV4ZWNGaWxlTm9UaHJvdyB9IGZyb20gJy4uLy4uL3V0aWxzL2V4ZWNGaWxlTm9UaHJvdy5qcydcbmltcG9ydCB7XG4gIHR5cGUgRGV0ZWN0ZWRJREVJbmZvLFxuICBkZXRlY3RJREVzLFxuICBkZXRlY3RSdW5uaW5nSURFcyxcbiAgdHlwZSBJZGVUeXBlLFxuICBpc0pldEJyYWluc0lkZSxcbiAgaXNTdXBwb3J0ZWRKZXRCcmFpbnNUZXJtaW5hbCxcbiAgaXNTdXBwb3J0ZWRUZXJtaW5hbCxcbiAgdG9JREVEaXNwbGF5TmFtZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvaWRlLmpzJ1xuaW1wb3J0IHsgZ2V0Q3VycmVudFdvcmt0cmVlU2Vzc2lvbiB9IGZyb20gJy4uLy4uL3V0aWxzL3dvcmt0cmVlLmpzJ1xuXG50eXBlIElERVNjcmVlblByb3BzID0ge1xuICBhdmFpbGFibGVJREVzOiBEZXRlY3RlZElERUluZm9bXVxuICB1bmF2YWlsYWJsZUlERXM6IERldGVjdGVkSURFSW5mb1tdXG4gIHNlbGVjdGVkSURFPzogRGV0ZWN0ZWRJREVJbmZvIHwgbnVsbFxuICBvbkNsb3NlOiAoKSA9PiB2b2lkXG4gIG9uU2VsZWN0OiAoaWRlPzogRGV0ZWN0ZWRJREVJbmZvKSA9PiB2b2lkXG59XG5cbmZ1bmN0aW9uIElERVNjcmVlbih7XG4gIGF2YWlsYWJsZUlERXMsXG4gIHVuYXZhaWxhYmxlSURFcyxcbiAgc2VsZWN0ZWRJREUsXG4gIG9uQ2xvc2UsXG4gIG9uU2VsZWN0LFxufTogSURFU2NyZWVuUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbc2VsZWN0ZWRWYWx1ZSwgc2V0U2VsZWN0ZWRWYWx1ZV0gPSB1c2VTdGF0ZShcbiAgICBzZWxlY3RlZElERT8ucG9ydD8udG9TdHJpbmcoKSA/PyAnTm9uZScsXG4gIClcbiAgY29uc3QgW3Nob3dBdXRvQ29ubmVjdERpYWxvZywgc2V0U2hvd0F1dG9Db25uZWN0RGlhbG9nXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbc2hvd0Rpc2FibGVBdXRvQ29ubmVjdERpYWxvZywgc2V0U2hvd0Rpc2FibGVBdXRvQ29ubmVjdERpYWxvZ10gPVxuICAgIHVzZVN0YXRlKGZhbHNlKVxuXG4gIGNvbnN0IGhhbmRsZVNlbGVjdElERSA9IHVzZUNhbGxiYWNrKFxuICAgICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgICBpZiAodmFsdWUgIT09ICdOb25lJyAmJiBzaG91bGRTaG93QXV0b0Nvbm5lY3REaWFsb2coKSkge1xuICAgICAgICBzZXRTaG93QXV0b0Nvbm5lY3REaWFsb2codHJ1ZSlcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09ICdOb25lJyAmJiBzaG91bGRTaG93RGlzYWJsZUF1dG9Db25uZWN0RGlhbG9nKCkpIHtcbiAgICAgICAgc2V0U2hvd0Rpc2FibGVBdXRvQ29ubmVjdERpYWxvZyh0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb25TZWxlY3QoYXZhaWxhYmxlSURFcy5maW5kKGlkZSA9PiBpZGUucG9ydCA9PT0gcGFyc2VJbnQodmFsdWUpKSlcbiAgICAgIH1cbiAgICB9LFxuICAgIFthdmFpbGFibGVJREVzLCBvblNlbGVjdF0sXG4gIClcblxuICBjb25zdCBpZGVDb3VudHMgPSBhdmFpbGFibGVJREVzLnJlZHVjZTxSZWNvcmQ8c3RyaW5nLCBudW1iZXI+PigoYWNjLCBpZGUpID0+IHtcbiAgICBhY2NbaWRlLm5hbWVdID0gKGFjY1tpZGUubmFtZV0gfHwgMCkgKyAxXG4gICAgcmV0dXJuIGFjY1xuICB9LCB7fSlcblxuICBjb25zdCBvcHRpb25zID0gYXZhaWxhYmxlSURFc1xuICAgIC5tYXAoaWRlID0+IHtcbiAgICAgIGNvbnN0IGhhc011bHRpcGxlSW5zdGFuY2VzID0gKGlkZUNvdW50c1tpZGUubmFtZV0gfHwgMCkgPiAxXG4gICAgICBjb25zdCBzaG93V29ya3NwYWNlID1cbiAgICAgICAgaGFzTXVsdGlwbGVJbnN0YW5jZXMgJiYgaWRlLndvcmtzcGFjZUZvbGRlcnMubGVuZ3RoID4gMFxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBsYWJlbDogaWRlLm5hbWUsXG4gICAgICAgIHZhbHVlOiBpZGUucG9ydC50b1N0cmluZygpLFxuICAgICAgICBkZXNjcmlwdGlvbjogc2hvd1dvcmtzcGFjZVxuICAgICAgICAgID8gZm9ybWF0V29ya3NwYWNlRm9sZGVycyhpZGUud29ya3NwYWNlRm9sZGVycylcbiAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIH1cbiAgICB9KVxuICAgIC5jb25jYXQoW3sgbGFiZWw6ICdOb25lJywgdmFsdWU6ICdOb25lJywgZGVzY3JpcHRpb246IHVuZGVmaW5lZCB9XSlcblxuICBpZiAoc2hvd0F1dG9Db25uZWN0RGlhbG9nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxJZGVBdXRvQ29ubmVjdERpYWxvZyBvbkNvbXBsZXRlPXsoKSA9PiBoYW5kbGVTZWxlY3RJREUoc2VsZWN0ZWRWYWx1ZSl9IC8+XG4gICAgKVxuICB9XG5cbiAgaWYgKHNob3dEaXNhYmxlQXV0b0Nvbm5lY3REaWFsb2cpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPElkZURpc2FibGVBdXRvQ29ubmVjdERpYWxvZ1xuICAgICAgICBvbkNvbXBsZXRlPXsoKSA9PiB7XG4gICAgICAgICAgLy8gQWx3YXlzIGRpc2Nvbm5lY3Qgd2hlbiB1c2VyIHNlbGVjdHMgXCJOb25lXCIsIHJlZ2FyZGxlc3Mgb2YgdGhlaXJcbiAgICAgICAgICAvLyBjaG9pY2UgYWJvdXQgZGlzYWJsaW5nIGF1dG8tY29ubmVjdFxuICAgICAgICAgIG9uU2VsZWN0KHVuZGVmaW5lZClcbiAgICAgICAgfX1cbiAgICAgIC8+XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8RGlhbG9nXG4gICAgICB0aXRsZT1cIlNlbGVjdCBJREVcIlxuICAgICAgc3VidGl0bGU9XCJDb25uZWN0IHRvIGFuIElERSBmb3IgaW50ZWdyYXRlZCBkZXZlbG9wbWVudCBmZWF0dXJlcy5cIlxuICAgICAgb25DYW5jZWw9e29uQ2xvc2V9XG4gICAgICBjb2xvcj1cImlkZVwiXG4gICAgPlxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIHthdmFpbGFibGVJREVzLmxlbmd0aCA9PT0gMCAmJiAoXG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICB7aXNTdXBwb3J0ZWRKZXRCcmFpbnNUZXJtaW5hbCgpXG4gICAgICAgICAgICAgID8gJ05vIGF2YWlsYWJsZSBJREVzIGRldGVjdGVkLiBQbGVhc2UgaW5zdGFsbCB0aGUgcGx1Z2luIGFuZCByZXN0YXJ0IHlvdXIgSURFOlxcbicgK1xuICAgICAgICAgICAgICAgICdodHRwczovL2RvY3MuY2xhdWRlLmNvbS9zL2NsYXVkZS1jb2RlLWpldGJyYWlucydcbiAgICAgICAgICAgICAgOiAnTm8gYXZhaWxhYmxlIElERXMgZGV0ZWN0ZWQuIE1ha2Ugc3VyZSB5b3VyIElERSBoYXMgdGhlIENsYXVkZSBDb2RlIGV4dGVuc2lvbiBvciBwbHVnaW4gaW5zdGFsbGVkIGFuZCBpcyBydW5uaW5nLid9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICApfVxuXG4gICAgICAgIHthdmFpbGFibGVJREVzLmxlbmd0aCAhPT0gMCAmJiAoXG4gICAgICAgICAgPFNlbGVjdFxuICAgICAgICAgICAgZGVmYXVsdFZhbHVlPXtzZWxlY3RlZFZhbHVlfVxuICAgICAgICAgICAgZGVmYXVsdEZvY3VzVmFsdWU9e3NlbGVjdGVkVmFsdWV9XG4gICAgICAgICAgICBvcHRpb25zPXtvcHRpb25zfVxuICAgICAgICAgICAgb25DaGFuZ2U9e3ZhbHVlID0+IHtcbiAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRWYWx1ZSh2YWx1ZSlcbiAgICAgICAgICAgICAgaGFuZGxlU2VsZWN0SURFKHZhbHVlKVxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAvPlxuICAgICAgICApfVxuICAgICAgICB7YXZhaWxhYmxlSURFcy5sZW5ndGggIT09IDAgJiZcbiAgICAgICAgICBhdmFpbGFibGVJREVzLnNvbWUoXG4gICAgICAgICAgICBpZGUgPT4gaWRlLm5hbWUgPT09ICdWUyBDb2RlJyB8fCBpZGUubmFtZSA9PT0gJ1Zpc3VhbCBTdHVkaW8gQ29kZScsXG4gICAgICAgICAgKSAmJiAoXG4gICAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgICAgICAgIE5vdGU6IE9ubHkgb25lIENsYXVkZSBDb2RlIGluc3RhbmNlIGNhbiBiZSBjb25uZWN0ZWQgdG8gVlMgQ29kZVxuICAgICAgICAgICAgICAgIGF0IGEgdGltZS5cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cbiAgICAgICAge2F2YWlsYWJsZUlERXMubGVuZ3RoICE9PSAwICYmICFpc1N1cHBvcnRlZFRlcm1pbmFsKCkgJiYgKFxuICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICBUaXA6IFlvdSBjYW4gZW5hYmxlIGF1dG8tY29ubmVjdCB0byBJREUgaW4gL2NvbmZpZyBvciB3aXRoIHRoZVxuICAgICAgICAgICAgICAtLWlkZSBmbGFnXG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAge3VuYXZhaWxhYmxlSURFcy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIEZvdW5kIHt1bmF2YWlsYWJsZUlERXMubGVuZ3RofSBvdGhlciBydW5uaW5nIElERShzKS4gSG93ZXZlcixcbiAgICAgICAgICAgICAgdGhlaXIgd29ya3NwYWNlL3Byb2plY3QgZGlyZWN0b3JpZXMgZG8gbm90IG1hdGNoIHRoZSBjdXJyZW50IGN3ZC5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICAgIHt1bmF2YWlsYWJsZUlERXMubWFwKChpZGUsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICAgICAgPEJveCBrZXk9e2luZGV4fSBwYWRkaW5nTGVmdD17M30+XG4gICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAg4oCiIHtpZGUubmFtZX06IHtmb3JtYXRXb3Jrc3BhY2VGb2xkZXJzKGlkZS53b3Jrc3BhY2VGb2xkZXJzKX1cbiAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgIDwvQm94PlxuICAgIDwvRGlhbG9nPlxuICApXG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZpbmRDdXJyZW50SURFKFxuICBhdmFpbGFibGVJREVzOiBEZXRlY3RlZElERUluZm9bXSxcbiAgZHluYW1pY01jcENvbmZpZz86IFJlY29yZDxzdHJpbmcsIFNjb3BlZE1jcFNlcnZlckNvbmZpZz4sXG4pOiBQcm9taXNlPERldGVjdGVkSURFSW5mbyB8IG51bGw+IHtcbiAgY29uc3QgY3VycmVudENvbmZpZyA9IGR5bmFtaWNNY3BDb25maWc/LmlkZVxuICBpZiAoXG4gICAgIWN1cnJlbnRDb25maWcgfHxcbiAgICAoY3VycmVudENvbmZpZy50eXBlICE9PSAnc3NlLWlkZScgJiYgY3VycmVudENvbmZpZy50eXBlICE9PSAnd3MtaWRlJylcbiAgKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuICBmb3IgKGNvbnN0IGlkZSBvZiBhdmFpbGFibGVJREVzKSB7XG4gICAgaWYgKGlkZS51cmwgPT09IGN1cnJlbnRDb25maWcudXJsKSB7XG4gICAgICByZXR1cm4gaWRlXG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsXG59XG5cbnR5cGUgSURFT3BlblNlbGVjdGlvblByb3BzID0ge1xuICBhdmFpbGFibGVJREVzOiBEZXRlY3RlZElERUluZm9bXVxuICBvblNlbGVjdElERTogKGlkZT86IERldGVjdGVkSURFSW5mbykgPT4gdm9pZFxuICBvbkRvbmU6IChcbiAgICByZXN1bHQ/OiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IHsgZGlzcGxheT86IENvbW1hbmRSZXN1bHREaXNwbGF5IH0sXG4gICkgPT4gdm9pZFxufVxuXG5mdW5jdGlvbiBJREVPcGVuU2VsZWN0aW9uKHtcbiAgYXZhaWxhYmxlSURFcyxcbiAgb25TZWxlY3RJREUsXG4gIG9uRG9uZSxcbn06IElERU9wZW5TZWxlY3Rpb25Qcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFtzZWxlY3RlZFZhbHVlLCBzZXRTZWxlY3RlZFZhbHVlXSA9IHVzZVN0YXRlKFxuICAgIGF2YWlsYWJsZUlERXNbMF0/LnBvcnQ/LnRvU3RyaW5nKCkgPz8gJycsXG4gIClcblxuICBjb25zdCBoYW5kbGVTZWxlY3RJREUgPSB1c2VDYWxsYmFjayhcbiAgICAodmFsdWU6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3Qgc2VsZWN0ZWRJREUgPSBhdmFpbGFibGVJREVzLmZpbmQoXG4gICAgICAgIGlkZSA9PiBpZGUucG9ydCA9PT0gcGFyc2VJbnQodmFsdWUpLFxuICAgICAgKVxuICAgICAgb25TZWxlY3RJREUoc2VsZWN0ZWRJREUpXG4gICAgfSxcbiAgICBbYXZhaWxhYmxlSURFcywgb25TZWxlY3RJREVdLFxuICApXG5cbiAgY29uc3Qgb3B0aW9ucyA9IGF2YWlsYWJsZUlERXMubWFwKGlkZSA9PiAoe1xuICAgIGxhYmVsOiBpZGUubmFtZSxcbiAgICB2YWx1ZTogaWRlLnBvcnQudG9TdHJpbmcoKSxcbiAgfSkpXG5cbiAgZnVuY3Rpb24gaGFuZGxlQ2FuY2VsKCk6IHZvaWQge1xuICAgIG9uRG9uZSgnSURFIHNlbGVjdGlvbiBjYW5jZWxsZWQnLCB7IGRpc3BsYXk6ICdzeXN0ZW0nIH0pXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxEaWFsb2dcbiAgICAgIHRpdGxlPVwiU2VsZWN0IGFuIElERSB0byBvcGVuIHRoZSBwcm9qZWN0XCJcbiAgICAgIG9uQ2FuY2VsPXtoYW5kbGVDYW5jZWx9XG4gICAgICBjb2xvcj1cImlkZVwiXG4gICAgPlxuICAgICAgPFNlbGVjdFxuICAgICAgICBkZWZhdWx0VmFsdWU9e3NlbGVjdGVkVmFsdWV9XG4gICAgICAgIGRlZmF1bHRGb2N1c1ZhbHVlPXtzZWxlY3RlZFZhbHVlfVxuICAgICAgICBvcHRpb25zPXtvcHRpb25zfVxuICAgICAgICBvbkNoYW5nZT17dmFsdWUgPT4ge1xuICAgICAgICAgIHNldFNlbGVjdGVkVmFsdWUodmFsdWUpXG4gICAgICAgICAgaGFuZGxlU2VsZWN0SURFKHZhbHVlKVxuICAgICAgICB9fVxuICAgICAgLz5cbiAgICA8L0RpYWxvZz5cbiAgKVxufVxuXG5mdW5jdGlvbiBSdW5uaW5nSURFU2VsZWN0b3Ioe1xuICBydW5uaW5nSURFcyxcbiAgb25TZWxlY3RJREUsXG4gIG9uRG9uZSxcbn06IHtcbiAgcnVubmluZ0lERXM6IElkZVR5cGVbXVxuICBvblNlbGVjdElERTogKGlkZTogSWRlVHlwZSkgPT4gdm9pZFxuICBvbkRvbmU6IChcbiAgICByZXN1bHQ/OiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IHsgZGlzcGxheT86IENvbW1hbmRSZXN1bHREaXNwbGF5IH0sXG4gICkgPT4gdm9pZFxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFtzZWxlY3RlZFZhbHVlLCBzZXRTZWxlY3RlZFZhbHVlXSA9IHVzZVN0YXRlKHJ1bm5pbmdJREVzWzBdID8/ICcnKVxuXG4gIGNvbnN0IGhhbmRsZVNlbGVjdElERSA9IHVzZUNhbGxiYWNrKFxuICAgICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgICBvblNlbGVjdElERSh2YWx1ZSBhcyBJZGVUeXBlKVxuICAgIH0sXG4gICAgW29uU2VsZWN0SURFXSxcbiAgKVxuXG4gIGNvbnN0IG9wdGlvbnMgPSBydW5uaW5nSURFcy5tYXAoaWRlID0+ICh7XG4gICAgbGFiZWw6IHRvSURFRGlzcGxheU5hbWUoaWRlKSxcbiAgICB2YWx1ZTogaWRlLFxuICB9KSlcblxuICBmdW5jdGlvbiBoYW5kbGVDYW5jZWwoKTogdm9pZCB7XG4gICAgb25Eb25lKCdJREUgc2VsZWN0aW9uIGNhbmNlbGxlZCcsIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPERpYWxvZ1xuICAgICAgdGl0bGU9XCJTZWxlY3QgSURFIHRvIGluc3RhbGwgZXh0ZW5zaW9uXCJcbiAgICAgIG9uQ2FuY2VsPXtoYW5kbGVDYW5jZWx9XG4gICAgICBjb2xvcj1cImlkZVwiXG4gICAgPlxuICAgICAgPFNlbGVjdFxuICAgICAgICBkZWZhdWx0Rm9jdXNWYWx1ZT17c2VsZWN0ZWRWYWx1ZX1cbiAgICAgICAgb3B0aW9ucz17b3B0aW9uc31cbiAgICAgICAgb25DaGFuZ2U9e3ZhbHVlID0+IHtcbiAgICAgICAgICBzZXRTZWxlY3RlZFZhbHVlKHZhbHVlKVxuICAgICAgICAgIGhhbmRsZVNlbGVjdElERSh2YWx1ZSlcbiAgICAgICAgfX1cbiAgICAgIC8+XG4gICAgPC9EaWFsb2c+XG4gIClcbn1cblxuZnVuY3Rpb24gSW5zdGFsbE9uTW91bnQoe1xuICBpZGUsXG4gIG9uSW5zdGFsbCxcbn06IHtcbiAgaWRlOiBJZGVUeXBlXG4gIG9uSW5zdGFsbDogKGlkZTogSWRlVHlwZSkgPT4gdm9pZFxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgb25JbnN0YWxsKGlkZSlcbiAgfSwgW2lkZSwgb25JbnN0YWxsXSlcbiAgcmV0dXJuIG51bGxcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNhbGwoXG4gIG9uRG9uZTogKFxuICAgIHJlc3VsdD86IHN0cmluZyxcbiAgICBvcHRpb25zPzogeyBkaXNwbGF5PzogQ29tbWFuZFJlc3VsdERpc3BsYXkgfSxcbiAgKSA9PiB2b2lkLFxuICBjb250ZXh0OiBMb2NhbEpTWENvbW1hbmRDb250ZXh0LFxuICBhcmdzOiBzdHJpbmcsXG4pOiBQcm9taXNlPFJlYWN0LlJlYWN0Tm9kZSB8IG51bGw+IHtcbiAgbG9nRXZlbnQoJ3Rlbmd1X2V4dF9pZGVfY29tbWFuZCcsIHt9KVxuICBjb25zdCB7XG4gICAgb3B0aW9uczogeyBkeW5hbWljTWNwQ29uZmlnIH0sXG4gICAgb25DaGFuZ2VEeW5hbWljTWNwQ29uZmlnLFxuICB9ID0gY29udGV4dFxuXG4gIC8vIEhhbmRsZSAnb3BlbicgYXJndW1lbnRcbiAgaWYgKGFyZ3M/LnRyaW0oKSA9PT0gJ29wZW4nKSB7XG4gICAgY29uc3Qgd29ya3RyZWVTZXNzaW9uID0gZ2V0Q3VycmVudFdvcmt0cmVlU2Vzc2lvbigpXG4gICAgY29uc3QgdGFyZ2V0UGF0aCA9IHdvcmt0cmVlU2Vzc2lvbiA/IHdvcmt0cmVlU2Vzc2lvbi53b3JrdHJlZVBhdGggOiBnZXRDd2QoKVxuXG4gICAgLy8gRGV0ZWN0IGF2YWlsYWJsZSBJREVzXG4gICAgY29uc3QgZGV0ZWN0ZWRJREVzID0gYXdhaXQgZGV0ZWN0SURFcyh0cnVlKVxuICAgIGNvbnN0IGF2YWlsYWJsZUlERXMgPSBkZXRlY3RlZElERXMuZmlsdGVyKGlkZSA9PiBpZGUuaXNWYWxpZClcblxuICAgIGlmIChhdmFpbGFibGVJREVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgb25Eb25lKCdObyBJREVzIHdpdGggQ2xhdWRlIENvZGUgZXh0ZW5zaW9uIGRldGVjdGVkLicpXG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIC8vIFJldHVybiBJREUgc2VsZWN0aW9uIGNvbXBvbmVudFxuICAgIHJldHVybiAoXG4gICAgICA8SURFT3BlblNlbGVjdGlvblxuICAgICAgICBhdmFpbGFibGVJREVzPXthdmFpbGFibGVJREVzfVxuICAgICAgICBvblNlbGVjdElERT17YXN5bmMgKHNlbGVjdGVkSURFPzogRGV0ZWN0ZWRJREVJbmZvKSA9PiB7XG4gICAgICAgICAgaWYgKCFzZWxlY3RlZElERSkge1xuICAgICAgICAgICAgb25Eb25lKCdObyBJREUgc2VsZWN0ZWQuJylcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRyeSB0byBvcGVuIHRoZSBwcm9qZWN0IGluIHRoZSBzZWxlY3RlZCBJREVcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBzZWxlY3RlZElERS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3ZzY29kZScpIHx8XG4gICAgICAgICAgICBzZWxlY3RlZElERS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2N1cnNvcicpIHx8XG4gICAgICAgICAgICBzZWxlY3RlZElERS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3dpbmRzdXJmJylcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIFZTIENvZGUtYmFzZWQgSURFc1xuICAgICAgICAgICAgY29uc3QgeyBjb2RlIH0gPSBhd2FpdCBleGVjRmlsZU5vVGhyb3coJ2NvZGUnLCBbdGFyZ2V0UGF0aF0pXG4gICAgICAgICAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgICAgICAgICBvbkRvbmUoXG4gICAgICAgICAgICAgICAgYE9wZW5lZCAke3dvcmt0cmVlU2Vzc2lvbiA/ICd3b3JrdHJlZScgOiAncHJvamVjdCd9IGluICR7Y2hhbGsuYm9sZChzZWxlY3RlZElERS5uYW1lKX1gLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvbkRvbmUoXG4gICAgICAgICAgICAgICAgYEZhaWxlZCB0byBvcGVuIGluICR7c2VsZWN0ZWRJREUubmFtZX0uIFRyeSBvcGVuaW5nIG1hbnVhbGx5OiAke3RhcmdldFBhdGh9YCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoaXNTdXBwb3J0ZWRKZXRCcmFpbnNUZXJtaW5hbCgpKSB7XG4gICAgICAgICAgICAvLyBKZXRCcmFpbnMgSURFcyAtIHRoZXkgdXN1YWxseSBvcGVuIHZpYSB0aGVpciBDTEkgdG9vbHNcbiAgICAgICAgICAgIG9uRG9uZShcbiAgICAgICAgICAgICAgYFBsZWFzZSBvcGVuIHRoZSAke3dvcmt0cmVlU2Vzc2lvbiA/ICd3b3JrdHJlZScgOiAncHJvamVjdCd9IG1hbnVhbGx5IGluICR7Y2hhbGsuYm9sZChzZWxlY3RlZElERS5uYW1lKX06ICR7dGFyZ2V0UGF0aH1gLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvbkRvbmUoXG4gICAgICAgICAgICAgIGBQbGVhc2Ugb3BlbiB0aGUgJHt3b3JrdHJlZVNlc3Npb24gPyAnd29ya3RyZWUnIDogJ3Byb2plY3QnfSBtYW51YWxseSBpbiAke2NoYWxrLmJvbGQoc2VsZWN0ZWRJREUubmFtZSl9OiAke3RhcmdldFBhdGh9YCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgIH19XG4gICAgICAgIG9uRG9uZT17KCkgPT4ge1xuICAgICAgICAgIG9uRG9uZSgnRXhpdGVkIHdpdGhvdXQgb3BlbmluZyBJREUnLCB7IGRpc3BsYXk6ICdzeXN0ZW0nIH0pXG4gICAgICAgIH19XG4gICAgICAvPlxuICAgIClcbiAgfVxuXG4gIGNvbnN0IGRldGVjdGVkSURFcyA9IGF3YWl0IGRldGVjdElERXModHJ1ZSlcblxuICAvLyBJZiBubyBJREVzIHdpdGggZXh0ZW5zaW9ucyBkZXRlY3RlZCwgY2hlY2sgZm9yIHJ1bm5pbmcgSURFcyBhbmQgb2ZmZXIgdG8gaW5zdGFsbFxuICBpZiAoXG4gICAgZGV0ZWN0ZWRJREVzLmxlbmd0aCA9PT0gMCAmJlxuICAgIGNvbnRleHQub25JbnN0YWxsSURFRXh0ZW5zaW9uICYmXG4gICAgIWlzU3VwcG9ydGVkVGVybWluYWwoKVxuICApIHtcbiAgICBjb25zdCBydW5uaW5nSURFcyA9IGF3YWl0IGRldGVjdFJ1bm5pbmdJREVzKClcblxuICAgIGNvbnN0IG9uSW5zdGFsbCA9IChpZGU6IElkZVR5cGUpID0+IHtcbiAgICAgIGlmIChjb250ZXh0Lm9uSW5zdGFsbElERUV4dGVuc2lvbikge1xuICAgICAgICBjb250ZXh0Lm9uSW5zdGFsbElERUV4dGVuc2lvbihpZGUpXG4gICAgICAgIC8vIFRoZSBjb21wbGV0aW9uIG1lc3NhZ2Ugd2lsbCBiZSBzaG93biBhZnRlciBpbnN0YWxsYXRpb25cbiAgICAgICAgaWYgKGlzSmV0QnJhaW5zSWRlKGlkZSkpIHtcbiAgICAgICAgICBvbkRvbmUoXG4gICAgICAgICAgICBgSW5zdGFsbGVkIHBsdWdpbiB0byAke2NoYWxrLmJvbGQodG9JREVEaXNwbGF5TmFtZShpZGUpKX1cXG5gICtcbiAgICAgICAgICAgICAgYFBsZWFzZSAke2NoYWxrLmJvbGQoJ3Jlc3RhcnQgeW91ciBJREUnKX0gY29tcGxldGVseSBmb3IgaXQgdG8gdGFrZSBlZmZlY3RgLFxuICAgICAgICAgIClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvbkRvbmUoYEluc3RhbGxlZCBleHRlbnNpb24gdG8gJHtjaGFsay5ib2xkKHRvSURFRGlzcGxheU5hbWUoaWRlKSl9YClcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChydW5uaW5nSURFcy5sZW5ndGggPiAxKSB7XG4gICAgICAvLyBTaG93IHNlbGVjdG9yIHdoZW4gbXVsdGlwbGUgSURFcyBhcmUgcnVubmluZ1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPFJ1bm5pbmdJREVTZWxlY3RvclxuICAgICAgICAgIHJ1bm5pbmdJREVzPXtydW5uaW5nSURFc31cbiAgICAgICAgICBvblNlbGVjdElERT17b25JbnN0YWxsfVxuICAgICAgICAgIG9uRG9uZT17KCkgPT4ge1xuICAgICAgICAgICAgb25Eb25lKCdObyBJREUgc2VsZWN0ZWQuJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICAgICAgICAgIH19XG4gICAgICAgIC8+XG4gICAgICApXG4gICAgfSBlbHNlIGlmIChydW5uaW5nSURFcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJldHVybiA8SW5zdGFsbE9uTW91bnQgaWRlPXtydW5uaW5nSURFc1swXSF9IG9uSW5zdGFsbD17b25JbnN0YWxsfSAvPlxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGF2YWlsYWJsZUlERXMgPSBkZXRlY3RlZElERXMuZmlsdGVyKGlkZSA9PiBpZGUuaXNWYWxpZClcbiAgY29uc3QgdW5hdmFpbGFibGVJREVzID0gZGV0ZWN0ZWRJREVzLmZpbHRlcihpZGUgPT4gIWlkZS5pc1ZhbGlkKVxuXG4gIGNvbnN0IGN1cnJlbnRJREUgPSBhd2FpdCBmaW5kQ3VycmVudElERShhdmFpbGFibGVJREVzLCBkeW5hbWljTWNwQ29uZmlnKVxuXG4gIHJldHVybiAoXG4gICAgPElERUNvbW1hbmRGbG93XG4gICAgICBhdmFpbGFibGVJREVzPXthdmFpbGFibGVJREVzfVxuICAgICAgdW5hdmFpbGFibGVJREVzPXt1bmF2YWlsYWJsZUlERXN9XG4gICAgICBjdXJyZW50SURFPXtjdXJyZW50SURFfVxuICAgICAgZHluYW1pY01jcENvbmZpZz17ZHluYW1pY01jcENvbmZpZ31cbiAgICAgIG9uQ2hhbmdlRHluYW1pY01jcENvbmZpZz17b25DaGFuZ2VEeW5hbWljTWNwQ29uZmlnfVxuICAgICAgb25Eb25lPXtvbkRvbmV9XG4gICAgLz5cbiAgKVxufVxuXG4vLyBDb25uZWN0aW9uIHRpbWVvdXQgc2xpZ2h0bHkgbG9uZ2VyIHRoYW4gdGhlIDMwcyBNQ1AgY29ubmVjdGlvbiB0aW1lb3V0XG5jb25zdCBJREVfQ09OTkVDVElPTl9USU1FT1VUX01TID0gMzUwMDBcblxudHlwZSBJREVDb21tYW5kRmxvd1Byb3BzID0ge1xuICBhdmFpbGFibGVJREVzOiBEZXRlY3RlZElERUluZm9bXVxuICB1bmF2YWlsYWJsZUlERXM6IERldGVjdGVkSURFSW5mb1tdXG4gIGN1cnJlbnRJREU6IERldGVjdGVkSURFSW5mbyB8IG51bGxcbiAgZHluYW1pY01jcENvbmZpZz86IFJlY29yZDxzdHJpbmcsIFNjb3BlZE1jcFNlcnZlckNvbmZpZz5cbiAgb25DaGFuZ2VEeW5hbWljTWNwQ29uZmlnPzogKFxuICAgIGNvbmZpZzogUmVjb3JkPHN0cmluZywgU2NvcGVkTWNwU2VydmVyQ29uZmlnPixcbiAgKSA9PiB2b2lkXG4gIG9uRG9uZTogKFxuICAgIHJlc3VsdD86IHN0cmluZyxcbiAgICBvcHRpb25zPzogeyBkaXNwbGF5PzogQ29tbWFuZFJlc3VsdERpc3BsYXkgfSxcbiAgKSA9PiB2b2lkXG59XG5cbmZ1bmN0aW9uIElERUNvbW1hbmRGbG93KHtcbiAgYXZhaWxhYmxlSURFcyxcbiAgdW5hdmFpbGFibGVJREVzLFxuICBjdXJyZW50SURFLFxuICBkeW5hbWljTWNwQ29uZmlnLFxuICBvbkNoYW5nZUR5bmFtaWNNY3BDb25maWcsXG4gIG9uRG9uZSxcbn06IElERUNvbW1hbmRGbG93UHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbY29ubmVjdGluZ0lERSwgc2V0Q29ubmVjdGluZ0lERV0gPSB1c2VTdGF0ZTxEZXRlY3RlZElERUluZm8gfCBudWxsPihcbiAgICBudWxsLFxuICApXG4gIGNvbnN0IGlkZUNsaWVudCA9IHVzZUFwcFN0YXRlKHMgPT4gcy5tY3AuY2xpZW50cy5maW5kKGMgPT4gYy5uYW1lID09PSAnaWRlJykpXG4gIGNvbnN0IHNldEFwcFN0YXRlID0gdXNlU2V0QXBwU3RhdGUoKVxuICBjb25zdCBpc0ZpcnN0Q2hlY2tSZWYgPSB1c2VSZWYodHJ1ZSlcblxuICAvLyBXYXRjaCBmb3IgY29ubmVjdGlvbiByZXN1bHRcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWNvbm5lY3RpbmdJREUpIHJldHVyblxuICAgIC8vIFNraXAgdGhlIGZpcnN0IGNoZWNrIOKAlCBpdCByZWZsZWN0cyBzdGFsZSBzdGF0ZSBmcm9tIGJlZm9yZSB0aGVcbiAgICAvLyBjb25maWcgY2hhbmdlIHdhcyBkaXNwYXRjaGVkXG4gICAgaWYgKGlzRmlyc3RDaGVja1JlZi5jdXJyZW50KSB7XG4gICAgICBpc0ZpcnN0Q2hlY2tSZWYuY3VycmVudCA9IGZhbHNlXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgaWYgKCFpZGVDbGllbnQgfHwgaWRlQ2xpZW50LnR5cGUgPT09ICdwZW5kaW5nJykgcmV0dXJuXG4gICAgaWYgKGlkZUNsaWVudC50eXBlID09PSAnY29ubmVjdGVkJykge1xuICAgICAgb25Eb25lKGBDb25uZWN0ZWQgdG8gJHtjb25uZWN0aW5nSURFLm5hbWV9LmApXG4gICAgfSBlbHNlIGlmIChpZGVDbGllbnQudHlwZSA9PT0gJ2ZhaWxlZCcpIHtcbiAgICAgIG9uRG9uZShgRmFpbGVkIHRvIGNvbm5lY3QgdG8gJHtjb25uZWN0aW5nSURFLm5hbWV9LmApXG4gICAgfVxuICB9LCBbaWRlQ2xpZW50LCBjb25uZWN0aW5nSURFLCBvbkRvbmVdKVxuXG4gIC8vIFRpbWVvdXQgZmFsbGJhY2tcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWNvbm5lY3RpbmdJREUpIHJldHVyblxuICAgIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dChcbiAgICAgIG9uRG9uZSxcbiAgICAgIElERV9DT05ORUNUSU9OX1RJTUVPVVRfTVMsXG4gICAgICBgQ29ubmVjdGlvbiB0byAke2Nvbm5lY3RpbmdJREUubmFtZX0gdGltZWQgb3V0LmAsXG4gICAgKVxuICAgIHJldHVybiAoKSA9PiBjbGVhclRpbWVvdXQodGltZXIpXG4gIH0sIFtjb25uZWN0aW5nSURFLCBvbkRvbmVdKVxuXG4gIGNvbnN0IGhhbmRsZVNlbGVjdElERSA9IHVzZUNhbGxiYWNrKFxuICAgIChzZWxlY3RlZElERT86IERldGVjdGVkSURFSW5mbykgPT4ge1xuICAgICAgaWYgKCFvbkNoYW5nZUR5bmFtaWNNY3BDb25maWcpIHtcbiAgICAgICAgb25Eb25lKCdFcnJvciBjb25uZWN0aW5nIHRvIElERS4nKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGNvbnN0IG5ld0NvbmZpZyA9IHsgLi4uKGR5bmFtaWNNY3BDb25maWcgfHwge30pIH1cbiAgICAgIGlmIChjdXJyZW50SURFKSB7XG4gICAgICAgIGRlbGV0ZSBuZXdDb25maWcuaWRlXG4gICAgICB9XG4gICAgICBpZiAoIXNlbGVjdGVkSURFKSB7XG4gICAgICAgIC8vIENsb3NlIHRoZSBNQ1AgdHJhbnNwb3J0IGFuZCByZW1vdmUgdGhlIGNsaWVudCBmcm9tIHN0YXRlXG4gICAgICAgIGlmIChpZGVDbGllbnQgJiYgaWRlQ2xpZW50LnR5cGUgPT09ICdjb25uZWN0ZWQnICYmIGN1cnJlbnRJREUpIHtcbiAgICAgICAgICAvLyBOdWxsIG91dCBvbmNsb3NlIHRvIHByZXZlbnQgYXV0by1yZWNvbm5lY3Rpb25cbiAgICAgICAgICBpZGVDbGllbnQuY2xpZW50Lm9uY2xvc2UgPSAoKSA9PiB7fVxuICAgICAgICAgIHZvaWQgY2xlYXJTZXJ2ZXJDYWNoZSgnaWRlJywgaWRlQ2xpZW50LmNvbmZpZylcbiAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgbWNwOiB7XG4gICAgICAgICAgICAgIC4uLnByZXYubWNwLFxuICAgICAgICAgICAgICBjbGllbnRzOiBwcmV2Lm1jcC5jbGllbnRzLmZpbHRlcihjID0+IGMubmFtZSAhPT0gJ2lkZScpLFxuICAgICAgICAgICAgICB0b29sczogcHJldi5tY3AudG9vbHMuZmlsdGVyKFxuICAgICAgICAgICAgICAgIHQgPT4gIXQubmFtZT8uc3RhcnRzV2l0aCgnbWNwX19pZGVfXycpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICBjb21tYW5kczogcHJldi5tY3AuY29tbWFuZHMuZmlsdGVyKFxuICAgICAgICAgICAgICAgIGMgPT4gIWMubmFtZT8uc3RhcnRzV2l0aCgnbWNwX19pZGVfXycpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KSlcbiAgICAgICAgfVxuICAgICAgICBvbkNoYW5nZUR5bmFtaWNNY3BDb25maWcobmV3Q29uZmlnKVxuICAgICAgICBvbkRvbmUoXG4gICAgICAgICAgY3VycmVudElERVxuICAgICAgICAgICAgPyBgRGlzY29ubmVjdGVkIGZyb20gJHtjdXJyZW50SURFLm5hbWV9LmBcbiAgICAgICAgICAgIDogJ05vIElERSBzZWxlY3RlZC4nLFxuICAgICAgICApXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgY29uc3QgdXJsID0gc2VsZWN0ZWRJREUudXJsXG4gICAgICBuZXdDb25maWcuaWRlID0ge1xuICAgICAgICB0eXBlOiB1cmwuc3RhcnRzV2l0aCgnd3M6JykgPyAnd3MtaWRlJyA6ICdzc2UtaWRlJyxcbiAgICAgICAgdXJsOiB1cmwsXG4gICAgICAgIGlkZU5hbWU6IHNlbGVjdGVkSURFLm5hbWUsXG4gICAgICAgIGF1dGhUb2tlbjogc2VsZWN0ZWRJREUuYXV0aFRva2VuLFxuICAgICAgICBpZGVSdW5uaW5nSW5XaW5kb3dzOiBzZWxlY3RlZElERS5pZGVSdW5uaW5nSW5XaW5kb3dzLFxuICAgICAgICBzY29wZTogJ2R5bmFtaWMnIGFzIGNvbnN0LFxuICAgICAgfSBhcyBTY29wZWRNY3BTZXJ2ZXJDb25maWdcbiAgICAgIGlzRmlyc3RDaGVja1JlZi5jdXJyZW50ID0gdHJ1ZVxuICAgICAgc2V0Q29ubmVjdGluZ0lERShzZWxlY3RlZElERSlcbiAgICAgIG9uQ2hhbmdlRHluYW1pY01jcENvbmZpZyhuZXdDb25maWcpXG4gICAgfSxcbiAgICBbXG4gICAgICBkeW5hbWljTWNwQ29uZmlnLFxuICAgICAgY3VycmVudElERSxcbiAgICAgIGlkZUNsaWVudCxcbiAgICAgIHNldEFwcFN0YXRlLFxuICAgICAgb25DaGFuZ2VEeW5hbWljTWNwQ29uZmlnLFxuICAgICAgb25Eb25lLFxuICAgIF0sXG4gIClcblxuICBpZiAoY29ubmVjdGluZ0lERSkge1xuICAgIHJldHVybiA8VGV4dCBkaW1Db2xvcj5Db25uZWN0aW5nIHRvIHtjb25uZWN0aW5nSURFLm5hbWV94oCmPC9UZXh0PlxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8SURFU2NyZWVuXG4gICAgICBhdmFpbGFibGVJREVzPXthdmFpbGFibGVJREVzfVxuICAgICAgdW5hdmFpbGFibGVJREVzPXt1bmF2YWlsYWJsZUlERXN9XG4gICAgICBzZWxlY3RlZElERT17Y3VycmVudElERX1cbiAgICAgIG9uQ2xvc2U9eygpID0+IG9uRG9uZSgnSURFIHNlbGVjdGlvbiBjYW5jZWxsZWQnLCB7IGRpc3BsYXk6ICdzeXN0ZW0nIH0pfVxuICAgICAgb25TZWxlY3Q9e2hhbmRsZVNlbGVjdElERX1cbiAgICAvPlxuICApXG59XG5cbi8qKlxuICogRm9ybWF0cyB3b3Jrc3BhY2UgZm9sZGVycyBmb3IgZGlzcGxheSwgc3RyaXBwaW5nIGN3ZCBhbmQgc2hvd2luZyB0YWlsIGVuZCBvZiBwYXRoc1xuICogQHBhcmFtIGZvbGRlcnMgQXJyYXkgb2YgZm9sZGVyIHBhdGhzXG4gKiBAcGFyYW0gbWF4TGVuZ3RoIE1heGltdW0gdG90YWwgbGVuZ3RoIG9mIHRoZSBmb3JtYXR0ZWQgc3RyaW5nXG4gKiBAcmV0dXJucyBGb3JtYXR0ZWQgc3RyaW5nIHdpdGggZm9sZGVyIHBhdGhzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRXb3Jrc3BhY2VGb2xkZXJzKFxuICBmb2xkZXJzOiBzdHJpbmdbXSxcbiAgbWF4TGVuZ3RoOiBudW1iZXIgPSAxMDAsXG4pOiBzdHJpbmcge1xuICBpZiAoZm9sZGVycy5sZW5ndGggPT09IDApIHJldHVybiAnJ1xuXG4gIGNvbnN0IGN3ZCA9IGdldEN3ZCgpXG5cbiAgLy8gT25seSBzaG93IGZpcnN0IDIgd29ya3NwYWNlc1xuICBjb25zdCBmb2xkZXJzVG9TaG93ID0gZm9sZGVycy5zbGljZSgwLCAyKVxuICBjb25zdCBoYXNNb3JlID0gZm9sZGVycy5sZW5ndGggPiAyXG5cbiAgLy8gQWNjb3VudCBmb3IgXCIsIOKAplwiIGlmIHRoZXJlIGFyZSBtb3JlIGZvbGRlcnNcbiAgY29uc3QgZWxsaXBzaXNPdmVyaGVhZCA9IGhhc01vcmUgPyAzIDogMCAvLyBcIiwg4oCmXCJcblxuICAvLyBBY2NvdW50IGZvciBjb21tYXMgYW5kIHNwYWNlcyBiZXR3ZWVuIHBhdGhzIChcIiwgXCIgPSAyIGNoYXJzIHBlciBzZXBhcmF0b3IpXG4gIGNvbnN0IHNlcGFyYXRvck92ZXJoZWFkID0gKGZvbGRlcnNUb1Nob3cubGVuZ3RoIC0gMSkgKiAyXG4gIGNvbnN0IGF2YWlsYWJsZUxlbmd0aCA9IG1heExlbmd0aCAtIHNlcGFyYXRvck92ZXJoZWFkIC0gZWxsaXBzaXNPdmVyaGVhZFxuXG4gIGNvbnN0IG1heExlbmd0aFBlclBhdGggPSBNYXRoLmZsb29yKGF2YWlsYWJsZUxlbmd0aCAvIGZvbGRlcnNUb1Nob3cubGVuZ3RoKVxuXG4gIGNvbnN0IGN3ZE5GQyA9IGN3ZC5ub3JtYWxpemUoJ05GQycpXG4gIGNvbnN0IGZvcm1hdHRlZEZvbGRlcnMgPSBmb2xkZXJzVG9TaG93Lm1hcChmb2xkZXIgPT4ge1xuICAgIC8vIFN0cmlwIGN3ZCBmcm9tIHRoZSBiZWdpbm5pbmcgaWYgcHJlc2VudFxuICAgIC8vIE5vcm1hbGl6ZSBib3RoIHRvIE5GQyBmb3IgY29uc2lzdGVudCBjb21wYXJpc29uIChtYWNPUyB1c2VzIE5GRCBwYXRocylcbiAgICBjb25zdCBmb2xkZXJORkMgPSBmb2xkZXIubm9ybWFsaXplKCdORkMnKVxuICAgIGlmIChmb2xkZXJORkMuc3RhcnRzV2l0aChjd2RORkMgKyBwYXRoLnNlcCkpIHtcbiAgICAgIGZvbGRlciA9IGZvbGRlck5GQy5zbGljZShjd2RORkMubGVuZ3RoICsgMSlcbiAgICB9XG5cbiAgICBpZiAoZm9sZGVyLmxlbmd0aCA8PSBtYXhMZW5ndGhQZXJQYXRoKSB7XG4gICAgICByZXR1cm4gZm9sZGVyXG4gICAgfVxuICAgIHJldHVybiAn4oCmJyArIGZvbGRlci5zbGljZSgtKG1heExlbmd0aFBlclBhdGggLSAxKSlcbiAgfSlcblxuICBsZXQgcmVzdWx0ID0gZm9ybWF0dGVkRm9sZGVycy5qb2luKCcsICcpXG4gIGlmIChoYXNNb3JlKSB7XG4gICAgcmVzdWx0ICs9ICcsIOKApidcbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU9BLEtBQUssTUFBTSxPQUFPO0FBQ3pCLE9BQU8sS0FBS0MsSUFBSSxNQUFNLE1BQU07QUFDNUIsT0FBT0MsS0FBSyxJQUFJQyxXQUFXLEVBQUVDLFNBQVMsRUFBRUMsTUFBTSxFQUFFQyxRQUFRLFFBQVEsT0FBTztBQUN2RSxT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