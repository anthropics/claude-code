//! Engine events for reactive UI

use claude_core::{ContentBlock, Message, MessageId, SessionId, ToolProgress, ToolUseId, Usage};

/// Events emitted by the query engine
#[derive(Debug, Clone)]
pub enum EngineEvent {
    /// Query started
    QueryStarted {
        session_id: SessionId,
        message_id: MessageId,
    },
    /// Token received
    TokenReceived {
        session_id: SessionId,
        token: String,
    },
    /// Tool use started
    ToolUseStarted {
        session_id: SessionId,
        tool_use_id: ToolUseId,
        tool_name: String,
        input: serde_json::Value,
    },
    /// Tool use progress
    ToolUseProgress {
        session_id: SessionId,
        tool_use_id: ToolUseId,
        progress: ToolProgress,
    },
    /// Tool use completed
    ToolUseCompleted {
        session_id: SessionId,
        tool_use_id: ToolUseId,
        result: ContentBlock,
    },
    /// Assistant message complete
    AssistantMessageComplete {
        session_id: SessionId,
        message: Message,
        usage: Usage,
    },
    /// Query error
    QueryError {
        session_id: SessionId,
        error: String,
    },
}

