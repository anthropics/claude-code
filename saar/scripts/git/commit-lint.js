#!/usr/bin/env node

/**
 * Git commit history linter and fixer
 * 
 * Analyzes commit history and offers to fix common issues:
 * - Non-conventional commit messages
 * - Merge commit conflicts
 * - Large commits that should be split
 * - Empty commits
 * 
 * Usage:
 *   node commit-lint.js [options]
 * 
 * Options:
 *   --depth=<n>          Number of commits to analyze (default: 10)
 *   --branch=<branch>    Branch to analyze (default: current branch)
 *   --fix                Interactively fix issues
 *   --check-only         Only report issues without fixing
 *   --verbose            Show detailed output
 */

const { execSync, spawnSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  depth: 10,
  branch: getCurrentBranch(),
  fix: args.includes('--fix'),
  checkOnly: args.includes('--check-only'),
  verbose: args.includes('--verbose')
};

// Extract depth option
const depthArg = args.find(arg => arg.startsWith('--depth='));
if (depthArg) {
  const depth = parseInt(depthArg.split('=')[1], 10);
  if (!isNaN(depth)) {
    options.depth = depth;
  }
}

// Extract branch option
const branchArg = args.find(arg => arg.startsWith('--branch='));
if (branchArg) {
  options.branch = branchArg.split('=')[1];
}

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Conventional commit types
const conventionalTypes = [
  'feat', 'fix', 'docs', 'style', 'refactor', 
  'perf', 'test', 'build', 'ci', 'chore'
];

/**
 * Get current branch name
 * @returns {string} Current branch name
 */
function getCurrentBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
}

/**
 * Get commit history for analysis
 * @param {number} depth Number of commits to fetch
 * @param {string} branch Branch to analyze
 * @returns {Array} Array of commit objects
 */
function getCommitHistory(depth, branch) {
  try {
    // Get detailed commit log
    const gitCommand = `git log -n ${depth} ${branch} --pretty=format:"%H|%s|%an|%ae|%at|%p"`;
    
    if (options.verbose) {
      console.log(`Executing: ${gitCommand}`);
    }
    
    const output = execSync(gitCommand).toString().trim();
    
    if (!output) {
      return [];
    }
    
    // Parse commit log
    const commits = output.split('\n').map(line => {
      const [hash, subject, author, email, timestamp, parents] = line.split('|');
      const parentHashes = parents ? parents.split(' ') : [];
      
      return { 
        hash, 
        subject, 
        author, 
        email, 
        timestamp: parseInt(timestamp, 10),
        date: new Date(parseInt(timestamp, 10) * 1000).toISOString(),
        parentHashes,
        isMerge: parentHashes.length > 1
      };
    });
    
    // Fetch commit stats for each commit
    commits.forEach(commit => {
      // Get file changes and stats
      try {
        const statsCommand = `git show --stat --oneline ${commit.hash}`;
        const statsOutput = execSync(statsCommand).toString();
        
        // Parse basic stats
        const fileCount = (statsOutput.match(/\|\s+\d+/g) || []).length;
        const insertions = statsOutput.includes('insertion') ? 
          parseInt(statsOutput.match(/(\d+) insertion/)[1], 10) : 0;
        const deletions = statsOutput.includes('deletion') ? 
          parseInt(statsOutput.match(/(\d+) deletion/)[1], 10) : 0;
        
        commit.stats = {
          fileCount,
          insertions,
          deletions,
          totalChanges: insertions + deletions
        };
        
        // Get changed files
        const filesCommand = `git diff-tree --no-commit-id --name-only -r ${commit.hash}`;
        const filesOutput = execSync(filesCommand).toString().trim();
        commit.files = filesOutput ? filesOutput.split('\n') : [];
        
      } catch (error) {
        commit.stats = { fileCount: 0, insertions: 0, deletions: 0, totalChanges: 0 };
        commit.files = [];
      }
    });
    
    return commits;
  } catch (error) {
    console.error(`Error getting commit history: ${error.message}`);
    return [];
  }
}

/**
 * Check if commit message follows conventional commits format
 * @param {Object} commit Commit object to check
 * @returns {Object} Validation result
 */
function validateConventionalCommit(commit) {
  const { subject } = commit;
  
  // Conventional commits pattern: type(scope?): description
  const conventionalPattern = /^(\w+)(\([\w-]+\))?!?: .+$/;
  const match = subject.match(conventionalPattern);
  
  if (!match) {
    return {
      valid: false,
      issue: 'Non-conventional commit format',
      details: 'Should follow pattern: type(scope?): description'
    };
  }
  
  const type = match[1];
  
  // Check if type is valid
  if (!conventionalTypes.includes(type)) {
    return {
      valid: false,
      issue: 'Invalid commit type',
      details: `Type "${type}" is not in the conventional types: ${conventionalTypes.join(', ')}`
    };
  }
  
  // Success
  return { valid: true };
}

/**
 * Check for empty commits (no file changes)
 * @param {Object} commit Commit object to check
 * @returns {Object} Validation result
 */
function validateNonEmptyCommit(commit) {
  if (commit.stats.fileCount === 0 || commit.stats.totalChanges === 0) {
    return {
      valid: false,
      issue: 'Empty commit',
      details: 'Commit has no file changes'
    };
  }
  
  return { valid: true };
}

/**
 * Check for large commits that should be split
 * @param {Object} commit Commit object to check
 * @returns {Object} Validation result
 */
function validateCommitSize(commit) {
  // Define thresholds for commit size
  const FILE_COUNT_THRESHOLD = 10;
  const CHANGES_THRESHOLD = 300;
  
  if (commit.stats.fileCount > FILE_COUNT_THRESHOLD) {
    return {
      valid: false,
      issue: 'Too many files changed',
      details: `${commit.stats.fileCount} files changed (threshold: ${FILE_COUNT_THRESHOLD})`
    };
  }
  
  if (commit.stats.totalChanges > CHANGES_THRESHOLD) {
    return {
      valid: false,
      issue: 'Too many changes',
      details: `${commit.stats.totalChanges} lines changed (threshold: ${CHANGES_THRESHOLD})`
    };
  }
  
  return { valid: true };
}

/**
 * Fix a commit by amending its message
 * @param {Object} commit Commit to fix
 * @returns {Promise<boolean>} Success status
 */
async function fixCommitMessage(commit) {
  // Show suggested fixes
  console.log('Suggested conventional commit formats:');
  
  // Analyze commit content to suggest an appropriate type
  const types = [];
  
  // Check file extensions to suggest types
  const hasDocsFiles = commit.files.some(file => 
    file.endsWith('.md') || file.includes('docs/') || file.includes('documentation/'));
  
  const hasTestFiles = commit.files.some(file => 
    file.includes('test/') || file.includes('spec/') || 
    file.endsWith('.test.js') || file.endsWith('.spec.js'));
    
  const hasCssFiles = commit.files.some(file =>
    file.endsWith('.css') || file.endsWith('.scss') || file.endsWith('.less'));
    
  if (hasDocsFiles) types.push('docs');
  if (hasTestFiles) types.push('test');
  if (hasCssFiles) types.push('style');
  
  // Suggest based on common keywords in the commit message
  const message = commit.subject.toLowerCase();
  
  if (message.includes('fix') || message.includes('bug') || message.includes('issue')) {
    types.push('fix');
  } else if (message.includes('add') || message.includes('new') || message.includes('feature')) {
    types.push('feat');
  } else if (message.includes('refactor') || message.includes('clean') || message.includes('reorganize')) {
    types.push('refactor');
  } else if (message.includes('performance') || message.includes('optimize') || message.includes('speed')) {
    types.push('perf');
  }
  
  // Ensure some default suggestions
  if (types.length === 0) {
    types.push('feat', 'fix', 'chore');
  }
  
  // Remove duplicates and cap at 3 suggestions
  const uniqueTypes = [...new Set(types)].slice(0, 3);
  
  // Display suggestions
  uniqueTypes.forEach((type, index) => {
    const description = commit.subject.replace(/^[\w\(\)!:]+:\s*/, '').trim();
    console.log(`${index + 1}. ${type}: ${description}`);
  });
  
  // Get user input
  const answer = await new Promise(resolve => {
    rl.question('\nChoose a suggestion (number), enter a custom message, or skip (s): ', resolve);
  });
  
  if (answer.toLowerCase() === 's') {
    console.log('Skipping this commit');
    return false;
  }
  
  let newMessage;
  const chosenIndex = parseInt(answer, 10) - 1;
  
  if (!isNaN(chosenIndex) && chosenIndex >= 0 && chosenIndex < uniqueTypes.length) {
    // User chose a suggestion
    const type = uniqueTypes[chosenIndex];
    const description = commit.subject.replace(/^[\w\(\)!:]+:\s*/, '').trim();
    newMessage = `${type}: ${description}`;
  } else {
    // User entered a custom message
    newMessage = answer;
  }
  
  try {
    if (options.verbose) {
      console.log(`Rewriting commit message for ${commit.hash.substring(0, 8)}`);
    }
    
    // Create a temporary script to rewrite the commit message
    const tempScriptPath = path.join(process.cwd(), '.git', 'rewrite-commit-msg.sh');
    const scriptContent = `#!/bin/bash
git filter-branch --force --msg-filter '
  if [ "$GIT_COMMIT" = "${commit.hash}" ]; then
    echo "${newMessage}"
  else
    cat
  fi
' -- ${commit.hash}^..HEAD
`;
    
    fs.writeFileSync(tempScriptPath, scriptContent);
    fs.chmodSync(tempScriptPath, '755');
    
    if (options.dryRun) {
      console.log('Would execute:');
      console.log(scriptContent);
      return true;
    }
    
    // Execute the script
    execSync(tempScriptPath, { stdio: 'inherit' });
    
    // Clean up
    fs.unlinkSync(tempScriptPath);
    
    console.log(`✅ Commit message updated successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update commit message: ${error.message}`);
    return false;
  }
}

/**
 * Analyze commits and find issues
 * @param {Array} commits Array of commit objects
 * @returns {Object} Analysis results
 */
function analyzeCommits(commits) {
  const issues = [];
  
  commits.forEach(commit => {
    const results = {
      commit,
      validations: [
        validateConventionalCommit(commit),
        validateNonEmptyCommit(commit),
        validateCommitSize(commit)
      ],
      valid: true
    };
    
    // Skip merge commits from basic validation
    if (commit.isMerge) {
      results.valid = true;
      results.reason = 'Merge commit';
      return;
    }
    
    // Check if any validation failed
    const failedValidations = results.validations.filter(v => !v.valid);
    
    if (failedValidations.length > 0) {
      results.valid = false;
      results.failedValidations = failedValidations;
      issues.push(results);
    }
  });
  
  return {
    totalCommits: commits.length,
    issueCount: issues.length,
    issues
  };
}

/**
 * Print analysis results
 * @param {Object} results Analysis results
 */
function printResults(results) {
  console.log(`\nAnalyzed ${results.totalCommits} commits on branch ${options.branch}`);
  console.log(`Found ${results.issueCount} commits with issues\n`);
  
  if (results.issueCount === 0) {
    console.log('✅ No issues found');
    return;
  }
  
  results.issues.forEach((issue, index) => {
    const { commit } = issue;
    
    console.log(`Issue ${index + 1} of ${results.issueCount}:`);
    console.log(`Commit: ${commit.hash.substring(0, 8)} - ${commit.subject}`);
    console.log(`Author: ${commit.author} <${commit.email}>`);
    console.log(`Date: ${commit.date}`);
    console.log(`Changes: ${commit.stats.fileCount} files, +${commit.stats.insertions}/-${commit.stats.deletions}`);
    
    console.log('Problems:');
    issue.failedValidations.forEach(failure => {
      console.log(`- ${failure.issue}: ${failure.details}`);
    });
    
    console.log('');
  });
}

/**
 * Interactively fix commit issues
 * @param {Object} results Analysis results
 */
async function fixIssues(results) {
  if (results.issueCount === 0) {
    return;
  }
  
  if (options.checkOnly) {
    console.log('Check-only mode, not fixing issues');
    return;
  }
  
  console.log('Starting interactive fix mode...\n');
  
  for (let i = 0; i < results.issues.length; i++) {
    const issue = results.issues[i];
    const { commit } = issue;
    
    console.log(`Fixing issue ${i + 1} of ${results.issueCount}:`);
    console.log(`Commit: ${commit.hash.substring(0, 8)} - ${commit.subject}`);
    
    // List problems
    console.log('Problems:');
    issue.failedValidations.forEach(failure => {
      console.log(`- ${failure.issue}: ${failure.details}`);
    });
    
    // Check what issues we have and offer appropriate fixes
    const hasConventionalCommitIssue = issue.failedValidations.some(v => 
      v.issue === 'Non-conventional commit format' || v.issue === 'Invalid commit type');
    
    if (hasConventionalCommitIssue) {
      // Fix commit message format
      const fix = await fixCommitMessage(commit);
      if (fix) {
        console.log(`✅ Fixed commit message format`);
      }
    }
    
    // Other fixes would go here...
    
    console.log('');
    
    // Ask if user wants to continue
    if (i < results.issues.length - 1) {
      const answer = await new Promise(resolve => {
        rl.question('Continue to next issue? (y/n): ', resolve);
      });
      
      if (answer.toLowerCase() !== 'y') {
        console.log('Stopping fix process');
        break;
      }
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log(`Analyzing commit history for ${options.branch}...`);
    
    // Get commit history
    const commits = getCommitHistory(options.depth, options.branch);
    
    if (commits.length === 0) {
      console.log(`No commits found for branch ${options.branch}`);
      rl.close();
      return;
    }
    
    // Analyze commits
    const results = analyzeCommits(commits);
    
    // Print results
    printResults(results);
    
    // Fix issues if requested
    if (options.fix) {
      await fixIssues(results);
    } else if (!options.checkOnly && results.issueCount > 0) {
      const answer = await new Promise(resolve => {
        rl.question('Would you like to fix these issues? (y/n): ', resolve);
      });
      
      if (answer.toLowerCase() === 'y') {
        await fixIssues(results);
      }
    }
    
    console.log('Analysis complete');
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    rl.close();
  }
}

// Run the script
main();