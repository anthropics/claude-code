# Contributing to Claude Code (Rust Implementation)

Thank you for your interest in contributing! This guide will help you get started with the development workflow.

## Development Setup

### Prerequisites

1. **Rust toolchain** (1.80+):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

2. **Git**:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

3. **Recommended tools**:
   ```bash
   cargo install cargo-watch      # For auto-rebuild
   cargo install cargo-edit       # For dependency management
   cargo install cargo-audit      # For security auditing
   cargo install cargo-clippy     # For linting (usually included)
   ```

### Repository Structure

```
claude-code/
├── rust/                    # Rust implementation
│   ├── crates/             # Workspace crates
│   │   ├── claude-core/    # Core types
│   │   ├── claude-api/     # API client
│   │   ├── claude-engine/  # Query engine
│   │   ├── claude-tui/     # Terminal UI
│   │   ├── claude-tools/   # Tool implementations
│   │   └── ...
│   ├── tests/              # Integration tests
│   └── Cargo.toml         # Workspace config
└── ... (TypeScript original)
```

## Development Workflow

### 1. Building

```bash
cd rust/

# Debug build (faster compilation)
cargo build

# Release build (optimized)
cargo build --release

# Build specific crate
cargo build -p claude-core
```

### 2. Testing

```bash
# Run all tests
cargo test

# Run tests with output visible
cargo test -- --nocapture

# Run specific test
cargo test test_engine_creation

# Run tests for specific crate
cargo test -p claude-core

# Run with all features
cargo test --all-features
```

### 3. Linting

```bash
# Run clippy (linter)
cargo clippy --all-targets --all-features

# Run formatter
cargo fmt --all

# Check formatting without modifying
cargo fmt --all -- --check

# Security audit
cargo audit
```

### 4. Documentation

```bash
# Generate and open docs
cargo doc --open

# Generate docs for all features
cargo doc --all-features
```

## Code Style

### Formatting

We use the default `rustfmt` configuration. Run `cargo fmt` before committing.

### Naming Conventions

- **Types (structs, enums, traits)**: PascalCase (`QueryEngine`, `MessageRole`)
- **Functions, methods, variables**: snake_case (`execute_query`, `message_id`)
- **Constants, statics**: SCREAMING_SNAKE_CASE (`MAX_MESSAGE_SIZE`)
- **Modules**: snake_case (`query_engine`, `tool_orchestrator`)
- **Macros**: snake_case (`log_message!`)
- **Crate names**: kebab-case with `claude-` prefix (`claude-core`, `claude-tui`)

### Documentation

All public items must have doc comments:

```rust
/// Represents a chat session with Claude.
///
/// Sessions maintain conversation history and can be persisted
/// across application restarts.
pub struct Session {
    // ...
}
```

### Error Handling

Use `thiserror` for error types and `anyhow` for application-level errors:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("API request failed: {0}")]
    Api(#[from] ApiError),
    
    #[error("Tool execution failed: {0}")]
    Tool(String),
    
    #[error("Invalid state: {message}")]
    InvalidState { message: String },
}
```

### Async/Await

- Use `async-trait` for trait methods
- Prefer `tokio` for async runtime
- Use `spawn` for fire-and-forget tasks
- Use `join!` for concurrent operations

```rust
use async_trait::async_trait;

#[async_trait]
pub trait Tool: Send + Sync {
    async fn execute(&self, params: Value) -> Result<Value, ToolError>;
}

// Concurrent execution
let (result1, result2) = tokio::join!(
    tool1.execute(params1),
    tool2.execute(params2)
);
```

## Testing Guidelines

### Unit Tests

Place in the same file as the code being tested:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_creation() {
        let msg = Message::user("Hello");
        assert_eq!(msg.role(), MessageRole::User);
    }

    #[tokio::test]
    async fn test_async_operation() {
        let result = async_operation().await;
        assert!(result.is_ok());
    }
}
```

### Integration Tests

Place in `tests/` directory at workspace root:

```rust
// tests/tool_integration.rs

#[tokio::test]
async fn test_bash_execution() {
    let bash = Bash::new(30);
    let result = bash.execute(json!({"command": "echo test"})).await;
    assert!(result.is_ok());
}
```

### Test Organization

- Unit tests: Test individual functions and types
- Integration tests: Test component interactions
- Use `tempfile` for file operations in tests
- Use `wiremock` for HTTP mocking

## Adding Features

### New Tool

1. Create module in `claude-tools/src/`:

```rust
// crates/claude-tools/src/new_tool.rs

use async_trait::async_trait;
use serde_json::json;
use claude_core::{Tool, ToolDefinition, ToolError};

pub struct NewTool;

impl NewTool {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Tool for NewTool {
    fn name(&self) -> &str {
        "NewTool"
    }

    fn description(&self) -> &str {
        "Description for LLM"
    }

    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: self.name().to_string(),
            description: self.description().to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "arg": { "type": "string" }
                },
                "required": ["arg"]
            }),
        }
    }

    async fn execute(&self, params: serde_json::Value) -> Result<serde_json::Value, ToolError> {
        // Implementation
        Ok(json!({"result": "success"}))
    }
}
```

2. Export in `claude-tools/src/lib.rs`:

```rust
pub mod new_tool;
pub use new_tool::NewTool;
```

3. Register in `claude-engine/src/tool_registry.rs`

4. Add tests in the module:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_new_tool() {
        let tool = NewTool::new();
        let result = tool.execute(json!({"arg": "test"})).await;
        assert!(result.is_ok());
    }
}
```

### New Crate

1. Create directory structure:

```bash
mkdir -p crates/claude-newcrate/src
touch crates/claude-newcrate/src/lib.rs
touch crates/claude-newcrate/Cargo.toml
```

2. Add to workspace `Cargo.toml`:

```toml
[workspace]
members = [
    "crates/claude-newcrate",
    # ... existing members
]
```

3. Set up `Cargo.toml`:

```toml
[package]
name = "claude-newcrate"
version.workspace = true
edition.workspace = true
authors.workspace = true
license.workspace = true
repository.workspace = true
rust-version.workspace = true

description = "Description of the crate"

[dependencies]
# Inherit common deps from workspace where possible
serde = { workspace = true }
thiserror = { workspace = true }
tracing = { workspace = true }

# Crate-specific deps
tokio = { workspace = true }
```

## Debugging

### Logging

Use `tracing` for structured logging:

```rust
use tracing::{debug, info, warn, error};

#[instrument(skip(params))]
async fn execute_tool(&self, params: Value) -> Result<Value, ToolError> {
    info!("Executing tool with params: {:?}", params);
    
    let result = do_work().await;
    
    if result.is_err() {
        error!("Tool execution failed: {:?}", result);
    }
    
    result
}
```

Run with logging:

```bash
RUST_LOG=debug cargo run
RUST_LOG=claude_engine=trace cargo run
```

### Debugging Tests

```bash
# Run specific test with output
cargo test test_name -- --nocapture

# Run with debugger
rust-gdb --args cargo test test_name

# Use tokio-console for async debugging
cargo run --features tokio-console
```

## Submitting Changes

### Before Submitting

1. **Run all checks**:
   ```bash
   cargo fmt --all
   cargo clippy --all-targets --all-features
   cargo test --all
   cargo doc --no-deps
   ```

2. **Update documentation** if needed

3. **Add tests** for new functionality

4. **Update CHANGELOG.md** following [Keep a Changelog](https://keepachangelog.com/)

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run all checks (see above)
5. Commit with descriptive messages
6. Push to your fork
7. Open a pull request against `main`

### PR Checklist

- [ ] Tests pass locally
- [ ] Code is formatted (`cargo fmt`)
- [ ] Clippy warnings resolved
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No new security advisories (`cargo audit`)

## Getting Help

- **Discord**: [Claude Code Community](https://discord.gg/...) *(placeholder)*
- **Issues**: [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **Documentation**: See `rust/README.md` and crate-level docs

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) Code of Conduct.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

