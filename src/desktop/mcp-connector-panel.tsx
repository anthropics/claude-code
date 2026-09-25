// src/desktop/mcp-connector-panel.tsx
import React, { useState, useEffect } from "react";
import { MCPSessionManager, MCPSession } from "../core/mcp/session-manager";

export interface MCPConnectorPanelProps {
  configDir: string;
  onReload?: () => void;
}

interface ConnectorStatus {
  id: string;
  name: string;
  connected: boolean;
  healthy: boolean;
  expiresAt?: number;
  error?: string;
}

export const MCPConnectorPanel: React.FC<MCPConnectorPanelProps> = ({
  configDir,
  onReload,
}) => {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [reAuthingId, setReAuthingId] = useState<string | null>(null);

  useEffect(() => {
    loadConnectorStatus();
  }, [configDir]);

  const loadConnectorStatus = async () => {
    try {
      const manager = new MCPSessionManager(configDir);
      const sessions = manager.getSessions();
      const credStore = manager.getCredentialStore();

      const status: ConnectorStatus[] = [];

      for (const [id, session] of sessions) {
        const credentialIds = credStore.listCredentials();
        const hasCredential = credentialIds.includes(id);
        const isValid = credStore.isCredentialValid(id);

        const cred = await credStore.getCredential(id);

        status.push({
          id: id,
          name: session.config.name,
          connected: session.isHealthy,
          healthy: isValid && hasCredential,
          expiresAt: cred?.expiresAt,
          error: session.isHealthy ? undefined : "Connection failed",
        });
      }

      setConnectors(status);
    } catch (error) {
      console.error("[MCP UI] Failed to load connector status:", error);
    }
  };

  const handleReauthenticate = async (connectorId: string) => {
    setReAuthingId(connectorId);
    try {
      const manager = new MCPSessionManager(configDir);
      const credStore = manager.getCredentialStore();

      // Clear stored credential
      await credStore.deleteCredential(connectorId);

      console.log(`[MCP UI] Cleared credentials for ${connectorId}`);

      // Reload status
      await loadConnectorStatus();

      if (onReload) {
        onReload();
      }
    } catch (error) {
      console.error(
        `[MCP UI] Re-authentication failed for ${connectorId}:`,
        error
      );
    } finally {
      setReAuthingId(null);
    }
  };

  const handleClearCredential = async (connectorId: string) => {
    if (!confirm(`Clear credentials for ${connectorId}?`)) {
      return;
    }

    try {
      const manager = new MCPSessionManager(configDir);
      await manager.getCredentialStore().deleteCredential(connectorId);
      await loadConnectorStatus();
    } catch (error) {
      console.error(`[MCP UI] Failed to clear credentials:`, error);
    }
  };

  return (
    <div className="mcp-connector-panel">
      <div className="panel-header">
        <h2>MCP Connectors</h2>
        <button
          className="refresh-btn"
          onClick={loadConnectorStatus}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {connectors.length === 0 ? (
        <div className="empty-state">
          <p>No MCP connectors configured</p>
        </div>
      ) : (
        <div className="connectors-list">
          {connectors.map((connector) => (
            <div
              key={connector.id}
              className={`connector-item ${connector.healthy ? "healthy" : "unhealthy"}`}
            >
              <div className="connector-header">
                <div className="connector-info">
                  <h3>{connector.name}</h3>
                  <span className={`status-badge ${connector.healthy ? "connected" : "disconnected"}`}>
                    {connector.healthy ? (
                      <>
                        <span className="status-dot">●</span>
                        Connected
                      </>
                    ) : (
                      <>
                        <span className="status-dot">○</span>
                        Disconnected
                      </>
                    )}
                  </span>
                </div>

                {connector.error && (
                  <div className="error-message">{connector.error}</div>
                )}
              </div>

              {connector.expiresAt && (
                <div className="connector-expiry">
                  <small>
                    Token expires:{" "}
                    {new Date(connector.expiresAt).toLocaleString()}
                  </small>
                </div>
              )}

              <div className="connector-actions">
                {!connector.healthy && (
                  <button
                    className="btn-primary"
                    onClick={() => handleReauthenticate(connector.id)}
                    disabled={reAuthingId === connector.id}
                  >
                    {reAuthingId === connector.id
                      ? "Re-authenticating..."
                      : "Re-authenticate"}
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => handleClearCredential(connector.id)}
                >
                  Clear Credentials
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .mcp-connector-panel {
          padding: 16px;
          background: var(--vscode-editor-background);
          color: var(--vscode-editor-foreground);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .refresh-btn {
          padding: 6px 12px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 2px;
          cursor: pointer;
          font-size: 12px;
        }

        .refresh-btn:hover:not(:disabled) {
          background: var(--vscode-button-hoverBackground);
        }

        .refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .empty-state {
          padding: 24px;
          text-align: center;
          color: var(--vscode-descriptionForeground);
        }

        .connectors-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .connector-item {
          border: 1px solid var(--vscode-widget-border);
          border-radius: 4px;
          padding: 12px;
          background: var(--vscode-input-background);
        }

        .connector-item.healthy {
          border-left: 3px solid #4ec9b0;
        }

        .connector-item.unhealthy {
          border-left: 3px solid #f48771;
        }

        .connector-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }

        .connector-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .connector-info h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 2px;
          width: fit-content;
        }

        .status-badge.connected {
          background: rgba(78, 201, 176, 0.1);
          color: #4ec9b0;
        }

        .status-badge.disconnected {
          background: rgba(244, 135, 113, 0.1);
          color: #f48771;
        }

        .status-dot {
          font-size: 10px;
        }

        .error-message {
          font-size: 12px;
          color: #f48771;
          padding: 6px;
          background: rgba(244, 135, 113, 0.05);
          border-radius: 2px;
        }

        .connector-expiry {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          margin-bottom: 8px;
          padding: 4px 0;
        }

        .connector-actions {
          display: flex;
          gap: 8px;
        }

        .btn-primary,
        .btn-secondary {
          padding: 6px 12px;
          border: none;
          border-radius: 2px;
          cursor: pointer;
          font-size: 12px;
          transition: background-color 0.2s;
        }

        .btn-primary {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
          background: var(--vscode-secondaryButton-background);
          color: var(--vscode-secondaryButton-foreground);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--vscode-secondaryButton-hoverBackground);
        }

        .btn-primary:disabled,
        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};