# Built-in Tools Documentation

This document describes all built-in tools available in the `claude-tools` crate.

## Overview

The `claude-tools` crate provides 7 essential built-in tools for file operations, system commands, and search functionality. All tools can be registered at once using the `register_built_in_tools()` function.

## Quick Start

```rust
use claude_tools::{register_built_in_tools, ToolExecutorBuilder, ToolRegistry};

let mut registry = ToolRegistry::new();
register_built_in_tools(&mut registry);

let executor = ToolExecutorBuilder::new()
    .with_registry(registry)
    .build_with_allow_all();
```

## Tools

### 1. Bash Tool

Execute shell commands with timeout support and background execution.

**Capabilities:**
- Execute shell commands via bash
- Configurable timeout (default: 120 seconds)
- Background process execution
- Process tracking with shell IDs
- Captures stdout, stderr, and exit codes

**Input Schema:**
```json
{
  "command": "string (required)",
  "description": "string (optional)",
  "timeout": "number (optional, milliseconds)",
  "run_in_background": "boolean (optional)"
}
```

**Example:**
```rust
let result = executor.execute(
    "Bash",
    ToolInput::new(json!({
        "command": "echo 'Hello'",
        "timeout": 5000
    }))?
).await?;
```

### 2. Read Tool

Read file contents with optional line range support.

**Capabilities:**
- Read file contents with line numbers
- Optional line offset and limit
- Lines longer than 2000 chars are truncated
- cat -n style formatting with line numbers

**Input Schema:**
```json
{
  "file_path": "string (required, absolute path)",
  "offset": "number (optional, line to start from)",
  "limit": "number (optional, number of lines)"
}
```

**Example:**
```rust
let result = executor.execute(
    "Read",
    ToolInput::new(json!({
        "file_path": "/path/to/file.txt",
        "offset": 10,
        "limit": 50
    }))?
).await?;
```

### 3. Write Tool

Write content to files, creating directories as needed.

**Capabilities:**
- Write string content to files
- Overwrites existing files
- Creates parent directories automatically
- Returns bytes written count

**Input Schema:**
```json
{
  "file_path": "string (required, absolute path)",
  "content": "string (required)"
}
```

**Example:**
```rust
let result = executor.execute(
    "Write",
    ToolInput::new(json!({
        "file_path": "/path/to/new_file.txt",
        "content": "Hello, World!"
    }))?
).await?;
```

### 4. Edit Tool

Perform exact string replacements in files.

**Capabilities:**
- Replace exact string matches
- Replace first occurrence or all occurrences
- Validates string exists before replacement
- Prevents ambiguous replacements (requires unique match or replace_all)

**Input Schema:**
```json
{
  "file_path": "string (required, absolute path)",
  "old_string": "string (required)",
  "new_string": "string (required)",
  "replace_all": "boolean (optional, default: false)"
}
```

**Example:**
```rust
let result = executor.execute(
    "Edit",
    ToolInput::new(json!({
        "file_path": "/path/to/file.txt",
        "old_string": "old text",
        "new_string": "new text",
        "replace_all": true
    }))?
).await?;
```

### 5. Glob Tool

Find files using glob patterns.

**Capabilities:**
- Supports standard glob patterns (*, **, ?, [abc])
- Recursive directory traversal
- Results sorted by modification time (most recent first)
- Literal path separator matching

**Input Schema:**
```json
{
  "pattern": "string (required, e.g., '**/*.rs')",
  "path": "string (optional, base directory)"
}
```

**Example:**
```rust
let result = executor.execute(
    "Glob",
    ToolInput::new(json!({
        "pattern": "**/*.rs",
        "path": "/path/to/project"
    }))?
).await?;
```

### 6. Grep Tool

Search file contents using regex patterns.

**Capabilities:**
- Full regex pattern support
- Multiple output modes: content, files_with_matches, count
- Context lines support (-A, -B, -C)
- Case-insensitive search
- Multiline matching
- Glob filtering
- Result limiting

**Input Schema:**
```json
{
  "pattern": "string (required, regex pattern)",
  "path": "string (optional, directory/file)",
  "glob": "string (optional, file filter)",
  "output_mode": "enum (content|files_with_matches|count)",
  "-i": "boolean (case insensitive)",
  "-A": "number (lines after)",
  "-B": "number (lines before)",
  "-C": "number (lines before and after)",
  "multiline": "boolean (enable multiline mode)",
  "head_limit": "number (limit results)"
}
```

**Example:**
```rust
// Find all files containing "TODO"
let result = executor.execute(
    "Grep",
    ToolInput::new(json!({
        "pattern": "TODO",
        "path": "/path/to/project",
        "glob": "*.rs",
        "output_mode": "content",
        "-C": 2
    }))?
).await?;
```

### 7. Ls Tool

List directory contents.

**Capabilities:**
- Simple and long listing formats
- Hidden file support
- Shows file type, size, and modification time (in long format)
- Sorts directories first, then alphabetically

**Input Schema:**
```json
{
  "path": "string (optional, default: current directory)",
  "all": "boolean (show hidden files)",
  "long": "boolean (use long format)"
}
```

**Example:**
```rust
let result = executor.execute(
    "Ls",
    ToolInput::new(json!({
        "path": "/path/to/directory",
        "all": true,
        "long": true
    }))?
).await?;
```

## Implementation Details

### Dependencies

The built-in tools use the following crates:
- `tokio` - Async runtime and process execution
- `walkdir` - Directory traversal
- `globset` - Glob pattern matching
- `regex` - Regular expression support
- `grep-searcher`, `grep-matcher`, `grep-regex` - Fast content searching

### Error Handling

All tools return `ToolResult` with:
- `success: bool` - Whether execution succeeded
- `output: Option<Value>` - Tool-specific output data
- `error: Option<String>` - Error message if failed

### Async Operations

All tools use async file I/O via `tokio::fs` for optimal performance.

## Testing

The crate includes comprehensive tests for all tools:

```bash
cargo test
```

Run the demo example:

```bash
cargo run --example built_in_tools_demo
```

## Architecture

```
claude-tools/
├── src/
│   ├── bash.rs         - Shell command execution
│   ├── file_ops.rs     - Read, Write, Edit tools
│   ├── search.rs       - Glob and Grep tools
│   ├── ls.rs           - Directory listing
│   └── lib.rs          - Tool registration
├── examples/
│   └── built_in_tools_demo.rs
└── Cargo.toml
```

## Performance Characteristics

- **Bash**: Spawns processes via tokio, timeout-controlled
- **Read/Write/Edit**: Async file I/O, efficient for large files
- **Glob**: Fast pattern matching via globset
- **Grep**: Uses ripgrep's matching engine for high performance
- **Ls**: Single-pass directory reading

## Security Considerations

- All tools validate input paths
- Bash tool respects timeout limits
- No arbitrary code execution beyond bash commands
- Tools operate with process permissions

## Future Enhancements

Potential improvements:
- BashOutput tool for reading background process output
- KillShell tool for terminating background processes
- NotebookEdit for Jupyter notebook manipulation
- WebFetch for HTTP requests
- More granular permission controls
