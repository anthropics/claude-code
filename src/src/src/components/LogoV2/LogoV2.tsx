import { c as _c } from "react/compiler-runtime";
// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import * as React from 'react';
import { Box, Text, color } from '../../ink.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { stringWidth } from '../../ink/stringWidth.js';
import { getLayoutMode, calculateLayoutDimensions, calculateOptimalLeftWidth, formatWelcomeMessage, truncatePath, getRecentActivitySync, getRecentReleaseNotesSync, getLogoDisplayData } from '../../utils/logoV2Utils.js';
import { truncate } from '../../utils/format.js';
import { getDisplayPath } from '../../utils/file.js';
import { Clawd } from './Clawd.js';
import { FeedColumn } from './FeedColumn.js';
import { createRecentActivityFeed, createWhatsNewFeed, createProjectOnboardingFeed, createGuestPassesFeed } from './feedConfigs.js';
import { getGlobalConfig, saveGlobalConfig } from 'src/utils/config.js';
import { resolveThemeSetting } from 'src/utils/systemTheme.js';
import { getInitialSettings } from 'src/utils/settings/settings.js';
import { isDebugMode, isDebugToStdErr, getDebugLogPath } from 'src/utils/debug.js';
import { useEffect, useState } from 'react';
import { getSteps, shouldShowProjectOnboarding, incrementProjectOnboardingSeenCount } from '../../projectOnboardingState.js';
import { CondensedLogo } from './CondensedLogo.js';
import { OffscreenFreeze } from '../OffscreenFreeze.js';
import { checkForReleaseNotesSync } from '../../utils/releaseNotes.js';
import { getDumpPromptsPath } from 'src/services/api/dumpPrompts.js';
import { isEnvTruthy } from 'src/utils/envUtils.js';
import { getStartupPerfLogPath, isDetailedProfilingEnabled } from 'src/utils/startupProfiler.js';
import { EmergencyTip } from './EmergencyTip.js';
import { VoiceModeNotice } from './VoiceModeNotice.js';
import { Opus1mMergeNotice } from './Opus1mMergeNotice.js';
import { feature } from 'bun:bundle';

// Conditional require so ChannelsNotice.tsx tree-shakes when both flags are
// false. A module-scope helper component inside a feature() ternary does NOT
// tree-shake (docs/feature-gating.md); the require pattern eliminates the
// whole file. VoiceModeNotice uses the unsafe helper pattern but VOICE_MODE
// is external: true so it's moot there.
/* eslint-disable @typescript-eslint/no-require-imports */
const ChannelsNoticeModule = feature('KAIROS') || feature('KAIROS_CHANNELS') ? require('./ChannelsNotice.js') as typeof import('./ChannelsNotice.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */
import { SandboxManager } from 'src/utils/sandbox/sandbox-adapter.js';
import { useShowGuestPassesUpsell, incrementGuestPassesSeenCount } from './GuestPassesUpsell.js';
import { useShowOverageCreditUpsell, incrementOverageCreditUpsellSeenCount, createOverageCreditFeed } from './OverageCreditUpsell.js';
import { plural } from '../../utils/stringUtils.js';
import { useAppState } from '../../state/AppState.js';
import { getEffortSuffix } from '../../utils/effort.js';
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js';
import { renderModelSetting } from '../../utils/model/model.js';
const LEFT_PANEL_MAX_WIDTH = 50;
export function LogoV2() {
  const $ = _c(94);
  const activities = getRecentActivitySync();
  const username = getGlobalConfig().oauthAccount?.displayName ?? "";
  const {
    columns
  } = useTerminalSize();
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = shouldShowProjectOnboarding();
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  const showOnboarding = t0;
  let t1;
  if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = SandboxManager.isSandboxingEnabled();
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const showSandboxStatus = t1;
  const showGuestPassesUpsell = useShowGuestPassesUpsell();
  const showOverageCreditUpsell = useShowOverageCreditUpsell();
  const agent = useAppState(_temp);
  const effortValue = useAppState(_temp2);
  const config = getGlobalConfig();
  let changelog;
  try {
    changelog = getRecentReleaseNotesSync(3);
  } catch {
    changelog = [];
  }
  const [announcement] = useState(() => {
    const announcements = getInitialSettings().companyAnnouncements;
    if (!announcements || announcements.length === 0) {
      return;
    }
    return config.numStartups === 1 ? announcements[0] : announcements[Math.floor(Math.random() * announcements.length)];
  });
  const {
    hasReleaseNotes
  } = checkForReleaseNotesSync(config.lastReleaseNotesSeen);
  let t2;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = () => {
      const currentConfig = getGlobalConfig();
      if (currentConfig.lastReleaseNotesSeen === MACRO.VERSION) {
        return;
      }
      saveGlobalConfig(_temp3);
      if (showOnboarding) {
        incrementProjectOnboardingSeenCount();
      }
    };
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  let t3;
  if ($[3] !== config) {
    t3 = [config, showOnboarding];
    $[3] = config;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  useEffect(t2, t3);
  let t4;
  if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
    t4 = !hasReleaseNotes && !showOnboarding && !isEnvTruthy(process.env.CLAUDE_CODE_FORCE_FULL_LOGO);
    $[5] = t4;
  } else {
    t4 = $[5];
  }
  const isCondensedMode = t4;
  let t5;
  let t6;
  if ($[6] !== showGuestPassesUpsell) {
    t5 = () => {
      if (showGuestPassesUpsell && !showOnboarding && !isCondensedMode) {
        incrementGuestPassesSeenCount();
      }
    };
    t6 = [showGuestPassesUpsell, showOnboarding, isCondensedMode];
    $[6] = showGuestPassesUpsell;
    $[7] = t5;
    $[8] = t6;
  } else {
    t5 = $[7];
    t6 = $[8];
  }
  useEffect(t5, t6);
  let t7;
  let t8;
  if ($[9] !== showGuestPassesUpsell || $[10] !== showOverageCreditUpsell) {
    t7 = () => {
      if (showOverageCreditUpsell && !showOnboarding && !showGuestPassesUpsell && !isCondensedMode) {
        incrementOverageCreditUpsellSeenCount();
      }
    };
    t8 = [showOverageCreditUpsell, showOnboarding, showGuestPassesUpsell, isCondensedMode];
    $[9] = showGuestPassesUpsell;
    $[10] = showOverageCreditUpsell;
    $[11] = t7;
    $[12] = t8;
  } else {
    t7 = $[11];
    t8 = $[12];
  }
  useEffect(t7, t8);
  const model = useMainLoopModel();
  const fullModelDisplayName = renderModelSetting(model);
  const {
    version,
    cwd,
    billingType,
    agentName: agentNameFromSettings
  } = getLogoDisplayData();
  const agentName = agent ?? agentNameFromSettings;
  const effortSuffix = getEffortSuffix(model, effortValue);
  const t9 = fullModelDisplayName + effortSuffix;
  let t10;
  if ($[13] !== t9) {
    t10 = truncate(t9, LEFT_PANEL_MAX_WIDTH - 20);
    $[13] = t9;
    $[14] = t10;
  } else {
    t10 = $[14];
  }
  const modelDisplayName = t10;
  if (!hasReleaseNotes && !showOnboarding && !isEnvTruthy(process.env.CLAUDE_CODE_FORCE_FULL_LOGO)) {
    let t11;
    let t12;
    let t13;
    let t14;
    let t15;
    let t16;
    let t17;
    if ($[15] === Symbol.for("react.memo_cache_sentinel")) {
      t11 = <CondensedLogo />;
      t12 = <VoiceModeNotice />;
      t13 = <Opus1mMergeNotice />;
      t14 = ChannelsNoticeModule && <ChannelsNoticeModule.ChannelsNotice />;
      t15 = isDebugMode() && <Box paddingLeft={2} flexDirection="column"><Text color="warning">Debug mode enabled</Text><Text dimColor={true}>Logging to: {isDebugToStdErr() ? "stderr" : getDebugLogPath()}</Text></Box>;
      t16 = <EmergencyTip />;
      t17 = process.env.CLAUDE_CODE_TMUX_SESSION && <Box paddingLeft={2} flexDirection="column"><Text dimColor={true}>tmux session: {process.env.CLAUDE_CODE_TMUX_SESSION}</Text><Text dimColor={true}>{process.env.CLAUDE_CODE_TMUX_PREFIX_CONFLICTS ? `Detach: ${process.env.CLAUDE_CODE_TMUX_PREFIX} ${process.env.CLAUDE_CODE_TMUX_PREFIX} d (press prefix twice - Claude uses ${process.env.CLAUDE_CODE_TMUX_PREFIX})` : `Detach: ${process.env.CLAUDE_CODE_TMUX_PREFIX} d`}</Text></Box>;
      $[15] = t11;
      $[16] = t12;
      $[17] = t13;
      $[18] = t14;
      $[19] = t15;
      $[20] = t16;
      $[21] = t17;
    } else {
      t11 = $[15];
      t12 = $[16];
      t13 = $[17];
      t14 = $[18];
      t15 = $[19];
      t16 = $[20];
      t17 = $[21];
    }
    let t18;
    if ($[22] !== announcement || $[23] !== config) {
      t18 = announcement && <Box paddingLeft={2} flexDirection="column">{!process.env.IS_DEMO && config.oauthAccount?.organizationName && <Text dimColor={true}>Message from {config.oauthAccount.organizationName}:</Text>}<Text>{announcement}</Text></Box>;
      $[22] = announcement;
      $[23] = config;
      $[24] = t18;
    } else {
      t18 = $[24];
    }
    let t19;
    let t20;
    let t21;
    let t22;
    if ($[25] === Symbol.for("react.memo_cache_sentinel")) {
      t19 = false && !process.env.DEMO_VERSION && <Box paddingLeft={2} flexDirection="column"><Text dimColor={true}>Use /issue to report model behavior issues</Text></Box>;
      t20 = false && !process.env.DEMO_VERSION && <Box paddingLeft={2} flexDirection="column"><Text color="warning">[ANT-ONLY] Logs:</Text><Text dimColor={true}>API calls: {getDisplayPath(getDumpPromptsPath())}</Text><Text dimColor={true}>Debug logs: {getDisplayPath(getDebugLogPath())}</Text>{isDetailedProfilingEnabled() && <Text dimColor={true}>Startup Perf: {getDisplayPath(getStartupPerfLogPath())}</Text>}</Box>;
      t21 = false && <GateOverridesWarning />;
      t22 = false && <ExperimentEnrollmentNotice />;
      $[25] = t19;
      $[26] = t20;
      $[27] = t21;
      $[28] = t22;
    } else {
      t19 = $[25];
      t20 = $[26];
      t21 = $[27];
      t22 = $[28];
    }
    let t23;
    if ($[29] !== t18) {
      t23 = <>{t11}{t12}{t13}{t14}{t15}{t16}{t17}{t18}{t19}{t20}{t21}{t22}</>;
      $[29] = t18;
      $[30] = t23;
    } else {
      t23 = $[30];
    }
    return t23;
  }
  const layoutMode = getLayoutMode(columns);
  const userTheme = resolveThemeSetting(getGlobalConfig().theme);
  const borderTitle = ` ${color("claude", userTheme)("Claude Code")} ${color("inactive", userTheme)(`v${version}`)} `;
  const compactBorderTitle = color("claude", userTheme)(" Claude Code ");
  if (layoutMode === "compact") {
    let welcomeMessage = formatWelcomeMessage(username);
    if (stringWidth(welcomeMessage) > columns - 4) {
      let t11;
      if ($[31] === Symbol.for("react.memo_cache_sentinel")) {
        t11 = formatWelcomeMessage(null);
        $[31] = t11;
      } else {
        t11 = $[31];
      }
      welcomeMessage = t11;
    }
    const cwdAvailableWidth = agentName ? columns - 4 - 1 - stringWidth(agentName) - 3 : columns - 4;
    const truncatedCwd = truncatePath(cwd, Math.max(cwdAvailableWidth, 10));
    let t11;
    if ($[32] !== compactBorderTitle) {
      t11 = {
        content: compactBorderTitle,
        position: "top",
        align: "start",
        offset: 1
      };
      $[32] = compactBorderTitle;
      $[33] = t11;
    } else {
      t11 = $[33];
    }
    let t12;
    if ($[34] === Symbol.for("react.memo_cache_sentinel")) {
      t12 = <Box marginY={1}><Clawd /></Box>;
      $[34] = t12;
    } else {
      t12 = $[34];
    }
    let t13;
    if ($[35] !== modelDisplayName) {
      t13 = <Text dimColor={true}>{modelDisplayName}</Text>;
      $[35] = modelDisplayName;
      $[36] = t13;
    } else {
      t13 = $[36];
    }
    let t14;
    let t15;
    let t16;
    if ($[37] === Symbol.for("react.memo_cache_sentinel")) {
      t14 = <VoiceModeNotice />;
      t15 = <Opus1mMergeNotice />;
      t16 = ChannelsNoticeModule && <ChannelsNoticeModule.ChannelsNotice />;
      $[37] = t14;
      $[38] = t15;
      $[39] = t16;
    } else {
      t14 = $[37];
      t15 = $[38];
      t16 = $[39];
    }
    let t17;
    if ($[40] !== showSandboxStatus) {
      t17 = showSandboxStatus && <Box marginTop={1} flexDirection="column"><Text color="warning">Your bash commands will be sandboxed. Disable with /sandbox.</Text></Box>;
      $[40] = showSandboxStatus;
      $[41] = t17;
    } else {
      t17 = $[41];
    }
    let t18;
    let t19;
    if ($[42] === Symbol.for("react.memo_cache_sentinel")) {
      t18 = false && <GateOverridesWarning />;
      t19 = false && <ExperimentEnrollmentNotice />;
      $[42] = t18;
      $[43] = t19;
    } else {
      t18 = $[42];
      t19 = $[43];
    }
    return <><OffscreenFreeze><Box flexDirection="column" borderStyle="round" borderColor="claude" borderText={t11} paddingX={1} paddingY={1} alignItems="center" width={columns}><Text bold={true}>{welcomeMessage}</Text>{t12}{t13}<Text dimColor={true}>{billingType}</Text><Text dimColor={true}>{agentName ? `@${agentName} · ${truncatedCwd}` : truncatedCwd}</Text></Box></OffscreenFreeze>{t14}{t15}{t16}{t17}{t18}{t19}</>;
  }
  const welcomeMessage_0 = formatWelcomeMessage(username);
  const modelLine = !process.env.IS_DEMO && config.oauthAccount?.organizationName ? `${modelDisplayName} · ${billingType} · ${config.oauthAccount.organizationName}` : `${modelDisplayName} · ${billingType}`;
  const cwdAvailableWidth_0 = agentName ? LEFT_PANEL_MAX_WIDTH - 1 - stringWidth(agentName) - 3 : LEFT_PANEL_MAX_WIDTH;
  const truncatedCwd_0 = truncatePath(cwd, Math.max(cwdAvailableWidth_0, 10));
  const cwdLine = agentName ? `@${agentName} · ${truncatedCwd_0}` : truncatedCwd_0;
  const optimalLeftWidth = calculateOptimalLeftWidth(welcomeMessage_0, cwdLine, modelLine);
  const {
    leftWidth,
    rightWidth
  } = calculateLayoutDimensions(columns, layoutMode, optimalLeftWidth);
  const T0 = OffscreenFreeze;
  const T1 = Box;
  const t11 = "column";
  const t12 = "round";
  const t13 = "claude";
  let t14;
  if ($[44] !== borderTitle) {
    t14 = {
      content: borderTitle,
      position: "top",
      align: "start",
      offset: 3
    };
    $[44] = borderTitle;
    $[45] = t14;
  } else {
    t14 = $[45];
  }
  const T2 = Box;
  const t15 = layoutMode === "horizontal" ? "row" : "column";
  const t16 = 1;
  const t17 = 1;
  let t18;
  if ($[46] !== welcomeMessage_0) {
    t18 = <Box marginTop={1}><Text bold={true}>{welcomeMessage_0}</Text></Box>;
    $[46] = welcomeMessage_0;
    $[47] = t18;
  } else {
    t18 = $[47];
  }
  let t19;
  if ($[48] === Symbol.for("react.memo_cache_sentinel")) {
    t19 = <Clawd />;
    $[48] = t19;
  } else {
    t19 = $[48];
  }
  let t20;
  if ($[49] !== modelLine) {
    t20 = <Text dimColor={true}>{modelLine}</Text>;
    $[49] = modelLine;
    $[50] = t20;
  } else {
    t20 = $[50];
  }
  let t21;
  if ($[51] !== cwdLine) {
    t21 = <Text dimColor={true}>{cwdLine}</Text>;
    $[51] = cwdLine;
    $[52] = t21;
  } else {
    t21 = $[52];
  }
  let t22;
  if ($[53] !== t20 || $[54] !== t21) {
    t22 = <Box flexDirection="column" alignItems="center">{t20}{t21}</Box>;
    $[53] = t20;
    $[54] = t21;
    $[55] = t22;
  } else {
    t22 = $[55];
  }
  let t23;
  if ($[56] !== leftWidth || $[57] !== t18 || $[58] !== t22) {
    t23 = <Box flexDirection="column" width={leftWidth} justifyContent="space-between" alignItems="center" minHeight={9}>{t18}{t19}{t22}</Box>;
    $[56] = leftWidth;
    $[57] = t18;
    $[58] = t22;
    $[59] = t23;
  } else {
    t23 = $[59];
  }
  let t24;
  if ($[60] !== layoutMode) {
    t24 = layoutMode === "horizontal" && <Box height="100%" borderStyle="single" borderColor="claude" borderDimColor={true} borderTop={false} borderBottom={false} borderLeft={false} />;
    $[60] = layoutMode;
    $[61] = t24;
  } else {
    t24 = $[61];
  }
  const t25 = layoutMode === "horizontal" && <FeedColumn feeds={showOnboarding ? [createProjectOnboardingFeed(getSteps()), createRecentActivityFeed(activities)] : showGuestPassesUpsell ? [createRecentActivityFeed(activities), createGuestPassesFeed()] : showOverageCreditUpsell ? [createRecentActivityFeed(activities), createOverageCreditFeed()] : [createRecentActivityFeed(activities), createWhatsNewFeed(changelog)]} maxWidth={rightWidth} />;
  let t26;
  if ($[62] !== T2 || $[63] !== t15 || $[64] !== t23 || $[65] !== t24 || $[66] !== t25) {
    t26 = <T2 flexDirection={t15} paddingX={t16} gap={t17}>{t23}{t24}{t25}</T2>;
    $[62] = T2;
    $[63] = t15;
    $[64] = t23;
    $[65] = t24;
    $[66] = t25;
    $[67] = t26;
  } else {
    t26 = $[67];
  }
  let t27;
  if ($[68] !== T1 || $[69] !== t14 || $[70] !== t26) {
    t27 = <T1 flexDirection={t11} borderStyle={t12} borderColor={t13} borderText={t14}>{t26}</T1>;
    $[68] = T1;
    $[69] = t14;
    $[70] = t26;
    $[71] = t27;
  } else {
    t27 = $[71];
  }
  let t28;
  if ($[72] !== T0 || $[73] !== t27) {
    t28 = <T0>{t27}</T0>;
    $[72] = T0;
    $[73] = t27;
    $[74] = t28;
  } else {
    t28 = $[74];
  }
  let t29;
  let t30;
  let t31;
  let t32;
  let t33;
  let t34;
  if ($[75] === Symbol.for("react.memo_cache_sentinel")) {
    t29 = <VoiceModeNotice />;
    t30 = <Opus1mMergeNotice />;
    t31 = ChannelsNoticeModule && <ChannelsNoticeModule.ChannelsNotice />;
    t32 = isDebugMode() && <Box paddingLeft={2} flexDirection="column"><Text color="warning">Debug mode enabled</Text><Text dimColor={true}>Logging to: {isDebugToStdErr() ? "stderr" : getDebugLogPath()}</Text></Box>;
    t33 = <EmergencyTip />;
    t34 = process.env.CLAUDE_CODE_TMUX_SESSION && <Box paddingLeft={2} flexDirection="column"><Text dimColor={true}>tmux session: {process.env.CLAUDE_CODE_TMUX_SESSION}</Text><Text dimColor={true}>{process.env.CLAUDE_CODE_TMUX_PREFIX_CONFLICTS ? `Detach: ${process.env.CLAUDE_CODE_TMUX_PREFIX} ${process.env.CLAUDE_CODE_TMUX_PREFIX} d (press prefix twice - Claude uses ${process.env.CLAUDE_CODE_TMUX_PREFIX})` : `Detach: ${process.env.CLAUDE_CODE_TMUX_PREFIX} d`}</Text></Box>;
    $[75] = t29;
    $[76] = t30;
    $[77] = t31;
    $[78] = t32;
    $[79] = t33;
    $[80] = t34;
  } else {
    t29 = $[75];
    t30 = $[76];
    t31 = $[77];
    t32 = $[78];
    t33 = $[79];
    t34 = $[80];
  }
  let t35;
  if ($[81] !== announcement || $[82] !== config) {
    t35 = announcement && <Box paddingLeft={2} flexDirection="column">{!process.env.IS_DEMO && config.oauthAccount?.organizationName && <Text dimColor={true}>Message from {config.oauthAccount.organizationName}:</Text>}<Text>{announcement}</Text></Box>;
    $[81] = announcement;
    $[82] = config;
    $[83] = t35;
  } else {
    t35 = $[83];
  }
  let t36;
  if ($[84] !== showSandboxStatus) {
    t36 = showSandboxStatus && <Box paddingLeft={2} flexDirection="column"><Text color="warning">Your bash commands will be sandboxed. Disable with /sandbox.</Text></Box>;
    $[84] = showSandboxStatus;
    $[85] = t36;
  } else {
    t36 = $[85];
  }
  let t37;
  let t38;
  let t39;
  let t40;
  if ($[86] === Symbol.for("react.memo_cache_sentinel")) {
    t37 = false && !process.env.DEMO_VERSION && <Box paddingLeft={2} flexDirection="column"><Text dimColor={true}>Use /issue to report model behavior issues</Text></Box>;
    t38 = false && !process.env.DEMO_VERSION && <Box paddingLeft={2} flexDirection="column"><Text color="warning">[ANT-ONLY] Logs:</Text><Text dimColor={true}>API calls: {getDisplayPath(getDumpPromptsPath())}</Text><Text dimColor={true}>Debug logs: {getDisplayPath(getDebugLogPath())}</Text>{isDetailedProfilingEnabled() && <Text dimColor={true}>Startup Perf: {getDisplayPath(getStartupPerfLogPath())}</Text>}</Box>;
    t39 = false && <GateOverridesWarning />;
    t40 = false && <ExperimentEnrollmentNotice />;
    $[86] = t37;
    $[87] = t38;
    $[88] = t39;
    $[89] = t40;
  } else {
    t37 = $[86];
    t38 = $[87];
    t39 = $[88];
    t40 = $[89];
  }
  let t41;
  if ($[90] !== t28 || $[91] !== t35 || $[92] !== t36) {
    t41 = <>{t28}{t29}{t30}{t31}{t32}{t33}{t34}{t35}{t36}{t37}{t38}{t39}{t40}</>;
    $[90] = t28;
    $[91] = t35;
    $[92] = t36;
    $[93] = t41;
  } else {
    t41 = $[93];
  }
  return t41;
}
function _temp3(current) {
  if (current.lastReleaseNotesSeen === MACRO.VERSION) {
    return current;
  }
  return {
    ...current,
    lastReleaseNotesSeen: MACRO.VERSION
  };
}
function _temp2(s_0) {
  return s_0.effortValue;
}
function _temp(s) {
  return s.agent;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsIkJveCIsIlRleHQiLCJjb2xvciIsInVzZVRlcm1pbmFsU2l6ZSIsInN0cmluZ1dpZHRoIiwiZ2V0TGF5b3V0TW9kZSIsImNhbGN1bGF0ZUxheW91dERpbWVuc2lvbnMiLCJjYWxjdWxhdGVPcHRpbWFsTGVmdFdpZHRoIiwiZm9ybWF0V2VsY29tZU1lc3NhZ2UiLCJ0cnVuY2F0ZVBhdGgiLCJnZXRSZWNlbnRBY3Rpdml0eVN5bmMiLCJnZXRSZWNlbnRSZWxlYXNlTm90ZXNTeW5jIiwiZ2V0TG9nb0Rpc3BsYXlEYXRhIiwidHJ1bmNhdGUiLCJnZXREaXNwbGF5UGF0aCIsIkNsYXdkIiwiRmVlZENvbHVtbiIsImNyZWF0ZVJlY2VudEFjdGl2aXR5RmVlZCIsImNyZWF0ZVdoYXRzTmV3RmVlZCIsImNyZWF0ZVByb2plY3RPbmJvYXJkaW5nRmVlZCIsImNyZWF0ZUd1ZXN0UGFzc2VzRmVlZCIsImdldEdsb2JhbENvbmZpZyIsInNhdmVHbG9iYWxDb25maWciLCJyZXNvbHZlVGhlbWVTZXR0aW5nIiwiZ2V0SW5pdGlhbFNldHRpbmdzIiwiaXNEZWJ1Z01vZGUiLCJpc0RlYnVnVG9TdGRFcnIiLCJnZXREZWJ1Z0xvZ1BhdGgiLCJ1c2VFZmZlY3QiLCJ1c2VTdGF0ZSIsImdldFN0ZXBzIiwic2hvdWxkU2hvd1Byb2plY3RPbmJvYXJkaW5nIiwiaW5jcmVtZW50UHJvamVjdE9uYm9hcmRpbmdTZWVuQ291bnQiLCJDb25kZW5zZWRMb2dvIiwiT2Zmc2NyZWVuRnJlZXplIiwiY2hlY2tGb3JSZWxlYXNlTm90ZXNTeW5jIiwiZ2V0RHVtcFByb21wdHNQYXRoIiwiaXNFbnZUcnV0aHkiLCJnZXRTdGFydHVwUGVyZkxvZ1BhdGgiLCJpc0RldGFpbGVkUHJvZmlsaW5nRW5hYmxlZCIsIkVtZXJnZW5jeVRpcCIsIlZvaWNlTW9kZU5vdGljZSIsIk9wdXMxbU1lcmdlTm90aWNlIiwiZmVhdHVyZSIsIkNoYW5uZWxzTm90aWNlTW9kdWxlIiwicmVxdWlyZSIsIlNhbmRib3hNYW5hZ2VyIiwidXNlU2hvd0d1ZXN0UGFzc2VzVXBzZWxsIiwiaW5jcmVtZW50R3Vlc3RQYXNzZXNTZWVuQ291bnQiLCJ1c2VTaG93T3ZlcmFnZUNyZWRpdFVwc2VsbCIsImluY3JlbWVudE92ZXJhZ2VDcmVkaXRVcHNlbGxTZWVuQ291bnQiLCJjcmVhdGVPdmVyYWdlQ3JlZGl0RmVlZCIsInBsdXJhbCIsInVzZUFwcFN0YXRlIiwiZ2V0RWZmb3J0U3VmZml4IiwidXNlTWFpbkxvb3BNb2RlbCIsInJlbmRlck1vZGVsU2V0dGluZyIsIkxFRlRfUEFORUxfTUFYX1dJRFRIIiwiTG9nb1YyIiwiJCIsIl9jIiwiYWN0aXZpdGllcyIsInVzZXJuYW1lIiwib2F1dGhBY2NvdW50IiwiZGlzcGxheU5hbWUiLCJjb2x1bW5zIiwidDAiLCJTeW1ib2wiLCJmb3IiLCJzaG93T25ib2FyZGluZyIsInQxIiwiaXNTYW5kYm94aW5nRW5hYmxlZCIsInNob3dTYW5kYm94U3RhdHVzIiwic2hvd0d1ZXN0UGFzc2VzVXBzZWxsIiwic2hvd092ZXJhZ2VDcmVkaXRVcHNlbGwiLCJhZ2VudCIsIl90ZW1wIiwiZWZmb3J0VmFsdWUiLCJfdGVtcDIiLCJjb25maWciLCJjaGFuZ2Vsb2ciLCJhbm5vdW5jZW1lbnQiLCJhbm5vdW5jZW1lbnRzIiwiY29tcGFueUFubm91bmNlbWVudHMiLCJsZW5ndGgiLCJudW1TdGFydHVwcyIsIk1hdGgiLCJmbG9vciIsInJhbmRvbSIsImhhc1JlbGVhc2VOb3RlcyIsImxhc3RSZWxlYXNlTm90ZXNTZWVuIiwidDIiLCJjdXJyZW50Q29uZmlnIiwiTUFDUk8iLCJWRVJTSU9OIiwiX3RlbXAzIiwidDMiLCJ0NCIsInByb2Nlc3MiLCJlbnYiLCJDTEFVREVfQ09ERV9GT1JDRV9GVUxMX0xPR08iLCJpc0NvbmRlbnNlZE1vZGUiLCJ0NSIsInQ2IiwidDciLCJ0OCIsIm1vZGVsIiwiZnVsbE1vZGVsRGlzcGxheU5hbWUiLCJ2ZXJzaW9uIiwiY3dkIiwiYmlsbGluZ1R5cGUiLCJhZ2VudE5hbWUiLCJhZ2VudE5hbWVGcm9tU2V0dGluZ3MiLCJlZmZvcnRTdWZmaXgiLCJ0OSIsInQxMCIsIm1vZGVsRGlzcGxheU5hbWUiLCJ0MTEiLCJ0MTIiLCJ0MTMiLCJ0MTQiLCJ0MTUiLCJ0MTYiLCJ0MTciLCJDTEFVREVfQ09ERV9UTVVYX1NFU1NJT04iLCJDTEFVREVfQ09ERV9UTVVYX1BSRUZJWF9DT05GTElDVFMiLCJDTEFVREVfQ09ERV9UTVVYX1BSRUZJWCIsInQxOCIsIklTX0RFTU8iLCJvcmdhbml6YXRpb25OYW1lIiwidDE5IiwidDIwIiwidDIxIiwidDIyIiwiREVNT19WRVJTSU9OIiwidDIzIiwibGF5b3V0TW9kZSIsInVzZXJUaGVtZSIsInRoZW1lIiwiYm9yZGVyVGl0bGUiLCJjb21wYWN0Qm9yZGVyVGl0bGUiLCJ3ZWxjb21lTWVzc2FnZSIsImN3ZEF2YWlsYWJsZVdpZHRoIiwidHJ1bmNhdGVkQ3dkIiwibWF4IiwiY29udGVudCIsInBvc2l0aW9uIiwiYWxpZ24iLCJvZmZzZXQiLCJ3ZWxjb21lTWVzc2FnZV8wIiwibW9kZWxMaW5lIiwiY3dkQXZhaWxhYmxlV2lkdGhfMCIsInRydW5jYXRlZEN3ZF8wIiwiY3dkTGluZSIsIm9wdGltYWxMZWZ0V2lkdGgiLCJsZWZ0V2lkdGgiLCJyaWdodFdpZHRoIiwiVDAiLCJUMSIsIlQyIiwidDI0IiwidDI1IiwidDI2IiwidDI3IiwidDI4IiwidDI5IiwidDMwIiwidDMxIiwidDMyIiwidDMzIiwidDM0IiwidDM1IiwidDM2IiwidDM3IiwidDM4IiwidDM5IiwidDQwIiwidDQxIiwiY3VycmVudCIsInNfMCIsInMiXSwic291cmNlcyI6WyJMb2dvVjIudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8vIGJpb21lLWlnbm9yZS1hbGwgYXNzaXN0L3NvdXJjZS9vcmdhbml6ZUltcG9ydHM6IEFOVC1PTkxZIGltcG9ydCBtYXJrZXJzIG11c3Qgbm90IGJlIHJlb3JkZXJlZFxuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyBCb3gsIFRleHQsIGNvbG9yIH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuaW1wb3J0IHsgc3RyaW5nV2lkdGggfSBmcm9tICcuLi8uLi9pbmsvc3RyaW5nV2lkdGguanMnXG5pbXBvcnQge1xuICBnZXRMYXlvdXRNb2RlLFxuICBjYWxjdWxhdGVMYXlvdXREaW1lbnNpb25zLFxuICBjYWxjdWxhdGVPcHRpbWFsTGVmdFdpZHRoLFxuICBmb3JtYXRXZWxjb21lTWVzc2FnZSxcbiAgdHJ1bmNhdGVQYXRoLFxuICBnZXRSZWNlbnRBY3Rpdml0eVN5bmMsXG4gIGdldFJlY2VudFJlbGVhc2VOb3Rlc1N5bmMsXG4gIGdldExvZ29EaXNwbGF5RGF0YSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvbG9nb1YyVXRpbHMuanMnXG5pbXBvcnQgeyB0cnVuY2F0ZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Zvcm1hdC5qcydcbmltcG9ydCB7IGdldERpc3BsYXlQYXRoIH0gZnJvbSAnLi4vLi4vdXRpbHMvZmlsZS5qcydcbmltcG9ydCB7IENsYXdkIH0gZnJvbSAnLi9DbGF3ZC5qcydcbmltcG9ydCB7IEZlZWRDb2x1bW4gfSBmcm9tICcuL0ZlZWRDb2x1bW4uanMnXG5pbXBvcnQge1xuICBjcmVhdGVSZWNlbnRBY3Rpdml0eUZlZWQsXG4gIGNyZWF0ZVdoYXRzTmV3RmVlZCxcbiAgY3JlYXRlUHJvamVjdE9uYm9hcmRpbmdGZWVkLFxuICBjcmVhdGVHdWVzdFBhc3Nlc0ZlZWQsXG59IGZyb20gJy4vZmVlZENvbmZpZ3MuanMnXG5pbXBvcnQgeyBnZXRHbG9iYWxDb25maWcsIHNhdmVHbG9iYWxDb25maWcgfSBmcm9tICdzcmMvdXRpbHMvY29uZmlnLmpzJ1xuaW1wb3J0IHsgcmVzb2x2ZVRoZW1lU2V0dGluZyB9IGZyb20gJ3NyYy91dGlscy9zeXN0ZW1UaGVtZS5qcydcbmltcG9ydCB7IGdldEluaXRpYWxTZXR0aW5ncyB9IGZyb20gJ3NyYy91dGlscy9zZXR0aW5ncy9zZXR0aW5ncy5qcydcbmltcG9ydCB7XG4gIGlzRGVidWdNb2RlLFxuICBpc0RlYnVnVG9TdGRFcnIsXG4gIGdldERlYnVnTG9nUGF0aCxcbn0gZnJvbSAnc3JjL3V0aWxzL2RlYnVnLmpzJ1xuaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHtcbiAgZ2V0U3RlcHMsXG4gIHNob3VsZFNob3dQcm9qZWN0T25ib2FyZGluZyxcbiAgaW5jcmVtZW50UHJvamVjdE9uYm9hcmRpbmdTZWVuQ291bnQsXG59IGZyb20gJy4uLy4uL3Byb2plY3RPbmJvYXJkaW5nU3RhdGUuanMnXG5pbXBvcnQgeyBDb25kZW5zZWRMb2dvIH0gZnJvbSAnLi9Db25kZW5zZWRMb2dvLmpzJ1xuaW1wb3J0IHsgT2Zmc2NyZWVuRnJlZXplIH0gZnJvbSAnLi4vT2Zmc2NyZWVuRnJlZXplLmpzJ1xuaW1wb3J0IHsgY2hlY2tGb3JSZWxlYXNlTm90ZXNTeW5jIH0gZnJvbSAnLi4vLi4vdXRpbHMvcmVsZWFzZU5vdGVzLmpzJ1xuaW1wb3J0IHsgZ2V0RHVtcFByb21wdHNQYXRoIH0gZnJvbSAnc3JjL3NlcnZpY2VzL2FwaS9kdW1wUHJvbXB0cy5qcydcbmltcG9ydCB7IGlzRW52VHJ1dGh5IH0gZnJvbSAnc3JjL3V0aWxzL2VudlV0aWxzLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0U3RhcnR1cFBlcmZMb2dQYXRoLFxuICBpc0RldGFpbGVkUHJvZmlsaW5nRW5hYmxlZCxcbn0gZnJvbSAnc3JjL3V0aWxzL3N0YXJ0dXBQcm9maWxlci5qcydcbmltcG9ydCB7IEVtZXJnZW5jeVRpcCB9IGZyb20gJy4vRW1lcmdlbmN5VGlwLmpzJ1xuaW1wb3J0IHsgVm9pY2VNb2RlTm90aWNlIH0gZnJvbSAnLi9Wb2ljZU1vZGVOb3RpY2UuanMnXG5pbXBvcnQgeyBPcHVzMW1NZXJnZU5vdGljZSB9IGZyb20gJy4vT3B1czFtTWVyZ2VOb3RpY2UuanMnXG5pbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcblxuLy8gQ29uZGl0aW9uYWwgcmVxdWlyZSBzbyBDaGFubmVsc05vdGljZS50c3ggdHJlZS1zaGFrZXMgd2hlbiBib3RoIGZsYWdzIGFyZVxuLy8gZmFsc2UuIEEgbW9kdWxlLXNjb3BlIGhlbHBlciBjb21wb25lbnQgaW5zaWRlIGEgZmVhdHVyZSgpIHRlcm5hcnkgZG9lcyBOT1Rcbi8vIHRyZWUtc2hha2UgKGRvY3MvZmVhdHVyZS1nYXRpbmcubWQpOyB0aGUgcmVxdWlyZSBwYXR0ZXJuIGVsaW1pbmF0ZXMgdGhlXG4vLyB3aG9sZSBmaWxlLiBWb2ljZU1vZGVOb3RpY2UgdXNlcyB0aGUgdW5zYWZlIGhlbHBlciBwYXR0ZXJuIGJ1dCBWT0lDRV9NT0RFXG4vLyBpcyBleHRlcm5hbDogdHJ1ZSBzbyBpdCdzIG1vb3QgdGhlcmUuXG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5jb25zdCBDaGFubmVsc05vdGljZU1vZHVsZSA9XG4gIGZlYXR1cmUoJ0tBSVJPUycpIHx8IGZlYXR1cmUoJ0tBSVJPU19DSEFOTkVMUycpXG4gICAgPyAocmVxdWlyZSgnLi9DaGFubmVsc05vdGljZS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4vQ2hhbm5lbHNOb3RpY2UuanMnKSlcbiAgICA6IG51bGxcbi8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuaW1wb3J0IHsgU2FuZGJveE1hbmFnZXIgfSBmcm9tICdzcmMvdXRpbHMvc2FuZGJveC9zYW5kYm94LWFkYXB0ZXIuanMnXG5pbXBvcnQge1xuICB1c2VTaG93R3Vlc3RQYXNzZXNVcHNlbGwsXG4gIGluY3JlbWVudEd1ZXN0UGFzc2VzU2VlbkNvdW50LFxufSBmcm9tICcuL0d1ZXN0UGFzc2VzVXBzZWxsLmpzJ1xuaW1wb3J0IHtcbiAgdXNlU2hvd092ZXJhZ2VDcmVkaXRVcHNlbGwsXG4gIGluY3JlbWVudE92ZXJhZ2VDcmVkaXRVcHNlbGxTZWVuQ291bnQsXG4gIGNyZWF0ZU92ZXJhZ2VDcmVkaXRGZWVkLFxufSBmcm9tICcuL092ZXJhZ2VDcmVkaXRVcHNlbGwuanMnXG5pbXBvcnQgeyBwbHVyYWwgfSBmcm9tICcuLi8uLi91dGlscy9zdHJpbmdVdGlscy5qcydcbmltcG9ydCB7IHVzZUFwcFN0YXRlIH0gZnJvbSAnLi4vLi4vc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgeyBnZXRFZmZvcnRTdWZmaXggfSBmcm9tICcuLi8uLi91dGlscy9lZmZvcnQuanMnXG5pbXBvcnQgeyB1c2VNYWluTG9vcE1vZGVsIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlTWFpbkxvb3BNb2RlbC5qcydcbmltcG9ydCB7IHJlbmRlck1vZGVsU2V0dGluZyB9IGZyb20gJy4uLy4uL3V0aWxzL21vZGVsL21vZGVsLmpzJ1xuXG5jb25zdCBMRUZUX1BBTkVMX01BWF9XSURUSCA9IDUwXG5cbmV4cG9ydCBmdW5jdGlvbiBMb2dvVjIoKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgYWN0aXZpdGllcyA9IGdldFJlY2VudEFjdGl2aXR5U3luYygpXG4gIGNvbnN0IHVzZXJuYW1lID0gZ2V0R2xvYmFsQ29uZmlnKCkub2F1dGhBY2NvdW50Py5kaXNwbGF5TmFtZSA/PyAnJ1xuXG4gIGNvbnN0IHsgY29sdW1ucyB9ID0gdXNlVGVybWluYWxTaXplKClcbiAgY29uc3Qgc2hvd09uYm9hcmRpbmcgPSBzaG91bGRTaG93UHJvamVjdE9uYm9hcmRpbmcoKVxuICBjb25zdCBzaG93U2FuZGJveFN0YXR1cyA9IFNhbmRib3hNYW5hZ2VyLmlzU2FuZGJveGluZ0VuYWJsZWQoKVxuICBjb25zdCBzaG93R3Vlc3RQYXNzZXNVcHNlbGwgPSB1c2VTaG93R3Vlc3RQYXNzZXNVcHNlbGwoKVxuICBjb25zdCBzaG93T3ZlcmFnZUNyZWRpdFVwc2VsbCA9IHVzZVNob3dPdmVyYWdlQ3JlZGl0VXBzZWxsKClcbiAgY29uc3QgYWdlbnQgPSB1c2VBcHBTdGF0ZShzID0+IHMuYWdlbnQpXG4gIGNvbnN0IGVmZm9ydFZhbHVlID0gdXNlQXBwU3RhdGUocyA9PiBzLmVmZm9ydFZhbHVlKVxuXG4gIGNvbnN0IGNvbmZpZyA9IGdldEdsb2JhbENvbmZpZygpXG5cbiAgbGV0IGNoYW5nZWxvZzogc3RyaW5nW11cbiAgdHJ5IHtcbiAgICBjaGFuZ2Vsb2cgPSBnZXRSZWNlbnRSZWxlYXNlTm90ZXNTeW5jKDMpXG4gIH0gY2F0Y2gge1xuICAgIGNoYW5nZWxvZyA9IFtdXG4gIH1cblxuICAvLyBHZXQgY29tcGFueSBhbm5vdW5jZW1lbnRzIGFuZCBzZWxlY3Qgb25lOlxuICAvLyAtIEZpcnN0IHN0YXJ0dXAgKG51bVN0YXJ0dXBzID09PSAxKTogc2hvdyBmaXJzdCBhbm5vdW5jZW1lbnRcbiAgLy8gLSBBbGwgb3RoZXIgc3RhcnR1cHM6IHJhbmRvbWx5IHNlbGVjdCBmcm9tIGFubm91bmNlbWVudHNcbiAgY29uc3QgW2Fubm91bmNlbWVudF0gPSB1c2VTdGF0ZSgoKSA9PiB7XG4gICAgY29uc3QgYW5ub3VuY2VtZW50cyA9IGdldEluaXRpYWxTZXR0aW5ncygpLmNvbXBhbnlBbm5vdW5jZW1lbnRzXG4gICAgaWYgKCFhbm5vdW5jZW1lbnRzIHx8IGFubm91bmNlbWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gdW5kZWZpbmVkXG4gICAgcmV0dXJuIGNvbmZpZy5udW1TdGFydHVwcyA9PT0gMVxuICAgICAgPyBhbm5vdW5jZW1lbnRzWzBdXG4gICAgICA6IGFubm91bmNlbWVudHNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogYW5ub3VuY2VtZW50cy5sZW5ndGgpXVxuICB9KVxuICBjb25zdCB7IGhhc1JlbGVhc2VOb3RlcyB9ID0gY2hlY2tGb3JSZWxlYXNlTm90ZXNTeW5jKFxuICAgIGNvbmZpZy5sYXN0UmVsZWFzZU5vdGVzU2VlbixcbiAgKVxuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgY3VycmVudENvbmZpZyA9IGdldEdsb2JhbENvbmZpZygpXG4gICAgaWYgKGN1cnJlbnRDb25maWcubGFzdFJlbGVhc2VOb3Rlc1NlZW4gPT09IE1BQ1JPLlZFUlNJT04pIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4ge1xuICAgICAgaWYgKGN1cnJlbnQubGFzdFJlbGVhc2VOb3Rlc1NlZW4gPT09IE1BQ1JPLlZFUlNJT04pIHJldHVybiBjdXJyZW50XG4gICAgICByZXR1cm4geyAuLi5jdXJyZW50LCBsYXN0UmVsZWFzZU5vdGVzU2VlbjogTUFDUk8uVkVSU0lPTiB9XG4gICAgfSlcbiAgICBpZiAoc2hvd09uYm9hcmRpbmcpIHtcbiAgICAgIGluY3JlbWVudFByb2plY3RPbmJvYXJkaW5nU2VlbkNvdW50KClcbiAgICB9XG4gIH0sIFtjb25maWcsIHNob3dPbmJvYXJkaW5nXSlcblxuICAvLyBJbiBjb25kZW5zZWQgbW9kZSAoZWFybHktcmV0dXJuIGJlbG93IHJlbmRlcnMgPENvbmRlbnNlZExvZ28vPiksXG4gIC8vIENvbmRlbnNlZExvZ28ncyBvd24gdXNlRWZmZWN0IGhhbmRsZXMgdGhlIGltcHJlc3Npb24gY291bnQuIFNraXBwaW5nXG4gIC8vIGhlcmUgYXZvaWRzIGRvdWJsZS1jb3VudGluZyBzaW5jZSBob29rcyBmaXJlIGJlZm9yZSB0aGUgZWFybHkgcmV0dXJuLlxuICBjb25zdCBpc0NvbmRlbnNlZE1vZGUgPVxuICAgICFoYXNSZWxlYXNlTm90ZXMgJiZcbiAgICAhc2hvd09uYm9hcmRpbmcgJiZcbiAgICAhaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfRk9SQ0VfRlVMTF9MT0dPKVxuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKHNob3dHdWVzdFBhc3Nlc1Vwc2VsbCAmJiAhc2hvd09uYm9hcmRpbmcgJiYgIWlzQ29uZGVuc2VkTW9kZSkge1xuICAgICAgaW5jcmVtZW50R3Vlc3RQYXNzZXNTZWVuQ291bnQoKVxuICAgIH1cbiAgfSwgW3Nob3dHdWVzdFBhc3Nlc1Vwc2VsbCwgc2hvd09uYm9hcmRpbmcsIGlzQ29uZGVuc2VkTW9kZV0pXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoXG4gICAgICBzaG93T3ZlcmFnZUNyZWRpdFVwc2VsbCAmJlxuICAgICAgIXNob3dPbmJvYXJkaW5nICYmXG4gICAgICAhc2hvd0d1ZXN0UGFzc2VzVXBzZWxsICYmXG4gICAgICAhaXNDb25kZW5zZWRNb2RlXG4gICAgKSB7XG4gICAgICBpbmNyZW1lbnRPdmVyYWdlQ3JlZGl0VXBzZWxsU2VlbkNvdW50KClcbiAgICB9XG4gIH0sIFtcbiAgICBzaG93T3ZlcmFnZUNyZWRpdFVwc2VsbCxcbiAgICBzaG93T25ib2FyZGluZyxcbiAgICBzaG93R3Vlc3RQYXNzZXNVcHNlbGwsXG4gICAgaXNDb25kZW5zZWRNb2RlLFxuICBdKVxuXG4gIGNvbnN0IG1vZGVsID0gdXNlTWFpbkxvb3BNb2RlbCgpXG4gIGNvbnN0IGZ1bGxNb2RlbERpc3BsYXlOYW1lID0gcmVuZGVyTW9kZWxTZXR0aW5nKG1vZGVsKVxuICBjb25zdCB7XG4gICAgdmVyc2lvbixcbiAgICBjd2QsXG4gICAgYmlsbGluZ1R5cGUsXG4gICAgYWdlbnROYW1lOiBhZ2VudE5hbWVGcm9tU2V0dGluZ3MsXG4gIH0gPSBnZXRMb2dvRGlzcGxheURhdGEoKVxuICAvLyBQcmVmZXIgQXBwU3RhdGUuYWdlbnQgKHNldCBmcm9tIC0tYWdlbnQgQ0xJIGZsYWcpIG92ZXIgc2V0dGluZ3NcbiAgY29uc3QgYWdlbnROYW1lID0gYWdlbnQgPz8gYWdlbnROYW1lRnJvbVNldHRpbmdzXG4gIC8vIC0yMCB0byBhY2NvdW50IGZvciB0aGUgbWF4IGxlbmd0aCBvZiBzdWJzY3JpcHRpb24gbmFtZSBcIiDCtyBDbGF1ZGUgRW50ZXJwcmlzZVwiLlxuICBjb25zdCBlZmZvcnRTdWZmaXggPSBnZXRFZmZvcnRTdWZmaXgobW9kZWwsIGVmZm9ydFZhbHVlKVxuICBjb25zdCBtb2RlbERpc3BsYXlOYW1lID0gdHJ1bmNhdGUoXG4gICAgZnVsbE1vZGVsRGlzcGxheU5hbWUgKyBlZmZvcnRTdWZmaXgsXG4gICAgTEVGVF9QQU5FTF9NQVhfV0lEVEggLSAyMCxcbiAgKVxuXG4gIC8vIFNob3cgY29uZGVuc2VkIGxvZ28gaWYgbm8gbmV3IGNoYW5nZWxvZyBhbmQgbm90IHNob3dpbmcgb25ib2FyZGluZyBhbmQgbm90IGZvcmNpbmcgZnVsbCBsb2dvXG4gIGlmIChcbiAgICAhaGFzUmVsZWFzZU5vdGVzICYmXG4gICAgIXNob3dPbmJvYXJkaW5nICYmXG4gICAgIWlzRW52VHJ1dGh5KHByb2Nlc3MuZW52LkNMQVVERV9DT0RFX0ZPUkNFX0ZVTExfTE9HTylcbiAgKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDw+XG4gICAgICAgIDxDb25kZW5zZWRMb2dvIC8+XG4gICAgICAgIDxWb2ljZU1vZGVOb3RpY2UgLz5cbiAgICAgICAgPE9wdXMxbU1lcmdlTm90aWNlIC8+XG4gICAgICAgIHtDaGFubmVsc05vdGljZU1vZHVsZSAmJiA8Q2hhbm5lbHNOb3RpY2VNb2R1bGUuQ2hhbm5lbHNOb3RpY2UgLz59XG4gICAgICAgIHtpc0RlYnVnTW9kZSgpICYmIChcbiAgICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5EZWJ1ZyBtb2RlIGVuYWJsZWQ8L1RleHQ+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgTG9nZ2luZyB0bzoge2lzRGVidWdUb1N0ZEVycigpID8gJ3N0ZGVycicgOiBnZXREZWJ1Z0xvZ1BhdGgoKX1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgICAgPEVtZXJnZW5jeVRpcCAvPlxuICAgICAgICB7cHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfVE1VWF9TRVNTSU9OICYmIChcbiAgICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgdG11eCBzZXNzaW9uOiB7cHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfVE1VWF9TRVNTSU9OfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIHtwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9UTVVYX1BSRUZJWF9DT05GTElDVFNcbiAgICAgICAgICAgICAgICA/IGBEZXRhY2g6ICR7cHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfVE1VWF9QUkVGSVh9ICR7cHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfVE1VWF9QUkVGSVh9IGQgKHByZXNzIHByZWZpeCB0d2ljZSAtIENsYXVkZSB1c2VzICR7cHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfVE1VWF9QUkVGSVh9KWBcbiAgICAgICAgICAgICAgICA6IGBEZXRhY2g6ICR7cHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfVE1VWF9QUkVGSVh9IGRgfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuICAgICAgICB7YW5ub3VuY2VtZW50ICYmIChcbiAgICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICB7IXByb2Nlc3MuZW52LklTX0RFTU8gJiYgY29uZmlnLm9hdXRoQWNjb3VudD8ub3JnYW5pemF0aW9uTmFtZSAmJiAoXG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgIE1lc3NhZ2UgZnJvbSB7Y29uZmlnLm9hdXRoQWNjb3VudC5vcmdhbml6YXRpb25OYW1lfTpcbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDxUZXh0Pnthbm5vdW5jZW1lbnR9PC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuICAgICAgICB7XCJleHRlcm5hbFwiID09PSAnYW50JyAmJiAhcHJvY2Vzcy5lbnYuREVNT19WRVJTSU9OICYmIChcbiAgICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5Vc2UgL2lzc3VlIHRvIHJlcG9ydCBtb2RlbCBiZWhhdmlvciBpc3N1ZXM8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG4gICAgICAgIHtcImV4dGVybmFsXCIgPT09ICdhbnQnICYmICFwcm9jZXNzLmVudi5ERU1PX1ZFUlNJT04gJiYgKFxuICAgICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezJ9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPltBTlQtT05MWV0gTG9nczo8L1RleHQ+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgQVBJIGNhbGxzOiB7Z2V0RGlzcGxheVBhdGgoZ2V0RHVtcFByb21wdHNQYXRoKCkpfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIERlYnVnIGxvZ3M6IHtnZXREaXNwbGF5UGF0aChnZXREZWJ1Z0xvZ1BhdGgoKSl9XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICB7aXNEZXRhaWxlZFByb2ZpbGluZ0VuYWJsZWQoKSAmJiAoXG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgIFN0YXJ0dXAgUGVyZjoge2dldERpc3BsYXlQYXRoKGdldFN0YXJ0dXBQZXJmTG9nUGF0aCgpKX1cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgICAge1wiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgPEdhdGVPdmVycmlkZXNXYXJuaW5nIC8+fVxuICAgICAgICB7XCJleHRlcm5hbFwiID09PSAnYW50JyAmJiA8RXhwZXJpbWVudEVucm9sbG1lbnROb3RpY2UgLz59XG4gICAgICA8Lz5cbiAgICApXG4gIH1cblxuICAvLyBDYWxjdWxhdGUgbGF5b3V0IGFuZCBkaXNwbGF5IHZhbHVlc1xuICBjb25zdCBsYXlvdXRNb2RlID0gZ2V0TGF5b3V0TW9kZShjb2x1bW5zKVxuXG4gIGNvbnN0IHVzZXJUaGVtZSA9IHJlc29sdmVUaGVtZVNldHRpbmcoZ2V0R2xvYmFsQ29uZmlnKCkudGhlbWUpXG4gIGNvbnN0IGJvcmRlclRpdGxlID0gYCAke2NvbG9yKCdjbGF1ZGUnLCB1c2VyVGhlbWUpKCdDbGF1ZGUgQ29kZScpfSAke2NvbG9yKCdpbmFjdGl2ZScsIHVzZXJUaGVtZSkoYHYke3ZlcnNpb259YCl9IGBcbiAgY29uc3QgY29tcGFjdEJvcmRlclRpdGxlID0gY29sb3IoJ2NsYXVkZScsIHVzZXJUaGVtZSkoJyBDbGF1ZGUgQ29kZSAnKVxuXG4gIC8vIEVhcmx5IHJldHVybiBmb3IgY29tcGFjdCBtb2RlXG4gIGlmIChsYXlvdXRNb2RlID09PSAnY29tcGFjdCcpIHtcbiAgICBjb25zdCBsYXlvdXRXaWR0aCA9IDQgLy8gYm9yZGVyICsgcGFkZGluZ1xuICAgIGxldCB3ZWxjb21lTWVzc2FnZSA9IGZvcm1hdFdlbGNvbWVNZXNzYWdlKHVzZXJuYW1lKVxuICAgIGlmIChzdHJpbmdXaWR0aCh3ZWxjb21lTWVzc2FnZSkgPiBjb2x1bW5zIC0gbGF5b3V0V2lkdGgpIHtcbiAgICAgIHdlbGNvbWVNZXNzYWdlID0gZm9ybWF0V2VsY29tZU1lc3NhZ2UobnVsbClcbiAgICB9XG5cbiAgICAvLyBDYWxjdWxhdGUgY3dkIHdpZHRoIGFjY291bnRpbmcgZm9yIGFnZW50IG5hbWUgaWYgcHJlc2VudFxuICAgIGNvbnN0IHNlcGFyYXRvciA9ICcgwrcgJ1xuICAgIGNvbnN0IGF0UHJlZml4ID0gJ0AnXG4gICAgY29uc3QgY3dkQXZhaWxhYmxlV2lkdGggPSBhZ2VudE5hbWVcbiAgICAgID8gY29sdW1ucyAtXG4gICAgICAgIGxheW91dFdpZHRoIC1cbiAgICAgICAgYXRQcmVmaXgubGVuZ3RoIC1cbiAgICAgICAgc3RyaW5nV2lkdGgoYWdlbnROYW1lKSAtXG4gICAgICAgIHNlcGFyYXRvci5sZW5ndGhcbiAgICAgIDogY29sdW1ucyAtIGxheW91dFdpZHRoXG4gICAgY29uc3QgdHJ1bmNhdGVkQ3dkID0gdHJ1bmNhdGVQYXRoKGN3ZCwgTWF0aC5tYXgoY3dkQXZhaWxhYmxlV2lkdGgsIDEwKSlcbiAgICAvLyBPZmZzY3JlZW5GcmVlemU6IGxvZ28gaXMgdGhlIGZpcnN0IHRoaW5nIHRvIGVudGVyIHNjcm9sbGJhY2s7IHVzZU1haW5Mb29wTW9kZWwoKVxuICAgIC8vIHN1YnNjcmliZXMgdG8gbW9kZWwgY2hhbmdlcyBhbmQgZ2V0TG9nb0Rpc3BsYXlEYXRhKCkgcmVhZHMgY3dkL3N1YnNjcmlwdGlvbiDigJRcbiAgICAvLyBhbnkgY2hhbmdlIHdoaWxlIGluIHNjcm9sbGJhY2sgZm9yY2VzIGEgZnVsbCByZXNldC5cbiAgICByZXR1cm4gKFxuICAgICAgPD5cbiAgICAgICAgPE9mZnNjcmVlbkZyZWV6ZT5cbiAgICAgICAgICA8Qm94XG4gICAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICAgIGJvcmRlclN0eWxlPVwicm91bmRcIlxuICAgICAgICAgICAgYm9yZGVyQ29sb3I9XCJjbGF1ZGVcIlxuICAgICAgICAgICAgYm9yZGVyVGV4dD17e1xuICAgICAgICAgICAgICBjb250ZW50OiBjb21wYWN0Qm9yZGVyVGl0bGUsXG4gICAgICAgICAgICAgIHBvc2l0aW9uOiAndG9wJyxcbiAgICAgICAgICAgICAgYWxpZ246ICdzdGFydCcsXG4gICAgICAgICAgICAgIG9mZnNldDogMSxcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgICBwYWRkaW5nWD17MX1cbiAgICAgICAgICAgIHBhZGRpbmdZPXsxfVxuICAgICAgICAgICAgYWxpZ25JdGVtcz1cImNlbnRlclwiXG4gICAgICAgICAgICB3aWR0aD17Y29sdW1uc31cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8VGV4dCBib2xkPnt3ZWxjb21lTWVzc2FnZX08L1RleHQ+XG4gICAgICAgICAgICA8Qm94IG1hcmdpblk9ezF9PlxuICAgICAgICAgICAgICA8Q2xhd2QgLz5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e21vZGVsRGlzcGxheU5hbWV9PC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2JpbGxpbmdUeXBlfTwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICB7YWdlbnROYW1lID8gYEAke2FnZW50TmFtZX0gwrcgJHt0cnVuY2F0ZWRDd2R9YCA6IHRydW5jYXRlZEN3ZH1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgPC9PZmZzY3JlZW5GcmVlemU+XG4gICAgICAgIDxWb2ljZU1vZGVOb3RpY2UgLz5cbiAgICAgICAgPE9wdXMxbU1lcmdlTm90aWNlIC8+XG4gICAgICAgIHtDaGFubmVsc05vdGljZU1vZHVsZSAmJiA8Q2hhbm5lbHNOb3RpY2VNb2R1bGUuQ2hhbm5lbHNOb3RpY2UgLz59XG4gICAgICAgIHtzaG93U2FuZGJveFN0YXR1cyAmJiAoXG4gICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgICAgICBZb3VyIGJhc2ggY29tbWFuZHMgd2lsbCBiZSBzYW5kYm94ZWQuIERpc2FibGUgd2l0aCAvc2FuZGJveC5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgICAge1wiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgPEdhdGVPdmVycmlkZXNXYXJuaW5nIC8+fVxuICAgICAgICB7XCJleHRlcm5hbFwiID09PSAnYW50JyAmJiA8RXhwZXJpbWVudEVucm9sbG1lbnROb3RpY2UgLz59XG4gICAgICA8Lz5cbiAgICApXG4gIH1cblxuICBjb25zdCB3ZWxjb21lTWVzc2FnZSA9IGZvcm1hdFdlbGNvbWVNZXNzYWdlKHVzZXJuYW1lKVxuICBjb25zdCBtb2RlbExpbmUgPVxuICAgICFwcm9jZXNzLmVudi5JU19ERU1PICYmIGNvbmZpZy5vYXV0aEFjY291bnQ/Lm9yZ2FuaXphdGlvbk5hbWVcbiAgICAgID8gYCR7bW9kZWxEaXNwbGF5TmFtZX0gwrcgJHtiaWxsaW5nVHlwZX0gwrcgJHtjb25maWcub2F1dGhBY2NvdW50Lm9yZ2FuaXphdGlvbk5hbWV9YFxuICAgICAgOiBgJHttb2RlbERpc3BsYXlOYW1lfSDCtyAke2JpbGxpbmdUeXBlfWBcbiAgLy8gQ2FsY3VsYXRlIGN3ZCB3aWR0aCBhY2NvdW50aW5nIGZvciBhZ2VudCBuYW1lIGlmIHByZXNlbnRcbiAgY29uc3QgY3dkU2VwYXJhdG9yID0gJyDCtyAnXG4gIGNvbnN0IGN3ZEF0UHJlZml4ID0gJ0AnXG4gIGNvbnN0IGN3ZEF2YWlsYWJsZVdpZHRoID0gYWdlbnROYW1lXG4gICAgPyBMRUZUX1BBTkVMX01BWF9XSURUSCAtXG4gICAgICBjd2RBdFByZWZpeC5sZW5ndGggLVxuICAgICAgc3RyaW5nV2lkdGgoYWdlbnROYW1lKSAtXG4gICAgICBjd2RTZXBhcmF0b3IubGVuZ3RoXG4gICAgOiBMRUZUX1BBTkVMX01BWF9XSURUSFxuICBjb25zdCB0cnVuY2F0ZWRDd2QgPSB0cnVuY2F0ZVBhdGgoY3dkLCBNYXRoLm1heChjd2RBdmFpbGFibGVXaWR0aCwgMTApKVxuICBjb25zdCBjd2RMaW5lID0gYWdlbnROYW1lID8gYEAke2FnZW50TmFtZX0gwrcgJHt0cnVuY2F0ZWRDd2R9YCA6IHRydW5jYXRlZEN3ZFxuICBjb25zdCBvcHRpbWFsTGVmdFdpZHRoID0gY2FsY3VsYXRlT3B0aW1hbExlZnRXaWR0aChcbiAgICB3ZWxjb21lTWVzc2FnZSxcbiAgICBjd2RMaW5lLFxuICAgIG1vZGVsTGluZSxcbiAgKVxuXG4gIC8vIENhbGN1bGF0ZSBsYXlvdXQgZGltZW5zaW9uc1xuICBjb25zdCB7IGxlZnRXaWR0aCwgcmlnaHRXaWR0aCB9ID0gY2FsY3VsYXRlTGF5b3V0RGltZW5zaW9ucyhcbiAgICBjb2x1bW5zLFxuICAgIGxheW91dE1vZGUsXG4gICAgb3B0aW1hbExlZnRXaWR0aCxcbiAgKVxuXG4gIHJldHVybiAoXG4gICAgPD5cbiAgICAgIDxPZmZzY3JlZW5GcmVlemU+XG4gICAgICAgIDxCb3hcbiAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICBib3JkZXJTdHlsZT1cInJvdW5kXCJcbiAgICAgICAgICBib3JkZXJDb2xvcj1cImNsYXVkZVwiXG4gICAgICAgICAgYm9yZGVyVGV4dD17e1xuICAgICAgICAgICAgY29udGVudDogYm9yZGVyVGl0bGUsXG4gICAgICAgICAgICBwb3NpdGlvbjogJ3RvcCcsXG4gICAgICAgICAgICBhbGlnbjogJ3N0YXJ0JyxcbiAgICAgICAgICAgIG9mZnNldDogMyxcbiAgICAgICAgICB9fVxuICAgICAgICA+XG4gICAgICAgICAgey8qIE1haW4gY29udGVudCAqL31cbiAgICAgICAgICA8Qm94XG4gICAgICAgICAgICBmbGV4RGlyZWN0aW9uPXtsYXlvdXRNb2RlID09PSAnaG9yaXpvbnRhbCcgPyAncm93JyA6ICdjb2x1bW4nfVxuICAgICAgICAgICAgcGFkZGluZ1g9ezF9XG4gICAgICAgICAgICBnYXA9ezF9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgey8qIExlZnQgUGFuZWwgKi99XG4gICAgICAgICAgICA8Qm94XG4gICAgICAgICAgICAgIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIlxuICAgICAgICAgICAgICB3aWR0aD17bGVmdFdpZHRofVxuICAgICAgICAgICAgICBqdXN0aWZ5Q29udGVudD1cInNwYWNlLWJldHdlZW5cIlxuICAgICAgICAgICAgICBhbGlnbkl0ZW1zPVwiY2VudGVyXCJcbiAgICAgICAgICAgICAgbWluSGVpZ2h0PXs5fVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICAgICAgPFRleHQgYm9sZD57d2VsY29tZU1lc3NhZ2V9PC9UZXh0PlxuICAgICAgICAgICAgICA8L0JveD5cblxuICAgICAgICAgICAgICA8Q2xhd2QgLz5cblxuICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBhbGlnbkl0ZW1zPVwiY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e21vZGVsTGluZX08L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2N3ZExpbmV9PC9UZXh0PlxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgIDwvQm94PlxuXG4gICAgICAgICAgICB7LyogVmVydGljYWwgZGl2aWRlciAqL31cbiAgICAgICAgICAgIHtsYXlvdXRNb2RlID09PSAnaG9yaXpvbnRhbCcgJiYgKFxuICAgICAgICAgICAgICA8Qm94XG4gICAgICAgICAgICAgICAgaGVpZ2h0PVwiMTAwJVwiXG4gICAgICAgICAgICAgICAgYm9yZGVyU3R5bGU9XCJzaW5nbGVcIlxuICAgICAgICAgICAgICAgIGJvcmRlckNvbG9yPVwiY2xhdWRlXCJcbiAgICAgICAgICAgICAgICBib3JkZXJEaW1Db2xvclxuICAgICAgICAgICAgICAgIGJvcmRlclRvcD17ZmFsc2V9XG4gICAgICAgICAgICAgICAgYm9yZGVyQm90dG9tPXtmYWxzZX1cbiAgICAgICAgICAgICAgICBib3JkZXJMZWZ0PXtmYWxzZX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICl9XG5cbiAgICAgICAgICAgIHsvKiBSaWdodCBQYW5lbCAtIFByb2plY3QgT25ib2FyZGluZyBvciBSZWNlbnQgQWN0aXZpdHkgYW5kIFdoYXQncyBOZXcgKi99XG4gICAgICAgICAgICB7bGF5b3V0TW9kZSA9PT0gJ2hvcml6b250YWwnICYmIChcbiAgICAgICAgICAgICAgPEZlZWRDb2x1bW5cbiAgICAgICAgICAgICAgICBmZWVkcz17XG4gICAgICAgICAgICAgICAgICBzaG93T25ib2FyZGluZ1xuICAgICAgICAgICAgICAgICAgICA/IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZVByb2plY3RPbmJvYXJkaW5nRmVlZChnZXRTdGVwcygpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZVJlY2VudEFjdGl2aXR5RmVlZChhY3Rpdml0aWVzKSxcbiAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIDogc2hvd0d1ZXN0UGFzc2VzVXBzZWxsXG4gICAgICAgICAgICAgICAgICAgICAgPyBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZVJlY2VudEFjdGl2aXR5RmVlZChhY3Rpdml0aWVzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlR3Vlc3RQYXNzZXNGZWVkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgOiBzaG93T3ZlcmFnZUNyZWRpdFVwc2VsbFxuICAgICAgICAgICAgICAgICAgICAgICAgPyBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlUmVjZW50QWN0aXZpdHlGZWVkKGFjdGl2aXRpZXMpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZU92ZXJhZ2VDcmVkaXRGZWVkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgIDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZVJlY2VudEFjdGl2aXR5RmVlZChhY3Rpdml0aWVzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVXaGF0c05ld0ZlZWQoY2hhbmdlbG9nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtYXhXaWR0aD17cmlnaHRXaWR0aH1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9PZmZzY3JlZW5GcmVlemU+XG4gICAgICA8Vm9pY2VNb2RlTm90aWNlIC8+XG4gICAgICA8T3B1czFtTWVyZ2VOb3RpY2UgLz5cbiAgICAgIHtDaGFubmVsc05vdGljZU1vZHVsZSAmJiA8Q2hhbm5lbHNOb3RpY2VNb2R1bGUuQ2hhbm5lbHNOb3RpY2UgLz59XG4gICAgICB7aXNEZWJ1Z01vZGUoKSAmJiAoXG4gICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezJ9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5EZWJ1ZyBtb2RlIGVuYWJsZWQ8L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICBMb2dnaW5nIHRvOiB7aXNEZWJ1Z1RvU3RkRXJyKCkgPyAnc3RkZXJyJyA6IGdldERlYnVnTG9nUGF0aCgpfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuICAgICAgPEVtZXJnZW5jeVRpcCAvPlxuICAgICAge3Byb2Nlc3MuZW52LkNMQVVERV9DT0RFX1RNVVhfU0VTU0lPTiAmJiAoXG4gICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezJ9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIHRtdXggc2Vzc2lvbjoge3Byb2Nlc3MuZW52LkNMQVVERV9DT0RFX1RNVVhfU0VTU0lPTn1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICB7cHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfVE1VWF9QUkVGSVhfQ09ORkxJQ1RTXG4gICAgICAgICAgICAgID8gYERldGFjaDogJHtwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9UTVVYX1BSRUZJWH0gJHtwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9UTVVYX1BSRUZJWH0gZCAocHJlc3MgcHJlZml4IHR3aWNlIC0gQ2xhdWRlIHVzZXMgJHtwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9UTVVYX1BSRUZJWH0pYFxuICAgICAgICAgICAgICA6IGBEZXRhY2g6ICR7cHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfVE1VWF9QUkVGSVh9IGRgfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuICAgICAge2Fubm91bmNlbWVudCAmJiAoXG4gICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezJ9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICB7IXByb2Nlc3MuZW52LklTX0RFTU8gJiYgY29uZmlnLm9hdXRoQWNjb3VudD8ub3JnYW5pemF0aW9uTmFtZSAmJiAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgTWVzc2FnZSBmcm9tIHtjb25maWcub2F1dGhBY2NvdW50Lm9yZ2FuaXphdGlvbk5hbWV9OlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICl9XG4gICAgICAgICAgPFRleHQ+e2Fubm91bmNlbWVudH08L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIHtzaG93U2FuZGJveFN0YXR1cyAmJiAoXG4gICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezJ9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5cbiAgICAgICAgICAgIFlvdXIgYmFzaCBjb21tYW5kcyB3aWxsIGJlIHNhbmRib3hlZC4gRGlzYWJsZSB3aXRoIC9zYW5kYm94LlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuICAgICAge1wiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgIXByb2Nlc3MuZW52LkRFTU9fVkVSU0lPTiAmJiAoXG4gICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezJ9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5Vc2UgL2lzc3VlIHRvIHJlcG9ydCBtb2RlbCBiZWhhdmlvciBpc3N1ZXM8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIHtcImV4dGVybmFsXCIgPT09ICdhbnQnICYmICFwcm9jZXNzLmVudi5ERU1PX1ZFUlNJT04gJiYgKFxuICAgICAgICA8Qm94IHBhZGRpbmdMZWZ0PXsyfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJ3YXJuaW5nXCI+W0FOVC1PTkxZXSBMb2dzOjwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIEFQSSBjYWxsczoge2dldERpc3BsYXlQYXRoKGdldER1bXBQcm9tcHRzUGF0aCgpKX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+RGVidWcgbG9nczoge2dldERpc3BsYXlQYXRoKGdldERlYnVnTG9nUGF0aCgpKX08L1RleHQ+XG4gICAgICAgICAge2lzRGV0YWlsZWRQcm9maWxpbmdFbmFibGVkKCkgJiYgKFxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIFN0YXJ0dXAgUGVyZjoge2dldERpc3BsYXlQYXRoKGdldFN0YXJ0dXBQZXJmTG9nUGF0aCgpKX1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG4gICAgICB7XCJleHRlcm5hbFwiID09PSAnYW50JyAmJiA8R2F0ZU92ZXJyaWRlc1dhcm5pbmcgLz59XG4gICAgICB7XCJleHRlcm5hbFwiID09PSAnYW50JyAmJiA8RXhwZXJpbWVudEVucm9sbG1lbnROb3RpY2UgLz59XG4gICAgPC8+XG4gIClcbn1cblxuIl0sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQSxPQUFPLEtBQUtBLEtBQUssTUFBTSxPQUFPO0FBQzlCLFNBQVNDLEdBQUcsRUFBRUMsSUFBSSxFQUFFQyxLQUFLLFFBQVEsY0FBYztBQUMvQyxTQUFTQyxlQUFlLFFBQVEsZ0NBQWdDO0FBQ2hFLFNBQVNDLFdBQVcsUUFBUSwwQkFBMEI7QUFDdEQsU0FDRUMsYUFBYSxFQUNiQyx5QkFBeUIsRUFDekJDLHlCQUF5QixFQUN6QkMsb0JBQW9CLEVBQ3BCQyxZQUFZLEVBQ1pDLHFCQUFxQixFQUNyQkMseUJBQXlCLEVBQ3pCQyxrQkFBa0IsUUFDYiw0QkFBNEI7QUFDbkMsU0FBU0MsUUFBUSxRQUFRLHVCQUF1QjtBQUNoRCxTQUFTQyxjQUFjLFFBQVEscUJBQXFCO0FBQ3BELFNBQVNDLEtBQUssUUFBUSxZQUFZO0FBQ2xDLFNBQVNDLFVBQVUsUUFBUSxpQkFBaUI7QUFDNUMsU0FDRUMsd0JBQXdCLEVBQ3hCQyxrQkFBa0IsRUFDbEJDLDJCQUEyQixFQUMzQkMscUJBQXFCLFFBQ2hCLGtCQUFrQjtBQUN6QixTQUFTQyxlQUFlLEVBQUVDLGdCQUFnQixRQUFRLHFCQUFxQjtBQUN2RSxTQUFTQyxtQkFBbUIsUUFBUSwwQkFBMEI7QUFDOUQsU0FBU0Msa0JBQWtCLFFBQVEsZ0NBQWdDO0FBQ25FLFNBQ0VDLFdBQVcsRUFDWEMsZUFBZSxFQUNmQyxlQUFlLFFBQ1Ysb0JBQW9CO0FBQzNCLFNBQVNDLFNBQVMsRUFBRUMsUUFBUSxRQUFRLE9BQU87QUFDM0MsU0FDRUMsUUFBUSxFQUNSQywyQkFBMkIsRUFDM0JDLG1DQUFtQyxRQUM5QixpQ0FBaUM7QUFD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