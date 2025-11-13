# claude-core

Core types, traits, and error handling for Claude Code.

## Overview

`claude-core` provides the fundamental building blocks for the Claude Code Rust implementation. It includes:

- **Error handling**: Comprehensive error types using `thiserror`
- **Tool abstractions**: Trait-based tool system with async execution
- **Core types**: Message structures, roles, content blocks, and model configuration
- **Type safety**: All types are serializable with `serde` and forbid unsafe code

## Features

### Error Handling

The `ClaudeError` enum provides structured error handling for all Claude Code operations:

```rust
use claude_core::{ClaudeError, Result};

fn example() -> Result<()> {
    // Create specific error types
    let err = ClaudeError::config("Invalid configuration");
    let err = ClaudeError::api("API request failed");
    let err = ClaudeError::tool("Tool execution failed");

    // Errors are automatically converted from std::io::Error and serde_json::Error
    let file = std::fs::read_to_string("config.json")?;
    let config: Config = serde_json::from_str(&file)?;

    Ok(())
}
```

### Tool System

Define and execute tools that Claude can use:

```rust
use claude_core::{Tool, ToolInput, ToolResult};
use async_trait::async_trait;
use serde_json::json;

struct SearchTool;

#[async_trait]
impl Tool for SearchTool {
    fn name(&self) -> &str {
        "search"
    }

    fn description(&self) -> &str {
        "Search for information"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query"
                }
            },
            "required": ["query"]
        })
    }

    async fn execute(&self, input: ToolInput) -> claude_core::Result<ToolResult> {
        let query = input.get("query").and_then(|v| v.as_str()).unwrap_or("");
        // Perform search...
        Ok(ToolResult::success(json!({
            "results": ["result1", "result2"]
        })))
    }
}
```

### Tool Registry

Manage and execute multiple tools:

```rust
use claude_core::{ToolRegistry, ToolInput};
use serde_json::json;

#[tokio::main]
async fn main() {
    let mut registry = ToolRegistry::new();

    // Register tools
    registry.register(SearchTool);
    registry.register(CalculatorTool);

    // Execute a tool
    let input = ToolInput::new(json!({"query": "rust async"})).unwrap();
    let result = registry.execute("search", input).await.unwrap();

    // Get tool descriptions for API requests
    let definitions = registry.tool_descriptions();
}
```

### Core Types

Work with messages and model configuration:

```rust
use claude_core::{Message, Role, ContentBlock, ModelConfig};

// Create messages
let msg = Message::user("Hello, Claude!");
let msg = Message::assistant("Hi! How can I help you?");

// Multi-content messages
let msg = Message::new(Role::User, vec![
    ContentBlock::text("Analyze this image:"),
    ContentBlock::tool_use("img-1", "read_image", json!({"path": "image.png"}))
]);

// Configure the model
let config = ModelConfig::new("claude-3-5-sonnet-20241022")
    .with_max_tokens(4096)
    .with_temperature(0.7)
    .with_system("You are a helpful coding assistant");
```

## Safety

This crate uses `#![forbid(unsafe_code)]` to ensure memory safety and reliability.

## Testing

All modules include comprehensive unit tests. Run them with:

```bash
cargo test -p claude-core
```

## Dependencies

- `serde` - Serialization/deserialization
- `serde_json` - JSON support
- `thiserror` - Error handling
- `anyhow` - Error context
- `async-trait` - Async trait support

## License

MIT
