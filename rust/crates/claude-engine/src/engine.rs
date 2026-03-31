//! Core query engine

use claude_core::{ClaudeResult, Message, PermissionContext, Session, SessionId, Tools};

use crate::context::EngineContext;
use crate::events::EngineEvent;
use crate::state::AppState;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

/// Query engine for processing messages
pub struct QueryEngine {
    /// Application state
    state: Arc<RwLock<AppState>>,
    /// Engine context
    context: EngineContext,
    /// Event sender
    event_tx: broadcast::Sender<EngineEvent>,
    /// Registered tools
    tools: Tools,
}

impl QueryEngine {
    /// Create a new query engine
    pub fn new(context: EngineContext, tools: Tools) -> Self {
        let (event_tx, _) = broadcast::channel(100);
        Self {
            state: Arc::new(RwLock::new(AppState::default())),
            context,
            event_tx,
            tools,
        }
    }
    
    /// Get event receiver
    pub fn subscribe(&self) -> broadcast::Receiver<EngineEvent> {
        self.event_tx.subscribe()
    }
    
    /// Process a message
    pub async fn process(&self, session_id: &SessionId, message: &str) -> ClaudeResult<Message> {
        let _ = (session_id, message);
        Ok(Message::assistant("Response from Rust engine"))
    }
}

