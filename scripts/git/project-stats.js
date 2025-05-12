#!/usr/bin/env node

/**
 * Git Project Statistics and Visualization Tool
 * 
 * Generates comprehensive statistics and visualizations for git repositories
 * including contribution analysis, code churn, and feature development timelines.
 * 
 * Usage:
 *   node project-stats.js [options]
 * 
 * Options:
 *   --since=<date>       Only include commits since date (e.g. "1 week ago", "2023-01-01")
 *   --until=<date>       Only include commits until date
 *   --author=<pattern>   Only include commits from specific author(s)
 *   --format=text|json   Output format (default: text)
 *   --output=<file>      Write output to file instead of stdout
 *   --verbose            Show detailed output
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  since: null,
  until: null,
  author: null,
  format: 'text',
  output: null,
  verbose: args.includes('--verbose')
};

// Extract options
const sinceArg = args.find(arg => arg.startsWith('--since='));
if (sinceArg) {
  options.since = sinceArg.split('=')[1];
}

const untilArg = args.find(arg => arg.startsWith('--until='));
if (untilArg) {
  options.until = untilArg.split('=')[1];
}

const authorArg = args.find(arg => arg.startsWith('--author='));
if (authorArg) {
  options.author = authorArg.split('=')[1];
}

const formatArg = args.find(arg => arg.startsWith('--format='));
if (formatArg) {
  const format = formatArg.split('=')[1];
  if (['text', 'json'].includes(format)) {
    options.format = format;
  }
}

const outputArg = args.find(arg => arg.startsWith('--output='));
if (outputArg) {
  options.output = outputArg.split('=')[1];
}

/**
 * Format a date for display
 * @param {Date} date Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get repository basic information
 * @returns {Object} Repository info
 */
function getRepositoryInfo() {
  try {
    const remoteOriginUrl = execSync('git config --get remote.origin.url').toString().trim();
    const defaultBranch = execSync('git remote show origin | grep "HEAD branch" | cut -d: -f2').toString().trim();
    const repoRoot = execSync('git rev-parse --show-toplevel').toString().trim();
    const repoName = path.basename(repoRoot);
    
    return {
      name: repoName,
      root: repoRoot,
      remoteUrl: remoteOriginUrl,
      defaultBranch: defaultBranch
    };
  } catch (error) {
    return {
      name: 'Unknown',
      root: process.cwd(),
      remoteUrl: 'Unknown',
      defaultBranch: 'main'
    };
  }
}

/**
 * Get commit history stats
 * @returns {Object} Commit stats
 */
function getCommitStats() {
  try {
    let gitCommand = 'git log --pretty=format:"%H|%an|%ae|%at|%s"';
    
    // Add date filters
    if (options.since) {
      gitCommand += ` --since="${options.since}"`;
    }
    
    if (options.until) {
      gitCommand += ` --until="${options.until}"`;
    }
    
    // Add author filter
    if (options.author) {
      gitCommand += ` --author="${options.author}"`;
    }
    
    if (options.verbose) {
      console.log(`Executing: ${gitCommand}`);
    }
    
    const output = execSync(gitCommand).toString().trim();
    
    if (!output) {
      return {
        totalCommits: 0,
        authors: [],
        firstCommitDate: null,
        lastCommitDate: null,
        commitsByDate: {},
        commitsByAuthor: {},
        topFiles: []
      };
    }
    
    // Parse commit log
    const commits = output.split('\n').map(line => {
      const [hash, author, email, timestamp, subject] = line.split('|');
      return { 
        hash, 
        author, 
        email, 
        timestamp: parseInt(timestamp, 10),
        date: new Date(parseInt(timestamp, 10) * 1000),
        subject
      };
    });
    
    // Process statistics
    const authors = new Set();
    const commitsByDate = {};
    const commitsByAuthor = {};
    
    // Get first and last commit dates
    const timestamps = commits.map(c => c.timestamp);
    const firstCommitDate = new Date(Math.min(...timestamps) * 1000);
    const lastCommitDate = new Date(Math.max(...timestamps) * 1000);
    
    // Group commits by date and author
    commits.forEach(commit => {
      const dateStr = formatDate(commit.date);
      const authorName = commit.author;
      
      authors.add(authorName);
      
      // Group by date
      if (!commitsByDate[dateStr]) {
        commitsByDate[dateStr] = [];
      }
      commitsByDate[dateStr].push(commit);
      
      // Group by author
      if (!commitsByAuthor[authorName]) {
        commitsByAuthor[authorName] = [];
      }
      commitsByAuthor[authorName].push(commit);
    });
    
    // Get file stats
    let fileStats = [];
    try {
      const fileStatsCommand = 'git log --pretty=format: --name-only | sort | uniq -c | sort -rn | head -n 20';
      const fileStatsOutput = execSync(fileStatsCommand).toString().trim();
      
      fileStats = fileStatsOutput.split('\n')
        .map(line => {
          const match = line.trim().match(/^\s*(\d+)\s+(.+)$/);
          if (match) {
            return {
              count: parseInt(match[1], 10),
              file: match[2]
            };
          }
          return null;
        })
        .filter(Boolean);
    } catch (error) {
      fileStats = [];
    }
    
    return {
      totalCommits: commits.length,
      authors: Array.from(authors),
      authorCount: authors.size,
      firstCommitDate,
      lastCommitDate,
      commitsByDate,
      commitsByAuthor,
      topFiles: fileStats
    };
  } catch (error) {
    console.error(`Error getting commit stats: ${error.message}`);
    return {
      totalCommits: 0,
      authors: [],
      firstCommitDate: null,
      lastCommitDate: null,
      commitsByDate: {},
      commitsByAuthor: {},
      topFiles: []
    };
  }
}

/**
 * Get code size statistics
 * @returns {Object} Code size stats
 */
function getCodeSizeStats() {
  try {
    const stats = {
      totalLines: 0,
      totalFiles: 0,
      byLanguage: {}
    };
    
    // Count files by extension
    const filesCommand = 'find . -type f -not -path "*/\\.*" -not -path "*/node_modules/*" | grep -v "package-lock.json" | sort';
    const filesOutput = execSync(filesCommand).toString().trim();
    
    if (!filesOutput) {
      return stats;
    }
    
    const files = filesOutput.split('\n');
    stats.totalFiles = files.length;
    
    // Categorize files by language/extension
    files.forEach(file => {
      const ext = path.extname(file).toLowerCase() || 'unknown';
      
      if (!stats.byLanguage[ext]) {
        stats.byLanguage[ext] = {
          extension: ext,
          files: 0,
          lines: 0
        };
      }
      
      stats.byLanguage[ext].files++;
      
      // Count lines if the file is a text file
      try {
        // Skip binary files, large files, and node_modules
        if (!file.match(/\.(jpg|jpeg|png|gif|zip|tar|gz|bin|exe|dll|so|o)$/) && 
            !file.includes('node_modules/') && 
            fs.statSync(file).size < 1024 * 1024) {
          
          const wc = execSync(`wc -l "${file}"`).toString().trim();
          const lines = parseInt(wc.split(' ')[0], 10);
          
          if (!isNaN(lines)) {
            stats.totalLines += lines;
            stats.byLanguage[ext].lines += lines;
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    });
    
    return stats;
  } catch (error) {
    console.error(`Error getting code size stats: ${error.message}`);
    return {
      totalLines: 0,
      totalFiles: 0,
      byLanguage: {}
    };
  }
}

/**
 * Get branch statistics
 * @returns {Object} Branch stats
 */
function getBranchStats() {
  try {
    const branchesCommand = 'git branch -a';
    const branchesOutput = execSync(branchesCommand).toString().trim();
    
    const branches = branchesOutput.split('\n')
      .map(b => b.trim().replace(/^\*\s+/, ''))
      .filter(b => !b.includes('HEAD'));
    
    const localBranches = branches.filter(b => !b.includes('remotes/'));
    const remoteBranches = branches.filter(b => b.includes('remotes/'))
      .map(b => b.replace('remotes/', ''));
    
    // Get active branches (with commits in the last 2 weeks)
    let activeBranches = [];
    try {
      const activeBranchesCommand = 'git for-each-ref --sort=-committerdate refs/heads/ --format="%(refname:short)|%(committerdate:relative)"';
      const activeBranchesOutput = execSync(activeBranchesCommand).toString().trim();
      
      activeBranches = activeBranchesOutput.split('\n')
        .map(line => {
          const [branch, lastCommit] = line.split('|');
          return { branch, lastCommit };
        })
        .filter(b => b.lastCommit.includes('day') || b.lastCommit.includes('hour') || b.lastCommit.includes('minute'));
    } catch (error) {
      activeBranches = [];
    }
    
    return {
      totalBranches: branches.length,
      localBranches: localBranches.length,
      remoteBranches: remoteBranches.length,
      activeBranches
    };
  } catch (error) {
    console.error(`Error getting branch stats: ${error.message}`);
    return {
      totalBranches: 0,
      localBranches: 0,
      remoteBranches: 0,
      activeBranches: []
    };
  }
}

/**
 * Generate contribution calendar data
 * @param {Object} commitStats Commit statistics
 * @returns {Array} Calendar data
 */
function generateContributionCalendar(commitStats) {
  const { commitsByDate } = commitStats;
  
  // Sort dates
  const dates = Object.keys(commitsByDate).sort();
  
  if (dates.length === 0) {
    return [];
  }
  
  // Fill in missing dates
  const calendar = [];
  const startDate = new Date(dates[0]);
  const endDate = new Date(dates[dates.length - 1]);
  
  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const dateStr = formatDate(date);
    const commits = commitsByDate[dateStr] || [];
    
    calendar.push({
      date: dateStr,
      count: commits.length,
      day: date.getDay(), // 0 = Sunday, 6 = Saturday
      week: Math.floor((date - startDate) / (7 * 24 * 60 * 60 * 1000))
    });
  }
  
  return calendar;
}

/**
 * Format statistics for output
 * @param {Object} stats Collected statistics
 * @returns {string|Object} Formatted output
 */
function formatOutput(stats) {
  if (options.format === 'json') {
    return JSON.stringify(stats, null, 2);
  }
  
  // Text format
  let output = '';
  
  // Repository info
  output += '===== Git Repository Statistics =====\n\n';
  output += `Repository: ${stats.repository.name}\n`;
  output += `Remote URL: ${stats.repository.remoteUrl}\n`;
  output += `Default Branch: ${stats.repository.defaultBranch}\n\n`;
  
  // Commit stats
  output += '--- Commit Statistics ---\n\n';
  output += `Total Commits: ${stats.commits.totalCommits}\n`;
  output += `First Commit: ${stats.commits.firstCommitDate ? formatDate(stats.commits.firstCommitDate) : 'N/A'}\n`;
  output += `Latest Commit: ${stats.commits.lastCommitDate ? formatDate(stats.commits.lastCommitDate) : 'N/A'}\n`;
  output += `Contributors: ${stats.commits.authorCount}\n\n`;
  
  // Top contributors
  output += '--- Top Contributors ---\n\n';
  
  const topContributors = Object.entries(stats.commits.commitsByAuthor)
    .map(([author, commits]) => ({ author, count: commits.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
    
  topContributors.forEach((contributor, index) => {
    output += `${index + 1}. ${contributor.author}: ${contributor.count} commits\n`;
  });
  output += '\n';
  
  // Most active files
  output += '--- Most Active Files ---\n\n';
  
  stats.commits.topFiles.slice(0, 10).forEach((file, index) => {
    output += `${index + 1}. ${file.file}: ${file.count} changes\n`;
  });
  output += '\n';
  
  // Code size stats
  output += '--- Code Size Statistics ---\n\n';
  output += `Total Files: ${stats.codeSize.totalFiles}\n`;
  output += `Total Lines: ${stats.codeSize.totalLines}\n\n`;
  
  // Top languages
  output += '--- Languages ---\n\n';
  
  const topLanguages = Object.values(stats.codeSize.byLanguage)
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10);
    
  topLanguages.forEach(lang => {
    const ext = lang.extension === 'unknown' ? 'No extension' : lang.extension;
    output += `${ext}: ${lang.files} files, ${lang.lines} lines\n`;
  });
  output += '\n';
  
  // Branch stats
  output += '--- Branch Statistics ---\n\n';
  output += `Total Branches: ${stats.branches.totalBranches}\n`;
  output += `Local Branches: ${stats.branches.localBranches}\n`;
  output += `Remote Branches: ${stats.branches.remoteBranches}\n\n`;
  
  // Active branches
  output += '--- Recently Active Branches ---\n\n';
  
  stats.branches.activeBranches.slice(0, 10).forEach(branch => {
    output += `${branch.branch}: ${branch.lastCommit}\n`;
  });
  output += '\n';
  
  // Contribution calendar (simplified ASCII version)
  output += '--- Contribution Activity ---\n\n';
  
  // Group contributions by week for a simple ASCII calendar
  const calendar = stats.calendar;
  
  if (calendar.length > 0) {
    // Get min/max commits for normalization
    const counts = calendar.map(day => day.count);
    const maxCount = Math.max(...counts);
    
    // Week headers
    output += '    ';
    for (let i = 0; i <= 6; i++) {
      output += ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i] + ' ';
    }
    output += '\n';
    
    // Calendar grid
    const weeks = Math.max(...calendar.map(day => day.week)) + 1;
    
    for (let week = 0; week < weeks; week++) {
      output += week.toString().padStart(2, '0') + ': ';
      
      for (let day = 0; day < 7; day++) {
        const dayEntry = calendar.find(d => d.week === week && d.day === day);
        
        if (!dayEntry) {
          output += '  ';
          continue;
        }
        
        // ASCII representation of commit activity
        let intensity = '·';
        if (dayEntry.count > 0) {
          const normalized = dayEntry.count / maxCount;
          if (normalized > 0.75) intensity = '█';
          else if (normalized > 0.5) intensity = '▓';
          else if (normalized > 0.25) intensity = '▒';
          else intensity = '░';
        }
        
        output += intensity + ' ';
      }
      output += '\n';
    }
    
    output += '\nLegend: · None  ░ Low  ▒ Medium  ▓ High  █ Very High\n\n';
  } else {
    output += 'No contribution data available for the selected time period.\n\n';
  }
  
  return output;
}

/**
 * Main execution function
 */
function main() {
  try {
    console.log('Generating git repository statistics...');
    
    // Collect all stats
    const stats = {
      repository: getRepositoryInfo(),
      commits: getCommitStats(),
      codeSize: getCodeSizeStats(),
      branches: getBranchStats()
    };
    
    // Generate contribution calendar
    stats.calendar = generateContributionCalendar(stats.commits);
    
    // Format output
    const output = formatOutput(stats);
    
    // Write output
    if (options.output) {
      fs.writeFileSync(options.output, output);
      console.log(`Statistics written to ${options.output}`);
    } else {
      console.log(output);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();