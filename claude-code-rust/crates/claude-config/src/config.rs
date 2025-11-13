use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use claude_core::Result;
use anyhow::Context;

use crate::env::EnvConfig;
use crate::mcp::{McpConfig, McpServerConfig};
use crate::paths;

/// Main configuration for Claude Code
///
/// This struct represents the complete configuration for Claude Code,
/// supporting a hierarchical configuration system with the following precedence:
/// 1. Environment variables (highest priority)
/// 2. Project config (./.claude/settings.json)
/// 3. User config (~/.claude/settings.json)
/// 4. Defaults (lowest priority)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeConfig {
    /// API key for Anthropic API
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    
    /// Model to use (e.g., "claude-sonnet-4-5-20250929")
    #[serde(default = "default_model")]
    pub model: String,
    
    /// Configuration directory path
    #[serde(skip)]
    pub config_dir: PathBuf,
    
    /// MCP server configurations
    #[serde(default)]
    pub mcp_servers: HashMap<String, McpServerConfig>,
    
    /// List of enabled plugins
    #[serde(default)]
    pub plugins: Vec<String>,
    
    /// Additional custom settings
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

fn default_model() -> String {
    "claude-sonnet-4-5-20250929".to_string()
}

impl Default for ClaudeConfig {
    fn default() -> Self {
        Self {
            api_key: None,
            model: default_model(),
            config_dir: PathBuf::from("."),
            mcp_servers: HashMap::new(),
            plugins: Vec::new(),
            extra: HashMap::new(),
        }
    }
}

impl ClaudeConfig {
    /// Create a new configuration with defaults
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Load configuration with full hierarchy
    ///
    /// Loads configuration from:
    /// 1. Default values
    /// 2. User config (~/.claude/settings.json)
    /// 3. Project config (./.claude/settings.json)
    /// 4. Environment variables
    ///
    /// Later sources override earlier ones.
    pub fn load() -> Result<Self> {
        // Start with defaults
        let mut config = Self::default();
        
        // Load user config
        if let Ok(user_path) = paths::user_settings_path() {
            if user_path.exists() {
                if let Ok(user_config) = Self::load_from_file(&user_path) {
                    config.merge(user_config);
                    config.config_dir = paths::user_config_dir()?;
                }
            }
        }
        
        // Load project config (overrides user config)
        if let Ok(project_path) = paths::project_settings_path() {
            if project_path.exists() {
                if let Ok(project_config) = Self::load_from_file(&project_path) {
                    config.merge(project_config);
                    config.config_dir = paths::project_config_dir()?;
                }
            }
        }
        
        // Load MCP servers from user config
        if let Ok(user_mcp_path) = paths::user_mcp_path() {
            if user_mcp_path.exists() {
                if let Ok(mcp_config) = McpConfig::load_from_file(&user_mcp_path) {
                    config.mcp_servers.extend(mcp_config.servers);
                }
            }
        }
        
        // Load MCP servers from project config (overrides user MCP config)
        if let Ok(project_mcp_path) = paths::project_mcp_path() {
            if project_mcp_path.exists() {
                if let Ok(mcp_config) = McpConfig::load_from_file(&project_mcp_path) {
                    config.mcp_servers.extend(mcp_config.servers);
                }
            }
        }
        
        // Apply environment variables (highest priority)
        config.apply_env();
        
        Ok(config)
    }
    
    /// Load configuration from a specific file
    pub fn load_from_file<P: AsRef<std::path::Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        let content = std::fs::read_to_string(path)
            .context(format!("Failed to read config from {}", path.display()))?;
        
        let config: Self = serde_json::from_str(&content)
            .context(format!("Failed to parse config from {}", path.display()))?;
        
        Ok(config)
    }
    
    /// Save configuration to a file
    pub fn save<P: AsRef<std::path::Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();
        
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .context("Failed to create parent directory")?;
        }
        
        let content = serde_json::to_string_pretty(self)
            .context("Failed to serialize config")?;
        
        std::fs::write(path, content)
            .context(format!("Failed to write config to {}", path.display()))?;
        
        Ok(())
    }
    
    /// Save configuration to user settings file
    pub fn save_user(&self) -> Result<()> {
        let path = paths::user_settings_path()?;
        paths::ensure_user_config_dir()?;
        self.save(path)
    }
    
    /// Save configuration to project settings file
    pub fn save_project(&self) -> Result<()> {
        let path = paths::project_settings_path()?;
        paths::ensure_project_config_dir()?;
        self.save(path)
    }
    
    /// Merge another configuration into this one
    ///
    /// Fields from `other` will override fields in `self` if they are set.
    pub fn merge(&mut self, other: Self) {
        if other.api_key.is_some() {
            self.api_key = other.api_key;
        }
        
        if other.model != default_model() {
            self.model = other.model;
        }
        
        // Merge MCP servers
        self.mcp_servers.extend(other.mcp_servers);
        
        // Merge plugins (deduplicate)
        for plugin in other.plugins {
            if !self.plugins.contains(&plugin) {
                self.plugins.push(plugin);
            }
        }
        
        // Merge extra fields
        self.extra.extend(other.extra);
    }
    
    /// Apply environment variable overrides
    fn apply_env(&mut self) {
        let env_config = EnvConfig::load();
        
        if let Some(api_key) = env_config.api_key {
            self.api_key = Some(api_key);
        }
        
        if let Some(model) = env_config.model {
            self.model = model;
        }
        
        if let Some(config_dir) = env_config.config_dir {
            self.config_dir = PathBuf::from(config_dir);
        }
    }
    
    /// Get the API key, checking environment variables first
    pub fn get_api_key(&self) -> Option<String> {
        EnvConfig::get_api_key().or_else(|| self.api_key.clone())
    }
    
    /// Get the model, checking environment variables first
    pub fn get_model(&self) -> String {
        EnvConfig::get_model().unwrap_or_else(|| self.model.clone())
    }
    
    /// Check if an API key is configured
    pub fn has_api_key(&self) -> bool {
        self.get_api_key().is_some()
    }
    
    /// Get MCP server configuration by name
    pub fn get_mcp_server(&self, name: &str) -> Option<&McpServerConfig> {
        self.mcp_servers.get(name)
    }
    
    /// Add or update an MCP server configuration
    pub fn set_mcp_server(&mut self, name: String, config: McpServerConfig) {
        self.mcp_servers.insert(name, config);
    }
    
    /// Remove an MCP server configuration
    pub fn remove_mcp_server(&mut self, name: &str) -> Option<McpServerConfig> {
        self.mcp_servers.remove(name)
    }
    
    /// Check if a plugin is enabled
    pub fn is_plugin_enabled(&self, plugin: &str) -> bool {
        self.plugins.contains(&plugin.to_string())
    }
    
    /// Add a plugin
    pub fn add_plugin(&mut self, plugin: String) {
        if !self.plugins.contains(&plugin) {
            self.plugins.push(plugin);
        }
    }
    
    /// Remove a plugin
    pub fn remove_plugin(&mut self, plugin: &str) {
        self.plugins.retain(|p| p != plugin);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = ClaudeConfig::default();
        assert_eq!(config.model, "claude-sonnet-4-5-20250929");
        assert!(config.api_key.is_none());
        assert!(config.mcp_servers.is_empty());
        assert!(config.plugins.is_empty());
    }
    
    #[test]
    fn test_merge_configs() {
        let mut config1 = ClaudeConfig::default();
        config1.api_key = Some("key1".to_string());
        config1.add_plugin("plugin1".to_string());
        
        let mut config2 = ClaudeConfig::default();
        config2.api_key = Some("key2".to_string());
        config2.model = "claude-3-opus-20240229".to_string();
        config2.add_plugin("plugin2".to_string());
        
        config1.merge(config2);
        
        assert_eq!(config1.api_key, Some("key2".to_string()));
        assert_eq!(config1.model, "claude-3-opus-20240229");
        assert_eq!(config1.plugins.len(), 2);
        assert!(config1.is_plugin_enabled("plugin1"));
        assert!(config1.is_plugin_enabled("plugin2"));
    }
    
    #[test]
    fn test_plugin_management() {
        let mut config = ClaudeConfig::default();
        
        assert!(!config.is_plugin_enabled("test"));
        
        config.add_plugin("test".to_string());
        assert!(config.is_plugin_enabled("test"));
        
        config.add_plugin("test".to_string());  // Should not duplicate
        assert_eq!(config.plugins.len(), 1);
        
        config.remove_plugin("test");
        assert!(!config.is_plugin_enabled("test"));
    }
    
    #[test]
    fn test_mcp_server_management() {
        let mut config = ClaudeConfig::default();
        
        let server_config = McpServerConfig::new("test".to_string());
        config.set_mcp_server("test-server".to_string(), server_config.clone());
        
        assert!(config.get_mcp_server("test-server").is_some());
        
        config.remove_mcp_server("test-server");
        assert!(config.get_mcp_server("test-server").is_none());
    }
    
    #[test]
    fn test_serialization() {
        let mut config = ClaudeConfig::default();
        config.api_key = Some("test-key".to_string());
        config.add_plugin("test-plugin".to_string());
        
        let json = serde_json::to_string(&config).unwrap();
        let parsed: ClaudeConfig = serde_json::from_str(&json).unwrap();
        
        assert_eq!(parsed.api_key, config.api_key);
        assert_eq!(parsed.model, config.model);
        assert_eq!(parsed.plugins, config.plugins);
    }
}
