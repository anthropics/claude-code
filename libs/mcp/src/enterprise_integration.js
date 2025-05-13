/**
 * Enterprise Integration Module
 * 
 * Provides integration with enterprise features including:
 * - SSO authentication
 * - RBAC
 * - Audit logging
 * - Team management
 * - Enterprise MCP server integration
 */

const fs = require('fs');
const path = require('path');
const { getEnterpriseMcpClient } = require('./enterprise/enterprise_mcp');

// Constants
const CONFIG_DIR = process.env.CONFIG_DIR || path.join(process.env.HOME, '.claude');
const ENTERPRISE_CONFIG_PATH = path.join(process.cwd(), 'core/config/enterprise/enterprise_config.json');
const ENTERPRISE_CONFIG_DIR = path.join(CONFIG_DIR, 'enterprise');
const LOGS_DIR = path.join(ENTERPRISE_CONFIG_DIR, 'logs');

// Ensure enterprise directories exist
function ensureDirectories() {
  if (!fs.existsSync(ENTERPRISE_CONFIG_DIR)) {
    fs.mkdirSync(ENTERPRISE_CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

// Load enterprise configuration
function loadEnterpriseConfig() {
  try {
    if (fs.existsSync(ENTERPRISE_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(ENTERPRISE_CONFIG_PATH, 'utf8'));
    }
    return null;
  } catch (error) {
    console.error('Failed to load enterprise configuration:', error);
    return null;
  }
}

// Check if enterprise features are enabled
function isEnterpriseEnabled() {
  // Check for enterprise config
  if (!fs.existsSync(ENTERPRISE_CONFIG_PATH)) {
    return false;
  }
  
  // Check for license
  const licensePath = path.join(ENTERPRISE_CONFIG_DIR, 'license', 'license.json');
  if (!fs.existsSync(licensePath)) {
    return false;
  }
  
  try {
    const license = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
    return license.activated === true;
  } catch (error) {
    console.error('Failed to check enterprise license:', error);
    return false;
  }
}

// Enterprise authentication
async function authenticateUser(credentials) {
  if (!isEnterpriseEnabled()) {
    throw new Error('Enterprise features are not enabled');
  }
  
  const client = getEnterpriseMcpClient();
  await client.initialize();
  
  return client.authenticate(credentials);
}

// Check permission
async function hasPermission(userId, permission) {
  if (!isEnterpriseEnabled()) {
    // Default to false for enterprise-specific permissions
    if (permission.startsWith('enterprise:')) {
      return false;
    }
    // Default to true for basic permissions
    return true;
  }
  
  const client = getEnterpriseMcpClient();
  await client.initialize();
  
  const result = await client.hasPermission(userId, permission);
  return result.hasPermission;
}

// Get user roles
async function getUserRoles(userId) {
  if (!isEnterpriseEnabled()) {
    return ['user'];
  }
  
  const client = getEnterpriseMcpClient();
  await client.initialize();
  
  const result = await client.getUserRoles(userId);
  return result.roles;
}

// Add audit log entry
async function addAuditLog(entry) {
  ensureDirectories();
  
  // Default log file
  const logFile = path.join(LOGS_DIR, 'audit.log');
  
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    ...entry,
    user: entry.user || process.env.USER || 'unknown'
  };
  
  // Write to local audit log
  try {
    let auditLog = [];
    if (fs.existsSync(logFile)) {
      auditLog = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
    
    auditLog.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(auditLog, null, 2));
  } catch (error) {
    console.error('Failed to write to local audit log:', error);
  }
  
  // If enterprise is enabled, also send to MCP server
  if (isEnterpriseEnabled()) {
    try {
      const client = getEnterpriseMcpClient();
      await client.initialize();
      await client.addAuditLog(logEntry);
    } catch (error) {
      console.error('Failed to send audit log to MCP server:', error);
    }
  }
  
  return true;
}

// Get team details
async function getTeam(teamId) {
  if (!isEnterpriseEnabled()) {
    throw new Error('Enterprise features are not enabled');
  }
  
  const client = getEnterpriseMcpClient();
  await client.initialize();
  
  return client.getTeam(teamId);
}

// Get team members
async function getTeamMembers(teamId) {
  if (!isEnterpriseEnabled()) {
    throw new Error('Enterprise features are not enabled');
  }
  
  const client = getEnterpriseMcpClient();
  await client.initialize();
  
  return client.getTeamMembers(teamId);
}

// Add user to team
async function addTeamMember(teamId, userId, role) {
  if (!isEnterpriseEnabled()) {
    throw new Error('Enterprise features are not enabled');
  }
  
  const client = getEnterpriseMcpClient();
  await client.initialize();
  
  return client.addTeamMember(teamId, userId, role);
}

// Initialize enterprise features
async function initializeEnterprise() {
  console.log('Initializing enterprise features...');
  
  ensureDirectories();
  
  // Check if enterprise is enabled
  if (!isEnterpriseEnabled()) {
    console.log('Enterprise features are not enabled');
    return false;
  }
  
  // Initialize enterprise MCP client
  try {
    const client = getEnterpriseMcpClient();
    const initialized = await client.initialize();
    
    if (!initialized) {
      console.error('Failed to initialize enterprise MCP client');
      return false;
    }
    
    // Add initialization to audit log
    await addAuditLog({
      action: 'initialize_enterprise',
      details: {
        version: '1.0.0',
        status: 'success'
      }
    });
    
    console.log('Enterprise features initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize enterprise features:', error);
    return false;
  }
}

// Run enterprise compliance check
async function runComplianceCheck(check) {
  if (!isEnterpriseEnabled()) {
    throw new Error('Enterprise features are not enabled');
  }
  
  const client = getEnterpriseMcpClient();
  await client.initialize();
  
  return client.runComplianceCheck(check);
}

// Get enterprise compliance report
async function getComplianceReport(params) {
  if (!isEnterpriseEnabled()) {
    throw new Error('Enterprise features are not enabled');
  }
  
  const client = getEnterpriseMcpClient();
  await client.initialize();
  
  return client.getComplianceReport(params);
}

// Export functions
module.exports = {
  isEnterpriseEnabled,
  loadEnterpriseConfig,
  authenticateUser,
  hasPermission,
  getUserRoles,
  addAuditLog,
  getTeam,
  getTeamMembers,
  addTeamMember,
  initializeEnterprise,
  runComplianceCheck,
  getComplianceReport
};