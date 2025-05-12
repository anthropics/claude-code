/**
 * SAA (Server-as-API) Service
 * 
 * Core service that manages Server-as-API functionality for the Claude Neural Framework.
 * Integrates with the pentagonal architecture components.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const winston = require('winston');

class SaaService {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.configPath - Path to configuration file
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.configPath = options.configPath || path.join(process.cwd(), 'core/config/saa_config.json');
    this.logger = options.logger || this._createDefaultLogger();
    this.servers = new Map();
    this.config = this._loadConfig();
  }

  /**
   * Initialize the SAA service
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.info('Initializing SAA service');
    
    // Verify dependencies are available
    await this._checkDependencies();
    
    // Load server configurations
    await this._loadServerConfigurations();
    
    this.logger.info('SAA service initialized successfully');
  }

  /**
   * Start all configured servers
   * @returns {Promise<Object>} Status of started servers
   */
  async startAllServers() {
    this.logger.info('Starting all SAA servers');
    
    const results = {};
    const serverConfigs = this.config.servers || [];
    
    for (const serverConfig of serverConfigs) {
      try {
        const result = await this.startServer(serverConfig.id);
        results[serverConfig.id] = result;
      } catch (error) {
        this.logger.error(`Failed to start server ${serverConfig.id}`, { error: error.message });
        results[serverConfig.id] = { status: 'error', error: error.message };
      }
    }
    
    return results;
  }

  /**
   * Start a specific server by ID
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object>} Server status information
   */
  async startServer(serverId) {
    const serverConfig = this._getServerConfig(serverId);
    
    if (!serverConfig) {
      throw new Error(`Server configuration not found for ID: ${serverId}`);
    }
    
    this.logger.info(`Starting server: ${serverId}`, { type: serverConfig.type });
    
    // Check if server is already running
    if (this.servers.has(serverId)) {
      const existingServer = this.servers.get(serverId);
      if (existingServer.status === 'running') {
        return {
          status: 'running',
          message: 'Server already running',
          pid: existingServer.process.pid,
          port: serverConfig.port
        };
      }
    }
    
    // Determine start command based on server type
    const startCommand = this._getServerStartCommand(serverConfig);
    if (!startCommand) {
      throw new Error(`Unsupported server type: ${serverConfig.type}`);
    }
    
    try {
      // Start the server process
      const process = this._spawnServerProcess(startCommand.command, startCommand.args, serverConfig);
      
      // Store server process information
      this.servers.set(serverId, {
        status: 'running',
        process,
        config: serverConfig,
        startTime: new Date()
      });
      
      // Wait for server to be ready
      await this._waitForServerReady(serverConfig);
      
      return {
        status: 'running',
        message: 'Server started successfully',
        pid: process.pid,
        port: serverConfig.port
      };
    } catch (error) {
      this.logger.error(`Error starting server ${serverId}`, { error: error.message });
      
      // Update server status
      if (this.servers.has(serverId)) {
        const serverInfo = this.servers.get(serverId);
        serverInfo.status = 'error';
        serverInfo.error = error.message;
        this.servers.set(serverId, serverInfo);
      }
      
      throw error;
    }
  }

  /**
   * Stop a specific server by ID
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object>} Stop status
   */
  async stopServer(serverId) {
    if (!this.servers.has(serverId)) {
      return {
        status: 'not_running',
        message: `Server ${serverId} is not running`
      };
    }
    
    const serverInfo = this.servers.get(serverId);
    if (serverInfo.status !== 'running' || !serverInfo.process) {
      return {
        status: 'not_running',
        message: `Server ${serverId} is not running`
      };
    }
    
    this.logger.info(`Stopping server: ${serverId}`);
    
    try {
      // Gracefully terminate process
      serverInfo.process.kill('SIGTERM');
      
      // Wait for process to exit (with timeout)
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          // Force kill if not terminated
          try {
            serverInfo.process.kill('SIGKILL');
          } catch (e) {
            // Process might already be gone
          }
          resolve();
        }, 5000);
        
        serverInfo.process.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      // Update server status
      serverInfo.status = 'stopped';
      serverInfo.stopTime = new Date();
      this.servers.set(serverId, serverInfo);
      
      return {
        status: 'stopped',
        message: `Server ${serverId} stopped successfully`
      };
    } catch (error) {
      this.logger.error(`Error stopping server ${serverId}`, { error: error.message });
      
      return {
        status: 'error',
        message: `Error stopping server: ${error.message}`
      };
    }
  }

  /**
   * Stop all running servers
   * @returns {Promise<Object>} Status of stopped servers
   */
  async stopAllServers() {
    this.logger.info('Stopping all SAA servers');
    
    const results = {};
    
    for (const [serverId] of this.servers) {
      try {
        const result = await this.stopServer(serverId);
        results[serverId] = result;
      } catch (error) {
        this.logger.error(`Failed to stop server ${serverId}`, { error: error.message });
        results[serverId] = { status: 'error', error: error.message };
      }
    }
    
    return results;
  }

  /**
   * Get status of all servers
   * @returns {Object} Server statuses
   */
  getServerStatus() {
    const status = {};
    
    for (const [serverId, serverInfo] of this.servers) {
      status[serverId] = {
        status: serverInfo.status,
        type: serverInfo.config.type,
        port: serverInfo.config.port,
        pid: serverInfo.process?.pid,
        uptime: serverInfo.status === 'running' && serverInfo.startTime 
          ? Math.floor((new Date() - serverInfo.startTime) / 1000) 
          : null
      };
    }
    
    return status;
  }

  /**
   * Restart a specific server
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object>} Restart status
   */
  async restartServer(serverId) {
    this.logger.info(`Restarting server: ${serverId}`);
    
    try {
      // Stop server if running
      await this.stopServer(serverId);
      
      // Start server again
      return await this.startServer(serverId);
    } catch (error) {
      this.logger.error(`Error restarting server ${serverId}`, { error: error.message });
      
      return {
        status: 'error',
        message: `Error restarting server: ${error.message}`
      };
    }
  }

  /**
   * Create default logger
   * @private
   * @returns {Object} Winston logger instance
   */
  _createDefaultLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'saa-service' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ filename: 'logs/saa-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/saa-combined.log' })
      ]
    });
  }

  /**
   * Load configuration from file
   * @private
   * @returns {Object} Configuration object
   */
  _loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configData);
      }
      
      // Return default config if file doesn't exist
      return {
        servers: [],
        autoStart: false,
        defaultPort: 3000,
        defaultTimeout: 30000
      };
    } catch (error) {
      this.logger.error('Error loading SAA configuration', { error: error.message });
      
      // Return default config on error
      return {
        servers: [],
        autoStart: false,
        defaultPort: 3000,
        defaultTimeout: 30000
      };
    }
  }

  /**
   * Save configuration to file
   * @private
   * @param {Object} config - Configuration to save
   */
  _saveConfig(config) {
    try {
      const configDir = path.dirname(this.configPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      this.logger.info('SAA configuration saved successfully');
    } catch (error) {
      this.logger.error('Error saving SAA configuration', { error: error.message });
      throw error;
    }
  }

  /**
   * Check for required dependencies
   * @private
   * @returns {Promise<void>}
   */
  async _checkDependencies() {
    // Could check for required system dependencies here
    return Promise.resolve();
  }

  /**
   * Load server configurations
   * @private
   * @returns {Promise<void>}
   */
  async _loadServerConfigurations() {
    // No-op for now, server configs are loaded from config file
    return Promise.resolve();
  }

  /**
   * Get server configuration by ID
   * @private
   * @param {string} serverId - Server identifier
   * @returns {Object|null} Server configuration
   */
  _getServerConfig(serverId) {
    const serverConfigs = this.config.servers || [];
    return serverConfigs.find(config => config.id === serverId) || null;
  }

  /**
   * Get server start command
   * @private
   * @param {Object} serverConfig - Server configuration
   * @returns {Object|null} Command object with command and args
   */
  _getServerStartCommand(serverConfig) {
    switch (serverConfig.type) {
      case 'pentagonal':
        return {
          command: 'node',
          args: ['src/index.js']
        };
      case 'mcp':
        return {
          command: 'node',
          args: ['core/mcp/start_server.js', '--id=' + serverConfig.id]
        };
      case 'rag':
        return {
          command: 'python',
          args: ['core/rag/rag_server.py', '--port=' + serverConfig.port]
        };
      default:
        return null;
    }
  }

  /**
   * Spawn server process
   * @private
   * @param {string} command - Command to run
   * @param {Array<string>} args - Command arguments
   * @param {Object} config - Server configuration
   * @returns {Object} Child process
   */
  _spawnServerProcess(command, args, config) {
    const env = { ...process.env };
    
    // Add PORT environment variable if specified
    if (config.port) {
      env.PORT = config.port.toString();
    }
    
    // Add server-specific environment variables
    if (config.env) {
      Object.assign(env, config.env);
    }
    
    const process = spawn(command, args, {
      env,
      cwd: config.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Log output
    process.stdout.on('data', (data) => {
      this.logger.debug(`[${config.id}] stdout: ${data.toString().trim()}`);
    });
    
    process.stderr.on('data', (data) => {
      this.logger.error(`[${config.id}] stderr: ${data.toString().trim()}`);
    });
    
    // Handle process exit
    process.on('exit', (code, signal) => {
      if (code !== 0) {
        this.logger.error(`Server ${config.id} exited with code ${code}, signal: ${signal}`);
      } else {
        this.logger.info(`Server ${config.id} exited normally`);
      }
      
      // Update server status if still tracked
      if (this.servers.has(config.id)) {
        const serverInfo = this.servers.get(config.id);
        serverInfo.status = 'stopped';
        serverInfo.exitCode = code;
        serverInfo.exitSignal = signal;
        this.servers.set(config.id, serverInfo);
      }
    });
    
    return process;
  }

  /**
   * Wait for server to be ready
   * @private
   * @param {Object} config - Server configuration
   * @returns {Promise<void>}
   */
  async _waitForServerReady(config) {
    if (!config.port) {
      // If no port specified, assume server is ready immediately
      return Promise.resolve();
    }
    
    const maxRetries = 30;
    const retryInterval = 1000;
    
    return new Promise((resolve, reject) => {
      let retries = 0;
      
      const checkServer = () => {
        // Simple TCP check on the port
        const net = require('net');
        const client = new net.Socket();
        
        const timeout = setTimeout(() => {
          client.destroy();
          
          retries++;
          if (retries >= maxRetries) {
            reject(new Error(`Server ${config.id} failed to start within timeout`));
          } else {
            setTimeout(checkServer, retryInterval);
          }
        }, 1000);
        
        client.connect(config.port, '127.0.0.1', () => {
          clearTimeout(timeout);
          client.destroy();
          resolve();
        });
        
        client.on('error', (err) => {
          clearTimeout(timeout);
          
          retries++;
          if (retries >= maxRetries) {
            reject(new Error(`Server ${config.id} failed to start within timeout`));
          } else {
            setTimeout(checkServer, retryInterval);
          }
        });
      };
      
      // Start checking
      checkServer();
    });
  }
}

module.exports = SaaService;