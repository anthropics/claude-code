# Git Agent Documentation

This documentation provides comprehensive information about the Git Agent implementation in the Claude Neural Framework, including the Agent-to-Agent (A2A) protocol integration and color schema support.

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Integration with Color Schema](#integration-with-color-schema)
- [A2A Protocol](#a2a-protocol)
- [Git Agent API](#git-agent-api)
- [Setup and Configuration](#setup-and-configuration)
- [CLI Usage](#cli-usage)
- [Examples](#examples)
- [Security Considerations](#security-considerations)

## Overview

The Git Agent provides Git version control functionality through the Agent-to-Agent (A2A) protocol in the Claude Neural Framework. It enables users to perform common Git operations with consistent color schema styling across the framework.

Key features:
- Integration with the A2A protocol for agent-based communication
- Support for all common Git operations (status, commit, pull, push, etc.)
- Automatic color schema application based on the user's `.about` profile
- Multiple interfaces for usage (direct CLI, A2A, SAAR)

## Architecture

The Git Agent implementation consists of the following components:

```
Claude Neural Framework
├── agents/commands/
│   ├── git_agent.md           # Command documentation
│   └── agent_to_agent.md      # A2A protocol documentation
├── core/mcp/
│   ├── git_agent.js           # Git agent implementation
│   └── a2a_manager.js         # A2A protocol manager
└── scripts/setup/
    └── setup_git_agent.js     # Setup script
```

### Component Relationships

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ User/Client │─────▶ A2A Manager │─────▶  Git Agent  │
└─────────────┘     └─────────────┘     └─────────┬───┘
                                                  │
                                         ┌────────▼────────┐
                                         │ Color Schema    │
                                         │ Manager         │
                                         └────────┬────────┘
                                                  │
                                         ┌────────▼────────┐
                                         │ Git Command     │
                                         │ Execution       │
                                         └─────────────────┘
```

## Integration with Color Schema

The Git Agent integrates with the Color Schema system to provide consistently styled output for Git commands. The integration works as follows:

1. **Schema Loading**: The agent loads the user's color schema from their `.about` profile
2. **Output Formatting**: Git command output is formatted with appropriate colors based on the schema
3. **Consistency**: This ensures all Git-related output matches the user's preferred visual style

### Color Schema Application

The Git Agent applies different colors from the schema to various parts of Git output:

| Git Element | Color Schema Property |
|-------------|----------------------|
| Modified files | `warning` |
| New files | `success` |
| Deleted files | `danger` |
| Branch status | `primary` |
| Commit messages | `primary` |
| Untracked files | `secondary` |

## A2A Protocol

The A2A (Agent-to-Agent) protocol facilitates communication between agents in the Claude Neural Framework. For Git operations, the protocol uses the following message format:

### Request Message

```json
{
  "from": "user-agent",
  "to": "git-agent",
  "task": "git-operation",
  "params": {
    "operation": "status",
    "branch": "main",
    "message": "Commit message",
    "all": true,
    "color_schema": {
      "primary": "#3f51b5",
      "secondary": "#7986cb"
    }
  },
  "conversationId": "git-session-123456"
}
```

### Response Message

```json
{
  "to": "user-agent",
  "from": "git-agent",
  "conversationId": "git-session-123456",
  "task": "git-response",
  "params": {
    "status": "success",
    "command": "git status",
    "output": "On branch main\nChanges not staged for commit...",
    "color_schema": {
      "primary": "#3f51b5",
      "secondary": "#7986cb"
    }
  }
}
```

## Git Agent API

The Git Agent provides the following operations:

### status

Shows the current working tree status.

**Parameters**: None

**Example**:
```json
{
  "operation": "status"
}
```

### commit

Commits changes to the repository.

**Parameters**:
- `message`: Commit message (required)
- `all`: Whether to stage all changes before committing (default: false)

**Example**:
```json
{
  "operation": "commit",
  "message": "Add new feature",
  "all": true
}
```

### pull

Pulls changes from the remote repository.

**Parameters**:
- `branch`: Branch to pull from (optional)

**Example**:
```json
{
  "operation": "pull",
  "branch": "main"
}
```

### push

Pushes changes to the remote repository.

**Parameters**:
- `branch`: Branch to push to (optional)

**Example**:
```json
{
  "operation": "push",
  "branch": "feature/new-feature"
}
```

### log

Shows commit history.

**Parameters**:
- `limit`: Number of commits to show (optional)

**Example**:
```json
{
  "operation": "log",
  "limit": 5
}
```

### branch

Lists or creates branches.

**Parameters**:
- `name`: Name of the branch to create (optional)

**Example**:
```json
{
  "operation": "branch",
  "name": "feature/new-feature"
}
```

### checkout

Switches branches.

**Parameters**:
- `branch`: Branch to check out (required)

**Example**:
```json
{
  "operation": "checkout",
  "branch": "feature/new-feature"
}
```

### diff

Shows changes between commits, commit and working tree, etc.

**Parameters**:
- `file`: File to show changes for (optional)

**Example**:
```json
{
  "operation": "diff",
  "file": "path/to/file.js"
}
```

## Setup and Configuration

The Git Agent is set up using the setup script:

```bash
node scripts/setup/setup_git_agent.js
```

This script performs the following tasks:
1. Installs required dependencies (chalk, uuid)
2. Creates Git helper scripts
3. Adds Git commands to package.json
4. Integrates with the SAAR script
5. Updates CLAUDE.md with Git command documentation

## CLI Usage

The Git Agent can be used in multiple ways:

### Direct Usage

```bash
node core/mcp/git_agent.js --operation=status
node core/mcp/git_agent.js --operation=commit --message="Commit message" --all=true
```

### A2A Usage

```bash
node core/mcp/a2a_manager.js --to=git-agent --task=git-operation --params='{"operation": "status"}'
```

### SAAR Integration

```bash
./saar.sh git status
./saar.sh git commit "Commit message" --all
```

### NPM Scripts

```bash
npm run git:status
npm run git:commit -- "Commit message" --all
```

## Examples

### Basic Workflow Example

```bash
# Check status
node core/mcp/git_agent.js --operation=status

# Stage and commit changes
node core/mcp/git_agent.js --operation=commit --message="Add new feature" --all=true

# Push changes
node core/mcp/git_agent.js --operation=push
```

### A2A Integration Example

```javascript
const a2aManager = require('./core/mcp/a2a_manager');

async function gitOperation() {
  const message = {
    from: 'my-agent',
    to: 'git-agent',
    task: 'git-operation',
    params: {
      operation: 'status'
    }
  };
  
  const response = await a2aManager.sendMessage(message);
  console.log(response.params.output);
}

gitOperation().catch(console.error);
```

### Custom Color Schema Example

```javascript
const gitAgent = require('./core/mcp/git_agent');

// Create a git agent with custom color schema
const agent = new gitAgent.GitAgent();
agent.colorSchema = {
  name: "Custom",
  colors: {
    primary: "#ff5722",
    secondary: "#ff9800",
    accent: "#ffc107",
    success: "#8bc34a",
    warning: "#ffeb3b",
    danger: "#f44336",
    background: "#212121",
    text: "#ffffff"
  }
};

// Process message with custom schema
const response = agent.processMessage({
  task: 'git-operation',
  params: {
    operation: 'status'
  }
});
```

## Security Considerations

The Git Agent implements the following security measures:

1. **Repository Validation**: Verifies that the current directory is a Git repository before executing commands
2. **Parameter Validation**: Validates all parameters before executing Git commands
3. **Error Handling**: Properly captures and formats errors from Git commands
4. **Permission Boundaries**: Operates within the security constraints defined in the framework configuration

### Security Best Practices

When using the Git Agent:

1. Avoid executing Git commands with user-supplied input without validation
2. Do not use the Git Agent to execute non-Git commands
3. Keep the Git Agent updated with the latest security patches
4. Use the A2A protocol for secure agent-to-agent communication
5. Review Git commands before execution for potentially destructive operations

## Implementation Details

### GitAgent Class

The main `GitAgent` class in `core/mcp/git_agent.js` provides the following methods:

#### Constructor

```javascript
constructor()
```

Initializes the Git Agent, loading the user profile and color schema.

#### processMessage

```javascript
processMessage(message)
```

Processes an A2A message for Git operations, routing to the appropriate method based on the operation parameter.

#### formatOutput

```javascript
formatOutput(output)
```

Formats Git command output with appropriate colors based on the user's color schema.

#### isGitRepository

```javascript
isGitRepository()
```

Checks if the current directory is a Git repository.

### A2AManager Class

The `A2AManager` class in `core/mcp/a2a_manager.js` manages agent-to-agent communication:

#### sendMessage

```javascript
async sendMessage(message)
```

Sends a message to an agent and returns the response.

#### validateMessage

```javascript
validateMessage(message)
```

Validates a message format, ensuring it has required fields.

#### storeMessage

```javascript
storeMessage(message)
```

Stores a message in the conversation history.

---

This documentation provides a comprehensive overview of the Git Agent implementation and its integration with the A2A protocol and color schema system in the Claude Neural Framework. For more specific details on usage, refer to the command documentation in `/agents/commands/git_agent.md`.