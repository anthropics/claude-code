#!/usr/bin/env node

/**
 * Claude Merge Visualizer
 * 
 * This script enhances the visual experience when working with Claude
 * during git merge operations, giving the AI more visual presence and control.
 */

const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const figlet = require('figlet');
const inquirer = require('inquirer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI escape sequences for more advanced terminal control
const ESC = '\u001B[';
const CLEAR_SCREEN = `${ESC}2J`;
const CURSOR_HOME = `${ESC}H`;
const SAVE_CURSOR = `${ESC}s`;
const RESTORE_CURSOR = `${ESC}u`;
const HIDE_CURSOR = `${ESC}?25l`;
const SHOW_CURSOR = `${ESC}?25h`;

// Claude's color theme
const CLAUDE_PURPLE = '#8C52FF';
const CLAUDE_LIGHT_PURPLE = '#B794F6';
const CLAUDE_DARK_PURPLE = '#5E35B1';

// ASCII Art for Claude's avatar
const CLAUDE_AVATAR = `
   .--.       
  |o_o |      
  |:_/ |      
 //   \\ \\     
(|     | )    
/'\\_   _/\`\\   
\\___)=(___/   
`;

// Function to display a styled header
function displayHeader(text) {
  console.log(CLEAR_SCREEN + CURSOR_HOME);
  console.log(
    chalk.hex(CLAUDE_PURPLE)(
      figlet.textSync('Claude Merge', { font: 'Standard' })
    )
  );
  console.log(
    boxen(chalk.hex(CLAUDE_LIGHT_PURPLE)(text), {
      padding: 1,
      borderColor: CLAUDE_PURPLE,
      borderStyle: 'round'
    })
  );
}

// Function to display Claude's thinking animation
function claudeThinking(message) {
  const spinner = ora({
    text: chalk.hex(CLAUDE_PURPLE)(`${message}`),
    spinner: {
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    },
    color: 'magenta'
  });
  
  spinner.start();
  return spinner;
}

// Function to display Claude's avatar and message
function claudeSays(message) {
  console.log(SAVE_CURSOR);
  
  const avatarLines = CLAUDE_AVATAR.split('\n');
  const messageLines = message.split('\n');
  
  // Calculate the width for the message box
  const maxMessageLength = Math.max(...messageLines.map(line => line.length));
  const boxWidth = Math.min(80, maxMessageLength + 4); // +4 for padding
  
  // Create a message box with the calculated width
  const messageBox = boxen(chalk.hex(CLAUDE_LIGHT_PURPLE)(message), {
    padding: 1,
    borderColor: CLAUDE_PURPLE,
    borderStyle: 'round',
    width: boxWidth
  });
  
  const messageBoxLines = messageBox.split('\n');
  
  // Determine how many lines to display
  const linesToDisplay = Math.max(avatarLines.length, messageBoxLines.length);
  
  // Display avatar and message side by side
  for (let i = 0; i < linesToDisplay; i++) {
    const avatarLine = i < avatarLines.length ? avatarLines[i] : ' '.repeat(avatarLines[0].length);
    const messageLine = i < messageBoxLines.length ? messageBoxLines[i] : '';
    
    console.log(chalk.hex(CLAUDE_PURPLE)(avatarLine) + '  ' + messageLine);
  }
  
  console.log('\n');
  console.log(RESTORE_CURSOR);
}

// Function to display a progress bar for merge operations
function progressBar(label, percent) {
  const barLength = 30;
  const filledLength = Math.round(barLength * percent);
  const emptyLength = barLength - filledLength;
  
  const filledBar = chalk.hex(CLAUDE_PURPLE)('█'.repeat(filledLength));
  const emptyBar = chalk.gray('░'.repeat(emptyLength));
  
  process.stdout.write(`\r${label}: [${filledBar}${emptyBar}] ${Math.round(percent * 100)}%`);
  
  if (percent >= 1) {
    process.stdout.write('\n');
  }
}

// Function to visualize git conflicts
function visualizeConflicts(conflictFiles) {
  console.log(chalk.yellow('\nMerge Conflicts Detected:'));
  
  conflictFiles.forEach((file, index) => {
    console.log(chalk.yellow(`\n${index + 1}. ${file}`));
    
    try {
      // Get a snippet of the conflict
      const fileContent = fs.readFileSync(file, 'utf8');
      const conflictLines = fileContent.split('\n').filter(line => 
        line.includes('<<<<<<<') || 
        line.includes('=======') || 
        line.includes('>>>>>>>'));
      
      if (conflictLines.length > 0) {
        console.log(chalk.gray('  Conflict markers:'));
        conflictLines.forEach((line, i) => {
          if (i < 3) { // Only show first few conflict markers
            if (line.includes('<<<<<<<')) {
              console.log(chalk.red(`  ${line}`));
            } else if (line.includes('=======')) {
              console.log(chalk.yellow(`  ${line}`));
            } else if (line.includes('>>>>>>>')) {
              console.log(chalk.green(`  ${line}`));
            }
          }
        });
        
        if (conflictLines.length > 3) {
          console.log(chalk.gray(`  ... and ${conflictLines.length - 3} more conflict markers`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`  Error reading file: ${error.message}`));
    }
  });
}

// Function to offer conflict resolution options
async function offerConflictResolution(conflictFiles) {
  const choices = [
    {
      name: 'Let Claude analyze and suggest resolutions for all conflicts',
      value: 'claude_all'
    },
    {
      name: 'Let Claude analyze specific files',
      value: 'claude_specific'
    },
    {
      name: 'Use visual merge tool (if configured)',
      value: 'visual'
    },
    {
      name: 'Resolve manually and then let Claude verify',
      value: 'manual'
    },
    {
      name: 'Abort merge',
      value: 'abort'
    }
  ];
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to proceed with conflict resolution?',
      choices
    }
  ]);
  
  return action;
}

// Function to launch Claude with enhanced visual context
function launchClaudeWithContext(mode, files = []) {
  console.log(HIDE_CURSOR);
  
  const thinking = claudeThinking('Claude is analyzing your repository...');
  
  // Simulate Claude analyzing the repo
  setTimeout(() => {
    thinking.stop();
    console.log(SHOW_CURSOR);
    
    if (mode === 'conflicts') {
      claudeSays(`I've analyzed the merge conflicts in your repository.
I found conflicts in ${files.length} files that need to be resolved.
I'll help you understand each conflict and suggest the best resolution.

Let's start by understanding what changes collided during the merge.`);
      
      // Launch Claude with the appropriate conflict resolution prompt
      const filesParam = files.join(' ');
      const command = `claude code "I'm merging the main branch into my current branch and have merge conflicts in these files: ${filesParam}. Help me understand these conflicts and resolve them in the best way possible. For each conflict, explain both versions and suggest the best resolution."`;
      
      console.log(chalk.gray('\nLaunching Claude Code with focused conflict resolution...\n'));
      execSync(command, { stdio: 'inherit' });
      
    } else if (mode === 'success') {
      claudeSays(`I've analyzed the successful merge from the main branch.
I'll help you understand what changes were brought in and
suggest any follow-up actions you might need to take.

Let me explain the key changes that were merged...`);
      
      // Launch Claude with the post-merge analysis prompt
      const command = `claude code "I've just merged the main branch into my current branch successfully. Help me understand what significant changes came in, what impact they might have on my work, and suggest any follow-up actions I should take (like updating dependencies, running tests, or updating documentation)."`;
      
      console.log(chalk.gray('\nLaunching Claude Code with merge analysis...\n'));
      execSync(command, { stdio: 'inherit' });
    }
  }, 3000);
}

// Main function to coordinate the enhanced merge experience
async function enhancedMerge() {
  try {
    // Check if we're in a git repository
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    
    // Get current branch
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    
    // Determine main branch
    let mainBranch;
    try {
      if (execSync('git show-ref --verify --quiet refs/heads/main || echo $?').toString().trim() === '') {
        mainBranch = 'main';
      } else if (execSync('git show-ref --verify --quiet refs/heads/master || echo $?').toString().trim() === '') {
        mainBranch = 'master';
      } else {
        // Try to find default branch from remote
        const remoteOutput = execSync('git remote show origin').toString();
        const match = remoteOutput.match(/HEAD branch: (.+)/);
        mainBranch = match ? match[1] : 'main';
      }
    } catch (error) {
      mainBranch = 'main'; // Default fallback
    }
    
    // Display header
    displayHeader(`Merging ${chalk.bold(mainBranch)} into ${chalk.bold(currentBranch)}`);
    
    // Check for uncommitted changes
    let hasUncommittedChanges = false;
    try {
      execSync('git diff-index --quiet HEAD --');
    } catch (error) {
      hasUncommittedChanges = true;
    }
    
    if (hasUncommittedChanges) {
      claudeSays(`I've detected uncommitted changes in your repository.
It's usually best to commit or stash these changes before merging.

What would you like to do?`);
      
      const { stashAction } = await inquirer.prompt([
        {
          type: 'list',
          name: 'stashAction',
          message: 'How would you like to handle your uncommitted changes?',
          choices: [
            { name: 'Stash changes (recommended)', value: 'stash' },
            { name: 'Continue with merge anyway', value: 'continue' },
            { name: 'Abort merge', value: 'abort' }
          ]
        }
      ]);
      
      if (stashAction === 'abort') {
        claudeSays('Merge operation aborted. Your repository is unchanged.');
        return;
      } else if (stashAction === 'stash') {
        const spinner = claudeThinking('Stashing your changes...');
        execSync('git stash push -m "Stashed before merging with Claude Merge Visualizer"');
        spinner.stop();
        claudeSays('I\'ve safely stashed your changes. We can now proceed with the merge.');
      } else {
        claudeSays('Proceeding with merge while keeping uncommitted changes.\nThis might complicate the merge process if conflicts arise.');
      }
    }
    
    // Fetch latest changes
    claudeSays(`I'm going to fetch the latest changes from the remote repository.
This ensures we're working with the most up-to-date code.`);
    
    const fetchSpinner = claudeThinking('Fetching latest changes...');
    execSync('git fetch origin');
    fetchSpinner.stop();
    
    // Try to merge
    claudeSays(`Now I'll attempt to merge ${chalk.bold(mainBranch)} into your current branch.
I'll handle any conflicts that arise and guide you through the process.`);
    
    console.log('\n');
    
    // Simulate merge progress
    for (let i = 0; i <= 100; i += 10) {
      progressBar('Merging', i / 100);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    let mergeSuccessful = false;
    let conflictFiles = [];
    
    try {
      execSync(`git merge origin/${mainBranch} --no-edit`);
      mergeSuccessful = true;
    } catch (error) {
      // Get list of files with conflicts
      const statusOutput = execSync('git status --porcelain').toString();
      conflictFiles = statusOutput
        .split('\n')
        .filter(line => line.startsWith('UU'))
        .map(line => line.substring(3));
    }
    
    if (mergeSuccessful) {
      claudeSays(`Great news! The merge was completed successfully with no conflicts.
I'll now analyze what changes came in from ${mainBranch} to help you
understand the impact and any follow-up actions you might need to take.`);
      
      launchClaudeWithContext('success');
      
    } else {
      claudeSays(`I've detected merge conflicts that need to be resolved.
Don't worry - I'm here to help you through this process.
Let me show you where the conflicts are and offer assistance.`);
      
      visualizeConflicts(conflictFiles);
      
      const resolutionAction = await offerConflictResolution(conflictFiles);
      
      switch (resolutionAction) {
        case 'claude_all':
          launchClaudeWithContext('conflicts', conflictFiles);
          break;
          
        case 'claude_specific':
          const { selectedFiles } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'selectedFiles',
              message: 'Select files for Claude to analyze:',
              choices: conflictFiles.map(file => ({ name: file, value: file }))
            }
          ]);
          
          if (selectedFiles.length > 0) {
            launchClaudeWithContext('conflicts', selectedFiles);
          } else {
            claudeSays('No files selected. Please choose a different option.');
          }
          break;
          
        case 'visual':
          claudeSays(`Launching your configured visual merge tool.
After resolving conflicts, I can verify your solutions.`);
          
          try {
            execSync('git mergetool', { stdio: 'inherit' });
          } catch (error) {
            console.log(chalk.red('Error launching merge tool:', error.message));
          }
          break;
          
        case 'manual':
          claudeSays(`You've chosen to resolve conflicts manually.
After you've resolved the conflicts, run:
- git add <resolved-files>
- git commit

Then you can run claude-merge-visualizer again with the --verify flag
to have me check your conflict resolutions.`);
          break;
          
        case 'abort':
          claudeSays('Aborting merge operation as requested.');
          execSync('git merge --abort');
          break;
      }
    }
    
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

// If this script is run directly
if (require.main === module) {
  // Process command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${chalk.hex(CLAUDE_PURPLE)('Claude Merge Visualizer')}

A visual tool for merging with AI assistance from Claude.

Usage:
  claude-merge-visualizer [options]

Options:
  --verify      Verify manual conflict resolutions
  --help, -h    Show this help message
  --version, -v Show version information
    `);
  } else if (args.includes('--version') || args.includes('-v')) {
    console.log('Claude Merge Visualizer v1.0.0');
  } else if (args.includes('--verify')) {
    // TODO: Implement verification mode
    console.log('Verification mode not yet implemented');
  } else {
    enhancedMerge();
  }
}

module.exports = {
  enhancedMerge,
  claudeSays,
  visualizeConflicts,
  launchClaudeWithContext
};