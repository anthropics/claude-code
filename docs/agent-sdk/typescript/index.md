# Agent SDK Reference - TypeScript

This page provides a comprehensive API reference for the TypeScript Agent SDK for Claude.

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## Key Functions

### `query()`

The primary function for interacting with Claude Code. It accepts a prompt and optional configuration, returning an async generator that streams messages.

**Signature:**
```typescript
query(
  prompt: string | AsyncIterable<string>,
  options?: Options
): AsyncGenerator<Message>
```

**Parameters:**
- `prompt`: A string or async iterable containing the user's input
- `options`: Optional configuration object (see Configuration Options below)

**Returns:**
An async generator that yields messages as they are generated

**Example:**
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query('Help me debug this code')) {
  console.log(message);
}
```

### `tool()`

Creates type-safe MCP tool definitions using Zod schemas. This allows you to define custom tools that the agent can use.

**Signature:**
```typescript
tool(
  name: string,
  description: string,
  inputSchema: ZodSchema,
  handler: (input: T) => Promise<unknown>
): ToolDefinition
```

**Parameters:**
- `name`: The name of the tool
- `description`: A description of what the tool does
- `inputSchema`: A Zod schema defining the tool's input structure
- `handler`: An async function that implements the tool's logic

**Example:**
```typescript
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const weatherTool = tool(
  'get_weather',
  'Get the current weather for a location',
  z.object({
    location: z.string(),
    units: z.enum(['celsius', 'fahrenheit']).optional()
  }),
  async (input) => {
    // Implement weather fetching logic
    return { temperature: 72, conditions: 'sunny' };
  }
);
```

### `createSdkMcpServer()`

Instantiates an MCP server running in-process with configurable name, version, and tool definitions.

**Signature:**
```typescript
createSdkMcpServer(
  name: string,
  version: string,
  tools: ToolDefinition[]
): McpServer
```

**Parameters:**
- `name`: The name of the MCP server
- `version`: The version of the server
- `tools`: An array of tool definitions created with `tool()`

**Example:**
```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const server = createSdkMcpServer(
  'my-custom-server',
  '1.0.0',
  [weatherTool, calculatorTool]
);
```

## Configuration Options

The `Options` type provides comprehensive configuration for agent behavior:

### Model Selection
```typescript
{
  model?: string;                    // Primary model to use (default: claude-sonnet-4-5)
  fallbackModels?: string[];         // Models to try if primary fails
}
```

### Tool Configuration
```typescript
{
  allowedTools?: string[];           // Whitelist of allowed tools
  deniedTools?: string[];            // Blacklist of denied tools
}
```

### Permission Modes
```typescript
{
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
}
```

- `default`: Request permission for tool usage
- `acceptEdits`: Automatically accept file edits
- `bypassPermissions`: Skip all permission checks
- `plan`: Plan mode for task planning

### MCP Server Configuration
```typescript
{
  mcpServers?: McpServerConfig[];    // MCP servers to connect to
}
```

### Custom Hooks
```typescript
{
  hooks?: {
    preToolUse?: (tool: ToolUse) => Promise<void>;
    postToolUse?: (tool: ToolUse, result: unknown) => Promise<void>;
    userPromptSubmit?: (prompt: string) => Promise<string>;
  };
}
```

### Environment Configuration
```typescript
{
  workingDirectory?: string;         // Working directory for file operations
  environment?: Record<string, string>; // Environment variables
}
```

### System Prompt
```typescript
{
  systemPrompt?: string;             // Custom system prompt for the agent
}
```

## Message Types

The SDK returns various message types during execution:

### `SDKAssistantMessage`
Claude's responses containing text, thinking blocks, and tool uses.

```typescript
interface SDKAssistantMessage {
  type: 'assistant';
  content: Array<TextBlock | ThinkingBlock | ToolUseBlock>;
  stopReason?: string;
}
```

### `SDKUserMessage`
User input messages.

```typescript
interface SDKUserMessage {
  type: 'user';
  content: string | Array<ContentBlock>;
}
```

### `SDKResultMessage`
Final result message containing usage statistics.

```typescript
interface SDKResultMessage {
  type: 'result';
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
  cost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
}
```

### `SDKSystemMessage`
System initialization messages.

```typescript
interface SDKSystemMessage {
  type: 'system';
  sessionId: string;
  metadata?: Record<string, unknown>;
}
```

### `SDKPartialAssistantMessage`
Streaming events for progressive updates (optional).

```typescript
interface SDKPartialAssistantMessage {
  type: 'partial_assistant';
  content: Array<ContentBlock>;
}
```

## Built-in Tools

The SDK provides comprehensive built-in tools:

### File Operations
- **Read**: Read file contents
- **Write**: Write or overwrite files
- **Edit**: Make targeted edits to files
- **Glob**: Find files matching patterns
- **Grep**: Search file contents

### Execution
- **Bash**: Execute bash commands
- **NotebookEdit**: Edit Jupyter notebook cells

### Web
- **WebFetch**: Fetch and process web content
- **WebSearch**: Search the web

### Task Management
- **Task**: Create and manage subagents
- **TodoWrite**: Manage task lists

### MCP Integration
- **ListMcpResources**: List available MCP resources
- **ReadMcpResource**: Read content from MCP resources

## Permission System

Developers can implement custom permission logic via the `canUseTool` callback in options:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query('Process this data', {
  async canUseTool(toolName: string, toolInput: unknown): Promise<boolean> {
    // Custom permission logic
    if (toolName === 'Bash') {
      // Review the command before allowing execution
      console.log('Bash command requested:', toolInput);
      return await getUserApproval();
    }
    return true; // Allow other tools
  }
})) {
  console.log(message);
}
```

This enables granular control over tool usage with custom approval/denial capabilities.

## Advanced Usage

### Streaming Input

For interactive sessions, use an async generator as input:

```typescript
async function* inputStream() {
  yield 'First message';
  await sleep(1000);
  yield 'Follow-up question';
}

for await (const message of query(inputStream())) {
  console.log(message);
}
```

### With MCP Servers

Configure custom MCP servers:

```typescript
import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const myServer = createSdkMcpServer('custom-tools', '1.0.0', [
  // ... your custom tools
]);

for await (const message of query('Use my custom tools', {
  mcpServers: [{ server: myServer }]
})) {
  console.log(message);
}
```

## Best Practices

1. **Use Streaming Input**: For interactive applications, use async iterables for richer user experiences
2. **Implement Permission Callbacks**: Always implement `canUseTool` for production applications
3. **Handle Errors Gracefully**: Wrap query calls in try-catch blocks
4. **Optimize Context**: Use `CLAUDE.md` files for persistent context rather than long prompts
5. **Configure Tool Access**: Use `allowedTools` and `deniedTools` to limit agent capabilities

## See Also

- [Python SDK Reference](../python/index.md)
- [Streaming vs Single Mode](../streaming-vs-single-mode.md)
- [Agent SDK Overview](../overview.md)
