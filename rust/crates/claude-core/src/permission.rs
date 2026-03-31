//! Permission types

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Permission mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionMode {
    /// Default mode (ask for destructive operations)
    #[default]
    Default,
    /// Auto-yes mode (allow all)
    AutoYes,
    /// Auto-no mode (deny dangerous)
    AutoNo,
    /// Ask mode (always ask)
    Ask,
}

/// Permission context for tool execution
#[derive(Debug, Clone, Default)]
pub struct PermissionContext {
    /// Current permission mode
    pub mode: PermissionMode,
    /// Allowed paths
    pub allowed_paths: Vec<String>,
    /// Environment variables
    pub env: HashMap<String, String>,
}

impl PermissionContext {
    /// Create a new permission context
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Create with specific mode
    pub fn with_mode(mut self, mode: PermissionMode) -> Self {
        self.mode = mode;
        self
    }
    
    /// Check if path is allowed
    pub fn is_path_allowed(&self, path: &str) -> bool {
        if self.allowed_paths.is_empty() {
            return true;
        }
        self.allowed_paths.iter().any(|p| path.starts_with(p))
    }
}

/// Operation context
#[derive(Debug, Clone, Default)]
pub struct OperationContext {
    /// Current working directory
    pub cwd: String,
    /// Home directory
    pub home_dir: Option<String>,
    /// Temp directory
    pub temp_dir: Option<String>,
}

