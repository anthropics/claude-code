import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import { toString as qrToString } from 'qrcode';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { getBridgeAccessToken } from '../../bridge/bridgeConfig.js';
import { checkBridgeMinVersion, getBridgeDisabledReason, isEnvLessBridgeEnabled } from '../../bridge/bridgeEnabled.js';
import { checkEnvLessBridgeMinVersion } from '../../bridge/envLessBridgeConfig.js';
import { BRIDGE_LOGIN_INSTRUCTION, REMOTE_CONTROL_DISCONNECTED_MSG } from '../../bridge/types.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { ListItem } from '../../components/design-system/ListItem.js';
import { shouldShowRemoteCallout } from '../../components/RemoteCallout.js';
import { useRegisterOverlay } from '../../context/overlayContext.js';
import { Box, Text } from '../../ink.js';
import { useKeybindings } from '../../keybindings/useKeybinding.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../../services/analytics/index.js';
import { useAppState, useSetAppState } from '../../state/AppState.js';
import type { ToolUseContext } from '../../Tool.js';
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js';
import { logForDebugging } from '../../utils/debug.js';
type Props = {
  onDone: LocalJSXCommandOnDone;
  name?: string;
};

/**
 * /remote-control command — manages the bidirectional bridge connection.
 *
 * When enabled, sets replBridgeEnabled in AppState, which triggers
 * useReplBridge in REPL.tsx to initialize the bridge connection.
 * The bridge registers an environment, creates a session with the current
 * conversation, polls for work, and connects an ingress WebSocket for
 * bidirectional messaging between the CLI and claude.ai.
 *
 * Running /remote-control when already connected shows a dialog with the session
 * URL and options to disconnect or continue.
 */
function BridgeToggle(t0) {
  const $ = _c(10);
  const {
    onDone,
    name
  } = t0;
  const setAppState = useSetAppState();
  const replBridgeConnected = useAppState(_temp);
  const replBridgeEnabled = useAppState(_temp2);
  const replBridgeOutboundOnly = useAppState(_temp3);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  let t1;
  if ($[0] !== name || $[1] !== onDone || $[2] !== replBridgeConnected || $[3] !== replBridgeEnabled || $[4] !== replBridgeOutboundOnly || $[5] !== setAppState) {
    t1 = () => {
      if ((replBridgeConnected || replBridgeEnabled) && !replBridgeOutboundOnly) {
        setShowDisconnectDialog(true);
        return;
      }
      let cancelled = false;
      (async () => {
        const error = await checkBridgePrerequisites();
        if (cancelled) {
          return;
        }
        if (error) {
          logEvent("tengu_bridge_command", {
            action: "preflight_failed" as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
          onDone(error, {
            display: "system"
          });
          return;
        }
        if (shouldShowRemoteCallout()) {
          setAppState(prev => {
            if (prev.showRemoteCallout) {
              return prev;
            }
            return {
              ...prev,
              showRemoteCallout: true,
              replBridgeInitialName: name
            };
          });
          onDone("", {
            display: "system"
          });
          return;
        }
        logEvent("tengu_bridge_command", {
          action: "connect" as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
        setAppState(prev_0 => {
          if (prev_0.replBridgeEnabled && !prev_0.replBridgeOutboundOnly) {
            return prev_0;
          }
          return {
            ...prev_0,
            replBridgeEnabled: true,
            replBridgeExplicit: true,
            replBridgeOutboundOnly: false,
            replBridgeInitialName: name
          };
        });
        onDone("Remote Control connecting\u2026", {
          display: "system"
        });
      })();
      return () => {
        cancelled = true;
      };
    };
    $[0] = name;
    $[1] = onDone;
    $[2] = replBridgeConnected;
    $[3] = replBridgeEnabled;
    $[4] = replBridgeOutboundOnly;
    $[5] = setAppState;
    $[6] = t1;
  } else {
    t1 = $[6];
  }
  let t2;
  if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = [];
    $[7] = t2;
  } else {
    t2 = $[7];
  }
  useEffect(t1, t2);
  if (showDisconnectDialog) {
    let t3;
    if ($[8] !== onDone) {
      t3 = <BridgeDisconnectDialog onDone={onDone} />;
      $[8] = onDone;
      $[9] = t3;
    } else {
      t3 = $[9];
    }
    return t3;
  }
  return null;
}

/**
 * Dialog shown when /remote-control is used while the bridge is already connected.
 * Shows the session URL and lets the user disconnect or continue.
 */
function _temp3(s_1) {
  return s_1.replBridgeOutboundOnly;
}
function _temp2(s_0) {
  return s_0.replBridgeEnabled;
}
function _temp(s) {
  return s.replBridgeConnected;
}
function BridgeDisconnectDialog(t0) {
  const $ = _c(61);
  const {
    onDone
  } = t0;
  useRegisterOverlay("bridge-disconnect-dialog");
  const setAppState = useSetAppState();
  const sessionUrl = useAppState(_temp4);
  const connectUrl = useAppState(_temp5);
  const sessionActive = useAppState(_temp6);
  const [focusIndex, setFocusIndex] = useState(2);
  const [showQR, setShowQR] = useState(false);
  const [qrText, setQrText] = useState("");
  const displayUrl = sessionActive ? sessionUrl : connectUrl;
  let t1;
  let t2;
  if ($[0] !== displayUrl || $[1] !== showQR) {
    t1 = () => {
      if (!showQR || !displayUrl) {
        setQrText("");
        return;
      }
      qrToString(displayUrl, {
        type: "utf8",
        errorCorrectionLevel: "L",
        small: true
      }).then(setQrText).catch(() => setQrText(""));
    };
    t2 = [showQR, displayUrl];
    $[0] = displayUrl;
    $[1] = showQR;
    $[2] = t1;
    $[3] = t2;
  } else {
    t1 = $[2];
    t2 = $[3];
  }
  useEffect(t1, t2);
  let t3;
  if ($[4] !== onDone || $[5] !== setAppState) {
    t3 = function handleDisconnect() {
      setAppState(_temp7);
      logEvent("tengu_bridge_command", {
        action: "disconnect" as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      onDone(REMOTE_CONTROL_DISCONNECTED_MSG, {
        display: "system"
      });
    };
    $[4] = onDone;
    $[5] = setAppState;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  const handleDisconnect = t3;
  let t4;
  if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
    t4 = function handleShowQR() {
      setShowQR(_temp8);
    };
    $[7] = t4;
  } else {
    t4 = $[7];
  }
  const handleShowQR = t4;
  let t5;
  if ($[8] !== onDone) {
    t5 = function handleContinue() {
      onDone(undefined, {
        display: "skip"
      });
    };
    $[8] = onDone;
    $[9] = t5;
  } else {
    t5 = $[9];
  }
  const handleContinue = t5;
  let t6;
  let t7;
  if ($[10] === Symbol.for("react.memo_cache_sentinel")) {
    t6 = () => setFocusIndex(_temp9);
    t7 = () => setFocusIndex(_temp0);
    $[10] = t6;
    $[11] = t7;
  } else {
    t6 = $[10];
    t7 = $[11];
  }
  let t8;
  if ($[12] !== focusIndex || $[13] !== handleContinue || $[14] !== handleDisconnect) {
    t8 = {
      "select:next": t6,
      "select:previous": t7,
      "select:accept": () => {
        if (focusIndex === 0) {
          handleDisconnect();
        } else {
          if (focusIndex === 1) {
            handleShowQR();
          } else {
            handleContinue();
          }
        }
      }
    };
    $[12] = focusIndex;
    $[13] = handleContinue;
    $[14] = handleDisconnect;
    $[15] = t8;
  } else {
    t8 = $[15];
  }
  let t9;
  if ($[16] === Symbol.for("react.memo_cache_sentinel")) {
    t9 = {
      context: "Select"
    };
    $[16] = t9;
  } else {
    t9 = $[16];
  }
  useKeybindings(t8, t9);
  let T0;
  let T1;
  let t10;
  let t11;
  let t12;
  let t13;
  let t14;
  let t15;
  let t16;
  if ($[17] !== displayUrl || $[18] !== handleContinue || $[19] !== qrText || $[20] !== showQR) {
    const qrLines = qrText ? qrText.split("\n").filter(_temp1) : [];
    T1 = Dialog;
    t14 = "Remote Control";
    t15 = handleContinue;
    t16 = true;
    T0 = Box;
    t10 = "column";
    t11 = 1;
    const t17 = displayUrl ? ` at ${displayUrl}` : "";
    if ($[30] !== t17) {
      t12 = <Text>This session is available via Remote Control{t17}.</Text>;
      $[30] = t17;
      $[31] = t12;
    } else {
      t12 = $[31];
    }
    t13 = showQR && qrLines.length > 0 && <Box flexDirection="column">{qrLines.map(_temp10)}</Box>;
    $[17] = displayUrl;
    $[18] = handleContinue;
    $[19] = qrText;
    $[20] = showQR;
    $[21] = T0;
    $[22] = T1;
    $[23] = t10;
    $[24] = t11;
    $[25] = t12;
    $[26] = t13;
    $[27] = t14;
    $[28] = t15;
    $[29] = t16;
  } else {
    T0 = $[21];
    T1 = $[22];
    t10 = $[23];
    t11 = $[24];
    t12 = $[25];
    t13 = $[26];
    t14 = $[27];
    t15 = $[28];
    t16 = $[29];
  }
  const t17 = focusIndex === 0;
  let t18;
  if ($[32] === Symbol.for("react.memo_cache_sentinel")) {
    t18 = <Text>Disconnect this session</Text>;
    $[32] = t18;
  } else {
    t18 = $[32];
  }
  let t19;
  if ($[33] !== t17) {
    t19 = <ListItem isFocused={t17}>{t18}</ListItem>;
    $[33] = t17;
    $[34] = t19;
  } else {
    t19 = $[34];
  }
  const t20 = focusIndex === 1;
  const t21 = showQR ? "Hide QR code" : "Show QR code";
  let t22;
  if ($[35] !== t21) {
    t22 = <Text>{t21}</Text>;
    $[35] = t21;
    $[36] = t22;
  } else {
    t22 = $[36];
  }
  let t23;
  if ($[37] !== t20 || $[38] !== t22) {
    t23 = <ListItem isFocused={t20}>{t22}</ListItem>;
    $[37] = t20;
    $[38] = t22;
    $[39] = t23;
  } else {
    t23 = $[39];
  }
  const t24 = focusIndex === 2;
  let t25;
  if ($[40] === Symbol.for("react.memo_cache_sentinel")) {
    t25 = <Text>Continue</Text>;
    $[40] = t25;
  } else {
    t25 = $[40];
  }
  let t26;
  if ($[41] !== t24) {
    t26 = <ListItem isFocused={t24}>{t25}</ListItem>;
    $[41] = t24;
    $[42] = t26;
  } else {
    t26 = $[42];
  }
  let t27;
  if ($[43] !== t19 || $[44] !== t23 || $[45] !== t26) {
    t27 = <Box flexDirection="column">{t19}{t23}{t26}</Box>;
    $[43] = t19;
    $[44] = t23;
    $[45] = t26;
    $[46] = t27;
  } else {
    t27 = $[46];
  }
  let t28;
  if ($[47] === Symbol.for("react.memo_cache_sentinel")) {
    t28 = <Text dimColor={true}>Enter to select · Esc to continue</Text>;
    $[47] = t28;
  } else {
    t28 = $[47];
  }
  let t29;
  if ($[48] !== T0 || $[49] !== t10 || $[50] !== t11 || $[51] !== t12 || $[52] !== t13 || $[53] !== t27) {
    t29 = <T0 flexDirection={t10} gap={t11}>{t12}{t13}{t27}{t28}</T0>;
    $[48] = T0;
    $[49] = t10;
    $[50] = t11;
    $[51] = t12;
    $[52] = t13;
    $[53] = t27;
    $[54] = t29;
  } else {
    t29 = $[54];
  }
  let t30;
  if ($[55] !== T1 || $[56] !== t14 || $[57] !== t15 || $[58] !== t16 || $[59] !== t29) {
    t30 = <T1 title={t14} onCancel={t15} hideInputGuide={t16}>{t29}</T1>;
    $[55] = T1;
    $[56] = t14;
    $[57] = t15;
    $[58] = t16;
    $[59] = t29;
    $[60] = t30;
  } else {
    t30 = $[60];
  }
  return t30;
}

/**
 * Check bridge prerequisites. Returns an error message if a precondition
 * fails, or null if all checks pass. Awaits GrowthBook init if the disk
 * cache is stale, so a user who just became entitled (e.g. upgraded to Max,
 * or the flag just launched) gets an accurate result on the first try.
 */
function _temp10(line, i_1) {
  return <Text key={i_1}>{line}</Text>;
}
function _temp1(l) {
  return l.length > 0;
}
function _temp0(i_0) {
  return (i_0 - 1 + 3) % 3;
}
function _temp9(i) {
  return (i + 1) % 3;
}
function _temp8(prev_0) {
  return !prev_0;
}
function _temp7(prev) {
  if (!prev.replBridgeEnabled) {
    return prev;
  }
  return {
    ...prev,
    replBridgeEnabled: false,
    replBridgeExplicit: false,
    replBridgeOutboundOnly: false
  };
}
function _temp6(s_1) {
  return s_1.replBridgeSessionActive;
}
function _temp5(s_0) {
  return s_0.replBridgeConnectUrl;
}
function _temp4(s) {
  return s.replBridgeSessionUrl;
}
async function checkBridgePrerequisites(): Promise<string | null> {
  // Check organization policy — remote control may be disabled
  const {
    waitForPolicyLimitsToLoad,
    isPolicyAllowed
  } = await import('../../services/policyLimits/index.js');
  await waitForPolicyLimitsToLoad();
  if (!isPolicyAllowed('allow_remote_control')) {
    return "Remote Control is disabled by your organization's policy.";
  }
  const disabledReason = await getBridgeDisabledReason();
  if (disabledReason) {
    return disabledReason;
  }

  // Mirror the v1/v2 branching logic in initReplBridge: env-less (v2) is used
  // only when the flag is on AND the session is not perpetual.  In assistant
  // mode (KAIROS) useReplBridge sets perpetual=true, which forces
  // initReplBridge onto the v1 path — so the prerequisite check must match.
  let useV2 = isEnvLessBridgeEnabled();
  if (feature('KAIROS') && useV2) {
    const {
      isAssistantMode
    } = await import('../../assistant/index.js');
    if (isAssistantMode()) {
      useV2 = false;
    }
  }
  const versionError = useV2 ? await checkEnvLessBridgeMinVersion() : checkBridgeMinVersion();
  if (versionError) {
    return versionError;
  }
  if (!getBridgeAccessToken()) {
    return BRIDGE_LOGIN_INSTRUCTION;
  }
  logForDebugging('[bridge] Prerequisites passed, enabling bridge');
  return null;
}
export async function call(onDone: LocalJSXCommandOnDone, _context: ToolUseContext & LocalJSXCommandContext, args: string): Promise<React.ReactNode> {
  const name = args.trim() || undefined;
  return <BridgeToggle onDone={onDone} name={name} />;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwidG9TdHJpbmciLCJxclRvU3RyaW5nIiwiUmVhY3QiLCJ1c2VFZmZlY3QiLCJ1c2VTdGF0ZSIsImdldEJyaWRnZUFjY2Vzc1Rva2VuIiwiY2hlY2tCcmlkZ2VNaW5WZXJzaW9uIiwiZ2V0QnJpZGdlRGlzYWJsZWRSZWFzb24iLCJpc0Vudkxlc3NCcmlkZ2VFbmFibGVkIiwiY2hlY2tFbnZMZXNzQnJpZGdlTWluVmVyc2lvbiIsIkJSSURHRV9MT0dJTl9JTlNUUlVDVElPTiIsIlJFTU9URV9DT05UUk9MX0RJU0NPTk5FQ1RFRF9NU0ciLCJEaWFsb2ciLCJMaXN0SXRlbSIsInNob3VsZFNob3dSZW1vdGVDYWxsb3V0IiwidXNlUmVnaXN0ZXJPdmVybGF5IiwiQm94IiwiVGV4dCIsInVzZUtleWJpbmRpbmdzIiwiQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyIsImxvZ0V2ZW50IiwidXNlQXBwU3RhdGUiLCJ1c2VTZXRBcHBTdGF0ZSIsIlRvb2xVc2VDb250ZXh0IiwiTG9jYWxKU1hDb21tYW5kQ29udGV4dCIsIkxvY2FsSlNYQ29tbWFuZE9uRG9uZSIsImxvZ0ZvckRlYnVnZ2luZyIsIlByb3BzIiwib25Eb25lIiwibmFtZSIsIkJyaWRnZVRvZ2dsZSIsInQwIiwiJCIsIl9jIiwic2V0QXBwU3RhdGUiLCJyZXBsQnJpZGdlQ29ubmVjdGVkIiwiX3RlbXAiLCJyZXBsQnJpZGdlRW5hYmxlZCIsIl90ZW1wMiIsInJlcGxCcmlkZ2VPdXRib3VuZE9ubHkiLCJfdGVtcDMiLCJzaG93RGlzY29ubmVjdERpYWxvZyIsInNldFNob3dEaXNjb25uZWN0RGlhbG9nIiwidDEiLCJjYW5jZWxsZWQiLCJlcnJvciIsImNoZWNrQnJpZGdlUHJlcmVxdWlzaXRlcyIsImFjdGlvbiIsImRpc3BsYXkiLCJwcmV2Iiwic2hvd1JlbW90ZUNhbGxvdXQiLCJyZXBsQnJpZGdlSW5pdGlhbE5hbWUiLCJwcmV2XzAiLCJyZXBsQnJpZGdlRXhwbGljaXQiLCJ0MiIsIlN5bWJvbCIsImZvciIsInQzIiwic18xIiwicyIsInNfMCIsIkJyaWRnZURpc2Nvbm5lY3REaWFsb2ciLCJzZXNzaW9uVXJsIiwiX3RlbXA0IiwiY29ubmVjdFVybCIsIl90ZW1wNSIsInNlc3Npb25BY3RpdmUiLCJfdGVtcDYiLCJmb2N1c0luZGV4Iiwic2V0Rm9jdXNJbmRleCIsInNob3dRUiIsInNldFNob3dRUiIsInFyVGV4dCIsInNldFFyVGV4dCIsImRpc3BsYXlVcmwiLCJ0eXBlIiwiZXJyb3JDb3JyZWN0aW9uTGV2ZWwiLCJzbWFsbCIsInRoZW4iLCJjYXRjaCIsImhhbmRsZURpc2Nvbm5lY3QiLCJfdGVtcDciLCJ0NCIsImhhbmRsZVNob3dRUiIsIl90ZW1wOCIsInQ1IiwiaGFuZGxlQ29udGludWUiLCJ1bmRlZmluZWQiLCJ0NiIsInQ3IiwiX3RlbXA5IiwiX3RlbXAwIiwidDgiLCJzZWxlY3Q6YWNjZXB0IiwidDkiLCJjb250ZXh0IiwiVDAiLCJUMSIsInQxMCIsInQxMSIsInQxMiIsInQxMyIsInQxNCIsInQxNSIsInQxNiIsInFyTGluZXMiLCJzcGxpdCIsImZpbHRlciIsIl90ZW1wMSIsInQxNyIsImxlbmd0aCIsIm1hcCIsIl90ZW1wMTAiLCJ0MTgiLCJ0MTkiLCJ0MjAiLCJ0MjEiLCJ0MjIiLCJ0MjMiLCJ0MjQiLCJ0MjUiLCJ0MjYiLCJ0MjciLCJ0MjgiLCJ0MjkiLCJ0MzAiLCJsaW5lIiwiaV8xIiwiaSIsImwiLCJpXzAiLCJyZXBsQnJpZGdlU2Vzc2lvbkFjdGl2ZSIsInJlcGxCcmlkZ2VDb25uZWN0VXJsIiwicmVwbEJyaWRnZVNlc3Npb25VcmwiLCJQcm9taXNlIiwid2FpdEZvclBvbGljeUxpbWl0c1RvTG9hZCIsImlzUG9saWN5QWxsb3dlZCIsImRpc2FibGVkUmVhc29uIiwidXNlVjIiLCJpc0Fzc2lzdGFudE1vZGUiLCJ2ZXJzaW9uRXJyb3IiLCJjYWxsIiwiX2NvbnRleHQiLCJhcmdzIiwiUmVhY3ROb2RlIiwidHJpbSJdLCJzb3VyY2VzIjpbImJyaWRnZS50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZmVhdHVyZSB9IGZyb20gJ2J1bjpidW5kbGUnXG5pbXBvcnQgeyB0b1N0cmluZyBhcyBxclRvU3RyaW5nIH0gZnJvbSAncXJjb2RlJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyBnZXRCcmlkZ2VBY2Nlc3NUb2tlbiB9IGZyb20gJy4uLy4uL2JyaWRnZS9icmlkZ2VDb25maWcuanMnXG5pbXBvcnQge1xuICBjaGVja0JyaWRnZU1pblZlcnNpb24sXG4gIGdldEJyaWRnZURpc2FibGVkUmVhc29uLFxuICBpc0Vudkxlc3NCcmlkZ2VFbmFibGVkLFxufSBmcm9tICcuLi8uLi9icmlkZ2UvYnJpZGdlRW5hYmxlZC5qcydcbmltcG9ydCB7IGNoZWNrRW52TGVzc0JyaWRnZU1pblZlcnNpb24gfSBmcm9tICcuLi8uLi9icmlkZ2UvZW52TGVzc0JyaWRnZUNvbmZpZy5qcydcbmltcG9ydCB7XG4gIEJSSURHRV9MT0dJTl9JTlNUUlVDVElPTixcbiAgUkVNT1RFX0NPTlRST0xfRElTQ09OTkVDVEVEX01TRyxcbn0gZnJvbSAnLi4vLi4vYnJpZGdlL3R5cGVzLmpzJ1xuaW1wb3J0IHsgRGlhbG9nIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9kZXNpZ24tc3lzdGVtL0RpYWxvZy5qcydcbmltcG9ydCB7IExpc3RJdGVtIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9kZXNpZ24tc3lzdGVtL0xpc3RJdGVtLmpzJ1xuaW1wb3J0IHsgc2hvdWxkU2hvd1JlbW90ZUNhbGxvdXQgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL1JlbW90ZUNhbGxvdXQuanMnXG5pbXBvcnQgeyB1c2VSZWdpc3Rlck92ZXJsYXkgfSBmcm9tICcuLi8uLi9jb250ZXh0L292ZXJsYXlDb250ZXh0LmpzJ1xuaW1wb3J0IHsgQm94LCBUZXh0IH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlS2V5YmluZGluZ3MgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnLi4vLi4vc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJ1xuaW1wb3J0IHsgdXNlQXBwU3RhdGUsIHVzZVNldEFwcFN0YXRlIH0gZnJvbSAnLi4vLi4vc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgdHlwZSB7IFRvb2xVc2VDb250ZXh0IH0gZnJvbSAnLi4vLi4vVG9vbC5qcydcbmltcG9ydCB0eXBlIHtcbiAgTG9jYWxKU1hDb21tYW5kQ29udGV4dCxcbiAgTG9jYWxKU1hDb21tYW5kT25Eb25lLFxufSBmcm9tICcuLi8uLi90eXBlcy9jb21tYW5kLmpzJ1xuaW1wb3J0IHsgbG9nRm9yRGVidWdnaW5nIH0gZnJvbSAnLi4vLi4vdXRpbHMvZGVidWcuanMnXG5cbnR5cGUgUHJvcHMgPSB7XG4gIG9uRG9uZTogTG9jYWxKU1hDb21tYW5kT25Eb25lXG4gIG5hbWU/OiBzdHJpbmdcbn1cblxuLyoqXG4gKiAvcmVtb3RlLWNvbnRyb2wgY29tbWFuZCDigJQgbWFuYWdlcyB0aGUgYmlkaXJlY3Rpb25hbCBicmlkZ2UgY29ubmVjdGlvbi5cbiAqXG4gKiBXaGVuIGVuYWJsZWQsIHNldHMgcmVwbEJyaWRnZUVuYWJsZWQgaW4gQXBwU3RhdGUsIHdoaWNoIHRyaWdnZXJzXG4gKiB1c2VSZXBsQnJpZGdlIGluIFJFUEwudHN4IHRvIGluaXRpYWxpemUgdGhlIGJyaWRnZSBjb25uZWN0aW9uLlxuICogVGhlIGJyaWRnZSByZWdpc3RlcnMgYW4gZW52aXJvbm1lbnQsIGNyZWF0ZXMgYSBzZXNzaW9uIHdpdGggdGhlIGN1cnJlbnRcbiAqIGNvbnZlcnNhdGlvbiwgcG9sbHMgZm9yIHdvcmssIGFuZCBjb25uZWN0cyBhbiBpbmdyZXNzIFdlYlNvY2tldCBmb3JcbiAqIGJpZGlyZWN0aW9uYWwgbWVzc2FnaW5nIGJldHdlZW4gdGhlIENMSSBhbmQgY2xhdWRlLmFpLlxuICpcbiAqIFJ1bm5pbmcgL3JlbW90ZS1jb250cm9sIHdoZW4gYWxyZWFkeSBjb25uZWN0ZWQgc2hvd3MgYSBkaWFsb2cgd2l0aCB0aGUgc2Vzc2lvblxuICogVVJMIGFuZCBvcHRpb25zIHRvIGRpc2Nvbm5lY3Qgb3IgY29udGludWUuXG4gKi9cbmZ1bmN0aW9uIEJyaWRnZVRvZ2dsZSh7IG9uRG9uZSwgbmFtZSB9OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHNldEFwcFN0YXRlID0gdXNlU2V0QXBwU3RhdGUoKVxuICBjb25zdCByZXBsQnJpZGdlQ29ubmVjdGVkID0gdXNlQXBwU3RhdGUocyA9PiBzLnJlcGxCcmlkZ2VDb25uZWN0ZWQpXG4gIGNvbnN0IHJlcGxCcmlkZ2VFbmFibGVkID0gdXNlQXBwU3RhdGUocyA9PiBzLnJlcGxCcmlkZ2VFbmFibGVkKVxuICBjb25zdCByZXBsQnJpZGdlT3V0Ym91bmRPbmx5ID0gdXNlQXBwU3RhdGUocyA9PiBzLnJlcGxCcmlkZ2VPdXRib3VuZE9ubHkpXG4gIGNvbnN0IFtzaG93RGlzY29ubmVjdERpYWxvZywgc2V0U2hvd0Rpc2Nvbm5lY3REaWFsb2ddID0gdXNlU3RhdGUoZmFsc2UpXG5cbiAgLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlRXhoYXVzdGl2ZURlcGVuZGVuY2llczogYnJpZGdlIHN0YXJ0cyBvbmNlLCBzaG91bGQgbm90IHJlc3RhcnQgb24gc3RhdGUgY2hhbmdlc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIC8vIElmIGFscmVhZHkgY29ubmVjdGVkIG9yIGVuYWJsZWQgaW4gZnVsbCBiaWRpcmVjdGlvbmFsIG1vZGUsIHNob3dcbiAgICAvLyBkaXNjb25uZWN0IGNvbmZpcm1hdGlvbi4gT3V0Ym91bmQtb25seSAoQ0NSIG1pcnJvcikgZG9lc24ndCBjb3VudCDigJRcbiAgICAvLyAvcmVtb3RlLWNvbnRyb2wgdXBncmFkZXMgaXQgdG8gZnVsbCBSQyBpbnN0ZWFkLlxuICAgIGlmICgocmVwbEJyaWRnZUNvbm5lY3RlZCB8fCByZXBsQnJpZGdlRW5hYmxlZCkgJiYgIXJlcGxCcmlkZ2VPdXRib3VuZE9ubHkpIHtcbiAgICAgIHNldFNob3dEaXNjb25uZWN0RGlhbG9nKHRydWUpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2VcbiAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAvLyBQcmUtZmxpZ2h0IGNoZWNrcyBiZWZvcmUgZW5hYmxpbmcgKGF3YWl0cyBHcm93dGhCb29rIGluaXQgaWYgZGlza1xuICAgICAgLy8gY2FjaGUgaXMgc3RhbGUg4oCUIHNvIE1heCB1c2VycyBkb24ndCBnZXQgYSBmYWxzZSBcIm5vdCBlbmFibGVkXCIgZXJyb3IpXG4gICAgICBjb25zdCBlcnJvciA9IGF3YWl0IGNoZWNrQnJpZGdlUHJlcmVxdWlzaXRlcygpXG4gICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm5cbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBsb2dFdmVudCgndGVuZ3VfYnJpZGdlX2NvbW1hbmQnLCB7XG4gICAgICAgICAgYWN0aW9uOlxuICAgICAgICAgICAgJ3ByZWZsaWdodF9mYWlsZWQnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pXG4gICAgICAgIG9uRG9uZShlcnJvciwgeyBkaXNwbGF5OiAnc3lzdGVtJyB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gU2hvdyBmaXJzdC10aW1lIHJlbW90ZSBkaWFsb2cgaWYgbm90IHlldCBzZWVuLlxuICAgICAgLy8gU3RvcmUgdGhlIG5hbWUgbm93IHNvIGl0J3MgaW4gQXBwU3RhdGUgd2hlbiB0aGUgY2FsbG91dCBoYW5kbGVyIGxhdGVyXG4gICAgICAvLyBlbmFibGVzIHRoZSBicmlkZ2UgKHRoZSBoYW5kbGVyIG9ubHkgc2V0cyByZXBsQnJpZGdlRW5hYmxlZCwgbm90IHRoZSBuYW1lKS5cbiAgICAgIGlmIChzaG91bGRTaG93UmVtb3RlQ2FsbG91dCgpKSB7XG4gICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgIGlmIChwcmV2LnNob3dSZW1vdGVDYWxsb3V0KSByZXR1cm4gcHJldlxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgc2hvd1JlbW90ZUNhbGxvdXQ6IHRydWUsXG4gICAgICAgICAgICByZXBsQnJpZGdlSW5pdGlhbE5hbWU6IG5hbWUsXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBvbkRvbmUoJycsIHsgZGlzcGxheTogJ3N5c3RlbScgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIEVuYWJsZSB0aGUgYnJpZGdlIOKAlCB1c2VSZXBsQnJpZGdlIGluIFJFUEwudHN4IGhhbmRsZXMgdGhlIHJlc3Q6XG4gICAgICAvLyByZWdpc3RlcnMgZW52aXJvbm1lbnQsIGNyZWF0ZXMgc2Vzc2lvbiB3aXRoIGNvbnZlcnNhdGlvbiwgY29ubmVjdHMgV2ViU29ja2V0XG4gICAgICBsb2dFdmVudCgndGVuZ3VfYnJpZGdlX2NvbW1hbmQnLCB7XG4gICAgICAgIGFjdGlvbjpcbiAgICAgICAgICAnY29ubmVjdCcgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIH0pXG4gICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgaWYgKHByZXYucmVwbEJyaWRnZUVuYWJsZWQgJiYgIXByZXYucmVwbEJyaWRnZU91dGJvdW5kT25seSkgcmV0dXJuIHByZXZcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIHJlcGxCcmlkZ2VFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIHJlcGxCcmlkZ2VFeHBsaWNpdDogdHJ1ZSxcbiAgICAgICAgICByZXBsQnJpZGdlT3V0Ym91bmRPbmx5OiBmYWxzZSxcbiAgICAgICAgICByZXBsQnJpZGdlSW5pdGlhbE5hbWU6IG5hbWUsXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICBvbkRvbmUoJ1JlbW90ZSBDb250cm9sIGNvbm5lY3RpbmdcXHUyMDI2Jywge1xuICAgICAgICBkaXNwbGF5OiAnc3lzdGVtJyxcbiAgICAgIH0pXG4gICAgfSkoKVxuXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNhbmNlbGxlZCA9IHRydWVcbiAgICB9XG4gIH0sIFtdKSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHJlYWN0LWhvb2tzL2V4aGF1c3RpdmUtZGVwcyAtLSBydW4gb25jZSBvbiBtb3VudFxuXG4gIGlmIChzaG93RGlzY29ubmVjdERpYWxvZykge1xuICAgIHJldHVybiA8QnJpZGdlRGlzY29ubmVjdERpYWxvZyBvbkRvbmU9e29uRG9uZX0gLz5cbiAgfVxuXG4gIHJldHVybiBudWxsXG59XG5cbi8qKlxuICogRGlhbG9nIHNob3duIHdoZW4gL3JlbW90ZS1jb250cm9sIGlzIHVzZWQgd2hpbGUgdGhlIGJyaWRnZSBpcyBhbHJlYWR5IGNvbm5lY3RlZC5cbiAqIFNob3dzIHRoZSBzZXNzaW9uIFVSTCBhbmQgbGV0cyB0aGUgdXNlciBkaXNjb25uZWN0IG9yIGNvbnRpbnVlLlxuICovXG5mdW5jdGlvbiBCcmlkZ2VEaXNjb25uZWN0RGlhbG9nKHsgb25Eb25lIH06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgdXNlUmVnaXN0ZXJPdmVybGF5KCdicmlkZ2UtZGlzY29ubmVjdC1kaWFsb2cnKVxuICBjb25zdCBzZXRBcHBTdGF0ZSA9IHVzZVNldEFwcFN0YXRlKClcbiAgY29uc3Qgc2Vzc2lvblVybCA9IHVzZUFwcFN0YXRlKHMgPT4gcy5yZXBsQnJpZGdlU2Vzc2lvblVybClcbiAgY29uc3QgY29ubmVjdFVybCA9IHVzZUFwcFN0YXRlKHMgPT4gcy5yZXBsQnJpZGdlQ29ubmVjdFVybClcbiAgY29uc3Qgc2Vzc2lvbkFjdGl2ZSA9IHVzZUFwcFN0YXRlKHMgPT4gcy5yZXBsQnJpZGdlU2Vzc2lvbkFjdGl2ZSlcbiAgY29uc3QgW2ZvY3VzSW5kZXgsIHNldEZvY3VzSW5kZXhdID0gdXNlU3RhdGUoMilcbiAgY29uc3QgW3Nob3dRUiwgc2V0U2hvd1FSXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbcXJUZXh0LCBzZXRRclRleHRdID0gdXNlU3RhdGUoJycpXG5cbiAgY29uc3QgZGlzcGxheVVybCA9IHNlc3Npb25BY3RpdmUgPyBzZXNzaW9uVXJsIDogY29ubmVjdFVybFxuXG4gIC8vIEdlbmVyYXRlIFFSIGNvZGUgd2hlbiBVUkwgY2hhbmdlcyBvciBRUiBpcyB0b2dnbGVkIG9uXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFzaG93UVIgfHwgIWRpc3BsYXlVcmwpIHtcbiAgICAgIHNldFFyVGV4dCgnJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBxclRvU3RyaW5nKGRpc3BsYXlVcmwsIHtcbiAgICAgIHR5cGU6ICd1dGY4JyxcbiAgICAgIGVycm9yQ29ycmVjdGlvbkxldmVsOiAnTCcsXG4gICAgICBzbWFsbDogdHJ1ZSxcbiAgICB9KVxuICAgICAgLnRoZW4oc2V0UXJUZXh0KVxuICAgICAgLmNhdGNoKCgpID0+IHNldFFyVGV4dCgnJykpXG4gIH0sIFtzaG93UVIsIGRpc3BsYXlVcmxdKVxuXG4gIGZ1bmN0aW9uIGhhbmRsZURpc2Nvbm5lY3QoKTogdm9pZCB7XG4gICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICBpZiAoIXByZXYucmVwbEJyaWRnZUVuYWJsZWQpIHJldHVybiBwcmV2XG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5wcmV2LFxuICAgICAgICByZXBsQnJpZGdlRW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHJlcGxCcmlkZ2VFeHBsaWNpdDogZmFsc2UsXG4gICAgICAgIHJlcGxCcmlkZ2VPdXRib3VuZE9ubHk6IGZhbHNlLFxuICAgICAgfVxuICAgIH0pXG4gICAgbG9nRXZlbnQoJ3Rlbmd1X2JyaWRnZV9jb21tYW5kJywge1xuICAgICAgYWN0aW9uOlxuICAgICAgICAnZGlzY29ubmVjdCcgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICB9KVxuICAgIG9uRG9uZShSRU1PVEVfQ09OVFJPTF9ESVNDT05ORUNURURfTVNHLCB7IGRpc3BsYXk6ICdzeXN0ZW0nIH0pXG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVTaG93UVIoKTogdm9pZCB7XG4gICAgc2V0U2hvd1FSKHByZXYgPT4gIXByZXYpXG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVDb250aW51ZSgpOiB2b2lkIHtcbiAgICBvbkRvbmUodW5kZWZpbmVkLCB7IGRpc3BsYXk6ICdza2lwJyB9KVxuICB9XG5cbiAgY29uc3QgSVRFTV9DT1VOVCA9IDNcblxuICB1c2VLZXliaW5kaW5ncyhcbiAgICB7XG4gICAgICAnc2VsZWN0Om5leHQnOiAoKSA9PiBzZXRGb2N1c0luZGV4KGkgPT4gKGkgKyAxKSAlIElURU1fQ09VTlQpLFxuICAgICAgJ3NlbGVjdDpwcmV2aW91cyc6ICgpID0+XG4gICAgICAgIHNldEZvY3VzSW5kZXgoaSA9PiAoaSAtIDEgKyBJVEVNX0NPVU5UKSAlIElURU1fQ09VTlQpLFxuICAgICAgJ3NlbGVjdDphY2NlcHQnOiAoKSA9PiB7XG4gICAgICAgIGlmIChmb2N1c0luZGV4ID09PSAwKSB7XG4gICAgICAgICAgaGFuZGxlRGlzY29ubmVjdCgpXG4gICAgICAgIH0gZWxzZSBpZiAoZm9jdXNJbmRleCA9PT0gMSkge1xuICAgICAgICAgIGhhbmRsZVNob3dRUigpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGFuZGxlQ29udGludWUoKVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0sXG4gICAgeyBjb250ZXh0OiAnU2VsZWN0JyB9LFxuICApXG5cbiAgY29uc3QgcXJMaW5lcyA9IHFyVGV4dCA/IHFyVGV4dC5zcGxpdCgnXFxuJykuZmlsdGVyKGwgPT4gbC5sZW5ndGggPiAwKSA6IFtdXG5cbiAgcmV0dXJuIChcbiAgICA8RGlhbG9nIHRpdGxlPVwiUmVtb3RlIENvbnRyb2xcIiBvbkNhbmNlbD17aGFuZGxlQ29udGludWV9IGhpZGVJbnB1dEd1aWRlPlxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXsxfT5cbiAgICAgICAgPFRleHQ+XG4gICAgICAgICAgVGhpcyBzZXNzaW9uIGlzIGF2YWlsYWJsZSB2aWEgUmVtb3RlIENvbnRyb2xcbiAgICAgICAgICB7ZGlzcGxheVVybCA/IGAgYXQgJHtkaXNwbGF5VXJsfWAgOiAnJ30uXG4gICAgICAgIDwvVGV4dD5cbiAgICAgICAge3Nob3dRUiAmJiBxckxpbmVzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAge3FyTGluZXMubWFwKChsaW5lLCBpKSA9PiAoXG4gICAgICAgICAgICAgIDxUZXh0IGtleT17aX0+e2xpbmV9PC9UZXh0PlxuICAgICAgICAgICAgKSl9XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxMaXN0SXRlbSBpc0ZvY3VzZWQ9e2ZvY3VzSW5kZXggPT09IDB9PlxuICAgICAgICAgICAgPFRleHQ+RGlzY29ubmVjdCB0aGlzIHNlc3Npb248L1RleHQ+XG4gICAgICAgICAgPC9MaXN0SXRlbT5cbiAgICAgICAgICA8TGlzdEl0ZW0gaXNGb2N1c2VkPXtmb2N1c0luZGV4ID09PSAxfT5cbiAgICAgICAgICAgIDxUZXh0PntzaG93UVIgPyAnSGlkZSBRUiBjb2RlJyA6ICdTaG93IFFSIGNvZGUnfTwvVGV4dD5cbiAgICAgICAgICA8L0xpc3RJdGVtPlxuICAgICAgICAgIDxMaXN0SXRlbSBpc0ZvY3VzZWQ9e2ZvY3VzSW5kZXggPT09IDJ9PlxuICAgICAgICAgICAgPFRleHQ+Q29udGludWU8L1RleHQ+XG4gICAgICAgICAgPC9MaXN0SXRlbT5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPkVudGVyIHRvIHNlbGVjdCDCtyBFc2MgdG8gY29udGludWU8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICA8L0RpYWxvZz5cbiAgKVxufVxuXG4vKipcbiAqIENoZWNrIGJyaWRnZSBwcmVyZXF1aXNpdGVzLiBSZXR1cm5zIGFuIGVycm9yIG1lc3NhZ2UgaWYgYSBwcmVjb25kaXRpb25cbiAqIGZhaWxzLCBvciBudWxsIGlmIGFsbCBjaGVja3MgcGFzcy4gQXdhaXRzIEdyb3d0aEJvb2sgaW5pdCBpZiB0aGUgZGlza1xuICogY2FjaGUgaXMgc3RhbGUsIHNvIGEgdXNlciB3aG8ganVzdCBiZWNhbWUgZW50aXRsZWQgKGUuZy4gdXBncmFkZWQgdG8gTWF4LFxuICogb3IgdGhlIGZsYWcganVzdCBsYXVuY2hlZCkgZ2V0cyBhbiBhY2N1cmF0ZSByZXN1bHQgb24gdGhlIGZpcnN0IHRyeS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gY2hlY2tCcmlkZ2VQcmVyZXF1aXNpdGVzKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAvLyBDaGVjayBvcmdhbml6YXRpb24gcG9saWN5IOKAlCByZW1vdGUgY29udHJvbCBtYXkgYmUgZGlzYWJsZWRcbiAgY29uc3QgeyB3YWl0Rm9yUG9saWN5TGltaXRzVG9Mb2FkLCBpc1BvbGljeUFsbG93ZWQgfSA9IGF3YWl0IGltcG9ydChcbiAgICAnLi4vLi4vc2VydmljZXMvcG9saWN5TGltaXRzL2luZGV4LmpzJ1xuICApXG4gIGF3YWl0IHdhaXRGb3JQb2xpY3lMaW1pdHNUb0xvYWQoKVxuICBpZiAoIWlzUG9saWN5QWxsb3dlZCgnYWxsb3dfcmVtb3RlX2NvbnRyb2wnKSkge1xuICAgIHJldHVybiBcIlJlbW90ZSBDb250cm9sIGlzIGRpc2FibGVkIGJ5IHlvdXIgb3JnYW5pemF0aW9uJ3MgcG9saWN5LlwiXG4gIH1cblxuICBjb25zdCBkaXNhYmxlZFJlYXNvbiA9IGF3YWl0IGdldEJyaWRnZURpc2FibGVkUmVhc29uKClcbiAgaWYgKGRpc2FibGVkUmVhc29uKSB7XG4gICAgcmV0dXJuIGRpc2FibGVkUmVhc29uXG4gIH1cblxuICAvLyBNaXJyb3IgdGhlIHYxL3YyIGJyYW5jaGluZyBsb2dpYyBpbiBpbml0UmVwbEJyaWRnZTogZW52LWxlc3MgKHYyKSBpcyB1c2VkXG4gIC8vIG9ubHkgd2hlbiB0aGUgZmxhZyBpcyBvbiBBTkQgdGhlIHNlc3Npb24gaXMgbm90IHBlcnBldHVhbC4gIEluIGFzc2lzdGFudFxuICAvLyBtb2RlIChLQUlST1MpIHVzZVJlcGxCcmlkZ2Ugc2V0cyBwZXJwZXR1YWw9dHJ1ZSwgd2hpY2ggZm9yY2VzXG4gIC8vIGluaXRSZXBsQnJpZGdlIG9udG8gdGhlIHYxIHBhdGgg4oCUIHNvIHRoZSBwcmVyZXF1aXNpdGUgY2hlY2sgbXVzdCBtYXRjaC5cbiAgbGV0IHVzZVYyID0gaXNFbnZMZXNzQnJpZGdlRW5hYmxlZCgpXG4gIGlmIChmZWF0dXJlKCdLQUlST1MnKSAmJiB1c2VWMikge1xuICAgIGNvbnN0IHsgaXNBc3Npc3RhbnRNb2RlIH0gPSBhd2FpdCBpbXBvcnQoJy4uLy4uL2Fzc2lzdGFudC9pbmRleC5qcycpXG4gICAgaWYgKGlzQXNzaXN0YW50TW9kZSgpKSB7XG4gICAgICB1c2VWMiA9IGZhbHNlXG4gICAgfVxuICB9XG4gIGNvbnN0IHZlcnNpb25FcnJvciA9IHVzZVYyXG4gICAgPyBhd2FpdCBjaGVja0Vudkxlc3NCcmlkZ2VNaW5WZXJzaW9uKClcbiAgICA6IGNoZWNrQnJpZGdlTWluVmVyc2lvbigpXG4gIGlmICh2ZXJzaW9uRXJyb3IpIHtcbiAgICByZXR1cm4gdmVyc2lvbkVycm9yXG4gIH1cblxuICBpZiAoIWdldEJyaWRnZUFjY2Vzc1Rva2VuKCkpIHtcbiAgICByZXR1cm4gQlJJREdFX0xPR0lOX0lOU1RSVUNUSU9OXG4gIH1cblxuICBsb2dGb3JEZWJ1Z2dpbmcoJ1ticmlkZ2VdIFByZXJlcXVpc2l0ZXMgcGFzc2VkLCBlbmFibGluZyBicmlkZ2UnKVxuICByZXR1cm4gbnVsbFxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbChcbiAgb25Eb25lOiBMb2NhbEpTWENvbW1hbmRPbkRvbmUsXG4gIF9jb250ZXh0OiBUb29sVXNlQ29udGV4dCAmIExvY2FsSlNYQ29tbWFuZENvbnRleHQsXG4gIGFyZ3M6IHN0cmluZyxcbik6IFByb21pc2U8UmVhY3QuUmVhY3ROb2RlPiB7XG4gIGNvbnN0IG5hbWUgPSBhcmdzLnRyaW0oKSB8fCB1bmRlZmluZWRcbiAgcmV0dXJuIDxCcmlkZ2VUb2dnbGUgb25Eb25lPXtvbkRvbmV9IG5hbWU9e25hbWV9IC8+XG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxTQUFTQSxPQUFPLFFBQVEsWUFBWTtBQUNwQyxTQUFTQyxRQUFRLElBQUlDLFVBQVUsUUFBUSxRQUFRO0FBQy9DLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsU0FBUyxFQUFFQyxRQUFRLFFBQVEsT0FBTztBQUMzQyxTQUFTQyxvQkFBb0IsUUFBUSw4QkFBOEI7QUFDbkUsU0FDRUMscUJBQXFCLEVBQ3JCQyx1QkFBdUIsRUFDdkJDLHNCQUFzQixRQUNqQiwrQkFBK0I7QUFDdEMsU0FBU0MsNEJBQTRCLFFBQVEscUNBQXFDO0FBQ2xGLFNBQ0VDLHdCQUF3QixFQUN4QkMsK0JBQStCLFFBQzFCLHVCQUF1QjtBQUM5QixTQUFTQyxNQUFNLFFBQVEsMENBQTBDO0FBQ2pFLFNBQVNDLFFBQVEsUUFBUSw0Q0FBNEM7QUFDckUsU0FBU0MsdUJBQXVCLFFBQVEsbUNBQW1DO0FBQzNFLFNBQVNDLGtCQUFrQixRQUFRLGlD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