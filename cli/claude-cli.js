#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { version } = require('../package.json');

// Import commands
const debugCommand = require('./commands/debug');
const agentCommand = require('./commands/agent');
const projectCommand = require('./commands/project');
const uiCommand = require('./commands/ui');
const autonomyCommand = require('./commands/autonomy');
const helpCommand = require('./commands/help');

// Initialize the CLI program
program
  .name('claude-cli')
  .description('Command Line Interface for Claude Neural Framework')
  .version(version);

// Register commands
debugCommand(program);
agentCommand(program);
projectCommand(program);
uiCommand(program);
autonomyCommand(program);
helpCommand(program);

// Add global options
program
  .option('-v, --verbose', 'Enable verbose output')
  .option('--config <path>', 'Path to config file');

// Parse command line arguments
program.parse(process.argv);

// If no arguments, show help
if (process.argv.length === 2) {
  program.help();
}