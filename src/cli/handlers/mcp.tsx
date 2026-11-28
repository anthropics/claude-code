/**
 * MCP subcommand handlers — extracted from main.tsx for lazy loading.
 * These are dynamically imported only when the corresponding `claude mcp *` command runs.
 */

import { stat } from 'fs/promises';
import pMap from 'p-map';
import { cwd } from 'process';
import React from 'react';
import { MCPServerDesktopImportDialog } from '../../components/MCPServerDesktopImportDialog.js';
import { render } from '../../ink.js';
import { KeybindingSetup } from '../../keybindings/KeybindingProviderSetup.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../../services/analytics/index.js';
import { clearMcpClientConfig, clearServerTokensFromLocalStorage, getMcpClientConfig, readClientSecret, saveMcpClientSecret } from '../../services/mcp/auth.js';
import { connectToServer, getMcpServerConnectionBatchSize } from '../../services/mcp/client.js';
import { addMcpConfig, getAllMcpConfigs, getMcpConfigByName, getMcpConfigsByScope, removeMcpConfig } from '../../services/mcp/config.js';
import type { ConfigScope, ScopedMcpServerConfig } from '../../services/mcp/types.js';
import { describeMcpConfigFilePath, ensureConfigScope, getScopeLabel } from '../../services/mcp/utils.js';
import { AppStateProvider } from '../../state/AppState.js';
import { getCurrentProjectConfig, getGlobalConfig, saveCurrentProjectConfig } from '../../utils/config.js';
import { isFsInaccessible } from '../../utils/errors.js';
import { gracefulShutdown } from '../../utils/gracefulShutdown.js';
import { safeParseJSON } from '../../utils/json.js';
import { getPlatform } from '../../utils/platform.js';
import { cliError, cliOk } from '../exit.js';
async function checkMcpServerHealth(name: string, server: ScopedMcpServerConfig): Promise<string> {
  try {
    const result = await connectToServer(name, server);
    if (result.type === 'connected') {
      return '✓ Connected';
    } else if (result.type === 'needs-auth') {
      return '! Needs authentication';
    } else {
      return '✗ Failed to connect';
    }
  } catch (_error) {
    return '✗ Connection error';
  }
}

// mcp serve (lines 4512–4532)
export async function mcpServeHandler({
  debug,
  verbose
}: {
  debug?: boolean;
  verbose?: boolean;
}): Promise<void> {
  const providedCwd = cwd();
  logEvent('tengu_mcp_start', {});
  try {
    await stat(providedCwd);
  } catch (error) {
    if (isFsInaccessible(error)) {
      cliError(`Error: Directory ${providedCwd} does not exist`);
    }
    throw error;
  }
  try {
    const {
      setup
    } = await import('../../setup.js');
    await setup(providedCwd, 'default', false, false, undefined, false);
    const {
      startMCPServer
    } = await import('../../entrypoints/mcp.js');
    await startMCPServer(providedCwd, debug ?? false, verbose ?? false);
  } catch (error) {
    cliError(`Error: Failed to start MCP server: ${error}`);
  }
}

// mcp remove (lines 4545–4635)
export async function mcpRemoveHandler(name: string, options: {
  scope?: string;
}): Promise<void> {
  // Look up config before removing so we can clean up secure storage
  const serverBeforeRemoval = getMcpConfigByName(name);
  const cleanupSecureStorage = () => {
    if (serverBeforeRemoval && (serverBeforeRemoval.type === 'sse' || serverBeforeRemoval.type === 'http')) {
      clearServerTokensFromLocalStorage(name, serverBeforeRemoval);
      clearMcpClientConfig(name, serverBeforeRemoval);
    }
  };
  try {
    if (options.scope) {
      const scope = ensureConfigScope(options.scope);
      logEvent('tengu_mcp_delete', {
        name: name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        scope: scope as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      await removeMcpConfig(name, scope);
      cleanupSecureStorage();
      process.stdout.write(`Removed MCP server ${name} from ${scope} config\n`);
      cliOk(`File modified: ${describeMcpConfigFilePath(scope)}`);
    }

    // If no scope specified, check where the server exists
    const projectConfig = getCurrentProjectConfig();
    const globalConfig = getGlobalConfig();

    // Check if server exists in project scope (.mcp.json)
    const {
      servers: projectServers
    } = getMcpConfigsByScope('project');
    const mcpJsonExists = !!projectServers[name];

    // Count how many scopes contain this server
    const scopes: Array<Exclude<ConfigScope, 'dynamic'>> = [];
    if (projectConfig.mcpServers?.[name]) scopes.push('local');
    if (mcpJsonExists) scopes.push('project');
    if (globalConfig.mcpServers?.[name]) scopes.push('user');
    if (scopes.length === 0) {
      cliError(`No MCP server found with name: "${name}"`);
    } else if (scopes.length === 1) {
      // Server exists in only one scope, remove it
      const scope = scopes[0]!;
      logEvent('tengu_mcp_delete', {
        name: name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        scope: scope as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      await removeMcpConfig(name, scope);
      cleanupSecureStorage();
      process.stdout.write(`Removed MCP server "${name}" from ${scope} config\n`);
      cliOk(`File modified: ${describeMcpConfigFilePath(scope)}`);
    } else {
      // Server exists in multiple scopes
      process.stderr.write(`MCP server "${name}" exists in multiple scopes:\n`);
      scopes.forEach(scope => {
        process.stderr.write(`  - ${getScopeLabel(scope)} (${describeMcpConfigFilePath(scope)})\n`);
      });
      process.stderr.write('\nTo remove from a specific scope, use:\n');
      scopes.forEach(scope => {
        process.stderr.write(`  claude mcp remove "${name}" -s ${scope}\n`);
      });
      cliError();
    }
  } catch (error) {
    cliError((error as Error).message);
  }
}

// mcp list (lines 4641–4688)
export async function mcpListHandler(): Promise<void> {
  logEvent('tengu_mcp_list', {});
  const {
    servers: configs
  } = await getAllMcpConfigs();
  if (Object.keys(configs).length === 0) {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log('No MCP servers configured. Use `claude mcp add` to add a server.');
  } else {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log('Checking MCP server health...\n');

    // Check servers concurrently
    const entries = Object.entries(configs);
    const results = await pMap(entries, async ([name, server]) => ({
      name,
      server,
      status: await checkMcpServerHealth(name, server)
    }), {
      concurrency: getMcpServerConnectionBatchSize()
    });
    for (const {
      name,
      server,
      status
    } of results) {
      // Intentionally excluding sse-ide servers here since they're internal
      if (server.type === 'sse') {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.log(`${name}: ${server.url} (SSE) - ${status}`);
      } else if (server.type === 'http') {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.log(`${name}: ${server.url} (HTTP) - ${status}`);
      } else if (server.type === 'claudeai-proxy') {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.log(`${name}: ${server.url} - ${status}`);
      } else if (!server.type || server.type === 'stdio') {
        const args = Array.isArray(server.args) ? server.args : [];
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.log(`${name}: ${server.command} ${args.join(' ')} - ${status}`);
      }
    }
  }
  // Use gracefulShutdown to properly clean up MCP server connections
  // (process.exit bypasses cleanup handlers, leaving child processes orphaned)
  await gracefulShutdown(0);
}

// mcp get (lines 4694–4786)
export async function mcpGetHandler(name: string): Promise<void> {
  logEvent('tengu_mcp_get', {
    name: name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  });
  const server = getMcpConfigByName(name);
  if (!server) {
    cliError(`No MCP server found with name: ${name}`);
  }

  // biome-ignore lint/suspicious/noConsole:: intentional console output
  console.log(`${name}:`);
  // biome-ignore lint/suspicious/noConsole:: intentional console output
  console.log(`  Scope: ${getScopeLabel(server.scope)}`);

  // Check server health
  const status = await checkMcpServerHealth(name, server);
  // biome-ignore lint/suspicious/noConsole:: intentional console output
  console.log(`  Status: ${status}`);

  // Intentionally excluding sse-ide servers here since they're internal
  if (server.type === 'sse') {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`  Type: sse`);
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`  URL: ${server.url}`);
    if (server.headers) {
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.log('  Headers:');
      for (const [key, value] of Object.entries(server.headers)) {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.log(`    ${key}: ${value}`);
      }
    }
    if (server.oauth?.clientId || server.oauth?.callbackPort) {
      const parts: string[] = [];
      if (server.oauth.clientId) {
        parts.push('client_id configured');
        const clientConfig = getMcpClientConfig(name, server);
        if (clientConfig?.clientSecret) parts.push('client_secret configured');
      }
      if (server.oauth.callbackPort) parts.push(`callback_port ${server.oauth.callbackPort}`);
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.log(`  OAuth: ${parts.join(', ')}`);
    }
  } else if (server.type === 'http') {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`  Type: http`);
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`  URL: ${server.url}`);
    if (server.headers) {
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.log('  Headers:');
      for (const [key, value] of Object.entries(server.headers)) {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.log(`    ${key}: ${value}`);
      }
    }
    if (server.oauth?.clientId || server.oauth?.callbackPort) {
      const parts: string[] = [];
      if (server.oauth.clientId) {
        parts.push('client_id configured');
        const clientConfig = getMcpClientConfig(name, server);
        if (clientConfig?.clientSecret) parts.push('client_secret configured');
      }
      if (server.oauth.callbackPort) parts.push(`callback_port ${server.oauth.callbackPort}`);
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.log(`  OAuth: ${parts.join(', ')}`);
    }
  } else if (server.type === 'stdio') {
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`  Type: stdio`);
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`  Command: ${server.command}`);
    const args = Array.isArray(server.args) ? server.args : [];
    // biome-ignore lint/suspicious/noConsole:: intentional console output
    console.log(`  Args: ${args.join(' ')}`);
    if (server.env) {
      // biome-ignore lint/suspicious/noConsole:: intentional console output
      console.log('  Environment:');
      for (const [key, value] of Object.entries(server.env)) {
        // biome-ignore lint/suspicious/noConsole:: intentional console output
        console.log(`    ${key}=${value}`);
      }
    }
  }
  // biome-ignore lint/suspicious/noConsole:: intentional console output
  console.log(`\nTo remove this server, run: claude mcp remove "${name}" -s ${server.scope}`);
  // Use gracefulShutdown to properly clean up MCP server connections
  // (process.exit bypasses cleanup handlers, leaving child processes orphaned)
  await gracefulShutdown(0);
}

// mcp add-json (lines 4801–4870)
export async function mcpAddJsonHandler(name: string, json: string, options: {
  scope?: string;
  clientSecret?: true;
}): Promise<void> {
  try {
    const scope = ensureConfigScope(options.scope);
    const parsedJson = safeParseJSON(json);

    // Read secret before writing config so cancellation doesn't leave partial state
    const needsSecret = options.clientSecret && parsedJson && typeof parsedJson === 'object' && 'type' in parsedJson && (parsedJson.type === 'sse' || parsedJson.type === 'http') && 'url' in parsedJson && typeof parsedJson.url === 'string' && 'oauth' in parsedJson && parsedJson.oauth && typeof parsedJson.oauth === 'object' && 'clientId' in parsedJson.oauth;
    const clientSecret = needsSecret ? await readClientSecret() : undefined;
    await addMcpConfig(name, parsedJson, scope);
    const transportType = parsedJson && typeof parsedJson === 'object' && 'type' in parsedJson ? String(parsedJson.type || 'stdio') : 'stdio';
    if (clientSecret && parsedJson && typeof parsedJson === 'object' && 'type' in parsedJson && (parsedJson.type === 'sse' || parsedJson.type === 'http') && 'url' in parsedJson && typeof parsedJson.url === 'string') {
      saveMcpClientSecret(name, {
        type: parsedJson.type,
        url: parsedJson.url
      }, clientSecret);
    }
    logEvent('tengu_mcp_add', {
      scope: scope as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      source: 'json' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      type: transportType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    cliOk(`Added ${transportType} MCP server ${name} to ${scope} config`);
  } catch (error) {
    cliError((error as Error).message);
  }
}

// mcp add-from-claude-desktop (lines 4881–4927)
export async function mcpAddFromDesktopHandler(options: {
  scope?: string;
}): Promise<void> {
  try {
    const scope = ensureConfigScope(options.scope);
    const platform = getPlatform();
    logEvent('tengu_mcp_add', {
      scope: scope as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      platform: platform as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      source: 'desktop' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    const {
      readClaudeDesktopMcpServers
    } = await import('../../utils/claudeDesktop.js');
    const servers = await readClaudeDesktopMcpServers();
    if (Object.keys(servers).length === 0) {
      cliOk('No MCP servers found in Claude Desktop configuration or configuration file does not exist.');
    }
    const {
      unmount
    } = await render(<AppStateProvider>
        <KeybindingSetup>
          <MCPServerDesktopImportDialog servers={servers} scope={scope} onDone={() => {
          unmount();
        }} />
        </KeybindingSetup>
      </AppStateProvider>, {
      exitOnCtrlC: true
    });
  } catch (error) {
    cliError((error as Error).message);
  }
}

// mcp reset-project-choices (lines 4935–4952)
export async function mcpResetChoicesHandler(): Promise<void> {
  logEvent('tengu_mcp_reset_mcpjson_choices', {});
  saveCurrentProjectConfig(current => ({
    ...current,
    enabledMcpjsonServers: [],
    disabledMcpjsonServers: [],
    enableAllProjectMcpServers: false
  }));
  cliOk('All project-scoped (.mcp.json) server approvals and rejections have been reset.\n' + 'You will be prompted for approval next time you start Claude Code.');
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJzdGF0IiwicE1hcCIsImN3ZCIsIlJlYWN0IiwiTUNQU2VydmVyRGVza3RvcEltcG9ydERpYWxvZyIsInJlbmRlciIsIktleWJpbmRpbmdTZXR1cCIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJsb2dFdmVudCIsImNsZWFyTWNwQ2xpZW50Q29uZmlnIiwiY2xlYXJTZXJ2ZXJUb2tlbnNGcm9tTG9jYWxTdG9yYWdlIiwiZ2V0TWNwQ2xpZW50Q29uZmlnIiwicmVhZENsaWVudFNlY3JldCIsInNhdmVNY3BDbGllbnRTZWNyZXQiLCJjb25uZWN0VG9TZXJ2ZXIiLCJnZXRNY3BTZXJ2ZXJDb25uZWN0aW9uQmF0Y2hTaXplIiwiYWRkTWNwQ29uZmlnIiwiZ2V0QWxsTWNwQ29uZmlncyIsImdldE1jcENvbmZpZ0J5TmFtZSIsImdldE1jcENvbmZpZ3NCeVNjb3BlIiwicmVtb3ZlTWNwQ29uZmlnIiwiQ29uZmlnU2NvcGUiLCJTY29wZWRNY3BTZXJ2ZXJDb25maWciLCJkZXNjcmliZU1jcENvbmZpZ0ZpbGVQYXRoIiwiZW5zdXJlQ29uZmlnU2NvcGUiLCJnZXRTY29wZUxhYmVsIiwiQXBwU3RhdGVQcm92aWRlciIsImdldEN1cnJlbnRQcm9qZWN0Q29uZmlnIiwiZ2V0R2xvYmFsQ29uZmlnIiwic2F2ZUN1cnJlbnRQcm9qZWN0Q29uZmlnIiwiaXNGc0luYWNjZXNzaWJsZSIsImdyYWNlZnVsU2h1dGRvd24iLCJzYWZlUGFyc2VKU09OIiwiZ2V0UGxhdGZvcm0iLCJjbGlFcnJvciIsImNsaU9rIiwiY2hlY2tNY3BTZXJ2ZXJIZWFsdGgiLCJuYW1lIiwic2VydmVyIiwiUHJvbWlzZSIsInJlc3VsdCIsInR5cGUiLCJfZXJyb3IiLCJtY3BTZXJ2ZUhhbmRsZXIiLCJkZWJ1ZyIsInZlcmJvc2UiLCJwcm92aWRlZEN3ZCIsImVycm9yIiwic2V0dXAiLCJ1bmRlZmluZWQiLCJzdGFydE1DUFNlcnZlciIsIm1jcFJlbW92ZUhhbmRsZXIiLCJvcHRpb25zIiwic2NvcGUiLCJzZXJ2ZXJCZWZvcmVSZW1vdmFsIiwiY2xlYW51cFNlY3VyZVN0b3JhZ2UiLCJwcm9jZXNzIiwic3Rkb3V0Iiwid3JpdGUiLCJwcm9qZWN0Q29uZmlnIiwiZ2xvYmFsQ29uZmlnIiwic2VydmVycyIsInByb2plY3RTZXJ2ZXJzIiwibWNwSnNvbkV4aXN0cyIsInNjb3BlcyIsIkFycmF5IiwiRXhjbHVkZSIsIm1jcFNlcnZlcnMiLCJwdXNoIiwibGVuZ3RoIiwic3RkZXJyIiwiZm9yRWFjaCIsIkVycm9yIiwibWVzc2FnZSIsIm1jcExpc3RIYW5kbGVyIiwiY29uZmlncyIsIk9iamVjdCIsImtleXMiLCJjb25zb2xlIiwibG9nIiwiZW50cmllcyIsInJlc3VsdHMiLCJzdGF0dXMiLCJjb25jdXJyZW5jeSIsInVybCIsImFyZ3MiLCJpc0FycmF5IiwiY29tbWFuZCIsImpvaW4iLCJtY3BHZXRIYW5kbGVyIiwiaGVhZGVycyIsImtleSIsInZhbHVlIiwib2F1dGgiLCJjbGllbnRJZCIsImNhbGxiYWNrUG9ydCIsInBhcnRzIiwiY2xpZW50Q29uZmlnIiwiY2xpZW50U2VjcmV0IiwiZW52IiwibWNwQWRkSnNvbkhhbmRsZXIiLCJqc29uIiwicGFyc2VkSnNvbiIsIm5lZWRzU2VjcmV0IiwidHJhbnNwb3J0VHlwZSIsIlN0cmluZyIsInNvdXJjZSIsIm1jcEFkZEZyb21EZXNrdG9wSGFuZGxlciIsInBsYXRmb3JtIiwicmVhZENsYXVkZURlc2t0b3BNY3BTZXJ2ZXJzIiwidW5tb3VudCIsImV4aXRPbkN0cmxDIiwibWNwUmVzZXRDaG9pY2VzSGFuZGxlciIsImN1cnJlbnQiLCJlbmFibGVkTWNwanNvblNlcnZlcnMiLCJkaXNhYmxlZE1jcGpzb25TZXJ2ZXJzIiwiZW5hYmxlQWxsUHJvamVjdE1jcFNlcnZlcnMiXSwic291cmNlcyI6WyJtY3AudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTUNQIHN1YmNvbW1hbmQgaGFuZGxlcnMg4oCUIGV4dHJhY3RlZCBmcm9tIG1haW4udHN4IGZvciBsYXp5IGxvYWRpbmcuXG4gKiBUaGVzZSBhcmUgZHluYW1pY2FsbHkgaW1wb3J0ZWQgb25seSB3aGVuIHRoZSBjb3JyZXNwb25kaW5nIGBjbGF1ZGUgbWNwICpgIGNvbW1hbmQgcnVucy5cbiAqL1xuXG5pbXBvcnQgeyBzdGF0IH0gZnJvbSAnZnMvcHJvbWlzZXMnXG5pbXBvcnQgcE1hcCBmcm9tICdwLW1hcCdcbmltcG9ydCB7IGN3ZCB9IGZyb20gJ3Byb2Nlc3MnXG5pbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyBNQ1BTZXJ2ZXJEZXNrdG9wSW1wb3J0RGlhbG9nIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9NQ1BTZXJ2ZXJEZXNrdG9wSW1wb3J0RGlhbG9nLmpzJ1xuaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSAnLi4vLi4vaW5rLmpzJ1xuaW1wb3J0IHsgS2V5YmluZGluZ1NldHVwIH0gZnJvbSAnLi4vLi4va2V5YmluZGluZ3MvS2V5YmluZGluZ1Byb3ZpZGVyU2V0dXAuanMnXG5pbXBvcnQge1xuICB0eXBlIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gIGxvZ0V2ZW50LFxufSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hbmFseXRpY3MvaW5kZXguanMnXG5pbXBvcnQge1xuICBjbGVhck1jcENsaWVudENvbmZpZyxcbiAgY2xlYXJTZXJ2ZXJUb2tlbnNGcm9tTG9jYWxTdG9yYWdlLFxuICBnZXRNY3BDbGllbnRDb25maWcsXG4gIHJlYWRDbGllbnRTZWNyZXQsXG4gIHNhdmVNY3BDbGllbnRTZWNyZXQsXG59IGZyb20gJy4uLy4uL3NlcnZpY2VzL21jcC9hdXRoLmpzJ1xuaW1wb3J0IHtcbiAgY29ubmVjdFRvU2VydmVyLFxuICBnZXRNY3BTZXJ2ZXJDb25uZWN0aW9uQmF0Y2hTaXplLFxufSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tY3AvY2xpZW50LmpzJ1xuaW1wb3J0IHtcbiAgYWRkTWNwQ29uZmlnLFxuICBnZXRBbGxNY3BDb25maWdzLFxuICBnZXRNY3BDb25maWdCeU5hbWUsXG4gIGdldE1jcENvbmZpZ3NCeVNjb3BlLFxuICByZW1vdmVNY3BDb25maWcsXG59IGZyb20gJy4uLy4uL3NlcnZpY2VzL21jcC9jb25maWcuanMnXG5pbXBvcnQgdHlwZSB7XG4gIENvbmZpZ1Njb3BlLFxuICBTY29wZWRNY3BTZXJ2ZXJDb25maWcsXG59IGZyb20gJy4uLy4uL3NlcnZpY2VzL21jcC90eXBlcy5qcydcbmltcG9ydCB7XG4gIGRlc2NyaWJlTWNwQ29uZmlnRmlsZVBhdGgsXG4gIGVuc3VyZUNvbmZpZ1Njb3BlLFxuICBnZXRTY29wZUxhYmVsLFxufSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tY3AvdXRpbHMuanMnXG5pbXBvcnQgeyBBcHBTdGF0ZVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQge1xuICBnZXRDdXJyZW50UHJvamVjdENvbmZpZyxcbiAgZ2V0R2xvYmFsQ29uZmlnLFxuICBzYXZlQ3VycmVudFByb2plY3RDb25maWcsXG59IGZyb20gJy4uLy4uL3V0aWxzL2NvbmZpZy5qcydcbmltcG9ydCB7IGlzRnNJbmFjY2Vzc2libGUgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcnMuanMnXG5pbXBvcnQgeyBncmFjZWZ1bFNodXRkb3duIH0gZnJvbSAnLi4vLi4vdXRpbHMvZ3JhY2VmdWxTaHV0ZG93bi5qcydcbmltcG9ydCB7IHNhZmVQYXJzZUpTT04gfSBmcm9tICcuLi8uLi91dGlscy9qc29uLmpzJ1xuaW1wb3J0IHsgZ2V0UGxhdGZvcm0gfSBmcm9tICcuLi8uLi91dGlscy9wbGF0Zm9ybS5qcydcbmltcG9ydCB7IGNsaUVycm9yLCBjbGlPayB9IGZyb20gJy4uL2V4aXQuanMnXG5cbmFzeW5jIGZ1bmN0aW9uIGNoZWNrTWNwU2VydmVySGVhbHRoKFxuICBuYW1lOiBzdHJpbmcsXG4gIHNlcnZlcjogU2NvcGVkTWNwU2VydmVyQ29uZmlnLFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb25uZWN0VG9TZXJ2ZXIobmFtZSwgc2VydmVyKVxuICAgIGlmIChyZXN1bHQudHlwZSA9PT0gJ2Nvbm5lY3RlZCcpIHtcbiAgICAgIHJldHVybiAn4pyTIENvbm5lY3RlZCdcbiAgICB9IGVsc2UgaWYgKHJlc3VsdC50eXBlID09PSAnbmVlZHMtYXV0aCcpIHtcbiAgICAgIHJldHVybiAnISBOZWVkcyBhdXRoZW50aWNhdGlvbidcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICfinJcgRmFpbGVkIHRvIGNvbm5lY3QnXG4gICAgfVxuICB9IGNhdGNoIChfZXJyb3IpIHtcbiAgICByZXR1cm4gJ+KclyBDb25uZWN0aW9uIGVycm9yJ1xuICB9XG59XG5cbi8vIG1jcCBzZXJ2ZSAobGluZXMgNDUxMuKAkzQ1MzIpXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWNwU2VydmVIYW5kbGVyKHtcbiAgZGVidWcsXG4gIHZlcmJvc2UsXG59OiB7XG4gIGRlYnVnPzogYm9vbGVhblxuICB2ZXJib3NlPzogYm9vbGVhblxufSk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBwcm92aWRlZEN3ZCA9IGN3ZCgpXG4gIGxvZ0V2ZW50KCd0ZW5ndV9tY3Bfc3RhcnQnLCB7fSlcblxuICB0cnkge1xuICAgIGF3YWl0IHN0YXQocHJvdmlkZWRDd2QpXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKGlzRnNJbmFjY2Vzc2libGUoZXJyb3IpKSB7XG4gICAgICBjbGlFcnJvcihgRXJyb3I6IERpcmVjdG9yeSAke3Byb3ZpZGVkQ3dkfSBkb2VzIG5vdCBleGlzdGApXG4gICAgfVxuICAgIHRocm93IGVycm9yXG4gIH1cblxuICB0cnkge1xuICAgIGNvbnN0IHsgc2V0dXAgfSA9IGF3YWl0IGltcG9ydCgnLi4vLi4vc2V0dXAuanMnKVxuICAgIGF3YWl0IHNldHVwKHByb3ZpZGVkQ3dkLCAnZGVmYXVsdCcsIGZhbHNlLCBmYWxzZSwgdW5kZWZpbmVkLCBmYWxzZSlcbiAgICBjb25zdCB7IHN0YXJ0TUNQU2VydmVyIH0gPSBhd2FpdCBpbXBvcnQoJy4uLy4uL2VudHJ5cG9pbnRzL21jcC5qcycpXG4gICAgYXdhaXQgc3RhcnRNQ1BTZXJ2ZXIocHJvdmlkZWRDd2QsIGRlYnVnID8/IGZhbHNlLCB2ZXJib3NlID8/IGZhbHNlKVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNsaUVycm9yKGBFcnJvcjogRmFpbGVkIHRvIHN0YXJ0IE1DUCBzZXJ2ZXI6ICR7ZXJyb3J9YClcbiAgfVxufVxuXG4vLyBtY3AgcmVtb3ZlIChsaW5lcyA0NTQ14oCTNDYzNSlcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtY3BSZW1vdmVIYW5kbGVyKFxuICBuYW1lOiBzdHJpbmcsXG4gIG9wdGlvbnM6IHsgc2NvcGU/OiBzdHJpbmcgfSxcbik6IFByb21pc2U8dm9pZD4ge1xuICAvLyBMb29rIHVwIGNvbmZpZyBiZWZvcmUgcmVtb3Zpbmcgc28gd2UgY2FuIGNsZWFuIHVwIHNlY3VyZSBzdG9yYWdlXG4gIGNvbnN0IHNlcnZlckJlZm9yZVJlbW92YWwgPSBnZXRNY3BDb25maWdCeU5hbWUobmFtZSlcblxuICBjb25zdCBjbGVhbnVwU2VjdXJlU3RvcmFnZSA9ICgpID0+IHtcbiAgICBpZiAoXG4gICAgICBzZXJ2ZXJCZWZvcmVSZW1vdmFsICYmXG4gICAgICAoc2VydmVyQmVmb3JlUmVtb3ZhbC50eXBlID09PSAnc3NlJyB8fFxuICAgICAgICBzZXJ2ZXJCZWZvcmVSZW1vdmFsLnR5cGUgPT09ICdodHRwJylcbiAgICApIHtcbiAgICAgIGNsZWFyU2VydmVyVG9rZW5zRnJvbUxvY2FsU3RvcmFnZShuYW1lLCBzZXJ2ZXJCZWZvcmVSZW1vdmFsKVxuICAgICAgY2xlYXJNY3BDbGllbnRDb25maWcobmFtZSwgc2VydmVyQmVmb3JlUmVtb3ZhbClcbiAgICB9XG4gIH1cblxuICB0cnkge1xuICAgIGlmIChvcHRpb25zLnNjb3BlKSB7XG4gICAgICBjb25zdCBzY29wZSA9IGVuc3VyZUNvbmZpZ1Njb3BlKG9wdGlvbnMuc2NvcGUpXG4gICAgICBsb2dFdmVudCgndGVuZ3VfbWNwX2RlbGV0ZScsIHtcbiAgICAgICAgbmFtZTogbmFtZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICBzY29wZTpcbiAgICAgICAgICBzY29wZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSlcblxuICAgICAgYXdhaXQgcmVtb3ZlTWNwQ29uZmlnKG5hbWUsIHNjb3BlKVxuICAgICAgY2xlYW51cFNlY3VyZVN0b3JhZ2UoKVxuICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoYFJlbW92ZWQgTUNQIHNlcnZlciAke25hbWV9IGZyb20gJHtzY29wZX0gY29uZmlnXFxuYClcbiAgICAgIGNsaU9rKGBGaWxlIG1vZGlmaWVkOiAke2Rlc2NyaWJlTWNwQ29uZmlnRmlsZVBhdGgoc2NvcGUpfWApXG4gICAgfVxuXG4gICAgLy8gSWYgbm8gc2NvcGUgc3BlY2lmaWVkLCBjaGVjayB3aGVyZSB0aGUgc2VydmVyIGV4aXN0c1xuICAgIGNvbnN0IHByb2plY3RDb25maWcgPSBnZXRDdXJyZW50UHJvamVjdENvbmZpZygpXG4gICAgY29uc3QgZ2xvYmFsQ29uZmlnID0gZ2V0R2xvYmFsQ29uZmlnKClcblxuICAgIC8vIENoZWNrIGlmIHNlcnZlciBleGlzdHMgaW4gcHJvamVjdCBzY29wZSAoLm1jcC5qc29uKVxuICAgIGNvbnN0IHsgc2VydmVyczogcHJvamVjdFNlcnZlcnMgfSA9IGdldE1jcENvbmZpZ3NCeVNjb3BlKCdwcm9qZWN0JylcbiAgICBjb25zdCBtY3BKc29uRXhpc3RzID0gISFwcm9qZWN0U2VydmVyc1tuYW1lXVxuXG4gICAgLy8gQ291bnQgaG93IG1hbnkgc2NvcGVzIGNvbnRhaW4gdGhpcyBzZXJ2ZXJcbiAgICBjb25zdCBzY29wZXM6IEFycmF5PEV4Y2x1ZGU8Q29uZmlnU2NvcGUsICdkeW5hbWljJz4+ID0gW11cbiAgICBpZiAocHJvamVjdENvbmZpZy5tY3BTZXJ2ZXJzPy5bbmFtZV0pIHNjb3Blcy5wdXNoKCdsb2NhbCcpXG4gICAgaWYgKG1jcEpzb25FeGlzdHMpIHNjb3Blcy5wdXNoKCdwcm9qZWN0JylcbiAgICBpZiAoZ2xvYmFsQ29uZmlnLm1jcFNlcnZlcnM/LltuYW1lXSkgc2NvcGVzLnB1c2goJ3VzZXInKVxuXG4gICAgaWYgKHNjb3Blcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNsaUVycm9yKGBObyBNQ1Agc2VydmVyIGZvdW5kIHdpdGggbmFtZTogXCIke25hbWV9XCJgKVxuICAgIH0gZWxzZSBpZiAoc2NvcGVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gU2VydmVyIGV4aXN0cyBpbiBvbmx5IG9uZSBzY29wZSwgcmVtb3ZlIGl0XG4gICAgICBjb25zdCBzY29wZSA9IHNjb3Blc1swXSFcbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9tY3BfZGVsZXRlJywge1xuICAgICAgICBuYW1lOiBuYW1lIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIHNjb3BlOlxuICAgICAgICAgIHNjb3BlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KVxuXG4gICAgICBhd2FpdCByZW1vdmVNY3BDb25maWcobmFtZSwgc2NvcGUpXG4gICAgICBjbGVhbnVwU2VjdXJlU3RvcmFnZSgpXG4gICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShcbiAgICAgICAgYFJlbW92ZWQgTUNQIHNlcnZlciBcIiR7bmFtZX1cIiBmcm9tICR7c2NvcGV9IGNvbmZpZ1xcbmAsXG4gICAgICApXG4gICAgICBjbGlPayhgRmlsZSBtb2RpZmllZDogJHtkZXNjcmliZU1jcENvbmZpZ0ZpbGVQYXRoKHNjb3BlKX1gKVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTZXJ2ZXIgZXhpc3RzIGluIG11bHRpcGxlIHNjb3Blc1xuICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoYE1DUCBzZXJ2ZXIgXCIke25hbWV9XCIgZXhpc3RzIGluIG11bHRpcGxlIHNjb3BlczpcXG5gKVxuICAgICAgc2NvcGVzLmZvckVhY2goc2NvcGUgPT4ge1xuICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShcbiAgICAgICAgICBgICAtICR7Z2V0U2NvcGVMYWJlbChzY29wZSl9ICgke2Rlc2NyaWJlTWNwQ29uZmlnRmlsZVBhdGgoc2NvcGUpfSlcXG5gLFxuICAgICAgICApXG4gICAgICB9KVxuICAgICAgcHJvY2Vzcy5zdGRlcnIud3JpdGUoJ1xcblRvIHJlbW92ZSBmcm9tIGEgc3BlY2lmaWMgc2NvcGUsIHVzZTpcXG4nKVxuICAgICAgc2NvcGVzLmZvckVhY2goc2NvcGUgPT4ge1xuICAgICAgICBwcm9jZXNzLnN0ZGVyci53cml0ZShgICBjbGF1ZGUgbWNwIHJlbW92ZSBcIiR7bmFtZX1cIiAtcyAke3Njb3BlfVxcbmApXG4gICAgICB9KVxuICAgICAgY2xpRXJyb3IoKVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjbGlFcnJvcigoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UpXG4gIH1cbn1cblxuLy8gbWNwIGxpc3QgKGxpbmVzIDQ2NDHigJM0Njg4KVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1jcExpc3RIYW5kbGVyKCk6IFByb21pc2U8dm9pZD4ge1xuICBsb2dFdmVudCgndGVuZ3VfbWNwX2xpc3QnLCB7fSlcbiAgY29uc3QgeyBzZXJ2ZXJzOiBjb25maWdzIH0gPSBhd2FpdCBnZXRBbGxNY3BDb25maWdzKClcbiAgaWYgKE9iamVjdC5rZXlzKGNvbmZpZ3MpLmxlbmd0aCA9PT0gMCkge1xuICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Db25zb2xlOjogaW50ZW50aW9uYWwgY29uc29sZSBvdXRwdXRcbiAgICBjb25zb2xlLmxvZyhcbiAgICAgICdObyBNQ1Agc2VydmVycyBjb25maWd1cmVkLiBVc2UgYGNsYXVkZSBtY3AgYWRkYCB0byBhZGQgYSBzZXJ2ZXIuJyxcbiAgICApXG4gIH0gZWxzZSB7XG4gICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgIGNvbnNvbGUubG9nKCdDaGVja2luZyBNQ1Agc2VydmVyIGhlYWx0aC4uLlxcbicpXG5cbiAgICAvLyBDaGVjayBzZXJ2ZXJzIGNvbmN1cnJlbnRseVxuICAgIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyhjb25maWdzKVxuICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBwTWFwKFxuICAgICAgZW50cmllcyxcbiAgICAgIGFzeW5jIChbbmFtZSwgc2VydmVyXSkgPT4gKHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgc2VydmVyLFxuICAgICAgICBzdGF0dXM6IGF3YWl0IGNoZWNrTWNwU2VydmVySGVhbHRoKG5hbWUsIHNlcnZlciksXG4gICAgICB9KSxcbiAgICAgIHsgY29uY3VycmVuY3k6IGdldE1jcFNlcnZlckNvbm5lY3Rpb25CYXRjaFNpemUoKSB9LFxuICAgIClcblxuICAgIGZvciAoY29uc3QgeyBuYW1lLCBzZXJ2ZXIsIHN0YXR1cyB9IG9mIHJlc3VsdHMpIHtcbiAgICAgIC8vIEludGVudGlvbmFsbHkgZXhjbHVkaW5nIHNzZS1pZGUgc2VydmVycyBoZXJlIHNpbmNlIHRoZXkncmUgaW50ZXJuYWxcbiAgICAgIGlmIChzZXJ2ZXIudHlwZSA9PT0gJ3NzZScpIHtcbiAgICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgICBjb25zb2xlLmxvZyhgJHtuYW1lfTogJHtzZXJ2ZXIudXJsfSAoU1NFKSAtICR7c3RhdHVzfWApXG4gICAgICB9IGVsc2UgaWYgKHNlcnZlci50eXBlID09PSAnaHR0cCcpIHtcbiAgICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgICBjb25zb2xlLmxvZyhgJHtuYW1lfTogJHtzZXJ2ZXIudXJsfSAoSFRUUCkgLSAke3N0YXR1c31gKVxuICAgICAgfSBlbHNlIGlmIChzZXJ2ZXIudHlwZSA9PT0gJ2NsYXVkZWFpLXByb3h5Jykge1xuICAgICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgICAgIGNvbnNvbGUubG9nKGAke25hbWV9OiAke3NlcnZlci51cmx9IC0gJHtzdGF0dXN9YClcbiAgICAgIH0gZWxzZSBpZiAoIXNlcnZlci50eXBlIHx8IHNlcnZlci50eXBlID09PSAnc3RkaW8nKSB7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSBBcnJheS5pc0FycmF5KHNlcnZlci5hcmdzKSA/IHNlcnZlci5hcmdzIDogW11cbiAgICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgICBjb25zb2xlLmxvZyhgJHtuYW1lfTogJHtzZXJ2ZXIuY29tbWFuZH0gJHthcmdzLmpvaW4oJyAnKX0gLSAke3N0YXR1c31gKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICAvLyBVc2UgZ3JhY2VmdWxTaHV0ZG93biB0byBwcm9wZXJseSBjbGVhbiB1cCBNQ1Agc2VydmVyIGNvbm5lY3Rpb25zXG4gIC8vIChwcm9jZXNzLmV4aXQgYnlwYXNzZXMgY2xlYW51cCBoYW5kbGVycywgbGVhdmluZyBjaGlsZCBwcm9jZXNzZXMgb3JwaGFuZWQpXG4gIGF3YWl0IGdyYWNlZnVsU2h1dGRvd24oMClcbn1cblxuLy8gbWNwIGdldCAobGluZXMgNDY5NOKAkzQ3ODYpXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWNwR2V0SGFuZGxlcihuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgbG9nRXZlbnQoJ3Rlbmd1X21jcF9nZXQnLCB7XG4gICAgbmFtZTogbmFtZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICB9KVxuICBjb25zdCBzZXJ2ZXIgPSBnZXRNY3BDb25maWdCeU5hbWUobmFtZSlcbiAgaWYgKCFzZXJ2ZXIpIHtcbiAgICBjbGlFcnJvcihgTm8gTUNQIHNlcnZlciBmb3VuZCB3aXRoIG5hbWU6ICR7bmFtZX1gKVxuICB9XG5cbiAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICBjb25zb2xlLmxvZyhgJHtuYW1lfTpgKVxuICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gIGNvbnNvbGUubG9nKGAgIFNjb3BlOiAke2dldFNjb3BlTGFiZWwoc2VydmVyLnNjb3BlKX1gKVxuXG4gIC8vIENoZWNrIHNlcnZlciBoZWFsdGhcbiAgY29uc3Qgc3RhdHVzID0gYXdhaXQgY2hlY2tNY3BTZXJ2ZXJIZWFsdGgobmFtZSwgc2VydmVyKVxuICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gIGNvbnNvbGUubG9nKGAgIFN0YXR1czogJHtzdGF0dXN9YClcblxuICAvLyBJbnRlbnRpb25hbGx5IGV4Y2x1ZGluZyBzc2UtaWRlIHNlcnZlcnMgaGVyZSBzaW5jZSB0aGV5J3JlIGludGVybmFsXG4gIGlmIChzZXJ2ZXIudHlwZSA9PT0gJ3NzZScpIHtcbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgY29uc29sZS5sb2coYCAgVHlwZTogc3NlYClcbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgY29uc29sZS5sb2coYCAgVVJMOiAke3NlcnZlci51cmx9YClcbiAgICBpZiAoc2VydmVyLmhlYWRlcnMpIHtcbiAgICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Db25zb2xlOjogaW50ZW50aW9uYWwgY29uc29sZSBvdXRwdXRcbiAgICAgIGNvbnNvbGUubG9nKCcgIEhlYWRlcnM6JylcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHNlcnZlci5oZWFkZXJzKSkge1xuICAgICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgICAgIGNvbnNvbGUubG9nKGAgICAgJHtrZXl9OiAke3ZhbHVlfWApXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChzZXJ2ZXIub2F1dGg/LmNsaWVudElkIHx8IHNlcnZlci5vYXV0aD8uY2FsbGJhY2tQb3J0KSB7XG4gICAgICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXVxuICAgICAgaWYgKHNlcnZlci5vYXV0aC5jbGllbnRJZCkge1xuICAgICAgICBwYXJ0cy5wdXNoKCdjbGllbnRfaWQgY29uZmlndXJlZCcpXG4gICAgICAgIGNvbnN0IGNsaWVudENvbmZpZyA9IGdldE1jcENsaWVudENvbmZpZyhuYW1lLCBzZXJ2ZXIpXG4gICAgICAgIGlmIChjbGllbnRDb25maWc/LmNsaWVudFNlY3JldCkgcGFydHMucHVzaCgnY2xpZW50X3NlY3JldCBjb25maWd1cmVkJylcbiAgICAgIH1cbiAgICAgIGlmIChzZXJ2ZXIub2F1dGguY2FsbGJhY2tQb3J0KVxuICAgICAgICBwYXJ0cy5wdXNoKGBjYWxsYmFja19wb3J0ICR7c2VydmVyLm9hdXRoLmNhbGxiYWNrUG9ydH1gKVxuICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgY29uc29sZS5sb2coYCAgT0F1dGg6ICR7cGFydHMuam9pbignLCAnKX1gKVxuICAgIH1cbiAgfSBlbHNlIGlmIChzZXJ2ZXIudHlwZSA9PT0gJ2h0dHAnKSB7XG4gICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgIGNvbnNvbGUubG9nKGAgIFR5cGU6IGh0dHBgKVxuICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Db25zb2xlOjogaW50ZW50aW9uYWwgY29uc29sZSBvdXRwdXRcbiAgICBjb25zb2xlLmxvZyhgICBVUkw6ICR7c2VydmVyLnVybH1gKVxuICAgIGlmIChzZXJ2ZXIuaGVhZGVycykge1xuICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgY29uc29sZS5sb2coJyAgSGVhZGVyczonKVxuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoc2VydmVyLmhlYWRlcnMpKSB7XG4gICAgICAgIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Db25zb2xlOjogaW50ZW50aW9uYWwgY29uc29sZSBvdXRwdXRcbiAgICAgICAgY29uc29sZS5sb2coYCAgICAke2tleX06ICR7dmFsdWV9YClcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHNlcnZlci5vYXV0aD8uY2xpZW50SWQgfHwgc2VydmVyLm9hdXRoPy5jYWxsYmFja1BvcnQpIHtcbiAgICAgIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtdXG4gICAgICBpZiAoc2VydmVyLm9hdXRoLmNsaWVudElkKSB7XG4gICAgICAgIHBhcnRzLnB1c2goJ2NsaWVudF9pZCBjb25maWd1cmVkJylcbiAgICAgICAgY29uc3QgY2xpZW50Q29uZmlnID0gZ2V0TWNwQ2xpZW50Q29uZmlnKG5hbWUsIHNlcnZlcilcbiAgICAgICAgaWYgKGNsaWVudENvbmZpZz8uY2xpZW50U2VjcmV0KSBwYXJ0cy5wdXNoKCdjbGllbnRfc2VjcmV0IGNvbmZpZ3VyZWQnKVxuICAgICAgfVxuICAgICAgaWYgKHNlcnZlci5vYXV0aC5jYWxsYmFja1BvcnQpXG4gICAgICAgIHBhcnRzLnB1c2goYGNhbGxiYWNrX3BvcnQgJHtzZXJ2ZXIub2F1dGguY2FsbGJhY2tQb3J0fWApXG4gICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgICBjb25zb2xlLmxvZyhgICBPQXV0aDogJHtwYXJ0cy5qb2luKCcsICcpfWApXG4gICAgfVxuICB9IGVsc2UgaWYgKHNlcnZlci50eXBlID09PSAnc3RkaW8nKSB7XG4gICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgIGNvbnNvbGUubG9nKGAgIFR5cGU6IHN0ZGlvYClcbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgY29uc29sZS5sb2coYCAgQ29tbWFuZDogJHtzZXJ2ZXIuY29tbWFuZH1gKVxuICAgIGNvbnN0IGFyZ3MgPSBBcnJheS5pc0FycmF5KHNlcnZlci5hcmdzKSA/IHNlcnZlci5hcmdzIDogW11cbiAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgY29uc29sZS5sb2coYCAgQXJnczogJHthcmdzLmpvaW4oJyAnKX1gKVxuICAgIGlmIChzZXJ2ZXIuZW52KSB7XG4gICAgICAvLyBiaW9tZS1pZ25vcmUgbGludC9zdXNwaWNpb3VzL25vQ29uc29sZTo6IGludGVudGlvbmFsIGNvbnNvbGUgb3V0cHV0XG4gICAgICBjb25zb2xlLmxvZygnICBFbnZpcm9ubWVudDonKVxuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoc2VydmVyLmVudikpIHtcbiAgICAgICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvc3VzcGljaW91cy9ub0NvbnNvbGU6OiBpbnRlbnRpb25hbCBjb25zb2xlIG91dHB1dFxuICAgICAgICBjb25zb2xlLmxvZyhgICAgICR7a2V5fT0ke3ZhbHVlfWApXG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8vIGJpb21lLWlnbm9yZSBsaW50L3N1c3BpY2lvdXMvbm9Db25zb2xlOjogaW50ZW50aW9uYWwgY29uc29sZSBvdXRwdXRcbiAgY29uc29sZS5sb2coXG4gICAgYFxcblRvIHJlbW92ZSB0aGlzIHNlcnZlciwgcnVuOiBjbGF1ZGUgbWNwIHJlbW92ZSBcIiR7bmFtZX1cIiAtcyAke3NlcnZlci5zY29wZX1gLFxuICApXG4gIC8vIFVzZSBncmFjZWZ1bFNodXRkb3duIHRvIHByb3Blcmx5IGNsZWFuIHVwIE1DUCBzZXJ2ZXIgY29ubmVjdGlvbnNcbiAgLy8gKHByb2Nlc3MuZXhpdCBieXBhc3NlcyBjbGVhbnVwIGhhbmRsZXJzLCBsZWF2aW5nIGNoaWxkIHByb2Nlc3NlcyBvcnBoYW5lZClcbiAgYXdhaXQgZ3JhY2VmdWxTaHV0ZG93bigwKVxufVxuXG4vLyBtY3AgYWRkLWpzb24gKGxpbmVzIDQ4MDHigJM0ODcwKVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1jcEFkZEpzb25IYW5kbGVyKFxuICBuYW1lOiBzdHJpbmcsXG4gIGpzb246IHN0cmluZyxcbiAgb3B0aW9uczogeyBzY29wZT86IHN0cmluZzsgY2xpZW50U2VjcmV0PzogdHJ1ZSB9LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc2NvcGUgPSBlbnN1cmVDb25maWdTY29wZShvcHRpb25zLnNjb3BlKVxuICAgIGNvbnN0IHBhcnNlZEpzb24gPSBzYWZlUGFyc2VKU09OKGpzb24pXG5cbiAgICAvLyBSZWFkIHNlY3JldCBiZWZvcmUgd3JpdGluZyBjb25maWcgc28gY2FuY2VsbGF0aW9uIGRvZXNuJ3QgbGVhdmUgcGFydGlhbCBzdGF0ZVxuICAgIGNvbnN0IG5lZWRzU2VjcmV0ID1cbiAgICAgIG9wdGlvbnMuY2xpZW50U2VjcmV0ICYmXG4gICAgICBwYXJzZWRKc29uICYmXG4gICAgICB0eXBlb2YgcGFyc2VkSnNvbiA9PT0gJ29iamVjdCcgJiZcbiAgICAgICd0eXBlJyBpbiBwYXJzZWRKc29uICYmXG4gICAgICAocGFyc2VkSnNvbi50eXBlID09PSAnc3NlJyB8fCBwYXJzZWRKc29uLnR5cGUgPT09ICdodHRwJykgJiZcbiAgICAgICd1cmwnIGluIHBhcnNlZEpzb24gJiZcbiAgICAgIHR5cGVvZiBwYXJzZWRKc29uLnVybCA9PT0gJ3N0cmluZycgJiZcbiAgICAgICdvYXV0aCcgaW4gcGFyc2VkSnNvbiAmJlxuICAgICAgcGFyc2VkSnNvbi5vYXV0aCAmJlxuICAgICAgdHlwZW9mIHBhcnNlZEpzb24ub2F1dGggPT09ICdvYmplY3QnICYmXG4gICAgICAnY2xpZW50SWQnIGluIHBhcnNlZEpzb24ub2F1dGhcbiAgICBjb25zdCBjbGllbnRTZWNyZXQgPSBuZWVkc1NlY3JldCA/IGF3YWl0IHJlYWRDbGllbnRTZWNyZXQoKSA6IHVuZGVmaW5lZFxuXG4gICAgYXdhaXQgYWRkTWNwQ29uZmlnKG5hbWUsIHBhcnNlZEpzb24sIHNjb3BlKVxuXG4gICAgY29uc3QgdHJhbnNwb3J0VHlwZSA9XG4gICAgICBwYXJzZWRKc29uICYmIHR5cGVvZiBwYXJzZWRKc29uID09PSAnb2JqZWN0JyAmJiAndHlwZScgaW4gcGFyc2VkSnNvblxuICAgICAgICA/IFN0cmluZyhwYXJzZWRKc29uLnR5cGUgfHwgJ3N0ZGlvJylcbiAgICAgICAgOiAnc3RkaW8nXG5cbiAgICBpZiAoXG4gICAgICBjbGllbnRTZWNyZXQgJiZcbiAgICAgIHBhcnNlZEpzb24gJiZcbiAgICAgIHR5cGVvZiBwYXJzZWRKc29uID09PSAnb2JqZWN0JyAmJlxuICAgICAgJ3R5cGUnIGluIHBhcnNlZEpzb24gJiZcbiAgICAgIChwYXJzZWRKc29uLnR5cGUgPT09ICdzc2UnIHx8IHBhcnNlZEpzb24udHlwZSA9PT0gJ2h0dHAnKSAmJlxuICAgICAgJ3VybCcgaW4gcGFyc2VkSnNvbiAmJlxuICAgICAgdHlwZW9mIHBhcnNlZEpzb24udXJsID09PSAnc3RyaW5nJ1xuICAgICkge1xuICAgICAgc2F2ZU1jcENsaWVudFNlY3JldChcbiAgICAgICAgbmFtZSxcbiAgICAgICAgeyB0eXBlOiBwYXJzZWRKc29uLnR5cGUsIHVybDogcGFyc2VkSnNvbi51cmwgfSxcbiAgICAgICAgY2xpZW50U2VjcmV0LFxuICAgICAgKVxuICAgIH1cblxuICAgIGxvZ0V2ZW50KCd0ZW5ndV9tY3BfYWRkJywge1xuICAgICAgc2NvcGU6XG4gICAgICAgIHNjb3BlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICBzb3VyY2U6XG4gICAgICAgICdqc29uJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgdHlwZTogdHJhbnNwb3J0VHlwZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG5cbiAgICBjbGlPayhgQWRkZWQgJHt0cmFuc3BvcnRUeXBlfSBNQ1Agc2VydmVyICR7bmFtZX0gdG8gJHtzY29wZX0gY29uZmlnYClcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjbGlFcnJvcigoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UpXG4gIH1cbn1cblxuLy8gbWNwIGFkZC1mcm9tLWNsYXVkZS1kZXNrdG9wIChsaW5lcyA0ODgx4oCTNDkyNylcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtY3BBZGRGcm9tRGVza3RvcEhhbmRsZXIob3B0aW9uczoge1xuICBzY29wZT86IHN0cmluZ1xufSk6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHNjb3BlID0gZW5zdXJlQ29uZmlnU2NvcGUob3B0aW9ucy5zY29wZSlcbiAgICBjb25zdCBwbGF0Zm9ybSA9IGdldFBsYXRmb3JtKClcblxuICAgIGxvZ0V2ZW50KCd0ZW5ndV9tY3BfYWRkJywge1xuICAgICAgc2NvcGU6XG4gICAgICAgIHNjb3BlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICBwbGF0Zm9ybTpcbiAgICAgICAgcGxhdGZvcm0gYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIHNvdXJjZTpcbiAgICAgICAgJ2Rlc2t0b3AnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgfSlcblxuICAgIGNvbnN0IHsgcmVhZENsYXVkZURlc2t0b3BNY3BTZXJ2ZXJzIH0gPSBhd2FpdCBpbXBvcnQoXG4gICAgICAnLi4vLi4vdXRpbHMvY2xhdWRlRGVza3RvcC5qcydcbiAgICApXG4gICAgY29uc3Qgc2VydmVycyA9IGF3YWl0IHJlYWRDbGF1ZGVEZXNrdG9wTWNwU2VydmVycygpXG5cbiAgICBpZiAoT2JqZWN0LmtleXMoc2VydmVycykubGVuZ3RoID09PSAwKSB7XG4gICAgICBjbGlPayhcbiAgICAgICAgJ05vIE1DUCBzZXJ2ZXJzIGZvdW5kIGluIENsYXVkZSBEZXNrdG9wIGNvbmZpZ3VyYXRpb24gb3IgY29uZmlndXJhdGlvbiBmaWxlIGRvZXMgbm90IGV4aXN0LicsXG4gICAgICApXG4gICAgfVxuXG4gICAgY29uc3QgeyB1bm1vdW50IH0gPSBhd2FpdCByZW5kZXIoXG4gICAgICA8QXBwU3RhdGVQcm92aWRlcj5cbiAgICAgICAgPEtleWJpbmRpbmdTZXR1cD5cbiAgICAgICAgICA8TUNQU2VydmVyRGVza3RvcEltcG9ydERpYWxvZ1xuICAgICAgICAgICAgc2VydmVycz17c2VydmVyc31cbiAgICAgICAgICAgIHNjb3BlPXtzY29wZX1cbiAgICAgICAgICAgIG9uRG9uZT17KCkgPT4ge1xuICAgICAgICAgICAgICB1bm1vdW50KClcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9LZXliaW5kaW5nU2V0dXA+XG4gICAgICA8L0FwcFN0YXRlUHJvdmlkZXI+LFxuICAgICAgeyBleGl0T25DdHJsQzogdHJ1ZSB9LFxuICAgIClcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjbGlFcnJvcigoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UpXG4gIH1cbn1cblxuLy8gbWNwIHJlc2V0LXByb2plY3QtY2hvaWNlcyAobGluZXMgNDkzNeKAkzQ5NTIpXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWNwUmVzZXRDaG9pY2VzSGFuZGxlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgbG9nRXZlbnQoJ3Rlbmd1X21jcF9yZXNldF9tY3Bqc29uX2Nob2ljZXMnLCB7fSlcbiAgc2F2ZUN1cnJlbnRQcm9qZWN0Q29uZmlnKGN1cnJlbnQgPT4gKHtcbiAgICAuLi5jdXJyZW50LFxuICAgIGVuYWJsZWRNY3Bqc29uU2VydmVyczogW10sXG4gICAgZGlzYWJsZWRNY3Bqc29uU2VydmVyczogW10sXG4gICAgZW5hYmxlQWxsUHJvamVjdE1jcFNlcnZlcnM6IGZhbHNlLFxuICB9KSlcbiAgY2xpT2soXG4gICAgJ0FsbCBwcm9qZWN0LXNjb3BlZCAoLm1jcC5qc29uKSBzZXJ2ZXIgYXBwcm92YWxzIGFuZCByZWplY3Rpb25zIGhhdmUgYmVlbiByZXNldC5cXG4nICtcbiAgICAgICdZb3Ugd2lsbCBiZSBwcm9tcHRlZCBmb3IgYXBwcm92YWwgbmV4dCB0aW1lIHlvdSBzdGFydCBDbGF1ZGUgQ29kZS4nLFxuICApXG59XG4iXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLFNBQVNBLElBQUksUUFBUSxhQUFhO0FBQ2xDLE9BQU9DLElBQUksTUFBTSxPQUFPO0FBQ3hCLFNBQVNDLEdBQUcsUUFBUSxTQUFTO0FBQzdCLE9BQU9DLEtBQUssTUFBTSxPQUFPO0FBQ3pCLFNBQVNDLDRCQUE0QixRQUFRLGtEQUFrRDtBQUMvRixTQUFTQyxNQUFNLFFBQVEsY0FBYztBQUNyQyxTQUFTQyxlQUFlLFFBQVEsOENBQThDO0FBQzlFLFNBQ0UsS0FBS0MsMERBQTBELEVBQy9EQyxRQUFRLFFBQ0gsbUNBQW1DO0FBQzFDLFNBQ0VDLG9CQUFvQixFQUNwQkMsaUNBQWlDLEVBQ2pDQyxrQkFBa0IsRUFDbEJDLGdCQUFnQixFQUNoQkMsbUJBQW1CLFFBQ2QsNEJBQTRCO0FBQ25DLFNBQ0VDLGVBQWUsRUFDZkMsK0JBQStCLFFBQzFCLDhCQUE4QjtBQUNyQyxTQUNFQyxZQUFZLEVBQ1pDLGdCQUFnQixFQUNoQkMsa0JBQWtCLEVBQ2xCQyxvQkFBb0IsRUFDcEJDLGVBQWUsUUFDViw4QkFBOEI7QUFDckMsY0FDRUMsV0FBVyxFQUNYQyxxQkFBcUIsUUFDaEIsNkJBQTZCO0FBQ3BDLFNBQ0VDLHlCQUF5QixFQUN6QkMsaUJBQWlCLEVBQ2pCQyxhQUFhLFFBQ1IsNkJBQTZCO0FBQ3BDLFNBQVNDLGdCQUFnQixRQUFRLHlCQUF5QjtBQUMxRCxTQUNFQyx1QkFBdUIsRUFDdkJDLGVBQWUsRUFDZkMsd0JBQXdCLFFBQ25CLHVCQUF1QjtBQUM5QixTQUFTQyxnQkFBZ0IsUUFBUSx1QkFBdUI7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