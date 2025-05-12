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
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const releaseUtils = require('./utils/release-utils');

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
  
  // Run release checks
  console.log(`\nRunning pre-release checks for version ${version}...`);
  if (!releaseUtils.runReleaseChecks(version)) {
    console.error('\n⚠️ Pre-release checks failed. Fix issues before proceeding.');
    rl.question('Do you want to continue despite the warnings? (y/n): ', (answer) => {
      if (answer.toLowerCase() !== 'y') {
        console.log('Release finish cancelled');
        rl.close();
        process.exit(1);
      }
      continueRelease();
    });
  } else {
    continueRelease();
  }

  function continueRelease() {
    // Validate version consistency
    console.log('\nValidating version consistency...');
    if (!releaseUtils.validateVersionConsistency(version)) {
      console.error('\n⚠️ Version consistency check failed. Please fix inconsistencies before proceeding.');
      rl.question('Do you want to continue despite the inconsistencies? (y/n): ', (answer) => {
        if (answer.toLowerCase() !== 'y') {
          console.log('Release finish cancelled');
          rl.close();
          process.exit(1);
        }
        completeRelease();
      });
    } else {
      completeRelease();
    }
  }

  function completeRelease() {
    // Check for uncommitted changes
    const status = execSync('git status --porcelain').toString();
    if (status) {
      console.error('Error: You have uncommitted changes');
      console.log('Please commit or stash your changes before finishing the release');
      rl.close();
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
        
        // Check for custom release notes
        const customReleaseNotesPath = path.join(process.cwd(), `RELEASE_NOTES_v${version}.md`);
        let releaseNotesContent;
        
        if (fs.existsSync(customReleaseNotesPath)) {
          console.log(`Using custom release notes from ${customReleaseNotesPath}`);
          releaseNotesContent = fs.readFileSync(customReleaseNotesPath, 'utf8');
        } else {
          // Extract changelog content for this version
          console.log('Extracting release notes from CHANGELOG.md');
          try {
            const fullChangelog = fs.readFileSync('CHANGELOG.md', 'utf8');
            const versionHeader = `# [${version}]`;
            const nextVersionHeader = '# [';
            
            const versionStart = fullChangelog.indexOf(versionHeader);
            if (versionStart !== -1) {
              const nextVersionStart = fullChangelog.indexOf(nextVersionHeader, versionStart + versionHeader.length);
              
              if (nextVersionStart !== -1) {
                releaseNotesContent = fullChangelog.substring(versionStart, nextVersionStart).trim();
              } else {
                releaseNotesContent = fullChangelog.substring(versionStart).trim();
              }
            } else {
              releaseNotesContent = `Release ${version}`;
            }
          } catch (error) {
            console.log('Could not extract changelog, generating default release notes');
            releaseNotesContent = releaseUtils.generateReleaseNotesTemplate(version);
          }
        }
        
        // Create a temporary file for release notes
        const releaseNotesPath = `/tmp/release-notes-${version}.md`;
        fs.writeFileSync(releaseNotesPath, releaseNotesContent);
        
        // Create GitHub release
        execSync(`gh release create ${tagName} --title "Release ${version}" --notes-file ${releaseNotesPath}`);
        
        // Clean up temp file
        fs.unlinkSync(releaseNotesPath);
        
        // Clean up custom release notes if they exist
        if (fs.existsSync(customReleaseNotesPath)) {
          console.log(`Cleaning up custom release notes: ${customReleaseNotesPath}`);
          fs.unlinkSync(customReleaseNotesPath);
        }
        
      } catch (ghError) {
        console.log('GitHub CLI not available or error creating release:');
        console.log(ghError.message);
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
        
        // Recommend next steps
        console.log('\nNext steps:');
        console.log('1. Verify the GitHub release at: https://github.com/username/claude-code/releases');
        console.log('2. Notify team members about the new release');
        console.log('3. Update documentation if necessary');
        console.log('4. Verify the deployed release in production environments');
        
        rl.close();
      });
    });
  }
} catch (error) {
  console.error('Error finishing release:', error.message);
  if (rl) rl.close();
  process.exit(1);
}