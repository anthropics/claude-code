/**
 * Internationalization Tests
 * 
 * Unit tests for the i18n module.
 */

const fs = require('fs');
const path = require('path');

// Import test helpers
const { createTempTestDir, removeTempTestDir } = require('../../../utils/test-helpers');
const { createMockLogger, createMockConfigManager } = require('../../../utils/mock-factories');

// Mock logger
jest.mock('../../../../core/logging/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn()
  })
}));

// Mock config manager
jest.mock('../../../../core/config/config_manager', () => {
  const configManagerMock = {
    CONFIG_TYPES: {
      I18N: 'i18n'
    },
    getConfig: jest.fn().mockReturnValue({
      locale: 'en',
      fallbackLocale: 'en',
      loadPath: 'core/i18n/locales/{{lng}}.json',
      debug: false,
      supportedLocales: ['en', 'fr'],
      dateFormat: {
        short: {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        }
      },
      numberFormat: {
        decimal: {
          style: 'decimal',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      }
    }),
    getConfigValue: jest.fn().mockImplementation((configType, keyPath, defaultValue) => {
      if (keyPath === 'locale') return 'en';
      if (keyPath === 'fallbackLocale') return 'en';
      if (keyPath === 'debug') return false;
      if (keyPath === 'supportedLocales') return ['en', 'fr'];
      return defaultValue;
    }),
    registerObserver: jest.fn().mockReturnValue('mock-observer-id')
  };
  
  return configManagerMock;
});

// Mock fs module for reading locale files
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockImplementation((filePath) => {
    if (filePath.includes('en.json')) {
      return JSON.stringify({
        common: {
          welcome: 'Welcome to the Claude Neural Framework',
          greeting: 'Hello, {{name}}!',
          fileCount: '{{count}} file|{{count}} files',
          items: 'one item|{count} items',
          back: 'Back',
          next: 'Next'
        },
        errors: {
          notFound: 'Resource not found',
          serverError: 'Server error occurred: {{message}}'
        }
      });
    } else if (filePath.includes('fr.json')) {
      return JSON.stringify({
        common: {
          welcome: 'Bienvenue au Claude Neural Framework',
          greeting: 'Bonjour, {{name}} !',
          fileCount: '{{count}} fichier|{{count}} fichiers',
          back: 'Retour',
          next: 'Suivant'
        },
        errors: {
          notFound: 'Ressource introuvable',
          serverError: 'Erreur du serveur: {{message}}'
        }
      });
    }
    throw new Error(`Mock file not found: ${filePath}`);
  }),
  existsSync: jest.fn().mockImplementation((filePath) => {
    return filePath.includes('en.json') || filePath.includes('fr.json');
  })
}));

// Import the module to test
const { I18n } = require('../../../../core/i18n/i18n');

describe('I18n Module', () => {
  let i18n;
  
  // Setup before each test
  beforeEach(() => {
    // Create a new I18n instance
    i18n = new I18n();
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('Constructor', () => {
    test('should initialize with config values', () => {
      expect(i18n.locale).toBe('en');
      expect(i18n.fallbackLocale).toBe('en');
      expect(i18n.debug).toBe(false);
      expect(i18n.supportedLocales).toEqual(['en', 'fr']);
      expect(i18n.messages).toBeDefined();
    });
    
    test('should initialize with default values if no config', () => {
      // Mock getConfig to return null
      const configManager = require('../../../../core/config/config_manager');
      configManager.getConfig.mockReturnValueOnce(null);
      
      const defaultI18n = new I18n();
      
      expect(defaultI18n.locale).toBe('en');
      expect(defaultI18n.fallbackLocale).toBe('en');
      expect(defaultI18n.debug).toBe(false);
      expect(defaultI18n.supportedLocales).toEqual(['en']);
    });
    
    test('should load messages for configured locale', () => {
      expect(i18n.messages.en).toBeDefined();
      expect(i18n.messages.en.common).toBeDefined();
      expect(i18n.messages.en.common.welcome).toBe('Welcome to the Claude Neural Framework');
    });
  });
  
  describe('translate method', () => {
    test('should translate a simple message', () => {
      const result = i18n.translate('common.welcome');
      expect(result).toBe('Welcome to the Claude Neural Framework');
    });
    
    test('should interpolate parameters in messages', () => {
      const result = i18n.translate('common.greeting', { name: 'User' });
      expect(result).toBe('Hello, User!');
    });
    
    test('should handle pluralization', () => {
      // Single item
      let result = i18n.translate('common.fileCount', { count: 1 });
      expect(result).toBe('1 file');
      
      // Multiple items
      result = i18n.translate('common.fileCount', { count: 5 });
      expect(result).toBe('5 files');
    });
    
    test('should use fallback locale when key not found in current locale', () => {
      // Set locale to French
      i18n.setLocale('fr');
      
      // Try to translate a key that exists only in English
      const result = i18n.translate('common.items', { count: 3 });
      
      // Should use English fallback
      expect(result).toBe('3 items');
    });
    
    test('should return key when translation not found in any locale', () => {
      const result = i18n.translate('common.non_existent_key');
      expect(result).toBe('common.non_existent_key');
    });
  });
  
  describe('setLocale method', () => {
    test('should change current locale', () => {
      // Initially English
      expect(i18n.locale).toBe('en');
      
      // Change to French
      i18n.setLocale('fr');
      expect(i18n.locale).toBe('fr');
      
      // Translations should now use French
      const result = i18n.translate('common.welcome');
      expect(result).toBe('Bienvenue au Claude Neural Framework');
    });
    
    test('should load messages for new locale if not already loaded', () => {
      // Messages for French not loaded yet
      delete i18n.messages.fr;
      expect(i18n.messages.fr).toBeUndefined();
      
      // Set locale to French
      i18n.setLocale('fr');
      
      // Should load French messages
      expect(i18n.messages.fr).toBeDefined();
      expect(i18n.messages.fr.common.welcome).toBe('Bienvenue au Claude Neural Framework');
    });
    
    test('should not change locale to unsupported locale', () => {
      // Try to set locale to unsupported language
      i18n.setLocale('de');
      
      // Should remain as English
      expect(i18n.locale).toBe('en');
      
      // Should log a warning
      const logger = require('../../../../core/logging/logger').createLogger();
      expect(logger.warn).toHaveBeenCalled();
    });
  });
  
  describe('formatDate method', () => {
    test('should format date according to locale', () => {
      // Mock Intl.DateTimeFormat
      const mockFormat = jest.fn().mockReturnValue('01/01/2023');
      const originalDateTimeFormat = Intl.DateTimeFormat;
      global.Intl.DateTimeFormat = jest.fn().mockImplementation(() => ({
        format: mockFormat
      }));
      
      try {
        const date = new Date(2023, 0, 1);
        const result = i18n.formatDate(date);
        
        expect(result).toBe('01/01/2023');
        expect(global.Intl.DateTimeFormat).toHaveBeenCalledWith('en', expect.any(Object));
        expect(mockFormat).toHaveBeenCalledWith(date);
      } finally {
        // Restore original
        global.Intl.DateTimeFormat = originalDateTimeFormat;
      }
    });
    
    test('should support format options', () => {
      // Mock Intl.DateTimeFormat
      const mockFormat = jest.fn().mockReturnValue('January 1, 2023');
      const originalDateTimeFormat = Intl.DateTimeFormat;
      global.Intl.DateTimeFormat = jest.fn().mockImplementation(() => ({
        format: mockFormat
      }));
      
      try {
        const date = new Date(2023, 0, 1);
        const result = i18n.formatDate(date, 'long');
        
        expect(result).toBe('January 1, 2023');
        expect(global.Intl.DateTimeFormat).toHaveBeenCalledWith('en', expect.any(Object));
      } finally {
        // Restore original
        global.Intl.DateTimeFormat = originalDateTimeFormat;
      }
    });
  });
  
  describe('formatNumber method', () => {
    test('should format number according to locale', () => {
      // Mock Intl.NumberFormat
      const mockFormat = jest.fn().mockReturnValue('1,234.56');
      const originalNumberFormat = Intl.NumberFormat;
      global.Intl.NumberFormat = jest.fn().mockImplementation(() => ({
        format: mockFormat
      }));
      
      try {
        const number = 1234.56;
        const result = i18n.formatNumber(number);
        
        expect(result).toBe('1,234.56');
        expect(global.Intl.NumberFormat).toHaveBeenCalledWith('en', expect.any(Object));
        expect(mockFormat).toHaveBeenCalledWith(number);
      } finally {
        // Restore original
        global.Intl.NumberFormat = originalNumberFormat;
      }
    });
    
    test('should support format options', () => {
      // Mock Intl.NumberFormat
      const mockFormat = jest.fn().mockReturnValue('123%');
      const originalNumberFormat = Intl.NumberFormat;
      global.Intl.NumberFormat = jest.fn().mockImplementation(() => ({
        format: mockFormat
      }));
      
      try {
        const number = 1.23;
        const result = i18n.formatNumber(number, 'percent');
        
        expect(result).toBe('123%');
        expect(global.Intl.NumberFormat).toHaveBeenCalledWith('en', expect.any(Object));
      } finally {
        // Restore original
        global.Intl.NumberFormat = originalNumberFormat;
      }
    });
  });
  
  describe('formatCurrency method', () => {
    test('should format currency according to locale and currency code', () => {
      // Mock Intl.NumberFormat
      const mockFormat = jest.fn().mockReturnValue('$1,234.56');
      const originalNumberFormat = Intl.NumberFormat;
      global.Intl.NumberFormat = jest.fn().mockImplementation(() => ({
        format: mockFormat
      }));
      
      try {
        const amount = 1234.56;
        const result = i18n.formatCurrency(amount, 'USD');
        
        expect(result).toBe('$1,234.56');
        expect(global.Intl.NumberFormat).toHaveBeenCalledWith('en', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        expect(mockFormat).toHaveBeenCalledWith(amount);
      } finally {
        // Restore original
        global.Intl.NumberFormat = originalNumberFormat;
      }
    });
    
    test('should use configured currency if not specified', () => {
      // Mock Intl.NumberFormat
      const mockFormat = jest.fn().mockReturnValue('$1,234.56');
      const originalNumberFormat = Intl.NumberFormat;
      global.Intl.NumberFormat = jest.fn().mockImplementation(() => ({
        format: mockFormat
      }));
      
      try {
        const amount = 1234.56;
        const result = i18n.formatCurrency(amount);
        
        expect(result).toBe('$1,234.56');
        expect(global.Intl.NumberFormat).toHaveBeenCalledWith('en', expect.objectContaining({
          currency: 'USD'
        }));
      } finally {
        // Restore original
        global.Intl.NumberFormat = originalNumberFormat;
      }
    });
  });
});