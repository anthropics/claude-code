# Git Operations Agent

Provides Git version control functionality through the agent-to-agent protocol, allowing integration with the Claude Neural Framework.

## Usage
/git-agent $ARGUMENTS

## Parameters
- operation: Git operation to perform (required: "status", "commit", "pull", "push", "log", "branch", "checkout", "diff")
- message: Commit message when using commit operation (required for commit)
- branch: Branch name for operations that require it (optional)
- file: Specific file to target with the operation (optional)
- all: Whether to include all files in the operation (default: false)
- color_schema: Color schema to use for the output (default: from user profile)

## Example
/git-agent --operation=commit --message="Add new feature" --all=true

## A2A Integration
This command creates a properly formatted A2A message to route to the Git agent:

```json
{
  "from": "user-agent",
  "to": "git-agent",
  "task": "git-operation",
  "params": {
    "operation": "commit",
    "message": "Add new feature",
    "all": true,
    "color_schema": {
      "primary": "#3f51b5",
      "secondary": "#7986cb",
      "accent": "#ff4081"
    }
  },
  "conversationId": "git-session-123456"
}
```

## Git Operations

### status
Shows the current working tree status

### commit
Commits changes to the repository
- Requires --message parameter
- Optional --all flag to commit all changes

### pull
Pulls changes from the remote repository
- Optional --branch parameter to specify branch

### push
Pushes changes to the remote repository
- Optional --branch parameter to specify branch

### log
Shows commit history
- Optional --limit parameter to limit number of entries

### branch
Lists or creates branches
- Optional --name parameter to create new branch

### checkout
Switches branches
- Requires --branch parameter

### diff
Shows changes between commits, commit and working tree, etc.
- Optional --file parameter to show changes for specific file

## Response Format

The Git agent responds with structured data including:
- Status code (success/failure)
- Command executed
- Output from the Git operation
- Error message (if any)
- Visual representation of changes when applicable (using the specified color schema)

## Custom Styling

The output is formatted according to the user's color schema preferences, ensuring consistent visual representation across the framework. The agent automatically retrieves the color schema from the user's .about profile if not explicitly specified.

## Security Notes

The Git agent operates within the security constraints defined in the framework configuration. It will:
- Prompt for confirmation for potentially destructive operations
- Verify branch existence before checkout
- Validate commit messages for formatting requirements
- Check repository status before operations to prevent errors