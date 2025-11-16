//! API request and response types for the Anthropic Messages API

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Model identifiers for Claude models
#[derive(Debug, Clone, Serialize, Deserialize)]
#[derive(Default)]
pub enum Model {
    #[serde(rename = "claude-sonnet-4-5-20250929")]
    #[default]
    Sonnet,
    #[serde(rename = "claude-3-5-haiku-20241022")]
    Haiku,
    #[serde(rename = "claude-opus-4-20250514")]
    Opus,
    #[serde(untagged)]
    Custom(String),
}

impl Model {
    pub fn as_str(&self) -> &str {
        match self {
            Model::Sonnet => "claude-sonnet-4-5-20250929",
            Model::Haiku => "claude-3-5-haiku-20241022",
            Model::Opus => "claude-opus-4-20250514",
            Model::Custom(s) => s.as_str(),
        }
    }
}


/// Role in a conversation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
}

/// Content block in a message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    Image {
        source: ImageSource,
    },
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        is_error: Option<bool>,
    },
}

impl ContentBlock {
    pub fn text(text: impl Into<String>) -> Self {
        ContentBlock::Text { text: text.into() }
    }

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

    pub fn tool_result(tool_use_id: impl Into<String>, content: impl Into<String>) -> Self {
        ContentBlock::ToolResult {
            tool_use_id: tool_use_id.into(),
            content: content.into(),
            is_error: None,
        }
    }

    pub fn tool_result_error(tool_use_id: impl Into<String>, content: impl Into<String>) -> Self {
        ContentBlock::ToolResult {
            tool_use_id: tool_use_id.into(),
            content: content.into(),
            is_error: Some(true),
        }
    }
}

/// Image source for image content blocks
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ImageSource {
    Base64 { media_type: String, data: String },
    Url { url: String },
}

/// Tool definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

impl Tool {
    pub fn new(
        name: impl Into<String>,
        description: impl Into<String>,
        input_schema: serde_json::Value,
    ) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            input_schema,
        }
    }
}

/// Message in a conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: Vec<ContentBlock>,
}

impl Message {
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: vec![ContentBlock::text(content.into())],
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: Role::Assistant,
            content: vec![ContentBlock::text(content.into())],
        }
    }

    pub fn with_blocks(role: Role, content: Vec<ContentBlock>) -> Self {
        Self { role, content }
    }
}

/// Request to create a message
#[derive(Debug, Clone, Serialize)]
pub struct CreateMessageRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
}

impl CreateMessageRequest {
    pub fn new(model: Model, messages: Vec<Message>, max_tokens: u32) -> Self {
        Self {
            model: model.as_str().to_string(),
            messages,
            max_tokens,
            system: None,
            temperature: None,
            top_p: None,
            top_k: None,
            metadata: None,
            stop_sequences: None,
            stream: None,
            tools: None,
        }
    }

    pub fn with_system(mut self, system: impl Into<String>) -> Self {
        self.system = Some(system.into());
        self
    }

    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = Some(temperature);
        self
    }

    pub fn with_tools(mut self, tools: Vec<Tool>) -> Self {
        self.tools = Some(tools);
        self
    }

    pub fn with_stream(mut self, stream: bool) -> Self {
        self.stream = Some(stream);
        self
    }
}

/// Response from creating a message
#[derive(Debug, Clone, Deserialize)]
pub struct MessageResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub response_type: String,
    pub role: Role,
    pub content: Vec<ContentBlock>,
    pub model: String,
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<String>,
    pub usage: Usage,
}

/// Token usage information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

/// Streaming event types
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    MessageStart {
        message: MessageStart,
    },
    ContentBlockStart {
        index: usize,
        content_block: ContentBlockStart,
    },
    Ping,
    ContentBlockDelta {
        index: usize,
        delta: ContentBlockDelta,
    },
    ContentBlockStop {
        index: usize,
    },
    MessageDelta {
        delta: MessageDelta,
        usage: Usage,
    },
    MessageStop,
    Error {
        error: ApiError,
    },
}

/// Message start event
#[derive(Debug, Clone, Deserialize)]
pub struct MessageStart {
    pub id: String,
    #[serde(rename = "type")]
    pub message_type: String,
    pub role: Role,
    pub content: Vec<ContentBlock>,
    pub model: String,
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<String>,
    pub usage: Usage,
}

/// Content block start event
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlockStart {
    Text { text: String },
    ToolUse { id: String, name: String },
}

/// Content block delta event
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlockDelta {
    TextDelta { text: String },
    InputJsonDelta { partial_json: String },
}

/// Message delta event
#[derive(Debug, Clone, Deserialize)]
pub struct MessageDelta {
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<String>,
}

/// API error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    #[serde(rename = "type")]
    pub error_type: String,
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_serialization() {
        let model = Model::Sonnet;
        let json = serde_json::to_string(&model).unwrap();
        assert_eq!(json, r#""claude-sonnet-4-5-20250929""#);
    }

    #[test]
    fn test_model_as_str() {
        assert_eq!(Model::Sonnet.as_str(), "claude-sonnet-4-5-20250929");
        assert_eq!(Model::Haiku.as_str(), "claude-3-5-haiku-20241022");
        assert_eq!(Model::Opus.as_str(), "claude-opus-4-20250514");
        assert_eq!(
            Model::Custom("custom-model".to_string()).as_str(),
            "custom-model"
        );
    }

    #[test]
    fn test_model_default() {
        let model = Model::default();
        assert_eq!(model.as_str(), "claude-sonnet-4-5-20250929");
    }

    #[test]
    fn test_message_creation() {
        let msg = Message::user("Hello");
        assert_eq!(msg.role, Role::User);
        assert_eq!(msg.content.len(), 1);
    }

    #[test]
    fn test_message_assistant() {
        let msg = Message::assistant("Hello");
        assert_eq!(msg.role, Role::Assistant);
        assert_eq!(msg.content.len(), 1);
    }

    #[test]
    fn test_message_with_blocks() {
        let blocks = vec![ContentBlock::text("test1"), ContentBlock::text("test2")];
        let msg = Message::with_blocks(Role::User, blocks);
        assert_eq!(msg.role, Role::User);
        assert_eq!(msg.content.len(), 2);
    }

    #[test]
    fn test_content_block_text() {
        let block = ContentBlock::text("test");
        match block {
            ContentBlock::Text { text } => assert_eq!(text, "test"),
            _ => panic!("Expected text block"),
        }
    }

    #[test]
    fn test_content_block_tool_use() {
        let input = serde_json::json!({"key": "value"});
        let block = ContentBlock::tool_use("tool-1", "my_tool", input.clone());
        match block {
            ContentBlock::ToolUse {
                id,
                name,
                input: tool_input,
            } => {
                assert_eq!(id, "tool-1");
                assert_eq!(name, "my_tool");
                assert_eq!(tool_input, input);
            }
            _ => panic!("Expected tool_use block"),
        }
    }

    #[test]
    fn test_content_block_tool_result() {
        let block = ContentBlock::tool_result("tool-1", "result content");
        match block {
            ContentBlock::ToolResult {
                tool_use_id,
                content,
                is_error,
            } => {
                assert_eq!(tool_use_id, "tool-1");
                assert_eq!(content, "result content");
                assert_eq!(is_error, None);
            }
            _ => panic!("Expected tool_result block"),
        }
    }

    #[test]
    fn test_content_block_tool_result_error() {
        let block = ContentBlock::tool_result_error("tool-1", "error message");
        match block {
            ContentBlock::ToolResult {
                tool_use_id,
                content,
                is_error,
            } => {
                assert_eq!(tool_use_id, "tool-1");
                assert_eq!(content, "error message");
                assert_eq!(is_error, Some(true));
            }
            _ => panic!("Expected tool_result block"),
        }
    }

    #[test]
    fn test_tool_creation() {
        let schema = serde_json::json!({"type": "object", "properties": {}});
        let tool = Tool::new("my_tool", "A test tool", schema.clone());
        assert_eq!(tool.name, "my_tool");
        assert_eq!(tool.description, "A test tool");
        assert_eq!(tool.input_schema, schema);
    }

    #[test]
    fn test_create_message_request_builder() {
        let messages = vec![Message::user("Hello")];
        let request = CreateMessageRequest::new(Model::Sonnet, messages.clone(), 1024);
        assert_eq!(request.model, "claude-sonnet-4-5-20250929");
        assert_eq!(request.max_tokens, 1024);
        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.system, None);
    }

    #[test]
    fn test_create_message_request_with_system() {
        let messages = vec![Message::user("Hello")];
        let request = CreateMessageRequest::new(Model::Sonnet, messages, 1024)
            .with_system("You are a helpful assistant");
        assert_eq!(
            request.system,
            Some("You are a helpful assistant".to_string())
        );
    }

    #[test]
    fn test_create_message_request_with_temperature() {
        let messages = vec![Message::user("Hello")];
        let request =
            CreateMessageRequest::new(Model::Sonnet, messages, 1024).with_temperature(0.7);
        assert_eq!(request.temperature, Some(0.7));
    }

    #[test]
    fn test_create_message_request_with_stream() {
        let messages = vec![Message::user("Hello")];
        let request = CreateMessageRequest::new(Model::Sonnet, messages, 1024).with_stream(true);
        assert_eq!(request.stream, Some(true));
    }

    #[test]
    fn test_create_message_request_with_tools() {
        let messages = vec![Message::user("Hello")];
        let tool = Tool::new("test_tool", "A test", serde_json::json!({}));
        let request =
            CreateMessageRequest::new(Model::Sonnet, messages, 1024).with_tools(vec![tool]);
        assert!(request.tools.is_some());
        assert_eq!(request.tools.unwrap().len(), 1);
    }

    #[test]
    fn test_role_serialization() {
        assert_eq!(serde_json::to_string(&Role::User).unwrap(), r#""user""#);
        assert_eq!(
            serde_json::to_string(&Role::Assistant).unwrap(),
            r#""assistant""#
        );
    }

    #[test]
    fn test_usage_creation() {
        let usage = Usage {
            input_tokens: 100,
            output_tokens: 200,
        };
        assert_eq!(usage.input_tokens, 100);
        assert_eq!(usage.output_tokens, 200);
    }

    #[test]
    fn test_image_source_base64() {
        let source = ImageSource::Base64 {
            media_type: "image/png".to_string(),
            data: "base64data".to_string(),
        };
        match source {
            ImageSource::Base64 { media_type, data } => {
                assert_eq!(media_type, "image/png");
                assert_eq!(data, "base64data");
            }
            _ => panic!("Expected Base64 variant"),
        }
    }
}
