// src/core/mcp/session-manager.ts
import { MCPCredentialStore, MCPCredential } from "./credential-store";

export interface MCPServerConfig {
  id?: string;
  name: string;
  url: string;
  type: "http" | "stdio";
  headers?: Record<string, string>;
}

export interface MCPSession {
  id: string;
  config: MCPServerConfig;
  credential?: MCPCredential;
  headers: Record<string, string>;
  createdAt: Date;
  lastUsedAt: Date;
  isHealthy: boolean;
}

export class MCPSessionManager {
  private credentialStore: MCPCredentialStore;
  private sessions: Map<string, MCPSession> = new Map();
  private configDir: string;

  constructor(configDir: string) {
    this.configDir = configDir;
    this.credentialStore = new MCPCredentialStore(configDir);
  }

  /**
   * Initialize MCP server session with credential restoration
   */
  async initializeMCPServer(config: MCPServerConfig): Promise<MCPSession> {
    const serverId = config.id || config.name;

    console.log(
      `[MCP] Initializing ${serverId}... (checking credential store)`
    );

    // Check if credentials exist in secure storage
    if (config.type === "http") {
      const storedCredential =
        await this.credentialStore.getCredential(serverId);

      if (
        storedCredential &&
        this.credentialStore.isCredentialValid(serverId)
      ) {
        console.log(
          `[MCP] ✓ Restored credentials for ${serverId} from secure storage`
        );
        return this.createSessionWithCredential(config, storedCredential);
      }

      if (storedCredential && !this.credentialStore.isCredentialValid(serverId)) {
        console.log(`[MCP] ⟳ Credential expired for ${serverId}, attempting refresh...`);
        const refreshed = await this.refreshToken(serverId);
        if (refreshed) {
          const newCredential = await this.credentialStore.getCredential(
            serverId
          );
          if (newCredential) {
            return this.createSessionWithCredential(config, newCredential);
          }
        }
        console.log(`[MCP] ✗ Token refresh failed for ${serverId}`);
      }
    }

    // No stored credential or refresh failed, proceed with normal OAuth flow
    console.log(`[MCP] No valid credentials for ${serverId}, initiating OAuth flow`);
    return this.initializeOAuthFlow(config);
  }

  /**
   * Create session using stored credential
   */
  private async createSessionWithCredential(
    config: MCPServerConfig,
    credential: MCPCredential
  ): Promise<MCPSession> {
    const session: MCPSession = {
      id: config.id || config.name,
      config: config,
      credential: credential,
      headers: this.buildHeaders(config, credential),
      createdAt: new Date(),
      lastUsedAt: new Date(),
      isHealthy: false,
    };

    // Test connection
    const isHealthy = await this.testMCPConnection(session);
    if (!isHealthy) {
      console.warn(
        `[MCP] ✗ Credential for ${config.name} is invalid or expired, clearing...`
      );
      await this.credentialStore.deleteCredential(config.id || config.name);
      throw new Error(
        `MCP connection test failed for ${config.name}. Please re-authenticate.`
      );
    }

    session.isHealthy = true;
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Initialize OAuth flow and persist credentials
   */
  private async initializeOAuthFlow(
    config: MCPServerConfig
  ): Promise<MCPSession> {
    console.log(`[MCP] Starting OAuth flow for ${config.name}...`);

    const credential = await this.performOAuthFlow(config);

    // Store credential securely
    await this.credentialStore.saveCredential({
      serverId: config.id || config.name,
      tokenType: "oauth",
      token: credential.accessToken,
      refreshToken: credential.refreshToken,
      expiresAt: credential.expiresAt,
      metadata: { serverName: config.name, createdAt: new Date().toISOString() },
    });

    console.log(`[MCP] ✓ OAuth successful for ${config.name}, credentials saved`);

    return this.createSessionWithCredential(
      config,
      await this.credentialStore.getCredential(config.id || config.name)!
    );
  }

  /**
   * Refresh expired token
   */
  async refreshToken(serverId: string): Promise<boolean> {
    const credential = await this.credentialStore.getCredential(serverId);
    if (!credential || !credential.refreshToken) {
      return false;
    }

    try {
      const newCredential = await this.performTokenRefresh(credential);
      await this.credentialStore.saveCredential(newCredential);
      return true;
    } catch (error) {
      console.error(`[MCP] Token refresh failed for ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Build authorization headers from credential
   */
  private buildHeaders(
    config: MCPServerConfig,
    credential: MCPCredential
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers, // Include any pre-configured headers
    };

    if (credential.tokenType === "bearer") {
      headers["Authorization"] = `Bearer ${credential.token}`;
    } else if (credential.tokenType === "basic") {
      headers["Authorization"] = `Basic ${credential.token}`;
    } else if (credential.tokenType === "oauth") {
      headers["Authorization"] = `Bearer ${credential.token}`;
    }

    return headers;
  }

  /**
   * Test MCP connection health
   */
  private async testMCPConnection(session: MCPSession): Promise<boolean> {
    try {
      if (session.config.type !== "http") {
        return true; // Skip test for stdio servers
      }

      const response = await fetch(session.config.url, {
        method: "POST",
        headers: session.headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: Math.random(),
        }),
        timeout: 5000,
      });

      if (!response.ok) {
        console.error(
          `[MCP] Connection test failed with status ${response.status}`
        );
        return false;
      }

      const data = await response.json();
      // If we get a valid JSON-RPC response, consider it healthy
      return data.result || data.error;
    } catch (error) {
      console.error(`[MCP] Connection test failed:`, error);
      return false;
    }
  }

  /**
   * Get all active sessions
   */
  getSessions(): Map<string, MCPSession> {
    return this.sessions;
  }

  /**
   * Get session by ID
   */
  getSession(id: string): MCPSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Update session last used time
   */
  updateSessionActivity(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastUsedAt = new Date();
    }
  }

  /**
   * Close session
   */
  async closeSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  /**
   * Get credential store (for UI access)
   */
  getCredentialStore(): MCPCredentialStore {
    return this.credentialStore;
  }

  // These methods should be implemented based on existing OAuth/token logic
  private async performOAuthFlow(config: MCPServerConfig): Promise<any> {
    throw new Error("performOAuthFlow must be implemented");
  }

  private async performTokenRefresh(credential: MCPCredential): Promise<any> {
    throw new Error("performTokenRefresh must be implemented");
  }
}