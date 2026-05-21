//! Core types and abstractions for Claude Code

pub mod agent;
pub mod error;
pub mod ids;
pub mod message;
pub mod permission;
pub mod schema;
pub mod session;
pub mod tool;
pub mod usage;

pub use agent::{AgentConfig, AgentState, AgentStatus};
pub use error::{ClaudeError, ClaudeResult, PermissionResult};
pub use ids::{AgentId, MessageId, SessionId, ToolUseId};
pub use message::{ContentBlock, Message, MessageRole, ToolResult};
pub use permission::{OperationContext, PermissionContext, PermissionMode, AutoAllowPattern};
pub use session::{Conversation, ConversationSummary, Session, SessionStats};
pub use tool::{Tool, ToolCall, ToolDefinition, ToolInput, ToolOutput, ToolProgress, Tools, ToolValidation};
pub use usage::{ModelInfo, TokenUsage, UsageTracker};

/// Version of the Rust implementation
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Build information
pub const BUILD_INFO: &str = concat!(env!("CARGO_PKG_VERSION"), " (Rust ", env!("RUSTC_VERSION"), ")");

