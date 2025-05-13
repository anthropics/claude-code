#!/usr/bin/env node

/**
 * Git workflow automation for Claude Neural Framework
 * 
 * Provides a unified interface to git automation scripts
 * 
 * Usage:
 *   node git-workflow.js <command> [args...]
 * 
 * Commands:
 *   feature-start <description> [issue-number] - Create a new feature branch
 *   feature-finish                            - Finish current feature branch
 *   release-start <version>                   - Create a new release branch
 *   release-finish                            - Finish current release branch
 *   hotfix-start <version> <description>      - Create a new hotfix branch
 *   hotfix-finish                             - Finish current hotfix branch
 *   help                                      - Show this help message
 * 
 * Examples:
 *   node git-workflow.js feature-start "Add RAG integration" 123
 *   node git-workflow.js release-start 1.2.0
 */

const { spawnSync } = require('child_process');
const path = require('path');

// Parse command line arguments
const command = process.argv[2];
const args = process.argv.slice(3);

// Path to git scripts directory
const scriptsDir = path.join(__dirname, 'git');

const showHelp = () => {
  console.log(`
Git Workflow Automation for Claude Neural Framework
--------------------------------------------------

Usage:
  node git-workflow.js <command> [args...]

Commands:
  feature-start <description> [issue-number] - Create a new feature branch
  feature-finish                            - Finish current feature branch
  release-start <version>                   - Create a new release branch
  release-finish                            - Finish current release branch
  hotfix-start <version> <description>      - Create a new hotfix branch
  hotfix-finish                             - Finish current hotfix branch
  staged-split                              - Split staged changes into feature-based commits
  issue-cherry-pick <issue-number>          - Cherry-pick commits related to an issue
  commit-lint                               - Check and fix commit message format
  project-stats                             - Show repository statistics
  pr <subcommand>                           - Manage pull requests
  enterprise <subcommand>                   - Enterprise workflow features
  help                                      - Show this help message

Examples:
  node git-workflow.js feature-start "Add RAG integration" 123
  node git-workflow.js release-start 1.2.0
  node git-workflow.js staged-split --analyze
  node git-workflow.js issue-cherry-pick 456
  node git-workflow.js commit-lint --fix
  node git-workflow.js project-stats --since="1 month ago"
  node git-workflow.js pr list
`);
};

// Map commands to script files
const scriptMap = {
  'feature-start': 'feature-start.js',
  'feature-finish': 'feature-finish.js',
  'release-start': 'release-start.js',
  'release-finish': 'release-finish.js',
  'hotfix-start': 'hotfix-start.js',
  'hotfix-finish': 'hotfix-finish.js',
  'staged-split': 'staged-split-features.js',
  'issue-cherry-pick': 'issue-cherry-pick.js',
  'commit-lint': 'commit-lint.js',
  'project-stats': 'project-stats.js',
  'pr': 'pr-manager.js',
  'enterprise': 'enterprise-workflow.js',
};

// Check if command is provided
if (!command) {
  console.error('Error: Command is required');
  showHelp();
  process.exit(1);
}

// Show help if requested
if (command === 'help') {
  showHelp();
  process.exit(0);
}

// Check if command is valid
if (!scriptMap[command]) {
  console.error(`Error: Unknown command "${command}"`);
  showHelp();
  process.exit(1);
}

// Execute the corresponding script
const scriptPath = path.join(scriptsDir, scriptMap[command]);
const result = spawnSync('node', [scriptPath, ...args], { 
  stdio: 'inherit',
  shell: true
});

// Exit with the same code as the script
process.exit(result.status);