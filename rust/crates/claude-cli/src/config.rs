//! Configuration management

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Configuration
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Config {
    /// Anthropic API key
    pub api_key: Option<String>,
    /// Model to use
    pub model: Option<String>,
    /// Max tokens
    pub max_tokens: Option<u32>,
    /// Permission mode
    pub permission_mode: Option<String>,
}

impl Config {
    /// Load config from file
    pub fn load() -> Result<Option<Self>> {
        let config_path = Self::config_path()?;
        
        if !config_path.exists() {
            return Ok(None);
        }
        
        let content = std::fs::read_to_string(&config_path)?;
        let config = toml::from_str(&content)?;
        Ok(Some(config))
    }
    
    /// Load or create default
    pub fn load_or_default() -> Result<Self> {
        Ok(Self::load()?.unwrap_or_default())
    }
    
    /// Save config
    pub fn save(&self) -> Result<()> {
        let config_path = Self::config_path()?;
        
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        let content = toml::to_string_pretty(self)?;
        std::fs::write(&config_path, content)?;
        Ok(())
    }
    
    /// Get config file path
    fn config_path() -> Result<PathBuf> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not find config directory"))?;
        Ok(config_dir.join("claude-code").join("config.toml"))
    }
}

