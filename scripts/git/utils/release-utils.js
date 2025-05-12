/**
 * Release utilities for the Claude Neural Framework
 * 
 * Shared utilities for release-start.js and release-finish.js scripts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Update VERSION.txt file with the new version
 * @param {string} version - The new version to set
 * @returns {boolean} - True if successful, false otherwise
 */
function updateVersionTxt(version) {
  try {
    const versionTxtPath = path.join(process.cwd(), 'VERSION.txt');
    if (fs.existsSync(versionTxtPath)) {
      console.log('Updating version in VERSION.txt...');
      const versionContent = fs.readFileSync(versionTxtPath, 'utf8').trim();
      
      // Check if it contains "Enterprise Beta" prefix
      if (versionContent.includes('Enterprise Beta')) {
        const newVersionContent = `Enterprise Beta ${version}`;
        fs.writeFileSync(versionTxtPath, newVersionContent);
      } else {
        // Just use plain version if no prefix exists
        fs.writeFileSync(versionTxtPath, version);
      }
      
      return true;
    } else {
      console.log('No VERSION.txt found, skipping version update');
      return false;
    }
  } catch (error) {
    console.error('Error updating VERSION.txt:', error.message);
    return false;
  }
}

/**
 * Validate version consistency across files
 * @param {string} version - The version to check for consistency
 * @returns {boolean} - True if all version references are consistent
 */
function validateVersionConsistency(version) {
  console.log('Validating version consistency across files...');
  const inconsistencies = [];
  
  // Check package.json
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.version !== version) {
      inconsistencies.push({
        file: 'package.json',
        expected: version,
        actual: packageJson.version
      });
    }
  }
  
  // Check VERSION.txt
  const versionTxtPath = path.join(process.cwd(), 'VERSION.txt');
  if (fs.existsSync(versionTxtPath)) {
    const versionContent = fs.readFileSync(versionTxtPath, 'utf8').trim();
    // Check if it contains the version (with or without prefix)
    if (!versionContent.includes(version)) {
      inconsistencies.push({
        file: 'VERSION.txt',
        expected: `containing ${version}`,
        actual: versionContent
      });
    }
  }
  
  // Add other version checks here (e.g., documentation files)
  
  // Report inconsistencies
  if (inconsistencies.length > 0) {
    console.log('\n⚠️ Version inconsistencies found:');
    inconsistencies.forEach(inc => {
      console.log(`- ${inc.file}: expected ${inc.expected}, found ${inc.actual}`);
    });
    return false;
  }
  
  console.log('✅ All version references are consistent');
  return true;
}

/**
 * Generate comprehensive changelog entries from git commits
 * @param {string} version - The version to generate changelog for
 * @returns {string} - Formatted changelog entry
 */
function generateChangelog(version) {
  console.log('Generating changelog entries...');
  
  // Get previous tag for commit range
  let previousTag = '';
  try {
    previousTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
  } catch (error) {
    // No previous tags
  }
  
  // Determine commit range
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
  console.log(`Getting commits from range: ${range}`);
  
  // Format commits by type using conventional commit format
  const commitTypes = [
    { type: 'feat', label: 'Added', grep: '--grep="^feat" --grep="^feature"' },
    { type: 'fix', label: 'Fixed', grep: '--grep="^fix" --grep="^bug"' },
    { type: 'docs', label: 'Documentation', grep: '--grep="^docs"' },
    { type: 'refactor', label: 'Changed', grep: '--grep="^refactor"' },
    { type: 'perf', label: 'Performance', grep: '--grep="^perf"' },
    { type: 'test', label: 'Tests', grep: '--grep="^test"' },
    { type: 'chore', label: 'Chores', grep: '--grep="^chore" --grep="^build" --grep="^ci"' }
  ];
  
  const sections = {};
  
  // Get commits for each type
  commitTypes.forEach(({ type, label, grep }) => {
    try {
      const commits = execSync(`git log ${range} --pretty=format:"- %s" ${grep}`, { encoding: 'utf8' }).trim();
      if (commits) {
        sections[label] = commits;
      }
    } catch (error) {
      // No commits of this type
    }
  });
  
  // Prepare changelog content
  const today = new Date().toISOString().split('T')[0];
  let changelogContent = `# [${version}] - ${today}\n\n`;
  
  // Add each section that has content
  Object.keys(sections).forEach(label => {
    changelogContent += `## ${label}\n\n${sections[label]}\n\n`;
  });
  
  return changelogContent;
}

/**
 * Run pre-release verification checks
 * @param {string} version - Version being released
 * @returns {boolean} - True if all checks pass
 */
function runReleaseChecks(version) {
  console.log(`\nRunning pre-release checks for version ${version}...`);
  const issues = [];
  
  // Check for uncommitted changes
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim() !== '') {
      issues.push('Uncommitted changes detected. Commit or stash changes before proceeding.');
    }
  } catch (error) {
    issues.push(`Failed to check git status: ${error.message}`);
  }
  
  // Run tests
  try {
    console.log('Running tests...');
    execSync('npm test', { stdio: 'inherit' });
  } catch (error) {
    issues.push('Tests failed. Fix test issues before releasing.');
  }
  
  // Security check
  try {
    console.log('Running security checks...');
    execSync('npm run security-check', { stdio: 'inherit' });
  } catch (error) {
    issues.push('Security checks failed. Address security issues before releasing.');
  }
  
  // Verify changelog has been updated
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const changelogContent = fs.readFileSync(changelogPath, 'utf8');
    if (!changelogContent.includes(`# [${version}]`)) {
      issues.push(`CHANGELOG.md does not contain an entry for version ${version}.`);
    }
  } else {
    issues.push('CHANGELOG.md not found.');
  }
  
  // Check enterprise workflow compliance
  const enterpriseConfigPath = path.join(process.cwd(), 'core/config/enterprise_workflow_config.json');
  if (fs.existsSync(enterpriseConfigPath)) {
    try {
      const enterpriseConfig = JSON.parse(fs.readFileSync(enterpriseConfigPath, 'utf8'));
      if (enterpriseConfig.changeManagement && enterpriseConfig.changeManagement.requireChangelog && !fs.existsSync(changelogPath)) {
        issues.push('Enterprise workflow requires a changelog but CHANGELOG.md is missing.');
      }
    } catch (error) {
      issues.push(`Failed to validate enterprise workflow: ${error.message}`);
    }
  }
  
  // Report issues
  if (issues.length > 0) {
    console.log('\n❌ Release checks failed:');
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    return false;
  }
  
  console.log('✅ All release checks passed');
  return true;
}

/**
 * Generate release notes template
 * @param {string} version - Version being released
 * @returns {string} - Release notes template
 */
function generateReleaseNotesTemplate(version) {
  const today = new Date().toISOString().split('T')[0];
  
  return `# Release ${version} (${today})

## Overview
<!-- Brief overview of this release, 1-2 paragraphs -->

## Key Features
<!-- List of major features or improvements -->
- 
- 
- 

## Bug Fixes
<!-- List of significant bug fixes -->
- 
- 

## Breaking Changes
<!-- Any breaking changes users should be aware of -->
- None

## Upgrade Notes
<!-- Instructions for upgrading from previous version -->
1. Update to version ${version}: \`npm install claude-neural-framework@${version}\`
2. Run migrations if applicable: \`./scripts/migrations/run.js\`

## Documentation
<!-- Links to relevant documentation -->
- [Full Changelog](CHANGELOG.md)
- [API Documentation](./docs/api/README.md)
- [User Guide](./docs/guides/quick_start_guide.md)

## Contributors
<!-- People who contributed to this release -->
- 
- 

---
For questions or issues, please open a GitHub issue or contact support.
`;
}

// Export functions
module.exports = {
  updateVersionTxt,
  validateVersionConsistency,
  generateChangelog,
  runReleaseChecks,
  generateReleaseNotesTemplate
};