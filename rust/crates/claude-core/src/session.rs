//! Session and conversation management

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{AgentState, Message, MessageRole, SessionId, TokenUsage, ToolUseId};

/// A conversation session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Session ID
    pub id: SessionId,
    /// Session name (for display)
    pub name: Option<String>,
    /// Current working directory
    pub cwd: String,
    /// Conversation history
    pub conversation: Conversation,
    /// Agent state
    pub state: AgentState,
    /// Session statistics
    pub stats: SessionStats,
    /// Created at
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Last activity
    pub last_activity: chrono::DateTime<chrono::Utc>,
    /// Custom data
    #[serde(skip)]
    pub data: HashMap<String, String>,
}

impl Session {
    /// Create a new session
    pub fn new(cwd: impl Into<String>) -> Self {
        let cwd = cwd.into();
        let now = chrono::Utc::now();
        Self {
            id: SessionId::new(),
            name: None,
            cwd: cwd.clone(),
            conversation: Conversation::new(),
            state: AgentState::new(),
            stats: SessionStats::default(),
            created_at: now,
            last_activity: now,
            data: HashMap::new(),
        }
    }
    
    /// Create with a name
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }
    
    /// Add a message to the session
    pub fn add_message(&mut self, message: Message) {
        if let Some(ref usage) = message.usage {
            self.stats.total_usage.accumulate(usage);
        }
        self.conversation.add_message(message);
        self.last_activity = chrono::Utc::now();
    }
    
    /// Get the last message
    pub fn last_message(&self) -> Option<&Message> {
        self.conversation.messages.last()
    }
    
    /// Get last assistant message
    pub fn last_assistant_message(&self) -> Option<&Message> {
        self.conversation.last_assistant_message()
    }
    
    /// Get last user message
    pub fn last_user_message(&self) -> Option<&Message> {
        self.conversation.last_user_message()
    }
    
    /// Clear conversation (keep system message)
    pub fn clear(&mut self) {
        let system = self.conversation.system_message.clone();
        self.conversation = Conversation::new();
        self.conversation.system_message = system;
        self.stats.clear_count += 1;
        self.last_activity = chrono::Utc::now();
    }
    
    /// Get message count
    pub fn message_count(&self) -> usize {
        self.conversation.messages.len()
    }
    
    /// Get token count estimate
    pub fn estimated_tokens(&self) -> usize {
        // Rough estimate: 4 chars per token
        let text: String = self.conversation.messages.iter()
            .map(|m| m.text_content())
            .collect::<Vec<_>>()
            .join("");
        text.len() / 4
    }
    
    /// Check if context window is approaching limit
    pub fn is_context_window_full(&self, max_tokens: usize) -> bool {
        self.estimated_tokens() > max_tokens * 8 / 10 // 80% threshold
    }
}

/// Session statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SessionStats {
    /// Total token usage
    pub total_usage: TokenUsage,
    /// Number of /clear commands used
    pub clear_count: u32,
    /// Number of messages sent
    pub message_count: u32,
    /// Number of tool executions
    pub tool_count: u32,
    /// Duration in seconds
    pub duration_secs: u64,
}

/// Conversation history
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Conversation {
    /// Messages in the conversation
    pub messages: Vec<Message>,
    /// System message
    pub system_message: Option<String>,
    /// Tool results pending to be sent
    #[serde(skip)]
    pub pending_tool_results: Vec<crate::ToolResult>,
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
    
    /// Get last N messages
    pub fn last_n(&self, n: usize) -> &[Message] {
        let start = self.messages.len().saturating_sub(n);
        &self.messages[start..]
    }
    
    /// Find message by ID
    pub fn find_message(&self, id: &crate::MessageId) -> Option<&Message> {
        self.messages.iter().find(|m| m.id.as_ref() == Some(id))
    }
    
    /// Get messages for API (excluding system)
    pub fn to_api_messages(&self) -> Vec<Message> {
        self.messages.clone()
    }
    
    /// Add pending tool result
    pub fn add_pending_tool_result(&mut self, result: crate::ToolResult) {
        self.pending_tool_results.push(result);
    }
    
    /// Clear pending tool results
    pub fn clear_pending_tool_results(&mut self) -> Vec<crate::ToolResult> {
        std::mem::take(&mut self.pending_tool_results)
    }
}

/// Conversation summary (for display)
#[derive(Debug, Clone)]
pub struct ConversationSummary {
    /// Session ID
    pub session_id: SessionId,
    /// Session name
    pub name: Option<String>,
    /// First message preview
    pub preview: String,
    /// Message count
    pub message_count: usize,
    /// Last activity
    pub last_activity: chrono::DateTime<chrono::Utc>,
    /// Total cost
    pub estimated_cost: f64,
}

impl ConversationSummary {
    /// Create summary from session
    pub fn from_session(session: &Session) -> Self {
        let preview = session.last_user_message()
            .map(|m| m.text_content())
            .unwrap_or_default();
        
        Self {
            session_id: session.id.clone(),
            name: session.name.clone(),
            preview: preview.chars().take(50).collect::<String>() + if preview.len() > 50 { "..." } else { "" },
            message_count: session.message_count(),
            last_activity: session.last_activity,
            estimated_cost: session.stats.total_usage.estimate_cost_usd(),
        }
    }
}

