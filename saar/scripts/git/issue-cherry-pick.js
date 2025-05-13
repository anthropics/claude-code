#!/usr/bin/env node

/**
 * Cherry-pick commits for a specific issue across branches
 * 
 * Finds and cherry-picks all commits referencing a specific issue number
 * 
 * Usage:
 *   node issue-cherry-pick.js <issue-number> [options]
 * 
 * Options:
 *   --from=<branch>    Source branch (default: develop)
 *   --to=<branch>      Target branch (default: current branch)
 *   --dry-run          Show what would be cherry-picked without executing
 *   --force            Skip confirmation prompt
 *   --verbose          Show detailed output
 */

const { execSync } = require('child_process');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const issueNumber = args[0];

// Check for issue number
if (!issueNumber || isNaN(parseInt(issueNumber, 10))) {
  console.error('Error: Issue number is required');
  console.log('Usage: node issue-cherry-pick.js <issue-number> [options]');
  process.exit(1);
}

// Extract options
const options = {
  from: 'develop',
  to: getCurrentBranch(),
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  verbose: args.includes('--verbose')
};

// Parse source branch option
const fromArg = args.find(arg => arg.startsWith('--from='));
if (fromArg) {
  options.from = fromArg.split('=')[1];
}

// Parse target branch option
const toArg = args.find(arg => arg.startsWith('--to='));
if (toArg) {
  options.to = toArg.split('=')[1];
}

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Get current branch name
 * @returns {string} Current branch name
 */
function getCurrentBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
}

/**
 * Find commits related to an issue
 * @param {string} issueNumber Issue number to search for
 * @param {string} branch Branch to search in
 * @returns {Array} Array of commit objects
 */
function findIssueCommits(issueNumber, branch) {
  try {
    // Search for commits containing the issue number in the message
    // Look for common patterns: #123, issue-123, fix 123, etc.
    const searchPatterns = [
      `#${issueNumber}`,
      `issue-${issueNumber}`,
      `issue ${issueNumber}`,
      `fix-${issueNumber}`,
      `fix ${issueNumber}`,
      `close-${issueNumber}`,
      `close ${issueNumber}`,
      `feature-${issueNumber}`,
      `feature/${issueNumber}`
    ];
    
    // Build grep pattern
    const grepPattern = searchPatterns.join('\\|');
    
    // Get commit log with pattern
    const gitCommand = `git log ${branch} --grep="${grepPattern}" --pretty=format:"%H|%s|%an|%ad"`;
    
    if (options.verbose) {
      console.log(`Executing: ${gitCommand}`);
    }
    
    const output = execSync(gitCommand).toString().trim();
    
    if (!output) {
      return [];
    }
    
    // Parse commit log
    return output.split('\n').map(line => {
      const [hash, subject, author, date] = line.split('|');
      return { hash, subject, author, date };
    });
  } catch (error) {
    console.error(`Error finding commits: ${error.message}`);
    return [];
  }
}

/**
 * Check if commit exists in target branch
 * @param {string} commitHash Commit hash to check
 * @param {string} branch Branch to check in
 * @returns {boolean} True if commit exists in branch
 */
function commitExistsInBranch(commitHash, branch) {
  try {
    execSync(`git branch ${branch} --contains ${commitHash}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Cherry-pick a commit to target branch
 * @param {Object} commit Commit object with hash and subject
 * @returns {boolean} Success status
 */
function cherryPickCommit(commit) {
  try {
    if (options.dryRun) {
      console.log(`Would cherry-pick: ${commit.hash.substring(0, 8)} - ${commit.subject}`);
      return true;
    }
    
    console.log(`Cherry-picking: ${commit.hash.substring(0, 8)} - ${commit.subject}`);
    
    // Execute cherry-pick
    execSync(`git cherry-pick ${commit.hash}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Failed to cherry-pick ${commit.hash}: ${error.message}`);
    
    // Abort the cherry-pick
    try {
      execSync('git cherry-pick --abort');
    } catch (abortError) {
      // Ignore abort errors
    }
    
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log(`Searching for commits related to issue #${issueNumber}...`);
    
    // Find commits for the issue
    const commits = findIssueCommits(issueNumber, options.from);
    
    if (commits.length === 0) {
      console.log(`No commits found for issue #${issueNumber} in ${options.from} branch`);
      rl.close();
      return;
    }
    
    console.log(`Found ${commits.length} commits related to issue #${issueNumber}:`);
    
    commits.forEach((commit, index) => {
      const alreadyInTarget = commitExistsInBranch(commit.hash, options.to);
      const status = alreadyInTarget ? '[Already in target]' : '[New]';
      console.log(`${index + 1}. ${commit.hash.substring(0, 8)} - ${commit.subject} ${status}`);
      
      if (options.verbose) {
        console.log(`   Author: ${commit.author}, Date: ${commit.date}`);
      }
    });
    
    // Filter out commits already in target branch
    const newCommits = commits.filter(commit => !commitExistsInBranch(commit.hash, options.to));
    
    if (newCommits.length === 0) {
      console.log(`All commits are already in the ${options.to} branch. Nothing to cherry-pick.`);
      rl.close();
      return;
    }
    
    console.log(`\nWill cherry-pick ${newCommits.length} commits from ${options.from} to ${options.to}`);
    
    // Get confirmation unless force flag is used
    if (!options.force && !options.dryRun) {
      const answer = await new Promise(resolve => {
        rl.question('Proceed with cherry-pick? (y/n): ', resolve);
      });
      
      if (answer.toLowerCase() !== 'y') {
        console.log('Cherry-pick cancelled');
        rl.close();
        return;
      }
    }
    
    // Ensure we're on the target branch
    if (!options.dryRun && getCurrentBranch() !== options.to) {
      console.log(`Switching to ${options.to} branch...`);
      execSync(`git checkout ${options.to}`);
    }
    
    // Cherry-pick commits in chronological order (oldest first)
    let successCount = 0;
    
    for (const commit of newCommits.reverse()) {
      const success = cherryPickCommit(commit);
      if (success) {
        successCount++;
      }
    }
    
    if (options.dryRun) {
      console.log(`\nDry run completed. Would have cherry-picked ${newCommits.length} commits.`);
    } else {
      console.log(`\nCherry-pick completed. Successfully applied ${successCount} of ${newCommits.length} commits.`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  } finally {
    rl.close();
  }
}

// Run the script
main();