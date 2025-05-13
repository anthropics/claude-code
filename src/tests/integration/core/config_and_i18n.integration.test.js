/**
 * Integration Tests for Config and I18n
 * 
 * Tests the integration between the configuration system and internationalization.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import test helpers
const { createTempTestDir, removeTempTestDir } = require('../../utils/test-helpers');

// Import modules to test
const configManager = require('../../../core/config/config_manager');
const { CONFIG_TYPES } = configManager;
const { I18n } = require('../../../core/i18n/i18n');

describe('Configuration and I18n Integration', () => {
  let tempDir;
  let globalConfigDir;
  let localesDir;
  
  // Setup before each test
  beforeEach(() => {
    // Create temporary directories
    tempDir = createTempTestDir();
    globalConfigDir = path.join(tempDir, '.claude');
    localesDir = path.join(tempDir, 'locales');
    
    // Create required directories
    fs.mkdirSync(globalConfigDir, { recursive: true });
    fs.mkdirSync(localesDir, { recursive: true });
    
    // Create test locale files
    fs.writeFileSync(
      path.join(localesDir, 'en.json'),
      JSON.stringify({
        test: {
          greeting: 'Hello, {{name}}!',
          count: '{{count}} item|{{count}} items'
        }
      }, null, 2),
      'utf8'
    );
    
    fs.writeFileSync(
      path.join(localesDir, 'fr.json'),
      JSON.stringify({
        test: {
          greeting: 'Bonjour, {{name}} !',
          count: '{{count}} élément|{{count}} éléments'
        }
      }, null, 2),
      'utf8'
    );
    
    // Create config file
    fs.writeFileSync(
      path.join(tempDir, 'i18n_config.json'),
      JSON.stringify({
        version: '1.0.0',
        locale: 'en',
        fallbackLocale: 'en',
        loadPath: path.join(localesDir, '{{lng}}.json'),
        debug: false,
        supportedLocales: ['en', 'fr']
      }, null, 2),
      'utf8'
    );
    
    // Backup original functions
    this.originalGlobalConfigPath = configManager.globalConfigPath;
    this.originalConfigPaths = { ...configManager.LOCAL_CONFIG_PATHS };
    
    // Set config paths for testing
    configManager.globalConfigPath = globalConfigDir;
    configManager.LOCAL_CONFIG_PATHS = {
      ...configManager.LOCAL_CONFIG_PATHS,
      [CONFIG_TYPES.I18N]: path.join(tempDir, 'i18n_config.json')
    };
    
    // Reset config cache
    configManager.configs[CONFIG_TYPES.I18N] = null;
  });
  
  // Cleanup after each test
  afterEach(() => {
    // Remove temp directory
    removeTempTestDir(tempDir);
    
    // Restore original values
    configManager.globalConfigPath = this.originalGlobalConfigPath;
    configManager.LOCAL_CONFIG_PATHS = this.originalConfigPaths;
    
    // Reset config cache
    configManager.configs[CONFIG_TYPES.I18N] = null;
  });
  
  test('I18n should load configuration from config manager', () => {
    // Create I18n instance
    const i18n = new I18n();
    
    // Check if config was loaded
    expect(i18n.locale).toBe('en');
    expect(i18n.fallbackLocale).toBe('en');
    expect(i18n.supportedLocales).toEqual(['en', 'fr']);
    
    // Should have loaded correct message files
    expect(i18n.messages.en).toBeDefined();
    expect(i18n.messages.en.test.greeting).toBe('Hello, {{name}}!');
  });
  
  test('I18n should handle locale changes from config', () => {
    // Create I18n instance
    const i18n = new I18n();
    
    // Initial translation in English
    expect(i18n.translate('test.greeting', { name: 'World' })).toBe('Hello, World!');
    
    // Update config to change locale
    configManager.updateConfigValue = jest.fn().mockImplementation((configType, keyPath, value) => {
      if (configType === CONFIG_TYPES.I18N && keyPath === 'locale') {
        // Simulate config change
        configManager.configs[CONFIG_TYPES.I18N] = {
          ...configManager.configs[CONFIG_TYPES.I18N],
          locale: value
        };
        
        // Notify observers
        if (configManager.observers.has(configType)) {
          configManager.observers.get(configType).forEach(callback => {
            callback(configManager.configs[configType]);
          });
        }
        
        return true;
      }
      return false;
    });
    
    // Change locale through config
    configManager.updateConfigValue(CONFIG_TYPES.I18N, 'locale', 'fr');
    
    // Translation should now be in French
    expect(i18n.translate('test.greeting', { name: 'World' })).toBe('Bonjour, World !');
  });
  
  test('I18n should work with config for date and number formatting', () => {
    // Create config with format options
    const configWithFormats = {
      ...configManager.configs[CONFIG_TYPES.I18N],
      dateFormat: {
        short: {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }
      },
      numberFormat: {
        percent: {
          style: 'percent',
          maximumFractionDigits: 0
        }
      }
    };
    
    // Update config
    configManager.configs[CONFIG_TYPES.I18N] = configWithFormats;
    
    // Create I18n instance
    const i18n = new I18n();
    
    // Mock Intl formatters to make tests deterministic
    const originalDateTimeFormat = Intl.DateTimeFormat;
    const originalNumberFormat = Intl.NumberFormat;
    
    Intl.DateTimeFormat = jest.fn().mockImplementation((locale, options) => ({
      format: () => '01/01/2023'
    }));
    
    Intl.NumberFormat = jest.fn().mockImplementation((locale, options) => ({
      format: () => options.style === 'percent' ? '50%' : '123.45'
    }));
    
    try {
      // Format date using config options
      const date = new Date(2023, 0, 1);
      const formattedDate = i18n.formatDate(date, 'short');
      expect(formattedDate).toBe('01/01/2023');
      
      // Format number using config options
      const number = 0.5;
      const formattedNumber = i18n.formatNumber(number, 'percent');
      expect(formattedNumber).toBe('50%');
    } finally {
      // Restore originals
      Intl.DateTimeFormat = originalDateTimeFormat;
      Intl.NumberFormat = originalNumberFormat;
    }
  });
  
  test('I18n should react to the config observer pattern', () => {
    // Create I18n instance
    const i18n = new I18n();
    
    // Should register an observer for config changes
    expect(configManager.registerObserver).toHaveBeenCalledWith(
      CONFIG_TYPES.I18N,
      expect.any(Function)
    );
    
    // Get observer callback
    const observerId = configManager.registerObserver.mock.calls[0][1];
    
    // Initial state
    expect(i18n.locale).toBe('en');
    
    // Simulate config change
    const updatedConfig = {
      ...configManager.configs[CONFIG_TYPES.I18N],
      locale: 'fr'
    };
    
    // Call the observer callback directly
    configManager.observers.get(CONFIG_TYPES.I18N).forEach(callback => {
      callback(updatedConfig);
    });
    
    // Locale should be updated
    expect(i18n.locale).toBe('fr');
  });
});