import figures from 'figures';
import React, { useEffect, useRef, useState } from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import type { CommandResultDisplay } from '../../commands.js';
import { getOauthConfig } from '../../constants/oauth.js';
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { setClipboard } from '../../ink/termio/osc.js';
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- raw j/k/arrow menu navigation
import { Box, color, Link, Text, useInput, useTheme } from '../../ink.js';
import { useKeybinding } from '../../keybindings/useKeybinding.js';
import { AuthenticationCancelledError, performMCPOAuthFlow, revokeServerTokens } from '../../services/mcp/auth.js';
import { clearServerCache } from '../../services/mcp/client.js';
import { useMcpReconnect, useMcpToggleEnabled } from '../../services/mcp/MCPConnectionManager.js';
import { describeMcpConfigFilePath, excludeCommandsByServer, excludeResourcesByServer, excludeToolsByServer, filterMcpPromptsByServer } from '../../services/mcp/utils.js';
import { useAppState, useSetAppState } from '../../state/AppState.js';
import { getOauthAccountInfo } from '../../utils/auth.js';
import { openBrowser } from '../../utils/browser.js';
import { errorMessage } from '../../utils/errors.js';
import { logMCPDebug } from '../../utils/log.js';
import { capitalize } from '../../utils/stringUtils.js';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint.js';
import { Select } from '../CustomSelect/index.js';
import { Byline } from '../design-system/Byline.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import { Spinner } from '../Spinner.js';
import TextInput from '../TextInput.js';
import { CapabilitiesSection } from './CapabilitiesSection.js';
import type { ClaudeAIServerInfo, HTTPServerInfo, SSEServerInfo } from './types.js';
import { handleReconnectError, handleReconnectResult } from './utils/reconnectHelpers.js';
type Props = {
  server: SSEServerInfo | HTTPServerInfo | ClaudeAIServerInfo;
  serverToolsCount: number;
  onViewTools: () => void;
  onCancel: () => void;
  onComplete?: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
  borderless?: boolean;
};
export function MCPRemoteServerMenu({
  server,
  serverToolsCount,
  onViewTools,
  onCancel,
  onComplete,
  borderless = false
}: Props): React.ReactNode {
  const [theme] = useTheme();
  const exitState = useExitOnCtrlCDWithKeybindings();
  const {
    columns: terminalColumns
  } = useTerminalSize();
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const mcp = useAppState(s => s.mcp);
  const setAppState = useSetAppState();
  const [authorizationUrl, setAuthorizationUrl] = React.useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const authAbortControllerRef = useRef<AbortController | null>(null);
  const [isClaudeAIAuthenticating, setIsClaudeAIAuthenticating] = useState(false);
  const [claudeAIAuthUrl, setClaudeAIAuthUrl] = useState<string | null>(null);
  const [isClaudeAIClearingAuth, setIsClaudeAIClearingAuth] = useState(false);
  const [claudeAIClearAuthUrl, setClaudeAIClearAuthUrl] = useState<string | null>(null);
  const [claudeAIClearAuthBrowserOpened, setClaudeAIClearAuthBrowserOpened] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const unmountedRef = useRef(false);
  const [callbackUrlInput, setCallbackUrlInput] = useState('');
  const [callbackUrlCursorOffset, setCallbackUrlCursorOffset] = useState(0);
  const [manualCallbackSubmit, setManualCallbackSubmit] = useState<((url: string) => void) | null>(null);

  // If the component unmounts mid-auth (e.g. a parent component's Esc handler
  // navigates away before ours fires), abort the OAuth flow so the callback
  // server is closed. Without this, the server stays bound and the process
  // can outlive the terminal. Also clear the copy-feedback timer and mark
  // unmounted so the async setClipboard callback doesn't setUrlCopied /
  // schedule a new timer after unmount.
  useEffect(() => () => {
    unmountedRef.current = true;
    authAbortControllerRef.current?.abort();
    if (copyTimeoutRef.current !== undefined) {
      clearTimeout(copyTimeoutRef.current);
    }
  }, []);

  // A server is effectively authenticated if:
  // 1. It has OAuth tokens (server.isAuthenticated), OR
  // 2. It's connected and has tools (meaning it's working via some auth mechanism)
  const isEffectivelyAuthenticated = server.isAuthenticated || server.client.type === 'connected' && serverToolsCount > 0;
  const reconnectMcpServer = useMcpReconnect();
  const handleClaudeAIAuthComplete = React.useCallback(async () => {
    setIsClaudeAIAuthenticating(false);
    setClaudeAIAuthUrl(null);
    setIsReconnecting(true);
    try {
      const result = await reconnectMcpServer(server.name);
      const success = result.client.type === 'connected';
      logEvent('tengu_claudeai_mcp_auth_completed', {
        success
      });
      if (success) {
        onComplete?.(`Authentication successful. Connected to ${server.name}.`);
      } else if (result.client.type === 'needs-auth') {
        onComplete?.('Authentication successful, but server still requires authentication. You may need to manually restart Claude Code.');
      } else {
        onComplete?.('Authentication successful, but server reconnection failed. You may need to manually restart Claude Code for the changes to take effect.');
      }
    } catch (err) {
      logEvent('tengu_claudeai_mcp_auth_completed', {
        success: false
      });
      onComplete?.(handleReconnectError(err, server.name));
    } finally {
      setIsReconnecting(false);
    }
  }, [reconnectMcpServer, server.name, onComplete]);
  const handleClaudeAIClearAuthComplete = React.useCallback(async () => {
    await clearServerCache(server.name, {
      ...server.config,
      scope: server.scope
    });
    setAppState(prev => {
      const newClients = prev.mcp.clients.map(c => c.name === server.name ? {
        ...c,
        type: 'needs-auth' as const
      } : c);
      const newTools = excludeToolsByServer(prev.mcp.tools, server.name);
      const newCommands = excludeCommandsByServer(prev.mcp.commands, server.name);
      const newResources = excludeResourcesByServer(prev.mcp.resources, server.name);
      return {
        ...prev,
        mcp: {
          ...prev.mcp,
          clients: newClients,
          tools: newTools,
          commands: newCommands,
          resources: newResources
        }
      };
    });
    logEvent('tengu_claudeai_mcp_clear_auth_completed', {});
    onComplete?.(`Disconnected from ${server.name}.`);
    setIsClaudeAIClearingAuth(false);
    setClaudeAIClearAuthUrl(null);
    setClaudeAIClearAuthBrowserOpened(false);
  }, [server.name, server.config, server.scope, setAppState, onComplete]);

  // Escape to cancel authentication flow
  useKeybinding('confirm:no', () => {
    authAbortControllerRef.current?.abort();
    authAbortControllerRef.current = null;
    setIsAuthenticating(false);
    setAuthorizationUrl(null);
  }, {
    context: 'Confirmation',
    isActive: isAuthenticating
  });

  // Escape to cancel Claude AI authentication
  useKeybinding('confirm:no', () => {
    setIsClaudeAIAuthenticating(false);
    setClaudeAIAuthUrl(null);
  }, {
    context: 'Confirmation',
    isActive: isClaudeAIAuthenticating
  });

  // Escape to cancel Claude AI clear auth
  useKeybinding('confirm:no', () => {
    setIsClaudeAIClearingAuth(false);
    setClaudeAIClearAuthUrl(null);
    setClaudeAIClearAuthBrowserOpened(false);
  }, {
    context: 'Confirmation',
    isActive: isClaudeAIClearingAuth
  });

  // Return key handling for authentication flows and 'c' to copy URL
  useInput((input, key) => {
    if (key.return && isClaudeAIAuthenticating) {
      void handleClaudeAIAuthComplete();
    }
    if (key.return && isClaudeAIClearingAuth) {
      if (claudeAIClearAuthBrowserOpened) {
        void handleClaudeAIClearAuthComplete();
      } else {
        // First Enter: open the browser
        const connectorsUrl = `${getOauthConfig().CLAUDE_AI_ORIGIN}/settings/connectors`;
        setClaudeAIClearAuthUrl(connectorsUrl);
        setClaudeAIClearAuthBrowserOpened(true);
        void openBrowser(connectorsUrl);
      }
    }
    if (input === 'c' && !urlCopied) {
      const urlToCopy = authorizationUrl || claudeAIAuthUrl || claudeAIClearAuthUrl;
      if (urlToCopy) {
        void setClipboard(urlToCopy).then(raw => {
          if (unmountedRef.current) return;
          if (raw) process.stdout.write(raw);
          setUrlCopied(true);
          if (copyTimeoutRef.current !== undefined) {
            clearTimeout(copyTimeoutRef.current);
          }
          copyTimeoutRef.current = setTimeout(setUrlCopied, 2000, false);
        });
      }
    }
  });
  const capitalizedServerName = capitalize(String(server.name));

  // Count MCP prompts for this server (skills are shown in /skills, not here)
  const serverCommandsCount = filterMcpPromptsByServer(mcp.commands, server.name).length;
  const toggleMcpServer = useMcpToggleEnabled();
  const handleClaudeAIAuth = React.useCallback(async () => {
    const claudeAiBaseUrl = getOauthConfig().CLAUDE_AI_ORIGIN;
    const accountInfo = getOauthAccountInfo();
    const orgUuid = accountInfo?.organizationUuid;
    let authUrl: string;
    if (orgUuid && server.config.type === 'claudeai-proxy' && server.config.id) {
      // Use the direct auth URL with org and server IDs
      // Replace 'mcprs' prefix with 'mcpsrv' if present
      const serverId = server.config.id.startsWith('mcprs') ? 'mcpsrv' + server.config.id.slice(5) : server.config.id;
      const productSurface = encodeURIComponent(process.env.CLAUDE_CODE_ENTRYPOINT || 'cli');
      authUrl = `${claudeAiBaseUrl}/api/organizations/${orgUuid}/mcp/start-auth/${serverId}?product_surface=${productSurface}`;
    } else {
      // Fall back to settings/connectors if we don't have the required IDs
      authUrl = `${claudeAiBaseUrl}/settings/connectors`;
    }
    setClaudeAIAuthUrl(authUrl);
    setIsClaudeAIAuthenticating(true);
    logEvent('tengu_claudeai_mcp_auth_started', {});
    await openBrowser(authUrl);
  }, [server.config]);
  const handleClaudeAIClearAuth = React.useCallback(() => {
    setIsClaudeAIClearingAuth(true);
    logEvent('tengu_claudeai_mcp_clear_auth_started', {});
  }, []);
  const handleToggleEnabled = React.useCallback(async () => {
    const wasEnabled = server.client.type !== 'disabled';
    try {
      await toggleMcpServer(server.name);
      if (server.config.type === 'claudeai-proxy') {
        logEvent('tengu_claudeai_mcp_toggle', {
          new_state: (wasEnabled ? 'disabled' : 'enabled') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        });
      }

      // Return to the server list so user can continue managing other servers
      onCancel();
    } catch (err_0) {
      const action = wasEnabled ? 'disable' : 'enable';
      onComplete?.(`Failed to ${action} MCP server '${server.name}': ${errorMessage(err_0)}`);
    }
  }, [server.client.type, server.config.type, server.name, toggleMcpServer, onCancel, onComplete]);
  const handleAuthenticate = React.useCallback(async () => {
    if (server.config.type === 'claudeai-proxy') return;
    setIsAuthenticating(true);
    setError(null);
    const controller = new AbortController();
    authAbortControllerRef.current = controller;
    try {
      // Revoke existing tokens if re-authenticating, but preserve step-up
      // auth state so the next OAuth flow can reuse cached scope/discovery.
      if (server.isAuthenticated && server.config) {
        await revokeServerTokens(server.name, server.config, {
          preserveStepUpState: true
        });
      }
      if (server.config) {
        await performMCPOAuthFlow(server.name, server.config, setAuthorizationUrl, controller.signal, {
          onWaitingForCallback: submit => {
            setManualCallbackSubmit(() => submit);
          }
        });
        logEvent('tengu_mcp_auth_config_authenticate', {
          wasAuthenticated: server.isAuthenticated
        });
        const result_0 = await reconnectMcpServer(server.name);
        if (result_0.client.type === 'connected') {
          const message = isEffectivelyAuthenticated ? `Authentication successful. Reconnected to ${server.name}.` : `Authentication successful. Connected to ${server.name}.`;
          onComplete?.(message);
        } else if (result_0.client.type === 'needs-auth') {
          onComplete?.('Authentication successful, but server still requires authentication. You may need to manually restart Claude Code.');
        } else {
          // result.client.type === 'failed'
          logMCPDebug(server.name, `Reconnection failed after authentication`);
          onComplete?.('Authentication successful, but server reconnection failed. You may need to manually restart Claude Code for the changes to take effect.');
        }
      }
    } catch (err_1) {
      // Don't show error if it was a cancellation
      if (err_1 instanceof Error && !(err_1 instanceof AuthenticationCancelledError)) {
        setError(err_1.message);
      }
    } finally {
      setIsAuthenticating(false);
      authAbortControllerRef.current = null;
      setManualCallbackSubmit(null);
      setCallbackUrlInput('');
    }
  }, [server.isAuthenticated, server.config, server.name, onComplete, reconnectMcpServer, isEffectivelyAuthenticated]);
  const handleClearAuth = async () => {
    if (server.config.type === 'claudeai-proxy') return;
    if (server.config) {
      // First revoke the authentication tokens and clear all auth state
      await revokeServerTokens(server.name, server.config);
      logEvent('tengu_mcp_auth_config_clear', {});

      // Disconnect the client and clear the cache
      await clearServerCache(server.name, {
        ...server.config,
        scope: server.scope
      });

      // Update app state to remove the disconnected server's tools, commands, and resources
      setAppState(prev_0 => {
        const newClients_0 = prev_0.mcp.clients.map(c_0 =>
        // 'failed' is a misnomer here, but we don't really differentiate between "not connected" and "failed" at the moment
        c_0.name === server.name ? {
          ...c_0,
          type: 'failed' as const
        } : c_0);
        const newTools_0 = excludeToolsByServer(prev_0.mcp.tools, server.name);
        const newCommands_0 = excludeCommandsByServer(prev_0.mcp.commands, server.name);
        const newResources_0 = excludeResourcesByServer(prev_0.mcp.resources, server.name);
        return {
          ...prev_0,
          mcp: {
            ...prev_0.mcp,
            clients: newClients_0,
            tools: newTools_0,
            commands: newCommands_0,
            resources: newResources_0
          }
        };
      });
      onComplete?.(`Authentication cleared for ${server.name}.`);
    }
  };
  if (isAuthenticating) {
    // XAA: silent exchange (cached id_token → no browser), so don't claim
    // one will open. If IdP login IS needed, authorizationUrl populates and
    // the URL fallback block below still renders.
    const authCopy = server.config.type !== 'claudeai-proxy' && server.config.oauth?.xaa ? ' Authenticating via your identity provider' : ' A browser window will open for authentication';
    return <Box flexDirection="column" gap={1} padding={1}>
        <Text color="claude">Authenticating with {server.name}…</Text>
        <Box>
          <Spinner />
          <Text>{authCopy}</Text>
        </Box>
        {authorizationUrl && <Box flexDirection="column">
            <Box>
              <Text dimColor>
                If your browser doesn&apos;t open automatically, copy this URL
                manually{' '}
              </Text>
              {urlCopied ? <Text color="success">(Copied!)</Text> : <Text dimColor>
                  <KeyboardShortcutHint shortcut="c" action="copy" parens />
                </Text>}
            </Box>
            <Link url={authorizationUrl} />
          </Box>}
        {isAuthenticating && authorizationUrl && manualCallbackSubmit && <Box flexDirection="column" marginTop={1}>
            <Text dimColor>
              If the redirect page shows a connection error, paste the URL from
              your browser&apos;s address bar:
            </Text>
            <Box>
              <Text dimColor>URL {'>'} </Text>
              <TextInput value={callbackUrlInput} onChange={setCallbackUrlInput} onSubmit={(value: string) => {
            manualCallbackSubmit(value.trim());
            setCallbackUrlInput('');
          }} cursorOffset={callbackUrlCursorOffset} onChangeCursorOffset={setCallbackUrlCursorOffset} columns={terminalColumns - 8} />
            </Box>
          </Box>}
        <Box marginLeft={3}>
          <Text dimColor>
            Return here after authenticating in your browser. Press Esc to go
            back.
          </Text>
        </Box>
      </Box>;
  }
  if (isClaudeAIAuthenticating) {
    return <Box flexDirection="column" gap={1} padding={1}>
        <Text color="claude">Authenticating with {server.name}…</Text>
        <Box>
          <Spinner />
          <Text> A browser window will open for authentication</Text>
        </Box>
        {claudeAIAuthUrl && <Box flexDirection="column">
            <Box>
              <Text dimColor>
                If your browser doesn&apos;t open automatically, copy this URL
                manually{' '}
              </Text>
              {urlCopied ? <Text color="success">(Copied!)</Text> : <Text dimColor>
                  <KeyboardShortcutHint shortcut="c" action="copy" parens />
                </Text>}
            </Box>
            <Link url={claudeAIAuthUrl} />
          </Box>}
        <Box marginLeft={3} flexDirection="column">
          <Text color="permission">
            Press <Text bold>Enter</Text> after authenticating in your browser.
          </Text>
          <Text dimColor italic>
            <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
          </Text>
        </Box>
      </Box>;
  }
  if (isClaudeAIClearingAuth) {
    return <Box flexDirection="column" gap={1} padding={1}>
        <Text color="claude">Clear authentication for {server.name}</Text>
        {claudeAIClearAuthBrowserOpened ? <>
            <Text>
              Find the MCP server in the browser and click
              &quot;Disconnect&quot;.
            </Text>
            {claudeAIClearAuthUrl && <Box flexDirection="column">
                <Box>
                  <Text dimColor>
                    If your browser didn&apos;t open automatically, copy this
                    URL manually{' '}
                  </Text>
                  {urlCopied ? <Text color="success">(Copied!)</Text> : <Text dimColor>
                      <KeyboardShortcutHint shortcut="c" action="copy" parens />
                    </Text>}
                </Box>
                <Link url={claudeAIClearAuthUrl} />
              </Box>}
            <Box marginLeft={3} flexDirection="column">
              <Text color="permission">
                Press <Text bold>Enter</Text> when done.
              </Text>
              <Text dimColor italic>
                <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
              </Text>
            </Box>
          </> : <>
            <Text>
              This will open claude.ai in the browser. Find the MCP server in
              the list and click &quot;Disconnect&quot;.
            </Text>
            <Box marginLeft={3} flexDirection="column">
              <Text color="permission">
                Press <Text bold>Enter</Text> to open the browser.
              </Text>
              <Text dimColor italic>
                <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
              </Text>
            </Box>
          </>}
      </Box>;
  }
  if (isReconnecting) {
    return <Box flexDirection="column" gap={1} padding={1}>
        <Text color="text">
          Connecting to <Text bold>{server.name}</Text>…
        </Text>
        <Box>
          <Spinner />
          <Text> Establishing connection to MCP server</Text>
        </Box>
        <Text dimColor>This may take a few moments.</Text>
      </Box>;
  }
  const menuOptions = [];

  // If server is disabled, show Enable first as the primary action
  if (server.client.type === 'disabled') {
    menuOptions.push({
      label: 'Enable',
      value: 'toggle-enabled'
    });
  }
  if (server.client.type === 'connected' && serverToolsCount > 0) {
    menuOptions.push({
      label: 'View tools',
      value: 'tools'
    });
  }
  if (server.config.type === 'claudeai-proxy') {
    if (server.client.type === 'connected') {
      menuOptions.push({
        label: 'Clear authentication',
        value: 'claudeai-clear-auth'
      });
    } else if (server.client.type !== 'disabled') {
      menuOptions.push({
        label: 'Authenticate',
        value: 'claudeai-auth'
      });
    }
  } else {
    if (isEffectivelyAuthenticated) {
      menuOptions.push({
        label: 'Re-authenticate',
        value: 'reauth'
      });
      menuOptions.push({
        label: 'Clear authentication',
        value: 'clear-auth'
      });
    }
    if (!isEffectivelyAuthenticated) {
      menuOptions.push({
        label: 'Authenticate',
        value: 'auth'
      });
    }
  }
  if (server.client.type !== 'disabled') {
    if (server.client.type !== 'needs-auth') {
      menuOptions.push({
        label: 'Reconnect',
        value: 'reconnectMcpServer'
      });
    }
    menuOptions.push({
      label: 'Disable',
      value: 'toggle-enabled'
    });
  }

  // If there are no other options, add a back option so Select handles escape
  if (menuOptions.length === 0) {
    menuOptions.push({
      label: 'Back',
      value: 'back'
    });
  }
  return <Box flexDirection="column">
      <Box flexDirection="column" paddingX={1} borderStyle={borderless ? undefined : 'round'}>
        <Box marginBottom={1}>
          <Text bold>{capitalizedServerName} MCP Server</Text>
        </Box>

        <Box flexDirection="column" gap={0}>
          <Box>
            <Text bold>Status: </Text>
            {server.client.type === 'disabled' ? <Text>{color('inactive', theme)(figures.radioOff)} disabled</Text> : server.client.type === 'connected' ? <Text>{color('success', theme)(figures.tick)} connected</Text> : server.client.type === 'pending' ? <>
                <Text dimColor>{figures.radioOff}</Text>
                <Text> connecting…</Text>
              </> : server.client.type === 'needs-auth' ? <Text>
                {color('warning', theme)(figures.triangleUpOutline)} needs
                authentication
              </Text> : <Text>{color('error', theme)(figures.cross)} failed</Text>}
          </Box>

          {server.transport !== 'claudeai-proxy' && <Box>
              <Text bold>Auth: </Text>
              {isEffectivelyAuthenticated ? <Text>
                  {color('success', theme)(figures.tick)} authenticated
                </Text> : <Text>
                  {color('error', theme)(figures.cross)} not authenticated
                </Text>}
            </Box>}

          <Box>
            <Text bold>URL: </Text>
            <Text dimColor>{server.config.url}</Text>
          </Box>

          <Box>
            <Text bold>Config location: </Text>
            <Text dimColor>{describeMcpConfigFilePath(server.scope)}</Text>
          </Box>

          {server.client.type === 'connected' && <CapabilitiesSection serverToolsCount={serverToolsCount} serverPromptsCount={serverCommandsCount} serverResourcesCount={mcp.resources[server.name]?.length || 0} />}

          {server.client.type === 'connected' && serverToolsCount > 0 && <Box>
              <Text bold>Tools: </Text>
              <Text dimColor>{serverToolsCount} tools</Text>
            </Box>}
        </Box>

        {error && <Box marginTop={1}>
            <Text color="error">Error: {error}</Text>
          </Box>}

        {menuOptions.length > 0 && <Box marginTop={1}>
            <Select options={menuOptions} onChange={async value_0 => {
          switch (value_0) {
            case 'tools':
              onViewTools();
              break;
            case 'auth':
            case 'reauth':
              await handleAuthenticate();
              break;
            case 'clear-auth':
              await handleClearAuth();
              break;
            case 'claudeai-auth':
              await handleClaudeAIAuth();
              break;
            case 'claudeai-clear-auth':
              handleClaudeAIClearAuth();
              break;
            case 'reconnectMcpServer':
              setIsReconnecting(true);
              try {
                const result_1 = await reconnectMcpServer(server.name);
                if (server.config.type === 'claudeai-proxy') {
                  logEvent('tengu_claudeai_mcp_reconnect', {
                    success: result_1.client.type === 'connected'
                  });
                }
                const {
                  message: message_0
                } = handleReconnectResult(result_1, server.name);
                onComplete?.(message_0);
              } catch (err_2) {
                if (server.config.type === 'claudeai-proxy') {
                  logEvent('tengu_claudeai_mcp_reconnect', {
                    success: false
                  });
                }
                onComplete?.(handleReconnectError(err_2, server.name));
              } finally {
                setIsReconnecting(false);
              }
              break;
            case 'toggle-enabled':
              await handleToggleEnabled();
              break;
            case 'back':
              onCancel();
              break;
          }
        }} onCancel={onCancel} />
          </Box>}
      </Box>

      <Box marginTop={1}>
        <Text dimColor italic>
          {exitState.pending ? <>Press {exitState.keyName} again to exit</> : <Byline>
              <KeyboardShortcutHint shortcut="↑↓" action="navigate" />
              <KeyboardShortcutHint shortcut="Enter" action="select" />
              <ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="back" />
            </Byline>}
        </Text>
      </Box>
    </Box>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VFZmZlY3QiLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJsb2dFdmVudCIsIkNvbW1hbmRSZXN1bHREaXNwbGF5IiwiZ2V0T2F1dGhDb25maWciLCJ1c2VFeGl0T25DdHJsQ0RXaXRoS2V5YmluZGluZ3MiLCJ1c2VUZXJtaW5hbFNpemUiLCJzZXRDbGlwYm9hcmQiLCJCb3giLCJjb2xvciIsIkxpbmsiLCJUZXh0IiwidXNlSW5wdXQiLCJ1c2VUaGVtZSIsInVzZUtleWJpbmRpbmciLCJBdXRoZW50aWNhdGlvbkNhbmNlbGxlZEVycm9yIiwicGVyZm9ybU1DUE9BdXRoRmxvdyIsInJldm9rZVNlcnZlclRva2VucyIsImNsZWFyU2VydmVyQ2FjaGUiLCJ1c2VNY3BSZWNvbm5lY3QiLCJ1c2VNY3BUb2dnbGVFbmFibGVkIiwiZGVzY3JpYmVNY3BDb25maWdGaWxlUGF0aCIsImV4Y2x1ZGVDb21tYW5kc0J5U2VydmVyIiwiZXhjbHVkZVJlc291cmNlc0J5U2VydmVyIiwiZXhjbHVkZVRvb2xzQnlTZXJ2ZXIiLCJmaWx0ZXJNY3BQcm9tcHRzQnlTZXJ2ZXIiLCJ1c2VBcHBTdGF0ZSIsInVzZVNldEFwcFN0YXRlIiwiZ2V0T2F1dGhBY2NvdW50SW5mbyIsIm9wZW5Ccm93c2VyIiwiZXJyb3JNZXNzYWdlIiwibG9nTUNQRGVidWciLCJjYXBpdGFsaXplIiwiQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IiwiU2VsZWN0IiwiQnlsaW5lIiwiS2V5Ym9hcmRTaG9ydGN1dEhpbnQiLCJTcGlubmVyIiwiVGV4dElucHV0IiwiQ2FwYWJpbGl0aWVzU2VjdGlvbiIsIkNsYXVkZUFJU2VydmVySW5mbyIsIkhUVFBTZXJ2ZXJJbmZvIiwiU1NFU2VydmVySW5mbyIsImhhbmRsZVJlY29ubmVjdEVycm9yIiwiaGFuZGxlUmVjb25uZWN0UmVzdWx0IiwiUHJvcHMiLCJzZXJ2ZXIiLCJzZXJ2ZXJUb29sc0NvdW50Iiwib25WaWV3VG9vbHMiLCJvbkNhbmNlbCIsIm9uQ29tcGxldGUiLCJyZXN1bHQiLCJvcHRpb25zIiwiZGlzcGxheSIsImJvcmRlcmxlc3MiLCJNQ1BSZW1vdGVTZXJ2ZXJNZW51IiwiUmVhY3ROb2RlIiwidGhlbWUiLCJleGl0U3RhdGUiLCJjb2x1bW5zIiwidGVybWluYWxDb2x1bW5zIiwiaXNBdXRoZW50aWNhdGluZyIsInNldElzQXV0aGVudGljYXRpbmciLCJlcnJvciIsInNldEVycm9yIiwibWNwIiwicyIsInNldEFwcFN0YXRlIiwiYXV0aG9yaXphdGlvblVybCIsInNldEF1dGhvcml6YXRpb25VcmwiLCJpc1JlY29ubmVjdGluZyIsInNldElzUmVjb25uZWN0aW5nIiwiYXV0aEFib3J0Q29udHJvbGxlclJlZiIsIkFib3J0Q29udHJvbGxlciIsImlzQ2xhdWRlQUlBdXRoZW50aWNhdGluZyIsInNldElzQ2xhdWRlQUlBdXRoZW50aWNhdGluZyIsImNsYXVkZUFJQXV0aFVybCIsInNldENsYXVkZUFJQXV0aFVybCIsImlzQ2xhdWRlQUlDbGVhcmluZ0F1dGgiLCJzZXRJc0NsYXVkZUFJQ2xlYXJpbmdBdXRoIiwiY2xhdWRlQUlDbGVhckF1dGhVcmwiLCJzZXRDbGF1ZGVBSUNsZWFyQXV0aFVybCIsImNsYXVkZUFJQ2xlYXJBdXRoQnJvd3Nlck9wZW5lZCIsInNldENsYXVkZUFJQ2xlYXJBdXRoQnJvd3Nlck9wZW5lZCIsInVybENvcGllZCIsInNldFVybENvcGllZCIsImNvcHlUaW1lb3V0UmVmIiwiUmV0dXJuVHlwZSIsInNldFRpbWVvdXQiLCJ1bmRlZmluZWQiLCJ1bm1vdW50ZWRSZWYiLCJjYWxsYmFja1VybElucHV0Iiwic2V0Q2FsbGJhY2tVcmxJbnB1dCIsImNhbGxiYWNrVXJsQ3Vyc29yT2Zmc2V0Iiwic2V0Q2FsbGJhY2tVcmxDdXJzb3JPZmZzZXQiLCJtYW51YWxDYWxsYmFja1N1Ym1pdCIsInNldE1hbnVhbENhbGxiYWNrU3VibWl0IiwidXJsIiwiY3VycmVudCIsImFib3J0IiwiY2xlYXJUaW1lb3V0IiwiaXNFZmZlY3RpdmVseUF1dGhlbnRpY2F0ZWQiLCJpc0F1dGhlbnRpY2F0ZWQiLCJjbGllbnQiLCJ0eXBlIiwicmVjb25uZWN0TWNwU2VydmVyIiwiaGFuZGxlQ2xhdWRlQUlBdXRoQ29tcGxldGUiLCJ1c2VDYWxsYmFjayIsIm5hbWUiLCJzdWNjZXNzIiwiZXJyIiwiaGFuZGxlQ2xhdWRlQUlDbGVhckF1dGhDb21wbGV0ZSIsImNvbmZpZyIsInNjb3BlIiwicHJldiIsIm5ld0NsaWVudHMiLCJjbGllbnRzIiwibWFwIiwiYyIsImNvbnN0IiwibmV3VG9vbHMiLCJ0b29scyIsIm5ld0NvbW1hbmRzIiwiY29tbWFuZHMiLCJuZXdSZXNvdXJjZXMiLCJyZXNvdXJjZXMiLCJjb250ZXh0IiwiaXNBY3RpdmUiLCJpbnB1dCIsImtleSIsInJldHVybiIsImNvbm5lY3RvcnNVcmwiLCJDTEFVREVfQUlfT1JJR0lOIiwidXJsVG9Db3B5IiwidGhlbiIsInJhdyIsInByb2Nlc3MiLCJzdGRvdXQiLCJ3cml0ZSIsImNhcGl0YWxpemVkU2VydmVyTmFtZSIsIlN0cmluZyIsInNlcnZlckNvbW1hbmRzQ291bnQiLCJsZW5ndGgiLCJ0b2dnbGVNY3BTZXJ2ZXIiLCJoYW5kbGVDbGF1ZGVBSUF1dGgiLCJjbGF1ZGVBaUJhc2VVcmwiLCJhY2NvdW50SW5mbyIsIm9yZ1V1aWQiLCJvcmdhbml6YXRpb25VdWlkIiwiYXV0aFVybCIsImlkIiwic2VydmVySWQiLCJzdGFydHNXaXRoIiwic2xpY2UiLCJwcm9kdWN0U3VyZmFjZSIsImVuY29kZVVSSUNvbXBvbmVudCIsImVudiIsIkNMQVVERV9DT0RFX0VOVFJZUE9JTlQiLCJoYW5kbGVDbGF1ZGVBSUNsZWFyQXV0aCIsImhhbmRsZVRvZ2dsZUVuYWJsZWQiLCJ3YXNFbmFibGVkIiwibmV3X3N0YXRlIiwiYWN0aW9uIiwiaGFuZGxlQXV0aGVudGljYXRlIiwiY29udHJvbGxlciIsInByZXNlcnZlU3RlcFVwU3RhdGUiLCJzaWduYWwiLCJvbldhaXRpbmdGb3JDYWxsYmFjayIsInN1Ym1pdCIsIndhc0F1dGhlbnRpY2F0ZWQiLCJtZXNzYWdlIiwiRXJyb3IiLCJoYW5kbGVDbGVhckF1dGgiLCJhdXRoQ29weSIsIm9hdXRoIiwieGFhIiwidmFsdWUiLCJ0cmltIiwibWVudU9wdGlvbnMiLCJwdXNoIiwibGFiZWwiLCJyYWRpb09mZiIsInRpY2siLCJ0cmlhbmdsZVVwT3V0bGluZSIsImNyb3NzIiwidHJhbnNwb3J0IiwicGVuZGluZyIsImtleU5hbWUiXSwic291cmNlcyI6WyJNQ1BSZW1vdGVTZXJ2ZXJNZW51LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZmlndXJlcyBmcm9tICdmaWd1cmVzJ1xuaW1wb3J0IFJlYWN0LCB7IHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnc3JjL3NlcnZpY2VzL2FuYWx5dGljcy9pbmRleC5qcydcbmltcG9ydCB0eXBlIHsgQ29tbWFuZFJlc3VsdERpc3BsYXkgfSBmcm9tICcuLi8uLi9jb21tYW5kcy5qcydcbmltcG9ydCB7IGdldE9hdXRoQ29uZmlnIH0gZnJvbSAnLi4vLi4vY29uc3RhbnRzL29hdXRoLmpzJ1xuaW1wb3J0IHsgdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzLmpzJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuaW1wb3J0IHsgc2V0Q2xpcGJvYXJkIH0gZnJvbSAnLi4vLi4vaW5rL3Rlcm1pby9vc2MuanMnXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL3ByZWZlci11c2Uta2V5YmluZGluZ3MgLS0gcmF3IGovay9hcnJvdyBtZW51IG5hdmlnYXRpb25cbmltcG9ydCB7IEJveCwgY29sb3IsIExpbmssIFRleHQsIHVzZUlucHV0LCB1c2VUaGVtZSB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7IHVzZUtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5ncy91c2VLZXliaW5kaW5nLmpzJ1xuaW1wb3J0IHtcbiAgQXV0aGVudGljYXRpb25DYW5jZWxsZWRFcnJvcixcbiAgcGVyZm9ybU1DUE9BdXRoRmxvdyxcbiAgcmV2b2tlU2VydmVyVG9rZW5zLFxufSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tY3AvYXV0aC5qcydcbmltcG9ydCB7IGNsZWFyU2VydmVyQ2FjaGUgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tY3AvY2xpZW50LmpzJ1xuaW1wb3J0IHtcbiAgdXNlTWNwUmVjb25uZWN0LFxuICB1c2VNY3BUb2dnbGVFbmFibGVkLFxufSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tY3AvTUNQQ29ubmVjdGlvbk1hbmFnZXIuanMnXG5pbXBvcnQge1xuICBkZXNjcmliZU1jcENvbmZpZ0ZpbGVQYXRoLFxuICBleGNsdWRlQ29tbWFuZHNCeVNlcnZlcixcbiAgZXhjbHVkZVJlc291cmNlc0J5U2VydmVyLFxuICBleGNsdWRlVG9vbHNCeVNlcnZlcixcbiAgZmlsdGVyTWNwUHJvbXB0c0J5U2VydmVyLFxufSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9tY3AvdXRpbHMuanMnXG5pbXBvcnQgeyB1c2VBcHBTdGF0ZSwgdXNlU2V0QXBwU3RhdGUgfSBmcm9tICcuLi8uLi9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB7IGdldE9hdXRoQWNjb3VudEluZm8gfSBmcm9tICcuLi8uLi91dGlscy9hdXRoLmpzJ1xuaW1wb3J0IHsgb3BlbkJyb3dzZXIgfSBmcm9tICcuLi8uLi91dGlscy9icm93c2VyLmpzJ1xuaW1wb3J0IHsgZXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vdXRpbHMvZXJyb3JzLmpzJ1xuaW1wb3J0IHsgbG9nTUNQRGVidWcgfSBmcm9tICcuLi8uLi91dGlscy9sb2cuanMnXG5pbXBvcnQgeyBjYXBpdGFsaXplIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3RyaW5nVXRpbHMuanMnXG5pbXBvcnQgeyBDb25maWd1cmFibGVTaG9ydGN1dEhpbnQgfSBmcm9tICcuLi9Db25maWd1cmFibGVTaG9ydGN1dEhpbnQuanMnXG5pbXBvcnQgeyBTZWxlY3QgfSBmcm9tICcuLi9DdXN0b21TZWxlY3QvaW5kZXguanMnXG5pbXBvcnQgeyBCeWxpbmUgfSBmcm9tICcuLi9kZXNpZ24tc3lzdGVtL0J5bGluZS5qcydcbmltcG9ydCB7IEtleWJvYXJkU2hvcnRjdXRIaW50IH0gZnJvbSAnLi4vZGVzaWduLXN5c3RlbS9LZXlib2FyZFNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi9TcGlubmVyLmpzJ1xuaW1wb3J0IFRleHRJbnB1dCBmcm9tICcuLi9UZXh0SW5wdXQuanMnXG5pbXBvcnQgeyBDYXBhYmlsaXRpZXNTZWN0aW9uIH0gZnJvbSAnLi9DYXBhYmlsaXRpZXNTZWN0aW9uLmpzJ1xuaW1wb3J0IHR5cGUge1xuICBDbGF1ZGVBSVNlcnZlckluZm8sXG4gIEhUVFBTZXJ2ZXJJbmZvLFxuICBTU0VTZXJ2ZXJJbmZvLFxufSBmcm9tICcuL3R5cGVzLmpzJ1xuaW1wb3J0IHtcbiAgaGFuZGxlUmVjb25uZWN0RXJyb3IsXG4gIGhhbmRsZVJlY29ubmVjdFJlc3VsdCxcbn0gZnJvbSAnLi91dGlscy9yZWNvbm5lY3RIZWxwZXJzLmpzJ1xuXG50eXBlIFByb3BzID0ge1xuICBzZXJ2ZXI6IFNTRVNlcnZlckluZm8gfCBIVFRQU2VydmVySW5mbyB8IENsYXVkZUFJU2VydmVySW5mb1xuICBzZXJ2ZXJUb29sc0NvdW50OiBudW1iZXJcbiAgb25WaWV3VG9vbHM6ICgpID0+IHZvaWRcbiAgb25DYW5jZWw6ICgpID0+IHZvaWRcbiAgb25Db21wbGV0ZT86IChcbiAgICByZXN1bHQ/OiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IHsgZGlzcGxheT86IENvbW1hbmRSZXN1bHREaXNwbGF5IH0sXG4gICkgPT4gdm9pZFxuICBib3JkZXJsZXNzPzogYm9vbGVhblxufVxuXG5leHBvcnQgZnVuY3Rpb24gTUNQUmVtb3RlU2VydmVyTWVudSh7XG4gIHNlcnZlcixcbiAgc2VydmVyVG9vbHNDb3VudCxcbiAgb25WaWV3VG9vbHMsXG4gIG9uQ2FuY2VsLFxuICBvbkNvbXBsZXRlLFxuICBib3JkZXJsZXNzID0gZmFsc2UsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IFt0aGVtZV0gPSB1c2VUaGVtZSgpXG4gIGNvbnN0IGV4aXRTdGF0ZSA9IHVzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncygpXG4gIGNvbnN0IHsgY29sdW1uczogdGVybWluYWxDb2x1bW5zIH0gPSB1c2VUZXJtaW5hbFNpemUoKVxuICBjb25zdCBbaXNBdXRoZW50aWNhdGluZywgc2V0SXNBdXRoZW50aWNhdGluZ10gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2Vycm9yLCBzZXRFcnJvcl0gPSBSZWFjdC51c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuICBjb25zdCBtY3AgPSB1c2VBcHBTdGF0ZShzID0+IHMubWNwKVxuICBjb25zdCBzZXRBcHBTdGF0ZSA9IHVzZVNldEFwcFN0YXRlKClcbiAgY29uc3QgW2F1dGhvcml6YXRpb25VcmwsIHNldEF1dGhvcml6YXRpb25VcmxdID0gUmVhY3QudXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4oXG4gICAgbnVsbCxcbiAgKVxuICBjb25zdCBbaXNSZWNvbm5lY3RpbmcsIHNldElzUmVjb25uZWN0aW5nXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBhdXRoQWJvcnRDb250cm9sbGVyUmVmID0gdXNlUmVmPEFib3J0Q29udHJvbGxlciB8IG51bGw+KG51bGwpXG4gIGNvbnN0IFtpc0NsYXVkZUFJQXV0aGVudGljYXRpbmcsIHNldElzQ2xhdWRlQUlBdXRoZW50aWNhdGluZ10gPVxuICAgIHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbY2xhdWRlQUlBdXRoVXJsLCBzZXRDbGF1ZGVBSUF1dGhVcmxdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgY29uc3QgW2lzQ2xhdWRlQUlDbGVhcmluZ0F1dGgsIHNldElzQ2xhdWRlQUlDbGVhcmluZ0F1dGhdID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtjbGF1ZGVBSUNsZWFyQXV0aFVybCwgc2V0Q2xhdWRlQUlDbGVhckF1dGhVcmxdID0gdXNlU3RhdGU8XG4gICAgc3RyaW5nIHwgbnVsbFxuICA+KG51bGwpXG4gIGNvbnN0IFtjbGF1ZGVBSUNsZWFyQXV0aEJyb3dzZXJPcGVuZWQsIHNldENsYXVkZUFJQ2xlYXJBdXRoQnJvd3Nlck9wZW5lZF0gPVxuICAgIHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbdXJsQ29waWVkLCBzZXRVcmxDb3BpZWRdID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IGNvcHlUaW1lb3V0UmVmID0gdXNlUmVmPFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgdW5kZWZpbmVkPihcbiAgICB1bmRlZmluZWQsXG4gIClcbiAgY29uc3QgdW5tb3VudGVkUmVmID0gdXNlUmVmKGZhbHNlKVxuICBjb25zdCBbY2FsbGJhY2tVcmxJbnB1dCwgc2V0Q2FsbGJhY2tVcmxJbnB1dF0gPSB1c2VTdGF0ZSgnJylcbiAgY29uc3QgW2NhbGxiYWNrVXJsQ3Vyc29yT2Zmc2V0LCBzZXRDYWxsYmFja1VybEN1cnNvck9mZnNldF0gPSB1c2VTdGF0ZSgwKVxuICBjb25zdCBbbWFudWFsQ2FsbGJhY2tTdWJtaXQsIHNldE1hbnVhbENhbGxiYWNrU3VibWl0XSA9IHVzZVN0YXRlPFxuICAgICgodXJsOiBzdHJpbmcpID0+IHZvaWQpIHwgbnVsbFxuICA+KG51bGwpXG5cbiAgLy8gSWYgdGhlIGNvbXBvbmVudCB1bm1vdW50cyBtaWQtYXV0aCAoZS5nLiBhIHBhcmVudCBjb21wb25lbnQncyBFc2MgaGFuZGxlclxuICAvLyBuYXZpZ2F0ZXMgYXdheSBiZWZvcmUgb3VycyBmaXJlcyksIGFib3J0IHRoZSBPQXV0aCBmbG93IHNvIHRoZSBjYWxsYmFja1xuICAvLyBzZXJ2ZXIgaXMgY2xvc2VkLiBXaXRob3V0IHRoaXMsIHRoZSBzZXJ2ZXIgc3RheXMgYm91bmQgYW5kIHRoZSBwcm9jZXNzXG4gIC8vIGNhbiBvdXRsaXZlIHRoZSB0ZXJtaW5hbC4gQWxzbyBjbGVhciB0aGUgY29weS1mZWVkYmFjayB0aW1lciBhbmQgbWFya1xuICAvLyB1bm1vdW50ZWQgc28gdGhlIGFzeW5jIHNldENsaXBib2FyZCBjYWxsYmFjayBkb2Vzbid0IHNldFVybENvcGllZCAvXG4gIC8vIHNjaGVkdWxlIGEgbmV3IHRpbWVyIGFmdGVyIHVubW91bnQuXG4gIHVzZUVmZmVjdChcbiAgICAoKSA9PiAoKSA9PiB7XG4gICAgICB1bm1vdW50ZWRSZWYuY3VycmVudCA9IHRydWVcbiAgICAgIGF1dGhBYm9ydENvbnRyb2xsZXJSZWYuY3VycmVudD8uYWJvcnQoKVxuICAgICAgaWYgKGNvcHlUaW1lb3V0UmVmLmN1cnJlbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjbGVhclRpbWVvdXQoY29weVRpbWVvdXRSZWYuY3VycmVudClcbiAgICAgIH1cbiAgICB9LFxuICAgIFtdLFxuICApXG5cbiAgLy8gQSBzZXJ2ZXIgaXMgZWZmZWN0aXZlbHkgYXV0aGVudGljYXRlZCBpZjpcbiAgLy8gMS4gSXQgaGFzIE9BdXRoIHRva2VucyAoc2VydmVyLmlzQXV0aGVudGljYXRlZCksIE9SXG4gIC8vIDIuIEl0J3MgY29ubmVjdGVkIGFuZCBoYXMgdG9vbHMgKG1lYW5pbmcgaXQncyB3b3JraW5nIHZpYSBzb21lIGF1dGggbWVjaGFuaXNtKVxuICBjb25zdCBpc0VmZmVjdGl2ZWx5QXV0aGVudGljYXRlZCA9XG4gICAgc2VydmVyLmlzQXV0aGVudGljYXRlZCB8fFxuICAgIChzZXJ2ZXIuY2xpZW50LnR5cGUgPT09ICdjb25uZWN0ZWQnICYmIHNlcnZlclRvb2xzQ291bnQgPiAwKVxuXG4gIGNvbnN0IHJlY29ubmVjdE1jcFNlcnZlciA9IHVzZU1jcFJlY29ubmVjdCgpXG5cbiAgY29uc3QgaGFuZGxlQ2xhdWRlQUlBdXRoQ29tcGxldGUgPSBSZWFjdC51c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4gICAgc2V0SXNDbGF1ZGVBSUF1dGhlbnRpY2F0aW5nKGZhbHNlKVxuICAgIHNldENsYXVkZUFJQXV0aFVybChudWxsKVxuICAgIHNldElzUmVjb25uZWN0aW5nKHRydWUpXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJlY29ubmVjdE1jcFNlcnZlcihzZXJ2ZXIubmFtZSlcbiAgICAgIGNvbnN0IHN1Y2Nlc3MgPSByZXN1bHQuY2xpZW50LnR5cGUgPT09ICdjb25uZWN0ZWQnXG4gICAgICBsb2dFdmVudCgndGVuZ3VfY2xhdWRlYWlfbWNwX2F1dGhfY29tcGxldGVkJywgeyBzdWNjZXNzIH0pXG4gICAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICBvbkNvbXBsZXRlPy4oYEF1dGhlbnRpY2F0aW9uIHN1Y2Nlc3NmdWwuIENvbm5lY3RlZCB0byAke3NlcnZlci5uYW1lfS5gKVxuICAgICAgfSBlbHNlIGlmIChyZXN1bHQuY2xpZW50LnR5cGUgPT09ICduZWVkcy1hdXRoJykge1xuICAgICAgICBvbkNvbXBsZXRlPy4oXG4gICAgICAgICAgJ0F1dGhlbnRpY2F0aW9uIHN1Y2Nlc3NmdWwsIGJ1dCBzZXJ2ZXIgc3RpbGwgcmVxdWlyZXMgYXV0aGVudGljYXRpb24uIFlvdSBtYXkgbmVlZCB0byBtYW51YWxseSByZXN0YXJ0IENsYXVkZSBDb2RlLicsXG4gICAgICAgIClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9uQ29tcGxldGU/LihcbiAgICAgICAgICAnQXV0aGVudGljYXRpb24gc3VjY2Vzc2Z1bCwgYnV0IHNlcnZlciByZWNvbm5lY3Rpb24gZmFpbGVkLiBZb3UgbWF5IG5lZWQgdG8gbWFudWFsbHkgcmVzdGFydCBDbGF1ZGUgQ29kZSBmb3IgdGhlIGNoYW5nZXMgdG8gdGFrZSBlZmZlY3QuJyxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2NsYXVkZWFpX21jcF9hdXRoX2NvbXBsZXRlZCcsIHsgc3VjY2VzczogZmFsc2UgfSlcbiAgICAgIG9uQ29tcGxldGU/LihoYW5kbGVSZWNvbm5lY3RFcnJvcihlcnIsIHNlcnZlci5uYW1lKSlcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNSZWNvbm5lY3RpbmcoZmFsc2UpXG4gICAgfVxuICB9LCBbcmVjb25uZWN0TWNwU2VydmVyLCBzZXJ2ZXIubmFtZSwgb25Db21wbGV0ZV0pXG5cbiAgY29uc3QgaGFuZGxlQ2xhdWRlQUlDbGVhckF1dGhDb21wbGV0ZSA9IFJlYWN0LnVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBjbGVhclNlcnZlckNhY2hlKHNlcnZlci5uYW1lLCB7XG4gICAgICAuLi5zZXJ2ZXIuY29uZmlnLFxuICAgICAgc2NvcGU6IHNlcnZlci5zY29wZSxcbiAgICB9KVxuXG4gICAgc2V0QXBwU3RhdGUocHJldiA9PiB7XG4gICAgICBjb25zdCBuZXdDbGllbnRzID0gcHJldi5tY3AuY2xpZW50cy5tYXAoYyA9PlxuICAgICAgICBjLm5hbWUgPT09IHNlcnZlci5uYW1lID8geyAuLi5jLCB0eXBlOiAnbmVlZHMtYXV0aCcgYXMgY29uc3QgfSA6IGMsXG4gICAgICApXG4gICAgICBjb25zdCBuZXdUb29scyA9IGV4Y2x1ZGVUb29sc0J5U2VydmVyKHByZXYubWNwLnRvb2xzLCBzZXJ2ZXIubmFtZSlcbiAgICAgIGNvbnN0IG5ld0NvbW1hbmRzID0gZXhjbHVkZUNvbW1hbmRzQnlTZXJ2ZXIoXG4gICAgICAgIHByZXYubWNwLmNvbW1hbmRzLFxuICAgICAgICBzZXJ2ZXIubmFtZSxcbiAgICAgIClcbiAgICAgIGNvbnN0IG5ld1Jlc291cmNlcyA9IGV4Y2x1ZGVSZXNvdXJjZXNCeVNlcnZlcihcbiAgICAgICAgcHJldi5tY3AucmVzb3VyY2VzLFxuICAgICAgICBzZXJ2ZXIubmFtZSxcbiAgICAgIClcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ucHJldixcbiAgICAgICAgbWNwOiB7XG4gICAgICAgICAgLi4ucHJldi5tY3AsXG4gICAgICAgICAgY2xpZW50czogbmV3Q2xpZW50cyxcbiAgICAgICAgICB0b29sczogbmV3VG9vbHMsXG4gICAgICAgICAgY29tbWFuZHM6IG5ld0NvbW1hbmRzLFxuICAgICAgICAgIHJlc291cmNlczogbmV3UmVzb3VyY2VzLFxuICAgICAgICB9LFxuICAgICAgfVxuICAgIH0pXG5cbiAgICBsb2dFdmVudCgndGVuZ3VfY2xhdWRlYWlfbWNwX2NsZWFyX2F1dGhfY29tcGxldGVkJywge30pXG4gICAgb25Db21wbGV0ZT8uKGBEaXNjb25uZWN0ZWQgZnJvbSAke3NlcnZlci5uYW1lfS5gKVxuICAgIHNldElzQ2xhdWRlQUlDbGVhcmluZ0F1dGgoZmFsc2UpXG4gICAgc2V0Q2xhdWRlQUlDbGVhckF1dGhVcmwobnVsbClcbiAgICBzZXRDbGF1ZGVBSUNsZWFyQXV0aEJyb3dzZXJPcGVuZWQoZmFsc2UpXG4gIH0sIFtzZXJ2ZXIubmFtZSwgc2VydmVyLmNvbmZpZywgc2VydmVyLnNjb3BlLCBzZXRBcHBTdGF0ZSwgb25Db21wbGV0ZV0pXG5cbiAgLy8gRXNjYXBlIHRvIGNhbmNlbCBhdXRoZW50aWNhdGlvbiBmbG93XG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2NvbmZpcm06bm8nLFxuICAgICgpID0+IHtcbiAgICAgIGF1dGhBYm9ydENvbnRyb2xsZXJSZWYuY3VycmVudD8uYWJvcnQoKVxuICAgICAgYXV0aEFib3J0Q29udHJvbGxlclJlZi5jdXJyZW50ID0gbnVsbFxuICAgICAgc2V0SXNBdXRoZW50aWNhdGluZyhmYWxzZSlcbiAgICAgIHNldEF1dGhvcml6YXRpb25VcmwobnVsbClcbiAgICB9LFxuICAgIHtcbiAgICAgIGNvbnRleHQ6ICdDb25maXJtYXRpb24nLFxuICAgICAgaXNBY3RpdmU6IGlzQXV0aGVudGljYXRpbmcsXG4gICAgfSxcbiAgKVxuXG4gIC8vIEVzY2FwZSB0byBjYW5jZWwgQ2xhdWRlIEFJIGF1dGhlbnRpY2F0aW9uXG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2NvbmZpcm06bm8nLFxuICAgICgpID0+IHtcbiAgICAgIHNldElzQ2xhdWRlQUlBdXRoZW50aWNhdGluZyhmYWxzZSlcbiAgICAgIHNldENsYXVkZUFJQXV0aFVybChudWxsKVxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgICBpc0FjdGl2ZTogaXNDbGF1ZGVBSUF1dGhlbnRpY2F0aW5nLFxuICAgIH0sXG4gIClcblxuICAvLyBFc2NhcGUgdG8gY2FuY2VsIENsYXVkZSBBSSBjbGVhciBhdXRoXG4gIHVzZUtleWJpbmRpbmcoXG4gICAgJ2NvbmZpcm06bm8nLFxuICAgICgpID0+IHtcbiAgICAgIHNldElzQ2xhdWRlQUlDbGVhcmluZ0F1dGgoZmFsc2UpXG4gICAgICBzZXRDbGF1ZGVBSUNsZWFyQXV0aFVybChudWxsKVxuICAgICAgc2V0Q2xhdWRlQUlDbGVhckF1dGhCcm93c2VyT3BlbmVkKGZhbHNlKVxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgICBpc0FjdGl2ZTogaXNDbGF1ZGVBSUNsZWFyaW5nQXV0aCxcbiAgICB9LFxuICApXG5cbiAgLy8gUmV0dXJuIGtleSBoYW5kbGluZyBmb3IgYXV0aGVudGljYXRpb24gZmxvd3MgYW5kICdjJyB0byBjb3B5IFVSTFxuICB1c2VJbnB1dCgoaW5wdXQsIGtleSkgPT4ge1xuICAgIGlmIChrZXkucmV0dXJuICYmIGlzQ2xhdWRlQUlBdXRoZW50aWNhdGluZykge1xuICAgICAgdm9pZCBoYW5kbGVDbGF1ZGVBSUF1dGhDb21wbGV0ZSgpXG4gICAgfVxuICAgIGlmIChrZXkucmV0dXJuICYmIGlzQ2xhdWRlQUlDbGVhcmluZ0F1dGgpIHtcbiAgICAgIGlmIChjbGF1ZGVBSUNsZWFyQXV0aEJyb3dzZXJPcGVuZWQpIHtcbiAgICAgICAgdm9pZCBoYW5kbGVDbGF1ZGVBSUNsZWFyQXV0aENvbXBsZXRlKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZpcnN0IEVudGVyOiBvcGVuIHRoZSBicm93c2VyXG4gICAgICAgIGNvbnN0IGNvbm5lY3RvcnNVcmwgPSBgJHtnZXRPYXV0aENvbmZpZygpLkNMQVVERV9BSV9PUklHSU59L3NldHRpbmdzL2Nvbm5lY3RvcnNgXG4gICAgICAgIHNldENsYXVkZUFJQ2xlYXJBdXRoVXJsKGNvbm5lY3RvcnNVcmwpXG4gICAgICAgIHNldENsYXVkZUFJQ2xlYXJBdXRoQnJvd3Nlck9wZW5lZCh0cnVlKVxuICAgICAgICB2b2lkIG9wZW5Ccm93c2VyKGNvbm5lY3RvcnNVcmwpXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChpbnB1dCA9PT0gJ2MnICYmICF1cmxDb3BpZWQpIHtcbiAgICAgIGNvbnN0IHVybFRvQ29weSA9XG4gICAgICAgIGF1dGhvcml6YXRpb25VcmwgfHwgY2xhdWRlQUlBdXRoVXJsIHx8IGNsYXVkZUFJQ2xlYXJBdXRoVXJsXG4gICAgICBpZiAodXJsVG9Db3B5KSB7XG4gICAgICAgIHZvaWQgc2V0Q2xpcGJvYXJkKHVybFRvQ29weSkudGhlbihyYXcgPT4ge1xuICAgICAgICAgIGlmICh1bm1vdW50ZWRSZWYuY3VycmVudCkgcmV0dXJuXG4gICAgICAgICAgaWYgKHJhdykgcHJvY2Vzcy5zdGRvdXQud3JpdGUocmF3KVxuICAgICAgICAgIHNldFVybENvcGllZCh0cnVlKVxuICAgICAgICAgIGlmIChjb3B5VGltZW91dFJlZi5jdXJyZW50ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjb3B5VGltZW91dFJlZi5jdXJyZW50KVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb3B5VGltZW91dFJlZi5jdXJyZW50ID0gc2V0VGltZW91dChzZXRVcmxDb3BpZWQsIDIwMDAsIGZhbHNlKVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cbiAgfSlcblxuICBjb25zdCBjYXBpdGFsaXplZFNlcnZlck5hbWUgPSBjYXBpdGFsaXplKFN0cmluZyhzZXJ2ZXIubmFtZSkpXG5cbiAgLy8gQ291bnQgTUNQIHByb21wdHMgZm9yIHRoaXMgc2VydmVyIChza2lsbHMgYXJlIHNob3duIGluIC9za2lsbHMsIG5vdCBoZXJlKVxuICBjb25zdCBzZXJ2ZXJDb21tYW5kc0NvdW50ID0gZmlsdGVyTWNwUHJvbXB0c0J5U2VydmVyKFxuICAgIG1jcC5jb21tYW5kcyxcbiAgICBzZXJ2ZXIubmFtZSxcbiAgKS5sZW5ndGhcblxuICBjb25zdCB0b2dnbGVNY3BTZXJ2ZXIgPSB1c2VNY3BUb2dnbGVFbmFibGVkKClcblxuICBjb25zdCBoYW5kbGVDbGF1ZGVBSUF1dGggPSBSZWFjdC51c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY2xhdWRlQWlCYXNlVXJsID0gZ2V0T2F1dGhDb25maWcoKS5DTEFVREVfQUlfT1JJR0lOXG4gICAgY29uc3QgYWNjb3VudEluZm8gPSBnZXRPYXV0aEFjY291bnRJbmZvKClcbiAgICBjb25zdCBvcmdVdWlkID0gYWNjb3VudEluZm8/Lm9yZ2FuaXphdGlvblV1aWRcblxuICAgIGxldCBhdXRoVXJsOiBzdHJpbmdcbiAgICBpZiAoXG4gICAgICBvcmdVdWlkICYmXG4gICAgICBzZXJ2ZXIuY29uZmlnLnR5cGUgPT09ICdjbGF1ZGVhaS1wcm94eScgJiZcbiAgICAgIHNlcnZlci5jb25maWcuaWRcbiAgICApIHtcbiAgICAgIC8vIFVzZSB0aGUgZGlyZWN0IGF1dGggVVJMIHdpdGggb3JnIGFuZCBzZXJ2ZXIgSURzXG4gICAgICAvLyBSZXBsYWNlICdtY3BycycgcHJlZml4IHdpdGggJ21jcHNydicgaWYgcHJlc2VudFxuICAgICAgY29uc3Qgc2VydmVySWQgPSBzZXJ2ZXIuY29uZmlnLmlkLnN0YXJ0c1dpdGgoJ21jcHJzJylcbiAgICAgICAgPyAnbWNwc3J2JyArIHNlcnZlci5jb25maWcuaWQuc2xpY2UoNSlcbiAgICAgICAgOiBzZXJ2ZXIuY29uZmlnLmlkXG4gICAgICBjb25zdCBwcm9kdWN0U3VyZmFjZSA9IGVuY29kZVVSSUNvbXBvbmVudChcbiAgICAgICAgcHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfRU5UUllQT0lOVCB8fCAnY2xpJyxcbiAgICAgIClcbiAgICAgIGF1dGhVcmwgPSBgJHtjbGF1ZGVBaUJhc2VVcmx9L2FwaS9vcmdhbml6YXRpb25zLyR7b3JnVXVpZH0vbWNwL3N0YXJ0LWF1dGgvJHtzZXJ2ZXJJZH0/cHJvZHVjdF9zdXJmYWNlPSR7cHJvZHVjdFN1cmZhY2V9YFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBGYWxsIGJhY2sgdG8gc2V0dGluZ3MvY29ubmVjdG9ycyBpZiB3ZSBkb24ndCBoYXZlIHRoZSByZXF1aXJlZCBJRHNcbiAgICAgIGF1dGhVcmwgPSBgJHtjbGF1ZGVBaUJhc2VVcmx9L3NldHRpbmdzL2Nvbm5lY3RvcnNgXG4gICAgfVxuXG4gICAgc2V0Q2xhdWRlQUlBdXRoVXJsKGF1dGhVcmwpXG4gICAgc2V0SXNDbGF1ZGVBSUF1dGhlbnRpY2F0aW5nKHRydWUpXG4gICAgbG9nRXZlbnQoJ3Rlbmd1X2NsYXVkZWFpX21jcF9hdXRoX3N0YXJ0ZWQnLCB7fSlcbiAgICBhd2FpdCBvcGVuQnJvd3NlcihhdXRoVXJsKVxuICB9LCBbc2VydmVyLmNvbmZpZ10pXG5cbiAgY29uc3QgaGFuZGxlQ2xhdWRlQUlDbGVhckF1dGggPSBSZWFjdC51c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgc2V0SXNDbGF1ZGVBSUNsZWFyaW5nQXV0aCh0cnVlKVxuICAgIGxvZ0V2ZW50KCd0ZW5ndV9jbGF1ZGVhaV9tY3BfY2xlYXJfYXV0aF9zdGFydGVkJywge30pXG4gIH0sIFtdKVxuXG4gIGNvbnN0IGhhbmRsZVRvZ2dsZUVuYWJsZWQgPSBSZWFjdC51c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgd2FzRW5hYmxlZCA9IHNlcnZlci5jbGllbnQudHlwZSAhPT0gJ2Rpc2FibGVkJ1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRvZ2dsZU1jcFNlcnZlcihzZXJ2ZXIubmFtZSlcblxuICAgICAgaWYgKHNlcnZlci5jb25maWcudHlwZSA9PT0gJ2NsYXVkZWFpLXByb3h5Jykge1xuICAgICAgICBsb2dFdmVudCgndGVuZ3VfY2xhdWRlYWlfbWNwX3RvZ2dsZScsIHtcbiAgICAgICAgICBuZXdfc3RhdGU6ICh3YXNFbmFibGVkXG4gICAgICAgICAgICA/ICdkaXNhYmxlZCdcbiAgICAgICAgICAgIDogJ2VuYWJsZWQnKSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICAvLyBSZXR1cm4gdG8gdGhlIHNlcnZlciBsaXN0IHNvIHVzZXIgY2FuIGNvbnRpbnVlIG1hbmFnaW5nIG90aGVyIHNlcnZlcnNcbiAgICAgIG9uQ2FuY2VsKClcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnN0IGFjdGlvbiA9IHdhc0VuYWJsZWQgPyAnZGlzYWJsZScgOiAnZW5hYmxlJ1xuICAgICAgb25Db21wbGV0ZT8uKFxuICAgICAgICBgRmFpbGVkIHRvICR7YWN0aW9ufSBNQ1Agc2VydmVyICcke3NlcnZlci5uYW1lfSc6ICR7ZXJyb3JNZXNzYWdlKGVycil9YCxcbiAgICAgIClcbiAgICB9XG4gIH0sIFtcbiAgICBzZXJ2ZXIuY2xpZW50LnR5cGUsXG4gICAgc2VydmVyLmNvbmZpZy50eXBlLFxuICAgIHNlcnZlci5uYW1lLFxuICAgIHRvZ2dsZU1jcFNlcnZlcixcbiAgICBvbkNhbmNlbCxcbiAgICBvbkNvbXBsZXRlLFxuICBdKVxuXG4gIGNvbnN0IGhhbmRsZUF1dGhlbnRpY2F0ZSA9IFJlYWN0LnVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICBpZiAoc2VydmVyLmNvbmZpZy50eXBlID09PSAnY2xhdWRlYWktcHJveHknKSByZXR1cm5cblxuICAgIHNldElzQXV0aGVudGljYXRpbmcodHJ1ZSlcbiAgICBzZXRFcnJvcihudWxsKVxuXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuICAgIGF1dGhBYm9ydENvbnRyb2xsZXJSZWYuY3VycmVudCA9IGNvbnRyb2xsZXJcblxuICAgIHRyeSB7XG4gICAgICAvLyBSZXZva2UgZXhpc3RpbmcgdG9rZW5zIGlmIHJlLWF1dGhlbnRpY2F0aW5nLCBidXQgcHJlc2VydmUgc3RlcC11cFxuICAgICAgLy8gYXV0aCBzdGF0ZSBzbyB0aGUgbmV4dCBPQXV0aCBmbG93IGNhbiByZXVzZSBjYWNoZWQgc2NvcGUvZGlzY292ZXJ5LlxuICAgICAgaWYgKHNlcnZlci5pc0F1dGhlbnRpY2F0ZWQgJiYgc2VydmVyLmNvbmZpZykge1xuICAgICAgICBhd2FpdCByZXZva2VTZXJ2ZXJUb2tlbnMoc2VydmVyLm5hbWUsIHNlcnZlci5jb25maWcsIHtcbiAgICAgICAgICBwcmVzZXJ2ZVN0ZXBVcFN0YXRlOiB0cnVlLFxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICBpZiAoc2VydmVyLmNvbmZpZykge1xuICAgICAgICBhd2FpdCBwZXJmb3JtTUNQT0F1dGhGbG93KFxuICAgICAgICAgIHNlcnZlci5uYW1lLFxuICAgICAgICAgIHNlcnZlci5jb25maWcsXG4gICAgICAgICAgc2V0QXV0aG9yaXphdGlvblVybCxcbiAgICAgICAgICBjb250cm9sbGVyLnNpZ25hbCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBvbldhaXRpbmdGb3JDYWxsYmFjazogc3VibWl0ID0+IHtcbiAgICAgICAgICAgICAgc2V0TWFudWFsQ2FsbGJhY2tTdWJtaXQoKCkgPT4gc3VibWl0KVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICApXG5cbiAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X21jcF9hdXRoX2NvbmZpZ19hdXRoZW50aWNhdGUnLCB7XG4gICAgICAgICAgd2FzQXV0aGVudGljYXRlZDogc2VydmVyLmlzQXV0aGVudGljYXRlZCxcbiAgICAgICAgfSlcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZWNvbm5lY3RNY3BTZXJ2ZXIoc2VydmVyLm5hbWUpXG5cbiAgICAgICAgaWYgKHJlc3VsdC5jbGllbnQudHlwZSA9PT0gJ2Nvbm5lY3RlZCcpIHtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gaXNFZmZlY3RpdmVseUF1dGhlbnRpY2F0ZWRcbiAgICAgICAgICAgID8gYEF1dGhlbnRpY2F0aW9uIHN1Y2Nlc3NmdWwuIFJlY29ubmVjdGVkIHRvICR7c2VydmVyLm5hbWV9LmBcbiAgICAgICAgICAgIDogYEF1dGhlbnRpY2F0aW9uIHN1Y2Nlc3NmdWwuIENvbm5lY3RlZCB0byAke3NlcnZlci5uYW1lfS5gXG4gICAgICAgICAgb25Db21wbGV0ZT8uKG1lc3NhZ2UpXG4gICAgICAgIH0gZWxzZSBpZiAocmVzdWx0LmNsaWVudC50eXBlID09PSAnbmVlZHMtYXV0aCcpIHtcbiAgICAgICAgICBvbkNvbXBsZXRlPy4oXG4gICAgICAgICAgICAnQXV0aGVudGljYXRpb24gc3VjY2Vzc2Z1bCwgYnV0IHNlcnZlciBzdGlsbCByZXF1aXJlcyBhdXRoZW50aWNhdGlvbi4gWW91IG1heSBuZWVkIHRvIG1hbnVhbGx5IHJlc3RhcnQgQ2xhdWRlIENvZGUuJyxcbiAgICAgICAgICApXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gcmVzdWx0LmNsaWVudC50eXBlID09PSAnZmFpbGVkJ1xuICAgICAgICAgIGxvZ01DUERlYnVnKHNlcnZlci5uYW1lLCBgUmVjb25uZWN0aW9uIGZhaWxlZCBhZnRlciBhdXRoZW50aWNhdGlvbmApXG4gICAgICAgICAgb25Db21wbGV0ZT8uKFxuICAgICAgICAgICAgJ0F1dGhlbnRpY2F0aW9uIHN1Y2Nlc3NmdWwsIGJ1dCBzZXJ2ZXIgcmVjb25uZWN0aW9uIGZhaWxlZC4gWW91IG1heSBuZWVkIHRvIG1hbnVhbGx5IHJlc3RhcnQgQ2xhdWRlIENvZGUgZm9yIHRoZSBjaGFuZ2VzIHRvIHRha2UgZWZmZWN0LicsXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBEb24ndCBzaG93IGVycm9yIGlmIGl0IHdhcyBhIGNhbmNlbGxhdGlvblxuICAgICAgaWYgKFxuICAgICAgICBlcnIgaW5zdGFuY2VvZiBFcnJvciAmJlxuICAgICAgICAhKGVyciBpbnN0YW5jZW9mIEF1dGhlbnRpY2F0aW9uQ2FuY2VsbGVkRXJyb3IpXG4gICAgICApIHtcbiAgICAgICAgc2V0RXJyb3IoZXJyLm1lc3NhZ2UpXG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzQXV0aGVudGljYXRpbmcoZmFsc2UpXG4gICAgICBhdXRoQWJvcnRDb250cm9sbGVyUmVmLmN1cnJlbnQgPSBudWxsXG4gICAgICBzZXRNYW51YWxDYWxsYmFja1N1Ym1pdChudWxsKVxuICAgICAgc2V0Q2FsbGJhY2tVcmxJbnB1dCgnJylcbiAgICB9XG4gIH0sIFtcbiAgICBzZXJ2ZXIuaXNBdXRoZW50aWNhdGVkLFxuICAgIHNlcnZlci5jb25maWcsXG4gICAgc2VydmVyLm5hbWUsXG4gICAgb25Db21wbGV0ZSxcbiAgICByZWNvbm5lY3RNY3BTZXJ2ZXIsXG4gICAgaXNFZmZlY3RpdmVseUF1dGhlbnRpY2F0ZWQsXG4gIF0pXG5cbiAgY29uc3QgaGFuZGxlQ2xlYXJBdXRoID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChzZXJ2ZXIuY29uZmlnLnR5cGUgPT09ICdjbGF1ZGVhaS1wcm94eScpIHJldHVyblxuXG4gICAgaWYgKHNlcnZlci5jb25maWcpIHtcbiAgICAgIC8vIEZpcnN0IHJldm9rZSB0aGUgYXV0aGVudGljYXRpb24gdG9rZW5zIGFuZCBjbGVhciBhbGwgYXV0aCBzdGF0ZVxuICAgICAgYXdhaXQgcmV2b2tlU2VydmVyVG9rZW5zKHNlcnZlci5uYW1lLCBzZXJ2ZXIuY29uZmlnKVxuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X21jcF9hdXRoX2NvbmZpZ19jbGVhcicsIHt9KVxuXG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBjbGllbnQgYW5kIGNsZWFyIHRoZSBjYWNoZVxuICAgICAgYXdhaXQgY2xlYXJTZXJ2ZXJDYWNoZShzZXJ2ZXIubmFtZSwge1xuICAgICAgICAuLi5zZXJ2ZXIuY29uZmlnLFxuICAgICAgICBzY29wZTogc2VydmVyLnNjb3BlLFxuICAgICAgfSlcblxuICAgICAgLy8gVXBkYXRlIGFwcCBzdGF0ZSB0byByZW1vdmUgdGhlIGRpc2Nvbm5lY3RlZCBzZXJ2ZXIncyB0b29scywgY29tbWFuZHMsIGFuZCByZXNvdXJjZXNcbiAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICBjb25zdCBuZXdDbGllbnRzID0gcHJldi5tY3AuY2xpZW50cy5tYXAoYyA9PlxuICAgICAgICAgIC8vICdmYWlsZWQnIGlzIGEgbWlzbm9tZXIgaGVyZSwgYnV0IHdlIGRvbid0IHJlYWxseSBkaWZmZXJlbnRpYXRlIGJldHdlZW4gXCJub3QgY29ubmVjdGVkXCIgYW5kIFwiZmFpbGVkXCIgYXQgdGhlIG1vbWVudFxuICAgICAgICAgIGMubmFtZSA9PT0gc2VydmVyLm5hbWUgPyB7IC4uLmMsIHR5cGU6ICdmYWlsZWQnIGFzIGNvbnN0IH0gOiBjLFxuICAgICAgICApXG4gICAgICAgIGNvbnN0IG5ld1Rvb2xzID0gZXhjbHVkZVRvb2xzQnlTZXJ2ZXIocHJldi5tY3AudG9vbHMsIHNlcnZlci5uYW1lKVxuICAgICAgICBjb25zdCBuZXdDb21tYW5kcyA9IGV4Y2x1ZGVDb21tYW5kc0J5U2VydmVyKFxuICAgICAgICAgIHByZXYubWNwLmNvbW1hbmRzLFxuICAgICAgICAgIHNlcnZlci5uYW1lLFxuICAgICAgICApXG4gICAgICAgIGNvbnN0IG5ld1Jlc291cmNlcyA9IGV4Y2x1ZGVSZXNvdXJjZXNCeVNlcnZlcihcbiAgICAgICAgICBwcmV2Lm1jcC5yZXNvdXJjZXMsXG4gICAgICAgICAgc2VydmVyLm5hbWUsXG4gICAgICAgIClcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgbWNwOiB7XG4gICAgICAgICAgICAuLi5wcmV2Lm1jcCxcbiAgICAgICAgICAgIGNsaWVudHM6IG5ld0NsaWVudHMsXG4gICAgICAgICAgICB0b29sczogbmV3VG9vbHMsXG4gICAgICAgICAgICBjb21tYW5kczogbmV3Q29tbWFuZHMsXG4gICAgICAgICAgICByZXNvdXJjZXM6IG5ld1Jlc291cmNlcyxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBvbkNvbXBsZXRlPy4oYEF1dGhlbnRpY2F0aW9uIGNsZWFyZWQgZm9yICR7c2VydmVyLm5hbWV9LmApXG4gICAgfVxuICB9XG5cbiAgaWYgKGlzQXV0aGVudGljYXRpbmcpIHtcbiAgICAvLyBYQUE6IHNpbGVudCBleGNoYW5nZSAoY2FjaGVkIGlkX3Rva2VuIOKGkiBubyBicm93c2VyKSwgc28gZG9uJ3QgY2xhaW1cbiAgICAvLyBvbmUgd2lsbCBvcGVuLiBJZiBJZFAgbG9naW4gSVMgbmVlZGVkLCBhdXRob3JpemF0aW9uVXJsIHBvcHVsYXRlcyBhbmRcbiAgICAvLyB0aGUgVVJMIGZhbGxiYWNrIGJsb2NrIGJlbG93IHN0aWxsIHJlbmRlcnMuXG4gICAgY29uc3QgYXV0aENvcHkgPVxuICAgICAgc2VydmVyLmNvbmZpZy50eXBlICE9PSAnY2xhdWRlYWktcHJveHknICYmIHNlcnZlci5jb25maWcub2F1dGg/LnhhYVxuICAgICAgICA/ICcgQXV0aGVudGljYXRpbmcgdmlhIHlvdXIgaWRlbnRpdHkgcHJvdmlkZXInXG4gICAgICAgIDogJyBBIGJyb3dzZXIgd2luZG93IHdpbGwgb3BlbiBmb3IgYXV0aGVudGljYXRpb24nXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MX0gcGFkZGluZz17MX0+XG4gICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCI+QXV0aGVudGljYXRpbmcgd2l0aCB7c2VydmVyLm5hbWV94oCmPC9UZXh0PlxuICAgICAgICA8Qm94PlxuICAgICAgICAgIDxTcGlubmVyIC8+XG4gICAgICAgICAgPFRleHQ+e2F1dGhDb3B5fTwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIHthdXRob3JpemF0aW9uVXJsICYmIChcbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgIDxCb3g+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgIElmIHlvdXIgYnJvd3NlciBkb2VzbiZhcG9zO3Qgb3BlbiBhdXRvbWF0aWNhbGx5LCBjb3B5IHRoaXMgVVJMXG4gICAgICAgICAgICAgICAgbWFudWFsbHl7JyAnfVxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIHt1cmxDb3BpZWQgPyAoXG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWNjZXNzXCI+KENvcGllZCEpPC9UZXh0PlxuICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiY1wiIGFjdGlvbj1cImNvcHlcIiBwYXJlbnMgLz5cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgIDxMaW5rIHVybD17YXV0aG9yaXphdGlvblVybH0gLz5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgICAge2lzQXV0aGVudGljYXRpbmcgJiYgYXV0aG9yaXphdGlvblVybCAmJiBtYW51YWxDYWxsYmFja1N1Ym1pdCAmJiAoXG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICBJZiB0aGUgcmVkaXJlY3QgcGFnZSBzaG93cyBhIGNvbm5lY3Rpb24gZXJyb3IsIHBhc3RlIHRoZSBVUkwgZnJvbVxuICAgICAgICAgICAgICB5b3VyIGJyb3dzZXImYXBvcztzIGFkZHJlc3MgYmFyOlxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+VVJMIHsnPid9IDwvVGV4dD5cbiAgICAgICAgICAgICAgPFRleHRJbnB1dFxuICAgICAgICAgICAgICAgIHZhbHVlPXtjYWxsYmFja1VybElucHV0fVxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtzZXRDYWxsYmFja1VybElucHV0fVxuICAgICAgICAgICAgICAgIG9uU3VibWl0PXsodmFsdWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgbWFudWFsQ2FsbGJhY2tTdWJtaXQodmFsdWUudHJpbSgpKVxuICAgICAgICAgICAgICAgICAgc2V0Q2FsbGJhY2tVcmxJbnB1dCgnJylcbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgIGN1cnNvck9mZnNldD17Y2FsbGJhY2tVcmxDdXJzb3JPZmZzZXR9XG4gICAgICAgICAgICAgICAgb25DaGFuZ2VDdXJzb3JPZmZzZXQ9e3NldENhbGxiYWNrVXJsQ3Vyc29yT2Zmc2V0fVxuICAgICAgICAgICAgICAgIGNvbHVtbnM9e3Rlcm1pbmFsQ29sdW1ucyAtIDh9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cbiAgICAgICAgPEJveCBtYXJnaW5MZWZ0PXszfT5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgIFJldHVybiBoZXJlIGFmdGVyIGF1dGhlbnRpY2F0aW5nIGluIHlvdXIgYnJvd3Nlci4gUHJlc3MgRXNjIHRvIGdvXG4gICAgICAgICAgICBiYWNrLlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICBpZiAoaXNDbGF1ZGVBSUF1dGhlbnRpY2F0aW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MX0gcGFkZGluZz17MX0+XG4gICAgICAgIDxUZXh0IGNvbG9yPVwiY2xhdWRlXCI+QXV0aGVudGljYXRpbmcgd2l0aCB7c2VydmVyLm5hbWV94oCmPC9UZXh0PlxuICAgICAgICA8Qm94PlxuICAgICAgICAgIDxTcGlubmVyIC8+XG4gICAgICAgICAgPFRleHQ+IEEgYnJvd3NlciB3aW5kb3cgd2lsbCBvcGVuIGZvciBhdXRoZW50aWNhdGlvbjwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIHtjbGF1ZGVBSUF1dGhVcmwgJiYgKFxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgSWYgeW91ciBicm93c2VyIGRvZXNuJmFwb3M7dCBvcGVuIGF1dG9tYXRpY2FsbHksIGNvcHkgdGhpcyBVUkxcbiAgICAgICAgICAgICAgICBtYW51YWxseXsnICd9XG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAge3VybENvcGllZCA/IChcbiAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1Y2Nlc3NcIj4oQ29waWVkISk8L1RleHQ+XG4gICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJjXCIgYWN0aW9uPVwiY29weVwiIHBhcmVucyAvPlxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgPExpbmsgdXJsPXtjbGF1ZGVBSUF1dGhVcmx9IC8+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG4gICAgICAgIDxCb3ggbWFyZ2luTGVmdD17M30gZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxUZXh0IGNvbG9yPVwicGVybWlzc2lvblwiPlxuICAgICAgICAgICAgUHJlc3MgPFRleHQgYm9sZD5FbnRlcjwvVGV4dD4gYWZ0ZXIgYXV0aGVudGljYXRpbmcgaW4geW91ciBicm93c2VyLlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgIGFjdGlvbj1cImNvbmZpcm06bm9cIlxuICAgICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbj1cImJhY2tcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgaWYgKGlzQ2xhdWRlQUlDbGVhcmluZ0F1dGgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXsxfSBwYWRkaW5nPXsxfT5cbiAgICAgICAgPFRleHQgY29sb3I9XCJjbGF1ZGVcIj5DbGVhciBhdXRoZW50aWNhdGlvbiBmb3Ige3NlcnZlci5uYW1lfTwvVGV4dD5cbiAgICAgICAge2NsYXVkZUFJQ2xlYXJBdXRoQnJvd3Nlck9wZW5lZCA/IChcbiAgICAgICAgICA8PlxuICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgIEZpbmQgdGhlIE1DUCBzZXJ2ZXIgaW4gdGhlIGJyb3dzZXIgYW5kIGNsaWNrXG4gICAgICAgICAgICAgICZxdW90O0Rpc2Nvbm5lY3QmcXVvdDsuXG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICB7Y2xhdWRlQUlDbGVhckF1dGhVcmwgJiYgKFxuICAgICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgIElmIHlvdXIgYnJvd3NlciBkaWRuJmFwb3M7dCBvcGVuIGF1dG9tYXRpY2FsbHksIGNvcHkgdGhpc1xuICAgICAgICAgICAgICAgICAgICBVUkwgbWFudWFsbHl7JyAnfVxuICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAge3VybENvcGllZCA/IChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWNjZXNzXCI+KENvcGllZCEpPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwiY1wiIGFjdGlvbj1cImNvcHlcIiBwYXJlbnMgLz5cbiAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgICA8TGluayB1cmw9e2NsYXVkZUFJQ2xlYXJBdXRoVXJsfSAvPlxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8Qm94IG1hcmdpbkxlZnQ9ezN9IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJwZXJtaXNzaW9uXCI+XG4gICAgICAgICAgICAgICAgUHJlc3MgPFRleHQgYm9sZD5FbnRlcjwvVGV4dD4gd2hlbiBkb25lLlxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJiYWNrXCJcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8Lz5cbiAgICAgICAgKSA6IChcbiAgICAgICAgICA8PlxuICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgIFRoaXMgd2lsbCBvcGVuIGNsYXVkZS5haSBpbiB0aGUgYnJvd3Nlci4gRmluZCB0aGUgTUNQIHNlcnZlciBpblxuICAgICAgICAgICAgICB0aGUgbGlzdCBhbmQgY2xpY2sgJnF1b3Q7RGlzY29ubmVjdCZxdW90Oy5cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDxCb3ggbWFyZ2luTGVmdD17M30gZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cInBlcm1pc3Npb25cIj5cbiAgICAgICAgICAgICAgICBQcmVzcyA8VGV4dCBib2xkPkVudGVyPC9UZXh0PiB0byBvcGVuIHRoZSBicm93c2VyLlxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgICAgICA8Q29uZmlndXJhYmxlU2hvcnRjdXRIaW50XG4gICAgICAgICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgICAgICAgIGNvbnRleHQ9XCJDb25maXJtYXRpb25cIlxuICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJFc2NcIlxuICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJiYWNrXCJcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8Lz5cbiAgICAgICAgKX1cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIGlmIChpc1JlY29ubmVjdGluZykge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBnYXA9ezF9IHBhZGRpbmc9ezF9PlxuICAgICAgICA8VGV4dCBjb2xvcj1cInRleHRcIj5cbiAgICAgICAgICBDb25uZWN0aW5nIHRvIDxUZXh0IGJvbGQ+e3NlcnZlci5uYW1lfTwvVGV4dD7igKZcbiAgICAgICAgPC9UZXh0PlxuICAgICAgICA8Qm94PlxuICAgICAgICAgIDxTcGlubmVyIC8+XG4gICAgICAgICAgPFRleHQ+IEVzdGFibGlzaGluZyBjb25uZWN0aW9uIHRvIE1DUCBzZXJ2ZXI8L1RleHQ+XG4gICAgICAgIDwvQm94PlxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5UaGlzIG1heSB0YWtlIGEgZmV3IG1vbWVudHMuPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgY29uc3QgbWVudU9wdGlvbnMgPSBbXVxuXG4gIC8vIElmIHNlcnZlciBpcyBkaXNhYmxlZCwgc2hvdyBFbmFibGUgZmlyc3QgYXMgdGhlIHByaW1hcnkgYWN0aW9uXG4gIGlmIChzZXJ2ZXIuY2xpZW50LnR5cGUgPT09ICdkaXNhYmxlZCcpIHtcbiAgICBtZW51T3B0aW9ucy5wdXNoKHtcbiAgICAgIGxhYmVsOiAnRW5hYmxlJyxcbiAgICAgIHZhbHVlOiAndG9nZ2xlLWVuYWJsZWQnLFxuICAgIH0pXG4gIH1cblxuICBpZiAoc2VydmVyLmNsaWVudC50eXBlID09PSAnY29ubmVjdGVkJyAmJiBzZXJ2ZXJUb29sc0NvdW50ID4gMCkge1xuICAgIG1lbnVPcHRpb25zLnB1c2goe1xuICAgICAgbGFiZWw6ICdWaWV3IHRvb2xzJyxcbiAgICAgIHZhbHVlOiAndG9vbHMnLFxuICAgIH0pXG4gIH1cblxuICBpZiAoc2VydmVyLmNvbmZpZy50eXBlID09PSAnY2xhdWRlYWktcHJveHknKSB7XG4gICAgaWYgKHNlcnZlci5jbGllbnQudHlwZSA9PT0gJ2Nvbm5lY3RlZCcpIHtcbiAgICAgIG1lbnVPcHRpb25zLnB1c2goe1xuICAgICAgICBsYWJlbDogJ0NsZWFyIGF1dGhlbnRpY2F0aW9uJyxcbiAgICAgICAgdmFsdWU6ICdjbGF1ZGVhaS1jbGVhci1hdXRoJyxcbiAgICAgIH0pXG4gICAgfSBlbHNlIGlmIChzZXJ2ZXIuY2xpZW50LnR5cGUgIT09ICdkaXNhYmxlZCcpIHtcbiAgICAgIG1lbnVPcHRpb25zLnB1c2goe1xuICAgICAgICBsYWJlbDogJ0F1dGhlbnRpY2F0ZScsXG4gICAgICAgIHZhbHVlOiAnY2xhdWRlYWktYXV0aCcsXG4gICAgICB9KVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoaXNFZmZlY3RpdmVseUF1dGhlbnRpY2F0ZWQpIHtcbiAgICAgIG1lbnVPcHRpb25zLnB1c2goe1xuICAgICAgICBsYWJlbDogJ1JlLWF1dGhlbnRpY2F0ZScsXG4gICAgICAgIHZhbHVlOiAncmVhdXRoJyxcbiAgICAgIH0pXG4gICAgICBtZW51T3B0aW9ucy5wdXNoKHtcbiAgICAgICAgbGFiZWw6ICdDbGVhciBhdXRoZW50aWNhdGlvbicsXG4gICAgICAgIHZhbHVlOiAnY2xlYXItYXV0aCcsXG4gICAgICB9KVxuICAgIH1cblxuICAgIGlmICghaXNFZmZlY3RpdmVseUF1dGhlbnRpY2F0ZWQpIHtcbiAgICAgIG1lbnVPcHRpb25zLnB1c2goe1xuICAgICAgICBsYWJlbDogJ0F1dGhlbnRpY2F0ZScsXG4gICAgICAgIHZhbHVlOiAnYXV0aCcsXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIGlmIChzZXJ2ZXIuY2xpZW50LnR5cGUgIT09ICdkaXNhYmxlZCcpIHtcbiAgICBpZiAoc2VydmVyLmNsaWVudC50eXBlICE9PSAnbmVlZHMtYXV0aCcpIHtcbiAgICAgIG1lbnVPcHRpb25zLnB1c2goe1xuICAgICAgICBsYWJlbDogJ1JlY29ubmVjdCcsXG4gICAgICAgIHZhbHVlOiAncmVjb25uZWN0TWNwU2VydmVyJyxcbiAgICAgIH0pXG4gICAgfVxuICAgIG1lbnVPcHRpb25zLnB1c2goe1xuICAgICAgbGFiZWw6ICdEaXNhYmxlJyxcbiAgICAgIHZhbHVlOiAndG9nZ2xlLWVuYWJsZWQnLFxuICAgIH0pXG4gIH1cblxuICAvLyBJZiB0aGVyZSBhcmUgbm8gb3RoZXIgb3B0aW9ucywgYWRkIGEgYmFjayBvcHRpb24gc28gU2VsZWN0IGhhbmRsZXMgZXNjYXBlXG4gIGlmIChtZW51T3B0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICBtZW51T3B0aW9ucy5wdXNoKHtcbiAgICAgIGxhYmVsOiAnQmFjaycsXG4gICAgICB2YWx1ZTogJ2JhY2snLFxuICAgIH0pXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgPEJveFxuICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgcGFkZGluZ1g9ezF9XG4gICAgICAgIGJvcmRlclN0eWxlPXtib3JkZXJsZXNzID8gdW5kZWZpbmVkIDogJ3JvdW5kJ31cbiAgICAgID5cbiAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgIDxUZXh0IGJvbGQ+e2NhcGl0YWxpemVkU2VydmVyTmFtZX0gTUNQIFNlcnZlcjwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCIgZ2FwPXswfT5cbiAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5TdGF0dXM6IDwvVGV4dD5cbiAgICAgICAgICAgIHtzZXJ2ZXIuY2xpZW50LnR5cGUgPT09ICdkaXNhYmxlZCcgPyAoXG4gICAgICAgICAgICAgIDxUZXh0Pntjb2xvcignaW5hY3RpdmUnLCB0aGVtZSkoZmlndXJlcy5yYWRpb09mZil9IGRpc2FibGVkPC9UZXh0PlxuICAgICAgICAgICAgKSA6IHNlcnZlci5jbGllbnQudHlwZSA9PT0gJ2Nvbm5lY3RlZCcgPyAoXG4gICAgICAgICAgICAgIDxUZXh0Pntjb2xvcignc3VjY2VzcycsIHRoZW1lKShmaWd1cmVzLnRpY2spfSBjb25uZWN0ZWQ8L1RleHQ+XG4gICAgICAgICAgICApIDogc2VydmVyLmNsaWVudC50eXBlID09PSAncGVuZGluZycgPyAoXG4gICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+e2ZpZ3VyZXMucmFkaW9PZmZ9PC9UZXh0PlxuICAgICAgICAgICAgICAgIDxUZXh0PiBjb25uZWN0aW5n4oCmPC9UZXh0PlxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICkgOiBzZXJ2ZXIuY2xpZW50LnR5cGUgPT09ICduZWVkcy1hdXRoJyA/IChcbiAgICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgICAge2NvbG9yKCd3YXJuaW5nJywgdGhlbWUpKGZpZ3VyZXMudHJpYW5nbGVVcE91dGxpbmUpfSBuZWVkc1xuICAgICAgICAgICAgICAgIGF1dGhlbnRpY2F0aW9uXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDxUZXh0Pntjb2xvcignZXJyb3InLCB0aGVtZSkoZmlndXJlcy5jcm9zcyl9IGZhaWxlZDwvVGV4dD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgICB7c2VydmVyLnRyYW5zcG9ydCAhPT0gJ2NsYXVkZWFpLXByb3h5JyAmJiAoXG4gICAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgICA8VGV4dCBib2xkPkF1dGg6IDwvVGV4dD5cbiAgICAgICAgICAgICAge2lzRWZmZWN0aXZlbHlBdXRoZW50aWNhdGVkID8gKFxuICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAge2NvbG9yKCdzdWNjZXNzJywgdGhlbWUpKGZpZ3VyZXMudGljayl9IGF1dGhlbnRpY2F0ZWRcbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICAgICAgICB7Y29sb3IoJ2Vycm9yJywgdGhlbWUpKGZpZ3VyZXMuY3Jvc3MpfSBub3QgYXV0aGVudGljYXRlZFxuICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICl9XG5cbiAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5VUkw6IDwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntzZXJ2ZXIuY29uZmlnLnVybH08L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG5cbiAgICAgICAgICA8Qm94PlxuICAgICAgICAgICAgPFRleHQgYm9sZD5Db25maWcgbG9jYXRpb246IDwvVGV4dD5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntkZXNjcmliZU1jcENvbmZpZ0ZpbGVQYXRoKHNlcnZlci5zY29wZSl9PC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuXG4gICAgICAgICAge3NlcnZlci5jbGllbnQudHlwZSA9PT0gJ2Nvbm5lY3RlZCcgJiYgKFxuICAgICAgICAgICAgPENhcGFiaWxpdGllc1NlY3Rpb25cbiAgICAgICAgICAgICAgc2VydmVyVG9vbHNDb3VudD17c2VydmVyVG9vbHNDb3VudH1cbiAgICAgICAgICAgICAgc2VydmVyUHJvbXB0c0NvdW50PXtzZXJ2ZXJDb21tYW5kc0NvdW50fVxuICAgICAgICAgICAgICBzZXJ2ZXJSZXNvdXJjZXNDb3VudD17bWNwLnJlc291cmNlc1tzZXJ2ZXIubmFtZV0/Lmxlbmd0aCB8fCAwfVxuICAgICAgICAgICAgLz5cbiAgICAgICAgICApfVxuXG4gICAgICAgICAge3NlcnZlci5jbGllbnQudHlwZSA9PT0gJ2Nvbm5lY3RlZCcgJiYgc2VydmVyVG9vbHNDb3VudCA+IDAgJiYgKFxuICAgICAgICAgICAgPEJveD5cbiAgICAgICAgICAgICAgPFRleHQgYm9sZD5Ub29sczogPC9UZXh0PlxuICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj57c2VydmVyVG9vbHNDb3VudH0gdG9vbHM8L1RleHQ+XG4gICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICApfVxuICAgICAgICA8L0JveD5cblxuICAgICAgICB7ZXJyb3IgJiYgKFxuICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwiZXJyb3JcIj5FcnJvcjoge2Vycm9yfTwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgKX1cblxuICAgICAgICB7bWVudU9wdGlvbnMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPFNlbGVjdFxuICAgICAgICAgICAgICBvcHRpb25zPXttZW51T3B0aW9uc31cbiAgICAgICAgICAgICAgb25DaGFuZ2U9e2FzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICBjYXNlICd0b29scyc6XG4gICAgICAgICAgICAgICAgICAgIG9uVmlld1Rvb2xzKClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ2F1dGgnOlxuICAgICAgICAgICAgICAgICAgY2FzZSAncmVhdXRoJzpcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgaGFuZGxlQXV0aGVudGljYXRlKClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICAgIGNhc2UgJ2NsZWFyLWF1dGgnOlxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBoYW5kbGVDbGVhckF1dGgoKVxuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgICAgY2FzZSAnY2xhdWRlYWktYXV0aCc6XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGhhbmRsZUNsYXVkZUFJQXV0aCgpXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgICBjYXNlICdjbGF1ZGVhaS1jbGVhci1hdXRoJzpcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlQ2xhdWRlQUlDbGVhckF1dGgoKVxuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgICAgY2FzZSAncmVjb25uZWN0TWNwU2VydmVyJzpcbiAgICAgICAgICAgICAgICAgICAgc2V0SXNSZWNvbm5lY3RpbmcodHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZWNvbm5lY3RNY3BTZXJ2ZXIoc2VydmVyLm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHNlcnZlci5jb25maWcudHlwZSA9PT0gJ2NsYXVkZWFpLXByb3h5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2NsYXVkZWFpX21jcF9yZWNvbm5lY3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHJlc3VsdC5jbGllbnQudHlwZSA9PT0gJ2Nvbm5lY3RlZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IG1lc3NhZ2UgfSA9IGhhbmRsZVJlY29ubmVjdFJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlci5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICBvbkNvbXBsZXRlPy4obWVzc2FnZSlcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHNlcnZlci5jb25maWcudHlwZSA9PT0gJ2NsYXVkZWFpLXByb3h5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2NsYXVkZWFpX21jcF9yZWNvbm5lY3QnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgb25Db21wbGV0ZT8uKGhhbmRsZVJlY29ubmVjdEVycm9yKGVyciwgc2VydmVyLm5hbWUpKVxuICAgICAgICAgICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICAgICAgICAgIHNldElzUmVjb25uZWN0aW5nKGZhbHNlKVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgICBjYXNlICd0b2dnbGUtZW5hYmxlZCc6XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGhhbmRsZVRvZ2dsZUVuYWJsZWQoKVxuICAgICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgICAgY2FzZSAnYmFjayc6XG4gICAgICAgICAgICAgICAgICAgIG9uQ2FuY2VsKClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgIG9uQ2FuY2VsPXtvbkNhbmNlbH1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG4gICAgICA8L0JveD5cblxuICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAge2V4aXRTdGF0ZS5wZW5kaW5nID8gKFxuICAgICAgICAgICAgPD5QcmVzcyB7ZXhpdFN0YXRlLmtleU5hbWV9IGFnYWluIHRvIGV4aXQ8Lz5cbiAgICAgICAgICApIDogKFxuICAgICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgICAgPEtleWJvYXJkU2hvcnRjdXRIaW50IHNob3J0Y3V0PVwi4oaR4oaTXCIgYWN0aW9uPVwibmF2aWdhdGVcIiAvPlxuICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCJFbnRlclwiIGFjdGlvbj1cInNlbGVjdFwiIC8+XG4gICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICBhY3Rpb249XCJjb25maXJtOm5vXCJcbiAgICAgICAgICAgICAgICBjb250ZXh0PVwiQ29uZmlybWF0aW9uXCJcbiAgICAgICAgICAgICAgICBmYWxsYmFjaz1cIkVzY1wiXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJiYWNrXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvQnlsaW5lPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIDwvQm94PlxuICApXG59XG4iXSwibWFwcGluZ3MiOiJBQUFBLE9BQU9BLE9BQU8sTUFBTSxTQUFTO0FB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