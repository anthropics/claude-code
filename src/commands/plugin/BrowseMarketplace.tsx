import figures from 'figures';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js';
import { Byline } from '../../components/design-system/Byline.js';
import { Box, Text } from '../../ink.js';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding.js';
import type { LoadedPlugin } from '../../types/plugin.js';
import { count } from '../../utils/array.js';
import { openBrowser } from '../../utils/browser.js';
import { logForDebugging } from '../../utils/debug.js';
import { errorMessage } from '../../utils/errors.js';
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js';
import { formatInstallCount, getInstallCounts } from '../../utils/plugins/installCounts.js';
import { isPluginGloballyInstalled, isPluginInstalled } from '../../utils/plugins/installedPluginsManager.js';
import { createPluginId, formatFailureDetails, formatMarketplaceLoadingErrors, getMarketplaceSourceDisplay, loadMarketplacesWithGracefulDegradation } from '../../utils/plugins/marketplaceHelpers.js';
import { getMarketplace, loadKnownMarketplacesConfig } from '../../utils/plugins/marketplaceManager.js';
import { OFFICIAL_MARKETPLACE_NAME } from '../../utils/plugins/officialMarketplace.js';
import { installPluginFromMarketplace } from '../../utils/plugins/pluginInstallationHelpers.js';
import { isPluginBlockedByPolicy } from '../../utils/plugins/pluginPolicy.js';
import { plural } from '../../utils/stringUtils.js';
import { truncateToWidth } from '../../utils/truncate.js';
import { findPluginOptionsTarget, PluginOptionsFlow } from './PluginOptionsFlow.js';
import { PluginTrustWarning } from './PluginTrustWarning.js';
import { buildPluginDetailsMenuOptions, extractGitHubRepo, type InstallablePlugin, PluginSelectionKeyHint } from './pluginDetailsHelpers.js';
import type { ViewState as ParentViewState } from './types.js';
import { usePagination } from './usePagination.js';
type Props = {
  error: string | null;
  setError: (error: string | null) => void;
  result: string | null;
  setResult: (result: string | null) => void;
  setViewState: (state: ParentViewState) => void;
  onInstallComplete?: () => void | Promise<void>;
  targetMarketplace?: string;
  targetPlugin?: string;
};
type ViewState = 'marketplace-list' | 'plugin-list' | 'plugin-details' | {
  type: 'plugin-options';
  plugin: LoadedPlugin;
  pluginId: string;
};
type MarketplaceInfo = {
  name: string;
  totalPlugins: number;
  installedCount: number;
  source?: string;
};
export function BrowseMarketplace({
  error,
  setError,
  result: _result,
  setResult,
  setViewState: setParentViewState,
  onInstallComplete,
  targetMarketplace,
  targetPlugin
}: Props): React.ReactNode {
  // View state
  const [viewState, setViewState] = useState<ViewState>('marketplace-list');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<InstallablePlugin | null>(null);

  // Data state
  const [marketplaces, setMarketplaces] = useState<MarketplaceInfo[]>([]);
  const [availablePlugins, setAvailablePlugins] = useState<InstallablePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [installCounts, setInstallCounts] = useState<Map<string, number> | null>(null);

  // Selection state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedForInstall, setSelectedForInstall] = useState<Set<string>>(new Set());
  const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set());

  // Pagination for plugin list (continuous scrolling)
  const pagination = usePagination<InstallablePlugin>({
    totalItems: availablePlugins.length,
    selectedIndex
  });

  // Details view state
  const [detailsMenuIndex, setDetailsMenuIndex] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  // Warning state for non-critical errors (e.g., some marketplaces failed to load)
  const [warning, setWarning] = useState<string | null>(null);

  // Handle escape to go back - viewState-dependent navigation
  const handleBack = React.useCallback(() => {
    if (viewState === 'plugin-list') {
      // If navigated directly to a specific marketplace via targetMarketplace,
      // go back to manage-marketplaces showing that marketplace's details
      if (targetMarketplace) {
        setParentViewState({
          type: 'manage-marketplaces',
          targetMarketplace
        });
      } else if (marketplaces.length === 1) {
        // If there's only one marketplace, skip the marketplace-list view
        // since we auto-navigated past it on load
        setParentViewState({
          type: 'menu'
        });
      } else {
        setViewState('marketplace-list');
        setSelectedMarketplace(null);
        setSelectedForInstall(new Set());
      }
    } else if (viewState === 'plugin-details') {
      setViewState('plugin-list');
      setSelectedPlugin(null);
    } else {
      // At root level (marketplace-list), exit the plugin menu
      setParentViewState({
        type: 'menu'
      });
    }
  }, [viewState, targetMarketplace, setParentViewState, marketplaces.length]);
  useKeybinding('confirm:no', handleBack, {
    context: 'Confirmation'
  });

  // Load marketplaces and count installed plugins
  useEffect(() => {
    async function loadMarketplaceData() {
      try {
        const config = await loadKnownMarketplacesConfig();

        // Load marketplaces with graceful degradation
        const {
          marketplaces: marketplaces_0,
          failures
        } = await loadMarketplacesWithGracefulDegradation(config);
        const marketplaceInfos: MarketplaceInfo[] = [];
        for (const {
          name,
          config: marketplaceConfig,
          data: marketplace
        } of marketplaces_0) {
          if (marketplace) {
            // Count how many plugins from this marketplace are installed
            const installedFromThisMarketplace = count(marketplace.plugins, plugin => isPluginInstalled(createPluginId(plugin.name, name)));
            marketplaceInfos.push({
              name,
              totalPlugins: marketplace.plugins.length,
              installedCount: installedFromThisMarketplace,
              source: getMarketplaceSourceDisplay(marketplaceConfig.source)
            });
          }
        }

        // Sort so claude-plugin-directory is always first
        marketplaceInfos.sort((a, b) => {
          if (a.name === 'claude-plugin-directory') return -1;
          if (b.name === 'claude-plugin-directory') return 1;
          return 0;
        });
        setMarketplaces(marketplaceInfos);

        // Handle marketplace loading errors/warnings
        const successCount = count(marketplaces_0, m => m.data !== null);
        const errorResult = formatMarketplaceLoadingErrors(failures, successCount);
        if (errorResult) {
          if (errorResult.type === 'warning') {
            setWarning(errorResult.message + '. Showing available marketplaces.');
          } else {
            throw new Error(errorResult.message);
          }
        }

        // Skip marketplace selection if there's only one marketplace
        if (marketplaceInfos.length === 1 && !targetMarketplace && !targetPlugin) {
          const singleMarketplace = marketplaceInfos[0];
          if (singleMarketplace) {
            setSelectedMarketplace(singleMarketplace.name);
            setViewState('plugin-list');
          }
        }

        // Handle targetMarketplace and targetPlugin after marketplaces are loaded
        if (targetPlugin) {
          // Search for the plugin across all marketplaces
          let foundPlugin: InstallablePlugin | null = null;
          let foundMarketplace: string | null = null;
          for (const [name_0] of Object.entries(config)) {
            const marketplace_0 = await getMarketplace(name_0);
            if (marketplace_0) {
              const plugin_0 = marketplace_0.plugins.find(p => p.name === targetPlugin);
              if (plugin_0) {
                const pluginId = createPluginId(plugin_0.name, name_0);
                foundPlugin = {
                  entry: plugin_0,
                  marketplaceName: name_0,
                  pluginId,
                  // isPluginGloballyInstalled: only block when user/managed scope
                  // exists (nothing to add). Project/local-scope installs don't
                  // block — user may want to promote to user scope (gh-29997).
                  isInstalled: isPluginGloballyInstalled(pluginId)
                };
                foundMarketplace = name_0;
                break;
              }
            }
          }
          if (foundPlugin && foundMarketplace) {
            // Block only on global (user/managed) install — project/local scope
            // means the user might still want to add a user-scope entry so the
            // plugin is available in other projects (gh-29997, gh-29240, gh-29392).
            // The plugin-details view offers all three scope options; the backend
            // (installPluginOp → addInstalledPlugin) already supports multiple
            // scope entries per plugin.
            const pluginId_0 = foundPlugin.pluginId;
            const globallyInstalled = isPluginGloballyInstalled(pluginId_0);
            if (globallyInstalled) {
              setError(`Plugin '${pluginId_0}' is already installed globally. Use '/plugin' to manage existing plugins.`);
            } else {
              // Navigate to the plugin details view
              setSelectedMarketplace(foundMarketplace);
              setSelectedPlugin(foundPlugin);
              setViewState('plugin-details');
            }
          } else {
            setError(`Plugin "${targetPlugin}" not found in any marketplace`);
          }
        } else if (targetMarketplace) {
          // Navigate directly to the specified marketplace
          const marketplaceExists = marketplaceInfos.some(m_0 => m_0.name === targetMarketplace);
          if (marketplaceExists) {
            setSelectedMarketplace(targetMarketplace);
            setViewState('plugin-list');
          } else {
            setError(`Marketplace "${targetMarketplace}" not found`);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load marketplaces');
      } finally {
        setLoading(false);
      }
    }
    void loadMarketplaceData();
  }, [setError, targetMarketplace, targetPlugin]);

  // Load plugins when a marketplace is selected
  useEffect(() => {
    if (!selectedMarketplace) return;
    let cancelled = false;
    async function loadPluginsForMarketplace(marketplaceName: string) {
      setLoading(true);
      try {
        const marketplace_1 = await getMarketplace(marketplaceName);
        if (cancelled) return;
        if (!marketplace_1) {
          throw new Error(`Failed to load marketplace: ${marketplaceName}`);
        }

        // Filter out already installed plugins
        const installablePlugins: InstallablePlugin[] = [];
        for (const entry of marketplace_1.plugins) {
          const pluginId_1 = createPluginId(entry.name, marketplaceName);
          if (isPluginBlockedByPolicy(pluginId_1)) continue;
          installablePlugins.push({
            entry,
            marketplaceName: marketplaceName,
            pluginId: pluginId_1,
            // Only mark as "installed" when globally scoped (user/managed).
            // Project/local installs don't block — user can add user scope
            // via the plugin-details view (gh-29997).
            isInstalled: isPluginGloballyInstalled(pluginId_1)
          });
        }

        // Fetch install counts and sort by popularity
        try {
          const counts = await getInstallCounts();
          if (cancelled) return;
          setInstallCounts(counts);
          if (counts) {
            // Sort by install count (descending), then alphabetically
            installablePlugins.sort((a_1, b_1) => {
              const countA = counts.get(a_1.pluginId) ?? 0;
              const countB = counts.get(b_1.pluginId) ?? 0;
              if (countA !== countB) return countB - countA;
              return a_1.entry.name.localeCompare(b_1.entry.name);
            });
          } else {
            // No counts available - sort alphabetically
            installablePlugins.sort((a_2, b_2) => a_2.entry.name.localeCompare(b_2.entry.name));
          }
        } catch (error_0) {
          if (cancelled) return;
          // Log the error, then gracefully degrade to alphabetical sort
          logForDebugging(`Failed to fetch install counts: ${errorMessage(error_0)}`);
          installablePlugins.sort((a_0, b_0) => a_0.entry.name.localeCompare(b_0.entry.name));
        }
        setAvailablePlugins(installablePlugins);
        setSelectedIndex(0);
        setSelectedForInstall(new Set());
      } catch (err_0) {
        if (cancelled) return;
        setError(err_0 instanceof Error ? err_0.message : 'Failed to load plugins');
      } finally {
        setLoading(false);
      }
    }
    void loadPluginsForMarketplace(selectedMarketplace);
    return () => {
      cancelled = true;
    };
  }, [selectedMarketplace, setError]);

  // Install selected plugins
  const installSelectedPlugins = async () => {
    if (selectedForInstall.size === 0) return;
    const pluginsToInstall = availablePlugins.filter(p_0 => selectedForInstall.has(p_0.pluginId));
    setInstallingPlugins(new Set(pluginsToInstall.map(p_1 => p_1.pluginId)));
    let successCount_0 = 0;
    let failureCount = 0;
    const newFailedPlugins: Array<{
      name: string;
      reason: string;
    }> = [];
    for (const plugin_1 of pluginsToInstall) {
      const result = await installPluginFromMarketplace({
        pluginId: plugin_1.pluginId,
        entry: plugin_1.entry,
        marketplaceName: plugin_1.marketplaceName,
        scope: 'user'
      });
      if (result.success) {
        successCount_0++;
      } else {
        failureCount++;
        newFailedPlugins.push({
          name: plugin_1.entry.name,
          reason: result.error
        });
      }
    }
    setInstallingPlugins(new Set());
    setSelectedForInstall(new Set());
    clearAllCaches();

    // Handle installation results
    if (failureCount === 0) {
      // All succeeded
      const message = `✓ Installed ${successCount_0} ${plural(successCount_0, 'plugin')}. ` + `Run /reload-plugins to activate.`;
      setResult(message);
    } else if (successCount_0 === 0) {
      // All failed - show error with reasons
      setError(`Failed to install: ${formatFailureDetails(newFailedPlugins, true)}`);
    } else {
      // Mixed results - show partial success
      const message_0 = `✓ Installed ${successCount_0} of ${successCount_0 + failureCount} plugins. ` + `Failed: ${formatFailureDetails(newFailedPlugins, false)}. ` + `Run /reload-plugins to activate successfully installed plugins.`;
      setResult(message_0);
    }

    // Handle completion callback and navigation
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
  const handleSinglePluginInstall = async (plugin_2: InstallablePlugin, scope: 'user' | 'project' | 'local' = 'user') => {
    setIsInstalling(true);
    setInstallError(null);
    const result_0 = await installPluginFromMarketplace({
      pluginId: plugin_2.pluginId,
      entry: plugin_2.entry,
      marketplaceName: plugin_2.marketplaceName,
      scope
    });
    if (result_0.success) {
      const loaded = await findPluginOptionsTarget(plugin_2.pluginId);
      if (loaded) {
        setIsInstalling(false);
        setViewState({
          type: 'plugin-options',
          plugin: loaded,
          pluginId: plugin_2.pluginId
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

  // Marketplace-list navigation
  useKeybindings({
    'select:previous': () => {
      if (selectedIndex > 0) {
        setSelectedIndex(selectedIndex - 1);
      }
    },
    'select:next': () => {
      if (selectedIndex < marketplaces.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      }
    },
    'select:accept': () => {
      const marketplace_2 = marketplaces[selectedIndex];
      if (marketplace_2) {
        setSelectedMarketplace(marketplace_2.name);
        setViewState('plugin-list');
      }
    }
  }, {
    context: 'Select',
    isActive: viewState === 'marketplace-list'
  });

  // Plugin-list navigation
  useKeybindings({
    'select:previous': () => {
      if (selectedIndex > 0) {
        pagination.handleSelectionChange(selectedIndex - 1, setSelectedIndex);
      }
    },
    'select:next': () => {
      if (selectedIndex < availablePlugins.length - 1) {
        pagination.handleSelectionChange(selectedIndex + 1, setSelectedIndex);
      }
    },
    'select:accept': () => {
      if (selectedIndex === availablePlugins.length && selectedForInstall.size > 0) {
        void installSelectedPlugins();
      } else if (selectedIndex < availablePlugins.length) {
        const plugin_3 = availablePlugins[selectedIndex];
        if (plugin_3) {
          if (plugin_3.isInstalled) {
            setParentViewState({
              type: 'manage-plugins',
              targetPlugin: plugin_3.entry.name,
              targetMarketplace: plugin_3.marketplaceName
            });
          } else {
            setSelectedPlugin(plugin_3);
            setViewState('plugin-details');
            setDetailsMenuIndex(0);
            setInstallError(null);
          }
        }
      }
    }
  }, {
    context: 'Select',
    isActive: viewState === 'plugin-list'
  });
  useKeybindings({
    'plugin:toggle': () => {
      if (selectedIndex < availablePlugins.length) {
        const plugin_4 = availablePlugins[selectedIndex];
        if (plugin_4 && !plugin_4.isInstalled) {
          const newSelection = new Set(selectedForInstall);
          if (newSelection.has(plugin_4.pluginId)) {
            newSelection.delete(plugin_4.pluginId);
          } else {
            newSelection.add(plugin_4.pluginId);
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
    isActive: viewState === 'plugin-list'
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
      plugin: plugin_5,
      pluginId: pluginId_2
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
    return <PluginOptionsFlow plugin={plugin_5} pluginId={pluginId_2} onDone={(outcome, detail) => {
      switch (outcome) {
        case 'configured':
          finish(`✓ Installed and configured ${plugin_5.name}. Run /reload-plugins to apply.`);
          break;
        case 'skipped':
          finish(`✓ Installed ${plugin_5.name}. Run /reload-plugins to apply.`);
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

  // Marketplace selection view
  if (viewState === 'marketplace-list') {
    if (marketplaces.length === 0) {
      return <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Select marketplace</Text>
          </Box>
          <Text>No marketplaces configured.</Text>
          <Text dimColor>
            Add a marketplace first using {"'Add marketplace'"}.
          </Text>
          <Box marginTop={1} paddingLeft={1}>
            <Text dimColor>
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" />
            </Text>
          </Box>
        </Box>;
    }
    return <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Select marketplace</Text>
        </Box>

        {/* Warning banner for marketplace load failures */}
        {warning && <Box marginBottom={1} flexDirection="column">
            <Text color="warning">
              {figures.warning} {warning}
            </Text>
          </Box>}
        {marketplaces.map((marketplace_3, index) => <Box key={marketplace_3.name} flexDirection="column" marginBottom={index < marketplaces.length - 1 ? 1 : 0}>
            <Box>
              <Text color={selectedIndex === index ? 'suggestion' : undefined}>
                {selectedIndex === index ? figures.pointer : ' '}{' '}
                {marketplace_3.name}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text dimColor>
                {marketplace_3.totalPlugins}{' '}
                {plural(marketplace_3.totalPlugins, 'plugin')} available
                {marketplace_3.installedCount > 0 && ` · ${marketplace_3.installedCount} already installed`}
                {marketplace_3.source && ` · ${marketplace_3.source}`}
              </Text>
            </Box>
          </Box>)}

        <Box marginTop={1}>
          <Text dimColor italic>
            <Byline>
              <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="select" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" />
            </Byline>
          </Text>
        </Box>
      </Box>;
  }

  // Plugin details view
  if (viewState === 'plugin-details' && selectedPlugin) {
    const hasHomepage_1 = selectedPlugin.entry.homepage;
    const githubRepo_1 = extractGitHubRepo(selectedPlugin);
    const menuOptions = buildPluginDetailsMenuOptions(hasHomepage_1, githubRepo_1);
    return <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Plugin Details</Text>
        </Box>

        {/* Plugin metadata */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>{selectedPlugin.entry.name}</Text>
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

        {/* What will be installed */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Will install:</Text>
          {selectedPlugin.entry.commands && <Text dimColor>
              · Commands:{' '}
              {Array.isArray(selectedPlugin.entry.commands) ? selectedPlugin.entry.commands.join(', ') : Object.keys(selectedPlugin.entry.commands).join(', ')}
            </Text>}
          {selectedPlugin.entry.agents && <Text dimColor>
              · Agents:{' '}
              {Array.isArray(selectedPlugin.entry.agents) ? selectedPlugin.entry.agents.join(', ') : Object.keys(selectedPlugin.entry.agents).join(', ')}
            </Text>}
          {selectedPlugin.entry.hooks && <Text dimColor>
              · Hooks: {Object.keys(selectedPlugin.entry.hooks).join(', ')}
            </Text>}
          {selectedPlugin.entry.mcpServers && <Text dimColor>
              · MCP Servers:{' '}
              {Array.isArray(selectedPlugin.entry.mcpServers) ? selectedPlugin.entry.mcpServers.join(', ') : typeof selectedPlugin.entry.mcpServers === 'object' ? Object.keys(selectedPlugin.entry.mcpServers).join(', ') : 'configured'}
            </Text>}
          {!selectedPlugin.entry.commands && !selectedPlugin.entry.agents && !selectedPlugin.entry.hooks && !selectedPlugin.entry.mcpServers && <>
                {typeof selectedPlugin.entry.source === 'object' && 'source' in selectedPlugin.entry.source && (selectedPlugin.entry.source.source === 'github' || selectedPlugin.entry.source.source === 'url' || selectedPlugin.entry.source.source === 'npm' || selectedPlugin.entry.source.source === 'pip') ? <Text dimColor>
                    · Component summary not available for remote plugin
                  </Text> :
          // TODO: Actually scan local plugin directories to show real components
          // This would require accessing the filesystem to check for:
          // - commands/ directory and list files
          // - agents/ directory and list files
          // - hooks/ directory and list files
          // - .mcp.json or mcp-servers.json files
          <Text dimColor>
                    · Components will be discovered at installation
                  </Text>}
              </>}
        </Box>

        <PluginTrustWarning />

        {/* Error message */}
        {installError && <Box marginBottom={1}>
            <Text color="error">Error: {installError}</Text>
          </Box>}

        {/* Menu options */}
        <Box flexDirection="column">
          {menuOptions.map((option, index_0) => <Box key={option.action}>
              {detailsMenuIndex === index_0 && <Text>{'> '}</Text>}
              {detailsMenuIndex !== index_0 && <Text>{'  '}</Text>}
              <Text bold={detailsMenuIndex === index_0}>
                {isInstalling && option.action === 'install' ? 'Installing…' : option.label}
              </Text>
            </Box>)}
        </Box>

        <Box marginTop={1} paddingLeft={1}>
          <Text dimColor>
            <Byline>
              <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="select" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
            </Byline>
          </Text>
        </Box>
      </Box>;
  }

  // Plugin installation view
  if (availablePlugins.length === 0) {
    return <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Install plugins</Text>
        </Box>
        <Text dimColor>No new plugins available to install.</Text>
        <Text dimColor>
          All plugins from this marketplace are already installed.
        </Text>
        <Box marginLeft={3}>
          <Text dimColor italic>
            <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" />
          </Text>
        </Box>
      </Box>;
  }

  // Get visible plugins from pagination
  const visiblePlugins = pagination.getVisibleItems(availablePlugins);
  return <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Install Plugins</Text>
      </Box>

      {/* Scroll up indicator */}
      {pagination.scrollPosition.canScrollUp && <Box>
          <Text dimColor> {figures.arrowUp} more above</Text>
        </Box>}

      {/* Plugin list */}
      {visiblePlugins.map((plugin_6, visibleIndex) => {
      const actualIndex = pagination.toActualIndex(visibleIndex);
      const isSelected = selectedIndex === actualIndex;
      const isSelectedForInstall = selectedForInstall.has(plugin_6.pluginId);
      const isInstalling_0 = installingPlugins.has(plugin_6.pluginId);
      const isLast = visibleIndex === visiblePlugins.length - 1;
      return <Box key={plugin_6.pluginId} flexDirection="column" marginBottom={isLast && !error ? 0 : 1}>
            <Box>
              <Text color={isSelected ? 'suggestion' : undefined}>
                {isSelected ? figures.pointer : ' '}{' '}
              </Text>
              <Text color={plugin_6.isInstalled ? 'success' : undefined}>
                {plugin_6.isInstalled ? figures.tick : isInstalling_0 ? figures.ellipsis : isSelectedForInstall ? figures.radioOn : figures.radioOff}{' '}
                {plugin_6.entry.name}
                {plugin_6.entry.category && <Text dimColor> [{plugin_6.entry.category}]</Text>}
                {plugin_6.entry.tags?.includes('community-managed') && <Text dimColor> [Community Managed]</Text>}
                {plugin_6.isInstalled && <Text dimColor> (installed)</Text>}
                {installCounts && selectedMarketplace === OFFICIAL_MARKETPLACE_NAME && <Text dimColor>
                      {' · '}
                      {formatInstallCount(installCounts.get(plugin_6.pluginId) ?? 0)}{' '}
                      installs
                    </Text>}
              </Text>
            </Box>
            {plugin_6.entry.description && <Box marginLeft={4}>
                <Text dimColor>
                  {truncateToWidth(plugin_6.entry.description, 60)}
                </Text>
                {plugin_6.entry.version && <Text dimColor> · v{plugin_6.entry.version}</Text>}
              </Box>}
          </Box>;
    })}

      {/* Scroll down indicator */}
      {pagination.scrollPosition.canScrollDown && <Box>
          <Text dimColor> {figures.arrowDown} more below</Text>
        </Box>}

      {/* Error messages shown in the UI */}
      {error && <Box marginTop={1}>
          <Text color="error">
            {figures.cross} {error}
          </Text>
        </Box>}

      <PluginSelectionKeyHint hasSelection={selectedForInstall.size > 0} />
    </Box>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VFZmZlY3QiLCJ1c2VTdGF0ZSIsIkNvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCIsIkJ5bGluZSIsIkJveCIsIlRleHQiLCJ1c2VLZXliaW5kaW5nIiwidXNlS2V5YmluZGluZ3MiLCJMb2FkZWRQbHVnaW4iLCJjb3VudCIsIm9wZW5Ccm93c2VyIiwibG9nRm9yRGVidWdnaW5nIiwiZXJyb3JNZXNzYWdlIiwiY2xlYXJBbGxDYWNoZXMiLCJmb3JtYXRJbnN0YWxsQ291bnQiLCJnZXRJbnN0YWxsQ291bnRzIiwiaXNQbHVnaW5HbG9iYWxseUluc3RhbGxlZCIsImlzUGx1Z2luSW5zdGFsbGVkIiwiY3JlYXRlUGx1Z2luSWQiLCJmb3JtYXRGYWlsdXJlRGV0YWlscyIsImZvcm1hdE1hcmtldHBsYWNlTG9hZGluZ0Vycm9ycyIsImdldE1hcmtldHBsYWNlU291cmNlRGlzcGxheSIsImxvYWRNYXJrZXRwbGFjZXNXaXRoR3JhY2VmdWxEZWdyYWRhdGlvbiIsImdldE1hcmtldHBsYWNlIiwibG9hZEtub3duTWFya2V0cGxhY2VzQ29uZmlnIiwiT0ZGSUNJQUxfTUFSS0VUUExBQ0VfTkFNRSIsImluc3RhbGxQbHVnaW5Gcm9tTWFya2V0cGxhY2UiLCJpc1BsdWdpbkJsb2NrZWRCeVBvbGljeSIsInBsdXJhbCIsInRydW5jYXRlVG9XaWR0aCIsImZpbmRQbHVnaW5PcHRpb25zVGFyZ2V0IiwiUGx1Z2luT3B0aW9uc0Zsb3ciLCJQbHVnaW5UcnVzdFdhcm5pbmciLCJidWlsZFBsdWdpbkRldGFpbHNNZW51T3B0aW9ucyIsImV4dHJhY3RHaXRIdWJSZXBvIiwiSW5zdGFsbGFibGVQbHVnaW4iLCJQbHVnaW5TZWxlY3Rpb25LZXlIaW50IiwiVmlld1N0YXRlIiwiUGFyZW50Vmlld1N0YXRlIiwidXNlUGFnaW5hdGlvbiIsIlByb3BzIiwiZXJyb3IiLCJzZXRFcnJvciIsInJlc3VsdCIsInNldFJlc3VsdCIsInNldFZpZXdTdGF0ZSIsInN0YXRlIiwib25JbnN0YWxsQ29tcGxldGUiLCJQcm9taXNlIiwidGFyZ2V0TWFya2V0cGxhY2UiLCJ0YXJnZXRQbHVnaW4iLCJ0eXBlIiwicGx1Z2luIiwicGx1Z2luSWQiLCJNYXJrZXRwbGFjZUluZm8iLCJuYW1lIiwidG90YWxQbHVnaW5zIiwiaW5zdGFsbGVkQ291bnQiLCJzb3VyY2UiLCJCcm93c2VNYXJrZXRwbGFjZSIsIl9yZXN1bHQiLCJzZXRQYXJlbnRWaWV3U3RhdGUiLCJSZWFjdE5vZGUiLCJ2aWV3U3RhdGUiLCJzZWxlY3RlZE1hcmtldHBsYWNlIiwic2V0U2VsZWN0ZWRNYXJrZXRwbGFjZSIsInNlbGVjdGVkUGx1Z2luIiwic2V0U2VsZWN0ZWRQbHVnaW4iLCJtYXJrZXRwbGFjZXMiLCJzZXRNYXJrZXRwbGFjZXMiLCJhdmFpbGFibGVQbHVnaW5zIiwic2V0QXZhaWxhYmxlUGx1Z2lucyIsImxvYWRpbmciLCJzZXRMb2FkaW5nIiwiaW5zdGFsbENvdW50cyIsInNldEluc3RhbGxDb3VudHMiLCJNYXAiLCJzZWxlY3RlZEluZGV4Iiwic2V0U2VsZWN0ZWRJbmRleCIsInNlbGVjdGVkRm9ySW5zdGFsbCIsInNldFNlbGVjdGVkRm9ySW5zdGFsbCIsIlNldCIsImluc3RhbGxpbmdQbHVnaW5zIiwic2V0SW5zdGFsbGluZ1BsdWdpbnMiLCJwYWdpbmF0aW9uIiwidG90YWxJdGVtcyIsImxlbmd0aCIsImRldGFpbHNNZW51SW5kZXgiLCJzZXREZXRhaWxzTWVudUluZGV4IiwiaXNJbnN0YWxsaW5nIiwic2V0SXNJbnN0YWxsaW5nIiwiaW5zdGFsbEVycm9yIiwic2V0SW5zdGFsbEVycm9yIiwid2FybmluZyIsInNldFdhcm5pbmciLCJoYW5kbGVCYWNrIiwidXNlQ2FsbGJhY2siLCJjb250ZXh0IiwibG9hZE1hcmtldHBsYWNlRGF0YSIsImNvbmZpZyIsImZhaWx1cmVzIiwibWFya2V0cGxhY2VJbmZvcyIsIm1hcmtldHBsYWNlQ29uZmlnIiwiZGF0YSIsIm1hcmtldHBsYWNlIiwiaW5zdGFsbGVkRnJvbVRoaXNNYXJrZXRwbGFjZSIsInBsdWdpbnMiLCJwdXNoIiwic29ydCIsImEiLCJiIiwic3VjY2Vzc0NvdW50IiwibSIsImVycm9yUmVzdWx0IiwibWVzc2FnZSIsIkVycm9yIiwic2luZ2xlTWFya2V0cGxhY2UiLCJmb3VuZFBsdWdpbiIsImZvdW5kTWFya2V0cGxhY2UiLCJPYmplY3QiLCJlbnRyaWVzIiwiZmluZCIsInAiLCJlbnRyeSIsIm1hcmtldHBsYWNlTmFtZSIsImlzSW5zdGFsbGVkIiwiZ2xvYmFsbHlJbnN0YWxsZWQiLCJtYXJrZXRwbGFjZUV4aXN0cyIsInNvbWUiLCJlcnIiLCJjYW5jZWxsZWQiLCJsb2FkUGx1Z2luc0Zvck1hcmtldHBsYWNlIiwiaW5zdGFsbGFibGVQbHVnaW5zIiwiY291bnRzIiwiY291bnRBIiwiZ2V0IiwiY291bnRCIiwibG9jYWxlQ29tcGFyZSIsImluc3RhbGxTZWxlY3RlZFBsdWdpbnMiLCJzaXplIiwicGx1Z2luc1RvSW5zdGFsbCIsImZpbHRlciIsImhhcyIsIm1hcCIsImZhaWx1cmVDb3VudCIsIm5ld0ZhaWxlZFBsdWdpbnMiLCJBcnJheSIsInJlYXNvbiIsInNjb3BlIiwic3VjY2VzcyIsImhhbmRsZVNpbmdsZVBsdWdpbkluc3RhbGwiLCJsb2FkZWQiLCJzZWxlY3Q6cHJldmlvdXMiLCJzZWxlY3Q6bmV4dCIsInNlbGVjdDphY2NlcHQiLCJpc0FjdGl2ZSIsImhhbmRsZVNlbGVjdGlvbkNoYW5nZSIsInBsdWdpbjp0b2dnbGUiLCJuZXdTZWxlY3Rpb24iLCJkZWxldGUiLCJhZGQiLCJwbHVnaW46aW5zdGFsbCIsImRldGFpbHNNZW51T3B0aW9ucyIsInVzZU1lbW8iLCJoYXNIb21lcGFnZSIsImhvbWVwYWdlIiwiZ2l0aHViUmVwbyIsImFjdGlvbiIsImZpbmlzaCIsIm1zZyIsIm91dGNvbWUiLCJkZXRhaWwiLCJpbmRleCIsInVuZGVmaW5lZCIsInBvaW50ZXIiLCJtZW51T3B0aW9ucyIsInZlcnNpb24iLCJkZXNjcmlwdGlvbiIsImF1dGhvciIsImNvbW1hbmRzIiwiaXNBcnJheSIsImpvaW4iLCJrZXlzIiwiYWdlbnRzIiwiaG9va3MiLCJtY3BTZXJ2ZXJzIiwib3B0aW9uIiwibGFiZWwiLCJ2aXNpYmxlUGx1Z2lucyIsImdldFZpc2libGVJdGVtcyIsInNjcm9sbFBvc2l0aW9uIiwiY2FuU2Nyb2xsVXAiLCJhcnJvd1VwIiwidmlzaWJsZUluZGV4IiwiYWN0dWFsSW5kZXgiLCJ0b0FjdHVhbEluZGV4IiwiaXNTZWxlY3RlZCIsImlzU2VsZWN0ZWRGb3JJbnN0YWxsIiwiaXNMYXN0IiwidGljayIsImVsbGlwc2lzIiwicmFkaW9PbiIsInJhZGlvT2ZmIiwiY2F0ZWdvcnkiLCJ0YWdzIiwiaW5jbHVkZXMiLCJjYW5TY3JvbGxEb3duIiwiYXJyb3dEb3duIiwiY3Jvc3MiXSwic291cmNlcyI6WyJCcm93c2VNYXJrZXRwbGFjZS50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9Db25maWd1cmFibGVTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQgeyBCeWxpbmUgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2Rlc2lnbi1zeXN0ZW0vQnlsaW5lLmpzJ1xuaW1wb3J0IHsgQm94LCBUZXh0IH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHtcbiAgdXNlS2V5YmluZGluZyxcbiAgdXNlS2V5YmluZGluZ3MsXG59IGZyb20gJy4uLy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQgdHlwZSB7IExvYWRlZFBsdWdpbiB9IGZyb20gJy4uLy4uL3R5cGVzL3BsdWdpbi5qcydcbmltcG9ydCB7IGNvdW50IH0gZnJvbSAnLi4vLi4vdXRpbHMvYXJyYXkuanMnXG5pbXBvcnQgeyBvcGVuQnJvd3NlciB9IGZyb20gJy4uLy4uL3V0aWxzL2Jyb3dzZXIuanMnXG5pbXBvcnQgeyBsb2dGb3JEZWJ1Z2dpbmcgfSBmcm9tICcuLi8uLi91dGlscy9kZWJ1Zy5qcydcbmltcG9ydCB7IGVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9ycy5qcydcbmltcG9ydCB7IGNsZWFyQWxsQ2FjaGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9jYWNoZVV0aWxzLmpzJ1xuaW1wb3J0IHtcbiAgZm9ybWF0SW5zdGFsbENvdW50LFxuICBnZXRJbnN0YWxsQ291bnRzLFxufSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL2luc3RhbGxDb3VudHMuanMnXG5pbXBvcnQge1xuICBpc1BsdWdpbkdsb2JhbGx5SW5zdGFsbGVkLFxuICBpc1BsdWdpbkluc3RhbGxlZCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9pbnN0YWxsZWRQbHVnaW5zTWFuYWdlci5qcydcbmltcG9ydCB7XG4gIGNyZWF0ZVBsdWdpbklkLFxuICBmb3JtYXRGYWlsdXJlRGV0YWlscyxcbiAgZm9ybWF0TWFya2V0cGxhY2VMb2FkaW5nRXJyb3JzLFxuICBnZXRNYXJrZXRwbGFjZVNvdXJjZURpc3BsYXksXG4gIGxvYWRNYXJrZXRwbGFjZXNXaXRoR3JhY2VmdWxEZWdyYWRhdGlvbixcbn0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9tYXJrZXRwbGFjZUhlbHBlcnMuanMnXG5pbXBvcnQge1xuICBnZXRNYXJrZXRwbGFjZSxcbiAgbG9hZEtub3duTWFya2V0cGxhY2VzQ29uZmlnLFxufSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL21hcmtldHBsYWNlTWFuYWdlci5qcydcbmltcG9ydCB7IE9GRklDSUFMX01BUktFVFBMQUNFX05BTUUgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL29mZmljaWFsTWFya2V0cGxhY2UuanMnXG5pbXBvcnQgeyBpbnN0YWxsUGx1Z2luRnJvbU1hcmtldHBsYWNlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9wbHVnaW5JbnN0YWxsYXRpb25IZWxwZXJzLmpzJ1xuaW1wb3J0IHsgaXNQbHVnaW5CbG9ja2VkQnlQb2xpY3kgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL3BsdWdpblBvbGljeS5qcydcbmltcG9ydCB7IHBsdXJhbCB9IGZyb20gJy4uLy4uL3V0aWxzL3N0cmluZ1V0aWxzLmpzJ1xuaW1wb3J0IHsgdHJ1bmNhdGVUb1dpZHRoIH0gZnJvbSAnLi4vLi4vdXRpbHMvdHJ1bmNhdGUuanMnXG5pbXBvcnQge1xuICBmaW5kUGx1Z2luT3B0aW9uc1RhcmdldCxcbiAgUGx1Z2luT3B0aW9uc0Zsb3csXG59IGZyb20gJy4vUGx1Z2luT3B0aW9uc0Zsb3cuanMnXG5pbXBvcnQgeyBQbHVnaW5UcnVzdFdhcm5pbmcgfSBmcm9tICcuL1BsdWdpblRydXN0V2FybmluZy5qcydcbmltcG9ydCB7XG4gIGJ1aWxkUGx1Z2luRGV0YWlsc01lbnVPcHRpb25zLFxuICBleHRyYWN0R2l0SHViUmVwbyxcbiAgdHlwZSBJbnN0YWxsYWJsZVBsdWdpbixcbiAgUGx1Z2luU2VsZWN0aW9uS2V5SGludCxcbn0gZnJvbSAnLi9wbHVnaW5EZXRhaWxzSGVscGVycy5qcydcbmltcG9ydCB0eXBlIHsgVmlld1N0YXRlIGFzIFBhcmVudFZpZXdTdGF0ZSB9IGZyb20gJy4vdHlwZXMuanMnXG5pbXBvcnQgeyB1c2VQYWdpbmF0aW9uIH0gZnJvbSAnLi91c2VQYWdpbmF0aW9uLmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICBlcnJvcjogc3RyaW5nIHwgbnVsbFxuICBzZXRFcnJvcjogKGVycm9yOiBzdHJpbmcgfCBudWxsKSA9PiB2b2lkXG4gIHJlc3VsdDogc3RyaW5nIHwgbnVsbFxuICBzZXRSZXN1bHQ6IChyZXN1bHQ6IHN0cmluZyB8IG51bGwpID0+IHZvaWRcbiAgc2V0Vmlld1N0YXRlOiAoc3RhdGU6IFBhcmVudFZpZXdTdGF0ZSkgPT4gdm9pZFxuICBvbkluc3RhbGxDb21wbGV0ZT86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+XG4gIHRhcmdldE1hcmtldHBsYWNlPzogc3RyaW5nXG4gIHRhcmdldFBsdWdpbj86IHN0cmluZ1xufVxuXG50eXBlIFZpZXdTdGF0ZSA9XG4gIHwgJ21hcmtldHBsYWNlLWxpc3QnXG4gIHwgJ3BsdWdpbi1saXN0J1xuICB8ICdwbHVnaW4tZGV0YWlscydcbiAgfCB7IHR5cGU6ICdwbHVnaW4tb3B0aW9ucyc7IHBsdWdpbjogTG9hZGVkUGx1Z2luOyBwbHVnaW5JZDogc3RyaW5nIH1cblxudHlwZSBNYXJrZXRwbGFjZUluZm8gPSB7XG4gIG5hbWU6IHN0cmluZ1xuICB0b3RhbFBsdWdpbnM6IG51bWJlclxuICBpbnN0YWxsZWRDb3VudDogbnVtYmVyXG4gIHNvdXJjZT86IHN0cmluZ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gQnJvd3NlTWFya2V0cGxhY2Uoe1xuICBlcnJvcixcbiAgc2V0RXJyb3IsXG4gIHJlc3VsdDogX3Jlc3VsdCxcbiAgc2V0UmVzdWx0LFxuICBzZXRWaWV3U3RhdGU6IHNldFBhcmVudFZpZXdTdGF0ZSxcbiAgb25JbnN0YWxsQ29tcGxldGUsXG4gIHRhcmdldE1hcmtldHBsYWNlLFxuICB0YXJnZXRQbHVnaW4sXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIC8vIFZpZXcgc3RhdGVcbiAgY29uc3QgW3ZpZXdTdGF0ZSwgc2V0Vmlld1N0YXRlXSA9IHVzZVN0YXRlPFZpZXdTdGF0ZT4oJ21hcmtldHBsYWNlLWxpc3QnKVxuICBjb25zdCBbc2VsZWN0ZWRNYXJrZXRwbGFjZSwgc2V0U2VsZWN0ZWRNYXJrZXRwbGFjZV0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihcbiAgICBudWxsLFxuICApXG4gIGNvbnN0IFtzZWxlY3RlZFBsdWdpbiwgc2V0U2VsZWN0ZWRQbHVnaW5dID1cbiAgICB1c2VTdGF0ZTxJbnN0YWxsYWJsZVBsdWdpbiB8IG51bGw+KG51bGwpXG5cbiAgLy8gRGF0YSBzdGF0ZVxuICBjb25zdCBbbWFya2V0cGxhY2VzLCBzZXRNYXJrZXRwbGFjZXNdID0gdXNlU3RhdGU8TWFya2V0cGxhY2VJbmZvW10+KFtdKVxuICBjb25zdCBbYXZhaWxhYmxlUGx1Z2lucywgc2V0QXZhaWxhYmxlUGx1Z2luc10gPSB1c2VTdGF0ZTxJbnN0YWxsYWJsZVBsdWdpbltdPihcbiAgICBbXSxcbiAgKVxuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSB1c2VTdGF0ZSh0cnVlKVxuICBjb25zdCBbaW5zdGFsbENvdW50cywgc2V0SW5zdGFsbENvdW50c10gPSB1c2VTdGF0ZTxNYXA8XG4gICAgc3RyaW5nLFxuICAgIG51bWJlclxuICA+IHwgbnVsbD4obnVsbClcblxuICAvLyBTZWxlY3Rpb24gc3RhdGVcbiAgY29uc3QgW3NlbGVjdGVkSW5kZXgsIHNldFNlbGVjdGVkSW5kZXhdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgW3NlbGVjdGVkRm9ySW5zdGFsbCwgc2V0U2VsZWN0ZWRGb3JJbnN0YWxsXSA9IHVzZVN0YXRlPFNldDxzdHJpbmc+PihcbiAgICBuZXcgU2V0KCksXG4gIClcbiAgY29uc3QgW2luc3RhbGxpbmdQbHVnaW5zLCBzZXRJbnN0YWxsaW5nUGx1Z2luc10gPSB1c2VTdGF0ZTxTZXQ8c3RyaW5nPj4oXG4gICAgbmV3IFNldCgpLFxuICApXG5cbiAgLy8gUGFnaW5hdGlvbiBmb3IgcGx1Z2luIGxpc3QgKGNvbnRpbnVvdXMgc2Nyb2xsaW5nKVxuICBjb25zdCBwYWdpbmF0aW9uID0gdXNlUGFnaW5hdGlvbjxJbnN0YWxsYWJsZVBsdWdpbj4oe1xuICAgIHRvdGFsSXRlbXM6IGF2YWlsYWJsZVBsdWdpbnMubGVuZ3RoLFxuICAgIHNlbGVjdGVkSW5kZXgsXG4gIH0pXG5cbiAgLy8gRGV0YWlscyB2aWV3IHN0YXRlXG4gIGNvbnN0IFtkZXRhaWxzTWVudUluZGV4LCBzZXREZXRhaWxzTWVudUluZGV4XSA9IHVzZVN0YXRlKDApXG4gIGNvbnN0IFtpc0luc3RhbGxpbmcsIHNldElzSW5zdGFsbGluZ10gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2luc3RhbGxFcnJvciwgc2V0SW5zdGFsbEVycm9yXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG5cbiAgLy8gV2FybmluZyBzdGF0ZSBmb3Igbm9uLWNyaXRpY2FsIGVycm9ycyAoZS5nLiwgc29tZSBtYXJrZXRwbGFjZXMgZmFpbGVkIHRvIGxvYWQpXG4gIGNvbnN0IFt3YXJuaW5nLCBzZXRXYXJuaW5nXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG5cbiAgLy8gSGFuZGxlIGVzY2FwZSB0byBnbyBiYWNrIC0gdmlld1N0YXRlLWRlcGVuZGVudCBuYXZpZ2F0aW9uXG4gIGNvbnN0IGhhbmRsZUJhY2sgPSBSZWFjdC51c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgaWYgKHZpZXdTdGF0ZSA9PT0gJ3BsdWdpbi1saXN0Jykge1xuICAgICAgLy8gSWYgbmF2aWdhdGVkIGRpcmVjdGx5IHRvIGEgc3BlY2lmaWMgbWFya2V0cGxhY2UgdmlhIHRhcmdldE1hcmtldHBsYWNlLFxuICAgICAgLy8gZ28gYmFjayB0byBtYW5hZ2UtbWFya2V0cGxhY2VzIHNob3dpbmcgdGhhdCBtYXJrZXRwbGFjZSdzIGRldGFpbHNcbiAgICAgIGlmICh0YXJnZXRNYXJrZXRwbGFjZSkge1xuICAgICAgICBzZXRQYXJlbnRWaWV3U3RhdGUoe1xuICAgICAgICAgIHR5cGU6ICdtYW5hZ2UtbWFya2V0cGxhY2VzJyxcbiAgICAgICAgICB0YXJnZXRNYXJrZXRwbGFjZSxcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSBpZiAobWFya2V0cGxhY2VzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAvLyBJZiB0aGVyZSdzIG9ubHkgb25lIG1hcmtldHBsYWNlLCBza2lwIHRoZSBtYXJrZXRwbGFjZS1saXN0IHZpZXdcbiAgICAgICAgLy8gc2luY2Ugd2UgYXV0by1uYXZpZ2F0ZWQgcGFzdCBpdCBvbiBsb2FkXG4gICAgICAgIHNldFBhcmVudFZpZXdTdGF0ZSh7IHR5cGU6ICdtZW51JyB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2V0Vmlld1N0YXRlKCdtYXJrZXRwbGFjZS1saXN0JylcbiAgICAgICAgc2V0U2VsZWN0ZWRNYXJrZXRwbGFjZShudWxsKVxuICAgICAgICBzZXRTZWxlY3RlZEZvckluc3RhbGwobmV3IFNldCgpKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodmlld1N0YXRlID09PSAncGx1Z2luLWRldGFpbHMnKSB7XG4gICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1saXN0JylcbiAgICAgIHNldFNlbGVjdGVkUGx1Z2luKG51bGwpXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEF0IHJvb3QgbGV2ZWwgKG1hcmtldHBsYWNlLWxpc3QpLCBleGl0IHRoZSBwbHVnaW4gbWVudVxuICAgICAgc2V0UGFyZW50Vmlld1N0YXRlKHsgdHlwZTogJ21lbnUnIH0pXG4gICAgfVxuICB9LCBbdmlld1N0YXRlLCB0YXJnZXRNYXJrZXRwbGFjZSwgc2V0UGFyZW50Vmlld1N0YXRlLCBtYXJrZXRwbGFjZXMubGVuZ3RoXSlcblxuICB1c2VLZXliaW5kaW5nKCdjb25maXJtOm5vJywgaGFuZGxlQmFjaywgeyBjb250ZXh0OiAnQ29uZmlybWF0aW9uJyB9KVxuXG4gIC8vIExvYWQgbWFya2V0cGxhY2VzIGFuZCBjb3VudCBpbnN0YWxsZWQgcGx1Z2luc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGFzeW5jIGZ1bmN0aW9uIGxvYWRNYXJrZXRwbGFjZURhdGEoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjb25maWcgPSBhd2FpdCBsb2FkS25vd25NYXJrZXRwbGFjZXNDb25maWcoKVxuXG4gICAgICAgIC8vIExvYWQgbWFya2V0cGxhY2VzIHdpdGggZ3JhY2VmdWwgZGVncmFkYXRpb25cbiAgICAgICAgY29uc3QgeyBtYXJrZXRwbGFjZXMsIGZhaWx1cmVzIH0gPVxuICAgICAgICAgIGF3YWl0IGxvYWRNYXJrZXRwbGFjZXNXaXRoR3JhY2VmdWxEZWdyYWRhdGlvbihjb25maWcpXG5cbiAgICAgICAgY29uc3QgbWFya2V0cGxhY2VJbmZvczogTWFya2V0cGxhY2VJbmZvW10gPSBbXVxuICAgICAgICBmb3IgKGNvbnN0IHtcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIGNvbmZpZzogbWFya2V0cGxhY2VDb25maWcsXG4gICAgICAgICAgZGF0YTogbWFya2V0cGxhY2UsXG4gICAgICAgIH0gb2YgbWFya2V0cGxhY2VzKSB7XG4gICAgICAgICAgaWYgKG1hcmtldHBsYWNlKSB7XG4gICAgICAgICAgICAvLyBDb3VudCBob3cgbWFueSBwbHVnaW5zIGZyb20gdGhpcyBtYXJrZXRwbGFjZSBhcmUgaW5zdGFsbGVkXG4gICAgICAgICAgICBjb25zdCBpbnN0YWxsZWRGcm9tVGhpc01hcmtldHBsYWNlID0gY291bnQoXG4gICAgICAgICAgICAgIG1hcmtldHBsYWNlLnBsdWdpbnMsXG4gICAgICAgICAgICAgIHBsdWdpbiA9PiBpc1BsdWdpbkluc3RhbGxlZChjcmVhdGVQbHVnaW5JZChwbHVnaW4ubmFtZSwgbmFtZSkpLFxuICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICBtYXJrZXRwbGFjZUluZm9zLnB1c2goe1xuICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICB0b3RhbFBsdWdpbnM6IG1hcmtldHBsYWNlLnBsdWdpbnMubGVuZ3RoLFxuICAgICAgICAgICAgICBpbnN0YWxsZWRDb3VudDogaW5zdGFsbGVkRnJvbVRoaXNNYXJrZXRwbGFjZSxcbiAgICAgICAgICAgICAgc291cmNlOiBnZXRNYXJrZXRwbGFjZVNvdXJjZURpc3BsYXkobWFya2V0cGxhY2VDb25maWcuc291cmNlKSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU29ydCBzbyBjbGF1ZGUtcGx1Z2luLWRpcmVjdG9yeSBpcyBhbHdheXMgZmlyc3RcbiAgICAgICAgbWFya2V0cGxhY2VJbmZvcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgaWYgKGEubmFtZSA9PT0gJ2NsYXVkZS1wbHVnaW4tZGlyZWN0b3J5JykgcmV0dXJuIC0xXG4gICAgICAgICAgaWYgKGIubmFtZSA9PT0gJ2NsYXVkZS1wbHVnaW4tZGlyZWN0b3J5JykgcmV0dXJuIDFcbiAgICAgICAgICByZXR1cm4gMFxuICAgICAgICB9KVxuXG4gICAgICAgIHNldE1hcmtldHBsYWNlcyhtYXJrZXRwbGFjZUluZm9zKVxuXG4gICAgICAgIC8vIEhhbmRsZSBtYXJrZXRwbGFjZSBsb2FkaW5nIGVycm9ycy93YXJuaW5nc1xuICAgICAgICBjb25zdCBzdWNjZXNzQ291bnQgPSBjb3VudChtYXJrZXRwbGFjZXMsIG0gPT4gbS5kYXRhICE9PSBudWxsKVxuICAgICAgICBjb25zdCBlcnJvclJlc3VsdCA9IGZvcm1hdE1hcmtldHBsYWNlTG9hZGluZ0Vycm9ycyhcbiAgICAgICAgICBmYWlsdXJlcyxcbiAgICAgICAgICBzdWNjZXNzQ291bnQsXG4gICAgICAgIClcbiAgICAgICAgaWYgKGVycm9yUmVzdWx0KSB7XG4gICAgICAgICAgaWYgKGVycm9yUmVzdWx0LnR5cGUgPT09ICd3YXJuaW5nJykge1xuICAgICAgICAgICAgc2V0V2FybmluZyhcbiAgICAgICAgICAgICAgZXJyb3JSZXN1bHQubWVzc2FnZSArICcuIFNob3dpbmcgYXZhaWxhYmxlIG1hcmtldHBsYWNlcy4nLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JSZXN1bHQubWVzc2FnZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTa2lwIG1hcmtldHBsYWNlIHNlbGVjdGlvbiBpZiB0aGVyZSdzIG9ubHkgb25lIG1hcmtldHBsYWNlXG4gICAgICAgIGlmIChcbiAgICAgICAgICBtYXJrZXRwbGFjZUluZm9zLmxlbmd0aCA9PT0gMSAmJlxuICAgICAgICAgICF0YXJnZXRNYXJrZXRwbGFjZSAmJlxuICAgICAgICAgICF0YXJnZXRQbHVnaW5cbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3Qgc2luZ2xlTWFya2V0cGxhY2UgPSBtYXJrZXRwbGFjZUluZm9zWzBdXG4gICAgICAgICAgaWYgKHNpbmdsZU1hcmtldHBsYWNlKSB7XG4gICAgICAgICAgICBzZXRTZWxlY3RlZE1hcmtldHBsYWNlKHNpbmdsZU1hcmtldHBsYWNlLm5hbWUpXG4gICAgICAgICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1saXN0JylcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIYW5kbGUgdGFyZ2V0TWFya2V0cGxhY2UgYW5kIHRhcmdldFBsdWdpbiBhZnRlciBtYXJrZXRwbGFjZXMgYXJlIGxvYWRlZFxuICAgICAgICBpZiAodGFyZ2V0UGx1Z2luKSB7XG4gICAgICAgICAgLy8gU2VhcmNoIGZvciB0aGUgcGx1Z2luIGFjcm9zcyBhbGwgbWFya2V0cGxhY2VzXG4gICAgICAgICAgbGV0IGZvdW5kUGx1Z2luOiBJbnN0YWxsYWJsZVBsdWdpbiB8IG51bGwgPSBudWxsXG4gICAgICAgICAgbGV0IGZvdW5kTWFya2V0cGxhY2U6IHN0cmluZyB8IG51bGwgPSBudWxsXG5cbiAgICAgICAgICBmb3IgKGNvbnN0IFtuYW1lXSBvZiBPYmplY3QuZW50cmllcyhjb25maWcpKSB7XG4gICAgICAgICAgICBjb25zdCBtYXJrZXRwbGFjZSA9IGF3YWl0IGdldE1hcmtldHBsYWNlKG5hbWUpXG4gICAgICAgICAgICBpZiAobWFya2V0cGxhY2UpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGx1Z2luID0gbWFya2V0cGxhY2UucGx1Z2lucy5maW5kKFxuICAgICAgICAgICAgICAgIHAgPT4gcC5uYW1lID09PSB0YXJnZXRQbHVnaW4sXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgaWYgKHBsdWdpbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBsdWdpbklkID0gY3JlYXRlUGx1Z2luSWQocGx1Z2luLm5hbWUsIG5hbWUpXG4gICAgICAgICAgICAgICAgZm91bmRQbHVnaW4gPSB7XG4gICAgICAgICAgICAgICAgICBlbnRyeTogcGx1Z2luLFxuICAgICAgICAgICAgICAgICAgbWFya2V0cGxhY2VOYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgcGx1Z2luSWQsXG4gICAgICAgICAgICAgICAgICAvLyBpc1BsdWdpbkdsb2JhbGx5SW5zdGFsbGVkOiBvbmx5IGJsb2NrIHdoZW4gdXNlci9tYW5hZ2VkIHNjb3BlXG4gICAgICAgICAgICAgICAgICAvLyBleGlzdHMgKG5vdGhpbmcgdG8gYWRkKS4gUHJvamVjdC9sb2NhbC1zY29wZSBpbnN0YWxscyBkb24ndFxuICAgICAgICAgICAgICAgICAgLy8gYmxvY2sg4oCUIHVzZXIgbWF5IHdhbnQgdG8gcHJvbW90ZSB0byB1c2VyIHNjb3BlIChnaC0yOTk5NykuXG4gICAgICAgICAgICAgICAgICBpc0luc3RhbGxlZDogaXNQbHVnaW5HbG9iYWxseUluc3RhbGxlZChwbHVnaW5JZCksXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvdW5kTWFya2V0cGxhY2UgPSBuYW1lXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChmb3VuZFBsdWdpbiAmJiBmb3VuZE1hcmtldHBsYWNlKSB7XG4gICAgICAgICAgICAvLyBCbG9jayBvbmx5IG9uIGdsb2JhbCAodXNlci9tYW5hZ2VkKSBpbnN0YWxsIOKAlCBwcm9qZWN0L2xvY2FsIHNjb3BlXG4gICAgICAgICAgICAvLyBtZWFucyB0aGUgdXNlciBtaWdodCBzdGlsbCB3YW50IHRvIGFkZCBhIHVzZXItc2NvcGUgZW50cnkgc28gdGhlXG4gICAgICAgICAgICAvLyBwbHVnaW4gaXMgYXZhaWxhYmxlIGluIG90aGVyIHByb2plY3RzIChnaC0yOTk5NywgZ2gtMjkyNDAsIGdoLTI5MzkyKS5cbiAgICAgICAgICAgIC8vIFRoZSBwbHVnaW4tZGV0YWlscyB2aWV3IG9mZmVycyBhbGwgdGhyZWUgc2NvcGUgb3B0aW9uczsgdGhlIGJhY2tlbmRcbiAgICAgICAgICAgIC8vIChpbnN0YWxsUGx1Z2luT3Ag4oaSIGFkZEluc3RhbGxlZFBsdWdpbikgYWxyZWFkeSBzdXBwb3J0cyBtdWx0aXBsZVxuICAgICAgICAgICAgLy8gc2NvcGUgZW50cmllcyBwZXIgcGx1Z2luLlxuICAgICAgICAgICAgY29uc3QgcGx1Z2luSWQgPSBmb3VuZFBsdWdpbi5wbHVnaW5JZFxuICAgICAgICAgICAgY29uc3QgZ2xvYmFsbHlJbnN0YWxsZWQgPSBpc1BsdWdpbkdsb2JhbGx5SW5zdGFsbGVkKHBsdWdpbklkKVxuXG4gICAgICAgICAgICBpZiAoZ2xvYmFsbHlJbnN0YWxsZWQpIHtcbiAgICAgICAgICAgICAgc2V0RXJyb3IoXG4gICAgICAgICAgICAgICAgYFBsdWdpbiAnJHtwbHVnaW5JZH0nIGlzIGFscmVhZHkgaW5zdGFsbGVkIGdsb2JhbGx5LiBVc2UgJy9wbHVnaW4nIHRvIG1hbmFnZSBleGlzdGluZyBwbHVnaW5zLmAsXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIE5hdmlnYXRlIHRvIHRoZSBwbHVnaW4gZGV0YWlscyB2aWV3XG4gICAgICAgICAgICAgIHNldFNlbGVjdGVkTWFya2V0cGxhY2UoZm91bmRNYXJrZXRwbGFjZSlcbiAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRQbHVnaW4oZm91bmRQbHVnaW4pXG4gICAgICAgICAgICAgIHNldFZpZXdTdGF0ZSgncGx1Z2luLWRldGFpbHMnKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRFcnJvcihgUGx1Z2luIFwiJHt0YXJnZXRQbHVnaW59XCIgbm90IGZvdW5kIGluIGFueSBtYXJrZXRwbGFjZWApXG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRhcmdldE1hcmtldHBsYWNlKSB7XG4gICAgICAgICAgLy8gTmF2aWdhdGUgZGlyZWN0bHkgdG8gdGhlIHNwZWNpZmllZCBtYXJrZXRwbGFjZVxuICAgICAgICAgIGNvbnN0IG1hcmtldHBsYWNlRXhpc3RzID0gbWFya2V0cGxhY2VJbmZvcy5zb21lKFxuICAgICAgICAgICAgbSA9PiBtLm5hbWUgPT09IHRhcmdldE1hcmtldHBsYWNlLFxuICAgICAgICAgIClcbiAgICAgICAgICBpZiAobWFya2V0cGxhY2VFeGlzdHMpIHtcbiAgICAgICAgICAgIHNldFNlbGVjdGVkTWFya2V0cGxhY2UodGFyZ2V0TWFya2V0cGxhY2UpXG4gICAgICAgICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1saXN0JylcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2V0RXJyb3IoYE1hcmtldHBsYWNlIFwiJHt0YXJnZXRNYXJrZXRwbGFjZX1cIiBub3QgZm91bmRgKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHNldEVycm9yKFxuICAgICAgICAgIGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiAnRmFpbGVkIHRvIGxvYWQgbWFya2V0cGxhY2VzJyxcbiAgICAgICAgKVxuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgc2V0TG9hZGluZyhmYWxzZSlcbiAgICAgIH1cbiAgICB9XG4gICAgdm9pZCBsb2FkTWFya2V0cGxhY2VEYXRhKClcbiAgfSwgW3NldEVycm9yLCB0YXJnZXRNYXJrZXRwbGFjZSwgdGFyZ2V0UGx1Z2luXSlcblxuICAvLyBMb2FkIHBsdWdpbnMgd2hlbiBhIG1hcmtldHBsYWNlIGlzIHNlbGVjdGVkXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFzZWxlY3RlZE1hcmtldHBsYWNlKSByZXR1cm5cblxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZVxuXG4gICAgYXN5bmMgZnVuY3Rpb24gbG9hZFBsdWdpbnNGb3JNYXJrZXRwbGFjZShtYXJrZXRwbGFjZU5hbWU6IHN0cmluZykge1xuICAgICAgc2V0TG9hZGluZyh0cnVlKVxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgbWFya2V0cGxhY2UgPSBhd2FpdCBnZXRNYXJrZXRwbGFjZShtYXJrZXRwbGFjZU5hbWUpXG4gICAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVyblxuICAgICAgICBpZiAoIW1hcmtldHBsYWNlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gbG9hZCBtYXJrZXRwbGFjZTogJHttYXJrZXRwbGFjZU5hbWV9YClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbHRlciBvdXQgYWxyZWFkeSBpbnN0YWxsZWQgcGx1Z2luc1xuICAgICAgICBjb25zdCBpbnN0YWxsYWJsZVBsdWdpbnM6IEluc3RhbGxhYmxlUGx1Z2luW10gPSBbXVxuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIG1hcmtldHBsYWNlLnBsdWdpbnMpIHtcbiAgICAgICAgICBjb25zdCBwbHVnaW5JZCA9IGNyZWF0ZVBsdWdpbklkKGVudHJ5Lm5hbWUsIG1hcmtldHBsYWNlTmFtZSlcbiAgICAgICAgICBpZiAoaXNQbHVnaW5CbG9ja2VkQnlQb2xpY3kocGx1Z2luSWQpKSBjb250aW51ZVxuICAgICAgICAgIGluc3RhbGxhYmxlUGx1Z2lucy5wdXNoKHtcbiAgICAgICAgICAgIGVudHJ5LFxuICAgICAgICAgICAgbWFya2V0cGxhY2VOYW1lOiBtYXJrZXRwbGFjZU5hbWUsXG4gICAgICAgICAgICBwbHVnaW5JZCxcbiAgICAgICAgICAgIC8vIE9ubHkgbWFyayBhcyBcImluc3RhbGxlZFwiIHdoZW4gZ2xvYmFsbHkgc2NvcGVkICh1c2VyL21hbmFnZWQpLlxuICAgICAgICAgICAgLy8gUHJvamVjdC9sb2NhbCBpbnN0YWxscyBkb24ndCBibG9jayDigJQgdXNlciBjYW4gYWRkIHVzZXIgc2NvcGVcbiAgICAgICAgICAgIC8vIHZpYSB0aGUgcGx1Z2luLWRldGFpbHMgdmlldyAoZ2gtMjk5OTcpLlxuICAgICAgICAgICAgaXNJbnN0YWxsZWQ6IGlzUGx1Z2luR2xvYmFsbHlJbnN0YWxsZWQocGx1Z2luSWQpLFxuICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCBpbnN0YWxsIGNvdW50cyBhbmQgc29ydCBieSBwb3B1bGFyaXR5XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgY291bnRzID0gYXdhaXQgZ2V0SW5zdGFsbENvdW50cygpXG4gICAgICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuXG4gICAgICAgICAgc2V0SW5zdGFsbENvdW50cyhjb3VudHMpXG5cbiAgICAgICAgICBpZiAoY291bnRzKSB7XG4gICAgICAgICAgICAvLyBTb3J0IGJ5IGluc3RhbGwgY291bnQgKGRlc2NlbmRpbmcpLCB0aGVuIGFscGhhYmV0aWNhbGx5XG4gICAgICAgICAgICBpbnN0YWxsYWJsZVBsdWdpbnMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBjb3VudEEgPSBjb3VudHMuZ2V0KGEucGx1Z2luSWQpID8/IDBcbiAgICAgICAgICAgICAgY29uc3QgY291bnRCID0gY291bnRzLmdldChiLnBsdWdpbklkKSA/PyAwXG4gICAgICAgICAgICAgIGlmIChjb3VudEEgIT09IGNvdW50QikgcmV0dXJuIGNvdW50QiAtIGNvdW50QVxuICAgICAgICAgICAgICByZXR1cm4gYS5lbnRyeS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5lbnRyeS5uYW1lKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gTm8gY291bnRzIGF2YWlsYWJsZSAtIHNvcnQgYWxwaGFiZXRpY2FsbHlcbiAgICAgICAgICAgIGluc3RhbGxhYmxlUGx1Z2lucy5zb3J0KChhLCBiKSA9PlxuICAgICAgICAgICAgICBhLmVudHJ5Lm5hbWUubG9jYWxlQ29tcGFyZShiLmVudHJ5Lm5hbWUpLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm5cbiAgICAgICAgICAvLyBMb2cgdGhlIGVycm9yLCB0aGVuIGdyYWNlZnVsbHkgZGVncmFkZSB0byBhbHBoYWJldGljYWwgc29ydFxuICAgICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgICAgICAgIGBGYWlsZWQgdG8gZmV0Y2ggaW5zdGFsbCBjb3VudHM6ICR7ZXJyb3JNZXNzYWdlKGVycm9yKX1gLFxuICAgICAgICAgIClcbiAgICAgICAgICBpbnN0YWxsYWJsZVBsdWdpbnMuc29ydCgoYSwgYikgPT5cbiAgICAgICAgICAgIGEuZW50cnkubmFtZS5sb2NhbGVDb21wYXJlKGIuZW50cnkubmFtZSksXG4gICAgICAgICAgKVxuICAgICAgICB9XG5cbiAgICAgICAgc2V0QXZhaWxhYmxlUGx1Z2lucyhpbnN0YWxsYWJsZVBsdWdpbnMpXG4gICAgICAgIHNldFNlbGVjdGVkSW5kZXgoMClcbiAgICAgICAgc2V0U2VsZWN0ZWRGb3JJbnN0YWxsKG5ldyBTZXQoKSlcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm5cbiAgICAgICAgc2V0RXJyb3IoZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6ICdGYWlsZWQgdG8gbG9hZCBwbHVnaW5zJylcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNldExvYWRpbmcoZmFsc2UpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdm9pZCBsb2FkUGx1Z2luc0Zvck1hcmtldHBsYWNlKHNlbGVjdGVkTWFya2V0cGxhY2UpXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNhbmNlbGxlZCA9IHRydWVcbiAgICB9XG4gIH0sIFtzZWxlY3RlZE1hcmtldHBsYWNlLCBzZXRFcnJvcl0pXG5cbiAgLy8gSW5zdGFsbCBzZWxlY3RlZCBwbHVnaW5zXG4gIGNvbnN0IGluc3RhbGxTZWxlY3RlZFBsdWdpbnMgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKHNlbGVjdGVkRm9ySW5zdGFsbC5zaXplID09PSAwKSByZXR1cm5cblxuICAgIGNvbnN0IHBsdWdpbnNUb0luc3RhbGwgPSBhdmFpbGFibGVQbHVnaW5zLmZpbHRlcihwID0+XG4gICAgICBzZWxlY3RlZEZvckluc3RhbGwuaGFzKHAucGx1Z2luSWQpLFxuICAgIClcblxuICAgIHNldEluc3RhbGxpbmdQbHVnaW5zKG5ldyBTZXQocGx1Z2luc1RvSW5zdGFsbC5tYXAocCA9PiBwLnBsdWdpbklkKSkpXG5cbiAgICBsZXQgc3VjY2Vzc0NvdW50ID0gMFxuICAgIGxldCBmYWlsdXJlQ291bnQgPSAwXG4gICAgY29uc3QgbmV3RmFpbGVkUGx1Z2luczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+ID0gW11cblxuICAgIGZvciAoY29uc3QgcGx1Z2luIG9mIHBsdWdpbnNUb0luc3RhbGwpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGluc3RhbGxQbHVnaW5Gcm9tTWFya2V0cGxhY2Uoe1xuICAgICAgICBwbHVnaW5JZDogcGx1Z2luLnBsdWdpbklkLFxuICAgICAgICBlbnRyeTogcGx1Z2luLmVudHJ5LFxuICAgICAgICBtYXJrZXRwbGFjZU5hbWU6IHBsdWdpbi5tYXJrZXRwbGFjZU5hbWUsXG4gICAgICAgIHNjb3BlOiAndXNlcicsXG4gICAgICB9KVxuXG4gICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgc3VjY2Vzc0NvdW50KytcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZhaWx1cmVDb3VudCsrXG4gICAgICAgIG5ld0ZhaWxlZFBsdWdpbnMucHVzaCh7XG4gICAgICAgICAgbmFtZTogcGx1Z2luLmVudHJ5Lm5hbWUsXG4gICAgICAgICAgcmVhc29uOiByZXN1bHQuZXJyb3IsXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuXG4gICAgc2V0SW5zdGFsbGluZ1BsdWdpbnMobmV3IFNldCgpKVxuICAgIHNldFNlbGVjdGVkRm9ySW5zdGFsbChuZXcgU2V0KCkpXG4gICAgY2xlYXJBbGxDYWNoZXMoKVxuXG4gICAgLy8gSGFuZGxlIGluc3RhbGxhdGlvbiByZXN1bHRzXG4gICAgaWYgKGZhaWx1cmVDb3VudCA9PT0gMCkge1xuICAgICAgLy8gQWxsIHN1Y2NlZWRlZFxuICAgICAgY29uc3QgbWVzc2FnZSA9XG4gICAgICAgIGDinJMgSW5zdGFsbGVkICR7c3VjY2Vzc0NvdW50fSAke3BsdXJhbChzdWNjZXNzQ291bnQsICdwbHVnaW4nKX0uIGAgK1xuICAgICAgICBgUnVuIC9yZWxvYWQtcGx1Z2lucyB0byBhY3RpdmF0ZS5gXG5cbiAgICAgIHNldFJlc3VsdChtZXNzYWdlKVxuICAgIH0gZWxzZSBpZiAoc3VjY2Vzc0NvdW50ID09PSAwKSB7XG4gICAgICAvLyBBbGwgZmFpbGVkIC0gc2hvdyBlcnJvciB3aXRoIHJlYXNvbnNcbiAgICAgIHNldEVycm9yKFxuICAgICAgICBgRmFpbGVkIHRvIGluc3RhbGw6ICR7Zm9ybWF0RmFpbHVyZURldGFpbHMobmV3RmFpbGVkUGx1Z2lucywgdHJ1ZSl9YCxcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTWl4ZWQgcmVzdWx0cyAtIHNob3cgcGFydGlhbCBzdWNjZXNzXG4gICAgICBjb25zdCBtZXNzYWdlID1cbiAgICAgICAgYOKckyBJbnN0YWxsZWQgJHtzdWNjZXNzQ291bnR9IG9mICR7c3VjY2Vzc0NvdW50ICsgZmFpbHVyZUNvdW50fSBwbHVnaW5zLiBgICtcbiAgICAgICAgYEZhaWxlZDogJHtmb3JtYXRGYWlsdXJlRGV0YWlscyhuZXdGYWlsZWRQbHVnaW5zLCBmYWxzZSl9LiBgICtcbiAgICAgICAgYFJ1biAvcmVsb2FkLXBsdWdpbnMgdG8gYWN0aXZhdGUgc3VjY2Vzc2Z1bGx5IGluc3RhbGxlZCBwbHVnaW5zLmBcblxuICAgICAgc2V0UmVzdWx0KG1lc3NhZ2UpXG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIGNvbXBsZXRpb24gY2FsbGJhY2sgYW5kIG5hdmlnYXRpb25cbiAgICBpZiAoc3VjY2Vzc0NvdW50ID4gMCkge1xuICAgICAgaWYgKG9uSW5zdGFsbENvbXBsZXRlKSB7XG4gICAgICAgIGF3YWl0IG9uSW5zdGFsbENvbXBsZXRlKClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRQYXJlbnRWaWV3U3RhdGUoeyB0eXBlOiAnbWVudScgfSlcbiAgfVxuXG4gIC8vIEluc3RhbGwgc2luZ2xlIHBsdWdpbiBmcm9tIGRldGFpbHMgdmlld1xuICBjb25zdCBoYW5kbGVTaW5nbGVQbHVnaW5JbnN0YWxsID0gYXN5bmMgKFxuICAgIHBsdWdpbjogSW5zdGFsbGFibGVQbHVnaW4sXG4gICAgc2NvcGU6ICd1c2VyJyB8ICdwcm9qZWN0JyB8ICdsb2NhbCcgPSAndXNlcicsXG4gICkgPT4ge1xuICAgIHNldElzSW5zdGFsbGluZyh0cnVlKVxuICAgIHNldEluc3RhbGxFcnJvcihudWxsKVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaW5zdGFsbFBsdWdpbkZyb21NYXJrZXRwbGFjZSh7XG4gICAgICBwbHVnaW5JZDogcGx1Z2luLnBsdWdpbklkLFxuICAgICAgZW50cnk6IHBsdWdpbi5lbnRyeSxcbiAgICAgIG1hcmtldHBsYWNlTmFtZTogcGx1Z2luLm1hcmtldHBsYWNlTmFtZSxcbiAgICAgIHNjb3BlLFxuICAgIH0pXG5cbiAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIGNvbnN0IGxvYWRlZCA9IGF3YWl0IGZpbmRQbHVnaW5PcHRpb25zVGFyZ2V0KHBsdWdpbi5wbHVnaW5JZClcbiAgICAgIGlmIChsb2FkZWQpIHtcbiAgICAgICAgc2V0SXNJbnN0YWxsaW5nKGZhbHNlKVxuICAgICAgICBzZXRWaWV3U3RhdGUoe1xuICAgICAgICAgIHR5cGU6ICdwbHVnaW4tb3B0aW9ucycsXG4gICAgICAgICAgcGx1Z2luOiBsb2FkZWQsXG4gICAgICAgICAgcGx1Z2luSWQ6IHBsdWdpbi5wbHVnaW5JZCxcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBzZXRSZXN1bHQocmVzdWx0Lm1lc3NhZ2UpXG4gICAgICBpZiAob25JbnN0YWxsQ29tcGxldGUpIHtcbiAgICAgICAgYXdhaXQgb25JbnN0YWxsQ29tcGxldGUoKVxuICAgICAgfVxuICAgICAgc2V0UGFyZW50Vmlld1N0YXRlKHsgdHlwZTogJ21lbnUnIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIHNldElzSW5zdGFsbGluZyhmYWxzZSlcbiAgICAgIHNldEluc3RhbGxFcnJvcihyZXN1bHQuZXJyb3IpXG4gICAgfVxuICB9XG5cbiAgLy8gSGFuZGxlIGVycm9yIHN0YXRlXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICBzZXRSZXN1bHQoZXJyb3IpXG4gICAgfVxuICB9LCBbZXJyb3IsIHNldFJlc3VsdF0pXG5cbiAgLy8gTWFya2V0cGxhY2UtbGlzdCBuYXZpZ2F0aW9uXG4gIHVzZUtleWJpbmRpbmdzKFxuICAgIHtcbiAgICAgICdzZWxlY3Q6cHJldmlvdXMnOiAoKSA9PiB7XG4gICAgICAgIGlmIChzZWxlY3RlZEluZGV4ID4gMCkge1xuICAgICAgICAgIHNldFNlbGVjdGVkSW5kZXgoc2VsZWN0ZWRJbmRleCAtIDEpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAnc2VsZWN0Om5leHQnOiAoKSA9PiB7XG4gICAgICAgIGlmIChzZWxlY3RlZEluZGV4IDwgbWFya2V0cGxhY2VzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICBzZXRTZWxlY3RlZEluZGV4KHNlbGVjdGVkSW5kZXggKyAxKVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgJ3NlbGVjdDphY2NlcHQnOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG1hcmtldHBsYWNlID0gbWFya2V0cGxhY2VzW3NlbGVjdGVkSW5kZXhdXG4gICAgICAgIGlmIChtYXJrZXRwbGFjZSkge1xuICAgICAgICAgIHNldFNlbGVjdGVkTWFya2V0cGxhY2UobWFya2V0cGxhY2UubmFtZSlcbiAgICAgICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1saXN0JylcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9LFxuICAgIHsgY29udGV4dDogJ1NlbGVjdCcsIGlzQWN0aXZlOiB2aWV3U3RhdGUgPT09ICdtYXJrZXRwbGFjZS1saXN0JyB9LFxuICApXG5cbiAgLy8gUGx1Z2luLWxpc3QgbmF2aWdhdGlvblxuICB1c2VLZXliaW5kaW5ncyhcbiAgICB7XG4gICAgICAnc2VsZWN0OnByZXZpb3VzJzogKCkgPT4ge1xuICAgICAgICBpZiAoc2VsZWN0ZWRJbmRleCA+IDApIHtcbiAgICAgICAgICBwYWdpbmF0aW9uLmhhbmRsZVNlbGVjdGlvbkNoYW5nZShzZWxlY3RlZEluZGV4IC0gMSwgc2V0U2VsZWN0ZWRJbmRleClcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICdzZWxlY3Q6bmV4dCc6ICgpID0+IHtcbiAgICAgICAgaWYgKHNlbGVjdGVkSW5kZXggPCBhdmFpbGFibGVQbHVnaW5zLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICBwYWdpbmF0aW9uLmhhbmRsZVNlbGVjdGlvbkNoYW5nZShzZWxlY3RlZEluZGV4ICsgMSwgc2V0U2VsZWN0ZWRJbmRleClcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICdzZWxlY3Q6YWNjZXB0JzogKCkgPT4ge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc2VsZWN0ZWRJbmRleCA9PT0gYXZhaWxhYmxlUGx1Z2lucy5sZW5ndGggJiZcbiAgICAgICAgICBzZWxlY3RlZEZvckluc3RhbGwuc2l6ZSA+IDBcbiAgICAgICAgKSB7XG4gICAgICAgICAgdm9pZCBpbnN0YWxsU2VsZWN0ZWRQbHVnaW5zKClcbiAgICAgICAgfSBlbHNlIGlmIChzZWxlY3RlZEluZGV4IDwgYXZhaWxhYmxlUGx1Z2lucy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zdCBwbHVnaW4gPSBhdmFpbGFibGVQbHVnaW5zW3NlbGVjdGVkSW5kZXhdXG4gICAgICAgICAgaWYgKHBsdWdpbikge1xuICAgICAgICAgICAgaWYgKHBsdWdpbi5pc0luc3RhbGxlZCkge1xuICAgICAgICAgICAgICBzZXRQYXJlbnRWaWV3U3RhdGUoe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdtYW5hZ2UtcGx1Z2lucycsXG4gICAgICAgICAgICAgICAgdGFyZ2V0UGx1Z2luOiBwbHVnaW4uZW50cnkubmFtZSxcbiAgICAgICAgICAgICAgICB0YXJnZXRNYXJrZXRwbGFjZTogcGx1Z2luLm1hcmtldHBsYWNlTmFtZSxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHNldFNlbGVjdGVkUGx1Z2luKHBsdWdpbilcbiAgICAgICAgICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tZGV0YWlscycpXG4gICAgICAgICAgICAgIHNldERldGFpbHNNZW51SW5kZXgoMClcbiAgICAgICAgICAgICAgc2V0SW5zdGFsbEVycm9yKG51bGwpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0sXG4gICAgeyBjb250ZXh0OiAnU2VsZWN0JywgaXNBY3RpdmU6IHZpZXdTdGF0ZSA9PT0gJ3BsdWdpbi1saXN0JyB9LFxuICApXG5cbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ3BsdWdpbjp0b2dnbGUnOiAoKSA9PiB7XG4gICAgICAgIGlmIChzZWxlY3RlZEluZGV4IDwgYXZhaWxhYmxlUGx1Z2lucy5sZW5ndGgpIHtcbiAgICAgICAgICBjb25zdCBwbHVnaW4gPSBhdmFpbGFibGVQbHVnaW5zW3NlbGVjdGVkSW5kZXhdXG4gICAgICAgICAgaWYgKHBsdWdpbiAmJiAhcGx1Z2luLmlzSW5zdGFsbGVkKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdTZWxlY3Rpb24gPSBuZXcgU2V0KHNlbGVjdGVkRm9ySW5zdGFsbClcbiAgICAgICAgICAgIGlmIChuZXdTZWxlY3Rpb24uaGFzKHBsdWdpbi5wbHVnaW5JZCkpIHtcbiAgICAgICAgICAgICAgbmV3U2VsZWN0aW9uLmRlbGV0ZShwbHVnaW4ucGx1Z2luSWQpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXdTZWxlY3Rpb24uYWRkKHBsdWdpbi5wbHVnaW5JZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNldFNlbGVjdGVkRm9ySW5zdGFsbChuZXdTZWxlY3Rpb24pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgJ3BsdWdpbjppbnN0YWxsJzogKCkgPT4ge1xuICAgICAgICBpZiAoc2VsZWN0ZWRGb3JJbnN0YWxsLnNpemUgPiAwKSB7XG4gICAgICAgICAgdm9pZCBpbnN0YWxsU2VsZWN0ZWRQbHVnaW5zKClcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9LFxuICAgIHsgY29udGV4dDogJ1BsdWdpbicsIGlzQWN0aXZlOiB2aWV3U3RhdGUgPT09ICdwbHVnaW4tbGlzdCcgfSxcbiAgKVxuXG4gIC8vIFBsdWdpbi1kZXRhaWxzIG5hdmlnYXRpb25cbiAgY29uc3QgZGV0YWlsc01lbnVPcHRpb25zID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCFzZWxlY3RlZFBsdWdpbikgcmV0dXJuIFtdXG4gICAgY29uc3QgaGFzSG9tZXBhZ2UgPSBzZWxlY3RlZFBsdWdpbi5lbnRyeS5ob21lcGFnZVxuICAgIGNvbnN0IGdpdGh1YlJlcG8gPSBleHRyYWN0R2l0SHViUmVwbyhzZWxlY3RlZFBsdWdpbilcbiAgICByZXR1cm4gYnVpbGRQbHVnaW5EZXRhaWxzTWVudU9wdGlvbnMoaGFzSG9tZXBhZ2UsIGdpdGh1YlJlcG8pXG4gIH0sIFtzZWxlY3RlZFBsdWdpbl0pXG5cbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ3NlbGVjdDpwcmV2aW91cyc6ICgpID0+IHtcbiAgICAgICAgaWYgKGRldGFpbHNNZW51SW5kZXggPiAwKSB7XG4gICAgICAgICAgc2V0RGV0YWlsc01lbnVJbmRleChkZXRhaWxzTWVudUluZGV4IC0gMSlcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICdzZWxlY3Q6bmV4dCc6ICgpID0+IHtcbiAgICAgICAgaWYgKGRldGFpbHNNZW51SW5kZXggPCBkZXRhaWxzTWVudU9wdGlvbnMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIHNldERldGFpbHNNZW51SW5kZXgoZGV0YWlsc01lbnVJbmRleCArIDEpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAnc2VsZWN0OmFjY2VwdCc6ICgpID0+IHtcbiAgICAgICAgaWYgKCFzZWxlY3RlZFBsdWdpbikgcmV0dXJuXG4gICAgICAgIGNvbnN0IGFjdGlvbiA9IGRldGFpbHNNZW51T3B0aW9uc1tkZXRhaWxzTWVudUluZGV4XT8uYWN0aW9uXG4gICAgICAgIGNvbnN0IGhhc0hvbWVwYWdlID0gc2VsZWN0ZWRQbHVnaW4uZW50cnkuaG9tZXBhZ2VcbiAgICAgICAgY29uc3QgZ2l0aHViUmVwbyA9IGV4dHJhY3RHaXRIdWJSZXBvKHNlbGVjdGVkUGx1Z2luKVxuICAgICAgICBpZiAoYWN0aW9uID09PSAnaW5zdGFsbC11c2VyJykge1xuICAgICAgICAgIHZvaWQgaGFuZGxlU2luZ2xlUGx1Z2luSW5zdGFsbChzZWxlY3RlZFBsdWdpbiwgJ3VzZXInKVxuICAgICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2luc3RhbGwtcHJvamVjdCcpIHtcbiAgICAgICAgICB2b2lkIGhhbmRsZVNpbmdsZVBsdWdpbkluc3RhbGwoc2VsZWN0ZWRQbHVnaW4sICdwcm9qZWN0JylcbiAgICAgICAgfSBlbHNlIGlmIChhY3Rpb24gPT09ICdpbnN0YWxsLWxvY2FsJykge1xuICAgICAgICAgIHZvaWQgaGFuZGxlU2luZ2xlUGx1Z2luSW5zdGFsbChzZWxlY3RlZFBsdWdpbiwgJ2xvY2FsJylcbiAgICAgICAgfSBlbHNlIGlmIChhY3Rpb24gPT09ICdob21lcGFnZScgJiYgaGFzSG9tZXBhZ2UpIHtcbiAgICAgICAgICB2b2lkIG9wZW5Ccm93c2VyKGhhc0hvbWVwYWdlKVxuICAgICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2dpdGh1YicgJiYgZ2l0aHViUmVwbykge1xuICAgICAgICAgIHZvaWQgb3BlbkJyb3dzZXIoYGh0dHBzOi8vZ2l0aHViLmNvbS8ke2dpdGh1YlJlcG99YClcbiAgICAgICAgfSBlbHNlIGlmIChhY3Rpb24gPT09ICdiYWNrJykge1xuICAgICAgICAgIHNldFZpZXdTdGF0ZSgncGx1Z2luLWxpc3QnKVxuICAgICAgICAgIHNldFNlbGVjdGVkUGx1Z2luKG51bGwpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnU2VsZWN0JyxcbiAgICAgIGlzQWN0aXZlOiB2aWV3U3RhdGUgPT09ICdwbHVnaW4tZGV0YWlscycgJiYgISFzZWxlY3RlZFBsdWdpbixcbiAgICB9LFxuICApXG5cbiAgaWYgKHR5cGVvZiB2aWV3U3RhdGUgPT09ICdvYmplY3QnICYmIHZpZXdTdGF0ZS50eXBlID09PSAncGx1Z2luLW9wdGlvbnMnKSB7XG4gICAgY29uc3QgeyBwbHVnaW4sIHBsdWdpbklkIH0gPSB2aWV3U3RhdGVcbiAgICBmdW5jdGlvbiBmaW5pc2gobXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIHNldFJlc3VsdChtc2cpXG4gICAgICBpZiAob25JbnN0YWxsQ29tcGxldGUpIHtcbiAgICAgICAgdm9pZCBvbkluc3RhbGxDb21wbGV0ZSgpXG4gICAgICB9XG4gICAgICBzZXRQYXJlbnRWaWV3U3RhdGUoeyB0eXBlOiAnbWVudScgfSlcbiAgICB9XG4gICAgcmV0dXJuIChcbiAgICAgIDxQbHVnaW5PcHRpb25zRmxvd1xuICAgICAgICBwbHVnaW49e3BsdWdpbn1cbiAgICAgICAgcGx1Z2luSWQ9e3BsdWdpbklkfVxuICAgICAgICBvbkRvbmU9eyhvdXRjb21lLCBkZXRhaWwpID0+IHtcbiAgICAgICAgICBzd2l0Y2ggKG91dGNvbWUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2NvbmZpZ3VyZWQnOlxuICAgICAgICAgICAgICBmaW5pc2goXG4gICAgICAgICAgICAgICAgYOKckyBJbnN0YWxsZWQgYW5kIGNvbmZpZ3VyZWQgJHtwbHVnaW4ubmFtZX0uIFJ1biAvcmVsb2FkLXBsdWdpbnMgdG8gYXBwbHkuYCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgY2FzZSAnc2tpcHBlZCc6XG4gICAgICAgICAgICAgIGZpbmlzaChcbiAgICAgICAgICAgICAgICBg4pyTIEluc3RhbGxlZCAke3BsdWdpbi5uYW1lfS4gUnVuIC9yZWxvYWQtcGx1Z2lucyB0byBhcHBseS5gLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICBjYXNlICdlcnJvcic6XG4gICAgICAgICAgICAgIGZpbmlzaChgSW5zdGFsbGVkIGJ1dCBmYWlsZWQgdG8gc2F2ZSBjb25maWc6ICR7ZGV0YWlsfWApXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9fVxuICAgICAgLz5cbiAgICApXG4gIH1cblxuICAvLyBMb2FkaW5nIHN0YXRlXG4gIGlmIChsb2FkaW5nKSB7XG4gICAgcmV0dXJuIDxUZXh0PkxvYWRpbmfigKY8L1RleHQ+XG4gIH1cblxuICAvLyBFcnJvciBzdGF0ZVxuICBpZiAoZXJyb3IpIHtcbiAgICByZXR1cm4gPFRleHQgY29sb3I9XCJlcnJvclwiPntlcnJvcn08L1RleHQ+XG4gIH1cblxuICAvLyBNYXJrZXRwbGFjZSBzZWxlY3Rpb24gdmlld1xuICBpZiAodmlld1N0YXRlID09PSAnbWFya2V0cGxhY2UtbGlzdCcpIHtcbiAgICBpZiAobWFya2V0cGxhY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5TZWxlY3QgbWFya2V0cGxhY2U8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPFRleHQ+Tm8gbWFya2V0cGxhY2VzIGNvbmZpZ3VyZWQuPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgQWRkIGEgbWFya2V0cGxhY2UgZmlyc3QgdXNpbmcge1wiJ0FkZCBtYXJrZXRwbGFjZSdcIn0uXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfSBwYWRkaW5nTGVmdD17MX0+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImdvIGJhY2tcIlxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8L0JveD5cbiAgICAgIClcbiAgICB9XG5cbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxCb3ggbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICA8VGV4dCBib2xkPlNlbGVjdCBtYXJrZXRwbGFjZTwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgey8qIFdhcm5pbmcgYmFubmVyIGZvciBtYXJrZXRwbGFjZSBsb2FkIGZhaWx1cmVzICovfVxuICAgICAgICB7d2FybmluZyAmJiAoXG4gICAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgICAgICB7ZmlndXJlcy53YXJuaW5nfSB7d2FybmluZ31cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgICAge21hcmtldHBsYWNlcy5tYXAoKG1hcmtldHBsYWNlLCBpbmRleCkgPT4gKFxuICAgICAgICAgIDxCb3hcbiAgICAgICAgICAgIGtleT17bWFya2V0cGxhY2UubmFtZX1cbiAgICAgICAgICAgIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIlxuICAgICAgICAgICAgbWFyZ2luQm90dG9tPXtpbmRleCA8IG1hcmtldHBsYWNlcy5sZW5ndGggLSAxID8gMSA6IDB9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHQgY29sb3I9e3NlbGVjdGVkSW5kZXggPT09IGluZGV4ID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfT5cbiAgICAgICAgICAgICAgICB7c2VsZWN0ZWRJbmRleCA9PT0gaW5kZXggPyBmaWd1cmVzLnBvaW50ZXIgOiAnICd9eycgJ31cbiAgICAgICAgICAgICAgICB7bWFya2V0cGxhY2UubmFtZX1cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICA8Qm94IG1hcmdpbkxlZnQ9ezJ9PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICB7bWFya2V0cGxhY2UudG90YWxQbHVnaW5zfXsnICd9XG4gICAgICAgICAgICAgICAge3BsdXJhbChtYXJrZXRwbGFjZS50b3RhbFBsdWdpbnMsICdwbHVnaW4nKX0gYXZhaWxhYmxlXG4gICAgICAgICAgICAgICAge21hcmtldHBsYWNlLmluc3RhbGxlZENvdW50ID4gMCAmJlxuICAgICAgICAgICAgICAgICAgYCDCtyAke21hcmtldHBsYWNlLmluc3RhbGxlZENvdW50fSBhbHJlYWR5IGluc3RhbGxlZGB9XG4gICAgICAgICAgICAgICAge21hcmtldHBsYWNlLnNvdXJjZSAmJiBgIMK3ICR7bWFya2V0cGxhY2Uuc291cmNlfWB9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApKX1cblxuICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3IgaXRhbGljPlxuICAgICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgIGFjdGlvbj1cInNlbGVjdDphY2NlcHRcIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJTZWxlY3RcIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRW50ZXJcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwic2VsZWN0XCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImdvIGJhY2tcIlxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIFBsdWdpbiBkZXRhaWxzIHZpZXdcbiAgaWYgKHZpZXdTdGF0ZSA9PT0gJ3BsdWdpbi1kZXRhaWxzJyAmJiBzZWxlY3RlZFBsdWdpbikge1xuICAgIGNvbnN0IGhhc0hvbWVwYWdlID0gc2VsZWN0ZWRQbHVnaW4uZW50cnkuaG9tZXBhZ2VcbiAgICBjb25zdCBnaXRodWJSZXBvID0gZXh0cmFjdEdpdEh1YlJlcG8oc2VsZWN0ZWRQbHVnaW4pXG5cbiAgICBjb25zdCBtZW51T3B0aW9ucyA9IGJ1aWxkUGx1Z2luRGV0YWlsc01lbnVPcHRpb25zKGhhc0hvbWVwYWdlLCBnaXRodWJSZXBvKVxuXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgPFRleHQgYm9sZD5QbHVnaW4gRGV0YWlsczwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgey8qIFBsdWdpbiBtZXRhZGF0YSAqL31cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICA8VGV4dCBib2xkPntzZWxlY3RlZFBsdWdpbi5lbnRyeS5uYW1lfTwvVGV4dD5cbiAgICAgICAgICB7c2VsZWN0ZWRQbHVnaW4uZW50cnkudmVyc2lvbiAmJiAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5WZXJzaW9uOiB7c2VsZWN0ZWRQbHVnaW4uZW50cnkudmVyc2lvbn08L1RleHQ+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7c2VsZWN0ZWRQbHVnaW4uZW50cnkuZGVzY3JpcHRpb24gJiYgKFxuICAgICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICA8VGV4dD57c2VsZWN0ZWRQbHVnaW4uZW50cnkuZGVzY3JpcHRpb259PC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7c2VsZWN0ZWRQbHVnaW4uZW50cnkuYXV0aG9yICYmIChcbiAgICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgQnk6eycgJ31cbiAgICAgICAgICAgICAgICB7dHlwZW9mIHNlbGVjdGVkUGx1Z2luLmVudHJ5LmF1dGhvciA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgICAgICAgID8gc2VsZWN0ZWRQbHVnaW4uZW50cnkuYXV0aG9yXG4gICAgICAgICAgICAgICAgICA6IHNlbGVjdGVkUGx1Z2luLmVudHJ5LmF1dGhvci5uYW1lfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cblxuICAgICAgICB7LyogV2hhdCB3aWxsIGJlIGluc3RhbGxlZCAqL31cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICA8VGV4dCBib2xkPldpbGwgaW5zdGFsbDo8L1RleHQ+XG4gICAgICAgICAge3NlbGVjdGVkUGx1Z2luLmVudHJ5LmNvbW1hbmRzICYmIChcbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICDCtyBDb21tYW5kczp7JyAnfVxuICAgICAgICAgICAgICB7QXJyYXkuaXNBcnJheShzZWxlY3RlZFBsdWdpbi5lbnRyeS5jb21tYW5kcylcbiAgICAgICAgICAgICAgICA/IHNlbGVjdGVkUGx1Z2luLmVudHJ5LmNvbW1hbmRzLmpvaW4oJywgJylcbiAgICAgICAgICAgICAgICA6IE9iamVjdC5rZXlzKHNlbGVjdGVkUGx1Z2luLmVudHJ5LmNvbW1hbmRzKS5qb2luKCcsICcpfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICl9XG4gICAgICAgICAge3NlbGVjdGVkUGx1Z2luLmVudHJ5LmFnZW50cyAmJiAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgwrcgQWdlbnRzOnsnICd9XG4gICAgICAgICAgICAgIHtBcnJheS5pc0FycmF5KHNlbGVjdGVkUGx1Z2luLmVudHJ5LmFnZW50cylcbiAgICAgICAgICAgICAgICA/IHNlbGVjdGVkUGx1Z2luLmVudHJ5LmFnZW50cy5qb2luKCcsICcpXG4gICAgICAgICAgICAgICAgOiBPYmplY3Qua2V5cyhzZWxlY3RlZFBsdWdpbi5lbnRyeS5hZ2VudHMpLmpvaW4oJywgJyl9XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7c2VsZWN0ZWRQbHVnaW4uZW50cnkuaG9va3MgJiYgKFxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgIMK3IEhvb2tzOiB7T2JqZWN0LmtleXMoc2VsZWN0ZWRQbHVnaW4uZW50cnkuaG9va3MpLmpvaW4oJywgJyl9XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7c2VsZWN0ZWRQbHVnaW4uZW50cnkubWNwU2VydmVycyAmJiAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgwrcgTUNQIFNlcnZlcnM6eycgJ31cbiAgICAgICAgICAgICAge0FycmF5LmlzQXJyYXkoc2VsZWN0ZWRQbHVnaW4uZW50cnkubWNwU2VydmVycylcbiAgICAgICAgICAgICAgICA/IHNlbGVjdGVkUGx1Z2luLmVudHJ5Lm1jcFNlcnZlcnMuam9pbignLCAnKVxuICAgICAgICAgICAgICAgIDogdHlwZW9mIHNlbGVjdGVkUGx1Z2luLmVudHJ5Lm1jcFNlcnZlcnMgPT09ICdvYmplY3QnXG4gICAgICAgICAgICAgICAgICA/IE9iamVjdC5rZXlzKHNlbGVjdGVkUGx1Z2luLmVudHJ5Lm1jcFNlcnZlcnMpLmpvaW4oJywgJylcbiAgICAgICAgICAgICAgICAgIDogJ2NvbmZpZ3VyZWQnfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICl9XG4gICAgICAgICAgeyFzZWxlY3RlZFBsdWdpbi5lbnRyeS5jb21tYW5kcyAmJlxuICAgICAgICAgICAgIXNlbGVjdGVkUGx1Z2luLmVudHJ5LmFnZW50cyAmJlxuICAgICAgICAgICAgIXNlbGVjdGVkUGx1Z2luLmVudHJ5Lmhvb2tzICYmXG4gICAgICAgICAgICAhc2VsZWN0ZWRQbHVnaW4uZW50cnkubWNwU2VydmVycyAmJiAoXG4gICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAge3R5cGVvZiBzZWxlY3RlZFBsdWdpbi5lbnRyeS5zb3VyY2UgPT09ICdvYmplY3QnICYmXG4gICAgICAgICAgICAgICAgJ3NvdXJjZScgaW4gc2VsZWN0ZWRQbHVnaW4uZW50cnkuc291cmNlICYmXG4gICAgICAgICAgICAgICAgKHNlbGVjdGVkUGx1Z2luLmVudHJ5LnNvdXJjZS5zb3VyY2UgPT09ICdnaXRodWInIHx8XG4gICAgICAgICAgICAgICAgICBzZWxlY3RlZFBsdWdpbi5lbnRyeS5zb3VyY2Uuc291cmNlID09PSAndXJsJyB8fFxuICAgICAgICAgICAgICAgICAgc2VsZWN0ZWRQbHVnaW4uZW50cnkuc291cmNlLnNvdXJjZSA9PT0gJ25wbScgfHxcbiAgICAgICAgICAgICAgICAgIHNlbGVjdGVkUGx1Z2luLmVudHJ5LnNvdXJjZS5zb3VyY2UgPT09ICdwaXAnKSA/IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAgICDCtyBDb21wb25lbnQgc3VtbWFyeSBub3QgYXZhaWxhYmxlIGZvciByZW1vdGUgcGx1Z2luXG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIC8vIFRPRE86IEFjdHVhbGx5IHNjYW4gbG9jYWwgcGx1Z2luIGRpcmVjdG9yaWVzIHRvIHNob3cgcmVhbCBjb21wb25lbnRzXG4gICAgICAgICAgICAgICAgICAvLyBUaGlzIHdvdWxkIHJlcXVpcmUgYWNjZXNzaW5nIHRoZSBmaWxlc3lzdGVtIHRvIGNoZWNrIGZvcjpcbiAgICAgICAgICAgICAgICAgIC8vIC0gY29tbWFuZHMvIGRpcmVjdG9yeSBhbmQgbGlzdCBmaWxlc1xuICAgICAgICAgICAgICAgICAgLy8gLSBhZ2VudHMvIGRpcmVjdG9yeSBhbmQgbGlzdCBmaWxlc1xuICAgICAgICAgICAgICAgICAgLy8gLSBob29rcy8gZGlyZWN0b3J5IGFuZCBsaXN0IGZpbGVzXG4gICAgICAgICAgICAgICAgICAvLyAtIC5tY3AuanNvbiBvciBtY3Atc2VydmVycy5qc29uIGZpbGVzXG4gICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAgwrcgQ29tcG9uZW50cyB3aWxsIGJlIGRpc2NvdmVyZWQgYXQgaW5zdGFsbGF0aW9uXG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cblxuICAgICAgICA8UGx1Z2luVHJ1c3RXYXJuaW5nIC8+XG5cbiAgICAgICAgey8qIEVycm9yIG1lc3NhZ2UgKi99XG4gICAgICAgIHtpbnN0YWxsRXJyb3IgJiYgKFxuICAgICAgICAgIDxCb3ggbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj5FcnJvcjoge2luc3RhbGxFcnJvcn08L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIE1lbnUgb3B0aW9ucyAqL31cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAge21lbnVPcHRpb25zLm1hcCgob3B0aW9uLCBpbmRleCkgPT4gKFxuICAgICAgICAgICAgPEJveCBrZXk9e29wdGlvbi5hY3Rpb259PlxuICAgICAgICAgICAgICB7ZGV0YWlsc01lbnVJbmRleCA9PT0gaW5kZXggJiYgPFRleHQ+eyc+ICd9PC9UZXh0Pn1cbiAgICAgICAgICAgICAge2RldGFpbHNNZW51SW5kZXggIT09IGluZGV4ICYmIDxUZXh0PnsnICAnfTwvVGV4dD59XG4gICAgICAgICAgICAgIDxUZXh0IGJvbGQ9e2RldGFpbHNNZW51SW5kZXggPT09IGluZGV4fT5cbiAgICAgICAgICAgICAgICB7aXNJbnN0YWxsaW5nICYmIG9wdGlvbi5hY3Rpb24gPT09ICdpbnN0YWxsJ1xuICAgICAgICAgICAgICAgICAgPyAnSW5zdGFsbGluZ+KApidcbiAgICAgICAgICAgICAgICAgIDogb3B0aW9uLmxhYmVsfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApKX1cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9IHBhZGRpbmdMZWZ0PXsxfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICBhY3Rpb249XCJzZWxlY3Q6YWNjZXB0XCJcbiAgICAgICAgICAgICAgICBjb250ZXh0PVwiU2VsZWN0XCJcbiAgICAgICAgICAgICAgICBmYWxsYmFjaz1cIkVudGVyXCJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cInNlbGVjdFwiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgICAgICBmYWxsYmFjaz1cIkVzY1wiXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJiYWNrXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICAvLyBQbHVnaW4gaW5zdGFsbGF0aW9uIHZpZXdcbiAgaWYgKGF2YWlsYWJsZVBsdWdpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgPFRleHQgYm9sZD5JbnN0YWxsIHBsdWdpbnM8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5ObyBuZXcgcGx1Z2lucyBhdmFpbGFibGUgdG8gaW5zdGFsbC48L1RleHQ+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgIEFsbCBwbHVnaW5zIGZyb20gdGhpcyBtYXJrZXRwbGFjZSBhcmUgYWxyZWFkeSBpbnN0YWxsZWQuXG4gICAgICAgIDwvVGV4dD5cbiAgICAgICAgPEJveCBtYXJnaW5MZWZ0PXszfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImdvIGJhY2tcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgLy8gR2V0IHZpc2libGUgcGx1Z2lucyBmcm9tIHBhZ2luYXRpb25cbiAgY29uc3QgdmlzaWJsZVBsdWdpbnMgPSBwYWdpbmF0aW9uLmdldFZpc2libGVJdGVtcyhhdmFpbGFibGVQbHVnaW5zKVxuXG4gIHJldHVybiAoXG4gICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgIDxUZXh0IGJvbGQ+SW5zdGFsbCBQbHVnaW5zPC9UZXh0PlxuICAgICAgPC9Cb3g+XG5cbiAgICAgIHsvKiBTY3JvbGwgdXAgaW5kaWNhdG9yICovfVxuICAgICAge3BhZ2luYXRpb24uc2Nyb2xsUG9zaXRpb24uY2FuU2Nyb2xsVXAgJiYgKFxuICAgICAgICA8Qm94PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiB7ZmlndXJlcy5hcnJvd1VwfSBtb3JlIGFib3ZlPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIHsvKiBQbHVnaW4gbGlzdCAqL31cbiAgICAgIHt2aXNpYmxlUGx1Z2lucy5tYXAoKHBsdWdpbiwgdmlzaWJsZUluZGV4KSA9PiB7XG4gICAgICAgIGNvbnN0IGFjdHVhbEluZGV4ID0gcGFnaW5hdGlvbi50b0FjdHVhbEluZGV4KHZpc2libGVJbmRleClcbiAgICAgICAgY29uc3QgaXNTZWxlY3RlZCA9IHNlbGVjdGVkSW5kZXggPT09IGFjdHVhbEluZGV4XG4gICAgICAgIGNvbnN0IGlzU2VsZWN0ZWRGb3JJbnN0YWxsID0gc2VsZWN0ZWRGb3JJbnN0YWxsLmhhcyhwbHVnaW4ucGx1Z2luSWQpXG4gICAgICAgIGNvbnN0IGlzSW5zdGFsbGluZyA9IGluc3RhbGxpbmdQbHVnaW5zLmhhcyhwbHVnaW4ucGx1Z2luSWQpXG4gICAgICAgIGNvbnN0IGlzTGFzdCA9IHZpc2libGVJbmRleCA9PT0gdmlzaWJsZVBsdWdpbnMubGVuZ3RoIC0gMVxuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPEJveFxuICAgICAgICAgICAga2V5PXtwbHVnaW4ucGx1Z2luSWR9XG4gICAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICAgIG1hcmdpbkJvdHRvbT17aXNMYXN0ICYmICFlcnJvciA/IDAgOiAxfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPXtpc1NlbGVjdGVkID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfT5cbiAgICAgICAgICAgICAgICB7aXNTZWxlY3RlZCA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ317JyAnfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPXtwbHVnaW4uaXNJbnN0YWxsZWQgPyAnc3VjY2VzcycgOiB1bmRlZmluZWR9PlxuICAgICAgICAgICAgICAgIHtwbHVnaW4uaXNJbnN0YWxsZWRcbiAgICAgICAgICAgICAgICAgID8gZmlndXJlcy50aWNrXG4gICAgICAgICAgICAgICAgICA6IGlzSW5zdGFsbGluZ1xuICAgICAgICAgICAgICAgICAgICA/IGZpZ3VyZXMuZWxsaXBzaXNcbiAgICAgICAgICAgICAgICAgICAgOiBpc1NlbGVjdGVkRm9ySW5zdGFsbFxuICAgICAgICAgICAgICAgICAgICAgID8gZmlndXJlcy5yYWRpb09uXG4gICAgICAgICAgICAgICAgICAgICAgOiBmaWd1cmVzLnJhZGlvT2ZmfXsnICd9XG4gICAgICAgICAgICAgICAge3BsdWdpbi5lbnRyeS5uYW1lfVxuICAgICAgICAgICAgICAgIHtwbHVnaW4uZW50cnkuY2F0ZWdvcnkgJiYgKFxuICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+IFt7cGx1Z2luLmVudHJ5LmNhdGVnb3J5fV08L1RleHQ+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICB7cGx1Z2luLmVudHJ5LnRhZ3M/LmluY2x1ZGVzKCdjb21tdW5pdHktbWFuYWdlZCcpICYmIChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiBbQ29tbXVuaXR5IE1hbmFnZWRdPC9UZXh0PlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAge3BsdWdpbi5pc0luc3RhbGxlZCAmJiA8VGV4dCBkaW1Db2xvcj4gKGluc3RhbGxlZCk8L1RleHQ+fVxuICAgICAgICAgICAgICAgIHtpbnN0YWxsQ291bnRzICYmXG4gICAgICAgICAgICAgICAgICBzZWxlY3RlZE1hcmtldHBsYWNlID09PSBPRkZJQ0lBTF9NQVJLRVRQTEFDRV9OQU1FICYmIChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgICAgeycgwrcgJ31cbiAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0SW5zdGFsbENvdW50KFxuICAgICAgICAgICAgICAgICAgICAgICAgaW5zdGFsbENvdW50cy5nZXQocGx1Z2luLnBsdWdpbklkKSA/PyAwLFxuICAgICAgICAgICAgICAgICAgICAgICl9eycgJ31cbiAgICAgICAgICAgICAgICAgICAgICBpbnN0YWxsc1xuICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgIHtwbHVnaW4uZW50cnkuZGVzY3JpcHRpb24gJiYgKFxuICAgICAgICAgICAgICA8Qm94IG1hcmdpbkxlZnQ9ezR9PlxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAge3RydW5jYXRlVG9XaWR0aChwbHVnaW4uZW50cnkuZGVzY3JpcHRpb24sIDYwKX1cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAge3BsdWdpbi5lbnRyeS52ZXJzaW9uICYmIChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiDCtyB2e3BsdWdpbi5lbnRyeS52ZXJzaW9ufTwvVGV4dD5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIClcbiAgICAgIH0pfVxuXG4gICAgICB7LyogU2Nyb2xsIGRvd24gaW5kaWNhdG9yICovfVxuICAgICAge3BhZ2luYXRpb24uc2Nyb2xsUG9zaXRpb24uY2FuU2Nyb2xsRG93biAmJiAoXG4gICAgICAgIDxCb3g+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+IHtmaWd1cmVzLmFycm93RG93bn0gbW9yZSBiZWxvdzwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICB7LyogRXJyb3IgbWVzc2FnZXMgc2hvd24gaW4gdGhlIFVJICovfVxuICAgICAge2Vycm9yICYmIChcbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj5cbiAgICAgICAgICAgIHtmaWd1cmVzLmNyb3NzfSB7ZXJyb3J9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIDxQbHVnaW5TZWxlY3Rpb25LZXlIaW50IGhhc1NlbGVjdGlvbj17c2VsZWN0ZWRGb3JJbnN0YWxsLnNpemUgPiAwfSAvPlxuICAgIDwvQm94PlxuICApXG59XG4iXSwibWFwcGluZ3MiOiJBQUFBLE9BQU9BLE9BQU8sTUFBTSxTQUFTO0FBQzdCLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsU0FBUyxFQUFFQyxRQUFRLFFBQVEsT0FBTztBQUMzQyxTQUFTQyx3QkFBd0IsUUFBUSw4Q0FBOEM7QUFDdkYsU0FBU0MsTUFBTSxRQUFRLDBDQUEwQztBQUNqRSxTQUFTQyxHQUFHLEVBQUVDLElBQUksUUFBUSxjQUFjO0FBQ3hDLFNBQ0VDLGFBQWEsRUFDYkMsY0FBYyxRQUNULG9DQUFvQztBQUMzQyxjQUFjQyxZQUFZLFFBQVEsdUJBQXVCO0FBQ3pELFNBQVNDLEtBQUssUUFBUSxzQkFBc0I7QUFDNUMsU0FBU0MsV0FBVyxRQUFRLHdCQUF3QjtBQUNwRCxTQUFTQyxlQUFlLFFBQVEsc0JBQXNCO0FBQ3RELFNBQVNDLFlBQVksUUFBUSx1QkFBdUI7QUFDcEQsU0FBU0MsY0FBYyxRQUFRLG1DQUFtQztBQUNsRSxTQUNFQyxrQkFBa0IsRUFDbEJD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