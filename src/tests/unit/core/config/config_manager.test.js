/**
 * Configuration Manager Tests
 * 
 * Unit tests for the configuration manager module.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import test helpers
const { createTempTestDir, removeTempTestDir, createMockConfig } = require('../../../utils/test-helpers');

// Import the module to test
const configManager = require('../../../../core/config/config_manager');
const {
  CONFIG_TYPES,
  ConfigError,
  ConfigValidationError,
  ConfigAccessError
} = configManager;

describe('ConfigManager', () => {
  let tempDir;
  let tempConfigPaths = {};
  
  // Setup before each test
  beforeEach(() => {
    // Create a temporary directory for test configs
    tempDir = createTempTestDir();
    
    // Create mock configuration files
    tempConfigPaths = {
      [CONFIG_TYPES.RAG]: path.join(tempDir, 'rag_config.json'),
      [CONFIG_TYPES.MCP]: path.join(tempDir, 'mcp_config.json'),
      [CONFIG_TYPES.SECURITY]: path.join(tempDir, 'security_constraints.json'),
      [CONFIG_TYPES.I18N]: path.join(tempDir, 'i18n_config.json')
    };
    
    // Create basic config files
    fs.writeFileSync(
      tempConfigPaths[CONFIG_TYPES.RAG],
      JSON.stringify({ version: '1.0.0', test: true }, null, 2),
      'utf8'
    );
    
    fs.writeFileSync(
      tempConfigPaths[CONFIG_TYPES.MCP],
      JSON.stringify({ version: '1.0.0', servers: { test: { enabled: true } } }, null, 2),
      'utf8'
    );
    
    fs.writeFileSync(
      tempConfigPaths[CONFIG_TYPES.SECURITY],
      JSON.stringify({ version: '1.0.0', mcp: { allowed_servers: ['test'] } }, null, 2),
      'utf8'
    );
    
    fs.writeFileSync(
      tempConfigPaths[CONFIG_TYPES.I18N],
      JSON.stringify({ version: '1.0.0', locale: 'en', supportedLocales: ['en', 'fr'] }, null, 2),
      'utf8'
    );
    
    // Mock environment variables
    process.env.CNF_RAG_TEST_ENV = 'test-env-value';
    process.env.CNF_MCP_SERVERS_TEST_TIMEOUT = '5000';
  });
  
  // Cleanup after each test
  afterEach(() => {
    // Clean up temp directory
    removeTempTestDir(tempDir);
    
    // Clean up environment variables
    delete process.env.CNF_RAG_TEST_ENV;
    delete process.env.CNF_MCP_SERVERS_TEST_TIMEOUT;
    
    // Reset config manager state
    configManager.configs = {
      [CONFIG_TYPES.RAG]: null,
      [CONFIG_TYPES.MCP]: null,
      [CONFIG_TYPES.SECURITY]: null,
      [CONFIG_TYPES.COLOR_SCHEMA]: null,
      [CONFIG_TYPES.GLOBAL]: null,
      [CONFIG_TYPES.USER]: null,
      [CONFIG_TYPES.I18N]: null
    };
  });
  
  describe('CONFIG_TYPES enum', () => {
    test('should have all required configuration types', () => {
      expect(CONFIG_TYPES.RAG).toBe('rag');
      expect(CONFIG_TYPES.MCP).toBe('mcp');
      expect(CONFIG_TYPES.SECURITY).toBe('security');
      expect(CONFIG_TYPES.COLOR_SCHEMA).toBe('color_schema');
      expect(CONFIG_TYPES.GLOBAL).toBe('global');
      expect(CONFIG_TYPES.USER).toBe('user');
      expect(CONFIG_TYPES.I18N).toBe('i18n');
    });
  });
  
  describe('Error classes', () => {
    test('ConfigError should be an instance of Error', () => {
      const error = new ConfigError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConfigError');
      expect(error.message).toBe('Test error');
    });
    
    test('ConfigValidationError should be an instance of ConfigError', () => {
      const error = new ConfigValidationError('Validation error', ['error1', 'error2']);
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.name).toBe('ConfigValidationError');
      expect(error.message).toBe('Validation error');
      expect(error.validationErrors).toEqual(['error1', 'error2']);
    });
    
    test('ConfigAccessError should be an instance of ConfigError', () => {
      const error = new ConfigAccessError('Access error');
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.name).toBe('ConfigAccessError');
      expect(error.message).toBe('Access error');
    });
  });
  
  describe('getConfig method', () => {
    test('should load a configuration file if it exists', () => {
      // Override LOCAL_CONFIG_PATHS for testing
      const originalPaths = { ...configManager.LOCAL_CONFIG_PATHS };
      configManager.LOCAL_CONFIG_PATHS = tempConfigPaths;
      
      try {
        const config = configManager.getConfig(CONFIG_TYPES.RAG);
        expect(config).toEqual({ version: '1.0.0', test: true, test_env: 'test-env-value' });
      } finally {
        // Restore original paths
        configManager.LOCAL_CONFIG_PATHS = originalPaths;
      }
    });
    
    test('should use default config if the file does not exist', () => {
      // Override LOCAL_CONFIG_PATHS for testing with non-existent file
      const originalPaths = { ...configManager.LOCAL_CONFIG_PATHS };
      configManager.LOCAL_CONFIG_PATHS = {
        ...tempConfigPaths,
        [CONFIG_TYPES.COLOR_SCHEMA]: path.join(tempDir, 'non_existent_config.json')
      };
      
      try {
        const config = configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA);
        expect(config).toBeDefined();
        expect(config.version).toBe('1.0.0');
        expect(config.themes).toBeDefined();
      } finally {
        // Restore original paths
        configManager.LOCAL_CONFIG_PATHS = originalPaths;
      }
    });
    
    test('should throw ConfigError for unknown configuration type', () => {
      expect(() => {
        configManager.getConfig('unknown_type');
      }).toThrow(ConfigError);
    });
  });
  
  describe('getConfigValue method', () => {
    test('should get a value from configuration by path', () => {
      // Override LOCAL_CONFIG_PATHS for testing
      const originalPaths = { ...configManager.LOCAL_CONFIG_PATHS };
      configManager.LOCAL_CONFIG_PATHS = tempConfigPaths;
      
      try {
        const value = configManager.getConfigValue(CONFIG_TYPES.MCP, 'servers.test.enabled');
        expect(value).toBe(true);
      } finally {
        // Restore original paths
        configManager.LOCAL_CONFIG_PATHS = originalPaths;
      }
    });
    
    test('should return default value if path does not exist', () => {
      // Override LOCAL_CONFIG_PATHS for testing
      const originalPaths = { ...configManager.LOCAL_CONFIG_PATHS };
      configManager.LOCAL_CONFIG_PATHS = tempConfigPaths;
      
      try {
        const value = configManager.getConfigValue(CONFIG_TYPES.MCP, 'non.existent.path', 'default-value');
        expect(value).toBe('default-value');
      } finally {
        // Restore original paths
        configManager.LOCAL_CONFIG_PATHS = originalPaths;
      }
    });
  });
  
  describe('updateConfigValue method', () => {
    test('should update a configuration value by path', () => {
      // Mock saveConfig
      const originalSaveConfig = configManager.saveConfig;
      configManager.saveConfig = jest.fn().mockReturnValue(true);
      
      // Override LOCAL_CONFIG_PATHS for testing
      const originalPaths = { ...configManager.LOCAL_CONFIG_PATHS };
      configManager.LOCAL_CONFIG_PATHS = tempConfigPaths;
      
      try {
        // Load the config first
        configManager.getConfig(CONFIG_TYPES.MCP);
        
        // Update a value
        configManager.updateConfigValue(CONFIG_TYPES.MCP, 'servers.test.timeout', 10000);
        
        // Check the update
        expect(configManager.configs[CONFIG_TYPES.MCP].servers.test.timeout).toBe(10000);
        expect(configManager.saveConfig).toHaveBeenCalled();
      } finally {
        // Restore original functions and paths
        configManager.saveConfig = originalSaveConfig;
        configManager.LOCAL_CONFIG_PATHS = originalPaths;
      }
    });
    
    test('should create intermediate objects if needed', () => {
      // Mock saveConfig
      const originalSaveConfig = configManager.saveConfig;
      configManager.saveConfig = jest.fn().mockReturnValue(true);
      
      // Override LOCAL_CONFIG_PATHS for testing
      const originalPaths = { ...configManager.LOCAL_CONFIG_PATHS };
      configManager.LOCAL_CONFIG_PATHS = tempConfigPaths;
      
      try {
        // Load the config first
        configManager.getConfig(CONFIG_TYPES.MCP);
        
        // Update a deeply nested value
        configManager.updateConfigValue(CONFIG_TYPES.MCP, 'servers.new.nested.deep.value', true);
        
        // Check the update
        expect(configManager.configs[CONFIG_TYPES.MCP].servers.new.nested.deep.value).toBe(true);
        expect(configManager.saveConfig).toHaveBeenCalled();
      } finally {
        // Restore original functions and paths
        configManager.saveConfig = originalSaveConfig;
        configManager.LOCAL_CONFIG_PATHS = originalPaths;
      }
    });
  });
  
  describe('Observer pattern', () => {
    test('should register, notify, and unregister observers', () => {
      // Override LOCAL_CONFIG_PATHS for testing
      const originalPaths = { ...configManager.LOCAL_CONFIG_PATHS };
      configManager.LOCAL_CONFIG_PATHS = tempConfigPaths;
      
      try {
        // Create mock observer
        const observer = jest.fn();
        
        // Register observer
        const observerId = configManager.registerObserver(CONFIG_TYPES.MCP, observer);
        expect(observerId).toBeDefined();
        
        // Mock saveConfig to call notifyObservers
        const originalSaveConfig = configManager.saveConfig;
        const originalNotifyObservers = configManager.notifyObservers;
        
        configManager.saveConfig = jest.fn().mockImplementation((configType, config) => {
          configManager.notifyObservers(configType, config);
          return true;
        });
        
        // Update config
        configManager.configs[CONFIG_TYPES.MCP] = { version: '1.0.0', updated: true };
        configManager.saveConfig(CONFIG_TYPES.MCP, configManager.configs[CONFIG_TYPES.MCP]);
        
        // Check if observer was notified
        expect(observer).toHaveBeenCalledWith(configManager.configs[CONFIG_TYPES.MCP]);
        
        // Unregister observer
        const unregistered = configManager.unregisterObserver(CONFIG_TYPES.MCP, observerId);
        expect(unregistered).toBe(true);
        
        // Reset mocks
        observer.mockClear();
        
        // Update again
        configManager.configs[CONFIG_TYPES.MCP] = { version: '1.0.0', updated: false };
        configManager.saveConfig(CONFIG_TYPES.MCP, configManager.configs[CONFIG_TYPES.MCP]);
        
        // Observer should not be called
        expect(observer).not.toHaveBeenCalled();
        
        // Restore original functions
        configManager.saveConfig = originalSaveConfig;
        configManager.notifyObservers = originalNotifyObservers;
      } finally {
        // Restore original paths
        configManager.LOCAL_CONFIG_PATHS = originalPaths;
      }
    });
  });
  
  describe('Environment variable overrides', () => {
    test('should apply environment variable overrides', () => {
      // Override LOCAL_CONFIG_PATHS for testing
      const originalPaths = { ...configManager.LOCAL_CONFIG_PATHS };
      configManager.LOCAL_CONFIG_PATHS = tempConfigPaths;
      
      try {
        // Set environment variables
        process.env.CNF_RAG_NEW_SETTING = 'new-value';
        process.env.CNF_RAG_NESTED_SETTING = '{"key":"value"}';
        
        // Get config
        const config = configManager.getConfig(CONFIG_TYPES.RAG);
        
        // Check overrides
        expect(config.test_env).toBe('test-env-value');
        expect(config.new_setting).toBe('new-value');
        expect(config.nested_setting).toEqual({ key: 'value' });
      } finally {
        // Restore original paths
        configManager.LOCAL_CONFIG_PATHS = originalPaths;
        
        // Clean up environment variables
        delete process.env.CNF_RAG_NEW_SETTING;
        delete process.env.CNF_RAG_NESTED_SETTING;
      }
    });
  });
  
  describe('hasApiKey method', () => {
    test('should check if API key is available for a service', () => {
      // Mock process.env
      const originalEnv = process.env;
      process.env = {
        ...process.env,
        CLAUDE_API_KEY: 'test-claude-key',
        VOYAGE_API_KEY: 'test-voyage-key'
      };
      
      // Override getConfigValue
      const originalGetConfigValue = configManager.getConfigValue;
      configManager.getConfigValue = jest.fn().mockImplementation((configType, keyPath, defaultValue) => {
        if (keyPath === 'claude.api_key_env') return 'CLAUDE_API_KEY';
        if (keyPath === 'embedding.api_key_env') return 'VOYAGE_API_KEY';
        if (keyPath === 'servers.brave-search.api_key_env') return 'BRAVE_API_KEY';
        return defaultValue;
      });
      
      try {
        // Check API keys
        expect(configManager.hasApiKey('claude')).toBe(true);
        expect(configManager.hasApiKey('voyage')).toBe(true);
        expect(configManager.hasApiKey('brave')).toBe(false); // No BRAVE_API_KEY in env
        expect(configManager.hasApiKey('unknown')).toBe(false);
      } finally {
        // Restore original env and function
        process.env = originalEnv;
        configManager.getConfigValue = originalGetConfigValue;
      }
    });
  });
});