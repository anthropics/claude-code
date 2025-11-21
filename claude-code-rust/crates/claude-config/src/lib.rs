//! Configuration management for Claude Code
//!
//! This crate provides a hierarchical configuration system for Claude Code with
//! support for multiple configuration sources and formats.
//!
//! # Configuration Hierarchy
//!
//! Configuration is loaded in the following order (later sources override earlier ones):
//!
//! 1. **Default values** - Built-in defaults
//! 2. **User config** - `~/.claude/settings.json`
//! 3. **Project config** - `./.claude/settings.json`
//! 4. **Environment variables** - `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, etc.
//!
//! # Example
//!
//! ```no_run
//! use claude_config::ClaudeConfig;
//!
//! // Load configuration from all sources
//! let config = ClaudeConfig::load().unwrap();
//!
//! // Check if API key is configured
//! if let Some(api_key) = config.get_api_key() {
//!     println!("API key is configured");
//! }
//!
//! // Get the model to use
//! let model = config.get_model();
//! println!("Using model: {}", model);
//! ```
//!
//! # Environment Variables
//!
//! - `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` - API key for Anthropic API
//! - `CLAUDE_MODEL` - Model to use (e.g., "claude-sonnet-4-5-20250929")
//! - `CLAUDE_CONFIG_DIR` - Override default config directory
//!
//! # Configuration Files
//!
//! ## settings.json
//!
//! Main configuration file in JSON format:
//!
//! ```json
//! {
//!   "api_key": "your-api-key",
//!   "model": "claude-sonnet-4-5-20250929",
//!   "plugins": ["git", "npm"],
//!   "custom_setting": "value"
//! }
//! ```
//!
//! ## .mcp.json
//!
//! MCP (Model Context Protocol) server configuration:
//!
//! ```json
//! {
//!   "filesystem": {
//!     "command": "npx",
//!     "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"],
//!     "env": {
//!       "NODE_ENV": "production"
//!     }
//!   },
//!   "github": {
//!     "command": "npx",
//!     "args": ["-y", "@modelcontextprotocol/server-github"],
//!     "env": {
//!       "GITHUB_TOKEN": "your-token"
//!     }
//!   }
//! }
//! ```

pub mod config;
pub mod env;
pub mod mcp;
pub mod paths;

// Re-export main types
pub use config::ClaudeConfig;
pub use env::EnvConfig;
pub use mcp::{McpConfig, McpServerConfig};
pub use paths::{
    ensure_project_config_dir, ensure_user_config_dir, project_config_dir,
    project_mcp_path, project_settings_path, user_config_dir, user_mcp_path,
    user_settings_path,
};

// Re-export from claude-core
pub use claude_core::{anyhow, Result};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_config() {
        // This should not panic even if no config files exist
        let result = ClaudeConfig::load();
        assert!(result.is_ok());
    }
}
