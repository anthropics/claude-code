#!/usr/bin/env node

/**
 * Feature branch creation script for Claude Neural Framework
 * 
 * Usage:
 *   node feature-start.js "Feature description" [issue-number]
 * 
 * Example:
 *   node feature-start.js "Add RAG integration" 123
 *   # Creates and checks out feature/123-add-rag-integration
 */

const { execSync } = require('child_process');
const path = require('path');

// Parse command line arguments
const featureDescription = process.argv[2];
const issueNumber = process.argv[3];

if (!featureDescription) {
  console.error('Error: Feature description is required');
  console.log('Usage: node feature-start.js "Feature description" [issue-number]');
  process.exit(1);
}

try {
  // Make sure we're on the develop branch first
  console.log('Checking current branch...');
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  
  if (currentBranch !== 'develop') {
    console.log('Switching to develop branch...');
    execSync('git checkout develop');
    console.log('Pulling latest changes...');
    execSync('git pull origin develop');
  } else {
    console.log('Already on develop branch');
    console.log('Pulling latest changes...');
    execSync('git pull origin develop');
  }
  
  // Create feature branch name
  const kebabDescription = featureDescription
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
    
  const branchName = issueNumber 
    ? `feature/${issueNumber}-${kebabDescription}`
    : `feature/${kebabDescription}`;
  
  // Create and checkout the feature branch
  console.log(`Creating feature branch: ${branchName}`);
  execSync(`git checkout -b ${branchName}`);
  
  console.log('\nFeature branch created successfully!');
  console.log(`You are now working on: ${branchName}\n`);
  console.log('When finished, run: node feature-finish.js');
  
} catch (error) {
  console.error('Error creating feature branch:', error.message);
  process.exit(1);
}