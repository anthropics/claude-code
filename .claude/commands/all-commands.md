# Claude Code Command Reference

This document provides a comprehensive reference for all available custom commands in the Claude Code environment.

## Table of Contents

1. [Documentation Generator](#documentation-generator)
2. [Code Complexity Analysis](#code-complexity-analysis)
3. [Agent-to-Agent Communication](#agent-to-agent-communication)
4. [File Path Extractor](#file-path-extractor)
5. [MCP Server Status](#mcp-server-status)

---

## Documentation Generator

Generate comprehensive documentation for the provided code with appropriate formatting, code examples, and explanations.

### Usage
```
/generate-documentation $ARGUMENTS
```

### Parameters
- `path`: File path or directory to document
- `format`: Output format (markdown, html, json) (default: markdown)
- `output`: Output file path (default: ./docs/[filename].md)
- `includePrivate`: Whether to include private methods/properties (default: false)

### Example
```
/generate-documentation src/agents/base-agent.ts --format=markdown --output=docs/agents.md
```

### Process
The command will:
1. Parse the provided code using abstract syntax trees
2. Extract classes, functions, types, interfaces, and their documentation
3. Identify relationships between components
4. Generate a well-structured documentation file
5. Include example usage where available from code comments
6. Create proper navigation and linking between related components

### Output
The generated documentation includes:
- Table of contents
- Class/function signatures with parameter and return type information
- Class hierarchies and inheritance relationships
- Descriptions from JSDoc/TSDoc comments
- Example usage code blocks
- Type definitions and interface declarations
- Cross-references to related code elements

---

## Code Complexity Analysis

Analyze the complexity of the provided code with special attention to cognitive complexity metrics.

### Usage
```
/analyze-complexity $ARGUMENTS
```

### Parameters
- `path`: File path to analyze
- `threshold`: Complexity threshold (default: 10)

### Example
```
/analyze-complexity src/app.js --threshold=15
```

### Process
The command will:
1. Calculate cyclomatic complexity
2. Measure cognitive complexity
3. Identify complex functions or methods
4. Suggest refactoring opportunities
5. Generate a complexity heatmap

### Output
Results are returned in a structured format with metrics and actionable recommendations.

---

## Agent-to-Agent Communication

Facilitate communication between agents by generating, sending, and interpreting agent messages according to the A2A protocol.

### Usage
```
/agent-to-agent $ARGUMENTS
```

### Parameters
- `from`: Source agent identifier (default: 'user-agent')
- `to`: Target agent identifier (required)
- `task`: Task or action to perform (required)
- `params`: JSON string containing parameters (default: '{}')
- `conversationId`: Conversation identifier for related messages (optional)

### Example
```
/agent-to-agent --to=code-analyzer --task=analyze-complexity --params='{"code": "function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }", "language": "javascript"}'
```

### Process
The command will:
1. Create a properly formatted agent message
2. Route the message to the specified agent
3. Wait for and display the response
4. Format the response appropriately based on content type
5. Provide additional context for understanding the result

### Use Cases
This command is useful for:
- Testing agent-to-agent communication
- Performing complex tasks that involve multiple specialized agents
- Debugging agent functionality
- Exploring available agent capabilities
- Creating multi-step workflows by chaining agent interactions

### Output
Results are returned in a structured format matching the agent message protocol specification.

---

## File Path Extractor

Extract and organize file paths from command output with filtering and structured formatting.

### Usage
```
/file-path-extractor $ARGUMENTS
```

### Parameters
- `input`: Raw file paths or command output containing file paths
- `filter`: Directories to exclude (default: "node_modules,__pycache__,venv,.git")
- `format`: Output format (json, tree, list) (default: json)
- `addMeta`: Whether to include metadata like file sizes and types (default: false)

### Example
```
/file-path-extractor --input="$(find . -type f | grep -v node_modules)" --format=tree
```

### Process
The command will:
1. Parse the input to extract all file paths
2. Filter out specified directories and system files
3. Organize paths into a hierarchical structure
4. Apply formatting according to the specified output format
5. Add metadata if requested

### Output
The output varies based on the specified format:
- JSON: Structured object with root directories and expanded hierarchy
- Tree: ASCII tree visualization of the directory structure
- List: Simple indented list of files and directories

---

## MCP Server Status

Check the status of all MCP (Model Context Protocol) servers in the environment.

### Usage
```
/mcp-status
```

### Parameters
None

### Example
```
/mcp-status
```

### Process
The command will:
1. Check for running MCP server processes
2. Verify connectivity to each server
3. Display status information for each server
4. Show port information for active servers

### Output
A formatted table showing:
- Server name
- Status (Running/Not Running)
- Connection status (Connected/Failed)
- Port number (if active)
- Startup time and uptime

### Troubleshooting
If servers show as not running or not connected, consider:
- Checking server logs for errors
- Verifying API keys are properly configured
- Restarting failed servers with the appropriate commands