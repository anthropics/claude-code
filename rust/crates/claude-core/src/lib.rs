//! Core types and abstractions

pub mod error;
pub mod ids;
pub mod message;
pub mod permission;
pub mod schema;
pub mod session;
pub mod tool;

pub use error::{ClaudeError, ClaudeResult, PermissionResult};
pub use ids::{AgentId, MessageId, SessionId, ToolUseId};
pub use message::{ContentBlock, Message, MessageRole, ToolResult, Usage};
pub use permission::{OperationContext, PermissionContext, PermissionMode};
pub use session::{AgentState, Conversation, Session};
pub use tool::{Tool, ToolCall, ToolDefinition, ToolInput, ToolOutput, Tools};

/// Tool progress update
#[derive(Debug, Clone)]
pub struct ToolProgress {
    /// Percent complete (0-100)
    pub percent: Option<u8>,
    /// Status message
    pub status: String,
    /// Additional data
    pub data: Option<serde_json::Value>,
}

impl ToolProgress {
    /// Create a new progress update
    pub fn new(status: impl Into<String>) -> Self {
        Self {
            status: status.into(),
            percent: None,
            data: None,
        }
    }
    
    /// With percentage
    pub fn with_percent(mut self, percent: u8) -> Self {
        self.percent = Some(percent.min(100));
        self
    }
}

