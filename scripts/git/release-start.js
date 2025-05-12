#!/usr/bin/env node

/**
 * Release branch creation script for Claude Neural Framework
 * 
 * Usage:
 *   node release-start.js <version>
 * 
 * Example:
 *   node release-start.js 1.2.0
 *   # Creates and checks out release/v1.2.0
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const semver = require('semver');
const releaseUtils = require('./utils/release-utils');

// Parse command line arguments
const version = process.argv[2];

if (!version) {
  console.error('Error: Version number is required');
  console.log('Usage: node release-start.js <version>');
  process.exit(1);
}

// Validate version is proper semver
if (!semver.valid(version)) {
  console.error(`Error: "${version}" is not a valid semantic version`);
  console.log('Please use a valid semver format (e.g., 1.2.0)');
  process.exit(1);
}

try {
  // Run pre-release checks
  console.log('Running initial release checks...');
  if (!releaseUtils.runReleaseChecks(version)) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\nWarnings were found. Do you want to continue anyway? (y/n): ', (answer) => {
      if (answer.toLowerCase() !== 'y') {
        console.log('Release start cancelled');
        rl.close();
        process.exit(1);
      }
      rl.close();
      startRelease();
    });
  } else {
    startRelease();
  }
  
  function startRelease() {
    // Ensure we're on develop branch first
    console.log('Checking current branch...');
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    
    if (currentBranch !== 'develop') {
      console.log('Switching to develop branch...');
      execSync('git checkout develop');
    }
    
    console.log('Pulling latest changes...');
    execSync('git pull origin develop');
    
    // Create release branch
    const releaseBranch = `release/v${version}`;
    console.log(`Creating release branch: ${releaseBranch}`);
    execSync(`git checkout -b ${releaseBranch}`);
    
    // Update version in package.json if it exists
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      console.log('Updating version in package.json...');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      packageJson.version = version;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      
      // Add to staging
      execSync('git add package.json');
    } else {
      console.log('No package.json found, skipping version update');
    }
    
    // Update VERSION.txt file
    if (releaseUtils.updateVersionTxt(version)) {
      execSync('git add VERSION.txt');
    }
    
    // Commit version updates
    execSync(`git commit -m "chore: bump version to ${version}"`);
    
    // Generate changelog content
    const changelogContent = releaseUtils.generateChangelog(version);
    
    // Update CHANGELOG.md if it exists
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
    if (fs.existsSync(changelogPath)) {
      console.log('Updating CHANGELOG.md for new version...');
      
      const existingChangelog = fs.readFileSync(changelogPath, 'utf8');
      
      // Find the position after the header (if it exists)
      const headerPos = existingChangelog.indexOf('# Changelog');
      if (headerPos !== -1) {
        // If there's a header, insert after it
        const headerEndPos = existingChangelog.indexOf('\n', headerPos) + 1;
        const updatedChangelog = 
          existingChangelog.substring(0, headerEndPos) + 
          '\n' + changelogContent + 
          existingChangelog.substring(headerEndPos);
        
        fs.writeFileSync(changelogPath, updatedChangelog);
      } else {
        // Otherwise just prepend the new content
        const updatedChangelog = 
          '# Changelog\n\n' + 
          changelogContent + 
          existingChangelog;
        
        fs.writeFileSync(changelogPath, updatedChangelog);
      }
      
      console.log('Committing CHANGELOG.md updates...');
      execSync('git add CHANGELOG.md');
      execSync(`git commit -m "docs: update changelog for ${version}"`);
    } else {
      console.log('Creating new CHANGELOG.md...');
      fs.writeFileSync(changelogPath, '# Changelog\n\n' + changelogContent);
      execSync('git add CHANGELOG.md');
      execSync(`git commit -m "docs: create changelog for ${version}"`);
    }
    
    // Validate version consistency
    console.log('\nValidating version consistency...');
    releaseUtils.validateVersionConsistency(version);
    
    // Create release notes template
    const releaseNotesPath = path.join(process.cwd(), `RELEASE_NOTES_v${version}.md`);
    console.log(`\nCreating release notes template at ${releaseNotesPath}...`);
    fs.writeFileSync(releaseNotesPath, releaseUtils.generateReleaseNotesTemplate(version));
    console.log('Remember to update the release notes template with relevant information.');
    
    console.log(`\nRelease branch ${releaseBranch} created successfully!`);
    console.log('\nNext steps:');
    console.log(`1. Complete the release notes in ${releaseNotesPath}`);
    console.log('2. Verify the CHANGELOG.md updates');
    console.log('3. Make any final adjustments for the release');
    console.log('4. Run tests to verify the release is stable');
    console.log('5. When ready, run: node release-finish.js');
  }
} catch (error) {
  console.error('Error creating release branch:', error.message);
  process.exit(1);
}