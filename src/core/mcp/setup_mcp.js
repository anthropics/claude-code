#!/usr/bin/env node

/**
 * MCP Server Configuration Tool
 * 
 * This script helps set up and start MCP servers for the Claude Neural Framework.
 * It loads the configuration from server_config.json, verifies environment variables,
 * and starts the configured servers.
 * 
 * Version: 1.0.0
 * Last Update: 2025-05-11
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// Import standardized config manager
const configManager = require('../config/config_manager');
const { CONFIG_TYPES } = configManager;

// Import standardized logger
const logger = require('../logging/logger').createLogger('mcp-setup');

// Import standardized error handling
const { 
  errorHandler, 
  ConfigurationError, 
  ValidationError, 
  NotFoundError 
} = require('../error/error_handler');

// Server configuration path
const SERVER_CONFIG_PATH = path.join(__dirname, 'server_config.json');

// Terminal colors for better readability
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

/**
 * Main setup function
 */
async function setupMcp() {
  logger.info('Starting MCP server setup');
  
  // Load server configuration
  let serverConfig;
  try {
    serverConfig = loadServerConfig();
    
    if (!serverConfig.servers || Object.keys(serverConfig.servers).length === 0) {
      throw new ConfigurationError('No servers configured in server_config.json', {
        code: 'ERR_NO_SERVERS_CONFIGURED'
      });
    }
    
    logger.info('Server configuration loaded', { serverCount: Object.keys(serverConfig.servers).length });
  } catch (err) {
    logger.error('Failed to load server configuration', { error: err });
    console.error(`${COLORS.red}${COLORS.bold}Error:${COLORS.reset} Failed to load server configuration: ${err.message}`);
    process.exit(1);
  }
  
  // Check for installed packages
  try {
    await checkInstalledPackages(serverConfig);
  } catch (err) {
    logger.error('Failed to check installed packages', { error: err });
    console.error(`${COLORS.red}${COLORS.bold}Error:${COLORS.reset} ${err.message}`);
    process.exit(1);
  }
  
  // Update MCP configuration
  try {
    await updateMcpConfig(serverConfig);
    logger.info('MCP configuration updated');
  } catch (err) {
    logger.error('Failed to update MCP configuration', { error: err });
    console.error(`${COLORS.red}${COLORS.bold}Error:${COLORS.reset} Failed to update MCP configuration: ${err.message}`);
    process.exit(1);
  }
  
  // Check for required environment variables
  try {
    checkEnvironmentVariables(serverConfig);
  } catch (err) {
    logger.warn('Environment variable check', { error: err });
    console.warn(`${COLORS.yellow}${COLORS.bold}Warning:${COLORS.reset} ${err.message}`);
  }
  
  logger.info('MCP server setup completed successfully');
  console.log(`${COLORS.green}${COLORS.bold}Success:${COLORS.reset} MCP server setup completed.`);
  console.log(`Run ${COLORS.cyan}node core/mcp/start_server.js${COLORS.reset} to start the MCP servers.`);
}

/**
 * Load server configuration
 * @returns {Object} Server configuration
 */
function loadServerConfig() {
  try {
    // Check if server configuration file exists
    if (!fs.existsSync(SERVER_CONFIG_PATH)) {
      throw new NotFoundError('Server configuration file not found', {
        code: 'ERR_CONFIG_FILE_NOT_FOUND',
        metadata: { path: SERVER_CONFIG_PATH }
      });
    }
    
    // Load server configuration
    const configData = fs.readFileSync(SERVER_CONFIG_PATH, 'utf8');
    const config = JSON.parse(configData);
    
    // Validate server configuration - check for mcpServers or servers
    if (!config.servers && !config.mcpServers) {
      throw new ValidationError('Invalid server configuration: missing servers object', {
        code: 'ERR_INVALID_SERVER_CONFIG'
      });
    }

    // If the config uses mcpServers instead of servers, convert the format
    if (config.mcpServers && !config.servers) {
      config.servers = config.mcpServers;
    }
    
    return config;
  } catch (err) {
    // Handle JSON parse errors
    if (err instanceof SyntaxError) {
      throw new ConfigurationError('Invalid JSON in server configuration file', {
        code: 'ERR_INVALID_JSON',
        cause: err
      });
    }
    
    // Rethrow framework errors
    if (err instanceof NotFoundError || err instanceof ValidationError) {
      throw err;
    }
    
    // Wrap other errors
    throw new ConfigurationError('Failed to load server configuration', {
      code: 'ERR_CONFIG_LOAD_FAILED',
      cause: err
    });
  }
}

/**
 * Check for installed packages
 * @param {Object} config - Server configuration
 */
async function checkInstalledPackages(config) {
  logger.info('Checking installed packages');
  console.log(`${COLORS.blue}${COLORS.bold}Checking installed packages...${COLORS.reset}`);
  
  const requiredPackages = new Set();
  
  // Collect required packages from server configuration
  Object.entries(config.servers).forEach(([serverId, serverConfig]) => {
    if (serverConfig.package) {
      requiredPackages.add(serverConfig.package);
    }
  });
  
  // Check if packages are installed
  const missingPackages = [];
  
  for (const packageName of requiredPackages) {
    try {
      logger.debug('Checking package', { packageName });
      execSync(`npm list ${packageName} -g || npm list ${packageName}`, { stdio: 'ignore' });
      console.log(`${COLORS.green}✓${COLORS.reset} Package ${COLORS.cyan}${packageName}${COLORS.reset} is installed.`);
    } catch (err) {
      logger.warn('Missing package', { packageName });
      console.log(`${COLORS.yellow}!${COLORS.reset} Package ${COLORS.cyan}${packageName}${COLORS.reset} is not installed.`);
      missingPackages.push(packageName);
    }
  }
  
  // Install missing packages
  if (missingPackages.length > 0) {
    console.log(`${COLORS.yellow}${COLORS.bold}Found ${missingPackages.length} missing packages.${COLORS.reset}`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question(`${COLORS.yellow}Do you want to install them now? (y/n)${COLORS.reset} `, resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      logger.info('Installing missing packages', { packages: missingPackages });
      console.log(`${COLORS.blue}${COLORS.bold}Installing missing packages...${COLORS.reset}`);
      
      for (const packageName of missingPackages) {
        try {
          console.log(`${COLORS.blue}Installing ${packageName}...${COLORS.reset}`);
          execSync(`npm install -g ${packageName}`, { stdio: 'inherit' });
          console.log(`${COLORS.green}✓${COLORS.reset} Package ${COLORS.cyan}${packageName}${COLORS.reset} installed.`);
        } catch (err) {
          logger.error('Failed to install package', { packageName, error: err });
          console.error(`${COLORS.red}✗${COLORS.reset} Failed to install package ${COLORS.cyan}${packageName}${COLORS.reset}: ${err.message}`);
          throw new Error(`Failed to install required packages. Please install them manually.`);
        }
      }
    } else {
      logger.warn('Missing packages not installed', { packages: missingPackages });
      console.warn(`${COLORS.yellow}${COLORS.bold}Warning:${COLORS.reset} Missing packages not installed. You may need to install them manually.`);
    }
  } else {
    logger.info('All required packages are installed');
    console.log(`${COLORS.green}${COLORS.bold}All required packages are installed.${COLORS.reset}`);
  }
}

/**
 * Update MCP configuration
 * @param {Object} serverConfig - Server configuration
 */
async function updateMcpConfig(serverConfig) {
  logger.info('Updating MCP configuration');
  console.log(`${COLORS.blue}${COLORS.bold}Updating MCP configuration...${COLORS.reset}`);

  try {
    // Create server configurations
    const servers = {};

    Object.entries(serverConfig.servers).forEach(([serverId, serverConfig]) => {
      servers[serverId] = {
        enabled: serverConfig.enabled !== false,
        autostart: serverConfig.autostart !== false,
        command: serverConfig.command,
        args: serverConfig.args,
        description: serverConfig.description || `MCP server: ${serverId}`,
        api_key_env: serverConfig.api_key_env
      };
    });

    // Create MCP configuration
    const mcpConfig = {
      version: "1.0.0",
      servers: servers
    };

    // Get the path to the MCP config file
    const MCP_CONFIG_PATH = path.resolve(__dirname, '../config/mcp_config.json');

    // Make sure the directory exists
    const mcpConfigDir = path.dirname(MCP_CONFIG_PATH);
    if (!fs.existsSync(mcpConfigDir)) {
      fs.mkdirSync(mcpConfigDir, { recursive: true });
    }

    // Save the configuration directly to the file
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(mcpConfig, null, 2), 'utf8');

    logger.info('MCP configuration updated', { serverCount: Object.keys(servers).length });
    console.log(`${COLORS.green}✓${COLORS.reset} MCP configuration updated with ${Object.keys(servers).length} servers.`);
  } catch (err) {
    logger.error('Failed to update MCP configuration', { error: err });
    throw new ConfigurationError('Failed to update MCP configuration', {
      code: 'ERR_MCP_CONFIG_UPDATE_FAILED',
      cause: err
    });
  }
}

/**
 * Check for required environment variables
 * @param {Object} config - Server configuration
 */
function checkEnvironmentVariables(config) {
  logger.info('Checking environment variables');
  console.log(`${COLORS.blue}${COLORS.bold}Checking environment variables...${COLORS.reset}`);
  
  const requiredEnvVars = new Set();
  const missingEnvVars = [];
  
  // Collect required environment variables from server configuration
  Object.entries(config.servers).forEach(([serverId, serverConfig]) => {
    if (serverConfig.api_key_env) {
      requiredEnvVars.add(serverConfig.api_key_env);
    }
  });
  
  // Check if environment variables are set
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.warn('Missing environment variable', { envVar });
      console.warn(`${COLORS.yellow}!${COLORS.reset} Environment variable ${COLORS.cyan}${envVar}${COLORS.reset} is not set.`);
      missingEnvVars.push(envVar);
    } else {
      logger.debug('Environment variable found', { envVar });
      console.log(`${COLORS.green}✓${COLORS.reset} Environment variable ${COLORS.cyan}${envVar}${COLORS.reset} is set.`);
    }
  }
  
  // Warn about missing environment variables
  if (missingEnvVars.length > 0) {
    const message = `Missing ${missingEnvVars.length} environment variables: ${missingEnvVars.join(', ')}`;
    logger.warn(message);
    console.warn(`${COLORS.yellow}${COLORS.bold}Warning:${COLORS.reset} ${message}`);
    console.warn(`${COLORS.yellow}Some MCP servers may not work properly without these environment variables.${COLORS.reset}`);
    
    throw new ValidationError(message, {
      code: 'ERR_MISSING_ENV_VARS',
      isOperational: true,
      metadata: { missingEnvVars }
    });
  } else {
    logger.info('All required environment variables are set');
    console.log(`${COLORS.green}${COLORS.bold}All required environment variables are set.${COLORS.reset}`);
  }
}

// Run setup function with error handling
errorHandler.wrapAsync(setupMcp)().catch(err => {
  logger.fatal('Fatal error during MCP setup', { error: err });
  console.error(`${COLORS.red}${COLORS.bold}Fatal Error:${COLORS.reset} ${err.message}`);
  process.exit(1);
});