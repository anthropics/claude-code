//! Core tool trait and types
//!
//! This module defines the fundamental Tool trait and related types
//! used throughout Claude Code for tool execution.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use crate::error::{ClaudeError, Result};

/// Input parameters for a tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInput {
    /// Tool-specific parameters as a JSON value
    pub parameters: Value,
}

impl ToolInput {
    /// Create a new ToolInput from any serializable value
    pub fn new<T: Serialize>(params: T) -> serde_json::Result<Self> {
        Ok(Self {
            parameters: serde_json::to_value(params)?,
        })
    }

    /// Extract parameters as a specific type
    pub fn as_params<T: for<'de> Deserialize<'de>>(&self) -> serde_json::Result<T> {
        serde_json::from_value(self.parameters.clone())
    }

    /// Get a parameter by key
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.parameters.get(key)
    }
}

/// Result of a tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// Whether the tool execution was successful
    pub success: bool,

    /// Output data from the tool
    pub output: Option<Value>,

    /// Error message if execution failed
    pub error: Option<String>,

    /// Additional metadata about the execution
    #[serde(default)]
    pub metadata: HashMap<String, Value>,
}

impl ToolResult {
    /// Create a successful result with output
    pub fn success<T: Serialize>(output: T) -> Self {
        Self {
            success: true,
            output: serde_json::to_value(output).ok(),
            error: None,
            metadata: HashMap::new(),
        }
    }

    /// Create a failed result with error message
    pub fn error<T: ToString>(error: T) -> Self {
        Self {
            success: false,
            output: None,
            error: Some(error.to_string()),
            metadata: HashMap::new(),
        }
    }

    /// Add metadata to the result
    pub fn with_metadata<K: Into<String>, V: Serialize>(
        mut self,
        key: K,
        value: V,
    ) -> Self {
        if let Ok(v) = serde_json::to_value(value) {
            self.metadata.insert(key.into(), v);
        }
        self
    }
}

/// Tool description information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDescription {
    /// Tool name (e.g., "Bash", "Read", "Write")
    pub name: String,

    /// Human-readable description of what the tool does
    pub description: String,

    /// JSON schema for the tool's input parameters
    pub input_schema: Value,

    /// Examples of tool usage
    #[serde(default)]
    pub examples: Vec<String>,
}

/// Core trait that all tools must implement
#[async_trait]
pub trait Tool: Send + Sync {
    /// Get the tool's name
    fn name(&self) -> &str;

    /// Get the tool's description
    fn description(&self) -> &str;

    /// Get the tool's input schema
    fn input_schema(&self) -> Value {
        serde_json::json!({
            "type": "object",
            "properties": {},
        })
    }

    /// Execute the tool with given input
    async fn execute(&self, input: ToolInput) -> Result<ToolResult>;

    /// Get full tool description
    fn get_description(&self) -> ToolDescription {
        ToolDescription {
            name: self.name().to_string(),
            description: self.description().to_string(),
            input_schema: self.input_schema(),
            examples: vec![],
        }
    }
}

/// A registry for managing and executing tools
#[derive(Default)]
pub struct ToolRegistry {
    tools: HashMap<String, Box<dyn Tool>>,
}

impl ToolRegistry {
    /// Create a new empty tool registry
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    /// Register a tool in the registry
    pub fn register<T: Tool + 'static>(&mut self, tool: T) {
        let name = tool.name().to_string();
        self.tools.insert(name, Box::new(tool));
    }

    /// Get a tool by name
    pub fn get(&self, name: &str) -> Option<&dyn Tool> {
        self.tools.get(name).map(|t| t.as_ref())
    }

    /// Check if a tool exists in the registry
    pub fn contains(&self, name: &str) -> bool {
        self.tools.contains_key(name)
    }

    /// Get all registered tool names
    pub fn tool_names(&self) -> Vec<&str> {
        self.tools.keys().map(|s| s.as_str()).collect()
    }

    /// Get the number of registered tools
    pub fn len(&self) -> usize {
        self.tools.len()
    }

    /// Check if the registry is empty
    pub fn is_empty(&self) -> bool {
        self.tools.is_empty()
    }

    /// Execute a tool by name
    pub async fn execute(&self, name: &str, input: ToolInput) -> Result<ToolResult> {
        let tool = self
            .get(name)
            .ok_or_else(|| ClaudeError::Config(format!("Tool '{}' not found", name)))?;
        tool.execute(input).await
    }

    /// Get tool descriptions for all registered tools
    pub fn tool_descriptions(&self) -> Vec<ToolDescription> {
        self.tools
            .values()
            .map(|tool| tool.get_description())
            .collect()
    }

    /// Remove a tool from the registry
    pub fn remove(&mut self, name: &str) -> Option<Box<dyn Tool>> {
        self.tools.remove(name)
    }

    /// Clear all tools from the registry
    pub fn clear(&mut self) {
        self.tools.clear();
    }
}

impl std::fmt::Debug for ToolRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ToolRegistry")
            .field("tools", &self.tool_names())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_tool_input() {
        let input = ToolInput::new(json!({"key": "value"})).unwrap();
        assert_eq!(input.get("key").unwrap(), "value");

        let params: HashMap<String, String> = input.as_params().unwrap();
        assert_eq!(params.get("key").unwrap(), "value");
    }

    #[test]
    fn test_tool_result_success() {
        let result = ToolResult::success(json!({"output": "test"}));
        assert!(result.success);
        assert!(result.output.is_some());
        assert!(result.error.is_none());
    }

    #[test]
    fn test_tool_result_error() {
        let result = ToolResult::error("Something went wrong");
        assert!(!result.success);
        assert!(result.output.is_none());
        assert_eq!(result.error.unwrap(), "Something went wrong");
    }

    #[test]
    fn test_tool_result_with_metadata() {
        let result = ToolResult::success(json!({"data": "test"}))
            .with_metadata("execution_time", 100)
            .with_metadata("cache_hit", true);

        assert_eq!(result.metadata.len(), 2);
        assert!(result.metadata.contains_key("execution_time"));
        assert!(result.metadata.contains_key("cache_hit"));
    }

    // Test tool for ToolRegistry tests
    struct TestRegistryTool {
        name: String,
    }

    #[async_trait]
    impl Tool for TestRegistryTool {
        fn name(&self) -> &str {
            &self.name
        }

        fn description(&self) -> &str {
            "A test tool for registry"
        }

        async fn execute(&self, _input: ToolInput) -> Result<ToolResult> {
            Ok(ToolResult::success(json!({"tool": self.name})))
        }
    }

    #[test]
    fn test_tool_registry_new() {
        let registry = ToolRegistry::new();
        assert!(registry.is_empty());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn test_tool_registry_register() {
        let mut registry = ToolRegistry::new();

        let tool = TestRegistryTool {
            name: "test_tool".to_string(),
        };

        registry.register(tool);

        assert!(!registry.is_empty());
        assert_eq!(registry.len(), 1);
        assert!(registry.contains("test_tool"));
    }

    #[test]
    fn test_tool_registry_get() {
        let mut registry = ToolRegistry::new();

        let tool = TestRegistryTool {
            name: "my_tool".to_string(),
        };

        registry.register(tool);

        let retrieved = registry.get("my_tool");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name(), "my_tool");

        let not_found = registry.get("nonexistent");
        assert!(not_found.is_none());
    }

    #[tokio::test]
    async fn test_tool_registry_execute() {
        let mut registry = ToolRegistry::new();

        let tool = TestRegistryTool {
            name: "exec_tool".to_string(),
        };

        registry.register(tool);

        let input = ToolInput::new(json!({})).unwrap();
        let result = registry.execute("exec_tool", input).await.unwrap();

        assert!(result.success);
        assert_eq!(result.output.unwrap()["tool"], "exec_tool");
    }

    #[tokio::test]
    async fn test_tool_registry_execute_not_found() {
        let registry = ToolRegistry::new();
        let input = ToolInput::new(json!({})).unwrap();

        let result = registry.execute("nonexistent", input).await;
        assert!(result.is_err());
    }

    #[test]
    fn test_tool_registry_tool_names() {
        let mut registry = ToolRegistry::new();

        registry.register(TestRegistryTool {
            name: "tool_a".to_string(),
        });
        registry.register(TestRegistryTool {
            name: "tool_b".to_string(),
        });

        let mut names = registry.tool_names();
        names.sort();

        assert_eq!(names, vec!["tool_a", "tool_b"]);
    }

    #[test]
    fn test_tool_registry_remove() {
        let mut registry = ToolRegistry::new();

        registry.register(TestRegistryTool {
            name: "removable".to_string(),
        });

        assert!(registry.contains("removable"));

        let removed = registry.remove("removable");
        assert!(removed.is_some());
        assert!(!registry.contains("removable"));

        let not_found = registry.remove("nonexistent");
        assert!(not_found.is_none());
    }

    #[test]
    fn test_tool_registry_clear() {
        let mut registry = ToolRegistry::new();

        registry.register(TestRegistryTool {
            name: "tool1".to_string(),
        });
        registry.register(TestRegistryTool {
            name: "tool2".to_string(),
        });

        assert_eq!(registry.len(), 2);

        registry.clear();

        assert!(registry.is_empty());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn test_tool_registry_descriptions() {
        let mut registry = ToolRegistry::new();

        registry.register(TestRegistryTool {
            name: "desc_tool".to_string(),
        });

        let descriptions = registry.tool_descriptions();
        assert_eq!(descriptions.len(), 1);
        assert_eq!(descriptions[0].name, "desc_tool");
        assert_eq!(descriptions[0].description, "A test tool for registry");
    }
}
