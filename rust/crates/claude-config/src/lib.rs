//! Configuration management for Claude Code

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use thiserror::Error;
use tracing::{info, warn};

/// Configuration errors
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),
    
    #[error("Invalid configuration: {0}")]
    Invalid(String),
    
    #[error("Config file not found: {0}")]
    NotFound(PathBuf),
}

/// Claude Code configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeConfig {
    /// API configuration
    pub api: ApiConfig,
    /// UI configuration
    pub ui: UiConfig,
    /// Tool configuration
    pub tools: ToolsConfig,
    /// Permission configuration
    pub permissions: PermissionsConfig,
    /// MCP servers configuration
    pub mcp_servers: Vec<MCPServerConfig>,
    /// LSP servers configuration
    pub lsp_servers: Vec<LSPServerConfig>,
    /// Alias definitions
    pub aliases: HashMap<String, AliasDefinition>,
    /// Custom settings
    #[serde(flatten)]
    pub custom: HashMap<String, serde_json::Value>,
}

impl Default for ClaudeConfig {
    fn default() -> Self {
        Self::new()
    }
}

impl ClaudeConfig {
    /// Create default configuration
    pub fn new() -> Self {
        Self {
            api: ApiConfig::default(),
            ui: UiConfig::default(),
            tools: ToolsConfig::default(),
            permissions: PermissionsConfig::default(),
            mcp_servers: Vec::new(),
            lsp_servers: Vec::new(),
            aliases: HashMap::new(),
            custom: HashMap::new(),
        }
    }
    
    /// Load from a file
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self, ConfigError> {
        let path = path.as_ref();
        
        if !path.exists() {
            return Err(ConfigError::NotFound(path.to_path_buf()));
        }
        
        let content = std::fs::read_to_string(path)?;
        let config: ClaudeConfig = serde_json::from_str(&content)?;
        
        info!("Loaded configuration from: {:?}", path);
        
        Ok(config)
    }
    
    /// Save to a file
    pub fn save(&self, path: impl AsRef<Path>) -> Result<(), ConfigError> {
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path.as_ref(), content)?;
        Ok(())
    }
    
    /// Get default config path
    pub fn default_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("claude-code")
            .join("config.json")
    }
    
    /// Load from default location
    pub fn load_default() -> Result<Self, ConfigError> {
        let path = Self::default_path();
        
        if path.exists() {
            Self::from_file(path)
        } else {
            warn!("No config file found at {:?}, using defaults", path);
            Ok(Self::new())
        }
    }
    
    /// Merge with another config
    pub fn merge(&mut self, other: ClaudeConfig) {
        self.api.merge(other.api);
        self.ui.merge(other.ui);
        self.tools.merge(other.tools);
        self.permissions.merge(other.permissions);
        self.mcp_servers.extend(other.mcp_servers);
        self.lsp_servers.extend(other.lsp_servers);
        self.aliases.extend(other.aliases);
        self.custom.extend(other.custom);
    }
}

/// API configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    /// API key (can also be set via ANTHROPIC_API_KEY env var)
    pub api_key: Option<String>,
    /// Default model to use
    pub model: String,
    /// API base URL (for enterprise deployments)
    pub base_url: Option<String>,
    /// Request timeout in seconds
    pub timeout_secs: u64,
    /// Maximum tokens per request
    pub max_tokens: Option<u32>,
    /// Temperature for generation
    pub temperature: Option<f32>,
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            api_key: None,
            model: "claude-3-7-sonnet-20241022".to_string(),
            base_url: None,
            timeout_secs: 60,
            max_tokens: None,
            temperature: None,
        }
    }
}

impl ApiConfig {
    fn merge(&mut self, other: ApiConfig) {
        if other.api_key.is_some() {
            self.api_key = other.api_key;
        }
        if !other.model.is_empty() {
            self.model = other.model;
        }
        if other.base_url.is_some() {
            self.base_url = other.base_url;
        }
        if other.timeout_secs != 0 {
            self.timeout_secs = other.timeout_secs;
        }
    }
}

/// UI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    /// Theme name
    pub theme: String,
    /// Enable animations
    pub animations: bool,
    /// Enable sound effects
    pub sound: bool,
    /// Show line numbers in code blocks
    pub line_numbers: bool,
    /// Tab size for indentation display
    pub tab_size: usize,
    /// Wrap long lines
    pub wrap_lines: bool,
    /// Default view mode
    pub default_view: ViewMode,
    /// Show tool execution progress
    pub show_tool_progress: bool,
}

impl Default for UiConfig {
    fn default() -> Self {
        Self {
            theme: "default".to_string(),
            animations: true,
            sound: false,
            line_numbers: true,
            tab_size: 4,
            wrap_lines: false,
            default_view: ViewMode::Chat,
            show_tool_progress: true,
        }
    }
}

impl UiConfig {
    fn merge(&mut self, other: UiConfig) {
        if !other.theme.is_empty() {
            self.theme = other.theme;
        }
        self.animations = other.animations;
        self.sound = other.sound;
        self.line_numbers = other.line_numbers;
        if other.tab_size != 0 {
            self.tab_size = other.tab_size;
        }
        self.wrap_lines = other.wrap_lines;
        self.show_tool_progress = other.show_tool_progress;
    }
}

/// View mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ViewMode {
    Chat,
    Split,
    Editor,
}

/// Tools configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsConfig {
    /// Maximum bash output size (bytes)
    pub max_bash_output: usize,
    /// Bash command timeout in seconds
    pub bash_timeout_secs: u64,
    /// Maximum file read size (bytes)
    pub max_file_read_size: usize,
    /// Maximum grep results
    pub max_grep_results: usize,
    /// Enable glob following symlinks
    pub glob_follow_symlinks: bool,
    /// Enable dangerous command warnings
    pub warn_dangerous_commands: bool,
    /// Tool-specific settings
    pub tool_settings: HashMap<String, serde_json::Value>,
}

impl Default for ToolsConfig {
    fn default() -> Self {
        Self {
            max_bash_output: 1024 * 100, // 100KB
            bash_timeout_secs: 30,
            max_file_read_size: 1024 * 100, // 100KB
            max_grep_results: 1000,
            glob_follow_symlinks: false,
            warn_dangerous_commands: true,
            tool_settings: HashMap::new(),
        }
    }
}

impl ToolsConfig {
    fn merge(&mut self, other: ToolsConfig) {
        if other.max_bash_output != 0 {
            self.max_bash_output = other.max_bash_output;
        }
        if other.bash_timeout_secs != 0 {
            self.bash_timeout_secs = other.bash_timeout_secs;
        }
        if other.max_file_read_size != 0 {
            self.max_file_read_size = other.max_file_read_size;
        }
        if other.max_grep_results != 0 {
            self.max_grep_results = other.max_grep_results;
        }
        self.tool_settings.extend(other.tool_settings);
    }
}

/// Permissions configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionsConfig {
    /// Permission mode
    pub mode: PermissionMode,
    /// Auto-allow patterns
    pub auto_allow: Vec<String>,
    /// Auto-deny patterns
    pub auto_deny: Vec<String>,
    /// Always require confirmation for these patterns
    pub require_confirm: Vec<String>,
    /// Remember user choices
    pub remember_choices: bool,
}

impl Default for PermissionsConfig {
    fn default() -> Self {
        Self {
            mode: PermissionMode::Auto,
            auto_allow: vec![],
            auto_deny: vec![],
            require_confirm: vec![],
            remember_choices: true,
        }
    }
}

impl PermissionsConfig {
    fn merge(&mut self, other: PermissionsConfig) {
        self.mode = other.mode;
        self.auto_allow.extend(other.auto_allow);
        self.auto_deny.extend(other.auto_deny);
        self.remember_choices = other.remember_choices;
    }
}

/// Permission mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionMode {
    Ask,
    Auto,
    AutoYes,
    ReadOnly,
}

/// MCP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MCPServerConfig {
    pub name: String,
    pub url: String,
    pub auth_token: Option<String>,
    pub enabled: bool,
}

/// LSP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LSPServerConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub file_extensions: Vec<String>,
    pub enabled: bool,
}

/// Alias definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AliasDefinition {
    pub description: String,
    pub steps: Vec<AliasStep>,
}

/// Alias step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AliasStep {
    pub tool: String,
    pub params: HashMap<String, String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;
    
    #[test]
    fn test_default_config() {
        let config = ClaudeConfig::new();
        assert_eq!(config.api.model, "claude-3-7-sonnet-20241022");
        assert_eq!(config.ui.theme, "default");
        assert!(config.ui.animations);
    }
    
    #[test]
    fn test_config_serialization() {
        let config = ClaudeConfig::new();
        let json = serde_json::to_string_pretty(&config).unwrap();
        assert!(json.contains("claude-3-7-sonnet"));
        assert!(json.contains("theme"));
    }
    
    #[test]
    fn test_config_save_load() {
        let mut config = ClaudeConfig::new();
        config.api.api_key = Some("test-key".to_string());
        
        let mut temp_file = NamedTempFile::new().unwrap();
        let path = temp_file.path().to_path_buf();
        
        config.save(&path).unwrap();
        
        let loaded = ClaudeConfig::from_file(&path).unwrap();
        assert_eq!(loaded.api.api_key, Some("test-key".to_string()));
    }
    
    #[test]
    fn test_config_merge() {
        let mut base = ClaudeConfig::new();
        let mut other = ClaudeConfig::new();
        
        other.api.model = "claude-3-opus".to_string();
        other.ui.animations = false;
        
        base.merge(other);
        
        assert_eq!(base.api.model, "claude-3-opus");
        assert!(!base.ui.animations);
    }
}

