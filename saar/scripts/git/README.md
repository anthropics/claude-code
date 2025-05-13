# Git Workflow Utilities

This directory contains utilities for Git workflow automation for the Claude Neural Framework.

## Available Commands

All commands can be run through the main `git-workflow.js` script:

```bash
node scripts/git-workflow.js <command> [args...]
```

### Branch Management

- **feature-start**: Create a new feature branch
  ```bash
  node scripts/git-workflow.js feature-start "Add RAG integration" 123
  ```

- **feature-finish**: Finish current feature branch
  ```bash
  node scripts/git-workflow.js feature-finish
  ```

- **release-start**: Create a new release branch
  ```bash
  node scripts/git-workflow.js release-start 1.2.0
  ```

- **release-finish**: Finish current release branch
  ```bash
  node scripts/git-workflow.js release-finish
  ```

- **hotfix-start**: Create a new hotfix branch
  ```bash
  node scripts/git-workflow.js hotfix-start 1.2.1 "Fix security vulnerability"
  ```

- **hotfix-finish**: Finish current hotfix branch
  ```bash
  node scripts/git-workflow.js hotfix-finish
  ```

### Commit Organization

- **staged-split**: Split staged changes into multiple feature-based commits
  ```bash
  # Analyze only (no commits made)
  node scripts/git-workflow.js staged-split --analyze

  # Split and interactively confirm each commit
  node scripts/git-workflow.js staged-split

  # Split and automatically create commits
  node scripts/git-workflow.js staged-split --auto
  ```

- **issue-cherry-pick**: Cherry-pick commits for a specific issue across branches
  ```bash
  # Find and cherry-pick commits mentioning issue #123
  node scripts/git-workflow.js issue-cherry-pick 123

  # Specify source and target branches
  node scripts/git-workflow.js issue-cherry-pick 123 --from=develop --to=feature/my-branch

  # Just analyze without actually cherry-picking
  node scripts/git-workflow.js issue-cherry-pick 123 --dry-run
  ```

- **commit-lint**: Check and fix commit message formats
  ```bash
  # Analyze recent commits for issues
  node scripts/git-workflow.js commit-lint

  # Fix issues interactively
  node scripts/git-workflow.js commit-lint --fix

  # Analyze a specific branch and number of commits
  node scripts/git-workflow.js commit-lint --branch=feature/test --depth=5
  ```

### Project Analysis

- **project-stats**: Generate repository statistics and visualizations
  ```bash
  # Show basic repository stats
  node scripts/git-workflow.js project-stats

  # Analyze within date range
  node scripts/git-workflow.js project-stats --since="1 month ago" --until="yesterday"

  # Focus on specific author
  node scripts/git-workflow.js project-stats --author="username"

  # Output as JSON for further processing
  node scripts/git-workflow.js project-stats --format=json --output=stats.json
  ```

### Pull Request Management

- **pr**: Comprehensive pull request management
  ```bash
  # List all open PRs
  node scripts/git-workflow.js pr list

  # Checkout a specific PR
  node scripts/git-workflow.js pr checkout 123

  # Create a new PR from current branch
  node scripts/git-workflow.js pr create "PR Title"

  # View PR details
  node scripts/git-workflow.js pr view 123

  # Start reviewing a PR
  node scripts/git-workflow.js pr review 123

  # Show PRs you've authored
  node scripts/git-workflow.js pr status

  # Show PR comments
  node scripts/git-workflow.js pr comments 123

  # Approve a PR
  node scripts/git-workflow.js pr approve 123

  # Merge a PR
  node scripts/git-workflow.js pr merge 123

  # Close a PR
  node scripts/git-workflow.js pr close 123
  ```

## Staged Split Features

The `staged-split` command is a powerful utility that analyzes staged changes and intelligently splits them into multiple feature-based commits. This is particularly useful when you've made changes across multiple features but want to create clean, focused commits.

### How It Works

The tool:

1. Analyzes staged files based on paths, directories, and content
2. Groups changes into logical feature sets
3. Generates appropriate commit messages
4. Creates separate commits for each feature group

### Options

- `--analyze`: Only analyze and suggest splits without committing
- `--auto`: Automatically commit without confirmation
- `--max-groups=N`: Maximum number of feature groups to create (default: 5)
- `--strategy=path|content|hybrid`: Grouping strategy (default: hybrid)
- `--verbose`: Show detailed analysis

### Example Use Cases

- **Mixed Changes**: When you've made changes across multiple features but want to create clean, focused commits
- **Large PRs**: Break down large changes into logical commits before submitting a PR
- **Cleanup**: Organize messy working directories with changes across multiple areas

### Strategies

- **path**: Group files based on directory structure and paths
- **content**: Group files based on the content of changes and internal relationships
- **hybrid**: Use both path and content analysis (default)

### Integration with Other Tools

This utility works seamlessly with the other Git workflow tools:

```bash
# Start a feature branch
node scripts/git-workflow.js feature-start "Add multiple features" 123

# Make changes to multiple features
# Stage all changes

# Split into feature-based commits
node scripts/git-workflow.js staged-split

# Finish the feature branch
node scripts/git-workflow.js feature-finish
```

## Implementation Details

The utilities in this directory implement the Git Flow branching model with additional features tailored to the Claude Neural Framework workflow. Key implementation details:

1. **Branch Naming**: Enforces consistent branch naming (`feature/`, `release/v`, `hotfix/v`)
2. **Commit Messages**: Generates conventional commit messages
3. **Code Analysis**: Identifies related code changes for intelligent grouping
4. **GitHub Integration**: Provides seamless GitHub integration for PR creation
5. **Input Validation**: Validates all user inputs and Git state before operations