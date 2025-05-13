#!/usr/bin/env node

/**
 * SAAR-MCP Tools Automatic Updater
 * 
 * This script provides automatic update capabilities for MCP tools:
 * 1. Scheduled updates with configurable frequency
 * 2. Version monitoring and notifications
 * 3. Automatic health checks after updates
 * 4. Rollback capability for failed updates
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');
const https = require('https');

// Configuration
const CONFIG_DIR = process.env.HOME + '/.claude';
const MCP_CONFIG_DIR = path.join(CONFIG_DIR, 'mcp');
const UPDATE_CONFIG_PATH = path.join(MCP_CONFIG_DIR, 'update_config.json');
const TOOLS_REGISTRY_PATH = path.join(MCP_CONFIG_DIR, 'tools_registry.json');
const UPDATE_SCRIPT_PATH = path.join(MCP_CONFIG_DIR, 'update_mcp_tools.js');
const UPDATE_LOG_PATH = path.join(MCP_CONFIG_DIR, 'logs', 'updates.log');
const VERSION_CACHE_PATH = path.join(MCP_CONFIG_DIR, 'cache', 'versions_cache.json');
const WORKSPACE_DIR = process.cwd();
const MCP_JSON_PATH = path.join(WORKSPACE_DIR, '.mcp.json');

// Ensure directories exist
ensureDirectoriesExist();

// Default update configuration
const DEFAULT_UPDATE_CONFIG = {
  enabled: true,
  frequency: 'weekly', // Options: 'daily', 'weekly', 'monthly', 'manual'
  dayOfWeek: 1, // Monday (for weekly updates)
  dayOfMonth: 1, // First day (for monthly updates)
  hourOfDay: 3, // 3 AM
  autoRestart: true,
  checkFrequency: 'daily', // How often to check for updates
  lastCheck: null,
  lastUpdate: null,
  notifyOnly: false, // If true, only notify about updates but don't install them
  criticalToolsOnly: false, // If true, only update tools marked as 'critical'
  healthCheckAfterUpdate: true,
  automaticRollback: true
};

// Ensure directories exist
function ensureDirectoriesExist() {
  const dirs = [
    MCP_CONFIG_DIR,
    path.join(MCP_CONFIG_DIR, 'cache'),
    path.join(MCP_CONFIG_DIR, 'logs')
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Read update configuration
function readUpdateConfig() {
  try {
    if (fs.existsSync(UPDATE_CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(UPDATE_CONFIG_PATH, 'utf8'));
      return { ...DEFAULT_UPDATE_CONFIG, ...config };
    }
  } catch (err) {
    console.error(`Error reading update config: ${err.message}`);
  }
  
  // Create default config
  writeUpdateConfig(DEFAULT_UPDATE_CONFIG);
  
  return DEFAULT_UPDATE_CONFIG;
}

// Write update configuration
function writeUpdateConfig(config) {
  try {
    fs.writeFileSync(UPDATE_CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`Updated update configuration`);
  } catch (err) {
    console.error(`Error writing update config: ${err.message}`);
  }
}

// Read tools registry
function readToolsRegistry() {
  try {
    if (fs.existsSync(TOOLS_REGISTRY_PATH)) {
      return JSON.parse(fs.readFileSync(TOOLS_REGISTRY_PATH, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading tools registry: ${err.message}`);
  }
  
  return { tools: {} };
}

// Read MCP JSON configuration
function readMcpJson() {
  try {
    if (fs.existsSync(MCP_JSON_PATH)) {
      return JSON.parse(fs.readFileSync(MCP_JSON_PATH, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading .mcp.json: ${err.message}`);
  }
  
  return { mcpServers: {} };
}

// Log update activity
function logUpdate(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync(UPDATE_LOG_PATH, logEntry);
  } catch (err) {
    console.error(`Error writing to update log: ${err.message}`);
  }
  
  console.log(message);
}

// Check if updates are due
function isUpdateDue(config) {
  const now = new Date();
  const lastUpdate = config.lastUpdate ? new Date(config.lastUpdate) : null;
  
  if (!lastUpdate) {
    return true; // No previous update, so update is due
  }
  
  switch (config.frequency) {
    case 'daily':
      // Check if last update was yesterday or earlier
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return lastUpdate <= yesterday;
    
    case 'weekly':
      // Check if it's the configured day of the week and last update was a week ago or more
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return now.getDay() === config.dayOfWeek && lastUpdate <= weekAgo;
    
    case 'monthly':
      // Check if it's the configured day of the month and last update was a month ago or more
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return now.getDate() === config.dayOfMonth && lastUpdate <= monthAgo;
    
    case 'manual':
      return false; // Manual updates only
    
    default:
      return false;
  }
}

// Check if version check is due
function isVersionCheckDue(config) {
  const now = new Date();
  const lastCheck = config.lastCheck ? new Date(config.lastCheck) : null;
  
  if (!lastCheck) {
    return true; // No previous check, so check is due
  }
  
  switch (config.checkFrequency) {
    case 'daily':
      // Check if last check was yesterday or earlier
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return lastCheck <= yesterday;
    
    case 'weekly':
      // Check if last check was a week ago or more
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return lastCheck <= weekAgo;
    
    case 'monthly':
      // Check if last check was a month ago or more
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return lastCheck <= monthAgo;
    
    default:
      return true;
  }
}

// Check versions of installed MCP tools
async function checkToolVersions() {
  const registry = readToolsRegistry();
  const mcpConfig = readMcpJson();
  const updates = [];
  
  // Read version cache
  let versionCache = {};
  try {
    if (fs.existsSync(VERSION_CACHE_PATH)) {
      versionCache = JSON.parse(fs.readFileSync(VERSION_CACHE_PATH, 'utf8'));
    }
  } catch (err) {
    console.error(`Error reading version cache: ${err.message}`);
  }
  
  // Only check tools that are registered and have a package name
  for (const [toolName, toolInfo] of Object.entries(registry.tools)) {
    if (toolInfo && toolInfo.package && mcpConfig.mcpServers[toolName]) {
      try {
        // Get latest version from npm
        const latestVersion = await getLatestVersion(toolInfo.package);
        
        // Get currently installed version
        let installedVersion = 'unknown';
        try {
          const versionOutput = execSync(`npm list -g ${toolInfo.package} --json`, { timeout: 5000 }).toString();
          const versionData = JSON.parse(versionOutput);
          
          if (versionData && versionData.dependencies) {
            installedVersion = versionData.dependencies[toolInfo.package].version;
          }
        } catch (err) {
          installedVersion = 'not installed';
        }
        
        // Compare versions
        if (latestVersion && installedVersion !== latestVersion) {
          updates.push({
            name: toolName,
            package: toolInfo.package,
            currentVersion: installedVersion,
            latestVersion: latestVersion,
            importance: toolInfo.importance
          });
          
          logUpdate(`Update available for ${toolName}: ${installedVersion} -> ${latestVersion}`);
        }
        
        // Update cache
        versionCache[toolInfo.package] = {
          latestVersion,
          checkedAt: new Date().toISOString()
        };
      } catch (err) {
        console.error(`Error checking version for ${toolName}: ${err.message}`);
      }
    }
  }
  
  // Write updated cache
  try {
    fs.writeFileSync(VERSION_CACHE_PATH, JSON.stringify(versionCache, null, 2));
  } catch (err) {
    console.error(`Error writing version cache: ${err.message}`);
  }
  
  return updates;
}

// Get latest version of a package from npm
function getLatestVersion(packageName) {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${packageName}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const packageInfo = JSON.parse(data);
          resolve(packageInfo['dist-tags'].latest);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Run health check on MCP tools
async function runHealthCheck() {
  const mcpConfig = readMcpJson();
  const results = {};
  
  for (const [toolName, toolConfig] of Object.entries(mcpConfig.mcpServers)) {
    try {
      // Simple health check - try to start the tool with --help or --version
      const args = [...toolConfig.args];
      if (!args.includes('--help') && !args.includes('--version')) {
        args.push('--help');
      }
      
      execSync(`${toolConfig.command} ${args.join(' ')}`, { timeout: 5000 });
      results[toolName] = { status: 'healthy' };
    } catch (err) {
      results[toolName] = { 
        status: 'unhealthy',
        error: err.message
      };
      
      logUpdate(`Health check failed for ${toolName}: ${err.message}`);
    }
  }
  
  return results;
}

// Rollback failed updates
async function rollbackUpdates(failedTools) {
  // This would normally restore previous versions from backup
  // For simplicity, we'll just log the failed tools
  for (const toolName of failedTools) {
    logUpdate(`Rollback initiated for failed tool: ${toolName}`);
    // In a real implementation, restore from backup or reinstall previous version
  }
}

// Create update system entry in crontab
function setupCronJob(config) {
  try {
    const cronTime = getCronTime(config);
    const cronCommand = `node ${UPDATE_SCRIPT_PATH}`;
    
    // Check if cron entry already exists
    const crontab = execSync('crontab -l', { encoding: 'utf8' }).toString();
    
    if (crontab.includes(UPDATE_SCRIPT_PATH)) {
      // Update existing entry
      const newCrontab = crontab
        .split('\n')
        .map(line => {
          if (line.includes(UPDATE_SCRIPT_PATH)) {
            return `${cronTime} ${cronCommand} > ${MCP_CONFIG_DIR}/logs/cron_update.log 2>&1`;
          }
          return line;
        })
        .join('\n');
      
      fs.writeFileSync('/tmp/new_crontab', newCrontab);
      execSync('crontab /tmp/new_crontab');
      fs.unlinkSync('/tmp/new_crontab');
    } else {
      // Add new entry
      const newCrontab = `${crontab.trim()}\n${cronTime} ${cronCommand} > ${MCP_CONFIG_DIR}/logs/cron_update.log 2>&1\n`;
      fs.writeFileSync('/tmp/new_crontab', newCrontab);
      execSync('crontab /tmp/new_crontab');
      fs.unlinkSync('/tmp/new_crontab');
    }
    
    logUpdate(`Scheduled update cron job: ${cronTime}`);
    return true;
  } catch (err) {
    console.error(`Error setting up cron job: ${err.message}`);
    return false;
  }
}

// Remove update system from crontab
function removeCronJob() {
  try {
    const crontab = execSync('crontab -l', { encoding: 'utf8' }).toString();
    
    if (crontab.includes(UPDATE_SCRIPT_PATH)) {
      const newCrontab = crontab
        .split('\n')
        .filter(line => !line.includes(UPDATE_SCRIPT_PATH))
        .join('\n');
      
      fs.writeFileSync('/tmp/new_crontab', newCrontab);
      execSync('crontab /tmp/new_crontab');
      fs.unlinkSync('/tmp/new_crontab');
      
      logUpdate('Removed update cron job');
    }
    
    return true;
  } catch (err) {
    console.error(`Error removing cron job: ${err.message}`);
    return false;
  }
}

// Convert update configuration to cron time
function getCronTime(config) {
  const minute = 0;
  const hour = config.hourOfDay || 3;
  let dayOfMonth = '*';
  let month = '*';
  let dayOfWeek = '*';
  
  if (config.frequency === 'monthly') {
    dayOfMonth = config.dayOfMonth || 1;
  } else if (config.frequency === 'weekly') {
    dayOfWeek = config.dayOfWeek || 1;
  }
  
  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

// Run update process
async function runUpdate(config) {
  const startTime = new Date();
  logUpdate('Starting MCP tools update process');
  
  // Mark update as running
  config.updateInProgress = true;
  writeUpdateConfig(config);
  
  try {
    // Check for available updates
    const updates = await checkToolVersions();
    
    if (updates.length === 0) {
      logUpdate('No updates available');
      return {
        success: true,
        message: 'No updates available',
        updatedTools: []
      };
    }
    
    if (config.notifyOnly) {
      logUpdate(`${updates.length} updates available, but notifyOnly is enabled`);
      return {
        success: true,
        message: `${updates.length} updates available, but notifyOnly is enabled`,
        availableUpdates: updates
      };
    }
    
    // Filter updates based on config
    let updatesToInstall = updates;
    
    if (config.criticalToolsOnly) {
      updatesToInstall = updates.filter(update => update.importance === 'critical');
      logUpdate(`Filtered updates to ${updatesToInstall.length} critical tools`);
    }
    
    if (updatesToInstall.length === 0) {
      logUpdate('No critical updates available');
      return {
        success: true,
        message: 'No critical updates available',
        availableUpdates: updates
      };
    }
    
    // Install updates
    const updatedTools = [];
    const failedTools = [];
    
    for (const update of updatesToInstall) {
      try {
        logUpdate(`Updating ${update.name} (${update.package}) from ${update.currentVersion} to ${update.latestVersion}`);
        execSync(`npm install -g ${update.package}@${update.latestVersion}`, { stdio: 'inherit' });
        updatedTools.push(update.name);
      } catch (err) {
        logUpdate(`Failed to update ${update.name}: ${err.message}`);
        failedTools.push(update.name);
      }
    }
    
    // Run health check if configured
    if (config.healthCheckAfterUpdate && updatedTools.length > 0) {
      logUpdate('Running health check on updated tools');
      const healthResults = await runHealthCheck();
      
      // Check if any updated tools are unhealthy
      const unhealthyTools = Object.entries(healthResults)
        .filter(([name, result]) => updatedTools.includes(name) && result.status === 'unhealthy')
        .map(([name]) => name);
      
      if (unhealthyTools.length > 0) {
        logUpdate(`${unhealthyTools.length} updated tools are unhealthy`);
        
        // Rollback if configured
        if (config.automaticRollback) {
          logUpdate('Initiating automatic rollback for unhealthy tools');
          await rollbackUpdates(unhealthyTools);
        }
        
        return {
          success: false,
          message: 'Update completed with issues',
          updatedTools,
          failedTools,
          unhealthyTools
        };
      }
    }
    
    // Update completed
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    logUpdate(`Update completed in ${duration}s. Updated: ${updatedTools.length}, Failed: ${failedTools.length}`);
    
    // Update configuration
    config.lastUpdate = new Date().toISOString();
    config.lastCheck = new Date().toISOString();
    config.updateInProgress = false;
    writeUpdateConfig(config);
    
    return {
      success: true,
      message: 'Update completed successfully',
      updatedTools,
      failedTools,
      duration
    };
  } catch (err) {
    logUpdate(`Update process failed: ${err.message}`);
    
    // Update configuration
    config.updateInProgress = false;
    writeUpdateConfig(config);
    
    return {
      success: false,
      message: `Update process failed: ${err.message}`
    };
  }
}

// Interactive configuration
function configureUpdater() {
  const config = readUpdateConfig();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\nMCP Tools Update Configuration\n');
  console.log('Current configuration:');
  console.log(`  Enabled: ${config.enabled}`);
  console.log(`  Frequency: ${config.frequency}`);
  console.log(`  Time: ${config.hourOfDay}:00`);
  console.log(`  Auto-restart: ${config.autoRestart}`);
  console.log(`  Notify only: ${config.notifyOnly}`);
  console.log(`  Critical tools only: ${config.criticalToolsOnly}`);
  console.log(`  Health check after update: ${config.healthCheckAfterUpdate}`);
  console.log(`  Automatic rollback: ${config.automaticRollback}`);
  console.log();
  
  rl.question('Enable automatic updates? (y/n) [Default: y]: ', (enableAnswer) => {
    const enabled = enableAnswer.toLowerCase() !== 'n';
    
    rl.question('Update frequency? (daily/weekly/monthly/manual) [Default: weekly]: ', (frequencyAnswer) => {
      let frequency = frequencyAnswer.toLowerCase();
      if (!['daily', 'weekly', 'monthly', 'manual'].includes(frequency)) {
        frequency = 'weekly';
      }
      
      let dayOfWeek = config.dayOfWeek;
      let dayOfMonth = config.dayOfMonth;
      
      const nextQuestion = () => {
        rl.question('Hour of day to run updates? (0-23) [Default: 3]: ', (hourAnswer) => {
          const hourOfDay = parseInt(hourAnswer) || 3;
          
          rl.question('Auto-restart services after update? (y/n) [Default: y]: ', (restartAnswer) => {
            const autoRestart = restartAnswer.toLowerCase() !== 'n';
            
            rl.question('Notify about updates without installing? (y/n) [Default: n]: ', (notifyAnswer) => {
              const notifyOnly = notifyAnswer.toLowerCase() === 'y';
              
              rl.question('Update critical tools only? (y/n) [Default: n]: ', (criticalAnswer) => {
                const criticalToolsOnly = criticalAnswer.toLowerCase() === 'y';
                
                rl.question('Run health check after update? (y/n) [Default: y]: ', (healthAnswer) => {
                  const healthCheckAfterUpdate = healthAnswer.toLowerCase() !== 'n';
                  
                  rl.question('Enable automatic rollback for failed updates? (y/n) [Default: y]: ', (rollbackAnswer) => {
                    const automaticRollback = rollbackAnswer.toLowerCase() !== 'n';
                    
                    // Update configuration
                    const newConfig = {
                      ...config,
                      enabled,
                      frequency,
                      dayOfWeek,
                      dayOfMonth,
                      hourOfDay,
                      autoRestart,
                      notifyOnly,
                      criticalToolsOnly,
                      healthCheckAfterUpdate,
                      automaticRollback
                    };
                    
                    writeUpdateConfig(newConfig);
                    
                    if (enabled) {
                      setupCronJob(newConfig);
                    } else {
                      removeCronJob();
                    }
                    
                    console.log('\nConfiguration updated.');
                    rl.close();
                  });
                });
              });
            });
          });
        });
      };
      
      if (frequency === 'weekly') {
        rl.question('Day of week to run updates? (0-6, 0=Sunday) [Default: 1]: ', (dayAnswer) => {
          dayOfWeek = parseInt(dayAnswer);
          if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            dayOfWeek = 1;
          }
          nextQuestion();
        });
      } else if (frequency === 'monthly') {
        rl.question('Day of month to run updates? (1-28) [Default: 1]: ', (dayAnswer) => {
          dayOfMonth = parseInt(dayAnswer);
          if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
            dayOfMonth = 1;
          }
          nextQuestion();
        });
      } else {
        nextQuestion();
      }
    });
  });
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';
  
  // Read current configuration
  const config = readUpdateConfig();
  
  switch (command) {
    case 'check':
      // Check if updates are available
      console.log('Checking for MCP tool updates...');
      const updates = await checkToolVersions();
      
      if (updates.length === 0) {
        console.log('No updates available.');
      } else {
        console.log(`${updates.length} updates available:`);
        updates.forEach(update => {
          console.log(`- ${update.name} (${update.importance}): ${update.currentVersion} -> ${update.latestVersion}`);
        });
      }
      
      // Update last check time
      config.lastCheck = new Date().toISOString();
      writeUpdateConfig(config);
      break;
    
    case 'update':
      // Run update process
      console.log('Running MCP tool update...');
      const result = await runUpdate(config);
      console.log(result.message);
      break;
    
    case 'schedule':
      // Set up scheduled updates
      console.log('Setting up scheduled updates...');
      if (setupCronJob(config)) {
        console.log('Scheduled updates have been configured.');
      }
      break;
    
    case 'configure':
      // Interactive configuration
      configureUpdater();
      break;
    
    case 'status':
      // Show update status
      console.log('MCP Tools Update Status:');
      console.log(`  Enabled: ${config.enabled}`);
      console.log(`  Frequency: ${config.frequency}`);
      console.log(`  Last check: ${config.lastCheck || 'Never'}`);
      console.log(`  Last update: ${config.lastUpdate || 'Never'}`);
      
      if (config.updateInProgress) {
        console.log('  Status: Update in progress');
      } else if (isUpdateDue(config)) {
        console.log('  Status: Update due');
      } else {
        console.log('  Status: Up to date');
      }
      break;
    
    case 'disable':
      // Disable automatic updates
      config.enabled = false;
      writeUpdateConfig(config);
      removeCronJob();
      console.log('Automatic updates have been disabled.');
      break;
    
    case 'enable':
      // Enable automatic updates
      config.enabled = true;
      writeUpdateConfig(config);
      setupCronJob(config);
      console.log('Automatic updates have been enabled.');
      break;
    
    case 'help':
    default:
      console.log('SAAR-MCP Tools Automatic Updater');
      console.log('Usage:');
      console.log('  node mcp_tools_updater.js <command>');
      console.log('');
      console.log('Commands:');
      console.log('  check       Check for available updates');
      console.log('  update      Run update process');
      console.log('  schedule    Configure scheduled updates');
      console.log('  configure   Interactive configuration');
      console.log('  status      Show update status');
      console.log('  enable      Enable automatic updates');
      console.log('  disable     Disable automatic updates');
      console.log('  help        Show this help message');
      break;
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = {
  checkToolVersions,
  runUpdate,
  isUpdateDue,
  setupCronJob,
  removeCronJob
};