/**
 * Configuration management utilities for the Claude CLI
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Default configuration paths
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.claude', 'config.json');
const GLOBAL_CONFIG_PATH = path.join(process.cwd(), 'core', 'config', 'global_config.json');

/**
 * Load configuration from specified path or default locations
 * @param {string} configPath - Optional path to config file
 * @returns {Object} Configuration object
 */
function loadConfig(configPath) {
  // Try user-specified config first
  if (configPath && fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  // Try user default config
  if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
  }

  // Try global config
  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
  }

  // Return empty config if none found
  return {};
}

/**
 * Save configuration to specified path or default location
 * @param {Object} config - Configuration object to save
 * @param {string} configPath - Optional path to save config file
 */
function saveConfig(config, configPath) {
  const savePath = configPath || DEFAULT_CONFIG_PATH;
  
  // Ensure directory exists
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(savePath, JSON.stringify(config, null, 2));
}

/**
 * Get specific configuration value
 * @param {Object} config - Configuration object
 * @param {string} key - Configuration key to retrieve
 * @param {any} defaultValue - Default value if key not found
 * @returns {any} Configuration value
 */
function getValue(config, key, defaultValue) {
  const parts = key.split('.');
  let current = config;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return defaultValue;
    }
  }
  
  return current;
}

module.exports = { 
  loadConfig, 
  saveConfig, 
  getValue 
};