//! Error types for Claude Code

use thiserror::Error;

/// Result type alias
pub type ClaudeResult<T> = Result<T, ClaudeError>;

/// Main error type
#[derive(Error, Debug, Clone)]
pub enum ClaudeError {
    /// IO error
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    /// Serialization error
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    /// API error
    #[error("API error (status {status:?}): {message}")]
    Api {
        status: Option<u16>,
        message: String,
        request_id: Option<String>,
    },
    
    /// Tool error
    #[error("Tool error: {tool} - {message}")]
    Tool {
        tool: String,
        message: String,
    },
    
    /// Validation error
    #[error("Validation error in field '{field}': {message}")]
    Validation {
        field: String,
        message: String,
    },
    
    /// Permission error
    #[error("Permission denied: {operation}")]
    Permission {
        operation: String,
    },
    
    /// External process error
    #[error("External process '{command}' failed: {message} (exit code: {exit_code:?})")]
    ExternalProcess {
        command: String,
        message: String,
        exit_code: Option<i32>,
    },
    
    /// Timeout error
    #[error("Operation '{operation}' timed out after {duration_ms}ms")]
    Timeout {
        operation: String,
        duration_ms: u64,
    },
    
    /// Parse error
    #[error("Failed to parse {target}: {message}")]
    Parse {
        target: String,
        message: String,
    },
    
    /// Internal error
    #[error("Internal error: {0}")]
    Internal(String),
    
    /// Network error
    #[error("Network error: {0}")]
    Network(String),
}

