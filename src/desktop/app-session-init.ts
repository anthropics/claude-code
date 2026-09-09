// src/desktop/app-session-init.ts
import * as fs from "fs";
import * as path from "path";
import { MCPSessionManager, MCPServerConfig } from "../core/mcp/session-manager";

interface AppSessionConfig {
  sessionId: string;
  configDir: string;
  mcpConfigPath?: string;
}

/**
 * Initialize app session with MCP credential restoration
 */
export async function initializeAppSession(
  config: AppSessionConfig
): Promise<void> {
  const {
    sessionId,
    configDir,
    mcpConfigPath = path.join(configDir, "mcp.json"),
  } = config;

  console.log(`[Desktop] Initializing session ${sessionId}...`);

  const sessionManager = new MCPSessionManager(configDir);

  // Load MCP server configuration
  let mcpConfig: { servers?: MCPServerConfig[] } = {};
  if (fs.existsSync(mcpConfigPath)) {
    try {
      mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
    } catch (error) {
      console.error(`[Desktop] Failed to parse MCP config:`, error);
    }
  }

  // Initialize all configured MCP servers with credential restoration
  const servers = mcpConfig.servers || [];
  const initResults = {
    success: [] as string[],
    failed: [] as { name: string; error: string }[],
  };

  for (const serverConfig of servers) {
    try {
      console.log(`[Desktop] Initializing MCP: ${serverConfig.name}...`);
      const session = await sessionManager.initializeMCPServer(serverConfig);

      console.log(
        `[Desktop] ✓ ${serverConfig.name} initialized (${session.isHealthy ? "healthy" : "unhealthy"})`
      );
      initResults.success.push(serverConfig.name);
    } catch (error) {
      console.warn(
        `[Desktop] ✗ Failed to initialize ${serverConfig.name}: ${error}`
      );
      initResults.failed.push({
        name: serverConfig.name,
        error: String(error),
      });
      // Don't block session startup if individual MCP init fails
    }
  }

  // Log summary
  console.log(
    `[Desktop] MCP initialization complete: ${initResults.success.length} succeeded, ${initResults.failed.length} failed`
  );

  if (initResults.failed.length > 0) {
    console.warn(
      `[Desktop] Failed MCPs:`,
      initResults.failed.map((f) => `${f.name}: ${f.error}`).join("; ")
    );
  }

  // Store session manager reference globally for later use
  storeActiveSessionManager(sessionId, sessionManager);
}

/**
 * Global session manager registry
 */
const sessionManagers = new Map<string, MCPSessionManager>();

function storeActiveSessionManager(
  sessionId: string,
  manager: MCPSessionManager
): void {
  sessionManagers.set(sessionId, manager);
}

export function getActiveSessionManager(
  sessionId: string
): MCPSessionManager | undefined {
  return sessionManagers.get(sessionId);
}

export function clearSessionManager(sessionId: string): void {
  sessionManagers.delete(sessionId);
}