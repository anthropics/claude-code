//! Tool execution framework for Claude Code
//!
//! This crate provides a comprehensive framework for executing tools in Claude Code.
//! It includes:
//! - Permission system for controlling tool access
//! - Tool executor with validation and error handling
//! - Example tools for testing and demonstration
//!
//! # Architecture
//!
//! The tool framework consists of several key components:
//!
//! ## Core Types (from claude-core)
//! - `Tool` trait: The base trait all tools must implement
//! - `ToolInput`: Input parameters for tool execution
//! - `ToolResult`: Result of tool execution
//! - `ToolRegistry`: Central registry for managing tools
//!
//! ## Permission System
//! - `ToolPermission`: Allow, Deny, or Prompt for tool execution
//! - `PermissionRule`: Rules for matching tools with patterns
//! - `PermissionChecker`: Trait for checking permissions
//! - `DefaultPermissionChecker`: Default implementation with rule-based checking
//!
//! ## Execution
//! - `ToolExecutor`: High-level executor with permission checking
//! - `ToolExecutorBuilder`: Builder pattern for creating executors
//!
//! ## Example Tools
//! - `EchoTool`: Simple tool for testing and demonstration
//!
//! # Quick Start
//!
//! ```rust
//! use claude_tools::{EchoTool, ToolExecutorBuilder};
//! use claude_core::ToolInput;
//! use serde_json::json;
//!
//! #[tokio::main]
//! async fn main() {
//!     // Create an executor with the Echo tool
//!     let executor = ToolExecutorBuilder::new()
//!         .register_tool(EchoTool::new())
//!         .build_with_allow_all();
//!
//!     // Execute the tool
//!     let input = ToolInput::new(json!({
//!         "message": "Hello, World!"
//!     })).unwrap();
//!
//!     let result = executor.execute("Echo", input).await.unwrap();
//!     println!("Result: {:?}", result);
//! }
//! ```
//!
//! # Adding New Tools
//!
//! To add a new tool:
//!
//! 1. Implement the `Tool` trait from `claude-core`:
//!
//! ```rust
//! use claude_core::{Tool, ToolInput, ToolResult, Result};
//! use async_trait::async_trait;
//! use serde_json::json;
//!
//! struct MyTool;
//!
//! #[async_trait]
//! impl Tool for MyTool {
//!     fn name(&self) -> &str {
//!         "MyTool"
//!     }
//!
//!     fn description(&self) -> &str {
//!         "Description of what my tool does"
//!     }
//!
//!     async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
//!         // Tool implementation
//!         Ok(ToolResult::success(json!({"result": "success"})))
//!     }
//! }
//! ```
//!
//! 2. Register it with the executor:
//!
//! ```rust
//! # use claude_tools::ToolExecutorBuilder;
//! # use claude_core::{Tool, ToolInput, ToolResult, Result};
//! # use async_trait::async_trait;
//! # use serde_json::json;
//! # struct MyTool;
//! # #[async_trait]
//! # impl Tool for MyTool {
//! #     fn name(&self) -> &str { "MyTool" }
//! #     fn description(&self) -> &str { "A tool" }
//! #     async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
//! #         Ok(ToolResult::success(json!({})))
//! #     }
//! # }
//! let executor = ToolExecutorBuilder::new()
//!     .register_tool(MyTool)
//!     .build_with_allow_all();
//! ```
//!
//! # Permission System
//!
//! The permission system supports wildcard patterns for fine-grained control:
//!
//! ```rust
//! use claude_tools::permission::{DefaultPermissionChecker, PermissionRule, ToolPermission};
//! use std::sync::Arc;
//!
//! let mut checker = DefaultPermissionChecker::prompt_all();
//!
//! // Allow all git commands via Bash
//! checker.add_rule(PermissionRule::new("Bash:git *", ToolPermission::Allow));
//!
//! // Deny all Write operations
//! checker.add_rule(PermissionRule::new("Write", ToolPermission::Deny));
//!
//! // Allow reading from /safe/* only
//! checker.add_rule(PermissionRule::new("Read:/safe/*", ToolPermission::Allow));
//! ```
//!
//! # Safety
//! This crate forbids unsafe code to ensure memory safety and reliability.

#![forbid(unsafe_code)]

pub mod bash;
pub mod echo;
pub mod executor;
pub mod file_ops;
pub mod ls;
pub mod permission;
pub mod search;

// Re-export commonly used types
pub use bash::BashTool;
pub use echo::EchoTool;
pub use executor::{ToolExecutor, ToolExecutorBuilder};
pub use file_ops::{EditTool, ReadTool, WriteTool};
pub use ls::LsTool;
pub use permission::{
    DefaultPermissionChecker, PermissionChecker, PermissionRule, ToolPermission,
};
pub use search::{GlobTool, GrepTool};

// Re-export core types for convenience
pub use claude_core::{Tool, ToolInput, ToolRegistry, ToolResult};

/// Register all built-in tools with a tool registry
///
/// This is a convenience function that registers all the standard tools
/// that come with claude-tools. The registered tools include:
///
/// - Bash: Execute shell commands
/// - Read: Read file contents
/// - Write: Write file contents
/// - Edit: Edit files by replacing text
/// - Glob: Find files using glob patterns
/// - Grep: Search file contents using regex
/// - Ls: List directory contents
///
/// # Example
///
/// ```rust
/// use claude_tools::{register_built_in_tools, ToolExecutorBuilder};
/// use claude_core::ToolRegistry;
///
/// #[tokio::main]
/// async fn main() {
///     let mut registry = ToolRegistry::new();
///     register_built_in_tools(&mut registry);
///
///     let executor = ToolExecutorBuilder::new()
///         .with_registry(registry)
///         .build_with_allow_all();
/// }
/// ```
pub fn register_built_in_tools(registry: &mut ToolRegistry) {
    registry.register(BashTool::new());
    registry.register(ReadTool::new());
    registry.register(WriteTool::new());
    registry.register(EditTool::new());
    registry.register(GlobTool::new());
    registry.register(GrepTool::new());
    registry.register(LsTool::new());
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_basic_workflow() {
        // Create an executor with an echo tool
        let executor = ToolExecutorBuilder::new()
            .register_tool(EchoTool::new())
            .build_with_allow_all();

        // List tools
        let tools = executor.list_tools().await;
        assert_eq!(tools, vec!["Echo"]);

        // Execute the tool
        let input = ToolInput::new(json!({
            "message": "Test message"
        }))
        .unwrap();

        let result = executor.execute("Echo", input).await.unwrap();
        assert!(result.success);
        assert_eq!(result.output.unwrap()["original_message"], "Test message");
    }

    #[tokio::test]
    async fn test_permission_system_integration() {
        use std::sync::Arc;

        // Create a checker that denies Echo but allows other tools
        let mut checker = DefaultPermissionChecker::allow_all();
        checker.add_rule(PermissionRule::new("Echo", ToolPermission::Deny));

        let executor = ToolExecutorBuilder::new()
            .register_tool(EchoTool::new())
            .with_permission_checker(Arc::new(checker))
            .build();

        // Try to execute Echo (should be denied)
        let input = ToolInput::new(json!({"message": "test"})).unwrap();
        let result = executor.execute("Echo", input).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_multiple_tools() {
        let executor = ToolExecutorBuilder::new()
            .register_tool(EchoTool::new())
            .register_tool(EchoTool::with_name("Echo2"))
            .build_with_allow_all();

        assert_eq!(executor.list_tools().await.len(), 2);

        // Execute both tools
        let input = ToolInput::new(json!({"message": "test"})).unwrap();

        let result1 = executor.execute("Echo", input.clone()).await.unwrap();
        assert!(result1.success);

        let result2 = executor.execute("Echo2", input).await.unwrap();
        assert!(result2.success);
    }

    #[tokio::test]
    async fn test_tool_descriptions() {
        let executor = ToolExecutorBuilder::new()
            .register_tool(EchoTool::new())
            .build_with_allow_all();

        let descriptions = executor.get_tool_descriptions().await;
        assert_eq!(descriptions.len(), 1);
        assert_eq!(descriptions[0].name, "Echo");
        assert!(!descriptions[0].description.is_empty());
        assert!(descriptions[0].input_schema.is_object());
    }

    #[tokio::test]
    async fn test_built_in_tools_registration() {
        let mut registry = ToolRegistry::new();
        register_built_in_tools(&mut registry);

        let executor = ToolExecutorBuilder::new()
            .with_registry(registry)
            .build_with_allow_all();

        let tools = executor.list_tools().await;

        // Verify all built-in tools are registered
        assert!(tools.contains(&"Bash".to_string()));
        assert!(tools.contains(&"Read".to_string()));
        assert!(tools.contains(&"Write".to_string()));
        assert!(tools.contains(&"Edit".to_string()));
        assert!(tools.contains(&"Glob".to_string()));
        assert!(tools.contains(&"Grep".to_string()));
        assert!(tools.contains(&"Ls".to_string()));

        assert_eq!(tools.len(), 7);
    }

    #[tokio::test]
    async fn test_built_in_tools_basic_execution() {
        use tempfile::TempDir;
        use std::fs;

        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.txt");
        fs::write(&test_file, "Hello, World!").unwrap();

        let mut registry = ToolRegistry::new();
        register_built_in_tools(&mut registry);

        let executor = ToolExecutorBuilder::new()
            .with_registry(registry)
            .build_with_allow_all();

        // Test Bash tool
        let bash_input = ToolInput::new(json!({
            "command": "echo 'test'"
        })).unwrap();
        let result = executor.execute("Bash", bash_input).await.unwrap();
        assert!(result.success);

        // Test Read tool
        let read_input = ToolInput::new(json!({
            "file_path": test_file.to_str().unwrap()
        })).unwrap();
        let result = executor.execute("Read", read_input).await.unwrap();
        assert!(result.success);

        // Test Write tool
        let write_file = temp_dir.path().join("write_test.txt");
        let write_input = ToolInput::new(json!({
            "file_path": write_file.to_str().unwrap(),
            "content": "New content"
        })).unwrap();
        let result = executor.execute("Write", write_input).await.unwrap();
        assert!(result.success);

        // Test Ls tool
        let ls_input = ToolInput::new(json!({
            "path": temp_dir.path().to_str().unwrap()
        })).unwrap();
        let result = executor.execute("Ls", ls_input).await.unwrap();
        assert!(result.success);

        // Test Glob tool
        let glob_input = ToolInput::new(json!({
            "pattern": "*.txt",
            "path": temp_dir.path().to_str().unwrap()
        })).unwrap();
        let result = executor.execute("Glob", glob_input).await.unwrap();
        assert!(result.success);

        // Test Grep tool
        let grep_input = ToolInput::new(json!({
            "pattern": "Hello",
            "path": temp_dir.path().to_str().unwrap(),
            "output_mode": "files_with_matches"
        })).unwrap();
        let result = executor.execute("Grep", grep_input).await.unwrap();
        assert!(result.success);
    }
}
