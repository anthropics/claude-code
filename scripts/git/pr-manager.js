#!/usr/bin/env node

/**
 * Pull Request Manager
 * 
 * A tool for managing GitHub pull requests locally from the command line
 * 
 * Usage:
 *   node pr-manager.js <command> [options]
 * 
 * Commands:
 *   list                List all open pull requests
 *   checkout <number>   Checkout a specific PR
 *   create [title]      Create a new PR from current branch
 *   view <number>       View PR details
 *   review <number>     Start reviewing a PR
 *   status              Show status of PRs you've authored
 *   comments <number>   Show comments for a PR
 *   merge <number>      Merge a PR
 *   close <number>      Close a PR
 *   approve <number>    Approve a PR
 * 
 * Options:
 *   --base=<branch>     Base branch for PR (default: main)
 *   --draft             Create PR as draft
 *   --json              Output as JSON
 *   --verbose           Show detailed output
 */

const { execSync, spawn } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
let prNumber = null;

// Extract PR number for commands that require it
if (['checkout', 'view', 'review', 'comments', 'merge', 'close', 'approve'].includes(command)) {
  prNumber = args[1];
  if (!prNumber || isNaN(parseInt(prNumber, 10))) {
    console.error(`Error: PR number is required for '${command}' command`);
    console.log(`Usage: node pr-manager.js ${command} <number>`);
    process.exit(1);
  }
}

// Options
const options = {
  base: 'main',
  draft: args.includes('--draft'),
  json: args.includes('--json'),
  verbose: args.includes('--verbose')
};

// Extract base branch option
const baseArg = args.find(arg => arg.startsWith('--base='));
if (baseArg) {
  options.base = baseArg.split('=')[1];
}

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Check if GitHub CLI (gh) is installed
 * @returns {boolean} Whether gh is installed
 */
function checkGitHubCLI() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('GitHub CLI (gh) is not installed or not in the PATH');
    console.log('Please install GitHub CLI: https://cli.github.com/');
    return false;
  }
}

/**
 * Check if user is authenticated with GitHub
 * @returns {boolean} Whether user is authenticated
 */
function checkGitHubAuth() {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error('Not authenticated with GitHub');
    console.log('Please run: gh auth login');
    return false;
  }
}

/**
 * Get current repository info
 * @returns {Object} Repository info
 */
function getRepositoryInfo() {
  try {
    const repoUrl = execSync('git config --get remote.origin.url').toString().trim();
    
    // Extract owner and repo from URL
    let owner, repo;
    
    if (repoUrl.includes('github.com')) {
      const match = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
      if (match) {
        owner = match[1];
        repo = match[2].replace('.git', '');
      }
    }
    
    return {
      url: repoUrl,
      owner,
      repo
    };
  } catch (error) {
    console.error(`Error getting repository info: ${error.message}`);
    return { url: null, owner: null, repo: null };
  }
}

/**
 * List open pull requests
 */
function listPullRequests() {
  console.log('Fetching open pull requests...');
  
  try {
    let command = 'gh pr list';
    
    if (options.json) {
      command += ' --json number,title,author,createdAt,updatedAt,baseRefName,headRefName,state';
    }
    
    const result = execSync(command).toString().trim();
    
    if (!options.json) {
      // Standard output already formatted by gh
      console.log(result || 'No open pull requests found');
    } else {
      // Parse and format JSON
      const prs = JSON.parse(result);
      
      if (prs.length === 0) {
        console.log('No open pull requests found');
        return;
      }
      
      if (options.json) {
        console.log(JSON.stringify(prs, null, 2));
      } else {
        console.log('Open Pull Requests:');
        prs.forEach(pr => {
          const createdDate = new Date(pr.createdAt).toLocaleDateString();
          console.log(`#${pr.number} - ${pr.title}`);
          console.log(`  Author: ${pr.author.login} | Created: ${createdDate} | Base: ${pr.baseRefName} <- Head: ${pr.headRefName}`);
          console.log('');
        });
      }
    }
  } catch (error) {
    console.error(`Error listing pull requests: ${error.message}`);
  }
}

/**
 * Checkout a specific PR
 * @param {string} number PR number
 */
function checkoutPullRequest(number) {
  console.log(`Checking out PR #${number}...`);
  
  try {
    execSync(`gh pr checkout ${number}`, { stdio: 'inherit' });
    console.log(`Successfully checked out PR #${number}`);
  } catch (error) {
    console.error(`Error checking out PR #${number}: ${error.message}`);
  }
}

/**
 * View PR details
 * @param {string} number PR number
 */
function viewPullRequest(number) {
  console.log(`Viewing PR #${number}...`);
  
  try {
    let command = `gh pr view ${number}`;
    
    if (options.json) {
      command += ' --json number,title,body,author,createdAt,updatedAt,baseRefName,headRefName,state,mergeable,reviewDecision';
    }
    
    const result = execSync(command).toString().trim();
    console.log(result);
  } catch (error) {
    console.error(`Error viewing PR #${number}: ${error.message}`);
  }
}

/**
 * Create a new PR
 * @param {string} title PR title (optional)
 */
async function createPullRequest(title) {
  // Check if there are uncommitted changes
  try {
    const status = execSync('git status --porcelain').toString().trim();
    
    if (status) {
      console.log('You have uncommitted changes. Commit or stash them before creating a PR.');
      
      const answer = await new Promise(resolve => {
        rl.question('Would you like to see the uncommitted changes? (y/n): ', resolve);
      });
      
      if (answer.toLowerCase() === 'y') {
        const diff = execSync('git status').toString();
        console.log(diff);
      }
      
      rl.close();
      return;
    }
  } catch (error) {
    console.error(`Error checking git status: ${error.message}`);
    rl.close();
    return;
  }
  
  // Get current branch
  let currentBranch;
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (error) {
    console.error(`Error getting current branch: ${error.message}`);
    rl.close();
    return;
  }
  
  console.log(`Creating PR from branch: ${currentBranch}`);
  
  let prTitle = title;
  
  // If no title provided, prompt for one or generate from branch name
  if (!prTitle) {
    // Try to generate a title from the branch name
    const suggestedTitle = currentBranch
      .replace(/^(feature|fix|chore|docs|refactor|test|style|perf|build|ci|revert)\//, '')
      .replace(/[-_]/g, ' ')
      .replace(/^\d+\s+/, '') // Remove leading issue number if present
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    prTitle = await new Promise(resolve => {
      rl.question(`PR title (default: "${suggestedTitle}"): `, answer => {
        resolve(answer || suggestedTitle);
      });
    });
  }
  
  // Prompt for PR body
  const prBody = await new Promise(resolve => {
    console.log('Enter PR description (end with a line containing only "." or leave empty):');
    let body = '';
    
    const handleInput = line => {
      if (line === '.') {
        rl.removeListener('line', handleInput);
        resolve(body);
      } else {
        body += line + '\n';
      }
    };
    
    rl.on('line', handleInput);
  });
  
  // Build command
  let command = `gh pr create --title "${prTitle}" --base ${options.base}`;
  
  if (prBody.trim()) {
    // Write body to temp file
    const tmpFile = path.join(process.cwd(), '.git', 'PR_BODY.md');
    fs.writeFileSync(tmpFile, prBody);
    command += ` --body-file "${tmpFile}"`;
  }
  
  if (options.draft) {
    command += ' --draft';
  }
  
  try {
    // Create PR
    const result = execSync(command).toString().trim();
    console.log(result);
    
    // Clean up temp file if created
    if (prBody.trim()) {
      fs.unlinkSync(path.join(process.cwd(), '.git', 'PR_BODY.md'));
    }
  } catch (error) {
    console.error(`Error creating PR: ${error.message}`);
  }
  
  rl.close();
}

/**
 * Start reviewing a PR
 * @param {string} number PR number
 */
function reviewPullRequest(number) {
  try {
    // First checkout the PR
    checkoutPullRequest(number);
    
    // Show PR details
    const prDetails = execSync(`gh pr view ${number}`).toString().trim();
    console.log(prDetails);
    
    // Get files changed
    console.log('\nFiles changed:');
    const filesChanged = execSync(`gh pr diff ${number} --name-only`).toString().trim();
    console.log(filesChanged);
    
    // Ask if user wants to create a review
    rl.question('\nWould you like to start a review? (y/n): ', answer => {
      if (answer.toLowerCase() === 'y') {
        // Start review in editor
        const child = spawn('gh', ['pr', 'review', number, '--comment'], { 
          stdio: 'inherit',
          shell: true
        });
        
        child.on('close', code => {
          console.log(`Review process exited with code ${code}`);
          rl.close();
        });
      } else {
        console.log('Review cancelled');
        rl.close();
      }
    });
  } catch (error) {
    console.error(`Error reviewing PR #${number}: ${error.message}`);
    rl.close();
  }
}

/**
 * Show PR status
 */
function showPRStatus() {
  try {
    // Get current user
    const user = execSync('gh api user').toString();
    const userData = JSON.parse(user);
    const username = userData.login;
    
    console.log(`Fetching PRs authored by ${username}...`);
    
    // Get PRs authored by current user
    const result = execSync(`gh pr list --author ${username} --json number,title,state,reviewDecision,baseRefName`).toString();
    const prs = JSON.parse(result);
    
    if (prs.length === 0) {
      console.log('You have no open PRs');
      return;
    }
    
    console.log(`You have ${prs.length} PRs:`);
    
    prs.forEach(pr => {
      let status = '⚪️';
      let reviewStatus = 'No reviews';
      
      if (pr.state === 'OPEN') {
        status = '🟢';
      } else if (pr.state === 'CLOSED') {
        status = '🔴';
      } else if (pr.state === 'MERGED') {
        status = '🟣';
      }
      
      if (pr.reviewDecision === 'APPROVED') {
        reviewStatus = '✅ Approved';
      } else if (pr.reviewDecision === 'CHANGES_REQUESTED') {
        reviewStatus = '❌ Changes requested';
      } else if (pr.reviewDecision === 'REVIEW_REQUIRED') {
        reviewStatus = '⏳ Review required';
      }
      
      console.log(`${status} #${pr.number} - ${pr.title}`);
      console.log(`  Target: ${pr.baseRefName} | Status: ${reviewStatus}`);
    });
  } catch (error) {
    console.error(`Error showing PR status: ${error.message}`);
  }
}

/**
 * Show PR comments
 * @param {string} number PR number
 */
function showComments(number) {
  try {
    console.log(`Fetching comments for PR #${number}...`);
    
    const result = execSync(`gh api repos/:owner/:repo/issues/${number}/comments`).toString();
    const comments = JSON.parse(result);
    
    if (comments.length === 0) {
      console.log('No comments found');
      return;
    }
    
    console.log(`${comments.length} comments found:\n`);
    
    comments.forEach(comment => {
      const date = new Date(comment.created_at).toLocaleString();
      console.log(`${comment.user.login} commented on ${date}:`);
      console.log(comment.body);
      console.log('---------------------------------------------');
    });
  } catch (error) {
    console.error(`Error showing comments for PR #${number}: ${error.message}`);
  }
}

/**
 * Merge a PR
 * @param {string} number PR number
 */
function mergePullRequest(number) {
  try {
    console.log(`Merging PR #${number}...`);
    
    // Check PR status before merging
    const statusCmd = `gh pr view ${number} --json number,title,state,reviewDecision,mergeable`;
    const statusResult = execSync(statusCmd).toString();
    const status = JSON.parse(statusResult);
    
    if (status.state !== 'OPEN') {
      console.error(`PR #${number} is not open (state: ${status.state})`);
      return;
    }
    
    if (status.mergeable !== 'MERGEABLE') {
      console.error(`PR #${number} is not mergeable (status: ${status.mergeable})`);
      
      rl.question('Would you like to view the current status? (y/n): ', answer => {
        if (answer.toLowerCase() === 'y') {
          viewPullRequest(number);
        }
        rl.close();
      });
      return;
    }
    
    // Proceed with merge
    rl.question(`Are you sure you want to merge PR #${number}? (y/n): `, answer => {
      if (answer.toLowerCase() === 'y') {
        const result = execSync(`gh pr merge ${number} --merge`).toString().trim();
        console.log(result);
      } else {
        console.log('Merge cancelled');
      }
      rl.close();
    });
  } catch (error) {
    console.error(`Error merging PR #${number}: ${error.message}`);
    rl.close();
  }
}

/**
 * Close a PR
 * @param {string} number PR number
 */
function closePullRequest(number) {
  rl.question(`Are you sure you want to close PR #${number}? (y/n): `, answer => {
    if (answer.toLowerCase() === 'y') {
      try {
        console.log(`Closing PR #${number}...`);
        const result = execSync(`gh pr close ${number}`).toString().trim();
        console.log(result);
      } catch (error) {
        console.error(`Error closing PR #${number}: ${error.message}`);
      }
    } else {
      console.log('Close cancelled');
    }
    rl.close();
  });
}

/**
 * Approve a PR
 * @param {string} number PR number
 */
function approvePullRequest(number) {
  try {
    console.log(`Approving PR #${number}...`);
    
    // Prompt for review comment
    rl.question('Review comment (optional): ', comment => {
      let command = `gh pr review ${number} --approve`;
      
      if (comment) {
        // Write comment to temp file
        const tmpFile = path.join(process.cwd(), '.git', 'REVIEW_COMMENT.md');
        fs.writeFileSync(tmpFile, comment);
        command += ` --body-file "${tmpFile}"`;
      }
      
      try {
        const result = execSync(command).toString().trim();
        console.log(result);
        
        // Clean up temp file if created
        if (comment) {
          fs.unlinkSync(path.join(process.cwd(), '.git', 'REVIEW_COMMENT.md'));
        }
      } catch (error) {
        console.error(`Error approving PR #${number}: ${error.message}`);
      }
      
      rl.close();
    });
  } catch (error) {
    console.error(`Error approving PR #${number}: ${error.message}`);
    rl.close();
  }
}

/**
 * Main execution function
 */
function main() {
  // Check GitHub CLI installation
  if (!checkGitHubCLI()) {
    process.exit(1);
  }
  
  // Check GitHub authentication
  if (!checkGitHubAuth()) {
    process.exit(1);
  }
  
  // Execute command
  switch (command) {
    case 'list':
      listPullRequests();
      break;
    case 'checkout':
      checkoutPullRequest(prNumber);
      break;
    case 'create':
      createPullRequest(args[1]);
      return; // Don't close RL since it's handled inside createPullRequest
    case 'view':
      viewPullRequest(prNumber);
      break;
    case 'review':
      reviewPullRequest(prNumber);
      return; // Don't close RL since it's handled inside reviewPullRequest
    case 'status':
      showPRStatus();
      break;
    case 'comments':
      showComments(prNumber);
      break;
    case 'merge':
      mergePullRequest(prNumber);
      return; // Don't close RL since it's handled inside mergePullRequest
    case 'close':
      closePullRequest(prNumber);
      return; // Don't close RL since it's handled inside closePullRequest
    case 'approve':
      approvePullRequest(prNumber);
      return; // Don't close RL since it's handled inside approvePullRequest
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Available commands: list, checkout, create, view, review, status, comments, merge, close, approve');
      break;
  }
  
  // Close readline interface (for commands that don't need it)
  if (rl) {
    rl.close();
  }
}

// Run the script
main();