import { c as _c } from "react/compiler-runtime";
import React, { useEffect, useState } from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { Box, Link, Text, useInput } from '../../ink.js';
import { type AccountSettings, calculateShouldShowGrove, type GroveConfig, getGroveNoticeConfig, getGroveSettings, markGroveNoticeViewed, updateGroveSettings } from '../../services/api/grove.js';
import { Select } from '../CustomSelect/index.js';
import { Byline } from '../design-system/Byline.js';
import { Dialog } from '../design-system/Dialog.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
export type GroveDecision = 'accept_opt_in' | 'accept_opt_out' | 'defer' | 'escape' | 'skip_rendering';
type Props = {
  showIfAlreadyViewed: boolean;
  location: 'settings' | 'policy_update_modal' | 'onboarding';
  onDone(decision: GroveDecision): void;
};
const NEW_TERMS_ASCII = ` _____________
 |          \\  \\
 | NEW TERMS \\__\\
 |              |
 |  ----------  |
 |  ----------  |
 |  ----------  |
 |  ----------  |
 |  ----------  |
 |              |
 |______________|`;
function GracePeriodContentBody() {
  const $ = _c(9);
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = <Text>An update to our Consumer Terms and Privacy Policy will take effect on{" "}<Text bold={true}>October 8, 2025</Text>. You can accept the updated terms today.</Text>;
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  let t1;
  if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = <Text>What's changing?</Text>;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  let t2;
  let t3;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Text>· </Text>;
    t3 = <Text bold={true}>You can help improve Claude </Text>;
    $[2] = t2;
    $[3] = t3;
  } else {
    t2 = $[2];
    t3 = $[3];
  }
  let t4;
  if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
    t4 = <Box paddingLeft={1}><Text>{t2}{t3}<Text>— Allow the use of your chats and coding sessions to train and improve Anthropic AI models. Change anytime in your Privacy Settings (<Link url="https://claude.ai/settings/data-privacy-controls" />).</Text></Text></Box>;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  let t5;
  if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
    t5 = <Box flexDirection="column">{t1}{t4}<Box paddingLeft={1}><Text><Text>· </Text><Text bold={true}>Updates to data retention </Text><Text>— To help us improve our AI models and safety protections, we're extending data retention to 5 years.</Text></Text></Box></Box>;
    $[5] = t5;
  } else {
    t5 = $[5];
  }
  let t6;
  if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
    t6 = <Link url="https://www.anthropic.com/news/updates-to-our-consumer-terms" />;
    $[6] = t6;
  } else {
    t6 = $[6];
  }
  let t7;
  if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
    t7 = <Link url="https://anthropic.com/legal/terms" />;
    $[7] = t7;
  } else {
    t7 = $[7];
  }
  let t8;
  if ($[8] === Symbol.for("react.memo_cache_sentinel")) {
    t8 = <>{t0}{t5}<Text>Learn more ({t6}) or read the updated Consumer Terms ({t7}) and Privacy Policy (<Link url="https://anthropic.com/legal/privacy" />)</Text></>;
    $[8] = t8;
  } else {
    t8 = $[8];
  }
  return t8;
}
function PostGracePeriodContentBody() {
  const $ = _c(7);
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = <Text>We've updated our Consumer Terms and Privacy Policy.</Text>;
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  let t1;
  if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = <Text>What's changing?</Text>;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  let t2;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Box flexDirection="column"><Text bold={true}>Help improve Claude</Text><Text>Allow the use of your chats and coding sessions to train and improve Anthropic AI models. You can change this anytime in Privacy Settings</Text><Link url="https://claude.ai/settings/data-privacy-controls" /></Box>;
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  let t3;
  if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = <Box flexDirection="column" gap={1}>{t1}{t2}<Box flexDirection="column"><Text bold={true}>How this affects data retention</Text><Text>Turning ON the improve Claude setting extends data retention from 30 days to 5 years. Turning it OFF keeps the default 30-day data retention. Delete data anytime.</Text></Box></Box>;
    $[3] = t3;
  } else {
    t3 = $[3];
  }
  let t4;
  if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
    t4 = <Link url="https://www.anthropic.com/news/updates-to-our-consumer-terms" />;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  let t5;
  if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
    t5 = <Link url="https://anthropic.com/legal/terms" />;
    $[5] = t5;
  } else {
    t5 = $[5];
  }
  let t6;
  if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
    t6 = <>{t0}{t3}<Text>Learn more ({t4}) or read the updated Consumer Terms ({t5}) and Privacy Policy (<Link url="https://anthropic.com/legal/privacy" />)</Text></>;
    $[6] = t6;
  } else {
    t6 = $[6];
  }
  return t6;
}
export function GroveDialog(t0) {
  const $ = _c(34);
  const {
    showIfAlreadyViewed,
    location,
    onDone
  } = t0;
  const [shouldShowDialog, setShouldShowDialog] = useState(null);
  const [groveConfig, setGroveConfig] = useState(null);
  let t1;
  let t2;
  if ($[0] !== location || $[1] !== onDone || $[2] !== showIfAlreadyViewed) {
    t1 = () => {
      const checkGroveSettings = async function checkGroveSettings() {
        const [settingsResult, configResult] = await Promise.all([getGroveSettings(), getGroveNoticeConfig()]);
        const config = configResult.success ? configResult.data : null;
        setGroveConfig(config);
        const shouldShow = calculateShouldShowGrove(settingsResult, configResult, showIfAlreadyViewed);
        setShouldShowDialog(shouldShow);
        if (!shouldShow) {
          onDone("skip_rendering");
          return;
        }
        markGroveNoticeViewed();
        logEvent("tengu_grove_policy_viewed", {
          location: location as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          dismissable: config?.notice_is_grace_period as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      };
      checkGroveSettings();
    };
    t2 = [showIfAlreadyViewed, location, onDone];
    $[0] = location;
    $[1] = onDone;
    $[2] = showIfAlreadyViewed;
    $[3] = t1;
    $[4] = t2;
  } else {
    t1 = $[3];
    t2 = $[4];
  }
  useEffect(t1, t2);
  if (shouldShowDialog === null) {
    return null;
  }
  if (!shouldShowDialog) {
    return null;
  }
  let t3;
  if ($[5] !== groveConfig?.notice_is_grace_period || $[6] !== onDone) {
    t3 = async function onChange(value) {
      bb21: switch (value) {
        case "accept_opt_in":
          {
            await updateGroveSettings(true);
            logEvent("tengu_grove_policy_submitted", {
              state: true,
              dismissable: groveConfig?.notice_is_grace_period as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
            });
            break bb21;
          }
        case "accept_opt_out":
          {
            await updateGroveSettings(false);
            logEvent("tengu_grove_policy_submitted", {
              state: false,
              dismissable: groveConfig?.notice_is_grace_period as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
            });
            break bb21;
          }
        case "defer":
          {
            logEvent("tengu_grove_policy_dismissed", {
              state: true
            });
            break bb21;
          }
        case "escape":
          {
            logEvent("tengu_grove_policy_escaped", {});
          }
      }
      onDone(value);
    };
    $[5] = groveConfig?.notice_is_grace_period;
    $[6] = onDone;
    $[7] = t3;
  } else {
    t3 = $[7];
  }
  const onChange = t3;
  let t4;
  if ($[8] !== groveConfig?.domain_excluded) {
    t4 = groveConfig?.domain_excluded ? [{
      label: "Accept terms \xB7 Help improve Claude: OFF (for emails with your domain)",
      value: "accept_opt_out"
    }] : [{
      label: "Accept terms \xB7 Help improve Claude: ON",
      value: "accept_opt_in"
    }, {
      label: "Accept terms \xB7 Help improve Claude: OFF",
      value: "accept_opt_out"
    }];
    $[8] = groveConfig?.domain_excluded;
    $[9] = t4;
  } else {
    t4 = $[9];
  }
  const acceptOptions = t4;
  let t5;
  if ($[10] !== groveConfig?.notice_is_grace_period || $[11] !== onChange) {
    t5 = function handleCancel() {
      if (groveConfig?.notice_is_grace_period) {
        onChange("defer");
        return;
      }
      onChange("escape");
    };
    $[10] = groveConfig?.notice_is_grace_period;
    $[11] = onChange;
    $[12] = t5;
  } else {
    t5 = $[12];
  }
  const handleCancel = t5;
  let t6;
  if ($[13] !== groveConfig?.notice_is_grace_period) {
    t6 = <Box flexDirection="column" gap={1} flexGrow={1}>{groveConfig?.notice_is_grace_period ? <GracePeriodContentBody /> : <PostGracePeriodContentBody />}</Box>;
    $[13] = groveConfig?.notice_is_grace_period;
    $[14] = t6;
  } else {
    t6 = $[14];
  }
  let t7;
  if ($[15] === Symbol.for("react.memo_cache_sentinel")) {
    t7 = <Box flexShrink={0}><Text color="professionalBlue">{NEW_TERMS_ASCII}</Text></Box>;
    $[15] = t7;
  } else {
    t7 = $[15];
  }
  let t8;
  if ($[16] !== t6) {
    t8 = <Box flexDirection="row">{t6}{t7}</Box>;
    $[16] = t6;
    $[17] = t8;
  } else {
    t8 = $[17];
  }
  let t9;
  if ($[18] === Symbol.for("react.memo_cache_sentinel")) {
    t9 = <Box flexDirection="column"><Text bold={true}>Please select how you'd like to continue</Text><Text>Your choice takes effect immediately upon confirmation.</Text></Box>;
    $[18] = t9;
  } else {
    t9 = $[18];
  }
  let t10;
  if ($[19] !== groveConfig?.notice_is_grace_period) {
    t10 = groveConfig?.notice_is_grace_period ? [{
      label: "Not now",
      value: "defer"
    }] : [];
    $[19] = groveConfig?.notice_is_grace_period;
    $[20] = t10;
  } else {
    t10 = $[20];
  }
  let t11;
  if ($[21] !== acceptOptions || $[22] !== t10) {
    t11 = [...acceptOptions, ...t10];
    $[21] = acceptOptions;
    $[22] = t10;
    $[23] = t11;
  } else {
    t11 = $[23];
  }
  let t12;
  if ($[24] !== onChange) {
    t12 = value_0 => onChange(value_0 as 'accept_opt_in' | 'accept_opt_out' | 'defer');
    $[24] = onChange;
    $[25] = t12;
  } else {
    t12 = $[25];
  }
  let t13;
  if ($[26] !== handleCancel || $[27] !== t11 || $[28] !== t12) {
    t13 = <Box flexDirection="column" gap={1}>{t9}<Select options={t11} onChange={t12} onCancel={handleCancel} /></Box>;
    $[26] = handleCancel;
    $[27] = t11;
    $[28] = t12;
    $[29] = t13;
  } else {
    t13 = $[29];
  }
  let t14;
  if ($[30] !== handleCancel || $[31] !== t13 || $[32] !== t8) {
    t14 = <Dialog title="Updates to Consumer Terms and Policies" color="professionalBlue" onCancel={handleCancel} inputGuide={_temp}>{t8}{t13}</Dialog>;
    $[30] = handleCancel;
    $[31] = t13;
    $[32] = t8;
    $[33] = t14;
  } else {
    t14 = $[33];
  }
  return t14;
}
function _temp(exitState) {
  return exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline><KeyboardShortcutHint shortcut="Enter" action="confirm" /><KeyboardShortcutHint shortcut="Esc" action="cancel" /></Byline>;
}
type PrivacySettingsDialogProps = {
  settings: AccountSettings;
  domainExcluded?: boolean;
  onDone(): void;
};
export function PrivacySettingsDialog(t0) {
  const $ = _c(17);
  const {
    settings,
    domainExcluded,
    onDone
  } = t0;
  const [groveEnabled, setGroveEnabled] = useState(settings.grove_enabled);
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = [];
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  React.useEffect(_temp2, t1);
  let t2;
  if ($[1] !== domainExcluded || $[2] !== groveEnabled) {
    t2 = async (input, key) => {
      if (!domainExcluded && (key.tab || key.return || input === " ")) {
        const newValue = !groveEnabled;
        setGroveEnabled(newValue);
        await updateGroveSettings(newValue);
      }
    };
    $[1] = domainExcluded;
    $[2] = groveEnabled;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  useInput(t2);
  let t3;
  if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = <Text color="error">false</Text>;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  let valueComponent = t3;
  if (domainExcluded) {
    let t4;
    if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
      t4 = <Text color="error">false (for emails with your domain)</Text>;
      $[5] = t4;
    } else {
      t4 = $[5];
    }
    valueComponent = t4;
  } else {
    if (groveEnabled) {
      let t4;
      if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
        t4 = <Text color="success">true</Text>;
        $[6] = t4;
      } else {
        t4 = $[6];
      }
      valueComponent = t4;
    }
  }
  let t4;
  if ($[7] !== domainExcluded) {
    t4 = exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : domainExcluded ? <KeyboardShortcutHint shortcut="Esc" action="cancel" /> : <Byline><KeyboardShortcutHint shortcut="Enter/Tab/Space" action="toggle" /><KeyboardShortcutHint shortcut="Esc" action="cancel" /></Byline>;
    $[7] = domainExcluded;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  let t5;
  if ($[9] === Symbol.for("react.memo_cache_sentinel")) {
    t5 = <Text>Review and manage your privacy settings at{" "}<Link url="https://claude.ai/settings/data-privacy-controls" /></Text>;
    $[9] = t5;
  } else {
    t5 = $[9];
  }
  let t6;
  if ($[10] === Symbol.for("react.memo_cache_sentinel")) {
    t6 = <Box width={44}><Text bold={true}>Help improve Claude</Text></Box>;
    $[10] = t6;
  } else {
    t6 = $[10];
  }
  let t7;
  if ($[11] !== valueComponent) {
    t7 = <Box>{t6}<Box>{valueComponent}</Box></Box>;
    $[11] = valueComponent;
    $[12] = t7;
  } else {
    t7 = $[12];
  }
  let t8;
  if ($[13] !== onDone || $[14] !== t4 || $[15] !== t7) {
    t8 = <Dialog title="Data Privacy" color="professionalBlue" onCancel={onDone} inputGuide={t4}>{t5}{t7}</Dialog>;
    $[13] = onDone;
    $[14] = t4;
    $[15] = t7;
    $[16] = t8;
  } else {
    t8 = $[16];
  }
  return t8;
}
function _temp2() {
  logEvent("tengu_grove_privacy_settings_viewed", {});
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsInVzZUVmZmVjdCIsInVzZVN0YXRlIiwiQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyIsImxvZ0V2ZW50IiwiQm94IiwiTGluayIsIlRleHQiLCJ1c2VJbnB1dCIsIkFjY291bnRTZXR0aW5ncyIsImNhbGN1bGF0ZVNob3VsZFNob3dHcm92ZSIsIkdyb3ZlQ29uZmlnIiwiZ2V0R3JvdmVOb3RpY2VDb25maWciLCJnZXRHcm92ZVNldHRpbmdzIiwibWFya0dyb3ZlTm90aWNlVmlld2VkIiwidXBkYXRlR3JvdmVTZXR0aW5ncyIsIlNlbGVjdCIsIkJ5bGluZSIsIkRpYWxvZyIsIktleWJvYXJkU2hvcnRjdXRIaW50IiwiR3JvdmVEZWNpc2lvbiIsIlByb3BzIiwic2hvd0lmQWxyZWFkeVZpZXdlZCIsImxvY2F0aW9uIiwib25Eb25lIiwiZGVjaXNpb24iLCJORVdfVEVSTVNfQVNDSUkiLCJHcmFjZVBlcmlvZENvbnRlbnRCb2R5IiwiJCIsIl9jIiwidDAiLCJTeW1ib2wiLCJmb3IiLCJ0MSIsInQyIiwidDMiLCJ0NCIsInQ1IiwidDYiLCJ0NyIsInQ4IiwiUG9zdEdyYWNlUGVyaW9kQ29udGVudEJvZHkiLCJHcm92ZURpYWxvZyIsInNob3VsZFNob3dEaWFsb2ciLCJzZXRTaG91bGRTaG93RGlhbG9nIiwiZ3JvdmVDb25maWciLCJzZXRHcm92ZUNvbmZpZyIsImNoZWNrR3JvdmVTZXR0aW5ncyIsInNldHRpbmdzUmVzdWx0IiwiY29uZmlnUmVzdWx0IiwiUHJvbWlzZSIsImFsbCIsImNvbmZpZyIsInN1Y2Nlc3MiLCJkYXRhIiwic2hvdWxkU2hvdyIsImRpc21pc3NhYmxlIiwibm90aWNlX2lzX2dyYWNlX3BlcmlvZCIsIm9uQ2hhbmdlIiwidmFsdWUiLCJiYjIxIiwic3RhdGUiLCJkb21haW5fZXhjbHVkZWQiLCJsYWJlbCIsImFjY2VwdE9wdGlvbnMiLCJoYW5kbGVDYW5jZWwiLCJ0OSIsInQxMCIsInQxMSIsInQxMiIsInZhbHVlXzAiLCJ0MTMiLCJ0MTQiLCJfdGVtcCIsImV4aXRTdGF0ZSIsInBlbmRpbmciLCJrZXlOYW1lIiwiUHJpdmFjeVNldHRpbmdzRGlhbG9nUHJvcHMiLCJzZXR0aW5ncyIsImRvbWFpbkV4Y2x1ZGVkIiwiUHJpdmFjeVNldHRpbmdzRGlhbG9nIiwiZ3JvdmVFbmFibGVkIiwic2V0R3JvdmVFbmFibGVkIiwiZ3JvdmVfZW5hYmxlZCIsIl90ZW1wMiIsImlucHV0Iiwia2V5IiwidGFiIiwicmV0dXJuIiwibmV3VmFsdWUiLCJ2YWx1ZUNvbXBvbmVudCJdLCJzb3VyY2VzIjpbIkdyb3ZlLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlRWZmZWN0LCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnc3JjL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB7IEJveCwgTGluaywgVGV4dCwgdXNlSW5wdXQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5pbXBvcnQge1xuICB0eXBlIEFjY291bnRTZXR0aW5ncyxcbiAgY2FsY3VsYXRlU2hvdWxkU2hvd0dyb3ZlLFxuICB0eXBlIEdyb3ZlQ29uZmlnLFxuICBnZXRHcm92ZU5vdGljZUNvbmZpZyxcbiAgZ2V0R3JvdmVTZXR0aW5ncyxcbiAgbWFya0dyb3ZlTm90aWNlVmlld2VkLFxuICB1cGRhdGVHcm92ZVNldHRpbmdzLFxufSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hcGkvZ3JvdmUuanMnXG5pbXBvcnQgeyBTZWxlY3QgfSBmcm9tICcuLi9DdXN0b21TZWxlY3QvaW5kZXguanMnXG5pbXBvcnQgeyBCeWxpbmUgfSBmcm9tICcuLi9kZXNpZ24tc3lzdGVtL0J5bGluZS5qcydcbmltcG9ydCB7IERpYWxvZyB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vRGlhbG9nLmpzJ1xuaW1wb3J0IHsgS2V5Ym9hcmRTaG9ydGN1dEhpbnQgfSBmcm9tICcuLi9kZXNpZ24tc3lzdGVtL0tleWJvYXJkU2hvcnRjdXRIaW50LmpzJ1xuXG5leHBvcnQgdHlwZSBHcm92ZURlY2lzaW9uID1cbiAgfCAnYWNjZXB0X29wdF9pbidcbiAgfCAnYWNjZXB0X29wdF9vdXQnXG4gIHwgJ2RlZmVyJ1xuICB8ICdlc2NhcGUnXG4gIHwgJ3NraXBfcmVuZGVyaW5nJ1xuXG50eXBlIFByb3BzID0ge1xuICBzaG93SWZBbHJlYWR5Vmlld2VkOiBib29sZWFuXG4gIGxvY2F0aW9uOiAnc2V0dGluZ3MnIHwgJ3BvbGljeV91cGRhdGVfbW9kYWwnIHwgJ29uYm9hcmRpbmcnXG4gIG9uRG9uZShkZWNpc2lvbjogR3JvdmVEZWNpc2lvbik6IHZvaWRcbn1cblxuY29uc3QgTkVXX1RFUk1TX0FTQ0lJID0gYCBfX19fX19fX19fX19fXG4gfCAgICAgICAgICBcXFxcICBcXFxcXG4gfCBORVcgVEVSTVMgXFxcXF9fXFxcXFxuIHwgICAgICAgICAgICAgIHxcbiB8ICAtLS0tLS0tLS0tICB8XG4gfCAgLS0tLS0tLS0tLSAgfFxuIHwgIC0tLS0tLS0tLS0gIHxcbiB8ICAtLS0tLS0tLS0tICB8XG4gfCAgLS0tLS0tLS0tLSAgfFxuIHwgICAgICAgICAgICAgIHxcbiB8X19fX19fX19fX19fX198YFxuXG5mdW5jdGlvbiBHcmFjZVBlcmlvZENvbnRlbnRCb2R5KCk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIDxUZXh0PlxuICAgICAgICBBbiB1cGRhdGUgdG8gb3VyIENvbnN1bWVyIFRlcm1zIGFuZCBQcml2YWN5IFBvbGljeSB3aWxsIHRha2UgZWZmZWN0IG9ueycgJ31cbiAgICAgICAgPFRleHQgYm9sZD5PY3RvYmVyIDgsIDIwMjU8L1RleHQ+LiBZb3UgY2FuIGFjY2VwdCB0aGUgdXBkYXRlZCB0ZXJtc1xuICAgICAgICB0b2RheS5cbiAgICAgIDwvVGV4dD5cblxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxUZXh0PldoYXQmYXBvcztzIGNoYW5naW5nPzwvVGV4dD5cblxuICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsxfT5cbiAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgIDxUZXh0PsK3IDwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0IGJvbGQ+WW91IGNhbiBoZWxwIGltcHJvdmUgQ2xhdWRlIDwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICDigJQgQWxsb3cgdGhlIHVzZSBvZiB5b3VyIGNoYXRzIGFuZCBjb2Rpbmcgc2Vzc2lvbnMgdG8gdHJhaW4gYW5kXG4gICAgICAgICAgICAgIGltcHJvdmUgQW50aHJvcGljIEFJIG1vZGVscy4gQ2hhbmdlIGFueXRpbWUgaW4geW91ciBQcml2YWN5XG4gICAgICAgICAgICAgIFNldHRpbmdzIChcbiAgICAgICAgICAgICAgPExpbmtcbiAgICAgICAgICAgICAgICB1cmw9eydodHRwczovL2NsYXVkZS5haS9zZXR0aW5ncy9kYXRhLXByaXZhY3ktY29udHJvbHMnfVxuICAgICAgICAgICAgICA+PC9MaW5rPlxuICAgICAgICAgICAgICApLlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezF9PlxuICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgPFRleHQ+wrcgPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5VcGRhdGVzIHRvIGRhdGEgcmV0ZW50aW9uIDwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICDigJQgVG8gaGVscCB1cyBpbXByb3ZlIG91ciBBSSBtb2RlbHMgYW5kIHNhZmV0eSBwcm90ZWN0aW9ucyxcbiAgICAgICAgICAgICAgd2UmYXBvcztyZSBleHRlbmRpbmcgZGF0YSByZXRlbnRpb24gdG8gNSB5ZWFycy5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG5cbiAgICAgIDxUZXh0PlxuICAgICAgICBMZWFybiBtb3JlIChcbiAgICAgICAgPExpbmtcbiAgICAgICAgICB1cmw9eydodHRwczovL3d3dy5hbnRocm9waWMuY29tL25ld3MvdXBkYXRlcy10by1vdXItY29uc3VtZXItdGVybXMnfVxuICAgICAgICA+PC9MaW5rPlxuICAgICAgICApIG9yIHJlYWQgdGhlIHVwZGF0ZWQgQ29uc3VtZXIgVGVybXMgKFxuICAgICAgICA8TGluayB1cmw9eydodHRwczovL2FudGhyb3BpYy5jb20vbGVnYWwvdGVybXMnfT48L0xpbms+KSBhbmQgUHJpdmFjeVxuICAgICAgICBQb2xpY3kgKDxMaW5rIHVybD17J2h0dHBzOi8vYW50aHJvcGljLmNvbS9sZWdhbC9wcml2YWN5J30+PC9MaW5rPilcbiAgICAgIDwvVGV4dD5cbiAgICA8Lz5cbiAgKVxufVxuXG5mdW5jdGlvbiBQb3N0R3JhY2VQZXJpb2RDb250ZW50Qm9keSgpOiBSZWFjdC5SZWFjdE5vZGUge1xuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICA8VGV4dD5XZSZhcG9zO3ZlIHVwZGF0ZWQgb3VyIENvbnN1bWVyIFRlcm1zIGFuZCBQcml2YWN5IFBvbGljeS48L1RleHQ+XG5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MX0+XG4gICAgICAgIDxUZXh0PldoYXQmYXBvcztzIGNoYW5naW5nPzwvVGV4dD5cblxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dCBib2xkPkhlbHAgaW1wcm92ZSBDbGF1ZGU8L1RleHQ+XG4gICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICBBbGxvdyB0aGUgdXNlIG9mIHlvdXIgY2hhdHMgYW5kIGNvZGluZyBzZXNzaW9ucyB0byB0cmFpbiBhbmQgaW1wcm92ZVxuICAgICAgICAgICAgQW50aHJvcGljIEFJIG1vZGVscy4gWW91IGNhbiBjaGFuZ2UgdGhpcyBhbnl0aW1lIGluIFByaXZhY3kgU2V0dGluZ3NcbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPExpbmsgdXJsPXsnaHR0cHM6Ly9jbGF1ZGUuYWkvc2V0dGluZ3MvZGF0YS1wcml2YWN5LWNvbnRyb2xzJ30+PC9MaW5rPlxuICAgICAgICA8L0JveD5cblxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dCBib2xkPkhvdyB0aGlzIGFmZmVjdHMgZGF0YSByZXRlbnRpb248L1RleHQ+XG4gICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICBUdXJuaW5nIE9OIHRoZSBpbXByb3ZlIENsYXVkZSBzZXR0aW5nIGV4dGVuZHMgZGF0YSByZXRlbnRpb24gZnJvbSAzMFxuICAgICAgICAgICAgZGF5cyB0byA1IHllYXJzLiBUdXJuaW5nIGl0IE9GRiBrZWVwcyB0aGUgZGVmYXVsdCAzMC1kYXkgZGF0YVxuICAgICAgICAgICAgcmV0ZW50aW9uLiBEZWxldGUgZGF0YSBhbnl0aW1lLlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cblxuICAgICAgPFRleHQ+XG4gICAgICAgIExlYXJuIG1vcmUgKFxuICAgICAgICA8TGlua1xuICAgICAgICAgIHVybD17J2h0dHBzOi8vd3d3LmFudGhyb3BpYy5jb20vbmV3cy91cGRhdGVzLXRvLW91ci1jb25zdW1lci10ZXJtcyd9XG4gICAgICAgID48L0xpbms+XG4gICAgICAgICkgb3IgcmVhZCB0aGUgdXBkYXRlZCBDb25zdW1lciBUZXJtcyAoXG4gICAgICAgIDxMaW5rIHVybD17J2h0dHBzOi8vYW50aHJvcGljLmNvbS9sZWdhbC90ZXJtcyd9PjwvTGluaz4pIGFuZCBQcml2YWN5XG4gICAgICAgIFBvbGljeSAoPExpbmsgdXJsPXsnaHR0cHM6Ly9hbnRocm9waWMuY29tL2xlZ2FsL3ByaXZhY3knfT48L0xpbms+KVxuICAgICAgPC9UZXh0PlxuICAgIDwvPlxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBHcm92ZURpYWxvZyh7XG4gIHNob3dJZkFscmVhZHlWaWV3ZWQsXG4gIGxvY2F0aW9uLFxuICBvbkRvbmUsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFtzaG91bGRTaG93RGlhbG9nLCBzZXRTaG91bGRTaG93RGlhbG9nXSA9IHVzZVN0YXRlPGJvb2xlYW4gfCBudWxsPihudWxsKVxuICBjb25zdCBbZ3JvdmVDb25maWcsIHNldEdyb3ZlQ29uZmlnXSA9IHVzZVN0YXRlPEdyb3ZlQ29uZmlnIHwgbnVsbD4obnVsbClcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGFzeW5jIGZ1bmN0aW9uIGNoZWNrR3JvdmVTZXR0aW5ncygpIHtcbiAgICAgIGNvbnN0IFtzZXR0aW5nc1Jlc3VsdCwgY29uZmlnUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgZ2V0R3JvdmVTZXR0aW5ncygpLFxuICAgICAgICBnZXRHcm92ZU5vdGljZUNvbmZpZygpLFxuICAgICAgXSlcblxuICAgICAgLy8gRXh0cmFjdCBjb25maWcgZGF0YSBpZiBzdWNjZXNzZnVsLCBvdGhlcndpc2UgbnVsbFxuICAgICAgY29uc3QgY29uZmlnID0gY29uZmlnUmVzdWx0LnN1Y2Nlc3MgPyBjb25maWdSZXN1bHQuZGF0YSA6IG51bGxcbiAgICAgIHNldEdyb3ZlQ29uZmlnKGNvbmZpZylcblxuICAgICAgLy8gRGV0ZXJtaW5lIGlmIHdlIHNob3VsZCBzaG93IHRoZSBkaWFsb2cgKHJldHVybnMgZmFsc2Ugb24gQVBJIGZhaWx1cmUpXG4gICAgICBjb25zdCBzaG91bGRTaG93ID0gY2FsY3VsYXRlU2hvdWxkU2hvd0dyb3ZlKFxuICAgICAgICBzZXR0aW5nc1Jlc3VsdCxcbiAgICAgICAgY29uZmlnUmVzdWx0LFxuICAgICAgICBzaG93SWZBbHJlYWR5Vmlld2VkLFxuICAgICAgKVxuXG4gICAgICBzZXRTaG91bGRTaG93RGlhbG9nKHNob3VsZFNob3cpXG4gICAgICAvLyBJZiB3ZSBzaG91bGRuJ3Qgc2hvdyB0aGUgZGlhbG9nLCBpbW1lZGlhdGVseSBjYWxsIG9uRG9uZVxuICAgICAgaWYgKCFzaG91bGRTaG93KSB7XG4gICAgICAgIG9uRG9uZSgnc2tpcF9yZW5kZXJpbmcnKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIC8vIE1hcmsgYXMgdmlld2VkIGV2ZXJ5IHRpbWUgd2Ugc2hvdyB0aGUgZGlhbG9nIChmb3IgcmVtaW5kZXIgZnJlcXVlbmN5IHRyYWNraW5nKVxuICAgICAgdm9pZCBtYXJrR3JvdmVOb3RpY2VWaWV3ZWQoKVxuICAgICAgLy8gTG9nIHRoYXQgdGhlIEdyb3ZlIHBvbGljeSBkaWFsb2cgd2FzIHNob3duXG4gICAgICBsb2dFdmVudCgndGVuZ3VfZ3JvdmVfcG9saWN5X3ZpZXdlZCcsIHtcbiAgICAgICAgbG9jYXRpb246XG4gICAgICAgICAgbG9jYXRpb24gYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgZGlzbWlzc2FibGU6XG4gICAgICAgICAgY29uZmlnPy5ub3RpY2VfaXNfZ3JhY2VfcGVyaW9kIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KVxuICAgIH1cblxuICAgIHZvaWQgY2hlY2tHcm92ZVNldHRpbmdzKClcbiAgfSwgW3Nob3dJZkFscmVhZHlWaWV3ZWQsIGxvY2F0aW9uLCBvbkRvbmVdKVxuXG4gIC8vIExvYWRpbmcgc3RhdGVcbiAgaWYgKHNob3VsZFNob3dEaWFsb2cgPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgLy8gVXNlciBoYXMgYWxyZWFkeSBzZXQgcHJlZmVyZW5jZXMsIGRvbid0IHNob3cgZGlhbG9nXG4gIGlmICghc2hvdWxkU2hvd0RpYWxvZykge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBvbkNoYW5nZShcbiAgICB2YWx1ZTogJ2FjY2VwdF9vcHRfaW4nIHwgJ2FjY2VwdF9vcHRfb3V0JyB8ICdkZWZlcicgfCAnZXNjYXBlJyxcbiAgKSB7XG4gICAgc3dpdGNoICh2YWx1ZSkge1xuICAgICAgY2FzZSAnYWNjZXB0X29wdF9pbic6IHtcbiAgICAgICAgYXdhaXQgdXBkYXRlR3JvdmVTZXR0aW5ncyh0cnVlKVxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfZ3JvdmVfcG9saWN5X3N1Ym1pdHRlZCcsIHtcbiAgICAgICAgICBzdGF0ZTogdHJ1ZSxcbiAgICAgICAgICBkaXNtaXNzYWJsZTpcbiAgICAgICAgICAgIGdyb3ZlQ29uZmlnPy5ub3RpY2VfaXNfZ3JhY2VfcGVyaW9kIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBjYXNlICdhY2NlcHRfb3B0X291dCc6IHtcbiAgICAgICAgYXdhaXQgdXBkYXRlR3JvdmVTZXR0aW5ncyhmYWxzZSlcbiAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2dyb3ZlX3BvbGljeV9zdWJtaXR0ZWQnLCB7XG4gICAgICAgICAgc3RhdGU6IGZhbHNlLFxuICAgICAgICAgIGRpc21pc3NhYmxlOlxuICAgICAgICAgICAgZ3JvdmVDb25maWc/Lm5vdGljZV9pc19ncmFjZV9wZXJpb2QgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgfSlcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ2RlZmVyJzpcbiAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2dyb3ZlX3BvbGljeV9kaXNtaXNzZWQnLCB7XG4gICAgICAgICAgc3RhdGU6IHRydWUsXG4gICAgICAgIH0pXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdlc2NhcGUnOlxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfZ3JvdmVfcG9saWN5X2VzY2FwZWQnLCB7fSlcbiAgICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICBvbkRvbmUodmFsdWUpXG4gIH1cblxuICBjb25zdCBhY2NlcHRPcHRpb25zID0gZ3JvdmVDb25maWc/LmRvbWFpbl9leGNsdWRlZFxuICAgID8gW1xuICAgICAgICB7XG4gICAgICAgICAgbGFiZWw6XG4gICAgICAgICAgICAnQWNjZXB0IHRlcm1zIMK3IEhlbHAgaW1wcm92ZSBDbGF1ZGU6IE9GRiAoZm9yIGVtYWlscyB3aXRoIHlvdXIgZG9tYWluKScsXG4gICAgICAgICAgdmFsdWU6ICdhY2NlcHRfb3B0X291dCcsXG4gICAgICAgIH0sXG4gICAgICBdXG4gICAgOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBsYWJlbDogJ0FjY2VwdCB0ZXJtcyDCtyBIZWxwIGltcHJvdmUgQ2xhdWRlOiBPTicsXG4gICAgICAgICAgdmFsdWU6ICdhY2NlcHRfb3B0X2luJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGxhYmVsOiAnQWNjZXB0IHRlcm1zIMK3IEhlbHAgaW1wcm92ZSBDbGF1ZGU6IE9GRicsXG4gICAgICAgICAgdmFsdWU6ICdhY2NlcHRfb3B0X291dCcsXG4gICAgICAgIH0sXG4gICAgICBdXG5cbiAgZnVuY3Rpb24gaGFuZGxlQ2FuY2VsKCk6IHZvaWQge1xuICAgIGlmIChncm92ZUNvbmZpZz8ubm90aWNlX2lzX2dyYWNlX3BlcmlvZCkge1xuICAgICAgdm9pZCBvbkNoYW5nZSgnZGVmZXInKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHZvaWQgb25DaGFuZ2UoJ2VzY2FwZScpXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxEaWFsb2dcbiAgICAgIHRpdGxlPVwiVXBkYXRlcyB0byBDb25zdW1lciBUZXJtcyBhbmQgUG9saWNpZXNcIlxuICAgICAgY29sb3I9XCJwcm9mZXNzaW9uYWxCbHVlXCJcbiAgICAgIG9uQ2FuY2VsPXtoYW5kbGVDYW5jZWx9XG4gICAgICBpbnB1dEd1aWRlPXtleGl0U3RhdGUgPT5cbiAgICAgICAgZXhpdFN0YXRlLnBlbmRpbmcgPyAoXG4gICAgICAgICAgPFRleHQ+UHJlc3Mge2V4aXRTdGF0ZS5rZXlOYW1lfSBhZ2FpbiB0byBleGl0PC9UZXh0PlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cImNvbmZpcm1cIiAvPlxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiRXNjXCIgYWN0aW9uPVwiY2FuY2VsXCIgLz5cbiAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgKVxuICAgICAgfVxuICAgID5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cInJvd1wiPlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9IGZsZXhHcm93PXsxfT5cbiAgICAgICAgICB7Z3JvdmVDb25maWc/Lm5vdGljZV9pc19ncmFjZV9wZXJpb2QgPyAoXG4gICAgICAgICAgICA8R3JhY2VQZXJpb2RDb250ZW50Qm9keSAvPlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8UG9zdEdyYWNlUGVyaW9kQ29udGVudEJvZHkgLz5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cbiAgICAgICAgPEJveCBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cInByb2Zlc3Npb25hbEJsdWVcIj57TkVXX1RFUk1TX0FTQ0lJfTwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cblxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXsxfT5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgPFRleHQgYm9sZD5QbGVhc2Ugc2VsZWN0IGhvdyB5b3UmYXBvcztkIGxpa2UgdG8gY29udGludWU8L1RleHQ+XG4gICAgICAgICAgPFRleHQ+WW91ciBjaG9pY2UgdGFrZXMgZWZmZWN0IGltbWVkaWF0ZWx5IHVwb24gY29uZmlybWF0aW9uLjwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgPFNlbGVjdFxuICAgICAgICAgIG9wdGlvbnM9e1tcbiAgICAgICAgICAgIC4uLmFjY2VwdE9wdGlvbnMsXG4gICAgICAgICAgICAvLyBPbmx5IHNob3cgXCJOb3Qgbm93XCIgaWYgaW4gZ3JhY2UgcGVyaW9kXG4gICAgICAgICAgICAuLi4oZ3JvdmVDb25maWc/Lm5vdGljZV9pc19ncmFjZV9wZXJpb2RcbiAgICAgICAgICAgICAgPyBbeyBsYWJlbDogJ05vdCBub3cnLCB2YWx1ZTogJ2RlZmVyJyB9XVxuICAgICAgICAgICAgICA6IFtdKSxcbiAgICAgICAgICBdfVxuICAgICAgICAgIG9uQ2hhbmdlPXt2YWx1ZSA9PlxuICAgICAgICAgICAgb25DaGFuZ2UodmFsdWUgYXMgJ2FjY2VwdF9vcHRfaW4nIHwgJ2FjY2VwdF9vcHRfb3V0JyB8ICdkZWZlcicpXG4gICAgICAgICAgfVxuICAgICAgICAgIG9uQ2FuY2VsPXtoYW5kbGVDYW5jZWx9XG4gICAgICAgIC8+XG4gICAgICA8L0JveD5cbiAgICA8L0RpYWxvZz5cbiAgKVxufVxuXG50eXBlIFByaXZhY3lTZXR0aW5nc0RpYWxvZ1Byb3BzID0ge1xuICBzZXR0aW5nczogQWNjb3VudFNldHRpbmdzXG4gIGRvbWFpbkV4Y2x1ZGVkPzogYm9vbGVhblxuICBvbkRvbmUoKTogdm9pZFxufVxuXG5leHBvcnQgZnVuY3Rpb24gUHJpdmFjeVNldHRpbmdzRGlhbG9nKHtcbiAgc2V0dGluZ3MsXG4gIGRvbWFpbkV4Y2x1ZGVkLFxuICBvbkRvbmUsXG59OiBQcml2YWN5U2V0dGluZ3NEaWFsb2dQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFtncm92ZUVuYWJsZWQsIHNldEdyb3ZlRW5hYmxlZF0gPSB1c2VTdGF0ZShzZXR0aW5ncy5ncm92ZV9lbmFibGVkKVxuXG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgbG9nRXZlbnQoJ3Rlbmd1X2dyb3ZlX3ByaXZhY3lfc2V0dGluZ3Nfdmlld2VkJywge30pXG4gIH0sIFtdKVxuXG4gIHVzZUlucHV0KGFzeW5jIChpbnB1dCwga2V5KSA9PiB7XG4gICAgLy8gVG9nZ2xlIHRoZSBzZXR0aW5nIHdoZW4gZW50ZXIvdGFiL3NwYWNlIGlzIHByZXNzZWRcbiAgICBpZiAoIWRvbWFpbkV4Y2x1ZGVkICYmIChrZXkudGFiIHx8IGtleS5yZXR1cm4gfHwgaW5wdXQgPT09ICcgJykpIHtcbiAgICAgIGNvbnN0IG5ld1ZhbHVlID0gIWdyb3ZlRW5hYmxlZFxuICAgICAgc2V0R3JvdmVFbmFibGVkKG5ld1ZhbHVlKVxuICAgICAgYXdhaXQgdXBkYXRlR3JvdmVTZXR0aW5ncyhuZXdWYWx1ZSlcbiAgICB9XG4gIH0pXG5cbiAgbGV0IHZhbHVlQ29tcG9uZW50ID0gPFRleHQgY29sb3I9XCJlcnJvclwiPmZhbHNlPC9UZXh0PlxuICBpZiAoZG9tYWluRXhjbHVkZWQpIHtcbiAgICB2YWx1ZUNvbXBvbmVudCA9IChcbiAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj5mYWxzZSAoZm9yIGVtYWlscyB3aXRoIHlvdXIgZG9tYWluKTwvVGV4dD5cbiAgICApXG4gIH0gZWxzZSBpZiAoZ3JvdmVFbmFibGVkKSB7XG4gICAgdmFsdWVDb21wb25lbnQgPSA8VGV4dCBjb2xvcj1cInN1Y2Nlc3NcIj50cnVlPC9UZXh0PlxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8RGlhbG9nXG4gICAgICB0aXRsZT1cIkRhdGEgUHJpdmFjeVwiXG4gICAgICBjb2xvcj1cInByb2Zlc3Npb25hbEJsdWVcIlxuICAgICAgb25DYW5jZWw9e29uRG9uZX1cbiAgICAgIGlucHV0R3VpZGU9e2V4aXRTdGF0ZSA9PlxuICAgICAgICBleGl0U3RhdGUucGVuZGluZyA/IChcbiAgICAgICAgICA8VGV4dD5QcmVzcyB7ZXhpdFN0YXRlLmtleU5hbWV9IGFnYWluIHRvIGV4aXQ8L1RleHQ+XG4gICAgICAgICkgOiBkb21haW5FeGNsdWRlZCA/IChcbiAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFc2NcIiBhY3Rpb249XCJjYW5jZWxcIiAvPlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlci9UYWIvU3BhY2VcIiBhY3Rpb249XCJ0b2dnbGVcIiAvPlxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiRXNjXCIgYWN0aW9uPVwiY2FuY2VsXCIgLz5cbiAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgKVxuICAgICAgfVxuICAgID5cbiAgICAgIDxUZXh0PlxuICAgICAgICBSZXZpZXcgYW5kIG1hbmFnZSB5b3VyIHByaXZhY3kgc2V0dGluZ3MgYXR7JyAnfVxuICAgICAgICA8TGluayB1cmw9eydodHRwczovL2NsYXVkZS5haS9zZXR0aW5ncy9kYXRhLXByaXZhY3ktY29udHJvbHMnfT48L0xpbms+XG4gICAgICA8L1RleHQ+XG5cbiAgICAgIDxCb3g+XG4gICAgICAgIDxCb3ggd2lkdGg9ezQ0fT5cbiAgICAgICAgICA8VGV4dCBib2xkPkhlbHAgaW1wcm92ZSBDbGF1ZGU8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgICA8Qm94Pnt2YWx1ZUNvbXBvbmVudH08L0JveD5cbiAgICAgIDwvQm94PlxuICAgIDwvRGlhbG9nPlxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPQSxLQUFLLElBQUlDLFNBQVMs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