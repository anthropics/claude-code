#!/usr/bin/env node

/**
 * Claude CLI
 * 
 * Main entry point for Claude command line interface
 * 
 * Usage: claude <command> [options]
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

// Package info for versioning
let packageInfo = { version: '1.0.0' };
try {
  packageInfo = require('./package.json');
} catch (err) {
  // If package.json not found, use default version
}

// Config paths
const HOME_DIR = process.env.HOME || process.env.USERPROFILE;
const CONFIG_DIR = path.join(HOME_DIR, '.claude');
const WORKSPACE_DIR = process.cwd();

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Setup program
program
  .name('claude')
  .description('Claude AI command line interface for developers')
  .version(packageInfo.version);

// Import commands
const debugCommand = require('./commands/debug');
const agentCommand = require('./commands/agent');
const projectCommand = require('./commands/project');
const uiCommand = require('./commands/ui');
const autonomyCommand = require('./commands/autonomy');

// Register commands
debugCommand(program);
agentCommand(program);
projectCommand(program);
uiCommand(program);
autonomyCommand(program);

// Base help and examples
program.on('--help', () => {
  console.log('\nExamples:');
  console.log('  $ claude debug recursive src/app.js');
  console.log('  $ claude agent communicate git-agent "Analyze the latest commit"');
  console.log('  $ claude project create --template react');
  console.log('  $ claude ui theme --set dark');
  console.log('  $ claude autonomy think "Create unit tests for auth module"');
  console.log('\nDocumentation: https://github.com/yourusername/claude-code');
});

// Process arguments
program.parse(process.argv);

// If no arguments, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}