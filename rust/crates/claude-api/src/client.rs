//! API client implementation

use claude_core::{ClaudeError, ClaudeResult, ContentBlock, Message, ToolDefinition, Usage};
use reqwest::{Client, header};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Anthropic API client
pub struct AnthropicClient {
    client: Client,
    api_key: String,
    base_url: String,
    model: String,
    max_tokens: u32,
}

impl AnthropicClient {
    /// Create a new client
    pub fn new(api_key: impl Into<String>) -> ClaudeResult<Self> {
        let mut headers = header::HeaderMap::new();
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );
        headers.insert(
            "anthropic-version",
            header::HeaderValue::from_static("2023-06-01"),
        );
        
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .default_headers(headers)
            .build()
            .map_err(|e| ClaudeError::Internal(e.to_string()))?;
        
        Ok(Self {
            client,
            api_key: api_key.into(),
            base_url: "https://api.anthropic.com/v1".to_string(),
            model: "claude-3-7-sonnet-20250219".to_string(),
            max_tokens: 8192,
        })
    }
    
    /// Send a message
    pub async fn send_message(
        &self,
        messages: Vec<Message>,
        tools: Vec<&ToolDefinition>,
    ) -> ClaudeResult<MessageResponse> {
        let _ = (messages, tools);
        Ok(MessageResponse {
            id: "msg_xxx".to_string(),
            content: vec![ContentBlock::Text { text: "Response".to_string() }],
            usage: Usage::default(),
            stop_reason: Some("end_turn".to_string()),
        })
    }
    
    /// Stream a message
    pub async fn stream_message(
        &self,
        messages: Vec<Message>,
        tools: Vec<&ToolDefinition>,
    ) -> ClaudeResult<reqwest::Response> {
        let _ = (messages, tools);
        Err(ClaudeError::Internal("Streaming not implemented".to_string()))
    }
}

/// Message response from API
#[derive(Debug, Deserialize)]
pub struct MessageResponse {
    /// Message ID
    pub id: String,
    /// Content blocks
    pub content: Vec<ContentBlock>,
    /// Token usage
    pub usage: Usage,
    /// Stop reason
    pub stop_reason: Option<String>,
}

