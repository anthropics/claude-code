#!/usr/bin/env node

/**
 * Setup cron jobs for Claude Neural Framework backups
 * 
 * Configures cron jobs based on backup_config.json
 * 
 * Usage:
 *   node setup_cron.js [options]
 * 
 * Options:
 *   --install         Install cron jobs
 *   --uninstall       Remove cron jobs
 *   --list            List current cron jobs
 *   --dry-run         Don't make any changes, just show what would be done
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { program } = require('commander');

// Import the logger from the core framework
const logger = require('../../core/logging/logger')('cron-setup');

// CLI options
program
  .option('--install', 'Install cron jobs')
  .option('--uninstall', 'Remove cron jobs')
  .option('--list', 'List current cron jobs')
  .option('--dry-run', 'Don\'t make any changes, just show what would be done')
  .parse(process.argv);

const options = program.opts();

// Validate options
if (!options.install && !options.uninstall && !options.list) {
  console.error('Error: Must specify one of --install, --uninstall, or --list');
  program.help();
  process.exit(1);
}

// Read configuration
let config;
try {
  const configPath = path.join(__dirname, '../../core/config/backup_config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('Error loading backup configuration:', error.message);
  process.exit(1);
}

// Get absolute path to backup script
const backupScriptPath = path.resolve(__dirname, 'backup.js');

// Generate cron job entries
const generateCronEntries = () => {
  const entries = [];
  
  // Process each data category
  for (const [category, categoryConfig] of Object.entries(config.dataCategories)) {
    // Full backup schedule
    if (categoryConfig.fullBackupSchedule) {
      entries.push({
        schedule: categoryConfig.fullBackupSchedule,
        command: `${backupScriptPath} --type=full --category=${category}`,
        description: `Full backup of ${category} data`
      });
    }
    
    // Incremental backup schedule
    if (categoryConfig.incrementalBackupSchedule) {
      entries.push({
        schedule: categoryConfig.incrementalBackupSchedule,
        command: `${backupScriptPath} --type=incremental --category=${category}`,
        description: `Incremental backup of ${category} data`
      });
    }
  }
  
  // Add verify job to run weekly
  entries.push({
    schedule: '0 0 * * 0',
    command: `${path.resolve(__dirname, 'verify.js')} --latest --report=/var/log/claude-neural-framework/verify-\$(date +\\%Y\\%m\\%d).json`,
    description: 'Weekly backup verification'
  });
  
  return entries;
};

// Format cron entry for crontab
const formatCronEntry = (entry) => {
  return `${entry.schedule} ${process.env.USER} ${entry.command} >> /var/log/claude-neural-framework/backup.log 2>&1 # ${entry.description}`;
};

// Install cron jobs
const installCronJobs = () => {
  logger.info('Installing backup cron jobs...');
  
  const entries = generateCronEntries();
  
  // Create temp file with current crontab
  try {
    execSync('crontab -l > /tmp/current-crontab 2>/dev/null || touch /tmp/current-crontab');
    
    // Read current crontab
    let currentCrontab = fs.readFileSync('/tmp/current-crontab', 'utf8');
    
    // Remove any existing Claude Neural Framework backup jobs
    currentCrontab = currentCrontab
      .split('\n')
      .filter(line => !line.includes('# Claude Neural Framework backup'))
      .join('\n');
    
    // Add header comment
    currentCrontab += '\n\n# Claude Neural Framework backup jobs - Installed by setup_cron.js\n';
    
    // Add new entries
    for (const entry of entries) {
      currentCrontab += `${entry.schedule} ${entry.command} >> /var/log/claude-neural-framework/backup.log 2>&1 # ${entry.description}\n`;
    }
    
    // Write updated crontab to temp file
    fs.writeFileSync('/tmp/updated-crontab', currentCrontab);
    
    // Install new crontab
    if (!options.dryRun) {
      execSync('crontab /tmp/updated-crontab');
      logger.info('Cron jobs installed successfully');
    } else {
      logger.info('DRY RUN - Cron jobs would be installed as follows:');
      console.log(currentCrontab);
    }
    
    // Clean up temp files
    execSync('rm -f /tmp/current-crontab /tmp/updated-crontab');
    
  } catch (error) {
    logger.error(`Failed to install cron jobs: ${error.message}`);
    process.exit(1);
  }
};

// Remove cron jobs
const uninstallCronJobs = () => {
  logger.info('Removing backup cron jobs...');
  
  try {
    // Create temp file with current crontab
    execSync('crontab -l > /tmp/current-crontab 2>/dev/null || touch /tmp/current-crontab');
    
    // Read current crontab
    let currentCrontab = fs.readFileSync('/tmp/current-crontab', 'utf8');
    
    // Remove any existing Claude Neural Framework backup jobs
    const updatedCrontab = currentCrontab
      .split('\n')
      .filter(line => !line.includes('# Claude Neural Framework backup'))
      .join('\n');
    
    // Write updated crontab to temp file
    fs.writeFileSync('/tmp/updated-crontab', updatedCrontab);
    
    // Install new crontab
    if (!options.dryRun) {
      execSync('crontab /tmp/updated-crontab');
      logger.info('Cron jobs removed successfully');
    } else {
      logger.info('DRY RUN - Cron jobs would be removed');
    }
    
    // Clean up temp files
    execSync('rm -f /tmp/current-crontab /tmp/updated-crontab');
    
  } catch (error) {
    logger.error(`Failed to remove cron jobs: ${error.message}`);
    process.exit(1);
  }
};

// List cron jobs
const listCronJobs = () => {
  logger.info('Listing backup cron jobs...');
  
  try {
    // Get current crontab
    const crontab = execSync('crontab -l 2>/dev/null || echo "No crontab for $(whoami)"').toString();
    
    // Filter Claude Neural Framework backup jobs
    const backupJobs = crontab
      .split('\n')
      .filter(line => line.includes('# Claude Neural Framework backup') || line.includes(backupScriptPath));
    
    if (backupJobs.length === 0) {
      console.log('No Claude Neural Framework backup jobs found');
    } else {
      console.log('Claude Neural Framework backup jobs:');
      backupJobs.forEach(job => console.log(job));
    }
    
  } catch (error) {
    logger.error(`Failed to list cron jobs: ${error.message}`);
    process.exit(1);
  }
};

// Execute requested action
if (options.install) {
  installCronJobs();
} else if (options.uninstall) {
  uninstallCronJobs();
} else if (options.list) {
  listCronJobs();
}