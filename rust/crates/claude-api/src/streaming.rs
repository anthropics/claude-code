//! Streaming response parsing

use serde::{Deserialize, Serialize};

/// SSE event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    /// Message start
    #[serde(rename = "message_start")]
    MessageStart { message: MessageStart },
    /// Content block start
    #[serde(rename = "content_block_start")]
    ContentBlockStart { index: usize, content_block: serde_json::Value },
    /// Content block delta
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { index: usize, delta: ContentDelta },
    /// Content block stop
    #[serde(rename = "content_block_stop")]
    ContentBlockStop { index: usize },
    /// Message delta
    #[serde(rename = "message_delta")]
    MessageDelta { delta: MessageDelta },
    /// Message stop
    #[serde(rename = "message_stop")]
    MessageStop,
    /// Ping
    #[serde(rename = "ping")]
    Ping,
}

/// Message start data
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MessageStart {
    pub id: String,
    pub role: String,
}

/// Content delta
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ContentDelta {
    #[serde(rename = "type")]
    pub delta_type: String,
    pub text: Option<String>,
    pub partial_json: Option<String>,
}

/// Message delta
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MessageDelta {
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<String>,
    pub usage: Option<serde_json::Value>,
}

/// Parse SSE line
pub fn parse_sse_line(line: &str) -> Option<StreamEvent> {
    if line.starts_with("data: ") {
        let data = &line[6..];
        serde_json::from_str(data).ok()
    } else {
        None
    }
}

