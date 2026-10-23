import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js';
import { Byline } from '../../components/design-system/Byline.js';
import { Pane } from '../../components/design-system/Pane.js';
import { Tab, Tabs } from '../../components/design-system/Tabs.js';
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings.js';
import { Box, Text } from '../../ink.js';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding.js';
import { useAppState, useSetAppState } from '../../state/AppState.js';
import type { PluginError } from '../../types/plugin.js';
import { errorMessage } from '../../utils/errors.js';
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js';
import { loadMarketplacesWithGracefulDegradation } from '../../utils/plugins/marketplaceHelpers.js';
import { loadKnownMarketplacesConfig, removeMarketplaceSource } from '../../utils/plugins/marketplaceManager.js';
import { getPluginEditableScopes } from '../../utils/plugins/pluginStartupCheck.js';
import type { EditableSettingSource } from '../../utils/settings/constants.js';
import { getSettingsForSource, updateSettingsForSource } from '../../utils/settings/settings.js';
import { AddMarketplace } from './AddMarketplace.js';
import { BrowseMarketplace } from './BrowseMarketplace.js';
import { DiscoverPlugins } from './DiscoverPlugins.js';
import { ManageMarketplaces } from './ManageMarketplaces.js';
import { ManagePlugins } from './ManagePlugins.js';
import { formatErrorMessage, getErrorGuidance } from './PluginErrors.js';
import { type ParsedCommand, parsePluginArgs } from './parseArgs.js';
import type { PluginSettingsProps, ViewState } from './types.js';
import { ValidatePlugin } from './ValidatePlugin.js';
type TabId = 'discover' | 'installed' | 'marketplaces' | 'errors';
function MarketplaceList(t0) {
  const $ = _c(4);
  const {
    onComplete
  } = t0;
  let t1;
  let t2;
  if ($[0] !== onComplete) {
    t1 = () => {
      const loadList = async function loadList() {
        ;
        try {
          const config = await loadKnownMarketplacesConfig();
          const names = Object.keys(config);
          if (names.length === 0) {
            onComplete("No marketplaces configured");
          } else {
            onComplete(`Configured marketplaces:\n${names.map(_temp).join("\n")}`);
          }
        } catch (t3) {
          const err = t3;
          onComplete(`Error loading marketplaces: ${errorMessage(err)}`);
        }
      };
      loadList();
    };
    t2 = [onComplete];
    $[0] = onComplete;
    $[1] = t1;
    $[2] = t2;
  } else {
    t1 = $[1];
    t2 = $[2];
  }
  useEffect(t1, t2);
  let t3;
  if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = <Text>Loading marketplaces...</Text>;
    $[3] = t3;
  } else {
    t3 = $[3];
  }
  return t3;
}
function _temp(n) {
  return `  • ${n}`;
}
function McpRedirectBanner() {
  return null;
}
type ErrorRowAction = {
  kind: 'navigate';
  tab: TabId;
  viewState: ViewState;
} | {
  kind: 'remove-extra-marketplace';
  name: string;
  sources: Array<{
    source: EditableSettingSource;
    scope: string;
  }>;
} | {
  kind: 'remove-installed-marketplace';
  name: string;
} | {
  kind: 'managed-only';
  name: string;
} | {
  kind: 'none';
};
type ErrorRow = {
  label: string;
  message: string;
  guidance?: string | null;
  action: ErrorRowAction;
  scope?: string;
};

/**
 * Determine which settings sources define an extraKnownMarketplace entry.
 * Returns the editable sources (user/project/local) and whether policy also has it.
 */
function getExtraMarketplaceSourceInfo(name: string): {
  editableSources: Array<{
    source: EditableSettingSource;
    scope: string;
  }>;
  isInPolicy: boolean;
} {
  const editableSources: Array<{
    source: EditableSettingSource;
    scope: string;
  }> = [];
  const sourcesToCheck = [{
    source: 'userSettings' as const,
    scope: 'user'
  }, {
    source: 'projectSettings' as const,
    scope: 'project'
  }, {
    source: 'localSettings' as const,
    scope: 'local'
  }];
  for (const {
    source,
    scope
  } of sourcesToCheck) {
    const settings = getSettingsForSource(source);
    if (settings?.extraKnownMarketplaces?.[name]) {
      editableSources.push({
        source,
        scope
      });
    }
  }
  const policySettings = getSettingsForSource('policySettings');
  const isInPolicy = Boolean(policySettings?.extraKnownMarketplaces?.[name]);
  return {
    editableSources,
    isInPolicy
  };
}
function buildMarketplaceAction(name: string): ErrorRowAction {
  const {
    editableSources,
    isInPolicy
  } = getExtraMarketplaceSourceInfo(name);
  if (editableSources.length > 0) {
    return {
      kind: 'remove-extra-marketplace',
      name,
      sources: editableSources
    };
  }
  if (isInPolicy) {
    return {
      kind: 'managed-only',
      name
    };
  }

  // Marketplace is in known_marketplaces.json but not in extraKnownMarketplaces
  // (e.g. previously installed manually) — route to ManageMarketplaces
  return {
    kind: 'navigate',
    tab: 'marketplaces',
    viewState: {
      type: 'manage-marketplaces',
      targetMarketplace: name,
      action: 'remove'
    }
  };
}
function buildPluginAction(pluginName: string): ErrorRowAction {
  return {
    kind: 'navigate',
    tab: 'installed',
    viewState: {
      type: 'manage-plugins',
      targetPlugin: pluginName,
      action: 'uninstall'
    }
  };
}
const TRANSIENT_ERROR_TYPES = new Set(['git-auth-failed', 'git-timeout', 'network-error']);
function isTransientError(error: PluginError): boolean {
  return TRANSIENT_ERROR_TYPES.has(error.type);
}

/**
 * Extract the plugin name from a PluginError, checking explicit fields first,
 * then falling back to the source field (format: "pluginName@marketplace").
 */
function getPluginNameFromError(error: PluginError): string | undefined {
  if ('pluginId' in error && error.pluginId) return error.pluginId;
  if ('plugin' in error && error.plugin) return error.plugin;
  // Fallback: source often contains "pluginName@marketplace"
  if (error.source.includes('@')) return error.source.split('@')[0];
  return undefined;
}
function buildErrorRows(failedMarketplaces: Array<{
  name: string;
  error?: string;
}>, extraMarketplaceErrors: PluginError[], pluginLoadingErrors: PluginError[], otherErrors: PluginError[], brokenInstalledMarketplaces: Array<{
  name: string;
  error: string;
}>, transientErrors: PluginError[], pluginScopes: Map<string, string>): ErrorRow[] {
  const rows: ErrorRow[] = [];

  // --- Transient errors at the top (restart to retry) ---
  for (const error of transientErrors) {
    const pluginName = 'pluginId' in error ? error.pluginId : 'plugin' in error ? error.plugin : undefined;
    rows.push({
      label: pluginName ?? error.source,
      message: formatErrorMessage(error),
      guidance: 'Restart to retry loading plugins',
      action: {
        kind: 'none'
      }
    });
  }

  // --- Marketplace errors ---
  // Track shown marketplace names to avoid duplicates across sources
  const shownMarketplaceNames = new Set<string>();
  for (const m of failedMarketplaces) {
    shownMarketplaceNames.add(m.name);
    const action = buildMarketplaceAction(m.name);
    const sourceInfo = getExtraMarketplaceSourceInfo(m.name);
    const scope = sourceInfo.isInPolicy ? 'managed' : sourceInfo.editableSources[0]?.scope;
    rows.push({
      label: m.name,
      message: m.error ?? 'Installation failed',
      guidance: action.kind === 'managed-only' ? 'Managed by your organization — contact your admin' : undefined,
      action,
      scope
    });
  }
  for (const e of extraMarketplaceErrors) {
    const marketplace = 'marketplace' in e ? e.marketplace : e.source;
    if (shownMarketplaceNames.has(marketplace)) continue;
    shownMarketplaceNames.add(marketplace);
    const action = buildMarketplaceAction(marketplace);
    const sourceInfo = getExtraMarketplaceSourceInfo(marketplace);
    const scope = sourceInfo.isInPolicy ? 'managed' : sourceInfo.editableSources[0]?.scope;
    rows.push({
      label: marketplace,
      message: formatErrorMessage(e),
      guidance: action.kind === 'managed-only' ? 'Managed by your organization — contact your admin' : getErrorGuidance(e),
      action,
      scope
    });
  }

  // Installed marketplaces that fail to load data (from known_marketplaces.json)
  for (const m of brokenInstalledMarketplaces) {
    if (shownMarketplaceNames.has(m.name)) continue;
    shownMarketplaceNames.add(m.name);
    rows.push({
      label: m.name,
      message: m.error,
      action: {
        kind: 'remove-installed-marketplace',
        name: m.name
      }
    });
  }

  // --- Plugin errors ---
  const shownPluginNames = new Set<string>();
  for (const error of pluginLoadingErrors) {
    const pluginName = getPluginNameFromError(error);
    if (pluginName && shownPluginNames.has(pluginName)) continue;
    if (pluginName) shownPluginNames.add(pluginName);
    const marketplace = 'marketplace' in error ? error.marketplace : undefined;
    // Try pluginId@marketplace format first, then just pluginName
    const scope = pluginName ? pluginScopes.get(error.source) ?? pluginScopes.get(pluginName) : undefined;
    rows.push({
      label: pluginName ? marketplace ? `${pluginName} @ ${marketplace}` : pluginName : error.source,
      message: formatErrorMessage(error),
      guidance: getErrorGuidance(error),
      action: pluginName ? buildPluginAction(pluginName) : {
        kind: 'none'
      },
      scope
    });
  }

  // --- Other errors (non-marketplace, non-plugin-specific) ---
  for (const error of otherErrors) {
    rows.push({
      label: error.source,
      message: formatErrorMessage(error),
      guidance: getErrorGuidance(error),
      action: {
        kind: 'none'
      }
    });
  }
  return rows;
}

/**
 * Remove a marketplace from extraKnownMarketplaces in the given settings sources,
 * and also remove any associated enabled plugins.
 */
function removeExtraMarketplace(name: string, sources: Array<{
  source: EditableSettingSource;
}>): void {
  for (const {
    source
  } of sources) {
    const settings = getSettingsForSource(source);
    if (!settings) continue;
    const updates: Record<string, unknown> = {};

    // Remove from extraKnownMarketplaces
    if (settings.extraKnownMarketplaces?.[name]) {
      updates.extraKnownMarketplaces = {
        ...settings.extraKnownMarketplaces,
        [name]: undefined
      };
    }

    // Remove associated enabled plugins (format: "plugin@marketplace")
    if (settings.enabledPlugins) {
      const suffix = `@${name}`;
      let removedPlugins = false;
      const updatedPlugins = {
        ...settings.enabledPlugins
      };
      for (const pluginId in updatedPlugins) {
        if (pluginId.endsWith(suffix)) {
          updatedPlugins[pluginId] = undefined;
          removedPlugins = true;
        }
      }
      if (removedPlugins) {
        updates.enabledPlugins = updatedPlugins;
      }
    }
    if (Object.keys(updates).length > 0) {
      updateSettingsForSource(source, updates);
    }
  }
}
function ErrorsTabContent(t0) {
  const $ = _c(26);
  const {
    setViewState,
    setActiveTab,
    markPluginsChanged
  } = t0;
  const errors = useAppState(_temp2);
  const installationStatus = useAppState(_temp3);
  const setAppState = useSetAppState();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionMessage, setActionMessage] = useState(null);
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = [];
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  const [marketplaceLoadFailures, setMarketplaceLoadFailures] = useState(t1);
  let t2;
  let t3;
  if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = () => {
      (async () => {
        try {
          const config = await loadKnownMarketplacesConfig();
          const {
            failures
          } = await loadMarketplacesWithGracefulDegradation(config);
          setMarketplaceLoadFailures(failures);
        } catch {}
      })();
    };
    t3 = [];
    $[1] = t2;
    $[2] = t3;
  } else {
    t2 = $[1];
    t3 = $[2];
  }
  useEffect(t2, t3);
  const failedMarketplaces = installationStatus.marketplaces.filter(_temp4);
  const failedMarketplaceNames = new Set(failedMarketplaces.map(_temp5));
  const transientErrors = errors.filter(isTransientError);
  const extraMarketplaceErrors = errors.filter(e => (e.type === "marketplace-not-found" || e.type === "marketplace-load-failed" || e.type === "marketplace-blocked-by-policy") && !failedMarketplaceNames.has(e.marketplace));
  const pluginLoadingErrors = errors.filter(_temp6);
  const otherErrors = errors.filter(_temp7);
  const pluginScopes = getPluginEditableScopes();
  const rows = buildErrorRows(failedMarketplaces, extraMarketplaceErrors, pluginLoadingErrors, otherErrors, marketplaceLoadFailures, transientErrors, pluginScopes);
  let t4;
  if ($[3] !== setViewState) {
    t4 = () => {
      setViewState({
        type: "menu"
      });
    };
    $[3] = setViewState;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  let t5;
  if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
    t5 = {
      context: "Confirmation"
    };
    $[5] = t5;
  } else {
    t5 = $[5];
  }
  useKeybinding("confirm:no", t4, t5);
  const handleSelect = () => {
    const row = rows[selectedIndex];
    if (!row) {
      return;
    }
    const {
      action
    } = row;
    bb77: switch (action.kind) {
      case "navigate":
        {
          setActiveTab(action.tab);
          setViewState(action.viewState);
          break bb77;
        }
      case "remove-extra-marketplace":
        {
          const scopes = action.sources.map(_temp8).join(", ");
          removeExtraMarketplace(action.name, action.sources);
          clearAllCaches();
          setAppState(prev_0 => ({
            ...prev_0,
            plugins: {
              ...prev_0.plugins,
              errors: prev_0.plugins.errors.filter(e_2 => !("marketplace" in e_2 && e_2.marketplace === action.name)),
              installationStatus: {
                ...prev_0.plugins.installationStatus,
                marketplaces: prev_0.plugins.installationStatus.marketplaces.filter(m_1 => m_1.name !== action.name)
              }
            }
          }));
          setActionMessage(`${figures.tick} Removed "${action.name}" from ${scopes} settings`);
          markPluginsChanged();
          break bb77;
        }
      case "remove-installed-marketplace":
        {
          (async () => {
            ;
            try {
              await removeMarketplaceSource(action.name);
              clearAllCaches();
              setMarketplaceLoadFailures(prev => prev.filter(f => f.name !== action.name));
              setActionMessage(`${figures.tick} Removed marketplace "${action.name}"`);
              markPluginsChanged();
            } catch (t6) {
              const err = t6;
              setActionMessage(`Failed to remove "${action.name}": ${err instanceof Error ? err.message : String(err)}`);
            }
          })();
          break bb77;
        }
      case "managed-only":
        {
          break bb77;
        }
      case "none":
    }
  };
  let t7;
  if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
    t7 = () => setSelectedIndex(_temp9);
    $[6] = t7;
  } else {
    t7 = $[6];
  }
  const t8 = rows.length > 0;
  let t9;
  if ($[7] !== t8) {
    t9 = {
      context: "Select",
      isActive: t8
    };
    $[7] = t8;
    $[8] = t9;
  } else {
    t9 = $[8];
  }
  useKeybindings({
    "select:previous": t7,
    "select:next": () => setSelectedIndex(prev_2 => Math.min(rows.length - 1, prev_2 + 1)),
    "select:accept": handleSelect
  }, t9);
  const clampedIndex = Math.min(selectedIndex, Math.max(0, rows.length - 1));
  if (clampedIndex !== selectedIndex) {
    setSelectedIndex(clampedIndex);
  }
  const selectedAction = rows[clampedIndex]?.action;
  const hasAction = selectedAction && selectedAction.kind !== "none" && selectedAction.kind !== "managed-only";
  if (rows.length === 0) {
    let t10;
    if ($[9] === Symbol.for("react.memo_cache_sentinel")) {
      t10 = <Box marginLeft={1}><Text dimColor={true}>No plugin errors</Text></Box>;
      $[9] = t10;
    } else {
      t10 = $[9];
    }
    let t11;
    if ($[10] === Symbol.for("react.memo_cache_sentinel")) {
      t11 = <Box flexDirection="column">{t10}<Box marginTop={1}><Text dimColor={true} italic={true}><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" /></Text></Box></Box>;
      $[10] = t11;
    } else {
      t11 = $[10];
    }
    return t11;
  }
  const T0 = Box;
  const t10 = "column";
  let t11;
  if ($[11] !== clampedIndex) {
    t11 = (row_0, idx) => {
      const isSelected = idx === clampedIndex;
      return <Box key={idx} marginLeft={1} flexDirection="column" marginBottom={1}><Text><Text color={isSelected ? "suggestion" : "error"}>{isSelected ? figures.pointer : figures.cross}{" "}</Text><Text bold={isSelected}>{row_0.label}</Text>{row_0.scope && <Text dimColor={true}> ({row_0.scope})</Text>}</Text><Box marginLeft={3}><Text color="error">{row_0.message}</Text></Box>{row_0.guidance && <Box marginLeft={3}><Text dimColor={true} italic={true}>{row_0.guidance}</Text></Box>}</Box>;
    };
    $[11] = clampedIndex;
    $[12] = t11;
  } else {
    t11 = $[12];
  }
  const t12 = rows.map(t11);
  let t13;
  if ($[13] !== actionMessage) {
    t13 = actionMessage && <Box marginTop={1} marginLeft={1}><Text color="claude">{actionMessage}</Text></Box>;
    $[13] = actionMessage;
    $[14] = t13;
  } else {
    t13 = $[14];
  }
  let t14;
  if ($[15] === Symbol.for("react.memo_cache_sentinel")) {
    t14 = <ConfigurableShortcutHint action="select:previous" context="Select" fallback={"\u2191"} description="navigate" />;
    $[15] = t14;
  } else {
    t14 = $[15];
  }
  let t15;
  if ($[16] !== hasAction) {
    t15 = hasAction && <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="resolve" />;
    $[16] = hasAction;
    $[17] = t15;
  } else {
    t15 = $[17];
  }
  let t16;
  if ($[18] === Symbol.for("react.memo_cache_sentinel")) {
    t16 = <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />;
    $[18] = t16;
  } else {
    t16 = $[18];
  }
  let t17;
  if ($[19] !== t15) {
    t17 = <Box marginTop={1}><Text dimColor={true} italic={true}><Byline>{t14}{t15}{t16}</Byline></Text></Box>;
    $[19] = t15;
    $[20] = t17;
  } else {
    t17 = $[20];
  }
  let t18;
  if ($[21] !== T0 || $[22] !== t12 || $[23] !== t13 || $[24] !== t17) {
    t18 = <T0 flexDirection={t10}>{t12}{t13}{t17}</T0>;
    $[21] = T0;
    $[22] = t12;
    $[23] = t13;
    $[24] = t17;
    $[25] = t18;
  } else {
    t18 = $[25];
  }
  return t18;
}
function _temp9(prev_1) {
  return Math.max(0, prev_1 - 1);
}
function _temp8(s_1) {
  return s_1.scope;
}
function _temp7(e_1) {
  if (isTransientError(e_1)) {
    return false;
  }
  if (e_1.type === "marketplace-not-found" || e_1.type === "marketplace-load-failed" || e_1.type === "marketplace-blocked-by-policy") {
    return false;
  }
  return getPluginNameFromError(e_1) === undefined;
}
function _temp6(e_0) {
  if (isTransientError(e_0)) {
    return false;
  }
  if (e_0.type === "marketplace-not-found" || e_0.type === "marketplace-load-failed" || e_0.type === "marketplace-blocked-by-policy") {
    return false;
  }
  return getPluginNameFromError(e_0) !== undefined;
}
function _temp5(m_0) {
  return m_0.name;
}
function _temp4(m) {
  return m.status === "failed";
}
function _temp3(s_0) {
  return s_0.plugins.installationStatus;
}
function _temp2(s) {
  return s.plugins.errors;
}
function getInitialViewState(parsedCommand: ParsedCommand): ViewState {
  switch (parsedCommand.type) {
    case 'help':
      return {
        type: 'help'
      };
    case 'validate':
      return {
        type: 'validate',
        path: parsedCommand.path
      };
    case 'install':
      if (parsedCommand.marketplace) {
        return {
          type: 'browse-marketplace',
          targetMarketplace: parsedCommand.marketplace,
          targetPlugin: parsedCommand.plugin
        };
      }
      if (parsedCommand.plugin) {
        return {
          type: 'discover-plugins',
          targetPlugin: parsedCommand.plugin
        };
      }
      return {
        type: 'discover-plugins'
      };
    case 'manage':
      return {
        type: 'manage-plugins'
      };
    case 'uninstall':
      return {
        type: 'manage-plugins',
        targetPlugin: parsedCommand.plugin,
        action: 'uninstall'
      };
    case 'enable':
      return {
        type: 'manage-plugins',
        targetPlugin: parsedCommand.plugin,
        action: 'enable'
      };
    case 'disable':
      return {
        type: 'manage-plugins',
        targetPlugin: parsedCommand.plugin,
        action: 'disable'
      };
    case 'marketplace':
      if (parsedCommand.action === 'list') {
        return {
          type: 'marketplace-list'
        };
      }
      if (parsedCommand.action === 'add') {
        return {
          type: 'add-marketplace',
          initialValue: parsedCommand.target
        };
      }
      if (parsedCommand.action === 'remove') {
        return {
          type: 'manage-marketplaces',
          targetMarketplace: parsedCommand.target,
          action: 'remove'
        };
      }
      if (parsedCommand.action === 'update') {
        return {
          type: 'manage-marketplaces',
          targetMarketplace: parsedCommand.target,
          action: 'update'
        };
      }
      return {
        type: 'marketplace-menu'
      };
    case 'menu':
    default:
      // Default to discover view showing all plugins
      return {
        type: 'discover-plugins'
      };
  }
}
function getInitialTab(viewState: ViewState): TabId {
  if (viewState.type === 'manage-plugins') return 'installed';
  if (viewState.type === 'manage-marketplaces') return 'marketplaces';
  return 'discover';
}
export function PluginSettings(t0) {
  const $ = _c(75);
  const {
    onComplete,
    args,
    showMcpRedirectMessage
  } = t0;
  let parsedCommand;
  let t1;
  if ($[0] !== args) {
    parsedCommand = parsePluginArgs(args);
    t1 = getInitialViewState(parsedCommand);
    $[0] = args;
    $[1] = parsedCommand;
    $[2] = t1;
  } else {
    parsedCommand = $[1];
    t1 = $[2];
  }
  const initialViewState = t1;
  const [viewState, setViewState] = useState(initialViewState);
  let t2;
  if ($[3] !== initialViewState) {
    t2 = getInitialTab(initialViewState);
    $[3] = initialViewState;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  const [activeTab, setActiveTab] = useState(t2);
  const [inputValue, setInputValue] = useState(viewState.type === "add-marketplace" ? viewState.initialValue || "" : "");
  const [cursorOffset, setCursorOffset] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [childSearchActive, setChildSearchActive] = useState(false);
  const setAppState = useSetAppState();
  const pluginErrorCount = useAppState(_temp0);
  const errorsTabTitle = pluginErrorCount > 0 ? `Errors (${pluginErrorCount})` : "Errors";
  const exitState = useExitOnCtrlCDWithKeybindings();
  const cliMode = parsedCommand.type === "marketplace" && parsedCommand.action === "add" && parsedCommand.target !== undefined;
  let t3;
  if ($[5] !== setAppState) {
    t3 = () => {
      setAppState(_temp1);
    };
    $[5] = setAppState;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  const markPluginsChanged = t3;
  let t4;
  if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
    t4 = tabId => {
      const tab = tabId as TabId;
      setActiveTab(tab);
      setError(null);
      bb37: switch (tab) {
        case "discover":
          {
            setViewState({
              type: "discover-plugins"
            });
            break bb37;
          }
        case "installed":
          {
            setViewState({
              type: "manage-plugins"
            });
            break bb37;
          }
        case "marketplaces":
          {
            setViewState({
              type: "manage-marketplaces"
            });
            break bb37;
          }
        case "errors":
      }
    };
    $[7] = t4;
  } else {
    t4 = $[7];
  }
  const handleTabChange = t4;
  let t5;
  let t6;
  if ($[8] !== onComplete || $[9] !== result || $[10] !== viewState.type) {
    t5 = () => {
      if (viewState.type === "menu" && !result) {
        onComplete();
      }
    };
    t6 = [viewState.type, result, onComplete];
    $[8] = onComplete;
    $[9] = result;
    $[10] = viewState.type;
    $[11] = t5;
    $[12] = t6;
  } else {
    t5 = $[11];
    t6 = $[12];
  }
  useEffect(t5, t6);
  let t7;
  let t8;
  if ($[13] !== activeTab || $[14] !== viewState.type) {
    t7 = () => {
      if (viewState.type === "browse-marketplace" && activeTab !== "discover") {
        setActiveTab("discover");
      }
    };
    t8 = [viewState.type, activeTab];
    $[13] = activeTab;
    $[14] = viewState.type;
    $[15] = t7;
    $[16] = t8;
  } else {
    t7 = $[15];
    t8 = $[16];
  }
  useEffect(t7, t8);
  let t9;
  if ($[17] === Symbol.for("react.memo_cache_sentinel")) {
    t9 = () => {
      setActiveTab("marketplaces");
      setViewState({
        type: "manage-marketplaces"
      });
      setInputValue("");
      setError(null);
    };
    $[17] = t9;
  } else {
    t9 = $[17];
  }
  const handleAddMarketplaceEscape = t9;
  const t10 = viewState.type === "add-marketplace";
  let t11;
  if ($[18] !== t10) {
    t11 = {
      context: "Settings",
      isActive: t10
    };
    $[18] = t10;
    $[19] = t11;
  } else {
    t11 = $[19];
  }
  useKeybinding("confirm:no", handleAddMarketplaceEscape, t11);
  let t12;
  let t13;
  if ($[20] !== onComplete || $[21] !== result) {
    t12 = () => {
      if (result) {
        onComplete(result);
      }
    };
    t13 = [result, onComplete];
    $[20] = onComplete;
    $[21] = result;
    $[22] = t12;
    $[23] = t13;
  } else {
    t12 = $[22];
    t13 = $[23];
  }
  useEffect(t12, t13);
  let t14;
  let t15;
  if ($[24] !== onComplete || $[25] !== viewState.type) {
    t14 = () => {
      if (viewState.type === "help") {
        onComplete();
      }
    };
    t15 = [viewState.type, onComplete];
    $[24] = onComplete;
    $[25] = viewState.type;
    $[26] = t14;
    $[27] = t15;
  } else {
    t14 = $[26];
    t15 = $[27];
  }
  useEffect(t14, t15);
  if (viewState.type === "help") {
    let t16;
    if ($[28] === Symbol.for("react.memo_cache_sentinel")) {
      t16 = <Box flexDirection="column"><Text bold={true}>Plugin Command Usage:</Text><Text> </Text><Text dimColor={true}>Installation:</Text><Text> /plugin install - Browse and install plugins</Text><Text>{" "}{"/plugin install <marketplace> - Install from specific marketplace"}</Text><Text>{" /plugin install <plugin> - Install specific plugin"}</Text><Text>{" "}{"/plugin install <plugin>@<market> - Install plugin from marketplace"}</Text><Text> </Text><Text dimColor={true}>Management:</Text><Text> /plugin manage - Manage installed plugins</Text><Text>{" /plugin enable <plugin> - Enable a plugin"}</Text><Text>{" /plugin disable <plugin> - Disable a plugin"}</Text><Text>{" /plugin uninstall <plugin> - Uninstall a plugin"}</Text><Text> </Text><Text dimColor={true}>Marketplaces:</Text><Text> /plugin marketplace - Marketplace management menu</Text><Text> /plugin marketplace add - Add a marketplace</Text><Text>{" "}{"/plugin marketplace add <path/url> - Add marketplace directly"}</Text><Text> /plugin marketplace update - Update marketplaces</Text><Text>{" "}{"/plugin marketplace update <name> - Update specific marketplace"}</Text><Text> /plugin marketplace remove - Remove a marketplace</Text><Text>{" "}{"/plugin marketplace remove <name> - Remove specific marketplace"}</Text><Text> /plugin marketplace list - List all marketplaces</Text><Text> </Text><Text dimColor={true}>Validation:</Text><Text>{" "}{"/plugin validate <path> - Validate a manifest file or directory"}</Text><Text> </Text><Text dimColor={true}>Other:</Text><Text> /plugin - Main plugin menu</Text><Text> /plugin help - Show this help</Text><Text> /plugins - Alias for /plugin</Text></Box>;
      $[28] = t16;
    } else {
      t16 = $[28];
    }
    return t16;
  }
  if (viewState.type === "validate") {
    let t16;
    if ($[29] !== onComplete || $[30] !== viewState.path) {
      t16 = <ValidatePlugin onComplete={onComplete} path={viewState.path} />;
      $[29] = onComplete;
      $[30] = viewState.path;
      $[31] = t16;
    } else {
      t16 = $[31];
    }
    return t16;
  }
  if (viewState.type === "marketplace-menu") {
    setViewState({
      type: "menu"
    });
    return null;
  }
  if (viewState.type === "marketplace-list") {
    let t16;
    if ($[32] !== onComplete) {
      t16 = <MarketplaceList onComplete={onComplete} />;
      $[32] = onComplete;
      $[33] = t16;
    } else {
      t16 = $[33];
    }
    return t16;
  }
  if (viewState.type === "add-marketplace") {
    let t16;
    if ($[34] !== cliMode || $[35] !== cursorOffset || $[36] !== error || $[37] !== inputValue || $[38] !== markPluginsChanged || $[39] !== result) {
      t16 = <AddMarketplace inputValue={inputValue} setInputValue={setInputValue} cursorOffset={cursorOffset} setCursorOffset={setCursorOffset} error={error} setError={setError} result={result} setResult={setResult} setViewState={setViewState} onAddComplete={markPluginsChanged} cliMode={cliMode} />;
      $[34] = cliMode;
      $[35] = cursorOffset;
      $[36] = error;
      $[37] = inputValue;
      $[38] = markPluginsChanged;
      $[39] = result;
      $[40] = t16;
    } else {
      t16 = $[40];
    }
    return t16;
  }
  let t16;
  if ($[41] !== activeTab || $[42] !== showMcpRedirectMessage) {
    t16 = showMcpRedirectMessage && activeTab === "installed" ? <McpRedirectBanner /> : undefined;
    $[41] = activeTab;
    $[42] = showMcpRedirectMessage;
    $[43] = t16;
  } else {
    t16 = $[43];
  }
  let t17;
  if ($[44] !== error || $[45] !== markPluginsChanged || $[46] !== result || $[47] !== viewState.targetMarketplace || $[48] !== viewState.targetPlugin || $[49] !== viewState.type) {
    t17 = <Tab id="discover" title="Discover">{viewState.type === "browse-marketplace" ? <BrowseMarketplace error={error} setError={setError} result={result} setResult={setResult} setViewState={setViewState} onInstallComplete={markPluginsChanged} targetMarketplace={viewState.targetMarketplace} targetPlugin={viewState.targetPlugin} /> : <DiscoverPlugins error={error} setError={setError} result={result} setResult={setResult} setViewState={setViewState} onInstallComplete={markPluginsChanged} onSearchModeChange={setChildSearchActive} targetPlugin={viewState.type === "discover-plugins" ? viewState.targetPlugin : undefined} />}</Tab>;
    $[44] = error;
    $[45] = markPluginsChanged;
    $[46] = result;
    $[47] = viewState.targetMarketplace;
    $[48] = viewState.targetPlugin;
    $[49] = viewState.type;
    $[50] = t17;
  } else {
    t17 = $[50];
  }
  const t18 = viewState.type === "manage-plugins" ? viewState.targetPlugin : undefined;
  const t19 = viewState.type === "manage-plugins" ? viewState.targetMarketplace : undefined;
  const t20 = viewState.type === "manage-plugins" ? viewState.action : undefined;
  let t21;
  if ($[51] !== markPluginsChanged || $[52] !== t18 || $[53] !== t19 || $[54] !== t20) {
    t21 = <Tab id="installed" title="Installed"><ManagePlugins setViewState={setViewState} setResult={setResult} onManageComplete={markPluginsChanged} onSearchModeChange={setChildSearchActive} targetPlugin={t18} targetMarketplace={t19} action={t20} /></Tab>;
    $[51] = markPluginsChanged;
    $[52] = t18;
    $[53] = t19;
    $[54] = t20;
    $[55] = t21;
  } else {
    t21 = $[55];
  }
  const t22 = viewState.type === "manage-marketplaces" ? viewState.targetMarketplace : undefined;
  const t23 = viewState.type === "manage-marketplaces" ? viewState.action : undefined;
  let t24;
  if ($[56] !== error || $[57] !== exitState || $[58] !== markPluginsChanged || $[59] !== t22 || $[60] !== t23) {
    t24 = <Tab id="marketplaces" title="Marketplaces"><ManageMarketplaces setViewState={setViewState} error={error} setError={setError} setResult={setResult} exitState={exitState} onManageComplete={markPluginsChanged} targetMarketplace={t22} action={t23} /></Tab>;
    $[56] = error;
    $[57] = exitState;
    $[58] = markPluginsChanged;
    $[59] = t22;
    $[60] = t23;
    $[61] = t24;
  } else {
    t24 = $[61];
  }
  let t25;
  if ($[62] !== markPluginsChanged) {
    t25 = <ErrorsTabContent setViewState={setViewState} setActiveTab={setActiveTab} markPluginsChanged={markPluginsChanged} />;
    $[62] = markPluginsChanged;
    $[63] = t25;
  } else {
    t25 = $[63];
  }
  let t26;
  if ($[64] !== errorsTabTitle || $[65] !== t25) {
    t26 = <Tab id="errors" title={errorsTabTitle}>{t25}</Tab>;
    $[64] = errorsTabTitle;
    $[65] = t25;
    $[66] = t26;
  } else {
    t26 = $[66];
  }
  let t27;
  if ($[67] !== activeTab || $[68] !== childSearchActive || $[69] !== t16 || $[70] !== t17 || $[71] !== t21 || $[72] !== t24 || $[73] !== t26) {
    t27 = <Pane color="suggestion"><Tabs title="Plugins" selectedTab={activeTab} onTabChange={handleTabChange} color="suggestion" disableNavigation={childSearchActive} banner={t16}>{t17}{t21}{t24}{t26}</Tabs></Pane>;
    $[67] = activeTab;
    $[68] = childSearchActive;
    $[69] = t16;
    $[70] = t17;
    $[71] = t21;
    $[72] = t24;
    $[73] = t26;
    $[74] = t27;
  } else {
    t27 = $[74];
  }
  return t27;
}
function _temp1(prev) {
  return prev.plugins.needsRefresh ? prev : {
    ...prev,
    plugins: {
      ...prev.plugins,
      needsRefresh: true
    }
  };
}
function _temp0(s) {
  let count = s.plugins.errors.length;
  for (const m of s.plugins.installationStatus.marketplaces) {
    if (m.status === "failed") {
      count++;
    }
  }
  return count;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZVN0YXRlIiwiQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IiwiQnlsaW5lIiwiUGFuZSIsIlRhYiIsIlRhYnMiLCJ1c2VFeGl0T25DdHJsQ0RXaXRoS2V5YmluZGluZ3MiLCJCb3giLCJUZXh0IiwidXNlS2V5YmluZGluZyIsInVzZUtleWJpbmRpbmdzIiwidXNlQXBwU3RhdGUiLCJ1c2VTZXRBcHBTdGF0ZSIsIlBsdWdpbkVycm9yIiwiZXJyb3JNZXNzYWdlIiwiY2xlYXJBbGxDYWNoZXMiLCJsb2FkTWFya2V0cGxhY2VzV2l0aEdyYWNlZnVsRGVncmFkYXRpb24iLCJsb2FkS25vd25NYXJrZXRwbGFjZXNDb25maWciLCJyZW1vdmVNYXJrZXRwbGFjZVNvdXJjZSIsImdldFBsdWdpbkVkaXRhYmxlU2NvcGVzIiwiRWRpdGFibGVTZXR0aW5nU291cmNlIiwiZ2V0U2V0dGluZ3NGb3JTb3VyY2UiLCJ1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSIsIkFkZE1hcmtldHBsYWNlIiwiQnJvd3NlTWFya2V0cGxhY2UiLCJEaXNjb3ZlclBsdWdpbnMiLCJNYW5hZ2VNYXJrZXRwbGFjZXMiLCJNYW5hZ2VQbHVnaW5zIiwiZm9ybWF0RXJyb3JNZXNzYWdlIiwiZ2V0RXJyb3JHdWlkYW5jZSIsIlBhcnNlZENvbW1hbmQiLCJwYXJzZVBsdWdpbkFyZ3MiLCJQbHVnaW5TZXR0aW5nc1Byb3BzIiwiVmlld1N0YXRlIiwiVmFsaWRhdGVQbHVnaW4iLCJUYWJJZCIsIk1hcmtldHBsYWNlTGlzdCIsInQwIiwiJCIsIl9jIiwib25Db21wbGV0ZSIsInQxIiwidDIiLCJsb2FkTGlzdCIsImNvbmZpZyIsIm5hbWVzIiwiT2JqZWN0Iiwia2V5cyIsImxlbmd0aCIsIm1hcCIsIl90ZW1wIiwiam9pbiIsInQzIiwiZXJyIiwiU3ltYm9sIiwiZm9yIiwibiIsIk1jcFJlZGlyZWN0QmFubmVyIiwiRXJyb3JSb3dBY3Rpb24iLCJraW5kIiwidGFiIiwidmlld1N0YXRlIiwibmFtZSIsInNvdXJjZXMiLCJBcnJheSIsInNvdXJjZSIsInNjb3BlIiwiRXJyb3JSb3ciLCJsYWJlbCIsIm1lc3NhZ2UiLCJndWlkYW5jZSIsImFjdGlvbiIsImdldEV4dHJhTWFya2V0cGxhY2VTb3VyY2VJbmZvIiwiZWRpdGFibGVTb3VyY2VzIiwiaXNJblBvbGljeSIsInNvdXJjZXNUb0NoZWNrIiwiY29uc3QiLCJzZXR0aW5ncyIsImV4dHJhS25vd25NYXJrZXRwbGFjZXMiLCJwdXNoIiwicG9saWN5U2V0dGluZ3MiLCJCb29sZWFuIiwiYnVpbGRNYXJrZXRwbGFjZUFjdGlvbiIsInR5cGUiLCJ0YXJnZXRNYXJrZXRwbGFjZSIsImJ1aWxkUGx1Z2luQWN0aW9uIiwicGx1Z2luTmFtZSIsInRhcmdldFBsdWdpbiIsIlRSQU5TSUVOVF9FUlJPUl9UWVBFUyIsIlNldCIsImlzVHJhbnNpZW50RXJyb3IiLCJlcnJvciIsImhhcyIsImdldFBsdWdpbk5hbWVGcm9tRXJyb3IiLCJwbHVnaW5JZCIsInBsdWdpbiIsImluY2x1ZGVzIiwic3BsaXQiLCJ1bmRlZmluZWQiLCJidWlsZEVycm9yUm93cyIsImZhaWxlZE1hcmtldHBsYWNlcyIsImV4dHJhTWFya2V0cGxhY2VFcnJvcnMiLCJwbHVnaW5Mb2FkaW5nRXJyb3JzIiwib3RoZXJFcnJvcnMiLCJicm9rZW5JbnN0YWxsZWRNYXJrZXRwbGFjZXMiLCJ0cmFuc2llbnRFcnJvcnMiLCJwbHVnaW5TY29wZXMiLCJNYXAiLCJyb3dzIiwic2hvd25NYXJrZXRwbGFjZU5hbWVzIiwibSIsImFkZCIsInNvdXJjZUluZm8iLCJlIiwibWFya2V0cGxhY2UiLCJzaG93blBsdWdpbk5hbWVzIiwiZ2V0IiwicmVtb3ZlRXh0cmFNYXJrZXRwbGFjZSIsInVwZGF0ZXMiLCJSZWNvcmQiLCJlbmFibGVkUGx1Z2lucyIsInN1ZmZpeCIsInJlbW92ZWRQbHVnaW5zIiwidXBkYXRlZFBsdWdpbnMiLCJlbmRzV2l0aCIsIkVycm9yc1RhYkNvbnRlbnQiLCJzZXRWaWV3U3RhdGUiLCJzZXRBY3RpdmVUYWIiLCJtYXJrUGx1Z2luc0NoYW5nZWQiLCJlcnJvcnMiLCJfdGVtcDIiLCJpbnN0YWxsYXRpb25TdGF0dXMiLCJfdGVtcDMiLCJzZXRBcHBTdGF0ZSIsInNlbGVjdGVkSW5kZXgiLCJzZXRTZWxlY3RlZEluZGV4IiwiYWN0aW9uTWVzc2FnZSIsInNldEFjdGlvbk1lc3NhZ2UiLCJtYXJrZXRwbGFjZUxvYWRGYWlsdXJlcyIsInNldE1hcmtldHBsYWNlTG9hZEZhaWx1cmVzIiwiZmFpbHVyZXMiLCJtYXJrZXRwbGFjZXMiLCJmaWx0ZXIiLCJfdGVtcDQiLCJmYWlsZWRNYXJrZXRwbGFjZU5hbWVzIiwiX3RlbXA1IiwiX3RlbXA2IiwiX3RlbXA3IiwidDQiLCJ0NSIsImNvbnRleHQiLCJoYW5kbGVTZWxlY3QiLCJyb3ciLCJiYjc3Iiwic2NvcGVzIiwiX3RlbXA4IiwicHJldl8wIiwicHJldiIsInBsdWdpbnMiLCJlXzIiLCJtXzEiLCJ0aWNrIiwiZiIsInQ2IiwiRXJyb3IiLCJTdHJpbmciLCJ0NyIsIl90ZW1wOSIsInQ4IiwidDkiLCJpc0FjdGl2ZSIsInNlbGVjdDpuZXh0IiwicHJldl8yIiwiTWF0aCIsIm1pbiIsImNsYW1wZWRJbmRleCIsIm1heCIsInNlbGVjdGVkQWN0aW9uIiwiaGFzQWN0aW9uIiwidDEwIiwidDExIiwiVDAiLCJyb3dfMCIsImlkeCIsImlzU2VsZWN0ZWQiLCJwb2ludGVyIiwiY3Jvc3MiLCJ0MTIiLCJ0MTMiLCJ0MTQiLCJ0MTUiLCJ0MTYiLCJ0MTciLCJ0MTgiLCJwcmV2XzEiLCJzXzEiLCJzIiwiZV8xIiwiZV8wIiwibV8wIiwic3RhdHVzIiwic18wIiwiZ2V0SW5pdGlhbFZpZXdTdGF0ZSIsInBhcnNlZENvbW1hbmQiLCJwYXRoIiwiaW5pdGlhbFZhbHVlIiwidGFyZ2V0IiwiZ2V0SW5pdGlhbFRhYiIsIlBsdWdpblNldHRpbmdzIiwiYXJncyIsInNob3dNY3BSZWRpcmVjdE1lc3NhZ2UiLCJpbml0aWFsVmlld1N0YXRlIiwiYWN0aXZlVGFiIiwiaW5wdXRWYWx1ZSIsInNldElucHV0VmFsdWUiLCJjdXJzb3JPZmZzZXQiLCJzZXRDdXJzb3JPZmZzZXQiLCJzZXRFcnJvciIsInJlc3VsdCIsInNldFJlc3VsdCIsImNoaWxkU2VhcmNoQWN0aXZlIiwic2V0Q2hpbGRTZWFyY2hBY3RpdmUiLCJwbHVnaW5FcnJvckNvdW50IiwiX3RlbXAwIiwiZXJyb3JzVGFiVGl0bGUiLCJleGl0U3RhdGUiLCJjbGlNb2RlIiwiX3RlbXAxIiwidGFiSWQiLCJiYjM3IiwiaGFuZGxlVGFiQ2hhbmdlIiwiaGFuZGxlQWRkTWFya2V0cGxhY2VFc2NhcGUiLCJ0MTkiLCJ0MjAiLCJ0MjEiLCJ0MjIiLCJ0MjMiLCJ0MjQiLCJ0MjUiLCJ0MjYiLCJ0MjciLCJuZWVkc1JlZnJlc2giLCJjb3VudCJdLCJzb3VyY2VzIjpbIlBsdWdpblNldHRpbmdzLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZmlndXJlcyBmcm9tICdmaWd1cmVzJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9Db25maWd1cmFibGVTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQgeyBCeWxpbmUgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2Rlc2lnbi1zeXN0ZW0vQnlsaW5lLmpzJ1xuaW1wb3J0IHsgUGFuZSB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvZGVzaWduLXN5c3RlbS9QYW5lLmpzJ1xuaW1wb3J0IHsgVGFiLCBUYWJzIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9kZXNpZ24tc3lzdGVtL1RhYnMuanMnXG5pbXBvcnQgeyB1c2VFeGl0T25DdHJsQ0RXaXRoS2V5YmluZGluZ3MgfSBmcm9tICcuLi8uLi9ob29rcy91c2VFeGl0T25DdHJsQ0RXaXRoS2V5YmluZGluZ3MuanMnXG5pbXBvcnQgeyBCb3gsIFRleHQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5pbXBvcnQge1xuICB1c2VLZXliaW5kaW5nLFxuICB1c2VLZXliaW5kaW5ncyxcbn0gZnJvbSAnLi4vLi4va2V5YmluZGluZ3MvdXNlS2V5YmluZGluZy5qcydcbmltcG9ydCB7IHVzZUFwcFN0YXRlLCB1c2VTZXRBcHBTdGF0ZSB9IGZyb20gJy4uLy4uL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHR5cGUgeyBQbHVnaW5FcnJvciB9IGZyb20gJy4uLy4uL3R5cGVzL3BsdWdpbi5qcydcbmltcG9ydCB7IGVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9ycy5qcydcbmltcG9ydCB7IGNsZWFyQWxsQ2FjaGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9jYWNoZVV0aWxzLmpzJ1xuaW1wb3J0IHsgbG9hZE1hcmtldHBsYWNlc1dpdGhHcmFjZWZ1bERlZ3JhZGF0aW9uIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9tYXJrZXRwbGFjZUhlbHBlcnMuanMnXG5pbXBvcnQge1xuICBsb2FkS25vd25NYXJrZXRwbGFjZXNDb25maWcsXG4gIHJlbW92ZU1hcmtldHBsYWNlU291cmNlLFxufSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL21hcmtldHBsYWNlTWFuYWdlci5qcydcbmltcG9ydCB7IGdldFBsdWdpbkVkaXRhYmxlU2NvcGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9wbHVnaW5TdGFydHVwQ2hlY2suanMnXG5pbXBvcnQgdHlwZSB7IEVkaXRhYmxlU2V0dGluZ1NvdXJjZSB9IGZyb20gJy4uLy4uL3V0aWxzL3NldHRpbmdzL2NvbnN0YW50cy5qcydcbmltcG9ydCB7XG4gIGdldFNldHRpbmdzRm9yU291cmNlLFxuICB1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvc2V0dGluZ3Mvc2V0dGluZ3MuanMnXG5pbXBvcnQgeyBBZGRNYXJrZXRwbGFjZSB9IGZyb20gJy4vQWRkTWFya2V0cGxhY2UuanMnXG5pbXBvcnQgeyBCcm93c2VNYXJrZXRwbGFjZSB9IGZyb20gJy4vQnJvd3NlTWFya2V0cGxhY2UuanMnXG5pbXBvcnQgeyBEaXNjb3ZlclBsdWdpbnMgfSBmcm9tICcuL0Rpc2NvdmVyUGx1Z2lucy5qcydcbmltcG9ydCB7IE1hbmFnZU1hcmtldHBsYWNlcyB9IGZyb20gJy4vTWFuYWdlTWFya2V0cGxhY2VzLmpzJ1xuaW1wb3J0IHsgTWFuYWdlUGx1Z2lucyB9IGZyb20gJy4vTWFuYWdlUGx1Z2lucy5qcydcbmltcG9ydCB7IGZvcm1hdEVycm9yTWVzc2FnZSwgZ2V0RXJyb3JHdWlkYW5jZSB9IGZyb20gJy4vUGx1Z2luRXJyb3JzLmpzJ1xuaW1wb3J0IHsgdHlwZSBQYXJzZWRDb21tYW5kLCBwYXJzZVBsdWdpbkFyZ3MgfSBmcm9tICcuL3BhcnNlQXJncy5qcydcbmltcG9ydCB0eXBlIHsgUGx1Z2luU2V0dGluZ3NQcm9wcywgVmlld1N0YXRlIH0gZnJvbSAnLi90eXBlcy5qcydcbmltcG9ydCB7IFZhbGlkYXRlUGx1Z2luIH0gZnJvbSAnLi9WYWxpZGF0ZVBsdWdpbi5qcydcblxudHlwZSBUYWJJZCA9ICdkaXNjb3ZlcicgfCAnaW5zdGFsbGVkJyB8ICdtYXJrZXRwbGFjZXMnIHwgJ2Vycm9ycydcblxuZnVuY3Rpb24gTWFya2V0cGxhY2VMaXN0KHtcbiAgb25Db21wbGV0ZSxcbn06IHtcbiAgb25Db21wbGV0ZTogKHJlc3VsdD86IHN0cmluZykgPT4gdm9pZFxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXN5bmMgZnVuY3Rpb24gbG9hZExpc3QoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjb25maWcgPSBhd2FpdCBsb2FkS25vd25NYXJrZXRwbGFjZXNDb25maWcoKVxuICAgICAgICBjb25zdCBuYW1lcyA9IE9iamVjdC5rZXlzKGNvbmZpZylcblxuICAgICAgICBpZiAobmFtZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgb25Db21wbGV0ZSgnTm8gbWFya2V0cGxhY2VzIGNvbmZpZ3VyZWQnKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9uQ29tcGxldGUoXG4gICAgICAgICAgICBgQ29uZmlndXJlZCBtYXJrZXRwbGFjZXM6XFxuJHtuYW1lcy5tYXAobiA9PiBgICDigKIgJHtufWApLmpvaW4oJ1xcbicpfWAsXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgb25Db21wbGV0ZShgRXJyb3IgbG9hZGluZyBtYXJrZXRwbGFjZXM6ICR7ZXJyb3JNZXNzYWdlKGVycil9YClcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2b2lkIGxvYWRMaXN0KClcbiAgfSwgW29uQ29tcGxldGVdKVxuXG4gIHJldHVybiA8VGV4dD5Mb2FkaW5nIG1hcmtldHBsYWNlcy4uLjwvVGV4dD5cbn1cblxuZnVuY3Rpb24gTWNwUmVkaXJlY3RCYW5uZXIoKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgaWYgKFwiZXh0ZXJuYWxcIiAhPT0gJ2FudCcpIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBmbGV4RGlyZWN0aW9uPVwicm93XCJcbiAgICAgIGFsaWduSXRlbXM9XCJmbGV4LXN0YXJ0XCJcbiAgICAgIHBhZGRpbmdMZWZ0PXsxfVxuICAgICAgbWFyZ2luVG9wPXsxfVxuICAgICAgYm9yZGVyTGVmdFxuICAgICAgYm9yZGVyUmlnaHQ9e2ZhbHNlfVxuICAgICAgYm9yZGVyVG9wPXtmYWxzZX1cbiAgICAgIGJvcmRlckJvdHRvbT17ZmFsc2V9XG4gICAgICBib3JkZXJDb2xvcj1cInBlcm1pc3Npb25cIlxuICAgICAgYm9yZGVyU3R5bGU9XCJzaW5nbGVcIlxuICAgID5cbiAgICAgIDxCb3ggZmxleFNocmluaz17MH0+XG4gICAgICAgIDxUZXh0IGJvbGQgaXRhbGljIGNvbG9yPVwicGVybWlzc2lvblwiPlxuICAgICAgICAgIGl7JyAnfVxuICAgICAgICA8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICAgIDxUZXh0PlxuICAgICAgICBbQU5ULU9OTFldIE1DUCBzZXJ2ZXJzIGFyZSBub3cgbWFuYWdlZCBpbiAvcGx1Z2lucy4gVXNlIC9tY3Agbm8tcmVkaXJlY3RcbiAgICAgICAgdG8gdGVzdCBvbGQgVUlcbiAgICAgIDwvVGV4dD5cbiAgICA8L0JveD5cbiAgKVxufVxuXG50eXBlIEVycm9yUm93QWN0aW9uID1cbiAgfCB7IGtpbmQ6ICduYXZpZ2F0ZSc7IHRhYjogVGFiSWQ7IHZpZXdTdGF0ZTogVmlld1N0YXRlIH1cbiAgfCB7XG4gICAgICBraW5kOiAncmVtb3ZlLWV4dHJhLW1hcmtldHBsYWNlJ1xuICAgICAgbmFtZTogc3RyaW5nXG4gICAgICBzb3VyY2VzOiBBcnJheTx7IHNvdXJjZTogRWRpdGFibGVTZXR0aW5nU291cmNlOyBzY29wZTogc3RyaW5nIH0+XG4gICAgfVxuICB8IHsga2luZDogJ3JlbW92ZS1pbnN0YWxsZWQtbWFya2V0cGxhY2UnOyBuYW1lOiBzdHJpbmcgfVxuICB8IHsga2luZDogJ21hbmFnZWQtb25seSc7IG5hbWU6IHN0cmluZyB9XG4gIHwgeyBraW5kOiAnbm9uZScgfVxuXG50eXBlIEVycm9yUm93ID0ge1xuICBsYWJlbDogc3RyaW5nXG4gIG1lc3NhZ2U6IHN0cmluZ1xuICBndWlkYW5jZT86IHN0cmluZyB8IG51bGxcbiAgYWN0aW9uOiBFcnJvclJvd0FjdGlvblxuICBzY29wZT86IHN0cmluZ1xufVxuXG4vKipcbiAqIERldGVybWluZSB3aGljaCBzZXR0aW5ncyBzb3VyY2VzIGRlZmluZSBhbiBleHRyYUtub3duTWFya2V0cGxhY2UgZW50cnkuXG4gKiBSZXR1cm5zIHRoZSBlZGl0YWJsZSBzb3VyY2VzICh1c2VyL3Byb2plY3QvbG9jYWwpIGFuZCB3aGV0aGVyIHBvbGljeSBhbHNvIGhhcyBpdC5cbiAqL1xuZnVuY3Rpb24gZ2V0RXh0cmFNYXJrZXRwbGFjZVNvdXJjZUluZm8obmFtZTogc3RyaW5nKToge1xuICBlZGl0YWJsZVNvdXJjZXM6IEFycmF5PHsgc291cmNlOiBFZGl0YWJsZVNldHRpbmdTb3VyY2U7IHNjb3BlOiBzdHJpbmcgfT5cbiAgaXNJblBvbGljeTogYm9vbGVhblxufSB7XG4gIGNvbnN0IGVkaXRhYmxlU291cmNlczogQXJyYXk8e1xuICAgIHNvdXJjZTogRWRpdGFibGVTZXR0aW5nU291cmNlXG4gICAgc2NvcGU6IHN0cmluZ1xuICB9PiA9IFtdXG5cbiAgY29uc3Qgc291cmNlc1RvQ2hlY2sgPSBbXG4gICAgeyBzb3VyY2U6ICd1c2VyU2V0dGluZ3MnIGFzIGNvbnN0LCBzY29wZTogJ3VzZXInIH0sXG4gICAgeyBzb3VyY2U6ICdwcm9qZWN0U2V0dGluZ3MnIGFzIGNvbnN0LCBzY29wZTogJ3Byb2plY3QnIH0sXG4gICAgeyBzb3VyY2U6ICdsb2NhbFNldHRpbmdzJyBhcyBjb25zdCwgc2NvcGU6ICdsb2NhbCcgfSxcbiAgXVxuXG4gIGZvciAoY29uc3QgeyBzb3VyY2UsIHNjb3BlIH0gb2Ygc291cmNlc1RvQ2hlY2spIHtcbiAgICBjb25zdCBzZXR0aW5ncyA9IGdldFNldHRpbmdzRm9yU291cmNlKHNvdXJjZSlcbiAgICBpZiAoc2V0dGluZ3M/LmV4dHJhS25vd25NYXJrZXRwbGFjZXM/LltuYW1lXSkge1xuICAgICAgZWRpdGFibGVTb3VyY2VzLnB1c2goeyBzb3VyY2UsIHNjb3BlIH0pXG4gICAgfVxuICB9XG5cbiAgY29uc3QgcG9saWN5U2V0dGluZ3MgPSBnZXRTZXR0aW5nc0ZvclNvdXJjZSgncG9saWN5U2V0dGluZ3MnKVxuICBjb25zdCBpc0luUG9saWN5ID0gQm9vbGVhbihwb2xpY3lTZXR0aW5ncz8uZXh0cmFLbm93bk1hcmtldHBsYWNlcz8uW25hbWVdKVxuXG4gIHJldHVybiB7IGVkaXRhYmxlU291cmNlcywgaXNJblBvbGljeSB9XG59XG5cbmZ1bmN0aW9uIGJ1aWxkTWFya2V0cGxhY2VBY3Rpb24obmFtZTogc3RyaW5nKTogRXJyb3JSb3dBY3Rpb24ge1xuICBjb25zdCB7IGVkaXRhYmxlU291cmNlcywgaXNJblBvbGljeSB9ID0gZ2V0RXh0cmFNYXJrZXRwbGFjZVNvdXJjZUluZm8obmFtZSlcblxuICBpZiAoZWRpdGFibGVTb3VyY2VzLmxlbmd0aCA+IDApIHtcbiAgICByZXR1cm4ge1xuICAgICAga2luZDogJ3JlbW92ZS1leHRyYS1tYXJrZXRwbGFjZScsXG4gICAgICBuYW1lLFxuICAgICAgc291cmNlczogZWRpdGFibGVTb3VyY2VzLFxuICAgIH1cbiAgfVxuXG4gIGlmIChpc0luUG9saWN5KSB7XG4gICAgcmV0dXJuIHsga2luZDogJ21hbmFnZWQtb25seScsIG5hbWUgfVxuICB9XG5cbiAgLy8gTWFya2V0cGxhY2UgaXMgaW4ga25vd25fbWFya2V0cGxhY2VzLmpzb24gYnV0IG5vdCBpbiBleHRyYUtub3duTWFya2V0cGxhY2VzXG4gIC8vIChlLmcuIHByZXZpb3VzbHkgaW5zdGFsbGVkIG1hbnVhbGx5KSDigJQgcm91dGUgdG8gTWFuYWdlTWFya2V0cGxhY2VzXG4gIHJldHVybiB7XG4gICAga2luZDogJ25hdmlnYXRlJyxcbiAgICB0YWI6ICdtYXJrZXRwbGFjZXMnLFxuICAgIHZpZXdTdGF0ZToge1xuICAgICAgdHlwZTogJ21hbmFnZS1tYXJrZXRwbGFjZXMnLFxuICAgICAgdGFyZ2V0TWFya2V0cGxhY2U6IG5hbWUsXG4gICAgICBhY3Rpb246ICdyZW1vdmUnLFxuICAgIH0sXG4gIH1cbn1cblxuZnVuY3Rpb24gYnVpbGRQbHVnaW5BY3Rpb24ocGx1Z2luTmFtZTogc3RyaW5nKTogRXJyb3JSb3dBY3Rpb24ge1xuICByZXR1cm4ge1xuICAgIGtpbmQ6ICduYXZpZ2F0ZScsXG4gICAgdGFiOiAnaW5zdGFsbGVkJyxcbiAgICB2aWV3U3RhdGU6IHtcbiAgICAgIHR5cGU6ICdtYW5hZ2UtcGx1Z2lucycsXG4gICAgICB0YXJnZXRQbHVnaW46IHBsdWdpbk5hbWUsXG4gICAgICBhY3Rpb246ICd1bmluc3RhbGwnLFxuICAgIH0sXG4gIH1cbn1cblxuY29uc3QgVFJBTlNJRU5UX0VSUk9SX1RZUEVTID0gbmV3IFNldChbXG4gICdnaXQtYXV0aC1mYWlsZWQnLFxuICAnZ2l0LXRpbWVvdXQnLFxuICAnbmV0d29yay1lcnJvcicsXG5dKVxuXG5mdW5jdGlvbiBpc1RyYW5zaWVudEVycm9yKGVycm9yOiBQbHVnaW5FcnJvcik6IGJvb2xlYW4ge1xuICByZXR1cm4gVFJBTlNJRU5UX0VSUk9SX1RZUEVTLmhhcyhlcnJvci50eXBlKVxufVxuXG4vKipcbiAqIEV4dHJhY3QgdGhlIHBsdWdpbiBuYW1lIGZyb20gYSBQbHVnaW5FcnJvciwgY2hlY2tpbmcgZXhwbGljaXQgZmllbGRzIGZpcnN0LFxuICogdGhlbiBmYWxsaW5nIGJhY2sgdG8gdGhlIHNvdXJjZSBmaWVsZCAoZm9ybWF0OiBcInBsdWdpbk5hbWVAbWFya2V0cGxhY2VcIikuXG4gKi9cbmZ1bmN0aW9uIGdldFBsdWdpbk5hbWVGcm9tRXJyb3IoZXJyb3I6IFBsdWdpbkVycm9yKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKCdwbHVnaW5JZCcgaW4gZXJyb3IgJiYgZXJyb3IucGx1Z2luSWQpIHJldHVybiBlcnJvci5wbHVnaW5JZFxuICBpZiAoJ3BsdWdpbicgaW4gZXJyb3IgJiYgZXJyb3IucGx1Z2luKSByZXR1cm4gZXJyb3IucGx1Z2luXG4gIC8vIEZhbGxiYWNrOiBzb3VyY2Ugb2Z0ZW4gY29udGFpbnMgXCJwbHVnaW5OYW1lQG1hcmtldHBsYWNlXCJcbiAgaWYgKGVycm9yLnNvdXJjZS5pbmNsdWRlcygnQCcpKSByZXR1cm4gZXJyb3Iuc291cmNlLnNwbGl0KCdAJylbMF1cbiAgcmV0dXJuIHVuZGVmaW5lZFxufVxuXG5mdW5jdGlvbiBidWlsZEVycm9yUm93cyhcbiAgZmFpbGVkTWFya2V0cGxhY2VzOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZXJyb3I/OiBzdHJpbmcgfT4sXG4gIGV4dHJhTWFya2V0cGxhY2VFcnJvcnM6IFBsdWdpbkVycm9yW10sXG4gIHBsdWdpbkxvYWRpbmdFcnJvcnM6IFBsdWdpbkVycm9yW10sXG4gIG90aGVyRXJyb3JzOiBQbHVnaW5FcnJvcltdLFxuICBicm9rZW5JbnN0YWxsZWRNYXJrZXRwbGFjZXM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyBlcnJvcjogc3RyaW5nIH0+LFxuICB0cmFuc2llbnRFcnJvcnM6IFBsdWdpbkVycm9yW10sXG4gIHBsdWdpblNjb3BlczogTWFwPHN0cmluZywgc3RyaW5nPixcbik6IEVycm9yUm93W10ge1xuICBjb25zdCByb3dzOiBFcnJvclJvd1tdID0gW11cblxuICAvLyAtLS0gVHJhbnNpZW50IGVycm9ycyBhdCB0aGUgdG9wIChyZXN0YXJ0IHRvIHJldHJ5KSAtLS1cbiAgZm9yIChjb25zdCBlcnJvciBvZiB0cmFuc2llbnRFcnJvcnMpIHtcbiAgICBjb25zdCBwbHVnaW5OYW1lID1cbiAgICAgICdwbHVnaW5JZCcgaW4gZXJyb3JcbiAgICAgICAgPyBlcnJvci5wbHVnaW5JZFxuICAgICAgICA6ICdwbHVnaW4nIGluIGVycm9yXG4gICAgICAgICAgPyBlcnJvci5wbHVnaW5cbiAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgIHJvd3MucHVzaCh7XG4gICAgICBsYWJlbDogcGx1Z2luTmFtZSA/PyBlcnJvci5zb3VyY2UsXG4gICAgICBtZXNzYWdlOiBmb3JtYXRFcnJvck1lc3NhZ2UoZXJyb3IpLFxuICAgICAgZ3VpZGFuY2U6ICdSZXN0YXJ0IHRvIHJldHJ5IGxvYWRpbmcgcGx1Z2lucycsXG4gICAgICBhY3Rpb246IHsga2luZDogJ25vbmUnIH0sXG4gICAgfSlcbiAgfVxuXG4gIC8vIC0tLSBNYXJrZXRwbGFjZSBlcnJvcnMgLS0tXG4gIC8vIFRyYWNrIHNob3duIG1hcmtldHBsYWNlIG5hbWVzIHRvIGF2b2lkIGR1cGxpY2F0ZXMgYWNyb3NzIHNvdXJjZXNcbiAgY29uc3Qgc2hvd25NYXJrZXRwbGFjZU5hbWVzID0gbmV3IFNldDxzdHJpbmc+KClcblxuICBmb3IgKGNvbnN0IG0gb2YgZmFpbGVkTWFya2V0cGxhY2VzKSB7XG4gICAgc2hvd25NYXJrZXRwbGFjZU5hbWVzLmFkZChtLm5hbWUpXG4gICAgY29uc3QgYWN0aW9uID0gYnVpbGRNYXJrZXRwbGFjZUFjdGlvbihtLm5hbWUpXG4gICAgY29uc3Qgc291cmNlSW5mbyA9IGdldEV4dHJhTWFya2V0cGxhY2VTb3VyY2VJbmZvKG0ubmFtZSlcbiAgICBjb25zdCBzY29wZSA9IHNvdXJjZUluZm8uaXNJblBvbGljeVxuICAgICAgPyAnbWFuYWdlZCdcbiAgICAgIDogc291cmNlSW5mby5lZGl0YWJsZVNvdXJjZXNbMF0/LnNjb3BlXG4gICAgcm93cy5wdXNoKHtcbiAgICAgIGxhYmVsOiBtLm5hbWUsXG4gICAgICBtZXNzYWdlOiBtLmVycm9yID8/ICdJbnN0YWxsYXRpb24gZmFpbGVkJyxcbiAgICAgIGd1aWRhbmNlOlxuICAgICAgICBhY3Rpb24ua2luZCA9PT0gJ21hbmFnZWQtb25seSdcbiAgICAgICAgICA/ICdNYW5hZ2VkIGJ5IHlvdXIgb3JnYW5pemF0aW9uIOKAlCBjb250YWN0IHlvdXIgYWRtaW4nXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICBhY3Rpb24sXG4gICAgICBzY29wZSxcbiAgICB9KVxuICB9XG5cbiAgZm9yIChjb25zdCBlIG9mIGV4dHJhTWFya2V0cGxhY2VFcnJvcnMpIHtcbiAgICBjb25zdCBtYXJrZXRwbGFjZSA9ICdtYXJrZXRwbGFjZScgaW4gZSA/IGUubWFya2V0cGxhY2UgOiBlLnNvdXJjZVxuICAgIGlmIChzaG93bk1hcmtldHBsYWNlTmFtZXMuaGFzKG1hcmtldHBsYWNlKSkgY29udGludWVcbiAgICBzaG93bk1hcmtldHBsYWNlTmFtZXMuYWRkKG1hcmtldHBsYWNlKVxuICAgIGNvbnN0IGFjdGlvbiA9IGJ1aWxkTWFya2V0cGxhY2VBY3Rpb24obWFya2V0cGxhY2UpXG4gICAgY29uc3Qgc291cmNlSW5mbyA9IGdldEV4dHJhTWFya2V0cGxhY2VTb3VyY2VJbmZvKG1hcmtldHBsYWNlKVxuICAgIGNvbnN0IHNjb3BlID0gc291cmNlSW5mby5pc0luUG9saWN5XG4gICAgICA/ICdtYW5hZ2VkJ1xuICAgICAgOiBzb3VyY2VJbmZvLmVkaXRhYmxlU291cmNlc1swXT8uc2NvcGVcbiAgICByb3dzLnB1c2goe1xuICAgICAgbGFiZWw6IG1hcmtldHBsYWNlLFxuICAgICAgbWVzc2FnZTogZm9ybWF0RXJyb3JNZXNzYWdlKGUpLFxuICAgICAgZ3VpZGFuY2U6XG4gICAgICAgIGFjdGlvbi5raW5kID09PSAnbWFuYWdlZC1vbmx5J1xuICAgICAgICAgID8gJ01hbmFnZWQgYnkgeW91ciBvcmdhbml6YXRpb24g4oCUIGNvbnRhY3QgeW91ciBhZG1pbidcbiAgICAgICAgICA6IGdldEVycm9yR3VpZGFuY2UoZSksXG4gICAgICBhY3Rpb24sXG4gICAgICBzY29wZSxcbiAgICB9KVxuICB9XG5cbiAgLy8gSW5zdGFsbGVkIG1hcmtldHBsYWNlcyB0aGF0IGZhaWwgdG8gbG9hZCBkYXRhIChmcm9tIGtub3duX21hcmtldHBsYWNlcy5qc29uKVxuICBmb3IgKGNvbnN0IG0gb2YgYnJva2VuSW5zdGFsbGVkTWFya2V0cGxhY2VzKSB7XG4gICAgaWYgKHNob3duTWFya2V0cGxhY2VOYW1lcy5oYXMobS5uYW1lKSkgY29udGludWVcbiAgICBzaG93bk1hcmtldHBsYWNlTmFtZXMuYWRkKG0ubmFtZSlcbiAgICByb3dzLnB1c2goe1xuICAgICAgbGFiZWw6IG0ubmFtZSxcbiAgICAgIG1lc3NhZ2U6IG0uZXJyb3IsXG4gICAgICBhY3Rpb246IHsga2luZDogJ3JlbW92ZS1pbnN0YWxsZWQtbWFya2V0cGxhY2UnLCBuYW1lOiBtLm5hbWUgfSxcbiAgICB9KVxuICB9XG5cbiAgLy8gLS0tIFBsdWdpbiBlcnJvcnMgLS0tXG4gIGNvbnN0IHNob3duUGx1Z2luTmFtZXMgPSBuZXcgU2V0PHN0cmluZz4oKVxuICBmb3IgKGNvbnN0IGVycm9yIG9mIHBsdWdpbkxvYWRpbmdFcnJvcnMpIHtcbiAgICBjb25zdCBwbHVnaW5OYW1lID0gZ2V0UGx1Z2luTmFtZUZyb21FcnJvcihlcnJvcilcbiAgICBpZiAocGx1Z2luTmFtZSAmJiBzaG93blBsdWdpbk5hbWVzLmhhcyhwbHVnaW5OYW1lKSkgY29udGludWVcbiAgICBpZiAocGx1Z2luTmFtZSkgc2hvd25QbHVnaW5OYW1lcy5hZGQocGx1Z2luTmFtZSlcblxuICAgIGNvbnN0IG1hcmtldHBsYWNlID0gJ21hcmtldHBsYWNlJyBpbiBlcnJvciA/IGVycm9yLm1hcmtldHBsYWNlIDogdW5kZWZpbmVkXG4gICAgLy8gVHJ5IHBsdWdpbklkQG1hcmtldHBsYWNlIGZvcm1hdCBmaXJzdCwgdGhlbiBqdXN0IHBsdWdpbk5hbWVcbiAgICBjb25zdCBzY29wZSA9IHBsdWdpbk5hbWVcbiAgICAgID8gKHBsdWdpblNjb3Blcy5nZXQoZXJyb3Iuc291cmNlKSA/PyBwbHVnaW5TY29wZXMuZ2V0KHBsdWdpbk5hbWUpKVxuICAgICAgOiB1bmRlZmluZWRcbiAgICByb3dzLnB1c2goe1xuICAgICAgbGFiZWw6IHBsdWdpbk5hbWVcbiAgICAgICAgPyBtYXJrZXRwbGFjZVxuICAgICAgICAgID8gYCR7cGx1Z2luTmFtZX0gQCAke21hcmtldHBsYWNlfWBcbiAgICAgICAgICA6IHBsdWdpbk5hbWVcbiAgICAgICAgOiBlcnJvci5zb3VyY2UsXG4gICAgICBtZXNzYWdlOiBmb3JtYXRFcnJvck1lc3NhZ2UoZXJyb3IpLFxuICAgICAgZ3VpZGFuY2U6IGdldEVycm9yR3VpZGFuY2UoZXJyb3IpLFxuICAgICAgYWN0aW9uOiBwbHVnaW5OYW1lID8gYnVpbGRQbHVnaW5BY3Rpb24ocGx1Z2luTmFtZSkgOiB7IGtpbmQ6ICdub25lJyB9LFxuICAgICAgc2NvcGUsXG4gICAgfSlcbiAgfVxuXG4gIC8vIC0tLSBPdGhlciBlcnJvcnMgKG5vbi1tYXJrZXRwbGFjZSwgbm9uLXBsdWdpbi1zcGVjaWZpYykgLS0tXG4gIGZvciAoY29uc3QgZXJyb3Igb2Ygb3RoZXJFcnJvcnMpIHtcbiAgICByb3dzLnB1c2goe1xuICAgICAgbGFiZWw6IGVycm9yLnNvdXJjZSxcbiAgICAgIG1lc3NhZ2U6IGZvcm1hdEVycm9yTWVzc2FnZShlcnJvciksXG4gICAgICBndWlkYW5jZTogZ2V0RXJyb3JHdWlkYW5jZShlcnJvciksXG4gICAgICBhY3Rpb246IHsga2luZDogJ25vbmUnIH0sXG4gICAgfSlcbiAgfVxuXG4gIHJldHVybiByb3dzXG59XG5cbi8qKlxuICogUmVtb3ZlIGEgbWFya2V0cGxhY2UgZnJvbSBleHRyYUtub3duTWFya2V0cGxhY2VzIGluIHRoZSBnaXZlbiBzZXR0aW5ncyBzb3VyY2VzLFxuICogYW5kIGFsc28gcmVtb3ZlIGFueSBhc3NvY2lhdGVkIGVuYWJsZWQgcGx1Z2lucy5cbiAqL1xuZnVuY3Rpb24gcmVtb3ZlRXh0cmFNYXJrZXRwbGFjZShcbiAgbmFtZTogc3RyaW5nLFxuICBzb3VyY2VzOiBBcnJheTx7IHNvdXJjZTogRWRpdGFibGVTZXR0aW5nU291cmNlIH0+LFxuKTogdm9pZCB7XG4gIGZvciAoY29uc3QgeyBzb3VyY2UgfSBvZiBzb3VyY2VzKSB7XG4gICAgY29uc3Qgc2V0dGluZ3MgPSBnZXRTZXR0aW5nc0ZvclNvdXJjZShzb3VyY2UpXG4gICAgaWYgKCFzZXR0aW5ncykgY29udGludWVcblxuICAgIGNvbnN0IHVwZGF0ZXM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge31cblxuICAgIC8vIFJlbW92ZSBmcm9tIGV4dHJhS25vd25NYXJrZXRwbGFjZXNcbiAgICBpZiAoc2V0dGluZ3MuZXh0cmFLbm93bk1hcmtldHBsYWNlcz8uW25hbWVdKSB7XG4gICAgICB1cGRhdGVzLmV4dHJhS25vd25NYXJrZXRwbGFjZXMgPSB7XG4gICAgICAgIC4uLnNldHRpbmdzLmV4dHJhS25vd25NYXJrZXRwbGFjZXMsXG4gICAgICAgIFtuYW1lXTogdW5kZWZpbmVkLFxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlbW92ZSBhc3NvY2lhdGVkIGVuYWJsZWQgcGx1Z2lucyAoZm9ybWF0OiBcInBsdWdpbkBtYXJrZXRwbGFjZVwiKVxuICAgIGlmIChzZXR0aW5ncy5lbmFibGVkUGx1Z2lucykge1xuICAgICAgY29uc3Qgc3VmZml4ID0gYEAke25hbWV9YFxuICAgICAgbGV0IHJlbW92ZWRQbHVnaW5zID0gZmFsc2VcbiAgICAgIGNvbnN0IHVwZGF0ZWRQbHVnaW5zID0geyAuLi5zZXR0aW5ncy5lbmFibGVkUGx1Z2lucyB9XG4gICAgICBmb3IgKGNvbnN0IHBsdWdpbklkIGluIHVwZGF0ZWRQbHVnaW5zKSB7XG4gICAgICAgIGlmIChwbHVnaW5JZC5lbmRzV2l0aChzdWZmaXgpKSB7XG4gICAgICAgICAgdXBkYXRlZFBsdWdpbnNbcGx1Z2luSWRdID0gdW5kZWZpbmVkXG4gICAgICAgICAgcmVtb3ZlZFBsdWdpbnMgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZW1vdmVkUGx1Z2lucykge1xuICAgICAgICB1cGRhdGVzLmVuYWJsZWRQbHVnaW5zID0gdXBkYXRlZFBsdWdpbnNcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoT2JqZWN0LmtleXModXBkYXRlcykubGVuZ3RoID4gMCkge1xuICAgICAgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2Uoc291cmNlLCB1cGRhdGVzKVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBFcnJvcnNUYWJDb250ZW50KHtcbiAgc2V0Vmlld1N0YXRlLFxuICBzZXRBY3RpdmVUYWIsXG4gIG1hcmtQbHVnaW5zQ2hhbmdlZCxcbn06IHtcbiAgc2V0Vmlld1N0YXRlOiAoc3RhdGU6IFZpZXdTdGF0ZSkgPT4gdm9pZFxuICBzZXRBY3RpdmVUYWI6ICh0YWI6IFRhYklkKSA9PiB2b2lkXG4gIG1hcmtQbHVnaW5zQ2hhbmdlZDogKCkgPT4gdm9pZFxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IGVycm9ycyA9IHVzZUFwcFN0YXRlKHMgPT4gcy5wbHVnaW5zLmVycm9ycylcbiAgY29uc3QgaW5zdGFsbGF0aW9uU3RhdHVzID0gdXNlQXBwU3RhdGUocyA9PiBzLnBsdWdpbnMuaW5zdGFsbGF0aW9uU3RhdHVzKVxuICBjb25zdCBzZXRBcHBTdGF0ZSA9IHVzZVNldEFwcFN0YXRlKClcbiAgY29uc3QgW3NlbGVjdGVkSW5kZXgsIHNldFNlbGVjdGVkSW5kZXhdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgW2FjdGlvbk1lc3NhZ2UsIHNldEFjdGlvbk1lc3NhZ2VdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW21hcmtldHBsYWNlTG9hZEZhaWx1cmVzLCBzZXRNYXJrZXRwbGFjZUxvYWRGYWlsdXJlc10gPSB1c2VTdGF0ZTxcbiAgICBBcnJheTx7IG5hbWU6IHN0cmluZzsgZXJyb3I6IHN0cmluZyB9PlxuICA+KFtdKVxuXG4gIC8vIERldGVjdCBtYXJrZXRwbGFjZXMgdGhhdCBhcmUgaW5zdGFsbGVkIGJ1dCBmYWlsIHRvIGxvYWQgdGhlaXIgZGF0YVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IGxvYWRLbm93bk1hcmtldHBsYWNlc0NvbmZpZygpXG4gICAgICAgIGNvbnN0IHsgZmFpbHVyZXMgfSA9XG4gICAgICAgICAgYXdhaXQgbG9hZE1hcmtldHBsYWNlc1dpdGhHcmFjZWZ1bERlZ3JhZGF0aW9uKGNvbmZpZylcbiAgICAgICAgc2V0TWFya2V0cGxhY2VMb2FkRmFpbHVyZXMoZmFpbHVyZXMpXG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gSWdub3JlIOKAlCBpZiB3ZSBjYW4ndCBsb2FkIGNvbmZpZywgb3RoZXIgdGFicyBoYW5kbGUgaXRcbiAgICAgIH1cbiAgICB9KSgpXG4gIH0sIFtdKVxuXG4gIGNvbnN0IGZhaWxlZE1hcmtldHBsYWNlcyA9IGluc3RhbGxhdGlvblN0YXR1cy5tYXJrZXRwbGFjZXMuZmlsdGVyKFxuICAgIG0gPT4gbS5zdGF0dXMgPT09ICdmYWlsZWQnLFxuICApXG4gIGNvbnN0IGZhaWxlZE1hcmtldHBsYWNlTmFtZXMgPSBuZXcgU2V0KGZhaWxlZE1hcmtldHBsYWNlcy5tYXAobSA9PiBtLm5hbWUpKVxuXG4gIC8vIFRyYW5zaWVudCBlcnJvcnMgKGdpdC9uZXR3b3JrKSDigJQgc2hvdyBhdCB0b3Agd2l0aCBcInJlc3RhcnQgdG8gcmV0cnlcIlxuICBjb25zdCB0cmFuc2llbnRFcnJvcnMgPSBlcnJvcnMuZmlsdGVyKGlzVHJhbnNpZW50RXJyb3IpXG5cbiAgLy8gTWFya2V0cGxhY2UtcmVsYXRlZCBsb2FkaW5nIGVycm9ycyBub3QgYWxyZWFkeSBjb3ZlcmVkIGJ5IGluc3RhbGwgZmFpbHVyZXNcbiAgY29uc3QgZXh0cmFNYXJrZXRwbGFjZUVycm9ycyA9IGVycm9ycy5maWx0ZXIoXG4gICAgZSA9PlxuICAgICAgKGUudHlwZSA9PT0gJ21hcmtldHBsYWNlLW5vdC1mb3VuZCcgfHxcbiAgICAgICAgZS50eXBlID09PSAnbWFya2V0cGxhY2UtbG9hZC1mYWlsZWQnIHx8XG4gICAgICAgIGUudHlwZSA9PT0gJ21hcmtldHBsYWNlLWJsb2NrZWQtYnktcG9saWN5JykgJiZcbiAgICAgICFmYWlsZWRNYXJrZXRwbGFjZU5hbWVzLmhhcyhlLm1hcmtldHBsYWNlKSxcbiAgKVxuXG4gIC8vIFBsdWdpbi1zcGVjaWZpYyBsb2FkaW5nIGVycm9yc1xuICBjb25zdCBwbHVnaW5Mb2FkaW5nRXJyb3JzID0gZXJyb3JzLmZpbHRlcihlID0+IHtcbiAgICBpZiAoaXNUcmFuc2llbnRFcnJvcihlKSkgcmV0dXJuIGZhbHNlXG4gICAgaWYgKFxuICAgICAgZS50eXBlID09PSAnbWFya2V0cGxhY2Utbm90LWZvdW5kJyB8fFxuICAgICAgZS50eXBlID09PSAnbWFya2V0cGxhY2UtbG9hZC1mYWlsZWQnIHx8XG4gICAgICBlLnR5cGUgPT09ICdtYXJrZXRwbGFjZS1ibG9ja2VkLWJ5LXBvbGljeSdcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICByZXR1cm4gZ2V0UGx1Z2luTmFtZUZyb21FcnJvcihlKSAhPT0gdW5kZWZpbmVkXG4gIH0pXG5cbiAgLy8gUmVtYWluaW5nIGVycm9ycyB3aXRoIG5vIHBsdWdpbiBhc3NvY2lhdGlvblxuICBjb25zdCBvdGhlckVycm9ycyA9IGVycm9ycy5maWx0ZXIoZSA9PiB7XG4gICAgaWYgKGlzVHJhbnNpZW50RXJyb3IoZSkpIHJldHVybiBmYWxzZVxuICAgIGlmIChcbiAgICAgIGUudHlwZSA9PT0gJ21hcmtldHBsYWNlLW5vdC1mb3VuZCcgfHxcbiAgICAgIGUudHlwZSA9PT0gJ21hcmtldHBsYWNlLWxvYWQtZmFpbGVkJyB8fFxuICAgICAgZS50eXBlID09PSAnbWFya2V0cGxhY2UtYmxvY2tlZC1ieS1wb2xpY3knXG4gICAgKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgcmV0dXJuIGdldFBsdWdpbk5hbWVGcm9tRXJyb3IoZSkgPT09IHVuZGVmaW5lZFxuICB9KVxuXG4gIGNvbnN0IHBsdWdpblNjb3BlcyA9IGdldFBsdWdpbkVkaXRhYmxlU2NvcGVzKClcbiAgY29uc3Qgcm93cyA9IGJ1aWxkRXJyb3JSb3dzKFxuICAgIGZhaWxlZE1hcmtldHBsYWNlcyxcbiAgICBleHRyYU1hcmtldHBsYWNlRXJyb3JzLFxuICAgIHBsdWdpbkxvYWRpbmdFcnJvcnMsXG4gICAgb3RoZXJFcnJvcnMsXG4gICAgbWFya2V0cGxhY2VMb2FkRmFpbHVyZXMsXG4gICAgdHJhbnNpZW50RXJyb3JzLFxuICAgIHBsdWdpblNjb3BlcyxcbiAgKVxuXG4gIC8vIEhhbmRsZSBlc2NhcGUgdG8gZXhpdCB0aGUgcGx1Z2luIG1lbnVcbiAgdXNlS2V5YmluZGluZyhcbiAgICAnY29uZmlybTpubycsXG4gICAgKCkgPT4ge1xuICAgICAgc2V0Vmlld1N0YXRlKHsgdHlwZTogJ21lbnUnIH0pXG4gICAgfSxcbiAgICB7IGNvbnRleHQ6ICdDb25maXJtYXRpb24nIH0sXG4gIClcblxuICBjb25zdCBoYW5kbGVTZWxlY3QgPSAoKSA9PiB7XG4gICAgY29uc3Qgcm93ID0gcm93c1tzZWxlY3RlZEluZGV4XVxuICAgIGlmICghcm93KSByZXR1cm5cbiAgICBjb25zdCB7IGFjdGlvbiB9ID0gcm93XG4gICAgc3dpdGNoIChhY3Rpb24ua2luZCkge1xuICAgICAgY2FzZSAnbmF2aWdhdGUnOlxuICAgICAgICBzZXRBY3RpdmVUYWIoYWN0aW9uLnRhYilcbiAgICAgICAgc2V0Vmlld1N0YXRlKGFjdGlvbi52aWV3U3RhdGUpXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdyZW1vdmUtZXh0cmEtbWFya2V0cGxhY2UnOiB7XG4gICAgICAgIGNvbnN0IHNjb3BlcyA9IGFjdGlvbi5zb3VyY2VzLm1hcChzID0+IHMuc2NvcGUpLmpvaW4oJywgJylcbiAgICAgICAgcmVtb3ZlRXh0cmFNYXJrZXRwbGFjZShhY3Rpb24ubmFtZSwgYWN0aW9uLnNvdXJjZXMpXG4gICAgICAgIGNsZWFyQWxsQ2FjaGVzKClcbiAgICAgICAgLy8gU3luY2hyb25vdXNseSBjbGVhciBhbGwgc3RhbGUgc3RhdGUgZm9yIHRoaXMgbWFya2V0cGxhY2Ugc28gdGhlIFVJXG4gICAgICAgIC8vIHVwZGF0ZXMgZ2xpdGNoLWZyZWUuIG1hcmtQbHVnaW5zQ2hhbmdlZCBvbmx5IHNldHMgbmVlZHNSZWZyZXNoIOKAlFxuICAgICAgICAvLyBpdCBkb2VzIG5vdCByZWZyZXNoIHBsdWdpbnMuZXJyb3JzLCBzbyB0aGlzIGlzIHRoZSBhdXRob3JpdGF0aXZlXG4gICAgICAgIC8vIGNsZWFudXAgdW50aWwgdGhlIHVzZXIgcnVucyAvcmVsb2FkLXBsdWdpbnMuXG4gICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIHBsdWdpbnM6IHtcbiAgICAgICAgICAgIC4uLnByZXYucGx1Z2lucyxcbiAgICAgICAgICAgIGVycm9yczogcHJldi5wbHVnaW5zLmVycm9ycy5maWx0ZXIoXG4gICAgICAgICAgICAgIGUgPT4gISgnbWFya2V0cGxhY2UnIGluIGUgJiYgZS5tYXJrZXRwbGFjZSA9PT0gYWN0aW9uLm5hbWUpLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGluc3RhbGxhdGlvblN0YXR1czoge1xuICAgICAgICAgICAgICAuLi5wcmV2LnBsdWdpbnMuaW5zdGFsbGF0aW9uU3RhdHVzLFxuICAgICAgICAgICAgICBtYXJrZXRwbGFjZXM6IHByZXYucGx1Z2lucy5pbnN0YWxsYXRpb25TdGF0dXMubWFya2V0cGxhY2VzLmZpbHRlcihcbiAgICAgICAgICAgICAgICBtID0+IG0ubmFtZSAhPT0gYWN0aW9uLm5hbWUsXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pKVxuICAgICAgICBzZXRBY3Rpb25NZXNzYWdlKFxuICAgICAgICAgIGAke2ZpZ3VyZXMudGlja30gUmVtb3ZlZCBcIiR7YWN0aW9uLm5hbWV9XCIgZnJvbSAke3Njb3Blc30gc2V0dGluZ3NgLFxuICAgICAgICApXG4gICAgICAgIG1hcmtQbHVnaW5zQ2hhbmdlZCgpXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBjYXNlICdyZW1vdmUtaW5zdGFsbGVkLW1hcmtldHBsYWNlJzoge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHJlbW92ZU1hcmtldHBsYWNlU291cmNlKGFjdGlvbi5uYW1lKVxuICAgICAgICAgICAgY2xlYXJBbGxDYWNoZXMoKVxuICAgICAgICAgICAgc2V0TWFya2V0cGxhY2VMb2FkRmFpbHVyZXMocHJldiA9PlxuICAgICAgICAgICAgICBwcmV2LmZpbHRlcihmID0+IGYubmFtZSAhPT0gYWN0aW9uLm5hbWUpLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgc2V0QWN0aW9uTWVzc2FnZShcbiAgICAgICAgICAgICAgYCR7ZmlndXJlcy50aWNrfSBSZW1vdmVkIG1hcmtldHBsYWNlIFwiJHthY3Rpb24ubmFtZX1cImAsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBtYXJrUGx1Z2luc0NoYW5nZWQoKVxuICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgc2V0QWN0aW9uTWVzc2FnZShcbiAgICAgICAgICAgICAgYEZhaWxlZCB0byByZW1vdmUgXCIke2FjdGlvbi5uYW1lfVwiOiAke2VyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKX1gLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgfSkoKVxuICAgICAgICBicmVha1xuICAgICAgfVxuICAgICAgY2FzZSAnbWFuYWdlZC1vbmx5JzpcbiAgICAgICAgLy8gTm8gYWN0aW9uIGF2YWlsYWJsZSDigJQgZ3VpZGFuY2UgdGV4dCBhbHJlYWR5IHNob3duXG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlICdub25lJzpcbiAgICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICB1c2VLZXliaW5kaW5ncyhcbiAgICB7XG4gICAgICAnc2VsZWN0OnByZXZpb3VzJzogKCkgPT4gc2V0U2VsZWN0ZWRJbmRleChwcmV2ID0+IE1hdGgubWF4KDAsIHByZXYgLSAxKSksXG4gICAgICAnc2VsZWN0Om5leHQnOiAoKSA9PlxuICAgICAgICBzZXRTZWxlY3RlZEluZGV4KHByZXYgPT4gTWF0aC5taW4ocm93cy5sZW5ndGggLSAxLCBwcmV2ICsgMSkpLFxuICAgICAgJ3NlbGVjdDphY2NlcHQnOiBoYW5kbGVTZWxlY3QsXG4gICAgfSxcbiAgICB7IGNvbnRleHQ6ICdTZWxlY3QnLCBpc0FjdGl2ZTogcm93cy5sZW5ndGggPiAwIH0sXG4gIClcblxuICAvLyBDbGFtcCBzZWxlY3RlZEluZGV4IHdoZW4gcm93cyBzaHJpbmsgKGUuZy4gYWZ0ZXIgcmVtb3ZhbClcbiAgY29uc3QgY2xhbXBlZEluZGV4ID0gTWF0aC5taW4oc2VsZWN0ZWRJbmRleCwgTWF0aC5tYXgoMCwgcm93cy5sZW5ndGggLSAxKSlcbiAgaWYgKGNsYW1wZWRJbmRleCAhPT0gc2VsZWN0ZWRJbmRleCkge1xuICAgIHNldFNlbGVjdGVkSW5kZXgoY2xhbXBlZEluZGV4KVxuICB9XG5cbiAgY29uc3Qgc2VsZWN0ZWRBY3Rpb24gPSByb3dzW2NsYW1wZWRJbmRleF0/LmFjdGlvblxuICBjb25zdCBoYXNBY3Rpb24gPVxuICAgIHNlbGVjdGVkQWN0aW9uICYmXG4gICAgc2VsZWN0ZWRBY3Rpb24ua2luZCAhPT0gJ25vbmUnICYmXG4gICAgc2VsZWN0ZWRBY3Rpb24ua2luZCAhPT0gJ21hbmFnZWQtb25seSdcblxuICBpZiAocm93cy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxCb3ggbWFyZ2luTGVmdD17MX0+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+Tm8gcGx1Z2luIGVycm9yczwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImJhY2tcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIHtyb3dzLm1hcCgocm93LCBpZHgpID0+IHtcbiAgICAgICAgY29uc3QgaXNTZWxlY3RlZCA9IGlkeCA9PT0gY2xhbXBlZEluZGV4XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPEJveCBrZXk9e2lkeH0gbWFyZ2luTGVmdD17MX0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICAgPFRleHQgY29sb3I9e2lzU2VsZWN0ZWQgPyAnc3VnZ2VzdGlvbicgOiAnZXJyb3InfT5cbiAgICAgICAgICAgICAgICB7aXNTZWxlY3RlZCA/IGZpZ3VyZXMucG9pbnRlciA6IGZpZ3VyZXMuY3Jvc3N9eycgJ31cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICA8VGV4dCBib2xkPXtpc1NlbGVjdGVkfT57cm93LmxhYmVsfTwvVGV4dD5cbiAgICAgICAgICAgICAge3Jvdy5zY29wZSAmJiA8VGV4dCBkaW1Db2xvcj4gKHtyb3cuc2NvcGV9KTwvVGV4dD59XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8Qm94IG1hcmdpbkxlZnQ9ezN9PlxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+e3Jvdy5tZXNzYWdlfTwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAge3Jvdy5ndWlkYW5jZSAmJiAoXG4gICAgICAgICAgICAgIDxCb3ggbWFyZ2luTGVmdD17M30+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3IgaXRhbGljPlxuICAgICAgICAgICAgICAgICAge3Jvdy5ndWlkYW5jZX1cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKVxuICAgICAgfSl9XG5cbiAgICAgIHthY3Rpb25NZXNzYWdlICYmIChcbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9IG1hcmdpbkxlZnQ9ezF9PlxuICAgICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCI+e2FjdGlvbk1lc3NhZ2V9PC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgPFRleHQgZGltQ29sb3IgaXRhbGljPlxuICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgIGFjdGlvbj1cInNlbGVjdDpwcmV2aW91c1wiXG4gICAgICAgICAgICAgIGNvbnRleHQ9XCJTZWxlY3RcIlxuICAgICAgICAgICAgICBmYWxsYmFjaz1cIuKGkVwiXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwibmF2aWdhdGVcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIHtoYXNBY3Rpb24gJiYgKFxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwic2VsZWN0OmFjY2VwdFwiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIlNlbGVjdFwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFbnRlclwiXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJyZXNvbHZlXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImJhY2tcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZnVuY3Rpb24gZ2V0SW5pdGlhbFZpZXdTdGF0ZShwYXJzZWRDb21tYW5kOiBQYXJzZWRDb21tYW5kKTogVmlld1N0YXRlIHtcbiAgc3dpdGNoIChwYXJzZWRDb21tYW5kLnR5cGUpIHtcbiAgICBjYXNlICdoZWxwJzpcbiAgICAgIHJldHVybiB7IHR5cGU6ICdoZWxwJyB9XG4gICAgY2FzZSAndmFsaWRhdGUnOlxuICAgICAgcmV0dXJuIHsgdHlwZTogJ3ZhbGlkYXRlJywgcGF0aDogcGFyc2VkQ29tbWFuZC5wYXRoIH1cbiAgICBjYXNlICdpbnN0YWxsJzpcbiAgICAgIGlmIChwYXJzZWRDb21tYW5kLm1hcmtldHBsYWNlKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ2Jyb3dzZS1tYXJrZXRwbGFjZScsXG4gICAgICAgICAgdGFyZ2V0TWFya2V0cGxhY2U6IHBhcnNlZENvbW1hbmQubWFya2V0cGxhY2UsXG4gICAgICAgICAgdGFyZ2V0UGx1Z2luOiBwYXJzZWRDb21tYW5kLnBsdWdpbixcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHBhcnNlZENvbW1hbmQucGx1Z2luKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ2Rpc2NvdmVyLXBsdWdpbnMnLFxuICAgICAgICAgIHRhcmdldFBsdWdpbjogcGFyc2VkQ29tbWFuZC5wbHVnaW4sXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB7IHR5cGU6ICdkaXNjb3Zlci1wbHVnaW5zJyB9XG4gICAgY2FzZSAnbWFuYWdlJzpcbiAgICAgIHJldHVybiB7IHR5cGU6ICdtYW5hZ2UtcGx1Z2lucycgfVxuICAgIGNhc2UgJ3VuaW5zdGFsbCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnbWFuYWdlLXBsdWdpbnMnLFxuICAgICAgICB0YXJnZXRQbHVnaW46IHBhcnNlZENvbW1hbmQucGx1Z2luLFxuICAgICAgICBhY3Rpb246ICd1bmluc3RhbGwnLFxuICAgICAgfVxuICAgIGNhc2UgJ2VuYWJsZSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnbWFuYWdlLXBsdWdpbnMnLFxuICAgICAgICB0YXJnZXRQbHVnaW46IHBhcnNlZENvbW1hbmQucGx1Z2luLFxuICAgICAgICBhY3Rpb246ICdlbmFibGUnLFxuICAgICAgfVxuICAgIGNhc2UgJ2Rpc2FibGUnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZTogJ21hbmFnZS1wbHVnaW5zJyxcbiAgICAgICAgdGFyZ2V0UGx1Z2luOiBwYXJzZWRDb21tYW5kLnBsdWdpbixcbiAgICAgICAgYWN0aW9uOiAnZGlzYWJsZScsXG4gICAgICB9XG4gICAgY2FzZSAnbWFya2V0cGxhY2UnOlxuICAgICAgaWYgKHBhcnNlZENvbW1hbmQuYWN0aW9uID09PSAnbGlzdCcpIHtcbiAgICAgICAgcmV0dXJuIHsgdHlwZTogJ21hcmtldHBsYWNlLWxpc3QnIH1cbiAgICAgIH1cbiAgICAgIGlmIChwYXJzZWRDb21tYW5kLmFjdGlvbiA9PT0gJ2FkZCcpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB0eXBlOiAnYWRkLW1hcmtldHBsYWNlJyxcbiAgICAgICAgICBpbml0aWFsVmFsdWU6IHBhcnNlZENvbW1hbmQudGFyZ2V0LFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocGFyc2VkQ29tbWFuZC5hY3Rpb24gPT09ICdyZW1vdmUnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ21hbmFnZS1tYXJrZXRwbGFjZXMnLFxuICAgICAgICAgIHRhcmdldE1hcmtldHBsYWNlOiBwYXJzZWRDb21tYW5kLnRhcmdldCxcbiAgICAgICAgICBhY3Rpb246ICdyZW1vdmUnLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocGFyc2VkQ29tbWFuZC5hY3Rpb24gPT09ICd1cGRhdGUnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ21hbmFnZS1tYXJrZXRwbGFjZXMnLFxuICAgICAgICAgIHRhcmdldE1hcmtldHBsYWNlOiBwYXJzZWRDb21tYW5kLnRhcmdldCxcbiAgICAgICAgICBhY3Rpb246ICd1cGRhdGUnLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4geyB0eXBlOiAnbWFya2V0cGxhY2UtbWVudScgfVxuICAgIGNhc2UgJ21lbnUnOlxuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBEZWZhdWx0IHRvIGRpc2NvdmVyIHZpZXcgc2hvd2luZyBhbGwgcGx1Z2luc1xuICAgICAgcmV0dXJuIHsgdHlwZTogJ2Rpc2NvdmVyLXBsdWdpbnMnIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRJbml0aWFsVGFiKHZpZXdTdGF0ZTogVmlld1N0YXRlKTogVGFiSWQge1xuICBpZiAodmlld1N0YXRlLnR5cGUgPT09ICdtYW5hZ2UtcGx1Z2lucycpIHJldHVybiAnaW5zdGFsbGVkJ1xuICBpZiAodmlld1N0YXRlLnR5cGUgPT09ICdtYW5hZ2UtbWFya2V0cGxhY2VzJykgcmV0dXJuICdtYXJrZXRwbGFjZXMnXG4gIHJldHVybiAnZGlzY292ZXInXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBQbHVnaW5TZXR0aW5ncyh7XG4gIG9uQ29tcGxldGUsXG4gIGFyZ3MsXG4gIHNob3dNY3BSZWRpcmVjdE1lc3NhZ2UsXG59OiBQbHVnaW5TZXR0aW5nc1Byb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgcGFyc2VkQ29tbWFuZCA9IHBhcnNlUGx1Z2luQXJncyhhcmdzKVxuICBjb25zdCBpbml0aWFsVmlld1N0YXRlID0gZ2V0SW5pdGlhbFZpZXdTdGF0ZShwYXJzZWRDb21tYW5kKVxuICBjb25zdCBbdmlld1N0YXRlLCBzZXRWaWV3U3RhdGVdID0gdXNlU3RhdGU8Vmlld1N0YXRlPihpbml0aWFsVmlld1N0YXRlKVxuICBjb25zdCBbYWN0aXZlVGFiLCBzZXRBY3RpdmVUYWJdID0gdXNlU3RhdGU8VGFiSWQ+KFxuICAgIGdldEluaXRpYWxUYWIoaW5pdGlhbFZpZXdTdGF0ZSksXG4gIClcbiAgY29uc3QgW2lucHV0VmFsdWUsIHNldElucHV0VmFsdWVdID0gdXNlU3RhdGUoXG4gICAgdmlld1N0YXRlLnR5cGUgPT09ICdhZGQtbWFya2V0cGxhY2UnID8gdmlld1N0YXRlLmluaXRpYWxWYWx1ZSB8fCAnJyA6ICcnLFxuICApXG4gIGNvbnN0IFtjdXJzb3JPZmZzZXQsIHNldEN1cnNvck9mZnNldF0gPSB1c2VTdGF0ZSgwKVxuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtyZXN1bHQsIHNldFJlc3VsdF0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuICBjb25zdCBbY2hpbGRTZWFyY2hBY3RpdmUsIHNldENoaWxkU2VhcmNoQWN0aXZlXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBzZXRBcHBTdGF0ZSA9IHVzZVNldEFwcFN0YXRlKClcblxuICAvLyBFcnJvciBjb3VudCBmb3IgdGhlIEVycm9ycyB0YWIgYmFkZ2Ug4oCUIGNvdW50cyBsb2FkZXIgZXJyb3JzICsgYmFja2dyb3VuZFxuICAvLyBtYXJrZXRwbGFjZSBpbnN0YWxsIGZhaWx1cmVzLiBEb2VzIE5PVCBjb3VudCBtYXJrZXRwbGFjZS1vbi1kaXNrIGxvYWRcbiAgLy8gZmFpbHVyZXMgKHRob3NlIHJlcXVpcmUgSS9PIGFuZCBhcmUgZGlzY292ZXJlZCBsYXppbHkgd2hlbiB0aGUgdGFiIG9wZW5zKS5cbiAgLy8gTWF5IHNsaWdodGx5IG92ZXJjb3VudCB2cy4gZGlzcGxheWVkIHJvd3Mgd2hlbiBhIG1hcmtldHBsYWNlIGhhcyBib3RoIGFcbiAgLy8gbG9hZGVyIGVycm9yIGFuZCBhIGZhaWxlZCBpbnN0YWxsIHN0YXR1cyAoYnVpbGRFcnJvclJvd3MgZGVkdXBsaWNhdGVzKS5cbiAgY29uc3QgcGx1Z2luRXJyb3JDb3VudCA9IHVzZUFwcFN0YXRlKHMgPT4ge1xuICAgIGxldCBjb3VudCA9IHMucGx1Z2lucy5lcnJvcnMubGVuZ3RoXG4gICAgZm9yIChjb25zdCBtIG9mIHMucGx1Z2lucy5pbnN0YWxsYXRpb25TdGF0dXMubWFya2V0cGxhY2VzKSB7XG4gICAgICBpZiAobS5zdGF0dXMgPT09ICdmYWlsZWQnKSBjb3VudCsrXG4gICAgfVxuICAgIHJldHVybiBjb3VudFxuICB9KVxuICBjb25zdCBlcnJvcnNUYWJUaXRsZSA9XG4gICAgcGx1Z2luRXJyb3JDb3VudCA+IDAgPyBgRXJyb3JzICgke3BsdWdpbkVycm9yQ291bnR9KWAgOiAnRXJyb3JzJ1xuXG4gIGNvbnN0IGV4aXRTdGF0ZSA9IHVzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncygpXG5cbiAgLyoqXG4gICAqIENMSSBtb2RlIGlzIGFjdGl2ZSB3aGVuIHRoZSB1c2VyIHByb3ZpZGVzIGEgY29tcGxldGUgY29tbWFuZCB3aXRoIGFsbCByZXF1aXJlZCBhcmd1bWVudHMuXG4gICAqIEluIHRoaXMgbW9kZSwgdGhlIG9wZXJhdGlvbiBleGVjdXRlcyBpbW1lZGlhdGVseSB3aXRob3V0IGludGVyYWN0aXZlIHByb21wdHMuXG4gICAqIEludGVyYWN0aXZlIG1vZGUgaXMgdXNlZCB3aGVuIGFyZ3VtZW50cyBhcmUgbWlzc2luZywgYWxsb3dpbmcgdGhlIHVzZXIgdG8gaW5wdXQgdGhlbS5cbiAgICovXG4gIGNvbnN0IGNsaU1vZGUgPVxuICAgIHBhcnNlZENvbW1hbmQudHlwZSA9PT0gJ21hcmtldHBsYWNlJyAmJlxuICAgIHBhcnNlZENvbW1hbmQuYWN0aW9uID09PSAnYWRkJyAmJlxuICAgIHBhcnNlZENvbW1hbmQudGFyZ2V0ICE9PSB1bmRlZmluZWRcblxuICAvLyBTaWduYWwgdGhhdCBwbHVnaW4gc3RhdGUgaGFzIGNoYW5nZWQgb24gZGlzayAoTGF5ZXIgMikgYW5kIGFjdGl2ZVxuICAvLyBjb21wb25lbnRzIChMYXllciAzKSBhcmUgc3RhbGUuIFVzZXIgcnVucyAvcmVsb2FkLXBsdWdpbnMgdG8gYXBwbHkuXG4gIC8vIFByZXZpb3VzbHkgdGhpcyB3YXMgdXBkYXRlUGx1Z2luU3RhdGUoKSB3aGljaCBkaWQgYSBwYXJ0aWFsIHJlZnJlc2hcbiAgLy8gKGNvbW1hbmRzIG9ubHkg4oCUIGFnZW50cy9ob29rcy9NQ1Agd2VyZSBzaWxlbnRseSBza2lwcGVkKS4gTm93IGFsbFxuICAvLyBMYXllci0zIHJlZnJlc2ggZmxvd3MgdGhyb3VnaCB0aGUgdW5pZmllZCByZWZyZXNoQWN0aXZlUGx1Z2lucygpXG4gIC8vIHByaW1pdGl2ZSB2aWEgL3JlbG9hZC1wbHVnaW5zLCBnaXZpbmcgb25lIGNvbnNpc3RlbnQgbWVudGFsIG1vZGVsOlxuICAvLyBwbHVnaW4gY2hhbmdlcyByZXF1aXJlIC9yZWxvYWQtcGx1Z2lucy5cbiAgY29uc3QgbWFya1BsdWdpbnNDaGFuZ2VkID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldEFwcFN0YXRlKHByZXYgPT5cbiAgICAgIHByZXYucGx1Z2lucy5uZWVkc1JlZnJlc2hcbiAgICAgICAgPyBwcmV2XG4gICAgICAgIDogeyAuLi5wcmV2LCBwbHVnaW5zOiB7IC4uLnByZXYucGx1Z2lucywgbmVlZHNSZWZyZXNoOiB0cnVlIH0gfSxcbiAgICApXG4gIH0sIFtzZXRBcHBTdGF0ZV0pXG5cbiAgLy8gSGFuZGxlIHRhYiBzd2l0Y2hpbmcgKGNhbGxlZCBieSBUYWJzIGNvbXBvbmVudClcbiAgY29uc3QgaGFuZGxlVGFiQ2hhbmdlID0gdXNlQ2FsbGJhY2soKHRhYklkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB0YWIgPSB0YWJJZCBhcyBUYWJJZFxuICAgIHNldEFjdGl2ZVRhYih0YWIpXG4gICAgc2V0RXJyb3IobnVsbClcbiAgICBzd2l0Y2ggKHRhYikge1xuICAgICAgY2FzZSAnZGlzY292ZXInOlxuICAgICAgICBzZXRWaWV3U3RhdGUoeyB0eXBlOiAnZGlzY292ZXItcGx1Z2lucycgfSlcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ2luc3RhbGxlZCc6XG4gICAgICAgIHNldFZpZXdTdGF0ZSh7IHR5cGU6ICdtYW5hZ2UtcGx1Z2lucycgfSlcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgJ21hcmtldHBsYWNlcyc6XG4gICAgICAgIHNldFZpZXdTdGF0ZSh7IHR5cGU6ICdtYW5hZ2UtbWFya2V0cGxhY2VzJyB9KVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnZXJyb3JzJzpcbiAgICAgICAgLy8gTm8gdmlld1N0YXRlIGNoYW5nZSBuZWVkZWQg4oCUIEVycm9yc1RhYkNvbnRlbnQgcmVuZGVycyBpbnNpZGUgPFRhYiBpZD1cImVycm9yc1wiPlxuICAgICAgICBicmVha1xuICAgIH1cbiAgfSwgW10pXG5cbiAgLy8gSGFuZGxlIGV4aXRpbmcgd2hlbiBjaGlsZCBjb21wb25lbnRzIHNldCB2aWV3U3RhdGUgdG8gJ21lbnUnLlxuICAvLyBDaGlsZCBjb21wb25lbnRzIHR5cGljYWxseSBzZXQgQk9USCBzZXRSZXN1bHQobXNnKSBhbmQgc2V0UGFyZW50Vmlld1N0YXRlXG4gIC8vICh7dHlwZTonbWVudSd9KSDigJQgYm90aCBlZmZlY3RzIGZpcmUgb24gdGhlIHNhbWUgcmVuZGVyLiBPbmx5IGNsb3NlIHZpYSB0aGlzXG4gIC8vIHBhdGggd2hlbiB0aGVyZSdzIG5vIHJlc3VsdCwgb3RoZXJ3aXNlIHRoZSByZXN1bHQgZWZmZWN0IChiZWxvdykgaGFuZGxlc1xuICAvLyB0aGUgY2xvc2UgQU5EIGRlbGl2ZXJzIHRoZSBtZXNzYWdlIHRvIHRoZSB0cmFuc2NyaXB0LlxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh2aWV3U3RhdGUudHlwZSA9PT0gJ21lbnUnICYmICFyZXN1bHQpIHtcbiAgICAgIG9uQ29tcGxldGUoKVxuICAgIH1cbiAgfSwgW3ZpZXdTdGF0ZS50eXBlLCByZXN1bHQsIG9uQ29tcGxldGVdKVxuXG4gIC8vIFN5bmMgYWN0aXZlVGFiIHdoZW4gdmlld1N0YXRlIGNoYW5nZXMgdG8gYSBkaWZmZXJlbnQgdGFiJ3MgY29udGVudFxuICAvLyBUaGlzIGhhbmRsZXMgY2FzZXMgbGlrZSBBZGRNYXJrZXRwbGFjZSBuYXZpZ2F0aW5nIHRvIGJyb3dzZS1tYXJrZXRwbGFjZVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh2aWV3U3RhdGUudHlwZSA9PT0gJ2Jyb3dzZS1tYXJrZXRwbGFjZScgJiYgYWN0aXZlVGFiICE9PSAnZGlzY292ZXInKSB7XG4gICAgICBzZXRBY3RpdmVUYWIoJ2Rpc2NvdmVyJylcbiAgICB9XG4gIH0sIFt2aWV3U3RhdGUudHlwZSwgYWN0aXZlVGFiXSlcblxuICAvLyBIYW5kbGUgZXNjYXBlIGtleSBmb3IgYWRkLW1hcmtldHBsYWNlIG1vZGUgb25seVxuICAvLyBPdGhlciB0YWJiZWQgdmlld3MgaGFuZGxlIGVzY2FwZSBpbiB0aGVpciBvd24gY29tcG9uZW50c1xuICBjb25zdCBoYW5kbGVBZGRNYXJrZXRwbGFjZUVzY2FwZSA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRBY3RpdmVUYWIoJ21hcmtldHBsYWNlcycpXG4gICAgc2V0Vmlld1N0YXRlKHsgdHlwZTogJ21hbmFnZS1tYXJrZXRwbGFjZXMnIH0pXG4gICAgc2V0SW5wdXRWYWx1ZSgnJylcbiAgICBzZXRFcnJvcihudWxsKVxuICB9LCBbXSlcblxuICB1c2VLZXliaW5kaW5nKCdjb25maXJtOm5vJywgaGFuZGxlQWRkTWFya2V0cGxhY2VFc2NhcGUsIHtcbiAgICBjb250ZXh0OiAnU2V0dGluZ3MnLFxuICAgIGlzQWN0aXZlOiB2aWV3U3RhdGUudHlwZSA9PT0gJ2FkZC1tYXJrZXRwbGFjZScsXG4gIH0pXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICBvbkNvbXBsZXRlKHJlc3VsdClcbiAgICB9XG4gIH0sIFtyZXN1bHQsIG9uQ29tcGxldGVdKVxuXG4gIC8vIEhhbmRsZSBoZWxwIHZpZXcgY29tcGxldGlvblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICh2aWV3U3RhdGUudHlwZSA9PT0gJ2hlbHAnKSB7XG4gICAgICBvbkNvbXBsZXRlKClcbiAgICB9XG4gIH0sIFt2aWV3U3RhdGUudHlwZSwgb25Db21wbGV0ZV0pXG5cbiAgLy8gUmVuZGVyIGRpZmZlcmVudCB2aWV3cyBiYXNlZCBvbiBzdGF0ZVxuICBpZiAodmlld1N0YXRlLnR5cGUgPT09ICdoZWxwJykge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPFRleHQgYm9sZD5QbHVnaW4gQ29tbWFuZCBVc2FnZTo8L1RleHQ+XG4gICAgICAgIDxUZXh0PiA8L1RleHQ+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPkluc3RhbGxhdGlvbjo8L1RleHQ+XG4gICAgICAgIDxUZXh0PiAvcGx1Z2luIGluc3RhbGwgLSBCcm93c2UgYW5kIGluc3RhbGwgcGx1Z2luczwvVGV4dD5cbiAgICAgICAgPFRleHQ+XG4gICAgICAgICAgeycgJ31cbiAgICAgICAgICAvcGx1Z2luIGluc3RhbGwgJmx0O21hcmtldHBsYWNlJmd0OyAtIEluc3RhbGwgZnJvbSBzcGVjaWZpY1xuICAgICAgICAgIG1hcmtldHBsYWNlXG4gICAgICAgIDwvVGV4dD5cbiAgICAgICAgPFRleHQ+IC9wbHVnaW4gaW5zdGFsbCAmbHQ7cGx1Z2luJmd0OyAtIEluc3RhbGwgc3BlY2lmaWMgcGx1Z2luPC9UZXh0PlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICB7JyAnfVxuICAgICAgICAgIC9wbHVnaW4gaW5zdGFsbCAmbHQ7cGx1Z2luJmd0O0AmbHQ7bWFya2V0Jmd0OyAtIEluc3RhbGwgcGx1Z2luIGZyb21cbiAgICAgICAgICBtYXJrZXRwbGFjZVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIDxUZXh0PiA8L1RleHQ+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPk1hbmFnZW1lbnQ6PC9UZXh0PlxuICAgICAgICA8VGV4dD4gL3BsdWdpbiBtYW5hZ2UgLSBNYW5hZ2UgaW5zdGFsbGVkIHBsdWdpbnM8L1RleHQ+XG4gICAgICAgIDxUZXh0PiAvcGx1Z2luIGVuYWJsZSAmbHQ7cGx1Z2luJmd0OyAtIEVuYWJsZSBhIHBsdWdpbjwvVGV4dD5cbiAgICAgICAgPFRleHQ+IC9wbHVnaW4gZGlzYWJsZSAmbHQ7cGx1Z2luJmd0OyAtIERpc2FibGUgYSBwbHVnaW48L1RleHQ+XG4gICAgICAgIDxUZXh0PiAvcGx1Z2luIHVuaW5zdGFsbCAmbHQ7cGx1Z2luJmd0OyAtIFVuaW5zdGFsbCBhIHBsdWdpbjwvVGV4dD5cbiAgICAgICAgPFRleHQ+IDwvVGV4dD5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+TWFya2V0cGxhY2VzOjwvVGV4dD5cbiAgICAgICAgPFRleHQ+IC9wbHVnaW4gbWFya2V0cGxhY2UgLSBNYXJrZXRwbGFjZSBtYW5hZ2VtZW50IG1lbnU8L1RleHQ+XG4gICAgICAgIDxUZXh0PiAvcGx1Z2luIG1hcmtldHBsYWNlIGFkZCAtIEFkZCBhIG1hcmtldHBsYWNlPC9UZXh0PlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICB7JyAnfVxuICAgICAgICAgIC9wbHVnaW4gbWFya2V0cGxhY2UgYWRkICZsdDtwYXRoL3VybCZndDsgLSBBZGQgbWFya2V0cGxhY2UgZGlyZWN0bHlcbiAgICAgICAgPC9UZXh0PlxuICAgICAgICA8VGV4dD4gL3BsdWdpbiBtYXJrZXRwbGFjZSB1cGRhdGUgLSBVcGRhdGUgbWFya2V0cGxhY2VzPC9UZXh0PlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICB7JyAnfVxuICAgICAgICAgIC9wbHVnaW4gbWFya2V0cGxhY2UgdXBkYXRlICZsdDtuYW1lJmd0OyAtIFVwZGF0ZSBzcGVjaWZpYyBtYXJrZXRwbGFjZVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIDxUZXh0PiAvcGx1Z2luIG1hcmtldHBsYWNlIHJlbW92ZSAtIFJlbW92ZSBhIG1hcmtldHBsYWNlPC9UZXh0PlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICB7JyAnfVxuICAgICAgICAgIC9wbHVnaW4gbWFya2V0cGxhY2UgcmVtb3ZlICZsdDtuYW1lJmd0OyAtIFJlbW92ZSBzcGVjaWZpYyBtYXJrZXRwbGFjZVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIDxUZXh0PiAvcGx1Z2luIG1hcmtldHBsYWNlIGxpc3QgLSBMaXN0IGFsbCBtYXJrZXRwbGFjZXM8L1RleHQ+XG4gICAgICAgIDxUZXh0PiA8L1RleHQ+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPlZhbGlkYXRpb246PC9UZXh0PlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICB7JyAnfVxuICAgICAgICAgIC9wbHVnaW4gdmFsaWRhdGUgJmx0O3BhdGgmZ3Q7IC0gVmFsaWRhdGUgYSBtYW5pZmVzdCBmaWxlIG9yIGRpcmVjdG9yeVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIDxUZXh0PiA8L1RleHQ+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPk90aGVyOjwvVGV4dD5cbiAgICAgICAgPFRleHQ+IC9wbHVnaW4gLSBNYWluIHBsdWdpbiBtZW51PC9UZXh0PlxuICAgICAgICA8VGV4dD4gL3BsdWdpbiBoZWxwIC0gU2hvdyB0aGlzIGhlbHA8L1RleHQ+XG4gICAgICAgIDxUZXh0PiAvcGx1Z2lucyAtIEFsaWFzIGZvciAvcGx1Z2luPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgaWYgKHZpZXdTdGF0ZS50eXBlID09PSAndmFsaWRhdGUnKSB7XG4gICAgcmV0dXJuIDxWYWxpZGF0ZVBsdWdpbiBvbkNvbXBsZXRlPXtvbkNvbXBsZXRlfSBwYXRoPXt2aWV3U3RhdGUucGF0aH0gLz5cbiAgfVxuXG4gIGlmICh2aWV3U3RhdGUudHlwZSA9PT0gJ21hcmtldHBsYWNlLW1lbnUnKSB7XG4gICAgLy8gU2hvdyBhIHNpbXBsZSBtZW51IGZvciBtYXJrZXRwbGFjZSBvcGVyYXRpb25zXG4gICAgc2V0Vmlld1N0YXRlKHsgdHlwZTogJ21lbnUnIH0pXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGlmICh2aWV3U3RhdGUudHlwZSA9PT0gJ21hcmtldHBsYWNlLWxpc3QnKSB7XG4gICAgcmV0dXJuIDxNYXJrZXRwbGFjZUxpc3Qgb25Db21wbGV0ZT17b25Db21wbGV0ZX0gLz5cbiAgfVxuXG4gIGlmICh2aWV3U3RhdGUudHlwZSA9PT0gJ2FkZC1tYXJrZXRwbGFjZScpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEFkZE1hcmtldHBsYWNlXG4gICAgICAgIGlucHV0VmFsdWU9e2lucHV0VmFsdWV9XG4gICAgICAgIHNldElucHV0VmFsdWU9e3NldElucHV0VmFsdWV9XG4gICAgICAgIGN1cnNvck9mZnNldD17Y3Vyc29yT2Zmc2V0fVxuICAgICAgICBzZXRDdXJzb3JPZmZzZXQ9e3NldEN1cnNvck9mZnNldH1cbiAgICAgICAgZXJyb3I9e2Vycm9yfVxuICAgICAgICBzZXRFcnJvcj17c2V0RXJyb3J9XG4gICAgICAgIHJlc3VsdD17cmVzdWx0fVxuICAgICAgICBzZXRSZXN1bHQ9e3NldFJlc3VsdH1cbiAgICAgICAgc2V0Vmlld1N0YXRlPXtzZXRWaWV3U3RhdGV9XG4gICAgICAgIG9uQWRkQ29tcGxldGU9e21hcmtQbHVnaW5zQ2hhbmdlZH1cbiAgICAgICAgY2xpTW9kZT17Y2xpTW9kZX1cbiAgICAgIC8+XG4gICAgKVxuICB9XG4gIC8vIFJlbmRlciB0YWJiZWQgaW50ZXJmYWNlIHVzaW5nIHRoZSBkZXNpZ24gc3lzdGVtIFRhYnMgY29tcG9uZW50XG4gIHJldHVybiAoXG4gICAgPFBhbmUgY29sb3I9XCJzdWdnZXN0aW9uXCI+XG4gICAgICA8VGFic1xuICAgICAgICB0aXRsZT1cIlBsdWdpbnNcIlxuICAgICAgICBzZWxlY3RlZFRhYj17YWN0aXZlVGFifVxuICAgICAgICBvblRhYkNoYW5nZT17aGFuZGxlVGFiQ2hhbmdlfVxuICAgICAgICBjb2xvcj1cInN1Z2dlc3Rpb25cIlxuICAgICAgICBkaXNhYmxlTmF2aWdhdGlvbj17Y2hpbGRTZWFyY2hBY3RpdmV9XG4gICAgICAgIGJhbm5lcj17XG4gICAgICAgICAgc2hvd01jcFJlZGlyZWN0TWVzc2FnZSAmJiBhY3RpdmVUYWIgPT09ICdpbnN0YWxsZWQnID8gKFxuICAgICAgICAgICAgPE1jcFJlZGlyZWN0QmFubmVyIC8+XG4gICAgICAgICAgKSA6IHVuZGVmaW5lZFxuICAgICAgICB9XG4gICAgICA+XG4gICAgICAgIDxUYWIgaWQ9XCJkaXNjb3ZlclwiIHRpdGxlPVwiRGlzY292ZXJcIj5cbiAgICAgICAgICB7dmlld1N0YXRlLnR5cGUgPT09ICdicm93c2UtbWFya2V0cGxhY2UnID8gKFxuICAgICAgICAgICAgPEJyb3dzZU1hcmtldHBsYWNlXG4gICAgICAgICAgICAgIGVycm9yPXtlcnJvcn1cbiAgICAgICAgICAgICAgc2V0RXJyb3I9e3NldEVycm9yfVxuICAgICAgICAgICAgICByZXN1bHQ9e3Jlc3VsdH1cbiAgICAgICAgICAgICAgc2V0UmVzdWx0PXtzZXRSZXN1bHR9XG4gICAgICAgICAgICAgIHNldFZpZXdTdGF0ZT17c2V0Vmlld1N0YXRlfVxuICAgICAgICAgICAgICBvbkluc3RhbGxDb21wbGV0ZT17bWFya1BsdWdpbnNDaGFuZ2VkfVxuICAgICAgICAgICAgICB0YXJnZXRNYXJrZXRwbGFjZT17dmlld1N0YXRlLnRhcmdldE1hcmtldHBsYWNlfVxuICAgICAgICAgICAgICB0YXJnZXRQbHVnaW49e3ZpZXdTdGF0ZS50YXJnZXRQbHVnaW59XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8RGlzY292ZXJQbHVnaW5zXG4gICAgICAgICAgICAgIGVycm9yPXtlcnJvcn1cbiAgICAgICAgICAgICAgc2V0RXJyb3I9e3NldEVycm9yfVxuICAgICAgICAgICAgICByZXN1bHQ9e3Jlc3VsdH1cbiAgICAgICAgICAgICAgc2V0UmVzdWx0PXtzZXRSZXN1bHR9XG4gICAgICAgICAgICAgIHNldFZpZXdTdGF0ZT17c2V0Vmlld1N0YXRlfVxuICAgICAgICAgICAgICBvbkluc3RhbGxDb21wbGV0ZT17bWFya1BsdWdpbnNDaGFuZ2VkfVxuICAgICAgICAgICAgICBvblNlYXJjaE1vZGVDaGFuZ2U9e3NldENoaWxkU2VhcmNoQWN0aXZlfVxuICAgICAgICAgICAgICB0YXJnZXRQbHVnaW49e1xuICAgICAgICAgICAgICAgIHZpZXdTdGF0ZS50eXBlID09PSAnZGlzY292ZXItcGx1Z2lucydcbiAgICAgICAgICAgICAgICAgID8gdmlld1N0YXRlLnRhcmdldFBsdWdpblxuICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApfVxuICAgICAgICA8L1RhYj5cbiAgICAgICAgPFRhYiBpZD1cImluc3RhbGxlZFwiIHRpdGxlPVwiSW5zdGFsbGVkXCI+XG4gICAgICAgICAgPE1hbmFnZVBsdWdpbnNcbiAgICAgICAgICAgIHNldFZpZXdTdGF0ZT17c2V0Vmlld1N0YXRlfVxuICAgICAgICAgICAgc2V0UmVzdWx0PXtzZXRSZXN1bHR9XG4gICAgICAgICAgICBvbk1hbmFnZUNvbXBsZXRlPXttYXJrUGx1Z2luc0NoYW5nZWR9XG4gICAgICAgICAgICBvblNlYXJjaE1vZGVDaGFuZ2U9e3NldENoaWxkU2VhcmNoQWN0aXZlfVxuICAgICAgICAgICAgdGFyZ2V0UGx1Z2luPXtcbiAgICAgICAgICAgICAgdmlld1N0YXRlLnR5cGUgPT09ICdtYW5hZ2UtcGx1Z2lucydcbiAgICAgICAgICAgICAgICA/IHZpZXdTdGF0ZS50YXJnZXRQbHVnaW5cbiAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGFyZ2V0TWFya2V0cGxhY2U9e1xuICAgICAgICAgICAgICB2aWV3U3RhdGUudHlwZSA9PT0gJ21hbmFnZS1wbHVnaW5zJ1xuICAgICAgICAgICAgICAgID8gdmlld1N0YXRlLnRhcmdldE1hcmtldHBsYWNlXG4gICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFjdGlvbj17XG4gICAgICAgICAgICAgIHZpZXdTdGF0ZS50eXBlID09PSAnbWFuYWdlLXBsdWdpbnMnID8gdmlld1N0YXRlLmFjdGlvbiA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvVGFiPlxuICAgICAgICA8VGFiIGlkPVwibWFya2V0cGxhY2VzXCIgdGl0bGU9XCJNYXJrZXRwbGFjZXNcIj5cbiAgICAgICAgICA8TWFuYWdlTWFya2V0cGxhY2VzXG4gICAgICAgICAgICBzZXRWaWV3U3RhdGU9e3NldFZpZXdTdGF0ZX1cbiAgICAgICAgICAgIGVycm9yPXtlcnJvcn1cbiAgICAgICAgICAgIHNldEVycm9yPXtzZXRFcnJvcn1cbiAgICAgICAgICAgIHNldFJlc3VsdD17c2V0UmVzdWx0fVxuICAgICAgICAgICAgZXhpdFN0YXRlPXtleGl0U3RhdGV9XG4gICAgICAgICAgICBvbk1hbmFnZUNvbXBsZXRlPXttYXJrUGx1Z2luc0NoYW5nZWR9XG4gICAgICAgICAgICB0YXJnZXRNYXJrZXRwbGFjZT17XG4gICAgICAgICAgICAgIHZpZXdTdGF0ZS50eXBlID09PSAnbWFuYWdlLW1hcmtldHBsYWNlcydcbiAgICAgICAgICAgICAgICA/IHZpZXdTdGF0ZS50YXJnZXRNYXJrZXRwbGFjZVxuICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhY3Rpb249e1xuICAgICAgICAgICAgICB2aWV3U3RhdGUudHlwZSA9PT0gJ21hbmFnZS1tYXJrZXRwbGFjZXMnXG4gICAgICAgICAgICAgICAgPyB2aWV3U3RhdGUuYWN0aW9uXG4gICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAvPlxuICAgICAgICA8L1RhYj5cbiAgICAgICAgPFRhYiBpZD1cImVycm9yc1wiIHRpdGxlPXtlcnJvcnNUYWJUaXRsZX0+XG4gICAgICAgICAgPEVycm9yc1RhYkNvbnRlbnRcbiAgICAgICAgICAgIHNldFZpZXdTdGF0ZT17c2V0Vmlld1N0YXRlfVxuICAgICAgICAgICAgc2V0QWN0aXZlVGFiPXtzZXRBY3RpdmVUYWJ9XG4gICAgICAgICAgICBtYXJrUGx1Z2luc0NoYW5nZWQ9e21hcmtQbHVnaW5zQ2hhbmdlZH1cbiAgICAgICAgICAvPlxuICAgICAgICA8L1RhYj5cbiAgICAgIDwvVGFicz5cbiAgICA8L1BhbmU+XG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU9BLE9BQU8sTUFBTSxTQUFTO0FBQzdCLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsV0FBVyxFQUFFQyxTQUFTLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ3hELFNBQVNDLHdCQUF3QixRQUFRLDhDQUE4QztBQUN2RixTQUFTQyxNQUFNLFFBQVEsMENBQTBDO0FBQ2pFLFNBQVNDLElBQUksUUFBUSx3Q0FBd0M7QUFDN0QsU0FBU0MsR0FBRyxFQUFFQyxJQUFJLFFBQVEsd0NBQXdDO0FBQ2xFLFNBQVNDLDhCQUE4QixRQUFRLCtDQUErQztBQUM5RixTQUFTQyxHQUFHLEVBQUVDLElBQUksUUFBUSxjQUFjO0FBQ3hDLFNBQ0VDLGFBQWEsRUFDYkMsY0FBYyxRQUNULG9DQUFvQztBQUMzQyxTQUFTQyxXQUFXLEVBQUVDLGNBQWMsUUFBUSx5QkFBeUI7QUFDckUsY0FBY0MsV0FBVyxRQUFRLHVCQUF1QjtBQUN4RCxTQUFTQyxZQUFZLFFBQVEsdUJBQXVCO0FBQ3BELFNBQVNDLGNBQWMsUUFBUSxtQ0FBbUM7QUFDbEUsU0FBU0MsdUNBQXVDLFFBQVEsMkNBQTJDO0FBQ25HLFNBQ0VDLDJCQUEyQixFQUMzQkMsdUJBQXVCLFFBQ2xCLDJDQUEyQztBQUNsRCxTQUFTQyx1QkFBdUIsUUFBUSwyQ0FBMkM7QUFDbkYsY0FBY0MscUJBQXFCLFFBQVEsbUNBQW1DO0FBQzlFLFNBQ0VDLG9CQUFvQixFQUNwQkMsdUJBQXVCLFFBQ2xCLGtDQUFrQztBQUN6QyxTQUFTQyxjQUFjLFFBQVEscUJBQXFCO0FB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