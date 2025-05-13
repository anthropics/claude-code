/**
 * Claude MCP Client API
 *
 * A user-friendly API for interacting with MCP servers.
 * This file provides functions for communicating with Claude through the Model Context Protocol.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { Anthropic } = require('@anthropic/sdk');

// Import standardized config manager
const configManager = require('../config/config_manager');
const { CONFIG_TYPES } = configManager;

// Import standardized logger
const logger = require('../logging/logger').createLogger('claude-mcp-client');

// Import internationalization
const { I18n } = require('../i18n/i18n');

/**
 * Class for communicating with Claude via the Model Context Protocol
 */
class ClaudeMcpClient {
  /**
   * Creates a new instance of ClaudeMcpClient
   * 
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    logger.debug('Initializing Claude MCP Client', { options });

    // Load configuration
    try {
      this.config = configManager.getConfig(CONFIG_TYPES.MCP);
      this.serverProcesses = new Map();
      this.anthropic = null;

      // Initialize i18n
      this.i18n = new I18n();

      // Initialize Anthropic client if API key is available
      this.initAnthropicClient();

      logger.info(this.i18n.translate('mcp.clientInitialized'));
    } catch (err) {
      logger.error(this.i18n.translate('errors.clientInitFailed'), { error: err });
      throw err;
    }
  }
  
  /**
   * Initialize Anthropic client with API key
   * @private
   */
  initAnthropicClient() {
    const apiKeyEnv = configManager.getConfigValue(CONFIG_TYPES.RAG, 'claude.api_key_env', 'CLAUDE_API_KEY');
    const apiKey = process.env[apiKeyEnv];

    if (apiKey) {
      logger.debug(this.i18n.translate('mcp.initClient'));
      this.anthropic = new Anthropic({ apiKey });
    } else {
      logger.warn(this.i18n.translate('errors.noApiKey'));
    }
  }
  
  /**
   * Get list of available MCP servers
   * 
   * @returns {Array} List of available servers
   */
  getAvailableServers() {
    logger.debug('Getting available MCP servers');
    
    const servers = Object.entries(this.config.servers || {})
      .filter(([, serverConfig]) => serverConfig.enabled)
      .map(([serverId, serverConfig]) => ({
        id: serverId,
        description: serverConfig.description,
        autostart: serverConfig.autostart,
        running: this.serverProcesses.has(serverId)
      }));
    
    logger.debug('Available MCP servers', { count: servers.length });
    return servers;
  }
  
  /**
   * Start an MCP server
   * 
   * @param {string} serverId - Server ID
   * @returns {boolean} Success
   */
  startServer(serverId) {
    logger.info(this.i18n.translate('mcp.serverStarting'), { serverId });

    // Check if server is already running
    if (this.serverProcesses.has(serverId)) {
      logger.warn(this.i18n.translate('mcp.serverAlreadyRunning'), { serverId });
      return true;
    }

    // Get server configuration
    const serverConfig = this.config.servers[serverId];
    if (!serverConfig) {
      logger.error(this.i18n.translate('mcp.serverNotFound'), { serverId });
      return false;
    }

    if (!serverConfig.enabled) {
      logger.warn(this.i18n.translate('mcp.serverDisabled'), { serverId });
      return false;
    }

    try {
      // Start server process
      const process = spawn(serverConfig.command, serverConfig.args, {
        stdio: 'inherit'
      });

      // Store process
      this.serverProcesses.set(serverId, process);

      // Handle process exit
      process.on('exit', (code) => {
        logger.info('Server process exited', { serverId, code });
        this.serverProcesses.delete(serverId);
      });

      logger.info(this.i18n.translate('mcp.serverStartSuccess'), { serverId });
      return true;
    } catch (err) {
      logger.error(this.i18n.translate('errors.serverError', { message: err.message }), { serverId, error: err });
      return false;
    }
  }
  
  /**
   * Stop an MCP server
   * 
   * @param {string} serverId - Server ID
   * @returns {boolean} Success
   */
  stopServer(serverId) {
    logger.info(this.i18n.translate('mcp.serverStopping'), { serverId });

    // Check if server is running
    if (!this.serverProcesses.has(serverId)) {
      logger.warn(this.i18n.translate('mcp.serverNotRunning'), { serverId });
      return false;
    }

    try {
      // Get process
      const process = this.serverProcesses.get(serverId);

      // Kill process
      process.kill();

      logger.info(this.i18n.translate('mcp.serverStopSuccess'), { serverId });
      return true;
    } catch (err) {
      logger.error(this.i18n.translate('mcp.serverStopFailed'), { serverId, error: err });
      return false;
    }
  }
  
  /**
   * Stop all running MCP servers
   */
  stopAllServers() {
    logger.info(this.i18n.translate('mcp.serverStopping'));

    // Stop each running server
    this.serverProcesses.forEach((process, serverId) => {
      try {
        process.kill();
        logger.debug(this.i18n.translate('mcp.serverStopSuccess'), { serverId });
      } catch (err) {
        logger.error(this.i18n.translate('mcp.serverStopFailed'), { serverId, error: err });
      }
    });

    // Clear process map
    this.serverProcesses.clear();

    logger.info(this.i18n.translate('mcp.allServersStopped'));
  }
  
  /**
   * Generate a response from Claude with MCP server integration
   * 
   * @param {Object} options - Generation options
   * @param {string} options.prompt - Prompt text
   * @param {Array} options.requiredTools - Required MCP tools
   * @param {string} options.model - Claude model to use
   * @returns {Promise<Object>} Claude response
   */
  async generateResponse(options) {
    const { prompt, requiredTools = [], model } = options;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info(this.i18n.translate('mcp.generatingResponse'), {
      requestId,
      promptLength: prompt.length,
      requiredTools,
      model
    });

    // Check if Anthropic client is available
    if (!this.anthropic) {
      const error = new Error(this.i18n.translate('errors.anthropicNotInitialized'));
      logger.error(this.i18n.translate('errors.failedToGenerateResponse'), { requestId, error });
      throw error;
    }

    // Start required servers
    if (requiredTools.length > 0) {
      logger.debug(this.i18n.translate('mcp.startingRequiredServers'), { requestId, requiredTools });

      for (const tool of requiredTools) {
        if (!this.serverProcesses.has(tool)) {
          this.startServer(tool);
        }
      }
    }

    try {
      // Generate response
      const startTime = Date.now();

      // Get Claude model from configuration
      const defaultModel = configManager.getConfigValue(CONFIG_TYPES.RAG, 'claude.model', 'claude-3-sonnet-20240229');

      // Create messages array for Claude
      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: model || defaultModel,
        messages,
        max_tokens: 4000
      });

      const duration = Date.now() - startTime;

      logger.info(this.i18n.translate('mcp.responseGenerated'), {
        requestId,
        duration,
        tokensUsed: response.usage,
        model: response.model
      });

      return {
        text: response.content[0].text,
        model: response.model,
        usage: response.usage,
        requestId
      };
    } catch (err) {
      logger.error(this.i18n.translate('errors.failedToGenerateResponse'), { requestId, error: err });
      throw err;
    }
  }
}

// Export class
module.exports = ClaudeMcpClient;