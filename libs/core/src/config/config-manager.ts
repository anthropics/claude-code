/**
 * Configuration Manager for the Claude Neural Framework
 * 
 * This file provides a centralized configuration interface for
 * all components of the Claude Neural Framework.
 * 
 * @module core/config/config-manager
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import { Logger } from '../logging/logger';

/**
 * Supported configuration types
 */
export enum ConfigType {
  RAG = 'rag',
  MCP = 'mcp',
  SECURITY = 'security',
  COLOR_SCHEMA = 'color_schema',
  GLOBAL = 'global',
  USER = 'user',
  I18N = 'i18n'
}

/**
 * Error types for configuration operations
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigValidationError extends ConfigError {
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[] = []) {
    super(message);
    this.name = 'ConfigValidationError';
    this.validationErrors = validationErrors;
  }
}

export class ConfigAccessError extends ConfigError {
  constructor(message: string) {
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
const LOCAL_CONFIG_PATHS: Record<string, string> = {
  [ConfigType.RAG]: path.resolve(__dirname, 'rag_config.json'),
  [ConfigType.MCP]: path.resolve(__dirname, 'mcp_config.json'),
  [ConfigType.SECURITY]: path.resolve(__dirname, 'security_constraints.json'),
  [ConfigType.COLOR_SCHEMA]: path.resolve(__dirname, 'color_schema_config.json'),
  [ConfigType.I18N]: path.resolve(__dirname, 'i18n_config.json')
};

/**
 * Interface for server configuration
 */
interface ServerConfig {
  enabled: boolean;
  autostart: boolean;
  command: string;
  args: string[];
  description: string;
  api_key_env?: string;
}

/**
 * Interface for theme colors
 */
interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  shadow: string;
}

/**
 * Interface for theme
 */
interface Theme {
  name: string;
  colors: ThemeColors;
}

/**
 * Interface for RAG configuration
 */
interface RagConfig {
  version: string;
  database: {
    type: string;
    path: string;
  };
  embedding: {
    model: string;
    api_key_env: string;
  };
  claude: {
    api_key_env: string;
    model: string;
  };
}

/**
 * Interface for MCP configuration
 */
interface McpConfig {
  version: string;
  servers: Record<string, ServerConfig>;
}

/**
 * Interface for Security configuration
 */
interface SecurityConfig {
  version: string;
  mcp: {
    allowed_servers: string[];
    allow_server_autostart: boolean;
    allow_remote_servers: boolean;
  };
  filesystem: {
    allowed_directories: string[];
  };
}

/**
 * Interface for Color Schema configuration
 */
interface ColorSchemaConfig {
  version: string;
  themes: Record<string, Theme>;
  userPreferences: {
    activeTheme: string;
    custom: Theme | null;
  };
}

/**
 * Interface for Global configuration
 */
interface GlobalConfig {
  version: string;
  timezone: string;
  language: string;
  notifications: {
    enabled: boolean;
    showErrors: boolean;
    showWarnings: boolean;
  };
  logging: {
    level: number;
    format: string;
    colorize: boolean;
    timestamp: boolean;
    showSource: boolean;
    showHostname: boolean;
    consoleOutput: boolean;
    fileOutput: boolean;
  };
}

/**
 * Interface for User configuration
 */
interface UserConfig {
  version: string;
  user_id: string;
  name: string;
  preferences: {
    theme: string;
    language: string;
  };
}

/**
 * Interface for I18n configuration
 */
interface I18nConfig {
  version: string;
  locale: string;
  fallbackLocale: string;
  loadPath: string;
  debug: boolean;
  supportedLocales: string[];
  dateFormat: {
    short: Record<string, string>;
    medium: Record<string, string>;
    long: Record<string, string>;
  };
  numberFormat: {
    decimal: Record<string, any>;
    percent: Record<string, any>;
    currency: Record<string, any>;
  };
}

/**
 * Type for all configuration types
 */
type ConfigData = 
  | RagConfig 
  | McpConfig 
  | SecurityConfig 
  | ColorSchemaConfig 
  | GlobalConfig 
  | UserConfig 
  | I18nConfig;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIGS: Record<string, ConfigData> = {
  [ConfigType.GLOBAL]: {
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
  } as GlobalConfig,
  [ConfigType.RAG]: {
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
  } as RagConfig,
  [ConfigType.MCP]: {
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
  } as McpConfig,
  [ConfigType.SECURITY]: {
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
  } as SecurityConfig,
  [ConfigType.COLOR_SCHEMA]: {
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
  } as ColorSchemaConfig,
  [ConfigType.USER]: {
    version: '1.0.0',
    user_id: `user-${Date.now()}`,
    name: 'Default User',
    preferences: {
      theme: 'dark',
      language: 'de'
    }
  } as UserConfig,
  [ConfigType.I18N]: {
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
  } as I18nConfig
};

/**
 * Interface for schema validation
 */
interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Interface for config manager options
 */
interface ConfigManagerOptions {
  globalConfigPath?: string;
  schemaValidation?: boolean;
  environmentOverrides?: boolean;
}

/**
 * Helper function to load a JSON configuration file
 * 
 * @param configPath - Path to the configuration file
 * @param defaultConfig - Default configuration if the file doesn't exist
 * @returns The loaded configuration
 * @throws {ConfigAccessError} If there's an error reading the file
 */
function loadJsonConfig(configPath: string, defaultConfig: Record<string, any> = {}): Record<string, any> {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
  } catch (err) {
    console.warn(`Warning: Error loading configuration from ${configPath}: ${(err as Error).message}`);
    throw new ConfigAccessError(`Failed to load configuration from ${configPath}: ${(err as Error).message}`);
  }
  
  return defaultConfig;
}

/**
 * Helper function to save a JSON configuration file
 * 
 * @param configPath - Path to the configuration file
 * @param config - Configuration to save
 * @returns true on success, false on error
 * @throws {ConfigAccessError} If there's an error writing the file
 */
function saveJsonConfig(configPath: string, config: Record<string, any>): boolean {
  try {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error saving configuration to ${configPath}: ${(err as Error).message}`);
    throw new ConfigAccessError(`Failed to save configuration to ${configPath}: ${(err as Error).message}`);
  }
}

/**
 * Simple schema validation for configuration objects
 * 
 * @param config - Configuration object to validate
 * @param schema - Schema to validate against
 * @returns Validation result {valid: boolean, errors: Array}
 */
function validateConfig(config: Record<string, any>, schema: Record<string, any>): SchemaValidationResult {
  const errors: string[] = [];
  
  function validateObject(obj: Record<string, any>, schemaObj: Record<string, any>, path = '') {
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
            obj[key].forEach((item: any, index: number) => {
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
export class ConfigManager {
  private globalConfigPath: string;
  private schemaValidation: boolean;
  private environmentOverrides: boolean;
  private configs: Record<string, ConfigData | null>;
  private schemas: Record<string, Record<string, any>>;
  private observers: Map<string, Map<string, (config: ConfigData) => void>>;
  private configVersions: Map<string, number>;
  private logger: Logger;

  /**
   * Creates a new instance of ConfigManager
   * 
   * @param options - Configuration options
   */
  constructor(options: ConfigManagerOptions = {}) {
    this.globalConfigPath = options.globalConfigPath || DEFAULT_GLOBAL_CONFIG_PATH;
    this.schemaValidation = options.schemaValidation !== undefined ? options.schemaValidation : true;
    this.environmentOverrides = options.environmentOverrides !== undefined ? options.environmentOverrides : true;
    this.logger = new Logger('ConfigManager');
    
    this.configs = {
      [ConfigType.RAG]: null,
      [ConfigType.MCP]: null,
      [ConfigType.SECURITY]: null,
      [ConfigType.COLOR_SCHEMA]: null,
      [ConfigType.GLOBAL]: null,
      [ConfigType.USER]: null,
      [ConfigType.I18N]: null
    };
    
    this.schemas = {}; // Optional schema validation
    this.observers = new Map(); // For config change notifications
    this.configVersions = new Map(); // Track config versions for cache invalidation
    
    // Ensure global configuration path exists
    if (!fs.existsSync(this.globalConfigPath)) {
      try {
        fs.mkdirSync(this.globalConfigPath, { recursive: true });
      } catch (err) {
        this.logger.error(`Failed to create global configuration directory: ${(err as Error).message}`);
      }
    }
  }
  
  /**
   * Set schema for configuration validation
   * 
   * @param configType - Configuration type
   * @param schema - JSON Schema object
   */
  public setSchema(configType: ConfigType, schema: Record<string, any>): void {
    this.schemas[configType] = schema;
  }
  
  /**
   * Register observer for configuration changes
   * 
   * @param configType - Configuration type
   * @param callback - Callback function(config)
   * @returns Observer ID for unregistering
   */
  public registerObserver(configType: ConfigType, callback: (config: ConfigData) => void): string {
    const observerId = `observer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.observers.has(configType)) {
      this.observers.set(configType, new Map());
    }
    
    this.observers.get(configType)!.set(observerId, callback);
    return observerId;
  }
  
  /**
   * Unregister observer
   * 
   * @param configType - Configuration type
   * @param observerId - Observer ID
   * @returns Success
   */
  public unregisterObserver(configType: ConfigType, observerId: string): boolean {
    if (this.observers.has(configType)) {
      return this.observers.get(configType)!.delete(observerId);
    }
    return false;
  }
  
  /**
   * Notify observers of configuration changes
   * 
   * @param configType - Configuration type
   * @param config - New configuration
   * @private
   */
  private notifyObservers(configType: ConfigType, config: ConfigData): void {
    if (this.observers.has(configType)) {
      this.observers.get(configType)!.forEach(callback => {
        try {
          callback(config);
        } catch (err) {
          this.logger.error(`Error in observer callback for ${configType}`, { error: err });
        }
      });
    }
  }
  
  /**
   * Loads all configurations
   * 
   * @returns All loaded configurations
   */
  public loadAllConfigs(): Record<string, ConfigData | null> {
    // Load local configurations
    Object.entries(LOCAL_CONFIG_PATHS).forEach(([configType, configPath]) => {
      try {
        this.configs[configType] = loadJsonConfig(configPath, DEFAULT_CONFIGS[configType]) as ConfigData;
        this.configVersions.set(configType, Date.now());
      } catch (err) {
        this.logger.error(`Failed to load ${configType} configuration`, { error: err });
        this.configs[configType] = DEFAULT_CONFIGS[configType];
      }
    });
    
    // Load global configuration
    try {
      const globalConfigPath = path.join(this.globalConfigPath, 'config.json');
      this.configs[ConfigType.GLOBAL] = loadJsonConfig(globalConfigPath, DEFAULT_CONFIGS[ConfigType.GLOBAL]) as GlobalConfig;
      this.configVersions.set(ConfigType.GLOBAL, Date.now());
    } catch (err) {
      this.logger.error(`Failed to load global configuration`, { error: err });
      this.configs[ConfigType.GLOBAL] = DEFAULT_CONFIGS[ConfigType.GLOBAL] as GlobalConfig;
    }
    
    // Load user configuration
    try {
      const userConfigPath = path.join(this.globalConfigPath, 'user.about.json');
      this.configs[ConfigType.USER] = loadJsonConfig(userConfigPath, DEFAULT_CONFIGS[ConfigType.USER]) as UserConfig;
      this.configVersions.set(ConfigType.USER, Date.now());
    } catch (err) {
      this.logger.error(`Failed to load user configuration`, { error: err });
      this.configs[ConfigType.USER] = DEFAULT_CONFIGS[ConfigType.USER] as UserConfig;
    }
    
    return this.configs;
  }
  
  /**
   * Loads a specific configuration
   * 
   * @param configType - Configuration type
   * @returns The loaded configuration
   * @throws {ConfigError} If the configuration type is unknown
   */
  public getConfig<T extends ConfigData>(configType: ConfigType): T {
    if (!this.configs[configType]) {
      if (configType === ConfigType.GLOBAL) {
        try {
          const globalConfigPath = path.join(this.globalConfigPath, 'config.json');
          this.configs[configType] = loadJsonConfig(globalConfigPath, DEFAULT_CONFIGS[ConfigType.GLOBAL]) as GlobalConfig;
          this.configVersions.set(configType, Date.now());
        } catch (err) {
          this.logger.error(`Failed to load global configuration`, { error: err });
          this.configs[configType] = DEFAULT_CONFIGS[ConfigType.GLOBAL] as GlobalConfig;
        }
      } else if (configType === ConfigType.USER) {
        try {
          const userConfigPath = path.join(this.globalConfigPath, 'user.about.json');
          this.configs[configType] = loadJsonConfig(userConfigPath, DEFAULT_CONFIGS[ConfigType.USER]) as UserConfig;
          this.configVersions.set(configType, Date.now());
        } catch (err) {
          this.logger.error(`Failed to load user configuration`, { error: err });
          this.configs[configType] = DEFAULT_CONFIGS[ConfigType.USER] as UserConfig;
        }
      } else if (LOCAL_CONFIG_PATHS[configType]) {
        try {
          this.configs[configType] = loadJsonConfig(LOCAL_CONFIG_PATHS[configType], DEFAULT_CONFIGS[configType]) as ConfigData;
          this.configVersions.set(configType, Date.now());
        } catch (err) {
          this.logger.error(`Failed to load ${configType} configuration`, { error: err });
          this.configs[configType] = DEFAULT_CONFIGS[configType];
        }
      } else {
        throw new ConfigError(`Unknown configuration type: ${configType}`);
      }
    }
    
    // Apply environment overrides
    if (this.environmentOverrides) {
      this.applyEnvironmentOverrides(configType, this.configs[configType]!);
    }
    
    return this.configs[configType] as T;
  }
  
  /**
   * Apply environment variable overrides to configuration
   * Environment variables follow the pattern: CNF_[CONFIG_TYPE]_[KEY_PATH]
   * Example: CNF_RAG_DATABASE_TYPE="lancedb"
   * 
   * @param configType - Configuration type
   * @param config - Configuration object
   * @private
   */
  private applyEnvironmentOverrides(configType: ConfigType, config: ConfigData): void {
    const prefix = `CNF_${configType.toUpperCase()}_`;
    
    Object.keys(process.env)
      .filter(key => key.startsWith(prefix))
      .forEach(key => {
        const keyPath = key.substring(prefix.length).toLowerCase().replace(/_/g, '.');
        const value = process.env[key]!;
        
        // Try to parse as JSON, fall back to string
        let parsedValue: any = value;
        try {
          parsedValue = JSON.parse(value);
        } catch (e) {
          // If not valid JSON, keep as string
        }
        
        this.setConfigValueByPath(config as Record<string, any>, keyPath, parsedValue);
      });
  }
  
  /**
   * Set configuration value by path
   * 
   * @param config - Configuration object
   * @param keyPath - Key path (e.g. 'database.type')
   * @param value - Value to set
   * @private
   */
  private setConfigValueByPath(config: Record<string, any>, keyPath: string, value: any): void {
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
   * @param configType - Configuration type
   * @param config - Configuration to save
   * @returns Success
   * @throws {ConfigError} If the configuration type is unknown
   * @throws {ConfigValidationError} If schema validation fails
   */
  public saveConfig(configType: ConfigType, config: ConfigData): boolean {
    // Validate the configuration if schema is available
    if (this.schemaValidation && this.schemas[configType]) {
      const validation = validateConfig(config as Record<string, any>, this.schemas[configType]);
      if (!validation.valid) {
        throw new ConfigValidationError(
          `Invalid configuration for ${configType}`,
          validation.errors
        );
      }
    }
    
    this.configs[configType] = config;
    this.configVersions.set(configType, Date.now());
    
    if (configType === ConfigType.GLOBAL) {
      try {
        const globalConfigPath = path.join(this.globalConfigPath, 'config.json');
        saveJsonConfig(globalConfigPath, config as Record<string, any>);
        this.notifyObservers(configType, config);
        return true;
      } catch (err) {
        this.logger.error(`Failed to save global configuration`, { error: err });
        throw err;
      }
    } else if (configType === ConfigType.USER) {
      try {
        const userConfigPath = path.join(this.globalConfigPath, 'user.about.json');
        saveJsonConfig(userConfigPath, config as Record<string, any>);
        this.notifyObservers(configType, config);
        return true;
      } catch (err) {
        this.logger.error(`Failed to save user configuration`, { error: err });
        throw err;
      }
    } else if (LOCAL_CONFIG_PATHS[configType]) {
      try {
        saveJsonConfig(LOCAL_CONFIG_PATHS[configType], config as Record<string, any>);
        this.notifyObservers(configType, config);
        return true;
      } catch (err) {
        this.logger.error(`Failed to save ${configType} configuration`, { error: err });
        throw err;
      }
    } else {
      throw new ConfigError(`Unknown configuration type: ${configType}`);
    }
  }
  
  /**
   * Updates a configuration value
   * 
   * @param configType - Configuration type
   * @param keyPath - Key path (e.g. 'database.type' or 'servers.brave-search.enabled')
   * @param value - New value
   * @returns Success
   * @throws {ConfigError} If the configuration type is unknown
   */
  public updateConfigValue(configType: ConfigType, keyPath: string, value: any): boolean {
    const config = this.getConfig(configType);
    
    // Split path into parts
    const keyParts = keyPath.split('.');
    
    // Find reference to target object
    let target = config as Record<string, any>;
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
   * @param configType - Configuration type
   * @param keyPath - Key path (e.g. 'database.type' or 'servers.brave-search.enabled')
   * @param defaultValue - Default value if the key doesn't exist
   * @returns The configuration value or the default value
   * @throws {ConfigError} If the configuration type is unknown
   */
  public getConfigValue<T = any>(configType: ConfigType, keyPath: string, defaultValue?: T): T {
    try {
      const config = this.getConfig(configType);

      // Handle special cases for COLOR_SCHEMA and MCP access
      if (configType === ConfigType.GLOBAL) {
        // Handle requests for COLOR_SCHEMA through GLOBAL by redirecting to the appropriate config
        if (keyPath === 'COLOR_SCHEMA' || keyPath.startsWith('COLOR_SCHEMA.')) {
          try {
            const colorSchemaConfig = this.getConfig<ColorSchemaConfig>(ConfigType.COLOR_SCHEMA);
            if (keyPath === 'COLOR_SCHEMA') {
              return {
                activeTheme: colorSchemaConfig.userPreferences?.activeTheme || 'dark'
              } as unknown as T;
            }

            const subPath = keyPath.substring('COLOR_SCHEMA.'.length);
            return this.getConfigValue<T>(ConfigType.COLOR_SCHEMA, subPath, defaultValue);
          } catch (err) {
            this.logger.warn(`Failed to get COLOR_SCHEMA config`, { error: err });
            return defaultValue as T;
          }
        }

        if (keyPath === 'MCP' || keyPath.startsWith('MCP.')) {
          try {
            const mcpConfig = this.getConfig<McpConfig>(ConfigType.MCP);
            if (keyPath === 'MCP') {
              return mcpConfig as unknown as T;
            }

            const subPath = keyPath.substring('MCP.'.length);
            return this.getConfigValue<T>(ConfigType.MCP, subPath, defaultValue);
          } catch (err) {
            this.logger.warn(`Failed to get MCP config`, { error: err });
            return defaultValue as T;
          }
        }
      }

      // Split path into parts
      const keyParts = keyPath.split('.');

      // Navigate through the object
      let target: any = config;
      for (const part of keyParts) {
        if (target === undefined || target === null || typeof target !== 'object') {
          return defaultValue as T;
        }

        target = target[part];

        if (target === undefined) {
          return defaultValue as T;
        }
      }

      return target as T;
    } catch (err) {
      this.logger.warn(`Error in getConfigValue for ${configType}.${keyPath}`, { error: err });
      return defaultValue as T;
    }
  }
  
  /**
   * Reset a configuration to default values
   * 
   * @param configType - Configuration type
   * @returns Success
   * @throws {ConfigError} If the configuration type is unknown
   */
  public resetConfig(configType: ConfigType): boolean {
    if (!DEFAULT_CONFIGS[configType]) {
      throw new ConfigError(`Unknown configuration type: ${configType}`);
    }
    
    return this.saveConfig(configType, JSON.parse(JSON.stringify(DEFAULT_CONFIGS[configType])));
  }
  
  /**
   * Check if an API key is available for a specific service
   * 
   * @param service - Service name ('claude', 'voyage', 'brave')
   * @returns true if the API key is available, false otherwise
   */
  public hasApiKey(service: 'claude' | 'voyage' | 'brave'): boolean {
    let apiKeyEnv: string;
    
    switch (service) {
      case 'claude':
        apiKeyEnv = this.getConfigValue<string>(ConfigType.RAG, 'claude.api_key_env', 'CLAUDE_API_KEY');
        break;
      case 'voyage':
        apiKeyEnv = this.getConfigValue<string>(ConfigType.RAG, 'embedding.api_key_env', 'VOYAGE_API_KEY');
        break;
      case 'brave':
        apiKeyEnv = this.getConfigValue<string>(ConfigType.MCP, 'servers.brave-search.api_key_env', 'BRAVE_API_KEY');
        break;
      default:
        return false;
    }
    
    return Boolean(process.env[apiKeyEnv]);
  }
  
  /**
   * Get environment variables used by the framework
   * 
   * @returns Environment variables mapping
   */
  public getEnvironmentVariables(): Record<string, string> {
    return {
      CLAUDE_API_KEY: this.getConfigValue<string>(ConfigType.RAG, 'claude.api_key_env', 'CLAUDE_API_KEY'),
      VOYAGE_API_KEY: this.getConfigValue<string>(ConfigType.RAG, 'embedding.api_key_env', 'VOYAGE_API_KEY'),
      BRAVE_API_KEY: this.getConfigValue<string>(ConfigType.MCP, 'servers.brave-search.api_key_env', 'BRAVE_API_KEY'),
      MCP_API_KEY: 'MCP_API_KEY'
    };
  }
  
  /**
   * Export configuration to file
   * 
   * @param configType - Configuration type
   * @param exportPath - Export file path
   * @returns Success
   * @throws {ConfigError} If the configuration type is unknown
   */
  public exportConfig(configType: ConfigType, exportPath: string): boolean {
    const config = this.getConfig(configType);
    
    try {
      saveJsonConfig(exportPath, config as Record<string, any>);
      return true;
    } catch (err) {
      this.logger.error(`Failed to export ${configType} configuration`, { error: err });
      throw new ConfigAccessError(`Failed to export configuration to ${exportPath}: ${(err as Error).message}`);
    }
  }
  
  /**
   * Import configuration from file
   * 
   * @param configType - Configuration type
   * @param importPath - Import file path
   * @returns Success
   * @throws {ConfigError} If the configuration type is unknown
   * @throws {ConfigValidationError} If schema validation fails
   */
  public importConfig(configType: ConfigType, importPath: string): boolean {
    try {
      const config = loadJsonConfig(importPath, null);
      if (!config) {
        throw new ConfigError(`Failed to load configuration from ${importPath}`);
      }
      
      return this.saveConfig(configType, config as ConfigData);
    } catch (err) {
      this.logger.error(`Failed to import ${configType} configuration`, { error: err });
      throw err;
    }
  }
}

// Create the singleton instance
const configManager = new ConfigManager();

// Export as default
export default configManager;