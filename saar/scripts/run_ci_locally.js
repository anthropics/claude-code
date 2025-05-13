#!/usr/bin/env node

/**
 * Run CI Pipeline Locally
 *
 * This script runs the CI pipeline locally to simulate what happens in the GitHub Actions workflow.
 * It helps developers catch issues before pushing code.
 *
 * Enterprise Beta support added - includes additional stages for compliance, governance and security.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

// Define CI stages and commands
const ciStages = [
  {
    name: 'Lint',
    command: 'npx',
    args: ['eslint', 'core/', '--ext', '.js'],
    optional: false
  },
  {
    name: 'Unit Tests',
    command: 'npm',
    args: ['test'],
    optional: false
  },
  {
    name: 'Integration Tests',
    command: 'npm',
    args: ['run', 'test:integration'],
    optional: true
  },
  {
    name: 'Security Scan',
    command: 'node',
    args: ['core/security/security_check.js', '--output', 'security-report.json', '--relaxed'],
    optional: false
  },
  {
    name: 'Build',
    command: 'mkdir',
    args: ['-p', 'dist'],
    postCommands: [
      { command: 'cp', args: ['-R', 'core', 'dist/'] },
      { command: 'cp', args: ['-R', 'docs', 'dist/'] },
      { command: 'cp', args: ['package.json', 'dist/'] },
      { command: 'cp', args: ['README.md', 'dist/'] },
      { command: 'cp', args: ['LICENSE.md', 'dist/'] }
    ],
    optional: false
  }
];

// Define Enterprise-specific stages (only used when --enterprise flag is present)
const enterpriseStages = [
  {
    name: 'Compliance Validation',
    command: 'node',
    args: ['core/security/compliance_check.js', '--output', 'compliance-report.json'],
    optional: false
  },
  {
    name: 'Governance Check',
    command: 'node',
    args: ['core/security/governance_check.js', '--output', 'governance-report.json'],
    optional: false
  },
  {
    name: 'Vulnerability Assessment',
    command: 'node',
    args: ['core/security/vuln_assessment.js', '--depth', 'high', '--output', 'vulnerability-report.json'],
    optional: false
  },
  {
    name: 'Audit Log Verification',
    command: 'node',
    args: ['core/logging/audit_verification.js'],
    optional: true
  }
];

// Run a command and return a promise
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(chalk.cyan(`> ${command} ${args.join(' ')}`));
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });
    
    process.on('close', (code) => {
      if (code === 0 || options.ignoreError) {
        resolve({ command, args, code });
      } else {
        reject(new Error(`Command '${command} ${args.join(' ')}' failed with exit code ${code}`));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Run multiple commands in sequence
async function runSequence(commands) {
  for (const cmd of commands) {
    await runCommand(cmd.command, cmd.args, cmd.options);
  }
}

// Main function
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipOptional = args.includes('--skip-optional');
  const isEnterprise = args.includes('--enterprise');
  const complianceFramework = args.find(arg => arg.startsWith('--compliance='))?.split('=')[1];
  const stage = args.find(arg => !arg.startsWith('--'));

  console.log(chalk.bold.green(`\n=== Running CI Pipeline Locally ${isEnterprise ? '(Enterprise Mode)' : ''} ===\n`));

  // Determine which stages to run
  let stagesToRun = [...ciStages];

  // Add enterprise stages if enterprise flag is present
  if (isEnterprise) {
    console.log(chalk.blue('Enterprise mode enabled. Adding enterprise-specific stages.'));
    stagesToRun = [...stagesToRun, ...enterpriseStages];

    // Update args for enterprise stages if compliance framework is specified
    if (complianceFramework) {
      console.log(chalk.blue(`Compliance framework specified: ${complianceFramework}`));
      stagesToRun.forEach(stage => {
        if (stage.name === 'Compliance Validation') {
          stage.args.push('--framework', complianceFramework);
        }
      });
    }
  }

  // Filter by specific stage if provided
  if (stage) {
    const allStages = [...ciStages, ...(isEnterprise ? enterpriseStages : [])];
    const stageIndex = allStages.findIndex(s => s.name.toLowerCase() === stage.toLowerCase());
    if (stageIndex === -1) {
      console.error(chalk.red(`Error: Stage "${stage}" not found`));
      console.log(chalk.yellow('Available stages:'));
      allStages.forEach(s => console.log(`  - ${s.name}`));
      process.exit(1);
    }
    stagesToRun = [allStages[stageIndex]];
  } else if (skipOptional) {
    stagesToRun = stagesToRun.filter(s => !s.optional);
  }

  console.log(chalk.blue('Stages to run:'));
  stagesToRun.forEach(s => console.log(`  - ${s.name}${s.optional ? ' (optional)' : ''}`));
  console.log();
  
  // Run each stage
  let success = true;
  for (const stage of stagesToRun) {
    console.log(chalk.bold(`\n=== Stage: ${stage.name} ===\n`));
    try {
      // Run main command
      await runCommand(stage.command, stage.args);
      
      // Run post commands if any
      if (stage.postCommands && stage.postCommands.length > 0) {
        console.log(chalk.bold('\nRunning post-commands:'));
        await runSequence(stage.postCommands);
      }
      
      console.log(chalk.green(`\n✓ Stage "${stage.name}" completed successfully\n`));
    } catch (error) {
      console.error(chalk.red(`\n✗ Stage "${stage.name}" failed: ${error.message}\n`));
      success = false;
      break;
    }
  }
  
  // Final result
  if (success) {
    console.log(chalk.bold.green('\n=== CI Pipeline Completed Successfully ===\n'));
    process.exit(0);
  } else {
    console.log(chalk.bold.red('\n=== CI Pipeline Failed ===\n'));
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(1);
});