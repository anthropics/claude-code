#!/usr/bin/env node

/**
 * Test Demonstration Script
 * 
 * This script demonstrates the testing framework for the Claude Neural Framework.
 * It shows how to run different types of tests and displays sample output.
 */

const { spawn } = require('child_process');
const path = require('path');
const chalk = require('chalk');

// Helper to run a command and display output
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(chalk.cyan(`> ${command} ${args.join(' ')}`));
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });
    
    process.on('close', (code) => {
      if (code === 0 || options.ignoreError) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Main function
async function main() {
  try {
    console.log(chalk.bold.green('\n=== Claude Neural Framework - Test Demonstration ===\n'));
    
    console.log(chalk.bold('Available Test Commands:'));
    console.log(chalk.yellow('npm test') + ' - Run unit tests');
    console.log(chalk.yellow('npm run test:watch') + ' - Run tests in watch mode');
    console.log(chalk.yellow('npm run test:coverage') + ' - Run tests with coverage report');
    console.log(chalk.yellow('npm run test:integration') + ' - Run integration tests');
    console.log(chalk.yellow('npm run test:e2e') + ' - Run end-to-end tests');
    console.log(chalk.yellow('npm run test:all') + ' - Run all tests\n');
    
    // Ask what to demo
    console.log(chalk.bold('Demonstrating Tests...\n'));
    
    // Run unit tests for specific component
    console.log(chalk.bold('1. Running unit tests for configuration system:'));
    await runCommand('npx', ['jest', 'config_manager.test.js', '--verbose'], { ignoreError: true });
    console.log();
    
    // Run unit tests for another component
    console.log(chalk.bold('2. Running unit tests for i18n system:'));
    await runCommand('npx', ['jest', 'i18n.test.js', '--verbose'], { ignoreError: true });
    console.log();
    
    // Run integration test
    console.log(chalk.bold('3. Running integration test for config and i18n:'));
    await runCommand('npx', ['jest', 'config_and_i18n.integration.test.js', '--verbose'], { ignoreError: true });
    console.log();
    
    // Run test coverage
    console.log(chalk.bold('4. Running test coverage report:'));
    await runCommand('npx', ['jest', '--coverage', '--coverageReporters=text'], { ignoreError: true });
    console.log();
    
    console.log(chalk.bold.green('Testing Demonstration Complete!'));
    console.log(`
For complete testing documentation, see:
${chalk.cyan('docs/guides/testing_guide.md')}
`);
  } catch (error) {
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error);