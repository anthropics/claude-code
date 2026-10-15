//! Engine events for reactive UI updates

use claude_core::{Message, ToolProgress, ToolResult, ToolUseId};
use serde_json::Value;

/// Events emitted by the engine for UI updates
#[derive(Debug, Clone)]
pub enum EngineEvent {
    /// Query processing started
    QueryStarted {
        query: String,
    },
    
    /// Query processing complete
    QueryComplete,
    
    /// New message added to conversation
    MessageAdded {
        message: Message,
    },
    
    /// Streaming started
    StreamStarted,
    
    /// Streaming token received
    StreamToken {
        token: String,
    },
    
    /// Streaming complete
    StreamComplete,
    
    /// Tool use started
    ToolUseStarted {
        id: ToolUseId,
        name: String,
    },
    
    /// Tool progress update
    ToolProgress {
        id: ToolUseId,
        progress: ToolProgress,
    },
    
    /// Tool use completed
    ToolUseCompleted {
        id: ToolUseId,
        result: ToolResult,
    },
    
    /// Permission requested from user
    PermissionRequested {
        action: String,
        tool_name: String,
        tool_input: Value,
    },
    
    /// Permission granted
    PermissionGranted {
        action: String,
    },
    
    /// Permission denied
    PermissionDenied {
        action: String,
        reason: String,
    },
    
    /// Error occurred
    Error {
        error: String,
    },
    
    /// State updated
    StateUpdated {
        agent_status: String,
        current_task: Option<String>,
        tool_count: u32,
    },
    
    /// Usage updated
    UsageUpdated {
        input_tokens: u32,
        output_tokens: u32,
    },
    
    /// Session changed
    SessionChanged {
        session_id: String,
    },
    
    /// Clear screen requested
    Clear,
}

/// Event handler trait
#[async_trait::async_trait]
pub trait EventHandler: Send + Sync {
    /// Handle an engine event
    async fn handle(&self, event: EngineEvent);
}

/// Channel-based event handler
pub struct ChannelEventHandler {
    sender: tokio::sync::mpsc::UnboundedSender<EngineEvent>,
}

impl ChannelEventHandler {
    /// Create new channel handler
    pub fn new(sender: tokio::sync::mpsc::UnboundedSender<EngineEvent>) -> Self {
        Self { sender }
    }
}

#[async_trait::async_trait]
impl EventHandler for ChannelEventHandler {
    async fn handle(&self, event: EngineEvent) {
        let _ = self.sender.send(event);
    }
}

