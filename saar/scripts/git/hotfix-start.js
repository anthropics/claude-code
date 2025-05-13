#!/usr/bin/env node

/**
 * Hotfix branch creation script for Claude Neural Framework
 * 
 * Usage:
 *   node hotfix-start.js <version> "Hotfix description"
 * 
 * Example:
 *   node hotfix-start.js 1.2.1 "Fix security vulnerability in API"
 *   # Creates and checks out hotfix/v1.2.1
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const semver = require('semver');

// Parse command line arguments
const version = process.argv[2];
const description = process.argv[3];

if (!version || !description) {
  console.error('Error: Version number and description are required');
  console.log('Usage: node hotfix-start.js <version> "Hotfix description"');
  process.exit(1);
}

// Validate version is proper semver
if (!semver.valid(version)) {
  console.error(`Error: "${version}" is not a valid semantic version`);
  console.log('Please use a valid semver format (e.g., 1.2.1)');
  process.exit(1);
}

try {
  // Ensure we're on main branch first
  console.log('Checking current branch...');
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  
  if (currentBranch !== 'main') {
    console.log('Switching to main branch...');
    execSync('git checkout main');
  }
  
  console.log('Pulling latest changes...');
  execSync('git pull origin main');
  
  // Create hotfix branch
  const hotfixBranch = `hotfix/v${version}`;
  console.log(`Creating hotfix branch: ${hotfixBranch}`);
  execSync(`git checkout -b ${hotfixBranch}`);
  
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
    console.log('Updating CHANGELOG.md for hotfix...');
    
    const today = new Date().toISOString().split('T')[0];
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    
    // Create new hotfix entry at the top of the changelog
    const newHotfixEntry = `# [${version}] - ${today}\n\n## Fixed\n\n- ${description}\n\n`;
    
    // Find the position after the header
    const headerEndPos = changelogContent.indexOf('# [');
    if (headerEndPos !== -1) {
      const updatedChangelog = 
        changelogContent.substring(0, headerEndPos) + 
        newHotfixEntry + 
        changelogContent.substring(headerEndPos);
      
      fs.writeFileSync(changelogPath, updatedChangelog);
      
      console.log('Committing CHANGELOG.md updates...');
      execSync('git add CHANGELOG.md');
      execSync(`git commit -m "docs: update changelog for hotfix ${version}"`);
    } else {
      console.log('Could not find proper position in CHANGELOG.md, please update manually');
    }
  } else {
    console.log('No CHANGELOG.md found, skipping changelog update');
  }
  
  console.log(`\nHotfix branch ${hotfixBranch} created successfully!`);
  console.log('\nNext steps:');
  console.log('1. Implement the hotfix');
  console.log('2. Test thoroughly');
  console.log('3. When ready, run: node hotfix-finish.js');
  
} catch (error) {
  console.error('Error creating hotfix branch:', error.message);
  process.exit(1);
}