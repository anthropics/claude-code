# Agent SDK Overview

The Claude Agent SDK (formerly Claude Code SDK) is a comprehensive toolkit for building production-ready AI agents. It provides a rich set of features for creating agents that can interact with files, execute code, search the web, and integrate with external tools through the Model Context Protocol (MCP).

## Installation

### TypeScript
```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Python
```bash
pip install claude-agent-sdk
```

## Core Features

### Automatic Context Management
The SDK provides automatic compaction and context management to ensure your agent doesn't run out of context during long-running sessions.

### Rich Tool Ecosystem
- **File Operations**: Read, Write, Edit, Glob, and Grep for comprehensive file management
- **Code Execution**: Execute bash commands and edit Jupyter notebooks
- **Web Capabilities**: Web search and content fetching
- **MCP Extensibility**: Integrate with Model Context Protocol servers for custom tools

### Production Essentials
- Fine-grained permissions control
- Error handling and retry mechanisms
- Session management and state persistence
- Automatic prompt caching for performance optimization

## Use Cases

### Coding Agents
- SRE automation agents
- Security review bots
- Code review agents
- Automated testing and debugging

### Business Agents
- Legal document assistants
- Finance advisors
- Customer support automation
- Content creation and management

## Key Capabilities

### Subagents and Agent Skills
Create specialized sub-agents for complex tasks and define reusable skills that can be invoked across different agents.

### Hooks and Slash Commands
- **Hooks**: Intercept and customize agent behavior at various lifecycle points
- **Slash Commands**: Create custom commands for common workflows

### Plugins for Custom Extensions
Extend the SDK with custom functionality through a plugin system.

### Memory Management
Use `CLAUDE.md` files to provide persistent context and knowledge to your agents across sessions.

### System Prompts and Tool Permissions
Configure custom system prompts and control which tools are available to your agents with granular permissions.

### Model Context Protocol (MCP) Integration
Seamlessly integrate with MCP servers to add custom tools and capabilities to your agents.

## Authentication

The SDK supports multiple authentication methods:

### Claude API
Set your API key via environment variable:
```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

### Amazon Bedrock
Configure AWS credentials and set:
```bash
export AWS_REGION=your_region
```

### Google Vertex AI
Set up Google Cloud credentials and configure:
```bash
export GOOGLE_CLOUD_PROJECT=your_project_id
export GOOGLE_CLOUD_REGION=your_region
```

## Getting Started

See the language-specific guides for detailed implementation instructions:
- [TypeScript Reference](./typescript/index.md)
- [Python Reference](./python/index.md)
- [Streaming vs Single Mode](./streaming-vs-single-mode.md)

## Related Documentation

- [Agent Skills Guide](../agents-and-tools/agent-skills/overview.md)
- [Tool Use Overview](../agents-and-tools/tool-use/overview.md)
- [MCP Connector](../agents-and-tools/mcp-connector.md)
