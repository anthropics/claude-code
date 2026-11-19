//! Error types

use std::fmt;
use std::io;
use thiserror::Error;

/// Result type alias
pub type ClaudeResult<T> = Result<T, ClaudeError>;

/// Main error type
#[derive(Error, Debug, Clone)]
pub enum ClaudeError {
    /// API error
    #[error("API error: {message}")]
    Api { message: String, status_code: Option<u16> },
    
    /// Authentication error
    #[error("Authentication failed: {message}")]
    Auth { message: String },
    
    /// IO error
    #[error("IO error: {message}")]
    Io { message: String },
    
    /// Validation error
    #[error("Validation error in field '{field}': {message}")]
    Validation { field: String, message: String },
    
    /// Tool execution error
    #[error("Tool '{tool}' failed: {message}")]
    Tool { tool: String, message: String },
    
    /// Tool not found
    #[error("Tool '{tool}' not found")]
    ToolNotFound { tool: String },
    
    /// Permission denied
    #[error("Permission denied: {message}")]
    PermissionDenied { message: String },
    
    /// Timeout
    #[error("Operation '{operation}' timed out after {duration_ms}ms")]
    Timeout { operation: String, duration_ms: u64 },
    
    /// External process error
    #[error("Process '{command}' failed: {message}")]
    ExternalProcess { command: String, message: String, exit_code: Option<i32> },
    
    /// Configuration error
    #[error("Configuration error: {message}")]
    Config { message: String },
    
    /// Serialization error
    #[error("Serialization error: {message}")]
    Serialization { message: String },
    
    /// Stream error
    #[error("Stream error: {message}")]
    Stream { message: String },
    
    /// Internal error
    #[error("Internal error: {message}")]
    Internal { message: String },
    
    /// User cancelled
    #[error("User cancelled the operation")]
    Cancelled,
    
    /// Max iterations reached
    #[error("Maximum tool iterations ({max}) reached")]
    MaxIterations { max: u32 },
    
    /// Session expired
    #[error("Session expired")]
    SessionExpired,
    
    /// Network error
    #[error("Network error: {message}")]
    Network { message: String },
    
    /// Rate limited
    #[error("Rate limited. Retry after {retry_after}s")]
    RateLimited { retry_after: u64 },
    
    /// Context window exceeded
    #[error("Context window exceeded: {tokens} tokens > {max} max")]
    ContextWindowExceeded { tokens: u32, max: u32 },
}

impl ClaudeError {
    /// Create an API error
    pub fn api(message: impl Into<String>) -> Self {
        Self::Api { message: message.into(), status_code: None }
    }
    
    /// Create an API error with status code
    pub fn api_with_status(message: impl Into<String>, status: u16) -> Self {
        Self::Api { message: message.into(), status_code: Some(status) }
    }
    
    /// Create an auth error
    pub fn auth(message: impl Into<String>) -> Self {
        Self::Auth { message: message.into() }
    }
    
    /// Create a tool error
    pub fn tool(tool: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Tool { tool: tool.into(), message: message.into() }
    }
    
    /// Create a validation error
    pub fn validation(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Validation { field: field.into(), message: message.into() }
    }
    
    /// Create a config error
    pub fn config(message: impl Into<String>) -> Self {
        Self::Config { message: message.into() }
    }
    
    /// Create an internal error
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal { message: message.into() }
    }
    
    /// Check if this is a retryable error
    pub fn is_retryable(&self) -> bool {
        matches!(self,
            Self::Network { .. } |
            Self::RateLimited { .. } |
            Self::Timeout { .. } |
            Self::Api { status_code: Some(500..=599), .. }
        )
    }
    
    /// Check if this is a cancellation
    pub fn is_cancelled(&self) -> bool {
        matches!(self, Self::Cancelled)
    }
    
    /// Get suggestion for fixing the error
    pub fn suggestion(&self) -> Option<String> {
        match self {
            Self::Auth { .. } => Some("Check your ANTHROPIC_API_KEY environment variable or run `claude config set api_key <key>`".to_string()),
            Self::PermissionDenied { .. } => Some("Use --permission-mode auto-yes or confirm the operation when prompted".to_string()),
            Self::ToolNotFound { tool } => Some(format!("Available tools: Bash, File, Grep, LS. '{}' is not implemented yet.", tool)),
            Self::RateLimited { retry_after } => Some(format!("Wait {} seconds before retrying", retry_after)),
            Self::ContextWindowExceeded { .. } => Some("Try starting a new session with /clear or reduce the conversation length".to_string()),
            _ => None,
        }
    }
}

impl From<io::Error> for ClaudeError {
    fn from(e: io::Error) -> Self {
        Self::Io { message: e.to_string() }
    }
}

impl From<serde_json::Error> for ClaudeError {
    fn from(e: serde_json::Error) -> Self {
        Self::Serialization { message: e.to_string() }
    }
}

impl From<reqwest::Error> for ClaudeError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() {
            Self::Timeout { operation: "HTTP request".to_string(), duration_ms: 0 }
        } else if e.is_connect() {
            Self::Network { message: e.to_string() }
        } else {
            Self::Api { message: e.to_string(), status_code: e.status().map(|s| s.as_u16()) }
        }
    }
}

/// Permission check result
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PermissionResult {
    /// Operation is allowed
    Allowed,
    /// Operation needs user confirmation
    NeedsConfirmation { action: String },
    /// Operation is denied
    Denied { reason: String },
    /// Operation is allowed this time only
    AllowOnce,
    /// Operation is denied this time only
    DenyOnce,
}

impl PermissionResult {
    /// Check if allowed
    pub fn is_allowed(&self) -> bool {
        matches!(self, Self::Allowed | Self::AllowOnce)
    }
    
    /// Check if needs confirmation
    pub fn needs_confirmation(&self) -> bool {
        matches!(self, Self::NeedsConfirmation { .. })
    }
    
    /// Check if denied
    pub fn is_denied(&self) -> bool {
        matches!(self, Self::Denied { .. } | Self::DenyOnce)
    }
}

