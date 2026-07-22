import { c as _c } from "react/compiler-runtime";
/**
 * HooksConfigMenu is a read-only browser for configured hooks.
 *
 * Users can drill into each hook event, see configured matchers and hooks
 * (of any type: command, prompt, agent, http), and view individual hook
 * details. To add or modify hooks, users should edit settings.json directly
 * or ask Claude — the menu directs them there.
 *
 * The menu is read-only because the old editing UI only supported
 * command-type hooks and duplicating the settings.json editing surface
 * in-menu for all four types would be a maintenance burden.
 */
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { HookEvent } from 'src/entrypoints/agentSdkTypes.js';
import { useAppState, useAppStateStore } from 'src/state/AppState.js';
import type { CommandResultDisplay } from '../../commands.js';
import { useSettingsChange } from '../../hooks/useSettingsChange.js';
import { Box, Text } from '../../ink.js';
import { useKeybinding } from '../../keybindings/useKeybinding.js';
import { getHookEventMetadata, getHooksForMatcher, getMatcherMetadata, getSortedMatchersForEvent, groupHooksByEventAndMatcher } from '../../utils/hooks/hooksConfigManager.js';
import type { IndividualHookConfig } from '../../utils/hooks/hooksSettings.js';
import { getSettings_DEPRECATED, getSettingsForSource } from '../../utils/settings/settings.js';
import { plural } from '../../utils/stringUtils.js';
import { Dialog } from '../design-system/Dialog.js';
import { SelectEventMode } from './SelectEventMode.js';
import { SelectHookMode } from './SelectHookMode.js';
import { SelectMatcherMode } from './SelectMatcherMode.js';
import { ViewHookMode } from './ViewHookMode.js';
type Props = {
  toolNames: string[];
  onExit: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
type ModeState = {
  mode: 'select-event';
} | {
  mode: 'select-matcher';
  event: HookEvent;
} | {
  mode: 'select-hook';
  event: HookEvent;
  matcher: string;
} | {
  mode: 'view-hook';
  event: HookEvent;
  hook: IndividualHookConfig;
};
export function HooksConfigMenu(t0) {
  const $ = _c(100);
  const {
    toolNames,
    onExit
  } = t0;
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = {
      mode: "select-event"
    };
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  const [modeState, setModeState] = useState(t1);
  const [disabledByPolicy, setDisabledByPolicy] = useState(_temp);
  const [restrictedByPolicy, setRestrictedByPolicy] = useState(_temp2);
  let t2;
  if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = source => {
      if (source === "policySettings") {
        const settings_0 = getSettings_DEPRECATED();
        const hooksDisabled_0 = settings_0?.disableAllHooks === true;
        setDisabledByPolicy(hooksDisabled_0 && getSettingsForSource("policySettings")?.disableAllHooks === true);
        setRestrictedByPolicy(getSettingsForSource("policySettings")?.allowManagedHooksOnly === true);
      }
    };
    $[1] = t2;
  } else {
    t2 = $[1];
  }
  useSettingsChange(t2);
  const mode = modeState.mode;
  const selectedEvent = "event" in modeState ? modeState.event : "PreToolUse";
  const selectedMatcher = "matcher" in modeState ? modeState.matcher : null;
  const mcp = useAppState(_temp3);
  const appStateStore = useAppStateStore();
  let t3;
  if ($[2] !== mcp.tools || $[3] !== toolNames) {
    t3 = [...toolNames, ...mcp.tools.map(_temp4)];
    $[2] = mcp.tools;
    $[3] = toolNames;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  const combinedToolNames = t3;
  let t4;
  if ($[5] !== appStateStore || $[6] !== combinedToolNames) {
    t4 = groupHooksByEventAndMatcher(appStateStore.getState(), combinedToolNames);
    $[5] = appStateStore;
    $[6] = combinedToolNames;
    $[7] = t4;
  } else {
    t4 = $[7];
  }
  const hooksByEventAndMatcher = t4;
  let t5;
  if ($[8] !== hooksByEventAndMatcher || $[9] !== selectedEvent) {
    t5 = getSortedMatchersForEvent(hooksByEventAndMatcher, selectedEvent);
    $[8] = hooksByEventAndMatcher;
    $[9] = selectedEvent;
    $[10] = t5;
  } else {
    t5 = $[10];
  }
  const sortedMatchersForSelectedEvent = t5;
  let t6;
  if ($[11] !== hooksByEventAndMatcher || $[12] !== selectedEvent || $[13] !== selectedMatcher) {
    t6 = getHooksForMatcher(hooksByEventAndMatcher, selectedEvent, selectedMatcher);
    $[11] = hooksByEventAndMatcher;
    $[12] = selectedEvent;
    $[13] = selectedMatcher;
    $[14] = t6;
  } else {
    t6 = $[14];
  }
  const hooksForSelectedMatcher = t6;
  let t7;
  if ($[15] !== onExit) {
    t7 = () => {
      onExit("Hooks dialog dismissed", {
        display: "system"
      });
    };
    $[15] = onExit;
    $[16] = t7;
  } else {
    t7 = $[16];
  }
  const handleExit = t7;
  const t8 = mode === "select-event";
  let t9;
  if ($[17] !== t8) {
    t9 = {
      context: "Confirmation",
      isActive: t8
    };
    $[17] = t8;
    $[18] = t9;
  } else {
    t9 = $[18];
  }
  useKeybinding("confirm:no", handleExit, t9);
  let t10;
  if ($[19] === Symbol.for("react.memo_cache_sentinel")) {
    t10 = () => {
      setModeState({
        mode: "select-event"
      });
    };
    $[19] = t10;
  } else {
    t10 = $[19];
  }
  const t11 = mode === "select-matcher";
  let t12;
  if ($[20] !== t11) {
    t12 = {
      context: "Confirmation",
      isActive: t11
    };
    $[20] = t11;
    $[21] = t12;
  } else {
    t12 = $[21];
  }
  useKeybinding("confirm:no", t10, t12);
  let t13;
  if ($[22] !== combinedToolNames || $[23] !== modeState) {
    t13 = () => {
      if ("event" in modeState) {
        if (getMatcherMetadata(modeState.event, combinedToolNames) !== undefined) {
          setModeState({
            mode: "select-matcher",
            event: modeState.event
          });
        } else {
          setModeState({
            mode: "select-event"
          });
        }
      }
    };
    $[22] = combinedToolNames;
    $[23] = modeState;
    $[24] = t13;
  } else {
    t13 = $[24];
  }
  const t14 = mode === "select-hook";
  let t15;
  if ($[25] !== t14) {
    t15 = {
      context: "Confirmation",
      isActive: t14
    };
    $[25] = t14;
    $[26] = t15;
  } else {
    t15 = $[26];
  }
  useKeybinding("confirm:no", t13, t15);
  let t16;
  if ($[27] !== modeState) {
    t16 = () => {
      if (modeState.mode === "view-hook") {
        const {
          event,
          hook
        } = modeState;
        setModeState({
          mode: "select-hook",
          event,
          matcher: hook.matcher || ""
        });
      }
    };
    $[27] = modeState;
    $[28] = t16;
  } else {
    t16 = $[28];
  }
  const t17 = mode === "view-hook";
  let t18;
  if ($[29] !== t17) {
    t18 = {
      context: "Confirmation",
      isActive: t17
    };
    $[29] = t17;
    $[30] = t18;
  } else {
    t18 = $[30];
  }
  useKeybinding("confirm:no", t16, t18);
  let t19;
  if ($[31] !== combinedToolNames) {
    t19 = getHookEventMetadata(combinedToolNames);
    $[31] = combinedToolNames;
    $[32] = t19;
  } else {
    t19 = $[32];
  }
  const hookEventMetadata = t19;
  const settings_1 = getSettings_DEPRECATED();
  const hooksDisabled_1 = settings_1?.disableAllHooks === true;
  let t20;
  if ($[33] !== hooksByEventAndMatcher) {
    const byEvent = {};
    let total = 0;
    for (const [event_0, matchers] of Object.entries(hooksByEventAndMatcher)) {
      const eventCount = Object.values(matchers).reduce(_temp5, 0);
      byEvent[event_0 as HookEvent] = eventCount;
      total = total + eventCount;
    }
    t20 = {
      hooksByEvent: byEvent,
      totalHooksCount: total
    };
    $[33] = hooksByEventAndMatcher;
    $[34] = t20;
  } else {
    t20 = $[34];
  }
  const {
    hooksByEvent,
    totalHooksCount
  } = t20;
  if (hooksDisabled_1) {
    let t21;
    if ($[35] === Symbol.for("react.memo_cache_sentinel")) {
      t21 = <Text bold={true}>disabled</Text>;
      $[35] = t21;
    } else {
      t21 = $[35];
    }
    const t22 = disabledByPolicy && " by a managed settings file";
    let t23;
    if ($[36] !== totalHooksCount) {
      t23 = <Text bold={true}>{totalHooksCount}</Text>;
      $[36] = totalHooksCount;
      $[37] = t23;
    } else {
      t23 = $[37];
    }
    let t24;
    if ($[38] !== totalHooksCount) {
      t24 = plural(totalHooksCount, "hook");
      $[38] = totalHooksCount;
      $[39] = t24;
    } else {
      t24 = $[39];
    }
    let t25;
    if ($[40] !== totalHooksCount) {
      t25 = plural(totalHooksCount, "is", "are");
      $[40] = totalHooksCount;
      $[41] = t25;
    } else {
      t25 = $[41];
    }
    let t26;
    if ($[42] !== t22 || $[43] !== t23 || $[44] !== t24 || $[45] !== t25) {
      t26 = <Text>All hooks are currently {t21}{t22}. You have{" "}{t23} configured{" "}{t24} that{" "}{t25} not running.</Text>;
      $[42] = t22;
      $[43] = t23;
      $[44] = t24;
      $[45] = t25;
      $[46] = t26;
    } else {
      t26 = $[46];
    }
    let t27;
    let t28;
    let t29;
    let t30;
    if ($[47] === Symbol.for("react.memo_cache_sentinel")) {
      t27 = <Box marginTop={1}><Text dimColor={true}>When hooks are disabled:</Text></Box>;
      t28 = <Text dimColor={true}>· No hook commands will execute</Text>;
      t29 = <Text dimColor={true}>· StatusLine will not be displayed</Text>;
      t30 = <Text dimColor={true}>· Tool operations will proceed without hook validation</Text>;
      $[47] = t27;
      $[48] = t28;
      $[49] = t29;
      $[50] = t30;
    } else {
      t27 = $[47];
      t28 = $[48];
      t29 = $[49];
      t30 = $[50];
    }
    let t31;
    if ($[51] !== t26) {
      t31 = <Box flexDirection="column">{t26}{t27}{t28}{t29}{t30}</Box>;
      $[51] = t26;
      $[52] = t31;
    } else {
      t31 = $[52];
    }
    let t32;
    if ($[53] !== disabledByPolicy) {
      t32 = !disabledByPolicy && <Text dimColor={true}>To re-enable hooks, remove "disableAllHooks" from settings.json or ask Claude.</Text>;
      $[53] = disabledByPolicy;
      $[54] = t32;
    } else {
      t32 = $[54];
    }
    let t33;
    if ($[55] !== t31 || $[56] !== t32) {
      t33 = <Box flexDirection="column" gap={1}>{t31}{t32}</Box>;
      $[55] = t31;
      $[56] = t32;
      $[57] = t33;
    } else {
      t33 = $[57];
    }
    let t34;
    if ($[58] !== handleExit || $[59] !== t33) {
      t34 = <Dialog title="Hook Configuration - Disabled" onCancel={handleExit} inputGuide={_temp6}>{t33}</Dialog>;
      $[58] = handleExit;
      $[59] = t33;
      $[60] = t34;
    } else {
      t34 = $[60];
    }
    return t34;
  }
  switch (modeState.mode) {
    case "select-event":
      {
        let t21;
        if ($[61] !== combinedToolNames) {
          t21 = event_2 => {
            if (getMatcherMetadata(event_2, combinedToolNames) !== undefined) {
              setModeState({
                mode: "select-matcher",
                event: event_2
              });
            } else {
              setModeState({
                mode: "select-hook",
                event: event_2,
                matcher: ""
              });
            }
          };
          $[61] = combinedToolNames;
          $[62] = t21;
        } else {
          t21 = $[62];
        }
        let t22;
        if ($[63] !== handleExit || $[64] !== hookEventMetadata || $[65] !== hooksByEvent || $[66] !== restrictedByPolicy || $[67] !== t21 || $[68] !== totalHooksCount) {
          t22 = <SelectEventMode hookEventMetadata={hookEventMetadata} hooksByEvent={hooksByEvent} totalHooksCount={totalHooksCount} restrictedByPolicy={restrictedByPolicy} onSelectEvent={t21} onCancel={handleExit} />;
          $[63] = handleExit;
          $[64] = hookEventMetadata;
          $[65] = hooksByEvent;
          $[66] = restrictedByPolicy;
          $[67] = t21;
          $[68] = totalHooksCount;
          $[69] = t22;
        } else {
          t22 = $[69];
        }
        return t22;
      }
    case "select-matcher":
      {
        const t21 = hookEventMetadata[modeState.event];
        let t22;
        if ($[70] !== modeState.event) {
          t22 = matcher => {
            setModeState({
              mode: "select-hook",
              event: modeState.event,
              matcher
            });
          };
          $[70] = modeState.event;
          $[71] = t22;
        } else {
          t22 = $[71];
        }
        let t23;
        if ($[72] === Symbol.for("react.memo_cache_sentinel")) {
          t23 = () => {
            setModeState({
              mode: "select-event"
            });
          };
          $[72] = t23;
        } else {
          t23 = $[72];
        }
        let t24;
        if ($[73] !== hooksByEventAndMatcher || $[74] !== modeState.event || $[75] !== sortedMatchersForSelectedEvent || $[76] !== t21.description || $[77] !== t22) {
          t24 = <SelectMatcherMode selectedEvent={modeState.event} matchersForSelectedEvent={sortedMatchersForSelectedEvent} hooksByEventAndMatcher={hooksByEventAndMatcher} eventDescription={t21.description} onSelect={t22} onCancel={t23} />;
          $[73] = hooksByEventAndMatcher;
          $[74] = modeState.event;
          $[75] = sortedMatchersForSelectedEvent;
          $[76] = t21.description;
          $[77] = t22;
          $[78] = t24;
        } else {
          t24 = $[78];
        }
        return t24;
      }
    case "select-hook":
      {
        const t21 = hookEventMetadata[modeState.event];
        let t22;
        if ($[79] !== modeState.event) {
          t22 = hook_1 => {
            setModeState({
              mode: "view-hook",
              event: modeState.event,
              hook: hook_1
            });
          };
          $[79] = modeState.event;
          $[80] = t22;
        } else {
          t22 = $[80];
        }
        let t23;
        if ($[81] !== combinedToolNames || $[82] !== modeState.event) {
          t23 = () => {
            if (getMatcherMetadata(modeState.event, combinedToolNames) !== undefined) {
              setModeState({
                mode: "select-matcher",
                event: modeState.event
              });
            } else {
              setModeState({
                mode: "select-event"
              });
            }
          };
          $[81] = combinedToolNames;
          $[82] = modeState.event;
          $[83] = t23;
        } else {
          t23 = $[83];
        }
        let t24;
        if ($[84] !== hooksForSelectedMatcher || $[85] !== modeState.event || $[86] !== modeState.matcher || $[87] !== t21 || $[88] !== t22 || $[89] !== t23) {
          t24 = <SelectHookMode selectedEvent={modeState.event} selectedMatcher={modeState.matcher} hooksForSelectedMatcher={hooksForSelectedMatcher} hookEventMetadata={t21} onSelect={t22} onCancel={t23} />;
          $[84] = hooksForSelectedMatcher;
          $[85] = modeState.event;
          $[86] = modeState.matcher;
          $[87] = t21;
          $[88] = t22;
          $[89] = t23;
          $[90] = t24;
        } else {
          t24 = $[90];
        }
        return t24;
      }
    case "view-hook":
      {
        const t21 = modeState.hook;
        let t22;
        if ($[91] !== combinedToolNames || $[92] !== modeState.event) {
          t22 = getMatcherMetadata(modeState.event, combinedToolNames);
          $[91] = combinedToolNames;
          $[92] = modeState.event;
          $[93] = t22;
        } else {
          t22 = $[93];
        }
        const t23 = t22 !== undefined;
        let t24;
        if ($[94] !== modeState) {
          t24 = () => {
            const {
              event: event_1,
              hook: hook_0
            } = modeState;
            setModeState({
              mode: "select-hook",
              event: event_1,
              matcher: hook_0.matcher || ""
            });
          };
          $[94] = modeState;
          $[95] = t24;
        } else {
          t24 = $[95];
        }
        let t25;
        if ($[96] !== modeState.hook || $[97] !== t23 || $[98] !== t24) {
          t25 = <ViewHookMode selectedHook={t21} eventSupportsMatcher={t23} onCancel={t24} />;
          $[96] = modeState.hook;
          $[97] = t23;
          $[98] = t24;
          $[99] = t25;
        } else {
          t25 = $[99];
        }
        return t25;
      }
  }
}
function _temp6() {
  return <Text>Esc to close</Text>;
}
function _temp5(sum, hooks) {
  return sum + hooks.length;
}
function _temp4(tool) {
  return tool.name;
}
function _temp3(s) {
  return s.mcp;
}
function _temp2() {
  return getSettingsForSource("policySettings")?.allowManagedHooksOnly === true;
}
function _temp() {
  const settings = getSettings_DEPRECATED();
  const hooksDisabled = settings?.disableAllHooks === true;
  return hooksDisabled && getSettingsForSource("policySettings")?.disableAllHooks === true;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsInVzZUNhbGxiYWNrIiwidXNlTWVtbyIsInVzZVN0YXRlIiwiSG9va0V2ZW50IiwidXNlQXBwU3RhdGUiLCJ1c2VBcHBTdGF0ZVN0b3JlIiwiQ29tbWFuZFJlc3VsdERpc3BsYXkiLCJ1c2VTZXR0aW5nc0NoYW5nZSIsIkJveCIsIlRleHQiLCJ1c2VLZXliaW5kaW5nIiwiZ2V0SG9va0V2ZW50TWV0YWRhdGEiLCJnZXRIb29rc0Zvck1hdGNoZXIiLCJnZXRNYXRjaGVyTWV0YWRhdGEiLCJnZXRTb3J0ZWRNYXRjaGVyc0ZvckV2ZW50IiwiZ3JvdXBIb29rc0J5RXZlbnRBbmRNYXRjaGVyIiwiSW5kaXZpZHVhbEhvb2tDb25maWciLCJnZXRTZXR0aW5nc19ERVBSRUNBVEVEIiwiZ2V0U2V0dGluZ3NGb3JTb3VyY2UiLCJwbHVyYWwiLCJEaWFsb2ciLCJTZWxlY3RFdmVudE1vZGUiLCJTZWxlY3RIb29rTW9kZSIsIlNlbGVjdE1hdGNoZXJNb2RlIiwiVmlld0hvb2tNb2RlIiwiUHJvcHMiLCJ0b29sTmFtZXMiLCJvbkV4aXQiLCJyZXN1bHQiLCJvcHRpb25zIiwiZGlzcGxheSIsIk1vZGVTdGF0ZSIsIm1vZGUiLCJldmVudCIsIm1hdGNoZXIiLCJob29rIiwiSG9va3NDb25maWdNZW51IiwidDAiLCIkIiwiX2MiLCJ0MSIsIlN5bWJvbCIsImZvciIsIm1vZGVTdGF0ZSIsInNldE1vZGVTdGF0ZSIsImRpc2FibGVkQnlQb2xpY3kiLCJzZXREaXNhYmxlZEJ5UG9saWN5IiwiX3RlbXAiLCJyZXN0cmljdGVkQnlQb2xpY3kiLCJzZXRSZXN0cmljdGVkQnlQb2xpY3kiLCJfdGVtcDIiLCJ0MiIsInNvdXJjZSIsInNldHRpbmdzXzAiLCJob29rc0Rpc2FibGVkXzAiLCJzZXR0aW5ncyIsImRpc2FibGVBbGxIb29rcyIsImFsbG93TWFuYWdlZEhvb2tzT25seSIsInNlbGVjdGVkRXZlbnQiLCJzZWxlY3RlZE1hdGNoZXIiLCJtY3AiLCJfdGVtcDMiLCJhcHBTdGF0ZVN0b3JlIiwidDMiLCJ0b29scyIsIm1hcCIsIl90ZW1wNCIsImNvbWJpbmVkVG9vbE5hbWVzIiwidDQiLCJnZXRTdGF0ZSIsImhvb2tzQnlFdmVudEFuZE1hdGNoZXIiLCJ0NSIsInNvcnRlZE1hdGNoZXJzRm9yU2VsZWN0ZWRFdmVudCIsInQ2IiwiaG9va3NGb3JTZWxlY3RlZE1hdGNoZXIiLCJ0NyIsImhhbmRsZUV4aXQiLCJ0OCIsInQ5IiwiY29udGV4dCIsImlzQWN0aXZlIiwidDEwIiwidDExIiwidDEyIiwidDEzIiwidW5kZWZpbmVkIiwidDE0IiwidDE1IiwidDE2IiwidDE3IiwidDE4IiwidDE5IiwiaG9va0V2ZW50TWV0YWRhdGEiLCJzZXR0aW5nc18xIiwiaG9va3NEaXNhYmxlZF8xIiwidDIwIiwiYnlFdmVudCIsInRvdGFsIiwiZXZlbnRfMCIsIm1hdGNoZXJzIiwiT2JqZWN0IiwiZW50cmllcyIsImV2ZW50Q291bnQiLCJ2YWx1ZXMiLCJyZWR1Y2UiLCJfdGVtcDUiLCJob29rc0J5RXZlbnQiLCJ0b3RhbEhvb2tzQ291bnQiLCJob29rc0Rpc2FibGVkIiwidDIxIiwidDIyIiwidDIzIiwidDI0IiwidDI1IiwidDI2IiwidDI3IiwidDI4IiwidDI5IiwidDMwIiwidDMxIiwidDMyIiwidDMzIiwidDM0IiwiX3RlbXA2IiwiZXZlbnRfMiIsImRlc2NyaXB0aW9uIiwiaG9va18xIiwiZXZlbnRfMSIsImhvb2tfMCIsInN1bSIsImhvb2tzIiwibGVuZ3RoIiwidG9vbCIsIm5hbWUiLCJzIl0sInNvdXJjZXMiOlsiSG9va3NDb25maWdNZW51LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEhvb2tzQ29uZmlnTWVudSBpcyBhIHJlYWQtb25seSBicm93c2VyIGZvciBjb25maWd1cmVkIGhvb2tzLlxuICpcbiAqIFVzZXJzIGNhbiBkcmlsbCBpbnRvIGVhY2ggaG9vayBldmVudCwgc2VlIGNvbmZpZ3VyZWQgbWF0Y2hlcnMgYW5kIGhvb2tzXG4gKiAob2YgYW55IHR5cGU6IGNvbW1hbmQsIHByb21wdCwgYWdlbnQsIGh0dHApLCBhbmQgdmlldyBpbmRpdmlkdWFsIGhvb2tcbiAqIGRldGFpbHMuIFRvIGFkZCBvciBtb2RpZnkgaG9va3MsIHVzZXJzIHNob3VsZCBlZGl0IHNldHRpbmdzLmpzb24gZGlyZWN0bHlcbiAqIG9yIGFzayBDbGF1ZGUg4oCUIHRoZSBtZW51IGRpcmVjdHMgdGhlbSB0aGVyZS5cbiAqXG4gKiBUaGUgbWVudSBpcyByZWFkLW9ubHkgYmVjYXVzZSB0aGUgb2xkIGVkaXRpbmcgVUkgb25seSBzdXBwb3J0ZWRcbiAqIGNvbW1hbmQtdHlwZSBob29rcyBhbmQgZHVwbGljYXRpbmcgdGhlIHNldHRpbmdzLmpzb24gZWRpdGluZyBzdXJmYWNlXG4gKiBpbi1tZW51IGZvciBhbGwgZm91ciB0eXBlcyB3b3VsZCBiZSBhIG1haW50ZW5hbmNlIGJ1cmRlbi5cbiAqL1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VDYWxsYmFjaywgdXNlTWVtbywgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB0eXBlIHsgSG9va0V2ZW50IH0gZnJvbSAnc3JjL2VudHJ5cG9pbnRzL2FnZW50U2RrVHlwZXMuanMnXG5pbXBvcnQgeyB1c2VBcHBTdGF0ZSwgdXNlQXBwU3RhdGVTdG9yZSB9IGZyb20gJ3NyYy9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB0eXBlIHsgQ29tbWFuZFJlc3VsdERpc3BsYXkgfSBmcm9tICcuLi8uLi9jb21tYW5kcy5qcydcbmltcG9ydCB7IHVzZVNldHRpbmdzQ2hhbmdlIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlU2V0dGluZ3NDaGFuZ2UuanMnXG5pbXBvcnQgeyBCb3gsIFRleHQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5pbXBvcnQgeyB1c2VLZXliaW5kaW5nIH0gZnJvbSAnLi4vLi4va2V5YmluZGluZ3MvdXNlS2V5YmluZGluZy5qcydcbmltcG9ydCB7XG4gIGdldEhvb2tFdmVudE1ldGFkYXRhLFxuICBnZXRIb29rc0Zvck1hdGNoZXIsXG4gIGdldE1hdGNoZXJNZXRhZGF0YSxcbiAgZ2V0U29ydGVkTWF0Y2hlcnNGb3JFdmVudCxcbiAgZ3JvdXBIb29rc0J5RXZlbnRBbmRNYXRjaGVyLFxufSBmcm9tICcuLi8uLi91dGlscy9ob29rcy9ob29rc0NvbmZpZ01hbmFnZXIuanMnXG5pbXBvcnQgdHlwZSB7IEluZGl2aWR1YWxIb29rQ29uZmlnIH0gZnJvbSAnLi4vLi4vdXRpbHMvaG9va3MvaG9va3NTZXR0aW5ncy5qcydcbmltcG9ydCB7XG4gIGdldFNldHRpbmdzX0RFUFJFQ0FURUQsXG4gIGdldFNldHRpbmdzRm9yU291cmNlLFxufSBmcm9tICcuLi8uLi91dGlscy9zZXR0aW5ncy9zZXR0aW5ncy5qcydcbmltcG9ydCB7IHBsdXJhbCB9IGZyb20gJy4uLy4uL3V0aWxzL3N0cmluZ1V0aWxzLmpzJ1xuaW1wb3J0IHsgRGlhbG9nIH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9EaWFsb2cuanMnXG5pbXBvcnQgeyBTZWxlY3RFdmVudE1vZGUgfSBmcm9tICcuL1NlbGVjdEV2ZW50TW9kZS5qcydcbmltcG9ydCB7IFNlbGVjdEhvb2tNb2RlIH0gZnJvbSAnLi9TZWxlY3RIb29rTW9kZS5qcydcbmltcG9ydCB7IFNlbGVjdE1hdGNoZXJNb2RlIH0gZnJvbSAnLi9TZWxlY3RNYXRjaGVyTW9kZS5qcydcbmltcG9ydCB7IFZpZXdIb29rTW9kZSB9IGZyb20gJy4vVmlld0hvb2tNb2RlLmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICB0b29sTmFtZXM6IHN0cmluZ1tdXG4gIG9uRXhpdDogKFxuICAgIHJlc3VsdD86IHN0cmluZyxcbiAgICBvcHRpb25zPzogeyBkaXNwbGF5PzogQ29tbWFuZFJlc3VsdERpc3BsYXkgfSxcbiAgKSA9PiB2b2lkXG59XG5cbnR5cGUgTW9kZVN0YXRlID1cbiAgfCB7IG1vZGU6ICdzZWxlY3QtZXZlbnQnIH1cbiAgfCB7IG1vZGU6ICdzZWxlY3QtbWF0Y2hlcic7IGV2ZW50OiBIb29rRXZlbnQgfVxuICB8IHsgbW9kZTogJ3NlbGVjdC1ob29rJzsgZXZlbnQ6IEhvb2tFdmVudDsgbWF0Y2hlcjogc3RyaW5nIH1cbiAgfCB7IG1vZGU6ICd2aWV3LWhvb2snOyBldmVudDogSG9va0V2ZW50OyBob29rOiBJbmRpdmlkdWFsSG9va0NvbmZpZyB9XG5cbmV4cG9ydCBmdW5jdGlvbiBIb29rc0NvbmZpZ01lbnUoeyB0b29sTmFtZXMsIG9uRXhpdCB9OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFttb2RlU3RhdGUsIHNldE1vZGVTdGF0ZV0gPSB1c2VTdGF0ZTxNb2RlU3RhdGU+KHtcbiAgICBtb2RlOiAnc2VsZWN0LWV2ZW50JyxcbiAgfSlcbiAgLy8gQ2FjaGUgd2hldGhlciBob29rcyBhcmUgZGlzYWJsZWQgYnkgcG9saWN5IHNldHRpbmdzLlxuICAvLyBnZXRTZXR0aW5nc0ZvclNvdXJjZSgpIGlzIGV4cGVuc2l2ZSAoZmlsZSByZWFkICsgSlNPTiBwYXJzZSArIHZhbGlkYXRpb24pLFxuICAvLyBzbyB3ZSBjb21wdXRlIGl0IG9uY2Ugb24gbW91bnQgYW5kIG9ubHkgcmUtY29tcHV0ZSB3aGVuIHBvbGljeSBzZXR0aW5ncyBjaGFuZ2UuXG4gIC8vIFNob3J0LWNpcmN1aXQgZXZhbHVhdGlvbiBlbnN1cmVzIHdlIHNraXAgdGhlIGV4cGVuc2l2ZSBjaGVjayB3aGVuIGhvb2tzIGFyZW4ndCBkaXNhYmxlZC5cbiAgY29uc3QgW2Rpc2FibGVkQnlQb2xpY3ksIHNldERpc2FibGVkQnlQb2xpY3ldID0gdXNlU3RhdGUoKCkgPT4ge1xuICAgIGNvbnN0IHNldHRpbmdzID0gZ2V0U2V0dGluZ3NfREVQUkVDQVRFRCgpXG4gICAgY29uc3QgaG9va3NEaXNhYmxlZCA9IHNldHRpbmdzPy5kaXNhYmxlQWxsSG9va3MgPT09IHRydWVcbiAgICByZXR1cm4gKFxuICAgICAgaG9va3NEaXNhYmxlZCAmJlxuICAgICAgZ2V0U2V0dGluZ3NGb3JTb3VyY2UoJ3BvbGljeVNldHRpbmdzJyk/LmRpc2FibGVBbGxIb29rcyA9PT0gdHJ1ZVxuICAgIClcbiAgfSlcblxuICAvLyBDaGVjayBpZiBob29rcyBhcmUgcmVzdHJpY3RlZCB0byBtYW5hZ2VkLW9ubHkgYnkgcG9saWN5XG4gIGNvbnN0IFtyZXN0cmljdGVkQnlQb2xpY3ksIHNldFJlc3RyaWN0ZWRCeVBvbGljeV0gPSB1c2VTdGF0ZSgoKSA9PiB7XG4gICAgcmV0dXJuIChcbiAgICAgIGdldFNldHRpbmdzRm9yU291cmNlKCdwb2xpY3lTZXR0aW5ncycpPy5hbGxvd01hbmFnZWRIb29rc09ubHkgPT09IHRydWVcbiAgICApXG4gIH0pXG5cbiAgLy8gVXBkYXRlIGNhY2hlZCB2YWx1ZXMgd2hlbiBwb2xpY3kgc2V0dGluZ3MgY2hhbmdlXG4gIHVzZVNldHRpbmdzQ2hhbmdlKHNvdXJjZSA9PiB7XG4gICAgaWYgKHNvdXJjZSA9PT0gJ3BvbGljeVNldHRpbmdzJykge1xuICAgICAgY29uc3Qgc2V0dGluZ3MgPSBnZXRTZXR0aW5nc19ERVBSRUNBVEVEKClcbiAgICAgIGNvbnN0IGhvb2tzRGlzYWJsZWQgPSBzZXR0aW5ncz8uZGlzYWJsZUFsbEhvb2tzID09PSB0cnVlXG4gICAgICBzZXREaXNhYmxlZEJ5UG9saWN5KFxuICAgICAgICBob29rc0Rpc2FibGVkICYmXG4gICAgICAgICAgZ2V0U2V0dGluZ3NGb3JTb3VyY2UoJ3BvbGljeVNldHRpbmdzJyk/LmRpc2FibGVBbGxIb29rcyA9PT0gdHJ1ZSxcbiAgICAgIClcbiAgICAgIHNldFJlc3RyaWN0ZWRCeVBvbGljeShcbiAgICAgICAgZ2V0U2V0dGluZ3NGb3JTb3VyY2UoJ3BvbGljeVNldHRpbmdzJyk/LmFsbG93TWFuYWdlZEhvb2tzT25seSA9PT0gdHJ1ZSxcbiAgICAgIClcbiAgICB9XG4gIH0pXG5cbiAgLy8gRXh0cmFjdCBjb21tb25seSB1c2VkIHZhbHVlcyBmcm9tIG1vZGVTdGF0ZSBmb3IgY29udmVuaWVuY2VcbiAgY29uc3QgbW9kZSA9IG1vZGVTdGF0ZS5tb2RlXG4gIGNvbnN0IHNlbGVjdGVkRXZlbnQgPSAnZXZlbnQnIGluIG1vZGVTdGF0ZSA/IG1vZGVTdGF0ZS5ldmVudCA6ICdQcmVUb29sVXNlJ1xuICBjb25zdCBzZWxlY3RlZE1hdGNoZXIgPSAnbWF0Y2hlcicgaW4gbW9kZVN0YXRlID8gbW9kZVN0YXRlLm1hdGNoZXIgOiBudWxsXG5cbiAgY29uc3QgbWNwID0gdXNlQXBwU3RhdGUocyA9PiBzLm1jcClcbiAgY29uc3QgYXBwU3RhdGVTdG9yZSA9IHVzZUFwcFN0YXRlU3RvcmUoKVxuICBjb25zdCBjb21iaW5lZFRvb2xOYW1lcyA9IHVzZU1lbW8oXG4gICAgKCkgPT4gWy4uLnRvb2xOYW1lcywgLi4ubWNwLnRvb2xzLm1hcCh0b29sID0+IHRvb2wubmFtZSldLFxuICAgIFt0b29sTmFtZXMsIG1jcC50b29sc10sXG4gIClcblxuICBjb25zdCBob29rc0J5RXZlbnRBbmRNYXRjaGVyID0gdXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgZ3JvdXBIb29rc0J5RXZlbnRBbmRNYXRjaGVyKGFwcFN0YXRlU3RvcmUuZ2V0U3RhdGUoKSwgY29tYmluZWRUb29sTmFtZXMpLFxuICAgIFtjb21iaW5lZFRvb2xOYW1lcywgYXBwU3RhdGVTdG9yZV0sXG4gIClcblxuICBjb25zdCBzb3J0ZWRNYXRjaGVyc0ZvclNlbGVjdGVkRXZlbnQgPSB1c2VNZW1vKFxuICAgICgpID0+IGdldFNvcnRlZE1hdGNoZXJzRm9yRXZlbnQoaG9va3NCeUV2ZW50QW5kTWF0Y2hlciwgc2VsZWN0ZWRFdmVudCksXG4gICAgW2hvb2tzQnlFdmVudEFuZE1hdGNoZXIsIHNlbGVjdGVkRXZlbnRdLFxuICApXG5cbiAgY29uc3QgaG9va3NGb3JTZWxlY3RlZE1hdGNoZXIgPSB1c2VNZW1vKFxuICAgICgpID0+XG4gICAgICBnZXRIb29rc0Zvck1hdGNoZXIoXG4gICAgICAgIGhvb2tzQnlFdmVudEFuZE1hdGNoZXIsXG4gICAgICAgIHNlbGVjdGVkRXZlbnQsXG4gICAgICAgIHNlbGVjdGVkTWF0Y2hlcixcbiAgICAgICksXG4gICAgW2hvb2tzQnlFdmVudEFuZE1hdGNoZXIsIHNlbGVjdGVkRXZlbnQsIHNlbGVjdGVkTWF0Y2hlcl0sXG4gIClcblxuICAvLyBIYW5kbGVyIGZvciBleGl0aW5nIHRoZSBkaWFsb2dcbiAgY29uc3QgaGFuZGxlRXhpdCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBvbkV4aXQoJ0hvb2tzIGRpYWxvZyBkaXNtaXNzZWQnLCB7IGRpc3BsYXk6ICdzeXN0ZW0nIH0pXG4gIH0sIFtvbkV4aXRdKVxuXG4gIC8vIEVzY2FwZSBoYW5kbGluZyBmb3Igc2VsZWN0LWV2ZW50IG1vZGUgLSBleGl0IHRoZSBtZW51XG4gIHVzZUtleWJpbmRpbmcoJ2NvbmZpcm06bm8nLCBoYW5kbGVFeGl0LCB7XG4gICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgaXNBY3RpdmU6IG1vZGUgPT09ICdzZWxlY3QtZXZlbnQnLFxuICB9KVxuXG4gIC8vIEVzY2FwZSBoYW5kbGluZyBmb3Igc2VsZWN0LW1hdGNoZXIgbW9kZSAtIGdvIHRvIHNlbGVjdC1ldmVudFxuICB1c2VLZXliaW5kaW5nKFxuICAgICdjb25maXJtOm5vJyxcbiAgICAoKSA9PiB7XG4gICAgICBzZXRNb2RlU3RhdGUoeyBtb2RlOiAnc2VsZWN0LWV2ZW50JyB9KVxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgICBpc0FjdGl2ZTogbW9kZSA9PT0gJ3NlbGVjdC1tYXRjaGVyJyxcbiAgICB9LFxuICApXG5cbiAgLy8gRXNjYXBlIGhhbmRsaW5nIGZvciBzZWxlY3QtaG9vayBtb2RlIC0gZ28gdG8gc2VsZWN0LW1hdGNoZXIgb3Igc2VsZWN0LWV2ZW50XG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2NvbmZpcm06bm8nLFxuICAgICgpID0+IHtcbiAgICAgIGlmICgnZXZlbnQnIGluIG1vZGVTdGF0ZSkge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgZ2V0TWF0Y2hlck1ldGFkYXRhKG1vZGVTdGF0ZS5ldmVudCwgY29tYmluZWRUb29sTmFtZXMpICE9PSB1bmRlZmluZWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgc2V0TW9kZVN0YXRlKHsgbW9kZTogJ3NlbGVjdC1tYXRjaGVyJywgZXZlbnQ6IG1vZGVTdGF0ZS5ldmVudCB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNldE1vZGVTdGF0ZSh7IG1vZGU6ICdzZWxlY3QtZXZlbnQnIH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHtcbiAgICAgIGNvbnRleHQ6ICdDb25maXJtYXRpb24nLFxuICAgICAgaXNBY3RpdmU6IG1vZGUgPT09ICdzZWxlY3QtaG9vaycsXG4gICAgfSxcbiAgKVxuXG4gIC8vIEVzY2FwZSBoYW5kbGluZyBmb3Igdmlldy1ob29rIG1vZGUgLSBnbyB0byBzZWxlY3QtaG9va1xuICB1c2VLZXliaW5kaW5nKFxuICAgICdjb25maXJtOm5vJyxcbiAgICAoKSA9PiB7XG4gICAgICBpZiAobW9kZVN0YXRlLm1vZGUgPT09ICd2aWV3LWhvb2snKSB7XG4gICAgICAgIGNvbnN0IHsgZXZlbnQsIGhvb2sgfSA9IG1vZGVTdGF0ZVxuICAgICAgICBzZXRNb2RlU3RhdGUoe1xuICAgICAgICAgIG1vZGU6ICdzZWxlY3QtaG9vaycsXG4gICAgICAgICAgZXZlbnQsXG4gICAgICAgICAgbWF0Y2hlcjogaG9vay5tYXRjaGVyIHx8ICcnLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgICBpc0FjdGl2ZTogbW9kZSA9PT0gJ3ZpZXctaG9vaycsXG4gICAgfSxcbiAgKVxuXG4gIGNvbnN0IGhvb2tFdmVudE1ldGFkYXRhID0gZ2V0SG9va0V2ZW50TWV0YWRhdGEoY29tYmluZWRUb29sTmFtZXMpXG5cbiAgLy8gQ2hlY2sgaWYgaG9va3MgYXJlIGRpc2FibGVkXG4gIGNvbnN0IHNldHRpbmdzID0gZ2V0U2V0dGluZ3NfREVQUkVDQVRFRCgpXG4gIGNvbnN0IGhvb2tzRGlzYWJsZWQgPSBzZXR0aW5ncz8uZGlzYWJsZUFsbEhvb2tzID09PSB0cnVlXG5cbiAgLy8gQ291bnQgaG9va3MgcGVyIGV2ZW50IGZvciB0aGUgZXZlbnQtc2VsZWN0aW9uIHZpZXcsIGFuZCB0aGUgdG90YWwuXG4gIGNvbnN0IHsgaG9va3NCeUV2ZW50LCB0b3RhbEhvb2tzQ291bnQgfSA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGJ5RXZlbnQ6IFBhcnRpYWw8UmVjb3JkPEhvb2tFdmVudCwgbnVtYmVyPj4gPSB7fVxuICAgIGxldCB0b3RhbCA9IDBcbiAgICBmb3IgKGNvbnN0IFtldmVudCwgbWF0Y2hlcnNdIG9mIE9iamVjdC5lbnRyaWVzKGhvb2tzQnlFdmVudEFuZE1hdGNoZXIpKSB7XG4gICAgICBjb25zdCBldmVudENvdW50ID0gT2JqZWN0LnZhbHVlcyhtYXRjaGVycykucmVkdWNlKFxuICAgICAgICAoc3VtLCBob29rcykgPT4gc3VtICsgaG9va3MubGVuZ3RoLFxuICAgICAgICAwLFxuICAgICAgKVxuICAgICAgYnlFdmVudFtldmVudCBhcyBIb29rRXZlbnRdID0gZXZlbnRDb3VudFxuICAgICAgdG90YWwgKz0gZXZlbnRDb3VudFxuICAgIH1cbiAgICByZXR1cm4geyBob29rc0J5RXZlbnQ6IGJ5RXZlbnQsIHRvdGFsSG9va3NDb3VudDogdG90YWwgfVxuICB9LCBbaG9va3NCeUV2ZW50QW5kTWF0Y2hlcl0pXG5cbiAgLy8gSWYgaG9va3MgYXJlIGRpc2FibGVkLCBzaG93IGFuIGluZm9ybWF0aW9uYWwgc2NyZWVuLlxuICAvLyBUaGUgbWVudSBpcyByZWFkLW9ubHksIHNvIHdlIGRvbid0IG9mZmVyIGEgcmUtZW5hYmxlIGJ1dHRvbiDigJRcbiAgLy8gdXNlcnMgY2FuIGVkaXQgc2V0dGluZ3MuanNvbiBvciBhc2sgQ2xhdWRlIGluc3RlYWQuXG4gIGlmIChob29rc0Rpc2FibGVkKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxEaWFsb2dcbiAgICAgICAgdGl0bGU9XCJIb29rIENvbmZpZ3VyYXRpb24gLSBEaXNhYmxlZFwiXG4gICAgICAgIG9uQ2FuY2VsPXtoYW5kbGVFeGl0fVxuICAgICAgICBpbnB1dEd1aWRlPXsoKSA9PiA8VGV4dD5Fc2MgdG8gY2xvc2U8L1RleHQ+fVxuICAgICAgPlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9PlxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgIEFsbCBob29rcyBhcmUgY3VycmVudGx5IDxUZXh0IGJvbGQ+ZGlzYWJsZWQ8L1RleHQ+XG4gICAgICAgICAgICAgIHtkaXNhYmxlZEJ5UG9saWN5ICYmICcgYnkgYSBtYW5hZ2VkIHNldHRpbmdzIGZpbGUnfS4gWW91IGhhdmV7JyAnfVxuICAgICAgICAgICAgICA8VGV4dCBib2xkPnt0b3RhbEhvb2tzQ291bnR9PC9UZXh0PiBjb25maWd1cmVkeycgJ31cbiAgICAgICAgICAgICAge3BsdXJhbCh0b3RhbEhvb2tzQ291bnQsICdob29rJyl9IHRoYXR7JyAnfVxuICAgICAgICAgICAgICB7cGx1cmFsKHRvdGFsSG9va3NDb3VudCwgJ2lzJywgJ2FyZScpfSBub3QgcnVubmluZy5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+V2hlbiBob29rcyBhcmUgZGlzYWJsZWQ6PC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj7CtyBObyBob29rIGNvbW1hbmRzIHdpbGwgZXhlY3V0ZTwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPsK3IFN0YXR1c0xpbmUgd2lsbCBub3QgYmUgZGlzcGxheWVkPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIMK3IFRvb2wgb3BlcmF0aW9ucyB3aWxsIHByb2NlZWQgd2l0aG91dCBob29rIHZhbGlkYXRpb25cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgICB7IWRpc2FibGVkQnlQb2xpY3kgJiYgKFxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIFRvIHJlLWVuYWJsZSBob29rcywgcmVtb3ZlICZxdW90O2Rpc2FibGVBbGxIb29rcyZxdW90OyBmcm9tXG4gICAgICAgICAgICAgIHNldHRpbmdzLmpzb24gb3IgYXNrIENsYXVkZS5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cbiAgICAgIDwvRGlhbG9nPlxuICAgIClcbiAgfVxuXG4gIHN3aXRjaCAobW9kZVN0YXRlLm1vZGUpIHtcbiAgICBjYXNlICdzZWxlY3QtZXZlbnQnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPFNlbGVjdEV2ZW50TW9kZVxuICAgICAgICAgIGhvb2tFdmVudE1ldGFkYXRhPXtob29rRXZlbnRNZXRhZGF0YX1cbiAgICAgICAgICBob29rc0J5RXZlbnQ9e2hvb2tzQnlFdmVudH1cbiAgICAgICAgICB0b3RhbEhvb2tzQ291bnQ9e3RvdGFsSG9va3NDb3VudH1cbiAgICAgICAgICByZXN0cmljdGVkQnlQb2xpY3k9e3Jlc3RyaWN0ZWRCeVBvbGljeX1cbiAgICAgICAgICBvblNlbGVjdEV2ZW50PXtldmVudCA9PiB7XG4gICAgICAgICAgICBpZiAoZ2V0TWF0Y2hlck1ldGFkYXRhKGV2ZW50LCBjb21iaW5lZFRvb2xOYW1lcykgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBzZXRNb2RlU3RhdGUoeyBtb2RlOiAnc2VsZWN0LW1hdGNoZXInLCBldmVudCB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc2V0TW9kZVN0YXRlKHsgbW9kZTogJ3NlbGVjdC1ob29rJywgZXZlbnQsIG1hdGNoZXI6ICcnIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfX1cbiAgICAgICAgICBvbkNhbmNlbD17aGFuZGxlRXhpdH1cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICBjYXNlICdzZWxlY3QtbWF0Y2hlcic6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8U2VsZWN0TWF0Y2hlck1vZGVcbiAgICAgICAgICBzZWxlY3RlZEV2ZW50PXttb2RlU3RhdGUuZXZlbnR9XG4gICAgICAgICAgbWF0Y2hlcnNGb3JTZWxlY3RlZEV2ZW50PXtzb3J0ZWRNYXRjaGVyc0ZvclNlbGVjdGVkRXZlbnR9XG4gICAgICAgICAgaG9va3NCeUV2ZW50QW5kTWF0Y2hlcj17aG9va3NCeUV2ZW50QW5kTWF0Y2hlcn1cbiAgICAgICAgICBldmVudERlc2NyaXB0aW9uPXtob29rRXZlbnRNZXRhZGF0YVttb2RlU3RhdGUuZXZlbnRdLmRlc2NyaXB0aW9ufVxuICAgICAgICAgIG9uU2VsZWN0PXttYXRjaGVyID0+IHtcbiAgICAgICAgICAgIHNldE1vZGVTdGF0ZSh7XG4gICAgICAgICAgICAgIG1vZGU6ICdzZWxlY3QtaG9vaycsXG4gICAgICAgICAgICAgIGV2ZW50OiBtb2RlU3RhdGUuZXZlbnQsXG4gICAgICAgICAgICAgIG1hdGNoZXIsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH19XG4gICAgICAgICAgb25DYW5jZWw9eygpID0+IHtcbiAgICAgICAgICAgIHNldE1vZGVTdGF0ZSh7IG1vZGU6ICdzZWxlY3QtZXZlbnQnIH0pXG4gICAgICAgICAgfX1cbiAgICAgICAgLz5cbiAgICAgIClcbiAgICBjYXNlICdzZWxlY3QtaG9vayc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8U2VsZWN0SG9va01vZGVcbiAgICAgICAgICBzZWxlY3RlZEV2ZW50PXttb2RlU3RhdGUuZXZlbnR9XG4gICAgICAgICAgc2VsZWN0ZWRNYXRjaGVyPXttb2RlU3RhdGUubWF0Y2hlcn1cbiAgICAgICAgICBob29rc0ZvclNlbGVjdGVkTWF0Y2hlcj17aG9va3NGb3JTZWxlY3RlZE1hdGNoZXJ9XG4gICAgICAgICAgaG9va0V2ZW50TWV0YWRhdGE9e2hvb2tFdmVudE1ldGFkYXRhW21vZGVTdGF0ZS5ldmVudF19XG4gICAgICAgICAgb25TZWxlY3Q9e2hvb2sgPT4ge1xuICAgICAgICAgICAgc2V0TW9kZVN0YXRlKHtcbiAgICAgICAgICAgICAgbW9kZTogJ3ZpZXctaG9vaycsXG4gICAgICAgICAgICAgIGV2ZW50OiBtb2RlU3RhdGUuZXZlbnQsXG4gICAgICAgICAgICAgIGhvb2ssXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH19XG4gICAgICAgICAgb25DYW5jZWw9eygpID0+IHtcbiAgICAgICAgICAgIC8vIEdvIGJhY2sgdG8gbWF0Y2hlciBzZWxlY3Rpb24gb3IgZXZlbnQgc2VsZWN0aW9uXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGdldE1hdGNoZXJNZXRhZGF0YShtb2RlU3RhdGUuZXZlbnQsIGNvbWJpbmVkVG9vbE5hbWVzKSAhPT1cbiAgICAgICAgICAgICAgdW5kZWZpbmVkXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgc2V0TW9kZVN0YXRlKHtcbiAgICAgICAgICAgICAgICBtb2RlOiAnc2VsZWN0LW1hdGNoZXInLFxuICAgICAgICAgICAgICAgIGV2ZW50OiBtb2RlU3RhdGUuZXZlbnQsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzZXRNb2RlU3RhdGUoeyBtb2RlOiAnc2VsZWN0LWV2ZW50JyB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH19XG4gICAgICAgIC8+XG4gICAgICApXG4gICAgY2FzZSAndmlldy1ob29rJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxWaWV3SG9va01vZGVcbiAgICAgICAgICBzZWxlY3RlZEhvb2s9e21vZGVTdGF0ZS5ob29rfVxuICAgICAgICAgIGV2ZW50U3VwcG9ydHNNYXRjaGVyPXtcbiAgICAgICAgICAgIGdldE1hdGNoZXJNZXRhZGF0YShtb2RlU3RhdGUuZXZlbnQsIGNvbWJpbmVkVG9vbE5hbWVzKSAhPT0gdW5kZWZpbmVkXG4gICAgICAgICAgfVxuICAgICAgICAgIG9uQ2FuY2VsPXsoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB7IGV2ZW50LCBob29rIH0gPSBtb2RlU3RhdGVcbiAgICAgICAgICAgIHNldE1vZGVTdGF0ZSh7XG4gICAgICAgICAgICAgIG1vZGU6ICdzZWxlY3QtaG9vaycsXG4gICAgICAgICAgICAgIGV2ZW50LFxuICAgICAgICAgICAgICBtYXRjaGVyOiBob29rLm1hdGNoZXIgfHwgJycsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH19XG4gICAgICAgIC8+XG4gICAgICApXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU8sS0FBS0EsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsV0FBVyxFQUFFQyxPQUFPLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ3RELGNBQWNDLFNBQVMsUUFBUSxrQ0FBa0M7QUFDakUsU0FBU0MsV0FBVyxFQUFFQyxnQkFBZ0IsUUFBUSx1QkFBdUI7QUFDckUsY0FBY0Msb0JBQW9CLFFBQVEsbUJBQW1CO0FBQzdELFNBQVNDLGlCQUFpQixRQUFRLGtDQUFrQztBQUNwRSxTQUFTQyxHQUFHLEVBQUVDLElBQUksUUFBUSxjQUFjO0FBQ3hDLFNBQVNDLGFBQWEsUUFBUSxvQ0FBb0M7QUFDbEUsU0FDRUMsb0JBQW9CLEVBQ3BCQyxrQkFBa0IsRUFDbEJDLGtCQUFrQixFQUNsQkMseUJBQXlCLEVBQ3pCQywyQkFBMkIsUUFDdEIseUNBQXlDO0FBQ2hELGNBQWNDLG9CQUFvQixRQUFRLG9DQUFvQztBQUM5RSxTQUNFQyxzQkFB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