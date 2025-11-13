use thiserror::Error;

/// Core error type for Claude Code
#[derive(Error, Debug)]
pub enum ClaudeError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("MCP error: {0}")]
    Mcp(String),

    #[error("Plugin error: {0}")]
    Plugin(String),

    #[error("Hook error: {0}")]
    Hook(String),

    #[error("Tool error: {0}")]
    Tool(String),

    #[error("Other error: {0}")]
    Other(#[from] anyhow::Error),
}

impl ClaudeError {
    /// Create a configuration error
    pub fn config(msg: impl Into<String>) -> Self {
        ClaudeError::Config(msg.into())
    }

    /// Create an API error
    pub fn api(msg: impl Into<String>) -> Self {
        ClaudeError::Api(msg.into())
    }

    /// Create an MCP error
    pub fn mcp(msg: impl Into<String>) -> Self {
        ClaudeError::Mcp(msg.into())
    }

    /// Create a plugin error
    pub fn plugin(msg: impl Into<String>) -> Self {
        ClaudeError::Plugin(msg.into())
    }

    /// Create a hook error
    pub fn hook(msg: impl Into<String>) -> Self {
        ClaudeError::Hook(msg.into())
    }

    /// Create a tool error
    pub fn tool(msg: impl Into<String>) -> Self {
        ClaudeError::Tool(msg.into())
    }
}

/// Result type alias using ClaudeError
pub type Result<T> = std::result::Result<T, ClaudeError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_constructors() {
        let err = ClaudeError::config("invalid config");
        assert!(matches!(err, ClaudeError::Config(_)));

        let err = ClaudeError::api("connection failed");
        assert!(matches!(err, ClaudeError::Api(_)));

        let err = ClaudeError::mcp("protocol error");
        assert!(matches!(err, ClaudeError::Mcp(_)));

        let err = ClaudeError::plugin("plugin not found");
        assert!(matches!(err, ClaudeError::Plugin(_)));

        let err = ClaudeError::hook("hook execution failed");
        assert!(matches!(err, ClaudeError::Hook(_)));

        let err = ClaudeError::tool("tool error");
        assert!(matches!(err, ClaudeError::Tool(_)));
    }

    #[test]
    fn test_error_from_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err: ClaudeError = io_err.into();
        assert!(matches!(err, ClaudeError::Io(_)));
    }

    #[test]
    fn test_error_from_json() {
        let json_result = serde_json::from_str::<serde_json::Value>("invalid json");
        assert!(json_result.is_err());

        if let Err(json_err) = json_result {
            let err: ClaudeError = json_err.into();
            assert!(matches!(err, ClaudeError::Json(_)));
        }
    }

    #[test]
    fn test_error_display() {
        let err = ClaudeError::config("test error");
        let msg = format!("{}", err);
        assert_eq!(msg, "Configuration error: test error");
    }
}
