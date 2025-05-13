#!/usr/bin/env node

/**
 * Import Path Updater
 * 
 * This script scans TypeScript and JavaScript files in the codebase
 * and updates relative import paths to use aliases.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const { exec } = require('child_process');

// Path mappings from old relative paths to new alias paths
const IMPORT_MAPPINGS = [
  { 
    // Map deep lib imports from core
    regex: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/core\/src\/([^'"]+)['"]/g,
    replacement: 'from "@core/$1"'
  },
  { 
    // Map deep lib imports from mcp
    regex: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/mcp\/src\/([^'"]+)['"]/g,
    replacement: 'from "@mcp/$1"'
  },
  { 
    // Map deep lib imports from agents
    regex: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/agents\/src\/([^'"]+)['"]/g,
    replacement: 'from "@agents/$1"'
  },
  { 
    // Map deep lib imports from rag
    regex: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/rag\/src\/([^'"]+)['"]/g,
    replacement: 'from "@rag/$1"'
  },
  { 
    // Map deep lib imports from workflows
    regex: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/workflows\/src\/([^'"]+)['"]/g,
    replacement: 'from "@workflows/$1"'
  },
  { 
    // Map deep lib imports from shared
    regex: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/shared\/src\/([^'"]+)['"]/g,
    replacement: 'from "@shared/$1"'
  },
  { 
    // Map configs imports
    regex: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/configs\/([^'"]+)['"]/g,
    replacement: 'from "@configs/$1"'
  },
  {
    // Map relative imports within lib but keep the hierarchy
    regex: /from ['"]\.\.\/([^'"]+)['"]/g,
    replacement: 'from "./$1"'
  }
];

// Function to process a single file
async function processFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    let updatedContent = content;
    let hasChanges = false;

    // Apply import mappings
    for (const mapping of IMPORT_MAPPINGS) {
      const originalContent = updatedContent;
      updatedContent = updatedContent.replace(mapping.regex, mapping.replacement);
      
      if (originalContent !== updatedContent) {
        hasChanges = true;
      }
    }

    // Only write to file if changes were made
    if (hasChanges) {
      await writeFile(filePath, updatedContent, 'utf8');
      console.log(`Updated imports in: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

// Find all TypeScript and JavaScript files in the project
function findTsAndJsFiles(directory) {
  return new Promise((resolve, reject) => {
    exec(
      `find ${directory} -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v "node_modules" | grep -v "dist"`,
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        
        const files = stdout.trim().split('\n').filter(Boolean);
        resolve(files);
      }
    );
  });
}

// Main execution
async function main() {
  const rootDir = process.argv[2] || path.resolve(__dirname, '../../..');
  console.log(`Updating imports in ${rootDir}...`);

  try {
    const files = await findTsAndJsFiles(rootDir);
    console.log(`Found ${files.length} TypeScript/JavaScript files`);

    let updatedFileCount = 0;

    for (const file of files) {
      const wasUpdated = await processFile(file);
      if (wasUpdated) {
        updatedFileCount++;
      }
    }

    console.log(`\nImport paths updated in ${updatedFileCount} files`);
  } catch (error) {
    console.error('Error updating imports:', error);
    process.exit(1);
  }
}

main();