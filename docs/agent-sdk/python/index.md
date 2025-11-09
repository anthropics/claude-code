# Agent SDK Reference - Python

This comprehensive reference document covers the Python Agent SDK for Claude, providing complete API documentation for building agent applications.

## Installation

```bash
pip install claude-agent-sdk
```

## Two Main Interaction Patterns

The SDK offers two distinct approaches for interacting with Claude:

### 1. `query()` - One-off Interactions

Creates a new session for each interaction, ideal for single tasks without requiring conversation context.

### 2. `ClaudeSDKClient` - Stateful Sessions

Maintains session state across multiple exchanges, enabling continuous conversations where Claude remembers previous context.

## Core Functions

### `query()`

Single-use query function that creates a fresh session for each call.

**Signature:**
```python
async def query(
    prompt: str | AsyncIterable[str],
    options: ClaudeAgentOptions | None = None
) -> AsyncIterator[Message]
```

**Parameters:**
- `prompt`: A string or async iterable containing the user's input
- `options`: Optional configuration (see `ClaudeAgentOptions` below)

**Returns:**
An async iterator that yields messages as they are generated

**Example:**
```python
from claude_agent_sdk import query

async def main():
    async for message in query("Help me write a Python function"):
        print(message)

import asyncio
asyncio.run(main())
```

### `ClaudeSDKClient`

Class for maintaining stateful conversations across multiple turns.

**Methods:**

#### `__init__(options: ClaudeAgentOptions | None = None)`
Initialize a new client with optional configuration.

#### `send(prompt: str | AsyncIterable[str]) -> AsyncIterator[Message]`
Send a message and receive streaming responses.

#### `interrupt()`
Stop the current execution mid-task.

**Example:**
```python
from claude_agent_sdk import ClaudeSDKClient

async def main():
    client = ClaudeSDKClient()

    # First message
    async for message in client.send("What's 2+2?"):
        print(message)

    # Follow-up maintains context
    async for message in client.send("What about multiplying that by 3?"):
        print(message)

import asyncio
asyncio.run(main())
```

## Tool Definition

### `tool()` Decorator

Defines MCP tools with type safety and automatic schema generation.

**Signature:**
```python
def tool(
    name: str,
    description: str,
    input_schema: dict[str, type] | dict
) -> Callable
```

**Parameters:**
- `name`: The name of the tool
- `description`: A description of what the tool does
- `input_schema`: Either a simple type mapping or JSON Schema format

**Example (Simple Type Mapping):**
```python
from claude_agent_sdk import tool

@tool(
    "get_weather",
    "Get the current weather for a location",
    {"location": str, "units": str}
)
async def get_weather(location: str, units: str = "celsius"):
    # Implementation
    return {"temperature": 22, "conditions": "sunny"}
```

**Example (JSON Schema):**
```python
@tool(
    "calculate",
    "Perform a calculation",
    {
        "type": "object",
        "properties": {
            "operation": {"type": "string", "enum": ["add", "subtract"]},
            "a": {"type": "number"},
            "b": {"type": "number"}
        },
        "required": ["operation", "a", "b"]
    }
)
async def calculate(operation: str, a: float, b: float):
    if operation == "add":
        return a + b
    elif operation == "subtract":
        return a - b
```

### `create_sdk_mcp_server()`

Creates an in-process MCP server with custom tools.

**Signature:**
```python
def create_sdk_mcp_server(
    name: str,
    version: str,
    tools: list[Callable]
) -> McpServer
```

**Parameters:**
- `name`: The name of the MCP server
- `version`: The version string
- `tools`: List of functions decorated with `@tool`

**Example:**
```python
from claude_agent_sdk import create_sdk_mcp_server, tool

@tool("greet", "Greet a user", {"name": str})
async def greet(name: str):
    return f"Hello, {name}!"

server = create_sdk_mcp_server(
    "my-tools",
    "1.0.0",
    [greet]
)
```

## Configuration Options

### `ClaudeAgentOptions`

The central configuration dataclass for controlling agent behavior.

**Model Configuration:**
```python
from claude_agent_sdk import ClaudeAgentOptions

options = ClaudeAgentOptions(
    model="claude-sonnet-4-5",
    fallback_models=["claude-opus-4"]
)
```

**Tool Control:**
```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write", "Bash"],  # Whitelist
    denied_tools=["WebSearch"]                 # Blacklist
)
```

**System Prompt:**
```python
options = ClaudeAgentOptions(
    system_prompt="You are a helpful Python expert",
    # Or use a preset:
    system_prompt_preset="code_reviewer"
)
```

**MCP Servers:**
```python
options = ClaudeAgentOptions(
    mcp_servers=[
        {"server": my_custom_server}
    ]
)
```

**Permission Modes:**
```python
options = ClaudeAgentOptions(
    permission_mode="acceptEdits"  # 'default', 'acceptEdits', 'plan', 'bypassPermissions'
)
```

**Working Directory and Environment:**
```python
options = ClaudeAgentOptions(
    working_directory="/path/to/project",
    environment={"DEBUG": "true"}
)
```

**Hooks:**
```python
async def pre_tool_hook(tool_name: str, tool_input: dict):
    print(f"About to use {tool_name}")

async def post_tool_hook(tool_name: str, result: Any):
    print(f"Tool {tool_name} completed")

options = ClaudeAgentOptions(
    hooks={
        "pre_tool_use": pre_tool_hook,
        "post_tool_use": post_tool_hook
    }
)
```

**Subagents:**
```python
options = ClaudeAgentOptions(
    subagents={
        "code_reviewer": {
            "system_prompt": "You are a thorough code reviewer"
        }
    }
)
```

**Settings Management:**
```python
options = ClaudeAgentOptions(
    setting_sources=["filesystem", "env"]  # Controls where to load config from
)
```

## Message and Content Types

### Message Types

#### `UserMessage`
```python
from dataclasses import dataclass

@dataclass
class UserMessage:
    type: str = "user"
    content: str | list[ContentBlock]
```

#### `AssistantMessage`
```python
@dataclass
class AssistantMessage:
    type: str = "assistant"
    content: list[ContentBlock]
    stop_reason: str | None = None
```

#### `SystemMessage`
```python
@dataclass
class SystemMessage:
    type: str = "system"
    session_id: str
    metadata: dict | None = None
```

#### `ResultMessage`
```python
@dataclass
class ResultMessage:
    type: str = "result"
    usage: UsageInfo
    cost: CostInfo | None = None
```

### Content Block Types

- **`TextBlock`**: Plain text content
- **`ThinkingBlock`**: Claude's reasoning process
- **`ToolUseBlock`**: Tool invocation request
- **`ToolResultBlock`**: Tool execution result

**Example:**
```python
from claude_agent_sdk.messages import TextBlock, ToolUseBlock

text = TextBlock(text="Here's the result")
tool_use = ToolUseBlock(
    id="tool_123",
    name="Read",
    input={"file_path": "/path/to/file"}
)
```

## Built-in Tools

The Python SDK provides comprehensive built-in tools:

### File Operations
- **Read**: Read file contents
- **Write**: Write or overwrite files
- **Edit**: Make targeted edits to existing files
- **Glob**: Find files matching glob patterns
- **Grep**: Search file contents with regex

### Execution Tools
- **Bash**: Execute bash commands
- **NotebookEdit**: Edit Jupyter notebook cells

### Web Tools
- **WebFetch**: Fetch and process web content
- **WebSearch**: Search the web for information

### Task Management
- **Task**: Create and manage subagents for complex tasks
- **TodoWrite**: Manage and track task lists

### MCP Resource Tools
- **ListMcpResources**: List available MCP resources
- **ReadMcpResource**: Read content from MCP resources

## Advanced Features

### Hooks System

Intercept events at various points in the agent lifecycle:

**Available Hooks:**
- `pre_tool_use`: Called before a tool is executed
- `post_tool_use`: Called after a tool completes
- `user_prompt_submit`: Intercept and modify user prompts

**Example:**
```python
from claude_agent_sdk import ClaudeAgentOptions, query

async def review_bash_commands(tool_name: str, tool_input: dict):
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        if "rm -rf" in command:
            raise PermissionError("Destructive command blocked")

options = ClaudeAgentOptions(
    hooks={"pre_tool_use": review_bash_commands}
)

async for message in query("Clean up files", options):
    print(message)
```

### Permission Callbacks

Implement granular access control with the `can_use_tool` callback:

**Example:**
```python
async def permission_callback(tool_name: str, tool_input: dict) -> bool:
    if tool_name == "Bash":
        # Review the command
        command = tool_input.get("command", "")
        print(f"Approve bash command: {command}? (y/n)")
        response = input()
        return response.lower() == 'y'
    return True  # Allow other tools

options = ClaudeAgentOptions(
    can_use_tool=permission_callback
)

async for message in query("Run system updates", options):
    print(message)
```

### Streaming Input

Support dynamic, multi-turn conversations:

**Example:**
```python
async def input_stream():
    yield "First, analyze this code"
    await asyncio.sleep(1)
    yield "Now suggest improvements"

async for message in query(input_stream()):
    print(message)
```

### Interrupt Support

Stop execution mid-task:

**Example:**
```python
from claude_agent_sdk import ClaudeSDKClient
import asyncio

async def main():
    client = ClaudeSDKClient()

    # Start a long-running task
    task = asyncio.create_task(
        consume_messages(client.send("Analyze this large codebase"))
    )

    # Interrupt after 5 seconds
    await asyncio.sleep(5)
    client.interrupt()

    await task

async def consume_messages(message_iter):
    async for message in message_iter:
        print(message)
```

## Error Handling

The SDK provides specialized exceptions for error management:

### Exception Types

- **`CLINotFoundError`**: Claude CLI executable not found
- **`ProcessError`**: Error executing a process
- **`CLIConnectionError`**: Connection to Claude CLI failed
- **`CLIJSONDecodeError`**: Invalid JSON response from CLI

**Example:**
```python
from claude_agent_sdk import query, CLINotFoundError, ProcessError

async def main():
    try:
        async for message in query("Help me code"):
            print(message)
    except CLINotFoundError:
        print("Claude CLI not installed")
    except ProcessError as e:
        print(f"Process error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")

import asyncio
asyncio.run(main())
```

## Complete Example

Here's a comprehensive example combining multiple features:

```python
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    tool,
    create_sdk_mcp_server
)
import asyncio

# Define custom tools
@tool(
    "database_query",
    "Query the database",
    {"sql": str}
)
async def database_query(sql: str):
    # Implementation
    return [{"id": 1, "name": "Alice"}]

# Create MCP server
db_server = create_sdk_mcp_server(
    "database-tools",
    "1.0.0",
    [database_query]
)

# Configure options
async def approval_callback(tool_name: str, tool_input: dict) -> bool:
    if tool_name == "database_query":
        print(f"Approve SQL: {tool_input.get('sql')}?")
        return True  # In production, get user approval
    return True

options = ClaudeAgentOptions(
    mcp_servers=[{"server": db_server}],
    can_use_tool=approval_callback,
    system_prompt="You are a database assistant",
    permission_mode="default"
)

# Run the agent
async def main():
    client = ClaudeSDKClient(options)

    async for message in client.send("Show me all users"):
        if message.type == "assistant":
            for block in message.content:
                if hasattr(block, 'text'):
                    print(block.text)
        elif message.type == "result":
            print(f"Cost: ${message.cost.total_cost:.4f}")

asyncio.run(main())
```

## Best Practices

1. **Use `ClaudeSDKClient` for Multi-turn Conversations**: When you need context persistence
2. **Use `query()` for One-off Tasks**: Simpler for stateless operations
3. **Implement Permission Callbacks**: Always validate tool usage in production
4. **Handle Errors Gracefully**: Catch specific exception types
5. **Use Hooks for Logging**: Track tool usage and debug issues
6. **Limit Tool Access**: Use `allowed_tools` and `denied_tools` for security
7. **Leverage MCP Servers**: Organize related tools into servers
8. **Use Type Hints**: Improve IDE support and catch errors early

## See Also

- [TypeScript SDK Reference](../typescript/index.md)
- [Streaming vs Single Mode](../streaming-vs-single-mode.md)
- [Agent SDK Overview](../overview.md)
