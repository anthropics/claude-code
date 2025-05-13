/**
 * Configuration Manager for the Claude Neural Framework
 * 
 * This file provides a centralized configuration interface for
 * all components of the Claude Neural Framework.
 * 
 * @module core/config/config_manager
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Supported configuration types
 * @type {Object}
 */
const CONFIG_TYPES = {
  RAG: 'rag',
  MCP: 'mcp',
  SECURITY: 'security',
  COLOR_SCHEMA: 'color_schema',
  GLOBAL: 'global',
  USER: 'user',
  I18N: 'i18n'
};

/**
 * Error types for configuration operations
 */
class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

class ConfigValidationError extends ConfigError {
  constructor(message, validationErrors = []) {
    super(message);
    this.name = 'ConfigValidationError';
    this.validationErrors = validationErrors;
  }
}

class ConfigAccessError extends ConfigError {
  constructor(message) {
    super(message);
    this.name = 'ConfigAccessError';
  }
}

/**
 * Default path for global Claude configurations
 */
const DEFAULT_GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.claude');

/**
 * Local configuration paths
 */
const LOCAL_CONFIG_PATHS = {
  [CONFIG_TYPES.RAG]: path.resolve(__dirname, 'rag_config.json'),
  [CONFIG_TYPES.MCP]: path.resolve(__dirname, 'mcp_config.json'),
  [CONFIG_TYPES.SECURITY]: path.resolve(__dirname, 'security_constraints.json'),
  [CONFIG_TYPES.COLOR_SCHEMA]: path.resolve(__dirname, 'color_schema_config.json'),
  [CONFIG_TYPES.I18N]: path.resolve(__dirname, 'i18n_config.json')
};

/**
 * Default configuration values
 */
const DEFAULT_CONFIGS = {
  [CONFIG_TYPES.GLOBAL]: {
    version: '1.0.0',
    timezone: 'UTC',
    language: 'en',
    notifications: {
      enabled: true,
      showErrors: true,
      showWarnings: true
    },
    logging: {
      level: 30,
      format: 'json',
      colorize: true,
      timestamp: true,
      showSource: true,
      showHostname: false,
      consoleOutput: true,
      fileOutput: false
    }
  },
  [CONFIG_TYPES.RAG]: {
    version: '1.0.0',
    database: {
      type: 'chroma',
      path: path.join(DEFAULT_GLOBAL_CONFIG_PATH, 'vector_store')
    },
    embedding: {
      model: 'voyage',
      api_key_env: 'VOYAGE_API_KEY'
    },
    claude: {
      api_key_env: 'CLAUDE_API_KEY',
      model: 'claude-3-sonnet-20240229'
    }
  },
  [CONFIG_TYPES.MCP]: {
    version: '1.0.0',
    servers: {
      sequentialthinking: {
        enabled: true,
        autostart: true,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
        description: 'Recursive thought generation for complex problems'
      },
      'brave-search': {
        enabled: true,
        autostart: false,
        command: 'npx',
        args: ['-y', '@smithery/cli@latest', 'run', '@smithery-ai/brave-search'],
        api_key_env: 'MCP_API_KEY',
        description: 'External knowledge acquisition'
      },
      'desktop-commander': {
        enabled: true,
        autostart: false,
        command: 'npx',
        args: ['-y', '@smithery/cli@latest', 'run', '@wonderwhy-er/desktop-commander', '--key', '${MCP_API_KEY}'],
        api_key_env: 'MCP_API_KEY',
        description: 'Filesystem integration and shell execution'
      },
      'context7-mcp': {
        enabled: true,
        autostart: false,
        command: 'npx',
        args: ['-y', '@smithery/cli@latest', 'run', '@upstash/context7-mcp', '--key', '${MCP_API_KEY}'],
        api_key_env: 'MCP_API_KEY',
        description: 'Context awareness and documentation access'
      },
      'think-mcp-server': {
        enabled: true,
        autostart: false,
        command: 'npx',
        args: ['-y', '@smithery/cli@latest', 'run', '@PhillipRt/think-mcp-server', '--key', '${MCP_API_KEY}'],
        api_key_env: 'MCP_API_KEY',
        description: 'Meta-cognitive reflection'
      }
    }
  },
  [CONFIG_TYPES.SECURITY]: {
    version: '1.0.0',
    mcp: {
      allowed_servers: [
        'sequentialthinking',
        'context7',
        'desktop-commander',
        'brave-search',
        'think-mcp'
      ],
      allow_server_autostart: true,
      allow_remote_servers: false
    },
    filesystem: {
      allowed_directories: [
        path.join(os.homedir(), 'claude_projects')
      ]
    }
  },
  [CONFIG_TYPES.COLOR_SCHEMA]: {
    version: '1.0.0',
    themes: {
      light: {
        name: 'Light Theme',
        colors: {
          primary: '#1565c0',
          secondary: '#7986cb',
          accent: '#ff4081',
          success: '#4caf50',
          warning: '#ff9800',
          danger: '#f44336',
          info: '#2196f3',
          background: '#f8f9fa',
          surface: '#ffffff',
          text: '#212121',
          textSecondary: '#757575',
          border: '#e0e0e0',
          shadow: 'rgba(0, 0, 0, 0.1)'
        }
      },
      dark: {
        name: 'Dark Theme',
        colors: {
          primary: '#1565c0',
          secondary: '#03dac6',
          accent: '#cf6679',
          success: '#4caf50',
          warning: '#ff9800',
          danger: '#cf6679',
          info: '#2196f3',
          background: '#121212',
          surface: '#1e1e1e',
          text: '#ffffff',
          textSecondary: '#b0b0b0',
          border: '#333333',
          shadow: 'rgba(0, 0, 0, 0.5)'
        }
      }
    },
    userPreferences: {
      activeTheme: 'dark',
      custom: null
    }
  },
  [CONFIG_TYPES.USER]: {
    version: '1.0.0',
    user_id: `user-${Date.now()}`,
    name: 'Default User',
    preferences: {
      theme: 'dark',
      language: 'de'
    }
  },
  [CONFIG_TYPES.I18N]: {
    version: '1.0.0',
    locale: 'en',
    fallbackLocale: 'en',
    loadPath: 'core/i18n/locales/{{lng}}.json',
    debug: false,
    supportedLocales: ['en', 'fr', 'de'],
    dateFormat: {
      short: {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      },
      medium: {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      },
      long: {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      }
    },
    numberFormat: {
      decimal: {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      },
      percent: {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      },
      currency: {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    }
  }
};

/**
 * Helper function to load a JSON configuration file
 * 
 * @param {string} configPath - Path to the configuration file
 * @param {Object} defaultConfig - Default configuration if the file doesn't exist
 * @returns {Object} The loaded configuration
 * @throws {ConfigAccessError} If there's an error reading the file
 */
function loadJsonConfig(configPath, defaultConfig = {}) {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
  } catch (err) {
    console.warn(`Warning: Error loading configuration from ${configPath}: ${err.message}`);
    throw new ConfigAccessError(`Failed to load configuration from ${configPath}: ${err.message}`);
  }
  
  return defaultConfig;
}

/**
 * Helper function to save a JSON configuration file
 * 
 * @param {string} configPath - Path to the configuration file
 * @param {Object} config - Configuration to save
 * @returns {boolean} true on success, false on error
 * @throws {ConfigAccessError} If there's an error writing the file
 */
function saveJsonConfig(configPath, config) {
  try {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error saving configuration to ${configPath}: ${err.message}`);
    throw new ConfigAccessError(`Failed to save configuration to ${configPath}: ${err.message}`);
  }
}

/**
 * Simple schema validation for configuration objects
 * 
 * @param {Object} config - Configuration object to validate
 * @param {Object} schema - Schema to validate against
 * @returns {Object} Validation result {valid: boolean, errors: Array}
 */
function validateConfig(config, schema) {
  const errors = [];
  
  function validateObject(obj, schemaObj, path = '') {
    // Check required fields
    if (schemaObj.required) {
      for (const field of schemaObj.required) {
        if (obj[field] === undefined) {
          errors.push(`Missing required field: ${path ? path + '.' : ''}${field}`);
        }
      }
    }
    
    // Check properties
    if (schemaObj.properties) {
      for (const [key, propSchema] of Object.entries(schemaObj.properties)) {
        if (obj[key] !== undefined) {
          const fieldPath = path ? `${path}.${key}` : key;
          
          // Type checking
          if (propSchema.type && typeof obj[key] !== propSchema.type) {
            errors.push(`Invalid type for ${fieldPath}: expected ${propSchema.type}, got ${typeof obj[key]}`);
          }
          
          // Nested objects
          if (propSchema.type === 'object' && obj[key] && propSchema.properties) {
            validateObject(obj[key], propSchema, fieldPath);
          }
          
          // Array validation
          if (propSchema.type === 'array' && Array.isArray(obj[key]) && propSchema.items) {
            obj[key].forEach((item, index) => {
              if (propSchema.items.type === 'object' && propSchema.items.properties) {
                validateObject(item, propSchema.items, `${fieldPath}[${index}]`);
              }
            });
          }
        }
      }
    }
  }
  
  validateObject(config, schema);
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Class for managing all configurations of the Claude Neural Framework
 */
class ConfigManager {
  /**
   * Creates a new instance of ConfigManager
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.globalConfigPath - Path to global configuration
   * @param {boolean} options.schemaValidation - Whether to enable schema validation
   * @param {boolean} options.environmentOverrides - Whether to enable environment variable overrides
   */
  constructor(options = {}) {
    this.globalConfigPath = options.globalConfigPath || DEFAULT_GLOBAL_CONFIG_PATH;
    this.schemaValidation = options.schemaValidation !== undefined ? options.schemaValidation : true;
    this.environmentOverrides = options.environmentOverrides !== undefined ? options.environmentOverrides : true;
    
    this.configs = {
      [CONFIG_TYPES.RAG]: null,
      [CONFIG_TYPES.MCP]: null,
      [CONFIG_TYPES.SECURITY]: null,
      [CONFIG_TYPES.COLOR_SCHEMA]: null,
      [CONFIG_TYPES.GLOBAL]: null,
      [CONFIG_TYPES.USER]: null,
      [CONFIG_TYPES.I18N]: null
    };
    
    this.schemas = {}; // Optional schema validation
    this.observers = new Map(); // For config change notifications
    this.configVersions = new Map(); // Track config versions for cache invalidation
    
    // Ensure global configuration path exists
    if (!fs.existsSync(this.globalConfigPath)) {
      try {
        fs.mkdirSync(this.globalConfigPath, { recursive: true });
      } catch (err) {
        console.error(`Failed to create global configuration directory: ${err.message}`);
      }
    }
  }
  
  /**
   * Set schema for configuration validation
   * 
   * @param {string} configType - Configuration type
   * @param {Object} schema - JSON Schema object
   */
  setSchema(configType, schema) {
    this.schemas[configType] = schema;
  }
  
  /**
   * Register observer for configuration changes
   * 
   * @param {string} configType - Configuration type
   * @param {Function} callback - Callback function(config)
   * @returns {string} Observer ID for unregistering
   */
  registerObserver(configType, callback) {
    const observerId = `observer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.observers.has(configType)) {
      this.observers.set(configType, new Map());
    }
    
    this.observers.get(configType).set(observerId, callback);
    return observerId;
  }
  
  /**
   * Unregister observer
   * 
   * @param {string} configType - Configuration type
   * @param {string} observerId - Observer ID
   * @returns {boolean} Success
   */
  unregisterObserver(configType, observerId) {
    if (this.observers.has(configType)) {
      return this.observers.get(configType).delete(observerId);
    }
    return false;
  }
  
  /**
   * Notify observers of configuration changes
   * 
   * @param {string} configType - Configuration type
   * @param {Object} config - New configuration
   * @private
   */
  notifyObservers(configType, config) {
    if (this.observers.has(configType)) {
      this.observers.get(configType).forEach(callback => {
        try {
          callback(config);
        } catch (err) {
          console.error(`Error in observer callback for ${configType}: ${err.message}`);
        }
      });
    }
  }
  
  /**
   * Loads all configurations
   * 
   * @returns {Object} All loaded configurations
   */
  loadAllConfigs() {
    // Load local configurations
    Object.entries(LOCAL_CONFIG_PATHS).forEach(([configType, configPath]) => {
      try {
        this.configs[configType] = loadJsonConfig(configPath, DEFAULT_CONFIGS[configType]);
        this.configVersions.set(configType, Date.now());
      } catch (err) {
        console.error(`Failed to load ${configType} configuration: ${err.message}`);
        this.configs[configType] = DEFAULT_CONFIGS[configType];
      }
    });
    
    // Load global configuration
    try {
      const globalConfigPath = path.join(this.globalConfigPath, 'config.json');
      this.configs[CONFIG_TYPES.GLOBAL] = loadJsonConfig(globalConfigPath, DEFAULT_CONFIGS[CONFIG_TYPES.GLOBAL]);
      this.configVersions.set(CONFIG_TYPES.GLOBAL, Date.now());
    } catch (err) {
      console.error(`Failed to load global configuration: ${err.message}`);
      this.configs[CONFIG_TYPES.GLOBAL] = DEFAULT_CONFIGS[CONFIG_TYPES.GLOBAL];
    }
    
    // Load user configuration
    try {
      const userConfigPath = path.join(this.globalConfigPath, 'user.about.json');
      this.configs[CONFIG_TYPES.USER] = loadJsonConfig(userConfigPath, DEFAULT_CONFIGS[CONFIG_TYPES.USER]);
      this.configVersions.set(CONFIG_TYPES.USER, Date.now());
    } catch (err) {
      console.error(`Failed to load user configuration: ${err.message}`);
      this.configs[CONFIG_TYPES.USER] = DEFAULT_CONFIGS[CONFIG_TYPES.USER];
    }
    
    return this.configs;
  }
  
  /**
   * Loads a specific configuration
   * 
   * @param {string} configType - Configuration type
   * @returns {Object} The loaded configuration
   * @throws {ConfigError} If the configuration type is unknown
   */
  getConfig(configType) {
    if (!this.configs[configType]) {
      if (configType === CONFIG_TYPES.GLOBAL) {
        try {
          const globalConfigPath = path.join(this.globalConfigPath, 'config.json');
          this.configs[configType] = loadJsonConfig(globalConfigPath, DEFAULT_CONFIGS[CONFIG_TYPES.GLOBAL]);
          this.configVersions.set(configType, Date.now());
        } catch (err) {
          console.error(`Failed to load global configuration: ${err.message}`);
          this.configs[configType] = DEFAULT_CONFIGS[CONFIG_TYPES.GLOBAL];
        }
      } else if (configType === CONFIG_TYPES.USER) {
        try {
          const userConfigPath = path.join(this.globalConfigPath, 'user.about.json');
          this.configs[configType] = loadJsonConfig(userConfigPath, DEFAULT_CONFIGS[CONFIG_TYPES.USER]);
          this.configVersions.set(configType, Date.now());
        } catch (err) {
          console.error(`Failed to load user configuration: ${err.message}`);
          this.configs[configType] = DEFAULT_CONFIGS[CONFIG_TYPES.USER];
        }
      } else if (LOCAL_CONFIG_PATHS[configType]) {
        try {
          this.configs[configType] = loadJsonConfig(LOCAL_CONFIG_PATHS[configType], DEFAULT_CONFIGS[configType]);
          this.configVersions.set(configType, Date.now());
        } catch (err) {
          console.error(`Failed to load ${configType} configuration: ${err.message}`);
          this.configs[configType] = DEFAULT_CONFIGS[configType];
        }
      } else {
        throw new ConfigError(`Unknown configuration type: ${configType}`);
      }
    }
    
    // Apply environment overrides
    if (this.environmentOverrides) {
      this.applyEnvironmentOverrides(configType, this.configs[configType]);
    }
    
    return this.configs[configType];
  }
  
  /**
   * Apply environment variable overrides to configuration
   * Environment variables follow the pattern: CNF_[CONFIG_TYPE]_[KEY_PATH]
   * Example: CNF_RAG_DATABASE_TYPE="lancedb"
   * 
   * @param {string} configType - Configuration type
   * @param {Object} config - Configuration object
   * @private
   */
  applyEnvironmentOverrides(configType, config) {
    const prefix = `CNF_${configType.toUpperCase()}_`;
    
    Object.keys(process.env)
      .filter(key => key.startsWith(prefix))
      .forEach(key => {
        const keyPath = key.substring(prefix.length).toLowerCase().replace(/_/g, '.');
        const value = process.env[key];
        
        // Try to parse as JSON, fall back to string
        let parsedValue = value;
        try {
          parsedValue = JSON.parse(value);
        } catch (e) {
          // If not valid JSON, keep as string
        }
        
        this.setConfigValueByPath(config, keyPath, parsedValue);
      });
  }
  
  /**
   * Set configuration value by path
   * 
   * @param {Object} config - Configuration object
   * @param {string} keyPath - Key path (e.g. 'database.type')
   * @param {any} value - Value to set
   * @private
   */
  setConfigValueByPath(config, keyPath, value) {
    const keyParts = keyPath.split('.');
    let target = config;
    
    for (let i = 0; i < keyParts.length - 1; i++) {
      const part = keyParts[i];
      
      if (!(part in target)) {
        target[part] = {};
      }
      
      target = target[part];
    }
    
    target[keyParts[keyParts.length - 1]] = value;
  }
  
  /**
   * Saves a configuration
   * 
   * @param {string} configType - Configuration type
   * @param {Object} config - Configuration to save
   * @returns {boolean} Success
   * @throws {ConfigError} If the configuration type is unknown
   * @throws {ConfigValidationError} If schema validation fails
   */
  saveConfig(configType, config) {
    // Validate the configuration if schema is available
    if (this.schemaValidation && this.schemas[configType]) {
      const validation = validateConfig(config, this.schemas[configType]);
      if (!validation.valid) {
        throw new ConfigValidationError(
          `Invalid configuration for ${configType}`,
          validation.errors
        );
      }
    }
    
    this.configs[configType] = config;
    this.configVersions.set(configType, Date.now());
    
    if (configType === CONFIG_TYPES.GLOBAL) {
      try {
        const globalConfigPath = path.join(this.globalConfigPath, 'config.json');
        saveJsonConfig(globalConfigPath, config);
        this.notifyObservers(configType, config);
        return true;
      } catch (err) {
        console.error(`Failed to save global configuration: ${err.message}`);
        throw err;
      }
    } else if (configType === CONFIG_TYPES.USER) {
      try {
        const userConfigPath = path.join(this.globalConfigPath, 'user.about.json');
        saveJsonConfig(userConfigPath, config);
        this.notifyObservers(configType, config);
        return true;
      } catch (err) {
        console.error(`Failed to save user configuration: ${err.message}`);
        throw err;
      }
    } else if (LOCAL_CONFIG_PATHS[configType]) {
      try {
        saveJsonConfig(LOCAL_CONFIG_PATHS[configType], config);
        this.notifyObservers(configType, config);
        return true;
      } catch (err) {
        console.error(`Failed to save ${configType} configuration: ${err.message}`);
        throw err;
      }
    } else {
      throw new ConfigError(`Unknown configuration type: ${configType}`);
    }
  }
  
  /**
   * Updates a configuration value
   * 
   * @param {string} configType - Configuration type
   * @param {string} keyPath - Key path (e.g. 'database.type' or 'servers.brave-search.enabled')
   * @param {any} value - New value
   * @returns {boolean} Success
   * @throws {ConfigError} If the configuration type is unknown
   */
  updateConfigValue(configType, keyPath, value) {
    const config = this.getConfig(configType);
    
    // Split path into parts
    const keyParts = keyPath.split('.');
    
    // Find reference to target object
    let target = config;
    for (let i = 0; i < keyParts.length - 1; i++) {
      const part = keyParts[i];
      
      if (!(part in target)) {
        target[part] = {};
      }
      
      target = target[part];
    }
    
    // Set value
    target[keyParts[keyParts.length - 1]] = value;
    
    // Save configuration
    return this.saveConfig(configType, config);
  }
  
  /**
   * Gets a configuration value
   *
   * @param {string} configType - Configuration type
   * @param {string} keyPath - Key path (e.g. 'database.type' or 'servers.brave-search.enabled')
   * @param {any} defaultValue - Default value if the key doesn't exist
   * @returns {any} The configuration value or the default value
   * @throws {ConfigError} If the configuration type is unknown
   */
  getConfigValue(configType, keyPath, defaultValue = undefined) {
    try {
      const config = this.getConfig(configType);

      // Handle special cases for COLOR_SCHEMA and MCP access
      if (configType === CONFIG_TYPES.GLOBAL) {
        // Handle requests for COLOR_SCHEMA through GLOBAL by redirecting to the appropriate config
        if (keyPath === 'COLOR_SCHEMA' || keyPath.startsWith('COLOR_SCHEMA.')) {
          try {
            const colorSchemaConfig = this.getConfig(CONFIG_TYPES.COLOR_SCHEMA);
            if (keyPath === 'COLOR_SCHEMA') {
              return colorSchemaConfig.COLOR_SCHEMA || {
                activeTheme: colorSchemaConfig.userPreferences?.activeTheme || 'dark'
              };
            }

            const subPath = keyPath.substring('COLOR_SCHEMA.'.length);
            return this.getConfigValue(CONFIG_TYPES.COLOR_SCHEMA, subPath, defaultValue);
          } catch (err) {
            console.warn(`Failed to get COLOR_SCHEMA config: ${err.message}`);
            return defaultValue;
          }
        }

        if (keyPath === 'MCP' || keyPath.startsWith('MCP.')) {
          try {
            const mcpConfig = this.getConfig(CONFIG_TYPES.MCP);
            if (keyPath === 'MCP') {
              return mcpConfig;
            }

            const subPath = keyPath.substring('MCP.'.length);
            return this.getConfigValue(CONFIG_TYPES.MCP, subPath, defaultValue);
          } catch (err) {
            console.warn(`Failed to get MCP config: ${err.message}`);
            return defaultValue;
          }
        }
      }

      // Split path into parts
      const keyParts = keyPath.split('.');

      // Navigate through the object
      let target = config;
      for (const part of keyParts) {
        if (target === undefined || target === null || typeof target !== 'object') {
          return defaultValue;
        }

        target = target[part];

        if (target === undefined) {
          return defaultValue;
        }
      }

      return target;
    } catch (err) {
      console.warn(`Error in getConfigValue for ${configType}.${keyPath}: ${err.message}`);
      return defaultValue;
    }
  }
  
  /**
   * Reset a configuration to default values
   * 
   * @param {string} configType - Configuration type
   * @returns {boolean} Success
   * @throws {ConfigError} If the configuration type is unknown
   */
  resetConfig(configType) {
    if (!DEFAULT_CONFIGS[configType]) {
      throw new ConfigError(`Unknown configuration type: ${configType}`);
    }
    
    return this.saveConfig(configType, JSON.parse(JSON.stringify(DEFAULT_CONFIGS[configType])));
  }
  
  /**
   * Check if an API key is available for a specific service
   * 
   * @param {string} service - Service name ('claude', 'voyage', 'brave')
   * @returns {boolean} true if the API key is available, false otherwise
   */
  hasApiKey(service) {
    let apiKeyEnv;
    
    switch (service) {
      case 'claude':
        apiKeyEnv = this.getConfigValue(CONFIG_TYPES.RAG, 'claude.api_key_env', 'CLAUDE_API_KEY');
        break;
      case 'voyage':
        apiKeyEnv = this.getConfigValue(CONFIG_TYPES.RAG, 'embedding.api_key_env', 'VOYAGE_API_KEY');
        break;
      case 'brave':
        apiKeyEnv = this.getConfigValue(CONFIG_TYPES.MCP, 'servers.brave-search.api_key_env', 'BRAVE_API_KEY');
        break;
      default:
        return false;
    }
    
    return Boolean(process.env[apiKeyEnv]);
  }
  
  /**
   * Get environment variables used by the framework
   * 
   * @returns {Object} Environment variables mapping
   */
  getEnvironmentVariables() {
    return {
      CLAUDE_API_KEY: this.getConfigValue(CONFIG_TYPES.RAG, 'claude.api_key_env', 'CLAUDE_API_KEY'),
      VOYAGE_API_KEY: this.getConfigValue(CONFIG_TYPES.RAG, 'embedding.api_key_env', 'VOYAGE_API_KEY'),
      BRAVE_API_KEY: this.getConfigValue(CONFIG_TYPES.MCP, 'servers.brave-search.api_key_env', 'BRAVE_API_KEY'),
      MCP_API_KEY: 'MCP_API_KEY'
    };
  }
  
  /**
   * Export configuration to file
   * 
   * @param {string} configType - Configuration type
   * @param {string} exportPath - Export file path
   * @returns {boolean} Success
   * @throws {ConfigError} If the configuration type is unknown
   */
  exportConfig(configType, exportPath) {
    const config = this.getConfig(configType);
    
    try {
      saveJsonConfig(exportPath, config);
      return true;
    } catch (err) {
      console.error(`Failed to export ${configType} configuration: ${err.message}`);
      throw new ConfigAccessError(`Failed to export configuration to ${exportPath}: ${err.message}`);
    }
  }
  
  /**
   * Import configuration from file
   * 
   * @param {string} configType - Configuration type
   * @param {string} importPath - Import file path
   * @returns {boolean} Success
   * @throws {ConfigError} If the configuration type is unknown
   * @throws {ConfigValidationError} If schema validation fails
   */
  importConfig(configType, importPath) {
    try {
      const config = loadJsonConfig(importPath, null);
      if (!config) {
        throw new ConfigError(`Failed to load configuration from ${importPath}`);
      }
      
      return this.saveConfig(configType, config);
    } catch (err) {
      console.error(`Failed to import ${configType} configuration: ${err.message}`);
      throw err;
    }
  }
}

// Create the singleton instance
const configManager = new ConfigManager();

// Export as constants and singleton
module.exports = configManager;
module.exports.CONFIG_TYPES = CONFIG_TYPES;
module.exports.ConfigError = ConfigError;
module.exports.ConfigValidationError = ConfigValidationError;
module.exports.ConfigAccessError = ConfigAccessError;
module.exports.DEFAULT_CONFIGS = DEFAULT_CONFIGS;