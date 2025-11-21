use std::env;
use std::collections::HashMap;

/// Environment variable configuration
///
/// Handles reading configuration from environment variables with proper precedence.
/// Environment variables have the highest priority in the configuration hierarchy.
#[derive(Debug, Clone)]
pub struct EnvConfig {
    /// API key from ANTHROPIC_API_KEY or CLAUDE_API_KEY
    pub api_key: Option<String>,
    
    /// Model from CLAUDE_MODEL
    pub model: Option<String>,
    
    /// Config directory from CLAUDE_CONFIG_DIR
    pub config_dir: Option<String>,
    
    /// Additional environment variables
    pub extra: HashMap<String, String>,
}

impl EnvConfig {
    /// Load configuration from environment variables
    pub fn load() -> Self {
        let api_key = env::var("ANTHROPIC_API_KEY")
            .ok()
            .or_else(|| env::var("CLAUDE_API_KEY").ok());
        
        let model = env::var("CLAUDE_MODEL").ok();
        let config_dir = env::var("CLAUDE_CONFIG_DIR").ok();
        
        // Collect all CLAUDE_* environment variables
        let mut extra = HashMap::new();
        for (key, value) in env::vars() {
            if key.starts_with("CLAUDE_") && !matches!(key.as_str(), "CLAUDE_MODEL" | "CLAUDE_CONFIG_DIR" | "CLAUDE_API_KEY") {
                extra.insert(key, value);
            }
        }
        
        Self {
            api_key,
            model,
            config_dir,
            extra,
        }
    }
    
    /// Get the API key from environment variables
    ///
    /// Checks ANTHROPIC_API_KEY first, then CLAUDE_API_KEY
    pub fn get_api_key() -> Option<String> {
        env::var("ANTHROPIC_API_KEY")
            .ok()
            .or_else(|| env::var("CLAUDE_API_KEY").ok())
    }
    
    /// Get the model from CLAUDE_MODEL environment variable
    pub fn get_model() -> Option<String> {
        env::var("CLAUDE_MODEL").ok()
    }
    
    /// Get the config directory from CLAUDE_CONFIG_DIR environment variable
    pub fn get_config_dir() -> Option<String> {
        env::var("CLAUDE_CONFIG_DIR").ok()
    }
    
    /// Check if an environment variable is set
    pub fn has_var(key: &str) -> bool {
        env::var(key).is_ok()
    }
}

impl Default for EnvConfig {
    fn default() -> Self {
        Self::load()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_config_load() {
        let config = EnvConfig::load();
        // Just ensure it doesn't panic
        assert!(config.api_key.is_none() || config.api_key.is_some());
    }
    
    #[test]
    fn test_has_var() {
        // PATH should always be set
        assert!(EnvConfig::has_var("PATH"));
        assert!(!EnvConfig::has_var("NONEXISTENT_VAR_THAT_SHOULD_NOT_EXIST_12345"));
    }
}
