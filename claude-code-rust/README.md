# Claude Code - Rust Rewrite

A high-performance Rust implementation of the Claude Code CLI tool.

## Architecture

This project is organized as a Cargo workspace with the following crates:

- **claude-core**: Core types, traits, and error handling
- **claude-api**: Anthropic API client with streaming support
- **claude-tools**: Tool execution framework and built-in tools
- **claude-mcp**: MCP (Model Context Protocol) implementation
- **claude-plugins**: Plugin system for commands and agents
- **claude-hooks**: Hook system for tool interception
- **claude-agents**: Multi-agent orchestration
- **claude-config**: Configuration management
- **claude-session**: Session state management
- **claude-cli**: Main CLI application

## Features

- ✅ 100% compatible with existing Claude Code plugins
- ✅ Faster startup and execution
- ✅ Lower memory footprint
- ✅ Multi-agent parallel execution
- ✅ MCP client and server modes
- ✅ Hook system for customization
- ✅ Streaming API responses

## Building

```bash
cargo build --release
```

The binary will be at `target/release/claude-cli`

## Running

```bash
./target/release/claude-cli
```

## Development

Each crate can be developed independently:

```bash
cd crates/claude-core
cargo test
```

## License

MIT
