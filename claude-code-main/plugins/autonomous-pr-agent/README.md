# Autonomous PR Agent Plugin

Intelligent pull request review and auto-merge system that performs comprehensive quality checks and automatically merges high-confidence PRs.

## Overview

The Autonomous PR Agent revolutionizes your development workflow by automatically reviewing PRs across multiple quality dimensions—code style, testing coverage, error handling, security, and architectural coherence. When a PR passes 5+ quality thresholds with high confidence, it auto-merges safely.

## Features

- **Multi-dimensional Code Review**: Analyzes code quality, tests, error handling, type safety, and security
- **Confidence Scoring**: Only auto-merges when confidence exceeds 85% across all checks
- **Human Override**: Developers can always request manual review or block auto-merge
- **Detailed Reports**: Generates comprehensive review reports for learning and audit trails
- **CI/CD Integration**: Works with GitHub Actions, GitLab CI, Jenkins, and other CI systems

## Command: `/pr-autonomous-review`

Analyzes a PR and determines whether it's safe to auto-merge.

**Usage:**
```bash
/pr-autonomous-review
```

When executed in a PR context, the agent will:
1. Analyze code changes across all quality dimensions
2. Calculate confidence scores for each dimension
3. Determine if auto-merge is safe
4. Merge if conditions are met, or request manual review if not

## Quality Dimensions

- **Code Quality**: Complexity, maintainability, readability
- **Test Coverage**: Unit tests, integration tests, coverage percentage
- **Error Handling**: Proper exception handling and edge cases
- **Type Safety**: Type annotations and generic constraints
- **Security**: Vulnerability scanning, auth patterns, data protection
- **Architecture**: Pattern adherence, modularity, design patterns

## Configuration

Set confidence thresholds in your project's Claude Code config:

```json
{
  "autonomous-pr-agent": {
    "minConfidenceThreshold": 0.85,
    "requireAllDimensions": true,
    "autoMergeEnabled": true,
    "allowBypassWithLabel": "force-merge"
  }
}
```
