import { c as _c } from "react/compiler-runtime";
import capitalize from 'lodash-es/capitalize.js';
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useExitOnCtrlCDWithKeybindings } from 'src/hooks/useExitOnCtrlCDWithKeybindings.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { FAST_MODE_MODEL_DISPLAY, isFastModeAvailable, isFastModeCooldown, isFastModeEnabled } from 'src/utils/fastMode.js';
import { Box, Text } from '../ink.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import { convertEffortValueToLevel, type EffortLevel, getDefaultEffortForModel, modelSupportsEffort, modelSupportsMaxEffort, resolvePickerEffortPersistence, toPersistableEffort } from '../utils/effort.js';
import { getDefaultMainLoopModel, type ModelSetting, modelDisplayString, parseUserSpecifiedModel } from '../utils/model/model.js';
import { getModelOptions } from '../utils/model/modelOptions.js';
import { getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings.js';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js';
import { Select } from './CustomSelect/index.js';
import { Byline } from './design-system/Byline.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { Pane } from './design-system/Pane.js';
import { effortLevelToSymbol } from './EffortIndicator.js';
export type Props = {
  initial: string | null;
  sessionModel?: ModelSetting;
  onSelect: (model: string | null, effort: EffortLevel | undefined) => void;
  onCancel?: () => void;
  isStandaloneCommand?: boolean;
  showFastModeNotice?: boolean;
  /** Overrides the dim header line below "Select model". */
  headerText?: string;
  /**
   * When true, skip writing effortLevel to userSettings on selection.
   * Used by the assistant installer wizard where the model choice is
   * project-scoped (written to the assistant's .claude/settings.json via
   * install.ts) and should not leak to the user's global ~/.claude/settings.
   */
  skipSettingsWrite?: boolean;
};
const NO_PREFERENCE = '__NO_PREFERENCE__';
export function ModelPicker(t0) {
  const $ = _c(82);
  const {
    initial,
    sessionModel,
    onSelect,
    onCancel,
    isStandaloneCommand,
    showFastModeNotice,
    headerText,
    skipSettingsWrite
  } = t0;
  const setAppState = useSetAppState();
  const exitState = useExitOnCtrlCDWithKeybindings();
  const initialValue = initial === null ? NO_PREFERENCE : initial;
  const [focusedValue, setFocusedValue] = useState(initialValue);
  const isFastMode = useAppState(_temp);
  const [hasToggledEffort, setHasToggledEffort] = useState(false);
  const effortValue = useAppState(_temp2);
  let t1;
  if ($[0] !== effortValue) {
    t1 = effortValue !== undefined ? convertEffortValueToLevel(effortValue) : undefined;
    $[0] = effortValue;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const [effort, setEffort] = useState(t1);
  const t2 = isFastMode ?? false;
  let t3;
  if ($[2] !== t2) {
    t3 = getModelOptions(t2);
    $[2] = t2;
    $[3] = t3;
  } else {
    t3 = $[3];
  }
  const modelOptions = t3;
  let t4;
  bb0: {
    if (initial !== null && !modelOptions.some(opt => opt.value === initial)) {
      let t5;
      if ($[4] !== initial) {
        t5 = modelDisplayString(initial);
        $[4] = initial;
        $[5] = t5;
      } else {
        t5 = $[5];
      }
      let t6;
      if ($[6] !== initial || $[7] !== t5) {
        t6 = {
          value: initial,
          label: t5,
          description: "Current model"
        };
        $[6] = initial;
        $[7] = t5;
        $[8] = t6;
      } else {
        t6 = $[8];
      }
      let t7;
      if ($[9] !== modelOptions || $[10] !== t6) {
        t7 = [...modelOptions, t6];
        $[9] = modelOptions;
        $[10] = t6;
        $[11] = t7;
      } else {
        t7 = $[11];
      }
      t4 = t7;
      break bb0;
    }
    t4 = modelOptions;
  }
  const optionsWithInitial = t4;
  let t5;
  if ($[12] !== optionsWithInitial) {
    t5 = optionsWithInitial.map(_temp3);
    $[12] = optionsWithInitial;
    $[13] = t5;
  } else {
    t5 = $[13];
  }
  const selectOptions = t5;
  let t6;
  if ($[14] !== initialValue || $[15] !== selectOptions) {
    t6 = selectOptions.some(_ => _.value === initialValue) ? initialValue : selectOptions[0]?.value ?? undefined;
    $[14] = initialValue;
    $[15] = selectOptions;
    $[16] = t6;
  } else {
    t6 = $[16];
  }
  const initialFocusValue = t6;
  const visibleCount = Math.min(10, selectOptions.length);
  const hiddenCount = Math.max(0, selectOptions.length - visibleCount);
  let t7;
  if ($[17] !== focusedValue || $[18] !== selectOptions) {
    t7 = selectOptions.find(opt_1 => opt_1.value === focusedValue)?.label;
    $[17] = focusedValue;
    $[18] = selectOptions;
    $[19] = t7;
  } else {
    t7 = $[19];
  }
  const focusedModelName = t7;
  let focusedSupportsEffort;
  let t8;
  if ($[20] !== focusedValue) {
    const focusedModel = resolveOptionModel(focusedValue);
    focusedSupportsEffort = focusedModel ? modelSupportsEffort(focusedModel) : false;
    t8 = focusedModel ? modelSupportsMaxEffort(focusedModel) : false;
    $[20] = focusedValue;
    $[21] = focusedSupportsEffort;
    $[22] = t8;
  } else {
    focusedSupportsEffort = $[21];
    t8 = $[22];
  }
  const focusedSupportsMax = t8;
  let t9;
  if ($[23] !== focusedValue) {
    t9 = getDefaultEffortLevelForOption(focusedValue);
    $[23] = focusedValue;
    $[24] = t9;
  } else {
    t9 = $[24];
  }
  const focusedDefaultEffort = t9;
  const displayEffort = effort === "max" && !focusedSupportsMax ? "high" : effort;
  let t10;
  if ($[25] !== effortValue || $[26] !== hasToggledEffort) {
    t10 = value => {
      setFocusedValue(value);
      if (!hasToggledEffort && effortValue === undefined) {
        setEffort(getDefaultEffortLevelForOption(value));
      }
    };
    $[25] = effortValue;
    $[26] = hasToggledEffort;
    $[27] = t10;
  } else {
    t10 = $[27];
  }
  const handleFocus = t10;
  let t11;
  if ($[28] !== focusedDefaultEffort || $[29] !== focusedSupportsEffort || $[30] !== focusedSupportsMax) {
    t11 = direction => {
      if (!focusedSupportsEffort) {
        return;
      }
      setEffort(prev => cycleEffortLevel(prev ?? focusedDefaultEffort, direction, focusedSupportsMax));
      setHasToggledEffort(true);
    };
    $[28] = focusedDefaultEffort;
    $[29] = focusedSupportsEffort;
    $[30] = focusedSupportsMax;
    $[31] = t11;
  } else {
    t11 = $[31];
  }
  const handleCycleEffort = t11;
  let t12;
  if ($[32] !== handleCycleEffort) {
    t12 = {
      "modelPicker:decreaseEffort": () => handleCycleEffort("left"),
      "modelPicker:increaseEffort": () => handleCycleEffort("right")
    };
    $[32] = handleCycleEffort;
    $[33] = t12;
  } else {
    t12 = $[33];
  }
  let t13;
  if ($[34] === Symbol.for("react.memo_cache_sentinel")) {
    t13 = {
      context: "ModelPicker"
    };
    $[34] = t13;
  } else {
    t13 = $[34];
  }
  useKeybindings(t12, t13);
  let t14;
  if ($[35] !== effort || $[36] !== hasToggledEffort || $[37] !== onSelect || $[38] !== setAppState || $[39] !== skipSettingsWrite) {
    t14 = function handleSelect(value_0) {
      logEvent("tengu_model_command_menu_effort", {
        effort: effort as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      if (!skipSettingsWrite) {
        const effortLevel = resolvePickerEffortPersistence(effort, getDefaultEffortLevelForOption(value_0), getSettingsForSource("userSettings")?.effortLevel, hasToggledEffort);
        const persistable = toPersistableEffort(effortLevel);
        if (persistable !== undefined) {
          updateSettingsForSource("userSettings", {
            effortLevel: persistable
          });
        }
        setAppState(prev_0 => ({
          ...prev_0,
          effortValue: effortLevel
        }));
      }
      const selectedModel = resolveOptionModel(value_0);
      const selectedEffort = hasToggledEffort && selectedModel && modelSupportsEffort(selectedModel) ? effort : undefined;
      if (value_0 === NO_PREFERENCE) {
        onSelect(null, selectedEffort);
        return;
      }
      onSelect(value_0, selectedEffort);
    };
    $[35] = effort;
    $[36] = hasToggledEffort;
    $[37] = onSelect;
    $[38] = setAppState;
    $[39] = skipSettingsWrite;
    $[40] = t14;
  } else {
    t14 = $[40];
  }
  const handleSelect = t14;
  let t15;
  if ($[41] === Symbol.for("react.memo_cache_sentinel")) {
    t15 = <Text color="remember" bold={true}>Select model</Text>;
    $[41] = t15;
  } else {
    t15 = $[41];
  }
  const t16 = headerText ?? "Switch between Claude models. Applies to this session and future Claude Code sessions. For other/previous model names, specify with --model.";
  let t17;
  if ($[42] !== t16) {
    t17 = <Text dimColor={true}>{t16}</Text>;
    $[42] = t16;
    $[43] = t17;
  } else {
    t17 = $[43];
  }
  let t18;
  if ($[44] !== sessionModel) {
    t18 = sessionModel && <Text dimColor={true}>Currently using {modelDisplayString(sessionModel)} for this session (set by plan mode). Selecting a model will undo this.</Text>;
    $[44] = sessionModel;
    $[45] = t18;
  } else {
    t18 = $[45];
  }
  let t19;
  if ($[46] !== t17 || $[47] !== t18) {
    t19 = <Box marginBottom={1} flexDirection="column">{t15}{t17}{t18}</Box>;
    $[46] = t17;
    $[47] = t18;
    $[48] = t19;
  } else {
    t19 = $[48];
  }
  const t20 = onCancel ?? _temp4;
  let t21;
  if ($[49] !== handleFocus || $[50] !== handleSelect || $[51] !== initialFocusValue || $[52] !== initialValue || $[53] !== selectOptions || $[54] !== t20 || $[55] !== visibleCount) {
    t21 = <Box flexDirection="column"><Select defaultValue={initialValue} defaultFocusValue={initialFocusValue} options={selectOptions} onChange={handleSelect} onFocus={handleFocus} onCancel={t20} visibleOptionCount={visibleCount} /></Box>;
    $[49] = handleFocus;
    $[50] = handleSelect;
    $[51] = initialFocusValue;
    $[52] = initialValue;
    $[53] = selectOptions;
    $[54] = t20;
    $[55] = visibleCount;
    $[56] = t21;
  } else {
    t21 = $[56];
  }
  let t22;
  if ($[57] !== hiddenCount) {
    t22 = hiddenCount > 0 && <Box paddingLeft={3}><Text dimColor={true}>and {hiddenCount} more…</Text></Box>;
    $[57] = hiddenCount;
    $[58] = t22;
  } else {
    t22 = $[58];
  }
  let t23;
  if ($[59] !== t21 || $[60] !== t22) {
    t23 = <Box flexDirection="column" marginBottom={1}>{t21}{t22}</Box>;
    $[59] = t21;
    $[60] = t22;
    $[61] = t23;
  } else {
    t23 = $[61];
  }
  let t24;
  if ($[62] !== displayEffort || $[63] !== focusedDefaultEffort || $[64] !== focusedModelName || $[65] !== focusedSupportsEffort) {
    t24 = <Box marginBottom={1} flexDirection="column">{focusedSupportsEffort ? <Text dimColor={true}><EffortLevelIndicator effort={displayEffort} />{" "}{capitalize(displayEffort)} effort{displayEffort === focusedDefaultEffort ? " (default)" : ""}{" "}<Text color="subtle">← → to adjust</Text></Text> : <Text color="subtle"><EffortLevelIndicator effort={undefined} /> Effort not supported{focusedModelName ? ` for ${focusedModelName}` : ""}</Text>}</Box>;
    $[62] = displayEffort;
    $[63] = focusedDefaultEffort;
    $[64] = focusedModelName;
    $[65] = focusedSupportsEffort;
    $[66] = t24;
  } else {
    t24 = $[66];
  }
  let t25;
  if ($[67] !== showFastModeNotice) {
    t25 = isFastModeEnabled() ? showFastModeNotice ? <Box marginBottom={1}><Text dimColor={true}>Fast mode is <Text bold={true}>ON</Text> and available with{" "}{FAST_MODE_MODEL_DISPLAY} only (/fast). Switching to other models turn off fast mode.</Text></Box> : isFastModeAvailable() && !isFastModeCooldown() ? <Box marginBottom={1}><Text dimColor={true}>Use <Text bold={true}>/fast</Text> to turn on Fast mode ({FAST_MODE_MODEL_DISPLAY} only).</Text></Box> : null : null;
    $[67] = showFastModeNotice;
    $[68] = t25;
  } else {
    t25 = $[68];
  }
  let t26;
  if ($[69] !== t19 || $[70] !== t23 || $[71] !== t24 || $[72] !== t25) {
    t26 = <Box flexDirection="column">{t19}{t23}{t24}{t25}</Box>;
    $[69] = t19;
    $[70] = t23;
    $[71] = t24;
    $[72] = t25;
    $[73] = t26;
  } else {
    t26 = $[73];
  }
  let t27;
  if ($[74] !== exitState || $[75] !== isStandaloneCommand) {
    t27 = isStandaloneCommand && <Text dimColor={true} italic={true}>{exitState.pending ? <>Press {exitState.keyName} again to exit</> : <Byline><KeyboardShortcutHint shortcut="Enter" action="confirm" /><ConfigurableShortcutHint action="select:cancel" context="Select" fallback="Esc" description="exit" /></Byline>}</Text>;
    $[74] = exitState;
    $[75] = isStandaloneCommand;
    $[76] = t27;
  } else {
    t27 = $[76];
  }
  let t28;
  if ($[77] !== t26 || $[78] !== t27) {
    t28 = <Box flexDirection="column">{t26}{t27}</Box>;
    $[77] = t26;
    $[78] = t27;
    $[79] = t28;
  } else {
    t28 = $[79];
  }
  const content = t28;
  if (!isStandaloneCommand) {
    return content;
  }
  let t29;
  if ($[80] !== content) {
    t29 = <Pane color="permission">{content}</Pane>;
    $[80] = content;
    $[81] = t29;
  } else {
    t29 = $[81];
  }
  return t29;
}
function _temp4() {}
function _temp3(opt_0) {
  return {
    ...opt_0,
    value: opt_0.value === null ? NO_PREFERENCE : opt_0.value
  };
}
function _temp2(s_0) {
  return s_0.effortValue;
}
function _temp(s) {
  return isFastModeEnabled() ? s.fastMode : false;
}
function resolveOptionModel(value?: string): string | undefined {
  if (!value) return undefined;
  return value === NO_PREFERENCE ? getDefaultMainLoopModel() : parseUserSpecifiedModel(value);
}
function EffortLevelIndicator(t0) {
  const $ = _c(5);
  const {
    effort
  } = t0;
  const t1 = effort ? "claude" : "subtle";
  const t2 = effort ?? "low";
  let t3;
  if ($[0] !== t2) {
    t3 = effortLevelToSymbol(t2);
    $[0] = t2;
    $[1] = t3;
  } else {
    t3 = $[1];
  }
  let t4;
  if ($[2] !== t1 || $[3] !== t3) {
    t4 = <Text color={t1}>{t3}</Text>;
    $[2] = t1;
    $[3] = t3;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  return t4;
}
function cycleEffortLevel(current: EffortLevel, direction: 'left' | 'right', includeMax: boolean): EffortLevel {
  const levels: EffortLevel[] = includeMax ? ['low', 'medium', 'high', 'max'] : ['low', 'medium', 'high'];
  // If the current level isn't in the cycle (e.g. 'max' after switching to a
  // non-Opus model), clamp to 'high'.
  const idx = levels.indexOf(current);
  const currentIndex = idx !== -1 ? idx : levels.indexOf('high');
  if (direction === 'right') {
    return levels[(currentIndex + 1) % levels.length]!;
  } else {
    return levels[(currentIndex - 1 + levels.length) % levels.length]!;
  }
}
function getDefaultEffortLevelForOption(value?: string): EffortLevel {
  const resolved = resolveOptionModel(value) ?? getDefaultMainLoopModel();
  const defaultValue = getDefaultEffortForModel(resolved);
  return defaultValue !== undefined ? convertEffortValueToLevel(defaultValue) : 'high';
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJjYXBpdGFsaXplIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZU1lbW8iLCJ1c2VTdGF0ZSIsInVzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncyIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJsb2dFdmVudCIsIkZBU1RfTU9ERV9NT0RFTF9ESVNQTEFZIiwiaXNGYXN0TW9kZUF2YWlsYWJsZSIsImlzRmFzdE1vZGVDb29sZG93biIsImlzRmFzdE1vZGVFbmFibGVkIiwiQm94IiwiVGV4dCIsInVzZUtleWJpbmRpbmdzIiwidXNlQXBwU3RhdGUiLCJ1c2VTZXRBcHBTdGF0ZSIsImNvbnZlcnRFZmZvcnRWYWx1ZVRvTGV2ZWwiLCJFZmZvcnRMZXZlbCIsImdldERlZmF1bHRFZmZvcnRGb3JNb2RlbCIsIm1vZGVsU3VwcG9ydHNFZmZvcnQiLCJtb2RlbFN1cHBvcnRzTWF4RWZmb3J0IiwicmVzb2x2ZVBpY2tlckVmZm9ydFBlcnNpc3RlbmNlIiwidG9QZXJzaXN0YWJsZUVmZm9ydCIsImdldERlZmF1bHRNYWluTG9vcE1vZGVsIiwiTW9kZWxTZXR0aW5nIiwibW9kZWxEaXNwbGF5U3RyaW5nIiwicGFyc2VVc2VyU3BlY2lmaWVkTW9kZWwiLCJnZXRNb2RlbE9wdGlvbnMiLCJnZXRTZXR0aW5nc0ZvclNvdXJjZSIsInVwZGF0ZVNldHRpbmdzRm9yU291cmNlIiwiQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IiwiU2VsZWN0IiwiQnlsaW5lIiwiS2V5Ym9hcmRTaG9ydGN1dEhpbnQiLCJQYW5lIiwiZWZmb3J0TGV2ZWxUb1N5bWJvbCIsIlByb3BzIiwiaW5pdGlhbCIsInNlc3Npb25Nb2RlbCIsIm9uU2VsZWN0IiwibW9kZWwiLCJlZmZvcnQiLCJvbkNhbmNlbCIsImlzU3RhbmRhbG9uZUNvbW1hbmQiLCJzaG93RmFzdE1vZGVOb3RpY2UiLCJoZWFkZXJUZXh0Iiwic2tpcFNldHRpbmdzV3JpdGUiLCJOT19QUkVGRVJFTkNFIiwiTW9kZWxQaWNrZXIiLCJ0MCIsIiQiLCJfYyIsInNldEFwcFN0YXRlIiwiZXhpdFN0YXRlIiwiaW5pdGlhbFZhbHVlIiwiZm9jdXNlZFZhbHVlIiwic2V0Rm9jdXNlZFZhbHVlIiwiaXNGYXN0TW9kZSIsIl90ZW1wIiwiaGFzVG9nZ2xlZEVmZm9ydCIsInNldEhhc1RvZ2dsZWRFZmZvcnQiLCJlZmZvcnRWYWx1ZSIsIl90ZW1wMiIsInQxIiwidW5kZWZpbmVkIiwic2V0RWZmb3J0IiwidDIiLCJ0MyIsIm1vZGVsT3B0aW9ucyIsInQ0IiwiYmIwIiwic29tZSIsIm9wdCIsInZhbHVlIiwidDUiLCJ0NiIsImxhYmVsIiwiZGVzY3JpcHRpb24iLCJ0NyIsIm9wdGlvbnNXaXRoSW5pdGlhbCIsIm1hcCIsIl90ZW1wMyIsInNlbGVjdE9wdGlvbnMiLCJfIiwiaW5pdGlhbEZvY3VzVmFsdWUiLCJ2aXNpYmxlQ291bnQiLCJNYXRoIiwibWluIiwibGVuZ3RoIiwiaGlkZGVuQ291bnQiLCJtYXgiLCJmaW5kIiwib3B0XzEiLCJmb2N1c2VkTW9kZWxOYW1lIiwiZm9jdXNlZFN1cHBvcnRzRWZmb3J0IiwidDgiLCJmb2N1c2VkTW9kZWwiLCJyZXNvbHZlT3B0aW9uTW9kZWwiLCJmb2N1c2VkU3VwcG9ydHNNYXgiLCJ0OSIsImdldERlZmF1bHRFZmZvcnRMZXZlbEZvck9wdGlvbiIsImZvY3VzZWREZWZhdWx0RWZmb3J0IiwiZGlzcGxheUVmZm9ydCIsInQxMCIsImhhbmRsZUZvY3VzIiwidDExIiwiZGlyZWN0aW9uIiwicHJldiIsImN5Y2xlRWZmb3J0TGV2ZWwiLCJoYW5kbGVDeWNsZUVmZm9ydCIsInQxMiIsIm1vZGVsUGlja2VyOmRlY3JlYXNlRWZmb3J0IiwibW9kZWxQaWNrZXI6aW5jcmVhc2VFZmZvcnQiLCJ0MTMiLCJTeW1ib2wiLCJmb3IiLCJjb250ZXh0IiwidDE0IiwiaGFuZGxlU2VsZWN0IiwidmFsdWVfMCIsImVmZm9ydExldmVsIiwicGVyc2lzdGFibGUiLCJwcmV2XzAiLCJzZWxlY3RlZE1vZGVsIiwic2VsZWN0ZWRFZmZvcnQiLCJ0MTUiLCJ0MTYiLCJ0MTciLCJ0MTgiLCJ0MTkiLCJ0MjAiLCJfdGVtcDQiLCJ0MjEiLCJ0MjIiLCJ0MjMiLCJ0MjQiLCJ0MjUiLCJ0MjYiLCJ0MjciLCJwZW5kaW5nIiwia2V5TmFtZSIsInQyOCIsImNvbnRlbnQiLCJ0MjkiLCJvcHRfMCIsInNfMCIsInMiLCJmYXN0TW9kZSIsIkVmZm9ydExldmVsSW5kaWNhdG9yIiwiY3VycmVudCIsImluY2x1ZGVNYXgiLCJsZXZlbHMiLCJpZHgiLCJpbmRleE9mIiwiY3VycmVudEluZGV4IiwicmVzb2x2ZWQiLCJkZWZhdWx0VmFsdWUiXSwic291cmNlcyI6WyJNb2RlbFBpY2tlci50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGNhcGl0YWxpemUgZnJvbSAnbG9kYXNoLWVzL2NhcGl0YWxpemUuanMnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHVzZUNhbGxiYWNrLCB1c2VNZW1vLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzIH0gZnJvbSAnc3JjL2hvb2tzL3VzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncy5qcydcbmltcG9ydCB7XG4gIHR5cGUgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgbG9nRXZlbnQsXG59IGZyb20gJ3NyYy9zZXJ2aWNlcy9hbmFseXRpY3MvaW5kZXguanMnXG5pbXBvcnQge1xuICBGQVNUX01PREVfTU9ERUxfRElTUExBWSxcbiAgaXNGYXN0TW9kZUF2YWlsYWJsZSxcbiAgaXNGYXN0TW9kZUNvb2xkb3duLFxuICBpc0Zhc3RNb2RlRW5hYmxlZCxcbn0gZnJvbSAnc3JjL3V0aWxzL2Zhc3RNb2RlLmpzJ1xuaW1wb3J0IHsgQm94LCBUZXh0IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlS2V5YmluZGluZ3MgfSBmcm9tICcuLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHsgdXNlQXBwU3RhdGUsIHVzZVNldEFwcFN0YXRlIH0gZnJvbSAnLi4vc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQge1xuICBjb252ZXJ0RWZmb3J0VmFsdWVUb0xldmVsLFxuICB0eXBlIEVmZm9ydExldmVsLFxuICBnZXREZWZhdWx0RWZmb3J0Rm9yTW9kZWwsXG4gIG1vZGVsU3VwcG9ydHNFZmZvcnQsXG4gIG1vZGVsU3VwcG9ydHNNYXhFZmZvcnQsXG4gIHJlc29sdmVQaWNrZXJFZmZvcnRQZXJzaXN0ZW5jZSxcbiAgdG9QZXJzaXN0YWJsZUVmZm9ydCxcbn0gZnJvbSAnLi4vdXRpbHMvZWZmb3J0LmpzJ1xuaW1wb3J0IHtcbiAgZ2V0RGVmYXVsdE1haW5Mb29wTW9kZWwsXG4gIHR5cGUgTW9kZWxTZXR0aW5nLFxuICBtb2RlbERpc3BsYXlTdHJpbmcsXG4gIHBhcnNlVXNlclNwZWNpZmllZE1vZGVsLFxufSBmcm9tICcuLi91dGlscy9tb2RlbC9tb2RlbC5qcydcbmltcG9ydCB7IGdldE1vZGVsT3B0aW9ucyB9IGZyb20gJy4uL3V0aWxzL21vZGVsL21vZGVsT3B0aW9ucy5qcydcbmltcG9ydCB7XG4gIGdldFNldHRpbmdzRm9yU291cmNlLFxuICB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSxcbn0gZnJvbSAnLi4vdXRpbHMvc2V0dGluZ3Mvc2V0dGluZ3MuanMnXG5pbXBvcnQgeyBDb25maWd1cmFibGVTaG9ydGN1dEhpbnQgfSBmcm9tICcuL0NvbmZpZ3VyYWJsZVNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IFNlbGVjdCB9IGZyb20gJy4vQ3VzdG9tU2VsZWN0L2luZGV4LmpzJ1xuaW1wb3J0IHsgQnlsaW5lIH0gZnJvbSAnLi9kZXNpZ24tc3lzdGVtL0J5bGluZS5qcydcbmltcG9ydCB7IEtleWJvYXJkU2hvcnRjdXRIaW50IH0gZnJvbSAnLi9kZXNpZ24tc3lzdGVtL0tleWJvYXJkU2hvcnRjdXRIaW50LmpzJ1xuaW1wb3J0IHsgUGFuZSB9IGZyb20gJy4vZGVzaWduLXN5c3RlbS9QYW5lLmpzJ1xuaW1wb3J0IHsgZWZmb3J0TGV2ZWxUb1N5bWJvbCB9IGZyb20gJy4vRWZmb3J0SW5kaWNhdG9yLmpzJ1xuXG5leHBvcnQgdHlwZSBQcm9wcyA9IHtcbiAgaW5pdGlhbDogc3RyaW5nIHwgbnVsbFxuICBzZXNzaW9uTW9kZWw/OiBNb2RlbFNldHRpbmdcbiAgb25TZWxlY3Q6IChtb2RlbDogc3RyaW5nIHwgbnVsbCwgZWZmb3J0OiBFZmZvcnRMZXZlbCB8IHVuZGVmaW5lZCkgPT4gdm9pZFxuICBvbkNhbmNlbD86ICgpID0+IHZvaWRcbiAgaXNTdGFuZGFsb25lQ29tbWFuZD86IGJvb2xlYW5cbiAgc2hvd0Zhc3RNb2RlTm90aWNlPzogYm9vbGVhblxuICAvKiogT3ZlcnJpZGVzIHRoZSBkaW0gaGVhZGVyIGxpbmUgYmVsb3cgXCJTZWxlY3QgbW9kZWxcIi4gKi9cbiAgaGVhZGVyVGV4dD86IHN0cmluZ1xuICAvKipcbiAgICogV2hlbiB0cnVlLCBza2lwIHdyaXRpbmcgZWZmb3J0TGV2ZWwgdG8gdXNlclNldHRpbmdzIG9uIHNlbGVjdGlvbi5cbiAgICogVXNlZCBieSB0aGUgYXNzaXN0YW50IGluc3RhbGxlciB3aXphcmQgd2hlcmUgdGhlIG1vZGVsIGNob2ljZSBpc1xuICAgKiBwcm9qZWN0LXNjb3BlZCAod3JpdHRlbiB0byB0aGUgYXNzaXN0YW50J3MgLmNsYXVkZS9zZXR0aW5ncy5qc29uIHZpYVxuICAgKiBpbnN0YWxsLnRzKSBhbmQgc2hvdWxkIG5vdCBsZWFrIHRvIHRoZSB1c2VyJ3MgZ2xvYmFsIH4vLmNsYXVkZS9zZXR0aW5ncy5cbiAgICovXG4gIHNraXBTZXR0aW5nc1dyaXRlPzogYm9vbGVhblxufVxuXG5jb25zdCBOT19QUkVGRVJFTkNFID0gJ19fTk9fUFJFRkVSRU5DRV9fJ1xuXG5leHBvcnQgZnVuY3Rpb24gTW9kZWxQaWNrZXIoe1xuICBpbml0aWFsLFxuICBzZXNzaW9uTW9kZWwsXG4gIG9uU2VsZWN0LFxuICBvbkNhbmNlbCxcbiAgaXNTdGFuZGFsb25lQ29tbWFuZCxcbiAgc2hvd0Zhc3RNb2RlTm90aWNlLFxuICBoZWFkZXJUZXh0LFxuICBza2lwU2V0dGluZ3NXcml0ZSxcbn06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3Qgc2V0QXBwU3RhdGUgPSB1c2VTZXRBcHBTdGF0ZSgpXG4gIGNvbnN0IGV4aXRTdGF0ZSA9IHVzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncygpXG4gIGNvbnN0IG1heFZpc2libGUgPSAxMFxuXG4gIGNvbnN0IGluaXRpYWxWYWx1ZSA9IGluaXRpYWwgPT09IG51bGwgPyBOT19QUkVGRVJFTkNFIDogaW5pdGlhbFxuICBjb25zdCBbZm9jdXNlZFZhbHVlLCBzZXRGb2N1c2VkVmFsdWVdID0gdXNlU3RhdGU8c3RyaW5nIHwgdW5kZWZpbmVkPihcbiAgICBpbml0aWFsVmFsdWUsXG4gIClcblxuICBjb25zdCBpc0Zhc3RNb2RlID0gdXNlQXBwU3RhdGUocyA9PlxuICAgIGlzRmFzdE1vZGVFbmFibGVkKCkgPyBzLmZhc3RNb2RlIDogZmFsc2UsXG4gIClcblxuICBjb25zdCBbaGFzVG9nZ2xlZEVmZm9ydCwgc2V0SGFzVG9nZ2xlZEVmZm9ydF0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgZWZmb3J0VmFsdWUgPSB1c2VBcHBTdGF0ZShzID0+IHMuZWZmb3J0VmFsdWUpXG4gIGNvbnN0IFtlZmZvcnQsIHNldEVmZm9ydF0gPSB1c2VTdGF0ZTxFZmZvcnRMZXZlbCB8IHVuZGVmaW5lZD4oXG4gICAgZWZmb3J0VmFsdWUgIT09IHVuZGVmaW5lZFxuICAgICAgPyBjb252ZXJ0RWZmb3J0VmFsdWVUb0xldmVsKGVmZm9ydFZhbHVlKVxuICAgICAgOiB1bmRlZmluZWQsXG4gIClcblxuICAvLyBNZW1vaXplIGFsbCBkZXJpdmVkIHZhbHVlcyB0byBwcmV2ZW50IHJlLXJlbmRlcnNcbiAgY29uc3QgbW9kZWxPcHRpb25zID0gdXNlTWVtbyhcbiAgICAoKSA9PiBnZXRNb2RlbE9wdGlvbnMoaXNGYXN0TW9kZSA/PyBmYWxzZSksXG4gICAgW2lzRmFzdE1vZGVdLFxuICApXG5cbiAgLy8gRW5zdXJlIHRoZSBpbml0aWFsIHZhbHVlIGlzIGluIHRoZSBvcHRpb25zIGxpc3RcbiAgLy8gVGhpcyBoYW5kbGVzIGVkZ2UgY2FzZXMgd2hlcmUgdGhlIHVzZXIncyBjdXJyZW50IG1vZGVsIChlLmcuLCAnaGFpa3UnIGZvciAzUCB1c2VycylcbiAgLy8gaXMgbm90IGluIHRoZSBiYXNlIG9wdGlvbnMgYnV0IHNob3VsZCBzdGlsbCBiZSBzZWxlY3RhYmxlIGFuZCBzaG93biBhcyBzZWxlY3RlZFxuICBjb25zdCBvcHRpb25zV2l0aEluaXRpYWwgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBpZiAoaW5pdGlhbCAhPT0gbnVsbCAmJiAhbW9kZWxPcHRpb25zLnNvbWUob3B0ID0+IG9wdC52YWx1ZSA9PT0gaW5pdGlhbCkpIHtcbiAgICAgIHJldHVybiBbXG4gICAgICAgIC4uLm1vZGVsT3B0aW9ucyxcbiAgICAgICAge1xuICAgICAgICAgIHZhbHVlOiBpbml0aWFsLFxuICAgICAgICAgIGxhYmVsOiBtb2RlbERpc3BsYXlTdHJpbmcoaW5pdGlhbCksXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdDdXJyZW50IG1vZGVsJyxcbiAgICAgICAgfSxcbiAgICAgIF1cbiAgICB9XG4gICAgcmV0dXJuIG1vZGVsT3B0aW9uc1xuICB9LCBbbW9kZWxPcHRpb25zLCBpbml0aWFsXSlcblxuICBjb25zdCBzZWxlY3RPcHRpb25zID0gdXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgb3B0aW9uc1dpdGhJbml0aWFsLm1hcChvcHQgPT4gKHtcbiAgICAgICAgLi4ub3B0LFxuICAgICAgICB2YWx1ZTogb3B0LnZhbHVlID09PSBudWxsID8gTk9fUFJFRkVSRU5DRSA6IG9wdC52YWx1ZSxcbiAgICAgIH0pKSxcbiAgICBbb3B0aW9uc1dpdGhJbml0aWFsXSxcbiAgKVxuICBjb25zdCBpbml0aWFsRm9jdXNWYWx1ZSA9IHVzZU1lbW8oXG4gICAgKCkgPT5cbiAgICAgIHNlbGVjdE9wdGlvbnMuc29tZShfID0+IF8udmFsdWUgPT09IGluaXRpYWxWYWx1ZSlcbiAgICAgICAgPyBpbml0aWFsVmFsdWVcbiAgICAgICAgOiAoc2VsZWN0T3B0aW9uc1swXT8udmFsdWUgPz8gdW5kZWZpbmVkKSxcbiAgICBbc2VsZWN0T3B0aW9ucywgaW5pdGlhbFZhbHVlXSxcbiAgKVxuICBjb25zdCB2aXNpYmxlQ291bnQgPSBNYXRoLm1pbihtYXhWaXNpYmxlLCBzZWxlY3RPcHRpb25zLmxlbmd0aClcbiAgY29uc3QgaGlkZGVuQ291bnQgPSBNYXRoLm1heCgwLCBzZWxlY3RPcHRpb25zLmxlbmd0aCAtIHZpc2libGVDb3VudClcblxuICBjb25zdCBmb2N1c2VkTW9kZWxOYW1lID0gc2VsZWN0T3B0aW9ucy5maW5kKFxuICAgIG9wdCA9PiBvcHQudmFsdWUgPT09IGZvY3VzZWRWYWx1ZSxcbiAgKT8ubGFiZWxcbiAgY29uc3QgZm9jdXNlZE1vZGVsID0gcmVzb2x2ZU9wdGlvbk1vZGVsKGZvY3VzZWRWYWx1ZSlcbiAgY29uc3QgZm9jdXNlZFN1cHBvcnRzRWZmb3J0ID0gZm9jdXNlZE1vZGVsXG4gICAgPyBtb2RlbFN1cHBvcnRzRWZmb3J0KGZvY3VzZWRNb2RlbClcbiAgICA6IGZhbHNlXG4gIGNvbnN0IGZvY3VzZWRTdXBwb3J0c01heCA9IGZvY3VzZWRNb2RlbFxuICAgID8gbW9kZWxTdXBwb3J0c01heEVmZm9ydChmb2N1c2VkTW9kZWwpXG4gICAgOiBmYWxzZVxuICBjb25zdCBmb2N1c2VkRGVmYXVsdEVmZm9ydCA9IGdldERlZmF1bHRFZmZvcnRMZXZlbEZvck9wdGlvbihmb2N1c2VkVmFsdWUpXG4gIC8vIENsYW1wIGRpc3BsYXkgd2hlbiAnbWF4JyBpcyBzZWxlY3RlZCBidXQgdGhlIGZvY3VzZWQgbW9kZWwgZG9lc24ndCBzdXBwb3J0IGl0LlxuICAvLyByZXNvbHZlQXBwbGllZEVmZm9ydCgpIGRvZXMgdGhlIHNhbWUgZG93bmdyYWRlIGF0IEFQSS1zZW5kIHRpbWUuXG4gIGNvbnN0IGRpc3BsYXlFZmZvcnQgPVxuICAgIGVmZm9ydCA9PT0gJ21heCcgJiYgIWZvY3VzZWRTdXBwb3J0c01heCA/ICdoaWdoJyA6IGVmZm9ydFxuXG4gIGNvbnN0IGhhbmRsZUZvY3VzID0gdXNlQ2FsbGJhY2soXG4gICAgKHZhbHVlOiBzdHJpbmcpID0+IHtcbiAgICAgIHNldEZvY3VzZWRWYWx1ZSh2YWx1ZSlcbiAgICAgIGlmICghaGFzVG9nZ2xlZEVmZm9ydCAmJiBlZmZvcnRWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNldEVmZm9ydChnZXREZWZhdWx0RWZmb3J0TGV2ZWxGb3JPcHRpb24odmFsdWUpKVxuICAgICAgfVxuICAgIH0sXG4gICAgW2hhc1RvZ2dsZWRFZmZvcnQsIGVmZm9ydFZhbHVlXSxcbiAgKVxuXG4gIC8vIEVmZm9ydCBsZXZlbCBjeWNsaW5nIGtleWJpbmRpbmdzXG4gIGNvbnN0IGhhbmRsZUN5Y2xlRWZmb3J0ID0gdXNlQ2FsbGJhY2soXG4gICAgKGRpcmVjdGlvbjogJ2xlZnQnIHwgJ3JpZ2h0JykgPT4ge1xuICAgICAgaWYgKCFmb2N1c2VkU3VwcG9ydHNFZmZvcnQpIHJldHVyblxuICAgICAgc2V0RWZmb3J0KHByZXYgPT5cbiAgICAgICAgY3ljbGVFZmZvcnRMZXZlbChcbiAgICAgICAgICBwcmV2ID8/IGZvY3VzZWREZWZhdWx0RWZmb3J0LFxuICAgICAgICAgIGRpcmVjdGlvbixcbiAgICAgICAgICBmb2N1c2VkU3VwcG9ydHNNYXgsXG4gICAgICAgICksXG4gICAgICApXG4gICAgICBzZXRIYXNUb2dnbGVkRWZmb3J0KHRydWUpXG4gICAgfSxcbiAgICBbZm9jdXNlZFN1cHBvcnRzRWZmb3J0LCBmb2N1c2VkU3VwcG9ydHNNYXgsIGZvY3VzZWREZWZhdWx0RWZmb3J0XSxcbiAgKVxuXG4gIHVzZUtleWJpbmRpbmdzKFxuICAgIHtcbiAgICAgICdtb2RlbFBpY2tlcjpkZWNyZWFzZUVmZm9ydCc6ICgpID0+IGhhbmRsZUN5Y2xlRWZmb3J0KCdsZWZ0JyksXG4gICAgICAnbW9kZWxQaWNrZXI6aW5jcmVhc2VFZmZvcnQnOiAoKSA9PiBoYW5kbGVDeWNsZUVmZm9ydCgncmlnaHQnKSxcbiAgICB9LFxuICAgIHsgY29udGV4dDogJ01vZGVsUGlja2VyJyB9LFxuICApXG5cbiAgZnVuY3Rpb24gaGFuZGxlU2VsZWN0KHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBsb2dFdmVudCgndGVuZ3VfbW9kZWxfY29tbWFuZF9tZW51X2VmZm9ydCcsIHtcbiAgICAgIGVmZm9ydDpcbiAgICAgICAgZWZmb3J0IGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgfSlcbiAgICBpZiAoIXNraXBTZXR0aW5nc1dyaXRlKSB7XG4gICAgICAvLyBQcmlvciBjb21lcyBmcm9tIHVzZXJTZXR0aW5ncyBvbiBkaXNrIOKAlCBOT1QgbWVyZ2VkIHNldHRpbmdzICh3aGljaFxuICAgICAgLy8gaW5jbHVkZXMgcHJvamVjdC9wb2xpY3kgbGF5ZXJzIHRoYXQgbXVzdCBub3QgbGVhayBpbnRvIHRoZSB1c2VyJ3NcbiAgICAgIC8vIGdsb2JhbCB+Ly5jbGF1ZGUvc2V0dGluZ3MuanNvbiksIGFuZCBOT1QgQXBwU3RhdGUuZWZmb3J0VmFsdWUgKHdoaWNoXG4gICAgICAvLyBpbmNsdWRlcyBzZXNzaW9uLWVwaGVtZXJhbCBzb3VyY2VzIGxpa2UgLS1lZmZvcnQgQ0xJIGZsYWcpLlxuICAgICAgLy8gU2VlIHJlc29sdmVQaWNrZXJFZmZvcnRQZXJzaXN0ZW5jZSBKU0RvYy5cbiAgICAgIGNvbnN0IGVmZm9ydExldmVsID0gcmVzb2x2ZVBpY2tlckVmZm9ydFBlcnNpc3RlbmNlKFxuICAgICAgICBlZmZvcnQsXG4gICAgICAgIGdldERlZmF1bHRFZmZvcnRMZXZlbEZvck9wdGlvbih2YWx1ZSksXG4gICAgICAgIGdldFNldHRpbmdzRm9yU291cmNlKCd1c2VyU2V0dGluZ3MnKT8uZWZmb3J0TGV2ZWwsXG4gICAgICAgIGhhc1RvZ2dsZWRFZmZvcnQsXG4gICAgICApXG4gICAgICBjb25zdCBwZXJzaXN0YWJsZSA9IHRvUGVyc2lzdGFibGVFZmZvcnQoZWZmb3J0TGV2ZWwpXG4gICAgICBpZiAocGVyc2lzdGFibGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSgndXNlclNldHRpbmdzJywgeyBlZmZvcnRMZXZlbDogcGVyc2lzdGFibGUgfSlcbiAgICAgIH1cbiAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHsgLi4ucHJldiwgZWZmb3J0VmFsdWU6IGVmZm9ydExldmVsIH0pKVxuICAgIH1cblxuICAgIGNvbnN0IHNlbGVjdGVkTW9kZWwgPSByZXNvbHZlT3B0aW9uTW9kZWwodmFsdWUpXG4gICAgY29uc3Qgc2VsZWN0ZWRFZmZvcnQgPVxuICAgICAgaGFzVG9nZ2xlZEVmZm9ydCAmJiBzZWxlY3RlZE1vZGVsICYmIG1vZGVsU3VwcG9ydHNFZmZvcnQoc2VsZWN0ZWRNb2RlbClcbiAgICAgICAgPyBlZmZvcnRcbiAgICAgICAgOiB1bmRlZmluZWRcbiAgICBpZiAodmFsdWUgPT09IE5PX1BSRUZFUkVOQ0UpIHtcbiAgICAgIG9uU2VsZWN0KG51bGwsIHNlbGVjdGVkRWZmb3J0KVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIG9uU2VsZWN0KHZhbHVlLCBzZWxlY3RlZEVmZm9ydClcbiAgfVxuXG4gIGNvbnN0IGNvbnRlbnQgPSAoXG4gICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cInJlbWVtYmVyXCIgYm9sZD5cbiAgICAgICAgICAgIFNlbGVjdCBtb2RlbFxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIHtoZWFkZXJUZXh0ID8/XG4gICAgICAgICAgICAgICdTd2l0Y2ggYmV0d2VlbiBDbGF1ZGUgbW9kZWxzLiBBcHBsaWVzIHRvIHRoaXMgc2Vzc2lvbiBhbmQgZnV0dXJlIENsYXVkZSBDb2RlIHNlc3Npb25zLiBGb3Igb3RoZXIvcHJldmlvdXMgbW9kZWwgbmFtZXMsIHNwZWNpZnkgd2l0aCAtLW1vZGVsLid9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIHtzZXNzaW9uTW9kZWwgJiYgKFxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIEN1cnJlbnRseSB1c2luZyB7bW9kZWxEaXNwbGF5U3RyaW5nKHNlc3Npb25Nb2RlbCl9IGZvciB0aGlzXG4gICAgICAgICAgICAgIHNlc3Npb24gKHNldCBieSBwbGFuIG1vZGUpLiBTZWxlY3RpbmcgYSBtb2RlbCB3aWxsIHVuZG8gdGhpcy5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cblxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgPFNlbGVjdFxuICAgICAgICAgICAgICBkZWZhdWx0VmFsdWU9e2luaXRpYWxWYWx1ZX1cbiAgICAgICAgICAgICAgZGVmYXVsdEZvY3VzVmFsdWU9e2luaXRpYWxGb2N1c1ZhbHVlfVxuICAgICAgICAgICAgICBvcHRpb25zPXtzZWxlY3RPcHRpb25zfVxuICAgICAgICAgICAgICBvbkNoYW5nZT17aGFuZGxlU2VsZWN0fVxuICAgICAgICAgICAgICBvbkZvY3VzPXtoYW5kbGVGb2N1c31cbiAgICAgICAgICAgICAgb25DYW5jZWw9e29uQ2FuY2VsID8/ICgoKSA9PiB7fSl9XG4gICAgICAgICAgICAgIHZpc2libGVPcHRpb25Db3VudD17dmlzaWJsZUNvdW50fVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgICB7aGlkZGVuQ291bnQgPiAwICYmIChcbiAgICAgICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezN9PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5hbmQge2hpZGRlbkNvdW50fSBtb3Jl4oCmPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICB7Zm9jdXNlZFN1cHBvcnRzRWZmb3J0ID8gKFxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIDxFZmZvcnRMZXZlbEluZGljYXRvciBlZmZvcnQ9e2Rpc3BsYXlFZmZvcnR9IC8+eycgJ31cbiAgICAgICAgICAgICAge2NhcGl0YWxpemUoZGlzcGxheUVmZm9ydCl9IGVmZm9ydFxuICAgICAgICAgICAgICB7ZGlzcGxheUVmZm9ydCA9PT0gZm9jdXNlZERlZmF1bHRFZmZvcnQgPyBgIChkZWZhdWx0KWAgOiBgYH17JyAnfVxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1YnRsZVwiPuKGkCDihpIgdG8gYWRqdXN0PC9UZXh0PlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1YnRsZVwiPlxuICAgICAgICAgICAgICA8RWZmb3J0TGV2ZWxJbmRpY2F0b3IgZWZmb3J0PXt1bmRlZmluZWR9IC8+IEVmZm9ydCBub3Qgc3VwcG9ydGVkXG4gICAgICAgICAgICAgIHtmb2N1c2VkTW9kZWxOYW1lID8gYCBmb3IgJHtmb2N1c2VkTW9kZWxOYW1lfWAgOiAnJ31cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cblxuICAgICAgICB7aXNGYXN0TW9kZUVuYWJsZWQoKSA/IChcbiAgICAgICAgICBzaG93RmFzdE1vZGVOb3RpY2UgPyAoXG4gICAgICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgIEZhc3QgbW9kZSBpcyA8VGV4dCBib2xkPk9OPC9UZXh0PiBhbmQgYXZhaWxhYmxlIHdpdGh7JyAnfVxuICAgICAgICAgICAgICAgIHtGQVNUX01PREVfTU9ERUxfRElTUExBWX0gb25seSAoL2Zhc3QpLiBTd2l0Y2hpbmcgdG8gb3RoZXJcbiAgICAgICAgICAgICAgICBtb2RlbHMgdHVybiBvZmYgZmFzdCBtb2RlLlxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApIDogaXNGYXN0TW9kZUF2YWlsYWJsZSgpICYmICFpc0Zhc3RNb2RlQ29vbGRvd24oKSA/IChcbiAgICAgICAgICAgIDxCb3ggbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgVXNlIDxUZXh0IGJvbGQ+L2Zhc3Q8L1RleHQ+IHRvIHR1cm4gb24gRmFzdCBtb2RlIChcbiAgICAgICAgICAgICAgICB7RkFTVF9NT0RFX01PREVMX0RJU1BMQVl9IG9ubHkpLlxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApIDogbnVsbFxuICAgICAgICApIDogbnVsbH1cbiAgICAgIDwvQm94PlxuXG4gICAgICB7aXNTdGFuZGFsb25lQ29tbWFuZCAmJiAoXG4gICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICB7ZXhpdFN0YXRlLnBlbmRpbmcgPyAoXG4gICAgICAgICAgICA8PlByZXNzIHtleGl0U3RhdGUua2V5TmFtZX0gYWdhaW4gdG8gZXhpdDwvPlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cImNvbmZpcm1cIiAvPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwic2VsZWN0OmNhbmNlbFwiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIlNlbGVjdFwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiZXhpdFwiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgICApfVxuICAgICAgICA8L1RleHQ+XG4gICAgICApfVxuICAgIDwvQm94PlxuICApXG5cbiAgaWYgKCFpc1N0YW5kYWxvbmVDb21tYW5kKSB7XG4gICAgcmV0dXJuIGNvbnRlbnRcbiAgfVxuXG4gIHJldHVybiA8UGFuZSBjb2xvcj1cInBlcm1pc3Npb25cIj57Y29udGVudH08L1BhbmU+XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPcHRpb25Nb2RlbCh2YWx1ZT86IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmICghdmFsdWUpIHJldHVybiB1bmRlZmluZWRcbiAgcmV0dXJuIHZhbHVlID09PSBOT19QUkVGRVJFTkNFXG4gICAgPyBnZXREZWZhdWx0TWFpbkxvb3BNb2RlbCgpXG4gICAgOiBwYXJzZVVzZXJTcGVjaWZpZWRNb2RlbCh2YWx1ZSlcbn1cblxuZnVuY3Rpb24gRWZmb3J0TGV2ZWxJbmRpY2F0b3Ioe1xuICBlZmZvcnQsXG59OiB7XG4gIGVmZm9ydD86IEVmZm9ydExldmVsXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgcmV0dXJuIChcbiAgICA8VGV4dCBjb2xvcj17ZWZmb3J0ID8gJ2NsYXVkZScgOiAnc3VidGxlJ30+XG4gICAgICB7ZWZmb3J0TGV2ZWxUb1N5bWJvbChlZmZvcnQgPz8gJ2xvdycpfVxuICAgIDwvVGV4dD5cbiAgKVxufVxuXG5mdW5jdGlvbiBjeWNsZUVmZm9ydExldmVsKFxuICBjdXJyZW50OiBFZmZvcnRMZXZlbCxcbiAgZGlyZWN0aW9uOiAnbGVmdCcgfCAncmlnaHQnLFxuICBpbmNsdWRlTWF4OiBib29sZWFuLFxuKTogRWZmb3J0TGV2ZWwge1xuICBjb25zdCBsZXZlbHM6IEVmZm9ydExldmVsW10gPSBpbmNsdWRlTWF4XG4gICAgPyBbJ2xvdycsICdtZWRpdW0nLCAnaGlnaCcsICdtYXgnXVxuICAgIDogWydsb3cnLCAnbWVkaXVtJywgJ2hpZ2gnXVxuICAvLyBJZiB0aGUgY3VycmVudCBsZXZlbCBpc24ndCBpbiB0aGUgY3ljbGUgKGUuZy4gJ21heCcgYWZ0ZXIgc3dpdGNoaW5nIHRvIGFcbiAgLy8gbm9uLU9wdXMgbW9kZWwpLCBjbGFtcCB0byAnaGlnaCcuXG4gIGNvbnN0IGlkeCA9IGxldmVscy5pbmRleE9mKGN1cnJlbnQpXG4gIGNvbnN0IGN1cnJlbnRJbmRleCA9IGlkeCAhPT0gLTEgPyBpZHggOiBsZXZlbHMuaW5kZXhPZignaGlnaCcpXG4gIGlmIChkaXJlY3Rpb24gPT09ICdyaWdodCcpIHtcbiAgICByZXR1cm4gbGV2ZWxzWyhjdXJyZW50SW5kZXggKyAxKSAlIGxldmVscy5sZW5ndGhdIVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBsZXZlbHNbKGN1cnJlbnRJbmRleCAtIDEgKyBsZXZlbHMubGVuZ3RoKSAlIGxldmVscy5sZW5ndGhdIVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRFZmZvcnRMZXZlbEZvck9wdGlvbih2YWx1ZT86IHN0cmluZyk6IEVmZm9ydExldmVsIHtcbiAgY29uc3QgcmVzb2x2ZWQgPSByZXNvbHZlT3B0aW9uTW9kZWwodmFsdWUpID8/IGdldERlZmF1bHRNYWluTG9vcE1vZGVsKClcbiAgY29uc3QgZGVmYXVsdFZhbHVlID0gZ2V0RGVmYXVsdEVmZm9ydEZvck1vZGVsKHJlc29sdmVkKVxuICByZXR1cm4gZGVmYXVsdFZhbHVlICE9PSB1bmRlZmluZWRcbiAgICA/IGNvbnZlcnRFZmZvcnRWYWx1ZVRvTGV2ZWwoZGVmYXVsdFZhbHVlKVxuICAgIDogJ2hpZ2gnXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPQSxVQUFVLE1BQU0seUJBQXlCO0FBQ2hELE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsV0FBVyxFQUFFQyxPQUFPLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ3RELFNBQVNDLDhCQUE4QixRQUFRLDZDQUE2QztBQUM1RixTQUNFLEtBQUtDLDBEQUEwRCxFQUMvREMsUUFBUSxRQUNILGlDQUFpQztBQUN4QyxTQUNFQyx1QkFBdUIsRUFDdkJDLG1CQUFtQixFQUNuQkMsa0JBQWtCLEVBQ2xCQyxpQkFBaUIsUUFDWix1QkFBdUI7QUFDOUIsU0FBU0MsR0FBRyxFQUFFQyxJQUFJLFFBQVEsV0FBVztBQUNyQyxTQUFTQyxjQUFjLFFBQVEsaUNBQWlDO0FBQ2hFLFNBQVNDLFdBQVcsRUFBRUMsY0FBYyxRQUFRLHNCQUFzQjtBQUNsRSxTQUNFQyx5QkFBeUIsRUFDekIsS0FBS0MsV0FBVyxFQUNoQkMsd0JBQXdCLEVBQ3hCQyxtQkFBbUIsRUFDbkJDLHNCQUFzQixFQUN0QkMsOEJBQThCLEVBQzlCQyxtQkFBbUIsUUFDZCxvQkFBb0I7QUFDM0IsU0FDRUMsdUJBQXVCLEVBQ3ZCLEtBQUtDLFlBQVksRUFDakJDLGtCQUFrQixFQUNsQkMsdUJBQXVCLFFBQ2xCLHlCQUF5QjtBQUNoQyxTQUFTQyxlQUFlLFFBQVEsZ0NBQWdDO0FBQ2hFLFNBQ0VDLG9CQUFvQixFQUNwQkMsdUJBQXVCLFFBQ2xCLCtCQUErQjtBQUN0QyxTQUFTQyx3QkFBd0IsUUFBUSwrQkFBK0I7QUFDeEUsU0FBU0MsTUFBTSxRQUFRLHlCQUF5QjtBQUNoRCxTQUFTQyxNQUFNLFFBQVEs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