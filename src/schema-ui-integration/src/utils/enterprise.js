/**
 * Enterprise Utilities
 * 
 * Utility functions for enterprise features including:
 * - License validation
 * - User/team permissions
 * - Audit logging
 * - Feature flags
 */

// Storage keys
const STORAGE_KEYS = {
  ENTERPRISE_STATUS: 'enterprise_status',
  LICENSE: 'enterprise_license',
  USERS: 'enterprise_users',
  TEAMS: 'enterprise_teams',
  AUDIT_LOG: 'enterprise_audit_logs',
};

/**
 * Enterprise Utility Module
 */
const enterpriseUtils = {
  /**
   * Check if enterprise is activated
   * @param {Object} adapter - Storage adapter
   * @returns {Promise<boolean>} - True if enterprise features are activated
   */
  isEnterpriseActivated: async (adapter) => {
    try {
      const status = await adapter.get(STORAGE_KEYS.ENTERPRISE_STATUS);
      return status?.activated === true;
    } catch (error) {
      console.error('Error checking enterprise status:', error);
      return false;
    }
  },

  /**
   * Get enterprise status
   * @param {Object} adapter - Storage adapter
   * @returns {Promise<Object|null>} - Enterprise status object
   */
  getEnterpriseStatus: async (adapter) => {
    try {
      return await adapter.get(STORAGE_KEYS.ENTERPRISE_STATUS);
    } catch (error) {
      console.error('Error getting enterprise status:', error);
      return null;
    }
  },

  /**
   * Set enterprise status
   * @param {Object} adapter - Storage adapter
   * @param {Object} status - Enterprise status object
   * @returns {Promise<boolean>} - True if successful
   */
  setEnterpriseStatus: async (adapter, status) => {
    try {
      await adapter.set(STORAGE_KEYS.ENTERPRISE_STATUS, {
        ...status,
        lastUpdated: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error setting enterprise status:', error);
      return false;
    }
  },

  /**
   * Get license information
   * @param {Object} adapter - Storage adapter
   * @returns {Promise<Object|null>} - License information
   */
  getLicenseInfo: async (adapter) => {
    try {
      return await adapter.get(STORAGE_KEYS.LICENSE);
    } catch (error) {
      console.error('Error getting license info:', error);
      return null;
    }
  },

  /**
   * Validate license
   * @param {Object} adapter - Storage adapter
   * @returns {Promise<Object>} - License validation result
   */
  validateLicense: async (adapter) => {
    try {
      const license = await adapter.get(STORAGE_KEYS.LICENSE);
      
      if (\!license || \!license.activated) {
        return {
          valid: false,
          reason: 'License not found or inactive',
        };
      }

      // Check if license is expired
      if (license.expirationDate) {
        const expirationDate = new Date(license.expirationDate);
        const now = new Date();
        
        if (now > expirationDate) {
          return {
            valid: false,
            reason: 'License expired',
            expirationDate: license.expirationDate,
          };
        }
      }
      
      return {
        valid: true,
        type: license.type,
        expirationDate: license.expirationDate,
      };
    } catch (error) {
      console.error('Error validating license:', error);
      return {
        valid: false,
        reason: 'Error validating license',
      };
    }
  },

  /**
   * Check if a feature is available in the current license
   * @param {Object} adapter - Storage adapter
   * @param {string} featureName - Name of the feature to check
   * @returns {Promise<boolean>} - True if the feature is available
   */
  isFeatureAvailable: async (adapter, featureName) => {
    try {
      const license = await adapter.get(STORAGE_KEYS.LICENSE);
      
      // If no license exists, basic features only
      if (\!license || \!license.activated) {
        const basicFeatures = ['user_management', 'basic_security'];
        return basicFeatures.includes(featureName);
      }
      
      // Check license type to determine available features
      const featureMap = {
        trial: [
          'user_management', 
          'basic_security', 
          'team_collaboration',
          'audit_logging'
        ],
        standard: [
          'user_management', 
          'basic_security', 
          'team_collaboration',
          'audit_logging',
          'enhanced_security',
          'api_access'
        ],
        premium: [
          'user_management', 
          'basic_security', 
          'team_collaboration',
          'audit_logging',
          'enhanced_security',
          'api_access',
          'advanced_analytics',
          'priority_support',
          'custom_integrations',
          'sso'
        ]
      };
      
      // Get features for license type or default to trial
      const availableFeatures = featureMap[license.type] || featureMap.trial;
      
      // Check if feature is in available features
      return availableFeatures.includes(featureName);
    } catch (error) {
      console.error('Error checking feature availability:', error);
      return false;
    }
  },

  /**
   * Get all users
   * @param {Object} adapter - Storage adapter
   * @returns {Promise<Array>} - Array of users
   */
  getUsers: async (adapter) => {
    try {
      const users = await adapter.get(STORAGE_KEYS.USERS);
      return users || [];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  },

  /**
   * Get user by ID
   * @param {Object} adapter - Storage adapter
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} - User object if found, null otherwise
   */
  getUserById: async (adapter, userId) => {
    try {
      const users = await adapter.get(STORAGE_KEYS.USERS);
      
      if (\!users || \!Array.isArray(users)) {
        return null;
      }
      
      return users.find(user => user.id === userId) || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  },

  /**
   * Check if user has permission
   * @param {Object} adapter - Storage adapter
   * @param {string} userId - User ID
   * @param {string} permission - Permission to check
   * @returns {Promise<boolean>} - True if user has permission
   */
  hasPermission: async (adapter, userId, permission) => {
    try {
      const user = await enterpriseUtils.getUserById(adapter, userId);
      
      if (\!user) {
        return false;
      }
      
      // Admin role has all permissions
      if (user.role === 'admin') {
        return true;
      }
      
      // Get role permissions
      const roles = {
        admin: ['*'],
        user: ['read', 'write', 'execute'],
        viewer: ['read']
      };
      
      const userPermissions = roles[user.role] || [];
      
      // Check if user has wildcard permission or specific permission
      return userPermissions.includes('*') || userPermissions.includes(permission);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  },

  /**
   * Add audit log entry
   * @param {Object} adapter - Storage adapter
   * @param {Object} entry - Audit log entry
   * @returns {Promise<boolean>} - True if successful
   */
  addAuditLogEntry: async (adapter, entry) => {
    try {
      // Get existing audit logs
      const auditLogs = await adapter.get(STORAGE_KEYS.AUDIT_LOG) || [];
      
      // Add timestamp if not provided
      const logEntry = {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      };
      
      // Add entry to audit logs
      auditLogs.push(logEntry);
      
      // Ensure we don't exceed max log size (keep last 1000 entries)
      const maxLogSize = 1000;
      const trimmedLogs = auditLogs.slice(-maxLogSize);
      
      // Save updated audit logs
      await adapter.set(STORAGE_KEYS.AUDIT_LOG, trimmedLogs);
      
      return true;
    } catch (error) {
      console.error('Error adding audit log entry:', error);
      return false;
    }
  },

  /**
   * Get audit logs
   * @param {Object} adapter - Storage adapter
   * @param {Object} options - Filter options (e.g., userId, action, timeRange)
   * @returns {Promise<Array>} - Filtered audit logs
   */
  getAuditLogs: async (adapter, options = {}) => {
    try {
      const auditLogs = await adapter.get(STORAGE_KEYS.AUDIT_LOG) || [];
      
      // Apply filters if provided
      return auditLogs.filter(log => {
        // Filter by user ID
        if (options.userId && log.userId \!== options.userId) {
          return false;
        }
        
        // Filter by action
        if (options.action && log.action \!== options.action) {
          return false;
        }
        
        // Filter by time range
        if (options.startTime) {
          const startTime = new Date(options.startTime);
          const logTime = new Date(log.timestamp);
          
          if (logTime < startTime) {
            return false;
          }
        }
        
        if (options.endTime) {
          const endTime = new Date(options.endTime);
          const logTime = new Date(log.timestamp);
          
          if (logTime > endTime) {
            return false;
          }
        }
        
        return true;
      });
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return [];
    }
  }
};

export default enterpriseUtils;
EOF < /dev/null