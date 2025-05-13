/**
 * Logger Tests
 * 
 * Unit tests for the logging module.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import test helpers
const { createTempTestDir, removeTempTestDir, mockConsole } = require('../../../utils/test-helpers');

// Import the module to test (with mock console)
jest.mock('console', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

// Mock Config Manager
jest.mock('../../../../core/config/config_manager', () => ({
  CONFIG_TYPES: {
    GLOBAL: 'global'
  },
  getConfig: jest.fn().mockReturnValue({
    logging: {
      level: 'info',
      console: true,
      file: false,
      format: 'json',
      colors: true,
      metadata: {
        enabled: true,
        include: ['timestamp', 'level', 'component']
      }
    }
  }),
  getConfigValue: jest.fn().mockImplementation((configType, keyPath, defaultValue) => {
    if (keyPath === 'logging.level') return 'info';
    if (keyPath === 'logging.console') return true;
    if (keyPath === 'logging.file') return false;
    if (keyPath === 'logging.format') return 'json';
    if (keyPath === 'logging.colors') return true;
    if (keyPath === 'logging.metadata.enabled') return true;
    if (keyPath === 'logging.metadata.include') return ['timestamp', 'level', 'component'];
    return defaultValue;
  }),
  registerObserver: jest.fn().mockReturnValue('mock-observer-id')
}));

// Now we can import the logger
const logger = require('../../../../core/logging/logger');

describe('Logger', () => {
  let tempDir;
  let logFilePath;
  let consoleLogSpy;
  let consoleErrorSpy;
  
  // Setup before each test
  beforeEach(() => {
    // Create temp directory for log files
    tempDir = createTempTestDir();
    logFilePath = path.join(tempDir, 'claude.log');
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleErrorSpy = jest.spyOn(console, 'error');
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  // Cleanup after each test
  afterEach(() => {
    // Clean up temp directory
    removeTempTestDir(tempDir);
    
    // Restore console spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
  
  describe('createLogger function', () => {
    test('should create a logger instance with a component name', () => {
      const componentLogger = logger.createLogger('test-component');
      expect(componentLogger).toBeDefined();
      expect(componentLogger.component).toBe('test-component');
      expect(typeof componentLogger.trace).toBe('function');
      expect(typeof componentLogger.debug).toBe('function');
      expect(typeof componentLogger.info).toBe('function');
      expect(typeof componentLogger.warn).toBe('function');
      expect(typeof componentLogger.error).toBe('function');
      expect(typeof componentLogger.fatal).toBe('function');
    });
  });
  
  describe('logging methods', () => {
    let componentLogger;
    
    beforeEach(() => {
      componentLogger = logger.createLogger('test-component');
    });
    
    test('should log messages at different levels', () => {
      // Debug level should be ignored with default level (info)
      componentLogger.debug('Debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      
      // Info level should be logged
      componentLogger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      
      // Warning level should be logged
      componentLogger.warn('Warning message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      
      // Error level should be logged
      componentLogger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      
      // Fatal level should be logged
      componentLogger.fatal('Fatal message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });
    
    test('should include metadata in log messages', () => {
      componentLogger.info('Info message with metadata', { user: 'test', action: 'login' });
      
      // Check if console.log was called with JSON containing metadata
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      
      // Get the log message
      const logMessage = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      // Check log structure
      expect(logMessage).toHaveProperty('timestamp');
      expect(logMessage).toHaveProperty('level', 'info');
      expect(logMessage).toHaveProperty('component', 'test-component');
      expect(logMessage).toHaveProperty('message', 'Info message with metadata');
      expect(logMessage).toHaveProperty('user', 'test');
      expect(logMessage).toHaveProperty('action', 'login');
    });
    
    test('should handle error objects correctly', () => {
      const error = new Error('Test error');
      error.code = 'ERR_TEST';
      error.status = 400;
      
      componentLogger.error('Error occurred', { error });
      
      // Get the log message
      const logMessage = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      
      // Check error properties
      expect(logMessage).toHaveProperty('error');
      expect(logMessage.error).toHaveProperty('message', 'Test error');
      expect(logMessage.error).toHaveProperty('code', 'ERR_TEST');
      expect(logMessage.error).toHaveProperty('status', 400);
      expect(logMessage.error).toHaveProperty('stack');
    });
  });
  
  describe('child loggers', () => {
    test('should create child loggers with inherited properties', () => {
      const parentLogger = logger.createLogger('parent');
      const childLogger = parentLogger.child('child');
      
      expect(childLogger.component).toBe('parent:child');
      
      // Log with child logger
      childLogger.info('Message from child');
      
      // Get the log message
      const logMessage = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      // Check component property
      expect(logMessage).toHaveProperty('component', 'parent:child');
    });
    
    test('should support multiple levels of nesting', () => {
      const rootLogger = logger.createLogger('root');
      const level1 = rootLogger.child('level1');
      const level2 = level1.child('level2');
      const level3 = level2.child('level3');
      
      expect(level3.component).toBe('root:level1:level2:level3');
      
      // Log with deeply nested logger
      level3.info('Deep message');
      
      // Get the log message
      const logMessage = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      // Check component property
      expect(logMessage).toHaveProperty('component', 'root:level1:level2:level3');
    });
  });
  
  describe('logging to file', () => {
    beforeEach(() => {
      // Override getConfigValue mock to enable file logging
      const configManager = require('../../../../core/config/config_manager');
      configManager.getConfigValue.mockImplementation((configType, keyPath, defaultValue) => {
        if (keyPath === 'logging.level') return 'info';
        if (keyPath === 'logging.console') return true;
        if (keyPath === 'logging.file') return true;
        if (keyPath === 'logging.file_path') return logFilePath;
        if (keyPath === 'logging.format') return 'json';
        if (keyPath === 'logging.colors') return true;
        if (keyPath === 'logging.metadata.enabled') return true;
        if (keyPath === 'logging.metadata.include') return ['timestamp', 'level', 'component'];
        return defaultValue;
      });
      
      // Reset logger to pick up new config
      jest.resetModules();
      
      // Mock fs.writeFileSync for file logging
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
      jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    });
    
    afterEach(() => {
      // Restore fs mocks
      jest.restoreAllMocks();
    });
    
    test('should log to file when enabled', () => {
      // Require logger again to pick up new config
      const fileLogger = require('../../../../core/logging/logger');
      const componentLogger = fileLogger.createLogger('file-test');
      
      // Log a message
      componentLogger.info('File log message');
      
      // Check if appendFileSync was called
      expect(fs.appendFileSync).toHaveBeenCalled();
      expect(fs.appendFileSync.mock.calls[0][0]).toBe(logFilePath);
      
      // Verify log content
      const logContent = fs.appendFileSync.mock.calls[0][1];
      const logObject = JSON.parse(logContent.trim());
      
      expect(logObject).toHaveProperty('timestamp');
      expect(logObject).toHaveProperty('level', 'info');
      expect(logObject).toHaveProperty('component', 'file-test');
      expect(logObject).toHaveProperty('message', 'File log message');
    });
  });
});