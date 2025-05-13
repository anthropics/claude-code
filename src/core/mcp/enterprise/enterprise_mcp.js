/**
 * Enterprise MCP Integration
 * 
 * Provides integration with enterprise systems via the Model Context Protocol.
 * Handles SSO authentication, RBAC, audit logging, and other enterprise features.
 */

const fs = require('fs');
const path = require('path');

// Enterprise MCP client configuration
const enterpriseMcpConfig = {
  endpoint: process.env.ENTERPRISE_MCP_ENDPOINT || 'http://localhost:3010',
  apiKey: process.env.ENTERPRISE_MCP_API_KEY,
  timeout: process.env.ENTERPRISE_MCP_TIMEOUT || 30000,
  retryAttempts: 3,
  services: {
    auth: '/auth',
    rbac: '/rbac',
    audit: '/audit',
    compliance: '/compliance',
    teams: '/teams'
  }
};

/**
 * Enterprise MCP Client
 */
class EnterpriseMcpClient {
  constructor(config) {
    this.config = config || enterpriseMcpConfig;
    this.initialized = false;
    this.endpoints = {};
  }

  /**
   * Initialize the client
   * @returns {Promise<boolean>} True if initialization was successful
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // Build endpoints
      Object.keys(this.config.services).forEach(service => {
        this.endpoints[service] = `${this.config.endpoint}${this.config.services[service]}`;
      });

      // Test connection
      await this._testConnection();
      
      this.initialized = true;
      console.log('Enterprise MCP client initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Enterprise MCP client:', error.message);
      return false;
    }
  }

  /**
   * Test connection to the MCP server
   * @private
   */
  async _testConnection() {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey
        },
        timeout: this.config.timeout
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      return true;
    } catch (error) {
      throw new Error(`Enterprise MCP connection test failed: ${error.message}`);
    }
  }

  /**
   * Make a request to the MCP server
   * @private
   * @param {string} endpoint - The endpoint to call
   * @param {string} method - HTTP method
   * @param {Object} body - Request body
   * @returns {Promise<Object>} Response data
   */
  async _makeRequest(endpoint, method = 'GET', body = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey
      },
      timeout: this.config.timeout
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(endpoint, options);
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(`MCP request failed: ${response.status} - ${error.message}`);
        }
        
        return await response.json();
      } catch (error) {
        if (attempt === this.config.retryAttempts - 1) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Get enterprise configuration
   * @returns {Promise<Object>} Enterprise configuration
   */
  async getEnterpriseConfig() {
    return this._makeRequest(`${this.config.endpoint}/config`);
  }

  /**
   * Authenticate user
   * @param {Object} credentials - User credentials
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate(credentials) {
    return this._makeRequest(`${this.endpoints.auth}/login`, 'POST', credentials);
  }

  /**
   * Validate session token
   * @param {string} token - Session token
   * @returns {Promise<Object>} Validation result
   */
  async validateToken(token) {
    return this._makeRequest(`${this.endpoints.auth}/validate`, 'POST', { token });
  }

  /**
   * Revoke session token
   * @param {string} token - Session token
   * @returns {Promise<Object>} Revocation result
   */
  async revokeToken(token) {
    return this._makeRequest(`${this.endpoints.auth}/revoke`, 'POST', { token });
  }

  /**
   * Check if user has permission
   * @param {string} userId - User ID
   * @param {string} permission - Permission to check
   * @returns {Promise<Object>} Permission check result
   */
  async hasPermission(userId, permission) {
    return this._makeRequest(`${this.endpoints.rbac}/check`, 'POST', { userId, permission });
  }

  /**
   * Get user roles
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User roles
   */
  async getUserRoles(userId) {
    return this._makeRequest(`${this.endpoints.rbac}/roles/${userId}`);
  }

  /**
   * Add audit log entry
   * @param {Object} entry - Audit log entry
   * @returns {Promise<Object>} Audit log result
   */
  async addAuditLog(entry) {
    return this._makeRequest(`${this.endpoints.audit}/log`, 'POST', entry);
  }

  /**
   * Get audit logs
   * @param {Object} filters - Audit log filters
   * @returns {Promise<Object>} Audit logs
   */
  async getAuditLogs(filters) {
    return this._makeRequest(`${this.endpoints.audit}/logs`, 'POST', filters);
  }

  /**
   * Run compliance check
   * @param {Object} check - Compliance check parameters
   * @returns {Promise<Object>} Compliance check result
   */
  async runComplianceCheck(check) {
    return this._makeRequest(`${this.endpoints.compliance}/check`, 'POST', check);
  }

  /**
   * Get compliance report
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Compliance report
   */
  async getComplianceReport(params) {
    return this._makeRequest(`${this.endpoints.compliance}/report`, 'POST', params);
  }

  /**
   * Get team details
   * @param {string} teamId - Team ID
   * @returns {Promise<Object>} Team details
   */
  async getTeam(teamId) {
    return this._makeRequest(`${this.endpoints.teams}/${teamId}`);
  }

  /**
   * Get team members
   * @param {string} teamId - Team ID
   * @returns {Promise<Object>} Team members
   */
  async getTeamMembers(teamId) {
    return this._makeRequest(`${this.endpoints.teams}/${teamId}/members`);
  }

  /**
   * Add user to team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @param {string} role - User role in team
   * @returns {Promise<Object>} Add member result
   */
  async addTeamMember(teamId, userId, role) {
    return this._makeRequest(`${this.endpoints.teams}/${teamId}/members`, 'POST', { userId, role });
  }

  /**
   * Remove user from team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Remove member result
   */
  async removeTeamMember(teamId, userId) {
    return this._makeRequest(`${this.endpoints.teams}/${teamId}/members/${userId}`, 'DELETE');
  }
}

/**
 * Get enterprise MCP client instance
 * @returns {EnterpriseMcpClient} Enterprise MCP client
 */
function getEnterpriseMcpClient() {
  return new EnterpriseMcpClient(enterpriseMcpConfig);
}

module.exports = {
  EnterpriseMcpClient,
  getEnterpriseMcpClient
};