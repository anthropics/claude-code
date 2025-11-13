# Claude Hooks Implementation Summary

## Overview

The `claude-hooks` crate implements a comprehensive hook system for Claude Code that allows external scripts to intercept and modify behavior at key execution points.

## Architecture

### Core Components

1. **protocol.rs** (192 lines)
   - Defines JSON protocol for hook communication
   - `HookInput`: JSON sent to hook via stdin
   - `HookOutput`: JSON received from hook via stdout
   - `HookResult`: Interpreted result (Allow/Warn/Deny)
   - Exit code handling (0=allow, 1=warn, 2=deny)

2. **hook.rs** (363 lines)
   - `Hook` enum: SessionStart, PreToolUse, PostToolUse
   - `HookDefinition`: Individual hook configuration with matcher support
   - `HookConfig`: Collection of hooks loaded from JSON files
   - Regex pattern matching for tool name filtering
   - Error handling with `HookError` type

3. **discovery.rs** (296 lines)
   - `HookDiscovery`: Finds and loads hooks.json files
   - Searches multiple locations:
     - `.claude/hooks.json` (project-level)
     - `.claude/plugins/*/hooks.json` (project plugins)
     - `~/.claude/plugins/*/hooks.json` (user plugins)
   - Aggregates hooks from all sources
   - `find_project_root()`: Locates project root directory

4. **executor.rs** (332 lines)
   - `HookExecutor`: Executes hooks as external processes
   - Async execution with tokio::process::Command
   - JSON communication via stdin/stdout
   - Methods:
     - `execute_session_start_hooks()`: Returns context strings
     - `execute_pre_tool_hooks()`: Can block tool execution
     - `execute_post_tool_hooks()`: For logging/validation
   - Handles process exit codes and output parsing

5. **lib.rs** (215 lines)
   - Comprehensive documentation
   - Public API exports
   - Usage examples
   - Module organization

## Hook Execution Flow

### 1. SessionStart Hooks
```
Session Start
    ↓
Discover Hooks → Load Config → Execute Hooks → Collect Context
    ↓
Add Context to Conversation
```

- Run once at session initialization
- Can add context to the initial prompt
- Non-blocking (warnings logged, execution continues)

### 2. PreToolUse Hooks
```
Tool Call Request
    ↓
Find Matching Hooks (via regex matcher)
    ↓
Execute Each Hook Sequentially
    ↓
Check Exit Code:
  - 0: Allow (continue to next hook)
  - 1: Warn (log, continue)
  - 2: Deny (block and stop)
    ↓
If All Allow → Execute Tool
If Any Deny → Block Tool
```

- Run before tool execution
- Can block dangerous operations
- First deny stops execution chain
- Matcher patterns filter which tools trigger the hook

### 3. PostToolUse Hooks
```
Tool Execution Complete
    ↓
Find Matching Hooks
    ↓
Execute All Hooks
    ↓
Log Results (non-blocking)
```

- Run after tool execution
- Cannot block (informational only)
- Used for logging, metrics, validation

## Hook Communication Protocol

### Input Format (stdin)
```json
{
  "session_id": "unique-session-id",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/path/to/file",
    "content": "file contents"
  }
}
```

### Output Format (stdout)
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "Optional context to add",
    "message": "Optional message for warnings/denials"
  }
}
```

### Exit Codes
- **0**: Success - Allow operation, optional context
- **1**: Warning - Log to user, don't block
- **2**: Deny - Block operation, show message to Claude

## Configuration Format

### hooks.json
```json
{
  "hooks": [
    {
      "hook": "SessionStart",
      "command": "node setup.js"
    },
    {
      "hook": "PreToolUse",
      "command": "python validate.py",
      "matcher": "^(Write|Edit|NotebookEdit)$"
    },
    {
      "hook": "PostToolUse",
      "command": "bash logger.sh",
      "working_dir": "/tmp/logs"
    }
  ]
}
```

### Hook Definition Fields
- `hook`: Type (SessionStart, PreToolUse, PostToolUse)
- `command`: Command to execute (with args)
- `matcher`: Optional regex for tool name filtering
- `working_dir`: Optional working directory

## Integration with Tool Execution

### Before Tool Execution
```rust
// 1. Check PreToolUse hooks
let result = executor.execute_pre_tool_hooks(tool_name, &tool_input).await?;

match result {
    HookResult::Allow(context) => {
        // Add context if provided
        if let Some(ctx) = context {
            conversation.add_context(ctx);
        }
        // Proceed with tool execution
        execute_tool(tool_name, tool_input).await?;
    }
    HookResult::Deny(msg) => {
        // Block tool execution, inform Claude
        return Err(format!("Tool blocked by hook: {}", msg));
    }
    HookResult::Warn(msg) => {
        // Log warning, proceed anyway
        eprintln!("Warning: {}", msg);
        execute_tool(tool_name, tool_input).await?;
    }
}
```

### After Tool Execution
```rust
// Execute PostToolUse hooks (non-blocking)
executor.execute_post_tool_hooks(tool_name, &tool_result).await?;
```

## Key Features

1. **Flexible Matcher System**
   - Regex patterns for tool name filtering
   - PreToolUse/PostToolUse hooks can target specific tools
   - No matcher = applies to all tools

2. **Multi-Source Discovery**
   - Project-level hooks
   - Plugin hooks
   - User-level hooks
   - Automatic aggregation

3. **Async Execution**
   - Non-blocking with tokio
   - Proper process management
   - Stdin/stdout/stderr handling

4. **Robust Error Handling**
   - Graceful failures
   - Clear error messages
   - Warnings for hook failures

5. **Extensibility**
   - Any executable can be a hook
   - JSON protocol is language-agnostic
   - Simple exit code semantics

## Testing

Each module includes comprehensive unit tests:
- Protocol serialization/deserialization
- Hook definition creation and matching
- Config loading and filtering
- Discovery from multiple sources
- Executor basic functionality

## Dependencies

```toml
claude-core = { path = "../claude-core" }
claude-tools = { path = "../claude-tools" }
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
regex = "1.10"
anyhow = "1.0"
thiserror = "1.0"
async-trait = "0.1"
```

## Use Cases

### SessionStart Examples
- Running `npm install` or `pip install`
- Checking for required tools/dependencies
- Loading project-specific context
- Initializing development environments

### PreToolUse Examples
- Preventing writes to sensitive files
- Validating code before execution
- Enforcing coding standards
- Security checks

### PostToolUse Examples
- Logging all file modifications
- Running formatters after code changes
- Updating documentation
- Collecting metrics

## File Structure

```
crates/claude-hooks/
├── Cargo.toml              # Dependencies and metadata
├── src/
│   ├── lib.rs             # Public API and documentation (215 lines)
│   ├── protocol.rs        # Hook I/O protocol (192 lines)
│   ├── hook.rs            # Hook types and config (363 lines)
│   ├── discovery.rs       # Hook discovery (296 lines)
│   └── executor.rs        # Hook execution (332 lines)
└── IMPLEMENTATION.md      # This file

Total: ~1,400 lines of Rust code
```

## Status

✅ Complete implementation of all required components
✅ Comprehensive documentation
✅ Unit tests for all modules
✅ Proper error handling
✅ Async execution support

Note: The crate will compile once the `claude-tools` dependency issues are resolved.
