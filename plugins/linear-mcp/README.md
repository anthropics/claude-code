# Linear MCP Plugin

Integrate Linear's project management system with Claude Code through the Model Context Protocol (MCP) to search, create, and update Linear issues, projects, and comments directly from conversations.

## Overview

The Linear MCP Plugin connects Claude Code to Linear's centrally hosted MCP server, enabling seamless interaction with your Linear workspace. With this integration, you can query tickets, create issues, update project statuses, and manage Linear objects without leaving your development workflow.

## What is Linear MCP?

Linear launched their official MCP server on May 1, 2025, following the authenticated remote MCP specification. The server is centrally hosted and managed by Linear, providing tools for:

- **Finding** issues, projects, and comments
- **Creating** new issues and projects
- **Updating** existing Linear objects
- **Searching** across your Linear workspace

## Features

- **Stay in Flow**: Query and manage Linear issues while writing code
- **Real-time Context**: Access structured, up-to-date information from Linear
- **Seamless Integration**: No context switching between tools
- **Direct API Access**: Interact with Linear through natural language commands

## Installation

### Prerequisites

- Claude Code installed globally (`npm install -g @anthropic-ai/claude-code`)
- A Linear account with API access
- Internet connection for remote MCP server

### Setup

To add Linear MCP to your Claude Code configuration, run the following command:

```bash
claude mcp add-json linear '{"command": "npx", "args": ["-y","mcp-remote","https://mcp.linear.app/sse"]}'
```

**Note**: The JSON syntax (`add-json`) has proven to be the most reliable method for adding Linear MCP, as opposed to the standard syntax or SSE syntax.

### Authentication

After adding the server:

1. Open a Claude Code session in your project:
   ```bash
   claude
   ```

2. Run the MCP authentication command:
   ```
   /mcp
   ```

3. Follow the authentication flow to connect your Linear account

## Usage

Once configured, you can interact with Linear directly through natural language in Claude Code sessions:

### Example Queries

**Finding Issues:**
```
Show me all open issues assigned to me in Linear
```

**Creating Issues:**
```
Create a new issue in Linear: "Add dark mode toggle to settings page"
```

**Updating Issues:**
```
Update LIN-123 to mark it as in progress
```

**Searching Projects:**
```
Find all issues in the mobile app project
```

**Adding Comments:**
```
Add a comment to LIN-456: "Implemented the initial solution, ready for review"
```

## Use Cases

### During Development

- **Check Related Issues**: Quickly view issue details while implementing features
- **Update Status**: Mark issues as in progress or completed without leaving your terminal
- **Create Follow-ups**: Identify bugs or improvements and create issues immediately

### Code Review

- **Link to Issues**: Reference Linear issues when reviewing code
- **Create Tasks**: Convert review comments into actionable Linear issues
- **Track Progress**: Update issue status as reviews are addressed

### Project Planning

- **Query Backlog**: Search and filter issues for sprint planning
- **Create Epics**: Set up new projects and milestones
- **Organize Work**: Update priorities and assignments

## Configuration

The Linear MCP server connects to `https://mcp.linear.app/sse` using the following configuration:

```json
{
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://mcp.linear.app/sse"]
}
```

This configuration:
- Uses `npx` to run the remote MCP client
- Auto-confirms installation with `-y` flag
- Connects to Linear's SSE (Server-Sent Events) endpoint

## Troubleshooting

### Connection Issues

**Issue**: Remote MCP connection fails or requires multiple attempts

**Solution**:
- Remote MCP connections are still early and may be unstable
- Try restarting your Claude Code session
- Disable and re-enable the Linear MCP server:
  ```bash
  claude mcp disable linear
  claude mcp enable linear
  ```
- Check your internet connection

### Authentication Failures

**Issue**: Cannot authenticate with Linear

**Solution**:
- Ensure you have a valid Linear account
- Check that your Linear API access is enabled
- Re-run the authentication flow using `/mcp`
- Verify Linear's service status at [linear.app/status](https://linear.app/status)

### MCP Command Not Found

**Issue**: The `/mcp` command is not recognized

**Solution**:
- Ensure you're running a recent version of Claude Code
- Update Claude Code: `npm install -g @anthropic-ai/claude-code@latest`
- Restart your Claude Code session

### Server Not Responding

**Issue**: Linear MCP server times out or doesn't respond

**Solution**:
- Verify the MCP server URL is correct: `https://mcp.linear.app/sse`
- Check Linear's MCP server status
- Remove and re-add the MCP server:
  ```bash
  claude mcp remove linear
  claude mcp add-json linear '{"command": "npx", "args": ["-y","mcp-remote","https://mcp.linear.app/sse"]}'
  ```

## Best Practices

1. **Authenticate Once**: After initial setup, authentication persists across sessions
2. **Use Natural Language**: Describe what you want to do—Claude will handle the Linear API
3. **Be Specific**: Include issue IDs (e.g., LIN-123) when updating or querying specific items
4. **Check Permissions**: Ensure your Linear account has appropriate permissions for creating/updating issues
5. **Stay Updated**: Linear's MCP implementation may evolve; check for updates periodically

## Technical Details

### MCP Protocol

Linear MCP follows the Model Context Protocol specification, enabling:
- Bidirectional communication between Claude and Linear
- Structured data exchange for issues, projects, and metadata
- Real-time updates via Server-Sent Events (SSE)

### Remote MCP

Unlike local MCP servers that run on your machine, Linear MCP is:
- Hosted centrally by Linear
- Managed and maintained by the Linear team
- Accessible via HTTPS with authentication
- Requires internet connectivity

## Resources

- [Linear MCP Documentation](https://linear.app/docs/mcp)
- [Linear Changelog - MCP Announcement](https://linear.app/changelog/2025-05-01-mcp)
- [Claude Code MCP Documentation](https://docs.claude.com/en/docs/claude-code/mcp)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)

## Known Limitations

- Remote MCP connections are still in early stages and may have stability issues
- Requires active internet connection
- Authentication must be completed in each new Claude Code installation
- Some Linear features may not be available through MCP yet

## Feedback

If you encounter issues or have suggestions for improving Linear MCP integration:

1. Report Linear-specific issues to [Linear Support](https://linear.app/contact)
2. Report Claude Code issues using `/bug` or at [github.com/anthropics/claude-code/issues](https://github.com/anthropics/claude-code/issues)

## Author

Anthropic (support@anthropic.com)

## Version

1.0.0

---

**Quote from Tom Moor, Head of Engineering at Linear:**

> "Linear's MCP integration brings Linear projects and issues directly into Claude Code. With structured, real-time context from Linear, engineers can stay in flow when moving between planning, writing code, and managing issues."
