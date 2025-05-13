/**
 * Mock Factories for Claude Neural Framework Tests
 * 
 * This file contains factory functions for creating mock objects for testing.
 */

/**
 * Create a mock logger
 * 
 * @returns {Object} Mock logger object
 */
function createMockLogger() {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis()
  };
}

/**
 * Create a mock config manager
 * 
 * @param {Object} configs - Map of configuration types to configuration data
 * @returns {Object} Mock config manager object
 */
function createMockConfigManager(configs = {}) {
  return {
    getConfig: jest.fn().mockImplementation((configType) => configs[configType] || {}),
    getConfigValue: jest.fn().mockImplementation((configType, keyPath, defaultValue) => {
      const config = configs[configType] || {};
      const keyParts = keyPath.split('.');
      let value = config;
      
      for (const part of keyParts) {
        if (value === undefined || value === null || typeof value !== 'object') {
          return defaultValue;
        }
        
        value = value[part];
        
        if (value === undefined) {
          return defaultValue;
        }
      }
      
      return value;
    }),
    saveConfig: jest.fn().mockReturnValue(true),
    updateConfigValue: jest.fn().mockReturnValue(true),
    resetConfig: jest.fn().mockReturnValue(true),
    hasApiKey: jest.fn().mockReturnValue(true),
    getEnvironmentVariables: jest.fn().mockReturnValue({
      CLAUDE_API_KEY: 'CLAUDE_API_KEY',
      VOYAGE_API_KEY: 'VOYAGE_API_KEY',
      BRAVE_API_KEY: 'BRAVE_API_KEY',
      MCP_API_KEY: 'MCP_API_KEY'
    }),
    registerObserver: jest.fn().mockReturnValue('mock-observer-id'),
    unregisterObserver: jest.fn().mockReturnValue(true)
  };
}

/**
 * Create a mock MCP client
 * 
 * @returns {Object} Mock MCP client object
 */
function createMockMcpClient() {
  return {
    getAvailableServers: jest.fn().mockReturnValue([]),
    startServer: jest.fn().mockReturnValue(true),
    stopServer: jest.fn().mockReturnValue(true),
    stopAllServers: jest.fn(),
    generateResponse: jest.fn().mockResolvedValue({
      text: 'Mock response text',
      model: 'claude-3-sonnet-20240229',
      usage: { input_tokens: 100, output_tokens: 50 },
      requestId: `req_${Date.now()}_mock`
    })
  };
}

/**
 * Create a mock i18n instance
 * 
 * @param {Object} translations - Translation keys and values
 * @returns {Object} Mock i18n object
 */
function createMockI18n(translations = {}) {
  return {
    translate: jest.fn().mockImplementation((key, params = {}) => {
      let message = translations[key] || key;
      
      // Simple parameter interpolation
      if (params && typeof params === 'object') {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          message = message.replace(new RegExp(`{{${paramKey}}}`, 'g'), paramValue);
        }
      }
      
      return message;
    }),
    formatDate: jest.fn().mockImplementation((date) => date.toISOString()),
    formatNumber: jest.fn().mockImplementation((number) => number.toString()),
    formatCurrency: jest.fn().mockImplementation((amount, currency) => `${currency} ${amount}`),
    setLocale: jest.fn()
  };
}

/**
 * Create a mock Anthropic client
 * 
 * @returns {Object} Mock Anthropic client object
 */
function createMockAnthropicClient() {
  return {
    messages: {
      create: jest.fn().mockResolvedValue({
        id: `msg_${Date.now()}_mock`,
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'This is a mock response from the Claude API.'
          }
        ],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      })
    }
  };
}

/**
 * Create a mock error handler
 * 
 * @returns {Object} Mock error handler object
 */
function createMockErrorHandler() {
  return {
    handleError: jest.fn(),
    formatError: jest.fn().mockImplementation((err) => ({
      error: {
        message: err.message || 'Unknown error',
        code: err.code || 'ERR_UNKNOWN',
        status: err.status || 500
      }
    })),
    logError: jest.fn(),
    createError: jest.fn().mockImplementation((message, options = {}) => {
      const error = new Error(message);
      error.code = options.code || 'ERR_UNKNOWN';
      error.status = options.status || 500;
      error.component = options.component || 'unknown';
      error.isOperational = options.isOperational !== undefined ? options.isOperational : true;
      return error;
    })
  };
}

module.exports = {
  createMockLogger,
  createMockConfigManager,
  createMockMcpClient,
  createMockI18n,
  createMockAnthropicClient,
  createMockErrorHandler
};