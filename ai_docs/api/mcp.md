# MCP API Documentation

The Model Context Protocol (MCP) API provides integration with Claude and other LLM models through a standardized protocol.

## ClaudeMcpClient

`ClaudeMcpClient` is the main client for interacting with MCP servers.

```javascript
const ClaudeMcpClient = require('../core/mcp/claude_mcp_client');
```

### Methods

#### `constructor(options)`

Creates a new instance of ClaudeMcpClient.

```javascript
const mcpClient = new ClaudeMcpClient({
  // Optional configuration overrides
});
```

Parameters:
- `options` (Object, optional): Configuration options

#### `getAvailableServers()`

Gets a list of available MCP servers.

```javascript
const servers = mcpClient.getAvailableServers();
```

Returns:
- (Array): List of available servers, each with:
  - `id` (string): Server ID
  - `description` (string): Server description
  - `autostart` (boolean): Whether the server auto-starts
  - `running` (boolean): Whether the server is currently running

#### `startServer(serverId)`

Starts an MCP server.

```javascript
const success = mcpClient.startServer('sequentialthinking');
```

Parameters:
- `serverId` (string): Server ID

Returns:
- (boolean): Success

#### `stopServer(serverId)`

Stops an MCP server.

```javascript
const success = mcpClient.stopServer('sequentialthinking');
```

Parameters:
- `serverId` (string): Server ID

Returns:
- (boolean): Success

#### `stopAllServers()`

Stops all running MCP servers.

```javascript
mcpClient.stopAllServers();
```

#### `async generateResponse(options)`

Generates a response from Claude with MCP server integration.

```javascript
const response = await mcpClient.generateResponse({
  prompt: 'Hello, Claude!',
  requiredTools: ['sequentialthinking', 'brave-search'],
  model: 'claude-3-opus-20240229'
});
```

Parameters:
- `options` (Object):
  - `prompt` (string): Prompt text
  - `requiredTools` (Array, optional): Required MCP tools
  - `model` (string, optional): Claude model to use

Returns:
- (Promise<Object>): Claude response with:
  - `text` (string): Response text
  - `model` (string): Model used
  - `usage` (Object): Token usage
  - `requestId` (string): Request ID

## MCP Server

MCP Server is responsible for running MCP services and handling requests.

```javascript
const server = require('../core/mcp/start_server');
```

### Functions

#### `startServer(options)`

Starts the MCP server.

```javascript
const server = startServer({
  port: 3000,
  host: 'localhost',
  testMode: false
});
```

Parameters:
- `options` (Object, optional):
  - `port` (number): Port to listen on (default: from config)
  - `host` (string): Host to bind to (default: from config)
  - `testMode` (boolean): Whether to run in test mode

Returns:
- (Object): Server instance

#### `stopServer(server)`

Stops the MCP server.

```javascript
stopServer(server);
```

Parameters:
- `server` (Object): Server instance to stop

## MCP Setup

MCP Setup is responsible for configuring MCP servers.

```javascript
const setup = require('../core/mcp/setup_mcp');
```

### Functions

#### `setupMcpServer(options)`

Sets up an MCP server configuration.

```javascript
const success = setupMcpServer({
  id: 'sequentialthinking',
  description: 'Sequential Thinking MCP Server',
  command: 'node',
  args: ['server.js'],
  enabled: true,
  autostart: true
});
```

Parameters:
- `options` (Object):
  - `id` (string): Server ID
  - `description` (string): Server description
  - `command` (string): Command to run
  - `args` (Array): Command arguments
  - `enabled` (boolean): Whether the server is enabled
  - `autostart` (boolean): Whether the server should auto-start

Returns:
- (boolean): Success

#### `removeMcpServer(serverId)`

Removes an MCP server configuration.

```javascript
const success = removeMcpServer('sequentialthinking');
```

Parameters:
- `serverId` (string): Server ID

Returns:
- (boolean): Success

## MCP Communication Protocol

### Request Format

When sending requests to MCP servers, use the following format:

```javascript
// Example request to an MCP server
const request = {
  requestId: 'req_123456789',
  toolName: 'sequentialthinking',
  input: {
    // Tool-specific parameters
    thought: 'This is a step in my reasoning process',
    nextThoughtNeeded: true,
    thoughtNumber: 1,
    totalThoughts: 5
  },
  metadata: {
    // Optional request metadata
    source: 'claude-neural-framework',
    timestamp: new Date().toISOString()
  }
};
```

### Response Format

Responses from MCP servers follow this format:

```javascript
// Example response from an MCP server
const response = {
  requestId: 'req_123456789',
  toolName: 'sequentialthinking',
  output: {
    // Tool-specific output
    nextThought: 'Next step in the reasoning process',
    thoughtNumber: 2,
    totalThoughts: 5
  },
  status: 'success', // or 'error'
  error: null, // or error details if status is 'error'
  metadata: {
    // Optional response metadata
    processingTime: 123, // milliseconds
    timestamp: '2025-05-11T12:34:56Z'
  }
};
```

## Available MCP Servers

The framework supports these MCP servers:

### sequentialthinking

Provides recursive thought generation capabilities.

```javascript
// Example usage
const response = await mcpClient.generateResponse({
  prompt: 'Solve this complex problem...',
  requiredTools: ['sequentialthinking']
});
```

### context7

Provides context awareness and documentation access.

```javascript
// Example usage
const response = await mcpClient.generateResponse({
  prompt: 'Explain how to use React hooks...',
  requiredTools: ['context7']
});
```

### desktop-commander

Provides filesystem integration and shell execution.

```javascript
// Example usage
const response = await mcpClient.generateResponse({
  prompt: 'List files in the current directory...',
  requiredTools: ['desktop-commander']
});
```

### brave-search

Provides external knowledge acquisition.

```javascript
// Example usage
const response = await mcpClient.generateResponse({
  prompt: 'What is the latest news about AI?',
  requiredTools: ['brave-search']
});
```

### think-mcp

Provides meta-cognitive reflection.

```javascript
// Example usage
const response = await mcpClient.generateResponse({
  prompt: 'Analyze this complex reasoning...',
  requiredTools: ['think-mcp']
});
```