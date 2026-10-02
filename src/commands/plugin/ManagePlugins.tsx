import figures from 'figures';
import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js';
import { Byline } from '../../components/design-system/Byline.js';
import { MCPRemoteServerMenu } from '../../components/mcp/MCPRemoteServerMenu.js';
import { MCPStdioServerMenu } from '../../components/mcp/MCPStdioServerMenu.js';
import { MCPToolDetailView } from '../../components/mcp/MCPToolDetailView.js';
import { MCPToolListView } from '../../components/mcp/MCPToolListView.js';
import type { ClaudeAIServerInfo, HTTPServerInfo, SSEServerInfo, StdioServerInfo } from '../../components/mcp/types.js';
import { SearchBox } from '../../components/SearchBox.js';
import { useSearchInput } from '../../hooks/useSearchInput.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- useInput needed for raw search mode text input
import { Box, Text, useInput, useTerminalFocus } from '../../ink.js';
import { useKeybinding, useKeybindings } from '../../keybindings/useKeybinding.js';
import { getBuiltinPluginDefinition } from '../../plugins/builtinPlugins.js';
import { useMcpToggleEnabled } from '../../services/mcp/MCPConnectionManager.js';
import type { MCPServerConnection, McpClaudeAIProxyServerConfig, McpHTTPServerConfig, McpSSEServerConfig, McpStdioServerConfig } from '../../services/mcp/types.js';
import { filterToolsByServer } from '../../services/mcp/utils.js';
import { disablePluginOp, enablePluginOp, getPluginInstallationFromV2, isInstallableScope, isPluginEnabledAtProjectScope, uninstallPluginOp, updatePluginOp } from '../../services/plugins/pluginOperations.js';
import { useAppState } from '../../state/AppState.js';
import type { Tool } from '../../Tool.js';
import type { LoadedPlugin, PluginError } from '../../types/plugin.js';
import { count } from '../../utils/array.js';
import { openBrowser } from '../../utils/browser.js';
import { logForDebugging } from '../../utils/debug.js';
import { errorMessage, toError } from '../../utils/errors.js';
import { logError } from '../../utils/log.js';
import { clearAllCaches } from '../../utils/plugins/cacheUtils.js';
import { loadInstalledPluginsV2 } from '../../utils/plugins/installedPluginsManager.js';
import { getMarketplace } from '../../utils/plugins/marketplaceManager.js';
import { isMcpbSource, loadMcpbFile, type McpbNeedsConfigResult, type UserConfigValues } from '../../utils/plugins/mcpbHandler.js';
import { getPluginDataDirSize, pluginDataDirPath } from '../../utils/plugins/pluginDirectories.js';
import { getFlaggedPlugins, markFlaggedPluginsSeen, removeFlaggedPlugin } from '../../utils/plugins/pluginFlagging.js';
import { type PersistablePluginScope, parsePluginIdentifier } from '../../utils/plugins/pluginIdentifier.js';
import { loadAllPlugins } from '../../utils/plugins/pluginLoader.js';
import { loadPluginOptions, type PluginOptionSchema, savePluginOptions } from '../../utils/plugins/pluginOptionsStorage.js';
import { isPluginBlockedByPolicy } from '../../utils/plugins/pluginPolicy.js';
import { getPluginEditableScopes } from '../../utils/plugins/pluginStartupCheck.js';
import { getSettings_DEPRECATED, getSettingsForSource, updateSettingsForSource } from '../../utils/settings/settings.js';
import { jsonParse } from '../../utils/slowOperations.js';
import { plural } from '../../utils/stringUtils.js';
import { formatErrorMessage, getErrorGuidance } from './PluginErrors.js';
import { PluginOptionsDialog } from './PluginOptionsDialog.js';
import { PluginOptionsFlow } from './PluginOptionsFlow.js';
import type { ViewState as ParentViewState } from './types.js';
import { UnifiedInstalledCell } from './UnifiedInstalledCell.js';
import type { UnifiedInstalledItem } from './unifiedTypes.js';
import { usePagination } from './usePagination.js';
type Props = {
  setViewState: (state: ParentViewState) => void;
  setResult: (result: string | null) => void;
  onManageComplete?: () => void | Promise<void>;
  onSearchModeChange?: (isActive: boolean) => void;
  targetPlugin?: string;
  targetMarketplace?: string;
  action?: 'enable' | 'disable' | 'uninstall';
};
type FlaggedPluginInfo = {
  id: string;
  name: string;
  marketplace: string;
  reason: string;
  text: string;
  flaggedAt: string;
};
type FailedPluginInfo = {
  id: string;
  name: string;
  marketplace: string;
  errors: PluginError[];
  scope: PersistablePluginScope;
};
type ViewState = 'plugin-list' | 'plugin-details' | 'configuring' | {
  type: 'plugin-options';
} | {
  type: 'configuring-options';
  schema: PluginOptionSchema;
} | 'confirm-project-uninstall' | {
  type: 'confirm-data-cleanup';
  size: {
    bytes: number;
    human: string;
  };
} | {
  type: 'flagged-detail';
  plugin: FlaggedPluginInfo;
} | {
  type: 'failed-plugin-details';
  plugin: FailedPluginInfo;
} | {
  type: 'mcp-detail';
  client: MCPServerConnection;
} | {
  type: 'mcp-tools';
  client: MCPServerConnection;
} | {
  type: 'mcp-tool-detail';
  client: MCPServerConnection;
  tool: Tool;
};
type MarketplaceInfo = {
  name: string;
  installedPlugins: LoadedPlugin[];
  enabledCount?: number;
  disabledCount?: number;
};
type PluginState = {
  plugin: LoadedPlugin;
  marketplace: string;
  scope?: 'user' | 'project' | 'local' | 'managed' | 'builtin';
  pendingEnable?: boolean; // Toggle enable/disable
  pendingUpdate?: boolean; // Marked for update
};

/**
 * Get list of base file names (without .md extension) from a directory
 * @param dirPath The directory path to list files from
 * @returns Array of base file names without .md extension
 * @example
 * // Given directory contains: agent-sdk-verifier-py.md, agent-sdk-verifier-ts.md, README.txt
 * await getBaseFileNames('/path/to/agents')
 * // Returns: ['agent-sdk-verifier-py', 'agent-sdk-verifier-ts']
 */
async function getBaseFileNames(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true
    });
    return entries.filter((entry: Dirent) => entry.isFile() && entry.name.endsWith('.md')).map((entry: Dirent) => {
      // Remove .md extension specifically
      const baseName = path.basename(entry.name, '.md');
      return baseName;
    });
  } catch (error) {
    const errorMsg = errorMessage(error);
    logForDebugging(`Failed to read plugin components from ${dirPath}: ${errorMsg}`, {
      level: 'error'
    });
    logError(toError(error));
    // Return empty array to allow graceful degradation - plugin details can still be shown
    return [];
  }
}

/**
 * Get list of skill directory names from a skills directory
 * Skills are directories containing a SKILL.md file
 * @param dirPath The skills directory path to scan
 * @returns Array of skill directory names that contain SKILL.md
 * @example
 * // Given directory contains: my-skill/SKILL.md, another-skill/SKILL.md, README.txt
 * await getSkillDirNames('/path/to/skills')
 * // Returns: ['my-skill', 'another-skill']
 */
async function getSkillDirNames(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, {
      withFileTypes: true
    });
    const skillNames: string[] = [];
    for (const entry of entries) {
      // Check if it's a directory or symlink (symlinks may point to skill directories)
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        // Check if this directory contains a SKILL.md file
        const skillFilePath = path.join(dirPath, entry.name, 'SKILL.md');
        try {
          const st = await fs.stat(skillFilePath);
          if (st.isFile()) {
            skillNames.push(entry.name);
          }
        } catch {
          // No SKILL.md file in this directory, skip it
        }
      }
    }
    return skillNames;
  } catch (error) {
    const errorMsg = errorMessage(error);
    logForDebugging(`Failed to read skill directories from ${dirPath}: ${errorMsg}`, {
      level: 'error'
    });
    logError(toError(error));
    // Return empty array to allow graceful degradation - plugin details can still be shown
    return [];
  }
}

// Component to display installed plugin components
function PluginComponentsDisplay({
  plugin,
  marketplace
}: {
  plugin: LoadedPlugin;
  marketplace: string;
}): React.ReactNode {
  const [components, setComponents] = useState<{
    commands?: string | string[] | Record<string, unknown> | null;
    agents?: string | string[] | Record<string, unknown> | null;
    skills?: string | string[] | Record<string, unknown> | null;
    hooks?: unknown;
    mcpServers?: unknown;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    async function loadComponents() {
      try {
        // Built-in plugins don't have a marketplace entry — read from the
        // registered definition directly.
        if (marketplace === 'builtin') {
          const builtinDef = getBuiltinPluginDefinition(plugin.name);
          if (builtinDef) {
            const skillNames = builtinDef.skills?.map(s => s.name) ?? [];
            const hookEvents = builtinDef.hooks ? Object.keys(builtinDef.hooks) : [];
            const mcpServerNames = builtinDef.mcpServers ? Object.keys(builtinDef.mcpServers) : [];
            setComponents({
              commands: null,
              agents: null,
              skills: skillNames.length > 0 ? skillNames : null,
              hooks: hookEvents.length > 0 ? hookEvents : null,
              mcpServers: mcpServerNames.length > 0 ? mcpServerNames : null
            });
          } else {
            setError(`Built-in plugin ${plugin.name} not found`);
          }
          setLoading(false);
          return;
        }
        const marketplaceData = await getMarketplace(marketplace);
        // Find the plugin entry in the array
        const pluginEntry = marketplaceData.plugins.find(p => p.name === plugin.name);
        if (pluginEntry) {
          // Combine commands from both sources
          const commandPathList = [];
          if (plugin.commandsPath) {
            commandPathList.push(plugin.commandsPath);
          }
          if (plugin.commandsPaths) {
            commandPathList.push(...plugin.commandsPaths);
          }

          // Get base file names from all command paths
          const commandList: string[] = [];
          for (const commandPath of commandPathList) {
            if (typeof commandPath === 'string') {
              // commandPath is already a full path
              const baseNames = await getBaseFileNames(commandPath);
              commandList.push(...baseNames);
            }
          }

          // Combine agents from both sources
          const agentPathList = [];
          if (plugin.agentsPath) {
            agentPathList.push(plugin.agentsPath);
          }
          if (plugin.agentsPaths) {
            agentPathList.push(...plugin.agentsPaths);
          }

          // Get base file names from all agent paths
          const agentList: string[] = [];
          for (const agentPath of agentPathList) {
            if (typeof agentPath === 'string') {
              // agentPath is already a full path
              const baseNames_0 = await getBaseFileNames(agentPath);
              agentList.push(...baseNames_0);
            }
          }

          // Combine skills from both sources
          const skillPathList = [];
          if (plugin.skillsPath) {
            skillPathList.push(plugin.skillsPath);
          }
          if (plugin.skillsPaths) {
            skillPathList.push(...plugin.skillsPaths);
          }

          // Get skill directory names from all skill paths
          // Skills are directories containing SKILL.md files
          const skillList: string[] = [];
          for (const skillPath of skillPathList) {
            if (typeof skillPath === 'string') {
              // skillPath is already a full path to a skills directory
              const skillDirNames = await getSkillDirNames(skillPath);
              skillList.push(...skillDirNames);
            }
          }

          // Combine hooks from both sources
          const hooksList = [];
          if (plugin.hooksConfig) {
            hooksList.push(Object.keys(plugin.hooksConfig));
          }
          if (pluginEntry.hooks) {
            hooksList.push(pluginEntry.hooks);
          }

          // Combine MCP servers from both sources
          const mcpServersList = [];
          if (plugin.mcpServers) {
            mcpServersList.push(Object.keys(plugin.mcpServers));
          }
          if (pluginEntry.mcpServers) {
            mcpServersList.push(pluginEntry.mcpServers);
          }
          setComponents({
            commands: commandList.length > 0 ? commandList : null,
            agents: agentList.length > 0 ? agentList : null,
            skills: skillList.length > 0 ? skillList : null,
            hooks: hooksList.length > 0 ? hooksList : null,
            mcpServers: mcpServersList.length > 0 ? mcpServersList : null
          });
        } else {
          setError(`Plugin ${plugin.name} not found in marketplace`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load components');
      } finally {
        setLoading(false);
      }
    }
    void loadComponents();
  }, [plugin.name, plugin.commandsPath, plugin.commandsPaths, plugin.agentsPath, plugin.agentsPaths, plugin.skillsPath, plugin.skillsPaths, plugin.hooksConfig, plugin.mcpServers, marketplace]);
  if (loading) {
    return null; // Don't show loading state for cleaner UI
  }
  if (error) {
    return <Box flexDirection="column" marginBottom={1}>
        <Text bold>Components:</Text>
        <Text dimColor>Error: {error}</Text>
      </Box>;
  }
  if (!components) {
    return null; // No components info available
  }
  const hasComponents = components.commands || components.agents || components.skills || components.hooks || components.mcpServers;
  if (!hasComponents) {
    return null; // No components defined
  }
  return <Box flexDirection="column" marginBottom={1}>
      <Text bold>Installed components:</Text>
      {components.commands ? <Text dimColor>
          • Commands:{' '}
          {typeof components.commands === 'string' ? components.commands : Array.isArray(components.commands) ? components.commands.join(', ') : Object.keys(components.commands).join(', ')}
        </Text> : null}
      {components.agents ? <Text dimColor>
          • Agents:{' '}
          {typeof components.agents === 'string' ? components.agents : Array.isArray(components.agents) ? components.agents.join(', ') : Object.keys(components.agents).join(', ')}
        </Text> : null}
      {components.skills ? <Text dimColor>
          • Skills:{' '}
          {typeof components.skills === 'string' ? components.skills : Array.isArray(components.skills) ? components.skills.join(', ') : Object.keys(components.skills).join(', ')}
        </Text> : null}
      {components.hooks ? <Text dimColor>
          • Hooks:{' '}
          {typeof components.hooks === 'string' ? components.hooks : Array.isArray(components.hooks) ? components.hooks.map(String).join(', ') : typeof components.hooks === 'object' && components.hooks !== null ? Object.keys(components.hooks).join(', ') : String(components.hooks)}
        </Text> : null}
      {components.mcpServers ? <Text dimColor>
          • MCP Servers:{' '}
          {typeof components.mcpServers === 'string' ? components.mcpServers : Array.isArray(components.mcpServers) ? components.mcpServers.map(String).join(', ') : typeof components.mcpServers === 'object' && components.mcpServers !== null ? Object.keys(components.mcpServers).join(', ') : String(components.mcpServers)}
        </Text> : null}
    </Box>;
}

/**
 * Check if a plugin is from a local source and cannot be remotely updated
 * @returns Error message if local, null if remote/updatable
 */
async function checkIfLocalPlugin(pluginName: string, marketplaceName: string): Promise<string | null> {
  const marketplace = await getMarketplace(marketplaceName);
  const entry = marketplace?.plugins.find(p => p.name === pluginName);
  if (entry && typeof entry.source === 'string') {
    return `Local plugins cannot be updated remotely. To update, modify the source at: ${entry.source}`;
  }
  return null;
}

/**
 * Filter out plugins that are force-disabled by org policy (policySettings).
 * These are blocked by the organization and cannot be re-enabled by the user.
 * Checks policySettings directly rather than installation scope, since managed
 * settings don't create installation records with scope 'managed'.
 */
export function filterManagedDisabledPlugins(plugins: LoadedPlugin[]): LoadedPlugin[] {
  return plugins.filter(plugin => {
    const marketplace = plugin.source.split('@')[1] || 'local';
    return !isPluginBlockedByPolicy(`${plugin.name}@${marketplace}`);
  });
}
export function ManagePlugins({
  setViewState: setParentViewState,
  setResult,
  onManageComplete,
  onSearchModeChange,
  targetPlugin,
  targetMarketplace,
  action
}: Props): React.ReactNode {
  // App state for MCP access
  const mcpClients = useAppState(s => s.mcp.clients);
  const mcpTools = useAppState(s_0 => s_0.mcp.tools);
  const pluginErrors = useAppState(s_1 => s_1.plugins.errors);
  const flaggedPlugins = getFlaggedPlugins();

  // Search state
  const [isSearchMode, setIsSearchModeRaw] = useState(false);
  const setIsSearchMode = useCallback((active: boolean) => {
    setIsSearchModeRaw(active);
    onSearchModeChange?.(active);
  }, [onSearchModeChange]);
  const isTerminalFocused = useTerminalFocus();
  const {
    columns: terminalWidth
  } = useTerminalSize();

  // View state
  const [viewState, setViewState] = useState<ViewState>('plugin-list');
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    cursorOffset: searchCursorOffset
  } = useSearchInput({
    isActive: viewState === 'plugin-list' && isSearchMode,
    onExit: () => {
      setIsSearchMode(false);
    }
  });
  const [selectedPlugin, setSelectedPlugin] = useState<PluginState | null>(null);

  // Data state
  const [marketplaces, setMarketplaces] = useState<MarketplaceInfo[]>([]);
  const [pluginStates, setPluginStates] = useState<PluginState[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingToggles, setPendingToggles] = useState<Map<string, 'will-enable' | 'will-disable'>>(new Map());

  // Guard to prevent auto-navigation from re-triggering after the user
  // navigates away (targetPlugin is never cleared by the parent).
  const hasAutoNavigated = useRef(false);
  // Auto-action (enable/disable/uninstall) to fire after auto-navigation lands.
  // Ref, not state: it's consumed by a one-shot effect that already re-runs on
  // viewState/selectedPlugin, so a render-triggering state var would be redundant.
  const pendingAutoActionRef = useRef<'enable' | 'disable' | 'uninstall' | undefined>(undefined);

  // MCP toggle hook
  const toggleMcpServer = useMcpToggleEnabled();

  // Handle escape to go back - viewState-dependent navigation
  const handleBack = React.useCallback(() => {
    if (viewState === 'plugin-details') {
      setViewState('plugin-list');
      setSelectedPlugin(null);
      setProcessError(null);
    } else if (typeof viewState === 'object' && viewState.type === 'failed-plugin-details') {
      setViewState('plugin-list');
      setProcessError(null);
    } else if (viewState === 'configuring') {
      setViewState('plugin-details');
      setConfigNeeded(null);
    } else if (typeof viewState === 'object' && (viewState.type === 'plugin-options' || viewState.type === 'configuring-options')) {
      // Cancel mid-sequence — plugin is already enabled, just bail to list.
      // User can configure later via the Configure options menu if they want.
      setViewState('plugin-list');
      setSelectedPlugin(null);
      setResult('Plugin enabled. Configuration skipped — run /reload-plugins to apply.');
      if (onManageComplete) {
        void onManageComplete();
      }
    } else if (typeof viewState === 'object' && viewState.type === 'flagged-detail') {
      setViewState('plugin-list');
      setProcessError(null);
    } else if (typeof viewState === 'object' && viewState.type === 'mcp-detail') {
      setViewState('plugin-list');
      setProcessError(null);
    } else if (typeof viewState === 'object' && viewState.type === 'mcp-tools') {
      setViewState({
        type: 'mcp-detail',
        client: viewState.client
      });
    } else if (typeof viewState === 'object' && viewState.type === 'mcp-tool-detail') {
      setViewState({
        type: 'mcp-tools',
        client: viewState.client
      });
    } else {
      if (pendingToggles.size > 0) {
        setResult('Run /reload-plugins to apply plugin changes.');
        return;
      }
      setParentViewState({
        type: 'menu'
      });
    }
  }, [viewState, setParentViewState, pendingToggles, setResult]);

  // Escape when not in search mode - go back.
  // Excludes confirm-project-uninstall (has its own confirm:no handler in
  // Confirmation context — letting this fire would create competing handlers)
  // and confirm-data-cleanup (uses raw useInput where n and escape are
  // DIFFERENT actions: keep-data vs cancel).
  useKeybinding('confirm:no', handleBack, {
    context: 'Confirmation',
    isActive: (viewState !== 'plugin-list' || !isSearchMode) && viewState !== 'confirm-project-uninstall' && !(typeof viewState === 'object' && viewState.type === 'confirm-data-cleanup')
  });

  // Helper to get MCP status
  const getMcpStatus = (client: MCPServerConnection): 'connected' | 'disabled' | 'pending' | 'needs-auth' | 'failed' => {
    if (client.type === 'connected') return 'connected';
    if (client.type === 'disabled') return 'disabled';
    if (client.type === 'pending') return 'pending';
    if (client.type === 'needs-auth') return 'needs-auth';
    return 'failed';
  };

  // Derive unified items from plugins and MCP servers
  const unifiedItems = useMemo(() => {
    const mergedSettings = getSettings_DEPRECATED();

    // Build map of plugin name -> child MCPs
    // Plugin MCPs have names like "plugin:pluginName:serverName"
    const pluginMcpMap = new Map<string, Array<{
      displayName: string;
      client: MCPServerConnection;
    }>>();
    for (const client_0 of mcpClients) {
      if (client_0.name.startsWith('plugin:')) {
        const parts = client_0.name.split(':');
        if (parts.length >= 3) {
          const pluginName = parts[1]!;
          const serverName = parts.slice(2).join(':');
          const existing = pluginMcpMap.get(pluginName) || [];
          existing.push({
            displayName: serverName,
            client: client_0
          });
          pluginMcpMap.set(pluginName, existing);
        }
      }
    }

    // Build plugin items (unsorted for now)
    type PluginWithChildren = {
      item: UnifiedInstalledItem & {
        type: 'plugin';
      };
      originalScope: 'user' | 'project' | 'local' | 'managed' | 'builtin';
      childMcps: Array<{
        displayName: string;
        client: MCPServerConnection;
      }>;
    };
    const pluginsWithChildren: PluginWithChildren[] = [];
    for (const state of pluginStates) {
      const pluginId = `${state.plugin.name}@${state.marketplace}`;
      const isEnabled = mergedSettings?.enabledPlugins?.[pluginId] !== false;
      const errors = pluginErrors.filter(e => 'plugin' in e && e.plugin === state.plugin.name || e.source === pluginId || e.source.startsWith(`${state.plugin.name}@`));

      // Built-in plugins use 'builtin' scope; others look up from V2 data.
      const originalScope = state.plugin.isBuiltin ? 'builtin' : state.scope || 'user';
      pluginsWithChildren.push({
        item: {
          type: 'plugin',
          id: pluginId,
          name: state.plugin.name,
          description: state.plugin.manifest.description,
          marketplace: state.marketplace,
          scope: originalScope,
          isEnabled,
          errorCount: errors.length,
          errors,
          plugin: state.plugin,
          pendingEnable: state.pendingEnable,
          pendingUpdate: state.pendingUpdate,
          pendingToggle: pendingToggles.get(pluginId)
        },
        originalScope,
        childMcps: pluginMcpMap.get(state.plugin.name) || []
      });
    }

    // Find orphan errors (errors for plugins that failed to load entirely)
    const matchedPluginIds = new Set(pluginsWithChildren.map(({
      item
    }) => item.id));
    const matchedPluginNames = new Set(pluginsWithChildren.map(({
      item: item_0
    }) => item_0.name));
    const orphanErrorsBySource = new Map<string, typeof pluginErrors>();
    for (const error of pluginErrors) {
      if (matchedPluginIds.has(error.source) || 'plugin' in error && typeof error.plugin === 'string' && matchedPluginNames.has(error.plugin)) {
        continue;
      }
      const existing_0 = orphanErrorsBySource.get(error.source) || [];
      existing_0.push(error);
      orphanErrorsBySource.set(error.source, existing_0);
    }
    const pluginScopes = getPluginEditableScopes();
    const failedPluginItems: UnifiedInstalledItem[] = [];
    for (const [pluginId_0, errors_0] of orphanErrorsBySource) {
      // Skip plugins that are already shown in the flagged section
      if (pluginId_0 in flaggedPlugins) continue;
      const parsed = parsePluginIdentifier(pluginId_0);
      const pluginName_0 = parsed.name || pluginId_0;
      const marketplace = parsed.marketplace || 'unknown';
      const rawScope = pluginScopes.get(pluginId_0);
      // 'flag' is session-only (from --plugin-dir / flagSettings) and undefined
      // means the plugin isn't in any settings source. Default both to 'user'
      // since UnifiedInstalledItem doesn't have a 'flag' scope variant.
      const scope = rawScope === 'flag' || rawScope === undefined ? 'user' : rawScope;
      failedPluginItems.push({
        type: 'failed-plugin',
        id: pluginId_0,
        name: pluginName_0,
        marketplace,
        scope,
        errorCount: errors_0.length,
        errors: errors_0
      });
    }

    // Build standalone MCP items
    const standaloneMcps: UnifiedInstalledItem[] = [];
    for (const client_1 of mcpClients) {
      if (client_1.name === 'ide') continue;
      if (client_1.name.startsWith('plugin:')) continue;
      standaloneMcps.push({
        type: 'mcp',
        id: `mcp:${client_1.name}`,
        name: client_1.name,
        description: undefined,
        scope: client_1.config.scope,
        status: getMcpStatus(client_1),
        client: client_1
      });
    }

    // Define scope order for display
    const scopeOrder: Record<string, number> = {
      flagged: -1,
      project: 0,
      local: 1,
      user: 2,
      enterprise: 3,
      managed: 4,
      dynamic: 5,
      builtin: 6
    };

    // Build final list by merging plugins (with their child MCPs) and standalone MCPs
    // Group by scope to avoid duplicate scope headers
    const unified: UnifiedInstalledItem[] = [];

    // Create a map of scope -> items for proper merging
    const itemsByScope = new Map<string, UnifiedInstalledItem[]>();

    // Add plugins with their child MCPs
    for (const {
      item: item_1,
      originalScope: originalScope_0,
      childMcps
    } of pluginsWithChildren) {
      const scope_0 = item_1.scope;
      if (!itemsByScope.has(scope_0)) {
        itemsByScope.set(scope_0, []);
      }
      itemsByScope.get(scope_0)!.push(item_1);
      // Add child MCPs right after the plugin, indented (use original scope, not 'flagged').
      // Built-in plugins map to 'user' for display since MCP ConfigScope doesn't include 'builtin'.
      for (const {
        displayName,
        client: client_2
      } of childMcps) {
        const displayScope = originalScope_0 === 'builtin' ? 'user' : originalScope_0;
        if (!itemsByScope.has(displayScope)) {
          itemsByScope.set(displayScope, []);
        }
        itemsByScope.get(displayScope)!.push({
          type: 'mcp',
          id: `mcp:${client_2.name}`,
          name: displayName,
          description: undefined,
          scope: displayScope,
          status: getMcpStatus(client_2),
          client: client_2,
          indented: true
        });
      }
    }

    // Add standalone MCPs to their respective scope groups
    for (const mcp of standaloneMcps) {
      const scope_1 = mcp.scope;
      if (!itemsByScope.has(scope_1)) {
        itemsByScope.set(scope_1, []);
      }
      itemsByScope.get(scope_1)!.push(mcp);
    }

    // Add failed plugins to their respective scope groups
    for (const failedPlugin of failedPluginItems) {
      const scope_2 = failedPlugin.scope;
      if (!itemsByScope.has(scope_2)) {
        itemsByScope.set(scope_2, []);
      }
      itemsByScope.get(scope_2)!.push(failedPlugin);
    }

    // Add flagged (delisted) plugins from user settings.
    // Reason/text are looked up from the cached security messages file.
    for (const [pluginId_1, entry] of Object.entries(flaggedPlugins)) {
      const parsed_0 = parsePluginIdentifier(pluginId_1);
      const pluginName_1 = parsed_0.name || pluginId_1;
      const marketplace_0 = parsed_0.marketplace || 'unknown';
      if (!itemsByScope.has('flagged')) {
        itemsByScope.set('flagged', []);
      }
      itemsByScope.get('flagged')!.push({
        type: 'flagged-plugin',
        id: pluginId_1,
        name: pluginName_1,
        marketplace: marketplace_0,
        scope: 'flagged',
        reason: 'delisted',
        text: 'Removed from marketplace',
        flaggedAt: entry.flaggedAt
      });
    }

    // Sort scopes and build final list
    const sortedScopes = [...itemsByScope.keys()].sort((a, b) => (scopeOrder[a] ?? 99) - (scopeOrder[b] ?? 99));
    for (const scope_3 of sortedScopes) {
      const items = itemsByScope.get(scope_3)!;

      // Separate items into plugin groups (with their child MCPs) and standalone MCPs
      // This preserves parent-child relationships that would be broken by naive sorting
      const pluginGroups: UnifiedInstalledItem[][] = [];
      const standaloneMcpsInScope: UnifiedInstalledItem[] = [];
      let i = 0;
      while (i < items.length) {
        const item_2 = items[i]!;
        if (item_2.type === 'plugin' || item_2.type === 'failed-plugin' || item_2.type === 'flagged-plugin') {
          // Collect the plugin and its child MCPs as a group
          const group: UnifiedInstalledItem[] = [item_2];
          i++;
          // Look ahead for indented child MCPs
          let nextItem = items[i];
          while (nextItem?.type === 'mcp' && nextItem.indented) {
            group.push(nextItem);
            i++;
            nextItem = items[i];
          }
          pluginGroups.push(group);
        } else if (item_2.type === 'mcp' && !item_2.indented) {
          // Standalone MCP (not a child of a plugin)
          standaloneMcpsInScope.push(item_2);
          i++;
        } else {
          // Skip orphaned indented MCPs (shouldn't happen)
          i++;
        }
      }

      // Sort plugin groups by the plugin name (first item in each group)
      pluginGroups.sort((a_0, b_0) => a_0[0]!.name.localeCompare(b_0[0]!.name));

      // Sort standalone MCPs by name
      standaloneMcpsInScope.sort((a_1, b_1) => a_1.name.localeCompare(b_1.name));

      // Build final list: plugins (with their children) first, then standalone MCPs
      for (const group_0 of pluginGroups) {
        unified.push(...group_0);
      }
      unified.push(...standaloneMcpsInScope);
    }
    return unified;
  }, [pluginStates, mcpClients, pluginErrors, pendingToggles, flaggedPlugins]);

  // Mark flagged plugins as seen when the Installed view renders them.
  // After 48 hours from seenAt, they auto-clear on next load.
  const flaggedIds = useMemo(() => unifiedItems.filter(item_3 => item_3.type === 'flagged-plugin').map(item_4 => item_4.id), [unifiedItems]);
  useEffect(() => {
    if (flaggedIds.length > 0) {
      void markFlaggedPluginsSeen(flaggedIds);
    }
  }, [flaggedIds]);

  // Filter items based on search query (matches name or description)
  const filteredItems = useMemo(() => {
    if (!searchQuery) return unifiedItems;
    const lowerQuery = searchQuery.toLowerCase();
    return unifiedItems.filter(item_5 => item_5.name.toLowerCase().includes(lowerQuery) || 'description' in item_5 && item_5.description?.toLowerCase().includes(lowerQuery));
  }, [unifiedItems, searchQuery]);

  // Selection state
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Pagination for unified list (continuous scrolling)
  const pagination = usePagination<UnifiedInstalledItem>({
    totalItems: filteredItems.length,
    selectedIndex,
    maxVisible: 8
  });

  // Details view state
  const [detailsMenuIndex, setDetailsMenuIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  // Configuration state
  const [configNeeded, setConfigNeeded] = useState<McpbNeedsConfigResult | null>(null);
  const [_isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [selectedPluginHasMcpb, setSelectedPluginHasMcpb] = useState(false);

  // Detect if selected plugin has MCPB
  // Reads raw marketplace.json to work with old cached marketplaces
  useEffect(() => {
    if (!selectedPlugin) {
      setSelectedPluginHasMcpb(false);
      return;
    }
    async function detectMcpb() {
      // Check plugin manifest first
      const mcpServersSpec = selectedPlugin!.plugin.manifest.mcpServers;
      let hasMcpb = false;
      if (mcpServersSpec) {
        hasMcpb = typeof mcpServersSpec === 'string' && isMcpbSource(mcpServersSpec) || Array.isArray(mcpServersSpec) && mcpServersSpec.some(s_2 => typeof s_2 === 'string' && isMcpbSource(s_2));
      }

      // If not in manifest, read raw marketplace.json directly (bypassing schema validation)
      // This works even with old cached marketplaces from before MCPB support
      if (!hasMcpb) {
        try {
          const marketplaceDir = path.join(selectedPlugin!.plugin.path, '..');
          const marketplaceJsonPath = path.join(marketplaceDir, '.claude-plugin', 'marketplace.json');
          const content = await fs.readFile(marketplaceJsonPath, 'utf-8');
          const marketplace_1 = jsonParse(content);
          const entry_0 = marketplace_1.plugins?.find((p: {
            name: string;
          }) => p.name === selectedPlugin!.plugin.name);
          if (entry_0?.mcpServers) {
            const spec = entry_0.mcpServers;
            hasMcpb = typeof spec === 'string' && isMcpbSource(spec) || Array.isArray(spec) && spec.some((s_3: unknown) => typeof s_3 === 'string' && isMcpbSource(s_3));
          }
        } catch (err) {
          logForDebugging(`Failed to read raw marketplace.json: ${err}`);
        }
      }
      setSelectedPluginHasMcpb(hasMcpb);
    }
    void detectMcpb();
  }, [selectedPlugin]);

  // Load installed plugins grouped by marketplace
  useEffect(() => {
    async function loadInstalledPlugins() {
      setLoading(true);
      try {
        const {
          enabled,
          disabled
        } = await loadAllPlugins();
        const mergedSettings = getSettings_DEPRECATED(); // Use merged settings to respect all layers

        const allPlugins = filterManagedDisabledPlugins([...enabled, ...disabled]);

        // Group plugins by marketplace
        const pluginsByMarketplace: Record<string, LoadedPlugin[]> = {};
        for (const plugin of allPlugins) {
          const marketplace = plugin.source.split('@')[1] || 'local';
          if (!pluginsByMarketplace[marketplace]) {
            pluginsByMarketplace[marketplace] = [];
          }
          pluginsByMarketplace[marketplace]!.push(plugin);
        }

        // Create marketplace info array with enabled/disabled counts
        const marketplaceInfos: MarketplaceInfo[] = [];
        for (const [name, plugins] of Object.entries(pluginsByMarketplace)) {
          const enabledCount = count(plugins, p => {
            const pluginId = `${p.name}@${name}`;
            return mergedSettings?.enabledPlugins?.[pluginId] !== false;
          });
          const disabledCount = plugins.length - enabledCount;
          marketplaceInfos.push({
            name,
            installedPlugins: plugins,
            enabledCount,
            disabledCount
          });
        }

        // Sort marketplaces: claude-plugin-directory first, then alphabetically
        marketplaceInfos.sort((a, b) => {
          if (a.name === 'claude-plugin-directory') return -1;
          if (b.name === 'claude-plugin-directory') return 1;
          return a.name.localeCompare(b.name);
        });
        setMarketplaces(marketplaceInfos);

        // Build flat list of all plugin states
        const allStates: PluginState[] = [];
        for (const marketplace of marketplaceInfos) {
          for (const plugin of marketplace.installedPlugins) {
            const pluginId = `${plugin.name}@${marketplace.name}`;
            // Built-in plugins don't have V2 install entries — skip the lookup.
            const scope = plugin.isBuiltin ? 'builtin' : getPluginInstallationFromV2(pluginId).scope;
            allStates.push({
              plugin,
              marketplace: marketplace.name,
              scope,
              pendingEnable: undefined,
              pendingUpdate: false
            });
          }
        }
        setPluginStates(allStates);
        setSelectedIndex(0);
      } finally {
        setLoading(false);
      }
    }
    void loadInstalledPlugins();
  }, []);

  // Auto-navigate to target plugin if specified (once only)
  useEffect(() => {
    if (hasAutoNavigated.current) return;
    if (targetPlugin && marketplaces.length > 0 && !loading) {
      // targetPlugin may be `name` or `name@marketplace` (parseArgs passes the
      // raw arg through). Parse it so p.name matching works either way.
      const {
        name: targetName,
        marketplace: targetMktFromId
      } = parsePluginIdentifier(targetPlugin);
      const effectiveTargetMarketplace = targetMarketplace ?? targetMktFromId;

      // Use targetMarketplace if provided, otherwise search all
      const marketplacesToSearch = effectiveTargetMarketplace ? marketplaces.filter(m => m.name === effectiveTargetMarketplace) : marketplaces;

      // First check successfully loaded plugins
      for (const marketplace_2 of marketplacesToSearch) {
        const plugin = marketplace_2.installedPlugins.find(p_0 => p_0.name === targetName);
        if (plugin) {
          // Get scope from V2 data for proper operation handling
          const pluginId_2 = `${plugin.name}@${marketplace_2.name}`;
          const {
            scope: scope_4
          } = getPluginInstallationFromV2(pluginId_2);
          const pluginState: PluginState = {
            plugin,
            marketplace: marketplace_2.name,
            scope: scope_4,
            pendingEnable: undefined,
            pendingUpdate: false
          };
          setSelectedPlugin(pluginState);
          setViewState('plugin-details');
          pendingAutoActionRef.current = action;
          hasAutoNavigated.current = true;
          return;
        }
      }

      // Fall back to failed plugins (those with errors but not loaded)
      const failedItem = unifiedItems.find(item_6 => item_6.type === 'failed-plugin' && item_6.name === targetName);
      if (failedItem && failedItem.type === 'failed-plugin') {
        setViewState({
          type: 'failed-plugin-details',
          plugin: {
            id: failedItem.id,
            name: failedItem.name,
            marketplace: failedItem.marketplace,
            errors: failedItem.errors,
            scope: failedItem.scope
          }
        });
        hasAutoNavigated.current = true;
      }

      // No match in loaded OR failed plugins — close the dialog with a
      // message rather than silently landing on the plugin list. Only do
      // this when an action was requested (e.g. /plugin uninstall X);
      // plain navigation (/plugin manage) should still just show the list.
      if (!hasAutoNavigated.current && action) {
        hasAutoNavigated.current = true;
        setResult(`Plugin "${targetPlugin}" is not installed in this project`);
      }
    }
  }, [targetPlugin, targetMarketplace, marketplaces, loading, unifiedItems, action, setResult]);

  // Handle single plugin operations from details view
  const handleSingleOperation = async (operation: 'enable' | 'disable' | 'update' | 'uninstall') => {
    if (!selectedPlugin) return;
    const pluginScope = selectedPlugin.scope || 'user';
    const isBuiltin = pluginScope === 'builtin';

    // Built-in plugins can only be enabled/disabled, not updated/uninstalled.
    if (isBuiltin && (operation === 'update' || operation === 'uninstall')) {
      setProcessError('Built-in plugins cannot be updated or uninstalled.');
      return;
    }

    // Managed scope plugins can only be updated, not enabled/disabled/uninstalled
    if (!isBuiltin && !isInstallableScope(pluginScope) && operation !== 'update') {
      setProcessError('This plugin is managed by your organization. Contact your admin to disable it.');
      return;
    }
    setIsProcessing(true);
    setProcessError(null);
    try {
      const pluginId_3 = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
      let reverseDependents: string[] | undefined;

      // enable/disable omit scope — pluginScope is the install scope from
      // installed_plugins.json (where files are cached), which can diverge
      // from the settings scope (where enablement lives). Passing it trips
      // the cross-scope guard. Auto-detect finds the right scope. #38084
      switch (operation) {
        case 'enable':
          {
            const enableResult = await enablePluginOp(pluginId_3);
            if (!enableResult.success) {
              throw new Error(enableResult.message);
            }
            break;
          }
        case 'disable':
          {
            const disableResult = await disablePluginOp(pluginId_3);
            if (!disableResult.success) {
              throw new Error(disableResult.message);
            }
            reverseDependents = disableResult.reverseDependents;
            break;
          }
        case 'uninstall':
          {
            if (isBuiltin) break; // guarded above; narrows pluginScope
            if (!isInstallableScope(pluginScope)) break;
            // If the plugin is enabled in .claude/settings.json (shared with the
            // team), divert to a confirmation dialog that offers to disable in
            // settings.local.json instead. Check the settings file directly —
            // `pluginScope` (from installed_plugins.json) can be 'user' even when
            // the plugin is ALSO project-enabled, and uninstalling the user-scope
            // install would leave the project enablement active.
            if (isPluginEnabledAtProjectScope(pluginId_3)) {
              setIsProcessing(false);
              setViewState('confirm-project-uninstall');
              return;
            }
            // If the plugin has persistent data (${CLAUDE_PLUGIN_DATA}) AND this
            // is the last scope, prompt before deleting it. For multi-scope
            // installs, the op's isLastScope check won't delete regardless of
            // the user's y/n — showing the dialog would mislead ("y" → nothing
            // happens). Length check mirrors pluginOperations.ts:513.
            const installs = loadInstalledPluginsV2().plugins[pluginId_3];
            const isLastScope = !installs || installs.length <= 1;
            const dataSize = isLastScope ? await getPluginDataDirSize(pluginId_3) : null;
            if (dataSize) {
              setIsProcessing(false);
              setViewState({
                type: 'confirm-data-cleanup',
                size: dataSize
              });
              return;
            }
            const result_0 = await uninstallPluginOp(pluginId_3, pluginScope);
            if (!result_0.success) {
              throw new Error(result_0.message);
            }
            reverseDependents = result_0.reverseDependents;
            break;
          }
        case 'update':
          {
            if (isBuiltin) break; // guarded above; narrows pluginScope
            const result = await updatePluginOp(pluginId_3, pluginScope);
            if (!result.success) {
              throw new Error(result.message);
            }
            // If already up to date, show message and exit
            if (result.alreadyUpToDate) {
              setResult(`${selectedPlugin.plugin.name} is already at the latest version (${result.newVersion}).`);
              if (onManageComplete) {
                await onManageComplete();
              }
              setParentViewState({
                type: 'menu'
              });
              return;
            }
            // Success - will show standard message below
            break;
          }
      }

      // Operations (enable, disable, uninstall, update) now use centralized functions
      // that handle their own settings updates, so we only need to clear caches here
      clearAllCaches();

      // Prompt for manifest.userConfig + channel userConfig if the plugin ends
      // up enabled. Re-read settings rather than keying on `operation ===
      // 'enable'`: install enables on install, so the menu shows "Disable"
      // first. PluginOptionsFlow itself checks getUnconfiguredOptions — if
      // nothing needs filling, it calls onDone('skipped') immediately.
      const pluginIdNow = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
      const settingsAfter = getSettings_DEPRECATED();
      const enabledAfter = settingsAfter?.enabledPlugins?.[pluginIdNow] !== false;
      if (enabledAfter) {
        setIsProcessing(false);
        setViewState({
          type: 'plugin-options'
        });
        return;
      }
      const operationName = operation === 'enable' ? 'Enabled' : operation === 'disable' ? 'Disabled' : operation === 'update' ? 'Updated' : 'Uninstalled';

      // Single-line warning — notification timeout is ~8s, multi-line would scroll off.
      // The persistent record is in the Errors tab (dependency-unsatisfied after reload).
      const depWarn = reverseDependents && reverseDependents.length > 0 ? ` · required by ${reverseDependents.join(', ')}` : '';
      const message = `✓ ${operationName} ${selectedPlugin.plugin.name}${depWarn}. Run /reload-plugins to apply.`;
      setResult(message);
      if (onManageComplete) {
        await onManageComplete();
      }
      setParentViewState({
        type: 'menu'
      });
    } catch (error_0) {
      setIsProcessing(false);
      const errorMessage = error_0 instanceof Error ? error_0.message : String(error_0);
      setProcessError(`Failed to ${operation}: ${errorMessage}`);
      logError(toError(error_0));
    }
  };

  // Latest-ref: lets the auto-action effect call the current closure without
  // adding handleSingleOperation (recreated every render) to its deps.
  const handleSingleOperationRef = useRef(handleSingleOperation);
  handleSingleOperationRef.current = handleSingleOperation;

  // Auto-execute the action prop (/plugin uninstall X, /plugin enable X, etc.)
  // once auto-navigation has landed on plugin-details.
  useEffect(() => {
    if (viewState === 'plugin-details' && selectedPlugin && pendingAutoActionRef.current) {
      const pending = pendingAutoActionRef.current;
      pendingAutoActionRef.current = undefined;
      void handleSingleOperationRef.current(pending);
    }
  }, [viewState, selectedPlugin]);

  // Handle toggle enable/disable
  const handleToggle = React.useCallback(() => {
    if (selectedIndex >= filteredItems.length) return;
    const item_7 = filteredItems[selectedIndex];
    if (item_7?.type === 'flagged-plugin') return;
    if (item_7?.type === 'plugin') {
      const pluginId_4 = `${item_7.plugin.name}@${item_7.marketplace}`;
      const mergedSettings_0 = getSettings_DEPRECATED();
      const currentPending = pendingToggles.get(pluginId_4);
      const isEnabled_0 = mergedSettings_0?.enabledPlugins?.[pluginId_4] !== false;
      const pluginScope_0 = item_7.scope;
      const isBuiltin_0 = pluginScope_0 === 'builtin';
      if (isBuiltin_0 || isInstallableScope(pluginScope_0)) {
        const newPending = new Map(pendingToggles);
        // Omit scope — see handleSingleOperation's enable/disable comment.
        if (currentPending) {
          // Cancel: reverse the operation back to the original state
          newPending.delete(pluginId_4);
          void (async () => {
            try {
              if (currentPending === 'will-disable') {
                await enablePluginOp(pluginId_4);
              } else {
                await disablePluginOp(pluginId_4);
              }
              clearAllCaches();
            } catch (err_0) {
              logError(err_0);
            }
          })();
        } else {
          newPending.set(pluginId_4, isEnabled_0 ? 'will-disable' : 'will-enable');
          void (async () => {
            try {
              if (isEnabled_0) {
                await disablePluginOp(pluginId_4);
              } else {
                await enablePluginOp(pluginId_4);
              }
              clearAllCaches();
            } catch (err_1) {
              logError(err_1);
            }
          })();
        }
        setPendingToggles(newPending);
      }
    } else if (item_7?.type === 'mcp') {
      void toggleMcpServer(item_7.client.name);
    }
  }, [selectedIndex, filteredItems, pendingToggles, pluginStates, toggleMcpServer]);

  // Handle accept (Enter) in plugin-list
  const handleAccept = React.useCallback(() => {
    if (selectedIndex >= filteredItems.length) return;
    const item_8 = filteredItems[selectedIndex];
    if (item_8?.type === 'plugin') {
      const state_0 = pluginStates.find(s_4 => s_4.plugin.name === item_8.plugin.name && s_4.marketplace === item_8.marketplace);
      if (state_0) {
        setSelectedPlugin(state_0);
        setViewState('plugin-details');
        setDetailsMenuIndex(0);
        setProcessError(null);
      }
    } else if (item_8?.type === 'flagged-plugin') {
      setViewState({
        type: 'flagged-detail',
        plugin: {
          id: item_8.id,
          name: item_8.name,
          marketplace: item_8.marketplace,
          reason: item_8.reason,
          text: item_8.text,
          flaggedAt: item_8.flaggedAt
        }
      });
      setProcessError(null);
    } else if (item_8?.type === 'failed-plugin') {
      setViewState({
        type: 'failed-plugin-details',
        plugin: {
          id: item_8.id,
          name: item_8.name,
          marketplace: item_8.marketplace,
          errors: item_8.errors,
          scope: item_8.scope
        }
      });
      setDetailsMenuIndex(0);
      setProcessError(null);
    } else if (item_8?.type === 'mcp') {
      setViewState({
        type: 'mcp-detail',
        client: item_8.client
      });
      setProcessError(null);
    }
  }, [selectedIndex, filteredItems, pluginStates]);

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
      if (selectedIndex < filteredItems.length - 1) {
        pagination.handleSelectionChange(selectedIndex + 1, setSelectedIndex);
      }
    },
    'select:accept': handleAccept
  }, {
    context: 'Select',
    isActive: viewState === 'plugin-list' && !isSearchMode
  });
  useKeybindings({
    'plugin:toggle': handleToggle
  }, {
    context: 'Plugin',
    isActive: viewState === 'plugin-list' && !isSearchMode
  });

  // Handle dismiss action in flagged-detail view
  const handleFlaggedDismiss = React.useCallback(() => {
    if (typeof viewState !== 'object' || viewState.type !== 'flagged-detail') return;
    void removeFlaggedPlugin(viewState.plugin.id);
    setViewState('plugin-list');
  }, [viewState]);
  useKeybindings({
    'select:accept': handleFlaggedDismiss
  }, {
    context: 'Select',
    isActive: typeof viewState === 'object' && viewState.type === 'flagged-detail'
  });

  // Build details menu items (needed for navigation)
  const detailsMenuItems = React.useMemo(() => {
    if (viewState !== 'plugin-details' || !selectedPlugin) return [];
    const mergedSettings_1 = getSettings_DEPRECATED();
    const pluginId_5 = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
    const isEnabled_1 = mergedSettings_1?.enabledPlugins?.[pluginId_5] !== false;
    const isBuiltin_1 = selectedPlugin.marketplace === 'builtin';
    const menuItems: Array<{
      label: string;
      action: () => void;
    }> = [];
    menuItems.push({
      label: isEnabled_1 ? 'Disable plugin' : 'Enable plugin',
      action: () => void handleSingleOperation(isEnabled_1 ? 'disable' : 'enable')
    });

    // Update/Uninstall options — not available for built-in plugins
    if (!isBuiltin_1) {
      menuItems.push({
        label: selectedPlugin.pendingUpdate ? 'Unmark for update' : 'Mark for update',
        action: async () => {
          try {
            const localError = await checkIfLocalPlugin(selectedPlugin.plugin.name, selectedPlugin.marketplace);
            if (localError) {
              setProcessError(localError);
              return;
            }
            const newStates = [...pluginStates];
            const index = newStates.findIndex(s_5 => s_5.plugin.name === selectedPlugin.plugin.name && s_5.marketplace === selectedPlugin.marketplace);
            if (index !== -1) {
              newStates[index]!.pendingUpdate = !selectedPlugin.pendingUpdate;
              setPluginStates(newStates);
              setSelectedPlugin({
                ...selectedPlugin,
                pendingUpdate: !selectedPlugin.pendingUpdate
              });
            }
          } catch (error_1) {
            setProcessError(error_1 instanceof Error ? error_1.message : 'Failed to check plugin update availability');
          }
        }
      });
      if (selectedPluginHasMcpb) {
        menuItems.push({
          label: 'Configure',
          action: async () => {
            setIsLoadingConfig(true);
            try {
              const mcpServersSpec_0 = selectedPlugin.plugin.manifest.mcpServers;
              let mcpbPath: string | null = null;
              if (typeof mcpServersSpec_0 === 'string' && isMcpbSource(mcpServersSpec_0)) {
                mcpbPath = mcpServersSpec_0;
              } else if (Array.isArray(mcpServersSpec_0)) {
                for (const spec_0 of mcpServersSpec_0) {
                  if (typeof spec_0 === 'string' && isMcpbSource(spec_0)) {
                    mcpbPath = spec_0;
                    break;
                  }
                }
              }
              if (!mcpbPath) {
                setProcessError('No MCPB file found in plugin');
                setIsLoadingConfig(false);
                return;
              }
              const pluginId_6 = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
              const result_1 = await loadMcpbFile(mcpbPath, selectedPlugin.plugin.path, pluginId_6, undefined, undefined, true);
              if ('status' in result_1 && result_1.status === 'needs-config') {
                setConfigNeeded(result_1);
                setViewState('configuring');
              } else {
                setProcessError('Failed to load MCPB for configuration');
              }
            } catch (err_2) {
              const errorMsg = errorMessage(err_2);
              setProcessError(`Failed to load configuration: ${errorMsg}`);
            } finally {
              setIsLoadingConfig(false);
            }
          }
        });
      }
      if (selectedPlugin.plugin.manifest.userConfig && Object.keys(selectedPlugin.plugin.manifest.userConfig).length > 0) {
        menuItems.push({
          label: 'Configure options',
          action: () => {
            setViewState({
              type: 'configuring-options',
              schema: selectedPlugin.plugin.manifest.userConfig!
            });
          }
        });
      }
      menuItems.push({
        label: 'Update now',
        action: () => void handleSingleOperation('update')
      });
      menuItems.push({
        label: 'Uninstall',
        action: () => void handleSingleOperation('uninstall')
      });
    }
    if (selectedPlugin.plugin.manifest.homepage) {
      menuItems.push({
        label: 'Open homepage',
        action: () => void openBrowser(selectedPlugin.plugin.manifest.homepage!)
      });
    }
    if (selectedPlugin.plugin.manifest.repository) {
      menuItems.push({
        // Generic label — manifest.repository can be GitLab, Bitbucket,
        // Azure DevOps, etc. (gh-31598). pluginDetailsHelpers.tsx:74 keeps
        // 'View on GitHub' because that path has an explicit isGitHub check.
        label: 'View repository',
        action: () => void openBrowser(selectedPlugin.plugin.manifest.repository!)
      });
    }
    menuItems.push({
      label: 'Back to plugin list',
      action: () => {
        setViewState('plugin-list');
        setSelectedPlugin(null);
        setProcessError(null);
      }
    });
    return menuItems;
  }, [viewState, selectedPlugin, selectedPluginHasMcpb, pluginStates]);

  // Plugin-details navigation
  useKeybindings({
    'select:previous': () => {
      if (detailsMenuIndex > 0) {
        setDetailsMenuIndex(detailsMenuIndex - 1);
      }
    },
    'select:next': () => {
      if (detailsMenuIndex < detailsMenuItems.length - 1) {
        setDetailsMenuIndex(detailsMenuIndex + 1);
      }
    },
    'select:accept': () => {
      if (detailsMenuItems[detailsMenuIndex]) {
        detailsMenuItems[detailsMenuIndex]!.action();
      }
    }
  }, {
    context: 'Select',
    isActive: viewState === 'plugin-details' && !!selectedPlugin
  });

  // Failed-plugin-details: only "Uninstall" option, handle Enter
  useKeybindings({
    'select:accept': () => {
      if (typeof viewState === 'object' && viewState.type === 'failed-plugin-details') {
        void (async () => {
          setIsProcessing(true);
          setProcessError(null);
          const pluginId_7 = viewState.plugin.id;
          const pluginScope_1 = viewState.plugin.scope;
          // Pass scope to uninstallPluginOp so it can find the correct V2
          // installation record and clean up on-disk files. Fall back to
          // default scope if not installable (e.g. 'managed', though that
          // case is guarded by isActive below). deleteDataDir=false: this
          // is a recovery path for a plugin that failed to load — it may
          // be reinstallable, so don't nuke ${CLAUDE_PLUGIN_DATA} silently.
          // The normal uninstall path prompts; this one preserves.
          const result_2 = isInstallableScope(pluginScope_1) ? await uninstallPluginOp(pluginId_7, pluginScope_1, false) : await uninstallPluginOp(pluginId_7, 'user', false);
          let success = result_2.success;
          if (!success) {
            // Plugin was never installed (only in enabledPlugins settings).
            // Remove directly from all editable settings sources.
            const editableSources = ['userSettings' as const, 'projectSettings' as const, 'localSettings' as const];
            for (const source of editableSources) {
              const settings = getSettingsForSource(source);
              if (settings?.enabledPlugins?.[pluginId_7] !== undefined) {
                updateSettingsForSource(source, {
                  enabledPlugins: {
                    ...settings.enabledPlugins,
                    [pluginId_7]: undefined
                  }
                });
                success = true;
              }
            }
            // Clear memoized caches so next loadAllPlugins() picks up settings changes
            clearAllCaches();
          }
          if (success) {
            if (onManageComplete) {
              await onManageComplete();
            }
            setIsProcessing(false);
            // Return to list (don't setResult — that closes the whole dialog)
            setViewState('plugin-list');
          } else {
            setIsProcessing(false);
            setProcessError(result_2.message);
          }
        })();
      }
    }
  }, {
    context: 'Select',
    isActive: typeof viewState === 'object' && viewState.type === 'failed-plugin-details' && viewState.plugin.scope !== 'managed'
  });

  // Confirm-project-uninstall: y/enter disables in settings.local.json, n/escape cancels
  useKeybindings({
    'confirm:yes': () => {
      if (!selectedPlugin) return;
      setIsProcessing(true);
      setProcessError(null);
      const pluginId_8 = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
      // Write `false` directly — disablePluginOp's cross-scope guard would
      // reject this (plugin isn't in localSettings yet; the override IS the
      // point).
      const {
        error: error_2
      } = updateSettingsForSource('localSettings', {
        enabledPlugins: {
          ...getSettingsForSource('localSettings')?.enabledPlugins,
          [pluginId_8]: false
        }
      });
      if (error_2) {
        setIsProcessing(false);
        setProcessError(`Failed to write settings: ${error_2.message}`);
        return;
      }
      clearAllCaches();
      setResult(`✓ Disabled ${selectedPlugin.plugin.name} in .claude/settings.local.json. Run /reload-plugins to apply.`);
      if (onManageComplete) void onManageComplete();
      setParentViewState({
        type: 'menu'
      });
    },
    'confirm:no': () => {
      setViewState('plugin-details');
      setProcessError(null);
    }
  }, {
    context: 'Confirmation',
    isActive: viewState === 'confirm-project-uninstall' && !!selectedPlugin && !isProcessing
  });

  // Confirm-data-cleanup: y uninstalls + deletes data dir, n uninstalls + keeps,
  // esc cancels. Raw useInput because: (1) the Confirmation context maps
  // enter→confirm:yes, which would make Enter delete the data directory — a
  // destructive default the UI text ("y to delete · n to keep") doesn't
  // advertise; (2) unlike confirm-project-uninstall (which uses useKeybindings
  // where n and escape both map to confirm:no), here n and escape are DIFFERENT
  // actions (keep-data vs cancel), so this deliberately stays on raw useInput.
  // eslint-disable-next-line custom-rules/prefer-use-keybindings -- raw y/n/esc; Enter must not trigger destructive delete
  useInput((input, key) => {
    if (!selectedPlugin) return;
    const pluginId_9 = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
    const pluginScope_2 = selectedPlugin.scope;
    // Dialog is only reachable from the uninstall case (which guards on
    // isBuiltin), but TS can't track that across viewState transitions.
    if (!pluginScope_2 || pluginScope_2 === 'builtin' || !isInstallableScope(pluginScope_2)) return;
    const doUninstall = async (deleteDataDir: boolean) => {
      setIsProcessing(true);
      setProcessError(null);
      try {
        const result_3 = await uninstallPluginOp(pluginId_9, pluginScope_2, deleteDataDir);
        if (!result_3.success) throw new Error(result_3.message);
        clearAllCaches();
        const suffix = deleteDataDir ? '' : ' · data preserved';
        setResult(`${figures.tick} ${result_3.message}${suffix}`);
        if (onManageComplete) void onManageComplete();
        setParentViewState({
          type: 'menu'
        });
      } catch (e_0) {
        setIsProcessing(false);
        setProcessError(e_0 instanceof Error ? e_0.message : String(e_0));
      }
    };
    if (input === 'y' || input === 'Y') {
      void doUninstall(true);
    } else if (input === 'n' || input === 'N') {
      void doUninstall(false);
    } else if (key.escape) {
      setViewState('plugin-details');
      setProcessError(null);
    }
  }, {
    isActive: typeof viewState === 'object' && viewState.type === 'confirm-data-cleanup' && !!selectedPlugin && !isProcessing
  });

  // Reset selection when search query changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Handle input for entering search mode (text input handled by useSearchInput hook)
  // eslint-disable-next-line custom-rules/prefer-use-keybindings -- useInput needed for raw search mode text input
  useInput((input_0, key_0) => {
    const keyIsNotCtrlOrMeta = !key_0.ctrl && !key_0.meta;
    if (isSearchMode) {
      // Text input is handled by useSearchInput hook
      return;
    }

    // Enter search mode with '/' or any printable character (except navigation keys)
    if (input_0 === '/' && keyIsNotCtrlOrMeta) {
      setIsSearchMode(true);
      setSearchQuery('');
      setSelectedIndex(0);
    } else if (keyIsNotCtrlOrMeta && input_0.length > 0 && !/^\s+$/.test(input_0) && input_0 !== 'j' && input_0 !== 'k' && input_0 !== ' ') {
      setIsSearchMode(true);
      setSearchQuery(input_0);
      setSelectedIndex(0);
    }
  }, {
    isActive: viewState === 'plugin-list'
  });

  // Loading state
  if (loading) {
    return <Text>Loading installed plugins…</Text>;
  }

  // No plugins or MCPs installed
  if (unifiedItems.length === 0) {
    return <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Manage plugins</Text>
        </Box>
        <Text>No plugins or MCP servers installed.</Text>
        <Box marginTop={1}>
          <Text dimColor>Esc to go back</Text>
        </Box>
      </Box>;
  }
  if (typeof viewState === 'object' && viewState.type === 'plugin-options' && selectedPlugin) {
    const pluginId_10 = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
    function finish(msg: string): void {
      setResult(msg);
      // Plugin is enabled regardless of whether config was saved or
      // skipped — onManageComplete → markPluginsChanged → the
      // persistent "run /reload-plugins" notice.
      if (onManageComplete) {
        void onManageComplete();
      }
      setParentViewState({
        type: 'menu'
      });
    }
    return <PluginOptionsFlow plugin={selectedPlugin.plugin} pluginId={pluginId_10} onDone={(outcome, detail) => {
      switch (outcome) {
        case 'configured':
          finish(`✓ Enabled and configured ${selectedPlugin.plugin.name}. Run /reload-plugins to apply.`);
          break;
        case 'skipped':
          finish(`✓ Enabled ${selectedPlugin.plugin.name}. Run /reload-plugins to apply.`);
          break;
        case 'error':
          finish(`Failed to save configuration: ${detail}`);
          break;
      }
    }} />;
  }

  // Configure options (from the Manage menu)
  if (typeof viewState === 'object' && viewState.type === 'configuring-options' && selectedPlugin) {
    const pluginId_11 = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
    return <PluginOptionsDialog title={`Configure ${selectedPlugin.plugin.name}`} subtitle="Plugin options" configSchema={viewState.schema} initialValues={loadPluginOptions(pluginId_11)} onSave={values => {
      try {
        savePluginOptions(pluginId_11, values, viewState.schema);
        clearAllCaches();
        setResult('Configuration saved. Run /reload-plugins for changes to take effect.');
      } catch (err_3) {
        setProcessError(`Failed to save configuration: ${errorMessage(err_3)}`);
      }
      setViewState('plugin-details');
    }} onCancel={() => setViewState('plugin-details')} />;
  }

  // Configuration view
  if (viewState === 'configuring' && configNeeded && selectedPlugin) {
    const pluginId_12 = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
    async function handleSave(config: UserConfigValues) {
      if (!configNeeded || !selectedPlugin) return;
      try {
        // Find MCPB path again
        const mcpServersSpec_1 = selectedPlugin.plugin.manifest.mcpServers;
        let mcpbPath_0: string | null = null;
        if (typeof mcpServersSpec_1 === 'string' && isMcpbSource(mcpServersSpec_1)) {
          mcpbPath_0 = mcpServersSpec_1;
        } else if (Array.isArray(mcpServersSpec_1)) {
          for (const spec_1 of mcpServersSpec_1) {
            if (typeof spec_1 === 'string' && isMcpbSource(spec_1)) {
              mcpbPath_0 = spec_1;
              break;
            }
          }
        }
        if (!mcpbPath_0) {
          setProcessError('No MCPB file found');
          setViewState('plugin-details');
          return;
        }

        // Reload with provided config
        await loadMcpbFile(mcpbPath_0, selectedPlugin.plugin.path, pluginId_12, undefined, config);

        // Success - go back to details
        setProcessError(null);
        setConfigNeeded(null);
        setViewState('plugin-details');
        setResult('Configuration saved. Run /reload-plugins for changes to take effect.');
      } catch (err_4) {
        const errorMsg_0 = errorMessage(err_4);
        setProcessError(`Failed to save configuration: ${errorMsg_0}`);
        setViewState('plugin-details');
      }
    }
    function handleCancel() {
      setConfigNeeded(null);
      setViewState('plugin-details');
    }
    return <PluginOptionsDialog title={`Configure ${configNeeded.manifest.name}`} subtitle={`Plugin: ${selectedPlugin.plugin.name}`} configSchema={configNeeded.configSchema} initialValues={configNeeded.existingConfig} onSave={handleSave} onCancel={handleCancel} />;
  }

  // Flagged plugin detail view
  if (typeof viewState === 'object' && viewState.type === 'flagged-detail') {
    const fp = viewState.plugin;
    return <Box flexDirection="column">
        <Box>
          <Text bold>
            {fp.name} @ {fp.marketplace}
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>Status: </Text>
          <Text color="error">Removed</Text>
        </Box>

        <Box marginBottom={1} flexDirection="column">
          <Text color="error">
            Removed from marketplace · reason: {fp.reason}
          </Text>
          <Text>{fp.text}</Text>
          <Text dimColor>
            Flagged on {new Date(fp.flaggedAt).toLocaleDateString()}
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text>{figures.pointer} </Text>
            <Text color="suggestion">Dismiss</Text>
          </Box>
        </Box>

        <Byline>
          <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="dismiss" />
          <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
        </Byline>
      </Box>;
  }

  // Confirm-project-uninstall: warn about shared .claude/settings.json,
  // offer to disable in settings.local.json instead.
  if (viewState === 'confirm-project-uninstall' && selectedPlugin) {
    return <Box flexDirection="column">
        <Text bold color="warning">
          {selectedPlugin.plugin.name} is enabled in .claude/settings.json
          (shared with your team)
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Disable it just for you in .claude/settings.local.json?</Text>
          <Text dimColor>
            This has the same effect as uninstalling, without affecting other
            contributors.
          </Text>
        </Box>
        {processError && <Box marginTop={1}>
            <Text color="error">{processError}</Text>
          </Box>}
        <Box marginTop={1}>
          {isProcessing ? <Text dimColor>Disabling…</Text> : <Byline>
              <ConfigurableShortcutHint action="confirm:yes" context="Confirmation" fallback="y" description="disable" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />
            </Byline>}
        </Box>
      </Box>;
  }

  // Confirm-data-cleanup: prompt before deleting ${CLAUDE_PLUGIN_DATA} dir
  if (typeof viewState === 'object' && viewState.type === 'confirm-data-cleanup' && selectedPlugin) {
    return <Box flexDirection="column">
        <Text bold>
          {selectedPlugin.plugin.name} has {viewState.size.human} of persistent
          data
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Delete it along with the plugin?</Text>
          <Text dimColor>
            {pluginDataDirPath(`${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`)}
          </Text>
        </Box>
        {processError && <Box marginTop={1}>
            <Text color="error">{processError}</Text>
          </Box>}
        <Box marginTop={1}>
          {isProcessing ? <Text dimColor>Uninstalling…</Text> : <Text>
              <Text bold>y</Text> to delete · <Text bold>n</Text> to keep ·{' '}
              <Text bold>esc</Text> to cancel
            </Text>}
        </Box>
      </Box>;
  }

  // Plugin details view
  if (viewState === 'plugin-details' && selectedPlugin) {
    const mergedSettings_2 = getSettings_DEPRECATED(); // Use merged settings to respect all layers
    const pluginId_13 = `${selectedPlugin.plugin.name}@${selectedPlugin.marketplace}`;
    const isEnabled_2 = mergedSettings_2?.enabledPlugins?.[pluginId_13] !== false;

    // Compute plugin errors section
    const filteredPluginErrors = pluginErrors.filter(e_1 => 'plugin' in e_1 && e_1.plugin === selectedPlugin.plugin.name || e_1.source === pluginId_13 || e_1.source.startsWith(`${selectedPlugin.plugin.name}@`));
    const pluginErrorsSection = filteredPluginErrors.length === 0 ? null : <Box flexDirection="column" marginBottom={1}>
          <Text bold color="error">
            {filteredPluginErrors.length}{' '}
            {plural(filteredPluginErrors.length, 'error')}:
          </Text>
          {filteredPluginErrors.map((error_3, i_0) => {
        const guidance = getErrorGuidance(error_3);
        return <Box key={i_0} flexDirection="column" marginLeft={2}>
                <Text color="error">{formatErrorMessage(error_3)}</Text>
                {guidance && <Text dimColor italic>
                    {figures.arrowRight} {guidance}
                  </Text>}
              </Box>;
      })}
        </Box>;
    return <Box flexDirection="column">
        <Box>
          <Text bold>
            {selectedPlugin.plugin.name} @ {selectedPlugin.marketplace}
          </Text>
        </Box>

        {/* Scope */}
        <Box>
          <Text dimColor>Scope: </Text>
          <Text>{selectedPlugin.scope || 'user'}</Text>
        </Box>

        {/* Plugin details */}
        {selectedPlugin.plugin.manifest.version && <Box>
            <Text dimColor>Version: </Text>
            <Text>{selectedPlugin.plugin.manifest.version}</Text>
          </Box>}

        {selectedPlugin.plugin.manifest.description && <Box marginBottom={1}>
            <Text>{selectedPlugin.plugin.manifest.description}</Text>
          </Box>}

        {selectedPlugin.plugin.manifest.author && <Box>
            <Text dimColor>Author: </Text>
            <Text>{selectedPlugin.plugin.manifest.author.name}</Text>
          </Box>}

        {/* Current status */}
        <Box marginBottom={1}>
          <Text dimColor>Status: </Text>
          <Text color={isEnabled_2 ? 'success' : 'warning'}>
            {isEnabled_2 ? 'Enabled' : 'Disabled'}
          </Text>
          {selectedPlugin.pendingUpdate && <Text color="suggestion"> · Marked for update</Text>}
        </Box>

        {/* Installed components */}
        <PluginComponentsDisplay plugin={selectedPlugin.plugin} marketplace={selectedPlugin.marketplace} />

        {/* Plugin errors */}
        {pluginErrorsSection}

        {/* Menu */}
        <Box marginTop={1} flexDirection="column">
          {detailsMenuItems.map((item_9, index_0) => {
          const isSelected = index_0 === detailsMenuIndex;
          return <Box key={index_0}>
                {isSelected && <Text>{figures.pointer} </Text>}
                {!isSelected && <Text>{'  '}</Text>}
                <Text bold={isSelected} color={item_9.label.includes('Uninstall') ? 'error' : item_9.label.includes('Update') ? 'suggestion' : undefined}>
                  {item_9.label}
                </Text>
              </Box>;
        })}
        </Box>

        {/* Processing state */}
        {isProcessing && <Box marginTop={1}>
            <Text>Processing…</Text>
          </Box>}

        {/* Error message */}
        {processError && <Box marginTop={1}>
            <Text color="error">{processError}</Text>
          </Box>}

        <Box marginTop={1}>
          <Text dimColor italic>
            <Byline>
              <ConfigurableShortcutHint action="select:previous" context="Select" fallback="↑" description="navigate" />
              <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="select" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
            </Byline>
          </Text>
        </Box>
      </Box>;
  }

  // Failed plugin detail view
  if (typeof viewState === 'object' && viewState.type === 'failed-plugin-details') {
    const failedPlugin_0 = viewState.plugin;
    const firstError = failedPlugin_0.errors[0];
    const errorMessage_0 = firstError ? formatErrorMessage(firstError) : 'Failed to load';
    return <Box flexDirection="column">
        <Text>
          <Text bold>{failedPlugin_0.name}</Text>
          <Text dimColor> @ {failedPlugin_0.marketplace}</Text>
          <Text dimColor> ({failedPlugin_0.scope})</Text>
        </Text>
        <Text color="error">{errorMessage_0}</Text>

        {failedPlugin_0.scope === 'managed' ? <Box marginTop={1}>
            <Text dimColor>
              Managed by your organization — contact your admin
            </Text>
          </Box> : <Box marginTop={1}>
            <Text color="suggestion">{figures.pointer} </Text>
            <Text bold>Remove</Text>
          </Box>}

        {isProcessing && <Text>Processing…</Text>}
        {processError && <Text color="error">{processError}</Text>}

        <Box marginTop={1}>
          <Text dimColor italic>
            <Byline>
              {failedPlugin_0.scope !== 'managed' && <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="remove" />}
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
            </Byline>
          </Text>
        </Box>
      </Box>;
  }

  // MCP detail view
  if (typeof viewState === 'object' && viewState.type === 'mcp-detail') {
    const client_3 = viewState.client;
    const serverToolsCount = filterToolsByServer(mcpTools, client_3.name).length;

    // Common handlers for MCP menus
    const handleMcpViewTools = () => {
      setViewState({
        type: 'mcp-tools',
        client: client_3
      });
    };
    const handleMcpCancel = () => {
      setViewState('plugin-list');
    };
    const handleMcpComplete = (result_4?: string) => {
      if (result_4) {
        setResult(result_4);
      }
      setViewState('plugin-list');
    };

    // Transform MCPServerConnection to appropriate ServerInfo type
    const scope_5 = client_3.config.scope;
    const configType = client_3.config.type;
    if (configType === 'stdio') {
      const server: StdioServerInfo = {
        name: client_3.name,
        client: client_3,
        scope: scope_5,
        transport: 'stdio',
        config: client_3.config as McpStdioServerConfig
      };
      return <MCPStdioServerMenu server={server} serverToolsCount={serverToolsCount} onViewTools={handleMcpViewTools} onCancel={handleMcpCancel} onComplete={handleMcpComplete} borderless />;
    } else if (configType === 'sse') {
      const server_0: SSEServerInfo = {
        name: client_3.name,
        client: client_3,
        scope: scope_5,
        transport: 'sse',
        isAuthenticated: undefined,
        config: client_3.config as McpSSEServerConfig
      };
      return <MCPRemoteServerMenu server={server_0} serverToolsCount={serverToolsCount} onViewTools={handleMcpViewTools} onCancel={handleMcpCancel} onComplete={handleMcpComplete} borderless />;
    } else if (configType === 'http') {
      const server_1: HTTPServerInfo = {
        name: client_3.name,
        client: client_3,
        scope: scope_5,
        transport: 'http',
        isAuthenticated: undefined,
        config: client_3.config as McpHTTPServerConfig
      };
      return <MCPRemoteServerMenu server={server_1} serverToolsCount={serverToolsCount} onViewTools={handleMcpViewTools} onCancel={handleMcpCancel} onComplete={handleMcpComplete} borderless />;
    } else if (configType === 'claudeai-proxy') {
      const server_2: ClaudeAIServerInfo = {
        name: client_3.name,
        client: client_3,
        scope: scope_5,
        transport: 'claudeai-proxy',
        isAuthenticated: undefined,
        config: client_3.config as McpClaudeAIProxyServerConfig
      };
      return <MCPRemoteServerMenu server={server_2} serverToolsCount={serverToolsCount} onViewTools={handleMcpViewTools} onCancel={handleMcpCancel} onComplete={handleMcpComplete} borderless />;
    }

    // Fallback - shouldn't happen but handle gracefully
    setViewState('plugin-list');
    return null;
  }

  // MCP tools view
  if (typeof viewState === 'object' && viewState.type === 'mcp-tools') {
    const client_4 = viewState.client;
    const scope_6 = client_4.config.scope;
    const configType_0 = client_4.config.type;

    // Build ServerInfo for MCPToolListView
    let server_3: StdioServerInfo | SSEServerInfo | HTTPServerInfo | ClaudeAIServerInfo;
    if (configType_0 === 'stdio') {
      server_3 = {
        name: client_4.name,
        client: client_4,
        scope: scope_6,
        transport: 'stdio',
        config: client_4.config as McpStdioServerConfig
      };
    } else if (configType_0 === 'sse') {
      server_3 = {
        name: client_4.name,
        client: client_4,
        scope: scope_6,
        transport: 'sse',
        isAuthenticated: undefined,
        config: client_4.config as McpSSEServerConfig
      };
    } else if (configType_0 === 'http') {
      server_3 = {
        name: client_4.name,
        client: client_4,
        scope: scope_6,
        transport: 'http',
        isAuthenticated: undefined,
        config: client_4.config as McpHTTPServerConfig
      };
    } else {
      server_3 = {
        name: client_4.name,
        client: client_4,
        scope: scope_6,
        transport: 'claudeai-proxy',
        isAuthenticated: undefined,
        config: client_4.config as McpClaudeAIProxyServerConfig
      };
    }
    return <MCPToolListView server={server_3} onSelectTool={(tool: Tool) => {
      setViewState({
        type: 'mcp-tool-detail',
        client: client_4,
        tool
      });
    }} onBack={() => setViewState({
      type: 'mcp-detail',
      client: client_4
    })} />;
  }

  // MCP tool detail view
  if (typeof viewState === 'object' && viewState.type === 'mcp-tool-detail') {
    const {
      client: client_5,
      tool: tool_0
    } = viewState;
    const scope_7 = client_5.config.scope;
    const configType_1 = client_5.config.type;

    // Build ServerInfo for MCPToolDetailView
    let server_4: StdioServerInfo | SSEServerInfo | HTTPServerInfo | ClaudeAIServerInfo;
    if (configType_1 === 'stdio') {
      server_4 = {
        name: client_5.name,
        client: client_5,
        scope: scope_7,
        transport: 'stdio',
        config: client_5.config as McpStdioServerConfig
      };
    } else if (configType_1 === 'sse') {
      server_4 = {
        name: client_5.name,
        client: client_5,
        scope: scope_7,
        transport: 'sse',
        isAuthenticated: undefined,
        config: client_5.config as McpSSEServerConfig
      };
    } else if (configType_1 === 'http') {
      server_4 = {
        name: client_5.name,
        client: client_5,
        scope: scope_7,
        transport: 'http',
        isAuthenticated: undefined,
        config: client_5.config as McpHTTPServerConfig
      };
    } else {
      server_4 = {
        name: client_5.name,
        client: client_5,
        scope: scope_7,
        transport: 'claudeai-proxy',
        isAuthenticated: undefined,
        config: client_5.config as McpClaudeAIProxyServerConfig
      };
    }
    return <MCPToolDetailView tool={tool_0} server={server_4} onBack={() => setViewState({
      type: 'mcp-tools',
      client: client_5
    })} />;
  }

  // Plugin list view (main management interface)
  const visibleItems = pagination.getVisibleItems(filteredItems);
  return <Box flexDirection="column">
      {/* Search box */}
      <Box marginBottom={1}>
        <SearchBox query={searchQuery} isFocused={isSearchMode} isTerminalFocused={isTerminalFocused} width={terminalWidth - 4} cursorOffset={searchCursorOffset} />
      </Box>

      {/* No search results */}
      {filteredItems.length === 0 && searchQuery && <Box marginBottom={1}>
          <Text dimColor>No items match &quot;{searchQuery}&quot;</Text>
        </Box>}

      {/* Scroll up indicator */}
      {pagination.scrollPosition.canScrollUp && <Box>
          <Text dimColor> {figures.arrowUp} more above</Text>
        </Box>}

      {/* Unified list of plugins and MCPs grouped by scope */}
      {visibleItems.map((item_10, visibleIndex) => {
      const actualIndex = pagination.toActualIndex(visibleIndex);
      const isSelected_0 = actualIndex === selectedIndex && !isSearchMode;

      // Check if we need to show a scope header
      const prevItem = visibleIndex > 0 ? visibleItems[visibleIndex - 1] : null;
      const showScopeHeader = !prevItem || prevItem.scope !== item_10.scope;

      // Get scope label
      const getScopeLabel = (scope_8: string): string => {
        switch (scope_8) {
          case 'flagged':
            return 'Flagged';
          case 'project':
            return 'Project';
          case 'local':
            return 'Local';
          case 'user':
            return 'User';
          case 'enterprise':
            return 'Enterprise';
          case 'managed':
            return 'Managed';
          case 'builtin':
            return 'Built-in';
          case 'dynamic':
            return 'Built-in';
          default:
            return scope_8;
        }
      };
      return <React.Fragment key={item_10.id}>
            {showScopeHeader && <Box marginTop={visibleIndex > 0 ? 1 : 0} paddingLeft={2}>
                <Text dimColor={item_10.scope !== 'flagged'} color={item_10.scope === 'flagged' ? 'warning' : undefined} bold={item_10.scope === 'flagged'}>
                  {getScopeLabel(item_10.scope)}
                </Text>
              </Box>}
            <UnifiedInstalledCell item={item_10} isSelected={isSelected_0} />
          </React.Fragment>;
    })}

      {/* Scroll down indicator */}
      {pagination.scrollPosition.canScrollDown && <Box>
          <Text dimColor> {figures.arrowDown} more below</Text>
        </Box>}

      {/* Help text */}
      <Box marginTop={1} marginLeft={1}>
        <Text dimColor italic>
          <Byline>
            <Text>type to search</Text>
            <ConfigurableShortcutHint action="plugin:toggle" context="Plugin" fallback="Space" description="toggle" />
            <ConfigurableShortcutHint action="select:accept" context="Select" fallback="Enter" description="details" />
            <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
          </Byline>
        </Text>
      </Box>

      {/* Reload disclaimer for plugin changes */}
      {pendingToggles.size > 0 && <Box marginLeft={1}>
          <Text dimColor italic>
            Run /reload-plugins to apply changes
          </Text>
        </Box>}
    </Box>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiRGlyZW50IiwiZnMiLCJwYXRoIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsIkNvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCIsIkJ5bGluZSIsIk1DUFJlbW90ZVNlcnZlck1lbnUiLCJNQ1BTdGRpb1NlcnZlck1lbnUiLCJNQ1BUb29sRGV0YWlsVmlldyIsIk1DUFRvb2xMaXN0VmlldyIsIkNsYXVkZUFJU2VydmVySW5mbyIsIkhUVFBTZXJ2ZXJJbmZvIiwiU1NFU2VydmVySW5mbyIsIlN0ZGlvU2VydmVySW5mbyIsIlNlYXJjaEJveCIsInVzZVNlYXJjaElucHV0IiwidXNlVGVybWluYWxTaXplIiwiQm94IiwiVGV4dCIsInVzZUlucHV0IiwidXNlVGVybWluYWxGb2N1cyIsInVzZUtleWJpbmRpbmciLCJ1c2VLZXliaW5kaW5ncyIsImdldEJ1aWx0aW5QbHVnaW5EZWZpbml0aW9uIiwidXNlTWNwVG9nZ2xlRW5hYmxlZCIsIk1DUFNlcnZlckNvbm5lY3Rpb24iLCJNY3BDbGF1ZGVBSVByb3h5U2VydmVyQ29uZmlnIiwiTWNwSFRUUFNlcnZlckNvbmZpZyIsIk1jcFNTRVNlcnZlckNvbmZpZyIsIk1jcFN0ZGlvU2VydmVyQ29uZmlnIiwiZmlsdGVyVG9vbHNCeVNlcnZlciIsImRpc2FibGVQbHVnaW5PcCIsImVuYWJsZVBsdWdpbk9wIiwiZ2V0UGx1Z2luSW5zdGFsbGF0aW9uRnJvbVYyIiwiaXNJbnN0YWxsYWJsZVNjb3BlIiwiaXNQbHVnaW5FbmFibGVkQXRQcm9qZWN0U2NvcGUiLCJ1bmluc3RhbGxQbHVnaW5PcCIsInVwZGF0ZVBsdWdpbk9wIiwidXNlQXBwU3RhdGUiLCJUb29sIiwiTG9hZGVkUGx1Z2luIiwiUGx1Z2luRXJyb3IiLCJjb3VudCIsIm9wZW5Ccm93c2VyIiwibG9nRm9yRGVidWdnaW5nIiwiZXJyb3JNZXNzYWdlIiwidG9FcnJvciIsImxvZ0Vycm9yIiwiY2xlYXJBbGxDYWNoZXMiLCJsb2FkSW5zdGFsbGVkUGx1Z2luc1YyIiwiZ2V0TWFya2V0cGxhY2UiLCJpc01jcGJTb3VyY2UiLCJsb2FkTWNwYkZpbGUiLCJNY3BiTmVlZHNDb25maWdSZXN1bHQiLCJVc2VyQ29uZmlnVmFsdWVzIiwiZ2V0UGx1Z2luRGF0YURpclNpemUiLCJwbHVnaW5EYXRhRGlyUGF0aCIsImdldEZsYWdnZWRQbHVnaW5zIiwibWFya0ZsYWdnZWRQbHVnaW5zU2VlbiIsInJlbW92ZUZsYWdnZWRQbHVnaW4iLCJQZXJzaXN0YWJsZVBsdWdpblNjb3BlIiwicGFyc2VQbHVnaW5JZGVudGlmaWVyIiwibG9hZEFsbFBsdWdpbnMiLCJsb2FkUGx1Z2luT3B0aW9ucyIsIlBsdWdpbk9wdGlvblNjaGVtYSIsInNhdmVQbHVnaW5PcHRpb25zIiwiaXNQbHVnaW5CbG9ja2VkQnlQb2xpY3kiLCJnZXRQbHVnaW5FZGl0YWJsZVNjb3BlcyIsImdldFNldHRpbmdzX0RFUFJFQ0FURUQiLCJnZXRTZXR0aW5nc0ZvclNvdXJjZSIsInVwZGF0ZVNldHRpbmdzRm9yU291cmNlIiwianNvblBhcnNlIiwicGx1cmFsIiwiZm9ybWF0RXJyb3JNZXNzYWdlIiwiZ2V0RXJyb3JHdWlkYW5jZSIsIlBsdWdpbk9wdGlvbnNEaWFsb2ciLCJQbHVnaW5PcHRpb25zRmxvdyIsIlZpZXdTdGF0ZSIsIlBhcmVudFZpZXdTdGF0ZSIsIlVuaWZpZWRJbnN0YWxsZWRDZWxsIiwiVW5pZmllZEluc3RhbGxlZEl0ZW0iLCJ1c2VQYWdpbmF0aW9uIiwiUHJvcHMiLCJzZXRWaWV3U3RhdGUiLCJzdGF0ZSIsInNldFJlc3VsdCIsInJlc3VsdCIsIm9uTWFuYWdlQ29tcGxldGUiLCJQcm9taXNlIiwib25TZWFyY2hNb2RlQ2hhbmdlIiwiaXNBY3RpdmUiLCJ0YXJnZXRQbHVnaW4iLCJ0YXJnZXRNYXJrZXRwbGFjZSIsImFjdGlvbiIsIkZsYWdnZWRQbHVnaW5JbmZvIiwiaWQiLCJuYW1lIiwibWFya2V0cGxhY2UiLCJyZWFzb24iLCJ0ZXh0IiwiZmxhZ2dlZEF0IiwiRmFpbGVkUGx1Z2luSW5mbyIsImVycm9ycyIsInNjb3BlIiwidHlwZSIsInNjaGVtYSIsInNpemUiLCJieXRlcyIsImh1bWFuIiwicGx1Z2luIiwiY2xpZW50IiwidG9vbCIsIk1hcmtldHBsYWNlSW5mbyIsImluc3RhbGxlZFBsdWdpbnMiLCJlbmFibGVkQ291bnQiLCJkaXNhYmxlZENvdW50IiwiUGx1Z2luU3RhdGUiLCJwZW5kaW5nRW5hYmxlIiwicGVuZGluZ1VwZGF0ZSIsImdldEJhc2VGaWxlTmFtZXMiLCJkaXJQYXRoIiwiZW50cmllcyIsInJlYWRkaXIiLCJ3aXRoRmlsZVR5cGVzIiwiZmlsdGVyIiwiZW50cnkiLCJpc0ZpbGUiLCJlbmRzV2l0aCIsIm1hcCIsImJhc2VOYW1lIiwiYmFzZW5hbWUiLCJlcnJvciIsImVycm9yTXNnIiwibGV2ZWwiLCJnZXRTa2lsbERpck5hbWVzIiwic2tpbGxOYW1lcyIsImlzRGlyZWN0b3J5IiwiaXNTeW1ib2xpY0xpbmsiLCJza2lsbEZpbGVQYXRoIiwiam9pbiIsInN0Iiwic3RhdCIsInB1c2giLCJQbHVnaW5Db21wb25lbnRzRGlzcGxheSIsIlJlYWN0Tm9kZSIsImNvbXBvbmVudHMiLCJzZXRDb21wb25lbnRzIiwiY29tbWFuZHMiLCJSZWNvcmQiLCJhZ2VudHMiLCJza2lsbHMiLCJob29rcyIsIm1jcFNlcnZlcnMiLCJsb2FkaW5nIiwic2V0TG9hZGluZyIsInNldEVycm9yIiwibG9hZENvbXBvbmVudHMiLCJidWlsdGluRGVmIiwicyIsImhvb2tFdmVudHMiLCJPYmplY3QiLCJrZXlzIiwibWNwU2VydmVyTmFtZXMiLCJsZW5ndGgiLCJtYXJrZXRwbGFjZURhdGEiLCJwbHVnaW5FbnRyeSIsInBsdWdpbnMiLCJmaW5kIiwicCIsImNvbW1hbmRQYXRoTGlzdCIsImNvbW1hbmRzUGF0aCIsImNvbW1hbmRzUGF0aHMiLCJjb21tYW5kTGlzdCIsImNvbW1hbmRQYXRoIiwiYmFzZU5hbWVzIiwiYWdlbnRQYXRoTGlzdCIsImFnZW50c1BhdGgiLCJhZ2VudHNQYXRocyIsImFnZW50TGlzdCIsImFnZW50UGF0aCIsInNraWxsUGF0aExpc3QiLCJza2lsbHNQYXRoIiwic2tpbGxzUGF0aHMiLCJza2lsbExpc3QiLCJza2lsbFBhdGgiLCJza2lsbERpck5hbWVzIiwiaG9va3NMaXN0IiwiaG9va3NDb25maWciLCJtY3BTZXJ2ZXJzTGlzdCIsImVyciIsIkVycm9yIiwibWVzc2FnZSIsImhhc0NvbXBvbmVudHMiLCJBcnJheSIsImlzQXJyYXkiLCJTdHJpbmciLCJjaGVja0lmTG9jYWxQbHVnaW4iLCJwbHVnaW5OYW1lIiwibWFya2V0cGxhY2VOYW1lIiwic291cmNlIiwiZmlsdGVyTWFuYWdlZERpc2FibGVkUGx1Z2lucyIsInNwbGl0IiwiTWFuYWdlUGx1Z2lucyIsInNldFBhcmVudFZpZXdTdGF0ZSIsIm1jcENsaWVudHMiLCJtY3AiLCJjbGllbnRzIiwibWNwVG9vbHMiLCJ0b29scyIsInBsdWdpbkVycm9ycyIsImZsYWdnZWRQbHVnaW5zIiwiaXNTZWFyY2hNb2RlIiwic2V0SXNTZWFyY2hNb2RlUmF3Iiwic2V0SXNTZWFyY2hNb2RlIiwiYWN0aXZlIiwiaXNUZXJtaW5hbEZvY3VzZWQiLCJjb2x1bW5zIiwidGVybWluYWxXaWR0aCIsInZpZXdTdGF0ZSIsInF1ZXJ5Iiwic2VhcmNoUXVlcnkiLCJzZXRRdWVyeSIsInNldFNlYXJjaFF1ZXJ5IiwiY3Vyc29yT2Zmc2V0Iiwic2VhcmNoQ3Vyc29yT2Zmc2V0Iiwib25FeGl0Iiwic2VsZWN0ZWRQbHVnaW4iLCJzZXRTZWxlY3RlZFBsdWdpbiIsIm1hcmtldHBsYWNlcyIsInNldE1hcmtldHBsYWNlcyIsInBsdWdpblN0YXRlcyIsInNldFBsdWdpblN0YXRlcyIsInBlbmRpbmdUb2dnbGVzIiwic2V0UGVuZGluZ1RvZ2dsZXMiLCJNYXAiLCJoYXNBdXRvTmF2aWdhdGVkIiwicGVuZGluZ0F1dG9BY3Rpb25SZWYiLCJ1bmRlZmluZWQiLCJ0b2dnbGVNY3BTZXJ2ZXIiLCJoYW5kbGVCYWNrIiwic2V0UHJvY2Vzc0Vycm9yIiwic2V0Q29uZmlnTmVlZGVkIiwiY29udGV4dCIsImdldE1jcFN0YXR1cyIsInVuaWZpZWRJdGVtcyIsIm1lcmdlZFNldHRpbmdzIiwicGx1Z2luTWNwTWFwIiwiZGlzcGxheU5hbWUiLCJzdGFydHNXaXRoIiwicGFydHMiLCJzZXJ2ZXJOYW1lIiwic2xpY2UiLCJleGlzdGluZyIsImdldCIsInNldCIsIlBsdWdpbldpdGhDaGlsZHJlbiIsIml0ZW0iLCJvcmlnaW5hbFNjb3BlIiwiY2hpbGRNY3BzIiwicGx1Z2luc1dpdGhDaGlsZHJlbiIsInBsdWdpbklkIiwiaXNFbmFibGVkIiwiZW5hYmxlZFBsdWdpbnMiLCJlIiwiaXNCdWlsdGluIiwiZGVzY3JpcHRpb24iLCJtYW5pZmVzdCIsImVycm9yQ291bnQiLCJwZW5kaW5nVG9nZ2xlIiwibWF0Y2hlZFBsdWdpbklkcyIsIlNldCIsIm1hdGNoZWRQbHVnaW5OYW1lcyIsIm9ycGhhbkVycm9yc0J5U291cmNlIiwiaGFzIiwicGx1Z2luU2NvcGVzIiwiZmFpbGVkUGx1Z2luSXRlbXMiLCJwYXJzZWQiLCJyYXdTY29wZSIsInN0YW5kYWxvbmVNY3BzIiwiY29uZmlnIiwic3RhdHVzIiwic2NvcGVPcmRlciIsImZsYWdnZWQiLCJwcm9qZWN0IiwibG9jYWwiLCJ1c2VyIiwiZW50ZXJwcmlzZSIsIm1hbmFnZWQiLCJkeW5hbWljIiwiYnVpbHRpbiIsInVuaWZpZWQiLCJpdGVtc0J5U2NvcGUiLCJkaXNwbGF5U2NvcGUiLCJpbmRlbnRlZCIsImZhaWxlZFBsdWdpbiIsInNvcnRlZFNjb3BlcyIsInNvcnQiLCJhIiwiYiIsIml0ZW1zIiwicGx1Z2luR3JvdXBzIiwic3RhbmRhbG9uZU1jcHNJblNjb3BlIiwiaSIsImdyb3VwIiwibmV4dEl0ZW0iLCJsb2NhbGVDb21wYXJlIiwiZmxhZ2dlZElkcyIsImZpbHRlcmVkSXRlbXMiLCJsb3dlclF1ZXJ5IiwidG9Mb3dlckNhc2UiLCJpbmNsdWRlcyIsInNlbGVjdGVkSW5kZXgiLCJzZXRTZWxlY3RlZEluZGV4IiwicGFnaW5hdGlvbiIsInRvdGFsSXRlbXMiLCJtYXhWaXNpYmxlIiwiZGV0YWlsc01lbnVJbmRleCIsInNldERldGFpbHNNZW51SW5kZXgiLCJpc1Byb2Nlc3NpbmciLCJzZXRJc1Byb2Nlc3NpbmciLCJwcm9jZXNzRXJyb3IiLCJjb25maWdOZWVkZWQiLCJfaXNMb2FkaW5nQ29uZmlnIiwic2V0SXNMb2FkaW5nQ29uZmlnIiwic2VsZWN0ZWRQbHVnaW5IYXNNY3BiIiwic2V0U2VsZWN0ZWRQbHVnaW5IYXNNY3BiIiwiZGV0ZWN0TWNwYiIsIm1jcFNlcnZlcnNTcGVjIiwiaGFzTWNwYiIsInNvbWUiLCJtYXJrZXRwbGFjZURpciIsIm1hcmtldHBsYWNlSnNvblBhdGgiLCJjb250ZW50IiwicmVhZEZpbGUiLCJzcGVjIiwibG9hZEluc3RhbGxlZFBsdWdpbnMiLCJlbmFibGVkIiwiZGlzYWJsZWQiLCJhbGxQbHVnaW5zIiwicGx1Z2luc0J5TWFya2V0cGxhY2UiLCJtYXJrZXRwbGFjZUluZm9zIiwiYWxsU3RhdGVzIiwiY3VycmVudCIsInRhcmdldE5hbWUiLCJ0YXJnZXRNa3RGcm9tSWQiLCJlZmZlY3RpdmVUYXJnZXRNYXJrZXRwbGFjZSIsIm1hcmtldHBsYWNlc1RvU2VhcmNoIiwibSIsInBsdWdpblN0YXRlIiwiZmFpbGVkSXRlbSIsImhhbmRsZVNpbmdsZU9wZXJhdGlvbiIsIm9wZXJhdGlvbiIsInBsdWdpblNjb3BlIiwicmV2ZXJzZURlcGVuZGVudHMiLCJlbmFibGVSZXN1bHQiLCJzdWNjZXNzIiwiZGlzYWJsZVJlc3VsdCIsImluc3RhbGxzIiwiaXNMYXN0U2NvcGUiLCJkYXRhU2l6ZSIsImFscmVhZHlVcFRvRGF0ZSIsIm5ld1ZlcnNpb24iLCJwbHVnaW5JZE5vdyIsInNldHRpbmdzQWZ0ZXIiLCJlbmFibGVkQWZ0ZXIiLCJvcGVyYXRpb25OYW1lIiwiZGVwV2FybiIsImhhbmRsZVNpbmdsZU9wZXJhdGlvblJlZiIsInBlbmRpbmciLCJoYW5kbGVUb2dnbGUiLCJjdXJyZW50UGVuZGluZyIsIm5ld1BlbmRpbmciLCJkZWxldGUiLCJoYW5kbGVBY2NlcHQiLCJzZWxlY3Q6cHJldmlvdXMiLCJoYW5kbGVTZWxlY3Rpb25DaGFuZ2UiLCJzZWxlY3Q6bmV4dCIsImhhbmRsZUZsYWdnZWREaXNtaXNzIiwiZGV0YWlsc01lbnVJdGVtcyIsIm1lbnVJdGVtcyIsImxhYmVsIiwibG9jYWxFcnJvciIsIm5ld1N0YXRlcyIsImluZGV4IiwiZmluZEluZGV4IiwibWNwYlBhdGgiLCJ1c2VyQ29uZmlnIiwiaG9tZXBhZ2UiLCJyZXBvc2l0b3J5Iiwic2VsZWN0OmFjY2VwdCIsImVkaXRhYmxlU291cmNlcyIsImNvbnN0Iiwic2V0dGluZ3MiLCJjb25maXJtOnllcyIsImNvbmZpcm06bm8iLCJpbnB1dCIsImtleSIsImRvVW5pbnN0YWxsIiwiZGVsZXRlRGF0YURpciIsInN1ZmZpeCIsInRpY2siLCJlc2NhcGUiLCJrZXlJc05vdEN0cmxPck1ldGEiLCJjdHJsIiwibWV0YSIsInRlc3QiLCJmaW5pc2giLCJtc2ciLCJvdXRjb21lIiwiZGV0YWlsIiwidmFsdWVzIiwiaGFuZGxlU2F2ZSIsImhhbmRsZUNhbmNlbCIsImNvbmZpZ1NjaGVtYSIsImV4aXN0aW5nQ29uZmlnIiwiZnAiLCJEYXRlIiwidG9Mb2NhbGVEYXRlU3RyaW5nIiwicG9pbnRlciIsImZpbHRlcmVkUGx1Z2luRXJyb3JzIiwicGx1Z2luRXJyb3JzU2VjdGlvbiIsImd1aWRhbmNlIiwiYXJyb3dSaWdodCIsInZlcnNpb24iLCJhdXRob3IiLCJpc1NlbGVjdGVkIiwiZmlyc3RFcnJvciIsInNlcnZlclRvb2xzQ291bnQiLCJoYW5kbGVNY3BWaWV3VG9vbHMiLCJoYW5kbGVNY3BDYW5jZWwiLCJoYW5kbGVNY3BDb21wbGV0ZSIsImNvbmZpZ1R5cGUiLCJzZXJ2ZXIiLCJ0cmFuc3BvcnQiLCJpc0F1dGhlbnRpY2F0ZWQiLCJ2aXNpYmxlSXRlbXMiLCJnZXRWaXNpYmxlSXRlbXMiLCJzY3JvbGxQb3NpdGlvbiIsImNhblNjcm9sbFVwIiwiYXJyb3dVcCIsInZpc2libGVJbmRleCIsImFjdHVhbEluZGV4IiwidG9BY3R1YWxJbmRleCIsInByZXZJdGVtIiwic2hvd1Njb3BlSGVhZGVyIiwiZ2V0U2NvcGVMYWJlbCIsImNhblNjcm9sbERvd24iLCJhcnJvd0Rvd24iXSwic291cmNlcyI6WyJNYW5hZ2VQbHVnaW5zLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZmlndXJlcyBmcm9tICdmaWd1cmVzJ1xuaW1wb3J0IHR5cGUgeyBEaXJlbnQgfSBmcm9tICdmcydcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VDYWxsYmFjaywgdXNlRWZmZWN0LCB1c2VNZW1vLCB1c2VSZWYsIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyBDb25maWd1cmFibGVTaG9ydGN1dEhpbnQgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL0NvbmZpZ3VyYWJsZVNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IEJ5bGluZSB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvZGVzaWduLXN5c3RlbS9CeWxpbmUuanMnXG5pbXBvcnQgeyBNQ1BSZW1vdGVTZXJ2ZXJNZW51IH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9tY3AvTUNQUmVtb3RlU2VydmVyTWVudS5qcydcbmltcG9ydCB7IE1DUFN0ZGlvU2VydmVyTWVudSB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvbWNwL01DUFN0ZGlvU2VydmVyTWVudS5qcydcbmltcG9ydCB7IE1DUFRvb2xEZXRhaWxWaWV3IH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9tY3AvTUNQVG9vbERldGFpbFZpZXcuanMnXG5pbXBvcnQgeyBNQ1BUb29sTGlzdFZpZXcgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL21jcC9NQ1BUb29sTGlzdFZpZXcuanMnXG5pbXBvcnQgdHlwZSB7XG4gIENsYXVkZUFJU2VydmVySW5mbyxcbiAgSFRUUFNlcnZlckluZm8sXG4gIFNTRVNlcnZlckluZm8sXG4gIFN0ZGlvU2VydmVySW5mbyxcbn0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9tY3AvdHlwZXMuanMnXG5pbXBvcnQgeyBTZWFyY2hCb3ggfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL1NlYXJjaEJveC5qcydcbmltcG9ydCB7IHVzZVNlYXJjaElucHV0IH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlU2VhcmNoSW5wdXQuanMnXG5pbXBvcnQgeyB1c2VUZXJtaW5hbFNpemUgfSBmcm9tICcuLi8uLi9ob29rcy91c2VUZXJtaW5hbFNpemUuanMnXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL3ByZWZlci11c2Uta2V5YmluZGluZ3MgLS0gdXNlSW5wdXQgbmVlZGVkIGZvciByYXcgc2VhcmNoIG1vZGUgdGV4dCBpbnB1dFxuaW1wb3J0IHsgQm94LCBUZXh0LCB1c2VJbnB1dCwgdXNlVGVybWluYWxGb2N1cyB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7XG4gIHVzZUtleWJpbmRpbmcsXG4gIHVzZUtleWJpbmRpbmdzLFxufSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHsgZ2V0QnVpbHRpblBsdWdpbkRlZmluaXRpb24gfSBmcm9tICcuLi8uLi9wbHVnaW5zL2J1aWx0aW5QbHVnaW5zLmpzJ1xuaW1wb3J0IHsgdXNlTWNwVG9nZ2xlRW5hYmxlZCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21jcC9NQ1BDb25uZWN0aW9uTWFuYWdlci5qcydcbmltcG9ydCB0eXBlIHtcbiAgTUNQU2VydmVyQ29ubmVjdGlvbixcbiAgTWNwQ2xhdWRlQUlQcm94eVNlcnZlckNvbmZpZyxcbiAgTWNwSFRUUFNlcnZlckNvbmZpZyxcbiAgTWNwU1NFU2VydmVyQ29uZmlnLFxuICBNY3BTdGRpb1NlcnZlckNvbmZpZyxcbn0gZnJvbSAnLi4vLi4vc2VydmljZXMvbWNwL3R5cGVzLmpzJ1xuaW1wb3J0IHsgZmlsdGVyVG9vbHNCeVNlcnZlciB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL21jcC91dGlscy5qcydcbmltcG9ydCB7XG4gIGRpc2FibGVQbHVnaW5PcCxcbiAgZW5hYmxlUGx1Z2luT3AsXG4gIGdldFBsdWdpbkluc3RhbGxhdGlvbkZyb21WMixcbiAgaXNJbnN0YWxsYWJsZVNjb3BlLFxuICBpc1BsdWdpbkVuYWJsZWRBdFByb2plY3RTY29wZSxcbiAgdW5pbnN0YWxsUGx1Z2luT3AsXG4gIHVwZGF0ZVBsdWdpbk9wLFxufSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9wbHVnaW5zL3BsdWdpbk9wZXJhdGlvbnMuanMnXG5pbXBvcnQgeyB1c2VBcHBTdGF0ZSB9IGZyb20gJy4uLy4uL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHR5cGUgeyBUb29sIH0gZnJvbSAnLi4vLi4vVG9vbC5qcydcbmltcG9ydCB0eXBlIHsgTG9hZGVkUGx1Z2luLCBQbHVnaW5FcnJvciB9IGZyb20gJy4uLy4uL3R5cGVzL3BsdWdpbi5qcydcbmltcG9ydCB7IGNvdW50IH0gZnJvbSAnLi4vLi4vdXRpbHMvYXJyYXkuanMnXG5pbXBvcnQgeyBvcGVuQnJvd3NlciB9IGZyb20gJy4uLy4uL3V0aWxzL2Jyb3dzZXIuanMnXG5pbXBvcnQgeyBsb2dGb3JEZWJ1Z2dpbmcgfSBmcm9tICcuLi8uLi91dGlscy9kZWJ1Zy5qcydcbmltcG9ydCB7IGVycm9yTWVzc2FnZSwgdG9FcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9ycy5qcydcbmltcG9ydCB7IGxvZ0Vycm9yIH0gZnJvbSAnLi4vLi4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHsgY2xlYXJBbGxDYWNoZXMgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL2NhY2hlVXRpbHMuanMnXG5pbXBvcnQgeyBsb2FkSW5zdGFsbGVkUGx1Z2luc1YyIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9pbnN0YWxsZWRQbHVnaW5zTWFuYWdlci5qcydcbmltcG9ydCB7IGdldE1hcmtldHBsYWNlIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9tYXJrZXRwbGFjZU1hbmFnZXIuanMnXG5pbXBvcnQge1xuICBpc01jcGJTb3VyY2UsXG4gIGxvYWRNY3BiRmlsZSxcbiAgdHlwZSBNY3BiTmVlZHNDb25maWdSZXN1bHQsXG4gIHR5cGUgVXNlckNvbmZpZ1ZhbHVlcyxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9tY3BiSGFuZGxlci5qcydcbmltcG9ydCB7XG4gIGdldFBsdWdpbkRhdGFEaXJTaXplLFxuICBwbHVnaW5EYXRhRGlyUGF0aCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9wbHVnaW5EaXJlY3Rvcmllcy5qcydcbmltcG9ydCB7XG4gIGdldEZsYWdnZWRQbHVnaW5zLFxuICBtYXJrRmxhZ2dlZFBsdWdpbnNTZWVuLFxuICByZW1vdmVGbGFnZ2VkUGx1Z2luLFxufSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL3BsdWdpbkZsYWdnaW5nLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBQZXJzaXN0YWJsZVBsdWdpblNjb3BlLFxuICBwYXJzZVBsdWdpbklkZW50aWZpZXIsXG59IGZyb20gJy4uLy4uL3V0aWxzL3BsdWdpbnMvcGx1Z2luSWRlbnRpZmllci5qcydcbmltcG9ydCB7IGxvYWRBbGxQbHVnaW5zIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9wbHVnaW5Mb2FkZXIuanMnXG5pbXBvcnQge1xuICBsb2FkUGx1Z2luT3B0aW9ucyxcbiAgdHlwZSBQbHVnaW5PcHRpb25TY2hlbWEsXG4gIHNhdmVQbHVnaW5PcHRpb25zLFxufSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL3BsdWdpbk9wdGlvbnNTdG9yYWdlLmpzJ1xuaW1wb3J0IHsgaXNQbHVnaW5CbG9ja2VkQnlQb2xpY3kgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL3BsdWdpblBvbGljeS5qcydcbmltcG9ydCB7IGdldFBsdWdpbkVkaXRhYmxlU2NvcGVzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGx1Z2lucy9wbHVnaW5TdGFydHVwQ2hlY2suanMnXG5pbXBvcnQge1xuICBnZXRTZXR0aW5nc19ERVBSRUNBVEVELFxuICBnZXRTZXR0aW5nc0ZvclNvdXJjZSxcbiAgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2UsXG59IGZyb20gJy4uLy4uL3V0aWxzL3NldHRpbmdzL3NldHRpbmdzLmpzJ1xuaW1wb3J0IHsganNvblBhcnNlIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2xvd09wZXJhdGlvbnMuanMnXG5pbXBvcnQgeyBwbHVyYWwgfSBmcm9tICcuLi8uLi91dGlscy9zdHJpbmdVdGlscy5qcydcbmltcG9ydCB7IGZvcm1hdEVycm9yTWVzc2FnZSwgZ2V0RXJyb3JHdWlkYW5jZSB9IGZyb20gJy4vUGx1Z2luRXJyb3JzLmpzJ1xuaW1wb3J0IHsgUGx1Z2luT3B0aW9uc0RpYWxvZyB9IGZyb20gJy4vUGx1Z2luT3B0aW9uc0RpYWxvZy5qcydcbmltcG9ydCB7IFBsdWdpbk9wdGlvbnNGbG93IH0gZnJvbSAnLi9QbHVnaW5PcHRpb25zRmxvdy5qcydcbmltcG9ydCB0eXBlIHsgVmlld1N0YXRlIGFzIFBhcmVudFZpZXdTdGF0ZSB9IGZyb20gJy4vdHlwZXMuanMnXG5pbXBvcnQgeyBVbmlmaWVkSW5zdGFsbGVkQ2VsbCB9IGZyb20gJy4vVW5pZmllZEluc3RhbGxlZENlbGwuanMnXG5pbXBvcnQgdHlwZSB7IFVuaWZpZWRJbnN0YWxsZWRJdGVtIH0gZnJvbSAnLi91bmlmaWVkVHlwZXMuanMnXG5pbXBvcnQgeyB1c2VQYWdpbmF0aW9uIH0gZnJvbSAnLi91c2VQYWdpbmF0aW9uLmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICBzZXRWaWV3U3RhdGU6IChzdGF0ZTogUGFyZW50Vmlld1N0YXRlKSA9PiB2b2lkXG4gIHNldFJlc3VsdDogKHJlc3VsdDogc3RyaW5nIHwgbnVsbCkgPT4gdm9pZFxuICBvbk1hbmFnZUNvbXBsZXRlPzogKCkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD5cbiAgb25TZWFyY2hNb2RlQ2hhbmdlPzogKGlzQWN0aXZlOiBib29sZWFuKSA9PiB2b2lkXG4gIHRhcmdldFBsdWdpbj86IHN0cmluZ1xuICB0YXJnZXRNYXJrZXRwbGFjZT86IHN0cmluZ1xuICBhY3Rpb24/OiAnZW5hYmxlJyB8ICdkaXNhYmxlJyB8ICd1bmluc3RhbGwnXG59XG5cbnR5cGUgRmxhZ2dlZFBsdWdpbkluZm8gPSB7XG4gIGlkOiBzdHJpbmdcbiAgbmFtZTogc3RyaW5nXG4gIG1hcmtldHBsYWNlOiBzdHJpbmdcbiAgcmVhc29uOiBzdHJpbmdcbiAgdGV4dDogc3RyaW5nXG4gIGZsYWdnZWRBdDogc3RyaW5nXG59XG5cbnR5cGUgRmFpbGVkUGx1Z2luSW5mbyA9IHtcbiAgaWQ6IHN0cmluZ1xuICBuYW1lOiBzdHJpbmdcbiAgbWFya2V0cGxhY2U6IHN0cmluZ1xuICBlcnJvcnM6IFBsdWdpbkVycm9yW11cbiAgc2NvcGU6IFBlcnNpc3RhYmxlUGx1Z2luU2NvcGVcbn1cblxudHlwZSBWaWV3U3RhdGUgPVxuICB8ICdwbHVnaW4tbGlzdCdcbiAgfCAncGx1Z2luLWRldGFpbHMnXG4gIHwgJ2NvbmZpZ3VyaW5nJ1xuICB8IHsgdHlwZTogJ3BsdWdpbi1vcHRpb25zJyB9XG4gIHwgeyB0eXBlOiAnY29uZmlndXJpbmctb3B0aW9ucyc7IHNjaGVtYTogUGx1Z2luT3B0aW9uU2NoZW1hIH1cbiAgfCAnY29uZmlybS1wcm9qZWN0LXVuaW5zdGFsbCdcbiAgfCB7IHR5cGU6ICdjb25maXJtLWRhdGEtY2xlYW51cCc7IHNpemU6IHsgYnl0ZXM6IG51bWJlcjsgaHVtYW46IHN0cmluZyB9IH1cbiAgfCB7IHR5cGU6ICdmbGFnZ2VkLWRldGFpbCc7IHBsdWdpbjogRmxhZ2dlZFBsdWdpbkluZm8gfVxuICB8IHsgdHlwZTogJ2ZhaWxlZC1wbHVnaW4tZGV0YWlscyc7IHBsdWdpbjogRmFpbGVkUGx1Z2luSW5mbyB9XG4gIHwgeyB0eXBlOiAnbWNwLWRldGFpbCc7IGNsaWVudDogTUNQU2VydmVyQ29ubmVjdGlvbiB9XG4gIHwgeyB0eXBlOiAnbWNwLXRvb2xzJzsgY2xpZW50OiBNQ1BTZXJ2ZXJDb25uZWN0aW9uIH1cbiAgfCB7IHR5cGU6ICdtY3AtdG9vbC1kZXRhaWwnOyBjbGllbnQ6IE1DUFNlcnZlckNvbm5lY3Rpb247IHRvb2w6IFRvb2wgfVxuXG50eXBlIE1hcmtldHBsYWNlSW5mbyA9IHtcbiAgbmFtZTogc3RyaW5nXG4gIGluc3RhbGxlZFBsdWdpbnM6IExvYWRlZFBsdWdpbltdXG4gIGVuYWJsZWRDb3VudD86IG51bWJlclxuICBkaXNhYmxlZENvdW50PzogbnVtYmVyXG59XG5cbnR5cGUgUGx1Z2luU3RhdGUgPSB7XG4gIHBsdWdpbjogTG9hZGVkUGx1Z2luXG4gIG1hcmtldHBsYWNlOiBzdHJpbmdcbiAgc2NvcGU/OiAndXNlcicgfCAncHJvamVjdCcgfCAnbG9jYWwnIHwgJ21hbmFnZWQnIHwgJ2J1aWx0aW4nXG4gIHBlbmRpbmdFbmFibGU/OiBib29sZWFuIC8vIFRvZ2dsZSBlbmFibGUvZGlzYWJsZVxuICBwZW5kaW5nVXBkYXRlPzogYm9vbGVhbiAvLyBNYXJrZWQgZm9yIHVwZGF0ZVxufVxuXG4vKipcbiAqIEdldCBsaXN0IG9mIGJhc2UgZmlsZSBuYW1lcyAod2l0aG91dCAubWQgZXh0ZW5zaW9uKSBmcm9tIGEgZGlyZWN0b3J5XG4gKiBAcGFyYW0gZGlyUGF0aCBUaGUgZGlyZWN0b3J5IHBhdGggdG8gbGlzdCBmaWxlcyBmcm9tXG4gKiBAcmV0dXJucyBBcnJheSBvZiBiYXNlIGZpbGUgbmFtZXMgd2l0aG91dCAubWQgZXh0ZW5zaW9uXG4gKiBAZXhhbXBsZVxuICogLy8gR2l2ZW4gZGlyZWN0b3J5IGNvbnRhaW5zOiBhZ2VudC1zZGstdmVyaWZpZXItcHkubWQsIGFnZW50LXNkay12ZXJpZmllci10cy5tZCwgUkVBRE1FLnR4dFxuICogYXdhaXQgZ2V0QmFzZUZpbGVOYW1lcygnL3BhdGgvdG8vYWdlbnRzJylcbiAqIC8vIFJldHVybnM6IFsnYWdlbnQtc2RrLXZlcmlmaWVyLXB5JywgJ2FnZW50LXNkay12ZXJpZmllci10cyddXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEJhc2VGaWxlTmFtZXMoZGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKGRpclBhdGgsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgIHJldHVybiBlbnRyaWVzXG4gICAgICAuZmlsdGVyKChlbnRyeTogRGlyZW50KSA9PiBlbnRyeS5pc0ZpbGUoKSAmJiBlbnRyeS5uYW1lLmVuZHNXaXRoKCcubWQnKSlcbiAgICAgIC5tYXAoKGVudHJ5OiBEaXJlbnQpID0+IHtcbiAgICAgICAgLy8gUmVtb3ZlIC5tZCBleHRlbnNpb24gc3BlY2lmaWNhbGx5XG4gICAgICAgIGNvbnN0IGJhc2VOYW1lID0gcGF0aC5iYXNlbmFtZShlbnRyeS5uYW1lLCAnLm1kJylcbiAgICAgICAgcmV0dXJuIGJhc2VOYW1lXG4gICAgICB9KVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3JNZXNzYWdlKGVycm9yKVxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBGYWlsZWQgdG8gcmVhZCBwbHVnaW4gY29tcG9uZW50cyBmcm9tICR7ZGlyUGF0aH06ICR7ZXJyb3JNc2d9YCxcbiAgICAgIHsgbGV2ZWw6ICdlcnJvcicgfSxcbiAgICApXG4gICAgbG9nRXJyb3IodG9FcnJvcihlcnJvcikpXG4gICAgLy8gUmV0dXJuIGVtcHR5IGFycmF5IHRvIGFsbG93IGdyYWNlZnVsIGRlZ3JhZGF0aW9uIC0gcGx1Z2luIGRldGFpbHMgY2FuIHN0aWxsIGJlIHNob3duXG4gICAgcmV0dXJuIFtdXG4gIH1cbn1cblxuLyoqXG4gKiBHZXQgbGlzdCBvZiBza2lsbCBkaXJlY3RvcnkgbmFtZXMgZnJvbSBhIHNraWxscyBkaXJlY3RvcnlcbiAqIFNraWxscyBhcmUgZGlyZWN0b3JpZXMgY29udGFpbmluZyBhIFNLSUxMLm1kIGZpbGVcbiAqIEBwYXJhbSBkaXJQYXRoIFRoZSBza2lsbHMgZGlyZWN0b3J5IHBhdGggdG8gc2NhblxuICogQHJldHVybnMgQXJyYXkgb2Ygc2tpbGwgZGlyZWN0b3J5IG5hbWVzIHRoYXQgY29udGFpbiBTS0lMTC5tZFxuICogQGV4YW1wbGVcbiAqIC8vIEdpdmVuIGRpcmVjdG9yeSBjb250YWluczogbXktc2tpbGwvU0tJTEwubWQsIGFub3RoZXItc2tpbGwvU0tJTEwubWQsIFJFQURNRS50eHRcbiAqIGF3YWl0IGdldFNraWxsRGlyTmFtZXMoJy9wYXRoL3RvL3NraWxscycpXG4gKiAvLyBSZXR1cm5zOiBbJ215LXNraWxsJywgJ2Fub3RoZXItc2tpbGwnXVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRTa2lsbERpck5hbWVzKGRpclBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXdhaXQgZnMucmVhZGRpcihkaXJQYXRoLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSlcbiAgICBjb25zdCBza2lsbE5hbWVzOiBzdHJpbmdbXSA9IFtdXG5cbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgIC8vIENoZWNrIGlmIGl0J3MgYSBkaXJlY3Rvcnkgb3Igc3ltbGluayAoc3ltbGlua3MgbWF5IHBvaW50IHRvIHNraWxsIGRpcmVjdG9yaWVzKVxuICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkgfHwgZW50cnkuaXNTeW1ib2xpY0xpbmsoKSkge1xuICAgICAgICAvLyBDaGVjayBpZiB0aGlzIGRpcmVjdG9yeSBjb250YWlucyBhIFNLSUxMLm1kIGZpbGVcbiAgICAgICAgY29uc3Qgc2tpbGxGaWxlUGF0aCA9IHBhdGguam9pbihkaXJQYXRoLCBlbnRyeS5uYW1lLCAnU0tJTEwubWQnKVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHN0ID0gYXdhaXQgZnMuc3RhdChza2lsbEZpbGVQYXRoKVxuICAgICAgICAgIGlmIChzdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgc2tpbGxOYW1lcy5wdXNoKGVudHJ5Lm5hbWUpXG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAvLyBObyBTS0lMTC5tZCBmaWxlIGluIHRoaXMgZGlyZWN0b3J5LCBza2lwIGl0XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc2tpbGxOYW1lc1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3JNZXNzYWdlKGVycm9yKVxuICAgIGxvZ0ZvckRlYnVnZ2luZyhcbiAgICAgIGBGYWlsZWQgdG8gcmVhZCBza2lsbCBkaXJlY3RvcmllcyBmcm9tICR7ZGlyUGF0aH06ICR7ZXJyb3JNc2d9YCxcbiAgICAgIHsgbGV2ZWw6ICdlcnJvcicgfSxcbiAgICApXG4gICAgbG9nRXJyb3IodG9FcnJvcihlcnJvcikpXG4gICAgLy8gUmV0dXJuIGVtcHR5IGFycmF5IHRvIGFsbG93IGdyYWNlZnVsIGRlZ3JhZGF0aW9uIC0gcGx1Z2luIGRldGFpbHMgY2FuIHN0aWxsIGJlIHNob3duXG4gICAgcmV0dXJuIFtdXG4gIH1cbn1cblxuLy8gQ29tcG9uZW50IHRvIGRpc3BsYXkgaW5zdGFsbGVkIHBsdWdpbiBjb21wb25lbnRzXG5mdW5jdGlvbiBQbHVnaW5Db21wb25lbnRzRGlzcGxheSh7XG4gIHBsdWdpbixcbiAgbWFya2V0cGxhY2UsXG59OiB7XG4gIHBsdWdpbjogTG9hZGVkUGx1Z2luXG4gIG1hcmtldHBsYWNlOiBzdHJpbmdcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBbY29tcG9uZW50cywgc2V0Q29tcG9uZW50c10gPSB1c2VTdGF0ZTx7XG4gICAgY29tbWFuZHM/OiBzdHJpbmcgfCBzdHJpbmdbXSB8IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHwgbnVsbFxuICAgIGFnZW50cz86IHN0cmluZyB8IHN0cmluZ1tdIHwgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCBudWxsXG4gICAgc2tpbGxzPzogc3RyaW5nIHwgc3RyaW5nW10gfCBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB8IG51bGxcbiAgICBob29rcz86IHVua25vd25cbiAgICBtY3BTZXJ2ZXJzPzogdW5rbm93blxuICB9IHwgbnVsbD4obnVsbClcbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSlcbiAgY29uc3QgW2Vycm9yLCBzZXRFcnJvcl0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXN5bmMgZnVuY3Rpb24gbG9hZENvbXBvbmVudHMoKSB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBCdWlsdC1pbiBwbHVnaW5zIGRvbid0IGhhdmUgYSBtYXJrZXRwbGFjZSBlbnRyeSDigJQgcmVhZCBmcm9tIHRoZVxuICAgICAgICAvLyByZWdpc3RlcmVkIGRlZmluaXRpb24gZGlyZWN0bHkuXG4gICAgICAgIGlmIChtYXJrZXRwbGFjZSA9PT0gJ2J1aWx0aW4nKSB7XG4gICAgICAgICAgY29uc3QgYnVpbHRpbkRlZiA9IGdldEJ1aWx0aW5QbHVnaW5EZWZpbml0aW9uKHBsdWdpbi5uYW1lKVxuICAgICAgICAgIGlmIChidWlsdGluRGVmKSB7XG4gICAgICAgICAgICBjb25zdCBza2lsbE5hbWVzID0gYnVpbHRpbkRlZi5za2lsbHM/Lm1hcChzID0+IHMubmFtZSkgPz8gW11cbiAgICAgICAgICAgIGNvbnN0IGhvb2tFdmVudHMgPSBidWlsdGluRGVmLmhvb2tzXG4gICAgICAgICAgICAgID8gT2JqZWN0LmtleXMoYnVpbHRpbkRlZi5ob29rcylcbiAgICAgICAgICAgICAgOiBbXVxuICAgICAgICAgICAgY29uc3QgbWNwU2VydmVyTmFtZXMgPSBidWlsdGluRGVmLm1jcFNlcnZlcnNcbiAgICAgICAgICAgICAgPyBPYmplY3Qua2V5cyhidWlsdGluRGVmLm1jcFNlcnZlcnMpXG4gICAgICAgICAgICAgIDogW11cbiAgICAgICAgICAgIHNldENvbXBvbmVudHMoe1xuICAgICAgICAgICAgICBjb21tYW5kczogbnVsbCxcbiAgICAgICAgICAgICAgYWdlbnRzOiBudWxsLFxuICAgICAgICAgICAgICBza2lsbHM6IHNraWxsTmFtZXMubGVuZ3RoID4gMCA/IHNraWxsTmFtZXMgOiBudWxsLFxuICAgICAgICAgICAgICBob29rczogaG9va0V2ZW50cy5sZW5ndGggPiAwID8gaG9va0V2ZW50cyA6IG51bGwsXG4gICAgICAgICAgICAgIG1jcFNlcnZlcnM6IG1jcFNlcnZlck5hbWVzLmxlbmd0aCA+IDAgPyBtY3BTZXJ2ZXJOYW1lcyA6IG51bGwsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRFcnJvcihgQnVpbHQtaW4gcGx1Z2luICR7cGx1Z2luLm5hbWV9IG5vdCBmb3VuZGApXG4gICAgICAgICAgfVxuICAgICAgICAgIHNldExvYWRpbmcoZmFsc2UpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYXJrZXRwbGFjZURhdGEgPSBhd2FpdCBnZXRNYXJrZXRwbGFjZShtYXJrZXRwbGFjZSlcbiAgICAgICAgLy8gRmluZCB0aGUgcGx1Z2luIGVudHJ5IGluIHRoZSBhcnJheVxuICAgICAgICBjb25zdCBwbHVnaW5FbnRyeSA9IG1hcmtldHBsYWNlRGF0YS5wbHVnaW5zLmZpbmQoXG4gICAgICAgICAgcCA9PiBwLm5hbWUgPT09IHBsdWdpbi5uYW1lLFxuICAgICAgICApXG4gICAgICAgIGlmIChwbHVnaW5FbnRyeSkge1xuICAgICAgICAgIC8vIENvbWJpbmUgY29tbWFuZHMgZnJvbSBib3RoIHNvdXJjZXNcbiAgICAgICAgICBjb25zdCBjb21tYW5kUGF0aExpc3QgPSBbXVxuICAgICAgICAgIGlmIChwbHVnaW4uY29tbWFuZHNQYXRoKSB7XG4gICAgICAgICAgICBjb21tYW5kUGF0aExpc3QucHVzaChwbHVnaW4uY29tbWFuZHNQYXRoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocGx1Z2luLmNvbW1hbmRzUGF0aHMpIHtcbiAgICAgICAgICAgIGNvbW1hbmRQYXRoTGlzdC5wdXNoKC4uLnBsdWdpbi5jb21tYW5kc1BhdGhzKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIEdldCBiYXNlIGZpbGUgbmFtZXMgZnJvbSBhbGwgY29tbWFuZCBwYXRoc1xuICAgICAgICAgIGNvbnN0IGNvbW1hbmRMaXN0OiBzdHJpbmdbXSA9IFtdXG4gICAgICAgICAgZm9yIChjb25zdCBjb21tYW5kUGF0aCBvZiBjb21tYW5kUGF0aExpc3QpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY29tbWFuZFBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgIC8vIGNvbW1hbmRQYXRoIGlzIGFscmVhZHkgYSBmdWxsIHBhdGhcbiAgICAgICAgICAgICAgY29uc3QgYmFzZU5hbWVzID0gYXdhaXQgZ2V0QmFzZUZpbGVOYW1lcyhjb21tYW5kUGF0aClcbiAgICAgICAgICAgICAgY29tbWFuZExpc3QucHVzaCguLi5iYXNlTmFtZXMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tYmluZSBhZ2VudHMgZnJvbSBib3RoIHNvdXJjZXNcbiAgICAgICAgICBjb25zdCBhZ2VudFBhdGhMaXN0ID0gW11cbiAgICAgICAgICBpZiAocGx1Z2luLmFnZW50c1BhdGgpIHtcbiAgICAgICAgICAgIGFnZW50UGF0aExpc3QucHVzaChwbHVnaW4uYWdlbnRzUGF0aClcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBsdWdpbi5hZ2VudHNQYXRocykge1xuICAgICAgICAgICAgYWdlbnRQYXRoTGlzdC5wdXNoKC4uLnBsdWdpbi5hZ2VudHNQYXRocylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBHZXQgYmFzZSBmaWxlIG5hbWVzIGZyb20gYWxsIGFnZW50IHBhdGhzXG4gICAgICAgICAgY29uc3QgYWdlbnRMaXN0OiBzdHJpbmdbXSA9IFtdXG4gICAgICAgICAgZm9yIChjb25zdCBhZ2VudFBhdGggb2YgYWdlbnRQYXRoTGlzdCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhZ2VudFBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgIC8vIGFnZW50UGF0aCBpcyBhbHJlYWR5IGEgZnVsbCBwYXRoXG4gICAgICAgICAgICAgIGNvbnN0IGJhc2VOYW1lcyA9IGF3YWl0IGdldEJhc2VGaWxlTmFtZXMoYWdlbnRQYXRoKVxuICAgICAgICAgICAgICBhZ2VudExpc3QucHVzaCguLi5iYXNlTmFtZXMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tYmluZSBza2lsbHMgZnJvbSBib3RoIHNvdXJjZXNcbiAgICAgICAgICBjb25zdCBza2lsbFBhdGhMaXN0ID0gW11cbiAgICAgICAgICBpZiAocGx1Z2luLnNraWxsc1BhdGgpIHtcbiAgICAgICAgICAgIHNraWxsUGF0aExpc3QucHVzaChwbHVnaW4uc2tpbGxzUGF0aClcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBsdWdpbi5za2lsbHNQYXRocykge1xuICAgICAgICAgICAgc2tpbGxQYXRoTGlzdC5wdXNoKC4uLnBsdWdpbi5za2lsbHNQYXRocylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBHZXQgc2tpbGwgZGlyZWN0b3J5IG5hbWVzIGZyb20gYWxsIHNraWxsIHBhdGhzXG4gICAgICAgICAgLy8gU2tpbGxzIGFyZSBkaXJlY3RvcmllcyBjb250YWluaW5nIFNLSUxMLm1kIGZpbGVzXG4gICAgICAgICAgY29uc3Qgc2tpbGxMaXN0OiBzdHJpbmdbXSA9IFtdXG4gICAgICAgICAgZm9yIChjb25zdCBza2lsbFBhdGggb2Ygc2tpbGxQYXRoTGlzdCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBza2lsbFBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgIC8vIHNraWxsUGF0aCBpcyBhbHJlYWR5IGEgZnVsbCBwYXRoIHRvIGEgc2tpbGxzIGRpcmVjdG9yeVxuICAgICAgICAgICAgICBjb25zdCBza2lsbERpck5hbWVzID0gYXdhaXQgZ2V0U2tpbGxEaXJOYW1lcyhza2lsbFBhdGgpXG4gICAgICAgICAgICAgIHNraWxsTGlzdC5wdXNoKC4uLnNraWxsRGlyTmFtZXMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ29tYmluZSBob29rcyBmcm9tIGJvdGggc291cmNlc1xuICAgICAgICAgIGNvbnN0IGhvb2tzTGlzdCA9IFtdXG4gICAgICAgICAgaWYgKHBsdWdpbi5ob29rc0NvbmZpZykge1xuICAgICAgICAgICAgaG9va3NMaXN0LnB1c2goT2JqZWN0LmtleXMocGx1Z2luLmhvb2tzQ29uZmlnKSlcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBsdWdpbkVudHJ5Lmhvb2tzKSB7XG4gICAgICAgICAgICBob29rc0xpc3QucHVzaChwbHVnaW5FbnRyeS5ob29rcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDb21iaW5lIE1DUCBzZXJ2ZXJzIGZyb20gYm90aCBzb3VyY2VzXG4gICAgICAgICAgY29uc3QgbWNwU2VydmVyc0xpc3QgPSBbXVxuICAgICAgICAgIGlmIChwbHVnaW4ubWNwU2VydmVycykge1xuICAgICAgICAgICAgbWNwU2VydmVyc0xpc3QucHVzaChPYmplY3Qua2V5cyhwbHVnaW4ubWNwU2VydmVycykpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwbHVnaW5FbnRyeS5tY3BTZXJ2ZXJzKSB7XG4gICAgICAgICAgICBtY3BTZXJ2ZXJzTGlzdC5wdXNoKHBsdWdpbkVudHJ5Lm1jcFNlcnZlcnMpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc2V0Q29tcG9uZW50cyh7XG4gICAgICAgICAgICBjb21tYW5kczogY29tbWFuZExpc3QubGVuZ3RoID4gMCA/IGNvbW1hbmRMaXN0IDogbnVsbCxcbiAgICAgICAgICAgIGFnZW50czogYWdlbnRMaXN0Lmxlbmd0aCA+IDAgPyBhZ2VudExpc3QgOiBudWxsLFxuICAgICAgICAgICAgc2tpbGxzOiBza2lsbExpc3QubGVuZ3RoID4gMCA/IHNraWxsTGlzdCA6IG51bGwsXG4gICAgICAgICAgICBob29rczogaG9va3NMaXN0Lmxlbmd0aCA+IDAgPyBob29rc0xpc3QgOiBudWxsLFxuICAgICAgICAgICAgbWNwU2VydmVyczogbWNwU2VydmVyc0xpc3QubGVuZ3RoID4gMCA/IG1jcFNlcnZlcnNMaXN0IDogbnVsbCxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNldEVycm9yKGBQbHVnaW4gJHtwbHVnaW4ubmFtZX0gbm90IGZvdW5kIGluIG1hcmtldHBsYWNlYClcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHNldEVycm9yKFxuICAgICAgICAgIGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiAnRmFpbGVkIHRvIGxvYWQgY29tcG9uZW50cycsXG4gICAgICAgIClcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNldExvYWRpbmcoZmFsc2UpXG4gICAgICB9XG4gICAgfVxuICAgIHZvaWQgbG9hZENvbXBvbmVudHMoKVxuICB9LCBbXG4gICAgcGx1Z2luLm5hbWUsXG4gICAgcGx1Z2luLmNvbW1hbmRzUGF0aCxcbiAgICBwbHVnaW4uY29tbWFuZHNQYXRocyxcbiAgICBwbHVnaW4uYWdlbnRzUGF0aCxcbiAgICBwbHVnaW4uYWdlbnRzUGF0aHMsXG4gICAgcGx1Z2luLnNraWxsc1BhdGgsXG4gICAgcGx1Z2luLnNraWxsc1BhdGhzLFxuICAgIHBsdWdpbi5ob29rc0NvbmZpZyxcbiAgICBwbHVnaW4ubWNwU2VydmVycyxcbiAgICBtYXJrZXRwbGFjZSxcbiAgXSlcblxuICBpZiAobG9hZGluZykge1xuICAgIHJldHVybiBudWxsIC8vIERvbid0IHNob3cgbG9hZGluZyBzdGF0ZSBmb3IgY2xlYW5lciBVSVxuICB9XG5cbiAgaWYgKGVycm9yKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgIDxUZXh0IGJvbGQ+Q29tcG9uZW50czo8L1RleHQ+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPkVycm9yOiB7ZXJyb3J9PC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgaWYgKCFjb21wb25lbnRzKSB7XG4gICAgcmV0dXJuIG51bGwgLy8gTm8gY29tcG9uZW50cyBpbmZvIGF2YWlsYWJsZVxuICB9XG5cbiAgY29uc3QgaGFzQ29tcG9uZW50cyA9XG4gICAgY29tcG9uZW50cy5jb21tYW5kcyB8fFxuICAgIGNvbXBvbmVudHMuYWdlbnRzIHx8XG4gICAgY29tcG9uZW50cy5za2lsbHMgfHxcbiAgICBjb21wb25lbnRzLmhvb2tzIHx8XG4gICAgY29tcG9uZW50cy5tY3BTZXJ2ZXJzXG5cbiAgaWYgKCFoYXNDb21wb25lbnRzKSB7XG4gICAgcmV0dXJuIG51bGwgLy8gTm8gY29tcG9uZW50cyBkZWZpbmVkXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICA8VGV4dCBib2xkPkluc3RhbGxlZCBjb21wb25lbnRzOjwvVGV4dD5cbiAgICAgIHtjb21wb25lbnRzLmNvbW1hbmRzID8gKFxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICDigKIgQ29tbWFuZHM6eycgJ31cbiAgICAgICAgICB7dHlwZW9mIGNvbXBvbmVudHMuY29tbWFuZHMgPT09ICdzdHJpbmcnXG4gICAgICAgICAgICA/IGNvbXBvbmVudHMuY29tbWFuZHNcbiAgICAgICAgICAgIDogQXJyYXkuaXNBcnJheShjb21wb25lbnRzLmNvbW1hbmRzKVxuICAgICAgICAgICAgICA/IGNvbXBvbmVudHMuY29tbWFuZHMuam9pbignLCAnKVxuICAgICAgICAgICAgICA6IE9iamVjdC5rZXlzKGNvbXBvbmVudHMuY29tbWFuZHMpLmpvaW4oJywgJyl9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICkgOiBudWxsfVxuICAgICAge2NvbXBvbmVudHMuYWdlbnRzID8gKFxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICDigKIgQWdlbnRzOnsnICd9XG4gICAgICAgICAge3R5cGVvZiBjb21wb25lbnRzLmFnZW50cyA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgID8gY29tcG9uZW50cy5hZ2VudHNcbiAgICAgICAgICAgIDogQXJyYXkuaXNBcnJheShjb21wb25lbnRzLmFnZW50cylcbiAgICAgICAgICAgICAgPyBjb21wb25lbnRzLmFnZW50cy5qb2luKCcsICcpXG4gICAgICAgICAgICAgIDogT2JqZWN0LmtleXMoY29tcG9uZW50cy5hZ2VudHMpLmpvaW4oJywgJyl9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICkgOiBudWxsfVxuICAgICAge2NvbXBvbmVudHMuc2tpbGxzID8gKFxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICDigKIgU2tpbGxzOnsnICd9XG4gICAgICAgICAge3R5cGVvZiBjb21wb25lbnRzLnNraWxscyA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgID8gY29tcG9uZW50cy5za2lsbHNcbiAgICAgICAgICAgIDogQXJyYXkuaXNBcnJheShjb21wb25lbnRzLnNraWxscylcbiAgICAgICAgICAgICAgPyBjb21wb25lbnRzLnNraWxscy5qb2luKCcsICcpXG4gICAgICAgICAgICAgIDogT2JqZWN0LmtleXMoY29tcG9uZW50cy5za2lsbHMpLmpvaW4oJywgJyl9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICkgOiBudWxsfVxuICAgICAge2NvbXBvbmVudHMuaG9va3MgPyAoXG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgIOKAoiBIb29rczp7JyAnfVxuICAgICAgICAgIHt0eXBlb2YgY29tcG9uZW50cy5ob29rcyA9PT0gJ3N0cmluZydcbiAgICAgICAgICAgID8gY29tcG9uZW50cy5ob29rc1xuICAgICAgICAgICAgOiBBcnJheS5pc0FycmF5KGNvbXBvbmVudHMuaG9va3MpXG4gICAgICAgICAgICAgID8gY29tcG9uZW50cy5ob29rcy5tYXAoU3RyaW5nKS5qb2luKCcsICcpXG4gICAgICAgICAgICAgIDogdHlwZW9mIGNvbXBvbmVudHMuaG9va3MgPT09ICdvYmplY3QnICYmXG4gICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmhvb2tzICE9PSBudWxsXG4gICAgICAgICAgICAgICAgPyBPYmplY3Qua2V5cyhjb21wb25lbnRzLmhvb2tzKS5qb2luKCcsICcpXG4gICAgICAgICAgICAgICAgOiBTdHJpbmcoY29tcG9uZW50cy5ob29rcyl9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICkgOiBudWxsfVxuICAgICAge2NvbXBvbmVudHMubWNwU2VydmVycyA/IChcbiAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAg4oCiIE1DUCBTZXJ2ZXJzOnsnICd9XG4gICAgICAgICAge3R5cGVvZiBjb21wb25lbnRzLm1jcFNlcnZlcnMgPT09ICdzdHJpbmcnXG4gICAgICAgICAgICA/IGNvbXBvbmVudHMubWNwU2VydmVyc1xuICAgICAgICAgICAgOiBBcnJheS5pc0FycmF5KGNvbXBvbmVudHMubWNwU2VydmVycylcbiAgICAgICAgICAgICAgPyBjb21wb25lbnRzLm1jcFNlcnZlcnMubWFwKFN0cmluZykuam9pbignLCAnKVxuICAgICAgICAgICAgICA6IHR5cGVvZiBjb21wb25lbnRzLm1jcFNlcnZlcnMgPT09ICdvYmplY3QnICYmXG4gICAgICAgICAgICAgICAgICBjb21wb25lbnRzLm1jcFNlcnZlcnMgIT09IG51bGxcbiAgICAgICAgICAgICAgICA/IE9iamVjdC5rZXlzKGNvbXBvbmVudHMubWNwU2VydmVycykuam9pbignLCAnKVxuICAgICAgICAgICAgICAgIDogU3RyaW5nKGNvbXBvbmVudHMubWNwU2VydmVycyl9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICkgOiBudWxsfVxuICAgIDwvQm94PlxuICApXG59XG5cbi8qKlxuICogQ2hlY2sgaWYgYSBwbHVnaW4gaXMgZnJvbSBhIGxvY2FsIHNvdXJjZSBhbmQgY2Fubm90IGJlIHJlbW90ZWx5IHVwZGF0ZWRcbiAqIEByZXR1cm5zIEVycm9yIG1lc3NhZ2UgaWYgbG9jYWwsIG51bGwgaWYgcmVtb3RlL3VwZGF0YWJsZVxuICovXG5hc3luYyBmdW5jdGlvbiBjaGVja0lmTG9jYWxQbHVnaW4oXG4gIHBsdWdpbk5hbWU6IHN0cmluZyxcbiAgbWFya2V0cGxhY2VOYW1lOiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgY29uc3QgbWFya2V0cGxhY2UgPSBhd2FpdCBnZXRNYXJrZXRwbGFjZShtYXJrZXRwbGFjZU5hbWUpXG4gIGNvbnN0IGVudHJ5ID0gbWFya2V0cGxhY2U/LnBsdWdpbnMuZmluZChwID0+IHAubmFtZSA9PT0gcGx1Z2luTmFtZSlcblxuICBpZiAoZW50cnkgJiYgdHlwZW9mIGVudHJ5LnNvdXJjZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gYExvY2FsIHBsdWdpbnMgY2Fubm90IGJlIHVwZGF0ZWQgcmVtb3RlbHkuIFRvIHVwZGF0ZSwgbW9kaWZ5IHRoZSBzb3VyY2UgYXQ6ICR7ZW50cnkuc291cmNlfWBcbiAgfVxuXG4gIHJldHVybiBudWxsXG59XG5cbi8qKlxuICogRmlsdGVyIG91dCBwbHVnaW5zIHRoYXQgYXJlIGZvcmNlLWRpc2FibGVkIGJ5IG9yZyBwb2xpY3kgKHBvbGljeVNldHRpbmdzKS5cbiAqIFRoZXNlIGFyZSBibG9ja2VkIGJ5IHRoZSBvcmdhbml6YXRpb24gYW5kIGNhbm5vdCBiZSByZS1lbmFibGVkIGJ5IHRoZSB1c2VyLlxuICogQ2hlY2tzIHBvbGljeVNldHRpbmdzIGRpcmVjdGx5IHJhdGhlciB0aGFuIGluc3RhbGxhdGlvbiBzY29wZSwgc2luY2UgbWFuYWdlZFxuICogc2V0dGluZ3MgZG9uJ3QgY3JlYXRlIGluc3RhbGxhdGlvbiByZWNvcmRzIHdpdGggc2NvcGUgJ21hbmFnZWQnLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZmlsdGVyTWFuYWdlZERpc2FibGVkUGx1Z2lucyhcbiAgcGx1Z2luczogTG9hZGVkUGx1Z2luW10sXG4pOiBMb2FkZWRQbHVnaW5bXSB7XG4gIHJldHVybiBwbHVnaW5zLmZpbHRlcihwbHVnaW4gPT4ge1xuICAgIGNvbnN0IG1hcmtldHBsYWNlID0gcGx1Z2luLnNvdXJjZS5zcGxpdCgnQCcpWzFdIHx8ICdsb2NhbCdcbiAgICByZXR1cm4gIWlzUGx1Z2luQmxvY2tlZEJ5UG9saWN5KGAke3BsdWdpbi5uYW1lfUAke21hcmtldHBsYWNlfWApXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBNYW5hZ2VQbHVnaW5zKHtcbiAgc2V0Vmlld1N0YXRlOiBzZXRQYXJlbnRWaWV3U3RhdGUsXG4gIHNldFJlc3VsdCxcbiAgb25NYW5hZ2VDb21wbGV0ZSxcbiAgb25TZWFyY2hNb2RlQ2hhbmdlLFxuICB0YXJnZXRQbHVnaW4sXG4gIHRhcmdldE1hcmtldHBsYWNlLFxuICBhY3Rpb24sXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIC8vIEFwcCBzdGF0ZSBmb3IgTUNQIGFjY2Vzc1xuICBjb25zdCBtY3BDbGllbnRzID0gdXNlQXBwU3RhdGUocyA9PiBzLm1jcC5jbGllbnRzKVxuICBjb25zdCBtY3BUb29scyA9IHVzZUFwcFN0YXRlKHMgPT4gcy5tY3AudG9vbHMpXG4gIGNvbnN0IHBsdWdpbkVycm9ycyA9IHVzZUFwcFN0YXRlKHMgPT4gcy5wbHVnaW5zLmVycm9ycylcbiAgY29uc3QgZmxhZ2dlZFBsdWdpbnMgPSBnZXRGbGFnZ2VkUGx1Z2lucygpXG5cbiAgLy8gU2VhcmNoIHN0YXRlXG4gIGNvbnN0IFtpc1NlYXJjaE1vZGUsIHNldElzU2VhcmNoTW9kZVJhd10gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3Qgc2V0SXNTZWFyY2hNb2RlID0gdXNlQ2FsbGJhY2soXG4gICAgKGFjdGl2ZTogYm9vbGVhbikgPT4ge1xuICAgICAgc2V0SXNTZWFyY2hNb2RlUmF3KGFjdGl2ZSlcbiAgICAgIG9uU2VhcmNoTW9kZUNoYW5nZT8uKGFjdGl2ZSlcbiAgICB9LFxuICAgIFtvblNlYXJjaE1vZGVDaGFuZ2VdLFxuICApXG4gIGNvbnN0IGlzVGVybWluYWxGb2N1c2VkID0gdXNlVGVybWluYWxGb2N1cygpXG4gIGNvbnN0IHsgY29sdW1uczogdGVybWluYWxXaWR0aCB9ID0gdXNlVGVybWluYWxTaXplKClcblxuICAvLyBWaWV3IHN0YXRlXG4gIGNvbnN0IFt2aWV3U3RhdGUsIHNldFZpZXdTdGF0ZV0gPSB1c2VTdGF0ZTxWaWV3U3RhdGU+KCdwbHVnaW4tbGlzdCcpXG5cbiAgY29uc3Qge1xuICAgIHF1ZXJ5OiBzZWFyY2hRdWVyeSxcbiAgICBzZXRRdWVyeTogc2V0U2VhcmNoUXVlcnksXG4gICAgY3Vyc29yT2Zmc2V0OiBzZWFyY2hDdXJzb3JPZmZzZXQsXG4gIH0gPSB1c2VTZWFyY2hJbnB1dCh7XG4gICAgaXNBY3RpdmU6IHZpZXdTdGF0ZSA9PT0gJ3BsdWdpbi1saXN0JyAmJiBpc1NlYXJjaE1vZGUsXG4gICAgb25FeGl0OiAoKSA9PiB7XG4gICAgICBzZXRJc1NlYXJjaE1vZGUoZmFsc2UpXG4gICAgfSxcbiAgfSlcbiAgY29uc3QgW3NlbGVjdGVkUGx1Z2luLCBzZXRTZWxlY3RlZFBsdWdpbl0gPSB1c2VTdGF0ZTxQbHVnaW5TdGF0ZSB8IG51bGw+KG51bGwpXG5cbiAgLy8gRGF0YSBzdGF0ZVxuICBjb25zdCBbbWFya2V0cGxhY2VzLCBzZXRNYXJrZXRwbGFjZXNdID0gdXNlU3RhdGU8TWFya2V0cGxhY2VJbmZvW10+KFtdKVxuICBjb25zdCBbcGx1Z2luU3RhdGVzLCBzZXRQbHVnaW5TdGF0ZXNdID0gdXNlU3RhdGU8UGx1Z2luU3RhdGVbXT4oW10pXG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpXG4gIGNvbnN0IFtwZW5kaW5nVG9nZ2xlcywgc2V0UGVuZGluZ1RvZ2dsZXNdID0gdXNlU3RhdGU8XG4gICAgTWFwPHN0cmluZywgJ3dpbGwtZW5hYmxlJyB8ICd3aWxsLWRpc2FibGUnPlxuICA+KG5ldyBNYXAoKSlcblxuICAvLyBHdWFyZCB0byBwcmV2ZW50IGF1dG8tbmF2aWdhdGlvbiBmcm9tIHJlLXRyaWdnZXJpbmcgYWZ0ZXIgdGhlIHVzZXJcbiAgLy8gbmF2aWdhdGVzIGF3YXkgKHRhcmdldFBsdWdpbiBpcyBuZXZlciBjbGVhcmVkIGJ5IHRoZSBwYXJlbnQpLlxuICBjb25zdCBoYXNBdXRvTmF2aWdhdGVkID0gdXNlUmVmKGZhbHNlKVxuICAvLyBBdXRvLWFjdGlvbiAoZW5hYmxlL2Rpc2FibGUvdW5pbnN0YWxsKSB0byBmaXJlIGFmdGVyIGF1dG8tbmF2aWdhdGlvbiBsYW5kcy5cbiAgLy8gUmVmLCBub3Qgc3RhdGU6IGl0J3MgY29uc3VtZWQgYnkgYSBvbmUtc2hvdCBlZmZlY3QgdGhhdCBhbHJlYWR5IHJlLXJ1bnMgb25cbiAgLy8gdmlld1N0YXRlL3NlbGVjdGVkUGx1Z2luLCBzbyBhIHJlbmRlci10cmlnZ2VyaW5nIHN0YXRlIHZhciB3b3VsZCBiZSByZWR1bmRhbnQuXG4gIGNvbnN0IHBlbmRpbmdBdXRvQWN0aW9uUmVmID0gdXNlUmVmPFxuICAgICdlbmFibGUnIHwgJ2Rpc2FibGUnIHwgJ3VuaW5zdGFsbCcgfCB1bmRlZmluZWRcbiAgPih1bmRlZmluZWQpXG5cbiAgLy8gTUNQIHRvZ2dsZSBob29rXG4gIGNvbnN0IHRvZ2dsZU1jcFNlcnZlciA9IHVzZU1jcFRvZ2dsZUVuYWJsZWQoKVxuXG4gIC8vIEhhbmRsZSBlc2NhcGUgdG8gZ28gYmFjayAtIHZpZXdTdGF0ZS1kZXBlbmRlbnQgbmF2aWdhdGlvblxuICBjb25zdCBoYW5kbGVCYWNrID0gUmVhY3QudXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmICh2aWV3U3RhdGUgPT09ICdwbHVnaW4tZGV0YWlscycpIHtcbiAgICAgIHNldFZpZXdTdGF0ZSgncGx1Z2luLWxpc3QnKVxuICAgICAgc2V0U2VsZWN0ZWRQbHVnaW4obnVsbClcbiAgICAgIHNldFByb2Nlc3NFcnJvcihudWxsKVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICB0eXBlb2Ygdmlld1N0YXRlID09PSAnb2JqZWN0JyAmJlxuICAgICAgdmlld1N0YXRlLnR5cGUgPT09ICdmYWlsZWQtcGx1Z2luLWRldGFpbHMnXG4gICAgKSB7XG4gICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1saXN0JylcbiAgICAgIHNldFByb2Nlc3NFcnJvcihudWxsKVxuICAgIH0gZWxzZSBpZiAodmlld1N0YXRlID09PSAnY29uZmlndXJpbmcnKSB7XG4gICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1kZXRhaWxzJylcbiAgICAgIHNldENvbmZpZ05lZWRlZChudWxsKVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICB0eXBlb2Ygdmlld1N0YXRlID09PSAnb2JqZWN0JyAmJlxuICAgICAgKHZpZXdTdGF0ZS50eXBlID09PSAncGx1Z2luLW9wdGlvbnMnIHx8XG4gICAgICAgIHZpZXdTdGF0ZS50eXBlID09PSAnY29uZmlndXJpbmctb3B0aW9ucycpXG4gICAgKSB7XG4gICAgICAvLyBDYW5jZWwgbWlkLXNlcXVlbmNlIOKAlCBwbHVnaW4gaXMgYWxyZWFkeSBlbmFibGVkLCBqdXN0IGJhaWwgdG8gbGlzdC5cbiAgICAgIC8vIFVzZXIgY2FuIGNvbmZpZ3VyZSBsYXRlciB2aWEgdGhlIENvbmZpZ3VyZSBvcHRpb25zIG1lbnUgaWYgdGhleSB3YW50LlxuICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tbGlzdCcpXG4gICAgICBzZXRTZWxlY3RlZFBsdWdpbihudWxsKVxuICAgICAgc2V0UmVzdWx0KFxuICAgICAgICAnUGx1Z2luIGVuYWJsZWQuIENvbmZpZ3VyYXRpb24gc2tpcHBlZCDigJQgcnVuIC9yZWxvYWQtcGx1Z2lucyB0byBhcHBseS4nLFxuICAgICAgKVxuICAgICAgaWYgKG9uTWFuYWdlQ29tcGxldGUpIHtcbiAgICAgICAgdm9pZCBvbk1hbmFnZUNvbXBsZXRlKClcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKFxuICAgICAgdHlwZW9mIHZpZXdTdGF0ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHZpZXdTdGF0ZS50eXBlID09PSAnZmxhZ2dlZC1kZXRhaWwnXG4gICAgKSB7XG4gICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1saXN0JylcbiAgICAgIHNldFByb2Nlc3NFcnJvcihudWxsKVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICB0eXBlb2Ygdmlld1N0YXRlID09PSAnb2JqZWN0JyAmJlxuICAgICAgdmlld1N0YXRlLnR5cGUgPT09ICdtY3AtZGV0YWlsJ1xuICAgICkge1xuICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tbGlzdCcpXG4gICAgICBzZXRQcm9jZXNzRXJyb3IobnVsbClcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgdHlwZW9mIHZpZXdTdGF0ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHZpZXdTdGF0ZS50eXBlID09PSAnbWNwLXRvb2xzJ1xuICAgICkge1xuICAgICAgc2V0Vmlld1N0YXRlKHsgdHlwZTogJ21jcC1kZXRhaWwnLCBjbGllbnQ6IHZpZXdTdGF0ZS5jbGllbnQgfSlcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgdHlwZW9mIHZpZXdTdGF0ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgIHZpZXdTdGF0ZS50eXBlID09PSAnbWNwLXRvb2wtZGV0YWlsJ1xuICAgICkge1xuICAgICAgc2V0Vmlld1N0YXRlKHsgdHlwZTogJ21jcC10b29scycsIGNsaWVudDogdmlld1N0YXRlLmNsaWVudCB9KVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocGVuZGluZ1RvZ2dsZXMuc2l6ZSA+IDApIHtcbiAgICAgICAgc2V0UmVzdWx0KCdSdW4gL3JlbG9hZC1wbHVnaW5zIHRvIGFwcGx5IHBsdWdpbiBjaGFuZ2VzLicpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgc2V0UGFyZW50Vmlld1N0YXRlKHsgdHlwZTogJ21lbnUnIH0pXG4gICAgfVxuICB9LCBbdmlld1N0YXRlLCBzZXRQYXJlbnRWaWV3U3RhdGUsIHBlbmRpbmdUb2dnbGVzLCBzZXRSZXN1bHRdKVxuXG4gIC8vIEVzY2FwZSB3aGVuIG5vdCBpbiBzZWFyY2ggbW9kZSAtIGdvIGJhY2suXG4gIC8vIEV4Y2x1ZGVzIGNvbmZpcm0tcHJvamVjdC11bmluc3RhbGwgKGhhcyBpdHMgb3duIGNvbmZpcm06bm8gaGFuZGxlciBpblxuICAvLyBDb25maXJtYXRpb24gY29udGV4dCDigJQgbGV0dGluZyB0aGlzIGZpcmUgd291bGQgY3JlYXRlIGNvbXBldGluZyBoYW5kbGVycylcbiAgLy8gYW5kIGNvbmZpcm0tZGF0YS1jbGVhbnVwICh1c2VzIHJhdyB1c2VJbnB1dCB3aGVyZSBuIGFuZCBlc2NhcGUgYXJlXG4gIC8vIERJRkZFUkVOVCBhY3Rpb25zOiBrZWVwLWRhdGEgdnMgY2FuY2VsKS5cbiAgdXNlS2V5YmluZGluZygnY29uZmlybTpubycsIGhhbmRsZUJhY2ssIHtcbiAgICBjb250ZXh0OiAnQ29uZmlybWF0aW9uJyxcbiAgICBpc0FjdGl2ZTpcbiAgICAgICh2aWV3U3RhdGUgIT09ICdwbHVnaW4tbGlzdCcgfHwgIWlzU2VhcmNoTW9kZSkgJiZcbiAgICAgIHZpZXdTdGF0ZSAhPT0gJ2NvbmZpcm0tcHJvamVjdC11bmluc3RhbGwnICYmXG4gICAgICAhKFxuICAgICAgICB0eXBlb2Ygdmlld1N0YXRlID09PSAnb2JqZWN0JyAmJlxuICAgICAgICB2aWV3U3RhdGUudHlwZSA9PT0gJ2NvbmZpcm0tZGF0YS1jbGVhbnVwJ1xuICAgICAgKSxcbiAgfSlcblxuICAvLyBIZWxwZXIgdG8gZ2V0IE1DUCBzdGF0dXNcbiAgY29uc3QgZ2V0TWNwU3RhdHVzID0gKFxuICAgIGNsaWVudDogTUNQU2VydmVyQ29ubmVjdGlvbixcbiAgKTogJ2Nvbm5lY3RlZCcgfCAnZGlzYWJsZWQnIHwgJ3BlbmRpbmcnIHwgJ25lZWRzLWF1dGgnIHwgJ2ZhaWxlZCcgPT4ge1xuICAgIGlmIChjbGllbnQudHlwZSA9PT0gJ2Nvbm5lY3RlZCcpIHJldHVybiAnY29ubmVjdGVkJ1xuICAgIGlmIChjbGllbnQudHlwZSA9PT0gJ2Rpc2FibGVkJykgcmV0dXJuICdkaXNhYmxlZCdcbiAgICBpZiAoY2xpZW50LnR5cGUgPT09ICdwZW5kaW5nJykgcmV0dXJuICdwZW5kaW5nJ1xuICAgIGlmIChjbGllbnQudHlwZSA9PT0gJ25lZWRzLWF1dGgnKSByZXR1cm4gJ25lZWRzLWF1dGgnXG4gICAgcmV0dXJuICdmYWlsZWQnXG4gIH1cblxuICAvLyBEZXJpdmUgdW5pZmllZCBpdGVtcyBmcm9tIHBsdWdpbnMgYW5kIE1DUCBzZXJ2ZXJzXG4gIGNvbnN0IHVuaWZpZWRJdGVtcyA9IHVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IG1lcmdlZFNldHRpbmdzID0gZ2V0U2V0dGluZ3NfREVQUkVDQVRFRCgpXG5cbiAgICAvLyBCdWlsZCBtYXAgb2YgcGx1Z2luIG5hbWUgLT4gY2hpbGQgTUNQc1xuICAgIC8vIFBsdWdpbiBNQ1BzIGhhdmUgbmFtZXMgbGlrZSBcInBsdWdpbjpwbHVnaW5OYW1lOnNlcnZlck5hbWVcIlxuICAgIGNvbnN0IHBsdWdpbk1jcE1hcCA9IG5ldyBNYXA8XG4gICAgICBzdHJpbmcsXG4gICAgICBBcnJheTx7IGRpc3BsYXlOYW1lOiBzdHJpbmc7IGNsaWVudDogTUNQU2VydmVyQ29ubmVjdGlvbiB9PlxuICAgID4oKVxuICAgIGZvciAoY29uc3QgY2xpZW50IG9mIG1jcENsaWVudHMpIHtcbiAgICAgIGlmIChjbGllbnQubmFtZS5zdGFydHNXaXRoKCdwbHVnaW46JykpIHtcbiAgICAgICAgY29uc3QgcGFydHMgPSBjbGllbnQubmFtZS5zcGxpdCgnOicpXG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPj0gMykge1xuICAgICAgICAgIGNvbnN0IHBsdWdpbk5hbWUgPSBwYXJ0c1sxXSFcbiAgICAgICAgICBjb25zdCBzZXJ2ZXJOYW1lID0gcGFydHMuc2xpY2UoMikuam9pbignOicpXG4gICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBwbHVnaW5NY3BNYXAuZ2V0KHBsdWdpbk5hbWUpIHx8IFtdXG4gICAgICAgICAgZXhpc3RpbmcucHVzaCh7IGRpc3BsYXlOYW1lOiBzZXJ2ZXJOYW1lLCBjbGllbnQgfSlcbiAgICAgICAgICBwbHVnaW5NY3BNYXAuc2V0KHBsdWdpbk5hbWUsIGV4aXN0aW5nKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQnVpbGQgcGx1Z2luIGl0ZW1zICh1bnNvcnRlZCBmb3Igbm93KVxuICAgIHR5cGUgUGx1Z2luV2l0aENoaWxkcmVuID0ge1xuICAgICAgaXRlbTogVW5pZmllZEluc3RhbGxlZEl0ZW0gJiB7IHR5cGU6ICdwbHVnaW4nIH1cbiAgICAgIG9yaWdpbmFsU2NvcGU6ICd1c2VyJyB8ICdwcm9qZWN0JyB8ICdsb2NhbCcgfCAnbWFuYWdlZCcgfCAnYnVpbHRpbidcbiAgICAgIGNoaWxkTWNwczogQXJyYXk8eyBkaXNwbGF5TmFtZTogc3RyaW5nOyBjbGllbnQ6IE1DUFNlcnZlckNvbm5lY3Rpb24gfT5cbiAgICB9XG4gICAgY29uc3QgcGx1Z2luc1dpdGhDaGlsZHJlbjogUGx1Z2luV2l0aENoaWxkcmVuW10gPSBbXVxuXG4gICAgZm9yIChjb25zdCBzdGF0ZSBvZiBwbHVnaW5TdGF0ZXMpIHtcbiAgICAgIGNvbnN0IHBsdWdpbklkID0gYCR7c3RhdGUucGx1Z2luLm5hbWV9QCR7c3RhdGUubWFya2V0cGxhY2V9YFxuICAgICAgY29uc3QgaXNFbmFibGVkID0gbWVyZ2VkU2V0dGluZ3M/LmVuYWJsZWRQbHVnaW5zPy5bcGx1Z2luSWRdICE9PSBmYWxzZVxuICAgICAgY29uc3QgZXJyb3JzID0gcGx1Z2luRXJyb3JzLmZpbHRlcihcbiAgICAgICAgZSA9PlxuICAgICAgICAgICgncGx1Z2luJyBpbiBlICYmIGUucGx1Z2luID09PSBzdGF0ZS5wbHVnaW4ubmFtZSkgfHxcbiAgICAgICAgICBlLnNvdXJjZSA9PT0gcGx1Z2luSWQgfHxcbiAgICAgICAgICBlLnNvdXJjZS5zdGFydHNXaXRoKGAke3N0YXRlLnBsdWdpbi5uYW1lfUBgKSxcbiAgICAgIClcblxuICAgICAgLy8gQnVpbHQtaW4gcGx1Z2lucyB1c2UgJ2J1aWx0aW4nIHNjb3BlOyBvdGhlcnMgbG9vayB1cCBmcm9tIFYyIGRhdGEuXG4gICAgICBjb25zdCBvcmlnaW5hbFNjb3BlID0gc3RhdGUucGx1Z2luLmlzQnVpbHRpblxuICAgICAgICA/ICdidWlsdGluJ1xuICAgICAgICA6IHN0YXRlLnNjb3BlIHx8ICd1c2VyJ1xuXG4gICAgICBwbHVnaW5zV2l0aENoaWxkcmVuLnB1c2goe1xuICAgICAgICBpdGVtOiB7XG4gICAgICAgICAgdHlwZTogJ3BsdWdpbicsXG4gICAgICAgICAgaWQ6IHBsdWdpbklkLFxuICAgICAgICAgIG5hbWU6IHN0YXRlLnBsdWdpbi5uYW1lLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBzdGF0ZS5wbHVnaW4ubWFuaWZlc3QuZGVzY3JpcHRpb24sXG4gICAgICAgICAgbWFya2V0cGxhY2U6IHN0YXRlLm1hcmtldHBsYWNlLFxuICAgICAgICAgIHNjb3BlOiBvcmlnaW5hbFNjb3BlLFxuICAgICAgICAgIGlzRW5hYmxlZCxcbiAgICAgICAgICBlcnJvckNvdW50OiBlcnJvcnMubGVuZ3RoLFxuICAgICAgICAgIGVycm9ycyxcbiAgICAgICAgICBwbHVnaW46IHN0YXRlLnBsdWdpbixcbiAgICAgICAgICBwZW5kaW5nRW5hYmxlOiBzdGF0ZS5wZW5kaW5nRW5hYmxlLFxuICAgICAgICAgIHBlbmRpbmdVcGRhdGU6IHN0YXRlLnBlbmRpbmdVcGRhdGUsXG4gICAgICAgICAgcGVuZGluZ1RvZ2dsZTogcGVuZGluZ1RvZ2dsZXMuZ2V0KHBsdWdpbklkKSxcbiAgICAgICAgfSxcbiAgICAgICAgb3JpZ2luYWxTY29wZSxcbiAgICAgICAgY2hpbGRNY3BzOiBwbHVnaW5NY3BNYXAuZ2V0KHN0YXRlLnBsdWdpbi5uYW1lKSB8fCBbXSxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gRmluZCBvcnBoYW4gZXJyb3JzIChlcnJvcnMgZm9yIHBsdWdpbnMgdGhhdCBmYWlsZWQgdG8gbG9hZCBlbnRpcmVseSlcbiAgICBjb25zdCBtYXRjaGVkUGx1Z2luSWRzID0gbmV3IFNldChcbiAgICAgIHBsdWdpbnNXaXRoQ2hpbGRyZW4ubWFwKCh7IGl0ZW0gfSkgPT4gaXRlbS5pZCksXG4gICAgKVxuICAgIGNvbnN0IG1hdGNoZWRQbHVnaW5OYW1lcyA9IG5ldyBTZXQoXG4gICAgICBwbHVnaW5zV2l0aENoaWxkcmVuLm1hcCgoeyBpdGVtIH0pID0+IGl0ZW0ubmFtZSksXG4gICAgKVxuICAgIGNvbnN0IG9ycGhhbkVycm9yc0J5U291cmNlID0gbmV3IE1hcDxzdHJpbmcsIHR5cGVvZiBwbHVnaW5FcnJvcnM+KClcbiAgICBmb3IgKGNvbnN0IGVycm9yIG9mIHBsdWdpbkVycm9ycykge1xuICAgICAgaWYgKFxuICAgICAgICBtYXRjaGVkUGx1Z2luSWRzLmhhcyhlcnJvci5zb3VyY2UpIHx8XG4gICAgICAgICgncGx1Z2luJyBpbiBlcnJvciAmJlxuICAgICAgICAgIHR5cGVvZiBlcnJvci5wbHVnaW4gPT09ICdzdHJpbmcnICYmXG4gICAgICAgICAgbWF0Y2hlZFBsdWdpbk5hbWVzLmhhcyhlcnJvci5wbHVnaW4pKVxuICAgICAgKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBjb25zdCBleGlzdGluZyA9IG9ycGhhbkVycm9yc0J5U291cmNlLmdldChlcnJvci5zb3VyY2UpIHx8IFtdXG4gICAgICBleGlzdGluZy5wdXNoKGVycm9yKVxuICAgICAgb3JwaGFuRXJyb3JzQnlTb3VyY2Uuc2V0KGVycm9yLnNvdXJjZSwgZXhpc3RpbmcpXG4gICAgfVxuICAgIGNvbnN0IHBsdWdpblNjb3BlcyA9IGdldFBsdWdpbkVkaXRhYmxlU2NvcGVzKClcbiAgICBjb25zdCBmYWlsZWRQbHVnaW5JdGVtczogVW5pZmllZEluc3RhbGxlZEl0ZW1bXSA9IFtdXG4gICAgZm9yIChjb25zdCBbcGx1Z2luSWQsIGVycm9yc10gb2Ygb3JwaGFuRXJyb3JzQnlTb3VyY2UpIHtcbiAgICAgIC8vIFNraXAgcGx1Z2lucyB0aGF0IGFyZSBhbHJlYWR5IHNob3duIGluIHRoZSBmbGFnZ2VkIHNlY3Rpb25cbiAgICAgIGlmIChwbHVnaW5JZCBpbiBmbGFnZ2VkUGx1Z2lucykgY29udGludWVcbiAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlUGx1Z2luSWRlbnRpZmllcihwbHVnaW5JZClcbiAgICAgIGNvbnN0IHBsdWdpbk5hbWUgPSBwYXJzZWQubmFtZSB8fCBwbHVnaW5JZFxuICAgICAgY29uc3QgbWFya2V0cGxhY2UgPSBwYXJzZWQubWFya2V0cGxhY2UgfHwgJ3Vua25vd24nXG4gICAgICBjb25zdCByYXdTY29wZSA9IHBsdWdpblNjb3Blcy5nZXQocGx1Z2luSWQpXG4gICAgICAvLyAnZmxhZycgaXMgc2Vzc2lvbi1vbmx5IChmcm9tIC0tcGx1Z2luLWRpciAvIGZsYWdTZXR0aW5ncykgYW5kIHVuZGVmaW5lZFxuICAgICAgLy8gbWVhbnMgdGhlIHBsdWdpbiBpc24ndCBpbiBhbnkgc2V0dGluZ3Mgc291cmNlLiBEZWZhdWx0IGJvdGggdG8gJ3VzZXInXG4gICAgICAvLyBzaW5jZSBVbmlmaWVkSW5zdGFsbGVkSXRlbSBkb2Vzbid0IGhhdmUgYSAnZmxhZycgc2NvcGUgdmFyaWFudC5cbiAgICAgIGNvbnN0IHNjb3BlID1cbiAgICAgICAgcmF3U2NvcGUgPT09ICdmbGFnJyB8fCByYXdTY29wZSA9PT0gdW5kZWZpbmVkID8gJ3VzZXInIDogcmF3U2NvcGVcbiAgICAgIGZhaWxlZFBsdWdpbkl0ZW1zLnB1c2goe1xuICAgICAgICB0eXBlOiAnZmFpbGVkLXBsdWdpbicsXG4gICAgICAgIGlkOiBwbHVnaW5JZCxcbiAgICAgICAgbmFtZTogcGx1Z2luTmFtZSxcbiAgICAgICAgbWFya2V0cGxhY2UsXG4gICAgICAgIHNjb3BlLFxuICAgICAgICBlcnJvckNvdW50OiBlcnJvcnMubGVuZ3RoLFxuICAgICAgICBlcnJvcnMsXG4gICAgICB9KVxuICAgIH1cblxuICAgIC8vIEJ1aWxkIHN0YW5kYWxvbmUgTUNQIGl0ZW1zXG4gICAgY29uc3Qgc3RhbmRhbG9uZU1jcHM6IFVuaWZpZWRJbnN0YWxsZWRJdGVtW10gPSBbXVxuICAgIGZvciAoY29uc3QgY2xpZW50IG9mIG1jcENsaWVudHMpIHtcbiAgICAgIGlmIChjbGllbnQubmFtZSA9PT0gJ2lkZScpIGNvbnRpbnVlXG4gICAgICBpZiAoY2xpZW50Lm5hbWUuc3RhcnRzV2l0aCgncGx1Z2luOicpKSBjb250aW51ZVxuXG4gICAgICBzdGFuZGFsb25lTWNwcy5wdXNoKHtcbiAgICAgICAgdHlwZTogJ21jcCcsXG4gICAgICAgIGlkOiBgbWNwOiR7Y2xpZW50Lm5hbWV9YCxcbiAgICAgICAgbmFtZTogY2xpZW50Lm5hbWUsXG4gICAgICAgIGRlc2NyaXB0aW9uOiB1bmRlZmluZWQsXG4gICAgICAgIHNjb3BlOiBjbGllbnQuY29uZmlnLnNjb3BlLFxuICAgICAgICBzdGF0dXM6IGdldE1jcFN0YXR1cyhjbGllbnQpLFxuICAgICAgICBjbGllbnQsXG4gICAgICB9KVxuICAgIH1cblxuICAgIC8vIERlZmluZSBzY29wZSBvcmRlciBmb3IgZGlzcGxheVxuICAgIGNvbnN0IHNjb3BlT3JkZXI6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gICAgICBmbGFnZ2VkOiAtMSxcbiAgICAgIHByb2plY3Q6IDAsXG4gICAgICBsb2NhbDogMSxcbiAgICAgIHVzZXI6IDIsXG4gICAgICBlbnRlcnByaXNlOiAzLFxuICAgICAgbWFuYWdlZDogNCxcbiAgICAgIGR5bmFtaWM6IDUsXG4gICAgICBidWlsdGluOiA2LFxuICAgIH1cblxuICAgIC8vIEJ1aWxkIGZpbmFsIGxpc3QgYnkgbWVyZ2luZyBwbHVnaW5zICh3aXRoIHRoZWlyIGNoaWxkIE1DUHMpIGFuZCBzdGFuZGFsb25lIE1DUHNcbiAgICAvLyBHcm91cCBieSBzY29wZSB0byBhdm9pZCBkdXBsaWNhdGUgc2NvcGUgaGVhZGVyc1xuICAgIGNvbnN0IHVuaWZpZWQ6IFVuaWZpZWRJbnN0YWxsZWRJdGVtW10gPSBbXVxuXG4gICAgLy8gQ3JlYXRlIGEgbWFwIG9mIHNjb3BlIC0+IGl0ZW1zIGZvciBwcm9wZXIgbWVyZ2luZ1xuICAgIGNvbnN0IGl0ZW1zQnlTY29wZSA9IG5ldyBNYXA8c3RyaW5nLCBVbmlmaWVkSW5zdGFsbGVkSXRlbVtdPigpXG5cbiAgICAvLyBBZGQgcGx1Z2lucyB3aXRoIHRoZWlyIGNoaWxkIE1DUHNcbiAgICBmb3IgKGNvbnN0IHsgaXRlbSwgb3JpZ2luYWxTY29wZSwgY2hpbGRNY3BzIH0gb2YgcGx1Z2luc1dpdGhDaGlsZHJlbikge1xuICAgICAgY29uc3Qgc2NvcGUgPSBpdGVtLnNjb3BlXG4gICAgICBpZiAoIWl0ZW1zQnlTY29wZS5oYXMoc2NvcGUpKSB7XG4gICAgICAgIGl0ZW1zQnlTY29wZS5zZXQoc2NvcGUsIFtdKVxuICAgICAgfVxuICAgICAgaXRlbXNCeVNjb3BlLmdldChzY29wZSkhLnB1c2goaXRlbSlcbiAgICAgIC8vIEFkZCBjaGlsZCBNQ1BzIHJpZ2h0IGFmdGVyIHRoZSBwbHVnaW4sIGluZGVudGVkICh1c2Ugb3JpZ2luYWwgc2NvcGUsIG5vdCAnZmxhZ2dlZCcpLlxuICAgICAgLy8gQnVpbHQtaW4gcGx1Z2lucyBtYXAgdG8gJ3VzZXInIGZvciBkaXNwbGF5IHNpbmNlIE1DUCBDb25maWdTY29wZSBkb2Vzbid0IGluY2x1ZGUgJ2J1aWx0aW4nLlxuICAgICAgZm9yIChjb25zdCB7IGRpc3BsYXlOYW1lLCBjbGllbnQgfSBvZiBjaGlsZE1jcHMpIHtcbiAgICAgICAgY29uc3QgZGlzcGxheVNjb3BlID1cbiAgICAgICAgICBvcmlnaW5hbFNjb3BlID09PSAnYnVpbHRpbicgPyAndXNlcicgOiBvcmlnaW5hbFNjb3BlXG4gICAgICAgIGlmICghaXRlbXNCeVNjb3BlLmhhcyhkaXNwbGF5U2NvcGUpKSB7XG4gICAgICAgICAgaXRlbXNCeVNjb3BlLnNldChkaXNwbGF5U2NvcGUsIFtdKVxuICAgICAgICB9XG4gICAgICAgIGl0ZW1zQnlTY29wZS5nZXQoZGlzcGxheVNjb3BlKSEucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ21jcCcsXG4gICAgICAgICAgaWQ6IGBtY3A6JHtjbGllbnQubmFtZX1gLFxuICAgICAgICAgIG5hbWU6IGRpc3BsYXlOYW1lLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiB1bmRlZmluZWQsXG4gICAgICAgICAgc2NvcGU6IGRpc3BsYXlTY29wZSxcbiAgICAgICAgICBzdGF0dXM6IGdldE1jcFN0YXR1cyhjbGllbnQpLFxuICAgICAgICAgIGNsaWVudCxcbiAgICAgICAgICBpbmRlbnRlZDogdHJ1ZSxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBZGQgc3RhbmRhbG9uZSBNQ1BzIHRvIHRoZWlyIHJlc3BlY3RpdmUgc2NvcGUgZ3JvdXBzXG4gICAgZm9yIChjb25zdCBtY3Agb2Ygc3RhbmRhbG9uZU1jcHMpIHtcbiAgICAgIGNvbnN0IHNjb3BlID0gbWNwLnNjb3BlXG4gICAgICBpZiAoIWl0ZW1zQnlTY29wZS5oYXMoc2NvcGUpKSB7XG4gICAgICAgIGl0ZW1zQnlTY29wZS5zZXQoc2NvcGUsIFtdKVxuICAgICAgfVxuICAgICAgaXRlbXNCeVNjb3BlLmdldChzY29wZSkhLnB1c2gobWNwKVxuICAgIH1cblxuICAgIC8vIEFkZCBmYWlsZWQgcGx1Z2lucyB0byB0aGVpciByZXNwZWN0aXZlIHNjb3BlIGdyb3Vwc1xuICAgIGZvciAoY29uc3QgZmFpbGVkUGx1Z2luIG9mIGZhaWxlZFBsdWdpbkl0ZW1zKSB7XG4gICAgICBjb25zdCBzY29wZSA9IGZhaWxlZFBsdWdpbi5zY29wZVxuICAgICAgaWYgKCFpdGVtc0J5U2NvcGUuaGFzKHNjb3BlKSkge1xuICAgICAgICBpdGVtc0J5U2NvcGUuc2V0KHNjb3BlLCBbXSlcbiAgICAgIH1cbiAgICAgIGl0ZW1zQnlTY29wZS5nZXQoc2NvcGUpIS5wdXNoKGZhaWxlZFBsdWdpbilcbiAgICB9XG5cbiAgICAvLyBBZGQgZmxhZ2dlZCAoZGVsaXN0ZWQpIHBsdWdpbnMgZnJvbSB1c2VyIHNldHRpbmdzLlxuICAgIC8vIFJlYXNvbi90ZXh0IGFyZSBsb29rZWQgdXAgZnJvbSB0aGUgY2FjaGVkIHNlY3VyaXR5IG1lc3NhZ2VzIGZpbGUuXG4gICAgZm9yIChjb25zdCBbcGx1Z2luSWQsIGVudHJ5XSBvZiBPYmplY3QuZW50cmllcyhmbGFnZ2VkUGx1Z2lucykpIHtcbiAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlUGx1Z2luSWRlbnRpZmllcihwbHVnaW5JZClcbiAgICAgIGNvbnN0IHBsdWdpbk5hbWUgPSBwYXJzZWQubmFtZSB8fCBwbHVnaW5JZFxuICAgICAgY29uc3QgbWFya2V0cGxhY2UgPSBwYXJzZWQubWFya2V0cGxhY2UgfHwgJ3Vua25vd24nXG4gICAgICBpZiAoIWl0ZW1zQnlTY29wZS5oYXMoJ2ZsYWdnZWQnKSkge1xuICAgICAgICBpdGVtc0J5U2NvcGUuc2V0KCdmbGFnZ2VkJywgW10pXG4gICAgICB9XG4gICAgICBpdGVtc0J5U2NvcGUuZ2V0KCdmbGFnZ2VkJykhLnB1c2goe1xuICAgICAgICB0eXBlOiAnZmxhZ2dlZC1wbHVnaW4nLFxuICAgICAgICBpZDogcGx1Z2luSWQsXG4gICAgICAgIG5hbWU6IHBsdWdpbk5hbWUsXG4gICAgICAgIG1hcmtldHBsYWNlLFxuICAgICAgICBzY29wZTogJ2ZsYWdnZWQnLFxuICAgICAgICByZWFzb246ICdkZWxpc3RlZCcsXG4gICAgICAgIHRleHQ6ICdSZW1vdmVkIGZyb20gbWFya2V0cGxhY2UnLFxuICAgICAgICBmbGFnZ2VkQXQ6IGVudHJ5LmZsYWdnZWRBdCxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gU29ydCBzY29wZXMgYW5kIGJ1aWxkIGZpbmFsIGxpc3RcbiAgICBjb25zdCBzb3J0ZWRTY29wZXMgPSBbLi4uaXRlbXNCeVNjb3BlLmtleXMoKV0uc29ydChcbiAgICAgIChhLCBiKSA9PiAoc2NvcGVPcmRlclthXSA/PyA5OSkgLSAoc2NvcGVPcmRlcltiXSA/PyA5OSksXG4gICAgKVxuXG4gICAgZm9yIChjb25zdCBzY29wZSBvZiBzb3J0ZWRTY29wZXMpIHtcbiAgICAgIGNvbnN0IGl0ZW1zID0gaXRlbXNCeVNjb3BlLmdldChzY29wZSkhXG5cbiAgICAgIC8vIFNlcGFyYXRlIGl0ZW1zIGludG8gcGx1Z2luIGdyb3VwcyAod2l0aCB0aGVpciBjaGlsZCBNQ1BzKSBhbmQgc3RhbmRhbG9uZSBNQ1BzXG4gICAgICAvLyBUaGlzIHByZXNlcnZlcyBwYXJlbnQtY2hpbGQgcmVsYXRpb25zaGlwcyB0aGF0IHdvdWxkIGJlIGJyb2tlbiBieSBuYWl2ZSBzb3J0aW5nXG4gICAgICBjb25zdCBwbHVnaW5Hcm91cHM6IFVuaWZpZWRJbnN0YWxsZWRJdGVtW11bXSA9IFtdXG4gICAgICBjb25zdCBzdGFuZGFsb25lTWNwc0luU2NvcGU6IFVuaWZpZWRJbnN0YWxsZWRJdGVtW10gPSBbXVxuXG4gICAgICBsZXQgaSA9IDBcbiAgICAgIHdoaWxlIChpIDwgaXRlbXMubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBpdGVtc1tpXSFcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGl0ZW0udHlwZSA9PT0gJ3BsdWdpbicgfHxcbiAgICAgICAgICBpdGVtLnR5cGUgPT09ICdmYWlsZWQtcGx1Z2luJyB8fFxuICAgICAgICAgIGl0ZW0udHlwZSA9PT0gJ2ZsYWdnZWQtcGx1Z2luJ1xuICAgICAgICApIHtcbiAgICAgICAgICAvLyBDb2xsZWN0IHRoZSBwbHVnaW4gYW5kIGl0cyBjaGlsZCBNQ1BzIGFzIGEgZ3JvdXBcbiAgICAgICAgICBjb25zdCBncm91cDogVW5pZmllZEluc3RhbGxlZEl0ZW1bXSA9IFtpdGVtXVxuICAgICAgICAgIGkrK1xuICAgICAgICAgIC8vIExvb2sgYWhlYWQgZm9yIGluZGVudGVkIGNoaWxkIE1DUHNcbiAgICAgICAgICBsZXQgbmV4dEl0ZW0gPSBpdGVtc1tpXVxuICAgICAgICAgIHdoaWxlIChuZXh0SXRlbT8udHlwZSA9PT0gJ21jcCcgJiYgbmV4dEl0ZW0uaW5kZW50ZWQpIHtcbiAgICAgICAgICAgIGdyb3VwLnB1c2gobmV4dEl0ZW0pXG4gICAgICAgICAgICBpKytcbiAgICAgICAgICAgIG5leHRJdGVtID0gaXRlbXNbaV1cbiAgICAgICAgICB9XG4gICAgICAgICAgcGx1Z2luR3JvdXBzLnB1c2goZ3JvdXApXG4gICAgICAgIH0gZWxzZSBpZiAoaXRlbS50eXBlID09PSAnbWNwJyAmJiAhaXRlbS5pbmRlbnRlZCkge1xuICAgICAgICAgIC8vIFN0YW5kYWxvbmUgTUNQIChub3QgYSBjaGlsZCBvZiBhIHBsdWdpbilcbiAgICAgICAgICBzdGFuZGFsb25lTWNwc0luU2NvcGUucHVzaChpdGVtKVxuICAgICAgICAgIGkrK1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFNraXAgb3JwaGFuZWQgaW5kZW50ZWQgTUNQcyAoc2hvdWxkbid0IGhhcHBlbilcbiAgICAgICAgICBpKytcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBTb3J0IHBsdWdpbiBncm91cHMgYnkgdGhlIHBsdWdpbiBuYW1lIChmaXJzdCBpdGVtIGluIGVhY2ggZ3JvdXApXG4gICAgICBwbHVnaW5Hcm91cHMuc29ydCgoYSwgYikgPT4gYVswXSEubmFtZS5sb2NhbGVDb21wYXJlKGJbMF0hLm5hbWUpKVxuXG4gICAgICAvLyBTb3J0IHN0YW5kYWxvbmUgTUNQcyBieSBuYW1lXG4gICAgICBzdGFuZGFsb25lTWNwc0luU2NvcGUuc29ydCgoYSwgYikgPT4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKSlcblxuICAgICAgLy8gQnVpbGQgZmluYWwgbGlzdDogcGx1Z2lucyAod2l0aCB0aGVpciBjaGlsZHJlbikgZmlyc3QsIHRoZW4gc3RhbmRhbG9uZSBNQ1BzXG4gICAgICBmb3IgKGNvbnN0IGdyb3VwIG9mIHBsdWdpbkdyb3Vwcykge1xuICAgICAgICB1bmlmaWVkLnB1c2goLi4uZ3JvdXApXG4gICAgICB9XG4gICAgICB1bmlmaWVkLnB1c2goLi4uc3RhbmRhbG9uZU1jcHNJblNjb3BlKVxuICAgIH1cblxuICAgIHJldHVybiB1bmlmaWVkXG4gIH0sIFtwbHVnaW5TdGF0ZXMsIG1jcENsaWVudHMsIHBsdWdpbkVycm9ycywgcGVuZGluZ1RvZ2dsZXMsIGZsYWdnZWRQbHVnaW5zXSlcblxuICAvLyBNYXJrIGZsYWdnZWQgcGx1Z2lucyBhcyBzZWVuIHdoZW4gdGhlIEluc3RhbGxlZCB2aWV3IHJlbmRlcnMgdGhlbS5cbiAgLy8gQWZ0ZXIgNDggaG91cnMgZnJvbSBzZWVuQXQsIHRoZXkgYXV0by1jbGVhciBvbiBuZXh0IGxvYWQuXG4gIGNvbnN0IGZsYWdnZWRJZHMgPSB1c2VNZW1vKFxuICAgICgpID0+XG4gICAgICB1bmlmaWVkSXRlbXNcbiAgICAgICAgLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2ZsYWdnZWQtcGx1Z2luJylcbiAgICAgICAgLm1hcChpdGVtID0+IGl0ZW0uaWQpLFxuICAgIFt1bmlmaWVkSXRlbXNdLFxuICApXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGZsYWdnZWRJZHMubGVuZ3RoID4gMCkge1xuICAgICAgdm9pZCBtYXJrRmxhZ2dlZFBsdWdpbnNTZWVuKGZsYWdnZWRJZHMpXG4gICAgfVxuICB9LCBbZmxhZ2dlZElkc10pXG5cbiAgLy8gRmlsdGVyIGl0ZW1zIGJhc2VkIG9uIHNlYXJjaCBxdWVyeSAobWF0Y2hlcyBuYW1lIG9yIGRlc2NyaXB0aW9uKVxuICBjb25zdCBmaWx0ZXJlZEl0ZW1zID0gdXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCFzZWFyY2hRdWVyeSkgcmV0dXJuIHVuaWZpZWRJdGVtc1xuICAgIGNvbnN0IGxvd2VyUXVlcnkgPSBzZWFyY2hRdWVyeS50b0xvd2VyQ2FzZSgpXG4gICAgcmV0dXJuIHVuaWZpZWRJdGVtcy5maWx0ZXIoXG4gICAgICBpdGVtID0+XG4gICAgICAgIGl0ZW0ubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGxvd2VyUXVlcnkpIHx8XG4gICAgICAgICgnZGVzY3JpcHRpb24nIGluIGl0ZW0gJiZcbiAgICAgICAgICBpdGVtLmRlc2NyaXB0aW9uPy50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGxvd2VyUXVlcnkpKSxcbiAgICApXG4gIH0sIFt1bmlmaWVkSXRlbXMsIHNlYXJjaFF1ZXJ5XSlcblxuICAvLyBTZWxlY3Rpb24gc3RhdGVcbiAgY29uc3QgW3NlbGVjdGVkSW5kZXgsIHNldFNlbGVjdGVkSW5kZXhdID0gdXNlU3RhdGUoMClcblxuICAvLyBQYWdpbmF0aW9uIGZvciB1bmlmaWVkIGxpc3QgKGNvbnRpbnVvdXMgc2Nyb2xsaW5nKVxuICBjb25zdCBwYWdpbmF0aW9uID0gdXNlUGFnaW5hdGlvbjxVbmlmaWVkSW5zdGFsbGVkSXRlbT4oe1xuICAgIHRvdGFsSXRlbXM6IGZpbHRlcmVkSXRlbXMubGVuZ3RoLFxuICAgIHNlbGVjdGVkSW5kZXgsXG4gICAgbWF4VmlzaWJsZTogOCxcbiAgfSlcblxuICAvLyBEZXRhaWxzIHZpZXcgc3RhdGVcbiAgY29uc3QgW2RldGFpbHNNZW51SW5kZXgsIHNldERldGFpbHNNZW51SW5kZXhdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgW2lzUHJvY2Vzc2luZywgc2V0SXNQcm9jZXNzaW5nXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbcHJvY2Vzc0Vycm9yLCBzZXRQcm9jZXNzRXJyb3JdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcblxuICAvLyBDb25maWd1cmF0aW9uIHN0YXRlXG4gIGNvbnN0IFtjb25maWdOZWVkZWQsIHNldENvbmZpZ05lZWRlZF0gPVxuICAgIHVzZVN0YXRlPE1jcGJOZWVkc0NvbmZpZ1Jlc3VsdCB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtfaXNMb2FkaW5nQ29uZmlnLCBzZXRJc0xvYWRpbmdDb25maWddID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtzZWxlY3RlZFBsdWdpbkhhc01jcGIsIHNldFNlbGVjdGVkUGx1Z2luSGFzTWNwYl0gPSB1c2VTdGF0ZShmYWxzZSlcblxuICAvLyBEZXRlY3QgaWYgc2VsZWN0ZWQgcGx1Z2luIGhhcyBNQ1BCXG4gIC8vIFJlYWRzIHJhdyBtYXJrZXRwbGFjZS5qc29uIHRvIHdvcmsgd2l0aCBvbGQgY2FjaGVkIG1hcmtldHBsYWNlc1xuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghc2VsZWN0ZWRQbHVnaW4pIHtcbiAgICAgIHNldFNlbGVjdGVkUGx1Z2luSGFzTWNwYihmYWxzZSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGFzeW5jIGZ1bmN0aW9uIGRldGVjdE1jcGIoKSB7XG4gICAgICAvLyBDaGVjayBwbHVnaW4gbWFuaWZlc3QgZmlyc3RcbiAgICAgIGNvbnN0IG1jcFNlcnZlcnNTcGVjID0gc2VsZWN0ZWRQbHVnaW4hLnBsdWdpbi5tYW5pZmVzdC5tY3BTZXJ2ZXJzXG4gICAgICBsZXQgaGFzTWNwYiA9IGZhbHNlXG5cbiAgICAgIGlmIChtY3BTZXJ2ZXJzU3BlYykge1xuICAgICAgICBoYXNNY3BiID1cbiAgICAgICAgICAodHlwZW9mIG1jcFNlcnZlcnNTcGVjID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgICAgaXNNY3BiU291cmNlKG1jcFNlcnZlcnNTcGVjKSkgfHxcbiAgICAgICAgICAoQXJyYXkuaXNBcnJheShtY3BTZXJ2ZXJzU3BlYykgJiZcbiAgICAgICAgICAgIG1jcFNlcnZlcnNTcGVjLnNvbWUocyA9PiB0eXBlb2YgcyA9PT0gJ3N0cmluZycgJiYgaXNNY3BiU291cmNlKHMpKSlcbiAgICAgIH1cblxuICAgICAgLy8gSWYgbm90IGluIG1hbmlmZXN0LCByZWFkIHJhdyBtYXJrZXRwbGFjZS5qc29uIGRpcmVjdGx5IChieXBhc3Npbmcgc2NoZW1hIHZhbGlkYXRpb24pXG4gICAgICAvLyBUaGlzIHdvcmtzIGV2ZW4gd2l0aCBvbGQgY2FjaGVkIG1hcmtldHBsYWNlcyBmcm9tIGJlZm9yZSBNQ1BCIHN1cHBvcnRcbiAgICAgIGlmICghaGFzTWNwYikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IG1hcmtldHBsYWNlRGlyID0gcGF0aC5qb2luKHNlbGVjdGVkUGx1Z2luIS5wbHVnaW4ucGF0aCwgJy4uJylcbiAgICAgICAgICBjb25zdCBtYXJrZXRwbGFjZUpzb25QYXRoID0gcGF0aC5qb2luKFxuICAgICAgICAgICAgbWFya2V0cGxhY2VEaXIsXG4gICAgICAgICAgICAnLmNsYXVkZS1wbHVnaW4nLFxuICAgICAgICAgICAgJ21hcmtldHBsYWNlLmpzb24nLFxuICAgICAgICAgIClcblxuICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZShtYXJrZXRwbGFjZUpzb25QYXRoLCAndXRmLTgnKVxuICAgICAgICAgIGNvbnN0IG1hcmtldHBsYWNlID0ganNvblBhcnNlKGNvbnRlbnQpXG5cbiAgICAgICAgICBjb25zdCBlbnRyeSA9IG1hcmtldHBsYWNlLnBsdWdpbnM/LmZpbmQoXG4gICAgICAgICAgICAocDogeyBuYW1lOiBzdHJpbmcgfSkgPT4gcC5uYW1lID09PSBzZWxlY3RlZFBsdWdpbiEucGx1Z2luLm5hbWUsXG4gICAgICAgICAgKVxuXG4gICAgICAgICAgaWYgKGVudHJ5Py5tY3BTZXJ2ZXJzKSB7XG4gICAgICAgICAgICBjb25zdCBzcGVjID0gZW50cnkubWNwU2VydmVyc1xuICAgICAgICAgICAgaGFzTWNwYiA9XG4gICAgICAgICAgICAgICh0eXBlb2Ygc3BlYyA9PT0gJ3N0cmluZycgJiYgaXNNY3BiU291cmNlKHNwZWMpKSB8fFxuICAgICAgICAgICAgICAoQXJyYXkuaXNBcnJheShzcGVjKSAmJlxuICAgICAgICAgICAgICAgIHNwZWMuc29tZShcbiAgICAgICAgICAgICAgICAgIChzOiB1bmtub3duKSA9PiB0eXBlb2YgcyA9PT0gJ3N0cmluZycgJiYgaXNNY3BiU291cmNlKHMpLFxuICAgICAgICAgICAgICAgICkpXG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoYEZhaWxlZCB0byByZWFkIHJhdyBtYXJrZXRwbGFjZS5qc29uOiAke2Vycn1gKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHNldFNlbGVjdGVkUGx1Z2luSGFzTWNwYihoYXNNY3BiKVxuICAgIH1cblxuICAgIHZvaWQgZGV0ZWN0TWNwYigpXG4gIH0sIFtzZWxlY3RlZFBsdWdpbl0pXG5cbiAgLy8gTG9hZCBpbnN0YWxsZWQgcGx1Z2lucyBncm91cGVkIGJ5IG1hcmtldHBsYWNlXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXN5bmMgZnVuY3Rpb24gbG9hZEluc3RhbGxlZFBsdWdpbnMoKSB7XG4gICAgICBzZXRMb2FkaW5nKHRydWUpXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGVuYWJsZWQsIGRpc2FibGVkIH0gPSBhd2FpdCBsb2FkQWxsUGx1Z2lucygpXG4gICAgICAgIGNvbnN0IG1lcmdlZFNldHRpbmdzID0gZ2V0U2V0dGluZ3NfREVQUkVDQVRFRCgpIC8vIFVzZSBtZXJnZWQgc2V0dGluZ3MgdG8gcmVzcGVjdCBhbGwgbGF5ZXJzXG5cbiAgICAgICAgY29uc3QgYWxsUGx1Z2lucyA9IGZpbHRlck1hbmFnZWREaXNhYmxlZFBsdWdpbnMoW1xuICAgICAgICAgIC4uLmVuYWJsZWQsXG4gICAgICAgICAgLi4uZGlzYWJsZWQsXG4gICAgICAgIF0pXG5cbiAgICAgICAgLy8gR3JvdXAgcGx1Z2lucyBieSBtYXJrZXRwbGFjZVxuICAgICAgICBjb25zdCBwbHVnaW5zQnlNYXJrZXRwbGFjZTogUmVjb3JkPHN0cmluZywgTG9hZGVkUGx1Z2luW10+ID0ge31cbiAgICAgICAgZm9yIChjb25zdCBwbHVnaW4gb2YgYWxsUGx1Z2lucykge1xuICAgICAgICAgIGNvbnN0IG1hcmtldHBsYWNlID0gcGx1Z2luLnNvdXJjZS5zcGxpdCgnQCcpWzFdIHx8ICdsb2NhbCdcbiAgICAgICAgICBpZiAoIXBsdWdpbnNCeU1hcmtldHBsYWNlW21hcmtldHBsYWNlXSkge1xuICAgICAgICAgICAgcGx1Z2luc0J5TWFya2V0cGxhY2VbbWFya2V0cGxhY2VdID0gW11cbiAgICAgICAgICB9XG4gICAgICAgICAgcGx1Z2luc0J5TWFya2V0cGxhY2VbbWFya2V0cGxhY2VdIS5wdXNoKHBsdWdpbilcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENyZWF0ZSBtYXJrZXRwbGFjZSBpbmZvIGFycmF5IHdpdGggZW5hYmxlZC9kaXNhYmxlZCBjb3VudHNcbiAgICAgICAgY29uc3QgbWFya2V0cGxhY2VJbmZvczogTWFya2V0cGxhY2VJbmZvW10gPSBbXVxuICAgICAgICBmb3IgKGNvbnN0IFtuYW1lLCBwbHVnaW5zXSBvZiBPYmplY3QuZW50cmllcyhwbHVnaW5zQnlNYXJrZXRwbGFjZSkpIHtcbiAgICAgICAgICBjb25zdCBlbmFibGVkQ291bnQgPSBjb3VudChwbHVnaW5zLCBwID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBsdWdpbklkID0gYCR7cC5uYW1lfUAke25hbWV9YFxuICAgICAgICAgICAgcmV0dXJuIG1lcmdlZFNldHRpbmdzPy5lbmFibGVkUGx1Z2lucz8uW3BsdWdpbklkXSAhPT0gZmFsc2VcbiAgICAgICAgICB9KVxuICAgICAgICAgIGNvbnN0IGRpc2FibGVkQ291bnQgPSBwbHVnaW5zLmxlbmd0aCAtIGVuYWJsZWRDb3VudFxuXG4gICAgICAgICAgbWFya2V0cGxhY2VJbmZvcy5wdXNoKHtcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICBpbnN0YWxsZWRQbHVnaW5zOiBwbHVnaW5zLFxuICAgICAgICAgICAgZW5hYmxlZENvdW50LFxuICAgICAgICAgICAgZGlzYWJsZWRDb3VudCxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU29ydCBtYXJrZXRwbGFjZXM6IGNsYXVkZS1wbHVnaW4tZGlyZWN0b3J5IGZpcnN0LCB0aGVuIGFscGhhYmV0aWNhbGx5XG4gICAgICAgIG1hcmtldHBsYWNlSW5mb3Muc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgIGlmIChhLm5hbWUgPT09ICdjbGF1ZGUtcGx1Z2luLWRpcmVjdG9yeScpIHJldHVybiAtMVxuICAgICAgICAgIGlmIChiLm5hbWUgPT09ICdjbGF1ZGUtcGx1Z2luLWRpcmVjdG9yeScpIHJldHVybiAxXG4gICAgICAgICAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSlcbiAgICAgICAgfSlcblxuICAgICAgICBzZXRNYXJrZXRwbGFjZXMobWFya2V0cGxhY2VJbmZvcylcblxuICAgICAgICAvLyBCdWlsZCBmbGF0IGxpc3Qgb2YgYWxsIHBsdWdpbiBzdGF0ZXNcbiAgICAgICAgY29uc3QgYWxsU3RhdGVzOiBQbHVnaW5TdGF0ZVtdID0gW11cbiAgICAgICAgZm9yIChjb25zdCBtYXJrZXRwbGFjZSBvZiBtYXJrZXRwbGFjZUluZm9zKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBwbHVnaW4gb2YgbWFya2V0cGxhY2UuaW5zdGFsbGVkUGx1Z2lucykge1xuICAgICAgICAgICAgY29uc3QgcGx1Z2luSWQgPSBgJHtwbHVnaW4ubmFtZX1AJHttYXJrZXRwbGFjZS5uYW1lfWBcbiAgICAgICAgICAgIC8vIEJ1aWx0LWluIHBsdWdpbnMgZG9uJ3QgaGF2ZSBWMiBpbnN0YWxsIGVudHJpZXMg4oCUIHNraXAgdGhlIGxvb2t1cC5cbiAgICAgICAgICAgIGNvbnN0IHNjb3BlID0gcGx1Z2luLmlzQnVpbHRpblxuICAgICAgICAgICAgICA/ICdidWlsdGluJ1xuICAgICAgICAgICAgICA6IGdldFBsdWdpbkluc3RhbGxhdGlvbkZyb21WMihwbHVnaW5JZCkuc2NvcGVcblxuICAgICAgICAgICAgYWxsU3RhdGVzLnB1c2goe1xuICAgICAgICAgICAgICBwbHVnaW4sXG4gICAgICAgICAgICAgIG1hcmtldHBsYWNlOiBtYXJrZXRwbGFjZS5uYW1lLFxuICAgICAgICAgICAgICBzY29wZSxcbiAgICAgICAgICAgICAgcGVuZGluZ0VuYWJsZTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICBwZW5kaW5nVXBkYXRlOiBmYWxzZSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNldFBsdWdpblN0YXRlcyhhbGxTdGF0ZXMpXG4gICAgICAgIHNldFNlbGVjdGVkSW5kZXgoMClcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNldExvYWRpbmcoZmFsc2UpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdm9pZCBsb2FkSW5zdGFsbGVkUGx1Z2lucygpXG4gIH0sIFtdKVxuXG4gIC8vIEF1dG8tbmF2aWdhdGUgdG8gdGFyZ2V0IHBsdWdpbiBpZiBzcGVjaWZpZWQgKG9uY2Ugb25seSlcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaGFzQXV0b05hdmlnYXRlZC5jdXJyZW50KSByZXR1cm5cbiAgICBpZiAodGFyZ2V0UGx1Z2luICYmIG1hcmtldHBsYWNlcy5sZW5ndGggPiAwICYmICFsb2FkaW5nKSB7XG4gICAgICAvLyB0YXJnZXRQbHVnaW4gbWF5IGJlIGBuYW1lYCBvciBgbmFtZUBtYXJrZXRwbGFjZWAgKHBhcnNlQXJncyBwYXNzZXMgdGhlXG4gICAgICAvLyByYXcgYXJnIHRocm91Z2gpLiBQYXJzZSBpdCBzbyBwLm5hbWUgbWF0Y2hpbmcgd29ya3MgZWl0aGVyIHdheS5cbiAgICAgIGNvbnN0IHsgbmFtZTogdGFyZ2V0TmFtZSwgbWFya2V0cGxhY2U6IHRhcmdldE1rdEZyb21JZCB9ID1cbiAgICAgICAgcGFyc2VQbHVnaW5JZGVudGlmaWVyKHRhcmdldFBsdWdpbilcbiAgICAgIGNvbnN0IGVmZmVjdGl2ZVRhcmdldE1hcmtldHBsYWNlID0gdGFyZ2V0TWFya2V0cGxhY2UgPz8gdGFyZ2V0TWt0RnJvbUlkXG5cbiAgICAgIC8vIFVzZSB0YXJnZXRNYXJrZXRwbGFjZSBpZiBwcm92aWRlZCwgb3RoZXJ3aXNlIHNlYXJjaCBhbGxcbiAgICAgIGNvbnN0IG1hcmtldHBsYWNlc1RvU2VhcmNoID0gZWZmZWN0aXZlVGFyZ2V0TWFya2V0cGxhY2VcbiAgICAgICAgPyBtYXJrZXRwbGFjZXMuZmlsdGVyKG0gPT4gbS5uYW1lID09PSBlZmZlY3RpdmVUYXJnZXRNYXJrZXRwbGFjZSlcbiAgICAgICAgOiBtYXJrZXRwbGFjZXNcblxuICAgICAgLy8gRmlyc3QgY2hlY2sgc3VjY2Vzc2Z1bGx5IGxvYWRlZCBwbHVnaW5zXG4gICAgICBmb3IgKGNvbnN0IG1hcmtldHBsYWNlIG9mIG1hcmtldHBsYWNlc1RvU2VhcmNoKSB7XG4gICAgICAgIGNvbnN0IHBsdWdpbiA9IG1hcmtldHBsYWNlLmluc3RhbGxlZFBsdWdpbnMuZmluZChcbiAgICAgICAgICBwID0+IHAubmFtZSA9PT0gdGFyZ2V0TmFtZSxcbiAgICAgICAgKVxuICAgICAgICBpZiAocGx1Z2luKSB7XG4gICAgICAgICAgLy8gR2V0IHNjb3BlIGZyb20gVjIgZGF0YSBmb3IgcHJvcGVyIG9wZXJhdGlvbiBoYW5kbGluZ1xuICAgICAgICAgIGNvbnN0IHBsdWdpbklkID0gYCR7cGx1Z2luLm5hbWV9QCR7bWFya2V0cGxhY2UubmFtZX1gXG4gICAgICAgICAgY29uc3QgeyBzY29wZSB9ID0gZ2V0UGx1Z2luSW5zdGFsbGF0aW9uRnJvbVYyKHBsdWdpbklkKVxuXG4gICAgICAgICAgY29uc3QgcGx1Z2luU3RhdGU6IFBsdWdpblN0YXRlID0ge1xuICAgICAgICAgICAgcGx1Z2luLFxuICAgICAgICAgICAgbWFya2V0cGxhY2U6IG1hcmtldHBsYWNlLm5hbWUsXG4gICAgICAgICAgICBzY29wZSxcbiAgICAgICAgICAgIHBlbmRpbmdFbmFibGU6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHBlbmRpbmdVcGRhdGU6IGZhbHNlLFxuICAgICAgICAgIH1cbiAgICAgICAgICBzZXRTZWxlY3RlZFBsdWdpbihwbHVnaW5TdGF0ZSlcbiAgICAgICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1kZXRhaWxzJylcbiAgICAgICAgICBwZW5kaW5nQXV0b0FjdGlvblJlZi5jdXJyZW50ID0gYWN0aW9uXG4gICAgICAgICAgaGFzQXV0b05hdmlnYXRlZC5jdXJyZW50ID0gdHJ1ZVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEZhbGwgYmFjayB0byBmYWlsZWQgcGx1Z2lucyAodGhvc2Ugd2l0aCBlcnJvcnMgYnV0IG5vdCBsb2FkZWQpXG4gICAgICBjb25zdCBmYWlsZWRJdGVtID0gdW5pZmllZEl0ZW1zLmZpbmQoXG4gICAgICAgIGl0ZW0gPT4gaXRlbS50eXBlID09PSAnZmFpbGVkLXBsdWdpbicgJiYgaXRlbS5uYW1lID09PSB0YXJnZXROYW1lLFxuICAgICAgKVxuICAgICAgaWYgKGZhaWxlZEl0ZW0gJiYgZmFpbGVkSXRlbS50eXBlID09PSAnZmFpbGVkLXBsdWdpbicpIHtcbiAgICAgICAgc2V0Vmlld1N0YXRlKHtcbiAgICAgICAgICB0eXBlOiAnZmFpbGVkLXBsdWdpbi1kZXRhaWxzJyxcbiAgICAgICAgICBwbHVnaW46IHtcbiAgICAgICAgICAgIGlkOiBmYWlsZWRJdGVtLmlkLFxuICAgICAgICAgICAgbmFtZTogZmFpbGVkSXRlbS5uYW1lLFxuICAgICAgICAgICAgbWFya2V0cGxhY2U6IGZhaWxlZEl0ZW0ubWFya2V0cGxhY2UsXG4gICAgICAgICAgICBlcnJvcnM6IGZhaWxlZEl0ZW0uZXJyb3JzLFxuICAgICAgICAgICAgc2NvcGU6IGZhaWxlZEl0ZW0uc2NvcGUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSlcbiAgICAgICAgaGFzQXV0b05hdmlnYXRlZC5jdXJyZW50ID0gdHJ1ZVxuICAgICAgfVxuXG4gICAgICAvLyBObyBtYXRjaCBpbiBsb2FkZWQgT1IgZmFpbGVkIHBsdWdpbnMg4oCUIGNsb3NlIHRoZSBkaWFsb2cgd2l0aCBhXG4gICAgICAvLyBtZXNzYWdlIHJhdGhlciB0aGFuIHNpbGVudGx5IGxhbmRpbmcgb24gdGhlIHBsdWdpbiBsaXN0LiBPbmx5IGRvXG4gICAgICAvLyB0aGlzIHdoZW4gYW4gYWN0aW9uIHdhcyByZXF1ZXN0ZWQgKGUuZy4gL3BsdWdpbiB1bmluc3RhbGwgWCk7XG4gICAgICAvLyBwbGFpbiBuYXZpZ2F0aW9uICgvcGx1Z2luIG1hbmFnZSkgc2hvdWxkIHN0aWxsIGp1c3Qgc2hvdyB0aGUgbGlzdC5cbiAgICAgIGlmICghaGFzQXV0b05hdmlnYXRlZC5jdXJyZW50ICYmIGFjdGlvbikge1xuICAgICAgICBoYXNBdXRvTmF2aWdhdGVkLmN1cnJlbnQgPSB0cnVlXG4gICAgICAgIHNldFJlc3VsdChgUGx1Z2luIFwiJHt0YXJnZXRQbHVnaW59XCIgaXMgbm90IGluc3RhbGxlZCBpbiB0aGlzIHByb2plY3RgKVxuICAgICAgfVxuICAgIH1cbiAgfSwgW1xuICAgIHRhcmdldFBsdWdpbixcbiAgICB0YXJnZXRNYXJrZXRwbGFjZSxcbiAgICBtYXJrZXRwbGFjZXMsXG4gICAgbG9hZGluZyxcbiAgICB1bmlmaWVkSXRlbXMsXG4gICAgYWN0aW9uLFxuICAgIHNldFJlc3VsdCxcbiAgXSlcblxuICAvLyBIYW5kbGUgc2luZ2xlIHBsdWdpbiBvcGVyYXRpb25zIGZyb20gZGV0YWlscyB2aWV3XG4gIGNvbnN0IGhhbmRsZVNpbmdsZU9wZXJhdGlvbiA9IGFzeW5jIChcbiAgICBvcGVyYXRpb246ICdlbmFibGUnIHwgJ2Rpc2FibGUnIHwgJ3VwZGF0ZScgfCAndW5pbnN0YWxsJyxcbiAgKSA9PiB7XG4gICAgaWYgKCFzZWxlY3RlZFBsdWdpbikgcmV0dXJuXG5cbiAgICBjb25zdCBwbHVnaW5TY29wZSA9IHNlbGVjdGVkUGx1Z2luLnNjb3BlIHx8ICd1c2VyJ1xuICAgIGNvbnN0IGlzQnVpbHRpbiA9IHBsdWdpblNjb3BlID09PSAnYnVpbHRpbidcblxuICAgIC8vIEJ1aWx0LWluIHBsdWdpbnMgY2FuIG9ubHkgYmUgZW5hYmxlZC9kaXNhYmxlZCwgbm90IHVwZGF0ZWQvdW5pbnN0YWxsZWQuXG4gICAgaWYgKGlzQnVpbHRpbiAmJiAob3BlcmF0aW9uID09PSAndXBkYXRlJyB8fCBvcGVyYXRpb24gPT09ICd1bmluc3RhbGwnKSkge1xuICAgICAgc2V0UHJvY2Vzc0Vycm9yKCdCdWlsdC1pbiBwbHVnaW5zIGNhbm5vdCBiZSB1cGRhdGVkIG9yIHVuaW5zdGFsbGVkLicpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBNYW5hZ2VkIHNjb3BlIHBsdWdpbnMgY2FuIG9ubHkgYmUgdXBkYXRlZCwgbm90IGVuYWJsZWQvZGlzYWJsZWQvdW5pbnN0YWxsZWRcbiAgICBpZiAoXG4gICAgICAhaXNCdWlsdGluICYmXG4gICAgICAhaXNJbnN0YWxsYWJsZVNjb3BlKHBsdWdpblNjb3BlKSAmJlxuICAgICAgb3BlcmF0aW9uICE9PSAndXBkYXRlJ1xuICAgICkge1xuICAgICAgc2V0UHJvY2Vzc0Vycm9yKFxuICAgICAgICAnVGhpcyBwbHVnaW4gaXMgbWFuYWdlZCBieSB5b3VyIG9yZ2FuaXphdGlvbi4gQ29udGFjdCB5b3VyIGFkbWluIHRvIGRpc2FibGUgaXQuJyxcbiAgICAgIClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHNldElzUHJvY2Vzc2luZyh0cnVlKVxuICAgIHNldFByb2Nlc3NFcnJvcihudWxsKVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBsdWdpbklkID0gYCR7c2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm5hbWV9QCR7c2VsZWN0ZWRQbHVnaW4ubWFya2V0cGxhY2V9YFxuICAgICAgbGV0IHJldmVyc2VEZXBlbmRlbnRzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZFxuXG4gICAgICAvLyBlbmFibGUvZGlzYWJsZSBvbWl0IHNjb3BlIOKAlCBwbHVnaW5TY29wZSBpcyB0aGUgaW5zdGFsbCBzY29wZSBmcm9tXG4gICAgICAvLyBpbnN0YWxsZWRfcGx1Z2lucy5qc29uICh3aGVyZSBmaWxlcyBhcmUgY2FjaGVkKSwgd2hpY2ggY2FuIGRpdmVyZ2VcbiAgICAgIC8vIGZyb20gdGhlIHNldHRpbmdzIHNjb3BlICh3aGVyZSBlbmFibGVtZW50IGxpdmVzKS4gUGFzc2luZyBpdCB0cmlwc1xuICAgICAgLy8gdGhlIGNyb3NzLXNjb3BlIGd1YXJkLiBBdXRvLWRldGVjdCBmaW5kcyB0aGUgcmlnaHQgc2NvcGUuICMzODA4NFxuICAgICAgc3dpdGNoIChvcGVyYXRpb24pIHtcbiAgICAgICAgY2FzZSAnZW5hYmxlJzoge1xuICAgICAgICAgIGNvbnN0IGVuYWJsZVJlc3VsdCA9IGF3YWl0IGVuYWJsZVBsdWdpbk9wKHBsdWdpbklkKVxuICAgICAgICAgIGlmICghZW5hYmxlUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlbmFibGVSZXN1bHQubWVzc2FnZSlcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgICBjYXNlICdkaXNhYmxlJzoge1xuICAgICAgICAgIGNvbnN0IGRpc2FibGVSZXN1bHQgPSBhd2FpdCBkaXNhYmxlUGx1Z2luT3AocGx1Z2luSWQpXG4gICAgICAgICAgaWYgKCFkaXNhYmxlUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihkaXNhYmxlUmVzdWx0Lm1lc3NhZ2UpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldmVyc2VEZXBlbmRlbnRzID0gZGlzYWJsZVJlc3VsdC5yZXZlcnNlRGVwZW5kZW50c1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgICAgY2FzZSAndW5pbnN0YWxsJzoge1xuICAgICAgICAgIGlmIChpc0J1aWx0aW4pIGJyZWFrIC8vIGd1YXJkZWQgYWJvdmU7IG5hcnJvd3MgcGx1Z2luU2NvcGVcbiAgICAgICAgICBpZiAoIWlzSW5zdGFsbGFibGVTY29wZShwbHVnaW5TY29wZSkpIGJyZWFrXG4gICAgICAgICAgLy8gSWYgdGhlIHBsdWdpbiBpcyBlbmFibGVkIGluIC5jbGF1ZGUvc2V0dGluZ3MuanNvbiAoc2hhcmVkIHdpdGggdGhlXG4gICAgICAgICAgLy8gdGVhbSksIGRpdmVydCB0byBhIGNvbmZpcm1hdGlvbiBkaWFsb2cgdGhhdCBvZmZlcnMgdG8gZGlzYWJsZSBpblxuICAgICAgICAgIC8vIHNldHRpbmdzLmxvY2FsLmpzb24gaW5zdGVhZC4gQ2hlY2sgdGhlIHNldHRpbmdzIGZpbGUgZGlyZWN0bHkg4oCUXG4gICAgICAgICAgLy8gYHBsdWdpblNjb3BlYCAoZnJvbSBpbnN0YWxsZWRfcGx1Z2lucy5qc29uKSBjYW4gYmUgJ3VzZXInIGV2ZW4gd2hlblxuICAgICAgICAgIC8vIHRoZSBwbHVnaW4gaXMgQUxTTyBwcm9qZWN0LWVuYWJsZWQsIGFuZCB1bmluc3RhbGxpbmcgdGhlIHVzZXItc2NvcGVcbiAgICAgICAgICAvLyBpbnN0YWxsIHdvdWxkIGxlYXZlIHRoZSBwcm9qZWN0IGVuYWJsZW1lbnQgYWN0aXZlLlxuICAgICAgICAgIGlmIChpc1BsdWdpbkVuYWJsZWRBdFByb2plY3RTY29wZShwbHVnaW5JZCkpIHtcbiAgICAgICAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSlcbiAgICAgICAgICAgIHNldFZpZXdTdGF0ZSgnY29uZmlybS1wcm9qZWN0LXVuaW5zdGFsbCcpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gSWYgdGhlIHBsdWdpbiBoYXMgcGVyc2lzdGVudCBkYXRhICgke0NMQVVERV9QTFVHSU5fREFUQX0pIEFORCB0aGlzXG4gICAgICAgICAgLy8gaXMgdGhlIGxhc3Qgc2NvcGUsIHByb21wdCBiZWZvcmUgZGVsZXRpbmcgaXQuIEZvciBtdWx0aS1zY29wZVxuICAgICAgICAgIC8vIGluc3RhbGxzLCB0aGUgb3AncyBpc0xhc3RTY29wZSBjaGVjayB3b24ndCBkZWxldGUgcmVnYXJkbGVzcyBvZlxuICAgICAgICAgIC8vIHRoZSB1c2VyJ3MgeS9uIOKAlCBzaG93aW5nIHRoZSBkaWFsb2cgd291bGQgbWlzbGVhZCAoXCJ5XCIg4oaSIG5vdGhpbmdcbiAgICAgICAgICAvLyBoYXBwZW5zKS4gTGVuZ3RoIGNoZWNrIG1pcnJvcnMgcGx1Z2luT3BlcmF0aW9ucy50czo1MTMuXG4gICAgICAgICAgY29uc3QgaW5zdGFsbHMgPSBsb2FkSW5zdGFsbGVkUGx1Z2luc1YyKCkucGx1Z2luc1twbHVnaW5JZF1cbiAgICAgICAgICBjb25zdCBpc0xhc3RTY29wZSA9ICFpbnN0YWxscyB8fCBpbnN0YWxscy5sZW5ndGggPD0gMVxuICAgICAgICAgIGNvbnN0IGRhdGFTaXplID0gaXNMYXN0U2NvcGVcbiAgICAgICAgICAgID8gYXdhaXQgZ2V0UGx1Z2luRGF0YURpclNpemUocGx1Z2luSWQpXG4gICAgICAgICAgICA6IG51bGxcbiAgICAgICAgICBpZiAoZGF0YVNpemUpIHtcbiAgICAgICAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSlcbiAgICAgICAgICAgIHNldFZpZXdTdGF0ZSh7IHR5cGU6ICdjb25maXJtLWRhdGEtY2xlYW51cCcsIHNpemU6IGRhdGFTaXplIH0pXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdW5pbnN0YWxsUGx1Z2luT3AocGx1Z2luSWQsIHBsdWdpblNjb3BlKVxuICAgICAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihyZXN1bHQubWVzc2FnZSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV2ZXJzZURlcGVuZGVudHMgPSByZXN1bHQucmV2ZXJzZURlcGVuZGVudHNcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICAgIGNhc2UgJ3VwZGF0ZSc6IHtcbiAgICAgICAgICBpZiAoaXNCdWlsdGluKSBicmVhayAvLyBndWFyZGVkIGFib3ZlOyBuYXJyb3dzIHBsdWdpblNjb3BlXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXBkYXRlUGx1Z2luT3AocGx1Z2luSWQsIHBsdWdpblNjb3BlKVxuICAgICAgICAgIGlmICghcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihyZXN1bHQubWVzc2FnZSlcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gSWYgYWxyZWFkeSB1cCB0byBkYXRlLCBzaG93IG1lc3NhZ2UgYW5kIGV4aXRcbiAgICAgICAgICBpZiAocmVzdWx0LmFscmVhZHlVcFRvRGF0ZSkge1xuICAgICAgICAgICAgc2V0UmVzdWx0KFxuICAgICAgICAgICAgICBgJHtzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubmFtZX0gaXMgYWxyZWFkeSBhdCB0aGUgbGF0ZXN0IHZlcnNpb24gKCR7cmVzdWx0Lm5ld1ZlcnNpb259KS5gLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgaWYgKG9uTWFuYWdlQ29tcGxldGUpIHtcbiAgICAgICAgICAgICAgYXdhaXQgb25NYW5hZ2VDb21wbGV0ZSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXRQYXJlbnRWaWV3U3RhdGUoeyB0eXBlOiAnbWVudScgfSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBTdWNjZXNzIC0gd2lsbCBzaG93IHN0YW5kYXJkIG1lc3NhZ2UgYmVsb3dcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE9wZXJhdGlvbnMgKGVuYWJsZSwgZGlzYWJsZSwgdW5pbnN0YWxsLCB1cGRhdGUpIG5vdyB1c2UgY2VudHJhbGl6ZWQgZnVuY3Rpb25zXG4gICAgICAvLyB0aGF0IGhhbmRsZSB0aGVpciBvd24gc2V0dGluZ3MgdXBkYXRlcywgc28gd2Ugb25seSBuZWVkIHRvIGNsZWFyIGNhY2hlcyBoZXJlXG4gICAgICBjbGVhckFsbENhY2hlcygpXG5cbiAgICAgIC8vIFByb21wdCBmb3IgbWFuaWZlc3QudXNlckNvbmZpZyArIGNoYW5uZWwgdXNlckNvbmZpZyBpZiB0aGUgcGx1Z2luIGVuZHNcbiAgICAgIC8vIHVwIGVuYWJsZWQuIFJlLXJlYWQgc2V0dGluZ3MgcmF0aGVyIHRoYW4ga2V5aW5nIG9uIGBvcGVyYXRpb24gPT09XG4gICAgICAvLyAnZW5hYmxlJ2A6IGluc3RhbGwgZW5hYmxlcyBvbiBpbnN0YWxsLCBzbyB0aGUgbWVudSBzaG93cyBcIkRpc2FibGVcIlxuICAgICAgLy8gZmlyc3QuIFBsdWdpbk9wdGlvbnNGbG93IGl0c2VsZiBjaGVja3MgZ2V0VW5jb25maWd1cmVkT3B0aW9ucyDigJQgaWZcbiAgICAgIC8vIG5vdGhpbmcgbmVlZHMgZmlsbGluZywgaXQgY2FsbHMgb25Eb25lKCdza2lwcGVkJykgaW1tZWRpYXRlbHkuXG4gICAgICBjb25zdCBwbHVnaW5JZE5vdyA9IGAke3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfUAke3NlbGVjdGVkUGx1Z2luLm1hcmtldHBsYWNlfWBcbiAgICAgIGNvbnN0IHNldHRpbmdzQWZ0ZXIgPSBnZXRTZXR0aW5nc19ERVBSRUNBVEVEKClcbiAgICAgIGNvbnN0IGVuYWJsZWRBZnRlciA9XG4gICAgICAgIHNldHRpbmdzQWZ0ZXI/LmVuYWJsZWRQbHVnaW5zPy5bcGx1Z2luSWROb3ddICE9PSBmYWxzZVxuICAgICAgaWYgKGVuYWJsZWRBZnRlcikge1xuICAgICAgICBzZXRJc1Byb2Nlc3NpbmcoZmFsc2UpXG4gICAgICAgIHNldFZpZXdTdGF0ZSh7IHR5cGU6ICdwbHVnaW4tb3B0aW9ucycgfSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9wZXJhdGlvbk5hbWUgPVxuICAgICAgICBvcGVyYXRpb24gPT09ICdlbmFibGUnXG4gICAgICAgICAgPyAnRW5hYmxlZCdcbiAgICAgICAgICA6IG9wZXJhdGlvbiA9PT0gJ2Rpc2FibGUnXG4gICAgICAgICAgICA/ICdEaXNhYmxlZCdcbiAgICAgICAgICAgIDogb3BlcmF0aW9uID09PSAndXBkYXRlJ1xuICAgICAgICAgICAgICA/ICdVcGRhdGVkJ1xuICAgICAgICAgICAgICA6ICdVbmluc3RhbGxlZCdcblxuICAgICAgLy8gU2luZ2xlLWxpbmUgd2FybmluZyDigJQgbm90aWZpY2F0aW9uIHRpbWVvdXQgaXMgfjhzLCBtdWx0aS1saW5lIHdvdWxkIHNjcm9sbCBvZmYuXG4gICAgICAvLyBUaGUgcGVyc2lzdGVudCByZWNvcmQgaXMgaW4gdGhlIEVycm9ycyB0YWIgKGRlcGVuZGVuY3ktdW5zYXRpc2ZpZWQgYWZ0ZXIgcmVsb2FkKS5cbiAgICAgIGNvbnN0IGRlcFdhcm4gPVxuICAgICAgICByZXZlcnNlRGVwZW5kZW50cyAmJiByZXZlcnNlRGVwZW5kZW50cy5sZW5ndGggPiAwXG4gICAgICAgICAgPyBgIMK3IHJlcXVpcmVkIGJ5ICR7cmV2ZXJzZURlcGVuZGVudHMuam9pbignLCAnKX1gXG4gICAgICAgICAgOiAnJ1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGDinJMgJHtvcGVyYXRpb25OYW1lfSAke3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfSR7ZGVwV2Fybn0uIFJ1biAvcmVsb2FkLXBsdWdpbnMgdG8gYXBwbHkuYFxuICAgICAgc2V0UmVzdWx0KG1lc3NhZ2UpXG5cbiAgICAgIGlmIChvbk1hbmFnZUNvbXBsZXRlKSB7XG4gICAgICAgIGF3YWl0IG9uTWFuYWdlQ29tcGxldGUoKVxuICAgICAgfVxuXG4gICAgICBzZXRQYXJlbnRWaWV3U3RhdGUoeyB0eXBlOiAnbWVudScgfSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgc2V0SXNQcm9jZXNzaW5nKGZhbHNlKVxuICAgICAgY29uc3QgZXJyb3JNZXNzYWdlID1cbiAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpXG4gICAgICBzZXRQcm9jZXNzRXJyb3IoYEZhaWxlZCB0byAke29wZXJhdGlvbn06ICR7ZXJyb3JNZXNzYWdlfWApXG4gICAgICBsb2dFcnJvcih0b0Vycm9yKGVycm9yKSlcbiAgICB9XG4gIH1cblxuICAvLyBMYXRlc3QtcmVmOiBsZXRzIHRoZSBhdXRvLWFjdGlvbiBlZmZlY3QgY2FsbCB0aGUgY3VycmVudCBjbG9zdXJlIHdpdGhvdXRcbiAgLy8gYWRkaW5nIGhhbmRsZVNpbmdsZU9wZXJhdGlvbiAocmVjcmVhdGVkIGV2ZXJ5IHJlbmRlcikgdG8gaXRzIGRlcHMuXG4gIGNvbnN0IGhhbmRsZVNpbmdsZU9wZXJhdGlvblJlZiA9IHVzZVJlZihoYW5kbGVTaW5nbGVPcGVyYXRpb24pXG4gIGhhbmRsZVNpbmdsZU9wZXJhdGlvblJlZi5jdXJyZW50ID0gaGFuZGxlU2luZ2xlT3BlcmF0aW9uXG5cbiAgLy8gQXV0by1leGVjdXRlIHRoZSBhY3Rpb24gcHJvcCAoL3BsdWdpbiB1bmluc3RhbGwgWCwgL3BsdWdpbiBlbmFibGUgWCwgZXRjLilcbiAgLy8gb25jZSBhdXRvLW5hdmlnYXRpb24gaGFzIGxhbmRlZCBvbiBwbHVnaW4tZGV0YWlscy5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoXG4gICAgICB2aWV3U3RhdGUgPT09ICdwbHVnaW4tZGV0YWlscycgJiZcbiAgICAgIHNlbGVjdGVkUGx1Z2luICYmXG4gICAgICBwZW5kaW5nQXV0b0FjdGlvblJlZi5jdXJyZW50XG4gICAgKSB7XG4gICAgICBjb25zdCBwZW5kaW5nID0gcGVuZGluZ0F1dG9BY3Rpb25SZWYuY3VycmVudFxuICAgICAgcGVuZGluZ0F1dG9BY3Rpb25SZWYuY3VycmVudCA9IHVuZGVmaW5lZFxuICAgICAgdm9pZCBoYW5kbGVTaW5nbGVPcGVyYXRpb25SZWYuY3VycmVudChwZW5kaW5nKVxuICAgIH1cbiAgfSwgW3ZpZXdTdGF0ZSwgc2VsZWN0ZWRQbHVnaW5dKVxuXG4gIC8vIEhhbmRsZSB0b2dnbGUgZW5hYmxlL2Rpc2FibGVcbiAgY29uc3QgaGFuZGxlVG9nZ2xlID0gUmVhY3QudXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmIChzZWxlY3RlZEluZGV4ID49IGZpbHRlcmVkSXRlbXMubGVuZ3RoKSByZXR1cm5cbiAgICBjb25zdCBpdGVtID0gZmlsdGVyZWRJdGVtc1tzZWxlY3RlZEluZGV4XVxuICAgIGlmIChpdGVtPy50eXBlID09PSAnZmxhZ2dlZC1wbHVnaW4nKSByZXR1cm5cbiAgICBpZiAoaXRlbT8udHlwZSA9PT0gJ3BsdWdpbicpIHtcbiAgICAgIGNvbnN0IHBsdWdpbklkID0gYCR7aXRlbS5wbHVnaW4ubmFtZX1AJHtpdGVtLm1hcmtldHBsYWNlfWBcbiAgICAgIGNvbnN0IG1lcmdlZFNldHRpbmdzID0gZ2V0U2V0dGluZ3NfREVQUkVDQVRFRCgpXG4gICAgICBjb25zdCBjdXJyZW50UGVuZGluZyA9IHBlbmRpbmdUb2dnbGVzLmdldChwbHVnaW5JZClcbiAgICAgIGNvbnN0IGlzRW5hYmxlZCA9IG1lcmdlZFNldHRpbmdzPy5lbmFibGVkUGx1Z2lucz8uW3BsdWdpbklkXSAhPT0gZmFsc2VcbiAgICAgIGNvbnN0IHBsdWdpblNjb3BlID0gaXRlbS5zY29wZVxuICAgICAgY29uc3QgaXNCdWlsdGluID0gcGx1Z2luU2NvcGUgPT09ICdidWlsdGluJ1xuICAgICAgaWYgKGlzQnVpbHRpbiB8fCBpc0luc3RhbGxhYmxlU2NvcGUocGx1Z2luU2NvcGUpKSB7XG4gICAgICAgIGNvbnN0IG5ld1BlbmRpbmcgPSBuZXcgTWFwKHBlbmRpbmdUb2dnbGVzKVxuICAgICAgICAvLyBPbWl0IHNjb3BlIOKAlCBzZWUgaGFuZGxlU2luZ2xlT3BlcmF0aW9uJ3MgZW5hYmxlL2Rpc2FibGUgY29tbWVudC5cbiAgICAgICAgaWYgKGN1cnJlbnRQZW5kaW5nKSB7XG4gICAgICAgICAgLy8gQ2FuY2VsOiByZXZlcnNlIHRoZSBvcGVyYXRpb24gYmFjayB0byB0aGUgb3JpZ2luYWwgc3RhdGVcbiAgICAgICAgICBuZXdQZW5kaW5nLmRlbGV0ZShwbHVnaW5JZClcbiAgICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFBlbmRpbmcgPT09ICd3aWxsLWRpc2FibGUnKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZW5hYmxlUGx1Z2luT3AocGx1Z2luSWQpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgZGlzYWJsZVBsdWdpbk9wKHBsdWdpbklkKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNsZWFyQWxsQ2FjaGVzKClcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICBsb2dFcnJvcihlcnIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSkoKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ld1BlbmRpbmcuc2V0KHBsdWdpbklkLCBpc0VuYWJsZWQgPyAnd2lsbC1kaXNhYmxlJyA6ICd3aWxsLWVuYWJsZScpXG4gICAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgaWYgKGlzRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IGRpc2FibGVQbHVnaW5PcChwbHVnaW5JZClcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBlbmFibGVQbHVnaW5PcChwbHVnaW5JZClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjbGVhckFsbENhY2hlcygpXG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgbG9nRXJyb3IoZXJyKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pKClcbiAgICAgICAgfVxuICAgICAgICBzZXRQZW5kaW5nVG9nZ2xlcyhuZXdQZW5kaW5nKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXRlbT8udHlwZSA9PT0gJ21jcCcpIHtcbiAgICAgIHZvaWQgdG9nZ2xlTWNwU2VydmVyKGl0ZW0uY2xpZW50Lm5hbWUpXG4gICAgfVxuICB9LCBbXG4gICAgc2VsZWN0ZWRJbmRleCxcbiAgICBmaWx0ZXJlZEl0ZW1zLFxuICAgIHBlbmRpbmdUb2dnbGVzLFxuICAgIHBsdWdpblN0YXRlcyxcbiAgICB0b2dnbGVNY3BTZXJ2ZXIsXG4gIF0pXG5cbiAgLy8gSGFuZGxlIGFjY2VwdCAoRW50ZXIpIGluIHBsdWdpbi1saXN0XG4gIGNvbnN0IGhhbmRsZUFjY2VwdCA9IFJlYWN0LnVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBpZiAoc2VsZWN0ZWRJbmRleCA+PSBmaWx0ZXJlZEl0ZW1zLmxlbmd0aCkgcmV0dXJuXG4gICAgY29uc3QgaXRlbSA9IGZpbHRlcmVkSXRlbXNbc2VsZWN0ZWRJbmRleF1cbiAgICBpZiAoaXRlbT8udHlwZSA9PT0gJ3BsdWdpbicpIHtcbiAgICAgIGNvbnN0IHN0YXRlID0gcGx1Z2luU3RhdGVzLmZpbmQoXG4gICAgICAgIHMgPT5cbiAgICAgICAgICBzLnBsdWdpbi5uYW1lID09PSBpdGVtLnBsdWdpbi5uYW1lICYmXG4gICAgICAgICAgcy5tYXJrZXRwbGFjZSA9PT0gaXRlbS5tYXJrZXRwbGFjZSxcbiAgICAgIClcbiAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICBzZXRTZWxlY3RlZFBsdWdpbihzdGF0ZSlcbiAgICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tZGV0YWlscycpXG4gICAgICAgIHNldERldGFpbHNNZW51SW5kZXgoMClcbiAgICAgICAgc2V0UHJvY2Vzc0Vycm9yKG51bGwpXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpdGVtPy50eXBlID09PSAnZmxhZ2dlZC1wbHVnaW4nKSB7XG4gICAgICBzZXRWaWV3U3RhdGUoe1xuICAgICAgICB0eXBlOiAnZmxhZ2dlZC1kZXRhaWwnLFxuICAgICAgICBwbHVnaW46IHtcbiAgICAgICAgICBpZDogaXRlbS5pZCxcbiAgICAgICAgICBuYW1lOiBpdGVtLm5hbWUsXG4gICAgICAgICAgbWFya2V0cGxhY2U6IGl0ZW0ubWFya2V0cGxhY2UsXG4gICAgICAgICAgcmVhc29uOiBpdGVtLnJlYXNvbixcbiAgICAgICAgICB0ZXh0OiBpdGVtLnRleHQsXG4gICAgICAgICAgZmxhZ2dlZEF0OiBpdGVtLmZsYWdnZWRBdCxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgICBzZXRQcm9jZXNzRXJyb3IobnVsbClcbiAgICB9IGVsc2UgaWYgKGl0ZW0/LnR5cGUgPT09ICdmYWlsZWQtcGx1Z2luJykge1xuICAgICAgc2V0Vmlld1N0YXRlKHtcbiAgICAgICAgdHlwZTogJ2ZhaWxlZC1wbHVnaW4tZGV0YWlscycsXG4gICAgICAgIHBsdWdpbjoge1xuICAgICAgICAgIGlkOiBpdGVtLmlkLFxuICAgICAgICAgIG5hbWU6IGl0ZW0ubmFtZSxcbiAgICAgICAgICBtYXJrZXRwbGFjZTogaXRlbS5tYXJrZXRwbGFjZSxcbiAgICAgICAgICBlcnJvcnM6IGl0ZW0uZXJyb3JzLFxuICAgICAgICAgIHNjb3BlOiBpdGVtLnNjb3BlLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICAgIHNldERldGFpbHNNZW51SW5kZXgoMClcbiAgICAgIHNldFByb2Nlc3NFcnJvcihudWxsKVxuICAgIH0gZWxzZSBpZiAoaXRlbT8udHlwZSA9PT0gJ21jcCcpIHtcbiAgICAgIHNldFZpZXdTdGF0ZSh7IHR5cGU6ICdtY3AtZGV0YWlsJywgY2xpZW50OiBpdGVtLmNsaWVudCB9KVxuICAgICAgc2V0UHJvY2Vzc0Vycm9yKG51bGwpXG4gICAgfVxuICB9LCBbc2VsZWN0ZWRJbmRleCwgZmlsdGVyZWRJdGVtcywgcGx1Z2luU3RhdGVzXSlcblxuICAvLyBQbHVnaW4tbGlzdCBuYXZpZ2F0aW9uIChub24tc2VhcmNoIG1vZGUpXG4gIHVzZUtleWJpbmRpbmdzKFxuICAgIHtcbiAgICAgICdzZWxlY3Q6cHJldmlvdXMnOiAoKSA9PiB7XG4gICAgICAgIGlmIChzZWxlY3RlZEluZGV4ID09PSAwKSB7XG4gICAgICAgICAgc2V0SXNTZWFyY2hNb2RlKHRydWUpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGFnaW5hdGlvbi5oYW5kbGVTZWxlY3Rpb25DaGFuZ2Uoc2VsZWN0ZWRJbmRleCAtIDEsIHNldFNlbGVjdGVkSW5kZXgpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAnc2VsZWN0Om5leHQnOiAoKSA9PiB7XG4gICAgICAgIGlmIChzZWxlY3RlZEluZGV4IDwgZmlsdGVyZWRJdGVtcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgcGFnaW5hdGlvbi5oYW5kbGVTZWxlY3Rpb25DaGFuZ2Uoc2VsZWN0ZWRJbmRleCArIDEsIHNldFNlbGVjdGVkSW5kZXgpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAnc2VsZWN0OmFjY2VwdCc6IGhhbmRsZUFjY2VwdCxcbiAgICB9LFxuICAgIHtcbiAgICAgIGNvbnRleHQ6ICdTZWxlY3QnLFxuICAgICAgaXNBY3RpdmU6IHZpZXdTdGF0ZSA9PT0gJ3BsdWdpbi1saXN0JyAmJiAhaXNTZWFyY2hNb2RlLFxuICAgIH0sXG4gIClcblxuICB1c2VLZXliaW5kaW5ncyhcbiAgICB7ICdwbHVnaW46dG9nZ2xlJzogaGFuZGxlVG9nZ2xlIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ1BsdWdpbicsXG4gICAgICBpc0FjdGl2ZTogdmlld1N0YXRlID09PSAncGx1Z2luLWxpc3QnICYmICFpc1NlYXJjaE1vZGUsXG4gICAgfSxcbiAgKVxuXG4gIC8vIEhhbmRsZSBkaXNtaXNzIGFjdGlvbiBpbiBmbGFnZ2VkLWRldGFpbCB2aWV3XG4gIGNvbnN0IGhhbmRsZUZsYWdnZWREaXNtaXNzID0gUmVhY3QudXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmICh0eXBlb2Ygdmlld1N0YXRlICE9PSAnb2JqZWN0JyB8fCB2aWV3U3RhdGUudHlwZSAhPT0gJ2ZsYWdnZWQtZGV0YWlsJylcbiAgICAgIHJldHVyblxuICAgIHZvaWQgcmVtb3ZlRmxhZ2dlZFBsdWdpbih2aWV3U3RhdGUucGx1Z2luLmlkKVxuICAgIHNldFZpZXdTdGF0ZSgncGx1Z2luLWxpc3QnKVxuICB9LCBbdmlld1N0YXRlXSlcblxuICB1c2VLZXliaW5kaW5ncyhcbiAgICB7ICdzZWxlY3Q6YWNjZXB0JzogaGFuZGxlRmxhZ2dlZERpc21pc3MgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnU2VsZWN0JyxcbiAgICAgIGlzQWN0aXZlOlxuICAgICAgICB0eXBlb2Ygdmlld1N0YXRlID09PSAnb2JqZWN0JyAmJiB2aWV3U3RhdGUudHlwZSA9PT0gJ2ZsYWdnZWQtZGV0YWlsJyxcbiAgICB9LFxuICApXG5cbiAgLy8gQnVpbGQgZGV0YWlscyBtZW51IGl0ZW1zIChuZWVkZWQgZm9yIG5hdmlnYXRpb24pXG4gIGNvbnN0IGRldGFpbHNNZW51SXRlbXMgPSBSZWFjdC51c2VNZW1vKCgpID0+IHtcbiAgICBpZiAodmlld1N0YXRlICE9PSAncGx1Z2luLWRldGFpbHMnIHx8ICFzZWxlY3RlZFBsdWdpbikgcmV0dXJuIFtdXG5cbiAgICBjb25zdCBtZXJnZWRTZXR0aW5ncyA9IGdldFNldHRpbmdzX0RFUFJFQ0FURUQoKVxuICAgIGNvbnN0IHBsdWdpbklkID0gYCR7c2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm5hbWV9QCR7c2VsZWN0ZWRQbHVnaW4ubWFya2V0cGxhY2V9YFxuICAgIGNvbnN0IGlzRW5hYmxlZCA9IG1lcmdlZFNldHRpbmdzPy5lbmFibGVkUGx1Z2lucz8uW3BsdWdpbklkXSAhPT0gZmFsc2VcbiAgICBjb25zdCBpc0J1aWx0aW4gPSBzZWxlY3RlZFBsdWdpbi5tYXJrZXRwbGFjZSA9PT0gJ2J1aWx0aW4nXG5cbiAgICBjb25zdCBtZW51SXRlbXM6IEFycmF5PHsgbGFiZWw6IHN0cmluZzsgYWN0aW9uOiAoKSA9PiB2b2lkIH0+ID0gW11cblxuICAgIG1lbnVJdGVtcy5wdXNoKHtcbiAgICAgIGxhYmVsOiBpc0VuYWJsZWQgPyAnRGlzYWJsZSBwbHVnaW4nIDogJ0VuYWJsZSBwbHVnaW4nLFxuICAgICAgYWN0aW9uOiAoKSA9PlxuICAgICAgICB2b2lkIGhhbmRsZVNpbmdsZU9wZXJhdGlvbihpc0VuYWJsZWQgPyAnZGlzYWJsZScgOiAnZW5hYmxlJyksXG4gICAgfSlcblxuICAgIC8vIFVwZGF0ZS9Vbmluc3RhbGwgb3B0aW9ucyDigJQgbm90IGF2YWlsYWJsZSBmb3IgYnVpbHQtaW4gcGx1Z2luc1xuICAgIGlmICghaXNCdWlsdGluKSB7XG4gICAgICBtZW51SXRlbXMucHVzaCh7XG4gICAgICAgIGxhYmVsOiBzZWxlY3RlZFBsdWdpbi5wZW5kaW5nVXBkYXRlXG4gICAgICAgICAgPyAnVW5tYXJrIGZvciB1cGRhdGUnXG4gICAgICAgICAgOiAnTWFyayBmb3IgdXBkYXRlJyxcbiAgICAgICAgYWN0aW9uOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGxvY2FsRXJyb3IgPSBhd2FpdCBjaGVja0lmTG9jYWxQbHVnaW4oXG4gICAgICAgICAgICAgIHNlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lLFxuICAgICAgICAgICAgICBzZWxlY3RlZFBsdWdpbi5tYXJrZXRwbGFjZSxcbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgaWYgKGxvY2FsRXJyb3IpIHtcbiAgICAgICAgICAgICAgc2V0UHJvY2Vzc0Vycm9yKGxvY2FsRXJyb3IpXG4gICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBuZXdTdGF0ZXMgPSBbLi4ucGx1Z2luU3RhdGVzXVxuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBuZXdTdGF0ZXMuZmluZEluZGV4KFxuICAgICAgICAgICAgICBzID0+XG4gICAgICAgICAgICAgICAgcy5wbHVnaW4ubmFtZSA9PT0gc2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm5hbWUgJiZcbiAgICAgICAgICAgICAgICBzLm1hcmtldHBsYWNlID09PSBzZWxlY3RlZFBsdWdpbi5tYXJrZXRwbGFjZSxcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgbmV3U3RhdGVzW2luZGV4XSEucGVuZGluZ1VwZGF0ZSA9ICFzZWxlY3RlZFBsdWdpbi5wZW5kaW5nVXBkYXRlXG4gICAgICAgICAgICAgIHNldFBsdWdpblN0YXRlcyhuZXdTdGF0ZXMpXG4gICAgICAgICAgICAgIHNldFNlbGVjdGVkUGx1Z2luKHtcbiAgICAgICAgICAgICAgICAuLi5zZWxlY3RlZFBsdWdpbixcbiAgICAgICAgICAgICAgICBwZW5kaW5nVXBkYXRlOiAhc2VsZWN0ZWRQbHVnaW4ucGVuZGluZ1VwZGF0ZSxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgc2V0UHJvY2Vzc0Vycm9yKFxuICAgICAgICAgICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yXG4gICAgICAgICAgICAgICAgPyBlcnJvci5tZXNzYWdlXG4gICAgICAgICAgICAgICAgOiAnRmFpbGVkIHRvIGNoZWNrIHBsdWdpbiB1cGRhdGUgYXZhaWxhYmlsaXR5JyxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9KVxuXG4gICAgICBpZiAoc2VsZWN0ZWRQbHVnaW5IYXNNY3BiKSB7XG4gICAgICAgIG1lbnVJdGVtcy5wdXNoKHtcbiAgICAgICAgICBsYWJlbDogJ0NvbmZpZ3VyZScsXG4gICAgICAgICAgYWN0aW9uOiBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBzZXRJc0xvYWRpbmdDb25maWcodHJ1ZSlcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IG1jcFNlcnZlcnNTcGVjID0gc2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm1hbmlmZXN0Lm1jcFNlcnZlcnNcblxuICAgICAgICAgICAgICBsZXQgbWNwYlBhdGg6IHN0cmluZyB8IG51bGwgPSBudWxsXG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICB0eXBlb2YgbWNwU2VydmVyc1NwZWMgPT09ICdzdHJpbmcnICYmXG4gICAgICAgICAgICAgICAgaXNNY3BiU291cmNlKG1jcFNlcnZlcnNTcGVjKVxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBtY3BiUGF0aCA9IG1jcFNlcnZlcnNTcGVjXG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShtY3BTZXJ2ZXJzU3BlYykpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHNwZWMgb2YgbWNwU2VydmVyc1NwZWMpIHtcbiAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygc3BlYyA9PT0gJ3N0cmluZycgJiYgaXNNY3BiU291cmNlKHNwZWMpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1jcGJQYXRoID0gc3BlY1xuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmICghbWNwYlBhdGgpIHtcbiAgICAgICAgICAgICAgICBzZXRQcm9jZXNzRXJyb3IoJ05vIE1DUEIgZmlsZSBmb3VuZCBpbiBwbHVnaW4nKVxuICAgICAgICAgICAgICAgIHNldElzTG9hZGluZ0NvbmZpZyhmYWxzZSlcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHBsdWdpbklkID0gYCR7c2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm5hbWV9QCR7c2VsZWN0ZWRQbHVnaW4ubWFya2V0cGxhY2V9YFxuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBsb2FkTWNwYkZpbGUoXG4gICAgICAgICAgICAgICAgbWNwYlBhdGgsXG4gICAgICAgICAgICAgICAgc2VsZWN0ZWRQbHVnaW4ucGx1Z2luLnBhdGgsXG4gICAgICAgICAgICAgICAgcGx1Z2luSWQsXG4gICAgICAgICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICB0cnVlLFxuICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgaWYgKCdzdGF0dXMnIGluIHJlc3VsdCAmJiByZXN1bHQuc3RhdHVzID09PSAnbmVlZHMtY29uZmlnJykge1xuICAgICAgICAgICAgICAgIHNldENvbmZpZ05lZWRlZChyZXN1bHQpXG4gICAgICAgICAgICAgICAgc2V0Vmlld1N0YXRlKCdjb25maWd1cmluZycpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0UHJvY2Vzc0Vycm9yKCdGYWlsZWQgdG8gbG9hZCBNQ1BCIGZvciBjb25maWd1cmF0aW9uJylcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVycm9yTXNnID0gZXJyb3JNZXNzYWdlKGVycilcbiAgICAgICAgICAgICAgc2V0UHJvY2Vzc0Vycm9yKGBGYWlsZWQgdG8gbG9hZCBjb25maWd1cmF0aW9uOiAke2Vycm9yTXNnfWApXG4gICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICBzZXRJc0xvYWRpbmdDb25maWcoZmFsc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgfSlcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubWFuaWZlc3QudXNlckNvbmZpZyAmJlxuICAgICAgICBPYmplY3Qua2V5cyhzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubWFuaWZlc3QudXNlckNvbmZpZykubGVuZ3RoID4gMFxuICAgICAgKSB7XG4gICAgICAgIG1lbnVJdGVtcy5wdXNoKHtcbiAgICAgICAgICBsYWJlbDogJ0NvbmZpZ3VyZSBvcHRpb25zJyxcbiAgICAgICAgICBhY3Rpb246ICgpID0+IHtcbiAgICAgICAgICAgIHNldFZpZXdTdGF0ZSh7XG4gICAgICAgICAgICAgIHR5cGU6ICdjb25maWd1cmluZy1vcHRpb25zJyxcbiAgICAgICAgICAgICAgc2NoZW1hOiBzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubWFuaWZlc3QudXNlckNvbmZpZyEsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIG1lbnVJdGVtcy5wdXNoKHtcbiAgICAgICAgbGFiZWw6ICdVcGRhdGUgbm93JyxcbiAgICAgICAgYWN0aW9uOiAoKSA9PiB2b2lkIGhhbmRsZVNpbmdsZU9wZXJhdGlvbigndXBkYXRlJyksXG4gICAgICB9KVxuXG4gICAgICBtZW51SXRlbXMucHVzaCh7XG4gICAgICAgIGxhYmVsOiAnVW5pbnN0YWxsJyxcbiAgICAgICAgYWN0aW9uOiAoKSA9PiB2b2lkIGhhbmRsZVNpbmdsZU9wZXJhdGlvbigndW5pbnN0YWxsJyksXG4gICAgICB9KVxuICAgIH1cblxuICAgIGlmIChzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubWFuaWZlc3QuaG9tZXBhZ2UpIHtcbiAgICAgIG1lbnVJdGVtcy5wdXNoKHtcbiAgICAgICAgbGFiZWw6ICdPcGVuIGhvbWVwYWdlJyxcbiAgICAgICAgYWN0aW9uOiAoKSA9PlxuICAgICAgICAgIHZvaWQgb3BlbkJyb3dzZXIoc2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm1hbmlmZXN0LmhvbWVwYWdlISksXG4gICAgICB9KVxuICAgIH1cblxuICAgIGlmIChzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubWFuaWZlc3QucmVwb3NpdG9yeSkge1xuICAgICAgbWVudUl0ZW1zLnB1c2goe1xuICAgICAgICAvLyBHZW5lcmljIGxhYmVsIOKAlCBtYW5pZmVzdC5yZXBvc2l0b3J5IGNhbiBiZSBHaXRMYWIsIEJpdGJ1Y2tldCxcbiAgICAgICAgLy8gQXp1cmUgRGV2T3BzLCBldGMuIChnaC0zMTU5OCkuIHBsdWdpbkRldGFpbHNIZWxwZXJzLnRzeDo3NCBrZWVwc1xuICAgICAgICAvLyAnVmlldyBvbiBHaXRIdWInIGJlY2F1c2UgdGhhdCBwYXRoIGhhcyBhbiBleHBsaWNpdCBpc0dpdEh1YiBjaGVjay5cbiAgICAgICAgbGFiZWw6ICdWaWV3IHJlcG9zaXRvcnknLFxuICAgICAgICBhY3Rpb246ICgpID0+XG4gICAgICAgICAgdm9pZCBvcGVuQnJvd3NlcihzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubWFuaWZlc3QucmVwb3NpdG9yeSEpLFxuICAgICAgfSlcbiAgICB9XG5cbiAgICBtZW51SXRlbXMucHVzaCh7XG4gICAgICBsYWJlbDogJ0JhY2sgdG8gcGx1Z2luIGxpc3QnLFxuICAgICAgYWN0aW9uOiAoKSA9PiB7XG4gICAgICAgIHNldFZpZXdTdGF0ZSgncGx1Z2luLWxpc3QnKVxuICAgICAgICBzZXRTZWxlY3RlZFBsdWdpbihudWxsKVxuICAgICAgICBzZXRQcm9jZXNzRXJyb3IobnVsbClcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIHJldHVybiBtZW51SXRlbXNcbiAgfSwgW3ZpZXdTdGF0ZSwgc2VsZWN0ZWRQbHVnaW4sIHNlbGVjdGVkUGx1Z2luSGFzTWNwYiwgcGx1Z2luU3RhdGVzXSlcblxuICAvLyBQbHVnaW4tZGV0YWlscyBuYXZpZ2F0aW9uXG4gIHVzZUtleWJpbmRpbmdzKFxuICAgIHtcbiAgICAgICdzZWxlY3Q6cHJldmlvdXMnOiAoKSA9PiB7XG4gICAgICAgIGlmIChkZXRhaWxzTWVudUluZGV4ID4gMCkge1xuICAgICAgICAgIHNldERldGFpbHNNZW51SW5kZXgoZGV0YWlsc01lbnVJbmRleCAtIDEpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAnc2VsZWN0Om5leHQnOiAoKSA9PiB7XG4gICAgICAgIGlmIChkZXRhaWxzTWVudUluZGV4IDwgZGV0YWlsc01lbnVJdGVtcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgc2V0RGV0YWlsc01lbnVJbmRleChkZXRhaWxzTWVudUluZGV4ICsgMSlcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICdzZWxlY3Q6YWNjZXB0JzogKCkgPT4ge1xuICAgICAgICBpZiAoZGV0YWlsc01lbnVJdGVtc1tkZXRhaWxzTWVudUluZGV4XSkge1xuICAgICAgICAgIGRldGFpbHNNZW51SXRlbXNbZGV0YWlsc01lbnVJbmRleF0hLmFjdGlvbigpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnU2VsZWN0JyxcbiAgICAgIGlzQWN0aXZlOiB2aWV3U3RhdGUgPT09ICdwbHVnaW4tZGV0YWlscycgJiYgISFzZWxlY3RlZFBsdWdpbixcbiAgICB9LFxuICApXG5cbiAgLy8gRmFpbGVkLXBsdWdpbi1kZXRhaWxzOiBvbmx5IFwiVW5pbnN0YWxsXCIgb3B0aW9uLCBoYW5kbGUgRW50ZXJcbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ3NlbGVjdDphY2NlcHQnOiAoKSA9PiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0eXBlb2Ygdmlld1N0YXRlID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAgIHZpZXdTdGF0ZS50eXBlID09PSAnZmFpbGVkLXBsdWdpbi1kZXRhaWxzJ1xuICAgICAgICApIHtcbiAgICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBzZXRJc1Byb2Nlc3NpbmcodHJ1ZSlcbiAgICAgICAgICAgIHNldFByb2Nlc3NFcnJvcihudWxsKVxuICAgICAgICAgICAgY29uc3QgcGx1Z2luSWQgPSB2aWV3U3RhdGUucGx1Z2luLmlkXG4gICAgICAgICAgICBjb25zdCBwbHVnaW5TY29wZSA9IHZpZXdTdGF0ZS5wbHVnaW4uc2NvcGVcbiAgICAgICAgICAgIC8vIFBhc3Mgc2NvcGUgdG8gdW5pbnN0YWxsUGx1Z2luT3Agc28gaXQgY2FuIGZpbmQgdGhlIGNvcnJlY3QgVjJcbiAgICAgICAgICAgIC8vIGluc3RhbGxhdGlvbiByZWNvcmQgYW5kIGNsZWFuIHVwIG9uLWRpc2sgZmlsZXMuIEZhbGwgYmFjayB0b1xuICAgICAgICAgICAgLy8gZGVmYXVsdCBzY29wZSBpZiBub3QgaW5zdGFsbGFibGUgKGUuZy4gJ21hbmFnZWQnLCB0aG91Z2ggdGhhdFxuICAgICAgICAgICAgLy8gY2FzZSBpcyBndWFyZGVkIGJ5IGlzQWN0aXZlIGJlbG93KS4gZGVsZXRlRGF0YURpcj1mYWxzZTogdGhpc1xuICAgICAgICAgICAgLy8gaXMgYSByZWNvdmVyeSBwYXRoIGZvciBhIHBsdWdpbiB0aGF0IGZhaWxlZCB0byBsb2FkIOKAlCBpdCBtYXlcbiAgICAgICAgICAgIC8vIGJlIHJlaW5zdGFsbGFibGUsIHNvIGRvbid0IG51a2UgJHtDTEFVREVfUExVR0lOX0RBVEF9IHNpbGVudGx5LlxuICAgICAgICAgICAgLy8gVGhlIG5vcm1hbCB1bmluc3RhbGwgcGF0aCBwcm9tcHRzOyB0aGlzIG9uZSBwcmVzZXJ2ZXMuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBpc0luc3RhbGxhYmxlU2NvcGUocGx1Z2luU2NvcGUpXG4gICAgICAgICAgICAgID8gYXdhaXQgdW5pbnN0YWxsUGx1Z2luT3AocGx1Z2luSWQsIHBsdWdpblNjb3BlLCBmYWxzZSlcbiAgICAgICAgICAgICAgOiBhd2FpdCB1bmluc3RhbGxQbHVnaW5PcChwbHVnaW5JZCwgJ3VzZXInLCBmYWxzZSlcbiAgICAgICAgICAgIGxldCBzdWNjZXNzID0gcmVzdWx0LnN1Y2Nlc3NcbiAgICAgICAgICAgIGlmICghc3VjY2Vzcykge1xuICAgICAgICAgICAgICAvLyBQbHVnaW4gd2FzIG5ldmVyIGluc3RhbGxlZCAob25seSBpbiBlbmFibGVkUGx1Z2lucyBzZXR0aW5ncykuXG4gICAgICAgICAgICAgIC8vIFJlbW92ZSBkaXJlY3RseSBmcm9tIGFsbCBlZGl0YWJsZSBzZXR0aW5ncyBzb3VyY2VzLlxuICAgICAgICAgICAgICBjb25zdCBlZGl0YWJsZVNvdXJjZXMgPSBbXG4gICAgICAgICAgICAgICAgJ3VzZXJTZXR0aW5ncycgYXMgY29uc3QsXG4gICAgICAgICAgICAgICAgJ3Byb2plY3RTZXR0aW5ncycgYXMgY29uc3QsXG4gICAgICAgICAgICAgICAgJ2xvY2FsU2V0dGluZ3MnIGFzIGNvbnN0LFxuICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIGZvciAoY29uc3Qgc291cmNlIG9mIGVkaXRhYmxlU291cmNlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzID0gZ2V0U2V0dGluZ3NGb3JTb3VyY2Uoc291cmNlKVxuICAgICAgICAgICAgICAgIGlmIChzZXR0aW5ncz8uZW5hYmxlZFBsdWdpbnM/LltwbHVnaW5JZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgdXBkYXRlU2V0dGluZ3NGb3JTb3VyY2Uoc291cmNlLCB7XG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWRQbHVnaW5zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgLi4uc2V0dGluZ3MuZW5hYmxlZFBsdWdpbnMsXG4gICAgICAgICAgICAgICAgICAgICAgW3BsdWdpbklkXTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIENsZWFyIG1lbW9pemVkIGNhY2hlcyBzbyBuZXh0IGxvYWRBbGxQbHVnaW5zKCkgcGlja3MgdXAgc2V0dGluZ3MgY2hhbmdlc1xuICAgICAgICAgICAgICBjbGVhckFsbENhY2hlcygpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICAgICAgICBpZiAob25NYW5hZ2VDb21wbGV0ZSkge1xuICAgICAgICAgICAgICAgIGF3YWl0IG9uTWFuYWdlQ29tcGxldGUoKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSlcbiAgICAgICAgICAgICAgLy8gUmV0dXJuIHRvIGxpc3QgKGRvbid0IHNldFJlc3VsdCDigJQgdGhhdCBjbG9zZXMgdGhlIHdob2xlIGRpYWxvZylcbiAgICAgICAgICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tbGlzdCcpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzZXRJc1Byb2Nlc3NpbmcoZmFsc2UpXG4gICAgICAgICAgICAgIHNldFByb2Nlc3NFcnJvcihyZXN1bHQubWVzc2FnZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSgpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnU2VsZWN0JyxcbiAgICAgIGlzQWN0aXZlOlxuICAgICAgICB0eXBlb2Ygdmlld1N0YXRlID09PSAnb2JqZWN0JyAmJlxuICAgICAgICB2aWV3U3RhdGUudHlwZSA9PT0gJ2ZhaWxlZC1wbHVnaW4tZGV0YWlscycgJiZcbiAgICAgICAgdmlld1N0YXRlLnBsdWdpbi5zY29wZSAhPT0gJ21hbmFnZWQnLFxuICAgIH0sXG4gIClcblxuICAvLyBDb25maXJtLXByb2plY3QtdW5pbnN0YWxsOiB5L2VudGVyIGRpc2FibGVzIGluIHNldHRpbmdzLmxvY2FsLmpzb24sIG4vZXNjYXBlIGNhbmNlbHNcbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ2NvbmZpcm06eWVzJzogKCkgPT4ge1xuICAgICAgICBpZiAoIXNlbGVjdGVkUGx1Z2luKSByZXR1cm5cbiAgICAgICAgc2V0SXNQcm9jZXNzaW5nKHRydWUpXG4gICAgICAgIHNldFByb2Nlc3NFcnJvcihudWxsKVxuICAgICAgICBjb25zdCBwbHVnaW5JZCA9IGAke3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfUAke3NlbGVjdGVkUGx1Z2luLm1hcmtldHBsYWNlfWBcbiAgICAgICAgLy8gV3JpdGUgYGZhbHNlYCBkaXJlY3RseSDigJQgZGlzYWJsZVBsdWdpbk9wJ3MgY3Jvc3Mtc2NvcGUgZ3VhcmQgd291bGRcbiAgICAgICAgLy8gcmVqZWN0IHRoaXMgKHBsdWdpbiBpc24ndCBpbiBsb2NhbFNldHRpbmdzIHlldDsgdGhlIG92ZXJyaWRlIElTIHRoZVxuICAgICAgICAvLyBwb2ludCkuXG4gICAgICAgIGNvbnN0IHsgZXJyb3IgfSA9IHVwZGF0ZVNldHRpbmdzRm9yU291cmNlKCdsb2NhbFNldHRpbmdzJywge1xuICAgICAgICAgIGVuYWJsZWRQbHVnaW5zOiB7XG4gICAgICAgICAgICAuLi5nZXRTZXR0aW5nc0ZvclNvdXJjZSgnbG9jYWxTZXR0aW5ncycpPy5lbmFibGVkUGx1Z2lucyxcbiAgICAgICAgICAgIFtwbHVnaW5JZF06IGZhbHNlLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHNldElzUHJvY2Vzc2luZyhmYWxzZSlcbiAgICAgICAgICBzZXRQcm9jZXNzRXJyb3IoYEZhaWxlZCB0byB3cml0ZSBzZXR0aW5nczogJHtlcnJvci5tZXNzYWdlfWApXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgY2xlYXJBbGxDYWNoZXMoKVxuICAgICAgICBzZXRSZXN1bHQoXG4gICAgICAgICAgYOKckyBEaXNhYmxlZCAke3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfSBpbiAuY2xhdWRlL3NldHRpbmdzLmxvY2FsLmpzb24uIFJ1biAvcmVsb2FkLXBsdWdpbnMgdG8gYXBwbHkuYCxcbiAgICAgICAgKVxuICAgICAgICBpZiAob25NYW5hZ2VDb21wbGV0ZSkgdm9pZCBvbk1hbmFnZUNvbXBsZXRlKClcbiAgICAgICAgc2V0UGFyZW50Vmlld1N0YXRlKHsgdHlwZTogJ21lbnUnIH0pXG4gICAgICB9LFxuICAgICAgJ2NvbmZpcm06bm8nOiAoKSA9PiB7XG4gICAgICAgIHNldFZpZXdTdGF0ZSgncGx1Z2luLWRldGFpbHMnKVxuICAgICAgICBzZXRQcm9jZXNzRXJyb3IobnVsbClcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBjb250ZXh0OiAnQ29uZmlybWF0aW9uJyxcbiAgICAgIGlzQWN0aXZlOlxuICAgICAgICB2aWV3U3RhdGUgPT09ICdjb25maXJtLXByb2plY3QtdW5pbnN0YWxsJyAmJlxuICAgICAgICAhIXNlbGVjdGVkUGx1Z2luICYmXG4gICAgICAgICFpc1Byb2Nlc3NpbmcsXG4gICAgfSxcbiAgKVxuXG4gIC8vIENvbmZpcm0tZGF0YS1jbGVhbnVwOiB5IHVuaW5zdGFsbHMgKyBkZWxldGVzIGRhdGEgZGlyLCBuIHVuaW5zdGFsbHMgKyBrZWVwcyxcbiAgLy8gZXNjIGNhbmNlbHMuIFJhdyB1c2VJbnB1dCBiZWNhdXNlOiAoMSkgdGhlIENvbmZpcm1hdGlvbiBjb250ZXh0IG1hcHNcbiAgLy8gZW50ZXLihpJjb25maXJtOnllcywgd2hpY2ggd291bGQgbWFrZSBFbnRlciBkZWxldGUgdGhlIGRhdGEgZGlyZWN0b3J5IOKAlCBhXG4gIC8vIGRlc3RydWN0aXZlIGRlZmF1bHQgdGhlIFVJIHRleHQgKFwieSB0byBkZWxldGUgwrcgbiB0byBrZWVwXCIpIGRvZXNuJ3RcbiAgLy8gYWR2ZXJ0aXNlOyAoMikgdW5saWtlIGNvbmZpcm0tcHJvamVjdC11bmluc3RhbGwgKHdoaWNoIHVzZXMgdXNlS2V5YmluZGluZ3NcbiAgLy8gd2hlcmUgbiBhbmQgZXNjYXBlIGJvdGggbWFwIHRvIGNvbmZpcm06bm8pLCBoZXJlIG4gYW5kIGVzY2FwZSBhcmUgRElGRkVSRU5UXG4gIC8vIGFjdGlvbnMgKGtlZXAtZGF0YSB2cyBjYW5jZWwpLCBzbyB0aGlzIGRlbGliZXJhdGVseSBzdGF5cyBvbiByYXcgdXNlSW5wdXQuXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvcHJlZmVyLXVzZS1rZXliaW5kaW5ncyAtLSByYXcgeS9uL2VzYzsgRW50ZXIgbXVzdCBub3QgdHJpZ2dlciBkZXN0cnVjdGl2ZSBkZWxldGVcbiAgdXNlSW5wdXQoXG4gICAgKGlucHV0LCBrZXkpID0+IHtcbiAgICAgIGlmICghc2VsZWN0ZWRQbHVnaW4pIHJldHVyblxuICAgICAgY29uc3QgcGx1Z2luSWQgPSBgJHtzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubmFtZX1AJHtzZWxlY3RlZFBsdWdpbi5tYXJrZXRwbGFjZX1gXG4gICAgICBjb25zdCBwbHVnaW5TY29wZSA9IHNlbGVjdGVkUGx1Z2luLnNjb3BlXG4gICAgICAvLyBEaWFsb2cgaXMgb25seSByZWFjaGFibGUgZnJvbSB0aGUgdW5pbnN0YWxsIGNhc2UgKHdoaWNoIGd1YXJkcyBvblxuICAgICAgLy8gaXNCdWlsdGluKSwgYnV0IFRTIGNhbid0IHRyYWNrIHRoYXQgYWNyb3NzIHZpZXdTdGF0ZSB0cmFuc2l0aW9ucy5cbiAgICAgIGlmIChcbiAgICAgICAgIXBsdWdpblNjb3BlIHx8XG4gICAgICAgIHBsdWdpblNjb3BlID09PSAnYnVpbHRpbicgfHxcbiAgICAgICAgIWlzSW5zdGFsbGFibGVTY29wZShwbHVnaW5TY29wZSlcbiAgICAgIClcbiAgICAgICAgcmV0dXJuXG4gICAgICBjb25zdCBkb1VuaW5zdGFsbCA9IGFzeW5jIChkZWxldGVEYXRhRGlyOiBib29sZWFuKSA9PiB7XG4gICAgICAgIHNldElzUHJvY2Vzc2luZyh0cnVlKVxuICAgICAgICBzZXRQcm9jZXNzRXJyb3IobnVsbClcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB1bmluc3RhbGxQbHVnaW5PcChcbiAgICAgICAgICAgIHBsdWdpbklkLFxuICAgICAgICAgICAgcGx1Z2luU2NvcGUsXG4gICAgICAgICAgICBkZWxldGVEYXRhRGlyLFxuICAgICAgICAgIClcbiAgICAgICAgICBpZiAoIXJlc3VsdC5zdWNjZXNzKSB0aHJvdyBuZXcgRXJyb3IocmVzdWx0Lm1lc3NhZ2UpXG4gICAgICAgICAgY2xlYXJBbGxDYWNoZXMoKVxuICAgICAgICAgIGNvbnN0IHN1ZmZpeCA9IGRlbGV0ZURhdGFEaXIgPyAnJyA6ICcgwrcgZGF0YSBwcmVzZXJ2ZWQnXG4gICAgICAgICAgc2V0UmVzdWx0KGAke2ZpZ3VyZXMudGlja30gJHtyZXN1bHQubWVzc2FnZX0ke3N1ZmZpeH1gKVxuICAgICAgICAgIGlmIChvbk1hbmFnZUNvbXBsZXRlKSB2b2lkIG9uTWFuYWdlQ29tcGxldGUoKVxuICAgICAgICAgIHNldFBhcmVudFZpZXdTdGF0ZSh7IHR5cGU6ICdtZW51JyB9KVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgc2V0SXNQcm9jZXNzaW5nKGZhbHNlKVxuICAgICAgICAgIHNldFByb2Nlc3NFcnJvcihlIGluc3RhbmNlb2YgRXJyb3IgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChpbnB1dCA9PT0gJ3knIHx8IGlucHV0ID09PSAnWScpIHtcbiAgICAgICAgdm9pZCBkb1VuaW5zdGFsbCh0cnVlKVxuICAgICAgfSBlbHNlIGlmIChpbnB1dCA9PT0gJ24nIHx8IGlucHV0ID09PSAnTicpIHtcbiAgICAgICAgdm9pZCBkb1VuaW5zdGFsbChmYWxzZSlcbiAgICAgIH0gZWxzZSBpZiAoa2V5LmVzY2FwZSkge1xuICAgICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1kZXRhaWxzJylcbiAgICAgICAgc2V0UHJvY2Vzc0Vycm9yKG51bGwpXG4gICAgICB9XG4gICAgfSxcbiAgICB7XG4gICAgICBpc0FjdGl2ZTpcbiAgICAgICAgdHlwZW9mIHZpZXdTdGF0ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgdmlld1N0YXRlLnR5cGUgPT09ICdjb25maXJtLWRhdGEtY2xlYW51cCcgJiZcbiAgICAgICAgISFzZWxlY3RlZFBsdWdpbiAmJlxuICAgICAgICAhaXNQcm9jZXNzaW5nLFxuICAgIH0sXG4gIClcblxuICAvLyBSZXNldCBzZWxlY3Rpb24gd2hlbiBzZWFyY2ggcXVlcnkgY2hhbmdlc1xuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIHNldFNlbGVjdGVkSW5kZXgoMClcbiAgfSwgW3NlYXJjaFF1ZXJ5XSlcblxuICAvLyBIYW5kbGUgaW5wdXQgZm9yIGVudGVyaW5nIHNlYXJjaCBtb2RlICh0ZXh0IGlucHV0IGhhbmRsZWQgYnkgdXNlU2VhcmNoSW5wdXQgaG9vaylcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9wcmVmZXItdXNlLWtleWJpbmRpbmdzIC0tIHVzZUlucHV0IG5lZWRlZCBmb3IgcmF3IHNlYXJjaCBtb2RlIHRleHQgaW5wdXRcbiAgdXNlSW5wdXQoXG4gICAgKGlucHV0LCBrZXkpID0+IHtcbiAgICAgIGNvbnN0IGtleUlzTm90Q3RybE9yTWV0YSA9ICFrZXkuY3RybCAmJiAha2V5Lm1ldGFcbiAgICAgIGlmIChpc1NlYXJjaE1vZGUpIHtcbiAgICAgICAgLy8gVGV4dCBpbnB1dCBpcyBoYW5kbGVkIGJ5IHVzZVNlYXJjaElucHV0IGhvb2tcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIEVudGVyIHNlYXJjaCBtb2RlIHdpdGggJy8nIG9yIGFueSBwcmludGFibGUgY2hhcmFjdGVyIChleGNlcHQgbmF2aWdhdGlvbiBrZXlzKVxuICAgICAgaWYgKGlucHV0ID09PSAnLycgJiYga2V5SXNOb3RDdHJsT3JNZXRhKSB7XG4gICAgICAgIHNldElzU2VhcmNoTW9kZSh0cnVlKVxuICAgICAgICBzZXRTZWFyY2hRdWVyeSgnJylcbiAgICAgICAgc2V0U2VsZWN0ZWRJbmRleCgwKVxuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAga2V5SXNOb3RDdHJsT3JNZXRhICYmXG4gICAgICAgIGlucHV0Lmxlbmd0aCA+IDAgJiZcbiAgICAgICAgIS9eXFxzKyQvLnRlc3QoaW5wdXQpICYmXG4gICAgICAgIGlucHV0ICE9PSAnaicgJiZcbiAgICAgICAgaW5wdXQgIT09ICdrJyAmJlxuICAgICAgICBpbnB1dCAhPT0gJyAnXG4gICAgICApIHtcbiAgICAgICAgc2V0SXNTZWFyY2hNb2RlKHRydWUpXG4gICAgICAgIHNldFNlYXJjaFF1ZXJ5KGlucHV0KVxuICAgICAgICBzZXRTZWxlY3RlZEluZGV4KDApXG4gICAgICB9XG4gICAgfSxcbiAgICB7IGlzQWN0aXZlOiB2aWV3U3RhdGUgPT09ICdwbHVnaW4tbGlzdCcgfSxcbiAgKVxuXG4gIC8vIExvYWRpbmcgc3RhdGVcbiAgaWYgKGxvYWRpbmcpIHtcbiAgICByZXR1cm4gPFRleHQ+TG9hZGluZyBpbnN0YWxsZWQgcGx1Z2luc+KApjwvVGV4dD5cbiAgfVxuXG4gIC8vIE5vIHBsdWdpbnMgb3IgTUNQcyBpbnN0YWxsZWRcbiAgaWYgKHVuaWZpZWRJdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxCb3ggbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICA8VGV4dCBib2xkPk1hbmFnZSBwbHVnaW5zPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICAgPFRleHQ+Tm8gcGx1Z2lucyBvciBNQ1Agc2VydmVycyBpbnN0YWxsZWQuPC9UZXh0PlxuICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+RXNjIHRvIGdvIGJhY2s8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgaWYgKFxuICAgIHR5cGVvZiB2aWV3U3RhdGUgPT09ICdvYmplY3QnICYmXG4gICAgdmlld1N0YXRlLnR5cGUgPT09ICdwbHVnaW4tb3B0aW9ucycgJiZcbiAgICBzZWxlY3RlZFBsdWdpblxuICApIHtcbiAgICBjb25zdCBwbHVnaW5JZCA9IGAke3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfUAke3NlbGVjdGVkUGx1Z2luLm1hcmtldHBsYWNlfWBcbiAgICBmdW5jdGlvbiBmaW5pc2gobXNnOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgIHNldFJlc3VsdChtc2cpXG4gICAgICAvLyBQbHVnaW4gaXMgZW5hYmxlZCByZWdhcmRsZXNzIG9mIHdoZXRoZXIgY29uZmlnIHdhcyBzYXZlZCBvclxuICAgICAgLy8gc2tpcHBlZCDigJQgb25NYW5hZ2VDb21wbGV0ZSDihpIgbWFya1BsdWdpbnNDaGFuZ2VkIOKGkiB0aGVcbiAgICAgIC8vIHBlcnNpc3RlbnQgXCJydW4gL3JlbG9hZC1wbHVnaW5zXCIgbm90aWNlLlxuICAgICAgaWYgKG9uTWFuYWdlQ29tcGxldGUpIHtcbiAgICAgICAgdm9pZCBvbk1hbmFnZUNvbXBsZXRlKClcbiAgICAgIH1cbiAgICAgIHNldFBhcmVudFZpZXdTdGF0ZSh7IHR5cGU6ICdtZW51JyB9KVxuICAgIH1cbiAgICByZXR1cm4gKFxuICAgICAgPFBsdWdpbk9wdGlvbnNGbG93XG4gICAgICAgIHBsdWdpbj17c2VsZWN0ZWRQbHVnaW4ucGx1Z2lufVxuICAgICAgICBwbHVnaW5JZD17cGx1Z2luSWR9XG4gICAgICAgIG9uRG9uZT17KG91dGNvbWUsIGRldGFpbCkgPT4ge1xuICAgICAgICAgIHN3aXRjaCAob3V0Y29tZSkge1xuICAgICAgICAgICAgY2FzZSAnY29uZmlndXJlZCc6XG4gICAgICAgICAgICAgIGZpbmlzaChcbiAgICAgICAgICAgICAgICBg4pyTIEVuYWJsZWQgYW5kIGNvbmZpZ3VyZWQgJHtzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubmFtZX0uIFJ1biAvcmVsb2FkLXBsdWdpbnMgdG8gYXBwbHkuYCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgY2FzZSAnc2tpcHBlZCc6XG4gICAgICAgICAgICAgIGZpbmlzaChcbiAgICAgICAgICAgICAgICBg4pyTIEVuYWJsZWQgJHtzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubmFtZX0uIFJ1biAvcmVsb2FkLXBsdWdpbnMgdG8gYXBwbHkuYCxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgY2FzZSAnZXJyb3InOlxuICAgICAgICAgICAgICBmaW5pc2goYEZhaWxlZCB0byBzYXZlIGNvbmZpZ3VyYXRpb246ICR7ZGV0YWlsfWApXG4gICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9fVxuICAgICAgLz5cbiAgICApXG4gIH1cblxuICAvLyBDb25maWd1cmUgb3B0aW9ucyAoZnJvbSB0aGUgTWFuYWdlIG1lbnUpXG4gIGlmIChcbiAgICB0eXBlb2Ygdmlld1N0YXRlID09PSAnb2JqZWN0JyAmJlxuICAgIHZpZXdTdGF0ZS50eXBlID09PSAnY29uZmlndXJpbmctb3B0aW9ucycgJiZcbiAgICBzZWxlY3RlZFBsdWdpblxuICApIHtcbiAgICBjb25zdCBwbHVnaW5JZCA9IGAke3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfUAke3NlbGVjdGVkUGx1Z2luLm1hcmtldHBsYWNlfWBcbiAgICByZXR1cm4gKFxuICAgICAgPFBsdWdpbk9wdGlvbnNEaWFsb2dcbiAgICAgICAgdGl0bGU9e2BDb25maWd1cmUgJHtzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubmFtZX1gfVxuICAgICAgICBzdWJ0aXRsZT1cIlBsdWdpbiBvcHRpb25zXCJcbiAgICAgICAgY29uZmlnU2NoZW1hPXt2aWV3U3RhdGUuc2NoZW1hfVxuICAgICAgICBpbml0aWFsVmFsdWVzPXtsb2FkUGx1Z2luT3B0aW9ucyhwbHVnaW5JZCl9XG4gICAgICAgIG9uU2F2ZT17dmFsdWVzID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgc2F2ZVBsdWdpbk9wdGlvbnMocGx1Z2luSWQsIHZhbHVlcywgdmlld1N0YXRlLnNjaGVtYSlcbiAgICAgICAgICAgIGNsZWFyQWxsQ2FjaGVzKClcbiAgICAgICAgICAgIHNldFJlc3VsdChcbiAgICAgICAgICAgICAgJ0NvbmZpZ3VyYXRpb24gc2F2ZWQuIFJ1biAvcmVsb2FkLXBsdWdpbnMgZm9yIGNoYW5nZXMgdG8gdGFrZSBlZmZlY3QuJyxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHNldFByb2Nlc3NFcnJvcihcbiAgICAgICAgICAgICAgYEZhaWxlZCB0byBzYXZlIGNvbmZpZ3VyYXRpb246ICR7ZXJyb3JNZXNzYWdlKGVycil9YCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG4gICAgICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tZGV0YWlscycpXG4gICAgICAgIH19XG4gICAgICAgIG9uQ2FuY2VsPXsoKSA9PiBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1kZXRhaWxzJyl9XG4gICAgICAvPlxuICAgIClcbiAgfVxuXG4gIC8vIENvbmZpZ3VyYXRpb24gdmlld1xuICBpZiAodmlld1N0YXRlID09PSAnY29uZmlndXJpbmcnICYmIGNvbmZpZ05lZWRlZCAmJiBzZWxlY3RlZFBsdWdpbikge1xuICAgIGNvbnN0IHBsdWdpbklkID0gYCR7c2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm5hbWV9QCR7c2VsZWN0ZWRQbHVnaW4ubWFya2V0cGxhY2V9YFxuXG4gICAgYXN5bmMgZnVuY3Rpb24gaGFuZGxlU2F2ZShjb25maWc6IFVzZXJDb25maWdWYWx1ZXMpIHtcbiAgICAgIGlmICghY29uZmlnTmVlZGVkIHx8ICFzZWxlY3RlZFBsdWdpbikgcmV0dXJuXG5cbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIEZpbmQgTUNQQiBwYXRoIGFnYWluXG4gICAgICAgIGNvbnN0IG1jcFNlcnZlcnNTcGVjID0gc2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm1hbmlmZXN0Lm1jcFNlcnZlcnNcbiAgICAgICAgbGV0IG1jcGJQYXRoOiBzdHJpbmcgfCBudWxsID0gbnVsbFxuXG4gICAgICAgIGlmIChcbiAgICAgICAgICB0eXBlb2YgbWNwU2VydmVyc1NwZWMgPT09ICdzdHJpbmcnICYmXG4gICAgICAgICAgaXNNY3BiU291cmNlKG1jcFNlcnZlcnNTcGVjKVxuICAgICAgICApIHtcbiAgICAgICAgICBtY3BiUGF0aCA9IG1jcFNlcnZlcnNTcGVjXG4gICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShtY3BTZXJ2ZXJzU3BlYykpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHNwZWMgb2YgbWNwU2VydmVyc1NwZWMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3BlYyA9PT0gJ3N0cmluZycgJiYgaXNNY3BiU291cmNlKHNwZWMpKSB7XG4gICAgICAgICAgICAgIG1jcGJQYXRoID0gc3BlY1xuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbWNwYlBhdGgpIHtcbiAgICAgICAgICBzZXRQcm9jZXNzRXJyb3IoJ05vIE1DUEIgZmlsZSBmb3VuZCcpXG4gICAgICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tZGV0YWlscycpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWxvYWQgd2l0aCBwcm92aWRlZCBjb25maWdcbiAgICAgICAgYXdhaXQgbG9hZE1jcGJGaWxlKFxuICAgICAgICAgIG1jcGJQYXRoLFxuICAgICAgICAgIHNlbGVjdGVkUGx1Z2luLnBsdWdpbi5wYXRoLFxuICAgICAgICAgIHBsdWdpbklkLFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICBjb25maWcsXG4gICAgICAgIClcblxuICAgICAgICAvLyBTdWNjZXNzIC0gZ28gYmFjayB0byBkZXRhaWxzXG4gICAgICAgIHNldFByb2Nlc3NFcnJvcihudWxsKVxuICAgICAgICBzZXRDb25maWdOZWVkZWQobnVsbClcbiAgICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tZGV0YWlscycpXG4gICAgICAgIHNldFJlc3VsdChcbiAgICAgICAgICAnQ29uZmlndXJhdGlvbiBzYXZlZC4gUnVuIC9yZWxvYWQtcGx1Z2lucyBmb3IgY2hhbmdlcyB0byB0YWtlIGVmZmVjdC4nLFxuICAgICAgICApXG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc3QgZXJyb3JNc2cgPSBlcnJvck1lc3NhZ2UoZXJyKVxuICAgICAgICBzZXRQcm9jZXNzRXJyb3IoYEZhaWxlZCB0byBzYXZlIGNvbmZpZ3VyYXRpb246ICR7ZXJyb3JNc2d9YClcbiAgICAgICAgc2V0Vmlld1N0YXRlKCdwbHVnaW4tZGV0YWlscycpXG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFuZGxlQ2FuY2VsKCkge1xuICAgICAgc2V0Q29uZmlnTmVlZGVkKG51bGwpXG4gICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1kZXRhaWxzJylcbiAgICB9XG5cbiAgICByZXR1cm4gKFxuICAgICAgPFBsdWdpbk9wdGlvbnNEaWFsb2dcbiAgICAgICAgdGl0bGU9e2BDb25maWd1cmUgJHtjb25maWdOZWVkZWQubWFuaWZlc3QubmFtZX1gfVxuICAgICAgICBzdWJ0aXRsZT17YFBsdWdpbjogJHtzZWxlY3RlZFBsdWdpbi5wbHVnaW4ubmFtZX1gfVxuICAgICAgICBjb25maWdTY2hlbWE9e2NvbmZpZ05lZWRlZC5jb25maWdTY2hlbWF9XG4gICAgICAgIGluaXRpYWxWYWx1ZXM9e2NvbmZpZ05lZWRlZC5leGlzdGluZ0NvbmZpZ31cbiAgICAgICAgb25TYXZlPXtoYW5kbGVTYXZlfVxuICAgICAgICBvbkNhbmNlbD17aGFuZGxlQ2FuY2VsfVxuICAgICAgLz5cbiAgICApXG4gIH1cblxuICAvLyBGbGFnZ2VkIHBsdWdpbiBkZXRhaWwgdmlld1xuICBpZiAodHlwZW9mIHZpZXdTdGF0ZSA9PT0gJ29iamVjdCcgJiYgdmlld1N0YXRlLnR5cGUgPT09ICdmbGFnZ2VkLWRldGFpbCcpIHtcbiAgICBjb25zdCBmcCA9IHZpZXdTdGF0ZS5wbHVnaW5cbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxCb3g+XG4gICAgICAgICAgPFRleHQgYm9sZD5cbiAgICAgICAgICAgIHtmcC5uYW1lfSBAIHtmcC5tYXJrZXRwbGFjZX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuXG4gICAgICAgIDxCb3ggbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5TdGF0dXM6IDwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+UmVtb3ZlZDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+XG4gICAgICAgICAgICBSZW1vdmVkIGZyb20gbWFya2V0cGxhY2UgwrcgcmVhc29uOiB7ZnAucmVhc29ufVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8VGV4dD57ZnAudGV4dH08L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICBGbGFnZ2VkIG9uIHtuZXcgRGF0ZShmcC5mbGFnZ2VkQXQpLnRvTG9jYWxlRGF0ZVN0cmluZygpfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgPFRleHQ+e2ZpZ3VyZXMucG9pbnRlcn0gPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+RGlzbWlzczwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICBhY3Rpb249XCJzZWxlY3Q6YWNjZXB0XCJcbiAgICAgICAgICAgIGNvbnRleHQ9XCJTZWxlY3RcIlxuICAgICAgICAgICAgZmFsbGJhY2s9XCJFbnRlclwiXG4gICAgICAgICAgICBkZXNjcmlwdGlvbj1cImRpc21pc3NcIlxuICAgICAgICAgIC8+XG4gICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiYmFja1wiXG4gICAgICAgICAgLz5cbiAgICAgICAgPC9CeWxpbmU+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICAvLyBDb25maXJtLXByb2plY3QtdW5pbnN0YWxsOiB3YXJuIGFib3V0IHNoYXJlZCAuY2xhdWRlL3NldHRpbmdzLmpzb24sXG4gIC8vIG9mZmVyIHRvIGRpc2FibGUgaW4gc2V0dGluZ3MubG9jYWwuanNvbiBpbnN0ZWFkLlxuICBpZiAodmlld1N0YXRlID09PSAnY29uZmlybS1wcm9qZWN0LXVuaW5zdGFsbCcgJiYgc2VsZWN0ZWRQbHVnaW4pIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxUZXh0IGJvbGQgY29sb3I9XCJ3YXJuaW5nXCI+XG4gICAgICAgICAge3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfSBpcyBlbmFibGVkIGluIC5jbGF1ZGUvc2V0dGluZ3MuanNvblxuICAgICAgICAgIChzaGFyZWQgd2l0aCB5b3VyIHRlYW0pXG4gICAgICAgIDwvVGV4dD5cbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VGV4dD5EaXNhYmxlIGl0IGp1c3QgZm9yIHlvdSBpbiAuY2xhdWRlL3NldHRpbmdzLmxvY2FsLmpzb24/PC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgVGhpcyBoYXMgdGhlIHNhbWUgZWZmZWN0IGFzIHVuaW5zdGFsbGluZywgd2l0aG91dCBhZmZlY3Rpbmcgb3RoZXJcbiAgICAgICAgICAgIGNvbnRyaWJ1dG9ycy5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgICB7cHJvY2Vzc0Vycm9yICYmIChcbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+e3Byb2Nlc3NFcnJvcn08L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG4gICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICB7aXNQcm9jZXNzaW5nID8gKFxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+RGlzYWJsaW5n4oCmPC9UZXh0PlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTp5ZXNcIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwieVwiXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJkaXNhYmxlXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImNhbmNlbFwiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIENvbmZpcm0tZGF0YS1jbGVhbnVwOiBwcm9tcHQgYmVmb3JlIGRlbGV0aW5nICR7Q0xBVURFX1BMVUdJTl9EQVRBfSBkaXJcbiAgaWYgKFxuICAgIHR5cGVvZiB2aWV3U3RhdGUgPT09ICdvYmplY3QnICYmXG4gICAgdmlld1N0YXRlLnR5cGUgPT09ICdjb25maXJtLWRhdGEtY2xlYW51cCcgJiZcbiAgICBzZWxlY3RlZFBsdWdpblxuICApIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgIDxUZXh0IGJvbGQ+XG4gICAgICAgICAge3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfSBoYXMge3ZpZXdTdGF0ZS5zaXplLmh1bWFufSBvZiBwZXJzaXN0ZW50XG4gICAgICAgICAgZGF0YVxuICAgICAgICA8L1RleHQ+XG4gICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCI+XG4gICAgICAgICAgPFRleHQ+RGVsZXRlIGl0IGFsb25nIHdpdGggdGhlIHBsdWdpbj88L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICB7cGx1Z2luRGF0YURpclBhdGgoXG4gICAgICAgICAgICAgIGAke3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfUAke3NlbGVjdGVkUGx1Z2luLm1hcmtldHBsYWNlfWAsXG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIHtwcm9jZXNzRXJyb3IgJiYgKFxuICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj57cHJvY2Vzc0Vycm9yfTwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgIHtpc1Byb2Nlc3NpbmcgPyAoXG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5Vbmluc3RhbGxpbmfigKY8L1RleHQ+XG4gICAgICAgICAgKSA6IChcbiAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICA8VGV4dCBib2xkPnk8L1RleHQ+IHRvIGRlbGV0ZSDCtyA8VGV4dCBib2xkPm48L1RleHQ+IHRvIGtlZXAgwrd7JyAnfVxuICAgICAgICAgICAgICA8VGV4dCBib2xkPmVzYzwvVGV4dD4gdG8gY2FuY2VsXG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICAvLyBQbHVnaW4gZGV0YWlscyB2aWV3XG4gIGlmICh2aWV3U3RhdGUgPT09ICdwbHVnaW4tZGV0YWlscycgJiYgc2VsZWN0ZWRQbHVnaW4pIHtcbiAgICBjb25zdCBtZXJnZWRTZXR0aW5ncyA9IGdldFNldHRpbmdzX0RFUFJFQ0FURUQoKSAvLyBVc2UgbWVyZ2VkIHNldHRpbmdzIHRvIHJlc3BlY3QgYWxsIGxheWVyc1xuICAgIGNvbnN0IHBsdWdpbklkID0gYCR7c2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm5hbWV9QCR7c2VsZWN0ZWRQbHVnaW4ubWFya2V0cGxhY2V9YFxuICAgIGNvbnN0IGlzRW5hYmxlZCA9IG1lcmdlZFNldHRpbmdzPy5lbmFibGVkUGx1Z2lucz8uW3BsdWdpbklkXSAhPT0gZmFsc2VcblxuICAgIC8vIENvbXB1dGUgcGx1Z2luIGVycm9ycyBzZWN0aW9uXG4gICAgY29uc3QgZmlsdGVyZWRQbHVnaW5FcnJvcnMgPSBwbHVnaW5FcnJvcnMuZmlsdGVyKFxuICAgICAgZSA9PlxuICAgICAgICAoJ3BsdWdpbicgaW4gZSAmJiBlLnBsdWdpbiA9PT0gc2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm5hbWUpIHx8XG4gICAgICAgIGUuc291cmNlID09PSBwbHVnaW5JZCB8fFxuICAgICAgICBlLnNvdXJjZS5zdGFydHNXaXRoKGAke3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5uYW1lfUBgKSxcbiAgICApXG4gICAgY29uc3QgcGx1Z2luRXJyb3JzU2VjdGlvbiA9XG4gICAgICBmaWx0ZXJlZFBsdWdpbkVycm9ycy5sZW5ndGggPT09IDAgPyBudWxsIDogKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgIDxUZXh0IGJvbGQgY29sb3I9XCJlcnJvclwiPlxuICAgICAgICAgICAge2ZpbHRlcmVkUGx1Z2luRXJyb3JzLmxlbmd0aH17JyAnfVxuICAgICAgICAgICAge3BsdXJhbChmaWx0ZXJlZFBsdWdpbkVycm9ycy5sZW5ndGgsICdlcnJvcicpfTpcbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAge2ZpbHRlcmVkUGx1Z2luRXJyb3JzLm1hcCgoZXJyb3IsIGkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGd1aWRhbmNlID0gZ2V0RXJyb3JHdWlkYW5jZShlcnJvcilcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxCb3gga2V5PXtpfSBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luTGVmdD17Mn0+XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPntmb3JtYXRFcnJvck1lc3NhZ2UoZXJyb3IpfTwvVGV4dD5cbiAgICAgICAgICAgICAgICB7Z3VpZGFuY2UgJiYgKFxuICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3IgaXRhbGljPlxuICAgICAgICAgICAgICAgICAgICB7ZmlndXJlcy5hcnJvd1JpZ2h0fSB7Z3VpZGFuY2V9XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICApXG4gICAgICAgICAgfSl9XG4gICAgICAgIDwvQm94PlxuICAgICAgKVxuXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8Qm94PlxuICAgICAgICAgIDxUZXh0IGJvbGQ+XG4gICAgICAgICAgICB7c2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm5hbWV9IEAge3NlbGVjdGVkUGx1Z2luLm1hcmtldHBsYWNlfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgey8qIFNjb3BlICovfVxuICAgICAgICA8Qm94PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlNjb3BlOiA8L1RleHQ+XG4gICAgICAgICAgPFRleHQ+e3NlbGVjdGVkUGx1Z2luLnNjb3BlIHx8ICd1c2VyJ308L1RleHQ+XG4gICAgICAgIDwvQm94PlxuXG4gICAgICAgIHsvKiBQbHVnaW4gZGV0YWlscyAqL31cbiAgICAgICAge3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5tYW5pZmVzdC52ZXJzaW9uICYmIChcbiAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+VmVyc2lvbjogPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQ+e3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5tYW5pZmVzdC52ZXJzaW9ufTwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cblxuICAgICAgICB7c2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm1hbmlmZXN0LmRlc2NyaXB0aW9uICYmIChcbiAgICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgICA8VGV4dD57c2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm1hbmlmZXN0LmRlc2NyaXB0aW9ufTwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cblxuICAgICAgICB7c2VsZWN0ZWRQbHVnaW4ucGx1Z2luLm1hbmlmZXN0LmF1dGhvciAmJiAoXG4gICAgICAgICAgPEJveD5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPkF1dGhvcjogPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQ+e3NlbGVjdGVkUGx1Z2luLnBsdWdpbi5tYW5pZmVzdC5hdXRob3IubmFtZX08L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIEN1cnJlbnQgc3RhdHVzICovfVxuICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+U3RhdHVzOiA8L1RleHQ+XG4gICAgICAgICAgPFRleHQgY29sb3I9e2lzRW5hYmxlZCA/ICdzdWNjZXNzJyA6ICd3YXJuaW5nJ30+XG4gICAgICAgICAgICB7aXNFbmFibGVkID8gJ0VuYWJsZWQnIDogJ0Rpc2FibGVkJ31cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAge3NlbGVjdGVkUGx1Z2luLnBlbmRpbmdVcGRhdGUgJiYgKFxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+IMK3IE1hcmtlZCBmb3IgdXBkYXRlPC9UZXh0PlxuICAgICAgICAgICl9XG4gICAgICAgIDwvQm94PlxuXG4gICAgICAgIHsvKiBJbnN0YWxsZWQgY29tcG9uZW50cyAqL31cbiAgICAgICAgPFBsdWdpbkNvbXBvbmVudHNEaXNwbGF5XG4gICAgICAgICAgcGx1Z2luPXtzZWxlY3RlZFBsdWdpbi5wbHVnaW59XG4gICAgICAgICAgbWFya2V0cGxhY2U9e3NlbGVjdGVkUGx1Z2luLm1hcmtldHBsYWNlfVxuICAgICAgICAvPlxuXG4gICAgICAgIHsvKiBQbHVnaW4gZXJyb3JzICovfVxuICAgICAgICB7cGx1Z2luRXJyb3JzU2VjdGlvbn1cblxuICAgICAgICB7LyogTWVudSAqL31cbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICB7ZGV0YWlsc01lbnVJdGVtcy5tYXAoKGl0ZW0sIGluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpc1NlbGVjdGVkID0gaW5kZXggPT09IGRldGFpbHNNZW51SW5kZXhcblxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgPEJveCBrZXk9e2luZGV4fT5cbiAgICAgICAgICAgICAgICB7aXNTZWxlY3RlZCAmJiA8VGV4dD57ZmlndXJlcy5wb2ludGVyfSA8L1RleHQ+fVxuICAgICAgICAgICAgICAgIHshaXNTZWxlY3RlZCAmJiA8VGV4dD57JyAgJ308L1RleHQ+fVxuICAgICAgICAgICAgICAgIDxUZXh0XG4gICAgICAgICAgICAgICAgICBib2xkPXtpc1NlbGVjdGVkfVxuICAgICAgICAgICAgICAgICAgY29sb3I9e1xuICAgICAgICAgICAgICAgICAgICBpdGVtLmxhYmVsLmluY2x1ZGVzKCdVbmluc3RhbGwnKVxuICAgICAgICAgICAgICAgICAgICAgID8gJ2Vycm9yJ1xuICAgICAgICAgICAgICAgICAgICAgIDogaXRlbS5sYWJlbC5pbmNsdWRlcygnVXBkYXRlJylcbiAgICAgICAgICAgICAgICAgICAgICAgID8gJ3N1Z2dlc3Rpb24nXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIHtpdGVtLmxhYmVsfVxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICApXG4gICAgICAgICAgfSl9XG4gICAgICAgIDwvQm94PlxuXG4gICAgICAgIHsvKiBQcm9jZXNzaW5nIHN0YXRlICovfVxuICAgICAgICB7aXNQcm9jZXNzaW5nICYmIChcbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dD5Qcm9jZXNzaW5n4oCmPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuXG4gICAgICAgIHsvKiBFcnJvciBtZXNzYWdlICovfVxuICAgICAgICB7cHJvY2Vzc0Vycm9yICYmIChcbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cImVycm9yXCI+e3Byb2Nlc3NFcnJvcn08L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICBhY3Rpb249XCJzZWxlY3Q6cHJldmlvdXNcIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJTZWxlY3RcIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwi4oaRXCJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cIm5hdmlnYXRlXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgIGFjdGlvbj1cInNlbGVjdDphY2NlcHRcIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJTZWxlY3RcIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRW50ZXJcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwic2VsZWN0XCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImJhY2tcIlxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIEZhaWxlZCBwbHVnaW4gZGV0YWlsIHZpZXdcbiAgaWYgKFxuICAgIHR5cGVvZiB2aWV3U3RhdGUgPT09ICdvYmplY3QnICYmXG4gICAgdmlld1N0YXRlLnR5cGUgPT09ICdmYWlsZWQtcGx1Z2luLWRldGFpbHMnXG4gICkge1xuICAgIGNvbnN0IGZhaWxlZFBsdWdpbiA9IHZpZXdTdGF0ZS5wbHVnaW5cblxuICAgIGNvbnN0IGZpcnN0RXJyb3IgPSBmYWlsZWRQbHVnaW4uZXJyb3JzWzBdXG4gICAgY29uc3QgZXJyb3JNZXNzYWdlID0gZmlyc3RFcnJvclxuICAgICAgPyBmb3JtYXRFcnJvck1lc3NhZ2UoZmlyc3RFcnJvcilcbiAgICAgIDogJ0ZhaWxlZCB0byBsb2FkJ1xuXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICA8VGV4dCBib2xkPntmYWlsZWRQbHVnaW4ubmFtZX08L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+IEAge2ZhaWxlZFBsdWdpbi5tYXJrZXRwbGFjZX08L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+ICh7ZmFpbGVkUGx1Z2luLnNjb3BlfSk8L1RleHQ+XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPntlcnJvck1lc3NhZ2V9PC9UZXh0PlxuXG4gICAgICAgIHtmYWlsZWRQbHVnaW4uc2NvcGUgPT09ICdtYW5hZ2VkJyA/IChcbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgTWFuYWdlZCBieSB5b3VyIG9yZ2FuaXphdGlvbiDigJQgY29udGFjdCB5b3VyIGFkbWluXG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+e2ZpZ3VyZXMucG9pbnRlcn0gPC9UZXh0PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5SZW1vdmU8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG5cbiAgICAgICAge2lzUHJvY2Vzc2luZyAmJiA8VGV4dD5Qcm9jZXNzaW5n4oCmPC9UZXh0Pn1cbiAgICAgICAge3Byb2Nlc3NFcnJvciAmJiA8VGV4dCBjb2xvcj1cImVycm9yXCI+e3Byb2Nlc3NFcnJvcn08L1RleHQ+fVxuXG4gICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICA8QnlsaW5lPlxuICAgICAgICAgICAgICB7ZmFpbGVkUGx1Z2luLnNjb3BlICE9PSAnbWFuYWdlZCcgJiYgKFxuICAgICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICAgIGFjdGlvbj1cInNlbGVjdDphY2NlcHRcIlxuICAgICAgICAgICAgICAgICAgY29udGV4dD1cIlNlbGVjdFwiXG4gICAgICAgICAgICAgICAgICBmYWxsYmFjaz1cIkVudGVyXCJcbiAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwicmVtb3ZlXCJcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgICAgY29udGV4dD1cIkNvbmZpcm1hdGlvblwiXG4gICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiYmFja1wiXG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgLy8gTUNQIGRldGFpbCB2aWV3XG4gIGlmICh0eXBlb2Ygdmlld1N0YXRlID09PSAnb2JqZWN0JyAmJiB2aWV3U3RhdGUudHlwZSA9PT0gJ21jcC1kZXRhaWwnKSB7XG4gICAgY29uc3QgY2xpZW50ID0gdmlld1N0YXRlLmNsaWVudFxuICAgIGNvbnN0IHNlcnZlclRvb2xzQ291bnQgPSBmaWx0ZXJUb29sc0J5U2VydmVyKG1jcFRvb2xzLCBjbGllbnQubmFtZSkubGVuZ3RoXG5cbiAgICAvLyBDb21tb24gaGFuZGxlcnMgZm9yIE1DUCBtZW51c1xuICAgIGNvbnN0IGhhbmRsZU1jcFZpZXdUb29scyA9ICgpID0+IHtcbiAgICAgIHNldFZpZXdTdGF0ZSh7IHR5cGU6ICdtY3AtdG9vbHMnLCBjbGllbnQgfSlcbiAgICB9XG5cbiAgICBjb25zdCBoYW5kbGVNY3BDYW5jZWwgPSAoKSA9PiB7XG4gICAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1saXN0JylcbiAgICB9XG5cbiAgICBjb25zdCBoYW5kbGVNY3BDb21wbGV0ZSA9IChyZXN1bHQ/OiBzdHJpbmcpID0+IHtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgc2V0UmVzdWx0KHJlc3VsdClcbiAgICAgIH1cbiAgICAgIHNldFZpZXdTdGF0ZSgncGx1Z2luLWxpc3QnKVxuICAgIH1cblxuICAgIC8vIFRyYW5zZm9ybSBNQ1BTZXJ2ZXJDb25uZWN0aW9uIHRvIGFwcHJvcHJpYXRlIFNlcnZlckluZm8gdHlwZVxuICAgIGNvbnN0IHNjb3BlID0gY2xpZW50LmNvbmZpZy5zY29wZVxuICAgIGNvbnN0IGNvbmZpZ1R5cGUgPSBjbGllbnQuY29uZmlnLnR5cGVcblxuICAgIGlmIChjb25maWdUeXBlID09PSAnc3RkaW8nKSB7XG4gICAgICBjb25zdCBzZXJ2ZXI6IFN0ZGlvU2VydmVySW5mbyA9IHtcbiAgICAgICAgbmFtZTogY2xpZW50Lm5hbWUsXG4gICAgICAgIGNsaWVudCxcbiAgICAgICAgc2NvcGUsXG4gICAgICAgIHRyYW5zcG9ydDogJ3N0ZGlvJyxcbiAgICAgICAgY29uZmlnOiBjbGllbnQuY29uZmlnIGFzIE1jcFN0ZGlvU2VydmVyQ29uZmlnLFxuICAgICAgfVxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPE1DUFN0ZGlvU2VydmVyTWVudVxuICAgICAgICAgIHNlcnZlcj17c2VydmVyfVxuICAgICAgICAgIHNlcnZlclRvb2xzQ291bnQ9e3NlcnZlclRvb2xzQ291bnR9XG4gICAgICAgICAgb25WaWV3VG9vbHM9e2hhbmRsZU1jcFZpZXdUb29sc31cbiAgICAgICAgICBvbkNhbmNlbD17aGFuZGxlTWNwQ2FuY2VsfVxuICAgICAgICAgIG9uQ29tcGxldGU9e2hhbmRsZU1jcENvbXBsZXRlfVxuICAgICAgICAgIGJvcmRlcmxlc3NcbiAgICAgICAgLz5cbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvbmZpZ1R5cGUgPT09ICdzc2UnKSB7XG4gICAgICBjb25zdCBzZXJ2ZXI6IFNTRVNlcnZlckluZm8gPSB7XG4gICAgICAgIG5hbWU6IGNsaWVudC5uYW1lLFxuICAgICAgICBjbGllbnQsXG4gICAgICAgIHNjb3BlLFxuICAgICAgICB0cmFuc3BvcnQ6ICdzc2UnLFxuICAgICAgICBpc0F1dGhlbnRpY2F0ZWQ6IHVuZGVmaW5lZCxcbiAgICAgICAgY29uZmlnOiBjbGllbnQuY29uZmlnIGFzIE1jcFNTRVNlcnZlckNvbmZpZyxcbiAgICAgIH1cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxNQ1BSZW1vdGVTZXJ2ZXJNZW51XG4gICAgICAgICAgc2VydmVyPXtzZXJ2ZXJ9XG4gICAgICAgICAgc2VydmVyVG9vbHNDb3VudD17c2VydmVyVG9vbHNDb3VudH1cbiAgICAgICAgICBvblZpZXdUb29scz17aGFuZGxlTWNwVmlld1Rvb2xzfVxuICAgICAgICAgIG9uQ2FuY2VsPXtoYW5kbGVNY3BDYW5jZWx9XG4gICAgICAgICAgb25Db21wbGV0ZT17aGFuZGxlTWNwQ29tcGxldGV9XG4gICAgICAgICAgYm9yZGVybGVzc1xuICAgICAgICAvPlxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29uZmlnVHlwZSA9PT0gJ2h0dHAnKSB7XG4gICAgICBjb25zdCBzZXJ2ZXI6IEhUVFBTZXJ2ZXJJbmZvID0ge1xuICAgICAgICBuYW1lOiBjbGllbnQubmFtZSxcbiAgICAgICAgY2xpZW50LFxuICAgICAgICBzY29wZSxcbiAgICAgICAgdHJhbnNwb3J0OiAnaHR0cCcsXG4gICAgICAgIGlzQXV0aGVudGljYXRlZDogdW5kZWZpbmVkLFxuICAgICAgICBjb25maWc6IGNsaWVudC5jb25maWcgYXMgTWNwSFRUUFNlcnZlckNvbmZpZyxcbiAgICAgIH1cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxNQ1BSZW1vdGVTZXJ2ZXJNZW51XG4gICAgICAgICAgc2VydmVyPXtzZXJ2ZXJ9XG4gICAgICAgICAgc2VydmVyVG9vbHNDb3VudD17c2VydmVyVG9vbHNDb3VudH1cbiAgICAgICAgICBvblZpZXdUb29scz17aGFuZGxlTWNwVmlld1Rvb2xzfVxuICAgICAgICAgIG9uQ2FuY2VsPXtoYW5kbGVNY3BDYW5jZWx9XG4gICAgICAgICAgb25Db21wbGV0ZT17aGFuZGxlTWNwQ29tcGxldGV9XG4gICAgICAgICAgYm9yZGVybGVzc1xuICAgICAgICAvPlxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29uZmlnVHlwZSA9PT0gJ2NsYXVkZWFpLXByb3h5Jykge1xuICAgICAgY29uc3Qgc2VydmVyOiBDbGF1ZGVBSVNlcnZlckluZm8gPSB7XG4gICAgICAgIG5hbWU6IGNsaWVudC5uYW1lLFxuICAgICAgICBjbGllbnQsXG4gICAgICAgIHNjb3BlLFxuICAgICAgICB0cmFuc3BvcnQ6ICdjbGF1ZGVhaS1wcm94eScsXG4gICAgICAgIGlzQXV0aGVudGljYXRlZDogdW5kZWZpbmVkLFxuICAgICAgICBjb25maWc6IGNsaWVudC5jb25maWcgYXMgTWNwQ2xhdWRlQUlQcm94eVNlcnZlckNvbmZpZyxcbiAgICAgIH1cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxNQ1BSZW1vdGVTZXJ2ZXJNZW51XG4gICAgICAgICAgc2VydmVyPXtzZXJ2ZXJ9XG4gICAgICAgICAgc2VydmVyVG9vbHNDb3VudD17c2VydmVyVG9vbHNDb3VudH1cbiAgICAgICAgICBvblZpZXdUb29scz17aGFuZGxlTWNwVmlld1Rvb2xzfVxuICAgICAgICAgIG9uQ2FuY2VsPXtoYW5kbGVNY3BDYW5jZWx9XG4gICAgICAgICAgb25Db21wbGV0ZT17aGFuZGxlTWNwQ29tcGxldGV9XG4gICAgICAgICAgYm9yZGVybGVzc1xuICAgICAgICAvPlxuICAgICAgKVxuICAgIH1cblxuICAgIC8vIEZhbGxiYWNrIC0gc2hvdWxkbid0IGhhcHBlbiBidXQgaGFuZGxlIGdyYWNlZnVsbHlcbiAgICBzZXRWaWV3U3RhdGUoJ3BsdWdpbi1saXN0JylcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgLy8gTUNQIHRvb2xzIHZpZXdcbiAgaWYgKHR5cGVvZiB2aWV3U3RhdGUgPT09ICdvYmplY3QnICYmIHZpZXdTdGF0ZS50eXBlID09PSAnbWNwLXRvb2xzJykge1xuICAgIGNvbnN0IGNsaWVudCA9IHZpZXdTdGF0ZS5jbGllbnRcbiAgICBjb25zdCBzY29wZSA9IGNsaWVudC5jb25maWcuc2NvcGVcbiAgICBjb25zdCBjb25maWdUeXBlID0gY2xpZW50LmNvbmZpZy50eXBlXG5cbiAgICAvLyBCdWlsZCBTZXJ2ZXJJbmZvIGZvciBNQ1BUb29sTGlzdFZpZXdcbiAgICBsZXQgc2VydmVyOlxuICAgICAgfCBTdGRpb1NlcnZlckluZm9cbiAgICAgIHwgU1NFU2VydmVySW5mb1xuICAgICAgfCBIVFRQU2VydmVySW5mb1xuICAgICAgfCBDbGF1ZGVBSVNlcnZlckluZm9cbiAgICBpZiAoY29uZmlnVHlwZSA9PT0gJ3N0ZGlvJykge1xuICAgICAgc2VydmVyID0ge1xuICAgICAgICBuYW1lOiBjbGllbnQubmFtZSxcbiAgICAgICAgY2xpZW50LFxuICAgICAgICBzY29wZSxcbiAgICAgICAgdHJhbnNwb3J0OiAnc3RkaW8nLFxuICAgICAgICBjb25maWc6IGNsaWVudC5jb25maWcgYXMgTWNwU3RkaW9TZXJ2ZXJDb25maWcsXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjb25maWdUeXBlID09PSAnc3NlJykge1xuICAgICAgc2VydmVyID0ge1xuICAgICAgICBuYW1lOiBjbGllbnQubmFtZSxcbiAgICAgICAgY2xpZW50LFxuICAgICAgICBzY29wZSxcbiAgICAgICAgdHJhbnNwb3J0OiAnc3NlJyxcbiAgICAgICAgaXNBdXRoZW50aWNhdGVkOiB1bmRlZmluZWQsXG4gICAgICAgIGNvbmZpZzogY2xpZW50LmNvbmZpZyBhcyBNY3BTU0VTZXJ2ZXJDb25maWcsXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjb25maWdUeXBlID09PSAnaHR0cCcpIHtcbiAgICAgIHNlcnZlciA9IHtcbiAgICAgICAgbmFtZTogY2xpZW50Lm5hbWUsXG4gICAgICAgIGNsaWVudCxcbiAgICAgICAgc2NvcGUsXG4gICAgICAgIHRyYW5zcG9ydDogJ2h0dHAnLFxuICAgICAgICBpc0F1dGhlbnRpY2F0ZWQ6IHVuZGVmaW5lZCxcbiAgICAgICAgY29uZmlnOiBjbGllbnQuY29uZmlnIGFzIE1jcEhUVFBTZXJ2ZXJDb25maWcsXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlcnZlciA9IHtcbiAgICAgICAgbmFtZTogY2xpZW50Lm5hbWUsXG4gICAgICAgIGNsaWVudCxcbiAgICAgICAgc2NvcGUsXG4gICAgICAgIHRyYW5zcG9ydDogJ2NsYXVkZWFpLXByb3h5JyxcbiAgICAgICAgaXNBdXRoZW50aWNhdGVkOiB1bmRlZmluZWQsXG4gICAgICAgIGNvbmZpZzogY2xpZW50LmNvbmZpZyBhcyBNY3BDbGF1ZGVBSVByb3h5U2VydmVyQ29uZmlnLFxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICA8TUNQVG9vbExpc3RWaWV3XG4gICAgICAgIHNlcnZlcj17c2VydmVyfVxuICAgICAgICBvblNlbGVjdFRvb2w9eyh0b29sOiBUb29sKSA9PiB7XG4gICAgICAgICAgc2V0Vmlld1N0YXRlKHsgdHlwZTogJ21jcC10b29sLWRldGFpbCcsIGNsaWVudCwgdG9vbCB9KVxuICAgICAgICB9fVxuICAgICAgICBvbkJhY2s9eygpID0+IHNldFZpZXdTdGF0ZSh7IHR5cGU6ICdtY3AtZGV0YWlsJywgY2xpZW50IH0pfVxuICAgICAgLz5cbiAgICApXG4gIH1cblxuICAvLyBNQ1AgdG9vbCBkZXRhaWwgdmlld1xuICBpZiAodHlwZW9mIHZpZXdTdGF0ZSA9PT0gJ29iamVjdCcgJiYgdmlld1N0YXRlLnR5cGUgPT09ICdtY3AtdG9vbC1kZXRhaWwnKSB7XG4gICAgY29uc3QgeyBjbGllbnQsIHRvb2wgfSA9IHZpZXdTdGF0ZVxuICAgIGNvbnN0IHNjb3BlID0gY2xpZW50LmNvbmZpZy5zY29wZVxuICAgIGNvbnN0IGNvbmZpZ1R5cGUgPSBjbGllbnQuY29uZmlnLnR5cGVcblxuICAgIC8vIEJ1aWxkIFNlcnZlckluZm8gZm9yIE1DUFRvb2xEZXRhaWxWaWV3XG4gICAgbGV0IHNlcnZlcjpcbiAgICAgIHwgU3RkaW9TZXJ2ZXJJbmZvXG4gICAgICB8IFNTRVNlcnZlckluZm9cbiAgICAgIHwgSFRUUFNlcnZlckluZm9cbiAgICAgIHwgQ2xhdWRlQUlTZXJ2ZXJJbmZvXG4gICAgaWYgKGNvbmZpZ1R5cGUgPT09ICdzdGRpbycpIHtcbiAgICAgIHNlcnZlciA9IHtcbiAgICAgICAgbmFtZTogY2xpZW50Lm5hbWUsXG4gICAgICAgIGNsaWVudCxcbiAgICAgICAgc2NvcGUsXG4gICAgICAgIHRyYW5zcG9ydDogJ3N0ZGlvJyxcbiAgICAgICAgY29uZmlnOiBjbGllbnQuY29uZmlnIGFzIE1jcFN0ZGlvU2VydmVyQ29uZmlnLFxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY29uZmlnVHlwZSA9PT0gJ3NzZScpIHtcbiAgICAgIHNlcnZlciA9IHtcbiAgICAgICAgbmFtZTogY2xpZW50Lm5hbWUsXG4gICAgICAgIGNsaWVudCxcbiAgICAgICAgc2NvcGUsXG4gICAgICAgIHRyYW5zcG9ydDogJ3NzZScsXG4gICAgICAgIGlzQXV0aGVudGljYXRlZDogdW5kZWZpbmVkLFxuICAgICAgICBjb25maWc6IGNsaWVudC5jb25maWcgYXMgTWNwU1NFU2VydmVyQ29uZmlnLFxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY29uZmlnVHlwZSA9PT0gJ2h0dHAnKSB7XG4gICAgICBzZXJ2ZXIgPSB7XG4gICAgICAgIG5hbWU6IGNsaWVudC5uYW1lLFxuICAgICAgICBjbGllbnQsXG4gICAgICAgIHNjb3BlLFxuICAgICAgICB0cmFuc3BvcnQ6ICdodHRwJyxcbiAgICAgICAgaXNBdXRoZW50aWNhdGVkOiB1bmRlZmluZWQsXG4gICAgICAgIGNvbmZpZzogY2xpZW50LmNvbmZpZyBhcyBNY3BIVFRQU2VydmVyQ29uZmlnLFxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzZXJ2ZXIgPSB7XG4gICAgICAgIG5hbWU6IGNsaWVudC5uYW1lLFxuICAgICAgICBjbGllbnQsXG4gICAgICAgIHNjb3BlLFxuICAgICAgICB0cmFuc3BvcnQ6ICdjbGF1ZGVhaS1wcm94eScsXG4gICAgICAgIGlzQXV0aGVudGljYXRlZDogdW5kZWZpbmVkLFxuICAgICAgICBjb25maWc6IGNsaWVudC5jb25maWcgYXMgTWNwQ2xhdWRlQUlQcm94eVNlcnZlckNvbmZpZyxcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gKFxuICAgICAgPE1DUFRvb2xEZXRhaWxWaWV3XG4gICAgICAgIHRvb2w9e3Rvb2x9XG4gICAgICAgIHNlcnZlcj17c2VydmVyfVxuICAgICAgICBvbkJhY2s9eygpID0+IHNldFZpZXdTdGF0ZSh7IHR5cGU6ICdtY3AtdG9vbHMnLCBjbGllbnQgfSl9XG4gICAgICAvPlxuICAgIClcbiAgfVxuXG4gIC8vIFBsdWdpbiBsaXN0IHZpZXcgKG1haW4gbWFuYWdlbWVudCBpbnRlcmZhY2UpXG4gIGNvbnN0IHZpc2libGVJdGVtcyA9IHBhZ2luYXRpb24uZ2V0VmlzaWJsZUl0ZW1zKGZpbHRlcmVkSXRlbXMpXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIHsvKiBTZWFyY2ggYm94ICovfVxuICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICA8U2VhcmNoQm94XG4gICAgICAgICAgcXVlcnk9e3NlYXJjaFF1ZXJ5fVxuICAgICAgICAgIGlzRm9jdXNlZD17aXNTZWFyY2hNb2RlfVxuICAgICAgICAgIGlzVGVybWluYWxGb2N1c2VkPXtpc1Rlcm1pbmFsRm9jdXNlZH1cbiAgICAgICAgICB3aWR0aD17dGVybWluYWxXaWR0aCAtIDR9XG4gICAgICAgICAgY3Vyc29yT2Zmc2V0PXtzZWFyY2hDdXJzb3JPZmZzZXR9XG4gICAgICAgIC8+XG4gICAgICA8L0JveD5cblxuICAgICAgey8qIE5vIHNlYXJjaCByZXN1bHRzICovfVxuICAgICAge2ZpbHRlcmVkSXRlbXMubGVuZ3RoID09PSAwICYmIHNlYXJjaFF1ZXJ5ICYmIChcbiAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPk5vIGl0ZW1zIG1hdGNoICZxdW90O3tzZWFyY2hRdWVyeX0mcXVvdDs8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cblxuICAgICAgey8qIFNjcm9sbCB1cCBpbmRpY2F0b3IgKi99XG4gICAgICB7cGFnaW5hdGlvbi5zY3JvbGxQb3NpdGlvbi5jYW5TY3JvbGxVcCAmJiAoXG4gICAgICAgIDxCb3g+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+IHtmaWd1cmVzLmFycm93VXB9IG1vcmUgYWJvdmU8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cblxuICAgICAgey8qIFVuaWZpZWQgbGlzdCBvZiBwbHVnaW5zIGFuZCBNQ1BzIGdyb3VwZWQgYnkgc2NvcGUgKi99XG4gICAgICB7dmlzaWJsZUl0ZW1zLm1hcCgoaXRlbSwgdmlzaWJsZUluZGV4KSA9PiB7XG4gICAgICAgIGNvbnN0IGFjdHVhbEluZGV4ID0gcGFnaW5hdGlvbi50b0FjdHVhbEluZGV4KHZpc2libGVJbmRleClcbiAgICAgICAgY29uc3QgaXNTZWxlY3RlZCA9IGFjdHVhbEluZGV4ID09PSBzZWxlY3RlZEluZGV4ICYmICFpc1NlYXJjaE1vZGVcblxuICAgICAgICAvLyBDaGVjayBpZiB3ZSBuZWVkIHRvIHNob3cgYSBzY29wZSBoZWFkZXJcbiAgICAgICAgY29uc3QgcHJldkl0ZW0gPVxuICAgICAgICAgIHZpc2libGVJbmRleCA+IDAgPyB2aXNpYmxlSXRlbXNbdmlzaWJsZUluZGV4IC0gMV0gOiBudWxsXG4gICAgICAgIGNvbnN0IHNob3dTY29wZUhlYWRlciA9ICFwcmV2SXRlbSB8fCBwcmV2SXRlbS5zY29wZSAhPT0gaXRlbS5zY29wZVxuXG4gICAgICAgIC8vIEdldCBzY29wZSBsYWJlbFxuICAgICAgICBjb25zdCBnZXRTY29wZUxhYmVsID0gKHNjb3BlOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICAgICAgICAgIHN3aXRjaCAoc2NvcGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ2ZsYWdnZWQnOlxuICAgICAgICAgICAgICByZXR1cm4gJ0ZsYWdnZWQnXG4gICAgICAgICAgICBjYXNlICdwcm9qZWN0JzpcbiAgICAgICAgICAgICAgcmV0dXJuICdQcm9qZWN0J1xuICAgICAgICAgICAgY2FzZSAnbG9jYWwnOlxuICAgICAgICAgICAgICByZXR1cm4gJ0xvY2FsJ1xuICAgICAgICAgICAgY2FzZSAndXNlcic6XG4gICAgICAgICAgICAgIHJldHVybiAnVXNlcidcbiAgICAgICAgICAgIGNhc2UgJ2VudGVycHJpc2UnOlxuICAgICAgICAgICAgICByZXR1cm4gJ0VudGVycHJpc2UnXG4gICAgICAgICAgICBjYXNlICdtYW5hZ2VkJzpcbiAgICAgICAgICAgICAgcmV0dXJuICdNYW5hZ2VkJ1xuICAgICAgICAgICAgY2FzZSAnYnVpbHRpbic6XG4gICAgICAgICAgICAgIHJldHVybiAnQnVpbHQtaW4nXG4gICAgICAgICAgICBjYXNlICdkeW5hbWljJzpcbiAgICAgICAgICAgICAgcmV0dXJuICdCdWlsdC1pbidcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIHJldHVybiBzY29wZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPFJlYWN0LkZyYWdtZW50IGtleT17aXRlbS5pZH0+XG4gICAgICAgICAgICB7c2hvd1Njb3BlSGVhZGVyICYmIChcbiAgICAgICAgICAgICAgPEJveCBtYXJnaW5Ub3A9e3Zpc2libGVJbmRleCA+IDAgPyAxIDogMH0gcGFkZGluZ0xlZnQ9ezJ9PlxuICAgICAgICAgICAgICAgIDxUZXh0XG4gICAgICAgICAgICAgICAgICBkaW1Db2xvcj17aXRlbS5zY29wZSAhPT0gJ2ZsYWdnZWQnfVxuICAgICAgICAgICAgICAgICAgY29sb3I9e2l0ZW0uc2NvcGUgPT09ICdmbGFnZ2VkJyA/ICd3YXJuaW5nJyA6IHVuZGVmaW5lZH1cbiAgICAgICAgICAgICAgICAgIGJvbGQ9e2l0ZW0uc2NvcGUgPT09ICdmbGFnZ2VkJ31cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICB7Z2V0U2NvcGVMYWJlbChpdGVtLnNjb3BlKX1cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDxVbmlmaWVkSW5zdGFsbGVkQ2VsbCBpdGVtPXtpdGVtfSBpc1NlbGVjdGVkPXtpc1NlbGVjdGVkfSAvPlxuICAgICAgICAgIDwvUmVhY3QuRnJhZ21lbnQ+XG4gICAgICAgIClcbiAgICAgIH0pfVxuXG4gICAgICB7LyogU2Nyb2xsIGRvd24gaW5kaWNhdG9yICovfVxuICAgICAge3BhZ2luYXRpb24uc2Nyb2xsUG9zaXRpb24uY2FuU2Nyb2xsRG93biAmJiAoXG4gICAgICAgIDxCb3g+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+IHtmaWd1cmVzLmFycm93RG93bn0gbW9yZSBiZWxvdzwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuXG4gICAgICB7LyogSGVscCB0ZXh0ICovfVxuICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9IG1hcmdpbkxlZnQ9ezF9PlxuICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgIDxUZXh0PnR5cGUgdG8gc2VhcmNoPC9UZXh0PlxuICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICBhY3Rpb249XCJwbHVnaW46dG9nZ2xlXCJcbiAgICAgICAgICAgICAgY29udGV4dD1cIlBsdWdpblwiXG4gICAgICAgICAgICAgIGZhbGxiYWNrPVwiU3BhY2VcIlxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cInRvZ2dsZVwiXG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAgPENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludFxuICAgICAgICAgICAgICBhY3Rpb249XCJzZWxlY3Q6YWNjZXB0XCJcbiAgICAgICAgICAgICAgY29udGV4dD1cIlNlbGVjdFwiXG4gICAgICAgICAgICAgIGZhbGxiYWNrPVwiRW50ZXJcIlxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImRldGFpbHNcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICBmYWxsYmFjaz1cIkVzY1wiXG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiYmFja1wiXG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICA8L1RleHQ+XG4gICAgICA8L0JveD5cblxuICAgICAgey8qIFJlbG9hZCBkaXNjbGFpbWVyIGZvciBwbHVnaW4gY2hhbmdlcyAqL31cbiAgICAgIHtwZW5kaW5nVG9nZ2xlcy5zaXplID4gMCAmJiAoXG4gICAgICAgIDxCb3ggbWFyZ2luTGVmdD17MX0+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3IgaXRhbGljPlxuICAgICAgICAgICAgUnVuIC9yZWxvYWQtcGx1Z2lucyB0byBhcHBseSBjaGFuZ2VzXG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgICl9XG4gICAgPC9Cb3g+XG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsT0FBT0EsT0FBTyxNQUFNLFNBQVM7QUFDN0IsY0FBY0MsTUFBTSxRQUFRLElBQUk7QUFDaEMsT0FBTyxLQUFLQyxFQUFFLE1BQU0sYUFBYTtBQUNqQyxPQUFPLEtBQUtDLElBQUksTUFBTSxNQUFNO0FBQzVCLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0MsV0FBVyxFQUFFQyxTQUFTLEVBQUVDLE9BQU8sRUFBRUMsTUFBTSxFQUFFQyxRQUFRLFFBQVEsT0FBTztBQUN6RSxTQUFTQyx3QkFBd0IsUUFBUSw4Q0FBOEM7QUFDdkYsU0FBU0MsTUFBTSxRQUFRLDBDQUEwQztBQUNqRSxTQUFTQyxtQkFBbUIsUUFBUSw2Q0FBNkM7QUFDakYsU0FBU0Msa0JBQWtCLFFBQVEsNENBQTRDO0FBQy9FLFNBQVNDLGlCQUFpQixRQUFRLDJDQUEyQztBQUM3RSxTQUFTQyxlQUFlLFFBQVEseUNBQXlDO0FBQ3pFLGNBQ0VDLGtCQUFrQixFQUNsQkMsY0FBYyxFQUNkQyxhQUFhLEVBQ2JDLGVBQWUsUUFDViwrQkFBK0I7QUFDdEMsU0FBU0MsU0FBUyxRQUFRLCtCQUErQjtBQUN6RCxTQUFTQyxjQUFjLFFBQVEsK0JBQStCO0FBQzlELFNBQVNDLGVBQWUsUUFBUSxnQ0FBZ0M7QUFDaEU7QUFDQSxTQUFTQyxHQUFH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