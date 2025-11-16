use anyhow::Context;
use claude_core::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// MCP (Model Context Protocol) server configuration
///
/// Defines how to launch and communicate with an MCP server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    /// Command to execute the MCP server
    pub command: String,

    /// Command-line arguments for the server
    #[serde(default)]
    pub args: Vec<String>,

    /// Environment variables to pass to the server
    #[serde(default)]
    pub env: HashMap<String, String>,
}

impl McpServerConfig {
    /// Create a new MCP server configuration
    pub fn new(command: String) -> Self {
        Self {
            command,
            args: Vec::new(),
            env: HashMap::new(),
        }
    }

    /// Add a command-line argument
    pub fn with_arg(mut self, arg: String) -> Self {
        self.args.push(arg);
        self
    }

    /// Add multiple command-line arguments
    pub fn with_args(mut self, args: Vec<String>) -> Self {
        self.args.extend(args);
        self
    }

    /// Add an environment variable
    pub fn with_env(mut self, key: String, value: String) -> Self {
        self.env.insert(key, value);
        self
    }

    /// Add multiple environment variables
    pub fn with_envs(mut self, envs: HashMap<String, String>) -> Self {
        self.env.extend(envs);
        self
    }
}

/// Collection of MCP server configurations
///
/// Maps server names to their configurations.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct McpConfig {
    /// Map of server name to server configuration
    #[serde(flatten)]
    pub servers: HashMap<String, McpServerConfig>,
}

impl McpConfig {
    /// Create a new empty MCP configuration
    pub fn new() -> Self {
        Self {
            servers: HashMap::new(),
        }
    }

    /// Load MCP configuration from a JSON file
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();

        if !path.exists() {
            return Ok(Self::new());
        }

        let content = std::fs::read_to_string(path)
            .context(format!("Failed to read MCP config from {}", path.display()))?;

        let config: Self = serde_json::from_str(&content).context(format!(
            "Failed to parse MCP config from {}",
            path.display()
        ))?;

        Ok(config)
    }

    /// Save MCP configuration to a JSON file
    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        let path = path.as_ref();

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).context("Failed to create parent directory")?;
        }

        let content =
            serde_json::to_string_pretty(self).context("Failed to serialize MCP config")?;

        std::fs::write(path, content)
            .context(format!("Failed to write MCP config to {}", path.display()))?;

        Ok(())
    }

    /// Add a server configuration
    pub fn add_server(&mut self, name: String, config: McpServerConfig) {
        self.servers.insert(name, config);
    }

    /// Get a server configuration by name
    pub fn get_server(&self, name: &str) -> Option<&McpServerConfig> {
        self.servers.get(name)
    }

    /// Remove a server configuration
    pub fn remove_server(&mut self, name: &str) -> Option<McpServerConfig> {
        self.servers.remove(name)
    }

    /// Merge with another MCP configuration
    ///
    /// Servers from `other` will override servers with the same name in `self`.
    pub fn merge(&mut self, other: McpConfig) {
        self.servers.extend(other.servers);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_server_config_builder() {
        let config = McpServerConfig::new("node".to_string())
            .with_arg("server.js".to_string())
            .with_env("PORT".to_string(), "3000".to_string());

        assert_eq!(config.command, "node");
        assert_eq!(config.args, vec!["server.js"]);
        assert_eq!(config.env.get("PORT"), Some(&"3000".to_string()));
    }

    #[test]
    fn test_mcp_config_serialization() {
        let mut config = McpConfig::new();
        config.add_server(
            "test-server".to_string(),
            McpServerConfig::new("test".to_string()),
        );

        let json = serde_json::to_string(&config).unwrap();
        let parsed: McpConfig = serde_json::from_str(&json).unwrap();

        assert!(parsed.get_server("test-server").is_some());
    }

    #[test]
    fn test_mcp_config_merge() {
        let mut config1 = McpConfig::new();
        config1.add_server(
            "server1".to_string(),
            McpServerConfig::new("cmd1".to_string()),
        );

        let mut config2 = McpConfig::new();
        config2.add_server(
            "server2".to_string(),
            McpServerConfig::new("cmd2".to_string()),
        );

        config1.merge(config2);

        assert!(config1.get_server("server1").is_some());
        assert!(config1.get_server("server2").is_some());
    }
}
