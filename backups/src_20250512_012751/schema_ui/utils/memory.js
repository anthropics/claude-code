/**
 * Memory System for Claude Schema UI
 * 
 * Provides persistent data storage across sessions even without backend integration.
 * Works across Claude Desktop, Claude Max, and Claude Code environments.
 */

// Storage keys
const STORAGE_KEYS = {
  PROFILE: 'claude-schema-ui:profile',
  COLOR_SCHEMA: 'claude-schema-ui:color-schema',
  PREFERENCES: 'claude-schema-ui:preferences',
  HISTORY: 'claude-schema-ui:history',
  SESSION_ID: 'claude-schema-ui:session-id'
};

// Storage adapters for different environments
const adapters = {
  // Browser localStorage adapter
  browser: {
    get: (key) => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('Error writing to localStorage:', error);
        return false;
      }
    },
    remove: (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('Error removing from localStorage:', error);
        return false;
      }
    },
    clear: () => {
      try {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        return true;
      } catch (error) {
        console.error('Error clearing localStorage:', error);
        return false;
      }
    }
  },
  
  // Node.js fs adapter for Claude Code
  node: {
    get: (key) => {
      try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const filePath = path.join(os.homedir(), '.claude', 'storage', `${key}.json`);
        
        if (!fs.existsSync(filePath)) {
          return null;
        }
        
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Error reading from file system:', error);
        return null;
      }
    },
    set: (key, value) => {
      try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const dirPath = path.join(os.homedir(), '.claude', 'storage');
        const filePath = path.join(dirPath, `${key}.json`);
        
        // Ensure directory exists
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
        return true;
      } catch (error) {
        console.error('Error writing to file system:', error);
        return false;
      }
    },
    remove: (key) => {
      try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const filePath = path.join(os.homedir(), '.claude', 'storage', `${key}.json`);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return true;
      } catch (error) {
        console.error('Error removing from file system:', error);
        return false;
      }
    },
    clear: () => {
      try {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const dirPath = path.join(os.homedir(), '.claude', 'storage');
        
        if (fs.existsSync(dirPath)) {
          Object.values(STORAGE_KEYS).forEach(key => {
            const filePath = path.join(dirPath, `${key}.json`);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          });
        }
        return true;
      } catch (error) {
        console.error('Error clearing file system storage:', error);
        return false;
      }
    }
  },
  
  // Memory adapter for testing or environments with no persistence
  memory: {
    _store: {},
    get: (key) => adapters.memory._store[key] || null,
    set: (key, value) => {
      adapters.memory._store[key] = value;
      return true;
    },
    remove: (key) => {
      delete adapters.memory._store[key];
      return true;
    },
    clear: () => {
      adapters.memory._store = {};
      return true;
    }
  },
  
  // Claude Desktop adapter
  claudeDesktop: {
    get: (key) => {
      try {
        // Try to use Claude Desktop API if available
        if (typeof window !== 'undefined' && window.claudeDesktop && window.claudeDesktop.storage) {
          return window.claudeDesktop.storage.get(key);
        }
        return null;
      } catch (error) {
        console.error('Error reading from Claude Desktop storage:', error);
        return null;
      }
    },
    set: (key, value) => {
      try {
        // Try to use Claude Desktop API if available
        if (typeof window !== 'undefined' && window.claudeDesktop && window.claudeDesktop.storage) {
          window.claudeDesktop.storage.set(key, value);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error writing to Claude Desktop storage:', error);
        return false;
      }
    },
    remove: (key) => {
      try {
        // Try to use Claude Desktop API if available
        if (typeof window !== 'undefined' && window.claudeDesktop && window.claudeDesktop.storage) {
          window.claudeDesktop.storage.remove(key);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error removing from Claude Desktop storage:', error);
        return false;
      }
    },
    clear: () => {
      try {
        // Try to use Claude Desktop API if available
        if (typeof window !== 'undefined' && window.claudeDesktop && window.claudeDesktop.storage) {
          Object.values(STORAGE_KEYS).forEach(key => window.claudeDesktop.storage.remove(key));
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error clearing Claude Desktop storage:', error);
        return false;
      }
    }
  }
};

/**
 * Determine the best storage adapter for the current environment
 */
function getStorageAdapter() {
  // Check for Claude Desktop
  if (typeof window !== 'undefined' && window.claudeDesktop && window.claudeDesktop.storage) {
    return adapters.claudeDesktop;
  }
  
  // Check for browser environment
  if (typeof window !== 'undefined' && window.localStorage) {
    return adapters.browser;
  }
  
  // Check for Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return adapters.node;
  }
  
  // Fallback to memory storage
  return adapters.memory;
}

/**
 * Memory system for Claude Schema UI
 */
const memory = {
  /**
   * Save user profile data
   * 
   * @param {string} userId User ID
   * @param {Object} profile Profile data
   * @returns {boolean} Success
   */
  saveProfile: (userId, profile) => {
    const adapter = getStorageAdapter();
    const profiles = adapter.get(STORAGE_KEYS.PROFILE) || {};
    
    profiles[userId] = {
      ...profile,
      lastUpdated: new Date().toISOString()
    };
    
    return adapter.set(STORAGE_KEYS.PROFILE, profiles);
  },
  
  /**
   * Load user profile data
   * 
   * @param {string} userId User ID
   * @returns {Object|null} Profile data or null if not found
   */
  loadProfile: (userId) => {
    const adapter = getStorageAdapter();
    const profiles = adapter.get(STORAGE_KEYS.PROFILE) || {};
    
    return profiles[userId] || null;
  },
  
  /**
   * Save color schema settings
   * 
   * @param {string} themeName Theme name
   * @param {Object} themeData Theme data
   * @returns {boolean} Success
   */
  saveColorSchema: (themeName, themeData) => {
    const adapter = getStorageAdapter();
    const schemas = adapter.get(STORAGE_KEYS.COLOR_SCHEMA) || {};
    
    schemas[themeName] = {
      ...themeData,
      lastUpdated: new Date().toISOString()
    };
    
    return adapter.set(STORAGE_KEYS.COLOR_SCHEMA, schemas);
  },
  
  /**
   * Load color schema settings
   * 
   * @param {string} themeName Theme name
   * @returns {Object|null} Theme data or null if not found
   */
  loadColorSchema: (themeName) => {
    const adapter = getStorageAdapter();
    const schemas = adapter.get(STORAGE_KEYS.COLOR_SCHEMA) || {};
    
    return schemas[themeName] || null;
  },
  
  /**
   * Get all color schemas
   * 
   * @returns {Object} All color schemas
   */
  getAllColorSchemas: () => {
    const adapter = getStorageAdapter();
    return adapter.get(STORAGE_KEYS.COLOR_SCHEMA) || {};
  },
  
  /**
   * Save user preferences
   * 
   * @param {string} userId User ID
   * @param {Object} preferences Preferences data
   * @returns {boolean} Success
   */
  savePreferences: (userId, preferences) => {
    const adapter = getStorageAdapter();
    const allPreferences = adapter.get(STORAGE_KEYS.PREFERENCES) || {};
    
    allPreferences[userId] = {
      ...preferences,
      lastUpdated: new Date().toISOString()
    };
    
    return adapter.set(STORAGE_KEYS.PREFERENCES, allPreferences);
  },
  
  /**
   * Load user preferences
   * 
   * @param {string} userId User ID
   * @returns {Object|null} Preferences data or null if not found
   */
  loadPreferences: (userId) => {
    const adapter = getStorageAdapter();
    const allPreferences = adapter.get(STORAGE_KEYS.PREFERENCES) || {};
    
    return allPreferences[userId] || null;
  },
  
  /**
   * Add an entry to history
   * 
   * @param {string} userId User ID
   * @param {string} type Entry type
   * @param {Object} data Entry data
   * @returns {boolean} Success
   */
  addToHistory: (userId, type, data) => {
    const adapter = getStorageAdapter();
    const history = adapter.get(STORAGE_KEYS.HISTORY) || {};
    
    if (!history[userId]) {
      history[userId] = [];
    }
    
    // Add history entry
    history[userId].unshift({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date().toISOString()
    });
    
    // Limit history to 50 entries per user
    if (history[userId].length > 50) {
      history[userId] = history[userId].slice(0, 50);
    }
    
    return adapter.set(STORAGE_KEYS.HISTORY, history);
  },
  
  /**
   * Get user history
   * 
   * @param {string} userId User ID
   * @param {string} type Optional entry type filter
   * @returns {Array} History entries
   */
  getHistory: (userId, type) => {
    const adapter = getStorageAdapter();
    const history = adapter.get(STORAGE_KEYS.HISTORY) || {};
    
    if (!history[userId]) {
      return [];
    }
    
    if (type) {
      return history[userId].filter(entry => entry.type === type);
    }
    
    return history[userId];
  },
  
  /**
   * Clear user data
   * 
   * @param {string} userId User ID
   * @returns {boolean} Success
   */
  clearUserData: (userId) => {
    const adapter = getStorageAdapter();
    
    const profiles = adapter.get(STORAGE_KEYS.PROFILE) || {};
    const preferences = adapter.get(STORAGE_KEYS.PREFERENCES) || {};
    const history = adapter.get(STORAGE_KEYS.HISTORY) || {};
    
    delete profiles[userId];
    delete preferences[userId];
    delete history[userId];
    
    const success1 = adapter.set(STORAGE_KEYS.PROFILE, profiles);
    const success2 = adapter.set(STORAGE_KEYS.PREFERENCES, preferences);
    const success3 = adapter.set(STORAGE_KEYS.HISTORY, history);
    
    return success1 && success2 && success3;
  },
  
  /**
   * Get a unique session ID
   * 
   * @returns {string} Session ID
   */
  getSessionId: () => {
    const adapter = getStorageAdapter();
    let sessionId = adapter.get(STORAGE_KEYS.SESSION_ID);
    
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      adapter.set(STORAGE_KEYS.SESSION_ID, sessionId);
    }
    
    return sessionId;
  },
  
  /**
   * Clear all stored data
   * 
   * @returns {boolean} Success
   */
  clearAll: () => {
    const adapter = getStorageAdapter();
    return adapter.clear();
  }
};

export default memory;