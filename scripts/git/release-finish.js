#!/usr/bin/env node

/**
 * Release branch completion script for Claude Neural Framework
 * 
 * Usage:
 *   node release-finish.js
 * 
 * Example:
 *   node release-finish.js
 *   # Merges current release branch to main and develop, then creates a tag
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
  
  if (!currentBranch.startsWith('release/')) {
    console.error(`Error: Current branch (${currentBranch}) is not a release branch`);
    console.log('Release branches must start with "release/"');
    process.exit(1);
  }

  // Extract version from branch name
  const version = currentBranch.replace('release/v', '');
  
  // Check for uncommitted changes
  const status = execSync('git status --porcelain').toString();
  if (status) {
    console.error('Error: You have uncommitted changes');
    console.log('Please commit or stash your changes before finishing the release');
    process.exit(1);
  }

  rl.question(`Are you sure you want to finish release ${version}? (y/n): `, (answer) => {
    if (answer.toLowerCase() !== 'y') {
      console.log('Release finish cancelled');
      rl.close();
      return;
    }
    
    console.log('\nStarting release completion process...');
    
    // Push release branch to origin
    console.log('Pushing release branch to origin...');
    execSync(`git push origin ${currentBranch}`);
    
    // Merge to main
    console.log('\nMerging to main branch...');
    execSync('git checkout main');
    execSync('git pull origin main');
    execSync(`git merge --no-ff ${currentBranch} -m "chore: merge release ${version} to main"`);
    
    // Create release tag
    const tagName = `v${version}`;
    console.log(`\nCreating release tag: ${tagName}`);
    execSync(`git tag -a ${tagName} -m "Release ${version}"`);
    
    // Merge back to develop
    console.log('\nMerging to develop branch...');
    execSync('git checkout develop');
    execSync('git pull origin develop');
    execSync(`git merge --no-ff ${currentBranch} -m "chore: merge release ${version} to develop"`);
    
    // Push changes to remote
    console.log('\nPushing main, develop, and tags to origin...');
    execSync('git push origin main');
    execSync('git push origin develop');
    execSync('git push origin --tags');
    
    // Create GitHub release if gh CLI is available
    try {
      console.log('\nCreating GitHub release...');
      execSync('gh --version', { stdio: 'ignore' });
      
      // Extract changelog content for this version
      let changelog = '';
      try {
        const fullChangelog = execSync('cat CHANGELOG.md').toString();
        const versionHeader = `# [${version}]`;
        const nextVersionHeader = '# [';
        
        const versionStart = fullChangelog.indexOf(versionHeader);
        if (versionStart !== -1) {
          const nextVersionStart = fullChangelog.indexOf(nextVersionHeader, versionStart + versionHeader.length);
          
          if (nextVersionStart !== -1) {
            changelog = fullChangelog.substring(versionStart, nextVersionStart).trim();
          } else {
            changelog = fullChangelog.substring(versionStart).trim();
          }
        }
      } catch (error) {
        console.log('Could not extract changelog, using default release notes');
        changelog = `Release ${version}`;
      }
      
      // Create a temporary file for release notes
      const fs = require('fs');
      const releaseNotesPath = `/tmp/release-notes-${version}.md`;
      fs.writeFileSync(releaseNotesPath, changelog);
      
      // Create GitHub release
      execSync(`gh release create ${tagName} --title "Release ${version}" --notes-file ${releaseNotesPath}`);
      
      // Clean up temp file
      fs.unlinkSync(releaseNotesPath);
      
    } catch (ghError) {
      console.log('GitHub CLI not available or error creating release');
      console.log('Please create the GitHub release manually');
    }
    
    // Clean up release branch
    console.log('\nCleaning up...');
    console.log(`Deleting local release branch: ${currentBranch}`);
    execSync(`git branch -d ${currentBranch}`);
    
    rl.question('Delete remote release branch? (y/n): ', (deleteRemote) => {
      if (deleteRemote.toLowerCase() === 'y') {
        console.log('Deleting remote release branch...');
        execSync(`git push origin --delete ${currentBranch}`);
      }
      
      console.log(`\n🎉 Release ${version} completed successfully!`);
      console.log(`Tag ${tagName} has been created and pushed`);
      console.log('Changes have been merged to main and develop branches');
      
      rl.close();
    });
  });
  
} catch (error) {
  console.error('Error finishing release:', error.message);
  if (rl) rl.close();
  process.exit(1);
}