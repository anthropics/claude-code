//! Permission types with auto-allow patterns

use regex::Regex;
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
    /// Read-only mode (deny all writes)
    ReadOnly,
}

impl PermissionMode {
    /// Parse from string
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "default" | "Default" => Some(Self::Default),
            "auto-yes" | "auto_yes" | "AutoYes" => Some(Self::AutoYes),
            "auto-no" | "auto_no" | "AutoNo" => Some(Self::AutoNo),
            "ask" | "Ask" => Some(Self::Ask),
            "read-only" | "read_only" | "ReadOnly" => Some(Self::ReadOnly),
            _ => None,
        }
    }
    
    /// Get description
    pub fn description(&self) -> &'static str {
        match self {
            Self::Default => "Ask for destructive operations",
            Self::AutoYes => "Automatically allow all operations",
            Self::AutoNo => "Automatically deny dangerous operations",
            Self::Ask => "Always ask for confirmation",
            Self::ReadOnly => "Deny all write operations",
        }
    }
}

/// Auto-allow pattern
#[derive(Debug, Clone)]
pub struct AutoAllowPattern {
    /// Pattern name
    pub name: String,
    /// Regex pattern for commands
    pub command_pattern: Option<Regex>,
    /// Regex pattern for paths
    pub path_pattern: Option<Regex>,
    /// Description
    pub description: String,
}

impl AutoAllowPattern {
    /// Create a new pattern
    pub fn new(name: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            command_pattern: None,
            path_pattern: None,
            description: description.into(),
        }
    }
    
    /// Add command pattern
    pub fn with_command(mut self, pattern: &str) -> anyhow::Result<Self> {
        self.command_pattern = Some(Regex::new(pattern)?);
        Ok(self)
    }
    
    /// Add path pattern
    pub fn with_path(mut self, pattern: &str) -> anyhow::Result<Self> {
        self.path_pattern = Some(Regex::new(pattern)?);
        Ok(self)
    }
    
    /// Check if command matches
    pub fn matches_command(&self, command: &str) -> bool {
        self.command_pattern.as_ref()
            .map(|r| r.is_match(command))
            .unwrap_or(true)
    }
    
    /// Check if path matches
    pub fn matches_path(&self, path: &str) -> bool {
        self.path_pattern.as_ref()
            .map(|r| r.is_match(path))
            .unwrap_or(true)
    }
}

/// Permission context for tool execution
#[derive(Debug, Clone, Default)]
pub struct PermissionContext {
    /// Current permission mode
    pub mode: PermissionMode,
    /// Allowed paths
    pub allowed_paths: Vec<String>,
    /// Blocked paths
    pub blocked_paths: Vec<String>,
    /// Auto-allow patterns
    pub auto_allow_patterns: Vec<AutoAllowPattern>,
    /// Environment variables
    pub env: HashMap<String, String>,
    /// Whether to skip confirmation for this operation
    pub skip_confirmation: bool,
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
    
    /// Add allowed path
    pub fn allow_path(mut self, path: impl Into<String>) -> Self {
        self.allowed_paths.push(path.into());
        self
    }
    
    /// Add auto-allow pattern
    pub fn add_auto_allow(&mut self, pattern: AutoAllowPattern) {
        self.auto_allow_patterns.push(pattern);
    }
    
    /// Check if path is allowed
    pub fn is_path_allowed(&self, path: &str) -> bool {
        // Check blocked paths first
        for blocked in &self.blocked_paths {
            if path.starts_with(blocked) {
                return false;
            }
        }
        
        // If no allowed paths specified, allow all (except blocked)
        if self.allowed_paths.is_empty() {
            return true;
        }
        
        // Check allowed paths
        self.allowed_paths.iter().any(|p| path.starts_with(p))
    }
    
    /// Check if command matches auto-allow patterns
    pub fn is_auto_allowed(&self, command: &str, path: Option<&str>) -> bool {
        for pattern in &self.auto_allow_patterns {
            let command_matches = pattern.matches_command(command);
            let path_matches = path.map(|p| pattern.matches_path(p)).unwrap_or(true);
            
            if command_matches && path_matches {
                return true;
            }
        }
        false
    }
    
    /// Check if operation needs confirmation based on mode and patterns
    pub fn needs_confirmation(&self, is_destructive: bool, command: &str, path: Option<&str>) -> bool {
        match self.mode {
            PermissionMode::AutoYes => false,
            PermissionMode::ReadOnly => is_destructive,
            PermissionMode::AutoNo => is_destructive,
            PermissionMode::Ask => true,
            PermissionMode::Default => {
                if self.skip_confirmation {
                    return false;
                }
                if self.is_auto_allowed(command, path) {
                    return false;
                }
                is_destructive
            }
        }
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
    /// Git repository root if applicable
    pub git_root: Option<String>,
}

impl OperationContext {
    /// Create new operation context
    pub fn new(cwd: impl Into<String>) -> Self {
        Self {
            cwd: cwd.into(),
            home_dir: dirs::home_dir().map(|p| p.to_string_lossy().to_string()),
            temp_dir: std::env::temp_dir().to_str().map(String::from),
            git_root: None,
        }
    }
    
    /// Resolve path relative to cwd
    pub fn resolve_path(&self, path: &str) -> std::path::PathBuf {
        if path.starts_with("~/") {
            if let Some(home) = &self.home_dir {
                return std::path::Path::new(home).join(&path[2..]);
            }
        }
        std::path::Path::new(&self.cwd).join(path)
    }
}

