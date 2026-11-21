import { c as _c } from "react/compiler-runtime";
// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { feature } from 'bun:bundle';
import { Box, Text, useTheme, useThemeSetting, useTerminalFocus } from '../../ink.js';
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js';
import * as React from 'react';
import { useState, useCallback } from 'react';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding.js';
import figures from 'figures';
import { type GlobalConfig, saveGlobalConfig, getCurrentProjectConfig, type OutputStyle } from '../../utils/config.js';
import { normalizeApiKeyForConfig } from '../../utils/authPortable.js';
import { getGlobalConfig, getAutoUpdaterDisabledReason, formatAutoUpdaterDisabledReason, getRemoteControlAtStartup } from '../../utils/config.js';
import chalk from 'chalk';
import { permissionModeTitle, permissionModeFromString, toExternalPermissionMode, isExternalPermissionMode, EXTERNAL_PERMISSION_MODES, PERMISSION_MODES, type ExternalPermissionMode, type PermissionMode } from '../../utils/permissions/PermissionMode.js';
import { getAutoModeEnabledState, hasAutoModeOptInAnySource, transitionPlanAutoMode } from '../../utils/permissions/permissionSetup.js';
import { logError } from '../../utils/log.js';
import { logEvent, type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from 'src/services/analytics/index.js';
import { isBridgeEnabled } from '../../bridge/bridgeEnabled.js';
import { ThemePicker } from '../ThemePicker.js';
import { useAppState, useSetAppState, useAppStateStore } from '../../state/AppState.js';
import { ModelPicker } from '../ModelPicker.js';
import { modelDisplayString, isOpus1mMergeEnabled } from '../../utils/model/model.js';
import { isBilledAsExtraUsage } from '../../utils/extraUsage.js';
import { ClaudeMdExternalIncludesDialog } from '../ClaudeMdExternalIncludesDialog.js';
import { ChannelDowngradeDialog, type ChannelDowngradeChoice } from '../ChannelDowngradeDialog.js';
import { Dialog } from '../design-system/Dialog.js';
import { Select } from '../CustomSelect/index.js';
import { OutputStylePicker } from '../OutputStylePicker.js';
import { LanguagePicker } from '../LanguagePicker.js';
import { getExternalClaudeMdIncludes, getMemoryFiles, hasExternalClaudeMdIncludes } from 'src/utils/claudemd.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js';
import { Byline } from '../design-system/Byline.js';
import { useTabHeaderFocus } from '../design-system/Tabs.js';
import { useIsInsideModal } from '../../context/modalContext.js';
import { SearchBox } from '../SearchBox.js';
import { isSupportedTerminal, hasAccessToIDEExtensionDiffFeature } from '../../utils/ide.js';
import { getInitialSettings, getSettingsForSource, updateSettingsForSource } from '../../utils/settings/settings.js';
import { getUserMsgOptIn, setUserMsgOptIn } from '../../bootstrap/state.js';
import { DEFAULT_OUTPUT_STYLE_NAME } from 'src/constants/outputStyles.js';
import { isEnvTruthy, isRunningOnHomespace } from 'src/utils/envUtils.js';
import type { LocalJSXCommandContext, CommandResultDisplay } from '../../commands.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js';
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js';
import { getCliTeammateModeOverride, clearCliTeammateModeOverride } from '../../utils/swarm/backends/teammateModeSnapshot.js';
import { getHardcodedTeammateModelFallback } from '../../utils/swarm/teammateModel.js';
import { useSearchInput } from '../../hooks/useSearchInput.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { clearFastModeCooldown, FAST_MODE_MODEL_DISPLAY, isFastModeAvailable, isFastModeEnabled, getFastModeModel, isFastModeSupportedByModel } from '../../utils/fastMode.js';
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js';
type Props = {
  onClose: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
  context: LocalJSXCommandContext;
  setTabsHidden: (hidden: boolean) => void;
  onIsSearchModeChange?: (inSearchMode: boolean) => void;
  contentHeight?: number;
};
type SettingBase = {
  id: string;
  label: string;
} | {
  id: string;
  label: React.ReactNode;
  searchText: string;
};
type Setting = (SettingBase & {
  value: boolean;
  onChange(value: boolean): void;
  type: 'boolean';
}) | (SettingBase & {
  value: string;
  options: string[];
  onChange(value: string): void;
  type: 'enum';
}) | (SettingBase & {
  // For enums that are set by a custom component, we don't need to pass options,
  // but we still need a value to display in the top-level config menu
  value: string;
  onChange(value: string): void;
  type: 'managedEnum';
});
type SubMenu = 'Theme' | 'Model' | 'TeammateModel' | 'ExternalIncludes' | 'OutputStyle' | 'ChannelDowngrade' | 'Language' | 'EnableAutoUpdates';
export function Config({
  onClose,
  context,
  setTabsHidden,
  onIsSearchModeChange,
  contentHeight
}: Props): React.ReactNode {
  const {
    headerFocused,
    focusHeader
  } = useTabHeaderFocus();
  const insideModal = useIsInsideModal();
  const [, setTheme] = useTheme();
  const themeSetting = useThemeSetting();
  const [globalConfig, setGlobalConfig] = useState(getGlobalConfig());
  const initialConfig = React.useRef(getGlobalConfig());
  const [settingsData, setSettingsData] = useState(getInitialSettings());
  const initialSettingsData = React.useRef(getInitialSettings());
  const [currentOutputStyle, setCurrentOutputStyle] = useState<OutputStyle>(settingsData?.outputStyle || DEFAULT_OUTPUT_STYLE_NAME);
  const initialOutputStyle = React.useRef(currentOutputStyle);
  const [currentLanguage, setCurrentLanguage] = useState<string | undefined>(settingsData?.language);
  const initialLanguage = React.useRef(currentLanguage);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isSearchMode, setIsSearchMode] = useState(true);
  const isTerminalFocused = useTerminalFocus();
  const {
    rows
  } = useTerminalSize();
  // contentHeight is set by Settings.tsx (same value passed to Tabs to fix
  // pane height across all tabs — prevents layout jank when switching).
  // Reserve ~10 rows for chrome (search box, gaps, footer, scroll hints).
  // Fallback calc for standalone rendering (tests).
  const paneCap = contentHeight ?? Math.min(Math.floor(rows * 0.8), 30);
  const maxVisible = Math.max(5, paneCap - 10);
  const mainLoopModel = useAppState(s => s.mainLoopModel);
  const verbose = useAppState(s_0 => s_0.verbose);
  const thinkingEnabled = useAppState(s_1 => s_1.thinkingEnabled);
  const isFastMode = useAppState(s_2 => isFastModeEnabled() ? s_2.fastMode : false);
  const promptSuggestionEnabled = useAppState(s_3 => s_3.promptSuggestionEnabled);
  // Show auto in the default-mode dropdown when the user has opted in OR the
  // config is fully 'enabled' — even if currently circuit-broken ('disabled'),
  // an opted-in user should still see it in settings (it's a temporary state).
  const showAutoInDefaultModePicker = feature('TRANSCRIPT_CLASSIFIER') ? hasAutoModeOptInAnySource() || getAutoModeEnabledState() === 'enabled' : false;
  // Chat/Transcript view picker is visible to entitled users (pass the GB
  // gate) even if they haven't opted in this session — it IS the persistent
  // opt-in. 'chat' written here is read at next startup by main.tsx which
  // sets userMsgOptIn if still entitled.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const showDefaultViewPicker = feature('KAIROS') || feature('KAIROS_BRIEF') ? (require('../../tools/BriefTool/BriefTool.js') as typeof import('../../tools/BriefTool/BriefTool.js')).isBriefEntitled() : false;
  /* eslint-enable @typescript-eslint/no-require-imports */
  const setAppState = useSetAppState();
  const [changes, setChanges] = useState<{
    [key: string]: unknown;
  }>({});
  const initialThinkingEnabled = React.useRef(thinkingEnabled);
  // Per-source settings snapshots for revert-on-escape. getInitialSettings()
  // returns merged-across-sources which can't tell us what to delete vs
  // restore; per-source snapshots + updateSettingsForSource's
  // undefined-deletes-key semantics can. Lazy-init via useState (no setter) to
  // avoid reading settings files on every render — useRef evaluates its arg
  // eagerly even though only the first result is kept.
  const [initialLocalSettings] = useState(() => getSettingsForSource('localSettings'));
  const [initialUserSettings] = useState(() => getSettingsForSource('userSettings'));
  const initialThemeSetting = React.useRef(themeSetting);
  // AppState fields Config may modify — snapshot once at mount.
  const store = useAppStateStore();
  const [initialAppState] = useState(() => {
    const s_4 = store.getState();
    return {
      mainLoopModel: s_4.mainLoopModel,
      mainLoopModelForSession: s_4.mainLoopModelForSession,
      verbose: s_4.verbose,
      thinkingEnabled: s_4.thinkingEnabled,
      fastMode: s_4.fastMode,
      promptSuggestionEnabled: s_4.promptSuggestionEnabled,
      isBriefOnly: s_4.isBriefOnly,
      replBridgeEnabled: s_4.replBridgeEnabled,
      replBridgeOutboundOnly: s_4.replBridgeOutboundOnly,
      settings: s_4.settings
    };
  });
  // Bootstrap state snapshot — userMsgOptIn is outside AppState, so
  // revertChanges needs to restore it separately. Without this, cycling
  // defaultView to 'chat' then Escape leaves the tool active while the
  // display filter reverts — the exact ambient-activation behavior this
  // PR's entitlement/opt-in split is meant to prevent.
  const [initialUserMsgOptIn] = useState(() => getUserMsgOptIn());
  // Set on first user-visible change; gates revertChanges() on Escape so
  // opening-then-closing doesn't trigger redundant disk writes.
  const isDirty = React.useRef(false);
  const [showThinkingWarning, setShowThinkingWarning] = useState(false);
  const [showSubmenu, setShowSubmenu] = useState<SubMenu | null>(null);
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    cursorOffset: searchCursorOffset
  } = useSearchInput({
    isActive: isSearchMode && showSubmenu === null && !headerFocused,
    onExit: () => setIsSearchMode(false),
    onExitUp: focusHeader,
    // Ctrl+C/D must reach Settings' useExitOnCtrlCD; 'd' also avoids
    // double-action (delete-char + exit-pending).
    passthroughCtrlKeys: ['c', 'd']
  });

  // Tell the parent when Config's own Esc handler is active so Settings cedes
  // confirm:no. Only true when search mode owns the keyboard — not when the
  // tab header is focused (then Settings must handle Esc-to-close).
  const ownsEsc = isSearchMode && !headerFocused;
  React.useEffect(() => {
    onIsSearchModeChange?.(ownsEsc);
  }, [ownsEsc, onIsSearchModeChange]);
  const isConnectedToIde = hasAccessToIDEExtensionDiffFeature(context.options.mcpClients);
  const isFileCheckpointingAvailable = !isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING);
  const memoryFiles = React.use(getMemoryFiles(true));
  const shouldShowExternalIncludesToggle = hasExternalClaudeMdIncludes(memoryFiles);
  const autoUpdaterDisabledReason = getAutoUpdaterDisabledReason();
  function onChangeMainModelConfig(value: string | null): void {
    const previousModel = mainLoopModel;
    logEvent('tengu_config_model_changed', {
      from_model: previousModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      to_model: value as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    setAppState(prev => ({
      ...prev,
      mainLoopModel: value,
      mainLoopModelForSession: null
    }));
    setChanges(prev_0 => {
      const valStr = modelDisplayString(value) + (isBilledAsExtraUsage(value, false, isOpus1mMergeEnabled()) ? ' · Billed as extra usage' : '');
      if ('model' in prev_0) {
        const {
          model,
          ...rest
        } = prev_0;
        return {
          ...rest,
          model: valStr
        };
      }
      return {
        ...prev_0,
        model: valStr
      };
    });
  }
  function onChangeVerbose(value_0: boolean): void {
    // Update the global config to persist the setting
    saveGlobalConfig(current => ({
      ...current,
      verbose: value_0
    }));
    setGlobalConfig({
      ...getGlobalConfig(),
      verbose: value_0
    });

    // Update the app state for immediate UI feedback
    setAppState(prev_1 => ({
      ...prev_1,
      verbose: value_0
    }));
    setChanges(prev_2 => {
      if ('verbose' in prev_2) {
        const {
          verbose: verbose_0,
          ...rest_0
        } = prev_2;
        return rest_0;
      }
      return {
        ...prev_2,
        verbose: value_0
      };
    });
  }

  // TODO: Add MCP servers
  const settingsItems: Setting[] = [
  // Global settings
  {
    id: 'autoCompactEnabled',
    label: 'Auto-compact',
    value: globalConfig.autoCompactEnabled,
    type: 'boolean' as const,
    onChange(autoCompactEnabled: boolean) {
      saveGlobalConfig(current_0 => ({
        ...current_0,
        autoCompactEnabled
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        autoCompactEnabled
      });
      logEvent('tengu_auto_compact_setting_changed', {
        enabled: autoCompactEnabled
      });
    }
  }, {
    id: 'spinnerTipsEnabled',
    label: 'Show tips',
    value: settingsData?.spinnerTipsEnabled ?? true,
    type: 'boolean' as const,
    onChange(spinnerTipsEnabled: boolean) {
      updateSettingsForSource('localSettings', {
        spinnerTipsEnabled
      });
      // Update local state to reflect the change immediately
      setSettingsData(prev_3 => ({
        ...prev_3,
        spinnerTipsEnabled
      }));
      logEvent('tengu_tips_setting_changed', {
        enabled: spinnerTipsEnabled
      });
    }
  }, {
    id: 'prefersReducedMotion',
    label: 'Reduce motion',
    value: settingsData?.prefersReducedMotion ?? false,
    type: 'boolean' as const,
    onChange(prefersReducedMotion: boolean) {
      updateSettingsForSource('localSettings', {
        prefersReducedMotion
      });
      setSettingsData(prev_4 => ({
        ...prev_4,
        prefersReducedMotion
      }));
      // Sync to AppState so components react immediately
      setAppState(prev_5 => ({
        ...prev_5,
        settings: {
          ...prev_5.settings,
          prefersReducedMotion
        }
      }));
      logEvent('tengu_reduce_motion_setting_changed', {
        enabled: prefersReducedMotion
      });
    }
  }, {
    id: 'thinkingEnabled',
    label: 'Thinking mode',
    value: thinkingEnabled ?? true,
    type: 'boolean' as const,
    onChange(enabled: boolean) {
      setAppState(prev_6 => ({
        ...prev_6,
        thinkingEnabled: enabled
      }));
      updateSettingsForSource('userSettings', {
        alwaysThinkingEnabled: enabled ? undefined : false
      });
      logEvent('tengu_thinking_toggled', {
        enabled
      });
    }
  },
  // Fast mode toggle (ant-only, eliminated from external builds)
  ...(isFastModeEnabled() && isFastModeAvailable() ? [{
    id: 'fastMode',
    label: `Fast mode (${FAST_MODE_MODEL_DISPLAY} only)`,
    value: !!isFastMode,
    type: 'boolean' as const,
    onChange(enabled_0: boolean) {
      clearFastModeCooldown();
      updateSettingsForSource('userSettings', {
        fastMode: enabled_0 ? true : undefined
      });
      if (enabled_0) {
        setAppState(prev_7 => ({
          ...prev_7,
          mainLoopModel: getFastModeModel(),
          mainLoopModelForSession: null,
          fastMode: true
        }));
        setChanges(prev_8 => ({
          ...prev_8,
          model: getFastModeModel(),
          'Fast mode': 'ON'
        }));
      } else {
        setAppState(prev_9 => ({
          ...prev_9,
          fastMode: false
        }));
        setChanges(prev_10 => ({
          ...prev_10,
          'Fast mode': 'OFF'
        }));
      }
    }
  }] : []), ...(getFeatureValue_CACHED_MAY_BE_STALE('tengu_chomp_inflection', false) ? [{
    id: 'promptSuggestionEnabled',
    label: 'Prompt suggestions',
    value: promptSuggestionEnabled,
    type: 'boolean' as const,
    onChange(enabled_1: boolean) {
      setAppState(prev_11 => ({
        ...prev_11,
        promptSuggestionEnabled: enabled_1
      }));
      updateSettingsForSource('userSettings', {
        promptSuggestionEnabled: enabled_1 ? undefined : false
      });
    }
  }] : []),
  // Speculation toggle (ant-only)
  ...("external" === 'ant' ? [{
    id: 'speculationEnabled',
    label: 'Speculative execution',
    value: globalConfig.speculationEnabled ?? true,
    type: 'boolean' as const,
    onChange(enabled_2: boolean) {
      saveGlobalConfig(current_1 => {
        if (current_1.speculationEnabled === enabled_2) return current_1;
        return {
          ...current_1,
          speculationEnabled: enabled_2
        };
      });
      setGlobalConfig({
        ...getGlobalConfig(),
        speculationEnabled: enabled_2
      });
      logEvent('tengu_speculation_setting_changed', {
        enabled: enabled_2
      });
    }
  }] : []), ...(isFileCheckpointingAvailable ? [{
    id: 'fileCheckpointingEnabled',
    label: 'Rewind code (checkpoints)',
    value: globalConfig.fileCheckpointingEnabled,
    type: 'boolean' as const,
    onChange(enabled_3: boolean) {
      saveGlobalConfig(current_2 => ({
        ...current_2,
        fileCheckpointingEnabled: enabled_3
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        fileCheckpointingEnabled: enabled_3
      });
      logEvent('tengu_file_history_snapshots_setting_changed', {
        enabled: enabled_3
      });
    }
  }] : []), {
    id: 'verbose',
    label: 'Verbose output',
    value: verbose,
    type: 'boolean',
    onChange: onChangeVerbose
  }, {
    id: 'terminalProgressBarEnabled',
    label: 'Terminal progress bar',
    value: globalConfig.terminalProgressBarEnabled,
    type: 'boolean' as const,
    onChange(terminalProgressBarEnabled: boolean) {
      saveGlobalConfig(current_3 => ({
        ...current_3,
        terminalProgressBarEnabled
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        terminalProgressBarEnabled
      });
      logEvent('tengu_terminal_progress_bar_setting_changed', {
        enabled: terminalProgressBarEnabled
      });
    }
  }, ...(getFeatureValue_CACHED_MAY_BE_STALE('tengu_terminal_sidebar', false) ? [{
    id: 'showStatusInTerminalTab',
    label: 'Show status in terminal tab',
    value: globalConfig.showStatusInTerminalTab ?? false,
    type: 'boolean' as const,
    onChange(showStatusInTerminalTab: boolean) {
      saveGlobalConfig(current_4 => ({
        ...current_4,
        showStatusInTerminalTab
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        showStatusInTerminalTab
      });
      logEvent('tengu_terminal_tab_status_setting_changed', {
        enabled: showStatusInTerminalTab
      });
    }
  }] : []), {
    id: 'showTurnDuration',
    label: 'Show turn duration',
    value: globalConfig.showTurnDuration,
    type: 'boolean' as const,
    onChange(showTurnDuration: boolean) {
      saveGlobalConfig(current_5 => ({
        ...current_5,
        showTurnDuration
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        showTurnDuration
      });
      logEvent('tengu_show_turn_duration_setting_changed', {
        enabled: showTurnDuration
      });
    }
  }, {
    id: 'defaultPermissionMode',
    label: 'Default permission mode',
    value: settingsData?.permissions?.defaultMode || 'default',
    options: (() => {
      const priorityOrder: PermissionMode[] = ['default', 'plan'];
      const allModes: readonly PermissionMode[] = feature('TRANSCRIPT_CLASSIFIER') ? PERMISSION_MODES : EXTERNAL_PERMISSION_MODES;
      const excluded: PermissionMode[] = ['bypassPermissions'];
      if (feature('TRANSCRIPT_CLASSIFIER') && !showAutoInDefaultModePicker) {
        excluded.push('auto');
      }
      return [...priorityOrder, ...allModes.filter(m => !priorityOrder.includes(m) && !excluded.includes(m))];
    })(),
    type: 'enum' as const,
    onChange(mode: string) {
      const parsedMode = permissionModeFromString(mode);
      // Internal modes (e.g. auto) are stored directly
      const validatedMode = isExternalPermissionMode(parsedMode) ? toExternalPermissionMode(parsedMode) : parsedMode;
      const result = updateSettingsForSource('userSettings', {
        permissions: {
          ...settingsData?.permissions,
          defaultMode: validatedMode as ExternalPermissionMode
        }
      });
      if (result.error) {
        logError(result.error);
        return;
      }

      // Update local state to reflect the change immediately.
      // validatedMode is typed as the wide PermissionMode union but at
      // runtime is always a PERMISSION_MODES member (the options dropdown
      // is built from that array above), so this narrowing is sound.
      setSettingsData(prev_12 => ({
        ...prev_12,
        permissions: {
          ...prev_12?.permissions,
          defaultMode: validatedMode as (typeof PERMISSION_MODES)[number]
        }
      }));
      // Track changes
      setChanges(prev_13 => ({
        ...prev_13,
        defaultPermissionMode: mode
      }));
      logEvent('tengu_config_changed', {
        setting: 'defaultPermissionMode' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        value: mode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  }, ...(feature('TRANSCRIPT_CLASSIFIER') && showAutoInDefaultModePicker ? [{
    id: 'useAutoModeDuringPlan',
    label: 'Use auto mode during plan',
    value: (settingsData as {
      useAutoModeDuringPlan?: boolean;
    } | undefined)?.useAutoModeDuringPlan ?? true,
    type: 'boolean' as const,
    onChange(useAutoModeDuringPlan: boolean) {
      updateSettingsForSource('userSettings', {
        useAutoModeDuringPlan
      });
      setSettingsData(prev_14 => ({
        ...prev_14,
        useAutoModeDuringPlan
      }));
      // Internal writes suppress the file watcher, so
      // applySettingsChange won't fire. Reconcile directly so
      // mid-plan toggles take effect immediately.
      setAppState(prev_15 => {
        const next = transitionPlanAutoMode(prev_15.toolPermissionContext);
        if (next === prev_15.toolPermissionContext) return prev_15;
        return {
          ...prev_15,
          toolPermissionContext: next
        };
      });
      setChanges(prev_16 => ({
        ...prev_16,
        'Use auto mode during plan': useAutoModeDuringPlan
      }));
    }
  }] : []), {
    id: 'respectGitignore',
    label: 'Respect .gitignore in file picker',
    value: globalConfig.respectGitignore,
    type: 'boolean' as const,
    onChange(respectGitignore: boolean) {
      saveGlobalConfig(current_6 => ({
        ...current_6,
        respectGitignore
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        respectGitignore
      });
      logEvent('tengu_respect_gitignore_setting_changed', {
        enabled: respectGitignore
      });
    }
  }, {
    id: 'copyFullResponse',
    label: 'Always copy full response (skip /copy picker)',
    value: globalConfig.copyFullResponse,
    type: 'boolean' as const,
    onChange(copyFullResponse: boolean) {
      saveGlobalConfig(current_7 => ({
        ...current_7,
        copyFullResponse
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        copyFullResponse
      });
      logEvent('tengu_config_changed', {
        setting: 'copyFullResponse' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        value: String(copyFullResponse) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  },
  // Copy-on-select is only meaningful with in-app selection (fullscreen
  // alt-screen mode). In inline mode the terminal emulator owns selection.
  ...(isFullscreenEnvEnabled() ? [{
    id: 'copyOnSelect',
    label: 'Copy on select',
    value: globalConfig.copyOnSelect ?? true,
    type: 'boolean' as const,
    onChange(copyOnSelect: boolean) {
      saveGlobalConfig(current_8 => ({
        ...current_8,
        copyOnSelect
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        copyOnSelect
      });
      logEvent('tengu_config_changed', {
        setting: 'copyOnSelect' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        value: String(copyOnSelect) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  }] : []),
  // autoUpdates setting is hidden - use DISABLE_AUTOUPDATER env var to control
  autoUpdaterDisabledReason ? {
    id: 'autoUpdatesChannel',
    label: 'Auto-update channel',
    value: 'disabled',
    type: 'managedEnum' as const,
    onChange() {}
  } : {
    id: 'autoUpdatesChannel',
    label: 'Auto-update channel',
    value: settingsData?.autoUpdatesChannel ?? 'latest',
    type: 'managedEnum' as const,
    onChange() {
      // Handled via toggleSetting -> 'ChannelDowngrade'
    }
  }, {
    id: 'theme',
    label: 'Theme',
    value: themeSetting,
    type: 'managedEnum',
    onChange: setTheme
  }, {
    id: 'notifChannel',
    label: feature('KAIROS') || feature('KAIROS_PUSH_NOTIFICATION') ? 'Local notifications' : 'Notifications',
    value: globalConfig.preferredNotifChannel,
    options: ['auto', 'iterm2', 'terminal_bell', 'iterm2_with_bell', 'kitty', 'ghostty', 'notifications_disabled'],
    type: 'enum',
    onChange(notifChannel: GlobalConfig['preferredNotifChannel']) {
      saveGlobalConfig(current_9 => ({
        ...current_9,
        preferredNotifChannel: notifChannel
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        preferredNotifChannel: notifChannel
      });
    }
  }, ...(feature('KAIROS') || feature('KAIROS_PUSH_NOTIFICATION') ? [{
    id: 'taskCompleteNotifEnabled',
    label: 'Push when idle',
    value: globalConfig.taskCompleteNotifEnabled ?? false,
    type: 'boolean' as const,
    onChange(taskCompleteNotifEnabled: boolean) {
      saveGlobalConfig(current_10 => ({
        ...current_10,
        taskCompleteNotifEnabled
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        taskCompleteNotifEnabled
      });
    }
  }, {
    id: 'inputNeededNotifEnabled',
    label: 'Push when input needed',
    value: globalConfig.inputNeededNotifEnabled ?? false,
    type: 'boolean' as const,
    onChange(inputNeededNotifEnabled: boolean) {
      saveGlobalConfig(current_11 => ({
        ...current_11,
        inputNeededNotifEnabled
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        inputNeededNotifEnabled
      });
    }
  }, {
    id: 'agentPushNotifEnabled',
    label: 'Push when Claude decides',
    value: globalConfig.agentPushNotifEnabled ?? false,
    type: 'boolean' as const,
    onChange(agentPushNotifEnabled: boolean) {
      saveGlobalConfig(current_12 => ({
        ...current_12,
        agentPushNotifEnabled
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        agentPushNotifEnabled
      });
    }
  }] : []), {
    id: 'outputStyle',
    label: 'Output style',
    value: currentOutputStyle,
    type: 'managedEnum' as const,
    onChange: () => {} // handled by OutputStylePicker submenu
  }, ...(showDefaultViewPicker ? [{
    id: 'defaultView',
    label: 'What you see by default',
    // 'default' means the setting is unset — currently resolves to
    // transcript (main.tsx falls through when defaultView !== 'chat').
    // String() narrows the conditional-schema-spread union to string.
    value: settingsData?.defaultView === undefined ? 'default' : String(settingsData.defaultView),
    options: ['transcript', 'chat', 'default'],
    type: 'enum' as const,
    onChange(selected: string) {
      const defaultView = selected === 'default' ? undefined : selected as 'chat' | 'transcript';
      updateSettingsForSource('localSettings', {
        defaultView
      });
      setSettingsData(prev_17 => ({
        ...prev_17,
        defaultView
      }));
      const nextBrief = defaultView === 'chat';
      setAppState(prev_18 => {
        if (prev_18.isBriefOnly === nextBrief) return prev_18;
        return {
          ...prev_18,
          isBriefOnly: nextBrief
        };
      });
      // Keep userMsgOptIn in sync so the tool list follows the view.
      // Two-way now (same as /brief) — accepting a cache invalidation
      // is better than leaving the tool on after switching away.
      // Reverted on Escape via initialUserMsgOptIn snapshot.
      setUserMsgOptIn(nextBrief);
      setChanges(prev_19 => ({
        ...prev_19,
        'Default view': selected
      }));
      logEvent('tengu_default_view_setting_changed', {
        value: (defaultView ?? 'unset') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  }] : []), {
    id: 'language',
    label: 'Language',
    value: currentLanguage ?? 'Default (English)',
    type: 'managedEnum' as const,
    onChange: () => {} // handled by LanguagePicker submenu
  }, {
    id: 'editorMode',
    label: 'Editor mode',
    // Convert 'emacs' to 'normal' for backward compatibility
    value: globalConfig.editorMode === 'emacs' ? 'normal' : globalConfig.editorMode || 'normal',
    options: ['normal', 'vim'],
    type: 'enum',
    onChange(value_1: string) {
      saveGlobalConfig(current_13 => ({
        ...current_13,
        editorMode: value_1 as GlobalConfig['editorMode']
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        editorMode: value_1 as GlobalConfig['editorMode']
      });
      logEvent('tengu_editor_mode_changed', {
        mode: value_1 as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        source: 'config_panel' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  }, {
    id: 'prStatusFooterEnabled',
    label: 'Show PR status footer',
    value: globalConfig.prStatusFooterEnabled ?? true,
    type: 'boolean' as const,
    onChange(enabled_4: boolean) {
      saveGlobalConfig(current_14 => {
        if (current_14.prStatusFooterEnabled === enabled_4) return current_14;
        return {
          ...current_14,
          prStatusFooterEnabled: enabled_4
        };
      });
      setGlobalConfig({
        ...getGlobalConfig(),
        prStatusFooterEnabled: enabled_4
      });
      logEvent('tengu_pr_status_footer_setting_changed', {
        enabled: enabled_4
      });
    }
  }, {
    id: 'model',
    label: 'Model',
    value: mainLoopModel === null ? 'Default (recommended)' : mainLoopModel,
    type: 'managedEnum' as const,
    onChange: onChangeMainModelConfig
  }, ...(isConnectedToIde ? [{
    id: 'diffTool',
    label: 'Diff tool',
    value: globalConfig.diffTool ?? 'auto',
    options: ['terminal', 'auto'],
    type: 'enum' as const,
    onChange(diffTool: string) {
      saveGlobalConfig(current_15 => ({
        ...current_15,
        diffTool: diffTool as GlobalConfig['diffTool']
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        diffTool: diffTool as GlobalConfig['diffTool']
      });
      logEvent('tengu_diff_tool_changed', {
        tool: diffTool as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        source: 'config_panel' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  }] : []), ...(!isSupportedTerminal() ? [{
    id: 'autoConnectIde',
    label: 'Auto-connect to IDE (external terminal)',
    value: globalConfig.autoConnectIde ?? false,
    type: 'boolean' as const,
    onChange(autoConnectIde: boolean) {
      saveGlobalConfig(current_16 => ({
        ...current_16,
        autoConnectIde
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        autoConnectIde
      });
      logEvent('tengu_auto_connect_ide_changed', {
        enabled: autoConnectIde,
        source: 'config_panel' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  }] : []), ...(isSupportedTerminal() ? [{
    id: 'autoInstallIdeExtension',
    label: 'Auto-install IDE extension',
    value: globalConfig.autoInstallIdeExtension ?? true,
    type: 'boolean' as const,
    onChange(autoInstallIdeExtension: boolean) {
      saveGlobalConfig(current_17 => ({
        ...current_17,
        autoInstallIdeExtension
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        autoInstallIdeExtension
      });
      logEvent('tengu_auto_install_ide_extension_changed', {
        enabled: autoInstallIdeExtension,
        source: 'config_panel' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
  }] : []), {
    id: 'claudeInChromeDefaultEnabled',
    label: 'Claude in Chrome enabled by default',
    value: globalConfig.claudeInChromeDefaultEnabled ?? true,
    type: 'boolean' as const,
    onChange(enabled_5: boolean) {
      saveGlobalConfig(current_18 => ({
        ...current_18,
        claudeInChromeDefaultEnabled: enabled_5
      }));
      setGlobalConfig({
        ...getGlobalConfig(),
        claudeInChromeDefaultEnabled: enabled_5
      });
      logEvent('tengu_claude_in_chrome_setting_changed', {
        enabled: enabled_5
      });
    }
  },
  // Teammate mode (only shown when agent swarms are enabled)
  ...(isAgentSwarmsEnabled() ? (() => {
    const cliOverride = getCliTeammateModeOverride();
    const label = cliOverride ? `Teammate mode [overridden: ${cliOverride}]` : 'Teammate mode';
    return [{
      id: 'teammateMode',
      label,
      value: globalConfig.teammateMode ?? 'auto',
      options: ['auto', 'tmux', 'in-process'],
      type: 'enum' as const,
      onChange(mode_0: string) {
        if (mode_0 !== 'auto' && mode_0 !== 'tmux' && mode_0 !== 'in-process') {
          return;
        }
        // Clear CLI override and set new mode (pass mode to avoid race condition)
        clearCliTeammateModeOverride(mode_0);
        saveGlobalConfig(current_19 => ({
          ...current_19,
          teammateMode: mode_0
        }));
        setGlobalConfig({
          ...getGlobalConfig(),
          teammateMode: mode_0
        });
        logEvent('tengu_teammate_mode_changed', {
          mode: mode_0 as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }
    }, {
      id: 'teammateDefaultModel',
      label: 'Default teammate model',
      value: teammateModelDisplayString(globalConfig.teammateDefaultModel),
      type: 'managedEnum' as const,
      onChange() {}
    }];
  })() : []),
  // Remote at startup toggle — gated on build flag + GrowthBook + policy
  ...(feature('BRIDGE_MODE') && isBridgeEnabled() ? [{
    id: 'remoteControlAtStartup',
    label: 'Enable Remote Control for all sessions',
    value: globalConfig.remoteControlAtStartup === undefined ? 'default' : String(globalConfig.remoteControlAtStartup),
    options: ['true', 'false', 'default'],
    type: 'enum' as const,
    onChange(selected_0: string) {
      if (selected_0 === 'default') {
        // Unset the config key so it falls back to the platform default
        saveGlobalConfig(current_20 => {
          if (current_20.remoteControlAtStartup === undefined) return current_20;
          const next_0 = {
            ...current_20
          };
          delete next_0.remoteControlAtStartup;
          return next_0;
        });
        setGlobalConfig({
          ...getGlobalConfig(),
          remoteControlAtStartup: undefined
        });
      } else {
        const enabled_6 = selected_0 === 'true';
        saveGlobalConfig(current_21 => {
          if (current_21.remoteControlAtStartup === enabled_6) return current_21;
          return {
            ...current_21,
            remoteControlAtStartup: enabled_6
          };
        });
        setGlobalConfig({
          ...getGlobalConfig(),
          remoteControlAtStartup: enabled_6
        });
      }
      // Sync to AppState so useReplBridge reacts immediately
      const resolved = getRemoteControlAtStartup();
      setAppState(prev_20 => {
        if (prev_20.replBridgeEnabled === resolved && !prev_20.replBridgeOutboundOnly) return prev_20;
        return {
          ...prev_20,
          replBridgeEnabled: resolved,
          replBridgeOutboundOnly: false
        };
      });
    }
  }] : []), ...(shouldShowExternalIncludesToggle ? [{
    id: 'showExternalIncludesDialog',
    label: 'External CLAUDE.md includes',
    value: (() => {
      const projectConfig = getCurrentProjectConfig();
      if (projectConfig.hasClaudeMdExternalIncludesApproved) {
        return 'true';
      } else {
        return 'false';
      }
    })(),
    type: 'managedEnum' as const,
    onChange() {
      // Will be handled by toggleSetting function
    }
  }] : []), ...(process.env.ANTHROPIC_API_KEY && !isRunningOnHomespace() ? [{
    id: 'apiKey',
    label: <Text>
                Use custom API key:{' '}
                <Text bold>
                  {normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY)}
                </Text>
              </Text>,
    searchText: 'Use custom API key',
    value: Boolean(process.env.ANTHROPIC_API_KEY && globalConfig.customApiKeyResponses?.approved?.includes(normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY))),
    type: 'boolean' as const,
    onChange(useCustomKey: boolean) {
      saveGlobalConfig(current_22 => {
        const updated = {
          ...current_22
        };
        if (!updated.customApiKeyResponses) {
          updated.customApiKeyResponses = {
            approved: [],
            rejected: []
          };
        }
        if (!updated.customApiKeyResponses.approved) {
          updated.customApiKeyResponses = {
            ...updated.customApiKeyResponses,
            approved: []
          };
        }
        if (!updated.customApiKeyResponses.rejected) {
          updated.customApiKeyResponses = {
            ...updated.customApiKeyResponses,
            rejected: []
          };
        }
        if (process.env.ANTHROPIC_API_KEY) {
          const truncatedKey = normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY);
          if (useCustomKey) {
            updated.customApiKeyResponses = {
              ...updated.customApiKeyResponses,
              approved: [...(updated.customApiKeyResponses.approved ?? []).filter(k => k !== truncatedKey), truncatedKey],
              rejected: (updated.customApiKeyResponses.rejected ?? []).filter(k_0 => k_0 !== truncatedKey)
            };
          } else {
            updated.customApiKeyResponses = {
              ...updated.customApiKeyResponses,
              approved: (updated.customApiKeyResponses.approved ?? []).filter(k_1 => k_1 !== truncatedKey),
              rejected: [...(updated.customApiKeyResponses.rejected ?? []).filter(k_2 => k_2 !== truncatedKey), truncatedKey]
            };
          }
        }
        return updated;
      });
      setGlobalConfig(getGlobalConfig());
    }
  }] : [])];

  // Filter settings based on search query
  const filteredSettingsItems = React.useMemo(() => {
    if (!searchQuery) return settingsItems;
    const lowerQuery = searchQuery.toLowerCase();
    return settingsItems.filter(setting => {
      if (setting.id.toLowerCase().includes(lowerQuery)) return true;
      const searchableText = 'searchText' in setting ? setting.searchText : setting.label;
      return searchableText.toLowerCase().includes(lowerQuery);
    });
  }, [settingsItems, searchQuery]);

  // Adjust selected index when filtered list shrinks, and keep the selected
  // item visible when maxVisible changes (e.g., terminal resize).
  React.useEffect(() => {
    if (selectedIndex >= filteredSettingsItems.length) {
      const newIndex = Math.max(0, filteredSettingsItems.length - 1);
      setSelectedIndex(newIndex);
      setScrollOffset(Math.max(0, newIndex - maxVisible + 1));
      return;
    }
    setScrollOffset(prev_21 => {
      if (selectedIndex < prev_21) return selectedIndex;
      if (selectedIndex >= prev_21 + maxVisible) return selectedIndex - maxVisible + 1;
      return prev_21;
    });
  }, [filteredSettingsItems.length, selectedIndex, maxVisible]);

  // Keep the selected item visible within the scroll window.
  // Called synchronously from navigation handlers to avoid a render frame
  // where the selected item falls outside the visible window.
  const adjustScrollOffset = useCallback((newIndex_0: number) => {
    setScrollOffset(prev_22 => {
      if (newIndex_0 < prev_22) return newIndex_0;
      if (newIndex_0 >= prev_22 + maxVisible) return newIndex_0 - maxVisible + 1;
      return prev_22;
    });
  }, [maxVisible]);

  // Enter: keep all changes (already persisted by onChange handlers), close
  // with a summary of what changed.
  const handleSaveAndClose = useCallback(() => {
    // Submenu handling: each submenu has its own Enter/Esc — don't close
    // the whole panel while one is open.
    if (showSubmenu !== null) {
      return;
    }
    // Log any changes that were made
    // TODO: Make these proper messages
    const formattedChanges: string[] = Object.entries(changes).map(([key, value_2]) => {
      logEvent('tengu_config_changed', {
        key: key as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        value: value_2 as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      return `Set ${key} to ${chalk.bold(value_2)}`;
    });
    // Check for API key changes
    // On homespace, ANTHROPIC_API_KEY is preserved in process.env for child
    // processes but ignored by Claude Code itself (see auth.ts).
    const effectiveApiKey = isRunningOnHomespace() ? undefined : process.env.ANTHROPIC_API_KEY;
    const initialUsingCustomKey = Boolean(effectiveApiKey && initialConfig.current.customApiKeyResponses?.approved?.includes(normalizeApiKeyForConfig(effectiveApiKey)));
    const currentUsingCustomKey = Boolean(effectiveApiKey && globalConfig.customApiKeyResponses?.approved?.includes(normalizeApiKeyForConfig(effectiveApiKey)));
    if (initialUsingCustomKey !== currentUsingCustomKey) {
      formattedChanges.push(`${currentUsingCustomKey ? 'Enabled' : 'Disabled'} custom API key`);
      logEvent('tengu_config_changed', {
        key: 'env.ANTHROPIC_API_KEY' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        value: currentUsingCustomKey as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
    if (globalConfig.theme !== initialConfig.current.theme) {
      formattedChanges.push(`Set theme to ${chalk.bold(globalConfig.theme)}`);
    }
    if (globalConfig.preferredNotifChannel !== initialConfig.current.preferredNotifChannel) {
      formattedChanges.push(`Set notifications to ${chalk.bold(globalConfig.preferredNotifChannel)}`);
    }
    if (currentOutputStyle !== initialOutputStyle.current) {
      formattedChanges.push(`Set output style to ${chalk.bold(currentOutputStyle)}`);
    }
    if (currentLanguage !== initialLanguage.current) {
      formattedChanges.push(`Set response language to ${chalk.bold(currentLanguage ?? 'Default (English)')}`);
    }
    if (globalConfig.editorMode !== initialConfig.current.editorMode) {
      formattedChanges.push(`Set editor mode to ${chalk.bold(globalConfig.editorMode || 'emacs')}`);
    }
    if (globalConfig.diffTool !== initialConfig.current.diffTool) {
      formattedChanges.push(`Set diff tool to ${chalk.bold(globalConfig.diffTool)}`);
    }
    if (globalConfig.autoConnectIde !== initialConfig.current.autoConnectIde) {
      formattedChanges.push(`${globalConfig.autoConnectIde ? 'Enabled' : 'Disabled'} auto-connect to IDE`);
    }
    if (globalConfig.autoInstallIdeExtension !== initialConfig.current.autoInstallIdeExtension) {
      formattedChanges.push(`${globalConfig.autoInstallIdeExtension ? 'Enabled' : 'Disabled'} auto-install IDE extension`);
    }
    if (globalConfig.autoCompactEnabled !== initialConfig.current.autoCompactEnabled) {
      formattedChanges.push(`${globalConfig.autoCompactEnabled ? 'Enabled' : 'Disabled'} auto-compact`);
    }
    if (globalConfig.respectGitignore !== initialConfig.current.respectGitignore) {
      formattedChanges.push(`${globalConfig.respectGitignore ? 'Enabled' : 'Disabled'} respect .gitignore in file picker`);
    }
    if (globalConfig.copyFullResponse !== initialConfig.current.copyFullResponse) {
      formattedChanges.push(`${globalConfig.copyFullResponse ? 'Enabled' : 'Disabled'} always copy full response`);
    }
    if (globalConfig.copyOnSelect !== initialConfig.current.copyOnSelect) {
      formattedChanges.push(`${globalConfig.copyOnSelect ? 'Enabled' : 'Disabled'} copy on select`);
    }
    if (globalConfig.terminalProgressBarEnabled !== initialConfig.current.terminalProgressBarEnabled) {
      formattedChanges.push(`${globalConfig.terminalProgressBarEnabled ? 'Enabled' : 'Disabled'} terminal progress bar`);
    }
    if (globalConfig.showStatusInTerminalTab !== initialConfig.current.showStatusInTerminalTab) {
      formattedChanges.push(`${globalConfig.showStatusInTerminalTab ? 'Enabled' : 'Disabled'} terminal tab status`);
    }
    if (globalConfig.showTurnDuration !== initialConfig.current.showTurnDuration) {
      formattedChanges.push(`${globalConfig.showTurnDuration ? 'Enabled' : 'Disabled'} turn duration`);
    }
    if (globalConfig.remoteControlAtStartup !== initialConfig.current.remoteControlAtStartup) {
      const remoteLabel = globalConfig.remoteControlAtStartup === undefined ? 'Reset Remote Control to default' : `${globalConfig.remoteControlAtStartup ? 'Enabled' : 'Disabled'} Remote Control for all sessions`;
      formattedChanges.push(remoteLabel);
    }
    if (settingsData?.autoUpdatesChannel !== initialSettingsData.current?.autoUpdatesChannel) {
      formattedChanges.push(`Set auto-update channel to ${chalk.bold(settingsData?.autoUpdatesChannel ?? 'latest')}`);
    }
    if (formattedChanges.length > 0) {
      onClose(formattedChanges.join('\n'));
    } else {
      onClose('Config dialog dismissed', {
        display: 'system'
      });
    }
  }, [showSubmenu, changes, globalConfig, mainLoopModel, currentOutputStyle, currentLanguage, settingsData?.autoUpdatesChannel, isFastModeEnabled() ? (settingsData as Record<string, unknown> | undefined)?.fastMode : undefined, onClose]);

  // Restore all state stores to their mount-time snapshots. Changes are
  // applied to disk/AppState immediately on toggle, so "cancel" means
  // actively writing the old values back.
  const revertChanges = useCallback(() => {
    // Theme: restores ThemeProvider React state. Must run before the global
    // config overwrite since setTheme internally calls saveGlobalConfig with
    // a partial update — we want the full snapshot to be the last write.
    if (themeSetting !== initialThemeSetting.current) {
      setTheme(initialThemeSetting.current);
    }
    // Global config: full overwrite from snapshot. saveGlobalConfig skips if
    // the returned ref equals current (test mode checks ref; prod writes to
    // disk but content is identical).
    saveGlobalConfig(() => initialConfig.current);
    // Settings files: restore each key Config may have touched. undefined
    // deletes the key (updateSettingsForSource customizer at settings.ts:368).
    const il = initialLocalSettings;
    updateSettingsForSource('localSettings', {
      spinnerTipsEnabled: il?.spinnerTipsEnabled,
      prefersReducedMotion: il?.prefersReducedMotion,
      defaultView: il?.defaultView,
      outputStyle: il?.outputStyle
    });
    const iu = initialUserSettings;
    updateSettingsForSource('userSettings', {
      alwaysThinkingEnabled: iu?.alwaysThinkingEnabled,
      fastMode: iu?.fastMode,
      promptSuggestionEnabled: iu?.promptSuggestionEnabled,
      autoUpdatesChannel: iu?.autoUpdatesChannel,
      minimumVersion: iu?.minimumVersion,
      language: iu?.language,
      ...(feature('TRANSCRIPT_CLASSIFIER') ? {
        useAutoModeDuringPlan: (iu as {
          useAutoModeDuringPlan?: boolean;
        } | undefined)?.useAutoModeDuringPlan
      } : {}),
      // ThemePicker's Ctrl+T writes this key directly — include it so the
      // disk state reverts along with the in-memory AppState.settings restore.
      syntaxHighlightingDisabled: iu?.syntaxHighlightingDisabled,
      // permissions: the defaultMode onChange (above) spreads the MERGED
      // settingsData.permissions into userSettings — project/policy allow/deny
      // arrays can leak to disk. Spread the full initial snapshot so the
      // mergeWith array-customizer (settings.ts:375) replaces leaked arrays.
      // Explicitly include defaultMode so undefined triggers the customizer's
      // delete path even when iu.permissions lacks that key.
      permissions: iu?.permissions === undefined ? undefined : {
        ...iu.permissions,
        defaultMode: iu.permissions.defaultMode
      }
    });
    // AppState: batch-restore all possibly-touched fields.
    const ia = initialAppState;
    setAppState(prev_23 => ({
      ...prev_23,
      mainLoopModel: ia.mainLoopModel,
      mainLoopModelForSession: ia.mainLoopModelForSession,
      verbose: ia.verbose,
      thinkingEnabled: ia.thinkingEnabled,
      fastMode: ia.fastMode,
      promptSuggestionEnabled: ia.promptSuggestionEnabled,
      isBriefOnly: ia.isBriefOnly,
      replBridgeEnabled: ia.replBridgeEnabled,
      replBridgeOutboundOnly: ia.replBridgeOutboundOnly,
      settings: ia.settings,
      // Reconcile auto-mode state after useAutoModeDuringPlan revert above —
      // the onChange handler may have activated/deactivated auto mid-plan.
      toolPermissionContext: transitionPlanAutoMode(prev_23.toolPermissionContext)
    }));
    // Bootstrap state: restore userMsgOptIn. Only touched by the defaultView
    // onChange above, so no feature() guard needed here (that path only
    // exists when showDefaultViewPicker is true).
    if (getUserMsgOptIn() !== initialUserMsgOptIn) {
      setUserMsgOptIn(initialUserMsgOptIn);
    }
  }, [themeSetting, setTheme, initialLocalSettings, initialUserSettings, initialAppState, initialUserMsgOptIn, setAppState]);

  // Escape: revert all changes (if any) and close.
  const handleEscape = useCallback(() => {
    if (showSubmenu !== null) {
      return;
    }
    if (isDirty.current) {
      revertChanges();
    }
    onClose('Config dialog dismissed', {
      display: 'system'
    });
  }, [showSubmenu, revertChanges, onClose]);

  // Disable when submenu is open so the submenu's Dialog handles ESC, and in
  // search mode so the onKeyDown handler (which clears-then-exits search)
  // wins — otherwise Escape in search would jump straight to revert+close.
  useKeybinding('confirm:no', handleEscape, {
    context: 'Settings',
    isActive: showSubmenu === null && !isSearchMode && !headerFocused
  });
  // Save-and-close fires on Enter only when not in search mode (Enter there
  // exits search to the list — see the isSearchMode branch in handleKeyDown).
  useKeybinding('settings:close', handleSaveAndClose, {
    context: 'Settings',
    isActive: showSubmenu === null && !isSearchMode && !headerFocused
  });

  // Settings navigation and toggle actions via configurable keybindings.
  // Only active when not in search mode and no submenu is open.
  const toggleSetting = useCallback(() => {
    const setting_0 = filteredSettingsItems[selectedIndex];
    if (!setting_0 || !setting_0.onChange) {
      return;
    }
    if (setting_0.type === 'boolean') {
      isDirty.current = true;
      setting_0.onChange(!setting_0.value);
      if (setting_0.id === 'thinkingEnabled') {
        const newValue = !setting_0.value;
        const backToInitial = newValue === initialThinkingEnabled.current;
        if (backToInitial) {
          setShowThinkingWarning(false);
        } else if (context.messages.some(m_0 => m_0.type === 'assistant')) {
          setShowThinkingWarning(true);
        }
      }
      return;
    }
    if (setting_0.id === 'theme' || setting_0.id === 'model' || setting_0.id === 'teammateDefaultModel' || setting_0.id === 'showExternalIncludesDialog' || setting_0.id === 'outputStyle' || setting_0.id === 'language') {
      // managedEnum items open a submenu — isDirty is set by the submenu's
      // completion callback, not here (submenu may be cancelled).
      switch (setting_0.id) {
        case 'theme':
          setShowSubmenu('Theme');
          setTabsHidden(true);
          return;
        case 'model':
          setShowSubmenu('Model');
          setTabsHidden(true);
          return;
        case 'teammateDefaultModel':
          setShowSubmenu('TeammateModel');
          setTabsHidden(true);
          return;
        case 'showExternalIncludesDialog':
          setShowSubmenu('ExternalIncludes');
          setTabsHidden(true);
          return;
        case 'outputStyle':
          setShowSubmenu('OutputStyle');
          setTabsHidden(true);
          return;
        case 'language':
          setShowSubmenu('Language');
          setTabsHidden(true);
          return;
      }
    }
    if (setting_0.id === 'autoUpdatesChannel') {
      if (autoUpdaterDisabledReason) {
        // Auto-updates are disabled - show enable dialog instead
        setShowSubmenu('EnableAutoUpdates');
        setTabsHidden(true);
        return;
      }
      const currentChannel = settingsData?.autoUpdatesChannel ?? 'latest';
      if (currentChannel === 'latest') {
        // Switching to stable - show downgrade dialog
        setShowSubmenu('ChannelDowngrade');
        setTabsHidden(true);
      } else {
        // Switching to latest - just do it and clear minimumVersion
        isDirty.current = true;
        updateSettingsForSource('userSettings', {
          autoUpdatesChannel: 'latest',
          minimumVersion: undefined
        });
        setSettingsData(prev_24 => ({
          ...prev_24,
          autoUpdatesChannel: 'latest',
          minimumVersion: undefined
        }));
        logEvent('tengu_autoupdate_channel_changed', {
          channel: 'latest' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }
      return;
    }
    if (setting_0.type === 'enum') {
      isDirty.current = true;
      const currentIndex = setting_0.options.indexOf(setting_0.value);
      const nextIndex = (currentIndex + 1) % setting_0.options.length;
      setting_0.onChange(setting_0.options[nextIndex]!);
      return;
    }
  }, [autoUpdaterDisabledReason, filteredSettingsItems, selectedIndex, settingsData?.autoUpdatesChannel, setTabsHidden]);
  const moveSelection = (delta: -1 | 1): void => {
    setShowThinkingWarning(false);
    const newIndex_1 = Math.max(0, Math.min(filteredSettingsItems.length - 1, selectedIndex + delta));
    setSelectedIndex(newIndex_1);
    adjustScrollOffset(newIndex_1);
  };
  useKeybindings({
    'select:previous': () => {
      if (selectedIndex === 0) {
        // ↑ at top enters search mode so users can type-to-filter after
        // reaching the list boundary. Wheel-up (scroll:lineUp) clamps
        // instead — overshoot shouldn't move focus away from the list.
        setShowThinkingWarning(false);
        setIsSearchMode(true);
        setScrollOffset(0);
      } else {
        moveSelection(-1);
      }
    },
    'select:next': () => moveSelection(1),
    // Wheel. ScrollKeybindingHandler's scroll:line* returns false (not
    // consumed) when the ScrollBox content fits — which it always does
    // here because the list is paginated (slice). The event falls through
    // to this handler which navigates the list, clamping at boundaries.
    'scroll:lineUp': () => moveSelection(-1),
    'scroll:lineDown': () => moveSelection(1),
    'select:accept': toggleSetting,
    'settings:search': () => {
      setIsSearchMode(true);
      setSearchQuery('');
    }
  }, {
    context: 'Settings',
    isActive: showSubmenu === null && !isSearchMode && !headerFocused
  });

  // Combined key handling across search/list modes. Branch order mirrors
  // the original useInput gate priority: submenu and header short-circuit
  // first (their own handlers own input), then search vs. list.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showSubmenu !== null) return;
    if (headerFocused) return;
    // Search mode: Esc clears then exits, Enter/↓ moves to the list.
    if (isSearchMode) {
      if (e.key === 'escape') {
        e.preventDefault();
        if (searchQuery.length > 0) {
          setSearchQuery('');
        } else {
          setIsSearchMode(false);
        }
        return;
      }
      if (e.key === 'return' || e.key === 'down' || e.key === 'wheeldown') {
        e.preventDefault();
        setIsSearchMode(false);
        setSelectedIndex(0);
        setScrollOffset(0);
      }
      return;
    }
    // List mode: left/right/tab cycle the selected option's value. These
    // keys used to switch tabs; now they only do so when the tab row is
    // explicitly focused (see headerFocused in Settings.tsx).
    if (e.key === 'left' || e.key === 'right' || e.key === 'tab') {
      e.preventDefault();
      toggleSetting();
      return;
    }
    // Fallback: printable characters (other than those bound to actions)
    // enter search mode. Carve out j/k// — useKeybindings (still on the
    // useInput path) consumes these via stopImmediatePropagation, but
    // onKeyDown dispatches independently so we must skip them explicitly.
    if (e.ctrl || e.meta) return;
    if (e.key === 'j' || e.key === 'k' || e.key === '/') return;
    if (e.key.length === 1 && e.key !== ' ') {
      e.preventDefault();
      setIsSearchMode(true);
      setSearchQuery(e.key);
    }
  }, [showSubmenu, headerFocused, isSearchMode, searchQuery, setSearchQuery, toggleSetting]);
  return <Box flexDirection="column" width="100%" tabIndex={0} autoFocus onKeyDown={handleKeyDown}>
      {showSubmenu === 'Theme' ? <>
          <ThemePicker onThemeSelect={setting_1 => {
        isDirty.current = true;
        setTheme(setting_1);
        setShowSubmenu(null);
        setTabsHidden(false);
      }} onCancel={() => {
        setShowSubmenu(null);
        setTabsHidden(false);
      }} hideEscToCancel skipExitHandling={true} // Skip exit handling as Config already handles it
      />
          <Box>
            <Text dimColor italic>
              <Byline>
                <KeyboardShortcutHint shortcut="Enter" action="select" />
                <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
              </Byline>
            </Text>
          </Box>
        </> : showSubmenu === 'Model' ? <>
          <ModelPicker initial={mainLoopModel} onSelect={(model_0, _effort) => {
        isDirty.current = true;
        onChangeMainModelConfig(model_0);
        setShowSubmenu(null);
        setTabsHidden(false);
      }} onCancel={() => {
        setShowSubmenu(null);
        setTabsHidden(false);
      }} showFastModeNotice={isFastModeEnabled() ? isFastMode && isFastModeSupportedByModel(mainLoopModel) && isFastModeAvailable() : false} />
          <Text dimColor>
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
            </Byline>
          </Text>
        </> : showSubmenu === 'TeammateModel' ? <>
          <ModelPicker initial={globalConfig.teammateDefaultModel ?? null} skipSettingsWrite headerText="Default model for newly spawned teammates. The leader can override via the tool call's model parameter." onSelect={(model_1, _effort_0) => {
        setShowSubmenu(null);
        setTabsHidden(false);
        // First-open-then-Enter from unset: picker highlights "Default"
        // (initial=null) and confirming would write null, silently
        // switching Opus-fallback → follow-leader. Treat as no-op.
        if (globalConfig.teammateDefaultModel === undefined && model_1 === null) {
          return;
        }
        isDirty.current = true;
        saveGlobalConfig(current_23 => current_23.teammateDefaultModel === model_1 ? current_23 : {
          ...current_23,
          teammateDefaultModel: model_1
        });
        setGlobalConfig({
          ...getGlobalConfig(),
          teammateDefaultModel: model_1
        });
        setChanges(prev_25 => ({
          ...prev_25,
          teammateDefaultModel: teammateModelDisplayString(model_1)
        }));
        logEvent('tengu_teammate_default_model_changed', {
          model: model_1 as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }} onCancel={() => {
        setShowSubmenu(null);
        setTabsHidden(false);
      }} />
          <Text dimColor>
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
            </Byline>
          </Text>
        </> : showSubmenu === 'ExternalIncludes' ? <>
          <ClaudeMdExternalIncludesDialog onDone={() => {
        setShowSubmenu(null);
        setTabsHidden(false);
      }} externalIncludes={getExternalClaudeMdIncludes(memoryFiles)} />
          <Text dimColor>
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="disable external includes" />
            </Byline>
          </Text>
        </> : showSubmenu === 'OutputStyle' ? <>
          <OutputStylePicker initialStyle={currentOutputStyle} onComplete={style => {
        isDirty.current = true;
        setCurrentOutputStyle(style ?? DEFAULT_OUTPUT_STYLE_NAME);
        setShowSubmenu(null);
        setTabsHidden(false);

        // Save to local settings
        updateSettingsForSource('localSettings', {
          outputStyle: style
        });
        void logEvent('tengu_output_style_changed', {
          style: (style ?? DEFAULT_OUTPUT_STYLE_NAME) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          source: 'config_panel' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          settings_source: 'localSettings' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }} onCancel={() => {
        setShowSubmenu(null);
        setTabsHidden(false);
      }} />
          <Text dimColor>
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
            </Byline>
          </Text>
        </> : showSubmenu === 'Language' ? <>
          <LanguagePicker initialLanguage={currentLanguage} onComplete={language => {
        isDirty.current = true;
        setCurrentLanguage(language);
        setShowSubmenu(null);
        setTabsHidden(false);

        // Save to user settings
        updateSettingsForSource('userSettings', {
          language
        });
        void logEvent('tengu_language_changed', {
          language: (language ?? 'default') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          source: 'config_panel' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }} onCancel={() => {
        setShowSubmenu(null);
        setTabsHidden(false);
      }} />
          <Text dimColor>
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="cancel" />
            </Byline>
          </Text>
        </> : showSubmenu === 'EnableAutoUpdates' ? <Dialog title="Enable Auto-Updates" onCancel={() => {
      setShowSubmenu(null);
      setTabsHidden(false);
    }} hideBorder hideInputGuide>
          {autoUpdaterDisabledReason?.type !== 'config' ? <>
              <Text>
                {autoUpdaterDisabledReason?.type === 'env' ? 'Auto-updates are controlled by an environment variable and cannot be changed here.' : 'Auto-updates are disabled in development builds.'}
              </Text>
              {autoUpdaterDisabledReason?.type === 'env' && <Text dimColor>
                  Unset {autoUpdaterDisabledReason.envVar} to re-enable
                  auto-updates.
                </Text>}
            </> : <Select options={[{
        label: 'Enable with latest channel',
        value: 'latest'
      }, {
        label: 'Enable with stable channel',
        value: 'stable'
      }]} onChange={(channel: string) => {
        isDirty.current = true;
        setShowSubmenu(null);
        setTabsHidden(false);
        saveGlobalConfig(current_24 => ({
          ...current_24,
          autoUpdates: true
        }));
        setGlobalConfig({
          ...getGlobalConfig(),
          autoUpdates: true
        });
        updateSettingsForSource('userSettings', {
          autoUpdatesChannel: channel as 'latest' | 'stable',
          minimumVersion: undefined
        });
        setSettingsData(prev_26 => ({
          ...prev_26,
          autoUpdatesChannel: channel as 'latest' | 'stable',
          minimumVersion: undefined
        }));
        logEvent('tengu_autoupdate_enabled', {
          channel: channel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }} />}
        </Dialog> : showSubmenu === 'ChannelDowngrade' ? <ChannelDowngradeDialog currentVersion={MACRO.VERSION} onChoice={(choice: ChannelDowngradeChoice) => {
      setShowSubmenu(null);
      setTabsHidden(false);
      if (choice === 'cancel') {
        // User cancelled - don't change anything
        return;
      }
      isDirty.current = true;
      // Switch to stable channel
      const newSettings: {
        autoUpdatesChannel: 'stable';
        minimumVersion?: string;
      } = {
        autoUpdatesChannel: 'stable'
      };
      if (choice === 'stay') {
        // User wants to stay on current version until stable catches up
        newSettings.minimumVersion = MACRO.VERSION;
      }
      updateSettingsForSource('userSettings', newSettings);
      setSettingsData(prev_27 => ({
        ...prev_27,
        ...newSettings
      }));
      logEvent('tengu_autoupdate_channel_changed', {
        channel: 'stable' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        minimum_version_set: choice === 'stay'
      });
    }} /> : <Box flexDirection="column" gap={1} marginY={insideModal ? undefined : 1}>
          <SearchBox query={searchQuery} isFocused={isSearchMode && !headerFocused} isTerminalFocused={isTerminalFocused} cursorOffset={searchCursorOffset} placeholder="Search settings…" />
          <Box flexDirection="column">
            {filteredSettingsItems.length === 0 ? <Text dimColor italic>
                No settings match &quot;{searchQuery}&quot;
              </Text> : <>
                {scrollOffset > 0 && <Text dimColor>
                    {figures.arrowUp} {scrollOffset} more above
                  </Text>}
                {filteredSettingsItems.slice(scrollOffset, scrollOffset + maxVisible).map((setting_2, i) => {
            const actualIndex = scrollOffset + i;
            const isSelected = actualIndex === selectedIndex && !headerFocused && !isSearchMode;
            return <React.Fragment key={setting_2.id}>
                        <Box>
                          <Box width={44}>
                            <Text color={isSelected ? 'suggestion' : undefined}>
                              {isSelected ? figures.pointer : ' '}{' '}
                              {setting_2.label}
                            </Text>
                          </Box>
                          <Box key={isSelected ? 'selected' : 'unselected'}>
                            {setting_2.type === 'boolean' ? <>
                                <Text color={isSelected ? 'suggestion' : undefined}>
                                  {setting_2.value.toString()}
                                </Text>
                                {showThinkingWarning && setting_2.id === 'thinkingEnabled' && <Text color="warning">
                                      {' '}
                                      Changing thinking mode mid-conversation
                                      will increase latency and may reduce
                                      quality.
                                    </Text>}
                              </> : setting_2.id === 'theme' ? <Text color={isSelected ? 'suggestion' : undefined}>
                                {THEME_LABELS[setting_2.value.toString()] ?? setting_2.value.toString()}
                              </Text> : setting_2.id === 'notifChannel' ? <Text color={isSelected ? 'suggestion' : undefined}>
                                <NotifChannelLabel value={setting_2.value.toString()} />
                              </Text> : setting_2.id === 'defaultPermissionMode' ? <Text color={isSelected ? 'suggestion' : undefined}>
                                {permissionModeTitle(setting_2.value as PermissionMode)}
                              </Text> : setting_2.id === 'autoUpdatesChannel' && autoUpdaterDisabledReason ? <Box flexDirection="column">
                                <Text color={isSelected ? 'suggestion' : undefined}>
                                  disabled
                                </Text>
                                <Text dimColor>
                                  (
                                  {formatAutoUpdaterDisabledReason(autoUpdaterDisabledReason)}
                                  )
                                </Text>
                              </Box> : <Text color={isSelected ? 'suggestion' : undefined}>
                                {setting_2.value.toString()}
                              </Text>}
                          </Box>
                        </Box>
                      </React.Fragment>;
          })}
                {scrollOffset + maxVisible < filteredSettingsItems.length && <Text dimColor>
                    {figures.arrowDown}{' '}
                    {filteredSettingsItems.length - scrollOffset - maxVisible}{' '}
                    more below
                  </Text>}
              </>}
          </Box>
          {headerFocused ? <Text dimColor>
              <Byline>
                <KeyboardShortcutHint shortcut="←/→ tab" action="switch" />
                <KeyboardShortcutHint shortcut="↓" action="return" />
                <ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="close" />
              </Byline>
            </Text> : isSearchMode ? <Text dimColor>
              <Byline>
                <Text>Type to filter</Text>
                <KeyboardShortcutHint shortcut="Enter/↓" action="select" />
                <KeyboardShortcutHint shortcut="↑" action="tabs" />
                <ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="clear" />
              </Byline>
            </Text> : <Text dimColor>
              <Byline>
                <ConfigurableShortcutHint action="select:accept" context="Settings" fallback="Space" description="change" />
                <ConfigurableShortcutHint action="settings:close" context="Settings" fallback="Enter" description="save" />
                <ConfigurableShortcutHint action="settings:search" context="Settings" fallback="/" description="search" />
                <ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="cancel" />
              </Byline>
            </Text>}
        </Box>}
    </Box>;
}
function teammateModelDisplayString(value: string | null | undefined): string {
  if (value === undefined) {
    return modelDisplayString(getHardcodedTeammateModelFallback());
  }
  if (value === null) return "Default (leader's model)";
  return modelDisplayString(value);
}
const THEME_LABELS: Record<string, string> = {
  auto: 'Auto (match terminal)',
  dark: 'Dark mode',
  light: 'Light mode',
  'dark-daltonized': 'Dark mode (colorblind-friendly)',
  'light-daltonized': 'Light mode (colorblind-friendly)',
  'dark-ansi': 'Dark mode (ANSI colors only)',
  'light-ansi': 'Light mode (ANSI colors only)'
};
function NotifChannelLabel(t0) {
  const $ = _c(4);
  const {
    value
  } = t0;
  switch (value) {
    case "auto":
      {
        return "Auto";
      }
    case "iterm2":
      {
        let t1;
        if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <Text>iTerm2 <Text dimColor={true}>(OSC 9)</Text></Text>;
          $[0] = t1;
        } else {
          t1 = $[0];
        }
        return t1;
      }
    case "terminal_bell":
      {
        let t1;
        if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <Text>Terminal Bell <Text dimColor={true}>(\a)</Text></Text>;
          $[1] = t1;
        } else {
          t1 = $[1];
        }
        return t1;
      }
    case "kitty":
      {
        let t1;
        if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <Text>Kitty <Text dimColor={true}>(OSC 99)</Text></Text>;
          $[2] = t1;
        } else {
          t1 = $[2];
        }
        return t1;
      }
    case "ghostty":
      {
        let t1;
        if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <Text>Ghostty <Text dimColor={true}>(OSC 777)</Text></Text>;
          $[3] = t1;
        } else {
          t1 = $[3];
        }
        return t1;
      }
    case "iterm2_with_bell":
      {
        return "iTerm2 w/ Bell";
      }
    case "notifications_disabled":
      {
        return "Disabled";
      }
    default:
      {
        return value;
      }
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiQm94IiwiVGV4dCIsInVzZVRoZW1lIiwidXNlVGhlbWVTZXR0aW5nIiwidXNlVGVybWluYWxGb2N1cyIsIktleWJvYXJkRXZlbnQiLCJSZWFjdCIsInVzZVN0YXRlIiwidXNlQ2FsbGJhY2siLCJ1c2VLZXliaW5kaW5nIiwidXNlS2V5YmluZGluZ3MiLCJmaWd1cmVzIiwiR2xvYmFsQ29uZmlnIiwic2F2ZUdsb2JhbENvbmZpZyIsImdldEN1cnJlbnRQcm9qZWN0Q29uZmlnIiwiT3V0cHV0U3R5bGUiLCJub3JtYWxpemVBcGlLZXlGb3JDb25maWciLCJnZXRHbG9iYWxDb25maWciLCJnZXRBdXRvVXBkYXRlckRpc2FibGVkUmVhc29uIiwiZm9ybWF0QXV0b1VwZGF0ZXJEaXNhYmxlZFJlYXNvbiIsImdldFJlbW90ZUNvbnRyb2xBdFN0YXJ0dXAiLCJjaGFsayIsInBlcm1pc3Npb25Nb2RlVGl0bGUiLCJwZXJtaXNzaW9uTW9kZUZyb21TdHJpbmciLCJ0b0V4dGVybmFsUGVybWlzc2lvbk1vZGUiLCJpc0V4dGVybmFsUGVybWlzc2lvbk1vZGUiLCJFWFRFUk5BTF9QRVJNSVNTSU9OX01PREVTIiwiUEVSTUlTU0lPTl9NT0RFUyIsIkV4dGVybmFsUGVybWlzc2lvbk1vZGUiLCJQZXJtaXNzaW9uTW9kZSIsImdldEF1dG9Nb2RlRW5hYmxlZFN0YXRlIiwiaGFzQXV0b01vZGVPcHRJbkFueVNvdXJjZSIsInRyYW5zaXRpb25QbGFuQXV0b01vZGUiLCJsb2dFcnJvciIsImxvZ0V2ZW50IiwiQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyIsImlzQnJpZGdlRW5hYmxlZCIsIlRoZW1lUGlja2VyIiwidXNlQXBwU3RhdGUiLCJ1c2VTZXRBcHBTdGF0ZSIsInVzZUFwcFN0YXRlU3RvcmUiLCJNb2RlbFBpY2tlciIsIm1vZGVsRGlzcGxheVN0cmluZyIsImlzT3B1czFtTWVyZ2VFbmFibGVkIiwiaXNCaWxsZWRBc0V4dHJhVXNhZ2UiLCJDbGF1ZGVNZEV4dGVybmFsSW5jbHVkZXNEaWFsb2ciLCJDaGFubmVsRG93bmdyYWRlRGlhbG9nIiwiQ2hhbm5lbERvd25ncmFkZUNob2ljZSIsIkRpYWxvZyIsIlNlbGVjdCIsIk91dHB1dFN0eWxlUGlja2VyIiwiTGFuZ3VhZ2VQaWNrZXIiLCJnZXRFeHRlcm5hbENsYXVkZU1kSW5jbHVkZXMiLCJnZXRNZW1vcnlGaWxlcyIsImhhc0V4dGVybmFsQ2xhdWRlTWRJbmNsdWRlcyIsIktleWJvYXJkU2hvcnRjdXRIaW50IiwiQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IiwiQnlsaW5lIiwidXNlVGFiSGVhZGVyRm9jdXMiLCJ1c2VJc0luc2lkZU1vZGFsIiwiU2VhcmNoQm94IiwiaXNTdXBwb3J0ZWRUZXJtaW5hbCIsImhhc0FjY2Vzc1RvSURFRXh0ZW5zaW9uRGlmZkZlYXR1cmUiLCJnZXRJbml0aWFsU2V0dGluZ3MiLCJnZXRTZXR0aW5nc0ZvclNvdXJjZSIsInVwZGF0ZVNldHRpbmdzRm9yU291cmNlIiwiZ2V0VXNlck1zZ09wdEluIiwic2V0VXNlck1zZ09wdEluIiwiREVGQVVMVF9PVVRQVVRfU1RZTEVfTkFNRSIsImlzRW52VHJ1dGh5IiwiaXNSdW5uaW5nT25Ib21lc3BhY2UiLCJMb2NhbEpTWENvbW1hbmRDb250ZXh0IiwiQ29tbWFuZFJlc3VsdERpc3BsYXkiLCJnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSIsImlzQWdlbnRTd2FybXNFbmFibGVkIiwiZ2V0Q2xpVGVhbW1hdGVNb2RlT3ZlcnJpZGUiLCJjbGVhckNsaVRlYW1tYXRlTW9kZU92ZXJyaWRlIiwiZ2V0SGFyZGNvZGVkVGVhbW1hdGVNb2RlbEZhbGxiYWNrIiwidXNlU2VhcmNoSW5wdXQiLCJ1c2VUZXJtaW5hbFNpemUiLCJjbGVhckZhc3RNb2RlQ29vbGRvd24iLCJGQVNUX01PREVfTU9ERUxfRElTUExBWSIsImlzRmFzdE1vZGVBdmFpbGFibGUiLCJpc0Zhc3RNb2RlRW5hYmxlZCIsImdldEZhc3RNb2RlTW9kZWwiLCJpc0Zhc3RNb2RlU3VwcG9ydGVkQnlNb2RlbCIsImlzRnVsbHNjcmVlbkVudkVuYWJsZWQiLCJQcm9wcyIsIm9uQ2xvc2UiLCJyZXN1bHQiLCJvcHRpb25zIiwiZGlzcGxheSIsImNvbnRleHQiLCJzZXRUYWJzSGlkZGVuIiwiaGlkZGVuIiwib25Jc1NlYXJjaE1vZGVDaGFuZ2UiLCJpblNlYXJjaE1vZGUiLCJjb250ZW50SGVpZ2h0IiwiU2V0dGluZ0Jhc2UiLCJpZCIsImxhYmVsIiwiUmVhY3ROb2RlIiwic2VhcmNoVGV4dCIsIlNldHRpbmciLCJ2YWx1ZSIsIm9uQ2hhbmdlIiwidHlwZSIsIlN1Yk1lbnUiLCJDb25maWciLCJoZWFkZXJGb2N1c2VkIiwiZm9jdXNIZWFkZXIiLCJpbnNpZGVNb2RhbCIsInNldFRoZW1lIiwidGhlbWVTZXR0aW5nIiwiZ2xvYmFsQ29uZmlnIiwic2V0R2xvYmFsQ29uZmlnIiwiaW5pdGlhbENvbmZpZyIsInVzZVJlZiIsInNldHRpbmdzRGF0YSIsInNldFNldHRpbmdzRGF0YSIsImluaXRpYWxTZXR0aW5nc0RhdGEiLCJjdXJyZW50T3V0cHV0U3R5bGUiLCJzZXRDdXJyZW50T3V0cHV0U3R5bGUiLCJvdXRwdXRTdHlsZSIsImluaXRpYWxPdXRwdXRTdHlsZSIsImN1cnJlbnRMYW5ndWFnZSIsInNldEN1cnJlbnRMYW5ndWFnZSIsImxhbmd1YWdlIiwiaW5pdGlhbExhbmd1YWdlIiwic2VsZWN0ZWRJbmRleCIsInNldFNlbGVjdGVkSW5kZXgiLCJzY3JvbGxPZmZzZXQiLCJzZXRTY3JvbGxPZmZzZXQiLCJpc1NlYXJjaE1vZGUiLCJzZXRJc1NlYXJjaE1vZGUiLCJpc1Rlcm1pbmFsRm9jdXNlZCIsInJvd3MiLCJwYW5lQ2FwIiwiTWF0aCIsIm1pbiIsImZsb29yIiwibWF4VmlzaWJsZSIsIm1heCIsIm1haW5Mb29wTW9kZWwiLCJzIiwidmVyYm9zZSIsInRoaW5raW5nRW5hYmxlZCIsImlzRmFzdE1vZGUiLCJmYXN0TW9kZSIsInByb21wdFN1Z2dlc3Rpb25FbmFibGVkIiwic2hvd0F1dG9JbkRlZmF1bHRNb2RlUGlja2VyIiwic2hvd0RlZmF1bHRWaWV3UGlja2VyIiwicmVxdWlyZSIsImlzQnJpZWZFbnRpdGxlZCIsInNldEFwcFN0YXRlIiwiY2hhbmdlcyIsInNldENoYW5nZXMiLCJrZXkiLCJpbml0aWFsVGhpbmtpbmdFbmFibGVkIiwiaW5pdGlhbExvY2FsU2V0dGluZ3MiLCJpbml0aWFsVXNlclNldHRpbmdzIiwiaW5pdGlhbFRoZW1lU2V0dGluZyIsInN0b3JlIiwiaW5pdGlhbEFwcFN0YXRlIiwiZ2V0U3RhdGUiLCJtYWluTG9vcE1vZGVsRm9yU2Vzc2lvbiIsImlzQnJpZWZPbmx5IiwicmVwbEJyaWRnZUVuYWJsZWQiLCJyZXBsQnJpZGdlT3V0Ym91bmRPbmx5Iiwic2V0dGluZ3MiLCJpbml0aWFsVXNlck1zZ09wdEluIiwiaXNEaXJ0eSIsInNob3dUaGlua2luZ1dhcm5pbmciLCJzZXRTaG93VGhpbmtpbmdXYXJuaW5nIiwic2hvd1N1Ym1lbnUiLCJzZXRTaG93U3VibWVudSIsInF1ZXJ5Iiwic2VhcmNoUXVlcnkiLCJzZXRRdWVyeSIsInNldFNlYXJjaFF1ZXJ5IiwiY3Vyc29yT2Zmc2V0Iiwic2VhcmNoQ3Vyc29yT2Zmc2V0IiwiaXNBY3RpdmUiLCJvbkV4aXQiLCJvbkV4aXRVcCIsInBhc3N0aHJvdWdoQ3RybEtleXMiLCJvd25zRXNjIiwidXNlRWZmZWN0IiwiaXNDb25uZWN0ZWRUb0lkZSIsIm1jcENsaWVudHMiLCJpc0ZpbGVDaGVja3BvaW50aW5nQXZhaWxhYmxlIiwicHJvY2VzcyIsImVudiIsIkNMQVVERV9DT0RFX0RJU0FCTEVfRklMRV9DSEVDS1BPSU5USU5HIiwibWVtb3J5RmlsZXMiLCJ1c2UiLCJzaG91bGRTaG93RXh0ZXJuYWxJbmNsdWRlc1RvZ2dsZSIsImF1dG9VcGRhdGVyRGlzYWJsZWRSZWFzb24iLCJvbkNoYW5nZU1haW5Nb2RlbENvbmZpZyIsInByZXZpb3VzTW9kZWwiLCJmcm9tX21vZGVsIiwidG9fbW9kZWwiLCJwcmV2IiwidmFsU3RyIiwibW9kZWwiLCJyZXN0Iiwib25DaGFuZ2VWZXJib3NlIiwiY3VycmVudCIsInNldHRpbmdzSXRlbXMiLCJhdXRvQ29tcGFjdEVuYWJsZWQiLCJjb25zdCIsImVuYWJsZWQiLCJzcGlubmVyVGlwc0VuYWJsZWQiLCJwcmVmZXJzUmVkdWNlZE1vdGlvbiIsImFsd2F5c1RoaW5raW5nRW5hYmxlZCIsInVuZGVmaW5lZCIsInNwZWN1bGF0aW9uRW5hYmxlZCIsImZpbGVDaGVja3BvaW50aW5nRW5hYmxlZCIsInRlcm1pbmFsUHJvZ3Jlc3NCYXJFbmFibGVkIiwic2hvd1N0YXR1c0luVGVybWluYWxUYWIiLCJzaG93VHVybkR1cmF0aW9uIiwicGVybWlzc2lvbnMiLCJkZWZhdWx0TW9kZSIsInByaW9yaXR5T3JkZXIiLCJhbGxNb2RlcyIsImV4Y2x1ZGVkIiwicHVzaCIsImZpbHRlciIsIm0iLCJpbmNsdWRlcyIsIm1vZGUiLCJwYXJzZWRNb2RlIiwidmFsaWRhdGVkTW9kZSIsImVycm9yIiwiZGVmYXVsdFBlcm1pc3Npb25Nb2RlIiwic2V0dGluZyIsInVzZUF1dG9Nb2RlRHVyaW5nUGxhbiIsIm5leHQiLCJ0b29sUGVybWlzc2lvbkNvbnRleHQiLCJyZXNwZWN0R2l0aWdub3JlIiwiY29weUZ1bGxSZXNwb25zZSIsIlN0cmluZyIsImNvcHlPblNlbGVjdCIsImF1dG9VcGRhdGVzQ2hhbm5lbCIsInByZWZlcnJlZE5vdGlmQ2hhbm5lbCIsIm5vdGlmQ2hhbm5lbCIsInRhc2tDb21wbGV0ZU5vdGlmRW5hYmxlZCIsImlucHV0TmVlZGVkTm90aWZFbmFibGVkIiwiYWdlbnRQdXNoTm90aWZFbmFibGVkIiwiZGVmYXVsdFZpZXciLCJzZWxlY3RlZCIsIm5leHRCcmllZiIsImVkaXRvck1vZGUiLCJzb3VyY2UiLCJwclN0YXR1c0Zvb3RlckVuYWJsZWQiLCJkaWZmVG9vbCIsInRvb2wiLCJhdXRvQ29ubmVjdElkZSIsImF1dG9JbnN0YWxsSWRlRXh0ZW5zaW9uIiwiY2xhdWRlSW5DaHJvbWVEZWZhdWx0RW5hYmxlZCIsImNsaU92ZXJyaWRlIiwidGVhbW1hdGVNb2RlIiwidGVhbW1hdGVNb2RlbERpc3BsYXlTdHJpbmciLCJ0ZWFtbWF0ZURlZmF1bHRNb2RlbCIsInJlbW90ZUNvbnRyb2xBdFN0YXJ0dXAiLCJyZXNvbHZlZCIsInByb2plY3RDb25maWciLCJoYXNDbGF1ZGVNZEV4dGVybmFsSW5jbHVkZXNBcHByb3ZlZCIsIkFOVEhST1BJQ19BUElfS0VZIiwiQm9vbGVhbiIsImN1c3RvbUFwaUtleVJlc3BvbnNlcyIsImFwcHJvdmVkIiwidXNlQ3VzdG9tS2V5IiwidXBkYXRlZCIsInJlamVjdGVkIiwidHJ1bmNhdGVkS2V5IiwiayIsImZpbHRlcmVkU2V0dGluZ3NJdGVtcyIsInVzZU1lbW8iLCJsb3dlclF1ZXJ5IiwidG9Mb3dlckNhc2UiLCJzZWFyY2hhYmxlVGV4dCIsImxlbmd0aCIsIm5ld0luZGV4IiwiYWRqdXN0U2Nyb2xsT2Zmc2V0IiwiaGFuZGxlU2F2ZUFuZENsb3NlIiwiZm9ybWF0dGVkQ2hhbmdlcyIsIk9iamVjdCIsImVudHJpZXMiLCJtYXAiLCJib2xkIiwiZWZmZWN0aXZlQXBpS2V5IiwiaW5pdGlhbFVzaW5nQ3VzdG9tS2V5IiwiY3VycmVudFVzaW5nQ3VzdG9tS2V5IiwidGhlbWUiLCJyZW1vdGVMYWJlbCIsImpvaW4iLCJSZWNvcmQiLCJyZXZlcnRDaGFuZ2VzIiwiaWwiLCJpdSIsIm1pbmltdW1WZXJzaW9uIiwic3ludGF4SGlnaGxpZ2h0aW5nRGlzYWJsZWQiLCJpYSIsImhhbmRsZUVzY2FwZSIsInRvZ2dsZVNldHRpbmciLCJuZXdWYWx1ZSIsImJhY2tUb0luaXRpYWwiLCJtZXNzYWdlcyIsInNvbWUiLCJjdXJyZW50Q2hhbm5lbCIsImNoYW5uZWwiLCJjdXJyZW50SW5kZXgiLCJpbmRleE9mIiwibmV4dEluZGV4IiwibW92ZVNlbGVjdGlvbiIsImRlbHRhIiwic2VsZWN0OnByZXZpb3VzIiwic2VsZWN0Om5leHQiLCJzY3JvbGw6bGluZVVwIiwic2Nyb2xsOmxpbmVEb3duIiwic2V0dGluZ3M6c2VhcmNoIiwiaGFuZGxlS2V5RG93biIsImUiLCJwcmV2ZW50RGVmYXVsdCIsImN0cmwiLCJtZXRhIiwiX2VmZm9ydCIsInN0eWxlIiwic2V0dGluZ3Nfc291cmNlIiwiZW52VmFyIiwiYXV0b1VwZGF0ZXMiLCJNQUNSTyIsIlZFUlNJT04iLCJjaG9pY2UiLCJuZXdTZXR0aW5ncyIsIm1pbmltdW1fdmVyc2lvbl9zZXQiLCJhcnJvd1VwIiwic2xpY2UiLCJpIiwiYWN0dWFsSW5kZXgiLCJpc1NlbGVjdGVkIiwicG9pbnRlciIsInRvU3RyaW5nIiwiVEhFTUVfTEFCRUxTIiwiYXJyb3dEb3duIiwiYXV0byIsImRhcmsiLCJsaWdodCIsIk5vdGlmQ2hhbm5lbExhYmVsIiwidDAiLCIkIiwiX2MiLCJ0MSIsIlN5bWJvbCIsImZvciJdLCJzb3VyY2VzIjpbIkNvbmZpZy50c3giXSwic291cmNlc0NvbnRlbnQiOlsiLy8gYmlvbWUtaWdub3JlLWFsbCBhc3Npc3Qvc291cmNlL29yZ2FuaXplSW1wb3J0czogQU5ULU9OTFkgaW1wb3J0IG1hcmtlcnMgbXVzdCBub3QgYmUgcmVvcmRlcmVkXG5pbXBvcnQgeyBmZWF0dXJlIH0gZnJvbSAnYnVuOmJ1bmRsZSdcbmltcG9ydCB7XG4gIEJveCxcbiAgVGV4dCxcbiAgdXNlVGhlbWUsXG4gIHVzZVRoZW1lU2V0dGluZyxcbiAgdXNlVGVybWluYWxGb2N1cyxcbn0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHR5cGUgeyBLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vaW5rL2V2ZW50cy9rZXlib2FyZC1ldmVudC5qcydcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlU3RhdGUsIHVzZUNhbGxiYWNrIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQge1xuICB1c2VLZXliaW5kaW5nLFxuICB1c2VLZXliaW5kaW5ncyxcbn0gZnJvbSAnLi4vLi4va2V5YmluZGluZ3MvdXNlS2V5YmluZGluZy5qcydcbmltcG9ydCBmaWd1cmVzIGZyb20gJ2ZpZ3VyZXMnXG5pbXBvcnQge1xuICB0eXBlIEdsb2JhbENvbmZpZyxcbiAgc2F2ZUdsb2JhbENvbmZpZyxcbiAgZ2V0Q3VycmVudFByb2plY3RDb25maWcsXG4gIHR5cGUgT3V0cHV0U3R5bGUsXG59IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcydcbmltcG9ydCB7IG5vcm1hbGl6ZUFwaUtleUZvckNvbmZpZyB9IGZyb20gJy4uLy4uL3V0aWxzL2F1dGhQb3J0YWJsZS5qcydcbmltcG9ydCB7XG4gIGdldEdsb2JhbENvbmZpZyxcbiAgZ2V0QXV0b1VwZGF0ZXJEaXNhYmxlZFJlYXNvbixcbiAgZm9ybWF0QXV0b1VwZGF0ZXJEaXNhYmxlZFJlYXNvbixcbiAgZ2V0UmVtb3RlQ29udHJvbEF0U3RhcnR1cCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJ1xuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJ1xuaW1wb3J0IHtcbiAgcGVybWlzc2lvbk1vZGVUaXRsZSxcbiAgcGVybWlzc2lvbk1vZGVGcm9tU3RyaW5nLFxuICB0b0V4dGVybmFsUGVybWlzc2lvbk1vZGUsXG4gIGlzRXh0ZXJuYWxQZXJtaXNzaW9uTW9kZSxcbiAgRVhURVJOQUxfUEVSTUlTU0lPTl9NT0RFUyxcbiAgUEVSTUlTU0lPTl9NT0RFUyxcbiAgdHlwZSBFeHRlcm5hbFBlcm1pc3Npb25Nb2RlLFxuICB0eXBlIFBlcm1pc3Npb25Nb2RlLFxufSBmcm9tICcuLi8uLi91dGlscy9wZXJtaXNzaW9ucy9QZXJtaXNzaW9uTW9kZS5qcydcbmltcG9ydCB7XG4gIGdldEF1dG9Nb2RlRW5hYmxlZFN0YXRlLFxuICBoYXNBdXRvTW9kZU9wdEluQW55U291cmNlLFxuICB0cmFuc2l0aW9uUGxhbkF1dG9Nb2RlLFxufSBmcm9tICcuLi8uLi91dGlscy9wZXJtaXNzaW9ucy9wZXJtaXNzaW9uU2V0dXAuanMnXG5pbXBvcnQgeyBsb2dFcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2xvZy5qcydcbmltcG9ydCB7XG4gIGxvZ0V2ZW50LFxuICB0eXBlIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG59IGZyb20gJ3NyYy9zZXJ2aWNlcy9hbmFseXRpY3MvaW5kZXguanMnXG5pbXBvcnQgeyBpc0JyaWRnZUVuYWJsZWQgfSBmcm9tICcuLi8uLi9icmlkZ2UvYnJpZGdlRW5hYmxlZC5qcydcbmltcG9ydCB7IFRoZW1lUGlja2VyIH0gZnJvbSAnLi4vVGhlbWVQaWNrZXIuanMnXG5pbXBvcnQge1xuICB1c2VBcHBTdGF0ZSxcbiAgdXNlU2V0QXBwU3RhdGUsXG4gIHVzZUFwcFN0YXRlU3RvcmUsXG59IGZyb20gJy4uLy4uL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHsgTW9kZWxQaWNrZXIgfSBmcm9tICcuLi9Nb2RlbFBpY2tlci5qcydcbmltcG9ydCB7XG4gIG1vZGVsRGlzcGxheVN0cmluZyxcbiAgaXNPcHVzMW1NZXJnZUVuYWJsZWQsXG59IGZyb20gJy4uLy4uL3V0aWxzL21vZGVsL21vZGVsLmpzJ1xuaW1wb3J0IHsgaXNCaWxsZWRBc0V4dHJhVXNhZ2UgfSBmcm9tICcuLi8uLi91dGlscy9leHRyYVVzYWdlLmpzJ1xuaW1wb3J0IHsgQ2xhdWRlTWRFeHRlcm5hbEluY2x1ZGVzRGlhbG9nIH0gZnJvbSAnLi4vQ2xhdWRlTWRFeHRlcm5hbEluY2x1ZGVzRGlhbG9nLmpzJ1xuaW1wb3J0IHtcbiAgQ2hhbm5lbERvd25ncmFkZURpYWxvZyxcbiAgdHlwZSBDaGFubmVsRG93bmdyYWRlQ2hvaWNlLFxufSBmcm9tICcuLi9DaGFubmVsRG93bmdyYWRlRGlhbG9nLmpzJ1xuaW1wb3J0IHsgRGlhbG9nIH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9EaWFsb2cuanMnXG5pbXBvcnQgeyBTZWxlY3QgfSBmcm9tICcuLi9DdXN0b21TZWxlY3QvaW5kZXguanMnXG5pbXBvcnQgeyBPdXRwdXRTdHlsZVBpY2tlciB9IGZyb20gJy4uL091dHB1dFN0eWxlUGlja2VyLmpzJ1xuaW1wb3J0IHsgTGFuZ3VhZ2VQaWNrZXIgfSBmcm9tICcuLi9MYW5ndWFnZVBpY2tlci5qcydcbmltcG9ydCB7XG4gIGdldEV4dGVybmFsQ2xhdWRlTWRJbmNsdWRlcyxcbiAgZ2V0TWVtb3J5RmlsZXMsXG4gIGhhc0V4dGVybmFsQ2xhdWRlTWRJbmNsdWRlcyxcbn0gZnJvbSAnc3JjL3V0aWxzL2NsYXVkZW1kLmpzJ1xuaW1wb3J0IHsgS2V5Ym9hcmRTaG9ydGN1dEhpbnQgfSBmcm9tICcuLi9kZXNpZ24tc3lzdGVtL0tleWJvYXJkU2hvcnRjdXRIaW50LmpzJ1xuaW1wb3J0IHsgQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IH0gZnJvbSAnLi4vQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50LmpzJ1xuaW1wb3J0IHsgQnlsaW5lIH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9CeWxpbmUuanMnXG5pbXBvcnQgeyB1c2VUYWJIZWFkZXJGb2N1cyB9IGZyb20gJy4uL2Rlc2lnbi1zeXN0ZW0vVGFicy5qcydcbmltcG9ydCB7IHVzZUlzSW5zaWRlTW9kYWwgfSBmcm9tICcuLi8uLi9jb250ZXh0L21vZGFsQ29udGV4dC5qcydcbmltcG9ydCB7IFNlYXJjaEJveCB9IGZyb20gJy4uL1NlYXJjaEJveC5qcydcbmltcG9ydCB7XG4gIGlzU3VwcG9ydGVkVGVybWluYWwsXG4gIGhhc0FjY2Vzc1RvSURFRXh0ZW5zaW9uRGlmZkZlYXR1cmUsXG59IGZyb20gJy4uLy4uL3V0aWxzL2lkZS5qcydcbmltcG9ydCB7XG4gIGdldEluaXRpYWxTZXR0aW5ncyxcbiAgZ2V0U2V0dGluZ3NGb3JTb3VyY2UsXG4gIHVwZGF0ZVNldHRpbmdzRm9yU291cmNlLFxufSBmcm9tICcuLi8uLi91dGlscy9zZXR0aW5ncy9zZXR0aW5ncy5qcydcbmltcG9ydCB7IGdldFVzZXJNc2dPcHRJbiwgc2V0VXNlck1zZ09wdEluIH0gZnJvbSAnLi4vLi4vYm9vdHN0cmFwL3N0YXRlLmpzJ1xuaW1wb3J0IHsgREVGQVVMVF9PVVRQVVRfU1RZTEVfTkFNRSB9IGZyb20gJ3NyYy9jb25zdGFudHMvb3V0cHV0U3R5bGVzLmpzJ1xuaW1wb3J0IHsgaXNFbnZUcnV0aHksIGlzUnVubmluZ09uSG9tZXNwYWNlIH0gZnJvbSAnc3JjL3V0aWxzL2VudlV0aWxzLmpzJ1xuaW1wb3J0IHR5cGUge1xuICBMb2NhbEpTWENvbW1hbmRDb250ZXh0LFxuICBDb21tYW5kUmVzdWx0RGlzcGxheSxcbn0gZnJvbSAnLi4vLi4vY29tbWFuZHMuanMnXG5pbXBvcnQgeyBnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2FuYWx5dGljcy9ncm93dGhib29rLmpzJ1xuaW1wb3J0IHsgaXNBZ2VudFN3YXJtc0VuYWJsZWQgfSBmcm9tICcuLi8uLi91dGlscy9hZ2VudFN3YXJtc0VuYWJsZWQuanMnXG5pbXBvcnQge1xuICBnZXRDbGlUZWFtbWF0ZU1vZGVPdmVycmlkZSxcbiAgY2xlYXJDbGlUZWFtbWF0ZU1vZGVPdmVycmlkZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvc3dhcm0vYmFja2VuZHMvdGVhbW1hdGVNb2RlU25hcHNob3QuanMnXG5pbXBvcnQgeyBnZXRIYXJkY29kZWRUZWFtbWF0ZU1vZGVsRmFsbGJhY2sgfSBmcm9tICcuLi8uLi91dGlscy9zd2FybS90ZWFtbWF0ZU1vZGVsLmpzJ1xuaW1wb3J0IHsgdXNlU2VhcmNoSW5wdXQgfSBmcm9tICcuLi8uLi9ob29rcy91c2VTZWFyY2hJbnB1dC5qcydcbmltcG9ydCB7IHVzZVRlcm1pbmFsU2l6ZSB9IGZyb20gJy4uLy4uL2hvb2tzL3VzZVRlcm1pbmFsU2l6ZS5qcydcbmltcG9ydCB7XG4gIGNsZWFyRmFzdE1vZGVDb29sZG93bixcbiAgRkFTVF9NT0RFX01PREVMX0RJU1BMQVksXG4gIGlzRmFzdE1vZGVBdmFpbGFibGUsXG4gIGlzRmFzdE1vZGVFbmFibGVkLFxuICBnZXRGYXN0TW9kZU1vZGVsLFxuICBpc0Zhc3RNb2RlU3VwcG9ydGVkQnlNb2RlbCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvZmFzdE1vZGUuanMnXG5pbXBvcnQgeyBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkIH0gZnJvbSAnLi4vLi4vdXRpbHMvZnVsbHNjcmVlbi5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgb25DbG9zZTogKFxuICAgIHJlc3VsdD86IHN0cmluZyxcbiAgICBvcHRpb25zPzogeyBkaXNwbGF5PzogQ29tbWFuZFJlc3VsdERpc3BsYXkgfSxcbiAgKSA9PiB2b2lkXG4gIGNvbnRleHQ6IExvY2FsSlNYQ29tbWFuZENvbnRleHRcbiAgc2V0VGFic0hpZGRlbjogKGhpZGRlbjogYm9vbGVhbikgPT4gdm9pZFxuICBvbklzU2VhcmNoTW9kZUNoYW5nZT86IChpblNlYXJjaE1vZGU6IGJvb2xlYW4pID0+IHZvaWRcbiAgY29udGVudEhlaWdodD86IG51bWJlclxufVxuXG50eXBlIFNldHRpbmdCYXNlID1cbiAgfCB7XG4gICAgICBpZDogc3RyaW5nXG4gICAgICBsYWJlbDogc3RyaW5nXG4gICAgfVxuICB8IHtcbiAgICAgIGlkOiBzdHJpbmdcbiAgICAgIGxhYmVsOiBSZWFjdC5SZWFjdE5vZGVcbiAgICAgIHNlYXJjaFRleHQ6IHN0cmluZ1xuICAgIH1cblxudHlwZSBTZXR0aW5nID1cbiAgfCAoU2V0dGluZ0Jhc2UgJiB7XG4gICAgICB2YWx1ZTogYm9vbGVhblxuICAgICAgb25DaGFuZ2UodmFsdWU6IGJvb2xlYW4pOiB2b2lkXG4gICAgICB0eXBlOiAnYm9vbGVhbidcbiAgICB9KVxuICB8IChTZXR0aW5nQmFzZSAmIHtcbiAgICAgIHZhbHVlOiBzdHJpbmdcbiAgICAgIG9wdGlvbnM6IHN0cmluZ1tdXG4gICAgICBvbkNoYW5nZSh2YWx1ZTogc3RyaW5nKTogdm9pZFxuICAgICAgdHlwZTogJ2VudW0nXG4gICAgfSlcbiAgfCAoU2V0dGluZ0Jhc2UgJiB7XG4gICAgICAvLyBGb3IgZW51bXMgdGhhdCBhcmUgc2V0IGJ5IGEgY3VzdG9tIGNvbXBvbmVudCwgd2UgZG9uJ3QgbmVlZCB0byBwYXNzIG9wdGlvbnMsXG4gICAgICAvLyBidXQgd2Ugc3RpbGwgbmVlZCBhIHZhbHVlIHRvIGRpc3BsYXkgaW4gdGhlIHRvcC1sZXZlbCBjb25maWcgbWVudVxuICAgICAgdmFsdWU6IHN0cmluZ1xuICAgICAgb25DaGFuZ2UodmFsdWU6IHN0cmluZyk6IHZvaWRcbiAgICAgIHR5cGU6ICdtYW5hZ2VkRW51bSdcbiAgICB9KVxuXG50eXBlIFN1Yk1lbnUgPVxuICB8ICdUaGVtZSdcbiAgfCAnTW9kZWwnXG4gIHwgJ1RlYW1tYXRlTW9kZWwnXG4gIHwgJ0V4dGVybmFsSW5jbHVkZXMnXG4gIHwgJ091dHB1dFN0eWxlJ1xuICB8ICdDaGFubmVsRG93bmdyYWRlJ1xuICB8ICdMYW5ndWFnZSdcbiAgfCAnRW5hYmxlQXV0b1VwZGF0ZXMnXG5leHBvcnQgZnVuY3Rpb24gQ29uZmlnKHtcbiAgb25DbG9zZSxcbiAgY29udGV4dCxcbiAgc2V0VGFic0hpZGRlbixcbiAgb25Jc1NlYXJjaE1vZGVDaGFuZ2UsXG4gIGNvbnRlbnRIZWlnaHQsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHsgaGVhZGVyRm9jdXNlZCwgZm9jdXNIZWFkZXIgfSA9IHVzZVRhYkhlYWRlckZvY3VzKClcbiAgY29uc3QgaW5zaWRlTW9kYWwgPSB1c2VJc0luc2lkZU1vZGFsKClcbiAgY29uc3QgWywgc2V0VGhlbWVdID0gdXNlVGhlbWUoKVxuICBjb25zdCB0aGVtZVNldHRpbmcgPSB1c2VUaGVtZVNldHRpbmcoKVxuICBjb25zdCBbZ2xvYmFsQ29uZmlnLCBzZXRHbG9iYWxDb25maWddID0gdXNlU3RhdGUoZ2V0R2xvYmFsQ29uZmlnKCkpXG4gIGNvbnN0IGluaXRpYWxDb25maWcgPSBSZWFjdC51c2VSZWYoZ2V0R2xvYmFsQ29uZmlnKCkpXG4gIGNvbnN0IFtzZXR0aW5nc0RhdGEsIHNldFNldHRpbmdzRGF0YV0gPSB1c2VTdGF0ZShnZXRJbml0aWFsU2V0dGluZ3MoKSlcbiAgY29uc3QgaW5pdGlhbFNldHRpbmdzRGF0YSA9IFJlYWN0LnVzZVJlZihnZXRJbml0aWFsU2V0dGluZ3MoKSlcbiAgY29uc3QgW2N1cnJlbnRPdXRwdXRTdHlsZSwgc2V0Q3VycmVudE91dHB1dFN0eWxlXSA9IHVzZVN0YXRlPE91dHB1dFN0eWxlPihcbiAgICBzZXR0aW5nc0RhdGE/Lm91dHB1dFN0eWxlIHx8IERFRkFVTFRfT1VUUFVUX1NUWUxFX05BTUUsXG4gIClcbiAgY29uc3QgaW5pdGlhbE91dHB1dFN0eWxlID0gUmVhY3QudXNlUmVmKGN1cnJlbnRPdXRwdXRTdHlsZSlcbiAgY29uc3QgW2N1cnJlbnRMYW5ndWFnZSwgc2V0Q3VycmVudExhbmd1YWdlXSA9IHVzZVN0YXRlPHN0cmluZyB8IHVuZGVmaW5lZD4oXG4gICAgc2V0dGluZ3NEYXRhPy5sYW5ndWFnZSxcbiAgKVxuICBjb25zdCBpbml0aWFsTGFuZ3VhZ2UgPSBSZWFjdC51c2VSZWYoY3VycmVudExhbmd1YWdlKVxuICBjb25zdCBbc2VsZWN0ZWRJbmRleCwgc2V0U2VsZWN0ZWRJbmRleF0gPSB1c2VTdGF0ZSgwKVxuICBjb25zdCBbc2Nyb2xsT2Zmc2V0LCBzZXRTY3JvbGxPZmZzZXRdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgW2lzU2VhcmNoTW9kZSwgc2V0SXNTZWFyY2hNb2RlXSA9IHVzZVN0YXRlKHRydWUpXG4gIGNvbnN0IGlzVGVybWluYWxGb2N1c2VkID0gdXNlVGVybWluYWxGb2N1cygpXG4gIGNvbnN0IHsgcm93cyB9ID0gdXNlVGVybWluYWxTaXplKClcbiAgLy8gY29udGVudEhlaWdodCBpcyBzZXQgYnkgU2V0dGluZ3MudHN4IChzYW1lIHZhbHVlIHBhc3NlZCB0byBUYWJzIHRvIGZpeFxuICAvLyBwYW5lIGhlaWdodCBhY3Jvc3MgYWxsIHRhYnMg4oCUIHByZXZlbnRzIGxheW91dCBqYW5rIHdoZW4gc3dpdGNoaW5nKS5cbiAgLy8gUmVzZXJ2ZSB+MTAgcm93cyBmb3IgY2hyb21lIChzZWFyY2ggYm94LCBnYXBzLCBmb290ZXIsIHNjcm9sbCBoaW50cykuXG4gIC8vIEZhbGxiYWNrIGNhbGMgZm9yIHN0YW5kYWxvbmUgcmVuZGVyaW5nICh0ZXN0cykuXG4gIGNvbnN0IHBhbmVDYXAgPSBjb250ZW50SGVpZ2h0ID8/IE1hdGgubWluKE1hdGguZmxvb3Iocm93cyAqIDAuOCksIDMwKVxuICBjb25zdCBtYXhWaXNpYmxlID0gTWF0aC5tYXgoNSwgcGFuZUNhcCAtIDEwKVxuICBjb25zdCBtYWluTG9vcE1vZGVsID0gdXNlQXBwU3RhdGUocyA9PiBzLm1haW5Mb29wTW9kZWwpXG4gIGNvbnN0IHZlcmJvc2UgPSB1c2VBcHBTdGF0ZShzID0+IHMudmVyYm9zZSlcbiAgY29uc3QgdGhpbmtpbmdFbmFibGVkID0gdXNlQXBwU3RhdGUocyA9PiBzLnRoaW5raW5nRW5hYmxlZClcbiAgY29uc3QgaXNGYXN0TW9kZSA9IHVzZUFwcFN0YXRlKHMgPT5cbiAgICBpc0Zhc3RNb2RlRW5hYmxlZCgpID8gcy5mYXN0TW9kZSA6IGZhbHNlLFxuICApXG4gIGNvbnN0IHByb21wdFN1Z2dlc3Rpb25FbmFibGVkID0gdXNlQXBwU3RhdGUocyA9PiBzLnByb21wdFN1Z2dlc3Rpb25FbmFibGVkKVxuICAvLyBTaG93IGF1dG8gaW4gdGhlIGRlZmF1bHQtbW9kZSBkcm9wZG93biB3aGVuIHRoZSB1c2VyIGhhcyBvcHRlZCBpbiBPUiB0aGVcbiAgLy8gY29uZmlnIGlzIGZ1bGx5ICdlbmFibGVkJyDigJQgZXZlbiBpZiBjdXJyZW50bHkgY2lyY3VpdC1icm9rZW4gKCdkaXNhYmxlZCcpLFxuICAvLyBhbiBvcHRlZC1pbiB1c2VyIHNob3VsZCBzdGlsbCBzZWUgaXQgaW4gc2V0dGluZ3MgKGl0J3MgYSB0ZW1wb3Jhcnkgc3RhdGUpLlxuICBjb25zdCBzaG93QXV0b0luRGVmYXVsdE1vZGVQaWNrZXIgPSBmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKVxuICAgID8gaGFzQXV0b01vZGVPcHRJbkFueVNvdXJjZSgpIHx8IGdldEF1dG9Nb2RlRW5hYmxlZFN0YXRlKCkgPT09ICdlbmFibGVkJ1xuICAgIDogZmFsc2VcbiAgLy8gQ2hhdC9UcmFuc2NyaXB0IHZpZXcgcGlja2VyIGlzIHZpc2libGUgdG8gZW50aXRsZWQgdXNlcnMgKHBhc3MgdGhlIEdCXG4gIC8vIGdhdGUpIGV2ZW4gaWYgdGhleSBoYXZlbid0IG9wdGVkIGluIHRoaXMgc2Vzc2lvbiDigJQgaXQgSVMgdGhlIHBlcnNpc3RlbnRcbiAgLy8gb3B0LWluLiAnY2hhdCcgd3JpdHRlbiBoZXJlIGlzIHJlYWQgYXQgbmV4dCBzdGFydHVwIGJ5IG1haW4udHN4IHdoaWNoXG4gIC8vIHNldHMgdXNlck1zZ09wdEluIGlmIHN0aWxsIGVudGl0bGVkLlxuICAvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gIGNvbnN0IHNob3dEZWZhdWx0Vmlld1BpY2tlciA9XG4gICAgZmVhdHVyZSgnS0FJUk9TJykgfHwgZmVhdHVyZSgnS0FJUk9TX0JSSUVGJylcbiAgICAgID8gKFxuICAgICAgICAgIHJlcXVpcmUoJy4uLy4uL3Rvb2xzL0JyaWVmVG9vbC9CcmllZlRvb2wuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuLi8uLi90b29scy9CcmllZlRvb2wvQnJpZWZUb29sLmpzJylcbiAgICAgICAgKS5pc0JyaWVmRW50aXRsZWQoKVxuICAgICAgOiBmYWxzZVxuICAvKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgY29uc3Qgc2V0QXBwU3RhdGUgPSB1c2VTZXRBcHBTdGF0ZSgpXG4gIGNvbnN0IFtjaGFuZ2VzLCBzZXRDaGFuZ2VzXSA9IHVzZVN0YXRlPHsgW2tleTogc3RyaW5nXTogdW5rbm93biB9Pih7fSlcbiAgY29uc3QgaW5pdGlhbFRoaW5raW5nRW5hYmxlZCA9IFJlYWN0LnVzZVJlZih0aGlua2luZ0VuYWJsZWQpXG4gIC8vIFBlci1zb3VyY2Ugc2V0dGluZ3Mgc25hcHNob3RzIGZvciByZXZlcnQtb24tZXNjYXBlLiBnZXRJbml0aWFsU2V0dGluZ3MoKVxuICAvLyByZXR1cm5zIG1lcmdlZC1hY3Jvc3Mtc291cmNlcyB3aGljaCBjYW4ndCB0ZWxsIHVzIHdoYXQgdG8gZGVsZXRlIHZzXG4gIC8vIHJlc3RvcmU7IHBlci1zb3VyY2Ugc25hcHNob3RzICsgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2Unc1xuICAvLyB1bmRlZmluZWQtZGVsZXRlcy1rZXkgc2VtYW50aWNzIGNhbi4gTGF6eS1pbml0IHZpYSB1c2VTdGF0ZSAobm8gc2V0dGVyKSB0b1xuICAvLyBhdm9pZCByZWFkaW5nIHNldHRpbmdzIGZpbGVzIG9uIGV2ZXJ5IHJlbmRlciDigJQgdXNlUmVmIGV2YWx1YXRlcyBpdHMgYXJnXG4gIC8vIGVhZ2VybHkgZXZlbiB0aG91Z2ggb25seSB0aGUgZmlyc3QgcmVzdWx0IGlzIGtlcHQuXG4gIGNvbnN0IFtpbml0aWFsTG9jYWxTZXR0aW5nc10gPSB1c2VTdGF0ZSgoKSA9PlxuICAgIGdldFNldHRpbmdzRm9yU291cmNlKCdsb2NhbFNldHRpbmdzJyksXG4gIClcbiAgY29uc3QgW2luaXRpYWxVc2VyU2V0dGluZ3NdID0gdXNlU3RhdGUoKCkgPT5cbiAgICBnZXRTZXR0aW5nc0ZvclNvdXJjZSgndXNlclNldHRpbmdzJyksXG4gIClcbiAgY29uc3QgaW5pdGlhbFRoZW1lU2V0dGluZyA9IFJlYWN0LnVzZVJlZih0aGVtZVNldHRpbmcpXG4gIC8vIEFwcFN0YXRlIGZpZWxkcyBDb25maWcgbWF5IG1vZGlmeSDigJQgc25hcHNob3Qgb25jZSBhdCBtb3VudC5cbiAgY29uc3Qgc3RvcmUgPSB1c2VBcHBTdGF0ZVN0b3JlKClcbiAgY29uc3QgW2luaXRpYWxBcHBTdGF0ZV0gPSB1c2VTdGF0ZSgoKSA9PiB7XG4gICAgY29uc3QgcyA9IHN0b3JlLmdldFN0YXRlKClcbiAgICByZXR1cm4ge1xuICAgICAgbWFpbkxvb3BNb2RlbDogcy5tYWluTG9vcE1vZGVsLFxuICAgICAgbWFpbkxvb3BNb2RlbEZvclNlc3Npb246IHMubWFpbkxvb3BNb2RlbEZvclNlc3Npb24sXG4gICAgICB2ZXJib3NlOiBzLnZlcmJvc2UsXG4gICAgICB0aGlua2luZ0VuYWJsZWQ6IHMudGhpbmtpbmdFbmFibGVkLFxuICAgICAgZmFzdE1vZGU6IHMuZmFzdE1vZGUsXG4gICAgICBwcm9tcHRTdWdnZXN0aW9uRW5hYmxlZDogcy5wcm9tcHRTdWdnZXN0aW9uRW5hYmxlZCxcbiAgICAgIGlzQnJpZWZPbmx5OiBzLmlzQnJpZWZPbmx5LFxuICAgICAgcmVwbEJyaWRnZUVuYWJsZWQ6IHMucmVwbEJyaWRnZUVuYWJsZWQsXG4gICAgICByZXBsQnJpZGdlT3V0Ym91bmRPbmx5OiBzLnJlcGxCcmlkZ2VPdXRib3VuZE9ubHksXG4gICAgICBzZXR0aW5nczogcy5zZXR0aW5ncyxcbiAgICB9XG4gIH0pXG4gIC8vIEJvb3RzdHJhcCBzdGF0ZSBzbmFwc2hvdCDigJQgdXNlck1zZ09wdEluIGlzIG91dHNpZGUgQXBwU3RhdGUsIHNvXG4gIC8vIHJldmVydENoYW5nZXMgbmVlZHMgdG8gcmVzdG9yZSBpdCBzZXBhcmF0ZWx5LiBXaXRob3V0IHRoaXMsIGN5Y2xpbmdcbiAgLy8gZGVmYXVsdFZpZXcgdG8gJ2NoYXQnIHRoZW4gRXNjYXBlIGxlYXZlcyB0aGUgdG9vbCBhY3RpdmUgd2hpbGUgdGhlXG4gIC8vIGRpc3BsYXkgZmlsdGVyIHJldmVydHMg4oCUIHRoZSBleGFjdCBhbWJpZW50LWFjdGl2YXRpb24gYmVoYXZpb3IgdGhpc1xuICAvLyBQUidzIGVudGl0bGVtZW50L29wdC1pbiBzcGxpdCBpcyBtZWFudCB0byBwcmV2ZW50LlxuICBjb25zdCBbaW5pdGlhbFVzZXJNc2dPcHRJbl0gPSB1c2VTdGF0ZSgoKSA9PiBnZXRVc2VyTXNnT3B0SW4oKSlcbiAgLy8gU2V0IG9uIGZpcnN0IHVzZXItdmlzaWJsZSBjaGFuZ2U7IGdhdGVzIHJldmVydENoYW5nZXMoKSBvbiBFc2NhcGUgc29cbiAgLy8gb3BlbmluZy10aGVuLWNsb3NpbmcgZG9lc24ndCB0cmlnZ2VyIHJlZHVuZGFudCBkaXNrIHdyaXRlcy5cbiAgY29uc3QgaXNEaXJ0eSA9IFJlYWN0LnVzZVJlZihmYWxzZSlcbiAgY29uc3QgW3Nob3dUaGlua2luZ1dhcm5pbmcsIHNldFNob3dUaGlua2luZ1dhcm5pbmddID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtzaG93U3VibWVudSwgc2V0U2hvd1N1Ym1lbnVdID0gdXNlU3RhdGU8U3ViTWVudSB8IG51bGw+KG51bGwpXG4gIGNvbnN0IHtcbiAgICBxdWVyeTogc2VhcmNoUXVlcnksXG4gICAgc2V0UXVlcnk6IHNldFNlYXJjaFF1ZXJ5LFxuICAgIGN1cnNvck9mZnNldDogc2VhcmNoQ3Vyc29yT2Zmc2V0LFxuICB9ID0gdXNlU2VhcmNoSW5wdXQoe1xuICAgIGlzQWN0aXZlOiBpc1NlYXJjaE1vZGUgJiYgc2hvd1N1Ym1lbnUgPT09IG51bGwgJiYgIWhlYWRlckZvY3VzZWQsXG4gICAgb25FeGl0OiAoKSA9PiBzZXRJc1NlYXJjaE1vZGUoZmFsc2UpLFxuICAgIG9uRXhpdFVwOiBmb2N1c0hlYWRlcixcbiAgICAvLyBDdHJsK0MvRCBtdXN0IHJlYWNoIFNldHRpbmdzJyB1c2VFeGl0T25DdHJsQ0Q7ICdkJyBhbHNvIGF2b2lkc1xuICAgIC8vIGRvdWJsZS1hY3Rpb24gKGRlbGV0ZS1jaGFyICsgZXhpdC1wZW5kaW5nKS5cbiAgICBwYXNzdGhyb3VnaEN0cmxLZXlzOiBbJ2MnLCAnZCddLFxuICB9KVxuXG4gIC8vIFRlbGwgdGhlIHBhcmVudCB3aGVuIENvbmZpZydzIG93biBFc2MgaGFuZGxlciBpcyBhY3RpdmUgc28gU2V0dGluZ3MgY2VkZXNcbiAgLy8gY29uZmlybTpuby4gT25seSB0cnVlIHdoZW4gc2VhcmNoIG1vZGUgb3ducyB0aGUga2V5Ym9hcmQg4oCUIG5vdCB3aGVuIHRoZVxuICAvLyB0YWIgaGVhZGVyIGlzIGZvY3VzZWQgKHRoZW4gU2V0dGluZ3MgbXVzdCBoYW5kbGUgRXNjLXRvLWNsb3NlKS5cbiAgY29uc3Qgb3duc0VzYyA9IGlzU2VhcmNoTW9kZSAmJiAhaGVhZGVyRm9jdXNlZFxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIG9uSXNTZWFyY2hNb2RlQ2hhbmdlPy4ob3duc0VzYylcbiAgfSwgW293bnNFc2MsIG9uSXNTZWFyY2hNb2RlQ2hhbmdlXSlcblxuICBjb25zdCBpc0Nvbm5lY3RlZFRvSWRlID0gaGFzQWNjZXNzVG9JREVFeHRlbnNpb25EaWZmRmVhdHVyZShcbiAgICBjb250ZXh0Lm9wdGlvbnMubWNwQ2xpZW50cyxcbiAgKVxuXG4gIGNvbnN0IGlzRmlsZUNoZWNrcG9pbnRpbmdBdmFpbGFibGUgPSAhaXNFbnZUcnV0aHkoXG4gICAgcHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfRElTQUJMRV9GSUxFX0NIRUNLUE9JTlRJTkcsXG4gIClcblxuICBjb25zdCBtZW1vcnlGaWxlcyA9IFJlYWN0LnVzZShnZXRNZW1vcnlGaWxlcyh0cnVlKSlcbiAgY29uc3Qgc2hvdWxkU2hvd0V4dGVybmFsSW5jbHVkZXNUb2dnbGUgPVxuICAgIGhhc0V4dGVybmFsQ2xhdWRlTWRJbmNsdWRlcyhtZW1vcnlGaWxlcylcblxuICBjb25zdCBhdXRvVXBkYXRlckRpc2FibGVkUmVhc29uID0gZ2V0QXV0b1VwZGF0ZXJEaXNhYmxlZFJlYXNvbigpXG5cbiAgZnVuY3Rpb24gb25DaGFuZ2VNYWluTW9kZWxDb25maWcodmFsdWU6IHN0cmluZyB8IG51bGwpOiB2b2lkIHtcbiAgICBjb25zdCBwcmV2aW91c01vZGVsID0gbWFpbkxvb3BNb2RlbFxuICAgIGxvZ0V2ZW50KCd0ZW5ndV9jb25maWdfbW9kZWxfY2hhbmdlZCcsIHtcbiAgICAgIGZyb21fbW9kZWw6XG4gICAgICAgIHByZXZpb3VzTW9kZWwgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIHRvX21vZGVsOlxuICAgICAgICB2YWx1ZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG4gICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgLi4ucHJldixcbiAgICAgIG1haW5Mb29wTW9kZWw6IHZhbHVlLFxuICAgICAgbWFpbkxvb3BNb2RlbEZvclNlc3Npb246IG51bGwsXG4gICAgfSkpXG4gICAgc2V0Q2hhbmdlcyhwcmV2ID0+IHtcbiAgICAgIGNvbnN0IHZhbFN0ciA9XG4gICAgICAgIG1vZGVsRGlzcGxheVN0cmluZyh2YWx1ZSkgK1xuICAgICAgICAoaXNCaWxsZWRBc0V4dHJhVXNhZ2UodmFsdWUsIGZhbHNlLCBpc09wdXMxbU1lcmdlRW5hYmxlZCgpKVxuICAgICAgICAgID8gJyDCtyBCaWxsZWQgYXMgZXh0cmEgdXNhZ2UnXG4gICAgICAgICAgOiAnJylcbiAgICAgIGlmICgnbW9kZWwnIGluIHByZXYpIHtcbiAgICAgICAgY29uc3QgeyBtb2RlbCwgLi4ucmVzdCB9ID0gcHJldlxuICAgICAgICByZXR1cm4geyAuLi5yZXN0LCBtb2RlbDogdmFsU3RyIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB7IC4uLnByZXYsIG1vZGVsOiB2YWxTdHIgfVxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBvbkNoYW5nZVZlcmJvc2UodmFsdWU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICAvLyBVcGRhdGUgdGhlIGdsb2JhbCBjb25maWcgdG8gcGVyc2lzdCB0aGUgc2V0dGluZ1xuICAgIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiAoeyAuLi5jdXJyZW50LCB2ZXJib3NlOiB2YWx1ZSB9KSlcbiAgICBzZXRHbG9iYWxDb25maWcoeyAuLi5nZXRHbG9iYWxDb25maWcoKSwgdmVyYm9zZTogdmFsdWUgfSlcblxuICAgIC8vIFVwZGF0ZSB0aGUgYXBwIHN0YXRlIGZvciBpbW1lZGlhdGUgVUkgZmVlZGJhY2tcbiAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAuLi5wcmV2LFxuICAgICAgdmVyYm9zZTogdmFsdWUsXG4gICAgfSkpXG4gICAgc2V0Q2hhbmdlcyhwcmV2ID0+IHtcbiAgICAgIGlmICgndmVyYm9zZScgaW4gcHJldikge1xuICAgICAgICBjb25zdCB7IHZlcmJvc2UsIC4uLnJlc3QgfSA9IHByZXZcbiAgICAgICAgcmV0dXJuIHJlc3RcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IC4uLnByZXYsIHZlcmJvc2U6IHZhbHVlIH1cbiAgICB9KVxuICB9XG5cbiAgLy8gVE9ETzogQWRkIE1DUCBzZXJ2ZXJzXG4gIGNvbnN0IHNldHRpbmdzSXRlbXM6IFNldHRpbmdbXSA9IFtcbiAgICAvLyBHbG9iYWwgc2V0dGluZ3NcbiAgICB7XG4gICAgICBpZDogJ2F1dG9Db21wYWN0RW5hYmxlZCcsXG4gICAgICBsYWJlbDogJ0F1dG8tY29tcGFjdCcsXG4gICAgICB2YWx1ZTogZ2xvYmFsQ29uZmlnLmF1dG9Db21wYWN0RW5hYmxlZCxcbiAgICAgIHR5cGU6ICdib29sZWFuJyBhcyBjb25zdCxcbiAgICAgIG9uQ2hhbmdlKGF1dG9Db21wYWN0RW5hYmxlZDogYm9vbGVhbikge1xuICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHsgLi4uY3VycmVudCwgYXV0b0NvbXBhY3RFbmFibGVkIH0pKVxuICAgICAgICBzZXRHbG9iYWxDb25maWcoeyAuLi5nZXRHbG9iYWxDb25maWcoKSwgYXV0b0NvbXBhY3RFbmFibGVkIH0pXG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9hdXRvX2NvbXBhY3Rfc2V0dGluZ19jaGFuZ2VkJywge1xuICAgICAgICAgIGVuYWJsZWQ6IGF1dG9Db21wYWN0RW5hYmxlZCxcbiAgICAgICAgfSlcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ3NwaW5uZXJUaXBzRW5hYmxlZCcsXG4gICAgICBsYWJlbDogJ1Nob3cgdGlwcycsXG4gICAgICB2YWx1ZTogc2V0dGluZ3NEYXRhPy5zcGlubmVyVGlwc0VuYWJsZWQgPz8gdHJ1ZSxcbiAgICAgIHR5cGU6ICdib29sZWFuJyBhcyBjb25zdCxcbiAgICAgIG9uQ2hhbmdlKHNwaW5uZXJUaXBzRW5hYmxlZDogYm9vbGVhbikge1xuICAgICAgICB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSgnbG9jYWxTZXR0aW5ncycsIHtcbiAgICAgICAgICBzcGlubmVyVGlwc0VuYWJsZWQsXG4gICAgICAgIH0pXG4gICAgICAgIC8vIFVwZGF0ZSBsb2NhbCBzdGF0ZSB0byByZWZsZWN0IHRoZSBjaGFuZ2UgaW1tZWRpYXRlbHlcbiAgICAgICAgc2V0U2V0dGluZ3NEYXRhKHByZXYgPT4gKHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIHNwaW5uZXJUaXBzRW5hYmxlZCxcbiAgICAgICAgfSkpXG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90aXBzX3NldHRpbmdfY2hhbmdlZCcsIHtcbiAgICAgICAgICBlbmFibGVkOiBzcGlubmVyVGlwc0VuYWJsZWQsXG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdwcmVmZXJzUmVkdWNlZE1vdGlvbicsXG4gICAgICBsYWJlbDogJ1JlZHVjZSBtb3Rpb24nLFxuICAgICAgdmFsdWU6IHNldHRpbmdzRGF0YT8ucHJlZmVyc1JlZHVjZWRNb3Rpb24gPz8gZmFsc2UsXG4gICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICBvbkNoYW5nZShwcmVmZXJzUmVkdWNlZE1vdGlvbjogYm9vbGVhbikge1xuICAgICAgICB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSgnbG9jYWxTZXR0aW5ncycsIHtcbiAgICAgICAgICBwcmVmZXJzUmVkdWNlZE1vdGlvbixcbiAgICAgICAgfSlcbiAgICAgICAgc2V0U2V0dGluZ3NEYXRhKHByZXYgPT4gKHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIHByZWZlcnNSZWR1Y2VkTW90aW9uLFxuICAgICAgICB9KSlcbiAgICAgICAgLy8gU3luYyB0byBBcHBTdGF0ZSBzbyBjb21wb25lbnRzIHJlYWN0IGltbWVkaWF0ZWx5XG4gICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIHNldHRpbmdzOiB7IC4uLnByZXYuc2V0dGluZ3MsIHByZWZlcnNSZWR1Y2VkTW90aW9uIH0sXG4gICAgICAgIH0pKVxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfcmVkdWNlX21vdGlvbl9zZXR0aW5nX2NoYW5nZWQnLCB7XG4gICAgICAgICAgZW5hYmxlZDogcHJlZmVyc1JlZHVjZWRNb3Rpb24sXG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICd0aGlua2luZ0VuYWJsZWQnLFxuICAgICAgbGFiZWw6ICdUaGlua2luZyBtb2RlJyxcbiAgICAgIHZhbHVlOiB0aGlua2luZ0VuYWJsZWQgPz8gdHJ1ZSxcbiAgICAgIHR5cGU6ICdib29sZWFuJyBhcyBjb25zdCxcbiAgICAgIG9uQ2hhbmdlKGVuYWJsZWQ6IGJvb2xlYW4pIHtcbiAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCB0aGlua2luZ0VuYWJsZWQ6IGVuYWJsZWQgfSkpXG4gICAgICAgIHVwZGF0ZVNldHRpbmdzRm9yU291cmNlKCd1c2VyU2V0dGluZ3MnLCB7XG4gICAgICAgICAgYWx3YXlzVGhpbmtpbmdFbmFibGVkOiBlbmFibGVkID8gdW5kZWZpbmVkIDogZmFsc2UsXG4gICAgICAgIH0pXG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90aGlua2luZ190b2dnbGVkJywgeyBlbmFibGVkIH0pXG4gICAgICB9LFxuICAgIH0sXG4gICAgLy8gRmFzdCBtb2RlIHRvZ2dsZSAoYW50LW9ubHksIGVsaW1pbmF0ZWQgZnJvbSBleHRlcm5hbCBidWlsZHMpXG4gICAgLi4uKGlzRmFzdE1vZGVFbmFibGVkKCkgJiYgaXNGYXN0TW9kZUF2YWlsYWJsZSgpXG4gICAgICA/IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ2Zhc3RNb2RlJyxcbiAgICAgICAgICAgIGxhYmVsOiBgRmFzdCBtb2RlICgke0ZBU1RfTU9ERV9NT0RFTF9ESVNQTEFZfSBvbmx5KWAsXG4gICAgICAgICAgICB2YWx1ZTogISFpc0Zhc3RNb2RlLFxuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nIGFzIGNvbnN0LFxuICAgICAgICAgICAgb25DaGFuZ2UoZW5hYmxlZDogYm9vbGVhbikge1xuICAgICAgICAgICAgICBjbGVhckZhc3RNb2RlQ29vbGRvd24oKVxuICAgICAgICAgICAgICB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSgndXNlclNldHRpbmdzJywge1xuICAgICAgICAgICAgICAgIGZhc3RNb2RlOiBlbmFibGVkID8gdHJ1ZSA6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgaWYgKGVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgICAgbWFpbkxvb3BNb2RlbDogZ2V0RmFzdE1vZGVNb2RlbCgpLFxuICAgICAgICAgICAgICAgICAgbWFpbkxvb3BNb2RlbEZvclNlc3Npb246IG51bGwsXG4gICAgICAgICAgICAgICAgICBmYXN0TW9kZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICBzZXRDaGFuZ2VzKHByZXYgPT4gKHtcbiAgICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgICBtb2RlbDogZ2V0RmFzdE1vZGVNb2RlbCgpLFxuICAgICAgICAgICAgICAgICAgJ0Zhc3QgbW9kZSc6ICdPTicsXG4gICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoe1xuICAgICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICAgIGZhc3RNb2RlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICBzZXRDaGFuZ2VzKHByZXYgPT4gKHsgLi4ucHJldiwgJ0Zhc3QgbW9kZSc6ICdPRkYnIH0pKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF1cbiAgICAgIDogW10pLFxuICAgIC4uLihnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSgndGVuZ3VfY2hvbXBfaW5mbGVjdGlvbicsIGZhbHNlKVxuICAgICAgPyBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6ICdwcm9tcHRTdWdnZXN0aW9uRW5hYmxlZCcsXG4gICAgICAgICAgICBsYWJlbDogJ1Byb21wdCBzdWdnZXN0aW9ucycsXG4gICAgICAgICAgICB2YWx1ZTogcHJvbXB0U3VnZ2VzdGlvbkVuYWJsZWQsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICAgICAgICBvbkNoYW5nZShlbmFibGVkOiBib29sZWFuKSB7XG4gICAgICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgIHByb21wdFN1Z2dlc3Rpb25FbmFibGVkOiBlbmFibGVkLFxuICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2UoJ3VzZXJTZXR0aW5ncycsIHtcbiAgICAgICAgICAgICAgICBwcm9tcHRTdWdnZXN0aW9uRW5hYmxlZDogZW5hYmxlZCA/IHVuZGVmaW5lZCA6IGZhbHNlLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgICAvLyBTcGVjdWxhdGlvbiB0b2dnbGUgKGFudC1vbmx5KVxuICAgIC4uLihcImV4dGVybmFsXCIgPT09ICdhbnQnXG4gICAgICA/IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ3NwZWN1bGF0aW9uRW5hYmxlZCcsXG4gICAgICAgICAgICBsYWJlbDogJ1NwZWN1bGF0aXZlIGV4ZWN1dGlvbicsXG4gICAgICAgICAgICB2YWx1ZTogZ2xvYmFsQ29uZmlnLnNwZWN1bGF0aW9uRW5hYmxlZCA/PyB0cnVlLFxuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nIGFzIGNvbnN0LFxuICAgICAgICAgICAgb25DaGFuZ2UoZW5hYmxlZDogYm9vbGVhbikge1xuICAgICAgICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50LnNwZWN1bGF0aW9uRW5hYmxlZCA9PT0gZW5hYmxlZCkgcmV0dXJuIGN1cnJlbnRcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgICAgIHNwZWN1bGF0aW9uRW5hYmxlZDogZW5hYmxlZCxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIHNldEdsb2JhbENvbmZpZyh7XG4gICAgICAgICAgICAgICAgLi4uZ2V0R2xvYmFsQ29uZmlnKCksXG4gICAgICAgICAgICAgICAgc3BlY3VsYXRpb25FbmFibGVkOiBlbmFibGVkLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3Vfc3BlY3VsYXRpb25fc2V0dGluZ19jaGFuZ2VkJywge1xuICAgICAgICAgICAgICAgIGVuYWJsZWQsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF1cbiAgICAgIDogW10pLFxuICAgIC4uLihpc0ZpbGVDaGVja3BvaW50aW5nQXZhaWxhYmxlXG4gICAgICA/IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ2ZpbGVDaGVja3BvaW50aW5nRW5hYmxlZCcsXG4gICAgICAgICAgICBsYWJlbDogJ1Jld2luZCBjb2RlIChjaGVja3BvaW50cyknLFxuICAgICAgICAgICAgdmFsdWU6IGdsb2JhbENvbmZpZy5maWxlQ2hlY2twb2ludGluZ0VuYWJsZWQsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICAgICAgICBvbkNoYW5nZShlbmFibGVkOiBib29sZWFuKSB7XG4gICAgICAgICAgICAgIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiAoe1xuICAgICAgICAgICAgICAgIC4uLmN1cnJlbnQsXG4gICAgICAgICAgICAgICAgZmlsZUNoZWNrcG9pbnRpbmdFbmFibGVkOiBlbmFibGVkLFxuICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgc2V0R2xvYmFsQ29uZmlnKHtcbiAgICAgICAgICAgICAgICAuLi5nZXRHbG9iYWxDb25maWcoKSxcbiAgICAgICAgICAgICAgICBmaWxlQ2hlY2twb2ludGluZ0VuYWJsZWQ6IGVuYWJsZWQsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9maWxlX2hpc3Rvcnlfc25hcHNob3RzX3NldHRpbmdfY2hhbmdlZCcsIHtcbiAgICAgICAgICAgICAgICBlbmFibGVkOiBlbmFibGVkLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgICB7XG4gICAgICBpZDogJ3ZlcmJvc2UnLFxuICAgICAgbGFiZWw6ICdWZXJib3NlIG91dHB1dCcsXG4gICAgICB2YWx1ZTogdmVyYm9zZSxcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIG9uQ2hhbmdlOiBvbkNoYW5nZVZlcmJvc2UsXG4gICAgfSxcbiAgICB7XG4gICAgICBpZDogJ3Rlcm1pbmFsUHJvZ3Jlc3NCYXJFbmFibGVkJyxcbiAgICAgIGxhYmVsOiAnVGVybWluYWwgcHJvZ3Jlc3MgYmFyJyxcbiAgICAgIHZhbHVlOiBnbG9iYWxDb25maWcudGVybWluYWxQcm9ncmVzc0JhckVuYWJsZWQsXG4gICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICBvbkNoYW5nZSh0ZXJtaW5hbFByb2dyZXNzQmFyRW5hYmxlZDogYm9vbGVhbikge1xuICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAgICAgICAuLi5jdXJyZW50LFxuICAgICAgICAgIHRlcm1pbmFsUHJvZ3Jlc3NCYXJFbmFibGVkLFxuICAgICAgICB9KSlcbiAgICAgICAgc2V0R2xvYmFsQ29uZmlnKHsgLi4uZ2V0R2xvYmFsQ29uZmlnKCksIHRlcm1pbmFsUHJvZ3Jlc3NCYXJFbmFibGVkIH0pXG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90ZXJtaW5hbF9wcm9ncmVzc19iYXJfc2V0dGluZ19jaGFuZ2VkJywge1xuICAgICAgICAgIGVuYWJsZWQ6IHRlcm1pbmFsUHJvZ3Jlc3NCYXJFbmFibGVkLFxuICAgICAgICB9KVxuICAgICAgfSxcbiAgICB9LFxuICAgIC4uLihnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSgndGVuZ3VfdGVybWluYWxfc2lkZWJhcicsIGZhbHNlKVxuICAgICAgPyBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6ICdzaG93U3RhdHVzSW5UZXJtaW5hbFRhYicsXG4gICAgICAgICAgICBsYWJlbDogJ1Nob3cgc3RhdHVzIGluIHRlcm1pbmFsIHRhYicsXG4gICAgICAgICAgICB2YWx1ZTogZ2xvYmFsQ29uZmlnLnNob3dTdGF0dXNJblRlcm1pbmFsVGFiID8/IGZhbHNlLFxuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nIGFzIGNvbnN0LFxuICAgICAgICAgICAgb25DaGFuZ2Uoc2hvd1N0YXR1c0luVGVybWluYWxUYWI6IGJvb2xlYW4pIHtcbiAgICAgICAgICAgICAgc2F2ZUdsb2JhbENvbmZpZyhjdXJyZW50ID0+ICh7XG4gICAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgICBzaG93U3RhdHVzSW5UZXJtaW5hbFRhYixcbiAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgIHNldEdsb2JhbENvbmZpZyh7XG4gICAgICAgICAgICAgICAgLi4uZ2V0R2xvYmFsQ29uZmlnKCksXG4gICAgICAgICAgICAgICAgc2hvd1N0YXR1c0luVGVybWluYWxUYWIsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90ZXJtaW5hbF90YWJfc3RhdHVzX3NldHRpbmdfY2hhbmdlZCcsIHtcbiAgICAgICAgICAgICAgICBlbmFibGVkOiBzaG93U3RhdHVzSW5UZXJtaW5hbFRhYixcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgOiBbXSksXG4gICAge1xuICAgICAgaWQ6ICdzaG93VHVybkR1cmF0aW9uJyxcbiAgICAgIGxhYmVsOiAnU2hvdyB0dXJuIGR1cmF0aW9uJyxcbiAgICAgIHZhbHVlOiBnbG9iYWxDb25maWcuc2hvd1R1cm5EdXJhdGlvbixcbiAgICAgIHR5cGU6ICdib29sZWFuJyBhcyBjb25zdCxcbiAgICAgIG9uQ2hhbmdlKHNob3dUdXJuRHVyYXRpb246IGJvb2xlYW4pIHtcbiAgICAgICAgc2F2ZUdsb2JhbENvbmZpZyhjdXJyZW50ID0+ICh7IC4uLmN1cnJlbnQsIHNob3dUdXJuRHVyYXRpb24gfSkpXG4gICAgICAgIHNldEdsb2JhbENvbmZpZyh7IC4uLmdldEdsb2JhbENvbmZpZygpLCBzaG93VHVybkR1cmF0aW9uIH0pXG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9zaG93X3R1cm5fZHVyYXRpb25fc2V0dGluZ19jaGFuZ2VkJywge1xuICAgICAgICAgIGVuYWJsZWQ6IHNob3dUdXJuRHVyYXRpb24sXG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdkZWZhdWx0UGVybWlzc2lvbk1vZGUnLFxuICAgICAgbGFiZWw6ICdEZWZhdWx0IHBlcm1pc3Npb24gbW9kZScsXG4gICAgICB2YWx1ZTogc2V0dGluZ3NEYXRhPy5wZXJtaXNzaW9ucz8uZGVmYXVsdE1vZGUgfHwgJ2RlZmF1bHQnLFxuICAgICAgb3B0aW9uczogKCgpID0+IHtcbiAgICAgICAgY29uc3QgcHJpb3JpdHlPcmRlcjogUGVybWlzc2lvbk1vZGVbXSA9IFsnZGVmYXVsdCcsICdwbGFuJ11cbiAgICAgICAgY29uc3QgYWxsTW9kZXM6IHJlYWRvbmx5IFBlcm1pc3Npb25Nb2RlW10gPSBmZWF0dXJlKFxuICAgICAgICAgICdUUkFOU0NSSVBUX0NMQVNTSUZJRVInLFxuICAgICAgICApXG4gICAgICAgICAgPyBQRVJNSVNTSU9OX01PREVTXG4gICAgICAgICAgOiBFWFRFUk5BTF9QRVJNSVNTSU9OX01PREVTXG4gICAgICAgIGNvbnN0IGV4Y2x1ZGVkOiBQZXJtaXNzaW9uTW9kZVtdID0gWydieXBhc3NQZXJtaXNzaW9ucyddXG4gICAgICAgIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSAmJiAhc2hvd0F1dG9JbkRlZmF1bHRNb2RlUGlja2VyKSB7XG4gICAgICAgICAgZXhjbHVkZWQucHVzaCgnYXV0bycpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAuLi5wcmlvcml0eU9yZGVyLFxuICAgICAgICAgIC4uLmFsbE1vZGVzLmZpbHRlcihcbiAgICAgICAgICAgIG0gPT4gIXByaW9yaXR5T3JkZXIuaW5jbHVkZXMobSkgJiYgIWV4Y2x1ZGVkLmluY2x1ZGVzKG0pLFxuICAgICAgICAgICksXG4gICAgICAgIF1cbiAgICAgIH0pKCksXG4gICAgICB0eXBlOiAnZW51bScgYXMgY29uc3QsXG4gICAgICBvbkNoYW5nZShtb2RlOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkTW9kZSA9IHBlcm1pc3Npb25Nb2RlRnJvbVN0cmluZyhtb2RlKVxuICAgICAgICAvLyBJbnRlcm5hbCBtb2RlcyAoZS5nLiBhdXRvKSBhcmUgc3RvcmVkIGRpcmVjdGx5XG4gICAgICAgIGNvbnN0IHZhbGlkYXRlZE1vZGUgPSBpc0V4dGVybmFsUGVybWlzc2lvbk1vZGUocGFyc2VkTW9kZSlcbiAgICAgICAgICA/IHRvRXh0ZXJuYWxQZXJtaXNzaW9uTW9kZShwYXJzZWRNb2RlKVxuICAgICAgICAgIDogcGFyc2VkTW9kZVxuICAgICAgICBjb25zdCByZXN1bHQgPSB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSgndXNlclNldHRpbmdzJywge1xuICAgICAgICAgIHBlcm1pc3Npb25zOiB7XG4gICAgICAgICAgICAuLi5zZXR0aW5nc0RhdGE/LnBlcm1pc3Npb25zLFxuICAgICAgICAgICAgZGVmYXVsdE1vZGU6IHZhbGlkYXRlZE1vZGUgYXMgRXh0ZXJuYWxQZXJtaXNzaW9uTW9kZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KVxuXG4gICAgICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgICBsb2dFcnJvcihyZXN1bHQuZXJyb3IpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgbG9jYWwgc3RhdGUgdG8gcmVmbGVjdCB0aGUgY2hhbmdlIGltbWVkaWF0ZWx5LlxuICAgICAgICAvLyB2YWxpZGF0ZWRNb2RlIGlzIHR5cGVkIGFzIHRoZSB3aWRlIFBlcm1pc3Npb25Nb2RlIHVuaW9uIGJ1dCBhdFxuICAgICAgICAvLyBydW50aW1lIGlzIGFsd2F5cyBhIFBFUk1JU1NJT05fTU9ERVMgbWVtYmVyICh0aGUgb3B0aW9ucyBkcm9wZG93blxuICAgICAgICAvLyBpcyBidWlsdCBmcm9tIHRoYXQgYXJyYXkgYWJvdmUpLCBzbyB0aGlzIG5hcnJvd2luZyBpcyBzb3VuZC5cbiAgICAgICAgc2V0U2V0dGluZ3NEYXRhKHByZXYgPT4gKHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIHBlcm1pc3Npb25zOiB7XG4gICAgICAgICAgICAuLi5wcmV2Py5wZXJtaXNzaW9ucyxcbiAgICAgICAgICAgIGRlZmF1bHRNb2RlOiB2YWxpZGF0ZWRNb2RlIGFzICh0eXBlb2YgUEVSTUlTU0lPTl9NT0RFUylbbnVtYmVyXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSlcbiAgICAgICAgLy8gVHJhY2sgY2hhbmdlc1xuICAgICAgICBzZXRDaGFuZ2VzKHByZXYgPT4gKHsgLi4ucHJldiwgZGVmYXVsdFBlcm1pc3Npb25Nb2RlOiBtb2RlIH0pKVxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfY29uZmlnX2NoYW5nZWQnLCB7XG4gICAgICAgICAgc2V0dGluZzpcbiAgICAgICAgICAgICdkZWZhdWx0UGVybWlzc2lvbk1vZGUnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgdmFsdWU6XG4gICAgICAgICAgICBtb2RlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgIH0sXG4gICAgLi4uKGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpICYmIHNob3dBdXRvSW5EZWZhdWx0TW9kZVBpY2tlclxuICAgICAgPyBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6ICd1c2VBdXRvTW9kZUR1cmluZ1BsYW4nLFxuICAgICAgICAgICAgbGFiZWw6ICdVc2UgYXV0byBtb2RlIGR1cmluZyBwbGFuJyxcbiAgICAgICAgICAgIHZhbHVlOlxuICAgICAgICAgICAgICAoc2V0dGluZ3NEYXRhIGFzIHsgdXNlQXV0b01vZGVEdXJpbmdQbGFuPzogYm9vbGVhbiB9IHwgdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgID8udXNlQXV0b01vZGVEdXJpbmdQbGFuID8/IHRydWUsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICAgICAgICBvbkNoYW5nZSh1c2VBdXRvTW9kZUR1cmluZ1BsYW46IGJvb2xlYW4pIHtcbiAgICAgICAgICAgICAgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2UoJ3VzZXJTZXR0aW5ncycsIHtcbiAgICAgICAgICAgICAgICB1c2VBdXRvTW9kZUR1cmluZ1BsYW4sXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIHNldFNldHRpbmdzRGF0YShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICB1c2VBdXRvTW9kZUR1cmluZ1BsYW4sXG4gICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAvLyBJbnRlcm5hbCB3cml0ZXMgc3VwcHJlc3MgdGhlIGZpbGUgd2F0Y2hlciwgc29cbiAgICAgICAgICAgICAgLy8gYXBwbHlTZXR0aW5nc0NoYW5nZSB3b24ndCBmaXJlLiBSZWNvbmNpbGUgZGlyZWN0bHkgc29cbiAgICAgICAgICAgICAgLy8gbWlkLXBsYW4gdG9nZ2xlcyB0YWtlIGVmZmVjdCBpbW1lZGlhdGVseS5cbiAgICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV4dCA9IHRyYW5zaXRpb25QbGFuQXV0b01vZGUocHJldi50b29sUGVybWlzc2lvbkNvbnRleHQpXG4gICAgICAgICAgICAgICAgaWYgKG5leHQgPT09IHByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0KSByZXR1cm4gcHJldlxuICAgICAgICAgICAgICAgIHJldHVybiB7IC4uLnByZXYsIHRvb2xQZXJtaXNzaW9uQ29udGV4dDogbmV4dCB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIHNldENoYW5nZXMocHJldiA9PiAoe1xuICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgJ1VzZSBhdXRvIG1vZGUgZHVyaW5nIHBsYW4nOiB1c2VBdXRvTW9kZUR1cmluZ1BsYW4sXG4gICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgICB7XG4gICAgICBpZDogJ3Jlc3BlY3RHaXRpZ25vcmUnLFxuICAgICAgbGFiZWw6ICdSZXNwZWN0IC5naXRpZ25vcmUgaW4gZmlsZSBwaWNrZXInLFxuICAgICAgdmFsdWU6IGdsb2JhbENvbmZpZy5yZXNwZWN0R2l0aWdub3JlLFxuICAgICAgdHlwZTogJ2Jvb2xlYW4nIGFzIGNvbnN0LFxuICAgICAgb25DaGFuZ2UocmVzcGVjdEdpdGlnbm9yZTogYm9vbGVhbikge1xuICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHsgLi4uY3VycmVudCwgcmVzcGVjdEdpdGlnbm9yZSB9KSlcbiAgICAgICAgc2V0R2xvYmFsQ29uZmlnKHsgLi4uZ2V0R2xvYmFsQ29uZmlnKCksIHJlc3BlY3RHaXRpZ25vcmUgfSlcbiAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3Jlc3BlY3RfZ2l0aWdub3JlX3NldHRpbmdfY2hhbmdlZCcsIHtcbiAgICAgICAgICBlbmFibGVkOiByZXNwZWN0R2l0aWdub3JlLFxuICAgICAgICB9KVxuICAgICAgfSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnY29weUZ1bGxSZXNwb25zZScsXG4gICAgICBsYWJlbDogJ0Fsd2F5cyBjb3B5IGZ1bGwgcmVzcG9uc2UgKHNraXAgL2NvcHkgcGlja2VyKScsXG4gICAgICB2YWx1ZTogZ2xvYmFsQ29uZmlnLmNvcHlGdWxsUmVzcG9uc2UsXG4gICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICBvbkNoYW5nZShjb3B5RnVsbFJlc3BvbnNlOiBib29sZWFuKSB7XG4gICAgICAgIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiAoeyAuLi5jdXJyZW50LCBjb3B5RnVsbFJlc3BvbnNlIH0pKVxuICAgICAgICBzZXRHbG9iYWxDb25maWcoeyAuLi5nZXRHbG9iYWxDb25maWcoKSwgY29weUZ1bGxSZXNwb25zZSB9KVxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfY29uZmlnX2NoYW5nZWQnLCB7XG4gICAgICAgICAgc2V0dGluZzpcbiAgICAgICAgICAgICdjb3B5RnVsbFJlc3BvbnNlJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIHZhbHVlOiBTdHJpbmcoXG4gICAgICAgICAgICBjb3B5RnVsbFJlc3BvbnNlLFxuICAgICAgICAgICkgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgfSlcbiAgICAgIH0sXG4gICAgfSxcbiAgICAvLyBDb3B5LW9uLXNlbGVjdCBpcyBvbmx5IG1lYW5pbmdmdWwgd2l0aCBpbi1hcHAgc2VsZWN0aW9uIChmdWxsc2NyZWVuXG4gICAgLy8gYWx0LXNjcmVlbiBtb2RlKS4gSW4gaW5saW5lIG1vZGUgdGhlIHRlcm1pbmFsIGVtdWxhdG9yIG93bnMgc2VsZWN0aW9uLlxuICAgIC4uLihpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKClcbiAgICAgID8gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnY29weU9uU2VsZWN0JyxcbiAgICAgICAgICAgIGxhYmVsOiAnQ29weSBvbiBzZWxlY3QnLFxuICAgICAgICAgICAgdmFsdWU6IGdsb2JhbENvbmZpZy5jb3B5T25TZWxlY3QgPz8gdHJ1ZSxcbiAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyBhcyBjb25zdCxcbiAgICAgICAgICAgIG9uQ2hhbmdlKGNvcHlPblNlbGVjdDogYm9vbGVhbikge1xuICAgICAgICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHsgLi4uY3VycmVudCwgY29weU9uU2VsZWN0IH0pKVxuICAgICAgICAgICAgICBzZXRHbG9iYWxDb25maWcoeyAuLi5nZXRHbG9iYWxDb25maWcoKSwgY29weU9uU2VsZWN0IH0pXG4gICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9jb25maWdfY2hhbmdlZCcsIHtcbiAgICAgICAgICAgICAgICBzZXR0aW5nOlxuICAgICAgICAgICAgICAgICAgJ2NvcHlPblNlbGVjdCcgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogU3RyaW5nKFxuICAgICAgICAgICAgICAgICAgY29weU9uU2VsZWN0LFxuICAgICAgICAgICAgICAgICkgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgOiBbXSksXG4gICAgLy8gYXV0b1VwZGF0ZXMgc2V0dGluZyBpcyBoaWRkZW4gLSB1c2UgRElTQUJMRV9BVVRPVVBEQVRFUiBlbnYgdmFyIHRvIGNvbnRyb2xcbiAgICBhdXRvVXBkYXRlckRpc2FibGVkUmVhc29uXG4gICAgICA/IHtcbiAgICAgICAgICBpZDogJ2F1dG9VcGRhdGVzQ2hhbm5lbCcsXG4gICAgICAgICAgbGFiZWw6ICdBdXRvLXVwZGF0ZSBjaGFubmVsJyxcbiAgICAgICAgICB2YWx1ZTogJ2Rpc2FibGVkJyxcbiAgICAgICAgICB0eXBlOiAnbWFuYWdlZEVudW0nIGFzIGNvbnN0LFxuICAgICAgICAgIG9uQ2hhbmdlKCkge30sXG4gICAgICAgIH1cbiAgICAgIDoge1xuICAgICAgICAgIGlkOiAnYXV0b1VwZGF0ZXNDaGFubmVsJyxcbiAgICAgICAgICBsYWJlbDogJ0F1dG8tdXBkYXRlIGNoYW5uZWwnLFxuICAgICAgICAgIHZhbHVlOiBzZXR0aW5nc0RhdGE/LmF1dG9VcGRhdGVzQ2hhbm5lbCA/PyAnbGF0ZXN0JyxcbiAgICAgICAgICB0eXBlOiAnbWFuYWdlZEVudW0nIGFzIGNvbnN0LFxuICAgICAgICAgIG9uQ2hhbmdlKCkge1xuICAgICAgICAgICAgLy8gSGFuZGxlZCB2aWEgdG9nZ2xlU2V0dGluZyAtPiAnQ2hhbm5lbERvd25ncmFkZSdcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAndGhlbWUnLFxuICAgICAgbGFiZWw6ICdUaGVtZScsXG4gICAgICB2YWx1ZTogdGhlbWVTZXR0aW5nLFxuICAgICAgdHlwZTogJ21hbmFnZWRFbnVtJyxcbiAgICAgIG9uQ2hhbmdlOiBzZXRUaGVtZSxcbiAgICB9LFxuICAgIHtcbiAgICAgIGlkOiAnbm90aWZDaGFubmVsJyxcbiAgICAgIGxhYmVsOlxuICAgICAgICBmZWF0dXJlKCdLQUlST1MnKSB8fCBmZWF0dXJlKCdLQUlST1NfUFVTSF9OT1RJRklDQVRJT04nKVxuICAgICAgICAgID8gJ0xvY2FsIG5vdGlmaWNhdGlvbnMnXG4gICAgICAgICAgOiAnTm90aWZpY2F0aW9ucycsXG4gICAgICB2YWx1ZTogZ2xvYmFsQ29uZmlnLnByZWZlcnJlZE5vdGlmQ2hhbm5lbCxcbiAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgJ2F1dG8nLFxuICAgICAgICAnaXRlcm0yJyxcbiAgICAgICAgJ3Rlcm1pbmFsX2JlbGwnLFxuICAgICAgICAnaXRlcm0yX3dpdGhfYmVsbCcsXG4gICAgICAgICdraXR0eScsXG4gICAgICAgICdnaG9zdHR5JyxcbiAgICAgICAgJ25vdGlmaWNhdGlvbnNfZGlzYWJsZWQnLFxuICAgICAgXSxcbiAgICAgIHR5cGU6ICdlbnVtJyxcbiAgICAgIG9uQ2hhbmdlKG5vdGlmQ2hhbm5lbDogR2xvYmFsQ29uZmlnWydwcmVmZXJyZWROb3RpZkNoYW5uZWwnXSkge1xuICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAgICAgICAuLi5jdXJyZW50LFxuICAgICAgICAgIHByZWZlcnJlZE5vdGlmQ2hhbm5lbDogbm90aWZDaGFubmVsLFxuICAgICAgICB9KSlcbiAgICAgICAgc2V0R2xvYmFsQ29uZmlnKHtcbiAgICAgICAgICAuLi5nZXRHbG9iYWxDb25maWcoKSxcbiAgICAgICAgICBwcmVmZXJyZWROb3RpZkNoYW5uZWw6IG5vdGlmQ2hhbm5lbCxcbiAgICAgICAgfSlcbiAgICAgIH0sXG4gICAgfSxcbiAgICAuLi4oZmVhdHVyZSgnS0FJUk9TJykgfHwgZmVhdHVyZSgnS0FJUk9TX1BVU0hfTk9USUZJQ0FUSU9OJylcbiAgICAgID8gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAndGFza0NvbXBsZXRlTm90aWZFbmFibGVkJyxcbiAgICAgICAgICAgIGxhYmVsOiAnUHVzaCB3aGVuIGlkbGUnLFxuICAgICAgICAgICAgdmFsdWU6IGdsb2JhbENvbmZpZy50YXNrQ29tcGxldGVOb3RpZkVuYWJsZWQgPz8gZmFsc2UsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICAgICAgICBvbkNoYW5nZSh0YXNrQ29tcGxldGVOb3RpZkVuYWJsZWQ6IGJvb2xlYW4pIHtcbiAgICAgICAgICAgICAgc2F2ZUdsb2JhbENvbmZpZyhjdXJyZW50ID0+ICh7XG4gICAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgICB0YXNrQ29tcGxldGVOb3RpZkVuYWJsZWQsXG4gICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICBzZXRHbG9iYWxDb25maWcoe1xuICAgICAgICAgICAgICAgIC4uLmdldEdsb2JhbENvbmZpZygpLFxuICAgICAgICAgICAgICAgIHRhc2tDb21wbGV0ZU5vdGlmRW5hYmxlZCxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ2lucHV0TmVlZGVkTm90aWZFbmFibGVkJyxcbiAgICAgICAgICAgIGxhYmVsOiAnUHVzaCB3aGVuIGlucHV0IG5lZWRlZCcsXG4gICAgICAgICAgICB2YWx1ZTogZ2xvYmFsQ29uZmlnLmlucHV0TmVlZGVkTm90aWZFbmFibGVkID8/IGZhbHNlLFxuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nIGFzIGNvbnN0LFxuICAgICAgICAgICAgb25DaGFuZ2UoaW5wdXROZWVkZWROb3RpZkVuYWJsZWQ6IGJvb2xlYW4pIHtcbiAgICAgICAgICAgICAgc2F2ZUdsb2JhbENvbmZpZyhjdXJyZW50ID0+ICh7XG4gICAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgICBpbnB1dE5lZWRlZE5vdGlmRW5hYmxlZCxcbiAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgIHNldEdsb2JhbENvbmZpZyh7XG4gICAgICAgICAgICAgICAgLi4uZ2V0R2xvYmFsQ29uZmlnKCksXG4gICAgICAgICAgICAgICAgaW5wdXROZWVkZWROb3RpZkVuYWJsZWQsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6ICdhZ2VudFB1c2hOb3RpZkVuYWJsZWQnLFxuICAgICAgICAgICAgbGFiZWw6ICdQdXNoIHdoZW4gQ2xhdWRlIGRlY2lkZXMnLFxuICAgICAgICAgICAgdmFsdWU6IGdsb2JhbENvbmZpZy5hZ2VudFB1c2hOb3RpZkVuYWJsZWQgPz8gZmFsc2UsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICAgICAgICBvbkNoYW5nZShhZ2VudFB1c2hOb3RpZkVuYWJsZWQ6IGJvb2xlYW4pIHtcbiAgICAgICAgICAgICAgc2F2ZUdsb2JhbENvbmZpZyhjdXJyZW50ID0+ICh7XG4gICAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgICBhZ2VudFB1c2hOb3RpZkVuYWJsZWQsXG4gICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICBzZXRHbG9iYWxDb25maWcoe1xuICAgICAgICAgICAgICAgIC4uLmdldEdsb2JhbENvbmZpZygpLFxuICAgICAgICAgICAgICAgIGFnZW50UHVzaE5vdGlmRW5hYmxlZCxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgOiBbXSksXG4gICAge1xuICAgICAgaWQ6ICdvdXRwdXRTdHlsZScsXG4gICAgICBsYWJlbDogJ091dHB1dCBzdHlsZScsXG4gICAgICB2YWx1ZTogY3VycmVudE91dHB1dFN0eWxlLFxuICAgICAgdHlwZTogJ21hbmFnZWRFbnVtJyBhcyBjb25zdCxcbiAgICAgIG9uQ2hhbmdlOiAoKSA9PiB7fSwgLy8gaGFuZGxlZCBieSBPdXRwdXRTdHlsZVBpY2tlciBzdWJtZW51XG4gICAgfSxcbiAgICAuLi4oc2hvd0RlZmF1bHRWaWV3UGlja2VyXG4gICAgICA/IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ2RlZmF1bHRWaWV3JyxcbiAgICAgICAgICAgIGxhYmVsOiAnV2hhdCB5b3Ugc2VlIGJ5IGRlZmF1bHQnLFxuICAgICAgICAgICAgLy8gJ2RlZmF1bHQnIG1lYW5zIHRoZSBzZXR0aW5nIGlzIHVuc2V0IOKAlCBjdXJyZW50bHkgcmVzb2x2ZXMgdG9cbiAgICAgICAgICAgIC8vIHRyYW5zY3JpcHQgKG1haW4udHN4IGZhbGxzIHRocm91Z2ggd2hlbiBkZWZhdWx0VmlldyAhPT0gJ2NoYXQnKS5cbiAgICAgICAgICAgIC8vIFN0cmluZygpIG5hcnJvd3MgdGhlIGNvbmRpdGlvbmFsLXNjaGVtYS1zcHJlYWQgdW5pb24gdG8gc3RyaW5nLlxuICAgICAgICAgICAgdmFsdWU6XG4gICAgICAgICAgICAgIHNldHRpbmdzRGF0YT8uZGVmYXVsdFZpZXcgPT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgID8gJ2RlZmF1bHQnXG4gICAgICAgICAgICAgICAgOiBTdHJpbmcoc2V0dGluZ3NEYXRhLmRlZmF1bHRWaWV3KSxcbiAgICAgICAgICAgIG9wdGlvbnM6IFsndHJhbnNjcmlwdCcsICdjaGF0JywgJ2RlZmF1bHQnXSxcbiAgICAgICAgICAgIHR5cGU6ICdlbnVtJyBhcyBjb25zdCxcbiAgICAgICAgICAgIG9uQ2hhbmdlKHNlbGVjdGVkOiBzdHJpbmcpIHtcbiAgICAgICAgICAgICAgY29uc3QgZGVmYXVsdFZpZXcgPVxuICAgICAgICAgICAgICAgIHNlbGVjdGVkID09PSAnZGVmYXVsdCdcbiAgICAgICAgICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICA6IChzZWxlY3RlZCBhcyAnY2hhdCcgfCAndHJhbnNjcmlwdCcpXG4gICAgICAgICAgICAgIHVwZGF0ZVNldHRpbmdzRm9yU291cmNlKCdsb2NhbFNldHRpbmdzJywgeyBkZWZhdWx0VmlldyB9KVxuICAgICAgICAgICAgICBzZXRTZXR0aW5nc0RhdGEocHJldiA9PiAoeyAuLi5wcmV2LCBkZWZhdWx0VmlldyB9KSlcbiAgICAgICAgICAgICAgY29uc3QgbmV4dEJyaWVmID0gZGVmYXVsdFZpZXcgPT09ICdjaGF0J1xuICAgICAgICAgICAgICBzZXRBcHBTdGF0ZShwcmV2ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocHJldi5pc0JyaWVmT25seSA9PT0gbmV4dEJyaWVmKSByZXR1cm4gcHJldlxuICAgICAgICAgICAgICAgIHJldHVybiB7IC4uLnByZXYsIGlzQnJpZWZPbmx5OiBuZXh0QnJpZWYgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAvLyBLZWVwIHVzZXJNc2dPcHRJbiBpbiBzeW5jIHNvIHRoZSB0b29sIGxpc3QgZm9sbG93cyB0aGUgdmlldy5cbiAgICAgICAgICAgICAgLy8gVHdvLXdheSBub3cgKHNhbWUgYXMgL2JyaWVmKSDigJQgYWNjZXB0aW5nIGEgY2FjaGUgaW52YWxpZGF0aW9uXG4gICAgICAgICAgICAgIC8vIGlzIGJldHRlciB0aGFuIGxlYXZpbmcgdGhlIHRvb2wgb24gYWZ0ZXIgc3dpdGNoaW5nIGF3YXkuXG4gICAgICAgICAgICAgIC8vIFJldmVydGVkIG9uIEVzY2FwZSB2aWEgaW5pdGlhbFVzZXJNc2dPcHRJbiBzbmFwc2hvdC5cbiAgICAgICAgICAgICAgc2V0VXNlck1zZ09wdEluKG5leHRCcmllZilcbiAgICAgICAgICAgICAgc2V0Q2hhbmdlcyhwcmV2ID0+ICh7IC4uLnByZXYsICdEZWZhdWx0IHZpZXcnOiBzZWxlY3RlZCB9KSlcbiAgICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2RlZmF1bHRfdmlld19zZXR0aW5nX2NoYW5nZWQnLCB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IChkZWZhdWx0VmlldyA/P1xuICAgICAgICAgICAgICAgICAgJ3Vuc2V0JykgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgOiBbXSksXG4gICAge1xuICAgICAgaWQ6ICdsYW5ndWFnZScsXG4gICAgICBsYWJlbDogJ0xhbmd1YWdlJyxcbiAgICAgIHZhbHVlOiBjdXJyZW50TGFuZ3VhZ2UgPz8gJ0RlZmF1bHQgKEVuZ2xpc2gpJyxcbiAgICAgIHR5cGU6ICdtYW5hZ2VkRW51bScgYXMgY29uc3QsXG4gICAgICBvbkNoYW5nZTogKCkgPT4ge30sIC8vIGhhbmRsZWQgYnkgTGFuZ3VhZ2VQaWNrZXIgc3VibWVudVxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdlZGl0b3JNb2RlJyxcbiAgICAgIGxhYmVsOiAnRWRpdG9yIG1vZGUnLFxuICAgICAgLy8gQ29udmVydCAnZW1hY3MnIHRvICdub3JtYWwnIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgICB2YWx1ZTpcbiAgICAgICAgZ2xvYmFsQ29uZmlnLmVkaXRvck1vZGUgPT09ICdlbWFjcydcbiAgICAgICAgICA/ICdub3JtYWwnXG4gICAgICAgICAgOiBnbG9iYWxDb25maWcuZWRpdG9yTW9kZSB8fCAnbm9ybWFsJyxcbiAgICAgIG9wdGlvbnM6IFsnbm9ybWFsJywgJ3ZpbSddLFxuICAgICAgdHlwZTogJ2VudW0nLFxuICAgICAgb25DaGFuZ2UodmFsdWU6IHN0cmluZykge1xuICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAgICAgICAuLi5jdXJyZW50LFxuICAgICAgICAgIGVkaXRvck1vZGU6IHZhbHVlIGFzIEdsb2JhbENvbmZpZ1snZWRpdG9yTW9kZSddLFxuICAgICAgICB9KSlcbiAgICAgICAgc2V0R2xvYmFsQ29uZmlnKHtcbiAgICAgICAgICAuLi5nZXRHbG9iYWxDb25maWcoKSxcbiAgICAgICAgICBlZGl0b3JNb2RlOiB2YWx1ZSBhcyBHbG9iYWxDb25maWdbJ2VkaXRvck1vZGUnXSxcbiAgICAgICAgfSlcblxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfZWRpdG9yX21vZGVfY2hhbmdlZCcsIHtcbiAgICAgICAgICBtb2RlOiB2YWx1ZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIHNvdXJjZTpcbiAgICAgICAgICAgICdjb25maWdfcGFuZWwnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdwclN0YXR1c0Zvb3RlckVuYWJsZWQnLFxuICAgICAgbGFiZWw6ICdTaG93IFBSIHN0YXR1cyBmb290ZXInLFxuICAgICAgdmFsdWU6IGdsb2JhbENvbmZpZy5wclN0YXR1c0Zvb3RlckVuYWJsZWQgPz8gdHJ1ZSxcbiAgICAgIHR5cGU6ICdib29sZWFuJyBhcyBjb25zdCxcbiAgICAgIG9uQ2hhbmdlKGVuYWJsZWQ6IGJvb2xlYW4pIHtcbiAgICAgICAgc2F2ZUdsb2JhbENvbmZpZyhjdXJyZW50ID0+IHtcbiAgICAgICAgICBpZiAoY3VycmVudC5wclN0YXR1c0Zvb3RlckVuYWJsZWQgPT09IGVuYWJsZWQpIHJldHVybiBjdXJyZW50XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC4uLmN1cnJlbnQsXG4gICAgICAgICAgICBwclN0YXR1c0Zvb3RlckVuYWJsZWQ6IGVuYWJsZWQsXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBzZXRHbG9iYWxDb25maWcoe1xuICAgICAgICAgIC4uLmdldEdsb2JhbENvbmZpZygpLFxuICAgICAgICAgIHByU3RhdHVzRm9vdGVyRW5hYmxlZDogZW5hYmxlZCxcbiAgICAgICAgfSlcbiAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X3ByX3N0YXR1c19mb290ZXJfc2V0dGluZ19jaGFuZ2VkJywge1xuICAgICAgICAgIGVuYWJsZWQsXG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgaWQ6ICdtb2RlbCcsXG4gICAgICBsYWJlbDogJ01vZGVsJyxcbiAgICAgIHZhbHVlOiBtYWluTG9vcE1vZGVsID09PSBudWxsID8gJ0RlZmF1bHQgKHJlY29tbWVuZGVkKScgOiBtYWluTG9vcE1vZGVsLFxuICAgICAgdHlwZTogJ21hbmFnZWRFbnVtJyBhcyBjb25zdCxcbiAgICAgIG9uQ2hhbmdlOiBvbkNoYW5nZU1haW5Nb2RlbENvbmZpZyxcbiAgICB9LFxuICAgIC4uLihpc0Nvbm5lY3RlZFRvSWRlXG4gICAgICA/IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBpZDogJ2RpZmZUb29sJyxcbiAgICAgICAgICAgIGxhYmVsOiAnRGlmZiB0b29sJyxcbiAgICAgICAgICAgIHZhbHVlOiBnbG9iYWxDb25maWcuZGlmZlRvb2wgPz8gJ2F1dG8nLFxuICAgICAgICAgICAgb3B0aW9uczogWyd0ZXJtaW5hbCcsICdhdXRvJ10sXG4gICAgICAgICAgICB0eXBlOiAnZW51bScgYXMgY29uc3QsXG4gICAgICAgICAgICBvbkNoYW5nZShkaWZmVG9vbDogc3RyaW5nKSB7XG4gICAgICAgICAgICAgIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiAoe1xuICAgICAgICAgICAgICAgIC4uLmN1cnJlbnQsXG4gICAgICAgICAgICAgICAgZGlmZlRvb2w6IGRpZmZUb29sIGFzIEdsb2JhbENvbmZpZ1snZGlmZlRvb2wnXSxcbiAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgIHNldEdsb2JhbENvbmZpZyh7XG4gICAgICAgICAgICAgICAgLi4uZ2V0R2xvYmFsQ29uZmlnKCksXG4gICAgICAgICAgICAgICAgZGlmZlRvb2w6IGRpZmZUb29sIGFzIEdsb2JhbENvbmZpZ1snZGlmZlRvb2wnXSxcbiAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfZGlmZl90b29sX2NoYW5nZWQnLCB7XG4gICAgICAgICAgICAgICAgdG9vbDogZGlmZlRvb2wgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgICBzb3VyY2U6XG4gICAgICAgICAgICAgICAgICAnY29uZmlnX3BhbmVsJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgICAuLi4oIWlzU3VwcG9ydGVkVGVybWluYWwoKVxuICAgICAgPyBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6ICdhdXRvQ29ubmVjdElkZScsXG4gICAgICAgICAgICBsYWJlbDogJ0F1dG8tY29ubmVjdCB0byBJREUgKGV4dGVybmFsIHRlcm1pbmFsKScsXG4gICAgICAgICAgICB2YWx1ZTogZ2xvYmFsQ29uZmlnLmF1dG9Db25uZWN0SWRlID8/IGZhbHNlLFxuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nIGFzIGNvbnN0LFxuICAgICAgICAgICAgb25DaGFuZ2UoYXV0b0Nvbm5lY3RJZGU6IGJvb2xlYW4pIHtcbiAgICAgICAgICAgICAgc2F2ZUdsb2JhbENvbmZpZyhjdXJyZW50ID0+ICh7IC4uLmN1cnJlbnQsIGF1dG9Db25uZWN0SWRlIH0pKVxuICAgICAgICAgICAgICBzZXRHbG9iYWxDb25maWcoeyAuLi5nZXRHbG9iYWxDb25maWcoKSwgYXV0b0Nvbm5lY3RJZGUgfSlcblxuICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfYXV0b19jb25uZWN0X2lkZV9jaGFuZ2VkJywge1xuICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGF1dG9Db25uZWN0SWRlLFxuICAgICAgICAgICAgICAgIHNvdXJjZTpcbiAgICAgICAgICAgICAgICAgICdjb25maWdfcGFuZWwnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF1cbiAgICAgIDogW10pLFxuICAgIC4uLihpc1N1cHBvcnRlZFRlcm1pbmFsKClcbiAgICAgID8gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnYXV0b0luc3RhbGxJZGVFeHRlbnNpb24nLFxuICAgICAgICAgICAgbGFiZWw6ICdBdXRvLWluc3RhbGwgSURFIGV4dGVuc2lvbicsXG4gICAgICAgICAgICB2YWx1ZTogZ2xvYmFsQ29uZmlnLmF1dG9JbnN0YWxsSWRlRXh0ZW5zaW9uID8/IHRydWUsXG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICAgICAgICBvbkNoYW5nZShhdXRvSW5zdGFsbElkZUV4dGVuc2lvbjogYm9vbGVhbikge1xuICAgICAgICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAgICAgICAgICAgICAuLi5jdXJyZW50LFxuICAgICAgICAgICAgICAgIGF1dG9JbnN0YWxsSWRlRXh0ZW5zaW9uLFxuICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgc2V0R2xvYmFsQ29uZmlnKHsgLi4uZ2V0R2xvYmFsQ29uZmlnKCksIGF1dG9JbnN0YWxsSWRlRXh0ZW5zaW9uIH0pXG5cbiAgICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2F1dG9faW5zdGFsbF9pZGVfZXh0ZW5zaW9uX2NoYW5nZWQnLCB7XG4gICAgICAgICAgICAgICAgZW5hYmxlZDogYXV0b0luc3RhbGxJZGVFeHRlbnNpb24sXG4gICAgICAgICAgICAgICAgc291cmNlOlxuICAgICAgICAgICAgICAgICAgJ2NvbmZpZ19wYW5lbCcgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXVxuICAgICAgOiBbXSksXG4gICAge1xuICAgICAgaWQ6ICdjbGF1ZGVJbkNocm9tZURlZmF1bHRFbmFibGVkJyxcbiAgICAgIGxhYmVsOiAnQ2xhdWRlIGluIENocm9tZSBlbmFibGVkIGJ5IGRlZmF1bHQnLFxuICAgICAgdmFsdWU6IGdsb2JhbENvbmZpZy5jbGF1ZGVJbkNocm9tZURlZmF1bHRFbmFibGVkID8/IHRydWUsXG4gICAgICB0eXBlOiAnYm9vbGVhbicgYXMgY29uc3QsXG4gICAgICBvbkNoYW5nZShlbmFibGVkOiBib29sZWFuKSB7XG4gICAgICAgIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiAoe1xuICAgICAgICAgIC4uLmN1cnJlbnQsXG4gICAgICAgICAgY2xhdWRlSW5DaHJvbWVEZWZhdWx0RW5hYmxlZDogZW5hYmxlZCxcbiAgICAgICAgfSkpXG4gICAgICAgIHNldEdsb2JhbENvbmZpZyh7XG4gICAgICAgICAgLi4uZ2V0R2xvYmFsQ29uZmlnKCksXG4gICAgICAgICAgY2xhdWRlSW5DaHJvbWVEZWZhdWx0RW5hYmxlZDogZW5hYmxlZCxcbiAgICAgICAgfSlcbiAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2NsYXVkZV9pbl9jaHJvbWVfc2V0dGluZ19jaGFuZ2VkJywge1xuICAgICAgICAgIGVuYWJsZWQsXG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgIH0sXG4gICAgLy8gVGVhbW1hdGUgbW9kZSAob25seSBzaG93biB3aGVuIGFnZW50IHN3YXJtcyBhcmUgZW5hYmxlZClcbiAgICAuLi4oaXNBZ2VudFN3YXJtc0VuYWJsZWQoKVxuICAgICAgPyAoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNsaU92ZXJyaWRlID0gZ2V0Q2xpVGVhbW1hdGVNb2RlT3ZlcnJpZGUoKVxuICAgICAgICAgIGNvbnN0IGxhYmVsID0gY2xpT3ZlcnJpZGVcbiAgICAgICAgICAgID8gYFRlYW1tYXRlIG1vZGUgW292ZXJyaWRkZW46ICR7Y2xpT3ZlcnJpZGV9XWBcbiAgICAgICAgICAgIDogJ1RlYW1tYXRlIG1vZGUnXG4gICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgaWQ6ICd0ZWFtbWF0ZU1vZGUnLFxuICAgICAgICAgICAgICBsYWJlbCxcbiAgICAgICAgICAgICAgdmFsdWU6IGdsb2JhbENvbmZpZy50ZWFtbWF0ZU1vZGUgPz8gJ2F1dG8nLFxuICAgICAgICAgICAgICBvcHRpb25zOiBbJ2F1dG8nLCAndG11eCcsICdpbi1wcm9jZXNzJ10sXG4gICAgICAgICAgICAgIHR5cGU6ICdlbnVtJyBhcyBjb25zdCxcbiAgICAgICAgICAgICAgb25DaGFuZ2UobW9kZTogc3RyaW5nKSB7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgbW9kZSAhPT0gJ2F1dG8nICYmXG4gICAgICAgICAgICAgICAgICBtb2RlICE9PSAndG11eCcgJiZcbiAgICAgICAgICAgICAgICAgIG1vZGUgIT09ICdpbi1wcm9jZXNzJ1xuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIENsZWFyIENMSSBvdmVycmlkZSBhbmQgc2V0IG5ldyBtb2RlIChwYXNzIG1vZGUgdG8gYXZvaWQgcmFjZSBjb25kaXRpb24pXG4gICAgICAgICAgICAgICAgY2xlYXJDbGlUZWFtbWF0ZU1vZGVPdmVycmlkZShtb2RlKVxuICAgICAgICAgICAgICAgIHNhdmVHbG9iYWxDb25maWcoY3VycmVudCA9PiAoe1xuICAgICAgICAgICAgICAgICAgLi4uY3VycmVudCxcbiAgICAgICAgICAgICAgICAgIHRlYW1tYXRlTW9kZTogbW9kZSxcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICBzZXRHbG9iYWxDb25maWcoe1xuICAgICAgICAgICAgICAgICAgLi4uZ2V0R2xvYmFsQ29uZmlnKCksXG4gICAgICAgICAgICAgICAgICB0ZWFtbWF0ZU1vZGU6IG1vZGUsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfdGVhbW1hdGVfbW9kZV9jaGFuZ2VkJywge1xuICAgICAgICAgICAgICAgICAgbW9kZTogbW9kZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBpZDogJ3RlYW1tYXRlRGVmYXVsdE1vZGVsJyxcbiAgICAgICAgICAgICAgbGFiZWw6ICdEZWZhdWx0IHRlYW1tYXRlIG1vZGVsJyxcbiAgICAgICAgICAgICAgdmFsdWU6IHRlYW1tYXRlTW9kZWxEaXNwbGF5U3RyaW5nKFxuICAgICAgICAgICAgICAgIGdsb2JhbENvbmZpZy50ZWFtbWF0ZURlZmF1bHRNb2RlbCxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgdHlwZTogJ21hbmFnZWRFbnVtJyBhcyBjb25zdCxcbiAgICAgICAgICAgICAgb25DaGFuZ2UoKSB7fSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXVxuICAgICAgICB9KSgpXG4gICAgICA6IFtdKSxcbiAgICAvLyBSZW1vdGUgYXQgc3RhcnR1cCB0b2dnbGUg4oCUIGdhdGVkIG9uIGJ1aWxkIGZsYWcgKyBHcm93dGhCb29rICsgcG9saWN5XG4gICAgLi4uKGZlYXR1cmUoJ0JSSURHRV9NT0RFJykgJiYgaXNCcmlkZ2VFbmFibGVkKClcbiAgICAgID8gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAncmVtb3RlQ29udHJvbEF0U3RhcnR1cCcsXG4gICAgICAgICAgICBsYWJlbDogJ0VuYWJsZSBSZW1vdGUgQ29udHJvbCBmb3IgYWxsIHNlc3Npb25zJyxcbiAgICAgICAgICAgIHZhbHVlOlxuICAgICAgICAgICAgICBnbG9iYWxDb25maWcucmVtb3RlQ29udHJvbEF0U3RhcnR1cCA9PT0gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgPyAnZGVmYXVsdCdcbiAgICAgICAgICAgICAgICA6IFN0cmluZyhnbG9iYWxDb25maWcucmVtb3RlQ29udHJvbEF0U3RhcnR1cCksXG4gICAgICAgICAgICBvcHRpb25zOiBbJ3RydWUnLCAnZmFsc2UnLCAnZGVmYXVsdCddLFxuICAgICAgICAgICAgdHlwZTogJ2VudW0nIGFzIGNvbnN0LFxuICAgICAgICAgICAgb25DaGFuZ2Uoc2VsZWN0ZWQ6IHN0cmluZykge1xuICAgICAgICAgICAgICBpZiAoc2VsZWN0ZWQgPT09ICdkZWZhdWx0Jykge1xuICAgICAgICAgICAgICAgIC8vIFVuc2V0IHRoZSBjb25maWcga2V5IHNvIGl0IGZhbGxzIGJhY2sgdG8gdGhlIHBsYXRmb3JtIGRlZmF1bHRcbiAgICAgICAgICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQucmVtb3RlQ29udHJvbEF0U3RhcnR1cCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY3VycmVudFxuICAgICAgICAgICAgICAgICAgY29uc3QgbmV4dCA9IHsgLi4uY3VycmVudCB9XG4gICAgICAgICAgICAgICAgICBkZWxldGUgbmV4dC5yZW1vdGVDb250cm9sQXRTdGFydHVwXG4gICAgICAgICAgICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgc2V0R2xvYmFsQ29uZmlnKHtcbiAgICAgICAgICAgICAgICAgIC4uLmdldEdsb2JhbENvbmZpZygpLFxuICAgICAgICAgICAgICAgICAgcmVtb3RlQ29udHJvbEF0U3RhcnR1cDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IHNlbGVjdGVkID09PSAndHJ1ZSdcbiAgICAgICAgICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4ge1xuICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQucmVtb3RlQ29udHJvbEF0U3RhcnR1cCA9PT0gZW5hYmxlZCkgcmV0dXJuIGN1cnJlbnRcbiAgICAgICAgICAgICAgICAgIHJldHVybiB7IC4uLmN1cnJlbnQsIHJlbW90ZUNvbnRyb2xBdFN0YXJ0dXA6IGVuYWJsZWQgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgc2V0R2xvYmFsQ29uZmlnKHtcbiAgICAgICAgICAgICAgICAgIC4uLmdldEdsb2JhbENvbmZpZygpLFxuICAgICAgICAgICAgICAgICAgcmVtb3RlQ29udHJvbEF0U3RhcnR1cDogZW5hYmxlZCxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIFN5bmMgdG8gQXBwU3RhdGUgc28gdXNlUmVwbEJyaWRnZSByZWFjdHMgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBnZXRSZW1vdGVDb250cm9sQXRTdGFydHVwKClcbiAgICAgICAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgcHJldi5yZXBsQnJpZGdlRW5hYmxlZCA9PT0gcmVzb2x2ZWQgJiZcbiAgICAgICAgICAgICAgICAgICFwcmV2LnJlcGxCcmlkZ2VPdXRib3VuZE9ubHlcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICByZXR1cm4gcHJldlxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgICAgcmVwbEJyaWRnZUVuYWJsZWQ6IHJlc29sdmVkLFxuICAgICAgICAgICAgICAgICAgcmVwbEJyaWRnZU91dGJvdW5kT25seTogZmFsc2UsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgICAuLi4oc2hvdWxkU2hvd0V4dGVybmFsSW5jbHVkZXNUb2dnbGVcbiAgICAgID8gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiAnc2hvd0V4dGVybmFsSW5jbHVkZXNEaWFsb2cnLFxuICAgICAgICAgICAgbGFiZWw6ICdFeHRlcm5hbCBDTEFVREUubWQgaW5jbHVkZXMnLFxuICAgICAgICAgICAgdmFsdWU6ICgoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHByb2plY3RDb25maWcgPSBnZXRDdXJyZW50UHJvamVjdENvbmZpZygpXG4gICAgICAgICAgICAgIGlmIChwcm9qZWN0Q29uZmlnLmhhc0NsYXVkZU1kRXh0ZXJuYWxJbmNsdWRlc0FwcHJvdmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICd0cnVlJ1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAnZmFsc2UnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pKCksXG4gICAgICAgICAgICB0eXBlOiAnbWFuYWdlZEVudW0nIGFzIGNvbnN0LFxuICAgICAgICAgICAgb25DaGFuZ2UoKSB7XG4gICAgICAgICAgICAgIC8vIFdpbGwgYmUgaGFuZGxlZCBieSB0b2dnbGVTZXR0aW5nIGZ1bmN0aW9uXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF1cbiAgICAgIDogW10pLFxuICAgIC4uLihwcm9jZXNzLmVudi5BTlRIUk9QSUNfQVBJX0tFWSAmJiAhaXNSdW5uaW5nT25Ib21lc3BhY2UoKVxuICAgICAgPyBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6ICdhcGlLZXknLFxuICAgICAgICAgICAgbGFiZWw6IChcbiAgICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgICAgVXNlIGN1c3RvbSBBUEkga2V5OnsnICd9XG4gICAgICAgICAgICAgICAgPFRleHQgYm9sZD5cbiAgICAgICAgICAgICAgICAgIHtub3JtYWxpemVBcGlLZXlGb3JDb25maWcocHJvY2Vzcy5lbnYuQU5USFJPUElDX0FQSV9LRVkpfVxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHNlYXJjaFRleHQ6ICdVc2UgY3VzdG9tIEFQSSBrZXknLFxuICAgICAgICAgICAgdmFsdWU6IEJvb2xlYW4oXG4gICAgICAgICAgICAgIHByb2Nlc3MuZW52LkFOVEhST1BJQ19BUElfS0VZICYmXG4gICAgICAgICAgICAgICAgZ2xvYmFsQ29uZmlnLmN1c3RvbUFwaUtleVJlc3BvbnNlcz8uYXBwcm92ZWQ/LmluY2x1ZGVzKFxuICAgICAgICAgICAgICAgICAgbm9ybWFsaXplQXBpS2V5Rm9yQ29uZmlnKHByb2Nlc3MuZW52LkFOVEhST1BJQ19BUElfS0VZKSxcbiAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyBhcyBjb25zdCxcbiAgICAgICAgICAgIG9uQ2hhbmdlKHVzZUN1c3RvbUtleTogYm9vbGVhbikge1xuICAgICAgICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWQgPSB7IC4uLmN1cnJlbnQgfVxuICAgICAgICAgICAgICAgIGlmICghdXBkYXRlZC5jdXN0b21BcGlLZXlSZXNwb25zZXMpIHtcbiAgICAgICAgICAgICAgICAgIHVwZGF0ZWQuY3VzdG9tQXBpS2V5UmVzcG9uc2VzID0ge1xuICAgICAgICAgICAgICAgICAgICBhcHByb3ZlZDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdGVkOiBbXSxcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCF1cGRhdGVkLmN1c3RvbUFwaUtleVJlc3BvbnNlcy5hcHByb3ZlZCkge1xuICAgICAgICAgICAgICAgICAgdXBkYXRlZC5jdXN0b21BcGlLZXlSZXNwb25zZXMgPSB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnVwZGF0ZWQuY3VzdG9tQXBpS2V5UmVzcG9uc2VzLFxuICAgICAgICAgICAgICAgICAgICBhcHByb3ZlZDogW10sXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghdXBkYXRlZC5jdXN0b21BcGlLZXlSZXNwb25zZXMucmVqZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgIHVwZGF0ZWQuY3VzdG9tQXBpS2V5UmVzcG9uc2VzID0ge1xuICAgICAgICAgICAgICAgICAgICAuLi51cGRhdGVkLmN1c3RvbUFwaUtleVJlc3BvbnNlcyxcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0ZWQ6IFtdLFxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuQU5USFJPUElDX0FQSV9LRVkpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHRydW5jYXRlZEtleSA9IG5vcm1hbGl6ZUFwaUtleUZvckNvbmZpZyhcbiAgICAgICAgICAgICAgICAgICAgcHJvY2Vzcy5lbnYuQU5USFJPUElDX0FQSV9LRVksXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICBpZiAodXNlQ3VzdG9tS2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQuY3VzdG9tQXBpS2V5UmVzcG9uc2VzID0ge1xuICAgICAgICAgICAgICAgICAgICAgIC4uLnVwZGF0ZWQuY3VzdG9tQXBpS2V5UmVzcG9uc2VzLFxuICAgICAgICAgICAgICAgICAgICAgIGFwcHJvdmVkOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi4oXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQuY3VzdG9tQXBpS2V5UmVzcG9uc2VzLmFwcHJvdmVkID8/IFtdXG4gICAgICAgICAgICAgICAgICAgICAgICApLmZpbHRlcihrID0+IGsgIT09IHRydW5jYXRlZEtleSksXG4gICAgICAgICAgICAgICAgICAgICAgICB0cnVuY2F0ZWRLZXksXG4gICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICByZWplY3RlZDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZC5jdXN0b21BcGlLZXlSZXNwb25zZXMucmVqZWN0ZWQgPz8gW11cbiAgICAgICAgICAgICAgICAgICAgICApLmZpbHRlcihrID0+IGsgIT09IHRydW5jYXRlZEtleSksXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQuY3VzdG9tQXBpS2V5UmVzcG9uc2VzID0ge1xuICAgICAgICAgICAgICAgICAgICAgIC4uLnVwZGF0ZWQuY3VzdG9tQXBpS2V5UmVzcG9uc2VzLFxuICAgICAgICAgICAgICAgICAgICAgIGFwcHJvdmVkOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkLmN1c3RvbUFwaUtleVJlc3BvbnNlcy5hcHByb3ZlZCA/PyBbXVxuICAgICAgICAgICAgICAgICAgICAgICkuZmlsdGVyKGsgPT4gayAhPT0gdHJ1bmNhdGVkS2V5KSxcbiAgICAgICAgICAgICAgICAgICAgICByZWplY3RlZDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4uKFxuICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkLmN1c3RvbUFwaUtleVJlc3BvbnNlcy5yZWplY3RlZCA/PyBbXVxuICAgICAgICAgICAgICAgICAgICAgICAgKS5maWx0ZXIoayA9PiBrICE9PSB0cnVuY2F0ZWRLZXkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHJ1bmNhdGVkS2V5LFxuICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVwZGF0ZWRcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgc2V0R2xvYmFsQ29uZmlnKGdldEdsb2JhbENvbmZpZygpKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgXVxuXG4gIC8vIEZpbHRlciBzZXR0aW5ncyBiYXNlZCBvbiBzZWFyY2ggcXVlcnlcbiAgY29uc3QgZmlsdGVyZWRTZXR0aW5nc0l0ZW1zID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCFzZWFyY2hRdWVyeSkgcmV0dXJuIHNldHRpbmdzSXRlbXNcbiAgICBjb25zdCBsb3dlclF1ZXJ5ID0gc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKVxuICAgIHJldHVybiBzZXR0aW5nc0l0ZW1zLmZpbHRlcihzZXR0aW5nID0+IHtcbiAgICAgIGlmIChzZXR0aW5nLmlkLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXJRdWVyeSkpIHJldHVybiB0cnVlXG4gICAgICBjb25zdCBzZWFyY2hhYmxlVGV4dCA9XG4gICAgICAgICdzZWFyY2hUZXh0JyBpbiBzZXR0aW5nID8gc2V0dGluZy5zZWFyY2hUZXh0IDogc2V0dGluZy5sYWJlbFxuICAgICAgcmV0dXJuIHNlYXJjaGFibGVUZXh0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXJRdWVyeSlcbiAgICB9KVxuICB9LCBbc2V0dGluZ3NJdGVtcywgc2VhcmNoUXVlcnldKVxuXG4gIC8vIEFkanVzdCBzZWxlY3RlZCBpbmRleCB3aGVuIGZpbHRlcmVkIGxpc3Qgc2hyaW5rcywgYW5kIGtlZXAgdGhlIHNlbGVjdGVkXG4gIC8vIGl0ZW0gdmlzaWJsZSB3aGVuIG1heFZpc2libGUgY2hhbmdlcyAoZS5nLiwgdGVybWluYWwgcmVzaXplKS5cbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoc2VsZWN0ZWRJbmRleCA+PSBmaWx0ZXJlZFNldHRpbmdzSXRlbXMubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuZXdJbmRleCA9IE1hdGgubWF4KDAsIGZpbHRlcmVkU2V0dGluZ3NJdGVtcy5sZW5ndGggLSAxKVxuICAgICAgc2V0U2VsZWN0ZWRJbmRleChuZXdJbmRleClcbiAgICAgIHNldFNjcm9sbE9mZnNldChNYXRoLm1heCgwLCBuZXdJbmRleCAtIG1heFZpc2libGUgKyAxKSlcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBzZXRTY3JvbGxPZmZzZXQocHJldiA9PiB7XG4gICAgICBpZiAoc2VsZWN0ZWRJbmRleCA8IHByZXYpIHJldHVybiBzZWxlY3RlZEluZGV4XG4gICAgICBpZiAoc2VsZWN0ZWRJbmRleCA+PSBwcmV2ICsgbWF4VmlzaWJsZSlcbiAgICAgICAgcmV0dXJuIHNlbGVjdGVkSW5kZXggLSBtYXhWaXNpYmxlICsgMVxuICAgICAgcmV0dXJuIHByZXZcbiAgICB9KVxuICB9LCBbZmlsdGVyZWRTZXR0aW5nc0l0ZW1zLmxlbmd0aCwgc2VsZWN0ZWRJbmRleCwgbWF4VmlzaWJsZV0pXG5cbiAgLy8gS2VlcCB0aGUgc2VsZWN0ZWQgaXRlbSB2aXNpYmxlIHdpdGhpbiB0aGUgc2Nyb2xsIHdpbmRvdy5cbiAgLy8gQ2FsbGVkIHN5bmNocm9ub3VzbHkgZnJvbSBuYXZpZ2F0aW9uIGhhbmRsZXJzIHRvIGF2b2lkIGEgcmVuZGVyIGZyYW1lXG4gIC8vIHdoZXJlIHRoZSBzZWxlY3RlZCBpdGVtIGZhbGxzIG91dHNpZGUgdGhlIHZpc2libGUgd2luZG93LlxuICBjb25zdCBhZGp1c3RTY3JvbGxPZmZzZXQgPSB1c2VDYWxsYmFjayhcbiAgICAobmV3SW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgc2V0U2Nyb2xsT2Zmc2V0KHByZXYgPT4ge1xuICAgICAgICBpZiAobmV3SW5kZXggPCBwcmV2KSByZXR1cm4gbmV3SW5kZXhcbiAgICAgICAgaWYgKG5ld0luZGV4ID49IHByZXYgKyBtYXhWaXNpYmxlKSByZXR1cm4gbmV3SW5kZXggLSBtYXhWaXNpYmxlICsgMVxuICAgICAgICByZXR1cm4gcHJldlxuICAgICAgfSlcbiAgICB9LFxuICAgIFttYXhWaXNpYmxlXSxcbiAgKVxuXG4gIC8vIEVudGVyOiBrZWVwIGFsbCBjaGFuZ2VzIChhbHJlYWR5IHBlcnNpc3RlZCBieSBvbkNoYW5nZSBoYW5kbGVycyksIGNsb3NlXG4gIC8vIHdpdGggYSBzdW1tYXJ5IG9mIHdoYXQgY2hhbmdlZC5cbiAgY29uc3QgaGFuZGxlU2F2ZUFuZENsb3NlID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIC8vIFN1Ym1lbnUgaGFuZGxpbmc6IGVhY2ggc3VibWVudSBoYXMgaXRzIG93biBFbnRlci9Fc2Mg4oCUIGRvbid0IGNsb3NlXG4gICAgLy8gdGhlIHdob2xlIHBhbmVsIHdoaWxlIG9uZSBpcyBvcGVuLlxuICAgIGlmIChzaG93U3VibWVudSAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIC8vIExvZyBhbnkgY2hhbmdlcyB0aGF0IHdlcmUgbWFkZVxuICAgIC8vIFRPRE86IE1ha2UgdGhlc2UgcHJvcGVyIG1lc3NhZ2VzXG4gICAgY29uc3QgZm9ybWF0dGVkQ2hhbmdlczogc3RyaW5nW10gPSBPYmplY3QuZW50cmllcyhjaGFuZ2VzKS5tYXAoXG4gICAgICAoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9jb25maWdfY2hhbmdlZCcsIHtcbiAgICAgICAgICBrZXk6IGtleSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgIHZhbHVlOlxuICAgICAgICAgICAgdmFsdWUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGBTZXQgJHtrZXl9IHRvICR7Y2hhbGsuYm9sZCh2YWx1ZSl9YFxuICAgICAgfSxcbiAgICApXG4gICAgLy8gQ2hlY2sgZm9yIEFQSSBrZXkgY2hhbmdlc1xuICAgIC8vIE9uIGhvbWVzcGFjZSwgQU5USFJPUElDX0FQSV9LRVkgaXMgcHJlc2VydmVkIGluIHByb2Nlc3MuZW52IGZvciBjaGlsZFxuICAgIC8vIHByb2Nlc3NlcyBidXQgaWdub3JlZCBieSBDbGF1ZGUgQ29kZSBpdHNlbGYgKHNlZSBhdXRoLnRzKS5cbiAgICBjb25zdCBlZmZlY3RpdmVBcGlLZXkgPSBpc1J1bm5pbmdPbkhvbWVzcGFjZSgpXG4gICAgICA/IHVuZGVmaW5lZFxuICAgICAgOiBwcm9jZXNzLmVudi5BTlRIUk9QSUNfQVBJX0tFWVxuICAgIGNvbnN0IGluaXRpYWxVc2luZ0N1c3RvbUtleSA9IEJvb2xlYW4oXG4gICAgICBlZmZlY3RpdmVBcGlLZXkgJiZcbiAgICAgICAgaW5pdGlhbENvbmZpZy5jdXJyZW50LmN1c3RvbUFwaUtleVJlc3BvbnNlcz8uYXBwcm92ZWQ/LmluY2x1ZGVzKFxuICAgICAgICAgIG5vcm1hbGl6ZUFwaUtleUZvckNvbmZpZyhlZmZlY3RpdmVBcGlLZXkpLFxuICAgICAgICApLFxuICAgIClcbiAgICBjb25zdCBjdXJyZW50VXNpbmdDdXN0b21LZXkgPSBCb29sZWFuKFxuICAgICAgZWZmZWN0aXZlQXBpS2V5ICYmXG4gICAgICAgIGdsb2JhbENvbmZpZy5jdXN0b21BcGlLZXlSZXNwb25zZXM/LmFwcHJvdmVkPy5pbmNsdWRlcyhcbiAgICAgICAgICBub3JtYWxpemVBcGlLZXlGb3JDb25maWcoZWZmZWN0aXZlQXBpS2V5KSxcbiAgICAgICAgKSxcbiAgICApXG4gICAgaWYgKGluaXRpYWxVc2luZ0N1c3RvbUtleSAhPT0gY3VycmVudFVzaW5nQ3VzdG9tS2V5KSB7XG4gICAgICBmb3JtYXR0ZWRDaGFuZ2VzLnB1c2goXG4gICAgICAgIGAke2N1cnJlbnRVc2luZ0N1c3RvbUtleSA/ICdFbmFibGVkJyA6ICdEaXNhYmxlZCd9IGN1c3RvbSBBUEkga2V5YCxcbiAgICAgIClcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9jb25maWdfY2hhbmdlZCcsIHtcbiAgICAgICAga2V5OiAnZW52LkFOVEhST1BJQ19BUElfS0VZJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICB2YWx1ZTpcbiAgICAgICAgICBjdXJyZW50VXNpbmdDdXN0b21LZXkgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIH0pXG4gICAgfVxuICAgIGlmIChnbG9iYWxDb25maWcudGhlbWUgIT09IGluaXRpYWxDb25maWcuY3VycmVudC50aGVtZSkge1xuICAgICAgZm9ybWF0dGVkQ2hhbmdlcy5wdXNoKGBTZXQgdGhlbWUgdG8gJHtjaGFsay5ib2xkKGdsb2JhbENvbmZpZy50aGVtZSl9YClcbiAgICB9XG4gICAgaWYgKFxuICAgICAgZ2xvYmFsQ29uZmlnLnByZWZlcnJlZE5vdGlmQ2hhbm5lbCAhPT1cbiAgICAgIGluaXRpYWxDb25maWcuY3VycmVudC5wcmVmZXJyZWROb3RpZkNoYW5uZWxcbiAgICApIHtcbiAgICAgIGZvcm1hdHRlZENoYW5nZXMucHVzaChcbiAgICAgICAgYFNldCBub3RpZmljYXRpb25zIHRvICR7Y2hhbGsuYm9sZChnbG9iYWxDb25maWcucHJlZmVycmVkTm90aWZDaGFubmVsKX1gLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAoY3VycmVudE91dHB1dFN0eWxlICE9PSBpbml0aWFsT3V0cHV0U3R5bGUuY3VycmVudCkge1xuICAgICAgZm9ybWF0dGVkQ2hhbmdlcy5wdXNoKFxuICAgICAgICBgU2V0IG91dHB1dCBzdHlsZSB0byAke2NoYWxrLmJvbGQoY3VycmVudE91dHB1dFN0eWxlKX1gLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAoY3VycmVudExhbmd1YWdlICE9PSBpbml0aWFsTGFuZ3VhZ2UuY3VycmVudCkge1xuICAgICAgZm9ybWF0dGVkQ2hhbmdlcy5wdXNoKFxuICAgICAgICBgU2V0IHJlc3BvbnNlIGxhbmd1YWdlIHRvICR7Y2hhbGsuYm9sZChjdXJyZW50TGFuZ3VhZ2UgPz8gJ0RlZmF1bHQgKEVuZ2xpc2gpJyl9YCxcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKGdsb2JhbENvbmZpZy5lZGl0b3JNb2RlICE9PSBpbml0aWFsQ29uZmlnLmN1cnJlbnQuZWRpdG9yTW9kZSkge1xuICAgICAgZm9ybWF0dGVkQ2hhbmdlcy5wdXNoKFxuICAgICAgICBgU2V0IGVkaXRvciBtb2RlIHRvICR7Y2hhbGsuYm9sZChnbG9iYWxDb25maWcuZWRpdG9yTW9kZSB8fCAnZW1hY3MnKX1gLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAoZ2xvYmFsQ29uZmlnLmRpZmZUb29sICE9PSBpbml0aWFsQ29uZmlnLmN1cnJlbnQuZGlmZlRvb2wpIHtcbiAgICAgIGZvcm1hdHRlZENoYW5nZXMucHVzaChcbiAgICAgICAgYFNldCBkaWZmIHRvb2wgdG8gJHtjaGFsay5ib2xkKGdsb2JhbENvbmZpZy5kaWZmVG9vbCl9YCxcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKGdsb2JhbENvbmZpZy5hdXRvQ29ubmVjdElkZSAhPT0gaW5pdGlhbENvbmZpZy5jdXJyZW50LmF1dG9Db25uZWN0SWRlKSB7XG4gICAgICBmb3JtYXR0ZWRDaGFuZ2VzLnB1c2goXG4gICAgICAgIGAke2dsb2JhbENvbmZpZy5hdXRvQ29ubmVjdElkZSA/ICdFbmFibGVkJyA6ICdEaXNhYmxlZCd9IGF1dG8tY29ubmVjdCB0byBJREVgLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAoXG4gICAgICBnbG9iYWxDb25maWcuYXV0b0luc3RhbGxJZGVFeHRlbnNpb24gIT09XG4gICAgICBpbml0aWFsQ29uZmlnLmN1cnJlbnQuYXV0b0luc3RhbGxJZGVFeHRlbnNpb25cbiAgICApIHtcbiAgICAgIGZvcm1hdHRlZENoYW5nZXMucHVzaChcbiAgICAgICAgYCR7Z2xvYmFsQ29uZmlnLmF1dG9JbnN0YWxsSWRlRXh0ZW5zaW9uID8gJ0VuYWJsZWQnIDogJ0Rpc2FibGVkJ30gYXV0by1pbnN0YWxsIElERSBleHRlbnNpb25gLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAoXG4gICAgICBnbG9iYWxDb25maWcuYXV0b0NvbXBhY3RFbmFibGVkICE9PVxuICAgICAgaW5pdGlhbENvbmZpZy5jdXJyZW50LmF1dG9Db21wYWN0RW5hYmxlZFxuICAgICkge1xuICAgICAgZm9ybWF0dGVkQ2hhbmdlcy5wdXNoKFxuICAgICAgICBgJHtnbG9iYWxDb25maWcuYXV0b0NvbXBhY3RFbmFibGVkID8gJ0VuYWJsZWQnIDogJ0Rpc2FibGVkJ30gYXV0by1jb21wYWN0YCxcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKFxuICAgICAgZ2xvYmFsQ29uZmlnLnJlc3BlY3RHaXRpZ25vcmUgIT09IGluaXRpYWxDb25maWcuY3VycmVudC5yZXNwZWN0R2l0aWdub3JlXG4gICAgKSB7XG4gICAgICBmb3JtYXR0ZWRDaGFuZ2VzLnB1c2goXG4gICAgICAgIGAke2dsb2JhbENvbmZpZy5yZXNwZWN0R2l0aWdub3JlID8gJ0VuYWJsZWQnIDogJ0Rpc2FibGVkJ30gcmVzcGVjdCAuZ2l0aWdub3JlIGluIGZpbGUgcGlja2VyYCxcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKFxuICAgICAgZ2xvYmFsQ29uZmlnLmNvcHlGdWxsUmVzcG9uc2UgIT09IGluaXRpYWxDb25maWcuY3VycmVudC5jb3B5RnVsbFJlc3BvbnNlXG4gICAgKSB7XG4gICAgICBmb3JtYXR0ZWRDaGFuZ2VzLnB1c2goXG4gICAgICAgIGAke2dsb2JhbENvbmZpZy5jb3B5RnVsbFJlc3BvbnNlID8gJ0VuYWJsZWQnIDogJ0Rpc2FibGVkJ30gYWx3YXlzIGNvcHkgZnVsbCByZXNwb25zZWAsXG4gICAgICApXG4gICAgfVxuICAgIGlmIChnbG9iYWxDb25maWcuY29weU9uU2VsZWN0ICE9PSBpbml0aWFsQ29uZmlnLmN1cnJlbnQuY29weU9uU2VsZWN0KSB7XG4gICAgICBmb3JtYXR0ZWRDaGFuZ2VzLnB1c2goXG4gICAgICAgIGAke2dsb2JhbENvbmZpZy5jb3B5T25TZWxlY3QgPyAnRW5hYmxlZCcgOiAnRGlzYWJsZWQnfSBjb3B5IG9uIHNlbGVjdGAsXG4gICAgICApXG4gICAgfVxuICAgIGlmIChcbiAgICAgIGdsb2JhbENvbmZpZy50ZXJtaW5hbFByb2dyZXNzQmFyRW5hYmxlZCAhPT1cbiAgICAgIGluaXRpYWxDb25maWcuY3VycmVudC50ZXJtaW5hbFByb2dyZXNzQmFyRW5hYmxlZFxuICAgICkge1xuICAgICAgZm9ybWF0dGVkQ2hhbmdlcy5wdXNoKFxuICAgICAgICBgJHtnbG9iYWxDb25maWcudGVybWluYWxQcm9ncmVzc0JhckVuYWJsZWQgPyAnRW5hYmxlZCcgOiAnRGlzYWJsZWQnfSB0ZXJtaW5hbCBwcm9ncmVzcyBiYXJgLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAoXG4gICAgICBnbG9iYWxDb25maWcuc2hvd1N0YXR1c0luVGVybWluYWxUYWIgIT09XG4gICAgICBpbml0aWFsQ29uZmlnLmN1cnJlbnQuc2hvd1N0YXR1c0luVGVybWluYWxUYWJcbiAgICApIHtcbiAgICAgIGZvcm1hdHRlZENoYW5nZXMucHVzaChcbiAgICAgICAgYCR7Z2xvYmFsQ29uZmlnLnNob3dTdGF0dXNJblRlcm1pbmFsVGFiID8gJ0VuYWJsZWQnIDogJ0Rpc2FibGVkJ30gdGVybWluYWwgdGFiIHN0YXR1c2AsXG4gICAgICApXG4gICAgfVxuICAgIGlmIChcbiAgICAgIGdsb2JhbENvbmZpZy5zaG93VHVybkR1cmF0aW9uICE9PSBpbml0aWFsQ29uZmlnLmN1cnJlbnQuc2hvd1R1cm5EdXJhdGlvblxuICAgICkge1xuICAgICAgZm9ybWF0dGVkQ2hhbmdlcy5wdXNoKFxuICAgICAgICBgJHtnbG9iYWxDb25maWcuc2hvd1R1cm5EdXJhdGlvbiA/ICdFbmFibGVkJyA6ICdEaXNhYmxlZCd9IHR1cm4gZHVyYXRpb25gLFxuICAgICAgKVxuICAgIH1cbiAgICBpZiAoXG4gICAgICBnbG9iYWxDb25maWcucmVtb3RlQ29udHJvbEF0U3RhcnR1cCAhPT1cbiAgICAgIGluaXRpYWxDb25maWcuY3VycmVudC5yZW1vdGVDb250cm9sQXRTdGFydHVwXG4gICAgKSB7XG4gICAgICBjb25zdCByZW1vdGVMYWJlbCA9XG4gICAgICAgIGdsb2JhbENvbmZpZy5yZW1vdGVDb250cm9sQXRTdGFydHVwID09PSB1bmRlZmluZWRcbiAgICAgICAgICA/ICdSZXNldCBSZW1vdGUgQ29udHJvbCB0byBkZWZhdWx0J1xuICAgICAgICAgIDogYCR7Z2xvYmFsQ29uZmlnLnJlbW90ZUNvbnRyb2xBdFN0YXJ0dXAgPyAnRW5hYmxlZCcgOiAnRGlzYWJsZWQnfSBSZW1vdGUgQ29udHJvbCBmb3IgYWxsIHNlc3Npb25zYFxuICAgICAgZm9ybWF0dGVkQ2hhbmdlcy5wdXNoKHJlbW90ZUxhYmVsKVxuICAgIH1cbiAgICBpZiAoXG4gICAgICBzZXR0aW5nc0RhdGE/LmF1dG9VcGRhdGVzQ2hhbm5lbCAhPT1cbiAgICAgIGluaXRpYWxTZXR0aW5nc0RhdGEuY3VycmVudD8uYXV0b1VwZGF0ZXNDaGFubmVsXG4gICAgKSB7XG4gICAgICBmb3JtYXR0ZWRDaGFuZ2VzLnB1c2goXG4gICAgICAgIGBTZXQgYXV0by11cGRhdGUgY2hhbm5lbCB0byAke2NoYWxrLmJvbGQoc2V0dGluZ3NEYXRhPy5hdXRvVXBkYXRlc0NoYW5uZWwgPz8gJ2xhdGVzdCcpfWAsXG4gICAgICApXG4gICAgfVxuICAgIGlmIChmb3JtYXR0ZWRDaGFuZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIG9uQ2xvc2UoZm9ybWF0dGVkQ2hhbmdlcy5qb2luKCdcXG4nKSlcbiAgICB9IGVsc2Uge1xuICAgICAgb25DbG9zZSgnQ29uZmlnIGRpYWxvZyBkaXNtaXNzZWQnLCB7IGRpc3BsYXk6ICdzeXN0ZW0nIH0pXG4gICAgfVxuICB9LCBbXG4gICAgc2hvd1N1Ym1lbnUsXG4gICAgY2hhbmdlcyxcbiAgICBnbG9iYWxDb25maWcsXG4gICAgbWFpbkxvb3BNb2RlbCxcbiAgICBjdXJyZW50T3V0cHV0U3R5bGUsXG4gICAgY3VycmVudExhbmd1YWdlLFxuICAgIHNldHRpbmdzRGF0YT8uYXV0b1VwZGF0ZXNDaGFubmVsLFxuICAgIGlzRmFzdE1vZGVFbmFibGVkKClcbiAgICAgID8gKHNldHRpbmdzRGF0YSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IHVuZGVmaW5lZCk/LmZhc3RNb2RlXG4gICAgICA6IHVuZGVmaW5lZCxcbiAgICBvbkNsb3NlLFxuICBdKVxuXG4gIC8vIFJlc3RvcmUgYWxsIHN0YXRlIHN0b3JlcyB0byB0aGVpciBtb3VudC10aW1lIHNuYXBzaG90cy4gQ2hhbmdlcyBhcmVcbiAgLy8gYXBwbGllZCB0byBkaXNrL0FwcFN0YXRlIGltbWVkaWF0ZWx5IG9uIHRvZ2dsZSwgc28gXCJjYW5jZWxcIiBtZWFuc1xuICAvLyBhY3RpdmVseSB3cml0aW5nIHRoZSBvbGQgdmFsdWVzIGJhY2suXG4gIGNvbnN0IHJldmVydENoYW5nZXMgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgLy8gVGhlbWU6IHJlc3RvcmVzIFRoZW1lUHJvdmlkZXIgUmVhY3Qgc3RhdGUuIE11c3QgcnVuIGJlZm9yZSB0aGUgZ2xvYmFsXG4gICAgLy8gY29uZmlnIG92ZXJ3cml0ZSBzaW5jZSBzZXRUaGVtZSBpbnRlcm5hbGx5IGNhbGxzIHNhdmVHbG9iYWxDb25maWcgd2l0aFxuICAgIC8vIGEgcGFydGlhbCB1cGRhdGUg4oCUIHdlIHdhbnQgdGhlIGZ1bGwgc25hcHNob3QgdG8gYmUgdGhlIGxhc3Qgd3JpdGUuXG4gICAgaWYgKHRoZW1lU2V0dGluZyAhPT0gaW5pdGlhbFRoZW1lU2V0dGluZy5jdXJyZW50KSB7XG4gICAgICBzZXRUaGVtZShpbml0aWFsVGhlbWVTZXR0aW5nLmN1cnJlbnQpXG4gICAgfVxuICAgIC8vIEdsb2JhbCBjb25maWc6IGZ1bGwgb3ZlcndyaXRlIGZyb20gc25hcHNob3QuIHNhdmVHbG9iYWxDb25maWcgc2tpcHMgaWZcbiAgICAvLyB0aGUgcmV0dXJuZWQgcmVmIGVxdWFscyBjdXJyZW50ICh0ZXN0IG1vZGUgY2hlY2tzIHJlZjsgcHJvZCB3cml0ZXMgdG9cbiAgICAvLyBkaXNrIGJ1dCBjb250ZW50IGlzIGlkZW50aWNhbCkuXG4gICAgc2F2ZUdsb2JhbENvbmZpZygoKSA9PiBpbml0aWFsQ29uZmlnLmN1cnJlbnQpXG4gICAgLy8gU2V0dGluZ3MgZmlsZXM6IHJlc3RvcmUgZWFjaCBrZXkgQ29uZmlnIG1heSBoYXZlIHRvdWNoZWQuIHVuZGVmaW5lZFxuICAgIC8vIGRlbGV0ZXMgdGhlIGtleSAodXBkYXRlU2V0dGluZ3NGb3JTb3VyY2UgY3VzdG9taXplciBhdCBzZXR0aW5ncy50czozNjgpLlxuICAgIGNvbnN0IGlsID0gaW5pdGlhbExvY2FsU2V0dGluZ3NcbiAgICB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSgnbG9jYWxTZXR0aW5ncycsIHtcbiAgICAgIHNwaW5uZXJUaXBzRW5hYmxlZDogaWw/LnNwaW5uZXJUaXBzRW5hYmxlZCxcbiAgICAgIHByZWZlcnNSZWR1Y2VkTW90aW9uOiBpbD8ucHJlZmVyc1JlZHVjZWRNb3Rpb24sXG4gICAgICBkZWZhdWx0VmlldzogaWw/LmRlZmF1bHRWaWV3LFxuICAgICAgb3V0cHV0U3R5bGU6IGlsPy5vdXRwdXRTdHlsZSxcbiAgICB9KVxuICAgIGNvbnN0IGl1ID0gaW5pdGlhbFVzZXJTZXR0aW5nc1xuICAgIHVwZGF0ZVNldHRpbmdzRm9yU291cmNlKCd1c2VyU2V0dGluZ3MnLCB7XG4gICAgICBhbHdheXNUaGlua2luZ0VuYWJsZWQ6IGl1Py5hbHdheXNUaGlua2luZ0VuYWJsZWQsXG4gICAgICBmYXN0TW9kZTogaXU/LmZhc3RNb2RlLFxuICAgICAgcHJvbXB0U3VnZ2VzdGlvbkVuYWJsZWQ6IGl1Py5wcm9tcHRTdWdnZXN0aW9uRW5hYmxlZCxcbiAgICAgIGF1dG9VcGRhdGVzQ2hhbm5lbDogaXU/LmF1dG9VcGRhdGVzQ2hhbm5lbCxcbiAgICAgIG1pbmltdW1WZXJzaW9uOiBpdT8ubWluaW11bVZlcnNpb24sXG4gICAgICBsYW5ndWFnZTogaXU/Lmxhbmd1YWdlLFxuICAgICAgLi4uKGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpXG4gICAgICAgID8ge1xuICAgICAgICAgICAgdXNlQXV0b01vZGVEdXJpbmdQbGFuOiAoXG4gICAgICAgICAgICAgIGl1IGFzIHsgdXNlQXV0b01vZGVEdXJpbmdQbGFuPzogYm9vbGVhbiB9IHwgdW5kZWZpbmVkXG4gICAgICAgICAgICApPy51c2VBdXRvTW9kZUR1cmluZ1BsYW4sXG4gICAgICAgICAgfVxuICAgICAgICA6IHt9KSxcbiAgICAgIC8vIFRoZW1lUGlja2VyJ3MgQ3RybCtUIHdyaXRlcyB0aGlzIGtleSBkaXJlY3RseSDigJQgaW5jbHVkZSBpdCBzbyB0aGVcbiAgICAgIC8vIGRpc2sgc3RhdGUgcmV2ZXJ0cyBhbG9uZyB3aXRoIHRoZSBpbi1tZW1vcnkgQXBwU3RhdGUuc2V0dGluZ3MgcmVzdG9yZS5cbiAgICAgIHN5bnRheEhpZ2hsaWdodGluZ0Rpc2FibGVkOiBpdT8uc3ludGF4SGlnaGxpZ2h0aW5nRGlzYWJsZWQsXG4gICAgICAvLyBwZXJtaXNzaW9uczogdGhlIGRlZmF1bHRNb2RlIG9uQ2hhbmdlIChhYm92ZSkgc3ByZWFkcyB0aGUgTUVSR0VEXG4gICAgICAvLyBzZXR0aW5nc0RhdGEucGVybWlzc2lvbnMgaW50byB1c2VyU2V0dGluZ3Mg4oCUIHByb2plY3QvcG9saWN5IGFsbG93L2RlbnlcbiAgICAgIC8vIGFycmF5cyBjYW4gbGVhayB0byBkaXNrLiBTcHJlYWQgdGhlIGZ1bGwgaW5pdGlhbCBzbmFwc2hvdCBzbyB0aGVcbiAgICAgIC8vIG1lcmdlV2l0aCBhcnJheS1jdXN0b21pemVyIChzZXR0aW5ncy50czozNzUpIHJlcGxhY2VzIGxlYWtlZCBhcnJheXMuXG4gICAgICAvLyBFeHBsaWNpdGx5IGluY2x1ZGUgZGVmYXVsdE1vZGUgc28gdW5kZWZpbmVkIHRyaWdnZXJzIHRoZSBjdXN0b21pemVyJ3NcbiAgICAgIC8vIGRlbGV0ZSBwYXRoIGV2ZW4gd2hlbiBpdS5wZXJtaXNzaW9ucyBsYWNrcyB0aGF0IGtleS5cbiAgICAgIHBlcm1pc3Npb25zOlxuICAgICAgICBpdT8ucGVybWlzc2lvbnMgPT09IHVuZGVmaW5lZFxuICAgICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgICAgOiB7IC4uLml1LnBlcm1pc3Npb25zLCBkZWZhdWx0TW9kZTogaXUucGVybWlzc2lvbnMuZGVmYXVsdE1vZGUgfSxcbiAgICB9KVxuICAgIC8vIEFwcFN0YXRlOiBiYXRjaC1yZXN0b3JlIGFsbCBwb3NzaWJseS10b3VjaGVkIGZpZWxkcy5cbiAgICBjb25zdCBpYSA9IGluaXRpYWxBcHBTdGF0ZVxuICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgIC4uLnByZXYsXG4gICAgICBtYWluTG9vcE1vZGVsOiBpYS5tYWluTG9vcE1vZGVsLFxuICAgICAgbWFpbkxvb3BNb2RlbEZvclNlc3Npb246IGlhLm1haW5Mb29wTW9kZWxGb3JTZXNzaW9uLFxuICAgICAgdmVyYm9zZTogaWEudmVyYm9zZSxcbiAgICAgIHRoaW5raW5nRW5hYmxlZDogaWEudGhpbmtpbmdFbmFibGVkLFxuICAgICAgZmFzdE1vZGU6IGlhLmZhc3RNb2RlLFxuICAgICAgcHJvbXB0U3VnZ2VzdGlvbkVuYWJsZWQ6IGlhLnByb21wdFN1Z2dlc3Rpb25FbmFibGVkLFxuICAgICAgaXNCcmllZk9ubHk6IGlhLmlzQnJpZWZPbmx5LFxuICAgICAgcmVwbEJyaWRnZUVuYWJsZWQ6IGlhLnJlcGxCcmlkZ2VFbmFibGVkLFxuICAgICAgcmVwbEJyaWRnZU91dGJvdW5kT25seTogaWEucmVwbEJyaWRnZU91dGJvdW5kT25seSxcbiAgICAgIHNldHRpbmdzOiBpYS5zZXR0aW5ncyxcbiAgICAgIC8vIFJlY29uY2lsZSBhdXRvLW1vZGUgc3RhdGUgYWZ0ZXIgdXNlQXV0b01vZGVEdXJpbmdQbGFuIHJldmVydCBhYm92ZSDigJRcbiAgICAgIC8vIHRoZSBvbkNoYW5nZSBoYW5kbGVyIG1heSBoYXZlIGFjdGl2YXRlZC9kZWFjdGl2YXRlZCBhdXRvIG1pZC1wbGFuLlxuICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0OiB0cmFuc2l0aW9uUGxhbkF1dG9Nb2RlKHByZXYudG9vbFBlcm1pc3Npb25Db250ZXh0KSxcbiAgICB9KSlcbiAgICAvLyBCb290c3RyYXAgc3RhdGU6IHJlc3RvcmUgdXNlck1zZ09wdEluLiBPbmx5IHRvdWNoZWQgYnkgdGhlIGRlZmF1bHRWaWV3XG4gICAgLy8gb25DaGFuZ2UgYWJvdmUsIHNvIG5vIGZlYXR1cmUoKSBndWFyZCBuZWVkZWQgaGVyZSAodGhhdCBwYXRoIG9ubHlcbiAgICAvLyBleGlzdHMgd2hlbiBzaG93RGVmYXVsdFZpZXdQaWNrZXIgaXMgdHJ1ZSkuXG4gICAgaWYgKGdldFVzZXJNc2dPcHRJbigpICE9PSBpbml0aWFsVXNlck1zZ09wdEluKSB7XG4gICAgICBzZXRVc2VyTXNnT3B0SW4oaW5pdGlhbFVzZXJNc2dPcHRJbilcbiAgICB9XG4gIH0sIFtcbiAgICB0aGVtZVNldHRpbmcsXG4gICAgc2V0VGhlbWUsXG4gICAgaW5pdGlhbExvY2FsU2V0dGluZ3MsXG4gICAgaW5pdGlhbFVzZXJTZXR0aW5ncyxcbiAgICBpbml0aWFsQXBwU3RhdGUsXG4gICAgaW5pdGlhbFVzZXJNc2dPcHRJbixcbiAgICBzZXRBcHBTdGF0ZSxcbiAgXSlcblxuICAvLyBFc2NhcGU6IHJldmVydCBhbGwgY2hhbmdlcyAoaWYgYW55KSBhbmQgY2xvc2UuXG4gIGNvbnN0IGhhbmRsZUVzY2FwZSA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBpZiAoc2hvd1N1Ym1lbnUgIT09IG51bGwpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAoaXNEaXJ0eS5jdXJyZW50KSB7XG4gICAgICByZXZlcnRDaGFuZ2VzKClcbiAgICB9XG4gICAgb25DbG9zZSgnQ29uZmlnIGRpYWxvZyBkaXNtaXNzZWQnLCB7IGRpc3BsYXk6ICdzeXN0ZW0nIH0pXG4gIH0sIFtzaG93U3VibWVudSwgcmV2ZXJ0Q2hhbmdlcywgb25DbG9zZV0pXG5cbiAgLy8gRGlzYWJsZSB3aGVuIHN1Ym1lbnUgaXMgb3BlbiBzbyB0aGUgc3VibWVudSdzIERpYWxvZyBoYW5kbGVzIEVTQywgYW5kIGluXG4gIC8vIHNlYXJjaCBtb2RlIHNvIHRoZSBvbktleURvd24gaGFuZGxlciAod2hpY2ggY2xlYXJzLXRoZW4tZXhpdHMgc2VhcmNoKVxuICAvLyB3aW5zIOKAlCBvdGhlcndpc2UgRXNjYXBlIGluIHNlYXJjaCB3b3VsZCBqdW1wIHN0cmFpZ2h0IHRvIHJldmVydCtjbG9zZS5cbiAgdXNlS2V5YmluZGluZygnY29uZmlybTpubycsIGhhbmRsZUVzY2FwZSwge1xuICAgIGNvbnRleHQ6ICdTZXR0aW5ncycsXG4gICAgaXNBY3RpdmU6IHNob3dTdWJtZW51ID09PSBudWxsICYmICFpc1NlYXJjaE1vZGUgJiYgIWhlYWRlckZvY3VzZWQsXG4gIH0pXG4gIC8vIFNhdmUtYW5kLWNsb3NlIGZpcmVzIG9uIEVudGVyIG9ubHkgd2hlbiBub3QgaW4gc2VhcmNoIG1vZGUgKEVudGVyIHRoZXJlXG4gIC8vIGV4aXRzIHNlYXJjaCB0byB0aGUgbGlzdCDigJQgc2VlIHRoZSBpc1NlYXJjaE1vZGUgYnJhbmNoIGluIGhhbmRsZUtleURvd24pLlxuICB1c2VLZXliaW5kaW5nKCdzZXR0aW5nczpjbG9zZScsIGhhbmRsZVNhdmVBbmRDbG9zZSwge1xuICAgIGNvbnRleHQ6ICdTZXR0aW5ncycsXG4gICAgaXNBY3RpdmU6IHNob3dTdWJtZW51ID09PSBudWxsICYmICFpc1NlYXJjaE1vZGUgJiYgIWhlYWRlckZvY3VzZWQsXG4gIH0pXG5cbiAgLy8gU2V0dGluZ3MgbmF2aWdhdGlvbiBhbmQgdG9nZ2xlIGFjdGlvbnMgdmlhIGNvbmZpZ3VyYWJsZSBrZXliaW5kaW5ncy5cbiAgLy8gT25seSBhY3RpdmUgd2hlbiBub3QgaW4gc2VhcmNoIG1vZGUgYW5kIG5vIHN1Ym1lbnUgaXMgb3Blbi5cbiAgY29uc3QgdG9nZ2xlU2V0dGluZyA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBjb25zdCBzZXR0aW5nID0gZmlsdGVyZWRTZXR0aW5nc0l0ZW1zW3NlbGVjdGVkSW5kZXhdXG4gICAgaWYgKCFzZXR0aW5nIHx8ICFzZXR0aW5nLm9uQ2hhbmdlKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoc2V0dGluZy50eXBlID09PSAnYm9vbGVhbicpIHtcbiAgICAgIGlzRGlydHkuY3VycmVudCA9IHRydWVcbiAgICAgIHNldHRpbmcub25DaGFuZ2UoIXNldHRpbmcudmFsdWUpXG4gICAgICBpZiAoc2V0dGluZy5pZCA9PT0gJ3RoaW5raW5nRW5hYmxlZCcpIHtcbiAgICAgICAgY29uc3QgbmV3VmFsdWUgPSAhc2V0dGluZy52YWx1ZVxuICAgICAgICBjb25zdCBiYWNrVG9Jbml0aWFsID0gbmV3VmFsdWUgPT09IGluaXRpYWxUaGlua2luZ0VuYWJsZWQuY3VycmVudFxuICAgICAgICBpZiAoYmFja1RvSW5pdGlhbCkge1xuICAgICAgICAgIHNldFNob3dUaGlua2luZ1dhcm5pbmcoZmFsc2UpXG4gICAgICAgIH0gZWxzZSBpZiAoY29udGV4dC5tZXNzYWdlcy5zb21lKG0gPT4gbS50eXBlID09PSAnYXNzaXN0YW50JykpIHtcbiAgICAgICAgICBzZXRTaG93VGhpbmtpbmdXYXJuaW5nKHRydWUpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHNldHRpbmcuaWQgPT09ICd0aGVtZScgfHxcbiAgICAgIHNldHRpbmcuaWQgPT09ICdtb2RlbCcgfHxcbiAgICAgIHNldHRpbmcuaWQgPT09ICd0ZWFtbWF0ZURlZmF1bHRNb2RlbCcgfHxcbiAgICAgIHNldHRpbmcuaWQgPT09ICdzaG93RXh0ZXJuYWxJbmNsdWRlc0RpYWxvZycgfHxcbiAgICAgIHNldHRpbmcuaWQgPT09ICdvdXRwdXRTdHlsZScgfHxcbiAgICAgIHNldHRpbmcuaWQgPT09ICdsYW5ndWFnZSdcbiAgICApIHtcbiAgICAgIC8vIG1hbmFnZWRFbnVtIGl0ZW1zIG9wZW4gYSBzdWJtZW51IOKAlCBpc0RpcnR5IGlzIHNldCBieSB0aGUgc3VibWVudSdzXG4gICAgICAvLyBjb21wbGV0aW9uIGNhbGxiYWNrLCBub3QgaGVyZSAoc3VibWVudSBtYXkgYmUgY2FuY2VsbGVkKS5cbiAgICAgIHN3aXRjaCAoc2V0dGluZy5pZCkge1xuICAgICAgICBjYXNlICd0aGVtZSc6XG4gICAgICAgICAgc2V0U2hvd1N1Ym1lbnUoJ1RoZW1lJylcbiAgICAgICAgICBzZXRUYWJzSGlkZGVuKHRydWUpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIGNhc2UgJ21vZGVsJzpcbiAgICAgICAgICBzZXRTaG93U3VibWVudSgnTW9kZWwnKVxuICAgICAgICAgIHNldFRhYnNIaWRkZW4odHJ1ZSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgY2FzZSAndGVhbW1hdGVEZWZhdWx0TW9kZWwnOlxuICAgICAgICAgIHNldFNob3dTdWJtZW51KCdUZWFtbWF0ZU1vZGVsJylcbiAgICAgICAgICBzZXRUYWJzSGlkZGVuKHRydWUpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIGNhc2UgJ3Nob3dFeHRlcm5hbEluY2x1ZGVzRGlhbG9nJzpcbiAgICAgICAgICBzZXRTaG93U3VibWVudSgnRXh0ZXJuYWxJbmNsdWRlcycpXG4gICAgICAgICAgc2V0VGFic0hpZGRlbih0cnVlKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICBjYXNlICdvdXRwdXRTdHlsZSc6XG4gICAgICAgICAgc2V0U2hvd1N1Ym1lbnUoJ091dHB1dFN0eWxlJylcbiAgICAgICAgICBzZXRUYWJzSGlkZGVuKHRydWUpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIGNhc2UgJ2xhbmd1YWdlJzpcbiAgICAgICAgICBzZXRTaG93U3VibWVudSgnTGFuZ3VhZ2UnKVxuICAgICAgICAgIHNldFRhYnNIaWRkZW4odHJ1ZSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc2V0dGluZy5pZCA9PT0gJ2F1dG9VcGRhdGVzQ2hhbm5lbCcpIHtcbiAgICAgIGlmIChhdXRvVXBkYXRlckRpc2FibGVkUmVhc29uKSB7XG4gICAgICAgIC8vIEF1dG8tdXBkYXRlcyBhcmUgZGlzYWJsZWQgLSBzaG93IGVuYWJsZSBkaWFsb2cgaW5zdGVhZFxuICAgICAgICBzZXRTaG93U3VibWVudSgnRW5hYmxlQXV0b1VwZGF0ZXMnKVxuICAgICAgICBzZXRUYWJzSGlkZGVuKHRydWUpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgY29uc3QgY3VycmVudENoYW5uZWwgPSBzZXR0aW5nc0RhdGE/LmF1dG9VcGRhdGVzQ2hhbm5lbCA/PyAnbGF0ZXN0J1xuICAgICAgaWYgKGN1cnJlbnRDaGFubmVsID09PSAnbGF0ZXN0Jykge1xuICAgICAgICAvLyBTd2l0Y2hpbmcgdG8gc3RhYmxlIC0gc2hvdyBkb3duZ3JhZGUgZGlhbG9nXG4gICAgICAgIHNldFNob3dTdWJtZW51KCdDaGFubmVsRG93bmdyYWRlJylcbiAgICAgICAgc2V0VGFic0hpZGRlbih0cnVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gU3dpdGNoaW5nIHRvIGxhdGVzdCAtIGp1c3QgZG8gaXQgYW5kIGNsZWFyIG1pbmltdW1WZXJzaW9uXG4gICAgICAgIGlzRGlydHkuY3VycmVudCA9IHRydWVcbiAgICAgICAgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2UoJ3VzZXJTZXR0aW5ncycsIHtcbiAgICAgICAgICBhdXRvVXBkYXRlc0NoYW5uZWw6ICdsYXRlc3QnLFxuICAgICAgICAgIG1pbmltdW1WZXJzaW9uOiB1bmRlZmluZWQsXG4gICAgICAgIH0pXG4gICAgICAgIHNldFNldHRpbmdzRGF0YShwcmV2ID0+ICh7XG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICBhdXRvVXBkYXRlc0NoYW5uZWw6ICdsYXRlc3QnLFxuICAgICAgICAgIG1pbmltdW1WZXJzaW9uOiB1bmRlZmluZWQsXG4gICAgICAgIH0pKVxuICAgICAgICBsb2dFdmVudCgndGVuZ3VfYXV0b3VwZGF0ZV9jaGFubmVsX2NoYW5nZWQnLCB7XG4gICAgICAgICAgY2hhbm5lbDpcbiAgICAgICAgICAgICdsYXRlc3QnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoc2V0dGluZy50eXBlID09PSAnZW51bScpIHtcbiAgICAgIGlzRGlydHkuY3VycmVudCA9IHRydWVcbiAgICAgIGNvbnN0IGN1cnJlbnRJbmRleCA9IHNldHRpbmcub3B0aW9ucy5pbmRleE9mKHNldHRpbmcudmFsdWUpXG4gICAgICBjb25zdCBuZXh0SW5kZXggPSAoY3VycmVudEluZGV4ICsgMSkgJSBzZXR0aW5nLm9wdGlvbnMubGVuZ3RoXG4gICAgICBzZXR0aW5nLm9uQ2hhbmdlKHNldHRpbmcub3B0aW9uc1tuZXh0SW5kZXhdISlcbiAgICAgIHJldHVyblxuICAgIH1cbiAgfSwgW1xuICAgIGF1dG9VcGRhdGVyRGlzYWJsZWRSZWFzb24sXG4gICAgZmlsdGVyZWRTZXR0aW5nc0l0ZW1zLFxuICAgIHNlbGVjdGVkSW5kZXgsXG4gICAgc2V0dGluZ3NEYXRhPy5hdXRvVXBkYXRlc0NoYW5uZWwsXG4gICAgc2V0VGFic0hpZGRlbixcbiAgXSlcblxuICBjb25zdCBtb3ZlU2VsZWN0aW9uID0gKGRlbHRhOiAtMSB8IDEpOiB2b2lkID0+IHtcbiAgICBzZXRTaG93VGhpbmtpbmdXYXJuaW5nKGZhbHNlKVxuICAgIGNvbnN0IG5ld0luZGV4ID0gTWF0aC5tYXgoXG4gICAgICAwLFxuICAgICAgTWF0aC5taW4oZmlsdGVyZWRTZXR0aW5nc0l0ZW1zLmxlbmd0aCAtIDEsIHNlbGVjdGVkSW5kZXggKyBkZWx0YSksXG4gICAgKVxuICAgIHNldFNlbGVjdGVkSW5kZXgobmV3SW5kZXgpXG4gICAgYWRqdXN0U2Nyb2xsT2Zmc2V0KG5ld0luZGV4KVxuICB9XG5cbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ3NlbGVjdDpwcmV2aW91cyc6ICgpID0+IHtcbiAgICAgICAgaWYgKHNlbGVjdGVkSW5kZXggPT09IDApIHtcbiAgICAgICAgICAvLyDihpEgYXQgdG9wIGVudGVycyBzZWFyY2ggbW9kZSBzbyB1c2VycyBjYW4gdHlwZS10by1maWx0ZXIgYWZ0ZXJcbiAgICAgICAgICAvLyByZWFjaGluZyB0aGUgbGlzdCBib3VuZGFyeS4gV2hlZWwtdXAgKHNjcm9sbDpsaW5lVXApIGNsYW1wc1xuICAgICAgICAgIC8vIGluc3RlYWQg4oCUIG92ZXJzaG9vdCBzaG91bGRuJ3QgbW92ZSBmb2N1cyBhd2F5IGZyb20gdGhlIGxpc3QuXG4gICAgICAgICAgc2V0U2hvd1RoaW5raW5nV2FybmluZyhmYWxzZSlcbiAgICAgICAgICBzZXRJc1NlYXJjaE1vZGUodHJ1ZSlcbiAgICAgICAgICBzZXRTY3JvbGxPZmZzZXQoMClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtb3ZlU2VsZWN0aW9uKC0xKVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgJ3NlbGVjdDpuZXh0JzogKCkgPT4gbW92ZVNlbGVjdGlvbigxKSxcbiAgICAgIC8vIFdoZWVsLiBTY3JvbGxLZXliaW5kaW5nSGFuZGxlcidzIHNjcm9sbDpsaW5lKiByZXR1cm5zIGZhbHNlIChub3RcbiAgICAgIC8vIGNvbnN1bWVkKSB3aGVuIHRoZSBTY3JvbGxCb3ggY29udGVudCBmaXRzIOKAlCB3aGljaCBpdCBhbHdheXMgZG9lc1xuICAgICAgLy8gaGVyZSBiZWNhdXNlIHRoZSBsaXN0IGlzIHBhZ2luYXRlZCAoc2xpY2UpLiBUaGUgZXZlbnQgZmFsbHMgdGhyb3VnaFxuICAgICAgLy8gdG8gdGhpcyBoYW5kbGVyIHdoaWNoIG5hdmlnYXRlcyB0aGUgbGlzdCwgY2xhbXBpbmcgYXQgYm91bmRhcmllcy5cbiAgICAgICdzY3JvbGw6bGluZVVwJzogKCkgPT4gbW92ZVNlbGVjdGlvbigtMSksXG4gICAgICAnc2Nyb2xsOmxpbmVEb3duJzogKCkgPT4gbW92ZVNlbGVjdGlvbigxKSxcbiAgICAgICdzZWxlY3Q6YWNjZXB0JzogdG9nZ2xlU2V0dGluZyxcbiAgICAgICdzZXR0aW5nczpzZWFyY2gnOiAoKSA9PiB7XG4gICAgICAgIHNldElzU2VhcmNoTW9kZSh0cnVlKVxuICAgICAgICBzZXRTZWFyY2hRdWVyeSgnJylcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnU2V0dGluZ3MnLFxuICAgICAgaXNBY3RpdmU6IHNob3dTdWJtZW51ID09PSBudWxsICYmICFpc1NlYXJjaE1vZGUgJiYgIWhlYWRlckZvY3VzZWQsXG4gICAgfSxcbiAgKVxuXG4gIC8vIENvbWJpbmVkIGtleSBoYW5kbGluZyBhY3Jvc3Mgc2VhcmNoL2xpc3QgbW9kZXMuIEJyYW5jaCBvcmRlciBtaXJyb3JzXG4gIC8vIHRoZSBvcmlnaW5hbCB1c2VJbnB1dCBnYXRlIHByaW9yaXR5OiBzdWJtZW51IGFuZCBoZWFkZXIgc2hvcnQtY2lyY3VpdFxuICAvLyBmaXJzdCAodGhlaXIgb3duIGhhbmRsZXJzIG93biBpbnB1dCksIHRoZW4gc2VhcmNoIHZzLiBsaXN0LlxuICBjb25zdCBoYW5kbGVLZXlEb3duID0gdXNlQ2FsbGJhY2soXG4gICAgKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICAgIGlmIChzaG93U3VibWVudSAhPT0gbnVsbCkgcmV0dXJuXG4gICAgICBpZiAoaGVhZGVyRm9jdXNlZCkgcmV0dXJuXG4gICAgICAvLyBTZWFyY2ggbW9kZTogRXNjIGNsZWFycyB0aGVuIGV4aXRzLCBFbnRlci/ihpMgbW92ZXMgdG8gdGhlIGxpc3QuXG4gICAgICBpZiAoaXNTZWFyY2hNb2RlKSB7XG4gICAgICAgIGlmIChlLmtleSA9PT0gJ2VzY2FwZScpIHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICBpZiAoc2VhcmNoUXVlcnkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgc2V0U2VhcmNoUXVlcnkoJycpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNldElzU2VhcmNoTW9kZShmYWxzZSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUua2V5ID09PSAncmV0dXJuJyB8fCBlLmtleSA9PT0gJ2Rvd24nIHx8IGUua2V5ID09PSAnd2hlZWxkb3duJykge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICAgIHNldElzU2VhcmNoTW9kZShmYWxzZSlcbiAgICAgICAgICBzZXRTZWxlY3RlZEluZGV4KDApXG4gICAgICAgICAgc2V0U2Nyb2xsT2Zmc2V0KDApXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICAvLyBMaXN0IG1vZGU6IGxlZnQvcmlnaHQvdGFiIGN5Y2xlIHRoZSBzZWxlY3RlZCBvcHRpb24ncyB2YWx1ZS4gVGhlc2VcbiAgICAgIC8vIGtleXMgdXNlZCB0byBzd2l0Y2ggdGFiczsgbm93IHRoZXkgb25seSBkbyBzbyB3aGVuIHRoZSB0YWIgcm93IGlzXG4gICAgICAvLyBleHBsaWNpdGx5IGZvY3VzZWQgKHNlZSBoZWFkZXJGb2N1c2VkIGluIFNldHRpbmdzLnRzeCkuXG4gICAgICBpZiAoZS5rZXkgPT09ICdsZWZ0JyB8fCBlLmtleSA9PT0gJ3JpZ2h0JyB8fCBlLmtleSA9PT0gJ3RhYicpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIHRvZ2dsZVNldHRpbmcoKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIC8vIEZhbGxiYWNrOiBwcmludGFibGUgY2hhcmFjdGVycyAob3RoZXIgdGhhbiB0aG9zZSBib3VuZCB0byBhY3Rpb25zKVxuICAgICAgLy8gZW50ZXIgc2VhcmNoIG1vZGUuIENhcnZlIG91dCBqL2svLyDigJQgdXNlS2V5YmluZGluZ3MgKHN0aWxsIG9uIHRoZVxuICAgICAgLy8gdXNlSW5wdXQgcGF0aCkgY29uc3VtZXMgdGhlc2UgdmlhIHN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiwgYnV0XG4gICAgICAvLyBvbktleURvd24gZGlzcGF0Y2hlcyBpbmRlcGVuZGVudGx5IHNvIHdlIG11c3Qgc2tpcCB0aGVtIGV4cGxpY2l0bHkuXG4gICAgICBpZiAoZS5jdHJsIHx8IGUubWV0YSkgcmV0dXJuXG4gICAgICBpZiAoZS5rZXkgPT09ICdqJyB8fCBlLmtleSA9PT0gJ2snIHx8IGUua2V5ID09PSAnLycpIHJldHVyblxuICAgICAgaWYgKGUua2V5Lmxlbmd0aCA9PT0gMSAmJiBlLmtleSAhPT0gJyAnKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICBzZXRJc1NlYXJjaE1vZGUodHJ1ZSlcbiAgICAgICAgc2V0U2VhcmNoUXVlcnkoZS5rZXkpXG4gICAgICB9XG4gICAgfSxcbiAgICBbXG4gICAgICBzaG93U3VibWVudSxcbiAgICAgIGhlYWRlckZvY3VzZWQsXG4gICAgICBpc1NlYXJjaE1vZGUsXG4gICAgICBzZWFyY2hRdWVyeSxcbiAgICAgIHNldFNlYXJjaFF1ZXJ5LFxuICAgICAgdG9nZ2xlU2V0dGluZyxcbiAgICBdLFxuICApXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgIHdpZHRoPVwiMTAwJVwiXG4gICAgICB0YWJJbmRleD17MH1cbiAgICAgIGF1dG9Gb2N1c1xuICAgICAgb25LZXlEb3duPXtoYW5kbGVLZXlEb3dufVxuICAgID5cbiAgICAgIHtzaG93U3VibWVudSA9PT0gJ1RoZW1lJyA/IChcbiAgICAgICAgPD5cbiAgICAgICAgICA8VGhlbWVQaWNrZXJcbiAgICAgICAgICAgIG9uVGhlbWVTZWxlY3Q9e3NldHRpbmcgPT4ge1xuICAgICAgICAgICAgICBpc0RpcnR5LmN1cnJlbnQgPSB0cnVlXG4gICAgICAgICAgICAgIHNldFRoZW1lKHNldHRpbmcpXG4gICAgICAgICAgICAgIHNldFNob3dTdWJtZW51KG51bGwpXG4gICAgICAgICAgICAgIHNldFRhYnNIaWRkZW4oZmFsc2UpXG4gICAgICAgICAgICB9fVxuICAgICAgICAgICAgb25DYW5jZWw9eygpID0+IHtcbiAgICAgICAgICAgICAgc2V0U2hvd1N1Ym1lbnUobnVsbClcbiAgICAgICAgICAgICAgc2V0VGFic0hpZGRlbihmYWxzZSlcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgICBoaWRlRXNjVG9DYW5jZWxcbiAgICAgICAgICAgIHNraXBFeGl0SGFuZGxpbmc9e3RydWV9IC8vIFNraXAgZXhpdCBoYW5kbGluZyBhcyBDb25maWcgYWxyZWFkeSBoYW5kbGVzIGl0XG4gICAgICAgICAgLz5cbiAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3IgaXRhbGljPlxuICAgICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVudGVyXCIgYWN0aW9uPVwic2VsZWN0XCIgLz5cbiAgICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJjYW5jZWxcIlxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8Lz5cbiAgICAgICkgOiBzaG93U3VibWVudSA9PT0gJ01vZGVsJyA/IChcbiAgICAgICAgPD5cbiAgICAgICAgICA8TW9kZWxQaWNrZXJcbiAgICAgICAgICAgIGluaXRpYWw9e21haW5Mb29wTW9kZWx9XG4gICAgICAgICAgICBvblNlbGVjdD17KG1vZGVsLCBfZWZmb3J0KSA9PiB7XG4gICAgICAgICAgICAgIGlzRGlydHkuY3VycmVudCA9IHRydWVcbiAgICAgICAgICAgICAgb25DaGFuZ2VNYWluTW9kZWxDb25maWcobW9kZWwpXG4gICAgICAgICAgICAgIHNldFNob3dTdWJtZW51KG51bGwpXG4gICAgICAgICAgICAgIHNldFRhYnNIaWRkZW4oZmFsc2UpXG4gICAgICAgICAgICB9fVxuICAgICAgICAgICAgb25DYW5jZWw9eygpID0+IHtcbiAgICAgICAgICAgICAgc2V0U2hvd1N1Ym1lbnUobnVsbClcbiAgICAgICAgICAgICAgc2V0VGFic0hpZGRlbihmYWxzZSlcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgICBzaG93RmFzdE1vZGVOb3RpY2U9e1xuICAgICAgICAgICAgICBpc0Zhc3RNb2RlRW5hYmxlZCgpXG4gICAgICAgICAgICAgICAgPyBpc0Zhc3RNb2RlICYmXG4gICAgICAgICAgICAgICAgICBpc0Zhc3RNb2RlU3VwcG9ydGVkQnlNb2RlbChtYWluTG9vcE1vZGVsKSAmJlxuICAgICAgICAgICAgICAgICAgaXNGYXN0TW9kZUF2YWlsYWJsZSgpXG4gICAgICAgICAgICAgICAgOiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cImNvbmZpcm1cIiAvPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2FuY2VsXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApIDogc2hvd1N1Ym1lbnUgPT09ICdUZWFtbWF0ZU1vZGVsJyA/IChcbiAgICAgICAgPD5cbiAgICAgICAgICA8TW9kZWxQaWNrZXJcbiAgICAgICAgICAgIGluaXRpYWw9e2dsb2JhbENvbmZpZy50ZWFtbWF0ZURlZmF1bHRNb2RlbCA/PyBudWxsfVxuICAgICAgICAgICAgc2tpcFNldHRpbmdzV3JpdGVcbiAgICAgICAgICAgIGhlYWRlclRleHQ9XCJEZWZhdWx0IG1vZGVsIGZvciBuZXdseSBzcGF3bmVkIHRlYW1tYXRlcy4gVGhlIGxlYWRlciBjYW4gb3ZlcnJpZGUgdmlhIHRoZSB0b29sIGNhbGwncyBtb2RlbCBwYXJhbWV0ZXIuXCJcbiAgICAgICAgICAgIG9uU2VsZWN0PXsobW9kZWwsIF9lZmZvcnQpID0+IHtcbiAgICAgICAgICAgICAgc2V0U2hvd1N1Ym1lbnUobnVsbClcbiAgICAgICAgICAgICAgc2V0VGFic0hpZGRlbihmYWxzZSlcbiAgICAgICAgICAgICAgLy8gRmlyc3Qtb3Blbi10aGVuLUVudGVyIGZyb20gdW5zZXQ6IHBpY2tlciBoaWdobGlnaHRzIFwiRGVmYXVsdFwiXG4gICAgICAgICAgICAgIC8vIChpbml0aWFsPW51bGwpIGFuZCBjb25maXJtaW5nIHdvdWxkIHdyaXRlIG51bGwsIHNpbGVudGx5XG4gICAgICAgICAgICAgIC8vIHN3aXRjaGluZyBPcHVzLWZhbGxiYWNrIOKGkiBmb2xsb3ctbGVhZGVyLiBUcmVhdCBhcyBuby1vcC5cbiAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIGdsb2JhbENvbmZpZy50ZWFtbWF0ZURlZmF1bHRNb2RlbCA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICAgICAgbW9kZWwgPT09IG51bGxcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaXNEaXJ0eS5jdXJyZW50ID0gdHJ1ZVxuICAgICAgICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT5cbiAgICAgICAgICAgICAgICBjdXJyZW50LnRlYW1tYXRlRGVmYXVsdE1vZGVsID09PSBtb2RlbFxuICAgICAgICAgICAgICAgICAgPyBjdXJyZW50XG4gICAgICAgICAgICAgICAgICA6IHsgLi4uY3VycmVudCwgdGVhbW1hdGVEZWZhdWx0TW9kZWw6IG1vZGVsIH0sXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgc2V0R2xvYmFsQ29uZmlnKHtcbiAgICAgICAgICAgICAgICAuLi5nZXRHbG9iYWxDb25maWcoKSxcbiAgICAgICAgICAgICAgICB0ZWFtbWF0ZURlZmF1bHRNb2RlbDogbW9kZWwsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIHNldENoYW5nZXMocHJldiA9PiAoe1xuICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgdGVhbW1hdGVEZWZhdWx0TW9kZWw6IHRlYW1tYXRlTW9kZWxEaXNwbGF5U3RyaW5nKG1vZGVsKSxcbiAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV90ZWFtbWF0ZV9kZWZhdWx0X21vZGVsX2NoYW5nZWQnLCB7XG4gICAgICAgICAgICAgICAgbW9kZWw6XG4gICAgICAgICAgICAgICAgICBtb2RlbCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIG9uQ2FuY2VsPXsoKSA9PiB7XG4gICAgICAgICAgICAgIHNldFNob3dTdWJtZW51KG51bGwpXG4gICAgICAgICAgICAgIHNldFRhYnNIaWRkZW4oZmFsc2UpXG4gICAgICAgICAgICB9fVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cImNvbmZpcm1cIiAvPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2FuY2VsXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApIDogc2hvd1N1Ym1lbnUgPT09ICdFeHRlcm5hbEluY2x1ZGVzJyA/IChcbiAgICAgICAgPD5cbiAgICAgICAgICA8Q2xhdWRlTWRFeHRlcm5hbEluY2x1ZGVzRGlhbG9nXG4gICAgICAgICAgICBvbkRvbmU9eygpID0+IHtcbiAgICAgICAgICAgICAgc2V0U2hvd1N1Ym1lbnUobnVsbClcbiAgICAgICAgICAgICAgc2V0VGFic0hpZGRlbihmYWxzZSlcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgICBleHRlcm5hbEluY2x1ZGVzPXtnZXRFeHRlcm5hbENsYXVkZU1kSW5jbHVkZXMobWVtb3J5RmlsZXMpfVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cImNvbmZpcm1cIiAvPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiZGlzYWJsZSBleHRlcm5hbCBpbmNsdWRlc1wiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvPlxuICAgICAgKSA6IHNob3dTdWJtZW51ID09PSAnT3V0cHV0U3R5bGUnID8gKFxuICAgICAgICA8PlxuICAgICAgICAgIDxPdXRwdXRTdHlsZVBpY2tlclxuICAgICAgICAgICAgaW5pdGlhbFN0eWxlPXtjdXJyZW50T3V0cHV0U3R5bGV9XG4gICAgICAgICAgICBvbkNvbXBsZXRlPXtzdHlsZSA9PiB7XG4gICAgICAgICAgICAgIGlzRGlydHkuY3VycmVudCA9IHRydWVcbiAgICAgICAgICAgICAgc2V0Q3VycmVudE91dHB1dFN0eWxlKHN0eWxlID8/IERFRkFVTFRfT1VUUFVUX1NUWUxFX05BTUUpXG4gICAgICAgICAgICAgIHNldFNob3dTdWJtZW51KG51bGwpXG4gICAgICAgICAgICAgIHNldFRhYnNIaWRkZW4oZmFsc2UpXG5cbiAgICAgICAgICAgICAgLy8gU2F2ZSB0byBsb2NhbCBzZXR0aW5nc1xuICAgICAgICAgICAgICB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSgnbG9jYWxTZXR0aW5ncycsIHtcbiAgICAgICAgICAgICAgICBvdXRwdXRTdHlsZTogc3R5bGUsXG4gICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgdm9pZCBsb2dFdmVudCgndGVuZ3Vfb3V0cHV0X3N0eWxlX2NoYW5nZWQnLCB7XG4gICAgICAgICAgICAgICAgc3R5bGU6IChzdHlsZSA/P1xuICAgICAgICAgICAgICAgICAgREVGQVVMVF9PVVRQVVRfU1RZTEVfTkFNRSkgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgICBzb3VyY2U6XG4gICAgICAgICAgICAgICAgICAnY29uZmlnX3BhbmVsJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICAgIHNldHRpbmdzX3NvdXJjZTpcbiAgICAgICAgICAgICAgICAgICdsb2NhbFNldHRpbmdzJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIG9uQ2FuY2VsPXsoKSA9PiB7XG4gICAgICAgICAgICAgIHNldFNob3dTdWJtZW51KG51bGwpXG4gICAgICAgICAgICAgIHNldFRhYnNIaWRkZW4oZmFsc2UpXG4gICAgICAgICAgICB9fVxuICAgICAgICAgIC8+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cImNvbmZpcm1cIiAvPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2FuY2VsXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApIDogc2hvd1N1Ym1lbnUgPT09ICdMYW5ndWFnZScgPyAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPExhbmd1YWdlUGlja2VyXG4gICAgICAgICAgICBpbml0aWFsTGFuZ3VhZ2U9e2N1cnJlbnRMYW5ndWFnZX1cbiAgICAgICAgICAgIG9uQ29tcGxldGU9e2xhbmd1YWdlID0+IHtcbiAgICAgICAgICAgICAgaXNEaXJ0eS5jdXJyZW50ID0gdHJ1ZVxuICAgICAgICAgICAgICBzZXRDdXJyZW50TGFuZ3VhZ2UobGFuZ3VhZ2UpXG4gICAgICAgICAgICAgIHNldFNob3dTdWJtZW51KG51bGwpXG4gICAgICAgICAgICAgIHNldFRhYnNIaWRkZW4oZmFsc2UpXG5cbiAgICAgICAgICAgICAgLy8gU2F2ZSB0byB1c2VyIHNldHRpbmdzXG4gICAgICAgICAgICAgIHVwZGF0ZVNldHRpbmdzRm9yU291cmNlKCd1c2VyU2V0dGluZ3MnLCB7XG4gICAgICAgICAgICAgICAgbGFuZ3VhZ2UsXG4gICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgdm9pZCBsb2dFdmVudCgndGVuZ3VfbGFuZ3VhZ2VfY2hhbmdlZCcsIHtcbiAgICAgICAgICAgICAgICBsYW5ndWFnZTogKGxhbmd1YWdlID8/XG4gICAgICAgICAgICAgICAgICAnZGVmYXVsdCcpIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgICAgc291cmNlOlxuICAgICAgICAgICAgICAgICAgJ2NvbmZpZ19wYW5lbCcgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgICBvbkNhbmNlbD17KCkgPT4ge1xuICAgICAgICAgICAgICBzZXRTaG93U3VibWVudShudWxsKVxuICAgICAgICAgICAgICBzZXRUYWJzSGlkZGVuKGZhbHNlKVxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAvPlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiRW50ZXJcIiBhY3Rpb249XCJjb25maXJtXCIgLz5cbiAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJTZXR0aW5nc1wiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2FuY2VsXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApIDogc2hvd1N1Ym1lbnUgPT09ICdFbmFibGVBdXRvVXBkYXRlcycgPyAoXG4gICAgICAgIDxEaWFsb2dcbiAgICAgICAgICB0aXRsZT1cIkVuYWJsZSBBdXRvLVVwZGF0ZXNcIlxuICAgICAgICAgIG9uQ2FuY2VsPXsoKSA9PiB7XG4gICAgICAgICAgICBzZXRTaG93U3VibWVudShudWxsKVxuICAgICAgICAgICAgc2V0VGFic0hpZGRlbihmYWxzZSlcbiAgICAgICAgICB9fVxuICAgICAgICAgIGhpZGVCb3JkZXJcbiAgICAgICAgICBoaWRlSW5wdXRHdWlkZVxuICAgICAgICA+XG4gICAgICAgICAge2F1dG9VcGRhdGVyRGlzYWJsZWRSZWFzb24/LnR5cGUgIT09ICdjb25maWcnID8gKFxuICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgICAge2F1dG9VcGRhdGVyRGlzYWJsZWRSZWFzb24/LnR5cGUgPT09ICdlbnYnXG4gICAgICAgICAgICAgICAgICA/ICdBdXRvLXVwZGF0ZXMgYXJlIGNvbnRyb2xsZWQgYnkgYW4gZW52aXJvbm1lbnQgdmFyaWFibGUgYW5kIGNhbm5vdCBiZSBjaGFuZ2VkIGhlcmUuJ1xuICAgICAgICAgICAgICAgICAgOiAnQXV0by11cGRhdGVzIGFyZSBkaXNhYmxlZCBpbiBkZXZlbG9wbWVudCBidWlsZHMuJ31cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICB7YXV0b1VwZGF0ZXJEaXNhYmxlZFJlYXNvbj8udHlwZSA9PT0gJ2VudicgJiYgKFxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAgVW5zZXQge2F1dG9VcGRhdGVyRGlzYWJsZWRSZWFzb24uZW52VmFyfSB0byByZS1lbmFibGVcbiAgICAgICAgICAgICAgICAgIGF1dG8tdXBkYXRlcy5cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8Lz5cbiAgICAgICAgICApIDogKFxuICAgICAgICAgICAgPFNlbGVjdFxuICAgICAgICAgICAgICBvcHRpb25zPXtbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgbGFiZWw6ICdFbmFibGUgd2l0aCBsYXRlc3QgY2hhbm5lbCcsXG4gICAgICAgICAgICAgICAgICB2YWx1ZTogJ2xhdGVzdCcsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBsYWJlbDogJ0VuYWJsZSB3aXRoIHN0YWJsZSBjaGFubmVsJyxcbiAgICAgICAgICAgICAgICAgIHZhbHVlOiAnc3RhYmxlJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdfVxuICAgICAgICAgICAgICBvbkNoYW5nZT17KGNoYW5uZWw6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIGlzRGlydHkuY3VycmVudCA9IHRydWVcbiAgICAgICAgICAgICAgICBzZXRTaG93U3VibWVudShudWxsKVxuICAgICAgICAgICAgICAgIHNldFRhYnNIaWRkZW4oZmFsc2UpXG5cbiAgICAgICAgICAgICAgICBzYXZlR2xvYmFsQ29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAgICAgICAgICAgICAgIC4uLmN1cnJlbnQsXG4gICAgICAgICAgICAgICAgICBhdXRvVXBkYXRlczogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICBzZXRHbG9iYWxDb25maWcoeyAuLi5nZXRHbG9iYWxDb25maWcoKSwgYXV0b1VwZGF0ZXM6IHRydWUgfSlcblxuICAgICAgICAgICAgICAgIHVwZGF0ZVNldHRpbmdzRm9yU291cmNlKCd1c2VyU2V0dGluZ3MnLCB7XG4gICAgICAgICAgICAgICAgICBhdXRvVXBkYXRlc0NoYW5uZWw6IGNoYW5uZWwgYXMgJ2xhdGVzdCcgfCAnc3RhYmxlJyxcbiAgICAgICAgICAgICAgICAgIG1pbmltdW1WZXJzaW9uOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICBzZXRTZXR0aW5nc0RhdGEocHJldiA9PiAoe1xuICAgICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICAgIGF1dG9VcGRhdGVzQ2hhbm5lbDogY2hhbm5lbCBhcyAnbGF0ZXN0JyB8ICdzdGFibGUnLFxuICAgICAgICAgICAgICAgICAgbWluaW11bVZlcnNpb246IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfYXV0b3VwZGF0ZV9lbmFibGVkJywge1xuICAgICAgICAgICAgICAgICAgY2hhbm5lbDpcbiAgICAgICAgICAgICAgICAgICAgY2hhbm5lbCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvRGlhbG9nPlxuICAgICAgKSA6IHNob3dTdWJtZW51ID09PSAnQ2hhbm5lbERvd25ncmFkZScgPyAoXG4gICAgICAgIDxDaGFubmVsRG93bmdyYWRlRGlhbG9nXG4gICAgICAgICAgY3VycmVudFZlcnNpb249e01BQ1JPLlZFUlNJT059XG4gICAgICAgICAgb25DaG9pY2U9eyhjaG9pY2U6IENoYW5uZWxEb3duZ3JhZGVDaG9pY2UpID0+IHtcbiAgICAgICAgICAgIHNldFNob3dTdWJtZW51KG51bGwpXG4gICAgICAgICAgICBzZXRUYWJzSGlkZGVuKGZhbHNlKVxuXG4gICAgICAgICAgICBpZiAoY2hvaWNlID09PSAnY2FuY2VsJykge1xuICAgICAgICAgICAgICAvLyBVc2VyIGNhbmNlbGxlZCAtIGRvbid0IGNoYW5nZSBhbnl0aGluZ1xuICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaXNEaXJ0eS5jdXJyZW50ID0gdHJ1ZVxuICAgICAgICAgICAgLy8gU3dpdGNoIHRvIHN0YWJsZSBjaGFubmVsXG4gICAgICAgICAgICBjb25zdCBuZXdTZXR0aW5nczoge1xuICAgICAgICAgICAgICBhdXRvVXBkYXRlc0NoYW5uZWw6ICdzdGFibGUnXG4gICAgICAgICAgICAgIG1pbmltdW1WZXJzaW9uPzogc3RyaW5nXG4gICAgICAgICAgICB9ID0ge1xuICAgICAgICAgICAgICBhdXRvVXBkYXRlc0NoYW5uZWw6ICdzdGFibGUnLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY2hvaWNlID09PSAnc3RheScpIHtcbiAgICAgICAgICAgICAgLy8gVXNlciB3YW50cyB0byBzdGF5IG9uIGN1cnJlbnQgdmVyc2lvbiB1bnRpbCBzdGFibGUgY2F0Y2hlcyB1cFxuICAgICAgICAgICAgICBuZXdTZXR0aW5ncy5taW5pbXVtVmVyc2lvbiA9IE1BQ1JPLlZFUlNJT05cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2UoJ3VzZXJTZXR0aW5ncycsIG5ld1NldHRpbmdzKVxuICAgICAgICAgICAgc2V0U2V0dGluZ3NEYXRhKHByZXYgPT4gKHtcbiAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgLi4ubmV3U2V0dGluZ3MsXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9hdXRvdXBkYXRlX2NoYW5uZWxfY2hhbmdlZCcsIHtcbiAgICAgICAgICAgICAgY2hhbm5lbDpcbiAgICAgICAgICAgICAgICAnc3RhYmxlJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICBtaW5pbXVtX3ZlcnNpb25fc2V0OiBjaG9pY2UgPT09ICdzdGF5JyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfX1cbiAgICAgICAgLz5cbiAgICAgICkgOiAoXG4gICAgICAgIDxCb3hcbiAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICBnYXA9ezF9XG4gICAgICAgICAgbWFyZ2luWT17aW5zaWRlTW9kYWwgPyB1bmRlZmluZWQgOiAxfVxuICAgICAgICA+XG4gICAgICAgICAgPFNlYXJjaEJveFxuICAgICAgICAgICAgcXVlcnk9e3NlYXJjaFF1ZXJ5fVxuICAgICAgICAgICAgaXNGb2N1c2VkPXtpc1NlYXJjaE1vZGUgJiYgIWhlYWRlckZvY3VzZWR9XG4gICAgICAgICAgICBpc1Rlcm1pbmFsRm9jdXNlZD17aXNUZXJtaW5hbEZvY3VzZWR9XG4gICAgICAgICAgICBjdXJzb3JPZmZzZXQ9e3NlYXJjaEN1cnNvck9mZnNldH1cbiAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VhcmNoIHNldHRpbmdz4oCmXCJcbiAgICAgICAgICAvPlxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAge2ZpbHRlcmVkU2V0dGluZ3NJdGVtcy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgICAgICBObyBzZXR0aW5ncyBtYXRjaCAmcXVvdDt7c2VhcmNoUXVlcnl9JnF1b3Q7XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAge3Njcm9sbE9mZnNldCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgIHtmaWd1cmVzLmFycm93VXB9IHtzY3JvbGxPZmZzZXR9IG1vcmUgYWJvdmVcbiAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHtmaWx0ZXJlZFNldHRpbmdzSXRlbXNcbiAgICAgICAgICAgICAgICAgIC5zbGljZShzY3JvbGxPZmZzZXQsIHNjcm9sbE9mZnNldCArIG1heFZpc2libGUpXG4gICAgICAgICAgICAgICAgICAubWFwKChzZXR0aW5nLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbEluZGV4ID0gc2Nyb2xsT2Zmc2V0ICsgaVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1NlbGVjdGVkID1cbiAgICAgICAgICAgICAgICAgICAgICBhY3R1YWxJbmRleCA9PT0gc2VsZWN0ZWRJbmRleCAmJlxuICAgICAgICAgICAgICAgICAgICAgICFoZWFkZXJGb2N1c2VkICYmXG4gICAgICAgICAgICAgICAgICAgICAgIWlzU2VhcmNoTW9kZVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgPFJlYWN0LkZyYWdtZW50IGtleT17c2V0dGluZy5pZH0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8Qm94IHdpZHRoPXs0NH0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPFRleHQgY29sb3I9e2lzU2VsZWN0ZWQgPyAnc3VnZ2VzdGlvbicgOiB1bmRlZmluZWR9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2lzU2VsZWN0ZWQgPyBmaWd1cmVzLnBvaW50ZXIgOiAnICd9eycgJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzZXR0aW5nLmxhYmVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxCb3gga2V5PXtpc1NlbGVjdGVkID8gJ3NlbGVjdGVkJyA6ICd1bnNlbGVjdGVkJ30+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3NldHRpbmcudHlwZSA9PT0gJ2Jvb2xlYW4nID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcj17aXNTZWxlY3RlZCA/ICdzdWdnZXN0aW9uJyA6IHVuZGVmaW5lZH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzZXR0aW5nLnZhbHVlLnRvU3RyaW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3Nob3dUaGlua2luZ1dhcm5pbmcgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXR0aW5nLmlkID09PSAndGhpbmtpbmdFbmFibGVkJyAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeycgJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2hhbmdpbmcgdGhpbmtpbmcgbW9kZSBtaWQtY29udmVyc2F0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbGwgaW5jcmVhc2UgbGF0ZW5jeSBhbmQgbWF5IHJlZHVjZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBxdWFsaXR5LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDogc2V0dGluZy5pZCA9PT0gJ3RoZW1lJyA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxUZXh0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yPXtpc1NlbGVjdGVkID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7VEhFTUVfTEFCRUxTW3NldHRpbmcudmFsdWUudG9TdHJpbmcoKV0gPz9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXR0aW5nLnZhbHVlLnRvU3RyaW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IHNldHRpbmcuaWQgPT09ICdub3RpZkNoYW5uZWwnID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I9e2lzU2VsZWN0ZWQgPyAnc3VnZ2VzdGlvbicgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxOb3RpZkNoYW5uZWxMYWJlbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtzZXR0aW5nLnZhbHVlLnRvU3RyaW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IHNldHRpbmcuaWQgPT09ICdkZWZhdWx0UGVybWlzc2lvbk1vZGUnID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I9e2lzU2VsZWN0ZWQgPyAnc3VnZ2VzdGlvbicgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtwZXJtaXNzaW9uTW9kZVRpdGxlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldHRpbmcudmFsdWUgYXMgUGVybWlzc2lvbk1vZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IHNldHRpbmcuaWQgPT09ICdhdXRvVXBkYXRlc0NoYW5uZWwnICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdXRvVXBkYXRlckRpc2FibGVkUmVhc29uID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxUZXh0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I9e2lzU2VsZWN0ZWQgPyAnc3VnZ2VzdGlvbicgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0QXV0b1VwZGF0ZXJEaXNhYmxlZFJlYXNvbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF1dG9VcGRhdGVyRGlzYWJsZWRSZWFzb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcj17aXNTZWxlY3RlZCA/ICdzdWdnZXN0aW9uJyA6IHVuZGVmaW5lZH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3NldHRpbmcudmFsdWUudG9TdHJpbmcoKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgICAgIDwvUmVhY3QuRnJhZ21lbnQ+XG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgICAgIHtzY3JvbGxPZmZzZXQgKyBtYXhWaXNpYmxlIDwgZmlsdGVyZWRTZXR0aW5nc0l0ZW1zLmxlbmd0aCAmJiAoXG4gICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAge2ZpZ3VyZXMuYXJyb3dEb3dufXsnICd9XG4gICAgICAgICAgICAgICAgICAgIHtmaWx0ZXJlZFNldHRpbmdzSXRlbXMubGVuZ3RoIC0gc2Nyb2xsT2Zmc2V0IC0gbWF4VmlzaWJsZX17JyAnfVxuICAgICAgICAgICAgICAgICAgICBtb3JlIGJlbG93XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIHtoZWFkZXJGb2N1c2VkID8gKFxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwi4oaQL+KGkiB0YWJcIiBhY3Rpb249XCJzd2l0Y2hcIiAvPlxuICAgICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIuKGk1wiIGFjdGlvbj1cInJldHVyblwiIC8+XG4gICAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgICBjb250ZXh0PVwiU2V0dGluZ3NcIlxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJjbG9zZVwiXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgKSA6IGlzU2VhcmNoTW9kZSA/IChcbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICAgIDxUZXh0PlR5cGUgdG8gZmlsdGVyPC9UZXh0PlxuICAgICAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVudGVyL+KGk1wiIGFjdGlvbj1cInNlbGVjdFwiIC8+XG4gICAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwi4oaRXCIgYWN0aW9uPVwidGFic1wiIC8+XG4gICAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgICBjb250ZXh0PVwiU2V0dGluZ3NcIlxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJjbGVhclwiXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgKSA6IChcbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICAgIGFjdGlvbj1cInNlbGVjdDphY2NlcHRcIlxuICAgICAgICAgICAgICAgICAgY29udGV4dD1cIlNldHRpbmdzXCJcbiAgICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiU3BhY2VcIlxuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJjaGFuZ2VcIlxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgICAgYWN0aW9uPVwic2V0dGluZ3M6Y2xvc2VcIlxuICAgICAgICAgICAgICAgICAgY29udGV4dD1cIlNldHRpbmdzXCJcbiAgICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRW50ZXJcIlxuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJzYXZlXCJcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICAgIGFjdGlvbj1cInNldHRpbmdzOnNlYXJjaFwiXG4gICAgICAgICAgICAgICAgICBjb250ZXh0PVwiU2V0dGluZ3NcIlxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9XCIvXCJcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwic2VhcmNoXCJcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICAgICAgY29udGV4dD1cIlNldHRpbmdzXCJcbiAgICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiY2FuY2VsXCJcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZnVuY3Rpb24gdGVhbW1hdGVNb2RlbERpc3BsYXlTdHJpbmcodmFsdWU6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBtb2RlbERpc3BsYXlTdHJpbmcoZ2V0SGFyZGNvZGVkVGVhbW1hdGVNb2RlbEZhbGxiYWNrKCkpXG4gIH1cbiAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gXCJEZWZhdWx0IChsZWFkZXIncyBtb2RlbClcIlxuICByZXR1cm4gbW9kZWxEaXNwbGF5U3RyaW5nKHZhbHVlKVxufVxuXG5jb25zdCBUSEVNRV9MQUJFTFM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIGF1dG86ICdBdXRvIChtYXRjaCB0ZXJtaW5hbCknLFxuICBkYXJrOiAnRGFyayBtb2RlJyxcbiAgbGlnaHQ6ICdMaWdodCBtb2RlJyxcbiAgJ2RhcmstZGFsdG9uaXplZCc6ICdEYXJrIG1vZGUgKGNvbG9yYmxpbmQtZnJpZW5kbHkpJyxcbiAgJ2xpZ2h0LWRhbHRvbml6ZWQnOiAnTGlnaHQgbW9kZSAoY29sb3JibGluZC1mcmllbmRseSknLFxuICAnZGFyay1hbnNpJzogJ0RhcmsgbW9kZSAoQU5TSSBjb2xvcnMgb25seSknLFxuICAnbGlnaHQtYW5zaSc6ICdMaWdodCBtb2RlIChBTlNJIGNvbG9ycyBvbmx5KScsXG59XG5cbmZ1bmN0aW9uIE5vdGlmQ2hhbm5lbExhYmVsKHsgdmFsdWUgfTogeyB2YWx1ZTogc3RyaW5nIH0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBzd2l0Y2ggKHZhbHVlKSB7XG4gICAgY2FzZSAnYXV0byc6XG4gICAgICByZXR1cm4gJ0F1dG8nXG4gICAgY2FzZSAnaXRlcm0yJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxUZXh0PlxuICAgICAgICAgIGlUZXJtMiA8VGV4dCBkaW1Db2xvcj4oT1NDIDkpPC9UZXh0PlxuICAgICAgICA8L1RleHQ+XG4gICAgICApXG4gICAgY2FzZSAndGVybWluYWxfYmVsbCc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICBUZXJtaW5hbCBCZWxsIDxUZXh0IGRpbUNvbG9yPihcXGEpPC9UZXh0PlxuICAgICAgICA8L1RleHQ+XG4gICAgICApXG4gICAgY2FzZSAna2l0dHknOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPFRleHQ+XG4gICAgICAgICAgS2l0dHkgPFRleHQgZGltQ29sb3I+KE9TQyA5OSk8L1RleHQ+XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIClcbiAgICBjYXNlICdnaG9zdHR5JzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxUZXh0PlxuICAgICAgICAgIEdob3N0dHkgPFRleHQgZGltQ29sb3I+KE9TQyA3NzcpPC9UZXh0PlxuICAgICAgICA8L1RleHQ+XG4gICAgICApXG4gICAgY2FzZSAnaXRlcm0yX3dpdGhfYmVsbCc6XG4gICAgICByZXR1cm4gJ2lUZXJtMiB3LyBCZWxsJ1xuICAgIGNhc2UgJ25vdGlmaWNhdGlvbnNfZGlzYWJsZWQnOlxuICAgICAgcmV0dXJuICdEaXNhYmxlZCdcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHZhbHVlXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0EsU0FBU0EsT0FBTyxRQUFRLFlBQVk7QUFDcEMsU0FDRUMsR0FBRyxFQUNIQyxJQUFJLEVBQ0pDLFFBQVEsRUFDUkMsZUFBZSxFQUNmQyxnQkFBZ0IsUUFDWCxjQUFjO0FBQ3JCLGNBQWNDLGFBQWEsUUFBUSxvQ0FBb0M7QUFDdkUsT0FBTyxLQUFLQyxLQUFLLE1BQU0sT0FBTztBQUM5QixTQUFTQyxRQUFRLEVBQUVDLFdBQVcsUUFBUSxPQUFPO0FBQzdDLFNBQ0VDLGFBQWEsRUFDYkMsY0FBYyxRQUNULG9DQUFvQztBQUMzQyxPQUFPQyxPQUFPLE1BQU0sU0FBUztBQUM3QixTQUNFLEtBQUtDLFlBQVksRUFDakJDLGdCQUFnQixFQUNoQkMsdUJBQXVCLEVBQ3ZCLEtBQUtDLFdBQVcsUUFDWCx1QkFBdUI7QUFDOUIsU0FBU0Msd0JBQXdCLFFBQVEsNkJBQTZCO0FBQ3RFLFNBQ0VDLGVBQWUsRUFDZkMsNEJBQTRCLEVBQzVCQywrQkFBK0IsRUFDL0JDLHlCQUF5QixRQUNwQix1QkFBdUI7QUFDOUIsT0FBT0MsS0FBSyxNQUFNLE9BQU87QUFDekIsU0FDRUMsbUJBQW1CLEVBQ25CQyx3QkFBd0IsRUFDeEJDLHdCQUF3QixFQUN4QkMsd0JBQXdC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