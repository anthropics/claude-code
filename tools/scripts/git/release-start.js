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
    
    // Commit the version update
    execSync('git add package.json');
    execSync(`git commit -m "chore: bump version to ${version}"`);
  } else {
    console.log('No package.json found, skipping version update');
  }
  
  // Update CHANGELOG.md if it exists
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    console.log('Preparing CHANGELOG.md for new version...');
    
    const today = new Date().toISOString().split('T')[0];
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    
    // Create new version entry at the top of the changelog
    const newVersionEntry = `# [${version}] - ${today}\n\n## Added\n\n## Changed\n\n## Fixed\n\n`;
    
    // Find the position after the header
    const headerEndPos = changelogContent.indexOf('# [');
    if (headerEndPos !== -1) {
      const updatedChangelog = 
        changelogContent.substring(0, headerEndPos) + 
        newVersionEntry + 
        changelogContent.substring(headerEndPos);
      
      fs.writeFileSync(changelogPath, updatedChangelog);
      
      console.log('Committing CHANGELOG.md updates...');
      execSync('git add CHANGELOG.md');
      execSync(`git commit -m "docs: update changelog for ${version}"`);
    } else {
      console.log('Could not find proper position in CHANGELOG.md, please update manually');
    }
  } else {
    console.log('No CHANGELOG.md found, skipping changelog update');
  }
  
  console.log(`\nRelease branch ${releaseBranch} created successfully!`);
  console.log('\nNext steps:');
  console.log('1. Update CHANGELOG.md with all changes in this release');
  console.log('2. Make any final adjustments for the release');
  console.log('3. When ready, run: node release-finish.js');
  
} catch (error) {
  console.error('Error creating release branch:', error.message);
  process.exit(1);
}