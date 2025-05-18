#!/usr/bin/env node

/**
 * Installer script for Claude Merge Visualizer extension
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Colors for terminal output
const COLORS = {
  GREEN: chalk.green,
  BLUE: chalk.blue,
  YELLOW: chalk.yellow,
  RED: chalk.red,
  PURPLE: chalk.hex('#8C52FF'),
};

console.log(COLORS.PURPLE(`
  ____  _                 _        __  __                        
 / ___|| | __ _ _   _  __| | ___  |  \/  | ___ _ __ __ _  ___    
| |   | |/ _\` | | | |/ _\` |/ _ \\ | |\\/| |/ _ \\ '__/ _\` |/ _ \\   
| |___| | (_| | |_| | (_| |  __/ | |  | |  __/ | | (_| |  __/   
 \\____|_|\\__,_|\\__,_|\\__,_|\\___| |_|  |_|\\___|_|  \\__, |\\___|   
                                                  |___/          
  __  __                  _    _ _                 _ _           
 |  \\/  | ___ _ __ __ _  | |  | (_)___ _   _  __ _| (_)_______ _ __ 
 | |\\/| |/ _ \\ '__/ _\` | | |  | | / __| | | |/ _\` | | |_  / _ \\ '__|
 | |  | |  __/ | | (_| | | |/\\| | \\__ \\ |_| | (_| | | |/ /  __/ |   
 |_|  |_|\\___/_|  \\__, | \\__/\\__/_|___/\\__,_|\\__,_|_|_/___\\___|_|   
                  |___/                                         
`));

console.log(COLORS.BLUE('Installing Claude Merge Visualizer Extension\n'));

// Get the extension directory
const extensionDir = path.resolve(__dirname);

try {
  // Install dependencies
  console.log(COLORS.BLUE('Installing dependencies...\n'));
  execSync('npm install --no-fund --no-audit', { 
    cwd: extensionDir,
    stdio: 'inherit'
  });

  // Make script executable
  const visualizerPath = path.join(extensionDir, 'claude-merge-visualizer.js');
  try {
    fs.chmodSync(visualizerPath, '755');
  } catch (error) {
    console.log(COLORS.YELLOW(`Warning: Could not make script executable: ${error.message}`));
    console.log(COLORS.YELLOW('You may need to run: chmod +x ' + visualizerPath));
  }

  // Update aliases.json - this uses the claude-code extension system
  console.log(COLORS.BLUE('\nRegistering commands with Claude Code...\n'));
  
  const claudeCodeDir = path.join(process.env.HOME || process.env.USERPROFILE, '.claude-code');
  const aliasesFile = path.join(claudeCodeDir, 'aliases.json');
  
  // Ensure the directory exists
  if (!fs.existsSync(claudeCodeDir)) {
    fs.mkdirSync(claudeCodeDir, { recursive: true });
  }
  
  // Read or create aliases.json
  let aliases = {};
  if (fs.existsSync(aliasesFile)) {
    try {
      aliases = JSON.parse(fs.readFileSync(aliasesFile, 'utf8'));
    } catch (error) {
      console.log(COLORS.YELLOW(`Warning: Could not parse aliases.json: ${error.message}`));
      console.log(COLORS.YELLOW('Creating a new aliases.json file.'));
    }
  }
  
  // Add the merge-visualizer command
  aliases['merge-visualizer'] = {
    description: 'Enhanced visual interface for merging with AI assistance',
    extension: 'merge-visualizer/claude-merge-visualizer.js'
  };
  
  // Save the updated aliases
  fs.writeFileSync(aliasesFile, JSON.stringify(aliases, null, 2));
  
  console.log(COLORS.GREEN('Successfully installed Claude Merge Visualizer!'));
  console.log(COLORS.BLUE('\nUsage:'));
  console.log(COLORS.GREEN('  claude merge-visualizer'));
  console.log('    This will launch the enhanced visual interface for merging with Claude.\n');
  
  console.log(COLORS.PURPLE('Thank you for installing Claude Merge Visualizer!'));

} catch (error) {
  console.error(COLORS.RED(`Error during installation: ${error.message}`));
  process.exit(1);
}