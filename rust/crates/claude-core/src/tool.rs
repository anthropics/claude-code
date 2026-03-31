//! Tool trait and definitions

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use crate::{ClaudeResult, PermissionContext, PermissionResult, ToolUseId};

/// Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    /// Tool name
    pub name: String,
    /// Tool description
    pub description: String,
    /// JSON schema for input
    pub input_schema: Value,
    /// Whether this tool requires confirmation
    #[serde(skip)]
    pub requires_confirmation: bool,
}

impl ToolDefinition {
    /// Create a new tool definition
    pub fn new(name: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            input_schema: serde_json::json!({"type": "object"}),
            requires_confirmation: false,
        }
    }
    
    /// Set the input schema
    pub fn with_schema(mut self, schema: Value) -> Self {
        self.input_schema = schema;
        self
    }
    
    /// Set whether this tool requires confirmation
    pub fn with_confirmation(mut self, requires: bool) -> Self {
        self.requires_confirmation = requires;
        self
    }
}

/// Tool input
#[derive(Debug, Clone)]
pub struct ToolInput {
    /// Tool use ID
    pub tool_use_id: ToolUseId,
    /// Tool name
    pub tool_name: String,
    /// Tool input
    pub input: Value,
}

/// Tool output
#[derive(Debug, Clone)]
pub struct ToolOutput {
    /// Output content
    pub content: String,
    /// Whether this is an error
    pub is_error: bool,
    /// Additional metadata
    pub metadata: Option<Value>,
    /// Suggestions for the user
    pub suggestions: Option<Vec<String>>,
}

impl ToolOutput {
    /// Create a successful output
    pub fn success(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            is_error: false,
            metadata: None,
            suggestions: None,
        }
    }
    
    /// Create an error output
    pub fn error(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            is_error: true,
            metadata: None,
            suggestions: None,
        }
    }
}

/// Tool context
#[derive(Debug, Clone)]
pub struct ToolContext {
    /// Current working directory
    pub cwd: String,
    /// Permission context
    pub permission: PermissionContext,
    /// Environment variables
    pub env: HashMap<String, String>,
}

/// Tool validation result
#[derive(Debug, Clone)]
pub enum ToolValidation {
    /// Input is valid
    Valid,
    /// Input is invalid
    Invalid(String),
}

/// Tool trait
#[async_trait]
pub trait Tool: Send + Sync {
    /// Get tool definition
    fn definition(&self) -> &ToolDefinition;
    
    /// Validate tool input
    fn validate(&self, input: &ToolInput) -> ToolValidation {
        let _ = input;
        ToolValidation::Valid
    }
    
    /// Check permission
    fn check_permission(&self, input: &ToolInput, ctx: &ToolContext) -> PermissionResult {
        let _ = (input, ctx);
        PermissionResult::Allowed
    }
    
    /// Execute the tool
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput>;
}

/// Tool call from API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    /// Tool use ID
    pub id: ToolUseId,
    /// Tool name
    pub name: String,
    /// Tool input
    pub input: Value,
}

/// Tool registry
pub struct Tools {
    tools: HashMap<String, Box<dyn Tool>>,
}

impl Tools {
    /// Create a new tool registry
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }
    
    /// Register a tool
    pub fn register<T: Tool + 'static>(&mut self, tool: T) {
        let name = tool.definition().name.clone();
        self.tools.insert(name, Box::new(tool));
    }
    
    /// Get a tool by name
    pub fn get(&self, name: &str) -> Option<&dyn Tool> {
        self.tools.get(name).map(|t| t.as_ref())
    }
    
    /// Get all tool definitions
    pub fn definitions(&self) -> Vec<&ToolDefinition> {
        self.tools.values().map(|t| t.definition()).collect()
    }
    
    /// Check if a tool exists
    pub fn contains(&self, name: &str) -> bool {
        self.tools.contains_key(name)
    }
}

impl Default for Tools {
    fn default() -> Self {
        Self::new()
    }
}

