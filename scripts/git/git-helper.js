#!/usr/bin/env node

/**
 * Git Helper
 * ==========
 * 
 * Helper script for Git operations in the Claude Neural Framework.
 */

const { execSync } = require('child_process');
const chalk = require('chalk');
const a2aManager = require('../../core/mcp/a2a_manager');

/**
 * Send a Git command through A2A
 * @param {Object} params - Git command parameters
 */
async function sendGitCommand(params) {
  const message = {
    from: 'git-helper',
    to: 'git-agent',
    task: 'git-operation',
    params
  };
  
  try {
    const response = await a2aManager.sendMessage(message);
    
    if (response.params?.status === 'success') {
      console.log(response.params.output);
    } else {
      console.error(`Error: ${response.params?.error || 'Unknown error'}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: node git-helper.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  status              Show repository status');
    console.log('  commit <message>    Commit changes with message');
    console.log('  pull [branch]       Pull changes from remote');
    console.log('  push [branch]       Push changes to remote');
    console.log('  log [n]             Show commit history (n entries)');
    console.log('  branch [name]       List or create branches');
    console.log('  checkout <branch>   Switch to branch');
    console.log('  diff [file]         Show changes');
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'status':
      await sendGitCommand({ operation: 'status' });
      break;
    
    case 'commit':
      if (args.length < 2) {
        console.error('Error: Commit message required');
        process.exit(1);
      }
      await sendGitCommand({ 
        operation: 'commit', 
        message: args[1],
        all: args.includes('--all') || args.includes('-a')
      });
      break;
    
    case 'pull':
      await sendGitCommand({ 
        operation: 'pull',
        branch: args[1]
      });
      break;
    
    case 'push':
      await sendGitCommand({ 
        operation: 'push',
        branch: args[1]
      });
      break;
    
    case 'log':
      await sendGitCommand({ 
        operation: 'log',
        limit: args[1] ? parseInt(args[1]) : undefined
      });
      break;
    
    case 'branch':
      await sendGitCommand({ 
        operation: 'branch',
        name: args[1]
      });
      break;
    
    case 'checkout':
      if (args.length < 2) {
        console.error('Error: Branch name required');
        process.exit(1);
      }
      await sendGitCommand({ 
        operation: 'checkout',
        branch: args[1]
      });
      break;
    
    case 'diff':
      await sendGitCommand({ 
        operation: 'diff',
        file: args[1]
      });
      break;
    
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(console.error);
