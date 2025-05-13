#!/usr/bin/env node

/**
 * Enterprise Workflow for Claude Neural Framework
 * 
 * Provides enterprise-grade workflow features including:
 * - Branch approval process
 * - Policy enforcement
 * - Audit logging
 * - Team collaboration
 * - Change management
 * - JIRA/ADO Integration
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { program } = require('commander');

// Path to the enterprise configuration file
const CONFIG_PATH = path.resolve(__dirname, '../../core/config/enterprise_workflow_config.json');

// Default configuration
const DEFAULT_CONFIG = {
  requireApprovals: true,
  minApprovers: 2,
  enforceSecurityScan: true,
  jiraIntegration: {
    enabled: false,
    projectKey: "",
    url: ""
  },
  auditLogging: {
    enabled: true,
    detailLevel: "standard",
    retentionDays: 90
  },
  teams: [],
  policies: []
};

// Load or create configuration
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(configData);
    } else {
      // Create default config
      saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
  } catch (err) {
    console.error(`Error loading configuration: ${err.message}`);
    process.exit(1);
  }
}

// Save configuration
function saveConfig(config) {
  try {
    const configDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`Configuration saved to: ${CONFIG_PATH}`);
  } catch (err) {
    console.error(`Error saving configuration: ${err.message}`);
    process.exit(1);
  }
}

// Log to audit file
function logAudit(action, details) {
  const config = loadConfig();
  
  if (!config.auditLogging.enabled) {
    return;
  }
  
  const auditDir = path.resolve(__dirname, '../../logs/audit');
  if (!fs.existsSync(auditDir)) {
    fs.mkdirSync(auditDir, { recursive: true });
  }
  
  const today = new Date().toISOString().split('T')[0];
  const auditFile = path.join(auditDir, `audit-${today}.log`);
  
  const timestamp = new Date().toISOString();
  const username = getCurrentUser();
  const detailLevel = config.auditLogging.detailLevel || 'standard';
  
  let logEntry = `[${timestamp}] ${username} - ${action}`;
  
  if (detailLevel === 'verbose' && details) {
    logEntry += ` - ${JSON.stringify(details)}`;
  } else if (detailLevel === 'standard' && details) {
    const simpleDetails = typeof details === 'object' ? 
      Object.keys(details).reduce((acc, key) => {
        // Only include non-sensitive fields in standard logging
        if (!key.includes('token') && !key.includes('password') && !key.includes('secret')) {
          acc[key] = details[key];
        }
        return acc;
      }, {}) : details;
    logEntry += ` - ${JSON.stringify(simpleDetails)}`;
  }
  
  fs.appendFileSync(auditFile, logEntry + '\n');
  
  // Clean up old audit logs
  cleanupAuditLogs(config.auditLogging.retentionDays || 90);
}

// Clean up old audit logs based on retention policy
function cleanupAuditLogs(retentionDays) {
  const auditDir = path.resolve(__dirname, '../../logs/audit');
  if (!fs.existsSync(auditDir)) {
    return;
  }
  
  const files = fs.readdirSync(auditDir);
  const now = new Date();
  
  files.forEach(file => {
    if (file.startsWith('audit-') && file.endsWith('.log')) {
      const filePath = path.join(auditDir, file);
      const stats = fs.statSync(filePath);
      const fileDate = new Date(stats.mtime);
      
      const diffDays = Math.floor((now - fileDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays > retentionDays) {
        fs.unlinkSync(filePath);
        console.log(`Removed old audit log: ${file}`);
      }
    }
  });
}

// Get current Git user
function getCurrentUser() {
  try {
    return execSync('git config user.name', { encoding: 'utf8' }).trim();
  } catch (error) {
    return 'unknown-user';
  }
}

// Check if a branch requires specific approvers based on changed files
function checkPolicyRequirements(branch) {
  const config = loadConfig();
  const requiredApprovers = new Set();
  
  if (!config.policies || !config.policies.length) {
    return [];
  }
  
  // Get list of files changed in the branch
  try {
    const baseRef = 'main'; // Could be configured
    const changedFiles = execSync(`git diff --name-only ${baseRef}...${branch}`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(file => file.length > 0);
    
    if (changedFiles.length === 0) {
      return [];
    }
    
    // Match files against policy patterns
    config.policies.forEach(policy => {
      if (!policy.pathPatterns || !policy.requiredApprovers) return;
      
      const matchingFiles = changedFiles.filter(file => {
        return policy.pathPatterns.some(pattern => {
          // Convert glob pattern to regex pattern
          const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
            .replace(/\//g, '\\/');
          const regex = new RegExp(`^${regexPattern}$`);
          return regex.test(file);
        });
      });
      
      if (matchingFiles.length > 0) {
        policy.requiredApprovers.forEach(approver => requiredApprovers.add(approver));
      }
    });
    
    return Array.from(requiredApprovers);
  } catch (error) {
    console.error(`Error checking policy requirements: ${error.message}`);
    return [];
  }
}

// Get a list of existing approvals for a branch
function getApprovals(branch) {
  const approvalsDir = path.resolve(__dirname, '../../.git/enterprise/approvals');
  const approvalFile = path.join(approvalsDir, `${branch}.json`);
  
  if (!fs.existsSync(approvalFile)) {
    return [];
  }
  
  try {
    const approvalData = fs.readFileSync(approvalFile, 'utf8');
    return JSON.parse(approvalData);
  } catch (error) {
    console.error(`Error reading approvals: ${error.message}`);
    return [];
  }
}

// Save approvals for a branch
function saveApprovals(branch, approvals) {
  const approvalsDir = path.resolve(__dirname, '../../.git/enterprise/approvals');
  
  if (!fs.existsSync(approvalsDir)) {
    fs.mkdirSync(approvalsDir, { recursive: true });
  }
  
  const approvalFile = path.join(approvalsDir, `${branch}.json`);
  fs.writeFileSync(approvalFile, JSON.stringify(approvals, null, 2));
}

// Add an approval for a branch
function addApproval(branch, approver) {
  const approvals = getApprovals(branch);
  
  // Check if already approved by this approver
  if (approvals.some(a => a.approver === approver)) {
    console.log(`Branch ${branch} already approved by ${approver}`);
    return approvals;
  }
  
  // Add new approval
  approvals.push({
    approver,
    timestamp: new Date().toISOString(),
    commit: getCurrentCommit(branch)
  });
  
  saveApprovals(branch, approvals);
  logAudit('approve-branch', { branch, approver });
  
  return approvals;
}

// Get current commit hash for a branch
function getCurrentCommit(branch) {
  try {
    return execSync(`git rev-parse ${branch}`, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Error getting commit for branch ${branch}: ${error.message}`);
    return 'unknown';
  }
}

// Check if a branch can be merged based on approvals
function canBeMerged(branch) {
  const config = loadConfig();
  
  if (!config.requireApprovals) {
    return { canMerge: true };
  }
  
  const approvals = getApprovals(branch);
  const minApprovers = config.minApprovers || 2;
  
  // Check for minimum number of approvers
  if (approvals.length < minApprovers) {
    return { 
      canMerge: false, 
      reason: `Need ${minApprovers} approvals, but only have ${approvals.length}`,
      approvals 
    };
  }
  
  // Check for required policy approvals
  const requiredApprovers = checkPolicyRequirements(branch);
  
  if (requiredApprovers.length > 0) {
    const missingApprovers = requiredApprovers.filter(required => 
      !approvals.some(a => a.approver === required)
    );
    
    if (missingApprovers.length > 0) {
      return {
        canMerge: false,
        reason: `Missing required approvals from: ${missingApprovers.join(', ')}`,
        approvals,
        missingApprovers
      };
    }
  }
  
  return { canMerge: true, approvals };
}

// Command handlers
function handleInitialize() {
  console.log('Initializing enterprise workflow...');
  
  // Create enterprise config
  const config = loadConfig();
  
  // Create git hooks directory if needed
  const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  const hooksDir = path.join(gitRoot, '.git', 'hooks');
  
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
  
  // Create enterprise directories
  const enterpriseDir = path.join(gitRoot, '.git', 'enterprise');
  const approvalsDir = path.join(enterpriseDir, 'approvals');
  
  if (!fs.existsSync(enterpriseDir)) {
    fs.mkdirSync(enterpriseDir, { recursive: true });
  }
  
  if (!fs.existsSync(approvalsDir)) {
    fs.mkdirSync(approvalsDir, { recursive: true });
  }
  
  // Create pre-push hook for policy enforcement
  const prePushHookPath = path.join(hooksDir, 'pre-push');
  const prePushScript = `#!/bin/sh
# Enterprise workflow pre-push hook
echo "Checking enterprise policies before push..."
node ${path.resolve(__dirname, '../git-workflow.js')} enterprise policy-check
if [ $? -ne 0 ]; then
  echo "Policy check failed. Push aborted."
  exit 1
fi
exit 0
`;
  
  fs.writeFileSync(prePushHookPath, prePushScript);
  fs.chmodSync(prePushHookPath, '755');
  
  console.log(`Created pre-push hook: ${prePushHookPath}`);
  logAudit('initialize-enterprise-workflow', { config });
  
  console.log('Enterprise workflow initialized successfully.');
}

function handleRequestApproval(branch) {
  if (!branch) {
    branch = getCurrentBranch();
    if (!branch) {
      console.error('Could not determine current branch');
      process.exit(1);
    }
  }
  
  console.log(`Requesting approval for branch: ${branch}`);
  
  // Check if branch exists
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branch}`);
  } catch (error) {
    console.error(`Branch ${branch} does not exist`);
    process.exit(1);
  }
  
  // Identify required approvers
  const requiredApprovers = checkPolicyRequirements(branch);
  
  // Log approval request
  logAudit('request-approval', { branch, requiredApprovers });
  
  // In a real implementation, this would notify approvers via email/Slack/etc.
  console.log('Approval requested successfully.');
  if (requiredApprovers.length > 0) {
    console.log(`Required approvers based on changed files: ${requiredApprovers.join(', ')}`);
  }
  
  // Check for existing approvals
  const existingApprovals = getApprovals(branch);
  if (existingApprovals.length > 0) {
    console.log(`\nExisting approvals (${existingApprovals.length}):`);
    existingApprovals.forEach(approval => {
      console.log(`- ${approval.approver} at ${approval.timestamp}`);
    });
  }
  
  const config = loadConfig();
  console.log(`\nThis branch requires ${config.minApprovers || 2} approvals before merging.`);
}

function handleApprove(branch, approver) {
  if (!branch) {
    console.error('Branch name is required');
    process.exit(1);
  }
  
  if (!approver) {
    approver = getCurrentUser();
  }
  
  console.log(`Approving branch ${branch} as ${approver}`);
  
  // Check if branch exists
  try {
    execSync(`git show-ref --verify --quiet refs/heads/${branch}`);
  } catch (error) {
    console.error(`Branch ${branch} does not exist`);
    process.exit(1);
  }
  
  // Add approval
  const approvals = addApproval(branch, approver);
  
  console.log(`Approval added. Current approvals (${approvals.length}):`);
  approvals.forEach(approval => {
    console.log(`- ${approval.approver} at ${approval.timestamp}`);
  });
  
  // Check if branch can be merged
  const mergeStatus = canBeMerged(branch);
  if (mergeStatus.canMerge) {
    console.log('\nBranch is now approved for merging!');
  } else {
    console.log(`\nBranch needs additional approvals: ${mergeStatus.reason}`);
  }
}

function handleAudit() {
  const auditDir = path.resolve(__dirname, '../../logs/audit');
  
  if (!fs.existsSync(auditDir)) {
    console.log('No audit logs found');
    return;
  }
  
  // Get list of audit files
  const files = fs.readdirSync(auditDir)
    .filter(file => file.startsWith('audit-') && file.endsWith('.log'))
    .sort((a, b) => b.localeCompare(a)); // Sort in reverse chronological order
  
  if (files.length === 0) {
    console.log('No audit logs found');
    return;
  }
  
  // Display most recent log by default
  const latestLog = files[0];
  const logContent = fs.readFileSync(path.join(auditDir, latestLog), 'utf8');
  
  console.log(`Displaying most recent audit log (${latestLog}):`);
  console.log('-'.repeat(80));
  console.log(logContent);
  
  // Show available logs
  console.log('-'.repeat(80));
  console.log(`Available audit logs (${files.length}):`);
  files.forEach(file => {
    const stats = fs.statSync(path.join(auditDir, file));
    console.log(`- ${file} (${stats.size} bytes)`);
  });
  
  console.log('\nTo view a specific log, use: cat logs/audit/<filename>');
}

function handlePolicyCheck() {
  const config = loadConfig();
  
  if (!config.policies || config.policies.length === 0) {
    console.log('No policies configured');
    return;
  }
  
  console.log(`Checking compliance with ${config.policies.length} policies...`);
  
  // Get current branch
  const branch = getCurrentBranch();
  if (!branch) {
    console.error('Could not determine current branch');
    process.exit(1);
  }
  
  // Check policy requirements
  const requiredApprovers = checkPolicyRequirements(branch);
  
  if (requiredApprovers.length > 0) {
    console.log(`This branch requires approvals from: ${requiredApprovers.join(', ')}`);
    
    // Check if we have the required approvals
    const approvals = getApprovals(branch);
    const missingApprovers = requiredApprovers.filter(required => 
      !approvals.some(a => a.approver === required)
    );
    
    if (missingApprovers.length > 0) {
      console.log(`Missing required approvals from: ${missingApprovers.join(', ')}`);
    } else {
      console.log('All required approvals have been obtained.');
    }
  } else {
    console.log('No specific policy approvals required for changed files.');
  }
  
  // Run security scan if required
  if (config.enforceSecurityScan) {
    console.log('\nRunning security scan...');
    // In a real implementation, this would run a security scanner
    console.log('Security scan completed (simulated).');
  }
  
  // Log policy check
  logAudit('policy-check', { branch, requiredApprovers });
  
  console.log('\nPolicy check completed.');
}

function handleChangeRequest(description) {
  if (!description) {
    console.error('Change request description is required');
    process.exit(1);
  }
  
  const config = loadConfig();
  const changeRequestsDir = path.resolve(__dirname, '../../.git/enterprise/change-requests');
  
  if (!fs.existsSync(changeRequestsDir)) {
    fs.mkdirSync(changeRequestsDir, { recursive: true });
  }
  
  // Create change request
  const changeRequest = {
    id: `CR-${Date.now()}`,
    description,
    requester: getCurrentUser(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    approvals: []
  };
  
  // Save change request
  const changeRequestFile = path.join(changeRequestsDir, `${changeRequest.id}.json`);
  fs.writeFileSync(changeRequestFile, JSON.stringify(changeRequest, null, 2));
  
  // Log change request
  logAudit('create-change-request', { id: changeRequest.id, description });
  
  console.log(`Change request created: ${changeRequest.id}`);
  console.log('Description:', description);
  
  // In a real implementation, this would notify approvers via email/Slack/etc.
  console.log('Change request created successfully.');
}

function handleJiraSync() {
  const config = loadConfig();
  
  if (!config.jiraIntegration || !config.jiraIntegration.enabled) {
    console.log('JIRA integration is not enabled in the configuration.');
    console.log('To enable, update the configuration file:');
    console.log(CONFIG_PATH);
    return;
  }
  
  console.log('Synchronizing with JIRA...');
  console.log(`Project Key: ${config.jiraIntegration.projectKey}`);
  console.log(`JIRA URL: ${config.jiraIntegration.url}`);
  
  // In a real implementation, this would connect to JIRA API
  // and synchronize issues with branches/commits
  
  console.log('JIRA synchronization completed (simulated).');
  logAudit('jira-sync', { projectKey: config.jiraIntegration.projectKey });
}

function handleSetupTeam(teamName) {
  if (!teamName) {
    console.error('Team name is required');
    process.exit(1);
  }
  
  const config = loadConfig();
  
  // Check if team already exists
  const existingTeamIndex = config.teams.findIndex(team => team.name === teamName);
  
  if (existingTeamIndex >= 0) {
    console.log(`Team ${teamName} already exists. Updating configuration...`);
    
    // Update team configuration interactively
    const branchPrefix = readInput(`Enter branch prefix [${config.teams[existingTeamIndex].branchPrefix}]: `) || 
      config.teams[existingTeamIndex].branchPrefix;
    
    const reviewersStr = readInput(`Enter reviewers (comma-separated) [${config.teams[existingTeamIndex].reviewers.join(',')}]: `) || 
      config.teams[existingTeamIndex].reviewers.join(',');
    
    config.teams[existingTeamIndex] = {
      name: teamName,
      branchPrefix,
      reviewers: reviewersStr.split(',').map(r => r.trim()).filter(Boolean)
    };
  } else {
    console.log(`Creating new team: ${teamName}`);
    
    // Set up new team interactively
    const branchPrefix = readInput(`Enter branch prefix for ${teamName} (e.g., "${teamName.toLowerCase()}/", "feature/"): `);
    const reviewersStr = readInput('Enter reviewers (comma-separated): ');
    
    config.teams.push({
      name: teamName,
      branchPrefix,
      reviewers: reviewersStr.split(',').map(r => r.trim()).filter(Boolean)
    });
  }
  
  // Save updated configuration
  saveConfig(config);
  logAudit('setup-team', { teamName });
  
  console.log(`Team ${teamName} configured successfully.`);
}

// Utility function to get current branch
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

// Utility function to read input synchronously
function readInput(prompt) {
  const { spawnSync } = require('child_process');
  process.stdout.write(prompt);
  const result = spawnSync('read', ['-r', 'input', '&&', 'echo', '$input'], { 
    shell: true, 
    stdio: ['inherit', 'pipe', 'inherit'] 
  });
  return result.stdout.toString().trim();
}

// Main CLI program
program
  .name('enterprise-workflow')
  .description('Enterprise Workflow for Claude Neural Framework')
  .version('1.0.0');

program
  .command('initialize')
  .description('Initialize enterprise workflow')
  .action(handleInitialize);

program
  .command('request-approval')
  .description('Request approval for a branch')
  .argument('[branch]', 'Branch name (defaults to current branch)')
  .action(handleRequestApproval);

program
  .command('approve')
  .description('Approve a branch')
  .argument('<branch>', 'Branch name')
  .argument('[approver]', 'Approver name (defaults to current Git user)')
  .action(handleApprove);

program
  .command('audit')
  .description('Display audit log')
  .action(handleAudit);

program
  .command('policy-check')
  .description('Check enterprise policy compliance')
  .action(handlePolicyCheck);

program
  .command('change-request')
  .description('Create a new change request')
  .argument('<description>', 'Description of the change')
  .action(handleChangeRequest);

program
  .command('jira-sync')
  .description('Synchronize with JIRA')
  .action(handleJiraSync);

program
  .command('setup-team')
  .description('Configure a team')
  .argument('<team-name>', 'Team name')
  .action(handleSetupTeam);

// Parse command line arguments
program.parse(process.argv);