/**
 * Debug Command Module
 * 
 * Provides debugging functionality including recursive debugging,
 * performance analysis, and workflow automation.
 */

const path = require('path');
const { execSync, spawn } = require('child_process');
const fs = require('fs');

// Config paths
const HOME_DIR = process.env.HOME || process.env.USERPROFILE;
const CONFIG_DIR = path.join(HOME_DIR, '.claude');
const WORKSPACE_DIR = process.cwd();

/**
 * Run a debugging workflow on the specified file
 */
const runDebugWorkflow = (file, workflowType = 'standard', options = {}) => {
  console.log(`Running ${workflowType} debug workflow on ${file}...`);
  
  // Find the debug workflow engine
  const possiblePaths = [
    path.join(WORKSPACE_DIR, '.claude/tools/debug/debug_workflow_engine.js'),
    path.join(WORKSPACE_DIR, 'scripts/debug_workflow_engine.js'),
    path.join(CONFIG_DIR, 'tools/debug/debug_workflow_engine.js')
  ];
  
  let enginePath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      enginePath = p;
      break;
    }
  }
  
  if (!enginePath) {
    console.error('Error: Debug workflow engine not found');
    console.error('Please run "claude setup" to install the required components');
    process.exit(1);
  }
  
  // Build command arguments
  const args = ['run', workflowType, '--file', file];
  
  if (options.output) {
    args.push('--output', options.output);
  }
  
  // Execute the debug workflow
  try {
    const nodeProcess = spawn('node', [enginePath, ...args], { 
      stdio: 'inherit',
      cwd: WORKSPACE_DIR
    });
    
    nodeProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Debug workflow exited with code ${code}`);
        process.exit(code);
      }
    });
  } catch (error) {
    console.error(`Error executing debug workflow: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Create a debugging report for the codebase
 */
const createDebugReport = (options = {}) => {
  console.log('Generating debug report...');
  
  // Find the debug report generator
  const possiblePaths = [
    path.join(WORKSPACE_DIR, '.claude/tools/debug/create_debug_report.js'),
    path.join(WORKSPACE_DIR, 'scripts/create_debug_report.js'),
    path.join(CONFIG_DIR, 'tools/debug/create_debug_report.js')
  ];
  
  let reporterPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      reporterPath = p;
      break;
    }
  }
  
  if (!reporterPath) {
    console.error('Error: Debug report generator not found');
    console.error('Please run "claude setup" to install the required components');
    process.exit(1);
  }
  
  // Execute the report generator
  try {
    execSync(`node ${reporterPath}`, { 
      stdio: 'inherit',
      cwd: WORKSPACE_DIR
    });
  } catch (error) {
    console.error(`Error generating debug report: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Register the debug command with the CLI program
 */
module.exports = (program) => {
  const debug = program
    .command('debug')
    .description('Neural recursive debugging tools for code analysis');
  
  // Debug recursive command
  debug
    .command('recursive <file>')
    .description('Run recursive debugging on a file')
    .option('-w, --workflow <type>', 'Workflow type (standard|quick|deep|performance)', 'standard')
    .option('-o, --output <format>', 'Output format (text|json)', 'text')
    .action((file, options) => {
      runDebugWorkflow(file, options.workflow, {
        output: options.output
      });
    });
  
  // Debug report command
  debug
    .command('report')
    .description('Generate a debug report for the codebase')
    .action(() => {
      createDebugReport();
    });
  
  // Debug analyze command
  debug
    .command('analyze <target>')
    .description('Analyze code complexity and potential issues')
    .option('-t, --threshold <number>', 'Complexity threshold', '10')
    .action((target, options) => {
      console.log(`Analyzing ${target} with threshold ${options.threshold}...`);
      // Implementation would analyze the target file or directory
    });
    
  return debug;
};