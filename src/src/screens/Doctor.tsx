import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import { join } from 'path';
import React, { Suspense, use, useCallback, useEffect, useMemo, useState } from 'react';
import { KeybindingWarnings } from 'src/components/KeybindingWarnings.js';
import { McpParsingWarnings } from 'src/components/mcp/McpParsingWarnings.js';
import { getModelMaxOutputTokens } from 'src/utils/context.js';
import { getClaudeConfigHomeDir } from 'src/utils/envUtils.js';
import type { SettingSource } from 'src/utils/settings/constants.js';
import { getOriginalCwd } from '../bootstrap/state.js';
import type { CommandResultDisplay } from '../commands.js';
import { Pane } from '../components/design-system/Pane.js';
import { PressEnterToContinue } from '../components/PressEnterToContinue.js';
import { SandboxDoctorSection } from '../components/sandbox/SandboxDoctorSection.js';
import { ValidationErrorsList } from '../components/ValidationErrorsList.js';
import { useSettingsErrors } from '../hooks/notifs/useSettingsErrors.js';
import { useExitOnCtrlCDWithKeybindings } from '../hooks/useExitOnCtrlCDWithKeybindings.js';
import { Box, Text } from '../ink.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { useAppState } from '../state/AppState.js';
import { getPluginErrorMessage } from '../types/plugin.js';
import { getGcsDistTags, getNpmDistTags, type NpmDistTags } from '../utils/autoUpdater.js';
import { type ContextWarnings, checkContextWarnings } from '../utils/doctorContextWarnings.js';
import { type DiagnosticInfo, getDoctorDiagnostic } from '../utils/doctorDiagnostic.js';
import { validateBoundedIntEnvVar } from '../utils/envValidation.js';
import { pathExists } from '../utils/file.js';
import { cleanupStaleLocks, getAllLockInfo, isPidBasedLockingEnabled, type LockInfo } from '../utils/nativeInstaller/pidLock.js';
import { getInitialSettings } from '../utils/settings/settings.js';
import { BASH_MAX_OUTPUT_DEFAULT, BASH_MAX_OUTPUT_UPPER_LIMIT } from '../utils/shell/outputLimits.js';
import { TASK_MAX_OUTPUT_DEFAULT, TASK_MAX_OUTPUT_UPPER_LIMIT } from '../utils/task/outputFormatting.js';
import { getXDGStateHome } from '../utils/xdg.js';
type Props = {
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
type AgentInfo = {
  activeAgents: Array<{
    agentType: string;
    source: SettingSource | 'built-in' | 'plugin';
  }>;
  userAgentsDir: string;
  projectAgentsDir: string;
  userDirExists: boolean;
  projectDirExists: boolean;
  failedFiles?: Array<{
    path: string;
    error: string;
  }>;
};
type VersionLockInfo = {
  enabled: boolean;
  locks: LockInfo[];
  locksDir: string;
  staleLocksCleaned: number;
};
function DistTagsDisplay(t0) {
  const $ = _c(8);
  const {
    promise
  } = t0;
  const distTags = use(promise);
  if (!distTags.latest) {
    let t1;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
      t1 = <Text dimColor={true}>└ Failed to fetch versions</Text>;
      $[0] = t1;
    } else {
      t1 = $[0];
    }
    return t1;
  }
  let t1;
  if ($[1] !== distTags.stable) {
    t1 = distTags.stable && <Text>└ Stable version: {distTags.stable}</Text>;
    $[1] = distTags.stable;
    $[2] = t1;
  } else {
    t1 = $[2];
  }
  let t2;
  if ($[3] !== distTags.latest) {
    t2 = <Text>└ Latest version: {distTags.latest}</Text>;
    $[3] = distTags.latest;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  let t3;
  if ($[5] !== t1 || $[6] !== t2) {
    t3 = <>{t1}{t2}</>;
    $[5] = t1;
    $[6] = t2;
    $[7] = t3;
  } else {
    t3 = $[7];
  }
  return t3;
}
export function Doctor(t0) {
  const $ = _c(84);
  const {
    onDone
  } = t0;
  const agentDefinitions = useAppState(_temp);
  const mcpTools = useAppState(_temp2);
  const toolPermissionContext = useAppState(_temp3);
  const pluginsErrors = useAppState(_temp4);
  useExitOnCtrlCDWithKeybindings();
  let t1;
  if ($[0] !== mcpTools) {
    t1 = mcpTools || [];
    $[0] = mcpTools;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const tools = t1;
  const [diagnostic, setDiagnostic] = useState(null);
  const [agentInfo, setAgentInfo] = useState(null);
  const [contextWarnings, setContextWarnings] = useState(null);
  const [versionLockInfo, setVersionLockInfo] = useState(null);
  const validationErrors = useSettingsErrors();
  let t2;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = getDoctorDiagnostic().then(_temp6);
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  const distTagsPromise = t2;
  const autoUpdatesChannel = getInitialSettings()?.autoUpdatesChannel ?? "latest";
  let t3;
  if ($[3] !== validationErrors) {
    t3 = validationErrors.filter(_temp7);
    $[3] = validationErrors;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  const errorsExcludingMcp = t3;
  let t4;
  if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
    const envVars = [{
      name: "BASH_MAX_OUTPUT_LENGTH",
      default: BASH_MAX_OUTPUT_DEFAULT,
      upperLimit: BASH_MAX_OUTPUT_UPPER_LIMIT
    }, {
      name: "TASK_MAX_OUTPUT_LENGTH",
      default: TASK_MAX_OUTPUT_DEFAULT,
      upperLimit: TASK_MAX_OUTPUT_UPPER_LIMIT
    }, {
      name: "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
      ...getModelMaxOutputTokens("claude-opus-4-6")
    }];
    t4 = envVars.map(_temp8).filter(_temp9);
    $[5] = t4;
  } else {
    t4 = $[5];
  }
  const envValidationErrors = t4;
  let t5;
  let t6;
  if ($[6] !== agentDefinitions || $[7] !== toolPermissionContext || $[8] !== tools) {
    t5 = () => {
      getDoctorDiagnostic().then(setDiagnostic);
      (async () => {
        const userAgentsDir = join(getClaudeConfigHomeDir(), "agents");
        const projectAgentsDir = join(getOriginalCwd(), ".claude", "agents");
        const {
          activeAgents,
          allAgents,
          failedFiles
        } = agentDefinitions;
        const [userDirExists, projectDirExists] = await Promise.all([pathExists(userAgentsDir), pathExists(projectAgentsDir)]);
        const agentInfoData = {
          activeAgents: activeAgents.map(_temp0),
          userAgentsDir,
          projectAgentsDir,
          userDirExists,
          projectDirExists,
          failedFiles
        };
        setAgentInfo(agentInfoData);
        const warnings = await checkContextWarnings(tools, {
          activeAgents,
          allAgents,
          failedFiles
        }, async () => toolPermissionContext);
        setContextWarnings(warnings);
        if (isPidBasedLockingEnabled()) {
          const locksDir = join(getXDGStateHome(), "claude", "locks");
          const staleLocksCleaned = cleanupStaleLocks(locksDir);
          const locks = getAllLockInfo(locksDir);
          setVersionLockInfo({
            enabled: true,
            locks,
            locksDir,
            staleLocksCleaned
          });
        } else {
          setVersionLockInfo({
            enabled: false,
            locks: [],
            locksDir: "",
            staleLocksCleaned: 0
          });
        }
      })();
    };
    t6 = [toolPermissionContext, tools, agentDefinitions];
    $[6] = agentDefinitions;
    $[7] = toolPermissionContext;
    $[8] = tools;
    $[9] = t5;
    $[10] = t6;
  } else {
    t5 = $[9];
    t6 = $[10];
  }
  useEffect(t5, t6);
  let t7;
  if ($[11] !== onDone) {
    t7 = () => {
      onDone("Claude Code diagnostics dismissed", {
        display: "system"
      });
    };
    $[11] = onDone;
    $[12] = t7;
  } else {
    t7 = $[12];
  }
  const handleDismiss = t7;
  let t8;
  if ($[13] !== handleDismiss) {
    t8 = {
      "confirm:yes": handleDismiss,
      "confirm:no": handleDismiss
    };
    $[13] = handleDismiss;
    $[14] = t8;
  } else {
    t8 = $[14];
  }
  let t9;
  if ($[15] === Symbol.for("react.memo_cache_sentinel")) {
    t9 = {
      context: "Confirmation"
    };
    $[15] = t9;
  } else {
    t9 = $[15];
  }
  useKeybindings(t8, t9);
  if (!diagnostic) {
    let t10;
    if ($[16] === Symbol.for("react.memo_cache_sentinel")) {
      t10 = <Pane><Text dimColor={true}>Checking installation status…</Text></Pane>;
      $[16] = t10;
    } else {
      t10 = $[16];
    }
    return t10;
  }
  let t10;
  if ($[17] === Symbol.for("react.memo_cache_sentinel")) {
    t10 = <Text bold={true}>Diagnostics</Text>;
    $[17] = t10;
  } else {
    t10 = $[17];
  }
  let t11;
  if ($[18] !== diagnostic.installationType || $[19] !== diagnostic.version) {
    t11 = <Text>└ Currently running: {diagnostic.installationType} ({diagnostic.version})</Text>;
    $[18] = diagnostic.installationType;
    $[19] = diagnostic.version;
    $[20] = t11;
  } else {
    t11 = $[20];
  }
  let t12;
  if ($[21] !== diagnostic.packageManager) {
    t12 = diagnostic.packageManager && <Text>└ Package manager: {diagnostic.packageManager}</Text>;
    $[21] = diagnostic.packageManager;
    $[22] = t12;
  } else {
    t12 = $[22];
  }
  let t13;
  if ($[23] !== diagnostic.installationPath) {
    t13 = <Text>└ Path: {diagnostic.installationPath}</Text>;
    $[23] = diagnostic.installationPath;
    $[24] = t13;
  } else {
    t13 = $[24];
  }
  let t14;
  if ($[25] !== diagnostic.invokedBinary) {
    t14 = <Text>└ Invoked: {diagnostic.invokedBinary}</Text>;
    $[25] = diagnostic.invokedBinary;
    $[26] = t14;
  } else {
    t14 = $[26];
  }
  let t15;
  if ($[27] !== diagnostic.configInstallMethod) {
    t15 = <Text>└ Config install method: {diagnostic.configInstallMethod}</Text>;
    $[27] = diagnostic.configInstallMethod;
    $[28] = t15;
  } else {
    t15 = $[28];
  }
  const t16 = diagnostic.ripgrepStatus.working ? "OK" : "Not working";
  const t17 = diagnostic.ripgrepStatus.mode === "embedded" ? "bundled" : diagnostic.ripgrepStatus.mode === "builtin" ? "vendor" : diagnostic.ripgrepStatus.systemPath || "system";
  let t18;
  if ($[29] !== t16 || $[30] !== t17) {
    t18 = <Text>└ Search: {t16} ({t17})</Text>;
    $[29] = t16;
    $[30] = t17;
    $[31] = t18;
  } else {
    t18 = $[31];
  }
  let t19;
  if ($[32] !== diagnostic.recommendation) {
    t19 = diagnostic.recommendation && <><Text /><Text color="warning">Recommendation: {diagnostic.recommendation.split("\n")[0]}</Text><Text dimColor={true}>{diagnostic.recommendation.split("\n")[1]}</Text></>;
    $[32] = diagnostic.recommendation;
    $[33] = t19;
  } else {
    t19 = $[33];
  }
  let t20;
  if ($[34] !== diagnostic.multipleInstallations) {
    t20 = diagnostic.multipleInstallations.length > 1 && <><Text /><Text color="warning">Warning: Multiple installations found</Text>{diagnostic.multipleInstallations.map(_temp1)}</>;
    $[34] = diagnostic.multipleInstallations;
    $[35] = t20;
  } else {
    t20 = $[35];
  }
  let t21;
  if ($[36] !== diagnostic.warnings) {
    t21 = diagnostic.warnings.length > 0 && <><Text />{diagnostic.warnings.map(_temp10)}</>;
    $[36] = diagnostic.warnings;
    $[37] = t21;
  } else {
    t21 = $[37];
  }
  let t22;
  if ($[38] !== errorsExcludingMcp) {
    t22 = errorsExcludingMcp.length > 0 && <Box flexDirection="column" marginTop={1} marginBottom={1}><Text bold={true}>Invalid Settings</Text><ValidationErrorsList errors={errorsExcludingMcp} /></Box>;
    $[38] = errorsExcludingMcp;
    $[39] = t22;
  } else {
    t22 = $[39];
  }
  let t23;
  if ($[40] !== t11 || $[41] !== t12 || $[42] !== t13 || $[43] !== t14 || $[44] !== t15 || $[45] !== t18 || $[46] !== t19 || $[47] !== t20 || $[48] !== t21 || $[49] !== t22) {
    t23 = <Box flexDirection="column">{t10}{t11}{t12}{t13}{t14}{t15}{t18}{t19}{t20}{t21}{t22}</Box>;
    $[40] = t11;
    $[41] = t12;
    $[42] = t13;
    $[43] = t14;
    $[44] = t15;
    $[45] = t18;
    $[46] = t19;
    $[47] = t20;
    $[48] = t21;
    $[49] = t22;
    $[50] = t23;
  } else {
    t23 = $[50];
  }
  let t24;
  if ($[51] === Symbol.for("react.memo_cache_sentinel")) {
    t24 = <Text bold={true}>Updates</Text>;
    $[51] = t24;
  } else {
    t24 = $[51];
  }
  const t25 = diagnostic.packageManager ? "Managed by package manager" : diagnostic.autoUpdates;
  let t26;
  if ($[52] !== t25) {
    t26 = <Text>└ Auto-updates:{" "}{t25}</Text>;
    $[52] = t25;
    $[53] = t26;
  } else {
    t26 = $[53];
  }
  let t27;
  if ($[54] !== diagnostic.hasUpdatePermissions) {
    t27 = diagnostic.hasUpdatePermissions !== null && <Text>└ Update permissions:{" "}{diagnostic.hasUpdatePermissions ? "Yes" : "No (requires sudo)"}</Text>;
    $[54] = diagnostic.hasUpdatePermissions;
    $[55] = t27;
  } else {
    t27 = $[55];
  }
  let t28;
  if ($[56] === Symbol.for("react.memo_cache_sentinel")) {
    t28 = <Text>└ Auto-update channel: {autoUpdatesChannel}</Text>;
    $[56] = t28;
  } else {
    t28 = $[56];
  }
  let t29;
  if ($[57] === Symbol.for("react.memo_cache_sentinel")) {
    t29 = <Suspense fallback={null}><DistTagsDisplay promise={distTagsPromise} /></Suspense>;
    $[57] = t29;
  } else {
    t29 = $[57];
  }
  let t30;
  if ($[58] !== t26 || $[59] !== t27) {
    t30 = <Box flexDirection="column">{t24}{t26}{t27}{t28}{t29}</Box>;
    $[58] = t26;
    $[59] = t27;
    $[60] = t30;
  } else {
    t30 = $[60];
  }
  let t31;
  let t32;
  let t33;
  let t34;
  if ($[61] === Symbol.for("react.memo_cache_sentinel")) {
    t31 = <SandboxDoctorSection />;
    t32 = <McpParsingWarnings />;
    t33 = <KeybindingWarnings />;
    t34 = envValidationErrors.length > 0 && <Box flexDirection="column"><Text bold={true}>Environment Variables</Text>{envValidationErrors.map(_temp11)}</Box>;
    $[61] = t31;
    $[62] = t32;
    $[63] = t33;
    $[64] = t34;
  } else {
    t31 = $[61];
    t32 = $[62];
    t33 = $[63];
    t34 = $[64];
  }
  let t35;
  if ($[65] !== versionLockInfo) {
    t35 = versionLockInfo?.enabled && <Box flexDirection="column"><Text bold={true}>Version Locks</Text>{versionLockInfo.staleLocksCleaned > 0 && <Text dimColor={true}>└ Cleaned {versionLockInfo.staleLocksCleaned} stale lock(s)</Text>}{versionLockInfo.locks.length === 0 ? <Text dimColor={true}>└ No active version locks</Text> : versionLockInfo.locks.map(_temp12)}</Box>;
    $[65] = versionLockInfo;
    $[66] = t35;
  } else {
    t35 = $[66];
  }
  let t36;
  if ($[67] !== agentInfo) {
    t36 = agentInfo?.failedFiles && agentInfo.failedFiles.length > 0 && <Box flexDirection="column"><Text bold={true} color="error">Agent Parse Errors</Text><Text color="error">└ Failed to parse {agentInfo.failedFiles.length} agent file(s):</Text>{agentInfo.failedFiles.map(_temp13)}</Box>;
    $[67] = agentInfo;
    $[68] = t36;
  } else {
    t36 = $[68];
  }
  let t37;
  if ($[69] !== pluginsErrors) {
    t37 = pluginsErrors.length > 0 && <Box flexDirection="column"><Text bold={true} color="error">Plugin Errors</Text><Text color="error">└ {pluginsErrors.length} plugin error(s) detected:</Text>{pluginsErrors.map(_temp14)}</Box>;
    $[69] = pluginsErrors;
    $[70] = t37;
  } else {
    t37 = $[70];
  }
  let t38;
  if ($[71] !== contextWarnings) {
    t38 = contextWarnings?.unreachableRulesWarning && <Box flexDirection="column"><Text bold={true} color="warning">Unreachable Permission Rules</Text><Text>└{" "}<Text color="warning">{figures.warning}{" "}{contextWarnings.unreachableRulesWarning.message}</Text></Text>{contextWarnings.unreachableRulesWarning.details.map(_temp15)}</Box>;
    $[71] = contextWarnings;
    $[72] = t38;
  } else {
    t38 = $[72];
  }
  let t39;
  if ($[73] !== contextWarnings) {
    t39 = contextWarnings && (contextWarnings.claudeMdWarning || contextWarnings.agentWarning || contextWarnings.mcpWarning) && <Box flexDirection="column"><Text bold={true}>Context Usage Warnings</Text>{contextWarnings.claudeMdWarning && <><Text>└{" "}<Text color="warning">{figures.warning} {contextWarnings.claudeMdWarning.message}</Text></Text><Text>{"  "}└ Files:</Text>{contextWarnings.claudeMdWarning.details.map(_temp16)}</>}{contextWarnings.agentWarning && <><Text>└{" "}<Text color="warning">{figures.warning} {contextWarnings.agentWarning.message}</Text></Text><Text>{"  "}└ Top contributors:</Text>{contextWarnings.agentWarning.details.map(_temp17)}</>}{contextWarnings.mcpWarning && <><Text>└{" "}<Text color="warning">{figures.warning} {contextWarnings.mcpWarning.message}</Text></Text><Text>{"  "}└ MCP servers:</Text>{contextWarnings.mcpWarning.details.map(_temp18)}</>}</Box>;
    $[73] = contextWarnings;
    $[74] = t39;
  } else {
    t39 = $[74];
  }
  let t40;
  if ($[75] === Symbol.for("react.memo_cache_sentinel")) {
    t40 = <Box><PressEnterToContinue /></Box>;
    $[75] = t40;
  } else {
    t40 = $[75];
  }
  let t41;
  if ($[76] !== t23 || $[77] !== t30 || $[78] !== t35 || $[79] !== t36 || $[80] !== t37 || $[81] !== t38 || $[82] !== t39) {
    t41 = <Pane>{t23}{t30}{t31}{t32}{t33}{t34}{t35}{t36}{t37}{t38}{t39}{t40}</Pane>;
    $[76] = t23;
    $[77] = t30;
    $[78] = t35;
    $[79] = t36;
    $[80] = t37;
    $[81] = t38;
    $[82] = t39;
    $[83] = t41;
  } else {
    t41 = $[83];
  }
  return t41;
}
function _temp18(detail_2, i_8) {
  return <Text key={i_8} dimColor={true}>{"    "}└ {detail_2}</Text>;
}
function _temp17(detail_1, i_7) {
  return <Text key={i_7} dimColor={true}>{"    "}└ {detail_1}</Text>;
}
function _temp16(detail_0, i_6) {
  return <Text key={i_6} dimColor={true}>{"    "}└ {detail_0}</Text>;
}
function _temp15(detail, i_5) {
  return <Text key={i_5} dimColor={true}>{"  "}└ {detail}</Text>;
}
function _temp14(error_0, i_4) {
  return <Text key={i_4} dimColor={true}>{"  "}└ {error_0.source || "unknown"}{"plugin" in error_0 && error_0.plugin ? ` [${error_0.plugin}]` : ""}:{" "}{getPluginErrorMessage(error_0)}</Text>;
}
function _temp13(file, i_3) {
  return <Text key={i_3} dimColor={true}>{"  "}└ {file.path}: {file.error}</Text>;
}
function _temp12(lock, i_2) {
  return <Text key={i_2}>└ {lock.version}: PID {lock.pid}{" "}{lock.isProcessRunning ? <Text>(running)</Text> : <Text color="warning">(stale)</Text>}</Text>;
}
function _temp11(validation, i_1) {
  return <Text key={i_1}>└ {validation.name}:{" "}<Text color={validation.status === "capped" ? "warning" : "error"}>{validation.message}</Text></Text>;
}
function _temp10(warning, i_0) {
  return <Box key={i_0} flexDirection="column"><Text color="warning">Warning: {warning.issue}</Text><Text>Fix: {warning.fix}</Text></Box>;
}
function _temp1(install, i) {
  return <Text key={i}>└ {install.type} at {install.path}</Text>;
}
function _temp0(a) {
  return {
    agentType: a.agentType,
    source: a.source
  };
}
function _temp9(v_0) {
  return v_0.status !== "valid";
}
function _temp8(v) {
  const value = process.env[v.name];
  const result = validateBoundedIntEnvVar(v.name, value, v.default, v.upperLimit);
  return {
    name: v.name,
    ...result
  };
}
function _temp7(error) {
  return error.mcpErrorMetadata === undefined;
}
function _temp6(diag) {
  const fetchDistTags = diag.installationType === "native" ? getGcsDistTags : getNpmDistTags;
  return fetchDistTags().catch(_temp5);
}
function _temp5() {
  return {
    latest: null,
    stable: null
  };
}
function _temp4(s_2) {
  return s_2.plugins.errors;
}
function _temp3(s_1) {
  return s_1.toolPermissionContext;
}
function _temp2(s_0) {
  return s_0.mcp.tools;
}
function _temp(s) {
  return s.agentDefinitions;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiam9pbiIsIlJlYWN0IiwiU3VzcGVuc2UiLCJ1c2UiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VTdGF0ZSIsIktleWJpbmRpbmdXYXJuaW5ncyIsIk1jcFBhcnNpbmdXYXJuaW5ncyIsImdldE1vZGVsTWF4T3V0cHV0VG9rZW5zIiwiZ2V0Q2xhdWRlQ29uZmlnSG9tZURpciIsIlNldHRpbmdTb3VyY2UiLCJnZXRPcmlnaW5hbEN3ZCIsIkNvbW1hbmRSZXN1bHREaXNwbGF5IiwiUGFuZSIsIlByZXNzRW50ZXJUb0NvbnRpbnVlIiwiU2FuZGJveERvY3RvclNlY3Rpb24iLCJWYWxpZGF0aW9uRXJyb3JzTGlzdCIsInVzZVNldHRpbmdzRXJyb3JzIiwidXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzIiwiQm94IiwiVGV4dCIsInVzZUtleWJpbmRpbmdzIiwidXNlQXBwU3RhdGUiLCJnZXRQbHVnaW5FcnJvck1lc3NhZ2UiLCJnZXRHY3NEaXN0VGFncyIsImdldE5wbURpc3RUYWdzIiwiTnBtRGlzdFRhZ3MiLCJDb250ZXh0V2FybmluZ3MiLCJjaGVja0NvbnRleHRXYXJuaW5ncyIsIkRpYWdub3N0aWNJbmZvIiwiZ2V0RG9jdG9yRGlhZ25vc3RpYyIsInZhbGlkYXRlQm91bmRlZEludEVudlZhciIsInBhdGhFeGlzdHMiLCJjbGVhbnVwU3RhbGVMb2NrcyIsImdldEFsbExvY2tJbmZvIiwiaXNQaWRCYXNlZExvY2tpbmdFbmFibGVkIiwiTG9ja0luZm8iLCJnZXRJbml0aWFsU2V0dGluZ3MiLCJCQVNIX01BWF9PVVRQVVRfREVGQVVMVCIsIkJBU0hfTUFYX09VVFBVVF9VUFBFUl9MSU1JVCIsIlRBU0tfTUFYX09VVFBVVF9ERUZBVUxUIiwiVEFTS19NQVhfT1VUUFVUX1VQUEVSX0xJTUlUIiwiZ2V0WERHU3RhdGVIb21lIiwiUHJvcHMiLCJvbkRvbmUiLCJyZXN1bHQiLCJvcHRpb25zIiwiZGlzcGxheSIsIkFnZW50SW5mbyIsImFjdGl2ZUFnZW50cyIsIkFycmF5IiwiYWdlbnRUeXBlIiwic291cmNlIiwidXNlckFnZW50c0RpciIsInByb2plY3RBZ2VudHNEaXIiLCJ1c2VyRGlyRXhpc3RzIiwicHJvamVjdERpckV4aXN0cyIsImZhaWxlZEZpbGVzIiwicGF0aCIsImVycm9yIiwiVmVyc2lvbkxvY2tJbmZvIiwiZW5hYmxlZCIsImxvY2tzIiwibG9ja3NEaXIiLCJzdGFsZUxvY2tzQ2xlYW5lZCIsIkRpc3RUYWdzRGlzcGxheSIsInQwIiwiJCIsIl9jIiwicHJvbWlzZSIsImRpc3RUYWdzIiwibGF0ZXN0IiwidDEiLCJTeW1ib2wiLCJmb3IiLCJzdGFibGUiLCJ0MiIsInQzIiwiRG9jdG9yIiwiYWdlbnREZWZpbml0aW9ucyIsIl90ZW1wIiwibWNwVG9vbHMiLCJfdGVtcDIiLCJ0b29sUGVybWlzc2lvbkNvbnRleHQiLCJfdGVtcDMiLCJwbHVnaW5zRXJyb3JzIiwiX3RlbXA0IiwidG9vbHMiLCJkaWFnbm9zdGljIiwic2V0RGlhZ25vc3RpYyIsImFnZW50SW5mbyIsInNldEFnZW50SW5mbyIsImNvbnRleHRXYXJuaW5ncyIsInNldENvbnRleHRXYXJuaW5ncyIsInZlcnNpb25Mb2NrSW5mbyIsInNldFZlcnNpb25Mb2NrSW5mbyIsInZhbGlkYXRpb25FcnJvcnMiLCJ0aGVuIiwiX3RlbXA2IiwiZGlzdFRhZ3NQcm9taXNlIiwiYXV0b1VwZGF0ZXNDaGFubmVsIiwiZmlsdGVyIiwiX3RlbXA3IiwiZXJyb3JzRXhjbHVkaW5nTWNwIiwidDQiLCJlbnZWYXJzIiwibmFtZSIsImRlZmF1bHQiLCJ1cHBlckxpbWl0IiwibWFwIiwiX3RlbXA4IiwiX3RlbXA5IiwiZW52VmFsaWRhdGlvbkVycm9ycyIsInQ1IiwidDYiLCJhbGxBZ2VudHMiLCJQcm9taXNlIiwiYWxsIiwiYWdlbnRJbmZvRGF0YSIsIl90ZW1wMCIsIndhcm5pbmdzIiwidDciLCJoYW5kbGVEaXNtaXNzIiwidDgiLCJ0OSIsImNvbnRleHQiLCJ0MTAiLCJ0MTEiLCJpbnN0YWxsYXRpb25UeXBlIiwidmVyc2lvbiIsInQxMiIsInBhY2thZ2VNYW5hZ2VyIiwidDEzIiwiaW5zdGFsbGF0aW9uUGF0aCIsInQxNCIsImludm9rZWRCaW5hcnkiLCJ0MTUiLCJjb25maWdJbnN0YWxsTWV0aG9kIiwidDE2IiwicmlwZ3JlcFN0YXR1cyIsIndvcmtpbmciLCJ0MTciLCJtb2RlIiwic3lzdGVtUGF0aCIsInQxOCIsInQxOSIsInJlY29tbWVuZGF0aW9uIiwic3BsaXQiLCJ0MjAiLCJtdWx0aXBsZUluc3RhbGxhdGlvbnMiLCJsZW5ndGgiLCJfdGVtcDEiLCJ0MjEiLCJfdGVtcDEwIiwidDIyIiwidDIzIiwidDI0IiwidDI1IiwiYXV0b1VwZGF0ZXMiLCJ0MjYiLCJ0MjciLCJoYXNVcGRhdGVQZXJtaXNzaW9ucyIsInQyOCIsInQyOSIsInQzMCIsInQzMSIsInQzMiIsInQzMyIsInQzNCIsIl90ZW1wMTEiLCJ0MzUiLCJfdGVtcDEyIiwidDM2IiwiX3RlbXAxMyIsInQzNyIsIl90ZW1wMTQiLCJ0MzgiLCJ1bnJlYWNoYWJsZVJ1bGVzV2FybmluZyIsIndhcm5pbmciLCJtZXNzYWdlIiwiZGV0YWlscyIsIl90ZW1wMTUiLCJ0MzkiLCJjbGF1ZGVNZFdhcm5pbmciLCJhZ2VudFdhcm5pbmciLCJtY3BXYXJuaW5nIiwiX3RlbXAxNiIsIl90ZW1wMTciLCJfdGVtcDE4IiwidDQwIiwidDQxIiwiZGV0YWlsXzIiLCJpXzgiLCJpIiwiZGV0YWlsIiwiZGV0YWlsXzEiLCJpXzciLCJkZXRhaWxfMCIsImlfNiIsImlfNSIsImVycm9yXzAiLCJpXzQiLCJwbHVnaW4iLCJmaWxlIiwiaV8zIiwibG9jayIsImlfMiIsInBpZCIsImlzUHJvY2Vzc1J1bm5pbmciLCJ2YWxpZGF0aW9uIiwiaV8xIiwic3RhdHVzIiwiaV8wIiwiaXNzdWUiLCJmaXgiLCJpbnN0YWxsIiwidHlwZSIsImEiLCJ2XzAiLCJ2IiwidmFsdWUiLCJwcm9jZXNzIiwiZW52IiwibWNwRXJyb3JNZXRhZGF0YSIsInVuZGVmaW5lZCIsImRpYWciLCJmZXRjaERpc3RUYWdzIiwiY2F0Y2giLCJfdGVtcDUiLCJzXzIiLCJzIiwicGx1Z2lucyIsImVycm9ycyIsInNfMSIsInNfMCIsIm1jcCJdLCJzb3VyY2VzIjpbIkRvY3Rvci50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJ1xuaW1wb3J0IFJlYWN0LCB7XG4gIFN1c3BlbnNlLFxuICB1c2UsXG4gIHVzZUNhbGxiYWNrLFxuICB1c2VFZmZlY3QsXG4gIHVzZU1lbW8sXG4gIHVzZVN0YXRlLFxufSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IEtleWJpbmRpbmdXYXJuaW5ncyB9IGZyb20gJ3NyYy9jb21wb25lbnRzL0tleWJpbmRpbmdXYXJuaW5ncy5qcydcbmltcG9ydCB7IE1jcFBhcnNpbmdXYXJuaW5ncyB9IGZyb20gJ3NyYy9jb21wb25lbnRzL21jcC9NY3BQYXJzaW5nV2FybmluZ3MuanMnXG5pbXBvcnQgeyBnZXRNb2RlbE1heE91dHB1dFRva2VucyB9IGZyb20gJ3NyYy91dGlscy9jb250ZXh0LmpzJ1xuaW1wb3J0IHsgZ2V0Q2xhdWRlQ29uZmlnSG9tZURpciB9IGZyb20gJ3NyYy91dGlscy9lbnZVdGlscy5qcydcbmltcG9ydCB0eXBlIHsgU2V0dGluZ1NvdXJjZSB9IGZyb20gJ3NyYy91dGlscy9zZXR0aW5ncy9jb25zdGFudHMuanMnXG5pbXBvcnQgeyBnZXRPcmlnaW5hbEN3ZCB9IGZyb20gJy4uL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB0eXBlIHsgQ29tbWFuZFJlc3VsdERpc3BsYXkgfSBmcm9tICcuLi9jb21tYW5kcy5qcydcbmltcG9ydCB7IFBhbmUgfSBmcm9tICcuLi9jb21wb25lbnRzL2Rlc2lnbi1zeXN0ZW0vUGFuZS5qcydcbmltcG9ydCB7IFByZXNzRW50ZXJUb0NvbnRpbnVlIH0gZnJvbSAnLi4vY29tcG9uZW50cy9QcmVzc0VudGVyVG9Db250aW51ZS5qcydcbmltcG9ydCB7IFNhbmRib3hEb2N0b3JTZWN0aW9uIH0gZnJvbSAnLi4vY29tcG9uZW50cy9zYW5kYm94L1NhbmRib3hEb2N0b3JTZWN0aW9uLmpzJ1xuaW1wb3J0IHsgVmFsaWRhdGlvbkVycm9yc0xpc3QgfSBmcm9tICcuLi9jb21wb25lbnRzL1ZhbGlkYXRpb25FcnJvcnNMaXN0LmpzJ1xuaW1wb3J0IHsgdXNlU2V0dGluZ3NFcnJvcnMgfSBmcm9tICcuLi9ob29rcy9ub3RpZnMvdXNlU2V0dGluZ3NFcnJvcnMuanMnXG5pbXBvcnQgeyB1c2VFeGl0T25DdHJsQ0RXaXRoS2V5YmluZGluZ3MgfSBmcm9tICcuLi9ob29rcy91c2VFeGl0T25DdHJsQ0RXaXRoS2V5YmluZGluZ3MuanMnXG5pbXBvcnQgeyBCb3gsIFRleHQgfSBmcm9tICcuLi9pbmsuanMnXG5pbXBvcnQgeyB1c2VLZXliaW5kaW5ncyB9IGZyb20gJy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgeyB1c2VBcHBTdGF0ZSB9IGZyb20gJy4uL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHsgZ2V0UGx1Z2luRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vdHlwZXMvcGx1Z2luLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0R2NzRGlzdFRhZ3MsXG4gIGdldE5wbURpc3RUYWdzLFxuICB0eXBlIE5wbURpc3RUYWdzLFxufSBmcm9tICcuLi91dGlscy9hdXRvVXBkYXRlci5qcydcbmltcG9ydCB7XG4gIHR5cGUgQ29udGV4dFdhcm5pbmdzLFxuICBjaGVja0NvbnRleHRXYXJuaW5ncyxcbn0gZnJvbSAnLi4vdXRpbHMvZG9jdG9yQ29udGV4dFdhcm5pbmdzLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBEaWFnbm9zdGljSW5mbyxcbiAgZ2V0RG9jdG9yRGlhZ25vc3RpYyxcbn0gZnJvbSAnLi4vdXRpbHMvZG9jdG9yRGlhZ25vc3RpYy5qcydcbmltcG9ydCB7IHZhbGlkYXRlQm91bmRlZEludEVudlZhciB9IGZyb20gJy4uL3V0aWxzL2VudlZhbGlkYXRpb24uanMnXG5pbXBvcnQgeyBwYXRoRXhpc3RzIH0gZnJvbSAnLi4vdXRpbHMvZmlsZS5qcydcbmltcG9ydCB7XG4gIGNsZWFudXBTdGFsZUxvY2tzLFxuICBnZXRBbGxMb2NrSW5mbyxcbiAgaXNQaWRCYXNlZExvY2tpbmdFbmFibGVkLFxuICB0eXBlIExvY2tJbmZvLFxufSBmcm9tICcuLi91dGlscy9uYXRpdmVJbnN0YWxsZXIvcGlkTG9jay5qcydcbmltcG9ydCB7IGdldEluaXRpYWxTZXR0aW5ncyB9IGZyb20gJy4uL3V0aWxzL3NldHRpbmdzL3NldHRpbmdzLmpzJ1xuaW1wb3J0IHtcbiAgQkFTSF9NQVhfT1VUUFVUX0RFRkFVTFQsXG4gIEJBU0hfTUFYX09VVFBVVF9VUFBFUl9MSU1JVCxcbn0gZnJvbSAnLi4vdXRpbHMvc2hlbGwvb3V0cHV0TGltaXRzLmpzJ1xuaW1wb3J0IHtcbiAgVEFTS19NQVhfT1VUUFVUX0RFRkFVTFQsXG4gIFRBU0tfTUFYX09VVFBVVF9VUFBFUl9MSU1JVCxcbn0gZnJvbSAnLi4vdXRpbHMvdGFzay9vdXRwdXRGb3JtYXR0aW5nLmpzJ1xuaW1wb3J0IHsgZ2V0WERHU3RhdGVIb21lIH0gZnJvbSAnLi4vdXRpbHMveGRnLmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICBvbkRvbmU6IChcbiAgICByZXN1bHQ/OiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IHsgZGlzcGxheT86IENvbW1hbmRSZXN1bHREaXNwbGF5IH0sXG4gICkgPT4gdm9pZFxufVxuXG50eXBlIEFnZW50SW5mbyA9IHtcbiAgYWN0aXZlQWdlbnRzOiBBcnJheTx7XG4gICAgYWdlbnRUeXBlOiBzdHJpbmdcbiAgICBzb3VyY2U6IFNldHRpbmdTb3VyY2UgfCAnYnVpbHQtaW4nIHwgJ3BsdWdpbidcbiAgfT5cbiAgdXNlckFnZW50c0Rpcjogc3RyaW5nXG4gIHByb2plY3RBZ2VudHNEaXI6IHN0cmluZ1xuICB1c2VyRGlyRXhpc3RzOiBib29sZWFuXG4gIHByb2plY3REaXJFeGlzdHM6IGJvb2xlYW5cbiAgZmFpbGVkRmlsZXM/OiBBcnJheTx7IHBhdGg6IHN0cmluZzsgZXJyb3I6IHN0cmluZyB9PlxufVxuXG50eXBlIFZlcnNpb25Mb2NrSW5mbyA9IHtcbiAgZW5hYmxlZDogYm9vbGVhblxuICBsb2NrczogTG9ja0luZm9bXVxuICBsb2Nrc0Rpcjogc3RyaW5nXG4gIHN0YWxlTG9ja3NDbGVhbmVkOiBudW1iZXJcbn1cblxuZnVuY3Rpb24gRGlzdFRhZ3NEaXNwbGF5KHtcbiAgcHJvbWlzZSxcbn06IHtcbiAgcHJvbWlzZTogUHJvbWlzZTxOcG1EaXN0VGFncz5cbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBkaXN0VGFncyA9IHVzZShwcm9taXNlKVxuICBpZiAoIWRpc3RUYWdzLmxhdGVzdCkge1xuICAgIHJldHVybiA8VGV4dCBkaW1Db2xvcj7ilJQgRmFpbGVkIHRvIGZldGNoIHZlcnNpb25zPC9UZXh0PlxuICB9XG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIHtkaXN0VGFncy5zdGFibGUgJiYgPFRleHQ+4pSUIFN0YWJsZSB2ZXJzaW9uOiB7ZGlzdFRhZ3Muc3RhYmxlfTwvVGV4dD59XG4gICAgICA8VGV4dD7ilJQgTGF0ZXN0IHZlcnNpb246IHtkaXN0VGFncy5sYXRlc3R9PC9UZXh0PlxuICAgIDwvPlxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBEb2N0b3IoeyBvbkRvbmUgfTogUHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBhZ2VudERlZmluaXRpb25zID0gdXNlQXBwU3RhdGUocyA9PiBzLmFnZW50RGVmaW5pdGlvbnMpXG4gIGNvbnN0IG1jcFRvb2xzID0gdXNlQXBwU3RhdGUocyA9PiBzLm1jcC50b29scylcbiAgY29uc3QgdG9vbFBlcm1pc3Npb25Db250ZXh0ID0gdXNlQXBwU3RhdGUocyA9PiBzLnRvb2xQZXJtaXNzaW9uQ29udGV4dClcbiAgY29uc3QgcGx1Z2luc0Vycm9ycyA9IHVzZUFwcFN0YXRlKHMgPT4gcy5wbHVnaW5zLmVycm9ycylcbiAgdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzKClcblxuICBjb25zdCB0b29scyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIHJldHVybiBtY3BUb29scyB8fCBbXVxuICB9LCBbbWNwVG9vbHNdKVxuXG4gIGNvbnN0IFtkaWFnbm9zdGljLCBzZXREaWFnbm9zdGljXSA9IHVzZVN0YXRlPERpYWdub3N0aWNJbmZvIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW2FnZW50SW5mbywgc2V0QWdlbnRJbmZvXSA9IHVzZVN0YXRlPEFnZW50SW5mbyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtjb250ZXh0V2FybmluZ3MsIHNldENvbnRleHRXYXJuaW5nc10gPVxuICAgIHVzZVN0YXRlPENvbnRleHRXYXJuaW5ncyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFt2ZXJzaW9uTG9ja0luZm8sIHNldFZlcnNpb25Mb2NrSW5mb10gPVxuICAgIHVzZVN0YXRlPFZlcnNpb25Mb2NrSW5mbyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IHZhbGlkYXRpb25FcnJvcnMgPSB1c2VTZXR0aW5nc0Vycm9ycygpXG5cbiAgLy8gQ3JlYXRlIHByb21pc2Ugb25jZSBmb3IgZGlzdC10YWdzIGZldGNoIChkZXBlbmRzIG9uIGRpYWdub3N0aWMpXG4gIGNvbnN0IGRpc3RUYWdzUHJvbWlzZSA9IHVzZU1lbW8oXG4gICAgKCkgPT5cbiAgICAgIGdldERvY3RvckRpYWdub3N0aWMoKS50aGVuKGRpYWcgPT4ge1xuICAgICAgICBjb25zdCBmZXRjaERpc3RUYWdzID1cbiAgICAgICAgICBkaWFnLmluc3RhbGxhdGlvblR5cGUgPT09ICduYXRpdmUnID8gZ2V0R2NzRGlzdFRhZ3MgOiBnZXROcG1EaXN0VGFnc1xuICAgICAgICByZXR1cm4gZmV0Y2hEaXN0VGFncygpLmNhdGNoKCgpID0+ICh7IGxhdGVzdDogbnVsbCwgc3RhYmxlOiBudWxsIH0pKVxuICAgICAgfSksXG4gICAgW10sXG4gIClcbiAgY29uc3QgYXV0b1VwZGF0ZXNDaGFubmVsID1cbiAgICBnZXRJbml0aWFsU2V0dGluZ3MoKT8uYXV0b1VwZGF0ZXNDaGFubmVsID8/ICdsYXRlc3QnXG5cbiAgY29uc3QgZXJyb3JzRXhjbHVkaW5nTWNwID0gdmFsaWRhdGlvbkVycm9ycy5maWx0ZXIoXG4gICAgZXJyb3IgPT4gZXJyb3IubWNwRXJyb3JNZXRhZGF0YSA9PT0gdW5kZWZpbmVkLFxuICApXG5cbiAgY29uc3QgZW52VmFsaWRhdGlvbkVycm9ycyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGVudlZhcnMgPSBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdCQVNIX01BWF9PVVRQVVRfTEVOR1RIJyxcbiAgICAgICAgZGVmYXVsdDogQkFTSF9NQVhfT1VUUFVUX0RFRkFVTFQsXG4gICAgICAgIHVwcGVyTGltaXQ6IEJBU0hfTUFYX09VVFBVVF9VUFBFUl9MSU1JVCxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdUQVNLX01BWF9PVVRQVVRfTEVOR1RIJyxcbiAgICAgICAgZGVmYXVsdDogVEFTS19NQVhfT1VUUFVUX0RFRkFVTFQsXG4gICAgICAgIHVwcGVyTGltaXQ6IFRBU0tfTUFYX09VVFBVVF9VUFBFUl9MSU1JVCxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdDTEFVREVfQ09ERV9NQVhfT1VUUFVUX1RPS0VOUycsXG4gICAgICAgIC8vIENoZWNrIGZvciB2YWx1ZXMgYWdhaW5zdCB0aGUgbGF0ZXN0IHN1cHBvcnRlZCBtb2RlbFxuICAgICAgICAuLi5nZXRNb2RlbE1heE91dHB1dFRva2VucygnY2xhdWRlLW9wdXMtNC02JyksXG4gICAgICB9LFxuICAgIF1cbiAgICByZXR1cm4gZW52VmFyc1xuICAgICAgLm1hcCh2ID0+IHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBwcm9jZXNzLmVudlt2Lm5hbWVdXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHZhbGlkYXRlQm91bmRlZEludEVudlZhcihcbiAgICAgICAgICB2Lm5hbWUsXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgdi5kZWZhdWx0LFxuICAgICAgICAgIHYudXBwZXJMaW1pdCxcbiAgICAgICAgKVxuICAgICAgICByZXR1cm4geyBuYW1lOiB2Lm5hbWUsIC4uLnJlc3VsdCB9XG4gICAgICB9KVxuICAgICAgLmZpbHRlcih2ID0+IHYuc3RhdHVzICE9PSAndmFsaWQnKVxuICB9LCBbXSlcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHZvaWQgZ2V0RG9jdG9yRGlhZ25vc3RpYygpLnRoZW4oc2V0RGlhZ25vc3RpYylcblxuICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHVzZXJBZ2VudHNEaXIgPSBqb2luKGdldENsYXVkZUNvbmZpZ0hvbWVEaXIoKSwgJ2FnZW50cycpXG4gICAgICBjb25zdCBwcm9qZWN0QWdlbnRzRGlyID0gam9pbihnZXRPcmlnaW5hbEN3ZCgpLCAnLmNsYXVkZScsICdhZ2VudHMnKVxuXG4gICAgICBjb25zdCB7IGFjdGl2ZUFnZW50cywgYWxsQWdlbnRzLCBmYWlsZWRGaWxlcyB9ID0gYWdlbnREZWZpbml0aW9uc1xuXG4gICAgICBjb25zdCBbdXNlckRpckV4aXN0cywgcHJvamVjdERpckV4aXN0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgIHBhdGhFeGlzdHModXNlckFnZW50c0RpciksXG4gICAgICAgIHBhdGhFeGlzdHMocHJvamVjdEFnZW50c0RpciksXG4gICAgICBdKVxuXG4gICAgICBjb25zdCBhZ2VudEluZm9EYXRhID0ge1xuICAgICAgICBhY3RpdmVBZ2VudHM6IGFjdGl2ZUFnZW50cy5tYXAoYSA9PiAoe1xuICAgICAgICAgIGFnZW50VHlwZTogYS5hZ2VudFR5cGUsXG4gICAgICAgICAgc291cmNlOiBhLnNvdXJjZSxcbiAgICAgICAgfSkpLFxuICAgICAgICB1c2VyQWdlbnRzRGlyLFxuICAgICAgICBwcm9qZWN0QWdlbnRzRGlyLFxuICAgICAgICB1c2VyRGlyRXhpc3RzLFxuICAgICAgICBwcm9qZWN0RGlyRXhpc3RzLFxuICAgICAgICBmYWlsZWRGaWxlcyxcbiAgICAgIH1cbiAgICAgIHNldEFnZW50SW5mbyhhZ2VudEluZm9EYXRhKVxuXG4gICAgICBjb25zdCB3YXJuaW5ncyA9IGF3YWl0IGNoZWNrQ29udGV4dFdhcm5pbmdzKFxuICAgICAgICB0b29scyxcbiAgICAgICAge1xuICAgICAgICAgIGFjdGl2ZUFnZW50cyxcbiAgICAgICAgICBhbGxBZ2VudHMsXG4gICAgICAgICAgZmFpbGVkRmlsZXMsXG4gICAgICAgIH0sXG4gICAgICAgIGFzeW5jICgpID0+IHRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgIClcbiAgICAgIHNldENvbnRleHRXYXJuaW5ncyh3YXJuaW5ncylcblxuICAgICAgLy8gRmV0Y2ggdmVyc2lvbiBsb2NrIGluZm8gaWYgUElELWJhc2VkIGxvY2tpbmcgaXMgZW5hYmxlZFxuICAgICAgaWYgKGlzUGlkQmFzZWRMb2NraW5nRW5hYmxlZCgpKSB7XG4gICAgICAgIGNvbnN0IGxvY2tzRGlyID0gam9pbihnZXRYREdTdGF0ZUhvbWUoKSwgJ2NsYXVkZScsICdsb2NrcycpXG4gICAgICAgIGNvbnN0IHN0YWxlTG9ja3NDbGVhbmVkID0gY2xlYW51cFN0YWxlTG9ja3MobG9ja3NEaXIpXG4gICAgICAgIGNvbnN0IGxvY2tzID0gZ2V0QWxsTG9ja0luZm8obG9ja3NEaXIpXG4gICAgICAgIHNldFZlcnNpb25Mb2NrSW5mbyh7XG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBsb2NrcyxcbiAgICAgICAgICBsb2Nrc0RpcixcbiAgICAgICAgICBzdGFsZUxvY2tzQ2xlYW5lZCxcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFZlcnNpb25Mb2NrSW5mbyh7XG4gICAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgICAgbG9ja3M6IFtdLFxuICAgICAgICAgIGxvY2tzRGlyOiAnJyxcbiAgICAgICAgICBzdGFsZUxvY2tzQ2xlYW5lZDogMCxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KSgpXG4gIH0sIFt0b29sUGVybWlzc2lvbkNvbnRleHQsIHRvb2xzLCBhZ2VudERlZmluaXRpb25zXSlcblxuICBjb25zdCBoYW5kbGVEaXNtaXNzID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIG9uRG9uZSgnQ2xhdWRlIENvZGUgZGlhZ25vc3RpY3MgZGlzbWlzc2VkJywgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICB9LCBbb25Eb25lXSlcblxuICAvLyBIYW5kbGUgZGlzbWlzcyB2aWEga2V5YmluZGluZ3MgKEVudGVyLCBFc2NhcGUsIG9yIEN0cmwrQylcbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ2NvbmZpcm06eWVzJzogaGFuZGxlRGlzbWlzcyxcbiAgICAgICdjb25maXJtOm5vJzogaGFuZGxlRGlzbWlzcyxcbiAgICB9LFxuICAgIHsgY29udGV4dDogJ0NvbmZpcm1hdGlvbicgfSxcbiAgKVxuXG4gIC8vIExvYWRpbmcgc3RhdGVcbiAgaWYgKCFkaWFnbm9zdGljKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxQYW5lPlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5DaGVja2luZyBpbnN0YWxsYXRpb24gc3RhdHVz4oCmPC9UZXh0PlxuICAgICAgPC9QYW5lPlxuICAgIClcbiAgfVxuXG4gIC8vIEZvcm1hdCB0aGUgZGlhZ25vc3RpYyBvdXRwdXQgYWNjb3JkaW5nIHRvIHNwZWNcbiAgcmV0dXJuIChcbiAgICA8UGFuZT5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8VGV4dCBib2xkPkRpYWdub3N0aWNzPC9UZXh0PlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICDilJQgQ3VycmVudGx5IHJ1bm5pbmc6IHtkaWFnbm9zdGljLmluc3RhbGxhdGlvblR5cGV9IChcbiAgICAgICAgICB7ZGlhZ25vc3RpYy52ZXJzaW9ufSlcbiAgICAgICAgPC9UZXh0PlxuICAgICAgICB7ZGlhZ25vc3RpYy5wYWNrYWdlTWFuYWdlciAmJiAoXG4gICAgICAgICAgPFRleHQ+4pSUIFBhY2thZ2UgbWFuYWdlcjoge2RpYWdub3N0aWMucGFja2FnZU1hbmFnZXJ9PC9UZXh0PlxuICAgICAgICApfVxuICAgICAgICA8VGV4dD7ilJQgUGF0aDoge2RpYWdub3N0aWMuaW5zdGFsbGF0aW9uUGF0aH08L1RleHQ+XG4gICAgICAgIDxUZXh0PuKUlCBJbnZva2VkOiB7ZGlhZ25vc3RpYy5pbnZva2VkQmluYXJ5fTwvVGV4dD5cbiAgICAgICAgPFRleHQ+4pSUIENvbmZpZyBpbnN0YWxsIG1ldGhvZDoge2RpYWdub3N0aWMuY29uZmlnSW5zdGFsbE1ldGhvZH08L1RleHQ+XG4gICAgICAgIDxUZXh0PlxuICAgICAgICAgIOKUlCBTZWFyY2g6IHtkaWFnbm9zdGljLnJpcGdyZXBTdGF0dXMud29ya2luZyA/ICdPSycgOiAnTm90IHdvcmtpbmcnfSAoXG4gICAgICAgICAge2RpYWdub3N0aWMucmlwZ3JlcFN0YXR1cy5tb2RlID09PSAnZW1iZWRkZWQnXG4gICAgICAgICAgICA/ICdidW5kbGVkJ1xuICAgICAgICAgICAgOiBkaWFnbm9zdGljLnJpcGdyZXBTdGF0dXMubW9kZSA9PT0gJ2J1aWx0aW4nXG4gICAgICAgICAgICAgID8gJ3ZlbmRvcidcbiAgICAgICAgICAgICAgOiBkaWFnbm9zdGljLnJpcGdyZXBTdGF0dXMuc3lzdGVtUGF0aCB8fCAnc3lzdGVtJ31cbiAgICAgICAgICApXG4gICAgICAgIDwvVGV4dD5cblxuICAgICAgICB7LyogU2hvdyByZWNvbW1lbmRhdGlvbiBpZiBhdXRvLXVwZGF0ZXMgYXJlIGRpc2FibGVkICovfVxuICAgICAgICB7ZGlhZ25vc3RpYy5yZWNvbW1lbmRhdGlvbiAmJiAoXG4gICAgICAgICAgPD5cbiAgICAgICAgICAgIDxUZXh0PjwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgICAgICBSZWNvbW1lbmRhdGlvbjoge2RpYWdub3N0aWMucmVjb21tZW5kYXRpb24uc3BsaXQoJ1xcbicpWzBdfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2RpYWdub3N0aWMucmVjb21tZW5kYXRpb24uc3BsaXQoJ1xcbicpWzFdfTwvVGV4dD5cbiAgICAgICAgICA8Lz5cbiAgICAgICAgKX1cblxuICAgICAgICB7LyogU2hvdyBtdWx0aXBsZSBpbnN0YWxsYXRpb25zIHdhcm5pbmcgKi99XG4gICAgICAgIHtkaWFnbm9zdGljLm11bHRpcGxlSW5zdGFsbGF0aW9ucy5sZW5ndGggPiAxICYmIChcbiAgICAgICAgICA8PlxuICAgICAgICAgICAgPFRleHQ+PC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJ3YXJuaW5nXCI+V2FybmluZzogTXVsdGlwbGUgaW5zdGFsbGF0aW9ucyBmb3VuZDwvVGV4dD5cbiAgICAgICAgICAgIHtkaWFnbm9zdGljLm11bHRpcGxlSW5zdGFsbGF0aW9ucy5tYXAoKGluc3RhbGwsIGkpID0+IChcbiAgICAgICAgICAgICAgPFRleHQga2V5PXtpfT5cbiAgICAgICAgICAgICAgICDilJQge2luc3RhbGwudHlwZX0gYXQge2luc3RhbGwucGF0aH1cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKSl9XG4gICAgICAgICAgPC8+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIFNob3cgY29uZmlndXJhdGlvbiB3YXJuaW5ncyAqL31cbiAgICAgICAge2RpYWdub3N0aWMud2FybmluZ3MubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgPD5cbiAgICAgICAgICAgIDxUZXh0PjwvVGV4dD5cbiAgICAgICAgICAgIHtkaWFnbm9zdGljLndhcm5pbmdzLm1hcCgod2FybmluZywgaSkgPT4gKFxuICAgICAgICAgICAgICA8Qm94IGtleT17aX0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPldhcm5pbmc6IHt3YXJuaW5nLmlzc3VlfTwvVGV4dD5cbiAgICAgICAgICAgICAgICA8VGV4dD5GaXg6IHt3YXJuaW5nLmZpeH08L1RleHQ+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKSl9XG4gICAgICAgICAgPC8+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIFNob3cgaW52YWxpZCBzZXR0aW5ncyBlcnJvcnMgKi99XG4gICAgICAgIHtlcnJvcnNFeGNsdWRpbmdNY3AubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luVG9wPXsxfSBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5JbnZhbGlkIFNldHRpbmdzPC9UZXh0PlxuICAgICAgICAgICAgPFZhbGlkYXRpb25FcnJvcnNMaXN0IGVycm9ycz17ZXJyb3JzRXhjbHVkaW5nTWNwfSAvPlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuICAgICAgPC9Cb3g+XG5cbiAgICAgIHsvKiBVcGRhdGVzIHNlY3Rpb24gKi99XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPFRleHQgYm9sZD5VcGRhdGVzPC9UZXh0PlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICDilJQgQXV0by11cGRhdGVzOnsnICd9XG4gICAgICAgICAge2RpYWdub3N0aWMucGFja2FnZU1hbmFnZXJcbiAgICAgICAgICAgID8gJ01hbmFnZWQgYnkgcGFja2FnZSBtYW5hZ2VyJ1xuICAgICAgICAgICAgOiBkaWFnbm9zdGljLmF1dG9VcGRhdGVzfVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIHtkaWFnbm9zdGljLmhhc1VwZGF0ZVBlcm1pc3Npb25zICE9PSBudWxsICYmIChcbiAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgIOKUlCBVcGRhdGUgcGVybWlzc2lvbnM6eycgJ31cbiAgICAgICAgICAgIHtkaWFnbm9zdGljLmhhc1VwZGF0ZVBlcm1pc3Npb25zID8gJ1llcycgOiAnTm8gKHJlcXVpcmVzIHN1ZG8pJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICl9XG4gICAgICAgIDxUZXh0PuKUlCBBdXRvLXVwZGF0ZSBjaGFubmVsOiB7YXV0b1VwZGF0ZXNDaGFubmVsfTwvVGV4dD5cbiAgICAgICAgPFN1c3BlbnNlIGZhbGxiYWNrPXtudWxsfT5cbiAgICAgICAgICA8RGlzdFRhZ3NEaXNwbGF5IHByb21pc2U9e2Rpc3RUYWdzUHJvbWlzZX0gLz5cbiAgICAgICAgPC9TdXNwZW5zZT5cbiAgICAgIDwvQm94PlxuXG4gICAgICA8U2FuZGJveERvY3RvclNlY3Rpb24gLz5cblxuICAgICAgPE1jcFBhcnNpbmdXYXJuaW5ncyAvPlxuXG4gICAgICA8S2V5YmluZGluZ1dhcm5pbmdzIC8+XG5cbiAgICAgIHsvKiBFbnZpcm9ubWVudCBWYXJpYWJsZXMgKi99XG4gICAgICB7ZW52VmFsaWRhdGlvbkVycm9ycy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgPFRleHQgYm9sZD5FbnZpcm9ubWVudCBWYXJpYWJsZXM8L1RleHQ+XG4gICAgICAgICAge2VudlZhbGlkYXRpb25FcnJvcnMubWFwKCh2YWxpZGF0aW9uLCBpKSA9PiAoXG4gICAgICAgICAgICA8VGV4dCBrZXk9e2l9PlxuICAgICAgICAgICAgICDilJQge3ZhbGlkYXRpb24ubmFtZX06eycgJ31cbiAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICBjb2xvcj17dmFsaWRhdGlvbi5zdGF0dXMgPT09ICdjYXBwZWQnID8gJ3dhcm5pbmcnIDogJ2Vycm9yJ31cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHt2YWxpZGF0aW9uLm1lc3NhZ2V9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApKX1cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICB7LyogVmVyc2lvbiBMb2NrcyAoUElELWJhc2VkIGxvY2tpbmcpICovfVxuICAgICAge3ZlcnNpb25Mb2NrSW5mbz8uZW5hYmxlZCAmJiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxUZXh0IGJvbGQ+VmVyc2lvbiBMb2NrczwvVGV4dD5cbiAgICAgICAgICB7dmVyc2lvbkxvY2tJbmZvLnN0YWxlTG9ja3NDbGVhbmVkID4gMCAmJiAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAg4pSUIENsZWFuZWQge3ZlcnNpb25Mb2NrSW5mby5zdGFsZUxvY2tzQ2xlYW5lZH0gc3RhbGUgbG9jayhzKVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICl9XG4gICAgICAgICAge3ZlcnNpb25Mb2NrSW5mby5sb2Nrcy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj7ilJQgTm8gYWN0aXZlIHZlcnNpb24gbG9ja3M8L1RleHQ+XG4gICAgICAgICAgKSA6IChcbiAgICAgICAgICAgIHZlcnNpb25Mb2NrSW5mby5sb2Nrcy5tYXAoKGxvY2ssIGkpID0+IChcbiAgICAgICAgICAgICAgPFRleHQga2V5PXtpfT5cbiAgICAgICAgICAgICAgICDilJQge2xvY2sudmVyc2lvbn06IFBJRCB7bG9jay5waWR9eycgJ31cbiAgICAgICAgICAgICAgICB7bG9jay5pc1Byb2Nlc3NSdW5uaW5nID8gKFxuICAgICAgICAgICAgICAgICAgPFRleHQ+KHJ1bm5pbmcpPC9UZXh0PlxuICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj4oc3RhbGUpPC9UZXh0PlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICkpXG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICB7YWdlbnRJbmZvPy5mYWlsZWRGaWxlcyAmJiBhZ2VudEluZm8uZmFpbGVkRmlsZXMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxUZXh0IGJvbGQgY29sb3I9XCJlcnJvclwiPlxuICAgICAgICAgICAgQWdlbnQgUGFyc2UgRXJyb3JzXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj5cbiAgICAgICAgICAgIOKUlCBGYWlsZWQgdG8gcGFyc2Uge2FnZW50SW5mby5mYWlsZWRGaWxlcy5sZW5ndGh9IGFnZW50IGZpbGUocyk6XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIHthZ2VudEluZm8uZmFpbGVkRmlsZXMubWFwKChmaWxlLCBpKSA9PiAoXG4gICAgICAgICAgICA8VGV4dCBrZXk9e2l9IGRpbUNvbG9yPlxuICAgICAgICAgICAgICB7JyAgJ33ilJQge2ZpbGUucGF0aH06IHtmaWxlLmVycm9yfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBQbHVnaW4gRXJyb3JzICovfVxuICAgICAge3BsdWdpbnNFcnJvcnMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxUZXh0IGJvbGQgY29sb3I9XCJlcnJvclwiPlxuICAgICAgICAgICAgUGx1Z2luIEVycm9yc1xuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+XG4gICAgICAgICAgICDilJQge3BsdWdpbnNFcnJvcnMubGVuZ3RofSBwbHVnaW4gZXJyb3IocykgZGV0ZWN0ZWQ6XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIHtwbHVnaW5zRXJyb3JzLm1hcCgoZXJyb3IsIGkpID0+IChcbiAgICAgICAgICAgIDxUZXh0IGtleT17aX0gZGltQ29sb3I+XG4gICAgICAgICAgICAgIHsnICAnfeKUlCB7ZXJyb3Iuc291cmNlIHx8ICd1bmtub3duJ31cbiAgICAgICAgICAgICAgeydwbHVnaW4nIGluIGVycm9yICYmIGVycm9yLnBsdWdpbiA/IGAgWyR7ZXJyb3IucGx1Z2lufV1gIDogJyd9OnsnICd9XG4gICAgICAgICAgICAgIHtnZXRQbHVnaW5FcnJvck1lc3NhZ2UoZXJyb3IpfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBVbnJlYWNoYWJsZSBQZXJtaXNzaW9uIFJ1bGVzIFdhcm5pbmcgKi99XG4gICAgICB7Y29udGV4dFdhcm5pbmdzPy51bnJlYWNoYWJsZVJ1bGVzV2FybmluZyAmJiAoXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxUZXh0IGJvbGQgY29sb3I9XCJ3YXJuaW5nXCI+XG4gICAgICAgICAgICBVbnJlYWNoYWJsZSBQZXJtaXNzaW9uIFJ1bGVzXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAg4pSUeycgJ31cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgICAgICB7ZmlndXJlcy53YXJuaW5nfXsnICd9XG4gICAgICAgICAgICAgIHtjb250ZXh0V2FybmluZ3MudW5yZWFjaGFibGVSdWxlc1dhcm5pbmcubWVzc2FnZX1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAge2NvbnRleHRXYXJuaW5ncy51bnJlYWNoYWJsZVJ1bGVzV2FybmluZy5kZXRhaWxzLm1hcCgoZGV0YWlsLCBpKSA9PiAoXG4gICAgICAgICAgICA8VGV4dCBrZXk9e2l9IGRpbUNvbG9yPlxuICAgICAgICAgICAgICB7JyAgJ33ilJQge2RldGFpbH1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApKX1cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICB7LyogQ29udGV4dCBVc2FnZSBXYXJuaW5ncyAqL31cbiAgICAgIHtjb250ZXh0V2FybmluZ3MgJiZcbiAgICAgICAgKGNvbnRleHRXYXJuaW5ncy5jbGF1ZGVNZFdhcm5pbmcgfHxcbiAgICAgICAgICBjb250ZXh0V2FybmluZ3MuYWdlbnRXYXJuaW5nIHx8XG4gICAgICAgICAgY29udGV4dFdhcm5pbmdzLm1jcFdhcm5pbmcpICYmIChcbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIDxUZXh0IGJvbGQ+Q29udGV4dCBVc2FnZSBXYXJuaW5nczwvVGV4dD5cblxuICAgICAgICAgICAge2NvbnRleHRXYXJuaW5ncy5jbGF1ZGVNZFdhcm5pbmcgJiYgKFxuICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAg4pSUeycgJ31cbiAgICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgICAgICAgICAgICB7ZmlndXJlcy53YXJuaW5nfSB7Y29udGV4dFdhcm5pbmdzLmNsYXVkZU1kV2FybmluZy5tZXNzYWdlfVxuICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICA8VGV4dD57JyAgJ33ilJQgRmlsZXM6PC9UZXh0PlxuICAgICAgICAgICAgICAgIHtjb250ZXh0V2FybmluZ3MuY2xhdWRlTWRXYXJuaW5nLmRldGFpbHMubWFwKChkZXRhaWwsIGkpID0+IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGtleT17aX0gZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgIHsnICAgICd94pSUIHtkZXRhaWx9XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAge2NvbnRleHRXYXJuaW5ncy5hZ2VudFdhcm5pbmcgJiYgKFxuICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAg4pSUeycgJ31cbiAgICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgICAgICAgICAgICB7ZmlndXJlcy53YXJuaW5nfSB7Y29udGV4dFdhcm5pbmdzLmFnZW50V2FybmluZy5tZXNzYWdlfVxuICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICA8VGV4dD57JyAgJ33ilJQgVG9wIGNvbnRyaWJ1dG9yczo8L1RleHQ+XG4gICAgICAgICAgICAgICAge2NvbnRleHRXYXJuaW5ncy5hZ2VudFdhcm5pbmcuZGV0YWlscy5tYXAoKGRldGFpbCwgaSkgPT4gKFxuICAgICAgICAgICAgICAgICAgPFRleHQga2V5PXtpfSBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAgeycgICAgJ33ilJQge2RldGFpbH1cbiAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICApfVxuXG4gICAgICAgICAgICB7Y29udGV4dFdhcm5pbmdzLm1jcFdhcm5pbmcgJiYgKFxuICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAg4pSUeycgJ31cbiAgICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgICAgICAgICAgICB7ZmlndXJlcy53YXJuaW5nfSB7Y29udGV4dFdhcm5pbmdzLm1jcFdhcm5pbmcubWVzc2FnZX1cbiAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQ+eycgICd94pSUIE1DUCBzZXJ2ZXJzOjwvVGV4dD5cbiAgICAgICAgICAgICAgICB7Y29udGV4dFdhcm5pbmdzLm1jcFdhcm5pbmcuZGV0YWlscy5tYXAoKGRldGFpbCwgaSkgPT4gKFxuICAgICAgICAgICAgICAgICAgPFRleHQga2V5PXtpfSBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAgeycgICAgJ33ilJQge2RldGFpbH1cbiAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuXG4gICAgICA8Qm94PlxuICAgICAgICA8UHJlc3NFbnRlclRvQ29udGludWUgLz5cbiAgICAgIDwvQm94PlxuICAgIDwvUGFuZT5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsT0FBT0EsT0FBTyxNQUFNLFNBQVM7QUFDN0IsU0FBU0MsSUFBSSxRQUFRLE1BQU07QUFDM0IsT0FBT0MsS0FBSyxJQUNWQyxRQUFRLEVBQ1JDLEdBQUcsRUFDSEMsV0FBVyxFQUNYQyxTQUFTLEVBQ1RDLE9BQU8sRUFDUEMsUUFBUSxRQUNILE9BQU87QUFDZCxTQUFTQyxrQkFBa0IsUUFBUSxzQ0FBc0M7QUFDekUsU0FBU0Msa0JBQWtCLFFBQVEsMENBQTBDO0FBQzdFLFNBQVNDLHVCQUF1QixRQUFRLHNCQUFzQjtBQUM5RCxTQUFTQyxzQkFBc0IsUUFBUSx1QkFBdUI7QUFDOUQsY0FBY0MsYUFBYSxRQUFRLGlDQUFpQztBQUNwRSxTQUFTQyxjQUFjLFFBQVEsdUJBQXVCO0FBQ3RELGNBQWNDLG9C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