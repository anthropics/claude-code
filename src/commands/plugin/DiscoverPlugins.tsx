import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js';
import { Byline } from '../../components/design-system/Byline.js';
import { SearchBox } from '../../components/SearchBox.js';
import { useSearchInput } from '../../hooks/useSearchInput.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- useInput needed for raw search mode text input
import { Box, Text, useInput, useTerminalFocus } from '../../ink.js';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding.js';
import type { LoadedPlugin } from '../../types/plugin.js';
import { count } from '../../utils/array.js';
import { openBrowser } from '../../utils/browser.js';
import { logForDebugging } from '../../utils/debug.js';
import { errorMessage } from '../../utils/errors.js';
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js';
import { formatInstallCount, getInstallCounts } from '../../utils/plugins/installCounts.js';
import { isPluginGloballyInstalled } from '../../utils/plugins/installedPluginsManager.js';
import { createPluginId, detectEmptyMarketplaceReason, type EmptyMarketplaceReason, formatFailureDetails, formatMarketplaceLoadingErrors, loadMarketplacesWithGracefulDegradation } from '../../utils/plugins/marketplaceHelpers.js';
import { loadKnownMarketplacesConfig } from '../../utils/plugins/marketplaceManager.js';
import { OFFICIAL_MARKETPLACE_NAME } from '../../utils/plugins/officialMarketplace.js';
import { installPluginFromMarketplace } from '../../utils/plugins/pluginInstallationHelpers.js';
import { isPluginBlockedByPolicy } from '../../utils/plugins/pluginPolicy.js';
import { plural } from '../../utils/stringUtils.js';
import { truncateToWidth } from '../../utils/truncate.js';
import { findPluginOptionsTarget, PluginOptionsFlow } from './PluginOptionsFlow.js';
import { PluginTrustWarning } from './PluginTrustWarning.js';
import { buildPluginDetailsMenuOptions, extractGitHubRepo, type InstallablePlugin } from './pluginDetailsHelpers.js';
import type { ViewState as ParentViewState } from './types.js';
import { usePagination } from './usePagination.js';
type Props = {
  error: string | null;
  setError: (error: string | null) => void;
  result: string | null;
  setResult: (result: string | null) => void;
  setViewState: (state: ParentViewState) => void;
  onInstallComplete?: () => void | Promise<void>;
  onSearchModeChange?: (isActive: boolean) => void;
  targetPlugin?: string;
};
type ViewState = 'plugin-list' | 'plugin-details' | {
  type: 'plugin-options';
  plugin: LoadedPlugin;
  pluginId: string;
};
export function DiscoverPlugins({
  error,
  setError,
  result: _result,
  setResult,
  setViewState: setParentViewState,
  onInstallComplete,
  onSearchModeChange,
  targetPlugin
}: Props): React.ReactNode {
  // View state
  const [viewState, setViewState] = useState<ViewState>('plugin-list');
  const [selectedPlugin, setSelectedPlugin] = useState<InstallablePlugin | null>(null);

  // Data state
  const [availablePlugins, setAvailablePlugins] = useState<InstallablePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [installCounts, setInstallCounts] = useState<Map<string, number> | null>(null);

  // Search state
  const [isSearchMode, setIsSearchModeRaw] = useState(false);
  const setIsSearchMode = useCallback((active: boolean) => {
    setIsSearchModeRaw(active);
    onSearchModeChange?.(active);
  }, [onSearchModeChange]);
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    cursorOffset: searchCursorOffset
  } = useSearchInput({
    isActive: viewState === 'plugin-list' && isSearchMode && !loading,
    onExit: () => {
      setIsSearchMode(false);
    }
  });
  const isTerminalFocused = useTerminalFocus();
  const {
    columns: terminalWidth
  } = useTerminalSize();

  // Filter plugins based on search query
  const filteredPlugins = useMemo(() => {
    if (!searchQuery) return availablePlugins;
    const lowerQuery = searchQuery.toLowerCase();
    return availablePlugins.filter(plugin => plugin.entry.name.toLowerCase().includes(lowerQuery) || plugin.entry.description?.toLowerCase().includes(lowerQuery) || plugin.marketplaceName.toLowerCase().includes(lowerQuery));
  }, [availablePlugins, searchQuery]);

  // Selection state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedForInstall, setSelectedForInstall] = useState<Set<string>>(new Set());
  const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set());

  // Pagination for plugin list (continuous scrolling)
  const pagination = usePagination<InstallablePlugin>({
    totalItems: filteredPlugins.length,
    selectedIndex
  });

  // Reset selection when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Details view state
  const [detailsMenuIndex, setDetailsMenuIndex] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  // Warning state for non-critical errors
  const [warning, setWarning] = useState<string | null>(null);

  // Empty state reason
  const [emptyReason, setEmptyReason] = useState<EmptyMarketplaceReason | null>(null);

  // Load all plugins from all marketplaces
  useEffect(() => {
    async function loadAllPlugins() {
      try {
        const config = await loadKnownMarketplacesConfig();

        // Load marketplaces with graceful degradation
        const {
          marketplaces,
          failures
        } = await loadMarketplacesWithGracefulDegradation(config);

        // Collect all plugins from all marketplaces
        const allPlugins: InstallablePlugin[] = [];
        for (const {
          name,
          data: marketplace
        } of marketplaces) {
          if (marketplace) {
            for (const entry of marketplace.plugins) {
              const pluginId = createPluginId(entry.name, name);
              allPlugins.push({
                entry,
                marketplaceName: name,
                pluginId,
                // Only block when globally installed (user/managed scope).
                // Project/local-scope installs don't block — user may want to
                // promote to user scope so it's available everywhere (gh-29997).
                isInstalled: isPluginGloballyInstalled(pluginId)
              });
            }
          }
        }

        // Filter out installed and policy-blocked plugins
        const uninstalledPlugins = allPlugins.filter(p => !p.isInstalled && !isPluginBlockedByPolicy(p.pluginId));

        // Fetch install counts and sort by popularity
        try {
          const counts = await getInstallCounts();
          setInstallCounts(counts);
          if (counts) {
            // Sort by install count (descending), then alphabetically
            uninstalledPlugins.sort((a_0, b_0) => {
              const countA = counts.get(a_0.pluginId) ?? 0;
              const countB = counts.get(b_0.pluginId) ?? 0;
              if (countA !== countB) return countB - countA;
              return a_0.entry.name.localeCompare(b_0.entry.name);
            });
          } else {
            // No counts available - sort alphabetically
            uninstalledPlugins.sort((a_1, b_1) => a_1.entry.name.localeCompare(b_1.entry.name));
          }
        } catch (error_0) {
          // Log the error, then gracefully degrade to alphabetical sort
          logForDebugging(`Failed to fetch install counts: ${errorMessage(error_0)}`);
          uninstalledPlugins.sort((a, b) => a.entry.name.localeCompare(b.entry.name));
        }
        setAvailablePlugins(uninstalledPlugins);

        // Detect empty reason if no plugins available
        const configuredCount = Object.keys(config).length;
        if (uninstalledPlugins.length === 0) {
          const reason = await detectEmptyMarketplaceReason({
            configuredMarketplaceCount: configuredCount,
            failedMarketplaceCount: failures.length
          });
          setEmptyReason(reason);
        }

        // Handle marketplace loading errors/warnings
        const successCount = count(marketplaces, m => m.data !== null);
        const errorResult = formatMarketplaceLoadingErrors(failures, successCount);
        if (errorResult) {
          if (errorResult.type === 'warning') {
            setWarning(errorResult.message + '. Showing available plugins.');
          } else {
            throw new Error(errorResult.message);
          }
        }

        // Handle targetPlugin - navigate directly to plugin details
        // Search in allPlugins (before filtering) to handle installed plugins gracefully
        if (targetPlugin) {
          const foundPlugin = allPlugins.find(p_0 => p_0.entry.name === targetPlugin);
          if (foundPlugin) {
            if (foundPlugin.isInstalled) {
              setError(`Plugin '${foundPlugin.pluginId}' is already installed. Use '/plugin' to manage existing plugins.`);
            } else {
              setSelectedPlugin(foundPlugin);
              setViewState('plugin-details');
            }
          } else {
            setError(`Plugin "${targetPlugin}" not found in any marketplace`);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plugins');
      } finally {
        setLoading(false);
      }
    }
    void loadAllPlugins();
  }, [setError, targetPlugin]);

  // Install selected plugins
  const installSelectedPlugins = async () => {
    if (selectedForInstall.size === 0) return;
    const pluginsToInstall = availablePlugins.filter(p_1 => selectedForInstall.has(p_1.pluginId));
    setInstallingPlugins(new Set(pluginsToInstall.map(p_2 => p_2.pluginId)));
    let successCount_0 = 0;
    let failureCount = 0;
    const newFailedPlugins: Array<{
      name: string;
      reason: string;
    }> = [];
    for (const plugin_0 of pluginsToInstall) {
      const result = await installPluginFromMarketplace({
        pluginId: plugin_0.pluginId,
        entry: plugin_0.entry,
        marketplaceName: plugin_0.marketplaceName,
        scope: 'user'
      });
      if (result.success) {
        successCount_0++;
      } else {
        failureCount++;
        newFailedPlugins.push({
          name: plugin_0.entry.name,
          reason: result.error
        });
      }
    }
    setInstallingPlugins(new Set());
    setSelectedForInstall(new Set());
    clearAllCaches();

    // Handle installation results
    if (failureCount === 0) {
      const message = `✓ Installed ${successCount_0} ${plural(successCount_0, 'plugin')}. ` + `Run /reload-plugins to activate.`;
      setResult(message);
    } else if (successCount_0 === 0) {
      setError(`Failed to install: ${formatFailureDetails(newFailedPlugins, true)}`);
    } else {
      const message_0 = `✓ Installed ${successCount_0} of ${successCount_0 + failureCount} plugins. ` + `Failed: ${formatFailureDetails(newFailedPlugins, false)}. ` + `Run /reload-plugins to activate successfully installed plugins.`;
      setResult(message_0);
    }
    if (successCount_0 > 0) {
      if (onInstallComplete) {
        await onInstallComplete();
      }
    }
    setParentViewState({
      type: 'menu'
    });
  };

  // Install single plugin from details view
  const handleSinglePluginInstall = async (plugin_1: InstallablePlugin, scope: 'user' | 'project' | 'local' = 'user') => {
    setIsInstalling(true);
    setInstallError(null);
    const result_0 = await installPluginFromMarketplace({
      pluginId: plugin_1.pluginId,
      entry: plugin_1.entry,
      marketplaceName: plugin_1.marketplaceName,
      scope
    });
    if (result_0.success) {
      const loaded = await findPluginOptionsTarget(plugin_1.pluginId);
      if (loaded) {
        setIsInstalling(false);
        setViewState({
          type: 'plugin-options',
          plugin: loaded,
          pluginId: plugin_1.pluginId
        });
        return;
      }
      setResult(result_0.message);
      if (onInstallComplete) {
        await onInstallComplete();
      }
      setParentViewState({
        type: 'menu'
      });
    } else {
      setIsInstalling(false);
      setInstallError(result_0.error);
    }
  };

  // Handle error state
  useEffect(() => {
    if (error) {
      setResult(error);
    }
  }, [error, setResult]);

  // Escape in plugin-details view - go back to plugin-list
  useKeybinding('confirm:no', () => {
    setViewState('plugin-list');
    setSelectedPlugin(null);
  }, {
    context: 'Confirmation',
    isActive: viewState === 'plugin-details'
  });

  // Escape in plugin-list view (not search mode) - exit to parent menu
  useKeybinding('confirm:no', () => {
    setParentViewState({
      type: 'menu'
    });
  }, {
    context: 'Confirmation',
    isActive: viewState === 'plugin-list' && !isSearchMode
  });

  // Handle entering search mode (non-escape keys)
  useInput((input, _key) => {
    const keyIsNotCtrlOrMeta = !_key.ctrl && !_key.meta;
    if (!isSearchMode) {
      // Enter search mode with '/' or any printable character
      if (input === '/' && keyIsNotCtrlOrMeta) {
        setIsSearchMode(true);
        setSearchQuery('');
      } else if (keyIsNotCtrlOrMeta && input.length > 0 && !/^\s+$/.test(input) &&
      // Don't enter search mode for navigation keys
      input !== 'j' && input !== 'k' && input !== 'i') {
        setIsSearchMode(true);
        setSearchQuery(input);
      }
    }
  }, {
    isActive: viewState === 'plugin-list' && !loading
  });

  // Plugin-list navigation (non-search mode)
  useKeybindings({
    'select:previous': () => {
      if (selectedIndex === 0) {
        setIsSearchMode(true);
      } else {
        pagination.handleSelectionChange(selectedIndex - 1, setSelectedIndex);
      }
    },
    'select:next': () => {
      if (selectedIndex < filteredPlugins.length - 1) {
        pagination.handleSelectionChange(selectedIndex + 1, setSelectedIndex);
      }
    },
    'select:accept': () => {
      if (selectedIndex === filteredPlugins.length && selectedForInstall.size > 0) {
        void installSelectedPlugins();
      } else if (selectedIndex < filteredPlugins.length) {
        const plugin_2 = filteredPlugins[selectedIndex];
        if (plugin_2) {
          if (plugin_2.isInstalled) {
            setParentViewState({
              type: 'manage-plugins',
              targetPlugin: plugin_2.entry.name,
              targetMarketplace: plugin_2.marketplaceName
            });
          } else {
            setSelectedPlugin(plugin_2);
            setViewState('plugin-details');
            setDetailsMenuIndex(0);
            setInstallError(null);
          }
        }
      }
    }
  }, {
    context: 'Select',
    isActive: viewState === 'plugin-list' && !isSearchMode
  });
  useKeybindings({
    'plugin:toggle': () => {
      if (selectedIndex < filteredPlugins.length) {
        const plugin_3 = filteredPlugins[selectedIndex];
        if (plugin_3 && !plugin_3.isInstalled) {
          const newSelection = new Set(selectedForInstall);
          if (newSelection.has(plugin_3.pluginId)) {
            newSelection.delete(plugin_3.pluginId);
          } else {
            newSelection.add(plugin_3.pluginId);
          }
          setSelectedForInstall(newSelection);
        }
      }
    },
    'plugin:install': () => {
      if (selectedForInstall.size > 0) {
        void installSelectedPlugins();
      }
    }
  }, {
    context: 'Plugin',
    isActive: viewState === 'plugin-list' && !isSearchMode
  });

  // Plugin-details navigation
  const detailsMenuOptions = React.useMemo(() => {
    if (!selectedPlugin) return [];
    const hasHomepage = selectedPlugin.entry.homepage;
    const githubRepo = extractGitHubRepo(selectedPlugin);
    return buildPluginDetailsMenuOptions(hasHomepage, githubRepo);
  }, [selectedPlugin]);
  useKeybindings({
    'select:previous': () => {
      if (detailsMenuIndex > 0) {
        setDetailsMenuIndex(detailsMenuIndex - 1);
      }
    },
    'select:next': () => {
      if (detailsMenuIndex < detailsMenuOptions.length - 1) {
        setDetailsMenuIndex(detailsMenuIndex + 1);
      }
    },
    'select:accept': () => {
      if (!selectedPlugin) return;
      const action = detailsMenuOptions[detailsMenuIndex]?.action;
      const hasHomepage_0 = selectedPlugin.entry.homepage;
      const githubRepo_0 = extractGitHubRepo(selectedPlugin);
      if (action === 'install-user') {
        void handleSinglePluginInstall(selectedPlugin, 'user');
      } else if (action === 'install-project') {
        void handleSinglePluginInstall(selectedPlugin, 'project');
      } else if (action === 'install-local') {
        void handleSinglePluginInstall(selectedPlugin, 'local');
      } else if (action === 'homepage' && hasHomepage_0) {
        void openBrowser(hasHomepage_0);
      } else if (action === 'github' && githubRepo_0) {
        void openBrowser(`https://github.com/${githubRepo_0}`);
      } else if (action === 'back') {
        setViewState('plugin-list');
        setSelectedPlugin(null);
      }
    }
  }, {
    context: 'Select',
    isActive: viewState === 'plugin-details' && !!selectedPlugin
  });
  if (typeof viewState === 'object' && viewState.type === 'plugin-options') {
    const {
      plugin: plugin_4,
      pluginId: pluginId_0
    } = viewState;
    function finish(msg: string): void {
      setResult(msg);
      if (onInstallComplete) {
        void onInstallComplete();
      }
      setParentViewState({
        type: 'menu'
      });
    }
    return <PluginOptionsFlow plugin={plugin_4} pluginId={pluginId_0} onDone={(outcome, detail) => {
      switch (outcome) {
        case 'configured':
          finish(`✓ Installed and configured ${plugin_4.name}. Run /reload-plugins to apply.`);
          break;
        case 'skipped':
          finish(`✓ Installed ${plugin_4.name}. Run /reload-plugins to apply.`);
          break;
        case 'error':
          finish(`Installed but failed to save config: ${detail}`);
          break;
      }
    }} />;
  }

  // Loading state
  if (loading) {
    return <Text>Loading…</Text>;
  }

  // Error state
  if (error) {
    return <Text color="error">{error}</Text>;
  }

  // Plugin details view
  if (viewState === 'plugin-details' && selectedPlugin) {
    const hasHomepage_1 = selectedPlugin.entry.homepage;
    const githubRepo_1 = extractGitHubRepo(selectedPlugin);
    const menuOptions = buildPluginDetailsMenuOptions(hasHomepage_1, githubRepo_1);
    return <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Plugin details</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text bold>{selectedPlugin.entry.name}</Text>
          <Text dimColor>from {selectedPlugin.marketplaceName}</Text>
          {selectedPlugin.entry.version && <Text dimColor>Version: {selectedPlugin.entry.version}</Text>}
          {selectedPlugin.entry.description && <Box marginTop={1}>
              <Text>{selectedPlugin.entry.description}</Text>
            </Box>}
          {selectedPlugin.entry.author && <Box marginTop={1}>
              <Text dimColor>
                By:{' '}
                {typeof selectedPlugin.entry.author === 'string' ? selectedPlugin.entry.author : selectedPlugin.entry.author.name}
              </Text>
            </Box>}
        </Box>

        <PluginTrustWarning />

        {installError && <Box marginBottom={1}>
            <Text color="error">Error: {installError}</Text>
          </Box>}

        <Box flexDirection="column">
          {menuOptions.map((option, index) => <Box key={option.action}>
              {detailsMenuIndex === index && <Text>{'> '}</Text>}
              {detailsMenuIndex !== index && <Text>{'  '}</Text>}
              <Text bold={detailsMenuIndex === index}>
                {isInstalling && option.action.startsWith('install-') ? 'Installing…' : option.label}
              </Text>
            </Box>)}
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            <Byline>
              <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="select" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
            </Byline>
          </Text>
        </Box>
      </Box>;
  }

  // Empty state
  if (availablePlugins.length === 0) {
    return <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Discover plugins</Text>
        </Box>
        <EmptyStateMessage reason={emptyReason} />
        <Box marginTop={1}>
          <Text dimColor italic>
            Esc to go back
          </Text>
        </Box>
      </Box>;
  }

  // Get visible plugins from pagination
  const visiblePlugins = pagination.getVisibleItems(filteredPlugins);
  return <Box flexDirection="column">
      <Box>
        <Text bold>Discover plugins</Text>
        {pagination.needsPagination && <Text dimColor>
            {' '}
            ({pagination.scrollPosition.current}/
            {pagination.scrollPosition.total})
          </Text>}
      </Box>

      {/* Search box */}
      <Box marginBottom={1}>
        <SearchBox query={searchQuery} isFocused={isSearchMode} isTerminalFocused={isTerminalFocused} width={terminalWidth - 4} cursorOffset={searchCursorOffset} />
      </Box>

      {/* Warning banner */}
      {warning && <Box marginBottom={1}>
          <Text color="warning">
            {figures.warning} {warning}
          </Text>
        </Box>}

      {/* No search results */}
      {filteredPlugins.length === 0 && searchQuery && <Box marginBottom={1}>
          <Text dimColor>No plugins match &quot;{searchQuery}&quot;</Text>
        </Box>}

      {/* Scroll up indicator */}
      {pagination.scrollPosition.canScrollUp && <Box>
          <Text dimColor> {figures.arrowUp} more above</Text>
        </Box>}

      {/* Plugin list - use startIndex in key to force re-render on scroll */}
      {visiblePlugins.map((plugin_5, visibleIndex) => {
      const actualIndex = pagination.toActualIndex(visibleIndex);
      const isSelected = selectedIndex === actualIndex;
      const isSelectedForInstall = selectedForInstall.has(plugin_5.pluginId);
      const isInstallingThis = installingPlugins.has(plugin_5.pluginId);
      const isLast = visibleIndex === visiblePlugins.length - 1;
      return <Box key={`${pagination.startIndex}-${plugin_5.pluginId}`} flexDirection="column" marginBottom={isLast && !error ? 0 : 1}>
            <Box>
              <Text color={isSelected && !isSearchMode ? 'suggestion' : undefined}>
                {isSelected && !isSearchMode ? figures.pointer : ' '}{' '}
              </Text>
              <Text>
                {isInstallingThis ? figures.ellipsis : isSelectedForInstall ? figures.radioOn : figures.radioOff}{' '}
                {plugin_5.entry.name}
                <Text dimColor> · {plugin_5.marketplaceName}</Text>
                {plugin_5.entry.tags?.includes('community-managed') && <Text dimColor> [Community Managed]</Text>}
                {installCounts && plugin_5.marketplaceName === OFFICIAL_MARKETPLACE_NAME && <Text dimColor>
                      {' · '}
                      {formatInstallCount(installCounts.get(plugin_5.pluginId) ?? 0)}{' '}
                      installs
                    </Text>}
              </Text>
            </Box>
            {plugin_5.entry.description && <Box marginLeft={4}>
                <Text dimColor>
                  {truncateToWidth(plugin_5.entry.description, 60)}
                </Text>
              </Box>}
          </Box>;
    })}

      {/* Scroll down indicator */}
      {pagination.scrollPosition.canScrollDown && <Box>
          <Text dimColor> {figures.arrowDown} more below</Text>
        </Box>}

      {/* Error messages */}
      {error && <Box marginTop={1}>
          <Text color="error">
            {figures.cross} {error}
          </Text>
        </Box>}

      <DiscoverPluginsKeyHint hasSelection={selectedForInstall.size > 0} canToggle={selectedIndex < filteredPlugins.length && !filteredPlugins[selectedIndex]?.isInstalled} />
    </Box>;
}
function DiscoverPluginsKeyHint(t0) {
  const $ = _c(10);
  const {
    hasSelection,
    canToggle
  } = t0;
  let t1;
  if ($[0] !== hasSelection) {
    t1 = hasSelection && <ConfigurableShortcutHint action="plugin:install" context="Plugin" fallback="i" description="install" bold={true} />;
    $[0] = hasSelection;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  let t2;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Text>type to search</Text>;
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  let t3;
  if ($[3] !== canToggle) {
    t3 = canToggle && <ConfigurableShortcutHint action="plugin:toggle" context="Plugin" fallback="Space" description="toggle" />;
    $[3] = canToggle;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  let t4;
  let t5;
  if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
    t4 = <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="details" />;
    t5 = <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />;
    $[5] = t4;
    $[6] = t5;
  } else {
    t4 = $[5];
    t5 = $[6];
  }
  let t6;
  if ($[7] !== t1 || $[8] !== t3) {
    t6 = <Box marginTop={1}><Text dimColor={true} italic={true}><Byline>{t1}{t2}{t3}{t4}{t5}</Byline></Text></Box>;
    $[7] = t1;
    $[8] = t3;
    $[9] = t6;
  } else {
    t6 = $[9];
  }
  return t6;
}

/**
 * Context-aware empty state message for the Discover screen
 */
function EmptyStateMessage(t0) {
  const $ = _c(6);
  const {
    reason
  } = t0;
  switch (reason) {
    case "git-not-installed":
      {
        let t1;
        if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <><Text dimColor={true}>Git is required to install marketplaces.</Text><Text dimColor={true}>Please install git and restart Claude Code.</Text></>;
          $[0] = t1;
        } else {
          t1 = $[0];
        }
        return t1;
      }
    case "all-blocked-by-policy":
      {
        let t1;
        if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <><Text dimColor={true}>Your organization policy does not allow any external marketplaces.</Text><Text dimColor={true}>Contact your administrator.</Text></>;
          $[1] = t1;
        } else {
          t1 = $[1];
        }
        return t1;
      }
    case "policy-restricts-sources":
      {
        let t1;
        if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <><Text dimColor={true}>Your organization restricts which marketplaces can be added.</Text><Text dimColor={true}>Switch to the Marketplaces tab to view allowed sources.</Text></>;
          $[2] = t1;
        } else {
          t1 = $[2];
        }
        return t1;
      }
    case "all-marketplaces-failed":
      {
        let t1;
        if ($[3] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <><Text dimColor={true}>Failed to load marketplace data.</Text><Text dimColor={true}>Check your network connection.</Text></>;
          $[3] = t1;
        } else {
          t1 = $[3];
        }
        return t1;
      }
    case "all-plugins-installed":
      {
        let t1;
        if ($[4] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <><Text dimColor={true}>All available plugins are already installed.</Text><Text dimColor={true}>Check for new plugins later or add more marketplaces.</Text></>;
          $[4] = t1;
        } else {
          t1 = $[4];
        }
        return t1;
      }
    case "no-marketplaces-configured":
    default:
      {
        let t1;
        if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
          t1 = <><Text dimColor={true}>No plugins available.</Text><Text dimColor={true}>Add a marketplace first using the Marketplaces tab.</Text></>;
          $[5] = t1;
        } else {
          t1 = $[5];
        }
        return t1;
      }
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VTdGF0ZSIsIkNvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCIsIkJ5bGluZSIsIlNlYXJjaEJveCIsInVzZVNlYXJjaElucHV0IiwidXNlVGVybWluYWxTaXplIiwiQm94IiwiVGV4dCIsInVzZUlucHV0IiwidXNlVGVybWluYWxGb2N1cyIsInVzZUtleWJpbmRpbmciLCJ1c2VLZXliaW5kaW5ncyIsIkxvYWRlZFBsdWdpbiIsImNvdW50Iiwib3BlbkJyb3dzZXIiLCJsb2dGb3JEZWJ1Z2dpbmciLCJlcnJvck1lc3NhZ2UiLCJjbGVhckFsbENhY2hlcyIsImZvcm1hdEluc3RhbGxDb3VudCIsImdldEluc3RhbGxDb3VudHMiLCJpc1BsdWdpbkdsb2JhbGx5SW5zdGFsbGVkIiwiY3JlYXRlUGx1Z2luSWQiLCJkZXRlY3RFbXB0eU1hcmtldHBsYWNlUmVhc29uIiwiRW1wdHlNYXJrZXRwbGFjZVJlYXNvbiIsImZvcm1hdEZhaWx1cmVEZXRhaWxzIiwiZm9ybWF0TWFya2V0cGxhY2VMb2FkaW5nRXJyb3JzIiwibG9hZE1hcmtldHBsYWNlc1dpdGhHcmFjZWZ1bERlZ3JhZGF0aW9uIiwibG9hZEtub3duTWFya2V0cGxhY2VzQ29uZmlnIiwiT0ZGSUNJQUxfTUFSS0VUUExBQ0VfTkFNRSIsImluc3RhbGxQbHVnaW5Gcm9tTWFya2V0cGxhY2UiLCJpc1BsdWdpbkJsb2NrZWRCeVBvbGljeSIsInBsdXJhbCIsInRydW5jYXRlVG9XaWR0aCIsImZpbmRQbHVnaW5PcHRpb25zVGFyZ2V0IiwiUGx1Z2luT3B0aW9uc0Zsb3ciLCJQbHVnaW5UcnVzdFdhcm5pbmciLCJidWlsZFBsdWdpbkRldGFpbHNNZW51T3B0aW9ucyIsImV4dHJhY3RHaXRIdWJSZXBvIiwiSW5zdGFsbGFibGVQbHVnaW4iLCJWaWV3U3RhdGUiLCJQYXJlbnRWaWV3U3RhdGUiLCJ1c2VQYWdpbmF0aW9uIiwiUHJvcHMiLCJlcnJvciIsInNldEVycm9yIiwicmVzdWx0Iiwic2V0UmVzdWx0Iiwic2V0Vmlld1N0YXRlIiwic3RhdGUiLCJvbkluc3RhbGxDb21wbGV0ZSIsIlByb21pc2UiLCJvblNlYXJjaE1vZGVDaGFuZ2UiLCJpc0FjdGl2ZSIsInRhcmdldFBsdWdpbiIsInR5cGUiLCJwbHVnaW4iLCJwbHVnaW5JZCIsIkRpc2NvdmVyUGx1Z2lucyIsIl9yZXN1bHQiLCJzZXRQYXJlbnRWaWV3U3RhdGUiLCJSZWFjdE5vZGUiLCJ2aWV3U3RhdGUiLCJzZWxlY3RlZFBsdWdpbiIsInNldFNlbGVjdGVkUGx1Z2luIiwiYXZhaWxhYmxlUGx1Z2lucyIsInNldEF2YWlsYWJsZVBsdWdpbnMiLCJsb2FkaW5nIiwic2V0TG9hZGluZyIsImluc3RhbGxDb3VudHMiLCJzZXRJbnN0YWxsQ291bnRzIiwiTWFwIiwiaXNTZWFyY2hNb2RlIiwic2V0SXNTZWFyY2hNb2RlUmF3Iiwic2V0SXNTZWFyY2hNb2RlIiwiYWN0aXZlIiwicXVlcnkiLCJzZWFyY2hRdWVyeSIsInNldFF1ZXJ5Iiwic2V0U2VhcmNoUXVlcnkiLCJjdXJzb3JPZmZzZXQiLCJzZWFyY2hDdXJzb3JPZmZzZXQiLCJvbkV4aXQiLCJpc1Rlcm1pbmFsRm9jdXNlZCIsImNvbHVtbnMiLCJ0ZXJtaW5hbFdpZHRoIiwiZmlsdGVyZWRQbHVnaW5zIiwibG93ZXJRdWVyeSIsInRvTG93ZXJDYXNlIiwiZmlsdGVyIiwiZW50cnkiLCJuYW1lIiwiaW5jbHVkZXMiLCJkZXNjcmlwdGlvbiIsIm1hcmtldHBsYWNlTmFtZSIsInNlbGVjdGVkSW5kZXgiLCJzZXRTZWxlY3RlZEluZGV4Iiwic2VsZWN0ZWRGb3JJbnN0YWxsIiwic2V0U2VsZWN0ZWRGb3JJbnN0YWxsIiwiU2V0IiwiaW5zdGFsbGluZ1BsdWdpbnMiLCJzZXRJbnN0YWxsaW5nUGx1Z2lucyIsInBhZ2luYXRpb24iLCJ0b3RhbEl0ZW1zIiwibGVuZ3RoIiwiZGV0YWlsc01lbnVJbmRleCIsInNldERldGFpbHNNZW51SW5kZXgiLCJpc0luc3RhbGxpbmciLCJzZXRJc0luc3RhbGxpbmciLCJpbnN0YWxsRXJyb3IiLCJzZXRJbnN0YWxsRXJyb3IiLCJ3YXJuaW5nIiwic2V0V2FybmluZyIsImVtcHR5UmVhc29uIiwic2V0RW1wdHlSZWFzb24iLCJsb2FkQWxsUGx1Z2lucyIsImNvbmZpZyIsIm1hcmtldHBsYWNlcyIsImZhaWx1cmVzIiwiYWxsUGx1Z2lucyIsImRhdGEiLCJtYXJrZXRwbGFjZSIsInBsdWdpbnMiLCJwdXNoIiwiaXNJbnN0YWxsZWQiLCJ1bmluc3RhbGxlZFBsdWdpbnMiLCJwIiwiY291bnRzIiwic29ydCIsImEiLCJiIiwiY291bnRBIiwiZ2V0IiwiY291bnRCIiwibG9jYWxlQ29tcGFyZSIsImNvbmZpZ3VyZWRDb3VudCIsIk9iamVjdCIsImtleXMiLCJyZWFzb24iLCJjb25maWd1cmVkTWFya2V0cGxhY2VDb3VudCIsImZhaWxlZE1hcmtldHBsYWNlQ291bnQiLCJzdWNjZXNzQ291bnQiLCJtIiwiZXJyb3JSZXN1bHQiLCJtZXNzYWdlIiwiRXJyb3IiLCJmb3VuZFBsdWdpbiIsImZpbmQiLCJlcnIiLCJpbnN0YWxsU2VsZWN0ZWRQbHVnaW5zIiwic2l6ZSIsInBsdWdpbnNUb0luc3RhbGwiLCJoYXMiLCJtYXAiLCJmYWlsdXJlQ291bnQiLCJuZXdGYWlsZWRQbHVnaW5zIiwiQXJyYXkiLCJzY29wZSIsInN1Y2Nlc3MiLCJoYW5kbGVTaW5nbGVQbHVnaW5JbnN0YWxsIiwibG9hZGVkIiwiY29udGV4dCIsImlucHV0IiwiX2tleSIsImtleUlzTm90Q3RybE9yTWV0YSIsImN0cmwiLCJtZXRhIiwidGVzdCIsInNlbGVjdDpwcmV2aW91cyIsImhhbmRsZVNlbGVjdGlvbkNoYW5nZSIsInNlbGVjdDpuZXh0Iiwic2VsZWN0OmFjY2VwdCIsInRhcmdldE1hcmtldHBsYWNlIiwicGx1Z2luOnRvZ2dsZSIsIm5ld1NlbGVjdGlvbiIsImRlbGV0ZSIsImFkZCIsInBsdWdpbjppbnN0YWxsIiwiZGV0YWlsc01lbnVPcHRpb25zIiwiaGFzSG9tZXBhZ2UiLCJob21lcGFnZSIsImdpdGh1YlJlcG8iLCJhY3Rpb24iLCJmaW5pc2giLCJtc2ciLCJvdXRjb21lIiwiZGV0YWlsIiwibWVudU9wdGlvbnMiLCJ2ZXJzaW9uIiwiYXV0aG9yIiwib3B0aW9uIiwiaW5kZXgiLCJzdGFydHNXaXRoIiwibGFiZWwiLCJ2aXNpYmxlUGx1Z2lucyIsImdldFZpc2libGVJdGVtcyIsIm5lZWRzUGFnaW5hdGlvbiIsInNjcm9sbFBvc2l0aW9uIiwiY3VycmVudCIsInRvdGFsIiwiY2FuU2Nyb2xsVXAiLCJhcnJvd1VwIiwidmlzaWJsZUluZGV4IiwiYWN0dWFsSW5kZXgiLCJ0b0FjdHVhbEluZGV4IiwiaXNTZWxlY3RlZCIsImlzU2VsZWN0ZWRGb3JJbnN0YWxsIiwiaXNJbnN0YWxsaW5nVGhpcyIsImlzTGFzdCIsInN0YXJ0SW5kZXgiLCJ1bmRlZmluZWQiLCJwb2ludGVyIiwiZWxsaXBzaXMiLCJyYWRpb09uIiwicmFkaW9PZmYiLCJ0YWdzIiwiY2FuU2Nyb2xsRG93biIsImFycm93RG93biIsImNyb3NzIiwiRGlzY292ZXJQbHVnaW5zS2V5SGludCIsInQwIiwiJCIsIl9jIiwiaGFzU2VsZWN0aW9uIiwiY2FuVG9nZ2xlIiwidDEiLCJ0MiIsIlN5bWJvbCIsImZvciIsInQzIiwidDQiLCJ0NSIsInQ2IiwiRW1wdHlTdGF0ZU1lc3NhZ2UiXSwic291cmNlcyI6WyJEaXNjb3ZlclBsdWdpbnMudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmaWd1cmVzIGZyb20gJ2ZpZ3VyZXMnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHVzZUNhbGxiYWNrLCB1c2VFZmZlY3QsIHVzZU1lbW8sIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyBDb25maWd1cmFibGVTaG9ydGN1dEhpbnQgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL0NvbmZpZ3VyYWJsZVNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IEJ5bGluZSB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvZGVzaWduLXN5c3RlbS9CeWxpbmUuanMnXG5pbXBvcnQgeyBTZWFyY2hCb3ggfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL1NlYXJjaEJveC5qcydcbmltcG9ydCB7IHVzZVNlYXJjaElucHV0IH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlU2VhcmNoSW5wdXQuanMnXG5pbXBvcnQgeyB1c2VUZXJtaW5hbFNpemUgfSBmcm9tICcuLi8uLi9ob29rcy91c2VUZXJtaW5hbFNpemUuanMnXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL3ByZWZlci11c2Uta2V5YmluZGluZ3MgLS0gdXNlSW5wdXQgbmVlZGVkIGZvciByYXcgc2VhcmNoIG1vZGUgdGV4dCBpbnB1dFxuaW1wb3J0IHsgQm94LCBUZXh0LCB1c2VJbnB1dCwgdXNlVGVybWluYWxGb2N1cyB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7XG4gIHVzZUtleWJpbmRpbmcsXG4gIHVzZUtleWJpbmRpbmdzLFxufSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHR5cGUgeyBMb2FkZWRQbHVnaW4gfSBmcm9tICcuLi8uLi90eXBlcy9wbHVnaW4uanMnXG5pbXBvcnQgeyBjb3VudCB9IGZyb20gJy4uLy4uL3V0aWxzL2FycmF5LmpzJ1xuaW1wb3J0IHsgb3BlbkJyb3dzZXIgfSBmcm9tICcuLi8uLi91dGlscy9icm93c2VyLmpzJ1xuaW1wb3J0IHsgbG9nRm9yRGVidWdnaW5nIH0gZnJvbSAnLi4vLi4vdXRpbHMvZGVidWcuanMnXG5pbXBvcnQgeyBlcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcnMuanMnXG5pbXBvcnQgeyBjbGVhckFsbENhY2hlcyB9IGZyb20gJy4uLy4uL3V0aWxzL3BsdWdpbnMvY2FjaGVVdGlscy5qcydcbmltcG9ydCB7XG4gIGZvcm1hdEluc3RhbGxDb3VudCxcbiAgZ2V0SW5zdGFsbENvdW50cyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9pbnN0YWxsQ291bnRzLmpzJ1xuaW1wb3J0IHsgaXNQbHVnaW5HbG9iYWxseUluc3RhbGxlZCB9IGZyb20gJy4uLy4uL3V0aWxzL3BsdWdpbnMvaW5zdGFsbGVkUGx1Z2luc01hbmFnZXIuanMnXG5pbXBvcnQge1xuICBjcmVhdGVQbHVnaW5JZCxcbiAgZGV0ZWN0RW1wdHlNYXJrZXRwbGFjZVJlYXNvbixcbiAgdHlwZSBFbXB0eU1hcmtldHBsYWNlUmVhc29uLFxuICBmb3JtYXRGYWlsdXJlRGV0YWlscyxcbiAgZm9ybWF0TWFya2V0cGxhY2VMb2FkaW5nRXJyb3JzLFxuICBsb2FkTWFya2V0cGxhY2VzV2l0aEdyYWNlZnVsRGVncmFkYXRpb24sXG59IGZyb20gJy4uLy4uL3V0aWxzL3BsdWdpbnMvbWFya2V0cGxhY2VIZWxwZXJzLmpzJ1xuaW1wb3J0IHsgbG9hZEtub3duTWFya2V0cGxhY2VzQ29uZmlnIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9tYXJrZXRwbGFjZU1hbmFnZXIuanMnXG5pbXBvcnQgeyBPRkZJQ0lBTF9NQVJLRVRQTEFDRV9OQU1FIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9vZmZpY2lhbE1hcmtldHBsYWNlLmpzJ1xuaW1wb3J0IHsgaW5zdGFsbFBsdWdpbkZyb21NYXJrZXRwbGFjZSB9IGZyb20gJy4uLy4uL3V0aWxzL3BsdWdpbnMvcGx1Z2luSW5zdGFsbGF0aW9uSGVscGVycy5qcydcbmltcG9ydCB7IGlzUGx1Z2luQmxvY2tlZEJ5UG9saWN5IH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9wbHVnaW5Qb2xpY3kuanMnXG5pbXBvcnQgeyBwbHVyYWwgfSBmcm9tICcuLi8uLi91dGlscy9zdHJpbmdVdGlscy5qcydcbmltcG9ydCB7IHRydW5jYXRlVG9XaWR0aCB9IGZyb20gJy4uLy4uL3V0aWxzL3RydW5jYXRlLmpzJ1xuaW1wb3J0IHtcbiAgZmluZFBsdWdpbk9wdGlvbnNUYXJnZXQsXG4gIFBsdWdpbk9wdGlvbnNGbG93LFxufSBmcm9tICcuL1BsdWdpbk9wdGlvbnNGbG93LmpzJ1xuaW1wb3J0IHsgUGx1Z2luVHJ1c3RXYXJuaW5nIH0gZnJvbSAnLi9QbHVnaW5UcnVzdFdhcm5pbmcuanMnXG5pbXBvcnQge1xuICBidWlsZFBsdWdpbkRldGFpbHNNZW51T3B0aW9ucyxcbiAgZXh0cmFjdEdpdEh1YlJlcG8sXG4gIHR5cGUgSW5zdGFsbGFibGVQbHVnaW4sXG59IGZyb20gJy4vcGx1Z2luRGV0YWlsc0hlbHBlcnMuanMnXG5pbXBvcnQgdHlwZSB7IFZpZXdTdGF0ZSBhcyBQYXJlbnRWaWV3U3RhdGUgfSBmcm9tICcuL3R5cGVzLmpzJ1xuaW1wb3J0IHsgdXNlUGFnaW5hdGlvbiB9IGZyb20gJy4vdXNlUGFnaW5hdGlvbi5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgZXJyb3I6IHN0cmluZyB8IG51bGxcbiAgc2V0RXJyb3I6IChlcnJvcjogc3RyaW5nIHwgbnVsbCkgPT4gdm9pZFxuICByZXN1bHQ6IHN0cmluZyB8IG51bGxcbiAgc2V0UmVzdWx0OiAocmVzdWx0OiBzdHJpbmcgfCBudWxsKSA9PiB2b2lkXG4gIHNldFZpZXdTdGF0ZTogKHN0YXRlOiBQYXJlbnRWaWV3U3RhdGUpID0+IHZvaWRcbiAgb25JbnN0YWxsQ29tcGxldGU/OiAoKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPlxuICBvblNlYXJjaE1vZGVDaGFuZ2U/OiAoaXNBY3RpdmU6IGJvb2xlYW4pID0+IHZvaWRcbiAgdGFyZ2V0UGx1Z2luPzogc3RyaW5nXG59XG5cbnR5cGUgVmlld1N0YXRlID1cbiAgfCAncGx1Z2luLWxpc3QnXG4gIHwgJ3BsdWdpbi1kZXRhaWxzJ1xuICB8IHsgdHlwZTogJ3BsdWdpbi1vcHRpb25zJzsgcGx1Z2luOiBMb2FkZWRQbHVnaW47IHBsdWdpbklkOiBzdHJpbmcgfVxuXG5leHBvcnQgZnVuY3Rpb24gRGlzY292ZXJQbHVnaW5zKHtcbiAgZXJyb3IsXG4gIHNldEVycm9yLFxuICByZXN1bHQ6IF9yZXN1bHQsXG4gIHNldFJlc3VsdCxcbiAgc2V0Vmlld1N0YXRlOiBzZXRQYXJlbnRWaWV3U3RhdGUsXG4gIG9uSW5zdGFsbENvbXBsZXRlLFxuICBvblNlYXJjaE1vZGVDaGFuZ2UsXG4gIHRhcmdldFBsdWdpbixcbn06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgLy8gVmlldyBzdGF0ZVxuICBjb25zdCBbdmlld1N0YXRlLCBzZXRWaWV3U3RhdGVdID0gdXNlU3RhdGU8Vmlld1N0YXRlPigncGx1Z2luLWxpc3QnKVxuICBjb25zdCBbc2VsZWN0ZWRQbHVnaW4sIHNldFNlbGVjdGVkUGx1Z2luXSA9XG4gICAgdXNlU3RhdGU8SW5zdGFsbGFibGVQbHVnaW4gfCBudWxsPihudWxsKVxuXG4gIC8vIERhdGEgc3RhdGVcbiAgY29uc3QgW2F2YWlsYWJsZVBsdWdpbnMsIHNldEF2YWlsYWJsZVBsdWdpbnNdID0gdXNlU3RhdGU8SW5zdGFsbGFibGVQbHVnaW5bXT4oXG4gICAgW10sXG4gIClcbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSlcbiAgY29uc3QgW2luc3RhbGxDb3VudHMsIHNldEluc3RhbGxDb3VudHNdID0gdXNlU3RhdGU8TWFwPFxuICAgIHN0cmluZyxcbiAgICBudW1iZXJcbiAgPiB8IG51bGw+KG51bGwpXG5cbiAgLy8gU2VhcmNoIHN0YXRlXG4gIGNvbnN0IFtpc1NlYXJjaE1vZGUsIHNldElzU2VhcmNoTW9kZVJhd10gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3Qgc2V0SXNTZWFyY2hNb2RlID0gdXNlQ2FsbGJhY2soXG4gICAgKGFjdGl2ZTogYm9vbGVhbikgPT4ge1xuICAgICAgc2V0SXNTZWFyY2hNb2RlUmF3KGFjdGl2ZSlcbiAgICAgIG9uU2VhcmNoTW9kZUNoYW5nZT8uKGFjdGl2ZSlcbiAgICB9LFxuICAgIFtvblNlYXJjaE1vZGVDaGFuZ2VdLFxuICApXG4gIGNvbnN0IHtcbiAgICBxdWVyeTogc2VhcmNoUXVlcnksXG4gICAgc2V0UXVlcnk6IHNldFNlYXJjaFF1ZXJ5LFxuICAgIGN1cnNvck9mZnNldDogc2VhcmNoQ3Vyc29yT2Zmc2V0LFxuICB9ID0gdXNlU2VhcmNoSW5wdXQoe1xuICAgIGlzQWN0aXZlOiB2aWV3U3RhdGUgPT09ICdwbHVnaW4tbGlzdCcgJiYgaXNTZWFyY2hNb2RlICYmICFsb2FkaW5nLFxuICAgIG9uRXhpdDogKCkgPT4ge1xuICAgICAgc2V0SXNTZWFyY2hNb2RlKGZhbHNlKVxuICAgIH0sXG4gIH0pXG4gIGNvbnN0IGlzVGVybWluYWxGb2N1c2VkID0gdXNlVGVybWluYWxGb2N1cygpXG4gIGNvbnN0IHsgY29sdW1uczogdGVybWluYWxXaWR0aCB9ID0gdXNlVGVybWluYWxTaXplKClcblxuICAvLyBGaWx0ZXIgcGx1Z2lucyBiYXNlZCBvbiBzZWFyY2ggcXVlcnlcbiAgY29uc3QgZmlsdGVyZWRQbHVnaW5zID0gdXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCFzZWFyY2hRdWVyeSkgcmV0dXJuIGF2YWlsYWJsZVBsdWdpbnNcbiAgICBjb25zdCBsb3dlclF1ZXJ5ID0gc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKVxuICAgIHJldHVybiBhdmFpbGFibGVQbHVnaW5zLmZpbHRlcihcbiAgICAgIHBsdWdpbiA9PlxuICAgICAgICBwbHVnaW4uZW50cnkubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGxvd2VyUXVlcnkpIHx8XG4gICAgICAgIHBsdWdpbi5lbnRyeS5kZXNjcmlwdGlvbj8udG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhsb3dlclF1ZXJ5KSB8fFxuICAgICAgICBwbHVnaW4ubWFya2V0cGxhY2VOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXJRdWVyeSksXG4gICAgKVxuICB9LCBbYXZhaWxhYmxlUGx1Z2lucywgc2VhcmNoUXVlcnldKVxuXG4gIC8vIFNlbGVjdGlvbiBzdGF0ZVxuICBjb25zdCBbc2VsZWN0ZWRJbmRleCwgc2V0U2VsZWN0ZWRJbmRleF0gPSB1c2VTdGF0ZSgwKVxuICBjb25zdCBbc2VsZWN0ZWRGb3JJbnN0YWxsLCBzZXRTZWxlY3RlZEZvckluc3RhbGxdID0gdXNlU3RhdGU8U2V0PHN0cmluZz4+KFxuICAgIG5ldyBTZXQoKSxcbiAgKVxuICBjb25zdCBbaW5zdGFsbGluZ1BsdWdpbnMsIHNldEluc3RhbGxpbmdQbHVnaW5zXSA9IHVzZVN0YXRlPFNldDxzdHJpbmc+PihcbiAgICBuZXcgU2V0KCksXG4gIClcblxuICAvLyBQYWdpbmF0aW9uIGZvciBwbHVnaW4gbGlzdCAoY29udGludW91cyBzY3JvbGxpbmcpXG4gIGNvbnN0IHBhZ2luYXRpb24gPSB1c2VQYWdpbmF0aW9uPEluc3RhbGxhYmxlUGx1Z2luPih7XG4gICAgdG90YWxJdGVtczogZmlsdGVyZWRQbHVnaW5zLmxlbmd0aCxcbiAgICBzZWxlY3RlZEluZGV4LFxuICB9KVxuXG4gIC8vIFJlc2V0IHNlbGVjdGlvbiB3aGVuIHNlYXJjaCBxdWVyeSBjaGFuZ2VzXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgc2V0U2VsZWN0ZWRJbmRleCgwKVxuICB9LCBbc2VhcmNoUXVlcnldKVxuXG4gIC8vIERldGFpbHMgdmlldyBzdGF0ZVxuICBjb25zdCBbZGV0YWlsc01lbnVJbmRleCwgc2V0RGV0YWlsc01lbnVJbmRleF0gPSB1c2VTdGF0ZSgwKVxuICBjb25zdCBbaXNJbnN0YWxsaW5nLCBzZXRJc0luc3RhbGxpbmddID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtpbnN0YWxsRXJyb3IsIHNldEluc3RhbGxFcnJvcl0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuXG4gIC8vIFdhcm5pbmcgc3RhdGUgZm9yIG5vbi1jcml0aWNhbCBlcnJvcnNcbiAgY29uc3QgW3dhcm5pbmcsIHNldFdhcm5pbmddID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcblxuICAvLyBFbXB0eSBzdGF0ZSByZWFzb25cbiAgY29uc3QgW2VtcHR5UmVhc29uLCBzZXRFbXB0eVJlYXNvbl0gPSB1c2VTdGF0ZTxFbXB0eU1hcmtldHBsYWNlUmVhc29uIHwgbnVsbD4oXG4gICAgbnVsbCxcbiAgKVxuXG4gIC8vIExvYWQgYWxsIHBsdWdpbnMgZnJvbSBhbGwgbWFya2V0cGxhY2VzXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXN5bmMgZnVuY3Rpb24gbG9hZEFsbFBsdWdpbnMoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjb25maWcgPSBhd2FpdCBsb2FkS25vd25NYXJrZXRwbGFjZXNDb25maWcoKVxuXG4gICAgICAgIC8vIExvYWQgbWFya2V0cGxhY2VzIHdpdGggZ3JhY2VmdWwgZGVncmFkYXRpb25cbiAgICAgICAgY29uc3QgeyBtYXJrZXRwbGFjZXMsIGZhaWx1cmVzIH0gPVxuICAgICAgICAgIGF3YWl0IGxvYWRNYXJrZXRwbGFjZXNXaXRoR3JhY2VmdWxEZWdyYWRhdGlvbihjb25maWcpXG5cbiAgICAgICAgLy8gQ29sbGVjdCBhbGwgcGx1Z2lucyBmcm9tIGFsbCBtYXJrZXRwbGFjZXNcbiAgICAgICAgY29uc3QgYWxsUGx1Z2luczogSW5zdGFsbGFibGVQbHVnaW5bXSA9IFtdXG5cbiAgICAgICAgZm9yIChjb25zdCB7IG5hbWUsIGRhdGE6IG1hcmtldHBsYWNlIH0gb2YgbWFya2V0cGxhY2VzKSB7XG4gICAgICAgICAgaWYgKG1hcmtldHBsYWNlKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIG1hcmtldHBsYWNlLnBsdWdpbnMpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGx1Z2luSWQgPSBjcmVhdGVQbHVnaW5JZChlbnRyeS5uYW1lLCBuYW1lKVxuICAgICAgICAgICAgICBhbGxQbHVnaW5zLnB1c2goe1xuICAgICAgICAgICAgICAgIGVudHJ5LFxuICAgICAgICAgICAgICAgIG1hcmtldHBsYWNlTmFtZTogbmFtZSxcbiAgICAgICAgICAgICAgICBwbHVnaW5JZCxcbiAgICAgICAgICAgICAgICAvLyBPbmx5IGJsb2NrIHdoZW4gZ2xvYmFsbHkgaW5zdGFsbGVkICh1c2VyL21hbmFnZWQgc2NvcGUpLlxuICAgICAgICAgICAgICAgIC8vIFByb2plY3QvbG9jYWwtc2NvcGUgaW5zdGFsbHMgZG9uJ3QgYmxvY2sg4oCUIHVzZXIgbWF5IHdhbnQgdG9cbiAgICAgICAgICAgICAgICAvLyBwcm9tb3RlIHRvIHVzZXIgc2NvcGUgc28gaXQncyBhdmFpbGFibGUgZXZlcnl3aGVyZSAoZ2gtMjk5OTcpLlxuICAgICAgICAgICAgICAgIGlzSW5zdGFsbGVkOiBpc1BsdWdpbkdsb2JhbGx5SW5zdGFsbGVkKHBsdWdpbklkKSxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaWx0ZXIgb3V0IGluc3RhbGxlZCBhbmQgcG9saWN5LWJsb2NrZWQgcGx1Z2luc1xuICAgICAgICBjb25zdCB1bmluc3RhbGxlZFBsdWdpbnMgPSBhbGxQbHVnaW5zLmZpbHRlcihcbiAgICAgICAgICBwID0+ICFwLmlzSW5zdGFsbGVkICYmICFpc1BsdWdpbkJsb2NrZWRCeVBvbGljeShwLnBsdWdpbklkKSxcbiAgICAgICAgKVxuXG4gICAgICAgIC8vIEZldGNoIGluc3RhbGwgY291bnRzIGFuZCBzb3J0IGJ5IHBvcHVsYXJpdHlcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBjb3VudHMgPSBhd2FpdCBnZXRJbnN0YWxsQ291bnRzKClcbiAgICAgICAgICBzZXRJbnN0YWxsQ291bnRzKGNvdW50cylcblxuICAgICAgICAgIGlmIChjb3VudHMpIHtcbiAgICAgICAgICAgIC8vIFNvcnQgYnkgaW5zdGFsbCBjb3VudCAoZGVzY2VuZGluZyksIHRoZW4gYWxwaGFiZXRpY2FsbHlcbiAgICAgICAgICAgIHVuaW5zdGFsbGVkUGx1Z2lucy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGNvdW50QSA9IGNvdW50cy5nZXQoYS5wbHVnaW5JZCkgPz8gMFxuICAgICAgICAgICAgICBjb25zdCBjb3VudEIgPSBjb3VudHMuZ2V0KGIucGx1Z2luSWQpID8/IDBcbiAgICAgICAgICAgICAgaWYgKGNvdW50QSAhPT0gY291bnRCKSByZXR1cm4gY291bnRCIC0gY291bnRBXG4gICAgICAgICAgICAgIHJldHVybiBhLmVudHJ5Lm5hbWUubG9jYWxlQ29tcGFyZShiLmVudHJ5Lm5hbWUpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBObyBjb3VudHMgYXZhaWxhYmxlIC0gc29ydCBhbHBoYWJldGljYWxseVxuICAgICAgICAgICAgdW5pbnN0YWxsZWRQbHVnaW5zLnNvcnQoKGEsIGIpID0+XG4gICAgICAgICAgICAgIGEuZW50cnkubmFtZS5sb2NhbGVDb21wYXJlKGIuZW50cnkubmFtZSksXG4gICAgICAgICAgICApXG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIC8vIExvZyB0aGUgZXJyb3IsIHRoZW4gZ3JhY2VmdWxseSBkZWdyYWRlIHRvIGFscGhhYmV0aWNhbCBzb3J0XG4gICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgYEZhaWxlZCB0byBmZXRjaCBpbnN0YWxsIGNvdW50czogJHtlcnJvck1lc3NhZ2UoZXJyb3IpfWAsXG4gICAgICAgICAgKVxuICAgICAgICAgIHVuaW5zdGFsbGVkUGx1Z2lucy5zb3J0KChhLCBiKSA9PlxuICAgICAgICAgICAgYS5lbnRyeS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5lbnRyeS5uYW1lKSxcbiAgICAgICAgICApXG4gICAgICAgIH1cblxuICAgICAgICBzZXRBdmFpbGFibGVQbHVnaW5zKHVuaW5zdGFsbGVkUGx1Z2lucylcblxuICAgICAgICAvLyBEZXRlY3QgZW1wdHkgcmVhc29uIGlmIG5vIHBsdWdpbnMgYXZhaWxhYmxlXG4gICAgICAgIGNvbnN0IGNvbmZpZ3VyZWRDb3VudCA9IE9iamVjdC5rZXlzKGNvbmZpZykubGVuZ3RoXG4gICAgICAgIGlmICh1bmluc3RhbGxlZFBsdWdpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgY29uc3QgcmVhc29uID0gYXdhaXQgZGV0ZWN0RW1wdHlNYXJrZXRwbGFjZVJlYXNvbih7XG4gICAgICAgICAgICBjb25maWd1cmVkTWFya2V0cGxhY2VDb3VudDogY29uZmlndXJlZENvdW50LFxuICAgICAgICAgICAgZmFpbGVkTWFya2V0cGxhY2VDb3VudDogZmFpbHVyZXMubGVuZ3RoLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgc2V0RW1wdHlSZWFzb24ocmVhc29uKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gSGFuZGxlIG1hcmtldHBsYWNlIGxvYWRpbmcgZXJyb3JzL3dhcm5pbmdzXG4gICAgICAgIGNvbnN0IHN1Y2Nlc3NDb3VudCA9IGNvdW50KG1hcmtldHBsYWNlcywgbSA9PiBtLmRhdGEgIT09IG51bGwpXG4gICAgICAgIGNvbnN0IGVycm9yUmVzdWx0ID0gZm9ybWF0TWFya2V0cGxhY2VMb2FkaW5nRXJyb3JzKFxuICAgICAgICAgIGZhaWx1cmVzLFxuICAgICAgICAgIHN1Y2Nlc3NDb3VudCxcbiAgICAgICAgKVxuICAgICAgICBpZiAoZXJyb3JSZXN1bHQpIHtcbiAgICAgICAgICBpZiAoZXJyb3JSZXN1bHQudHlwZSA9PT0gJ3dhcm5pbmcnKSB7XG4gICAgICAgICAgICBzZXRXYXJuaW5nKGVycm9yUmVzdWx0Lm1lc3NhZ2UgKyAnLiBTaG93aW5nIGF2YWlsYWJsZSBwbHVnaW5zLicpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvclJlc3VsdC5tZXNzYWdlKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEhhbmRsZSB0YXJnZXRQbHVnaW4gLSBuYXZpZ2F0ZSBkaXJlY3RseSB0byBwbHVnaW4gZGV0YWlsc1xuICAgICAgICAvLyBTZWFyY2ggaW4gYWxsUGx1Z2lucyAoYmVmb3JlIGZpbHRlcmluZykgdG8gaGFuZGxlIGluc3RhbGxlZCBwbHVnaW5zIGdyYWNlZnVsbHlcbiAgICAgICAgaWYgKHRhcmdldFBsdWdpbikge1xuICAgICAgICAgIGNvbnN0IGZvdW5kUGx1Z2luID0gYWxsUGx1Z2lucy5maW5kKFxuICAgICAgICAgICAgcCA9PiBwLmVudHJ5Lm5hbWUgPT09IHRhcmdldFBsdWdpbixcbiAgICAgICAgICApXG5cbiAgICAgICAgICBpZiAoZm91bmRQbHVnaW4pIHtcbiAgICAgICAgICAgIGlmIChmb3VuZFBsdWdpbi5pc0luc3RhbGxlZCkge1xuICAgICAgICAgICAgICBzZXRFcnJvcihcbiAgICAgICAgICAgICAgICBgUGx1Z2luICcke2ZvdW5kUGx1Z2luLnBsdWdpbklkfScgaXMgYWxyZWFkeSBpbnN0YWxsZWQuIFVzZSAnL3BsdWdpbicgdG8gbWFuYWdlIGV4aXN0aW5nIHBsdWdpbnMuYCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRQbHVnaW4oZm91bmRQbHVnaW4pXG4gICAgICAgICAgICAgIHNldFZpZXdTdGF0ZSgncGx1Z2luLWRldGFpbHMnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRFcnJvcihgUGx1Z2luIFwiJHt0YXJnZXRQbHVnaW59XCIgbm90IGZvdW5kIGluIGFueSBtYXJrZXRwbGFjZWApXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgc2V0RXJyb3IoZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6ICdGYWlsZWQgdG8gbG9hZCBwbHVnaW5zJylcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNldExvYWRpbmcoZmFsc2UpXG4gICAgICB9XG4gICAgfVxuICAgIHZvaWQgbG9hZEFsbFBsdWdpbnMoKVxuICB9LCBbc2V0RXJyb3IsIHRhcmdldFBsdWdpbl0pXG5cbiAgLy8gSW5zdGFsbCBzZWxlY3RlZCBwbHVnaW5zXG4gIGNvbnN0IGluc3RhbGxTZWxlY3RlZFBsdWdpbnMgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKHNlbGVjdGVkRm9ySW5zdGFsbC5zaXplID09PSAwKSByZXR1cm5cblxuICAgIGNvbnN0IHBsdWdpbnNUb0luc3RhbGwgPSBhdmFpbGFibGVQbHVnaW5zLmZpbHRlcihwID0+XG4gICAgICBzZWxlY3RlZEZvckluc3RhbGwuaGFzKHAucGx1Z2luSWQpLFxuICAgIClcblxuICAgIHNldEluc3RhbGxpbmdQbHVnaW5zKG5ldyBTZXQocGx1Z2luc1RvSW5zdGFsbC5tYXAocCA9PiBwLnBsdWdpbklkKSkpXG5cbiAgICBsZXQgc3VjY2Vzc0NvdW50ID0gMFxuICAgIGxldCBmYWlsdXJlQ291bnQgPSAwXG4gICAgY29uc3QgbmV3RmFpbGVkUGx1Z2luczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+ID0gW11cblxuICAgIGZvciAoY29uc3QgcGx1Z2luIG9mIHBsdWdpbnNUb0luc3RhbGwpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGluc3RhbGxQbHVnaW5Gcm9tTWFya2V0cGxhY2Uoe1xuICAgICAgICBwbHVnaW5JZDogcGx1Z2luLnBsdWdpbklkLFxuICAgICAgICBlbnRyeTogcGx1Z2luLmVudHJ5LFxuICAgICAgICBtYXJrZXRwbGFjZU5hbWU6IHBsdWdpbi5tYXJrZXRwbGFjZU5hbWUsXG4gICAgICAgIHNjb3BlOiAndXNlcicsXG4gICAgICB9KVxuXG4gICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgc3VjY2Vzc0NvdW50KytcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZhaWx1cmVDb3VudCsrXG4gICAgICAgIG5ld0ZhaWxlZFBsdWdpbnMucHVzaCh7XG4gICAgICAgICAgbmFtZTogcGx1Z2luLmVudHJ5Lm5hbWUsXG4gICAgICAgICAgcmVhc29uOiByZXN1bHQuZXJyb3IsXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuXG4gICAgc2V0SW5zdGFsbGluZ1BsdWdpbnMobmV3IFNldCgpKVxuICAgIHNldFNlbGVjdGVkRm9ySW5zdGFsbChuZXcgU2V0KCkpXG4gICAgY2xlYXJBbGxDYWNoZXMoKVxuXG4gICAgLy8gSGFuZGxlIGluc3RhbGxhdGlvbiByZXN1bHRzXG4gICAgaWYgKGZhaWx1cmVDb3VudCA9PT0gMCkge1xuICAgICAgY29uc3QgbWVzc2FnZSA9XG4gICAgICAgIGDinJMgSW5zdGFsbGVkICR7c3VjY2Vzc0NvdW50fSAke3BsdXJhbChzdWNjZXNzQ291bnQsICdwbHVnaW4nKX0uIGAgK1xuICAgICAgICBgUnVuIC9yZWxvYWQtcGx1Z2lucyB0byBhY3RpdmF0ZS5gXG4gICAgICBzZXRSZXN1bHQobWVzc2FnZSlcbiAgICB9IGVsc2UgaWYgKHN1Y2Nlc3NDb3VudCA9PT0gMCkge1xuICAgICAgc2V0RXJyb3IoXG4gICAgICAgIGBGYWlsZWQgdG8gaW5zdGFsbDogJHtmb3JtYXRGYWlsdXJlRGV0YWlscyhuZXdGYWlsZWRQbHVnaW5zLCB0cnVlKX1gLFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBtZXNzYWdlID1cbiAgICAgICAgYOKckyBJbnN0YWxsZWQgJHtzdWNjZXNzQ291bnR9IG9mICR7c3VjY2Vzc0NvdW50ICsgZmFpbHVyZUNvdW50fSBwbHVnaW5zLiBgICtcbiAgICAgICAgYEZhaWxlZDogJHtmb3JtYXRGYWlsdXJlRGV0YWlscyhuZXdGYWlsZWRQbHVnaW5zLCBmYWxzZSl9LiBgICtcbiAgICAgICAgYFJ1biAvcmVsb2FkLXBsdWdpbnMgdG8gYWN0aXZhdGUgc3VjY2Vzc2Z1bGx5IGluc3RhbGxlZCBwbHVnaW5zLmBcbiAgICAgIHNldFJlc3VsdChtZXNzYWdlKVxuICAgIH1cblxuICAgIGlmIChzdWNjZXNzQ291bnQgPiAwKSB7XG4gICAgICBpZiAob25JbnN0YWxsQ29tcGxldGUpIHtcbiAgICAgICAgYXdhaXQgb25JbnN0YWxsQ29tcGxldGUoKVxuICAgICAgfVxuICAgIH1cblxuICAgIHNldFBhcmVudFZpZXdTdGF0ZSh7IHR5cGU6ICdtZW51JyB9KVxuICB9XG5cbiAgLy8gSW5zdGFsbCBzaW5nbGUgcGx1Z2luIGZyb20gZGV0YWlscyB2aWV3XG4gIGNvbnN0IGhhbmRsZVNpbmdsZVBsdWdpbkluc3RhbGwgPSBhc3luYyAoXG4gICAgcGx1Z2luOiBJbnN0YWxsYWJsZVBsdWdpbixcbiAgICBzY29wZTogJ3VzZXInIHwgJ3Byb2plY3QnIHwgJ2xvY2FsJyA9ICd1c2VyJyxcbiAgKSA9PiB7XG4gICAgc2V0SXNJbnN0YWxsaW5nKHRydWUpXG4gICAgc2V0SW5zdGFsbEVycm9yKG51bGwpXG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpbnN0YWxsUGx1Z2luRnJvbU1hcmtldHBsYWNlKHtcbiAgICAgIHBsdWdpbklkOiBwbHVnaW4ucGx1Z2luSWQsXG4gICAgICBlbnRyeTogcGx1Z2luLmVudHJ5LFxuICAgICAgbWFya2V0cGxhY2VOYW1lOiBwbHVnaW4ubWFya2V0cGxhY2VOYW1lLFxuICAgICAgc2NvcGUsXG4gICAgfSlcblxuICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgY29uc3QgbG9hZGVkID0gYXdhaXQgZmluZFBsdWdpbk9wdGlvbnNUYXJnZXQocGx1Z2luLnBsdWdpbklkKVxuICAgICAgaWYgKGxvYWRlZCkge1xuICAgICAgICBzZXRJc0luc3RhbGxpbmcoZmFsc2UpXG4gICAgICAgIHNldFZpZXdTdGF0ZSh7XG4gICAgICAgICAgdHlwZTogJ3BsdWdpbi1vcHRpb25zJyxcbiAgICAgICAgICBwbHVnaW46IGxvYWRlZCxcbiAgICAgICAgICBwbHVnaW5JZDogcGx1Z2luLnBsdWdpbklkLFxuICAgICAgICB9KVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIHNldFJlc3VsdChyZXN1bHQubWVzc2FnZSlcbiAgICAgIGlmIChvbkluc3RhbGxDb21wbGV0ZSkge1xuICAgICAgICBhd2FpdCBvbkluc3RhbGxDb21wbGV0ZSgpXG4gICAgICB9XG4gICAgICBzZXRQYXJlbnRWaWV3U3RhdGUoeyB0eXBlOiAnbWVudScgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgc2V0SXNJbnN0YWxsaW5nKGZhbHNlKVxuICAgICAgc2V0SW5zdGFsbEVycm9yKHJlc3VsdC5lcnJvcilcbiAgICB9XG4gIH1cblxuICAvLyBIYW5kbGUgZXJyb3Igc3RhdGVcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIHNldFJlc3VsdChlcnJvcilcbiAgICB9XG4gIH0sIFtlcnJvciwgc2V0UmVzdWx0XSlcblxuICAvLyBFc2NhcGUgaW4gcGx1Z2luLWRldGFpbHMgdmlldyAtIGdvIGJhY2sgdG8gcGx1Z2luLWxpc3RcbiAgdXNlS2V5YmluZGluZyhcbiAgICAnY29uZmlybTpubycsXG4gICAgKCkgPT4ge1xuICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tbGlzdCcpXG4gICAgICBzZXRTZWxlY3RlZFBsdWdpbihudWxsKVxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgICBpc0FjdGl2ZTogdmlld1N0YXRlID09PSAncGx1Z2luLWRldGFpbHMnLFxuICAgIH0sXG4gIClcblxuICAvLyBFc2NhcGUgaW4gcGx1Z2luLWxpc3QgdmlldyAobm90IHNlYXJjaCBtb2RlKSAtIGV4aXQgdG8gcGFyZW50IG1lbnVcbiAgdXNlS2V5YmluZGluZyhcbiAgICAnY29uZmlybTpubycsXG4gICAgKCkgPT4ge1xuICAgICAgc2V0UGFyZW50Vmlld1N0YXRlKHsgdHlwZTogJ21lbnUnIH0pXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnQ29uZmlybWF0aW9uJyxcbiAgICAgIGlzQWN0aXZlOiB2aWV3U3RhdGUgPT09ICdwbHVnaW4tbGlzdCcgJiYgIWlzU2VhcmNoTW9kZSxcbiAgICB9LFxuICApXG5cbiAgLy8gSGFuZGxlIGVudGVyaW5nIHNlYXJjaCBtb2RlIChub24tZXNjYXBlIGtleXMpXG4gIHVzZUlucHV0KFxuICAgIChpbnB1dCwgX2tleSkgPT4ge1xuICAgICAgY29uc3Qga2V5SXNOb3RDdHJsT3JNZXRhID0gIV9rZXkuY3RybCAmJiAhX2tleS5tZXRhXG4gICAgICBpZiAoIWlzU2VhcmNoTW9kZSkge1xuICAgICAgICAvLyBFbnRlciBzZWFyY2ggbW9kZSB3aXRoICcvJyBvciBhbnkgcHJpbnRhYmxlIGNoYXJhY3RlclxuICAgICAgICBpZiAoaW5wdXQgPT09ICcvJyAmJiBrZXlJc05vdEN0cmxPck1ldGEpIHtcbiAgICAgICAgICBzZXRJc1NlYXJjaE1vZGUodHJ1ZSlcbiAgICAgICAgICBzZXRTZWFyY2hRdWVyeSgnJylcbiAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICBrZXlJc05vdEN0cmxPck1ldGEgJiZcbiAgICAgICAgICBpbnB1dC5sZW5ndGggPiAwICYmXG4gICAgICAgICAgIS9eXFxzKyQvLnRlc3QoaW5wdXQpICYmXG4gICAgICAgICAgLy8gRG9uJ3QgZW50ZXIgc2VhcmNoIG1vZGUgZm9yIG5hdmlnYXRpb24ga2V5c1xuICAgICAgICAgIGlucHV0ICE9PSAnaicgJiZcbiAgICAgICAgICBpbnB1dCAhPT0gJ2snICYmXG4gICAgICAgICAgaW5wdXQgIT09ICdpJ1xuICAgICAgICApIHtcbiAgICAgICAgICBzZXRJc1NlYXJjaE1vZGUodHJ1ZSlcbiAgICAgICAgICBzZXRTZWFyY2hRdWVyeShpbnB1dClcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgeyBpc0FjdGl2ZTogdmlld1N0YXRlID09PSAncGx1Z2luLWxpc3QnICYmICFsb2FkaW5nIH0sXG4gIClcblxuICAvLyBQbHVnaW4tbGlzdCBuYXZpZ2F0aW9uIChub24tc2VhcmNoIG1vZGUpXG4gIHVzZUtleWJpbmRpbmdzKFxuICAgIHtcbiAgICAgICdzZWxlY3Q6cHJldmlvdXMnOiAoKSA9PiB7XG4gICAgICAgIGlmIChzZWxlY3RlZEluZGV4ID09PSAwKSB7XG4gICAgICAgICAgc2V0SXNTZWFyY2hNb2RlKHRydWUpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGFnaW5hdGlvbi5oYW5kbGVTZWxlY3Rpb25DaGFuZ2Uoc2VsZWN0ZWRJbmRleCAtIDEsIHNldFNlbGVjdGVkSW5kZXgpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAnc2VsZWN0Om5leHQnOiAoKSA9PiB7XG4gICAgICAgIGlmIChzZWxlY3RlZEluZGV4IDwgZmlsdGVyZWRQbHVnaW5zLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICBwYWdpbmF0aW9uLmhhbmRsZVNlbGVjdGlvbkNoYW5nZShzZWxlY3RlZEluZGV4ICsgMSwgc2V0U2VsZWN0ZWRJbmRleClcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICdzZWxlY3Q6YWNjZXB0JzogKCkgPT4ge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc2VsZWN0ZWRJbmRleCA9PT0gZmlsdGVyZWRQbHVnaW5zLmxlbmd0aCAmJlxuICAgICAgICAgIHNlbGVjdGVkRm9ySW5zdGFsbC5zaXplID4gMFxuICAgICAgICApIHtcbiAgICAgICAgICB2b2lkIGluc3RhbGxTZWxlY3RlZFBsdWdpbnMoKVxuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdGVkSW5kZXggPCBmaWx0ZXJlZFBsdWdpbnMubGVuZ3RoKSB7XG4gICAgICAgICAgY29uc3QgcGx1Z2luID0gZmlsdGVyZWRQbHVnaW5zW3NlbGVjdGVkSW5kZXhdXG4gICAgICAgICAgaWYgKHBsdWdpbikge1xuICAgICAgICAgICAgaWYgKHBsdWdpbi5pc0luc3RhbGxlZCkge1xuICAgICAgICAgICAgICBzZXRQYXJlbnRWaWV3U3RhdGUoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdtYW5hZ2UtcGx1Z2lucycsXG4gICAgICAgICAgICAgICAgdGFyZ2V0UGx1Z2luOiBwbHVnaW4uZW50cnkubmFtZSxcbiAgICAgICAgICAgICAgICB0YXJnZXRNYXJrZXRwbGFjZTogcGx1Z2luLm1hcmtldHBsYWNlTmFtZSxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHNldFNlbGVjdGVkUGx1Z2luKHBsdWdpbilcbiAgICAgICAgICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tZGV0YWlscycpXG4gICAgICAgICAgICAgIHNldERldGFpbHNNZW51SW5kZXgoMClcbiAgICAgICAgICAgICAgc2V0SW5zdGFsbEVycm9yKG51bGwpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ1NlbGVjdCcsXG4gICAgICBpc0FjdGl2ZTogdmlld1N0YXRlID09PSAncGx1Z2luLWxpc3QnICYmICFpc1NlYXJjaE1vZGUsXG4gICAgfSxcbiAgKVxuXG4gIHVzZUtleWJpbmRpbmdzKFxuICAgIHtcbiAgICAgICdwbHVnaW46dG9nZ2xlJzogKCkgPT4ge1xuICAgICAgICBpZiAoc2VsZWN0ZWRJbmRleCA8IGZpbHRlcmVkUGx1Z2lucy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zdCBwbHVnaW4gPSBmaWx0ZXJlZFBsdWdpbnNbc2VsZWN0ZWRJbmRleF1cbiAgICAgICAgICBpZiAocGx1Z2luICYmICFwbHVnaW4uaXNJbnN0YWxsZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld1NlbGVjdGlvbiA9IG5ldyBTZXQoc2VsZWN0ZWRGb3JJbnN0YWxsKVxuICAgICAgICAgICAgaWYgKG5ld1NlbGVjdGlvbi5oYXMocGx1Z2luLnBsdWdpbklkKSkge1xuICAgICAgICAgICAgICBuZXdTZWxlY3Rpb24uZGVsZXRlKHBsdWdpbi5wbHVnaW5JZClcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5ld1NlbGVjdGlvbi5hZGQocGx1Z2luLnBsdWdpbklkKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2V0U2VsZWN0ZWRGb3JJbnN0YWxsKG5ld1NlbGVjdGlvbilcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAncGx1Z2luOmluc3RhbGwnOiAoKSA9PiB7XG4gICAgICAgIGlmIChzZWxlY3RlZEZvckluc3RhbGwuc2l6ZSA+IDApIHtcbiAgICAgICAgICB2b2lkIGluc3RhbGxTZWxlY3RlZFBsdWdpbnMoKVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ1BsdWdpbicsXG4gICAgICBpc0FjdGl2ZTogdmlld1N0YXRlID09PSAncGx1Z2luLWxpc3QnICYmICFpc1NlYXJjaE1vZGUsXG4gICAgfSxcbiAgKVxuXG4gIC8vIFBsdWdpbi1kZXRhaWxzIG5hdmlnYXRpb25cbiAgY29uc3QgZGV0YWlsc01lbnVPcHRpb25zID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCFzZWxlY3RlZFBsdWdpbikgcmV0dXJuIFtdXG4gICAgY29uc3QgaGFzSG9tZXBhZ2UgPSBzZWxlY3RlZFBsdWdpbi5lbnRyeS5ob21lcGFnZVxuICAgIGNvbnN0IGdpdGh1YlJlcG8gPSBleHRyYWN0R2l0SHViUmVwbyhzZWxlY3RlZFBsdWdpbilcbiAgICByZXR1cm4gYnVpbGRQbHVnaW5EZXRhaWxzTWVudU9wdGlvbnMoaGFzSG9tZXBhZ2UsIGdpdGh1YlJlcG8pXG4gIH0sIFtzZWxlY3RlZFBsdWdpbl0pXG5cbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ3NlbGVjdDpwcmV2aW91cyc6ICgpID0+IHtcbiAgICAgICAgaWYgKGRldGFpbHNNZW51SW5kZXggPiAwKSB7XG4gICAgICAgICAgc2V0RGV0YWlsc01lbnVJbmRleChkZXRhaWxzTWVudUluZGV4IC0gMSlcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICdzZWxlY3Q6bmV4dCc6ICgpID0+IHtcbiAgICAgICAgaWYgKGRldGFpbHNNZW51SW5kZXggPCBkZXRhaWxzTWVudU9wdGlvbnMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIHNldERldGFpbHNNZW51SW5kZXgoZGV0YWlsc01lbnVJbmRleCArIDEpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAnc2VsZWN0OmFjY2VwdCc6ICgpID0+IHtcbiAgICAgICAgaWYgKCFzZWxlY3RlZFBsdWdpbikgcmV0dXJuXG4gICAgICAgIGNvbnN0IGFjdGlvbiA9IGRldGFpbHNNZW51T3B0aW9uc1tkZXRhaWxzTWVudUluZGV4XT8uYWN0aW9uXG4gICAgICAgIGNvbnN0IGhhc0hvbWVwYWdlID0gc2VsZWN0ZWRQbHVnaW4uZW50cnkuaG9tZXBhZ2VcbiAgICAgICAgY29uc3QgZ2l0aHViUmVwbyA9IGV4dHJhY3RHaXRIdWJSZXBvKHNlbGVjdGVkUGx1Z2luKVxuICAgICAgICBpZiAoYWN0aW9uID09PSAnaW5zdGFsbC11c2VyJykge1xuICAgICAgICAgIHZvaWQgaGFuZGxlU2luZ2xlUGx1Z2luSW5zdGFsbChzZWxlY3RlZFBsdWdpbiwgJ3VzZXInKVxuICAgICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2luc3RhbGwtcHJvamVjdCcpIHtcbiAgICAgICAgICB2b2lkIGhhbmRsZVNpbmdsZVBsdWdpbkluc3RhbGwoc2VsZWN0ZWRQbHVnaW4sICdwcm9qZWN0JylcbiAgICAgICAgfSBlbHNlIGlmIChhY3Rpb24gPT09ICdpbnN0YWxsLWxvY2FsJykge1xuICAgICAgICAgIHZvaWQgaGFuZGxlU2luZ2xlUGx1Z2luSW5zdGFsbChzZWxlY3RlZFBsdWdpbiwgJ2xvY2FsJylcbiAgICAgICAgfSBlbHNlIGlmIChhY3Rpb24gPT09ICdob21lcGFnZScgJiYgaGFzSG9tZXBhZ2UpIHtcbiAgICAgICAgICB2b2lkIG9wZW5Ccm93c2VyKGhhc0hvbWVwYWdlKVxuICAgICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2dpdGh1YicgJiYgZ2l0aHViUmVwbykge1xuICAgICAgICAgIHZvaWQgb3BlbkJyb3dzZXIoYGh0dHBzOi8vZ2l0aHViLmNvbS8ke2dpdGh1YlJlcG99YClcbiAgICAgICAgfSBlbHNlIGlmIChhY3Rpb24gPT09ICdiYWNrJykge1xuICAgICAgICAgIHNldFZpZXdTdGF0ZSgncGx1Z2luLWxpc3QnKVxuICAgICAgICAgIHNldFNlbGVjdGVkUGx1Z2luKG51bGwpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnU2VsZWN0JyxcbiAgICAgIGlzQWN0aXZlOiB2aWV3U3RhdGUgPT09ICdwbHVnaW4tZGV0YWlscycgJiYgISFzZWxlY3RlZFBsdWdpbixcbiAgICB9LFxuICApXG5cbiAgaWYgKHR5cGVvZiB2aWV3U3RhdGUgPT09ICdvYmplY3QnICYmIHZpZXdTdGF0ZS50eXBlID09PSAncGx1Z2luLW9wdGlvbnMnKSB7XG4gICAgY29uc3QgeyBwbHVnaW4sIHBsdWdpbklkIH0gPSB2aWV3U3RhdGVcbiAgICBmdW5jdGlvbiBmaW5pc2gobXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIHNldFJlc3VsdChtc2cpXG4gICAgICBpZiAob25JbnN0YWxsQ29tcGxldGUpIHtcbiAgICAgICAgdm9pZCBvbkluc3RhbGxDb21wbGV0ZSgpXG4gICAgICB9XG4gICAgICBzZXRQYXJlbnRWaWV3U3RhdGUoeyB0eXBlOiAnbWVudScgfSlcbiAgICB9XG4gICAgcmV0dXJuIChcbiAgICAgIDxQbHVnaW5PcHRpb25zRmxvd1xuICAgICAgICBwbHVnaW49e3BsdWdpbn1cbiAgICAgICAgcGx1Z2luSWQ9e3BsdWdpbklkfVxuICAgICAgICBvbkRvbmU9eyhvdXRjb21lLCBkZXRhaWwpID0+IHtcbiAgICAgICAgICBzd2l0Y2ggKG91dGNvbWUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2NvbmZpZ3VyZWQnOlxuICAgICAgICAgICAgICBmaW5pc2goXG4gICAgICAgICAgICAgICAgYOKckyBJbnN0YWxsZWQgYW5kIGNvbmZpZ3VyZWQgJHtwbHVnaW4ubmFtZX0uIFJ1biAvcmVsb2FkLXBsdWdpbnMgdG8gYXBwbHkuYCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgY2FzZSAnc2tpcHBlZCc6XG4gICAgICAgICAgICAgIGZpbmlzaChcbiAgICAgICAgICAgICAgICBg4pyTIEluc3RhbGxlZCAke3BsdWdpbi5uYW1lfS4gUnVuIC9yZWxvYWQtcGx1Z2lucyB0byBhcHBseS5gLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgICAgIGZpbmlzaChgSW5zdGFsbGVkIGJ1dCBmYWlsZWQgdG8gc2F2ZSBjb25maWc6ICR7ZGV0YWlsfWApXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9fVxuICAgICAgLz5cbiAgICApXG4gIH1cblxuICAvLyBMb2FkaW5nIHN0YXRlXG4gIGlmIChsb2FkaW5nKSB7XG4gICAgcmV0dXJuIDxUZXh0PkxvYWRpbmfigKY8L1RleHQ+XG4gIH1cblxuICAvLyBFcnJvciBzdGF0ZVxuICBpZiAoZXJyb3IpIHtcbiAgICByZXR1cm4gPFRleHQgY29sb3I9XCJlcnJvclwiPntlcnJvcn08L1RleHQ+XG4gIH1cblxuICAvLyBQbHVnaW4gZGV0YWlscyB2aWV3XG4gIGlmICh2aWV3U3RhdGUgPT09ICdwbHVnaW4tZGV0YWlscycgJiYgc2VsZWN0ZWRQbHVnaW4pIHtcbiAgICBjb25zdCBoYXNIb21lcGFnZSA9IHNlbGVjdGVkUGx1Z2luLmVudHJ5LmhvbWVwYWdlXG4gICAgY29uc3QgZ2l0aHViUmVwbyA9IGV4dHJhY3RHaXRIdWJSZXBvKHNlbGVjdGVkUGx1Z2luKVxuXG4gICAgY29uc3QgbWVudU9wdGlvbnMgPSBidWlsZFBsdWdpbkRldGFpbHNNZW51T3B0aW9ucyhoYXNIb21lcGFnZSwgZ2l0aHViUmVwbylcblxuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgIDxUZXh0IGJvbGQ+UGx1Z2luIGRldGFpbHM8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgPFRleHQgYm9sZD57c2VsZWN0ZWRQbHVnaW4uZW50cnkubmFtZX08L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+ZnJvbSB7c2VsZWN0ZWRQbHVnaW4ubWFya2V0cGxhY2VOYW1lfTwvVGV4dD5cbiAgICAgICAgICB7c2VsZWN0ZWRQbHVnaW4uZW50cnkudmVyc2lvbiAmJiAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5WZXJzaW9uOiB7c2VsZWN0ZWRQbHVnaW4uZW50cnkudmVyc2lvbn08L1RleHQ+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7c2VsZWN0ZWRQbHVnaW4uZW50cnkuZGVzY3JpcHRpb24gJiYgKFxuICAgICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICA8VGV4dD57c2VsZWN0ZWRQbHVnaW4uZW50cnkuZGVzY3JpcHRpb259PC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7c2VsZWN0ZWRQbHVnaW4uZW50cnkuYXV0aG9yICYmIChcbiAgICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgQnk6eycgJ31cbiAgICAgICAgICAgICAgICB7dHlwZW9mIHNlbGVjdGVkUGx1Z2luLmVudHJ5LmF1dGhvciA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgICAgICAgID8gc2VsZWN0ZWRQbHVnaW4uZW50cnkuYXV0aG9yXG4gICAgICAgICAgICAgICAgICA6IHNlbGVjdGVkUGx1Z2luLmVudHJ5LmF1dGhvci5uYW1lfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cblxuICAgICAgICA8UGx1Z2luVHJ1c3RXYXJuaW5nIC8+XG5cbiAgICAgICAge2luc3RhbGxFcnJvciAmJiAoXG4gICAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPkVycm9yOiB7aW5zdGFsbEVycm9yfTwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cblxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICB7bWVudU9wdGlvbnMubWFwKChvcHRpb24sIGluZGV4KSA9PiAoXG4gICAgICAgICAgICA8Qm94IGtleT17b3B0aW9uLmFjdGlvbn0+XG4gICAgICAgICAgICAgIHtkZXRhaWxzTWVudUluZGV4ID09PSBpbmRleCAmJiA8VGV4dD57Jz4gJ308L1RleHQ+fVxuICAgICAgICAgICAgICB7ZGV0YWlsc01lbnVJbmRleCAhPT0gaW5kZXggJiYgPFRleHQ+eycgICd9PC9UZXh0Pn1cbiAgICAgICAgICAgICAgPFRleHQgYm9sZD17ZGV0YWlsc01lbnVJbmRleCA9PT0gaW5kZXh9PlxuICAgICAgICAgICAgICAgIHtpc0luc3RhbGxpbmcgJiYgb3B0aW9uLmFjdGlvbi5zdGFydHNXaXRoKCdpbnN0YWxsLScpXG4gICAgICAgICAgICAgICAgICA/ICdJbnN0YWxsaW5n4oCmJ1xuICAgICAgICAgICAgICAgICAgOiBvcHRpb24ubGFiZWx9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICkpfVxuICAgICAgICA8L0JveD5cblxuICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwic2VsZWN0OmFjY2VwdFwiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIlNlbGVjdFwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFbnRlclwiXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJzZWxlY3RcIlxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiYmFja1wiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgLy8gRW1wdHkgc3RhdGVcbiAgaWYgKGF2YWlsYWJsZVBsdWdpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgPFRleHQgYm9sZD5EaXNjb3ZlciBwbHVnaW5zPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICAgPEVtcHR5U3RhdGVNZXNzYWdlIHJlYXNvbj17ZW1wdHlSZWFzb259IC8+XG4gICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICBFc2MgdG8gZ28gYmFja1xuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICAvLyBHZXQgdmlzaWJsZSBwbHVnaW5zIGZyb20gcGFnaW5hdGlvblxuICBjb25zdCB2aXNpYmxlUGx1Z2lucyA9IHBhZ2luYXRpb24uZ2V0VmlzaWJsZUl0ZW1zKGZpbHRlcmVkUGx1Z2lucylcblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgPEJveD5cbiAgICAgICAgPFRleHQgYm9sZD5EaXNjb3ZlciBwbHVnaW5zPC9UZXh0PlxuICAgICAgICB7cGFnaW5hdGlvbi5uZWVkc1BhZ2luYXRpb24gJiYgKFxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgeycgJ31cbiAgICAgICAgICAgICh7cGFnaW5hdGlvbi5zY3JvbGxQb3NpdGlvbi5jdXJyZW50fS9cbiAgICAgICAgICAgIHtwYWdpbmF0aW9uLnNjcm9sbFBvc2l0aW9uLnRvdGFsfSlcbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICl9XG4gICAgICA8L0JveD5cblxuICAgICAgey8qIFNlYXJjaCBib3ggKi99XG4gICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgIDxTZWFyY2hCb3hcbiAgICAgICAgICBxdWVyeT17c2VhcmNoUXVlcnl9XG4gICAgICAgICAgaXNGb2N1c2VkPXtpc1NlYXJjaE1vZGV9XG4gICAgICAgICAgaXNUZXJtaW5hbEZvY3VzZWQ9e2lzVGVybWluYWxGb2N1c2VkfVxuICAgICAgICAgIHdpZHRoPXt0ZXJtaW5hbFdpZHRoIC0gNH1cbiAgICAgICAgICBjdXJzb3JPZmZzZXQ9e3NlYXJjaEN1cnNvck9mZnNldH1cbiAgICAgICAgLz5cbiAgICAgIDwvQm94PlxuXG4gICAgICB7LyogV2FybmluZyBiYW5uZXIgKi99XG4gICAgICB7d2FybmluZyAmJiAoXG4gICAgICAgIDxCb3ggbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5cbiAgICAgICAgICAgIHtmaWd1cmVzLndhcm5pbmd9IHt3YXJuaW5nfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICB7LyogTm8gc2VhcmNoIHJlc3VsdHMgKi99XG4gICAgICB7ZmlsdGVyZWRQbHVnaW5zLmxlbmd0aCA9PT0gMCAmJiBzZWFyY2hRdWVyeSAmJiAoXG4gICAgICAgIDxCb3ggbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5ObyBwbHVnaW5zIG1hdGNoICZxdW90O3tzZWFyY2hRdWVyeX0mcXVvdDs8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cblxuICAgICAgey8qIFNjcm9sbCB1cCBpbmRpY2F0b3IgKi99XG4gICAgICB7cGFnaW5hdGlvbi5zY3JvbGxQb3NpdGlvbi5jYW5TY3JvbGxVcCAmJiAoXG4gICAgICAgIDxCb3g+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+IHtmaWd1cmVzLmFycm93VXB9IG1vcmUgYWJvdmU8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cblxuICAgICAgey8qIFBsdWdpbiBsaXN0IC0gdXNlIHN0YXJ0SW5kZXggaW4ga2V5IHRvIGZvcmNlIHJlLXJlbmRlciBvbiBzY3JvbGwgKi99XG4gICAgICB7dmlzaWJsZVBsdWdpbnMubWFwKChwbHVnaW4sIHZpc2libGVJbmRleCkgPT4ge1xuICAgICAgICBjb25zdCBhY3R1YWxJbmRleCA9IHBhZ2luYXRpb24udG9BY3R1YWxJbmRleCh2aXNpYmxlSW5kZXgpXG4gICAgICAgIGNvbnN0IGlzU2VsZWN0ZWQgPSBzZWxlY3RlZEluZGV4ID09PSBhY3R1YWxJbmRleFxuICAgICAgICBjb25zdCBpc1NlbGVjdGVkRm9ySW5zdGFsbCA9IHNlbGVjdGVkRm9ySW5zdGFsbC5oYXMocGx1Z2luLnBsdWdpbklkKVxuICAgICAgICBjb25zdCBpc0luc3RhbGxpbmdUaGlzID0gaW5zdGFsbGluZ1BsdWdpbnMuaGFzKHBsdWdpbi5wbHVnaW5JZClcbiAgICAgICAgY29uc3QgaXNMYXN0ID0gdmlzaWJsZUluZGV4ID09PSB2aXNpYmxlUGx1Z2lucy5sZW5ndGggLSAxXG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8Qm94XG4gICAgICAgICAgICBrZXk9e2Ake3BhZ2luYXRpb24uc3RhcnRJbmRleH0tJHtwbHVnaW4ucGx1Z2luSWR9YH1cbiAgICAgICAgICAgIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIlxuICAgICAgICAgICAgbWFyZ2luQm90dG9tPXtpc0xhc3QgJiYgIWVycm9yID8gMCA6IDF9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICBjb2xvcj17aXNTZWxlY3RlZCAmJiAhaXNTZWFyY2hNb2RlID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAge2lzU2VsZWN0ZWQgJiYgIWlzU2VhcmNoTW9kZSA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ317JyAnfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgIHtpc0luc3RhbGxpbmdUaGlzXG4gICAgICAgICAgICAgICAgICA/IGZpZ3VyZXMuZWxsaXBzaXNcbiAgICAgICAgICAgICAgICAgIDogaXNTZWxlY3RlZEZvckluc3RhbGxcbiAgICAgICAgICAgICAgICAgICAgPyBmaWd1cmVzLnJhZGlvT25cbiAgICAgICAgICAgICAgICAgICAgOiBmaWd1cmVzLnJhZGlvT2ZmfXsnICd9XG4gICAgICAgICAgICAgICAge3BsdWdpbi5lbnRyeS5uYW1lfVxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiDCtyB7cGx1Z2luLm1hcmtldHBsYWNlTmFtZX08L1RleHQ+XG4gICAgICAgICAgICAgICAge3BsdWdpbi5lbnRyeS50YWdzPy5pbmNsdWRlcygnY29tbXVuaXR5LW1hbmFnZWQnKSAmJiAoXG4gICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4gW0NvbW11bml0eSBNYW5hZ2VkXTwvVGV4dD5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIHtpbnN0YWxsQ291bnRzICYmXG4gICAgICAgICAgICAgICAgICBwbHVnaW4ubWFya2V0cGxhY2VOYW1lID09PSBPRkZJQ0lBTF9NQVJLRVRQTEFDRV9OQU1FICYmIChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgICAgeycgwrcgJ31cbiAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0SW5zdGFsbENvdW50KFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFsbENvdW50cy5nZXQocGx1Z2luLnBsdWdpbklkKSA/PyAwLFxuICAgICAgICAgICAgICAgICAgICAgICl9eycgJ31cbiAgICAgICAgICAgICAgICAgICAgICBpbnN0YWxsc1xuICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgIHtwbHVnaW4uZW50cnkuZGVzY3JpcHRpb24gJiYgKFxuICAgICAgICAgICAgICA8Qm94IG1hcmdpbkxlZnQ9ezR9PlxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAge3RydW5jYXRlVG9XaWR0aChwbHVnaW4uZW50cnkuZGVzY3JpcHRpb24sIDYwKX1cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKVxuICAgICAgfSl9XG5cbiAgICAgIHsvKiBTY3JvbGwgZG93biBpbmRpY2F0b3IgKi99XG4gICAgICB7cGFnaW5hdGlvbi5zY3JvbGxQb3NpdGlvbi5jYW5TY3JvbGxEb3duICYmIChcbiAgICAgICAgPEJveD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4ge2ZpZ3VyZXMuYXJyb3dEb3dufSBtb3JlIGJlbG93PC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBFcnJvciBtZXNzYWdlcyAqL31cbiAgICAgIHtlcnJvciAmJiAoXG4gICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+XG4gICAgICAgICAgICB7ZmlndXJlcy5jcm9zc30ge2Vycm9yfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICA8RGlzY292ZXJQbHVnaW5zS2V5SGludFxuICAgICAgICBoYXNTZWxlY3Rpb249e3NlbGVjdGVkRm9ySW5zdGFsbC5zaXplID4gMH1cbiAgICAgICAgY2FuVG9nZ2xlPXtcbiAgICAgICAgICBzZWxlY3RlZEluZGV4IDwgZmlsdGVyZWRQbHVnaW5zLmxlbmd0aCAmJlxuICAgICAgICAgICFmaWx0ZXJlZFBsdWdpbnNbc2VsZWN0ZWRJbmRleF0/LmlzSW5zdGFsbGVkXG4gICAgICAgIH1cbiAgICAgIC8+XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZnVuY3Rpb24gRGlzY292ZXJQbHVnaW5zS2V5SGludCh7XG4gIGhhc1NlbGVjdGlvbixcbiAgY2FuVG9nZ2xlLFxufToge1xuICBoYXNTZWxlY3Rpb246IGJvb2xlYW5cbiAgY2FuVG9nZ2xlOiBib29sZWFuXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgcmV0dXJuIChcbiAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAge2hhc1NlbGVjdGlvbiAmJiAoXG4gICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgIGFjdGlvbj1cInBsdWdpbjppbnN0YWxsXCJcbiAgICAgICAgICAgICAgY29udGV4dD1cIlBsdWdpblwiXG4gICAgICAgICAgICAgIGZhbGxiYWNrPVwiaVwiXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiaW5zdGFsbFwiXG4gICAgICAgICAgICAgIGJvbGRcbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgKX1cbiAgICAgICAgICA8VGV4dD50eXBlIHRvIHNlYXJjaDwvVGV4dD5cbiAgICAgICAgICB7Y2FuVG9nZ2xlICYmIChcbiAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgYWN0aW9uPVwicGx1Z2luOnRvZ2dsZVwiXG4gICAgICAgICAgICAgIGNvbnRleHQ9XCJQbHVnaW5cIlxuICAgICAgICAgICAgICBmYWxsYmFjaz1cIlNwYWNlXCJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJ0b2dnbGVcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApfVxuICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgIGFjdGlvbj1cInNlbGVjdDphY2NlcHRcIlxuICAgICAgICAgICAgY29udGV4dD1cIlNlbGVjdFwiXG4gICAgICAgICAgICBmYWxsYmFjaz1cIkVudGVyXCJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiZGV0YWlsc1wiXG4gICAgICAgICAgLz5cbiAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgZGVzY3JpcHRpb249XCJiYWNrXCJcbiAgICAgICAgICAvPlxuICAgICAgICA8L0J5bGluZT5cbiAgICAgIDwvVGV4dD5cbiAgICA8L0JveD5cbiAgKVxufVxuXG4vKipcbiAqIENvbnRleHQtYXdhcmUgZW1wdHkgc3RhdGUgbWVzc2FnZSBmb3IgdGhlIERpc2NvdmVyIHNjcmVlblxuICovXG5mdW5jdGlvbiBFbXB0eVN0YXRlTWVzc2FnZSh7XG4gIHJlYXNvbixcbn06IHtcbiAgcmVhc29uOiBFbXB0eU1hcmtldHBsYWNlUmVhc29uIHwgbnVsbFxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIHN3aXRjaCAocmVhc29uKSB7XG4gICAgY2FzZSAnZ2l0LW5vdC1pbnN0YWxsZWQnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5HaXQgaXMgcmVxdWlyZWQgdG8gaW5zdGFsbCBtYXJrZXRwbGFjZXMuPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlBsZWFzZSBpbnN0YWxsIGdpdCBhbmQgcmVzdGFydCBDbGF1ZGUgQ29kZS48L1RleHQ+XG4gICAgICAgIDwvPlxuICAgICAgKVxuICAgIGNhc2UgJ2FsbC1ibG9ja2VkLWJ5LXBvbGljeSc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgWW91ciBvcmdhbml6YXRpb24gcG9saWN5IGRvZXMgbm90IGFsbG93IGFueSBleHRlcm5hbCBtYXJrZXRwbGFjZXMuXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPkNvbnRhY3QgeW91ciBhZG1pbmlzdHJhdG9yLjwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApXG4gICAgY2FzZSAncG9saWN5LXJlc3RyaWN0cy1zb3VyY2VzJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICBZb3VyIG9yZ2FuaXphdGlvbiByZXN0cmljdHMgd2hpY2ggbWFya2V0cGxhY2VzIGNhbiBiZSBhZGRlZC5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICBTd2l0Y2ggdG8gdGhlIE1hcmtldHBsYWNlcyB0YWIgdG8gdmlldyBhbGxvd2VkIHNvdXJjZXMuXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8Lz5cbiAgICAgIClcbiAgICBjYXNlICdhbGwtbWFya2V0cGxhY2VzLWZhaWxlZCc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPkZhaWxlZCB0byBsb2FkIG1hcmtldHBsYWNlIGRhdGEuPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPkNoZWNrIHlvdXIgbmV0d29yayBjb25uZWN0aW9uLjwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApXG4gICAgY2FzZSAnYWxsLXBsdWdpbnMtaW5zdGFsbGVkJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+QWxsIGF2YWlsYWJsZSBwbHVnaW5zIGFyZSBhbHJlYWR5IGluc3RhbGxlZC48L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICBDaGVjayBmb3IgbmV3IHBsdWdpbnMgbGF0ZXIgb3IgYWRkIG1vcmUgbWFya2V0cGxhY2VzLlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApXG4gICAgY2FzZSAnbm8tbWFya2V0cGxhY2VzLWNvbmZpZ3VyZWQnOlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPk5vIHBsdWdpbnMgYXZhaWxhYmxlLjwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIEFkZCBhIG1hcmtldHBsYWNlIGZpcnN0IHVzaW5nIHRoZSBNYXJrZXRwbGFjZXMgdGFiLlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC8+XG4gICAgICApXG4gIH1cbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLE9BQU9BLE9BQU8sTUFBTSxTQUFTO0FBQzdCLE9BQU8sS0FB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