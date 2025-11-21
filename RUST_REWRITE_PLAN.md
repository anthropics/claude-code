# Claude Code Rust Rewrite - Parallel Execution Plan

## Architecture Overview

```
claude-code-rust/
├── Cargo.toml                    # Workspace manifest
├── crates/
│   ├── claude-core/              # Core types and traits
│   ├── claude-api/               # Anthropic API client
│   ├── claude-tools/             # Tool execution system
│   ├── claude-mcp/               # MCP protocol implementation
│   ├── claude-plugins/           # Plugin system
│   ├── claude-hooks/             # Hook system
│   ├── claude-agents/            # Agent orchestration
│   ├── claude-config/            # Configuration management
│   ├── claude-session/           # Session management
│   └── claude-cli/               # CLI application (binary)
└── README.md
```

## Parallel Execution Strategy

### Phase 1: Foundation (Parallel - 5 agents)
**Agent 1**: Project setup + Core types
**Agent 2**: API client with streaming
**Agent 3**: Configuration management
**Agent 4**: Tool execution framework
**Agent 5**: Plugin system basics

### Phase 2: Advanced Features (Parallel - 5 agents)
**Agent 1**: MCP protocol implementation
**Agent 2**: Hook system
**Agent 3**: Agent orchestration
**Agent 4**: Built-in tools (Bash, Read, Write, Edit, etc.)
**Agent 5**: CLI interface

### Phase 3: Integration (Parallel - 3 agents)
**Agent 1**: Session management
**Agent 2**: Integration testing
**Agent 3**: Documentation and build

## Crate Dependencies

### claude-core
**Purpose**: Core types, traits, and error handling
**Dependencies**:
- serde
- serde_json
- thiserror
- anyhow

**Key Types**:
```rust
// Tool system
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn execute(&self, input: ToolInput) -> ToolResult;
}

// Error handling
pub enum ClaudeError {
    ApiError(String),
    ToolError(String),
    PluginError(String),
    McpError(String),
    ConfigError(String),
}

// Common types
pub struct ToolInput(serde_json::Value);
pub struct ToolResult(serde_json::Value);
pub struct SessionId(String);
```

### claude-api
**Purpose**: Anthropic API client with streaming support
**Dependencies**:
- reqwest
- tokio
- serde_json
- futures

**Features**:
- Streaming SSE responses
- Tool use handling
- Model selection
- Rate limiting
- Retry logic

### claude-tools
**Purpose**: Tool execution framework and built-in tools
**Dependencies**:
- tokio
- serde_json
- walkdir
- globset
- regex
- ripgrep (grep-rs)

**Built-in Tools**:
- Bash (with background execution)
- Read, Write, Edit, MultiEdit
- Glob, Grep
- LS
- WebFetch, WebSearch
- TodoWrite
- Task (agent launcher)

### claude-mcp
**Purpose**: MCP protocol (client and server modes)
**Dependencies**:
- tokio
- serde_json
- async-trait

**Features**:
- JSON-RPC over stdio
- Tool discovery
- Request/response handling
- Server process management
- Docker integration

### claude-plugins
**Purpose**: Plugin system (loading, parsing, execution)
**Dependencies**:
- pulldown-cmark (markdown parsing)
- serde_yaml (frontmatter)
- walkdir
- notify (file watching)

**Features**:
- Markdown command parsing
- Frontmatter extraction
- Plugin discovery
- Agent definition loading
- Dynamic context injection (`!` syntax)

### claude-hooks
**Purpose**: Hook system (PreToolUse, PostToolUse, SessionStart)
**Dependencies**:
- tokio
- serde_json
- regex (matcher patterns)

**Features**:
- Hook discovery from plugins
- Process execution
- JSON stdin/stdout protocol
- Exit code handling
- Hook chaining

### claude-agents
**Purpose**: Multi-agent orchestration
**Dependencies**:
- tokio
- claude-core
- claude-api
- claude-tools

**Features**:
- Parallel agent execution
- Context isolation
- Result aggregation
- Tool permission filtering
- Model selection per agent

### claude-config
**Purpose**: Configuration management
**Dependencies**:
- serde
- toml
- serde_json
- dirs (home directory)

**Features**:
- Hierarchical config (user/project)
- Environment variable support
- MCP server configuration
- Plugin settings
- CLI argument parsing

### claude-session
**Purpose**: Session state management
**Dependencies**:
- uuid
- tokio
- serde_json

**Features**:
- Session ID generation
- State persistence
- Background shell tracking
- Session cleanup

### claude-cli
**Purpose**: Main CLI binary
**Dependencies**:
- clap
- tokio
- All other crates

**Features**:
- Command parsing
- Main event loop
- Terminal UI
- Signal handling

## Key Design Decisions

### 1. Workspace Structure
Use Cargo workspace for clean separation and parallel development

### 2. Async/Await
All I/O operations use tokio for concurrency

### 3. Plugin Compatibility
Maintain 100% compatibility with existing markdown-based plugins

### 4. Tool System
Trait-based design allows easy extension

### 5. Error Handling
Use thiserror for library errors, anyhow for application errors

### 6. Performance
- Lazy loading of plugins
- Parallel tool execution where possible
- Efficient file operations
- Streaming API responses

## Implementation Order

### Phase 1 (Parallel)
1. **Agent 1**: Create workspace, core types, error handling
2. **Agent 2**: Implement API client with streaming
3. **Agent 3**: Configuration system
4. **Agent 4**: Tool framework (trait + registry)
5. **Agent 5**: Plugin parser (markdown + frontmatter)

### Phase 2 (Parallel)
1. **Agent 1**: MCP client and server
2. **Agent 2**: Hook system
3. **Agent 3**: Agent orchestration
4. **Agent 4**: Built-in tools (Bash, Read, Write, Edit, Glob, Grep, LS)
5. **Agent 5**: CLI interface with clap

### Phase 3 (Parallel)
1. **Agent 1**: Session management
2. **Agent 2**: Integration tests
3. **Agent 3**: Documentation + README + build scripts

## Testing Strategy

### Unit Tests
Each crate has comprehensive unit tests

### Integration Tests
Test complete workflows:
- Plugin loading and execution
- MCP client/server communication
- Hook interception
- Agent orchestration
- Tool execution

### Compatibility Tests
Verify with existing Claude Code plugins:
- frontend-design
- code-review
- oncall-triage

## Success Criteria

1. ✅ Can load and execute existing markdown-based plugins
2. ✅ Compatible with existing .claude/ configuration
3. ✅ MCP protocol works with existing MCP servers
4. ✅ Hook system works with existing Python/shell hooks
5. ✅ Faster startup time than Node.js version
6. ✅ Lower memory footprint
7. ✅ All built-in tools functional
8. ✅ Multi-agent orchestration works

## Timeline Estimate

**With 5 parallel agents**:
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 1-2 hours
- **Total: 6-9 hours of AI time**

## Next Steps

1. Create workspace and core types
2. Launch 5 parallel agents for Phase 1
3. Review and integrate Phase 1 results
4. Launch 5 parallel agents for Phase 2
5. Review and integrate Phase 2 results
6. Launch 3 parallel agents for Phase 3
7. Final integration and testing
