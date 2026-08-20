//! Engine context

/// Context for engine operations
#[derive(Debug, Clone)]
pub struct EngineContext {
    /// API key
    pub api_key: String,
    /// Model name
    pub model: String,
    /// Max tokens
    pub max_tokens: u32,
}

impl EngineContext {
    /// Create new engine context
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            model: "claude-3-7-sonnet-20250219".to_string(),
            max_tokens: 8192,
        }
    }
}

