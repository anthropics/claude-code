#!/usr/bin/env node

/**
 * Prepare Release Script
 * 
 * This script helps prepare a release by:
 * 1. Updating the CHANGELOG.md file with changes since the last version
 * 2. Ensuring all release tasks are completed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Get the new version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const newVersion = packageJson.version;

console.log(chalk.bold.green(`\n=== Preparing release for v${newVersion} ===\n`));

// Get the previous version from git tags
let previousTag;
try {
  previousTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
} catch (error) {
  previousTag = '';
}

// Generate changelog entries from git commits
function generateChangelog() {
  console.log(chalk.blue('Generating changelog entries...'));

  // Determine commit range
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
  console.log(`Getting commits from range: ${range}`);

  // Format commits by type using conventional commit format
  let features = '';
  let fixes = '';
  let docs = '';
  let chores = '';
  
  try {
    features = execSync(`git log ${range} --pretty=format:"- %s" --grep="^feat" --grep="^feature"`, { encoding: 'utf8' }).trim();
  } catch (error) {
    features = '';
  }
  
  try {
    fixes = execSync(`git log ${range} --pretty=format:"- %s" --grep="^fix" --grep="^bug"`, { encoding: 'utf8' }).trim();
  } catch (error) {
    fixes = '';
  }
  
  try {
    docs = execSync(`git log ${range} --pretty=format:"- %s" --grep="^docs"`, { encoding: 'utf8' }).trim();
  } catch (error) {
    docs = '';
  }
  
  try {
    chores = execSync(`git log ${range} --pretty=format:"- %s" --grep="^chore" --grep="^build" --grep="^ci"`, { encoding: 'utf8' }).trim();
  } catch (error) {
    chores = '';
  }
  
  // Prepare changelog content
  let changelog = `## [v${newVersion}] - ${new Date().toISOString().split('T')[0]}\n\n`;
  
  if (features) {
    changelog += `### Features\n\n${features}\n\n`;
  }
  
  if (fixes) {
    changelog += `### Bug Fixes\n\n${fixes}\n\n`;
  }
  
  if (docs) {
    changelog += `### Documentation\n\n${docs}\n\n`;
  }
  
  if (chores) {
    changelog += `### Chores\n\n${chores}\n\n`;
  }
  
  return changelog;
}

// Update CHANGELOG.md
function updateChangelog(changelog) {
  console.log(chalk.blue('Updating CHANGELOG.md...'));
  
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  
  if (fs.existsSync(changelogPath)) {
    // Read existing changelog
    const existingChangelog = fs.readFileSync(changelogPath, 'utf8');
    
    // Add new entry at the top
    const newChangelog = `# Changelog\n\n${changelog}\n${existingChangelog.replace(/^# Changelog\n\n/, '')}`;
    
    // Write back to file
    fs.writeFileSync(changelogPath, newChangelog);
  } else {
    // Create new changelog file
    const newChangelog = `# Changelog\n\n${changelog}`;
    
    // Write to file
    fs.writeFileSync(changelogPath, newChangelog);
  }
  
  console.log(chalk.green(`CHANGELOG.md updated for v${newVersion}`));
}

// Run pre-release checks
function runPreReleaseChecks() {
  console.log(chalk.blue('Running pre-release checks...'));
  
  // Check that all tests pass
  try {
    console.log('Running tests...');
    execSync('npm test', { stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.red('ERROR: Tests failed. Fix the tests before creating a release.'));
    process.exit(1);
  }
  
  // Check for uncommitted changes
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim() !== '') {
      console.warn(chalk.yellow('WARNING: You have uncommitted changes. It is recommended to commit all changes before creating a release.'));
    }
  } catch (error) {
    console.warn(chalk.yellow('WARNING: Unable to check git status.'));
  }
}

// Main function
function main() {
  try {
    // Run pre-release checks
    runPreReleaseChecks();
    
    // Generate changelog
    const changelog = generateChangelog();
    
    // Update CHANGELOG.md
    updateChangelog(changelog);
    
    console.log(chalk.bold.green(`\n=== Release preparation for v${newVersion} completed successfully ===\n`));
    
    console.log(chalk.bold('Next steps:'));
    console.log('1. Review and edit CHANGELOG.md if needed');
    console.log('2. Commit the changes');
    console.log('3. Create a tag for the release');
    console.log('4. Push the changes and tag to the remote repository');
    
  } catch (error) {
    console.error(chalk.red(`\nError: ${error.message}\n`));
    process.exit(1);
  }
}

// Run the main function
main();