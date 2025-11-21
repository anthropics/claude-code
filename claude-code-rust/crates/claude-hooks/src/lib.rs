//! # Claude Hooks
//!
//! Hook system for Claude Code that enables custom behavior at key execution points.
//!
//! ## Overview
//!
//! The hook system allows external scripts and programs to intercept and modify
//! Claude Code's behavior at three key points:
//!
//! - **SessionStart**: Runs when a new session begins, can add context to the prompt
//! - **PreToolUse**: Runs before tool execution, can block or allow the tool
//! - **PostToolUse**: Runs after tool execution, for logging and validation
//!
//! ## Hook Execution Model
//!
//! Hooks are executed as external processes that communicate via JSON:
//!
//! ### Input (via stdin)
//! ```json
//! {
//!   "session_id": "abc-123",
//!   "tool_name": "Write",
//!   "tool_input": {
//!     "file_path": "/path/to/file",
//!     "content": "..."
//!   }
//! }
//! ```
//!
//! ### Output (via stdout)
//! ```json
//! {
//!   "hookSpecificOutput": {
//!     "hookEventName": "PreToolUse",
//!     "additionalContext": "Validation passed",
//!     "message": "Optional message"
//!   }
//! }
//! ```
//!
//! ### Exit Codes
//! - **0**: Success, allow the operation (optional JSON output for context)
//! - **1**: Warning, log to user but don't block
//! - **2**: Deny, block the operation and show message to Claude
//!
//! ## Hook Configuration
//!
//! Hooks are defined in `hooks.json` files:
//!
//! ```json
//! {
//!   "hooks": [
//!     {
//!       "hook": "SessionStart",
//!       "command": "node setup.js"
//!     },
//!     {
//!       "hook": "PreToolUse",
//!       "command": "python validate.py",
//!       "matcher": "^(Write|Edit)$"
//!     },
//!     {
//!       "hook": "PostToolUse",
//!       "command": "bash log.sh",
//!       "working_dir": "/tmp/logs"
//!     }
//!   ]
//! }
//! ```
//!
//! ## Hook Discovery
//!
//! Hooks are discovered from:
//! - `.claude/hooks.json` - Project-level hooks
//! - `.claude/plugins/*/hooks.json` - Project plugin hooks
//! - `~/.claude/plugins/*/hooks.json` - User-level plugin hooks
//!
//! ## Usage Example
//!
//! ```rust,no_run
//! use claude_hooks::{HookDiscovery, HookExecutor, HookResult};
//! use serde_json::json;
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Discover hooks from default locations
//!     let project_root = std::path::Path::new(".");
//!     let config = HookDiscovery::discover_default_hooks(project_root)?;
//!
//!     // Create executor
//!     let executor = HookExecutor::new(config, "session-123".to_string());
//!
//!     // Run SessionStart hooks
//!     let contexts = executor.execute_session_start_hooks().await?;
//!     for context in contexts {
//!         println!("Additional context: {}", context);
//!     }
//!
//!     // Check PreToolUse hooks before executing a tool
//!     let tool_input = json!({
//!         "file_path": "/path/to/file.txt",
//!         "content": "Hello, world!"
//!     });
//!
//!     let result = executor.execute_pre_tool_hooks("Write", &tool_input).await?;
//!
//!     match result {
//!         HookResult::Allow(context) => {
//!             println!("Tool execution allowed");
//!             if let Some(ctx) = context {
//!                 println!("Context: {}", ctx);
//!             }
//!             // Proceed with tool execution...
//!         }
//!         HookResult::Deny(msg) => {
//!             println!("Tool execution denied: {}", msg);
//!             // Do not execute the tool
//!         }
//!         HookResult::Warn(msg) => {
//!             println!("Warning: {}", msg);
//!             // Proceed with tool execution anyway
//!         }
//!     }
//!
//!     // Run PostToolUse hooks after execution
//!     let tool_result = json!({"success": true});
//!     executor.execute_post_tool_hooks("Write", &tool_result).await?;
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Hook Types
//!
//! ### SessionStart
//!
//! SessionStart hooks run once at the beginning of each session. They can:
//! - Initialize development environments
//! - Check system requirements
//! - Add context about the project to the conversation
//!
//! Example use cases:
//! - Running `npm install` or `pip install`
//! - Checking for required tools
//! - Loading project-specific context
//!
//! ### PreToolUse
//!
//! PreToolUse hooks run before each tool execution. They can:
//! - Validate tool inputs
//! - Block dangerous operations
//! - Add warnings or context
//!
//! Example use cases:
//! - Preventing writes to sensitive files
//! - Validating code before execution
//! - Enforcing coding standards
//!
//! ### PostToolUse
//!
//! PostToolUse hooks run after each tool execution. They can:
//! - Log tool usage
//! - Collect metrics
//! - Trigger follow-up actions
//!
//! Example use cases:
//! - Logging all file modifications
//! - Running formatters after code changes
//! - Updating documentation
//!
//! ## Matcher Patterns
//!
//! PreToolUse and PostToolUse hooks can specify a `matcher` regex pattern
//! to filter which tools they apply to:
//!
//! ```json
//! {
//!   "hook": "PreToolUse",
//!   "command": "validate.sh",
//!   "matcher": "^(Write|Edit|NotebookEdit)$"
//! }
//! ```
//!
//! If no matcher is specified, the hook applies to all tools.

pub mod discovery;
pub mod executor;
pub mod hook;
pub mod protocol;

// Re-export main types
pub use discovery::{find_project_root, HookDiscovery};
pub use executor::HookExecutor;
pub use hook::{Hook, HookConfig, HookDefinition, HookError};
pub use protocol::{HookInput, HookOutput, HookResult, HookSpecificOutput};

/// Version of the hook system.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }

    #[test]
    fn test_hook_types() {
        assert_eq!(Hook::SessionStart.as_str(), "SessionStart");
        assert_eq!(Hook::PreToolUse.as_str(), "PreToolUse");
        assert_eq!(Hook::PostToolUse.as_str(), "PostToolUse");
    }
}
