//! Message types for conversations

use serde::{Deserialize, Serialize};

use crate::{ContentBlock, MessageId, ToolUseId};

/// Message role
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    /// User message
    User,
    /// Assistant message
    Assistant,
}

/// Message in a conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// Unique message ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<MessageId>,
    /// Message role
    pub role: MessageRole,
    /// Message content
    pub content: Vec<ContentBlock>,
}

impl Message {
    /// Create a new message
    pub fn new(role: MessageRole, content: Vec<ContentBlock>) -> Self {
        Self {
            id: Some(MessageId::new()),
            role,
            content,
        }
    }
    
    /// Create a user text message
    pub fn user(text: impl Into<String>) -> Self {
        Self::new(
            MessageRole::User,
            vec![ContentBlock::Text { text: text.into() }],
        )
    }
    
    /// Create an assistant text message
    pub fn assistant(text: impl Into<String>) -> Self {
        Self::new(
            MessageRole::Assistant,
            vec![ContentBlock::Text { text: text.into() }],
        )
    }
}

/// Content block in a message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    /// Text content
    Text {
        /// Text content
        text: String,
    },
    /// Tool use
    ToolUse {
        /// Tool use ID
        id: ToolUseId,
        /// Tool name
        name: String,
        /// Tool input
        input: serde_json::Value,
    },
    /// Tool result
    ToolResult {
        /// Tool use ID
        tool_use_id: ToolUseId,
        /// Result content
        content: String,
        /// Whether this is an error
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

/// Token usage information
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Usage {
    /// Input tokens used
    pub input_tokens: u32,
    /// Output tokens used
    pub output_tokens: u32,
    /// Cache creation input tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_creation_input_tokens: Option<u32>,
    /// Cache read input tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_read_input_tokens: Option<u32>,
    /// Estimated cost in USD
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_cost_usd: Option<f64>,
}

impl Usage {
    /// Accumulate usage from another usage
    pub fn accumulate(&mut self, other: &Usage) {
        self.input_tokens += other.input_tokens;
        self.output_tokens += other.output_tokens;
        if let Some(cached) = other.cache_creation_input_tokens {
            self.cache_creation_input_tokens = Some(
                self.cache_creation_input_tokens.unwrap_or(0) + cached
            );
        }
        if let Some(cached) = other.cache_read_input_tokens {
            self.cache_read_input_tokens = Some(
                self.cache_read_input_tokens.unwrap_or(0) + cached
            );
        }
    }
}

/// Tool execution result
#[derive(Debug, Clone)]
pub struct ToolResult {
    /// Tool use ID
    pub tool_use_id: ToolUseId,
    /// Output content
    pub output: String,
    /// Error message if any
    pub error: Option<String>,
}

