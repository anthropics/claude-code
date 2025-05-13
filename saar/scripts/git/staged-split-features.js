#!/usr/bin/env node

/**
 * Split staged changes into feature-based commits
 * 
 * Analyzes staged changes and intelligently groups them into separate commits
 * based on file paths, patterns, and code relationships.
 * 
 * Usage:
 *   node staged-split-features.js [options]
 * 
 * Options:
 *   --analyze         Only analyze and suggest splits without committing
 *   --auto            Automatically commit without confirmation
 *   --max-groups=N    Maximum number of feature groups to create (default: 5)
 *   --strategy=path|content|hybrid  Grouping strategy (default: hybrid)
 *   --verbose         Show detailed analysis
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

// Import helpers if they exist
let CodeAnalyzer;
let CommitMessageGenerator;
try {
  CodeAnalyzer = require('./utils/code-analyzer');
  CommitMessageGenerator = require('./utils/commit-message-generator');
} catch (error) {
  // Continue without advanced helpers
}

// CLI argument parsing
const args = process.argv.slice(2);
const options = {
  analyze: args.includes('--analyze'),
  auto: args.includes('--auto'),
  verbose: args.includes('--verbose'),
  maxGroups: 5,
  strategy: 'hybrid'
};

// Parse max groups option
const maxGroupsArg = args.find(arg => arg.startsWith('--max-groups='));
if (maxGroupsArg) {
  const value = maxGroupsArg.split('=')[1];
  options.maxGroups = parseInt(value, 10) || 5;
}

// Parse strategy option
const strategyArg = args.find(arg => arg.startsWith('--strategy='));
if (strategyArg) {
  const value = strategyArg.split('=')[1];
  if (['path', 'content', 'hybrid'].includes(value)) {
    options.strategy = value;
  }
}

// Create readline interface for user prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Get staged files and their diffs
 * @returns {Array} Array of objects with file info
 */
function getStagedFiles() {
  // Get list of staged files
  const stagedFilesRaw = execSync('git diff --name-only --cached').toString().trim();
  
  if (!stagedFilesRaw) {
    console.error('No staged changes found');
    process.exit(1);
  }
  
  const stagedFiles = stagedFilesRaw.split('\n');
  
  return stagedFiles.map(file => {
    // Get diff for each file
    const diffRaw = execSync(`git diff --cached -- "${file}"`).toString();
    const diffStats = execSync(`git diff --cached --stat -- "${file}"`).toString();
    
    // Get file type based on extension
    const extension = path.extname(file).toLowerCase();
    
    // Determine if file is new, modified, or deleted
    const status = execSync(`git status --porcelain -- "${file}"`).toString().trim().slice(0, 2).trim();
    
    return {
      path: file,
      diff: diffRaw,
      stats: diffStats,
      extension,
      status,
      features: [] // Will be populated during analysis
    };
  });
}

/**
 * Analyze file paths to extract potential feature identifiers
 * @param {Array} files Array of file objects
 * @returns {Object} Map of features to files
 */
function analyzeFilePaths(files) {
  const features = {};
  
  // Common directory groupings that likely represent features
  const featureDirs = [
    'core',
    'api',
    'mcp',
    'rag',
    'config',
    'security',
    'logging',
    'dashboard',
    'ui',
    'docs'
  ];
  
  files.forEach(file => {
    const filePath = file.path;
    const pathParts = filePath.split('/');
    
    // Group by top-level directory
    const topDir = pathParts[0];
    if (topDir) {
      features[topDir] = features[topDir] || [];
      features[topDir].push(file);
    }
    
    // Look for known feature directories at any level
    featureDirs.forEach(featureDir => {
      if (pathParts.includes(featureDir)) {
        // Create feature key with path context
        const featureIndex = pathParts.indexOf(featureDir);
        const featureKey = pathParts.slice(0, featureIndex + 1).join('/');
        features[featureKey] = features[featureKey] || [];
        features[featureKey].push(file);
      }
    });
    
    // Add categories for file types
    const extension = file.extension.replace('.', '');
    if (extension) {
      const fileTypeFeature = `file-type/${extension}`;
      features[fileTypeFeature] = features[fileTypeFeature] || [];
      features[fileTypeFeature].push(file);
    }
  });
  
  return features;
}

/**
 * Analyze diff content to extract potential feature identifiers
 * @param {Array} files Array of file objects
 * @returns {Object} Map of features to files
 */
function analyzeFileContent(files) {
  // Use the advanced code analyzer if available
  if (CodeAnalyzer) {
    try {
      if (options.verbose) {
        console.log('Using advanced code analyzer...');
      }

      const analyzer = new CodeAnalyzer();

      // Try to build dependency graph from repository
      try {
        analyzer.buildDependencyGraph(process.cwd());
      } catch (e) {
        // Continue without full dependency analysis
      }

      // Get file paths
      const filePaths = files.map(file => file.path);

      // Find relationships between files
      let featureRelationships = {};

      try {
        featureRelationships = analyzer.analyzeFeatureRelationships(filePaths);
      } catch (e) {
        // Fall back to simple feature detection
      }

      // Convert relationships to expected format
      const features = {};
      Object.entries(featureRelationships).forEach(([feature, relatedFiles]) => {
        features[`content/${feature}`] = relatedFiles.map(
          filePath => files.find(f => f.path === filePath)
        ).filter(Boolean);
      });

      // If we found features, return them, otherwise fall back to basic analysis
      if (Object.keys(features).length > 0) {
        return features;
      }
    } catch (e) {
      // Fall back to basic analysis
      if (options.verbose) {
        console.log('Advanced analysis failed, falling back to basic analysis');
      }
    }
  }

  // Basic analysis fallback
  const features = {};

  // Common terms that might indicate features
  const featureTerms = [
    'config', 'configuration',
    'log', 'logger', 'logging',
    'security', 'auth', 'authentication',
    'api', 'endpoint',
    'mcp', 'model', 'context', 'protocol',
    'rag', 'retrieval', 'generation',
    'test', 'spec',
    'interface', 'ui', 'dashboard',
    'error', 'exception',
    'i18n', 'internationalization',
    'database', 'storage',
    'backup', 'recovery'
  ];

  files.forEach(file => {
    const diffContent = file.diff.toLowerCase();

    // Check for feature terms in diff
    featureTerms.forEach(term => {
      if (diffContent.includes(term)) {
        const featureKey = `content/${term}`;
        features[featureKey] = features[featureKey] || [];
        features[featureKey].push(file);
      }
    });

    // Look for function or class definitions
    const functionMatches = diffContent.match(/function\s+(\w+)/g) || [];
    functionMatches.forEach(match => {
      const funcName = match.replace('function', '').trim();
      const featureKey = `function/${funcName}`;
      features[featureKey] = features[featureKey] || [];
      features[featureKey].push(file);
    });

    const classMatches = diffContent.match(/class\s+(\w+)/g) || [];
    classMatches.forEach(match => {
      const className = match.replace('class', '').trim();
      const featureKey = `class/${className}`;
      features[featureKey] = features[featureKey] || [];
      features[featureKey].push(file);
    });
  });

  return features;
}

/**
 * Group files into feature categories
 * @param {Array} files Array of file objects
 * @returns {Array} Array of feature groups
 */
function groupFilesByFeature(files) {
  // Extract features from file paths and content
  let features = {};
  
  if (options.strategy === 'path' || options.strategy === 'hybrid') {
    features = { ...features, ...analyzeFilePaths(files) };
  }
  
  if (options.strategy === 'content' || options.strategy === 'hybrid') {
    features = { ...features, ...analyzeFileContent(files) };
  }
  
  // Score feature groups based on coherence and size
  const scoredFeatures = Object.entries(features).map(([featureName, featureFiles]) => {
    // Calculate score based on:
    // - Number of files (more files = higher score)
    // - Coherence (paths have common elements)
    // - Feature specificity (prefer more specific groupings)
    
    const fileCount = featureFiles.length;
    
    // Coherence score based on path similarity
    let coherenceScore = 0;
    if (featureFiles.length > 1) {
      // Calculate path similarity
      const paths = featureFiles.map(f => f.path.split('/'));
      const minDepth = Math.min(...paths.map(p => p.length));
      
      // Score based on common path elements
      for (let i = 0; i < minDepth; i++) {
        const pathPart = paths[0][i];
        if (paths.every(p => p[i] === pathPart)) {
          coherenceScore += 1;
        } else {
          break;
        }
      }
    }
    
    // Specificity score (favor more specific groupings)
    const specificityScore = featureName.split('/').length;
    
    // Coverage score (percentage of total files)
    const coverageScore = fileCount / files.length;
    
    // Calculate total score
    const totalScore = (fileCount * 0.4) + (coherenceScore * 0.3) + (specificityScore * 0.2) + (coverageScore * 0.1);
    
    return {
      name: featureName,
      files: featureFiles,
      score: totalScore
    };
  });
  
  // Sort by score (descending)
  scoredFeatures.sort((a, b) => b.score - a.score);
  
  // Select top features within max group limit
  const topFeatures = scoredFeatures.slice(0, options.maxGroups);
  
  // Handle overlapping files - assign each file to its highest-scoring feature
  const fileAssignments = {};
  
  files.forEach(file => {
    let highestScore = -1;
    let bestFeature = null;
    
    topFeatures.forEach(feature => {
      if (feature.files.includes(file) && feature.score > highestScore) {
        highestScore = feature.score;
        bestFeature = feature.name;
      }
    });
    
    if (bestFeature) {
      fileAssignments[file.path] = bestFeature;
    }
  });
  
  // Create final feature groups with unique file assignments
  const finalGroups = {};
  
  Object.entries(fileAssignments).forEach(([filePath, featureName]) => {
    finalGroups[featureName] = finalGroups[featureName] || [];
    const file = files.find(f => f.path === filePath);
    finalGroups[featureName].push(file);
  });
  
  // Check for unassigned files and create misc group if needed
  const assignedFiles = new Set(Object.keys(fileAssignments));
  const unassignedFiles = files.filter(file => !assignedFiles.has(file.path));
  
  if (unassignedFiles.length > 0) {
    finalGroups['misc'] = unassignedFiles;
  }
  
  // Convert to array format and generate commit messages
  return Object.entries(finalGroups).map(([featureName, groupFiles]) => {
    // Generate sensible commit message
    let commitMessage;

    // Use advanced commit message generator if available
    if (CommitMessageGenerator) {
      const generator = new CommitMessageGenerator();
      commitMessage = generator.generateCommitMessage({
        name: featureName,
        files: groupFiles
      });
    } else {
      commitMessage = cleanupFeatureName(featureName);

      // Add operation prefix based on file statuses
      const allNew = groupFiles.every(file => file.status === 'A');
      const allModified = groupFiles.every(file => file.status === 'M');
      const allDeleted = groupFiles.every(file => file.status === 'D');

      if (allNew) {
        commitMessage = `feat: Add ${commitMessage}`;
      } else if (allModified) {
        commitMessage = `fix: Update ${commitMessage}`;
      } else if (allDeleted) {
        commitMessage = `refactor: Remove ${commitMessage}`;
      } else {
        commitMessage = `chore: Update ${commitMessage}`;
      }
    }
    
    return {
      name: featureName,
      files: groupFiles,
      commitMessage
    };
  });
}

/**
 * Clean up feature name for commit message
 * @param {string} featureName Raw feature name
 * @returns {string} Cleaned up feature name
 */
function cleanupFeatureName(featureName) {
  // Remove prefix patterns
  let cleaned = featureName
    .replace(/^content\//, '')
    .replace(/^file-type\//, '')
    .replace(/^function\//, '')
    .replace(/^class\//, '');
  
  // Replace slashes with spaces
  cleaned = cleaned.replace(/\//g, ' ');
  
  // Convert to sentence case
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  
  return cleaned;
}

/**
 * Create commit for a feature group
 * @param {Object} group Feature group
 * @returns {boolean} Success status
 */
function commitFeatureGroup(group) {
  try {
    // First unstage everything
    execSync('git reset HEAD .');
    
    // Stage only files for this feature
    group.files.forEach(file => {
      execSync(`git add "${file.path}"`);
    });
    
    // Create commit
    const commitCommand = `git commit -m "${group.commitMessage}"`;
    execSync(commitCommand);
    
    console.log(`✅ Created commit: ${group.commitMessage}`);
    console.log(`   Files: ${group.files.map(f => f.path).join(', ')}`);
    console.log();
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to create commit: ${error.message}`);
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Get staged files
    const stagedFiles = getStagedFiles();
    console.log(`Found ${stagedFiles.length} staged files\n`);
    
    // Group files by feature
    const featureGroups = groupFilesByFeature(stagedFiles);
    
    console.log('Suggested feature groupings:');
    console.log('---------------------------');
    
    featureGroups.forEach((group, index) => {
      console.log(`Group ${index + 1}: ${group.commitMessage}`);
      
      group.files.forEach(file => {
        console.log(`  - ${file.path}`);
      });
      
      if (options.verbose) {
        console.log('  Details:');
        console.log(`  Feature Name: ${group.name}`);
        console.log(`  Files: ${group.files.length}`);
      }
      
      console.log();
    });
    
    // If analyze-only mode, exit here
    if (options.analyze) {
      console.log('Analysis complete. Use without --analyze to create commits.');
      rl.close();
      return;
    }
    
    // Confirm or auto-commit
    if (options.auto) {
      console.log('Auto-commit enabled, creating commits...\n');
      
      let success = true;
      for (const group of featureGroups) {
        const result = commitFeatureGroup(group);
        if (!result) success = false;
      }
      
      if (success) {
        console.log('All feature commits created successfully!');
      } else {
        console.error('Some commits failed. See errors above.');
      }
      
      rl.close();
    } else {
      rl.question('Create feature-based commits? (y/n): ', async (answer) => {
        if (answer.toLowerCase() === 'y') {
          console.log('Creating commits...\n');
          
          for (const group of featureGroups) {
            await new Promise(resolve => {
              rl.question(`Create commit "${group.commitMessage}"? (y/n/e-edit): `, async (groupAnswer) => {
                if (groupAnswer.toLowerCase() === 'y') {
                  commitFeatureGroup(group);
                  resolve();
                } else if (groupAnswer.toLowerCase() === 'e') {
                  rl.question('Enter new commit message: ', (newMessage) => {
                    group.commitMessage = newMessage;
                    commitFeatureGroup(group);
                    resolve();
                  });
                } else {
                  console.log('Skipping this group');
                  resolve();
                }
              });
            });
          }
          
          console.log('Feature commit process completed');
        } else {
          console.log('Operation cancelled');
        }
        
        rl.close();
      });
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

// Run the script
main();