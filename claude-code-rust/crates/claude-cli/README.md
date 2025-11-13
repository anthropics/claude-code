# claude-cli

Main CLI application for Claude Code - an AI-powered coding assistant.

## Overview

The `claude-cli` crate provides the main entry point and interactive REPL for Claude Code. It orchestrates all other components including the API client, tools, plugins, hooks, and agents.

## Architecture

### Main Components

1. **main.rs** - Application entry point
   - Command line argument parsing
   - Tracing initialization
   - Application lifecycle management

2. **cli.rs** - CLI argument parsing
   - Uses `clap` for robust argument handling
   - Supports model selection, API key, config directory
   - Provides subcommands (MCP server, etc.)

3. **app.rs** - Application state management
   - Initializes all subsystems
   - Manages configuration, API client, tools, plugins, hooks, agents
   - Handles startup and shutdown lifecycle

4. **repl.rs** - Interactive Read-Eval-Print Loop
   - Processes user input
   - Sends messages to Claude API
   - Executes tool requests
   - Displays responses with colored output

5. **conversation.rs** - Conversation management
   - Tracks message history
   - Formats messages for API requests
   - Handles tool results
   - Manages conversation context

## Usage

### Interactive Mode

```bash
# Start interactive session with default model
claude-cli

# Specify model
claude-cli --model claude-sonnet-4-5-20250929

# Set config directory
claude-cli --config-dir ~/.config/claude

# Enable debug logging
claude-cli --debug

# Set working directory
claude-cli --working-dir /path/to/project
```

### Command Line Arguments

- `--model <MODEL>` - Specify the Claude model to use
- `--api-key <KEY>` - Provide API key (or use ANTHROPIC_API_KEY env var)
- `--config-dir <DIR>` - Configuration directory path
- `--working-dir <DIR>` - Working directory for tool execution
- `--debug` - Enable debug logging
- `--verbose` - Enable verbose output
- `--no-color` - Disable colored output
- `--max-turns <N>` - Maximum conversation turns (default: 100)

### Subcommands

#### MCP Server Mode

```bash
claude-cli mcp serve
```

Starts the Model Context Protocol server for integration with other tools.

#### Version Information

```bash
claude-cli version
```

## Application Flow

### Initialization Sequence

1. **Parse CLI arguments** - Extract configuration from command line
2. **Load configuration** - Read from config directory
3. **Initialize API client** - Set up connection to Anthropic API
4. **Create tool registry** - Prepare for tool execution
5. **Load plugins** - Discover and load custom plugins
6. **Load agents** - Initialize agent subsystems
7. **Execute SessionStart hooks** - Run startup hooks
8. **Start REPL** - Enter interactive mode

### REPL Loop

```
User Input
    ↓
Add to Conversation
    ↓
Send to Claude API
    ↓
Receive Response
    ↓
Display Text
    ↓
Tool Use? ──No──→ Continue
    │
    Yes
    ↓
Execute Tools (with hooks)
    ↓
Add Tool Results
    ↓
Send to Claude API
    ↓
(Loop until end_turn)
```

### Tool Execution with Hooks

```
Tool Request from Claude
    ↓
Execute PreTool Hook
    ↓
Execute Tool
    ↓
Execute PostTool Hook
    ↓
Return Result to Claude
```

### Shutdown Sequence

1. **Exit REPL** - User exits interactive mode
2. **Execute SessionEnd hooks** - Run cleanup hooks
3. **Clean shutdown** - Gracefully terminate all subsystems

## Interactive Commands

While in the REPL, the following commands are available:

- **exit** or **quit** - Exit the CLI
- **clear** - Clear conversation history
- **help** - Display help message with available tools
- **Ctrl+D** - Exit the CLI
- **Ctrl+C** - Interrupt current input

## Configuration

The CLI uses configuration from the following sources (in priority order):

1. Command line arguments
2. Configuration file (`~/.config/claude/config.toml`)
3. Environment variables
   - `ANTHROPIC_API_KEY` - API key
   - `CLAUDE_MODEL` - Default model
   - `CLAUDE_CONFIG_DIR` - Configuration directory
   - `CLAUDE_WORKING_DIR` - Working directory

## Features

### Colored Output

The REPL uses colored output for better readability:
- **Green** - User prompt (>>>)
- **Blue** - Assistant label
- **Cyan** - System messages
- **Yellow** - Warnings
- **Red** - Errors
- **Gray** - Status messages

### Conversation Management

- Maintains full conversation history
- Automatic context window management
- Support for multi-turn conversations
- Tool use and results tracking

### Error Handling

- Graceful error recovery
- Detailed error messages
- Tool execution error reporting
- API error handling

## Dependencies

### Internal Dependencies

- `claude-core` - Core types and traits
- `claude-api` - Anthropic API client
- `claude-config` - Configuration management
- `claude-tools` - Tool execution system
- `claude-plugins` - Plugin system
- `claude-hooks` - Hook execution
- `claude-agents` - Agent subsystems
- `claude-mcp` - Model Context Protocol

### External Dependencies

- `clap` - Command line argument parsing
- `tokio` - Async runtime
- `anyhow` - Error handling
- `tracing` - Structured logging
- `colored` - Terminal colors
- `rustyline` - Line editing with history
- `dirs` - Platform-specific directories

## Development

### Building

```bash
cargo build -p claude-cli
```

### Running

```bash
cargo run -p claude-cli
```

### Testing

```bash
cargo test -p claude-cli
```

## Examples

### Basic Conversation

```bash
$ claude-cli
Claude CLI - Interactive Mode
Type your message and press Enter. Use Ctrl+D or 'exit' to quit.

>>> Hello! Can you help me write a Python script?
Assistant:
Of course! I'd be happy to help you write a Python script. What would you like
the script to do?

>>> I need a script to list all .py files in a directory
Executing 1 tool(s)...
Assistant:
I can help you create a script to list all Python files. Let me create it...
```

### Using Custom Model

```bash
$ claude-cli --model claude-opus-4-5-20250929
```

### Debug Mode

```bash
$ claude-cli --debug
2025-11-13T21:00:00.000Z INFO Starting Claude CLI
2025-11-13T21:00:00.123Z INFO Creating new App instance
2025-11-13T21:00:00.234Z INFO Registering built-in tools
...
```

## Future Enhancements

- [ ] Streaming responses for faster feedback
- [ ] Multi-file conversation context
- [ ] Session persistence and restoration
- [ ] Custom prompt templates
- [ ] Plugin marketplace integration
- [ ] Advanced conversation management
- [ ] Integration with code editors

## License

MIT
