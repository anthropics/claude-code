/**
 * Enterprise Workflow Module
 * 
 * Implements enterprise workflow features including:
 * - Branch approval workflows
 * - Policy enforcement
 * - Audit logging
 * - Team collaboration
 * - Change management
 * - JIRA integration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Constants
const CONFIG_DIR = process.env.CONFIG_DIR || path.join(process.env.HOME, '.claude');
const ENTERPRISE_CONFIG_DIR = path.join(CONFIG_DIR, 'enterprise');
const LOGS_DIR = path.join(ENTERPRISE_CONFIG_DIR, 'logs');
const AUDIT_LOG_FILE = path.join(LOGS_DIR, 'workflow-audit.log');

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(ENTERPRISE_CONFIG_DIR)) {
    fs.mkdirSync(ENTERPRISE_CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

// Load configuration
function loadConfiguration() {
  const configPath = path.join(process.cwd(), 'core/config/enterprise_workflow_config.json');
  
  if (!fs.existsSync(configPath)) {
    // Create default configuration if it doesn't exist
    const defaultConfig = {
      version: '1.0.0',
      branchPolicies: {
        'main': {
          requireApproval: true,
          minApprovers: 2,
          requiredTeams: ['Engineering']
        },
        'staging': {
          requireApproval: true,
          minApprovers: 1,
          requiredTeams: []
        },
        'development': {
          requireApproval: false,
          minApprovers: 0,
          requiredTeams: []
        }
      },
      securityPolicies: {
        secureFilesPatterns: ['**/config/*.json', '**/secrets.*.js', '**/*.key'],
        codeAnalysis: true,
        blockedPatterns: ['password\\s*=', 'apiKey\\s*=', 'token\\s*=']
      },
      teams: [
        {
          name: 'Engineering',
          approvalRoles: ['lead', 'senior'],
          members: []
        },
        {
          name: 'Security',
          approvalRoles: ['member'],
          members: []
        }
      ],
      integrations: {
        jira: {
          enabled: false,
          url: '',
          projectKey: '',
          issueTypes: {
            feature: 'Story',
            bugfix: 'Bug',
            hotfix: 'Bug',
            release: 'Task'
          }
        },
        github: {
          enabled: false,
          enterpriseUrl: ''
        }
      },
      changeManagement: {
        enabled: true,
        requireIssueReference: true,
        requireChangelog: true,
        changelogPath: 'CHANGELOG.md'
      }
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('Failed to load configuration:', error);
    return {};
  }
}

// Write to audit log
function writeAuditLog(action, details) {
  ensureDirectories();
  
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    user: process.env.USER || 'unknown',
    details
  };
  
  try {
    let auditLog = [];
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      auditLog = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8'));
    }
    
    auditLog.push(logEntry);
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(auditLog, null, 2));
    
    return true;
  } catch (error) {
    console.error('Failed to write audit log:', error);
    return false;
  }
}

// Get current Git branch
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Failed to get current branch:', error);
    return null;
  }
}

// Check branch policy
function checkBranchPolicy(branch) {
  const config = loadConfiguration();
  
  // If branch has specific policy
  if (config.branchPolicies[branch]) {
    return config.branchPolicies[branch];
  }
  
  // Check branch patterns
  for (const [pattern, policy] of Object.entries(config.branchPolicies)) {
    if (new RegExp(pattern).test(branch)) {
      return policy;
    }
  }
  
  // Default policy
  return {
    requireApproval: false,
    minApprovers: 0,
    requiredTeams: []
  };
}

/**
 * Check if user has approval rights for a branch
 * @param {string} userId - User ID or email
 * @param {string} branch - Branch name
 * @param {string} team - Team name (optional)
 * @returns {boolean} - Whether user has approval rights
 */
function checkApprovalRights(userId, branch, team = null) {
  const config = loadConfiguration();
  const policy = checkBranchPolicy(branch);
  
  // If branch doesn't require approval, everyone has rights
  if (!policy.requireApproval) {
    return true;
  }
  
  // If specific teams are required
  if (policy.requiredTeams.length > 0) {
    // If team is specified, check if it's in the required teams
    if (team && !policy.requiredTeams.includes(team)) {
      return false;
    }
    
    // Check if user is in any of the required teams
    const userTeams = [];
    for (const teamConfig of config.teams) {
      if (teamConfig.members.includes(userId)) {
        userTeams.push(teamConfig.name);
      }
    }
    
    const hasRequiredTeam = policy.requiredTeams.some(team => userTeams.includes(team));
    if (!hasRequiredTeam) {
      return false;
    }
  }
  
  // Check user's role in their teams
  for (const teamConfig of config.teams) {
    if (teamConfig.members.includes(userId)) {
      const userRole = teamConfig.members[userId] || 'member';
      if (teamConfig.approvalRoles.includes(userRole)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Create a branch approval request
 * @param {string} branch - Branch name
 * @param {string} description - Description of changes
 * @param {string} creator - User ID or email of creator
 * @returns {Object} - Approval request object
 */
function createApprovalRequest(branch, description, creator) {
  ensureDirectories();
  
  const requestId = `APR-${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  const request = {
    id: requestId,
    branch,
    description,
    creator,
    status: 'pending',
    created: timestamp,
    updated: timestamp,
    approvals: [],
    comments: []
  };
  
  const requestsPath = path.join(ENTERPRISE_CONFIG_DIR, 'approvals.json');
  let requests = [];
  
  if (fs.existsSync(requestsPath)) {
    try {
      requests = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));
    } catch (error) {
      console.error('Failed to load approval requests:', error);
    }
  }
  
  requests.push(request);
  fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
  
  writeAuditLog('create_approval_request', { requestId, branch, creator });
  
  return request;
}

/**
 * Approve a branch approval request
 * @param {string} requestId - Approval request ID
 * @param {string} approver - User ID or email of approver
 * @param {string} comment - Approval comment
 * @returns {boolean} - Whether approval was successful
 */
function approveRequest(requestId, approver, comment = '') {
  const requestsPath = path.join(ENTERPRISE_CONFIG_DIR, 'approvals.json');
  
  if (!fs.existsSync(requestsPath)) {
    console.error('No approval requests found');
    return false;
  }
  
  try {
    const requests = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));
    const requestIndex = requests.findIndex(req => req.id === requestId);
    
    if (requestIndex === -1) {
      console.error(`Approval request ${requestId} not found`);
      return false;
    }
    
    const request = requests[requestIndex];
    
    // Check if already approved by this user
    if (request.approvals.some(a => a.approver === approver)) {
      console.error(`Request already approved by ${approver}`);
      return false;
    }
    
    // Check approver's rights
    if (!checkApprovalRights(approver, request.branch)) {
      console.error(`${approver} doesn't have approval rights for branch ${request.branch}`);
      return false;
    }
    
    // Add approval
    request.approvals.push({
      approver,
      timestamp: new Date().toISOString(),
      comment
    });
    
    // Add comment if provided
    if (comment) {
      request.comments.push({
        user: approver,
        timestamp: new Date().toISOString(),
        comment
      });
    }
    
    // Update request
    request.updated = new Date().toISOString();
    
    // Check if all required approvals are received
    const policy = checkBranchPolicy(request.branch);
    if (request.approvals.length >= policy.minApprovers) {
      request.status = 'approved';
    }
    
    requests[requestIndex] = request;
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
    
    writeAuditLog('approve_request', { requestId, approver, newStatus: request.status });
    
    return true;
  } catch (error) {
    console.error('Failed to approve request:', error);
    return false;
  }
}

/**
 * Check if files match security policy
 * @param {Array<string>} files - List of file paths
 * @returns {Object} - Result of security check
 */
function checkSecurityPolicy(files) {
  const config = loadConfiguration();
  const securityPolicy = config.securityPolicies;
  
  if (!securityPolicy) {
    return { passed: true, issues: [] };
  }
  
  const issues = [];
  
  // Check for secure files
  if (securityPolicy.secureFilesPatterns && securityPolicy.secureFilesPatterns.length > 0) {
    for (const file of files) {
      for (const pattern of securityPolicy.secureFilesPatterns) {
        if (new RegExp(pattern).test(file)) {
          issues.push({
            type: 'secure_file',
            file,
            message: `File matches secure file pattern: ${pattern}`
          });
        }
      }
    }
  }
  
  // Check for blocked patterns in files
  if (securityPolicy.blockedPatterns && securityPolicy.blockedPatterns.length > 0) {
    for (const file of files) {
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        continue;
      }
      
      try {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of securityPolicy.blockedPatterns) {
          const regex = new RegExp(pattern);
          if (regex.test(content)) {
            issues.push({
              type: 'blocked_pattern',
              file,
              pattern,
              message: `File contains blocked pattern: ${pattern}`
            });
          }
        }
      } catch (error) {
        console.error(`Failed to read file ${file}:`, error);
      }
    }
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

/**
 * Check JIRA integration
 * @param {string} branchName - Branch name
 * @returns {Object} - JIRA information extracted from branch name
 */
function checkJiraIntegration(branchName) {
  const config = loadConfiguration();
  
  if (!config.integrations?.jira?.enabled) {
    return { enabled: false };
  }
  
  const jiraConfig = config.integrations.jira;
  
  // Extract JIRA issue key from branch name
  const jiraKeyRegex = new RegExp(`${jiraConfig.projectKey}-\\d+`);
  const match = branchName.match(jiraKeyRegex);
  
  if (!match) {
    return { 
      enabled: true,
      found: false,
      message: `No JIRA issue key found in branch name. Expected format: ${jiraConfig.projectKey}-123` 
    };
  }
  
  const issueKey = match[0];
  
  return {
    enabled: true,
    found: true,
    issueKey,
    url: `${jiraConfig.url}/browse/${issueKey}`
  };
}

/**
 * Update changelog for a branch
 * @param {string} branch - Branch name
 * @param {string} changes - Description of changes
 * @param {string} author - Author of changes
 * @returns {boolean} - Whether changelog was updated successfully
 */
function updateChangelog(branch, changes, author) {
  const config = loadConfiguration();
  
  if (!config.changeManagement?.enabled || !config.changeManagement?.requireChangelog) {
    return true;
  }
  
  const changelogPath = config.changeManagement.changelogPath || 'CHANGELOG.md';
  
  if (!fs.existsSync(changelogPath)) {
    console.error(`Changelog file not found: ${changelogPath}`);
    return false;
  }
  
  try {
    let changelog = fs.readFileSync(changelogPath, 'utf8');
    
    // Extract branch type
    let branchType = 'other';
    if (branch.startsWith('feature/')) {
      branchType = 'feature';
    } else if (branch.startsWith('bugfix/') || branch.startsWith('fix/')) {
      branchType = 'bugfix';
    } else if (branch.startsWith('hotfix/')) {
      branchType = 'hotfix';
    } else if (branch.startsWith('release/')) {
      branchType = 'release';
    }
    
    // Check JIRA integration
    const jiraInfo = checkJiraIntegration(branch);
    const jiraReference = jiraInfo.found ? ` [${jiraInfo.issueKey}](${jiraInfo.url})` : '';
    
    // Format entry
    const date = new Date().toISOString().split('T')[0];
    const entry = `\n## [${date}] ${branchType}${jiraReference}\n\n${changes}\n\nAuthor: ${author}\n`;
    
    // Add entry after first heading
    changelog = changelog.replace(/^# .+?\n/, `$&\n${entry}`);
    
    fs.writeFileSync(changelogPath, changelog);
    
    writeAuditLog('update_changelog', { branch, author });
    
    return true;
  } catch (error) {
    console.error('Failed to update changelog:', error);
    return false;
  }
}

/**
 * Check if changes comply with branch policy
 * @param {string} branch - Branch name
 * @param {Array<string>} files - List of changed files
 * @returns {Object} - Result of compliance check
 */
function checkBranchCompliance(branch, files) {
  const config = loadConfiguration();
  const policy = checkBranchPolicy(branch);
  
  const issues = [];
  
  // Check security policy
  const securityCheck = checkSecurityPolicy(files);
  if (!securityCheck.passed) {
    issues.push(...securityCheck.issues);
  }
  
  // Check JIRA integration
  if (config.changeManagement?.enabled && config.changeManagement?.requireIssueReference) {
    const jiraCheck = checkJiraIntegration(branch);
    if (jiraCheck.enabled && !jiraCheck.found) {
      issues.push({
        type: 'missing_jira_reference',
        message: jiraCheck.message
      });
    }
  }
  
  return {
    compliant: issues.length === 0,
    issues,
    policy
  };
}

/**
 * Get list of pending approval requests
 * @returns {Array} - List of pending approval requests
 */
function getPendingApprovalRequests() {
  const requestsPath = path.join(ENTERPRISE_CONFIG_DIR, 'approvals.json');
  
  if (!fs.existsSync(requestsPath)) {
    return [];
  }
  
  try {
    const requests = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));
    return requests.filter(req => req.status === 'pending');
  } catch (error) {
    console.error('Failed to get pending approval requests:', error);
    return [];
  }
}

/**
 * Get audit log entries
 * @param {number} limit - Maximum number of entries to return
 * @returns {Array} - Audit log entries
 */
function getAuditLogEntries(limit = 50) {
  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return [];
  }
  
  try {
    const auditLog = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8'));
    return auditLog.slice(-limit);
  } catch (error) {
    console.error('Failed to get audit log entries:', error);
    return [];
  }
}

// Export functions
module.exports = {
  loadConfiguration,
  getCurrentBranch,
  checkBranchPolicy,
  checkApprovalRights,
  createApprovalRequest,
  approveRequest,
  checkSecurityPolicy,
  checkJiraIntegration,
  updateChangelog,
  checkBranchCompliance,
  getPendingApprovalRequests,
  getAuditLogEntries,
  writeAuditLog
};