#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import sequentialExecuteCommand from './commands/sequential-execute';

// Create CLI program
const program = new Command();

// Program metadata
program
  .name('claude')
  .description('Claude Neural Framework CLI')
  .version('1.0.0');

// Register commands
program.addCommand(sequentialExecuteCommand);

// Add more commands as they are implemented

// Parse arguments
program.parse(process.argv);

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  console.log(chalk.bold.blue('Claude Neural Framework CLI'));
  console.log();
  program.outputHelp();
}