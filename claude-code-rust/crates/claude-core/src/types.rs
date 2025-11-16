//! Core types for Claude Code
//!
//! This module defines the fundamental data structures used throughout
//! the Claude Code system, including messages, roles, and configurations.

use serde::{Deserialize, Serialize};
use std::fmt;

/// A unique identifier for a conversation session
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SessionId(pub String);

impl SessionId {
    /// Create a new session ID from a string
    pub fn new(id: impl Into<String>) -> Self {
        SessionId(id.into())
    }

    /// Generate a new random session ID
    pub fn generate() -> Self {
        SessionId(uuid_like_id())
    }

    /// Get the inner string value
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for SessionId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for SessionId {
    fn from(s: String) -> Self {
        SessionId(s)
    }
}

impl From<&str> for SessionId {
    fn from(s: &str) -> Self {
        SessionId(s.to_string())
    }
}

/// Role of a message participant
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    /// User message
    User,
    /// Assistant (Claude) message
    Assistant,
    /// System message
    System,
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Role::User => write!(f, "user"),
            Role::Assistant => write!(f, "assistant"),
            Role::System => write!(f, "system"),
        }
    }
}

/// Content block types for messages
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    /// Text content
    Text { text: String },
    /// Image content
    Image {
        #[serde(skip_serializing_if = "Option::is_none")]
        source: Option<ImageSource>,
    },
    /// Tool use request
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    /// Tool result
    ToolResult {
        tool_use_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        content: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

impl ContentBlock {
    /// Create a new text content block
    pub fn text(text: impl Into<String>) -> Self {
        ContentBlock::Text { text: text.into() }
    }

    /// Create a new tool use content block
    pub fn tool_use(
        id: impl Into<String>,
        name: impl Into<String>,
        input: serde_json::Value,
    ) -> Self {
        ContentBlock::ToolUse {
            id: id.into(),
            name: name.into(),
            input,
        }
    }

    /// Create a new tool result content block
    pub fn tool_result(
        tool_use_id: impl Into<String>,
        content: Option<String>,
        is_error: bool,
    ) -> Self {
        ContentBlock::ToolResult {
            tool_use_id: tool_use_id.into(),
            content,
            is_error: Some(is_error),
        }
    }
}

/// Image source for image content blocks
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ImageSource {
    /// Base64-encoded image
    Base64 { media_type: String, data: String },
    /// URL to image
    Url { url: String },
}

/// A message in a conversation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Message {
    /// Role of the message sender
    pub role: Role,
    /// Content of the message
    pub content: Vec<ContentBlock>,
}

impl Message {
    /// Create a new message with the given role and content
    pub fn new(role: Role, content: Vec<ContentBlock>) -> Self {
        Message { role, content }
    }

    /// Create a new user message with text content
    pub fn user(text: impl Into<String>) -> Self {
        Message {
            role: Role::User,
            content: vec![ContentBlock::text(text)],
        }
    }

    /// Create a new assistant message with text content
    pub fn assistant(text: impl Into<String>) -> Self {
        Message {
            role: Role::Assistant,
            content: vec![ContentBlock::text(text)],
        }
    }

    /// Create a new system message with text content
    pub fn system(text: impl Into<String>) -> Self {
        Message {
            role: Role::System,
            content: vec![ContentBlock::text(text)],
        }
    }

    /// Add a content block to this message
    pub fn with_content(mut self, content: ContentBlock) -> Self {
        self.content.push(content);
        self
    }
}

/// Configuration for the Claude model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// Model name (e.g., "claude-3-5-sonnet-20241022")
    pub model: String,

    /// Maximum tokens to generate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,

    /// Temperature for sampling (0.0 to 1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,

    /// Top-p sampling parameter
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,

    /// Top-k sampling parameter
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,

    /// Stop sequences
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,

    /// System prompt
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
}

impl Default for ModelConfig {
    fn default() -> Self {
        ModelConfig {
            model: "claude-3-5-sonnet-20241022".to_string(),
            max_tokens: Some(4096),
            temperature: None,
            top_p: None,
            top_k: None,
            stop_sequences: None,
            system: None,
        }
    }
}

impl ModelConfig {
    /// Create a new model configuration with the given model name
    pub fn new(model: impl Into<String>) -> Self {
        ModelConfig {
            model: model.into(),
            ..Default::default()
        }
    }

    /// Set the maximum tokens
    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = Some(max_tokens);
        self
    }

    /// Set the temperature
    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = Some(temperature);
        self
    }

    /// Set the top-p parameter
    pub fn with_top_p(mut self, top_p: f32) -> Self {
        self.top_p = Some(top_p);
        self
    }

    /// Set the system prompt
    pub fn with_system(mut self, system: impl Into<String>) -> Self {
        self.system = Some(system.into());
        self
    }
}

/// Simple UUID-like ID generator (for demonstration purposes)
/// In production, use the `uuid` crate
fn uuid_like_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("session_{}", now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_id_creation() {
        let id1 = SessionId::new("test-session");
        assert_eq!(id1.as_str(), "test-session");

        let id2 = SessionId::from("another-session");
        assert_eq!(id2.to_string(), "another-session");

        let id3 = SessionId::generate();
        assert!(id3.as_str().starts_with("session_"));
    }

    #[test]
    fn test_session_id_equality() {
        let id1 = SessionId::new("test");
        let id2 = SessionId::new("test");
        let id3 = SessionId::new("different");

        assert_eq!(id1, id2);
        assert_ne!(id1, id3);
    }

    #[test]
    fn test_role_serialization() {
        let user = Role::User;
        let json = serde_json::to_string(&user).unwrap();
        assert_eq!(json, "\"user\"");

        let assistant = Role::Assistant;
        let json = serde_json::to_string(&assistant).unwrap();
        assert_eq!(json, "\"assistant\"");

        let system = Role::System;
        let json = serde_json::to_string(&system).unwrap();
        assert_eq!(json, "\"system\"");
    }

    #[test]
    fn test_role_deserialization() {
        let json = "\"user\"";
        let role: Role = serde_json::from_str(json).unwrap();
        assert_eq!(role, Role::User);

        let json = "\"assistant\"";
        let role: Role = serde_json::from_str(json).unwrap();
        assert_eq!(role, Role::Assistant);
    }

    #[test]
    fn test_content_block_text() {
        let block = ContentBlock::text("Hello, world!");
        match &block {
            ContentBlock::Text { text } => assert_eq!(text, "Hello, world!"),
            _ => panic!("Expected text block"),
        }

        let json = serde_json::to_string(&block).unwrap();
        let deserialized: ContentBlock = serde_json::from_str(&json).unwrap();
        assert_eq!(block, deserialized);
    }

    #[test]
    fn test_content_block_tool_use() {
        let input = serde_json::json!({"query": "test"});
        let block = ContentBlock::tool_use("tool-1", "search", input.clone());

        match &block {
            ContentBlock::ToolUse {
                id,
                name,
                input: actual_input,
            } => {
                assert_eq!(id, "tool-1");
                assert_eq!(name, "search");
                assert_eq!(actual_input, &input);
            }
            _ => panic!("Expected tool use block"),
        }
    }

    #[test]
    fn test_message_creation() {
        let msg = Message::user("Hello!");
        assert_eq!(msg.role, Role::User);
        assert_eq!(msg.content.len(), 1);

        let msg = Message::assistant("Hi there!");
        assert_eq!(msg.role, Role::Assistant);

        let msg = Message::system("System prompt");
        assert_eq!(msg.role, Role::System);
    }

    #[test]
    fn test_message_with_multiple_content() {
        let msg = Message::user("Hello!").with_content(ContentBlock::text("Another block"));
        assert_eq!(msg.content.len(), 2);
    }

    #[test]
    fn test_message_serialization() {
        let msg = Message::user("Test message");
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: Message = serde_json::from_str(&json).unwrap();
        assert_eq!(msg, deserialized);
    }

    #[test]
    fn test_model_config_default() {
        let config = ModelConfig::default();
        assert_eq!(config.model, "claude-3-5-sonnet-20241022");
        assert_eq!(config.max_tokens, Some(4096));
    }

    #[test]
    fn test_model_config_builder() {
        let config = ModelConfig::new("claude-3-opus-20240229")
            .with_max_tokens(8192)
            .with_temperature(0.7)
            .with_top_p(0.9)
            .with_system("You are a helpful assistant");

        assert_eq!(config.model, "claude-3-opus-20240229");
        assert_eq!(config.max_tokens, Some(8192));
        assert_eq!(config.temperature, Some(0.7));
        assert_eq!(config.top_p, Some(0.9));
        assert_eq!(
            config.system,
            Some("You are a helpful assistant".to_string())
        );
    }

    #[test]
    fn test_model_config_serialization() {
        let config = ModelConfig::new("test-model")
            .with_max_tokens(1000)
            .with_temperature(0.5);

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ModelConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(config.model, deserialized.model);
        assert_eq!(config.max_tokens, deserialized.max_tokens);
        assert_eq!(config.temperature, deserialized.temperature);
    }
}
