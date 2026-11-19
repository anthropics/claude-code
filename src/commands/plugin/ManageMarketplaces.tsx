import { c as _c } from "react/compiler-runtime";
import figures from 'figures';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js';
import { Byline } from '../../components/design-system/Byline.js';
import { KeyboardShortcutHint } from '../../components/design-system/KeyboardShortcutHint.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- useInput needed for marketplace-specific u/r shortcuts and y/n confirmation not in keybinding schema
import { Box, Text, useInput } from '../../ink.js';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding.js';
import type { LoadedPlugin } from '../../types/plugin.js';
import { count } from '../../utils/array.js';
import { shouldSkipPluginAutoupdate } from '../../utils/config.js';
import { errorMessage } from '../../utils/errors.js';
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js';
import { createPluginId, formatMarketplaceLoadingErrors, getMarketplaceSourceDisplay, loadMarketplacesWithGracefulDegradation } from '../../utils/plugins/marketplaceHelpers.js';
import { loadKnownMarketplacesConfig, refreshMarketplace, removeMarketplaceSource, setMarketplaceAutoUpdate } from '../../utils/plugins/marketplaceManager.js';
import { updatePluginsForMarketplaces } from '../../utils/plugins/pluginAutoupdate.js';
import { loadAllPlugins } from '../../utils/plugins/pluginLoader.js';
import { isMarketplaceAutoUpdate } from '../../utils/plugins/schemas.js';
import { getSettingsForSource, updateSettingsForSource } from '../../utils/settings/settings.js';
import { plural } from '../../utils/stringUtils.js';
import type { ViewState } from './types.js';
type Props = {
  setViewState: (state: ViewState) => void;
  error?: string | null;
  setError?: (error: string | null) => void;
  setResult: (result: string | null) => void;
  exitState: {
    pending: boolean;
    keyName: 'Ctrl-C' | 'Ctrl-D' | null;
  };
  onManageComplete?: () => void | Promise<void>;
  targetMarketplace?: string;
  action?: 'update' | 'remove';
};
type MarketplaceState = {
  name: string;
  source: string;
  lastUpdated?: string;
  pluginCount?: number;
  installedPlugins?: LoadedPlugin[];
  pendingUpdate?: boolean;
  pendingRemove?: boolean;
  autoUpdate?: boolean;
};
type InternalViewState = 'list' | 'details' | 'confirm-remove';
export function ManageMarketplaces({
  setViewState,
  error,
  setError,
  setResult,
  exitState,
  onManageComplete,
  targetMarketplace,
  action
}: Props): React.ReactNode {
  const [marketplaceStates, setMarketplaceStates] = useState<MarketplaceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [internalView, setInternalView] = useState<InternalViewState>('list');
  const [selectedMarketplace, setSelectedMarketplace] = useState<MarketplaceState | null>(null);
  const [detailsMenuIndex, setDetailsMenuIndex] = useState(0);
  const hasAttemptedAutoAction = useRef(false);

  // Load marketplaces and their installed plugins
  useEffect(() => {
    async function loadMarketplaces() {
      try {
        const config = await loadKnownMarketplacesConfig();
        const {
          enabled,
          disabled
        } = await loadAllPlugins();
        const allPlugins = [...enabled, ...disabled];

        // Load marketplaces with graceful degradation
        const {
          marketplaces,
          failures
        } = await loadMarketplacesWithGracefulDegradation(config);
        const states: MarketplaceState[] = [];
        for (const {
          name,
          config: entry,
          data: marketplace
        } of marketplaces) {
          // Get all plugins installed from this marketplace
          const installedFromMarketplace = allPlugins.filter(plugin => plugin.source.endsWith(`@${name}`));
          states.push({
            name,
            source: getMarketplaceSourceDisplay(entry.source),
            lastUpdated: entry.lastUpdated,
            pluginCount: marketplace?.plugins.length,
            installedPlugins: installedFromMarketplace,
            pendingUpdate: false,
            pendingRemove: false,
            autoUpdate: isMarketplaceAutoUpdate(name, entry)
          });
        }

        // Sort: claude-plugin-directory first, then alphabetically
        states.sort((a, b) => {
          if (a.name === 'claude-plugin-directory') return -1;
          if (b.name === 'claude-plugin-directory') return 1;
          return a.name.localeCompare(b.name);
        });
        setMarketplaceStates(states);

        // Handle marketplace loading errors/warnings
        const successCount = count(marketplaces, m => m.data !== null);
        const errorResult = formatMarketplaceLoadingErrors(failures, successCount);
        if (errorResult) {
          if (errorResult.type === 'warning') {
            setProcessError(errorResult.message);
          } else {
            throw new Error(errorResult.message);
          }
        }

        // Auto-execute if target and action provided
        if (targetMarketplace && !hasAttemptedAutoAction.current && !error) {
          hasAttemptedAutoAction.current = true;
          const targetIndex = states.findIndex(s => s.name === targetMarketplace);
          if (targetIndex >= 0) {
            const targetState = states[targetIndex];
            if (action) {
              // Mark the action as pending and execute
              setSelectedIndex(targetIndex + 1); // +1 because "Add Marketplace" is at index 0
              const newStates = [...states];
              if (action === 'update') {
                newStates[targetIndex]!.pendingUpdate = true;
              } else if (action === 'remove') {
                newStates[targetIndex]!.pendingRemove = true;
              }
              setMarketplaceStates(newStates);
              // Apply the change immediately
              setTimeout(applyChanges, 100, newStates);
            } else if (targetState) {
              // No action - just show the details view for this marketplace
              setSelectedIndex(targetIndex + 1); // +1 because "Add Marketplace" is at index 0
              setSelectedMarketplace(targetState);
              setInternalView('details');
            }
          } else if (setError) {
            setError(`Marketplace not found: ${targetMarketplace}`);
          }
        }
      } catch (err) {
        if (setError) {
          setError(err instanceof Error ? err.message : 'Failed to load marketplaces');
        }
        setProcessError(err instanceof Error ? err.message : 'Failed to load marketplaces');
      } finally {
        setLoading(false);
      }
    }
    void loadMarketplaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  }, [targetMarketplace, action, error]);

  // Check if there are any pending changes
  const hasPendingChanges = () => {
    return marketplaceStates.some(state => state.pendingUpdate || state.pendingRemove);
  };

  // Get count of pending operations
  const getPendingCounts = () => {
    const updateCount = count(marketplaceStates, s => s.pendingUpdate);
    const removeCount = count(marketplaceStates, s => s.pendingRemove);
    return {
      updateCount,
      removeCount
    };
  };

  // Apply all pending changes
  const applyChanges = async (states?: MarketplaceState[]) => {
    const statesToProcess = states || marketplaceStates;
    const wasInDetailsView = internalView === 'details';
    setIsProcessing(true);
    setProcessError(null);
    setSuccessMessage(null);
    setProgressMessage(null);
    try {
      const settings = getSettingsForSource('userSettings');
      let updatedCount = 0;
      let removedCount = 0;
      const refreshedMarketplaces = new Set<string>();
      for (const state of statesToProcess) {
        // Handle remove
        if (state.pendingRemove) {
          // First uninstall all plugins from this marketplace
          if (state.installedPlugins && state.installedPlugins.length > 0) {
            const newEnabledPlugins = {
              ...settings?.enabledPlugins
            };
            for (const plugin of state.installedPlugins) {
              const pluginId = createPluginId(plugin.name, state.name);
              // Mark as disabled/uninstalled
              newEnabledPlugins[pluginId] = false;
            }
            updateSettingsForSource('userSettings', {
              enabledPlugins: newEnabledPlugins
            });
          }

          // Then remove the marketplace
          await removeMarketplaceSource(state.name);
          removedCount++;
          logEvent('tengu_marketplace_removed', {
            marketplace_name: state.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            plugins_uninstalled: state.installedPlugins?.length || 0
          });
          continue;
        }

        // Handle update
        if (state.pendingUpdate) {
          // Refresh individual marketplace for efficiency with progress reporting
          await refreshMarketplace(state.name, (message: string) => {
            setProgressMessage(message);
          });
          updatedCount++;
          refreshedMarketplaces.add(state.name.toLowerCase());
          logEvent('tengu_marketplace_updated', {
            marketplace_name: state.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
        }
      }

      // After marketplace clones are refreshed, bump installed plugins from
      // those marketplaces to the new version. Without this, the loader's
      // cache-on-miss (copyPluginToVersionedCache) creates the new version
      // dir on the next loadAllPlugins() call, but installed_plugins.json
      // stays on the old version — so cleanupOrphanedPluginVersionsInBackground
      // stamps the NEW dir with .orphaned_at on the next startup. See #29512.
      // updatePluginOp (called inside the helper) is what actually writes
      // installed_plugins.json via updateInstallationPathOnDisk.
      let updatedPluginCount = 0;
      if (refreshedMarketplaces.size > 0) {
        const updatedPluginIds = await updatePluginsForMarketplaces(refreshedMarketplaces);
        updatedPluginCount = updatedPluginIds.length;
      }

      // Clear caches after changes
      clearAllCaches();

      // Call completion callback
      if (onManageComplete) {
        await onManageComplete();
      }

      // Reload marketplace data to show updated timestamps
      const config = await loadKnownMarketplacesConfig();
      const {
        enabled,
        disabled
      } = await loadAllPlugins();
      const allPlugins = [...enabled, ...disabled];
      const {
        marketplaces
      } = await loadMarketplacesWithGracefulDegradation(config);
      const newStates: MarketplaceState[] = [];
      for (const {
        name,
        config: entry,
        data: marketplace
      } of marketplaces) {
        const installedFromMarketplace = allPlugins.filter(plugin => plugin.source.endsWith(`@${name}`));
        newStates.push({
          name,
          source: getMarketplaceSourceDisplay(entry.source),
          lastUpdated: entry.lastUpdated,
          pluginCount: marketplace?.plugins.length,
          installedPlugins: installedFromMarketplace,
          pendingUpdate: false,
          pendingRemove: false,
          autoUpdate: isMarketplaceAutoUpdate(name, entry)
        });
      }

      // Sort: claude-plugin-directory first, then alphabetically
      newStates.sort((a, b) => {
        if (a.name === 'claude-plugin-directory') return -1;
        if (b.name === 'claude-plugin-directory') return 1;
        return a.name.localeCompare(b.name);
      });
      setMarketplaceStates(newStates);

      // Update selected marketplace reference with fresh data
      if (wasInDetailsView && selectedMarketplace) {
        const updatedMarketplace = newStates.find(s => s.name === selectedMarketplace.name);
        if (updatedMarketplace) {
          setSelectedMarketplace(updatedMarketplace);
        }
      }

      // Build success message
      const actions: string[] = [];
      if (updatedCount > 0) {
        const pluginPart = updatedPluginCount > 0 ? ` (${updatedPluginCount} ${plural(updatedPluginCount, 'plugin')} bumped)` : '';
        actions.push(`Updated ${updatedCount} ${plural(updatedCount, 'marketplace')}${pluginPart}`);
      }
      if (removedCount > 0) {
        actions.push(`Removed ${removedCount} ${plural(removedCount, 'marketplace')}`);
      }
      if (actions.length > 0) {
        const successMsg = `${figures.tick} ${actions.join(', ')}`;
        // If we were in details view, stay there and show success
        if (wasInDetailsView) {
          setSuccessMessage(successMsg);
        } else {
          // Otherwise show result and exit to menu
          setResult(successMsg);
          setTimeout(setViewState, 2000, {
            type: 'menu' as const
          });
        }
      } else if (!wasInDetailsView) {
        setViewState({
          type: 'menu'
        });
      }
    } catch (err) {
      const errorMsg = errorMessage(err);
      setProcessError(errorMsg);
      if (setError) {
        setError(errorMsg);
      }
    } finally {
      setIsProcessing(false);
      setProgressMessage(null);
    }
  };

  // Handle confirming marketplace removal
  const confirmRemove = async () => {
    if (!selectedMarketplace) return;

    // Mark for removal and apply
    const newStates = marketplaceStates.map(state => state.name === selectedMarketplace.name ? {
      ...state,
      pendingRemove: true
    } : state);
    setMarketplaceStates(newStates);
    await applyChanges(newStates);
  };

  // Build menu options for details view
  const buildDetailsMenuOptions = (marketplace: MarketplaceState | null): Array<{
    label: string;
    secondaryLabel?: string;
    value: string;
  }> => {
    if (!marketplace) return [];
    const options: Array<{
      label: string;
      secondaryLabel?: string;
      value: string;
    }> = [{
      label: `Browse plugins (${marketplace.pluginCount ?? 0})`,
      value: 'browse'
    }, {
      label: 'Update marketplace',
      secondaryLabel: marketplace.lastUpdated ? `(last updated ${new Date(marketplace.lastUpdated).toLocaleDateString()})` : undefined,
      value: 'update'
    }];

    // Only show auto-update toggle if auto-updater is not globally disabled
    if (!shouldSkipPluginAutoupdate()) {
      options.push({
        label: marketplace.autoUpdate ? 'Disable auto-update' : 'Enable auto-update',
        value: 'toggle-auto-update'
      });
    }
    options.push({
      label: 'Remove marketplace',
      value: 'remove'
    });
    return options;
  };

  // Handle toggling auto-update for a marketplace
  const handleToggleAutoUpdate = async (marketplace: MarketplaceState) => {
    const newAutoUpdate = !marketplace.autoUpdate;
    try {
      await setMarketplaceAutoUpdate(marketplace.name, newAutoUpdate);

      // Update local state
      setMarketplaceStates(prev => prev.map(state => state.name === marketplace.name ? {
        ...state,
        autoUpdate: newAutoUpdate
      } : state));

      // Update selected marketplace reference
      setSelectedMarketplace(prev => prev ? {
        ...prev,
        autoUpdate: newAutoUpdate
      } : prev);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : 'Failed to update setting');
    }
  };

  // Escape in details or confirm-remove view - go back to list
  useKeybinding('confirm:no', () => {
    setInternalView('list');
    setDetailsMenuIndex(0);
  }, {
    context: 'Confirmation',
    isActive: !isProcessing && (internalView === 'details' || internalView === 'confirm-remove')
  });

  // Escape in list view with pending changes - clear pending changes
  useKeybinding('confirm:no', () => {
    setMarketplaceStates(prev => prev.map(state => ({
      ...state,
      pendingUpdate: false,
      pendingRemove: false
    })));
    setSelectedIndex(0);
  }, {
    context: 'Confirmation',
    isActive: !isProcessing && internalView === 'list' && hasPendingChanges()
  });

  // Escape in list view without pending changes - exit to parent menu
  useKeybinding('confirm:no', () => {
    setViewState({
      type: 'menu'
    });
  }, {
    context: 'Confirmation',
    isActive: !isProcessing && internalView === 'list' && !hasPendingChanges()
  });

  // List view — navigation (up/down/enter via configurable keybindings)
  useKeybindings({
    'select:previous': () => setSelectedIndex(prev => Math.max(0, prev - 1)),
    'select:next': () => {
      const totalItems = marketplaceStates.length + 1;
      setSelectedIndex(prev => Math.min(totalItems - 1, prev + 1));
    },
    'select:accept': () => {
      const marketplaceIndex = selectedIndex - 1;
      if (selectedIndex === 0) {
        setViewState({
          type: 'add-marketplace'
        });
      } else if (hasPendingChanges()) {
        void applyChanges();
      } else {
        const marketplace = marketplaceStates[marketplaceIndex];
        if (marketplace) {
          setSelectedMarketplace(marketplace);
          setInternalView('details');
          setDetailsMenuIndex(0);
        }
      }
    }
  }, {
    context: 'Select',
    isActive: !isProcessing && internalView === 'list'
  });

  // List view — marketplace-specific actions (u/r shortcuts)
  useInput(input => {
    const marketplaceIndex = selectedIndex - 1;
    if ((input === 'u' || input === 'U') && marketplaceIndex >= 0) {
      setMarketplaceStates(prev => prev.map((state, idx) => idx === marketplaceIndex ? {
        ...state,
        pendingUpdate: !state.pendingUpdate,
        pendingRemove: state.pendingUpdate ? state.pendingRemove : false
      } : state));
    } else if ((input === 'r' || input === 'R') && marketplaceIndex >= 0) {
      const marketplace = marketplaceStates[marketplaceIndex];
      if (marketplace) {
        setSelectedMarketplace(marketplace);
        setInternalView('confirm-remove');
      }
    }
  }, {
    isActive: !isProcessing && internalView === 'list'
  });

  // Details view — navigation
  useKeybindings({
    'select:previous': () => setDetailsMenuIndex(prev => Math.max(0, prev - 1)),
    'select:next': () => {
      const menuOptions = buildDetailsMenuOptions(selectedMarketplace);
      setDetailsMenuIndex(prev => Math.min(menuOptions.length - 1, prev + 1));
    },
    'select:accept': () => {
      if (!selectedMarketplace) return;
      const menuOptions = buildDetailsMenuOptions(selectedMarketplace);
      const selectedOption = menuOptions[detailsMenuIndex];
      if (selectedOption?.value === 'browse') {
        setViewState({
          type: 'browse-marketplace',
          targetMarketplace: selectedMarketplace.name
        });
      } else if (selectedOption?.value === 'update') {
        const newStates = marketplaceStates.map(state => state.name === selectedMarketplace.name ? {
          ...state,
          pendingUpdate: true
        } : state);
        setMarketplaceStates(newStates);
        void applyChanges(newStates);
      } else if (selectedOption?.value === 'toggle-auto-update') {
        void handleToggleAutoUpdate(selectedMarketplace);
      } else if (selectedOption?.value === 'remove') {
        setInternalView('confirm-remove');
      }
    }
  }, {
    context: 'Select',
    isActive: !isProcessing && internalView === 'details'
  });

  // Confirm-remove view — y/n input
  useInput(input => {
    if (input === 'y' || input === 'Y') {
      void confirmRemove();
    } else if (input === 'n' || input === 'N') {
      setInternalView('list');
      setSelectedMarketplace(null);
    }
  }, {
    isActive: !isProcessing && internalView === 'confirm-remove'
  });
  if (loading) {
    return <Text>Loading marketplaces…</Text>;
  }
  if (marketplaceStates.length === 0) {
    return <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Manage marketplaces</Text>
        </Box>

        {/* Add Marketplace option */}
        <Box flexDirection="row" gap={1}>
          <Text color="suggestion">{figures.pointer} +</Text>
          <Text bold color="suggestion">
            Add Marketplace
          </Text>
        </Box>

        <Box marginLeft={3}>
          <Text dimColor italic>
            {exitState.pending ? <>Press {exitState.keyName} again to go back</> : <Byline>
                <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="select" />
                <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" />
              </Byline>}
          </Text>
        </Box>
      </Box>;
  }

  // Show confirmation dialog
  if (internalView === 'confirm-remove' && selectedMarketplace) {
    const pluginCount = selectedMarketplace.installedPlugins?.length || 0;
    return <Box flexDirection="column">
        <Text bold color="warning">
          Remove marketplace <Text italic>{selectedMarketplace.name}</Text>?
        </Text>
        <Box flexDirection="column">
          {pluginCount > 0 && <Box marginTop={1}>
              <Text color="warning">
                This will also uninstall {pluginCount}{' '}
                {plural(pluginCount, 'plugin')} from this marketplace:
              </Text>
            </Box>}
          {selectedMarketplace.installedPlugins && selectedMarketplace.installedPlugins.length > 0 && <Box flexDirection="column" marginTop={1} marginLeft={2}>
                {selectedMarketplace.installedPlugins.map(plugin => <Text key={plugin.name} dimColor>
                    • {plugin.name}
                  </Text>)}
              </Box>}
          <Box marginTop={1}>
            <Text>
              Press <Text bold>y</Text> to confirm or <Text bold>n</Text> to
              cancel
            </Text>
          </Box>
        </Box>
      </Box>;
  }

  // Show marketplace details
  if (internalView === 'details' && selectedMarketplace) {
    // Check if this marketplace is currently being processed
    // Check pendingUpdate first so we show updating state immediately when user presses Enter
    const isUpdating = selectedMarketplace.pendingUpdate || isProcessing;
    const menuOptions = buildDetailsMenuOptions(selectedMarketplace);
    return <Box flexDirection="column">
        <Text bold>{selectedMarketplace.name}</Text>
        <Text dimColor>{selectedMarketplace.source}</Text>
        <Box marginTop={1}>
          <Text>
            {selectedMarketplace.pluginCount || 0} available{' '}
            {plural(selectedMarketplace.pluginCount || 0, 'plugin')}
          </Text>
        </Box>

        {/* Installed plugins section */}
        {selectedMarketplace.installedPlugins && selectedMarketplace.installedPlugins.length > 0 && <Box flexDirection="column" marginTop={1}>
              <Text bold>
                Installed plugins ({selectedMarketplace.installedPlugins.length}
                ):
              </Text>
              <Box flexDirection="column" marginLeft={1}>
                {selectedMarketplace.installedPlugins.map(plugin => <Box key={plugin.name} flexDirection="row" gap={1}>
                    <Text>{figures.bullet}</Text>
                    <Box flexDirection="column">
                      <Text>{plugin.name}</Text>
                      <Text dimColor>{plugin.manifest.description}</Text>
                    </Box>
                  </Box>)}
              </Box>
            </Box>}

        {/* Processing indicator */}
        {isUpdating && <Box marginTop={1} flexDirection="column">
            <Text color="claude">Updating marketplace…</Text>
            {progressMessage && <Text dimColor>{progressMessage}</Text>}
          </Box>}

        {/* Success message */}
        {!isUpdating && successMessage && <Box marginTop={1}>
            <Text color="claude">{successMessage}</Text>
          </Box>}

        {/* Error message */}
        {!isUpdating && processError && <Box marginTop={1}>
            <Text color="error">{processError}</Text>
          </Box>}

        {/* Menu options */}
        {!isUpdating && <Box flexDirection="column" marginTop={1}>
            {menuOptions.map((option, idx) => {
          if (!option) return null;
          const isSelected = idx === detailsMenuIndex;
          return <Box key={option.value}>
                  <Text color={isSelected ? 'suggestion' : undefined}>
                    {isSelected ? figures.pointer : ' '} {option.label}
                  </Text>
                  {option.secondaryLabel && <Text dimColor> {option.secondaryLabel}</Text>}
                </Box>;
        })}
          </Box>}

        {/* Show explanatory text at the bottom when auto-update is enabled */}
        {!isUpdating && !shouldSkipPluginAutoupdate() && selectedMarketplace.autoUpdate && <Box marginTop={1}>
              <Text dimColor>
                Auto-update enabled. Claude Code will automatically update this
                marketplace and its installed plugins.
              </Text>
            </Box>}

        <Box marginLeft={3}>
          <Text dimColor italic>
            {isUpdating ? <>Please wait…</> : <Byline>
                <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="select" />
                <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="go back" />
              </Byline>}
          </Text>
        </Box>
      </Box>;
  }

  // Show marketplace list
  const {
    updateCount,
    removeCount
  } = getPendingCounts();
  return <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Manage marketplaces</Text>
      </Box>

      {/* Add Marketplace option */}
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <Text color={selectedIndex === 0 ? 'suggestion' : undefined}>
          {selectedIndex === 0 ? figures.pointer : ' '} +
        </Text>
        <Text bold color={selectedIndex === 0 ? 'suggestion' : undefined}>
          Add Marketplace
        </Text>
      </Box>

      {/* Marketplace list */}
      <Box flexDirection="column">
        {marketplaceStates.map((state, idx) => {
        const isSelected = idx + 1 === selectedIndex; // +1 because Add Marketplace is at index 0

        // Build status indicators
        const indicators: string[] = [];
        if (state.pendingUpdate) indicators.push('UPDATE');
        if (state.pendingRemove) indicators.push('REMOVE');
        return <Box key={state.name} flexDirection="row" gap={1} marginBottom={1}>
              <Text color={isSelected ? 'suggestion' : undefined}>
                {isSelected ? figures.pointer : ' '}{' '}
                {state.pendingRemove ? figures.cross : figures.bullet}
              </Text>
              <Box flexDirection="column" flexGrow={1}>
                <Box flexDirection="row" gap={1}>
                  <Text bold strikethrough={state.pendingRemove} dimColor={state.pendingRemove}>
                    {state.name === 'claude-plugins-official' && <Text color="claude">✻ </Text>}
                    {state.name}
                    {state.name === 'claude-plugins-official' && <Text color="claude"> ✻</Text>}
                  </Text>
                  {indicators.length > 0 && <Text color="warning">[{indicators.join(', ')}]</Text>}
                </Box>
                <Text dimColor>{state.source}</Text>
                <Text dimColor>
                  {state.pluginCount !== undefined && <>{state.pluginCount} available</>}
                  {state.installedPlugins && state.installedPlugins.length > 0 && <> • {state.installedPlugins.length} installed</>}
                  {state.lastUpdated && <>
                      {' '}
                      • Updated{' '}
                      {new Date(state.lastUpdated).toLocaleDateString()}
                    </>}
                </Text>
              </Box>
            </Box>;
      })}
      </Box>

      {/* Pending changes summary */}
      {hasPendingChanges() && <Box marginTop={1} flexDirection="column">
          <Text>
            <Text bold>Pending changes:</Text>{' '}
            <Text dimColor>Enter to apply</Text>
          </Text>
          {updateCount > 0 && <Text>
              • Update {updateCount} {plural(updateCount, 'marketplace')}
            </Text>}
          {removeCount > 0 && <Text color="warning">
              • Remove {removeCount} {plural(removeCount, 'marketplace')}
            </Text>}
        </Box>}

      {/* Processing indicator */}
      {isProcessing && <Box marginTop={1}>
          <Text color="claude">Processing changes…</Text>
        </Box>}

      {/* Error display */}
      {processError && <Box marginTop={1}>
          <Text color="error">{processError}</Text>
        </Box>}

      <ManageMarketplacesKeyHints exitState={exitState} hasPendingActions={hasPendingChanges()} />
    </Box>;
}
type ManageMarketplacesKeyHintsProps = {
  exitState: Props['exitState'];
  hasPendingActions: boolean;
};
function ManageMarketplacesKeyHints(t0) {
  const $ = _c(18);
  const {
    exitState,
    hasPendingActions
  } = t0;
  if (exitState.pending) {
    let t1;
    if ($[0] !== exitState.keyName) {
      t1 = <Box marginTop={1}><Text dimColor={true} italic={true}>Press {exitState.keyName} again to go back</Text></Box>;
      $[0] = exitState.keyName;
      $[1] = t1;
    } else {
      t1 = $[1];
    }
    return t1;
  }
  let t1;
  if ($[2] !== hasPendingActions) {
    t1 = hasPendingActions && <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="apply changes" />;
    $[2] = hasPendingActions;
    $[3] = t1;
  } else {
    t1 = $[3];
  }
  let t2;
  if ($[4] !== hasPendingActions) {
    t2 = !hasPendingActions && <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="select" />;
    $[4] = hasPendingActions;
    $[5] = t2;
  } else {
    t2 = $[5];
  }
  let t3;
  if ($[6] !== hasPendingActions) {
    t3 = !hasPendingActions && <KeyboardShortcutHint shortcut="u" action="update" />;
    $[6] = hasPendingActions;
    $[7] = t3;
  } else {
    t3 = $[7];
  }
  let t4;
  if ($[8] !== hasPendingActions) {
    t4 = !hasPendingActions && <KeyboardShortcutHint shortcut="r" action="remove" />;
    $[8] = hasPendingActions;
    $[9] = t4;
  } else {
    t4 = $[9];
  }
  const t5 = hasPendingActions ? "cancel" : "go back";
  let t6;
  if ($[10] !== t5) {
    t6 = <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description={t5} />;
    $[10] = t5;
    $[11] = t6;
  } else {
    t6 = $[11];
  }
  let t7;
  if ($[12] !== t1 || $[13] !== t2 || $[14] !== t3 || $[15] !== t4 || $[16] !== t6) {
    t7 = <Box marginTop={1}><Text dimColor={true} italic={true}><Byline>{t1}{t2}{t3}{t4}{t6}</Byline></Text></Box>;
    $[12] = t1;
    $[13] = t2;
    $[14] = t3;
    $[15] = t4;
    $[16] = t6;
    $[17] = t7;
  } else {
    t7 = $[17];
  }
  return t7;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VFZmZlY3QiLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJsb2dFdmVudCIsIkNvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCIsIkJ5bGluZSIsIktleWJvYXJkU2hvcnRjdXRIaW50IiwiQm94IiwiVGV4dCIsInVzZUlucHV0IiwidXNlS2V5YmluZGluZyIsInVzZUtleWJpbmRpbmdzIiwiTG9hZGVkUGx1Z2luIiwiY291bnQiLCJzaG91bGRTa2lwUGx1Z2luQXV0b3VwZGF0ZSIsImVycm9yTWVzc2FnZSIsImNsZWFyQWxsQ2FjaGVzIiwiY3JlYXRlUGx1Z2luSWQiLCJmb3JtYXRNYXJrZXRwbGFjZUxvYWRpbmdFcnJvcnMiLCJnZXRNYXJrZXRwbGFjZVNvdXJjZURpc3BsYXkiLCJsb2FkTWFya2V0cGxhY2VzV2l0aEdyYWNlZnVsRGVncmFkYXRpb24iLCJsb2FkS25vd25NYXJrZXRwbGFjZXNDb25maWciLCJyZWZyZXNoTWFya2V0cGxhY2UiLCJyZW1vdmVNYXJrZXRwbGFjZVNvdXJjZSIsInNldE1hcmtldHBsYWNlQXV0b1VwZGF0ZSIsInVwZGF0ZVBsdWdpbnNGb3JNYXJrZXRwbGFjZXMiLCJsb2FkQWxsUGx1Z2lucyIsImlzTWFya2V0cGxhY2VBdXRvVXBkYXRlIiwiZ2V0U2V0dGluZ3NGb3JTb3VyY2UiLCJ1cGRhdGVTZXR0aW5nc0ZvclNvdXJjZSIsInBsdXJhbCIsIlZpZXdTdGF0ZSIsIlByb3BzIiwic2V0Vmlld1N0YXRlIiwic3RhdGUiLCJlcnJvciIsInNldEVycm9yIiwic2V0UmVzdWx0IiwicmVzdWx0IiwiZXhpdFN0YXRlIiwicGVuZGluZyIsImtleU5hbWUiLCJvbk1hbmFnZUNvbXBsZXRlIiwiUHJvbWlzZSIsInRhcmdldE1hcmtldHBsYWNlIiwiYWN0aW9uIiwiTWFya2V0cGxhY2VTdGF0ZSIsIm5hbWUiLCJzb3VyY2UiLCJsYXN0VXBkYXRlZCIsInBsdWdpbkNvdW50IiwiaW5zdGFsbGVkUGx1Z2lucyIsInBlbmRpbmdVcGRhdGUiLCJwZW5kaW5nUmVtb3ZlIiwiYXV0b1VwZGF0ZSIsIkludGVybmFsVmlld1N0YXRlIiwiTWFuYWdlTWFya2V0cGxhY2VzIiwiUmVhY3ROb2RlIiwibWFya2V0cGxhY2VTdGF0ZXMiLCJzZXRNYXJrZXRwbGFjZVN0YXRlcyIsImxvYWRpbmciLCJzZXRMb2FkaW5nIiwic2VsZWN0ZWRJbmRleCIsInNldFNlbGVjdGVkSW5kZXgiLCJpc1Byb2Nlc3NpbmciLCJzZXRJc1Byb2Nlc3NpbmciLCJwcm9jZXNzRXJyb3IiLCJzZXRQcm9jZXNzRXJyb3IiLCJzdWNjZXNzTWVzc2FnZSIsInNldFN1Y2Nlc3NNZXNzYWdlIiwicHJvZ3Jlc3NNZXNzYWdlIiwic2V0UHJvZ3Jlc3NNZXNzYWdlIiwiaW50ZXJuYWxWaWV3Iiwic2V0SW50ZXJuYWxWaWV3Iiwic2VsZWN0ZWRNYXJrZXRwbGFjZSIsInNldFNlbGVjdGVkTWFya2V0cGxhY2UiLCJkZXRhaWxzTWVudUluZGV4Iiwic2V0RGV0YWlsc01lbnVJbmRleCIsImhhc0F0dGVtcHRlZEF1dG9BY3Rpb24iLCJsb2FkTWFya2V0cGxhY2VzIiwiY29uZmlnIiwiZW5hYmxlZCIsImRpc2FibGVkIiwiYWxsUGx1Z2lucyIsIm1hcmtldHBsYWNlcyIsImZhaWx1cmVzIiwic3RhdGVzIiwiZW50cnkiLCJkYXRhIiwibWFya2V0cGxhY2UiLCJpbnN0YWxsZWRGcm9tTWFya2V0cGxhY2UiLCJmaWx0ZXIiLCJwbHVnaW4iLCJlbmRzV2l0aCIsInB1c2giLCJwbHVnaW5zIiwibGVuZ3RoIiwic29ydCIsImEiLCJiIiwibG9jYWxlQ29tcGFyZSIsInN1Y2Nlc3NDb3VudCIsIm0iLCJlcnJvclJlc3VsdCIsInR5cGUiLCJtZXNzYWdlIiwiRXJyb3IiLCJjdXJyZW50IiwidGFyZ2V0SW5kZXgiLCJmaW5kSW5kZXgiLCJzIiwidGFyZ2V0U3RhdGUiLCJuZXdTdGF0ZXMiLCJzZXRUaW1lb3V0IiwiYXBwbHlDaGFuZ2VzIiwiZXJyIiwiaGFzUGVuZGluZ0NoYW5nZXMiLCJzb21lIiwiZ2V0UGVuZGluZ0NvdW50cyIsInVwZGF0ZUNvdW50IiwicmVtb3ZlQ291bnQiLCJzdGF0ZXNUb1Byb2Nlc3MiLCJ3YXNJbkRldGFpbHNWaWV3Iiwic2V0dGluZ3MiLCJ1cGRhdGVkQ291bnQiLCJyZW1vdmVkQ291bnQiLCJyZWZyZXNoZWRNYXJrZXRwbGFjZXMiLCJTZXQiLCJuZXdFbmFibGVkUGx1Z2lucyIsImVuYWJsZWRQbHVnaW5zIiwicGx1Z2luSWQiLCJtYXJrZXRwbGFjZV9uYW1lIiwicGx1Z2luc191bmluc3RhbGxlZCIsImFkZCIsInRvTG93ZXJDYXNlIiwidXBkYXRlZFBsdWdpbkNvdW50Iiwic2l6ZSIsInVwZGF0ZWRQbHVnaW5JZHMiLCJ1cGRhdGVkTWFya2V0cGxhY2UiLCJmaW5kIiwiYWN0aW9ucyIsInBsdWdpblBhcnQiLCJzdWNjZXNzTXNnIiwidGljayIsImpvaW4iLCJjb25zdCIsImVycm9yTXNnIiwiY29uZmlybVJlbW92ZSIsIm1hcCIsImJ1aWxkRGV0YWlsc01lbnVPcHRpb25zIiwiQXJyYXkiLCJsYWJlbCIsInNlY29uZGFyeUxhYmVsIiwidmFsdWUiLCJvcHRpb25zIiwiRGF0ZSIsInRvTG9jYWxlRGF0ZVN0cmluZyIsInVuZGVmaW5lZCIsImhhbmRsZVRvZ2dsZUF1dG9VcGRhdGUiLCJuZXdBdXRvVXBkYXRlIiwicHJldiIsImNvbnRleHQiLCJpc0FjdGl2ZSIsInNlbGVjdDpwcmV2aW91cyIsIk1hdGgiLCJtYXgiLCJzZWxlY3Q6bmV4dCIsInRvdGFsSXRlbXMiLCJtaW4iLCJzZWxlY3Q6YWNjZXB0IiwibWFya2V0cGxhY2VJbmRleCIsImlucHV0IiwiaWR4IiwibWVudU9wdGlvbnMiLCJzZWxlY3RlZE9wdGlvbiIsInBvaW50ZXIiLCJpc1VwZGF0aW5nIiwiYnVsbGV0IiwibWFuaWZlc3QiLCJkZXNjcmlwdGlvbiIsIm9wdGlvbiIsImlzU2VsZWN0ZWQiLCJpbmRpY2F0b3JzIiwiY3Jvc3MiLCJNYW5hZ2VNYXJrZXRwbGFjZXNLZXlIaW50c1Byb3BzIiwiaGFzUGVuZGluZ0FjdGlvbnMiLCJNYW5hZ2VNYXJrZXRwbGFjZXNLZXlIaW50cyIsInQwIiwiJCIsIl9jIiwidDEiLCJ0MiIsInQzIiwidDQiLCJ0NSIsInQ2IiwidDciXSwic291cmNlcyI6WyJNYW5hZ2VNYXJrZXRwbGFjZXMudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmaWd1cmVzIGZyb20gJ2ZpZ3VyZXMnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnc3JjL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB7IENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50LmpzJ1xuaW1wb3J0IHsgQnlsaW5lIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9kZXNpZ24tc3lzdGVtL0J5bGluZS5qcydcbmltcG9ydCB7IEtleWJvYXJkU2hvcnRjdXRIaW50IH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9kZXNpZ24tc3lzdGVtL0tleWJvYXJkU2hvcnRjdXRIaW50LmpzJ1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9wcmVmZXItdXNlLWtleWJpbmRpbmdzIC0tIHVzZUlucHV0IG5lZWRlZCBmb3IgbWFya2V0cGxhY2Utc3BlY2lmaWMgdS9yIHNob3J0Y3V0cyBhbmQgeS9uIGNvbmZpcm1hdGlvbiBub3QgaW4ga2V5YmluZGluZyBzY2hlbWFcbmltcG9ydCB7IEJveCwgVGV4dCwgdXNlSW5wdXQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5pbXBvcnQge1xuICB1c2VLZXliaW5kaW5nLFxuICB1c2VLZXliaW5kaW5ncyxcbn0gZnJvbSAnLi4vLi4va2V5YmluZGluZ3MvdXNlS2V5YmluZGluZy5qcydcbmltcG9ydCB0eXBlIHsgTG9hZGVkUGx1Z2luIH0gZnJvbSAnLi4vLi4vdHlwZXMvcGx1Z2luLmpzJ1xuaW1wb3J0IHsgY291bnQgfSBmcm9tICcuLi8uLi91dGlscy9hcnJheS5qcydcbmltcG9ydCB7IHNob3VsZFNraXBQbHVnaW5BdXRvdXBkYXRlIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29uZmlnLmpzJ1xuaW1wb3J0IHsgZXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3JzLmpzJ1xuaW1wb3J0IHsgY2xlYXJBbGxDYWNoZXMgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL2NhY2hlVXRpbHMuanMnXG5pbXBvcnQge1xuICBjcmVhdGVQbHVnaW5JZCxcbiAgZm9ybWF0TWFya2V0cGxhY2VMb2FkaW5nRXJyb3JzLFxuICBnZXRNYXJrZXRwbGFjZVNvdXJjZURpc3BsYXksXG4gIGxvYWRNYXJrZXRwbGFjZXNXaXRoR3JhY2VmdWxEZWdyYWRhdGlvbixcbn0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9tYXJrZXRwbGFjZUhlbHBlcnMuanMnXG5pbXBvcnQge1xuICBsb2FkS25vd25NYXJrZXRwbGFjZXNDb25maWcsXG4gIHJlZnJlc2hNYXJrZXRwbGFjZSxcbiAgcmVtb3ZlTWFya2V0cGxhY2VTb3VyY2UsXG4gIHNldE1hcmtldHBsYWNlQXV0b1VwZGF0ZSxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9tYXJrZXRwbGFjZU1hbmFnZXIuanMnXG5pbXBvcnQgeyB1cGRhdGVQbHVnaW5zRm9yTWFya2V0cGxhY2VzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9wbHVnaW5BdXRvdXBkYXRlLmpzJ1xuaW1wb3J0IHsgbG9hZEFsbFBsdWdpbnMgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL3BsdWdpbkxvYWRlci5qcydcbmltcG9ydCB7IGlzTWFya2V0cGxhY2VBdXRvVXBkYXRlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9zY2hlbWFzLmpzJ1xuaW1wb3J0IHtcbiAgZ2V0U2V0dGluZ3NGb3JTb3VyY2UsXG4gIHVwZGF0ZVNldHRpbmdzRm9yU291cmNlLFxufSBmcm9tICcuLi8uLi91dGlscy9zZXR0aW5ncy9zZXR0aW5ncy5qcydcbmltcG9ydCB7IHBsdXJhbCB9IGZyb20gJy4uLy4uL3V0aWxzL3N0cmluZ1V0aWxzLmpzJ1xuaW1wb3J0IHR5cGUgeyBWaWV3U3RhdGUgfSBmcm9tICcuL3R5cGVzLmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICBzZXRWaWV3U3RhdGU6IChzdGF0ZTogVmlld1N0YXRlKSA9PiB2b2lkXG4gIGVycm9yPzogc3RyaW5nIHwgbnVsbFxuICBzZXRFcnJvcj86IChlcnJvcjogc3RyaW5nIHwgbnVsbCkgPT4gdm9pZFxuICBzZXRSZXN1bHQ6IChyZXN1bHQ6IHN0cmluZyB8IG51bGwpID0+IHZvaWRcbiAgZXhpdFN0YXRlOiB7XG4gICAgcGVuZGluZzogYm9vbGVhblxuICAgIGtleU5hbWU6ICdDdHJsLUMnIHwgJ0N0cmwtRCcgfCBudWxsXG4gIH1cbiAgb25NYW5hZ2VDb21wbGV0ZT86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+XG4gIHRhcmdldE1hcmtldHBsYWNlPzogc3RyaW5nXG4gIGFjdGlvbj86ICd1cGRhdGUnIHwgJ3JlbW92ZSdcbn1cblxudHlwZSBNYXJrZXRwbGFjZVN0YXRlID0ge1xuICBuYW1lOiBzdHJpbmdcbiAgc291cmNlOiBzdHJpbmdcbiAgbGFzdFVwZGF0ZWQ/OiBzdHJpbmdcbiAgcGx1Z2luQ291bnQ/OiBudW1iZXJcbiAgaW5zdGFsbGVkUGx1Z2lucz86IExvYWRlZFBsdWdpbltdXG4gIHBlbmRpbmdVcGRhdGU/OiBib29sZWFuXG4gIHBlbmRpbmdSZW1vdmU/OiBib29sZWFuXG4gIGF1dG9VcGRhdGU/OiBib29sZWFuXG59XG5cbnR5cGUgSW50ZXJuYWxWaWV3U3RhdGUgPSAnbGlzdCcgfCAnZGV0YWlscycgfCAnY29uZmlybS1yZW1vdmUnXG5cbmV4cG9ydCBmdW5jdGlvbiBNYW5hZ2VNYXJrZXRwbGFjZXMoe1xuICBzZXRWaWV3U3RhdGUsXG4gIGVycm9yLFxuICBzZXRFcnJvcixcbiAgc2V0UmVzdWx0LFxuICBleGl0U3RhdGUsXG4gIG9uTWFuYWdlQ29tcGxldGUsXG4gIHRhcmdldE1hcmtldHBsYWNlLFxuICBhY3Rpb24sXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFttYXJrZXRwbGFjZVN0YXRlcywgc2V0TWFya2V0cGxhY2VTdGF0ZXNdID0gdXNlU3RhdGU8XG4gICAgTWFya2V0cGxhY2VTdGF0ZVtdXG4gID4oW10pXG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpXG4gIGNvbnN0IFtzZWxlY3RlZEluZGV4LCBzZXRTZWxlY3RlZEluZGV4XSA9IHVzZVN0YXRlKDApXG4gIGNvbnN0IFtpc1Byb2Nlc3NpbmcsIHNldElzUHJvY2Vzc2luZ10gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW3Byb2Nlc3NFcnJvciwgc2V0UHJvY2Vzc0Vycm9yXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtzdWNjZXNzTWVzc2FnZSwgc2V0U3VjY2Vzc01lc3NhZ2VdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW3Byb2dyZXNzTWVzc2FnZSwgc2V0UHJvZ3Jlc3NNZXNzYWdlXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtpbnRlcm5hbFZpZXcsIHNldEludGVybmFsVmlld10gPSB1c2VTdGF0ZTxJbnRlcm5hbFZpZXdTdGF0ZT4oJ2xpc3QnKVxuICBjb25zdCBbc2VsZWN0ZWRNYXJrZXRwbGFjZSwgc2V0U2VsZWN0ZWRNYXJrZXRwbGFjZV0gPVxuICAgIHVzZVN0YXRlPE1hcmtldHBsYWNlU3RhdGUgfCBudWxsPihudWxsKVxuICBjb25zdCBbZGV0YWlsc01lbnVJbmRleCwgc2V0RGV0YWlsc01lbnVJbmRleF0gPSB1c2VTdGF0ZSgwKVxuICBjb25zdCBoYXNBdHRlbXB0ZWRBdXRvQWN0aW9uID0gdXNlUmVmKGZhbHNlKVxuXG4gIC8vIExvYWQgbWFya2V0cGxhY2VzIGFuZCB0aGVpciBpbnN0YWxsZWQgcGx1Z2luc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGFzeW5jIGZ1bmN0aW9uIGxvYWRNYXJrZXRwbGFjZXMoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjb25maWcgPSBhd2FpdCBsb2FkS25vd25NYXJrZXRwbGFjZXNDb25maWcoKVxuICAgICAgICBjb25zdCB7IGVuYWJsZWQsIGRpc2FibGVkIH0gPSBhd2FpdCBsb2FkQWxsUGx1Z2lucygpXG4gICAgICAgIGNvbnN0IGFsbFBsdWdpbnMgPSBbLi4uZW5hYmxlZCwgLi4uZGlzYWJsZWRdXG5cbiAgICAgICAgLy8gTG9hZCBtYXJrZXRwbGFjZXMgd2l0aCBncmFjZWZ1bCBkZWdyYWRhdGlvblxuICAgICAgICBjb25zdCB7IG1hcmtldHBsYWNlcywgZmFpbHVyZXMgfSA9XG4gICAgICAgICAgYXdhaXQgbG9hZE1hcmtldHBsYWNlc1dpdGhHcmFjZWZ1bERlZ3JhZGF0aW9uKGNvbmZpZylcblxuICAgICAgICBjb25zdCBzdGF0ZXM6IE1hcmtldHBsYWNlU3RhdGVbXSA9IFtdXG4gICAgICAgIGZvciAoY29uc3QgeyBuYW1lLCBjb25maWc6IGVudHJ5LCBkYXRhOiBtYXJrZXRwbGFjZSB9IG9mIG1hcmtldHBsYWNlcykge1xuICAgICAgICAgIC8vIEdldCBhbGwgcGx1Z2lucyBpbnN0YWxsZWQgZnJvbSB0aGlzIG1hcmtldHBsYWNlXG4gICAgICAgICAgY29uc3QgaW5zdGFsbGVkRnJvbU1hcmtldHBsYWNlID0gYWxsUGx1Z2lucy5maWx0ZXIocGx1Z2luID0+XG4gICAgICAgICAgICBwbHVnaW4uc291cmNlLmVuZHNXaXRoKGBAJHtuYW1lfWApLFxuICAgICAgICAgIClcblxuICAgICAgICAgIHN0YXRlcy5wdXNoKHtcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICBzb3VyY2U6IGdldE1hcmtldHBsYWNlU291cmNlRGlzcGxheShlbnRyeS5zb3VyY2UpLFxuICAgICAgICAgICAgbGFzdFVwZGF0ZWQ6IGVudHJ5Lmxhc3RVcGRhdGVkLFxuICAgICAgICAgICAgcGx1Z2luQ291bnQ6IG1hcmtldHBsYWNlPy5wbHVnaW5zLmxlbmd0aCxcbiAgICAgICAgICAgIGluc3RhbGxlZFBsdWdpbnM6IGluc3RhbGxlZEZyb21NYXJrZXRwbGFjZSxcbiAgICAgICAgICAgIHBlbmRpbmdVcGRhdGU6IGZhbHNlLFxuICAgICAgICAgICAgcGVuZGluZ1JlbW92ZTogZmFsc2UsXG4gICAgICAgICAgICBhdXRvVXBkYXRlOiBpc01hcmtldHBsYWNlQXV0b1VwZGF0ZShuYW1lLCBlbnRyeSksXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNvcnQ6IGNsYXVkZS1wbHVnaW4tZGlyZWN0b3J5IGZpcnN0LCB0aGVuIGFscGhhYmV0aWNhbGx5XG4gICAgICAgIHN0YXRlcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgaWYgKGEubmFtZSA9PT0gJ2NsYXVkZS1wbHVnaW4tZGlyZWN0b3J5JykgcmV0dXJuIC0xXG4gICAgICAgICAgaWYgKGIubmFtZSA9PT0gJ2NsYXVkZS1wbHVnaW4tZGlyZWN0b3J5JykgcmV0dXJuIDFcbiAgICAgICAgICByZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKVxuICAgICAgICB9KVxuICAgICAgICBzZXRNYXJrZXRwbGFjZVN0YXRlcyhzdGF0ZXMpXG5cbiAgICAgICAgLy8gSGFuZGxlIG1hcmtldHBsYWNlIGxvYWRpbmcgZXJyb3JzL3dhcm5pbmdzXG4gICAgICAgIGNvbnN0IHN1Y2Nlc3NDb3VudCA9IGNvdW50KG1hcmtldHBsYWNlcywgbSA9PiBtLmRhdGEgIT09IG51bGwpXG4gICAgICAgIGNvbnN0IGVycm9yUmVzdWx0ID0gZm9ybWF0TWFya2V0cGxhY2VMb2FkaW5nRXJyb3JzKFxuICAgICAgICAgIGZhaWx1cmVzLFxuICAgICAgICAgIHN1Y2Nlc3NDb3VudCxcbiAgICAgICAgKVxuICAgICAgICBpZiAoZXJyb3JSZXN1bHQpIHtcbiAgICAgICAgICBpZiAoZXJyb3JSZXN1bHQudHlwZSA9PT0gJ3dhcm5pbmcnKSB7XG4gICAgICAgICAgICBzZXRQcm9jZXNzRXJyb3IoZXJyb3JSZXN1bHQubWVzc2FnZSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yUmVzdWx0Lm1lc3NhZ2UpXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXV0by1leGVjdXRlIGlmIHRhcmdldCBhbmQgYWN0aW9uIHByb3ZpZGVkXG4gICAgICAgIGlmICh0YXJnZXRNYXJrZXRwbGFjZSAmJiAhaGFzQXR0ZW1wdGVkQXV0b0FjdGlvbi5jdXJyZW50ICYmICFlcnJvcikge1xuICAgICAgICAgIGhhc0F0dGVtcHRlZEF1dG9BY3Rpb24uY3VycmVudCA9IHRydWVcbiAgICAgICAgICBjb25zdCB0YXJnZXRJbmRleCA9IHN0YXRlcy5maW5kSW5kZXgoXG4gICAgICAgICAgICBzID0+IHMubmFtZSA9PT0gdGFyZ2V0TWFya2V0cGxhY2UsXG4gICAgICAgICAgKVxuICAgICAgICAgIGlmICh0YXJnZXRJbmRleCA+PSAwKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRTdGF0ZSA9IHN0YXRlc1t0YXJnZXRJbmRleF1cbiAgICAgICAgICAgIGlmIChhY3Rpb24pIHtcbiAgICAgICAgICAgICAgLy8gTWFyayB0aGUgYWN0aW9uIGFzIHBlbmRpbmcgYW5kIGV4ZWN1dGVcbiAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRJbmRleCh0YXJnZXRJbmRleCArIDEpIC8vICsxIGJlY2F1c2UgXCJBZGQgTWFya2V0cGxhY2VcIiBpcyBhdCBpbmRleCAwXG4gICAgICAgICAgICAgIGNvbnN0IG5ld1N0YXRlcyA9IFsuLi5zdGF0ZXNdXG4gICAgICAgICAgICAgIGlmIChhY3Rpb24gPT09ICd1cGRhdGUnKSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhdGVzW3RhcmdldEluZGV4XSEucGVuZGluZ1VwZGF0ZSA9IHRydWVcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhY3Rpb24gPT09ICdyZW1vdmUnKSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhdGVzW3RhcmdldEluZGV4XSEucGVuZGluZ1JlbW92ZSA9IHRydWVcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBzZXRNYXJrZXRwbGFjZVN0YXRlcyhuZXdTdGF0ZXMpXG4gICAgICAgICAgICAgIC8vIEFwcGx5IHRoZSBjaGFuZ2UgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgc2V0VGltZW91dChhcHBseUNoYW5nZXMsIDEwMCwgbmV3U3RhdGVzKVxuICAgICAgICAgICAgfSBlbHNlIGlmICh0YXJnZXRTdGF0ZSkge1xuICAgICAgICAgICAgICAvLyBObyBhY3Rpb24gLSBqdXN0IHNob3cgdGhlIGRldGFpbHMgdmlldyBmb3IgdGhpcyBtYXJrZXRwbGFjZVxuICAgICAgICAgICAgICBzZXRTZWxlY3RlZEluZGV4KHRhcmdldEluZGV4ICsgMSkgLy8gKzEgYmVjYXVzZSBcIkFkZCBNYXJrZXRwbGFjZVwiIGlzIGF0IGluZGV4IDBcbiAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRNYXJrZXRwbGFjZSh0YXJnZXRTdGF0ZSlcbiAgICAgICAgICAgICAgc2V0SW50ZXJuYWxWaWV3KCdkZXRhaWxzJylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHNldEVycm9yKSB7XG4gICAgICAgICAgICBzZXRFcnJvcihgTWFya2V0cGxhY2Ugbm90IGZvdW5kOiAke3RhcmdldE1hcmtldHBsYWNlfWApXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKHNldEVycm9yKSB7XG4gICAgICAgICAgc2V0RXJyb3IoXG4gICAgICAgICAgICBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogJ0ZhaWxlZCB0byBsb2FkIG1hcmtldHBsYWNlcycsXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICAgIHNldFByb2Nlc3NFcnJvcihcbiAgICAgICAgICBlcnIgaW5zdGFuY2VvZiBFcnJvciA/IGVyci5tZXNzYWdlIDogJ0ZhaWxlZCB0byBsb2FkIG1hcmtldHBsYWNlcycsXG4gICAgICAgIClcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNldExvYWRpbmcoZmFsc2UpXG4gICAgICB9XG4gICAgfVxuICAgIHZvaWQgbG9hZE1hcmtldHBsYWNlcygpXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIHJlYWN0LWhvb2tzL2V4aGF1c3RpdmUtZGVwc1xuICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L2NvcnJlY3RuZXNzL3VzZUV4aGF1c3RpdmVEZXBlbmRlbmNpZXM6IGludGVudGlvbmFsXG4gIH0sIFt0YXJnZXRNYXJrZXRwbGFjZSwgYWN0aW9uLCBlcnJvcl0pXG5cbiAgLy8gQ2hlY2sgaWYgdGhlcmUgYXJlIGFueSBwZW5kaW5nIGNoYW5nZXNcbiAgY29uc3QgaGFzUGVuZGluZ0NoYW5nZXMgPSAoKSA9PiB7XG4gICAgcmV0dXJuIG1hcmtldHBsYWNlU3RhdGVzLnNvbWUoXG4gICAgICBzdGF0ZSA9PiBzdGF0ZS5wZW5kaW5nVXBkYXRlIHx8IHN0YXRlLnBlbmRpbmdSZW1vdmUsXG4gICAgKVxuICB9XG5cbiAgLy8gR2V0IGNvdW50IG9mIHBlbmRpbmcgb3BlcmF0aW9uc1xuICBjb25zdCBnZXRQZW5kaW5nQ291bnRzID0gKCkgPT4ge1xuICAgIGNvbnN0IHVwZGF0ZUNvdW50ID0gY291bnQobWFya2V0cGxhY2VTdGF0ZXMsIHMgPT4gcy5wZW5kaW5nVXBkYXRlKVxuICAgIGNvbnN0IHJlbW92ZUNvdW50ID0gY291bnQobWFya2V0cGxhY2VTdGF0ZXMsIHMgPT4gcy5wZW5kaW5nUmVtb3ZlKVxuICAgIHJldHVybiB7IHVwZGF0ZUNvdW50LCByZW1vdmVDb3VudCB9XG4gIH1cblxuICAvLyBBcHBseSBhbGwgcGVuZGluZyBjaGFuZ2VzXG4gIGNvbnN0IGFwcGx5Q2hhbmdlcyA9IGFzeW5jIChzdGF0ZXM/OiBNYXJrZXRwbGFjZVN0YXRlW10pID0+IHtcbiAgICBjb25zdCBzdGF0ZXNUb1Byb2Nlc3MgPSBzdGF0ZXMgfHwgbWFya2V0cGxhY2VTdGF0ZXNcbiAgICBjb25zdCB3YXNJbkRldGFpbHNWaWV3ID0gaW50ZXJuYWxWaWV3ID09PSAnZGV0YWlscydcbiAgICBzZXRJc1Byb2Nlc3NpbmcodHJ1ZSlcbiAgICBzZXRQcm9jZXNzRXJyb3IobnVsbClcbiAgICBzZXRTdWNjZXNzTWVzc2FnZShudWxsKVxuICAgIHNldFByb2dyZXNzTWVzc2FnZShudWxsKVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHNldHRpbmdzID0gZ2V0U2V0dGluZ3NGb3JTb3VyY2UoJ3VzZXJTZXR0aW5ncycpXG4gICAgICBsZXQgdXBkYXRlZENvdW50ID0gMFxuICAgICAgbGV0IHJlbW92ZWRDb3VudCA9IDBcbiAgICAgIGNvbnN0IHJlZnJlc2hlZE1hcmtldHBsYWNlcyA9IG5ldyBTZXQ8c3RyaW5nPigpXG5cbiAgICAgIGZvciAoY29uc3Qgc3RhdGUgb2Ygc3RhdGVzVG9Qcm9jZXNzKSB7XG4gICAgICAgIC8vIEhhbmRsZSByZW1vdmVcbiAgICAgICAgaWYgKHN0YXRlLnBlbmRpbmdSZW1vdmUpIHtcbiAgICAgICAgICAvLyBGaXJzdCB1bmluc3RhbGwgYWxsIHBsdWdpbnMgZnJvbSB0aGlzIG1hcmtldHBsYWNlXG4gICAgICAgICAgaWYgKHN0YXRlLmluc3RhbGxlZFBsdWdpbnMgJiYgc3RhdGUuaW5zdGFsbGVkUGx1Z2lucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdFbmFibGVkUGx1Z2lucyA9IHsgLi4uc2V0dGluZ3M/LmVuYWJsZWRQbHVnaW5zIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgcGx1Z2luIG9mIHN0YXRlLmluc3RhbGxlZFBsdWdpbnMpIHtcbiAgICAgICAgICAgICAgY29uc3QgcGx1Z2luSWQgPSBjcmVhdGVQbHVnaW5JZChwbHVnaW4ubmFtZSwgc3RhdGUubmFtZSlcbiAgICAgICAgICAgICAgLy8gTWFyayBhcyBkaXNhYmxlZC91bmluc3RhbGxlZFxuICAgICAgICAgICAgICBuZXdFbmFibGVkUGx1Z2luc1twbHVnaW5JZF0gPSBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2UoJ3VzZXJTZXR0aW5ncycsIHtcbiAgICAgICAgICAgICAgZW5hYmxlZFBsdWdpbnM6IG5ld0VuYWJsZWRQbHVnaW5zLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGVuIHJlbW92ZSB0aGUgbWFya2V0cGxhY2VcbiAgICAgICAgICBhd2FpdCByZW1vdmVNYXJrZXRwbGFjZVNvdXJjZShzdGF0ZS5uYW1lKVxuICAgICAgICAgIHJlbW92ZWRDb3VudCsrXG5cbiAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfbWFya2V0cGxhY2VfcmVtb3ZlZCcsIHtcbiAgICAgICAgICAgIG1hcmtldHBsYWNlX25hbWU6XG4gICAgICAgICAgICAgIHN0YXRlLm5hbWUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgIHBsdWdpbnNfdW5pbnN0YWxsZWQ6IHN0YXRlLmluc3RhbGxlZFBsdWdpbnM/Lmxlbmd0aCB8fCAwLFxuICAgICAgICAgIH0pXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEhhbmRsZSB1cGRhdGVcbiAgICAgICAgaWYgKHN0YXRlLnBlbmRpbmdVcGRhdGUpIHtcbiAgICAgICAgICAvLyBSZWZyZXNoIGluZGl2aWR1YWwgbWFya2V0cGxhY2UgZm9yIGVmZmljaWVuY3kgd2l0aCBwcm9ncmVzcyByZXBvcnRpbmdcbiAgICAgICAgICBhd2FpdCByZWZyZXNoTWFya2V0cGxhY2Uoc3RhdGUubmFtZSwgKG1lc3NhZ2U6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgc2V0UHJvZ3Jlc3NNZXNzYWdlKG1lc3NhZ2UpXG4gICAgICAgICAgfSlcbiAgICAgICAgICB1cGRhdGVkQ291bnQrK1xuICAgICAgICAgIHJlZnJlc2hlZE1hcmtldHBsYWNlcy5hZGQoc3RhdGUubmFtZS50b0xvd2VyQ2FzZSgpKVxuXG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X21hcmtldHBsYWNlX3VwZGF0ZWQnLCB7XG4gICAgICAgICAgICBtYXJrZXRwbGFjZV9uYW1lOlxuICAgICAgICAgICAgICBzdGF0ZS5uYW1lIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBZnRlciBtYXJrZXRwbGFjZSBjbG9uZXMgYXJlIHJlZnJlc2hlZCwgYnVtcCBpbnN0YWxsZWQgcGx1Z2lucyBmcm9tXG4gICAgICAvLyB0aG9zZSBtYXJrZXRwbGFjZXMgdG8gdGhlIG5ldyB2ZXJzaW9uLiBXaXRob3V0IHRoaXMsIHRoZSBsb2FkZXInc1xuICAgICAgLy8gY2FjaGUtb24tbWlzcyAoY29weVBsdWdpblRvVmVyc2lvbmVkQ2FjaGUpIGNyZWF0ZXMgdGhlIG5ldyB2ZXJzaW9uXG4gICAgICAvLyBkaXIgb24gdGhlIG5leHQgbG9hZEFsbFBsdWdpbnMoKSBjYWxsLCBidXQgaW5zdGFsbGVkX3BsdWdpbnMuanNvblxuICAgICAgLy8gc3RheXMgb24gdGhlIG9sZCB2ZXJzaW9uIOKAlCBzbyBjbGVhbnVwT3JwaGFuZWRQbHVnaW5WZXJzaW9uc0luQmFja2dyb3VuZFxuICAgICAgLy8gc3RhbXBzIHRoZSBORVcgZGlyIHdpdGggLm9ycGhhbmVkX2F0IG9uIHRoZSBuZXh0IHN0YXJ0dXAuIFNlZSAjMjk1MTIuXG4gICAgICAvLyB1cGRhdGVQbHVnaW5PcCAoY2FsbGVkIGluc2lkZSB0aGUgaGVscGVyKSBpcyB3aGF0IGFjdHVhbGx5IHdyaXRlc1xuICAgICAgLy8gaW5zdGFsbGVkX3BsdWdpbnMuanNvbiB2aWEgdXBkYXRlSW5zdGFsbGF0aW9uUGF0aE9uRGlzay5cbiAgICAgIGxldCB1cGRhdGVkUGx1Z2luQ291bnQgPSAwXG4gICAgICBpZiAocmVmcmVzaGVkTWFya2V0cGxhY2VzLnNpemUgPiAwKSB7XG4gICAgICAgIGNvbnN0IHVwZGF0ZWRQbHVnaW5JZHMgPSBhd2FpdCB1cGRhdGVQbHVnaW5zRm9yTWFya2V0cGxhY2VzKFxuICAgICAgICAgIHJlZnJlc2hlZE1hcmtldHBsYWNlcyxcbiAgICAgICAgKVxuICAgICAgICB1cGRhdGVkUGx1Z2luQ291bnQgPSB1cGRhdGVkUGx1Z2luSWRzLmxlbmd0aFxuICAgICAgfVxuXG4gICAgICAvLyBDbGVhciBjYWNoZXMgYWZ0ZXIgY2hhbmdlc1xuICAgICAgY2xlYXJBbGxDYWNoZXMoKVxuXG4gICAgICAvLyBDYWxsIGNvbXBsZXRpb24gY2FsbGJhY2tcbiAgICAgIGlmIChvbk1hbmFnZUNvbXBsZXRlKSB7XG4gICAgICAgIGF3YWl0IG9uTWFuYWdlQ29tcGxldGUoKVxuICAgICAgfVxuXG4gICAgICAvLyBSZWxvYWQgbWFya2V0cGxhY2UgZGF0YSB0byBzaG93IHVwZGF0ZWQgdGltZXN0YW1wc1xuICAgICAgY29uc3QgY29uZmlnID0gYXdhaXQgbG9hZEtub3duTWFya2V0cGxhY2VzQ29uZmlnKClcbiAgICAgIGNvbnN0IHsgZW5hYmxlZCwgZGlzYWJsZWQgfSA9IGF3YWl0IGxvYWRBbGxQbHVnaW5zKClcbiAgICAgIGNvbnN0IGFsbFBsdWdpbnMgPSBbLi4uZW5hYmxlZCwgLi4uZGlzYWJsZWRdXG5cbiAgICAgIGNvbnN0IHsgbWFya2V0cGxhY2VzIH0gPVxuICAgICAgICBhd2FpdCBsb2FkTWFya2V0cGxhY2VzV2l0aEdyYWNlZnVsRGVncmFkYXRpb24oY29uZmlnKVxuXG4gICAgICBjb25zdCBuZXdTdGF0ZXM6IE1hcmtldHBsYWNlU3RhdGVbXSA9IFtdXG4gICAgICBmb3IgKGNvbnN0IHsgbmFtZSwgY29uZmlnOiBlbnRyeSwgZGF0YTogbWFya2V0cGxhY2UgfSBvZiBtYXJrZXRwbGFjZXMpIHtcbiAgICAgICAgY29uc3QgaW5zdGFsbGVkRnJvbU1hcmtldHBsYWNlID0gYWxsUGx1Z2lucy5maWx0ZXIocGx1Z2luID0+XG4gICAgICAgICAgcGx1Z2luLnNvdXJjZS5lbmRzV2l0aChgQCR7bmFtZX1gKSxcbiAgICAgICAgKVxuXG4gICAgICAgIG5ld1N0YXRlcy5wdXNoKHtcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIHNvdXJjZTogZ2V0TWFya2V0cGxhY2VTb3VyY2VEaXNwbGF5KGVudHJ5LnNvdXJjZSksXG4gICAgICAgICAgbGFzdFVwZGF0ZWQ6IGVudHJ5Lmxhc3RVcGRhdGVkLFxuICAgICAgICAgIHBsdWdpbkNvdW50OiBtYXJrZXRwbGFjZT8ucGx1Z2lucy5sZW5ndGgsXG4gICAgICAgICAgaW5zdGFsbGVkUGx1Z2luczogaW5zdGFsbGVkRnJvbU1hcmtldHBsYWNlLFxuICAgICAgICAgIHBlbmRpbmdVcGRhdGU6IGZhbHNlLFxuICAgICAgICAgIHBlbmRpbmdSZW1vdmU6IGZhbHNlLFxuICAgICAgICAgIGF1dG9VcGRhdGU6IGlzTWFya2V0cGxhY2VBdXRvVXBkYXRlKG5hbWUsIGVudHJ5KSxcbiAgICAgICAgfSlcbiAgICAgIH1cblxuICAgICAgLy8gU29ydDogY2xhdWRlLXBsdWdpbi1kaXJlY3RvcnkgZmlyc3QsIHRoZW4gYWxwaGFiZXRpY2FsbHlcbiAgICAgIG5ld1N0YXRlcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGlmIChhLm5hbWUgPT09ICdjbGF1ZGUtcGx1Z2luLWRpcmVjdG9yeScpIHJldHVybiAtMVxuICAgICAgICBpZiAoYi5uYW1lID09PSAnY2xhdWRlLXBsdWdpbi1kaXJlY3RvcnknKSByZXR1cm4gMVxuICAgICAgICByZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKVxuICAgICAgfSlcbiAgICAgIHNldE1hcmtldHBsYWNlU3RhdGVzKG5ld1N0YXRlcylcblxuICAgICAgLy8gVXBkYXRlIHNlbGVjdGVkIG1hcmtldHBsYWNlIHJlZmVyZW5jZSB3aXRoIGZyZXNoIGRhdGFcbiAgICAgIGlmICh3YXNJbkRldGFpbHNWaWV3ICYmIHNlbGVjdGVkTWFya2V0cGxhY2UpIHtcbiAgICAgICAgY29uc3QgdXBkYXRlZE1hcmtldHBsYWNlID0gbmV3U3RhdGVzLmZpbmQoXG4gICAgICAgICAgcyA9PiBzLm5hbWUgPT09IHNlbGVjdGVkTWFya2V0cGxhY2UubmFtZSxcbiAgICAgICAgKVxuICAgICAgICBpZiAodXBkYXRlZE1hcmtldHBsYWNlKSB7XG4gICAgICAgICAgc2V0U2VsZWN0ZWRNYXJrZXRwbGFjZSh1cGRhdGVkTWFya2V0cGxhY2UpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQnVpbGQgc3VjY2VzcyBtZXNzYWdlXG4gICAgICBjb25zdCBhY3Rpb25zOiBzdHJpbmdbXSA9IFtdXG4gICAgICBpZiAodXBkYXRlZENvdW50ID4gMCkge1xuICAgICAgICBjb25zdCBwbHVnaW5QYXJ0ID1cbiAgICAgICAgICB1cGRhdGVkUGx1Z2luQ291bnQgPiAwXG4gICAgICAgICAgICA/IGAgKCR7dXBkYXRlZFBsdWdpbkNvdW50fSAke3BsdXJhbCh1cGRhdGVkUGx1Z2luQ291bnQsICdwbHVnaW4nKX0gYnVtcGVkKWBcbiAgICAgICAgICAgIDogJydcbiAgICAgICAgYWN0aW9ucy5wdXNoKFxuICAgICAgICAgIGBVcGRhdGVkICR7dXBkYXRlZENvdW50fSAke3BsdXJhbCh1cGRhdGVkQ291bnQsICdtYXJrZXRwbGFjZScpfSR7cGx1Z2luUGFydH1gLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICBpZiAocmVtb3ZlZENvdW50ID4gMCkge1xuICAgICAgICBhY3Rpb25zLnB1c2goXG4gICAgICAgICAgYFJlbW92ZWQgJHtyZW1vdmVkQ291bnR9ICR7cGx1cmFsKHJlbW92ZWRDb3VudCwgJ21hcmtldHBsYWNlJyl9YCxcbiAgICAgICAgKVxuICAgICAgfVxuXG4gICAgICBpZiAoYWN0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHN1Y2Nlc3NNc2cgPSBgJHtmaWd1cmVzLnRpY2t9ICR7YWN0aW9ucy5qb2luKCcsICcpfWBcbiAgICAgICAgLy8gSWYgd2Ugd2VyZSBpbiBkZXRhaWxzIHZpZXcsIHN0YXkgdGhlcmUgYW5kIHNob3cgc3VjY2Vzc1xuICAgICAgICBpZiAod2FzSW5EZXRhaWxzVmlldykge1xuICAgICAgICAgIHNldFN1Y2Nlc3NNZXNzYWdlKHN1Y2Nlc3NNc2cpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIHNob3cgcmVzdWx0IGFuZCBleGl0IHRvIG1lbnVcbiAgICAgICAgICBzZXRSZXN1bHQoc3VjY2Vzc01zZylcbiAgICAgICAgICBzZXRUaW1lb3V0KHNldFZpZXdTdGF0ZSwgMjAwMCwgeyB0eXBlOiAnbWVudScgYXMgY29uc3QgfSlcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghd2FzSW5EZXRhaWxzVmlldykge1xuICAgICAgICBzZXRWaWV3U3RhdGUoeyB0eXBlOiAnbWVudScgfSlcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3JNZXNzYWdlKGVycilcbiAgICAgIHNldFByb2Nlc3NFcnJvcihlcnJvck1zZylcbiAgICAgIGlmIChzZXRFcnJvcikge1xuICAgICAgICBzZXRFcnJvcihlcnJvck1zZylcbiAgICAgIH1cbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNQcm9jZXNzaW5nKGZhbHNlKVxuICAgICAgc2V0UHJvZ3Jlc3NNZXNzYWdlKG51bGwpXG4gICAgfVxuICB9XG5cbiAgLy8gSGFuZGxlIGNvbmZpcm1pbmcgbWFya2V0cGxhY2UgcmVtb3ZhbFxuICBjb25zdCBjb25maXJtUmVtb3ZlID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmICghc2VsZWN0ZWRNYXJrZXRwbGFjZSkgcmV0dXJuXG5cbiAgICAvLyBNYXJrIGZvciByZW1vdmFsIGFuZCBhcHBseVxuICAgIGNvbnN0IG5ld1N0YXRlcyA9IG1hcmtldHBsYWNlU3RhdGVzLm1hcChzdGF0ZSA9PlxuICAgICAgc3RhdGUubmFtZSA9PT0gc2VsZWN0ZWRNYXJrZXRwbGFjZS5uYW1lXG4gICAgICAgID8geyAuLi5zdGF0ZSwgcGVuZGluZ1JlbW92ZTogdHJ1ZSB9XG4gICAgICAgIDogc3RhdGUsXG4gICAgKVxuICAgIHNldE1hcmtldHBsYWNlU3RhdGVzKG5ld1N0YXRlcylcbiAgICBhd2FpdCBhcHBseUNoYW5nZXMobmV3U3RhdGVzKVxuICB9XG5cbiAgLy8gQnVpbGQgbWVudSBvcHRpb25zIGZvciBkZXRhaWxzIHZpZXdcbiAgY29uc3QgYnVpbGREZXRhaWxzTWVudU9wdGlvbnMgPSAoXG4gICAgbWFya2V0cGxhY2U6IE1hcmtldHBsYWNlU3RhdGUgfCBudWxsLFxuICApOiBBcnJheTx7IGxhYmVsOiBzdHJpbmc7IHNlY29uZGFyeUxhYmVsPzogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0+ID0+IHtcbiAgICBpZiAoIW1hcmtldHBsYWNlKSByZXR1cm4gW11cblxuICAgIGNvbnN0IG9wdGlvbnM6IEFycmF5PHtcbiAgICAgIGxhYmVsOiBzdHJpbmdcbiAgICAgIHNlY29uZGFyeUxhYmVsPzogc3RyaW5nXG4gICAgICB2YWx1ZTogc3RyaW5nXG4gICAgfT4gPSBbXG4gICAgICB7XG4gICAgICAgIGxhYmVsOiBgQnJvd3NlIHBsdWdpbnMgKCR7bWFya2V0cGxhY2UucGx1Z2luQ291bnQgPz8gMH0pYCxcbiAgICAgICAgdmFsdWU6ICdicm93c2UnLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbGFiZWw6ICdVcGRhdGUgbWFya2V0cGxhY2UnLFxuICAgICAgICBzZWNvbmRhcnlMYWJlbDogbWFya2V0cGxhY2UubGFzdFVwZGF0ZWRcbiAgICAgICAgICA/IGAobGFzdCB1cGRhdGVkICR7bmV3IERhdGUobWFya2V0cGxhY2UubGFzdFVwZGF0ZWQpLnRvTG9jYWxlRGF0ZVN0cmluZygpfSlgXG4gICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgIHZhbHVlOiAndXBkYXRlJyxcbiAgICAgIH0sXG4gICAgXVxuXG4gICAgLy8gT25seSBzaG93IGF1dG8tdXBkYXRlIHRvZ2dsZSBpZiBhdXRvLXVwZGF0ZXIgaXMgbm90IGdsb2JhbGx5IGRpc2FibGVkXG4gICAgaWYgKCFzaG91bGRTa2lwUGx1Z2luQXV0b3VwZGF0ZSgpKSB7XG4gICAgICBvcHRpb25zLnB1c2goe1xuICAgICAgICBsYWJlbDogbWFya2V0cGxhY2UuYXV0b1VwZGF0ZVxuICAgICAgICAgID8gJ0Rpc2FibGUgYXV0by11cGRhdGUnXG4gICAgICAgICAgOiAnRW5hYmxlIGF1dG8tdXBkYXRlJyxcbiAgICAgICAgdmFsdWU6ICd0b2dnbGUtYXV0by11cGRhdGUnLFxuICAgICAgfSlcbiAgICB9XG5cbiAgICBvcHRpb25zLnB1c2goeyBsYWJlbDogJ1JlbW92ZSBtYXJrZXRwbGFjZScsIHZhbHVlOiAncmVtb3ZlJyB9KVxuXG4gICAgcmV0dXJuIG9wdGlvbnNcbiAgfVxuXG4gIC8vIEhhbmRsZSB0b2dnbGluZyBhdXRvLXVwZGF0ZSBmb3IgYSBtYXJrZXRwbGFjZVxuICBjb25zdCBoYW5kbGVUb2dnbGVBdXRvVXBkYXRlID0gYXN5bmMgKG1hcmtldHBsYWNlOiBNYXJrZXRwbGFjZVN0YXRlKSA9PiB7XG4gICAgY29uc3QgbmV3QXV0b1VwZGF0ZSA9ICFtYXJrZXRwbGFjZS5hdXRvVXBkYXRlXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHNldE1hcmtldHBsYWNlQXV0b1VwZGF0ZShtYXJrZXRwbGFjZS5uYW1lLCBuZXdBdXRvVXBkYXRlKVxuXG4gICAgICAvLyBVcGRhdGUgbG9jYWwgc3RhdGVcbiAgICAgIHNldE1hcmtldHBsYWNlU3RhdGVzKHByZXYgPT5cbiAgICAgICAgcHJldi5tYXAoc3RhdGUgPT5cbiAgICAgICAgICBzdGF0ZS5uYW1lID09PSBtYXJrZXRwbGFjZS5uYW1lXG4gICAgICAgICAgICA/IHsgLi4uc3RhdGUsIGF1dG9VcGRhdGU6IG5ld0F1dG9VcGRhdGUgfVxuICAgICAgICAgICAgOiBzdGF0ZSxcbiAgICAgICAgKSxcbiAgICAgIClcblxuICAgICAgLy8gVXBkYXRlIHNlbGVjdGVkIG1hcmtldHBsYWNlIHJlZmVyZW5jZVxuICAgICAgc2V0U2VsZWN0ZWRNYXJrZXRwbGFjZShwcmV2ID0+XG4gICAgICAgIHByZXYgPyB7IC4uLnByZXYsIGF1dG9VcGRhdGU6IG5ld0F1dG9VcGRhdGUgfSA6IHByZXYsXG4gICAgICApXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBzZXRQcm9jZXNzRXJyb3IoXG4gICAgICAgIGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiAnRmFpbGVkIHRvIHVwZGF0ZSBzZXR0aW5nJyxcbiAgICAgIClcbiAgICB9XG4gIH1cblxuICAvLyBFc2NhcGUgaW4gZGV0YWlscyBvciBjb25maXJtLXJlbW92ZSB2aWV3IC0gZ28gYmFjayB0byBsaXN0XG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2NvbmZpcm06bm8nLFxuICAgICgpID0+IHtcbiAgICAgIHNldEludGVybmFsVmlldygnbGlzdCcpXG4gICAgICBzZXREZXRhaWxzTWVudUluZGV4KDApXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnQ29uZmlybWF0aW9uJyxcbiAgICAgIGlzQWN0aXZlOlxuICAgICAgICAhaXNQcm9jZXNzaW5nICYmXG4gICAgICAgIChpbnRlcm5hbFZpZXcgPT09ICdkZXRhaWxzJyB8fCBpbnRlcm5hbFZpZXcgPT09ICdjb25maXJtLXJlbW92ZScpLFxuICAgIH0sXG4gIClcblxuICAvLyBFc2NhcGUgaW4gbGlzdCB2aWV3IHdpdGggcGVuZGluZyBjaGFuZ2VzIC0gY2xlYXIgcGVuZGluZyBjaGFuZ2VzXG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2NvbmZpcm06bm8nLFxuICAgICgpID0+IHtcbiAgICAgIHNldE1hcmtldHBsYWNlU3RhdGVzKHByZXYgPT5cbiAgICAgICAgcHJldi5tYXAoc3RhdGUgPT4gKHtcbiAgICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgICBwZW5kaW5nVXBkYXRlOiBmYWxzZSxcbiAgICAgICAgICBwZW5kaW5nUmVtb3ZlOiBmYWxzZSxcbiAgICAgICAgfSkpLFxuICAgICAgKVxuICAgICAgc2V0U2VsZWN0ZWRJbmRleCgwKVxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgICBpc0FjdGl2ZTogIWlzUHJvY2Vzc2luZyAmJiBpbnRlcm5hbFZpZXcgPT09ICdsaXN0JyAmJiBoYXNQZW5kaW5nQ2hhbmdlcygpLFxuICAgIH0sXG4gIClcblxuICAvLyBFc2NhcGUgaW4gbGlzdCB2aWV3IHdpdGhvdXQgcGVuZGluZyBjaGFuZ2VzIC0gZXhpdCB0byBwYXJlbnQgbWVudVxuICB1c2VLZXliaW5kaW5nKFxuICAgICdjb25maXJtOm5vJyxcbiAgICAoKSA9PiB7XG4gICAgICBzZXRWaWV3U3RhdGUoeyB0eXBlOiAnbWVudScgfSlcbiAgICB9LFxuICAgIHtcbiAgICAgIGNvbnRleHQ6ICdDb25maXJtYXRpb24nLFxuICAgICAgaXNBY3RpdmU6XG4gICAgICAgICFpc1Byb2Nlc3NpbmcgJiYgaW50ZXJuYWxWaWV3ID09PSAnbGlzdCcgJiYgIWhhc1BlbmRpbmdDaGFuZ2VzKCksXG4gICAgfSxcbiAgKVxuXG4gIC8vIExpc3QgdmlldyDigJQgbmF2aWdhdGlvbiAodXAvZG93bi9lbnRlciB2aWEgY29uZmlndXJhYmxlIGtleWJpbmRpbmdzKVxuICB1c2VLZXliaW5kaW5ncyhcbiAgICB7XG4gICAgICAnc2VsZWN0OnByZXZpb3VzJzogKCkgPT4gc2V0U2VsZWN0ZWRJbmRleChwcmV2ID0+IE1hdGgubWF4KDAsIHByZXYgLSAxKSksXG4gICAgICAnc2VsZWN0Om5leHQnOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHRvdGFsSXRlbXMgPSBtYXJrZXRwbGFjZVN0YXRlcy5sZW5ndGggKyAxXG4gICAgICAgIHNldFNlbGVjdGVkSW5kZXgocHJldiA9PiBNYXRoLm1pbih0b3RhbEl0ZW1zIC0gMSwgcHJldiArIDEpKVxuICAgICAgfSxcbiAgICAgICdzZWxlY3Q6YWNjZXB0JzogKCkgPT4ge1xuICAgICAgICBjb25zdCBtYXJrZXRwbGFjZUluZGV4ID0gc2VsZWN0ZWRJbmRleCAtIDFcbiAgICAgICAgaWYgKHNlbGVjdGVkSW5kZXggPT09IDApIHtcbiAgICAgICAgICBzZXRWaWV3U3RhdGUoeyB0eXBlOiAnYWRkLW1hcmtldHBsYWNlJyB9KVxuICAgICAgICB9IGVsc2UgaWYgKGhhc1BlbmRpbmdDaGFuZ2VzKCkpIHtcbiAgICAgICAgICB2b2lkIGFwcGx5Q2hhbmdlcygpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgbWFya2V0cGxhY2UgPSBtYXJrZXRwbGFjZVN0YXRlc1ttYXJrZXRwbGFjZUluZGV4XVxuICAgICAgICAgIGlmIChtYXJrZXRwbGFjZSkge1xuICAgICAgICAgICAgc2V0U2VsZWN0ZWRNYXJrZXRwbGFjZShtYXJrZXRwbGFjZSlcbiAgICAgICAgICAgIHNldEludGVybmFsVmlldygnZGV0YWlscycpXG4gICAgICAgICAgICBzZXREZXRhaWxzTWVudUluZGV4KDApXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgIH0sXG4gICAgeyBjb250ZXh0OiAnU2VsZWN0JywgaXNBY3RpdmU6ICFpc1Byb2Nlc3NpbmcgJiYgaW50ZXJuYWxWaWV3ID09PSAnbGlzdCcgfSxcbiAgKVxuXG4gIC8vIExpc3QgdmlldyDigJQgbWFya2V0cGxhY2Utc3BlY2lmaWMgYWN0aW9ucyAodS9yIHNob3J0Y3V0cylcbiAgdXNlSW5wdXQoXG4gICAgaW5wdXQgPT4ge1xuICAgICAgY29uc3QgbWFya2V0cGxhY2VJbmRleCA9IHNlbGVjdGVkSW5kZXggLSAxXG4gICAgICBpZiAoKGlucHV0ID09PSAndScgfHwgaW5wdXQgPT09ICdVJykgJiYgbWFya2V0cGxhY2VJbmRleCA+PSAwKSB7XG4gICAgICAgIHNldE1hcmtldHBsYWNlU3RhdGVzKHByZXYgPT5cbiAgICAgICAgICBwcmV2Lm1hcCgoc3RhdGUsIGlkeCkgPT5cbiAgICAgICAgICAgIGlkeCA9PT0gbWFya2V0cGxhY2VJbmRleFxuICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgIC4uLnN0YXRlLFxuICAgICAgICAgICAgICAgICAgcGVuZGluZ1VwZGF0ZTogIXN0YXRlLnBlbmRpbmdVcGRhdGUsXG4gICAgICAgICAgICAgICAgICBwZW5kaW5nUmVtb3ZlOiBzdGF0ZS5wZW5kaW5nVXBkYXRlXG4gICAgICAgICAgICAgICAgICAgID8gc3RhdGUucGVuZGluZ1JlbW92ZVxuICAgICAgICAgICAgICAgICAgICA6IGZhbHNlLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgOiBzdGF0ZSxcbiAgICAgICAgICApLFxuICAgICAgICApXG4gICAgICB9IGVsc2UgaWYgKChpbnB1dCA9PT0gJ3InIHx8IGlucHV0ID09PSAnUicpICYmIG1hcmtldHBsYWNlSW5kZXggPj0gMCkge1xuICAgICAgICBjb25zdCBtYXJrZXRwbGFjZSA9IG1hcmtldHBsYWNlU3RhdGVzW21hcmtldHBsYWNlSW5kZXhdXG4gICAgICAgIGlmIChtYXJrZXRwbGFjZSkge1xuICAgICAgICAgIHNldFNlbGVjdGVkTWFya2V0cGxhY2UobWFya2V0cGxhY2UpXG4gICAgICAgICAgc2V0SW50ZXJuYWxWaWV3KCdjb25maXJtLXJlbW92ZScpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIHsgaXNBY3RpdmU6ICFpc1Byb2Nlc3NpbmcgJiYgaW50ZXJuYWxWaWV3ID09PSAnbGlzdCcgfSxcbiAgKVxuXG4gIC8vIERldGFpbHMgdmlldyDigJQgbmF2aWdhdGlvblxuICB1c2VLZXliaW5kaW5ncyhcbiAgICB7XG4gICAgICAnc2VsZWN0OnByZXZpb3VzJzogKCkgPT5cbiAgICAgICAgc2V0RGV0YWlsc01lbnVJbmRleChwcmV2ID0+IE1hdGgubWF4KDAsIHByZXYgLSAxKSksXG4gICAgICAnc2VsZWN0Om5leHQnOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG1lbnVPcHRpb25zID0gYnVpbGREZXRhaWxzTWVudU9wdGlvbnMoc2VsZWN0ZWRNYXJrZXRwbGFjZSlcbiAgICAgICAgc2V0RGV0YWlsc01lbnVJbmRleChwcmV2ID0+IE1hdGgubWluKG1lbnVPcHRpb25zLmxlbmd0aCAtIDEsIHByZXYgKyAxKSlcbiAgICAgIH0sXG4gICAgICAnc2VsZWN0OmFjY2VwdCc6ICgpID0+IHtcbiAgICAgICAgaWYgKCFzZWxlY3RlZE1hcmtldHBsYWNlKSByZXR1cm5cbiAgICAgICAgY29uc3QgbWVudU9wdGlvbnMgPSBidWlsZERldGFpbHNNZW51T3B0aW9ucyhzZWxlY3RlZE1hcmtldHBsYWNlKVxuICAgICAgICBjb25zdCBzZWxlY3RlZE9wdGlvbiA9IG1lbnVPcHRpb25zW2RldGFpbHNNZW51SW5kZXhdXG4gICAgICAgIGlmIChzZWxlY3RlZE9wdGlvbj8udmFsdWUgPT09ICdicm93c2UnKSB7XG4gICAgICAgICAgc2V0Vmlld1N0YXRlKHtcbiAgICAgICAgICAgIHR5cGU6ICdicm93c2UtbWFya2V0cGxhY2UnLFxuICAgICAgICAgICAgdGFyZ2V0TWFya2V0cGxhY2U6IHNlbGVjdGVkTWFya2V0cGxhY2UubmFtZSxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdGVkT3B0aW9uPy52YWx1ZSA9PT0gJ3VwZGF0ZScpIHtcbiAgICAgICAgICBjb25zdCBuZXdTdGF0ZXMgPSBtYXJrZXRwbGFjZVN0YXRlcy5tYXAoc3RhdGUgPT5cbiAgICAgICAgICAgIHN0YXRlLm5hbWUgPT09IHNlbGVjdGVkTWFya2V0cGxhY2UubmFtZVxuICAgICAgICAgICAgICA/IHsgLi4uc3RhdGUsIHBlbmRpbmdVcGRhdGU6IHRydWUgfVxuICAgICAgICAgICAgICA6IHN0YXRlLFxuICAgICAgICAgIClcbiAgICAgICAgICBzZXRNYXJrZXRwbGFjZVN0YXRlcyhuZXdTdGF0ZXMpXG4gICAgICAgICAgdm9pZCBhcHBseUNoYW5nZXMobmV3U3RhdGVzKVxuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdGVkT3B0aW9uPy52YWx1ZSA9PT0gJ3RvZ2dsZS1hdXRvLXVwZGF0ZScpIHtcbiAgICAgICAgICB2b2lkIGhhbmRsZVRvZ2dsZUF1dG9VcGRhdGUoc2VsZWN0ZWRNYXJrZXRwbGFjZSlcbiAgICAgICAgfSBlbHNlIGlmIChzZWxlY3RlZE9wdGlvbj8udmFsdWUgPT09ICdyZW1vdmUnKSB7XG4gICAgICAgICAgc2V0SW50ZXJuYWxWaWV3KCdjb25maXJtLXJlbW92ZScpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnU2VsZWN0JyxcbiAgICAgIGlzQWN0aXZlOiAhaXNQcm9jZXNzaW5nICYmIGludGVybmFsVmlldyA9PT0gJ2RldGFpbHMnLFxuICAgIH0sXG4gIClcblxuICAvLyBDb25maXJtLXJlbW92ZSB2aWV3IOKAlCB5L24gaW5wdXRcbiAgdXNlSW5wdXQoXG4gICAgaW5wdXQgPT4ge1xuICAgICAgaWYgKGlucHV0ID09PSAneScgfHwgaW5wdXQgPT09ICdZJykge1xuICAgICAgICB2b2lkIGNvbmZpcm1SZW1vdmUoKVxuICAgICAgfSBlbHNlIGlmIChpbnB1dCA9PT0gJ24nIHx8IGlucHV0ID09PSAnTicpIHtcbiAgICAgICAgc2V0SW50ZXJuYWxWaWV3KCdsaXN0JylcbiAgICAgICAgc2V0U2VsZWN0ZWRNYXJrZXRwbGFjZShudWxsKVxuICAgICAgfVxuICAgIH0sXG4gICAgeyBpc0FjdGl2ZTogIWlzUHJvY2Vzc2luZyAmJiBpbnRlcm5hbFZpZXcgPT09ICdjb25maXJtLXJlbW92ZScgfSxcbiAgKVxuXG4gIGlmIChsb2FkaW5nKSB7XG4gICAgcmV0dXJuIDxUZXh0PkxvYWRpbmcgbWFya2V0cGxhY2Vz4oCmPC9UZXh0PlxuICB9XG5cbiAgaWYgKG1hcmtldHBsYWNlU3RhdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgIDxUZXh0IGJvbGQ+TWFuYWdlIG1hcmtldHBsYWNlczwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgey8qIEFkZCBNYXJrZXRwbGFjZSBvcHRpb24gKi99XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cInJvd1wiIGdhcD17MX0+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+e2ZpZ3VyZXMucG9pbnRlcn0gKzwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBib2xkIGNvbG9yPVwic3VnZ2VzdGlvblwiPlxuICAgICAgICAgICAgQWRkIE1hcmtldHBsYWNlXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cblxuICAgICAgICA8Qm94IG1hcmdpbkxlZnQ9ezN9PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgIHtleGl0U3RhdGUucGVuZGluZyA/IChcbiAgICAgICAgICAgICAgPD5QcmVzcyB7ZXhpdFN0YXRlLmtleU5hbWV9IGFnYWluIHRvIGdvIGJhY2s8Lz5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgICAgYWN0aW9uPVwic2VsZWN0OmFjY2VwdFwiXG4gICAgICAgICAgICAgICAgICBjb250ZXh0PVwiU2VsZWN0XCJcbiAgICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRW50ZXJcIlxuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJzZWxlY3RcIlxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiZ28gYmFja1wiXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICAvLyBTaG93IGNvbmZpcm1hdGlvbiBkaWFsb2dcbiAgaWYgKGludGVybmFsVmlldyA9PT0gJ2NvbmZpcm0tcmVtb3ZlJyAmJiBzZWxlY3RlZE1hcmtldHBsYWNlKSB7XG4gICAgY29uc3QgcGx1Z2luQ291bnQgPSBzZWxlY3RlZE1hcmtldHBsYWNlLmluc3RhbGxlZFBsdWdpbnM/Lmxlbmd0aCB8fCAwXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8VGV4dCBib2xkIGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgIFJlbW92ZSBtYXJrZXRwbGFjZSA8VGV4dCBpdGFsaWM+e3NlbGVjdGVkTWFya2V0cGxhY2UubmFtZX08L1RleHQ+P1xuICAgICAgICA8L1RleHQ+XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIHtwbHVnaW5Db3VudCA+IDAgJiYgKFxuICAgICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5cbiAgICAgICAgICAgICAgICBUaGlzIHdpbGwgYWxzbyB1bmluc3RhbGwge3BsdWdpbkNvdW50fXsnICd9XG4gICAgICAgICAgICAgICAge3BsdXJhbChwbHVnaW5Db3VudCwgJ3BsdWdpbicpfSBmcm9tIHRoaXMgbWFya2V0cGxhY2U6XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICl9XG4gICAgICAgICAge3NlbGVjdGVkTWFya2V0cGxhY2UuaW5zdGFsbGVkUGx1Z2lucyAmJlxuICAgICAgICAgICAgc2VsZWN0ZWRNYXJrZXRwbGFjZS5pbnN0YWxsZWRQbHVnaW5zLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Ub3A9ezF9IG1hcmdpbkxlZnQ9ezJ9PlxuICAgICAgICAgICAgICAgIHtzZWxlY3RlZE1hcmtldHBsYWNlLmluc3RhbGxlZFBsdWdpbnMubWFwKHBsdWdpbiA9PiAoXG4gICAgICAgICAgICAgICAgICA8VGV4dCBrZXk9e3BsdWdpbi5uYW1lfSBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAg4oCiIHtwbHVnaW4ubmFtZX1cbiAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICBQcmVzcyA8VGV4dCBib2xkPnk8L1RleHQ+IHRvIGNvbmZpcm0gb3IgPFRleHQgYm9sZD5uPC9UZXh0PiB0b1xuICAgICAgICAgICAgICBjYW5jZWxcbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICAvLyBTaG93IG1hcmtldHBsYWNlIGRldGFpbHNcbiAgaWYgKGludGVybmFsVmlldyA9PT0gJ2RldGFpbHMnICYmIHNlbGVjdGVkTWFya2V0cGxhY2UpIHtcbiAgICAvLyBDaGVjayBpZiB0aGlzIG1hcmtldHBsYWNlIGlzIGN1cnJlbnRseSBiZWluZyBwcm9jZXNzZWRcbiAgICAvLyBDaGVjayBwZW5kaW5nVXBkYXRlIGZpcnN0IHNvIHdlIHNob3cgdXBkYXRpbmcgc3RhdGUgaW1tZWRpYXRlbHkgd2hlbiB1c2VyIHByZXNzZXMgRW50ZXJcbiAgICBjb25zdCBpc1VwZGF0aW5nID0gc2VsZWN0ZWRNYXJrZXRwbGFjZS5wZW5kaW5nVXBkYXRlIHx8IGlzUHJvY2Vzc2luZ1xuXG4gICAgY29uc3QgbWVudU9wdGlvbnMgPSBidWlsZERldGFpbHNNZW51T3B0aW9ucyhzZWxlY3RlZE1hcmtldHBsYWNlKVxuXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8VGV4dCBib2xkPntzZWxlY3RlZE1hcmtldHBsYWNlLm5hbWV9PC9UZXh0PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj57c2VsZWN0ZWRNYXJrZXRwbGFjZS5zb3VyY2V9PC9UZXh0PlxuICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICB7c2VsZWN0ZWRNYXJrZXRwbGFjZS5wbHVnaW5Db3VudCB8fCAwfSBhdmFpbGFibGV7JyAnfVxuICAgICAgICAgICAge3BsdXJhbChzZWxlY3RlZE1hcmtldHBsYWNlLnBsdWdpbkNvdW50IHx8IDAsICdwbHVnaW4nKX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuXG4gICAgICAgIHsvKiBJbnN0YWxsZWQgcGx1Z2lucyBzZWN0aW9uICovfVxuICAgICAgICB7c2VsZWN0ZWRNYXJrZXRwbGFjZS5pbnN0YWxsZWRQbHVnaW5zICYmXG4gICAgICAgICAgc2VsZWN0ZWRNYXJrZXRwbGFjZS5pbnN0YWxsZWRQbHVnaW5zLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgICAgPFRleHQgYm9sZD5cbiAgICAgICAgICAgICAgICBJbnN0YWxsZWQgcGx1Z2lucyAoe3NlbGVjdGVkTWFya2V0cGxhY2UuaW5zdGFsbGVkUGx1Z2lucy5sZW5ndGh9XG4gICAgICAgICAgICAgICAgKTpcbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5MZWZ0PXsxfT5cbiAgICAgICAgICAgICAgICB7c2VsZWN0ZWRNYXJrZXRwbGFjZS5pbnN0YWxsZWRQbHVnaW5zLm1hcChwbHVnaW4gPT4gKFxuICAgICAgICAgICAgICAgICAgPEJveCBrZXk9e3BsdWdpbi5uYW1lfSBmbGV4RGlyZWN0aW9uPVwicm93XCIgZ2FwPXsxfT5cbiAgICAgICAgICAgICAgICAgICAgPFRleHQ+e2ZpZ3VyZXMuYnVsbGV0fTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPFRleHQ+e3BsdWdpbi5uYW1lfTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57cGx1Z2luLm1hbmlmZXN0LmRlc2NyaXB0aW9ufTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApfVxuXG4gICAgICAgIHsvKiBQcm9jZXNzaW5nIGluZGljYXRvciAqL31cbiAgICAgICAge2lzVXBkYXRpbmcgJiYgKFxuICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cImNsYXVkZVwiPlVwZGF0aW5nIG1hcmtldHBsYWNl4oCmPC9UZXh0PlxuICAgICAgICAgICAge3Byb2dyZXNzTWVzc2FnZSAmJiA8VGV4dCBkaW1Db2xvcj57cHJvZ3Jlc3NNZXNzYWdlfTwvVGV4dD59XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIFN1Y2Nlc3MgbWVzc2FnZSAqL31cbiAgICAgICAgeyFpc1VwZGF0aW5nICYmIHN1Y2Nlc3NNZXNzYWdlICYmIChcbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cImNsYXVkZVwiPntzdWNjZXNzTWVzc2FnZX08L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIEVycm9yIG1lc3NhZ2UgKi99XG4gICAgICAgIHshaXNVcGRhdGluZyAmJiBwcm9jZXNzRXJyb3IgJiYgKFxuICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj57cHJvY2Vzc0Vycm9yfTwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cblxuICAgICAgICB7LyogTWVudSBvcHRpb25zICovfVxuICAgICAgICB7IWlzVXBkYXRpbmcgJiYgKFxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICB7bWVudU9wdGlvbnMubWFwKChvcHRpb24sIGlkeCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoIW9wdGlvbikgcmV0dXJuIG51bGxcbiAgICAgICAgICAgICAgY29uc3QgaXNTZWxlY3RlZCA9IGlkeCA9PT0gZGV0YWlsc01lbnVJbmRleFxuICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIDxCb3gga2V5PXtvcHRpb24udmFsdWV9PlxuICAgICAgICAgICAgICAgICAgPFRleHQgY29sb3I9e2lzU2VsZWN0ZWQgPyAnc3VnZ2VzdGlvbicgOiB1bmRlZmluZWR9PlxuICAgICAgICAgICAgICAgICAgICB7aXNTZWxlY3RlZCA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ30ge29wdGlvbi5sYWJlbH1cbiAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgIHtvcHRpb24uc2Vjb25kYXJ5TGFiZWwgJiYgKFxuICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4ge29wdGlvbi5zZWNvbmRhcnlMYWJlbH08L1RleHQ+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9KX1cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cblxuICAgICAgICB7LyogU2hvdyBleHBsYW5hdG9yeSB0ZXh0IGF0IHRoZSBib3R0b20gd2hlbiBhdXRvLXVwZGF0ZSBpcyBlbmFibGVkICovfVxuICAgICAgICB7IWlzVXBkYXRpbmcgJiZcbiAgICAgICAgICAhc2hvdWxkU2tpcFBsdWdpbkF1dG91cGRhdGUoKSAmJlxuICAgICAgICAgIHNlbGVjdGVkTWFya2V0cGxhY2UuYXV0b1VwZGF0ZSAmJiAoXG4gICAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgIEF1dG8tdXBkYXRlIGVuYWJsZWQuIENsYXVkZSBDb2RlIHdpbGwgYXV0b21hdGljYWxseSB1cGRhdGUgdGhpc1xuICAgICAgICAgICAgICAgIG1hcmtldHBsYWNlIGFuZCBpdHMgaW5zdGFsbGVkIHBsdWdpbnMuXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICl9XG5cbiAgICAgICAgPEJveCBtYXJnaW5MZWZ0PXszfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICB7aXNVcGRhdGluZyA/IChcbiAgICAgICAgICAgICAgPD5QbGVhc2Ugd2FpdOKApjwvPlxuICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgICBhY3Rpb249XCJzZWxlY3Q6YWNjZXB0XCJcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJTZWxlY3RcIlxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFbnRlclwiXG4gICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cInNlbGVjdFwiXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJnbyBiYWNrXCJcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIFNob3cgbWFya2V0cGxhY2UgbGlzdFxuICBjb25zdCB7IHVwZGF0ZUNvdW50LCByZW1vdmVDb3VudCB9ID0gZ2V0UGVuZGluZ0NvdW50cygpXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIDxCb3ggbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgPFRleHQgYm9sZD5NYW5hZ2UgbWFya2V0cGxhY2VzPC9UZXh0PlxuICAgICAgPC9Cb3g+XG5cbiAgICAgIHsvKiBBZGQgTWFya2V0cGxhY2Ugb3B0aW9uICovfVxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZ2FwPXsxfSBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICA8VGV4dCBjb2xvcj17c2VsZWN0ZWRJbmRleCA9PT0gMCA/ICdzdWdnZXN0aW9uJyA6IHVuZGVmaW5lZH0+XG4gICAgICAgICAge3NlbGVjdGVkSW5kZXggPT09IDAgPyBmaWd1cmVzLnBvaW50ZXIgOiAnICd9ICtcbiAgICAgICAgPC9UZXh0PlxuICAgICAgICA8VGV4dCBib2xkIGNvbG9yPXtzZWxlY3RlZEluZGV4ID09PSAwID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfT5cbiAgICAgICAgICBBZGQgTWFya2V0cGxhY2VcbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9Cb3g+XG5cbiAgICAgIHsvKiBNYXJrZXRwbGFjZSBsaXN0ICovfVxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIHttYXJrZXRwbGFjZVN0YXRlcy5tYXAoKHN0YXRlLCBpZHgpID0+IHtcbiAgICAgICAgICBjb25zdCBpc1NlbGVjdGVkID0gaWR4ICsgMSA9PT0gc2VsZWN0ZWRJbmRleCAvLyArMSBiZWNhdXNlIEFkZCBNYXJrZXRwbGFjZSBpcyBhdCBpbmRleCAwXG5cbiAgICAgICAgICAvLyBCdWlsZCBzdGF0dXMgaW5kaWNhdG9yc1xuICAgICAgICAgIGNvbnN0IGluZGljYXRvcnM6IHN0cmluZ1tdID0gW11cbiAgICAgICAgICBpZiAoc3RhdGUucGVuZGluZ1VwZGF0ZSkgaW5kaWNhdG9ycy5wdXNoKCdVUERBVEUnKVxuICAgICAgICAgIGlmIChzdGF0ZS5wZW5kaW5nUmVtb3ZlKSBpbmRpY2F0b3JzLnB1c2goJ1JFTU9WRScpXG5cbiAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPEJveCBrZXk9e3N0YXRlLm5hbWV9IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezF9IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgICAgIDxUZXh0IGNvbG9yPXtpc1NlbGVjdGVkID8gJ3N1Z2dlc3Rpb24nIDogdW5kZWZpbmVkfT5cbiAgICAgICAgICAgICAgICB7aXNTZWxlY3RlZCA/IGZpZ3VyZXMucG9pbnRlciA6ICcgJ317JyAnfVxuICAgICAgICAgICAgICAgIHtzdGF0ZS5wZW5kaW5nUmVtb3ZlID8gZmlndXJlcy5jcm9zcyA6IGZpZ3VyZXMuYnVsbGV0fVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGZsZXhHcm93PXsxfT5cbiAgICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiBnYXA9ezF9PlxuICAgICAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICAgICAgYm9sZFxuICAgICAgICAgICAgICAgICAgICBzdHJpa2V0aHJvdWdoPXtzdGF0ZS5wZW5kaW5nUmVtb3ZlfVxuICAgICAgICAgICAgICAgICAgICBkaW1Db2xvcj17c3RhdGUucGVuZGluZ1JlbW92ZX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAge3N0YXRlLm5hbWUgPT09ICdjbGF1ZGUtcGx1Z2lucy1vZmZpY2lhbCcgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCI+4py7IDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAge3N0YXRlLm5hbWV9XG4gICAgICAgICAgICAgICAgICAgIHtzdGF0ZS5uYW1lID09PSAnY2xhdWRlLXBsdWdpbnMtb2ZmaWNpYWwnICYmIChcbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cImNsYXVkZVwiPiDinLs8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICB7aW5kaWNhdG9ycy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJ3YXJuaW5nXCI+W3tpbmRpY2F0b3JzLmpvaW4oJywgJyl9XTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e3N0YXRlLnNvdXJjZX08L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICB7c3RhdGUucGx1Z2luQ291bnQgIT09IHVuZGVmaW5lZCAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDw+e3N0YXRlLnBsdWdpbkNvdW50fSBhdmFpbGFibGU8Lz5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICB7c3RhdGUuaW5zdGFsbGVkUGx1Z2lucyAmJlxuICAgICAgICAgICAgICAgICAgICBzdGF0ZS5pbnN0YWxsZWRQbHVnaW5zLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDw+IOKAoiB7c3RhdGUuaW5zdGFsbGVkUGx1Z2lucy5sZW5ndGh9IGluc3RhbGxlZDwvPlxuICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAge3N0YXRlLmxhc3RVcGRhdGVkICYmIChcbiAgICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgICB7JyAnfVxuICAgICAgICAgICAgICAgICAgICAgIOKAoiBVcGRhdGVkeycgJ31cbiAgICAgICAgICAgICAgICAgICAgICB7bmV3IERhdGUoc3RhdGUubGFzdFVwZGF0ZWQpLnRvTG9jYWxlRGF0ZVN0cmluZygpfVxuICAgICAgICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIClcbiAgICAgICAgfSl9XG4gICAgICA8L0JveD5cblxuICAgICAgey8qIFBlbmRpbmcgY2hhbmdlcyBzdW1tYXJ5ICovfVxuICAgICAge2hhc1BlbmRpbmdDaGFuZ2VzKCkgJiYgKFxuICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5QZW5kaW5nIGNoYW5nZXM6PC9UZXh0PnsnICd9XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5FbnRlciB0byBhcHBseTwvVGV4dD5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAge3VwZGF0ZUNvdW50ID4gMCAmJiAoXG4gICAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICAg4oCiIFVwZGF0ZSB7dXBkYXRlQ291bnR9IHtwbHVyYWwodXBkYXRlQ291bnQsICdtYXJrZXRwbGFjZScpfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICl9XG4gICAgICAgICAge3JlbW92ZUNvdW50ID4gMCAmJiAoXG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5cbiAgICAgICAgICAgICAg4oCiIFJlbW92ZSB7cmVtb3ZlQ291bnR9IHtwbHVyYWwocmVtb3ZlQ291bnQsICdtYXJrZXRwbGFjZScpfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cblxuICAgICAgey8qIFByb2Nlc3NpbmcgaW5kaWNhdG9yICovfVxuICAgICAge2lzUHJvY2Vzc2luZyAmJiAoXG4gICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cImNsYXVkZVwiPlByb2Nlc3NpbmcgY2hhbmdlc+KApjwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICB7LyogRXJyb3IgZGlzcGxheSAqL31cbiAgICAgIHtwcm9jZXNzRXJyb3IgJiYgKFxuICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPntwcm9jZXNzRXJyb3J9PC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG5cbiAgICAgIDxNYW5hZ2VNYXJrZXRwbGFjZXNLZXlIaW50c1xuICAgICAgICBleGl0U3RhdGU9e2V4aXRTdGF0ZX1cbiAgICAgICAgaGFzUGVuZGluZ0FjdGlvbnM9e2hhc1BlbmRpbmdDaGFuZ2VzKCl9XG4gICAgICAvPlxuICAgIDwvQm94PlxuICApXG59XG5cbnR5cGUgTWFuYWdlTWFya2V0cGxhY2VzS2V5SGludHNQcm9wcyA9IHtcbiAgZXhpdFN0YXRlOiBQcm9wc1snZXhpdFN0YXRlJ11cbiAgaGFzUGVuZGluZ0FjdGlvbnM6IGJvb2xlYW5cbn1cblxuZnVuY3Rpb24gTWFuYWdlTWFya2V0cGxhY2VzS2V5SGludHMoe1xuICBleGl0U3RhdGUsXG4gIGhhc1BlbmRpbmdBY3Rpb25zLFxufTogTWFuYWdlTWFya2V0cGxhY2VzS2V5SGludHNQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGlmIChleGl0U3RhdGUucGVuZGluZykge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICBQcmVzcyB7ZXhpdFN0YXRlLmtleU5hbWV9IGFnYWluIHRvIGdvIGJhY2tcbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAge2hhc1BlbmRpbmdBY3Rpb25zICYmIChcbiAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgYWN0aW9uPVwic2VsZWN0OmFjY2VwdFwiXG4gICAgICAgICAgICAgIGNvbnRleHQ9XCJTZWxlY3RcIlxuICAgICAgICAgICAgICBmYWxsYmFjaz1cIkVudGVyXCJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJhcHBseSBjaGFuZ2VzXCJcbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7IWhhc1BlbmRpbmdBY3Rpb25zICYmIChcbiAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgYWN0aW9uPVwic2VsZWN0OmFjY2VwdFwiXG4gICAgICAgICAgICAgIGNvbnRleHQ9XCJTZWxlY3RcIlxuICAgICAgICAgICAgICBmYWxsYmFjaz1cIkVudGVyXCJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJzZWxlY3RcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApfVxuICAgICAgICAgIHshaGFzUGVuZGluZ0FjdGlvbnMgJiYgKFxuICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwidVwiIGFjdGlvbj1cInVwZGF0ZVwiIC8+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7IWhhc1BlbmRpbmdBY3Rpb25zICYmIChcbiAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cInJcIiBhY3Rpb249XCJyZW1vdmVcIiAvPlxuICAgICAgICAgICl9XG4gICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uPXtoYXNQZW5kaW5nQWN0aW9ucyA/ICdjYW5jZWwnIDogJ2dvIGJhY2snfVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvQnlsaW5lPlxuICAgICAgPC9UZXh0PlxuICAgIDwvQm94PlxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQSxPQUFPQSxPQUFPLE1BQU0sU0FBUztBQUM3QixPQUFPLEtBQUtDLEtBQUssTUFBTSxPQUFPO0FBQzlCLFNBQVNDLFNBQVMsRUFBRUMsTUFBTSxFQUFFQyxRQUFRLFFBQVEsT0FBTztBQUNuRCxTQUNFLEtBQUtDLDBEQUEwRCxFQUMvREMsUUFBUSxRQUNILGlDQUFpQztBQUN4QyxTQUFTQyx3QkFBd0IsUUFBUSw4Q0FBOEM7QUFDdkYsU0FBU0MsTUFBTSxRQUFRLDBDQUEwQztBQUNqRSxTQUFTQyxvQkFBb0IsUUFBUSx3REFBd0Q7QUFDN0Y7QUFDQSxTQUFTQyxHQUFHLEVBQUVDLElBQUksRUFBRUMsUUFBUSxRQUFRLGNBQWM7QUFDbEQsU0FDRUMsYUFBYSxFQUNiQyxjQUFjLFFBQ1Qsb0NBQW9DO0FBQzNDLGNBQWNDLFlBQVksUUFBUSx1QkFBdUI7QUFDekQsU0FBU0MsS0FBSyxRQUFRLHNCQUFzQjtBQUM1QyxTQUFTQywwQkFBMEIsUUFBUSx1QkFBdUI7QUFDbEUsU0FBU0MsWUFBWSxRQUFRLHVCQUF1QjtBQUNwRCxTQUFTQyxjQUFjLFFBQVEsbUNBQW1DO0FBQ2xFLFNBQ0VDLGNBQWMsRUFDZEMsOEJBQThCLEVBQzlCQywyQkFBMkIsRUFDM0JDLHVDQUF1QyxRQUNsQywyQ0FBMkM7QUFDbEQsU0FDRUMsMkJBQTJCLEVBQzNCQyxrQkFBa0IsRUFDbEJDLHVCQUF1QixFQUN2QkMsd0JBQXdCLFFBQ25CLDJDQUEyQztBQUNsRCxTQUFTQyw0QkFBNEIsUUFBUSx5Q0FBeUM7QUFDdEYsU0FBU0MsY0FBYyxRQUFRLHFDQUFxQztBQUNwRSxTQUFTQyx1QkFBdUIsUUFBUSxnQ0FBZ0M7QUFDeEUs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