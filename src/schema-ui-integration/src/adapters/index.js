/**
 * Adapters for integrating with different environments
 * 
 * These adapters allow the UI components to work seamlessly in different
 * contexts, including the full Claude Neural Framework, standalone mode,
 * or custom environments.
 */

/**
 * Create an adapter for the Claude Neural Framework
 * 
 * @param {Object} options Configuration options
 * @param {Object} options.mcp MCP client instance or connection details
 * @param {Object} options.logger Logger instance
 * @param {Object} options.config Configuration manager
 * @param {Object} options.i18n Internationalization instance
 * @param {Object} options.errorHandler Error handler instance
 * @returns {Object} Framework adapter
 */
export function createFrameworkAdapter(options = {}) {
  const { mcp, logger, config, i18n, errorHandler } = options;
  
  return {
    type: 'framework',
    
    // MCP client functions
    mcp: {
      client: mcp,
      invoke: async (service, method, params) => {
        if (!mcp) {
          console.warn('MCP client not available');
          return null;
        }
        
        try {
          if (typeof mcp.invoke === 'function') {
            return await mcp.invoke(service, method, params);
          }
          
          if (typeof mcp.generateResponse === 'function') {
            const response = await mcp.generateResponse({
              prompt: `Execute ${service}.${method} with params ${JSON.stringify(params)}`,
              requiredTools: [service],
            });
            
            return JSON.parse(response.text);
          }
          
          console.warn('MCP client does not have invoke or generateResponse method');
          return null;
        } catch (err) {
          console.error('Error invoking MCP method', { service, method, error: err });
          return null;
        }
      },
      getServers: () => {
        if (!mcp) return [];
        
        if (typeof mcp.getAvailableServers === 'function') {
          return mcp.getAvailableServers();
        }
        
        return [];
      }
    },
    
    // Logging functions
    logger: {
      debug: (message, data) => {
        if (logger && typeof logger.debug === 'function') {
          logger.debug(message, data);
        } else {
          console.debug(message, data);
        }
      },
      info: (message, data) => {
        if (logger && typeof logger.info === 'function') {
          logger.info(message, data);
        } else {
          console.info(message, data);
        }
      },
      warn: (message, data) => {
        if (logger && typeof logger.warn === 'function') {
          logger.warn(message, data);
        } else {
          console.warn(message, data);
        }
      },
      error: (message, data) => {
        if (logger && typeof logger.error === 'function') {
          logger.error(message, data);
        } else {
          console.error(message, data);
        }
      }
    },
    
    // Configuration functions
    config: {
      get: (type, defaultValue = {}) => {
        if (!config) return defaultValue;
        
        if (typeof config.getConfig === 'function') {
          return config.getConfig(type);
        }
        
        return config[type] || defaultValue;
      },
      getValue: (type, key, defaultValue) => {
        if (!config) return defaultValue;
        
        if (typeof config.getConfigValue === 'function') {
          return config.getConfigValue(type, key, defaultValue);
        }
        
        const configObj = config[type] || {};
        return key.split('.').reduce((obj, part) => obj && obj[part], configObj) || defaultValue;
      },
      set: (type, value) => {
        if (!config) return false;
        
        if (typeof config.setConfig === 'function') {
          return config.setConfig(type, value);
        }
        
        config[type] = value;
        return true;
      }
    },
    
    // Internationalization functions
    i18n: {
      translate: (key, params = {}) => {
        if (!i18n) return key;
        
        if (typeof i18n.translate === 'function') {
          return i18n.translate(key, params);
        }
        
        return key;
      },
      getLanguage: () => {
        if (!i18n) return 'en';
        
        if (typeof i18n.getLanguage === 'function') {
          return i18n.getLanguage();
        }
        
        return i18n.language || 'en';
      }
    },
    
    // Error handling functions
    errorHandler: {
      handle: (code, error) => {
        if (!errorHandler) {
          console.error(`Error (${code}):`, error);
          return { message: error.message || 'An error occurred' };
        }
        
        if (typeof errorHandler.handleError === 'function') {
          return errorHandler.handleError(code, error);
        }
        
        return { message: error.message || 'An error occurred' };
      }
    }
  };
}

/**
 * Standalone adapter for using the components without framework dependencies
 */
export const standaloneAdapter = {
  type: 'standalone',
  
  // MCP client functions (mocked)
  mcp: {
    client: null,
    invoke: async (service, method, params) => {
      console.log(`[Standalone] Would invoke ${service}.${method} with params:`, params);
      return null;
    },
    getServers: () => []
  },
  
  // Logging functions
  logger: {
    debug: (message, data) => console.debug(`[Claude UI] ${message}`, data),
    info: (message, data) => console.info(`[Claude UI] ${message}`, data),
    warn: (message, data) => console.warn(`[Claude UI] ${message}`, data),
    error: (message, data) => console.error(`[Claude UI] ${message}`, data)
  },
  
  // Configuration functions (uses localStorage in browser)
  config: {
    get: (type, defaultValue = {}) => {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(`claude-ui.${type}`);
        return stored ? JSON.parse(stored) : defaultValue;
      }
      return defaultValue;
    },
    getValue: (type, key, defaultValue) => {
      const config = standaloneAdapter.config.get(type, {});
      return key.split('.').reduce((obj, part) => obj && obj[part], config) || defaultValue;
    },
    set: (type, value) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`claude-ui.${type}`, JSON.stringify(value));
        return true;
      }
      return false;
    }
  },
  
  // Simple i18n (English only)
  i18n: {
    translate: (key) => {
      // Simple translation table for common keys
      const translations = {
        'errors.schemaLoadFailed': 'Failed to load schema',
        'errors.validationFailed': 'Validation failed',
        'errors.submitFailed': 'Failed to submit form',
        'actions.retry': 'Retry',
        'status.loading': 'Loading...',
        'status.saving': 'Saving...',
        'profile.editTitle': 'Edit Your Profile',
        'colorSchema.title': 'Color Schema',
        'colorSchema.editTitle': 'Edit Color Schema',
        'colorSchema.preview': 'Preview',
        'colorSchema.previewTitle': 'Preview Title',
        'colorSchema.previewDescription': 'This is how the theme will look'
      };
      
      return translations[key] || key;
    },
    getLanguage: () => 'en'
  },
  
  // Simple error handler
  errorHandler: {
    handle: (code, error) => {
      console.error(`[Claude UI] Error (${code}):`, error);
      return { message: error.message || 'An error occurred' };
    }
  }
};