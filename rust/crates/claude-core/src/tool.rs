//! Tool trait and definitions

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use crate::{ClaudeResult, PermissionContext, PermissionResult, ToolUseId};

/// Tool progress update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolProgress {
    /// Percent complete (0-100)
    pub percent: Option<u8>,
    /// Status message
    pub status: String,
    /// Additional data
    pub data: Option<Value>,
    /// Elapsed time in milliseconds
    pub elapsed_ms: Option<u64>,
}

impl ToolProgress {
    /// Create a new progress update
    pub fn new(status: impl Into<String>) -> Self {
        Self {
            status: status.into(),
            percent: None,
            data: None,
            elapsed_ms: None,
        }
    }
    
    /// With percentage
    pub fn with_percent(mut self, percent: u8) -> Self {
        self.percent = Some(percent.min(100));
        self
    }
    
    /// With elapsed time
    pub fn with_elapsed(mut self, ms: u64) -> Self {
        self.elapsed_ms = Some(ms);
        self
    }
}

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
    /// Whether this tool is read-only
    #[serde(skip)]
    pub is_read_only: bool,
    /// Tool aliases
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub aliases: Vec<String>,
}

impl ToolDefinition {
    /// Create a new tool definition
    pub fn new(name: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            input_schema: serde_json::json!({"type": "object"}),
            requires_confirmation: false,
            is_read_only: false,
            aliases: Vec::new(),
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
    
    /// Set whether this tool is read-only
    pub fn read_only(mut self) -> Self {
        self.is_read_only = true;
        self
    }
    
    /// Add an alias
    pub fn with_alias(mut self, alias: impl Into<String>) -> Self {
        self.aliases.push(alias.into());
        self
    }
    
    /// Get all names (primary + aliases)
    pub fn all_names(&self) -> Vec<&str> {
        let mut names = vec![self.name.as_str()];
        names.extend(self.aliases.iter().map(String::as_str));
        names
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

impl ToolInput {
    /// Create new tool input
    pub fn new(tool_name: impl Into<String>, input: Value) -> Self {
        Self {
            tool_use_id: ToolUseId::new(),
            tool_name: tool_name.into(),
            input,
        }
    }
    
    /// Get string parameter
    pub fn get_string(&self, key: &str) -> Option<String> {
        self.input.get(key).and_then(Value::as_str).map(String::from)
    }
    
    /// Get bool parameter
    pub fn get_bool(&self, key: &str) -> Option<bool> {
        self.input.get(key).and_then(Value::as_bool)
    }
    
    /// Get array parameter
    pub fn get_array(&self, key: &str) -> Option<&Vec<Value>> {
        self.input.get(key).and_then(Value::as_array)
    }
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
    /// Progress updates (for long-running tools)
    pub progress: Vec<ToolProgress>,
}

impl ToolOutput {
    /// Create a successful output
    pub fn success(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            is_error: false,
            metadata: None,
            suggestions: None,
            progress: Vec::new(),
        }
    }
    
    /// Create an error output
    pub fn error(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            is_error: true,
            metadata: None,
            suggestions: None,
            progress: Vec::new(),
        }
    }
    
    /// Create empty success
    pub fn empty() -> Self {
        Self::success("")
    }
    
    /// With metadata
    pub fn with_metadata(mut self, metadata: Value) -> Self {
        self.metadata = Some(metadata);
        self
    }
    
    /// With suggestions
    pub fn with_suggestions(mut self, suggestions: Vec<String>) -> Self {
        self.suggestions = Some(suggestions);
        self
    }
    
    /// Add progress update
    pub fn add_progress(&mut self, progress: ToolProgress) {
        self.progress.push(progress);
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
    /// Operation context
    pub op: crate::OperationContext,
}

impl ToolContext {
    /// Create new tool context
    pub fn new(cwd: impl Into<String>) -> Self {
        let cwd = cwd.into();
        Self {
            cwd: cwd.clone(),
            permission: PermissionContext::default(),
            env: std::env::vars().collect(),
            op: crate::OperationContext::new(cwd),
        }
    }
    
    /// Resolve path relative to cwd
    pub fn resolve_path(&self, path: &str) -> std::path::PathBuf {
        self.op.resolve_path(path)
    }
}

/// Tool validation result
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ToolValidation {
    /// Input is valid
    Valid,
    /// Input is invalid
    Invalid(String),
    /// Input needs confirmation
    NeedsConfirmation(String),
}

impl ToolValidation {
    /// Check if valid
    pub fn is_valid(&self) -> bool {
        matches!(self, Self::Valid)
    }
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
        let def = self.definition();
        
        if def.is_read_only {
            return PermissionResult::Allowed;
        }
        
        if ctx.permission.mode == crate::PermissionMode::AutoYes {
            return PermissionResult::Allowed;
        }
        
        if ctx.permission.mode == crate::PermissionMode::ReadOnly && !def.is_read_only {
            return PermissionResult::Denied {
                reason: "Read-only mode".to_string(),
            };
        }
        
        // Check auto-allow patterns
        let command = format!("{} {}", def.name, input.input);
        if ctx.permission.is_auto_allowed(&command, None) {
            return PermissionResult::Allowed;
        }
        
        if def.requires_confirmation || !def.is_read_only {
            PermissionResult::NeedsConfirmation {
                action: format!("Execute {} tool", def.name),
            }
        } else {
            PermissionResult::Allowed
        }
    }
    
    /// Execute the tool
    async fn execute(&self, input: ToolInput, context: ToolContext) -> ClaudeResult<ToolOutput>;
    
    /// Check if this tool can handle the given name (for aliases)
    fn can_handle(&self, name: &str) -> bool {
        let def = self.definition();
        def.name == name || def.aliases.iter().any(|a| a == name)
    }
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
    /// Cache for quick lookup
    alias_map: HashMap<String, String>, // alias -> primary name
}

impl Tools {
    /// Create a new tool registry
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
            alias_map: HashMap::new(),
        }
    }
    
    /// Register a tool
    pub fn register<T: Tool + 'static>(&mut self, tool: T) {
        let def = tool.definition();
        let primary = def.name.clone();
        
        // Register aliases
        for alias in &def.aliases {
            self.alias_map.insert(alias.clone(), primary.clone());
        }
        
        self.tools.insert(primary, Box::new(tool));
    }
    
    /// Get a tool by name (handles aliases)
    pub fn get(&self, name: &str) -> Option<&dyn Tool> {
        // Direct lookup
        if let Some(tool) = self.tools.get(name) {
            return Some(tool.as_ref());
        }
        
        // Alias lookup
        if let Some(primary) = self.alias_map.get(name) {
            return self.tools.get(primary).map(|t| t.as_ref());
        }
        
        None
    }
    
    /// Get all tool definitions
    pub fn definitions(&self) -> Vec<&ToolDefinition> {
        self.tools.values().map(|t| t.definition()).collect()
    }
    
    /// Check if a tool exists
    pub fn contains(&self, name: &str) -> bool {
        self.tools.contains_key(name) || self.alias_map.contains_key(name)
    }
    
    /// Get all tool names including aliases
    pub fn all_names(&self) -> Vec<&str> {
        let mut names: Vec<&str> = self.tools.keys().map(String::as_str).collect();
        names.extend(self.alias_map.keys().map(String::as_str));
        names
    }
}

impl Default for Tools {
    fn default() -> Self {
        Self::new()
    }
}

