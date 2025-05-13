#!/usr/bin/env node

/**
 * Feature branch completion script for Claude Neural Framework
 * 
 * Usage:
 *   node feature-finish.js
 * 
 * Example:
 *   node feature-finish.js
 *   # Merges current feature branch to develop
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

try {
  // Get current branch
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  
  if (!currentBranch.startsWith('feature/')) {
    console.error(`Error: Current branch (${currentBranch}) is not a feature branch`);
    console.log('Feature branches must start with "feature/"');
    process.exit(1);
  }

  // Check for uncommitted changes
  const status = execSync('git status --porcelain').toString();
  if (status) {
    console.error('Error: You have uncommitted changes');
    console.log('Please commit or stash your changes before finishing the feature');
    process.exit(1);
  }

  // Push feature branch to origin
  console.log('Pushing feature branch to origin...');
  execSync(`git push origin ${currentBranch}`);

  rl.question('Do you want to create a pull request? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      // Generate PR title from branch name
      const prTitle = currentBranch
        .replace('feature/', '')
        .replace(/^\d+-/, '')  // Remove issue number prefix if present
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      console.log(`\nCreating pull request for ${currentBranch} to develop`);
      console.log('PR Title:', prTitle);

      try {
        // Check if gh CLI is installed
        execSync('gh --version', { stdio: 'ignore' });
        
        // Use GitHub CLI to create PR if available
        const prCommand = `gh pr create --base develop --head ${currentBranch} --title "${prTitle}" --body "## Description\n\nPlease include a summary of the changes.\n\n## Related Issue\nResolves: #[issue-number]"`;
        
        console.log('\nExecuting GitHub CLI command:');
        console.log(prCommand);
        
        execSync(prCommand, { stdio: 'inherit' });
        
      } catch (ghError) {
        console.log('\nGitHub CLI not available or error creating PR');
        console.log('Please create a pull request manually on GitHub');
        console.log(`From: ${currentBranch}`);
        console.log('To: develop');
      }
    } else {
      console.log('\nPull request creation skipped');
      console.log('You can create the pull request manually on GitHub when ready');
    }

    console.log('\nFeature branch completion process finished!');
    rl.close();
  });
  
} catch (error) {
  console.error('Error finishing feature:', error.message);
  rl.close();
  process.exit(1);
}