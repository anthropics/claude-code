/**
 * Agent Command Module
 * 
 * Provides Agent-to-Agent (A2A) communication and management
 * functionality for the Claude ecosystem.
 */

const path = require('path');
const { execSync, spawn } = require('child_process');
const fs = require('fs');

// Config paths
const HOME_DIR = process.env.HOME || process.env.USERPROFILE;
const CONFIG_DIR = path.join(HOME_DIR, '.claude');
const WORKSPACE_DIR = process.cwd();

/**
 * Find the A2A manager path
 */
const findA2AManager = () => {
  const possiblePaths = [
    path.join(WORKSPACE_DIR, 'core/mcp/a2a_manager.js'),
    path.join(WORKSPACE_DIR, '.claude/tools/a2a/a2a_manager.js'),
    path.join(CONFIG_DIR, 'tools/a2a/a2a_manager.js')
  ];
  
  let managerPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      managerPath = p;
      break;
    }
  }
  
  if (!managerPath) {
    console.error('Error: A2A manager not found');
    console.error('Please run "claude setup" to install the required components');
    process.exit(1);
  }
  
  return managerPath;
};

/**
 * Start the A2A manager service
 */
const startManager = (options = {}) => {
  console.log('Starting Agent-to-Agent manager...');
  
  const managerPath = findA2AManager();
  
  try {
    const nodeProcess = spawn('node', [managerPath], { 
      stdio: 'inherit',
      cwd: WORKSPACE_DIR
    });
    
    nodeProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`A2A manager exited with code ${code}`);
        process.exit(code);
      }
    });
    
    console.log('A2A manager started successfully');
  } catch (error) {
    console.error(`Error starting A2A manager: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Send a message to a target agent
 */
const sendMessage = (targetAgent, message, options = {}) => {
  console.log(`Sending message to agent: ${targetAgent}`);
  
  const managerPath = findA2AManager();
  
  // Build command arguments
  const args = [managerPath, '--to', targetAgent, '--message', message];
  
  if (options.priority) {
    args.push('--priority', options.priority);
  }
  
  if (options.context) {
    args.push('--context', options.context);
  }
  
  // Execute the command
  try {
    execSync(`node ${args.join(' ')}`, { 
      stdio: 'inherit',
      cwd: WORKSPACE_DIR
    });
  } catch (error) {
    console.error(`Error sending message: ${error.message}`);
    process.exit(1);
  }
};

/**
 * List available agents
 */
const listAgents = () => {
  console.log('Listing available agents...');
  
  const managerPath = findA2AManager();
  
  try {
    execSync(`node ${managerPath} --list`, { 
      stdio: 'inherit',
      cwd: WORKSPACE_DIR
    });
  } catch (error) {
    console.error(`Error listing agents: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Register a new agent
 */
const registerAgent = (agentType, options = {}) => {
  console.log(`Registering agent: ${agentType}`);
  
  const managerPath = findA2AManager();
  
  // Build command arguments
  const args = [managerPath, '--register', agentType];
  
  if (options.name) {
    args.push('--name', options.name);
  }
  
  if (options.config) {
    args.push('--config', options.config);
  }
  
  // Execute the command
  try {
    execSync(`node ${args.join(' ')}`, { 
      stdio: 'inherit',
      cwd: WORKSPACE_DIR
    });
  } catch (error) {
    console.error(`Error registering agent: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Register the agent command with the CLI program
 */
module.exports = (program) => {
  const agent = program
    .command('agent')
    .description('Agent-to-Agent communication and management');
  
  // Start the A2A manager
  agent
    .command('start')
    .description('Start the Agent-to-Agent manager service')
    .action(() => {
      startManager();
    });
  
  // Send a message to an agent
  agent
    .command('communicate <target-agent> <message>')
    .description('Send a message to a specific agent')
    .option('-p, --priority <level>', 'Message priority (low|medium|high)', 'medium')
    .option('-c, --context <file>', 'Context file to include with the message')
    .action((targetAgent, message, options) => {
      sendMessage(targetAgent, message, {
        priority: options.priority,
        context: options.context
      });
    });
  
  // List available agents
  agent
    .command('list')
    .description('List available registered agents')
    .action(() => {
      listAgents();
    });
  
  // Register a new agent
  agent
    .command('register <agent-type>')
    .description('Register a new agent of the specified type')
    .option('-n, --name <name>', 'Custom name for the agent')
    .option('-c, --config <file>', 'Configuration file for the agent')
    .action((agentType, options) => {
      registerAgent(agentType, {
        name: options.name,
        config: options.config
      });
    });
    
  return agent;
};