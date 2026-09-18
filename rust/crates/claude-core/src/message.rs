//! Message types for conversations

use serde::{Deserialize, Serialize};

use crate::{ids::ToolUseId, TokenUsage};

/// Message role
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    /// User message
    User,
    /// Assistant message
    Assistant,
    /// System message
    System,
}

impl fmt::Display for MessageRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::User => write!(f, "user"),
            Self::Assistant => write!(f, "assistant"),
            Self::System => write!(f, "system"),
        }
    }
}

use std::fmt;

/// Message in a conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// Unique message ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<crate::MessageId>,
    /// Message role
    pub role: MessageRole,
    /// Message content
    pub content: Vec<ContentBlock>,
    /// Token usage for this message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<TokenUsage>,
    /// Timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
}

impl Message {
    /// Create a new message
    pub fn new(role: MessageRole, content: Vec<ContentBlock>) -> Self {
        Self {
            id: Some(crate::MessageId::new()),
            role,
            content,
            usage: None,
            timestamp: Some(chrono::Utc::now()),
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
    
    /// Create a system message
    pub fn system(text: impl Into<String>) -> Self {
        Self::new(
            MessageRole::System,
            vec![ContentBlock::Text { text: text.into() }],
        )
    }
    
    /// Get text content (concatenated)
    pub fn text_content(&self) -> String {
        self.content.iter()
            .filter_map(|block| match block {
                ContentBlock::Text { text } => Some(text.as_str()),
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("")
    }
    
    /// Check if this message contains tool use
    pub fn has_tool_use(&self) -> bool {
        self.content.iter().any(|block| matches!(block, ContentBlock::ToolUse { .. }))
    }
    
    /// Get tool uses from this message
    pub fn tool_uses(&self) -> Vec<&ContentBlock> {
        self.content.iter()
            .filter(|block| matches!(block, ContentBlock::ToolUse { .. }))
            .collect()
    }
    
    /// Get tool results from this message
    pub fn tool_results(&self) -> Vec<&ContentBlock> {
        self.content.iter()
            .filter(|block| matches!(block, ContentBlock::ToolResult { .. }))
            .collect()
    }
    
    /// Add usage
    pub fn with_usage(mut self, usage: TokenUsage) -> Self {
        self.usage = Some(usage);
        self
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
    /// Thinking content
    Thinking {
        /// Thinking content
        thinking: String,
        /// Signature (for verification)
        signature: Option<String>,
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
        /// Result content (can be text or other types)
        content: ToolResultContent,
        /// Whether this is an error
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
    /// Image content (for vision)
    Image {
        /// Image source
        source: ImageSource,
    },
}

/// Tool result content
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ToolResultContent {
    /// Simple text result
    Text(String),
    /// Complex content with multiple blocks
    Blocks(Vec<ToolResultBlock>),
}

impl ToolResultContent {
    /// Get as text
    pub fn as_text(&self) -> String {
        match self {
            Self::Text(t) => t.clone(),
            Self::Blocks(blocks) => blocks.iter()
                .map(|b| match b {
                    ToolResultBlock::Text { text } => text.as_str(),
                    ToolResultBlock::Image { .. } => "[image]",
                })
                .collect::<Vec<_>>()
                .join("\n"),
        }
    }
}

/// Tool result block
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ToolResultBlock {
    /// Text block
    Text {
        /// Text content
        text: String,
    },
    /// Image block
    Image {
        /// Image source
        source: ImageSource,
    },
}

/// Image source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageSource {
    /// Type (always "base64")
    pub r#type: String,
    /// Media type
    pub media_type: String,
    /// Base64 data
    pub data: String,
}

/// Tool execution result
#[derive(Debug, Clone)]
pub struct ToolResult {
    /// Tool use ID
    pub tool_use_id: ToolUseId,
    /// Output content
    pub output: ToolResultContent,
    /// Error message if any
    pub error: Option<String>,
    /// Execution time in milliseconds
    pub duration_ms: u64,
}

impl ToolResult {
    /// Create a successful text result
    pub fn success(tool_use_id: ToolUseId, output: impl Into<String>) -> Self {
        Self {
            tool_use_id,
            output: ToolResultContent::Text(output.into()),
            error: None,
            duration_ms: 0,
        }
    }
    
    /// Create an error result
    pub fn error(tool_use_id: ToolUseId, error: impl Into<String>) -> Self {
        let error_msg = error.into();
        Self {
            tool_use_id,
            output: ToolResultContent::Text(error_msg.clone()),
            error: Some(error_msg),
            duration_ms: 0,
        }
    }
    
    /// With duration
    pub fn with_duration(mut self, ms: u64) -> Self {
        self.duration_ms = ms;
        self
    }
    
    /// Check if successful
    pub fn is_success(&self) -> bool {
        self.error.is_none()
    }
}

