//! Tool executor with permission checking and validation
//!
//! The ToolExecutor wraps a ToolRegistry and adds:
//! - Pre-execution validation
//! - Permission checking
//! - Error handling and recovery
//! - Execution metrics and logging

use std::sync::Arc;
use tokio::sync::RwLock;

use claude_core::{ClaudeError, Result, Tool, ToolInput, ToolRegistry, ToolResult};

use crate::permission::{PermissionChecker, ToolPermission};

/// Executor for tools with permission checking and validation
///
/// The ToolExecutor provides a high-level interface for executing tools
/// with built-in permission checking, validation, and error handling.
pub struct ToolExecutor {
    registry: Arc<RwLock<ToolRegistry>>,
    permission_checker: Arc<dyn PermissionChecker>,
}

impl ToolExecutor {
    /// Create a new tool executor
    ///
    /// # Arguments
    /// * `registry` - The tool registry to use
    /// * `permission_checker` - The permission checker for validating tool execution
    pub fn new(
        registry: ToolRegistry,
        permission_checker: Arc<dyn PermissionChecker>,
    ) -> Self {
        Self {
            registry: Arc::new(RwLock::new(registry)),
            permission_checker,
        }
    }

    /// Register a new tool
    ///
    /// # Arguments
    /// * `tool` - The tool to register
    pub async fn register_tool<T: Tool + 'static>(&self, tool: T) {
        let mut registry = self.registry.write().await;
        registry.register(tool);
    }

    /// Check if a tool is registered
    ///
    /// # Arguments
    /// * `name` - The name of the tool to check
    pub async fn has_tool(&self, name: &str) -> bool {
        let registry = self.registry.read().await;
        registry.contains(name)
    }

    /// List all registered tools
    pub async fn list_tools(&self) -> Vec<String> {
        let registry = self.registry.read().await;
        registry.tool_names().into_iter().map(|s| s.to_string()).collect()
    }

    /// Execute a tool with permission checking and validation
    ///
    /// # Arguments
    /// * `tool_name` - The name of the tool to execute
    /// * `input` - The input parameters for the tool
    ///
    /// # Returns
    /// The result of tool execution or an error
    ///
    /// # Errors
    /// Returns an error if:
    /// - The tool is not found
    /// - Permission is denied
    /// - Validation fails
    /// - Tool execution fails
    pub async fn execute(&self, tool_name: &str, input: ToolInput) -> Result<ToolResult> {
        // Step 1: Check if tool exists
        if !self.has_tool(tool_name).await {
            return Err(ClaudeError::Config(format!(
                "Tool '{}' not found",
                tool_name
            )));
        }

        // Step 2: Validate input
        self.validate_input(tool_name, &input).await?;

        // Step 3: Check permissions
        let permission = self.permission_checker.check_permission(tool_name, &input);
        match permission {
            ToolPermission::Allow => {
                // Execute directly
                self.execute_tool(tool_name, input).await
            }
            ToolPermission::Deny => {
                Err(ClaudeError::Config(format!(
                    "Permission denied for tool '{}'",
                    tool_name
                )))
            }
            ToolPermission::Prompt => {
                // Prompt the user
                if self.permission_checker.prompt_user(tool_name, &input) {
                    self.execute_tool(tool_name, input).await
                } else {
                    Err(ClaudeError::Config(format!(
                        "User denied permission for tool '{}'",
                        tool_name
                    )))
                }
            }
        }
    }

    /// Execute a tool without permission checking (internal use)
    async fn execute_tool(&self, tool_name: &str, input: ToolInput) -> Result<ToolResult> {
        let registry = self.registry.read().await;
        registry.execute(tool_name, input).await
    }

    /// Validate tool input before execution
    ///
    /// This can be extended to perform schema validation, parameter checking, etc.
    async fn validate_input(&self, _tool_name: &str, _input: &ToolInput) -> Result<()> {
        // TODO: Implement schema validation
        // For now, we assume input is valid if it can be serialized
        Ok(())
    }

    /// Get the tool registry (read-only access)
    pub fn registry(&self) -> Arc<RwLock<ToolRegistry>> {
        Arc::clone(&self.registry)
    }

    /// Get tool descriptions for all registered tools
    pub async fn get_tool_descriptions(&self) -> Vec<claude_core::ToolDescription> {
        let registry = self.registry.read().await;
        registry.tool_descriptions()
    }
}

/// Builder for creating a ToolExecutor with custom configuration
pub struct ToolExecutorBuilder {
    registry: ToolRegistry,
    permission_checker: Option<Arc<dyn PermissionChecker>>,
}

impl ToolExecutorBuilder {
    /// Create a new builder with an empty registry
    pub fn new() -> Self {
        Self {
            registry: ToolRegistry::new(),
            permission_checker: None,
        }
    }

    /// Use an existing registry
    pub fn with_registry(mut self, registry: ToolRegistry) -> Self {
        self.registry = registry;
        self
    }

    /// Set the permission checker
    pub fn with_permission_checker(mut self, checker: Arc<dyn PermissionChecker>) -> Self {
        self.permission_checker = Some(checker);
        self
    }

    /// Register a tool
    pub fn register_tool<T: Tool + 'static>(mut self, tool: T) -> Self {
        self.registry.register(tool);
        self
    }

    /// Build the executor
    ///
    /// # Panics
    /// Panics if no permission checker is set
    pub fn build(self) -> ToolExecutor {
        let permission_checker = self
            .permission_checker
            .expect("Permission checker must be set");

        ToolExecutor::new(self.registry, permission_checker)
    }

    /// Build the executor with a default allow-all permission checker
    pub fn build_with_allow_all(self) -> ToolExecutor {
        let permission_checker = if let Some(checker) = self.permission_checker {
            checker
        } else {
            Arc::new(crate::permission::DefaultPermissionChecker::allow_all())
        };

        ToolExecutor::new(self.registry, permission_checker)
    }
}

impl Default for ToolExecutorBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use serde_json::json;

    use crate::permission::{DefaultPermissionChecker, PermissionRule};

    // Test tool implementation
    struct TestTool {
        name: String,
        should_fail: bool,
    }

    #[async_trait]
    impl Tool for TestTool {
        fn name(&self) -> &str {
            &self.name
        }

        fn description(&self) -> &str {
            "A test tool"
        }

        async fn execute(&self, input: ToolInput) -> Result<ToolResult> {
            if self.should_fail {
                return Ok(ToolResult::error("Tool execution failed"));
            }

            Ok(ToolResult::success(json!({
                "tool": self.name,
                "input": input.parameters,
            })))
        }
    }

    #[tokio::test]
    async fn test_executor_register_and_execute() {
        let executor = ToolExecutorBuilder::new()
            .register_tool(TestTool {
                name: "test".to_string(),
                should_fail: false,
            })
            .build_with_allow_all();

        assert!(executor.has_tool("test").await);

        let input = ToolInput::new(json!({"param": "value"})).unwrap();
        let result = executor.execute("test", input).await.unwrap();

        assert!(result.success);
    }

    #[tokio::test]
    async fn test_executor_tool_not_found() {
        let executor = ToolExecutorBuilder::new().build_with_allow_all();

        let input = ToolInput::new(json!({})).unwrap();
        let result = executor.execute("nonexistent", input).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_executor_permission_denied() {
        let mut checker = DefaultPermissionChecker::deny_all();
        checker.add_rule(PermissionRule::new("allowed", ToolPermission::Allow));

        let executor = ToolExecutorBuilder::new()
            .register_tool(TestTool {
                name: "denied".to_string(),
                should_fail: false,
            })
            .register_tool(TestTool {
                name: "allowed".to_string(),
                should_fail: false,
            })
            .with_permission_checker(Arc::new(checker))
            .build();

        // Should be denied
        let input = ToolInput::new(json!({})).unwrap();
        let result = executor.execute("denied", input).await;
        assert!(result.is_err());

        // Should be allowed
        let input = ToolInput::new(json!({})).unwrap();
        let result = executor.execute("allowed", input).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_executor_list_tools() {
        let executor = ToolExecutorBuilder::new()
            .register_tool(TestTool {
                name: "tool_a".to_string(),
                should_fail: false,
            })
            .register_tool(TestTool {
                name: "tool_b".to_string(),
                should_fail: false,
            })
            .build_with_allow_all();

        let mut tools = executor.list_tools().await;
        tools.sort();

        assert_eq!(tools, vec!["tool_a", "tool_b"]);
    }

    #[tokio::test]
    async fn test_executor_tool_failure() {
        let executor = ToolExecutorBuilder::new()
            .register_tool(TestTool {
                name: "failing".to_string(),
                should_fail: true,
            })
            .build_with_allow_all();

        let input = ToolInput::new(json!({})).unwrap();
        let result = executor.execute("failing", input).await.unwrap();

        assert!(!result.success);
        assert!(result.error.is_some());
    }

    #[tokio::test]
    async fn test_executor_builder() {
        let executor = ToolExecutorBuilder::new()
            .register_tool(TestTool {
                name: "test1".to_string(),
                should_fail: false,
            })
            .register_tool(TestTool {
                name: "test2".to_string(),
                should_fail: false,
            })
            .build_with_allow_all();

        assert!(executor.has_tool("test1").await);
        assert!(executor.has_tool("test2").await);
        assert_eq!(executor.list_tools().await.len(), 2);
    }
}
