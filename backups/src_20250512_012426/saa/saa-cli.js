#!/usr/bin/env node

/**
 * SAA CLI Tool
 * 
 * Command line interface for managing the SAA (Server-as-API) service
 */

const { program } = require('commander');
const SaaService = require('./core/SaaService');
const path = require('path');
const chalk = require('chalk');

// Create SAA service instance
const saaService = new SaaService({
  configPath: path.join(process.cwd(), 'core/config/saa_config.json')
});

// Configure CLI
program
  .name('saa-cli')
  .description('Claude Neural Framework SAA (Server-as-API) CLI')
  .version('1.0.0');

// Start command
program
  .command('start')
  .description('Start SAA servers')
  .option('-s, --server <id>', 'Start specific server by ID')
  .option('-a, --all', 'Start all servers (default)')
  .action(async (options) => {
    try {
      // Initialize service
      await saaService.initialize();
      
      if (options.server) {
        // Start specific server
        console.log(chalk.blue(`Starting server: ${options.server}`));
        const result = await saaService.startServer(options.server);
        console.log(chalk.green(`Server ${options.server} started successfully`));
        console.log(JSON.stringify(result, null, 2));
      } else {
        // Start all servers
        console.log(chalk.blue('Starting all SAA servers...'));
        const results = await saaService.startAllServers();
        console.log(chalk.green('All servers started successfully'));
        
        // Display results table
        console.log('\nServer Status:');
        console.log('=============');
        
        for (const [serverId, result] of Object.entries(results)) {
          const statusColor = result.status === 'running' ? chalk.green : chalk.red;
          console.log(`${serverId}: ${statusColor(result.status)} (PID: ${result.pid || 'N/A'}, Port: ${result.port || 'N/A'})`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Stop command
program
  .command('stop')
  .description('Stop SAA servers')
  .option('-s, --server <id>', 'Stop specific server by ID')
  .option('-a, --all', 'Stop all servers (default)')
  .action(async (options) => {
    try {
      if (options.server) {
        // Stop specific server
        console.log(chalk.blue(`Stopping server: ${options.server}`));
        const result = await saaService.stopServer(options.server);
        
        if (result.status === 'stopped') {
          console.log(chalk.green(`Server ${options.server} stopped successfully`));
        } else {
          console.log(chalk.yellow(`Server ${options.server}: ${result.message}`));
        }
      } else {
        // Stop all servers
        console.log(chalk.blue('Stopping all SAA servers...'));
        const results = await saaService.stopAllServers();
        console.log(chalk.green('All servers stopped'));
        
        // Display results table
        console.log('\nStop Results:');
        console.log('============');
        
        for (const [serverId, result] of Object.entries(results)) {
          const statusColor = result.status === 'stopped' ? chalk.green : 
                             result.status === 'not_running' ? chalk.yellow : chalk.red;
          console.log(`${serverId}: ${statusColor(result.status)} - ${result.message}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Restart command
program
  .command('restart')
  .description('Restart SAA servers')
  .option('-s, --server <id>', 'Restart specific server by ID')
  .option('-a, --all', 'Restart all servers (default)')
  .action(async (options) => {
    try {
      // Initialize service
      await saaService.initialize();
      
      if (options.server) {
        // Restart specific server
        console.log(chalk.blue(`Restarting server: ${options.server}`));
        const result = await saaService.restartServer(options.server);
        console.log(chalk.green(`Server ${options.server} restarted successfully`));
      } else {
        // Restart all servers
        console.log(chalk.blue('Restarting all SAA servers...'));
        
        // Stop all servers
        await saaService.stopAllServers();
        
        // Start all servers
        const results = await saaService.startAllServers();
        console.log(chalk.green('All servers restarted successfully'));
        
        // Display results table
        console.log('\nServer Status:');
        console.log('=============');
        
        for (const [serverId, result] of Object.entries(results)) {
          const statusColor = result.status === 'running' ? chalk.green : chalk.red;
          console.log(`${serverId}: ${statusColor(result.status)} (PID: ${result.pid || 'N/A'}, Port: ${result.port || 'N/A'})`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show server status')
  .action(async () => {
    try {
      // Initialize service
      await saaService.initialize();
      
      const status = saaService.getServerStatus();
      
      console.log(chalk.blue('\nServer Status:'));
      console.log(chalk.blue('============='));
      
      if (Object.keys(status).length === 0) {
        console.log(chalk.yellow('No servers are currently tracked'));
      } else {
        for (const [serverId, serverStatus] of Object.entries(status)) {
          const statusColor = serverStatus.status === 'running' ? chalk.green : 
                             serverStatus.status === 'stopped' ? chalk.yellow : chalk.red;
          
          console.log(`${chalk.bold(serverId)} (${serverStatus.type}):`);
          console.log(`  Status: ${statusColor(serverStatus.status)}`);
          console.log(`  Port: ${serverStatus.port || 'N/A'}`);
          console.log(`  PID: ${serverStatus.pid || 'N/A'}`);
          
          if (serverStatus.uptime !== null) {
            console.log(`  Uptime: ${formatUptime(serverStatus.uptime)}`);
          }
          
          console.log('');
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// Parse arguments
program.parse(process.argv);

// Show help if no command is specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}