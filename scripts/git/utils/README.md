# Git Workflow Utilities - Advanced Components

This directory contains advanced utility modules used by the Git workflow scripts in the main directory.

## Overview

These utilities provide essential functionality for the main Git workflow scripts, implementing advanced algorithms for code analysis, commit message generation, and more.

### Code Analyzer

`code-analyzer.js` provides intelligent code analysis capabilities:

- Builds a dependency graph of files in a repository
- Identifies import relationships between files
- Groups related files based on code relationships
- Detects potential features through path and content analysis
- Supports multiple programming languages including JavaScript, Python, Ruby, Java, and Go

### Commit Message Generator

`commit-message-generator.js` helps create high-quality commit messages:

- Follows the Conventional Commits standard
- Analyzes file changes to determine appropriate commit type
- Extracts keywords from diffs to create meaningful commit subjects
- Generates proper scopes based on file paths
- Handles special cases like file additions, modifications, and deletions

## Usage

These utilities are designed to be used by the main Git workflow scripts and not to be called directly. They are loaded dynamically when their advanced functionality is needed.

Example usage within a script:

```javascript
// Import helpers if they exist
let CodeAnalyzer;
let CommitMessageGenerator;
try {
  CodeAnalyzer = require('./utils/code-analyzer');
  CommitMessageGenerator = require('./utils/commit-message-generator');
} catch (error) {
  // Continue without advanced helpers
}

// Use the code analyzer if available
if (CodeAnalyzer) {
  const analyzer = new CodeAnalyzer();
  analyzer.buildDependencyGraph(process.cwd());
  const relatedFiles = analyzer.findRelatedFiles([filePath]);
}

// Use the commit message generator if available
if (CommitMessageGenerator) {
  const generator = new CommitMessageGenerator();
  const message = generator.generateCommitMessage({
    name: featureName,
    files: files
  });
}
```

## Extending

To add new utility modules:

1. Create a new JavaScript file in this directory
2. Export a class or functions that provide the utility
3. Import and use the utility in the main workflow scripts

When creating new utilities, follow these guidelines:

- Focus on specific functionality that can be reused across scripts
- Ensure proper error handling and graceful degradation
- Document the API and usage patterns
- Follow the existing coding style and patterns