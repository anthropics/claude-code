#!/usr/bin/env node

/**
 * Git Agent
 * =========
 * 
 * Agent for Git operations that integrates with the A2A protocol.
 * Provides Git functionality with color schema integration.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const os = require('os');

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.claude');
const ABOUT_FILE = path.join(CONFIG_DIR, 'user.about.json');
const COLOR_SCHEMA_FILE = path.join(CONFIG_DIR, 'user.colorschema.json');

// Load color schema manager
const colorSchemaManager = require('./color_schema_manager');

/**
 * Main Git Agent class
 */
class GitAgent {
  constructor() {
    this.userProfile = this.loadUserProfile();
    this.colorSchema = this.loadColorSchema();
  }

  /**
   * Load user profile
   */
  loadUserProfile() {
    try {
      if (fs.existsSync(ABOUT_FILE)) {
        return JSON.parse(fs.readFileSync(ABOUT_FILE, 'utf8'));
      }
    } catch (err) {
      console.warn(`Could not load user profile: ${err.message}`);
    }
    return null;
  }

  /**
   * Load color schema
   */
  loadColorSchema() {
    try {
      return colorSchemaManager.getColorSchema();
    } catch (err) {
      console.warn(`Could not load color schema: ${err.message}`);
      // Return a default color schema
      return {
        name: "Default",
        colors: {
          primary: "#3f51b5",
          secondary: "#7986cb",
          accent: "#ff4081",
          success: "#4caf50",
          warning: "#ff9800",
          danger: "#f44336",
          background: "#ffffff",
          text: "#212121"
        }
      };
    }
  }

  /**
   * Process A2A message
   * @param {Object} message - The A2A message
   * @returns {Object} - The response message
   */
  processMessage(message) {
    try {
      const { task, params } = message;

      if (task !== 'git-operation') {
        return this.createErrorResponse(message, 'Unsupported task', 400);
      }

      if (!params || typeof params !== 'object') {
        return this.createErrorResponse(message, 'Invalid parameters', 400);
      }

      const { operation, color_schema } = params;

      if (!operation) {
        return this.createErrorResponse(message, 'Missing operation parameter', 400);
      }
    
    // Use provided color schema or default to the user's
    if (color_schema) {
      this.colorSchema = {
        name: "Custom",
        colors: color_schema
      };
    }

    // Route to appropriate git operation
    switch (operation) {
      case 'status':
        return this.gitStatus(message);
      case 'commit':
        return this.gitCommit(message);
      case 'pull':
        return this.gitPull(message);
      case 'push':
        return this.gitPush(message);
      case 'log':
        return this.gitLog(message);
      case 'branch':
        return this.gitBranch(message);
      case 'checkout':
        return this.gitCheckout(message);
      case 'diff':
        return this.gitDiff(message);
      default:
        return this.createErrorResponse(message, `Unsupported git operation: ${operation}`, 400);
    }
    } catch (error) {
      return this.createErrorResponse(message, `Error processing message: ${error.message}`, 500);
    }
  }
  
  /**
   * Create a success response
   * @param {Object} message - Original message
   * @param {String} output - Command output
   * @param {String} command - Command executed
   * @returns {Object} - Response message
   */
  createSuccessResponse(message, output, command) {
    return {
      to: message.from,
      from: message.to || 'git-agent',
      conversationId: message.conversationId,
      task: 'git-response',
      params: {
        status: 'success',
        command,
        output,
        color_schema: this.colorSchema.colors
      }
    };
  }
  
  /**
   * Create an error response
   * @param {Object} message - Original message
   * @param {String} error - Error message
   * @param {Number} code - Error code
   * @returns {Object} - Response message
   */
  createErrorResponse(message, error, code = 500) {
    return {
      to: message.from,
      from: message.to || 'git-agent',
      conversationId: message.conversationId,
      task: 'git-response',
      params: {
        status: 'error',
        code,
        error,
        color_schema: this.colorSchema.colors
      }
    };
  }
  
  /**
   * Format command output with color schema
   * @param {String} output - Raw command output
   * @returns {String} - Formatted output
   */
  formatOutput(output) {
    const colors = this.colorSchema.colors;
    
    // Replace common git status colors
    output = output
      .replace(/modified:/g, chalk.hex(colors.warning)('modified:'))
      .replace(/new file:/g, chalk.hex(colors.success)('new file:'))
      .replace(/deleted:/g, chalk.hex(colors.danger)('deleted:'))
      .replace(/renamed:/g, chalk.hex(colors.primary)('renamed:'))
      .replace(/Your branch is up to date/g, chalk.hex(colors.success)('Your branch is up to date'))
      .replace(/Your branch is ahead/g, chalk.hex(colors.warning)('Your branch is ahead'))
      .replace(/Your branch is behind/g, chalk.hex(colors.warning)('Your branch is behind'))
      .replace(/Untracked files:/g, chalk.hex(colors.secondary)('Untracked files:'))
      .replace(/Changes to be committed:/g, chalk.hex(colors.primary)('Changes to be committed:'))
      .replace(/Changes not staged for commit:/g, chalk.hex(colors.warning)('Changes not staged for commit:'));
    
    return output;
  }
  
  /**
   * Check if the current directory is a git repository
   * @returns {Boolean} - True if a git repository
   */
  isGitRepository() {
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Execute git status command
   * @param {Object} message - Original message
   * @returns {Object} - Response message
   */
  gitStatus(message) {
    if (!message || !message.from) {
      return this.createErrorResponse({from: 'unknown'}, 'Invalid message', 400);
    }

    if (!this.isGitRepository()) {
      return this.createErrorResponse(message, 'Not a git repository', 400);
    }

    try {
      const output = execSync('git status').toString();
      const formattedOutput = this.formatOutput(output);
      return this.createSuccessResponse(message, formattedOutput, 'git status');
    } catch (error) {
      return this.createErrorResponse(message, `Error executing git status: ${error.message}`, 500);
    }
  }
  
  /**
   * Execute git commit command
   * @param {Object} message - Original message
   * @returns {Object} - Response message
   */
  gitCommit(message) {
    const { message: commitMessage, all } = message.params;
    
    if (!this.isGitRepository()) {
      return this.createErrorResponse(message, 'Not a git repository', 400);
    }
    
    if (!commitMessage) {
      return this.createErrorResponse(message, 'Commit message is required', 400);
    }
    
    try {
      let command = `git commit -m "${commitMessage}"`;
      
      if (all) {
        command = `git add -A && ${command}`;
      }
      
      const output = execSync(command).toString();
      const formattedOutput = this.formatOutput(output);
      return this.createSuccessResponse(message, formattedOutput, command);
    } catch (error) {
      return this.createErrorResponse(message, error.message);
    }
  }
  
  /**
   * Execute git pull command
   * @param {Object} message - Original message
   * @returns {Object} - Response message
   */
  gitPull(message) {
    const { branch } = message.params;
    
    if (!this.isGitRepository()) {
      return this.createErrorResponse(message, 'Not a git repository', 400);
    }
    
    try {
      let command = 'git pull';
      
      if (branch) {
        command = `git pull origin ${branch}`;
      }
      
      const output = execSync(command).toString();
      const formattedOutput = this.formatOutput(output);
      return this.createSuccessResponse(message, formattedOutput, command);
    } catch (error) {
      return this.createErrorResponse(message, error.message);
    }
  }
  
  /**
   * Execute git push command
   * @param {Object} message - Original message
   * @returns {Object} - Response message
   */
  gitPush(message) {
    const { branch } = message.params;
    
    if (!this.isGitRepository()) {
      return this.createErrorResponse(message, 'Not a git repository', 400);
    }
    
    try {
      let command = 'git push';
      
      if (branch) {
        command = `git push origin ${branch}`;
      }
      
      const output = execSync(command).toString();
      const formattedOutput = this.formatOutput(output);
      return this.createSuccessResponse(message, formattedOutput, command);
    } catch (error) {
      return this.createErrorResponse(message, error.message);
    }
  }
  
  /**
   * Execute git log command
   * @param {Object} message - Original message
   * @returns {Object} - Response message
   */
  gitLog(message) {
    const { limit } = message.params;
    
    if (!this.isGitRepository()) {
      return this.createErrorResponse(message, 'Not a git repository', 400);
    }
    
    try {
      let command = 'git log';
      
      if (limit && !isNaN(parseInt(limit))) {
        command = `git log -n ${parseInt(limit)}`;
      }
      
      const output = execSync(command).toString();
      const formattedOutput = this.formatOutput(output);
      return this.createSuccessResponse(message, formattedOutput, command);
    } catch (error) {
      return this.createErrorResponse(message, error.message);
    }
  }
  
  /**
   * Execute git branch command
   * @param {Object} message - Original message
   * @returns {Object} - Response message
   */
  gitBranch(message) {
    const { name } = message.params;
    
    if (!this.isGitRepository()) {
      return this.createErrorResponse(message, 'Not a git repository', 400);
    }
    
    try {
      let command = 'git branch';
      
      if (name) {
        command = `git branch ${name}`;
      }
      
      const output = execSync(command).toString();
      const formattedOutput = this.formatOutput(output);
      return this.createSuccessResponse(message, formattedOutput, command);
    } catch (error) {
      return this.createErrorResponse(message, error.message);
    }
  }
  
  /**
   * Execute git checkout command
   * @param {Object} message - Original message
   * @returns {Object} - Response message
   */
  gitCheckout(message) {
    const { branch } = message.params;
    
    if (!this.isGitRepository()) {
      return this.createErrorResponse(message, 'Not a git repository', 400);
    }
    
    if (!branch) {
      return this.createErrorResponse(message, 'Branch parameter is required', 400);
    }
    
    try {
      const command = `git checkout ${branch}`;
      const output = execSync(command).toString();
      const formattedOutput = this.formatOutput(output);
      return this.createSuccessResponse(message, formattedOutput, command);
    } catch (error) {
      return this.createErrorResponse(message, error.message);
    }
  }
  
  /**
   * Execute git diff command
   * @param {Object} message - Original message
   * @returns {Object} - Response message
   */
  gitDiff(message) {
    const { file } = message.params;
    
    if (!this.isGitRepository()) {
      return this.createErrorResponse(message, 'Not a git repository', 400);
    }
    
    try {
      let command = 'git diff';
      
      if (file) {
        command = `git diff ${file}`;
      }
      
      const output = execSync(command).toString();
      const formattedOutput = this.formatOutput(output);
      return this.createSuccessResponse(message, formattedOutput, command);
    } catch (error) {
      return this.createErrorResponse(message, error.message);
    }
  }
}

/**
 * Process A2A message from command line
 */
function processFromCommandLine() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: node git_agent.js --operation=status|commit|pull|push|log|branch|checkout|diff [options]');
    console.log('');
    console.log('Options:');
    console.log('  --message=<message>  Commit message (required for commit operation)');
    console.log('  --branch=<branch>    Branch name (required for checkout, optional for others)');
    console.log('  --file=<file>        File path (optional for diff operation)');
    console.log('  --all                Include all files (optional for commit operation)');
    console.log('  --limit=<number>     Limit number of entries (optional for log operation)');
    return;
  }
  
  // Parse arguments into message format
  const params = {};
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const parts = arg.substring(2).split('=');
      if (parts.length === 2) {
        const [key, value] = parts;
        params[key] = value;
      } else if (parts.length === 1) {
        params[parts[0]] = true;
      }
    }
  });
  
  // Create A2A message
  const operation = params.operation;
  delete params.operation;
  
  const message = {
    from: 'cli-user',
    to: 'git-agent',
    task: 'git-operation',
    params: {
      operation,
      ...params
    },
    conversationId: `git-session-${Date.now()}`
  };
  
  // Process message
  const agent = new GitAgent();
  const response = agent.processMessage(message);
  
  // Print response
  if (response.params.status === 'success') {
    console.log(response.params.output);
  } else {
    console.error(`Error: ${response.params.error}`);
    process.exit(1);
  }
}

/**
 * A2A message handler for integration with the framework
 * @param {Object} message - A2A message
 * @returns {Object} - Response message
 */
function handleA2AMessage(message) {
  const agent = new GitAgent();
  return agent.processMessage(message);
}

// When run directly
if (require.main === module) {
  processFromCommandLine();
}

// Export for A2A integration
module.exports = {
  handleA2AMessage
};