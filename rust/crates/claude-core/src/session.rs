//! Session and conversation management

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{AgentId, Message, MessageRole, MessageId, SessionId, ToolProgress, Usage};

/// A conversation session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Session ID
    pub id: SessionId,
    /// Current working directory
    pub cwd: String,
    /// Conversation history
    pub conversation: Conversation,
    /// Agent state
    pub state: AgentState,
}

impl Session {
    /// Create a new session
    pub fn new(cwd: impl Into<String>) -> Self {
        let cwd = cwd.into();
        Self {
            id: SessionId::new(),
            cwd: cwd.clone(),
            conversation: Conversation::new(),
            state: AgentState::default(),
        }
    }
    
    /// Add a message to the session
    pub fn add_message(&mut self, message: Message) {
        self.conversation.add_message(message);
    }
    
    /// Get the last message
    pub fn last_message(&self) -> Option<&Message> {
        self.conversation.messages.last()
    }
}

/// Conversation history
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Conversation {
    /// Messages in the conversation
    pub messages: Vec<Message>,
    /// System message
    pub system_message: Option<String>,
}

impl Conversation {
    /// Create a new conversation
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Create with a system message
    pub fn with_system(mut self, message: impl Into<String>) -> Self {
        self.system_message = Some(message.into());
        self
    }
    
    /// Add a message
    pub fn add_message(&mut self, message: Message) {
        self.messages.push(message);
    }
    
    /// Get last assistant message
    pub fn last_assistant_message(&self) -> Option<&Message> {
        self.messages.iter().rev().find(|m| matches!(m.role, MessageRole::Assistant))
    }
    
    /// Get last user message
    pub fn last_user_message(&self) -> Option<&Message> {
        self.messages.iter().rev().find(|m| matches!(m.role, MessageRole::User))
    }
}

/// Agent state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentState {
    /// Agent ID
    pub id: AgentId,
    /// Current task
    pub current_task: Option<String>,
    /// Accumulated usage
    pub usage: Usage,
    /// Custom state data
    #[serde(skip)]
    pub data: HashMap<String, String>,
}

