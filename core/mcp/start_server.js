#!/usr/bin/env node

/**
 * MCP Server Starter
 * =================
 * 
 * Starts the configured MCP servers for the Claude Neural Framework.
 * 
 * Usage:
 *   node start_server.js [server_name]
 *   
 * Options:
 *   server_name - Optional. If specified, only the specified server will be started.
 *                 Otherwise, all enabled servers will be started.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// Import standardized config manager
const configManager = require('../config/config_manager');
const { CONFIG_TYPES } = configManager;

// Import standardized logger
const logger = require('../logging/logger').createLogger('mcp-server-starter');

// Claude Desktop configuration path
const CLAUDE_DESKTOP_CONFIG_PATH = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');

/**
 * Get MCP server configuration
 * @returns {Object} Configuration
 */
function getConfig() {
  try {
    // Try using the config manager first
    try {
      return configManager.getConfig(CONFIG_TYPES.MCP);
    } catch (configErr) {
      // Fall back to direct file loading
      const MCP_CONFIG_PATH = path.resolve(__dirname, '../config/mcp_config.json');

      if (!fs.existsSync(MCP_CONFIG_PATH)) {
        throw new Error(`MCP configuration file not found at ${MCP_CONFIG_PATH}`);
      }

      const configData = fs.readFileSync(MCP_CONFIG_PATH, 'utf8');
      return JSON.parse(configData);
    }
  } catch (err) {
    logger.error('Failed to load MCP configuration', { error: err });
    process.exit(1);
  }
}

/**
 * Start an MCP server
 * @param {string} serverId - Server ID
 * @param {Object} serverConfig - Server configuration
 * @returns {Promise<boolean>} Success
 */
async function startServer(serverId, serverConfig) {
  logger.info('Starting MCP server', { serverId });
  
  if (!serverConfig.enabled) {
    logger.warn('Server is disabled', { serverId });
    return false;
  }
  
  if (!serverConfig.command || !serverConfig.args) {
    logger.error('Invalid server configuration - missing command or args', { serverId, serverConfig });
    return false;
  }
  
  try {
    // Check for API key if needed
    if (serverConfig.api_key_env) {
      const apiKey = process.env[serverConfig.api_key_env];
      if (!apiKey) {
        logger.warn('API key not found in environment variables', { 
          serverId, 
          envVar: serverConfig.api_key_env 
        });
      }
    }
    
    // Start server process
    const serverProcess = spawn(serverConfig.command, serverConfig.args, {
      stdio: 'inherit',
      shell: true
    });
    
    // Log server start
    logger.info('Server process started', { 
      serverId,
      pid: serverProcess.pid,
      command: `${serverConfig.command} ${serverConfig.args.join(' ')}`
    });
    
    // Handle process exit
    serverProcess.on('exit', (code, signal) => {
      if (code === 0) {
        logger.info('Server process exited normally', { serverId, code });
      } else {
        logger.warn('Server process exited with non-zero code', { 
          serverId, 
          code,
          signal
        });
      }
    });
    
    // Handle process error
    serverProcess.on('error', (err) => {
      logger.error('Server process error', { serverId, error: err });
    });
    
    return true;
  } catch (err) {
    logger.error('Failed to start server', { serverId, error: err });
    return false;
  }
}

/**
 * Update Claude Desktop configuration
 * @param {Object} config - MCP configuration
 */
function updateClaudeDesktopConfig(config) {
  try {
    logger.debug('Updating Claude Desktop configuration');
    
    // Create MCP server configuration for Claude Desktop
    const mcpServers = {};
    
    Object.entries(config.servers || {})
      .filter(([, serverConfig]) => serverConfig.enabled)
      .forEach(([serverId, serverConfig]) => {
        mcpServers[serverId] = {
          command: serverConfig.command,
          args: serverConfig.args
        };
      });
    
    // Create Claude Desktop configuration
    const desktopConfig = {
      mcpServers
    };
    
    // Check if Claude Desktop configuration directory exists
    const configDir = path.dirname(CLAUDE_DESKTOP_CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write Claude Desktop configuration
    fs.writeFileSync(CLAUDE_DESKTOP_CONFIG_PATH, JSON.stringify(desktopConfig, null, 2));
    
    logger.info('Claude Desktop configuration updated', { 
      path: CLAUDE_DESKTOP_CONFIG_PATH, 
      serverCount: Object.keys(mcpServers).length 
    });
  } catch (err) {
    logger.error('Failed to update Claude Desktop configuration', { error: err });
  }
}

/**
 * Main function
 */
async function main() {
  // Get configuration
  const config = getConfig();
  
  // Get server name from command line arguments
  const serverName = process.argv[2];
  
  // Update Claude Desktop configuration
  updateClaudeDesktopConfig(config);
  
  if (serverName) {
    // Start specific server
    logger.info('Starting specific MCP server', { serverName });
    
    const serverConfig = config.servers[serverName];
    if (!serverConfig) {
      logger.error('Server not found', { serverName });
      process.exit(1);
    }
    
    const success = await startServer(serverName, serverConfig);
    if (!success) {
      logger.error('Failed to start server', { serverName });
      process.exit(1);
    }
  } else {
    // Start all enabled auto-start servers
    logger.info('Starting all enabled auto-start MCP servers');
    
    const servers = Object.entries(config.servers || {})
      .filter(([, serverConfig]) => serverConfig.enabled && serverConfig.autostart);
    
    logger.debug('Found servers to start', { count: servers.length });
    
    // Start each server
    for (const [serverId, serverConfig] of servers) {
      await startServer(serverId, serverConfig);
    }
    
    logger.info('All servers started');
  }
}

// Run main function and handle errors
main().catch(err => {
  logger.fatal('Fatal error', { error: err });
  process.exit(1);
});